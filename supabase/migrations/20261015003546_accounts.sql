-- Accounts (supabase foundation plan, Task 5; backend spec 4.2 and 4.3): profiles, consents and seller profiles, and
-- the staff and shop-owner helpers the policies use.
--
-- - A profile is made by the app on the first sign-in's step 3 (plan decision 1), not by a trigger on auth.users. The
--   API roles have no insert or update grant on profiles, and none on consents: public.complete_profile,
--   public.update_profile and public.record_consent (the actions migration) make and change them, so each rule lives
--   in one place.
-- - Roles are read from profiles.roles at the time of each request (spec 4.3), never from the JWT.
-- - anon has no grant on any of these tables, so it sees nothing.

-- The privacy policy versions a student can agree to (POLICY_VERSION in lib/auth/config.ts). A new version of the
-- policy is added here by a migration, before the app asks for it.
create table private.policy_versions (
  version text primary key check (version ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(version) <= 40)
);
alter table private.policy_versions enable row level security;
revoke all on table private.policy_versions from public, anon, authenticated;
grant all on table private.policy_versions to service_role;
insert into private.policy_versions (version) values ('2026-10-draft');

-- A first name as checkFirstName (lib/auth/profile.ts) leaves it: composed (NFC); no control or invisible format
-- characters (Unicode's Cc and Cf, listed out because Postgres's regular expressions have no \p{Cf}); no white space
-- but single ordinary spaces, none at the ends; 2 to 40 characters, at least one of them a letter. The app tidies the
-- name first, so this refuses only what it would never send.
create function private.is_first_name(name text)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.char_length(name) between 2 and 40
    and name is nfc normalized
    and name !~ '[\u0001-\u001f\u007f-\u009f]'
    and name !~ ('[\u00ad\u0600-\u0605\u061c\u06dd\u070f\u0890-\u0891\u08e2\u180e\u200b-\u200f\u202a-\u202e'
      || '\u2060-\u2064\u2066-\u206f\ufeff\ufff9-\ufffb\U000110bd\U000110cd\U00013430-\U0001343f'
      || '\U0001bca0-\U0001bca3\U0001d173-\U0001d17a\U000e0001\U000e0020-\U000e007f]')
    and name !~ '[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]'
    and name !~ '  '
    and name = pg_catalog.btrim(name, ' ')
    and (name collate pg_catalog."und-x-icu") ~ '[[:alpha:]]';
$$;
revoke all on function private.is_first_name(text) from public, anon, authenticated;
grant execute on function private.is_first_name(text) to service_role;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 2 to 40 characters, tidied, with a letter (private.is_first_name).
  first_name text not null check (private.is_first_name(first_name)),
  campus_slug text not null references public.campuses (slug),
  roles text[] not null default '{}' check (roles <@ array['mentor', 'admin']::text[]),
  created_at timestamptz not null default now()
);
create index profiles_campus_slug_idx on public.profiles (campus_slug);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  -- One of the versions the policy has had.
  version text not null references private.policy_versions (version),
  agreed_at timestamptz not null default now(),
  -- Also the index for the account foreign key.
  unique (account_id, version)
);

create table public.seller_profiles (
  account_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'paused')),
  -- The shop this account owns. The foreign key to shops is added by the selling migration. One owner per shop, so
  -- unique, which is also the foreign key's index.
  shop_id uuid unique,
  applied_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.seller_profiles enable row level security;

-- Whether the signed-in account is staff for an area (staff tools spec): 'admin', 'hub' or 'mentor'. Admin passes
-- every area; a mentor passes hub and mentor. Anything else, or no one signed in, is false.
create function private.is_staff(area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when area is null or area not in ('admin', 'hub', 'mentor') then false
        when 'admin' = any (p.roles) then true
        when area in ('hub', 'mentor') then 'mentor' = any (p.roles)
        else false
      end
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

-- Whether the signed-in account owns the shop: its seller profile points at it (messaging plan decision 1: whoever
-- owns the shop now answers for it).
create function private.owns_shop(shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.seller_profiles s
    where s.account_id = (select auth.uid()) and s.shop_id = shop
  );
$$;

-- Policies call these as the signed-in role, which needs EXECUTE (not USAGE on private: see the foundation migration).
revoke all on function private.is_staff(text), private.owns_shop(uuid) from public, anon;
grant execute on function private.is_staff(text), private.owns_shop(uuid) to authenticated, service_role;

-- Grants: the owner reads their own; every write goes through a function. Nothing for anon.
revoke all on table public.profiles, public.consents, public.seller_profiles from anon, authenticated;
grant select on table public.profiles, public.consents, public.seller_profiles to authenticated;
grant all on table public.profiles, public.consents, public.seller_profiles to service_role;

create policy "Owners read their profile, and staff read every profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or (select private.is_staff('mentor')));

create policy "Owners read their consents"
on public.consents for select
to authenticated
using (account_id = (select auth.uid()));

create policy "Owners read their seller profile"
on public.seller_profiles for select
to authenticated
using (account_id = (select auth.uid()));
