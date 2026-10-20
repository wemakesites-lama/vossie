-- Messaging (supabase foundation plan, Task 7; backend spec 4.2 and 4.3; messaging spec section 4): conversations,
-- messages, notifications and reports. Only the buyer and the shop's current owner see a conversation, unless the
-- seller has gone; every write goes through Task 9's functions, so authenticated gets select only. anon gets nothing.
-- Text is stored as the app cleans it (private.is_clean_text and is_clean_line, the foundation migration). The buyer's
-- account id isn't readable through the API: the seller has no need of it, and public.my_conversations says which
-- side the reader is on.
--
-- Two changes from the plan's columns, both so a deletion keeps the other side's conversation (messaging plan
-- decision 14, spec 4.5):
-- - conversations.shop_id is nullable and "on delete set null", not "on delete cascade": a cascade would delete the
--   buyer's conversations when a seller's account, and with it their shop, is deleted. A thread whose shop has gone
--   shows "A closed shop", as lib/data/messages.ts does.
-- - A question about the shop is the conversation with no listing title, not the one with no listing id: listing_id is
--   set to null when its listing is deleted, and that conversation must not then clash with an open question.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- The listing it's about, or null for a question about the shop (or once the listing has gone).
  listing_id text references public.listings (id) on delete set null,
  -- The listing's title when it started, kept for when the listing has gone. Null for a question.
  listing_title text check (char_length(listing_title) between 1 and 70 and private.is_clean_line(listing_title)),
  shop_id uuid references public.shops (id) on delete set null,
  -- Null once the buyer has deleted their account.
  buyer_id uuid references public.profiles (id) on delete set null,
  -- True once the shop's owner has deleted their account: no one answers for the shop here any more.
  seller_gone boolean not null default false,
  status text not null default 'asked' check (status in ('asked', 'replied', 'done', 'confirmed')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  first_reply_at timestamptz,
  completed_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by text check (confirmed_by in ('buyer', 'auto')),
  check (listing_id is null or listing_title is not null),
  check (status <> 'done' or completed_at is not null),
  check ((status = 'confirmed') = (confirmed_at is not null)),
  check ((confirmed_at is null) = (confirmed_by is null))
);
-- One open conversation per buyer and listing, and one question per buyer and shop (start_conversation reuses it).
-- Also the indexes for the buyer foreign key and lookups by buyer.
create unique index conversations_one_per_listing on public.conversations (buyer_id, listing_id)
  where buyer_id is not null and not seller_gone and listing_id is not null;
create unique index conversations_one_question_per_shop on public.conversations (buyer_id, shop_id)
  where buyer_id is not null and not seller_gone and listing_title is null;
create index conversations_buyer_id_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_shop_id_idx on public.conversations (shop_id, last_message_at desc);
create index conversations_listing_id_idx on public.conversations (listing_id);
-- The hourly job finds sales done 7 days ago (Task 10).
create index conversations_done_idx on public.conversations (completed_at) where status = 'done';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  side text not null check (side in ('buyer', 'seller')),
  -- Plain text with its line breaks (messaging spec 2.12), 1 to 1,000 characters, as cleanText leaves it.
  body text not null check (char_length(body) between 1 and 1000 and private.is_clean_text(body)),
  swap_offer text check (char_length(swap_offer) between 1 and 200 and private.is_clean_text(swap_offer)),
  sent_at timestamptz not null default now(),
  read_at timestamptz
);
-- Also the index for the conversation foreign key.
create index messages_conversation_id_sent_at_idx on public.messages (conversation_id, sent_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('message', 'sale-to-confirm', 'report-handled', 'shop-approved')),
  -- A conversation's id for messages and sales, a report's id, a shop's id.
  subject_id text not null,
  -- The sentence, fixed when it was made.
  text text not null check (text <> ''),
  -- Where it leads: a path on Vossie, never another site.
  href text not null check (href ~ '^/[^/\\]'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
-- Also the index for the account foreign key.
create index notifications_account_id_created_at_idx on public.notifications (account_id, created_at desc);
-- One unread message notification per conversation (messaging plan decision 13).
create unique index notifications_one_unread_message on public.notifications (account_id, subject_id)
  where kind = 'message' and read_at is null;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_kind text not null check (target_kind in ('listing', 'seller', 'request')),
  -- A listing's id, a shop's slug or a request's id: lower case letters and digits in hyphenated words, as all three are.
  target_id text not null check (target_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(target_id) <= 40),
  -- What the target was called when it was reported, in case it has gone by the time the Hub looks: a listing's or a
  -- request's title (70 at most) or a shop's name (60).
  target_title text not null check (char_length(target_title) between 1 and 70 and private.is_clean_line(target_title)),
  reason text not null check (reason in ('scam', 'prohibited', 'misleading', 'offensive', 'harassment', 'spam', 'other')),
  detail text not null default '' check (char_length(detail) <= 500 and private.is_clean_text(detail)),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
-- Also the index for the reporter foreign key, and for the 10-a-day count (create_report, Task 9).
create index reports_reporter_id_created_at_idx on public.reports (reporter_id, created_at);
-- One open report per reporter and target.
create unique index reports_one_open_per_target on public.reports (reporter_id, target_kind, target_id)
  where status = 'open';

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

-- The signed-in account's side of a conversation (sideOf in lib/data/messages.ts): the buyer, or the shop's current
-- owner unless the seller has gone, or null.
create function private.conversation_side(conv uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.buyer_id = (select auth.uid()) then 'buyer'
    when not c.seller_gone and c.shop_id is not null and private.owns_shop(c.shop_id) then 'seller'
  end
  from public.conversations c
  where c.id = conv;
$$;
revoke all on function private.conversation_side(uuid) from public, anon;
grant execute on function private.conversation_side(uuid) to authenticated, service_role;

revoke all on table public.conversations, public.messages, public.notifications, public.reports from anon, authenticated;
-- Every column but buyer_id, so a seller never learns the buyer's account id. A query through the API names its
-- columns (or reads public.my_conversations) rather than using *.
grant select (
  id, listing_id, listing_title, shop_id, seller_gone, status, created_at, last_message_at, first_reply_at, completed_at,
  confirmed_at, confirmed_by
) on table public.conversations to authenticated;
grant select on table public.messages, public.notifications, public.reports to authenticated;
grant all on table public.conversations, public.messages, public.notifications, public.reports to service_role;

create policy "The buyer and the shop's owner read a conversation"
on public.conversations for select
to authenticated
using (private.conversation_side(id) is not null);

-- The reader's conversations with the reader's side of each, 'buyer' or 'seller' (sideOf in lib/data/messages.ts), for
-- the inbox's two tabs and a thread's page: one query, filterable by side. A security_invoker view, so the reader's
-- own grants and the conversations policy apply, exactly as for the table. (A computed column can't do this: it takes
-- the whole row, and reading a whole row needs every column, buyer_id included.)
create view public.my_conversations
with (security_invoker = true)
as
select
  c.id, c.listing_id, c.listing_title, c.shop_id, c.seller_gone, c.status, c.created_at, c.last_message_at,
  c.first_reply_at, c.completed_at, c.confirmed_at, c.confirmed_by,
  private.conversation_side(c.id) as viewer_side
from public.conversations c;
revoke all on table public.my_conversations from public, anon, authenticated;
grant select on table public.my_conversations to authenticated, service_role;

create policy "The buyer and the shop's owner read its messages"
on public.messages for select
to authenticated
using (private.conversation_side(conversation_id) is not null);

create policy "Owners read their notifications"
on public.notifications for select
to authenticated
using (account_id = (select auth.uid()));

create policy "Reporters read their reports"
on public.reports for select
to authenticated
using (reporter_id = (select auth.uid()));
