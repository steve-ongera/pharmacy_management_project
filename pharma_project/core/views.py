from django.db.models import Sum, Count, F, ExpressionWrapper, DecimalField, Q
from django.utils import timezone
from django.contrib.auth import login, logout
from datetime import timedelta, date

from rest_framework import viewsets, status, generics, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    User, Supplier, Category, Product, Customer,
    Sale, SaleItem, StockAdjustment, MpesaTransaction
)
from .serializers import (
    LoginSerializer, UserSerializer, UserCreateSerializer,
    SupplierSerializer, CategorySerializer,
    ProductSerializer, ProductListSerializer,
    CustomerSerializer, SaleSerializer, SaleCreateSerializer,
    StockAdjustmentSerializer, MpesaTransactionSerializer,
    DashboardStatsSerializer
)


# ─── Auth Views ───────────────────────────────────────────────────────────────

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass
        return Response({'detail': 'Logged out.'}, status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


# ─── User ViewSet ─────────────────────────────────────────────────────────────

class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all().order_by('-date_joined')
    filter_backends = [filters.SearchFilter]
    search_fields = ['username', 'first_name', 'last_name', 'email', 'role']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return UserCreateSerializer
        return UserSerializer

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get('password')
        if not password or len(password) < 6:
            return Response({'error': 'Password must be at least 6 characters.'}, status=400)
        user.set_password(password)
        user.save()
        return Response({'detail': 'Password changed.'})


# ─── Supplier ViewSet ─────────────────────────────────────────────────────────

class SupplierViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'contact_person', 'phone', 'email']
    filterset_fields = ['is_active', 'county']


# ─── Category ViewSet ─────────────────────────────────────────────────────────

class CategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Category.objects.annotate(
        product_count=Count('products')
    ).order_by('name')
    serializer_class = CategorySerializer
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


# ─── Product ViewSet ──────────────────────────────────────────────────────────

class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Product.objects.select_related('category', 'supplier').order_by('name')
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'generic_name', 'barcode']
    filterset_fields = ['category', 'supplier', 'is_active', 'requires_prescription']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProductListSerializer
        return ProductSerializer

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        qs = self.get_queryset().filter(
            stock_quantity__lte=F('reorder_level'), is_active=True
        )
        return Response(ProductListSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        threshold = date.today() + timedelta(days=30)
        qs = self.get_queryset().filter(
            expiry_date__lte=threshold, expiry_date__gte=date.today()
        )
        return Response(ProductSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def search_pos(self, request):
        """Fast search for POS — by name, generic name, or barcode."""
        q = request.query_params.get('q', '')
        qs = self.get_queryset().filter(
            Q(name__icontains=q) | Q(generic_name__icontains=q) | Q(barcode=q),
            is_active=True, stock_quantity__gt=0
        )[:20]
        return Response(ProductListSerializer(qs, many=True).data)


# ─── Customer ViewSet ─────────────────────────────────────────────────────────

class CustomerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Customer.objects.all().order_by('name')
    serializer_class = CustomerSerializer
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'phone', 'email']


# ─── Sale ViewSet ─────────────────────────────────────────────────────────────

class SaleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Sale.objects.select_related('customer', 'served_by').prefetch_related('items__product').order_by('-created_at')
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['receipt_number', 'customer__name', 'mpesa_reference']
    filterset_fields = ['status', 'payment_method']

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return SaleCreateSerializer
        return SaleSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    @action(detail=True, methods=['get'])
    def receipt(self, request, slug=None):
        sale = self.get_object()
        return Response(SaleSerializer(sale).data)

    @action(detail=True, methods=['post'])
    def refund(self, request, slug=None):
        sale = self.get_object()
        if sale.status != 'completed':
            return Response({'error': 'Only completed sales can be refunded.'}, status=400)
        for item in sale.items.all():
            item.product.stock_quantity += item.quantity
            item.product.save(update_fields=['stock_quantity'])
        sale.status = 'refunded'
        sale.save(update_fields=['status'])
        return Response(SaleSerializer(sale).data)


# ─── Stock Adjustment ViewSet ─────────────────────────────────────────────────

class StockAdjustmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = StockAdjustment.objects.select_related('product', 'adjusted_by').order_by('-created_at')
    serializer_class = StockAdjustmentSerializer
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['product__name']
    filterset_fields = ['reason', 'product']
    http_method_names = ['get', 'post', 'head', 'options']  # no edit/delete adjustments

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


# ─── M-Pesa Views ─────────────────────────────────────────────────────────────

class MpesaStkPushView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        DEV MODE: bypass STK push, return mock success.
        PROD: integrate Daraja API here.
        """
        from django.conf import settings
        phone = request.data.get('phone')
        amount = request.data.get('amount')

        if getattr(settings, 'MPESA_DEV_MODE', True):
            # Simulate successful push
            return Response({
                'success': True,
                'dev_mode': True,
                'checkout_request_id': 'DEV-BYPASS-001',
                'message': f'[DEV] STK push simulated for {phone} — KES {amount}',
            })

        # --- PRODUCTION DARAJA CODE (wired in when DEV_MODE=False) ---
        # import requests, base64
        # from datetime import datetime
        # consumer_key = settings.MPESA_CONSUMER_KEY
        # consumer_secret = settings.MPESA_CONSUMER_SECRET
        # ... (full Daraja STK push implementation)
        return Response({'error': 'M-Pesa not configured.'}, status=503)


class MpesaCallbackView(APIView):
    permission_classes = [AllowAny]  # Safaricom sends unauthenticated

    def post(self, request):
        data = request.data
        try:
            body = data.get('Body', {}).get('stkCallback', {})
            result_code = body.get('ResultCode')
            checkout_req_id = body.get('CheckoutRequestID')

            txn = MpesaTransaction.objects.filter(checkout_request_id=checkout_req_id).first()
            if txn:
                if result_code == 0:
                    metadata = {item['Name']: item.get('Value') for item in
                                body.get('CallbackMetadata', {}).get('Item', [])}
                    txn.status = 'success'
                    txn.mpesa_receipt_number = metadata.get('MpesaReceiptNumber', '')
                else:
                    txn.status = 'failed'
                    txn.result_desc = body.get('ResultDesc', '')
                txn.save()
        except Exception as e:
            pass
        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


# ─── Dashboard / Reports ──────────────────────────────────────────────────────

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        month_start = today.replace(day=1)

        profit_expr = ExpressionWrapper(
            Sum(F('items__total_price') - F('items__buying_price') * F('items__quantity')),
            output_field=DecimalField()
        )

        today_qs = Sale.objects.filter(created_at__date=today, status='completed')
        today_sales = today_qs.aggregate(total=Sum('total_amount'))['total'] or 0
        today_txn = today_qs.count()

        # Today profit
        today_profit = SaleItem.objects.filter(
            sale__created_at__date=today, sale__status='completed'
        ).aggregate(
            profit=Sum(F('total_price') - F('buying_price') * F('quantity'))
        )['profit'] or 0

        # Monthly
        monthly_qs = Sale.objects.filter(created_at__date__gte=month_start, status='completed')
        monthly_sales = monthly_qs.aggregate(total=Sum('total_amount'))['total'] or 0
        monthly_profit = SaleItem.objects.filter(
            sale__created_at__date__gte=month_start, sale__status='completed'
        ).aggregate(
            profit=Sum(F('total_price') - F('buying_price') * F('quantity'))
        )['profit'] or 0

        # Products
        total_products = Product.objects.filter(is_active=True).count()
        low_stock_count = Product.objects.filter(
            stock_quantity__lte=F('reorder_level'), is_active=True
        ).count()
        expired_count = Product.objects.filter(
            expiry_date__lt=today, is_active=True
        ).count()

        # Top selling products (last 30 days)
        top_products = SaleItem.objects.filter(
            sale__created_at__date__gte=today - timedelta(days=30),
            sale__status='completed'
        ).values('product__name', 'product__slug').annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum('total_price')
        ).order_by('-total_qty')[:10]

        # Sales chart (last 7 days)
        sales_chart = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_sales = Sale.objects.filter(
                created_at__date=day, status='completed'
            ).aggregate(total=Sum('total_amount'))['total'] or 0
            sales_chart.append({'date': str(day), 'sales': float(day_sales)})

        # Category breakdown
        category_breakdown = SaleItem.objects.filter(
            sale__created_at__date__gte=month_start,
            sale__status='completed'
        ).values('product__category__name').annotate(
            total=Sum('total_price')
        ).order_by('-total')[:8]

        return Response({
            'today_sales': float(today_sales),
            'today_transactions': today_txn,
            'today_profit': float(today_profit),
            'monthly_sales': float(monthly_sales),
            'monthly_profit': float(monthly_profit),
            'total_products': total_products,
            'low_stock_count': low_stock_count,
            'expired_count': expired_count,
            'top_products': list(top_products),
            'sales_chart': sales_chart,
            'category_breakdown': list(category_breakdown),
        })


class ReportsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get('type', 'sales')
        start_date = request.query_params.get('start', str(date.today().replace(day=1)))
        end_date = request.query_params.get('end', str(date.today()))

        if report_type == 'sales':
            data = Sale.objects.filter(
                created_at__date__range=[start_date, end_date],
                status='completed'
            ).values('created_at__date').annotate(
                total_sales=Sum('total_amount'),
                transactions=Count('id')
            ).order_by('created_at__date')
            return Response(list(data))

        elif report_type == 'profit':
            data = SaleItem.objects.filter(
                sale__created_at__date__range=[start_date, end_date],
                sale__status='completed'
            ).values('sale__created_at__date').annotate(
                profit=Sum(F('total_price') - F('buying_price') * F('quantity'))
            ).order_by('sale__created_at__date')
            return Response(list(data))

        elif report_type == 'top_products':
            data = SaleItem.objects.filter(
                sale__created_at__date__range=[start_date, end_date],
                sale__status='completed'
            ).values('product__name', 'product__category__name').annotate(
                total_qty=Sum('quantity'),
                total_revenue=Sum('total_price'),
                total_profit=Sum(F('total_price') - F('buying_price') * F('quantity'))
            ).order_by('-total_revenue')[:20]
            return Response(list(data))

        elif report_type == 'category':
            data = SaleItem.objects.filter(
                sale__created_at__date__range=[start_date, end_date],
                sale__status='completed'
            ).values('product__category__name').annotate(
                total_revenue=Sum('total_price'),
                total_qty=Sum('quantity')
            ).order_by('-total_revenue')
            return Response(list(data))

        return Response({'error': 'Invalid report type'}, status=400)