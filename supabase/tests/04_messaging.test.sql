-- Task 7: conversations, messages, notifications and reports (supabase foundation plan; lib/data/messages.ts sideOf).
begin;
select plan(53);

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
create function pg_temp.side_as(account uuid, conv uuid) returns text language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', account, 'role', 'authenticated')::text, true);
  return private.conversation_side(conv);
end;
$f$;

insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
-- Buyer (21), seller (22), stranger (23), the shop's next owner (24).
insert into auth.users (id, email)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'user' || n || '@eduvos.com' from unnest(array['21', '22', '23', '24']) n;
insert into public.profiles (id, first_name, campus_slug)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'User ' || n, 'test-campus' from unnest(array['21', '22', '23', '24']) n;
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  ('10000000-0000-4000-8000-000000000021', 'test-shop', '00000000-0000-4000-8000-000000000022', 'Test shop', 'test-category', 'test-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id) values
  ('00000000-0000-4000-8000-000000000022', 'approved', '10000000-0000-4000-8000-000000000021');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('l-m1', '10000000-0000-4000-8000-000000000021', 'available', 'item', 'Lamp', 'test-category', 'good', 100, 'cash', 'A lamp.', 'online', 'test-campus', now()),
  ('l-m2', '10000000-0000-4000-8000-000000000021', 'available', 'item', 'Desk', 'test-category', 'good', 300, 'cash', 'A desk.', 'online', 'test-campus', now());

-- A conversation about a listing, and a question about the shop, both started by the buyer.
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, status) values
  ('40000000-0000-4000-8000-000000000001', 'l-m1', 'Lamp', '10000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000021', 'replied'),
  ('40000000-0000-4000-8000-000000000002', null, null, '10000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000021', 'asked');
insert into public.messages (conversation_id, side, body) values
  ('40000000-0000-4000-8000-000000000001', 'buyer', 'Is the lamp still there?'),
  ('40000000-0000-4000-8000-000000000001', 'seller', 'It is.'),
  ('40000000-0000-4000-8000-000000000002', 'buyer', 'Do you deliver?');
insert into public.notifications (account_id, kind, subject_id, text, href) values
  ('00000000-0000-4000-8000-000000000021', 'message', '40000000-0000-4000-8000-000000000001', 'Test shop replied about Lamp', '/messages/x'),
  ('00000000-0000-4000-8000-000000000022', 'message', '40000000-0000-4000-8000-000000000002', 'A buyer asked a question', '/messages/y');
insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values
  ('00000000-0000-4000-8000-000000000021', 'listing', 'l-m2', 'Desk', 'misleading');

-- Sides (sideOf).
select is(pg_temp.side_as('00000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000001'), 'buyer', 'the buyer is the buyer');
select is(pg_temp.side_as('00000000-0000-4000-8000-000000000022', '40000000-0000-4000-8000-000000000001'), 'seller', 'the shop''s owner is the seller');
select is(pg_temp.side_as('00000000-0000-4000-8000-000000000023', '40000000-0000-4000-8000-000000000001'), null, 'a stranger has no side');
select set_config('request.jwt.claims', '', true);
select is(private.conversation_side('40000000-0000-4000-8000-000000000001'), null, 'no one signed in has no side');

-- anon reads none of it.
set local role anon;
select throws_ok($$select * from public.conversations$$, '42501', null, 'anon cannot read conversations');
select throws_ok($$select * from public.messages$$, '42501', null, 'anon cannot read messages');
select throws_ok($$select * from public.notifications$$, '42501', null, 'anon cannot read notifications');
select throws_ok($$select * from public.reports$$, '42501', null, 'anon cannot read reports');
reset role;

-- The buyer and the shop's owner see the thread; a stranger doesn't.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000021');
select is((select count(*) from public.conversations where shop_id = '10000000-0000-4000-8000-000000000021'), 2::bigint, 'the buyer sees their conversations');
select is((select count(*) from public.messages where conversation_id = '40000000-0000-4000-8000-000000000001'), 2::bigint, 'and their messages');
select is((select array_agg(text) from public.notifications), array['Test shop replied about Lamp'], 'the buyer reads only their own notifications');
select is((select array_agg(target_title) from public.reports), array['Desk'], 'a reporter reads their own reports');
select throws_ok(
  $$insert into public.messages (conversation_id, side, body) values ('40000000-0000-4000-8000-000000000001', 'buyer', 'Hi')$$,
  '42501', null, 'a buyer cannot write a message directly (Task 9''s send_message does)'
);
select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, status) values ('10000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000021', 'asked')$$,
  '42501', null, 'a buyer cannot start a conversation directly'
);
select throws_ok($$update public.conversations set status = 'confirmed'$$, '42501', null, 'a buyer cannot change a conversation directly');
select throws_ok($$update public.notifications set read_at = now()$$, '42501', null, 'notifications are marked read by functions only');
select throws_ok(
  $$insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values ('00000000-0000-4000-8000-000000000021', 'listing', 'l-m1', 'Lamp', 'spam')$$,
  '42501', null, 'a report is made by create_report only'
);
select throws_ok($$delete from public.messages$$, '42501', null, 'messages cannot be deleted directly');
select pg_temp.sign_out();

select pg_temp.sign_in('00000000-0000-4000-8000-000000000022');
select is((select count(*) from public.conversations where shop_id = '10000000-0000-4000-8000-000000000021'), 2::bigint, 'the shop''s owner sees its conversations');
select is((select count(*) from public.messages where conversation_id = '40000000-0000-4000-8000-000000000002'), 1::bigint, 'and their messages');
select is((select array_agg(text) from public.notifications), array['A buyer asked a question'], 'notifications are private to their account');
select is((select count(*) from public.reports), 0::bigint, 'the seller cannot read reports about their listing');
select pg_temp.sign_out();

select pg_temp.sign_in('00000000-0000-4000-8000-000000000023');
select is((select count(*) from public.conversations), 0::bigint, 'a stranger sees no conversations');
select is((select count(*) from public.messages), 0::bigint, 'and no messages');
select is((select count(*) from public.notifications), 0::bigint, 'and no notifications');
select pg_temp.sign_out();

-- After a slug change the owner still sees the thread: it points at the shop's id, not its slug.
update public.shops set slug = 'renamed-shop', slug_changed = true where id = '10000000-0000-4000-8000-000000000021';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000022');
select is((select count(*) from public.conversations where id = '40000000-0000-4000-8000-000000000001'), 1::bigint, 'after a slug change the owner still sees the thread');
select pg_temp.sign_out();

-- Whoever owns the shop now answers for it (messaging plan decision 1).
update public.seller_profiles set shop_id = null where account_id = '00000000-0000-4000-8000-000000000022';
insert into public.seller_profiles (account_id, status, shop_id) values
  ('00000000-0000-4000-8000-000000000024', 'approved', '10000000-0000-4000-8000-000000000021');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000024');
select is((select count(*) from public.conversations where id = '40000000-0000-4000-8000-000000000001'), 1::bigint, 'the shop''s new owner sees the thread');
select is((select count(*) from public.messages where conversation_id = '40000000-0000-4000-8000-000000000001'), 2::bigint, 'and its messages');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000022');
select is((select count(*) from public.conversations), 0::bigint, 'the old owner no longer does');
select pg_temp.sign_out();

-- A seller who has gone doesn't see it; the buyer still does.
update public.conversations set seller_gone = true where id = '40000000-0000-4000-8000-000000000001';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000024');
select is((select count(*) from public.conversations where id = '40000000-0000-4000-8000-000000000001'), 0::bigint, 'a seller who has gone doesn''t see the thread');
select is((select count(*) from public.messages where conversation_id = '40000000-0000-4000-8000-000000000001'), 0::bigint, 'or its messages');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000021');
select is((select count(*) from public.conversations where id = '40000000-0000-4000-8000-000000000001'), 1::bigint, 'the buyer still does');
select pg_temp.sign_out();

-- One open conversation per buyer and listing, and one question per buyer and shop.
select lives_ok(
  $$insert into public.conversations (listing_id, listing_title, shop_id, buyer_id, status) values ('l-m1', 'Lamp', '10000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000021', 'asked')$$,
  'once the seller has gone, the buyer can start a new conversation about the listing'
);
select throws_ok(
  $$insert into public.conversations (listing_id, listing_title, shop_id, buyer_id, status) values ('l-m1', 'Lamp', '10000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000021', 'asked')$$,
  '23505', null, 'one open conversation per buyer and listing'
);
select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, status) values ('10000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000021', 'asked')$$,
  '23505', null, 'one open question per buyer and shop'
);

-- A listing that goes leaves its conversation, with its title, and doesn't count as a question about the shop.
insert into public.conversations (listing_id, listing_title, shop_id, buyer_id, status) values
  ('l-m2', 'Desk', '10000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000021', 'asked');
select lives_ok($$delete from public.listings where id = 'l-m2'$$, 'a listing with a conversation can be deleted, beside an open question');
select is(
  (select listing_title from public.conversations where listing_title = 'Desk' and listing_id is null),
  'Desk',
  'the conversation keeps the listing''s title'
);

-- The checks.
select throws_ok(
  $$insert into public.messages (conversation_id, side, body) values ('40000000-0000-4000-8000-000000000002', 'buyer', '')$$,
  '23514', null, 'a message is not empty'
);
select throws_ok(
  format($$insert into public.messages (conversation_id, side, body) values ('40000000-0000-4000-8000-000000000002', 'buyer', %L)$$, repeat('a', 1001)),
  '23514', null, 'a message is at most 1,000 characters'
);
select throws_ok(
  $$insert into public.messages (conversation_id, side, body) values ('40000000-0000-4000-8000-000000000002', 'admin', 'Hi')$$,
  '23514', null, 'a message is from the buyer or the seller'
);
select throws_ok(
  format($$insert into public.messages (conversation_id, side, body, swap_offer) values ('40000000-0000-4000-8000-000000000002', 'buyer', 'Hi', %L)$$, repeat('a', 201)),
  '23514', null, 'a swap offer is at most 200 characters'
);
select throws_ok($$update public.conversations set status = 'open'$$, '23514', null, 'a status is asked, replied, done or confirmed');
select throws_ok(
  $$update public.conversations set status = 'confirmed' where id = '40000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'a confirmed sale says when and by whom'
);
select throws_ok(
  $$insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values ('00000000-0000-4000-8000-000000000023', 'listing', 'l-m1', 'Lamp', 'rude')$$,
  '23514', null, 'a report has one of the seven reasons'
);
select throws_ok(
  format($$insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, detail) values ('00000000-0000-4000-8000-000000000023', 'listing', 'l-m1', 'Lamp', 'spam', %L)$$, repeat('a', 501)),
  '23514', null, 'a report''s detail is at most 500 characters'
);
select throws_ok(
  $$insert into public.notifications (account_id, kind, subject_id, text, href) values ('00000000-0000-4000-8000-000000000023', 'party', 'x', 'x', '/x')$$,
  '23514', null, 'a notification is one of the four kinds'
);
select throws_ok(
  $$insert into public.notifications (account_id, kind, subject_id, text, href) values ('00000000-0000-4000-8000-000000000023', 'message', 'x', 'x', 'https://elsewhere.example')$$,
  '23514', null, 'a notification links within Vossie'
);

-- One unread message notification per conversation, and one open report per target.
select throws_ok(
  $$insert into public.notifications (account_id, kind, subject_id, text, href) values ('00000000-0000-4000-8000-000000000021', 'message', '40000000-0000-4000-8000-000000000001', 'Again', '/messages/x')$$,
  '23505', null, 'one unread message notification per account and conversation'
);
update public.notifications set read_at = now() where account_id = '00000000-0000-4000-8000-000000000021';
select lives_ok(
  $$insert into public.notifications (account_id, kind, subject_id, text, href) values ('00000000-0000-4000-8000-000000000021', 'message', '40000000-0000-4000-8000-000000000001', 'Again', '/messages/x')$$,
  'a new one once the last is read'
);
select throws_ok(
  $$insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values ('00000000-0000-4000-8000-000000000021', 'listing', 'l-m2', 'Desk', 'spam')$$,
  '23505', null, 'one open report per reporter and target'
);
update public.reports set status = 'closed', outcome = 'dismissed', closed_at = now() where reporter_id = '00000000-0000-4000-8000-000000000021';
select lives_ok(
  $$insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values ('00000000-0000-4000-8000-000000000021', 'listing', 'l-m2', 'Desk', 'spam')$$,
  'a new report once the last is closed'
);

-- Deleting accounts and shops: the other side keeps the conversation.
delete from auth.users where id = '00000000-0000-4000-8000-000000000021';
select is(
  (select count(*) from public.conversations where buyer_id is null and shop_id = '10000000-0000-4000-8000-000000000021'),
  4::bigint,
  'a buyer who deletes their account leaves the conversations, without a buyer'
);
delete from public.shops where id = '10000000-0000-4000-8000-000000000021';
select is(
  (select count(*) from public.conversations where shop_id is null),
  4::bigint,
  'a shop that goes leaves its conversations, without a shop'
);

select * from finish();
rollback;
