-- Schema catch-up, Task 7: the admin's raw weekly counts (countByWeek, lib/data/numbers.ts; sastWeeks and the periods,
-- lib/staff/numbers.ts). Each thing counts once, at its moment and on its campus, in the SAST week it falls in
-- (Monday 00:00 SAST, Sunday 22:00 UTC, start included, end not); Since the start is everything before last week's
-- end; this week is never counted; a campus that has gone is null. Open shops is a snapshot. Saved searches never.
-- The server's only (service_role): phase C calls it with the admin client after requireStaff('admin') and passes the
-- result through protectCounts, so no API role, an admin's session included, ever runs it.
--
-- The counts are fixed at p_now = Wednesday 2024-10-16 10:00 UTC, before anything the seed holds (its earliest moment
-- is 2025-01-01), so every week row and every gone row below is this file's. Open shops is a snapshot of everything,
-- the seed's shops too, so it is read only for this file's campuses.
--   this week   from 2024-10-13 22:00:00 UTC (Monday 14 Oct 00:00 SAST): never counted
--   last        2024-10-06 22:00:00 to 2024-10-13 21:59:59 UTC
--   before      2024-09-29 22:00:00 to 2024-10-06 21:59:59 UTC
--   since       everything before 2024-10-13 22:00:00 UTC
-- The moments used:
--   A 2024-10-13 21:59:59  last (Sunday 23:59:59 SAST)     B 2024-10-13 22:00:00  this week (Monday 00:00 SAST)
--   C 2024-10-06 22:00:00  last (its first second)          D 2024-10-06 21:59:59  before (its last second)
--   E 2024-09-29 22:00:00  before (its first second)        F 2024-09-29 21:59:59  since only
--   G 2024-01-01 00:00:00  since only
begin;
select plan(26);

-- Accounts and shops by their last two characters; a signed-in session per account.
create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.c(n text) returns uuid language sql immutable as $f$
  select ('60000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.at(k text) returns timestamptz language sql immutable as $f$
  select case k
    when 'A' then '2024-10-13T21:59:59Z' when 'B' then '2024-10-13T22:00:00Z'
    when 'C' then '2024-10-06T22:00:00Z' when 'D' then '2024-10-06T21:59:59Z'
    when 'E' then '2024-09-29T22:00:00Z' when 'F' then '2024-09-29T21:59:59Z'
    when 'G' then '2024-01-01T00:00:00Z'
  end::timestamptz;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', pg_temp.a(n), 'role', 'authenticated', 'session_id', ('50000000-0000-4000-8000-0000000000' || n)::uuid
    )::text,
    true
  );
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;
-- One measure's rows as "period campus count", gone as "(gone)", on this file's campuses and the gone one.
create function pg_temp.rows(m text, p_now timestamptz default '2024-10-16T10:00:00Z') returns text[] language sql as $f$
  select coalesce(
    array_agg(
      r.period || ' ' || coalesce(r.campus_slug, '(gone)') || ' ' || r.count
      order by (r.period || ' ' || coalesce(r.campus_slug, '(gone)')) collate "C"
    ),
    '{}'
  )
  from public.admin_weekly_counts(p_now) r
  where r.measure = m and (r.campus_slug is null or r.campus_slug like 'nb-%');
$f$;
grant execute on all functions in schema pg_temp to public;

-- Places.
insert into public.campuses (slug, name, region, sort) values
  ('nb-north', 'North campus', 'Gauteng', 97), ('nb-south', 'South campus', 'Gauteng', 98),
  ('nb-east', 'East campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('nb-category', 'Numbers category', 99);

-- People:
-- e1 Ama, an admin;          e2 Cebo, a student who writes, asks, reports, follows and saves a search;
-- e3 Dumi, a mentor;         e4 Enhle, a student who reports and follows;
-- f1 to f7 own shops nb-s1 to nb-s7 (nb-s2 is a sample stall no account owns).
insert into auth.users (id, email)
select pg_temp.a(n), 'nb-' || n || '@eduvos.com'
from unnest(array['e1', 'e2', 'e3', 'e4', 'f1', 'f3', 'f4', 'f5', 'f6', 'f7']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('e1'), 'Ama', 'nb-north', '{admin}'), (pg_temp.a('e2'), 'Cebo', 'nb-north', '{}'),
  (pg_temp.a('e3'), 'Dumi', 'nb-north', '{mentor}'), (pg_temp.a('e4'), 'Enhle', 'nb-north', '{}'),
  (pg_temp.a('f1'), 'Fikile', 'nb-north', '{}'), (pg_temp.a('f3'), 'Gugu', 'nb-north', '{}'),
  (pg_temp.a('f4'), 'Hlengiwe', 'nb-north', '{}'), (pg_temp.a('f5'), 'Itu', 'nb-north', '{}'),
  (pg_temp.a('f6'), 'Jabu', 'nb-north', '{}'), (pg_temp.a('f7'), 'Khanyi', 'nb-north', '{}');

-- Shops, each with its first approval (approved_at), or its createdAt for the stall no account owns:
--   nb-s1 approved at A, north: open (an available listing)  -> shops last north
--   nb-s2 the stall, created at E, south: open                -> shops before south
--   nb-s3 paused by its seller, approved at D, north          -> shops before north; not open (paused)
--   nb-s4 approved at B, north; its only available listing is hidden, the other sold: not open; this week
--   nb-s5 waiting for approval, north: never approved, not open
--   nb-s6 paused by the Hub, approved at F, north             -> shops since north; not open
--   nb-s7 owned, its seller profile gone, north: not counted, not open
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since, created_at)
select pg_temp.s(n), 'nb-s' || right(n, 1), o, 'Numbers shop ' || n, 'nb-category', campus, '2024-01', created
from (values
  ('f1', pg_temp.a('f1'), 'nb-north', pg_temp.at('G')),
  ('f2', null::uuid, 'nb-south', pg_temp.at('E')),
  ('f3', pg_temp.a('f3'), 'nb-north', pg_temp.at('G')),
  ('f4', pg_temp.a('f4'), 'nb-north', pg_temp.at('G')),
  ('f5', pg_temp.a('f5'), 'nb-north', pg_temp.at('G')),
  ('f6', pg_temp.a('f6'), 'nb-north', pg_temp.at('G')),
  ('f7', pg_temp.a('f7'), 'nb-north', pg_temp.at('G'))
) v(n, o, campus, created);
insert into public.seller_profiles (account_id, status, shop_id, applied_at, paused_by, staff_reason, approved_at) values
  (pg_temp.a('f1'), 'approved', pg_temp.s('f1'), pg_temp.at('G'), null, null, pg_temp.at('A')),
  (pg_temp.a('f3'), 'paused', pg_temp.s('f3'), pg_temp.at('G'), 'seller', null, pg_temp.at('D')),
  (pg_temp.a('f4'), 'approved', pg_temp.s('f4'), pg_temp.at('G'), null, null, pg_temp.at('B')),
  (pg_temp.a('f5'), 'pending', pg_temp.s('f5'), pg_temp.at('G'), null, null, null),
  (pg_temp.a('f6'), 'paused', pg_temp.s('f6'), pg_temp.at('G'), 'staff', 'Checking.', pg_temp.at('F'));

-- Listings, by first publish, hidden or not, on the listing's own campus:
--   nb-la A north (nb-s1)   nb-lb B north: this week   nb-lc C south (nb-s1's, on another campus)
--   nb-ld D north, hidden   nb-le E north              nb-lf F north   nb-lg a draft, never published
--   every other shop's listing was first published at B, this week, so only open shops reads it.
create function pg_temp.listing(id text, shop text, state text, campus text, published timestamptz, hidden boolean default false)
returns void language sql as $f$
  insert into public.listings (
    id, shop_id, state, kind, title, category_slug, price_zar, pay_mode, description, handover, campus_slug,
    first_published_at, hidden_at, hidden_reason
  ) values (
    id, pg_temp.s(shop), state, 'service', 'Listing ' || id, 'nb-category', 100, 'cash', 'A test listing.', 'online',
    campus, published, case when hidden then published end, case when hidden then 'Hidden for a test.' end
  );
$f$;
select pg_temp.listing('nb-la', 'f1', 'available', 'nb-north', pg_temp.at('A'));
select pg_temp.listing('nb-lb', 'f1', 'available', 'nb-north', pg_temp.at('B'));
select pg_temp.listing('nb-lc', 'f1', 'sold', 'nb-south', pg_temp.at('C'));
select pg_temp.listing('nb-ld', 'f1', 'available', 'nb-north', pg_temp.at('D'), true);
select pg_temp.listing('nb-le', 'f1', 'paused', 'nb-north', pg_temp.at('E'));
select pg_temp.listing('nb-lf', 'f1', 'sold', 'nb-north', pg_temp.at('F'));
select pg_temp.listing('nb-lg', 'f1', 'draft', 'nb-north', null);
select pg_temp.listing('nb-l2', 'f2', 'available', 'nb-south', pg_temp.at('B'));
select pg_temp.listing('nb-l3', 'f3', 'available', 'nb-north', pg_temp.at('B'));
select pg_temp.listing('nb-l4', 'f4', 'available', 'nb-north', pg_temp.at('B'), true);
select pg_temp.listing('nb-l4b', 'f4', 'sold', 'nb-north', pg_temp.at('B'));
select pg_temp.listing('nb-l5', 'f5', 'available', 'nb-north', pg_temp.at('B'));
select pg_temp.listing('nb-l6', 'f6', 'available', 'nb-north', pg_temp.at('B'));
select pg_temp.listing('nb-l7', 'f7', 'available', 'nb-north', pg_temp.at('B'));
-- nb-s7's seller profile has gone (the shop is then a waiting one, catalog.ts:19).
-- (It never had one here: an owned shop with no profile.)

-- Requests, by when they were posted, hidden or closed or not:
--   nb-r1 A north   nb-r2 C south, hidden   nb-r3 B north: this week   nb-r4 D north, closed   nb-r5 G north
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, status, created_at, closed_at, hidden_at, hidden_reason)
values
  ('nb-r1', pg_temp.a('e2'), 'Need a calculator', 'nb-category', 'nb-north', 'Looking for a scientific calculator.', 'open', pg_temp.at('A'), null, null, null),
  ('nb-r2', pg_temp.a('e2'), 'Need a textbook', 'nb-category', 'nb-south', 'Looking for the first year textbook.', 'open', pg_temp.at('C'), null, pg_temp.at('C'), 'Hidden for a test.'),
  ('nb-r3', pg_temp.a('e2'), 'Need a lamp', 'nb-category', 'nb-north', 'Looking for a desk lamp for my room.', 'open', pg_temp.at('B'), null, null, null),
  ('nb-r4', pg_temp.a('e2'), 'Need a kettle', 'nb-category', 'nb-north', 'Looking for a small kettle for res.', 'closed', pg_temp.at('D'), pg_temp.at('D'), null, null),
  ('nb-r5', null, 'Need a tutor', 'nb-category', 'nb-north', 'Looking for a maths tutor this term.', 'open', pg_temp.at('G'), null, null, null);

-- Conversations: enquiries are every one that isn't an offer, on the shop's campus, gone when the seller has gone or
-- the shop has:
--   c1 about nb-la, A, north    c2 a question to nb-s1, C, north    c3 an offer on nb-r1, A: not an enquiry
--   c4 an offer whose request was deleted (request_id null, still is_offer), C: not an enquiry
--   c5 about nb-ld, its seller gone, D: gone    c6 its shop deleted (shop_id null), E: gone
--   c7 a question to nb-s2, F, south: since only   c8 about nb-le, B: this week
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, seller_gone, status, is_offer, request_id, request_title, created_at, last_message_at)
values
  (pg_temp.c('c1'), 'nb-la', 'Listing nb-la', pg_temp.s('f1'), pg_temp.a('e2'), false, 'asked', false, null, null, pg_temp.at('A'), pg_temp.at('A')),
  (pg_temp.c('c2'), null, null, pg_temp.s('f1'), pg_temp.a('e2'), false, 'asked', false, null, null, pg_temp.at('C'), pg_temp.at('C')),
  (pg_temp.c('c3'), null, null, pg_temp.s('f1'), pg_temp.a('e2'), false, 'offered', true, 'nb-r1', 'Need a calculator', pg_temp.at('A'), pg_temp.at('A')),
  (pg_temp.c('c4'), null, null, pg_temp.s('f1'), pg_temp.a('e2'), false, 'offered', true, null, 'Need a bicycle', pg_temp.at('C'), pg_temp.at('C')),
  (pg_temp.c('c5'), 'nb-ld', 'Listing nb-ld', pg_temp.s('f1'), pg_temp.a('e2'), true, 'asked', false, null, null, pg_temp.at('D'), pg_temp.at('D')),
  (pg_temp.c('c6'), null, 'Listing gone', null, pg_temp.a('e2'), false, 'asked', false, null, null, pg_temp.at('E'), pg_temp.at('E')),
  (pg_temp.c('c7'), null, null, pg_temp.s('f2'), pg_temp.a('e2'), false, 'asked', false, null, null, pg_temp.at('F'), pg_temp.at('F')),
  (pg_temp.c('c8'), 'nb-le', 'Listing nb-le', pg_temp.s('f1'), pg_temp.a('e2'), false, 'asked', false, null, null, pg_temp.at('B'), pg_temp.at('B'));

-- Reports, made at created_at and closed at closed_at, on the target's campus as it is now, gone when target_gone or
-- the target has gone:
--   p1 nb-la (north), made A, open                  p2 nb-lc (south), made C, closed A
--   p3 the shop nb-s1 (north), made D, closed B     p4 the request nb-r2 (south, hidden), made E, closed C
--   p5 nb-s1's link but target_gone (a deleted shop; a new one took the link), made A, closed D: gone
--   p6 a deleted listing, made F, open: gone        p7 nb-r1, made B: this week
insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, status, outcome, created_at, closed_at, target_gone)
values
  (pg_temp.a('e2'), 'listing', 'nb-la', 'Listing nb-la', 'scam', 'open', null, pg_temp.at('A'), null, false),
  (pg_temp.a('e2'), 'listing', 'nb-lc', 'Listing nb-lc', 'scam', 'closed', 'dismissed', pg_temp.at('C'), pg_temp.at('A'), false),
  (pg_temp.a('e3'), 'seller', 'nb-s1', 'Numbers shop f1', 'spam', 'closed', 'paused', pg_temp.at('D'), pg_temp.at('B'), false),
  (pg_temp.a('e2'), 'request', 'nb-r2', 'Need a textbook', 'spam', 'closed', 'hidden', pg_temp.at('E'), pg_temp.at('C'), false),
  (pg_temp.a('e4'), 'seller', 'nb-s1', 'An old shop', 'scam', 'closed', 'dismissed', pg_temp.at('A'), pg_temp.at('D'), true),
  (pg_temp.a('e2'), 'listing', 'nb-missing', 'Listing gone', 'scam', 'open', null, pg_temp.at('F'), null, false),
  (pg_temp.a('e2'), 'request', 'nb-r1', 'Need a calculator', 'spam', 'open', null, pg_temp.at('B'), null, false);

-- Follows, on the shop's campus: Cebo follows nb-s1 at A; Dumi follows nb-s2 at D, and nb-s1 at G; Enhle nb-s1 at B.
insert into public.follows (account_id, shop_id, created_at) values
  (pg_temp.a('e2'), pg_temp.s('f1'), pg_temp.at('A')),
  (pg_temp.a('e3'), pg_temp.s('f2'), pg_temp.at('D')),
  (pg_temp.a('e3'), pg_temp.s('f1'), pg_temp.at('G')),
  (pg_temp.a('e4'), pg_temp.s('f1'), pg_temp.at('B'));

-- A saved search made last week: never counted (stage J spec decision 10).
insert into public.saved_searches (account_id, q, campus_slug, search_key, created_at)
values (pg_temp.a('e2'), 'calculator', 'nb-north', 'nb-calculator', pg_temp.at('A'));

-- --- The function -----------------------------------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.admin_weekly_counts(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_weekly_counts(timestamptz)', 'execute'),
  'no API role can run the admin''s counts, so raw small counts never reach an API caller'
);
select ok(
  has_function_privilege('service_role', 'public.admin_weekly_counts(timestamptz)', 'execute'),
  'the server can (the admin client, after requireStaff(''admin''))'
);
select is(
  (select row(p.provolatile, p.prosecdef, p.proconfig)::text from pg_proc p
   where p.oid = 'public.admin_weekly_counts(timestamptz)'::regprocedure),
  row('s'::"char", true, array['search_path=""'])::text,
  'it is stable, security definer, with an empty search path'
);
select ok(
  (select p.prosrc !~* 'saved_search' from pg_proc p where p.oid = 'public.admin_weekly_counts(timestamptz)'::regprocedure),
  'it never reads saved searches'
);

-- --- What the server gets -------------------------------------------------------------------------------------------

set local role service_role;

select is(
  pg_temp.rows('listings'),
  array['before nb-north 2', 'last nb-north 1', 'last nb-south 1', 'since nb-north 4', 'since nb-south 1'],
  'listings count at their first publish, hidden ones too, on the listing''s campus, edges included'
);
select is(
  pg_temp.rows('shops'),
  array['before nb-north 1', 'before nb-south 1', 'last nb-north 1', 'since nb-north 3', 'since nb-south 1'],
  'shops count at their first approval (paused ones too), a stall no account owns at its creation'
);
select is(
  pg_temp.rows('requests'),
  array['before nb-north 1', 'last nb-north 1', 'last nb-south 1', 'since nb-north 3', 'since nb-south 1'],
  'requests count when posted, hidden and closed ones too'
);
select is(
  pg_temp.rows('enquiries'),
  array['before (gone) 2', 'last nb-north 2', 'since (gone) 2', 'since nb-north 2', 'since nb-south 1'],
  'enquiries leave offers out (is_offer, even once the request has gone); a gone seller or shop is a gone campus'
);
select is(
  pg_temp.rows('reports-made'),
  array[
    'before nb-north 1', 'before nb-south 1', 'last (gone) 1', 'last nb-north 1', 'last nb-south 1',
    'since (gone) 2', 'since nb-north 2', 'since nb-south 2'
  ],
  'reports count when made, on their target''s campus, gone when target_gone or the target has gone'
);
select is(
  pg_temp.rows('reports-closed'),
  array['before (gone) 1', 'last nb-south 2', 'since (gone) 1', 'since nb-south 2'],
  'closed reports count when closed; one closed this week isn''t counted'
);
select is(
  pg_temp.rows('follows'),
  array['before nb-south 1', 'last nb-north 1', 'since nb-north 2', 'since nb-south 1'],
  'follows count when made, on the shop''s campus'
);
select is(
  pg_temp.rows('open-shops'),
  array['now nb-north 1', 'now nb-south 1'],
  'open shops now: approved (or no owner), not paused, with an available listing the Hub hasn''t hidden'
);
select is(
  array(select distinct r.measure collate "C" from public.admin_weekly_counts('2024-10-16T10:00:00Z') r order by 1),
  array['enquiries', 'follows', 'listings', 'open-shops', 'reports-closed', 'reports-made', 'requests', 'shops'],
  'the app''s seven measures and open shops, and nothing else (no saved searches)'
);
select is(
  array(select distinct r.period collate "C" from public.admin_weekly_counts('2024-10-16T10:00:00Z') r order by 1),
  array['before', 'last', 'now', 'since'],
  'three periods, and now for open shops only'
);
select is(
  (select count(*) from public.admin_weekly_counts('2024-10-16T10:00:00Z') r
   where (r.period = 'now') <> (r.measure = 'open-shops') or r.count < 1),
  0::bigint,
  'open shops only for now, and no zero rows'
);
select is(
  (select count(*) from public.admin_weekly_counts('2024-10-16T10:00:00Z') r
   where r.campus_slug is not null and not exists (select 1 from public.campuses c where c.slug = r.campus_slug)),
  0::bigint,
  'every campus named is a known one'
);

-- Week edges: the weeks turn at Monday 00:00 SAST, Sunday 22:00 UTC.
select is(
  pg_temp.rows('listings', '2024-10-13T21:59:59Z'),
  array['before nb-north 1', 'last nb-north 2', 'since nb-north 3'],
  'on Sunday at 23:59:59 SAST, last week is still 30 Sep to 6 Oct'
);
select is(
  pg_temp.rows('listings', '2024-10-13T22:00:00Z'),
  array['before nb-north 2', 'last nb-north 1', 'last nb-south 1', 'since nb-north 4', 'since nb-south 1'],
  'at Monday 00:00 SAST it becomes 7 to 13 Oct, and something published that second isn''t counted'
);
select is(
  pg_temp.rows('listings', '2024-10-07T10:00:00Z'),
  array['before nb-north 1', 'last nb-north 2', 'since nb-north 3'],
  'a Monday morning is in the week that began at midnight SAST'
);

-- This week is never counted, even when asked about the future: p_now is never later than now().
reset role;
select pg_temp.listing(
  'nb-now', 'f1', 'available', 'nb-east',
  date_trunc('week', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg'
);
select pg_temp.listing(
  'nb-prev', 'f1', 'available', 'nb-east',
  (date_trunc('week', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg') - interval '1 second'
);
set local role service_role;
select is(
  (select array_agg(r.period || ' ' || r.count order by r.period collate "C")
   from public.admin_weekly_counts(now() + interval '14 days') r
   where r.measure = 'listings' and r.campus_slug = 'nb-east'),
  array['last 1', 'since 1'],
  'a later p_now counts as now: this week''s first second isn''t counted, last week''s last second is'
);
select is(
  (select array_agg(r.period || ' ' || r.count order by r.period collate "C")
   from public.admin_weekly_counts() r
   where r.measure = 'listings' and r.campus_slug = 'nb-east'),
  array['last 1', 'since 1'],
  'p_now defaults to now()'
);

-- --- No API role can call it ---------------------------------------------------------------------------------------

reset role;
select pg_temp.sign_in('e2');
select throws_ok($$select * from public.admin_weekly_counts()$$, '42501', null, 'a student can''t call it');
select pg_temp.sign_in('e3');
select throws_ok($$select * from public.admin_weekly_counts()$$, '42501', null, 'nor a mentor');
select pg_temp.sign_in('e1');
select throws_ok(
  $$select * from public.admin_weekly_counts('2024-10-16T10:00:00Z')$$, '42501', null,
  'nor an admin with her own session: she sees the numbers only through the page''s protectCounts'
);
select pg_temp.sign_out();
set local role anon;
select throws_ok($$select * from public.admin_weekly_counts()$$, '42501', null, 'nor anon');
reset role;
set local role service_role;
select ok(
  (select count(*) from public.admin_weekly_counts('2024-10-16T10:00:00Z')) > 0,
  'the server, with no session, gets the counts: the role check is requireStaff(''admin'') before the call'
);
reset role;

select * from finish();
rollback;
