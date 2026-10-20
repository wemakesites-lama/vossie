-- The community actions (supabase schema catch-up plan, Task 6; community actions spec, stage H; search alerts spec,
-- stage I): Looking For requests, offers, follows and saved searches, and what a listing's first publish tells the
-- shop's followers and the students whose saved searches match it.
--
-- - Each write is a `public` function called with the student's own session, as phase A's are: `security definer`,
--   `search_path = ''`, identity from auth.uid(), never from an argument. Expected refusals are return values that map
--   onto the app's (lib/data/requests.ts, offers.ts, follows.ts, saved-searches.ts and the actions that call them); a
--   value the app checks first (a title's length, a message's) still meets the table's checks and raises.
-- - Limits are counted under an advisory lock (pg_advisory_xact_lock(hashtext(key), 0)) on whoever they limit, so two
--   posts at the same moment can't both take the last place: 'vossie:requests:<asker>', 'vossie:offers:<shop>',
--   'vossie:follows:<account>' and 'vossie:saved-searches:<account>'.
-- - Notification wording is built here, never passed in (the plan's note on Tasks 4 to 6), by private.*_note_text
--   functions that mirror lib/looking-for/words.ts, lib/following/rules.ts and lib/saved-searches/words.ts; the test
--   compares them with strings printed from the TypeScript. The one exception is record_search_matches, the server's
--   only (plan decision 4): a saved search's label and results link are worked out by the app's search rules, which
--   SQL doesn't copy (plan decision 3), so the server passes them in.
-- - Phase A's (and Task 4's) functions replaced here, each diffed against the definition it replaces and otherwise
--   unchanged: send_message (an offer's shop waits for the asker; the asker's reply makes it Replied), tell_other_side
--   and mark_completed (an offer thread is named by its request, as the app's currentRequestTitle does), save_listing (a
--   first publish tells the followers), delete_listing (the alerts that lead to the listing go), create_report (a
--   request's title from the table) and Task 1's private.shop_link_moved (followers' notifications follow the link).
-- - Stage K's message limits are Task 9's: "-- Task 9:" marks where they go.

-- --- The sentences (lib/looking-for/words.ts, lib/following/rules.ts, lib/saved-searches/words.ts) -----------------
-- The words are samples for Lama to change: change them in the TypeScript and here together (the test compares them).

-- The asker's notification for each offer, with the "offer" kind (offerNoteText).
create function private.offer_note_text(shop text, request_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select shop || ' offered to help with ' || request_title;
$$;

-- A followed shop's first new listing of the day, with the "new-listing" kind (newListingText).
create function private.new_listing_note_text(shop text, title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select shop || ' listed ' || title;
$$;

-- The same notification once the shop lists more that day (newListingsText).
create function private.new_listings_note_text(shop text, n int)
returns text
language sql
immutable
set search_path = ''
as $$
  select shop || ' listed ' || n || ' new things';
$$;

-- A saved search's first match of the day, or its first since it was read, with the "search-match" kind
-- (searchMatchText).
create function private.search_match_note_text(title text, label text)
returns text
language sql
immutable
set search_path = ''
as $$
  select title || ' matches your search ' || label;
$$;

-- The same notification once more match while it's unread (searchMatchesText).
create function private.search_matches_note_text(n int, label text)
returns text
language sql
immutable
set search_path = ''
as $$
  select n || ' new listings match your search ' || label;
$$;

-- A once-a-day notification's words for its n-th thing (notifyOncePerDay's `more`): `label` is the shop's name for a
-- new listing, the saved search's label for a match.
create function private.once_a_day_more_text(note_kind text, n int, label text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case note_kind
    when 'new-listing' then private.new_listings_note_text(label, n)
    when 'search-match' then private.search_matches_note_text(n, label)
  end;
$$;

-- --- Shared helpers (private) --------------------------------------------------------------------------------------

-- One notification a SAST day per account, kind and subject (notifyOncePerDay, lib/data/notifications.ts:182; community
-- actions plan decision 15, search alerts plan decision 12), as one INSERT … ON CONFLICT … DO UPDATE on Task 1's
-- notifications_once_a_day index, so two publishes at once can't make two:
-- - none yet today: `first_text`, linking to `first_href`, count null (one);
-- - one unread: it counts up, says the newer words (once_a_day_more_text, linking to `more_href`) and moves to the top;
-- - one read: a new-listing stays as it is (the day's later listings make none); a search-match comes back unread at
--   one, naming this listing, and moves to the top, so nothing is missed.
-- True when it made or changed a notification. A null account (a sample's) makes none.
create function private.notify_once_per_day(
  account uuid, note_kind text, subject text, first_text text, first_href text, label text, more_href text
)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  touched int;
begin
  if note_kind is null or note_kind not in ('new-listing', 'search-match') then
    raise exception 'only new-listing and search-match come once a day' using errcode = 'invalid_parameter_value';
  end if;
  if account is null then
    return false;
  end if;
  insert into public.notifications as n (account_id, kind, subject_id, text, href)
  values (account, note_kind, subject, first_text, first_href)
  on conflict (account_id, kind, subject_id, private.sast_day(created_at)) where kind in ('new-listing', 'search-match')
  do update set
    count = case when n.read_at is null then coalesce(n.count, 1) + 1 else 1 end,
    text = case
      when n.read_at is null then private.once_a_day_more_text(n.kind, coalesce(n.count, 1) + 1, label)
      else excluded.text
    end,
    href = case when n.read_at is null then more_href else excluded.href end,
    read_at = null,
    created_at = excluded.created_at
  where n.read_at is null or n.kind = 'search-match';
  get diagnostics touched = row_count;
  return touched > 0;
end;
$$;

-- Whether this session's one-time token (private.take_once_token's) has made its thing already: a later post of the
-- same form goes where the first went, before any limit can turn it away (sentOnceToken, saveMyRequest). Reads only.
create function private.once_token_taken(p_token text)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  sid text := (select auth.jwt()) ->> 'session_id';
begin
  if p_token is null or p_token !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or sid is null or sid !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then
    return false;
  end if;
  return exists (
    select 1 from public.form_states f
    where f.session_id = sid::uuid and f.form = 'staff-once:' || p_token and f.account_id = (select auth.uid())
      and f.taken and f.expires_at > now()
  );
end;
$$;

-- Whether a shop has a storefront to follow (storefrontRow, lib/data/catalog.ts:93): approved, or paused by its seller;
-- a shop the Hub paused has none (staff tools amendment 13.2), nor does one waiting for approval.
create function private.shop_has_storefront(shop uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.shop_is_public(shop) and not exists (
    select 1
    from public.shops s
    join public.seller_profiles sp on sp.account_id = s.owner_id and sp.shop_id = s.id
    where s.id = shop and sp.paused_by = 'staff'
  );
$$;

-- What a conversation is about, for its notifications: an offer thread by its request, as titled now while the request
-- has a page, else by the title it had when the offer was made; any other by its listing's title, or null for a
-- question to the shop (currentRequestTitle(row) ?? row.listingTitle, lib/data/messages.ts:91 and :140).
create function private.conversation_title(conv uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when c.is_offer then coalesce(
      (select r.title from public.requests r where r.id = c.request_id and r.hidden_at is null), c.request_title
    )
    else c.listing_title
  end
  from public.conversations c
  where c.id = conv;
$$;

-- Tells the shop's followers about a listing it has just published for the first time (notifyFollowers,
-- lib/data/follows.ts:99; notifyNewListing, notifications.ts:236): each once a SAST day for the shop, named by its link,
-- the first naming the listing and linking to it, more linking to the shop. Never the shop's owner. How many it told.
create function private.tell_followers(shop uuid, listing text)
returns int
language plpgsql
volatile
set search_path = ''
as $$
declare
  s public.shops;
  listing_title text := (select l.title from public.listings l where l.id = listing);
  follower uuid;
  told int := 0;
begin
  select * into s from public.shops where id = shop;
  for follower in
    select f.account_id from public.follows f
    where f.shop_id = shop and f.account_id is distinct from s.owner_id
    order by f.account_id
  loop
    if private.notify_once_per_day(
      follower, 'new-listing', s.slug, private.new_listing_note_text(s.name, listing_title), '/listings/' || listing,
      s.name, '/sellers/' || s.slug
    ) then
      told := told + 1;
    end if;
  end loop;
  return told;
end;
$$;

-- --- Looking For requests (saveMyRequest, closeMyRequest, reopenMyRequest, deleteMyRequest; lib/data/requests.ts) ----

-- Post request and Save changes (community actions spec 2.3 to 2.6; plan decisions 4 and 6): a new request (p_id null)
-- or the asker's changes to one of theirs while it's open (not closed, not hidden). A new one comes in under two limits,
-- counted under the asker's lock: at most OPEN_REQUESTS_MAX (5) open and not hidden, then at most REQUESTS_PER_DAY (5)
-- made in any 24 hours, counting only requests that still exist (lib/looking-for/rules.ts:16). It takes the form's
-- one-time token once every other check has passed, so a refused post keeps it, and a form already sent goes where the
-- first went, before any limit (saveMyRequest's sentOnceToken). The fields are as checkRequest leaves them; their
-- bounds are the table's checks (check_violation), and the 90-day needed-by window and "no contact details" are the
-- app's (Task 3's note).
-- Returns jsonb:
--   {"result": "posted" | "saved", "id"}
--   {"result": "not-found"}    p_id isn't one of the asker's (updateRequest's null)
--   {"result": "not-open"}     it's closed or hidden (the edit page says why)
--   {"result": "open-limit" | "daily-limit"}  a new one, refused
--   {"result": "once-expired" | "once-taken"}  a new one's token: none like it in this session, or sent already
-- A user action (advisor 0029 lists it on purpose).
create function public.save_request(
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
begin
  perform pg_advisory_xact_lock(hashtext('vossie:requests:' || asker::text), 0);
  if p_id is not null then
    update public.requests q
    set title = p_title, category_slug = p_category_slug, campus_slug = p_campus_slug, details = p_details,
      budget_zar = p_budget_zar, swap_welcome = coalesce(p_swap_welcome, false), needed_by = p_needed_by,
      updated_at = now()
    where q.id = p_id and q.asker_id = asker and q.status = 'open' and q.hidden_at is null
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

-- Close (p_open false) or Reopen (true) one of the asker's requests (setRequestOpen, requests.ts:155; changeOpen):
-- only an open one closes and only a closed one reopens, never a hidden one. Reopening counts towards the 5 open, under
-- the asker's lock (spec 2.6).
-- Returns 'closed' | 'reopened' | 'nothing' (not theirs, hidden, or nothing to do) | 'reopen-limit'.
-- A user action (advisor 0029 lists it on purpose).
create function public.set_request_open(p_id text, p_open boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  asker uuid := private.signed_in();
begin
  if p_open is null then
    raise exception 'a request is opened or closed' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtext('vossie:requests:' || asker::text), 0);
  perform 1 from public.requests q
  where q.id = p_id and q.asker_id = asker and q.hidden_at is null
    and q.status = case when p_open then 'closed' else 'open' end
  for update;
  if not found then
    return 'nothing';
  end if;
  if p_open and (
    select count(*) from public.requests q where q.asker_id = asker and q.status = 'open' and q.hidden_at is null
  ) >= 5 then
    return 'reopen-limit';
  end if;
  update public.requests q
  set status = case when p_open then 'open' else 'closed' end,
    closed_at = case when p_open then null else now() end,
    updated_at = now()
  where q.id = p_id;
  return case when p_open then 'reopened' else 'closed' end;
end;
$$;

-- Delete request (deleteRequest, requests.ts:168): one of the asker's, in any state. Its page goes, and so do the Hub's
-- notifications about it ("request-update"). Its offer threads stay offers, with the title they were made on
-- (request_id goes null, Task 3); reports about it stay (plan decision 8).
-- Returns 'deleted' | 'nothing' (not theirs, or not there).
-- A user action (advisor 0029 lists it on purpose).
create function public.delete_request(p_id text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  asker uuid := private.signed_in();
  gone text;
begin
  delete from public.requests q where q.id = p_id and q.asker_id = asker returning q.id into gone;
  if gone is null then
    return 'nothing';
  end if;
  delete from public.notifications n where n.kind = 'request-update' and n.subject_id = gone;
  return 'deleted';
end;
$$;

-- --- Offers (sendOffer, lib/looking-for/actions.ts; offerStatus, subjects.ts; startOffer, lib/data/messages.ts) -------

-- Send offer (community actions spec 2.7 to 2.9; plan decisions 12 and 13), from the signed-in account's own shop, in
-- offerStatus's order: a request with a page (open or closed, not hidden); not the asker's own; a shop; the shop's
-- offer already made on it (found even if the shop has paused since, amendment 19.7); a shop that's approved and not
-- paused; an open request; one with an asker (a sample has no one to answer). The listing it points to, if any, is one
-- of the shop's listed ones (available, not hidden). At most OFFERS_PER_DAY (20) a shop in any 24 hours
-- (countOffersSince: a shop's offer threads while it's there), counted under the shop's lock. The thread starts
-- Offered, with the asker on the buyer's side and the shop's message, and the asker is told ("offer").
-- Its ON CONFLICT repeats conversations_one_offer_per_shop's predicate exactly (Task 5's note).
-- Returns jsonb:
--   {"result": "offered" | "already", "conversation_id"}
--   {"result": "not-found" | "own" | "no-shop" | "pending" | "paused" | "closed" | "sample" | "listing-invalid" |
--    "offer-rate"}
-- An empty message raises check_violation, as do the messages table's checks (at most 1,000 characters, clean text).
-- A user action (advisor 0029 lists it on purpose).
create function public.start_offer(p_request_id text, p_listing_id text, p_body text)
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
  if request.status <> 'open' then
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
  -- Task 9: the hour's messages (message-rate) are checked here, after the 20 offers a day.

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

-- --- Messaging, replaced (phase A's actions migration) ---------------------------------------------------------------

-- A message in a thread (sendMessage, lib/data/messages.ts; spec 3.3), as phase A's, which it replaces, with the offer's
-- two rules (community actions spec 2.9 and 2.12): the shop that offered can't write again while the thread is
-- Offered ('waiting'), and the asker's reply makes it Replied. A sale due to confirm itself is settled first. The
-- seller's first reply moves Asked to Replied and keeps its time (plan decision 30); the other side is told.
-- Returns sendMessage's SendResult: 'sent'; 'not-found' when the conversation isn't the account's; 'closed' when the
-- other side has left (plan decision 21); 'waiting'.
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  side text;
begin
  perform private.signed_in();
  if p_body is null or btrim(p_body, E' \t\n\r') = '' then
    raise exception 'a message is not empty' using errcode = 'check_violation';
  end if;
  select * into c from public.conversations where id = p_conversation_id for update;
  side := private.conversation_side(p_conversation_id);
  if c.id is null or side is null then
    return 'not-found';
  end if;
  if (side = 'buyer' and c.seller_gone) or (side = 'seller' and c.buyer_id is null) then
    return 'closed';
  end if;
  if side = 'seller' and c.status = 'offered' then
    return 'waiting';
  end if;
  -- Task 9: the hour's messages (message-rate) are checked here.
  perform private.settle_conversation(c.id, now());
  insert into public.messages (conversation_id, side, body) values (c.id, side, p_body);
  update public.conversations
  set last_message_at = now(),
    status = case
      when side = 'seller' and status = 'asked' then 'replied'
      when side = 'buyer' and status = 'offered' then 'replied'
      else status
    end,
    first_reply_at = case when side = 'seller' then coalesce(first_reply_at, now()) else first_reply_at end
  where id = c.id;
  perform private.tell_other_side(c.id, side);
  return 'sent';
end;
$$;

-- Tells the other side about a message from `from_side` (tellOtherSide in lib/data/messages.ts), as phase A's, which it
-- replaces, except that the sentence names what the conversation is about through private.conversation_title: an
-- offer thread by its request (community actions plan decision 14, amendment 19.5), any other by its listing's title as
-- before. The seller is whoever owns the shop now; a shop with no owner, or whose owner has gone, has no one to tell. A
-- buyer is still "asking" until someone has replied (messaging plan amendment 3).
create or replace function private.tell_other_side(conv uuid, from_side text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  recipient uuid;
  sender text;
begin
  select * into c from public.conversations where id = conv;
  if from_side = 'buyer' then
    recipient := case when c.seller_gone then null
      else (select sp.account_id from public.seller_profiles sp where sp.shop_id = c.shop_id) end;
    sender := coalesce((select p.first_name from public.profiles p where p.id = c.buyer_id), 'Deleted account');
  else
    recipient := c.buyer_id;
    sender := coalesce((select s.name from public.shops s where s.id = c.shop_id), 'A closed shop');
  end if;
  if recipient is null then
    return;
  end if;
  perform private.notify_message(
    recipient, conv,
    private.message_note_text(sender, private.conversation_title(conv), from_side = 'buyer' and c.status = 'asked')
  );
end;
$$;

-- The seller's Mark as completed (markCompleted; spec 2.5), as phase A's, which it replaces, except that the sale's
-- sentence names an offer thread by its request (markCompleted's currentRequestTitle). Replied becomes Done, and the
-- buyer is asked to confirm.
-- Returns SaleResult: 'done', or 'not-allowed' when the account isn't the seller, it isn't Replied, or the buyer has
-- left (amendment 3).
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.mark_completed(p_conversation_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.conversations := private.sale_row(p_conversation_id, 'seller', 'replied');
begin
  perform private.signed_in();
  if c.id is null or c.buyer_id is null then
    return 'not-allowed';
  end if;
  update public.conversations set status = 'done', completed_at = now() where id = c.id;
  insert into public.notifications (account_id, kind, subject_id, text, href)
  values (
    c.buyer_id, 'sale-to-confirm', c.id::text,
    private.sale_note_text(
      coalesce((select s.name from public.shops s where s.id = c.shop_id), 'A closed shop'), private.conversation_title(c.id)
    ),
    private.thread_path(c.id)
  );
  return 'done';
end;
$$;

-- --- Follows (addFollow and removeFollow, lib/data/follows.ts; lib/following/actions.ts) ----------------------------

-- Follow (community actions spec 2.15), by the shop's id: a shop with a storefront, never the account's own, at most
-- FOLLOW_LIMIT (200, lib/following/rules.ts:5) an account, counted under the account's lock.
-- Returns addFollow's FollowResult: 'followed' | 'already' | 'own' | 'limit' | 'not-found'.
-- A user action (advisor 0029 lists it on purpose).
create function public.follow_shop(p_shop uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.require_profile();
begin
  if not private.shop_has_storefront(p_shop) then
    return 'not-found';
  end if;
  if exists (select 1 from public.shops s where s.id = p_shop and s.owner_id = account) then
    return 'own';
  end if;
  perform pg_advisory_xact_lock(hashtext('vossie:follows:' || account::text), 0);
  if exists (select 1 from public.follows f where f.account_id = account and f.shop_id = p_shop) then
    return 'already';
  end if;
  if (select count(*) from public.follows f where f.account_id = account) >= 200 then
    return 'limit';
  end if;
  insert into public.follows (account_id, shop_id) values (account, p_shop) on conflict (account_id, shop_id) do nothing;
  return 'followed';
end;
$$;

-- Unfollow (removeFollow, follows.ts:41), any shop the account follows, a paused or gone one's storefront or not.
-- Returns 'unfollowed' | 'nothing'.
-- A user action (advisor 0029 lists it on purpose).
create function public.unfollow_shop(p_shop uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
begin
  delete from public.follows f where f.account_id = account and f.shop_id = p_shop;
  return case when found then 'unfollowed' else 'nothing' end;
end;
$$;

-- --- Saved searches (addSavedSearch, setSavedSearchPaused, deleteSavedSearch; lib/data/saved-searches.ts) -----------

-- Save this search (search alerts spec 2.4): browse's filters and the key the app works out for them (searchKey,
-- lib/saved-searches/rules.ts:58; plan decision 3). The same key twice is 'already'; at most SAVED_SEARCH_LIMIT (20,
-- rules.ts:15) an account, counted under its lock. Words are as matchQueryOf leaves them (null for none), the campus
-- null for every campus (plan decision 2); the table checks the rest (check_violation, or foreign_key_violation for a
-- category or campus that isn't one).
-- Returns addSavedSearch's AddResult: 'saved' | 'already' | 'limit'.
-- A user action (advisor 0029 lists it on purpose).
create function public.save_search(
  p_q text, p_category text, p_campus_slug text, p_price text, p_pay text, p_deals text, p_search_key text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.require_profile();
begin
  perform pg_advisory_xact_lock(hashtext('vossie:saved-searches:' || account::text), 0);
  if exists (select 1 from public.saved_searches ss where ss.account_id = account and ss.search_key = p_search_key) then
    return 'already';
  end if;
  if (select count(*) from public.saved_searches ss where ss.account_id = account) >= 20 then
    return 'limit';
  end if;
  insert into public.saved_searches (account_id, q, category, campus_slug, price, pay, deals, search_key)
  values (account, p_q, p_category, p_campus_slug, p_price, p_pay, p_deals, p_search_key);
  return 'saved';
end;
$$;

-- Pause or Resume alerts on one of the account's saved searches (setSavedSearchPaused, saved-searches.ts:102; plan
-- decision 11): a second pause keeps the first time.
-- Returns 'paused' | 'resumed' | 'not-found' (not theirs).
-- A user action (advisor 0029 lists it on purpose).
create function public.set_search_paused(p_id text, p_paused boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
begin
  if p_paused is null then
    raise exception 'alerts are paused or on' using errcode = 'invalid_parameter_value';
  end if;
  update public.saved_searches ss
  set paused_at = case when p_paused then coalesce(ss.paused_at, now()) end
  where ss.id = p_id and ss.account_id = account;
  if not found then
    return 'not-found';
  end if;
  return case when p_paused then 'paused' else 'resumed' end;
end;
$$;

-- Delete a saved search (deleteSavedSearch, saved-searches.ts:117): it goes, with its search-match notifications.
-- Returns 'deleted' | 'not-found' (not theirs).
-- A user action (advisor 0029 lists it on purpose).
create function public.delete_search(p_id text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
  gone text;
begin
  delete from public.saved_searches ss where ss.id = p_id and ss.account_id = account returning ss.id into gone;
  if gone is null then
    return 'not-found';
  end if;
  delete from public.notifications n where n.kind = 'search-match' and n.subject_id = gone;
  return 'deleted';
end;
$$;

-- Tells the students whose saved searches match a listing published for the first time (notifySavedSearches,
-- saved-searches.ts:134; search alerts spec 2.9 to 2.12, plan decisions 3, 4 and 13). The app matches the listing
-- against saved searches with browse's own listingMatches (CLAUDE.md: SQL never copies browse's search rules) and
-- passes the ids that match, with each one's label and results link (savedSearchLabel and savedSearchHref(…, "new")) in
-- p_texts: {"<search id>": {"label": …, "href": …}}. Here, the rest: the listing still has buyers (published, first
-- published, available, not hidden, its shop approved); paused searches and the shop owner's own are skipped; each
-- account hears once, under its oldest matching search, through notify_once_per_day. How many accounts it told.
-- A matching search with no label or link raises invalid_parameter_value.
-- Server only: the service role (the only function that takes wording; plan decision 4).
create function public.record_search_matches(p_listing_id text, p_search_ids text[], p_texts jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  listing public.listings;
  owner uuid;
  search record;
  v_label text;
  v_href text;
  told int := 0;
begin
  select l.* into listing from public.listings l
  where l.id = p_listing_id and l.state = 'available' and l.first_published_at is not null and l.hidden_at is null
    and private.shop_status(l.shop_id) = 'approved';
  if listing.id is null then
    return 0;
  end if;
  owner := (select s.owner_id from public.shops s where s.id = listing.shop_id);
  for search in
    select distinct on (ss.account_id) ss.id, ss.account_id
    from public.saved_searches ss
    where ss.id = any (coalesce(p_search_ids, '{}')) and ss.paused_at is null and ss.account_id is distinct from owner
    order by ss.account_id, ss.created_at, ss.id
  loop
    v_label := p_texts -> search.id ->> 'label';
    v_href := p_texts -> search.id ->> 'href';
    if coalesce(v_label, '') = '' or coalesce(v_href, '') = '' then
      raise exception 'saved search % needs its label and link', search.id using errcode = 'invalid_parameter_value';
    end if;
    if private.notify_once_per_day(
      search.account_id, 'search-match', search.id, private.search_match_note_text(listing.title, v_label),
      '/listings/' || listing.id, v_label, v_href
    ) then
      told := told + 1;
    end if;
  end loop;
  return told;
end;
$$;

-- --- Listings, replaced (phase A's actions migration) ----------------------------------------------------------------

-- Saves a new or changed listing (saveOwnListing; selling spec 2.10, plan decision 3), as phase A's, which it replaces,
-- with one addition: a first publish (a new listing, or a draft published for the first time) by an approved shop of a
-- listing the Hub hasn't hidden tells the shop's followers, once a day each (private.tell_followers; saveListingForm,
-- lib/selling/listing-actions.ts:242). Edits, relists, a paused shop's publish, and a listing published again after a
-- save back to draft tell nobody. Matching saved searches is the app's, after this (record_search_matches).
-- - the state: Save as draft drafts; Save and publish makes a new listing or a draft available and keeps a paused or
--   sold one as it is (nextState). A shop waiting for approval saves drafts only (plan decision 4);
-- - a draft's created_at moves to when it's first published, and first_published_at is set then, for good
--   (amendment 9.2);
-- - a pickup is at one of the shop's live points (the check the table can't make);
-- - p_photos is the photos in order, the cover first: [{"photo_id": …, "alt": …} or {"placeholder_src": …, "alt": …}],
--   at most six. A photo is the seller's own, waiting (less than a day old) or already this listing's; a placeholder
--   only one the listing already has. The photos it no longer uses are deleted.
-- Returns jsonb:
--   {"result": "saved", "listing_id", "state", "first_publish", "removed_paths"}  (first_publish is isFirstPublish)
--   {"result": "no-shop"}         the account has no shop
--   {"result": "not-found"}       p_listing_id isn't one of the shop's: saveOwnListing's null
--   {"result": "pickup-invalid"}  the pickup point isn't one of the shop's
--   {"result": "photos-invalid"}  a photo or placeholder it may not use, a repeat, or more than six. Two saves claiming
--                                 the same waiting photo at once: the photos are locked before they're checked, so
--                                 the second waits and then finds it taken (and a clash that slips past is caught)
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.save_listing(
  p_listing_id text, p_kind text, p_title text, p_category_slug text, p_condition text, p_price_zar integer,
  p_price_is_from boolean, p_pay_mode text, p_swap_for text, p_description text, p_handover text,
  p_pickup_point_id uuid, p_photos jsonb, p_publish boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid := private.signed_in();
  shop uuid := private.shop_of(owner);
  shop_campus text;
  existing public.listings;
  photo_list jsonb := coalesce(p_photos, '[]'::jsonb);
  photo_ids uuid[];
  pickup uuid := case when p_handover = 'pickup' then p_pickup_point_id end;
  new_state text;
  first_publish boolean;
  saved text;
  removed text[];
  failed text;
begin
  if shop is null then
    return '{"result": "no-shop"}'::jsonb;
  end if;
  select s.campus_slug into shop_campus from public.shops s where s.id = shop;
  if p_listing_id is not null then
    select * into existing from public.listings l where l.id = p_listing_id and l.shop_id = shop for update;
    if not found then
      return '{"result": "not-found"}'::jsonb;
    end if;
  end if;
  if p_handover = 'pickup' and not exists (
    select 1 from public.shop_pickup_points sp join public.pickup_points pp on pp.id = sp.pickup_point_id
    where sp.shop_id = shop and sp.pickup_point_id = pickup and pp.retired_at is null
  ) then
    return '{"result": "pickup-invalid"}'::jsonb;
  end if;

  -- The photos it names are locked first, so another save can't claim one between this check and this save's write.
  -- The check below is a new statement, so it sees what a save it waited for did.
  if jsonb_typeof(photo_list) = 'array' then
    perform 1 from public.photos p
    where p.owner_id = owner and p.id in (
      select (e.x ->> 'photo_id')::uuid from jsonb_array_elements(photo_list) e(x) where jsonb_typeof(e.x) = 'object' and e.x ? 'photo_id'
    )
    order by p.id
    for update;
  end if;

  -- The photos: an array of at most six objects, each a photo it may use or a placeholder it already has, no repeats.
  if jsonb_typeof(photo_list) <> 'array' or jsonb_array_length(photo_list) > 6 or exists (
    select 1 from jsonb_array_elements(photo_list) e(x)
    where jsonb_typeof(e.x) <> 'object'
      or ((e.x ? 'photo_id') = (e.x ? 'placeholder_src'))
      or (e.x ? 'photo_id' and not coalesce(private.photo_usable(
        owner, (e.x ->> 'photo_id')::uuid, case when existing.id is null then '{}' else array[private.listing_use(existing.id)] end
      ), false))
      or (e.x ? 'placeholder_src' and not exists (
        select 1 from public.listing_photos lp where lp.listing_id = existing.id and lp.placeholder_src = e.x ->> 'placeholder_src'
      ))
  ) or (
    select count(*) <> count(distinct coalesce(e.x ->> 'photo_id', e.x ->> 'placeholder_src'))
    from jsonb_array_elements(photo_list) e(x)
  ) then
    return '{"result": "photos-invalid"}'::jsonb;
  end if;
  photo_ids := array(select (e.x ->> 'photo_id')::uuid from jsonb_array_elements(photo_list) e(x) where e.x ? 'photo_id');

  new_state := case
    when not coalesce(p_publish, false) or private.shop_status(shop) = 'pending' then 'draft'
    when existing.state in ('paused', 'sold') then existing.state
    else 'available'
  end;
  first_publish := new_state <> 'draft' and (existing.id is null or existing.first_published_at is null);

  -- One block, so a clash on a photo (listing_photos_photo_id_key) undoes the listing's save too.
  begin
    if existing.id is null then
      insert into public.listings (
        shop_id, state, kind, title, category_slug, condition, price_zar, price_is_from, pay_mode, swap_for, description,
        handover, pickup_point_id, campus_slug, created_at, first_published_at, updated_at
      )
      values (
        shop, new_state, p_kind, p_title, p_category_slug, p_condition, p_price_zar, coalesce(p_price_is_from, false),
        p_pay_mode, p_swap_for, p_description, p_handover, pickup, shop_campus, now(),
        case when first_publish then now() end, now()
      )
      returning id into saved;
    else
      update public.listings set
        state = new_state, kind = p_kind, title = p_title, category_slug = p_category_slug, condition = p_condition,
        price_zar = p_price_zar, price_is_from = coalesce(p_price_is_from, false), pay_mode = p_pay_mode,
        swap_for = p_swap_for, description = p_description, handover = p_handover, pickup_point_id = pickup,
        campus_slug = shop_campus,
        created_at = case when first_publish then now() else created_at end,
        first_published_at = case when first_publish then now() else first_published_at end,
        updated_at = now()
      where id = existing.id
      returning id into saved;
    end if;

    delete from public.listing_photos where listing_id = saved;
    insert into public.listing_photos (listing_id, photo_id, placeholder_src, position, alt)
    select saved, (e.x ->> 'photo_id')::uuid, e.x ->> 'placeholder_src', (e.ord - 1)::smallint, coalesce(e.x ->> 'alt', '')
    from jsonb_array_elements(photo_list) with ordinality e(x, ord);
    update public.photos set use = private.listing_use(saved) where id = any (photo_ids);
  exception when unique_violation then
    get stacked diagnostics failed = constraint_name;
    if failed = 'listing_photos_photo_id_key' then
      return '{"result": "photos-invalid"}'::jsonb;
    end if;
    raise;
  end;
  removed := private.delete_photos_used_by(owner, private.listing_use(saved), photo_ids);

  -- A first publish by an open shop of a listing buyers can see tells its followers (community actions plan decision
  -- 15 and amendment 1): the same condition as the app's, so a hidden listing or a paused or waiting shop tells nobody.
  if first_publish and private.shop_status(shop) = 'approved'
    and exists (select 1 from public.listings l where l.id = saved and l.hidden_at is null)
  then
    perform private.tell_followers(shop, saved);
  end if;

  return jsonb_build_object(
    'result', 'saved', 'listing_id', saved, 'state', new_state, 'first_publish', first_publish,
    'removed_paths', to_jsonb(removed)
  );
end;
$$;

-- Delete listing (deleteOwnListing, lib/data/own-listings.ts:106; selling spec 2.9), as phase A's, which it replaces,
-- with one addition: the new-listing and search-match notifications that lead to it go, since they'd only lead to a
-- 404 (search alerts plan amendment 11); those that lead to the shop or a search's results stay. The listing and its
-- photos go; conversations keep its title.
-- Returns jsonb {"result": "deleted", "removed_paths"} or {"result": "not-found"} (not the shop's).
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.delete_listing(p_listing_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid := private.signed_in();
  gone text;
begin
  delete from public.listings where id = p_listing_id and shop_id = private.shop_of(owner) returning id into gone;
  if gone is null then
    return '{"result": "not-found"}'::jsonb;
  end if;
  delete from public.notifications n
  where n.kind in ('new-listing', 'search-match') and n.href = '/listings/' || gone;
  return jsonb_build_object(
    'result', 'deleted', 'removed_paths', to_jsonb(private.delete_photos_used_by(owner, private.listing_use(gone), '{}'))
  );
end;
$$;

-- --- A shop's link, Task 1's helper extended (moveShop, lib/data/shops.ts:67) ----------------------------------------

-- What follows a shop from one link to another, after its row has moved, as Task 1's, which it replaces, with the
-- followers' new-listing notifications added (shops.ts:100): they name the shop by its link, so they move to the new
-- one, and a link to the shop's page moves with them (a link to a listing stays). A new-listing notification already
-- on the new link can only be about a shop that has gone (the link was free), so it goes first, and the move can't
-- meet notifications_once_a_day. With `keep_old` (the seller's one change of link) the old link is kept, reserved; a
-- waiting shop's link that follows its name keeps none. Reports about the shop follow it, but not those about a shop
-- that had the link before and has gone (shops.ts:87). Conversations, pins and follows point at the shop's id.
create or replace function private.shop_link_moved(shop uuid, from_slug text, to_slug text, keep_old boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if keep_old then
    insert into public.shop_previous_slugs (slug, shop_id) values (from_slug, shop);
  end if;
  update public.reports
  set target_id = to_slug
  where target_kind = 'seller' and target_id = from_slug and not target_gone;
  delete from public.notifications n where n.kind = 'new-listing' and n.subject_id = to_slug;
  update public.notifications n
  set subject_id = to_slug,
    href = case when n.href = '/sellers/' || from_slug then '/sellers/' || to_slug else n.href end
  where n.kind = 'new-listing' and n.subject_id = from_slug;
end;
$$;

-- --- Reports, replaced (Task 4's) ------------------------------------------------------------------------------------

-- Send report (spec 3.4, plan decision 17), as Task 4's, which it replaces, except for requests (Task 4's open question
-- 1, recommended answer): with requests in the database, a request's title comes from the table, as a listing's and a
-- shop's do, never from the caller (p_target_title is ignored, and stays only so the signature doesn't change), and a
-- request is reported only while it has a page, open or closed, not hidden (reportSubject's getRequest). A report about
-- something that has gone doesn't count as the account's open report on the target. The reporter's reports are taken
-- one at a time (their profile row is locked), so two at once can't both take the 10th.
-- Returns:
--   'created'
--   'already-open'  the account has an open report on it: sendReport goes straight to the thank-you, storing nothing
--   'rate-limited'  the 11th in 24 hours: sendReport's "report-rate" error
--   'not-found'     no such public listing or shop, or no request with a page: reportSubject's null
-- A user action (advisor 0029 lists it on purpose).
create or replace function public.create_report(
  p_target_kind text, p_target_id text, p_target_title text, p_reason text, p_detail text default ''
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reporter uuid := private.require_profile();
  title text;
  made uuid;
begin
  if p_target_kind is null or p_target_kind not in ('listing', 'seller', 'request') then
    raise exception 'a report is about a listing, a seller or a request' using errcode = 'invalid_parameter_value';
  end if;
  if p_reason is null or p_reason not in ('scam', 'prohibited', 'misleading', 'offensive', 'harassment', 'spam', 'other') then
    raise exception 'a report has one of the seven reasons' using errcode = 'check_violation';
  end if;
  if char_length(coalesce(p_detail, '')) > 500 then
    raise exception 'a report''s detail is at most 500 characters' using errcode = 'check_violation';
  end if;
  perform 1 from public.profiles p where p.id = reporter for update;

  title := case p_target_kind
    when 'listing' then (
      select l.title from public.listings l
      where l.id = p_target_id and l.state <> 'draft' and private.shop_is_public(l.shop_id)
    )
    when 'seller' then (select s.name from public.shops s where s.slug = p_target_id and private.shop_is_public(s.id))
    else (select q.title from public.requests q where q.id = p_target_id and q.hidden_at is null)
  end;
  if title is null then
    return 'not-found';
  end if;
  if exists (
    select 1 from public.reports r
    where r.reporter_id = reporter and r.target_kind = p_target_kind and r.target_id = p_target_id
      and r.status = 'open' and not r.target_gone
  ) then
    return 'already-open';
  end if;
  if (
    select count(*) from public.reports r where r.reporter_id = reporter and r.created_at > now() - interval '24 hours'
  ) >= 10 then
    return 'rate-limited';
  end if;
  insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, detail)
  values (reporter, p_target_kind, p_target_id, title, p_reason, coalesce(p_detail, ''))
  on conflict (reporter_id, target_kind, target_id) where status = 'open' and not target_gone do nothing
  returning id into made;
  return case when made is null then 'already-open' else 'created' end;
end;
$$;

-- --- Grants ---------------------------------------------------------------------------------------------------------

-- The private helpers run only inside the functions above (as their owner). The replaced ones keep their grants.
revoke all on function
  private.offer_note_text(text, text), private.new_listing_note_text(text, text),
  private.new_listings_note_text(text, integer), private.search_match_note_text(text, text),
  private.search_matches_note_text(integer, text), private.once_a_day_more_text(text, integer, text),
  private.notify_once_per_day(uuid, text, text, text, text, text, text), private.once_token_taken(text),
  private.shop_has_storefront(uuid), private.conversation_title(uuid), private.tell_followers(uuid, text)
from public, anon, authenticated, service_role;

-- User actions: signed-in students (and the service role), never anon.
revoke all on function
  public.save_request(text, text, text, text, text, integer, boolean, date, text),
  public.set_request_open(text, boolean), public.delete_request(text), public.start_offer(text, text, text),
  public.follow_shop(uuid), public.unfollow_shop(uuid),
  public.save_search(text, text, text, text, text, text, text), public.set_search_paused(text, boolean),
  public.delete_search(text)
from public, anon;
grant execute on function
  public.save_request(text, text, text, text, text, integer, boolean, date, text),
  public.set_request_open(text, boolean), public.delete_request(text), public.start_offer(text, text, text),
  public.follow_shop(uuid), public.unfollow_shop(uuid),
  public.save_search(text, text, text, text, text, text, text), public.set_search_paused(text, boolean),
  public.delete_search(text)
to authenticated, service_role;

-- The server's: the service role only.
revoke all on function public.record_search_matches(text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.record_search_matches(text, text[], jsonb) to service_role;
