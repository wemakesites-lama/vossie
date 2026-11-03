-- AI stage B, the listing check (AI features spec section 3, decision 96; plan 2026-11-04-ai-stage-b-listing-check.md).
-- 1. A report may have no reporter account: null is the listing check's, filed when a seller presses Publish anyway.
--    The reports policy reads by reporter_id = auth.uid(), so no student sees one; forget_account deletes by reporter,
--    so none is deleted with an account (its target_owner_id is cleared, as for any report).
-- 2. One open listing-check report per listing.
-- 3. private.close_reports, copied from 20261020120300_staff_shop_actions.sql, tells only a reporter who exists (the line
--    marked "stage B"). dismiss_report needs nothing: private.notify skips a null account.
-- 4. file_listing_check_report: the seller's own live listing only, the words written here (checkReportDetail in
--    lib/selling/listing-check.ts says the same; the contract test checks both).

alter table public.reports alter column reporter_id drop not null;

create unique index reports_one_open_check_per_listing on public.reports (target_kind, target_id)
  where reporter_id is null and status = 'open' and not target_gone;

create or replace function private.close_reports(p_kind text, p_target_ids text[], p_outcome text, p_note text)
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
  from closed c
  where c.reporter_id is not null;  -- stage B: the listing check's reports tell no one
$$;

create function public.file_listing_check_report(p_listing text, p_concern text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := private.require_profile();
  title text;
  words text;
  made uuid;
begin
  words := case p_concern
    when 'weapons' then 'weapons, or something made to hurt people'
    when 'alcohol-or-tobacco' then 'alcohol or tobacco sold to anyone under 18'
    when 'medicines' then 'medicines'
    when 'counterfeit' then 'counterfeit goods'
    when 'academic-dishonesty' then 'academic dishonesty'
    when 'stolen' then 'stolen goods'
    when 'illegal' then 'something that is against the law'
  end;
  if words is null then
    raise exception 'a listing check names one of the seven kinds' using errcode = 'invalid_parameter_value';
  end if;
  select l.title into title
  from public.listings l join public.shops s on s.id = l.shop_id
  where l.id = p_listing and s.owner_id = caller and l.state <> 'draft' and l.hidden_at is null;
  if title is null then
    return 'not-found';
  end if;
  insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, detail, target_owner_id)
  values (
    null, 'listing', p_listing, title, 'prohibited',
    'The listing check thought this may be ' || words || '. The seller published it anyway.', caller
  )
  on conflict (target_kind, target_id) where reporter_id is null and status = 'open' and not target_gone do nothing
  returning id into made;
  return case when made is null then 'already-open' else 'filed' end;
end;
$$;

revoke all on function public.file_listing_check_report(text, text) from public, anon;
grant execute on function public.file_listing_check_report(text, text) to authenticated, service_role;
