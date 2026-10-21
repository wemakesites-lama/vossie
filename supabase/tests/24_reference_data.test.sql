-- Step 2b, Task 1: production's reference rows and allowed sign-in domains come from migrations (decisions 10 to 12,
-- amendment 2): 20261021120000_reference_data.sql (generated from the fixtures) and 20261021120010_exact_email_domains.sql.
begin;
select plan(18);

-- Who may sign in: eduvos.com and vossie.net, from the migration (the seed adds only vossie.test).
select ok(exists (select 1 from private.allowed_email_domains where domain = 'eduvos.com'), 'eduvos.com may sign in');
select ok(exists (select 1 from private.allowed_email_domains where domain = 'vossie.net'), 'vossie.net may sign in');

-- The rule both Auth hooks run, as supabase_auth_admin: exact domains only, and no pattern on the part before the @.
-- The test role can't become supabase_auth_admin, so, as test 05 does, it calls the function itself and checks that
-- Auth may.
select ok(has_function_privilege('supabase_auth_admin', 'private.email_allowed(text)', 'execute'), 'Auth runs the rule');
select is(private.email_allowed('eduv1234567@vossie.net'), true, 'a student''s eduv number at vossie.net is allowed');
select is(private.email_allowed('someone@vossie.net'), true, 'any name at vossie.net is allowed (no pattern before the @)');
select is(private.email_allowed('thandi@eduvos.com'), true, 'a staff address at eduvos.com is allowed');
select is(private.email_allowed('a@mail.vossie.net'), false, 'a subdomain of vossie.net is refused (exact domains only)');
select is(private.email_allowed('a@students.eduvos.com'), false, 'a subdomain of eduvos.com is refused');
select is(private.email_allowed('a@vossie.network'), false, 'a domain that only starts with vossie.net is refused');
select is(private.email_allowed('a@notvossie.net'), false, 'a domain that only ends in the same letters is refused');

-- The reference rows.
select is((select count(*) from public.campuses), 13::bigint, '13 campuses');
select is(
  (select array_agg(slug) from public.campuses where is_online), array['online'], 'one of them, Eduvos Online, is online'
);
select is((select count(*) from public.categories), 10::bigint, '10 categories');
select is((select count(*) from public.pickup_points), 24::bigint, '24 pickup points');
select is((select count(*) from public.pickup_points where retired_at is not null), 0::bigint, 'none of them retired');

-- Running the migration's inserts again changes nothing (each skips rows that are already there).
create temp table before_counts as
select (select count(*) from private.allowed_email_domains) as domains, (select count(*) from public.campuses) as campuses,
  (select count(*) from public.categories) as categories, (select count(*) from public.pickup_points) as points;
select cmp_ok(
  (select count(*) from supabase_migrations.schema_migrations m, unnest(m.statements) s
   where m.version = '20261021120000' and s ~* '^\s*(--[^\n]*\n\s*)*insert into'),
  '=', 4::bigint,
  'the reference migration''s four inserts are on record'
);
do $$
declare
  statement text;
begin
  for statement in
    select s from supabase_migrations.schema_migrations m, unnest(m.statements) s where m.version = '20261021120000'
  loop
    execute statement;
  end loop;
end;
$$;
select is(
  (select row(domains, campuses, categories, points)::text from before_counts),
  row((select count(*) from private.allowed_email_domains), (select count(*) from public.campuses),
      (select count(*) from public.categories), (select count(*) from public.pickup_points))::text,
  'running them again adds no row'
);
select is(
  (select count(*) from public.pickup_points where id = 'fe628154-986d-5293-b94a-8a39dcf0d5be' and name = 'Main reception'),
  1::bigint,
  'a pickup point keeps the seed''s fixed id'
);

select * from finish();
rollback;
