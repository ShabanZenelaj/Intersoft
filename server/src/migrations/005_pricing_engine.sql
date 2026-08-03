-- Pricing engine: customer groups, targeted price lists with quantity tiers,
-- and promotions that can be scoped and conditioned instead of always being a
-- flat discount on the whole order.

-- ---------------------------------------------------------------- groups

create table customer_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table customer_group_members (
  customer_id uuid not null references customers(id) on delete cascade,
  group_id uuid not null references customer_groups(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (customer_id, group_id)
);
create index customer_group_members_group_idx on customer_group_members(group_id);

-- ---------------------------------------------------------------- price lists

-- A list applies to everyone, to one group, or to one specific customer.
alter table price_lists add column description text not null default '';
alter table price_lists add column customer_group_id uuid references customer_groups(id) on delete cascade;
alter table price_lists add column customer_id uuid references customers(id) on delete cascade;
alter table price_lists add column priority int not null default 0;
alter table price_lists drop column customer_group;

alter table price_lists drop constraint if exists price_lists_type_check;
alter table price_lists add constraint price_lists_type_check
  check (type in ('sale', 'override'));

-- A list may not target a group and a single customer at the same time.
alter table price_lists add constraint price_lists_single_target
  check (customer_group_id is null or customer_id is null);

create index price_lists_group_idx on price_lists(customer_group_id);
create index price_lists_customer_idx on price_lists(customer_id);

-- Quantity tiers: "10+ units at this price".
alter table price_list_prices add column min_quantity int not null default 1
  check (min_quantity >= 1);
alter table price_list_prices drop constraint price_list_prices_pkey;
alter table price_list_prices add primary key (price_list_id, variant_id, min_quantity);

-- ---------------------------------------------------------------- promotions

alter table promotions add column name text not null default '';
alter table promotions add column applies_to text not null default 'order'
  check (applies_to in ('order', 'category', 'product', 'shipping'));
alter table promotions add column category_ids uuid[] not null default '{}';
alter table promotions add column product_ids uuid[] not null default '{}';
alter table promotions add column customer_group_id uuid references customer_groups(id) on delete cascade;
alter table promotions add column min_quantity int not null default 0;
alter table promotions add column usage_limit_per_customer int;
alter table promotions add column is_automatic boolean not null default false;

alter table promotions drop constraint if exists promotions_type_check;
alter table promotions add constraint promotions_type_check
  check (type in ('percentage', 'fixed', 'free_shipping'));

-- Automatic promotions need no code; codes stay unique when present.
alter table promotions alter column code drop not null;
create unique index promotions_code_key_ci on promotions (lower(code)) where code is not null;

create table promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references promotions(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  email text not null,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index promotion_redemptions_promo_idx on promotion_redemptions(promotion_id);
create index promotion_redemptions_email_idx on promotion_redemptions(promotion_id, lower(email));

-- Orders keep a snapshot of every discount that was applied.
alter table orders add column discounts jsonb not null default '[]';

-- Seed a starter group so the manager has something to assign.
insert into customer_groups (name, handle, description)
values ('Wholesale', 'wholesale', 'Resellers and business customers with negotiated pricing');
