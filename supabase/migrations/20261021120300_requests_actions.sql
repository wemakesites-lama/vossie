-- Looking For requests close themselves (stage L): the request functions follow the rule (supabase step 2b plan,
-- Task 4; decisions 3 and 4; amendment 18).
--
-- A request whose closing day (requests.closes_on, 20261021120100_requests_closing.sql) has come counts as closed
-- before the settle stores it, as the app sees it after its own settle (requestOpenOn, lib/looking-for/rules.ts):
-- - save_request (from 20261020120500_community_actions.sql) won't edit it (not-open) and leaves it out of the 5 open;
-- - set_request_open (from the same) won't close it by hand (nothing) and leaves it out of the reopen count. Close
--   records closed_by 'asker'. Reopen (setRequestOpen, lib/data/requests.ts) clears closed_by and closed_at, starts a
--   fresh 30 days (updated_at now) and clears a needed-by date before today in SAST, answering reopened-date-cleared
--   (the app's neededByCleared notice). Nothing clears reminded_for. A due request that hasn't been settled is still
--   open, so Reopen answers nothing: the app settles first (lib/looking-for/actions.ts), and so must C4's twin;
-- - start_offer (from 20261020120700_message_limits.sql) answers closed, in the same place as the status check.
-- Each is copied from its latest definition with only these changes, marked "stage L". Signatures, grants and the
-- asker's lock stay as they are.

-- --- save_request, replaced -------------------------------------------------------------------------------------------

-- Post request and Save changes, as community actions' (which see), except that a request past its closing day is not
-- open: it can't be edited (not-open) and doesn't count towards the 5 open (stage L).
-- Returns jsonb, as before.
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.save_request(
  p_id text, p_title text, p_category_slug text, p_campus_slug text, p_details text, p_budget_zar integer,
  p_swap_welcome boolean, p_needed_by date, p_once_token text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  asker uuid := private.require_profile();
  request public.requests;
  token text;
  today date := private.sast_day(now());  -- stage L
begin
  perform pg_advisory_xact_lock(hashtext('vossie:requests:' || asker::text), 0);
  if p_id is not null then
    update public.requests q
    set title = p_title, category_slug = p_category_slug, campus_slug = p_campus_slug, details = p_details,
      budget_zar = p_budget_zar, swap_welcome = coalesce(p_swap_welcome, false), needed_by = p_needed_by,
      updated_at = now()
    where q.id = p_id and q.asker_id = asker and q.status = 'open' and q.hidden_at is null
      and (q.closes_on is null or q.closes_on > today)  -- stage L: past its closing day, it counts as closed
    returning q.* into request;
    if request.id is null then
      return jsonb_build_object(
        'result',
        case when exists (select 1 from public.requests q where q.id = p_id and q.asker_id = asker)
          then 'not-open' else 'not-found' end
      );
    end if;
    return jsonb_build_object('result', 'saved', 'id', request.id);
  end if;

  if private.once_token_taken(p_once_token) then
    return '{"result": "once-taken"}'::jsonb;
  end if;
  if (
    select count(*) from public.requests q where q.asker_id = asker and q.status = 'open' and q.hidden_at is null
      and (q.closes_on is null or q.closes_on > today)  -- stage L: a due request isn't open
  ) >= 5 then
    return '{"result": "open-limit"}'::jsonb;
  end if;
  if (
    select count(*) from public.requests q where q.asker_id = asker and q.created_at > now() - interval '24 hours'
  ) >= 5 then
    return '{"result": "daily-limit"}'::jsonb;
  end if;
  token := private.take_once_token(p_once_token);
  if token = 'none' then
    return '{"result": "once-expired"}'::jsonb;
  elsif token = 'again' then
    return '{"result": "once-taken"}'::jsonb;
  end if;
  insert into public.requests (
    asker_id, title, category_slug, campus_slug, details, budget_zar, swap_welcome, needed_by
  )
  values (
    asker, p_title, p_category_slug, p_campus_slug, p_details, p_budget_zar, coalesce(p_swap_welcome, false),
    p_needed_by
  )
  returning * into request;
  return jsonb_build_object('result', 'posted', 'id', request.id);
end;
$$;

-- --- set_request_open, replaced ---------------------------------------------------------------------------------------

-- Close (p_open false) or Reopen (true) one of the asker's requests (setRequestOpen, requests.ts; changeOpen): only an
-- open one that hasn't reached its closing day closes, and only a closed one reopens, never a hidden one. Reopening
-- counts towards the 5 open, leaving out requests past their closing day, under the asker's lock (spec 2.6).
-- Returns 'closed' | 'reopened' | 'reopened-date-cleared' (its passed needed-by date was cleared) | 'nothing' (not
-- theirs, hidden, past its closing day, or nothing to do) | 'reopen-limit'.
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.set_request_open(p_id text, p_open boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  asker uuid := private.signed_in();
  today date := private.sast_day(now());  -- stage L
  kept_needed date;                       -- stage L: read under the row lock (PG 17 has no OLD in RETURNING)
begin
  if p_open is null then
    raise exception 'a request is opened or closed' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtext('vossie:requests:' || asker::text), 0);
  select q.needed_by into kept_needed from public.requests q
  where q.id = p_id and q.asker_id = asker and q.hidden_at is null
    and q.status = case when p_open then 'closed' else 'open' end
    and (p_open or q.closes_on is null or q.closes_on > today)  -- stage L: a due request can't be closed by hand
  for update;
  if not found then
    return 'nothing';
  end if;
  if p_open and (
    select count(*) from public.requests q where q.asker_id = asker and q.status = 'open' and q.hidden_at is null
      and (q.closes_on is null or q.closes_on > today)  -- stage L: a due request isn't open
  ) >= 5 then
    return 'reopen-limit';
  end if;
  update public.requests q
  set status = case when p_open then 'open' else 'closed' end,
    closed_at = case when p_open then null else now() end,
    closed_by = case when p_open then null else 'asker' end,                       -- stage L
    needed_by = case when p_open and kept_needed < today then null else kept_needed end,  -- stage L
    updated_at = now()
  where q.id = p_id;
  return case
    when not p_open then 'closed'
    when kept_needed < today then 'reopened-date-cleared'  -- stage L
    else 'reopened'
  end;
end;
$$;

-- --- start_offer, replaced --------------------------------------------------------------------------------------------

-- Send offer, as message limits' (which see), except that a request past its closing day answers closed (stage L).
-- Returns jsonb, as before.
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.start_offer(p_request_id text, p_listing_id text, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.require_profile();
  request public.requests;
  shop public.shops;
  shop_state text;
  listing public.listings;
  conv uuid;
  refusal text;
begin
  if p_body is null or btrim(p_body, E' \t\n\r') = '' then
    raise exception 'a message is not empty' using errcode = 'check_violation';
  end if;
  select * into request from public.requests q where q.id = p_request_id and q.hidden_at is null for share;
  if request.id is null then
    return '{"result": "not-found"}'::jsonb;
  end if;
  if request.asker_id = account then
    return '{"result": "own"}'::jsonb;
  end if;
  select * into shop from public.shops s where s.id = private.shop_of(account);
  if shop.id is null then
    return '{"result": "no-shop"}'::jsonb;
  end if;

  perform pg_advisory_xact_lock(hashtext('vossie:offers:' || shop.id::text), 0);
  select c.id into conv from public.conversations c
  where c.request_id = request.id and c.shop_id = shop.id and c.is_offer and not c.seller_gone;
  if conv is not null then
    return jsonb_build_object('result', 'already', 'conversation_id', conv);
  end if;
  shop_state := private.shop_status(shop.id);
  if shop_state = 'pending' then
    return '{"result": "pending"}'::jsonb;
  elsif shop_state = 'paused' then
    return '{"result": "paused"}'::jsonb;
  end if;
  -- stage L: past its closing day, it counts as closed before the settle stores it (requestOpenOn).
  if request.status <> 'open' or (request.closes_on is not null and request.closes_on <= private.sast_day(now())) then
    return '{"result": "closed"}'::jsonb;
  end if;
  if request.asker_id is null then
    return '{"result": "sample"}'::jsonb;
  end if;
  if p_listing_id is not null then
    select * into listing from public.listings l
    where l.id = p_listing_id and l.shop_id = shop.id and l.state = 'available' and l.hidden_at is null;
    if listing.id is null then
      return '{"result": "listing-invalid"}'::jsonb;
    end if;
  end if;
  if (
    select count(*) from public.conversations c
    where c.shop_id = shop.id and c.is_offer and not c.seller_gone and c.created_at > now() - interval '24 hours'
  ) >= 20 then
    return '{"result": "offer-rate"}'::jsonb;
  end if;
  refusal := private.message_limit_error(account, false);
  if refusal is not null then
    return jsonb_build_object('result', refusal);
  end if;

  insert into public.conversations (
    listing_id, listing_title, shop_id, buyer_id, status, is_offer, request_id, request_title
  )
  values (listing.id, listing.title, shop.id, request.asker_id, 'offered', true, request.id, request.title)
  on conflict (request_id, shop_id) where is_offer and not seller_gone and request_id is not null do nothing
  returning id into conv;
  if conv is null then
    select c.id into conv from public.conversations c
    where c.request_id = request.id and c.shop_id = shop.id and c.is_offer and not c.seller_gone;
    return jsonb_build_object('result', 'already', 'conversation_id', conv);
  end if;
  insert into public.messages (conversation_id, side, body) values (conv, 'seller', p_body);
  perform private.notify(
    request.asker_id, 'offer', conv::text, private.offer_note_text(shop.name, request.title), private.thread_path(conv)
  );
  return jsonb_build_object('result', 'offered', 'conversation_id', conv);
end;
$$;
