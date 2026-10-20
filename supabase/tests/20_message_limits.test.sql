-- Schema catch-up, Task 9: stage K's message limits (lib/messaging/limits.ts messageLimitErrors; lib/messaging/rules.ts
-- CONVERSATIONS_PER_DAY = 40 and MESSAGES_PER_HOUR = 120; countConversationsStartedSince and countMessagesSentSince,
-- lib/data/messages.ts:176-200), in start_conversation, send_message and start_offer, counted under an advisory lock on
-- the sender. No sample-account exemption (plan decision 9). Also create_report's refusal of a hidden listing, as
-- reportSubject does through publicListing (lib/data/catalog.ts:114; found in Task 6b).
-- Rows older than the test are inserted directly to reach the limits. Inside the test's transaction now() stands still,
-- so "exactly 24 hours (or an hour) old" is exact.
begin;
select plan(53);

-- Accounts and shops by their last two characters; a signed-in session per account.
create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.c(n text) returns uuid language sql immutable as $f$
  select ('20000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.sign_in_as(account uuid) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', account, 'role', 'authenticated', 'session_id', gen_random_uuid())::text,
    true
  );
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_in(n text) returns void language sql as $f$
  select pg_temp.sign_in_as(pg_temp.a(n));
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;
-- Whether this session holds the message limits' advisory lock on an account: the two-key form, second key 1, a
-- namespace no other Vossie lock uses (they use 0, or the one-key form).
create function pg_temp.locked(account uuid) returns boolean language sql as $f$
  select exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and granted
      and classid = hashtext('vossie:messages:' || account::text)::oid and objid = 1 and objsubid = 2
  );
$f$;
-- `n` messages on one side of a conversation, sent `every` apart, the newest `newest` ago.
create function pg_temp.messages(conv uuid, side text, n int, newest interval, every interval) returns void
language sql as $f$
  insert into public.messages (conversation_id, side, body, sent_at)
  select conv, side, 'Old message ' || g, now() - newest - (g - 1) * every from generate_series(1, n) g;
$f$;
create function pg_temp.sent(account uuid) returns int language sql as $f$
  select private.messages_sent_since(account, now() - interval '1 hour');
$f$;
grant execute on all functions in schema pg_temp to public;

-- Places.
insert into public.campuses (slug, name, region, sort) values ('ml-campus', 'Limits campus', 'Gauteng', 97);
insert into public.categories (slug, name, sort) values ('ml-category', 'Limits category', 98);

-- People:
-- e1 Ayanda, a buyer near the conversations limit;  e2 Lwazi, an open shop (Lwazi lamps);
-- e3 Palesa, a buyer near the messages limit;       e4 Musa, a student who asks;
-- e5 Sizwe, an open shop (Sizwe bags);              e6 Nomsa, a buyer;
-- e7 Thabo, an open shop (Thabo mugs) near both of start_offer's limits.
insert into auth.users (id, email)
select pg_temp.a(n), 'ml-' || n || '@eduvos.com' from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7']) n;
insert into public.profiles (id, first_name, campus_slug) values
  (pg_temp.a('e1'), 'Ayanda', 'ml-campus'), (pg_temp.a('e2'), 'Lwazi', 'ml-campus'),
  (pg_temp.a('e3'), 'Palesa', 'ml-campus'), (pg_temp.a('e4'), 'Musa', 'ml-campus'),
  (pg_temp.a('e5'), 'Sizwe', 'ml-campus'), (pg_temp.a('e6'), 'Nomsa', 'ml-campus'),
  (pg_temp.a('e7'), 'Thabo', 'ml-campus');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('e2'), 'ml-lwazi', pg_temp.a('e2'), 'Lwazi lamps', 'ml-category', 'ml-campus', '2026-01'),
  (pg_temp.s('e5'), 'ml-sizwe', pg_temp.a('e5'), 'Sizwe bags', 'ml-category', 'ml-campus', '2026-01'),
  (pg_temp.s('e7'), 'ml-thabo', pg_temp.a('e7'), 'Thabo mugs', 'ml-category', 'ml-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, paused_by, approved_at)
select pg_temp.a(n), 'approved', pg_temp.s(n), now() - interval '9 days', null, now() - interval '8 days'
from unnest(array['e2', 'e5', 'e7']) n;
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at, hidden_at, hidden_reason)
select l.id, pg_temp.s('e2'), 'available', 'item', l.title, 'ml-category', 'good', 100, 'cash', 'A lamp.', 'online',
  'ml-campus', now() - interval '5 days', l.hidden_at, l.hidden_reason
from (values
  ('ml-l1', 'Desk lamp', null::timestamptz, null::text),
  ('ml-l2', 'Floor lamp', null, null),
  ('ml-l3', 'Reading lamp', null, null),
  ('ml-l-hidden', 'Hidden lamp', now() - interval '1 day', 'Fake.')
) as l(id, title, hidden_at, hidden_reason);
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, status, created_at) values
  ('ml-r1', pg_temp.a('e4'), 'Need a mug', 'ml-category', 'ml-campus', 'A mug for the residence.', 'open', now() - interval '3 days'),
  ('ml-r2', pg_temp.a('e4'), 'Need a flask', 'ml-category', 'ml-campus', 'A flask for long days.', 'open', now() - interval '3 days');

-- --- The functions' access stays as it was ----------------------------------------------------------------------------

select ok(
  has_function_privilege('authenticated', 'public.start_conversation(text, text, text, text)', 'execute')
    and has_function_privilege('authenticated', 'public.send_message(uuid, text)', 'execute')
    and has_function_privilege('authenticated', 'public.start_offer(text, text, text)', 'execute')
    and has_function_privilege('authenticated', 'public.create_report(text, text, text, text, text)', 'execute'),
  'signed-in students still run the four replaced functions'
);
select ok(
  not has_function_privilege('anon', 'public.start_conversation(text, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.send_message(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.start_offer(text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.create_report(text, text, text, text, text)', 'execute'),
  'anon still runs none of them'
);
select ok(
  not exists (
    select 1
    from unnest(array[
      'private.lock_sender(uuid)', 'private.conversations_started_since(uuid, timestamp with time zone)',
      'private.messages_sent_since(uuid, timestamp with time zone)', 'private.message_limit_error(uuid, boolean)'
    ]) f, unnest(array['anon', 'authenticated', 'service_role']) r
    where has_function_privilege(r, f, 'execute')
  ),
  'the limits'' helpers run only inside the functions'
);

-- --- 40 conversations in any 24 hours (CONVERSATIONS_PER_DAY) -----------------------------------------------------------

-- Ayanda has started 39 in the last 24 hours: 38 about listings since gone, and one 23 hours 59 minutes 59 seconds ago
-- (Edge). Not counted: one exactly 24 hours old, an offer made to her as an asker, and Nomsa's.
insert into public.conversations (shop_id, buyer_id, listing_title, status, created_at)
select pg_temp.s('e2'), pg_temp.a('e1'), 'Old thing ' || g, 'asked', now() - g * interval '30 minutes'
from generate_series(1, 38) g;
insert into public.conversations (id, shop_id, buyer_id, listing_title, status, created_at) values
  (pg_temp.c('a1'), pg_temp.s('e2'), pg_temp.a('e1'), 'Edge thing', 'asked', now() - interval '23 hours 59 minutes 59 seconds'),
  (pg_temp.c('a2'), pg_temp.s('e2'), pg_temp.a('e1'), 'Outside thing', 'asked', now() - interval '24 hours'),
  (pg_temp.c('a3'), pg_temp.s('e2'), pg_temp.a('e6'), 'Nomsa''s thing', 'asked', now());
insert into public.conversations (shop_id, buyer_id, status, is_offer, request_title, created_at) values
  (pg_temp.s('e2'), pg_temp.a('e1'), 'offered', true, 'An old ask', now());

select is(
  private.conversations_started_since(pg_temp.a('e1'), now() - interval '24 hours'), 39,
  'Ayanda has started 39: an offer to her and a conversation exactly 24 hours old aren''t counted'
);
select ok(not pg_temp.locked(pg_temp.a('e1')), 'nothing holds Ayanda''s lock yet');
select pg_temp.sign_in('e1');
select is(
  public.start_conversation('ml-l1', null, 'Is the desk lamp still there?', null) ->> 'result', 'started',
  'her 40th conversation in 24 hours starts'
);
select pg_temp.sign_out();
select ok(pg_temp.locked(pg_temp.a('e1')), 'start_conversation took the lock on its sender');
select pg_temp.sign_in('e1');
select is(
  public.start_conversation('ml-l2', null, 'And the floor lamp?', null), '{"result": "conversation-rate"}'::jsonb,
  'her 41st is refused with conversation-rate'
);
select is(
  public.start_conversation(null, 'ml-lwazi', 'Do you deliver?', null), '{"result": "conversation-rate"}'::jsonb,
  'so is a new question to the shop'
);
select is(
  public.start_conversation('ml-l1', null, 'I can collect today.', null) ->> 'result', 'added',
  'a message in the conversation she already has starts nothing, so it goes'
);
select pg_temp.sign_out();
select is(
  (select count(*)::int from public.conversations c
   where c.buyer_id = pg_temp.a('e1') and not c.is_offer
     and (c.listing_id = 'ml-l2' or (c.shop_id = pg_temp.s('e2') and c.listing_title is null))),
  0,
  'the refusals wrote no conversation'
);
select is(
  (select count(*)::int from public.messages m
   where m.body in ('And the floor lamp?', 'Do you deliver?')),
  0,
  'and no message'
);

-- The window slides: once Edge is 24 hours old, a place is free again.
update public.conversations set created_at = now() - interval '24 hours' where id = pg_temp.c('a1');
select pg_temp.sign_in('e1');
select is(
  public.start_conversation('ml-l2', null, 'And the floor lamp?', null) ->> 'result', 'started',
  'once her oldest is 24 hours old, a new one starts'
);
select is(
  public.start_conversation('ml-l3', null, 'And the reading lamp?', null), '{"result": "conversation-rate"}'::jsonb,
  'and the next is refused again'
);
select pg_temp.sign_out();

-- Both limits met: the conversations limit is checked first, and only for a post that starts a conversation.
select pg_temp.messages(pg_temp.c('a2'), 'buyer', 117, interval '1 minute', interval '10 seconds');
select is(pg_temp.sent(pg_temp.a('e1')), 120, 'Ayanda has sent 120 messages in the hour');
select pg_temp.sign_in('e1');
select is(
  public.start_conversation('ml-l3', null, 'And the reading lamp?', null), '{"result": "conversation-rate"}'::jsonb,
  'a new conversation meets the conversations limit first'
);
select is(
  public.start_conversation('ml-l1', null, 'Still keen.', null), '{"result": "message-rate"}'::jsonb,
  'a message in her existing one meets the messages limit'
);
select pg_temp.sign_out();

-- --- 120 messages in any hour (MESSAGES_PER_HOUR) -------------------------------------------------------------------

-- Palesa's conversation about the reading lamp: 119 of her messages in the last hour, one exactly an hour old and one
-- 61 minutes old (not counted), and Lwazi's five replies (his, not hers).
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, status, created_at) values
  (pg_temp.c('b1'), 'ml-l3', 'Reading lamp', pg_temp.s('e2'), pg_temp.a('e3'), 'replied', now() - interval '2 days');
select pg_temp.messages(pg_temp.c('b1'), 'buyer', 119, interval '30 seconds', interval '29 seconds');
insert into public.messages (id, conversation_id, side, body, sent_at) values
  (pg_temp.c('b2'), pg_temp.c('b1'), 'buyer', 'An hour ago.', now() - interval '1 hour'),
  (pg_temp.c('b3'), pg_temp.c('b1'), 'buyer', 'Earlier.', now() - interval '61 minutes');
select pg_temp.messages(pg_temp.c('b1'), 'seller', 5, interval '1 minute', interval '1 minute');

select is(
  pg_temp.sent(pg_temp.a('e3')), 119,
  'Palesa has sent 119 in the hour: one exactly an hour old, one 61 minutes old and the shop''s aren''t hers'
);
select ok(not pg_temp.locked(pg_temp.a('e3')), 'nothing holds Palesa''s lock yet');
select pg_temp.sign_in('e3');
select is(public.send_message(pg_temp.c('b1'), 'Is it still there?'), 'sent', 'her 120th message in the hour goes');
select pg_temp.sign_out();
select ok(pg_temp.locked(pg_temp.a('e3')), 'send_message took the lock on its sender');
select pg_temp.sign_in('e3');
select is(public.send_message(pg_temp.c('b1'), 'Hello?'), 'message-rate', 'her 121st is refused with message-rate');
select is(
  public.start_conversation('ml-l3', null, 'Hello?', null), '{"result": "message-rate"}'::jsonb,
  'as is a first message that joins her conversation'
);
select is(
  public.start_conversation('ml-l2', null, 'Hello?', null), '{"result": "message-rate"}'::jsonb,
  'and one that would start a new one'
);
select pg_temp.sign_out();
select is(
  (select count(*)::int from public.messages m where m.body = 'Hello?'), 0, 'the refusals wrote no message'
);
select is(
  (select count(*)::int from public.conversations c where c.buyer_id = pg_temp.a('e3')), 1,
  'and no conversation'
);

-- The window slides: once her oldest counted message is 61 minutes old, the next goes.
update public.messages set sent_at = now() - interval '61 minutes'
where id = (
  select m.id from public.messages m
  where m.conversation_id = pg_temp.c('b1') and m.side = 'buyer' and m.sent_at > now() - interval '1 hour'
  order by m.sent_at limit 1
);
select pg_temp.sign_in('e3');
select is(public.send_message(pg_temp.c('b1'), 'Hello?'), 'sent', 'once her oldest is 61 minutes old, the next goes');
select is(public.send_message(pg_temp.c('b1'), 'Hello again?'), 'message-rate', 'and the one after is refused');
select pg_temp.sign_out();

-- --- A shop's messages are its owner's ------------------------------------------------------------------------------

-- Sizwe's shop: 100 replies to Nomsa (her 10 messages are hers), an offer's first message, ten replies in a thread whose
-- seller has gone (an earlier owner's: no one answers for the shop there), and his own 18 as a buyer from Lwazi.
insert into public.conversations (id, listing_title, shop_id, buyer_id, status, seller_gone, is_offer, request_title, created_at) values
  (pg_temp.c('c1'), 'Bag', pg_temp.s('e5'), pg_temp.a('e6'), 'replied', false, false, null, now() - interval '2 days'),
  (pg_temp.c('c2'), 'Hat', pg_temp.s('e5'), pg_temp.a('e4'), 'replied', true, false, null, now() - interval '2 days'),
  (pg_temp.c('c3'), 'Pen', pg_temp.s('e2'), pg_temp.a('e5'), 'replied', false, false, null, now() - interval '2 days'),
  (pg_temp.c('c4'), null, pg_temp.s('e5'), pg_temp.a('e4'), 'offered', false, true, 'An old ask', now() - interval '2 hours');
select pg_temp.messages(pg_temp.c('c1'), 'seller', 100, interval '1 minute', interval '20 seconds');
select pg_temp.messages(pg_temp.c('c1'), 'buyer', 10, interval '1 minute', interval '20 seconds');
select pg_temp.messages(pg_temp.c('c2'), 'seller', 10, interval '1 minute', interval '20 seconds');
select pg_temp.messages(pg_temp.c('c3'), 'buyer', 18, interval '1 minute', interval '20 seconds');
select pg_temp.messages(pg_temp.c('c3'), 'seller', 3, interval '1 minute', interval '20 seconds');
select pg_temp.messages(pg_temp.c('c4'), 'seller', 1, interval '50 minutes', interval '1 minute');

select is(
  pg_temp.sent(pg_temp.a('e5')), 119,
  'Sizwe has sent 119: his shop''s replies and its offer''s first message, and his own as a buyer'
);
select is(pg_temp.sent(pg_temp.a('e6')), 10, 'Nomsa has sent her 10, never the shop''s replies to her');
select pg_temp.sign_in('e5');
select is(public.send_message(pg_temp.c('c1'), 'It is still here.'), 'sent', 'Sizwe''s 120th, as the shop, goes');
select is(public.send_message(pg_temp.c('c1'), 'Collect any time.'), 'message-rate', 'his 121st is refused');
select is(
  public.start_conversation('ml-l1', null, 'Is the desk lamp still there?', null), '{"result": "message-rate"}'::jsonb,
  'his shop''s messages count when he writes as a buyer too'
);
select pg_temp.sign_out();
select is(pg_temp.sent(pg_temp.a('e6')), 10, 'and still none of them are Nomsa''s');
update public.conversations set seller_gone = true where id = pg_temp.c('c1');
select is(
  pg_temp.sent(pg_temp.a('e5')), 19, 'once the seller has gone from a thread, its replies no longer count for him'
);

-- --- start_offer: the 20 offers a day, then the hour's messages -----------------------------------------------------------

-- Thabo's shop has made 20 offers in the last 24 hours, each with its first message, and sent 100 replies to Nomsa
-- about a mug: 120 messages in the hour.
insert into public.conversations (id, listing_title, shop_id, buyer_id, status, created_at) values
  (pg_temp.c('d1'), 'Mug', pg_temp.s('e7'), pg_temp.a('e6'), 'replied', now() - interval '2 days');
insert into public.conversations (id, shop_id, buyer_id, status, is_offer, request_title, created_at)
select ('20000000-0000-4000-8000-0000000d' || lpad(g::text, 4, '0'))::uuid, pg_temp.s('e7'), pg_temp.a('e4'),
  'offered', true, 'Old ask ' || g, now() - g * interval '1 hour'
from generate_series(1, 20) g;
insert into public.messages (conversation_id, side, body, sent_at)
select ('20000000-0000-4000-8000-0000000d' || lpad(g::text, 4, '0'))::uuid, 'seller', 'An offer.', now() - g * interval '2 minutes'
from generate_series(1, 20) g;
select pg_temp.messages(pg_temp.c('d1'), 'seller', 100, interval '50 minutes', interval '1 second');

select is(pg_temp.sent(pg_temp.a('e7')), 120, 'Thabo has sent 120, his offers'' first messages among them');
select pg_temp.sign_in('e7');
select is(
  public.start_offer('ml-r1', null, 'I have mugs.'), '{"result": "offer-rate"}'::jsonb,
  'with both limits met, the 20 offers a day is checked first'
);
select pg_temp.sign_out();
update public.conversations set created_at = now() - interval '24 hours'
where id = '20000000-0000-4000-8000-0000000d0020';
select pg_temp.sign_in('e7');
select is(
  public.start_offer('ml-r1', null, 'I have mugs.'), '{"result": "message-rate"}'::jsonb,
  'with 19 offers in 24 hours, the hour''s messages refuse it'
);
select pg_temp.sign_out();
select ok(pg_temp.locked(pg_temp.a('e7')), 'start_offer took the lock on its sender');
select is(
  (select count(*)::int from public.conversations c where c.request_id = 'ml-r1'), 0, 'the refusal wrote no offer'
);
select is(
  (select count(*)::int from public.messages m where m.body = 'I have mugs.'), 0, 'and no message'
);
update public.messages set sent_at = now() - interval '61 minutes'
where id = (select m.id from public.messages m where m.conversation_id = pg_temp.c('d1') order by m.sent_at limit 1);
select pg_temp.sign_in('e7');
select is(
  public.start_offer('ml-r1', null, 'I have mugs.') ->> 'result', 'offered', 'with 119 in the hour, the offer is made'
);
select pg_temp.sign_out();
select is(pg_temp.sent(pg_temp.a('e7')), 120, 'its first message counts for the shop');
select pg_temp.sign_in('e7');
select is(public.send_message(pg_temp.c('d1'), 'Enjoy the mug.'), 'message-rate', 'so Thabo''s next reply is refused');
select is(
  public.start_offer('ml-r2', null, 'Flasks too.'), '{"result": "offer-rate"}'::jsonb,
  'and his next offer meets the 20 a day again'
);
select pg_temp.sign_out();

-- --- Every account, the sample accounts included (plan decision 9) ---------------------------------------------------

insert into public.conversations (id, listing_title, shop_id, buyer_id, status, created_at)
select pg_temp.c('f1'), 'Sample thing', pg_temp.s('e2'), u.id, 'replied', now() - interval '2 days'
from auth.users u where u.email = 'student@vossie.test';
select pg_temp.messages(pg_temp.c('f1'), 'buyer', 120, interval '1 minute', interval '10 seconds');
select pg_temp.sign_in_as((select id from auth.users where email = 'student@vossie.test'));
select is(
  public.send_message(pg_temp.c('f1'), 'One more.'), 'message-rate', 'the sample student meets the limit like anyone'
);
select pg_temp.sign_out();

-- --- Shape -------------------------------------------------------------------------------------------------------

-- The limits are counted under the lock, and send_message takes it before it locks the conversation's row, as
-- start_conversation does, so two posts by one sender can't wait on each other.
select ok(
  (select prosrc ~ 'lock_sender\(sender\);\s+select \* into c from public\.conversations where id = p_conversation_id for update'
   from pg_proc where oid = 'public.send_message(uuid, text)'::regprocedure),
  'send_message takes the sender''s lock before the conversation''s row'
);
select ok(
  (select prosrc ~ 'perform private\.lock_sender\(account\);'
   from pg_proc where oid = 'private.message_limit_error(uuid, boolean)'::regprocedure),
  'the limits are checked under the sender''s lock'
);
select ok(
  (select prosrc ~ 'offer-rate.*message_limit_error\(account, false\)'
   from pg_proc where oid = 'public.start_offer(text, text, text)'::regprocedure),
  'start_offer checks the hour''s messages after its 20 offers a day'
);

-- --- Reports: a hidden listing has no page to report (reportSubject through publicListing) -------------------------

select pg_temp.sign_in('e6');
select is(
  public.create_report('listing', 'ml-l-hidden', 'Hidden lamp', 'scam', ''), 'not-found',
  'a hidden listing can''t be reported'
);
select is(
  public.create_report('listing', 'ml-l1', 'Desk lamp', 'scam', ''), 'created', 'a listing with a page still can'
);
select is(
  public.create_report('seller', 'ml-lwazi', 'Lwazi lamps', 'spam', ''), 'created', 'as can its shop'
);
select pg_temp.sign_out();
select is(
  (select array_agg(r.target_id order by r.target_id) from public.reports r where r.reporter_id = pg_temp.a('e6')),
  array['ml-l1', 'ml-lwazi'],
  'only the two reports with a page were made'
);

select * from finish();
rollback;
