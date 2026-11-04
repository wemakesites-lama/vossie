-- AI stage C: a read of each report (AI features spec 4; plan 2026-11-05-ai-stage-c-report-read.md, Task 3).
-- reports.first_read is staff's: no reporter reads it, only the service role writes it (save_report_first_read, once,
-- on a student's report), its shape is checked, admins see it in staff_reports, and deleting the reported thing's
-- owner strips it.
begin;
select plan(17);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.r(n text) returns uuid language sql immutable as $f$
  select ('20000000-0000-4000-8000-0000000000' || n)::uuid;
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
create function pg_temp.as_service() returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
end;
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('rr-campus', 'Read campus', 'Gauteng', 97);
insert into public.categories (slug, name, sort) values ('rr-category', 'Read category', 98);
-- f1 Lerato sells; f2 Thandi is a student who reports; f3 Adam is an admin.
insert into auth.users (id, email)
select pg_temp.a(n), 'rr-' || n || '@eduvos.com' from unnest(array['f1', 'f2', 'f3']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('f1'), 'Lerato', 'rr-campus', '{}'),
  (pg_temp.a('f2'), 'Thandi', 'rr-campus', '{}'),
  (pg_temp.a('f3'), 'Adam', 'rr-campus', '{admin}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('f1'), 'rr-lerato', pg_temp.a('f1'), 'Lerato watches', 'rr-category', 'rr-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at) values
  (pg_temp.a('f1'), 'approved', pg_temp.s('f1'), now() - interval '9 days', now() - interval '8 days');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('rr-l1', pg_temp.s('f1'), 'available', 'item', 'Fake watch', 'rr-category', 'good', 300, 'cash', 'A watch.', 'online', 'rr-campus', now());
-- a1 Thandi's report; a2 the listing check's (no reporter account).
insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason, detail, target_owner_id) values
  (pg_temp.r('a1'), pg_temp.a('f2'), 'listing', 'rr-l1', 'Fake watch', 'prohibited', 'Looks fake', pg_temp.a('f1')),
  (pg_temp.r('a2'), null, 'listing', 'rr-l1', 'Fake watch', 'prohibited', 'The listing check thought so.', pg_temp.a('f1'));

select has_column('public', 'reports', 'first_read', 'reports has first_read');
select ok(not has_column_privilege('authenticated', 'public.reports', 'first_read', 'select'), 'no signed-in reader selects it');
select ok(
  not has_function_privilege('authenticated', 'public.save_report_first_read(uuid, jsonb)', 'execute'),
  'nobody signed in saves a read'
);
select ok(
  has_function_privilege('service_role', 'public.save_report_first_read(uuid, jsonb)', 'execute'),
  'the service role does'
);

select pg_temp.as_service();
select is(
  public.save_report_first_read(pg_temp.r('a1'), '{"summary": "A watch sold as a Rolex.", "concern": "counterfeit", "agrees": true}'),
  'saved', 'a read is saved on a student''s report'
);
select is(
  public.save_report_first_read(pg_temp.r('a1'), '{"summary": "Another read.", "concern": "none", "agrees": false}'),
  'already', 'once'
);
select is(
  public.save_report_first_read(gen_random_uuid(), '{"summary": "A read.", "concern": "none", "agrees": false}'),
  'not-found', 'not on a report that isn''t there'
);
select is(
  public.save_report_first_read(pg_temp.r('a2'), '{"summary": "A read.", "concern": "none", "agrees": false}'),
  'not-found', 'nor on the listing check''s'
);
select pg_temp.sign_out();

select is(
  (select first_read ->> 'summary' from public.reports where id = pg_temp.r('a1')),
  'A watch sold as a Rolex.', 'the first read stays'
);
select throws_ok(
  format($$ update public.reports set first_read = '{"summary": "%s", "concern": "none", "agrees": true}' where id = %L $$,
    repeat('x', 141), pg_temp.r('a2')),
  '23514', null, 'a summary longer than 140 characters is refused'
);
select throws_ok(
  format($$ update public.reports set first_read = '{"summary": "x", "concern": "rude", "agrees": true}' where id = %L $$,
    pg_temp.r('a2')),
  '23514', null, 'so is an unknown concern'
);
select throws_ok(
  format($$ update public.reports set first_read = '{"summary": "x", "concern": "none", "agrees": true, "name": "Lerato"}' where id = %L $$,
    pg_temp.r('a2')),
  '23514', null, 'and an extra key'
);

select pg_temp.sign_in('f3');
select is(
  (select first_read ->> 'concern' from public.staff_reports where id = pg_temp.r('a1')),
  'counterfeit', 'an admin sees the read in staff_reports'
);
select pg_temp.sign_out();

select pg_temp.sign_in('f2');
select is(
  (select count(*)::int from public.staff_reports where id = pg_temp.r('a1')), 0, 'the reporter sees no staff row'
);
select throws_ok(
  format($$ select first_read from public.reports where id = %L $$, pg_temp.r('a1')),
  '42501', null, 'nor the column on their own report'
);
select pg_temp.sign_out();

-- Deleting the listing's owner sets target_owner_id null (on delete set null), and the read goes with it.
delete from public.profiles where id = pg_temp.a('f1');
select is(
  (select first_read from public.reports where id = pg_temp.r('a1')), null::jsonb, 'deleting the owner strips the read'
);
select is(
  (select detail from public.reports where id = pg_temp.r('a1')), 'Looks fake', 'and keeps the report'
);

select * from finish();
rollback;
