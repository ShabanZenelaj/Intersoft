-- Campaigns are listed newest-first on the storefront, so they need a
-- creation timestamp (the old promotions table never had one).
alter table campaigns add column created_at timestamptz not null default now();
