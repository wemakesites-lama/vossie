-- Deleting an account, complete for stages G to J (supabase schema catch-up plan, Task 8; backend spec 4.5; POPIA).
-- public.forget_account is replaced, with the same signature and grants (the service role only: phase C calls it with
-- the admin client, then deletes the Auth user). It keeps deleteAccountData's order (lib/data/accounts.ts:237-278) and
-- every step of phase A's (20261015120000_actions.sql), diffed against it: messaging, reports, the shop and its photos,
-- the sign-in state and the profile last. What it adds, in the app's order:
--
-- - its Looking For requests (forgetRequestsOf, lib/data/requests.ts:203) and the Hub's "request-update"
--   notifications about them, as delete_request does. Their offer threads have just followed messaging's rules; the
--   shops' that stay keep is_offer and request_title, and request_id goes null (Task 3);
-- - its follows, every follow of its shop, and the "new-listing" notifications about its shop (forgetFollowsOf,
--   lib/data/follows.ts:121): the app finds them by subject, the shop's link (Task 6's open question 3); a link to the
--   shop's page or one of its listings is matched too, which can only find the same notifications;
-- - its saved searches and their "search-match" notifications (forgetSavedSearchesOf, lib/data/saved-searches.ts:153);
-- - its shop's extras (forgetShopOf, lib/data/shops.ts:259): "search-match" notifications that lead to one of the
--   shop's listings go (a search's results link stays); reports about the shop or its listings, other reporters' too,
--   become target_gone, so a new shop on the link isn't reported by them (amendment 13.1); its Featured pins and old
--   links cascade with the shop (Task 1's shop_previous_slugs, Task 2's featured_pins);
-- - the staff tools (forgetAccountInStaffTools, lib/data/staff-privacy.ts:18): the audit log keeps every entry, its own
--   unsigned as "Deleted account", those about it without its id, name or reason; mentors' notes about it go and its
--   own stay as "Deleted account"; its shops lose it as their mentor; its RSVPs and slot requests go, with the
--   "booking" notifications about those slot requests, everyone's; the slot answers, Hub posts, pins and closed
--   reports it left stay, unsigned. Hub covers have no owner (plan decision 6), so its posts keep theirs.
--
-- Every step is explicit SQL rather than a foreign key's action on the profile's delete. Task 3 found that one delete
-- of the profile that both nulls an offer thread's buyer_id and, through the request's cascade, its request_id fails
-- its foreign key check, so buyer_id is nulled in the messaging step (as phase A does) and requests go before the
-- profile; the same holds for an audit entry the account both wrote and was the subject of, or a slot request it both
-- made and answered. The foreign keys still clear anything left (consents, seller profile, form states, notifications).

-- Steps, in order:
-- 1. Messaging (phase A's, unchanged; offer threads included): in each conversation it was in, its own messages go,
--    and the other side keeps theirs, unread again; the buyer is forgotten or the seller marked gone; a sale waiting to
--    be confirmed goes back to Replied, with its completion forgotten (a confirmed sale stays). A conversation with
--    neither side left, or nothing in it, goes. Notifications about those conversations go, everyone's, since they
--    name the account; so do the account's own.
-- 2. Its reports.
-- 3. Its requests and their request-update notifications.
-- 4. Its follows, its shop's followers, and the new-listing notifications about its shop.
-- 5. Its saved searches and their search-match notifications.
-- 6. Its shop's extras, then (phase A's) its shop and the shop's listings (conversations keep each listing's title), its
--    wizard draft, and every photo it uploaded.
-- 7. The staff tools.
-- 8. Its sign-in attempt and code count (phase A's).
-- 9. Its profile (phase A's). Without one, the actions that make rows refuse (insufficient_privilege, a 403 through
--    the API), the others find nothing of the account's ('not-found', 'not-allowed', 'no-shop', false or 0), and
--    complete_profile could only make a fresh, empty profile that deleting the Auth user then removes.
-- Returns the paths of the deleted photos' files, sorted, for the caller to delete from Storage.
-- Server only: the service role.
create or replace function public.forget_account(p_account_id uuid)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- The label the app writes for someone who has gone (DELETED, lib/data/staff-privacy.ts:8).
  deleted constant text := 'Deleted account';
  address text := (select lower(u.email) from auth.users u where u.id = p_account_id);
  own_shops uuid[] := array(select s.id from public.shops s where s.owner_id = p_account_id);
  own_slugs text[] := array(select s.slug from public.shops s where s.owner_id = p_account_id);
  own_listings text[] := array(select l.id from public.listings l where l.shop_id = any (own_shops));
  -- Links to the shop's page and to its listings, as notifications write them.
  own_hrefs text[];
  as_buyer uuid[];
  as_seller uuid[];
  touched uuid[];
  gone_requests text[];
  gone_searches text[];
  gone_bookings text[];
  paths text[];
begin
  own_hrefs := array(select '/sellers/' || slug from unnest(own_slugs) slug)
    || array(select '/listings/' || id from unnest(own_listings) id);

  -- 1. Messaging (forgetAccountInMessaging, lib/data/messages.ts:496).
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

  -- 2. Its reports (deleteReportsBy, lib/data/reports.ts:75).
  delete from public.reports where reporter_id = p_account_id;

  -- 3. Its requests (forgetRequestsOf), before the profile (Task 3), with the Hub's notifications about them.
  with gone as (delete from public.requests q where q.asker_id = p_account_id returning q.id)
  select coalesce(array_agg(gone.id), '{}') into gone_requests from gone;
  delete from public.notifications n where n.kind = 'request-update' and n.subject_id = any (gone_requests);

  -- 4. Its follows, every follow of its shop, and the followers' new-listing notifications about the shop
  --    (forgetFollowsOf).
  delete from public.follows f where f.account_id = p_account_id or f.shop_id = any (own_shops);
  delete from public.notifications n
  where n.kind = 'new-listing' and (n.subject_id = any (own_slugs) or n.href = any (own_hrefs));

  -- 5. Its saved searches and their search-match notifications (forgetSavedSearchesOf).
  with gone as (delete from public.saved_searches ss where ss.account_id = p_account_id returning ss.id)
  select coalesce(array_agg(gone.id), '{}') into gone_searches from gone;
  delete from public.notifications n where n.kind = 'search-match' and n.subject_id = any (gone_searches);

  -- 6. Its shop (forgetShopOf). Matches that lead to one of its listings would only lead to a 404 (search alerts plan
  --    amendment 11); reports about the shop or its listings now point at nothing (amendment 13.1). Then phase A's: the
  --    shop goes, and its listings, Featured pins (amendment 14.7) and old links with it; its draft; its photos.
  delete from public.notifications n where n.kind = 'search-match' and n.href = any (own_hrefs);
  update public.reports r
  set target_gone = true
  where not r.target_gone
    and ((r.target_kind = 'seller' and r.target_id = any (own_slugs))
      or (r.target_kind = 'listing' and r.target_id = any (own_listings)));

  paths := array(select p.path from public.photos p where p.owner_id = p_account_id order by p.path);
  delete from public.shops where owner_id = p_account_id;
  delete from public.onboarding_drafts where account_id = p_account_id;
  delete from public.photos where owner_id = p_account_id;

  -- 7. The staff tools (forgetAccountInStaffTools). The audit log keeps every entry (staff tools plan decision 6).
  update public.audit_log a
  set staff_id = case when a.staff_id = p_account_id then null else a.staff_id end,
    staff_name = case when a.staff_id = p_account_id then deleted else a.staff_name end,
    subject_id = case when a.subject_id = p_account_id then null else a.subject_id end,
    target_id = case when a.subject_id = p_account_id then '' else a.target_id end,
    target_name = case when a.subject_id = p_account_id then deleted else a.target_name end,
    detail = case when a.subject_id = p_account_id then '' else a.detail end
  where a.staff_id = p_account_id or a.subject_id = p_account_id;
  delete from public.mentor_notes mn where mn.owner_id = p_account_id;
  update public.mentor_notes mn set author_id = null, author_name = deleted where mn.author_id = p_account_id;
  update public.seller_profiles sp set mentor_id = null where sp.mentor_id = p_account_id;
  delete from public.hub_rsvps hr where hr.account_id = p_account_id;
  with gone as (delete from public.hub_bookings hb where hb.account_id = p_account_id returning hb.id)
  select coalesce(array_agg(gone.id::text), '{}') into gone_bookings from gone;
  update public.hub_bookings hb set answered_by = null where hb.answered_by = p_account_id;
  delete from public.notifications n where n.kind = 'booking' and n.subject_id = any (gone_bookings);
  update public.hub_posts hp set author_id = null where hp.author_id = p_account_id;
  update public.featured_pins fp set pinned_by = null where fp.pinned_by = p_account_id;
  update public.reports r set closed_by = null where r.closed_by = p_account_id;

  -- 8. Its sign-in state.
  if address is not null then
    delete from private.sign_in_attempts where email = address;
    delete from private.code_sends where email = address;
  end if;

  -- 9. Its profile, last.
  delete from public.profiles where id = p_account_id;
  return paths;
end;
$$;

-- Unchanged from phase A (create or replace keeps them; stated again so this file says who may run it).
revoke all on function public.forget_account(uuid) from public, anon, authenticated;
grant execute on function public.forget_account(uuid) to service_role;
