-- Phase C3's messaging SQL (supabase phase C2/C3 plan, Task 3; decisions 18, 19 and 20). Read-only, and only ever about
-- the signed-in account:
--
-- 1. The app's first look at the message limits (decision 18): countConversationsStartedSince and
--    countMessagesSentSince (lib/data/messages.ts) for the signed-in account. Stage K's order puts the limits after the
--    fields and before the scam words, so the app must look before the write; the look that counts is
--    private.message_limit_error, under the sender's lock, inside start_conversation, send_message and start_offer
--    (20261020120700_message_limits.sql:67). These call the same counters and take no lock.
-- 2. The header's counts without a write (decision 19): unreadCounts runs on every signed-in page, so it must not
--    settle. A sale whose 7 days have passed counts as settled already, as the thread will show it once opened.
-- 3. The inbox in a fixed number of queries (decision 20): each of the reader's conversations' last message and the
--    other side's unread count, so getInbox never reads every message of every conversation.

-- --- The app's first look at the limits (decision 18) -----------------------------------------------------------------

-- countConversationsStartedSince (lib/data/messages.ts) for the signed-in account: enquiries and questions it started as
-- a buyer after p_since, never offers. No lock.
-- A user action (advisor 0029 lists it on purpose).
create function public.my_conversations_started_since(p_since timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.conversations_started_since((select auth.uid()), p_since);
$$;

-- countMessagesSentSince (lib/data/messages.ts) for the signed-in account: its messages as the buyer, and as the seller
-- in its shop's conversations while it hasn't gone (an offer's first message included). No lock.
-- A user action (advisor 0029 lists it on purpose).
create function public.my_messages_sent_since(p_since timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.messages_sent_since((select auth.uid()), p_since);
$$;

-- --- The header's counts (decision 19) ----------------------------------------------------------------------------------

-- unreadCounts (lib/data/messages.ts) without a write: the other side's unread messages in the reader's conversations
-- (the buyer's own, and the shop's while its seller hasn't gone), how many conversations have any, the sales done that
-- the reader as buyer is to confirm, and the reader's unread notifications. A sale due its auto-confirm
-- (private.settle_conversation's rule, completed_at + 168 hours) is settled already as far as these counts go: it isn't
-- to confirm, and its "sale to confirm" notification isn't new, as private.read_sale_notes would mark it.
-- A user action (advisor 0029 lists it on purpose).
create function public.my_unread_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id, private.shop_of((select auth.uid())) as shop
  ),
  mine as (
    select c.id, c.status, c.completed_at, case when c.buyer_id = me.id then 'buyer' else 'seller' end as side
    from public.conversations c, me
    where c.buyer_id = me.id or (me.shop is not null and c.shop_id = me.shop and not c.seller_gone)
  ),
  unread as (
    select m.conversation_id, count(*) as n
    from public.messages m join mine on mine.id = m.conversation_id
    where m.side <> mine.side and m.read_at is null
    group by m.conversation_id
  )
  select jsonb_build_object(
    'messages', coalesce((select sum(unread.n) from unread), 0)::int,
    'conversations', (select count(*) from unread)::int,
    'sales_to_confirm', (
      select count(*) from mine
      where mine.side = 'buyer' and mine.status = 'done' and mine.completed_at + interval '168 hours' > now()
    )::int,
    'notifications', (
      select count(*) from public.notifications n, me
      where n.account_id = me.id and n.read_at is null
        and not (n.kind = 'sale-to-confirm' and exists (
          select 1 from public.conversations c
          where c.id::text = n.subject_id and c.status = 'done' and c.completed_at + interval '168 hours' <= now()
        ))
    )::int
  );
$$;

revoke all on function public.my_conversations_started_since(timestamptz), public.my_messages_sent_since(timestamptz),
  public.my_unread_counts()
from public, anon;
grant execute on function public.my_conversations_started_since(timestamptz), public.my_messages_sent_since(timestamptz),
  public.my_unread_counts()
to authenticated, service_role;

-- --- The inbox (decision 20) --------------------------------------------------------------------------------------------

-- Each of the reader's conversations' last message (body, side, time) and how many of the other side's messages are
-- unread (getInbox, lib/data/messages.ts). security_invoker: my_conversations' and messages' policies apply, so a
-- reader sees only their own conversations' rows.
create view public.my_conversation_tails
with (security_invoker = true)
as
select
  c.id as conversation_id, t.body as last_body, t.side as last_side, t.sent_at as last_sent_at,
  (
    select count(*)::int from public.messages u
    where u.conversation_id = c.id and u.side <> c.viewer_side and u.read_at is null
  ) as unread
from public.my_conversations c
left join lateral (
  select m.body, m.side, m.sent_at from public.messages m
  where m.conversation_id = c.id
  order by m.sent_at desc, m.id desc
  limit 1
) t on true;
-- Supabase's default privileges give a new view every privilege for anon and authenticated (21_grants would catch it).
revoke all on table public.my_conversation_tails from public, anon, authenticated, service_role;
grant select on table public.my_conversation_tails to authenticated, service_role;
