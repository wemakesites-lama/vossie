-- Step 2b, Task 8: three read-only views for phase C's public reads (supabase step 2b plan, decision 13; amendment 6).
-- - storefronts: a public shop's status, 'approved' or 'paused' by its seller (shopStatus and hasStorefront,
--   lib/data/catalog.ts), which anon can't otherwise tell, since it can't read seller_profiles;
-- - request_cards: the public request columns with closes_on and the offer count (toRequest, lib/data/requests.ts);
-- - hub_cards: published posts with how many are going now (hub-posts.ts).
-- Each is security_invoker, so the tables' policies and column grants still apply, and none shows who asked, who
-- wrote, who owns or follows, a mentor's note, a report's owner or a reminder's mark.
begin;
select plan(27);

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
-- The fixture's storefronts, as slug:status, for whoever reads.
create function pg_temp.fronts() returns text[] language sql as $f$
  select coalesce(array_agg(f.slug || ':' || f.status order by f.slug), '{}') from public.storefronts f where f.slug like 'pr-%';
$f$;
create function pg_temp.columns(view text) returns text[] language sql as $f$
  select array_agg(c.column_name::text order by c.ordinal_position)
  from information_schema.columns c where c.table_schema = 'public' and c.table_name = view;
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('pr-campus', 'Reads campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('pr-category', 'Reads category', 99);
-- b1 Lerato, an open shop; b2 Sipho, a shop he paused; b3 Kabelo, a shop the Hub paused; b4 Naledi, a waiting shop;
-- b5 Dumi, a declined one; b6 Zola asks; b7 Thandi, a student who reads. b0 is a sample shop no account owns.
insert into auth.users (id, email)
select pg_temp.a(n), 'pr-' || n || '@eduvos.com' from unnest(array['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7']) n;
insert into public.profiles (id, first_name, campus_slug) values
  (pg_temp.a('b1'), 'Lerato', 'pr-campus'), (pg_temp.a('b2'), 'Sipho', 'pr-campus'),
  (pg_temp.a('b3'), 'Kabelo', 'pr-campus'), (pg_temp.a('b4'), 'Naledi', 'pr-campus'),
  (pg_temp.a('b5'), 'Dumi', 'pr-campus'), (pg_temp.a('b6'), 'Zola', 'pr-campus'), (pg_temp.a('b7'), 'Thandi', 'pr-campus');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('b1'), 'pr-lerato', pg_temp.a('b1'), 'Lerato crafts', 'pr-category', 'pr-campus', '2026-01'),
  (pg_temp.s('b2'), 'pr-sipho', pg_temp.a('b2'), 'Sipho prints', 'pr-category', 'pr-campus', '2026-01'),
  (pg_temp.s('b3'), 'pr-kabelo', pg_temp.a('b3'), 'Kabelo kicks', 'pr-category', 'pr-campus', '2026-01'),
  (pg_temp.s('b4'), 'pr-naledi', pg_temp.a('b4'), 'Naledi bakes', 'pr-category', 'pr-campus', '2026-01'),
  (pg_temp.s('b5'), 'pr-dumi', pg_temp.a('b5'), 'Dumi drinks', 'pr-category', 'pr-campus', '2026-01'),
  (pg_temp.s('b0'), 'pr-sample', null, 'Sample stall', 'pr-category', 'pr-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at, paused_by, staff_reason, declined_at) values
  (pg_temp.a('b1'), 'approved', pg_temp.s('b1'), now() - interval '9 days', now() - interval '8 days', null, null, null),
  (pg_temp.a('b2'), 'paused', pg_temp.s('b2'), now() - interval '9 days', now() - interval '8 days', 'seller', null, null),
  (pg_temp.a('b3'), 'paused', pg_temp.s('b3'), now() - interval '9 days', now() - interval '8 days', 'staff', 'Rude.', null),
  (pg_temp.a('b4'), 'pending', pg_temp.s('b4'), now() - interval '2 days', null, null, null, null),
  (pg_temp.a('b5'), 'pending', pg_temp.s('b5'), now() - interval '2 days', null, null, 'Blurry photos.', now() - interval '1 day');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at)
values ('pr-l1', pg_temp.s('b1'), 'available', 'item', 'Desk lamp', 'pr-category', 'good', 120, 'cash', 'A lamp.', 'online', 'pr-campus', now());
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, created_at, updated_at) values
  ('pr-ask', pg_temp.a('b6'), 'Need a desk lamp', 'pr-category', 'pr-campus', 'A lamp for late study nights.', now() - interval '2 days', now() - interval '2 days'),
  ('pr-gone', pg_temp.a('b6'), 'Need a stapler', 'pr-category', 'pr-campus', 'A stapler for my project.', now() - interval '2 days', now() - interval '2 days');
update public.requests set hidden_at = now(), hidden_reason = 'Rude.' where id = 'pr-gone';
insert into public.hub_posts (id, kind, title, summary, place, body, campus_slug, starts_at, capacity, going, published, published_at) values
  ('pr-event', 'event', 'Market day', 'Stalls on the lawn.', 'The lawn', 'Bring your stall.', 'pr-campus', now() + interval '3 days', 50, 3, true, now()),
  ('pr-draft', 'event', 'Quiz night', 'A quiz.', 'The hall', 'Teams of four.', 'pr-campus', now() + interval '5 days', 40, 0, false, null);
insert into public.hub_rsvps (post_id, account_id) values ('pr-event', pg_temp.a('b6')), ('pr-event', pg_temp.a('b7'));

-- --- storefronts --------------------------------------------------------------------------------------------------------

set local role anon;
select ok('pr-sample:approved' = any (pg_temp.fronts()), 'a sample shop is approved');
select ok('pr-lerato:approved' = any (pg_temp.fronts()), 'an approved shop with an owner is approved');
select ok('pr-sipho:paused' = any (pg_temp.fronts()), 'a shop its seller paused is paused');
select ok(not exists (select 1 from public.storefronts f where f.slug = 'pr-kabelo'), 'a shop the Hub paused has no row');
select ok(not exists (select 1 from public.storefronts f where f.slug = 'pr-naledi'), 'nor has a waiting shop');
select ok(not exists (select 1 from public.storefronts f where f.slug = 'pr-dumi'), 'nor a declined one');
select throws_ok('select account_id from public.seller_profiles', '42501', null, 'anon still can''t read seller profiles');
reset role;
select pg_temp.sign_in('b7');
select is(pg_temp.fronts(), array['pr-lerato:approved', 'pr-sample:approved', 'pr-sipho:paused'], 'a signed-in student reads the same');
select pg_temp.sign_out();
select pg_temp.sign_in('b3');
select ok(not exists (select 1 from public.storefronts f where f.slug = 'pr-kabelo'), 'and the Hub-paused shop''s owner finds no storefront there either');
select pg_temp.sign_out();
select is(pg_temp.columns('storefronts'), array['shop_id', 'slug', 'status'], 'storefronts shows the shop, its link and its status');

-- --- request_cards ------------------------------------------------------------------------------------------------------

select pg_temp.sign_in('b1');
select is(public.start_offer('pr-ask', 'pr-l1', 'I have one.') ->> 'result', 'offered', 'Lerato offers on Zola''s request');
select pg_temp.sign_out();
set local role anon;
select is(
  (select count(*) from public.request_cards c join public.requests r on r.id = c.id
   where c.closes_on is null and c.offers = r.seed_offers),
  16::bigint,
  'the 16 samples, with no closing day and their seed''s offers'
);
select is(
  (select count(*) from public.request_cards c where c.id not like 'pr-%'), 16::bigint, 'and nothing else of the seed''s'
);
select ok(not exists (select 1 from public.request_cards c where c.id = 'pr-gone'), 'a hidden request has no row');
select is(
  (select row(c.closes_on, c.offers)::text from public.request_cards c where c.id = 'pr-ask'),
  row(pg_temp.today() - 2 + 30, 1)::text,
  'an asker''s request has its closing day, and Lerato''s offer counts'
);
reset role;
select pg_temp.sign_in('b6');
select ok(not exists (select 1 from public.request_cards c where c.id = 'pr-gone'), 'its asker finds no hidden one here either');
select pg_temp.sign_out();
select is(
  pg_temp.columns('request_cards'),
  array['id', 'title', 'category_slug', 'campus_slug', 'details', 'budget_zar', 'swap_welcome', 'needed_by', 'status',
    'created_at', 'updated_at', 'closed_at', 'closes_on', 'offers'],
  'request_cards shows the public columns, never who asked'
);

-- --- hub_cards ----------------------------------------------------------------------------------------------------------

set local role anon;
select is(
  (select count(*) from public.hub_cards),
  (select count(*) from public.hub_posts p where p.published),
  'hub_cards has every published post'
);
select ok(not exists (select 1 from public.hub_cards h where h.id = 'pr-draft'), 'and no draft');
select is((select h.going_now from public.hub_cards h where h.id = 'pr-event'), 5, 'an event''s going now is its going plus RSVPs');
select is(
  (select count(*) from public.hub_cards h where h.kind in ('tip', 'office-hours') and h.going_now is not null),
  0::bigint,
  'tips and office hours have none'
);
reset role;
select is(
  pg_temp.columns('hub_cards'),
  array['id', 'kind', 'title', 'summary', 'place', 'body', 'campus_slug', 'starts_at', 'capacity', 'going', 'going_now',
    'image_src', 'image_alt', 'cover_photo_id', 'published_at', 'created_at'],
  'hub_cards shows the post, never who wrote it'
);

-- --- All three ----------------------------------------------------------------------------------------------------------

select is(
  array(select c.relname::text from pg_class c
        where c.oid in ('public.storefronts'::regclass, 'public.request_cards'::regclass, 'public.hub_cards'::regclass)
          and 'security_invoker=true' = any (c.reloptions)
        order by 1),
  array['hub_cards', 'request_cards', 'storefronts'],
  'each is security_invoker, so the tables'' policies apply'
);
select is(
  array(select g.table_name || ' ' || g.grantee || ' ' || g.privilege_type from information_schema.role_table_grants g
        where g.table_schema = 'public' and g.table_name in ('storefronts', 'request_cards', 'hub_cards')
          and g.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
        order by 1),
  array[
    'hub_cards anon SELECT', 'hub_cards authenticated SELECT', 'hub_cards service_role SELECT',
    'request_cards anon SELECT', 'request_cards authenticated SELECT', 'request_cards service_role SELECT',
    'storefronts anon SELECT', 'storefronts authenticated SELECT', 'storefronts service_role SELECT'
  ],
  'each is select for anon, signed-in people and the server, and nothing else'
);
select is(
  array(select c.table_name || '.' || c.column_name from information_schema.columns c
        where c.table_schema = 'public' and c.table_name in ('storefronts', 'request_cards', 'hub_cards')
          and c.column_name in ('asker_id', 'author_id', 'owner_id', 'account_id', 'mentor_id', 'reminded_for',
            'target_owner_id', 'closed_by', 'hidden_reason', 'seed_offers')),
  '{}'::text[],
  'none shows who asked, wrote, owns or mentors, a reminder''s mark, a report''s owner or a Hub reason'
);
select is(
  array[
    has_function_privilege('anon', 'private.storefront_status(uuid)', 'execute'),
    has_function_privilege('authenticated', 'private.storefront_status(uuid)', 'execute'),
    has_function_privilege('service_role', 'private.storefront_status(uuid)', 'execute')
  ],
  array[true, true, true],
  'the view''s readers run storefront_status (the private schema stays closed to them)'
);
select is(
  (select provolatile::text || ' ' || prosecdef::text from pg_proc where oid = 'private.storefront_status(uuid)'::regprocedure),
  's true',
  'which is stable and reads seller profiles as its owner'
);

select * from finish();
rollback;
