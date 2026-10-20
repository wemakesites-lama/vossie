-- Phase A's tables widened for stages G to J (supabase schema catch-up plan, Task 1; backend spec 4.2 and 4.3): what
-- the sample store's rows gained in the staff tools (G), community actions (H), saved-search alerts (I) and staff
-- accounts (J), with the same rules, on the tables phase A made.
--
-- - Staging already holds rows, so every new check comes after the backfill that makes the rows meet it: a paused
--   profile was paused by its seller (the only way phase A could pause one), and an approved or paused profile's first
--   approval is taken to be its application's time. Phase A had no way to close a report, decline a shop, hide a
--   listing or make an ownerless photo, so those need none.
-- - Two phase A functions that write a changed column are replaced here, so the new checks hold from the start:
--   set_shop_paused (who paused) and change_shop_slug (a shop's old links). update_shop is replaced as well: its one
--   change of link is the same change as change_shop_slug's, and plan decision 7 says every slug choice checks the old
--   links. The two share private.shop_link_moved, which Task 6 extends for the notifications that name a shop's link.
-- - Column grants replace two whole-table grants, so staff-only columns stay out of the API roles' reach: a report's
--   note and who closed it (only staff read them), and a seller profile's mentor (the seller never learns who it is).
--   A query through the API names its columns rather than using *.
-- - Offers on conversations are Task 3's, once requests exist; staff reads of these tables are Task 2's.

-- --- notifications (NotificationKind, lib/types.ts:330; NotificationRow, lib/data/rows.ts:223) -----------------------

-- The app's 11 kinds: messaging's two, and the staff tools', community actions', alerts' and staff accounts' additions.
alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (kind in (
    'message', 'sale-to-confirm', 'report-handled', 'shop-approved', 'shop-update', 'booking', 'offer', 'request-update',
    'new-listing', 'search-match', 'staff-role'
  )),
  -- How many new listings a once-a-day notification is about since it was last read (NotificationRow.count,
  -- rows.ts:239). Null means one; notifyOncePerDay writes 1 when it opens one again (notifications.ts:206).
  add column count int check (count >= 1);

-- One notification a SAST day per account, kind and subject for the two once-a-day kinds (notifyOncePerDay,
-- notifications.ts:182): a followed shop's new listings and a saved search's matches. Task 6's notify_once_per_day is
-- one INSERT … ON CONFLICT … DO UPDATE on this index, so two publishes at once can't make two. Phase A's kinds couldn't
-- be either of these, so no row clashes.
create unique index notifications_once_a_day
on public.notifications (account_id, kind, subject_id, private.sast_day(created_at))
where kind in ('new-listing', 'search-match');

-- --- reports (ReportRow, rows.ts:197; lib/data/staff-reports.ts) -----------------------------------------------------

alter table public.reports
  -- What the Hub did (ReportOutcome, lib/types.ts:540).
  add column outcome text check (outcome in ('dismissed', 'hidden', 'paused')),
  -- A dismissal's note, or the hide's or pause's reason: clean text with its line breaks, as checkReason and
  -- checkDismissNote leave it (lib/staff/rules.ts:26 and :31), at most REASON_MAX (rules.ts:8). Staff only.
  add column note text check (char_length(note) between 1 and 500 and private.is_clean_text(note)),
  add column closed_at timestamptz,
  -- The staff member who closed it, or null once their account is deleted (ReportRow.closedBy).
  add column closed_by uuid references public.profiles (id) on delete set null,
  -- The shop it was about has been deleted: it can only be dismissed, even if a new shop takes the link (amendment
  -- 13.1). Set by account deletion (Task 8); a report about a deleted request keeps false (plan decision 8).
  add column target_gone boolean not null default false,
  -- close() in staff-reports.ts:131 sets the status, outcome, note, time and closer together.
  add constraint reports_outcome_when_closed check ((status = 'closed') = (outcome is not null)),
  add constraint reports_closed_at_when_closed check ((status = 'closed') = (closed_at is not null)),
  add constraint reports_note_when_closed check (note is null or status = 'closed'),
  add constraint reports_closed_by_when_closed check (closed_by is null or status = 'closed');
-- The index for the closer foreign key (advisor 0001).
create index reports_closed_by_idx on public.reports (closed_by);

-- A reporter reads their own reports (phase A's policy), but not the staff-only note or who closed them.
revoke select on table public.reports from authenticated;
grant select (
  id, reporter_id, target_kind, target_id, target_title, reason, detail, status, created_at, outcome, closed_at,
  target_gone
) on table public.reports to authenticated;

-- --- listings (ListingRow, rows.ts:280; staff tools plan decision 4) -------------------------------------------------

alter table public.listings
  add column hidden_at timestamptz,
  -- Why the Hub hid it, which the seller sees: clean text with its line breaks (checkReason), at most REASON_MAX.
  add column hidden_reason text check (char_length(hidden_reason) between 1 and 500 and private.is_clean_text(hidden_reason)),
  add constraint listings_hidden_with_reason check ((hidden_at is null) = (hidden_reason is null));

-- Buyers stop seeing a hidden listing (catalog.ts:109 and :118); its owner still reads it and why, since saving it
-- keeps it hidden (own-listings.ts:75). The listing-photo policy needs no change: it asks the listings table, whose
-- policies apply inside it, so a hidden listing's photos go with it, and its owner keeps them.
drop policy "Anyone reads published listings of open shops" on public.listings;
create policy "Anyone reads published listings of open shops"
on public.listings for select
to anon
using (state <> 'draft' and hidden_at is null and private.shop_is_public(shop_id));

drop policy "Signed-in people read published listings of open shops, and owners all of theirs" on public.listings;
create policy "Signed-in people read published listings of open shops, and owners all of theirs"
on public.listings for select
to authenticated
using ((state <> 'draft' and hidden_at is null and private.shop_is_public(shop_id)) or private.owns_shop(shop_id));

-- --- seller_profiles (SellerProfileRow, rows.ts:42; lib/data/staff-shops.ts) ----------------------------------------

alter table public.seller_profiles
  -- When the Hub declined the application (staff tools plan decision 2); cleared when it's approved.
  add column declined_at timestamptz,
  -- Who paused a paused shop (staff tools plan decision 3): a seller can only resume their own pause.
  add column paused_by text check (paused_by in ('seller', 'staff')),
  -- The seller had paused the shop when the Hub paused it, so the Hub's Resume puts that pause back (amendment 13.3).
  add column seller_paused_too boolean not null default false,
  -- The Hub's reason for a decline or a pause, which the seller sees (checkReason; REASON_MAX).
  add column staff_reason text check (char_length(staff_reason) between 1 and 500 and private.is_clean_text(staff_reason)),
  -- The shop's mentor (staff tools spec 2.6). Never readable by the owner (the column grant below).
  add column mentor_id uuid references public.profiles (id) on delete set null,
  -- The Hub's first approval (stage J spec section 4), for the admin's numbers. Set once (the trigger below).
  add column approved_at timestamptz;

-- Backfills, before the checks: phase A's only pause was the seller's own (set_shop_paused), and an approved or paused
-- profile's first approval is taken to be when it applied.
update public.seller_profiles set paused_by = 'seller' where status = 'paused' and paused_by is null;
update public.seller_profiles set approved_at = applied_at where status in ('approved', 'paused') and approved_at is null;

alter table public.seller_profiles
  -- Nobody reads notes about their own shop, so the owner can't be its mentor (setShopMentor, staff-shops.ts:228).
  add constraint seller_profiles_mentor_not_owner check (mentor_id <> account_id),
  -- setShopPaused (shops.ts:218), staffPauseShop and staffResumeShop (staff-shops.ts:178 to 202) set paused_by
  -- exactly when they pause, and clear it when they resume.
  add constraint seller_profiles_paused_by_when_paused check ((status = 'paused') = (paused_by is not null)),
  -- Only a staff pause can have a seller's pause under it (staffPauseShop; staffResumeShop clears it).
  add constraint seller_profiles_seller_paused_too_under_staff check (not seller_paused_too or paused_by = 'staff'),
  -- Only a waiting shop is declined (declineShop), and approving one clears it (approveShop, staff-shops.ts:125).
  add constraint seller_profiles_declined_while_pending check (declined_at is null or status = 'pending');
-- The index for the mentor foreign key (advisor 0001), and for a mentor's list of shops (Task 2).
create index seller_profiles_mentor_id_idx on public.seller_profiles (mentor_id);

-- approved_at is set once, by the first approval, and kept through pauses and resumes (approveShop keeps
-- `shop.profile.approvedAt ?? now`, staff-shops.ts:134), as keep_first_published_at keeps a listing's first publish.
create function private.keep_approved_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.approved_at is not null and new.approved_at is distinct from old.approved_at then
    raise exception 'seller profile %: approved_at is set once and never changed', old.account_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.keep_approved_at() from public, anon, authenticated;

create trigger seller_profiles_keep_approved_at
before update of approved_at on public.seller_profiles
for each row execute function private.keep_approved_at();

-- The owner reads their decline, the Hub's reason and who paused; never their mentor.
revoke select on table public.seller_profiles from authenticated;
grant select (
  account_id, status, shop_id, applied_at, declined_at, paused_by, seller_paused_too, staff_reason, approved_at
) on table public.seller_profiles to authenticated;

-- Pause my shop and Resume (setShopPaused, shops.ts:218; selling spec 2.8): approved to paused and back. The seller's
-- own pause is marked theirs; a pause the Hub made is the Hub's to undo, so the seller can't resume it (shops.ts:221,
-- staff tools plan decision 3). Replaces phase A's, which set no paused_by.
-- Returns the new status ('paused' | 'approved'), or 'not-allowed' for setShopPaused's null.
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.set_shop_paused(p_paused boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
  now_status text;
begin
  update public.seller_profiles
  set status = case when p_paused then 'paused' else 'approved' end,
      paused_by = case when p_paused then 'seller' end
  where account_id = account and shop_id is not null
    and status = case when p_paused then 'approved' else 'paused' end
    and (p_paused or paused_by = 'seller')
  returning seller_profiles.status into now_status;
  return coalesce(now_status, 'not-allowed');
end;
$$;

-- --- form_states (FormStateRow.taken, rows.ts:148; lib/staff/once.ts) -----------------------------------------------

-- A one-time token taken by a post (takeFormState, lib/data/form-states.ts:35): the first post makes the thing, any
-- other makes nothing. Only private.take_once_token (Task 5) sets it, so the owner keeps every other column's update
-- but not this one: a person can't clear their own token and post twice.
alter table public.form_states add column taken boolean not null default false;
revoke update on table public.form_states from authenticated;
grant update (session_id, form, account_id, errors, values, notice, expires_at) on table public.form_states to authenticated;

-- --- photos (plan decision 6) -----------------------------------------------------------------------------------------

-- A Hub cover belongs to the Hub, not to the staff member who added it, so deleting their account doesn't take it off
-- the post: such a photo has no owner and is stored at hub/<id>. While it waits for its form its use is 'hub-draft'
-- (add_hub_photo, Task 5); on a post, 'post:<post id>' (hub_posts.id is "h-001" or a short id). No other photo is
-- ownerless, and a Hub photo is never a student's.
-- Waiting photos: the database side of the sweep is the action that makes new ones (add_photos for a student's, use
-- null; add_hub_photo for the Hub's, use 'hub-draft'), each a day; the files go through phase C's Vercel Cron (spec 7),
-- which treats 'hub-draft' rows as it treats a student's waiting ones. photos_owner_id_use_idx serves both lookups
-- (owner_id is null and use = 'hub-draft').
alter table public.photos
  alter column owner_id drop not null,
  drop constraint photos_use_check,
  drop constraint photos_check,
  add constraint photos_use_check check (
    use in ('shop', 'draft', 'hub-draft')
    or use ~ '^listing:[a-z0-9]+(-[a-z0-9]+)*$'
    or use ~ '^post:[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  add constraint photos_ownerless_for_hub check ((owner_id is null) = coalesce(use = 'hub-draft' or use ~ '^post:', false)),
  -- {owner}/{id}, or hub/{id} for the Hub's.
  add constraint photos_path_check check (path = coalesce(owner_id::text, 'hub') || '/' || id::text);

-- --- pickup_points (lib/data/pickup-points.ts:29) ---------------------------------------------------------------------

-- A listing on a retired point still names it ("no longer used", pickupPointById), so anyone reads retired points too.
-- Queries for the points in use (pointsInUse) filter `retired_at is null`.
drop policy "Anyone reads live pickup points" on public.pickup_points;
create policy "Anyone reads pickup points, retired ones too"
on public.pickup_points for select
to anon, authenticated
using (true);

-- --- shop_previous_slugs (plan decision 7; SellerRow.previousSlugs, rows.ts:274) -------------------------------------

-- The links a shop had before its one change. They stay reserved, so a link someone saved never opens another
-- student's shop (amendment 13.7), and they free up when the shop is deleted (cascade), as in the sample store. Only
-- the functions below and the admin client touch them: RLS is on and the API roles have no grant, so no policy is
-- needed (the advisor's INFO finding 0008, rls_enabled_no_policy, lists the table on purpose).
create table public.shop_previous_slugs (
  -- The same shape as shops.slug.
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- The index for the shop foreign key (advisor 0001).
create index shop_previous_slugs_shop_id_idx on public.shop_previous_slugs (shop_id);
alter table public.shop_previous_slugs enable row level security;
revoke all on table public.shop_previous_slugs from anon, authenticated;
grant all on table public.shop_previous_slugs to service_role;

-- Whether a link is in use (slugInUse, shops.ts:41): another shop has it now, or any shop had it before its change.
-- `own` keeps its own current link (and only that: its old one stays reserved). RESERVED_SLUGS stays an app check: it
-- is the app's own list of route folders. The caller holds the shop-link lock (private.lock_shop_links).
create function private.shop_slug_in_use(link text, own uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.shops s where s.slug = link and s.id is distinct from own)
    or exists (select 1 from public.shop_previous_slugs p where p.slug = link);
$$;

-- A link no shop has or had, from `base` (freeSlug, shops.ts:55): "crochet-corner", then "crochet-corner-2" and so on.
-- `own` keeps its own. Replaces phase A's, which didn't know old links. The caller holds the shop-link lock.
create or replace function private.free_shop_slug(base text, own uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  suffix text;
  candidate text;
begin
  for n in 1..100000 loop
    suffix := case when n = 1 then '' else '-' || n end;
    candidate := regexp_replace(left(base, 40 - char_length(suffix)), '-+$', '') || suffix;
    if not private.shop_slug_in_use(candidate, own) then
      return candidate;
    end if;
  end loop;
  raise exception 'no free link for %', base;
end;
$$;

-- What follows a shop from one link to another (moveShop, shops.ts:67), after its row has moved: with `keep_old` (the
-- seller's one change of link, changeShopSlug at shops.ts:199) the old link is kept, reserved; a waiting shop's link
-- that follows its name keeps none. Reports about the shop follow it, but not those about a shop that had the link
-- before and has gone (shops.ts:87). Conversations, pins and follows point at the shop's id, so they need nothing; Task
-- 6 adds the new-listing notifications that name the link.
create function private.shop_link_moved(shop uuid, from_slug text, to_slug text, keep_old boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if keep_old then
    insert into public.shop_previous_slugs (slug, shop_id) values (from_slug, shop);
  end if;
  update public.reports
  set target_id = to_slug
  where target_kind = 'seller' and target_id = from_slug and not target_gone;
end;
$$;

revoke all on function private.shop_slug_in_use(text, uuid), private.shop_link_moved(uuid, text, text, boolean)
from public, anon, authenticated, service_role;

-- The seller's one change of link (changeShopSlug, shops.ts:199; selling spec 2.11), for an approved or paused shop.
-- Old links then 404, and stay reserved. Replaces phase A's: a link a shop had before is taken too, and the old one is
-- kept.
-- Returns changeShopSlug's SlugChange ('changed' | 'same' | 'used' | 'taken'), or 'not-allowed' for its null (no
-- shop, or a shop still waiting, whose link follows its name). A malformed link raises (check_violation).
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.change_shop_slug(p_slug text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
  own uuid := private.shop_of(account);
  shop public.shops;
begin
  select s.* into shop from public.shops s where s.id = own for update;
  if not found or private.shop_status(shop.id) = 'pending' then
    return 'not-allowed';
  end if;
  if p_slug = shop.slug then
    return 'same';
  end if;
  if shop.slug_changed then
    return 'used';
  end if;
  perform private.lock_shop_links();
  if private.shop_slug_in_use(p_slug, shop.id) then
    return 'taken';
  end if;
  begin
    update public.shops set slug = p_slug, slug_changed = true, updated_at = now() where id = shop.id;
  exception when unique_violation then
    return 'taken';
  end;
  perform private.shop_link_moved(shop.id, shop.slug, p_slug, true);
  return 'changed';
end;
$$;

-- Edit shop (updateShop and changeShopSlug; selling spec 2.11, plan decisions 16 and 17), all or nothing, as phase A's,
-- which it replaces. Two changes: a link another shop had before is taken (slug-taken), and its one change of link
-- keeps the old one, through the same helpers as change_shop_slug.
-- - the details, campus and pickup points; while the shop waits for approval its link follows its name;
-- - its listings follow its campus, and a pickup whose point it no longer uses moves to its first point (in the order
--   given), or online when it has none;
-- - the image: p_photo_id is the new photo (or the current one, kept); p_remove_photo leaves the category's picture;
--   neither keeps the image as it is (a sample shop's placeholder too). A replaced or removed photo is deleted;
-- - p_slug, for an approved or paused shop that hasn't changed its link yet, changes it (the one change of link), and
--   reports about the shop follow. A pending shop, a shop that has used its change, or the same link ignores it.
-- Returns jsonb:
--   {"result": "saved", "slug", "removed_paths"}
--   {"result": "no-shop"}  updateShop's null (requireShopOwner sends the seller to /sell)
--   {"result": "name-taken" | "slug-taken" | "points-invalid" | "photo-invalid"}  nothing is saved
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.update_shop(
  p_name text, p_tagline text, p_category_slug text, p_about text, p_campus_slug text, p_pickup_point_ids uuid[],
  p_photo_id uuid default null, p_remove_photo boolean default false, p_slug text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid := private.signed_in();
  shop public.shops;
  status text;
  link text;
  link_changed boolean := false;
  points uuid[] := private.campus_points(p_campus_slug, p_pickup_point_ids);
  failed text;
  removed text[] := '{}'::text[];
begin
  select s.* into shop from public.shops s where s.id = private.shop_of(owner) for update;
  if not found then
    return '{"result": "no-shop"}'::jsonb;
  end if;
  status := private.shop_status(shop.id);
  if private.name_key(coalesce(p_name, '')) = '' then
    raise exception 'a shop name has a letter or a digit' using errcode = 'check_violation';
  end if;
  if not private.points_fit(p_campus_slug, p_pickup_point_ids) then
    return '{"result": "points-invalid"}'::jsonb;
  end if;
  if p_photo_id is not null and p_photo_id is distinct from shop.image_photo_id
    and not private.photo_usable(owner, p_photo_id, '{}')
  then
    return '{"result": "photo-invalid"}'::jsonb;
  end if;

  perform private.lock_shop_links();
  link := shop.slug;
  if status = 'pending' then
    link := private.free_shop_slug(private.slugify(p_name), shop.id);
  elsif p_slug is not null and p_slug <> shop.slug and not shop.slug_changed then
    if private.shop_slug_in_use(p_slug, shop.id) then
      return '{"result": "slug-taken"}'::jsonb;
    end if;
    link := p_slug;
    link_changed := true;
  end if;

  begin
    update public.shops set
      slug = link,
      slug_changed = slug_changed or link_changed,
      name = p_name,
      tagline = coalesce(p_tagline, ''),
      category_slug = p_category_slug,
      about = coalesce(p_about, ''),
      campus_slug = p_campus_slug,
      image_photo_id = case when p_photo_id is not null then p_photo_id when p_remove_photo then null else image_photo_id end,
      image_placeholder = case when p_photo_id is not null or p_remove_photo then null else image_placeholder end,
      image_alt = case
        when p_photo_id is not null and p_photo_id is distinct from image_photo_id then ''
        when p_remove_photo then ''
        else image_alt
      end,
      updated_at = now()
    where id = shop.id;
  exception when unique_violation then
    get stacked diagnostics failed = constraint_name;
    if failed = 'shops_campus_slug_name_key_key' then
      return '{"result": "name-taken"}'::jsonb;
    elsif failed = 'shops_slug_key' then
      return '{"result": "slug-taken"}'::jsonb;
    end if;
    raise;
  end;

  if link <> shop.slug then
    perform private.shop_link_moved(shop.id, shop.slug, link, link_changed);
  end if;
  delete from public.shop_pickup_points where shop_id = shop.id;
  insert into public.shop_pickup_points (shop_id, pickup_point_id) select shop.id, unnest(points);
  update public.listings set campus_slug = p_campus_slug where shop_id = shop.id and campus_slug <> p_campus_slug;
  update public.listings
  set pickup_point_id = points[1], handover = case when points[1] is null then 'online' else 'pickup' end
  where shop_id = shop.id and handover = 'pickup' and not (pickup_point_id = any (points));

  if p_photo_id is not null then
    update public.photos set use = 'shop' where id = p_photo_id;
    removed := private.delete_photos_used_by(owner, 'shop', array[p_photo_id]);
  elsif p_remove_photo then
    removed := private.delete_photos_used_by(owner, 'shop', '{}');
  end if;
  return jsonb_build_object('result', 'saved', 'slug', link, 'removed_paths', to_jsonb(removed));
end;
$$;
