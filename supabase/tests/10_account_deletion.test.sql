-- Task 9: deleting an account (supabase foundation plan; backend spec 4.5; deleteAccountData in lib/data/accounts.ts,
-- forgetAccountInMessaging in lib/data/messages.ts and forgetShopOf in lib/data/shops.ts, and their tests).
-- public.forget_account runs first, with the admin client; then the Auth user is deleted and foreign keys clear the rest.
begin;
select plan(56);

create function pg_temp.sign_in(account uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', account, 'role', 'authenticated', 'session_id', '5e550000-0000-4000-8000-000000000091')::text, true);
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;

insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
-- Thandi the buyer (91), Sipho who owns Tech shop (92), Ayanda another buyer (93), Bongi (94).
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000091', 'thandi@eduvos.com'),
  ('00000000-0000-4000-8000-000000000092', 'sipho@eduvos.com'),
  ('00000000-0000-4000-8000-000000000093', 'ayanda@eduvos.com'),
  ('00000000-0000-4000-8000-000000000094', 'bongi@eduvos.com');
insert into public.profiles (id, first_name, campus_slug) values
  ('00000000-0000-4000-8000-000000000091', 'Thandi', 'test-campus'),
  ('00000000-0000-4000-8000-000000000092', 'Sipho', 'test-campus'),
  ('00000000-0000-4000-8000-000000000093', 'Ayanda', 'test-campus'),
  ('00000000-0000-4000-8000-000000000094', 'Bongi', 'test-campus');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  ('10000000-0000-4000-8000-000000000091', 'test-del-tech', '00000000-0000-4000-8000-000000000092', 'Tech shop', 'test-category', 'test-campus', '2026-01'),
  ('10000000-0000-4000-8000-000000000092', 'test-del-other', null, 'Other shop', 'test-category', 'test-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id) values
  ('00000000-0000-4000-8000-000000000092', 'approved', '10000000-0000-4000-8000-000000000091');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('t-d1', '10000000-0000-4000-8000-000000000091', 'available', 'item', 'Headset', 'test-category', 'good', 400, 'cash', 'A headset.', 'online', 'test-campus', now()),
  ('t-d2', '10000000-0000-4000-8000-000000000091', 'available', 'item', 'Calculator', 'test-category', 'good', 200, 'cash', 'A calculator.', 'online', 'test-campus', now()),
  ('t-d3', '10000000-0000-4000-8000-000000000092', 'available', 'item', 'Book', 'test-category', 'good', 100, 'cash', 'A book.', 'online', 'test-campus', now());
-- Sipho's photos: one on a listing, one waiting. Thandi's: one waiting.
insert into public.photos (id, owner_id, use, type, path) values
  ('30000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000092', 'listing:t-d1', 'image/webp', '00000000-0000-4000-8000-000000000092/30000000-0000-4000-8000-000000000091'),
  ('30000000-0000-4000-8000-000000000092', '00000000-0000-4000-8000-000000000092', null, 'image/png', '00000000-0000-4000-8000-000000000092/30000000-0000-4000-8000-000000000092'),
  ('30000000-0000-4000-8000-000000000093', '00000000-0000-4000-8000-000000000091', null, 'image/png', '00000000-0000-4000-8000-000000000091/30000000-0000-4000-8000-000000000093');
insert into public.listing_photos (listing_id, photo_id, position) values ('t-d1', '30000000-0000-4000-8000-000000000091', 0);
insert into public.onboarding_drafts (account_id, name) values ('00000000-0000-4000-8000-000000000091', 'Thandi''s plans');
insert into public.consents (account_id, version) values ('00000000-0000-4000-8000-000000000091', '2026-10-draft');

-- Conversations: Thandi and Tech shop about the headset (Replied, a reply unread by Thandi, Thandi's read by Sipho)
-- and about the calculator (Done, waiting for Thandi); Ayanda and Tech shop (Asked); Thandi and the ownerless shop.
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, status, created_at, last_message_at, first_reply_at, completed_at) values
  ('40000000-0000-4000-8000-000000000091', 't-d1', 'Headset', '10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091', 'replied', '2026-10-13T08:00Z', '2026-10-13T09:00Z', '2026-10-13T09:00Z', null),
  ('40000000-0000-4000-8000-000000000092', 't-d2', 'Calculator', '10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091', 'done', '2026-10-12T08:00Z', '2026-10-12T16:00Z', '2026-10-12T10:00Z', '2026-10-13T15:00Z'),
  ('40000000-0000-4000-8000-000000000093', 't-d2', 'Calculator', '10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000093', 'asked', '2026-10-14T08:00Z', '2026-10-14T08:00Z', null, null),
  ('40000000-0000-4000-8000-000000000094', 't-d3', 'Book', '10000000-0000-4000-8000-000000000092', '00000000-0000-4000-8000-000000000091', 'asked', '2026-10-14T08:00Z', '2026-10-14T08:00Z', null, null);
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, status, created_at, last_message_at, first_reply_at, completed_at, confirmed_at, confirmed_by) values
  ('40000000-0000-4000-8000-000000000095', 't-d1', 'Headset', '10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000094', 'confirmed', '2026-10-01T08:00Z', '2026-10-01T09:00Z', '2026-10-01T08:30Z', '2026-10-02T08:00Z', '2026-10-03T08:00Z', 'buyer');
insert into public.messages (id, conversation_id, side, body, sent_at, read_at) values
  ('50000000-0000-4000-8000-000000000091', '40000000-0000-4000-8000-000000000091', 'buyer', 'Is it there?', '2026-10-13T08:00Z', '2026-10-13T08:30Z'),
  ('50000000-0000-4000-8000-000000000092', '40000000-0000-4000-8000-000000000091', 'seller', 'It is.', '2026-10-13T09:00Z', null),
  ('50000000-0000-4000-8000-000000000093', '40000000-0000-4000-8000-000000000092', 'buyer', 'Still there?', '2026-10-12T08:00Z', '2026-10-12T09:00Z'),
  ('50000000-0000-4000-8000-000000000094', '40000000-0000-4000-8000-000000000092', 'seller', 'Yes.', '2026-10-12T10:00Z', '2026-10-12T11:00Z'),
  ('50000000-0000-4000-8000-000000000095', '40000000-0000-4000-8000-000000000093', 'buyer', 'Hello?', '2026-10-14T08:00Z', null),
  ('50000000-0000-4000-8000-000000000096', '40000000-0000-4000-8000-000000000094', 'buyer', 'Which edition?', '2026-10-14T08:00Z', null),
  ('50000000-0000-4000-8000-000000000097', '40000000-0000-4000-8000-000000000095', 'buyer', 'Deal.', '2026-10-01T08:00Z', '2026-10-01T08:10Z'),
  ('50000000-0000-4000-8000-000000000098', '40000000-0000-4000-8000-000000000095', 'seller', 'Deal.', '2026-10-01T08:30Z', '2026-10-01T08:40Z');
insert into public.notifications (account_id, kind, subject_id, text, href) values
  ('00000000-0000-4000-8000-000000000091', 'message', '40000000-0000-4000-8000-000000000091', 'Tech shop replied about Headset', '/messages/40000000-0000-4000-8000-000000000091'),
  ('00000000-0000-4000-8000-000000000091', 'sale-to-confirm', '40000000-0000-4000-8000-000000000092', 'Tech shop marked Calculator as done. Did the sale happen?', '/messages/40000000-0000-4000-8000-000000000092'),
  ('00000000-0000-4000-8000-000000000092', 'message', '40000000-0000-4000-8000-000000000091', 'Thandi asked about Headset', '/messages/40000000-0000-4000-8000-000000000091'),
  ('00000000-0000-4000-8000-000000000092', 'message', '40000000-0000-4000-8000-000000000093', 'Ayanda asked about Calculator', '/messages/40000000-0000-4000-8000-000000000093'),
  ('00000000-0000-4000-8000-000000000093', 'message', '40000000-0000-4000-8000-000000000099', 'Someone else entirely', '/messages/40000000-0000-4000-8000-000000000099');
insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values
  ('00000000-0000-4000-8000-000000000091', 'listing', 't-d3', 'Book', 'spam'),
  ('00000000-0000-4000-8000-000000000093', 'seller', 'test-del-tech', 'Tech shop', 'scam');
insert into private.sign_in_attempts (key, step, email, expires_at) values
  ('attempt-thandi', 'code', 'thandi@eduvos.com', now() + interval '30 minutes'),
  ('attempt-other', 'code', 'ayanda@eduvos.com', now() + interval '30 minutes');
insert into private.code_sends (email, hour, n) values
  ('thandi@eduvos.com', date_trunc('hour', now(), 'UTC'), 2), ('ayanda@eduvos.com', date_trunc('hour', now(), 'UTC'), 1);

-- Thandi, a buyer, deletes her account.
set local role service_role;
select is(
  public.forget_account('00000000-0000-4000-8000-000000000091'),
  array['00000000-0000-4000-8000-000000000091/30000000-0000-4000-8000-000000000093'],
  'forgetting a buyer gives back the paths of every photo she uploaded, for the files to go'
);
reset role;
select is(
  (select array_agg(row(id, side)::text order by id) from public.messages where conversation_id = '40000000-0000-4000-8000-000000000091'),
  array[row('50000000-0000-4000-8000-000000000092'::uuid, 'seller')::text],
  'her messages go and the seller keeps his side (plan decision 14)'
);
select is(
  (select read_at from public.messages where id = '50000000-0000-4000-8000-000000000094'),
  null,
  'the other side''s remaining messages are unread again (fix 8)'
);
select is(
  (select row(buyer_id, status, first_reply_at)::text from public.conversations where id = '40000000-0000-4000-8000-000000000091'),
  row(null::uuid, 'replied', '2026-10-13T09:00Z'::timestamptz)::text,
  'the conversation stays, without a buyer, with its times'
);
select is(
  (select row(buyer_id, status, completed_at, confirmed_at)::text from public.conversations where id = '40000000-0000-4000-8000-000000000092'),
  row(null::uuid, 'replied', null::timestamptz, null::timestamptz)::text,
  'a sale waiting for her goes back to Replied, its completion forgotten (amendment 3)'
);
select is(
  (select count(*) from public.conversations where id = '40000000-0000-4000-8000-000000000094'),
  0::bigint,
  'a conversation with nothing left in it goes'
);
select is(
  (select count(*) from public.notifications where subject_id in ('40000000-0000-4000-8000-000000000091', '40000000-0000-4000-8000-000000000092')),
  0::bigint,
  'notifications about her conversations go, the seller''s too, since they name her'
);
select is(
  (select count(*) from public.notifications where account_id = '00000000-0000-4000-8000-000000000092'),
  1::bigint,
  'the seller keeps his notification about someone else'
);
select is((select count(*) from public.reports where reporter_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'her reports go');
select is((select count(*) from public.reports), 1::bigint, 'nobody else''s');
select is((select count(*) from public.onboarding_drafts where account_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'her wizard draft goes');
select is((select count(*) from public.photos where owner_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'her photo rows go');
select is((select array_agg(key) from private.sign_in_attempts where key like 'attempt-%'), array['attempt-other'], 'her sign-in attempt goes, not anyone else''s');
select is((select array_agg(email) from private.code_sends where email in ('thandi@eduvos.com', 'ayanda@eduvos.com')), array['ayanda@eduvos.com'], 'and her code count');
select is((select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'her profile goes last (M4 of the phase A review)');
select is((select count(*) from public.consents where account_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'and its consents with it');

-- Her session in another tab, still valid until the Auth user goes, can do nothing: actions that make rows need a
-- profile (a 403 through the API), and the rest find nothing of hers.
select pg_temp.sign_in('00000000-0000-4000-8000-000000000091');
select throws_ok($$select public.start_conversation('t-d3', null, 'Still here?', null)$$, '42501', null, 'her other tab cannot start a conversation');
select throws_ok($$select public.create_report('listing', 't-d3', 'Book', 'spam', '')$$, '42501', null, 'nor report');
select throws_ok($$select public.add_photos(array['image/png'])$$, '42501', null, 'nor store photos');
select throws_ok($$select public.create_shop('Shop', '', 'test-category', 'x', null, 'test-campus', '{}')$$, '42501', null, 'nor make a shop');
select throws_ok($$select public.save_onboarding_draft('Shop', '', null, '', null, null, '{}')$$, '42501', null, 'nor save a wizard draft');
select throws_ok($$select public.record_consent('2026-10-draft')$$, '42501', null, 'nor record consent');
select is(public.send_message('40000000-0000-4000-8000-000000000091', 'Hello?'), 'not-found', 'her old thread is not hers any more');
select is(public.mark_thread_read('40000000-0000-4000-8000-000000000091'), false, 'nor can she mark it read');
select is(public.confirm_sale('40000000-0000-4000-8000-000000000092'), 'not-allowed', 'nor confirm the sale that was waiting for her');
select is(public.update_profile('Thandi', 'test-campus'), false, 'there is no profile to edit');
select is(public.mark_notifications_read(), 0, 'no notifications to read');
select is(public.settle_sales(), 0, 'no sales to settle');
select is(public.save_listing(null, 'item', 'Lamp', 'test-category', 'good', 10, false, 'cash', null, 'A lamp.', 'online', null, '[]', true), '{"result": "no-shop"}'::jsonb, 'no shop to list in');
select throws_ok(
  $$insert into public.form_states (session_id, form, account_id, expires_at) values ('5e550000-0000-4000-8000-000000000091', 'details', '00000000-0000-4000-8000-000000000091', now() + interval '10 minutes')$$,
  '23503', null, 'and no form state to keep'
);
select pg_temp.sign_out();
delete from auth.users where id = '00000000-0000-4000-8000-000000000091';
select is((select count(*) from auth.users where id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'then her Auth user is deleted');

-- Sipho, a seller, deletes his account.
set local role service_role;
select is(
  public.forget_account('00000000-0000-4000-8000-000000000092'),
  array[
    '00000000-0000-4000-8000-000000000092/30000000-0000-4000-8000-000000000091',
    '00000000-0000-4000-8000-000000000092/30000000-0000-4000-8000-000000000092'
  ],
  'forgetting a seller gives back every photo of his, the listing''s and the waiting one'
);
reset role;
select is((select count(*) from public.shops where id = '10000000-0000-4000-8000-000000000091'), 0::bigint, 'his shop goes');
select is((select count(*) from public.listings where id in ('t-d1', 't-d2')), 0::bigint, 'with its listings');
select is((select count(*) from public.listings where id = 't-d3'), 1::bigint, 'and nobody else''s');
select is((select count(*) from public.photos where owner_id = '00000000-0000-4000-8000-000000000092'), 0::bigint, 'his photo rows go');
select is(
  (select array_agg(row(side, read_at)::text) from public.messages where conversation_id = '40000000-0000-4000-8000-000000000093'),
  array[row('buyer', null::timestamptz)::text],
  'Ayanda keeps her side'
);
select is(
  (select row(seller_gone, shop_id, listing_id, listing_title, buyer_id, status)::text from public.conversations where id = '40000000-0000-4000-8000-000000000093'),
  row(true, null::uuid, null::text, 'Calculator', '00000000-0000-4000-8000-000000000093'::uuid, 'asked')::text,
  'her conversation says the seller has gone, and keeps the listing''s title'
);
select is(
  (select count(*) from public.conversations where id in ('40000000-0000-4000-8000-000000000091', '40000000-0000-4000-8000-000000000092')),
  0::bigint,
  'a conversation with neither side left goes'
);
select is(
  (select row(seller_gone, status, completed_at, confirmed_at, confirmed_by, first_reply_at)::text from public.conversations where id = '40000000-0000-4000-8000-000000000095'),
  row(true, 'confirmed', '2026-10-02T08:00Z'::timestamptz, '2026-10-03T08:00Z'::timestamptz, 'buyer', '2026-10-01T08:30Z'::timestamptz)::text,
  'a confirmed sale stays confirmed, with its times'
);
select is(
  (select array_agg(row(side, read_at)::text) from public.messages where conversation_id = '40000000-0000-4000-8000-000000000095'),
  array[row('buyer', null::timestamptz)::text],
  'and the buyer keeps her side'
);
select is(
  (select count(*) from public.notifications where subject_id = '40000000-0000-4000-8000-000000000093'),
  0::bigint,
  'notifications about his conversations go'
);
select is(
  (select count(*) from public.notifications where account_id = '00000000-0000-4000-8000-000000000093'),
  1::bigint,
  'Ayanda''s about something else stays'
);
select is(
  (select target_id from public.reports where reporter_id = '00000000-0000-4000-8000-000000000093'),
  'test-del-tech',
  'reports by others about his shop stay, for the Hub'
);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000092')
  + (select count(*) from public.seller_profiles where account_id = '00000000-0000-4000-8000-000000000092'),
  0::bigint,
  'his profile goes last, and his seller profile with it'
);
select pg_temp.sign_in('00000000-0000-4000-8000-000000000092');
select is(public.update_shop('Tech shop', '', 'test-category', 'x', 'test-campus', '{}', null, false, null), '{"result": "no-shop"}'::jsonb, 'his other tab cannot edit the shop');
select is(public.set_shop_paused(true), 'not-allowed', 'nor pause it');
select is(public.set_listing_state('t-d3', 'paused'), 'not-allowed', 'nor move a listing');
select is(public.mark_completed('40000000-0000-4000-8000-000000000093'), 'not-allowed', 'nor mark a sale done');
select is(public.send_message('40000000-0000-4000-8000-000000000093', 'Hi'), 'not-found', 'nor write to a buyer');
select pg_temp.sign_out();
delete from auth.users where id = '00000000-0000-4000-8000-000000000092';

-- A second buyer who leaves after the seller: nothing is left, so it goes.
set local role service_role;
select is(public.forget_account('00000000-0000-4000-8000-000000000093'), '{}'::text[], 'a buyer with no photos gets an empty list');
reset role;
select is((select count(*) from public.conversations where id = '40000000-0000-4000-8000-000000000093'), 0::bigint, 'once both sides have gone the conversation goes');
select is(
  (select count(*) from public.messages where conversation_id = '40000000-0000-4000-8000-000000000093'),
  0::bigint,
  'with its messages'
);

-- An unknown account changes nothing.
set local role service_role;
select is(public.forget_account('00000000-0000-4000-8000-0000000000ff'), '{}'::text[], 'an unknown account has nothing to forget');
reset role;
select is((select count(*) from public.conversations where id = '40000000-0000-4000-8000-000000000095'), 1::bigint, 'and nothing else changes');
select is(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.forget_account(uuid)'::regprocedure),
  true,
  'forget_account is security definer with an empty search path'
);

select * from finish();
rollback;
