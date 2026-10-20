-- The audit log's related account (Lama, 2026-10-20; the schema catch-up's final review, M3; POPIA):
--
-- - A mentor-assigned entry names the mentor in its detail (their first name), with the shop as its target and the
--   owner as its subject, so deleting the mentor's account left their name in it. A name alone can't find those
--   entries (two mentors can share one), so an entry now carries related_id: the person its detail names who is neither
--   the staff member nor the subject. Only set_shop_mentor names one; every other action's detail names no person
--   (remove_role's lists shops, which aren't people; a slot answer's target name is its student, who is the subject).
-- - forget_account writes "Deleted account" in the detail of the entries related to the account and clears
--   related_id, as forgetAccountInStaffTools (lib/data/staff-privacy.ts) does with AuditRow.relatedId
--   (lib/data/rows.ts). The detail is only the name, so it's replaced whole.
-- - related_id is never readable through the API, like subject_id: the I1 column grant (20261020121000_review_fixes.sql)
--   names its columns, so a new column isn't in it. The service role keeps select and insert on the whole table.
-- - private.record_audit gains an optional seventh argument, related (default null). It is dropped and made again
--   rather than overloaded, so the six-argument calls in the other staff actions (plpgsql, resolved when they run) reach
--   the one helper. Its grants are stated again: the API roles never run it.

-- --- The column -----------------------------------------------------------------------------------------------------------

alter table public.audit_log
  add column related_id uuid references public.profiles (id) on delete set null;
-- For forget_account, and the index for the foreign key.
create index audit_log_related_id_idx on public.audit_log (related_id);

-- --- private.record_audit, with the related account -------------------------------------------------------------------

drop function private.record_audit(text, text, text, text, text, uuid);

-- The one audit entry of an action that changed something (recordAudit, lib/data/audit.ts): by the signed-in staff
-- member, with their first name now, and the person the detail names when there is one.
create function private.record_audit(
  action text, target_kind text, target_id text, target_name text, detail text, subject uuid, related uuid default null
)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.audit_log (
    staff_id, staff_name, action, target_kind, target_id, target_name, detail, subject_id, related_id
  )
  select p.id, p.first_name, action, target_kind, target_id, target_name, coalesce(detail, ''), subject, related
  from public.profiles p
  where p.id = (select auth.uid());
$$;
-- The private helpers run only inside the staff actions (as their owner).
revoke all on function private.record_audit(text, text, text, text, text, uuid, uuid)
from public, anon, authenticated, service_role;

-- --- set_shop_mentor, recording the mentor --------------------------------------------------------------------------

-- As 20261020121000_review_fixes.sql's (assignMentor, admin-actions.ts), which it replaces: only the audit entry is new,
-- with the new mentor as its related account (a removal names no one, and p_mentor is null). Same signature and grants.
-- Returns 'changed' | 'nothing' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.set_shop_mentor(p_shop uuid, p_mentor uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  profile public.seller_profiles;
  shop public.shops;
  mentor_name text;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  if p_mentor is not null then
    select p.first_name into mentor_name from public.profiles p where p.id = p_mentor and 'mentor' = any (p.roles)
    for share;
  end if;
  profile := private.lock_owned_shop(p_shop);
  if profile.account_id is null or profile.status = 'pending' then
    return 'nothing';
  end if;
  if p_mentor is not null then
    if mentor_name is null or p_mentor = profile.account_id then
      return 'nothing';
    end if;
  end if;
  if profile.mentor_id is not distinct from p_mentor then
    return 'nothing';
  end if;
  update public.seller_profiles sp set mentor_id = p_mentor where sp.account_id = profile.account_id;
  select * into shop from public.shops s where s.id = p_shop;
  perform private.record_audit(
    case when p_mentor is null then 'mentor-removed' else 'mentor-assigned' end, 'shop', shop.slug, shop.name,
    coalesce(mentor_name, ''), shop.owner_id, p_mentor
  );
  return 'changed';
end;
$$;

-- --- forget_account, forgetting the name in related entries --------------------------------------------------------------

-- As 20261020120900_forget_account.sql's, which it replaces: step 7 gains one statement first, for the entries related to
-- the account. Same signature and grants (the service role only); see that file for the steps.
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
  --    An entry whose detail names it (a mentor-assigned entry's mentor) says "Deleted account" there instead; the
  --    detail is only the name. Before the entries about it, so one that is both ends with the detail ''.
  update public.audit_log a set related_id = null, detail = deleted where a.related_id = p_account_id;
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

-- Unchanged (create or replace keeps them; stated again so this file says who may run each).
revoke all on function public.set_shop_mentor(uuid, uuid) from public, anon;
grant execute on function public.set_shop_mentor(uuid, uuid) to authenticated, service_role;
revoke all on function public.forget_account(uuid) from public, anon, authenticated;
grant execute on function public.forget_account(uuid) to service_role;
