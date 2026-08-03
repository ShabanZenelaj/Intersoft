-- RaiAccept (Raiffeisen) card payments.
--
-- Card orders are created before the money moves: the order exists as
-- 'awaiting' with stock reserved, the shopper is sent to the RaiAccept payment
-- window, and the webhook (verified against their API) settles it afterwards.

alter table orders
  -- The merchantOrderReference we send. RaiAccept requires it to be unique per
  -- attempt, so a retry after a decline gets a fresh one — which is why this is
  -- its own column rather than the order id.
  add column payment_reference text unique,
  add column raiaccept_order_id text,
  -- The purchase transaction, needed to issue a refund against it later.
  add column raiaccept_transaction_id text,
  add column card_brand text,
  add column card_masked text;

-- The webhook arrives with merchantOrderReference and we look the order up by it.
create index orders_payment_reference_idx on orders (payment_reference);
create index orders_raiaccept_order_id_idx on orders (raiaccept_order_id);

/*
 * Cards a shopper has stored for one-click checkout.
 *
 * RaiAccept is the vault — it holds the card against our customerReference and
 * shows it in the payment window on its own. This table only mirrors what was
 * stored so the account area can show "Visa ···· 0019" and so the token flow
 * can pre-select a card. No card number ever lands here, only the mask.
 */
create table customer_cards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  card_token text not null,
  masked_number text not null default '',
  brand text not null default '',
  issuer_country text not null default '',
  holder_name text not null default '',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (customer_id, card_token)
);

create index customer_cards_customer_idx on customer_cards (customer_id, created_at desc);
