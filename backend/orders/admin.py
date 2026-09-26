from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ["product", "product_name", "unit_price", "quantity"]
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["number", "full_name", "status", "payment_method", "paid", "total", "created_at"]
    list_filter = ["status", "payment_method", "paid"]
    search_fields = ["full_name", "email"]
    inlines = [OrderItemInline]
    readonly_fields = ["subtotal", "shipping", "total", "stripe_session_id", "paid_at", "created_at"]
