-- Snap to search's daily count (AI features spec 5.4; stage D plan Task 4): 30 photo searches per account a day.
-- The same shape as photo-to-listing's count (20261027120000_photo_fills.sql), kept apart so one feature can't use up
-- the other's allowance.
-- - private.photo_searches: searches per account per UTC hour, like private.photo_fills. Rows older than 24 hours are
--   deleted by the next search; the rest go with the profile (on delete cascade). Not in the data download: a counter.
--   Row level security on with no policy, and no grants to anon or authenticated: deny everyone but the service role.
--   The photo itself is never stored (spec 5.1): only this count is.
-- - public.reserve_photo_search: counts one search and says yes while under the limit in the last 24 hours (to the
--   hour), else counts nothing. An advisory lock per account makes two searches at once count one after the other.
--   The server's only (the service role); the account id comes from the session in the action.

create table private.photo_searches (
  account_id uuid not null references public.profiles (id) on delete cascade,
  hour timestamptz not null,
  n int not null check (n >= 1),
  primary key (account_id, hour)
);

alter table private.photo_searches enable row level security;
revoke all on table private.photo_searches from public, anon, authenticated;
grant all on table private.photo_searches to service_role;

create function private.reserve_photo_search(p_account uuid, searched_at timestamptz, max_searches int)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  used int;
begin
  if p_account is null or max_searches is null or max_searches < 1 then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('photo_search:' || p_account::text));
  delete from private.photo_searches
  where account_id = p_account and hour <= pg_catalog.date_trunc('hour', searched_at - interval '24 hours', 'UTC');
  select coalesce(sum(n), 0) into used from private.photo_searches where account_id = p_account;
  if used >= max_searches then
    return false;
  end if;
  insert into private.photo_searches as f (account_id, hour, n)
  values (p_account, pg_catalog.date_trunc('hour', searched_at, 'UTC'), 1)
  on conflict on constraint photo_searches_pkey do update set n = f.n + 1;
  return true;
end;
$$;

revoke all on function private.reserve_photo_search(uuid, timestamptz, int) from public, anon, authenticated, service_role;

-- The reservation for the admin client, on the database's clock. Server only: the service role.
create function public.reserve_photo_search(p_account_id uuid, p_max_searches integer)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reserve_photo_search(p_account_id, now(), p_max_searches);
$$;

revoke all on function public.reserve_photo_search(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_photo_search(uuid, integer) to service_role;
