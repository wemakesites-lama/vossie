-- Phase C5, Task 17: Edit shop keeps a pickup listing on a point the Hub has since retired, as the sample store does
-- (updateShop, lib/data/shops.ts; selling amendment 13.6; the controller's ruling after C2: the sample's behaviour is
-- the rule). A point the seller merely stops using still moves its listings to the shop's first point, or online.
begin;
select plan(9);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.p(n text) returns uuid language sql immutable as $f$
  select ('20000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pg_temp.a(n), 'role', 'authenticated', 'session_id', '50000000-0000-4000-8000-0000000000' || n)::text,
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
-- A listing's handover and point, as a line: 'pickup | <point>'.
create function pg_temp.spot(listing text) returns text language sql as $f$
  select concat_ws(' | ', l.handover, coalesce(l.pickup_point_id::text, 'none')) from public.listings l where l.id = listing;
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('c5-campus', 'C5 campus', 'Gauteng', 96), ('c5-other', 'C5 other', 'Gauteng', 95);
insert into public.categories (slug, name, sort) values ('c5-category', 'C5 category', 98);
insert into public.pickup_points (id, campus_slug, name) values
  (pg_temp.p('51'), 'c5-campus', 'Retiring gate'),
  (pg_temp.p('52'), 'c5-campus', 'Kept gate'),
  (pg_temp.p('53'), 'c5-campus', 'Dropped gate'),
  (pg_temp.p('54'), 'c5-other', 'Other gate');

insert into auth.users (id, email) values (pg_temp.a('51'), 'c5-51@eduvos.com');
insert into public.profiles (id, first_name, campus_slug) values (pg_temp.a('51'), 'Seller', 'c5-campus');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
values ('10000000-0000-4000-8000-000000000051', 'c5-shop', pg_temp.a('51'), 'Keep shop', 'c5-category', 'c5-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, approved_at)
values (pg_temp.a('51'), 'approved', '10000000-0000-4000-8000-000000000051', now());
insert into public.shop_pickup_points (shop_id, pickup_point_id) values
  ('10000000-0000-4000-8000-000000000051', pg_temp.p('51')),
  ('10000000-0000-4000-8000-000000000051', pg_temp.p('53'));
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, pickup_point_id, campus_slug, first_published_at)
values
  ('c5-retired', '10000000-0000-4000-8000-000000000051', 'available', 'item', 'On the retired point', 'c5-category', 'good', 10, 'cash', 'x', 'pickup', pg_temp.p('51'), 'c5-campus', now()),
  ('c5-dropped', '10000000-0000-4000-8000-000000000051', 'available', 'item', 'On the dropped point', 'c5-category', 'good', 10, 'cash', 'x', 'pickup', pg_temp.p('53'), 'c5-campus', now()),
  ('c5-campus', '10000000-0000-4000-8000-000000000051', 'available', 'item', 'Collected on campus', 'c5-category', 'good', 10, 'cash', 'x', 'on-campus', null, 'c5-campus', now());

update public.pickup_points set retired_at = now() where id = pg_temp.p('51');

select pg_temp.sign_in('51');
select is(
  public.update_shop('Keep shop', '', 'c5-category', 'x', 'c5-campus', array[pg_temp.p('52')], null, false, null) ->> 'result',
  'saved',
  'Edit shop saves with the point in use'
);
select pg_temp.sign_out();

select is(pg_temp.spot('c5-retired'), 'pickup | ' || pg_temp.p('51'), 'a listing on a retired point keeps it (updateShop)');
select is(pg_temp.spot('c5-dropped'), 'pickup | ' || pg_temp.p('52'), 'a point the seller stops using moves its listing to the first point');
select is(pg_temp.spot('c5-campus'), 'on-campus | none', 'a listing collected on campus is left alone');
select is(
  array(select pickup_point_id from public.shop_pickup_points where shop_id = '10000000-0000-4000-8000-000000000051'),
  array[pg_temp.p('52')],
  'the shop uses only the points given'
);

-- Moving campus: the listings follow the campus; the retired point's listing still keeps its point, as the sample does.
select pg_temp.sign_in('51');
select is(
  public.update_shop('Keep shop', '', 'c5-category', 'x', 'c5-other', array[pg_temp.p('54')], null, false, null) ->> 'result',
  'saved',
  'Edit shop saves on another campus'
);
select pg_temp.sign_out();
select is(pg_temp.spot('c5-retired'), 'pickup | ' || pg_temp.p('51'), 'a moved shop''s listing keeps its retired point');
select is(pg_temp.spot('c5-dropped'), 'pickup | ' || pg_temp.p('54'), 'the other listing moves to the new campus''s point');
select is(
  (select campus_slug from public.listings where id = 'c5-retired'),
  'c5-other',
  'the listing follows the shop''s campus'
);

select * from finish();
rollback;
