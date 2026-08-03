-- Albanian is the storefront's primary language, so the shipping option names
-- shown at checkout need translations too.

alter table shipping_methods add column name_sq text not null default '';
alter table shipping_methods add column description_sq text not null default '';

update shipping_methods set name_sq = 'Dërgesë Standarde',
       description_sq = 'Dorëzohet për 2-4 ditë pune.'
 where name = 'Standard Delivery';

update shipping_methods set name_sq = 'Dërgesë Ekspres',
       description_sq = 'Dorëzohet brenda 24 orëve.'
 where name = 'Express Delivery';

update shipping_methods set name_sq = 'Dërgesë për Artikuj Voluminozë',
       description_sq = 'Artikuj të mëdhenj, dorëzohen për 3-5 ditë pune.'
 where name = 'Bulky Item Delivery';
