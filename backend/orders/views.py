import logging
from datetime import timedelta

import stripe
from django.conf import settings
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from store.models import Product

from . import services
from .models import Order, OrderItem
from .serializers import (
    AdminOrderSerializer,
    CheckoutSerializer,
    OrderSerializer,
    StatusUpdateSerializer,
    customer_can_cancel,
)

log = logging.getLogger(__name__)


class OrderViewSet(mixins.CreateModelMixin, mixins.ListModelMixin,
                   mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """A customer's own orders. POST here is checkout."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer
    pagination_class = None

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related("items")

    def get_throttles(self):
        self.throttle_scope = "checkout" if self.action == "create" else None
        return super().get_throttles()

    def create(self, request):
        checkout = CheckoutSerializer(data=request.data)
        checkout.is_valid(raise_exception=True)
        try:
            order = services.create_order(
                user=request.user,
                items=checkout.validated_data["items"],
                shipping_details=checkout.shipping_details(),
                payment_method=checkout.validated_data["payment_method"],
            )
        except services.PaymentError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        order = self.get_object()
        # If the customer just came back from Stripe, confirm the payment right away
        # instead of waiting for the webhook.
        if order.status == Order.Status.PENDING_PAYMENT:
            order = services.sync_with_stripe(order)
            order.refresh_from_db()
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if not customer_can_cancel(order):
            return Response(
                {"detail": "This order can't be cancelled anymore. Contact us if you need help."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order = services.cancel_order(order)
        return Response(OrderSerializer(order).data)


class AdminOrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                        mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Staff view of every order. PATCH {"status": ...} moves an order along."""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminOrderSerializer
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        qs = Order.objects.select_related("user").prefetch_related("items")
        if status_filter := self.request.query_params.get("status"):
            qs = qs.filter(status=status_filter)
        if search := self.request.query_params.get("search", "").strip():
            number = search.upper().removeprefix("VC-").lstrip("0")
            q = Q(email__icontains=search) | Q(full_name__icontains=search)
            if number.isdigit():
                q |= Q(pk=int(number))
            qs = qs.filter(q)
        return qs

    def partial_update(self, request, pk=None):
        order = self.get_object()
        data = StatusUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = services.update_status(order, data.validated_data["status"])
        order.refresh_from_db()
        return Response(AdminOrderSerializer(order).data)


class AdminStatsView(APIView):
    """Numbers for the staff dashboard."""
    permission_classes = [permissions.IsAdminUser]
    LOW_STOCK = 5

    def get(self, request):
        live = Order.objects.exclude(status=Order.Status.CANCELLED)
        since = timezone.now() - timedelta(days=30)
        by_status = dict(Order.objects.values_list("status").annotate(n=Count("id")))

        top = (
            OrderItem.objects.filter(order__in=live, order__created_at__gte=since)
            .values("product_name")
            .annotate(sold=Sum("quantity"))
            .order_by("-sold")[:5]
        )
        low_stock = Product.objects.filter(is_active=True, stock__lte=self.LOW_STOCK).order_by("stock", "name")

        return Response({
            "revenue_30d": str(live.filter(paid=True, paid_at__gte=since).aggregate(s=Sum("total"))["s"] or 0),
            "orders_30d": live.filter(created_at__gte=since).count(),
            "to_ship": by_status.get(Order.Status.PROCESSING, 0),
            "by_status": [
                {"status": s.value, "label": s.label, "count": by_status.get(s.value, 0)}
                for s in Order.Status
            ],
            "top_products": list(top),
            "low_stock": [{"name": p.name, "slug": p.slug, "stock": p.stock} for p in low_stock],
        })


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """Stripe calls this when a checkout is paid or expires."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        return HttpResponse("Webhook secret not configured", status=503)
    try:
        event = stripe.Webhook.construct_event(
            request.body, request.headers.get("Stripe-Signature", ""), settings.STRIPE_WEBHOOK_SECRET
        )
    except (ValueError, stripe.SignatureVerificationError):
        return HttpResponse("Invalid signature", status=400)

    session = event["data"]["object"]
    order_id = (session.get("metadata") or {}).get("order_id")
    if not order_id:
        return HttpResponse(status=200)

    if event["type"] in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        if session.get("payment_status") == "paid":
            services.mark_paid(order_id)
    elif event["type"] == "checkout.session.expired":
        order = Order.objects.filter(pk=order_id, status=Order.Status.PENDING_PAYMENT).first()
        if order:
            services.cancel_order(order, expire_session=False)
    return HttpResponse(status=200)
