-- Promotions become campaigns: the same discount rules, plus a public face —
-- a banner that can run on the home page and a catalogue page listing the
-- products the campaign covers.

alter table promotions rename to campaigns;
alter table promotion_redemptions rename to campaign_redemptions;
alter table campaign_redemptions rename column promotion_id to campaign_id;

alter index promotions_code_key_ci rename to campaigns_code_key_ci;
alter index promotion_redemptions_promo_idx rename to campaign_redemptions_campaign_idx;
alter index promotion_redemptions_email_idx rename to campaign_redemptions_email_idx;

-- Public identity of a campaign.
alter table campaigns add column handle text;
alter table campaigns add column banner_image text;
alter table campaigns add column banner_title text not null default '';
alter table campaigns add column banner_title_sq text not null default '';
alter table campaigns add column banner_subtitle text not null default '';
alter table campaigns add column banner_subtitle_sq text not null default '';
alter table campaigns add column show_on_home boolean not null default false;

-- Existing rows get a handle derived from their code/name.
update campaigns
   set handle = regexp_replace(lower(coalesce(nullif(name, ''), code, 'campaign')), '[^a-z0-9]+', '-', 'g');
update campaigns set handle = trim(both '-' from handle);
update campaigns c set handle = c.handle || '-' || substr(c.id::text, 1, 6)
 where exists (select 1 from campaigns o where o.handle = c.handle and o.id <> c.id);

create unique index campaigns_handle_key on campaigns (handle);

-- A campaign is only browsable when it has somewhere to send the shopper.
alter table campaigns add constraint campaigns_banner_needs_image
  check (not show_on_home or banner_image is not null);
