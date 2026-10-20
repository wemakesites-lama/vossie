-- The audit log's related account (20261020121100_audit_related_account.sql; Lama, 2026-10-20, the final review's M3):
-- a mentor-assigned entry names the mentor in its detail, so set_shop_mentor records the mentor as related_id, and
-- forget_account writes "Deleted account" in the detail of the entries related to the deleted account, as
-- forgetAccountInStaffTools (lib/data/staff-privacy.ts) does. By id, never by name: two mentors can share one. Like
-- subject_id, related_id is never readable through the API.
begin;
select plan(19);

create function pg_temp.sign_in(account uuid) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', account, 'role', 'authenticated', 'session_id', '50000000-0000-4000-8000-000000002301')::text,
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
-- The account and shop ids, by their last two characters.
create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000023' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000023' || n)::uuid;
$f$;
grant execute on function pg_temp.a(text), pg_temp.s(text) to public;

-- 01 Adam, an admin; 02 Mona, a mentor; 03 Sipho, an approved shop; 04 another Mona, a mentor too; 05 Kabelo, an
-- approved shop. Neither shop has a mentor yet.
insert into public.campuses (slug, name, region, sort) values ('rel-campus', 'Related campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('rel-category', 'Related category', 99);
insert into auth.users (id, email)
select pg_temp.a(n), 'rel' || n || '@eduvos.com' from unnest(array['01', '02', '03', '04', '05']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('01'), 'Adam', 'rel-campus', array['admin']),
  (pg_temp.a('02'), 'Mona', 'rel-campus', array['mentor']),
  (pg_temp.a('03'), 'Sipho', 'rel-campus', '{}'),
  (pg_temp.a('04'), 'Mona', 'rel-campus', array['mentor']),
  (pg_temp.a('05'), 'Kabelo', 'rel-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('03'), 'rel-shop-03', pg_temp.a('03'), 'Sipho''s shop', 'rel-category', 'rel-campus', '2026-01'),
  (pg_temp.s('05'), 'rel-shop-05', pg_temp.a('05'), 'Kabelo''s shop', 'rel-category', 'rel-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, mentor_id) values
  (pg_temp.a('03'), 'approved', pg_temp.s('03'), null),
  (pg_temp.a('05'), 'approved', pg_temp.s('05'), null);

-- --- The column ----------------------------------------------------------------------------------------------------------

select col_type_is('public', 'audit_log', 'related_id', 'uuid', 'the audit log has a related account');
select col_is_null('public', 'audit_log', 'related_id', 'which may be null');
select ok(
  exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.audit_log'::regclass and c.contype = 'f' and c.confdeltype = 'n'
      and c.confrelid = 'public.profiles'::regclass
      and c.conkey = array[(select attnum from pg_attribute where attrelid = 'public.audit_log'::regclass and attname = 'related_id')]
  ),
  'a profile, set null when it goes'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'audit_log' and indexdef like '%(related_id)'
  ),
  'with an index, for forget_account and the foreign key'
);
select ok(
  not has_column_privilege('authenticated', 'public.audit_log', 'related_id', 'select')
    and not has_column_privilege('anon', 'public.audit_log', 'related_id', 'select'),
  'the API roles can''t read it'
);
select is(
  array(
    select c.attname::text
    from pg_attribute c
    where c.attrelid = 'public.audit_log'::regclass and c.attnum > 0 and not c.attisdropped
      and has_column_privilege('authenticated', 'public.audit_log', c.attnum, 'select')
    order by c.attnum
  ),
  array['id', 'at', 'staff_id', 'staff_name', 'action', 'target_kind', 'target_id', 'target_name', 'detail'],
  'signed-in people still select the same nine columns'
);
select ok(
  not has_function_privilege('anon', 'private.record_audit(text, text, text, text, text, uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'private.record_audit(text, text, text, text, text, uuid, uuid)', 'execute')
    and not has_function_privilege('service_role', 'private.record_audit(text, text, text, text, text, uuid, uuid)', 'execute'),
  'the audit helper still runs only inside the staff actions'
);
select is(
  (select count(*) from pg_proc where proname = 'record_audit' and pronamespace = 'private'::regnamespace),
  1::bigint,
  'and there''s one of it'
);

-- --- set_shop_mentor records the mentor -------------------------------------------------------------------------------

select pg_temp.sign_in(pg_temp.a('01'));
select is(public.set_shop_mentor(pg_temp.s('03'), pg_temp.a('02')), 'changed', 'Adam gives Sipho''s shop Mona (02)');
select is(public.set_shop_mentor(pg_temp.s('05'), pg_temp.a('04')), 'changed', 'and Kabelo''s the other Mona (04)');
select is(public.set_shop_mentor(pg_temp.s('05'), null), 'changed', 'then takes Kabelo''s mentor away');
select is(public.set_shop_verified(pg_temp.s('03'), true), 'changed', 'and verifies Sipho''s shop');
select throws_ok($$select related_id from public.audit_log$$, '42501', null, 'an admin never reads the related account');
select pg_temp.sign_out();

-- One transaction: every entry has the same time, so they're compared by action and shop.
select is(
  (select array_agg(row(action, target_id, detail, right(related_id::text, 2))::text order by action, target_id)
   from public.audit_log where staff_id = pg_temp.a('01')),
  array[
    row('mentor-assigned', 'rel-shop-03', 'Mona', '02')::text,
    row('mentor-assigned', 'rel-shop-05', 'Mona', '04')::text,
    row('mentor-removed', 'rel-shop-05', '', null)::text,
    row('shop-verified', 'rel-shop-03', '', null)::text
  ],
  'an assignment records its mentor; a removal and the other actions record no one'
);

-- --- forget_account forgets the deleted mentor's name, not the namesake's ----------------------------------------------

set local role service_role;
select is(public.forget_account(pg_temp.a('02')), '{}'::text[], 'Mona (02) deletes her account');
reset role;

select is(
  (select row(staff_id, staff_name, target_id, target_name, detail, related_id, subject_id)::text
   from public.audit_log where action = 'mentor-assigned' and target_id = 'rel-shop-03'),
  row(pg_temp.a('01'), 'Adam', 'rel-shop-03', 'Sipho''s shop', 'Deleted account', null::uuid, pg_temp.a('03'))::text,
  'the entry that assigned her says "Deleted account" and keeps everything else'
);
select is(
  (select row(detail, related_id)::text from public.audit_log where action = 'mentor-assigned' and target_id = 'rel-shop-05'),
  row('Mona', pg_temp.a('04'))::text,
  'the other Mona''s entry keeps her name'
);
select is(
  (select count(*) from public.audit_log where staff_id = pg_temp.a('01')),
  4::bigint,
  'and the log has lost no entry'
);
select is(
  (select count(*) from public.audit_log where detail like '%Mona%' and related_id is distinct from pg_temp.a('04')),
  0::bigint,
  'no entry names the deleted Mona'
);

select * from finish();
rollback;
