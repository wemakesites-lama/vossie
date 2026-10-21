-- Step 2b, Task 7: no admin takes the mentor role from whoever mentors their own shop (stage M spec decisions 2 and 5;
-- supabase step 2b plan, decision 8). removeRole (lib/data/staff-accounts.ts:128) answers "own-shop-mentor" after "no
-- such role", reading the admin's seller profile whatever its status; leaving your own shop without a mentor is another
-- admin's decision. remove_role locks the mentor's profile first, then the admin's seller profile for share, the order
-- set_shop_mentor takes them in.
-- Row locks live in the rows, not in pg_locks, so the lock cases read them with pgrowlocks, created inside this
-- transaction and rolled back with it.
begin;
select plan(17);

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
-- Account n removes account m's role.
create function pg_temp.remove(n text, m text, role text) returns text language plpgsql as $f$
declare
  got text;
begin
  perform pg_temp.sign_in(n);
  got := public.remove_role(pg_temp.a(m), role);
  perform pg_temp.sign_out();
  return got;
end;
$f$;
create function pg_temp.logs() returns bigint[] language sql as $f$
  select array[(select count(*) from public.audit_log), (select count(*) from public.notifications)];
$f$;
create function pg_temp.mentor_of(n text) returns uuid language sql as $f$
  select sp.mentor_id from public.seller_profiles sp where sp.account_id = pg_temp.a(n);
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('om-campus', 'Mentor campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('om-category', 'Mentor category', 99);
-- c1 Adam, an admin whose shop Mona (c2, a mentor) mentors; c3 Busi, an admin whose shop has no mentor; c4 Cebo, an
-- admin with no shop.
insert into auth.users (id, email)
select pg_temp.a(n), 'om-' || n || '@eduvos.com' from unnest(array['c1', 'c2', 'c3', 'c4']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('c1'), 'Adam', 'om-campus', '{admin}'),
  (pg_temp.a('c2'), 'Mona', 'om-campus', '{mentor}'),
  (pg_temp.a('c3'), 'Busi', 'om-campus', '{admin}'),
  (pg_temp.a('c4'), 'Cebo', 'om-campus', '{admin}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('c1'), 'om-adam', pg_temp.a('c1'), 'Adam prints', 'om-category', 'om-campus', '2026-01'),
  (pg_temp.s('c3'), 'om-busi', pg_temp.a('c3'), 'Busi bakes', 'om-category', 'om-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at, mentor_id) values
  (pg_temp.a('c1'), 'approved', pg_temp.s('c1'), now() - interval '9 days', now() - interval '8 days', pg_temp.a('c2')),
  (pg_temp.a('c3'), 'approved', pg_temp.s('c3'), now() - interval '9 days', now() - interval '8 days', null);

-- --- The refusal ------------------------------------------------------------------------------------------------------

create temp table kept as select pg_temp.logs() as logs;
select is(pg_temp.remove('c1', 'c2', 'mentor'), 'own-shop-mentor', 'Adam can''t take the mentor role from his own shop''s mentor');
select is((select roles from public.profiles where id = pg_temp.a('c2')), '{mentor}'::text[], 'Mona keeps the role');
select is(pg_temp.mentor_of('c1'), pg_temp.a('c2'), 'and still mentors Adam''s shop');
select is(pg_temp.logs(), (select logs from kept), 'no audit entry, nobody told');
select is(
  (select l.modes from public.profiles p join extensions.pgrowlocks('public.profiles') l on l.locked_row = p.ctid
   where p.id = pg_temp.a('c2')),
  array['For Update'],
  'it locked the mentor''s profile for update first'
);
select is(
  (select l.modes from public.seller_profiles sp join extensions.pgrowlocks('public.seller_profiles') l on l.locked_row = sp.ctid
   where sp.account_id = pg_temp.a('c1')),
  array['For Share'],
  'then read Adam''s seller profile for share, as set_shop_mentor takes them'
);

savepoint s;
update public.seller_profiles set status = 'paused', paused_by = 'seller' where account_id = pg_temp.a('c1');
select is(pg_temp.remove('c1', 'c2', 'mentor'), 'own-shop-mentor', 'still refused while Adam has paused his shop');
rollback to savepoint s;
savepoint s;
update public.seller_profiles set status = 'pending' where account_id = pg_temp.a('c1');
select is(pg_temp.remove('c1', 'c2', 'mentor'), 'own-shop-mentor', 'or while it''s waiting again: the check reads the seller profile');
rollback to savepoint s;

-- --- What still works -------------------------------------------------------------------------------------------------

savepoint s;
select is(pg_temp.remove('c3', 'c2', 'mentor'), 'changed', 'Busi, whose shop Mona doesn''t mentor, removes the role');
select is(pg_temp.mentor_of('c1'), null, 'and Adam''s shop has no mentor now, as before');
rollback to savepoint s;
savepoint s;
select is(pg_temp.remove('c4', 'c2', 'mentor'), 'changed', 'so does Cebo, an admin with no shop');
rollback to savepoint s;
savepoint s;
update public.profiles set roles = '{mentor,admin}' where id = pg_temp.a('c2');
select is(pg_temp.remove('c1', 'c2', 'admin'), 'changed', 'Adam may take the admin role from Mona, who holds both');
select is(
  (select row(p.roles, pg_temp.mentor_of('c1'))::text from public.profiles p where p.id = pg_temp.a('c2')),
  row('{mentor}'::text[], pg_temp.a('c2'))::text,
  'she keeps the mentor role and his shop'
);
rollback to savepoint s;

-- --- The order --------------------------------------------------------------------------------------------------------

savepoint s;
update public.profiles set roles = '{}' where id = pg_temp.a('c2');
select is(pg_temp.remove('c1', 'c2', 'mentor'), 'nothing', '"no such role" comes first, even for his shop''s mentor''s id');
rollback to savepoint s;
select is(pg_temp.remove('c1', 'c1', 'admin'), 'own-admin', 'removing your own admin role is still own-admin');
select is(
  array[
    has_function_privilege('anon', 'public.remove_role(uuid, text)', 'execute'),
    has_function_privilege('authenticated', 'public.remove_role(uuid, text)', 'execute'),
    has_function_privilege('service_role', 'public.remove_role(uuid, text)', 'execute')
  ],
  array[false, true, true],
  'remove_role keeps its grants'
);
select is(
  (select prorettype::regtype::text || ' ' || pg_get_function_identity_arguments(oid) from pg_proc
   where oid = 'public.remove_role(uuid, text)'::regprocedure),
  'text p_account uuid, p_role text',
  'and its signature'
);

select * from finish();
rollback;
