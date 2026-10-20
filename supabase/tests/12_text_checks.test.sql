-- The text backstops (I3 of the phase A review): the tables refuse text the app's cleaning would never send. cleanText
-- (lib/messaging/rules.ts) drops control characters but line breaks and tabs, and the invisible and direction-changing
-- characters; cleanLine (lib/selling/rules.ts) also makes every run of white space one space; checkFirstName
-- (lib/auth/profile.ts) composes, drops every control and format character and tidies the spaces.
begin;
select plan(43);

insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e1', 'text@eduvos.com');
insert into public.profiles (id, first_name, campus_slug) values ('00000000-0000-4000-8000-0000000000e1', 'Thandi', 'test-campus');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  ('10000000-0000-4000-8000-0000000000e1', 'test-text-shop', null, 'Text shop', 'test-category', 'test-campus', '2026-01');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('t-text', '10000000-0000-4000-8000-0000000000e1', 'available', 'item', 'Lamp', 'test-category', 'good', 100, 'cash', 'A lamp.', 'online', 'test-campus', now());
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id) values
  ('40000000-0000-4000-8000-0000000000e1', 't-text', 'Lamp', '10000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e1');

-- The rules themselves, character by character.
select is(
  (select array_agg(c order by c) from generate_series(1, 159) c
   where (c < 32 or c >= 127) and c not in (9, 10) and private.is_clean_text(chr(c))),
  null,
  'every control character but a tab and a line break is refused (Unicode''s Cc, as cleanText drops them)'
);
select is(private.is_clean_text(E'one\ntwo\tthree'), true, 'line breaks and tabs stay in multi-line text');
select is(private.is_clean_text(E'one\r\ntwo'), false, 'a carriage return is refused (cleanText makes it a line break)');
select is(
  (select array_agg(to_hex(c) order by c) from unnest(array[x'200b'::int, x'200e'::int, x'200f'::int, x'202a'::int, x'202b'::int, x'202c'::int, x'202d'::int, x'202e'::int, x'2060'::int, x'2066'::int, x'2067'::int, x'2068'::int, x'2069'::int, x'feff'::int]) c
   where private.is_clean_text('a' || chr(c) || 'b')),
  null,
  'every invisible and direction-changing character cleanText drops is refused'
);
select is(private.is_clean_text(E'family \U0001F468‍\U0001F469‍\U0001F467'), true, 'the zero-width joiner stays, for emoji');
select is(private.is_clean_text('Café 15% off — R50 ✓'), true, 'ordinary text is fine');
select is(private.is_clean_line(E'one\ntwo'), false, 'a line has no line break');
select is(private.is_clean_line(E'one\ttwo'), false, 'nor a tab');
select is(private.is_clean_line(E'one‮two'), false, 'nor a direction override');
select is(private.is_clean_line('One line, fine'), true, 'one clean line is fine');

-- Messages and swap offers: clean text, line breaks allowed.
select lives_ok(
  $$insert into public.messages (conversation_id, side, body, swap_offer) values ('40000000-0000-4000-8000-0000000000e1', 'buyer', E'Hi!\nIs it there?', E'A lamp\nor two')$$,
  'a message keeps its line breaks, and so does a swap offer'
);
select throws_ok(
  $$insert into public.messages (conversation_id, side, body) values ('40000000-0000-4000-8000-0000000000e1', 'buyer', E'Pay here‮gnp.exe')$$,
  '23514', null, 'a message with a direction override is refused'
);
select throws_ok(
  $$insert into public.messages (conversation_id, side, body) values ('40000000-0000-4000-8000-0000000000e1', 'buyer', E'Hidden​word')$$,
  '23514', null, 'so is one with a zero-width space'
);
select throws_ok(
  $$insert into public.messages (conversation_id, side, body) values ('40000000-0000-4000-8000-0000000000e1', 'buyer', E'Bell\u0007')$$,
  '23514', null, 'and one with a control character'
);
select throws_ok(
  $$insert into public.messages (conversation_id, side, body, swap_offer) values ('40000000-0000-4000-8000-0000000000e1', 'buyer', 'Hi', E'A⁦lamp')$$,
  '23514', null, 'a swap offer is clean too'
);

-- Listings: the title and swap wish are one line; the description keeps its line breaks.
create function pg_temp.listing(title text, swap_for text, description text) returns void language sql as $f$
  insert into public.listings (shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, swap_for, description, handover, campus_slug, first_published_at)
  values ('10000000-0000-4000-8000-0000000000e1', 'available', 'item', title, 'test-category', 'good', case when swap_for is null then 100 end,
    case when swap_for is null then 'cash' else 'swap' end, swap_for, description, 'online', 'test-campus', now());
$f$;
select lives_ok($$select pg_temp.listing('Desk lamp', null, E'Works well.\n\nCollect on campus.')$$, 'a description keeps its line breaks');
select throws_ok($$select pg_temp.listing(E'Desk\nlamp', null, 'A lamp.')$$, '23514', null, 'a title is one line');
select throws_ok($$select pg_temp.listing(E'Desk lamp‏', null, 'A lamp.')$$, '23514', null, 'and clean');
select throws_ok($$select pg_temp.listing('Desk lamp', E'A\nkettle', 'A lamp.')$$, '23514', null, 'a swap wish is one line');
select throws_ok($$select pg_temp.listing('Desk lamp', null, E'A lamp.‮')$$, '23514', null, 'a description is clean');
select lives_ok($$select pg_temp.listing('Desk lamp', 'A kettle', 'A lamp.')$$, 'a clean listing with a swap wish is fine');

-- Shops: the name and tagline are one line; the about keeps its line breaks.
select lives_ok(
  $$insert into public.shops (slug, name, tagline, about, category_slug, campus_slug, since) values ('test-text-ok', 'Clean shop', 'Good things', E'We sell.\nWe deliver.', 'test-category', 'test-campus', '2026-01')$$,
  'an about keeps its line breaks'
);
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since) values ('test-text-1', E'Clean\nshop', 'test-category', 'test-campus', '2026-01')$$,
  '23514', null, 'a shop name is one line'
);
select throws_ok(
  $$insert into public.shops (slug, name, category_slug, campus_slug, since) values ('test-text-2', E'Clean⁧shop', 'test-category', 'test-campus', '2026-01')$$,
  '23514', null, 'and clean'
);
select throws_ok(
  $$insert into public.shops (slug, name, tagline, category_slug, campus_slug, since) values ('test-text-3', 'Shop three', E'Good\tthings', 'test-category', 'test-campus', '2026-01')$$,
  '23514', null, 'a tagline is one line'
);
select throws_ok(
  $$insert into public.shops (slug, name, about, category_slug, campus_slug, since) values ('test-text-4', 'Shop four', E'We sell.﻿', 'test-category', 'test-campus', '2026-01')$$,
  '23514', null, 'an about is clean'
);

-- Reports: the detail keeps its line breaks; a conversation's copy of a title is one line.
select lives_ok(
  $$insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, detail) values ('00000000-0000-4000-8000-0000000000e1', 'listing', 't-text', 'Lamp', 'scam', E'Asked for a deposit.\nTwice.')$$,
  'a report''s detail keeps its line breaks'
);
select throws_ok(
  $$insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, detail) values ('00000000-0000-4000-8000-0000000000e1', 'seller', 'test-text-shop', 'Text shop', 'scam', E'Odd‎')$$,
  '23514', null, 'and is clean'
);
select throws_ok(
  $$insert into public.reports (reporter_id, target_kind, target_id, target_title, reason) values ('00000000-0000-4000-8000-0000000000e1', 'request', 'r-001', E'Need a\nlift', 'scam')$$,
  '23514', null, 'a report''s copy of a title is one line'
);
select throws_ok(
  $$update public.conversations set listing_title = E'Lamp\n' where id = '40000000-0000-4000-8000-0000000000e1'$$,
  '23514', null, 'so is a conversation''s'
);

-- First names: as checkFirstName leaves them.
create function pg_temp.name_ok(name text) returns boolean language plpgsql as $f$
begin
  update public.profiles set first_name = name where id = '00000000-0000-4000-8000-0000000000e1';
  return true;
exception when check_violation then
  return false;
end;
$f$;
select is(pg_temp.name_ok('Zé Ngubane-Smith'), true, 'a first name with accents, a space and a hyphen is fine');
select is(pg_temp.name_ok('李'), false, 'one character is too short');
select is(pg_temp.name_ok('李雷'), true, 'two letters of any script are fine');
select is(pg_temp.name_ok(repeat('a', 41)), false, 'over 40 is too long');
select is(pg_temp.name_ok('12'), false, 'a name has a letter');
select is(pg_temp.name_ok(' Thandi'), false, 'no outer space');
select is(pg_temp.name_ok('Thandi  Mary'), false, 'no double space');
select is(pg_temp.name_ok(E'Thandi Mary'), false, 'no other kind of space');
select is(pg_temp.name_ok(E'Thandi\nMary'), false, 'no line break');
select is(pg_temp.name_ok(E'Thandi​Mary'), false, 'no zero-width space');
select is(pg_temp.name_ok(E'Thandi­Mary'), false, 'no soft hyphen (a format character)');
select is(pg_temp.name_ok(E'Thandi\U000E0041'), false, 'no tag character');
select is(pg_temp.name_ok(E'Zé'), false, 'composed (NFC), never an accent apart');

select * from finish();
rollback;
