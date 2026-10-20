-- Schema catch-up, Task 3: the community tables (Looking For requests, follows, saved searches) and offers on
-- conversations (supabase schema catch-up plan; lib/looking-for/rules.ts, lib/data/requests.ts, lib/data/offers.ts,
-- lib/data/follows.ts, lib/following/rules.ts, lib/saved-searches/rules.ts, lib/data/saved-searches.ts,
-- lib/data/messages.ts, lib/data/shop-stats.ts, lib/data/rows.ts, lib/types.ts).
begin;
select plan(124);

create function pg_temp.sign_in(account uuid) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', account, 'role', 'authenticated', 'session_id', '50000000-0000-4000-8000-0000000000f1')::text,
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
-- Account, shop and conversation ids, by their last two characters.
create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.c(n text) returns uuid language sql immutable as $f$
  select ('40000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
grant execute on function pg_temp.a(text), pg_temp.s(text), pg_temp.c(text) to public;
-- What start_conversation gave back, for the checks after it.
create temp table results (k text primary key, v jsonb);
grant all on results to public;
create function pg_temp.conv(k text) returns uuid language sql as $f$
  select (v ->> 'conversation_id')::uuid from results where results.k = conv.k;
$f$;
grant execute on function pg_temp.conv(text) to public;

insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);

-- People:
-- f1 Ayanda, who asks;                   f2 Sipho, owns an approved shop (s f2);
-- f3 Naledi, who asks too;               f4 Adam, an admin;
-- f5 Lerato, owns an approved shop (s f5); f6 Mona, a mentor;
-- f7 Kabelo, owns an approved shop (s f7) that Mona mentors.
insert into auth.users (id, email)
select pg_temp.a(n), 'community' || n || '@eduvos.com'
from unnest(array['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('f1'), 'Ayanda', 'test-campus', '{}'),
  (pg_temp.a('f2'), 'Sipho', 'test-campus', '{}'),
  (pg_temp.a('f3'), 'Naledi', 'test-campus', '{}'),
  (pg_temp.a('f4'), 'Adam', 'test-campus', array['admin']),
  (pg_temp.a('f5'), 'Lerato', 'test-campus', '{}'),
  (pg_temp.a('f6'), 'Mona', 'test-campus', array['mentor']),
  (pg_temp.a('f7'), 'Kabelo', 'test-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
select pg_temp.s(n), 'comm-shop-' || n, pg_temp.a(n), 'Comm shop ' || n, 'test-category', 'test-campus', '2026-01'
from unnest(array['f2', 'f5', 'f7']) n;
insert into public.seller_profiles (account_id, status, shop_id, mentor_id) values
  (pg_temp.a('f2'), 'approved', pg_temp.s('f2'), null),
  (pg_temp.a('f5'), 'approved', pg_temp.s('f5'), null),
  (pg_temp.a('f7'), 'approved', pg_temp.s('f7'), pg_temp.a('f6'));
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at, hidden_at, hidden_reason) values
  ('cm-lamp', pg_temp.s('f2'), 'available', 'item', 'Lamp', 'test-category', 'good', 100, 'cash', 'A lamp.', 'online', 'test-campus', now(), null, null),
  ('cm-hidden-lamp', pg_temp.s('f2'), 'available', 'item', 'Fake lamp', 'test-category', 'good', 100, 'cash', 'A lamp.', 'online', 'test-campus', now(), now(), 'Counterfeit.');

-- --- The tables ------------------------------------------------------------------------------------------------------

select has_table('public', 'requests', 'Looking For requests have a table');
select has_table('public', 'follows', 'follows have a table');
select has_table('public', 'saved_searches', 'saved searches have a table');
select has_view('public', 'my_requests', 'the asker reads their own requests through a view');
select is(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.requests'::regclass, 'public.follows'::regclass, 'public.saved_searches'::regclass)),
  true,
  'every one has row level security on'
);
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.my_requests'::regclass),
  'my_requests runs as the reader (security_invoker), so it is not a security definer view'
);
select is(
  array(
    select t || ' ' || r || ' ' || p
    from unnest(array['public.requests', 'public.follows', 'public.saved_searches', 'public.my_requests']) t,
      unnest(array['anon', 'authenticated']) r,
      unnest(array['insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p
    where (p in ('delete', 'truncate', 'trigger') and has_table_privilege(r, t, p))
      or (p in ('insert', 'update', 'references') and has_any_column_privilege(r, t, p))
  ),
  '{}'::text[],
  'the API roles have no write on the community tables (Task 6''s functions write)'
);
select is(
  array(
    select t from unnest(array['public.follows', 'public.saved_searches', 'public.my_requests']) t
    where has_any_column_privilege('anon', t, 'select')
  ),
  '{}'::text[],
  'anon reads no follows, saved searches or anyone''s own requests'
);
select ok(
  has_column_privilege('anon', 'public.requests', 'title', 'select')
  and has_column_privilege('authenticated', 'public.requests', 'hidden_reason', 'select')
  and not has_column_privilege('anon', 'public.requests', 'asker_id', 'select')
  and not has_column_privilege('authenticated', 'public.requests', 'asker_id', 'select')
  and has_column_privilege('service_role', 'public.requests', 'asker_id', 'select'),
  'the asker is left out of the API roles'' column grant (community spec decision 2)'
);

-- --- requests (RequestRow, rows.ts:458; lib/looking-for/rules.ts:7-17) ----------------------------------------------

insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, budget_zar, swap_welcome, needed_by, status, created_at, closed_at, seed_offers, hidden_at, hidden_reason) values
  ('cm-sample', null, 'Graphic calculator to borrow', 'test-category', 'test-campus', 'My calculator stopped working before exams.', 100, true, '2026-10-26', 'closed', '2026-10-01T10:00:00Z', null, 2, null, null),
  ('cm-open', pg_temp.a('f1'), 'Accounting 1 tutor this week', 'test-category', 'test-campus', E'Stuck on adjustments.\nEvenings suit me best.', 300, false, null, 'open', '2026-10-15T10:00:00Z', null, 0, null, null),
  ('cm-closed', pg_temp.a('f1'), 'Bar fridge for my room', 'test-category', 'test-campus', 'A small bar fridge, second-hand is fine.', null, true, null, 'closed', '2026-10-10T10:00:00Z', '2026-10-12T10:00:00Z', 0, null, null),
  ('cm-hidden', pg_temp.a('f1'), 'Exam answers wanted', 'test-category', 'test-campus', 'Answers to the Statistics 1 exam paper.', 500, false, null, 'open', '2026-10-14T10:00:00Z', null, 0, '2026-10-16T10:00:00Z', 'Asks for exam answers.'),
  ('cm-other', pg_temp.a('f3'), 'Someone to fix my laptop hinge', 'test-category', 'test-campus', 'The left hinge cracked and the lid wobbles.', 400, false, '2026-11-01', 'open', '2026-10-16T10:00:00Z', null, 0, null, null);
select is(
  (select row(status, swap_welcome, seed_offers, hidden_at)::text from public.requests where id = 'cm-open'),
  row('open', false, 0, null::timestamptz)::text,
  'a request is open, with no seed offers and not hidden'
);
insert into public.requests (asker_id, title, category_slug, campus_slug, details) values
  (pg_temp.a('f3'), 'Short id request', 'test-category', 'test-campus', 'Checking the default values here.');
select is(
  (select row(char_length(id), status, swap_welcome, budget_zar, needed_by, closed_at)::text from public.requests where title = 'Short id request'),
  row(10, 'open', false, null::int, null::date, null::timestamptz)::text,
  'a new request gets a short id, open, no swap, no budget, no date by default'
);
delete from public.requests where title = 'Short id request';
select throws_ok(
  $$insert into public.requests (id, title, category_slug, campus_slug, details) values ('Bad_Id', 'Five!', 'test-category', 'test-campus', 'Twenty characters at least.')$$,
  '23514', null, 'an id is lower case words with hyphens, as reports name it'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details) values ('Four', 'test-category', 'test-campus', 'Twenty characters at least.')$$,
  '23514', null, 'a title has at least TITLE_MIN (5) characters'
);
select throws_ok(
  format($$insert into public.requests (title, category_slug, campus_slug, details) values (%L, 'test-category', 'test-campus', 'Twenty characters at least.')$$, repeat('a', 71)),
  '23514', null, 'and at most TITLE_MAX (70)'
);
select lives_ok(
  format($$insert into public.requests (id, title, category_slug, campus_slug, details) values ('cm-edge', %L, 'test-category', 'test-campus', %L)$$, repeat('é', 70), repeat('x', 600)),
  '70 characters of title and 600 of details are fine, counted as code points'
);
delete from public.requests where id = 'cm-edge';
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details) values (E'Two\nlines', 'test-category', 'test-campus', 'Twenty characters at least.')$$,
  '23514', null, 'a title is one clean line'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details) values ('A title', 'test-category', 'test-campus', 'Nineteen characters')$$,
  '23514', null, 'details have at least DETAILS_MIN (20) characters'
);
select throws_ok(
  format($$insert into public.requests (title, category_slug, campus_slug, details) values ('A title', 'test-category', 'test-campus', %L)$$, repeat('x', 601)),
  '23514', null, 'and at most DETAILS_MAX (600)'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details) values ('A title', 'test-category', 'test-campus', E'Twenty characters‮ at least.')$$,
  '23514', null, 'details are clean text'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details, budget_zar) values ('A title', 'test-category', 'test-campus', 'Twenty characters at least.', 0)$$,
  '23514', null, 'a budget is at least R1'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details, budget_zar) values ('A title', 'test-category', 'test-campus', 'Twenty characters at least.', 100001)$$,
  '23514', null, 'and at most BUDGET_MAX (R100,000)'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details, status) values ('A title', 'test-category', 'test-campus', 'Twenty characters at least.', 'hidden')$$,
  '23514', null, 'a status is open or closed; hidden is its own column'
);
select throws_ok(
  $$insert into public.requests (asker_id, title, category_slug, campus_slug, details, status) values ('00000000-0000-4000-8000-0000000000f1', 'A title', 'test-category', 'test-campus', 'Twenty characters at least.', 'closed')$$,
  '23514', null, 'an asker''s closed request has its closing time'
);
select throws_ok(
  $$insert into public.requests (asker_id, title, category_slug, campus_slug, details, closed_at) values ('00000000-0000-4000-8000-0000000000f1', 'A title', 'test-category', 'test-campus', 'Twenty characters at least.', now())$$,
  '23514', null, 'and an open one has none'
);
select is(
  (select row(status, closed_at)::text from public.requests where id = 'cm-sample'),
  row('closed', null::timestamptz)::text,
  'a closed sample keeps no closing time, as the fixtures (request-rows.ts:21)'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details, hidden_at) values ('A title', 'test-category', 'test-campus', 'Twenty characters at least.', now())$$,
  '23514', null, 'a hidden request has a reason'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details, hidden_reason) values ('A title', 'test-category', 'test-campus', 'Twenty characters at least.', 'Why')$$,
  '23514', null, 'and a reason only when hidden'
);
select throws_ok(
  format($$insert into public.requests (title, category_slug, campus_slug, details, hidden_at, hidden_reason) values ('A title', 'test-category', 'test-campus', 'Twenty characters at least.', now(), %L)$$, repeat('x', 501)),
  '23514', null, 'of at most REASON_MAX (500)'
);
select throws_ok(
  $$insert into public.requests (asker_id, title, category_slug, campus_slug, details, seed_offers) values ('00000000-0000-4000-8000-0000000000f1', 'A title', 'test-category', 'test-campus', 'Twenty characters at least.', 1)$$,
  '23514', null, 'only a sample keeps a seed offers number (rows.ts:479)'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details, seed_offers) values ('A title', 'test-category', 'test-campus', 'Twenty characters at least.', -1)$$,
  '23514', null, 'and it is never negative'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details) values ('A title', 'no-such-category', 'test-campus', 'Twenty characters at least.')$$,
  '23503', null, 'a request is in a known category'
);
select throws_ok(
  $$insert into public.requests (title, category_slug, campus_slug, details) values ('A title', 'test-category', 'no-such-campus', 'Twenty characters at least.')$$,
  '23503', null, 'at a known campus'
);

-- Who reads what. The board and request pages read requests the Hub hasn't hidden; nobody but the server reads who
-- asked; the asker reads their own in every state, with the Hub's reason, through my_requests.
set local role anon;
select is(
  (select array_agg(id order by id) from public.requests where id like 'cm-%'),
  array['cm-closed', 'cm-open', 'cm-other', 'cm-sample'],
  'anon reads every request the Hub has not hidden, open or closed (publicRequest, requests.ts:46)'
);
select throws_ok($$select asker_id from public.requests$$, '42501', null, 'but never who asked');
select throws_ok($$select * from public.requests$$, '42501', null, 'not even with *');
select throws_ok($$select id from public.my_requests$$, '42501', null, 'and has no requests of its own');
reset role;

select pg_temp.sign_in(pg_temp.a('f3'));
select is(
  (select array_agg(id order by id) from public.requests where id like 'cm-%'),
  array['cm-closed', 'cm-open', 'cm-other', 'cm-sample'],
  'a signed-in student reads the same requests'
);
select throws_ok($$select asker_id from public.requests$$, '42501', null, 'and not who asked, even their own');
select is(
  (select array_agg(row(id, state)::text) from public.my_requests),
  array[row('cm-other', 'open')::text],
  'my_requests lists only their own'
);
select pg_temp.sign_out();

select pg_temp.sign_in(pg_temp.a('f1'));
select is(
  (select row(hidden_at is not null, hidden_reason)::text from public.requests where id = 'cm-hidden'),
  row(true, 'Asks for exam answers.')::text,
  'the asker reads their hidden request and the Hub''s reason (private.is_my_request)'
);
select is(
  (select array_agg(row(id, state, hidden_reason)::text order by id) from public.my_requests),
  array[
    row('cm-closed', 'closed', null::text)::text,
    row('cm-hidden', 'hidden', 'Asks for exam answers.')::text,
    row('cm-open', 'open', null::text)::text
  ],
  'and every one of theirs in my_requests, open, closed and hidden (listOwnRequests, requests.ts:82)'
);
select throws_ok($$select asker_id from public.requests$$, '42501', null, 'they still cannot read the column: no API role needs it');
select throws_ok($$select private.is_my_request('cm-open')$$, '42501', null, 'nor call the helper by name');
select pg_temp.sign_out();

select pg_temp.sign_in(pg_temp.a('f4'));
select is(
  (select hidden_reason from public.requests where id = 'cm-hidden'),
  'Asks for exam answers.',
  'an admin reads a hidden request and its reason (Show again, /admin/hidden)'
);
select throws_ok($$select asker_id from public.requests$$, '42501', null, 'but not who asked');
select is((select count(*) from public.my_requests), 0::bigint, 'and has no requests of their own');
select pg_temp.sign_out();

select pg_temp.sign_in(pg_temp.a('f6'));
select is(
  (select count(*) from public.requests where id = 'cm-hidden'),
  0::bigint,
  'a mentor does not read hidden requests (only admins hide and show them)'
);
select pg_temp.sign_out();

-- --- Offers on conversations (community actions spec 2.7 to 2.13; messages.ts, offers.ts) ---------------------------

-- Sipho's shop offers on Ayanda's request, pointing at its lamp; Lerato's shop offers with no listing.
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, status, is_offer, request_id, request_title) values
  (pg_temp.c('f1'), 'cm-lamp', 'Lamp', pg_temp.s('f2'), pg_temp.a('f1'), 'offered', true, 'cm-open', 'Accounting 1 tutor this week'),
  (pg_temp.c('f2'), null, null, pg_temp.s('f5'), pg_temp.a('f1'), 'offered', true, 'cm-open', 'Accounting 1 tutor this week');
insert into public.messages (conversation_id, side, body) values
  (pg_temp.c('f1'), 'seller', 'I tutor Accounting 1, and this lamp helps late nights.'),
  (pg_temp.c('f2'), 'seller', 'I passed Accounting 1 with a distinction.');
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, status) values
  (pg_temp.c('f8'), 'cm-lamp', 'Lamp', pg_temp.s('f2'), pg_temp.a('f3'), 'asked');
select is(
  (select row(is_offer, request_id, request_title)::text from public.conversations where id = pg_temp.c('f8')),
  row(false, null::text, null::text)::text,
  'a conversation is not an offer unless it starts as one'
);
select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, status, is_offer, request_id, request_title) values ('10000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000f1', 'offered', true, 'cm-open', 'Accounting 1 tutor this week')$$,
  '23505', null, 'a shop makes one offer on a request (offerRow, offers.ts:21)'
);
select lives_ok(
  $$insert into public.conversations (id, shop_id, buyer_id, status, is_offer, request_id, request_title, seller_gone) values ('40000000-0000-4000-8000-0000000000f3', null, '00000000-0000-4000-8000-0000000000f1', 'replied', true, 'cm-open', 'Accounting 1 tutor this week', true)$$,
  'an offer from a shop that has gone does not hold its place'
);
select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, status) values ('10000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000f3', 'offered')$$,
  '23514', null, 'only an offer is Offered (messages.ts:245)'
);
select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, request_id) values ('10000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000f3', 'cm-other')$$,
  '23514', null, 'only an offer points at a request'
);
select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, status, is_offer, request_id) values ('10000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000f3', 'offered', true, 'cm-other')$$,
  '23514', null, 'an offer keeps its request''s title, for when the request has gone'
);
select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, status, is_offer, request_id, request_title) values ('10000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000f3', 'offered', true, 'cm-other', E'Two\nlines')$$,
  '23514', null, 'a one-line title'
);
select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, status, is_offer, request_id, request_title) values ('10000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000f3', 'offered', true, 'no-such-request', 'A title')$$,
  '23503', null, 'of a request that exists'
);
select throws_ok(
  $$update public.conversations set is_offer = false where id = '40000000-0000-4000-8000-0000000000f1'$$,
  '23514', null, 'an offer stays an offer'
);
select throws_ok(
  $$update public.conversations set is_offer = true where id = '40000000-0000-4000-8000-0000000000f8'$$,
  '23514', null, 'and nothing else becomes one'
);

-- start_conversation (replaced): its fallbacks and conflict targets leave offer threads out, and a hidden listing is
-- not there to message.
select pg_temp.sign_in(pg_temp.a('f1'));
insert into results values ('lamp', public.start_conversation('cm-lamp', null, 'Is the lamp still there?', null));
insert into results values ('lamp-again', public.start_conversation('cm-lamp', null, 'Hello?', null));
insert into results values ('question', public.start_conversation(null, 'comm-shop-f5', 'Do you deliver?', null));
insert into results values ('question-again', public.start_conversation(null, 'comm-shop-f5', 'Hello?', null));
insert into results values ('hidden', public.start_conversation('cm-hidden-lamp', null, 'Is it real?', null));
select pg_temp.sign_out();
select ok(
  (select v ->> 'result' from results where k = 'lamp') = 'started' and pg_temp.conv('lamp') <> pg_temp.c('f1'),
  'asking about a listing a shop offered with starts an enquiry of its own, not the offer (messages.ts:159)'
);
select is(
  (select v from results where k = 'lamp-again'),
  jsonb_build_object('result', 'added', 'conversation_id', pg_temp.conv('lamp')),
  'and a second message joins that enquiry'
);
select ok(
  (select v ->> 'result' from results where k = 'question') = 'started' and pg_temp.conv('question') <> pg_temp.c('f2'),
  'a question to a shop that offered with no listing starts a question of its own'
);
select is(
  (select v from results where k = 'question-again'),
  jsonb_build_object('result', 'added', 'conversation_id', pg_temp.conv('question')),
  'and a second question joins it'
);
select is(
  (select array_agg(body order by body) from public.messages where conversation_id in (pg_temp.c('f1'), pg_temp.c('f2'))),
  array['I passed Accounting 1 with a distinction.', 'I tutor Accounting 1, and this lamp helps late nights.'],
  'the offer threads hold only the shops'' offers'
);
select is(
  (select v from results where k = 'hidden'),
  '{"result": "not-found"}'::jsonb,
  'a hidden listing cannot be messaged (catalog.ts:109)'
);
select is(
  (select count(*) from public.conversations where listing_id = 'cm-hidden-lamp'),
  0::bigint,
  'and nothing starts'
);

-- my_conversations: the offer's columns, the asker unnamed to the shop until they write (messages.ts:116), and the
-- request's state (messages.ts:436, OfferAbout.tsx:40).
select ok(
  has_column_privilege('authenticated', 'public.conversations', 'is_offer', 'select')
  and has_column_privilege('authenticated', 'public.conversations', 'request_id', 'select')
  and has_column_privilege('authenticated', 'public.conversations', 'request_title', 'select')
  and has_column_privilege('authenticated', 'public.conversations', 'buyer_gone', 'select')
  and not has_column_privilege('authenticated', 'public.conversations', 'buyer_id', 'select'),
  'the conversations column grant gains the offer''s columns, still without buyer_id'
);
select pg_temp.sign_in(pg_temp.a('f2'));
select is(
  (select row(viewer_side, is_offer, request_id, request_title, status, buyer_gone, buyer_name, request_state)::text
   from public.my_conversations where id = pg_temp.c('f1')),
  row('seller', true, 'cm-open', 'Accounting 1 tutor this week', 'offered', false, null::text, 'live')::text,
  'the shop reads its offer: the request, live, and no name for the asker yet (UNNAMED_ASKER)'
);
select is(
  (select row(is_offer, request_id, buyer_name, request_state)::text from public.my_conversations where id = pg_temp.conv('lamp')),
  row(false, null::text, 'Ayanda', null::text)::text,
  'an enquiry names the buyer and has no request'
);
select is(
  (select count(*) from public.profiles where id = pg_temp.a('f1')),
  0::bigint,
  'the shop never reads the asker''s profile, only the name my_conversations gives'
);
select pg_temp.sign_out();
insert into public.messages (conversation_id, side, body) values (pg_temp.c('f1'), 'buyer', 'Yes please, Tuesday?');
select pg_temp.sign_in(pg_temp.a('f2'));
select is(
  (select buyer_name from public.my_conversations where id = pg_temp.c('f1')),
  'Ayanda',
  'once the asker writes, the shop reads their first name'
);
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(
  (select buyer_name from public.my_conversations where id = pg_temp.c('f2')),
  null,
  'another shop''s offer still has no name for the asker'
);
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f1'));
select is(
  (select array_agg(row(id, viewer_side, request_state)::text order by id) from public.my_conversations where is_offer),
  array[
    row(pg_temp.c('f1'), 'buyer', 'live')::text,
    row(pg_temp.c('f2'), 'buyer', 'live')::text,
    row(pg_temp.c('f3'), 'buyer', 'live')::text
  ],
  'the asker reads every offer on their request, a gone shop''s too'
);
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f3'));
select is((select count(*) from public.my_conversations where is_offer), 0::bigint, 'a stranger reads none of them');
select pg_temp.sign_out();

-- A conversation whose buyer has gone: the shop knows they've gone, and has no name.
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, status) values
  (pg_temp.c('f9'), 'cm-lamp', 'Lamp', pg_temp.s('f2'), null, 'replied');
select pg_temp.sign_in(pg_temp.a('f2'));
select is(
  (select row(buyer_gone, buyer_name)::text from public.my_conversations where id = pg_temp.c('f9')),
  row(true, null::text)::text,
  'a buyer who has deleted their account is gone, with no name ("Deleted account")'
);
select pg_temp.sign_out();

-- --- request_offer_count (offers.ts:31) ----------------------------------------------------------------------------

set local role anon;
select is(public.request_offer_count('cm-sample'), 2, 'a sample''s count is its seed offers');
select is(
  public.request_offer_count('cm-open'),
  3,
  'a request''s count is its offer threads, a gone shop''s included'
);
select is(public.request_offer_count('cm-hidden'), null, 'a hidden request has no count for anyone else');
select is(public.request_offer_count('no-such'), null, 'nor does an unknown one');
reset role;
select pg_temp.sign_in(pg_temp.a('f1'));
select is(public.request_offer_count('cm-hidden'), 0, 'the asker counts their hidden request''s offers');
select is(
  (select offers from public.my_requests where id = 'cm-open'),
  3,
  'and my_requests carries each request''s count'
);
select pg_temp.sign_out();

-- --- Hiding and deleting a request ----------------------------------------------------------------------------------

update public.requests set hidden_at = now(), hidden_reason = 'Not a tutoring request.' where id = 'cm-open';
select pg_temp.sign_in(pg_temp.a('f1'));
select is(
  (select request_state from public.my_conversations where id = pg_temp.c('f1')),
  'hidden',
  'the asker reads that the Hub hid the request (REQUEST_HIDDEN_NOTE)'
);
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f2'));
select is(
  (select request_state from public.my_conversations where id = pg_temp.c('f1')),
  'gone',
  'the shop reads only that it has gone (REQUEST_REMOVED_NOTE)'
);
select is((select count(*) from public.requests where id = 'cm-open'), 0::bigint, 'and can no longer read the request');
select pg_temp.sign_out();
update public.requests set hidden_at = null, hidden_reason = null where id = 'cm-open';

-- Deleting a request while the asker has a question thread and an enquiry with the shops that offered: every thread
-- stays, and the offers stay offers (plan review; messages.ts:159).
delete from public.requests where id = 'cm-open';
select is(
  (select array_agg(row(id, is_offer, request_id, request_title)::text order by id) from public.conversations where id in (pg_temp.c('f1'), pg_temp.c('f2'), pg_temp.c('f3'))),
  array[
    row(pg_temp.c('f1'), true, null::text, 'Accounting 1 tutor this week')::text,
    row(pg_temp.c('f2'), true, null::text, 'Accounting 1 tutor this week')::text,
    row(pg_temp.c('f3'), true, null::text, 'Accounting 1 tutor this week')::text
  ],
  'a deleted request''s offers stay offers, with its title (request_id is set null)'
);
select is(
  (select count(*) from public.conversations
   where id in (pg_temp.conv('lamp'), pg_temp.conv('question')) and not is_offer and status = 'asked' and request_id is null),
  2::bigint,
  'and the asker''s enquiry and question with those shops stay as they were'
);
select pg_temp.sign_in(pg_temp.a('f1'));
insert into results values ('question-after', public.start_conversation(null, 'comm-shop-f5', 'Still there?', null));
select is(
  (select array_agg(row(id, request_state)::text order by id) from public.my_conversations where is_offer),
  array[
    row(pg_temp.c('f1'), 'gone')::text, row(pg_temp.c('f2'), 'gone')::text, row(pg_temp.c('f3'), 'gone')::text
  ],
  'the asker reads that the request has gone'
);
select pg_temp.sign_out();
select is(
  (select v from results where k = 'question-after'),
  jsonb_build_object('result', 'added', 'conversation_id', pg_temp.conv('question')),
  'a question to the shop still joins the question, never the offer'
);
select lives_ok(
  $$insert into public.conversations (shop_id, buyer_id, status, is_offer, request_title) values ('10000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-0000000000f1', 'offered', true, 'Accounting 1 tutor this week')$$,
  'offers whose request has gone never clash with each other'
);

-- --- The mentor's numbers leave offers out (shop-stats.ts:26) -------------------------------------------------------

-- At 2026-10-20 12:00 UTC, the last 14 days start at 2026-10-06 12:00. Kabelo's shop:
--   m1 an enquiry 3 days ago answered in an hour: an enquiry, due, in time
--   m2 an offer pointing at a listing, 2 days ago: not an enquiry (the shop wrote first)
--   m3 an offer the asker confirmed as a sale 2 days ago: a sale
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, status, created_at, first_reply_at, completed_at, confirmed_at, confirmed_by, is_offer, request_id, request_title) values
  (pg_temp.c('d1'), null, 'Lamp', pg_temp.s('f7'), pg_temp.a('f1'), 'replied', '2026-10-17T12:00:00Z', '2026-10-17T13:00:00Z', null, null, null, false, null, null),
  (pg_temp.c('d2'), null, 'Lamp', pg_temp.s('f7'), pg_temp.a('f1'), 'replied', '2026-10-18T12:00:00Z', null, null, null, null, true, 'cm-hidden', 'Exam answers wanted'),
  (pg_temp.c('d3'), null, null, pg_temp.s('f7'), pg_temp.a('f1'), 'confirmed', '2026-10-01T12:00:00Z', '2026-10-01T13:00:00Z', '2026-10-17T12:00:00Z', '2026-10-18T12:00:00Z', 'buyer', true, 'cm-closed', 'Bar fridge for my room');
select pg_temp.sign_in(pg_temp.a('f6'));
select is(
  (select row(enquiries, due, replied_in_time, sales_confirmed)::text
   from public.mentor_shop_numbers(pg_temp.s('f7'), '2026-10-20T12:00:00Z')),
  row(1, 1, 1, 1)::text,
  'an offer is not an enquiry, even about a listing; its sale still counts'
);
select pg_temp.sign_out();

-- --- follows (FollowRow, rows.ts:484; follows.ts) ------------------------------------------------------------------

insert into public.follows (account_id, shop_id) values
  (pg_temp.a('f1'), pg_temp.s('f2')),
  (pg_temp.a('f3'), pg_temp.s('f2')),
  (pg_temp.a('f1'), pg_temp.s('f5'));
select throws_ok(
  $$insert into public.follows (account_id, shop_id) values ('00000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-0000000000f2')$$,
  '23505', null, 'a student follows a shop once (addFollow''s "already")'
);
select throws_ok(
  $$insert into public.follows (account_id, shop_id) values ('00000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000099')$$,
  '23503', null, 'a shop that exists'
);
select is(
  (select row(id is not null, created_at = now())::text from public.follows where account_id = pg_temp.a('f3')),
  row(true, true)::text,
  'a follow has an id and a time'
);
set local role anon;
select throws_ok($$select id from public.follows$$, '42501', null, 'anon reads no follows');
select throws_ok($$select public.follower_count('10000000-0000-4000-8000-0000000000f2')$$, '42501', null, 'nor counts them');
reset role;
select pg_temp.sign_in(pg_temp.a('f1'));
select is(
  (select array_agg(shop_id order by shop_id) from public.follows),
  array[pg_temp.s('f2'), pg_temp.s('f5')],
  'a student reads their own follows'
);
select is(public.follower_count(pg_temp.s('f2')), null, 'but not how many follow someone else''s shop');
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f2'));
select is(
  (select count(*) from public.follows where shop_id = pg_temp.s('f2')),
  0::bigint,
  'a shop''s owner never reads who follows it'
);
select is(public.follower_count(pg_temp.s('f2')), 2, 'only how many (countFollowers, follows.ts:91)');
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f7'));
select is(public.follower_count(pg_temp.s('f7')), 0, 'a shop nobody follows has 0');
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f4'));
select is((select count(*) from public.follows), 0::bigint, 'an admin reads nobody''s follows');
select pg_temp.sign_out();

-- --- saved_searches (SavedSearchRow, rows.ts:496; lib/saved-searches/rules.ts) -------------------------------------

insert into public.saved_searches (id, account_id, q, category, campus_slug, price, pay, deals, search_key) values
  ('ss-f1-calc', pg_temp.a('f1'), 'Calculator casio', null, 'test-campus', 'under-500', null, null, 'calculator casio||test-campus|under-500||'),
  ('ss-f1-tech', pg_temp.a('f1'), null, 'test-category', null, null, 'swap', 'free-and-swaps', '|test-category|all||swap|free-and-swaps'),
  ('ss-f3-calc', pg_temp.a('f3'), 'casio calculator', null, 'test-campus', 'under-500', null, null, 'calculator casio||test-campus|under-500||');
select is(
  (select row(paused_at, created_at = now())::text from public.saved_searches where id = 'ss-f1-calc'),
  row(null::timestamptz, true)::text,
  'a saved search starts with its alerts on'
);
insert into public.saved_searches (account_id, category, search_key) values (pg_temp.a('f3'), 'test-category', 'short-id-key');
select is(
  (select char_length(id) from public.saved_searches where search_key = 'short-id-key'),
  10,
  'a new one gets a short id'
);
select throws_ok(
  $$insert into public.saved_searches (account_id, q, campus_slug, price, search_key) values ('00000000-0000-4000-8000-0000000000f1', 'casio calculator', 'test-campus', 'under-500', 'calculator casio||test-campus|under-500||')$$,
  '23505', null, 'the same search twice is "already" (searchKey, plan decision 3)'
);
select throws_ok(
  $$insert into public.saved_searches (account_id, campus_slug, search_key) values ('00000000-0000-4000-8000-0000000000f1', 'test-campus', '|||||')$$,
  '23514', null, 'a campus alone is not worth saving (isWorthSaving, rules.ts:44)'
);
select throws_ok(
  $$insert into public.saved_searches (account_id, q, search_key) values ('00000000-0000-4000-8000-0000000000f1', '', 'k1')$$,
  '23514', null, 'words are null when there are none, never ""'
);
select throws_ok(
  format($$insert into public.saved_searches (account_id, q, search_key) values ('00000000-0000-4000-8000-0000000000f1', %L, 'k2')$$, repeat('a', 101)),
  '23514', null, 'and at most 100 characters (MAX_QUERY_LENGTH)'
);
select throws_ok(
  $$insert into public.saved_searches (account_id, price, search_key) values ('00000000-0000-4000-8000-0000000000f1', 'under-75', 'k3')$$,
  '23514', null, 'a price filter is one of browse''s five (PriceFilter, types.ts:272)'
);
select throws_ok(
  $$insert into public.saved_searches (account_id, pay, search_key) values ('00000000-0000-4000-8000-0000000000f1', 'card', 'k4')$$,
  '23514', null, 'pay is cash or swap (PayFilter)'
);
select throws_ok(
  $$insert into public.saved_searches (account_id, deals, search_key) values ('00000000-0000-4000-8000-0000000000f1', 'swaps', 'k5')$$,
  '23514', null, 'deals is free-and-swaps'
);
select throws_ok(
  $$insert into public.saved_searches (account_id, category, search_key) values ('00000000-0000-4000-8000-0000000000f1', 'no-such-category', 'k6')$$,
  '23503', null, 'a category that exists'
);
select throws_ok(
  $$insert into public.saved_searches (account_id, category, campus_slug, search_key) values ('00000000-0000-4000-8000-0000000000f1', 'test-category', 'all', 'k7')$$,
  '23503', null, 'a campus that exists: every campus is null, not "all" (plan decision 2)'
);
select throws_ok(
  $$insert into public.saved_searches (account_id, category, search_key) values ('00000000-0000-4000-8000-0000000000f1', 'test-category', '')$$,
  '23514', null, 'the key is never empty'
);
set local role anon;
select throws_ok($$select id from public.saved_searches$$, '42501', null, 'anon reads no saved searches');
reset role;
select pg_temp.sign_in(pg_temp.a('f1'));
select is(
  (select array_agg(id order by id) from public.saved_searches),
  array['ss-f1-calc', 'ss-f1-tech'],
  'a student reads only their own saved searches'
);
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f3'));
select is(
  (select count(*) from public.saved_searches where account_id = pg_temp.a('f1')),
  0::bigint,
  'and nobody else''s'
);
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f4'));
select is((select count(*) from public.saved_searches), 0::bigint, 'not even an admin''s');
select pg_temp.sign_out();

-- --- Deletions -------------------------------------------------------------------------------------------------------

delete from public.shops where id = pg_temp.s('f5');
select is((select count(*) from public.follows where shop_id = pg_temp.s('f5')), 0::bigint, 'a deleted shop takes its follows');
select is(
  (select row(shop_id, is_offer)::text from public.conversations where id = pg_temp.c('f2')),
  row(null::uuid, true)::text,
  'its offer stays an offer, as "A closed shop"'
);
delete from public.profiles where id = pg_temp.a('f3');
select is((select count(*) from public.follows where account_id = pg_temp.a('f3')), 0::bigint, 'a deleted account takes its follows');
select is((select count(*) from public.saved_searches where account_id = pg_temp.a('f3')), 0::bigint, 'and its saved searches');
select is((select count(*) from public.requests where id = 'cm-other'), 0::bigint, 'and its requests');
select is(
  (select row(buyer_id, buyer_gone)::text from public.conversations where id = pg_temp.c('f8')),
  row(null::uuid, true)::text,
  'and its conversations stay for the shop, the buyer gone'
);

-- --- Grants on the functions ----------------------------------------------------------------------------------------

select ok(
  has_function_privilege('anon', 'public.request_offer_count(text)', 'execute')
  and has_function_privilege('authenticated', 'public.request_offer_count(text)', 'execute'),
  'anyone counts a request''s offers'
);
select ok(
  not has_function_privilege('anon', 'public.follower_count(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.follower_count(uuid)', 'execute'),
  'a follower count is for signed-in shop owners'
);
select ok(
  not exists (
    select 1 from unnest(array[
      'public.request_offer_count(text)'::regprocedure, 'public.follower_count(uuid)'::regprocedure,
      'public.start_conversation(text, text, text, text)'::regprocedure,
      'public.mentor_shop_numbers(uuid, timestamptz)'::regprocedure,
      'private.is_my_request(text)'::regprocedure, 'private.conversation_buyer_name(uuid)'::regprocedure,
      'private.conversation_request_state(uuid)'::regprocedure
    ]) f
    join pg_proc p on p.oid = f
    where not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false)
  ),
  'the new and replaced functions are security definer with an empty search path'
);

select * from finish();
rollback;
