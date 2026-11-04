-- AI stage B: the listing check's reports (AI features spec 3.4; plan 2026-11-04-ai-stage-b-listing-check.md, Task 6).
-- file_listing_check_report files one open report with no reporter account about the caller's own live listing, in the
-- words checkReportDetail writes; no student can read it; closing it tells no one.
begin;
select plan(14);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.a(n), 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('lc-campus', 'Check campus', 'Gauteng', 97);
insert into public.categories (slug, name, sort) values ('lc-category', 'Check category', 98);
-- e1 Lerato sells; e2 Thandi is a student; e3 Adam is an admin.
insert into auth.users (id, email)
select pg_temp.a(n), 'lc-' || n || '@eduvos.com' from unnest(array['e1', 'e2', 'e3']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('e1'), 'Lerato', 'lc-campus', '{}'),
  (pg_temp.a('e2'), 'Thandi', 'lc-campus', '{}'),
  (pg_temp.a('e3'), 'Adam', 'lc-campus', '{admin}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('e1'), 'lc-lerato', pg_temp.a('e1'), 'Lerato watches', 'lc-category', 'lc-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at) values
  (pg_temp.a('e1'), 'approved', pg_temp.s('e1'), now() - interval '9 days', now() - interval '8 days');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('lc-l1', pg_temp.s('e1'), 'available', 'item', 'Designer watch', 'lc-category', 'good', 300, 'cash', 'A watch.', 'online', 'lc-campus', now()),
  ('lc-l2', pg_temp.s('e1'), 'draft', 'item', 'Another watch', 'lc-category', 'good', 300, 'cash', 'A watch.', 'online', 'lc-campus', null),
  ('lc-l3', pg_temp.s('e1'), 'paused', 'item', 'Paused watch', 'lc-category', 'good', 300, 'cash', 'A watch.', 'online', 'lc-campus', now());
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at, hidden_at, hidden_reason) values
  ('lc-l4', pg_temp.s('e1'), 'available', 'item', 'Hidden watch', 'lc-category', 'good', 300, 'cash', 'A watch.', 'online', 'lc-campus', now(), now(), 'Hidden by the Hub');

select pg_temp.sign_in('e1');
select is(public.file_listing_check_report('lc-l1', 'counterfeit'), 'filed', 'the seller files the check''s report');
select is(public.file_listing_check_report('lc-l1', 'stolen'), 'already-open', 'one open report per listing');
select is(public.file_listing_check_report('lc-l2', 'stolen'), 'not-found', 'never about a draft');
select is(public.file_listing_check_report('lc-l4', 'stolen'), 'not-found', 'nor a listing the Hub has hidden');
-- A paused listing stays paused on a save, and Resume would put it live unchecked (final review, fix 2).
select is(public.file_listing_check_report('lc-l3', 'stolen'), 'filed', 'a paused listing saved anyway is reported');
select throws_ok(
  $$ select public.file_listing_check_report('lc-l1', 'none') $$, '22023', null, 'the concern is one of the seven'
);
select pg_temp.sign_out();

select is(
  (select count(*)::int from public.reports where target_id = 'lc-l1'), 1, 'one row'
);
select is(
  (select reporter_id from public.reports where target_id = 'lc-l1'), null::uuid, 'with no reporter account'
);
select is(
  (select detail from public.reports where target_id = 'lc-l1'),
  'The listing check thought this may be counterfeit goods. The seller published it anyway.',
  'in checkReportDetail''s words'
);
select is(
  (select array[reason, target_owner_id::text] from public.reports where target_id = 'lc-l1'),
  array['prohibited', pg_temp.a('e1')::text],
  'prohibited, and whose listing it is'
);

select pg_temp.sign_in('e2');
select is(public.file_listing_check_report('lc-l1', 'stolen'), 'not-found', 'never about another account''s listing');
select is((select count(*)::int from public.reports where target_id = 'lc-l1'), 0, 'and a student can''t read it');
select pg_temp.sign_out();

-- private.close_reports is the owner's to call: set the admin's claims without switching role, as 28's pg_temp.own does.
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.a('e3'), 'role', 'authenticated')::text, true);
-- 'hidden' is one of the outcomes reports.outcome allows ('acted' is only the notification's wording: final review, fix 1).
select private.close_reports('listing', array['lc-l1'], 'hidden', 'Hidden');
select set_config('request.jwt.claims', '', true);
select is(
  (select count(*)::int from public.notifications where kind = 'report-handled' and subject_id = (
    select id::text from public.reports where target_id = 'lc-l1'
  )),
  0,
  'closing it tells no one'
);

-- The index holds only open reports: once it's closed, a new check can file again.
select pg_temp.sign_in('e1');
select is(public.file_listing_check_report('lc-l1', 'stolen'), 'filed', 'a closed report leaves room for a new one');
select pg_temp.sign_out();

select * from finish();
rollback;
