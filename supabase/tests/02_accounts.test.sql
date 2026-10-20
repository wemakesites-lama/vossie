-- Task 5: profiles, consents and seller profiles (supabase foundation plan; backend spec 4.3).
begin;
select plan(48);

-- Sign in as an account for the next statements: the API's role and the JWT's subject, as PostgREST sets them.
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
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'alice@eduvos.com'),
  ('00000000-0000-4000-8000-000000000002', 'bob@eduvos.com'),
  ('00000000-0000-4000-8000-000000000003', 'mona@eduvos.com'),
  ('00000000-0000-4000-8000-000000000004', 'adam@eduvos.com');
insert into public.profiles (id, first_name, campus_slug, roles) values
  ('00000000-0000-4000-8000-000000000001', 'Alice', 'test-campus', '{}'),
  ('00000000-0000-4000-8000-000000000002', 'Bob', 'test-campus', '{}'),
  ('00000000-0000-4000-8000-000000000003', 'Mona', 'test-campus', '{mentor}'),
  ('00000000-0000-4000-8000-000000000004', 'Adam', 'test-campus', '{admin}');
insert into public.consents (account_id, version, agreed_at) values
  ('00000000-0000-4000-8000-000000000002', '2026-10-draft', '2026-10-01T08:00:00Z');
insert into public.seller_profiles (account_id, status) values ('00000000-0000-4000-8000-000000000001', 'pending');

-- The checks.
select throws_ok(
  $$insert into public.profiles (id, first_name, campus_slug) values ('00000000-0000-4000-8000-000000000009', 'Zed', 'test-campus')$$,
  '23503', null, 'a profile belongs to an Auth user'
);
select throws_ok(
  $$update public.profiles set first_name = 'A' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a first name has at least 2 characters'
);
select throws_ok(
  $$update public.profiles set first_name = repeat('a', 41) where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a first name has at most 40 characters'
);
select throws_ok(
  $$update public.profiles set roles = '{owner}' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'roles are mentor and admin only'
);
select throws_ok(
  $$update public.seller_profiles set status = 'open' where account_id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a seller status is pending, approved or paused'
);
select throws_ok(
  $$insert into public.consents (account_id, version) values ('00000000-0000-4000-8000-000000000002', '2026-10-draft')$$,
  '23505', null, 'one consent per account and version'
);
select throws_ok(
  $$insert into public.consents (account_id, version) values ('00000000-0000-4000-8000-000000000002', 'made-up')$$,
  '23503', null, 'a consent is to a version the policy has had (private.policy_versions)'
);
select is(
  (select array_agg(version) from private.policy_versions),
  array['2026-10-draft'],
  'the migration lists today''s policy version'
);
select ok(
  not has_table_privilege('authenticated', 'private.policy_versions', 'select')
  and not has_table_privilege('anon', 'private.policy_versions', 'select'),
  'which the API roles cannot read'
);
select ok(
  not has_table_privilege('authenticated', 'public.consents', 'insert')
  and not has_column_privilege('authenticated', 'public.profiles', 'first_name', 'update')
  and not has_column_privilege('authenticated', 'public.profiles', 'campus_slug', 'update'),
  'authenticated has no insert on consents and no update on profiles: functions write them'
);

-- anon sees nothing: it has no grant on any of the three.
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$select * from public.consents$$, '42501', null, 'anon cannot read consents');
select throws_ok($$select * from public.seller_profiles$$, '42501', null, 'anon cannot read seller profiles');
reset role;

-- Alice, a student who has applied to sell.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000001');
select is(
  (select array_agg(first_name) from public.profiles),
  array['Alice'],
  'a student reads only their own profile'
);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  0::bigint,
  'one user cannot read another''s profile'
);
select throws_ok(
  $$update public.profiles set first_name = 'Alicia', campus_slug = 'test-campus' where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'a student cannot write their profile directly (public.update_profile checks and saves it)'
);
select throws_ok(
  $$update public.profiles set roles = '{admin}' where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'a user cannot give themselves admin'
);
select throws_ok(
  $$insert into public.profiles (id, first_name, campus_slug, roles) values ('00000000-0000-4000-8000-000000000001', 'Al', 'test-campus', '{admin}')$$,
  '42501', null, 'a user cannot insert a profile (the app makes it at step 3)'
);
select throws_ok(
  $$delete from public.profiles where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'a user cannot delete their profile directly (account deletion goes through the admin client)'
);
select throws_ok(
  $$update public.profiles set first_name = 'Robert' where id = '00000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'nor anyone else''s'
);
select pg_temp.sign_out();
select is(
  (select first_name from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  'Bob',
  'which is unchanged'
);
insert into public.consents (account_id, version, agreed_at) values
  ('00000000-0000-4000-8000-000000000001', '2026-10-draft', '2026-10-15T08:00:00Z');

select pg_temp.sign_in('00000000-0000-4000-8000-000000000001');
select throws_ok(
  $$insert into public.consents (account_id, version, agreed_at) values ('00000000-0000-4000-8000-000000000001', '2026-11', '2020-01-01T00:00:00Z')$$,
  '42501', null, 'a user cannot write a consent directly, with its own time or version (public.record_consent does)'
);
select is(
  (select array_agg(version) from public.consents),
  array['2026-10-draft'],
  'a user reads only their own consents'
);
select throws_ok(
  $$insert into public.consents (account_id, version) values ('00000000-0000-4000-8000-000000000002', 'v2')$$,
  '42501', null, 'a user cannot record consent for someone else'
);
select throws_ok(
  $$update public.consents set version = 'v3'$$,
  '42501', null, 'a consent cannot be changed'
);
select throws_ok(
  $$delete from public.consents$$,
  '42501', null, 'a consent cannot be deleted directly'
);
select is(
  (select array_agg(status) from public.seller_profiles),
  array['pending'],
  'a seller reads their own seller profile'
);
select throws_ok(
  $$update public.seller_profiles set status = 'approved'$$,
  '42501', null, 'a seller cannot approve themselves'
);
select throws_ok(
  $$insert into public.seller_profiles (account_id, status) values ('00000000-0000-4000-8000-000000000001', 'approved')$$,
  '42501', null, 'a user cannot write a seller profile directly'
);
select throws_ok(
  $$select private.is_staff('admin')$$,
  '42501', null, 'a user cannot call a private helper by name'
);
select pg_temp.sign_out();

select pg_temp.sign_in('00000000-0000-4000-8000-000000000002');
select is((select count(*) from public.seller_profiles), 0::bigint, 'another user sees no one else''s seller profile');
select is((select count(*) from public.consents where account_id <> '00000000-0000-4000-8000-000000000002'), 0::bigint, 'nor their consents');
select pg_temp.sign_out();

-- Staff read every profile.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000003');
select is((select count(*) from public.profiles where id::text like '00000000-0000-4000-8000-00000000000_'), 4::bigint, 'a mentor reads every profile');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000004');
select is((select count(*) from public.profiles where id::text like '00000000-0000-4000-8000-00000000000_'), 4::bigint, 'an admin reads every profile');
select throws_ok(
  $$update public.profiles set first_name = 'Changed' where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'staff cannot edit someone else''s profile through the API'
);
select pg_temp.sign_out();

-- is_staff (staff tools spec): admin passes every area; a mentor passes hub and mentor.
create function pg_temp.staff_as(account uuid, area text) returns boolean language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', account, 'role', 'authenticated')::text, true);
  return private.is_staff(area);
end;
$f$;
select is(pg_temp.staff_as('00000000-0000-4000-8000-000000000001', 'admin'), false, 'a student is not admin');
select is(pg_temp.staff_as('00000000-0000-4000-8000-000000000001', 'hub'), false, 'a student is not hub staff');
select is(pg_temp.staff_as('00000000-0000-4000-8000-000000000001', 'mentor'), false, 'a student is not a mentor');
select is(pg_temp.staff_as('00000000-0000-4000-8000-000000000003', 'admin'), false, 'a mentor is not admin');
select is(pg_temp.staff_as('00000000-0000-4000-8000-000000000003', 'hub'), true, 'a mentor passes hub');
select is(pg_temp.staff_as('00000000-0000-4000-8000-000000000003', 'mentor'), true, 'a mentor passes mentor');
select is(pg_temp.staff_as('00000000-0000-4000-8000-000000000004', 'admin'), true, 'an admin passes admin');
select is(pg_temp.staff_as('00000000-0000-4000-8000-000000000004', 'hub'), true, 'an admin passes hub');
select is(pg_temp.staff_as('00000000-0000-4000-8000-000000000004', 'mentor'), true, 'an admin passes mentor');
select is(pg_temp.staff_as('00000000-0000-4000-8000-000000000004', 'janitor'), false, 'no one passes an unknown area');
select set_config('request.jwt.claims', '', true);
select is(private.is_staff('admin'), false, 'no one signed in is not staff');
select is(
  (select provolatile from pg_proc where oid = 'private.is_staff(text)'::regprocedure),
  's'::"char",
  'is_staff is stable'
);

-- Deleting the Auth user takes the profile, consents and seller profile with it.
delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000001')
  + (select count(*) from public.consents where account_id = '00000000-0000-4000-8000-000000000001')
  + (select count(*) from public.seller_profiles where account_id = '00000000-0000-4000-8000-000000000001'),
  0::bigint,
  'deleting the Auth user removes the profile, consents and seller profile'
);

select * from finish();
rollback;
