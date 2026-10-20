-- Schema catch-up, Task 8: deleting an account once stages G to J are in the database (deleteAccountData,
-- lib/data/accounts.ts:237-278, and what it calls: forgetRequestsOf, forgetFollowsOf, forgetSavedSearchesOf,
-- forgetShopOf and forgetAccountInStaffTools). Phase A's cases stay in 10_account_deletion.test.sql; these are the new
-- ones. Four accounts are deleted in turn, each a different kind, and each time the test checks what goes and what the
-- people who stay keep:
--   Lerato (01)  a student with requests, an offer thread on one, follows, a saved search, an RSVP and a slot request
--   Sipho (02)   a seller with a shop, followers, Featured pins, an old link and reported listings
--   Mpho (03)    a mentor with notes, an answered slot request, a Hub post and audit entries both ways
--   Zanele (04)  an admin with audit entries (one about herself), pins, a closed report, a note and a post with a cover
-- Ayanda (05, a student) and Kabelo (06, a seller) stay throughout.
begin;
select plan(54);

-- Accounts, shops, conversations, bookings, notes and audit entries by their last two characters.
create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000001' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000001' || n)::uuid;
$f$;
create function pg_temp.p(n text) returns uuid language sql immutable as $f$
  select ('30000000-0000-4000-8000-0000000001' || n)::uuid;
$f$;
create function pg_temp.c(n text) returns uuid language sql immutable as $f$
  select ('40000000-0000-4000-8000-0000000001' || n)::uuid;
$f$;
create function pg_temp.b(n text) returns uuid language sql immutable as $f$
  select ('70000000-0000-4000-8000-0000000001' || n)::uuid;
$f$;
create function pg_temp.m(n text) returns uuid language sql immutable as $f$
  select ('80000000-0000-4000-8000-0000000001' || n)::uuid;
$f$;
create function pg_temp.e(n text) returns uuid language sql immutable as $f$
  select ('90000000-0000-4000-8000-0000000001' || n)::uuid;
$f$;
-- This file's notifications, as "account kind subject href", sorted.
create function pg_temp.notes(note_kind text) returns text[] language sql as $f$
  select coalesce(array_agg(t.line order by t.line), '{}')
  from (
    select right(n.account_id::text, 2) || ' ' || n.kind || ' ' || n.subject_id || ' ' || n.href as line
    from public.notifications n
    where n.kind = note_kind and n.account_id in (select pg_temp.a(x) from unnest(array['01', '02', '03', '04', '05', '06']) x)
  ) t;
$f$;
-- This file's follows, as "follower shop", sorted.
create function pg_temp.follows() returns text[] language sql as $f$
  select coalesce(array_agg(t.line order by t.line), '{}')
  from (
    select right(f.account_id::text, 2) || ' ' || right(f.shop_id::text, 2) as line
    from public.follows f
    where f.shop_id in (pg_temp.s('02'), pg_temp.s('06'))
  ) t;
$f$;

insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
insert into auth.users (id, email) values
  (pg_temp.a('01'), 'lerato@eduvos.com'), (pg_temp.a('02'), 'sipho@eduvos.com'), (pg_temp.a('03'), 'mpho@eduvos.com'),
  (pg_temp.a('04'), 'zanele@eduvos.com'), (pg_temp.a('05'), 'ayanda@eduvos.com'), (pg_temp.a('06'), 'kabelo@eduvos.com');
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('01'), 'Lerato', 'test-campus', '{}'),
  (pg_temp.a('02'), 'Sipho', 'test-campus', '{}'),
  (pg_temp.a('03'), 'Mpho', 'test-campus', '{mentor}'),
  (pg_temp.a('04'), 'Zanele', 'test-campus', '{admin}'),
  (pg_temp.a('05'), 'Ayanda', 'test-campus', '{}'),
  (pg_temp.a('06'), 'Kabelo', 'test-campus', '{}');

-- Sipho's Tech shop (with an old link) and Kabelo's Books shop, both mentored by Mpho.
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('02'), 'test-fg-tech', pg_temp.a('02'), 'Tech shop', 'test-category', 'test-campus', '2026-01'),
  (pg_temp.s('06'), 'test-fg-books', pg_temp.a('06'), 'Books shop', 'test-category', 'test-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, mentor_id) values
  (pg_temp.a('02'), 'approved', pg_temp.s('02'), pg_temp.a('03')),
  (pg_temp.a('06'), 'approved', pg_temp.s('06'), pg_temp.a('03'));
insert into public.shop_previous_slugs (slug, shop_id) values ('test-fg-tech-old', pg_temp.s('02'));
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('t-f1', pg_temp.s('02'), 'available', 'item', 'Headset', 'test-category', 'good', 400, 'cash', 'A headset.', 'online', 'test-campus', now()),
  ('t-f2', pg_temp.s('02'), 'available', 'item', 'Calculator', 'test-category', 'good', 200, 'cash', 'A calculator.', 'online', 'test-campus', now()),
  ('t-f3', pg_temp.s('06'), 'available', 'item', 'Book', 'test-category', 'good', 100, 'cash', 'A book.', 'online', 'test-campus', now());
-- Sipho's listing photo, and the Hub's cover for Zanele's event, which has no owner (plan decision 6).
insert into public.photos (id, owner_id, use, type, path) values
  (pg_temp.p('01'), pg_temp.a('02'), 'listing:t-f1', 'image/webp', pg_temp.a('02')::text || '/' || pg_temp.p('01')::text),
  (pg_temp.p('09'), null, 'post:test-fg-ev', 'image/webp', 'hub/' || pg_temp.p('09')::text);
insert into public.listing_photos (listing_id, photo_id, position) values ('t-f1', pg_temp.p('01'), 0);

-- Lerato's request, with two offers: Kabelo's (she hasn't answered) and Sipho's (she has). Ayanda's request, with
-- offers from both shops, neither answered.
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details) values
  ('test-fg-req1', pg_temp.a('01'), 'Need a desk lamp', 'test-category', 'test-campus', 'A desk lamp for my room, any colour.'),
  ('test-fg-req2', pg_temp.a('05'), 'Need a used textbook', 'test-category', 'test-campus', 'The first-year accounting textbook, any edition.');
insert into public.conversations (id, shop_id, buyer_id, status, is_offer, request_id, request_title, listing_id, listing_title, created_at, last_message_at, first_reply_at) values
  (pg_temp.c('01'), pg_temp.s('06'), pg_temp.a('01'), 'offered', true, 'test-fg-req1', 'Need a desk lamp', null, null, '2026-10-14T08:00Z', '2026-10-14T08:00Z', null),
  (pg_temp.c('02'), pg_temp.s('02'), pg_temp.a('01'), 'replied', true, 'test-fg-req1', 'Need a desk lamp', null, null, '2026-10-14T09:00Z', '2026-10-14T10:00Z', '2026-10-14T10:00Z'),
  (pg_temp.c('03'), pg_temp.s('02'), pg_temp.a('05'), 'replied', false, null, null, 't-f1', 'Headset', '2026-10-14T08:00Z', '2026-10-14T09:00Z', '2026-10-14T09:00Z'),
  (pg_temp.c('04'), pg_temp.s('02'), pg_temp.a('05'), 'offered', true, 'test-fg-req2', 'Need a used textbook', null, null, '2026-10-15T08:00Z', '2026-10-15T08:00Z', null),
  (pg_temp.c('05'), pg_temp.s('06'), pg_temp.a('05'), 'offered', true, 'test-fg-req2', 'Need a used textbook', null, null, '2026-10-15T09:00Z', '2026-10-15T09:00Z', null);
insert into public.messages (conversation_id, side, body, sent_at, read_at) values
  (pg_temp.c('01'), 'seller', 'I have a lamp.', '2026-10-14T08:00Z', '2026-10-14T08:05Z'),
  (pg_temp.c('02'), 'seller', 'Mine is blue.', '2026-10-14T09:00Z', '2026-10-14T09:05Z'),
  (pg_temp.c('02'), 'buyer', 'Blue is fine.', '2026-10-14T10:00Z', '2026-10-14T10:05Z'),
  (pg_temp.c('03'), 'buyer', 'Is it there?', '2026-10-14T08:00Z', '2026-10-14T08:05Z'),
  (pg_temp.c('03'), 'seller', 'It is.', '2026-10-14T09:00Z', null),
  (pg_temp.c('04'), 'seller', 'I have one.', '2026-10-15T08:00Z', null),
  (pg_temp.c('05'), 'seller', 'I have it too.', '2026-10-15T09:00Z', null);

insert into public.follows (account_id, shop_id) values
  (pg_temp.a('01'), pg_temp.s('02')), (pg_temp.a('01'), pg_temp.s('06')), (pg_temp.a('05'), pg_temp.s('02')),
  (pg_temp.a('05'), pg_temp.s('06')), (pg_temp.a('06'), pg_temp.s('02')), (pg_temp.a('02'), pg_temp.s('06'));
insert into public.saved_searches (id, account_id, q, search_key) values
  ('ss-fg1', pg_temp.a('01'), 'lamp', 'q=lamp'), ('ss-fg2', pg_temp.a('05'), 'headset', 'q=headset');
insert into public.featured_pins (shop_id, campus_slug, day, pinned_by) values
  (pg_temp.s('02'), 'test-campus', '2026-10-20', pg_temp.a('04')), (pg_temp.s('06'), 'test-campus', '2026-10-20', pg_temp.a('04'));

-- Mpho's office hours and Zanele's event (with the Hub's cover). Lerato and Ayanda are going to the event; Lerato has
-- asked for a slot (open), and Mpho has accepted Ayanda's.
insert into public.hub_posts (id, kind, title, summary, place, body, campus_slug, starts_at, capacity, going, cover_photo_id, published, published_at, author_id) values
  ('test-fg-oh', 'office-hours', 'Office hours', 'Bring your questions.', 'Room 4', 'Come by.', 'test-campus', '2026-11-01T10:00Z', null, null, null, true, now(), pg_temp.a('03')),
  ('test-fg-ev', 'event', 'Market day', 'Sell on the lawn.', 'The lawn', 'Bring a table.', 'test-campus', '2026-11-02T10:00Z', 30, 0, pg_temp.p('09'), true, now(), pg_temp.a('04'));
insert into public.hub_rsvps (post_id, account_id) values ('test-fg-ev', pg_temp.a('01')), ('test-fg-ev', pg_temp.a('05'));
insert into public.hub_bookings (id, post_id, account_id, help, time, status, answered_at, answered_by) values
  (pg_temp.b('01'), 'test-fg-oh', pg_temp.a('01'), 'Pricing my notes', '', 'open', null, null),
  (pg_temp.b('02'), 'test-fg-oh', pg_temp.a('05'), 'Photos for listings', 'Friday', 'accepted', '2026-10-16T10:00Z', pg_temp.a('03'));

-- Mentors' notes: Mpho's about Sipho and a check-in about Kabelo, and Zanele's about Kabelo.
insert into public.mentor_notes (id, owner_id, kind, check_in_on, text, author_id, author_name) values
  (pg_temp.m('01'), pg_temp.a('02'), 'note', null, 'Prices look fair.', pg_temp.a('03'), 'Mpho'),
  (pg_temp.m('02'), pg_temp.a('06'), 'check-in', '2026-10-15', 'Talked about photos.', pg_temp.a('03'), 'Mpho'),
  (pg_temp.m('03'), pg_temp.a('06'), 'note', null, 'Ready for Featured.', pg_temp.a('04'), 'Zanele');

-- The audit log: Zanele approved Sipho's shop (E1), hid Ayanda's report target (E3), gave Mpho his role (E5) and gave
-- herself one (E6); Mpho added a note about Kabelo (E2) and accepted Ayanda's slot (E4).
insert into public.audit_log (id, at, staff_id, staff_name, action, target_kind, target_id, target_name, detail, subject_id) values
  (pg_temp.e('01'), '2026-10-01T08:00Z', pg_temp.a('04'), 'Zanele', 'shop-approved', 'shop', 'test-fg-tech', 'Tech shop', 'Looks good', pg_temp.a('02')),
  (pg_temp.e('02'), '2026-10-02T08:00Z', pg_temp.a('03'), 'Mpho', 'note-added', 'shop', 'test-fg-books', 'Books shop', 'Talked about photos.', pg_temp.a('06')),
  (pg_temp.e('03'), '2026-10-03T08:00Z', pg_temp.a('04'), 'Zanele', 'request-hidden', 'request', 'test-fg-req2', 'Need a used textbook', 'Spam', pg_temp.a('05')),
  (pg_temp.e('04'), '2026-10-04T08:00Z', pg_temp.a('03'), 'Mpho', 'booking-accepted', 'booking', pg_temp.b('02')::text, 'Ayanda: Office hours', '', pg_temp.a('05')),
  (pg_temp.e('05'), '2026-10-05T08:00Z', pg_temp.a('04'), 'Zanele', 'role-given', 'account', pg_temp.a('03')::text, 'Mpho', 'mentor', pg_temp.a('03')),
  (pg_temp.e('06'), '2026-10-06T08:00Z', pg_temp.a('04'), 'Zanele', 'role-given', 'account', pg_temp.a('04')::text, 'Zanele', 'mentor', pg_temp.a('04'));

-- Reports: Lerato's on Kabelo's book; Ayanda's on Sipho's headset, on his shop (closed by Zanele), on Lerato's
-- request and on Kabelo's book; Kabelo's on Sipho's headset.
insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason, status, outcome, closed_at, closed_by) values
  ('60000000-0000-4000-8000-000000000101', pg_temp.a('01'), 'listing', 't-f3', 'Book', 'spam', 'open', null, null, null),
  ('60000000-0000-4000-8000-000000000102', pg_temp.a('05'), 'listing', 't-f1', 'Headset', 'scam', 'open', null, null, null),
  ('60000000-0000-4000-8000-000000000103', pg_temp.a('05'), 'seller', 'test-fg-tech', 'Tech shop', 'scam', 'closed', 'dismissed', '2026-10-10T08:00Z', pg_temp.a('04')),
  ('60000000-0000-4000-8000-000000000104', pg_temp.a('05'), 'request', 'test-fg-req1', 'Need a desk lamp', 'spam', 'open', null, null, null),
  ('60000000-0000-4000-8000-000000000105', pg_temp.a('06'), 'listing', 't-f1', 'Headset', 'misleading', 'open', null, null, null),
  ('60000000-0000-4000-8000-000000000106', pg_temp.a('05'), 'listing', 't-f3', 'Book', 'spam', 'open', null, null, null);

insert into public.notifications (account_id, kind, subject_id, text, href, created_at, count) values
  (pg_temp.a('01'), 'offer', pg_temp.c('01')::text, 'Books shop offered to help', '/messages/' || pg_temp.c('01')::text, '2026-10-14T08:00Z', null),
  (pg_temp.a('01'), 'request-update', 'test-fg-req1', 'The Hub hid your request', '/account/requests', '2026-10-14T08:00Z', null),
  (pg_temp.a('01'), 'search-match', 'ss-fg1', 'A new match for lamp', '/listings/t-f3', '2026-10-14T08:00Z', null),
  (pg_temp.a('05'), 'new-listing', 'test-fg-tech', 'Tech shop listed Headset', '/listings/t-f1', '2026-10-14T08:00Z', null),
  (pg_temp.a('06'), 'new-listing', 'test-fg-tech', 'Tech shop listed 2 new things', '/sellers/test-fg-tech', '2026-10-14T08:00Z', 2),
  (pg_temp.a('05'), 'new-listing', 'test-fg-books', 'Books shop listed Book', '/listings/t-f3', '2026-10-14T08:00Z', null),
  (pg_temp.a('05'), 'search-match', 'ss-fg2', 'A new match for headset', '/listings/t-f1', '2026-10-10T08:00Z', null),
  (pg_temp.a('05'), 'search-match', 'ss-fg2', '2 new matches for headset', '/browse?q=headset', '2026-10-11T08:00Z', 2),
  (pg_temp.a('03'), 'booking', pg_temp.b('01')::text, 'Lerato asked for a slot', '/hub/manage#hub-queue', '2026-10-15T08:00Z', null),
  (pg_temp.a('03'), 'booking', pg_temp.b('02')::text, 'Ayanda asked for a slot', '/hub/manage#hub-queue', '2026-10-15T08:00Z', null),
  (pg_temp.a('05'), 'booking', pg_temp.b('02')::text, 'Your slot was accepted', '/hub/test-fg-oh', '2026-10-16T10:00Z', null);

-- --- Who may run it (unchanged from phase A) -------------------------------------------------------------------------

select is(
  array[
    has_function_privilege('anon', 'public.forget_account(uuid)', 'execute'),
    has_function_privilege('authenticated', 'public.forget_account(uuid)', 'execute'),
    has_function_privilege('service_role', 'public.forget_account(uuid)', 'execute')
  ],
  array[false, false, true],
  'forget_account is still the server''s only'
);

-- --- Lerato, a student -------------------------------------------------------------------------------------------

-- Task 3's catch: the Auth user's delete alone would null the offer thread's buyer and, through her request's cascade,
-- its request in one statement, and the foreign key check fails. forget_account takes each step on its own.
select throws_ok(
  format('delete from auth.users where id = %L', pg_temp.a('01')),
  '23503', null,
  'deleting her Auth user without forget_account fails on her request''s offer thread (Task 3)'
);

set local role service_role;
select is(public.forget_account(pg_temp.a('01')), '{}'::text[], 'forgetting a student with no photos gives back no paths');
reset role;

select is(
  (select row(buyer_id, buyer_gone, is_offer, request_id, request_title, status)::text from public.conversations where id = pg_temp.c('01')),
  row(null::uuid, true, true, null::text, 'Need a desk lamp', 'offered')::text,
  'Kabelo''s offer on her deleted request stays an offer, with its title, and without her or the request (Task 3)'
);
select is(
  (select array_agg(row(side, body, read_at)::text) from public.messages where conversation_id = pg_temp.c('01')),
  array[row('seller', 'I have a lamp.', null::timestamptz)::text],
  'and Kabelo keeps his offer'
);
select is(
  (select row(buyer_id, is_offer, request_title, status)::text from public.conversations where id = pg_temp.c('02')),
  row(null::uuid, true, 'Need a desk lamp', 'replied')::text,
  'Sipho''s offer, which she answered, stays an offer too'
);
select is(
  (select array_agg(side) from public.messages where conversation_id = pg_temp.c('02')),
  array['seller'],
  'her answer goes and Sipho keeps his offer'
);
select is(
  (select array_agg(id order by id) from public.requests where id like 'test-fg-%'),
  array['test-fg-req2'],
  'her request goes, not Ayanda''s'
);
select is(
  (select row(target_id, target_gone, status)::text from public.reports where id = '60000000-0000-4000-8000-000000000104'),
  row('test-fg-req1', false, 'open')::text,
  'Ayanda''s report on her request stays, not marked gone (plan decision 8)'
);
select is(
  (select count(*) from public.reports where reporter_id = pg_temp.a('01')),
  0::bigint,
  'her own report goes'
);
select is(
  (select count(*) from public.notifications where account_id = pg_temp.a('01') or (kind = 'request-update' and subject_id = 'test-fg-req1')),
  0::bigint,
  'her notifications go: the offer, the Hub''s request update and her search match'
);
select is(
  pg_temp.follows(),
  array['02 06', '05 02', '05 06', '06 02'],
  'her follows go, and everyone else''s stay'
);
select is(
  (select array_agg(id order by id) from public.saved_searches where id like 'ss-fg%'),
  array['ss-fg2'],
  'her saved search goes, not Ayanda''s'
);
select is(
  (select array_agg(right(account_id::text, 2)) from public.hub_rsvps where post_id = 'test-fg-ev'),
  array['05'],
  'her RSVP goes, and Ayanda is still going'
);
select is(
  (select array_agg(id) from public.hub_bookings where post_id = 'test-fg-oh'),
  array[pg_temp.b('02')],
  'her slot request goes, not Ayanda''s'
);
select is(
  pg_temp.notes('booking'),
  array[
    '03 booking ' || pg_temp.b('02')::text || ' /hub/manage#hub-queue',
    '05 booking ' || pg_temp.b('02')::text || ' /hub/test-fg-oh'
  ],
  'Mpho''s "asked for a slot" notification about her request goes, since it names her (staff tools amendment 2)'
);
select is((select count(*) from public.profiles where id = pg_temp.a('01')), 0::bigint, 'her profile goes');
select lives_ok(
  format('delete from auth.users where id = %L', pg_temp.a('01')),
  'then her Auth user goes, with nothing left to catch on'
);

-- --- Sipho, a seller -----------------------------------------------------------------------------------------------

set local role service_role;
select is(
  public.forget_account(pg_temp.a('02')),
  array[pg_temp.a('02')::text || '/' || pg_temp.p('01')::text],
  'forgetting a seller gives back his listing photo''s path'
);
reset role;

select is((select count(*) from public.shops where id = pg_temp.s('02')), 0::bigint, 'his shop goes');
select is(
  (select array_agg(id order by id) from public.listings where id like 't-f%'),
  array['t-f3'],
  'with its listings, not Kabelo''s'
);
select is(
  (select count(*) from public.shop_previous_slugs where slug = 'test-fg-tech-old'),
  0::bigint,
  'its old link frees up with it (plan decision 7)'
);
select is(
  (select array_agg(right(shop_id::text, 2)) from public.featured_pins where day = '2026-10-20' and campus_slug = 'test-campus'),
  array['06'],
  'its Featured pin goes (amendment 14.7), not Kabelo''s'
);
select is(
  pg_temp.follows(),
  array['05 06'],
  'his shop''s followers go, and so does his own follow; Ayanda still follows Kabelo'
);
select is(
  pg_temp.notes('new-listing'),
  array['05 new-listing test-fg-books /listings/t-f3'],
  'the new-listing notifications about his shop go, to a listing or to the shop (Task 6''s open question 3); Kabelo''s stay'
);
select is(
  pg_temp.notes('search-match'),
  array['05 search-match ss-fg2 /browse?q=headset'],
  'a search match that leads to his listing goes; the one that leads to the search''s results stays (amendment 11)'
);
select is(
  (select array_agg(row(right(id::text, 1), target_gone)::text order by id) from public.reports where reporter_id in (pg_temp.a('05'), pg_temp.a('06'))),
  array[
    row('2', true)::text, row('3', true)::text, row('4', false)::text, row('5', true)::text, row('6', false)::text
  ],
  'reports about his shop and his listings are marked gone, every reporter''s (amendment 13.1); the rest are not'
);
select is(
  (select row(status, outcome, closed_by)::text from public.reports where id = '60000000-0000-4000-8000-000000000103'),
  row('closed', 'dismissed', pg_temp.a('04'))::text,
  'a closed report about his shop keeps its outcome and who closed it'
);
select is(
  (select row(seller_gone, shop_id, listing_id, listing_title, buyer_id)::text from public.conversations where id = pg_temp.c('03')),
  row(true, null::uuid, null::text, 'Headset', pg_temp.a('05'))::text,
  'Ayanda''s question stays, the seller gone, with the listing''s title'
);
select is(
  (select array_agg(side) from public.messages where conversation_id = pg_temp.c('03')),
  array['buyer'],
  'and she keeps her side'
);
select is(
  (select array_agg(id order by id) from public.conversations where id in (pg_temp.c('02'), pg_temp.c('04'), pg_temp.c('05'))),
  array[pg_temp.c('05')],
  'his offers go (one with nobody left, one with nothing left in it); Kabelo''s offer on Ayanda''s request stays'
);
select is(
  (select row(is_offer, request_id, request_title)::text from public.conversations where id = pg_temp.c('05')),
  row(true, 'test-fg-req2', 'Need a used textbook')::text,
  'unchanged'
);
select is(
  (select array_agg(id order by id) from public.mentor_notes where id in (pg_temp.m('01'), pg_temp.m('02'), pg_temp.m('03'))),
  array[pg_temp.m('02'), pg_temp.m('03')],
  'the mentor''s note about him goes; notes about Kabelo stay'
);
select is(
  (select row(staff_id, staff_name, action, target_kind, target_id, target_name, detail, subject_id)::text from public.audit_log where id = pg_temp.e('01')),
  row(pg_temp.a('04'), 'Zanele', 'shop-approved', 'shop', '', 'Deleted account', '', null::uuid)::text,
  'the audit entry about him stays, without his id, name or reason (staff tools decision 6)'
);
select is(
  (select count(*) from public.seller_profiles where account_id = pg_temp.a('02')),
  0::bigint,
  'his seller profile goes with his profile'
);

-- --- Mpho, a mentor ------------------------------------------------------------------------------------------------

set local role service_role;
select is(public.forget_account(pg_temp.a('03')), '{}'::text[], 'forgetting a mentor with no photos gives back no paths');
reset role;

select is(
  (select row(owner_id, kind, text, author_id, author_name)::text from public.mentor_notes where id = pg_temp.m('02')),
  row(pg_temp.a('06'), 'check-in', 'Talked about photos.', null::uuid, 'Deleted account')::text,
  'his check-in about Kabelo stays, as "Deleted account"'
);
select is(
  (select mentor_id from public.seller_profiles where account_id = pg_temp.a('06')),
  null::uuid,
  'Kabelo''s shop loses him as its mentor'
);
select is(
  (select row(status, time, answered_at, answered_by)::text from public.hub_bookings where id = pg_temp.b('02')),
  row('accepted', 'Friday', '2026-10-16T10:00Z'::timestamptz, null::uuid)::text,
  'the slot he accepted stays accepted, unsigned'
);
select is(
  (select row(author_id, published, title)::text from public.hub_posts where id = 'test-fg-oh'),
  row(null::uuid, true, 'Office hours')::text,
  'his post stays on the Hub, unsigned (staff tools decision 11)'
);
select is(
  (select row(staff_id, staff_name, target_id, target_name, detail, subject_id)::text from public.audit_log where id = pg_temp.e('02')),
  row(null::uuid, 'Deleted account', 'test-fg-books', 'Books shop', 'Talked about photos.', pg_temp.a('06'))::text,
  'his own audit entries stay, as "Deleted account", with what they were about'
);
select is(
  (select row(staff_id, staff_name, action, target_kind, target_id, target_name, detail, subject_id)::text from public.audit_log where id = pg_temp.e('05')),
  row(pg_temp.a('04'), 'Zanele', 'role-given', 'account', '', 'Deleted account', '', null::uuid)::text,
  'the entry about his role stays, without his id, name or the role'
);
select is(
  pg_temp.notes('booking'),
  array['05 booking ' || pg_temp.b('02')::text || ' /hub/test-fg-oh'],
  'his notifications go; Ayanda keeps hers about the slot he accepted'
);

-- --- Zanele, an admin ----------------------------------------------------------------------------------------------

set local role service_role;
select is(
  public.forget_account(pg_temp.a('04')),
  '{}'::text[],
  'forgetting an admin gives back no paths: the Hub''s cover on her post has no owner (plan decision 6)'
);
reset role;

select is(
  (select row(author_id, cover_photo_id, published)::text from public.hub_posts where id = 'test-fg-ev'),
  row(null::uuid, pg_temp.p('09'), true)::text,
  'her event stays, unsigned, with its cover'
);
select is((select count(*) from public.photos where id = pg_temp.p('09')), 1::bigint, 'and the cover''s photo row');
select is(
  (select row(right(shop_id::text, 2), pinned_by)::text from public.featured_pins where day = '2026-10-20' and campus_slug = 'test-campus'),
  row('06', null::uuid)::text,
  'her pin stays, unsigned'
);
select is(
  (select row(status, outcome, closed_at, closed_by, target_gone)::text from public.reports where id = '60000000-0000-4000-8000-000000000103'),
  row('closed', 'dismissed', '2026-10-10T08:00Z'::timestamptz, null::uuid, true)::text,
  'the report she closed stays closed, unsigned'
);
select is(
  (select array_agg(row(right(id::text, 2), staff_id, staff_name)::text order by id) from public.audit_log where id in (pg_temp.e('01'), pg_temp.e('03'), pg_temp.e('05'))),
  array[
    row('01', null::uuid, 'Deleted account')::text, row('03', null::uuid, 'Deleted account')::text,
    row('05', null::uuid, 'Deleted account')::text
  ],
  'her audit entries stay, as "Deleted account"'
);
select is(
  (select row(action, target_kind, target_id, target_name, detail, subject_id)::text from public.audit_log where id = pg_temp.e('03')),
  row('request-hidden', 'request', 'test-fg-req2', 'Need a used textbook', 'Spam', pg_temp.a('05'))::text,
  'with what they were about, when it wasn''t her'
);
select is(
  (select row(staff_id, staff_name, target_id, target_name, detail, subject_id)::text from public.audit_log where id = pg_temp.e('06')),
  row(null::uuid, 'Deleted account', '', 'Deleted account', '', null::uuid)::text,
  'the entry she wrote about herself loses both her names, her id and the detail'
);
select is(
  (select row(author_id, author_name, owner_id)::text from public.mentor_notes where id = pg_temp.m('03')),
  row(null::uuid, 'Deleted account', pg_temp.a('06'))::text,
  'her note about Kabelo stays, as "Deleted account"'
);

-- --- What stays for the two who are left ----------------------------------------------------------------------------

select is(
  (select count(*) from public.audit_log where id in (select pg_temp.e(x) from unnest(array['01', '02', '03', '04', '05', '06']) x)),
  6::bigint,
  'the audit log has lost no entry (staff tools decision 6)'
);
select is(
  (select row(
    (select count(*) from public.shops where id = pg_temp.s('06')),
    (select count(*) from public.requests where asker_id = pg_temp.a('05')),
    (select count(*) from public.saved_searches where account_id = pg_temp.a('05')),
    (select count(*) from public.hub_rsvps where account_id = pg_temp.a('05')),
    (select count(*) from public.hub_bookings where account_id = pg_temp.a('05')),
    (select count(*) from public.reports where reporter_id in (pg_temp.a('05'), pg_temp.a('06')))
  )::text),
  row(1, 1, 1, 1, 1, 5)::text,
  'Ayanda and Kabelo keep their shop, request, saved search, RSVP, slot request and reports'
);

select * from finish();
rollback;
