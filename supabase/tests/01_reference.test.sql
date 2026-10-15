-- Task 4: campuses, categories and pickup points (supabase foundation plan; backend spec 4.3).
begin;
select plan(37);

select has_table('public', 'campuses', 'campuses exists');
select has_table('public', 'categories', 'categories exists');
select has_table('public', 'pickup_points', 'pickup_points exists');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.campuses'::regclass, 'public.categories'::regclass, 'public.pickup_points'::regclass)),
  'all three have row level security on'
);

-- Test rows, made as the owner.
insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
insert into public.pickup_points (id, campus_slug, name) values ('00000000-0000-4000-8000-0000000000a1', 'test-campus', 'Library entrance');
insert into public.pickup_points (id, campus_slug, name, retired_at)
values ('00000000-0000-4000-8000-0000000000a2', 'test-campus', 'Old gate', now());

-- The rules a check can say.
select throws_ok(
  $$insert into public.campuses (slug, name, region, sort) values ('Not A Slug', 'x', 'y', 1)$$,
  '23514', null, 'a campus slug is lower case, digits and hyphens'
);
select throws_ok(
  $$insert into public.pickup_points (campus_slug, name) values ('test-campus', 'L')$$,
  '23514', null, 'a pickup point name has at least 2 characters'
);
select throws_ok(
  $$insert into public.pickup_points (campus_slug, name) values ('test-campus', repeat('a', 61))$$,
  '23514', null, 'a pickup point name has at most 60 characters'
);
select throws_ok(
  $$insert into public.pickup_points (campus_slug, name) values ('test-campus', 'LIBRARY  Entrance!')$$,
  '23505', null, 'two pickup points on a campus cannot share a name key'
);
select is(
  (select name_key from public.pickup_points where id = '00000000-0000-4000-8000-0000000000a1'),
  'library entrance',
  'a pickup point keeps its name key'
);
select throws_ok(
  $$insert into public.pickup_points (campus_slug, name) values ('nowhere', 'Library')$$,
  '23503', null, 'a pickup point belongs to a campus'
);

-- anon reads all three, and only live pickup points.
set local role anon;
select is((select count(*) from public.campuses where slug = 'test-campus'), 1::bigint, 'anon reads campuses');
select is((select count(*) from public.categories where slug = 'test-category'), 1::bigint, 'anon reads categories');
select is(
  (select array_agg(name) from public.pickup_points where campus_slug = 'test-campus'),
  array['Library entrance'],
  'anon reads live pickup points, not retired ones'
);
reset role;

-- authenticated reads the same.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000aaaa","role":"authenticated"}', true);
select is((select count(*) from public.campuses where slug = 'test-campus'), 1::bigint, 'authenticated reads campuses');
select is((select count(*) from public.categories where slug = 'test-category'), 1::bigint, 'authenticated reads categories');
select is(
  (select array_agg(name) from public.pickup_points where campus_slug = 'test-campus'),
  array['Library entrance'],
  'authenticated reads live pickup points, not retired ones'
);
reset role;

-- Nobody but the owner and the service role writes them (stage G edits them with the admin client).
create function pg_temp.cannot_write(role_name text) returns setof text language plpgsql as $f$
begin
  execute format('set local role %I', role_name);
  return next throws_ok($$insert into public.campuses (slug, name, region, sort) values ('x', 'x', 'x', 1)$$, '42501', null, role_name || ' cannot insert campuses');
  return next throws_ok($$update public.campuses set name = 'x'$$, '42501', null, role_name || ' cannot update campuses');
  return next throws_ok($$delete from public.campuses$$, '42501', null, role_name || ' cannot delete campuses');
  return next throws_ok($$insert into public.categories (slug, name, sort) values ('x', 'x', 1)$$, '42501', null, role_name || ' cannot insert categories');
  return next throws_ok($$update public.categories set name = 'x'$$, '42501', null, role_name || ' cannot update categories');
  return next throws_ok($$delete from public.categories$$, '42501', null, role_name || ' cannot delete categories');
  return next throws_ok($$insert into public.pickup_points (campus_slug, name) values ('test-campus', 'New')$$, '42501', null, role_name || ' cannot insert pickup points');
  return next throws_ok($$update public.pickup_points set retired_at = null$$, '42501', null, role_name || ' cannot update pickup points');
  return next throws_ok($$delete from public.pickup_points$$, '42501', null, role_name || ' cannot delete pickup points');
  reset role;
end;
$f$;
select * from pg_temp.cannot_write('anon');
select * from pg_temp.cannot_write('authenticated');

-- No truncate (it ignores RLS) or other leftovers from Supabase's default privileges.
select ok(not has_table_privilege('anon', 'public.campuses', 'truncate'), 'anon cannot truncate campuses');
select ok(not has_table_privilege('authenticated', 'public.pickup_points', 'truncate'), 'authenticated cannot truncate pickup points');
select ok(has_table_privilege('service_role', 'public.pickup_points', 'insert'), 'the service role can insert pickup points');

select * from finish();
rollback;
