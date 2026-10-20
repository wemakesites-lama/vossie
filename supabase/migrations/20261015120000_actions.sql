-- The atomic writes (supabase foundation plan, Task 9; backend spec 4.4 and 4.5): every change the app makes to
-- profiles, messaging, reports, shops, listings and photos, as one Postgres function per action, so each rule lives in
-- one place and a check and its write can never be split by another request.
--
-- How they're called, and why they're in `public`:
-- - The Data API only exposes `public` (config.toml), so the functions the app calls live here; their shared logic is
--   in `private` helpers, which nobody but these functions (running as their owner) can call.
-- - Each is `security definer` with `search_path = ''`, names every object with its schema, and takes the account from
--   the session (`auth.uid()`), never from an argument.
-- - Two kinds, by grant:
--   - user actions, called through the viewer client as the signed-in student: EXECUTE for authenticated (and the
--     service role), never anon. Supabase's security advisor lists security definer functions that authenticated can
--     run (lint 0029); for these that is the point: each checks who is asking and what they may change.
--   - the server's, called only with the admin client (sign-in counters, account deletion, the 7-day job):
--     EXECUTE for the service role only.
-- - Expected refusals are return values that map one to one onto today's TypeScript results (lib/data/*.ts), noted
--   above each function. Exceptions are for programmer errors only: a value the app should have checked first (a
--   message's length, a reason, a slug's shape) still hits the table's check constraints, and raises.
-- - "Now" is the transaction's time, now(). Only the server's settle_auto_confirm takes a time, for its tests.

-- --- A fix to the selling migration --------------------------------------------------------------------------------

-- The onboarding wizard keeps what was typed after an error so the form can show it again (keepTyped in
-- lib/selling/shop-actions.ts: up to 4,000 characters per field), so a draft's text can be longer than a shop's.
-- The shop's own limits are checked when the application is sent (create_shop, and the shops table).
alter table public.onboarding_drafts
  drop constraint onboarding_drafts_name_check,
  drop constraint onboarding_drafts_tagline_check,
  drop constraint onboarding_drafts_about_check,
  add constraint onboarding_drafts_name_check check (char_length(name) <= 4000),
  add constraint onboarding_drafts_tagline_check check (char_length(tagline) <= 4000),
  add constraint onboarding_drafts_about_check check (char_length(about) <= 4000);

-- --- Shared helpers (private) --------------------------------------------------------------------------------------

-- The signed-in account, or an error when nobody is signed in. Volatile, so the planner never runs it early (while
-- estimating a query) and raises before the function body asks.
create function private.signed_in()
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  account uuid := (select auth.uid());
begin
  if account is null then
    raise exception 'nobody is signed in' using errcode = 'insufficient_privilege';
  end if;
  return account;
end;
$$;

-- The signed-in account, when it has finished signing in (it has a profile); otherwise an error. Actions that make rows
-- owned by the account need the profile, which those rows point at.
create function private.require_profile()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
begin
  if not exists (select 1 from public.profiles p where p.id = account) then
    raise exception 'this account has not finished signing in' using errcode = 'insufficient_privilege';
  end if;
  return account;
end;
$$;

-- The shop the account owns (its seller profile points at it, and it is the shop's owner), or null.
create function private.shop_of(account uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.seller_profiles sp
  join public.shops s on s.id = sp.shop_id and s.owner_id = sp.account_id
  where sp.account_id = account;
$$;

-- A thread's address (threadPath in lib/messaging/paths.ts).
create function private.thread_path(conv uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select '/messages/' || conv::text;
$$;

-- A message notification's sentence (messageNoteText in lib/messaging/notification-text.ts).
create function private.message_note_text(sender text, listing_title text, first boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when listing_title is not null then sender || case when first then ' asked' else ' replied' end || ' about ' || listing_title
    when first then sender || ' asked your shop a question'
    else sender || ' replied'
  end;
$$;

-- A sale to confirm's sentence (saleNoteText).
create function private.sale_note_text(shop text, listing_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select shop || ' marked ' || coalesce(listing_title, 'your enquiry') || ' as done. Did the sale happen?';
$$;

-- Tells an account about a message in a conversation (notifyAboutMessage, plan decision 12): while its last message
-- notification for the conversation is unread, that one is brought up to date (sentence and time) instead.
create function private.notify_message(account uuid, conv uuid, sentence text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.notifications as n (account_id, kind, subject_id, text, href)
  values (account, 'message', conv::text, sentence, private.thread_path(conv))
  on conflict (account_id, subject_id) where kind = 'message' and read_at is null
  do update set text = excluded.text, created_at = excluded.created_at;
$$;

-- Tells the other side about a message from `from_side` (tellOtherSide in lib/data/messages.ts). The seller is whoever
-- owns the shop now; a shop with no owner, or whose owner has gone, has no one to tell. A buyer is still "asking"
-- until someone has replied (messaging plan amendment 3).
create function private.tell_other_side(conv uuid, from_side text)
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
    recipient, conv, private.message_note_text(sender, c.listing_title, from_side = 'buyer' and c.status = 'asked')
  );
end;
$$;

-- A settled sale's "sale to confirm" notification is read (markSaleNotificationsRead, messaging plan amendment 3).
create function private.read_sale_notes(account uuid, conv uuid, at timestamptz)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.notifications
  set read_at = at
  where account_id = account and kind = 'sale-to-confirm' and subject_id = conv::text and read_at is null;
$$;

-- A sale marked done confirms itself 7 days (168 hours, whatever the time zone) after (settle in lib/data/messages.ts,
-- spec 2.5), as of the moment it was due. True when this call settled it.
create function private.settle_conversation(conv uuid, at timestamptz)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  buyer uuid;
begin
  update public.conversations
  set status = 'confirmed', confirmed_at = completed_at + interval '168 hours', confirmed_by = 'auto'
  where id = conv and status = 'done' and completed_at + interval '168 hours' <= at
  returning buyer_id into buyer;
  if not found then
    return false;
  end if;
  if buyer is not null then
    perform private.read_sale_notes(buyer, conv, at);
  end if;
  return true;
end;
$$;

-- A shop's link from its name (slugify in lib/selling/rules.ts): the name's a to z and digits joined by hyphens, at
-- most 40; a shorter one than 3 gets "-shop", and a name with none is "shop".
create function private.slugify(name text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case when char_length(s) >= 3 then s when s <> '' then s || '-shop' else 'shop' end
  from (
    select regexp_replace(
      left(regexp_replace(regexp_replace(private.name_key(name), '[^a-z0-9]+', '-', 'g'), '^-+', ''), 40),
      '-+$', ''
    ) as s
  ) x;
$$;

-- A link no other shop has, from `base` (freeSlug in lib/data/shops.ts): "crochet-corner", then "crochet-corner-2" and
-- so on. `own` keeps its own. The caller holds the shop-link lock (private.lock_shop_links).
create function private.free_shop_slug(base text, own uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  suffix text;
  candidate text;
begin
  for n in 1..100000 loop
    suffix := case when n = 1 then '' else '-' || n end;
    candidate := regexp_replace(left(base, 40 - char_length(suffix)), '-+$', '') || suffix;
    if not exists (select 1 from public.shops s where s.slug = candidate and s.id is distinct from own) then
      return candidate;
    end if;
  end loop;
  raise exception 'no free link for %', base;
end;
$$;

-- One writer of shop links at a time, so "is this link free?" and taking it can't be split.
create function private.lock_shop_links()
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('vossie.shop_links'));
$$;

-- The live pickup points among `ids` at a campus, each once, in the order given.
create function private.campus_points(campus text, ids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id order by first_seen), '{}')
  from (
    select u.id, min(u.ord) as first_seen
    from unnest(coalesce(ids, '{}')) with ordinality as u(id, ord)
    where exists (
      select 1 from public.pickup_points p where p.id = u.id and p.campus_slug = campus and p.retired_at is null
    )
    group by u.id
  ) s;
$$;

-- Whether `ids` fit a shop on `campus` (readCampusAndSpots and draftProblems in lib/selling/shop-actions.ts): every one
-- is a live point there, and a campus with points needs at least one.
create function private.points_fit(campus text, ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select cardinality(private.campus_points(campus, ids)) = cardinality(array(select distinct unnest(coalesce(ids, '{}'))))
    and (
      cardinality(coalesce(ids, '{}')) > 0
      or not exists (select 1 from public.pickup_points p where p.campus_slug = campus and p.retired_at is null)
    );
$$;

-- Whether `account` may use a photo: theirs, and either already used for one of `uses`, or waiting on a form and less
-- than a day old (amendment 9.5: a waiting photo is gone for good after a day).
create function private.photo_usable(account uuid, photo uuid, uses text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.photos p
    where p.id = photo and p.owner_id = account
      and (p.use = any (uses) or (p.use is null and p.created_at > now() - interval '24 hours'))
  );
$$;

-- Deletes `account`'s photos with this use, except those in `keep` (deletePhotosUsedBy), and gives back their files'
-- paths, sorted, for the caller to delete from Storage.
create function private.delete_photos_used_by(account uuid, photo_use text, keep uuid[])
returns text[]
language sql
volatile
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.photos p
    where p.owner_id = account and p.use = photo_use and not (p.id = any (coalesce(keep, '{}')))
    returning p.path
  )
  select coalesce(array_agg(path order by path), '{}') from gone;
$$;

-- What a listing's photos are used for (listingPhotoUse).
create function private.listing_use(listing text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'listing:' || listing;
$$;

-- --- Profiles (lib/data/accounts.ts createAccount, updateAccountDetails and recordConsent; lib/auth/profile.ts) -----

-- A first name and campus as the app's checks pass them (checkFirstName and checkCampus), or invalid_parameter_value:
-- the first name as checkFirstName leaves it (private.is_first_name, also the column's check), and a known campus.
create function private.check_profile(first_name text, campus_slug text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not coalesce(private.is_first_name(first_name), false) then
    raise exception 'a first name is 2 to 40 characters, tidied, with a letter' using errcode = 'invalid_parameter_value';
  end if;
  if campus_slug is null or not exists (select 1 from public.campuses c where c.slug = campus_slug) then
    raise exception 'unknown campus' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

-- A policy version the student can agree to (private.policy_versions), or invalid_parameter_value.
create function private.check_policy_version(version text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if version is null or not exists (select 1 from private.policy_versions v where v.version = check_policy_version.version) then
    raise exception 'not a version of the privacy policy' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

-- Step 3 of a first sign-in (accounts spec 2.6 and 2.7): makes the signed-in account's profile, unless it has one
-- (an email has one account, ever, so a second post never overwrites the name or campus), and records consent to the
-- policy version, once per version, agreed now.
-- Returns true when the profile was made, false when it already existed (createAccount's "that account is returned").
-- A name, campus or version the app's checks would refuse raises invalid_parameter_value.
-- A user action (advisor 0029 lists it on purpose).
create function public.complete_profile(p_first_name text, p_campus_slug text, p_policy_version text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
  made boolean;
begin
  perform private.check_profile(p_first_name, p_campus_slug);
  perform private.check_policy_version(p_policy_version);
  insert into public.profiles (id, first_name, campus_slug)
  values (account, p_first_name, p_campus_slug)
  on conflict (id) do nothing
  returning true into made;
  insert into public.consents (account_id, version)
  values (account, p_policy_version)
  on conflict (account_id, version) do nothing;
  return coalesce(made, false);
end;
$$;

-- "Edit details" on the account page (updateAccountDetails; accounts spec 3.2): the first name and campus, checked as
-- step 3 checks them. Returns true when saved, false when the account has no profile (updateAccountDetails' null:
-- it has gone, or never finished signing in). A name or campus the app would refuse raises invalid_parameter_value.
-- A user action (advisor 0029 lists it on purpose).
create function public.update_profile(p_first_name text, p_campus_slug text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
begin
  perform private.check_profile(p_first_name, p_campus_slug);
  update public.profiles set first_name = p_first_name, campus_slug = p_campus_slug where id = account;
  return found;
end;
$$;

-- Consent at a returning sign-in (finishSignIn in lib/auth/actions.ts records it at every sign-in, for the current
-- version): once per account and version, agreed now. Returns true when it was recorded, false when it already was.
-- No profile raises insufficient_privilege (the account hasn't finished signing in: complete_profile records it then).
-- An unknown version raises invalid_parameter_value.
-- A user action (advisor 0029 lists it on purpose).
create function public.record_consent(p_policy_version text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.require_profile();
  made uuid;
begin
  perform private.check_policy_version(p_policy_version);
  insert into public.consents (account_id, version)
  values (account, p_policy_version)
  on conflict (account_id, version) do nothing
  returning id into made;
  return made is not null;
end;
$$;

-- --- Messaging (lib/data/messages.ts and notifications.ts) ----------------------------------------------------------

-- A buyer's first message (startConversation; spec 2.1, 2.2 and 2.4), about a listing or, with p_shop_slug instead, a
-- question to the shop. It joins the buyer's open conversation about the same listing (or with the shop's questions)
-- when there is one (plan decision 5); otherwise a new one starts, Asked. The swap offer is kept only when the listing
-- takes swaps. The shop's owner is told.
-- Returns jsonb:
--   {"result": "started" | "added", "conversation_id": …}  startConversation's { conversationId, created: true | false }
--   {"result": "not-found"}  no such public listing (drafts and pending shops' aren't) or shop: composerSubject's null
--   {"result": "own-shop"}   the buyer owns the shop (the composer's own-shop check)
--   {"result": "closed"}     the listing is paused or sold, or its shop is paused: a listing in a paused shop shows as
--                            paused (toListing in lib/data/catalog.ts), so subject.open is false. A question to a
--                            paused shop is still fine (composerSubject's open is true for a shop)
-- A user action (advisor 0029 lists it on purpose).
create function public.start_conversation(p_listing_id text, p_shop_slug text, p_body text, p_swap_offer text)
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
    where l.id = p_listing_id and l.state <> 'draft' and private.shop_is_public(l.shop_id);
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
    on conflict (buyer_id, listing_id) where buyer_id is not null and not seller_gone and listing_id is not null
    do nothing
    returning id into conv;
    if conv is null then
      made := false;
      select c.id into conv from public.conversations c
      where c.buyer_id = buyer and c.listing_id = listing.id and not c.seller_gone
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
    on conflict (buyer_id, shop_id) where buyer_id is not null and not seller_gone and listing_title is null
    do nothing
    returning id into conv;
    if conv is null then
      made := false;
      select c.id into conv from public.conversations c
      where c.buyer_id = buyer and c.shop_id = shop and c.listing_title is null and not c.seller_gone
      for update;
    end if;
  end if;

  insert into public.messages (conversation_id, side, body, swap_offer) values (conv, 'buyer', p_body, swap);
  update public.conversations set last_message_at = now() where id = conv;
  perform private.tell_other_side(conv, 'buyer');
  return jsonb_build_object('result', case when made then 'started' else 'added' end, 'conversation_id', conv);
end;
$$;

-- A message in a thread (sendMessage; spec 3.3). A sale due to confirm itself is settled first. The seller's first
-- reply moves Asked to Replied and keeps its time (plan decision 30); the other side is told.
-- Returns sendMessage's SendResult: 'sent'; 'not-found' when the conversation isn't the account's; 'closed' when the
-- other side has left (plan decision 21).
-- A user action (advisor 0029 lists it on purpose).
create function public.send_message(p_conversation_id uuid, p_body text)
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
  perform private.settle_conversation(c.id, now());
  insert into public.messages (conversation_id, side, body) values (c.id, side, p_body);
  update public.conversations
  set last_message_at = now(),
    status = case when side = 'seller' and status = 'asked' then 'replied' else status end,
    first_reply_at = case when side = 'seller' then coalesce(first_reply_at, now()) else first_reply_at end
  where id = c.id;
  perform private.tell_other_side(c.id, side);
  return 'sent';
end;
$$;

-- The conversation locked, settled, when the account is on `side` of it and it's `status`; otherwise null
-- (saleRow in lib/data/messages.ts).
create function private.sale_row(conv uuid, side text, status text)
returns public.conversations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.conversations;
begin
  select * into c from public.conversations where id = conv for update;
  if not found or private.conversation_side(conv) is distinct from side then
    return null;
  end if;
  perform private.settle_conversation(conv, now());
  select * into c from public.conversations where id = conv;
  return case when c.status = sale_row.status then c end;
end;
$$;

-- The seller's Mark as completed (markCompleted; spec 2.5): Replied becomes Done, and the buyer is asked to confirm.
-- Returns SaleResult: 'done', or 'not-allowed' when the account isn't the seller, it isn't Replied, or the buyer has
-- left (amendment 3).
-- A user action (advisor 0029 lists it on purpose).
create function public.mark_completed(p_conversation_id uuid)
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
    private.sale_note_text(coalesce((select s.name from public.shops s where s.id = c.shop_id), 'A closed shop'), c.listing_title),
    private.thread_path(c.id)
  );
  return 'done';
end;
$$;

-- The buyer's Confirm the sale (confirmSale): Done becomes Confirmed, and the sale to confirm is read.
-- Returns 'done', or 'not-allowed' when the account isn't the buyer, it isn't Done, or the seller has left
-- (amendment 6).
-- A user action (advisor 0029 lists it on purpose).
create function public.confirm_sale(p_conversation_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.conversations := private.sale_row(p_conversation_id, 'buyer', 'done');
begin
  perform private.signed_in();
  if c.id is null or c.seller_gone then
    return 'not-allowed';
  end if;
  update public.conversations set status = 'confirmed', confirmed_at = now(), confirmed_by = 'buyer' where id = c.id;
  perform private.read_sale_notes(c.buyer_id, c.id, now());
  return 'done';
end;
$$;

-- The buyer's It didn't happen (rejectSale): back to Replied with no completion, and the sale to confirm is read.
-- Returns 'done', or 'not-allowed' as for confirm_sale.
-- A user action (advisor 0029 lists it on purpose).
create function public.reject_sale(p_conversation_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.conversations := private.sale_row(p_conversation_id, 'buyer', 'done');
begin
  perform private.signed_in();
  if c.id is null or c.seller_gone then
    return 'not-allowed';
  end if;
  update public.conversations set status = 'replied', completed_at = null where id = c.id;
  perform private.read_sale_notes(c.buyer_id, c.id, now());
  return 'done';
end;
$$;

-- Opening a thread (markThreadRead; spec 3.3): the other side's messages and the account's notifications about it
-- are read. Returns true when the thread is the account's (markThreadRead returns nothing; false means it did nothing).
-- A user action (advisor 0029 lists it on purpose).
create function public.mark_thread_read(p_conversation_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
  my_side text := private.conversation_side(p_conversation_id);
begin
  if my_side is null then
    return false;
  end if;
  update public.messages m set read_at = now()
  where m.conversation_id = p_conversation_id and m.side <> my_side and m.read_at is null;
  update public.notifications set read_at = now()
  where account_id = account and subject_id = p_conversation_id::text and read_at is null;
  return true;
end;
$$;

-- Opening /notifications (markNotificationsRead; spec 2.9): every new notification of the account's is read.
-- Returns how many were.
-- A user action (advisor 0029 lists it on purpose).
create function public.mark_notifications_read()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
  n integer;
begin
  update public.notifications set read_at = now() where account_id = account and read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- The lazy half of the 7-day auto-confirm (spec 2.5, section 7: the job runs hourly, and pages settle the account's
-- own sales when they read them, so a sale is right on screen between runs). Returns how many it settled.
-- A user action (advisor 0029 lists it on purpose).
create function public.settle_sales()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
  own uuid := private.shop_of(account);
  conv uuid;
  n integer := 0;
begin
  for conv in
    select c.id from public.conversations c
    where c.status = 'done' and c.completed_at + interval '168 hours' <= now()
      and (c.buyer_id = account or (own is not null and c.shop_id = own and not c.seller_gone))
    order by c.id
    for update
  loop
    if private.settle_conversation(conv, now()) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- The hourly job (Task 10) and the admin client: every sale due by `p_now` confirms itself. Returns how many.
-- Server only: the service role (and the job, as the owner).
create function public.settle_auto_confirm(p_now timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  conv uuid;
  n integer := 0;
begin
  for conv in
    select c.id from public.conversations c
    where c.status = 'done' and c.completed_at <= p_now - interval '168 hours'
    order by c.id
    for update skip locked
  loop
    if private.settle_conversation(conv, p_now) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- --- Reports (lib/data/reports.ts; sendReport in lib/messaging/actions.ts) ------------------------------------------

-- Send report (spec 3.4, plan decision 17): one open report per reporter and target, and at most 10 in any 24 hours.
-- A listing's or shop's title comes from the database (the action never trusts the form for it); a request's is the
-- one given until stage H brings requests into the database (reportSubject looks it up in the app), so it is checked
-- here: an id shaped as request ids are (lower case letters and digits in hyphenated words, 20 at most: "r-001", or 10
-- random characters), and a title of one clean line, 70 characters at most, as the table also checks. The reporter's
-- reports are taken one at a time (their profile row is locked), so two at once can't both take the 10th.
-- Returns:
--   'created'
--   'already-open'  the account has an open report on it: sendReport goes straight to the thank-you, storing nothing
--   'rate-limited'  the 11th in 24 hours: sendReport's "report-rate" error
--   'not-found'     no such public listing or shop, or a request id of the wrong shape: reportSubject's null
-- A request title that is empty, over 70 characters or not clean raises invalid_parameter_value.
-- A user action (advisor 0029 lists it on purpose).
create function public.create_report(
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

  if p_target_kind = 'request' then
    if p_target_id is null or p_target_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_target_id) > 20 then
      return 'not-found';
    end if;
    if p_target_title is null or char_length(btrim(p_target_title)) not between 1 and 70
      or not private.is_clean_line(btrim(p_target_title))
    then
      raise exception 'a request''s title is one clean line of 1 to 70 characters' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  title := case p_target_kind
    when 'listing' then (
      select l.title from public.listings l
      where l.id = p_target_id and l.state <> 'draft' and private.shop_is_public(l.shop_id)
    )
    when 'seller' then (select s.name from public.shops s where s.slug = p_target_id and private.shop_is_public(s.id))
    else nullif(btrim(p_target_title), '')
  end;
  if title is null then
    return 'not-found';
  end if;
  if exists (
    select 1 from public.reports r
    where r.reporter_id = reporter and r.target_kind = p_target_kind and r.target_id = p_target_id and r.status = 'open'
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
  on conflict (reporter_id, target_kind, target_id) where status = 'open' do nothing
  returning id into made;
  return case when made is null then 'already-open' else 'created' end;
end;
$$;

-- --- Photos (lib/data/photos.ts) ------------------------------------------------------------------------------------

-- Stores photo rows for the signed-in account, waiting on a form (storePhotos): the server then uploads each file to
-- its path with the admin client. One to six at a time, of the given types. The account's waiting photos more than a
-- day old go, and so do all but its newest 12 (the ones just made always stay).
-- Returns jsonb {"photos": [{"id", "path"}, …] in the order of p_types, "removed_paths": [the files to delete]}.
-- A user action (advisor 0029 lists it on purpose).
create function public.add_photos(p_types text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.require_profile();
  made jsonb;
  made_ids uuid[];
  removed text[];
begin
  if coalesce(cardinality(p_types), 0) not between 1 and 6 then
    raise exception 'one to six photos at a time' using errcode = 'invalid_parameter_value';
  end if;
  with new_photos as materialized (
    select gen_random_uuid() as id, u.type, u.ord from unnest(p_types) with ordinality as u(type, ord)
  ),
  stored as (
    insert into public.photos (id, owner_id, type, path)
    select n.id, account, n.type, account::text || '/' || n.id::text from new_photos n
    returning id
  )
  select
    jsonb_agg(jsonb_build_object('id', n.id, 'path', account::text || '/' || n.id::text) order by n.ord),
    array_agg(n.id)
  into made, made_ids
  from new_photos n
  where n.id in (select id from stored);

  with gone as (
    delete from public.photos p
    where p.id in (
      select w.id from (
        select q.id, q.created_at,
          row_number() over (order by (q.id = any (made_ids)) desc, q.created_at desc, q.id) as newest
        from public.photos q
        where q.owner_id = account and q.use is null
      ) w
      where not (w.id = any (made_ids)) and (w.created_at <= now() - interval '24 hours' or w.newest > 12)
    )
    returning p.path
  )
  select coalesce(array_agg(path order by path), '{}') into removed from gone;

  return jsonb_build_object('photos', made, 'removed_paths', to_jsonb(removed));
end;
$$;

-- --- Shops (lib/data/shops.ts; lib/selling/shop-actions.ts) ---------------------------------------------------------

-- Send for approval (createShop; selling spec 2.6 and 2.7): a new shop with a link made from its name, not verified,
-- a new seller since this month (SAST), and a seller profile waiting for the Hub. The wizard's draft goes; its photo,
-- if it's the one given, becomes the shop's, and the draft's other photos go.
-- Returns jsonb:
--   {"result": "created", "shop_id", "slug", "removed_paths"}
--   {"result": "has-shop"}        the account already has a seller profile: createShop's null
--   {"result": "name-taken"}      another shop on the campus has the name (plan decision 16)
--   {"result": "points-invalid"}  a pickup point isn't a live one of the campus, or a campus with points got none
--   {"result": "photo-invalid"}   the photo isn't the account's draft photo or a fresh waiting one
-- A user action (advisor 0029 lists it on purpose).
create function public.create_shop(
  p_name text, p_tagline text, p_category_slug text, p_about text, p_photo_id uuid, p_campus_slug text,
  p_pickup_point_ids uuid[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid := private.require_profile();
  shop uuid;
  link text;
  failed text;
  removed text[];
begin
  perform 1 from public.profiles p where p.id = owner for update;
  if exists (select 1 from public.seller_profiles sp where sp.account_id = owner) then
    return '{"result": "has-shop"}'::jsonb;
  end if;
  if private.name_key(coalesce(p_name, '')) = '' then
    raise exception 'a shop name has a letter or a digit' using errcode = 'check_violation';
  end if;
  if not private.points_fit(p_campus_slug, p_pickup_point_ids) then
    return '{"result": "points-invalid"}'::jsonb;
  end if;
  if p_photo_id is not null and not private.photo_usable(owner, p_photo_id, array['draft']) then
    return '{"result": "photo-invalid"}'::jsonb;
  end if;

  perform private.lock_shop_links();
  link := private.free_shop_slug(private.slugify(p_name), null);
  begin
    insert into public.shops (slug, owner_id, name, tagline, category_slug, campus_slug, verified, badge, about, since, image_photo_id)
    values (
      link, owner, p_name, coalesce(p_tagline, ''), p_category_slug, p_campus_slug, false, 'new-seller', coalesce(p_about, ''),
      to_char(now() at time zone 'Africa/Johannesburg', 'YYYY-MM'), p_photo_id
    )
    returning id into shop;
  exception when unique_violation then
    get stacked diagnostics failed = constraint_name;
    if failed = 'shops_campus_slug_name_key_key' then
      return '{"result": "name-taken"}'::jsonb;
    end if;
    raise;
  end;

  insert into public.seller_profiles (account_id, status, shop_id) values (owner, 'pending', shop);
  insert into public.shop_pickup_points (shop_id, pickup_point_id)
  select shop, unnest(private.campus_points(p_campus_slug, p_pickup_point_ids));
  if p_photo_id is not null then
    update public.photos set use = 'shop' where id = p_photo_id;
  end if;
  delete from public.onboarding_drafts where account_id = owner;
  removed := private.delete_photos_used_by(owner, 'draft', '{}');
  return jsonb_build_object('result', 'created', 'shop_id', shop, 'slug', link, 'removed_paths', to_jsonb(removed));
end;
$$;

-- Edit shop (updateShop and changeShopSlug; selling spec 2.11, plan decisions 16 and 17), all or nothing:
-- - the details, campus and pickup points; while the shop waits for approval its link follows its name;
-- - its listings follow its campus, and a pickup whose point it no longer uses moves to its first point (in the order
--   given), or online when it has none;
-- - the image: p_photo_id is the new photo (or the current one, kept); p_remove_photo leaves the category's picture;
--   neither keeps the image as it is (a sample shop's placeholder too). A replaced or removed photo is deleted;
-- - p_slug, for an approved or paused shop that hasn't changed its link yet, changes it (the one change of link), and
--   reports about the shop follow. A pending shop, a shop that has used its change, or the same link ignores it.
-- Returns jsonb:
--   {"result": "saved", "slug", "removed_paths"}
--   {"result": "no-shop"}  updateShop's null (requireShopOwner sends the seller to /sell)
--   {"result": "name-taken" | "slug-taken" | "points-invalid" | "photo-invalid"}  nothing is saved
-- A user action (advisor 0029 lists it on purpose).
create function public.update_shop(
  p_name text, p_tagline text, p_category_slug text, p_about text, p_campus_slug text, p_pickup_point_ids uuid[],
  p_photo_id uuid default null, p_remove_photo boolean default false, p_slug text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid := private.signed_in();
  shop public.shops;
  status text;
  link text;
  link_changed boolean := false;
  points uuid[] := private.campus_points(p_campus_slug, p_pickup_point_ids);
  failed text;
  removed text[] := '{}'::text[];
begin
  select s.* into shop from public.shops s where s.id = private.shop_of(owner) for update;
  if not found then
    return '{"result": "no-shop"}'::jsonb;
  end if;
  status := private.shop_status(shop.id);
  if private.name_key(coalesce(p_name, '')) = '' then
    raise exception 'a shop name has a letter or a digit' using errcode = 'check_violation';
  end if;
  if not private.points_fit(p_campus_slug, p_pickup_point_ids) then
    return '{"result": "points-invalid"}'::jsonb;
  end if;
  if p_photo_id is not null and p_photo_id is distinct from shop.image_photo_id
    and not private.photo_usable(owner, p_photo_id, '{}')
  then
    return '{"result": "photo-invalid"}'::jsonb;
  end if;

  perform private.lock_shop_links();
  link := shop.slug;
  if status = 'pending' then
    link := private.free_shop_slug(private.slugify(p_name), shop.id);
  elsif p_slug is not null and p_slug <> shop.slug and not shop.slug_changed then
    if exists (select 1 from public.shops s where s.slug = p_slug) then
      return '{"result": "slug-taken"}'::jsonb;
    end if;
    link := p_slug;
    link_changed := true;
  end if;

  begin
    update public.shops set
      slug = link,
      slug_changed = slug_changed or link_changed,
      name = p_name,
      tagline = coalesce(p_tagline, ''),
      category_slug = p_category_slug,
      about = coalesce(p_about, ''),
      campus_slug = p_campus_slug,
      image_photo_id = case when p_photo_id is not null then p_photo_id when p_remove_photo then null else image_photo_id end,
      image_placeholder = case when p_photo_id is not null or p_remove_photo then null else image_placeholder end,
      image_alt = case
        when p_photo_id is not null and p_photo_id is distinct from image_photo_id then ''
        when p_remove_photo then ''
        else image_alt
      end,
      updated_at = now()
    where id = shop.id;
  exception when unique_violation then
    get stacked diagnostics failed = constraint_name;
    if failed = 'shops_campus_slug_name_key_key' then
      return '{"result": "name-taken"}'::jsonb;
    elsif failed = 'shops_slug_key' then
      return '{"result": "slug-taken"}'::jsonb;
    end if;
    raise;
  end;

  if link <> shop.slug then
    update public.reports set target_id = link where target_kind = 'seller' and target_id = shop.slug;
  end if;
  delete from public.shop_pickup_points where shop_id = shop.id;
  insert into public.shop_pickup_points (shop_id, pickup_point_id) select shop.id, unnest(points);
  update public.listings set campus_slug = p_campus_slug where shop_id = shop.id and campus_slug <> p_campus_slug;
  update public.listings
  set pickup_point_id = points[1], handover = case when points[1] is null then 'online' else 'pickup' end
  where shop_id = shop.id and handover = 'pickup' and not (pickup_point_id = any (points));

  if p_photo_id is not null then
    update public.photos set use = 'shop' where id = p_photo_id;
    removed := private.delete_photos_used_by(owner, 'shop', array[p_photo_id]);
  elsif p_remove_photo then
    removed := private.delete_photos_used_by(owner, 'shop', '{}');
  end if;
  return jsonb_build_object('result', 'saved', 'slug', link, 'removed_paths', to_jsonb(removed));
end;
$$;

-- The seller's one change of link (changeShopSlug; selling spec 2.11), for an approved or paused shop. Reports about
-- the shop follow it; conversations point at the shop's id, so they need nothing. Old links then 404.
-- Returns changeShopSlug's SlugChange ('changed' | 'same' | 'used' | 'taken'), or 'not-allowed' for its null (no
-- shop, or a shop still waiting, whose link follows its name). A malformed link raises (check_violation).
-- A user action (advisor 0029 lists it on purpose).
create function public.change_shop_slug(p_slug text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
  own uuid := private.shop_of(account);
  shop public.shops;
begin
  select s.* into shop from public.shops s where s.id = own for update;
  if not found or private.shop_status(shop.id) = 'pending' then
    return 'not-allowed';
  end if;
  if p_slug = shop.slug then
    return 'same';
  end if;
  if shop.slug_changed then
    return 'used';
  end if;
  perform private.lock_shop_links();
  if exists (select 1 from public.shops s where s.slug = p_slug) then
    return 'taken';
  end if;
  begin
    update public.shops set slug = p_slug, slug_changed = true, updated_at = now() where id = shop.id;
  exception when unique_violation then
    return 'taken';
  end;
  update public.reports set target_id = p_slug where target_kind = 'seller' and target_id = shop.slug;
  return 'changed';
end;
$$;

-- Pause my shop and Resume (setShopPaused; selling spec 2.8): approved to paused and back.
-- Returns the new status ('paused' | 'approved'), or 'not-allowed' for setShopPaused's null.
-- A user action (advisor 0029 lists it on purpose).
create function public.set_shop_paused(p_paused boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
  now_status text;
begin
  update public.seller_profiles
  set status = case when p_paused then 'paused' else 'approved' end
  where account_id = account and shop_id is not null and status = case when p_paused then 'approved' else 'paused' end
  returning seller_profiles.status into now_status;
  return coalesce(now_status, 'not-allowed');
end;
$$;

-- The onboarding wizard's answers so far (saveOnboardingDraft; selling spec 2.2). Blanks are allowed; only the
-- campus's live pickup points are kept. Its photo becomes the draft's, and a draft photo it no longer uses goes.
-- Returns jsonb {"result": "saved", "removed_paths"} | {"result": "has-shop"} (the wizard is for accounts without a
-- seller profile) | {"result": "photo-invalid"} (not the account's draft photo or a fresh waiting one).
-- A user action (advisor 0029 lists it on purpose).
create function public.save_onboarding_draft(
  p_name text, p_tagline text, p_category_slug text, p_about text, p_photo_id uuid, p_campus_slug text,
  p_pickup_point_ids uuid[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.require_profile();
  removed text[];
begin
  perform 1 from public.profiles p where p.id = account for update;
  if exists (select 1 from public.seller_profiles sp where sp.account_id = account) then
    return '{"result": "has-shop"}'::jsonb;
  end if;
  if p_photo_id is not null and not private.photo_usable(account, p_photo_id, array['draft']) then
    return '{"result": "photo-invalid"}'::jsonb;
  end if;
  insert into public.onboarding_drafts as d (account_id, name, tagline, category_slug, about, photo_id, campus_slug, pickup_point_ids, updated_at)
  values (
    account, coalesce(p_name, ''), coalesce(p_tagline, ''), nullif(p_category_slug, ''), coalesce(p_about, ''), p_photo_id,
    nullif(p_campus_slug, ''), private.campus_points(p_campus_slug, p_pickup_point_ids), now()
  )
  on conflict (account_id) do update set
    name = excluded.name, tagline = excluded.tagline, category_slug = excluded.category_slug, about = excluded.about,
    photo_id = excluded.photo_id, campus_slug = excluded.campus_slug, pickup_point_ids = excluded.pickup_point_ids,
    updated_at = excluded.updated_at;
  if p_photo_id is not null then
    update public.photos set use = 'draft' where id = p_photo_id;
  end if;
  removed := private.delete_photos_used_by(account, 'draft', array_remove(array[p_photo_id], null));
  return jsonb_build_object('result', 'saved', 'removed_paths', to_jsonb(removed));
end;
$$;

-- --- Listings (lib/data/own-listings.ts; lib/selling/listing-actions.ts) --------------------------------------------

-- Saves a new or changed listing (saveOwnListing; selling spec 2.10, plan decision 3) on its shop's campus:
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
create function public.save_listing(
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

  return jsonb_build_object(
    'result', 'saved', 'listing_id', saved, 'state', new_state, 'first_publish', first_publish,
    'removed_paths', to_jsonb(removed)
  );
end;
$$;

-- My listings' row buttons (setOwnListingState; plan decision 3): Pause (from available), Resume and Relist (to
-- available, from paused or sold), Mark sold (from available or paused). A draft publishes from its form.
-- Returns 'moved', or 'not-allowed' for setOwnListingState's null (not the shop's, or not a move it can make).
-- A user action (advisor 0029 lists it on purpose).
create function public.set_listing_state(p_listing_id text, p_to text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid := private.signed_in();
  shop uuid := private.shop_of(account);
begin
  if p_to is null or p_to not in ('available', 'paused', 'sold') then
    raise exception 'a listing moves to available, paused or sold' using errcode = 'invalid_parameter_value';
  end if;
  update public.listings set state = p_to, updated_at = now()
  where id = p_listing_id and shop_id = shop
    and state = any (case p_to
      when 'paused' then array['available']
      when 'available' then array['paused', 'sold']
      else array['available', 'paused']
    end);
  return case when found then 'moved' else 'not-allowed' end;
end;
$$;

-- Delete listing (deleteOwnListing; selling spec 2.9): the listing and its photos go; conversations keep its title.
-- Returns jsonb {"result": "deleted", "removed_paths"} or {"result": "not-found"} (not the shop's).
-- A user action (advisor 0029 lists it on purpose).
create function public.delete_listing(p_listing_id text)
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
  return jsonb_build_object(
    'result', 'deleted', 'removed_paths', to_jsonb(private.delete_photos_used_by(owner, private.listing_use(gone), '{}'))
  );
end;
$$;

-- --- The server's functions (admin client only) ---------------------------------------------------------------------

-- Deleting an account (deleteAccountData; backend spec 4.5, messaging plan decision 14, selling plan decision 22).
-- Run with the admin client first; then the Auth user is deleted. Its profile goes last here, so a session still open
-- in another tab can't act in between: every user action then finds no profile (see below), and foreign keys clear
-- the consents, seller profile, notifications and form states with it.
-- 1. Messaging: in each conversation it was in, its own messages go, and the other side keeps theirs, unread again;
--    the buyer is forgotten or the seller marked gone; a sale waiting to be confirmed goes back to Replied, with its
--    completion forgotten (a confirmed sale stays). A conversation with neither side left, or nothing in it, goes.
--    Notifications about those conversations go, everyone's, since they name the account; so do the account's own.
-- 2. Its reports.
-- 3. Its shop and the shop's listings (conversations keep each listing's title), its wizard draft, and every photo it
--    uploaded.
-- 4. Its sign-in attempt and code count.
-- 5. Its profile. Without one, the actions that make rows refuse (insufficient_privilege, a 403 through the API), the
--    others find nothing of the account's ('not-found', 'not-allowed', 'no-shop', false or 0), and complete_profile
--    could only make a fresh, empty profile that deleting the Auth user then removes.
-- Returns the paths of the deleted photos' files, sorted, for the caller to delete from Storage.
-- Server only: the service role.
create function public.forget_account(p_account_id uuid)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  address text := (select lower(u.email) from auth.users u where u.id = p_account_id);
  own_shops uuid[] := array(select s.id from public.shops s where s.owner_id = p_account_id);
  as_buyer uuid[];
  as_seller uuid[];
  touched uuid[];
  paths text[];
begin
  as_buyer := array(select c.id from public.conversations c where c.buyer_id = p_account_id order by c.id for update);
  as_seller := array(
    select c.id from public.conversations c
    where c.shop_id = any (own_shops) and not c.seller_gone and c.buyer_id is distinct from p_account_id
    order by c.id
    for update
  );
  touched := as_buyer || as_seller;

  delete from public.messages m
  where (m.conversation_id = any (as_buyer) and m.side = 'buyer') or (m.conversation_id = any (as_seller) and m.side = 'seller');
  update public.messages set read_at = null where conversation_id = any (touched) and read_at is not null;
  update public.conversations set buyer_id = null where id = any (as_buyer);
  update public.conversations set seller_gone = true where id = any (as_seller);
  update public.conversations set status = 'replied', completed_at = null where id = any (touched) and status = 'done';
  delete from public.conversations c
  where c.id = any (touched)
    and ((c.buyer_id is null and c.seller_gone) or not exists (select 1 from public.messages m where m.conversation_id = c.id));
  delete from public.notifications where account_id = p_account_id or subject_id = any (touched::text[]);

  delete from public.reports where reporter_id = p_account_id;

  paths := array(select p.path from public.photos p where p.owner_id = p_account_id order by p.path);
  delete from public.shops where owner_id = p_account_id;
  delete from public.onboarding_drafts where account_id = p_account_id;
  delete from public.photos where owner_id = p_account_id;

  if address is not null then
    delete from private.sign_in_attempts where email = address;
    delete from private.code_sends where email = address;
  end if;

  delete from public.profiles where id = p_account_id;
  return paths;
end;
$$;

-- The 5-codes-an-hour reservation (private.reserve_code_send) for the admin client, in the current UTC hour.
-- Server only: the service role.
create function public.reserve_code_send(p_email text, p_max_sends integer default 5)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reserve_code_send(p_email, now(), p_max_sends);
$$;

-- A wrong try on a sign-in attempt's code (private.record_wrong_try) for the admin client: the new count, or null.
-- Server only: the service role.
create function public.record_wrong_try(p_attempt_key text)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.record_wrong_try(p_attempt_key);
$$;

-- --- Grants ---------------------------------------------------------------------------------------------------------

-- The private helpers run only inside the functions above (as their owner). New functions in private already have no
-- EXECUTE for PUBLIC (the foundation migration's default privileges); this says so for each.
revoke all on function
  private.signed_in(), private.require_profile(), private.shop_of(uuid), private.thread_path(uuid),
  private.message_note_text(text, text, boolean), private.sale_note_text(text, text),
  private.notify_message(uuid, uuid, text), private.tell_other_side(uuid, text),
  private.read_sale_notes(uuid, uuid, timestamptz), private.settle_conversation(uuid, timestamptz),
  private.slugify(text), private.free_shop_slug(text, uuid), private.lock_shop_links(),
  private.campus_points(text, uuid[]), private.points_fit(text, uuid[]), private.photo_usable(uuid, uuid, text[]),
  private.delete_photos_used_by(uuid, text, uuid[]), private.listing_use(text),
  private.sale_row(uuid, text, text), private.check_profile(text, text), private.check_policy_version(text)
from public, anon, authenticated, service_role;

-- User actions: signed-in students (and the service role), never anon.
revoke all on function
  public.complete_profile(text, text, text), public.update_profile(text, text), public.record_consent(text),
  public.start_conversation(text, text, text, text), public.send_message(uuid, text), public.mark_completed(uuid),
  public.confirm_sale(uuid), public.reject_sale(uuid), public.mark_thread_read(uuid), public.mark_notifications_read(),
  public.settle_sales(),
  public.create_report(text, text, text, text, text),
  public.add_photos(text[]),
  public.create_shop(text, text, text, text, uuid, text, uuid[]),
  public.update_shop(text, text, text, text, text, uuid[], uuid, boolean, text),
  public.change_shop_slug(text), public.set_shop_paused(boolean),
  public.save_onboarding_draft(text, text, text, text, uuid, text, uuid[]),
  public.save_listing(text, text, text, text, text, integer, boolean, text, text, text, text, uuid, jsonb, boolean),
  public.set_listing_state(text, text), public.delete_listing(text)
from public, anon;
grant execute on function
  public.complete_profile(text, text, text), public.update_profile(text, text), public.record_consent(text),
  public.start_conversation(text, text, text, text), public.send_message(uuid, text), public.mark_completed(uuid),
  public.confirm_sale(uuid), public.reject_sale(uuid), public.mark_thread_read(uuid), public.mark_notifications_read(),
  public.settle_sales(),
  public.create_report(text, text, text, text, text),
  public.add_photos(text[]),
  public.create_shop(text, text, text, text, uuid, text, uuid[]),
  public.update_shop(text, text, text, text, text, uuid[], uuid, boolean, text),
  public.change_shop_slug(text), public.set_shop_paused(boolean),
  public.save_onboarding_draft(text, text, text, text, uuid, text, uuid[]),
  public.save_listing(text, text, text, text, text, integer, boolean, text, text, text, text, uuid, jsonb, boolean),
  public.set_listing_state(text, text), public.delete_listing(text)
to authenticated, service_role;

-- The server's: the service role only.
revoke all on function
  public.settle_auto_confirm(timestamptz), public.forget_account(uuid), public.reserve_code_send(text, integer),
  public.record_wrong_try(text)
from public, anon, authenticated;
grant execute on function
  public.settle_auto_confirm(timestamptz), public.forget_account(uuid), public.reserve_code_send(text, integer),
  public.record_wrong_try(text)
to service_role;
