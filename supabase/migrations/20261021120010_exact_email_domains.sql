-- Exact sign-in domains only (supabase step 2b plan, Task 1, amendment 2; Lama, 2026-10-21): an address may sign in
-- only at a domain listed in private.allowed_email_domains (eduvos.com and vossie.net in production), never at a
-- subdomain of one. checkEmail (lib/auth/email.ts) drops its subdomain rule in the same change, so the app's friendly
-- check and this backstop keep one rule.
--
-- private.email_allowed is replaced with the same shape check as 20261015004614_sign_in.sql, and without the
-- right(...) = '.' || domain branch. Both Auth hooks (before_user_created and custom_access_token) call it, so both
-- follow. Its grants are restated as in the sign-in migration: supabase_auth_admin only.

-- Whether an address may sign in: its domain is in allowed_email_domains, exactly. No domains listed means nobody. The
-- address must be plain ASCII, as checkEmail in lib/auth/email.ts asks, so a look-alike letter can't pass; it's checked
-- before it's lower-cased, since lower-casing turns a few non-ASCII letters (the Kelvin sign) into ASCII ones. Outer
-- spaces are ignored. Both Auth hooks use it, so the rule lives in one place.
create or replace function private.email_allowed(address text)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  typed text := pg_catalog.btrim(address);
  address_domain text;
begin
  if typed is null
    or pg_catalog.char_length(typed) > 254
    or typed !~ '^[\x21-\x3f\x41-\x7e]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$'
  then
    return false;
  end if;
  -- The part before the @ has no @, so the domain is everything after the only one.
  address_domain := pg_catalog.lower(pg_catalog.split_part(typed, '@', 2));
  return exists (select 1 from private.allowed_email_domains a where a.domain = address_domain);
end;
$$;

-- Only Auth runs it, as supabase_auth_admin (as in the sign-in migration).
revoke all on function private.email_allowed(text) from public, anon, authenticated, service_role;
grant execute on function private.email_allowed(text) to supabase_auth_admin;
