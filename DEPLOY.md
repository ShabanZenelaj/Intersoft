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

**Domain:** `https://yourdomain.com`.

---

## 4. First run

**Create the admin account.** The seed script exists for development and creates a demo catalogue plus an admin whose password is public knowledge. On a real shop, do not run it. Instead open a terminal on `intersoft-api` (Coolify → the app → Terminal) and:

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

Set `NEW_ADMIN_PASSWORD` as a temporary environment variable, run it, then remove the variable.

*If you do seed a demo shop to try things out*, change the password immediately — `admin@intersoft-rks.com / supersecret` is in this repository.

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
