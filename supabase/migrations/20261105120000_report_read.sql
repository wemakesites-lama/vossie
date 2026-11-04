-- AI stage C: a read of each report (AI features spec section 4, decision 96; plan 2026-11-05-ai-stage-c-report-read.md).
--
-- 1. reports.first_read: the model's first read, staff's only. Not in the reporters' column grant (20261020120000_widen.sql),
--    so a reporter never reads it; admins read it through public.staff_reports. Its shape is checked here too
--    (asFirstRead in lib/staff/report-read.ts says the same).
-- 2. public.save_report_first_read: stores a read on a student's report that has none. The service role only: the
--    after() callback runs for the reporter, and nobody signed in writes it (planning decision 6).
-- 3. Deleting the reported thing's owner strips the read (spec 4.4): the target_owner_id foreign key sets null, and a
--    trigger clears first_read with it. A reporter's own reports are already deleted by forget_account.

alter table public.reports add column first_read jsonb;

alter table public.reports add constraint reports_first_read_shape check (
  first_read is null or (
    jsonb_typeof(first_read) = 'object'
    and first_read - 'summary' - 'concern' - 'agrees' = '{}'::jsonb
    and jsonb_typeof(first_read -> 'summary') = 'string'
    and char_length(first_read ->> 'summary') between 1 and 140
    and jsonb_typeof(first_read -> 'concern') = 'string'
    and first_read ->> 'concern' in (
      'weapons', 'alcohol-or-tobacco', 'medicines', 'counterfeit', 'academic-dishonesty', 'stolen', 'illegal', 'none'
    )
    and jsonb_typeof(first_read -> 'agrees') = 'boolean'
  )
);

-- The staff view, as 20261021120800_review_fixes_2b.sql's, with first_read appended (CREATE OR REPLACE VIEW only
-- appends). The with clause is restated (amendment 5). private.staff_reports() returns setof reports, so it has the column.
create or replace view public.staff_reports
with (security_invoker = true)
as
select
  r.id, r.reporter_id, r.target_kind, r.target_id, r.target_title, r.reason, r.detail, r.status, r.created_at,
  r.outcome, r.note, r.closed_at, r.closed_by, r.target_gone,
  private.report_own_kind(r.id) as own,
  r.first_read  -- stage C
from private.staff_reports() r;

revoke all on table public.staff_reports from public, anon, authenticated, service_role;
grant select on table public.staff_reports to authenticated, service_role;

-- Returns 'saved' | 'already' | 'not-found'. A read of the wrong shape raises check_violation.
create function public.save_report_first_read(p_report uuid, p_read jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  found_report public.reports;
begin
  select * into found_report from public.reports r where r.id = p_report for update;
  if not found or found_report.reporter_id is null then
    return 'not-found';
  end if;
  if found_report.first_read is not null then
    return 'already';
  end if;
  update public.reports r set first_read = p_read where r.id = p_report;
  return 'saved';
end;
$$;

revoke all on function public.save_report_first_read(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_report_first_read(uuid, jsonb) to service_role;

create function private.forget_report_first_read()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.target_owner_id is not null and new.target_owner_id is null then
    new.first_read := null;
  end if;
  return new;
end;
$$;

revoke all on function private.forget_report_first_read() from public, anon, authenticated;

create trigger reports_forget_first_read
before update of target_owner_id on public.reports
for each row execute function private.forget_report_first_read();
