-- Supabase phase B, review fixes 1 and 2 (docs/superpowers/plans/2026-10-21-supabase-phase-b-sign-in.md, "Review fixes
-- (phase B code review)"): Auth's database audit log keeps no deleted account's address and nothing older than 30 days,
-- and one network gets at most 15 sign-in codes an hour.

-- --- 1. Auth's audit log (POPIA) ------------------------------------------------------------------------------------

-- Auth writes auth.audit_log_entries for each sign-in, code request, refresh and user change: the address (actor_username,
-- or traits.user_email for the service role's actions), the Auth user's id and the IP address. Deleting an account
-- leaves them behind. This deletes every entry older than 30 days, and at once every entry that names an Auth user who
-- no longer exists, as the actor or in traits.user_id, whatever its age: so a deletion (account deletion, or
-- sweep_unfinished_users) leaves no address behind by the next nightly run. An entry whose actor is the service role
-- (the nil id, never a user) and that names nobody in traits keeps its 30 days. Ids are compared as text, so a malformed
-- one can't fail the sweep. The runbook turns the database audit log off on the live project (B5, a hard gate); this is
-- the backstop. Run by the job only, as the database's owner, which may delete from Auth's table (as
-- sweep_idle_sessions and sweep_unfinished_users do): no API role can run it. Returns how many entries went.
create function private.sweep_auth_audit_log()
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  n integer;
begin
  delete from auth.audit_log_entries e
  where e.created_at < now() - interval '30 days'
     or (
       e.payload ->> 'actor_id' is not null
       and e.payload ->> 'actor_id' <> '00000000-0000-0000-0000-000000000000'
       and not exists (select 1 from auth.users u where u.id::text = e.payload ->> 'actor_id')
     )
     or (
       e.payload -> 'traits' ->> 'user_id' is not null
       and not exists (select 1 from auth.users u where u.id::text = e.payload -> 'traits' ->> 'user_id')
     );
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function private.sweep_auth_audit_log() from public, anon, authenticated, service_role;

-- Removed if it exists and made again, so running this twice leaves one. Nightly at 01:10 UTC (03:10 SAST), after
-- sweep-unfinished-users (01:00) has removed the Auth users who never finished signing in.
select cron.unschedule(j.jobname) from cron.job j where j.jobname = 'sweep-auth-audit-log';
select cron.schedule('sweep-auth-audit-log', '10 1 * * *', 'select private.sweep_auth_audit_log()');

-- --- 2. Codes per network -------------------------------------------------------------------------------------------

-- Codes sent per network per UTC hour: 15 an hour (IP_SENDS_PER_HOUR, lib/auth/config.ts), so one visitor can't use up
-- the project's hourly emails across many addresses. The key is an HMAC of the IP address (lib/auth/secrets.ts, its
-- `ip:` purpose), never the address. Swept hourly with the per-email counts.
create table private.ip_code_sends (
  ip_key text not null check (char_length(ip_key) between 1 and 128),
  hour timestamptz not null,
  n int not null check (n >= 1),
  primary key (ip_key, hour)
);
create index ip_code_sends_hour_idx on private.ip_code_sends (hour);
alter table private.ip_code_sends enable row level security;
revoke all on table private.ip_code_sends from public, anon, authenticated;
grant all on table private.ip_code_sends to service_role;

-- Reserves one of a network's codes for the hour: true while under the limit, false once it's reached (nothing counted
-- then). Atomic as one statement, as reserve_code_send: INSERT … ON CONFLICT DO UPDATE locks the (key, hour) row, and a
-- second post waits for it and re-checks `n < limit` against the row as the first left it. Hours are UTC hours.
create function private.reserve_ip_code_send(ip_key text, sent_at timestamptz, max_sends int)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  counted int;
begin
  if max_sends is null or max_sends < 1 or coalesce(ip_key, '') = '' then
    return false;
  end if;
  insert into private.ip_code_sends as c (ip_key, hour, n)
  values (ip_key, pg_catalog.date_trunc('hour', sent_at, 'UTC'), 1)
  on conflict on constraint ip_code_sends_pkey do update set n = c.n + 1 where c.n < max_sends
  returning c.n into counted;
  return counted is not null;
end;
$$;
revoke all on function private.reserve_ip_code_send(text, timestamptz, int) from public, anon, authenticated, service_role;

-- The per-network reservation for the admin client, in the current UTC hour. Server only: the service role.
create function public.reserve_ip_code_send(p_ip_key text, p_max_sends integer default 15)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reserve_ip_code_send(p_ip_key, now(), p_max_sends);
$$;
revoke all on function public.reserve_ip_code_send(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_ip_code_send(text, integer) to service_role;

-- The hourly sweep (sweep-sign-in) as before, and past hours' per-network counts too.
create or replace function private.sweep_sign_in()
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  attempts integer;
  sends integer;
  ip_sends integer;
  forms integer;
begin
  delete from private.sign_in_attempts where expires_at <= now();
  get diagnostics attempts = row_count;
  delete from private.code_sends where hour < date_trunc('hour', now(), 'UTC');
  get diagnostics sends = row_count;
  delete from private.ip_code_sends where hour < date_trunc('hour', now(), 'UTC');
  get diagnostics ip_sends = row_count;
  delete from public.form_states where expires_at <= now();
  get diagnostics forms = row_count;
  return attempts + sends + ip_sends + forms;
end;
$$;
