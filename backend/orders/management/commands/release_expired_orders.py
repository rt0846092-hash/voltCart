from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from orders import services
from orders.models import Order


class Command(BaseCommand):
    help = "Check unpaid card orders older than the hold time, and free their stock if they expired."

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(minutes=settings.CHECKOUT_HOLD_MINUTES + 5)
        stale = list(Order.objects.filter(status=Order.Status.PENDING_PAYMENT, created_at__lt=cutoff))
        for order in stale:
            order = services.sync_with_stripe(order)
            order.refresh_from_db()
            if order.status == Order.Status.PENDING_PAYMENT:
                services.cancel_order(order)
        self.stdout.write(f"Checked {len(stale)} unpaid order(s).")
