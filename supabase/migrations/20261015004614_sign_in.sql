-- Sign-in (supabase foundation plan, Task 8; backend spec section 5): the attempt behind the vossie_signin cookie, the
-- 5-codes-an-hour counter, the allowed email domains and the two Auth hooks that enforce them, and signed-in form
-- states.
--
-- - The private tables have no grants to anon or authenticated, and row level security on with no policy for them,
--   so only their owner, the service role and the security-definer functions below reach them. The advisor's INFO
--   finding 0008 (rls_enabled_no_policy) on sign_in_attempts and code_sends is this, on purpose: deny everyone else.
-- - Supabase Auth now generates, hashes and checks the code, so sign_in_attempts has no code_hash.
-- - The functions here are in `private`, which the Data API doesn't expose: phase B calls them from the server with
--   the service role (through a public wrapper granted to the service role only, or a direct connection).

create table private.sign_in_attempts (
  -- An HMAC of the vossie_signin cookie's token (GO-LIVE: keyed hashes), never the token.
  key text primary key check (char_length(key) between 1 and 128),
  step text not null default 'email' check (step in ('email', 'code', 'profile')),
  -- Lower case. On step 1 after an error, what was typed.
  email text not null default '' check (char_length(email) <= 254),
  errors text[] not null default '{}' check (errors <@ array[
    'email-missing', 'email-domain', 'email-rate', 'consent-missing', 'code-missing', 'code-wrong', 'code-expired',
    'code-rate', 'locked', 'first-name-missing', 'first-name-length', 'campus-missing'
  ]::text[]),
  -- True straight after "Send a new code".
  resent boolean not null default false,
  code_expires_at timestamptz,
  -- Wrong tries on the current code: the 5th ends the attempt (record_wrong_try).
  wrong_tries int not null default 0 check (wrong_tries >= 0),
  -- When the privacy policy box was ticked.
  consented_at timestamptz,
  -- Step 3's answers after an error.
  first_name text not null default '' check (char_length(first_name) <= 200),
  campus_slug text not null default '' check (char_length(campus_slug) <= 100),
  -- When the last post saved this attempt; its errors show for a minute after.
  posted_at timestamptz,
  expires_at timestamptz not null
);
create index sign_in_attempts_expires_at_idx on private.sign_in_attempts (expires_at);

-- Codes sent per email per UTC hour (spec 5: 5 an hour).
create table private.code_sends (
  email text not null,
  hour timestamptz not null,
  n int not null check (n >= 1),
  primary key (email, hour)
);
create index code_sends_hour_idx on private.code_sends (hour);

-- The domains that can sign in, and their subdomains. Staging can allow a test domain without a code change.
create table private.allowed_email_domains (
  domain text primary key check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
);

alter table private.sign_in_attempts enable row level security;
alter table private.code_sends enable row level security;
alter table private.allowed_email_domains enable row level security;
revoke all on table private.sign_in_attempts, private.code_sends, private.allowed_email_domains
  from public, anon, authenticated;
grant all on table private.sign_in_attempts, private.code_sends, private.allowed_email_domains to service_role;

-- A signed-in form's errors, typed values or notice after a post (accounts plan decision 3), for one Auth session.
-- The app writes it with the viewer's session, so the owner reads and writes their own and nobody else's.
create table public.form_states (
  -- The Auth session's id (the JWT's session_id).
  session_id uuid not null,
  form text not null check (char_length(form) between 1 and 100),
  account_id uuid not null references public.profiles (id) on delete cascade,
  errors text[] not null default '{}' check (cardinality(errors) <= 64),
  -- Generous bounds, as a backstop: the app keeps at most 4,000 characters of each typed field.
  values jsonb not null default '{}' check (jsonb_typeof(values) = 'object' and octet_length(values::text) <= 65536),
  notice text check (char_length(notice) <= 100),
  expires_at timestamptz not null,
  primary key (session_id, form)
);
create index form_states_account_id_idx on public.form_states (account_id);
create index form_states_expires_at_idx on public.form_states (expires_at);

alter table public.form_states enable row level security;
revoke all on table public.form_states from anon, authenticated;
grant select, insert, update, delete on table public.form_states to authenticated;
grant all on table public.form_states to service_role;

-- One policy for every command: the account's own, and only those of the session asking (the JWT's session_id), so
-- another browser signed in to the same account never sees this one's errors or typed values. A form state lasts 10
-- minutes (FORM_STATE_TTL_MS); one meant to last longer than an hour is refused, so the hourly sweep always gets it.
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
  and expires_at <= now() + interval '1 hour'
);

-- Reserves one of an email's codes for the hour (spec 5): true while under the limit, false once it's reached.
-- Atomic as one statement: INSERT … ON CONFLICT DO UPDATE locks the (email, hour) row. A second session's upsert waits
-- for that lock, then re-checks `n < limit` against the row as the first left it (Postgres re-evaluates the update's
-- WHERE on the newest row version), so two posts at once can never both take the last code. Hours are UTC hours.
create function private.reserve_code_send(send_to text, sent_at timestamptz, max_sends int)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  counted int;
begin
  if max_sends is null or max_sends < 1 then
    return false;
  end if;
  insert into private.code_sends as c (email, hour, n)
  values (send_to, pg_catalog.date_trunc('hour', sent_at, 'UTC'), 1)
  on conflict on constraint code_sends_pkey do update set n = c.n + 1 where c.n < max_sends
  returning c.n into counted;
  return counted is not null;
end;
$$;

-- Counts a wrong try on an attempt's code, before anything is compared (spec 4.4), and returns the new count, or null
-- when there's no such attempt. One UPDATE, so tries at once each count.
create function private.record_wrong_try(attempt_key text)
returns int
language sql
volatile
security definer
set search_path = ''
as $$
  update private.sign_in_attempts
  set wrong_tries = wrong_tries + 1
  where key = attempt_key
  returning wrong_tries;
$$;

revoke all on function private.reserve_code_send(text, timestamptz, int), private.record_wrong_try(text)
  from public, anon, authenticated;
grant execute on function private.reserve_code_send(text, timestamptz, int), private.record_wrong_try(text)
  to service_role;

-- Whether an address may sign in: its domain, or a domain it's a subdomain of, is in allowed_email_domains. No domains
-- listed means nobody. The address must be plain ASCII, as checkEmail in lib/auth/email.ts asks, so a look-alike
-- letter can't pass; it's checked before it's lower-cased, since lower-casing turns a few non-ASCII letters (the Kelvin
-- sign) into ASCII ones. Outer spaces are ignored. Both Auth hooks below use it, so the rule lives in one place.
create function private.email_allowed(address text)
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
  return exists (
    select 1 from private.allowed_email_domains a
    where a.domain = address_domain
      or pg_catalog.right(address_domain, pg_catalog.char_length(a.domain) + 1) = '.' || a.domain
  );
end;
$$;

-- Auth's "before user created" hook (config.toml [auth.hook.before_user_created]): refuses every address that
-- private.email_allowed refuses. The app checks first, for its own friendly error; this is the backstop.
create function private.before_user_created(event jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case
    when private.email_allowed(event -> 'user' ->> 'email') then '{}'::jsonb
    else '{"error": {"http_code": 403, "message": "Use your Eduvos email address."}}'::jsonb
  end;
$$;

-- Auth's "custom access token" hook (config.toml [auth.hook.custom_access_token]), run before every access token is
-- issued, at sign-in and at each refresh. Vossie signs in by email code only (backend spec section 5), so it refuses a
-- token unless:
-- - it comes from an email code: the event's authentication_method is "otp" (verifyOtp, for a new or an existing
--   address, and the confirmation of an email change) or "token_refresh", and every method in the session's amr claim
--   is "otp". A password sign-in (a password added with PUT /auth/v1/user, or one made at POST /auth/v1/signup) is
--   "password", and its refreshes keep "password" in amr;
-- - the account's address is still allowed (private.email_allowed): an address changed to another domain gets no new
--   token, at sign-in or at refresh. The claims carry the current address.
-- Checked on the local stack (2026-10-15, Auth with CLI 2.118): those are the methods and amr values Auth sends. On
-- success the claims go back unchanged, with Auth's required claims intact. Refusing is a 403 with a message.
-- It reads one small table, well inside Auth's time limit for a hook.
create function private.custom_access_token(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  amr jsonb := event -> 'claims' -> 'amr';
begin
  if coalesce(event ->> 'authentication_method', '') not in ('otp', 'token_refresh')
    or pg_catalog.jsonb_typeof(amr) is distinct from 'array'
    or pg_catalog.jsonb_array_length(amr) = 0
    or exists (select 1 from pg_catalog.jsonb_array_elements(amr) m where m ->> 'method' is distinct from 'otp')
  then
    return '{"error": {"http_code": 403, "message": "Sign in with the code we email you."}}'::jsonb;
  end if;
  if not private.email_allowed(claims ->> 'email') then
    return '{"error": {"http_code": 403, "message": "Use your Eduvos email address."}}'::jsonb;
  end if;
  return pg_catalog.jsonb_build_object('claims', claims);
end;
$$;

-- Only Auth runs the hooks, as supabase_auth_admin, which reads the allowed domains and nothing else in private.
revoke all on function private.email_allowed(text), private.before_user_created(jsonb), private.custom_access_token(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.email_allowed(text), private.before_user_created(jsonb), private.custom_access_token(jsonb)
  to supabase_auth_admin;
grant usage on schema private to supabase_auth_admin;
grant select on table private.allowed_email_domains to supabase_auth_admin;

create policy "Auth reads the allowed domains"
on private.allowed_email_domains for select
to supabase_auth_admin
using (true);
