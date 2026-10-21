-- Phases C4 and C5, Task 1: the reads the community and staff twins need (C4/C5 plan decision 12; "Missing SQL").
-- - Amendment 3's probe: the shops policy (private.is_shop_contact, 20261020120600_staff_pause_storefront.sql:53)
--   already names a Hub-paused shop to its follower and to the asker in one of its offer threads, and the storefronts
--   view tells a seller's pause (listed, paused) from the Hub's (not listed). So my_follows and my_request_offers aren't
--   made: the twins read follows, shops, storefronts, my_conversations and messages (lib/data/follows.ts:61,
--   lib/data/offers.ts:39).
-- - public.staff_accounts (listStaffAccounts, getStaffAccount; lib/data/staff-accounts.ts:72): admins only, everyone with
--   a role and no one else, with the email lower case.
-- - public.staff_find_account(p_email) (Give a staff role's check, lib/staff/account-actions.ts:61): exact, trimmed and
--   lower case, admins only.
-- take_form_state is C2/C3's (20261022120000_c2_selling.sql:192), tested in 40.
begin;
select plan(43);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8050-' || substr(md5(n), 1, 12))::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8050-' || substr(md5(n), 1, 12))::uuid;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pg_temp.a(n), 'role', 'authenticated', 'session_id', gen_random_uuid())::text,
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
create temp table results (k text primary key, v jsonb);
grant all on results to public;
create function pg_temp.r(k text) returns jsonb language sql as $f$
  select v from results where results.k = r.k;
$f$;
grant execute on all functions in schema pg_temp to public;

-- People: shop owners oa (approved A), sp (seller-paused SP), hp (Hub-paused HP), ow (waiting W); a follower f; an
-- asker q; an admin ad; a mentor m; a student t; mx, a mentor whose Auth email is in mixed case; np, an Auth user with
-- no profile; tw, an admin who is also a mentor (roles in stored order).
insert into auth.users (id, email)
select pg_temp.a(n), 'c4-' || n || '@vossie.test'
from unnest(array['oa', 'sp', 'hp', 'ow', 'f1', 'q1', 'ad', 'm1', 't1', 'np', 'tw']) n;
insert into auth.users (id, email) values (pg_temp.a('mx'), 'C4-Mixed@Vossie.Test');
insert into public.profiles (id, first_name, campus_slug, roles)
select pg_temp.a(n), 'User ' || n, 'pretoria',
  case n when 'ad' then array['admin'] when 'm1' then array['mentor'] when 'mx' then array['mentor']
    when 'tw' then array['mentor', 'admin'] else '{}'::text[] end
from unnest(array['oa', 'sp', 'hp', 'ow', 'f1', 'q1', 'ad', 'm1', 't1', 'mx', 'tw']) n;
update public.profiles set campus_slug = 'midrand' where id = pg_temp.a('mx');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
select pg_temp.s(n), 'c4-shop-' || n, pg_temp.a(n), 'C4 shop ' || n, 'tech', 'pretoria', '2026-01'
from unnest(array['oa', 'sp', 'hp', 'ow']) n;
insert into public.seller_profiles (account_id, status, shop_id, paused_by, approved_at) values
  (pg_temp.a('oa'), 'approved', pg_temp.s('oa'), null, now() - interval '8 days'),
  (pg_temp.a('sp'), 'paused', pg_temp.s('sp'), 'seller', now() - interval '8 days'),
  (pg_temp.a('hp'), 'paused', pg_temp.s('hp'), 'staff', now() - interval '8 days'),
  (pg_temp.a('ow'), 'pending', pg_temp.s('ow'), null, null);
insert into public.follows (account_id, shop_id)
select pg_temp.a('f1'), pg_temp.s(n) from unnest(array['oa', 'sp', 'hp', 'ow']) n;
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details)
values ('c4-request', pg_temp.a('q1'), 'A desk lamp for res', 'tech', 'pretoria', 'A lamp that clips onto a desk, please.');
insert into public.conversations (id, shop_id, buyer_id, status, is_offer, request_id, request_title)
values ('20000000-0000-4000-8000-000000005001', pg_temp.s('oa'), pg_temp.a('q1'), 'offered', true, 'c4-request',
  'A desk lamp for res');
insert into public.messages (conversation_id, side, body)
values ('20000000-0000-4000-8000-000000005001', 'seller', 'I have one, R120.');

-- --- Amendment 3's probe: the follower and the asker already read the shops they deal with --------------------------

select pg_temp.sign_in('f1');
select is((select name from public.shops where id = pg_temp.s('hp')), 'C4 shop hp',
  'a follower reads a shop the Hub paused, by name (is_shop_contact)');
select is((select name from public.shops where id = pg_temp.s('sp')), 'C4 shop sp', 'and one its seller paused');
select is((select count(*) from public.shops where id = pg_temp.s('ow')), 0::bigint, 'but never a waiting shop');
select is((select status from public.storefronts where shop_id = pg_temp.s('sp')), 'paused',
  'storefronts lists a seller''s pause, as paused');
select is((select count(*) from public.storefronts where shop_id = pg_temp.s('hp')), 0::bigint,
  'and not the Hub''s pause, so the two are told apart');
select is((select status from public.storefronts where shop_id = pg_temp.s('oa')), 'approved', 'an open shop is approved');
select is(
  array(select s.name from public.follows f join public.shops s on s.id = f.shop_id order by s.name),
  array['C4 shop hp', 'C4 shop oa', 'C4 shop sp'],
  'the follower''s follows join to every shop but the waiting one'
);
select is((select count(*) from public.follows), 4::bigint, 'and the follows themselves are all theirs to read');
select pg_temp.sign_out();

select pg_temp.sign_in('t1');
select is((select count(*) from public.shops where id = pg_temp.s('hp')), 0::bigint,
  'a student who doesn''t follow it never reads the Hub-paused shop');
select is((select count(*) from public.follows), 0::bigint, 'nor anyone''s follows');
select pg_temp.sign_out();

update public.seller_profiles set status = 'paused', paused_by = 'staff' where account_id = pg_temp.a('oa');
select pg_temp.sign_in('q1');
select is((select name from public.shops where id = pg_temp.s('oa')), 'C4 shop oa',
  'after the Hub pauses the offering shop, the asker still reads its name (the buyer in its offer thread)');
select is(
  (select row(is_offer, request_id, shop_id, seller_gone)::text from public.my_conversations
   where id = '20000000-0000-4000-8000-000000005001'),
  row(true, 'c4-request', pg_temp.s('oa'), false)::text,
  'the asker reads the offer thread through my_conversations'
);
select is(
  (select body from public.messages where conversation_id = '20000000-0000-4000-8000-000000005001' and side = 'seller'),
  'I have one, R120.',
  'and the shop''s first message'
);
select pg_temp.sign_out();
select pg_temp.sign_in('oa');
select is(
  (select count(*) from public.my_requests), 0::bigint, 'the offering shop''s owner reads none of the asker''s requests'
);
select pg_temp.sign_out();

-- --- staff_accounts (stage J spec decision 2) --------------------------------------------------------------------------

select pg_temp.sign_in('ad');
select is(
  array(select a.id::text from public.staff_accounts a where a.id::text like '00000000-0000-4000-8050-%' order by 1),
  array(select x::text from unnest(array[pg_temp.a('ad'), pg_temp.a('m1'), pg_temp.a('mx'), pg_temp.a('tw')]) x order by 1),
  'as an admin: everyone with a role, and no student'
);
select is((select email from public.staff_accounts where id = pg_temp.a('mx')), 'c4-mixed@vossie.test',
  'the email lower case');
select is((select campus_slug from public.staff_accounts where id = pg_temp.a('mx')), 'midrand', 'the campus');
select is((select first_name from public.staff_accounts where id = pg_temp.a('mx')), 'User mx', 'the first name');
select is((select roles from public.staff_accounts where id = pg_temp.a('tw')), array['mentor', 'admin'],
  'the roles in stored order');
select pg_temp.sign_out();

select pg_temp.sign_in('m1');
select is((select count(*) from public.staff_accounts), 0::bigint, 'a mentor reads no staff account');
select pg_temp.sign_out();
select pg_temp.sign_in('t1');
select is((select count(*) from public.staff_accounts), 0::bigint, 'nor a student');
select pg_temp.sign_out();
set local role anon;
select throws_ok('select count(*) from public.staff_accounts', '42501', null, 'anon may not read it');
reset role;
set local role service_role;
select is((select count(*) from public.staff_accounts), 0::bigint, 'the service role, with no session, reads none');
reset role;
select ok(
  (select c.reloptions @> array['security_invoker=true'] from pg_class c where c.oid = 'public.staff_accounts'::regclass),
  'staff_accounts is security_invoker'
);
select is(
  array(select column_name::text from information_schema.columns
        where table_schema = 'public' and table_name = 'staff_accounts' order by ordinal_position),
  array['id', 'first_name', 'email', 'campus_slug', 'roles'],
  'and gives only these columns'
);

-- --- staff_find_account (giveStaffRole's check; never a search) --------------------------------------------------------

select pg_temp.sign_in('ad');
select is(
  (select row(f.id, f.first_name, f.roles)::text from public.staff_find_account(' C4-T1@Vossie.Test ') f),
  row(pg_temp.a('t1'), 'User t1', '{}'::text[])::text,
  'an admin finds an account by its exact email, trimmed and in any case'
);
select is((select count(*) from public.staff_find_account('c4-t1@vossie')), 0::bigint, 'never by a prefix');
select is((select count(*) from public.staff_find_account('@vossie.test')), 0::bigint, 'nor a domain');
select is((select count(*) from public.staff_find_account('%@vossie.test')), 0::bigint, 'nor a pattern');
select is((select count(*) from public.staff_find_account('c4-t_@vossie.test')), 0::bigint, 'nor a one-letter wildcard');
select is((select count(*) from public.staff_find_account('c4-np@vossie.test')), 0::bigint,
  'an Auth user with no profile isn''t found');
select is((select count(*) from public.staff_find_account('')), 0::bigint, 'nor a blank address');
select is((select count(*) from public.staff_find_account(null)), 0::bigint, 'nor none');
select is(
  (select roles from public.staff_find_account('c4-mixed@vossie.test')), array['mentor'],
  'an account with a role gives its roles'
);
select pg_temp.sign_out();

select pg_temp.sign_in('m1');
select is((select count(*) from public.staff_find_account('c4-t1@vossie.test')), 0::bigint,
  'a mentor finds nothing, with no error');
select pg_temp.sign_out();
select pg_temp.sign_in('t1');
select is((select count(*) from public.staff_find_account('c4-ad@vossie.test')), 0::bigint, 'nor a student');
select pg_temp.sign_out();
set local role anon;
select throws_ok($$select * from public.staff_find_account('c4-t1@vossie.test')$$, '42501', null, 'anon can''t run it');
reset role;

-- --- Grants (decision 12) ----------------------------------------------------------------------------------------------

select is(
  array(select r from unnest(array['anon', 'authenticated', 'service_role']) r
        where has_table_privilege(r, 'public.staff_accounts', 'select') order by 1),
  array['authenticated', 'service_role'],
  'staff_accounts: select for authenticated and the service role only'
);
select is(
  array(select r from unnest(array['anon', 'authenticated', 'service_role']) r
        where has_table_privilege(r, 'public.staff_accounts', 'insert, update, delete, truncate') order by 1),
  '{}'::text[],
  'and nothing else for anyone'
);
select is(
  array(select r from unnest(array['anon', 'authenticated', 'service_role']) r
        where has_function_privilege(r, 'public.staff_find_account(text)', 'execute') order by 1),
  array['authenticated', 'service_role'],
  'staff_find_account: authenticated and the service role'
);
select is(
  array(select r from unnest(array['anon', 'authenticated', 'service_role']) r
        where has_function_privilege(r, 'private.staff_accounts()', 'execute') order by 1),
  array['authenticated', 'service_role'],
  'private.staff_accounts: the roles the view runs as, never anon'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
   where p.oid = 'public.staff_find_account(text)'::regprocedure),
  'staff_find_account is security definer with an empty search path'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
   where p.oid = 'private.staff_accounts()'::regprocedure),
  'and so is private.staff_accounts'
);

select * from finish();
rollback;
