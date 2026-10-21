-- Reports remember who owned their target (stage L spec decisions 1 and 2; supabase step 2b plan, Task 5, decision 6;
-- amendments 5 and 6).
--
-- - reports.target_owner_id: whose the reported listing's shop, shop or request was when it was reported
--   (ReportRow.targetOwnerId, lib/data/rows.ts:225; createReport, lib/data/reports.ts:29). Null for a sample. Cleared by
--   its foreign key when that account is deleted: forget_account deletes the profile last, so the key clears it there.
--   No API role reads it (the reports column grant, 20261020120000_widen.sql, names the columns a reporter reads).
-- - create_report (from 20261020120700_message_limits.sql) records it, with only that change, marked "stage L".
-- - private.report_own_kind(report, account): what of the account's own a report is about, 'shop', 'listing' or
--   'request', or null (toView's own, lib/data/staff-reports.ts:93-105): whose the target is now while it exists, and
--   the recorded owner once it has gone. Task 6's dismiss_report gate and the staff view read it.
-- - public.staff_reports gains own, for the signed-in admin.

-- --- The column -------------------------------------------------------------------------------------------------------

alter table public.reports add column target_owner_id uuid references public.profiles (id) on delete set null;
-- The index for the foreign key (advisor 0001), which account deletion's set null also reads.
create index reports_target_owner_id_idx on public.reports (target_owner_id);

-- The backfill: whose each target is now, for the reports whose target is still there. A report about a shop that has
-- gone (target_gone) or a listing or request already deleted has no owner left to read, and keeps null, as a report the
-- app made before stage L would.
update public.reports r set target_owner_id = s.owner_id
from public.shops s
where r.target_kind = 'seller' and not r.target_gone and s.slug = r.target_id and s.owner_id is not null;
update public.reports r set target_owner_id = s.owner_id
from public.listings l join public.shops s on s.id = l.shop_id
where r.target_kind = 'listing' and not r.target_gone and l.id = r.target_id and s.owner_id is not null;
update public.reports r set target_owner_id = q.asker_id
from public.requests q
where r.target_kind = 'request' and q.id = r.target_id and q.asker_id is not null;

-- --- create_report, replaced ------------------------------------------------------------------------------------------

-- Send report (spec 3.4), as message limits' (which see), except that it records whose the target is (stage L).
-- Returns 'created', 'already-open', 'rate-limited' or 'not-found', as before.
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
  owner uuid;
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

  title := case p_target_kind
    when 'listing' then (
      select l.title from public.listings l
      where l.id = p_target_id and l.state <> 'draft' and l.hidden_at is null and private.shop_is_public(l.shop_id)
    )
    when 'seller' then (select s.name from public.shops s where s.slug = p_target_id and private.shop_is_public(s.id))
    else (select q.title from public.requests q where q.id = p_target_id and q.hidden_at is null)
  end;
  if title is null then
    return 'not-found';
  end if;
  -- stage L: whose it is (createReport's targetOwnerId): the listing's shop's owner, the shop's, or the request's asker.
  owner := case p_target_kind
    when 'listing' then (
      select s.owner_id from public.listings l join public.shops s on s.id = l.shop_id where l.id = p_target_id
    )
    when 'seller' then (select s.owner_id from public.shops s where s.slug = p_target_id)
    else (select q.asker_id from public.requests q where q.id = p_target_id)
  end;
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
  insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, detail, target_owner_id)
  values (reporter, p_target_kind, p_target_id, title, p_reason, coalesce(p_detail, ''), owner)
  on conflict (reporter_id, target_kind, target_id) where status = 'open' and not target_gone do nothing
  returning id into made;
  return case when made is null then 'already-open' else 'created' end;
end;
$$;

-- --- What of an account's own a report is about -----------------------------------------------------------------------

-- toView's own (lib/data/staff-reports.ts:93-105), kind by kind:
-- - whether the target exists: a shop report that isn't target_gone and a shop with that link; a listing report that
--   isn't target_gone and that listing (a hidden one included); a request report and that request;
-- - while it exists, whose it is now (ownsTarget, lib/staff/own.ts: the shop's owner, the listing's shop's owner, the
--   request's asker); a sample (no owner) is nobody's;
-- - once it has gone, the owner the report recorded (a deleted target stays its reported owner's).
-- A shop report's kind is 'shop'. Runs as its owner, so it reads past RLS; no API role can call it by name (the private
-- schema isn't exposed), and the staff view passes only the signed-in account.
create function private.report_own_kind(p_report uuid, p_account uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_account is null then null
    when t.found then case when t.owner_now = p_account then t.kind end
    when r.target_owner_id = p_account then t.kind
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
-- The staff view is security_invoker, so its caller runs this (amendment 6), as private.staff_reports().
revoke all on function private.report_own_kind(uuid, uuid) from public, anon;
grant execute on function private.report_own_kind(uuid, uuid) to authenticated, service_role;

-- --- The staff view, with own -----------------------------------------------------------------------------------------

-- As the staff tables migration's, with own appended (CREATE OR REPLACE VIEW only appends). The with clause is restated:
-- without it the view would run as its owner and skip RLS (amendment 5). private.staff_reports() returns setof
-- reports, so it gains the column, but the view never shows it.
create or replace view public.staff_reports
with (security_invoker = true)
as
select
  r.id, r.reporter_id, r.target_kind, r.target_id, r.target_title, r.reason, r.detail, r.status, r.created_at,
  r.outcome, r.note, r.closed_at, r.closed_by, r.target_gone,
  private.report_own_kind(r.id, (select auth.uid())) as own
from private.staff_reports() r;

revoke all on table public.staff_reports from public, anon, authenticated, service_role;
grant select on table public.staff_reports to authenticated, service_role;
