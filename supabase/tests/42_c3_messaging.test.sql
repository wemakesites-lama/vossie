-- Phase C3, Task 3: the messaging SQL (C2/C3 plan decisions 18, 19 and 20): the app's first look at the message limits
-- for the signed-in account (countConversationsStartedSince and countMessagesSentSince, lib/data/messages.ts), the
-- header's unread counts without a write (unreadCounts), and each conversation's last message and unread count for the
-- inbox (getInbox).
begin;
select plan(38);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.k(n text) returns uuid language sql immutable as $f$
  select ('40000000-0000-4000-8000-0000000000' || n)::uuid;
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
-- Whether this session holds the message limits' lock on account n (private.lock_sender's two-key form).
create function pg_temp.sender_locked(n text) returns boolean language sql as $f$
  select exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and granted
      and classid = hashtext('vossie:messages:' || pg_temp.a(n)::text)::oid and objid = 1 and objsubid = 2
  );
$f$;
-- A message in conversation k, from a side, sent `ago`, read or not.
create function pg_temp.msg(k text, side text, body text, ago interval, is_read boolean) returns void language sql as $f$
  insert into public.messages (conversation_id, side, body, sent_at, read_at)
  values (pg_temp.k(k), side, body, now() - ago, case when is_read then now() - ago end);
$f$;
-- One conversation's tail as a line: 'last_body | last_side | unread'.
create function pg_temp.tail(k text) returns text language sql as $f$
  select concat_ws(' | ', t.last_body, t.last_side, t.unread::text) from public.my_conversation_tails t where t.conversation_id = pg_temp.k(k);
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('c3-campus', 'C3 campus', 'Gauteng', 97);
insert into public.categories (slug, name, sort) values ('c3-category', 'C3 category', 99);

-- People: b1 a buyer, b2 a seller with a shop, b3 a stranger.
insert into auth.users (id, email)
select pg_temp.a(n), 'c3-' || n || '@eduvos.com' from unnest(array['b1', 'b2', 'b3']) n;
insert into public.profiles (id, first_name, campus_slug) values
  (pg_temp.a('b1'), 'Buyer', 'c3-campus'), (pg_temp.a('b2'), 'Seller', 'c3-campus'), (pg_temp.a('b3'), 'Stranger', 'c3-campus');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
values ('10000000-0000-4000-8000-0000000000b2', 'c3-shop', pg_temp.a('b2'), 'Message shop', 'c3-category', 'c3-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, approved_at)
values (pg_temp.a('b2'), 'approved', '10000000-0000-4000-8000-0000000000b2', now() - interval '30 days');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at)
select 'c3-l' || n, '10000000-0000-4000-8000-0000000000b2', 'available', 'item', 'Thing ' || n, 'c3-category', 'good', 100, 'cash',
  'A thing.', 'online', 'c3-campus', now() - interval '30 days'
from generate_series(1, 4) n;
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details)
values ('c3-req', pg_temp.a('b1'), 'Need a lamp', 'c3-category', 'c3-campus', 'A lamp for late study nights.');

-- Conversations, all b1's as the buyer, with b2's shop:
-- k1 about c3-l1, 2 hours old: b1's message unread by the shop, then three from the shop unread by b1;
-- k2 a question, 30 hours old: one from the shop unread;
-- k3 an offer on b1's request, an hour old: the shop's first message, read;
-- k4 about c3-l2, 3 hours old, whose seller has gone;
-- k5 about c3-l3, a sale done a day ago; k6 about c3-l4, a sale done 8 days ago (due its auto-confirm).
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, seller_gone, status, created_at, last_message_at, completed_at, is_offer, request_id, request_title) values
  (pg_temp.k('01'), 'c3-l1', 'Thing 1', '10000000-0000-4000-8000-0000000000b2', pg_temp.a('b1'), false, 'replied', now() - interval '2 hours', now() - interval '30 minutes', null, false, null, null),
  (pg_temp.k('02'), null, null, '10000000-0000-4000-8000-0000000000b2', pg_temp.a('b1'), false, 'replied', now() - interval '30 hours', now() - interval '20 minutes', null, false, null, null),
  (pg_temp.k('03'), null, null, '10000000-0000-4000-8000-0000000000b2', pg_temp.a('b1'), false, 'offered', now() - interval '1 hour', now() - interval '1 hour', null, true, 'c3-req', 'Need a lamp'),
  (pg_temp.k('04'), 'c3-l2', 'Thing 2', '10000000-0000-4000-8000-0000000000b2', pg_temp.a('b1'), true, 'replied', now() - interval '3 hours', now() - interval '2 hours', null, false, null, null),
  (pg_temp.k('05'), 'c3-l3', 'Thing 3', '10000000-0000-4000-8000-0000000000b2', pg_temp.a('b1'), false, 'done', now() - interval '10 days', now() - interval '10 days', now() - interval '1 day', false, null, null),
  (pg_temp.k('06'), 'c3-l4', 'Thing 4', '10000000-0000-4000-8000-0000000000b2', pg_temp.a('b1'), false, 'done', now() - interval '20 days', now() - interval '20 days', now() - interval '8 days', false, null, null);
select pg_temp.msg('01', 'buyer', 'Is it still there?', interval '2 hours', false);
select pg_temp.msg('01', 'seller', 'First', interval '50 minutes', false);
select pg_temp.msg('01', 'seller', 'Second', interval '40 minutes', false);
select pg_temp.msg('01', 'seller', 'Third', interval '30 minutes', false);
select pg_temp.msg('02', 'buyer', 'Do you deliver?', interval '30 hours', true);
select pg_temp.msg('02', 'seller', 'Yes', interval '20 minutes', false);
select pg_temp.msg('03', 'seller', 'I have a lamp', interval '1 hour', true);
select pg_temp.msg('04', 'buyer', 'Hello', interval '2 hours', true);
select pg_temp.msg('04', 'seller', 'Gone now', interval '2 hours', true);
select pg_temp.msg('05', 'buyer', 'Sold?', interval '10 days', true);
select pg_temp.msg('05', 'seller', 'Sold', interval '10 days', true);
select pg_temp.msg('06', 'buyer', 'Sold?', interval '20 days', true);
select pg_temp.msg('06', 'seller', 'Sold', interval '20 days', true);
-- Notifications: b1 has a message one and two sales to confirm unread (k6's is due, so settled on any read) and one
-- read; b2 has one unread.
insert into public.notifications (account_id, kind, subject_id, text, href, read_at) values
  (pg_temp.a('b1'), 'message', pg_temp.k('01')::text, 'Message shop replied about Thing 1', '/messages/' || pg_temp.k('01'), null),
  (pg_temp.a('b1'), 'sale-to-confirm', pg_temp.k('05')::text, 'Confirm your sale', '/messages/' || pg_temp.k('05'), null),
  (pg_temp.a('b1'), 'sale-to-confirm', pg_temp.k('06')::text, 'Confirm your sale', '/messages/' || pg_temp.k('06'), null),
  (pg_temp.a('b1'), 'message', pg_temp.k('02')::text, 'Message shop replied', '/messages/' || pg_temp.k('02'), now() - interval '1 day'),
  (pg_temp.a('b2'), 'message', pg_temp.k('01')::text, 'Buyer asked about Thing 1', '/messages/' || pg_temp.k('01'), null);

-- --- my_conversations_started_since (decision 18) -------------------------------------------------------------------

select pg_temp.sign_in('b1');
select is(public.my_conversations_started_since(now() - interval '24 hours'), 2, 'enquiries and questions started in the last day, never offers');
select is(public.my_conversations_started_since(now() - interval '40 hours'), 3, 'a longer window counts the question too');
select is(public.my_conversations_started_since(now() - interval '150 minutes'), 1, 'a shorter one fewer');
select ok(not pg_temp.sender_locked('b1'), 'and no lock on the sender is taken');
select pg_temp.sign_out();
select is(
  array[private.conversations_started_since(pg_temp.a('b1'), now() - interval '24 hours'),
    private.conversations_started_since(pg_temp.a('b1'), now() - interval '40 hours'),
    private.conversations_started_since(pg_temp.a('b1'), now() - interval '150 minutes')],
  array[2, 3, 1],
  'the same as the count under the lock'
);
select pg_temp.sign_in('b3');
select is(public.my_conversations_started_since(now() - interval '24 hours'), 0, 'an account with none gets 0');
select pg_temp.sign_out();

-- --- my_messages_sent_since (decision 18) ---------------------------------------------------------------------------

select pg_temp.sign_in('b1');
select is(public.my_messages_sent_since(now() - interval '3 hours'), 2, 'the buyer''s own messages, a gone seller''s thread included');
select pg_temp.sign_out();
select pg_temp.sign_in('b2');
select is(
  public.my_messages_sent_since(now() - interval '3 hours'), 5,
  'the seller''s in its shop''s conversations, an offer''s first message included, a gone seller''s thread not'
);
select ok(not pg_temp.sender_locked('b2'), 'no lock on the sender is taken');
select pg_temp.sign_out();
select is(
  array[private.messages_sent_since(pg_temp.a('b1'), now() - interval '3 hours'),
    private.messages_sent_since(pg_temp.a('b2'), now() - interval '3 hours')],
  array[2, 5],
  'the same as the count under the lock'
);
select pg_temp.sign_in('b3');
select is(public.my_messages_sent_since(now() - interval '3 hours'), 0, 'a stranger has sent none');
select pg_temp.sign_out();

-- --- my_unread_counts (decision 19) ---------------------------------------------------------------------------------

select pg_temp.sign_in('b1');
select is((public.my_unread_counts() ->> 'messages')::int, 4, 'the other side''s unread messages: 3 in one conversation and 1 in another');
select is((public.my_unread_counts() ->> 'conversations')::int, 2, 'in 2 conversations; the buyer''s own unread one doesn''t count');
select is((public.my_unread_counts() ->> 'sales_to_confirm')::int, 1, 'a sale done a day ago is to confirm; one done 8 days ago isn''t');
select is((public.my_unread_counts() ->> 'notifications')::int, 2, 'the unread notifications, less the due sale''s');
select ok(not pg_temp.sender_locked('b1'), 'and nothing is locked');
select pg_temp.sign_out();
select is(
  (select array_agg(c.status order by c.id) from public.conversations c where c.id in (pg_temp.k('05'), pg_temp.k('06'))),
  array['done', 'done'],
  'and nothing is written: the due sale is still done'
);
select is(
  (select read_at from public.notifications where subject_id = pg_temp.k('06')::text), null,
  'and its notification still unread'
);
select pg_temp.sign_in('b2');
select is(
  public.my_unread_counts(),
  '{"messages": 1, "conversations": 1, "sales_to_confirm": 0, "notifications": 1}'::jsonb,
  'the seller: the buyer''s unread message, none of its own sales to confirm, its own notification'
);
select pg_temp.sign_out();
select pg_temp.sign_in('b3');
select is(
  public.my_unread_counts(),
  '{"messages": 0, "conversations": 0, "sales_to_confirm": 0, "notifications": 0}'::jsonb,
  'a stranger has nothing'
);
select pg_temp.sign_out();

-- --- my_conversation_tails (decision 20) ---------------------------------------------------------------------------

select pg_temp.sign_in('b1');
select is((select count(*) from public.my_conversation_tails), 6::bigint, 'one row for each of the reader''s conversations');
select is(pg_temp.tail('01'), 'Third | seller | 3', 'the newest message, its side, and the other side''s unread count');
select is(pg_temp.tail('02'), 'Yes | seller | 1', 'another');
select is(pg_temp.tail('03'), 'I have a lamp | seller | 0', 'an offer read already');
select is(
  (select last_sent_at from public.my_conversation_tails where conversation_id = pg_temp.k('02')),
  (select max(sent_at) from public.messages where conversation_id = pg_temp.k('02')),
  'and when it was sent'
);
select pg_temp.sign_out();
select pg_temp.sign_in('b2');
select is((select count(*) from public.my_conversation_tails), 5::bigint, 'the seller''s, less the one whose seller has gone');
select is(pg_temp.tail('01'), 'Third | seller | 1', 'the shop''s own unread messages don''t count, the buyer''s do');
select pg_temp.sign_out();
select pg_temp.sign_in('b3');
select is((select count(*) from public.my_conversation_tails), 0::bigint, 'a stranger sees none');
select pg_temp.sign_out();
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.my_conversation_tails'::regclass),
  'the view is security_invoker'
);
select ok(
  has_table_privilege('authenticated', 'public.my_conversation_tails', 'select')
  and has_table_privilege('service_role', 'public.my_conversation_tails', 'select')
  and not has_table_privilege('anon', 'public.my_conversation_tails', 'select'),
  'select for signed-in people and the server, not anon'
);
select ok(
  not has_table_privilege('authenticated', 'public.my_conversation_tails', 'insert, update, delete, truncate'),
  'and no write'
);

-- --- Grants ------------------------------------------------------------------------------------------------------------

select is(
  array(
    select f from unnest(array[
      'public.my_conversations_started_since(timestamp with time zone)',
      'public.my_messages_sent_since(timestamp with time zone)', 'public.my_unread_counts()'
    ]) f
    where has_function_privilege('anon', f, 'execute')
      or not has_function_privilege('authenticated', f, 'execute')
      or not has_function_privilege('service_role', f, 'execute')
  ),
  '{}'::text[],
  'the three run for signed-in people and the server, never anon'
);
set local role anon;
select throws_ok($$select public.my_conversations_started_since(now())$$, '42501', null, 'anon can''t count conversations');
select throws_ok($$select public.my_messages_sent_since(now())$$, '42501', null, 'nor messages');
select throws_ok($$select public.my_unread_counts()$$, '42501', null, 'nor read unread counts');
select throws_ok($$select * from public.my_conversation_tails$$, '42501', null, 'nor the tails');
reset role;

-- The lock check above can see the lock: the limits' own check takes it.
select pg_temp.sign_in('b3');
reset role;
select is(private.message_limit_error(pg_temp.a('b3'), false), null, 'the check under the lock lets a stranger send');
select ok(pg_temp.sender_locked('b3'), 'and holds the sender''s lock, which the checks above would have seen');
select pg_temp.sign_out();

select * from finish();
rollback;
