from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import (
    User, Supplier, Category, Product, Customer,
    Sale, SaleItem, StockAdjustment, MpesaTransaction
)


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(**data)
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled.")
        data['user'] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'full_name', 'role', 'phone', 'avatar', 'is_active', 'date_joined']
        read_only_fields = ['date_joined']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'role', 'phone', 'password', 'is_active']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


# ─── Supplier ────────────────────────────────────────────────────────────────

class SupplierSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = ['id', 'slug', 'name', 'contact_person', 'email',
                  'phone', 'address', 'county', 'is_active', 'product_count', 'created_at']
        read_only_fields = ['slug', 'created_at']

    def get_product_count(self, obj):
        return obj.products.count()


# ─── Category ────────────────────────────────────────────────────────────────

class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'slug', 'name', 'description', 'product_count', 'created_at']
        read_only_fields = ['slug', 'created_at']

    def get_product_count(self, obj):
        return obj.products.count()


# ─── Product ─────────────────────────────────────────────────────────────────

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    profit_margin = serializers.ReadOnlyField()
    is_low_stock = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = Product
        fields = [
            'id', 'slug', 'name', 'generic_name', 'barcode',
            'category', 'category_name', 'supplier', 'supplier_name',
            'description', 'unit', 'buying_price', 'selling_price',
            'stock_quantity', 'reorder_level', 'expiry_date',
            'requires_prescription', 'is_active', 'image',
            'profit_margin', 'is_low_stock', 'is_expired',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['slug', 'created_at', 'updated_at']


class ProductListSerializer(serializers.ModelSerializer):
    """Lighter serializer for lists / POS search."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    is_low_stock = serializers.ReadOnlyField()

    class Meta:
        model = Product
        fields = ['id', 'slug', 'name', 'generic_name', 'barcode',
                  'category_name', 'unit', 'selling_price', 'image',   # ← added image
                  'stock_quantity', 'is_low_stock', 'requires_prescription']


# ─── Customer ────────────────────────────────────────────────────────────────

class CustomerSerializer(serializers.ModelSerializer):
    total_purchases = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ['id', 'slug', 'name', 'phone', 'email', 'address',
                  'loyalty_points', 'total_purchases', 'created_at']
        read_only_fields = ['slug', 'loyalty_points', 'created_at']

    def get_total_purchases(self, obj):
        return obj.sales.filter(status='completed').count()


# ─── Sale ─────────────────────────────────────────────────────────────────────

class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.unit', read_only=True)
    profit = serializers.ReadOnlyField()

    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'product_name', 'product_unit',
                  'quantity', 'unit_price', 'buying_price', 'discount',
                  'total_price', 'profit']
        read_only_fields = ['total_price']


class SaleItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = ['product', 'quantity', 'unit_price', 'buying_price', 'discount']


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    served_by_name = serializers.CharField(source='served_by.get_full_name', read_only=True)
    total_profit = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            'id', 'slug', 'receipt_number', 'customer', 'customer_name',
            'served_by', 'served_by_name', 'payment_method', 'mpesa_reference',
            'subtotal', 'discount', 'tax', 'total_amount', 'amount_paid',
            'change_given', 'status', 'notes', 'items', 'total_profit', 'created_at'
        ]
        read_only_fields = ['slug', 'receipt_number', 'created_at']

    def get_total_profit(self, obj):
        return sum(item.profit for item in obj.items.all())


class SaleCreateSerializer(serializers.ModelSerializer):
    items = SaleItemCreateSerializer(many=True)

    class Meta:
        model = Sale
        fields = ['id', 'slug', 'customer', 'payment_method', 'mpesa_reference',   # ← added id, slug
                  'subtotal', 'discount', 'tax', 'total_amount',
                  'amount_paid', 'change_given', 'notes', 'items']
        read_only_fields = ['id', 'slug']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context.get('request')
        sale = Sale.objects.create(served_by=request.user, **validated_data)
        for item_data in items_data:
            product = item_data['product']
            qty = item_data['quantity']
            SaleItem.objects.create(sale=sale, **item_data)
            product.stock_quantity = max(0, product.stock_quantity - qty)
            product.save(update_fields=['stock_quantity'])
        return sale


# ─── Stock Adjustment ────────────────────────────────────────────────────────

class StockAdjustmentSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    adjusted_by_name = serializers.CharField(source='adjusted_by.get_full_name', read_only=True)

    class Meta:
        model = StockAdjustment
        fields = ['id', 'slug', 'product', 'product_name', 'adjusted_by',
                  'adjusted_by_name', 'reason', 'quantity_change',
                  'previous_quantity', 'new_quantity', 'notes', 'created_at']
        read_only_fields = ['slug', 'adjusted_by', 'previous_quantity', 'new_quantity', 'created_at']

    def create(self, validated_data):
        request = self.context.get('request')
        product = validated_data['product']
        qty_change = validated_data['quantity_change']
        previous = product.stock_quantity
        new_qty = max(0, previous + qty_change)
        product.stock_quantity = new_qty
        product.save(update_fields=['stock_quantity'])
        return StockAdjustment.objects.create(
            adjusted_by=request.user,
            previous_quantity=previous,
            new_quantity=new_qty,
            **validated_data
        )


# ─── M-Pesa ──────────────────────────────────────────────────────────────────

class MpesaTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MpesaTransaction
        fields = '__all__'


# ─── Dashboard / Reports ─────────────────────────────────────────────────────

class DashboardStatsSerializer(serializers.Serializer):
    today_sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    today_transactions = serializers.IntegerField()
    today_profit = serializers.DecimalField(max_digits=12, decimal_places=2)
    monthly_sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    monthly_profit = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_products = serializers.IntegerField()
    low_stock_count = serializers.IntegerField()
    expired_count = serializers.IntegerField()
    top_products = serializers.ListField()
    sales_chart = serializers.ListField()
    category_breakdown = serializers.ListField()