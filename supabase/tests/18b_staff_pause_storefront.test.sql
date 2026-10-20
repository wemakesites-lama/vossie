-- Schema catch-up, Task 6b: a shop the Hub paused has no storefront (hasStorefront, lib/data/catalog.ts:28): nobody but
-- its owner and staff reads it or its listings (publicListing, catalog.ts:114), so nothing can start a conversation
-- with it, report it or follow it (composerSubject and reportSubject, lib/messaging/subjects.ts; addFollow,
-- lib/data/follows.ts:27). A shop its seller paused keeps its storefront. A buyer who already wrote to it, and a
-- follower, still read its row for its name and photo (shopOf, lib/data/messages.ts:90; listFollowedShops,
-- follows.ts:62), never its listings.
begin;
select plan(65);

-- Accounts and shops by their last two characters; a signed-in session per account.
create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', pg_temp.a(n), 'role', 'authenticated', 'session_id', ('50000000-0000-4000-8000-0000000000' || n)::uuid
    )::text,
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
-- What the reader sees of the test's shops, listings, listing photos and pickup points, by slug or id.
create function pg_temp.shops() returns text[] language sql as $f$
  select coalesce(array_agg(slug order by slug), '{}') from public.shops where slug like 'sp-%';
$f$;
create function pg_temp.listings() returns text[] language sql as $f$
  select coalesce(array_agg(id order by id), '{}') from public.listings where id like 'sp-%';
$f$;
create function pg_temp.photos() returns text[] language sql as $f$
  select coalesce(array_agg(listing_id order by listing_id), '{}') from public.listing_photos where listing_id like 'sp-%';
$f$;
create function pg_temp.points() returns text[] language sql as $f$
  select coalesce(array_agg(s.slug order by s.slug), '{}')
  from public.shop_pickup_points sp join public.shops s on s.id = sp.shop_id
  where s.slug like 'sp-%';
$f$;
create temp table ids (k text primary key, v text);
grant all on ids to public;
grant execute on all functions in schema pg_temp to public;

-- Places.
insert into public.campuses (slug, name, region, sort) values ('sp-campus', 'Pause campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('sp-category', 'Pause category', 99);
insert into public.pickup_points (id, campus_slug, name) values ('20000000-0000-4000-8000-0000000000e1', 'sp-campus', 'Library entrance');

-- People:
-- e1 Ayanda, an open shop;                       e2 Bheki, a shop its seller paused;
-- e3 Chipo, a shop the Hub paused;               e4 Dineo, a shop the Hub paused over her own pause;
-- e5 Esi, a student;                             e6 Fezile, a student who wrote to Chipo and follows her shop;
-- e7 Gugu, an admin;                             e8 Hlengiwe, Chipo's mentor;
-- e9 Itu, a shop waiting for approval;           ea Jabu, who owns a shop but whose seller profile has gone.
-- sp-sample is a sample stall no account owns.
insert into auth.users (id, email)
select pg_temp.a(n), 'sp-' || n || '@eduvos.com'
from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'ea']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('e1'), 'Ayanda', 'sp-campus', '{}'), (pg_temp.a('e2'), 'Bheki', 'sp-campus', '{}'),
  (pg_temp.a('e3'), 'Chipo', 'sp-campus', '{}'), (pg_temp.a('e4'), 'Dineo', 'sp-campus', '{}'),
  (pg_temp.a('e5'), 'Esi', 'sp-campus', '{}'), (pg_temp.a('e6'), 'Fezile', 'sp-campus', '{}'),
  (pg_temp.a('e7'), 'Gugu', 'sp-campus', '{admin}'), (pg_temp.a('e8'), 'Hlengiwe', 'sp-campus', '{mentor}'),
  (pg_temp.a('e9'), 'Itu', 'sp-campus', '{}'), (pg_temp.a('ea'), 'Jabu', 'sp-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
select s.id, s.slug, s.owner_id, s.name, 'sp-category', 'sp-campus', '2026-01'
from (values
  (pg_temp.s('e1'), 'sp-ayanda', pg_temp.a('e1'), 'Ayanda art'),
  (pg_temp.s('e2'), 'sp-bheki', pg_temp.a('e2'), 'Bheki books'),
  (pg_temp.s('e3'), 'sp-chipo', pg_temp.a('e3'), 'Chipo cakes'),
  (pg_temp.s('e4'), 'sp-dineo', pg_temp.a('e4'), 'Dineo designs'),
  (pg_temp.s('e9'), 'sp-itu', pg_temp.a('e9'), 'Itu ink'),
  (pg_temp.s('ea'), 'sp-jabu', pg_temp.a('ea'), 'Jabu jams'),
  (pg_temp.s('e0'), 'sp-sample', null::uuid, 'Sample stall')
) as s(id, slug, owner_id, name);
insert into public.seller_profiles (
  account_id, status, shop_id, applied_at, paused_by, seller_paused_too, staff_reason, approved_at, mentor_id
) values
  (pg_temp.a('e1'), 'approved', pg_temp.s('e1'), now() - interval '9 days', null, false, null, now() - interval '8 days', null),
  (pg_temp.a('e2'), 'paused', pg_temp.s('e2'), now() - interval '9 days', 'seller', false, null, now() - interval '8 days', null),
  (pg_temp.a('e3'), 'paused', pg_temp.s('e3'), now() - interval '9 days', 'staff', false, 'Checking.', now() - interval '8 days', pg_temp.a('e8')),
  (pg_temp.a('e4'), 'paused', pg_temp.s('e4'), now() - interval '9 days', 'staff', true, 'Checking.', now() - interval '8 days', null),
  (pg_temp.a('e9'), 'pending', pg_temp.s('e9'), now() - interval '2 days', null, false, null, null, null);
-- Each shop has one available listing with a photo, and its pickup point.
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at)
select 'sp-' || n, pg_temp.s(n), 'available', 'item', 'Thing ' || n, 'sp-category', 'good', 100, 'cash', 'A thing.', 'online',
  'sp-campus', now() - interval '5 days'
from unnest(array['e1', 'e2', 'e3', 'e4', 'e9', 'ea', 'e0']) n;
insert into public.listing_photos (listing_id, photo_id, placeholder_src, position, alt)
select 'sp-' || n, null, '/placeholders/photo/2.svg', 0, ''
from unnest(array['e1', 'e2', 'e3', 'e4', 'e9', 'ea', 'e0']) n;
insert into public.shop_pickup_points (shop_id, pickup_point_id)
select pg_temp.s(n), '20000000-0000-4000-8000-0000000000e1'
from unnest(array['e1', 'e2', 'e3', 'e4', 'e9', 'ea', 'e0']) n;
-- Fezile wrote to Chipo about her listing before the Hub paused the shop, and follows it.
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id)
values ('60000000-0000-4000-8000-0000000000e6', 'sp-e3', 'Thing e3', pg_temp.s('e3'), pg_temp.a('e6'));
insert into public.messages (conversation_id, side, body)
values ('60000000-0000-4000-8000-0000000000e6', 'buyer', 'Is this still available?');
insert into public.follows (account_id, shop_id) values (pg_temp.a('e6'), pg_temp.s('e3'));

-- --- One rule: hasStorefront ------------------------------------------------------------------------------------------

select is(private.shop_is_public(pg_temp.s('e1')), true, 'an approved shop has a storefront');
select is(private.shop_is_public(pg_temp.s('e2')), true, 'so does a shop its seller paused');
select is(private.shop_is_public(pg_temp.s('e3')), false, 'a shop the Hub paused has none (catalog.ts:28)');
select is(private.shop_is_public(pg_temp.s('e4')), false, 'nor one the Hub paused over its seller''s own pause');
select is(private.shop_is_public(pg_temp.s('e9')), false, 'nor a shop waiting for approval');
select is(private.shop_is_public(pg_temp.s('ea')), false, 'nor an owned shop whose seller profile has gone');
select is(private.shop_is_public(pg_temp.s('e0')), true, 'a sample shop no one owns has one');
select is(private.shop_is_public('10000000-0000-4000-8000-0000000000ff'), false, 'an unknown shop has none');
select is(private.shop_is_public(null), false, 'nor a null one');
select is(
  array(
    select private.shop_has_storefront(id) = private.shop_is_public(id)
    from (values (pg_temp.s('e1')), (pg_temp.s('e2')), (pg_temp.s('e3')), (pg_temp.s('e4')), (pg_temp.s('e9')),
      (pg_temp.s('ea')), (pg_temp.s('e0')), ('10000000-0000-4000-8000-0000000000ff'::uuid)) v(id)
  ),
  array[true, true, true, true, true, true, true, true],
  'shop_has_storefront is the same rule'
);
select is(
  (select row(p.provolatile, p.prosecdef, p.proconfig)::text from pg_proc p where p.oid = 'private.shop_is_public(uuid)'::regprocedure),
  row('s'::"char", true, array['search_path=""'])::text,
  'shop_is_public keeps its volatility, security and search path'
);
select ok(
  has_function_privilege('anon', 'private.shop_is_public(uuid)', 'execute')
  and has_function_privilege('authenticated', 'private.shop_is_public(uuid)', 'execute')
  and has_function_privilege('service_role', 'private.shop_is_public(uuid)', 'execute'),
  'and its grants'
);
select ok(
  not has_function_privilege('anon', 'private.is_shop_contact(uuid)', 'execute')
  and has_function_privilege('authenticated', 'private.is_shop_contact(uuid)', 'execute'),
  'is_shop_contact runs for signed-in people only, as its policy needs'
);

-- --- Who reads what ---------------------------------------------------------------------------------------------------

set local role anon;
select is(pg_temp.shops(), array['sp-ayanda', 'sp-bheki', 'sp-sample'], 'anon reads open and seller-paused shops, not Hub-paused ones');
select is(pg_temp.listings(), array['sp-e0', 'sp-e1', 'sp-e2'], 'nor their listings');
select is(pg_temp.photos(), array['sp-e0', 'sp-e1', 'sp-e2'], 'nor their listing photos');
select is(pg_temp.points(), array['sp-ayanda', 'sp-bheki', 'sp-sample'], 'nor their pickup points');
select is((select count(*) from public.shops where id = pg_temp.s('e3')), 0::bigint, 'a Hub-paused shop isn''t there by id');
reset role;

select pg_temp.sign_in('e5');
select is(pg_temp.shops(), array['sp-ayanda', 'sp-bheki', 'sp-sample'], 'a signed-in student reads the same shops');
select is(pg_temp.listings(), array['sp-e0', 'sp-e1', 'sp-e2'], 'and listings');
select is(pg_temp.photos(), array['sp-e0', 'sp-e1', 'sp-e2'], 'and listing photos');
select is(pg_temp.points(), array['sp-ayanda', 'sp-bheki', 'sp-sample'], 'and pickup points');
select pg_temp.sign_out();

select pg_temp.sign_in('e3');
select is(pg_temp.shops(), array['sp-ayanda', 'sp-bheki', 'sp-chipo', 'sp-sample'], 'the Hub-paused shop''s owner still reads it');
select is(pg_temp.listings(), array['sp-e0', 'sp-e1', 'sp-e2', 'sp-e3'], 'and its listings');
select is(pg_temp.photos(), array['sp-e0', 'sp-e1', 'sp-e2', 'sp-e3'], 'and their photos');
select is(pg_temp.points(), array['sp-ayanda', 'sp-bheki', 'sp-chipo', 'sp-sample'], 'and its pickup points');
select pg_temp.sign_out();

select pg_temp.sign_in('e7');
select is(
  pg_temp.shops(), array['sp-ayanda', 'sp-bheki', 'sp-chipo', 'sp-dineo', 'sp-itu', 'sp-jabu', 'sp-sample'],
  'an admin reads every shop'
);
select is(pg_temp.listings(), array['sp-e0', 'sp-e1', 'sp-e2', 'sp-e3', 'sp-e4', 'sp-e9', 'sp-ea'], 'and every listing');
select is(pg_temp.photos(), array['sp-e0', 'sp-e1', 'sp-e2', 'sp-e3', 'sp-e4', 'sp-e9', 'sp-ea'], 'and their photos');
select pg_temp.sign_out();

select pg_temp.sign_in('e8');
select ok('sp-chipo' = any (pg_temp.shops()) and 'sp-e3' = any (pg_temp.listings()), 'Chipo''s mentor reads her shop and listings');
select ok(not ('sp-dineo' = any (pg_temp.shops())), 'but not another Hub-paused shop');
select pg_temp.sign_out();

-- Fezile, who wrote to Chipo and follows her, still sees the shop's name, never its listings.
select pg_temp.sign_in('e6');
select is(pg_temp.shops(), array['sp-ayanda', 'sp-bheki', 'sp-chipo', 'sp-sample'], 'a buyer and follower reads the Hub-paused shop''s row');
select is((select name from public.shops where id = pg_temp.s('e3')), 'Chipo cakes', 'its name, for the thread and Saved''s Shops tab');
select is(pg_temp.listings(), array['sp-e0', 'sp-e1', 'sp-e2'], 'but not its listings (the thread keeps the title it had)');
select is(pg_temp.photos(), array['sp-e0', 'sp-e1', 'sp-e2'], 'nor their photos');
select is(
  (select array_agg(shop_id::text) from public.my_conversations),
  array[pg_temp.s('e3')::text],
  'and the conversation is still in the inbox'
);
select is(
  public.send_message('60000000-0000-4000-8000-0000000000e6', 'Are you still there?'), 'sent',
  'a reply in an existing thread still goes (sendMessage checks no storefront)'
);
select pg_temp.sign_out();

-- Following alone is enough, and only while the shop is paused; a conversation alone is enough too.
delete from public.conversations where id = '60000000-0000-4000-8000-0000000000e6';
select pg_temp.sign_in('e6');
select ok('sp-chipo' = any (pg_temp.shops()), 'a follower with no thread still reads it');
select pg_temp.sign_out();
delete from public.follows where account_id = pg_temp.a('e6');
select pg_temp.sign_in('e6');
select ok(not ('sp-chipo' = any (pg_temp.shops())), 'and once they unfollow, no longer');
select pg_temp.sign_out();
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id)
values ('60000000-0000-4000-8000-0000000000e6', null, null, pg_temp.s('e3'), pg_temp.a('e6'));
select pg_temp.sign_in('e6');
select ok('sp-chipo' = any (pg_temp.shops()), 'a buyer with a question thread reads it too');
select pg_temp.sign_out();
-- A follow or a thread never shows a shop waiting for approval (none can be made, but the rule says so too).
insert into public.follows (account_id, shop_id) values (pg_temp.a('e6'), pg_temp.s('e9'));
select pg_temp.sign_in('e6');
select ok(not ('sp-itu' = any (pg_temp.shops())), 'a follow doesn''t show a waiting shop');
select pg_temp.sign_out();
delete from public.follows where account_id = pg_temp.a('e6') and shop_id = pg_temp.s('e9');

-- --- What can be done to it (the app's lookups say null, so not-found) -------------------------------------------------

select pg_temp.sign_in('e5');
select is(
  public.start_conversation('sp-e3', null, 'Is this still available?', null) ->> 'result', 'not-found',
  'a first message about a Hub-paused shop''s listing: not-found (composerSubject is null)'
);
select is(
  public.start_conversation(null, 'sp-chipo', 'Do you do birthday cakes?', null) ->> 'result', 'not-found',
  'a question to a Hub-paused shop: not-found'
);
select is(
  public.start_conversation('sp-e2', null, 'Is this still available?', null) ->> 'result', 'closed',
  'a seller-paused shop''s listing is closed (open is false: the listing shows paused)'
);
select is(
  public.start_conversation(null, 'sp-bheki', 'When are you back?', null) ->> 'result', 'started',
  'and a question to a seller-paused shop goes'
);
select is(
  (select count(*) from public.my_conversations where shop_id = pg_temp.s('e3')), 0::bigint,
  'nothing was written for the Hub-paused shop'
);
select is(public.create_report('seller', 'sp-chipo', 'x', 'scam', ''), 'not-found', 'reporting a Hub-paused shop: not-found (reportSubject is null)');
select is(public.create_report('listing', 'sp-e3', 'x', 'scam', ''), 'not-found', 'nor its listing');
select is(public.create_report('seller', 'sp-dineo', 'x', 'scam', ''), 'not-found', 'nor a shop the Hub paused over its seller''s pause');
select is(public.create_report('seller', 'sp-bheki', 'x', 'scam', ''), 'created', 'a seller-paused shop can be reported');
select is(public.create_report('listing', 'sp-e2', 'x', 'scam', ''), 'created', 'and its listing');
select is(public.follow_shop(pg_temp.s('e3')), 'not-found', 'following a Hub-paused shop: not-found (addFollow)');
select is(public.follow_shop(pg_temp.s('e4')), 'not-found', 'nor one the Hub paused over its seller''s pause');
select is(public.follow_shop(pg_temp.s('e2')), 'followed', 'a seller-paused shop can be followed');
select is(public.follow_shop(pg_temp.s('e1')), 'followed', 'and an open one');
select pg_temp.sign_out();

-- --- The Hub's own pause and resume ------------------------------------------------------------------------------------

select pg_temp.sign_in('e7');
select is(public.staff_pause_shop(pg_temp.s('e1'), 'Checking a report.'), 'changed', 'the Hub pauses Ayanda''s shop');
select pg_temp.sign_out();
set local role anon;
select ok(not ('sp-ayanda' = any (pg_temp.shops())) and not ('sp-e1' = any (pg_temp.listings())), 'its storefront and listing go at once');
reset role;
select pg_temp.sign_in('e5');
-- Esi follows Ayanda's shop (above), so she still reads its row, not its listing.
select ok('sp-ayanda' = any (pg_temp.shops()) and not ('sp-e1' = any (pg_temp.listings())), 'a follower keeps the row, not the listing');
select is(public.unfollow_shop(pg_temp.s('e1')), 'unfollowed', 'and can unfollow it (Saved''s Shops tab)');
select ok(not ('sp-ayanda' = any (pg_temp.shops())), 'after which it''s gone for her too');
select pg_temp.sign_out();
select pg_temp.sign_in('e7');
select is(public.staff_resume_shop(pg_temp.s('e1')), 'changed', 'the Hub resumes it');
select pg_temp.sign_out();
set local role anon;
select ok('sp-ayanda' = any (pg_temp.shops()) and 'sp-e1' = any (pg_temp.listings()), 'and its storefront is back');
reset role;
-- Dineo's resume puts her own pause back: a seller-paused shop, public again.
select pg_temp.sign_in('e7');
select is(public.staff_resume_shop(pg_temp.s('e4')), 'changed', 'the Hub resumes Dineo''s shop');
select pg_temp.sign_out();
set local role anon;
select ok('sp-dineo' = any (pg_temp.shops()) and 'sp-e4' = any (pg_temp.listings()), 'to her own pause, so its storefront is back');
reset role;

-- --- The rest of the app's rules for a paused shop, unchanged ------------------------------------------------------------

-- A Hub-paused shop can't offer (offerStatus: paused), whatever its listings.
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, status)
values ('sp-r1', pg_temp.a('e5'), 'Need a cake', 'sp-category', 'sp-campus', 'A cake for a birthday.', 'open');
select pg_temp.sign_in('e3');
select is(public.start_offer('sp-r1', null, 'I bake!') ->> 'result', 'paused', 'a Hub-paused shop can''t offer (offerStatus)');
select pg_temp.sign_out();

select * from finish();
rollback;
