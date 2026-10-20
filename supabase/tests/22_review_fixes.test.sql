-- Schema catch-up, the final review's fixes (20261020121000_review_fixes.sql):
-- - I1: signed-in staff read every audit column but subject_id, so an admin can't name a hidden request's asker (or
--   any other student an entry is about) by joining it to profiles. The writers and forget_account still fill and
--   forget it.
-- - M1: mentor_shop_numbers takes p_now as now() when it's later, as admin_weekly_counts does.
-- - M2: set_shop_mentor reads the mentor's role under a share lock on their profile, taken before the shop's lock (the
--   order remove_role locks them in), so a mentor role removed at the same moment can't leave its shop a stale mentor.
begin;
select plan(23);

create function pg_temp.sign_in(account uuid) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', account, 'role', 'authenticated', 'session_id', '50000000-0000-4000-8000-000000002201')::text,
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
  select ('00000000-0000-4000-8000-0000000022' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000022' || n)::uuid;
$f$;
grant execute on function pg_temp.a(text), pg_temp.s(text) to public;

-- 01 Adam, an admin; 02 Mona, a mentor; 03 Sipho, an approved shop with no mentor; 04 Thandi, a student;
-- 05 Kabelo, an approved shop Mona mentors.
insert into public.campuses (slug, name, region, sort) values ('fix-campus', 'Fix campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('fix-category', 'Fix category', 99);
insert into auth.users (id, email)
select pg_temp.a(n), 'fix' || n || '@eduvos.com' from unnest(array['01', '02', '03', '04', '05']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('01'), 'Adam', 'fix-campus', array['admin']),
  (pg_temp.a('02'), 'Mona', 'fix-campus', array['mentor']),
  (pg_temp.a('03'), 'Sipho', 'fix-campus', '{}'),
  (pg_temp.a('04'), 'Thandi', 'fix-campus', '{}'),
  (pg_temp.a('05'), 'Kabelo', 'fix-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('03'), 'fix-shop-03', pg_temp.a('03'), 'Sipho''s shop', 'fix-category', 'fix-campus', '2026-01'),
  (pg_temp.s('05'), 'fix-shop-05', pg_temp.a('05'), 'Kabelo''s shop', 'fix-category', 'fix-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, mentor_id) values
  (pg_temp.a('03'), 'approved', pg_temp.s('03'), null),
  (pg_temp.a('05'), 'approved', pg_temp.s('05'), pg_temp.a('02'));

-- --- M2: set_shop_mentor ------------------------------------------------------------------------------------------------

select pg_temp.sign_in(pg_temp.a('01'));
select is(public.set_shop_mentor(pg_temp.s('03'), pg_temp.a('04')), 'nothing', 'a student isn''t a mentor');
select is(public.set_shop_mentor(pg_temp.s('03'), pg_temp.a('01')), 'nothing', 'nor is an admin without the role');
select is(public.set_shop_mentor(pg_temp.s('03'), pg_temp.a('02')), 'changed', 'Adam gives Sipho''s shop Mona as its mentor');
select pg_temp.sign_out();
select is(
  (select mentor_id from public.seller_profiles where account_id = pg_temp.a('03')),
  pg_temp.a('02'),
  'and Mona is its mentor'
);
select ok(
  (select pg_get_functiondef('public.set_shop_mentor(uuid, uuid)'::regprocedure)
     ~ '(?s)''mentor'' = any \(p\.roles\)\s+for share;.*private\.lock_owned_shop\(p_shop\)'),
  'the mentor''s role is read under a share lock, taken before the shop''s (remove_role''s order)'
);

-- --- I1: the audit log's subject ----------------------------------------------------------------------------------------

select is(
  array(
    select c.attname::text
    from pg_attribute c
    where c.attrelid = 'public.audit_log'::regclass and c.attnum > 0 and not c.attisdropped
      and has_column_privilege('authenticated', 'public.audit_log', c.attnum, 'select')
    order by c.attnum
  ),
  array['id', 'at', 'staff_id', 'staff_name', 'action', 'target_kind', 'target_id', 'target_name', 'detail'],
  'signed-in people may select every audit column but subject_id'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'select')
    and not has_column_privilege('authenticated', 'public.audit_log', 'subject_id', 'select'),
  'and not the whole table, nor subject_id'
);
select ok(
  has_table_privilege('service_role', 'public.audit_log', 'select')
    and has_table_privilege('service_role', 'public.audit_log', 'insert')
    and not has_table_privilege('service_role', 'public.audit_log', 'update')
    and not has_table_privilege('service_role', 'public.audit_log', 'delete'),
  'the service role keeps select and insert, and still can''t change the log'
);
select is(
  (select subject_id from public.audit_log where target_id = 'fix-shop-03'),
  pg_temp.a('03'),
  'the staff action still records its subject (the shop''s owner)'
);

select pg_temp.sign_in(pg_temp.a('01'));
select is(
  (select row(staff_id, staff_name, action, target_kind, target_id, target_name, detail)::text
   from public.audit_log where target_id = 'fix-shop-03'),
  row(pg_temp.a('01'), 'Adam', 'mentor-assigned', 'shop', 'fix-shop-03', 'Sipho''s shop', 'Mona')::text,
  'an admin reads the entry''s other columns'
);
select is(
  (select count(*) from public.audit_log where target_id = 'fix-shop-03'),
  1::bigint,
  'and counts entries'
);
select throws_ok($$select subject_id from public.audit_log$$, '42501', null, 'but never its subject');
select throws_ok($$select * from public.audit_log$$, '42501', null, 'so a reader names the columns they read');
select throws_ok(
  $$select id from public.audit_log where subject_id is not null$$,
  '42501', null, 'nor filters on the subject'
);
select throws_ok(
  $$select p.first_name from public.audit_log l join public.profiles p on p.id = l.subject_id$$,
  '42501', null, 'nor joins it to a profile'
);
select pg_temp.sign_out();

set local role anon;
select throws_ok($$select id from public.audit_log$$, '42501', null, 'anon reads no audit log');
reset role;

select pg_temp.sign_in(pg_temp.a('04'));
select is((select count(*) from public.audit_log), 0::bigint, 'a student reads no audit entries');
select throws_ok($$select subject_id from public.audit_log$$, '42501', null, 'nor anyone''s subject');
select pg_temp.sign_out();

-- forget_account (security definer, the service role's) still forgets the subject.
set local role service_role;
select is(public.forget_account(pg_temp.a('03')), '{}'::text[], 'forgetting Sipho gives back no paths');
reset role;
select is(
  (select row(subject_id, target_id, target_name, detail)::text from public.audit_log where action = 'mentor-assigned' and staff_id = pg_temp.a('01')),
  row(null::uuid, '', 'Deleted account', '')::text,
  'and his entry stays, with him forgotten'
);

-- --- M1: mentor_shop_numbers takes a later p_now as now() ---------------------------------------------------------------

-- Kabelo's shop, against now():
--   k1 an enquiry 7 days ago answered in an hour: an enquiry, due, in time (outside a window ending 10 days ahead)
--   k2 an enquiry an hour ago, unanswered: an enquiry, not yet due (due 10 days ahead)
--   k3 marked done 2 days ago: not yet a sale (a sale 10 days ahead)
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, status, created_at, first_reply_at, completed_at) values
  ('40000000-0000-4000-8000-0000000022a1', null, 'Lamp', pg_temp.s('05'), pg_temp.a('04'), 'replied', now() - interval '7 days', now() - interval '7 days' + interval '1 hour', null),
  ('40000000-0000-4000-8000-0000000022a2', null, 'Lamp', pg_temp.s('05'), pg_temp.a('04'), 'asked', now() - interval '1 hour', null, null),
  ('40000000-0000-4000-8000-0000000022a3', null, 'Lamp', pg_temp.s('05'), pg_temp.a('04'), 'done', now() - interval '20 days', now() - interval '20 days' + interval '1 hour', now() - interval '2 days');

select pg_temp.sign_in(pg_temp.a('02'));
select is(
  (select row(enquiries, due, replied_in_time, sales_confirmed)::text from public.mentor_shop_numbers(pg_temp.s('05'))),
  row(2, 1, 1, 0)::text,
  'Mona sees Kabelo''s numbers now'
);
select is(
  (select row(enquiries, due, replied_in_time, sales_confirmed)::text
   from public.mentor_shop_numbers(pg_temp.s('05'), now() + interval '10 days')),
  row(2, 1, 1, 0)::text,
  'and a date 10 days ahead gives the same: it''s taken as now'
);
select is(
  (select row(enquiries, due, replied_in_time, sales_confirmed)::text
   from public.mentor_shop_numbers(pg_temp.s('05'), now() - interval '10 days')),
  row(3, 2, 2, 0)::text,
  'while an earlier date is kept (its window takes in k3''s enquiry, 20 days ago)'
);
select pg_temp.sign_out();

select * from finish();
rollback;
