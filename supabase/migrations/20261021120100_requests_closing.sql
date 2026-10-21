-- Looking For requests close themselves (stage L): the schema (supabase step 2b plan, Task 2; decisions 1 and 5;
-- amendments 3 to 5).
--
-- The rule is closingDay in lib/looking-for/rules.ts, with NEEDED_BY_GRACE_DAYS (3) and IDLE_CLOSE_DAYS (30), from
-- stage L decisions 8 to 16 (docs/superpowers/specs/2026-10-20-housekeeping-design.md): a request with a needed-by date
-- counts as closed from 4 days after it (3 whole days of grace), one without from 30 days after the SAST day of its last
-- post, edit, reopen or Show again (updated_at). A sample (no asker) never closes itself. Stage M decisions 13 to 16
-- (REMINDER_DAYS_BEFORE, the one reminder) are the settle's, in the next migration; reminded_for is its mark.
--
-- - requests.closes_on is a stored generated column, so the board, the settle, the nightly job and the functions read
--   one rule. Changing the rule later means a new immutable function and a column swap: stored values recompute only
--   when a row is updated.
-- - requests.closed_by says who closed a closed asker's request: 'asker' (Close, set_request_open) or 'auto' (the
--   settle). Its check is one-way (amendment 3): a closed asker's request made before this column has none.
-- - requests.reminded_for is the closing day the asker was last reminded of (remindedFor), only on an asker's request.
-- - Grants: closes_on to anon and authenticated (it says when a request closes, never who asked); closed_by to
--   authenticated only, for Your requests ("closed automatically"); reminded_for to no API role.

-- closingDay (lib/looking-for/rules.ts): the first SAST day the request counts as closed. Immutable, for the column.
-- The SAST day is private.sast_day's own expression, written out: the service role, which writes requests directly, has
-- no usage on the private schema, so a call to private.sast_day by name inside this body would fail for it.
create function private.request_closing_day(asker uuid, needed date, updated timestamptz)
returns date language sql immutable set search_path = '' as $$
  select case
    when asker is null then null                     -- a sample never closes itself (stage L decision 9)
    when needed is not null then needed + 4          -- NEEDED_BY_GRACE_DAYS (3) whole days after, then closed
    else (updated at time zone 'Africa/Johannesburg')::date + 30  -- IDLE_CLOSE_DAYS after the last post, edit, reopen or Show again
  end;
$$;
revoke all on function private.request_closing_day(uuid, date, timestamptz) from public, anon, authenticated;
-- The service role writes requests directly (the contract tests' world, amendment 4): a generated column's function is
-- executed with the writer's rights, so it needs execute (the column refers to the function itself, not by name).
grant execute on function private.request_closing_day(uuid, date, timestamptz) to service_role;

alter table public.requests
  add column closed_by text check (closed_by in ('asker', 'auto')),
  add column reminded_for date,
  add column closes_on date generated always as (private.request_closing_day(asker_id, needed_by, updated_at)) stored;

-- Every asker's request closed before this migration was closed by its asker (nothing closed one automatically yet).
update public.requests set closed_by = 'asker' where status = 'closed' and asker_id is not null;  -- backfill first
alter table public.requests
  add constraint requests_closed_by_when_closed check (closed_by is null or (status = 'closed' and asker_id is not null)),  -- one-way (amendment 3)
  add constraint requests_reminded_for_askers check (reminded_for is null or asker_id is not null);

-- The settle's and the job's rows: open, shown, an asker's, by closing day.
create index requests_settle_idx on public.requests (closes_on) where status = 'open' and hidden_at is null and asker_id is not null;

grant select (closes_on) on table public.requests to anon, authenticated;
grant select (closed_by) on table public.requests to authenticated;

-- Your requests (listOwnRequests and getOwnRequest) with who closed each and its closing day, appended at the end
-- (CREATE OR REPLACE VIEW only appends). It replaces the view's options with the ones given, so security_invoker is
-- restated (amendment 5): the requests policies still apply.
create or replace view public.my_requests
with (security_invoker = true)
as
select
  r.id, r.title, r.category_slug, r.campus_slug, r.details, r.budget_zar, r.swap_welcome, r.needed_by, r.status,
  r.created_at, r.updated_at, r.closed_at, r.hidden_at, r.hidden_reason,
  case when r.hidden_at is not null then 'hidden' else r.status end as state,
  public.request_offer_count(r.id) as offers,
  r.closed_by, r.closes_on
from public.requests r
where private.is_my_request(r.id);
revoke all on table public.my_requests from public, anon, authenticated, service_role;
grant select on table public.my_requests to authenticated, service_role;
