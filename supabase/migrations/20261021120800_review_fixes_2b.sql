-- The step 2b review's fixes (supabase step 2b plan, Task 9b; review of Tasks 0 to 9, 2026-10-21).
--
-- 1. private.report_own_kind took any account id and was executable by authenticated (the staff view, which is
--    security_invoker, calls it), so it answered "is this report about account X's own?" for any X it was handed. Only
--    the private schema's closed usage kept it from being called by name. It is replaced by a one-argument version that
--    reads the signed-in account itself (auth.uid()) and answers null unless that account is an admin
--    (private.is_staff('admin')), as the staff view's own only ever meant. public.staff_reports (still security_invoker,
--    amendment 5) and dismiss_report read it; the two-argument version is dropped.
-- 2. forget_account cleared the mentor of the seller profiles the deleted account mentors (locking them) before it
--    deleted that account's profile, the reverse of remove_role's order (the mentor's profile, then the seller profile)
--    and set_shop_mentor's. It now locks the account's own profile for update first, then takes the rest as before.
--
-- dismiss_report is copied from 20261021120500_own_target_gate.sql and forget_account from
-- 20261020121100_audit_related_account.sql, their latest definitions, with only the lines marked "2b review" changed.
-- Signatures and grants are unchanged (stated again at the end).

-- --- What of the signed-in admin's own a report is about -------------------------------------------------------------

-- toView's own (lib/data/staff-reports.ts:93-105), as 20261021120400_report_target_owner.sql's, kind by kind, for the
-- signed-in account only, and only for an admin (the report view is the admins'): null otherwise.
-- - whether the target exists: a shop report that isn't target_gone and a shop with that link; a listing report that
--   isn't target_gone and that listing (a hidden one included); a request report and that request;
-- - while it exists, whose it is now (ownsTarget, lib/staff/own.ts); a sample (no owner) is nobody's;
-- - once it has gone, the owner the report recorded.
-- A shop report's kind is 'shop'. Runs as its owner, so it reads past RLS.
create function private.report_own_kind(p_report uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.is_staff('admin') then null
    when t.found then case when t.owner_now = (select auth.uid()) then t.kind end
    when r.target_owner_id = (select auth.uid()) then t.kind
  end
  from public.reports r
  cross join lateral (
    select
      case r.target_kind when 'seller' then 'shop' else r.target_kind end as kind,
      case r.target_kind
        when 'seller' then not r.target_gone and exists (select 1 from public.shops s where s.slug = r.target_id)
        when 'listing' then not r.target_gone and exists (select 1 from public.listings l where l.id = r.target_id)
        else exists (select 1 from public.requests q where q.id = r.target_id)
      end as found,
      case r.target_kind
        when 'seller' then (select s.owner_id from public.shops s where s.slug = r.target_id)
        when 'listing' then (
          select s.owner_id from public.listings l join public.shops s on s.id = l.shop_id where l.id = r.target_id
        )
        else (select q.asker_id from public.requests q where q.id = r.target_id)
      end as owner_now
  ) t
  where r.id = p_report;
$$;
-- The staff view is security_invoker, so its caller runs this (amendment 6). It answers only about the caller.
revoke all on function private.report_own_kind(uuid) from public, anon;
grant execute on function private.report_own_kind(uuid) to authenticated, service_role;

-- --- The staff view, reading it ---------------------------------------------------------------------------------------

-- As 20261021120400_report_target_owner.sql's, with own from the one-argument version. The with clause is restated
-- (amendment 5).
create or replace view public.staff_reports
with (security_invoker = true)
as
select
  r.id, r.reporter_id, r.target_kind, r.target_id, r.target_title, r.reason, r.detail, r.status, r.created_at,
  r.outcome, r.note, r.closed_at, r.closed_by, r.target_gone,
  private.report_own_kind(r.id) as own  -- 2b review
from private.staff_reports() r;

revoke all on table public.staff_reports from public, anon, authenticated, service_role;
grant select on table public.staff_reports to authenticated, service_role;

-- --- dismiss_report, replaced (from 20261021120500_own_target_gate.sql) ------------------------------------------------

-- Dismiss, as before (dismissReport), refusing a report about the admin's own shop, a listing of it or their own
-- request.
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
  own := private.report_own_kind(p_report);  -- 2b review: the one-argument version reads the session itself
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

-- --- forget_account, replaced (from 20261020121100_audit_related_account.sql) ----------------------------------------

-- As before (which see, and 20261020120900_forget_account.sql for the steps), except that it locks the account's own
-- profile first. Service role only.
create or replace function public.forget_account(p_account_id uuid)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- The label the app writes for someone who has gone (DELETED, lib/data/staff-privacy.ts:8).
  deleted constant text := 'Deleted account';
  address text := (select lower(u.email) from auth.users u where u.id = p_account_id);
  own_shops uuid[] := array(select s.id from public.shops s where s.owner_id = p_account_id);
  own_slugs text[] := array(select s.slug from public.shops s where s.owner_id = p_account_id);
  own_listings text[] := array(select l.id from public.listings l where l.shop_id = any (own_shops));
  -- Links to the shop's page and to its listings, as notifications write them.
  own_hrefs text[];
  as_buyer uuid[];
  as_seller uuid[];
  touched uuid[];
  gone_requests text[];
  gone_searches text[];
  gone_bookings text[];
  paths text[];
begin
  -- 2b review: the account's own profile first, for update, then the rest (the seller profiles it mentors among them),
  -- the order remove_role and set_shop_mentor take: a profile, then a seller profile. The profile is deleted last, as
  -- before; this only takes its lock at the start.
  perform 1 from public.profiles p where p.id = p_account_id for update;  -- 2b review
  own_hrefs := array(select '/sellers/' || slug from unnest(own_slugs) slug)
    || array(select '/listings/' || id from unnest(own_listings) id);

  -- 1. Messaging (forgetAccountInMessaging, lib/data/messages.ts:496).
  as_buyer := array(select c.id from public.conversations c where c.buyer_id = p_account_id order by c.id for update);
  as_seller := array(
    select c.id from public.conversations c
    where c.shop_id = any (own_shops) and not c.seller_gone and c.buyer_id is distinct from p_account_id
    order by c.id
    for update
  );
  touched := as_buyer || as_seller;

  delete from public.messages m
  where (m.conversation_id = any (as_buyer) and m.side = 'buyer') or (m.conversation_id = any (as_seller) and m.side = 'seller');
  update public.messages set read_at = null where conversation_id = any (touched) and read_at is not null;
  update public.conversations set buyer_id = null where id = any (as_buyer);
  update public.conversations set seller_gone = true where id = any (as_seller);
  update public.conversations set status = 'replied', completed_at = null where id = any (touched) and status = 'done';
  delete from public.conversations c
  where c.id = any (touched)
    and ((c.buyer_id is null and c.seller_gone) or not exists (select 1 from public.messages m where m.conversation_id = c.id));
  delete from public.notifications where account_id = p_account_id or subject_id = any (touched::text[]);

  -- 2. Its reports (deleteReportsBy, lib/data/reports.ts:75).
  delete from public.reports where reporter_id = p_account_id;

  -- 3. Its requests (forgetRequestsOf), before the profile (Task 3), with the Hub's notifications about them.
  with gone as (delete from public.requests q where q.asker_id = p_account_id returning q.id)
  select coalesce(array_agg(gone.id), '{}') into gone_requests from gone;
  delete from public.notifications n where n.kind = 'request-update' and n.subject_id = any (gone_requests);

  -- 4. Its follows, every follow of its shop, and the followers' new-listing notifications about the shop
  --    (forgetFollowsOf).
  delete from public.follows f where f.account_id = p_account_id or f.shop_id = any (own_shops);
  delete from public.notifications n
  where n.kind = 'new-listing' and (n.subject_id = any (own_slugs) or n.href = any (own_hrefs));

  -- 5. Its saved searches and their search-match notifications (forgetSavedSearchesOf).
  with gone as (delete from public.saved_searches ss where ss.account_id = p_account_id returning ss.id)
  select coalesce(array_agg(gone.id), '{}') into gone_searches from gone;
  delete from public.notifications n where n.kind = 'search-match' and n.subject_id = any (gone_searches);

  -- 6. Its shop (forgetShopOf). Matches that lead to one of its listings would only lead to a 404 (search alerts plan
  --    amendment 11); reports about the shop or its listings now point at nothing (amendment 13.1). Then phase A's: the
  --    shop goes, and its listings, Featured pins (amendment 14.7) and old links with it; its draft; its photos.
  delete from public.notifications n where n.kind = 'search-match' and n.href = any (own_hrefs);
  update public.reports r
  set target_gone = true
  where not r.target_gone
    and ((r.target_kind = 'seller' and r.target_id = any (own_slugs))
      or (r.target_kind = 'listing' and r.target_id = any (own_listings)));

  paths := array(select p.path from public.photos p where p.owner_id = p_account_id order by p.path);
  delete from public.shops where owner_id = p_account_id;
  delete from public.onboarding_drafts where account_id = p_account_id;
  delete from public.photos where owner_id = p_account_id;

  -- 7. The staff tools (forgetAccountInStaffTools). The audit log keeps every entry (staff tools plan decision 6).
  --    An entry whose detail names it (a mentor-assigned entry's mentor) says "Deleted account" there instead; the
  --    detail is only the name. Before the entries about it, so one that is both ends with the detail ''.
  update public.audit_log a set related_id = null, detail = deleted where a.related_id = p_account_id;
  update public.audit_log a
  set staff_id = case when a.staff_id = p_account_id then null else a.staff_id end,
    staff_name = case when a.staff_id = p_account_id then deleted else a.staff_name end,
    subject_id = case when a.subject_id = p_account_id then null else a.subject_id end,
    target_id = case when a.subject_id = p_account_id then '' else a.target_id end,
    target_name = case when a.subject_id = p_account_id then deleted else a.target_name end,
    detail = case when a.subject_id = p_account_id then '' else a.detail end
  where a.staff_id = p_account_id or a.subject_id = p_account_id;
  delete from public.mentor_notes mn where mn.owner_id = p_account_id;
  update public.mentor_notes mn set author_id = null, author_name = deleted where mn.author_id = p_account_id;
  update public.seller_profiles sp set mentor_id = null where sp.mentor_id = p_account_id;
  delete from public.hub_rsvps hr where hr.account_id = p_account_id;
  with gone as (delete from public.hub_bookings hb where hb.account_id = p_account_id returning hb.id)
  select coalesce(array_agg(gone.id::text), '{}') into gone_bookings from gone;
  update public.hub_bookings hb set answered_by = null where hb.answered_by = p_account_id;
  delete from public.notifications n where n.kind = 'booking' and n.subject_id = any (gone_bookings);
  update public.hub_posts hp set author_id = null where hp.author_id = p_account_id;
  update public.featured_pins fp set pinned_by = null where fp.pinned_by = p_account_id;
  update public.reports r set closed_by = null where r.closed_by = p_account_id;

  -- 8. Its sign-in state.
  if address is not null then
    delete from private.sign_in_attempts where email = address;
    delete from private.code_sends where email = address;
  end if;

  -- 9. Its profile, last.
  delete from public.profiles where id = p_account_id;
  return paths;
end;
$$;

-- --- The two-argument version goes ------------------------------------------------------------------------------------

-- Nothing reads it now: the view and dismiss_report call the one-argument version (plpgsql resolves calls when it runs).
drop function private.report_own_kind(uuid, uuid);

-- Unchanged (create or replace keeps them; stated again so this file says who may run each).
revoke all on function public.dismiss_report(uuid, text) from public, anon;
grant execute on function public.dismiss_report(uuid, text) to authenticated, service_role;
revoke all on function public.forget_account(uuid) from public, anon, authenticated;
grant execute on function public.forget_account(uuid) to service_role;
