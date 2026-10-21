-- The product is CampusCart (decision 83): the words the database writes for a person now say CampusCart.
-- Only the words change. Each function is its latest definition, copied whole; schemas, roles, functions, settings
-- and the vossie_ names stay as they are. Notifications and audit entries already written keep their sentence: a
-- notification's text is fixed when it is made, and the audit log is never changed.

-- A staff role given or taken away, with the "staff-role" kind (staffRoleText, lib/staff/notification-text.ts).
-- Latest: 20261020120400_staff_tools_actions.sql.
create or replace function private.staff_role_note_text(change text, role text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  case
    when change = 'given' and role = 'mentor' then
      -- decision 83
      return 'You''re a CampusCart mentor now. The Hub''s tools and the mentor dashboard are on your account page.';
    when change = 'given' and role = 'admin' then
      -- decision 83
      return 'You''re a CampusCart admin now. The admin console is on your account page.';
    when change = 'removed' and role = 'mentor' then
      -- decision 83
      return 'Your mentor role on CampusCart has ended. Thank you for helping student sellers.';
    when change = 'removed' and role = 'admin' then
      -- decision 83
      return 'Your admin role on CampusCart has ended.';
    else raise exception 'no sentence for % %', change, role using errcode = 'invalid_parameter_value';
  end case;
end;
$$;

-- The first admin (phase B decision 12). Latest: 20261021130000_sign_in_phase_b.sql. The audit entry's "staff" line,
-- which admins read in the staff log, says where the role came from.
-- Run by hand in the SQL editor, as postgres, once: select private.make_first_admin('someone@vossie.net');
-- Returns 'made' | 'no-account' (no finished profile with that exact address) | 'admin-exists'.
create or replace function private.make_first_admin(p_email text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  wanted text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  target public.profiles;
begin
  lock table public.profiles in share row exclusive mode;
  if exists (select 1 from public.profiles p where 'admin' = any (p.roles)) then
    return 'admin-exists';
  end if;
  if wanted = '' then
    return 'no-account';
  end if;
  select p.* into target from public.profiles p join auth.users u on u.id = p.id where pg_catalog.lower(u.email) = wanted;
  if target.id is null then
    return 'no-account';
  end if;
  update public.profiles p
  set roles = array(
    select r.role from unnest(array['mentor', 'admin']) with ordinality as r(role, ord)
    where r.role = 'admin' or r.role = any (target.roles)
    order by r.ord
  )
  where p.id = target.id;
  insert into public.audit_log (staff_id, staff_name, action, target_kind, target_id, target_name, detail, subject_id)
  -- decision 83
  values (null, 'Set up outside CampusCart', 'role-given', 'account', target.id::text, target.first_name, 'Admin', target.id);
  return 'made';
end;
$$;
revoke all on function private.make_first_admin(text) from public, anon, authenticated, service_role;
