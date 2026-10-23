-- Schema catch-up, Task 4: the Hub's actions on shops, reports, listings and requests (supabase schema catch-up plan,
-- decision 1; lib/staff/admin-actions.ts, lib/data/staff-shops.ts, lib/data/staff-reports.ts, lib/data/requests.ts,
-- lib/data/audit.ts, lib/staff/notification-text.ts, lib/looking-for/words.ts, lib/data/reports.ts).
-- The expected sentences were printed from the TypeScript (shopApprovedText and the rest) on 2026-10-20.
begin;
select plan(153);

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
-- Accounts, shops and reports by their last two characters.
create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.r(n text) returns uuid language sql immutable as $f$
  select ('60000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
grant execute on function pg_temp.a(text), pg_temp.s(text), pg_temp.r(text) to public;

-- What a step left behind, as text: each notification (who, kind, subject, sentence, link) and each audit entry (who
-- acted, their name then, action, target, detail, about whom, made now), in a fixed order. pg_temp.clear() starts a step
-- with neither (the test runs as the database's owner; no API role can delete either).
create function pg_temp.notes() returns text[] language sql as $f$
  select coalesce(array_agg(
    concat_ws(' | ', p.first_name, n.kind, n.subject_id, n.text, n.href) order by p.first_name, n.kind, n.subject_id
  ), '{}')
  from public.notifications n join public.profiles p on p.id = n.account_id;
$f$;
create function pg_temp.audit() returns text[] language sql as $f$
  select coalesce(array_agg(
    concat_ws(' | ',
      coalesce((select p.first_name from public.profiles p where p.id = l.staff_id), '-'), l.staff_name, l.action,
      l.target_kind, l.target_id, l.target_name, l.detail,
      coalesce((select p.first_name from public.profiles p where p.id = l.subject_id), '-'), (l.at = now())::text)
    order by l.action, l.target_id
  ), '{}')
  from public.audit_log l;
$f$;
create function pg_temp.clear() returns void language sql as $f$
  delete from public.notifications;
  delete from public.audit_log;
$f$;
-- A seller profile's standing, as text.
create function pg_temp.standing(n text) returns text language sql as $f$
  select concat_ws(' | ', status, coalesce(paused_by, '-'), seller_paused_too::text, coalesce(staff_reason, '-'),
    (declined_at is not null)::text, (approved_at is not null)::text)
  from public.seller_profiles where account_id = pg_temp.a(n);
$f$;
-- A report's state, as text.
create function pg_temp.report(n text) returns text language sql as $f$
  select concat_ws(' | ', r.status, coalesce(r.outcome, '-'), coalesce(r.note, '-'),
    coalesce((select p.first_name from public.profiles p where p.id = r.closed_by), '-'), coalesce((r.closed_at = now())::text, '-'))
  from public.reports r where r.id = pg_temp.r(n);
$f$;

-- Places.
insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);

-- People:
-- f1 Sipho, a waiting shop;                    f2 Naledi, a waiting shop the Hub declines;
-- f3 Lerato, an open shop;                      f4 Thandi, a student who reports;
-- f5 Adam, an admin;                            f6 Mona, a mentor;
-- f7 Dumi, an admin who loses the role;         f8 Kabelo, a mentor whose shop he paused himself;
-- f9 Zola, a student who asks and reports.      f0 is a sample shop no account owns.
insert into auth.users (id, email)
select pg_temp.a(n), 'act' || n || '@eduvos.com'
from unnest(array['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('f1'), 'Sipho', 'test-campus', '{}'),
  (pg_temp.a('f2'), 'Naledi', 'test-campus', '{}'),
  (pg_temp.a('f3'), 'Lerato', 'test-campus', '{}'),
  (pg_temp.a('f4'), 'Thandi', 'test-campus', '{}'),
  (pg_temp.a('f5'), 'Adam', 'test-campus', '{admin}'),
  (pg_temp.a('f6'), 'Mona', 'test-campus', '{mentor}'),
  (pg_temp.a('f7'), 'Dumi', 'test-campus', '{admin}'),
  (pg_temp.a('f8'), 'Kabelo', 'test-campus', '{mentor}'),
  (pg_temp.a('f9'), 'Zola', 'test-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('f1'), 'act-sipho', pg_temp.a('f1'), 'Sipho prints', 'test-category', 'test-campus', '2026-01'),
  (pg_temp.s('f2'), 'act-naledi', pg_temp.a('f2'), 'Naledi bakes', 'test-category', 'test-campus', '2026-01'),
  (pg_temp.s('f3'), 'act-lerato', pg_temp.a('f3'), 'Lerato crafts', 'test-category', 'test-campus', '2026-01'),
  (pg_temp.s('f8'), 'act-kabelo', pg_temp.a('f8'), 'Kabelo kicks', 'test-category', 'test-campus', '2026-01'),
  (pg_temp.s('f0'), 'act-sample', null, 'Sample stall', 'test-category', 'test-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, paused_by, approved_at) values
  (pg_temp.a('f1'), 'pending', pg_temp.s('f1'), now() - interval '2 days', null, null),
  (pg_temp.a('f2'), 'pending', pg_temp.s('f2'), now() - interval '2 days', null, null),
  (pg_temp.a('f3'), 'approved', pg_temp.s('f3'), now() - interval '9 days', null, now() - interval '8 days'),
  (pg_temp.a('f8'), 'paused', pg_temp.s('f8'), now() - interval '9 days', 'seller', now() - interval '8 days');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('act-l1', pg_temp.s('f3'), 'available', 'item', 'Graphing calculator', 'test-category', 'good', 300, 'cash', 'A calculator.', 'online', 'test-campus', now()),
  ('act-l2', pg_temp.s('f3'), 'sold', 'item', 'Old textbook', 'test-category', 'good', 100, 'cash', 'A textbook.', 'online', 'test-campus', now()),
  ('act-l3', pg_temp.s('f0'), 'available', 'item', 'Sample lamp', 'test-category', 'good', 100, 'cash', 'A lamp.', 'online', 'test-campus', now()),
  ('act-l4', pg_temp.s('f8'), 'available', 'item', 'Running shoes', 'test-category', 'good', 400, 'cash', 'Shoes.', 'online', 'test-campus', now()),
  ('act-l5', pg_temp.s('f3'), 'paused', 'item', 'Beaded bracelet', 'test-category', 'good', 50, 'cash', 'A bracelet.', 'online', 'test-campus', now());
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details, created_at, updated_at) values
  ('act-r1', pg_temp.a('f9'), 'Need a desk lamp', 'test-category', 'test-campus', 'A lamp for late study nights.', now() - interval '3 days', now() - interval '3 days'),
  ('act-r2', null, 'Lift to Midrand', 'test-category', 'test-campus', 'A lift on Friday mornings, please.', now() - interval '3 days', now() - interval '3 days');
insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason, status, outcome, note, closed_at, closed_by, target_gone) values
  -- On Lerato's calculator: two open, one about it already dismissed.
  (pg_temp.r('f1'), pg_temp.a('f9'), 'listing', 'act-l1', 'Graphing calculator', 'scam', 'open', null, null, null, null, false),
  (pg_temp.r('f2'), pg_temp.a('f4'), 'listing', 'act-l1', 'Graphing calculator', 'misleading', 'open', null, null, null, null, false),
  (pg_temp.r('f3'), pg_temp.a('f6'), 'listing', 'act-l1', 'Graphing calculator', 'spam', 'closed', 'dismissed', 'Looked fine.', now() - interval '1 day', pg_temp.a('f5'), false),
  -- On Lerato's shop and her bracelet; one about a shop that had her link and has gone.
  (pg_temp.r('f4'), pg_temp.a('f4'), 'seller', 'act-lerato', 'Lerato crafts', 'scam', 'open', null, null, null, null, false),
  (pg_temp.r('f5'), pg_temp.a('f9'), 'listing', 'act-l5', 'Beaded bracelet', 'prohibited', 'open', null, null, null, null, false),
  (pg_temp.r('f6'), pg_temp.a('f9'), 'seller', 'act-lerato', 'An older shop', 'spam', 'open', null, null, null, null, true),
  -- On Kabelo's shoes, and on Zola's request.
  (pg_temp.r('f7'), pg_temp.a('f4'), 'listing', 'act-l4', 'Running shoes', 'other', 'open', null, null, null, null, false),
  (pg_temp.r('f8'), pg_temp.a('f4'), 'request', 'act-r1', 'Need a desk lamp', 'spam', 'open', null, null, null, null, false);

-- --- The functions ----------------------------------------------------------------------------------------------------

select is(
  array(
    select f from unnest(array[
      'public.approve_shop(uuid)', 'public.decline_shop(uuid, text)', 'public.resend_for_approval()',
      'public.set_shop_verified(uuid, boolean)', 'public.staff_pause_shop(uuid, text)', 'public.staff_resume_shop(uuid)',
      'public.set_shop_mentor(uuid, uuid)', 'public.dismiss_report(uuid, text)', 'public.hide_listing(text, text)',
      'public.hide_request(text, text)', 'public.show_listing(text)', 'public.show_request(text)'
    ]) f
    where has_function_privilege('anon', f, 'execute')
      or not has_function_privilege('authenticated', f, 'execute')
      or not has_function_privilege('service_role', f, 'execute')
  ),
  '{}'::text[],
  'the twelve run for signed-in people and the server, never anon'
);
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname like '%note_text'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('service_role', p.oid, 'execute'))
  ),
  '{}'::text[],
  'the sentences are built only inside the functions'
);

-- --- The sentences and links, as the app writes them ---------------------------------------------------------------

select is(private.shop_approved_note_text('Tech corner'), 'The Hub approved Tech corner. You can publish your listings now.', 'shopApprovedText');
select is(private.shop_decision_note_text('declined', 'Tech corner'), 'The Hub didn''t approve Tech corner yet. See why, and send it again.', 'shopDecisionText: declined');
select is(private.shop_decision_note_text('paused', 'Tech corner'), 'The Hub paused Tech corner. See why on your dashboard.', 'paused');
select is(private.shop_decision_note_text('resumed', 'Tech corner'), 'The Hub resumed Tech corner. Buyers can see it again.', 'resumed');
select is(private.shop_decision_note_text('lifted', 'Tech corner'), 'The Hub lifted its pause on Tech corner. It''s still paused as you set it: resume it from Sell when you''re ready.', 'lifted');
select is(private.shop_decision_note_text('verified', 'Tech corner'), 'Tech corner is now Verified by the Hub.', 'verified');
select is(private.shop_decision_note_text('unverified', 'Tech corner'), 'Tech corner is no longer Verified by the Hub.', 'unverified');
select throws_ok($$select private.shop_decision_note_text('closed', 'Tech corner')$$, '22023', null, 'and no other decision');
select is(private.listing_hidden_note_text('Calculator'), 'The Hub hid Calculator. See why in My listings.', 'listingHiddenText');
select is(private.listing_shown_note_text('Calculator'), 'The Hub is showing Calculator again. It''s back in My listings.', 'listingShownText');
select is(private.report_outcome_note_text('acted', 'Calculator'), 'Thanks, we''ve acted on your report about Calculator.', 'reportOutcomeText: acted');
select is(private.report_outcome_note_text('dismissed', 'Calculator'), 'We looked at your report about Calculator and didn''t find a problem.', 'dismissed');
select is(private.request_hidden_note_text('Need a calculator'), 'The Hub hid your request Need a calculator. See why in Your requests.', 'requestHiddenText');
select is(private.request_shown_note_text('Need a calculator'), 'The Hub is showing your request Need a calculator again.', 'requestShownText');
select is(
  array[private.my_listings_path('available'), private.my_listings_path('paused'), private.my_listings_path('sold'), private.my_listings_path('draft')],
  array['/sell/listings', '/sell/listings?tab=paused', '/sell/listings?tab=sold', '/sell/listings?tab=drafts'],
  'myListingsPath(tabFor(state)) for each state'
);

-- --- Only staff (plan decision 1) -----------------------------------------------------------------------------------

select pg_temp.clear();
-- A student.
select pg_temp.sign_in(pg_temp.a('f4'));
select is(
  array[
    public.approve_shop(pg_temp.a('f1')), public.decline_shop(pg_temp.a('f2'), 'No.'),
    public.set_shop_verified(pg_temp.s('f3'), true), public.staff_pause_shop(pg_temp.s('f3'), 'No.'),
    public.staff_resume_shop(pg_temp.s('f8')), public.set_shop_mentor(pg_temp.s('f3'), pg_temp.a('f6')),
    public.dismiss_report(pg_temp.r('f1'), 'No.'), public.hide_listing('act-l1', 'No.'), public.hide_request('act-r1', 'No.'),
    public.show_listing('act-l1'), public.show_request('act-r1')
  ],
  array_fill('forbidden'::text, array[11]),
  'a student gets forbidden from every staff action'
);
select pg_temp.sign_out();
-- A mentor, from the admin's.
select pg_temp.sign_in(pg_temp.a('f6'));
select is(
  array[
    public.approve_shop(pg_temp.a('f1')), public.decline_shop(pg_temp.a('f2'), 'No.'),
    public.set_shop_verified(pg_temp.s('f3'), true), public.staff_pause_shop(pg_temp.s('f3'), 'No.'),
    public.staff_resume_shop(pg_temp.s('f8')), public.set_shop_mentor(pg_temp.s('f3'), pg_temp.a('f6')),
    public.dismiss_report(pg_temp.r('f1'), 'No.'), public.hide_listing('act-l1', 'No.'), public.hide_request('act-r1', 'No.'),
    public.show_listing('act-l1'), public.show_request('act-r1')
  ],
  array_fill('forbidden'::text, array[11]),
  'so does a mentor: these are the admin''s'
);
select pg_temp.sign_out();
-- An admin whose role was just removed (the go-live item: the role is checked inside the action's transaction).
update public.profiles set roles = '{}' where id = pg_temp.a('f7');
select pg_temp.sign_in(pg_temp.a('f7'));
select is(public.staff_pause_shop(pg_temp.s('f3'), 'No.'), 'forbidden', 'and an admin whose role has gone');
select is(public.approve_shop(pg_temp.a('f1')), 'forbidden', 'for every action');
select pg_temp.sign_out();
select is(
  array[pg_temp.standing('f1'), pg_temp.standing('f2'), pg_temp.standing('f3'), pg_temp.standing('f8')],
  array[
    'pending | - | false | - | false | false', 'pending | - | false | - | false | false',
    'approved | - | false | - | false | true', 'paused | seller | false | - | false | true'
  ],
  'nothing changed on the shops'
);
select is(
  (select row(verified, (select mentor_id from public.seller_profiles where account_id = pg_temp.a('f3')))::text from public.shops where id = pg_temp.s('f3')),
  row(false, null::uuid)::text,
  'nor Verified or the mentor'
);
select is(
  (select count(*) from public.reports where status = 'open'),
  7::bigint,
  'nor the reports'
);
select is(
  (select count(*) from public.listings where hidden_at is not null) + (select count(*) from public.requests where hidden_at is not null),
  0::bigint,
  'nor any listing or request'
);
select is(pg_temp.audit(), '{}'::text[], 'no audit entry was written');
select is(pg_temp.notes(), '{}'::text[], 'and nobody was told');

-- --- Approve (approveShop, staff-shops.ts:125) ------------------------------------------------------------------------

select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.approve_shop(pg_temp.a('f1')), 'changed', 'Adam approves Sipho''s shop');
select pg_temp.sign_out();
select is(pg_temp.standing('f1'), 'approved | - | false | - | false | true', 'it opens, with its first approval''s time');
select is((select approved_at = now() from public.seller_profiles where account_id = pg_temp.a('f1')), true, 'which is now');
select is(
  pg_temp.audit(),
  array['Adam | Adam | shop-approved | shop | act-sipho | Sipho prints |  | Sipho | true'],
  'one audit entry: the shop by its link and name, about its owner'
);
select is(
  pg_temp.notes(),
  array['Sipho | shop-approved | act-sipho | The Hub approved Sipho prints. You can publish your listings now. | /sell'],
  'Sipho is told, with a link to Sell'
);
select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.approve_shop(pg_temp.a('f1')), 'nothing', 'approving it again changes nothing');
select is(public.approve_shop(pg_temp.a('f4')), 'nothing', 'nor does approving a student with no shop');
select is(public.approve_shop(pg_temp.a('f3')), 'nothing', 'or an open shop');
select pg_temp.sign_out();
select is(pg_temp.audit(), '{}'::text[], 'no audit entry for nothing');
select is(pg_temp.notes(), '{}'::text[], 'and nobody told');

-- --- Decline, and Send for approval again (declineShop, resendForApproval: staff-shops.ts:143 and :157) -------------

select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select throws_ok($$select public.decline_shop(pg_temp.a('f2'), '')$$, '23514', null, 'a decline needs a reason');
select throws_ok(format($$select public.decline_shop(pg_temp.a('f2'), %L)$$, repeat('a', 501)), '23514', null, 'of at most 500 characters');
select is(public.decline_shop(pg_temp.a('f2'), E'Add a photo of what you bake.\nThen send it again.'), 'changed', 'Adam declines Naledi''s shop');
select pg_temp.sign_out();
select is(
  pg_temp.standing('f2'),
  E'pending | - | false | Add a photo of what you bake.\nThen send it again. | true | false',
  'it waits, declined, with the reason'
);
select is(
  pg_temp.audit(),
  array[E'Adam | Adam | shop-declined | shop | act-naledi | Naledi bakes | Add a photo of what you bake.\nThen send it again. | Naledi | true'],
  'one audit entry, with the reason as its detail'
);
select is(
  pg_temp.notes(),
  array['Naledi | shop-update | act-naledi | The Hub didn''t approve Naledi bakes yet. See why, and send it again. | /sell'],
  'Naledi is told, without the reason'
);
select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.decline_shop(pg_temp.a('f2'), 'Again.'), 'nothing', 'a declined shop isn''t declined again');
select is(public.approve_shop(pg_temp.a('f2')), 'nothing', 'nor approved before it''s sent again');
select is(public.decline_shop(pg_temp.a('f3'), 'Open.'), 'nothing', 'an open shop isn''t declined');
select pg_temp.sign_out();
select is(pg_temp.standing('f2'), E'pending | - | false | Add a photo of what you bake.\nThen send it again. | true | false', 'so the first reason stays');

select pg_temp.sign_in(pg_temp.a('f4'));
select is(public.resend_for_approval(), 'nothing', 'a student with no shop has nothing to send');
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f1'));
select is(public.resend_for_approval(), 'nothing', 'nor does an approved one');
select pg_temp.sign_out();
select pg_temp.sign_in(pg_temp.a('f2'));
select is(public.resend_for_approval(), 'changed', 'Naledi sends hers again');
select is(public.resend_for_approval(), 'nothing', 'once');
select pg_temp.sign_out();
select is(pg_temp.standing('f2'), 'pending | - | false | - | false | false', 'the decline and its reason are forgotten');
select is((select applied_at = now() from public.seller_profiles where account_id = pg_temp.a('f2')), true, 'and it waits from now');
select is(pg_temp.audit(), '{}'::text[], 'the seller''s own step is not in the audit log');
select is(pg_temp.notes(), '{}'::text[], 'and tells nobody');
select throws_ok($$select public.resend_for_approval()$$, '42501', null, 'nobody signed in can''t send one');

-- --- Verified (setVerified, staff-shops.ts:167) ----------------------------------------------------------------------

select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.set_shop_verified(pg_temp.s('f3'), true), 'changed', 'Adam verifies Lerato''s shop');
select is(public.set_shop_verified(pg_temp.s('f3'), true), 'nothing', 'twice is nothing');
select is(public.set_shop_verified(pg_temp.s('f0'), true), 'changed', 'and the sample stall, which has no owner');
select is(public.set_shop_verified(pg_temp.s('f2'), true), 'nothing', 'but not a waiting shop');
select is(public.set_shop_verified('10000000-0000-4000-8000-0000000000ff', true), 'nothing', 'or one that isn''t there');
select pg_temp.sign_out();
select is(
  array(select slug from public.shops where verified and id in (pg_temp.s('f0'), pg_temp.s('f2'), pg_temp.s('f3')) order by slug),
  array['act-lerato', 'act-sample'],
  'both are Verified'
);
select is(
  pg_temp.audit(),
  array[
    'Adam | Adam | shop-verified | shop | act-lerato | Lerato crafts |  | Lerato | true',
    'Adam | Adam | shop-verified | shop | act-sample | Sample stall |  | - | true'
  ],
  'one entry each, the sample stall''s about nobody'
);
select is(
  pg_temp.notes(),
  array['Lerato | shop-update | act-lerato | Lerato crafts is now Verified by the Hub. | /sell'],
  'only Lerato is told'
);
select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.set_shop_verified(pg_temp.s('f3'), false), 'changed', 'Adam takes Verified away');
select pg_temp.sign_out();
select is(
  pg_temp.audit(),
  array['Adam | Adam | shop-unverified | shop | act-lerato | Lerato crafts |  | Lerato | true'],
  'as shop-unverified'
);
select is(
  pg_temp.notes(),
  array['Lerato | shop-update | act-lerato | Lerato crafts is no longer Verified by the Hub. | /sell'],
  'and Lerato hears it'
);

-- --- Mentors (setShopMentor, staff-shops.ts:219) ---------------------------------------------------------------------

select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.set_shop_mentor(pg_temp.s('f3'), pg_temp.a('f6')), 'changed', 'Adam gives Lerato''s shop Mona as its mentor');
select is(public.set_shop_mentor(pg_temp.s('f3'), pg_temp.a('f6')), 'nothing', 'the same mentor again is nothing');
select is(public.set_shop_mentor(pg_temp.s('f3'), pg_temp.a('f4')), 'nothing', 'a student isn''t a mentor');
select is(public.set_shop_mentor(pg_temp.s('f3'), pg_temp.a('f5')), 'nothing', 'nor is an admin without the mentor role');
select is(public.set_shop_mentor(pg_temp.s('f8'), pg_temp.a('f8')), 'nothing', 'a mentor can''t mentor his own shop');
select is(public.set_shop_mentor(pg_temp.s('f2'), pg_temp.a('f6')), 'nothing', 'a waiting shop has no mentor');
select is(public.set_shop_mentor(pg_temp.s('f0'), pg_temp.a('f6')), 'nothing', 'nor does a sample shop');
select pg_temp.sign_out();
select is(
  (select mentor_id from public.seller_profiles where account_id = pg_temp.a('f3')),
  pg_temp.a('f6'),
  'Mona is Lerato''s mentor'
);
select is(
  pg_temp.audit(),
  array['Adam | Adam | mentor-assigned | shop | act-lerato | Lerato crafts | Mona | Lerato | true'],
  'one entry, naming the mentor'
);
select is(
  pg_temp.notes(),
  array['Mona | staff-role | act-lerato | You''re now mentoring Lerato crafts. | /mentor/act-lerato'],
  'only Mona is told, once (role views N4; spec 2.6 told nobody)'
);
select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.set_shop_mentor(pg_temp.s('f3'), null), 'changed', 'and takes her away again');
select is(public.set_shop_mentor(pg_temp.s('f3'), null), 'nothing', 'once');
select pg_temp.sign_out();
select is(
  pg_temp.audit(),
  array['Adam | Adam | mentor-removed | shop | act-lerato | Lerato crafts |  | Lerato | true'],
  'as mentor-removed'
);

-- --- Hide the listing (hideListing; closeReportsOn, staff-reports.ts:157) ------------------------------------------

select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select throws_ok($$select public.hide_listing('act-l1', '')$$, '23514', null, 'hiding needs a reason');
select is(public.hide_listing('act-l1', 'A copy of a branded calculator.'), 'changed', 'Adam hides Lerato''s calculator');
select is(public.hide_listing('act-l1', 'Again.'), 'nothing', 'twice is nothing');
select is(public.hide_listing('act-none', 'Gone.'), 'nothing', 'nor a listing that isn''t there');
select pg_temp.sign_out();
select is(
  (select row(hidden_at = now(), hidden_reason, state)::text from public.listings where id = 'act-l1'),
  row(true, 'A copy of a branded calculator.', 'available')::text,
  'it''s hidden with the reason, and keeps its state'
);
select is(
  array[pg_temp.report('f1'), pg_temp.report('f2'), pg_temp.report('f3')],
  array[
    'closed | hidden | A copy of a branded calculator. | Adam | true',
    'closed | hidden | A copy of a branded calculator. | Adam | true',
    'closed | dismissed | Looked fine. | Adam | false'
  ],
  'its open reports close as hidden, with the reason; the one already closed stays as it was'
);
select is(
  array[pg_temp.report('f4'), pg_temp.report('f5'), pg_temp.report('f7')],
  array['open | - | - | - | -', 'open | - | - | - | -', 'open | - | - | - | -'],
  'reports about other things stay open'
);
select is(
  pg_temp.audit(),
  array['Adam | Adam | listing-hidden | listing | act-l1 | Graphing calculator | A copy of a branded calculator. | Lerato | true'],
  'one audit entry, about the seller'
);
select is(
  pg_temp.notes(),
  array[
    'Lerato | shop-update | act-l1 | The Hub hid Graphing calculator. See why in My listings. | /sell/listings',
    'Thandi | report-handled | ' || pg_temp.r('f2') || ' | Thanks, we''ve acted on your report about Graphing calculator. | /account/privacy#account-privacy-reports-title',
    'Zola | report-handled | ' || pg_temp.r('f1') || ' | Thanks, we''ve acted on your report about Graphing calculator. | /account/privacy#account-privacy-reports-title'
  ],
  'the seller and each reporter are told'
);

-- Task 5: hiding needs an open report on the target, so the textbook and the lamp are reported first.
insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason) values
  (pg_temp.r('fa'), pg_temp.a('f4'), 'listing', 'act-l2', 'Old textbook', 'misleading'),
  (pg_temp.r('fb'), pg_temp.a('f9'), 'listing', 'act-l3', 'Sample lamp', 'prohibited');
select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.hide_listing('act-l2', 'Sold elsewhere too.'), 'changed', 'a sold listing can be hidden');
select is(public.hide_listing('act-l3', 'Not allowed.'), 'changed', 'and the sample stall''s');
select pg_temp.sign_out();
select is(
  pg_temp.notes(),
  array[
    'Lerato | shop-update | act-l2 | The Hub hid Old textbook. See why in My listings. | /sell/listings?tab=sold',
    'Thandi | report-handled | ' || pg_temp.r('fa') || ' | Thanks, we''ve acted on your report about Old textbook. | /account/privacy#account-privacy-reports-title',
    'Zola | report-handled | ' || pg_temp.r('fb') || ' | Thanks, we''ve acted on your report about Sample lamp. | /account/privacy#account-privacy-reports-title'
  ],
  'the link opens My listings on the listing''s tab; the sample stall has nobody to tell (its reporter is told)'
);
select is(
  pg_temp.audit(),
  array[
    'Adam | Adam | listing-hidden | listing | act-l2 | Old textbook | Sold elsewhere too. | Lerato | true',
    'Adam | Adam | listing-hidden | listing | act-l3 | Sample lamp | Not allowed. | - | true'
  ],
  'an entry each'
);

-- --- Show the listing again (showListing, staff-shops.ts:258; stage J spec decision 14) ----------------------------

select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.show_listing('act-l1'), 'changed', 'Adam shows the calculator again');
select is(public.show_listing('act-l1'), 'nothing', 'twice is nothing');
select is(public.show_listing('act-l4'), 'nothing', 'nor a listing that wasn''t hidden');
select pg_temp.sign_out();
select is(
  (select row(hidden_at, hidden_reason, state)::text from public.listings where id = 'act-l1'),
  row(null::timestamptz, null::text, 'available')::text,
  'its hide and reason are cleared, its state kept'
);
select is(
  array[pg_temp.report('f1'), pg_temp.report('f2')],
  array['closed | hidden | A copy of a branded calculator. | Adam | true', 'closed | hidden | A copy of a branded calculator. | Adam | true'],
  'the reports stay closed'
);
select is(
  pg_temp.audit(),
  array['Adam | Adam | listing-shown | listing | act-l1 | Graphing calculator |  | Lerato | true'],
  'one audit entry'
);
select is(
  pg_temp.notes(),
  array['Lerato | shop-update | act-l1 | The Hub is showing Graphing calculator again. It''s back in My listings. | /sell/listings'],
  'only the seller is told: the reporters aren''t told again'
);

-- --- The Hub's pause and Resume (staffPauseShop, staffResumeShop, closeReportsAboutShop) ---------------------------

select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select throws_ok($$select public.staff_pause_shop(pg_temp.s('f3'), '')$$, '23514', null, 'a pause needs a reason');
select is(public.staff_pause_shop(pg_temp.s('f3'), 'Selling copies.'), 'changed', 'Adam pauses Lerato''s shop');
select is(public.staff_pause_shop(pg_temp.s('f3'), 'Again.'), 'nothing', 'twice is nothing');
select is(public.staff_pause_shop(pg_temp.s('f2'), 'Waiting.'), 'nothing', 'a waiting shop can''t be paused');
select is(public.staff_pause_shop(pg_temp.s('f0'), 'Sample.'), 'nothing', 'nor a sample shop no account owns');
select pg_temp.sign_out();
select is(pg_temp.standing('f3'), 'paused | staff | false | Selling copies. | false | true', 'it''s the Hub''s pause, with the reason');
select is(
  array[pg_temp.report('f4'), pg_temp.report('f5'), pg_temp.report('f6'), pg_temp.report('f7')],
  array[
    'closed | paused | Selling copies. | Adam | true', 'closed | paused | Selling copies. | Adam | true',
    'open | - | - | - | -', 'open | - | - | - | -'
  ],
  'every open report on the shop and its listings closes as paused; one about a gone shop and one about another shop stay open'
);
select is(
  pg_temp.audit(),
  array['Adam | Adam | shop-paused | shop | act-lerato | Lerato crafts | Selling copies. | Lerato | true'],
  'one audit entry'
);
select is(
  pg_temp.notes(),
  array[
    'Lerato | shop-update | act-lerato | The Hub paused Lerato crafts. See why on your dashboard. | /sell',
    'Thandi | report-handled | ' || pg_temp.r('f4') || ' | Thanks, we''ve acted on your report about Lerato crafts. | /account/privacy#account-privacy-reports-title',
    'Zola | report-handled | ' || pg_temp.r('f5') || ' | Thanks, we''ve acted on your report about Beaded bracelet. | /account/privacy#account-privacy-reports-title'
  ],
  'the owner and each reporter are told'
);
select pg_temp.sign_in(pg_temp.a('f3'));
select is(public.set_shop_paused(false), 'not-allowed', 'Lerato can''t lift the Hub''s pause herself');
select pg_temp.sign_out();

select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.staff_resume_shop(pg_temp.s('f3')), 'changed', 'Adam resumes it');
select is(public.staff_resume_shop(pg_temp.s('f3')), 'nothing', 'twice is nothing');
select is(public.staff_resume_shop(pg_temp.s('f8')), 'nothing', 'the Hub can''t resume a seller''s own pause');
select pg_temp.sign_out();
select is(pg_temp.standing('f3'), 'approved | - | false | - | false | true', 'it''s open again, the reason gone');
select is(
  pg_temp.audit(),
  array['Adam | Adam | shop-resumed | shop | act-lerato | Lerato crafts |  | Lerato | true'],
  'one audit entry'
);
select is(
  pg_temp.notes(),
  array['Lerato | shop-update | act-lerato | The Hub resumed Lerato crafts. Buyers can see it again. | /sell'],
  'Lerato is told; reporters aren''t'
);

-- A seller's own pause under the Hub's (amendment 13.3).
select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.staff_pause_shop(pg_temp.s('f8'), 'Fake brands.'), 'changed', 'Adam pauses Kabelo''s shop, which he had paused');
select pg_temp.sign_out();
select is(pg_temp.standing('f8'), 'paused | staff | true | Fake brands. | false | true', 'the Hub''s pause remembers his');
select is(pg_temp.report('f7'), 'closed | paused | Fake brands. | Adam | true', 'the report on his shoes closes');
select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.staff_resume_shop(pg_temp.s('f8')), 'changed', 'Adam resumes it');
select pg_temp.sign_out();
select is(pg_temp.standing('f8'), 'paused | seller | false | - | false | true', 'and Kabelo''s own pause is back');
select is(
  pg_temp.notes(),
  array['Kabelo | shop-update | act-kabelo | The Hub lifted its pause on Kabelo kicks. It''s still paused as you set it: resume it from Sell when you''re ready. | /sell'],
  'he hears the Hub lifted its pause'
);
select is(
  pg_temp.audit(),
  array['Adam | Adam | shop-resumed | shop | act-kabelo | Kabelo kicks |  | Kabelo | true'],
  'as shop-resumed'
);
select pg_temp.sign_in(pg_temp.a('f8'));
select is(public.set_shop_paused(false), 'approved', 'and he resumes his shop himself');
select pg_temp.sign_out();

-- --- Dismiss (closeReport, staff-reports.ts:143) ---------------------------------------------------------------------

insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason) values
  (pg_temp.r('f9'), pg_temp.a('f4'), 'listing', 'act-l4', 'Running shoes', 'other');
select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select throws_ok($$select public.dismiss_report(pg_temp.r('f9'), '')$$, '23514', null, 'a dismissal needs a note');
select is(public.dismiss_report(pg_temp.r('f9'), 'Real brand, receipt seen.'), 'changed', 'Adam dismisses Thandi''s report');
select is(public.dismiss_report(pg_temp.r('f9'), 'Again.'), 'nothing', 'twice is nothing');
select is(public.dismiss_report(pg_temp.r('f7'), 'Closed.'), 'nothing', 'nor a closed report');
select is(public.dismiss_report('60000000-0000-4000-8000-0000000000ff', 'None.'), 'nothing', 'nor one that isn''t there');
select pg_temp.sign_out();
select is(pg_temp.report('f9'), 'closed | dismissed | Real brand, receipt seen. | Adam | true', 'it closes, dismissed, with the note');
select is(
  pg_temp.audit(),
  array['Adam | Adam | report-dismissed | report | ' || pg_temp.r('f9') || ' | Running shoes | Real brand, receipt seen. | Thandi | true'],
  'one audit entry: the report by its id and title, about its reporter'
);
select is(
  pg_temp.notes(),
  array['Thandi | report-handled | ' || pg_temp.r('f9') || ' | We looked at your report about Running shoes and didn''t find a problem. | /account/privacy#account-privacy-reports-title'],
  'Thandi hears the Hub found no problem; the note stays with staff'
);
select pg_temp.sign_in(pg_temp.a('f6'));
select is(public.dismiss_report(pg_temp.r('f6'), 'Mentor.'), 'forbidden', 'a mentor can''t dismiss one');
select pg_temp.sign_out();
select is(pg_temp.report('f6'), 'open | - | - | - | -', 'and it stays open');

-- --- Hide the request, and show it again (hideRequest, showRequest: requests.ts:181 and :193) ----------------------

-- Task 5: the sample request is reported first, as hiding needs an open report.
insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason) values
  (pg_temp.r('fc'), pg_temp.a('f9'), 'request', 'act-r2', 'Lift to Midrand', 'spam');
select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select throws_ok($$select public.hide_request('act-r1', '')$$, '23514', null, 'hiding a request needs a reason');
select is(public.hide_request('act-r1', 'Asks for contact details.'), 'changed', 'Adam hides Zola''s request');
select is(public.hide_request('act-r1', 'Again.'), 'nothing', 'twice is nothing');
select is(public.hide_request('act-none', 'Gone.'), 'nothing', 'nor a request that isn''t there');
select is(public.hide_request('act-r2', 'Not a request.'), 'changed', 'a sample request can be hidden too');
select pg_temp.sign_out();
select is(
  (select row(hidden_at = now(), hidden_reason, status, updated_at = now())::text from public.requests where id = 'act-r1'),
  row(true, 'Asks for contact details.', 'open', true)::text,
  'it''s hidden with the reason, stays open, and is updated now'
);
select is(pg_temp.report('f8'), 'closed | hidden | Asks for contact details. | Adam | true', 'the report on it closes as hidden');
select is(
  pg_temp.audit(),
  array[
    'Adam | Adam | request-hidden | request | act-r1 | Need a desk lamp | Asks for contact details. | Zola | true',
    'Adam | Adam | request-hidden | request | act-r2 | Lift to Midrand | Not a request. | - | true'
  ],
  'one entry each, about the asker (the sample has none)'
);
select is(
  pg_temp.notes(),
  array[
    'Thandi | report-handled | ' || pg_temp.r('f8') || ' | Thanks, we''ve acted on your report about Need a desk lamp. | /account/privacy#account-privacy-reports-title',
    'Zola | report-handled | ' || pg_temp.r('fc') || ' | Thanks, we''ve acted on your report about Lift to Midrand. | /account/privacy#account-privacy-reports-title',
    'Zola | request-update | act-r1 | The Hub hid your request Need a desk lamp. See why in Your requests. | /account/requests'
  ],
  'the asker and the reporter are told; a sample request has nobody to tell'
);

update public.requests set updated_at = now() - interval '1 hour' where id = 'act-r1';
select pg_temp.clear();
select pg_temp.sign_in(pg_temp.a('f5'));
select is(public.show_request('act-r1'), 'changed', 'Adam shows it again');
select is(public.show_request('act-r1'), 'nothing', 'twice is nothing');
select pg_temp.sign_out();
select is(
  (select row(hidden_at, hidden_reason, status, updated_at = now())::text from public.requests where id = 'act-r1'),
  row(null::timestamptz, null::text, 'open', true)::text,
  'its hide and reason are cleared, open as it was, updated now'
);
select is(pg_temp.report('f8'), 'closed | hidden | Asks for contact details. | Adam | true', 'the report stays closed');
select is(
  pg_temp.audit(),
  array['Adam | Adam | request-shown | request | act-r1 | Need a desk lamp |  | Zola | true'],
  'one audit entry'
);
select is(
  pg_temp.notes(),
  array['Zola | request-update | act-r1 | The Hub is showing your request Need a desk lamp again. | /account/requests'],
  'only the asker is told'
);

-- --- One open report per target, unless the target has gone (reports.ts:54) ----------------------------------------

select ok(
  (select indexdef like '%WHERE ((status = ''open''::text) AND (NOT target_gone))' from pg_indexes
   where schemaname = 'public' and indexname = 'reports_one_open_per_target'),
  'the index of open reports leaves out reports about something that has gone'
);
-- Zola's open report about a shop that had Lerato's link and has gone (f6) doesn't stop her reporting Lerato's shop.
select pg_temp.sign_in(pg_temp.a('f9'));
select is(public.create_report('seller', 'act-lerato', 'x', 'misleading', ''), 'created', 'a report on the new shop at that link is made');
select is(public.create_report('seller', 'act-lerato', 'x', 'misleading', ''), 'already-open', 'once');
select pg_temp.sign_out();
select is(
  (select count(*) from public.reports where reporter_id = pg_temp.a('f9') and target_id = 'act-lerato' and status = 'open'),
  2::bigint,
  'both are open: the gone shop''s and the new one'
);

select * from finish();
rollback;
