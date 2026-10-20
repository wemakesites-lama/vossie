-- Schema catch-up, Task 2: the staff tools' tables and the staff reads of phase A's tables (supabase schema catch-up
-- plan; lib/types.ts, lib/data/rows.ts, lib/staff/rules.ts, lib/staff/post-rules.ts, lib/data/hub-posts.ts,
-- lib/data/mentors.ts, lib/data/shop-stats.ts, lib/data/featured.ts).
begin;
select plan(166);

create function pg_temp.sign_in(account uuid) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', account, 'role', 'authenticated', 'session_id', '50000000-0000-4000-8000-0000000000e1')::text,
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
-- The account ids, by their last two characters.
create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
grant execute on function pg_temp.a(text), pg_temp.s(text) to public;

-- Places.
insert into public.campuses (slug, name, region, sort) values ('test-campus', 'Test campus', 'Gauteng', 99);
insert into public.categories (slug, name, sort) values ('test-category', 'Test category', 99);
insert into public.pickup_points (id, campus_slug, name, retired_at) values
  ('20000000-0000-4000-8000-0000000000e1', 'test-campus', 'Old library gate', now());

-- People:
-- e1 Sipho, approved shop, mentored by Mona (e6);       e2 Naledi, approved shop, mentored by Kabelo (e7);
-- e3 Lerato, pending shop, Mona set as mentor directly;  e4 Thandi, a student;
-- e5 Adam, an admin;                                     e6 Mona, a mentor;
-- e7 Kabelo, a mentor whose own shop Mona mentors;       e8 Ayanda, an admin whose own shop Mona mentors;
-- e9 Dumi, an admin who loses the role.
insert into auth.users (id, email)
select pg_temp.a(n), 'staff' || n || '@eduvos.com'
from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9']) n;
insert into public.profiles (id, first_name, campus_slug, roles)
select pg_temp.a(n), 'User ' || n, 'test-campus',
  case when n in ('e5', 'e8', 'e9') then array['admin'] when n in ('e6', 'e7') then array['mentor'] else '{}'::text[] end
from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9']) n;
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since)
select pg_temp.s(n), 'staff-shop-' || n, pg_temp.a(n), 'Staff shop ' || n, 'test-category', 'test-campus', '2026-01'
from unnest(array['e1', 'e2', 'e3', 'e7', 'e8']) n;
insert into public.seller_profiles (account_id, status, shop_id, mentor_id) values
  (pg_temp.a('e1'), 'approved', pg_temp.s('e1'), pg_temp.a('e6')),
  (pg_temp.a('e2'), 'approved', pg_temp.s('e2'), pg_temp.a('e7')),
  (pg_temp.a('e3'), 'pending', pg_temp.s('e3'), pg_temp.a('e6')),
  (pg_temp.a('e7'), 'approved', pg_temp.s('e7'), pg_temp.a('e6')),
  (pg_temp.a('e8'), 'approved', pg_temp.s('e8'), pg_temp.a('e6'));
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at, hidden_at, hidden_reason) values
  ('st-live', pg_temp.s('e1'), 'available', 'item', 'Lamp', 'test-category', 'good', 100, 'cash', 'A lamp.', 'online', 'test-campus', now(), null, null),
  ('st-draft', pg_temp.s('e1'), 'draft', 'item', 'Desk', 'test-category', 'good', 100, 'cash', 'A desk.', 'online', 'test-campus', null, null, null),
  ('st-hidden', pg_temp.s('e1'), 'available', 'item', 'Fake watch', 'test-category', 'good', 100, 'cash', 'A watch.', 'online', 'test-campus', now(), now(), 'Counterfeit.'),
  ('st-e2-draft', pg_temp.s('e2'), 'draft', 'item', 'Chair', 'test-category', 'good', 100, 'cash', 'A chair.', 'online', 'test-campus', null, null, null),
  ('st-e3', pg_temp.s('e3'), 'available', 'item', 'Kettle', 'test-category', 'good', 100, 'cash', 'A kettle.', 'online', 'test-campus', now(), null, null);
insert into public.reports (id, reporter_id, target_kind, target_id, target_title, reason, status, outcome, note, closed_at, closed_by) values
  ('60000000-0000-4000-8000-0000000000e1', pg_temp.a('e4'), 'listing', 'st-hidden', 'Fake watch', 'scam', 'closed', 'dismissed', 'Checked: all fine.', now(), pg_temp.a('e5')),
  ('60000000-0000-4000-8000-0000000000e2', pg_temp.a('e2'), 'seller', 'staff-shop-e1', 'Staff shop e1', 'spam', 'open', null, null, null, null);

-- --- The tables ------------------------------------------------------------------------------------------------------

select has_table('public', 'audit_log', 'the audit log has a table');
select has_table('public', 'featured_pins', 'Featured pins have a table');
select has_table('public', 'featured_draws', 'Featured draws have a table');
select has_table('public', 'mentor_notes', 'mentors'' notes have a table');
select has_table('public', 'hub_posts', 'Hub posts have a table');
select has_table('public', 'hub_rsvps', 'RSVPs have a table');
select has_table('public', 'hub_bookings', 'slot requests have a table');
select has_view('public', 'staff_hub_posts', 'staff read every post through a view');
select has_view('public', 'staff_reports', 'and every report');
select has_view('public', 'staff_seller_profiles', 'and every seller profile');
select is(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.audit_log'::regclass, 'public.featured_pins'::regclass, 'public.featured_draws'::regclass,
    'public.mentor_notes'::regclass, 'public.hub_posts'::regclass, 'public.hub_rsvps'::regclass,
    'public.hub_bookings'::regclass)),
  true,
  'every one has row level security on'
);
select is(
  array(
    select v::text from unnest(array['public.staff_hub_posts', 'public.staff_reports', 'public.staff_seller_profiles']::regclass[]) v
    where not coalesce((select reloptions from pg_class where oid = v) @> array['security_invoker=true'], false)
  ),
  '{}'::text[],
  'the staff views run as the reader (security_invoker), so they are not security definer views'
);

-- Writes go through Task 5's functions: no API role inserts, updates or deletes, and none truncates.
select is(
  array(
    select t || ' ' || r || ' ' || p
    from unnest(array['public.audit_log', 'public.featured_pins', 'public.featured_draws', 'public.mentor_notes',
      'public.hub_posts', 'public.hub_rsvps', 'public.hub_bookings']) t,
      unnest(array['anon', 'authenticated']) r,
      unnest(array['insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p
    where (p in ('delete', 'truncate', 'trigger') and has_table_privilege(r, t, p))
      or (p in ('insert', 'update', 'references') and has_any_column_privilege(r, t, p))
  ),
  '{}'::text[],
  'the API roles have no write on the staff tables'
);
select is(
  array(
    select t || ' ' || r
    from unnest(array['public.audit_log', 'public.featured_pins', 'public.featured_draws', 'public.mentor_notes',
      'public.hub_rsvps', 'public.hub_bookings', 'public.staff_hub_posts', 'public.staff_reports',
      'public.staff_seller_profiles']) t,
      unnest(array['anon']) r
    where has_any_column_privilege(r, t, 'select')
  ),
  '{}'::text[],
  'anon reads none of them but the published posts'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.featured_draws', 'select')
  and has_table_privilege('service_role', 'public.featured_draws', 'insert'),
  'Featured draws are the server''s only (plan decision 5)'
);
select ok(
  has_table_privilege('service_role', 'public.audit_log', 'insert')
  and not has_table_privilege('service_role', 'public.audit_log', 'delete')
  and not has_table_privilege('service_role', 'public.audit_log', 'update')
  and not has_table_privilege('service_role', 'public.audit_log', 'truncate'),
  'the audit log has no update or delete, even for the server'
);
select ok(
  has_column_privilege('anon', 'public.hub_posts', 'title', 'select')
  and not has_column_privilege('anon', 'public.hub_posts', 'author_id', 'select')
  and not has_column_privilege('authenticated', 'public.hub_posts', 'author_id', 'select')
  and has_column_privilege('service_role', 'public.hub_posts', 'author_id', 'select'),
  'a post''s author is left out of the public column grant'
);

-- --- audit_log (AuditRow, rows.ts:351) -------------------------------------------------------------------------------

-- The 27 actions (AuditAction, types.ts:479) and the 8 target kinds (AuditTargetKind, :520).
insert into public.audit_log (staff_id, staff_name, action, target_kind, target_id, target_name, detail, subject_id)
select pg_temp.a('e9'), 'User e9', a, 'shop', 'staff-shop-e1', 'Staff shop e1', '', pg_temp.a('e1')
from unnest(array[
  'shop-approved', 'shop-declined', 'shop-verified', 'shop-unverified', 'shop-paused', 'shop-resumed', 'mentor-assigned',
  'mentor-removed', 'report-dismissed', 'listing-hidden', 'request-hidden', 'featured-pinned', 'featured-unpinned',
  'point-added', 'point-renamed', 'point-retired', 'point-restored', 'post-created', 'post-updated', 'booking-accepted',
  'booking-declined', 'note-added', 'check-in-added', 'role-given', 'role-removed', 'listing-shown', 'request-shown'
]) a;
select is((select count(*) from public.audit_log where staff_id = pg_temp.a('e9')), 27::bigint, 'the 27 actions are allowed');
select throws_ok(
  $$insert into public.audit_log (staff_name, action, target_kind, target_id, target_name) values ('Adam', 'shop-deleted', 'shop', 'x', 'X')$$,
  '23514', null, 'and nothing else'
);
insert into public.audit_log (staff_id, staff_name, action, target_kind, target_id, target_name)
select pg_temp.a('e5'), 'User e5', 'post-updated', k, 'x-' || k, 'Target ' || k
from unnest(array['shop', 'listing', 'report', 'pickup-point', 'post', 'booking', 'request', 'account']) k;
select is((select count(*) from public.audit_log where staff_id = pg_temp.a('e5')), 8::bigint, 'the 8 target kinds are allowed');
select throws_ok(
  $$insert into public.audit_log (staff_name, action, target_kind, target_id, target_name) values ('Adam', 'post-updated', 'campus', 'x', 'X')$$,
  '23514', null, 'and nothing else'
);
select is(
  (select detail from public.audit_log where target_id = 'x-shop'),
  '',
  'the detail is "" when there was none'
);
select lives_ok(
  $$insert into public.audit_log (staff_id, staff_name, action, target_kind, target_id, target_name) values (null, 'Deleted account', 'role-removed', 'account', '', 'Deleted account')$$,
  'a forgotten entry keeps no id, name or staff member (staff-privacy.ts:21)'
);
select throws_ok(
  $$insert into public.audit_log (staff_name, action, target_kind, target_id, target_name, detail) values ('Adam', 'report-dismissed', 'report', 'x', 'X', E'No‮thanks')$$,
  '23514', null, 'a detail is clean text'
);
select throws_ok(
  $$insert into public.audit_log (staff_name, action, target_kind, target_id, target_name) values ('', 'report-dismissed', 'report', 'x', 'X')$$,
  '23514', null, 'and a staff member has a name'
);

-- --- featured_pins and featured_draws (FeaturedPinRow, FeaturedDrawRow, rows.ts:367; featured.ts) -------------------

insert into public.featured_pins (id, shop_id, campus_slug, day, pinned_by) values
  ('70000000-0000-4000-8000-0000000000e1', pg_temp.s('e1'), null, '2026-10-21', pg_temp.a('e5')),
  ('70000000-0000-4000-8000-0000000000e2', pg_temp.s('e1'), 'test-campus', '2026-10-21', pg_temp.a('e5'));
select throws_ok(
  $$insert into public.featured_pins (shop_id, campus_slug, day) values ('10000000-0000-4000-8000-0000000000e1', null, '2026-10-21')$$,
  '23505', null, 'a shop is pinned once a day for every campus (null), nulls not distinct'
);
select throws_ok(
  $$insert into public.featured_pins (shop_id, campus_slug, day) values ('10000000-0000-4000-8000-0000000000e1', 'test-campus', '2026-10-21')$$,
  '23505', null, 'and once for a campus'
);
select lives_ok(
  $$insert into public.featured_pins (shop_id, campus_slug, day) values ('10000000-0000-4000-8000-0000000000e1', null, '2026-10-22')$$,
  'another day is another pin'
);
insert into public.featured_draws (campus_slug, day, shop_ids) values
  (null, '2026-10-21', array[pg_temp.s('e1'), pg_temp.s('e2')]);
select throws_ok(
  $$insert into public.featured_draws (campus_slug, day, shop_ids) values (null, '2026-10-21', '{}')$$,
  '23505', null, 'one draw a day for every campus (null), nulls not distinct'
);
select lives_ok(
  $$insert into public.featured_draws (campus_slug, day, shop_ids) values ('test-campus', '2026-10-21', '{}')$$,
  'and one for each campus'
);
select throws_ok(
  $$insert into public.featured_draws (campus_slug, day, shop_ids) values ('test-campus', '2026-10-22', array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()])$$,
  '23514', null, 'a draw has at most 4 places (FEATURED_PLACES)'
);
select throws_ok(
  $$insert into public.featured_pins (shop_id, campus_slug, day) values ('10000000-0000-4000-8000-0000000000e1', 'no-campus', '2026-10-21')$$,
  '23503', null, 'a pin''s campus is a campus'
);

-- --- mentor_notes (MentorNoteRow, rows.ts:400; MENTOR_NOTE_MAX) -----------------------------------------------------

insert into public.mentor_notes (id, owner_id, kind, check_in_on, text, author_id, author_name)
select ('80000000-0000-4000-8000-0000000000' || n)::uuid, pg_temp.a(n), 'note', null, 'About ' || n || '.',
  case n when 'e2' then pg_temp.a('e7') else pg_temp.a('e6') end, case n when 'e2' then 'User e7' else 'User e6' end
from unnest(array['e1', 'e2', 'e3', 'e7', 'e8']) n;
insert into public.mentor_notes (owner_id, kind, check_in_on, text, author_id, author_name) values
  (pg_temp.a('e1'), 'check-in', '2026-10-06', E'Met at the Hub.\nPriced the calculators.', pg_temp.a('e6'), 'User e6');
select throws_ok(
  $$insert into public.mentor_notes (owner_id, kind, check_in_on, text, author_name) values ('00000000-0000-4000-8000-0000000000e1', 'check-in', null, 'Met.', 'Mona')$$,
  '23514', null, 'a check-in has its day'
);
select throws_ok(
  $$insert into public.mentor_notes (owner_id, kind, check_in_on, text, author_name) values ('00000000-0000-4000-8000-0000000000e1', 'note', '2026-10-06', 'Met.', 'Mona')$$,
  '23514', null, 'and a note has none'
);
select throws_ok(
  $$insert into public.mentor_notes (owner_id, kind, text, author_name) values ('00000000-0000-4000-8000-0000000000e1', 'memo', 'Met.', 'Mona')$$,
  '23514', null, 'a note or a check-in, nothing else'
);
select throws_ok(
  $$insert into public.mentor_notes (owner_id, kind, text, author_name) values ('00000000-0000-4000-8000-0000000000e1', 'note', repeat('a', 1001), 'Mona')$$,
  '23514', null, 'at most 1,000 characters (MENTOR_NOTE_MAX)'
);
select throws_ok(
  $$insert into public.mentor_notes (owner_id, kind, text, author_name) values ('00000000-0000-4000-8000-0000000000e1', 'note', '', 'Mona')$$,
  '23514', null, 'and not empty'
);
select throws_ok(
  $$insert into public.mentor_notes (owner_id, kind, text, author_name) values ('00000000-0000-4000-8000-0000000000e1', 'note', E'Fine​.', 'Mona')$$,
  '23514', null, 'clean text'
);

-- --- hub_posts (HubPostRow, rows.ts:420; post-rules.ts:12 to 16) ----------------------------------------------------

insert into public.hub_posts (id, kind, title, summary, place, body, campus_slug, starts_at, capacity, going, image_src, published, published_at, author_id) values
  ('st-event', 'event', 'Market night', 'Sell at the Hub.', 'The Hub, Block C', 'Come along.', 'test-campus', '2026-11-01T16:00:00Z', 3, 1, '/placeholders/hub/banner.svg', true, '2026-10-01T08:00:00Z', pg_temp.a('e6')),
  ('st-draft', 'office-hours', 'Draft hours', 'Not yet.', 'Room 4', 'Soon.', 'test-campus', '2026-11-02T11:00:00Z', null, null, null, false, null, pg_temp.a('e6')),
  ('st-tip', 'tip', 'Price fairly', 'Look around first.', null, 'Compare.', null, null, null, null, null, true, '2026-10-02T08:00:00Z', null),
  ('st-oh', 'office-hours', 'Your first listing', 'Bring your phone.', 'Room 4', 'We help.', 'test-campus', '2026-11-03T11:00:00Z', null, null, null, true, '2026-10-03T08:00:00Z', pg_temp.a('e6'));
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, published) values ('poll', 'A', 'B', 'C', false)$$,
  '23514', null, 'a post is an event, office hours or a tip (HubPostKind)'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, published) values ('tip', repeat('a', 71), 'B', 'C', false)$$,
  '23514', null, 'a title is at most 70 characters (POST_TITLE_MAX)'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, published) values ('tip', E'Two\nlines', 'B', 'C', false)$$,
  '23514', null, 'and one line'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, published) values ('tip', 'A', repeat('a', 161), 'C', false)$$,
  '23514', null, 'a summary is at most 160 (POST_SUMMARY_MAX)'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, published) values ('tip', 'A', 'B', repeat('a', 4001), false)$$,
  '23514', null, 'a body at most 4,000 (POST_BODY_MAX)'
);
select lives_ok(
  $$insert into public.hub_posts (id, kind, title, summary, body, published) values ('st-long', 'tip', repeat('a', 70), repeat('b', 160), repeat(E'c\n', 2000), false)$$,
  'and those limits are allowed, with line breaks in the body'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, campus_slug, published) values ('tip', 'A', 'B', 'C', 'test-campus', false)$$,
  '23514', null, 'a tip is for every campus (null)'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, place, capacity, going, published) values ('event', 'A', 'B', 'C', 'Hall', 10, 0, false)$$,
  '23514', null, 'an event has a start'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, starts_at, capacity, going, published) values ('event', 'A', 'B', 'C', now(), 10, 0, false)$$,
  '23514', null, 'and a place'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, starts_at, place, capacity, going, published) values ('event', 'A', 'B', 'C', now(), repeat('p', 81), 10, 0, false)$$,
  '23514', null, 'of at most 80 characters (POST_PLACE_MAX)'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, starts_at, place, going, published) values ('event', 'A', 'B', 'C', now(), 'Hall', 0, false)$$,
  '23514', null, 'and places'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, starts_at, place, capacity, going, published) values ('event', 'A', 'B', 'C', now(), 'Hall', 1001, 0, false)$$,
  '23514', null, '1 to 1,000 of them (POST_CAPACITY_MAX)'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, starts_at, place, capacity, published) values ('event', 'A', 'B', 'C', now(), 'Hall', 10, false)$$,
  '23514', null, 'and its count before Vossie''s RSVPs'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, starts_at, place, capacity, published) values ('office-hours', 'A', 'B', 'C', now(), 'Hall', 10, false)$$,
  '23514', null, 'office hours have no places'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, starts_at, published) values ('tip', 'A', 'B', 'C', now(), false)$$,
  '23514', null, 'and a tip has no start'
);
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, published) values ('tip', 'A', 'B', 'C', true)$$,
  '23514', null, 'a published post has its first publishing time'
);
select throws_ok(
  $$update public.hub_posts set published_at = '2026-10-05T08:00:00Z' where id = 'st-event'$$,
  '23514', null, 'which never changes'
);
select lives_ok(
  $$update public.hub_posts set published = false where id = 'st-tip'$$,
  'a post taken back to a draft keeps it'
);
select is((select published_at from public.hub_posts where id = 'st-tip'), '2026-10-02T08:00:00Z'::timestamptz, 'unchanged');
update public.hub_posts set published = true where id = 'st-tip';
select throws_ok(
  $$insert into public.hub_posts (kind, title, summary, body, published, image_src) values ('tip', 'A', 'B', 'C', false, 'https://example.com/a.png')$$,
  '23514', null, 'a cover is a stored photo or one of the placeholders'
);
select throws_ok(
  $$insert into public.hub_posts (id, kind, title, summary, body, published) values ('H 1', 'tip', 'A', 'B', 'C', false)$$,
  '23514', null, 'an id is a short link word'
);
insert into public.hub_posts (kind, title, summary, body, published) values ('tip', 'A new tip', 'B', 'C', false);
select ok(
  (select id ~ '^[a-z0-9]{10}$' from public.hub_posts where title = 'A new tip'),
  'a new post gets a short id'
);

-- --- hub_rsvps and hub_bookings (HubRsvpRow, HubBookingRow, rows.ts:432; HELP_MAX, TIME_MAX) ------------------------

insert into public.hub_rsvps (post_id, account_id) values ('st-event', pg_temp.a('e4')), ('st-event', pg_temp.a('e1'));
select throws_ok(
  $$insert into public.hub_rsvps (post_id, account_id) values ('st-event', '00000000-0000-4000-8000-0000000000e4')$$,
  '23505', null, 'one RSVP a student'
);
insert into public.hub_bookings (id, post_id, account_id, help, time, status, answered_at, answered_by) values
  ('90000000-0000-4000-8000-0000000000e1', 'st-oh', pg_temp.a('e4'), E'Pricing my braiding.\nAnd photos.', 'After 13:30', 'open', null, null),
  ('90000000-0000-4000-8000-0000000000e2', 'st-oh', pg_temp.a('e1'), 'My listing.', '', 'declined', now(), pg_temp.a('e5'));
select throws_ok(
  $$insert into public.hub_bookings (post_id, account_id, help, time, status) values ('st-oh', '00000000-0000-4000-8000-0000000000e4', 'Again.', '', 'open')$$,
  '23505', null, 'one open request a student for each office hours'
);
select lives_ok(
  $$insert into public.hub_bookings (post_id, account_id, help, time, status) values ('st-oh', '00000000-0000-4000-8000-0000000000e1', 'Again.', '', 'open')$$,
  'a new one once the last was answered'
);
select throws_ok(
  $$insert into public.hub_bookings (post_id, account_id, help, time, status) values ('st-event', '00000000-0000-4000-8000-0000000000e2', repeat('h', 301), '', 'open')$$,
  '23514', null, 'help is at most 300 characters (HELP_MAX)'
);
select throws_ok(
  $$insert into public.hub_bookings (post_id, account_id, help, time, status) values ('st-event', '00000000-0000-4000-8000-0000000000e2', '', '', 'open')$$,
  '23514', null, 'and not empty'
);
select throws_ok(
  $$insert into public.hub_bookings (post_id, account_id, help, time, status) values ('st-event', '00000000-0000-4000-8000-0000000000e2', 'Help.', repeat('t', 101), 'open')$$,
  '23514', null, 'a time at most 100 (TIME_MAX)'
);
select throws_ok(
  $$insert into public.hub_bookings (post_id, account_id, help, time, status) values ('st-event', '00000000-0000-4000-8000-0000000000e2', 'Help.', E'Mon\nTue', 'open')$$,
  '23514', null, 'on one line'
);
select throws_ok(
  $$insert into public.hub_bookings (post_id, account_id, help, time, status) values ('st-event', '00000000-0000-4000-8000-0000000000e2', 'Help.', '', 'maybe')$$,
  '23514', null, 'open, accepted or declined (BookingStatus)'
);
select throws_ok(
  $$insert into public.hub_bookings (post_id, account_id, help, time, status) values ('st-event', '00000000-0000-4000-8000-0000000000e2', 'Help.', '', 'accepted')$$,
  '23514', null, 'an answer has its time'
);
select throws_ok(
  $$insert into public.hub_bookings (post_id, account_id, help, time, status, answered_at) values ('st-event', '00000000-0000-4000-8000-0000000000e2', 'Help.', '', 'open', now())$$,
  '23514', null, 'and an open request has none'
);

-- --- Who reads what: anon ----------------------------------------------------------------------------------------------

set local role anon;
select is(
  array(select id from public.hub_posts where id like 'st-%' order by id),
  array['st-event', 'st-oh', 'st-tip'],
  'anon reads published posts, never drafts (hub-posts.ts:47)'
);
select throws_ok($$select author_id from public.hub_posts$$, '42501', null, 'nor who wrote them');
select throws_ok($$select * from public.hub_posts$$, '42501', null, 'so a reader names the columns they read');
select is(public.hub_going('st-event'), 3, 'an event''s going is its count plus the RSVPs (hub-posts.ts:34)');
select is(public.hub_going('st-oh'), null::int, 'office hours have no count');
select is(public.hub_going('st-draft'), null::int, 'and a draft says nothing');
select throws_ok($$select id from public.staff_hub_posts$$, '42501', null, 'anon cannot read the staff posts view');
select throws_ok($$select id from public.staff_reports$$, '42501', null, 'nor the staff reports view');
select throws_ok($$select account_id from public.staff_seller_profiles$$, '42501', null, 'nor the staff seller profiles view');
select throws_ok($$select id from public.audit_log$$, '42501', null, 'nor the audit log');
select throws_ok($$select id from public.featured_draws$$, '42501', null, 'nor Featured draws');
select throws_ok($$select id from public.featured_pins$$, '42501', null, 'nor pins');
select throws_ok($$select id from public.mentor_notes$$, '42501', null, 'nor mentors'' notes');
select throws_ok($$select post_id from public.hub_rsvps$$, '42501', null, 'nor RSVPs');
select throws_ok($$select id from public.hub_bookings$$, '42501', null, 'nor slot requests');
select throws_ok(
  $$select * from public.mentor_shop_numbers('10000000-0000-4000-8000-0000000000e1')$$,
  '42501', null, 'nor a shop''s numbers'
);
reset role;

-- --- A student --------------------------------------------------------------------------------------------------------

select pg_temp.sign_in(pg_temp.a('e4'));
select is(
  array(select id from public.hub_posts where id like 'st-%' order by id),
  array['st-event', 'st-oh', 'st-tip'],
  'a student reads published posts only'
);
select throws_ok($$select author_id from public.hub_posts$$, '42501', null, 'and never who wrote them');
select is((select count(*) from public.staff_hub_posts), 0::bigint, 'the staff posts view shows a student nothing');
select is((select count(*) from public.staff_reports), 0::bigint, 'nor the staff reports view');
select is((select count(*) from public.staff_seller_profiles), 0::bigint, 'nor the staff seller profiles view');
select is((select count(*) from public.audit_log), 0::bigint, 'nor the audit log');
select is((select count(*) from public.featured_pins), 0::bigint, 'nor pins');
select throws_ok($$select id from public.featured_draws$$, '42501', null, 'and Featured draws are refused');
select is((select count(*) from public.mentor_notes), 0::bigint, 'no notes');
select is(
  array(select account_id from public.hub_rsvps order by 1),
  array[pg_temp.a('e4')],
  'their own RSVP only'
);
select is(
  array(select id from public.hub_bookings order by 1),
  array['90000000-0000-4000-8000-0000000000e1'::uuid],
  'their own slot requests only'
);
select is(
  (select count(*) from public.mentor_shop_numbers(pg_temp.s('e1'))),
  0::bigint,
  'no shop''s numbers'
);
select is((select count(*) from public.shops where id = pg_temp.s('e3')), 0::bigint, 'no pending shop');
select is(
  array(select id from public.listings where id like 'st-%' order by id),
  array['st-live'],
  'no hidden or draft listing'
);
select pg_temp.sign_out();

-- --- A mentor (Mona, e6) ----------------------------------------------------------------------------------------------

select pg_temp.sign_in(pg_temp.a('e6'));
select is(
  array(select account_id from public.seller_profiles where account_id::text like '00000000-0000-4000-8000-0000000000e_' order by 1),
  array[pg_temp.a('e1'), pg_temp.a('e7'), pg_temp.a('e8')],
  'a mentor reads the seller profiles of the open shops assigned to them, not another''s or a pending one'
);
select throws_ok($$select mentor_id from public.seller_profiles$$, '42501', null, 'not mentor_id from the table');
select is(
  array(select account_id::text || ':' || mentor_id::text from public.staff_seller_profiles where account_id::text like '00000000-0000-4000-8000-0000000000e_' order by 1),
  array[
    pg_temp.a('e1')::text || ':' || pg_temp.a('e6')::text,
    pg_temp.a('e7')::text || ':' || pg_temp.a('e6')::text,
    pg_temp.a('e8')::text || ':' || pg_temp.a('e6')::text
  ],
  'but through the staff view, for the same profiles'
);
select is(
  array(select owner_id::text || ':' || kind from public.mentor_notes order by owner_id, kind),
  array[
    pg_temp.a('e1')::text || ':check-in', pg_temp.a('e1')::text || ':note',
    pg_temp.a('e7')::text || ':note', pg_temp.a('e8')::text || ':note'
  ],
  'the notes about their mentees'' (mentors.ts:20), not another mentor''s or a pending shop''s'
);
select is(
  array(select slug from public.shops where slug like 'staff-shop-%' order by 1),
  array['staff-shop-e1', 'staff-shop-e2', 'staff-shop-e7', 'staff-shop-e8'],
  'every open shop, and no pending one even when assigned'
);
select is(
  array(select id || ':' || coalesce(hidden_reason, '') from public.listings where id like 'st-%' order by id),
  array['st-draft:', 'st-hidden:Counterfeit.', 'st-live:'],
  'their mentees'' listings in every state, hidden ones and why, and no one else''s draft'
);
select is((select count(*) from public.audit_log), 0::bigint, 'a mentor reads no audit log');
select is((select count(*) from public.staff_reports), 0::bigint, 'nor reports');
select is((select count(*) from public.featured_pins), 0::bigint, 'nor pins');
select is(
  array(select id || ':' || coalesce(author_id::text, 'the Hub') from public.staff_hub_posts where id in ('st-event', 'st-draft', 'st-tip') order by id),
  array['st-draft:' || pg_temp.a('e6')::text, 'st-event:' || pg_temp.a('e6')::text, 'st-tip:the Hub'],
  'hub staff read every post, drafts and authors included'
);
select is(
  array(select id from public.hub_bookings where id::text like '90000000-%' order by 1)::text[],
  array['90000000-0000-4000-8000-0000000000e1', '90000000-0000-4000-8000-0000000000e2'],
  'and every slot request'
);
select is(
  (select count(*) from public.mentor_shop_numbers(pg_temp.s('e1'))),
  1::bigint,
  'a mentee''s numbers'
);
select is(
  (select count(*) from public.mentor_shop_numbers(pg_temp.s('e2'))),
  0::bigint,
  'not another mentor''s shop''s'
);
select is(
  (select count(*) from public.mentor_shop_numbers(pg_temp.s('e3'))),
  0::bigint,
  'nor a pending shop''s'
);
select throws_ok(
  $$select private.can_mentor('00000000-0000-4000-8000-0000000000e1')$$,
  '42501', null, 'the helpers in private stay closed by name'
);
select pg_temp.sign_out();

-- --- A mentor who owns a shop (Kabelo, e7) ----------------------------------------------------------------------------

select pg_temp.sign_in(pg_temp.a('e7'));
select is(
  array(select owner_id from public.mentor_notes order by 1),
  array[pg_temp.a('e2')],
  'a mentor who owns a shop reads their mentee''s notes, never the ones about themselves (mentors.ts:23)'
);
select is(
  (select count(*) from public.mentor_shop_numbers(pg_temp.s('e7'))),
  0::bigint,
  'nor their own shop''s mentor numbers'
);
select is(
  array(select account_id from public.seller_profiles where account_id::text like '00000000-0000-4000-8000-0000000000e_' order by 1),
  array[pg_temp.a('e2'), pg_temp.a('e7')],
  'their own seller profile and their mentee''s'
);
select is(
  array(select account_id from public.staff_seller_profiles where account_id::text like '00000000-0000-4000-8000-0000000000e_' order by 1),
  array[pg_temp.a('e2')],
  'and only the mentee''s through the staff view: never who mentors them'
);
select pg_temp.sign_out();

-- --- An admin (Adam, e5) ----------------------------------------------------------------------------------------------

select pg_temp.sign_in(pg_temp.a('e5'));
select is(
  array(select account_id from public.seller_profiles where account_id::text like '00000000-0000-4000-8000-0000000000e_' order by 1),
  array[pg_temp.a('e1'), pg_temp.a('e2'), pg_temp.a('e3'), pg_temp.a('e7'), pg_temp.a('e8')],
  'an admin reads every seller profile'
);
select is(
  (select mentor_id from public.staff_seller_profiles where account_id = pg_temp.a('e2')),
  pg_temp.a('e7'),
  'with its mentor, through the staff view'
);
select is(
  array(select slug from public.shops where slug like 'staff-shop-%' order by 1),
  array['staff-shop-e1', 'staff-shop-e2', 'staff-shop-e3', 'staff-shop-e7', 'staff-shop-e8'],
  'every shop, pending ones too'
);
select is(
  array(select id from public.listings where id like 'st-%' order by id),
  array['st-draft', 'st-e2-draft', 'st-e3', 'st-hidden', 'st-live'],
  'every listing in any state, hidden ones too'
);
select is(
  (select row(note, closed_by)::text from public.staff_reports where id = '60000000-0000-4000-8000-0000000000e1'),
  row('Checked: all fine.', pg_temp.a('e5'))::text,
  'every report, its note and who closed it included, through the staff view'
);
select is(
  (select count(*) from public.staff_reports where id::text like '60000000-0000-4000-8000-0000000000e_'),
  2::bigint,
  'open ones too'
);
select throws_ok($$select note from public.reports$$, '42501', null, 'not from the table, whose grant leaves the note out');
select is(
  (select count(*) from public.audit_log where staff_id in (pg_temp.a('e5'), pg_temp.a('e9'))),
  35::bigint,
  'the audit log'
);
select is((select count(*) from public.featured_pins where shop_id = pg_temp.s('e1')), 3::bigint, 'Featured pins');
select throws_ok($$select id from public.featured_draws$$, '42501', null, 'but never the draws (plan decision 5)');
select is(
  (select count(*) from public.pickup_points where id = '20000000-0000-4000-8000-0000000000e1'),
  1::bigint,
  'pickup points, retired ones too'
);
select is(
  array(select owner_id from public.mentor_notes group by owner_id order by 1),
  array[pg_temp.a('e1'), pg_temp.a('e2'), pg_temp.a('e7'), pg_temp.a('e8')],
  'the notes about every mentored open shop''s owner, not a pending one''s'
);
select is(
  (select row(enquiries, due, replied_in_time, sales_confirmed)::text from public.mentor_shop_numbers(pg_temp.s('e2'))),
  row(0, 0, 0, 0)::text,
  'any mentored shop''s numbers'
);
select is(
  (select count(*) from public.staff_hub_posts where id like 'st-%'),
  (select count(*) from public.hub_posts where id like 'st-%') + 2,
  'every post, drafts included'
);
select pg_temp.sign_out();

-- --- An admin who owns a shop (Ayanda, e8) ----------------------------------------------------------------------------

select pg_temp.sign_in(pg_temp.a('e8'));
select is(
  array(select owner_id from public.mentor_notes group by owner_id order by 1),
  array[pg_temp.a('e1'), pg_temp.a('e2'), pg_temp.a('e7')],
  'an admin never reads the notes about themselves (amendment 15.3)'
);
select is(
  (select count(*) from public.mentor_shop_numbers(pg_temp.s('e8'))),
  0::bigint,
  'nor their own shop''s mentor numbers'
);
select pg_temp.sign_out();

-- --- An admin who loses the role (Dumi, e9) ---------------------------------------------------------------------------

select pg_temp.sign_in(pg_temp.a('e9'));
select is((select count(*) from public.audit_log where staff_id = pg_temp.a('e9')), 27::bigint, 'an admin reads the log');
select pg_temp.sign_out();
update public.profiles set roles = '{}' where id = pg_temp.a('e9');
select pg_temp.sign_in(pg_temp.a('e9'));
select is((select count(*) from public.audit_log), 0::bigint, 'once the role is removed: no audit log, at once');
select is((select count(*) from public.staff_reports), 0::bigint, 'no reports');
select is((select count(*) from public.staff_seller_profiles), 0::bigint, 'no seller profiles through the view');
select is((select count(*) from public.seller_profiles where account_id::text like '00000000-0000-4000-8000-0000000000e_'), 0::bigint, 'nor the table');
select is((select count(*) from public.staff_hub_posts), 0::bigint, 'no staff posts');
select is(
  array(select id from public.hub_posts where id like 'st-%' order by id),
  array['st-event', 'st-oh', 'st-tip'],
  'published posts only'
);
select is((select count(*) from public.mentor_notes), 0::bigint, 'no notes');
select is((select count(*) from public.featured_pins), 0::bigint, 'no pins');
select is((select count(*) from public.hub_bookings), 0::bigint, 'no slot requests');
select is((select count(*) from public.shops where id = pg_temp.s('e3')), 0::bigint, 'no pending shop');
select is(
  array(select id from public.listings where id like 'st-%' order by id),
  array['st-live'],
  'no hidden or draft listing'
);
select is((select count(*) from public.mentor_shop_numbers(pg_temp.s('e1'))), 0::bigint, 'and no shop''s numbers');
select pg_temp.sign_out();

-- A mentor who loses the role stops reading their mentees at once, even before their shops are reassigned.
update public.profiles set roles = '{}' where id = pg_temp.a('e6');
select pg_temp.sign_in(pg_temp.a('e6'));
select is((select count(*) from public.mentor_notes), 0::bigint, 'a demoted mentor reads no notes');
select is((select count(*) from public.seller_profiles), 0::bigint, 'nor their mentees'' profiles');
select is(
  array(select id from public.listings where id like 'st-%' order by id),
  array['st-live'],
  'nor their drafts or hidden listings'
);
select pg_temp.sign_out();
update public.profiles set roles = '{mentor}' where id = pg_temp.a('e6');

-- --- The mentor dashboard's numbers (recentCounts, shop-stats.ts:61; MENTOR_WINDOW_DAYS) ------------------------------

-- At 2026-10-20 12:00 UTC, the last 14 days start at 2026-10-06 12:00. Sipho's shop:
--   c1 an enquiry 3 days ago answered in an hour: an enquiry, due, in time
--   c2 an enquiry a day ago, not answered yet: an enquiry, not due
--   c3 an enquiry 5 days ago answered after 3 days: an enquiry, due, late
--   c4 an enquiry 20 days ago: outside the window
--   c5 a question about the shop 2 days ago: not an enquiry
--   c6 a sale the buyer confirmed 2 days ago: a sale
--   c7 marked done 7 days ago to the second: confirms itself now, a sale
--   c8 marked done 2 days ago: not yet a sale
--   c9 an enquiry with a seller who has gone: nobody's
--   c10 a sale confirmed 20 days ago: outside the window
insert into public.conversations (id, listing_id, listing_title, shop_id, buyer_id, seller_gone, status, created_at, first_reply_at, completed_at, confirmed_at, confirmed_by) values
  ('40000000-0000-4000-8000-0000000000c1', null, 'Lamp', pg_temp.s('e1'), pg_temp.a('e4'), false, 'replied', '2026-10-17T12:00:00Z', '2026-10-17T13:00:00Z', null, null, null),
  ('40000000-0000-4000-8000-0000000000c2', null, 'Lamp', pg_temp.s('e1'), pg_temp.a('e4'), false, 'asked', '2026-10-19T12:00:00Z', null, null, null, null),
  ('40000000-0000-4000-8000-0000000000c3', null, 'Lamp', pg_temp.s('e1'), pg_temp.a('e4'), false, 'replied', '2026-10-15T12:00:00Z', '2026-10-18T12:00:00Z', null, null, null),
  ('40000000-0000-4000-8000-0000000000c4', null, 'Lamp', pg_temp.s('e1'), pg_temp.a('e4'), false, 'replied', '2026-09-30T12:00:00Z', '2026-09-30T13:00:00Z', null, null, null),
  ('40000000-0000-4000-8000-0000000000c5', null, null, pg_temp.s('e1'), pg_temp.a('e4'), false, 'replied', '2026-10-18T12:00:00Z', '2026-10-18T13:00:00Z', null, null, null),
  ('40000000-0000-4000-8000-0000000000c6', null, 'Lamp', pg_temp.s('e1'), pg_temp.a('e4'), false, 'confirmed', '2026-09-20T12:00:00Z', '2026-09-20T13:00:00Z', '2026-10-17T12:00:00Z', '2026-10-18T12:00:00Z', 'buyer'),
  ('40000000-0000-4000-8000-0000000000c7', null, 'Lamp', pg_temp.s('e1'), pg_temp.a('e4'), false, 'done', '2026-09-20T12:00:00Z', '2026-09-20T13:00:00Z', '2026-10-13T12:00:00Z', null, null),
  ('40000000-0000-4000-8000-0000000000c8', null, 'Lamp', pg_temp.s('e1'), pg_temp.a('e4'), false, 'done', '2026-09-20T12:00:00Z', '2026-09-20T13:00:00Z', '2026-10-18T12:00:00Z', null, null),
  ('40000000-0000-4000-8000-0000000000c9', null, 'Lamp', pg_temp.s('e1'), pg_temp.a('e4'), true, 'replied', '2026-10-19T12:00:00Z', '2026-10-19T13:00:00Z', null, null, null),
  ('40000000-0000-4000-8000-0000000000ca', null, 'Lamp', pg_temp.s('e1'), pg_temp.a('e4'), false, 'confirmed', '2026-09-01T12:00:00Z', '2026-09-01T13:00:00Z', '2026-09-28T12:00:00Z', '2026-09-30T12:00:00Z', 'buyer');
select pg_temp.sign_in(pg_temp.a('e6'));
select is(
  (select row(enquiries, due, replied_in_time, sales_confirmed)::text
   from public.mentor_shop_numbers(pg_temp.s('e1'), '2026-10-20T12:00:00Z')),
  row(3, 2, 1, 2)::text,
  'enquiries, due, answered in time and sales over the last 14 days, as recentCounts works them out'
);
select is(
  (select row(enquiries, due, replied_in_time, sales_confirmed)::text
   from public.mentor_shop_numbers(pg_temp.s('e1'), '2026-10-20T11:59:59Z')),
  row(3, 2, 1, 1)::text,
  'a sale done 7 days (168 hours) before counts only from then'
);
select pg_temp.sign_out();

-- --- Deleting accounts and shops -----------------------------------------------------------------------------------------

delete from public.profiles where id = pg_temp.a('e5');
select is(
  (select count(*) from public.audit_log where staff_id is null and staff_name = 'User e5'),
  8::bigint,
  'a deleted staff member''s entries stay (forget_account renames them)'
);
select is(
  (select answered_by from public.hub_bookings where id = '90000000-0000-4000-8000-0000000000e2'),
  null::uuid,
  'and their answers stay, unsigned'
);
select is(
  (select count(*) from public.featured_pins where pinned_by is null and shop_id = pg_temp.s('e1')),
  3::bigint,
  'as do their pins'
);
delete from public.profiles where id = pg_temp.a('e1');
select is((select count(*) from public.mentor_notes where owner_id = pg_temp.a('e1')), 0::bigint, 'notes about a deleted owner go');
select is((select count(*) from public.hub_rsvps where account_id = pg_temp.a('e1')), 0::bigint, 'and their RSVPs');
select is((select count(*) from public.hub_bookings where account_id = pg_temp.a('e1')), 0::bigint, 'and slot requests');
select is((select count(*) from public.featured_pins where shop_id = pg_temp.s('e1')), 0::bigint, 'and their shop''s pins');
select is(
  (select count(*) from public.audit_log where subject_id is null and target_id = 'staff-shop-e1'),
  27::bigint,
  'entries about them stay (forget_account renames them)'
);
delete from public.profiles where id = pg_temp.a('e6');
select is(
  (select row(author_id, author_name)::text from public.mentor_notes where owner_id = pg_temp.a('e7')),
  row(null::uuid, 'User e6')::text,
  'a deleted mentor''s notes stay'
);
select is(
  (select author_id from public.hub_posts where id = 'st-event'),
  null::uuid,
  'and their posts, for the Hub'
);
delete from public.hub_posts where id = 'st-event';
select is((select count(*) from public.hub_rsvps where post_id = 'st-event'), 0::bigint, 'a deleted post takes its RSVPs');

-- --- Grants on the functions ----------------------------------------------------------------------------------------------

select ok(
  has_function_privilege('anon', 'public.hub_going(text)', 'execute')
  and has_function_privilege('authenticated', 'public.hub_going(text)', 'execute'),
  'anyone counts who''s going'
);
select ok(
  not has_function_privilege('anon', 'public.mentor_shop_numbers(uuid, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.mentor_shop_numbers(uuid, timestamptz)', 'execute'),
  'a shop''s numbers are for signed-in staff only'
);

select * from finish();
rollback;
