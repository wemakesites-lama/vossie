-- Schema catch-up, Task 6b (found in Task 6): a shop the Hub paused has no storefront.
--
-- Phase A's private.shop_is_public treated every paused shop as public. The app doesn't: hasStorefront
-- (lib/data/catalog.ts:28) gives a shop the Hub paused (seller_profiles.paused_by = 'staff') no storefront, and its
-- listings no pages (publicListing, catalog.ts:114; staff tools spec 2.3, amendment 13.2). So anyone could still read a
-- Hub-paused shop, its listings, their photos and its pickup points through the API: a moderation leak.
--
-- - private.shop_is_public becomes hasStorefront, and private.shop_has_storefront (Task 6) calls it, so one rule serves
--   every policy on shops, listings, listing_photos and shop_pickup_points, and start_conversation, create_report and
--   follow_shop, which all ask one of the two. Their own code is unchanged: a Hub-paused shop and its listings are now
--   'not-found' to each, as composerSubject, reportSubject and addFollow are null for them.
-- - The rules that already asked for an approved shop are unchanged (save_listing's first publish, record_search_matches,
--   add_featured_pin, start_offer), as are the owner's, the admin's and the mentor's reads.
-- - The app still shows a Hub-paused shop's name and photo in a buyer's threads with it (shopOf, lib/data/messages.ts:90;
--   amendment 19.3) and on a follower's Saved list, so they can unfollow it (listFollowedShops, follows.ts:62; amendment
--   17.6). So the signed-in shops policy also lets a buyer in a conversation with a paused shop, and its followers, read
--   its row: never its listings, which have no page.

-- Whether a shop has a storefront (hasStorefront, catalog.ts:28): a sample shop no one owns (shopStatus: approved), an
-- approved shop, or one its seller paused. Not one the Hub paused (over its seller's own pause or not), one waiting for
-- approval, an owned one whose seller profile has gone (shopStatus: pending), or an unknown one.
-- Same signature, volatility, security and grants as phase A's (CREATE OR REPLACE keeps the grants).
create or replace function private.shop_is_public(shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.owner_id is null
      or sp.status = 'approved'
      or (sp.status = 'paused' and sp.paused_by is distinct from 'staff')
    from public.shops s
    left join public.seller_profiles sp on sp.account_id = s.owner_id
    where s.id = shop
  ), false);
$$;

-- Task 6's follow check, now the same rule (storefrontRow, catalog.ts:93).
create or replace function private.shop_has_storefront(shop uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.shop_is_public(shop);
$$;

-- Whether the signed-in reader still deals with a paused shop: they're the buyer in a conversation with it, or they
-- follow it. Only a paused shop: an open one is public anyway, and a waiting one never had a storefront to write to or
-- follow. For the shops policy below; it reads past the conversations' column grant (buyer_id) as its owner.
create function private.is_shop_contact(shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.shop_status(shop) = 'paused', false) and (
    exists (select 1 from public.conversations c where c.shop_id = shop and c.buyer_id = (select auth.uid()))
    or exists (select 1 from public.follows f where f.shop_id = shop and f.account_id = (select auth.uid()))
  );
$$;
revoke all on function private.is_shop_contact(uuid) from public, anon, authenticated;
grant execute on function private.is_shop_contact(uuid) to authenticated, service_role;

-- Task 2's signed-in shops policy, with the buyer's and the follower's clause added. One policy per role and table, as
-- before. The pickup-point policy reads through it, so they see a paused shop's pickup points too; the listings and
-- listing-photo policies don't, so its listings stay hidden from them.
drop policy "Signed-in people read open shops, owners their own, and staff the ones they look after" on public.shops;
create policy "Signed-in people read open shops and the ones they deal with"
on public.shops for select
to authenticated
using (
  private.shop_is_public(id) or private.owns_shop(id) or (select private.is_staff('admin')) or private.mentors_shop(id)
  or private.is_shop_contact(id)
);
