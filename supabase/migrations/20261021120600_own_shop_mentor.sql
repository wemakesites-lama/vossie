-- No admin takes away their own shop's mentor (stage M spec decisions 2 and 5; supabase step 2b plan, Task 7,
-- decision 8).
--
-- remove_role (from 20261020120400_staff_tools_actions.sql) gains one check, marked "stage M", as removeRole
-- (lib/data/staff-accounts.ts:128): the mentor role of whoever mentors the acting admin's own shop isn't theirs to take
-- ('own-shop-mentor'; removeStaffRole leaves its notice on /admin/staff). It reads the admin's seller profile, not the
-- shop's status, so a paused shop or one waiting again is still refused. It comes after "no such role" and before the
-- last-admin check and every write, so a refusal writes, logs and tells nothing.
-- The lock order is set_shop_mentor's (20261020121100_audit_related_account.sql): the mentor's profile (for update),
-- then the seller profile (for share), so the two can't deadlock.
-- Same signature and grants.

-- --- remove_role, replaced --------------------------------------------------------------------------------------------

-- Take a role away (stage J spec decisions 5 and 6), as before (which see), and never the mentor role of your own
-- shop's mentor (stage M).
-- Returns 'changed' | 'nothing' (no such role to take) | 'own-admin' | 'last-admin' | 'own-shop-mentor' | 'forbidden'
-- (admin). A role other than mentor or admin raises invalid_parameter_value.
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.remove_role(p_account uuid, p_role text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target public.profiles;
  unassigned text[] := '{}'::text[];
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  if p_role is null or p_role not in ('mentor', 'admin') then
    raise exception 'a staff role is mentor or admin' using errcode = 'invalid_parameter_value';
  end if;
  if p_role = 'admin' then
    if p_account = me then
      return 'own-admin';
    end if;
    perform pg_advisory_xact_lock(hashtext('vossie:staff-roles'), 0);
    if not private.is_staff('admin') then
      return 'forbidden';
    end if;
  end if;
  select * into target from public.profiles p where p.id = p_account for update;
  if target.id is null or not (p_role = any (target.roles)) then
    return 'nothing';
  end if;
  -- stage M: never the mentor role of whoever mentors the acting admin's own shop (removeRole's "own-shop-mentor"),
  -- read from the admin's seller profile whatever its status, after "no such role" and before any write. Locked for
  -- share after the target's profile: set_shop_mentor's order (the mentor's profile, then the seller profile).
  if p_role = 'mentor' and exists (
    select 1 from public.seller_profiles sp
    where sp.account_id = me and sp.mentor_id = target.id
    for share of sp
  ) then
    return 'own-shop-mentor';
  end if;
  if p_role = 'admin' and (select count(*) from public.profiles p where 'admin' = any (p.roles)) <= 1 then
    return 'last-admin';
  end if;
  if p_role = 'mentor' then
    unassigned := array(
      select s.name
      from public.seller_profiles sp join public.shops s on s.id = sp.shop_id and s.owner_id = sp.account_id
      where sp.mentor_id = target.id
      order by s.name
    );
    update public.seller_profiles sp set mentor_id = null where sp.mentor_id = target.id;
  end if;
  update public.profiles p set roles = array_remove(p.roles, p_role) where p.id = target.id;
  perform private.record_audit(
    'role-removed', 'account', target.id::text, target.first_name,
    case
      when p_role = 'mentor' and cardinality(unassigned) > 0
        then 'Mentor. No mentor now: ' || array_to_string(unassigned, ', ')
      else private.role_label(p_role)
    end,
    target.id
  );
  perform private.notify(target.id, 'staff-role', p_role, private.staff_role_note_text('removed', p_role), '/account');
  return 'changed';
end;
$$;
