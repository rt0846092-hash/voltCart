from django.conf import settings
from rest_framework import serializers

from .models import Order, OrderItem


class CheckoutItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=settings.MAX_QUANTITY_PER_ITEM)


class CheckoutSerializer(serializers.Serializer):
    items = CheckoutItemSerializer(many=True, allow_empty=False, max_length=30)
    payment_method = serializers.ChoiceField(choices=Order.PaymentMethod.choices)
    full_name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30)
    address = serializers.CharField(max_length=255)
    city = serializers.CharField(max_length=80)
    postal_code = serializers.CharField(max_length=20)
    country = serializers.CharField(max_length=60)

    SHIPPING_FIELDS = ["full_name", "email", "phone", "address", "city", "postal_code", "country"]

    def shipping_details(self):
        return {f: self.validated_data[f].strip() for f in self.SHIPPING_FIELDS}


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product_name", "product_slug", "unit_price", "quantity", "line_total"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)
    checkout_url = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "number", "status", "status_display", "payment_method", "payment_method_display",
            "paid", "paid_at", "subtotal", "shipping", "total", "items",
            "full_name", "email", "phone", "address", "city", "postal_code", "country",
            "checkout_url", "can_cancel", "created_at",
        ]

    def get_checkout_url(self, order):
        # Only useful while the card payment is still open
        return order.stripe_checkout_url if order.status == Order.Status.PENDING_PAYMENT else None

    def get_can_cancel(self, order):
        return customer_can_cancel(order)


class AdminOrderSerializer(OrderSerializer):
    customer = serializers.CharField(source="user.email", read_only=True)
    next_statuses = serializers.SerializerMethodField()

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ["customer", "next_statuses", "updated_at"]

    def get_next_statuses(self, order):
        return [
            {"value": s, "label": Order.Status(s).label}
            for s in sorted(Order.STAFF_TRANSITIONS.get(order.status, set()))
        ]


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)


def customer_can_cancel(order):
    """Customers can cancel unpaid card orders and cash orders that haven't shipped."""
    if order.status == Order.Status.PENDING_PAYMENT:
        return True
    return order.status == Order.Status.PROCESSING and order.payment_method == Order.PaymentMethod.COD
