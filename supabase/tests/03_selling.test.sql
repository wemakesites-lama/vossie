-- Task 6: shops, listings, photos and drafts (supabase foundation plan; backend spec 4.3; lib/data/catalog.ts).
begin;
select plan(80);

create function pg_temp.sign_in(account uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', account, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;

-- Places.
insert into public.campuses (slug, name, region, sort) values
  ('test-campus', 'Test campus', 'Gauteng', 98), ('other-campus', 'Other campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
insert into public.pickup_points (id, campus_slug, name) values
  ('20000000-0000-4000-8000-000000000001', 'test-campus', 'Library entrance'),
  ('20000000-0000-4000-8000-000000000002', 'other-campus', 'Library entrance');

-- People: approved seller (11), paused seller (12), pending seller (13), an owner whose seller profile has gone (14),
-- and a stranger (15).
insert into auth.users (id, email)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'user' || n || '@eduvos.com' from unnest(array['11', '12', '13', '14', '15']) n;
insert into public.profiles (id, first_name, campus_slug)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'User ' || n, 'test-campus' from unnest(array['11', '12', '13', '14', '15']) n;

-- Shops: approved (a), paused (b), pending (c), owner without a seller profile (d), and a sample shop with no owner (e).
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  ('10000000-0000-4000-8000-00000000000a', 'shop-approved', '00000000-0000-4000-8000-000000000011', 'Approved shop', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-00000000000b', 'shop-paused', '00000000-0000-4000-8000-000000000012', 'Paused shop', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-00000000000c', 'shop-pending', '00000000-0000-4000-8000-000000000013', 'Pending shop', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-00000000000d', 'shop-gone', '00000000-0000-4000-8000-000000000014', 'Gone shop', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-00000000000e', 'shop-sample', null, 'Sample shop', 'test-category', 'test-campus', '2026-01');
-- A paused profile says who paused it (schema catch-up Task 1's check).
insert into public.seller_profiles (account_id, status, shop_id, paused_by) values
  ('00000000-0000-4000-8000-000000000011', 'approved', '10000000-0000-4000-8000-00000000000a', null),
  ('00000000-0000-4000-8000-000000000012', 'paused', '10000000-0000-4000-8000-00000000000b', 'seller'),
  ('00000000-0000-4000-8000-000000000013', 'pending', '10000000-0000-4000-8000-00000000000c', null);
insert into public.shop_pickup_points (shop_id, pickup_point_id) values
  ('10000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-00000000000c', '20000000-0000-4000-8000-000000000001');

-- A valid listing as JSON, and the insert of it with some fields changed.
create function pg_temp.listing(changes jsonb) returns text language sql as $f$
  select format(
    'insert into public.listings select * from jsonb_populate_record(null::public.listings, %L::jsonb)',
    jsonb_build_object(
      'id', 'l-x', 'shop_id', '10000000-0000-4000-8000-00000000000a', 'state', 'available', 'kind', 'item',
      'title', 'Thing', 'category_slug', 'test-category', 'condition', 'good', 'price_zar', 100,
      'price_is_from', false, 'pay_mode', 'cash', 'swap_for', null, 'description', 'Nice.', 'handover', 'on-campus',
      'pickup_point_id', null, 'campus_slug', 'test-campus', 'created_at', '2026-10-01T08:00:00Z',
      'first_published_at', '2026-10-01T08:00:00Z', 'updated_at', '2026-10-01T08:00:00Z'
    ) || changes
  );
$f$;
create function pg_temp.add(changes jsonb) returns void language plpgsql as $f$
begin
  execute pg_temp.listing(changes);
end;
$f$;
select pg_temp.add('{"id": "l-a"}');
select pg_temp.add('{"id": "l-a-draft", "state": "draft", "first_published_at": null}');
select pg_temp.add('{"id": "l-b", "shop_id": "10000000-0000-4000-8000-00000000000b"}');
select pg_temp.add('{"id": "l-c", "shop_id": "10000000-0000-4000-8000-00000000000c"}');
select pg_temp.add('{"id": "l-d", "shop_id": "10000000-0000-4000-8000-00000000000d"}');
select pg_temp.add('{"id": "l-e", "shop_id": "10000000-0000-4000-8000-00000000000e"}');

-- Photos: one on the approved shop's listing and one on its draft, and a placeholder on the sample shop's listing.
insert into public.photos (id, owner_id, use, type, path) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'listing:l-a', 'image/webp', '00000000-0000-4000-8000-000000000011/30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000011', 'listing:l-a-draft', 'image/jpeg', '00000000-0000-4000-8000-000000000011/30000000-0000-4000-8000-000000000002');
insert into public.listing_photos (listing_id, photo_id, placeholder_src, position, alt) values
  ('l-a', '30000000-0000-4000-8000-000000000001', null, 0, 'The front'),
  ('l-a-draft', '30000000-0000-4000-8000-000000000002', null, 0, ''),
  ('l-e', null, '/placeholders/photo/2.svg', 1, 'The back');
insert into public.onboarding_drafts (account_id, name, campus_slug, pickup_point_ids) values
  ('00000000-0000-4000-8000-000000000015', 'My new shop', 'test-campus', array['20000000-0000-4000-8000-000000000001'::uuid]);

-- Each shop's status (catalog.ts shopStatus).
select is(private.shop_status('10000000-0000-4000-8000-00000000000a'), 'approved', 'a shop takes its owner''s status: approved');
select is(private.shop_status('10000000-0000-4000-8000-00000000000b'), 'paused', 'paused');
select is(private.shop_status('10000000-0000-4000-8000-00000000000c'), 'pending', 'pending');
select is(private.shop_status('10000000-0000-4000-8000-00000000000d'), 'pending', 'an owned shop whose seller profile has gone counts as pending');
select is(private.shop_status('10000000-0000-4000-8000-00000000000e'), 'approved', 'a sample shop no one owns is approved');
select is(private.shop_is_public('10000000-0000-4000-8000-00000000000b'), true, 'a paused shop keeps its storefront');
select is(private.shop_is_public('10000000-0000-4000-8000-00000000000c'), false, 'a pending shop has none');
select is(private.shop_is_public('10000000-0000-4000-8000-0000000000ff'), false, 'an unknown shop is not public');

-- What anyone sees (catalog.test.ts: approved, paused, pending, no owner, draft).
set local role anon;
select is(
  array(select slug from public.shops where slug like 'shop-%' order by slug),
  array['shop-approved', 'shop-paused', 'shop-sample'],
  'anon sees approved, paused and ownerless shops, not pending or orphaned ones'
);
select is(
  array(select id from public.listings where id in ('l-a', 'l-a-draft', 'l-b', 'l-c', 'l-d', 'l-e') order by id),
  array['l-a', 'l-b', 'l-e'],
  'anon sees listings of approved, paused and ownerless shops, and no drafts'
);
select is((select count(*) from public.listings where id = 'l-a-draft'), 0::bigint, 'anon cannot see a draft');
select is((select count(*) from public.listings where id = 'l-c'), 0::bigint, 'a pending shop''s listing is invisible to anon');
select is(
  array(select listing_id || ':' || position from public.listing_photos where listing_id in ('l-a', 'l-a-draft', 'l-b', 'l-c', 'l-d', 'l-e') order by 1),
  array['l-a:0', 'l-e:1'],
  'anon sees the photo rows of public listings only'
);
select is(
  array(select shop_id::text from public.shop_pickup_points where shop_id::text like '10000000-%' order by 1),
  array['10000000-0000-4000-8000-00000000000a'],
  'anon sees a public shop''s pickup points, not a pending one''s'
);
select throws_ok($$select owner_id from public.shops$$, '42501', null, 'anon cannot read who owns a shop');
select throws_ok($$select * from public.photos$$, '42501', null, 'anon cannot read photo rows');
select throws_ok($$select * from public.onboarding_drafts$$, '42501', null, 'anon cannot read drafts');
select throws_ok($$select private.shop_is_public('10000000-0000-4000-8000-00000000000a')$$, '42501', null, 'anon cannot call a private helper by name');
reset role;

-- The approved seller sees their draft and its photo; nobody else does.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000011');
select is((select count(*) from public.listings where id = 'l-a-draft'), 1::bigint, 'an owner sees their draft');
select is((select count(*) from public.listing_photos where listing_id = 'l-a-draft'), 1::bigint, 'and its photo row');
select is(
  (select array_agg(use order by use) from public.photos),
  array['listing:l-a', 'listing:l-a-draft'],
  'an owner reads their own photos'
);
select throws_ok(
  pg_temp.listing('{"id": "l-new"}'),
  '42501', null, 'an owner cannot insert a listing directly (Task 9''s functions do)'
);
select throws_ok($$update public.listings set title = 'Changed' where id = 'l-a'$$, '42501', null, 'an owner cannot update a listing directly');
select throws_ok($$delete from public.listings where id = 'l-a'$$, '42501', null, 'an owner cannot delete a listing directly');
select throws_ok($$update public.shops set name = 'Changed' where slug = 'shop-approved'$$, '42501', null, 'an owner cannot update their shop directly');
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since) values ('my-shop', 'My shop', 'test-category', 'test-campus', '2026-10')$$,
  '42501', null, 'a user cannot insert a shop directly'
);
select throws_ok($$delete from public.photos$$, '42501', null, 'a user cannot delete photo rows directly');
select pg_temp.sign_out();

-- owns_shop, with the owner's claims (as the policies see them).
create function pg_temp.owns_as(account uuid, shop uuid) returns boolean language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', account, 'role', 'authenticated')::text, true);
  return private.owns_shop(shop);
end;
$f$;
select is(pg_temp.owns_as('00000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-00000000000a'), true, 'owns_shop is true for the owner');
select is(pg_temp.owns_as('00000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-00000000000b'), false, 'and false for someone else''s shop');
select set_config('request.jwt.claims', '', true);

-- The pending seller sees their own shop and listing.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000013');
select is((select count(*) from public.shops where slug = 'shop-pending'), 1::bigint, 'a pending seller sees their own shop');
select is((select count(*) from public.listings where id = 'l-c'), 1::bigint, 'and its listing');
select is((select count(*) from public.shop_pickup_points where shop_id = '10000000-0000-4000-8000-00000000000c'), 1::bigint, 'and its pickup points');
select pg_temp.sign_out();

-- A stranger sees what anon sees, and their own draft.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000015');
select is(
  array(select id from public.listings where id in ('l-a', 'l-a-draft', 'l-b', 'l-c', 'l-d', 'l-e') order by id),
  array['l-a', 'l-b', 'l-e'],
  'a signed-in stranger sees the public listings and no one''s drafts'
);
select is(
  array(select slug from public.shops where slug like 'shop-%' order by slug),
  array['shop-approved', 'shop-paused', 'shop-sample'],
  'and the public shops'
);
select is((select count(*) from public.photos), 0::bigint, 'a stranger reads no one else''s photos');
select is(
  (select array_agg(name) from public.onboarding_drafts),
  array['My new shop'],
  'a user reads their own onboarding draft'
);
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000011');
select is((select count(*) from public.onboarding_drafts), 0::bigint, 'and no one else''s');
select pg_temp.sign_out();

-- The selling rules a check can say (lib/selling/rules.ts checkListing).
select throws_ok(pg_temp.listing('{"price_zar": 0, "pay_mode": "both", "swap_for": "A lamp"}'), '23514', null, 'free means cash');
select lives_ok(pg_temp.listing('{"id": "l-free", "price_zar": 0}'), 'a free item is cash');
select throws_ok(pg_temp.listing('{"price_zar": null, "pay_mode": "swap"}'), '23514', null, 'a swap needs swap_for');
select lives_ok(pg_temp.listing('{"id": "l-swap", "price_zar": null, "pay_mode": "swap", "swap_for": "A lamp"}'), 'a swap with swap_for is fine');
select throws_ok(pg_temp.listing('{"swap_for": "A lamp"}'), '23514', null, 'swap_for is set only when it takes swaps');
select throws_ok(pg_temp.listing('{"pay_mode": "swap", "swap_for": "A lamp"}'), '23514', null, 'a swap-only listing has no price');
select throws_ok(pg_temp.listing('{"price_zar": null}'), '23514', null, 'a cash listing has a price');
select throws_ok(pg_temp.listing('{"condition": null}'), '23514', null, 'an item needs a condition');
select throws_ok(pg_temp.listing('{"kind": "service"}'), '23514', null, 'a service has no condition');
select throws_ok(pg_temp.listing('{"handover": "pickup"}'), '23514', null, 'a pickup needs a pickup point');
select lives_ok(pg_temp.listing('{"id": "l-pickup", "handover": "pickup", "pickup_point_id": "20000000-0000-4000-8000-000000000001"}'), 'a pickup with a point is fine');
select throws_ok(pg_temp.listing('{"pickup_point_id": "20000000-0000-4000-8000-000000000001"}'), '23514', null, 'only a pickup has a pickup point');
select throws_ok(pg_temp.listing('{"price_zar": 100001}'), '23514', null, 'a price is at most R100,000');
select throws_ok(pg_temp.listing('{"price_is_from": true}'), '23514', null, 'only a service with a price is "from"');
select throws_ok(pg_temp.listing(jsonb_build_object('title', repeat('a', 71))), '23514', null, 'a title is at most 70 characters');
select throws_ok(pg_temp.listing('{"title": ""}'), '23514', null, 'a title is not empty');
select throws_ok(pg_temp.listing(jsonb_build_object('description', repeat('a', 1001))), '23514', null, 'a description is at most 1,000 characters');
select throws_ok(pg_temp.listing(jsonb_build_object('pay_mode', 'both', 'swap_for', repeat('a', 201))), '23514', null, 'swap_for is at most 200 characters');
select throws_ok(pg_temp.listing('{"first_published_at": null}'), '23514', null, 'a listing that isn''t a draft has been published');
select throws_ok(pg_temp.listing('{"id": "L X"}'), '23514', null, 'a listing id is short lower-case text');

-- first_published_at is set once and never cleared (amendment 9.2).
select throws_ok($$update public.listings set first_published_at = null, state = 'draft' where id = 'l-a'$$, '23514', null, 'first_published_at cannot be cleared');
select throws_ok($$update public.listings set first_published_at = now() where id = 'l-a'$$, '23514', null, 'first_published_at cannot change once set');
select lives_ok($$update public.listings set state = 'draft' where id = 'l-a'$$, 'a published listing goes back to draft and keeps its first publish');
select lives_ok($$update public.listings set state = 'available', first_published_at = now() where id = 'l-a-draft'$$, 'a draft is published for the first time');

-- Shops.
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since) values ('Bad_Slug', 'Shop x', 'test-category', 'test-campus', '2026-10')$$,
  '23514', null, 'a slug is lower-case letters, digits and single hyphens'
);
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since) values ('ab', 'Shop x', 'test-category', 'test-campus', '2026-10')$$,
  '23514', null, 'a slug has at least 3 characters'
);
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since) values ('shop-approved', 'Shop x', 'test-category', 'other-campus', '2026-10')$$,
  '23505', null, 'slugs are unique'
);
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since) values ('approved-2', 'APPROVED  shop!', 'test-category', 'test-campus', '2026-10')$$,
  '23505', null, 'two shops on a campus cannot share a name key'
);
select lives_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since) values ('approved-3', 'Approved shop', 'test-category', 'other-campus', '2026-10')$$,
  'the same name is fine on another campus'
);
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since) values ('shop-x', 'Shop x', 'test-category', 'test-campus', '2026-1')$$,
  '23514', null, 'since is YYYY-MM'
);
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since, badge) values ('shop-x', 'Shop x', 'test-category', 'test-campus', '2026-10', 'gold')$$,
  '23514', null, 'a badge is trusted, responsive or new-seller'
);
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since, tagline) values ('shop-x', 'Shop x', 'test-category', 'test-campus', '2026-10', repeat('a', 81))$$,
  '23514', null, 'a tagline is at most 80 characters'
);
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since, image_placeholder, image_photo_id) values ('shop-x', 'Shop x', 'test-category', 'test-campus', '2026-10', '/placeholders/seller/x.svg', '30000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'a shop image is a photo or a placeholder, not both'
);

-- Photos.
select throws_ok(
  $$insert into public.photos (owner_id, type, path) values ('00000000-0000-4000-8000-000000000011', 'image/webp', 'somewhere/else')$$,
  '23514', null, 'a photo''s path is {owner}/{id}'
);
select throws_ok(
  $$insert into public.photos (id, owner_id, type, path) values ('30000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000011', 'image/gif', '00000000-0000-4000-8000-000000000011/30000000-0000-4000-8000-000000000009')$$,
  '23514', null, 'a photo is JPEG, PNG or WebP'
);
select throws_ok(
  $$insert into public.listing_photos (listing_id, placeholder_src, position) values ('l-e', '/placeholders/photo/3.svg', 6)$$,
  '23514', null, 'a listing has at most 6 photos (positions 0 to 5)'
);
select throws_ok(
  $$insert into public.listing_photos (listing_id, position) values ('l-e', 2)$$,
  '23514', null, 'a listing photo is a stored photo or a placeholder'
);
select throws_ok(
  $$insert into public.listing_photos (listing_id, placeholder_src, position, alt) values ('l-e', '/placeholders/photo/3.svg', 2, repeat('a', 126))$$,
  '23514', null, 'a photo''s description is at most 125 characters'
);

-- The admin client (service role) writes, and new listings get a short id from private.new_short_id.
set local role service_role;
select lives_ok(
  $$insert into public.listings (shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at)
    values ('10000000-0000-4000-8000-00000000000a', 'available', 'item', 'By the admin client', 'test-category', 'good', 50, 'cash', 'Fine.', 'online', 'test-campus', now())$$,
  'the service role inserts a listing'
);
select matches(
  (select id from public.listings where title = 'By the admin client'),
  '^[a-z0-9]{10}$',
  'and it gets a 10-character short id'
);
select lives_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since) values ('by-admin', 'By admin', 'test-category', 'test-campus', '2026-10')$$,
  'the service role inserts a shop, and its name key is computed'
);
reset role;

-- Deletion: a shop going clears its seller profile's link; an owner going takes their shop and listings.
delete from public.shops where id = '10000000-0000-4000-8000-00000000000c';
select is(
  (select shop_id from public.seller_profiles where account_id = '00000000-0000-4000-8000-000000000013'),
  null,
  'deleting a shop clears the seller profile''s link'
);
delete from auth.users where id = '00000000-0000-4000-8000-000000000011';
select is(
  (select count(*) from public.shops where id = '10000000-0000-4000-8000-00000000000a')
  + (select count(*) from public.listings where shop_id = '10000000-0000-4000-8000-00000000000a')
  + (select count(*) from public.photos where owner_id = '00000000-0000-4000-8000-000000000011'),
  0::bigint,
  'deleting the owner removes their shop, its listings and their photos'
);

select * from finish();
rollback;
