-- The Hub's actions on shops, reports, listings and requests (supabase schema catch-up plan, Task 4; staff tools spec
-- 2.3, stage G; stage J spec decision 14's Show again): approve, decline, Verified, the Hub's pause and Resume, a
-- shop's mentor, Dismiss, Hide the listing or the request, and Show again; with the seller's Send for approval again.
--
-- - Plan decision 1: each staff action is a `public` function called with the staff member's own session (not the admin
--   client). It checks private.is_staff(area) first, inside the same transaction as the write, so an admin whose role
--   was just removed can't finish an action, and returns 'forbidden' otherwise. Then the write, then exactly one
--   audit_log row when something changed (recordAudit, lib/data/audit.ts, as lib/staff/admin-actions.ts fills it in:
--   the staff member's id and first name, the action, the target's kind, id and name, the reason or note, the student it
--   was about), then the notifications the action sends. Nothing changed: no audit row, nobody told.
-- - Results map onto the app's (lib/data/staff-shops.ts, staff-reports.ts, requests.ts return null for "nothing to do",
--   and the action then says "nothing"):
--     'changed'    it was done
--     'nothing'    there was nothing to do (nothingChanged in admin-actions.ts)
--     'forbidden'  the signed-in account isn't staff for the area (requireStaff's 404)
--   A reason or note the app should have checked first (checkReason, checkDismissNote: lib/staff/rules.ts) raises
--   check_violation, as phase A's functions do for values the app checks.
-- - Notification wording is built here, never passed in (the plan's note on Tasks 4 to 6): anyone signed in can call
--   these through the API, so a sentence taken as an argument could send any text to anyone. The private.*_note_text
--   functions mirror lib/staff/notification-text.ts and lib/looking-for/words.ts word for word, and their links mirror
--   the app's paths; 16_staff_shop_actions.test.sql compares them with strings printed from the TypeScript.
-- - A shop is named by its id (a new shop on an old link is another shop, amendment 14.6); approve and decline name the
--   waiting shop by its owner's account, as the plan's table does. Audit entries and notifications about a shop carry
--   its link (decision.slug in admin-actions.ts), as the app's do.
-- - Also here (moved from Task 1): reports_one_open_per_target leaves out reports about a shop that has gone, as the
--   app's duplicate check does (hasOpenReport, lib/data/reports.ts:54), and create_report is replaced to match.

-- --- One open report per target, unless the target has gone (hasOpenReport, reports.ts:54) -------------------------

-- An open report about a deleted shop doesn't block one about a new shop on the same link (amendment 13.1).
drop index public.reports_one_open_per_target;
create unique index reports_one_open_per_target on public.reports (reporter_id, target_kind, target_id)
  where status = 'open' and not target_gone;

-- Send report (spec 3.4, plan decision 17), as phase A's, except that a report about something that has gone doesn't
-- count as the account's open report on the target, and its ON CONFLICT names the new index's predicate exactly.
-- Returns:
--   'created'
--   'already-open'  the account has an open report on it: sendReport goes straight to the thank-you, storing nothing
--   'rate-limited'  the 11th in 24 hours: sendReport's "report-rate" error
--   'not-found'     no such public listing or shop, or a request id of the wrong shape: reportSubject's null
-- A request title that is empty, over 70 characters or not clean raises invalid_parameter_value.
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.create_report(
  p_target_kind text, p_target_id text, p_target_title text, p_reason text, p_detail text default ''
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reporter uuid := private.require_profile();
  title text;
  made uuid;
begin
  if p_target_kind is null or p_target_kind not in ('listing', 'seller', 'request') then
    raise exception 'a report is about a listing, a seller or a request' using errcode = 'invalid_parameter_value';
  end if;
  if p_reason is null or p_reason not in ('scam', 'prohibited', 'misleading', 'offensive', 'harassment', 'spam', 'other') then
    raise exception 'a report has one of the seven reasons' using errcode = 'check_violation';
  end if;
  if char_length(coalesce(p_detail, '')) > 500 then
    raise exception 'a report''s detail is at most 500 characters' using errcode = 'check_violation';
  end if;
  perform 1 from public.profiles p where p.id = reporter for update;

  if p_target_kind = 'request' then
    if p_target_id is null or p_target_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_target_id) > 20 then
      return 'not-found';
    end if;
    if p_target_title is null or char_length(btrim(p_target_title)) not between 1 and 70
      or not private.is_clean_line(btrim(p_target_title))
    then
      raise exception 'a request''s title is one clean line of 1 to 70 characters' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  title := case p_target_kind
    when 'listing' then (
      select l.title from public.listings l
      where l.id = p_target_id and l.state <> 'draft' and private.shop_is_public(l.shop_id)
    )
    when 'seller' then (select s.name from public.shops s where s.slug = p_target_id and private.shop_is_public(s.id))
    else nullif(btrim(p_target_title), '')
  end;
  if title is null then
    return 'not-found';
  end if;
  if exists (
    select 1 from public.reports r
    where r.reporter_id = reporter and r.target_kind = p_target_kind and r.target_id = p_target_id
      and r.status = 'open' and not r.target_gone
  ) then
    return 'already-open';
  end if;
  if (
    select count(*) from public.reports r where r.reporter_id = reporter and r.created_at > now() - interval '24 hours'
  ) >= 10 then
    return 'rate-limited';
  end if;
  insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, detail)
  values (reporter, p_target_kind, p_target_id, title, p_reason, coalesce(p_detail, ''))
  on conflict (reporter_id, target_kind, target_id) where status = 'open' and not target_gone do nothing
  returning id into made;
  return case when made is null then 'already-open' else 'created' end;
end;
$$;

-- --- The sentences (lib/staff/notification-text.ts; lib/looking-for/words.ts) -------------------------------------
-- The words are samples for Lama to change: change them in the TypeScript and here together (the test compares them).

-- Approval, with the "shop-approved" kind (shopApprovedText).
create function private.shop_approved_note_text(shop text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'The Hub approved ' || shop || '. You can publish your listings now.';
$$;

-- The Hub's other decisions about a shop, with the "shop-update" kind (shopDecisionText).
create function private.shop_decision_note_text(decision text, shop text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  case decision
    when 'declined' then return 'The Hub didn''t approve ' || shop || ' yet. See why, and send it again.';
    when 'paused' then return 'The Hub paused ' || shop || '. See why on your dashboard.';
    when 'resumed' then return 'The Hub resumed ' || shop || '. Buyers can see it again.';
    when 'lifted' then return 'The Hub lifted its pause on ' || shop
      || '. It''s still paused as you set it: resume it from Sell when you''re ready.';
    when 'verified' then return shop || ' is now Verified by the Hub.';
    when 'unverified' then return shop || ' is no longer Verified by the Hub.';
    else raise exception 'no sentence for the decision %', decision using errcode = 'invalid_parameter_value';
  end case;
end;
$$;

-- A hidden listing, with the "shop-update" kind (listingHiddenText).
create function private.listing_hidden_note_text(title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'The Hub hid ' || title || '. See why in My listings.';
$$;

-- A hidden listing shown again (listingShownText).
create function private.listing_shown_note_text(title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'The Hub is showing ' || title || ' again. It''s back in My listings.';
$$;

-- A report's outcome for its reporter, with the "report-handled" kind (reportOutcomeText).
create function private.report_outcome_note_text(outcome text, title text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  case outcome
    when 'acted' then return 'Thanks, we''ve acted on your report about ' || title || '.';
    when 'dismissed' then return 'We looked at your report about ' || title || ' and didn''t find a problem.';
    else raise exception 'no sentence for the outcome %', outcome using errcode = 'invalid_parameter_value';
  end case;
end;
$$;

-- The asker's notification when the Hub hides their request, with the "request-update" kind (requestHiddenText,
-- lib/looking-for/words.ts).
create function private.request_hidden_note_text(title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'The Hub hid your request ' || title || '. See why in Your requests.';
$$;

-- A hidden request shown again (requestShownText).
create function private.request_shown_note_text(title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'The Hub is showing your request ' || title || ' again.';
$$;

-- --- Links and shared steps (private) -------------------------------------------------------------------------------
-- The other links are the app's constants, written where they're used: SELL_PATH '/sell' (lib/selling/paths.ts),
-- YOUR_REQUESTS_PATH '/account/requests' (lib/looking-for/paths.ts) and REPORTS_MADE_PATH
-- '/account/privacy#account-privacy-reports-title' (admin-actions.ts:123).

-- My listings on a listing's tab (myListingsPath(tabFor(state)), lib/selling/paths.ts:44 and :48).
create function private.my_listings_path(state text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case state
    when 'available' then '/sell/listings'
    when 'paused' then '/sell/listings?tab=paused'
    when 'sold' then '/sell/listings?tab=sold'
    when 'draft' then '/sell/listings?tab=drafts'
  end;
$$;

-- A decline's, a hide's or a pause's reason, or a dismissal's note, as checkReason and checkDismissNote leave it
-- (lib/staff/rules.ts:26 and :31): 1 to REASON_MAX (500) characters of clean text with its line breaks. The app checks
-- first, so this refuses only what it would never send.
create function private.check_reason(reason text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if reason is null or char_length(reason) not between 1 and 500 or not private.is_clean_text(reason) then
    raise exception 'a reason or note is 1 to 500 characters of clean text' using errcode = 'check_violation';
  end if;
end;
$$;

-- The one audit entry of an action that changed something (recordAudit, lib/data/audit.ts): by the signed-in staff
-- member, with their first name now.
create function private.record_audit(
  action text, target_kind text, target_id text, target_name text, detail text, subject uuid
)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.audit_log (staff_id, staff_name, action, target_kind, target_id, target_name, detail, subject_id)
  select p.id, p.first_name, action, target_kind, target_id, target_name, coalesce(detail, ''), subject
  from public.profiles p
  where p.id = (select auth.uid());
$$;

-- A notification (notify, lib/data/notifications.ts). A sample shop or request has no account to tell, so a null
-- account makes none.
create function private.notify(account uuid, note_kind text, subject text, sentence text, link text)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.notifications (account_id, kind, subject_id, text, href)
  select account, note_kind, subject, sentence, link
  where account is not null;
$$;

-- Closes every open report on these targets with the Hub's outcome and reason, except reports about something that
-- has gone (closeReportsOn and closeReportsAboutShop, staff-reports.ts:157 and :180; amendments 13.1 and 14.2), and
-- tells each reporter the Hub acted, on privacy settings' "Reports you've made" (tellReporter, admin-actions.ts:126).
create function private.close_reports(p_kind text, p_target_ids text[], p_outcome text, p_note text)
returns void
language sql
volatile
set search_path = ''
as $$
  with closed as (
    update public.reports r
    set status = 'closed', outcome = p_outcome, note = p_note, closed_at = now(), closed_by = (select auth.uid())
    where r.status = 'open' and not r.target_gone and r.target_kind = p_kind and r.target_id = any (p_target_ids)
    returning r.id, r.reporter_id, r.target_title
  )
  insert into public.notifications (account_id, kind, subject_id, text, href)
  select c.reporter_id, 'report-handled', c.id::text, private.report_outcome_note_text('acted', c.target_title),
    '/account/privacy#account-privacy-reports-title'
  from closed c;
$$;

-- The seller profile of the shop with this id, locked, when an account owns the shop (owned, staff-shops.ts:104). A
-- sample shop has none.
create function private.lock_owned_shop(shop uuid)
returns public.seller_profiles
language sql
volatile
set search_path = ''
as $$
  select sp.*
  from public.seller_profiles sp
  join public.shops s on s.id = sp.shop_id and s.owner_id = sp.account_id
  where s.id = shop
  for update of sp;
$$;

-- --- Sellers (approveSeller to assignMentor, admin-actions.ts:137 to 290) ----------------------------------------

-- Approve (approveShop, staff-shops.ts:125): the account's waiting shop, not declined, opens; its first approval's time
-- is kept. The owner is told ("shop-approved", to /sell).
-- Returns 'changed' | 'nothing' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create function public.approve_shop(p_account uuid)
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

-- Decline (declineShop, staff-shops.ts:143; plan decision 2): the waiting shop stays waiting, with the decline and its
-- reason, which the seller reads on /sell. The owner is told without the reason ("shop-update").
-- Returns 'changed' | 'nothing' | 'forbidden' (admin). A missing, long or unclean reason raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create function public.decline_shop(p_account uuid, p_reason text)
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

-- The seller's Send for approval again (resendForApproval, staff-shops.ts:157): the decline and its reason are
-- forgotten and the shop waits again from now. The seller's own step: no audit entry, nobody told.
-- Returns 'changed' | 'nothing' (resendForApproval's false).
-- A user action (advisor 0029 lists it on purpose).
create function public.resend_for_approval()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
begin
  update public.seller_profiles sp
  set declined_at = null, staff_reason = null, applied_at = now()
  where sp.account_id = account and sp.status = 'pending' and sp.declined_at is not null;
  return case when found then 'changed' else 'nothing' end;
end;
$$;

-- Verify, or take Verified away (setVerified, staff-shops.ts:167): any shop with a storefront, sample shops included,
-- and only when it changes. The owner, if any, is told ("shop-update").
-- Returns 'changed' | 'nothing' | 'forbidden' (admin). A null p_verified raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create function public.set_shop_verified(p_shop uuid, p_verified boolean)
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

-- The Hub's Pause shop (staffPauseShop, staff-shops.ts:178; plan decision 3), from the shop's page or a report: an open
-- shop, or one its seller paused, whose pause is remembered under the Hub's (amendment 13.3). Every open report about
-- the shop or its listings closes as "paused" with the reason (closeReportsAboutShop, amendment 14.1). The owner is
-- told ("shop-update"), and so is each reporter ("report-handled": acted).
-- Returns 'changed' | 'nothing' | 'forbidden' (admin). A missing, long or unclean reason raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create function public.staff_pause_shop(p_shop uuid, p_reason text)
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

-- The Hub's Resume (staffResumeShop, staff-shops.ts:190): only its own pause. A seller's pause that was under it comes
-- back, so the owner hears the Hub "lifted" its pause; otherwise the shop opens and they hear it "resumed".
-- Returns 'changed' | 'nothing' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create function public.staff_resume_shop(p_shop uuid)
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

-- A shop's mentor (setShopMentor, staff-shops.ts:219; spec 2.6, plan decision 15): an account with the mentor role, or
-- none (null), never the shop's owner; only for an owned shop that isn't waiting; only when it changes. The audit
-- detail names the mentor ('' when removed). Nobody is told.
-- Returns 'changed' | 'nothing' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create function public.set_shop_mentor(p_shop uuid, p_mentor uuid)
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
  profile := private.lock_owned_shop(p_shop);
  if profile.account_id is null or profile.status = 'pending' then
    return 'nothing';
  end if;
  if p_mentor is not null then
    select p.first_name into mentor_name from public.profiles p where p.id = p_mentor and 'mentor' = any (p.roles);
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
    coalesce(mentor_name, ''), shop.owner_id
  );
  return 'changed';
end;
$$;

-- --- Reports, listings and requests (dismissReport to showRequestAgain, admin-actions.ts:294 to 672) --------------

-- Dismiss, with a note only staff read (closeReport, staff-reports.ts:143): this open report closes. Its reporter hears
-- the Hub didn't find a problem ("report-handled").
-- Returns 'changed' | 'nothing' | 'forbidden' (admin). A missing, long or unclean note raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create function public.dismiss_report(p_report uuid, p_note text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  report public.reports;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
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

-- Hide the listing (hideListing, staff-shops.ts:239; plan decisions 4 and 5): it leaves every list and its page, keeping
-- its state; the seller sees why in My listings. Every open report on it closes as "hidden" with the reason. The
-- seller is told ("shop-update", to the listing's tab), and so is each reporter ("report-handled": acted).
-- Returns 'changed' | 'nothing' | 'forbidden' (admin). A missing, long or unclean reason raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create function public.hide_listing(p_listing text, p_reason text)
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

-- Hide the request (hideRequest, requests.ts:181; community actions spec 2.14, plan decision 20): it leaves the board
-- and its page 404s, keeping open or closed. Every open report on it closes as "hidden" with the reason. The asker
-- (none for a sample) is told ("request-update", to Your requests), and so is each reporter.
-- Returns 'changed' | 'nothing' | 'forbidden' (admin). A missing, long or unclean reason raises check_violation.
-- A staff action (advisor 0029 lists it on purpose).
create function public.hide_request(p_request text, p_reason text)
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

-- Show the listing again (showListing, staff-shops.ts:258; stage J spec decision 14): its hide and reason are cleared,
-- its state kept. The reports that closed stay closed and their reporters aren't told again. The seller is told
-- ("shop-update", to the listing's tab).
-- Returns 'changed' | 'nothing' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create function public.show_listing(p_listing text)
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

-- Show the request again (showRequest, requests.ts:193): its hide and reason are cleared, open or closed as its asker
-- left it, updated now. The reports stay closed and their reporters aren't told. The asker is told ("request-update").
-- Returns 'changed' | 'nothing' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create function public.show_request(p_request text)
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

-- --- Grants ---------------------------------------------------------------------------------------------------------

-- The private helpers run only inside the functions above (as their owner).
revoke all on function
  private.shop_approved_note_text(text), private.shop_decision_note_text(text, text),
  private.listing_hidden_note_text(text), private.listing_shown_note_text(text),
  private.report_outcome_note_text(text, text), private.request_hidden_note_text(text),
  private.request_shown_note_text(text), private.my_listings_path(text), private.check_reason(text),
  private.record_audit(text, text, text, text, text, uuid), private.notify(uuid, text, text, text, text),
  private.close_reports(text, text[], text, text), private.lock_owned_shop(uuid)
from public, anon, authenticated, service_role;

-- Staff actions and the seller's resend: signed-in people (and the service role), never anon. Each staff action checks
-- the role itself; the service role has no session, so it gets 'forbidden' from them.
revoke all on function
  public.approve_shop(uuid), public.decline_shop(uuid, text), public.resend_for_approval(),
  public.set_shop_verified(uuid, boolean), public.staff_pause_shop(uuid, text), public.staff_resume_shop(uuid),
  public.set_shop_mentor(uuid, uuid), public.dismiss_report(uuid, text), public.hide_listing(text, text),
  public.hide_request(text, text), public.show_listing(text), public.show_request(text)
from public, anon;
grant execute on function
  public.approve_shop(uuid), public.decline_shop(uuid, text), public.resend_for_approval(),
  public.set_shop_verified(uuid, boolean), public.staff_pause_shop(uuid, text), public.staff_resume_shop(uuid),
  public.set_shop_mentor(uuid, uuid), public.dismiss_report(uuid, text), public.hide_listing(text, text),
  public.hide_request(text, text), public.show_listing(text), public.show_request(text)
to authenticated, service_role;
