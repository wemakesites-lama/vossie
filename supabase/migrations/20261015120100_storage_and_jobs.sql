-- Photos' storage and the scheduled jobs (supabase foundation plan, Task 10; backend spec sections 6 and 7).

-- --- The photos bucket (spec 6) ---------------------------------------------------------------------------------------

-- One private bucket: files at {owner}/{photo id}, 5 MiB at most, JPEG, PNG and WebP only. Locally config.toml makes it
-- too; a remote project gets it from here, since config.toml's buckets reach a remote only through `supabase seed
-- buckets`. Whichever comes first, the other leaves it alone.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- No policies on storage.objects for anon or authenticated, on purpose: with row level security on and no policy,
-- neither can list, read, upload, move or delete a file. Only the admin client (the service role, which bypasses row
-- level security) reads and writes photos, and /photos/[id] hands them out (spec 6).

-- --- The jobs' work (spec 7) ------------------------------------------------------------------------------------------

-- Expired sign-in attempts, code counts from past hours, and expired form states. Returns how many rows went.
create function private.sweep_sign_in()
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  attempts integer;
  sends integer;
  forms integer;
begin
  delete from private.sign_in_attempts where expires_at <= now();
  get diagnostics attempts = row_count;
  delete from private.code_sends where hour < date_trunc('hour', now(), 'UTC');
  get diagnostics sends = row_count;
  delete from public.form_states where expires_at <= now();
  get diagnostics forms = row_count;
  return attempts + sends + forms;
end;
$$;

-- Auth users who never finished signing in (no profile; plan decision 1), once a day has passed since anything last
-- happened on the account: it was made, it signed in, or a code was sent to it (confirmation_sent_at for a new address,
-- recovery_sent_at for a sign-in code to a confirmed one). So a student who started yesterday and is on step 3 now
-- isn't removed mid-sign-in. Their profile never existed, so nothing else of theirs does. Returns how many went.
create function private.sweep_unfinished_users()
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  n integer;
begin
  delete from auth.users u
  where greatest(u.created_at, u.last_sign_in_at, u.confirmation_sent_at, u.recovery_sent_at) <= now() - interval '24 hours'
    and not exists (select 1 from public.profiles p where p.id = u.id);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- pg_cron's run history older than a week. Returns how many rows went.
create function private.sweep_cron_history()
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  n integer;
begin
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Only the jobs run these, as the database's owner.
revoke all on function private.sweep_sign_in(), private.sweep_unfinished_users(), private.sweep_cron_history()
  from public, anon, authenticated, service_role;

-- --- The schedule (UTC) -----------------------------------------------------------------------------------------------

-- Each job is removed if it exists and made again, so running this twice leaves one of each.
select cron.unschedule(j.jobname)
from cron.job j
where j.jobname in ('settle-sales', 'sweep-sign-in', 'sweep-unfinished-users', 'sweep-cron-history');

-- Hourly: sales done 7 days ago confirm themselves (spec 2.5). Pages also settle the reader's own (settle_sales).
select cron.schedule('settle-sales', '0 * * * *', 'select public.settle_auto_confirm()');
-- Hourly: expired sign-in attempts, code counts and form states.
select cron.schedule('sweep-sign-in', '15 * * * *', 'select private.sweep_sign_in()');
-- Daily at 01:00 UTC (03:00 SAST): Auth users who never finished signing in.
select cron.schedule('sweep-unfinished-users', '0 1 * * *', 'select private.sweep_unfinished_users()');
-- Daily: the jobs' own run history older than a week.
select cron.schedule('sweep-cron-history', '30 2 * * *', 'select private.sweep_cron_history()');
