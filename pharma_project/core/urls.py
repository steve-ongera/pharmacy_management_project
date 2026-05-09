from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'suppliers', views.SupplierViewSet, basename='supplier')
router.register(r'categories', views.CategoryViewSet, basename='category')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'customers', views.CustomerViewSet, basename='customer')
router.register(r'sales', views.SaleViewSet, basename='sale')
router.register(r'stock-adjustments', views.StockAdjustmentViewSet, basename='stockadjustment')

urlpatterns = [
    # Auth
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/me/', views.MeView.as_view(), name='me'),

    # M-Pesa
    path('mpesa/stk-push/', views.MpesaStkPushView.as_view(), name='mpesa-stk-push'),
    path('mpesa/callback/', views.MpesaCallbackView.as_view(), name='mpesa-callback'),

    # Dashboard & Reports
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('reports/', views.ReportsView.as_view(), name='reports'),

    # Router (CRUD)
    path('', include(router.urls)),
]