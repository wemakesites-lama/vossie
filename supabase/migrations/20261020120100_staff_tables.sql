-- The staff tools' tables (supabase schema catch-up plan, Task 2; backend spec 4.2 and 4.3; staff tools spec, stage G):
-- the audit log, Featured pins and draws, mentors' notes, Hub posts, RSVPs and slot requests, and what staff read of
-- phase A's tables.
--
-- - Writes are Task 5's functions (plan decision 1): no API role has insert, update or delete on any table here. The
--   service role keeps its usual grants, but the audit log has no update or delete for anyone through the API
--   (CLAUDE.md: "the audit log has no update or delete"); forget_account (Task 8) renames entries as the owner.
-- - "Every campus" is null (plan decision 2): campus_slug is a real foreign key to campuses on posts, pins and draws.
-- - Staff read through their own session, as `private.is_staff` read policies or views over `security definer`
--   helpers, so a role an admin removes stops working on the next query (decision 1 for writes, here for reads).
-- - Three columns are kept from the API roles by column grants, so staff read them through views: a post's author
--   (staff_hub_posts), a report's note and closer (staff_reports, Task 1's grant) and a shop's mentor
--   (staff_seller_profiles, Task 1's grant). Each view is `security_invoker`, so it is not a security definer view
--   (advisor 0010): it selects from a `private` set-returning helper that runs as the owner and returns rows only to the
--   staff the helper names, and nothing to anyone else. A query through the API names its columns rather than using *.
-- - Mentors see numbers, never messages (FUNCTION-MAP K1): the conversations policies are unchanged, and
--   public.mentor_shop_numbers gives the counts.

-- --- audit_log (AuditRow, lib/data/rows.ts:351; lib/data/audit.ts) ---------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  -- Who acted, or null once their account is deleted (forget_account then writes "Deleted account" in staff_name).
  staff_id uuid references public.profiles (id) on delete set null,
  -- Their first name when they acted (2 to 40 characters), or "Deleted account".
  staff_name text not null check (char_length(staff_name) between 1 and 40 and private.is_clean_line(staff_name)),
  -- AuditAction, lib/types.ts:479: the 27 things a staff action does.
  action text not null check (action in (
    'shop-approved', 'shop-declined', 'shop-verified', 'shop-unverified', 'shop-paused', 'shop-resumed',
    'mentor-assigned', 'mentor-removed', 'report-dismissed', 'listing-hidden', 'request-hidden', 'featured-pinned',
    'featured-unpinned', 'point-added', 'point-renamed', 'point-retired', 'point-restored', 'post-created',
    'post-updated', 'booking-accepted', 'booking-declined', 'note-added', 'check-in-added', 'role-given', 'role-removed',
    'listing-shown', 'request-shown'
  )),
  -- AuditTargetKind, lib/types.ts:520.
  target_kind text not null check (target_kind in (
    'shop', 'listing', 'report', 'pickup-point', 'post', 'booking', 'request', 'account'
  )),
  -- A shop's slug, or a listing's, report's, point's, post's, slot request's or account's id; '' once forgotten. No
  -- foreign key: the entry outlives its target (plan decision 6 of the staff tools).
  target_id text not null,
  -- The target's name then (a slot request's is "Student: office hours"), or "Deleted account". No length limit: the
  -- app writes names it has already checked.
  target_name text not null check (target_name <> '' and private.is_clean_line(target_name)),
  -- The reason or note, or ''. A removed mentor's entry lists the shops left without one, so no length limit either.
  detail text not null default '' check (private.is_clean_text(detail)),
  -- The student it was about (a shop's owner, a reporter, a slot request's student), so their deletion can forget them.
  subject_id uuid references public.profiles (id) on delete set null
);
-- Newest first (listAudit, audit.ts:55), by staff member (its filter), and the subject for forget_account. The last two
-- are also the indexes for the foreign keys.
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_staff_id_idx on public.audit_log (staff_id, at desc);
create index audit_log_subject_id_idx on public.audit_log (subject_id);

-- --- featured_pins and featured_draws (FeaturedPinRow, FeaturedDrawRow, rows.ts:367; lib/data/featured.ts) ------------

-- A shop pinned to one campus's Featured row (null: visitors who haven't chosen one) for one SAST day. At most
-- FEATURED_PLACES (4, featured.ts:19) a campus and day, and only an eligible shop, both checked by Task 5's pin_shop.
create table public.featured_pins (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  campus_slug text references public.campuses (slug),
  -- YYYY-MM-DD in South Africa.
  day date not null,
  -- The admin who pinned it, or null once their account is deleted.
  pinned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- A shop once a campus and day (addPin's "taken", featured.ts:93). Also the index for the campus foreign key and for
  -- a day's pins (pinsFor).
  constraint featured_pins_once_a_day unique nulls not distinct (campus_slug, day, shop_id)
);
create index featured_pins_shop_id_idx on public.featured_pins (shop_id);
create index featured_pins_pinned_by_idx on public.featured_pins (pinned_by);
-- listPins (featured.ts:121): from a day on.
create index featured_pins_day_idx on public.featured_pins (day);

-- A campus's Featured row as first drawn on a SAST day (featuredFor, featured.ts:56), kept so it stays the same all
-- day and its sellers sit out the next six. Kept by the server only (plan decision 5): the draw is made in TypeScript,
-- and phase C writes it with the admin client. A primary key can't hold "every campus" (null), hence the surrogate id
-- and the unique constraint with nulls not distinct.
create table public.featured_draws (
  id uuid primary key default gen_random_uuid(),
  campus_slug text references public.campuses (slug),
  day date not null,
  -- In the row's order, pins first; at most FEATURED_PLACES. No foreign key on an array: featuredFor drops a shop that
  -- has gone or stopped being eligible.
  shop_ids uuid[] not null check (cardinality(shop_ids) <= 4 and array_position(shop_ids, null) is null),
  -- Also the index for the campus foreign key.
  constraint featured_draws_once_a_day unique nulls not distinct (campus_slug, day)
);

-- --- mentor_notes (MentorNoteRow, rows.ts:400; lib/data/mentors.ts) ---------------------------------------------------

-- A note or check-in about a shop's owner (staff tools spec 2.6, plan decision 16): never shown to the seller, and not
-- in their data download. Deleting the owner deletes them; deleting the author keeps them, unsigned.
create table public.mentor_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('note', 'check-in')),
  -- A check-in's day, YYYY-MM-DD in South Africa (checkCheckInDay, lib/staff/rules.ts:93: not after today, Task 5).
  check_in_on date,
  -- 1 to MENTOR_NOTE_MAX (1,000, rules.ts:10) characters of clean text with its line breaks (checkMentorNote).
  text text not null check (char_length(text) between 1 and 1000 and private.is_clean_text(text)),
  author_id uuid references public.profiles (id) on delete set null,
  -- Their first name then, or "Deleted account".
  author_name text not null check (char_length(author_name) between 1 and 40 and private.is_clean_line(author_name)),
  created_at timestamptz not null default now(),
  -- addNote (mentors.ts:91) keeps a day only for a check-in.
  constraint mentor_notes_day_for_check_ins check ((kind = 'check-in') = (check_in_on is not null))
);
-- listNotes (mentors.ts:63): an owner's, newest first. Also the index for the owner foreign key.
create index mentor_notes_owner_id_idx on public.mentor_notes (owner_id, created_at desc);
create index mentor_notes_author_id_idx on public.mentor_notes (author_id);

-- --- hub_posts (HubPostRow, rows.ts:420; lib/staff/post-rules.ts; lib/data/hub-posts.ts) ------------------------------

create table public.hub_posts (
  -- "h-001" for the seed, a short id for new ones; it appears in links and in photos.use ('post:<id>').
  id text primary key default private.new_short_id()
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 40),
  -- HubPostKind, lib/types.ts:189.
  kind text not null check (kind in ('event', 'office-hours', 'tip')),
  -- One line each, at most POST_TITLE_MAX (70) and POST_SUMMARY_MAX (160) (post-rules.ts:12 and :13; checkPost uses
  -- cleanLine for both).
  title text not null check (char_length(title) between 1 and 70 and private.is_clean_line(title)),
  summary text not null check (char_length(summary) between 1 and 160 and private.is_clean_line(summary)),
  -- Where it happens, one line, at most POST_PLACE_MAX (80, :14); events and office hours only.
  place text check (char_length(place) between 1 and 80 and private.is_clean_line(place)),
  -- The markdown subset, at most POST_BODY_MAX (4,000, :15), clean text with its line breaks.
  body text not null check (char_length(body) between 1 and 4000 and private.is_clean_text(body)),
  -- A campus, or null for every campus (plan decision 2). A tip is always every campus's (checkPost).
  campus_slug text references public.campuses (slug),
  starts_at timestamptz,
  -- 1 to POST_CAPACITY_MAX (1,000, :16) places, events only.
  capacity int check (capacity between 1 and 1000),
  -- How many were going before Vossie's RSVPs (the seed's counts, 0 for a new event); events only. public.hub_going
  -- adds the RSVPs (hub-posts.ts:34).
  going int check (going >= 0),
  -- The cover: one of the Hub's stored photos (plan decision 6), or a placeholder's path (the seed's art and the Hub's
  -- banner, hub-posts.ts:17), or neither for the banner.
  image_src text check (image_src ~ '^/placeholders/[a-z0-9/-]+\.svg$'),
  image_alt text not null default '' check (char_length(image_alt) <= 125),
  cover_photo_id uuid references public.photos (id) on delete set null,
  -- False while it's a draft: only hub staff see it (staff tools spec 2.4).
  published boolean not null default false,
  -- When it was first published; set once and kept (saveHubPost, hub-posts.ts:154, and the trigger below).
  published_at timestamptz,
  -- Who wrote it: null for a sample post or once their account is deleted. Hub staff only (staff_hub_posts).
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hub_posts_tips_for_every_campus check (kind <> 'tip' or campus_slug is null),
  -- checkPost (post-rules.ts:104 to 121): events and office hours have a start and a place; only events have places
  -- and a count.
  constraint hub_posts_start_when_dated check ((kind in ('event', 'office-hours')) = (starts_at is not null)),
  constraint hub_posts_place_when_dated check ((kind in ('event', 'office-hours')) = (place is not null)),
  constraint hub_posts_capacity_for_events check ((kind = 'event') = (capacity is not null)),
  constraint hub_posts_going_for_events check ((kind = 'event') = (going is not null)),
  constraint hub_posts_published_since check (not published or published_at is not null),
  constraint hub_posts_one_cover check (cover_photo_id is null or image_src is null)
);
-- A photo is one post's cover. Also the index for the photo foreign key.
create unique index hub_posts_cover_photo_id_key on public.hub_posts (cover_photo_id);
create index hub_posts_campus_slug_idx on public.hub_posts (campus_slug);
create index hub_posts_author_id_idx on public.hub_posts (author_id);
-- The feed and the homepage's What's on: published posts, newest first.
create index hub_posts_published_idx on public.hub_posts (published_at desc) where published;

-- published_at is set by the first publish and kept through drafts and edits (saveHubPost keeps
-- `existing.publishedAt`), as keep_first_published_at keeps a listing's.
create function private.keep_hub_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is not null and new.published_at is distinct from old.published_at then
    raise exception 'hub post %: published_at is set once and never changed', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.keep_hub_published_at() from public, anon, authenticated;

create trigger hub_posts_keep_published_at
before update of published_at on public.hub_posts
for each row execute function private.keep_hub_published_at();

-- --- hub_rsvps and hub_bookings (HubRsvpRow, HubBookingRow, rows.ts:432; lib/data/hub-posts.ts) ------------------------

-- A student going to an event (staff tools spec 2.5). Its post and its account cascade.
create table public.hub_rsvps (
  post_id text not null references public.hub_posts (id) on delete cascade,
  account_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Once a student (addRsvp's "already", hub-posts.ts:189). Also the index for the post foreign key and the count.
  primary key (post_id, account_id)
);
create index hub_rsvps_account_id_idx on public.hub_rsvps (account_id);

-- A request for an office-hours slot (staff tools spec 2.5). Its post and its student cascade; whoever answered it
-- stays only while their account does.
create table public.hub_bookings (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.hub_posts (id) on delete cascade,
  account_id uuid not null references public.profiles (id) on delete cascade,
  -- What they'd like help with: 1 to HELP_MAX (300, rules.ts:15), clean text with its line breaks (checkHelp).
  help text not null check (char_length(help) between 1 and 300 and private.is_clean_text(help)),
  -- A time that suits: 0 to TIME_MAX (100, :16), one line (checkTime); '' means any time.
  time text not null default '' check (char_length(time) <= 100 and private.is_clean_line(time)),
  -- BookingStatus, lib/types.ts:543.
  status text not null default 'open' check (status in ('open', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  answered_by uuid references public.profiles (id) on delete set null,
  -- answerBooking (hub-posts.ts:282) sets the status, the time and who answered together, once.
  constraint hub_bookings_answered_when_answered check ((status = 'open') = (answered_at is null)),
  constraint hub_bookings_answered_by_when_answered check (answered_by is null or status <> 'open')
);
-- One open request a student for each office hours (requestSlot's "open-already", hub-posts.ts:226). Also the index for
-- the post foreign key's lookups by post and student.
create unique index hub_bookings_one_open on public.hub_bookings (post_id, account_id) where status = 'open';
create index hub_bookings_post_id_idx on public.hub_bookings (post_id);
create index hub_bookings_account_id_idx on public.hub_bookings (account_id, created_at desc);
create index hub_bookings_answered_by_idx on public.hub_bookings (answered_by);
-- The office-hours queue (listBookings, hub-posts.ts:262): open ones newest first, then the latest answered.
create index hub_bookings_status_idx on public.hub_bookings (status, created_at desc);

alter table public.audit_log enable row level security;
alter table public.featured_pins enable row level security;
alter table public.featured_draws enable row level security;
alter table public.mentor_notes enable row level security;
alter table public.hub_posts enable row level security;
alter table public.hub_rsvps enable row level security;
alter table public.hub_bookings enable row level security;

-- --- Helpers --------------------------------------------------------------------------------------------------------

-- Whether the signed-in staff member may open the mentor page of the shop `owner` owns (mentoredShops,
-- lib/data/mentors.ts:17 to 24): the shop has a mentor, isn't pending and has a shop (:20); the reader isn't its owner,
-- even when the owner is staff (:23, amendment 15.3); and the reader is its mentor, still holding the role, or an admin
-- (:24). Notes, check-ins and the 14-day numbers all follow this.
create function private.can_mentor(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(owner <> (select auth.uid()), false) and exists (
    select 1 from public.seller_profiles sp
    where sp.account_id = owner
      and sp.mentor_id is not null
      and sp.status <> 'pending'
      and sp.shop_id is not null
      and (
        (sp.mentor_id = (select auth.uid()) and private.is_staff('mentor'))
        or private.is_staff('admin')
      )
  );
$$;

-- Whether the signed-in account is the shop's mentor, still holding the role, and the shop isn't pending
-- (mentors.ts:20 and :24): a mentor then reads the shop and its listings in every state. Admins read every shop through
-- their own clause in each policy.
create function private.mentors_shop(shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.seller_profiles sp
    where sp.shop_id = shop and sp.mentor_id = (select auth.uid()) and sp.status <> 'pending'
  ) and private.is_staff('mentor');
$$;

-- The rows behind the three staff views. Each runs as the owner, so it reads past RLS and the column grants, and
-- returns rows only to the staff it names: nothing to anyone else, or to no one signed in.

-- Every post, drafts and authors included, for hub staff (listPostsForStaff and getPostRow, hub-posts.ts:69 and :91).
create function private.staff_hub_posts()
returns setof public.hub_posts
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.hub_posts p where (select private.is_staff('hub'));
$$;

-- Every report, its note and who closed it included, for admins (listReports, lib/data/staff-reports.ts:111).
create function private.staff_reports()
returns setof public.reports
language sql
stable
security definer
set search_path = ''
as $$
  select r.* from public.reports r where (select private.is_staff('admin'));
$$;

-- Seller profiles with their mentor: every one for admins (listShopsForReview, staff-shops.ts:84); for a mentor, the
-- open shops assigned to them (mentoredShops). The seller themselves never reads who mentors them (Task 1's grant).
create function private.staff_seller_profiles()
returns setof public.seller_profiles
language sql
stable
security definer
set search_path = ''
as $$
  select sp.* from public.seller_profiles sp
  where (select private.is_staff('admin'))
    or (sp.mentor_id = (select auth.uid()) and sp.status <> 'pending' and (select private.is_staff('mentor')));
$$;

-- Policies and the views call these as the signed-in role, which needs EXECUTE (the foundation migration).
revoke all on function private.can_mentor(uuid), private.mentors_shop(uuid), private.staff_hub_posts(),
  private.staff_reports(), private.staff_seller_profiles() from public, anon;
grant execute on function private.can_mentor(uuid), private.mentors_shop(uuid), private.staff_hub_posts(),
  private.staff_reports(), private.staff_seller_profiles() to authenticated, service_role;

-- --- Grants and policies on the new tables -----------------------------------------------------------------------------

-- Supabase's default privileges give every API role everything on a new table; truncate ignores RLS. So all of it is
-- revoked first, the service role's too, and each role gets only what it reads.
revoke all on table public.audit_log, public.featured_pins, public.featured_draws, public.mentor_notes,
  public.hub_posts, public.hub_rsvps, public.hub_bookings from anon, authenticated, service_role;
grant select on table public.audit_log, public.featured_pins, public.mentor_notes, public.hub_rsvps,
  public.hub_bookings to authenticated;
-- Every column but author_id: who wrote a post is for hub staff (staff_hub_posts).
grant select (
  id, kind, title, summary, place, body, campus_slug, starts_at, capacity, going, image_src, image_alt, cover_photo_id,
  published, published_at, created_at, updated_at
) on table public.hub_posts to anon, authenticated;
grant all on table public.featured_pins, public.featured_draws, public.mentor_notes, public.hub_posts,
  public.hub_rsvps, public.hub_bookings to service_role;
-- The audit log is added to and read, never changed or removed through the API.
grant select, insert on table public.audit_log to service_role;

create policy "Admins read the audit log"
on public.audit_log for select
to authenticated
using ((select private.is_staff('admin')));

create policy "Admins read Featured pins"
on public.featured_pins for select
to authenticated
using ((select private.is_staff('admin')));

-- featured_draws: no grant to anon or authenticated, so no policy (the advisor's INFO finding 0008,
-- rls_enabled_no_policy, lists it on purpose).

create policy "The shop's mentor and admins read notes about its owner, never the owner"
on public.mentor_notes for select
to authenticated
using (private.can_mentor(owner_id));

create policy "Anyone reads published Hub posts"
on public.hub_posts for select
to anon, authenticated
using (published);

create policy "Students read their RSVPs"
on public.hub_rsvps for select
to authenticated
using (account_id = (select auth.uid()));

create policy "Students read their slot requests, and hub staff every one"
on public.hub_bookings for select
to authenticated
using (account_id = (select auth.uid()) or (select private.is_staff('hub')));

-- --- The staff views ---------------------------------------------------------------------------------------------------

create view public.staff_hub_posts
with (security_invoker = true)
as
select
  p.id, p.kind, p.title, p.summary, p.place, p.body, p.campus_slug, p.starts_at, p.capacity, p.going, p.image_src,
  p.image_alt, p.cover_photo_id, p.published, p.published_at, p.author_id, p.created_at, p.updated_at
from private.staff_hub_posts() p;

create view public.staff_reports
with (security_invoker = true)
as
select
  r.id, r.reporter_id, r.target_kind, r.target_id, r.target_title, r.reason, r.detail, r.status, r.created_at,
  r.outcome, r.note, r.closed_at, r.closed_by, r.target_gone
from private.staff_reports() r;

create view public.staff_seller_profiles
with (security_invoker = true)
as
select
  sp.account_id, sp.status, sp.shop_id, sp.applied_at, sp.declined_at, sp.paused_by, sp.seller_paused_too,
  sp.staff_reason, sp.mentor_id, sp.approved_at
from private.staff_seller_profiles() sp;

revoke all on table public.staff_hub_posts, public.staff_reports, public.staff_seller_profiles
from public, anon, authenticated, service_role;
grant select on table public.staff_hub_posts, public.staff_reports, public.staff_seller_profiles
to authenticated, service_role;

-- --- Staff reads of phase A's tables (plan Task 2; spec 4.3, "Staff: all (G)") -----------------------------------------

-- One policy per role and table, as phase A's, so Postgres runs one check per row: each signed-in policy gains the
-- admin's clause and the assigned mentor's.

-- Admins read every shop in any status (staff-shops.ts:84); a mentor the open shops assigned to them.
drop policy "Signed-in people read open shops, and owners their own" on public.shops;
create policy "Signed-in people read open shops, owners their own, and staff the ones they look after"
on public.shops for select
to authenticated
using (
  private.shop_is_public(id) or private.owns_shop(id) or (select private.is_staff('admin')) or private.mentors_shop(id)
);

-- Admins read every listing, drafts and hidden ones (with the reason) included (staff-reports.ts:264); a mentor their
-- mentees'. Their photos follow, through the listing-photo policy.
drop policy "Signed-in people read published listings of open shops, and owners all of theirs" on public.listings;
create policy "Signed-in people read published listings of open shops, owners all of theirs, and staff more"
on public.listings for select
to authenticated
using (
  (state <> 'draft' and hidden_at is null and private.shop_is_public(shop_id))
  or private.owns_shop(shop_id)
  or (select private.is_staff('admin'))
  or private.mentors_shop(shop_id)
);

-- Admins read every seller profile; a mentor those of the open shops assigned to them. mentor_id stays out of the
-- column grant (Task 1), so staff read it through staff_seller_profiles.
drop policy "Owners read their seller profile" on public.seller_profiles;
create policy "Owners read their seller profile, admins every one, and mentors their mentees'"
on public.seller_profiles for select
to authenticated
using (
  account_id = (select auth.uid())
  or (select private.is_staff('admin'))
  or (mentor_id = (select auth.uid()) and status <> 'pending' and (select private.is_staff('mentor')))
);

-- Reports: admins read every one through staff_reports (the reporters' grant leaves the note and closer out). Pickup
-- points: everyone already reads every one, retired ones too (Task 1). Profiles: staff already read every one (the
-- accounts migration).

-- --- Functions ----------------------------------------------------------------------------------------------------------

-- How many are going to a published event (hub-posts.ts:34): its count before Vossie, plus the RSVPs. Null for office
-- hours, a tip, a draft or an unknown post. Anyone may ask; nobody learns who.
-- Callable by anon on purpose (advisor 0028 lists it): a count, the same one the post page shows.
create function public.hub_going(p_post text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select p.going + (select count(*)::int from public.hub_rsvps r where r.post_id = p.id)
  from public.hub_posts p
  where p.id = p_post and p.published;
$$;

-- A shop's last 14 days for the mentor dashboard (recentCounts, lib/data/shop-stats.ts:61; MENTOR_WINDOW_DAYS,
-- lib/staff/mentor.ts:9), as the trust page counts them (counts, shop-stats.ts:24):
-- - an enquiry is a conversation about a listing (a listing title: listing_id is null once the listing is deleted, and
--   the sample store keeps its id) started in the window, by a buyer of a shop whose seller hasn't gone;
-- - one is due once answered within 48 hours or 48 hours old; in time when its first reply came within 48 hours;
-- - a sale counts from when the buyer confirmed it, or 7 days (168 hours) after it was marked done, in the window.
-- Returns one row for the shop's mentor or an admin (private.can_mentor), and no row for anyone else, the shop's owner
-- included. p_now is the caller's time, as the app's `now`.
-- Task 3: an offer thread isn't an enquiry (shop-stats.ts:26, "!row.requestId"); add `and not c.is_offer` to the
-- enquiry test once Task 3 adds the column. Its sale still counts.
-- A user action for staff (advisor 0029 lists it on purpose).
create function public.mentor_shop_numbers(p_shop uuid, p_now timestamptz default now())
returns table (enquiries int, due int, replied_in_time int, sales_confirmed int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz := p_now - interval '336 hours';
begin
  if not private.can_mentor((select sp.account_id from public.seller_profiles sp where sp.shop_id = p_shop)) then
    return;
  end if;
  return query
  select
    (count(*) filter (where e.enquiry))::int,
    (count(*) filter (where e.enquiry and (e.in_time or e.created_at <= p_now - interval '48 hours')))::int,
    (count(*) filter (where e.enquiry and e.in_time))::int,
    (count(*) filter (where e.sold_at >= since))::int
  from (
    select
      c.listing_title is not null and c.created_at >= since as enquiry,
      coalesce(c.first_reply_at - c.created_at <= interval '48 hours', false) as in_time,
      c.created_at,
      case
        when c.status = 'confirmed' then c.confirmed_at
        when c.status = 'done' and c.completed_at + interval '168 hours' <= p_now
          then c.completed_at + interval '168 hours'
      end as sold_at
    from public.conversations c
    where c.shop_id = p_shop and not c.seller_gone
  ) e;
end;
$$;

revoke all on function public.hub_going(text), public.mentor_shop_numbers(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.hub_going(text) to anon, authenticated, service_role;
grant execute on function public.mentor_shop_numbers(uuid, timestamptz) to authenticated, service_role;
