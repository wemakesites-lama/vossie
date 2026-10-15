# Supabase foundation (phase A): build plan

- **Spec:** `docs/superpowers/specs/2026-10-15-supabase-backend-design.md` (sections 2 to 9).
- **Goal:** a staging Supabase project and a `supabase/` folder that rebuild the whole database for stages D to F from migrations: tables, access rules, atomic functions, storage, jobs, seed data and pgTAP tests. Also the server clients in `lib/supabase/`, ready for phase B but imported by nothing yet.
- **Not in this phase:** any change to `lib/data`, `lib/auth`, pages, components, `proxy.ts` or the privacy page. The app keeps running on the sample store exactly as now.
- **Where:** a git worktree on branch `backend/supabase-foundation`, so the main checkout's frontend work (stage F) is never touched. Nearly every file is new; the only shared files are `package.json`, `pnpm-lock.yaml` and `.env.example` (Task 12), and they merge by re-running `pnpm install`.
- **How the SQL is written:** test first. Each task writes its pgTAP tests in `supabase/tests/`, sees them fail on `supabase test db`, then writes the migration. Column lists below are the contract; the SQL itself is written in the task.

## Safety (from CLAUDE.md, highest priority)

- Lama makes the project, the token and the database password. Claude never sees the token or the password, and never asks for them in chat.
- Every command that changes the **staging project** (`db push`, `config push`, seeding) is shown to Lama first with `--dry-run` output, and runs only on Lama's go-ahead for that run.
- No commits or pushes without Lama's go-ahead. One git command at a time. Never `supabase db reset --linked` (it wipes the remote).
- Never kill `supabase start`, `pnpm install` or a migration mid-run.

---

## Task 0: Lama's setup (done 2026-10-15)

- **Staging project:** "Vossie Market", ref `kahzsitqnocygsrdfpre`, Ireland (eu-west-1), Postgres 17.11, made by Lama on 2026-10-14. On 2026-10-15 its database was empty: no `public` tables, no users, no buckets.
- **Token:**
  - scoped to that project only, and it expires on 2026-10-22;
  - Lama shared it in the chat, so it's in that session's transcript. Revoke it once phase A is done, and keep later tokens out of chats;
  - Claude keeps it in a private file in the session's scratchpad (mode 600), never in the repo, and passes it to each command as `SUPABASE_ACCESS_TOKEN`;
  - the CLI's own stored login is Lama's account-wide token, which sees other projects. Don't use it for Vossie.
- **Still Lama's, by hand:**
  - keep the database password in your password manager;
  - in **Settings → API keys**, make sure a publishable key and a secret key exist, and leave the legacy keys alone until phase B, which turns them off.

**Check (Claude, done):** the token sees exactly one project, "Vossie Market", in eu-west-1.

**Before each later session:** a new scoped token if this one has expired.

## Task 1: Worktree and CLI

1. With Lama's go-ahead, create the worktree on a new branch. Run `git status` first, as a separate call:
   ```bash
   git worktree add ../Vossie-supabase -b backend/supabase-foundation
   ```
2. Upgrade the CLI from 2.118.0 to the current 2.121.x (`brew upgrade supabase`), with Lama's go-ahead.
3. Run `pnpm install` in the worktree.

## Task 2: `supabase init` and `config.toml`

- Run `supabase init`, and answer **no** to the declarative-schema and IDE prompts (spec decision 8).
- Settings to write into `supabase/config.toml`:

  | Setting | Value | Why |
  |---|---|---|
  | `project_id` | `vossie` | |
  | `[db] major_version` | the staging project's (check with `supabase inspect db` or the dashboard, probably 17) | Local and remote must match |
  | `[api] schemas` | `["public"]` | `private` is never exposed |
  | `[api] extra_search_path` | `["public", "extensions"]` | |
  | `[auth] site_url` | `http://localhost:3100` | |
  | `[auth] additional_redirect_urls` | the staging preview's address | |
  | `[auth] jwt_expiry` | `3600` | |
  | `[auth] enable_refresh_token_rotation` | `true` | |
  | `[auth] enable_signup` | `true` | |
  | `[auth.email] enable_signup`, `enable_confirmations` | `true`, `false` | The code is the confirmation |
  | `[auth.email] otp_length`, `otp_expiry` | `6`, `600` | 10 minutes (accounts spec 2.2) |
  | `[auth.email] max_frequency` | `"60s"` | |
  | `[auth.email.template.magic_link]` | `subject = "Your Vossie sign-in code"`, `content_path = "./supabase/templates/sign-in-code.html"` | Shows `{{ .Token }}` |
  | `[auth.hook.before_user_created]` | `enabled = true`, `uri = "pg-functions://postgres/private/before_user_created"` | Task 8 |
  | `[auth.rate_limit]` | `email_sent = 30`, `token_verifications = 30` | Supabase's defaults, written down |
  | `[storage] file_size_limit` | `"5MiB"` | |
  | `[storage.buckets.photos]` | `public = false`, `file_size_limit = "5MiB"`, `allowed_mime_types = ["image/jpeg","image/png","image/webp"]` | Spec section 6 |
  | `[db.seed]` | `sql_paths = ["./seed.sql"]` | |
  | `[analytics] enabled` | `false` | Saves memory locally |

- Write `supabase/templates/sign-in-code.html`: short, plain and accessible, with the code large and the words of the sample-mode screen. It says the code lasts 10 minutes, and that someone who didn't ask for it can ignore it. It contains no tracking pixel and no link.
- **Check:** `supabase start` comes up, and `supabase status` lists the local URLs (Studio at 54323, Mailpit at 54324).

## Task 3: Migration `…_foundation.sql` (schemas, extensions, helpers)

- `create schema private`, then `revoke all on schema private from public, anon, authenticated`.
- Extensions: `pg_cron`, `unaccent` and `pgtap` (tests only, in `extensions`).
- `private.new_short_id()` returns a 10-character `[a-z0-9]` id from `gen_random_bytes` (spec 4.1).
- `private.name_key(text)` is the same normalisation as `nameKey` in `lib/selling/rules.ts`: lower case, accents dropped with `unaccent`, punctuation and spaces dropped. pgTAP checks it against a table of the inputs from `lib/selling/rules.test.ts`.
- `private.sast_day(timestamptz)` returns `date`, as `(t at time zone 'Africa/Johannesburg')::date`.
- **Defence in depth:** an event trigger that raises if a table is created in `public` without RLS by the end of the migration. Supabase documents this pattern.

## Task 4: Migration `…_reference.sql` (campuses, categories, pickup points)

| Table | Columns |
|---|---|
| `campuses` | `slug text pk check (slug ~ '^[a-z0-9-]+$')`, `name text not null`, `region text not null`, `sort int not null`, `is_online bool not null default false` |
| `categories` | `slug text pk`, `name text not null`, `sort int not null` |
| `pickup_points` | `id uuid pk`, `campus_slug text fk → campuses`, `name text check (char_length between 2 and 60)`, `name_key text generated`, `retired_at timestamptz`, `created_at timestamptz default now()`; unique (`campus_slug`, `name_key`) |

- **Grants:** `select` to `anon` and `authenticated`, and everything to `service_role`.
- **RLS:** anyone may read campuses and categories. Anyone may read pickup points where `retired_at is null`. Writes go through the admin client only, in stage G.
- **Tests:** anon reads all three; anon and authenticated can't insert, update or delete; a retired point is invisible.

## Task 5: Migration `…_accounts.sql` (profiles, consents, seller profiles)

| Table | Columns |
|---|---|
| `profiles` | `id uuid pk references auth.users on delete cascade`, `first_name text check (char_length between 2 and 40)`, `campus_slug text fk`, `roles text[] not null default '{}' check (roles <@ array['mentor','admin'])`, `created_at` |
| `consents` | `id uuid pk`, `account_id uuid fk → profiles on delete cascade`, `version text`, `agreed_at timestamptz`; unique (`account_id`, `version`) |
| `seller_profiles` | `account_id uuid pk fk → profiles on delete cascade`, `status text check (in ('pending','approved','paused'))`, `shop_id uuid` (fk added in Task 6), `applied_at` |

Helpers, all `security definer`, `stable` and `set search_path = ''`, in `private`:
- `is_staff(area text)` → bool. The values are `admin`, `hub` and `mentor`, as in the staff tools spec: admin passes every area, and mentor passes `hub` and `mentor`.
- `owns_shop(shop uuid)` → bool. True for the account whose seller profile points at the shop.

**RLS:**
- profiles: the owner selects and updates their own `first_name` and `campus_slug`. The `roles` column isn't granted for update to `authenticated`; column grants handle that. Staff select all.
- consents: the owner selects and inserts their own.
- seller_profiles: the owner selects their own. Status changes go through functions (Task 9) and the admin client.

**Tests:**
- one user can't read another's profile;
- a user can't give themselves `admin`;
- anon sees nothing;
- `is_staff` works for each role and area.

## Task 6: Migration `…_selling.sql` (shops, listings, photos, drafts)

| Table | Columns |
|---|---|
| `shops` | `id uuid pk`, `slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length between 3 and 40)`, `owner_id uuid fk → profiles on delete set null`, `name text (2–60)`, `name_key text generated`, `tagline text default '' (≤80)`, `category_slug fk`, `campus_slug fk`, `verified bool default false`, `badge text check (in ('trusted','responsive','new-seller'))`, `about text default '' (≤600)`, `since text check (since ~ '^\d{4}-\d{2}$')`, `image_photo_id uuid` (or a placeholder path), `slug_changed bool default false`, `created_at`, `updated_at`; unique (`campus_slug`, `name_key`) |
| `shop_pickup_points` | `shop_id`, `pickup_point_id`; pk on both |
| `listings` | `id text pk default private.new_short_id()`, `shop_id uuid fk on delete cascade`, `state text check (in ('draft','available','paused','sold'))`, `kind text`, `title text (≤70)`, `category_slug fk`, `condition text null`, `price_zar int null check (between 0 and 100000)`, `price_is_from bool`, `pay_mode text`, `swap_for text null (≤200)`, `description text (≤1000)`, `handover text`, `pickup_point_id uuid null fk`, `campus_slug fk`, `created_at`, `first_published_at timestamptz null`, `updated_at` |
| `photos` | `id uuid pk`, `owner_id uuid fk → profiles on delete cascade`, `use text null` (`listing:<id>`, `shop`, `draft`), `type text check (in ('image/jpeg','image/png','image/webp'))`, `path text unique` (`{owner}/{id}`), `created_at` |
| `listing_photos` | `listing_id text fk on delete cascade`, `photo_id uuid fk on delete cascade`, `position smallint check (between 0 and 5)`, `alt text default '' (≤125)`; pk (`listing_id`, `position`) |
| `onboarding_drafts` | `account_id uuid pk fk`, plus the fields of `OnboardingDraftRow` (`pickup_point_ids uuid[]`), `updated_at` |

**Constraints from the selling rules** (`lib/selling/rules.ts`), as `check`s where a check can say them:
- free means cash;
- swaps need `swap_for`;
- items need a condition;
- pickup needs a pickup point;
- `first_published_at` can't be set back to null (a trigger).

The pickup point must belong to the shop. That check goes in the save function (Task 9), not a `check`.

Helpers, `security definer`, in `private`:
- `shop_status(shop uuid)` returns the owner's profile status. `approved` when there's no owner (seed shops); `pending` when the owner has no profile (`lib/data/catalog.ts:18`).
- `shop_is_public(shop uuid)` is true when the status is `approved` or `paused`.

**RLS:**
- shops: anon and authenticated select where `shop_is_public(id)`; the owner selects their own whatever its status.
- listings: anon and authenticated select where `state <> 'draft' and shop_is_public(shop_id)`; the owner selects all of their shop's.
- Owner writes to shops and listings go through the functions in Task 9 only, so the table grants for `insert`/`update` to `authenticated` are left out. That keeps each rule in one place.
- photos and listing_photos: the owner selects their own. Public photo bytes are served by `/photos/[id]` with the admin client (spec section 6), so `listing_photos` has an anon select for public listings, for the alt text and order.
- onboarding_drafts: the owner only.

**Indexes:**
- `listings (shop_id)`;
- `listings (campus_slug, state, first_published_at desc)`;
- `listings (category_slug)`;
- `photos (owner_id, use)`;
- every foreign key (advisor `0001_unindexed_foreign_keys`).

**Tests:** the five visibility cases from `lib/data/catalog.test.ts` (approved, paused, pending, no owner, draft); an owner sees their draft and nobody else does; a pending shop is invisible to anon.

## Task 7: Migration `…_messaging.sql` (conversations, messages, notifications, reports)

| Table | Columns |
|---|---|
| `conversations` | `id uuid pk`, `listing_id text null fk → listings on delete set null`, `listing_title text null`, `shop_id uuid fk → shops on delete cascade`, `buyer_id uuid null fk → profiles on delete set null`, `seller_gone bool default false`, `status text check (in ('asked','replied','done','confirmed'))`, `created_at`, `last_message_at`, `first_reply_at`, `completed_at`, `confirmed_at`, `confirmed_by text check (in ('buyer','auto'))` |
| `messages` | `id uuid pk`, `conversation_id fk on delete cascade`, `side text check (in ('buyer','seller'))`, `body text check (char_length between 1 and 1000)`, `swap_offer text null (≤200)`, `sent_at`, `read_at` |
| `notifications` | `id uuid pk`, `account_id fk on delete cascade`, `kind text check (in ('message','sale-to-confirm','report-handled','shop-approved'))`, `subject_id text`, `text text`, `href text`, `created_at`, `read_at` |
| `reports` | `id uuid pk`, `reporter_id fk on delete cascade`, `target_kind text check (in ('listing','seller','request'))`, `target_id text`, `target_title text`, `reason text check (…the seven…)`, `detail text default '' (≤500)`, `status text check (in ('open','closed'))`, `created_at` |

**Uniqueness** as partial unique indexes:
- one conversation per (buyer, listing) where `buyer_id is not null and not seller_gone`;
- one per (buyer, shop) where `listing_id is null` and the same conditions;
- one unread `message` notification per (account, subject);
- one open report per (reporter, target kind, target id).

Helper `private.conversation_side(conv uuid)` returns `'buyer'`, `'seller'` or null, the same as `sideOf` in `lib/data/messages.ts:46`.

**RLS:**
- conversations and messages: select where `conversation_side(id) is not null`;
- notifications: the owner only;
- reports: the reporter selects their own;
- every write goes through Task 9's functions.

**Tests:**
- the buyer and the current owner see a thread, and a stranger doesn't;
- after a slug change, the new owner still sees it;
- a seller who has gone doesn't;
- notifications are private.

## Task 8: Migration `…_sign_in.sql` (sign-in state, form states, the domain hook)

| Table | Columns |
|---|---|
| `private.sign_in_attempts` | `key text pk` (HMAC of the cookie token), plus the fields of `SignInAttemptRow` except `code_hash` (Supabase holds the code now), `expires_at` |
| `private.code_sends` | `email text`, `hour timestamptz`, `n int`; pk (`email`, `hour`) |
| `private.allowed_email_domains` | `domain text pk` |
| `public.form_states` | `session_id uuid` (the Auth session), `form text`, `account_id uuid fk on delete cascade`, `errors text[]`, `values jsonb`, `notice text`, `expires_at`; pk (`session_id`, `form`) |

**Functions:**
- `private.reserve_code_send(email, now, limit)` → bool: one upsert, `on conflict do update set n = n + 1 where code_sends.n < limit returning n` (GO-LIVE section 6).
- `private.record_wrong_try(key)` → int: one `update … set wrong_tries = wrong_tries + 1 returning wrong_tries`.
- `private.before_user_created(event jsonb)` → jsonb:
  - **refuses by default**;
  - allows an address whose domain, or a parent domain, is in `allowed_email_domains`;
  - the error message is "Use your Eduvos email address.";
  - `grant execute` to `supabase_auth_admin` only, and revoke it from `public`, `anon` and `authenticated`.

**RLS:** `form_states` is owner-only, by `account_id = (select auth.uid())`. The `private` tables have no grants to `anon` or `authenticated` at all.

**Tests:**
- the hook allows `a@eduvos.com` and `a@students.eduvos.com`;
- it refuses `a@eduvos.com.evil.io`, `a@gmail.com` and an empty table;
- 6 code sends in an hour give 5 trues and then a false, including when run in parallel (two `dblink` sessions, or the test runs both in one statement).

## Task 9: Migration `…_actions.sql` (the atomic writes)

Each function is `security definer`, `set search_path = ''`, and takes identity from `auth.uid()`, never from an argument. It checks ownership, does its work in one transaction, and returns a small result the TypeScript maps to today's results (`'sent' | 'not-found' | 'closed'` and the like). `execute` is granted to `authenticated` only.

**Messaging** (`lib/data/messages.ts`):
- `start_conversation(listing, shop, body, swap_offer)` reuses the open one;
- `send_message(conv, body)` handles the first reply, the status, `last_message_at` and the notification rule;
- `mark_completed(conv)`, `confirm_sale(conv)` and `reject_sale(conv)`;
- `mark_thread_read(conv)`;
- `settle_auto_confirm(now)` is also used by the job.

**Reports:** `create_report(kind, target, title, reason, detail)` enforces one open report per target and 10 in 24 hours.

**Selling** (`lib/data/shops.ts`, `own-listings.ts`):
- `create_shop(…)`, `update_shop(…)` (a campus change moves listings and re-points pickup), `change_shop_slug(slug)` (once, approved only), `set_shop_paused(bool)`;
- `save_listing(…)` (state moves from `own-listings.ts:83`, `first_published_at` once, the pickup point must be the shop's, a pending shop drafts only), `set_listing_state(id, to)`, `delete_listing(id)`;
- `save_onboarding_draft(…)`.

**Account deletion:** `private.forget_account(uid)` holds the messaging and selling rules of spec 4.5. It's called with the admin client, and returns the photo paths so the caller can delete the files.

**Tests:** one pgTAP file per area. They mirror the cases of the matching `lib/data/*.test.ts`: each rule, limit and refusal there has a test here.

## Task 10: Migration `…_storage_and_jobs.sql`

**Storage:**
- The `photos` bucket comes from `config.toml` locally. On staging it's made by this migration, because `config.toml` buckets reach a remote only through `supabase seed buckets`. The insert into `storage.buckets` uses `on conflict do nothing`.
- No policies on `storage.objects` for `anon` or `authenticated`. Only the admin client reads and writes photos.

**Jobs** (`cron.schedule`), times in UTC:
- `settle-sales` hourly;
- `sweep-sign-in` hourly (attempts, code sends, form states);
- `sweep-unfinished-users` daily at 01:00 UTC (03:00 SAST): Auth users with no profile and created more than a day ago;
- `sweep-cron-history` daily.

**Waiting photos** need the Storage API, so they're a Vercel Cron route in phase C. Spec section 7 lists it.

**Tests:** the jobs exist with the right schedules; `settle_auto_confirm` confirms a sale done 7 days and 1 minute ago, and leaves one done 6 days ago alone.

## Task 11: Seed data

- New script `scripts/make-seed.ts` (run with `pnpm db:seed`). It writes `supabase/seed.sql` from `data/fixtures/`:
  - campuses, categories and pickup points;
  - the 29 sample shops and 38 listings, with their ids preserved (the short-id column accepts `l-001`);
  - the five sample accounts as Auth users with fixed uuids and `@eduvos.com` addresses, plus their profiles, consents and seller profiles;
  - the two sample conversations;
  - `allowed_email_domains`: `eduvos.com`.
- `seed.sql` is generated, so it's never edited by hand. A unit test fails if it is out of date with the fixtures.
- **The seed never reaches production.** Staging gets it once, with Lama's go-ahead.

## Task 12: Types and server clients

1. With Lama's go-ahead:
   ```bash
   pnpm add @supabase/supabase-js@2.117.3 @supabase/ssr@0.12.7
   ```
   The plan also added the `supabase` CLI as a dev dependency; that was dropped during the build (see "Changes made during the build").
2. `supabase gen types typescript --local > lib/supabase/database.types.ts`, plus a `pnpm db:types` script.
3. New files, each with `import "server-only"`:
   - `lib/supabase/env.ts`: reads and checks `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and `VOSSIE_BACKEND`. A missing value throws with the variable's name, never its value.
   - `lib/supabase/public.ts`: `publicClient()`, with no cookies, `persistSession: false`, and the publishable key. Safe inside `"use cache"` because it has no request data. It's made inside each call, never kept at module scope.
   - `lib/supabase/viewer.ts`: `viewerClient()`, built with `createServerClient` from the request's cookies, with `cookieOptions: { name: "vossie_auth", httpOnly: true, sameSite: "lax", secure }`. `setAll` applies the headers Supabase passes and swallows the write error in Server Components, as Supabase's guide does.
   - `lib/supabase/auth.ts`: `authClient()`, which is `viewerClient`'s cookies plus the secret key and `Sb-Forwarded-For` from `x-real-ip`. Its exported type exposes `.auth` only, so data calls through it don't compile.
   - `lib/supabase/admin.ts`: `adminClient()`, with the secret key, no session, and no cookies.
4. **Unit tests:**
   - env checking;
   - `authClient`'s type has no `.from` (a type test);
   - no file outside `lib/supabase` and `lib/data` imports `lib/supabase` (an ESLint `no-restricted-imports` rule);
   - none of these files is reachable from a client component (the existing JS-budget test is the backstop).
5. `.env.example` gets the names from spec section 8, commented out, with one line each.
6. **Phase A checks the one thing phase B depends on:** whether `cookieOptions.name` in `@supabase/ssr` 0.12.7 renames the cookie to `vossie_auth`. A short script against local Supabase signs in a seed account and lists the cookies set. If the rename doesn't hold, stop and tell Lama before phase B.

## Task 13: Checks, then staging

1. Locally, in order:
   1. `supabase db reset` (this resets the **local** database only);
   2. `supabase test db`;
   3. `supabase db lint --fail-on error`;
   4. `supabase db advisors --local` reports nothing;
   5. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass unchanged.
2. With Lama's go-ahead, Lama links the worktree (it asks for the database password, so Lama types it):
   ```bash
   supabase link --project-ref <ref>
   ```
3. `supabase db push --dry-run`. Show Lama the list of migrations, then push on Lama's go-ahead.
4. `supabase config push`, so the auth settings, the code template and the hook reach staging. Dry run first if the CLI offers one; otherwise show Lama the diff it prints and confirm.
5. Seed staging once, on Lama's go-ahead.
6. `supabase db advisors --linked` reports nothing on staging.
7. In the dashboard, Lama turns on Auth → Rate Limits → **IP address forwarding**.

## Task 14: Docs

- `docs/PROGRESS.md`: the phase A entry.
- `docs/reference/LANDING-DECISIONS.md`: Lama's four decisions and this plan's, numbered when written. Check first for numbers another session has added.
- `docs/reference/GO-LIVE.md`, section 6:
  - tick the items phase A did;
  - add the POPIA s72 legal check of Supabase's DPA;
  - add who holds production;
  - add the 4.5 MB photo limit;
  - add the Storage backup.
- `CLAUDE.md`: a short **Supabase** section with the commands (`supabase start`, `supabase test db`, `pnpm db:types`, `pnpm db:seed`) and the rules:
  - only `lib/data` and `lib/supabase` touch Supabase;
  - every table has grants, RLS and pgTAP tests;
  - the secret key is for the server only;
  - never `--linked` resets.

## Decisions made in this plan (for Lama to confirm or veto)

1. **Profiles are made by the app on the first sign-in's step 3, not by a trigger on `auth.users`.** An unfinished sign-in then leaves no profile, and the daily job removes its Auth user.
2. **Writes to shops, listings and messaging go through Postgres functions, with no direct `insert` or `update` grants.** Each rule lives in one place, and a missing check can't be bypassed by writing to the table.
3. **Photos are private, served only by `/photos/[id]`.** This works on the Free plan with no image resizing, and a deleted photo is gone at once (spec section 6).
4. **The seed is generated from `data/fixtures/`,** so staging and the sample store show the same shops and listings.
5. **Listing ids stay short text** (`l-001` for the seeds, 10 random characters for new ones), to keep the `vossie_saved` cookie small.

## What phase B needs from this phase

- The `vossie_auth` cookie rename confirmed (Task 12, step 6).
- An email service and domain (spec open decision 1). Until then staging can't send sign-in codes: the built-in mailer reaches only the project's team, and on the Free plan it can't use Vossie's code template. Local sign-in uses Mailpit meanwhile.
- Vercel's function region set to Dublin (`dub1`), in the project's settings, before staging is wired to a deployment.

## Changes made during the build (2026-10-15)

**Tasks 2 to 8:**
- pgTAP isn't installed by a migration. `supabase test db` installs it for the run, so it never reaches staging.
- `conversations.shop_id` is set to null when a shop goes, not deleted with it: the buyer keeps their side (messaging decision 14, spec 4.5).
- The "one question per shop" index keys on `listing_title is null`. Otherwise deleting a listing would clash with the buyer's open question to that shop.
- `shops.owner_id` cascades on delete. An ownerless shop counts as approved, so a pending shop must never lose its owner and become public.
- `shops.image_placeholder` and `image_alt`, and `listing_photos.placeholder_src`, hold the fixtures' placeholder art for the seed.
- `shops.owner_id` isn't readable through the API (column grants), so API reads list their columns.
- More `check`s than listed (swap-only means no price, "from" only on services, notification links stay on Vossie, bounded form states). All 38 fixture listings and the fixture shops pass them.
- `name_key` mirrors `nameKey` exactly, without `unaccent`, which would differ on ß. It's tested on 28 inputs printed from the TypeScript.
- Policies call `private` helpers by EXECUTE grant alone. `anon` and `authenticated` have no USAGE on `private`.
- The code-send limit counts fixed UTC hours (sample mode counted a sliding hour). Up to 10 codes can go out across an hour boundary; Supabase's own 60-second limit per address still applies.

**Tasks 9 to 12:**
- Functions the app calls live in `public`, not `private` (which isn't exposed). User actions are granted to `authenticated` and `service_role`; server-only ones (`forget_account`, `settle_auto_confirm`, and wrappers for `reserve_code_send` and `record_wrong_try`) to `service_role` only. `anon` can run none: a test checks the whole schema.
- Added functions the plan didn't list:
  - `complete_profile` (sign-in step 3, one account per email, consent once per version);
  - `add_photos` (the newest-12 and one-day rules, atomically);
  - `settle_sales` (a page settles the viewer's own due sales);
  - `mark_notifications_read`.
- `update_shop` takes the new link too, so Edit shop saves all or nothing.
- The onboarding draft's text limits are 4,000 characters: the wizard keeps what was typed after an error.
- Starting a conversation needs the buyer to have a profile.
- **The `supabase` npm package isn't added.** pnpm 10 blocks its install script. The Homebrew CLI (2.118 or later) is used.
- `server-only` is added as a package, so Vitest can load the client files.
- The seed has 30 shops: the 29 sample sellers plus the pending Crochet corner, as in the fixtures.
- `app/privacy/page.test.tsx` lets `vossie_auth` go unnamed while nothing outside `lib/supabase` imports it. A second test enforces that condition, so the exception ends the moment phase B wires sign-in in.

**Found for phase B:**
- `createServerClient` always uses PKCE. Calling `signInWithOtp` through it sets three `vossie_auth-…-code-verifier` cookies that last 400 days. Send the code from a cookieless supabase-js client using the implicit flow, and use the cookie client only for `verifyOtp`; then only `vossie_auth` is set (checked locally).
- The `vossie_auth` rename holds: one cookie of about 2.4 KB, httpOnly, Lax, path `/`.
- `setAll`'s no-store headers can't be set from Server Functions, so `proxy.ts` must set them. The cookie's default lifetime is 400 days; the 30-day session comes from Supabase's session settings.
- Every function that returns `removed_paths` leaves the files for the caller to delete from Storage (phase C), and the waiting-photo file sweep is a Vercel Cron route (phase C).

**Review fixes (2026-10-15):**
- **C1, password sign-in.** `enable_confirmations` and `secure_password_change` are now on in `config.toml`, so `POST /auth/v1/signup` with a password returns no session. A new **custom access token hook**, `private.custom_access_token`, runs before every token, at sign-in and at each refresh. It refuses a token (403) unless the method is `otp` or `token_refresh` and every `amr` entry is `otp`, and unless the address is still in an allowed domain. The domain rule is now one function, `private.email_allowed`, shared with `before_user_created`. Only `supabase_auth_admin` can run either hook.
  - **Checked on the local stack:**
    - a code sign-in is method `otp` for a new address and for an existing one, and so is confirming an email change;
    - a refresh is `token_refresh`, and keeps the original `amr`;
    - a password sign-in is `password`.
  - **End-to-end results:**
    - a password sign-up gets no session, and its password sign-in gets none either;
    - a new address and a seed address each get a code (both with the code template) and a session;
    - an OTP session refreshes;
    - a password added with `PUT /auth/v1/user` gets no token, and the OTP session still refreshes;
    - an email change to `@gmail.com` is undone: the hook refuses the token at its final step, and Auth rolls the change back;
    - an account whose address is already gmail (as an admin edit could leave it) gets no refresh and no code sign-in.
- **I1, seed addresses.** The five seed accounts are `student@`, `seller@`, `pending@`, `mentor@` and `admin@vossie.test`, mapped by `seedEmail` in `scripts/seed-sql.ts`. The fixtures are unchanged. The seed allows `eduvos.com` and `vossie.test`, for local and staging testing.
  - **Production gets its allowed domains from an ops step, never from the seed, and must never allow `vossie.test`.**
  - Phase B sets `VOSSIE_EMAIL_DOMAINS` locally so the app's own check accepts the test domain.
- **I2, paused shops.** `start_conversation` returns `closed` for a listing in a paused shop, as the app shows it as paused. A question to a paused shop is still allowed, as in `composerSubject`.
- **I3, text backstops.**
  - **Text checks.** `private.is_clean_text` and `is_clean_line` are check constraints on:
    - messages and swap offers;
    - listing titles, descriptions and swap wishes;
    - shop names, taglines and abouts;
    - report details and titles;
    - a conversation's copy of a title.
  - **What they refuse:** the control, zero-width and direction-changing characters that `cleanText` drops, plus line breaks and tabs in one-line fields. Multi-line fields keep their line breaks.
  - **First names.** `private.is_first_name` holds `checkFirstName`'s rules and is the `profiles.first_name` check.
  - **Writes through functions only.** The API roles lose `update` on profiles and `insert` on consents. New user actions take their place: `update_profile(first_name, campus)` and `record_consent(version)`. `record_consent` is for `finishSignIn`'s consent at every sign-in, and a consent is always agreed now.
  - **Policy versions** must be in `private.policy_versions`, which is seeded with `2026-10-draft` by migration. `consents.version` references it.
- **M1, the sign-in client.** `authClient()` returns only `sendSignInCode`, `verifySignInCode` and `signOutHere`, with no `.auth`, `.admin` or `.from`.
  - The code is sent from a cookieless client on the implicit flow, so no code-verifier cookie is set.
  - Verifying and signing out (`scope: "local"`) go through the cookie client.
  - All three use the secret key and `Sb-Forwarded-For`.
- **M2, request reports.** A request report's id must have the id shape, at most 20 characters, or the result is `not-found`. Its title must be one clean line of 1 to 70 characters, or it raises. `reports.target_id` and `target_title` have matching checks.
- **M3, form states.** The policy also requires `session_id` to match the JWT's `session_id`, so two browsers on the same account don't share form states.
- **M4, account deletion.** `forget_account` deletes the profile last. A still-open session then gets a 403 from the actions that make rows, and `not-found`, `not-allowed`, `no-shop`, false or 0 from the rest. Each case is tested.
- **M5, unfinished users.** The sweep removes an Auth user without a profile only when `greatest(created_at, last_sign_in_at, confirmation_sent_at, recovery_sent_at)` is more than a day old.
- **M6, privacy test.** The importer check resolves `@/` and relative paths into `lib/supabase`, and catches `@supabase/*` packages. It also scans the root files, so `proxy.ts` will count. No code sets a `vossie_auth-…-code-verifier` cookie any more, so it needs no entry.
- **M7, the buyer's id.** `conversations.buyer_id` isn't granted to `authenticated`. The new `public.my_conversations` view (`security_invoker`) lists the reader's conversations with a `viewer_side` column. A computed column couldn't do this: it passes the whole row, and reading a whole row needs every column.
- **M8, photo claims.** `save_listing` locks the photos it names before checking them. It also catches a clash on `listing_photos_photo_id_key` and returns `photos-invalid`.
- **Tests.**
  - pgTAP: 803 in 13 files. The new file is `12_text_checks`; the cases are added to 02 and 05 to 11.
  - Unit: 1,455.
  - `db lint` and `db advisors` report nothing.
