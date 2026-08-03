# Deploying Intersoft to Coolify

Three resources in one Coolify project:

| Resource | What it is | Port | Domain |
| --- | --- | --- | --- |
| `intersoft-db` | PostgreSQL 16 | 5432 | none (internal only) |
| `intersoft-api` | `server/` — REST API, admin panel, product images | 9000 | `api.yourdomain.com` |
| `intersoft-shop` | `storefront/` — Next.js shop | 3000 | `yourdomain.com` |

The storefront talks to the API **server-side**, over Coolify's internal network. Only the two domains above are ever public; the database is not exposed.

---

## 0. Get the code into Git

Coolify deploys from a Git repository, and this project is not one yet.

```bash
cd /Users/shaban/Desktop/Claude/Intersoft
git init
git add .
git commit -m "Intersoft storefront, API and admin"
git remote add origin git@github.com:YOURNAME/intersoft.git
git push -u origin main
```

The root `.gitignore` keeps `.env` files, `node_modules`, uploaded images and the two reference folders (`backend/`, `enterprise-commerce-main/`) out of the repo. A dry run of the above stages **295 files, 1.7 MB** — all of `server/src`, `server/admin`, the migrations, the storefront and the seed images, and no secrets.

Sanity-check it yourself before pushing:

```bash
git status --porcelain | grep -i '\.env'      # must print nothing
git ls-files server/src | wc -l               # must be ~98, not 0
```

> `server/` used to contain its own stray, empty `.git` directory (a leftover `git init` with no commits and no remote). Git treats a nested repo as a submodule and silently skips its contents, so the root repository would have been pushed **without any backend code** and the API build would have failed with nothing obvious to point at. It has been moved to `/tmp/stray-server-git-backup`; delete that whenever.

In Coolify: **Sources → Add** your GitHub/GitLab account, or use a public repo URL.

---

## 1. PostgreSQL

**New Resource → Database → PostgreSQL.**

- Name: `intersoft-db`
- PostgreSQL 16
- Leave it **without** a public domain — nothing outside the project needs to reach it.

Once created, copy the **internal** connection string from the database page. It looks like:

```
postgres://postgres:GENERATED_PASSWORD@intersoft-db:5432/postgres
```

That hostname only resolves inside the project, which is exactly what you want.

---

## 2. The API (`server/`)

**New Resource → Application →** your repository.

**Build settings**

| Setting | Value |
| --- | --- |
| Build Pack | `Nixpacks` |
| Base Directory | `/server` |
| Port | `9000` |
| Start Command | `npm run migrate && npm start` |
| Health Check Path | `/health` |

The start command runs migrations on every deploy. They are tracked in a `migrations` table and skip themselves once applied, so redeploying is safe.

**Persistent storage — do not skip this.** Product images the manager uploads are written to disk, and a container's disk is wiped on every deploy.

- **Storages → Add** → Volume Mount
- Destination Path: `/app/static/uploads`

**Environment variables**

```bash
NODE_ENV=production
PORT=9000

DATABASE_URL=postgres://postgres:PASSWORD@intersoft-db:5432/postgres

# 32+ random characters. Changing it later signs everyone out.
#   openssl rand -base64 32
JWT_SECRET=

# CORS allowlist for the shop API — the storefront's public domain.
# Comma-separate if you have more than one.
STORE_ORIGIN=https://yourdomain.com

# This API's own public URL. Used to build image URLs and the RaiAccept
# webhook address, so it must be the real https domain.
BACKEND_URL=https://api.yourdomain.com
PUBLIC_API_URL=https://api.yourdomain.com

# Email. Without SMTP_HOST, messages are written to disk instead of sent.
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=Intersoft <no-reply@yourdomain.com>

# Card payments. Leave blank to keep the card option in test mode.
RAIACCEPT_USERNAME=
RAIACCEPT_PASSWORD=

# Optional — the admin's "write it for me" product copy assistant.
OPENAI_API_KEY=
```

**Domain:** `https://api.yourdomain.com`. Coolify issues the certificate through Traefik.

Deploy. `https://api.yourdomain.com/health` should answer `OK`.

---

## 3. The storefront (`storefront/`)

**New Resource → Application →** the same repository.

| Setting | Value |
| --- | --- |
| Build Pack | `Nixpacks` |
| Base Directory | `/storefront` |
| Port | `3000` |

**Environment variables**

```bash
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.yourdomain.com
```

⚠️ **Tick "Build Variable?" on `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.** Next bakes `NEXT_PUBLIC_*` values into the build and derives the allowed image hosts from this one. Setting it as a runtime-only variable produces a shop with broken product images, and changing it later needs a **rebuild**, not a restart.

> **Why Tailwind is a runtime dependency here.** `NODE_ENV=production` makes npm skip `devDependencies`, but `tailwindcss`, `tailwindcss-animate`, `postcss` and `autoprefixer` are needed to *build* the CSS — not merely to develop. With them in `devDependencies` the build dies on `Cannot find module 'tailwindcss'`. They now sit in `dependencies` so the build works on any host that installs with production settings. Don't move them back.

**Domain:** `https://yourdomain.com`.

---

## 4. First run — seeding the beta

This deployment is a beta, so seed it: an empty shop is hard to judge. The seed fills the database with a realistic catalogue you can click through, then hand to someone else to click through.

Open a terminal on `intersoft-api` (Coolify → the app → **Terminal**) and run:

```bash
SEED_ADMIN_EMAIL=you@yourdomain.com SEED_ADMIN_PASSWORD='pick-a-real-password' npm run seed
```

**Set both variables.** Without them the script falls back to `admin@intersoft.al / supersecret`, which is written in this repository — fine on a laptop, not on something with a public domain. It prints a warning when it falls back, so you will not do it by accident. Passing them inline as above keeps the password out of Coolify's stored environment; it lives only in that terminal session.

What you get: 1 admin, 3 shipping methods, 3 suppliers, 19 categories, 38 products with 46 variants, a `Sale` price list with 7 discounted variants, and a working `WELCOME10` code for 10% off. Stock is 20 per variant.

**Safeguards.** The whole seed runs in one transaction, so if any step fails the database is left untouched rather than half-populated. And it refuses to run at all once `products` has rows — you cannot double-seed by re-running it.

**`BACKEND_URL` must already be correct.** The seed writes absolute image URLs into the product rows. Seeding before the API's domain is set, or with `BACKEND_URL` still on localhost, produces a catalogue of broken images that only a re-seed fixes.

### Going from beta to real

The seeded catalogue is demo data — real prices and stock it is not. When the shop goes live, either start from a fresh database and skip this section entirely, or delete the demo rows:

```bash
psql "$DATABASE_URL" -c "truncate products, categories, suppliers, price_lists, campaigns restart identity cascade;"
```

Placed orders survive: an order stores its line items as a snapshot rather than a reference, so it stays readable after the products behind it are gone. Your admin account, customers and shipping methods are untouched too. The cascade reaches `variants`, `price_list_prices`, `campaign_redemptions` and `cart_items` — so anyone with a cart open at that moment finds it empty.

### Just an admin, no demo data

If you'd rather have an empty shop:

```bash
node -e "
const { query, pool } = require('./src/db')
const { hashPassword } = require('./src/lib/auth')
;(async () => {
  await query('insert into admins (email, password_hash, name) values (\$1, \$2, \$3)', [
    'you@yourdomain.com', await hashPassword(process.env.NEW_ADMIN_PASSWORD), 'Store manager',
  ])
  console.log('admin created')
  await pool.end()
})()"
```

Set `NEW_ADMIN_PASSWORD` as a temporary environment variable, run it, then remove the variable. You will also need to add at least one shipping method in the admin before checkout works.

**Then check, in order:**

1. `https://api.yourdomain.com/health` → `OK`
2. `https://api.yourdomain.com/admin` → sign in
3. Add a product with a photo, then redeploy the API and confirm the photo is still there — that proves the volume is mounted
4. `https://yourdomain.com` → the shop, with images
5. Place a cash-on-delivery order end to end
6. Confirm the confirmation email arrives

---

## 5. Card payments (when the bank is ready)

1. Add `RAIACCEPT_USERNAME` / `RAIACCEPT_PASSWORD` from the RaiAccept Merchant portal and restart. Sandbox and production share the same URLs — the credentials decide which you are in.
2. Confirm `PUBLIC_API_URL` is the real https domain. RaiAccept posts the payment result to `PUBLIC_API_URL/api/store/payments/raiaccept/webhook`, and a payment that cannot be confirmed leaves the order unpaid.
3. If anything filters inbound traffic, allow their webhook range `18.96.33.128/29`.
4. Place a sandbox order and watch it move to **paid** in the admin.

---

## Things specific to this app

**`JWT_SECRET` must be at least 16 characters** or the API refuses to start — deliberately, so a deploy fails loudly rather than running on a guessable secret.

**`STORE_ORIGIN` is the CORS allowlist.** Wrong value and the shop cannot reach the API. It is the *storefront's* domain, not the API's.

**Migrations run at startup**, so a deploy that adds a migration applies it automatically. If one fails the container will not start — check the deploy log before assuming a network problem.

**`trust proxy` is set to 1** in `server/src/index.js`, which is correct behind exactly one proxy — Coolify's Traefik. If you later add a CDN in front, raise it to match, or rate limits and error logs will record the proxy's address instead of the shopper's.

**Rate limits identify shoppers by a forwarded address.** Because the storefront renders server-side, every request reaches the API from one container; the storefront sends `x-shopper-address` and the API trusts it only from a private-network peer. Coolify's internal network uses private addresses, so this works — but it is the reason the storefront must reach the API over the internal network rather than looping out through the public domain.

**Uploaded images live on the volume.** Losing that volume loses every product photo added through the admin. The seeded placeholder images are in the repo and will come back on their own; uploads will not.

**The admin panel is served by the API**, not the storefront — `api.yourdomain.com/admin`. It is same-origin with the API on purpose: the admin API sends no CORS headers at all, so a browser on any other origin cannot call it.

**Backups.** Coolify can schedule PostgreSQL backups from the database resource. Turn them on before the shop takes real orders.
