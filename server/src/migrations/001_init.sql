-- Intersoft schema. Money is numeric(10,2), EUR only, tax-inclusive.

create extension if not exists pgcrypto;

create table admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  created_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text not null unique,
  description text not null default '',
  parent_id uuid references categories(id) on delete set null,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'
);

create table products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  handle text not null unique,
  description text not null default '',
  brand text not null default '',
  status text not null default 'published' check (status in ('draft', 'published')),
  category_id uuid references categories(id) on delete set null,
  supplier_id uuid references suppliers(id) on delete set null,
  tags text[] not null default '{}',
  images jsonb not null default '[]',          -- ["url", ...]
  thumbnail text,
  options jsonb not null default '[]',         -- [{"title":"Memory","values":["16GB","32GB"]}]
  weight int,
  metadata jsonb not null default '{}',        -- title_sq, description_sq, featured, ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on products(category_id);
create index products_status_idx on products(status);

create table variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  title text not null default 'Default',
  sku text unique,
  options jsonb not null default '{}',         -- {"Memory":"16GB"}
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0,
  manage_stock boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index variants_product_idx on variants(product_id);

-- Price lists: today used for the "Sale" list; a future B2B list is one row
-- with type='override' and a customer_group.
create table price_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'sale' check (type in ('sale', 'override')),
  customer_group text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz
);

create table price_list_prices (
  price_list_id uuid not null references price_lists(id) on delete cascade,
  variant_id uuid not null references variants(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  primary key (price_list_id, variant_id)
);

create table promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'percentage' check (type in ('percentage', 'fixed')),
  value numeric(10,2) not null check (value > 0),
  min_subtotal numeric(10,2) not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int,
  used_count int not null default 0
);

create table shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  email text,
  shipping_address jsonb,
  shipping_method_id uuid references shipping_methods(id) on delete set null,
  payment_method text check (payment_method in ('cod', 'pos', 'card')),
  promo_code text,
  status text not null default 'open' check (status in ('open', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  unique (cart_id, variant_id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  display_id serial,
  customer_id uuid references customers(id) on delete set null,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'shipped', 'delivered', 'canceled')),
  payment_status text not null default 'awaiting'
    check (payment_status in ('awaiting', 'paid', 'partially_refunded', 'refunded')),
  payment_method text not null check (payment_method in ('cod', 'pos', 'card')),
  payment_data jsonb not null default '{}',
  shipping_address jsonb not null,
  shipping_method jsonb not null,              -- {name, price} snapshot
  items jsonb not null,                        -- [{variant_id, product_id, product_title, variant_title, product_handle, sku, thumbnail, unit_price, quantity, total}]
  subtotal numeric(10,2) not null,
  discount_total numeric(10,2) not null default 0,
  promo_code text,
  shipping_total numeric(10,2) not null default 0,
  refunded_total numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on orders(customer_id);
create index orders_status_idx on orders(status);

-- Order timeline: status changes, payments, refunds, notes.
create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  type text not null,                          -- placed | status_changed | payment_captured | refunded | note
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index order_events_order_idx on order_events(order_id);
