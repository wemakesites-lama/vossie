-- Read-only views for phase C's public reads (supabase step 2b plan, Task 8, decision 13; amendment 6).
--
-- anon can't read seller_profiles, a request's asker or a post's RSVPs, so on its own it can't tell an open shop from
-- one its seller paused, count a request's offers or an event's places taken without one call per row. Three views
-- give those reads in one query per page of rows:
-- - storefronts: a public shop's status, 'approved' or 'paused' by its seller (shopStatus and hasStorefront,
--   lib/data/catalog.ts; liveSellerRows and toListing's "paused" need it). The status comes from
--   private.storefront_status, which anon and signed-in readers execute (the private schema stays closed to them, so
--   only through the view);
-- - request_cards: the public request columns with the closing day and the offer count (toRequest,
--   lib/data/requests.ts; request_offer_count), for the board, the homepage and the sitemap;
-- - hub_cards: published posts with how many are going now (hub_going; hub-posts.ts).
-- Each is security_invoker, so the tables' policies and column grants still apply; none shows who asked (asker_id),
-- who wrote a post (author_id), a shop's owner or followers, a mentor's note, a report's owner (target_owner_id) or a
-- reminder's mark (reminded_for). Hidden requests, drafts and shops without a storefront have no row, even for the
-- people the tables' policies let read them (an asker, an owner, staff): those read their own views.

-- --- storefronts ------------------------------------------------------------------------------------------------------

-- A public shop's status (shopStatus, lib/data/catalog.ts): 'approved' or 'paused' (by its seller); null for any shop
-- without a storefront (private.shop_is_public: not the Hub's pause, not waiting). What a storefront shows anyway.
create function private.storefront_status(shop uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.shop_is_public(shop) then private.shop_status(shop) end;
$$;
-- The views are security_invoker, so their readers run it.
revoke all on function private.storefront_status(uuid) from public, anon, authenticated;
grant execute on function private.storefront_status(uuid) to anon, authenticated, service_role;

create view public.storefronts
with (security_invoker = true)
as
select s.id as shop_id, s.slug, private.storefront_status(s.id) as status
from public.shops s
where private.shop_is_public(s.id);

-- --- request_cards ----------------------------------------------------------------------------------------------------

-- Every request the Hub hasn't hidden, open or closed (publicRequest, lib/data/requests.ts), with its closing day (null
-- for a sample) and its offers. The readers filter open ones by today (requestOpenOn).
create view public.request_cards
with (security_invoker = true)
as
select
  r.id, r.title, r.category_slug, r.campus_slug, r.details, r.budget_zar, r.swap_welcome, r.needed_by, r.status,
  r.created_at, r.updated_at, r.closed_at, r.closes_on, public.request_offer_count(r.id) as offers
from public.requests r
where r.hidden_at is null;

-- --- hub_cards --------------------------------------------------------------------------------------------------------

-- Published posts (listPosts, lib/data/hub-posts.ts) with how many are going now: an event's going plus its RSVPs,
-- null for tips and office hours (their going is null).
create view public.hub_cards
with (security_invoker = true)
as
select
  p.id, p.kind, p.title, p.summary, p.place, p.body, p.campus_slug, p.starts_at, p.capacity, p.going,
  public.hub_going(p.id) as going_now, p.image_src, p.image_alt, p.cover_photo_id, p.published_at, p.created_at
from public.hub_posts p
where p.published;

-- --- Grants -----------------------------------------------------------------------------------------------------------

revoke all on table public.storefronts, public.request_cards, public.hub_cards
from public, anon, authenticated, service_role;
grant select on table public.storefronts, public.request_cards, public.hub_cards to anon, authenticated, service_role;
