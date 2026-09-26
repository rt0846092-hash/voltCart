# How Voltcart works

This guide explains the architecture and the main decisions behind the code.

## The big picture

```
Browser (React)  ──HTTP/JSON──▶  Django REST API  ──▶  PostgreSQL
                                     │     ▲
                     create session  ▼     │  webhook: "paid" / "expired"
                                    Stripe Checkout
```

- **The frontend** (`frontend/src`) is a React single-page app. It shows products, keeps the cart in `localStorage`, and talks to the API with `fetch` (see `lib/api.js`).
- **The backend** (`backend/`) is Django with Django REST Framework. It has three apps:
  - `store`: categories and products
  - `orders`: orders, checkout logic, Stripe, and the staff dashboard
  - `accounts`: sign up, log in, and JWT tokens
- **The business rules** live in `backend/orders/services.py`, not in the views. The views only check the request and call a service function, which keeps the rules in one place and makes them easy to test.

## 1. Logging in (JWT)

When you log in, the API returns two tokens:
- an **access token** (valid 30 minutes), sent with every request as `Authorization: Bearer <token>`
- a **refresh token** (valid 7 days), used to get a new access token

`lib/api.js` does this automatically: when a request gets `401 Unauthorized`, it refreshes the access token once and retries. Users log in with their email; behind the scenes the email is also stored as Django's username.

## 2. The cart

The cart lives in the browser (`lib/cart.jsx`), so visitors can shop without an account. It stores a copy of each product's name and price only for display. **At checkout the browser sends just product IDs and quantities.** The server looks up the real prices itself, so editing the page can't change what someone pays.

## 3. Checkout and stock (the most important part)

`create_order()` in `orders/services.py` runs inside a **database transaction**. For each product it runs:

```python
Product.objects.filter(pk=product_id, stock__gte=qty).update(stock=F("stock") - qty)
```

This is one SQL statement: *"take `qty` from stock, but only if there's at least `qty` left."* The database runs it atomically, so if two customers try to buy the last item at the same moment, exactly one update succeeds. The other gets "sold out."

If any product in the order fails, the whole transaction rolls back, so no stock is taken for any of the items. Products are processed in ID order, so two orders can't lock rows in opposite orders and deadlock.

## 4. Two ways to pay

**Cash on delivery:** the order goes straight to *Processing*, and it's marked paid when staff mark it *Delivered*.

**Card (Stripe):**
1. The order is created as *Awaiting payment*, and its stock is reserved.
2. The API creates a **Stripe Checkout Session** and the browser is sent to Stripe's payment page. Card details never touch our server.
3. The session expires after 30 minutes, which is how long the stock is held.
4. Payment is confirmed in **two independent ways**:
   - **Webhook:** Stripe calls `/api/webhooks/stripe/`. The signature is checked with `STRIPE_WEBHOOK_SECRET`, so nobody can fake a "paid" message.
   - **Return check:** when the customer comes back to their order page, the API asks Stripe directly about the session (`sync_with_stripe`). This covers webhooks that are slow or missed.
5. If the session expires or the customer cancels, the stock goes back.

Both paths call `mark_paid()`, which is **idempotent**: it locks the order row, and if the order is already paid it does nothing. Stripe can send the same webhook twice without anything breaking.

**One tricky race:** a customer clicks "Cancel" at the exact moment their payment succeeds. `cancel_order()` first expires the Stripe session. If Stripe says the session is already complete, the order is synced as paid and left alone, instead of cancelling an order the customer paid for.

## 5. Order statuses

```
Awaiting payment ──paid──▶ Processing ──▶ Shipped ──▶ Delivered
        │                      │
        └──── expired ───▶ Cancelled ◀── cancelled
```

Staff can only make the moves listed in `Order.STAFF_TRANSITIONS`, so an order can't jump from *Processing* straight to *Delivered*. Customers can cancel unpaid orders and cash orders that haven't shipped. Every cancel returns the stock, and cancelling twice doesn't return it twice.

## 6. Permissions

- Anyone can browse products.
- Customers can only see and cancel **their own** orders: the queryset is filtered by `user=request.user`, so another customer's order simply returns 404.
- Staff endpoints use DRF's `IsAdminUser`.
- Login, sign-up and checkout are rate-limited to slow down abuse.

## 7. Tests

`backend/tests/test_shop.py` has 24 tests. The Stripe tests use `unittest.mock` to fake Stripe's responses, so they run offline. They cover:
- prices coming from the database, not the request
- an order failing as a whole when one item is out of stock
- the last item only being sold once
- webhooks marking orders paid exactly once
- expired sessions returning stock
- customers not seeing each other's orders
- staff status rules

## Things I'd add next

- Product images uploaded to cloud storage (products currently use drawn illustrations)
- Product reviews and ratings
- Refunds through the Stripe API instead of the Stripe dashboard
- A scheduled job running `release_expired_orders` as an extra safety net
