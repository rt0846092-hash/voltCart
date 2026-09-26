from decimal import Decimal
from types import SimpleNamespace
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from orders.models import Order
from store.models import Category, Product

User = get_user_model()

SHIPPING = {
    "full_name": "Test Buyer", "email": "buyer@example.com", "phone": "010-1234-5678",
    "address": "1 Test Street", "city": "Busan", "postal_code": "48000", "country": "South Korea",
}


class ShopTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        cat = Category.objects.create(name="Audio", slug="audio", kind="audio")
        self.cheap = Product.objects.create(
            category=cat, name="Buds", slug="buds", brand="Pulse", tagline="t", description="d",
            price=Decimal("40.00"), stock=5,
        )
        self.pricey = Product.objects.create(
            category=cat, name="Headphones", slug="headphones", brand="Pulse", tagline="t", description="d",
            price=Decimal("250.00"), stock=1,
        )
        self.user = User.objects.create_user(username="a@example.com", email="a@example.com", password="pass-1234-xyz")
        self.other = User.objects.create_user(username="b@example.com", email="b@example.com", password="pass-1234-xyz")
        self.staff = User.objects.create_user(username="s@example.com", email="s@example.com",
                                              password="pass-1234-xyz", is_staff=True)

    def checkout(self, items, method="cod", user=None, **extra):
        self.client.force_authenticate(user or self.user)
        return self.client.post("/api/orders/", {"items": items, "payment_method": method, **SHIPPING, **extra},
                                format="json")


class CatalogTests(ShopTestCase):
    def test_search_and_filters(self):
        res = self.client.get("/api/products/?search=head")
        self.assertEqual([p["slug"] for p in res.data["results"]], ["headphones"])
        res = self.client.get("/api/products/?max_price=100")
        self.assertEqual([p["slug"] for p in res.data["results"]], ["buds"])
        res = self.client.get("/api/products/?ordering=-price")
        self.assertEqual(res.data["results"][0]["slug"], "headphones")

    def test_categories_keep_their_position_order(self):
        Category.objects.create(name="Accessories", slug="accessories", position=9)
        Category.objects.filter(slug="audio").update(position=1)
        res = self.client.get("/api/categories/")
        self.assertEqual([c["slug"] for c in res.data], ["audio", "accessories"])
        self.assertEqual(res.data[0]["product_count"], 2)

    def test_on_sale_filter(self):
        self.pricey.compare_at_price = Decimal("300.00")
        self.pricey.save()
        res = self.client.get("/api/products/?on_sale=1")
        self.assertEqual([p["slug"] for p in res.data["results"]], ["headphones"])
        self.assertTrue(res.data["results"][0]["on_sale"])

    def test_hidden_products_are_not_listed(self):
        self.cheap.is_active = False
        self.cheap.save()
        res = self.client.get("/api/products/")
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(self.client.get("/api/products/buds/").status_code, 404)


class AuthTests(TestCase):
    def test_register_then_login_with_email(self):
        client = APIClient()
        res = client.post("/api/auth/register/", {"name": "Roshan", "email": "New@Example.com",
                                                  "password": "a-strong-pass-99"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertIn("access", res.data)
        res = client.post("/api/auth/login/", {"email": "new@example.com", "password": "a-strong-pass-99"},
                          format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["user"]["name"], "Roshan")

    def test_duplicate_email_rejected(self):
        client = APIClient()
        data = {"name": "A", "email": "dup@example.com", "password": "a-strong-pass-99"}
        client.post("/api/auth/register/", data, format="json")
        self.assertEqual(client.post("/api/auth/register/", data, format="json").status_code, 400)


class CheckoutTests(ShopTestCase):
    def test_cash_order_reserves_stock_and_uses_database_prices(self):
        # The browser can't send its own price; only product ids and quantities count
        res = self.checkout([{"product_id": self.cheap.id, "quantity": 2, "price": "0.01"}])
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["subtotal"], "80.00")
        self.assertEqual(res.data["shipping"], "9.99")
        self.assertEqual(res.data["total"], "89.99")
        self.assertEqual(res.data["status"], "processing")
        self.cheap.refresh_from_db()
        self.assertEqual(self.cheap.stock, 3)

    def test_free_shipping_over_threshold(self):
        res = self.checkout([{"product_id": self.pricey.id, "quantity": 1}])
        self.assertEqual(res.data["shipping"], "0.00")

    def test_cannot_buy_more_than_stock_and_nothing_is_taken(self):
        res = self.checkout([
            {"product_id": self.cheap.id, "quantity": 1},
            {"product_id": self.pricey.id, "quantity": 2},
        ])
        self.assertEqual(res.status_code, 400)
        self.assertIn("Only 1 left", str(res.data))
        # The whole order failed, so the first item's stock wasn't taken either
        self.cheap.refresh_from_db()
        self.assertEqual(self.cheap.stock, 5)
        self.assertFalse(Order.objects.exists())

    def test_last_item_can_only_be_sold_once(self):
        self.assertEqual(self.checkout([{"product_id": self.pricey.id, "quantity": 1}]).status_code, 201)
        res = self.checkout([{"product_id": self.pricey.id, "quantity": 1}], user=self.other)
        self.assertEqual(res.status_code, 400)
        self.assertIn("sold out", str(res.data))

    def test_card_payment_unavailable_without_stripe(self):
        res = self.checkout([{"product_id": self.cheap.id, "quantity": 1}], method="card")
        self.assertEqual(res.status_code, 400)

    def test_login_required(self):
        res = self.client.post("/api/orders/", {"items": []}, format="json")
        self.assertEqual(res.status_code, 401)


class OrderAccessTests(ShopTestCase):
    def test_customers_only_see_their_own_orders(self):
        order_id = self.checkout([{"product_id": self.cheap.id, "quantity": 1}]).data["id"]
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/orders/{order_id}/").status_code, 404)
        self.assertEqual(self.client.get("/api/orders/").data, [])

    def test_cancelling_a_cash_order_returns_stock(self):
        order_id = self.checkout([{"product_id": self.cheap.id, "quantity": 3}]).data["id"]
        res = self.client.post(f"/api/orders/{order_id}/cancel/")
        self.assertEqual(res.data["status"], "cancelled")
        self.cheap.refresh_from_db()
        self.assertEqual(self.cheap.stock, 5)
        # Cancelling twice doesn't add stock twice
        self.client.post(f"/api/orders/{order_id}/cancel/")
        self.cheap.refresh_from_db()
        self.assertEqual(self.cheap.stock, 5)


class StaffTests(ShopTestCase):
    def test_non_staff_blocked(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/admin/orders/").status_code, 403)
        self.assertEqual(self.client.get("/api/admin/stats/").status_code, 403)

    def test_status_flow_and_cash_marked_paid_on_delivery(self):
        order_id = self.checkout([{"product_id": self.cheap.id, "quantity": 1}]).data["id"]
        self.client.force_authenticate(self.staff)
        url = f"/api/admin/orders/{order_id}/"
        self.assertEqual(self.client.patch(url, {"status": "delivered"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(url, {"status": "shipped"}, format="json").data["status"], "shipped")
        res = self.client.patch(url, {"status": "delivered"}, format="json")
        self.assertEqual(res.data["status"], "delivered")
        self.assertTrue(res.data["paid"])
        # Customer can't cancel after it shipped
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post(f"/api/orders/{order_id}/cancel/").status_code, 400)

    def test_stats(self):
        self.checkout([{"product_id": self.pricey.id, "quantity": 1}])
        self.client.force_authenticate(self.staff)
        res = self.client.get("/api/admin/stats/")
        self.assertEqual(res.data["to_ship"], 1)
        self.assertEqual(res.data["low_stock"][0]["slug"], "headphones")


@override_settings(STRIPE_SECRET_KEY="sk_test_x", STRIPE_WEBHOOK_SECRET="whsec_x")
class StripeTests(ShopTestCase):
    def start_card_order(self):
        fake = SimpleNamespace(id="cs_test_1", url="https://checkout.stripe.com/c/pay/cs_test_1")
        with mock.patch("stripe.checkout.Session.create", return_value=fake) as create:
            res = self.checkout([{"product_id": self.cheap.id, "quantity": 2}], method="card")
        return res, create

    def test_card_order_opens_stripe_checkout(self):
        res, create = self.start_card_order()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["status"], "pending_payment")
        self.assertEqual(res.data["checkout_url"], "https://checkout.stripe.com/c/pay/cs_test_1")
        line = create.call_args.kwargs["line_items"][0]
        self.assertEqual(line["price_data"]["unit_amount"], 4000)  # cents, from the database price
        self.cheap.refresh_from_db()
        self.assertEqual(self.cheap.stock, 3)  # held while the customer pays

    def webhook(self, event_type, order_id, payment_status="paid"):
        event = {"type": event_type, "data": {"object": {
            "metadata": {"order_id": str(order_id)}, "payment_status": payment_status}}}
        with mock.patch("stripe.Webhook.construct_event", return_value=event):
            return self.client.post("/api/webhooks/stripe/", data=b"{}", content_type="application/json",
                                    HTTP_STRIPE_SIGNATURE="sig")

    def test_webhook_marks_order_paid_once(self):
        res, _ = self.start_card_order()
        self.assertEqual(self.webhook("checkout.session.completed", res.data["id"]).status_code, 200)
        self.webhook("checkout.session.completed", res.data["id"])  # Stripe may send it twice
        order = Order.objects.get(pk=res.data["id"])
        self.assertTrue(order.paid)
        self.assertEqual(order.status, "processing")

    def test_expired_checkout_returns_stock(self):
        res, _ = self.start_card_order()
        self.webhook("checkout.session.expired", res.data["id"], payment_status="unpaid")
        self.assertEqual(Order.objects.get(pk=res.data["id"]).status, "cancelled")
        self.cheap.refresh_from_db()
        self.assertEqual(self.cheap.stock, 5)

    def test_bad_signature_rejected(self):
        import stripe
        with mock.patch("stripe.Webhook.construct_event",
                        side_effect=stripe.SignatureVerificationError("bad", "sig")):
            res = self.client.post("/api/webhooks/stripe/", data=b"{}", content_type="application/json")
        self.assertEqual(res.status_code, 400)

    def test_returning_from_stripe_confirms_payment_without_webhook(self):
        res, _ = self.start_card_order()
        paid = SimpleNamespace(payment_status="paid", status="complete")
        with mock.patch("stripe.checkout.Session.retrieve", return_value=paid):
            detail = self.client.get(f"/api/orders/{res.data['id']}/")
        self.assertTrue(detail.data["paid"])
        self.assertEqual(detail.data["status"], "processing")

    def test_customer_cancel_does_not_cancel_a_paid_order(self):
        res, _ = self.start_card_order()
        import stripe
        paid = SimpleNamespace(payment_status="paid", status="complete")
        with mock.patch("stripe.checkout.Session.expire", side_effect=stripe.InvalidRequestError("done", None)), \
             mock.patch("stripe.checkout.Session.retrieve", return_value=paid):
            out = self.client.post(f"/api/orders/{res.data['id']}/cancel/")
        self.assertEqual(out.data["status"], "processing")
        self.assertTrue(out.data["paid"])

    def test_stripe_failure_releases_stock(self):
        import stripe
        with mock.patch("stripe.checkout.Session.create", side_effect=stripe.APIConnectionError("down")):
            res = self.checkout([{"product_id": self.cheap.id, "quantity": 2}], method="card")
        self.assertEqual(res.status_code, 502)
        self.cheap.refresh_from_db()
        self.assertEqual(self.cheap.stock, 5)
