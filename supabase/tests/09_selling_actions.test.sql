-- Task 9: selling's atomic writes (supabase foundation plan; lib/data/shops.ts, own-listings.ts and photos.ts, the
-- selling Server Actions, and the cases of their tests). The account always comes from the session.
begin;
select plan(123);

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
create temp table results (k text primary key, v jsonb);
grant all on results to public;
create function pg_temp.r(k text) returns jsonb language sql as $f$
  select v from results where results.k = r.k;
$f$;
-- The id of the n-th photo (from 0) a call to add_photos gave back.
create function pg_temp.photo(k text, n int) returns uuid language sql as $f$
  select (v -> 'photos' -> n ->> 'id')::uuid from results where results.k = photo.k;
$f$;
create function pg_temp.path(k text, n int) returns text language sql as $f$
  select v -> 'photos' -> n ->> 'path' from results where results.k = path.k;
$f$;
-- A listing's fields, as the form sends them once checked, with some changed.
create function pg_temp.save(listing text, changes jsonb, photos jsonb, publish boolean) returns jsonb language sql as $f$
  select public.save_listing(
    listing, f ->> 'kind', f ->> 'title', f ->> 'category_slug', f ->> 'condition', (f ->> 'price_zar')::int,
    (f ->> 'price_is_from')::boolean, f ->> 'pay_mode', f ->> 'swap_for', f ->> 'description', f ->> 'handover',
    (f ->> 'pickup_point_id')::uuid, photos, publish
  )
  from (select jsonb_build_object(
    'kind', 'item', 'title', 'Calculator', 'category_slug', 'test-category', 'condition', 'good', 'price_zar', 200,
    'price_is_from', false, 'pay_mode', 'cash', 'swap_for', null, 'description', 'Works well.', 'handover', 'online',
    'pickup_point_id', null
  ) || changes as f) s;
$f$;

-- Places: two campuses with pickup points, and an online one with none.
insert into public.campuses (slug, name, region, sort, is_online) values
  ('test-campus', 'Test campus', 'Gauteng', 97, false),
  ('other-campus', 'Other campus', 'Gauteng', 98, false),
  ('test-online', 'Test online', 'Online', 99, true);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 98), ('test-food', 'Test food', 99);
insert into public.pickup_points (id, campus_slug, name) values
  ('20000000-0000-4000-8000-000000000081', 'test-campus', 'Library entrance'),
  ('20000000-0000-4000-8000-000000000082', 'test-campus', 'Main reception'),
  ('20000000-0000-4000-8000-000000000083', 'other-campus', 'Library entrance'),
  ('20000000-0000-4000-8000-000000000084', 'other-campus', 'Main reception');
insert into public.pickup_points (id, campus_slug, name, retired_at) values
  ('20000000-0000-4000-8000-000000000085', 'test-campus', 'Old gate', now());

-- People: a student (81), Sipho with an approved shop (82), Lerato with a pending one (83), a second student (84), a
-- third (85), and an account that hasn't finished signing in (86).
insert into auth.users (id, email)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'user' || n || '@eduvos.com' from unnest(array['81', '82', '83', '84', '85', '86']) n;
insert into public.profiles (id, first_name, campus_slug)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'User ' || n, 'test-campus' from unnest(array['81', '82', '83', '84', '85']) n;
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since, image_placeholder, image_alt) values
  ('10000000-0000-4000-8000-000000000082', 'test-tech', '00000000-0000-4000-8000-000000000082', 'Test tech', 'test-category', 'test-campus', '2026-03', '/placeholders/seller/test-tech.svg', 'The tech shop at work'),
  ('10000000-0000-4000-8000-000000000083', 'test-crochet', '00000000-0000-4000-8000-000000000083', 'Test crochet', 'test-category', 'test-campus', '2026-10', null, '');
insert into public.seller_profiles (account_id, status, shop_id) values
  ('00000000-0000-4000-8000-000000000082', 'approved', '10000000-0000-4000-8000-000000000082'),
  ('00000000-0000-4000-8000-000000000083', 'pending', '10000000-0000-4000-8000-000000000083');
insert into public.shop_pickup_points (shop_id, pickup_point_id) values
  ('10000000-0000-4000-8000-000000000082', '20000000-0000-4000-8000-000000000081'),
  ('10000000-0000-4000-8000-000000000082', '20000000-0000-4000-8000-000000000082'),
  ('10000000-0000-4000-8000-000000000083', '20000000-0000-4000-8000-000000000081');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, pickup_point_id, campus_slug, created_at, first_published_at, updated_at) values
  ('t-s1', '10000000-0000-4000-8000-000000000082', 'available', 'item', 'Casio', 'test-category', 'good', 200, 'cash', 'A calculator.', 'pickup', '20000000-0000-4000-8000-000000000082', 'test-campus', '2026-10-01', '2026-10-01', '2026-10-01'),
  ('t-s2', '10000000-0000-4000-8000-000000000082', 'sold', 'item', 'Headset', 'test-category', 'good', 400, 'cash', 'A headset.', 'online', null, 'test-campus', '2026-10-01', '2026-10-01', '2026-10-01');
insert into public.listing_photos (listing_id, placeholder_src, position, alt) values
  ('t-s1', '/placeholders/listing/tech.svg', 0, ''),
  ('t-s1', '/placeholders/photo/2.svg', 1, 'The back');

select ok(
  not exists (
    select 1 from unnest(array[
      'public.create_shop(text, text, text, text, uuid, text, uuid[])',
      'public.update_shop(text, text, text, text, text, uuid[], uuid, boolean, text)',
      'public.change_shop_slug(text)', 'public.set_shop_paused(boolean)',
      'public.save_onboarding_draft(text, text, text, text, uuid, text, uuid[])',
      'public.save_listing(text, text, text, text, text, integer, boolean, text, text, text, text, uuid, jsonb, boolean)',
      'public.set_listing_state(text, text)', 'public.delete_listing(text)', 'public.add_photos(text[])'
    ]) f
    where has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute')
  ),
  'the selling actions run for signed-in users, never for anon'
);

-- Photos waiting on a form (lib/data/photos.ts storePhotos).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000081');
insert into results values ('p81', public.add_photos(array['image/png', 'image/webp', 'image/jpeg']));
select pg_temp.sign_out();
select is(jsonb_array_length(pg_temp.r('p81') -> 'photos'), 3, 'add_photos gives back one photo per type, in order');
select is(
  pg_temp.path('p81', 0),
  '00000000-0000-4000-8000-000000000081/' || pg_temp.photo('p81', 0),
  'each with its file''s path, {owner}/{id}'
);
select is(
  (select array_agg(row(type, use)::text order by type) from public.photos where owner_id = '00000000-0000-4000-8000-000000000081'),
  array[row('image/jpeg', null::text)::text, row('image/png', null::text)::text, row('image/webp', null::text)::text],
  'stored waiting on a form (no use yet), with their types'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000081');
select throws_ok($$select public.add_photos(array['image/gif'])$$, '23514', null, 'a photo is JPEG, PNG or WebP');
select throws_ok($$select public.add_photos(array['image/png','image/png','image/png','image/png','image/png','image/png','image/png'])$$, '22023', null, 'at most six at a time');
select pg_temp.sign_out();

-- Each account keeps its newest 12 waiting photos, and none more than a day old.
insert into public.photos (id, owner_id, type, path, created_at)
select id, '00000000-0000-4000-8000-000000000085', 'image/png', '00000000-0000-4000-8000-000000000085/' || id, now() - g * interval '1 hour'
from (select gen_random_uuid() as id, g from generate_series(1, 10) g) s;
insert into public.photos (id, owner_id, type, path, created_at) values
  ('30000000-0000-4000-8000-000000000851', '00000000-0000-4000-8000-000000000085', 'image/png', '00000000-0000-4000-8000-000000000085/30000000-0000-4000-8000-000000000851', now() - interval '25 hours');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000085');
insert into results values ('p85', public.add_photos(array['image/png', 'image/png', 'image/png', 'image/png']));
select pg_temp.sign_out();
select is(
  (select count(*) from public.photos where owner_id = '00000000-0000-4000-8000-000000000085' and use is null),
  12::bigint,
  'an account keeps its newest 12 waiting photos'
);
select is(jsonb_array_length(pg_temp.r('p85') -> 'removed_paths'), 3, 'the stale one and the two oldest go, and their files are named for deletion');
select ok(
  pg_temp.r('p85') -> 'removed_paths' ? '00000000-0000-4000-8000-000000000085/30000000-0000-4000-8000-000000000851',
  'including the photo more than a day old'
);

-- The onboarding wizard's draft (selling spec 2.2).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000081');
insert into results values ('d1', public.save_onboarding_draft(
  'Zola''s Bakes', '', null, '', pg_temp.photo('p81', 0), 'test-campus',
  array['20000000-0000-4000-8000-000000000081', '20000000-0000-4000-8000-000000000083', '20000000-0000-4000-8000-000000000085']::uuid[]
));
select pg_temp.sign_out();
select is(pg_temp.r('d1') ->> 'result', 'saved', 'a draft is saved');
select is(
  (select row(name, tagline, category_slug, photo_id, campus_slug, pickup_point_ids, updated_at = now())::text from public.onboarding_drafts where account_id = '00000000-0000-4000-8000-000000000081'),
  row('Zola''s Bakes', '', null::text, pg_temp.photo('p81', 0), 'test-campus', array['20000000-0000-4000-8000-000000000081']::uuid[], true)::text,
  'with its answers, keeping only the campus''s live pickup points'
);
select is((select use from public.photos where id = pg_temp.photo('p81', 0)), 'draft', 'its photo becomes the draft''s');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000081');
insert into results values ('d2', public.save_onboarding_draft(
  'Zola''s Bakes', 'Muffins on Mondays.', 'test-food', repeat('a', 700), pg_temp.photo('p81', 1), 'test-campus',
  array['20000000-0000-4000-8000-000000000081']::uuid[]
));
select pg_temp.sign_out();
select is(
  pg_temp.r('d2') -> 'removed_paths',
  jsonb_build_array(pg_temp.path('p81', 0)),
  'a replaced draft photo is deleted, and its file named'
);
select is((select count(*) from public.photos where id = pg_temp.photo('p81', 0)), 0::bigint, 'its row is gone');
select is(
  (select char_length(about) from public.onboarding_drafts where account_id = '00000000-0000-4000-8000-000000000081'),
  700,
  'a draft keeps what was typed past the limit, for the form to show with its error'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000081');
select is(
  public.save_onboarding_draft('x', '', null, '', pg_temp.photo('p85', 0), null, '{}') ->> 'result',
  'photo-invalid',
  'someone else''s photo cannot go in a draft'
);
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(public.save_onboarding_draft('x', '', null, '', null, null, '{}') ->> 'result', 'has-shop', 'a seller has no wizard');
select pg_temp.sign_out();

-- Sending the application (selling spec 2.6 and 2.7).
update public.onboarding_drafts set about = 'I bake.' where account_id = '00000000-0000-4000-8000-000000000081';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000081');
insert into results values ('s81', public.create_shop(
  'Zola''s Bakes', 'Muffins on Mondays.', 'test-food', 'I bake between lectures.', pg_temp.photo('p81', 1), 'test-campus',
  array['20000000-0000-4000-8000-000000000081']::uuid[]
));
select pg_temp.sign_out();
select is(pg_temp.r('s81') ->> 'result', 'created', 'a shop is made');
select is(pg_temp.r('s81') ->> 'slug', 'zolas-bakes', 'with a link from its name');
select is(
  (select row(owner_id, name, tagline, category_slug, about, campus_slug, verified, badge, since, image_photo_id, slug_changed)::text
   from public.shops where id = (pg_temp.r('s81') ->> 'shop_id')::uuid),
  row('00000000-0000-4000-8000-000000000081'::uuid, 'Zola''s Bakes', 'Muffins on Mondays.', 'test-food', 'I bake between lectures.', 'test-campus', false, 'new-seller', to_char(now() at time zone 'Africa/Johannesburg', 'YYYY-MM'), pg_temp.photo('p81', 1), false)::text,
  'not verified, a new seller, since this month (SAST), with the photo'
);
select is(
  (select row(status, shop_id, applied_at = now())::text from public.seller_profiles where account_id = '00000000-0000-4000-8000-000000000081'),
  row('pending', (pg_temp.r('s81') ->> 'shop_id')::uuid, true)::text,
  'and a seller profile waiting for the Hub'
);
select is(
  (select array_agg(pickup_point_id) from public.shop_pickup_points where shop_id = (pg_temp.r('s81') ->> 'shop_id')::uuid),
  array['20000000-0000-4000-8000-000000000081'::uuid],
  'with its pickup points'
);
select is((select count(*) from public.onboarding_drafts where account_id = '00000000-0000-4000-8000-000000000081'), 0::bigint, 'the draft goes');
select is((select use from public.photos where id = pg_temp.photo('p81', 1)), 'shop', 'its photo becomes the shop''s');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000081');
select is((select count(*) from public.shops where slug = 'zolas-bakes'), 1::bigint, 'the owner sees their pending shop');
select is(
  public.create_shop('Another', '', 'test-food', 'More.', null, 'test-campus', array['20000000-0000-4000-8000-000000000081']::uuid[]),
  '{"result": "has-shop"}'::jsonb,
  'never a second shop for one account'
);
select pg_temp.sign_out();
set local role anon;
select is((select count(*) from public.shops where slug = 'zolas-bakes'), 0::bigint, 'a pending shop is invisible to anon');
reset role;

select pg_temp.sign_in('00000000-0000-4000-8000-000000000084');
select is(
  public.create_shop('ZOLAS bakes!', '', 'test-food', 'Me too.', null, 'test-campus', array['20000000-0000-4000-8000-000000000081']::uuid[]),
  '{"result": "name-taken"}'::jsonb,
  'a name taken on the campus, however it''s written (plan decision 16)'
);
select is(
  public.create_shop('Zola''s Bakes', '', 'test-food', 'Me too.', null, 'other-campus', array['20000000-0000-4000-8000-000000000081']::uuid[]),
  '{"result": "points-invalid"}'::jsonb,
  'pickup points come from the shop''s campus'
);
select is(
  public.create_shop('Zola''s Bakes', '', 'test-food', 'Me too.', null, 'other-campus', '{}'),
  '{"result": "points-invalid"}'::jsonb,
  'and a campus with points needs one'
);
select is(
  public.create_shop('Zola''s Bakes', '', 'test-food', 'Me too.', null, 'other-campus', array['20000000-0000-4000-8000-000000000085']::uuid[]),
  '{"result": "points-invalid"}'::jsonb,
  'a retired point does not count'
);
select is(
  public.create_shop('Zola''s Bakes', '', 'test-food', 'Me too.', pg_temp.photo('p81', 2), 'other-campus', array['20000000-0000-4000-8000-000000000083']::uuid[]),
  '{"result": "photo-invalid"}'::jsonb,
  'someone else''s photo cannot be the shop''s'
);
select throws_ok($$select public.create_shop('!?!', '', 'test-food', 'x', null, 'test-online', '{}')$$, '23514', null, 'a name has a letter or a digit');
insert into results values ('s84', public.create_shop('Zola''s Bakes', '', 'test-food', 'Me too.', null, 'other-campus', array['20000000-0000-4000-8000-000000000083']::uuid[]));
select pg_temp.sign_out();
select is(pg_temp.r('s84') ->> 'slug', 'zolas-bakes-2', 'the same name on another campus gets the next free link');
select is(
  (select count(*) from public.seller_profiles where account_id = '00000000-0000-4000-8000-000000000084'),
  1::bigint,
  'and the refused tries left no seller profile behind'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000085');
select is(
  public.create_shop('ab', '', 'test-food', 'Hi.', null, 'test-online', '{}') ->> 'slug',
  'ab-shop',
  'a short name''s link gets "-shop", and an online shop needs no pickup point'
);
select pg_temp.sign_out();

-- Editing the shop (selling spec 2.11, plan decisions 16 and 17).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000083');
insert into results values ('u83', public.update_shop('Hook club', '', 'test-food', 'Hooks.', 'test-campus', array['20000000-0000-4000-8000-000000000081']::uuid[], null, false, null));
select pg_temp.sign_out();
select is(pg_temp.r('u83') ->> 'result', 'saved', 'a pending shop is edited');
select is(pg_temp.r('u83') ->> 'slug', 'hook-club', 'and its link follows its name');
select is((select count(*) from public.shops where slug = 'test-crochet'), 0::bigint, 'the old link is gone');

select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
insert into results values ('u82', public.update_shop('Gadget corner', 'New line.', 'test-category', 'Gadgets.', 'test-campus', array['20000000-0000-4000-8000-000000000081', '20000000-0000-4000-8000-000000000082']::uuid[], null, false, null));
select pg_temp.sign_out();
select is(pg_temp.r('u82') ->> 'slug', 'test-tech', 'an approved shop keeps its link whatever its name');
select is(
  (select row(name, tagline, image_placeholder, updated_at = now())::text from public.shops where slug = 'test-tech'),
  row('Gadget corner', 'New line.', '/placeholders/seller/test-tech.svg', true)::text,
  'the details change, and the image stays when none is sent'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(
  public.update_shop('Zola''s bakes', '', 'test-category', 'x', 'test-campus', array['20000000-0000-4000-8000-000000000081']::uuid[], null, false, null),
  '{"result": "name-taken"}'::jsonb,
  'a name another shop on the campus has is refused'
);
select pg_temp.sign_out();
select is((select name from public.shops where slug = 'test-tech'), 'Gadget corner', 'and nothing changes');

-- A campus change moves the listings, and a pickup to the shop's first point, or online (plan decision 17).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(
  public.update_shop('Gadget corner', '', 'test-category', 'x', 'other-campus', array['20000000-0000-4000-8000-000000000084', '20000000-0000-4000-8000-000000000083']::uuid[], null, false, null) ->> 'result',
  'saved',
  'the shop moves campus'
);
select pg_temp.sign_out();
select is(
  (select row(campus_slug, handover, pickup_point_id)::text from public.listings where id = 't-s1'),
  row('other-campus', 'pickup', '20000000-0000-4000-8000-000000000084'::uuid)::text,
  'its listings follow, and a pickup moves to its first point'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(
  public.update_shop('Gadget corner', '', 'test-category', 'x', 'test-online', '{}', null, false, null) ->> 'result',
  'saved',
  'the shop moves online'
);
select pg_temp.sign_out();
select is(
  (select row(campus_slug, handover, pickup_point_id)::text from public.listings where id = 't-s1'),
  row('test-online', 'online', null::uuid)::text,
  'and a pickup becomes online'
);
select is((select count(*) from public.shop_pickup_points where shop_id = '10000000-0000-4000-8000-000000000082'), 0::bigint, 'with no pickup points');

-- The shop's photo.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
insert into results values ('p82', public.add_photos(array['image/png', 'image/png', 'image/png']));
insert into results values ('ph1', public.update_shop('Gadget corner', '', 'test-category', 'x', 'test-online', '{}', pg_temp.photo('p82', 0), false, null));
insert into results values ('ph2', public.update_shop('Gadget corner', '', 'test-category', 'x', 'test-online', '{}', pg_temp.photo('p82', 1), false, null));
select pg_temp.sign_out();
select is(
  (select row(image_photo_id, image_placeholder, image_alt)::text from public.shops where slug = 'test-tech'),
  row(pg_temp.photo('p82', 1), null::text, '')::text,
  'a new photo replaces the image'
);
select is(pg_temp.r('ph2') -> 'removed_paths', jsonb_build_array(pg_temp.path('p82', 0)), 'and the old photo is deleted, its file named');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(
  public.update_shop('Gadget corner', '', 'test-category', 'x', 'test-online', '{}', pg_temp.photo('p82', 1), false, null) -> 'removed_paths',
  '[]'::jsonb,
  'sending the same photo keeps it'
);
select is(
  public.update_shop('Gadget corner', '', 'test-category', 'x', 'test-online', '{}', pg_temp.photo('p81', 2), false, null) ->> 'result',
  'photo-invalid',
  'someone else''s photo is refused'
);
insert into results values ('ph3', public.update_shop('Gadget corner', '', 'test-category', 'x', 'test-online', '{}', null, true, null));
select pg_temp.sign_out();
select is(
  (select row(image_photo_id, image_placeholder)::text from public.shops where slug = 'test-tech'),
  row(null::uuid, null::text)::text,
  'Remove leaves the category''s picture'
);
select is(pg_temp.r('ph3') -> 'removed_paths', jsonb_build_array(pg_temp.path('p82', 1)), 'and deletes the photo');

-- The one change of link (selling spec 2.11).
insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values
  ('00000000-0000-4000-8000-000000000081', 'seller', 'test-tech', 'Test tech', 'spam');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(public.change_shop_slug('test-tech'), 'same', 'the same link is no change');
select is(public.change_shop_slug('hook-club'), 'taken', 'another shop''s link is taken');
select throws_ok($$select public.change_shop_slug('Bad Slug')$$, '23514', null, 'a link has the slug''s shape');
select is(public.change_shop_slug('gadgets'), 'changed', 'an approved shop changes its link');
select is(public.change_shop_slug('gadgets-two'), 'used', 'once');
select pg_temp.sign_out();
select is(
  (select row(slug_changed, updated_at = now())::text from public.shops where id = '10000000-0000-4000-8000-000000000082'),
  row(true, true)::text,
  'the shop remembers it changed its link'
);
select is(
  (select target_id from public.reports where target_kind = 'seller' and reporter_id = '00000000-0000-4000-8000-000000000081'),
  'gadgets',
  'reports about the shop follow it'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000083');
select is(public.change_shop_slug('lerato'), 'not-allowed', 'a waiting shop''s link follows its name instead');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000085');
select is(public.change_shop_slug('anything'), 'not-allowed', 'a waiting shop cannot change its link');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000084');
-- Lerato's and Zola's shops are pending; approve 84's to try the change of link inside Edit shop.
select pg_temp.sign_out();
update public.seller_profiles set status = 'approved' where account_id = '00000000-0000-4000-8000-000000000084';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000084');
select is(
  public.update_shop('Zola''s Bakes', '', 'test-food', 'x', 'other-campus', array['20000000-0000-4000-8000-000000000083']::uuid[], null, false, 'gadgets'),
  '{"result": "slug-taken"}'::jsonb,
  'Edit shop with a taken link saves nothing'
);
select pg_temp.sign_out();
select is((select about from public.shops where slug = 'zolas-bakes-2'), 'Me too.', 'nothing at all');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000084');
select is(
  public.update_shop('Zola''s Bakes', '', 'test-food', 'Changed.', 'other-campus', array['20000000-0000-4000-8000-000000000083']::uuid[], null, false, 'zolas-other') ->> 'slug',
  'zolas-other',
  'Edit shop changes the details and the link together'
);
select pg_temp.sign_out();
select is(
  (select row(about, slug_changed)::text from public.shops where owner_id = '00000000-0000-4000-8000-000000000084'),
  row('Changed.', true)::text,
  'both saved'
);

-- Pausing (selling spec 2.8).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(public.set_shop_paused(true), 'paused', 'an approved shop pauses');
select is(public.set_shop_paused(true), 'not-allowed', 'once');
select is(public.set_shop_paused(false), 'approved', 'and resumes');
select is(public.set_shop_paused(false), 'not-allowed', 'once');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000083');
select is(public.set_shop_paused(true), 'not-allowed', 'a pending shop cannot pause');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000081');
select is(public.set_shop_paused(true), 'not-allowed', 'neither can someone without an approved shop');
select pg_temp.sign_out();

-- Listings (selling spec 2.9 and 2.10, plan decision 3). Sipho's shop is back on the test campus with both points.
update public.shops set campus_slug = 'test-campus' where id = '10000000-0000-4000-8000-000000000082';
insert into public.shop_pickup_points (shop_id, pickup_point_id) values
  ('10000000-0000-4000-8000-000000000082', '20000000-0000-4000-8000-000000000081'),
  ('10000000-0000-4000-8000-000000000082', '20000000-0000-4000-8000-000000000082');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
insert into results values ('n1', pg_temp.save(null, '{}', '[]', true));
select pg_temp.sign_out();
select is(pg_temp.r('n1') ->> 'result', 'saved', 'a new listing is saved');
select matches(pg_temp.r('n1') ->> 'listing_id', '^[a-z0-9]{10}$', 'with a new short id');
select is(
  (select row(state, shop_id, campus_slug, created_at = now(), first_published_at = now(), updated_at = now())::text from public.listings where id = pg_temp.r('n1') ->> 'listing_id'),
  row('available', '10000000-0000-4000-8000-000000000082'::uuid, 'test-campus', true, true, true)::text,
  'published on the shop''s campus, first published now'
);
select is(
  (pg_temp.r('n1') ->> 'state', (pg_temp.r('n1') ->> 'first_publish')::boolean)::text,
  ('available', true)::text,
  'and the result says it''s a first publish (amendment 9.2)'
);

select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
insert into results values ('n2', pg_temp.save(null, '{"title": "Not out yet"}', '[]', false));
select pg_temp.sign_out();
select is(
  (select row(state, first_published_at, (pg_temp.r('n2') ->> 'first_publish')::boolean)::text from public.listings where id = pg_temp.r('n2') ->> 'listing_id'),
  row('draft', null::timestamptz, false)::text,
  'a draft has never been published'
);
update public.listings set created_at = now() - interval '1 day' where id = pg_temp.r('n2') ->> 'listing_id';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is((pg_temp.save(pg_temp.r('n2') ->> 'listing_id', '{}', '[]', true) ->> 'first_publish')::boolean, true, 'publishing the draft is its first publish');
select pg_temp.sign_out();
select is(
  (select row(state, created_at = now(), first_published_at = now())::text from public.listings where id = pg_temp.r('n2') ->> 'listing_id'),
  row('available', true, true)::text,
  'and dates it from now'
);
-- A listing first published two days ago, saved back as a draft and published again.
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, created_at, first_published_at, updated_at) values
  ('t-s3', '10000000-0000-4000-8000-000000000082', 'available', 'item', 'Lamp', 'test-category', 'good', 90, 'cash', 'A lamp.', 'online', 'test-campus', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(pg_temp.save('t-s3', '{}', '[]', false) ->> 'state', 'draft', 'a published listing goes back to draft');
select is((pg_temp.save('t-s3', '{}', '[]', true) ->> 'first_publish')::boolean, false, 'and publishing it again is not a first publish');
select pg_temp.sign_out();
select is(
  (select row(state, created_at, first_published_at, updated_at = now())::text from public.listings where id = 't-s3'),
  row('available', now() - interval '2 days', now() - interval '2 days', true)::text,
  'both dates stay; only updated_at moves'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(pg_temp.save('t-s2', '{"title": "Headset"}', '[]', true) ->> 'state', 'sold', 'Save changes keeps a sold listing sold');
select is(
  pg_temp.save(null, '{"handover": "pickup", "pickup_point_id": "20000000-0000-4000-8000-000000000083"}', '[]', true),
  '{"result": "pickup-invalid"}'::jsonb,
  'a pickup is at one of the shop''s points'
);
select is(
  pg_temp.save(null, '{"handover": "pickup", "pickup_point_id": "20000000-0000-4000-8000-000000000081"}', '[]', true) ->> 'result',
  'saved',
  'which is fine'
);
select throws_ok(
  $$select pg_temp.save(null, '{"price_zar": 0, "pay_mode": "both", "swap_for": "A lamp"}', '[]', true)$$,
  '23514', null, 'the table''s checks still hold (free means cash)'
);
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000083');
insert into results values ('n83', pg_temp.save(null, '{}', '[]', true));
select pg_temp.sign_out();
select is(
  (select state from public.listings where id = pg_temp.r('n83') ->> 'listing_id'),
  'draft',
  'a shop waiting for approval saves drafts only (plan decision 4)'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000081');
select is(pg_temp.save('t-s1', '{}', '[]', true), '{"result": "not-found"}'::jsonb, 'nobody saves another shop''s listing');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000086');
select is(pg_temp.save(null, '{}', '[]', true), '{"result": "no-shop"}'::jsonb, 'an account without a shop saves nothing');
select pg_temp.sign_out();

-- Moves (plan decision 3): Pause, Resume, Mark sold and Relist.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(public.set_listing_state('t-s1', 'paused'), 'moved', 'available to paused');
select is(public.set_listing_state('t-s1', 'paused'), 'not-allowed', 'not twice');
select is(public.set_listing_state('t-s1', 'available'), 'moved', 'paused to available');
select is(public.set_listing_state('t-s1', 'sold'), 'moved', 'available to sold');
select is(public.set_listing_state('t-s1', 'available'), 'moved', 'sold to available (Relist)');
select is(public.set_listing_state(pg_temp.r('n83') ->> 'listing_id', 'available'), 'not-allowed', 'nobody moves another shop''s listing');
select throws_ok($$select public.set_listing_state('t-s1', 'draft')$$, '22023', null, 'a draft is made by saving, not by a move');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000083');
select is(public.set_listing_state(pg_temp.r('n83') ->> 'listing_id', 'available'), 'not-allowed', 'a draft publishes from its form, not a move');
select pg_temp.sign_out();

-- A listing's photos: the seller's own waiting photos, the listing's own, and placeholders it already has.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
insert into results values ('p82b', public.add_photos(array['image/webp', 'image/jpeg']));
insert into results values ('n3', pg_temp.save(null, '{}', jsonb_build_array(
  jsonb_build_object('photo_id', pg_temp.photo('p82b', 0), 'alt', 'The front'),
  jsonb_build_object('photo_id', pg_temp.photo('p82b', 1), 'alt', '')
), true));
select pg_temp.sign_out();
select is(
  (select array_agg(row(position, photo_id, alt)::text order by position) from public.listing_photos where listing_id = pg_temp.r('n3') ->> 'listing_id'),
  array[row(0, pg_temp.photo('p82b', 0), 'The front')::text, row(1, pg_temp.photo('p82b', 1), '')::text],
  'the photos go in order, with their descriptions'
);
select is(
  (select array_agg(distinct use) from public.photos where id in (pg_temp.photo('p82b', 0), pg_temp.photo('p82b', 1))),
  array['listing:' || (pg_temp.r('n3') ->> 'listing_id')],
  'and become the listing''s'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
insert into results values ('n3b', pg_temp.save(pg_temp.r('n3') ->> 'listing_id', '{}', jsonb_build_array(
  jsonb_build_object('photo_id', pg_temp.photo('p82b', 1), 'alt', 'Now the cover')
), true));
select pg_temp.sign_out();
select is(pg_temp.r('n3b') -> 'removed_paths', jsonb_build_array(pg_temp.path('p82b', 0)), 'a photo the listing stops using is deleted');
select is(
  (select array_agg(row(position, photo_id, alt)::text) from public.listing_photos where listing_id = pg_temp.r('n3') ->> 'listing_id'),
  array[row(0, pg_temp.photo('p82b', 1), 'Now the cover')::text],
  'and the rest move up'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(
  pg_temp.save('t-s1', '{}', '[{"placeholder_src": "/placeholders/photo/2.svg", "alt": "The back"}, {"placeholder_src": "/placeholders/listing/tech.svg", "alt": ""}]', true) ->> 'result',
  'saved',
  'a sample listing keeps its placeholders, reordered'
);
select is(
  pg_temp.save('t-s1', '{}', '[{"placeholder_src": "/placeholders/photo/3.svg", "alt": ""}]', true),
  '{"result": "photos-invalid"}'::jsonb,
  'but cannot add one it didn''t have'
);
select is(
  pg_temp.save(null, '{}', jsonb_build_array(jsonb_build_object('photo_id', pg_temp.photo('p81', 2), 'alt', '')), true),
  '{"result": "photos-invalid"}'::jsonb,
  'nor use someone else''s photo'
);
select is(
  pg_temp.save(null, '{}', jsonb_build_array(jsonb_build_object('photo_id', pg_temp.photo('p82b', 1), 'alt', '')), true),
  '{"result": "photos-invalid"}'::jsonb,
  'nor another listing''s'
);
select is(
  pg_temp.save(null, '{}', (select jsonb_agg(jsonb_build_object('placeholder_src', '/placeholders/photo/2.svg', 'alt', '')) from generate_series(1, 7)), true),
  '{"result": "photos-invalid"}'::jsonb,
  'nor more than six'
);
select pg_temp.sign_out();
update public.photos set created_at = now() - interval '25 hours' where id = pg_temp.photo('p82', 2);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(
  pg_temp.save(null, '{}', jsonb_build_array(jsonb_build_object('photo_id', pg_temp.photo('p82', 2), 'alt', '')), true),
  '{"result": "photos-invalid"}'::jsonb,
  'nor a waiting photo more than a day old (amendment 9.5)'
);
select pg_temp.sign_out();
select is(
  (select array_agg(placeholder_src order by position) from public.listing_photos where listing_id = 't-s1'),
  array['/placeholders/photo/2.svg', '/placeholders/listing/tech.svg'],
  'a refused save changes no photos'
);

-- Two saves claiming the same waiting photo (M8 of the phase A review): the second finds it taken, and a clash that slips
-- past the check (as when two saves cross) is caught, never a raw unique_violation.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
insert into results values ('p82c', public.add_photos(array['image/png', 'image/png']));
insert into results values ('claim1', pg_temp.save(null, '{"title": "First claim"}', jsonb_build_array(jsonb_build_object('photo_id', pg_temp.photo('p82c', 0), 'alt', '')), true));
select is(pg_temp.r('claim1') ->> 'result', 'saved', 'a new listing claims a waiting photo');
select is(
  pg_temp.save(null, '{"title": "Second claim"}', jsonb_build_array(jsonb_build_object('photo_id', pg_temp.photo('p82c', 0), 'alt', '')), true),
  '{"result": "photos-invalid"}'::jsonb,
  'a second new listing claiming the same photo is refused'
);
select pg_temp.sign_out();
-- As if another save had just put the second photo on a listing and not yet marked it as that listing's.
insert into public.listing_photos (listing_id, photo_id, position) values (pg_temp.r('claim1') ->> 'listing_id', pg_temp.photo('p82c', 1), 1);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
select is(
  pg_temp.save(null, '{"title": "Third claim"}', jsonb_build_array(jsonb_build_object('photo_id', pg_temp.photo('p82c', 1), 'alt', '')), true),
  '{"result": "photos-invalid"}'::jsonb,
  'a clash on a photo that passed the check is caught: photos-invalid'
);
select pg_temp.sign_out();
select is(
  (select count(*) from public.listings where title in ('Second claim', 'Third claim')),
  0::bigint,
  'and neither refused save left a listing behind'
);
select is(
  (select array_agg(listing_id) from public.listing_photos where photo_id = pg_temp.photo('p82c', 0)),
  array[pg_temp.r('claim1') ->> 'listing_id'],
  'the photo stays the first listing''s'
);

-- Delete listing (selling spec 2.9).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000081');
select is(public.delete_listing(pg_temp.r('n3') ->> 'listing_id'), '{"result": "not-found"}'::jsonb, 'nobody deletes another shop''s listing');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000082');
insert into results values ('del', public.delete_listing(pg_temp.r('n3') ->> 'listing_id'));
select pg_temp.sign_out();
select is(pg_temp.r('del'), jsonb_build_object('result', 'deleted', 'removed_paths', jsonb_build_array(pg_temp.path('p82b', 1))), 'the owner deletes it, and its photo''s file is named');
select is(
  (select count(*) from public.listings where id = pg_temp.r('n3') ->> 'listing_id')
  + (select count(*) from public.photos where id = pg_temp.photo('p82b', 1)),
  0::bigint,
  'the listing and its photo are gone'
);

-- Without a profile or a shop.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000086');
select throws_ok($$select public.add_photos(array['image/png'])$$, '42501', null, 'an account without a profile stores no photos');
select throws_ok($$select public.create_shop('Shop', '', 'test-food', 'x', null, 'test-online', '{}')$$, '42501', null, 'nor makes a shop');
select is(public.set_listing_state('t-s1', 'paused'), 'not-allowed', 'nor moves a listing');
select is(public.delete_listing('t-s1'), '{"result": "not-found"}'::jsonb, 'nor deletes one');
select is(public.update_shop('x', '', 'test-food', 'x', 'test-online', '{}', null, false, null), '{"result": "no-shop"}'::jsonb, 'nor edits a shop');
select pg_temp.sign_out();

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_shop', 'update_shop', 'change_shop_slug', 'set_shop_paused', 'save_onboarding_draft', 'save_listing', 'set_listing_state', 'delete_listing', 'add_photos')
     and (p.prosecdef is not true or not (p.proconfig @> array['search_path=""']))),
  0::bigint,
  'each is security definer with an empty search path'
);

select * from finish();
rollback;
