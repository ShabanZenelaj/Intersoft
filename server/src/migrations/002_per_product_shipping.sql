-- Shipping moves from a customer choice at checkout to a property of the
-- product (in practice driven by which supplier fulfills it). A product has
-- exactly one shipping option; a cart with products from several suppliers is
-- charged each distinct shipping option once (one shipment per supplier).

alter table suppliers add column shipping_method_id uuid references shipping_methods(id) on delete set null;
alter table products add column shipping_method_id uuid references shipping_methods(id) on delete set null;

create index products_shipping_idx on products(shipping_method_id);

-- Existing products get the cheapest active method so nothing breaks.
update products
   set shipping_method_id = (select id from shipping_methods where is_active order by sort_order, price limit 1)
 where shipping_method_id is null;

-- The cart no longer stores a chosen method.
alter table carts drop column if exists shipping_method_id;

-- Orders snapshot a list of shipments instead of a single method.
update orders
   set shipping_method = jsonb_build_array(shipping_method)
 where jsonb_typeof(shipping_method) = 'object';
