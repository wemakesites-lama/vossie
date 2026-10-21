-- Step 2b, Task 6: no admin makes a Hub decision about their own shop, a listing of it or their own Looking For request
-- (stage L spec decisions 1 to 3; supabase step 2b plan, decision 7; amendment 7). Each staff function refuses with
-- 'own-shop' or 'own-request', as the app's refuseOwn (lib/staff/admin-actions.ts) leaves its notice, right after the
-- role check and before the reason is checked or anything is read for writing: no row changes, no audit entry, nobody
-- told. "Own" is owned now (isOwnShop, isOwnListing, isOwnRequest, lib/data/staff-shops.ts; a report's own,
-- lib/data/staff-reports.ts, falls back to whose the target was once it has gone). Another admin acts as before.
begin;
select plan(76);

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
create function pg_temp.today() returns date language sql as $f$
  select (now() at time zone 'Africa/Johannesburg')::date;
$f$;
-- The open report Thandi made about a target.
create function pg_temp.rep(target text) returns uuid language sql as $f$
  select r.id from public.reports r where r.target_id = target;
$f$;
-- Every row a staff decision could touch, as text: the fixture's shops, their seller profiles, listings, requests and
-- the fixture's profiles (roles), and every report, Featured pin and draw.
create function pg_temp.state() returns text[] language sql as $f$
  select array[
    (select string_agg(row(s.*)::text, ';' order by s.id) from public.shops s where s.slug like 'og-%'),
    (select string_agg(row(sp.*)::text, ';' order by sp.account_id) from public.seller_profiles sp
     where sp.account_id in (select p.id from public.profiles p where p.campus_slug = 'og-campus')),
    (select string_agg(row(l.*)::text, ';' order by l.id) from public.listings l where l.id like 'og-%'),
    (select string_agg(row(q.*)::text, ';' order by q.id) from public.requests q where q.id like 'og-%'),
    (select string_agg(row(p.*)::text, ';' order by p.id) from public.profiles p where p.campus_slug = 'og-campus'),
    (select string_agg(row(r.*)::text, ';' order by r.id) from public.reports r),
    (select string_agg(row(f.*)::text, ';' order by f.id) from public.featured_pins f),
    (select string_agg(row(d.*)::text, ';' order by d.id) from public.featured_draws d)
  ];
$f$;
create function pg_temp.logs() returns bigint[] language sql as $f$
  select array[(select count(*) from public.audit_log), (select count(*) from public.notifications)];
$f$;
create temp table kept (state text[], logs bigint[]);
-- Account n makes the call: the answer is the code, and nothing at all is written (three tests).
create function pg_temp.refused(n text, call text, code text, what text) returns setof text language plpgsql as $f$
declare
  got text;
begin
  delete from kept;
  insert into kept select pg_temp.state(), pg_temp.logs();
  perform pg_temp.sign_in(n);
  execute 'select ' || call into got;
  perform pg_temp.sign_out();
  return next is(got, code, what);
  return next is(pg_temp.state(), (select k.state from kept k), what || ': no row changes');
  return next is(pg_temp.logs(), (select k.logs from kept k), what || ': no audit entry, nobody told');
end;
$f$;
-- Account n makes the call, and it changes something (one test).
create function pg_temp.changed(n text, call text, what text) returns text language plpgsql as $f$
declare
  got text;
begin
  perform pg_temp.sign_in(n);
  execute 'select ' || call into got;
  perform pg_temp.sign_out();
  return is(got, 'changed', what);
end;
$f$;
-- A step before a case, by account n, which must change something.
create function pg_temp.act(n text, call text) returns void language plpgsql as $f$
declare
  got text;
begin
  perform pg_temp.sign_in(n);
  execute 'select ' || call into got;
  perform pg_temp.sign_out();
  if got is distinct from 'changed' then
    raise exception 'setup % answered %', call, got;
  end if;
end;
$f$;

insert into public.campuses (slug, name, region, sort) values ('og-campus', 'Own campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('og-category', 'Own category', 99);
-- a1 Adam, an admin with an open shop, a listing and a request; a2 Ama, an admin whose shop is waiting; a3 Busi, an
-- admin who owns nothing; a4 Thandi, a student who reports; a5 Mona, a mentor; a6 Kabelo, a seller without a role.
-- a0 is a sample shop no account owns.
insert into auth.users (id, email)
select pg_temp.a(n), 'og-' || n || '@eduvos.com' from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'a6']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('a1'), 'Adam', 'og-campus', '{admin}'),
  (pg_temp.a('a2'), 'Ama', 'og-campus', '{admin}'),
  (pg_temp.a('a3'), 'Busi', 'og-campus', '{admin}'),
  (pg_temp.a('a4'), 'Thandi', 'og-campus', '{}'),
  (pg_temp.a('a5'), 'Mona', 'og-campus', '{mentor}'),
  (pg_temp.a('a6'), 'Kabelo', 'og-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since, verified) values
  (pg_temp.s('a1'), 'og-adam', pg_temp.a('a1'), 'Adam prints', 'og-category', 'og-campus', '2026-01', true),
  (pg_temp.s('a2'), 'og-ama', pg_temp.a('a2'), 'Ama bakes', 'og-category', 'og-campus', '2026-01', false),
  (pg_temp.s('a6'), 'og-kabelo', pg_temp.a('a6'), 'Kabelo kicks', 'og-category', 'og-campus', '2026-01', true),
  (pg_temp.s('a0'), 'og-sample', null, 'Sample stall', 'og-category', 'og-campus', '2026-01', true);
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at) values
  (pg_temp.a('a1'), 'approved', pg_temp.s('a1'), now() - interval '9 days', now() - interval '8 days'),
  (pg_temp.a('a2'), 'pending', pg_temp.s('a2'), now() - interval '2 days', null),
  (pg_temp.a('a6'), 'approved', pg_temp.s('a6'), now() - interval '9 days', now() - interval '8 days');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('og-la', pg_temp.s('a1'), 'available', 'item', 'Graphing calculator', 'og-category', 'good', 300, 'cash', 'A calculator.', 'online', 'og-campus', now()),
  ('og-la2', pg_temp.s('a1'), 'available', 'item', 'Old textbook', 'og-category', 'good', 100, 'cash', 'A textbook.', 'online', 'og-campus', now());
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, created_at, updated_at) values
  ('og-ra', pg_temp.a('a1'), 'Need a desk lamp', 'og-category', 'og-campus', 'A lamp for late study nights.', now() - interval '3 days', now() - interval '3 days'),
  ('og-ra2', pg_temp.a('a1'), 'Need a stapler', 'og-category', 'og-campus', 'A stapler for my project.', now() - interval '3 days', now() - interval '3 days'),
  ('og-rk', pg_temp.a('a6'), 'Need a ruler', 'og-category', 'og-campus', 'A ruler for my project.', now() - interval '3 days', now() - interval '3 days');
-- One pin on Adam's shop for tomorrow, and the campus's drawn rows for today and tomorrow.
insert into public.featured_pins (id, shop_id, campus_slug, day, pinned_by)
values ('20000000-0000-4000-8000-0000000000a1', pg_temp.s('a1'), 'og-campus', pg_temp.today() + 1, pg_temp.a('a3'));
insert into public.featured_draws (campus_slug, day, shop_ids) values
  ('og-campus', pg_temp.today(), array[pg_temp.s('a1')]), ('og-campus', pg_temp.today() + 1, array[pg_temp.s('a1')]);

grant all on kept to public;
grant execute on all functions in schema pg_temp to public;

-- Thandi reports Adam's shop, both listings and both requests; then one listing and one request are deleted.
select pg_temp.sign_in('a4');
select public.create_report('seller', 'og-adam', 'x', 'scam');
select public.create_report('listing', 'og-la', 'x', 'scam');
select public.create_report('listing', 'og-la2', 'x', 'scam');
select public.create_report('request', 'og-ra', 'x', 'spam');
select public.create_report('request', 'og-ra2', 'x', 'spam');
select pg_temp.sign_out();
delete from public.listings where id = 'og-la2';
delete from public.requests where id = 'og-ra2';

-- --- The helper and the functions -------------------------------------------------------------------------------------

select is(
  array[
    has_function_privilege('anon', 'private.is_own_shop(uuid)', 'execute'),
    has_function_privilege('authenticated', 'private.is_own_shop(uuid)', 'execute'),
    has_function_privilege('service_role', 'private.is_own_shop(uuid)', 'execute')
  ],
  array[false, false, false],
  'is_own_shop runs only inside the staff functions'
);
select is(
  array(
    select f from unnest(array[
      'public.approve_shop(uuid)', 'public.decline_shop(uuid, text)', 'public.set_shop_verified(uuid, boolean)',
      'public.staff_pause_shop(uuid, text)', 'public.staff_resume_shop(uuid)', 'public.set_shop_mentor(uuid, uuid)',
      'public.dismiss_report(uuid, text)', 'public.hide_listing(text, text)', 'public.hide_request(text, text)',
      'public.show_listing(text)', 'public.show_request(text)', 'public.pin_shop(uuid, text, date)',
      'public.unpin_shop(uuid)'
    ]) f
    where has_function_privilege('anon', f, 'execute')
      or not has_function_privilege('authenticated', f, 'execute')
      or not has_function_privilege('service_role', f, 'execute')
  ),
  '{}'::text[],
  'the thirteen keep their grants: signed-in people and the server, never anon'
);
-- As the staff functions run it: as their owner, with Adam's session.
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.a('a1'), 'role', 'authenticated')::text, true);
select is(
  array[private.is_own_shop(pg_temp.s('a1')), private.is_own_shop(pg_temp.s('a6')), private.is_own_shop(pg_temp.s('a0')),
    private.is_own_shop(null)],
  array[true, false, false, false],
  'own means owned by the signed-in account now; a sample shop is nobody''s'
);
select pg_temp.sign_out();

-- --- Adam (or Ama) on their own: refused, nothing written ---------------------------------------------------------

select pg_temp.refused('a2', format('public.approve_shop(%L)', pg_temp.a('a2')), 'own-shop', 'Ama can''t approve her own waiting shop');
select pg_temp.refused('a2', format('public.decline_shop(%L, %L)', pg_temp.a('a2'), ''), 'own-shop',
  'nor decline it, even with no reason: the gate comes before the reason check');
select pg_temp.refused('a1', format('public.set_shop_verified(%L, false)', pg_temp.s('a1')), 'own-shop', 'Adam can''t take Verified from his own shop');
select pg_temp.refused('a1', format('public.staff_pause_shop(%L, %L)', pg_temp.s('a1'), 'Rude.'), 'own-shop', 'nor pause it');
savepoint paused;
select pg_temp.act('a3', format('public.staff_pause_shop(%L, %L)', pg_temp.s('a1'), 'Rude.'));
select pg_temp.refused('a1', format('public.staff_resume_shop(%L)', pg_temp.s('a1')), 'own-shop', 'nor resume it after Busi paused it');
rollback to savepoint paused;
select pg_temp.refused('a1', format('public.set_shop_mentor(%L, %L)', pg_temp.s('a1'), pg_temp.a('a5')), 'own-shop', 'nor choose its mentor');
select pg_temp.refused('a1', format('public.dismiss_report(%L, %L)', pg_temp.rep('og-adam'), 'Fine.'), 'own-shop', 'nor dismiss a report on his shop');
select pg_temp.refused('a1', format('public.dismiss_report(%L, %L)', pg_temp.rep('og-la'), 'Fine.'), 'own-shop', 'nor on its listing');
select pg_temp.refused('a1', format('public.dismiss_report(%L, %L)', pg_temp.rep('og-ra'), 'Fine.'), 'own-request', 'nor on his request');
select pg_temp.refused('a1', format('public.dismiss_report(%L, %L)', pg_temp.rep('og-la2'), 'Fine.'), 'own-shop',
  'nor on a listing of his that has gone (the recorded owner)');
select pg_temp.refused('a1', format('public.dismiss_report(%L, %L)', pg_temp.rep('og-ra2'), 'Fine.'), 'own-request',
  'nor on a request of his that has gone');
select pg_temp.refused('a1', format('public.hide_listing(%L, %L)', 'og-la', 'Rude.'), 'own-shop', 'nor hide his listing');
select pg_temp.refused('a1', format('public.hide_request(%L, %L)', 'og-ra', 'Rude.'), 'own-request', 'nor hide his request');
savepoint hidden;
select pg_temp.act('a3', format('public.hide_listing(%L, %L)', 'og-la', 'Rude.'));
select pg_temp.act('a3', format('public.hide_request(%L, %L)', 'og-ra', 'Rude.'));
select pg_temp.refused('a1', format('public.show_listing(%L)', 'og-la'), 'own-shop', 'nor show his listing again after Busi hid it');
select pg_temp.refused('a1', format('public.show_request(%L)', 'og-ra'), 'own-request', 'nor his request');
rollback to savepoint hidden;
select pg_temp.refused('a1', format('public.pin_shop(%L, %L, %L)', pg_temp.s('a1'), 'og-campus', pg_temp.today()), 'own-shop', 'nor pin his shop');
select pg_temp.refused('a1', format('public.unpin_shop(%L)', '20000000-0000-4000-8000-0000000000a1'), 'own-shop', 'nor unpin it');

-- pin_shop's order (amendment 7): a malformed campus is an argument error and still raises; the gate comes before the day.
select pg_temp.sign_in('a1');
select throws_ok(
  format($$select public.pin_shop(%L, 'og-nowhere', %L)$$, pg_temp.s('a1'), pg_temp.today()),
  '22023', null, 'a campus that isn''t one still raises first'
);
select is(
  public.pin_shop(pg_temp.s('a1'), 'og-campus', pg_temp.today() - 1), 'own-shop', 'and his own shop is refused before day-past'
);
select pg_temp.sign_out();

-- --- Busi, who owns none of it, acts as before -------------------------------------------------------------------------

savepoint b; select pg_temp.changed('a3', format('public.approve_shop(%L)', pg_temp.a('a2')), 'Busi approves Ama''s shop'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.decline_shop(%L, %L)', pg_temp.a('a2'), 'Blurry photos.'), 'or declines it'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.set_shop_verified(%L, false)', pg_temp.s('a1')), 'takes Verified from Adam''s shop'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.staff_pause_shop(%L, %L)', pg_temp.s('a1'), 'Rude.'), 'pauses it'); rollback to savepoint b;
savepoint b;
select pg_temp.act('a3', format('public.staff_pause_shop(%L, %L)', pg_temp.s('a1'), 'Rude.'));
select pg_temp.changed('a3', format('public.staff_resume_shop(%L)', pg_temp.s('a1')), 'resumes it');
rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.set_shop_mentor(%L, %L)', pg_temp.s('a1'), pg_temp.a('a5')), 'chooses its mentor'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.dismiss_report(%L, %L)', pg_temp.rep('og-adam'), 'Fine.'), 'dismisses the report on the shop'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.dismiss_report(%L, %L)', pg_temp.rep('og-la'), 'Fine.'), 'on its listing'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.dismiss_report(%L, %L)', pg_temp.rep('og-ra'), 'Fine.'), 'on Adam''s request'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.dismiss_report(%L, %L)', pg_temp.rep('og-la2'), 'Fine.'), 'on the listing that has gone'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.dismiss_report(%L, %L)', pg_temp.rep('og-ra2'), 'Fine.'), 'on the request that has gone'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.hide_listing(%L, %L)', 'og-la', 'Rude.'), 'hides the listing'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.hide_request(%L, %L)', 'og-ra', 'Rude.'), 'hides the request'); rollback to savepoint b;
savepoint b;
select pg_temp.act('a3', format('public.hide_listing(%L, %L)', 'og-la', 'Rude.'));
select pg_temp.changed('a3', format('public.show_listing(%L)', 'og-la'), 'shows the listing again');
rollback to savepoint b;
savepoint b;
select pg_temp.act('a3', format('public.hide_request(%L, %L)', 'og-ra', 'Rude.'));
select pg_temp.changed('a3', format('public.show_request(%L)', 'og-ra'), 'shows the request again');
rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.pin_shop(%L, %L, %L)', pg_temp.s('a1'), 'og-campus', pg_temp.today()), 'pins the shop'); rollback to savepoint b;
savepoint b; select pg_temp.changed('a3', format('public.unpin_shop(%L)', '20000000-0000-4000-8000-0000000000a1'), 'unpins it'); rollback to savepoint b;

-- --- Rules that stay -------------------------------------------------------------------------------------------------

savepoint b;
select pg_temp.changed('a1', format('public.set_shop_verified(%L, false)', pg_temp.s('a0')), 'a sample shop is nobody''s: Adam may take Verified from it');
rollback to savepoint b;
select pg_temp.sign_in('a1');
select is(public.add_mentor_note(pg_temp.a('a1'), 'A note.', null), 'forbidden', 'a mentor note about yourself is still forbidden');
select pg_temp.sign_out();
select pg_temp.sign_in('a6');
select is(
  array[
    public.set_shop_verified(pg_temp.s('a6'), false), public.staff_pause_shop(pg_temp.s('a6'), 'Rude.'),
    public.hide_request('og-rk', 'Rude.'), public.approve_shop(pg_temp.a('a6'))
  ],
  array['forbidden', 'forbidden', 'forbidden', 'forbidden'],
  'someone without the role is forbidden before the gate, so nothing hints whose a shop is'
);
select pg_temp.sign_out();

select * from finish();
rollback;
