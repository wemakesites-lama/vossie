-- The schema catch-up's final review fixes (supabase schema catch-up plan; 22_review_fixes.test.sql):
--
-- - I1: the audit log's subject_id is no longer readable through the API. Task 2 granted signed-in people select on the
--   whole table (admins read it through its policy), so an admin could read the student an entry is about and, with
--   staff's read of profiles, name a hidden request's asker (hide_request and show_request write the asker as the
--   subject), which requests never do ("Asked by a student at {campus}", CLAUDE.md). The app's log never shows the
--   subject either (toEntry, lib/data/audit.ts:41, drops it): it is there only so deleting the account can forget
--   them. Every other column stays readable. The writers (private.record_audit, run inside the staff actions'
--   security definer functions) and forget_account (security definer) don't need the API roles' grants, and the
--   service role keeps select and insert.
-- - M1: public.mentor_shop_numbers takes p_now as now() when it's later, as admin_weekly_counts does (Task 7), so a
--   date ahead can't count enquiries as due or sales as confirmed early. Same signature and grants; only the cap is new.
-- - M2: public.set_shop_mentor reads the mentor's role with a share lock on their profile, taken before the shop's lock:
--   the order remove_role takes them in (the profile for update, then the seller profiles it clears). A mentor role
--   removed at the same moment then either waits for the assignment and clears it, or is seen gone and the assignment
--   is 'nothing'; before, the assignment could land after the removal had cleared that mentor's shops. Same signature
--   and grants; only the lock and the order of the two reads are new (both refusals were already 'nothing').

-- --- I1: the audit log's columns ----------------------------------------------------------------------------------------

revoke select on table public.audit_log from authenticated;
-- Every column but subject_id (AuditRow, lib/data/rows.ts:351).
grant select (id, at, staff_id, staff_name, action, target_kind, target_id, target_name, detail)
  on table public.audit_log to authenticated;

-- --- M1: mentor_shop_numbers, capped at now() --------------------------------------------------------------------------

-- A shop's last 14 days for the mentor dashboard (recentCounts, lib/data/shop-stats.ts:61), as Task 3's, which it
-- replaces, with p_now taken as now() when it's later (Task 7's rule for admin_weekly_counts).
-- A user action for staff (advisor 0029 lists it on purpose).
create or replace function public.mentor_shop_numbers(p_shop uuid, p_now timestamptz default now())
returns table (enquiries int, due int, replied_in_time int, sales_confirmed int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  at_now timestamptz := least(p_now, pg_catalog.now());
  since timestamptz := at_now - interval '336 hours';
begin
  if not private.can_mentor((select sp.account_id from public.seller_profiles sp where sp.shop_id = p_shop)) then
    return;
  end if;
  return query
  select
    (count(*) filter (where e.enquiry))::int,
    (count(*) filter (where e.enquiry and (e.in_time or e.created_at <= at_now - interval '48 hours')))::int,
    (count(*) filter (where e.enquiry and e.in_time))::int,
    (count(*) filter (where e.sold_at >= since))::int
  from (
    select
      c.listing_title is not null and not c.is_offer and c.created_at >= since as enquiry,
      coalesce(c.first_reply_at - c.created_at <= interval '48 hours', false) as in_time,
      c.created_at,
      case
        when c.status = 'confirmed' then c.confirmed_at
        when c.status = 'done' and c.completed_at + interval '168 hours' <= at_now
          then c.completed_at + interval '168 hours'
      end as sold_at
    from public.conversations c
    where c.shop_id = p_shop and not c.seller_gone
  ) e;
end;
$$;

-- --- M2: set_shop_mentor, with the mentor's profile locked first ---------------------------------------------------------

-- As Task 4's (assignMentor, admin-actions.ts), which it replaces: the mentor's role is read under a share lock on
-- their profile, before the shop's seller profile is locked (remove_role's order, so the two can't deadlock).
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
    coalesce(mentor_name, ''), shop.owner_id
  );
  return 'changed';
end;
$$;
