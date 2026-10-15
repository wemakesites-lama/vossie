-- Task 9: messaging's atomic writes (supabase foundation plan; lib/data/messages.ts and notifications.ts, and the
-- cases of their tests). Every function takes the account from the session, never from an argument.
begin;
select plan(112);

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
-- What each call gave back, for the checks after it.
create temp table results (k text primary key, v jsonb);
grant all on results to public;
create function pg_temp.conv(k text) returns uuid language sql as $f$
  select (v ->> 'conversation_id')::uuid from results where results.k = conv.k;
$f$;

insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
-- Ayanda the buyer (61), Sipho who owns Tech shop (62), a stranger (63), Lerato with a pending shop (64), Bongi (65).
insert into auth.users (id, email)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, 'user' || n || '@eduvos.com' from unnest(array['61', '62', '63', '64', '65', '66']) n;
insert into public.profiles (id, first_name, campus_slug) values
  ('00000000-0000-4000-8000-000000000061', 'Ayanda', 'test-campus'),
  ('00000000-0000-4000-8000-000000000062', 'Sipho', 'test-campus'),
  ('00000000-0000-4000-8000-000000000063', 'Stranger', 'test-campus'),
  ('00000000-0000-4000-8000-000000000064', 'Lerato', 'test-campus'),
  ('00000000-0000-4000-8000-000000000065', 'Bongi', 'test-campus');
-- User 66 has signed in but not finished step 3: no profile.
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  ('10000000-0000-4000-8000-000000000061', 'test-tech-shop', '00000000-0000-4000-8000-000000000062', 'Tech shop', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-000000000062', 'test-sample-shop', null, 'Sample shop', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-000000000063', 'test-pending-shop', '00000000-0000-4000-8000-000000000064', 'Pending shop', 'test-category', 'test-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id) values
  ('00000000-0000-4000-8000-000000000062', 'approved', '10000000-0000-4000-8000-000000000061'),
  ('00000000-0000-4000-8000-000000000064', 'pending', '10000000-0000-4000-8000-000000000063');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, swap_for, description, handover, campus_slug, first_published_at) values
  ('t-calc', '10000000-0000-4000-8000-000000000061', 'available', 'item', 'Calculator', 'test-category', 'good', 200, 'cash', null, 'A calculator.', 'online', 'test-campus', now()),
  ('t-headset', '10000000-0000-4000-8000-000000000061', 'available', 'item', 'Headset', 'test-category', 'good', 400, 'both', 'A speaker', 'A headset.', 'online', 'test-campus', now()),
  ('t-paused', '10000000-0000-4000-8000-000000000061', 'paused', 'item', 'Paused lamp', 'test-category', 'good', 100, 'cash', null, 'A lamp.', 'online', 'test-campus', now()),
  ('t-sold', '10000000-0000-4000-8000-000000000061', 'sold', 'item', 'Sold desk', 'test-category', 'good', 100, 'cash', null, 'A desk.', 'online', 'test-campus', now()),
  ('t-book', '10000000-0000-4000-8000-000000000062', 'available', 'item', 'Accounting book', 'test-category', 'good', 150, 'cash', null, 'A book.', 'online', 'test-campus', now()),
  ('t-pending', '10000000-0000-4000-8000-000000000063', 'draft', 'item', 'Beanie', 'test-category', 'good', 80, 'cash', null, 'A beanie.', 'online', 'test-campus', null);
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('t-draft', '10000000-0000-4000-8000-000000000061', 'draft', 'item', 'Draft mouse', 'test-category', 'good', 50, 'cash', 'A mouse.', 'online', 'test-campus', null);

-- Who may call what.
select ok(
  not exists (
    select 1 from unnest(array[
      'public.start_conversation(text, text, text, text)', 'public.send_message(uuid, text)',
      'public.mark_completed(uuid)', 'public.confirm_sale(uuid)', 'public.reject_sale(uuid)',
      'public.mark_thread_read(uuid)', 'public.mark_notifications_read()', 'public.settle_sales()'
    ]) f
    where has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute')
  ),
  'the messaging actions run for signed-in users, never for anon'
);
set local role anon;
select throws_ok(
  $$select public.send_message('40000000-0000-4000-8000-000000000001', 'Hi')$$,
  '42501', null, 'anon cannot send a message'
);
reset role;

-- Starting a conversation (messaging spec 2.1, 2.2 and 2.4).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
insert into results values ('headset', public.start_conversation('t-headset', null, 'Would you swap?', 'A mechanical keyboard'));
select pg_temp.sign_out();
select is((select v ->> 'result' from results where k = 'headset'), 'started', 'a first message starts a conversation');
select is(
  (select row(listing_id, listing_title, shop_id, buyer_id, status, created_at = now(), last_message_at = now(), first_reply_at)::text
   from public.conversations where id = pg_temp.conv('headset')),
  row('t-headset', 'Headset', '10000000-0000-4000-8000-000000000061'::uuid, '00000000-0000-4000-8000-000000000061'::uuid, 'asked', true, true, null::timestamptz)::text,
  'it is Asked, about the listing (with its title), with the shop and the buyer'
);
select is(
  (select array_agg(row(side, body, swap_offer, read_at)::text) from public.messages where conversation_id = pg_temp.conv('headset')),
  array[row('buyer', 'Would you swap?', 'A mechanical keyboard', null::timestamptz)::text],
  'it holds the message and its swap offer'
);
select is(
  (select row(kind, text, href, read_at)::text from public.notifications
   where account_id = '00000000-0000-4000-8000-000000000062' and subject_id = pg_temp.conv('headset')::text),
  row('message', 'Ayanda asked about Headset', '/messages/' || pg_temp.conv('headset'), null::timestamptz)::text,
  'the shop''s owner is told: "Ayanda asked about Headset", linking to the thread'
);

select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
insert into results values ('headset-again', public.start_conversation('t-headset', null, 'Hello?', null));
insert into results values ('calc', public.start_conversation('t-calc', null, 'Is it there?', 'Ignored'));
select pg_temp.sign_out();
select is(
  (select v from results where k = 'headset-again'),
  jsonb_build_object('result', 'added', 'conversation_id', pg_temp.conv('headset')),
  'a second first message about the listing joins its conversation (plan decision 5)'
);
select is(
  (select array_agg(body order by sent_at, body) from public.messages where conversation_id = pg_temp.conv('headset')),
  array['Hello?', 'Would you swap?'],
  'which then holds both messages'
);
select is(
  (select count(*) from public.notifications where account_id = '00000000-0000-4000-8000-000000000062' and subject_id = pg_temp.conv('headset')::text),
  1::bigint,
  'and keeps one unread message notification (plan decision 12)'
);
select is((select v ->> 'result' from results where k = 'calc'), 'started', 'another listing starts its own conversation');
select is(
  (select swap_offer from public.messages where conversation_id = pg_temp.conv('calc')),
  null,
  'a swap offer is dropped when the listing takes cash only (spec 2.4)'
);

-- A question to the shop (plan decision 2): one per buyer and shop, apart from its listings.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
insert into results values ('question', public.start_conversation(null, 'test-tech-shop', 'Do you fix screens?', null));
insert into results values ('question-again', public.start_conversation(null, 'test-tech-shop', 'Or batteries?', null));
select pg_temp.sign_out();
select is((select v ->> 'result' from results where k = 'question'), 'started', 'a question to a shop starts a conversation');
select is(
  (select row(listing_id, listing_title)::text from public.conversations where id = pg_temp.conv('question')),
  row(null::text, null::text)::text,
  'with no listing'
);
select is(
  (select v from results where k = 'question-again'),
  jsonb_build_object('result', 'added', 'conversation_id', pg_temp.conv('question')),
  'a second question joins it'
);
select is(
  (select text from public.notifications where subject_id = pg_temp.conv('question')::text),
  'Ayanda asked your shop a question',
  'still a question until someone replies (messaging plan amendment 3)'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.send_message(pg_temp.conv('question'), 'Yes we do.'), 'sent', 'the seller replies to the question');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(
  public.start_conversation(null, 'test-tech-shop', 'And batteries?', null) ->> 'result',
  'added',
  'the buyer asks again'
);
select pg_temp.sign_out();
select is(
  (select text from public.notifications where account_id = '00000000-0000-4000-8000-000000000062' and subject_id = pg_temp.conv('question')::text and read_at is null),
  'Ayanda replied',
  'which now says "Ayanda replied"'
);

-- A shop with no owner yet stores the message and tells no one (plan decision 1).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
insert into results values ('book', public.start_conversation('t-book', null, 'Is it the 4th edition?', null));
select pg_temp.sign_out();
select is((select v ->> 'result' from results where k = 'book'), 'started', 'a sample shop''s listing can be messaged');
select is((select count(*) from public.notifications where subject_id = pg_temp.conv('book')::text), 0::bigint, 'and no one is told');

-- What can't be messaged.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(public.start_conversation('t-draft', null, 'Hi', null), '{"result": "not-found"}'::jsonb, 'a draft cannot be messaged');
select is(public.start_conversation('t-pending', null, 'Hi', null), '{"result": "not-found"}'::jsonb, 'nor a pending shop''s listing');
select is(public.start_conversation(null, 'test-pending-shop', 'Hi', null), '{"result": "not-found"}'::jsonb, 'nor a pending shop');
select is(public.start_conversation('no-such-listing', null, 'Hi', null), '{"result": "not-found"}'::jsonb, 'nor an unknown listing');
select is(public.start_conversation(null, 'no-such-shop', 'Hi', null), '{"result": "not-found"}'::jsonb, 'nor an unknown shop');
select is(public.start_conversation('t-paused', null, 'Hi', null), '{"result": "closed"}'::jsonb, 'a paused listing is closed (spec 3.1)');
select is(public.start_conversation('t-sold', null, 'Hi', null), '{"result": "closed"}'::jsonb, 'so is a sold one');
select throws_ok(
  $$select public.start_conversation('t-calc', 'test-tech-shop', 'Hi', null)$$,
  '22023', null, 'a listing or a shop, not both'
);
select throws_ok($$select public.start_conversation('t-calc', null, '', null)$$, '23514', null, 'a message is not empty');
select throws_ok(
  format($$select public.start_conversation('t-calc', null, %L, null)$$, repeat('a', 1001)),
  '23514', null, 'a message is at most 1,000 characters'
);
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.start_conversation('t-calc', null, 'Hi', null), '{"result": "own-shop"}'::jsonb, 'a seller cannot message their own listing');
select is(public.start_conversation(null, 'test-tech-shop', 'Hi', null), '{"result": "own-shop"}'::jsonb, 'or their own shop');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000066');
select throws_ok(
  $$select public.start_conversation('t-calc', null, 'Hi', null)$$,
  '42501', null, 'an account without a profile cannot message'
);
select pg_temp.sign_out();

-- Replies and the status (spec 2.5, plan decision 30).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(public.send_message(pg_temp.conv('calc'), 'Anyone there?'), 'sent', 'the buyer sends another message');
select pg_temp.sign_out();
select is((select status from public.conversations where id = pg_temp.conv('calc')), 'asked', 'still Asked');
select is(
  (select text from public.notifications where account_id = '00000000-0000-4000-8000-000000000062' and subject_id = pg_temp.conv('calc')::text),
  'Ayanda asked about Calculator',
  'and the buyer still "asked" (messaging plan amendment 3)'
);
-- The seller replies an hour later (moved back in time so the first reply's time can be seen).
update public.conversations set created_at = now() - interval '2 hours', last_message_at = now() - interval '2 hours' where id = pg_temp.conv('calc');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.send_message(pg_temp.conv('calc'), 'Yes, it is.'), 'sent', 'the seller replies');
select pg_temp.sign_out();
select is(
  (select row(status, first_reply_at = now(), last_message_at = now())::text from public.conversations where id = pg_temp.conv('calc')),
  row('replied', true, true)::text,
  'the first reply makes it Replied and keeps its time'
);
update public.conversations set first_reply_at = now() - interval '1 hour' where id = pg_temp.conv('calc');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.send_message(pg_temp.conv('calc'), 'Still here.'), 'sent', 'the seller writes again');
select pg_temp.sign_out();
select is(
  (select first_reply_at = now() - interval '1 hour' from public.conversations where id = pg_temp.conv('calc')),
  true,
  'and the first reply''s time stays'
);
select is(
  (select array_agg(row(kind, text, read_at)::text) from public.notifications
   where account_id = '00000000-0000-4000-8000-000000000061' and subject_id = pg_temp.conv('calc')::text),
  array[row('message', 'Tech shop replied about Calculator', null::timestamptz)::text],
  'the buyer has one notification about it: "Tech shop replied about Calculator"'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(public.send_message(pg_temp.conv('calc'), 'Great, thanks.'), 'sent', 'the buyer answers');
select pg_temp.sign_out();
select is(
  (select text from public.notifications where account_id = '00000000-0000-4000-8000-000000000062' and subject_id = pg_temp.conv('calc')::text),
  'Ayanda replied about Calculator',
  'and now "replied", once someone has replied'
);

-- Only the buyer and the shop's owner write.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000063');
select is(public.send_message(pg_temp.conv('calc'), 'Hi'), 'not-found', 'a stranger cannot write in a thread');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(public.send_message('40000000-0000-4000-8000-0000000000ff', 'Hi'), 'not-found', 'an unknown thread is not found');
select throws_ok(format($$select public.send_message(%L, '   ')$$, pg_temp.conv('calc')), '23514', null, 'a reply is not empty once trimmed');
select pg_temp.sign_out();

-- The sale (spec 2.5).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.mark_completed(pg_temp.conv('headset')), 'not-allowed', 'a sale cannot be marked done before a reply');
select is(public.send_message(pg_temp.conv('headset'), 'Yes, I would.'), 'sent', 'the seller replies about the headset');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(public.mark_completed(pg_temp.conv('headset')), 'not-allowed', 'the buyer cannot mark it done');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.mark_completed(pg_temp.conv('headset')), 'done', 'the seller marks it done');
select is(public.mark_completed(pg_temp.conv('headset')), 'not-allowed', 'once');
select pg_temp.sign_out();
select is(
  (select row(status, completed_at = now())::text from public.conversations where id = pg_temp.conv('headset')),
  row('done', true)::text,
  'it is Done, with the time'
);
select is(
  (select array_agg(row(text, href, read_at)::text) from public.notifications
   where account_id = '00000000-0000-4000-8000-000000000061' and kind = 'sale-to-confirm'),
  array[row('Tech shop marked Headset as done. Did the sale happen?', '/messages/' || pg_temp.conv('headset'), null::timestamptz)::text],
  'and the buyer is asked to confirm'
);

select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.confirm_sale(pg_temp.conv('headset')), 'not-allowed', 'the seller cannot confirm the sale');
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(public.confirm_sale(pg_temp.conv('calc')), 'not-allowed', 'a sale that isn''t Done cannot be confirmed');
select is(public.reject_sale(pg_temp.conv('headset')), 'done', 'the buyer says it didn''t happen');
select is(public.reject_sale(pg_temp.conv('headset')), 'not-allowed', 'once');
select pg_temp.sign_out();
select is(
  (select row(status, completed_at)::text from public.conversations where id = pg_temp.conv('headset')),
  row('replied', null::timestamptz)::text,
  'it goes back to Replied, with no completion'
);
select is(
  (select read_at = now() from public.notifications where account_id = '00000000-0000-4000-8000-000000000061' and kind = 'sale-to-confirm'),
  true,
  'and the sale to confirm is read'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.mark_completed(pg_temp.conv('headset')), 'done', 'the seller can mark it done again');
select pg_temp.sign_out();
select is(
  (select count(*) from public.notifications where account_id = '00000000-0000-4000-8000-000000000061' and kind = 'sale-to-confirm' and read_at is null),
  1::bigint,
  'which asks the buyer again, in a new notification'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(public.confirm_sale(pg_temp.conv('headset')), 'done', 'the buyer confirms the sale');
select pg_temp.sign_out();
select is(
  (select row(status, confirmed_at = now(), confirmed_by)::text from public.conversations where id = pg_temp.conv('headset')),
  row('confirmed', true, 'buyer')::text,
  'it is Confirmed, by the buyer'
);
select is(
  (select count(*) from public.notifications where account_id = '00000000-0000-4000-8000-000000000061' and kind = 'sale-to-confirm' and read_at is null),
  0::bigint,
  'its sale to confirm is read'
);
select is(
  (select count(*) from public.notifications
   where account_id = '00000000-0000-4000-8000-000000000061' and subject_id = pg_temp.conv('headset')::text and kind = 'message' and read_at is null),
  1::bigint,
  'and the message notification is not (amendment 3)'
);

-- The 7-day auto-confirm, noticed by a write (spec 2.5).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.send_message(pg_temp.conv('calc'), 'Shall we?'), 'sent', 'the seller writes about the calculator');
select is(public.mark_completed(pg_temp.conv('calc')), 'done', 'and marks it done');
select pg_temp.sign_out();
update public.conversations set completed_at = now() - interval '6 days 23 hours 59 minutes' where id = pg_temp.conv('calc');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.send_message(pg_temp.conv('calc'), 'Ping.'), 'sent', 'a message a minute before the 7 days');
select pg_temp.sign_out();
select is((select status from public.conversations where id = pg_temp.conv('calc')), 'done', 'leaves it Done');
update public.conversations set completed_at = now() - interval '7 days' where id = pg_temp.conv('calc');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.send_message(pg_temp.conv('calc'), 'Thanks!'), 'sent', 'a message at the 7 days');
select pg_temp.sign_out();
select is(
  (select row(status, confirmed_at = completed_at + interval '7 days', confirmed_by)::text from public.conversations where id = pg_temp.conv('calc')),
  row('confirmed', true, 'auto')::text,
  'confirms it, as of the moment it was due'
);
select is(
  (select read_at = now() from public.notifications where account_id = '00000000-0000-4000-8000-000000000061' and subject_id = pg_temp.conv('calc')::text and kind = 'sale-to-confirm'),
  true,
  'and reads its sale to confirm'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(public.confirm_sale(pg_temp.conv('calc')), 'not-allowed', 'the buyer cannot confirm it after that');
select pg_temp.sign_out();

-- settle_sales: the account's own sales that are due, when a page reads them.
update public.conversations set status = 'done', completed_at = now() - interval '8 days', confirmed_at = null, confirmed_by = null
where id = pg_temp.conv('headset');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000063');
select is(public.settle_sales(), 0, 'a stranger settles nothing of anyone else''s');
select pg_temp.sign_out();
select is((select status from public.conversations where id = pg_temp.conv('headset')), 'done', 'so it is still Done');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(public.settle_sales(), 1, 'the buyer''s due sale is settled');
select pg_temp.sign_out();
select is(
  (select row(status, confirmed_by)::text from public.conversations where id = pg_temp.conv('headset')),
  row('confirmed', 'auto')::text,
  'confirmed by the 7 days'
);

-- Someone who has left (messaging plan amendments 3 and 6).
select pg_temp.sign_in('00000000-0000-4000-8000-000000000065');
insert into results values ('bongi', public.start_conversation('t-calc', null, 'Can I have it?', null));
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.send_message(pg_temp.conv('bongi'), 'Sure.'), 'sent', 'the seller replies to Bongi');
select pg_temp.sign_out();
update public.conversations set buyer_id = null where id = pg_temp.conv('bongi');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.send_message(pg_temp.conv('bongi'), 'Hello?'), 'closed', 'no one can write to a buyer who has left');
select is(public.mark_completed(pg_temp.conv('bongi')), 'not-allowed', 'nor mark the sale done (amendment 3)');
select pg_temp.sign_out();
update public.conversations set buyer_id = '00000000-0000-4000-8000-000000000065', status = 'done', completed_at = now(), seller_gone = true
where id = pg_temp.conv('bongi');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000065');
select is(public.send_message(pg_temp.conv('bongi'), 'Hello?'), 'closed', 'no one can write to a seller who has left');
select is(public.confirm_sale(pg_temp.conv('bongi')), 'not-allowed', 'nor confirm a sale (amendment 6)');
select is(public.reject_sale(pg_temp.conv('bongi')), 'not-allowed', 'nor reject it');
select pg_temp.sign_out();
select is((select status from public.conversations where id = pg_temp.conv('bongi')), 'done', 'which stays as it was');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.send_message(pg_temp.conv('bongi'), 'Hi'), 'not-found', 'a seller who has gone has no side in it');
select pg_temp.sign_out();

-- Opening a thread (spec 3.3) and /notifications (spec 2.9).
update public.messages set read_at = null;
update public.notifications set read_at = null where kind = 'message';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000063');
select is(public.mark_thread_read(pg_temp.conv('calc')), false, 'a stranger opening a thread marks nothing');
select pg_temp.sign_out();
select is((select count(*) from public.messages where conversation_id = pg_temp.conv('calc') and read_at is not null), 0::bigint, 'nothing is read');
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select is(public.mark_thread_read(pg_temp.conv('calc')), true, 'the buyer opens the thread');
select pg_temp.sign_out();
select is(
  (select array_agg(distinct row(side, read_at is not null)::text) from public.messages where conversation_id = pg_temp.conv('calc')),
  array[row('buyer', false)::text, row('seller', true)::text],
  'the seller''s messages are read, the buyer''s own are not'
);
select is(
  (select count(*) from public.notifications
   where account_id = '00000000-0000-4000-8000-000000000061' and subject_id = pg_temp.conv('calc')::text and kind = 'message' and read_at is not null),
  1::bigint,
  'and its message notification'
);
select is(
  (select count(*) from public.notifications
   where account_id = '00000000-0000-4000-8000-000000000061' and subject_id <> pg_temp.conv('calc')::text and kind = 'message' and read_at is null),
  2::bigint,
  'not the other threads'' (plan decision 12)'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select is(public.mark_notifications_read(), 4, 'opening /notifications reads all of the seller''s new ones');
select is(public.mark_notifications_read(), 0, 'and then there are none');
select pg_temp.sign_out();
select is(
  (select count(*) from public.notifications where account_id = '00000000-0000-4000-8000-000000000061' and read_at is null),
  2::bigint,
  'nobody else''s change'
);

-- A paused shop (I2 of the phase A review): its listings count as paused (toListing in lib/data/catalog.ts), so they
-- can't be messaged; a question to the shop still can (composerSubject's open is true for a shop).
update public.seller_profiles set status = 'paused' where account_id = '00000000-0000-4000-8000-000000000062';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000063');
select is(public.start_conversation('t-calc', null, 'Hi', null), '{"result": "closed"}'::jsonb, 'an available listing in a paused shop is closed');
select is(public.start_conversation('t-headset', null, 'Hi', null), '{"result": "closed"}'::jsonb, 'every one of them');
insert into results values ('paused-q', public.start_conversation(null, 'test-tech-shop', 'Are you open again soon?', null));
select pg_temp.sign_out();
select is((select v ->> 'result' from results where k = 'paused-q'), 'started', 'a question to a paused shop is fine, as in the app');
select is(
  (select count(*) from public.conversations where buyer_id = '00000000-0000-4000-8000-000000000063' and listing_id is not null),
  0::bigint,
  'and no conversation about its listings started'
);
update public.seller_profiles set status = 'approved' where account_id = '00000000-0000-4000-8000-000000000062';
select pg_temp.sign_in('00000000-0000-4000-8000-000000000063');
select is(public.start_conversation('t-calc', null, 'Hi', null) ->> 'result', 'started', 'resumed, its listings can be messaged again');
select pg_temp.sign_out();

-- The buyer's account id is not readable through the API (M7); public.my_conversations says which side the reader is.
select ok(
  not has_column_privilege('authenticated', 'public.conversations', 'buyer_id', 'select')
  and has_column_privilege('authenticated', 'public.conversations', 'shop_id', 'select'),
  'authenticated reads every column of a conversation but buyer_id'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000062');
select throws_ok($$select buyer_id from public.conversations$$, '42501', null, 'a seller cannot read the buyer''s account id');
select throws_ok($$select * from public.conversations$$, '42501', null, 'not even with *');
select is(
  (select viewer_side from public.my_conversations where id = pg_temp.conv('calc')),
  'seller',
  'my_conversations tells the seller they are the seller'
);
select is(
  (select count(*) from public.my_conversations where viewer_side = 'buyer'),
  0::bigint,
  'and they buy nothing here'
);
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000061');
select throws_ok($$select buyer_id from public.conversations$$, '42501', null, 'the buyer cannot read it either (it is their own; the session says who they are)');
select is(
  (select viewer_side from public.my_conversations where id = pg_temp.conv('calc')),
  'buyer',
  'my_conversations tells the buyer they are the buyer'
);
select is(
  (select count(*) from public.my_conversations where viewer_side = 'seller'),
  0::bigint,
  'and they sell nothing here'
);
select is(
  (select count(*) from public.my_conversations) ,
  (select count(*) from public.conversations),
  'it lists exactly the conversations the reader can see'
);
select pg_temp.sign_out();
select pg_temp.sign_in('00000000-0000-4000-8000-000000000064');
select is((select count(*) from public.my_conversations where id = pg_temp.conv('calc')), 0::bigint, 'a stranger sees none of it');
select pg_temp.sign_out();
set local role anon;
select throws_ok($$select * from public.my_conversations$$, '42501', null, 'anon cannot read it');
reset role;
select is(
  (select reloptions from pg_class where oid = 'public.my_conversations'::regclass),
  array['security_invoker=true'],
  'it is a security_invoker view: the reader''s own grants and policies apply'
);

-- Calls as the API makes them can't name an account.
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('start_conversation', 'send_message', 'mark_completed', 'confirm_sale', 'reject_sale', 'mark_thread_read', 'mark_notifications_read', 'settle_sales')
     and (p.prosecdef is not true or not (p.proconfig @> array['search_path=""']))),
  0::bigint,
  'each is security definer with an empty search path'
);

select * from finish();
rollback;
