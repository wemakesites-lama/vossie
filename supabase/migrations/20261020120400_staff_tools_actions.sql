-- The staff tools' actions (supabase schema catch-up plan, Task 5; staff tools spec 2.3 to 2.8, stage G; stage J spec
-- decisions 3 to 7): pickup points, Featured pins, the Hub's covers and posts, RSVPs and slot requests, mentors' notes and
-- check-ins, and staff roles; with the one-time tokens they share, and hiding only from an open report.
--
-- - Plan decision 1, as Task 4's actions: each staff action is a `public` function called with the staff member's own
--   session. It checks private.is_staff(area) first, in the same transaction as the write, and returns 'forbidden'
--   otherwise; then the write; then one audit_log row only when something changed (private.record_audit), then the
--   notifications the action sends (private.notify). Nothing changed: 'nothing', no audit row, nobody told. A value the
--   app checks first (a name, a note, a help text) raises check_violation when it is out of bounds, as phase A's do; a
--   value that isn't one of a fixed list (a role, a photo type, a campus) raises invalid_parameter_value.
-- - RSVPs and slot requests are students' actions (lib/hub-actions.ts): any account that has finished signing in, no
--   audit row.
-- - Notification wording is built here, never passed in (the plan's note on Tasks 4 to 6): slotAnswerText,
--   slotRequestedText and staffRoleText (lib/staff/notification-text.ts) as private.*_note_text, compared in
--   17_staff_tools_actions.test.sql with strings printed from the TypeScript. Their links are the app's: bookSlotPath
--   ('/hub/<id>/book') and HUB_MANAGE_PATH + '#hub-queue' (lib/staff/paths.ts), and ACCOUNT_PAGE '/account'
--   (lib/staff/account-actions.ts).
-- - A new Hub post, a note, a check-in and a role given take a one-time token (lib/staff/once.ts), through
--   private.take_once_token. The token is taken only once every other check has passed, so a refused send leaves it
--   for the next try, as the app's actions do. Results: 'once-expired' (none like it in this session: left out, made
--   up, run out or another session's; the app's "none") and 'once-taken' (sent already; the app's "again").
-- - Review fix I1 (Tasks 1 to 3 review): Task 1's column grant on form_states is undone, and two triggers keep a taken
--   token taken instead (see "One-time tokens" below).
-- - hide_listing and hide_request (Task 4) are replaced so they need an open report on their target (Task 4's open
--   question 2, recommended answer).

-- --- One-time tokens (lib/staff/once.ts; review fix I1) ---------------------------------------------------------------

-- Task 1 took `taken` out of authenticated's update grant. That broke the app's own save of a row with taken: true
-- (leaveOnceToken, once.ts:76, and leaveListingToken, lib/selling/form-state.ts:115), and still let a person delete
-- their taken row and insert it again, free. Phase A's plain grant comes back, and triggers keep the rule instead.
revoke update (session_id, form, account_id, errors, values, notice, expires_at) on table public.form_states from authenticated;
grant update on table public.form_states to authenticated;

-- A token is set taken, never cleared: an update keeps `old.taken or new.taken`, whoever makes it. Through the API (the
-- authenticated role), a taken token also keeps its session, form and account, and its expiry can only move later, so
-- it can't be moved out of the way or run out early to be deleted and made again free.
create function private.form_states_keep_taken()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.taken and current_user = 'authenticated' then
    if new.session_id is distinct from old.session_id or new.form is distinct from old.form
      or new.account_id is distinct from old.account_id
    then
      raise exception 'a taken one-time token keeps its session and form' using errcode = 'insufficient_privilege';
    end if;
    new.expires_at := greatest(old.expires_at, new.expires_at);
  end if;
  new.taken := old.taken or new.taken;
  return new;
end;
$$;

-- Its owner can't delete a taken token while it lasts (it would be free to make again). Once it has run out it can go,
-- and the hourly sweep (private.sweep_sign_in, as the database's owner) and the service role delete any.
create function private.form_states_keep_taken_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.taken and old.expires_at > now() and current_user = 'authenticated' then
    raise exception 'a taken one-time token stays until it runs out' using errcode = 'insufficient_privilege';
  end if;
  return old;
end;
$$;

create trigger form_states_keep_taken
before update on public.form_states
for each row execute function private.form_states_keep_taken();

create trigger form_states_keep_taken_rows
before delete on public.form_states
for each row execute function private.form_states_keep_taken_rows();

-- Takes the staff form's one-time token for this post (takeOnceToken, once.ts:65; takeFormState,
-- lib/data/form-states.ts:35): the row 'staff-once:<token>' of the signed-in account's own session (the JWT's
-- session_id), while it lasts. The check and the mark are one step under the row's lock, so of two posts sent together
-- only one is first.
-- Returns 'first' (it was free, and is taken now), 'again' (taken already) or 'none' (no such token in this session).
create function private.take_once_token(p_token text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  sid text := (select auth.jwt()) ->> 'session_id';
  was boolean;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or sid is null or sid !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then
    return 'none';
  end if;
  select f.taken into was
  from public.form_states f
  where f.session_id = sid::uuid and f.form = 'staff-once:' || p_token and f.account_id = (select auth.uid())
    and f.expires_at > now()
  for update;
  if not found then
    return 'none';
  end if;
  if was then
    return 'again';
  end if;
  update public.form_states f
  set taken = true
  where f.session_id = sid::uuid and f.form = 'staff-once:' || p_token;
  return 'first';
end;
$$;

-- --- The sentences (lib/staff/notification-text.ts) ---------------------------------------------------------------
-- The words are samples for Lama to change: change them in the TypeScript and here together (the test compares them).

-- A slot request's answer for the student, with the "booking" kind (slotAnswerText).
create function private.slot_answer_note_text(accepted boolean, post_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when accepted then 'A mentor accepted your slot request for ' || post_title || '.'
    else 'A mentor couldn''t fit in your slot request for ' || post_title || '. You can ask again.'
  end;
$$;

-- A new slot request, for the office hours' author, with the "booking" kind (slotRequestedText).
create function private.slot_requested_note_text(student text, post_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select student || ' asked for a slot at ' || post_title || '.';
$$;

-- A staff role given or taken away, with the "staff-role" kind (staffRoleText).
create function private.staff_role_note_text(change text, role text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  case
    when change = 'given' and role = 'mentor' then
      return 'You''re a Vossie mentor now. The Hub''s tools and the mentor dashboard are on your account page.';
    when change = 'given' and role = 'admin' then
      return 'You''re a Vossie admin now. The admin console is on your account page.';
    when change = 'removed' and role = 'mentor' then
      return 'Your mentor role on Vossie has ended. Thank you for helping student sellers.';
    when change = 'removed' and role = 'admin' then
      return 'Your admin role on Vossie has ended.';
    else raise exception 'no sentence for % %', change, role using errcode = 'invalid_parameter_value';
  end case;
end;
$$;

-- --- Pickup points (pickup-points.ts:52 to 90; addPoint to restorePoint, admin-actions.ts:522 to 605) ---------------

-- A point's name as checkPointName leaves it (lib/staff/rules.ts:44): one clean line of POINT_NAME_MIN to
-- POINT_NAME_MAX (2 to 60) characters, trimmed. The app checks first, so this refuses only what it would never send.
create function private.check_point_name(name text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if name is null or char_length(name) not between 2 and 60 or not private.is_clean_line(name)
    or name <> btrim(name) or name ~ '\s\s'
  then
    raise exception 'a pickup point''s name is one clean line of 2 to 60 characters' using errcode = 'check_violation';
  end if;
end;
$$;

-- Add a point (addPickupPoint, pickup-points.ts:52): to a campus with points, never an online one. Names are unique on
-- their campus, retired points' included, compared as shop names are (name_key; isPointNameTaken).
-- Returns 'changed' | 'nothing' (no such campus, or an online one) | 'name-taken' | 'forbidden' (admin).
-- The audit entry names the campus (addPoint's detail).
-- A staff action (advisor 0029 lists it on purpose).
create function public.add_pickup_point(p_campus text, p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  campus public.campuses;
  made public.pickup_points;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  perform private.check_point_name(p_name);
  select * into campus from public.campuses c where c.slug = p_campus;
  if campus.slug is null or campus.is_online then
    return 'nothing';
  end if;
  insert into public.pickup_points (campus_slug, name)
  values (campus.slug, p_name)
  on conflict (campus_slug, name_key) do nothing
  returning * into made;
  if made.id is null then
    return 'name-taken';
  end if;
  perform private.record_audit('point-added', 'pickup-point', made.id::text, made.name, campus.name, null);
  return 'changed';
end;
$$;

-- Rename a point (renamePickupPoint, pickup-points.ts:68), keeping its id so listings that use it follow. The same name
-- is nothing; another point's on the campus is taken. The audit entry has the new name and says what it was.
-- Returns 'changed' | 'nothing' | 'name-taken' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create function public.rename_pickup_point(p_point uuid, p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  point public.pickup_points;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  perform private.check_point_name(p_name);
  select * into point from public.pickup_points p where p.id = p_point for update;
  if point.id is null or point.name = p_name then
    return 'nothing';
  end if;
  if exists (
    select 1 from public.pickup_points p
    where p.campus_slug = point.campus_slug and p.id <> point.id and p.name_key = private.name_key(p_name)
  ) then
    return 'name-taken';
  end if;
  update public.pickup_points p set name = p_name where p.id = point.id;
  perform private.record_audit('point-renamed', 'pickup-point', point.id::text, p_name, 'Was ' || point.name, null);
  return 'changed';
end;
$$;

-- Retire (retirePickupPoint, pickup-points.ts:77): forms stop offering it; listings keep it, "no longer used".
-- Returns 'changed' | 'nothing' (already retired, or none) | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create function public.retire_pickup_point(p_point uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  point public.pickup_points;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  update public.pickup_points p set retired_at = now()
  where p.id = p_point and p.retired_at is null
  returning p.* into point;
  if point.id is null then
    return 'nothing';
  end if;
  perform private.record_audit('point-retired', 'pickup-point', point.id::text, point.name, '', null);
  return 'changed';
end;
$$;

-- Use it again (restorePickupPoint, pickup-points.ts:85): undoes Retire.
-- Returns 'changed' | 'nothing' (in use already, or none) | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create function public.restore_pickup_point(p_point uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  point public.pickup_points;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  update public.pickup_points p set retired_at = null
  where p.id = p_point and p.retired_at is not null
  returning p.* into point;
  if point.id is null then
    return 'nothing';
  end if;
  perform private.record_audit('point-restored', 'pickup-point', point.id::text, point.name, '', null);
  return 'changed';
end;
$$;

-- --- Featured (addPin and removePin, lib/data/featured.ts:76 and :106; pinSeller and unpinSeller) -------------------

-- "Campus · day" as the Featured page and the log write a pin (pinSeller's detail): "No campus chosen" for visitors
-- who haven't chosen one (null, plan decision 2).
create function private.pin_detail(campus text, day date)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select c.name from public.campuses c where c.slug = campus), 'No campus chosen')
    || ' · ' || to_char(day, 'YYYY-MM-DD');
$$;

-- Pin a shop to a campus's Featured row (null: visitors with no campus) for a SAST day, before that day's draw (spec
-- 2.8, plan decision 9). The day is today to PIN_DAYS_AHEAD (60) days ahead in South Africa (checkPinDay,
-- lib/staff/rules.ts:85). Only an eligible shop (eligibleSellers, featured.ts:27): Verified, open (approved, not paused;
-- a sample shop counts as open) and with at least one listing on sale that isn't hidden (listedListings). At most
-- FEATURED_PLACES (4) a campus and day, counted under an advisory lock on (campus, day), so two pins made at the same
-- moment can't both take the fourth place. That campus's row for the day is forgotten, so the next view draws it
-- again. The audit entry names the shop by its link, with "campus · day".
-- Returns 'changed' | 'not-eligible' | 'taken' (already pinned there that day) | 'full' | 'day-past' | 'day-far' |
-- 'forbidden' (admin). A campus that isn't one raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create function public.pin_shop(p_shop uuid, p_campus text, p_day date)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := private.sast_day(now());
  shop public.shops;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  if p_campus is not null and not exists (select 1 from public.campuses c where c.slug = p_campus) then
    raise exception 'no such campus' using errcode = 'invalid_parameter_value';
  end if;
  if p_day is null then
    raise exception 'a pin has a day' using errcode = 'invalid_parameter_value';
  end if;
  if p_day < today then
    return 'day-past';
  end if;
  if p_day > today + 60 then
    return 'day-far';
  end if;
  select * into shop from public.shops s
  where s.id = p_shop and s.verified and private.shop_status(s.id) = 'approved'
    and exists (select 1 from public.listings l where l.shop_id = s.id and l.state = 'available' and l.hidden_at is null);
  if shop.id is null then
    return 'not-eligible';
  end if;
  perform pg_advisory_xact_lock(hashtext('vossie:featured:' || coalesce(p_campus, '') || ':' || p_day::text), 0);
  if exists (
    select 1 from public.featured_pins f
    where f.campus_slug is not distinct from p_campus and f.day = p_day and f.shop_id = shop.id
  ) then
    return 'taken';
  end if;
  if (
    select count(*) from public.featured_pins f where f.campus_slug is not distinct from p_campus and f.day = p_day
  ) >= 4 then
    return 'full';
  end if;
  insert into public.featured_pins (shop_id, campus_slug, day, pinned_by)
  values (shop.id, p_campus, p_day, (select auth.uid()));
  delete from public.featured_draws d where d.campus_slug is not distinct from p_campus and d.day = p_day;
  perform private.record_audit('featured-pinned', 'shop', shop.slug, shop.name, private.pin_detail(p_campus, p_day), null);
  return 'changed';
end;
$$;

-- Take a pin away (removePin, featured.ts:106): that campus's row for its day is drawn again.
-- Returns 'changed' | 'nothing' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create function public.unpin_shop(p_pin uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  pin public.featured_pins;
  shop public.shops;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  delete from public.featured_pins f where f.id = p_pin returning f.* into pin;
  if pin.id is null then
    return 'nothing';
  end if;
  delete from public.featured_draws d where d.campus_slug is not distinct from pin.campus_slug and d.day = pin.day;
  select * into shop from public.shops s where s.id = pin.shop_id;
  perform private.record_audit(
    'featured-unpinned', 'shop', shop.slug, shop.name, private.pin_detail(pin.campus_slug, pin.day), null
  );
  return 'changed';
end;
$$;

-- --- The Hub's covers (plan decision 6) -------------------------------------------------------------------------------

-- A cover for a Hub post (savePost's storePhotos(HUB_PHOTOS, …), lib/staff/hub-actions.ts:131): a photo row with no
-- owner, waiting for its form ('hub-draft'), at hub/<id>. The app uploads the file there with the admin client, as
-- phase A's add_photos flow does. As storePhotos keeps the Hub's waiting photos (lib/data/photos.ts:48), waiting ones a
-- day old or more go, and the Hub keeps its newest 12 (LOOSE_PHOTO_TTL_MS, LOOSE_PHOTOS_PER_ACCOUNT); their paths come
-- back for the caller to remove from Storage. The cover's words for screen readers aren't asked for: the app's covers
-- are decorative (alt "", hub-actions.ts:174), and hub_posts.image_alt keeps ''.
-- Returns jsonb:
--   {"result": "created", "id", "path", "removed_paths"}
--   {"result": "forbidden"}  not hub staff
-- A type other than JPEG, PNG or WebP raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create function public.add_hub_photo(p_type text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  made uuid := gen_random_uuid();
  removed text[];
begin
  if not private.is_staff('hub') then
    return jsonb_build_object('result', 'forbidden');
  end if;
  if p_type is null or p_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'a cover is a JPEG, PNG or WebP' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.photos (id, owner_id, use, type, path) values (made, null, 'hub-draft', p_type, 'hub/' || made::text);
  with gone as (
    delete from public.photos p
    where p.id in (
      select w.id from (
        select q.id, q.created_at, row_number() over (order by (q.id = made) desc, q.created_at desc, q.id) as newest
        from public.photos q
        where q.owner_id is null and q.use = 'hub-draft'
      ) w
      where w.id <> made and (w.created_at <= now() - interval '24 hours' or w.newest > 12)
    )
    returning p.path
  )
  select coalesce(array_agg(path order by path), '{}') into removed from gone;
  return jsonb_build_object('result', 'created', 'id', made, 'path', 'hub/' || made::text, 'removed_paths', to_jsonb(removed));
end;
$$;

-- --- Hub posts (saveHubPost, lib/data/hub-posts.ts:140; savePost, lib/staff/hub-actions.ts:113) ---------------------

-- Save a post (spec 2.4, plan decisions 11 and 12): a new one (p_id null), or changes to one. Mentors edit their own,
-- admins any, the samples included (canEditPost, hub-posts.ts:98). The fields are checkPost's (lib/staff/post-rules.ts):
-- a tip is every campus's, with no start or place; only an event has places and a count (0 for a new event, kept
-- across edits, gone when it stops being one). Their limits are the table's checks (check_violation). A new event or
-- office hours, or one whose start changes, can't start in the past (startsInThePast, hub-actions.ts:57).
-- p_cover_photo_id is a new cover: one of the Hub's waiting photos less than a day old (keptCover, hub-actions.ts:47),
-- which becomes the post's ('post:<id>'); the post's own cover, or null, keeps the one it has (the banner for a new
-- post). A replaced cover's row goes and its path comes back for Storage. An existing post saved with every field and
-- its cover as they are changes nothing: no audit row, its updated time kept (staff tools amendment 15.7). A new post
-- takes the form's one-time token, so a second send makes nothing.
-- The audit entry says "Published" or "Draft" (savePost's detail). Nobody is told.
-- Returns jsonb {"result", "id", "removed_paths"}, the result one of:
--   'created' | 'changed' | 'nothing'
--   'not-found'      no post with that id (the app's 404)
--   'forbidden'      not hub staff, or a mentor's edit of someone else's post (also the app's 404)
--   'date-past'      a start that has passed
--   'cover-invalid'  the cover isn't one of the Hub's waiting photos
--   'once-expired' | 'once-taken'  a new post's token
-- A kind other than the three, a campus that isn't one, or a null published raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create function public.save_hub_post(
  p_id text, p_kind text, p_title text, p_campus text, p_starts_at timestamptz, p_place text, p_capacity int,
  p_summary text, p_body text, p_published boolean, p_cover_photo_id uuid default null, p_once_token text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  post public.hub_posts;
  saved public.hub_posts;
  v_campus text := case when p_kind <> 'tip' then p_campus end;
  v_starts timestamptz := case when p_kind <> 'tip' then p_starts_at end;
  v_place text := case when p_kind <> 'tip' then p_place end;
  v_capacity int := case when p_kind = 'event' then p_capacity end;
  cover uuid;
  token text;
  removed text[] := '{}'::text[];
begin
  if not private.is_staff('hub') then
    return jsonb_build_object('result', 'forbidden');
  end if;
  if p_kind is null or p_kind not in ('event', 'office-hours', 'tip') then
    raise exception 'a post is an event, office hours or a tip' using errcode = 'invalid_parameter_value';
  end if;
  if p_published is null then
    raise exception 'a post is published or a draft' using errcode = 'invalid_parameter_value';
  end if;
  if v_campus is not null and not exists (select 1 from public.campuses c where c.slug = v_campus) then
    raise exception 'no such campus' using errcode = 'invalid_parameter_value';
  end if;
  if p_id is not null then
    select * into post from public.hub_posts h where h.id = p_id for update;
    if post.id is null then
      return jsonb_build_object('result', 'not-found');
    end if;
    if post.author_id is distinct from me and not private.is_staff('admin') then
      return jsonb_build_object('result', 'forbidden');
    end if;
  end if;
  if p_cover_photo_id is not null and p_cover_photo_id is distinct from post.cover_photo_id then
    if not exists (
      select 1 from public.photos ph
      where ph.id = p_cover_photo_id and ph.owner_id is null and ph.use = 'hub-draft'
        and ph.created_at > now() - interval '24 hours'
    ) then
      return jsonb_build_object('result', 'cover-invalid');
    end if;
    cover := p_cover_photo_id;
  end if;
  if post.id is not null and cover is null
    and post.kind = p_kind and post.title = p_title and post.campus_slug is not distinct from v_campus
    and post.starts_at is not distinct from v_starts and post.place is not distinct from v_place
    and post.capacity is not distinct from v_capacity and post.summary = p_summary and post.body = p_body
    and post.published = p_published
  then
    return jsonb_build_object('result', 'nothing', 'id', post.id, 'removed_paths', '[]'::jsonb);
  end if;
  if v_starts is not null and v_starts <= now() and v_starts is distinct from post.starts_at then
    return jsonb_build_object('result', 'date-past');
  end if;

  if post.id is null then
    token := private.take_once_token(p_once_token);
    if token = 'none' then
      return jsonb_build_object('result', 'once-expired');
    elsif token = 'again' then
      return jsonb_build_object('result', 'once-taken');
    end if;
    insert into public.hub_posts (
      kind, title, summary, place, body, campus_slug, starts_at, capacity, going, image_src, image_alt, cover_photo_id,
      published, published_at, author_id
    )
    values (
      p_kind, p_title, p_summary, v_place, p_body, v_campus, v_starts, v_capacity, case when p_kind = 'event' then 0 end, null, '',
      cover, p_published, case when p_published then now() end, me
    )
    returning * into saved;
  else
    update public.hub_posts h
    set kind = p_kind, title = p_title, summary = p_summary, place = v_place, body = p_body, campus_slug = v_campus,
      starts_at = v_starts, capacity = v_capacity,
      going = case when p_kind = 'event' then coalesce(h.going, 0) end,
      image_src = case when cover is null then h.image_src end,
      image_alt = case when cover is null then h.image_alt else '' end,
      cover_photo_id = coalesce(cover, h.cover_photo_id),
      published = p_published,
      published_at = coalesce(h.published_at, case when p_published then now() end),
      updated_at = now()
    where h.id = post.id
    returning h.* into saved;
  end if;

  if cover is not null then
    update public.photos ph set use = 'post:' || saved.id where ph.id = cover;
    with gone as (
      delete from public.photos ph where ph.use = 'post:' || saved.id and ph.id <> cover returning ph.path
    )
    select coalesce(array_agg(path order by path), '{}') into removed from gone;
  end if;
  perform private.record_audit(
    case when post.id is null then 'post-created' else 'post-updated' end, 'post', saved.id, saved.title,
    case when saved.published then 'Published' else 'Draft' end, null
  );
  return jsonb_build_object(
    'result', case when post.id is null then 'created' else 'changed' end, 'id', saved.id,
    'removed_paths', to_jsonb(removed)
  );
end;
$$;

-- --- RSVPs and slot requests (lib/hub-actions.ts; addRsvp to answerBooking, hub-posts.ts:182 to 290) ------------------

-- Whether an event or office hours are over (hasPassed, lib/hub.ts:60): their SAST date is before today's.
create function private.post_has_passed(starts timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.sast_day(starts) < private.sast_day(now()), false);
$$;

-- RSVP (addRsvp, hub-posts.ts:182): a published event that hasn't passed, with a place left: its count before Vossie
-- plus the RSVPs below its places, counted with the post locked, so two RSVPs at the same moment can't both take the
-- last place.
-- Returns 'going' | 'already' | 'full' | 'closed' (a draft, past, not an event, or no such post).
-- A user action (advisor 0029 lists it on purpose).
create function public.rsvp(p_post text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.require_profile();
  post public.hub_posts;
begin
  select * into post from public.hub_posts h where h.id = p_post for update;
  if post.id is null or not post.published or post.kind <> 'event' or private.post_has_passed(post.starts_at) then
    return 'closed';
  end if;
  if exists (select 1 from public.hub_rsvps r where r.post_id = post.id and r.account_id = account) then
    return 'already';
  end if;
  if post.going + (select count(*) from public.hub_rsvps r where r.post_id = post.id) >= post.capacity then
    return 'full';
  end if;
  insert into public.hub_rsvps (post_id, account_id) values (post.id, account);
  return 'going';
end;
$$;

-- Cancel my RSVP (removeRsvp, hub-posts.ts:193).
-- Returns 'changed' | 'nothing' (there was none).
-- A user action (advisor 0029 lists it on purpose).
create function public.cancel_rsvp(p_post text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
begin
  delete from public.hub_rsvps r where r.post_id = p_post and r.account_id = account;
  return case when found then 'changed' else 'nothing' end;
end;
$$;

-- Request a slot (requestSlot, hub-posts.ts:213; sendSlotRequest, lib/hub-actions.ts:59): published office hours that
-- haven't passed, one open request a student at a time (the hub_bookings_one_open index). What they'd like help with is
-- 1 to HELP_MAX (300) characters of clean text, a time that suits 0 to TIME_MAX (100), one line (checkHelp, checkTime).
-- The post's author is told ("booking", to the queue), unless that's the student, or there's none (a sample).
-- Returns 'requested' | 'open-already' | 'closed'. A help or time out of bounds raises check_violation.
-- A user action (advisor 0029 lists it on purpose).
create function public.request_slot(p_post text, p_help text, p_time text default '')
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.require_profile();
  post public.hub_posts;
  booking uuid;
begin
  if p_help is null or char_length(p_help) not between 1 and 300 or not private.is_clean_text(p_help) then
    raise exception 'what they''d like help with is 1 to 300 characters of clean text' using errcode = 'check_violation';
  end if;
  if char_length(coalesce(p_time, '')) > 100 or not private.is_clean_line(coalesce(p_time, '')) then
    raise exception 'a time that suits is one line of at most 100 characters' using errcode = 'check_violation';
  end if;
  select * into post from public.hub_posts h where h.id = p_post;
  if post.id is null or not post.published or post.kind <> 'office-hours' or private.post_has_passed(post.starts_at) then
    return 'closed';
  end if;
  insert into public.hub_bookings (post_id, account_id, help, time)
  values (post.id, account, p_help, coalesce(p_time, ''))
  on conflict (post_id, account_id) where status = 'open' do nothing
  returning id into booking;
  if booking is null then
    return 'open-already';
  end if;
  if post.author_id is distinct from account then
    perform private.notify(
      post.author_id, 'booking', booking::text,
      private.slot_requested_note_text((select p.first_name from public.profiles p where p.id = account), post.title),
      '/hub/manage#hub-queue'
    );
  end if;
  return 'requested';
end;
$$;

-- Accept or Decline a slot request (answerBooking, hub-posts.ts:282; answerSlot, hub-actions.ts:198): an open one is
-- answered once. The audit entry is "Student: office hours", about the student, who is told ("booking", to the request
-- page).
-- Returns 'changed' | 'nothing' | 'forbidden' (hub staff). A null p_accept raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create function public.answer_booking(p_booking uuid, p_accept boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  booking public.hub_bookings;
  post_title text;
  student text;
begin
  if not private.is_staff('hub') then
    return 'forbidden';
  end if;
  if p_accept is null then
    raise exception 'a slot request is accepted or declined' using errcode = 'invalid_parameter_value';
  end if;
  update public.hub_bookings b
  set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now(),
    answered_by = (select auth.uid())
  where b.id = p_booking and b.status = 'open'
  returning b.* into booking;
  if booking.id is null then
    return 'nothing';
  end if;
  post_title := (select h.title from public.hub_posts h where h.id = booking.post_id);
  student := (select p.first_name from public.profiles p where p.id = booking.account_id);
  perform private.record_audit(
    case when p_accept then 'booking-accepted' else 'booking-declined' end, 'booking', booking.id::text,
    student || ': ' || post_title, '', booking.account_id
  );
  perform private.notify(
    booking.account_id, 'booking', booking.id::text, private.slot_answer_note_text(p_accept, post_title),
    '/hub/' || booking.post_id || '/book'
  );
  return 'changed';
end;
$$;

-- --- Mentors' notes and check-ins (addNote, lib/data/mentors.ts:76; addMentorNote and addCheckIn) -------------------

-- A note or check-in about a shop's owner, by the shop's mentor (still holding the role) or an admin, never the owner
-- (private.can_mentor, as mentoredFrom's getMentoredShop, mentor-actions.ts:27). 1 to MENTOR_NOTE_MAX (1,000) characters
-- of clean text (checkMentorNote). Takes the form's one-time token. The audit entry names the shop, never what the note
-- says, and a check-in's day; nobody is told.
create function private.write_mentor_note(owner uuid, note_kind text, day date, note text, once_token text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  me public.profiles;
  shop public.shops;
  token text;
begin
  if not private.can_mentor(owner) then
    return 'forbidden';
  end if;
  if note is null or char_length(note) not between 1 and 1000 or not private.is_clean_text(note) then
    raise exception 'a note is 1 to 1,000 characters of clean text' using errcode = 'check_violation';
  end if;
  token := private.take_once_token(once_token);
  if token = 'none' then
    return 'once-expired';
  elsif token = 'again' then
    return 'once-taken';
  end if;
  select * into me from public.profiles p where p.id = (select auth.uid());
  insert into public.mentor_notes (owner_id, kind, check_in_on, text, author_id, author_name)
  values (owner, note_kind, day, note, me.id, me.first_name);
  select s.* into shop from public.seller_profiles sp join public.shops s on s.id = sp.shop_id where sp.account_id = owner;
  perform private.record_audit(
    case when note_kind = 'note' then 'note-added' else 'check-in-added' end, 'shop', shop.slug, shop.name,
    coalesce(to_char(day, 'YYYY-MM-DD'), ''), owner
  );
  return 'changed';
end;
$$;

-- Add a note (addMentorNote, mentor-actions.ts:62).
-- Returns 'changed' | 'forbidden' (not mentor-area staff, or not this shop's mentor or an admin) | 'once-expired' |
-- 'once-taken'. A missing, long or unclean note raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create function public.add_mentor_note(p_owner uuid, p_text text, p_once_token text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_staff('mentor') then
    return 'forbidden';
  end if;
  return private.write_mentor_note(p_owner, 'note', null, p_text, p_once_token);
end;
$$;

-- Add a check-in (addCheckIn, mentor-actions.ts:97): its day is today or earlier in South Africa (checkCheckInDay,
-- lib/staff/rules.ts:93).
-- Returns as add_mentor_note, or 'check-in-day-future'. A null day raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create function public.add_check_in(p_owner uuid, p_day date, p_text text, p_once_token text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_staff('mentor') then
    return 'forbidden';
  end if;
  if p_day is null then
    raise exception 'a check-in has a day' using errcode = 'invalid_parameter_value';
  end if;
  if not private.can_mentor(p_owner) then
    return 'forbidden';
  end if;
  if p_day > private.sast_day(now()) then
    return 'check-in-day-future';
  end if;
  return private.write_mentor_note(p_owner, 'check-in', p_day, p_text, p_once_token);
end;
$$;

-- --- Staff roles (giveRole and removeRole, lib/data/staff-accounts.ts:89 and :107; lib/staff/account-actions.ts) -----

-- "Mentor" or "Admin", as the log writes a role (roleLabel, lib/staff/roles.ts:47).
create function private.role_label(role text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case role when 'mentor' then 'Mentor' when 'admin' then 'Admin' end;
$$;

-- Give a staff role (stage J spec decision 3): to the account with exactly this email, trimmed and lower case
-- (normaliseEmail, lib/auth/email.ts:15, the lookup sign-in uses), never a search, and only one that has finished
-- signing in (a profile): giving a role never makes an account. Roles are kept in the order mentor, admin (ROLE_ORDER,
-- staff-accounts.ts:38). Takes the form's one-time token once the account and role are right (giveStaffRole). The
-- person is told ("staff-role", the role as its subject, to /account); the audit entry is about them, naming the role.
-- Returns 'changed' | 'no-account' | 'held' | 'forbidden' (admin) | 'once-expired' | 'once-taken'.
-- A role other than mentor or admin raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create function public.give_role(p_email text, p_role text, p_once_token text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  wanted text := lower(btrim(coalesce(p_email, '')));
  target public.profiles;
  token text;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  if p_role is null or p_role not in ('mentor', 'admin') then
    raise exception 'a staff role is mentor or admin' using errcode = 'invalid_parameter_value';
  end if;
  if wanted = '' then
    return 'no-account';
  end if;
  select p.* into target
  from public.profiles p join auth.users u on u.id = p.id
  where lower(u.email) = wanted
  for update of p;
  if target.id is null then
    return 'no-account';
  end if;
  if p_role = any (target.roles) then
    return 'held';
  end if;
  token := private.take_once_token(p_once_token);
  if token = 'none' then
    return 'once-expired';
  elsif token = 'again' then
    return 'once-taken';
  end if;
  update public.profiles p
  set roles = array(
    select r.role from unnest(array['mentor', 'admin']) with ordinality as r(role, ord)
    where r.role = p_role or r.role = any (target.roles)
    order by r.ord
  )
  where p.id = target.id;
  perform private.record_audit('role-given', 'account', target.id::text, target.first_name, private.role_label(p_role), target.id);
  perform private.notify(target.id, 'staff-role', p_role, private.staff_role_note_text('given', p_role), '/account');
  return 'changed';
end;
$$;

-- Take a role away (stage J spec decisions 5 and 6): never your own admin role ('own-admin'), never the last admin
-- ('last-admin'). Removing an admin role waits for an advisory lock first and checks the remover's own role again under
-- it, so two admins removing each other at the same moment can't both pass: the second finds its role gone (GO-LIVE:
-- the last-admin rule in the database). A mentor's shops lose their mentor (as deleting the account does), and the audit
-- entry names them ("Mentor. No mentor now: …", removeStaffRole); their notes, check-ins and posts stay. The person is
-- told ("staff-role").
-- Returns 'changed' | 'nothing' (no such role to take) | 'own-admin' | 'last-admin' | 'forbidden' (admin).
-- A role other than mentor or admin raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create function public.remove_role(p_account uuid, p_role text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target public.profiles;
  unassigned text[] := '{}'::text[];
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  if p_role is null or p_role not in ('mentor', 'admin') then
    raise exception 'a staff role is mentor or admin' using errcode = 'invalid_parameter_value';
  end if;
  if p_role = 'admin' then
    if p_account = me then
      return 'own-admin';
    end if;
    perform pg_advisory_xact_lock(hashtext('vossie:staff-roles'), 0);
    if not private.is_staff('admin') then
      return 'forbidden';
    end if;
  end if;
  select * into target from public.profiles p where p.id = p_account for update;
  if target.id is null or not (p_role = any (target.roles)) then
    return 'nothing';
  end if;
  if p_role = 'admin' and (select count(*) from public.profiles p where 'admin' = any (p.roles)) <= 1 then
    return 'last-admin';
  end if;
  if p_role = 'mentor' then
    unassigned := array(
      select s.name
      from public.seller_profiles sp join public.shops s on s.id = sp.shop_id and s.owner_id = sp.account_id
      where sp.mentor_id = target.id
      order by s.name
    );
    update public.seller_profiles sp set mentor_id = null where sp.mentor_id = target.id;
  end if;
  update public.profiles p set roles = array_remove(p.roles, p_role) where p.id = target.id;
  perform private.record_audit(
    'role-removed', 'account', target.id::text, target.first_name,
    case
      when p_role = 'mentor' and cardinality(unassigned) > 0
        then 'Mentor. No mentor now: ' || array_to_string(unassigned, ', ')
      else private.role_label(p_role)
    end,
    target.id
  );
  perform private.notify(target.id, 'staff-role', p_role, private.staff_role_note_text('removed', p_role), '/account');
  return 'changed';
end;
$$;

-- --- Hiding needs an open report (Task 4's open question 2) ----------------------------------------------------------
-- Task 4's hide_listing and hide_request, replaced: the same, except that the target must have an open report that
-- isn't about something gone. The app offers Hide only from an open report (hideReportedPath), and hiding again after
-- Show again "needs a new report" (CLAUDE.md; stage J spec decision 14).

-- Returns 'changed' | 'nothing' (no such listing, or hidden already) | 'no-open-report' | 'forbidden' (admin). A missing,
-- long or unclean reason raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.hide_listing(p_listing text, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  listing public.listings;
  owner uuid;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  perform private.check_reason(p_reason);
  perform 1 from public.listings l where l.id = p_listing and l.hidden_at is null for update;
  if not found then
    return 'nothing';
  end if;
  if not exists (
    select 1 from public.reports r
    where r.target_kind = 'listing' and r.target_id = p_listing and r.status = 'open' and not r.target_gone
  ) then
    return 'no-open-report';
  end if;
  update public.listings l
  set hidden_at = now(), hidden_reason = p_reason
  where l.id = p_listing and l.hidden_at is null
  returning l.* into listing;
  if listing.id is null then
    return 'nothing';
  end if;
  owner := (select s.owner_id from public.shops s where s.id = listing.shop_id);
  perform private.close_reports('listing', array[listing.id], 'hidden', p_reason);
  perform private.record_audit('listing-hidden', 'listing', listing.id, listing.title, p_reason, owner);
  perform private.notify(
    owner, 'shop-update', listing.id, private.listing_hidden_note_text(listing.title),
    private.my_listings_path(listing.state)
  );
  return 'changed';
end;
$$;

-- Returns 'changed' | 'nothing' (no such request, or hidden already) | 'no-open-report' | 'forbidden' (admin). A missing,
-- long or unclean reason raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.hide_request(p_request text, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request public.requests;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  perform private.check_reason(p_reason);
  perform 1 from public.requests q where q.id = p_request and q.hidden_at is null for update;
  if not found then
    return 'nothing';
  end if;
  if not exists (
    select 1 from public.reports r
    where r.target_kind = 'request' and r.target_id = p_request and r.status = 'open' and not r.target_gone
  ) then
    return 'no-open-report';
  end if;
  update public.requests q
  set hidden_at = now(), hidden_reason = p_reason, updated_at = now()
  where q.id = p_request and q.hidden_at is null
  returning q.* into request;
  if request.id is null then
    return 'nothing';
  end if;
  perform private.close_reports('request', array[request.id], 'hidden', p_reason);
  perform private.record_audit('request-hidden', 'request', request.id, request.title, p_reason, request.asker_id);
  perform private.notify(
    request.asker_id, 'request-update', request.id, private.request_hidden_note_text(request.title), '/account/requests'
  );
  return 'changed';
end;
$$;

-- --- Grants ---------------------------------------------------------------------------------------------------------

-- The private helpers run only inside the functions above (as their owner), and the triggers as the table's.
revoke all on function
  private.form_states_keep_taken(), private.form_states_keep_taken_rows(), private.take_once_token(text),
  private.slot_answer_note_text(boolean, text), private.slot_requested_note_text(text, text),
  private.staff_role_note_text(text, text), private.check_point_name(text), private.pin_detail(text, date),
  private.post_has_passed(timestamptz), private.write_mentor_note(uuid, text, date, text, text), private.role_label(text)
from public, anon, authenticated, service_role;

-- Staff actions and students' RSVPs and slot requests: signed-in people (and the service role), never anon. Each staff
-- action checks the role itself; the service role has no session, so it gets 'forbidden' from them.
revoke all on function
  public.add_pickup_point(text, text), public.rename_pickup_point(uuid, text), public.retire_pickup_point(uuid),
  public.restore_pickup_point(uuid), public.pin_shop(uuid, text, date), public.unpin_shop(uuid),
  public.add_hub_photo(text),
  public.save_hub_post(text, text, text, text, timestamptz, text, integer, text, text, boolean, uuid, text),
  public.rsvp(text), public.cancel_rsvp(text), public.request_slot(text, text, text),
  public.answer_booking(uuid, boolean), public.add_mentor_note(uuid, text, text),
  public.add_check_in(uuid, date, text, text), public.give_role(text, text, text), public.remove_role(uuid, text)
from public, anon;
grant execute on function
  public.add_pickup_point(text, text), public.rename_pickup_point(uuid, text), public.retire_pickup_point(uuid),
  public.restore_pickup_point(uuid), public.pin_shop(uuid, text, date), public.unpin_shop(uuid),
  public.add_hub_photo(text),
  public.save_hub_post(text, text, text, text, timestamptz, text, integer, text, text, boolean, uuid, text),
  public.rsvp(text), public.cancel_rsvp(text), public.request_slot(text, text, text),
  public.answer_booking(uuid, boolean), public.add_mentor_note(uuid, text, text),
  public.add_check_in(uuid, date, text, text), public.give_role(text, text, text), public.remove_role(uuid, text)
to authenticated, service_role;
