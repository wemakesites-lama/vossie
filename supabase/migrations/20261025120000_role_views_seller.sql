-- Role views N2: the seller home's reads (role views spec 6 and 7.1; docs/superpowers/plans/2026-10-22-role-views-n2-seller.md,
-- plan decisions 2, 3 and 10). Both are read-only, security definer with an empty search path like every public
-- function (06_account_actions), and answer the shop's owner only (private.owns_shop): anyone else gets null or 0,
-- never an error, so they hint at nothing.
--
-- Plan decision 3 also makes a Hub hide or Show again a change to the listing (its updated_at moves), so a sale marked
-- completed before it isn't asked about again. hide_listing and show_listing didn't set updated_at (hide_request and
-- show_request do), so both are replaced below with that one line added; the sample store's hideListing and
-- showListing set updatedAt the same way (lib/data/staff-shops.ts).

-- What needs the shop's owner now (sellerQueue, lib/data/seller-queue.ts; queueOver is the sample's): buyers waiting
-- for a first reply (asked, not an offer, buyer and seller both there), sales to mark as sold (done or confirmed, on an
-- available item the Hub hasn't hidden that hasn't changed since the sale was marked completed), drafts, Hub-hidden and
-- paused listings, each with its oldest; the listings by state; and whether the shop ever replied (not an offer).
-- It takes the shop's link and finds the shop itself, so the twin makes one call (plan review fix 6); the gate is still
-- private.owns_shop on the shop found. No shop by that link is null, as for anyone but the owner.
-- A user action (advisor 0029 lists it on purpose).
create function public.seller_queue(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
    shop as (
      select s.id from public.shops s where s.slug = p_slug
    ),
    talks as (
      select c.id, c.listing_id, c.listing_title, c.status, c.is_offer, c.buyer_id, c.created_at, c.first_reply_at,
             c.completed_at, c.confirmed_at
      from public.conversations c
      where c.shop_id = (select id from shop) and not c.seller_gone
    ),
    own as (
      select l.id, l.title, l.state, l.kind, l.hidden_at, l.updated_at
      from public.listings l
      where l.shop_id = (select id from shop)
    ),
    waiting as (
      select t.id::text as id, t.listing_title as title, t.created_at as at
      from talks t
      where t.status = 'asked' and not t.is_offer and t.buyer_id is not null
    ),
    sales as (
      select t.id::text as conversation_id, o.id as listing_id, o.title, coalesce(t.completed_at, t.confirmed_at) as at
      from talks t
      join own o on o.id = t.listing_id
      where t.status in ('done', 'confirmed')
        and o.state = 'available' and o.kind = 'item' and o.hidden_at is null
        and coalesce(t.completed_at, t.confirmed_at) >= o.updated_at
    ),
    listed as (
      select 'drafts' as kind, o.id, o.title, o.updated_at as at, o.state from own o where o.state = 'draft'
      union all
      select 'hidden', o.id, o.title, o.hidden_at, o.state from own o where o.hidden_at is not null
      union all
      select 'paused', o.id, o.title, o.updated_at, o.state from own o where o.state = 'paused'
    )
  select case when exists (select 1 from shop) and (select private.owns_shop((select id from shop))) then jsonb_build_object(
    'replies', jsonb_build_object(
      'count', (select count(*) from waiting),
      'oldest', (
        select jsonb_build_object('id', w.id, 'title', w.title, 'at', w.at, 'state', null)
        from waiting w order by w.at, w.id limit 1
      )
    ),
    'sales', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('conversation_id', s.conversation_id, 'listing_id', s.listing_id, 'title', s.title, 'at', s.at)
          order by s.at, s.conversation_id
        )
        from sales s
      ),
      '[]'::jsonb
    ),
    'drafts', jsonb_build_object(
      'count', (select count(*) from listed x where x.kind = 'drafts'),
      'oldest', (
        select jsonb_build_object('id', x.id, 'title', x.title, 'at', x.at, 'state', x.state)
        from listed x where x.kind = 'drafts' order by x.at, x.id limit 1
      )
    ),
    'hidden', jsonb_build_object(
      'count', (select count(*) from listed x where x.kind = 'hidden'),
      'oldest', (
        select jsonb_build_object('id', x.id, 'title', x.title, 'at', x.at, 'state', x.state)
        from listed x where x.kind = 'hidden' order by x.at, x.id limit 1
      )
    ),
    'paused', jsonb_build_object(
      'count', (select count(*) from listed x where x.kind = 'paused'),
      'oldest', (
        select jsonb_build_object('id', x.id, 'title', x.title, 'at', x.at, 'state', x.state)
        from listed x where x.kind = 'paused' order by x.at, x.id limit 1
      )
    ),
    'listings', jsonb_build_object(
      'available', (select count(*) from own o where o.state = 'available'),
      'paused', (select count(*) from own o where o.state = 'paused'),
      'sold', (select count(*) from own o where o.state = 'sold'),
      'drafts', (select count(*) from own o where o.state = 'draft')
    ),
    'ever_replied', exists (select 1 from talks t where not t.is_offer and t.first_reply_at is not null)
  ) end;
$$;

-- How many follow the shop, and how many of those follows were made since p_since and still stand (followerCounts,
-- lib/data/follows.ts; the seller home's "+N new this week"). For its owner only: 0 and 0 for anyone else. Never who.
-- A user action (advisor 0029 lists it on purpose).
create function public.follower_counts(p_shop uuid, p_since timestamptz)
returns table (total int, recent int)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int, (count(*) filter (where f.created_at >= p_since))::int
  from public.follows f
  where f.shop_id = p_shop and (select private.owns_shop(p_shop));
$$;

revoke all on function public.seller_queue(text), public.follower_counts(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.seller_queue(text), public.follower_counts(uuid, timestamptz) to authenticated, service_role;

-- --- hide_listing, replaced (from 20261021120500_own_target_gate.sql) ---------------------------------------------

-- As before, and the hide sets updated_at (plan decision 3), as hide_request does.
-- Returns 'changed' | 'nothing' (no such listing, or hidden already) | 'no-open-report' | 'own-shop' | 'forbidden' (admin). A
-- missing, long or unclean reason raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.hide_listing(p_listing text, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  listing public.listings;
  owner uuid;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop((select l.shop_id from public.listings l where l.id = p_listing)) then
    return 'own-shop';
  end if;
  perform private.check_reason(p_reason);
  perform 1 from public.listings l where l.id = p_listing and l.hidden_at is null for update;
  if not found then
    return 'nothing';
  end if;
  if not exists (
    select 1 from public.reports r
    where r.target_kind = 'listing' and r.target_id = p_listing and r.status = 'open' and not r.target_gone
  ) then
    return 'no-open-report';
  end if;
  update public.listings l
  set hidden_at = now(), hidden_reason = p_reason, updated_at = now()
  where l.id = p_listing and l.hidden_at is null
  returning l.* into listing;
  if listing.id is null then
    return 'nothing';
  end if;
  owner := (select s.owner_id from public.shops s where s.id = listing.shop_id);
  perform private.close_reports('listing', array[listing.id], 'hidden', p_reason);
  perform private.record_audit('listing-hidden', 'listing', listing.id, listing.title, p_reason, owner);
  perform private.notify(
    owner, 'shop-update', listing.id, private.listing_hidden_note_text(listing.title),
    private.my_listings_path(listing.state)
  );
  return 'changed';
end;
$$;

-- --- show_listing, replaced (from 20261021120500_own_target_gate.sql) ---------------------------------------------

-- As before, and Show again sets updated_at (plan decision 3), as show_request does.
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.show_listing(p_listing text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  listing public.listings;
  owner uuid;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop((select l.shop_id from public.listings l where l.id = p_listing)) then
    return 'own-shop';
  end if;
  update public.listings l
  set hidden_at = null, hidden_reason = null, updated_at = now()
  where l.id = p_listing and l.hidden_at is not null
  returning l.* into listing;
  if listing.id is null then
    return 'nothing';
  end if;
  owner := (select s.owner_id from public.shops s where s.id = listing.shop_id);
  perform private.record_audit('listing-shown', 'listing', listing.id, listing.title, '', owner);
  perform private.notify(
    owner, 'shop-update', listing.id, private.listing_shown_note_text(listing.title),
    private.my_listings_path(listing.state)
  );
  return 'changed';
end;
$$;
