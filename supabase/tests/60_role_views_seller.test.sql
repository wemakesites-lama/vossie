-- Role views N2: the seller home's two reads (role views spec 6 and 7.1; N2 plan decisions 2, 3 and 10).
-- public.seller_queue: buyers waiting, sales to mark as sold, drafts, Hub-hidden and paused listings, the listings by
-- state and whether the shop ever replied, for the shop's owner only. public.follower_counts: how many follow, and how
-- many since a time, for the owner only, never who. lib/data/seller-queue.ts and lib/data/follows.ts are the sample's.
-- And hide_listing and show_listing now move the listing's updated_at (plan decision 3).
begin;
select plan(22);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.c(n text) returns uuid language sql immutable as $f$
  select ('40000000-0000-4000-8000-0000000000' || n)::uuid;
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
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('n2-campus', 'N2 campus', 'Gauteng', 94);
insert into public.categories (slug, name, sort) values ('n2-category', 'N2 category', 97);

-- 61 owns the shop under test; 62, 63 and 66 buy; 64 owns a new shop with nothing yet; 65 is an admin; 67 owns another.
insert into auth.users (id, email) values
  (pg_temp.a('61'), 'n2-61@eduvos.com'), (pg_temp.a('62'), 'n2-62@eduvos.com'), (pg_temp.a('63'), 'n2-63@eduvos.com'),
  (pg_temp.a('64'), 'n2-64@eduvos.com'), (pg_temp.a('65'), 'n2-65@eduvos.com'), (pg_temp.a('66'), 'n2-66@eduvos.com'),
  (pg_temp.a('67'), 'n2-67@eduvos.com');
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('61'), 'Owner', 'n2-campus', '{}'), (pg_temp.a('62'), 'Buyer', 'n2-campus', '{}'),
  (pg_temp.a('63'), 'Asker', 'n2-campus', '{}'), (pg_temp.a('64'), 'Fresh', 'n2-campus', '{}'),
  (pg_temp.a('65'), 'Admin', 'n2-campus', array['admin']), (pg_temp.a('66'), 'Third', 'n2-campus', '{}'),
  (pg_temp.a('67'), 'Other', 'n2-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('61'), 'n2-shop', pg_temp.a('61'), 'N2 shop', 'n2-category', 'n2-campus', '2026-10'),
  (pg_temp.s('64'), 'n2-fresh', pg_temp.a('64'), 'N2 fresh', 'n2-category', 'n2-campus', '2026-10'),
  (pg_temp.s('67'), 'n2-other', pg_temp.a('67'), 'N2 other', 'n2-category', 'n2-campus', '2026-10');
insert into public.seller_profiles (account_id, status, shop_id, approved_at) values
  (pg_temp.a('61'), 'approved', pg_temp.s('61'), now()),
  (pg_temp.a('64'), 'approved', pg_temp.s('64'), now()),
  (pg_temp.a('67'), 'approved', pg_temp.s('67'), now());

insert into public.listings
  (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at, updated_at, hidden_at, hidden_reason)
values
  ('q-avail', pg_temp.s('61'), 'available', 'item', 'Desk lamp', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-10T08:00Z', null, null),
  ('q-relist', pg_temp.s('61'), 'available', 'item', 'Kettle', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-20T08:00Z', null, null),
  ('q-service', pg_temp.s('61'), 'available', 'service', 'Maths tutoring', 'n2-category', null, 10, 'cash', 'x', 'online', 'n2-campus', '2026-10-01', '2026-10-10T08:00Z', null, null),
  ('q-draft', pg_temp.s('61'), 'draft', 'item', 'Bike', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', null, '2026-10-05T08:00Z', null, null),
  ('q-paused', pg_temp.s('61'), 'paused', 'item', 'Paused lamp', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-08T08:00Z', null, null),
  ('q-hidden', pg_temp.s('61'), 'available', 'item', 'Exam papers', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-10T08:00Z', '2026-10-17T08:00Z', 'Not allowed.'),
  ('q-sold', pg_temp.s('61'), 'sold', 'item', 'Radio', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-09T08:00Z', null, null),
  ('q-other', pg_temp.s('67'), 'available', 'item', 'Other lamp', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-10T08:00Z', null, null);

insert into public.conversations
  (id, listing_id, listing_title, shop_id, buyer_id, seller_gone, status, created_at, first_reply_at, completed_at, confirmed_at, confirmed_by, is_offer, request_title)
values
  -- Waiting: the oldest, a newer one, and a question to the shop.
  (pg_temp.c('61'), 'q-paused', 'Paused lamp', pg_temp.s('61'), pg_temp.a('62'), false, 'asked', '2026-10-17T08:00Z', null, null, null, null, false, null),
  (pg_temp.c('62'), 'q-sold', 'Radio', pg_temp.s('61'), pg_temp.a('62'), false, 'asked', '2026-10-18T08:00Z', null, null, null, null, false, null),
  (pg_temp.c('63'), null, null, pg_temp.s('61'), pg_temp.a('63'), false, 'asked', '2026-10-19T08:00Z', null, null, null, null, false, null),
  -- Not waiting: replied, an offer, a seller who has gone, a buyer who has gone.
  (pg_temp.c('64'), 'q-service', 'Maths tutoring', pg_temp.s('61'), pg_temp.a('63'), false, 'replied', '2026-10-16T08:00Z', '2026-10-16T09:00Z', null, null, null, false, null),
  (pg_temp.c('65'), null, null, pg_temp.s('61'), pg_temp.a('66'), false, 'offered', '2026-10-15T08:00Z', null, null, null, null, true, 'A lamp'),
  (pg_temp.c('66'), 'q-avail', 'Desk lamp', pg_temp.s('61'), pg_temp.a('63'), true, 'asked', '2026-10-10T08:00Z', null, null, null, null, false, null),
  (pg_temp.c('67'), 'q-relist', 'Kettle', pg_temp.s('61'), null, false, 'asked', '2026-10-09T08:00Z', null, null, null, null, false, null),
  -- Sales: two on the desk lamp count (the confirmed one is older); relisted, a service and a hidden listing don't.
  (pg_temp.c('68'), 'q-avail', 'Desk lamp', pg_temp.s('61'), pg_temp.a('62'), false, 'done', '2026-10-11T08:00Z', '2026-10-11T09:00Z', '2026-10-15T08:00Z', null, null, false, null),
  (pg_temp.c('69'), 'q-avail', 'Desk lamp', pg_temp.s('61'), pg_temp.a('66'), false, 'confirmed', '2026-10-10T08:00Z', '2026-10-10T09:00Z', '2026-10-12T08:00Z', '2026-10-13T08:00Z', 'buyer', false, null),
  (pg_temp.c('6a'), 'q-relist', 'Kettle', pg_temp.s('61'), pg_temp.a('62'), false, 'done', '2026-10-11T08:00Z', '2026-10-11T09:00Z', '2026-10-14T08:00Z', null, null, false, null),
  (pg_temp.c('6b'), 'q-service', 'Maths tutoring', pg_temp.s('61'), pg_temp.a('66'), false, 'done', '2026-10-11T08:00Z', '2026-10-11T09:00Z', '2026-10-15T08:00Z', null, null, false, null),
  (pg_temp.c('6c'), 'q-hidden', 'Exam papers', pg_temp.s('61'), pg_temp.a('62'), false, 'done', '2026-10-11T08:00Z', '2026-10-11T09:00Z', '2026-10-16T08:00Z', null, null, false, null),
  -- Another shop's buyer waiting.
  (pg_temp.c('6d'), 'q-other', 'Other lamp', pg_temp.s('67'), pg_temp.a('62'), false, 'asked', '2026-10-01T08:00Z', null, null, null, null, false, null);

insert into public.follows (account_id, shop_id, created_at) values
  (pg_temp.a('62'), pg_temp.s('61'), '2026-10-10T08:00Z'),
  (pg_temp.a('63'), pg_temp.s('61'), '2026-10-21T08:00Z'),
  (pg_temp.a('66'), pg_temp.s('61'), '2026-10-22T08:00Z');

-- Nobody signed out reads either.
set local role anon;
select throws_ok($$select public.seller_queue('n2-shop')$$, '42501', null, 'anon reads no queue');
select throws_ok($$select * from public.follower_counts('10000000-0000-4000-8000-000000000061', now())$$, '42501', null, 'nor counts followers');
reset role;

select pg_temp.sign_in('61');
select is((public.seller_queue('n2-shop') -> 'replies' ->> 'count')::int, 3, 'three buyers wait: two enquiries and a question; not a reply, an offer, or anyone gone');
select is(
  public.seller_queue('n2-shop') -> 'replies' -> 'oldest' ->> 'id',
  pg_temp.c('61')::text,
  'the oldest wait is the one asked first'
);
select is(
  row(public.seller_queue('n2-shop') -> 'replies' -> 'oldest' ->> 'title', (public.seller_queue('n2-shop') -> 'replies' -> 'oldest' ->> 'at')::timestamptz)::text,
  row('Paused lamp', '2026-10-17T08:00Z'::timestamptz)::text,
  'with its listing''s title and when it was asked'
);
select is(
  array(select x ->> 'conversation_id' from jsonb_array_elements(public.seller_queue('n2-shop') -> 'sales') x),
  array[pg_temp.c('69')::text, pg_temp.c('68')::text],
  'sales to mark as sold, oldest first: not relisted since, not a service, not hidden'
);
select is(
  array(select distinct x ->> 'listing_id' from jsonb_array_elements(public.seller_queue('n2-shop') -> 'sales') x),
  array['q-avail'],
  'both on the one listing'
);
select is(
  row((public.seller_queue('n2-shop') -> 'drafts' ->> 'count')::int, public.seller_queue('n2-shop') -> 'drafts' -> 'oldest' ->> 'id')::text,
  row(1, 'q-draft')::text,
  'one draft'
);
select is(
  row(
    (public.seller_queue('n2-shop') -> 'hidden' ->> 'count')::int,
    public.seller_queue('n2-shop') -> 'hidden' -> 'oldest' ->> 'id',
    public.seller_queue('n2-shop') -> 'hidden' -> 'oldest' ->> 'state'
  )::text,
  row(1, 'q-hidden', 'available')::text,
  'one listing hidden by the Hub, with its state for the tab'
);
select is(
  row((public.seller_queue('n2-shop') -> 'paused' ->> 'count')::int, public.seller_queue('n2-shop') -> 'paused' -> 'oldest' ->> 'id')::text,
  row(1, 'q-paused')::text,
  'one paused listing'
);
select is(
  public.seller_queue('n2-shop') -> 'listings',
  '{"available": 4, "paused": 1, "sold": 1, "drafts": 1}'::jsonb,
  'the listings by state'
);
select is((public.seller_queue('n2-shop') ->> 'ever_replied')::boolean, true, 'the shop has replied');
select is(
  (select row(f.total, f.recent)::text from public.follower_counts(pg_temp.s('61'), '2026-10-20T00:00Z') f),
  row(3, 2)::text,
  'how many follow, and how many since the time given (countFollowers'' twin, never who)'
);
select is(public.seller_queue('n2-other'), null, 'nothing about another shop');
select is(public.seller_queue('no-such-shop'), null, 'nor about a link that is no shop');
select pg_temp.sign_out();

select pg_temp.sign_in('64');
select is(
  public.seller_queue('n2-fresh'),
  '{"replies": {"count": 0, "oldest": null}, "sales": [], "drafts": {"count": 0, "oldest": null}, "hidden": {"count": 0, "oldest": null}, "paused": {"count": 0, "oldest": null}, "listings": {"available": 0, "paused": 0, "sold": 0, "drafts": 0}, "ever_replied": false}'::jsonb,
  'a new shop''s queue is empty, never null'
);
select pg_temp.sign_out();

select pg_temp.sign_in('62');
select is(public.seller_queue('n2-shop'), null, 'a buyer reads nothing of the shop''s queue');
select is(
  (select row(f.total, f.recent)::text from public.follower_counts(pg_temp.s('61'), '2026-10-20T00:00Z') f),
  row(0, 0)::text,
  'nor how many follow it'
);
select pg_temp.sign_out();

select pg_temp.sign_in('65');
select is(public.seller_queue('n2-shop'), null, 'nor does an admin: the queue is its owner''s');
select pg_temp.sign_out();

-- The seller relists the desk lamp after both sales: nothing left to mark (plan decision 3).
update public.listings set updated_at = '2026-10-16T08:00Z' where id = 'q-avail';
select pg_temp.sign_in('61');
select is(public.seller_queue('n2-shop') -> 'sales', '[]'::jsonb, 'a listing changed since the sale isn''t asked about again');
select pg_temp.sign_out();

-- A Hub hide and Show again are changes to the listing (plan decision 3): each moves updated_at.
insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values
  (pg_temp.a('62'), 'listing', 'q-avail', 'Desk lamp', 'spam');
select pg_temp.sign_in('65');
select public.hide_listing('q-avail', 'Checking it.');
select pg_temp.sign_out();
select ok(
  (select l.updated_at > '2026-10-16T08:00Z' from public.listings l where l.id = 'q-avail'),
  'a Hub hide moves the listing''s updated_at'
);
select pg_temp.sign_in('65');
select public.show_listing('q-hidden');
select pg_temp.sign_out();
select ok(
  (select l.updated_at > '2026-10-10T08:00Z' and l.hidden_at is null from public.listings l where l.id = 'q-hidden'),
  'and so does Show again'
);

select * from finish();
rollback;
