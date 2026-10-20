-- The admin's raw weekly counts (supabase schema catch-up plan, Task 7; stage J spec decisions 10 to 13, section 8):
-- public.admin_weekly_counts, which phase C reads in place of countByWeek's loop over the sample store
-- (lib/data/numbers.ts). It returns raw counts only: the small-number rule (protectCounts, lib/staff/numbers.ts:190)
-- stays in TypeScript, so it applies however the counts are made.
--
-- - Server only (service_role; Lama's decision on Task 7's open question). Phase C calls it with the admin client only
--   after requireStaff('admin') (lib/staff/access.ts), which reads the role on every request, and passes the result
--   straight through protectCounts before anything reaches the page. No API role (anon or authenticated) can execute
--   it, so raw small counts never reach an API caller, an admin's own session included (CLAUDE.md: private counts
--   only through protectCounts). With no session to check, the function has no role gate of its own.
-- - Weeks are sastWeeks (lib/staff/numbers.ts:100): Monday 00:00 to Monday 00:00 in South Africa (Sunday 22:00 UTC),
--   start included, end not. "last" is the last complete week, "before" the one before it, and "since" everything
--   before last week's end. This week is never counted: p_now is taken as now() when it's later, so asking about the
--   future can't make the current week a "last" one.
-- - Each thing counts once, at its moment and on its campus (countByWeek and tally, numbers.ts:34-109):
--     listings        first_published_at, hidden or not, on the listing's own campus;
--     shops           the owner's seller_profiles.approved_at (its first approval, kept through pauses), or created_at
--                     for a sample shop no account owns, on the shop's campus;
--     requests        created_at, hidden or closed or not;
--     enquiries       conversations that aren't offers (is_offer, which a deleted request doesn't clear, where the
--                     app reads requestId, which it never clears either), on the shop's campus, gone when the seller
--                     has gone or the shop has;
--     reports-made    created_at, and reports-closed closed_at (closed ones only), on the campus of the listing, shop
--                     (by its link, as reportCampus reads sellers by slug) or request it's about, gone when
--                     target_gone or the target has gone;
--     follows         created_at, on the shop's campus.
--   Things deleted since aren't in the database, so they aren't counted, as in the sample store.
-- - A campus that has gone is null (the app's `gone`, which only totals use). The app's known campuses are the
--   fixtures' 13 (KNOWN, numbers.ts:22), which the campuses table holds; every campus column is a foreign key to it,
--   so null comes only from a gone target, seller or shop.
-- - Open shops now (plan decision 12, numbers.ts:102): a shop whose status is approved (liveSellerRows: an approved
--   seller profile, or no owner) with a listing that's available and not hidden (listedListings), on the shop's
--   campus. A paused shop isn't open, whether its seller or the Hub paused it: this is liveSellerRows, not Task 6b's
--   storefront rule (hasStorefront), which keeps a seller-paused shop's storefront. An owned shop whose seller
--   profile has gone counts as waiting (shopStatus), so it isn't open.
-- - Saved searches are never read (stage J spec decision 10).
--
-- The shape, for phase C to turn into RawCounts (lib/staff/numbers.ts:49):
--   (measure text, period text, campus_slug text, count bigint), one row per non-zero count:
--     measure      one of the app's Measure keys ('listings', 'shops', 'requests', 'enquiries', 'reports-made',
--                  'reports-closed', 'follows') with period 'last', 'before' or 'since'; or 'open-shops' with period
--                  'now', its only period.
--     campus_slug  the campus, or null for a campus that has gone.
--   RawCounts.counts[measure][period] is { campuses: { [campus_slug]: count }, gone: count where campus_slug is null },
--   and RawCounts.openShops the same from the 'open-shops' rows. A missing row is 0, as an absent key is in the app.
--   The week bounds and labels stay sastWeeks(now) in TypeScript, from the same now passed here as p_now.

create function public.admin_weekly_counts(p_now timestamptz default now())
returns table (measure text, period text, campus_slug text, count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with
  -- This week's Monday 00:00 in South Africa, and the two weeks before it (sastWeeks). Worked out on the South African
  -- wall clock and turned back into UTC, so the server's timezone can't move it.
  monday as (
    select pg_catalog.date_trunc('week', least(p_now, pg_catalog.now()) at time zone 'Africa/Johannesburg')
      as this_week
  ),
  weeks as (
    select
      (m.this_week - interval '14 days') at time zone 'Africa/Johannesburg' as before_start,
      (m.this_week - interval '7 days') at time zone 'Africa/Johannesburg' as last_start,
      m.this_week at time zone 'Africa/Johannesburg' as last_end
    from monday m
  ),
  -- Each thing that happened: what it is, when, and on which campus (null once that has gone).
  happened (measure, at, campus) as (
    select 'listings', l.first_published_at, l.campus_slug
    from public.listings l
    union all
    select 'shops', case when s.owner_id is null then s.created_at else sp.approved_at end, s.campus_slug
    from public.shops s
    left join public.seller_profiles sp on sp.account_id = s.owner_id
    union all
    select 'requests', r.created_at, r.campus_slug
    from public.requests r
    union all
    select 'enquiries', c.created_at, case when not c.seller_gone then s.campus_slug end
    from public.conversations c
    left join public.shops s on s.id = c.shop_id
    where not c.is_offer
    union all
    select x.measure, x.at, rc.campus
    from public.reports r
    cross join lateral (
      select case
        when r.target_gone then null
        when r.target_kind = 'listing' then (select l.campus_slug from public.listings l where l.id = r.target_id)
        when r.target_kind = 'seller' then (select s.campus_slug from public.shops s where s.slug = r.target_id)
        when r.target_kind = 'request' then (select q.campus_slug from public.requests q where q.id = r.target_id)
      end as campus
    ) rc
    cross join lateral (
      values ('reports-made', r.created_at), ('reports-closed', case when r.status = 'closed' then r.closed_at end)
    ) x (measure, at)
    union all
    select 'follows', f.created_at, s.campus_slug
    from public.follows f
    join public.shops s on s.id = f.shop_id
  )
  select h.measure, p.period, c.slug, pg_catalog.count(*)
  from happened h
  cross join weeks w
  cross join lateral (
    values
      ('since', h.at < w.last_end),
      ('last', h.at >= w.last_start and h.at < w.last_end),
      ('before', h.at >= w.before_start and h.at < w.last_start)
  ) p (period, inside)
  left join public.campuses c on c.slug = h.campus
  where p.inside
  group by h.measure, p.period, c.slug
  union all
  select 'open-shops', 'now', c.slug, pg_catalog.count(*)
  from public.shops s
  left join public.seller_profiles sp on sp.account_id = s.owner_id
  left join public.campuses c on c.slug = s.campus_slug
  where (s.owner_id is null or sp.status = 'approved')
    and exists (
      select 1 from public.listings l where l.shop_id = s.id and l.state = 'available' and l.hidden_at is null
    )
  group by c.slug;
$$;

-- The server's only: the admin client, after requireStaff('admin'). Never anon or authenticated.
revoke all on function public.admin_weekly_counts(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_weekly_counts(timestamptz) to service_role;
