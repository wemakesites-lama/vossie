-- Schema catch-up, Task 5: the staff tools' actions: pickup points, Featured pins, Hub covers and posts, RSVPs and slot
-- requests, mentors' notes and check-ins, staff roles, one-time tokens, and hiding only from an open report
-- (supabase schema catch-up plan, decision 1; lib/staff/admin-actions.ts, hub-actions.ts, mentor-actions.ts,
-- account-actions.ts, once.ts; lib/hub-actions.ts; lib/data/pickup-points.ts, featured.ts, hub-posts.ts, mentors.ts,
-- staff-accounts.ts, audit.ts; lib/staff/notification-text.ts).
-- The expected sentences were printed from the TypeScript (slotAnswerText, slotRequestedText, staffRoleText, roleLabel,
-- bookSlotPath) on 2026-10-20.
begin;
select plan(208);

-- Accounts, shops and reports by their last two characters; a signed-in session per account (its JWT's session_id).
create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.r(n text) returns uuid language sql immutable as $f$
  select ('60000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.ph(n text) returns uuid language sql immutable as $f$
  select ('30000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
-- A one-time token's value.
create function pg_temp.t(n text) returns text language sql immutable as $f$
  select '70000000-0000-4000-8000-0000000000' || n;
$f$;
create function pg_temp.session(n text) returns uuid language sql immutable as $f$
  select ('50000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
grant execute on function pg_temp.a(text), pg_temp.s(text), pg_temp.r(text), pg_temp.ph(text), pg_temp.t(text),
  pg_temp.session(text) to public;

create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pg_temp.a(n), 'role', 'authenticated', 'session_id', pg_temp.session(n))::text,
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
-- A staff form's one-time token, made when the form is drawn (issueOnceToken, lib/staff/once.ts), for account n's
-- session; `ttl` from now.
create function pg_temp.issue(n text, token text, ttl interval default interval '1 hour') returns text language sql as $f$
  insert into public.form_states (session_id, form, account_id, expires_at)
  values (pg_temp.session(n), 'staff-once:' || pg_temp.t(token), pg_temp.a(n), now() + ttl)
  returning pg_temp.t(token);
$f$;
create function pg_temp.taken(n text, token text) returns boolean language sql as $f$
  select taken from public.form_states where session_id = pg_temp.session(n) and form = 'staff-once:' || pg_temp.t(token);
$f$;
grant execute on function pg_temp.taken(text, text) to public;
-- Today in South Africa (private.sast_day, which the API roles can't call by name).
create function pg_temp.today() returns date language sql stable as $f$
  select (now() at time zone 'Africa/Johannesburg')::date;
$f$;
grant execute on function pg_temp.today() to public;

-- What a step left behind, as in 16_staff_shop_actions: each notification and each audit entry, in a fixed order.
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
    order by l.action, l.target_id, l.staff_name, l.detail
  ), '{}')
  from public.audit_log l;
$f$;
create function pg_temp.clear() returns void language sql as $f$
  delete from public.notifications;
  delete from public.audit_log;
$f$;
-- How much the staff tools hold, as text: points, pins, posts, notes, bookings, RSVPs, and every role.
create function pg_temp.counts() returns text language sql as $f$
  select concat_ws(' | ',
    (select count(*) from public.pickup_points), (select count(*) from public.featured_pins),
    (select count(*) from public.hub_posts), (select count(*) from public.mentor_notes),
    (select count(*) from public.hub_bookings where status = 'open'), (select count(*) from public.hub_rsvps),
    (select string_agg(first_name || '=' || array_to_string(roles, ','), ' ' order by first_name) from public.profiles
     where id::text like '00000000-0000-4000-8000-0000000000e%'));
$f$;

-- Places.
insert into public.campuses (slug, name, region, sort) values ('tool-campus', 'Tool campus', 'Gauteng', 98);
insert into public.campuses (slug, name, region, sort, is_online) values ('tool-online', 'Tool online', 'Online', 99, true);
insert into public.categories (slug, name, sort) values ('tool-category', 'Tool category', 99);
insert into public.pickup_points (id, campus_slug, name) values
  ('20000000-0000-4000-8000-0000000000e1', 'tool-campus', 'Library entrance');
insert into public.pickup_points (id, campus_slug, name, retired_at) values
  ('20000000-0000-4000-8000-0000000000e2', 'tool-campus', 'Old gate', now() - interval '1 day');

-- People:
-- e1 Adam, an admin;                         e2 Mona, a mentor, Lerato's;
-- e3 Lerato, an open, Verified shop;          e4 Thandi, a student (Thandi.Tool@…);
-- e5 Dumi, an admin who loses the role;       e6 Kabelo, a mentor whose shop's one listing is hidden;
-- e7 Sipho, an open shop, not Verified;       e8 Zola, a student;
-- e9 Naledi, a shop waiting for approval;     e0 signed in once but never finished (no profile).
-- a1 to a5 are sample stalls no account owns, Verified, each with a listing.
insert into auth.users (id, email)
select pg_temp.a(n), 'tool-' || n || '@eduvos.com'
from unnest(array['e1', 'e2', 'e3', 'e5', 'e6', 'e7', 'e8', 'e9', 'e0']) n;
insert into auth.users (id, email) values (pg_temp.a('e4'), 'thandi.tool@eduvos.com');
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('e1'), 'Adam', 'tool-campus', '{admin}'),
  (pg_temp.a('e2'), 'Mona', 'tool-campus', '{mentor}'),
  (pg_temp.a('e3'), 'Lerato', 'tool-campus', '{}'),
  (pg_temp.a('e4'), 'Thandi', 'tool-campus', '{}'),
  (pg_temp.a('e5'), 'Dumi', 'tool-campus', '{admin}'),
  (pg_temp.a('e6'), 'Kabelo', 'tool-campus', '{mentor}'),
  (pg_temp.a('e7'), 'Sipho', 'tool-campus', '{}'),
  (pg_temp.a('e8'), 'Zola', 'tool-campus', '{}'),
  (pg_temp.a('e9'), 'Naledi', 'tool-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since, verified)
select s.id, s.slug, s.owner_id, s.name, 'tool-category', 'tool-campus', '2026-01', s.verified
from (values
  (pg_temp.s('e3'), 'tool-lerato', pg_temp.a('e3'), 'Lerato crafts', true),
  (pg_temp.s('e6'), 'tool-kabelo', pg_temp.a('e6'), 'Kabelo kicks', true),
  (pg_temp.s('e7'), 'tool-sipho', pg_temp.a('e7'), 'Sipho prints', false),
  (pg_temp.s('e9'), 'tool-naledi', pg_temp.a('e9'), 'Naledi bakes', true),
  (pg_temp.s('a1'), 'tool-a1', null::uuid, 'Stall a1', true),
  (pg_temp.s('a2'), 'tool-a2', null::uuid, 'Stall a2', true),
  (pg_temp.s('a3'), 'tool-a3', null::uuid, 'Stall a3', true),
  (pg_temp.s('a4'), 'tool-a4', null::uuid, 'Stall a4', true),
  (pg_temp.s('a5'), 'tool-a5', null::uuid, 'Stall a5', true)
) as s(id, slug, owner_id, name, verified);
insert into public.seller_profiles (account_id, status, shop_id, applied_at, paused_by, approved_at, mentor_id) values
  (pg_temp.a('e3'), 'approved', pg_temp.s('e3'), now() - interval '9 days', null, now() - interval '8 days', pg_temp.a('e2')),
  (pg_temp.a('e6'), 'approved', pg_temp.s('e6'), now() - interval '9 days', null, now() - interval '8 days', null),
  (pg_temp.a('e7'), 'approved', pg_temp.s('e7'), now() - interval '9 days', null, now() - interval '8 days', null),
  (pg_temp.a('e9'), 'pending', pg_temp.s('e9'), now() - interval '2 days', null, null, null);
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at)
select 'tool-l-' || n, pg_temp.s(n), 'available', 'item', 'Thing ' || n, 'tool-category', 'good', 100, 'cash', 'A thing.', 'online', 'tool-campus', now()
from unnest(array['e3', 'e6', 'e7', 'e9', 'a1', 'a2', 'a3', 'a4', 'a5']) n;
update public.listings set hidden_at = now(), hidden_reason = 'Copies.' where id = 'tool-l-e6';
insert into public.requests (id, asker_id, title, category_slug, campus_slug, details) values
  ('tool-r1', pg_temp.a('e8'), 'Need a desk lamp', 'tool-category', 'tool-campus', 'A lamp for late study nights.');

-- --- The functions ----------------------------------------------------------------------------------------------------

select is(
  array(
    select f from unnest(array[
      'public.add_pickup_point(text, text)', 'public.rename_pickup_point(uuid, text)',
      'public.retire_pickup_point(uuid)', 'public.restore_pickup_point(uuid)', 'public.pin_shop(uuid, text, date)',
      'public.unpin_shop(uuid)', 'public.add_hub_photo(text)',
      'public.save_hub_post(text, text, text, text, timestamptz, text, integer, text, text, boolean, uuid, text)',
      'public.rsvp(text)', 'public.cancel_rsvp(text)', 'public.request_slot(text, text, text)',
      'public.answer_booking(uuid, boolean)', 'public.add_mentor_note(uuid, text, text)',
      'public.add_check_in(uuid, date, text, text)', 'public.give_role(text, text, text)', 'public.remove_role(uuid, text)'
    ]) f
    where has_function_privilege('anon', f, 'execute')
      or not has_function_privilege('authenticated', f, 'execute')
      or not has_function_privilege('service_role', f, 'execute')
  ),
  '{}'::text[],
  'the sixteen run for signed-in people and the server, never anon'
);
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('take_once_token', 'slot_answer_note_text', 'slot_requested_note_text', 'staff_role_note_text',
        'form_states_keep_taken', 'form_states_keep_taken_rows')
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('service_role', p.oid, 'execute'))
  ),
  '{}'::text[],
  'the token, the sentences and the triggers run only inside the functions'
);

-- --- The sentences and links, as the app writes them ---------------------------------------------------------------

select is(private.slot_answer_note_text(true, 'Pricing clinic'), 'A mentor accepted your slot request for Pricing clinic.', 'slotAnswerText: accepted');
select is(private.slot_answer_note_text(false, 'Pricing clinic'), 'A mentor couldn''t fit in your slot request for Pricing clinic. You can ask again.', 'declined');
select is(private.slot_requested_note_text('Thandi', 'Pricing clinic'), 'Thandi asked for a slot at Pricing clinic.', 'slotRequestedText');
select is(private.staff_role_note_text('given', 'mentor'), 'You''re a Vossie mentor now. The Hub''s tools and the mentor dashboard are on your account page.', 'staffRoleText: mentor given');
select is(private.staff_role_note_text('given', 'admin'), 'You''re a Vossie admin now. The admin console is on your account page.', 'admin given');
select is(private.staff_role_note_text('removed', 'mentor'), 'Your mentor role on Vossie has ended. Thank you for helping student sellers.', 'mentor removed');
select is(private.staff_role_note_text('removed', 'admin'), 'Your admin role on Vossie has ended.', 'admin removed');

-- --- Only staff (plan decision 1) -----------------------------------------------------------------------------------

select pg_temp.issue('e4', 'a4');
select pg_temp.issue('e8', 'a8');
select pg_temp.issue('e5', 'a5');
update public.profiles set roles = '{}' where id = pg_temp.a('e5');
create temp table before (v text);
grant all on before to public;
insert into before select pg_temp.counts();
select pg_temp.clear();

-- A student.
select pg_temp.sign_in('e4');
select is(
  array[
    public.add_pickup_point('tool-campus', 'Bookshop'), public.rename_pickup_point('20000000-0000-4000-8000-0000000000e1', 'Gate'),
    public.retire_pickup_point('20000000-0000-4000-8000-0000000000e1'), public.restore_pickup_point('20000000-0000-4000-8000-0000000000e2'),
    public.pin_shop(pg_temp.s('a1'), 'tool-campus', pg_temp.today()), public.unpin_shop(gen_random_uuid()),
    public.add_hub_photo('image/webp') ->> 'result',
    public.save_hub_post(null, 'tip', 'A tip', null, null, null, null, 'A tip.', 'Body.', true, null, pg_temp.t('a4')) ->> 'result',
    public.answer_booking(gen_random_uuid(), true),
    public.add_mentor_note(pg_temp.a('e3'), 'A note.', pg_temp.t('a4')),
    public.add_check_in(pg_temp.a('e3'), pg_temp.today(), 'A chat.', pg_temp.t('a4')),
    public.give_role('tool-e8@eduvos.com', 'admin', pg_temp.t('a4')), public.remove_role(pg_temp.a('e1'), 'admin')
  ],
  array_fill('forbidden'::text, array[13]),
  'a student gets forbidden from every staff action'
);
select pg_temp.sign_out();
select is(pg_temp.taken('e4', 'a4'), false, 'and their token is left as it was');
-- A mentor, from the admin's.
select pg_temp.sign_in('e2');
select is(
  array[
    public.add_pickup_point('tool-campus', 'Bookshop'), public.rename_pickup_point('20000000-0000-4000-8000-0000000000e1', 'Gate'),
    public.retire_pickup_point('20000000-0000-4000-8000-0000000000e1'), public.restore_pickup_point('20000000-0000-4000-8000-0000000000e2'),
    public.pin_shop(pg_temp.s('a1'), 'tool-campus', pg_temp.today()), public.unpin_shop(gen_random_uuid()),
    public.give_role('tool-e8@eduvos.com', 'admin', pg_temp.t('a4')), public.remove_role(pg_temp.a('e1'), 'admin')
  ],
  array_fill('forbidden'::text, array[8]),
  'so does a mentor from the admin''s'
);
select pg_temp.sign_out();
-- An admin whose role was just removed (the go-live item: the role is checked inside the action's transaction).
select pg_temp.sign_in('e5');
select is(
  array[
    public.add_pickup_point('tool-campus', 'Bookshop'), public.pin_shop(pg_temp.s('a1'), 'tool-campus', pg_temp.today()),
    public.add_hub_photo('image/webp') ->> 'result',
    public.save_hub_post(null, 'tip', 'A tip', null, null, null, null, 'A tip.', 'Body.', true, null, pg_temp.t('a5')) ->> 'result',
    public.add_mentor_note(pg_temp.a('e3'), 'A note.', pg_temp.t('a5')),
    public.give_role('tool-e8@eduvos.com', 'admin', pg_temp.t('a5')), public.remove_role(pg_temp.a('e1'), 'admin')
  ],
  array_fill('forbidden'::text, array[7]),
  'and an admin whose role has gone'
);
select pg_temp.sign_out();
select is(pg_temp.taken('e5', 'a5'), false, 'his token is left too');
select is(pg_temp.counts(), (select v from before), 'nothing changed: points, pins, posts, notes, slots, RSVPs and roles');
select is((select count(*) from public.photos where owner_id is null), 0::bigint, 'no Hub photo was made');
select is(pg_temp.audit(), '{}'::text[], 'no audit entry was written');
select is(pg_temp.notes(), '{}'::text[], 'and nobody was told');
set local role anon;
select throws_ok($$select public.add_pickup_point('tool-campus', 'Bookshop')$$, '42501', null, 'anon can''t call one');
reset role;

-- --- Pickup points (addPickupPoint to restorePickupPoint, pickup-points.ts:52 to 90; admin-actions.ts:522 to 605) ----

select pg_temp.sign_in('e1');
select is(public.add_pickup_point('tool-campus', 'Bookshop'), 'changed', 'Adam adds the Bookshop');
select is(public.add_pickup_point('tool-campus', 'BOOKSHOP!'), 'name-taken', 'a name the campus has, however it''s written, is taken');
select is(public.add_pickup_point('tool-campus', 'Old gate'), 'name-taken', 'a retired point''s name too');
select is(public.add_pickup_point('tool-online', 'Inbox'), 'nothing', 'an online campus has no points');
select is(public.add_pickup_point('no-campus', 'Inbox'), 'nothing', 'nor does a campus that isn''t there');
select throws_ok($$select public.add_pickup_point('tool-campus', 'B')$$, '23514', null, 'a name is 2 to 60 characters');
select throws_ok($$select public.add_pickup_point('tool-campus', E'Book\nshop')$$, '23514', null, 'of one clean line');
select pg_temp.sign_out();
select is(
  (select row(name, retired_at)::text from public.pickup_points where campus_slug = 'tool-campus' and name = 'Bookshop'),
  row('Bookshop', null::timestamptz)::text,
  'the point is in use'
);
select is(
  pg_temp.audit(),
  array['Adam | Adam | point-added | pickup-point | ' || (select id from public.pickup_points where name = 'Bookshop')
    || ' | Bookshop | Tool campus | - | true'],
  'one audit entry, naming the campus'
);
select is(pg_temp.notes(), '{}'::text[], 'nobody is told about points');

select pg_temp.clear();
select pg_temp.sign_in('e1');
select is(public.rename_pickup_point('20000000-0000-4000-8000-0000000000e1', 'Main library'), 'changed', 'Adam renames the library entrance');
select is(public.rename_pickup_point('20000000-0000-4000-8000-0000000000e1', 'Main library'), 'nothing', 'the same name again is nothing');
select is(public.rename_pickup_point('20000000-0000-4000-8000-0000000000e1', 'bookshop'), 'name-taken', 'another point''s name is taken');
select is(public.rename_pickup_point('20000000-0000-4000-8000-0000000000ff', 'Gate'), 'nothing', 'a point that isn''t there is nothing');
select pg_temp.sign_out();
select is(
  pg_temp.audit(),
  array['Adam | Adam | point-renamed | pickup-point | 20000000-0000-4000-8000-0000000000e1 | Main library | Was Library entrance | - | true'],
  'one entry, by its new name, with the old one'
);

select pg_temp.clear();
select pg_temp.sign_in('e1');
select is(public.retire_pickup_point('20000000-0000-4000-8000-0000000000e1'), 'changed', 'Adam retires it');
select is(public.retire_pickup_point('20000000-0000-4000-8000-0000000000e1'), 'nothing', 'twice is nothing');
select is(public.restore_pickup_point('20000000-0000-4000-8000-0000000000e2'), 'changed', 'and uses the old gate again');
select is(public.restore_pickup_point('20000000-0000-4000-8000-0000000000e2'), 'nothing', 'twice is nothing');
select pg_temp.sign_out();
select is(
  array(select name || '=' || (retired_at is not null)::text from public.pickup_points where campus_slug = 'tool-campus' order by name),
  array['Bookshop=false', 'Main library=true', 'Old gate=false'],
  'the library is retired, the gate in use'
);
select is(
  pg_temp.audit(),
  array[
    'Adam | Adam | point-restored | pickup-point | 20000000-0000-4000-8000-0000000000e2 | Old gate |  | - | true',
    'Adam | Adam | point-retired | pickup-point | 20000000-0000-4000-8000-0000000000e1 | Main library |  | - | true'
  ],
  'an entry each, with no detail'
);

-- --- Featured (addPin and removePin, featured.ts:76 and :106; pinSeller and unpinSeller) -----------------------------

insert into public.featured_draws (campus_slug, day, shop_ids) values
  ('tool-campus', pg_temp.today(), array[pg_temp.s('a5')]),
  ('tool-campus', pg_temp.today() + 1, array[pg_temp.s('a5')]),
  (null, pg_temp.today(), array[pg_temp.s('a5')]);
select pg_temp.clear();
select pg_temp.sign_in('e1');
select is(public.pin_shop(pg_temp.s('a1'), 'tool-campus', pg_temp.today()), 'changed', 'Adam pins a stall to the campus today');
select pg_temp.sign_out();
select is(
  (select row(pinned_by = pg_temp.a('e1'), created_at = now())::text from public.featured_pins where shop_id = pg_temp.s('a1')),
  row(true, true)::text,
  'the pin is his, made now'
);
select is(
  array(select coalesce(campus_slug, 'none') || ' ' || (day - pg_temp.today()) from public.featured_draws
        where shop_ids = array[pg_temp.s('a5')] order by 1),
  array['none 0', 'tool-campus 1'],
  'that campus''s row for today is forgotten, to be drawn again; other days and campuses keep theirs'
);
select is(
  pg_temp.audit(),
  array['Adam | Adam | featured-pinned | shop | tool-a1 | Stall a1 | Tool campus · ' || to_char(pg_temp.today(), 'YYYY-MM-DD') || ' | - | true'],
  'one audit entry: the shop by its link and name, the campus and the day'
);
select pg_temp.clear();
select pg_temp.sign_in('e1');
select is(public.pin_shop(pg_temp.s('a1'), 'tool-campus', pg_temp.today()), 'taken', 'the same shop again is taken');
select is(public.pin_shop(pg_temp.s('e7'), 'tool-campus', pg_temp.today()), 'not-eligible', 'a shop that isn''t Verified can''t be pinned');
select is(public.pin_shop(pg_temp.s('e6'), 'tool-campus', pg_temp.today()), 'not-eligible', 'nor one whose only listing is hidden');
select is(public.pin_shop(pg_temp.s('e9'), 'tool-campus', pg_temp.today()), 'not-eligible', 'nor one waiting for approval');
select is(public.pin_shop(pg_temp.s('ff'), 'tool-campus', pg_temp.today()), 'not-eligible', 'nor one that isn''t there');
select is(public.pin_shop(pg_temp.s('a2'), 'tool-campus', pg_temp.today() - 1), 'day-past', 'yesterday has gone');
select is(public.pin_shop(pg_temp.s('a2'), 'tool-campus', pg_temp.today() + 61), 'day-far', '61 days ahead is too far');
select throws_ok(
  format('select public.pin_shop(%L, %L, %L)', pg_temp.s('a2'), 'no-campus', pg_temp.today()),
  '22023', null, 'a campus that isn''t there is refused'
);
select is(public.pin_shop(pg_temp.s('a2'), null, pg_temp.today() + 60), 'changed', '60 days ahead, for visitors with no campus, is fine');
select is(public.pin_shop(pg_temp.s('a2'), 'tool-campus', pg_temp.today()), 'changed', 'a second today');
select is(public.pin_shop(pg_temp.s('a3'), 'tool-campus', pg_temp.today()), 'changed', 'a third');
select is(public.pin_shop(pg_temp.s('e3'), 'tool-campus', pg_temp.today()), 'changed', 'a fourth: Lerato''s shop');
select is(public.pin_shop(pg_temp.s('a4'), 'tool-campus', pg_temp.today()), 'full', 'a fifth is one too many');
select is(public.pin_shop(pg_temp.s('a4'), null, pg_temp.today()), 'changed', 'another campus''s row has room');
select pg_temp.sign_out();
select is(
  (select count(*) from public.featured_pins where campus_slug = 'tool-campus' and day = pg_temp.today()),
  4::bigint,
  'four places, four pins (FEATURED_PLACES)'
);
select is(
  array(select a from unnest(pg_temp.audit()) a where a like '%No campus chosen%' order by a),
  array[
    'Adam | Adam | featured-pinned | shop | tool-a2 | Stall a2 | No campus chosen · ' || to_char(pg_temp.today() + 60, 'YYYY-MM-DD') || ' | - | true',
    'Adam | Adam | featured-pinned | shop | tool-a4 | Stall a4 | No campus chosen · ' || to_char(pg_temp.today(), 'YYYY-MM-DD') || ' | - | true'
  ],
  'a pin for visitors with no campus says so'
);
select is(cardinality(pg_temp.audit()), 5, 'one entry for each pin made, none for the refusals');
select ok(
  (select prosrc like '%pg_advisory_xact_lock%' from pg_proc where oid = 'public.pin_shop(uuid, text, date)'::regprocedure),
  'the four are counted under a lock on the campus and day'
);

select pg_temp.clear();
insert into public.featured_draws (campus_slug, day, shop_ids) values ('tool-campus', pg_temp.today(), array[pg_temp.s('a5')]);
select pg_temp.sign_in('e1');
select is(
  public.unpin_shop((select id from public.featured_pins where shop_id = pg_temp.s('a3'))),
  'changed', 'Adam takes a pin away'
);
select is(public.unpin_shop(gen_random_uuid()), 'nothing', 'a pin that isn''t there is nothing');
select pg_temp.sign_out();
select is(
  (select count(*) from public.featured_draws where campus_slug = 'tool-campus' and day = pg_temp.today()),
  0::bigint,
  'and that campus''s row for the day goes with it'
);
select is(
  pg_temp.audit(),
  array['Adam | Adam | featured-unpinned | shop | tool-a3 | Stall a3 | Tool campus · ' || to_char(pg_temp.today(), 'YYYY-MM-DD') || ' | - | true'],
  'one audit entry'
);

-- --- Hub covers (plan decision 6) -------------------------------------------------------------------------------------

-- A cover a mentor added two days ago and never used, and one of Thandi's own photos.
insert into public.photos (id, owner_id, use, type, path, created_at) values
  (pg_temp.ph('e1'), null, 'hub-draft', 'image/webp', 'hub/' || pg_temp.ph('e1'), now() - interval '2 days'),
  (pg_temp.ph('e4'), pg_temp.a('e4'), null, 'image/webp', pg_temp.a('e4') || '/' || pg_temp.ph('e4'), now());
create temp table results (k text primary key, v jsonb);
grant all on results to public;
select pg_temp.sign_in('e2');
insert into results values ('cover1', public.add_hub_photo('image/webp'));
select throws_ok($$select public.add_hub_photo('image/gif')$$, '22023', null, 'a cover is a JPEG, PNG or WebP');
select pg_temp.sign_out();
select is((select v ->> 'result' from results where k = 'cover1'), 'created', 'Mona adds a cover');
select is(
  (select row(p.owner_id, p.use, p.type, p.path = 'hub/' || p.id, (select v ->> 'path' from results where k = 'cover1') = p.path)::text
   from public.photos p where p.id = (select (v ->> 'id')::uuid from results where k = 'cover1')),
  row(null::uuid, 'hub-draft', 'image/webp', true, true)::text,
  'a photo with no owner, waiting for its form, at hub/<id>, as returned'
);
select is(
  (select v -> 'removed_paths' from results where k = 'cover1'),
  jsonb_build_array('hub/' || pg_temp.ph('e1')),
  'the Hub''s waiting photo a day old is swept, its path returned for Storage'
);
select is((select count(*) from public.photos where id = pg_temp.ph('e1')), 0::bigint, 'and its row is gone');

-- --- Hub posts (saveHubPost, hub-posts.ts:140; savePost, hub-actions.ts:113) ----------------------------------------

select pg_temp.clear();
select pg_temp.issue('e2', 'b1');
select pg_temp.sign_in('e2');
insert into results values ('post1', public.save_hub_post(
  null, 'event', 'Pricing night', 'tool-campus', now() + interval '3 days', 'Hall B', 30, 'Price your work.', 'Bring a list.',
  true, (select (v ->> 'id')::uuid from results where k = 'cover1'), pg_temp.t('b1')
));
insert into results values ('post1again', public.save_hub_post(
  null, 'event', 'Pricing night', 'tool-campus', now() + interval '3 days', 'Hall B', 30, 'Price your work.', 'Bring a list.',
  true, null, pg_temp.t('b1')
));
select is(
  public.save_hub_post(null, 'tip', 'A tip', null, null, null, null, 'A tip.', 'Body.', true, null, null) ->> 'result',
  'once-expired', 'a new post with no token is refused'
);
select is(
  public.save_hub_post(null, 'tip', 'A tip', null, null, null, null, 'A tip.', 'Body.', true, null, pg_temp.t('ff')) ->> 'result',
  'once-expired', 'and with a token this session never had'
);
select pg_temp.sign_out();
select is((select v ->> 'result' from results where k = 'post1'), 'created', 'Mona writes an event');
select is((select v ->> 'result' from results where k = 'post1again'), 'once-taken', 'sending the form again makes nothing');
select is(pg_temp.taken('e2', 'b1'), true, 'the token is taken');
select is(
  (select row(kind, title, campus_slug, place, capacity, going, published, published_at = now(), author_id = pg_temp.a('e2'),
     image_src, cover_photo_id = (select (v ->> 'id')::uuid from results where k = 'cover1'))::text
   from public.hub_posts where id = (select v ->> 'id' from results where k = 'post1')),
  row('event', 'Pricing night', 'tool-campus', 'Hall B', 30, 0, true, true, true, null::text, true)::text,
  'one post: hers, published now, its count at 0, with the cover'
);
select is(
  (select use from public.photos where id = (select (v ->> 'id')::uuid from results where k = 'cover1')),
  'post:' || (select v ->> 'id' from results where k = 'post1'),
  'the cover is the post''s now'
);
select is(
  pg_temp.audit(),
  array['Mona | Mona | post-created | post | ' || (select v ->> 'id' from results where k = 'post1') || ' | Pricing night | Published | - | true'],
  'one audit entry, saying it was published'
);
select is((select count(*) from public.hub_posts where title in ('Pricing night', 'A tip')), 1::bigint, 'and only one post');

-- Edits.
update public.hub_posts set updated_at = now() - interval '1 hour' where id = (select v ->> 'id' from results where k = 'post1');
select pg_temp.clear();
select pg_temp.sign_in('e2');
select is(
  public.save_hub_post((select v ->> 'id' from results where k = 'post1'), 'event', 'Pricing night', 'tool-campus',
    (select starts_at from public.hub_posts where id = (select v ->> 'id' from results where k = 'post1')), 'Hall B', 30,
    'Price your work.', 'Bring a list.', true, null, null) ->> 'result',
  'nothing', 'saving it as it is changes nothing'
);
select is(
  public.save_hub_post((select v ->> 'id' from results where k = 'post1'), 'event', 'Pricing night', 'tool-campus',
    (select starts_at from public.hub_posts where id = (select v ->> 'id' from results where k = 'post1')), 'Hall B', 30,
    'Price your work.', 'Bring a list.', true, (select (v ->> 'id')::uuid from results where k = 'cover1'), null) ->> 'result',
  'nothing', 'nor with the cover it has'
);
select pg_temp.sign_out();
select is(
  (select updated_at = now() - interval '1 hour' from public.hub_posts where id = (select v ->> 'id' from results where k = 'post1')),
  true, 'its updated time is kept'
);
select is(pg_temp.audit(), '{}'::text[], 'and nothing is logged');

select pg_temp.sign_in('e2');
insert into results values ('cover2', public.add_hub_photo('image/png'));
insert into results values ('edit1', public.save_hub_post((select v ->> 'id' from results where k = 'post1'), 'event',
  'Pricing night 2', 'tool-campus', (select starts_at from public.hub_posts where id = (select v ->> 'id' from results where k = 'post1')),
  'Hall B', 30, 'Price your work.', 'Bring a list.', false, (select (v ->> 'id')::uuid from results where k = 'cover2'), null));
select pg_temp.sign_out();
select is((select v ->> 'result' from results where k = 'edit1'), 'changed', 'Mona renames it, gives it a new cover and makes it a draft');
select is(
  (select v -> 'removed_paths' from results where k = 'edit1'),
  jsonb_build_array((select v ->> 'path' from results where k = 'cover1')),
  'the old cover''s path comes back, for Storage'
);
select is((select count(*) from public.photos where id = (select (v ->> 'id')::uuid from results where k = 'cover1')), 0::bigint, 'its row is gone');
select is(
  (select row(title, published, published_at is not null, updated_at = now(),
     cover_photo_id = (select (v ->> 'id')::uuid from results where k = 'cover2'))::text
   from public.hub_posts where id = (select v ->> 'id' from results where k = 'post1')),
  row('Pricing night 2', false, true, true, true)::text,
  'a draft now, first published time kept, updated now, with the new cover'
);
select is(
  pg_temp.audit(),
  array['Mona | Mona | post-updated | post | ' || (select v ->> 'id' from results where k = 'post1') || ' | Pricing night 2 | Draft | - | true'],
  'one audit entry'
);

select pg_temp.clear();
select pg_temp.sign_in('e6');
select is(
  public.save_hub_post((select v ->> 'id' from results where k = 'post1'), 'tip', 'Mine now', null, null, null, null, 'A tip.', 'Body.', true, null, null) ->> 'result',
  'forbidden', 'Kabelo can''t edit Mona''s post'
);
select is(
  public.save_hub_post('tool-none', 'tip', 'Mine now', null, null, null, null, 'A tip.', 'Body.', true, null, null) ->> 'result',
  'not-found', 'nor one that isn''t there'
);
select pg_temp.sign_out();
select pg_temp.sign_in('e1');
select is(
  public.save_hub_post((select v ->> 'id' from results where k = 'post1'), 'tip', 'Price tips', 'tool-campus', now() - interval '1 day',
    'Hall B', 30, 'Price your work.', 'Bring a list.', true, null, null) ->> 'result',
  'changed', 'an admin edits anyone''s: Adam makes it a tip'
);
select pg_temp.sign_out();
select is(
  (select row(kind, campus_slug, starts_at, place, capacity, going, author_id = pg_temp.a('e2'))::text
   from public.hub_posts where id = (select v ->> 'id' from results where k = 'post1')),
  row('tip', null::text, null::timestamptz, null::text, null::int, null::int, true)::text,
  'a tip is every campus''s, with no start, place, places or count; Mona is still its author'
);
select is(
  pg_temp.audit(),
  array['Adam | Adam | post-updated | post | ' || (select v ->> 'id' from results where k = 'post1') || ' | Price tips | Published | - | true'],
  'logged as Adam''s'
);

-- A start in the past (startsInThePast, hub-actions.ts:57), a cover that isn't the Hub's, and a draft.
insert into public.photos (id, owner_id, use, type, path, created_at) values
  (pg_temp.ph('e2'), null, 'hub-draft', 'image/webp', 'hub/' || pg_temp.ph('e2'), now() - interval '25 hours');
select pg_temp.clear();
select pg_temp.issue('e2', 'b2');
select pg_temp.sign_in('e2');
select is(
  public.save_hub_post(null, 'office-hours', 'Late clinic', 'tool-campus', now() - interval '1 minute', 'Room 4', null,
    'Ask anything.', 'Come by.', true, null, pg_temp.t('b2')) ->> 'result',
  'date-past', 'new office hours can''t start in the past'
);
select is(
  public.save_hub_post(null, 'tip', 'A tip', null, null, null, null, 'A tip.', 'Body.', true, pg_temp.ph('e4'), pg_temp.t('b2')) ->> 'result',
  'cover-invalid', 'a student''s photo isn''t a cover'
);
select is(
  public.save_hub_post(null, 'tip', 'A tip', null, null, null, null, 'A tip.', 'Body.', true, pg_temp.ph('e2'), pg_temp.t('b2')) ->> 'result',
  'cover-invalid', 'nor is a Hub photo that waited more than a day'
);
select pg_temp.sign_out();
select is(pg_temp.taken('e2', 'b2'), false, 'a refused save leaves the token for the next try');
select pg_temp.sign_in('e2');
insert into results values ('draft', public.save_hub_post(null, 'office-hours', 'Pricing clinic', 'tool-campus',
  now() + interval '1 day', 'Room 4', 5, 'Ask anything.', 'Come by.', false, null, pg_temp.t('b2')));
select pg_temp.sign_out();
select is(
  (select row(kind, capacity, going, published, published_at, image_src, cover_photo_id)::text
   from public.hub_posts where id = (select v ->> 'id' from results where k = 'draft')),
  row('office-hours', null::int, null::int, false, null::timestamptz, null::text, null::uuid)::text,
  'a draft of office hours: no places or count, never published, the banner'
);
select is(
  pg_temp.audit(),
  array['Mona | Mona | post-created | post | ' || (select v ->> 'id' from results where k = 'draft') || ' | Pricing clinic | Draft | - | true'],
  'logged as a draft'
);
select pg_temp.sign_in('e2');
select is(
  public.save_hub_post((select v ->> 'id' from results where k = 'draft'), 'office-hours', 'Pricing clinic', 'tool-campus',
    (select starts_at from public.staff_hub_posts where id = (select v ->> 'id' from results where k = 'draft')), 'Room 4', null,
    'Ask anything.', 'Come by.', true, null, null) ->> 'result',
  'changed', 'Mona publishes it'
);
select pg_temp.sign_out();
select is(
  (select published_at = now() from public.hub_posts where id = (select v ->> 'id' from results where k = 'draft')),
  true, 'it is dated from now'
);

-- --- RSVPs (addRsvp and removeRsvp, hub-posts.ts:182; rsvpToEvent and cancelRsvp, lib/hub-actions.ts) ---------------

insert into public.hub_posts (id, kind, title, summary, place, body, campus_slug, starts_at, capacity, going, published, published_at, author_id) values
  ('tool-ev', 'event', 'Market day', 'Sell on the lawn.', 'Lawn', 'Bring a table.', 'tool-campus', now() + interval '2 days', 2, 1, true, now(), pg_temp.a('e2')),
  ('tool-ev-today', 'event', 'Swap meet', 'Swap things.', 'Hall', 'Bring things.', 'tool-campus', now(), 50, 0, true, now(), null),
  ('tool-ev-past', 'event', 'Old fair', 'It was fun.', 'Hall', 'It was.', 'tool-campus', now() - interval '2 days', 50, 0, true, now(), null),
  ('tool-ev-draft', 'event', 'Secret fair', 'Not yet.', 'Hall', 'Soon.', 'tool-campus', now() + interval '2 days', 50, 0, false, null, null),
  ('tool-oh', 'office-hours', 'Pricing clinic', 'Ask about prices.', 'Room 4', 'Come by.', 'tool-campus', now() + interval '1 day', null, null, true, now(), pg_temp.a('e2')),
  ('tool-oh-sample', 'office-hours', 'Sample clinic', 'Ask the Hub.', 'Room 5', 'Come by.', 'tool-campus', now() + interval '1 day', null, null, true, now(), null),
  ('tool-oh-past', 'office-hours', 'Old clinic', 'Gone.', 'Room 4', 'Gone.', 'tool-campus', now() - interval '2 days', null, null, true, now(), pg_temp.a('e2'));
select pg_temp.clear();
select pg_temp.sign_in('e4');
select is(public.rsvp('tool-ev'), 'going', 'Thandi is going');
select is(public.rsvp('tool-ev'), 'already', 'once');
select is(public.rsvp('tool-ev-today'), 'going', 'an event today that has started still counts as upcoming');
select is(
  array[public.rsvp('tool-ev-past'), public.rsvp('tool-ev-draft'), public.rsvp('tool-oh'), public.rsvp('tool-none')],
  array['closed', 'closed', 'closed', 'closed'],
  'a past event, a draft, office hours and an unknown post are closed'
);
select pg_temp.sign_out();
select pg_temp.sign_in('e8');
select is(public.rsvp('tool-ev'), 'full', 'Zola finds it full: one going before Vossie, and Thandi');
select pg_temp.sign_out();
select is(public.hub_going('tool-ev'), 2, 'two are going');
select pg_temp.sign_in('e4');
select is(public.cancel_rsvp('tool-ev'), 'changed', 'Thandi cancels');
select is(public.cancel_rsvp('tool-ev'), 'nothing', 'once');
select pg_temp.sign_out();
select pg_temp.sign_in('e8');
select is(public.rsvp('tool-ev'), 'going', 'so Zola gets her place');
select pg_temp.sign_out();
select is(public.hub_going('tool-ev'), 2, 'still two');
select ok(
  (select prosrc ~* 'for\s+update' from pg_proc where oid = 'public.rsvp(text)'::regprocedure),
  'the places are counted with the post locked'
);
select is(pg_temp.audit() || pg_temp.notes(), '{}'::text[], 'an RSVP is logged nowhere and tells nobody');
select throws_ok($$select public.rsvp('tool-ev')$$, '42501', null, 'nobody signed in can''t RSVP');

-- --- Slot requests (requestSlot and answerBooking, hub-posts.ts:213 and :282; sendSlotRequest, answerSlot) ----------

select pg_temp.clear();
select pg_temp.sign_in('e4');
select is(public.request_slot('tool-oh', E'Pricing my\nbracelets.', ''), 'requested', 'Thandi asks for a slot');
select is(public.request_slot('tool-oh', 'Again.', 'Any time'), 'open-already', 'one open request at a time');
select is(public.request_slot('tool-oh-past', 'Help.', ''), 'closed', 'past office hours are closed');
select is(public.request_slot('tool-ev', 'Help.', ''), 'closed', 'an event has no slots');
select is(public.request_slot('tool-oh-sample', 'Help.', 'Mornings'), 'requested', 'office hours with no author can be asked too');
select throws_ok($$select public.request_slot('tool-oh', '', '')$$, '23514', null, 'a request says what it''s about');
select throws_ok(format('select public.request_slot(%L, %L, %L)', 'tool-oh', 'Help.', repeat('a', 101)), '23514', null, 'a time is at most 100 characters');
select pg_temp.sign_out();
select pg_temp.sign_in('e2');
select is(public.request_slot('tool-oh', 'My own.', ''), 'requested', 'Mona can ask at her own office hours');
select pg_temp.sign_out();
select is(
  pg_temp.notes(),
  array['Mona | booking | ' || (select id from public.hub_bookings where post_id = 'tool-oh' and account_id = pg_temp.a('e4'))
    || ' | Thandi asked for a slot at Pricing clinic. | /hub/manage#hub-queue'],
  'only the author is told of Thandi''s: not of her own, and a sample has nobody'
);
select is(pg_temp.audit(), '{}'::text[], 'asking isn''t logged');

select pg_temp.clear();
select pg_temp.sign_in('e4');
select is(public.answer_booking((select id from public.hub_bookings where account_id = pg_temp.a('e2')), true), 'forbidden', 'a student can''t answer');
select pg_temp.sign_out();
select pg_temp.sign_in('e6');
select is(
  public.answer_booking((select id from public.hub_bookings where post_id = 'tool-oh' and account_id = pg_temp.a('e4')), true),
  'changed', 'Kabelo accepts Thandi''s request'
);
select is(
  public.answer_booking((select id from public.hub_bookings where post_id = 'tool-oh' and account_id = pg_temp.a('e4')), false),
  'nothing', 'it''s answered once'
);
select is(
  public.answer_booking((select id from public.hub_bookings where account_id = pg_temp.a('e2')), false),
  'changed', 'and declines Mona''s'
);
select is(public.answer_booking(gen_random_uuid(), true), 'nothing', 'one that isn''t there is nothing');
select pg_temp.sign_out();
select is(
  (select row(status, answered_at = now(), answered_by = pg_temp.a('e6'))::text from public.hub_bookings
   where post_id = 'tool-oh' and account_id = pg_temp.a('e4')),
  row('accepted', true, true)::text,
  'accepted now, by Kabelo'
);
select is(
  pg_temp.audit(),
  array[
    'Kabelo | Kabelo | booking-accepted | booking | ' || (select id from public.hub_bookings where post_id = 'tool-oh' and account_id = pg_temp.a('e4'))
      || ' | Thandi: Pricing clinic |  | Thandi | true',
    'Kabelo | Kabelo | booking-declined | booking | ' || (select id from public.hub_bookings where account_id = pg_temp.a('e2'))
      || ' | Mona: Pricing clinic |  | Mona | true'
  ],
  'an entry each, about the student'
);
select is(
  pg_temp.notes(),
  array[
    'Mona | booking | ' || (select id from public.hub_bookings where account_id = pg_temp.a('e2'))
      || ' | A mentor couldn''t fit in your slot request for Pricing clinic. You can ask again. | /hub/tool-oh/book',
    'Thandi | booking | ' || (select id from public.hub_bookings where post_id = 'tool-oh' and account_id = pg_temp.a('e4'))
      || ' | A mentor accepted your slot request for Pricing clinic. | /hub/tool-oh/book'
  ],
  'each student is told, with a link to the request page'
);
select pg_temp.sign_in('e4');
select is(public.request_slot('tool-oh', 'Another question.', ''), 'requested', 'once answered, Thandi can ask again');
select pg_temp.sign_out();

-- --- Mentors' notes and check-ins (addMentorNote and addCheckIn, mentor-actions.ts:62 and :97) ---------------------

select pg_temp.clear();
select pg_temp.issue('e2', 'c1');
select pg_temp.issue('e2', 'c2');
select pg_temp.issue('e2', 'c3', interval '-1 minute');
select pg_temp.issue('e6', 'c6');
select pg_temp.issue('e1', 'c7');
select pg_temp.sign_in('e2');
select is(public.add_mentor_note(pg_temp.a('e3'), E'Talked prices.\nShe''ll try R80.', pg_temp.t('c1')), 'changed', 'Mona writes a note about Lerato');
select is(public.add_mentor_note(pg_temp.a('e3'), E'Talked prices.\nShe''ll try R80.', pg_temp.t('c1')), 'once-taken', 'sending it again adds nothing');
select is(public.add_mentor_note(pg_temp.a('e3'), 'Another.', pg_temp.t('c3')), 'once-expired', 'a token that has run out is refused');
select is(public.add_mentor_note(pg_temp.a('e3'), 'Another.', pg_temp.t('c6')), 'once-expired', 'and another session''s');
select is(public.add_mentor_note(pg_temp.a('e3'), 'Another.', null), 'once-expired', 'and none');
select is(public.add_mentor_note(pg_temp.a('e6'), 'About Kabelo.', pg_temp.t('c2')), 'forbidden', 'a shop she doesn''t mentor is refused');
select throws_ok(format('select public.add_mentor_note(%L, %L, %L)', pg_temp.a('e3'), '', pg_temp.t('c2')), '23514', null, 'a note has words');
select throws_ok(format('select public.add_mentor_note(%L, %L, %L)', pg_temp.a('e3'), repeat('a', 1001), pg_temp.t('c2')), '23514', null, 'at most 1,000');
select pg_temp.sign_out();
select is(pg_temp.taken('e2', 'c2'), false, 'a refused note leaves its token');
select pg_temp.sign_in('e6');
select is(public.add_mentor_note(pg_temp.a('e3'), 'Kabelo too.', pg_temp.t('c6')), 'forbidden', 'Kabelo, a mentor but not hers, is refused');
select pg_temp.sign_out();
select pg_temp.sign_in('e1');
select is(public.add_mentor_note(pg_temp.a('e3'), 'Admin note.', pg_temp.t('c7')), 'changed', 'an admin may write one');
select pg_temp.sign_out();
select is(
  array(select concat_ws(' | ', kind, coalesce(check_in_on::text, '-'), text, author_name, (author_id is not null)::text)
        from public.mentor_notes where owner_id = pg_temp.a('e3') order by text),
  array['note | - | Admin note. | Adam | true', E'note | - | Talked prices.\nShe''ll try R80. | Mona | true'],
  'two notes, signed'
);
select is(
  pg_temp.audit(),
  array[
    'Adam | Adam | note-added | shop | tool-lerato | Lerato crafts |  | Lerato | true',
    'Mona | Mona | note-added | shop | tool-lerato | Lerato crafts |  | Lerato | true'
  ],
  'an entry each, never the note itself'
);
select is(pg_temp.notes(), '{}'::text[], 'Lerato is never told');

select pg_temp.clear();
select pg_temp.sign_in('e2');
select is(public.add_check_in(pg_temp.a('e3'), pg_temp.today() + 1, 'Tomorrow.', pg_temp.t('c2')), 'check-in-day-future', 'a check-in can''t be tomorrow');
select is(public.add_check_in(pg_temp.a('e3'), pg_temp.today(), 'Met at the stall.', pg_temp.t('c2')), 'changed', 'today is fine');
select is(public.add_check_in(pg_temp.a('e3'), pg_temp.today() - 3, 'Met at the stall.', pg_temp.t('c2')), 'once-taken', 'once');
select throws_ok(format('select public.add_check_in(%L, null, %L, %L)', pg_temp.a('e3'), 'No day.', pg_temp.t('c2')), '22023', null, 'a check-in has a day');
select pg_temp.sign_out();
select is(
  (select row(check_in_on = pg_temp.today(), text, author_name)::text from public.mentor_notes where kind = 'check-in'),
  row(true, 'Met at the stall.', 'Mona')::text,
  'one check-in, on today'
);
select is(
  pg_temp.audit(),
  array['Mona | Mona | check-in-added | shop | tool-lerato | Lerato crafts | ' || to_char(pg_temp.today(), 'YYYY-MM-DD') || ' | Lerato | true'],
  'its entry names the day'
);
-- A mentor whose role is removed.
update public.profiles set roles = '{}' where id = pg_temp.a('e2');
select pg_temp.issue('e2', 'c4');
select pg_temp.sign_in('e2');
select is(public.add_mentor_note(pg_temp.a('e3'), 'Still here?', pg_temp.t('c4')), 'forbidden', 'a mentor whose role has gone can''t add one');
select pg_temp.sign_out();
select is((select count(*) from public.mentor_notes where text = 'Still here?'), 0::bigint, 'and none was added');
update public.profiles set roles = '{mentor}' where id = pg_temp.a('e2');

-- --- Staff roles (giveRole and removeRole, staff-accounts.ts:89 and :107; giveStaffRole, removeStaffRole) -----------

select pg_temp.clear();
select pg_temp.issue('e1', 'd1');
select pg_temp.issue('e1', 'd2');
select pg_temp.issue('e1', 'd3');
select pg_temp.issue('e1', 'd4');
select pg_temp.sign_in('e1');
select is(public.give_role('  Thandi.Tool@Eduvos.COM ', 'mentor', pg_temp.t('d1')), 'changed', 'Adam makes Thandi a mentor, by her address as typed');
select is(public.give_role('thandi.tool@eduvos.com', 'mentor', pg_temp.t('d1')), 'held', 'she holds it now');
select is(public.give_role('thandi.tool@eduvos.com', 'admin', pg_temp.t('d1')), 'once-taken', 'and the same form can''t give another');
select is(
  array[
    public.give_role('thandi', 'mentor', pg_temp.t('d2')), public.give_role('nobody@eduvos.com', 'mentor', pg_temp.t('d2')),
    public.give_role('tool-e0@eduvos.com', 'mentor', pg_temp.t('d2')), public.give_role('  ', 'mentor', pg_temp.t('d2'))
  ],
  array['no-account', 'no-account', 'no-account', 'no-account'],
  'never a search: part of an address, an unknown one, one that never finished signing in, or none'
);
select throws_ok(format('select public.give_role(%L, %L, %L)', 'tool-e8@eduvos.com', 'owner', pg_temp.t('d2')), '22023', null, 'a role is mentor or admin');
select is(public.give_role('tool-e8@eduvos.com', 'admin', pg_temp.t('d2')), 'changed', 'Adam makes Zola an admin');
select is(public.give_role('tool-e8@eduvos.com', 'mentor', pg_temp.t('d3')), 'changed', 'and a mentor');
select pg_temp.sign_out();
select is(
  array(select first_name || '=' || roles::text from public.profiles where id in (pg_temp.a('e4'), pg_temp.a('e8')) order by 1),
  array['Thandi={mentor}', 'Zola={mentor,admin}'],
  'roles are kept in the order mentor, admin'
);
select is(pg_temp.taken('e1', 'd4'), false, 'an unused form keeps its token');
select is(
  pg_temp.audit(),
  array[
    'Adam | Adam | role-given | account | ' || pg_temp.a('e4') || ' | Thandi | Mentor | Thandi | true',
    'Adam | Adam | role-given | account | ' || pg_temp.a('e8') || ' | Zola | Admin | Zola | true',
    'Adam | Adam | role-given | account | ' || pg_temp.a('e8') || ' | Zola | Mentor | Zola | true'
  ],
  'an entry for each role given, naming it'
);
select is(
  pg_temp.notes(),
  array[
    'Thandi | staff-role | mentor | You''re a Vossie mentor now. The Hub''s tools and the mentor dashboard are on your account page. | /account',
    'Zola | staff-role | admin | You''re a Vossie admin now. The admin console is on your account page. | /account',
    'Zola | staff-role | mentor | You''re a Vossie mentor now. The Hub''s tools and the mentor dashboard are on your account page. | /account'
  ],
  'and each is told, with a link to their account page'
);

-- Removing a mentor: the shops they mentor lose them, and the entry names those shops (removeStaffRole's detail).
update public.seller_profiles set mentor_id = pg_temp.a('e4') where account_id in (pg_temp.a('e6'), pg_temp.a('e7'));
select pg_temp.clear();
select pg_temp.sign_in('e1');
select is(public.remove_role(pg_temp.a('e4'), 'mentor'), 'changed', 'Adam takes Thandi''s mentor role away');
select is(public.remove_role(pg_temp.a('e4'), 'mentor'), 'nothing', 'once');
select is(public.remove_role(pg_temp.a('e4'), 'admin'), 'nothing', 'a role she never had is nothing');
select is(public.remove_role(pg_temp.a('e8'), 'mentor'), 'changed', 'and Zola''s, who mentors no shop');
select throws_ok(format('select public.remove_role(%L, %L)', pg_temp.a('e4'), 'owner'), '22023', null, 'a role is mentor or admin');
select pg_temp.sign_out();
select is(
  (select count(*) from public.seller_profiles where mentor_id = pg_temp.a('e4')),
  0::bigint,
  'Kabelo''s and Sipho''s shops have no mentor now'
);
select is(
  pg_temp.audit(),
  array[
    'Adam | Adam | role-removed | account | ' || pg_temp.a('e4') || ' | Thandi | Mentor. No mentor now: Kabelo kicks, Sipho prints | Thandi | true',
    'Adam | Adam | role-removed | account | ' || pg_temp.a('e8') || ' | Zola | Mentor | Zola | true'
  ],
  'the entry names the shops left without a mentor'
);
select is(
  pg_temp.notes(),
  array[
    'Thandi | staff-role | mentor | Your mentor role on Vossie has ended. Thank you for helping student sellers. | /account',
    'Zola | staff-role | mentor | Your mentor role on Vossie has ended. Thank you for helping student sellers. | /account'
  ],
  'each is told'
);

-- Admins: never your own, never the last (spec decisions 5 and 6), counted under a lock.
update public.profiles set roles = '{}' where 'admin' = any (roles) and id not in (pg_temp.a('e1'), pg_temp.a('e8'));
select pg_temp.clear();
select pg_temp.sign_in('e1');
select is(public.remove_role(pg_temp.a('e1'), 'admin'), 'own-admin', 'Adam can''t take away his own admin role');
select pg_temp.sign_out();
select is(
  (select array_agg(first_name order by first_name) from public.profiles where 'admin' = any (roles)),
  array['Adam', 'Zola'],
  'two admins, Adam and Zola'
);
-- Two admins removing each other at the same moment: the first takes the lock and removes; the second waits for it,
-- then finds its own role gone (the role is checked again under the lock), so one admin always stays.
select pg_temp.sign_in('e1');
select is(public.remove_role(pg_temp.a('e8'), 'admin'), 'changed', 'Adam removes Zola''s admin role');
select pg_temp.sign_out();
select ok(
  exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and granted and classid = hashtext('vossie:staff-roles')::oid
      and objid = 0 and objsubid = 2
  ),
  'it held the staff-roles lock until its transaction ends'
);
select pg_temp.sign_in('e8');
select is(public.remove_role(pg_temp.a('e1'), 'admin'), 'forbidden', 'Zola''s removal of Adam, after it, is refused');
select pg_temp.sign_out();
select is(
  (select array_agg(first_name order by first_name) from public.profiles where 'admin' = any (roles)),
  array['Adam'],
  'Adam is the one admin left'
);
select ok(
  (select prosrc ~ 'pg_advisory_xact_lock[^;]*;\s+if not private\.is_staff\(''admin''\)' and prosrc like '%''last-admin''%'
   from pg_proc where oid = 'public.remove_role(uuid, text)'::regprocedure),
  'the role is checked again under the lock, and the last admin is refused'
);
select is(
  pg_temp.audit(),
  array['Adam | Adam | role-removed | account | ' || pg_temp.a('e8') || ' | Zola | Admin | Zola | true'],
  'only the removal that happened is logged'
);
select is(
  pg_temp.notes(),
  array['Zola | staff-role | admin | Your admin role on Vossie has ended. | /account'],
  'and Zola is told'
);

-- --- One-time tokens (private.take_once_token; review fix I1) ---------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.form_states', 'update')
  and has_column_privilege('authenticated', 'public.form_states', 'taken', 'update'),
  'authenticated keeps phase A''s plain update grant on form states'
);
select pg_temp.sign_in('e1');
select is(pg_temp.taken('e1', 'd1'), true, 'Adam''s first role token is taken');
update public.form_states set taken = false where form = 'staff-once:' || pg_temp.t('d1');
select is(pg_temp.taken('e1', 'd1'), true, 'he can''t clear it: taken is set, never cleared');
update public.form_states set expires_at = now() - interval '1 minute' where form = 'staff-once:' || pg_temp.t('d1');
select is(
  (select expires_at > now() from public.form_states where form = 'staff-once:' || pg_temp.t('d1')),
  true, 'nor run it out early'
);
select throws_ok(
  format('update public.form_states set form = %L where form = %L', 'staff-once:moved', 'staff-once:' || pg_temp.t('d1')),
  '42501', null, 'nor move it to another form'
);
select throws_ok(
  format('delete from public.form_states where form = %L', 'staff-once:' || pg_temp.t('d1')),
  '42501', null, 'nor delete it while it lasts'
);
select throws_ok(
  format('insert into public.form_states (session_id, form, account_id, expires_at) values (%L, %L, %L, now() + interval ''1 hour'')',
    pg_temp.session('e1'), 'staff-once:' || pg_temp.t('d1'), pg_temp.a('e1')),
  '23505', null, 'so it can''t be made again free'
);
select is(public.give_role('tool-e7@eduvos.com', 'mentor', pg_temp.t('d1')), 'once-taken', 'and it gives nothing again');
-- The app saves where the first send went with taken: true (leaveOnceToken, once.ts:76): an upsert, on a taken row and
-- on a new one.
select lives_ok(
  format($$insert into public.form_states (session_id, form, account_id, values, notice, taken, expires_at)
    values (%L, %L, %L, '{"path": "/admin/staff"}', 'role-given', true, now() + interval '1 hour')
    on conflict (session_id, form) do update set values = excluded.values, notice = excluded.notice, taken = excluded.taken,
      expires_at = excluded.expires_at$$,
    pg_temp.session('e1'), 'staff-once:' || pg_temp.t('d1'), pg_temp.a('e1')),
  'the app''s upsert with taken = true works on a taken row'
);
select lives_ok(
  format($$insert into public.form_states (session_id, form, account_id, taken, expires_at)
    values (%L, %L, %L, true, now() + interval '1 hour')
    on conflict (session_id, form) do update set taken = excluded.taken$$,
    pg_temp.session('e1'), 'selling-once:' || pg_temp.t('e9'), pg_temp.a('e1')),
  'and on a new row'
);
select lives_ok(
  format('delete from public.form_states where form = %L', 'staff-once:' || pg_temp.t('d4')),
  'a token not taken can still be deleted by its owner'
);
select pg_temp.sign_out();
select is(
  (select row(taken, notice, values ->> 'path')::text from public.form_states where form = 'staff-once:' || pg_temp.t('d1')),
  row(true, 'role-given', '/admin/staff')::text,
  'the taken row keeps where it went, and stays taken'
);
update public.form_states set expires_at = now() - interval '1 minute', taken = true where form = 'staff-once:' || pg_temp.t('d2');
select pg_temp.sign_in('e1');
select lives_ok(
  format('delete from public.form_states where form = %L', 'staff-once:' || pg_temp.t('d2')),
  'a taken token that has run out can be deleted'
);
select pg_temp.sign_out();
set local role service_role;
select lives_ok(
  format('delete from public.form_states where form = %L', 'staff-once:' || pg_temp.t('d1')),
  'and the server''s sweep deletes any'
);
reset role;
select is((select count(*) from public.form_states where form like 'staff-once:%' and account_id = pg_temp.a('e1') and form <> 'staff-once:' || pg_temp.t('d3') and form <> 'staff-once:' || pg_temp.t('c7')), 0::bigint, 'all three are gone');

-- --- Hiding needs an open report (Task 4's open question 2) ------------------------------------------------------------

insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason, target_gone) values
  (pg_temp.r('e1'), pg_temp.a('e4'), 'listing', 'tool-l-e3', 'Thing e3', 'scam', true),
  (pg_temp.r('e2'), pg_temp.a('e4'), 'request', 'tool-r1', 'Need a desk lamp', 'spam', false);
update public.reports set status = 'closed', outcome = 'dismissed', note = 'Fine.', closed_at = now() where id = pg_temp.r('e2');
select pg_temp.clear();
select pg_temp.sign_in('e1');
select is(public.hide_listing('tool-l-e3', 'Copies.'), 'no-open-report', 'a listing with no open report can''t be hidden');
select is(public.hide_request('tool-r1', 'Contact details.'), 'no-open-report', 'nor a request whose only report is closed');
select is(public.hide_listing('tool-none', 'Copies.'), 'nothing', 'one that isn''t there is still nothing');
select is(public.hide_listing('tool-l-e6', 'Copies.'), 'nothing', 'nor one already hidden');
select pg_temp.sign_out();
select is(
  (select count(*) from public.listings where id = 'tool-l-e3' and hidden_at is null)
    + (select count(*) from public.requests where id = 'tool-r1' and hidden_at is null),
  2::bigint,
  'both stay shown'
);
select is(pg_temp.audit() || pg_temp.notes(), '{}'::text[], 'nothing logged, nobody told');
insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason) values
  (pg_temp.r('e3'), pg_temp.a('e8'), 'listing', 'tool-l-e3', 'Thing e3', 'scam'),
  (pg_temp.r('e4'), pg_temp.a('e4'), 'request', 'tool-r1', 'Need a desk lamp', 'spam');
select pg_temp.sign_in('e1');
select is(public.hide_listing('tool-l-e3', 'Copies.'), 'changed', 'with an open report it can');
select is(public.hide_request('tool-r1', 'Contact details.'), 'changed', 'and so can the request');
select pg_temp.sign_out();
select is(
  array[
    (select status from public.reports where id = pg_temp.r('e1')), (select status from public.reports where id = pg_temp.r('e3')),
    (select status from public.reports where id = pg_temp.r('e4'))
  ],
  array['open', 'closed', 'closed'],
  'their open reports close; the gone one is left'
);

select * from finish();
rollback;
