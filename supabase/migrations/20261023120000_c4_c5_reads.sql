-- Phases C4 and C5: the reads the community and staff twins need that no policy or view gives yet (supabase phase
-- C4/C5 plan, Task 1; decision 12, "Missing SQL", amendments 3 and 5, and the controller's answers).
--
-- Not made, by amendment 3's probe (supabase/tests/50_c4_c5_reads.test.sql): my_follows and my_request_offers. The
-- shops policy already lets a follower, and the asker in an offer thread (start_offer makes them its buyer), read a
-- shop the Hub has paused (private.is_shop_contact, 20261020120600_staff_pause_storefront.sql:53), and the storefronts
-- view tells a seller's pause (listed, paused) from the Hub's (not listed). So listFollowedShops, shopNameOf and
-- exportFollowing (lib/data/follows.ts:61) read follows, shops and storefronts, and offersForRequest
-- (lib/data/offers.ts:39) reads my_conversations, shops and messages, each as the signed-in account.
-- Not made, by the controller's answer: take_form_state, which C2/C3 made (20261022120000_c2_selling.sql:192).
--
-- Both additions are read-only and answer only for an admin: a security_invoker view over a private security definer
-- function, and one function, each with an empty search path, revoked from public and anon.

-- Staff accounts (listStaffAccounts and getStaffAccount, lib/data/staff-accounts.ts:72; stage J spec decision 2): for
-- admins only, everyone with a role and no one else, with the email roles are given by (lower case, as normaliseEmail
-- leaves it), first name, campus and roles in stored order. No API role reads auth.users, so the email comes from here.
-- Students without a role are never listed (POPIA section 10).
create function private.staff_accounts()
returns table (id uuid, first_name text, email text, campus_slug text, roles text[])
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.first_name, lower(u.email), p.campus_slug, p.roles
  from public.profiles p
  join auth.users u on u.id = p.id
  where cardinality(p.roles) > 0 and (select private.is_staff('admin'));
$$;

create view public.staff_accounts
with (security_invoker = true)
as
select a.id, a.first_name, a.email, a.campus_slug, a.roles
from private.staff_accounts() a;

-- Give a staff role's check (giveStaffRole, lib/staff/account-actions.ts:61): the account with exactly this email,
-- trimmed and lower case (normaliseEmail), never a search, a prefix or a pattern; for admins only. Its id, first name
-- and roles. No row for anyone else, for a blank address, or for an Auth user with no profile; never an error, so it
-- hints at nothing.
-- A staff action (advisor 0029 lists it on purpose).
create function public.staff_find_account(p_email text)
returns table (id uuid, first_name text, roles text[])
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.first_name, p.roles
  from public.profiles p
  join auth.users u on u.id = p.id
  where (select private.is_staff('admin'))
    and btrim(coalesce(p_email, '')) <> ''
    and lower(u.email) = lower(btrim(p_email));
$$;

-- The view runs its function as the signed-in role, which needs EXECUTE (2b amendment 6's reason).
revoke all on function private.staff_accounts() from public, anon, authenticated;
grant execute on function private.staff_accounts() to authenticated, service_role;
revoke all on function public.staff_find_account(text) from public, anon;
grant execute on function public.staff_find_account(text) to authenticated, service_role;

-- Supabase's default privileges would give the view to anon (and write grants): revoked first, then select only.
revoke all on table public.staff_accounts from public, anon, authenticated, service_role;
grant select on table public.staff_accounts to authenticated, service_role;
