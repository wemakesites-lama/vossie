-- Phase C2, Task 1: the selling SQL the Supabase twins need (C2/C3 plan decisions 6, 7 and 10, and the controller's
-- answer to amendment 2): links a fixed route uses (RESERVED_SLUGS), the shop name and link checks that see shops the
-- access rules hide, the owner's old links, a new listing's or a staff form's one-time token taken through
-- take_form_state, and the form states' 65 minutes (lib/selling/rules.ts, lib/data/shops.ts, lib/selling/form-state.ts,
-- lib/staff/once.ts).
begin;
select plan(50);

-- Accounts and shops by their last two characters; a signed-in session per account (its JWT's session_id).
create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.t(n text) returns text language sql immutable as $f$
  select '70000000-0000-4000-8000-0000000000' || n;
$f$;
create function pg_temp.session(n text) returns uuid language sql immutable as $f$
  select ('50000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pg_temp.a(n), 'role', 'authenticated', 'session_id', pg_temp.session(n))::text,
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
-- A one-time token's row: `form` is the prefix ('staff-once' or 'listing-once'), for account n's session `sess`.
create function pg_temp.issue(n text, sess text, prefix text, token text, lasts interval, is_taken boolean) returns void
language sql as $f$
  insert into public.form_states (session_id, form, account_id, expires_at, taken)
  values (pg_temp.session(sess), prefix || ':' || pg_temp.t(token), pg_temp.a(n), now() + lasts, is_taken);
$f$;
create function pg_temp.taken(sess text, prefix text, token text) returns boolean language sql as $f$
  select f.taken from public.form_states f
  where f.session_id = pg_temp.session(sess) and f.form = prefix || ':' || pg_temp.t(token);
$f$;
-- Signed in as n with no session_id in the token.
create function pg_temp.sign_in_sessionless(n text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.a(n), 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$f$;
create temp table results (k text primary key, v jsonb);
grant all on results to public;
create function pg_temp.r(k text) returns jsonb language sql as $f$
  select v from results where results.k = r.k;
$f$;
grant execute on all functions in schema pg_temp to public;

-- Places: a campus with no pickup points (so a shop needs none), and another campus.
insert into public.campuses (slug, name, region, sort) values
  ('c2-campus', 'C2 campus', 'Gauteng', 97), ('c2-other', 'C2 other campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('c2-category', 'C2 category', 99);

-- People: e1 Crochet corner (approved), e2 a waiting shop, e3 a declined one (waiting, with declined_at), e4 a shop the
-- Hub paused, e5 a student who opens a shop, e6 a student, e7 a shop that changes its link.
insert into auth.users (id, email)
select pg_temp.a(n), 'c2-' || n || '@eduvos.com' from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7']) n;
insert into public.profiles (id, first_name, campus_slug)
select pg_temp.a(n), 'User ' || n, 'c2-campus' from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7']) n;
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
select s.id, s.slug, s.owner_id, s.name, 'c2-category', 'c2-campus', '2026-01'
from (values
  (pg_temp.s('e1'), 'c2-crochet', pg_temp.a('e1'), 'Crochet corner'),
  (pg_temp.s('e2'), 'c2-waiting', pg_temp.a('e2'), 'Waiting wool'),
  (pg_temp.s('e3'), 'c2-declined', pg_temp.a('e3'), 'Declined dyes'),
  (pg_temp.s('e4'), 'c2-hub-paused', pg_temp.a('e4'), 'Paused pots'),
  (pg_temp.s('e7'), 'c2-old-link', pg_temp.a('e7'), 'Moving mugs')
) as s(id, slug, owner_id, name);
insert into public.seller_profiles (account_id, status, shop_id, paused_by, declined_at, approved_at) values
  (pg_temp.a('e1'), 'approved', pg_temp.s('e1'), null, null, now() - interval '8 days'),
  (pg_temp.a('e2'), 'pending', pg_temp.s('e2'), null, null, null),
  (pg_temp.a('e3'), 'pending', pg_temp.s('e3'), null, now() - interval '1 day', null),
  (pg_temp.a('e4'), 'paused', pg_temp.s('e4'), 'staff', null, now() - interval '8 days'),
  (pg_temp.a('e7'), 'approved', pg_temp.s('e7'), null, null, now() - interval '8 days');

-- --- Reserved links (decision 7; RESERVED_SLUGS, lib/selling/rules.ts:30) ------------------------------------------

select is(private.reserved_shop_slugs(), array['export'], 'the reserved links are RESERVED_SLUGS''s');
select is(private.slugify('Export'), 'export-shop', 'slugify("Export") is export-shop, as the app''s');
select is(private.slugify('Ex'), 'ex-shop', 'a link shorter than 3 still gets -shop');
select is(private.slugify('!!'), 'shop', 'and a name with no letters is shop');
select is(private.slugify('Crochet  Corner!'), 'crochet-corner', 'and any other name is as before');
select ok(private.shop_slug_in_use('export', null), 'a reserved word is a link in use');

select pg_temp.sign_in('e5');
insert into results values ('export', public.create_shop('Export', '', 'c2-category', '', null, 'c2-campus', '{}'));
select pg_temp.sign_out();
select is(pg_temp.r('export') ->> 'result', 'created', 'a shop named Export is made');
select is(pg_temp.r('export') ->> 'slug', 'export-shop', 'with the link export-shop');

select pg_temp.sign_in('e1');
select is(public.change_shop_slug('export'), 'taken', 'an approved shop can''t change its link to export');
select pg_temp.sign_out();

-- --- shop_name_taken (decision 6; isShopNameTaken, lib/data/shops.ts:29) ----------------------------------------------

select pg_temp.sign_in('e6');
select ok(public.shop_name_taken('CROCHET  corner!', 'c2-campus', null), 'a name another shop on the campus has, in any case and punctuation');
select ok(public.shop_name_taken('waiting WOOL', 'c2-campus', null), 'a waiting shop''s name counts');
select ok(public.shop_name_taken('Declined dyes', 'c2-campus', null), 'a declined shop''s');
select ok(public.shop_name_taken('Paused pots', 'c2-campus', null), 'and a shop the Hub paused');
select ok(not public.shop_name_taken('Crochet corner', 'c2-other', null), 'but not on another campus');
select ok(not public.shop_name_taken('Crochet corner', 'c2-campus', 'c2-crochet'), 'nor the shop being edited');
select ok(not public.shop_name_taken('Brand new', 'c2-campus', null), 'and a free name is free');

-- --- shop_slug_taken (isSlugTaken, shops.ts:48) --------------------------------------------------------------------

select ok(public.shop_slug_taken('c2-crochet'), 'a shop''s current link is taken');
select pg_temp.sign_out();
select pg_temp.sign_in('e7');
select is(public.change_shop_slug('c2-new-link'), 'changed', 'e7 changes its link once');
select is(public.my_previous_shop_slugs(), array['c2-old-link'], 'and sees its old link');
select pg_temp.sign_out();
select pg_temp.sign_in('e6');
select ok(public.shop_slug_taken('c2-old-link'), 'an old link kept after a change is taken');
select ok(public.shop_slug_taken('export'), 'so is a reserved word');
select ok(not public.shop_slug_taken('c2-free-link'), 'and a free link isn''t');

-- --- my_previous_shop_slugs (SellerRow.previousSlugs; ShopExport.previousLinks) -----------------------------------------

select is(public.my_previous_shop_slugs(), '{}'::text[], 'an account with no shop sees no old links');
select pg_temp.sign_out();
select pg_temp.sign_in('e1');
select is(public.my_previous_shop_slugs(), '{}'::text[], 'nor does a shop that never changed its link (e7''s are its own)');
select pg_temp.sign_out();

-- --- take_form_state (the controller's answer to amendment 2; takeFormState, lib/data/form-states.ts) ----------------

select pg_temp.issue('e6', 'e6', 'staff-once', 'a1', interval '1 hour', false);
select pg_temp.issue('e6', 'e6', 'listing-once', 'a2', interval '1 hour', false);
select pg_temp.issue('e6', 'e6', 'listing-once', 'a3', interval '1 hour', true);
select pg_temp.issue('e6', 'e6', 'listing-once', 'a4', interval '-1 minute', false);
select pg_temp.issue('e6', 'e1', 'listing-once', 'a5', interval '1 hour', false);
select pg_temp.issue('e1', 'e1', 'staff-once', 'a6', interval '1 hour', false);
select pg_temp.issue('e6', 'e6', 'listing-once', 'a7', interval '1 hour', false);

select pg_temp.sign_in('e6');
select is(public.take_form_state('staff-once:' || pg_temp.t('a1')), 'first', 'a staff form''s token is first');
select pg_temp.sign_out();
select ok(pg_temp.taken('e6', 'staff-once', 'a1'), 'and is taken now');
select pg_temp.sign_in('e6');
select is(public.take_form_state('staff-once:' || pg_temp.t('a1')), 'again', 'then again');
select is(public.take_form_state('listing-once:' || pg_temp.t('a2')), 'first', 'a new listing''s token is first');
select is(public.take_form_state('listing-once:' || pg_temp.t('a2')), 'again', 'then again');
select is(public.take_form_state('listing-once:' || pg_temp.t('a3')), 'again', 'a token taken before is again');
select is(public.take_form_state('listing-once:' || pg_temp.t('a4')), 'none', 'one that ran out is none');
select is(public.take_form_state('listing-once:' || pg_temp.t('a5')), 'none', 'one of another session of the same account is none');
select is(public.take_form_state('staff-once:' || pg_temp.t('a6')), 'none', 'and another account''s');
select is(public.take_form_state('listing:new'), 'none', 'a form that isn''t a one-time token is none');
select is(public.take_form_state('staff-once:x'), 'none', 'as is a token of the wrong shape');
select is(public.take_form_state(null), 'none', 'or none at all');
select pg_temp.sign_out();
select ok(not pg_temp.taken('e1', 'listing-once', 'a5') and not pg_temp.taken('e1', 'staff-once', 'a6'), 'and none of those was taken');

-- No session in the token: nothing is taken.
select pg_temp.sign_in_sessionless('e6');
select is(public.take_form_state('listing-once:' || pg_temp.t('a7')), 'none', 'a token with no session id takes nothing');
select pg_temp.sign_out();
select ok(not pg_temp.taken('e6', 'listing-once', 'a7'), 'and leaves the row free');

-- take_once_token (lib/staff/once.ts's SQL side, inside save_request and the staff functions) is unchanged: test 17
-- runs its cases; here only that it never takes a listing's token.
select pg_temp.sign_in('e6');
reset role; -- the private schema is the definer functions' only: called as the owner, with e6's claims
select is(private.take_once_token(pg_temp.t('a7')), 'none', 'take_once_token doesn''t take a listing''s token');
select pg_temp.sign_out();
select ok(not pg_temp.taken('e6', 'listing-once', 'a7'), 'which stays free');

-- --- The form states' 65 minutes (decision 10) -------------------------------------------------------------------------

select pg_temp.sign_in('e6');
select lives_ok(
  format($$insert into public.form_states (session_id, form, account_id, expires_at) values (%L, 'listing-once:%s', %L, now() + interval '64 minutes')$$,
    pg_temp.session('e6'), pg_temp.t('b1'), pg_temp.a('e6')),
  'a state lasting 64 minutes is kept (an app clock a little ahead of the database''s)'
);
select throws_ok(
  format($$insert into public.form_states (session_id, form, account_id, expires_at) values (%L, 'listing-once:%s', %L, now() + interval '66 minutes')$$,
    pg_temp.session('e6'), pg_temp.t('b2'), pg_temp.a('e6')),
  '42501', null,
  'one lasting 66 minutes isn''t'
);
select pg_temp.sign_out();

-- --- Grants ------------------------------------------------------------------------------------------------------------

select is(
  array(
    select f from unnest(array[
      'public.shop_name_taken(text, text, text)', 'public.shop_slug_taken(text)', 'public.my_previous_shop_slugs()',
      'public.take_form_state(text)'
    ]) f
    where has_function_privilege('anon', f, 'execute')
      or not has_function_privilege('authenticated', f, 'execute')
      or not has_function_privilege('service_role', f, 'execute')
  ),
  '{}'::text[],
  'the new functions run for signed-in people and the server, never anon'
);
select is(
  array(
    select f from unnest(array['private.reserved_shop_slugs()', 'private.take_form_once(text)']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')
      or has_function_privilege('service_role', f, 'execute')
  ),
  '{}'::text[],
  'the new helpers run only inside the functions'
);
set local role anon;
select throws_ok($$select public.shop_name_taken('x', 'c2-campus', null)$$, '42501', null, 'anon can''t check a name');
select throws_ok($$select public.shop_slug_taken('export')$$, '42501', null, 'nor a link');
select throws_ok($$select public.my_previous_shop_slugs()$$, '42501', null, 'nor read old links');
select throws_ok($$select public.take_form_state('listing:new')$$, '42501', null, 'nor take a token');
reset role;

-- save_listing is unchanged (the controller's answer to amendment 2): one signature, 14 arguments.
select is(
  array(select p.pronargs::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'save_listing'),
  array[14],
  'save_listing keeps its one signature'
);

select * from finish();
rollback;
