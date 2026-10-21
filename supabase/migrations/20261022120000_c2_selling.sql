-- Phase C2's selling SQL (supabase phase C2/C3 plan, Task 1; decisions 6, 7 and 10, and the controller's answer to
-- amendment 2). What the Supabase twins of lib/data/shops.ts and lib/selling/form-state.ts need that phase A and the
-- schema catch-up didn't give:
--
-- 1. Links a fixed route uses (decision 7). RESERVED_SLUGS (lib/selling/rules.ts:30) is now in SQL too:
--    private.reserved_shop_slugs(). slugify (rules.ts:56) adds "-shop" to a reserved word, so a shop named "Export"
--    gets export-shop here as in the app, and shop_slug_in_use counts a reserved word as in use, so no change of link
--    takes it. Add a word to both together: lib/selling/reserved-slugs-sql.test.ts compares them.
-- 2. The name and link checks (decision 6): isShopNameTaken (lib/data/shops.ts:29) and isSlugTaken (shops.ts:48) must
--    see shops the access rules hide from the asker (waiting, declined, paused by the Hub), as the sample's do. Each
--    answers only true or false.
-- 3. The owner's old links (SellerRow.previousSlugs; ShopExport.previousLinks): shop_previous_slugs has no API read.
-- 4. One-time tokens taken through takeFormState (the controller's answer to amendment 2, which keeps save_listing as
--    it is): public.take_form_state(p_key) takes this session's 'listing-once:<uuid>' (a new listing,
--    lib/selling/form-state.ts) or 'staff-once:<uuid>' (save this search, lib/staff/once.ts) row, before the save, as
--    the sample does. take_once_token's rule is now private.take_form_once(p_form), which take_once_token wraps,
--    unchanged in behaviour; take_form_state wraps take_once_token for a staff form and take_form_once for a listing.
-- 5. Form states may last 65 minutes, not 60 (decision 10): listing and staff tokens last exactly an hour from the
--    app's clock (LISTING_TOKEN_TTL_MS, ONCE_TTL_MS), so an app clock a millisecond ahead of the database's had its
--    insert refused. The hourly sweep still removes every row.
--
-- private.slugify is replaced from 20261015120000_actions.sql:210, private.shop_slug_in_use from
-- 20261020120000_widen.sql:242, private.take_once_token from 20261020120400_staff_tools_actions.sql:85, and the
-- form_states policy from 20261015004614_sign_in.sql:84, their latest definitions. create or replace keeps grants.

-- --- Reserved links (decision 7) -------------------------------------------------------------------------------------

-- RESERVED_SLUGS (lib/selling/rules.ts:30): words a fixed route uses beside a shop's link (/mentor/export is the CSV).
-- Add a word here and there together; lib/selling/reserved-slugs-sql.test.ts compares them.
create function private.reserved_shop_slugs()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['export']::text[];
$$;

-- A shop's link from its name (slugify in lib/selling/rules.ts:56): the name's a to z and digits joined by hyphens, at
-- most 40; one shorter than 3, or a reserved word, gets "-shop", and a name with none is "shop".
create or replace function private.slugify(name text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when char_length(s) >= 3 and not (s = any (private.reserved_shop_slugs())) then s
    when s <> '' then s || '-shop'
    else 'shop'
  end
  from (
    select regexp_replace(
      left(regexp_replace(regexp_replace(private.name_key(name), '[^a-z0-9]+', '-', 'g'), '^-+', ''), 40),
      '-+$', ''
    ) as s
  ) x;
$$;

-- Whether a link is in use (slugInUse, shops.ts:41): a reserved word, another shop's link now, or any shop's before its
-- change. `own` keeps its own current link (and only that: its old one stays reserved). The caller holds the shop-link
-- lock (private.lock_shop_links), except the read-only check below.
create or replace function private.shop_slug_in_use(link text, own uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select link = any (private.reserved_shop_slugs())
    or exists (select 1 from public.shops s where s.slug = link and s.id is distinct from own)
    or exists (select 1 from public.shop_previous_slugs p where p.slug = link);
$$;

revoke all on function private.reserved_shop_slugs() from public, anon, authenticated, service_role;

-- --- The name and link checks (decision 6) -------------------------------------------------------------------------

-- isShopNameTaken (lib/data/shops.ts:29): whether another shop on the campus has this name, compared as names are
-- (name_key), a waiting, declined or Hub-paused shop's included. `p_except_slug` is the shop being edited. True or
-- false only: it names no shop.
-- A user action (advisor 0029 lists it on purpose).
create function public.shop_name_taken(p_name text, p_campus_slug text, p_except_slug text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shops s
    where s.campus_slug = p_campus_slug
      and s.name_key = private.name_key(coalesce(p_name, ''))
      and s.slug is distinct from p_except_slug
  );
$$;

-- isSlugTaken (shops.ts:48): a reserved word, a shop's link now, or any shop's before its change. True or false only.
-- A user action (advisor 0029 lists it on purpose).
create function public.shop_slug_taken(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.shop_slug_in_use(p_slug, null);
$$;

-- The signed-in owner's old links, oldest first (SellerRow.previousSlugs; ShopExport.previousLinks). None for anyone
-- without a shop.
-- A user action (advisor 0029 lists it on purpose).
create function public.my_previous_shop_slugs()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.slug order by p.created_at, p.slug), '{}')
  from public.shop_previous_slugs p
  where p.shop_id = private.shop_of((select auth.uid()));
$$;

revoke all on function public.shop_name_taken(text, text, text), public.shop_slug_taken(text),
  public.my_previous_shop_slugs()
from public, anon;
grant execute on function public.shop_name_taken(text, text, text), public.shop_slug_taken(text),
  public.my_previous_shop_slugs()
to authenticated, service_role;

-- --- One-time tokens (the controller's answer to amendment 2) --------------------------------------------------------

-- Takes a form's one-time token row `p_form` of the signed-in account's own session (the JWT's session_id), while it
-- lasts. The check and the mark are one step under the row's lock, so of two posts sent together only one is first.
-- Returns 'first' (it was free, and is taken now), 'again' (taken already) or 'none' (no such row in this session).
-- take_once_token's body (20261020120400_staff_tools_actions.sql:85), with the form name given whole.
create function private.take_form_once(p_form text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  sid text := (select auth.jwt()) ->> 'session_id';
  was boolean;
begin
  if p_form is null or sid is null or sid !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    return 'none';
  end if;
  select f.taken into was
  from public.form_states f
  where f.session_id = sid::uuid and f.form = p_form and f.account_id = (select auth.uid())
    and f.expires_at > now()
  for update;
  if not found then
    return 'none';
  end if;
  if was then
    return 'again';
  end if;
  update public.form_states f
  set taken = true
  where f.session_id = sid::uuid and f.form = p_form;
  return 'first';
end;
$$;

-- Takes the staff form's one-time token for this post (takeOnceToken, once.ts:65), inside save_request and the staff
-- functions: the row 'staff-once:<token>'. Unchanged in behaviour; its rule is take_form_once's now.
create or replace function private.take_once_token(p_token text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    return 'none';
  end if;
  return private.take_form_once('staff-once:' || p_token);
end;
$$;

-- takeFormState (lib/data/form-states.ts) for a token no SQL function of its own takes: a new listing's
-- ('listing-once:<uuid>', lib/selling/form-state.ts, before save_listing, as the sample does) and save this search's
-- ('staff-once:<uuid>', lib/saved-searches/actions.ts). The same rule as take_once_token: this session's own row of
-- the signed-in account, while it lasts, checked and marked under its lock. Returns 'first', 'again' or 'none'. Any
-- other form name is 'none' and changes nothing.
-- A user action (advisor 0029 lists it on purpose).
create function public.take_form_state(p_key text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_key ~ '^staff-once:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    return private.take_once_token(substr(p_key, char_length('staff-once:') + 1));
  end if;
  if p_key ~ '^listing-once:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    return private.take_form_once(p_key);
  end if;
  return 'none';
end;
$$;

revoke all on function private.take_form_once(text) from public, anon, authenticated, service_role;
revoke all on function public.take_form_state(text) from public, anon;
grant execute on function public.take_form_state(text) to authenticated, service_role;

-- --- Form states may last 65 minutes (decision 10) ---------------------------------------------------------------------

-- One policy for every command: the account's own, and only those of the session asking (the JWT's session_id), so
-- another browser signed in to the same account never sees this one's errors or typed values. A form state lasts 10
-- minutes (FORM_STATE_TTL_MS) and a one-time token an hour from the app's clock; one meant to last longer than 65
-- minutes is refused (C2/C3 plan decision 10: five minutes for the app's clock to run ahead of the database's), so
-- the hourly sweep always gets it.
drop policy "Owners keep their form states, per session" on public.form_states;
create policy "Owners keep their form states, per session"
on public.form_states for all
to authenticated
using (
  account_id = (select auth.uid())
  and session_id = ((select auth.jwt()) ->> 'session_id')::uuid
)
with check (
  account_id = (select auth.uid())
  and session_id = ((select auth.jwt()) ->> 'session_id')::uuid
  and expires_at <= now() + interval '65 minutes'
);
