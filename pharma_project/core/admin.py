from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import Sum, F, ExpressionWrapper, DecimalField
from django.utils.html import format_html
from django.utils import timezone
from django.urls import reverse
from django.utils.safestring import mark_safe

from .models import (
    User, Supplier, Category, Product, Customer,
    Sale, SaleItem, StockAdjustment, MpesaTransaction,
)


# ── helpers ───────────────────────────────────────────────────────────────────

def stock_badge(qty, reorder):
    if qty == 0:
        colour, label = "#dc2626", "Out of Stock"
    elif qty <= reorder:
        colour, label = "#d97706", f"Low ({qty})"
    else:
        colour, label = "#16a34a", str(qty)
    return format_html(
        '<span style="background:{};color:#fff;padding:2px 8px;'
        'border-radius:4px;font-size:0.8em;font-weight:600">{}</span>',
        colour, label,
    )


def status_badge(status, colours):
    colour = colours.get(status, "#6b7280")
    return format_html(
        '<span style="background:{};color:#fff;padding:2px 8px;'
        'border-radius:4px;font-size:0.8em;font-weight:600">{}</span>',
        colour, status.title(),
    )


# ── User ──────────────────────────────────────────────────────────────────────

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ("username", "full_name", "role_badge", "phone", "is_active", "date_joined")
    list_filter   = ("role", "is_active", "is_staff")
    search_fields = ("username", "first_name", "last_name", "email", "phone")
    ordering      = ("-date_joined",)
    readonly_fields = ("date_joined", "last_login")

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Pharmacy Info", {"fields": ("role", "phone", "avatar")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Pharmacy Info", {"fields": ("role", "phone")}),
    )

    @admin.display(description="Name")
    def full_name(self, obj):
        return obj.get_full_name() or obj.username

    @admin.display(description="Role")
    def role_badge(self, obj):
        colours = {"owner": "#7c3aed", "pharmacist": "#0369a1", "cashier": "#0f766e"}
        return status_badge(obj.role, colours)


# ── Supplier ──────────────────────────────────────────────────────────────────

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display  = ("name", "contact_person", "phone", "county", "product_count", "is_active", "created_at")
    list_filter   = ("is_active", "county")
    search_fields = ("name", "contact_person", "phone", "email")
    prepopulated_fields = {"slug": ("name",)}
    ordering      = ("name",)
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        (None, {"fields": ("name", "slug", "is_active")}),
        ("Contact", {"fields": ("contact_person", "email", "phone")}),
        ("Location", {"fields": ("address", "county")}),
        ("Timestamps", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    @admin.display(description="Products")
    def product_count(self, obj):
        count = obj.products.filter(is_active=True).count()
        url   = reverse("admin:core_product_changelist") + f"?supplier__id__exact={obj.pk}"
        return format_html('<a href="{}">{}</a>', url, count)


# ── Category ──────────────────────────────────────────────────────────────────

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display  = ("name", "product_count", "created_at")
    search_fields = ("name", "description")
    prepopulated_fields = {"slug": ("name",)}
    ordering      = ("name",)
    readonly_fields = ("created_at",)

    @admin.display(description="Products")
    def product_count(self, obj):
        count = obj.products.filter(is_active=True).count()
        url   = reverse("admin:core_product_changelist") + f"?category__id__exact={obj.pk}"
        return format_html('<a href="{}">{}</a>', url, count)


# ── Product ───────────────────────────────────────────────────────────────────

class StockStatusFilter(admin.SimpleListFilter):
    title        = "stock status"
    parameter_name = "stock_status"

    def lookups(self, request, model_admin):
        return [
            ("out",  "Out of Stock"),
            ("low",  "Low Stock"),
            ("ok",   "In Stock"),
            ("expired", "Expired"),
        ]

    def queryset(self, request, queryset):
        today = timezone.now().date()
        if self.value() == "out":
            return queryset.filter(stock_quantity=0)
        if self.value() == "low":
            return queryset.filter(stock_quantity__gt=0, stock_quantity__lte=F("reorder_level"))
        if self.value() == "ok":
            return queryset.filter(stock_quantity__gt=F("reorder_level"))
        if self.value() == "expired":
            return queryset.filter(expiry_date__lt=today)
        return queryset


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display  = (
        "name", "category", "supplier", "unit",
        "buying_price", "selling_price", "margin_pct",
        "stock_col", "expiry_date", "requires_prescription", "is_active",
    )
    list_filter   = ("is_active", "requires_prescription", "unit", "category", StockStatusFilter)
    search_fields = ("name", "generic_name", "barcode")
    prepopulated_fields = {"slug": ("name",)}
    ordering      = ("name",)
    readonly_fields = ("created_at", "updated_at", "profit_margin", "is_low_stock", "is_expired")
    autocomplete_fields = ("category", "supplier")
    list_per_page = 40

    fieldsets = (
        (None, {"fields": ("name", "slug", "generic_name", "barcode", "is_active")}),
        ("Classification", {"fields": ("category", "supplier", "unit", "requires_prescription")}),
        ("Pricing", {"fields": ("buying_price", "selling_price", "profit_margin")}),
        ("Stock", {"fields": ("stock_quantity", "reorder_level", "is_low_stock")}),
        ("Details", {"fields": ("description", "expiry_date", "is_expired", "image")}),
        ("Timestamps", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    @admin.display(description="Stock")
    def stock_col(self, obj):
        return stock_badge(obj.stock_quantity, obj.reorder_level)

    @admin.display(description="Margin %")
    def margin_pct(self, obj):
        m = obj.profit_margin
        colour = "#16a34a" if m >= 20 else "#d97706" if m >= 10 else "#dc2626"
        return format_html('<span style="color:{};font-weight:600">{:.1f}%</span>', colour, m)

    actions = ["mark_inactive", "mark_active"]

    @admin.action(description="Mark selected products as inactive")
    def mark_inactive(self, request, queryset):
        queryset.update(is_active=False)

    @admin.action(description="Mark selected products as active")
    def mark_active(self, request, queryset):
        queryset.update(is_active=True)


# ── Customer ──────────────────────────────────────────────────────────────────

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display  = ("name", "phone", "email", "loyalty_points", "total_spent", "sale_count", "created_at")
    search_fields = ("name", "phone", "email")
    ordering      = ("-loyalty_points",)
    readonly_fields = ("created_at", "slug")
    prepopulated_fields = {}   # slug auto-managed in model

    fieldsets = (
        (None, {"fields": ("name", "slug")}),
        ("Contact", {"fields": ("phone", "email", "address")}),
        ("Loyalty", {"fields": ("loyalty_points",)}),
        ("Timestamps", {"fields": ("created_at",), "classes": ("collapse",)}),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.annotate(
            _total_spent=Sum("sales__total_amount"),
            _sale_count=models_Count("sales"),
        )

    @admin.display(description="Total Spent (KES)", ordering="_total_spent")
    def total_spent(self, obj):
        amt = getattr(obj, "_total_spent", None) or 0
        return f"KES {amt:,.0f}"

    @admin.display(description="Sales", ordering="_sale_count")
    def sale_count(self, obj):
        count = getattr(obj, "_sale_count", 0)
        url   = reverse("admin:core_sale_changelist") + f"?customer__id__exact={obj.pk}"
        return format_html('<a href="{}">{}</a>', url, count)


# we need Count from django.db.models; import it with an alias to avoid clash
from django.db.models import Count as models_Count


# fix CustomerAdmin.get_queryset — re-register after import
CustomerAdmin.get_queryset = lambda self, request: (
    super(CustomerAdmin, self).get_queryset(request).annotate(
        _total_spent=Sum("sales__total_amount"),
        _sale_count=models_Count("sales"),
    )
)


# ── Sale ──────────────────────────────────────────────────────────────────────

class SaleItemInline(admin.TabularInline):
    model  = SaleItem
    extra  = 0
    readonly_fields = ("total_price", "profit")
    fields = ("product", "quantity", "unit_price", "buying_price", "discount", "total_price", "profit")
    autocomplete_fields = ("product",)

    def has_add_permission(self, request, obj=None):
        return obj is None   # only allow adding items on new sale creation

    def has_delete_permission(self, request, obj=None):
        return False


class PaymentMethodFilter(admin.SimpleListFilter):
    title = "payment method"
    parameter_name = "payment_method"

    def lookups(self, request, model_admin):
        return [("cash", "Cash"), ("mpesa", "M-Pesa"), ("card", "Card"), ("insurance", "Insurance")]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(payment_method=self.value())
        return queryset


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display  = (
        "receipt_number", "created_at", "customer", "served_by",
        "payment_col", "total_amount", "status_col",
    )
    list_filter   = ("status", PaymentMethodFilter, "created_at", "served_by")
    search_fields = ("receipt_number", "customer__name", "mpesa_reference", "served_by__username")
    ordering      = ("-created_at",)
    readonly_fields = (
        "receipt_number", "slug", "subtotal", "total_amount",
        "change_given", "created_at",
    )
    date_hierarchy = "created_at"
    inlines       = [SaleItemInline]
    list_per_page = 50

    fieldsets = (
        ("Receipt", {"fields": ("receipt_number", "slug", "status", "notes")}),
        ("Parties", {"fields": ("customer", "served_by")}),
        ("Payment", {"fields": ("payment_method", "mpesa_reference", "amount_paid", "change_given")}),
        ("Amounts", {"fields": ("subtotal", "discount", "tax", "total_amount")}),
        ("Timestamps", {"fields": ("created_at",), "classes": ("collapse",)}),
    )

    @admin.display(description="Payment")
    def payment_col(self, obj):
        colours = {
            "cash":      "#0f766e",
            "mpesa":     "#16a34a",
            "card":      "#0369a1",
            "insurance": "#7c3aed",
        }
        return status_badge(obj.payment_method, colours)

    @admin.display(description="Status")
    def status_col(self, obj):
        colours = {
            "completed": "#16a34a",
            "pending":   "#d97706",
            "refunded":  "#0369a1",
            "cancelled": "#dc2626",
        }
        return status_badge(obj.status, colours)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("customer", "served_by")

    actions = ["mark_refunded", "mark_cancelled"]

    @admin.action(description="Mark selected sales as Refunded")
    def mark_refunded(self, request, queryset):
        queryset.filter(status="completed").update(status="refunded")

    @admin.action(description="Mark selected sales as Cancelled")
    def mark_cancelled(self, request, queryset):
        queryset.filter(status="pending").update(status="cancelled")


# ── SaleItem ──────────────────────────────────────────────────────────────────

@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display  = ("sale", "product", "quantity", "unit_price", "discount", "total_price", "profit")
    list_filter   = ("sale__status",)
    search_fields = ("sale__receipt_number", "product__name")
    ordering      = ("-sale__created_at",)
    readonly_fields = ("total_price", "profit")
    autocomplete_fields = ("product",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("sale", "product")


# ── StockAdjustment ───────────────────────────────────────────────────────────

class AdjustmentReasonFilter(admin.SimpleListFilter):
    title = "reason"
    parameter_name = "reason"

    def lookups(self, request, model_admin):
        return [
            ("purchase",   "Purchase / Restock"),
            ("return",     "Customer Return"),
            ("damage",     "Damaged / Expired"),
            ("theft",      "Theft"),
            ("correction", "Stock Correction"),
        ]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(reason=self.value())
        return queryset


@admin.register(StockAdjustment)
class StockAdjustmentAdmin(admin.ModelAdmin):
    list_display  = (
        "created_at", "product", "reason_badge", "quantity_change_col",
        "previous_quantity", "new_quantity", "adjusted_by",
    )
    list_filter   = (AdjustmentReasonFilter, "created_at", "adjusted_by")
    search_fields = ("product__name", "notes", "adjusted_by__username")
    ordering      = ("-created_at",)
    readonly_fields = ("slug", "created_at")
    date_hierarchy = "created_at"
    autocomplete_fields = ("product",)

    fieldsets = (
        (None, {"fields": ("product", "slug", "adjusted_by")}),
        ("Adjustment", {"fields": ("reason", "quantity_change", "previous_quantity", "new_quantity")}),
        ("Notes", {"fields": ("notes",)}),
        ("Timestamps", {"fields": ("created_at",), "classes": ("collapse",)}),
    )

    @admin.display(description="Reason")
    def reason_badge(self, obj):
        colours = {
            "purchase":   "#16a34a",
            "return":     "#0369a1",
            "damage":     "#dc2626",
            "theft":      "#7c3aed",
            "correction": "#d97706",
        }
        return status_badge(obj.reason, colours)

    @admin.display(description="Change")
    def quantity_change_col(self, obj):
        colour = "#16a34a" if obj.quantity_change > 0 else "#dc2626"
        sign   = "+" if obj.quantity_change > 0 else ""
        return format_html(
            '<span style="color:{};font-weight:700">{}{}</span>',
            colour, sign, obj.quantity_change,
        )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("product", "adjusted_by")


# ── MpesaTransaction ──────────────────────────────────────────────────────────

@admin.register(MpesaTransaction)
class MpesaTransactionAdmin(admin.ModelAdmin):
    list_display  = (
        "created_at", "phone_number", "amount",
        "mpesa_receipt_number", "status_col", "sale_link",
    )
    list_filter   = ("status", "created_at")
    search_fields = ("phone_number", "mpesa_receipt_number", "checkout_request_id", "sale__receipt_number")
    ordering      = ("-created_at",)
    readonly_fields = (
        "merchant_request_id", "checkout_request_id",
        "mpesa_receipt_number", "created_at", "updated_at",
    )
    date_hierarchy = "created_at"

    fieldsets = (
        ("Transaction", {"fields": ("sale", "phone_number", "amount", "status", "result_desc")}),
        ("M-Pesa IDs", {"fields": (
            "merchant_request_id", "checkout_request_id", "mpesa_receipt_number",
        )}),
        ("Timestamps", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    @admin.display(description="Status")
    def status_col(self, obj):
        colours = {"pending": "#d97706", "success": "#16a34a", "failed": "#dc2626"}
        return status_badge(obj.status, colours)

    @admin.display(description="Sale")
    def sale_link(self, obj):
        if obj.sale:
            url = reverse("admin:core_sale_change", args=[obj.sale.pk])
            return format_html('<a href="{}">{}</a>', url, obj.sale.receipt_number)
        return "—"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("sale")


# ── Admin site branding ───────────────────────────────────────────────────────

admin.site.site_header = "PharmaCo Admin"
admin.site.site_title  = "PharmaCo"
admin.site.index_title = "Pharmacy Management"