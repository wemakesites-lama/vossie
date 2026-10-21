-- Supabase phase B, Task 2 (docs/superpowers/plans/2026-10-21-supabase-phase-b-sign-in.md): sign-in on Supabase Auth.
-- The attempt behind the vossie_signin cookie through the admin client, the sessions for the data download, the
-- sliding 30 days' idle sweep, and the first admin.

-- --- The attempt's errors (decision 6; amendment 18) ----------------------------------------------------------------

-- Supabase can refuse in ways sample mode never did: a code asked for within its minute (code-soon), a send that
-- failed (send-failed), the per-address limits (ip-rate) and a check of the code that failed (code-check-failed).
alter table private.sign_in_attempts drop constraint sign_in_attempts_errors_check;
alter table private.sign_in_attempts add constraint sign_in_attempts_errors_check check (errors <@ array[
  'email-missing', 'email-domain', 'email-rate', 'consent-missing', 'code-missing', 'code-wrong', 'code-expired',
  'code-rate', 'locked', 'first-name-missing', 'first-name-length', 'campus-missing', 'code-soon', 'send-failed',
  'ip-rate', 'code-check-failed'
]::text[]);

-- --- The attempt, for the admin client (decision 2) -----------------------------------------------------------------

-- The attempt with this key while it hasn't run out, as the app's SignInAttemptRow (camel case), or null. codeHash is
-- always null: Supabase Auth holds the code. Server only: the service role.
create function public.get_sign_in_attempt(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'key', a.key,
    'step', a.step,
    'email', a.email,
    'errors', pg_catalog.to_jsonb(a.errors),
    'resent', a.resent,
    'codeHash', null,
    'codeExpiresAt', a.code_expires_at,
    'wrongTries', a.wrong_tries,
    'consentedAt', a.consented_at,
    'firstName', a.first_name,
    'campusSlug', a.campus_slug,
    'postedAt', a.posted_at,
    'expiresAt', a.expires_at
  )
  from private.sign_in_attempts a
  where a.key = p_key and a.expires_at > now();
$$;

-- Saves an attempt, new or changed, from the app's SignInAttemptRow (codeHash ignored), with the table's own checks as
-- the backstop. An attempt meant to outlive its 30 minutes (ATTEMPT_TTL_MS, a minute's grace) is refused.
--
-- Every post saves the whole attempt, so a post that counted an early try could land after one that counted the fifth
-- and put the count back (amendment 2). So the count is never lowered, except by a newer code: only a send sets a later
-- codeExpiresAt, and a new code gives 5 fresh tries (accounts plan decision 6). A late save about an older code keeps
-- the newer code and its count. A lockout (back to step 1, "locked") sticks: no later save of that attempt changes it,
-- since signing in again starts a new attempt under a new key. Server only: the service role.
create function public.save_sign_in_attempt(p_attempt jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  wanted_expiry timestamptz;
begin
  if p_attempt is null or pg_catalog.jsonb_typeof(p_attempt) is distinct from 'object' or coalesce(p_attempt ->> 'key', '') = '' then
    raise exception 'an attempt needs a key' using errcode = 'invalid_parameter_value';
  end if;
  wanted_expiry := (p_attempt ->> 'expiresAt')::timestamptz;
  if wanted_expiry is null or wanted_expiry > now() + interval '31 minutes' then
    raise exception 'an attempt lasts at most 30 minutes' using errcode = 'invalid_parameter_value';
  end if;
  insert into private.sign_in_attempts as t (
    key, step, email, errors, resent, code_expires_at, wrong_tries, consented_at, first_name, campus_slug, posted_at,
    expires_at
  )
  values (
    p_attempt ->> 'key',
    coalesce(p_attempt ->> 'step', 'email'),
    coalesce(p_attempt ->> 'email', ''),
    coalesce(array(select pg_catalog.jsonb_array_elements_text(coalesce(p_attempt -> 'errors', '[]'::jsonb))), '{}'),
    coalesce((p_attempt ->> 'resent')::boolean, false),
    (p_attempt ->> 'codeExpiresAt')::timestamptz,
    coalesce((p_attempt ->> 'wrongTries')::int, 0),
    (p_attempt ->> 'consentedAt')::timestamptz,
    coalesce(p_attempt ->> 'firstName', ''),
    coalesce(p_attempt ->> 'campusSlug', ''),
    (p_attempt ->> 'postedAt')::timestamptz,
    wanted_expiry
  )
  on conflict (key) do update set
    step = excluded.step,
    email = excluded.email,
    errors = excluded.errors,
    resent = excluded.resent,
    code_expires_at = case
      when excluded.code_expires_at is not null and t.code_expires_at is not null and excluded.code_expires_at < t.code_expires_at
        then t.code_expires_at
      else excluded.code_expires_at
    end,
    wrong_tries = case
      -- A late save about an older code: the newer code's count stands.
      when excluded.code_expires_at is not null and t.code_expires_at is not null and excluded.code_expires_at < t.code_expires_at
        then t.wrong_tries
      -- A new code (a send): its 5 fresh tries.
      when excluded.code_expires_at is not null and (t.code_expires_at is null or excluded.code_expires_at > t.code_expires_at)
        then excluded.wrong_tries
      -- The same code, or none: never lowered.
      else greatest(t.wrong_tries, excluded.wrong_tries)
    end,
    consented_at = excluded.consented_at,
    first_name = excluded.first_name,
    campus_slug = excluded.campus_slug,
    posted_at = excluded.posted_at,
    expires_at = excluded.expires_at
  where not (t.step = 'email' and 'locked' = any (t.errors));
end;
$$;

-- Ends an attempt. Server only: the service role.
create function public.delete_sign_in_attempt(p_key text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from private.sign_in_attempts where key = p_key;
$$;

comment on function private.record_wrong_try(text) is
  'Counts every try on an attempt''s code, in one statement, before Supabase''s verifyOtp sees it (phase B decision 2): '
  'Supabase can''t compare a code without using it, so every try counts and the 5th wrong one ends the attempt.';

-- --- The sessions for the data download (decision 3) ----------------------------------------------------------------

-- When each of an account's Auth sessions started and when it ends: 30 days after its last refresh (the vossie_auth
-- cookie's lifetime and sweep_idle_sessions' window). Oldest first. No session id, IP address or device leaves it.
-- refreshed_at is a timestamp without time zone, in UTC. Server only: the service role.
create function public.account_sessions(p_account uuid)
returns table (signed_in_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.created_at,
         coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at) + interval '30 days'
  from auth.sessions s
  where s.user_id = p_account
  order by s.created_at, s.id;
$$;

revoke all on function public.get_sign_in_attempt(text), public.save_sign_in_attempt(jsonb),
  public.delete_sign_in_attempt(text), public.account_sessions(uuid)
  from public, anon, authenticated;
grant execute on function public.get_sign_in_attempt(text), public.save_sign_in_attempt(jsonb),
  public.delete_sign_in_attempt(text), public.account_sessions(uuid)
  to service_role;

-- --- The sliding 30 days (decision 3) -------------------------------------------------------------------------------

-- The Free plan has no inactivity timeout and refresh tokens never expire, so this ends Auth sessions not refreshed
-- for 30 days: a copied vossie_auth cookie can't be renewed after that. An access token already issued lasts at most
-- its hour. As sweep_unfinished_users does with auth.users, it writes Auth's own table from a job. Returns how many.
create function private.sweep_idle_sessions()
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  n integer;
begin
  -- refreshed_at is a timestamp without time zone, in UTC.
  delete from auth.sessions s
  where coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at) < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function private.sweep_idle_sessions() from public, anon, authenticated, service_role;

-- Removed if it exists and made again, so running this twice leaves one. Hourly, at 20 past.
select cron.unschedule(j.jobname) from cron.job j where j.jobname = 'sweep-idle-sessions';
select cron.schedule('sweep-idle-sessions', '20 * * * *', 'select private.sweep_idle_sessions()');

-- --- The first admin (decision 12) ----------------------------------------------------------------------------------

-- Run by hand in the SQL editor, as postgres, once: select private.make_first_admin('someone@vossie.net');
-- Returns 'made' | 'no-account' (no finished profile with that exact address) | 'admin-exists'. Every later role is
-- given in the app (give_role). The audit entry names no staff member: it was set up outside Vossie.
create function private.make_first_admin(p_email text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  wanted text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  target public.profiles;
begin
  lock table public.profiles in share row exclusive mode;
  if exists (select 1 from public.profiles p where 'admin' = any (p.roles)) then
    return 'admin-exists';
  end if;
  if wanted = '' then
    return 'no-account';
  end if;
  select p.* into target from public.profiles p join auth.users u on u.id = p.id where pg_catalog.lower(u.email) = wanted;
  if target.id is null then
    return 'no-account';
  end if;
  update public.profiles p
  set roles = array(
    select r.role from unnest(array['mentor', 'admin']) with ordinality as r(role, ord)
    where r.role = 'admin' or r.role = any (target.roles)
    order by r.ord
  )
  where p.id = target.id;
  insert into public.audit_log (staff_id, staff_name, action, target_kind, target_id, target_name, detail, subject_id)
  values (null, 'Set up outside Vossie', 'role-given', 'account', target.id::text, target.first_name, 'Admin', target.id);
  return 'made';
end;
$$;
revoke all on function private.make_first_admin(text) from public, anon, authenticated, service_role;
