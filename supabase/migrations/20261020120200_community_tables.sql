-- The community tables (supabase schema catch-up plan, Task 3; backend spec 4.2 and 4.3; community actions spec, stage
-- H; search alerts spec, stage I): Looking For requests, follows and saved searches, and offers on conversations.
--
-- - Writes are Task 6's functions: no API role has insert, update or delete on any table here.
-- - The asker is never public (community spec decision 2): requests.asker_id is left out of the API roles' column
--   grant. The asker reads their own requests, in every state and with the Hub's reason, through
--   private.is_my_request (a security definer helper that compares asker_id with the session), so no API role ever
--   needs the column; public.my_requests lists them.
-- - A shop only ever sees how many follow it, never who (CLAUDE.md): follows are read by their account only, and
--   public.follower_count gives the shop's owner the number.
-- - Saved searches are seen only by their owner (CLAUDE.md). Their identity is a search_key the app works out (plan
--   decision 3); SQL can't tell whether the words are more than stop words (queryWords), so the "worth saving" check
--   here only asks for words, a category or a filter.
-- - An offer is a conversation marked by is_offer, set when it starts and never changed (plan review): request_id is a
--   plain pointer that a deleted request sets null, and the offer stays an offer, never an enquiry or a question.
--   Phase A's two "one open thread" indexes leave offers out, and start_conversation, whose ON CONFLICT targets them,
--   is replaced here in the same migration so its targets match them exactly.
-- - Two app checks stay in TypeScript: a request's needed-by date within NEEDED_BY_DAYS (90) of today, which depends
--   on today in SAST, and "no contact details" in its title and details (hasContactDetails), whose rules are the app's
--   regular expressions (lib/looking-for/rules.ts:127). Task 6's save_request takes what the app has checked.

-- --- requests (RequestRow, lib/data/rows.ts:458; lib/looking-for/rules.ts:7-17) ---------------------------------------

create table public.requests (
  -- "r-001" for the 16 samples, a short id for new ones; it appears in links and in reports (target_id's shape).
  id text primary key default private.new_short_id()
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 40),
  -- Who asked: never readable through the API (the column grant below). Null for the samples; deleting the account
  -- deletes its requests (forgetRequestsOf, requests.ts:211).
  asker_id uuid references public.profiles (id) on delete cascade,
  -- TITLE_MIN to TITLE_MAX (5 to 70) characters, one line (cleanTitle, rules.ts:176).
  title text not null check (char_length(title) between 5 and 70 and private.is_clean_line(title)),
  category_slug text not null references public.categories (slug),
  campus_slug text not null references public.campuses (slug),
  -- DETAILS_MIN to DETAILS_MAX (20 to 600) characters of clean text with its line breaks (cleanText).
  details text not null check (char_length(details) between 20 and 600 and private.is_clean_text(details)),
  -- Whole rand, 1 to BUDGET_MAX (100,000) (parseBudget, rules.ts:140), or null for "Open to offers".
  budget_zar int check (budget_zar between 1 and 100000),
  swap_welcome boolean not null default false,
  -- A South African date. Its 90-day window is an app check (checkNeededBy, rules.ts:164): it depends on today.
  needed_by date,
  -- RequestStatus (types.ts:146). Hidden is its own column: a hidden request keeps open or closed (stage J plan
  -- decision 16).
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- When the asker closed it (setRequestOpen, requests.ts:155).
  closed_at timestamptz,
  -- The fixture's offers number, kept only on the samples, which have no offer threads (rows.ts:479).
  seed_offers int not null default 0 check (seed_offers >= 0),
  -- When and why the Hub hid it (hideRequest, requests.ts:181): clean text, at most REASON_MAX (lib/staff/rules.ts:8).
  hidden_at timestamptz,
  hidden_reason text check (char_length(hidden_reason) between 1 and 500 and private.is_clean_text(hidden_reason)),
  -- An asker's request is closed exactly when it has a closing time. The two closed samples have none (the fixtures
  -- keep closedAt null, data/fixtures/request-rows.ts:21), so a sample may be closed without one.
  constraint requests_closed_at_when_closed check (
    (status = 'closed') = (closed_at is not null) or (asker_id is null and closed_at is null)
  ),
  constraint requests_hidden_with_reason check ((hidden_at is null) = (hidden_reason is null)),
  constraint requests_seed_offers_for_samples check (seed_offers = 0 or asker_id is null)
);
-- Your requests and the limits' counts (listOwnRequests, countOpenRequests, countRequestsSince): an asker's, newest
-- first. Also the index for the asker foreign key and for private.is_my_request.
create index requests_asker_id_idx on public.requests (asker_id, created_at desc);
create index requests_category_slug_idx on public.requests (category_slug);
create index requests_campus_slug_idx on public.requests (campus_slug);
-- The board and the homepage (listedRequests, requests.ts:41): open and not hidden, newest first.
create index requests_listed_idx on public.requests (created_at desc) where status = 'open' and hidden_at is null;

-- --- follows (FollowRow, rows.ts:484; lib/data/follows.ts) --------------------------------------------------------------

-- A student following a shop (community actions spec 2.15), by the shop's id, so a change of link needs nothing. At most
-- FOLLOW_LIMIT (200, lib/following/rules.ts:5) an account, never their own shop and only a shop with a storefront:
-- Task 6's follow_shop checks those under a lock.
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Once a shop (addFollow's "already", follows.ts:30). Also the index for the account foreign key.
  constraint follows_once unique (account_id, shop_id)
);
-- The shop's followers, for its count and for the new-listing notifications (notifyFollowers). Also the index for the
-- shop foreign key.
create index follows_shop_id_idx on public.follows (shop_id);

-- --- saved_searches (SavedSearchRow, rows.ts:496; lib/saved-searches/rules.ts; lib/data/saved-searches.ts) ------------

-- A saved search (search alerts spec 2.1): browse's filters, the campus pinned, and when its alerts were paused. At most
-- SAVED_SEARCH_LIMIT (20, rules.ts:15) an account: Task 6's save_search counts them under a lock.
create table public.saved_searches (
  -- "ss-…" or a short id; a search-match notification's subject.
  id text primary key default private.new_short_id()
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 40),
  account_id uuid not null references public.profiles (id) on delete cascade,
  -- The words as typed, trimmed and cut to MAX_QUERY_LENGTH (100, lib/browse/query.ts:15); null when they are only
  -- stop words or none (matchQueryOf, rules.ts:31).
  q text check (char_length(q) between 1 and 100),
  category text references public.categories (slug),
  -- A campus, or null for every campus (plan decision 2: the app's "all").
  campus_slug text references public.campuses (slug),
  -- PriceFilter and PayFilter (lib/types.ts:272 and :274); deals is "free-and-swaps" (rows.ts:510).
  price text check (price in ('free', 'under-50', 'under-100', 'under-250', 'under-500')),
  pay text check (pay in ('cash', 'swap')),
  deals text check (deals in ('free-and-swaps')),
  -- searchKey (rules.ts:58): two searches are the same when their keys are (plan decision 3).
  search_key text not null check (char_length(search_key) between 1 and 500),
  created_at timestamptz not null default now(),
  -- When its alerts were paused; null while they're on.
  paused_at timestamptz,
  -- Worth saving (isWorthSaving, rules.ts:44): words, a category, or a price, pay or deals filter; a campus alone
  -- isn't. Whether the words are more than stop words is queryWords, the app's (plan decision 3).
  constraint saved_searches_worth_saving check (
    q is not null or category is not null or price is not null or pay is not null or deals is not null
  ),
  -- The same search once an account (addSavedSearch's "already"). Also the index for the account foreign key.
  constraint saved_searches_once unique (account_id, search_key)
);
create index saved_searches_category_idx on public.saved_searches (category);
create index saved_searches_campus_slug_idx on public.saved_searches (campus_slug);

alter table public.requests enable row level security;
alter table public.follows enable row level security;
alter table public.saved_searches enable row level security;

-- --- Offers on conversations (ConversationRow.requestId, rows.ts:176; lib/data/offers.ts; messages.ts:234) -------------

alter table public.conversations
  -- Set when the thread starts (startOffer, messages.ts:234) and never changed (the trigger below). An offer is never
  -- an enquiry or a question (messages.ts:159), and F's counting leaves it out (shop-stats.ts:26).
  add column is_offer boolean not null default false,
  -- The request it answers, while the request exists: deleting it sets this null and the offer stays an offer
  -- (deleteRequest, requests.ts:168).
  add column request_id text references public.requests (id) on delete set null,
  -- The request's title when the offer was made, kept for when the request has gone, as listing_title is.
  add column request_title text check (char_length(request_title) between 1 and 70 and private.is_clean_line(request_title)),
  -- Whether the buyer has deleted their account, as seller_gone says it of the seller: buyer_id isn't readable through
  -- the API, and the shop needs to know (otherSideThere, messages.ts:55; "Deleted account", messages.ts:82).
  add column buyer_gone boolean generated always as (buyer_id is null) stored,
  -- ConversationStatus (types.ts:311): an offer starts Offered, and the asker's reply makes it Replied (messages.ts:295).
  drop constraint conversations_status_check,
  add constraint conversations_status_check check (status in ('offered', 'asked', 'replied', 'done', 'confirmed')),
  add constraint conversations_offered_only_offers check (status <> 'offered' or is_offer),
  add constraint conversations_request_only_offers check (is_offer or (request_id is null and request_title is null)),
  add constraint conversations_offers_keep_titles check (not is_offer or request_title is not null);

-- Phase A's "one open thread" indexes (messaging migration) leave offers out: an offer may point at a listing, or at
-- none (no listing title), and must clash with neither the buyer's enquiry nor their question. start_conversation's ON
-- CONFLICT targets below repeat these predicates exactly.
drop index public.conversations_one_per_listing;
create unique index conversations_one_per_listing on public.conversations (buyer_id, listing_id)
  where buyer_id is not null and not seller_gone and listing_id is not null and not is_offer;
drop index public.conversations_one_question_per_shop;
create unique index conversations_one_question_per_shop on public.conversations (buyer_id, shop_id)
  where buyer_id is not null and not seller_gone and listing_title is null and not is_offer;
-- One offer a shop on a request (offerRow, offers.ts:21), while the shop is there to answer it. A deleted request's
-- offers (request_id null) clash with nothing.
create unique index conversations_one_offer_per_shop on public.conversations (request_id, shop_id)
  where is_offer and not seller_gone and request_id is not null;
-- The index for the request foreign key (advisor 0001; deleting a request sets its offers' request_id null) and for a
-- request's offer count.
create index conversations_request_id_idx on public.conversations (request_id);

create function private.keep_is_offer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_offer is distinct from old.is_offer then
    raise exception 'conversation %: is_offer is set when it starts and never changed', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.keep_is_offer() from public, anon, authenticated;

create trigger conversations_keep_is_offer
before update of is_offer on public.conversations
for each row execute function private.keep_is_offer();

-- --- Helpers --------------------------------------------------------------------------------------------------------

-- Whether the signed-in account asked this request (getOwnRequest, requests.ts:68). Runs as the owner, so policies and
-- my_requests can ask without any API role reading asker_id.
create function private.is_my_request(req text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.requests r where r.id = req and r.asker_id = (select auth.uid())
  );
$$;

-- The buyer's first name as the shop sees it (otherName, lib/data/messages.ts:110 to 120), for a reader on either side:
-- null when the buyer has deleted their account (the app says "Deleted account"; buyer_gone says which), and null in an offer thread until the asker has written in it (community actions spec 2.10: the app says
-- UNNAMED_ASKER). So a shop never reads the asker's profile, only this. Null for anyone not in the conversation.
create function private.conversation_buyer_name(conv uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.first_name
  from public.conversations c
  join public.profiles p on p.id = c.buyer_id
  where c.id = conv
    and private.conversation_side(conv) is not null
    and (
      not c.is_offer
      or exists (select 1 from public.messages m where m.conversation_id = c.id and m.side = 'buyer')
    );
$$;

-- Where an offer thread's request stands (getThread, messages.ts:430 to 437), for a reader on either side: 'live' while
-- its page is up, open or closed; 'hidden' when the Hub has hidden it, told only to the asker (REQUEST_HIDDEN_NOTE; the
-- shop reads REQUEST_REMOVED_NOTE, components/messages/OfferAbout.tsx:40); otherwise 'gone'. Null for a conversation
-- that isn't an offer, or for anyone not in it. A live request's title as it is now is read from requests itself.
create function private.conversation_request_state(conv uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not c.is_offer then null
    when r.id is null then 'gone'
    when r.hidden_at is null then 'live'
    when private.conversation_side(conv) = 'buyer' then 'hidden'
    else 'gone'
  end
  from public.conversations c
  left join public.requests r on r.id = c.request_id
  where c.id = conv and private.conversation_side(conv) is not null;
$$;

-- Policies and the views call these as the signed-in role, which needs EXECUTE (the foundation migration).
revoke all on function private.is_my_request(text), private.conversation_buyer_name(uuid),
  private.conversation_request_state(uuid) from public, anon;
grant execute on function private.is_my_request(text), private.conversation_buyer_name(uuid),
  private.conversation_request_state(uuid) to authenticated, service_role;

-- --- Grants and policies on the new tables -----------------------------------------------------------------------------

-- Supabase's default privileges give every API role everything on a new table; truncate ignores RLS. So all of it is
-- revoked first, the service role's too, and each role gets only what it reads.
revoke all on table public.requests, public.follows, public.saved_searches from anon, authenticated, service_role;
-- Every column but asker_id.
grant select (
  id, title, category_slug, campus_slug, details, budget_zar, swap_welcome, needed_by, status, created_at, updated_at,
  closed_at, seed_offers, hidden_at, hidden_reason
) on table public.requests to anon, authenticated;
grant select on table public.follows, public.saved_searches to authenticated;
grant all on table public.requests, public.follows, public.saved_searches to service_role;

-- One policy per role and table, as phase A's, so Postgres runs one check per row.
-- The board and a request's page: anything the Hub hasn't hidden, open or closed (publicRequest, requests.ts:46).
create policy "Anyone reads requests the Hub hasn't hidden"
on public.requests for select
to anon
using (hidden_at is null);

-- Signed in, the asker also reads their own in every state, with the Hub's reason (Your requests, requests.ts:82), and
-- admins every one, hidden ones and their reasons included (Show again, /admin/hidden). Nobody reads who asked.
create policy "Signed-in people read requests the Hub hasn't hidden, askers theirs, and admins every one"
on public.requests for select
to authenticated
using (hidden_at is null or private.is_my_request(id) or (select private.is_staff('admin')));

create policy "Students read their follows"
on public.follows for select
to authenticated
using (account_id = (select auth.uid()));

create policy "Students read their saved searches"
on public.saved_searches for select
to authenticated
using (account_id = (select auth.uid()));

-- --- Functions ----------------------------------------------------------------------------------------------------------

-- A request's offers (toRequest, requests.ts:22; offerThreadCount, offers.ts:31): its sample's number plus every offer
-- thread on it, in any state, a gone shop's included. Null for a hidden request (unless the asker asks) or an unknown
-- one, so the count says nothing a reader can't see. Only the asker reads the offers themselves (my_conversations).
-- Callable by anon on purpose (advisor 0028 lists it): a count, the same one the board shows.
create function public.request_offer_count(p_request text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select r.seed_offers + (
    select count(*)::int from public.conversations c where c.request_id = r.id and c.is_offer
  )
  from public.requests r
  where r.id = p_request and (r.hidden_at is null or r.asker_id = (select auth.uid()));
$$;

-- How many follow the shop (countFollowers, follows.ts:91; the dashboard's line, followersLine): for its owner only,
-- and never who. Null for anyone else.
-- A user action (advisor 0029 lists it on purpose).
create function public.follower_count(p_shop uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.owns_shop(p_shop) then (select count(*)::int from public.follows f where f.shop_id = p_shop)
  end;
$$;

revoke all on function public.request_offer_count(text), public.follower_count(uuid) from public, anon, authenticated;
grant execute on function public.request_offer_count(text) to anon, authenticated, service_role;
grant execute on function public.follower_count(uuid) to authenticated, service_role;

-- --- The views ----------------------------------------------------------------------------------------------------------

-- The asker's own requests (listOwnRequests and getOwnRequest, requests.ts:68 and :82) with their state (stateOf: the
-- Hub's hide first, then open or closed) and offer count. security_invoker, so the requests policies apply as well.
create view public.my_requests
with (security_invoker = true)
as
select
  r.id, r.title, r.category_slug, r.campus_slug, r.details, r.budget_zar, r.swap_welcome, r.needed_by, r.status,
  r.created_at, r.updated_at, r.closed_at, r.hidden_at, r.hidden_reason,
  case when r.hidden_at is not null then 'hidden' else r.status end as state,
  public.request_offer_count(r.id) as offers
from public.requests r
where private.is_my_request(r.id);
revoke all on table public.my_requests from public, anon, authenticated, service_role;
grant select on table public.my_requests to authenticated, service_role;

-- Conversations: the offer's columns and buyer_gone join the column grant (still without buyer_id), and
-- my_conversations gains them, the buyer's name as the shop sees it and the request's state. Columns are added at the
-- end, as CREATE OR REPLACE VIEW requires.
grant select (is_offer, request_id, request_title, buyer_gone) on table public.conversations to authenticated;

create or replace view public.my_conversations
with (security_invoker = true)
as
select
  c.id, c.listing_id, c.listing_title, c.shop_id, c.seller_gone, c.status, c.created_at, c.last_message_at,
  c.first_reply_at, c.completed_at, c.confirmed_at, c.confirmed_by,
  private.conversation_side(c.id) as viewer_side,
  c.is_offer, c.request_id, c.request_title,
  c.buyer_gone,
  private.conversation_buyer_name(c.id) as buyer_name,
  private.conversation_request_state(c.id) as request_state
from public.conversations c;

-- --- start_conversation, replaced ------------------------------------------------------------------------------------

-- A buyer's first message (startConversation; spec 2.1, 2.2 and 2.4), about a listing or, with p_shop_slug instead, a
-- question to the shop. As phase A's (the actions migration), which it replaces, with two changes:
-- - its ON CONFLICT targets repeat the "one open thread" indexes' new predicates (`and not is_offer`), and its
--   fallback lookups leave offer threads out: an offer is never an enquiry or a question (findRow, messages.ts:159);
-- - a listing the Hub has hidden isn't there to message (catalog.ts:109): not-found, as a draft is.
-- Returns jsonb:
--   {"result": "started" | "added", "conversation_id": …}  startConversation's { conversationId, created: true | false }
--   {"result": "not-found"}  no such public listing (drafts, hidden listings and pending shops' aren't) or shop
--   {"result": "own-shop"}   the buyer owns the shop (the composer's own-shop check)
--   {"result": "closed"}     the listing is paused or sold, or its shop is paused. A question to a paused shop is fine
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.start_conversation(p_listing_id text, p_shop_slug text, p_body text, p_swap_offer text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  buyer uuid := private.require_profile();
  listing public.listings;
  shop uuid;
  conv uuid;
  made boolean := true;
  swap text := nullif(p_swap_offer, '');
begin
  if (p_listing_id is null) = (p_shop_slug is null) then
    raise exception 'a first message is about a listing or a shop, not both' using errcode = 'invalid_parameter_value';
  end if;
  if p_body is null or btrim(p_body, E' \t\n\r') = '' then
    raise exception 'a message is not empty' using errcode = 'check_violation';
  end if;

  if p_listing_id is not null then
    select * into listing from public.listings l
    where l.id = p_listing_id and l.state <> 'draft' and l.hidden_at is null and private.shop_is_public(l.shop_id);
    if not found then
      return '{"result": "not-found"}'::jsonb;
    end if;
    shop := listing.shop_id;
    if private.owns_shop(shop) then
      return '{"result": "own-shop"}'::jsonb;
    end if;
    if listing.state <> 'available' or private.shop_status(shop) = 'paused' then
      return '{"result": "closed"}'::jsonb;
    end if;
    if listing.pay_mode = 'cash' then
      swap := null;
    end if;
    insert into public.conversations (listing_id, listing_title, shop_id, buyer_id)
    values (listing.id, listing.title, shop, buyer)
    on conflict (buyer_id, listing_id)
      where buyer_id is not null and not seller_gone and listing_id is not null and not is_offer
    do nothing
    returning id into conv;
    if conv is null then
      made := false;
      select c.id into conv from public.conversations c
      where c.buyer_id = buyer and c.listing_id = listing.id and not c.seller_gone and not c.is_offer
      for update;
    end if;
  else
    select s.id into shop from public.shops s where s.slug = p_shop_slug and private.shop_is_public(s.id);
    if not found then
      return '{"result": "not-found"}'::jsonb;
    end if;
    if private.owns_shop(shop) then
      return '{"result": "own-shop"}'::jsonb;
    end if;
    swap := null;
    insert into public.conversations (listing_id, listing_title, shop_id, buyer_id)
    values (null, null, shop, buyer)
    on conflict (buyer_id, shop_id)
      where buyer_id is not null and not seller_gone and listing_title is null and not is_offer
    do nothing
    returning id into conv;
    if conv is null then
      made := false;
      select c.id into conv from public.conversations c
      where c.buyer_id = buyer and c.shop_id = shop and c.listing_title is null and not c.seller_gone
        and not c.is_offer
      for update;
    end if;
  end if;

  insert into public.messages (conversation_id, side, body, swap_offer) values (conv, 'buyer', p_body, swap);
  update public.conversations set last_message_at = now() where id = conv;
  perform private.tell_other_side(conv, 'buyer');
  return jsonb_build_object('result', case when made then 'started' else 'added' end, 'conversation_id', conv);
end;
$$;

-- --- mentor_shop_numbers, replaced (Task 2's note) ---------------------------------------------------------------------

-- A shop's last 14 days for the mentor dashboard (recentCounts, lib/data/shop-stats.ts:61), as Task 2's, which it
-- replaces, with offers left out of the enquiries: the shop wrote first (shop-stats.ts:26, "!row.requestId"; here
-- is_offer, which a deleted request doesn't clear). An offer's sale still counts.
-- A user action for staff (advisor 0029 lists it on purpose).
create or replace function public.mentor_shop_numbers(p_shop uuid, p_now timestamptz default now())
returns table (enquiries int, due int, replied_in_time int, sales_confirmed int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz := p_now - interval '336 hours';
begin
  if not private.can_mentor((select sp.account_id from public.seller_profiles sp where sp.shop_id = p_shop)) then
    return;
  end if;
  return query
  select
    (count(*) filter (where e.enquiry))::int,
    (count(*) filter (where e.enquiry and (e.in_time or e.created_at <= p_now - interval '48 hours')))::int,
    (count(*) filter (where e.enquiry and e.in_time))::int,
    (count(*) filter (where e.sold_at >= since))::int
  from (
    select
      c.listing_title is not null and not c.is_offer and c.created_at >= since as enquiry,
      coalesce(c.first_reply_at - c.created_at <= interval '48 hours', false) as in_time,
      c.created_at,
      case
        when c.status = 'confirmed' then c.confirmed_at
        when c.status = 'done' and c.completed_at + interval '168 hours' <= p_now
          then c.completed_at + interval '168 hours'
      end as sold_at
    from public.conversations c
    where c.shop_id = p_shop and not c.seller_gone
  ) e;
end;
$$;
