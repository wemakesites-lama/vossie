-- Step 2b, Task 9b: the step 2b review's fixes (20261021120800_review_fixes_2b.sql).
-- 1. private.report_own_kind takes only the report and answers for the signed-in account, and only for an admin: a
--    non-admin, even the target's owner, and a call with no session get null. The two-argument version is gone.
-- 2. forget_account locks the account's own profile for update before it clears the mentor of the seller profiles the
--    account mentors (remove_role's and set_shop_mentor's order: a profile, then a seller profile). Row locks live in the
--    rows, so a trigger on seller_profiles reads them with pgrowlocks at the moment forget_account writes there; the
--    extension and the trigger are made inside this transaction and rolled back with it.
begin;
select plan(12);

create extension if not exists pgrowlocks with schema extensions;

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
-- What of account n's own the report is about, with n's session (or none, for null).
create function pg_temp.own(n text, report uuid) returns text language plpgsql as $f$
declare
  got text;
begin
  perform set_config(
    'request.jwt.claims',
    case when n is null then '' else json_build_object('sub', pg_temp.a(n), 'role', 'authenticated')::text end,
    true
  );
  got := private.report_own_kind(report);
  perform set_config('request.jwt.claims', '', true);
  return got;
end;
$f$;
create function pg_temp.rep(target text) returns uuid language sql as $f$
  select r.id from public.reports r where r.target_id = target;
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('rf-campus', 'Review campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('rf-category', 'Review category', 99);
-- e1 Lerato, an admin with an open shop; e2 Thandi reports; e3 Mona, a mentor who mentors Lerato's shop; e4 Adam, an
-- admin who owns nothing.
insert into auth.users (id, email)
select pg_temp.a(n), 'rf-' || n || '@eduvos.com' from unnest(array['e1', 'e2', 'e3', 'e4']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('e1'), 'Lerato', 'rf-campus', '{admin}'),
  (pg_temp.a('e2'), 'Thandi', 'rf-campus', '{}'),
  (pg_temp.a('e3'), 'Mona', 'rf-campus', '{mentor}'),
  (pg_temp.a('e4'), 'Adam', 'rf-campus', '{admin}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('e1'), 'rf-lerato', pg_temp.a('e1'), 'Lerato crafts', 'rf-category', 'rf-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at, mentor_id) values
  (pg_temp.a('e1'), 'approved', pg_temp.s('e1'), now() - interval '9 days', now() - interval '8 days', pg_temp.a('e3'));

select pg_temp.sign_in('e2');
select public.create_report('seller', 'rf-lerato', 'x', 'scam');
select pg_temp.sign_out();

-- --- 1. report_own_kind answers only for the signed-in admin ----------------------------------------------------------

select has_function('private', 'report_own_kind', array['uuid'], 'report_own_kind takes only the report');
select hasnt_function('private', 'report_own_kind', array['uuid', 'uuid'], 'and no longer any account id');
select is(pg_temp.own('e1', pg_temp.rep('rf-lerato')), 'shop', 'Lerato, an admin, is told the report is about her own shop');
select is(pg_temp.own('e4', pg_temp.rep('rf-lerato')), null, 'Adam, another admin, gets null');

update public.profiles set roles = '{}' where id = pg_temp.a('e1');
select is(pg_temp.own('e1', pg_temp.rep('rf-lerato')), null, 'without the admin role, even the shop''s owner gets null');
update public.profiles set roles = '{mentor}' where id = pg_temp.a('e1');
select is(pg_temp.own('e1', pg_temp.rep('rf-lerato')), null, 'and so does a mentor: the report view is the admins''');
update public.profiles set roles = '{admin}' where id = pg_temp.a('e1');
select is(pg_temp.own(null, pg_temp.rep('rf-lerato')), null, 'with no session it is null');

-- The report's id, read here: a signed-in admin can't read reports itself (only through the staff view).
create temp table rid as select pg_temp.rep('rf-lerato') as id;
grant select on table rid to public;
select pg_temp.sign_in('e1');
select is(
  (select r.own from public.staff_reports r where r.target_id = 'rf-lerato'),
  'shop',
  'the staff view reads it for the signed-in admin'
);
select is(public.dismiss_report((select id from rid), 'Not a scam.'), 'own-shop', 'and dismiss_report still refuses her own shop''s report');
select pg_temp.sign_out();
select pg_temp.sign_in('e4');
select is(public.dismiss_report((select id from rid), 'Not a scam.'), 'changed', 'which Adam may dismiss');
select pg_temp.sign_out();

-- --- 2. forget_account's lock order -----------------------------------------------------------------------------------

create temp table seen (account uuid, profile_modes text[]);
grant all on table seen to public;
-- When a seller profile's mentor is cleared, the locks the cleared mentor's profile holds then.
create function pg_temp.seen_lock() returns trigger language plpgsql as $f$
begin
  if old.mentor_id is not null and new.mentor_id is null then
    insert into seen
    select old.mentor_id, (
      select l.modes from public.profiles p join extensions.pgrowlocks('public.profiles') l on l.locked_row = p.ctid
      where p.id = old.mentor_id
    );
  end if;
  return new;
end;
$f$;
create trigger rf_seen_lock before update on public.seller_profiles
for each row execute function pg_temp.seen_lock();

select public.forget_account(pg_temp.a('e3'));
select is(
  (select 'For Update' = any (s.profile_modes) from seen s where s.account = pg_temp.a('e3')),
  true,
  'forget_account holds the account''s own profile for update before it clears the mentor of the shops it mentors'
);
select is(
  (select sp.mentor_id from public.seller_profiles sp where sp.account_id = pg_temp.a('e1')),
  null,
  'and clears it, as before'
);

select * from finish();
rollback;
