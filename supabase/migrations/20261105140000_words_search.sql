-- Search in your own words' site-wide daily cap (AI features spec 6.4; AI stage E plan decision 5).
-- - private.words_search_parses: new parses per SAST day, site-wide. No account and no words: a counter. Rows before
--   yesterday are deleted by the next reservation. Row level security on with no policy, and no grants to anon or
--   authenticated: deny everyone but the service role.
-- - public.reserve_words_search: takes one of today's parses while under the cap, else takes nothing. An advisory lock
--   makes two at once count one after the other. The server's only (the service role), on the database's clock.

create table private.words_search_parses (
  day date primary key,
  n int not null check (n >= 1)
);

alter table private.words_search_parses enable row level security;
revoke all on table private.words_search_parses from public, anon, authenticated;
grant all on table private.words_search_parses to service_role;

create function private.reserve_words_search(parsed_at timestamptz, max_parses int)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := (parsed_at at time zone 'Africa/Johannesburg')::date;
  used int;
begin
  if parsed_at is null or max_parses is null or max_parses < 1 then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('words_search'));
  delete from private.words_search_parses where day < today - 1;
  select n into used from private.words_search_parses where day = today;
  if coalesce(used, 0) >= max_parses then
    return false;
  end if;
  insert into private.words_search_parses as w (day, n) values (today, 1)
  on conflict (day) do update set n = w.n + 1;
  return true;
end;
$$;

revoke all on function private.reserve_words_search(timestamptz, int) from public, anon, authenticated, service_role;

-- The reservation for the admin client, on the database's clock. Server only: the service role.
create function public.reserve_words_search(p_max_parses integer)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reserve_words_search(now(), p_max_parses);
$$;

revoke all on function public.reserve_words_search(integer) from public, anon, authenticated;
grant execute on function public.reserve_words_search(integer) to service_role;
