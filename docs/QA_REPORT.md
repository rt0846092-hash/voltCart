# QA report

Tested on 2 October 2026 against the code in this repository, running locally on PostgreSQL 16 with `DEBUG=False`, like production.

## Results

| Pass | Checks | Result |
| --- | --- | --- |
| Automated tests (`backend/tests`) | 34 | All pass on PostgreSQL and SQLite |
| API checks: shopper, accounts, checkout, orders, staff, security | 79 | All pass, with no server errors |
| Browser checks: shopper, staff, admin, mobile, keyboard, accessibility | 46 | All pass |

## Bugs found and fixed

| # | Severity | Problem | Fix |
| --- | --- | --- | --- |
| 1 | High | After a password change, old logins kept working for up to 7 days | Tokens carry a password fingerprint (`CHECK_REVOKE_TOKEN`), and refresh checks it too. Other devices are logged out; the website handles it cleanly |
| 2 | Medium | When stock ran out during checkout, the cart was never corrected (the API returned the product id as text, the cart compared it as a number) | Convert before comparing; the cart now lowers or removes the item |
| 3 | Medium | A hidden product in the cart blocked checkout with "One of the products is no longer available" without saying which | The message names the product, and the cart removes it |
| 4 | Medium | Grey text failed WCAG AA contrast on every page (about 4.1:1) | Darkened to about 6:1 |
| 5 | Medium | Editing a product's link name to one already in use crashed the server (500) | Links are set once at creation and can't be changed, so shared links never break |
| 6 | Low | The order page said "We've emailed you" even when no email server is set up | Only says so when email is configured |
| 7 | Low | `?page=999` showed "Invalid page." | Goes back to page 1 |
| 8 | Low | The featured box on the home page was an unnamed link while loading | Added an accessible name |

## What was checked

**Shopper:** category order, search with symbols and SQL/HTML injection attempts, combined filters and sorting, min price above max, page size limits, sold-out and stock-limited products, cart surviving reloads, free-shipping threshold, logged-out checkout redirect and return, unknown pages.

**Checkout:** zero, negative, decimal, text and huge quantities; unknown and hidden products; duplicate lines over the limit; blank or invalid shipping details; unknown payment methods; card payments while Stripe is off; prices sent from the browser (ignored); stock dropping or a product being hidden mid-checkout; double-clicking "Place order" (one order); **20 customers buying the last item at the same moment (exactly one succeeds)**; parallel orders with items in opposite order (no deadlocks).

**Accounts and security:** duplicate emails in different case, weak and common passwords, blank names, signing up or editing a profile with `is_staff` (ignored), identical errors for wrong password and unknown email, login brute force (rate-limited), tampered tokens, refresh tokens used as access tokens, password change logging out other devices, CORS for unknown websites, Stripe webhook without a secret or with GET, malformed JSON, no debug pages with `DEBUG=False`, HTML in names stored as plain text.

**Orders:** viewing or cancelling another customer's order (not found), cancelling twice (stock returned once), cancelling after shipping (refused), refreshing an order page.

**Staff and admin:** visitors get 401 and customers 403 on every staff endpoint and page; skipping steps (processing → delivered) refused; unknown statuses refused; totals and payment can't be edited; orders and products can't be deleted; order search by number in different formats; product validation (negative stock, zero/text/huge prices, unknown category, bad colours, `javascript:` image links, sale price above original); hidden products can't be bought; revenue only counts paid orders.

**Mobile, keyboard and accessibility:** no sideways scrolling on a 390px phone for the home, shop, product, cart, login and dashboard pages; adding to cart with keyboard only; axe-core WCAG 2 AA scan of home, shop, product, cart, login, checkout, order, account, dashboard and the product form.

## Not covered, and known limits

- **Stripe was not tested live**, because the test environment can't reach Stripe. The payment logic is covered by automated tests that simulate Stripe's responses.
- **No "forgot password"** yet. It needs an email service, which isn't set up.
- **Emails are only printed to the server log** until an email service is configured.
- **Rate limits are kept in each server process's memory**, so they reset on restart and are per process. A shared cache such as Redis would make them stricter.
- **The free Render server sleeps** after 15 minutes, so the first visit can take up to a minute.
