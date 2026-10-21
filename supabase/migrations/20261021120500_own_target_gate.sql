-- No admin makes a Hub decision about their own shop, a listing of it or their own Looking For request (stage L spec
-- decisions 1 to 3; supabase step 2b plan, Task 6, decision 7; amendment 7).
--
-- The app refuses in each admin action (refuseOwn, lib/staff/admin-actions.ts), with the notice 'own-shop' (a shop or a
-- listing of it) or 'own-request'. Here each of the 13 staff functions does the same, with those results:
-- - right after the role check, so someone without the role still gets 'forbidden' and no hint whose a shop is;
-- - before the reason or note is checked, and before any row is locked, read for writing or written, so a refusal
--   writes, logs and tells nothing;
-- - "own" is owned now, read in the function: shops.owner_id (private.is_own_shop, as isOwnShop in
--   lib/data/staff-shops.ts; phase A's owns_shop reads seller_profiles.shop_id), requests.asker_id
--   (private.is_my_request, as isOwnRequest), and for a report its own (private.report_own_kind, as the report view's
--   own in lib/data/staff-reports.ts, which falls back to the recorded owner once the target has gone).
-- approve_shop and decline_shop name the account whose waiting shop it is, so their gate compares that account.
-- pin_shop's gate comes after its two argument errors (amendment 7). hide_listing, hide_request and staff_pause_shop
-- also serve the report page's Hide and Pause (hideReportedListing, hideReportedRequest, pauseReportedShop): their gates
-- read the target, which agrees with the report's own while the target exists.
-- Owners and askers never change, so the gate takes no lock and adds no deadlock.
-- Each function is copied from its latest definition (the file named above it) with only the gate added, marked
-- "stage L". Signatures and grants are unchanged (create or replace keeps them).

-- --- The helper ---------------------------------------------------------------------------------------------------------

-- Whether the signed-in account owns this shop now (isOwnShop, lib/data/staff-shops.ts:288). A sample shop has no owner,
-- so it's nobody's; a null shop is nobody's either.
create function private.is_own_shop(shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.shops s where s.id = shop and s.owner_id = (select auth.uid()));
$$;
-- Only the staff functions run it (as their owner).
revoke all on function private.is_own_shop(uuid) from public, anon, authenticated, service_role;

-- --- approve_shop, replaced (from 20261020120300_staff_shop_actions.sql) ------------------------------------------

-- Approve, as before (approveSeller, admin-actions.ts), except that an admin can't approve their own waiting shop: the shop
-- is the named account's, so its owner is p_account (isOwnShop on its profile's account).
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.approve_shop(p_account uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shop_ref uuid;
  shop public.shops;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if p_account = (select auth.uid()) then
    return 'own-shop';
  end if;
  update public.seller_profiles sp
  set status = 'approved', declined_at = null, paused_by = null, staff_reason = null,
    approved_at = coalesce(sp.approved_at, now())
  where sp.account_id = p_account and sp.status = 'pending' and sp.declined_at is null
    and exists (select 1 from public.shops s where s.id = sp.shop_id and s.owner_id = sp.account_id)
  returning sp.shop_id into shop_ref;
  if shop_ref is null then
    return 'nothing';
  end if;
  select * into shop from public.shops s where s.id = shop_ref;
  perform private.record_audit('shop-approved', 'shop', shop.slug, shop.name, '', shop.owner_id);
  perform private.notify(shop.owner_id, 'shop-approved', shop.slug, private.shop_approved_note_text(shop.name), '/sell');
  return 'changed';
end;
$$;

-- --- decline_shop, replaced (from 20261020120300_staff_shop_actions.sql) ------------------------------------------

-- Decline, as before (declineSeller), except for the admin's own waiting shop, refused before the reason is checked.
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin). A missing, long or unclean reason raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.decline_shop(p_account uuid, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shop_ref uuid;
  shop public.shops;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if p_account = (select auth.uid()) then
    return 'own-shop';
  end if;
  perform private.check_reason(p_reason);
  update public.seller_profiles sp
  set declined_at = now(), staff_reason = p_reason
  where sp.account_id = p_account and sp.status = 'pending' and sp.declined_at is null
    and exists (select 1 from public.shops s where s.id = sp.shop_id and s.owner_id = sp.account_id)
  returning sp.shop_id into shop_ref;
  if shop_ref is null then
    return 'nothing';
  end if;
  select * into shop from public.shops s where s.id = shop_ref;
  perform private.record_audit('shop-declined', 'shop', shop.slug, shop.name, p_reason, shop.owner_id);
  perform private.notify(
    shop.owner_id, 'shop-update', shop.slug, private.shop_decision_note_text('declined', shop.name), '/sell'
  );
  return 'changed';
end;
$$;

-- --- set_shop_verified, replaced (from 20261020120300_staff_shop_actions.sql) -------------------------------------

-- Verify, or take Verified away, as before (verifySeller), except on the admin's own shop. A sample shop is nobody's.
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin). A null p_verified raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.set_shop_verified(p_shop uuid, p_verified boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shop public.shops;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop(p_shop) then
    return 'own-shop';
  end if;
  if p_verified is null then
    raise exception 'Verified is on or off' using errcode = 'invalid_parameter_value';
  end if;
  update public.shops s
  set verified = p_verified
  where s.id = p_shop and s.verified <> p_verified and private.shop_status(s.id) <> 'pending'
  returning s.* into shop;
  if shop.id is null then
    return 'nothing';
  end if;
  perform private.record_audit(
    case when p_verified then 'shop-verified' else 'shop-unverified' end, 'shop', shop.slug, shop.name, '', shop.owner_id
  );
  perform private.notify(
    shop.owner_id, 'shop-update', shop.slug,
    private.shop_decision_note_text(case when p_verified then 'verified' else 'unverified' end, shop.name), '/sell'
  );
  return 'changed';
end;
$$;

-- --- staff_pause_shop, replaced (from 20261020120300_staff_shop_actions.sql) --------------------------------------

-- The Hub's Pause shop, as before (pauseSeller and pauseReportedShop), except on the admin's own shop, refused before the
-- reason is checked and the seller profile is locked.
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin). A missing, long or unclean reason raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.staff_pause_shop(p_shop uuid, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  profile public.seller_profiles;
  shop public.shops;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop(p_shop) then
    return 'own-shop';
  end if;
  perform private.check_reason(p_reason);
  profile := private.lock_owned_shop(p_shop);
  if profile.account_id is null
    or not (profile.status = 'approved' or (profile.status = 'paused' and profile.paused_by is distinct from 'staff'))
  then
    return 'nothing';
  end if;
  update public.seller_profiles sp
  set status = 'paused', paused_by = 'staff', staff_reason = p_reason, seller_paused_too = (profile.status = 'paused')
  where sp.account_id = profile.account_id;
  select * into shop from public.shops s where s.id = p_shop;
  perform private.close_reports('seller', array[shop.slug], 'paused', p_reason);
  perform private.close_reports(
    'listing', array(select l.id from public.listings l where l.shop_id = p_shop), 'paused', p_reason
  );
  perform private.record_audit('shop-paused', 'shop', shop.slug, shop.name, p_reason, shop.owner_id);
  perform private.notify(
    shop.owner_id, 'shop-update', shop.slug, private.shop_decision_note_text('paused', shop.name), '/sell'
  );
  return 'changed';
end;
$$;

-- --- staff_resume_shop, replaced (from 20261020120300_staff_shop_actions.sql) -------------------------------------

-- The Hub's Resume, as before (resumeSeller), except on the admin's own shop.
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.staff_resume_shop(p_shop uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  profile public.seller_profiles;
  shop public.shops;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop(p_shop) then
    return 'own-shop';
  end if;
  profile := private.lock_owned_shop(p_shop);
  if profile.account_id is null or profile.status <> 'paused' or profile.paused_by <> 'staff' then
    return 'nothing';
  end if;
  update public.seller_profiles sp
  set status = case when profile.seller_paused_too then 'paused' else 'approved' end,
    paused_by = case when profile.seller_paused_too then 'seller' end,
    staff_reason = null,
    seller_paused_too = false
  where sp.account_id = profile.account_id;
  select * into shop from public.shops s where s.id = p_shop;
  perform private.record_audit('shop-resumed', 'shop', shop.slug, shop.name, '', shop.owner_id);
  perform private.notify(
    shop.owner_id, 'shop-update', shop.slug,
    private.shop_decision_note_text(case when profile.seller_paused_too then 'lifted' else 'resumed' end, shop.name),
    '/sell'
  );
  return 'changed';
end;
$$;

-- --- set_shop_mentor, replaced (from 20261020121100_audit_related_account.sql) ------------------------------------

-- A shop's mentor, as before (assignMentor), except for the admin's own shop, refused before the mentor's profile and the
-- seller profile are locked.
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.set_shop_mentor(p_shop uuid, p_mentor uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  profile public.seller_profiles;
  shop public.shops;
  mentor_name text;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop(p_shop) then
    return 'own-shop';
  end if;
  if p_mentor is not null then
    select p.first_name into mentor_name from public.profiles p where p.id = p_mentor and 'mentor' = any (p.roles)
    for share;
  end if;
  profile := private.lock_owned_shop(p_shop);
  if profile.account_id is null or profile.status = 'pending' then
    return 'nothing';
  end if;
  if p_mentor is not null then
    if mentor_name is null or p_mentor = profile.account_id then
      return 'nothing';
    end if;
  end if;
  if profile.mentor_id is not distinct from p_mentor then
    return 'nothing';
  end if;
  update public.seller_profiles sp set mentor_id = p_mentor where sp.account_id = profile.account_id;
  select * into shop from public.shops s where s.id = p_shop;
  perform private.record_audit(
    case when p_mentor is null then 'mentor-removed' else 'mentor-assigned' end, 'shop', shop.slug, shop.name,
    coalesce(mentor_name, ''), shop.owner_id, p_mentor
  );
  return 'changed';
end;
$$;

-- --- dismiss_report, replaced (from 20261020120300_staff_shop_actions.sql) ----------------------------------------

-- Dismiss, as before (dismissReport), except a report about the admin's own shop, a listing of it or their own request
-- (the report's own, private.report_own_kind: whose it is now, or whose it was once it has gone), refused before the
-- note is checked.
-- Returns 'changed' | 'nothing' | 'own-shop' | 'own-request' | 'forbidden' (admin). A missing, long or unclean note raises
-- check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.dismiss_report(p_report uuid, p_note text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  report public.reports;
  own text;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the note and every read for writing.
  own := private.report_own_kind(p_report, (select auth.uid()));
  if own = 'request' then
    return 'own-request';
  elsif own is not null then
    return 'own-shop';
  end if;
  perform private.check_reason(p_note);
  update public.reports r
  set status = 'closed', outcome = 'dismissed', note = p_note, closed_at = now(), closed_by = (select auth.uid())
  where r.id = p_report and r.status = 'open'
  returning r.* into report;
  if report.id is null then
    return 'nothing';
  end if;
  perform private.record_audit(
    'report-dismissed', 'report', report.id::text, report.target_title, p_note, report.reporter_id
  );
  perform private.notify(
    report.reporter_id, 'report-handled', report.id::text,
    private.report_outcome_note_text('dismissed', report.target_title), '/account/privacy#account-privacy-reports-title'
  );
  return 'changed';
end;
$$;

-- --- hide_listing, replaced (from 20261020120400_staff_tools_actions.sql) -----------------------------------------

-- Hide the listing, as before (hideReportedListing), except a listing of the admin's own shop, refused before the reason
-- is checked and the listing is locked.
-- Returns 'changed' | 'nothing' (no such listing, or hidden already) | 'no-open-report' | 'own-shop' | 'forbidden' (admin). A
-- missing, long or unclean reason raises check_violation.
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
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop((select l.shop_id from public.listings l where l.id = p_listing)) then
    return 'own-shop';
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

-- --- hide_request, replaced (from 20261020120400_staff_tools_actions.sql) -----------------------------------------

-- Hide the request, as before (hideReportedRequest), except the admin's own request, refused before the reason is
-- checked and the request is locked.
-- Returns 'changed' | 'nothing' (no such request, or hidden already) | 'no-open-report' | 'own-request' | 'forbidden' (admin).
-- A missing, long or unclean reason raises check_violation.
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
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_my_request(p_request) then
    return 'own-request';
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

-- --- show_listing, replaced (from 20261020120300_staff_shop_actions.sql) ------------------------------------------

-- Show the listing again, as before (showListingAgain), except a listing of the admin's own shop.
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.show_listing(p_listing text)
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
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop((select l.shop_id from public.listings l where l.id = p_listing)) then
    return 'own-shop';
  end if;
  update public.listings l
  set hidden_at = null, hidden_reason = null
  where l.id = p_listing and l.hidden_at is not null
  returning l.* into listing;
  if listing.id is null then
    return 'nothing';
  end if;
  owner := (select s.owner_id from public.shops s where s.id = listing.shop_id);
  perform private.record_audit('listing-shown', 'listing', listing.id, listing.title, '', owner);
  perform private.notify(
    owner, 'shop-update', listing.id, private.listing_shown_note_text(listing.title),
    private.my_listings_path(listing.state)
  );
  return 'changed';
end;
$$;

-- --- show_request, replaced (from 20261020120300_staff_shop_actions.sql) ------------------------------------------

-- Show the request again, as before (showRequestAgain), except the admin's own request.
-- Returns 'changed' | 'nothing' | 'own-request' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.show_request(p_request text)
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
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_my_request(p_request) then
    return 'own-request';
  end if;
  update public.requests q
  set hidden_at = null, hidden_reason = null, updated_at = now()
  where q.id = p_request and q.hidden_at is not null
  returning q.* into request;
  if request.id is null then
    return 'nothing';
  end if;
  perform private.record_audit('request-shown', 'request', request.id, request.title, '', request.asker_id);
  perform private.notify(
    request.asker_id, 'request-update', request.id, private.request_shown_note_text(request.title), '/account/requests'
  );
  return 'changed';
end;
$$;

-- --- pin_shop, replaced (from 20261020120400_staff_tools_actions.sql) ---------------------------------------------

-- Pin a shop to a campus's Featured row, as before (pinSeller), except the admin's own shop. The gate comes after the two
-- argument errors (no such campus, no day), which still raise, and before day-past, day-far and the eligibility read
-- (amendment 7).
-- Returns 'changed' | 'not-eligible' | 'taken' | 'full' | 'day-past' | 'day-far' | 'own-shop' | 'forbidden' (admin). A campus
-- that isn't one raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.pin_shop(p_shop uuid, p_campus text, p_day date)
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
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), after the argument errors, before the day and every read (amendment 7).
  if private.is_own_shop(p_shop) then
    return 'own-shop';
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

-- --- unpin_shop, replaced (from 20261020120400_staff_tools_actions.sql) -------------------------------------------

-- Take a pin away, as before (unpinSeller), except a pin on the admin's own shop (whose shop the pin is for, before it's
-- removed).
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.unpin_shop(p_pin uuid)
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
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop((select f.shop_id from public.featured_pins f where f.id = p_pin)) then
    return 'own-shop';
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
