# Intersoft

A full-featured e-commerce web application for online electronics sales (PC-focused). Custom **Node.js backend** (Express + PostgreSQL, REST APIs only) with a built-in **admin panel**, and a **Next.js storefront** in pure JavaScript adapted from the Blazity *enterprise-commerce* template. Built to be owned by a single developer — no framework magic, every endpoint is a readable Express route.

```
Intersoft/
├── server/                Node.js backend — API + admin panel on :9000
│   ├── src/index.js       Express app (helmet, CORS, rate limits, error handler)
│   ├── src/migrations/    Plain SQL schema + migrations
│   ├── src/routes/        Routing tables only — URL → controller + middleware
│   │   ├── store/         Public store API (/api/store/...), one file per resource:
│   │   │                  catalog, campaigns, cart, auth, customers, orders
│   │   └── admin/         Admin API (/api/admin/...), JWT-protected: auth, dashboard,
│   │                      products, categories, orders, customers, groups,
│   │                      price-lists, campaigns, shipping, suppliers, uploads,
│   │                      import, ai — index.js holds the auth boundary
│   ├── src/controllers/   Request handlers, mirroring the route files 1:1
│   │   ├── store/
│   │   └── admin/
│   ├── src/validation/    Joi schemas, one per resource, mirroring the above —
│   │                      every endpoint declares the input it accepts
│   ├── src/services/      catalog, cart, campaigns, products, payments, import (Excel),
│   │                      ai (OpenAI), mail (nodemailer), uploads (images)
│   ├── src/lib/           db, auth (bcrypt+JWT), pricing, serializers, utils,
│   │                      validate (Joi middleware), error-log, rate-limits
│   ├── src/seed.js        Demo catalog (38 PC products, categories, coupon, shipping)
│   ├── admin/             Admin panel SPA (vanilla JS, no build step) at /admin
│   └── static/            Product & category images, served at /static
├── storefront/            Next.js 16 (App Router, JavaScript only) on :3000
│   ├── app/               home, search, category, product, cart, checkout, order,
│   │                      login/register, forgot/reset password, track (guest),
│   │                      account (profile, saved address, orders), campaign/[handle], about, contact
│   ├── components/        UI ported from the enterprise-commerce template
│   └── lib/               fetch client, data layer, server actions, i18n (en/sq)
├── sample-import.xlsx     Example file for the Excel product import
└── backend/               (old MedusaJS backend — replaced by server/, safe to delete)
```

## Prerequisites

- Node.js ≥ 20
- PostgreSQL ≥ 14 running locally
- (optional) An OpenAI API key for the AI product-enhancement feature

## Setup

### 1. Backend + admin (`server/`)

```bash
cd server
npm install
createdb intersoft_store          # or set DATABASE_URL in .env
npm run migrate                   # applies src/migrations/*.sql
npm run seed                      # demo catalog + admin user
npm run dev                       # http://localhost:9000  (node --watch)
```

`server/.env`:

```env
PORT=9000
DATABASE_URL=postgres://localhost/intersoft_store
JWT_SECRET=change_me_in_production        # 16+ chars, required
STORE_ORIGIN=http://localhost:3000        # CORS allowlist + links in emails
BACKEND_URL=http://127.0.0.1:9000         # used for image URLs
MAIL_FROM=Intersoft <no-reply@intersoft-rks.com>
# SMTP_HOST=smtp.example.com              # without it, emails are written to tmp/mail
# SMTP_PORT=587
# SMTP_USER= / SMTP_PASS= / SMTP_SECURE=false
# OPENAI_API_KEY=sk-...                   # enables AI enhancement
# OPENAI_MODEL=gpt-4o-mini
# RAIFFEISEN_MERCHANT_ID=...              # card gateway (see Payments below)
# RAIFFEISEN_SECRET_KEY=...
```

**Admin panel:** http://localhost:9000/admin — `admin@intersoft-rks.com` / `supersecret` (seeded; change the password after first login via the API or replace the seed).

### 2. Storefront (`storefront/`)

```bash
cd storefront
npm install
npm run dev                       # http://localhost:3000
```

`storefront/.env.local`:

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://127.0.0.1:9000
```

> Use `127.0.0.1` rather than `localhost` for the backend URL in local dev — it avoids slow IPv6 lookups from the Next server. `next.config.mjs` sets `dangerouslyAllowLocalIP` for the image optimizer; remove it once the backend has a public hostname.

## The admin panel

Served by the backend itself (like Medusa's, minus the bloat): a dependency-free single-page app in `server/admin/` — edit the HTML/CSS/JS directly, refresh, done.

**Built for someone who is not a developer.** The wording is plain ("Visible in the shop", not "status: published"; "Not paid yet", not "payment_status: awaiting"), every screen explains what a setting does, and there is no JSON, no jargon and no raw browser pop-ups anywhere:

- **Proper dialogs** instead of `alert`/`confirm`/`prompt` — deletions spell out the consequence ("Products inside it stay in the shop — they simply lose this category"), refunds are a real form (amount, reason, restock, notify) with validation in sentences, and Escape or clicking outside always cancels safely.
- **Product options without JSON** — describe an option in words ("Memory" → "16GB, 32GB") and press *Update the list below*; the combinations are generated and each row asks only for price, sale price, stock and SKU.
- **Loading skeletons**, friendly empty states that say what to do next, and a sales chart on the dashboard.
- Renaming a product **never changes its web address** — existing links keep working.

- **Dashboard** — sales chart (14 days), 30-day takings, orders waiting for payment, customer count, low-stock list and the latest orders
- **Orders** — search & status filters; per-order: items, totals, customer & address, internal notes and a full **timeline**; actions: advance status (pending → processing → shipped → delivered), cancel (restocks automatically), **mark paid** (captures COD/POS money), **refund** (full/partial, optional restock — this is the returns flow)
- **Products** — search, create/edit: details, category, supplier, **shipping option**, tags, **image manager**, **variants with price / sale price / stock**, Albanian translation fields, featured flag, **AI enhancement** panel (generate title/description/tags in English or Albanian, review, apply to the form, save)
- **Categories** — two-level tree, product counts, image picker, Albanian name/description
- **Customers** — list with order counts and totals, per-customer order history, and **group membership** (which decides their pricing)
- **Customer Groups** — e.g. Wholesale; a group gets its own price lists and can gate campaigns
- **Price Lists** — targeted at everyone / a group / one customer, with quantity tiers, priority, date window, and bulk fill by category
- **Campaigns** — codes or automatic rules: percentage / fixed / free shipping, scoped to the order, categories or products, with group, subtotal, quantity, date and per-customer usage conditions, plus a **storefront banner** and its own catalogue page
- **Shipping** — delivery options (English + Albanian names) that get assigned to products
- **Suppliers** — who fulfills each product, with a **default shipping option** that can be pushed to all their products in one click
- **Import** — Excel upload with per-row validation report + template download
- **Settings** — change your own password and see at a glance which features are switched on

### Images

Anywhere an image is needed (product galleries, category cards) the admin shows a picker: **drag & drop or click to choose**, with thumbnails, reordering (← →), "set as main" (★), and delete. Pasting a URL still works for images hosted elsewhere. Uploads are stored in `server/static/uploads/` and served from `/static`.

Uploads are validated by **magic bytes**, not the file name: only JPG, PNG, WebP, AVIF and GIF up to 5 MB are accepted. SVG is deliberately rejected — it can carry script and is served from the admin's own origin. Images that fail to load anywhere in the admin degrade to a visible "Image not available" note instead of a broken icon.

## API overview

**Routes, controllers, services.** `src/routes/store/` and `src/routes/admin/` hold one routing table per resource — `cart.js`, `orders.js`, `price-lists.js` and so on — each mapping URLs to controller functions plus their middleware, composed by an `index.js`. Sub-routers declare **full paths** instead of being mounted under a prefix, so the path in the code is the path in the URL and stays greppable. `src/controllers/**` mirrors those files 1:1 with the request handlers, written as plain `async (req, res)` functions; the `controller()` helper in `lib/util.js` wraps them so a thrown `check()` still reaches the central error handler. Logic worth sharing between controllers (pricing, cart totals, campaign evaluation, mail, imports) lives in `src/services/`.

Two details worth knowing: `routes/admin/index.js` is the single place the admin auth boundary is declared — login is mounted before `adminAuth`, everything after it requires a token — and rate limiters live in `lib/rate-limits.js` because the instance *is* the counter bucket, so the store's auth endpoints and the guest order lookup deliberately share one allowance.

**Validation is Joi, on every endpoint.** Each route names a schema from `src/validation/`, and `lib/validate.js` runs it before the controller:

```js
router.post("/carts/:id/items", validate(schema.addItem), cart.addItem)
```

- **Types are converted.** HTML forms and query strings send text, so `"4.50"` becomes `4.5` and `?banners=true` becomes `true` before a controller sees it. Controllers no longer re-parse anything.
- **Unknown keys are stripped**, so the admin panel can echo a whole record back on save and nothing undeclared reaches the database — which also rules out mass assignment.
- **Messages are sentences**, because the admin panel shows them verbatim to a non-developer: *"Choose at least one category."*, *"A campaign shown on the home page needs a banner image."*, *"Discount must be between 0 and 100."*
- **Conditional rules live in the schema** — a coupon needs a code unless it applies automatically, a category campaign needs something in scope, a price list targets a group *or* one customer but never both.
- **Sign-in schemas stay deliberately loose.** A malformed email must answer "Wrong email or password." like any other failure, never a format hint that confirms which addresses exist.

What Joi does *not* do is anything needing the database. "Order not found", "Refund exceeds the remaining order total", "Email already in use" and "Not enough stock available" stay in the controllers, where the data is, and still use the `check()` helper.

Store (public, CORS-restricted to the storefront; auth via customer JWT):

```
GET  /api/store/products?q=&category_id=&handle=&order=&limit=&offset=
GET  /api/store/categories | /api/store/shipping-methods
POST /api/store/carts                     POST /api/store/carts/:id/items
PATCH/DELETE /api/store/carts/:id/items/:itemId
POST/DELETE  /api/store/carts/:id/promotions   (apply / remove a campaign code)
GET  /api/store/campaigns?banners=true     GET /api/store/campaigns/:handle
POST /api/store/carts/:id/details|shipping-method|payment|complete|customer
POST /api/store/auth/register|login|forgot-password|reset-password  (rate-limited)
GET/PATCH /api/store/customers/me         POST /api/store/customers/me/password
GET  /api/store/customers/me/summary (auth — order totals for the account overview)
GET  /api/store/orders?status= (auth)     GET /api/store/orders/:id
POST /api/store/orders/lookup             POST /api/store/orders/:id/claim (auth)
```

Admin (JWT via `POST /api/admin/auth/login`, no CORS — same-origin panel only): CRUD for products, categories, campaigns, price-lists, customer-groups, shipping-methods, suppliers; orders (`/status`, `/capture`, `/refund`, `/notes`); customers; `/import/products` + `/import/template`; `/ai/enhance`; `/stats`.

Security: bcrypt password hashing, scoped JWTs (admin tokens can't act as customers and vice versa), parameterized SQL everywhere, helmet headers, rate-limited auth endpoints, strict input validation, unguessable UUID cart/order ids, admin API without CORS.

### Card payments — RaiAccept (Raiffeisen)

Card payments go through [RaiAccept](https://docs.raiaccept.com/code-integration.html) with **One-click checkout**, so returning customers can pay with a stored card.

**The flow.** A card order is placed *before* the money moves — it exists as `awaiting` with its stock reserved — and only then is the shopper sent to the payment window:

1. `POST /carts/:id/complete` creates the order, then calls RaiAccept (`POST /orders`, then `POST /orders/{id}/checkout`) and answers `{ type: "payment_required", payment_url }` instead of a finished order.
2. The storefront sends the shopper to `payment.raiaccept.com`.
3. They pay, and land back on `/order/paid|failed|canceled/:id`.
4. RaiAccept posts to `/api/store/payments/raiaccept/webhook`, which settles the order.

**The webhook is not trusted.** Their documentation says the notification is not the confirmation, so the handler uses the payload only to identify the order and then asks RaiAccept what actually happened before marking anything paid. It is a public endpoint; a forged "SUCCESS" changes nothing. It is also idempotent — they retry up to three times, and a repeat must not send a second email or restock twice.

**One-click checkout** is switched on by sending `recurring.recurringModel = "ONE_CLICK_CHECKOUT"` with the signed-in customer's id as `customerReference`. RaiAccept then offers "Save card details for future purchases" and shows the stored card on the next visit. Guests send no `recurring` block at all — an empty `customerReference` would make every guest look like the same person. The returned `cardToken` and masked number are mirrored into `customer_cards` for display; no card number is ever stored.

**Refunds** issued from the admin call `POST /orders/{id}/transactions/{txId}/refund` against the stored purchase transaction.

Configuration (`server/.env`) — sandbox and production share the same URLs, and the credentials decide which you are in:

```
RAIACCEPT_USERNAME=       # from the RaiAccept Merchant portal
RAIACCEPT_PASSWORD=
PUBLIC_API_URL=           # where RaiAccept can reach this server for webhooks
```

**Leave the credentials empty and card payments stay in test mode** — orders are placed and authorised immediately, so the rest of the shop can be developed without the bank. If your infrastructure filters inbound traffic, allow RaiAccept's webhook range `18.96.33.128/29`.

### Rate limiting

Everything an unauthenticated caller can make the API *do* is bounded (`src/lib/rate-limits.js`), per shopper per 15 minutes:

| endpoint | limit | why |
| --- | --- | --- |
| register / login / forgot / reset / order lookup | 30 shared | guessing-prone, one shared budget |
| admin sign-in | 20 | credential stuffing |
| `POST /carts` | 60 | unauthenticated row creation |
| `POST /carts/:id/complete` | 20 | reserves stock and sends mail |
| `POST /carts/:id/promotions` | 20 **wrong codes** | the one brute-force surface a guest can reach |

Two details that make these work rather than merely exist:

- **Correct promo codes cost nothing.** The promo limiter sets `skipSuccessfulRequests`, so a customer applying a valid voucher is never rate limited — only wrong guesses spend the budget.
- **Buckets are per shopper, not per shop.** The storefront renders on the server, so every API call leaves from one machine; keying on the socket address would put the whole country in one bucket and let a single script lock everyone out of checkout. The storefront therefore names the shopper in `x-shopper-address`, and the API believes that header **only** from a loopback or private-network peer. A caller off the open internet has a public socket address, so forging it buys nothing.

If a limit ever fires for a real customer, raise it — the numbers are set well above human behaviour on purpose. And keep `app.set("trust proxy", …)` in `src/index.js` matched to the real number of proxies in front of the server.

### Error logging

Server-side failures are recorded in the **`error_logs`** table, so a problem in production leaves evidence instead of scrolling past in a terminal. Three kinds go in:

| kind | when |
| --- | --- |
| `server_error` | a request ended in a 5xx |
| `uncaught_exception` | something threw and nothing caught it |
| `unhandled_rejection` | a promise rejected with no `.catch()` |

Each row keeps the error name, message and stack, plus the request that caused it — method, path, status, query, body, IP, user agent, and the admin or customer who was signed in.

- **Secrets never reach the table.** Bodies are redacted by key before insert (`password`, `confirm_password`, `token`, `payment_data`, `card_number`, `cvv`, …, recursively and through arrays), so a 500 during sign-in cannot turn the log into a list of passwords. See `SECRET_KEYS` in `src/lib/error-log.js`.
- **4xx are not logged.** Bad input, a wrong password and a missing record are the API working correctly; logging them would bury the real failures.
- **Logging never makes things worse.** The write is best-effort and cannot throw — if the database is what broke, it falls back to the console and the original error still surfaces. Request logging is not awaited, so it never delays a response.
- **Crashes still crash.** After an uncaught exception or unhandled rejection the process is in an undefined state, so it flushes the log (with a 2-second cap) and exits 1. Run the server under something that restarts it — systemd, pm2, Docker, or `node --watch` in development.

Oversized payloads are summarised rather than stored whole, and stacks are capped, so one bad request cannot bloat the table. There is no automatic retention policy yet: `delete from error_logs where created_at < now() - interval '90 days'` on a schedule is the obvious next step.

## Features

- **EUR only**, tax-inclusive prices; deterministic formatting (sq: `1.299,00 €`, en: `€1,299.00`)
- **Shipping is per product, not a checkout choice.** Intersoft resells, so each product carries exactly one shipping option — normally inherited from its supplier (picking a supplier in the product form fills it in; changing a supplier's default can be applied to all its products at once). A cart is split into **one shipment per distinct shipping option** and each is charged once, which is what happens when items come from different suppliers. The shopper sees the breakdown at checkout; the admin sees it on the order.
- **Pricing engine** — see below.
- **Payments** — `cod` (cash on delivery), `pos` (card terminal at the door) — both placed as "awaiting" and captured in admin; `card` — Raiffeisen gateway **skeleton** in `server/src/services/payments.js` (test mode authorizes; fill the `TODO(raiffeisen)` blocks and set env credentials to go live)
- **Refunds / returns** — handled on the admin order page (refund amount, reason, optional restock, recorded in the timeline; card refunds route through the gateway hook)
- **Excel import** — create/update by handle, auto-creates category paths ("Components > Graphics Cards") and suppliers, sets the shipping option (`shipping_method` column → supplier default → cheapest, with a warning when a name is unknown), sale prices, stock, tags, images; per-row errors/warnings
- **AI enhancement** — optional OpenAI-powered title/description/tags suggestions, always human-reviewed before saving
- **Multi-language, Albanian first** — the storefront defaults to **Albanian**, with English as the alternative (switcher in the header, remembered in a cookie). UI strings live in `storefront/lib/i18n/{sq,en}.json`. Content translations are editable in the admin: products (`title_sq` / `description_sq`, also generatable via AI), categories (`name_sq` / `description_sq`) and shipping options (`name_sq` / `description_sq`). Anything untranslated falls back to English.
- **Stock management** — atomic decrement on order placement, restock on cancel/refund, low-stock dashboard alerts
- **Suppliers** — who fulfills each product and with which courier; the store still sells B2C only, customers never see supplier data

### Pricing: price lists, customer groups, promotions

Every variant has a **base price**. Anything below it comes from a **price list**, and price lists are targeted:

| Target | Use case |
|---|---|
| Everyone | seasonal "Sale" list |
| A **customer group** | wholesale / reseller pricing (Admin → Customer Groups, then assign customers) |
| One **customer** | a negotiated contract price for a single client |

Each entry can carry a **minimum quantity**, which gives volume tiers ("10+ at €89 each"). A list also has a date window, an active flag and a priority.

When several lists match, the winner is: **highest priority → most specific target** (customer beats group beats everyone) **→ lowest price**. A `sale` list is shown to the shopper as a discount (struck-through base price); an `override` list simply becomes the price, with no strike-through invented on a negotiated rate.

**The mechanism is never shown to the customer.** They see the resolved price and nothing else — no price-list name, no "your price" badge, no group membership. That is enforced at the serializer, not just in the UI: `calculated_price` and cart lines carry only amounts and volume tiers, and `GET /customers/me` does not return group membership. A shopper reading the network tab cannot tell which list produced their price. Signed-in shoppers see their own prices everywhere (catalog, product page, cart), and those responses are marked `private, no-store` so personal prices never land in a shared cache.

Building a list is quick: search a product and set its price, or **bulk fill** a whole category at "x% off base".

**Campaigns** are discounts plus conditions, and can be a **code** the shopper types or **automatic** (applies by itself):

- *Discount*: percentage, fixed amount, or free shipping
- *Scope*: whole order, products in chosen categories (subcategories included), or specific products
- *Conditions*: minimum subtotal, minimum item count, restricted to a customer group, date window, total usage limit, and uses per customer
- Everything that qualifies stacks — automatic promotions plus one entered code — and the total can never exceed what it discounts

Usage is tracked in `campaign_redemptions`, so "one per customer" is enforced for accounts and for guest emails, and each order stores a snapshot of the discounts it received.

**Every campaign also has a public face.** Upload a banner image, write a headline/subtitle in Albanian and English, and tick *show on the home page*. The home page picks one enabled banner **at random on each visit**, so several running campaigns rotate. Clicking it opens `/campaign/<handle>` — the campaign's own catalogue listing exactly the products it covers (the products in its categories, including subcategories; the products it names; or the whole catalogue for an order-wide campaign), with the offer and its conditions stated at the top.

**Group-restricted campaigns are genuinely private:** a campaign limited to a customer group is never returned to anyone outside it — no banner on their home page, and `/campaign/<handle>` answers 404 for them, whether they are a guest or a signed-in customer from another group.

### Customer accounts & post-order experience

- **Guest checkout stays guest-friendly.** After ordering, the confirmation page offers to create an account with the name and email already filled in — one password field and that order moves into the new account. Registering later with the same email also claims every past guest order automatically.
- **Order tracking without an account** at `/track`: order number + the email used. Same view as the account order page, including the progress timeline.
- **Account area** — a real customer panel, not a settings form:
  - **Overview** (`/account`) opens on an at-a-glance dashboard: orders placed, how many are on the way, total spent, the latest order with its status, and the saved delivery address. Totals come from `GET /customers/me/summary`, which aggregates over *every* order rather than one page of results.
  - **Orders** (`/account/orders`) has filter tabs (all / in progress / delivered / canceled), real pagination with a "showing 1–10 of 14" counter, and rows that name the products instead of only showing thumbnails. Filtering happens server-side via `GET /orders?status=…` against a whitelist.
  - **Profile** and **Password** are separate screens. Saves confirm with a toast, errors sit next to the button, the password fields share a show/hide toggle and clear themselves after a successful change. Email is read-only with an explanation of why.
  - **Signing out asks first** — a real dialog, dismissible with Escape or a click outside.
  - Sidebar shows who is signed in and since when. Pricing groups and price lists are deliberately **not** surfaced — a B2B customer sees their price, not the machinery behind it.
- **Password reset** — `/forgot-password` emails a link (the endpoint always answers 200 so it can't be used to probe which emails exist). Tokens are stateless, expire in an hour and are **single-use**: they embed a fingerprint of the current password hash, so a used or outdated link stops working.
- **Emails** (`server/src/services/mail.js`) go out in the language the order was placed in: order confirmation, payment received, being prepared, shipped, delivered, canceled, refund processed, welcome, password reset. Each contains the full order breakdown. Admin actions send them automatically; pass `notify: false` on an admin request to stay silent.

Without `SMTP_HOST`, every message is written to `server/tmp/mail/*.html` (and logged) so a single developer can read exactly what customers would receive. Set `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`MAIL_FROM` to send for real.

### Excel import columns

`title`\*, `handle`, `sku`, `description`, `category` (path like `Components > Graphics Cards`), `price`\*, `sale_price`, `stock`, `images` (comma-separated URLs), `tags`, `brand`, `supplier`, `shipping_method`, `weight` — see `sample-import.xlsx`, or download the template from the admin Import page.

### Dependency pins

`storefront/package.json` carries two `overrides`:

```json
"overrides": { "sharp": "^0.35.3", "postcss": "^8.5.25" }
```

Next 16.2.12 — the latest release — still pins `sharp` 0.34.x and `postcss` 8.4.x, both of which carry high-severity advisories. **Do not run `npm audit fix --force` in the storefront:** npm's idea of a fix is installing `next@9.3.3`, which would take the App Router with it. The overrides pull just those two forward instead; drop them once a Next release ships the fixed versions itself. Both apps report zero vulnerabilities as they stand.

## Production notes

- Set a strong `JWT_SECRET`, use managed Postgres, serve over HTTPS behind a reverse proxy
- Set `STORE_ORIGIN` to the real storefront domain
- Replace the seeded admin password; consider IP-allowlisting `/admin`
- Replace the generated SVG placeholders with real product photos (upload them in the admin, or point to a CDN)
- Back up `server/static/uploads/` together with the database — uploaded images live on disk
- The card provider needs the bank's merchant credentials and the gateway calls implemented before going live
