-- Task 9: reports (supabase foundation plan; lib/data/reports.ts and sendReport in lib/messaging/actions.ts, and
-- their tests): one open report per reporter and target, and at most 10 in any 24 hours.
begin;
select plan(35);

create function pg_temp.sign_in(account uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', account, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;

insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
insert into auth.users (id, email)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'user' || n || '@eduvos.com' from unnest(array['71', '72', '73', '74']) n;
insert into public.profiles (id, first_name, campus_slug)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'User ' || n, 'test-campus' from unnest(array['71', '72', '73']) n;
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  ('10000000-0000-4000-8000-000000000071', 'test-report-shop', '00000000-0000-4000-8000-000000000073', 'Report shop', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-000000000072', 'test-hidden-shop', null, 'Hidden shop', 'test-category', 'test-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id) values
  ('00000000-0000-4000-8000-000000000073', 'approved', '10000000-0000-4000-8000-000000000071');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('t-r1', '10000000-0000-4000-8000-000000000071', 'available', 'item', 'Calculator', 'test-category', 'good', 200, 'cash', 'A calculator.', 'online', 'test-campus', now()),
  ('t-r-draft', '10000000-0000-4000-8000-000000000071', 'draft', 'item', 'Draft', 'test-category', 'good', 200, 'cash', 'A draft.', 'online', 'test-campus', null);

select ok(not has_function_privilege('anon', 'public.create_report(text, text, text, text, text)', 'execute'), 'anon cannot report');
select ok(has_function_privilege('authenticated', 'public.create_report(text, text, text, text, text)', 'execute'), 'a signed-in user can');

-- A report (spec 3.4): the target's title comes from the database for listings and shops.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000071');
select is(public.create_report('listing', 't-r1', 'Made-up title', 'scam', 'Asked for a deposit.'), 'created', 'a report on a listing is made');
select pg_temp.sign_out();
select is(
  (select row(reporter_id, target_kind, target_id, target_title, reason, detail, status, created_at = now())::text
   from public.reports where target_id = 't-r1'),
  row('00000000-0000-4000-8000-000000000071'::uuid, 'listing', 't-r1', 'Calculator', 'scam', 'Asked for a deposit.', 'open', true)::text,
  'open, with the reporter, the target, its real title, the reason, the detail and the time'
);

select pg_temp.sign_in('00000000-0000-4000-8000-000000000071');
select is(public.create_report('listing', 't-r1', 'Calculator', 'spam', ''), 'already-open', 'a second report on the same target is not stored (plan decision 17)');
select is(public.create_report('seller', 'test-report-shop', 'x', 'misleading', ''), 'created', 'a report on a shop is made');
select is(public.create_report('request', 'r-001', 'Need a lift to Midrand', 'other', 'Odd.'), 'created', 'a report on a request keeps the title it was given');
-- A request's id and title come from the app until stage H (M2 of the phase A review): checked here all the same.
select is(public.create_report('request', 'R-001', 'Need a lift', 'other', ''), 'not-found', 'a request id has no capitals');
select is(public.create_report('request', 'r_001', 'Need a lift', 'other', ''), 'not-found', 'no underscores');
select is(public.create_report('request', 'r-001-', 'Need a lift', 'other', ''), 'not-found', 'no loose hyphen');
select is(public.create_report('request', repeat('r', 21), 'Need a lift', 'other', ''), 'not-found', 'and is at most 20 characters');
select is(public.create_report('request', null, 'Need a lift', 'other', ''), 'not-found', 'and is given');
select throws_ok(
  format($$select public.create_report('request', 'r-002', %L, 'other', '')$$, repeat('a', 71)),
  '22023', null, 'a request''s title is at most 70 characters'
);
select throws_ok($$select public.create_report('request', 'r-002', E'Need a\nlift', 'other', '')$$, '22023', null, 'one line');
select throws_ok($$select public.create_report('request', 'r-002', E'Need a lift\u202e', 'other', '')$$, '22023', null, 'clean');
select throws_ok($$select public.create_report('request', 'r-002', '  ', 'other', '')$$, '22023', null, 'and not empty');
select is(public.create_report('listing', 't-r-draft', 'Draft', 'scam', ''), 'not-found', 'a draft cannot be reported');
select is(public.create_report('listing', 'no-such', 'x', 'scam', ''), 'not-found', 'nor an unknown listing');
select is(public.create_report('seller', 'test-hidden-shop', 'x', 'scam', ''), 'created', 'an ownerless sample shop can be');
select is(public.create_report('seller', 'no-such-shop', 'x', 'scam', ''), 'not-found', 'an unknown shop cannot');
select throws_ok($$select public.create_report('listing', 't-r1', 'x', 'rude', '')$$, '23514', null, 'a report has one of the seven reasons');
select throws_ok($$select public.create_report('party', 't-r1', 'x', 'scam', '')$$, '22023', null, 'a report is about a listing, a shop or a request');
select throws_ok(
  format($$select public.create_report('seller', 'test-report-shop', 'x', 'scam', %L)$$, repeat('a', 501)),
  '23514', null, 'a report''s detail is at most 500 characters'
);
select pg_temp.sign_out();
select is(
  (select array_agg(target_title order by target_title) from public.reports where reporter_id = '00000000-0000-4000-8000-000000000071'),
  array['Calculator', 'Hidden shop', 'Need a lift to Midrand', 'Report shop'],
  'the reports hold their targets'' titles'
);

-- Closed, a target can be reported again.
update public.reports set status = 'closed' where target_id = 't-r1';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000071');
select is(public.create_report('listing', 't-r1', 'x', 'spam', ''), 'created', 'once the last report is closed, a new one is made');
select pg_temp.sign_out();

-- Ten in any 24 hours (plan decision 17). Eight earlier reports, nine hours to 23 hours 59 minutes ago, and one older.
insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, created_at)
select '00000000-0000-4000-8000-000000000072', 'request', 'r-old-' || g, 'Old', 'spam', now() - interval '25 hours'
from generate_series(1, 3) g;
insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, created_at)
select '00000000-0000-4000-8000-000000000072', 'request', 'r-' || g, 'Recent', 'spam', now() - interval '23 hours 59 minutes' + g * interval '1 hour'
from generate_series(1, 8) g;
select pg_temp.sign_in('00000000-0000-4000-8000-000000000072');
select is(public.create_report('listing', 't-r1', 'x', 'scam', ''), 'created', 'the 9th in a day is made');
select is(public.create_report('seller', 'test-report-shop', 'x', 'scam', ''), 'created', 'so is the 10th');
select is(public.create_report('request', 'r-11', 'x', 'scam', ''), 'rate-limited', 'the 11th is refused');
select is(public.create_report('listing', 't-r1', 'x', 'scam', ''), 'already-open', 'a repeat still says it is already reported');
select pg_temp.sign_out();
update public.reports set created_at = now() - interval '24 hours' where target_id = 'r-1' and reporter_id = '00000000-0000-4000-8000-000000000072';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000072');
select is(public.create_report('request', 'r-11', 'x', 'scam', ''), 'created', 'one falls out of the 24 hours, and there is room again');
select pg_temp.sign_out();
select is(
  (select count(*) from public.reports where reporter_id = '00000000-0000-4000-8000-000000000072' and created_at > now() - interval '24 hours'),
  10::bigint,
  'ten in the last 24 hours'
);

-- The table's own checks, for the admin client too.
select throws_ok(
  $$insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values ('00000000-0000-4000-8000-000000000071', 'request', 'bad id!', 'Title', 'spam')$$,
  '23514', null, 'a target id is shaped as ids and slugs are'
);
select throws_ok(
  format($$insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values ('00000000-0000-4000-8000-000000000071', 'request', 'r-009', %L, 'spam')$$, repeat('a', 71)),
  '23514', null, 'a target title is at most 70 characters'
);

-- No profile, no report.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000074');
select throws_ok($$select public.create_report('listing', 't-r1', 'x', 'scam', '')$$, '42501', null, 'an account without a profile cannot report');
select pg_temp.sign_out();

select is(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.create_report(text, text, text, text, text)'::regprocedure),
  true,
  'create_report is security definer with an empty search path'
);

select * from finish();
rollback;
