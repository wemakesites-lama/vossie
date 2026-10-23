-- Role views N4, the mentor caseload (role views spec 6 and 7.3; N4 plan Task 4, decisions 1 and 2).
-- - public.last_check_ins: the latest check-in day for each owner asked about, and nothing else: no text, no author,
--   no note. Each owner is checked with private.can_mentor, as the signed-in account: the shop's mentor (still holding
--   the role) or an admin, never the owner, an admin who sells included. lastCheckIns (lib/data/supabase/mentors.ts)
--   calls it with the viewer's own session. Security definer, as every function in public (06_account_actions).
-- - private.mentor_assigned_note_text: the sentence (mentorAssignedText, lib/staff/notification-text.ts).
-- - public.set_shop_mentor, replaced whole from 20261021120500_own_target_gate.sql: it now tells the new mentor
--   ("staff-role", the shop's link as its subject, to /mentor/<slug>), only when a mentor is given or changed; a
--   removal, "nothing", "own-shop" and "forbidden" tell no one (assignMentor, lib/staff/admin-actions.ts).
-- - private.forget_mentor_word_about_shop, after a shop is deleted: that notification goes too (POPIA).
-- - private.move_mentor_word_with_shop, after a shop's link changes: that notification's link follows it.

-- --- The sentence ------------------------------------------------------------------------------------------------------

create function private.mentor_assigned_note_text(shop text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'You''re now mentoring ' || shop || '.';
$$;

-- Built only inside the functions (16_staff_shop_actions).
revoke all on function private.mentor_assigned_note_text(text) from public, anon, authenticated, service_role;

-- --- last_check_ins ------------------------------------------------------------------------------------------------------

-- Returns one row per owner with a check-in that the signed-in account may read about; none for anyone else.
-- A user action for staff (advisor 0029 lists it on purpose).
create function public.last_check_ins(p_owners uuid[])
returns table (owner_id uuid, last_on date)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, max(mn.check_in_on)
  from unnest(p_owners) as o(id)
  join public.mentor_notes mn on mn.owner_id = o.id and mn.kind = 'check-in'
  -- is_staff('mentor') is "a mentor or an admin": checked once, before can_mentor's per-owner rule.
  where (select private.is_staff('mentor')) and private.can_mentor(o.id)
  group by o.id;
$$;

revoke all on function public.last_check_ins(uuid[]) from public, anon;
grant execute on function public.last_check_ins(uuid[]) to authenticated, service_role;

-- --- Deleting a shop takes its mentor's word about it away (POPIA) --------------------------------------------------------

-- The "You're now mentoring {shop}" notification names a shop that no longer exists once its owner deletes their
-- account (the shop row goes with it). The sample store does the same in deleteAccountData (lib/data/accounts.ts).
create function private.forget_mentor_word_about_shop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n where n.kind = 'staff-role' and n.href = '/mentor/' || old.slug;
  return old;
end;
$$;

create trigger shops_forget_mentor_word
after delete on public.shops
for each row execute function private.forget_mentor_word_about_shop();

revoke all on function private.forget_mentor_word_about_shop() from public, anon, authenticated, service_role;

-- --- A shop's new link takes its mentor's word with it ------------------------------------------------------------------

-- change_shop_slug gives a shop a new link once (selling spec 2.11); the old one opens nothing. The notification's link
-- follows, so it never leads to the 404. Its subject keeps the link it was made with. The sample store does the same in
-- changeShopSlug (lib/data/shops.ts).
create function private.move_mentor_word_with_shop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications n
  set href = '/mentor/' || new.slug
  where n.kind = 'staff-role' and n.href = '/mentor/' || old.slug;
  return new;
end;
$$;

create trigger shops_move_mentor_word
after update of slug on public.shops
for each row when (old.slug is distinct from new.slug)
execute function private.move_mentor_word_with_shop();

revoke all on function private.move_mentor_word_with_shop() from public, anon, authenticated, service_role;

-- --- set_shop_mentor, replaced (from 20261021120500_own_target_gate.sql) ---------------------------------------------

-- A shop's mentor, as before (assignMentor), and now the new mentor is told.
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin).
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
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop(p_shop) then
    return 'own-shop';
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
  -- role views N4: the new mentor hears it, with a link to the shop's mentor page. A removal tells no one.
  if p_mentor is not null then
    perform private.notify(
      p_mentor, 'staff-role', shop.slug, private.mentor_assigned_note_text(shop.name), '/mentor/' || shop.slug
    );
  end if;
  return 'changed';
end;
$$;
