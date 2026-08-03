-- Post-order customer experience: remember the language an order was placed
-- in (emails are sent in it), let customers save an address for faster
-- checkout, and make guest orders findable by email so they can be claimed.

alter table carts add column locale text not null default 'sq';
alter table orders add column locale text not null default 'sq';

alter table customers add column default_address jsonb;

-- Guest orders are looked up by email when someone registers or tracks an order.
create index orders_email_idx on orders (lower(email));
