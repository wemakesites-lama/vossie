-- "Someone's looking for this" (AI round two spec 5; AI stage G plan 2026-11-04-ai-stage-g-looking-match.md, Task 3).
-- 1. requests.match_query: the search a request's own words were read into, a MatchQuery (lib/types.ts: q, category,
--    campus, price, pay, deals) whose q has words, or null. match_read_at: when it was read, with or without a search;
--    null until then, so the backfill knows what's left (planning decision 4). Only an asker's request has them.
--    Neither is in the column grants to anon or authenticated (20261020120200_community_tables.sql) nor in
--    request_cards or my_requests: only the service role reads them, to match a first publish and for the asker's
--    data download.
-- 2. public.save_request_match: the one writer, service role only. It never sets updated_at, so closes_on doesn't
--    move (stage L). There's no trigger on requests (checked 2026-11-04). A query needs a read; a read of false clears
--    both.

alter table public.requests
  add column match_query jsonb,
  add column match_read_at timestamptz,
  add constraint requests_match_query_shape check (
    match_query is null or (
      jsonb_typeof(match_query) = 'object'
      and match_query ?& array['q', 'category', 'campus', 'price', 'pay', 'deals']
      and (match_query - array['q', 'category', 'campus', 'price', 'pay', 'deals']) = '{}'::jsonb
      and jsonb_typeof(match_query -> 'q') = 'string'
      and char_length(match_query ->> 'q') between 1 and 100
      and jsonb_typeof(match_query -> 'campus') = 'string'
    )
  ),
  add constraint requests_match_query_read check (match_query is null or match_read_at is not null),
  add constraint requests_match_asker check (asker_id is not null or (match_query is null and match_read_at is null));

-- Matching a first publish: open, shown requests with a search at one campus.
create index requests_match_idx on public.requests (campus_slug)
  where status = 'open' and hidden_at is null and match_query is not null;
-- The backfill: open, shown asker requests not yet read, oldest first.
create index requests_match_unread_idx on public.requests (created_at)
  where status = 'open' and hidden_at is null and asker_id is not null and match_read_at is null;

create function public.save_request_match(p_request text, p_query jsonb, p_read boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_read is null or (not p_read and p_query is not null) then
    raise exception 'save_request_match: a search needs a read' using errcode = '22023';
  end if;
  update public.requests
  set match_query = p_query,
      match_read_at = case when p_read then now() else null end
  where id = p_request and asker_id is not null;
  return found;
end;
$$;

revoke all on function public.save_request_match(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_request_match(text, jsonb, boolean) to service_role;
