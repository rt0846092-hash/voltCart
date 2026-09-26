"""
Order logic lives here instead of in the views, so it can be tested on its own
and reused by the webhook, the API and management commands.

Stock rule: stock is reserved the moment an order is placed. A card order that
is never paid gives its stock back when it is cancelled or its Stripe session
expires, so two customers can never buy the same last item.
"""
import logging
import time
from decimal import ROUND_HALF_UP, Decimal

import stripe
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from store.models import Product

from .models import Order, OrderItem

log = logging.getLogger(__name__)


class PaymentError(Exception):
    """Stripe could not create a checkout session."""


def stripe_enabled():
    return bool(settings.STRIPE_SECRET_KEY)


def _stripe():
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def to_cents(amount: Decimal) -> int:
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def shipping_for(subtotal: Decimal) -> Decimal:
    return Decimal("0.00") if subtotal >= settings.FREE_SHIPPING_OVER else settings.SHIPPING_FEE


# --- Placing an order ---------------------------------------------------

def create_order(*, user, items, shipping_details, payment_method):
    """
    Reserve stock and create the order in one transaction.

    `items` is a list of {"product_id": int, "quantity": int}. Prices always come
    from the database, never from the browser.
    """
    if payment_method == Order.PaymentMethod.CARD and not stripe_enabled():
        raise ValidationError({"payment_method": "Card payments aren't available right now. Choose cash on delivery."})

    # Merge duplicate lines and sort by id so concurrent orders lock rows in the same order
    wanted = {}
    for item in items:
        wanted[item["product_id"]] = wanted.get(item["product_id"], 0) + item["quantity"]
    for product_id, qty in wanted.items():
        if qty > settings.MAX_QUANTITY_PER_ITEM:
            raise ValidationError({"items": f"You can buy at most {settings.MAX_QUANTITY_PER_ITEM} of one product."})

    with transaction.atomic():
        lines = []
        for product_id in sorted(wanted):
            qty = wanted[product_id]
            # Atomic "take stock only if there's enough". If two people race for the
            # last item, the database lets exactly one of these updates through.
            taken = Product.objects.filter(pk=product_id, is_active=True, stock__gte=qty).update(
                stock=F("stock") - qty
            )
            product = Product.objects.filter(pk=product_id).first()
            if not taken:
                if product is None or not product.is_active:
                    raise ValidationError({"items": "One of the products in your cart is no longer available."})
                left = product.stock
                msg = f"{product.name} is sold out." if left == 0 else f"Only {left} left of {product.name}."
                raise ValidationError({"items": msg, "product_id": product_id, "available": left})
            lines.append((product, qty))

        subtotal = sum((p.price * q for p, q in lines), Decimal("0.00"))
        shipping = shipping_for(subtotal)
        is_card = payment_method == Order.PaymentMethod.CARD

        order = Order.objects.create(
            user=user,
            payment_method=payment_method,
            status=Order.Status.PENDING_PAYMENT if is_card else Order.Status.PROCESSING,
            subtotal=subtotal,
            shipping=shipping,
            total=subtotal + shipping,
            **shipping_details,
        )
        OrderItem.objects.bulk_create([
            OrderItem(order=order, product=p, product_name=p.name, product_slug=p.slug,
                      unit_price=p.price, quantity=q)
            for p, q in lines
        ])

    if is_card:
        try:
            _start_stripe_checkout(order)
        except PaymentError:
            cancel_order(order, expire_session=False)
            raise
    else:
        send_order_email(order, "confirmed")
    return order


def _start_stripe_checkout(order):
    line_items = [
        {
            "quantity": item.quantity,
            "price_data": {
                "currency": settings.CURRENCY,
                "unit_amount": to_cents(item.unit_price),
                "product_data": {"name": item.product_name},
            },
        }
        for item in order.items.all()
    ]
    if order.shipping > 0:
        line_items.append({
            "quantity": 1,
            "price_data": {
                "currency": settings.CURRENCY,
                "unit_amount": to_cents(order.shipping),
                "product_data": {"name": "Shipping"},
            },
        })

    try:
        session = _stripe().checkout.Session.create(
            mode="payment",
            line_items=line_items,
            customer_email=order.email,
            client_reference_id=str(order.pk),
            metadata={"order_id": str(order.pk)},
            # Stock is held until then; Stripe needs at least 30 minutes
            expires_at=int(time.time()) + settings.CHECKOUT_HOLD_MINUTES * 60 + 60,
            success_url=f"{settings.FRONTEND_URL}/orders/{order.pk}?payment=success",
            cancel_url=f"{settings.FRONTEND_URL}/orders/{order.pk}?payment=cancelled",
        )
    except stripe.StripeError as exc:
        log.exception("Stripe checkout failed for order %s", order.pk)
        raise PaymentError("We couldn't start the card payment. Please try again or choose cash on delivery.") from exc

    order.stripe_session_id = session.id
    order.stripe_checkout_url = session.url
    order.save(update_fields=["stripe_session_id", "stripe_checkout_url", "updated_at"])


# --- Changing an order --------------------------------------------------

def _restore_stock(order):
    for item in order.items.all():
        if item.product_id:
            Product.objects.filter(pk=item.product_id).update(stock=F("stock") + item.quantity)


def cancel_order(order, *, expire_session=True, allow_paid=False):
    """
    Cancel an unshipped order and put its items back in stock. Safe to call twice.

    Paid card orders are only cancelled when `allow_paid` is set (staff), because
    they need a refund. A customer's cancel that races with their own payment
    leaves the paid order alone.
    """
    if expire_session and order.stripe_session_id and stripe_enabled() and not order.paid:
        # Close the Stripe page first so the customer can't pay for a cancelled order
        try:
            _stripe().checkout.Session.expire(order.stripe_session_id)
        except stripe.StripeError:
            # Already expired, or already paid: find out which
            sync_with_stripe(order)
            order.refresh_from_db()

    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if locked.status not in (Order.Status.PENDING_PAYMENT, Order.Status.PROCESSING):
            return locked
        if locked.paid and locked.payment_method == Order.PaymentMethod.CARD:
            if not allow_paid:
                return locked
            # Paid card orders need a refund in the Stripe dashboard; flag it in the log
            log.warning("Order %s was cancelled after card payment; refund it in Stripe.", locked.pk)
        _restore_stock(locked)
        locked.status = Order.Status.CANCELLED
        locked.save(update_fields=["status", "updated_at"])
    return locked


def mark_paid(order_id):
    """Record a successful card payment. Safe to call more than once."""
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(pk=order_id).first()
        if order is None or order.paid:
            return order
        order.paid = True
        order.paid_at = timezone.now()
        if order.status == Order.Status.PENDING_PAYMENT:
            order.status = Order.Status.PROCESSING
        elif order.status == Order.Status.CANCELLED:
            log.warning("Payment arrived for cancelled order %s; refund it in Stripe.", order.pk)
        order.save(update_fields=["paid", "paid_at", "status", "updated_at"])
    if order.status == Order.Status.PROCESSING:
        send_order_email(order, "confirmed")
    return order


def sync_with_stripe(order):
    """Ask Stripe about a pending card order. Backup for when a webhook is missed."""
    if not (order.status == Order.Status.PENDING_PAYMENT and order.stripe_session_id and stripe_enabled()):
        return order
    try:
        session = _stripe().checkout.Session.retrieve(order.stripe_session_id)
    except stripe.StripeError:
        log.exception("Couldn't check Stripe session for order %s", order.pk)
        return order
    if session.payment_status == "paid":
        return mark_paid(order.pk)
    if session.status == "expired":
        return cancel_order(order, expire_session=False)
    return order


def update_status(order, new_status):
    """Staff moves an order along: processing → shipped → delivered, or cancels it."""
    allowed = Order.STAFF_TRANSITIONS.get(order.status, set())
    if new_status not in allowed:
        raise ValidationError({"status": f"Can't change an order from {order.get_status_display()} to that status."})

    if new_status == Order.Status.CANCELLED:
        return cancel_order(order, allow_paid=True)

    order.status = new_status
    fields = ["status", "updated_at"]
    if new_status == Order.Status.DELIVERED and order.payment_method == Order.PaymentMethod.COD:
        order.paid, order.paid_at = True, timezone.now()  # cash collected at the door
        fields += ["paid", "paid_at"]
    order.save(update_fields=fields)
    if new_status == Order.Status.SHIPPED:
        send_order_email(order, "shipped")
    return order


# --- Emails -------------------------------------------------------------

def send_order_email(order, kind):
    items = "\n".join(f"  {i.quantity} × {i.product_name}  ${i.line_total:.2f}" for i in order.items.all())
    link = f"{settings.FRONTEND_URL}/orders/{order.pk}"
    if kind == "confirmed":
        payment = "Paid by card" if order.paid else "Pay with cash on delivery"
        subject = f"Order {order.number} confirmed"
        body = (
            f"Hi {order.full_name},\n\nThanks for shopping at {settings.STORE_NAME}! "
            f"We've received your order.\n\n{items}\n\n"
            f"Shipping: ${order.shipping:.2f}\nTotal: ${order.total:.2f} ({payment})\n\n"
            f"Track your order: {link}\n"
        )
    else:
        subject = f"Order {order.number} is on its way"
        body = f"Hi {order.full_name},\n\nGood news: your order has shipped.\n\n{items}\n\nTrack it here: {link}\n"
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [order.email], fail_silently=True)
