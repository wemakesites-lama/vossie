-- AI stage I1: Shop coach's weeks and ticks (AI round two spec 2 and 4; plan 2026-11-04-ai-stage-i1-shop-coach-core.md,
-- Task 5). coach_weeks and coach_ticks are closed to every API role; the owner reads their weeks (never the mentor
-- questions) through own_coach_weeks, the shop's mentor or an admin reads them through staff_coach_weeks, the seller
-- ticks through tick_coach_action, and deleting the shop (or the account) deletes them.
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
create function pg_temp.as_service() returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
end;
$f$;
grant execute on all functions in schema pg_temp to public;
-- This SAST week's Monday, worked out as the test's own role: the API roles have no USAGE on private.
create temp table wk as select private.coach_week_of(now()) as this_week;
grant select on wk to public;

insert into public.campuses (slug, name, region, sort) values ('sc-campus', 'Coach campus', 'Gauteng', 96);
insert into public.categories (slug, name, sort) values ('sc-category', 'Coach category', 97);
-- f1 Lerato sells; f2 Thandi is a student; f3 Musa mentors f1's shop; f4 Adam is an admin; f5 Sipho is another mentor.
insert into auth.users (id, email)
select pg_temp.a(n), 'sc-' || n || '@eduvos.com' from unnest(array['f1', 'f2', 'f3', 'f4', 'f5']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('f1'), 'Lerato', 'sc-campus', '{}'),
  (pg_temp.a('f2'), 'Thandi', 'sc-campus', '{}'),
  (pg_temp.a('f3'), 'Musa', 'sc-campus', '{mentor}'),
  (pg_temp.a('f4'), 'Adam', 'sc-campus', '{admin}'),
  (pg_temp.a('f5'), 'Sipho', 'sc-campus', '{mentor}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('f1'), 'sc-lerato', pg_temp.a('f1'), 'Lerato coaching', 'sc-category', 'sc-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at, mentor_id) values
  (pg_temp.a('f1'), 'approved', pg_temp.s('f1'), now() - interval '9 days', now() - interval '8 days', pg_temp.a('f3'));

-- This week's row (three actions, two mentor questions) and last week's, settled; made as the service role.
select pg_temp.as_service();
insert into public.coach_weeks (shop_id, week, actions, mentor_questions, written_by) values
  (pg_temp.s('f1'), (select this_week from wk),
   '[{"id": "read-tip:t-1"}, {"id": "check-price:l-1"}, {"id": "list-more:shop"}]',
   '["How did the photos go?", "What sold this week?"]', 'fixed');
insert into public.coach_weeks (shop_id, week, actions, written_by, done_ids, gone_ids, settled_at) values
  (pg_temp.s('f1'), (select this_week from wk) - 7, '[{"id": "read-tip:t-0"}]', 'fixed', '{}', '{}', now());
select pg_temp.sign_out();

select has_table('public', 'coach_weeks', 'coach_weeks exists');
select has_table('public', 'coach_ticks', 'coach_ticks exists');
select is(
  (select count(*)::int from pg_class where oid in ('public.coach_weeks'::regclass, 'public.coach_ticks'::regclass) and relrowsecurity),
  2, 'row level security is on for both'
);
select ok(not has_table_privilege('authenticated', 'public.coach_weeks', 'select'), 'signed-in users select no week');
select ok(not has_table_privilege('anon', 'public.coach_weeks', 'select'), 'nor does anon');
select ok(not has_table_privilege('authenticated', 'public.coach_ticks', 'select'), 'signed-in users select no tick');
select ok(not has_table_privilege('anon', 'public.coach_ticks', 'select'), 'nor does anon');

select throws_ok(
  format($$ insert into public.coach_weeks (shop_id, week, actions, written_by) values (%L, '2026-11-10', '[]', 'fixed') $$, pg_temp.s('f1')),
  '23514', null, 'a week must start on a Monday'
);
select throws_ok(
  format($$ insert into public.coach_weeks (shop_id, week, actions, written_by) values (%L, '2026-01-05', '[1, 2, 3, 4]', 'fixed') $$, pg_temp.s('f1')),
  '23514', null, 'four actions are refused'
);
select throws_ok(
  format($$ insert into public.coach_weeks (shop_id, week, actions, written_by) values (%L, '2026-01-05', '[]', 'robot') $$, pg_temp.s('f1')),
  '23514', null, 'so is an unknown writer'
);
select throws_ok(
  format($$ insert into public.coach_weeks (shop_id, week, actions, mentor_questions, written_by) values (%L, '2026-01-05', '[]', '["One only"]', 'fixed') $$, pg_temp.s('f1')),
  '23514', null, 'so is one mentor question'
);
select throws_ok(
  format($$ insert into public.coach_weeks (shop_id, week, actions, written_by, done_ids) values (%L, '2026-01-05', '[]', 'fixed', '{}') $$, pg_temp.s('f1')),
  '23514', null, 'and done ids without a settled time'
);

select pg_temp.sign_in('f1');
select is((select count(*)::int from public.own_coach_weeks(null)), 2, 'the owner reads both weeks');
select is(
  (select week from public.own_coach_weeks(null) limit 1), (select this_week from wk), 'newest first'
);
select ok(
  pg_get_function_result('public.own_coach_weeks(date)'::regprocedure) !~ 'mentor_questions',
  'their read has no mentor questions column'
);
select pg_temp.sign_out();

select pg_temp.sign_in('f2');
select is((select count(*)::int from public.own_coach_weeks(null)), 0, 'another student reads none');
select pg_temp.sign_out();
set local role anon;
select throws_ok($$select * from public.own_coach_weeks(null)$$, '42501', null, 'anon reads none');
reset role;

select pg_temp.sign_in('f3');
select is((select count(*)::int from public.staff_coach_weeks(pg_temp.s('f1'), null)), 2, 'the shop''s mentor reads both weeks');
select is(
  (select mentor_questions ->> 1 from public.staff_coach_weeks(pg_temp.s('f1'), null) where mentor_questions is not null),
  'What sold this week?', 'with the mentor questions'
);
select pg_temp.sign_out();
select pg_temp.sign_in('f4');
select is((select count(*)::int from public.staff_coach_weeks(pg_temp.s('f1'), null)), 2, 'an admin reads them');
select pg_temp.sign_out();
select pg_temp.sign_in('f5');
select is((select count(*)::int from public.staff_coach_weeks(pg_temp.s('f1'), null)), 0, 'another shop''s mentor reads none');
select pg_temp.sign_out();
update public.profiles set roles = '{admin}' where id = pg_temp.a('f1');
select pg_temp.sign_in('f1');
select is(
  (select count(*)::int from public.staff_coach_weeks(pg_temp.s('f1'), null)), 0, 'the owner reads none, even holding the admin role'
);
select pg_temp.sign_out();
update public.profiles set roles = '{}' where id = pg_temp.a('f1');

select pg_temp.sign_in('f1');
select is(public.tick_coach_action('read-tip:t-1'), 'ticked', 'the seller ticks a tip');
select is(public.tick_coach_action('read-tip:t-1'), 'already', 'once');
select is(public.tick_coach_action('list-more:shop'), 'not-found', 'not an action the app checks');
select is(public.tick_coach_action('read-tip:t-0'), 'not-found', 'not last week''s');
select pg_temp.sign_out();
select pg_temp.sign_in('f2');
select is(public.tick_coach_action('read-tip:t-1'), 'not-found', 'another student ticks nothing');
select pg_temp.sign_out();
select pg_temp.sign_in('f1');
select is(
  (select ticks from public.own_coach_weeks(null) order by week desc limit 1),
  array['read-tip:t-1'], 'the tick shows on this week''s row'
);
select pg_temp.sign_out();

delete from public.shops where id = pg_temp.s('f1');
select is((select count(*)::int from public.coach_weeks where shop_id = pg_temp.s('f1')), 0, 'deleting the shop deletes its weeks');
select is((select count(*)::int from public.coach_ticks where shop_id = pg_temp.s('f1')), 0, 'and its ticks');

-- A fresh shop and week, then forget_account.
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('f2'), 'sc-thandi', pg_temp.a('f2'), 'Thandi coaching', 'sc-category', 'sc-campus', '2026-01');
insert into public.coach_weeks (shop_id, week, actions, written_by) values
  (pg_temp.s('f2'), (select this_week from wk), '[]', 'fixed');
select pg_temp.as_service();
select public.forget_account(pg_temp.a('f2'));
select pg_temp.sign_out();
select is(
  (select count(*)::int from public.coach_weeks where shop_id = pg_temp.s('f2')), 0, 'forgetting the account leaves no week'
);

select * from finish();
rollback;
