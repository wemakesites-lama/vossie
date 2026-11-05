-- Fills the live demo for the HackJam (Lama, 2026-11-05): a busier Midrand, the Looking For samples, a seller week
-- for Sipho's Tech corner, and dates moved up to the current week. Run once in the dashboard's SQL editor, as postgres,
-- after add-demo-accounts.sql. Safe to run again: rows already there are left as they are, and the dates move only by
-- the days that have passed since the last run, so run it again on the morning of a demo to keep things fresh.
--
-- What it adds, all removed by the clear-out (clear-sample-data.sql) with the rest of the sample data:
-- - three buyer accounts at @vossie.test (Ayanda, Kagiso, Zanele). They can't sign in: the demo sign-in knows only the
--   five fixture addresses, and a .test address can't receive a code.
-- - 15 Midrand listings (dm-001 to dm-015) on existing Midrand shops, 5 of them Tech corner's, each with its own stock
--   photo (/stock/listing/<id>.jpg, docs/reference/stock-photos.md).
-- - the 16 sample Looking For requests (r-001 to r-016, from supabase/seed.sql), if they aren't there.
-- - Sipho's week: five conversations with the new buyers (one sale waiting to be marked sold, one confirmed sale, one
--   buyer waiting for a first reply), Thandi's headset thread from the seed, their notifications, Naledi's two notes
--   about Sipho and Thandi's slot request (from the seed).
-- It never adds a conversation about the Casio calculator (l-001): the demo starts a new message there.
--
-- Then the dates. The sample rows were written as if "now" were 13 October 2026, 18:00 SAST. They move forward by whole
-- days, so that moment becomes today (or yesterday, before 18:00), never the future: the seed listings, the new ones,
-- the sample requests (with their needed-by days), the conversations above, their messages and notifications, the
-- notes and the slot request. Launchpad's posts don't move. Nothing ends up later than now. Moving a listing's first
-- publish needs its guard trigger off for a moment (listings_keep_first_published_at); it's switched back on inside
-- the same transaction, so a failure leaves it on.
--
-- Pages that are cached show the new rows within about 15 minutes (Next's default life), or at once after a redeploy.
-- The guard runs first: it stops, changing nothing, if a demo account, a Midrand shop or pickup point, or the Casio is
-- missing, if Tech corner isn't Sipho's, or if a buyer's id or address belongs to someone else. The last statement shows
-- what's there afterwards.
begin;

-- Deterministic ids for the new rows, so a second run finds them again.
create function pg_temp.demo_id(t text) returns uuid language sql immutable as $$
  select md5('campuscart-demo:' || t)::uuid
$$;

-- A date moved forward by d, never past now. Null stays null (least() alone would turn it into now).
create function pg_temp.moved(ts timestamptz, d interval) returns timestamptz language sql stable as $$
  select case when ts is null then null else least(ts + d, now()) end
$$;

-- The guard.
do $$
declare
  missing text[] := '{}';
  shop text;
begin
  if not exists (select 1 from public.profiles where id = '11c18c13-a088-55c2-bacc-a95b612da2ea') then
    missing := array_append(missing, 'Sipho''s profile (run add-demo-accounts.sql first)');
  end if;
  if not exists (select 1 from public.profiles where id = 'deb3fd08-f1e7-51ea-9103-0fb2451d94bf') then
    missing := array_append(missing, 'Thandi''s profile (run add-demo-accounts.sql first)');
  end if;
  if not exists (select 1 from public.profiles where id = 'bfad90c4-30ec-5ca2-bf9c-ec7af7909917') then
    missing := array_append(missing, 'Naledi''s profile (run add-demo-accounts.sql first)');
  end if;
  foreach shop in array array['tech-corner', 'book-swap', 'res-deals', 'home-bakery', 'hair-studio', 'design-studio',
                              'maths-tutor', 'closet-clear-out', 'ticket-desk'] loop
    if not exists (select 1 from public.shops where slug = shop and campus_slug = 'midrand') then
      missing := array_append(missing, ('the Midrand shop ' || shop));
    end if;
  end loop;
  if not exists (
    select 1 from public.shops where slug = 'tech-corner' and owner_id = '11c18c13-a088-55c2-bacc-a95b612da2ea'
  ) then
    missing := array_append(missing, 'Tech corner owned by Sipho');
  end if;
  if (select count(*) from public.pickup_points
      where campus_slug = 'midrand' and name in ('Library entrance', 'Main reception') and retired_at is null) < 2 then
    missing := array_append(missing, 'Midrand''s Library entrance and Main reception pickup points');
  end if;
  if not exists (select 1 from public.listings where id = 'l-001') then
    missing := array_append(missing, 'the Casio calculator listing (l-001)');
  end if;
  if not exists (select 1 from public.listings where id = 'l-007') then
    missing := array_append(missing, 'the gaming headset listing (l-007)');
  end if;
  if exists (
    select 1
    from auth.users u
    join (values
      (pg_temp.demo_id('ayanda'), 'ayanda@vossie.test'),
      (pg_temp.demo_id('kagiso'), 'kagiso@vossie.test'),
      (pg_temp.demo_id('zanele'), 'zanele@vossie.test')
    ) as demo (id, email) on u.id = demo.id or lower(u.email) = demo.email
    where u.id <> demo.id or lower(u.email) <> demo.email
  ) then
    missing := array_append(missing, 'free buyer ids and addresses (one already belongs to another account)');
  end if;
  if cardinality(missing) > 0 then
    raise exception 'refused, nothing changed. Missing: %', array_to_string(missing, '; ');
  end if;
end
$$;

-- The three buyers: Auth users, email identities, profiles and consents, like add-demo-accounts.sql.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', pg_temp.demo_id(v.name), 'authenticated', 'authenticated', v.name || '@vossie.test', '', v.at::timestamptz, '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, v.at::timestamptz, v.at::timestamptz
from (values ('ayanda', '2026-08-04T09:00:00Z'), ('kagiso', '2026-08-11T10:30:00Z'), ('zanele', '2026-09-02T08:15:00Z')) as v (name, at)
on conflict do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
select pg_temp.demo_id('identity-' || v.name), pg_temp.demo_id(v.name), pg_temp.demo_id(v.name)::text,
  jsonb_build_object('sub', pg_temp.demo_id(v.name)::text, 'email', v.name || '@vossie.test', 'email_verified', true, 'phone_verified', false),
  'email', v.at::timestamptz, v.at::timestamptz
from (values ('ayanda', '2026-08-04T09:00:00Z'), ('kagiso', '2026-08-11T10:30:00Z'), ('zanele', '2026-09-02T08:15:00Z')) as v (name, at)
on conflict do nothing;

insert into public.profiles (id, first_name, campus_slug, roles, created_at)
select pg_temp.demo_id(v.name), v.first_name, 'midrand', '{}'::text[], v.at::timestamptz
from (values ('ayanda', 'Ayanda', '2026-08-04T09:00:00Z'), ('kagiso', 'Kagiso', '2026-08-11T10:30:00Z'), ('zanele', 'Zanele', '2026-09-02T08:15:00Z')) as v (name, first_name, at)
on conflict do nothing;

insert into public.consents (id, account_id, version, agreed_at)
select pg_temp.demo_id('consent-' || v.name), pg_temp.demo_id(v.name), '2026-10-draft', '2026-10-14T08:00:00Z'::timestamptz
from (values ('ayanda'), ('kagiso'), ('zanele')) as v (name)
on conflict do nothing;

-- Midrand's new listings. Free items are R0 and cash; services have no condition and may be "from" a price.
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, price_is_from, pay_mode, swap_for, description, handover, pickup_point_id, campus_slug, created_at, first_published_at, updated_at)
select v.id, s.id, v.state, v.kind, v.title, v.category, v.condition, v.price, v.from_price, v.pay, v.swap_for, v.description, v.handover,
  case when v.handover = 'pickup' then (
    select p.id from public.pickup_points p
    where p.campus_slug = 'midrand' and p.name = v.spot and p.retired_at is null
    order by p.created_at limit 1
  ) end,
  'midrand', v.created_at::timestamptz, v.created_at::timestamptz, coalesce(v.updated_at, v.created_at)::timestamptz
from (values
  ('dm-001', 'tech-corner', 'available', 'item', 'Lenovo ThinkPad T480, 8 GB RAM', 'tech', 'good', 4200, false, 'cash', null,
   E'A 14-inch ThinkPad with a Core i5, a 256 GB SSD and 8 GB of RAM. The battery lasts about four hours.\nWiped and reinstalled with Windows 11. The charger is included.',
   'pickup', 'Main reception', '2026-10-11T13:20:00Z', null),
  ('dm-002', 'tech-corner', 'available', 'item', 'Wireless keyboard and mouse', 'tech', 'like-new', 380, false, 'cash', null,
   'A slim wireless keyboard and mouse that share one USB receiver. Both run on AA batteries, which are included.',
   'pickup', 'Library entrance', '2026-10-09T10:15:00Z', null),
  ('dm-003', 'tech-corner', 'available', 'item', 'Phone tripod with a Bluetooth remote', 'tech', 'like-new', 180, false, 'cash', null,
   'Extends to 1.5 metres and holds any phone. Good for filming content or steady video calls. The remote pairs in seconds.',
   'pickup', 'Library entrance', '2026-10-12T15:30:00Z', null),
  ('dm-004', 'tech-corner', 'available', 'item', 'Canon camera with a tripod', 'tech', 'good', 2800, false, 'both', 'a laptop in good working order',
   'A Canon EOS 1200D with an 18-55 mm lens, a 32 GB card, a spare battery and a full-size tripod. The shutter count is low, and the bag comes with it.',
   'pickup', 'Main reception', '2026-10-10T08:40:00Z', null),
  ('dm-005', 'tech-corner', 'sold', 'item', 'Sony headphones and a phone case', 'tech', 'like-new', 450, false, 'cash', null,
   'Sony over-ear headphones and a matching black case for an iPhone 12, sold as a bundle.',
   'pickup', 'Main reception', '2026-10-07T12:00:00Z', '2026-10-09T18:30:00Z'),
  ('dm-006', 'book-swap', 'available', 'item', 'Casio fx-82ZA Plus calculator', 'tech', 'good', 160, false, 'cash', null,
   'The simpler Casio, fine for Maths 1 and Business Statistics. A few scratches on the cover, and every button works.',
   'pickup', 'Library entrance', '2026-10-12T05:50:00Z', null),
  ('dm-007', 'book-swap', 'available', 'item', 'Accounting 1A past papers and memos', 'textbooks-notes', 'good', 120, false, 'cash', null,
   'Five years of Accounting 1A past papers with worked memos, printed and in a file.',
   'pickup', 'Library entrance', '2026-10-11T09:00:00Z', null),
  ('dm-008', 'book-swap', 'available', 'item', 'Statistics 1 textbook, 3rd edition', 'textbooks-notes', 'good', 280, false, 'cash', null,
   'The prescribed book for Statistics 1, with answers to the exercises at the back. No writing inside.',
   'pickup', 'Library entrance', '2026-10-10T15:00:00Z', null),
  ('dm-009', 'res-deals', 'available', 'item', 'Moving boxes, bundle of 10', 'res-living', 'good', 0, false, 'cash', null,
   'Ten sturdy moving boxes, flat-packed. Free to whoever collects them at reception.',
   'pickup', 'Main reception', '2026-10-12T11:10:00Z', null),
  ('dm-010', 'home-bakery', 'available', 'item', 'Pink velvet cupcakes, box of six', 'food', 'new', 90, false, 'cash', null,
   'Six red velvet cupcakes with pink cream cheese icing. Order by 18:00 and collect the next morning.',
   'pickup', 'Library entrance', '2026-10-13T06:30:00Z', null),
  ('dm-011', 'hair-studio', 'available', 'service', 'Wash day and deep treatment', 'hair-beauty', null, 180, true, 'cash', null,
   'Wash, deep condition and blow-dry, about an hour and a half. Bring your own products if you prefer.',
   'on-campus', null, '2026-10-11T16:40:00Z', null),
  ('dm-012', 'design-studio', 'available', 'service', 'Event posters and social posts', 'services', null, 250, true, 'cash', null,
   'A poster and three matching social posts for your event or society, with one round of changes. Ready in two days.',
   'on-campus-or-online', null, '2026-10-12T09:30:00Z', null),
  ('dm-013', 'maths-tutor', 'available', 'service', 'Maths 1 crash course, two hours', 'tutoring', null, 220, false, 'cash', null,
   'Two hours on limits, derivatives and the questions that come up every year. Small groups of up to three, in the library or over video.',
   'on-campus-or-online', null, '2026-10-10T11:00:00Z', null),
  ('dm-014', 'closet-clear-out', 'available', 'item', 'White sneakers, size 7', 'fashion-thrift', 'good', 350, false, 'both', 'a denim jacket or a hoodie, size M',
   'White sneakers, size 7, worn a few times and cleaned.',
   'pickup', 'Library entrance', '2026-10-11T07:45:00Z', null),
  ('dm-015', 'ticket-desk', 'available', 'item', 'Comedy night tickets, a pair', 'tickets-events', 'new', 240, false, 'cash', null,
   'Two tickets to a comedy night in Midrand next Saturday, at what I paid. I''ll help you change the names on the booking.',
   'pickup', 'Main reception', '2026-10-12T17:20:00Z', null)
) as v (id, shop, state, kind, title, category, condition, price, from_price, pay, swap_for, description, handover, spot, created_at, updated_at)
join public.shops s on s.slug = v.shop
on conflict do nothing;

insert into public.listing_photos (listing_id, placeholder_src, position, alt)
select v.id, v.src, 0, ''
from (values
  ('dm-001', '/stock/listing/dm-001.jpg'),
  ('dm-002', '/stock/listing/dm-002.jpg'),
  ('dm-003', '/stock/listing/dm-003.jpg'),
  ('dm-004', '/stock/listing/dm-004.jpg'),
  ('dm-005', '/stock/listing/dm-005.jpg'),
  ('dm-006', '/stock/listing/dm-006.jpg'),
  ('dm-007', '/stock/listing/dm-007.jpg'),
  ('dm-008', '/stock/listing/dm-008.jpg'),
  ('dm-009', '/stock/listing/dm-009.jpg'),
  ('dm-010', '/stock/listing/dm-010.jpg'),
  ('dm-011', '/stock/listing/dm-011.jpg'),
  ('dm-012', '/stock/listing/dm-012.jpg'),
  ('dm-013', '/stock/listing/dm-013.jpg'),
  ('dm-014', '/stock/listing/dm-014.jpg'),
  ('dm-015', '/stock/listing/dm-015.jpg')
) as v (id, src)
where exists (select 1 from public.listings l where l.id = v.id)
on conflict do nothing;

-- The 16 sample Looking For requests, as supabase/seed.sql has them (no asker, so they never close themselves).
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, budget_zar, swap_welcome, needed_by, status, created_at, updated_at, closed_at, seed_offers, hidden_at, hidden_reason) values
  ('r-001', null, 'Accounting 1 tutor this week', 'tutoring', 'midrand', E'I''m stuck on adjustments and the trial balance before Friday''s test. Looking for someone who passed Accounting 1 to work through two past papers with me.\nEvenings on campus suit me best.', 300, false, '2026-10-16', 'open', '2026-10-13T07:30:00Z', '2026-10-13T07:30:00Z', null, 2, null, null),
  ('r-002', null, 'Graphic calculator to borrow for exams', 'tech', 'pretoria', 'My calculator stopped working and exams start in two weeks. I''d like to borrow a graphic calculator for three weeks. I can pay R100, or swap my Statistics 1 notes.', 100, true, '2026-10-26', 'open', '2026-10-12T18:10:00Z', '2026-10-12T18:10:00Z', null, 1, null, null),
  ('r-003', null, 'Birthday cake for Friday', 'food', 'midrand', 'A chocolate cake for my roommate''s birthday on Friday, big enough for ten people. Writing on top would be a bonus. I can collect on campus at lunchtime.', 350, false, '2026-10-16', 'open', '2026-10-12T09:45:00Z', '2026-10-12T09:45:00Z', null, 3, null, null),
  ('r-004', null, 'Second-hand bar fridge', 'res-living', 'bedfordview', 'Looking for a small bar fridge for my res room, in working order. I can collect anywhere near campus if you can help me carry it.', 1200, false, null, 'open', '2026-10-11T15:20:00Z', '2026-10-11T15:20:00Z', null, 0, null, null),
  ('r-005', null, 'Someone to fix my laptop hinge', 'services', 'cape-town-mowbray', 'The left hinge on my laptop cracked and the screen wobbles. I''d like it fixed rather than replaced. Open to offers on price.', null, false, '2026-10-20', 'open', '2026-10-11T08:05:00Z', '2026-10-11T08:05:00Z', null, 1, null, null),
  ('r-006', null, 'Lift to campus on Monday mornings', 'services', 'pretoria', E'I live about ten minutes from campus and have an 8am class every Monday. I''ll put in R200 a month for petrol if you drive past.\nIt''s for the rest of the semester.', 200, false, null, 'open', '2026-10-10T22:40:00Z', '2026-10-10T22:40:00Z', null, 2, null, null),
  ('r-007', null, 'Business Law 2 notes', 'textbooks-notes', 'online', 'Looking for clear summary notes for Business Law 2, especially contracts. A PDF is fine. I can pay R150 or swap my Business Management 2 notes.', 150, true, '2026-10-30', 'open', '2026-10-10T06:15:00Z', '2026-10-10T06:15:00Z', null, 4, null, null),
  ('r-008', null, 'Formal dress for a faculty dinner', 'fashion-thrift', 'bloemfontein', 'I need a long formal dress, size 34, for a faculty dinner in two weeks. Happy to buy, borrow or swap one of mine.', 400, true, '2026-10-24', 'open', '2026-10-09T19:30:00Z', '2026-10-09T19:30:00Z', null, 1, null, null),
  ('r-009', null, 'Desk chair that doesn''t wobble', 'res-living', 'cape-town-tyger-valley', 'My res chair is falling apart. Looking for a sturdy desk chair, ideally one that adjusts. I can collect from campus or nearby.', 300, false, null, 'open', '2026-10-09T10:00:00Z', '2026-10-09T10:00:00Z', null, 0, null, null),
  ('r-010', null, 'Catering for a society braai', 'food', 'durban-umhlanga', 'Our society is having a braai for about 20 people at the end of the month. We need someone to do the meat and two salads; we''ll bring the drinks.', 1500, false, '2026-10-31', 'open', '2026-10-08T16:25:00Z', '2026-10-08T16:25:00Z', null, 2, null, null),
  ('r-011', null, 'Drawing set for Engineering Graphics', 'stationery', 'east-london', 'I need a full drawing set: compass, set squares and a scale ruler. Second-hand is fine as long as nothing is missing.', 250, false, '2026-10-19', 'open', '2026-10-08T07:50:00Z', '2026-10-08T07:50:00Z', null, 1, null, null),
  ('r-012', null, 'Box braids before graduation', 'hair-beauty', 'nelson-mandela-bay', 'Looking for someone to do medium box braids, waist length, the week before graduation. I''ll buy the hair if you tell me how many packs.', 450, false, '2026-11-27', 'open', '2026-10-07T13:35:00Z', '2026-10-07T13:35:00Z', null, 3, null, null),
  ('r-013', null, 'Laptop charger, Lenovo 65W', 'tech', 'potchefstroom', 'My laptop charger stopped working. I need a 65W Lenovo charger with a USB-C plug. Make me an offer, or I can swap a pair of wired headphones.', null, true, null, 'open', '2026-10-06T18:00:00Z', '2026-10-06T18:00:00Z', null, 0, null, null),
  ('r-014', null, 'Python help for my first practical', 'tutoring', 'vanderbijlpark', 'My first Python practical is due in two weeks and my loops keep breaking. Looking for an hour or two of help, online or on campus.', 200, false, '2026-10-23', 'open', '2026-10-06T09:20:00Z', '2026-10-06T09:20:00Z', null, 1, null, null),
  ('r-015', null, 'Kettle for res', 'res-living', 'midrand', 'Looking for a working kettle for my res room. Collecting on campus is easiest.', 150, false, null, 'closed', '2026-10-03T12:00:00Z', '2026-10-03T12:00:00Z', null, 5, null, null),
  ('r-016', null, 'Two tickets to the spring concert', 'tickets-events', 'pretoria', 'Looking for two tickets to the spring concert on the 10th, at or below what you paid.', 300, false, '2026-10-10', 'closed', '2026-09-29T08:30:00Z', '2026-09-29T08:30:00Z', null, 2, null, null)

on conflict do nothing;

-- Sipho's week. Thandi's headset thread is the seed's own; the other five are the new buyers'. Each conversation goes
-- in only if it isn't there (and the buyer has no other thread about that listing); its messages and notifications go
-- in only if the conversation is there.
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, seller_gone, status, created_at, last_message_at, first_reply_at, completed_at, confirmed_at, confirmed_by)
select v.id::uuid, v.listing_id, l.title, l.shop_id, v.buyer_id::uuid, false, v.status, v.created_at::timestamptz, v.last_at::timestamptz,
  v.reply_at::timestamptz, v.completed_at::timestamptz, v.confirmed_at::timestamptz, v.confirmed_by
from (values
  -- Thandi asks about the headset with a swap; Tech corner's reply is still unread.
  ('56ba4d68-2c29-50b8-8706-b78b96e1f1bc', 'l-007', 'deb3fd08-f1e7-51ea-9103-0fb2451d94bf', 'replied',
   '2026-10-13T08:12:00Z', '2026-10-13T09:05:00Z', '2026-10-13T09:05:00Z', null, null, null),
  -- Ayanda bought the keyboard and mouse: Sipho marked it done, so it waits to be marked sold.
  (pg_temp.demo_id('conv-d1')::text, 'dm-002', pg_temp.demo_id('ayanda')::text, 'done',
   '2026-10-10T09:00:00Z', '2026-10-11T12:55:00Z', '2026-10-10T09:20:00Z', '2026-10-11T13:10:00Z', null, null),
  -- Kagiso bought the headphones bundle and confirmed it: a sale this week, and the listing is sold.
  (pg_temp.demo_id('conv-d2')::text, 'dm-005', pg_temp.demo_id('kagiso')::text, 'confirmed',
   '2026-10-08T10:30:00Z', '2026-10-08T11:02:00Z', '2026-10-08T10:50:00Z', '2026-10-09T15:00:00Z', '2026-10-09T18:00:00Z', 'buyer'),
  -- Zanele is haggling over the laptop; her last message is unread.
  (pg_temp.demo_id('conv-d3')::text, 'dm-001', pg_temp.demo_id('zanele')::text, 'replied',
   '2026-10-12T10:30:00Z', '2026-10-12T11:40:00Z', '2026-10-12T11:05:00Z', null, null, null),
  -- Kagiso asked about the tripod this morning: a buyer waiting for a first reply.
  (pg_temp.demo_id('conv-d4')::text, 'dm-003', pg_temp.demo_id('kagiso')::text, 'asked',
   '2026-10-13T07:50:00Z', '2026-10-13T07:50:00Z', null, null, null, null),
  -- Zanele asked about the camera last week and is saving up.
  (pg_temp.demo_id('conv-d5')::text, 'dm-004', pg_temp.demo_id('zanele')::text, 'replied',
   '2026-10-07T14:00:00Z', '2026-10-07T15:10:00Z', '2026-10-07T14:30:00Z', null, null, null)
) as v (id, listing_id, buyer_id, status, created_at, last_at, reply_at, completed_at, confirmed_at, confirmed_by)
join public.listings l on l.id = v.listing_id
on conflict do nothing;

insert into public.messages (id, conversation_id, side, body, swap_offer, sent_at, read_at)
select v.id::uuid, v.conversation_id::uuid, v.side, v.body, v.swap_offer, v.sent_at::timestamptz, v.read_at::timestamptz
from (values
  ('8ed6dfb1-6e36-5427-83c6-b066c25702f8', '56ba4d68-2c29-50b8-8706-b78b96e1f1bc', 'buyer',
   'Hi! Is the headset still available? I''d like to swap for it if you''re open to that.',
   'A JBL Go 3 Bluetooth speaker, about a year old', '2026-10-13T08:12:00Z', '2026-10-13T09:01:00Z'),
  ('c4e50324-a42f-5c98-b50f-037178577d5e', '56ba4d68-2c29-50b8-8706-b78b96e1f1bc', 'seller',
   E'Hi Thandi, it is. Can I see the speaker first?\nI''m at the library entrance after 12:00 most days.',
   null, '2026-10-13T09:05:00Z', null),
  (pg_temp.demo_id('msg-d1-1')::text, pg_temp.demo_id('conv-d1')::text, 'buyer',
   'Hi! Are the keyboard and mouse still available? Does the mouse scroll smoothly?', null, '2026-10-10T09:00:00Z', '2026-10-10T09:18:00Z'),
  (pg_temp.demo_id('msg-d1-2')::text, pg_temp.demo_id('conv-d1')::text, 'seller',
   'Hi Ayanda, they are, and it scrolls fine. I can meet you at the library entrance tomorrow at 12:30.', null, '2026-10-10T09:20:00Z', '2026-10-10T09:25:00Z'),
  (pg_temp.demo_id('msg-d1-3')::text, pg_temp.demo_id('conv-d1')::text, 'buyer',
   'Great, see you then.', null, '2026-10-10T09:26:00Z', '2026-10-10T10:00:00Z'),
  (pg_temp.demo_id('msg-d1-4')::text, pg_temp.demo_id('conv-d1')::text, 'buyer',
   'Thanks again, both work perfectly.', null, '2026-10-11T12:55:00Z', '2026-10-11T13:05:00Z'),
  (pg_temp.demo_id('msg-d2-1')::text, pg_temp.demo_id('conv-d2')::text, 'buyer',
   'Hi, is the headphones and case bundle still available? I have an iPhone 12.', null, '2026-10-08T10:30:00Z', '2026-10-08T10:45:00Z'),
  (pg_temp.demo_id('msg-d2-2')::text, pg_temp.demo_id('conv-d2')::text, 'seller',
   'It is, and the case fits the 12 exactly. Main reception at 14:00 tomorrow?', null, '2026-10-08T10:50:00Z', '2026-10-08T11:00:00Z'),
  (pg_temp.demo_id('msg-d2-3')::text, pg_temp.demo_id('conv-d2')::text, 'buyer',
   'Done, see you at two.', null, '2026-10-08T11:02:00Z', '2026-10-08T11:30:00Z'),
  (pg_temp.demo_id('msg-d3-1')::text, pg_temp.demo_id('conv-d3')::text, 'buyer',
   'Hi! Is the ThinkPad still available? Would you take R3,800?', null, '2026-10-12T10:30:00Z', '2026-10-12T11:00:00Z'),
  (pg_temp.demo_id('msg-d3-2')::text, pg_temp.demo_id('conv-d3')::text, 'seller',
   'Hi Zanele, it is. I can do R4,000 with the charger. Do you want to see it at reception first?', null, '2026-10-12T11:05:00Z', '2026-10-12T11:30:00Z'),
  (pg_temp.demo_id('msg-d3-3')::text, pg_temp.demo_id('conv-d3')::text, 'buyer',
   'Yes please. Is Thursday after 14:00 okay?', null, '2026-10-12T11:40:00Z', null),
  (pg_temp.demo_id('msg-d4-1')::text, pg_temp.demo_id('conv-d4')::text, 'buyer',
   'Hi, is the tripod still available? Does the remote work with Android?', null, '2026-10-13T07:50:00Z', null),
  (pg_temp.demo_id('msg-d5-1')::text, pg_temp.demo_id('conv-d5')::text, 'buyer',
   'Hi, how many shots has the camera taken? I''m starting photography this semester.', null, '2026-10-07T14:00:00Z', '2026-10-07T14:20:00Z'),
  (pg_temp.demo_id('msg-d5-2')::text, pg_temp.demo_id('conv-d5')::text, 'seller',
   'About 4,000, so it has years left. The bag and a spare battery come with it.', null, '2026-10-07T14:30:00Z', '2026-10-07T15:00:00Z'),
  (pg_temp.demo_id('msg-d5-3')::text, pg_temp.demo_id('conv-d5')::text, 'buyer',
   'Nice. Let me save up for a week and I''ll come back to you.', null, '2026-10-07T15:10:00Z', '2026-10-07T15:30:00Z')
) as v (id, conversation_id, side, body, swap_offer, sent_at, read_at)
where exists (select 1 from public.conversations c where c.id = v.conversation_id::uuid)
on conflict do nothing;

-- Notifications, in lib/messaging/notification-text.ts's words. Sipho has two unread: Zanele's reply and Kagiso's
-- question. Ayanda is asked to confirm the keyboard sale.
insert into public.notifications (id, account_id, kind, subject_id, text, href, created_at, read_at)
select v.id::uuid, v.account_id::uuid, v.kind, v.subject_id, v.text, '/messages/' || v.subject_id, v.created_at::timestamptz, v.read_at::timestamptz
from (values
  ('3ed88fbb-5282-5b97-bc46-96302591f0a7', 'deb3fd08-f1e7-51ea-9103-0fb2451d94bf', 'message', '56ba4d68-2c29-50b8-8706-b78b96e1f1bc',
   'Tech corner replied about Gaming headset, barely used', '2026-10-13T09:05:00Z', null),
  ('8422b8ed-0e41-5bbb-ae58-83affeefac43', '11c18c13-a088-55c2-bacc-a95b612da2ea', 'message', '56ba4d68-2c29-50b8-8706-b78b96e1f1bc',
   'Thandi asked about Gaming headset, barely used', '2026-10-13T08:12:00Z', '2026-10-13T09:01:00Z'),
  (pg_temp.demo_id('note-d1-1')::text, '11c18c13-a088-55c2-bacc-a95b612da2ea', 'message', pg_temp.demo_id('conv-d1')::text,
   'Ayanda asked about Wireless keyboard and mouse', '2026-10-10T09:00:00Z', '2026-10-10T09:18:00Z'),
  (pg_temp.demo_id('note-d1-2')::text, pg_temp.demo_id('ayanda')::text, 'message', pg_temp.demo_id('conv-d1')::text,
   'Tech corner replied about Wireless keyboard and mouse', '2026-10-10T09:20:00Z', '2026-10-10T09:25:00Z'),
  (pg_temp.demo_id('note-d1-3')::text, pg_temp.demo_id('ayanda')::text, 'sale-to-confirm', pg_temp.demo_id('conv-d1')::text,
   'Tech corner marked Wireless keyboard and mouse as done. Did the sale happen?', '2026-10-11T13:10:00Z', null),
  (pg_temp.demo_id('note-d2-1')::text, '11c18c13-a088-55c2-bacc-a95b612da2ea', 'message', pg_temp.demo_id('conv-d2')::text,
   'Kagiso asked about Sony headphones and a phone case', '2026-10-08T10:30:00Z', '2026-10-08T10:45:00Z'),
  (pg_temp.demo_id('note-d2-2')::text, pg_temp.demo_id('kagiso')::text, 'message', pg_temp.demo_id('conv-d2')::text,
   'Tech corner replied about Sony headphones and a phone case', '2026-10-08T10:50:00Z', '2026-10-08T11:00:00Z'),
  (pg_temp.demo_id('note-d3-1')::text, '11c18c13-a088-55c2-bacc-a95b612da2ea', 'message', pg_temp.demo_id('conv-d3')::text,
   'Zanele asked about Lenovo ThinkPad T480, 8 GB RAM', '2026-10-12T10:30:00Z', '2026-10-12T11:00:00Z'),
  (pg_temp.demo_id('note-d3-2')::text, pg_temp.demo_id('zanele')::text, 'message', pg_temp.demo_id('conv-d3')::text,
   'Tech corner replied about Lenovo ThinkPad T480, 8 GB RAM', '2026-10-12T11:05:00Z', '2026-10-12T11:30:00Z'),
  (pg_temp.demo_id('note-d3-3')::text, '11c18c13-a088-55c2-bacc-a95b612da2ea', 'message', pg_temp.demo_id('conv-d3')::text,
   'Zanele replied about Lenovo ThinkPad T480, 8 GB RAM', '2026-10-12T11:40:00Z', null),
  (pg_temp.demo_id('note-d4-1')::text, '11c18c13-a088-55c2-bacc-a95b612da2ea', 'message', pg_temp.demo_id('conv-d4')::text,
   'Kagiso asked about Phone tripod with a Bluetooth remote', '2026-10-13T07:50:00Z', null),
  (pg_temp.demo_id('note-d5-1')::text, '11c18c13-a088-55c2-bacc-a95b612da2ea', 'message', pg_temp.demo_id('conv-d5')::text,
   'Zanele asked about Canon camera with a tripod', '2026-10-07T14:00:00Z', '2026-10-07T14:20:00Z'),
  (pg_temp.demo_id('note-d5-2')::text, pg_temp.demo_id('zanele')::text, 'message', pg_temp.demo_id('conv-d5')::text,
   'Tech corner replied about Canon camera with a tripod', '2026-10-07T14:30:00Z', '2026-10-07T15:00:00Z')
) as v (id, account_id, kind, subject_id, text, created_at, read_at)
where exists (select 1 from public.conversations c where c.id = v.subject_id::uuid)
on conflict do nothing;

-- Naledi's check-in and note about Sipho, and Thandi's slot request at "Office hours: your first listing", from the seed.
insert into public.mentor_notes (id, owner_id, kind, check_in_on, text, author_id, author_name, created_at) values
  ('8ddc6b40-ebb8-5ae6-a593-91fa05efda8a', '11c18c13-a088-55c2-bacc-a95b612da2ea', 'check-in', '2026-10-06', 'Met Sipho at the Hub. We priced his calculators against new ones, and he''ll list two more by Friday.', 'bfad90c4-30ec-5ca2-bf9c-ec7af7909917', 'Naledi', '2026-10-06T12:30:00.000Z'),
  ('2aa3ad54-00d0-5572-8e13-d26cacbc1dd2', '11c18c13-a088-55c2-bacc-a95b612da2ea', 'note', null, 'Replies fast. Next: photos on a plain background, and a listing for the headset''s case.', 'bfad90c4-30ec-5ca2-bf9c-ec7af7909917', 'Naledi', '2026-10-13T15:10:00.000Z')
on conflict do nothing;

insert into public.hub_bookings (id, post_id, account_id, help, time, status, created_at, answered_at, answered_by)
select '04c7688a-8557-59ce-bdfe-433bcf389991', 'h-007', 'deb3fd08-f1e7-51ea-9103-0fb2451d94bf',
  'I want to sell my braiding on CampusCart and don''t know how to write the listing or what to charge.',
  'Any time after 13:30', 'open', '2026-10-13T10:15:00.000Z', null, null
where exists (select 1 from public.hub_posts where id = 'h-007')
on conflict do nothing;

-- The dates. The samples' "now" is 13 October 2026, 16:00 UTC; the Casio (l-001) was listed at 07:40 UTC on 12 October
-- and shows how far the samples have already moved. Whole days, so times of day stay as written; capped at now.
do $$
declare
  samples_now constant timestamptz := '2026-10-13T16:00:00Z';
  casio_listed constant timestamptz := '2026-10-12T07:40:00Z';
  wanted int := floor(extract(epoch from (now() - samples_now)) / 86400)::int;
  moved int;
  d interval;
  convs uuid[] := array[
    '56ba4d68-2c29-50b8-8706-b78b96e1f1bc', '1c2c009f-9fd9-5f7f-8045-3dcb610fa39d',
    pg_temp.demo_id('conv-d1'), pg_temp.demo_id('conv-d2'), pg_temp.demo_id('conv-d3'), pg_temp.demo_id('conv-d4'),
    pg_temp.demo_id('conv-d5')
  ]::uuid[];
  msgs uuid[] := array[
    '8ed6dfb1-6e36-5427-83c6-b066c25702f8', 'c4e50324-a42f-5c98-b50f-037178577d5e',
    'd2f69861-a223-5f28-8c2f-f9c67334934f', 'b09653d3-dbbf-52a9-973d-5914acb3a9a1',
    '12488ce1-1ab5-5882-8f9f-74c551edde0c'
  ]::uuid[] || array(
    select pg_temp.demo_id(n) from unnest(array['msg-d1-1', 'msg-d1-2', 'msg-d1-3', 'msg-d1-4', 'msg-d2-1', 'msg-d2-2',
      'msg-d2-3', 'msg-d3-1', 'msg-d3-2', 'msg-d3-3', 'msg-d4-1', 'msg-d5-1', 'msg-d5-2', 'msg-d5-3']) as n
  );
  notes uuid[] := array[
    '3ed88fbb-5282-5b97-bc46-96302591f0a7', '6da9cc38-f813-5822-b3da-b897056fe6b7',
    '8422b8ed-0e41-5bbb-ae58-83affeefac43', 'b3602429-faab-51a5-bbad-a987b1a68006'
  ]::uuid[] || array(
    select pg_temp.demo_id(n) from unnest(array['note-d1-1', 'note-d1-2', 'note-d1-3', 'note-d2-1', 'note-d2-2',
      'note-d3-1', 'note-d3-2', 'note-d3-3', 'note-d4-1', 'note-d5-1', 'note-d5-2']) as n
  );
begin
  select round(extract(epoch from (created_at - casio_listed)) / 86400)::int into moved
  from public.listings where id = 'l-001';
  if wanted - moved <= 0 then
    raise notice 'dates: already current (moved % days), nothing to move', moved;
    return;
  end if;
  d := make_interval(days => wanted - moved);

  alter table public.listings disable trigger listings_keep_first_published_at;
  update public.listings
  set created_at = pg_temp.moved(created_at, d),
      first_published_at = pg_temp.moved(first_published_at, d),
      updated_at = pg_temp.moved(updated_at, d)
  where id ~ '^(l-0[0-9]{2}|fs-00[0-9]|dm-0[0-9]{2})$';
  alter table public.listings enable trigger listings_keep_first_published_at;

  update public.requests
  set created_at = pg_temp.moved(created_at, d),
      updated_at = pg_temp.moved(updated_at, d),
      needed_by = needed_by + (wanted - moved),
      closed_at = pg_temp.moved(closed_at, d)
  where id ~ '^r-0[0-9]{2}$' and asker_id is null;

  update public.conversations
  set created_at = pg_temp.moved(created_at, d),
      last_message_at = pg_temp.moved(last_message_at, d),
      first_reply_at = pg_temp.moved(first_reply_at, d),
      completed_at = pg_temp.moved(completed_at, d),
      confirmed_at = pg_temp.moved(confirmed_at, d)
  where id = any(convs);

  update public.messages
  set sent_at = pg_temp.moved(sent_at, d), read_at = pg_temp.moved(read_at, d)
  where id = any(msgs);

  -- A thread someone has written in since keeps its latest message as its last.
  update public.conversations c
  set last_message_at = m.last_at
  from (select conversation_id, max(sent_at) as last_at from public.messages group by conversation_id) m
  where c.id = any(convs) and m.conversation_id = c.id;

  update public.notifications
  set created_at = pg_temp.moved(created_at, d), read_at = pg_temp.moved(read_at, d)
  where id = any(notes);

  update public.mentor_notes
  set created_at = pg_temp.moved(created_at, d), check_in_on = check_in_on + (wanted - moved)
  where id in ('8ddc6b40-ebb8-5ae6-a593-91fa05efda8a', '2aa3ad54-00d0-5572-8e13-d26cacbc1dd2');

  update public.hub_bookings
  set created_at = pg_temp.moved(created_at, d)
  where id = '04c7688a-8557-59ce-bdfe-433bcf389991';

  raise notice 'dates: moved forward % days (% in all)', wanted - moved, wanted;
end
$$;

commit;

-- What's there now.
select 'Midrand listings on sale' as what, count(*)::text as now
from public.listings where campus_slug = 'midrand' and state = 'available' and hidden_at is null
union all
select 'Midrand Tech on sale', count(*)::text
from public.listings where campus_slug = 'midrand' and category_slug = 'tech' and state = 'available' and hidden_at is null
union all
select 'open Looking For requests', count(*)::text from public.requests where status = 'open' and hidden_at is null
union all
select 'Tech corner conversations', count(*)::text
from public.conversations where shop_id = (select id from public.shops where slug = 'tech-corner')
union all
select 'Thandi''s threads about the Casio', count(*)::text
from public.conversations where listing_id = 'l-001' and buyer_id = 'deb3fd08-f1e7-51ea-9103-0fb2451d94bf'
union all
select 'newest listing (SAST)', to_char(max(first_published_at) at time zone 'Africa/Johannesburg', 'DD Mon HH24:MI')
from public.listings;
