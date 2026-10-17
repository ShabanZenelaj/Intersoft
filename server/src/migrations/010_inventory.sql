-- Pro-Data inventory integration.
--
-- Pro-Data is where the business keeps its products and receives orders. This
-- migration adds: a local mirror of its catalog, the link from our variants to
-- its items, the queue that sends our orders there, and the bookkeeping the
-- background jobs need. Credentials are never stored here — they come from the
-- environment.

-- Non-secret configuration and job bookkeeping (counted warehouses, switches,
-- last-run results). One row per key; the value's shape belongs to its reader.
create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- The mirror of Pro-Data's catalog, refreshed by the catalog sync.
--
-- `code` is Pro-Data's item key. Their lookups match it case-insensitively
-- ("pepsicola" finds PEPSICOLA), so uniqueness is enforced the same way while
-- the original spelling is kept for display and for sending orders.
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  source_id int,                               -- Pro-Data's internal sortID
  barcode text not null default '',
  name text not null default '',
  name_alt text not null default '',           -- their "emertimi i dyte"
  brand text not null default '',
  comment text not null default '',
  category text not null default '',           -- klasifikimi1, a name not a code
  sub_category text not null default '',       -- klasifikimi2
  vat numeric(5,2),
  price numeric(12,2),
  image_count int not null default 0,
  -- [{ "warehouse": "Depoja Kryesore", "quantity": 12.5 }] as last read.
  -- Null means stock was never checked, which is not the same as none.
  stock_by_warehouse jsonb,
  stock_checked_at timestamptz,
  raw jsonb not null default '{}',
  ignored boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz
);
create unique index inventory_items_code_idx on inventory_items (lower(code));
create index inventory_items_category_idx on inventory_items (category, sub_category);

-- A variant sold on the web is linked to the Pro-Data item it is stocked as.
-- `inventory_sync = false` means "never send this product to Pro-Data"
-- (services, gift wrapping — things Pro-Data does not stock).
alter table variants
  add column inventory_item_id uuid references inventory_items(id) on delete set null,
  add column inventory_sync boolean not null default true;
create index variants_inventory_item_idx on variants (inventory_item_id);

-- Which of our categories a Pro-Data classification lands in on import.
-- An empty sub_category is the fallback for the whole main classification.
create table inventory_category_map (
  category text not null,
  sub_category text not null default '',
  category_id uuid not null references categories(id) on delete cascade,
  primary key (category, sub_category)
);

-- Import work: one row per item the admin chose to import as a draft.
create table inventory_jobs (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  state text not null default 'queued' check (state in ('queued', 'running', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  product_id uuid references products(id) on delete set null,
  requested_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- The same item cannot be queued twice while an import is still pending.
create unique index inventory_jobs_active_idx on inventory_jobs (inventory_item_id)
  where state in ('queued', 'running');
create index inventory_jobs_state_idx on inventory_jobs (state, created_at);

-- One row per web order that has to reach Pro-Data.
--
--   waiting_links  some lines are not yet mapped to a Pro-Data item
--   queued         ready; the worker will send it
--   sending        the worker is on it right now
--   sent           Pro-Data accepted it (pro_data_order_id is set)
--   failed         failed before anything was posted — safe to retry
--   needs_check    the post may or may not have happened; a person decides
--   dismissed      every line was deliberately skipped; nothing to send
create table inventory_pushes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  state text not null default 'queued'
    check (state in ('waiting_links', 'queued', 'sending', 'sent', 'failed', 'needs_check', 'dismissed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  -- The newest Pro-Data order id seen just before posting. After an ambiguous
  -- post, anything newer than this in their history is ours.
  history_marker text,
  pro_data_order_id text,
  -- H = open (hapur), M = closed/invoiced (mbyllur), A = canceled (anuluar).
  pro_data_status text check (pro_data_status in ('H', 'M', 'A')),
  pro_data_status_at timestamptz,
  -- Our order was canceled after Pro-Data received it; Pro-Data has no cancel
  -- endpoint, so someone has to cancel it there by hand.
  void_required boolean not null default false,
  void_done_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inventory_pushes_state_idx on inventory_pushes (state, next_attempt_at);

-- The lines of a push, snapshotted from the order when the push is created.
--
--   resolution null      not mapped yet — shows up under "Needs linking"
--   auto                 mapped through the variant's permanent link
--   linked               the admin linked the variant permanently
--   one_off              mapped for this sale only
--   dismissed            deliberately not sent
create table inventory_push_lines (
  id uuid primary key default gen_random_uuid(),
  push_id uuid not null references inventory_pushes(id) on delete cascade,
  line_no int not null,
  variant_id uuid references variants(id) on delete set null,
  title text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null,           -- list price per unit
  net_price numeric(10,2) not null,            -- per unit after order discounts
  inventory_item_id uuid references inventory_items(id) on delete set null,
  resolution text check (resolution in ('auto', 'linked', 'one_off', 'dismissed')),
  resolved_by text,
  resolved_at timestamptz,
  unique (push_id, line_no)
);
create index inventory_push_lines_unresolved_idx on inventory_push_lines (variant_id) where resolution is null;
create index inventory_push_lines_item_idx on inventory_push_lines (inventory_item_id);

-- Background jobs report their failures to the same log as the API.
alter table error_logs drop constraint error_logs_kind_check;
alter table error_logs add constraint error_logs_kind_check
  check (kind in ('server_error', 'uncaught_exception', 'unhandled_rejection', 'job_error'));
