-- Step 2b, Task 5: reports remember who owned their target (supabase step 2b plan, decision 6; amendments 5 and 6).
-- createReport (lib/data/reports.ts) records targetOwnerId: a listing's or a shop's owner, a request's asker, null for a
-- sample. The report view's `own` (toView, lib/data/staff-reports.ts) reads whose the target is now while it exists,
-- and falls back to the recorded owner once it has gone. Deleting the owner's account clears the recorded owner.
begin;
select plan(31);

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
-- The report Thandi made about a target, by kind and id.
create function pg_temp.rep(kind text, target text) returns uuid language sql as $f$
  select r.id from public.reports r where r.target_kind = kind and r.target_id = target and not r.target_gone;
$f$;
create function pg_temp.owner(kind text, target text) returns uuid language sql as $f$
  select r.target_owner_id from public.reports r where r.id = pg_temp.rep(kind, target);
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('to-campus', 'Owner campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('to-category', 'Owner category', 99);
-- d1 Lerato, an admin with an open shop; d2 Zola, an admin who asks; d3 Thandi reports; d4 Adam, an admin who owns
-- nothing; d5 Sipho, whose new shop took the link of a shop that has gone. d0 is a sample shop no account owns.
insert into auth.users (id, email)
select pg_temp.a(n), 'to-' || n || '@eduvos.com' from unnest(array['d1', 'd2', 'd3', 'd4', 'd5']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('d1'), 'Lerato', 'to-campus', '{admin}'),
  (pg_temp.a('d2'), 'Zola', 'to-campus', '{admin}'),
  (pg_temp.a('d3'), 'Thandi', 'to-campus', '{}'),
  (pg_temp.a('d4'), 'Adam', 'to-campus', '{admin}'),
  (pg_temp.a('d5'), 'Sipho', 'to-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('d1'), 'to-lerato', pg_temp.a('d1'), 'Lerato crafts', 'to-category', 'to-campus', '2026-01'),
  (pg_temp.s('d5'), 'to-old', pg_temp.a('d5'), 'Sipho prints', 'to-category', 'to-campus', '2026-01'),
  (pg_temp.s('d0'), 'to-sample', null, 'Sample stall', 'to-category', 'to-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at) values
  (pg_temp.a('d1'), 'approved', pg_temp.s('d1'), now() - interval '9 days', now() - interval '8 days'),
  (pg_temp.a('d5'), 'approved', pg_temp.s('d5'), now() - interval '9 days', now() - interval '8 days');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('to-l1', pg_temp.s('d1'), 'available', 'item', 'Graphing calculator', 'to-category', 'good', 300, 'cash', 'A calculator.', 'online', 'to-campus', now()),
  ('to-l2', pg_temp.s('d1'), 'available', 'item', 'Old textbook', 'to-category', 'good', 100, 'cash', 'A textbook.', 'online', 'to-campus', now()),
  ('to-l3', pg_temp.s('d0'), 'available', 'item', 'Sample lamp', 'to-category', 'good', 100, 'cash', 'A lamp.', 'online', 'to-campus', now());
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, created_at, updated_at) values
  ('to-r1', pg_temp.a('d2'), 'Need a desk lamp', 'to-category', 'to-campus', 'A lamp for late study nights.', now() - interval '3 days', now() - interval '3 days'),
  ('to-r2', pg_temp.a('d2'), 'Need a stapler', 'to-category', 'to-campus', 'A stapler for my project.', now() - interval '3 days', now() - interval '3 days'),
  ('to-r3', null, 'Lift to Midrand', 'to-category', 'to-campus', 'A lift on Friday mornings, please.', now() - interval '3 days', now() - interval '3 days');

-- --- The column -------------------------------------------------------------------------------------------------------

select col_type_is('public', 'reports', 'target_owner_id', 'uuid', 'reports has target_owner_id, a uuid');
select fk_ok('public', 'reports', 'target_owner_id', 'public', 'profiles', 'id', 'which refers to a profile');
select is(
  (select confdeltype from pg_constraint
   where conrelid = 'public.reports'::regclass and contype = 'f'
     and conkey = array[(select attnum from pg_attribute where attrelid = 'public.reports'::regclass and attname = 'target_owner_id')]),
  'n'::"char",
  'and is cleared when that profile is deleted (on delete set null)'
);
select ok(
  exists (
    select 1 from pg_index i
    where i.indrelid = 'public.reports'::regclass
      and i.indkey[0] = (select attnum from pg_attribute where attrelid = 'public.reports'::regclass and attname = 'target_owner_id')
  ),
  'with an index for the foreign key'
);

-- --- When it's made ---------------------------------------------------------------------------------------------------

select pg_temp.sign_in('d3');
select public.create_report('listing', 'to-l1', 'x', 'scam');
select public.create_report('listing', 'to-l2', 'x', 'scam');
select public.create_report('seller', 'to-lerato', 'x', 'scam');
select public.create_report('request', 'to-r1', 'x', 'spam');
select public.create_report('request', 'to-r2', 'x', 'spam');
select public.create_report('seller', 'to-sample', 'x', 'scam');
select public.create_report('listing', 'to-l3', 'x', 'scam');
select public.create_report('request', 'to-r3', 'x', 'spam');
select pg_temp.sign_out();

select is(pg_temp.owner('listing', 'to-l1'), pg_temp.a('d1'), 'a report on a listing records its shop''s owner');
select is(pg_temp.owner('seller', 'to-lerato'), pg_temp.a('d1'), 'a report on a shop records its owner');
select is(pg_temp.owner('request', 'to-r1'), pg_temp.a('d2'), 'a report on a request records its asker');
select is(pg_temp.owner('seller', 'to-sample'), null, 'a sample shop has no owner to record');
select is(pg_temp.owner('listing', 'to-l3'), null, 'nor has a sample shop''s listing');
select is(pg_temp.owner('request', 'to-r3'), null, 'nor a sample request');

-- --- Who can read it --------------------------------------------------------------------------------------------------

select ok(
  not has_column_privilege('authenticated', 'public.reports', 'target_owner_id', 'select'),
  'a signed-in reporter can''t read whose the target was'
);
select ok(not has_column_privilege('anon', 'public.reports', 'target_owner_id', 'select'), 'nor can anon');
select is(
  array(select column_name::text from information_schema.columns
        where table_schema = 'public' and table_name = 'staff_reports' and column_name in ('target_owner_id', 'own')
        order by 1),
  array['own'],
  'the staff view shows own, never the recorded owner'
);
select ok(
  (select 'security_invoker=true' = any (c.reloptions) from pg_class c where c.oid = 'public.staff_reports'::regclass),
  'and stays security_invoker (amendment 5)'
);
select is(
  array[
    has_function_privilege('anon', 'private.report_own_kind(uuid, uuid)', 'execute'),
    has_function_privilege('authenticated', 'private.report_own_kind(uuid, uuid)', 'execute'),
    has_function_privilege('service_role', 'private.report_own_kind(uuid, uuid)', 'execute')
  ],
  array[false, true, true],
  'the view''s caller runs report_own_kind (amendment 6); anon never'
);

-- --- report_own_kind: the target exists ----------------------------------------------------------------------------

select is(private.report_own_kind(pg_temp.rep('seller', 'to-lerato'), pg_temp.a('d1')), 'shop', 'Lerato''s own shop is shop');
select is(private.report_own_kind(pg_temp.rep('listing', 'to-l1'), pg_temp.a('d1')), 'listing', 'a listing of it is listing');
select is(private.report_own_kind(pg_temp.rep('request', 'to-r1'), pg_temp.a('d2')), 'request', 'Zola''s own request is request');
select is(
  array[
    private.report_own_kind(pg_temp.rep('listing', 'to-l1'), pg_temp.a('d4')),
    private.report_own_kind(pg_temp.rep('seller', 'to-lerato'), pg_temp.a('d2')),
    private.report_own_kind(pg_temp.rep('request', 'to-r1'), pg_temp.a('d1'))
  ],
  array[null, null, null]::text[],
  'someone else''s is null'
);
update public.listings set hidden_at = now(), hidden_reason = 'Rude.' where id = 'to-l1';
select is(private.report_own_kind(pg_temp.rep('listing', 'to-l1'), pg_temp.a('d1')), 'listing', 'a hidden listing still exists, and is still hers');
select is(
  array[
    private.report_own_kind(pg_temp.rep('seller', 'to-sample'), pg_temp.a('d1')),
    private.report_own_kind(pg_temp.rep('listing', 'to-l3'), pg_temp.a('d1')),
    private.report_own_kind(pg_temp.rep('request', 'to-r3'), pg_temp.a('d2'))
  ],
  array[null, null, null]::text[],
  'a sample target is nobody''s'
);
-- A recorded owner never wins over whose the target is now (toView reads the store while the target exists).
insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, target_owner_id)
values (pg_temp.a('d4'), 'listing', 'to-l3', 'Sample lamp', 'spam', pg_temp.a('d1'));
select is(
  private.report_own_kind((select r.id from public.reports r where r.reporter_id = pg_temp.a('d4')), pg_temp.a('d1')),
  null,
  'while the target exists, its owner now decides, never the recorded one'
);

-- --- report_own_kind: the target has gone ----------------------------------------------------------------------------

delete from public.listings where id = 'to-l2';
select is(private.report_own_kind(pg_temp.rep('listing', 'to-l2'), pg_temp.a('d1')), 'listing', 'a deleted listing stays its owner''s');
delete from public.requests where id = 'to-r2';
select is(private.report_own_kind(pg_temp.rep('request', 'to-r2'), pg_temp.a('d2')), 'request', 'a deleted request stays its asker''s');
insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, target_gone, target_owner_id)
values (pg_temp.a('d3'), 'seller', 'to-old', 'An older shop', 'spam', true, pg_temp.a('d1'));
select is(
  private.report_own_kind((select r.id from public.reports r where r.target_id = 'to-old'), pg_temp.a('d1')),
  'shop',
  'a report about a shop that has gone is its old owner''s shop'
);
select is(
  private.report_own_kind((select r.id from public.reports r where r.target_id = 'to-old'), pg_temp.a('d5')),
  null,
  'even when a new shop has taken the link: not the new owner''s'
);

-- --- staff_reports.own ---------------------------------------------------------------------------------------------------

select pg_temp.sign_in('d1');
select is(
  array(select r.target_kind || ':' || r.target_id || '=' || coalesce(r.own, '-') from public.staff_reports r
        where r.target_id like 'to-%' and r.reporter_id = pg_temp.a('d3') order by r.target_kind, r.target_id),
  array['listing:to-l1=listing', 'listing:to-l2=listing', 'listing:to-l3=-', 'request:to-r1=-', 'request:to-r2=-',
    'request:to-r3=-', 'seller:to-lerato=shop', 'seller:to-old=shop', 'seller:to-sample=-'],
  'Lerato, an admin, sees which reports are about her own shop and its listings'
);
select pg_temp.sign_out();
select pg_temp.sign_in('d2');
select is(
  array(select r.target_kind || ':' || r.target_id || '=' || coalesce(r.own, '-') from public.staff_reports r
        where r.target_id like 'to-%' and r.own is not null order by r.target_kind, r.target_id),
  array['request:to-r1=request', 'request:to-r2=request'],
  'Zola, an admin, sees her own requests'
);
select pg_temp.sign_out();
select pg_temp.sign_in('d4');
select is(
  (select count(*) from public.staff_reports r where r.target_id like 'to-%' and r.own is not null),
  0::bigint,
  'Adam, an admin who owns nothing, sees none as his own'
);
select pg_temp.sign_out();

-- --- Account deletion ------------------------------------------------------------------------------------------------

select public.forget_account(pg_temp.a('d1'));
delete from auth.users where id = pg_temp.a('d1');
select is(
  (select count(*) from public.reports r where r.target_id in ('to-l1', 'to-l2', 'to-lerato', 'to-old')),
  4::bigint,
  'deleting the owner''s account leaves the reports about their shop'
);
select is(
  (select count(*) from public.reports r where r.target_owner_id = pg_temp.a('d1')),
  0::bigint,
  'and clears their recorded ownership'
);

select * from finish();
rollback;
