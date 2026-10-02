# ⚡ Voltcart

A full-stack electronics store: a React storefront, a Django REST API, PostgreSQL, and Stripe payments, with a staff dashboard for managing orders.

**Live demo:** _add your link here_ · Test card: `4242 4242 4242 4242`, any future date, any CVC

> This is a portfolio project. Nothing is really for sale.

## Features

**Shopping**
- Browse 18 products across 6 categories, with search, category and price filters, "on sale" and "in stock" filters, sorting and pagination
- Product pages with specs, live stock levels and related products
- Cart saved in the browser, with free-shipping progress

**Checkout and payments**
- Two payment methods: **card through Stripe Checkout** (test mode) or **cash on delivery**
- Stock is reserved the moment an order is placed, and **can never be oversold**, even if two people buy the last item at the same time
- Prices are always taken from the database, so the browser can't change what a customer pays
- Unpaid card orders hold stock for 30 minutes, then release it automatically
- Stripe webhooks confirm payments, with a backup check when the customer returns from Stripe

**Accounts and orders**
- Sign up and log in with email (JWT authentication)
- Account page to update your name and change your password
- Order history, order tracking timeline, and cancelling orders that haven't shipped
- Confirmation and shipping emails

**Staff dashboard**
- Revenue, order counts, best sellers and low-stock alerts
- Filter and search orders, and move them through *processing → shipped → delivered*, or cancel them (stock is restored)
- Add and edit products, and update prices, stock and visibility right from the dashboard

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18, React Router, Tailwind CSS, Vite |
| Backend | Django 5, Django REST Framework, Simple JWT |
| Database | PostgreSQL on Neon (SQLite for local development) |
| Payments | Stripe Checkout + webhooks |
| Hosting | Vercel (website), Render (API), Neon (database) |
| Testing | 34 Django tests, plus a QA pass of 79 API and 46 browser checks (see [docs/QA_REPORT.md](docs/QA_REPORT.md)) |

## How it works

See **[docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)** for a walkthrough of the architecture and the key decisions, such as how overselling is prevented and why payments are confirmed twice.

## API

| Method | Endpoint | Who | What |
| --- | --- | --- | --- |
| GET | `/api/products/` | Anyone | List products. Filters: `search`, `category`, `min_price`, `max_price`, `in_stock`, `on_sale`, `ordering` |
| GET | `/api/products/<slug>/` | Anyone | Product detail |
| GET | `/api/categories/` | Anyone | Categories with product counts |
| POST | `/api/auth/register/` · `/api/auth/login/` | Anyone | Returns JWT tokens |
| GET, PATCH | `/api/auth/me/` | Customer | Your profile |
| POST | `/api/auth/change-password/` | Customer | Change password |
| POST | `/api/orders/` | Customer | Checkout |
| GET | `/api/orders/` · `/api/orders/<id>/` | Customer | Your orders |
| POST | `/api/orders/<id>/cancel/` | Customer | Cancel an unshipped order |
| GET, PATCH | `/api/admin/orders/` | Staff | All orders; change status |
| GET, POST, PATCH | `/api/admin/products/` | Staff | Manage products and stock |
| GET | `/api/admin/stats/` | Staff | Dashboard numbers |
| POST | `/api/webhooks/stripe/` | Stripe | Payment events (signature-checked) |

## Run it locally

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # then set ADMIN_PASSWORD (and Stripe test keys, if you have them)
python manage.py migrate
python manage.py seed_store   # sample products
python manage.py ensure_admin # staff login from .env
python manage.py runserver
```

**Frontend** (in a second terminal)
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

**Tests**
```bash
cd backend && python manage.py test tests
```

### Stripe (optional)

1. Create a free account at [stripe.com](https://stripe.com) and stay in **test mode**.
2. Copy your **secret key** (`sk_test_...`) into `STRIPE_SECRET_KEY`.
3. For webhooks, add an endpoint in the Stripe dashboard pointing to `https://<your-api>/api/webhooks/stripe/` with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.expired`, then copy its signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

Without Stripe keys the store still works, with cash on delivery only.

## Deploy

- **Database:** create a free PostgreSQL project on [Neon](https://neon.tech) and copy the direct (non-pooled) connection string.
- **API:** on [Render](https://render.com), **New → Blueprint → pick this repo**. It reads `render.yaml`. Set `DATABASE_URL` to the Neon string, plus the website address (`CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`), your admin login, and optionally Stripe keys.
- **Website:** on [Vercel](https://vercel.com), import this repo with **Root Directory** set to `frontend`, and set `VITE_API_URL` to `https://<your-api>.onrender.com/api`.

## Author

Roshan Tamang · [GitHub](https://github.com/rt0846092-hash) · [LinkedIn](https://www.linkedin.com/in/roshan-tamang-663015283)
