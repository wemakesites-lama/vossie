-- Shop coach, stage I1 (AI round two spec 2 and 4; plan 2026-11-04-ai-stage-i1-shop-coach-core.md, Task 5).
-- 1. public.coach_weeks: one row per shop per SAST week (its Monday): up to three actions (jsonb, checked by the app's
--    asCoachActions on read), the mentor's two questions (stage I2; staff only), who wrote it ('model' or 'fixed'), and,
--    once settled, the ids done and gone (planning decision 10). Deleting the shop deletes its weeks.
-- 2. public.coach_ticks: the seller's ticks, per week and action id; deleting the week deletes them.
-- 3. Row level security on, no grants to anon or authenticated, so no API role reads either table directly. Reads go
--    through public.own_coach_weeks (the owner; never the mentor questions) and public.staff_coach_weeks
--    (private.can_mentor's rule; read from stage I2). The service role writes weeks; a tick is
--    public.tick_coach_action, with the seller's own session, owner-gated (planning decision 13).
-- The owner is found through seller_profiles.shop_id (one shop per account, unique), as private.owns_shop does.

create table public.coach_weeks (
  shop_id uuid not null references public.shops (id) on delete cascade,
  week date not null check (extract(isodow from week) = 1),
  actions jsonb not null check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) <= 3),
  mentor_questions jsonb check (
    mentor_questions is null or (
      jsonb_typeof(mentor_questions) = 'array'
      and jsonb_array_length(mentor_questions) = 2
      and jsonb_typeof(mentor_questions -> 0) = 'string'
      and jsonb_typeof(mentor_questions -> 1) = 'string'
      and char_length(mentor_questions ->> 0) between 1 and 140
      and char_length(mentor_questions ->> 1) between 1 and 140
    )
  ),
  written_by text not null check (written_by in ('model', 'fixed')),
  done_ids text[],
  gone_ids text[],
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (shop_id, week),
  constraint coach_weeks_settled check ((done_ids is null) = (settled_at is null) and (gone_ids is null) = (settled_at is null))
);
create index coach_weeks_week_idx on public.coach_weeks (week);

create table public.coach_ticks (
  shop_id uuid not null,
  week date not null,
  action_id text not null check (char_length(action_id) between 3 and 120),
  created_at timestamptz not null default now(),
  primary key (shop_id, week, action_id),
  foreign key (shop_id, week) references public.coach_weeks (shop_id, week) on delete cascade
);

alter table public.coach_weeks enable row level security;
alter table public.coach_ticks enable row level security;
revoke all on table public.coach_weeks, public.coach_ticks from public, anon, authenticated, service_role;
grant all on table public.coach_weeks, public.coach_ticks to service_role;
-- No policies: no grants to anon or authenticated (the advisor's INFO finding 0008, rls_enabled_no_policy, lists both
-- on purpose, as featured_draws).

-- The SAST Monday of a time (Africa/Johannesburg, no daylight saving).
create function private.coach_week_of(at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('week', (at at time zone 'Africa/Johannesburg'))::date;
$$;

-- The signed-in owner's weeks from p_since on, newest first, with that week's ticks. Never the mentor questions.
-- A user read (advisor 0029 lists it on purpose).
create function public.own_coach_weeks(p_since date)
returns table (
  week date, actions jsonb, written_by text, done_ids text[], gone_ids text[], settled_at timestamptz,
  created_at timestamptz, ticks text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.week, w.actions, w.written_by, w.done_ids, w.gone_ids, w.settled_at, w.created_at,
    coalesce((select array_agg(t.action_id order by t.action_id) from public.coach_ticks t
      where t.shop_id = w.shop_id and t.week = w.week), '{}')
  from public.coach_weeks w
  where w.shop_id = (select sp.shop_id from public.seller_profiles sp where sp.account_id = (select auth.uid()))
    and w.week >= coalesce(p_since, '-infinity'::date)
  order by w.week desc;
$$;

-- A shop's weeks from p_since on, for its mentor (still holding the role) or an admin, never its owner
-- (private.can_mentor), with the mentor questions and the ticks. Read from stage I2's mentor page.
create function public.staff_coach_weeks(p_shop uuid, p_since date)
returns table (
  week date, actions jsonb, mentor_questions jsonb, written_by text, done_ids text[], gone_ids text[],
  settled_at timestamptz, created_at timestamptz, ticks text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.week, w.actions, w.mentor_questions, w.written_by, w.done_ids, w.gone_ids, w.settled_at, w.created_at,
    coalesce((select array_agg(t.action_id order by t.action_id) from public.coach_ticks t
      where t.shop_id = w.shop_id and t.week = w.week), '{}')
  from public.coach_weeks w
  join public.shops s on s.id = w.shop_id
  where w.shop_id = p_shop and w.week >= coalesce(p_since, '-infinity'::date)
    and private.can_mentor(s.owner_id)
  order by w.week desc;
$$;

-- The signed-in seller ticks one of this SAST week's actions of a kind only the seller can tick (spec 2.1:
-- check-price's "Kept on purpose", read-tip). 'ticked', 'already', or 'not-found' (no shop, no week, no such action,
-- another kind). A user action.
create function public.tick_coach_action(p_action text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
  v_week date := private.coach_week_of(now());
begin
  select sp.shop_id into v_shop from public.seller_profiles sp where sp.account_id = (select auth.uid());
  if v_shop is null or p_action is null or p_action !~ '^(check-price|read-tip):' then
    return 'not-found';
  end if;
  if not exists (
    select 1 from public.coach_weeks w, jsonb_array_elements(w.actions) a(x)
    where w.shop_id = v_shop and w.week = v_week and a.x ->> 'id' = p_action
  ) then
    return 'not-found';
  end if;
  insert into public.coach_ticks (shop_id, week, action_id) values (v_shop, v_week, p_action)
  on conflict do nothing;
  return case when found then 'ticked' else 'already' end;
end;
$$;

revoke all on function private.coach_week_of(timestamptz) from public, anon, authenticated;
revoke all on function public.own_coach_weeks(date), public.staff_coach_weeks(uuid, date),
  public.tick_coach_action(text) from public, anon, authenticated;
grant execute on function public.own_coach_weeks(date), public.staff_coach_weeks(uuid, date),
  public.tick_coach_action(text) to authenticated, service_role;
