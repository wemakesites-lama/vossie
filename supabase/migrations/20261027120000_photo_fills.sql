-- Photo-to-listing's daily count (photo-to-listing spec decision 12; plan Task 6, change 5).
-- - private.photo_fills: presses per account per UTC hour, like private.code_sends. Rows older than 24 hours are
--   deleted by the next press; the rest go with the profile (on delete cascade). Not in the data download: a counter.
--   Row level security on with no policy, and no grants to anon or authenticated: deny everyone but the service role.
-- - public.reserve_photo_fill: counts one press and says yes while under the limit in the last 24 hours (to the hour),
--   else counts nothing. An advisory lock per account makes two presses at once count one after the other.
--   The server's only (the service role); the account id comes from the session in the action.

create table private.photo_fills (
  account_id uuid not null references public.profiles (id) on delete cascade,
  hour timestamptz not null,
  n int not null check (n >= 1),
  primary key (account_id, hour)
);

alter table private.photo_fills enable row level security;
revoke all on table private.photo_fills from public, anon, authenticated;
grant all on table private.photo_fills to service_role;

create function private.reserve_photo_fill(p_account uuid, filled_at timestamptz, max_fills int)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  used int;
begin
  if p_account is null or max_fills is null or max_fills < 1 then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('photo_fill:' || p_account::text));
  delete from private.photo_fills
  where account_id = p_account and hour <= pg_catalog.date_trunc('hour', filled_at - interval '24 hours', 'UTC');
  select coalesce(sum(n), 0) into used from private.photo_fills where account_id = p_account;
  if used >= max_fills then
    return false;
  end if;
  insert into private.photo_fills as f (account_id, hour, n)
  values (p_account, pg_catalog.date_trunc('hour', filled_at, 'UTC'), 1)
  on conflict on constraint photo_fills_pkey do update set n = f.n + 1;
  return true;
end;
$$;

revoke all on function private.reserve_photo_fill(uuid, timestamptz, int) from public, anon, authenticated, service_role;

-- The reservation for the admin client, on the database's clock. Server only: the service role.
create function public.reserve_photo_fill(p_account_id uuid, p_max_fills integer)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reserve_photo_fill(p_account_id, now(), p_max_fills);
$$;

revoke all on function public.reserve_photo_fill(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_photo_fill(uuid, integer) to service_role;
