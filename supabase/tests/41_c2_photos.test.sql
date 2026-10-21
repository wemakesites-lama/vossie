-- Phase C2, Task 2: the photos SQL (C2/C3 plan decisions 11, 14 and 15): who may see a photo (/photos/[id], photoFor in
-- lib/data/photos.ts), Hub staff reading the Hub's waiting covers (photoSrcsOf("hub")), and the daily sweep's rows and
-- orphan files (/api/cron/photos; spec section 7).
begin;
select plan(38);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.p(n text) returns uuid language sql immutable as $f$
  select ('30000000-0000-4000-8000-0000000000' || n)::uuid;
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
-- A photo's file path: {owner}/{id}, or hub/{id} for the Hub's.
create function pg_temp.path(id text, owner text) returns text language sql immutable as $f$
  select coalesce(pg_temp.a(owner)::text, 'hub') || '/' || pg_temp.p(id)::text;
$f$;
-- photo_file's answer as one line, 'type | owner_only | hub_only' ('-' for a null owner_only), or null for no row.
create function pg_temp.file(n text) returns text language sql as $f$
  select concat_ws(' | ', f.type, coalesce(f.owner_only::text, '-'), f.hub_only::text)
  from public.photo_file(pg_temp.p(n)) f;
$f$;
-- A photo of account `owner` (the Hub's when null) with a use, made `age` ago.
create function pg_temp.photo(id text, owner text, use text, age interval) returns void language sql as $f$
  insert into public.photos (id, owner_id, use, type, path, created_at)
  values (pg_temp.p(id), pg_temp.a(owner), use, 'image/webp', pg_temp.path(id, owner), now() - age);
$f$;
-- How many of this test's photos the signed-in reader sees.
create function pg_temp.seen() returns bigint language sql as $f$
  select count(*) from public.photos where id::text like '30000000-0000-4000-8000-0000000000%';
$f$;
-- A file in a bucket, made `age` ago.
create function pg_temp.file_in(bucket text, name text, age interval) returns void language sql as $f$
  insert into storage.objects (bucket_id, name, created_at) values (bucket, name, now() - age);
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('c2p-campus', 'C2 photos campus', 'Gauteng', 97);
insert into public.categories (slug, name, sort) values ('c2p-category', 'C2 photos category', 99);

-- People: c1 a seller, c2 a student, c3 a mentor.
insert into auth.users (id, email)
select pg_temp.a(n), 'c2p-' || n || '@eduvos.com' from unnest(array['c1', 'c2', 'c3']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('c1'), 'Seller', 'c2p-campus', '{}'), (pg_temp.a('c2'), 'Student', 'c2p-campus', '{}'),
  (pg_temp.a('c3'), 'Mentor', 'c2p-campus', array['mentor']);
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
values ('10000000-0000-4000-8000-0000000000c1', 'c2p-shop', pg_temp.a('c1'), 'Photo shop', 'c2p-category', 'c2p-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, approved_at)
values (pg_temp.a('c1'), 'approved', '10000000-0000-4000-8000-0000000000c1', now() - interval '30 days');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at, hidden_at, hidden_reason) values
  ('c2p-shown', '10000000-0000-4000-8000-0000000000c1', 'available', 'item', 'Shown', 'c2p-category', 'good', 100, 'cash', 'A thing.', 'online', 'c2p-campus', now() - interval '30 days', null, null),
  ('c2p-hidden', '10000000-0000-4000-8000-0000000000c1', 'available', 'item', 'Hidden', 'c2p-category', 'good', 100, 'cash', 'A thing.', 'online', 'c2p-campus', now() - interval '30 days', now() - interval '1 day', 'Rude.'),
  ('c2p-draft', '10000000-0000-4000-8000-0000000000c1', 'draft', 'item', 'Draft', 'c2p-category', 'good', 100, 'cash', 'A thing.', 'online', 'c2p-campus', null, null, null);

-- Photos: 01 waiting (an hour), 02 waiting (25 hours), 03 a shown listing's, 04 a hidden listing's, 05 a draft
-- listing's, 06 a Hub cover waiting (an hour), 07 one waiting 25 hours, 08 a published post's cover, 09 an unpublished
-- post's, 0a a shop's, 0b an onboarding draft's (both a month old).
select pg_temp.photo('01', 'c1', null, interval '1 hour');
select pg_temp.photo('02', 'c1', null, interval '25 hours');
select pg_temp.photo('03', 'c1', 'listing:c2p-shown', interval '30 days');
select pg_temp.photo('04', 'c1', 'listing:c2p-hidden', interval '30 days');
select pg_temp.photo('05', 'c1', 'listing:c2p-draft', interval '30 days');
select pg_temp.photo('06', null, 'hub-draft', interval '1 hour');
select pg_temp.photo('07', null, 'hub-draft', interval '25 hours');
select pg_temp.photo('08', null, 'post:c2p-published', interval '30 days');
select pg_temp.photo('09', null, 'post:c2p-unpublished', interval '30 days');
select pg_temp.photo('0a', 'c1', 'shop', interval '30 days');
select pg_temp.photo('0b', 'c1', 'draft', interval '30 days');
insert into public.hub_posts (id, kind, title, summary, body, cover_photo_id, published, published_at) values
  ('c2p-published', 'tip', 'A tip', 'Read this.', 'Some advice.', pg_temp.p('08'), true, now()),
  ('c2p-unpublished', 'tip', 'A draft tip', 'Not yet.', 'Some advice.', pg_temp.p('09'), false, null);

-- --- photo_file (decision 11) ------------------------------------------------------------------------------------------

select is(pg_temp.file('ff'), null, 'an unknown photo has no file');
select is(
  (select path from public.photo_file(pg_temp.p('01'))), pg_temp.path('01', 'c1'),
  'a waiting photo an hour old gives its path'
);
select is(pg_temp.file('01'), 'image/webp | - | false', 'its type, and anyone with the link may see it (open question 3)');
select is(pg_temp.file('02'), null, 'a waiting photo a day old is gone');
select is(pg_temp.file('03'), 'image/webp | - | false', 'a shown listing''s photo is anyone''s');
select is(pg_temp.file('04'), 'image/webp | ' || pg_temp.a('c1') || ' | false', 'a hidden listing''s goes to its uploader only');
update public.listings set hidden_at = null, hidden_reason = null where id = 'c2p-hidden';
select is(pg_temp.file('04'), 'image/webp | - | false', 'and to anyone once shown again');
select is(pg_temp.file('05'), 'image/webp | - | false', 'a draft listing''s photo is anyone''s, as in the sample');
select is(pg_temp.file('06'), 'image/webp | - | true', 'a Hub cover still waiting goes to Hub staff only');
select is(pg_temp.file('07'), null, 'one a day old is gone');
select is(
  (select path from public.photo_file(pg_temp.p('08'))), 'hub/' || pg_temp.p('08')::text,
  'a published post''s cover is at hub/<id>'
);
select is(pg_temp.file('08'), 'image/webp | - | false', 'and is anyone''s');
select is(pg_temp.file('09'), 'image/webp | - | true', 'an unpublished post''s cover is Hub staff''s only');
select is(pg_temp.file('0a'), 'image/webp | - | false', 'a shop''s photo is anyone''s');
select is(pg_temp.file('0b'), 'image/webp | - | false', 'as is an onboarding draft''s');

-- --- Reading photos (decision 14) ----------------------------------------------------------------------------------------

select pg_temp.sign_in('c1');
select is(pg_temp.seen(), 7::bigint, 'a student reads their own photos');
select pg_temp.sign_out();
select pg_temp.sign_in('c2');
select is(pg_temp.seen(), 0::bigint, 'and no one else''s, the Hub''s included');
select pg_temp.sign_out();
select pg_temp.sign_in('c3');
select is(pg_temp.seen(), 4::bigint, 'a mentor reads the Hub''s photos');
select is(
  (select count(*) from public.photos where use = 'hub-draft' and id in (pg_temp.p('06'), pg_temp.p('07'))), 2::bigint,
  'its waiting covers included (photoSrcsOf("hub"))'
);
select pg_temp.sign_out();
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'photos' and cmd = 'SELECT'),
  1::bigint,
  'one select policy on photos (no multiple permissive policies)'
);

-- --- The orphan files (decision 15) -----------------------------------------------------------------------------------

insert into storage.buckets (id, name) values ('c2p-other', 'c2p-other');
select pg_temp.file_in('photos', 'c2p/orphan-old', interval '2 hours');
select pg_temp.file_in('photos', 'c2p/orphan-new', interval '10 minutes');
select pg_temp.file_in('photos', pg_temp.path('0a', 'c1'), interval '2 hours');
select pg_temp.file_in('c2p-other', 'c2p/other-bucket', interval '2 hours');
select ok('c2p/orphan-old' = any (public.orphan_photo_paths(1000)), 'a file no photo names, 2 hours old, is an orphan');
select ok(not ('c2p/orphan-new' = any (public.orphan_photo_paths(1000))), 'one 10 minutes old isn''t yet');
select ok(not (pg_temp.path('0a', 'c1') = any (public.orphan_photo_paths(1000))), 'nor a file a photo names');
select ok(not ('c2p/other-bucket' = any (public.orphan_photo_paths(1000))), 'nor a file in another bucket');
select is(cardinality(public.orphan_photo_paths(0)), 1, 'at least one is asked for');
select pg_temp.file_in('photos', 'c2p/bulk-' || lpad(g::text, 4, '0'), interval '2 hours') from generate_series(1, 1001) g;
select is(cardinality(public.orphan_photo_paths(5000)), 1000, 'and at most 1,000');
select is(cardinality(public.orphan_photo_paths(null)), 1000, '1,000 when no limit is given');
select is(
  (select array_agg(x order by x) from unnest(public.orphan_photo_paths(1000)) x),
  public.orphan_photo_paths(1000),
  'sorted by path'
);

-- --- The sweep's rows (decision 15) ----------------------------------------------------------------------------------

create temp table swept (v text[]);
insert into swept select public.sweep_waiting_photos();
select is(
  (select array_agg(x order by x) from swept, unnest(swept.v) x
   where x in (pg_temp.path('02', 'c1'), pg_temp.path('07', null), pg_temp.path('01', 'c1'), pg_temp.path('06', null))),
  (select array_agg(x order by x) from unnest(array[pg_temp.path('02', 'c1'), pg_temp.path('07', null)]) x),
  'the sweep removes a waiting photo and a waiting Hub cover a day old, and returns their paths'
);
select is((select v from swept), (select array_agg(x order by x) from swept, unnest(swept.v) x), 'sorted');
select is(
  (select count(*) from public.photos where id in (pg_temp.p('02'), pg_temp.p('07'))), 0::bigint,
  'their rows are gone'
);
select is(
  (select array_agg(id order by id) from public.photos where id::text like '30000000-0000-4000-8000-0000000000%'),
  array[pg_temp.p('01'), pg_temp.p('03'), pg_temp.p('04'), pg_temp.p('05'), pg_temp.p('06'), pg_temp.p('08'),
    pg_temp.p('09'), pg_temp.p('0a'), pg_temp.p('0b')],
  'fresh waiting photos and covers, listings'', posts'', shops'' and drafts'' photos stay, however old'
);
select is(public.sweep_waiting_photos(), '{}'::text[], 'a second sweep finds nothing');

-- --- Grants ------------------------------------------------------------------------------------------------------------

select is(
  array(
    select f from unnest(array[
      'public.photo_file(uuid)', 'public.sweep_waiting_photos()', 'public.orphan_photo_paths(integer)'
    ]) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')
      or not has_function_privilege('service_role', f, 'execute')
  ),
  '{}'::text[],
  'the three are the server''s only'
);
select pg_temp.sign_in('c3');
select throws_ok($$select * from public.photo_file('30000000-0000-4000-8000-000000000001')$$, '42501', null, 'a signed-in mentor can''t ask for a file');
select throws_ok($$select public.sweep_waiting_photos()$$, '42501', null, 'nor sweep');
select throws_ok($$select public.orphan_photo_paths(10)$$, '42501', null, 'nor list orphans');
select pg_temp.sign_out();
set local role anon;
select throws_ok($$select * from public.photo_file('30000000-0000-4000-8000-000000000001')$$, '42501', null, 'nor can anon');
reset role;

select * from finish();
rollback;
