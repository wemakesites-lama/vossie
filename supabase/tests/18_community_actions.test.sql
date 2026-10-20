-- Schema catch-up, Task 6: the community actions (stage H) and saved-search alerts (stage I): Looking For requests,
-- offers (and send_message's waiting and replied), follows, saved searches, a first publish's notifications to
-- followers and to matching saved searches, their clean-up when a listing goes or a shop changes its link, and reports
-- on requests (supabase schema catch-up plan, Task 6 and decisions 3 and 4; lib/looking-for/actions.ts,
-- lib/data/requests.ts, offers.ts, messages.ts, follows.ts, saved-searches.ts, notifications.ts, own-listings.ts,
-- shops.ts; lib/selling/listing-actions.ts).
-- The expected sentences were printed from the TypeScript (offerNoteText, newListingText, newListingsText,
-- searchMatchText, searchMatchesText, messageNoteText, saleNoteText, threadPath) on 2026-10-20.
begin;
select plan(167);

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
-- A form's one-time token for account n's session (issueOnceToken, lib/staff/once.ts).
create function pg_temp.issue(n text, token text) returns text language sql as $f$
  insert into public.form_states (session_id, form, account_id, expires_at)
  values (pg_temp.session(n), 'staff-once:' || pg_temp.t(token), pg_temp.a(n), now() + interval '1 hour')
  returning pg_temp.t(token);
$f$;
create function pg_temp.taken(n text, token text) returns boolean language sql as $f$
  select taken from public.form_states where session_id = pg_temp.session(n) and form = 'staff-once:' || pg_temp.t(token);
$f$;
-- Ids the functions made, by a name.
create temp table ids (k text primary key, v text);
create function pg_temp.id(k text) returns text language sql as $f$
  select v from ids where ids.k = id.k;
$f$;
-- A request's fields as the form sends them once checked, with a title.
create function pg_temp.request(id text, title text, token text) returns jsonb language sql as $f$
  select public.save_request(id, title, 'ca-category', 'ca-campus', 'A lamp for late study nights.', 150, true, null, token);
$f$;
-- A listing's fields as the form sends them once checked, with a title.
create function pg_temp.save(listing text, title text, publish boolean) returns jsonb language sql as $f$
  select public.save_listing(
    listing, 'item', title, 'ca-category', 'good', 100, false, 'cash', null, 'A thing.', 'online', null, '[]'::jsonb, publish
  );
$f$;
-- Every notification of these accounts: name, kind, subject, sentence, link, count ('-' for null) and whether read.
create function pg_temp.notes() returns text[] language sql as $f$
  select coalesce(array_agg(
    concat_ws(' | ', p.first_name, n.kind, n.subject_id, n.text, n.href, coalesce(n.count::text, '-'),
      case when n.read_at is null then 'new' else 'read' end)
    order by p.first_name, n.kind, n.subject_id, n.href
  ), '{}')
  from public.notifications n join public.profiles p on p.id = n.account_id
  where n.account_id::text like '00000000-0000-4000-8000-0000000000f%';
$f$;
create function pg_temp.clear() returns void language sql as $f$
  delete from public.notifications where account_id::text like '00000000-0000-4000-8000-0000000000f%';
$f$;
-- Whether this session holds the advisory lock on a key, as the functions take it.
create function pg_temp.locked(key text) returns boolean language sql as $f$
  select exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and granted and classid = hashtext(key)::oid and objid = 0
  );
$f$;
create temp table snap (v text[]);
grant all on ids, snap to public;
grant execute on all functions in schema pg_temp to public;

-- Places.
insert into public.campuses (slug, name, region, sort) values ('ca-campus', 'Community campus', 'Gauteng', 98);
insert into public.categories (slug, name, sort) values ('ca-category', 'Community category', 99);

-- People:
-- f1 Zola, a student who asks;               f2 Lerato, an open shop (Lerato crafts);
-- f3 Sipho, an open shop (Sipho prints);      f4 Naledi, a shop waiting for approval;
-- f5 Kabelo, a shop its seller paused;        f6 Thandi, a student;
-- f7 Bongi, a student;                        f8 Dumi, a shop the Hub paused.
-- ca-a1 is a sample stall no account owns; ca-g-1 to ca-g-199 are more of them.
insert into auth.users (id, email)
select pg_temp.a(n), 'ca-' || n || '@eduvos.com' from unnest(array['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8']) n;
insert into public.profiles (id, first_name, campus_slug) values
  (pg_temp.a('f1'), 'Zola', 'ca-campus'), (pg_temp.a('f2'), 'Lerato', 'ca-campus'),
  (pg_temp.a('f3'), 'Sipho', 'ca-campus'), (pg_temp.a('f4'), 'Naledi', 'ca-campus'),
  (pg_temp.a('f5'), 'Kabelo', 'ca-campus'), (pg_temp.a('f6'), 'Thandi', 'ca-campus'),
  (pg_temp.a('f7'), 'Bongi', 'ca-campus'), (pg_temp.a('f8'), 'Dumi', 'ca-campus');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
select s.id, s.slug, s.owner_id, s.name, 'ca-category', 'ca-campus', '2026-01'
from (values
  (pg_temp.s('f2'), 'ca-lerato', pg_temp.a('f2'), 'Lerato crafts'),
  (pg_temp.s('f3'), 'ca-sipho', pg_temp.a('f3'), 'Sipho prints'),
  (pg_temp.s('f4'), 'ca-naledi', pg_temp.a('f4'), 'Naledi bakes'),
  (pg_temp.s('f5'), 'ca-kabelo', pg_temp.a('f5'), 'Kabelo kicks'),
  (pg_temp.s('f8'), 'ca-dumi', pg_temp.a('f8'), 'Dumi deals'),
  (pg_temp.s('a1'), 'ca-a1', null::uuid, 'Stall a1')
) as s(id, slug, owner_id, name);
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
select gen_random_uuid(), 'ca-g-' || g, null, 'Stall g' || g, 'ca-category', 'ca-campus', '2026-01'
from generate_series(1, 199) g;
insert into public.seller_profiles (account_id, status, shop_id, applied_at, paused_by, approved_at) values
  (pg_temp.a('f2'), 'approved', pg_temp.s('f2'), now() - interval '9 days', null, now() - interval '8 days'),
  (pg_temp.a('f3'), 'approved', pg_temp.s('f3'), now() - interval '9 days', null, now() - interval '8 days'),
  (pg_temp.a('f4'), 'pending', pg_temp.s('f4'), now() - interval '2 days', null, null),
  (pg_temp.a('f5'), 'paused', pg_temp.s('f5'), now() - interval '9 days', 'seller', now() - interval '8 days'),
  (pg_temp.a('f8'), 'paused', pg_temp.s('f8'), now() - interval '9 days', 'staff', now() - interval '8 days');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('ca-l-lamp', pg_temp.s('f2'), 'available', 'item', 'Old lamp', 'ca-category', 'good', 100, 'cash', 'A lamp.', 'online', 'ca-campus', now() - interval '5 days'),
  ('ca-l-draft', pg_temp.s('f2'), 'draft', 'item', 'Draft lamp', 'ca-category', 'good', 100, 'cash', 'A lamp.', 'online', 'ca-campus', null),
  ('ca-l-sipho', pg_temp.s('f3'), 'available', 'item', 'Poster', 'ca-category', 'good', 100, 'cash', 'A poster.', 'online', 'ca-campus', now() - interval '5 days');
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, status, created_at, closed_at, hidden_at, hidden_reason) values
  ('ca-r1', pg_temp.a('f1'), 'Need a desk lamp', 'ca-category', 'ca-campus', 'A lamp for late study nights.', 'open', now() - interval '3 days', null, null, null),
  ('ca-closed', pg_temp.a('f1'), 'Need a kettle', 'ca-category', 'ca-campus', 'A kettle for the residence.', 'closed', now() - interval '3 days', now() - interval '2 days', null, null),
  ('ca-hidden', pg_temp.a('f1'), 'Need a phone', 'ca-category', 'ca-campus', 'A phone with a good camera.', 'open', now() - interval '3 days', null, now() - interval '1 day', 'Rude.'),
  ('ca-r2', pg_temp.a('f6'), 'Need a stapler', 'ca-category', 'ca-campus', 'A stapler for my project.', 'open', now() - interval '3 days', null, null, null),
  ('ca-r-lerato', pg_temp.a('f2'), 'Need some beads', 'ca-category', 'ca-campus', 'Beads for a new necklace.', 'open', now() - interval '3 days', null, null, null),
  ('ca-sample', null, 'Need a sample', 'ca-category', 'ca-campus', 'A sample request from the fixtures.', 'open', now() - interval '3 days', null, null, null);

-- --- The functions ----------------------------------------------------------------------------------------------------

select is(
  array(
    select f from unnest(array[
      'public.save_request(text, text, text, text, text, integer, boolean, date, text)',
      'public.set_request_open(text, boolean)', 'public.delete_request(text)',
      'public.start_offer(text, text, text)', 'public.follow_shop(uuid)', 'public.unfollow_shop(uuid)',
      'public.save_search(text, text, text, text, text, text, text)', 'public.set_search_paused(text, boolean)',
      'public.delete_search(text)', 'public.send_message(uuid, text)', 'public.mark_completed(uuid)',
      'public.create_report(text, text, text, text, text)', 'public.delete_listing(text)',
      'public.save_listing(text, text, text, text, text, integer, boolean, text, text, text, text, uuid, jsonb, boolean)'
    ]) f
    where has_function_privilege('anon', f, 'execute')
      or not has_function_privilege('authenticated', f, 'execute')
      or not has_function_privilege('service_role', f, 'execute')
  ),
  '{}'::text[],
  'the new user actions and the replaced ones run for signed-in people and the server, never anon'
);
select ok(
  has_function_privilege('service_role', 'public.record_search_matches(text, text[], jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.record_search_matches(text, text[], jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.record_search_matches(text, text[], jsonb)', 'execute'),
  'record_search_matches is the server''s only (plan decision 4)'
);
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('offer_note_text', 'new_listing_note_text', 'new_listings_note_text', 'search_match_note_text',
        'search_matches_note_text', 'once_a_day_more_text', 'notify_once_per_day', 'once_token_taken',
        'shop_has_storefront', 'conversation_title', 'tell_followers', 'shop_link_moved', 'tell_other_side')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('service_role', p.oid, 'execute'))
  ),
  '{}'::text[],
  'the sentences and helpers run only inside the functions'
);
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname in ('offer_note_text', 'new_listing_note_text', 'new_listings_note_text', 'search_match_note_text',
       'search_matches_note_text', 'once_a_day_more_text', 'notify_once_per_day', 'once_token_taken',
       'shop_has_storefront', 'conversation_title', 'tell_followers')),
  11::bigint,
  'and they exist'
);
select pg_temp.sign_in('f1');
select throws_ok(
  $$select public.record_search_matches('ca-l-lamp', array['x'], '{}'::jsonb)$$, '42501', null,
  'a signed-in student can''t send search alerts'
);
select pg_temp.sign_out();
set local role anon;
select throws_ok($$select public.follow_shop('10000000-0000-4000-8000-0000000000f2')$$, '42501', null, 'anon can''t follow');
reset role;

-- --- The sentences, as the app writes them -------------------------------------------------------------------------

select is(private.offer_note_text('Lerato crafts', 'Need a desk lamp'), 'Lerato crafts offered to help with Need a desk lamp', 'offerNoteText');
select is(private.new_listing_note_text('Lerato crafts', 'Desk lamp'), 'Lerato crafts listed Desk lamp', 'newListingText');
select is(private.new_listings_note_text('Lerato crafts', 2), 'Lerato crafts listed 2 new things', 'newListingsText');
select is(private.search_match_note_text('Desk lamp', 'lamp in Books'), 'Desk lamp matches your search lamp in Books', 'searchMatchText');
select is(private.search_matches_note_text(2, 'lamp in Books'), '2 new listings match your search lamp in Books', 'searchMatchesText');

-- --- Requests (saveMyRequest, closeMyRequest, reopenMyRequest, deleteMyRequest; lib/data/requests.ts) ----------------

select pg_temp.issue('f1', 'c1');
select pg_temp.sign_in('f1');
select is(pg_temp.request(null, 'Need a bike pump', pg_temp.t('c0')) ->> 'result', 'once-expired', 'a new request with a token it wasn''t given is refused');
insert into ids select 'new1', pg_temp.request(null, 'Need a bike pump', pg_temp.t('c1')) ->> 'id';
select is(pg_temp.request(null, 'Need a bike pump', pg_temp.t('c1')) ->> 'result', 'once-taken', 'the same form sent again makes nothing');
select pg_temp.sign_out();
select is(
  (select row(asker_id, title, category_slug, campus_slug, details, budget_zar, swap_welcome, needed_by, status,
     created_at = now(), updated_at = now(), closed_at, seed_offers, hidden_at)::text
   from public.requests where id = pg_temp.id('new1')),
  row(pg_temp.a('f1'), 'Need a bike pump', 'ca-category', 'ca-campus', 'A lamp for late study nights.', 150, true,
    null::date, 'open', true, true, null::timestamptz, 0, null::timestamptz)::text,
  'the request is up, open, Zola''s'
);
select is((select count(*) from public.requests where asker_id = pg_temp.a('f1') and title = 'Need a bike pump'), 1::bigint, 'once');
select is(pg_temp.taken('f1', 'c1'), true, 'and the token is taken');

update public.requests set updated_at = now() - interval '1 hour' where id = pg_temp.id('new1');
select pg_temp.sign_in('f1');
select is(pg_temp.request(pg_temp.id('new1'), 'Need a bicycle pump', null) ->> 'result', 'saved', 'Zola edits her open request');
select pg_temp.sign_out();
select is(
  (select row(title, updated_at = now())::text from public.requests where id = pg_temp.id('new1')),
  row('Need a bicycle pump', true)::text,
  'with its new title, updated now'
);
select pg_temp.sign_in('f6');
select is(pg_temp.request(pg_temp.id('new1'), 'Mine now', null) ->> 'result', 'not-found', 'Thandi can''t edit Zola''s request');
select pg_temp.sign_out();
select pg_temp.sign_in('f1');
select is(pg_temp.request('ca-closed', 'Need a kettle again', null) ->> 'result', 'not-open', 'a closed request can''t be edited');
select is(pg_temp.request('ca-hidden', 'Need a phone again', null) ->> 'result', 'not-open', 'nor a hidden one');
select pg_temp.sign_out();

-- At most 5 open (OPEN_REQUESTS_MAX), a hidden one not counted: ca-r1, the new one and three more.
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, created_at)
select 'ca-o' || g, pg_temp.a('f1'), 'Older request ' || g, 'ca-category', 'ca-campus', 'An older request of Zola''s.', now() - interval '2 days'
from generate_series(1, 3) g;
select pg_temp.issue('f1', 'c2');
select pg_temp.sign_in('f1');
select is(pg_temp.request(null, 'Need a sixth thing', pg_temp.t('c2')) ->> 'result', 'open-limit', 'a sixth open request is refused');
select is(public.set_request_open('ca-r1', true), 'nothing', 'reopening an open request does nothing');
select is(public.set_request_open('ca-r1', false), 'closed', 'Zola closes ca-r1');
select pg_temp.sign_out();
select is(pg_temp.taken('f1', 'c2'), false, 'a refused post keeps its token');
select is(
  (select row(status, closed_at = now(), updated_at = now())::text from public.requests where id = 'ca-r1'),
  row('closed', true, true)::text,
  'closed now'
);

-- Five made in any 24 hours (REQUESTS_PER_DAY), closed ones counted: the new one and four more.
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, status, created_at, closed_at)
select 'ca-d' || g, pg_temp.a('f1'), 'Recent request ' || g, 'ca-category', 'ca-campus', 'A recent request of Zola''s.', 'closed',
  now() - interval '23 hours 59 minutes' + g * interval '1 hour', now()
from generate_series(1, 4) g;
select pg_temp.sign_in('f1');
select is(pg_temp.request(null, 'Need a sixth thing', pg_temp.t('c2')) ->> 'result', 'daily-limit', 'a sixth in 24 hours is refused');
select pg_temp.sign_out();
update public.requests set created_at = now() - interval '24 hours' where id = 'ca-d1';
select pg_temp.sign_in('f1');
select is(pg_temp.request(null, 'Need a sixth thing', pg_temp.t('c2')) ->> 'result', 'posted', 'one made exactly 24 hours ago is out of the window');
select pg_temp.sign_out();
select pg_temp.issue('f1', 'c3');
select pg_temp.sign_in('f1');
select is(pg_temp.request(null, 'Need a seventh thing', pg_temp.t('c3')) ->> 'result', 'open-limit', 'five open again');
select is(public.set_request_open('ca-o1', false), 'closed', 'Zola closes one');
select is(pg_temp.request(null, 'Need a seventh thing', pg_temp.t('c3')) ->> 'result', 'daily-limit', 'and meets the day''s five');
select is(public.delete_request('ca-d2'), 'deleted', 'she deletes one made today');
select is(pg_temp.request(null, 'Need a seventh thing', pg_temp.t('c3')) ->> 'result', 'posted', 'a deleted request isn''t counted');
select is(pg_temp.locked('vossie:requests:' || pg_temp.a('f1')), true, 'the counts were taken under the asker''s lock');

-- Close and Reopen (spec 2.6): reopening counts towards the five.
select is(public.set_request_open('ca-r1', true), 'reopen-limit', 'with five open, ca-r1 can''t be reopened');
select is(public.set_request_open('ca-o2', false), 'closed', 'she closes another');
select is(public.set_request_open('ca-o2', false), 'nothing', 'twice is nothing');
select is(public.set_request_open('ca-r1', true), 'reopened', 'and reopens ca-r1');
select is(public.set_request_open('ca-hidden', false), 'nothing', 'a hidden request can''t be closed');
select pg_temp.sign_out();
select is(
  (select row(status, closed_at)::text from public.requests where id = 'ca-r1'),
  row('open', null::timestamptz)::text,
  'ca-r1 is open again'
);
select pg_temp.sign_in('f6');
select is(public.set_request_open('ca-r1', false), 'nothing', 'Thandi can''t close Zola''s');
select is(public.delete_request('ca-r1'), 'nothing', 'or delete it');
select pg_temp.sign_out();
select is(
  (select count(*) from public.requests where asker_id = pg_temp.a('f1') and status = 'open' and hidden_at is null),
  5::bigint,
  'Zola has five open'
);

-- --- Offers (sendOffer, lib/looking-for/actions.ts; offerStatus, subjects.ts; startOffer, messages.ts) ----------------

select pg_temp.clear();
select pg_temp.sign_in('f1');
select is(public.start_offer('ca-r1', null, 'Hi') ->> 'result', 'own', 'Zola can''t offer on her own request');
select pg_temp.sign_out();
select pg_temp.sign_in('f2');
select is(public.start_offer('ca-r-lerato', null, 'Hi') ->> 'result', 'own', 'nor Lerato on hers, with her own shop');
select is(public.start_offer('ca-closed', null, 'Hi') ->> 'result', 'closed', 'a closed request takes no offers');
select is(public.start_offer('ca-hidden', null, 'Hi') ->> 'result', 'not-found', 'a hidden one has no page');
select is(public.start_offer('ca-nope', null, 'Hi') ->> 'result', 'not-found', 'nor one that isn''t there');
select is(public.start_offer('ca-sample', null, 'Hi') ->> 'result', 'sample', 'a sample has no one to answer');
select is(public.start_offer('ca-r1', 'ca-l-sipho', 'Hi') ->> 'result', 'listing-invalid', 'an offer points only at the shop''s own listings');
select is(public.start_offer('ca-r1', 'ca-l-draft', 'Hi') ->> 'result', 'listing-invalid', 'listed ones');
select throws_ok($$select public.start_offer('ca-r1', null, '   ')$$, '23514', null, 'an offer is not empty');
select throws_ok(format($$select public.start_offer('ca-r1', null, %L)$$, repeat('a', 1001)), '23514', null, 'and at most 1,000 characters');
select pg_temp.sign_out();
select pg_temp.sign_in('f6');
select is(public.start_offer('ca-r1', null, 'Hi') ->> 'result', 'no-shop', 'only shops offer');
select pg_temp.sign_out();
select pg_temp.sign_in('f4');
select is(public.start_offer('ca-r1', null, 'Hi') ->> 'result', 'pending', 'not one waiting for approval');
select pg_temp.sign_out();
select pg_temp.sign_in('f5');
select is(public.start_offer('ca-r1', null, 'Hi') ->> 'result', 'paused', 'nor one its seller paused');
select pg_temp.sign_out();
select pg_temp.sign_in('f8');
select is(public.start_offer('ca-r1', null, 'Hi') ->> 'result', 'paused', 'nor one the Hub paused');
select pg_temp.sign_out();
select is((select count(*) from public.conversations where is_offer), 0::bigint, 'no offer was made');
select is(pg_temp.notes(), '{}'::text[], 'and nobody was told');

select pg_temp.sign_in('f2');
insert into ids select 'offer', public.start_offer('ca-r1', 'ca-l-lamp', 'I have one, R120.') ->> 'conversation_id';
select pg_temp.sign_out();
select is(
  (select row(is_offer, status, request_id, request_title, listing_id, listing_title, shop_id, buyer_id, seller_gone,
     created_at = now(), last_message_at = now(), first_reply_at)::text
   from public.conversations where id = pg_temp.id('offer')::uuid),
  row(true, 'offered', 'ca-r1', 'Need a desk lamp', 'ca-l-lamp', 'Old lamp', pg_temp.s('f2'), pg_temp.a('f1'), false,
    true, true, null::timestamptz)::text,
  'Lerato''s offer: Offered, about the request and her lamp, with Zola on the buyer''s side'
);
select is(
  array(select side || ': ' || body from public.messages where conversation_id = pg_temp.id('offer')::uuid),
  array['seller: I have one, R120.'],
  'holding the shop''s message'
);
select is(
  pg_temp.notes(),
  array['Zola | offer | ' || pg_temp.id('offer') || ' | Lerato crafts offered to help with Need a desk lamp | /messages/'
    || pg_temp.id('offer') || ' | - | new'],
  'Zola is told'
);
select pg_temp.sign_in('f2');
select is(
  public.start_offer('ca-r1', null, 'Me again.'),
  jsonb_build_object('result', 'already', 'conversation_id', pg_temp.id('offer')::uuid),
  'a second offer on the same request finds the first'
);
select is(pg_temp.locked('vossie:offers:' || pg_temp.s('f2')), true, 'offers were counted under the shop''s lock');
select pg_temp.sign_out();
update public.seller_profiles set status = 'paused', paused_by = 'seller' where account_id = pg_temp.a('f2');
select pg_temp.sign_in('f2');
select is(public.start_offer('ca-r1', null, 'Me again.') ->> 'result', 'already', 'paused since, the shop still finds its offer (amendment 19.7)');
select pg_temp.sign_out();
update public.seller_profiles set status = 'approved', paused_by = null where account_id = pg_temp.a('f2');
select is((select count(*) from public.messages where conversation_id = pg_temp.id('offer')::uuid), 1::bigint, 'and nothing was added');
select pg_temp.sign_in('f1');
select is(public.request_offer_count('ca-r1'), 1, 'the request has one offer');
select pg_temp.sign_out();

-- The shop waits for the asker (spec 2.9), whose reply makes it Replied (spec 2.12).
select pg_temp.clear();
select pg_temp.sign_in('f2');
select is(public.send_message(pg_temp.id('offer')::uuid, 'Still keen?'), 'waiting', 'Lerato can''t write again before Zola replies');
select pg_temp.sign_out();
select is((select count(*) from public.messages where conversation_id = pg_temp.id('offer')::uuid), 1::bigint, 'nothing was added');
select pg_temp.sign_in('f1');
select is(pg_temp.request('ca-r1', 'Need a desk lamp, LED', null) ->> 'result', 'saved', 'Zola renames her request');
select is(public.send_message(pg_temp.id('offer')::uuid, 'Yes please!'), 'sent', 'and replies to the offer');
select pg_temp.sign_out();
select is(
  (select row(status, first_reply_at, last_message_at = now())::text from public.conversations where id = pg_temp.id('offer')::uuid),
  row('replied', null::timestamptz, true)::text,
  'the offer is Replied now; the shop hasn''t replied to anything'
);
select is(
  pg_temp.notes(),
  array['Lerato | message | ' || pg_temp.id('offer') || ' | Zola replied about Need a desk lamp, LED | /messages/'
    || pg_temp.id('offer') || ' | - | new'],
  'Lerato hears it, named by the request as it is titled now'
);
select pg_temp.clear();
select pg_temp.sign_in('f2');
select is(public.send_message(pg_temp.id('offer')::uuid, 'Great, see you at the library.'), 'sent', 'now Lerato can write');
select pg_temp.sign_out();
select is(
  (select row(status, first_reply_at = now())::text from public.conversations where id = pg_temp.id('offer')::uuid),
  row('replied', true)::text,
  'still Replied, her first reply''s time kept'
);
select is(
  pg_temp.notes(),
  array['Zola | message | ' || pg_temp.id('offer') || ' | Lerato crafts replied about Need a desk lamp, LED | /messages/'
    || pg_temp.id('offer') || ' | - | new'],
  'and Zola hears it'
);
select pg_temp.clear();
select pg_temp.sign_in('f2');
select is(public.mark_completed(pg_temp.id('offer')::uuid), 'done', 'Lerato marks the sale done');
select pg_temp.sign_out();
select is(
  pg_temp.notes(),
  array['Zola | sale-to-confirm | ' || pg_temp.id('offer') || ' | Lerato crafts marked Need a desk lamp, LED as done. Did the sale happen? | /messages/'
    || pg_temp.id('offer') || ' | - | new'],
  'Zola is asked to confirm, about the request'
);

-- At most 20 offers a shop in any 24 hours (OFFERS_PER_DAY): 19 recent ones, one exactly 24 hours old, one gone.
insert into public.conversations (shop_id, buyer_id, status, is_offer, request_title, created_at)
select pg_temp.s('f3'), pg_temp.a('f7'), 'offered', true, 'Old request ' || g, now() - interval '23 hours 59 minutes' + g * interval '1 hour'
from generate_series(1, 19) g;
insert into public.conversations (shop_id, buyer_id, status, is_offer, request_title, created_at) values
  (pg_temp.s('f3'), pg_temp.a('f7'), 'offered', true, 'Oldest request', now() - interval '24 hours');
insert into public.conversations (shop_id, buyer_id, status, is_offer, request_title, seller_gone, created_at) values
  (pg_temp.s('f3'), pg_temp.a('f7'), 'offered', true, 'A gone shop''s', true, now());
select pg_temp.sign_in('f3');
select is(public.start_offer('ca-r1', null, 'Mine is cheaper.') ->> 'result', 'offered', 'Sipho''s 20th offer today is made');
select is(public.start_offer('ca-r2', null, 'Staplers too.') ->> 'result', 'offer-rate', 'the 21st is refused');
select pg_temp.sign_out();
select is((select count(*) from public.conversations where request_id = 'ca-r2'), 0::bigint, 'and makes nothing');

-- --- Follows (addFollow and removeFollow, lib/data/follows.ts) -------------------------------------------------------

select pg_temp.sign_in('f6');
select is(public.follow_shop(pg_temp.s('f2')), 'followed', 'Thandi follows Lerato crafts');
select is(public.follow_shop(pg_temp.s('f2')), 'already', 'once');
select is(public.follow_shop(pg_temp.s('f5')), 'followed', 'a shop its seller paused keeps its storefront');
select is(public.follow_shop(pg_temp.s('a1')), 'followed', 'so does a sample stall');
select is(public.follow_shop(pg_temp.s('f4')), 'not-found', 'a shop waiting for approval has none');
select is(public.follow_shop(pg_temp.s('f8')), 'not-found', 'nor a shop the Hub paused');
select is(public.follow_shop(gen_random_uuid()), 'not-found', 'nor a shop that isn''t there');
select is(pg_temp.locked('vossie:follows:' || pg_temp.a('f6')), true, 'follows are counted under the account''s lock');
select is(public.unfollow_shop(pg_temp.s('a1')), 'unfollowed', 'she unfollows the stall');
select is(public.unfollow_shop(pg_temp.s('a1')), 'nothing', 'twice is nothing');
select pg_temp.sign_out();
select pg_temp.sign_in('f2');
select is(public.follow_shop(pg_temp.s('f2')), 'own', 'Lerato can''t follow her own shop');
select pg_temp.sign_out();
select is(
  (select array_agg(s.slug order by s.slug) from public.follows f join public.shops s on s.id = f.shop_id where f.account_id = pg_temp.a('f6')),
  array['ca-kabelo', 'ca-lerato'],
  'Thandi follows two'
);
-- At most 200 (FOLLOW_LIMIT).
insert into public.follows (account_id, shop_id) select pg_temp.a('f7'), s.id from public.shops s where s.slug like 'ca-g-%';
select pg_temp.sign_in('f7');
select is(public.follow_shop(pg_temp.s('f2')), 'followed', 'Bongi''s 200th follow is made');
select is(public.follow_shop(pg_temp.s('f3')), 'limit', 'the 201st is refused');
select pg_temp.sign_out();
select is((select count(*) from public.follows where account_id = pg_temp.a('f7')), 200::bigint, 'she follows 200');

-- --- Saved searches (addSavedSearch, setSavedSearchPaused, deleteSavedSearch, lib/data/saved-searches.ts) -------------

select pg_temp.sign_in('f6');
select is(public.save_search('lamp', null, null, null, null, null, 'q=lamp'), 'saved', 'Thandi saves a search');
select is(public.save_search('lamp', null, null, null, null, null, 'q=lamp'), 'already', 'the same search twice is already saved');
select throws_ok($$select public.save_search(null, null, 'ca-campus', null, null, null, 'campus=ca-campus')$$, '23514', null, 'a campus alone isn''t worth saving');
select is(pg_temp.locked('vossie:saved-searches:' || pg_temp.a('f6')), true, 'searches are counted under the account''s lock');
select pg_temp.sign_out();
select is(
  (select row(account_id, q, category, campus_slug, price, pay, deals, search_key, created_at = now(), paused_at)::text
   from public.saved_searches where account_id = pg_temp.a('f6')),
  row(pg_temp.a('f6'), 'lamp', null::text, null::text, null::text, null::text, null::text, 'q=lamp', true, null::timestamptz)::text,
  'with its words, every campus, and alerts on'
);
-- At most 20 (SAVED_SEARCH_LIMIT).
insert into public.saved_searches (account_id, q, search_key) select pg_temp.a('f6'), 'thing ' || g, 'q=thing-' || g from generate_series(1, 18) g;
select pg_temp.sign_in('f6');
select is(public.save_search(null, 'ca-category', null, 'free', null, null, 'category=ca-category&price=free'), 'saved', 'her 20th is saved');
select is(public.save_search('desk', null, null, null, null, null, 'q=desk'), 'limit', 'the 21st is refused');
select is(public.save_search('lamp', null, null, null, null, null, 'q=lamp'), 'already', 'a repeat still says it''s saved');
select pg_temp.sign_out();
insert into ids select 'ss-lamp', id from public.saved_searches where account_id = pg_temp.a('f6') and search_key = 'q=lamp';
update public.saved_searches set paused_at = now() - interval '1 day' where id = pg_temp.id('ss-lamp');
select pg_temp.sign_in('f6');
select is(public.set_search_paused(pg_temp.id('ss-lamp'), true), 'paused', 'pausing a paused search');
select pg_temp.sign_out();
select is((select paused_at = now() - interval '1 day' from public.saved_searches where id = pg_temp.id('ss-lamp')), true, 'keeps the first time');
select pg_temp.sign_in('f6');
select is(public.set_search_paused(pg_temp.id('ss-lamp'), false), 'resumed', 'resuming');
select pg_temp.sign_out();
select is((select paused_at from public.saved_searches where id = pg_temp.id('ss-lamp')), null::timestamptz, 'clears it');
select pg_temp.sign_in('f6');
select is(public.set_search_paused(pg_temp.id('ss-lamp'), true), 'paused', 'pausing again');
select pg_temp.sign_out();
select is((select paused_at = now() from public.saved_searches where id = pg_temp.id('ss-lamp')), true, 'starts now');
select pg_temp.sign_in('f1');
select is(public.set_search_paused(pg_temp.id('ss-lamp'), false), 'not-found', 'Zola can''t touch Thandi''s search');
select is(public.delete_search(pg_temp.id('ss-lamp')), 'not-found', 'or delete it');
select pg_temp.sign_out();
-- Deleting one takes its search-match notifications with it, and no others.
select pg_temp.clear();
insert into public.notifications (account_id, kind, subject_id, text, href) values
  (pg_temp.a('f6'), 'search-match', pg_temp.id('ss-lamp'), 'Desk lamp matches your search lamp', '/listings/ca-l-lamp'),
  (pg_temp.a('f6'), 'search-match', 'ss-other', 'Poster matches your search posters', '/listings/ca-l-sipho'),
  (pg_temp.a('f6'), 'message', pg_temp.id('ss-lamp'), 'Not about the search', '/messages/x');
select pg_temp.sign_in('f6');
select is(public.delete_search(pg_temp.id('ss-lamp')), 'deleted', 'Thandi deletes her lamp search');
select is(public.delete_search(pg_temp.id('ss-lamp')), 'not-found', 'twice is not found');
select pg_temp.sign_out();
select is(
  pg_temp.notes(),
  array[
    'Thandi | message | ' || pg_temp.id('ss-lamp') || ' | Not about the search | /messages/x | - | new',
    'Thandi | search-match | ss-other | Poster matches your search posters | /listings/ca-l-sipho | - | new'
  ],
  'its notification goes with it'
);
select is((select count(*) from public.saved_searches where account_id = pg_temp.a('f6')), 19::bigint, 'she has 19 searches');

-- --- A first publish tells the shop's followers (saveListingForm, listing-actions.ts:242; notifyNewListing) ----------

-- Followers of Lerato crafts: Thandi and Bongi, and Lerato herself (a row the app could never make: she isn't told).
insert into public.follows (account_id, shop_id) values (pg_temp.a('f2'), pg_temp.s('f2'));
select pg_temp.clear();
select pg_temp.sign_in('f2');
insert into ids select 'L1', pg_temp.save(null, 'Desk lamp', true) ->> 'listing_id';
select pg_temp.sign_out();
select is(
  pg_temp.notes(),
  array[
    'Bongi | new-listing | ca-lerato | Lerato crafts listed Desk lamp | /listings/' || pg_temp.id('L1') || ' | - | new',
    'Thandi | new-listing | ca-lerato | Lerato crafts listed Desk lamp | /listings/' || pg_temp.id('L1') || ' | - | new'
  ],
  'a new listing tells each follower, naming it, and not its owner'
);
update public.notifications set created_at = now() - interval '1 second' where kind = 'new-listing' and subject_id = 'ca-lerato';
select pg_temp.sign_in('f2');
insert into ids select 'L2', pg_temp.save(null, 'Reading lamp', true) ->> 'listing_id';
select pg_temp.sign_out();
select is(
  pg_temp.notes(),
  array[
    'Bongi | new-listing | ca-lerato | Lerato crafts listed 2 new things | /sellers/ca-lerato | 2 | new',
    'Thandi | new-listing | ca-lerato | Lerato crafts listed 2 new things | /sellers/ca-lerato | 2 | new'
  ],
  'a second the same day counts up while unread, linking to the shop'
);
select is(
  (select bool_and(created_at = now()) from public.notifications where kind = 'new-listing' and subject_id = 'ca-lerato'),
  true,
  'and moves to the top'
);
select pg_temp.sign_in('f6');
select is(public.mark_notifications_read(), 1, 'Thandi reads hers');
select pg_temp.sign_out();
select pg_temp.sign_in('f2');
insert into ids select 'L3', pg_temp.save(null, 'Lamp shade', true) ->> 'listing_id';
select pg_temp.sign_out();
select is(
  pg_temp.notes(),
  array[
    'Bongi | new-listing | ca-lerato | Lerato crafts listed 3 new things | /sellers/ca-lerato | 3 | new',
    'Thandi | new-listing | ca-lerato | Lerato crafts listed 2 new things | /sellers/ca-lerato | 2 | read'
  ],
  'once read, a new-listing stays read that day; Bongi''s counts on'
);
truncate snap;
insert into snap select pg_temp.notes();
-- Edits, drafts, relists and a second publish tell nobody.
select pg_temp.sign_in('f2');
insert into ids select 'D1', pg_temp.save(null, 'Lamp base', false) ->> 'listing_id';
select is(pg_temp.save(pg_temp.id('L1'), 'Desk lamp, white', true) ->> 'first_publish', 'false', 'an edit isn''t a first publish');
select is(public.set_listing_state(pg_temp.id('L1'), 'paused'), 'moved', 'Lerato pauses it');
select is(public.set_listing_state(pg_temp.id('L1'), 'available'), 'moved', 'and lists it again');
select is(pg_temp.save(pg_temp.id('L2'), 'Reading lamp', false) ->> 'state', 'draft', 'she saves another back to draft');
select is(pg_temp.save(pg_temp.id('L2'), 'Reading lamp', true) ->> 'first_publish', 'false', 'and publishes it again');
select pg_temp.sign_out();
select is(pg_temp.notes(), (select v from snap), 'none of that told anyone');
-- A hidden draft published (the Hub hid it) tells nobody.
update public.listings set hidden_at = now(), hidden_reason = 'Copies.' where id = 'ca-l-draft';
select pg_temp.sign_in('f2');
select is(pg_temp.save('ca-l-draft', 'Draft lamp', true) ->> 'first_publish', 'true', 'a hidden draft''s publish is a first publish');
select pg_temp.sign_out();
select is(pg_temp.notes(), (select v from snap), 'but tells nobody');
-- A paused shop's or a waiting shop's publish tells nobody.
insert into public.follows (account_id, shop_id) values (pg_temp.a('f6'), pg_temp.s('f4'));
select pg_temp.sign_in('f5');
select is(pg_temp.save(null, 'Sneakers', true) ->> 'first_publish', 'true', 'Kabelo publishes in his paused shop');
select pg_temp.sign_out();
select pg_temp.sign_in('f4');
select is(pg_temp.save(null, 'Bread', true) ->> 'state', 'draft', 'Naledi''s waiting shop saves a draft');
select pg_temp.sign_out();
select is(pg_temp.notes(), (select v from snap), 'neither tells a follower');
-- The draft published for the first time does.
select pg_temp.sign_in('f2');
select is(pg_temp.save(pg_temp.id('D1'), 'Lamp base', true) ->> 'first_publish', 'true', 'Lerato publishes her draft');
select pg_temp.sign_out();
select is(
  pg_temp.notes(),
  array[
    'Bongi | new-listing | ca-lerato | Lerato crafts listed 4 new things | /sellers/ca-lerato | 4 | new',
    'Thandi | new-listing | ca-lerato | Lerato crafts listed 2 new things | /sellers/ca-lerato | 2 | read'
  ],
  'and Bongi''s count goes up'
);

-- --- Saved searches' matches (record_search_matches; notifySavedSearches, saved-searches.ts) -------------------------

delete from public.saved_searches where account_id = pg_temp.a('f6');
insert into public.saved_searches (id, account_id, q, search_key, created_at, paused_at) values
  ('ca-ss-t-old', pg_temp.a('f6'), 'lamp', 'q=lamp', now() - interval '2 days', null),
  ('ca-ss-t-new', pg_temp.a('f6'), 'desk', 'q=desk', now() - interval '1 day', null),
  ('ca-ss-b', pg_temp.a('f7'), 'lamp', 'q=lamp', now() - interval '3 days', now() - interval '1 day'),
  ('ca-ss-z', pg_temp.a('f1'), 'lamp', 'q=lamp', now() - interval '1 day', null),
  ('ca-ss-l', pg_temp.a('f2'), 'lamp', 'q=lamp', now() - interval '3 days', null);
create function pg_temp.match(listing text) returns int language sql as $f$
  select public.record_search_matches(
    listing, array['ca-ss-t-new', 'ca-ss-t-old', 'ca-ss-b', 'ca-ss-z', 'ca-ss-l'],
    jsonb_build_object(
      'ca-ss-t-old', jsonb_build_object('label', 'lamp', 'href', '/browse?q=lamp&sort=new'),
      'ca-ss-t-new', jsonb_build_object('label', 'desk', 'href', '/browse?q=desk&sort=new'),
      'ca-ss-b', jsonb_build_object('label', 'lamp', 'href', '/browse?q=lamp&sort=new'),
      'ca-ss-z', jsonb_build_object('label', 'lamp', 'href', '/browse?q=lamp&sort=new'),
      'ca-ss-l', jsonb_build_object('label', 'lamp', 'href', '/browse?q=lamp&sort=new')
    )
  );
$f$;
set local role service_role;
select is(pg_temp.match(pg_temp.id('L1')), 2, 'a first-published listing tells two accounts');
reset role;
select is(
  pg_temp.notes(),
  array[
    'Bongi | new-listing | ca-lerato | Lerato crafts listed 4 new things | /sellers/ca-lerato | 4 | new',
    'Thandi | new-listing | ca-lerato | Lerato crafts listed 2 new things | /sellers/ca-lerato | 2 | read',
    'Thandi | search-match | ca-ss-t-old | Desk lamp, white matches your search lamp | /listings/' || pg_temp.id('L1') || ' | - | new',
    'Zola | search-match | ca-ss-z | Desk lamp, white matches your search lamp | /listings/' || pg_temp.id('L1') || ' | - | new'
  ],
  'Thandi once, under her oldest search; not the paused one, nor the shop''s owner'
);
update public.notifications set created_at = now() - interval '1 second' where kind = 'search-match';
set local role service_role;
select is(pg_temp.match(pg_temp.id('L3')), 2, 'another match');
reset role;
select is(
  pg_temp.notes(),
  array[
    'Bongi | new-listing | ca-lerato | Lerato crafts listed 4 new things | /sellers/ca-lerato | 4 | new',
    'Thandi | new-listing | ca-lerato | Lerato crafts listed 2 new things | /sellers/ca-lerato | 2 | read',
    'Thandi | search-match | ca-ss-t-old | 2 new listings match your search lamp | /browse?q=lamp&sort=new | 2 | new',
    'Zola | search-match | ca-ss-z | 2 new listings match your search lamp | /browse?q=lamp&sort=new | 2 | new'
  ],
  'counts up while unread, linking to the results'
);
select is((select bool_and(created_at = now()) from public.notifications where kind = 'search-match'), true, 'and moves to the top');
select pg_temp.sign_in('f6');
select is(public.mark_notifications_read(), 1, 'Thandi reads hers');
select pg_temp.sign_out();
set local role service_role;
select is(pg_temp.match(pg_temp.id('D1')), 2, 'a third match');
reset role;
select is(
  pg_temp.notes(),
  array[
    'Bongi | new-listing | ca-lerato | Lerato crafts listed 4 new things | /sellers/ca-lerato | 4 | new',
    'Thandi | new-listing | ca-lerato | Lerato crafts listed 2 new things | /sellers/ca-lerato | 2 | read',
    'Thandi | search-match | ca-ss-t-old | Lamp base matches your search lamp | /listings/' || pg_temp.id('D1') || ' | 1 | new',
    'Zola | search-match | ca-ss-z | 3 new listings match your search lamp | /browse?q=lamp&sort=new | 3 | new'
  ],
  'a read search-match comes back unread at one, naming the listing'
);
truncate snap;
insert into snap select pg_temp.notes();
set local role service_role;
select is(pg_temp.match('ca-l-draft'), 0, 'a hidden listing tells nobody');
select is(pg_temp.match(pg_temp.id('L2') || '-none'), 0, 'nor one that isn''t there');
reset role;
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('ca-l-never', pg_temp.s('f2'), 'draft', 'item', 'Never lamp', 'ca-category', 'good', 100, 'cash', 'A lamp.', 'online', 'ca-campus', null);
set local role service_role;
select is(pg_temp.match('ca-l-never'), 0, 'nor a draft');
select is(pg_temp.match((select id from public.listings where shop_id = pg_temp.s('f5'))), 0, 'nor a paused shop''s listing');
select throws_ok(
  format($$select public.record_search_matches(%L, array['ca-ss-z'], '{}'::jsonb)$$, pg_temp.id('L1')),
  '22023', null, 'a matching search needs its label and link'
);
reset role;
select is(pg_temp.notes(), (select v from snap), 'none of those told anyone');

-- --- Deleting a listing takes the alerts that lead to it (deleteOwnListing, own-listings.ts:106) ----------------------

insert into public.notifications (account_id, kind, subject_id, text, href) values
  (pg_temp.a('f1'), 'new-listing', 'ca-lerato', 'Lerato crafts listed Lamp base', '/listings/' || pg_temp.id('D1')),
  (pg_temp.a('f1'), 'message', 'x', 'Not about the listing', '/listings/' || pg_temp.id('D1'));
select pg_temp.sign_in('f2');
select is(public.delete_listing(pg_temp.id('D1')) ->> 'result', 'deleted', 'Lerato deletes the lamp base');
select pg_temp.sign_out();
select is(
  pg_temp.notes(),
  array[
    'Bongi | new-listing | ca-lerato | Lerato crafts listed 4 new things | /sellers/ca-lerato | 4 | new',
    'Thandi | new-listing | ca-lerato | Lerato crafts listed 2 new things | /sellers/ca-lerato | 2 | read',
    'Zola | message | x | Not about the listing | /listings/' || pg_temp.id('D1') || ' | - | new',
    'Zola | search-match | ca-ss-z | 3 new listings match your search lamp | /browse?q=lamp&sort=new | 3 | new'
  ],
  'its new-listing and search-match notifications go; those that lead to the shop or the results stay'
);

-- --- A change of link moves new-listing notifications (moveShop, shops.ts:96) ---------------------------------------

insert into public.notifications (account_id, kind, subject_id, text, href, created_at) values
  (pg_temp.a('f1'), 'new-listing', 'ca-lerato', 'Lerato crafts listed Desk lamp', '/listings/' || pg_temp.id('L1'), now() - interval '2 days'),
  (pg_temp.a('f7'), 'new-listing', 'ca-sipho', 'Sipho prints listed 2 new things', '/sellers/ca-sipho', now()),
  (pg_temp.a('f6'), 'new-listing', 'ca-lerato-two', 'Gone shop listed 2 new things', '/sellers/ca-lerato-two', now());
select pg_temp.sign_in('f2');
select is(public.change_shop_slug('ca-lerato-two'), 'changed', 'Lerato changes her link');
select pg_temp.sign_out();
select is(
  pg_temp.notes(),
  array[
    'Bongi | new-listing | ca-lerato-two | Lerato crafts listed 4 new things | /sellers/ca-lerato-two | 4 | new',
    'Bongi | new-listing | ca-sipho | Sipho prints listed 2 new things | /sellers/ca-sipho | - | new',
    'Thandi | new-listing | ca-lerato-two | Lerato crafts listed 2 new things | /sellers/ca-lerato-two | 2 | read',
    'Zola | message | x | Not about the listing | /listings/' || pg_temp.id('D1') || ' | - | new',
    'Zola | new-listing | ca-lerato-two | Lerato crafts listed Desk lamp | /listings/' || pg_temp.id('L1') || ' | - | new',
    'Zola | search-match | ca-ss-z | 3 new listings match your search lamp | /browse?q=lamp&sort=new | 3 | new'
  ],
  'her followers'' notifications follow the shop; a gone shop''s on the new link go; another shop''s stay'
);

-- --- Reports on requests (create_report; reportSubject, lib/messaging/subjects.ts) ------------------------------------

select pg_temp.sign_in('f6');
select is(public.create_report('request', 'ca-r1', 'A made-up title', 'spam', ''), 'created', 'Thandi reports Zola''s request');
select is(public.create_report('request', 'ca-closed', 'x', 'spam', ''), 'created', 'a closed request has a page, so it can be reported');
select is(public.create_report('request', 'ca-hidden', 'Need a phone', 'spam', ''), 'not-found', 'a hidden one can''t');
select is(public.create_report('request', 'ca-nope', 'Need a phone', 'spam', ''), 'not-found', 'nor one that isn''t there');
select pg_temp.sign_out();
select is(
  (select array_agg(target_id || ': ' || target_title order by target_id) from public.reports where reporter_id = pg_temp.a('f6')),
  array['ca-closed: Need a kettle', 'ca-r1: Need a desk lamp, LED'],
  'the titles come from the requests, not the caller'
);

-- --- Deleting a request (deleteRequest, requests.ts:168) ----------------------------------------------------------------

insert into public.notifications (account_id, kind, subject_id, text, href) values
  (pg_temp.a('f1'), 'request-update', 'ca-r1', 'The Hub is showing your request Need a desk lamp again.', '/account/requests'),
  (pg_temp.a('f1'), 'request-update', 'ca-closed', 'The Hub is showing your request Need a kettle again.', '/account/requests');
select pg_temp.sign_in('f1');
select is(public.delete_request('ca-r1'), 'deleted', 'Zola deletes ca-r1');
select is(public.delete_request('ca-r1'), 'nothing', 'twice is nothing');
select pg_temp.sign_out();
select is((select count(*) from public.requests where id = 'ca-r1'), 0::bigint, 'it''s gone');
select is(
  array(select subject_id from public.notifications where kind = 'request-update' and account_id = pg_temp.a('f1')),
  array['ca-closed'],
  'with its request-update notification, and no other'
);
select is(
  (select row(is_offer, request_id, request_title, status)::text from public.conversations where id = pg_temp.id('offer')::uuid),
  row(true, null::text, 'Need a desk lamp', 'done')::text,
  'its offer thread stays an offer, with the title it had'
);
select is(
  (select count(*) from public.conversations
   where is_offer and shop_id = pg_temp.s('f3') and request_id is null and request_title = 'Need a desk lamp, LED'),
  1::bigint,
  'and so does Sipho''s, made after the request was renamed'
);

-- --- Once a SAST day (notifyOncePerDay's sastDate) ------------------------------------------------------------------

-- Yesterday's notification ended at 23:59:59 in South Africa, whatever the server's time zone: today's publish makes a
-- new one.
update public.notifications
set created_at = (date_trunc('day', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg') - interval '1 second'
where kind = 'new-listing' and subject_id = 'ca-lerato-two';
select pg_temp.sign_in('f2');
insert into ids select 'L5', pg_temp.save(null, 'Floor lamp', true) ->> 'listing_id';
select pg_temp.sign_out();
select is(
  array(
    select p.first_name || ' | ' || coalesce(n.count::text, '-') || ' | ' || n.text
    from public.notifications n join public.profiles p on p.id = n.account_id
    where n.kind = 'new-listing' and n.subject_id = 'ca-lerato-two' and n.created_at = now()
    order by p.first_name
  ),
  array['Bongi | - | Lerato crafts listed Floor lamp', 'Thandi | - | Lerato crafts listed Floor lamp'],
  'a new SAST day starts a new notification for each follower'
);
select is(
  (select count(*) from public.notifications where kind = 'new-listing' and subject_id = 'ca-lerato-two' and created_at < now()),
  3::bigint,
  'and yesterday''s stay as they were'
);
select is(
  (select prosrc like '%on conflict (request_id, shop_id) where is_offer and not seller_gone and request_id is not null do nothing%'
   from pg_proc where oid = 'public.start_offer(text, text, text)'::regprocedure),
  true,
  'start_offer''s ON CONFLICT repeats conversations_one_offer_per_shop''s predicate'
);

-- --- Security definer, empty search path, for every new and replaced function --------------------------------------

select is(
  array(
    select p.oid::regprocedure::text from pg_proc p
    where p.oid in (
      'public.save_request(text, text, text, text, text, integer, boolean, date, text)'::regprocedure,
      'public.set_request_open(text, boolean)'::regprocedure, 'public.delete_request(text)'::regprocedure,
      'public.start_offer(text, text, text)'::regprocedure, 'public.follow_shop(uuid)'::regprocedure,
      'public.unfollow_shop(uuid)'::regprocedure,
      'public.save_search(text, text, text, text, text, text, text)'::regprocedure,
      'public.set_search_paused(text, boolean)'::regprocedure, 'public.delete_search(text)'::regprocedure,
      'public.record_search_matches(text, text[], jsonb)'::regprocedure
    )
      and not (p.prosecdef and p.proconfig @> array['search_path=""'])
  ),
  '{}'::text[],
  'each is security definer with an empty search path'
);

select * from finish();
rollback;
