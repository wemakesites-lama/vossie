-- Schema catch-up, Task 1: phase A's tables widened for stages G to J (supabase schema catch-up plan; lib/types.ts,
-- lib/data/rows.ts, lib/data/shops.ts, lib/data/staff-shops.ts, lib/data/notifications.ts, lib/staff/rules.ts).
begin;
select plan(111);

create function pg_temp.sign_in(account uuid) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', account, 'role', 'authenticated', 'session_id', '50000000-0000-4000-8000-0000000000d1')::text,
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
create temp table results (k text primary key, v jsonb);
grant all on results to public;
create function pg_temp.r(k text) returns jsonb language sql as $f$
  select v from results where results.k = r.k;
$f$;

-- Places.
insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
insert into public.pickup_points (id, campus_slug, name) values
  ('20000000-0000-4000-8000-0000000000d1', 'test-campus', 'Library entrance');
insert into public.pickup_points (id, campus_slug, name, retired_at) values
  ('20000000-0000-4000-8000-0000000000d2', 'test-campus', 'Old gate', now());

-- People: Sipho with an approved shop (d1), Naledi who paused her own (d2), Thabo whom the Hub paused while he had
-- paused too (d3), a student who reports (d4), an admin (d5), a mentor (d6), Lerato with a pending shop (d7), Zola with
-- another approved shop (d8), and a second reporter (d9).
insert into auth.users (id, email)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'widen' || n || '@eduvos.com'
from unnest(array['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9']) n;
insert into public.profiles (id, first_name, campus_slug, roles)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'User ' || n, 'test-campus',
  case n when 'd5' then array['admin'] when 'd6' then array['mentor'] else '{}'::text[] end
from unnest(array['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9']) n;
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  ('10000000-0000-4000-8000-0000000000d1', 'widen-shop', '00000000-0000-4000-8000-0000000000d1', 'Widen shop', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-0000000000d2', 'widen-paused', '00000000-0000-4000-8000-0000000000d2', 'Widen paused', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-0000000000d3', 'widen-staff', '00000000-0000-4000-8000-0000000000d3', 'Widen staff', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-0000000000d7', 'widen-pending', '00000000-0000-4000-8000-0000000000d7', 'Widen pending', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-0000000000d8', 'widen-other', '00000000-0000-4000-8000-0000000000d8', 'Widen other', 'test-category', 'test-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, paused_by, seller_paused_too, staff_reason, approved_at) values
  ('00000000-0000-4000-8000-0000000000d1', 'approved', '10000000-0000-4000-8000-0000000000d1', null, false, null, '2026-03-01T08:00:00Z'),
  ('00000000-0000-4000-8000-0000000000d2', 'paused', '10000000-0000-4000-8000-0000000000d2', 'seller', false, null, '2026-03-01T08:00:00Z'),
  ('00000000-0000-4000-8000-0000000000d3', 'paused', '10000000-0000-4000-8000-0000000000d3', 'staff', true, 'Please check your prices.', '2026-03-01T08:00:00Z'),
  ('00000000-0000-4000-8000-0000000000d7', 'pending', '10000000-0000-4000-8000-0000000000d7', null, false, null, null),
  ('00000000-0000-4000-8000-0000000000d8', 'approved', '10000000-0000-4000-8000-0000000000d8', null, false, null, null);
insert into public.shop_pickup_points (shop_id, pickup_point_id)
select s, '20000000-0000-4000-8000-0000000000d1'::uuid
from unnest(array['10000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-0000000000d7', '10000000-0000-4000-8000-0000000000d8']::uuid[]) s;

-- The new columns.
select has_column('public', 'notifications', 'count', 'notifications have a count');
select has_column('public', 'reports', 'target_gone', 'reports know when their target has gone');
select has_column('public', 'listings', 'hidden_reason', 'listings have a hidden reason');
select has_column('public', 'seller_profiles', 'mentor_id', 'seller profiles have a mentor');
select has_column('public', 'form_states', 'taken', 'form states can be taken');
select has_table('public', 'shop_previous_slugs', 'shops'' old links have a table');

-- --- notifications ---------------------------------------------------------------------------------------------------

-- Every kind the app makes (NotificationKind, lib/types.ts:330).
insert into public.notifications (account_id, kind, subject_id, text, href)
select '00000000-0000-4000-8000-0000000000d4', k, 'subject-' || k, 'Something happened.', '/messages'
from unnest(array[
  'message', 'sale-to-confirm', 'report-handled', 'shop-approved', 'shop-update', 'booking', 'offer', 'request-update',
  'new-listing', 'search-match', 'staff-role'
]) k;
select is(
  (select count(*) from public.notifications where account_id = '00000000-0000-4000-8000-0000000000d4'),
  11::bigint,
  'the app''s 11 kinds are all allowed'
);
select throws_ok(
  $$insert into public.notifications (account_id, kind, subject_id, text, href) values ('00000000-0000-4000-8000-0000000000d4', 'party', 'x', 'Hi.', '/')$$,
  '23514', null, 'and nothing else'
);
select throws_ok(
  $$insert into public.notifications (account_id, kind, subject_id, text, href, count) values ('00000000-0000-4000-8000-0000000000d4', 'new-listing', 'x0', 'Hi.', '/', 0)$$,
  '23514', null, 'a count is at least one'
);
select is(
  (select count from public.notifications where kind = 'new-listing' and account_id = '00000000-0000-4000-8000-0000000000d4'),
  null::int,
  'and null means one (NotificationRow.count)'
);

-- One a SAST day per account, kind and subject for the once-a-day kinds (notifyOncePerDay, notifications.ts:182).
insert into public.notifications (account_id, kind, subject_id, text, href, created_at) values
  ('00000000-0000-4000-8000-0000000000d4', 'search-match', 'ss-day', 'A match.', '/browse', '2026-10-19T21:59:59Z'),
  ('00000000-0000-4000-8000-0000000000d4', 'search-match', 'ss-day', 'A match.', '/browse', '2026-10-19T22:00:00Z');
select is(
  (select count(*) from public.notifications where subject_id = 'ss-day'),
  2::bigint,
  '21:59:59 and 22:00 UTC are two SAST days'
);
select throws_ok(
  $$insert into public.notifications (account_id, kind, subject_id, text, href, created_at) values ('00000000-0000-4000-8000-0000000000d4', 'search-match', 'ss-day', 'Another.', '/browse', '2026-10-19T08:00:00Z')$$,
  '23505', null, 'a second on the same SAST day clashes'
);
select lives_ok(
  $$insert into public.notifications (account_id, kind, subject_id, text, href, created_at) values ('00000000-0000-4000-8000-0000000000d9', 'search-match', 'ss-day', 'A match.', '/browse', '2026-10-19T08:00:00Z')$$,
  'another account has its own'
);
select lives_ok(
  $$insert into public.notifications (account_id, kind, subject_id, text, href) values ('00000000-0000-4000-8000-0000000000d4', 'offer', 'subject-offer', 'Again.', '/messages')$$,
  'other kinds are not once a day'
);
-- notify_once_per_day (Task 6) is one insert … on conflict … do update on that index.
create function pg_temp.once(at timestamptz) returns void language sql as $f$
  insert into public.notifications as n (account_id, kind, subject_id, text, href, created_at)
  values ('00000000-0000-4000-8000-0000000000d4', 'new-listing', 'widen-shop', 'One new listing.', '/sellers/widen-shop', at)
  on conflict (account_id, kind, subject_id, private.sast_day(created_at)) where kind in ('new-listing', 'search-match')
  do update set count = coalesce(n.count, 1) + 1, text = 'More new listings.', created_at = excluded.created_at;
$f$;
select pg_temp.once('2026-10-20T06:00:00Z');
select pg_temp.once('2026-10-20T07:00:00Z');
select is(
  (select row(count, text, created_at)::text from public.notifications where subject_id = 'widen-shop'),
  row(2, 'More new listings.', '2026-10-20T07:00:00Z'::timestamptz)::text,
  'the same day''s second counts up and moves to the newer time'
);

-- --- reports ---------------------------------------------------------------------------------------------------------

insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason) values
  ('60000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d4', 'seller', 'widen-shop', 'Widen shop', 'spam'),
  ('60000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d9', 'seller', 'widen-shop', 'Widen shop', 'scam'),
  ('60000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000d4', 'listing', 'w-shown', 'Lamp', 'other');
select is(
  (select bool_and(not target_gone and outcome is null and note is null and closed_at is null and closed_by is null)
   from public.reports where id::text like '60000000-%'),
  true,
  'a new report is open, with nothing closed about it, and its target there'
);
select throws_ok(
  $$update public.reports set status = 'closed' where id = '60000000-0000-4000-8000-0000000000d3'$$,
  '23514', null, 'a closed report has an outcome and a time'
);
select throws_ok(
  $$update public.reports set status = 'closed', outcome = 'dismissed' where id = '60000000-0000-4000-8000-0000000000d3'$$,
  '23514', null, 'both'
);
select throws_ok(
  $$update public.reports set outcome = 'dismissed', closed_at = now() where id = '60000000-0000-4000-8000-0000000000d3'$$,
  '23514', null, 'and an open one has neither'
);
select throws_ok(
  $$update public.reports set status = 'closed', outcome = 'ignored', closed_at = now() where id = '60000000-0000-4000-8000-0000000000d3'$$,
  '23514', null, 'an outcome is dismissed, hidden or paused (ReportOutcome)'
);
select throws_ok(
  $$update public.reports set note = 'Too soon.' where id = '60000000-0000-4000-8000-0000000000d3'$$,
  '23514', null, 'an open report has no note yet'
);
select throws_ok(
  $$update public.reports set status = 'closed', outcome = 'dismissed', closed_at = now(), note = repeat('a', 501) where id = '60000000-0000-4000-8000-0000000000d3'$$,
  '23514', null, 'a note is at most 500 characters (REASON_MAX)'
);
select throws_ok(
  $$update public.reports set status = 'closed', outcome = 'dismissed', closed_at = now(), note = E'No‮thanks' where id = '60000000-0000-4000-8000-0000000000d3'$$,
  '23514', null, 'and clean text'
);
select lives_ok(
  $$update public.reports set status = 'closed', outcome = 'dismissed', closed_at = now(), closed_by = '00000000-0000-4000-8000-0000000000d5', note = E'Checked:\nall fine.' where id = '60000000-0000-4000-8000-0000000000d3'$$,
  'a dismissal with its note, its time and who closed it'
);

-- A reporter reads their report's outcome, never the staff-only note or who closed it (lib/staff/rules.ts:31).
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d4');
select is(
  (select row(status, outcome, closed_at is not null, target_gone)::text from public.reports where id = '60000000-0000-4000-8000-0000000000d3'),
  row('closed', 'dismissed', true, false)::text,
  'the reporter reads the outcome'
);
select throws_ok($$select note from public.reports$$, '42501', null, 'not the note');
select throws_ok($$select closed_by from public.reports$$, '42501', null, 'nor who closed it');
select throws_ok($$select * from public.reports$$, '42501', null, 'so a reporter names the columns they read');
select pg_temp.sign_out();
select ok(
  has_column_privilege('service_role', 'public.reports', 'note', 'select')
  and has_column_privilege('service_role', 'public.reports', 'closed_by', 'update'),
  'the service role still has every column'
);
select ok(
  not has_column_privilege('anon', 'public.reports', 'outcome', 'select'),
  'anon still has none'
);
delete from public.profiles where id = '00000000-0000-4000-8000-0000000000d5';
select is(
  (select row(closed_by, status)::text from public.reports where id = '60000000-0000-4000-8000-0000000000d3'),
  row(null::uuid, 'closed')::text,
  'a deleted staff member''s closures stay, without them'
);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d5', 'widend5@eduvos.com')
on conflict (id) do nothing;
insert into public.profiles (id, first_name, campus_slug, roles) values ('00000000-0000-4000-8000-0000000000d5', 'User d5', 'test-campus', array['admin']);

-- --- listings --------------------------------------------------------------------------------------------------------

insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('w-shown', '10000000-0000-4000-8000-0000000000d1', 'available', 'item', 'Lamp', 'test-category', 'good', 100, 'cash', 'A lamp.', 'online', 'test-campus', now()),
  ('w-hidden', '10000000-0000-4000-8000-0000000000d1', 'available', 'item', 'Fake watch', 'test-category', 'good', 100, 'cash', 'A watch.', 'online', 'test-campus', now());
insert into public.listing_photos (listing_id, placeholder_src, position) values
  ('w-shown', '/placeholders/photo/1.svg', 0), ('w-hidden', '/placeholders/photo/2.svg', 0);
select throws_ok(
  $$update public.listings set hidden_at = now() where id = 'w-hidden'$$,
  '23514', null, 'a hidden listing has its reason'
);
select throws_ok(
  $$update public.listings set hidden_reason = 'Fake.' where id = 'w-hidden'$$,
  '23514', null, 'and a reason means hidden'
);
select throws_ok(
  $$update public.listings set hidden_at = now(), hidden_reason = repeat('a', 501) where id = 'w-hidden'$$,
  '23514', null, 'a reason is at most 500 characters (REASON_MAX)'
);
select lives_ok(
  $$update public.listings set hidden_at = now(), hidden_reason = E'Counterfeit goods\nare not allowed.' where id = 'w-hidden'$$,
  'the Hub hides a listing with its reason'
);
set local role anon;
select is(
  array(select id from public.listings where id like 'w-%' order by id),
  array['w-shown'],
  'anon no longer sees a hidden listing (catalog.ts:118)'
);
select is(
  array(select listing_id from public.listing_photos where listing_id like 'w-%' order by 1),
  array['w-shown'],
  'nor its photos'
);
reset role;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d4');
select is(
  array(select id from public.listings where id like 'w-%' order by id),
  array['w-shown'],
  'neither does a signed-in student'
);
select is(
  array(select listing_id from public.listing_photos where listing_id like 'w-%' order by 1),
  array['w-shown'],
  'nor its photos'
);
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d1');
select is(
  (select hidden_reason from public.listings where id = 'w-hidden'),
  E'Counterfeit goods\nare not allowed.',
  'the owner still reads it and why (own-listings.ts:75)'
);
select is(
  array(select listing_id from public.listing_photos where listing_id like 'w-%' order by 1),
  array['w-hidden', 'w-shown'],
  'and its photos'
);
select pg_temp.sign_out();

-- --- seller_profiles -------------------------------------------------------------------------------------------------

select throws_ok(
  $$update public.seller_profiles set status = 'paused' where account_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'a paused shop says who paused it'
);
select throws_ok(
  $$update public.seller_profiles set paused_by = 'seller' where account_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'and only a paused one'
);
select throws_ok(
  $$update public.seller_profiles set status = 'paused', paused_by = 'admin' where account_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'the seller or staff'
);
select throws_ok(
  $$update public.seller_profiles set seller_paused_too = true where account_id = '00000000-0000-4000-8000-0000000000d2'$$,
  '23514', null, 'the seller''s pause is kept under a staff pause only (amendment 13.3)'
);
select throws_ok(
  $$update public.seller_profiles set declined_at = now() where account_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'only a waiting shop is declined'
);
select lives_ok(
  $$update public.seller_profiles set declined_at = now(), staff_reason = 'Add a photo, please.' where account_id = '00000000-0000-4000-8000-0000000000d7'$$,
  'a waiting shop is declined with a reason'
);
select throws_ok(
  $$update public.seller_profiles set staff_reason = repeat('a', 501) where account_id = '00000000-0000-4000-8000-0000000000d7'$$,
  '23514', null, 'a reason is at most 500 characters (REASON_MAX)'
);
select throws_ok(
  $$update public.seller_profiles set mentor_id = account_id where account_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'nobody mentors their own shop (staff-shops.ts:228)'
);
select lives_ok(
  $$update public.seller_profiles set mentor_id = '00000000-0000-4000-8000-0000000000d6' where account_id = '00000000-0000-4000-8000-0000000000d1'$$,
  'a mentor is assigned'
);
select throws_ok(
  $$update public.seller_profiles set mentor_id = '00000000-0000-4000-8000-0000000000ff' where account_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23503', null, 'a mentor is an account'
);

-- approved_at is set once (approveShop, staff-shops.ts:134) and kept through pauses and resumes.
select throws_ok(
  $$update public.seller_profiles set approved_at = now() where account_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'the first approval''s time never changes'
);
select throws_ok(
  $$update public.seller_profiles set approved_at = null where account_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'and is never cleared'
);
select lives_ok(
  $$update public.seller_profiles set approved_at = '2026-04-01T08:00:00Z' where account_id = '00000000-0000-4000-8000-0000000000d8'$$,
  'it is set when there is none'
);
select lives_ok(
  $$update public.seller_profiles set status = 'paused', paused_by = 'staff', staff_reason = 'Checking.' where account_id = '00000000-0000-4000-8000-0000000000d8'$$,
  'other changes leave it alone'
);
select is(
  (select approved_at from public.seller_profiles where account_id = '00000000-0000-4000-8000-0000000000d8'),
  '2026-04-01T08:00:00Z'::timestamptz,
  'kept'
);
update public.seller_profiles set status = 'approved', paused_by = null, staff_reason = null where account_id = '00000000-0000-4000-8000-0000000000d8';

-- The owner reads their decline, the Hub's reason and who paused, never their mentor (plan, Task 1).
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d7');
select is(
  (select row(status, declined_at is not null, staff_reason)::text from public.seller_profiles),
  row('pending', true, 'Add a photo, please.')::text,
  'a declined seller reads why'
);
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d3');
select is(
  (select row(status, paused_by, seller_paused_too, approved_at)::text from public.seller_profiles),
  row('paused', 'staff', true, '2026-03-01T08:00:00Z'::timestamptz)::text,
  'a seller reads who paused their shop'
);
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d1');
select throws_ok($$select mentor_id from public.seller_profiles$$, '42501', null, 'never who mentors them');
select pg_temp.sign_out();
select ok(
  not has_column_privilege('authenticated', 'public.seller_profiles', 'mentor_id', 'select')
  and has_column_privilege('authenticated', 'public.seller_profiles', 'staff_reason', 'select')
  and has_column_privilege('service_role', 'public.seller_profiles', 'mentor_id', 'select'),
  'mentor_id is left out of the owner''s column grant only'
);
delete from public.profiles where id = '00000000-0000-4000-8000-0000000000d6';
select is(
  (select mentor_id from public.seller_profiles where account_id = '00000000-0000-4000-8000-0000000000d1'),
  null::uuid,
  'a deleted mentor leaves the shop without one'
);

-- set_shop_paused (setShopPaused, shops.ts:218): the seller's own pause is marked theirs, and a staff pause isn't
-- theirs to lift.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d2');
select is(public.set_shop_paused(false), 'approved', 'a seller resumes their own pause');
select pg_temp.sign_out();
select is(
  (select row(status, paused_by)::text from public.seller_profiles where account_id = '00000000-0000-4000-8000-0000000000d2'),
  row('approved', null::text)::text,
  'and nobody has paused it now'
);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d2');
select is(public.set_shop_paused(true), 'paused', 'and pauses again');
select pg_temp.sign_out();
select is(
  (select row(status, paused_by)::text from public.seller_profiles where account_id = '00000000-0000-4000-8000-0000000000d2'),
  row('paused', 'seller')::text,
  'as the seller'
);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d3');
select is(public.set_shop_paused(false), 'not-allowed', 'a seller cannot lift the Hub''s pause (shops.ts:221)');
select is(public.set_shop_paused(true), 'not-allowed', 'nor pause it again');
select pg_temp.sign_out();
select is(
  (select row(status, paused_by, seller_paused_too)::text from public.seller_profiles where account_id = '00000000-0000-4000-8000-0000000000d3'),
  row('paused', 'staff', true)::text,
  'the Hub''s pause stands'
);

-- --- form_states -----------------------------------------------------------------------------------------------------

select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d4');
insert into public.form_states (session_id, form, account_id, expires_at)
values ('50000000-0000-4000-8000-0000000000d1', 'staff-once:widen', '00000000-0000-4000-8000-0000000000d4', now() + interval '1 hour');
select is((select taken from public.form_states where form = 'staff-once:widen'), false, 'a new form state is not taken');
-- Task 5 (review fix I1) replaced the column grant with triggers: taken is set, never cleared.
update public.form_states set taken = true where form = 'staff-once:widen';
update public.form_states set taken = false where form = 'staff-once:widen';
select is(
  (select taken from public.form_states where form = 'staff-once:widen'), true,
  'a person cannot clear their own token (lib/staff/once.ts)'
);
select lives_ok(
  $$update public.form_states set notice = 'post-saved' where form = 'staff-once:widen'$$,
  'and still updates the rest of their form state'
);
select pg_temp.sign_out();
select ok(
  (select count(*) from pg_trigger where tgrelid = 'public.form_states'::regclass and not tgisinternal
     and tgname in ('form_states_keep_taken', 'form_states_keep_taken_rows')) = 2
  and has_column_privilege('authenticated', 'public.form_states', 'values', 'update')
  and has_column_privilege('service_role', 'public.form_states', 'taken', 'update'),
  'taken is kept by triggers, not by authenticated''s update grant (Task 5)'
);

-- --- photos (plan decision 6) ----------------------------------------------------------------------------------------

select lives_ok(
  $$insert into public.photos (id, owner_id, use, type, path) values ('30000000-0000-4000-8000-0000000000d1', null, 'hub-draft', 'image/webp', 'hub/30000000-0000-4000-8000-0000000000d1')$$,
  'a Hub cover waiting for its form has no owner, at hub/<id>'
);
select lives_ok(
  $$insert into public.photos (id, owner_id, use, type, path) values ('30000000-0000-4000-8000-0000000000d2', null, 'post:h-001', 'image/jpeg', 'hub/30000000-0000-4000-8000-0000000000d2')$$,
  'and neither has one on a post'
);
select throws_ok(
  $$insert into public.photos (id, owner_id, use, type, path) values ('30000000-0000-4000-8000-0000000000d3', null, null, 'image/webp', 'hub/30000000-0000-4000-8000-0000000000d3')$$,
  '23514', null, 'an ownerless photo is a Hub photo'
);
select throws_ok(
  $$insert into public.photos (id, owner_id, use, type, path) values ('30000000-0000-4000-8000-0000000000d4', null, 'draft', 'image/webp', 'hub/30000000-0000-4000-8000-0000000000d4')$$,
  '23514', null, 'not a wizard''s draft'
);
select throws_ok(
  $$insert into public.photos (id, owner_id, use, type, path) values ('30000000-0000-4000-8000-0000000000d5', null, 'hub-draft', 'image/webp', 'other/30000000-0000-4000-8000-0000000000d5')$$,
  '23514', null, 'a Hub photo is stored at hub/<id>'
);
select throws_ok(
  $$insert into public.photos (id, owner_id, use, type, path) values ('30000000-0000-4000-8000-0000000000d6', '00000000-0000-4000-8000-0000000000d4', 'hub-draft', 'image/webp', '00000000-0000-4000-8000-0000000000d4/30000000-0000-4000-8000-0000000000d6')$$,
  '23514', null, 'a student''s photo is never a Hub cover'
);
select throws_ok(
  $$insert into public.photos (id, owner_id, use, type, path) values ('30000000-0000-4000-8000-0000000000d7', '00000000-0000-4000-8000-0000000000d4', 'post:h-001', 'image/webp', '00000000-0000-4000-8000-0000000000d4/30000000-0000-4000-8000-0000000000d7')$$,
  '23514', null, 'nor on a post'
);
select throws_ok(
  $$insert into public.photos (id, owner_id, use, type, path) values ('30000000-0000-4000-8000-0000000000d8', '00000000-0000-4000-8000-0000000000d4', null, 'image/webp', 'hub/30000000-0000-4000-8000-0000000000d8')$$,
  '23514', null, 'and is stored under its owner'
);
select throws_ok(
  $$insert into public.photos (id, owner_id, use, type, path) values ('30000000-0000-4000-8000-0000000000d9', null, 'post:Not a post', 'image/webp', 'hub/30000000-0000-4000-8000-0000000000d9')$$,
  '23514', null, 'a post''s use names a post id'
);
select lives_ok(
  $$insert into public.photos (id, owner_id, use, type, path) values ('30000000-0000-4000-8000-0000000000da', '00000000-0000-4000-8000-0000000000d4', null, 'image/webp', '00000000-0000-4000-8000-0000000000d4/30000000-0000-4000-8000-0000000000da')$$,
  'a student''s waiting photo is as before'
);
-- C2/C3 plan decision 14 (20261022120100_c2_photos.sql): Hub staff read the Hub's photo rows; a student still doesn't.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d4');
select is((select count(*) from public.photos where owner_id is null), 0::bigint, 'a student reads no Hub photo rows through the API');
select pg_temp.sign_out();
delete from public.profiles where id = '00000000-0000-4000-8000-0000000000d5';
select is(
  (select count(*) from public.photos where path like 'hub/%'),
  2::bigint,
  'deleting a staff account leaves the Hub''s photos'
);

-- --- pickup_points ---------------------------------------------------------------------------------------------------

set local role anon;
select is(
  array(select name from public.pickup_points where campus_slug = 'test-campus' order by name),
  array['Library entrance', 'Old gate'],
  'anyone reads retired points too, for a listing''s page (pickup-points.ts:29)'
);
select is(
  array(select name from public.pickup_points where campus_slug = 'test-campus' and retired_at is null order by name),
  array['Library entrance'],
  'live points are the ones not retired'
);
reset role;

-- --- shop_previous_slugs (plan decision 7) ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.shop_previous_slugs'::regclass),
  'old links have row level security on'
);
set local role anon;
select throws_ok($$select * from public.shop_previous_slugs$$, '42501', null, 'anon cannot read old links');
reset role;
set local role authenticated;
select throws_ok($$select * from public.shop_previous_slugs$$, '42501', null, 'nor can authenticated');
select throws_ok(
  $$insert into public.shop_previous_slugs (slug, shop_id) values ('mine-now', '10000000-0000-4000-8000-0000000000d1')$$,
  '42501', null, 'nor take one'
);
reset role;
select ok(has_table_privilege('service_role', 'public.shop_previous_slugs', 'insert'), 'the service role can');
select throws_ok(
  $$insert into public.shop_previous_slugs (slug, shop_id) values ('Bad Link', '10000000-0000-4000-8000-0000000000d1')$$,
  '23514', null, 'an old link has a link''s shape'
);

-- The one change of link records the old one (changeShopSlug, shops.ts:199), and reports follow the shop unless the
-- shop they were about has gone (shops.ts:87).
update public.reports set target_gone = true where id = '60000000-0000-4000-8000-0000000000d2';
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d1');
select is(public.change_shop_slug('widen-new'), 'changed', 'Sipho changes his link');
select pg_temp.sign_out();
select is(
  array(select slug || ':' || shop_id from public.shop_previous_slugs where shop_id = '10000000-0000-4000-8000-0000000000d1'),
  array['widen-shop:10000000-0000-4000-8000-0000000000d1'],
  'the old link is kept, reserved'
);
select is(
  (select target_id from public.reports where id = '60000000-0000-4000-8000-0000000000d1'),
  'widen-new',
  'a report about the shop follows it'
);
select is(
  (select target_id from public.reports where id = '60000000-0000-4000-8000-0000000000d2'),
  'widen-shop',
  'one about a shop that has gone stays where it was'
);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d8');
select is(public.change_shop_slug('widen-shop'), 'taken', 'another shop cannot take an old link (amendment 13.7)');
select is(
  public.update_shop('Widen other', '', 'test-category', '', 'test-campus', array['20000000-0000-4000-8000-0000000000d1']::uuid[], null, false, 'widen-shop'),
  '{"result": "slug-taken"}'::jsonb,
  'nor through Edit shop'
);
select is(
  public.update_shop('Widen other', '', 'test-category', '', 'test-campus', array['20000000-0000-4000-8000-0000000000d1']::uuid[], null, false, 'widen-eight') ->> 'slug',
  'widen-eight',
  'Edit shop''s change of link'
);
select pg_temp.sign_out();
select is(
  (select shop_id from public.shop_previous_slugs where slug = 'widen-other'),
  '10000000-0000-4000-8000-0000000000d8'::uuid,
  'records the old link too'
);
select is(private.free_shop_slug('widen-shop', null), 'widen-shop-2', 'a free link skips old links');
select is(
  private.free_shop_slug('widen-shop', '10000000-0000-4000-8000-0000000000d1'),
  'widen-shop-2',
  'even the shop''s own old one'
);
select is(
  private.free_shop_slug('widen-new', '10000000-0000-4000-8000-0000000000d1'),
  'widen-new',
  'its current one is its own'
);

-- A waiting shop's link follows its name (plan decision 16): it skips old links, and keeps none of its own. Reports
-- about it follow it, but not one about a shop that had the link before and has gone.
insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason, target_gone) values
  ('60000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000d4', 'seller', 'widen-pending', 'Widen pending', 'spam', false),
  ('60000000-0000-4000-8000-0000000000d5', '00000000-0000-4000-8000-0000000000d9', 'seller', 'widen-pending', 'An older shop', 'spam', true);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000d7');
select is(
  public.update_shop('Widen shop ß', '', 'test-category', '', 'test-campus', array['20000000-0000-4000-8000-0000000000d1']::uuid[], null, false, null) ->> 'slug',
  'widen-shop-2',
  'a waiting shop named like an old link gets the next free one'
);
select pg_temp.sign_out();
select is(
  (select count(*) from public.shop_previous_slugs where slug = 'widen-pending' or shop_id = '10000000-0000-4000-8000-0000000000d7'),
  0::bigint,
  'and its earlier link is not reserved'
);
select is(
  array(select id::text || ':' || target_id from public.reports where id in ('60000000-0000-4000-8000-0000000000d4', '60000000-0000-4000-8000-0000000000d5') order by id),
  array['60000000-0000-4000-8000-0000000000d4:widen-shop-2', '60000000-0000-4000-8000-0000000000d5:widen-pending'],
  'its reports follow it, a gone shop''s stay'
);

-- A deleted shop's old links free up with it (plan decision 7).
delete from public.shops where id = '10000000-0000-4000-8000-0000000000d8';
select is((select count(*) from public.shop_previous_slugs where slug = 'widen-other'), 0::bigint, 'a deleted shop''s old links go');
select is(private.free_shop_slug('widen-other', null), 'widen-other', 'and are free again');

-- --- Grants ----------------------------------------------------------------------------------------------------------

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname in ('shop_slug_in_use', 'shop_link_moved', 'keep_approved_at')),
  3::bigint,
  'the new helpers exist'
);
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname in ('shop_slug_in_use', 'shop_link_moved', 'keep_approved_at')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  0::bigint,
  'and no API role runs them'
);
select ok(
  has_function_privilege('authenticated', 'public.set_shop_paused(boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.change_shop_slug(text)', 'execute')
  and has_function_privilege('authenticated', 'public.update_shop(text,text,text,text,text,uuid[],uuid,boolean,text)', 'execute')
  and not has_function_privilege('anon', 'public.set_shop_paused(boolean)', 'execute'),
  'the replaced user actions keep their grants'
);

select * from finish();
rollback;
