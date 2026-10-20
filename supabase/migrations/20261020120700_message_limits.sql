-- Stage K's message limits (supabase schema catch-up plan, Task 9 and decision 9; stage K spec decisions 8 to 11):
-- at most CONVERSATIONS_PER_DAY (40) conversations started in any 24 hours, and MESSAGES_PER_HOUR (120) messages in
-- any hour (lib/messaging/rules.ts), as messageLimitErrors (lib/messaging/limits.ts) checks them in the composer's
-- Send, a reply and the offer composer's Send. Also create_report's refusal of a hidden listing (found in Task 6b).
--
-- - Both windows slide ("in the last 24 hours", not "today"), so nothing resets at midnight. The counts mirror
--   countConversationsStartedSince and countMessagesSentSince (lib/data/messages.ts:176-200).
-- - Every account meets them, staff and the sample accounts included: the app exempts the sample accounts only in
--   sample mode, so the database has no exemption (plan decision 9).
-- - The counts and the write run under an advisory lock on the sender (stage K spec decision 11), so posts sent at the
--   same moment can't slip past: pg_advisory_xact_lock(hashtext('vossie:messages:<account>'), 1). The second key, 1,
--   is this lock's own namespace: every other Vossie lock is (hashtext(key), 0) or the one-key form
--   ('vossie.shop_links'), which Postgres keeps apart from the two-key form, so it can't meet them even when two keys
--   hash alike. Two accounts whose keys hash alike only wait for each other.
-- - The lock is taken before any conversation row is locked (send_message takes it before its FOR UPDATE), and
--   start_offer takes it after the shop's offers lock, so two locks are always taken in the same order.
-- - Phase A's and Tasks 3, 4 and 6's functions replaced here, each diffed against its latest definition and otherwise
--   unchanged, with their grants kept (CREATE OR REPLACE keeps them): start_conversation (Task 3), send_message,
--   start_offer and create_report (Task 6).

-- --- The counts and the check (lib/messaging/limits.ts) -----------------------------------------------------------------

-- Takes the message limits' lock on the sender until the transaction ends. Taking it again is harmless.
create function private.lock_sender(account uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('vossie:messages:' || account::text), 1);
$$;

-- How many conversations `account` started as a buyer after `since` (countConversationsStartedSince): enquiries and
-- questions to a shop, never offers (is_offer, which a deleted request doesn't clear). A message that joins one the
-- buyer already has makes no row, so it isn't counted.
create function private.conversations_started_since(account uuid, since timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer from public.conversations c
  where c.buyer_id = account and not c.is_offer and c.created_at > since;
$$;

-- How many messages `account` sent after `since` (countMessagesSentSince): as the buyer in its own conversations, and
-- as the seller in its shop's while the seller hasn't gone. Offers' first messages count for the shop. Two counts, so
-- each starts from the conversations' buyer or shop index and the messages' (conversation_id, sent_at) index.
create function private.messages_sent_since(account uuid, since timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select (
    select count(*) from public.conversations c join public.messages m on m.conversation_id = c.id
    where c.buyer_id = account and m.side = 'buyer' and m.sent_at > since
  )::integer + (
    select count(*) from public.conversations c join public.messages m on m.conversation_id = c.id
    where c.shop_id = (select sp.shop_id from public.seller_profiles sp where sp.account_id = account)
      and not c.seller_gone and m.side = 'seller' and m.sent_at > since
  )::integer;
$$;

-- messageLimitErrors, under the sender's lock: null when the post may go, else the one limit it meets. The
-- conversations limit first, and only when the post would start a conversation; then the hour's messages.
create function private.message_limit_error(account uuid, new_conversation boolean)
returns text
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform private.lock_sender(account);
  -- CONVERSATIONS_PER_DAY, over DAY_MS.
  if new_conversation and private.conversations_started_since(account, now() - interval '24 hours') >= 40 then
    return 'conversation-rate';
  end if;
  -- MESSAGES_PER_HOUR, over HOUR_MS.
  if private.messages_sent_since(account, now() - interval '1 hour') >= 120 then
    return 'message-rate';
  end if;
  return null;
end;
$$;

-- --- start_conversation, replaced (Task 3's) ------------------------------------------------------------------------

-- A buyer's first message (startConversation; spec 2.1, 2.2 and 2.4), as Task 3's, which it replaces, with stage K's
-- limits after the subject's checks and before the write, as sendFirstMessage checks them after the fields: a post that
-- would start a conversation meets the 40 a day first; one that joins the buyer's conversation (findConversation)
-- meets only the hour's messages. Whether it's new is decided under the sender's lock, so two posts about one listing
-- at the same moment don't both count as new.
-- Returns jsonb as Task 3's, plus {"result": "conversation-rate" | "message-rate"} (MessageLimitError).
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
  refusal text;
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
    perform private.lock_sender(buyer);
    refusal := private.message_limit_error(buyer, not exists (
      select 1 from public.conversations c
      where c.buyer_id = buyer and c.listing_id = listing.id and not c.seller_gone and not c.is_offer
    ));
    if refusal is not null then
      return jsonb_build_object('result', refusal);
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
    perform private.lock_sender(buyer);
    refusal := private.message_limit_error(buyer, not exists (
      select 1 from public.conversations c
      where c.buyer_id = buyer and c.shop_id = shop and c.listing_title is null and not c.seller_gone
        and not c.is_offer
    ));
    if refusal is not null then
      return jsonb_build_object('result', refusal);
    end if;
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

-- --- send_message, replaced (Task 6's) ------------------------------------------------------------------------------

-- A message in a thread (sendMessage, lib/data/messages.ts; spec 3.3), as Task 6's, which it replaces, with the hour's
-- messages (sendReply's messageLimitErrors with newConversation false) after its own refusals and before the write:
-- 'message-rate'. The sender's lock is taken before the conversation's row is locked.
-- Returns sendMessage's SendResult as Task 6's ('sent', 'not-found', 'closed', 'waiting'), plus 'message-rate'.
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
  sender uuid;
  refusal text;
begin
  sender := private.signed_in();
  if p_body is null or btrim(p_body, E' \t\n\r') = '' then
    raise exception 'a message is not empty' using errcode = 'check_violation';
  end if;
  perform private.lock_sender(sender);
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
  refusal := private.message_limit_error(sender, false);
  if refusal is not null then
    return refusal;
  end if;
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

-- --- start_offer, replaced (Task 6's) -------------------------------------------------------------------------------

-- Send offer (community actions spec 2.7 to 2.9), as Task 6's, which it replaces, with the hour's messages after the
-- shop's 20 offers a day and before the write, as sendOffer checks them (plan decision 14 of the community actions
-- plan): {"result": "message-rate"}. The offer's first message is the shop's, so it counts for the shop's owner.
-- Returns jsonb as Task 6's, plus {"result": "message-rate"}.
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

-- --- Reports, replaced (Task 6's) -----------------------------------------------------------------------------------

-- Send report (spec 3.4), as Task 6's, which it replaces, except that a listing the Hub has hidden has no page to report
-- (reportSubject through publicListing, lib/data/catalog.ts:114): 'not-found', as a draft is.
-- Returns 'created', 'already-open', 'rate-limited' or 'not-found', as Task 6's.
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
      where l.id = p_target_id and l.state <> 'draft' and l.hidden_at is null and private.shop_is_public(l.shop_id)
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

-- The helpers run only inside the functions above (as their owner). The replaced functions keep their grants.
revoke all on function
  private.lock_sender(uuid), private.conversations_started_since(uuid, timestamptz),
  private.messages_sent_since(uuid, timestamptz), private.message_limit_error(uuid, boolean)
from public, anon, authenticated, service_role;
