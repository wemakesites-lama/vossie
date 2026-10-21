# Supabase phases B and C: programme plan

- **Spec:** `docs/superpowers/specs/2026-10-15-supabase-backend-design.md` (sections 3 to 8). Phase A's plan: `docs/superpowers/plans/2026-10-15-supabase-foundation.md`.
- **Goal:** the app runs on Supabase behind `VOSSIE_BACKEND=supabase` with every screen and test as built in sample mode (stages D to J, and K once it lands), and every migration applied locally and on staging.
- **Status:** draft, 2026-10-20. Lama's decisions (2026-10-20):
  1. **Merge phase A into main** (not main into the branch), then build B and C in a fresh worktree off current main.
  2. **Order:** schema catch-up and phase C first; **phase B after stage K lands**, because stage K rewrites the same sign-in files (`lib/auth/*`) into Route Handlers.
  3. **Email (spec open decision 1) is deferred.** Phase B is built and tested locally with Mailpit; staging sign-in waits for a domain and a provider.
- **This file** sets the order and the way of working. Each step gets its own detailed task plan (test first, like phase A's) when it starts, written to `docs/superpowers/plans/` and reviewed before any code.

## Safety (from CLAUDE.md, highest priority)

- One build controller per tree. Main's controller (stage K) and this programme never commit at the same time: each git write waits for a "go" from the other session and ends with "done".
- Implementers don't run `git add` or `git commit`; the controller checks and commits, staging files by path.
- Every command that changes **staging** (`db push`, `config push`, seeding) is shown to Lama with `--dry-run` first and runs only on Lama's go-ahead for that run. Never `supabase db reset --linked`.
- Tokens and passwords never pass through chat. Lama runs `supabase login` in their own terminal with a token scoped to "Vossie Market".
- Never kill `supabase start`, `pnpm install`, a build or a migration mid-run. Stop only servers this session started, by PID or port.

## Where things stand (2026-10-20)

- Phase A: branch `backend/supabase-foundation` (worktree `../Vossie-supabase`, clean, `d104b3f`): 8 migrations, 803 pgTAP tests, seed, `lib/supabase/` clients imported by nothing. It forked from main at `eed0bc3`, **122 commits ago**: its schema covers stages D to F only.
- **Stages G to J have no schema.** The spec's phase D ("each stage adds its own migration") didn't happen; those stages were built on main in sample mode. Missing: audit log, featured pins and draws, mentor notes, Hub posts, RSVPs and bookings, Looking For requests, follows, saved searches, previous shop links, and new columns on shops, listings, reports, conversations, notifications and form states.
- Staging: the CLI's login is refused (403 on `migration list --linked`). The phase A token has been revoked or lost its rights, so what staging has applied is unconfirmed until Lama logs in again.

## Steps

### Step 1: Merge phase A into main
1. Wait for main's controller to say "go"; confirm `git status` on both trees.
2. The untracked copies of the Supabase spec and plan on main block the merge (the branch has them tracked; the plan's branch copy is newer). With Lama's OK, move main's untracked copies to the scratchpad, not delete them.
3. `git merge --no-ff backend/supabase-foundation`. Expected conflicts: `package.json`, `pnpm-lock.yaml`, `eslint.config.mjs`, `.env.example`, `app/privacy/page.test.tsx`. Resolve by keeping both sides; regenerate the lockfile with `pnpm install`, never hand-edit it.
4. Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit). No e2e needed: no page changes.
5. Commit the merge (Lama's go-ahead), tell main's controller "done". The worktree and branch stay until Lama says to remove them.

### Step 2: Schema catch-up for stages G to J (and K's limit)
New migrations after phase A's, each test first with pgTAP, each matching the TypeScript rules (`lib/*/rules.ts`) and the stage specs:

| Migration | Contents |
|---|---|
| `…_staff.sql` (G) | shop columns: `declined_at`, `paused_by`, `seller_paused_too`, `staff_reason`, `mentor_id`, `approved_at`; `shop_previous_slugs` (reserved forever); listing `hidden_at`, `hidden_reason`; report `outcome`, `note`, `closed_at`, `closed_by`, `target_gone`; `audit_log` (insert only, no update or delete grants); `featured_pins`, `featured_draws`; `mentor_notes` (staff only, never the seller); `hub_posts`, `hub_rsvps`, `hub_bookings`; form state `taken`; RLS via `private.is_staff(area)` |
| `…_community.sql` (H) | `requests` (asker never exposed), `follows` (a shop sees only its count), conversation `request_id`, `request_title`; notification `count` and new kinds; request and offer limits as functions |
| `…_alerts.sql` (I) | `saved_searches` (owner only, 20 an account, same words in any order are one search); `notify_once_per_day` as a function |
| `…_staff_accounts.sql` (J) | give and remove a role by exact email, the last-admin rule in the database, the role re-checked inside the transaction; Show again; the numbers as a function returning raw weekly counts (`protectCounts` stays in TypeScript, saved searches never counted) |
| `…_actions_g_to_j.sql` | the atomic writes each stage's Server Actions need (spec 4.4), with one `audit_log` row only when something changed; `forget_account` extended: requests, follows, saved searches and their notifications, notes about the account, the account stripped from the audit log |
| `…_message_limit.sql` (K) | the per-account message limit inside `start_conversation` and `send_message`, behind `pg_advisory_xact_lock` on the sender (stage K spec item 11) |

Also: the seed generator (`scripts/seed-sql.ts`) gains the 18 Hub posts, the 16 sample requests and the staff fixtures; `database.types.ts` is regenerated; advisors report nothing.

Step 2b (stages L and M, reference rows, domains, public read views): `2026-10-21-supabase-step-2b-and-phase-c-foundation.md`, Part 1.

**Check:** `supabase db reset` then `supabase test db` pass locally; the advisors are clean. **Staging checkpoint 1:** `supabase db push --dry-run` shown to Lama, then pushed on their go-ahead; `migration list --linked` shows local and remote equal.

### Step 3: Phase C, the data layer
- **C0, plumbing:** `VOSSIE_BACKEND` read in one place; each `lib/data` module keeps its exported signatures and picks its sample or Supabase version; a shared contract-test suite runs against the sample store (`pnpm test`) and a local Supabase (`pnpm test:db`, needs `supabase start`). Cache tags stay as they are; public reads use the cookieless public client inside `"use cache"`.
- **C1, public reads:** campuses, categories, pickup points, `catalog.ts` (listings, shops), badges, featured, Hub posts, requests (public view), shop stats.
- C0 and C1 are built by `2026-10-21-supabase-step-2b-and-phase-c-foundation.md`, Part 2 (Tasks 12 to 20). Campuses and categories stay the code's fixtures in both backends (its decision 14).
- **C2, selling:** shops, own listings, onboarding drafts, photos (Storage, `/photos/[id]`, and the Vercel Cron sweep for waiting photos and `hub-draft` covers). `/photos/[id]` reads with the admin client, so it must itself refuse a hidden listing's photos, `hub-draft` photos and covers of unpublished Hub posts (step 2 reviews). A taken, unexpired one-time token can't be deleted with the user's session (Task 5 trigger), so clean-ups like sign-out use the admin client or the session cascade. The owner's list of old links needs a function (`shop_previous_slugs` has no API read).
- **C3, messaging:** conversations, messages, reports, notifications, offers.
- **C4, community and alerts:** requests (writes), follows, saved searches, alert matching (still through browse's `listingMatches`; a database job later, go-live list).
- **C5, staff:** audit, staff shops, staff reports, mentors, Hub management, staff accounts, numbers, Show again, staff privacy.

**Stage K's files (its plan, `docs/superpowers/plans/2026-10-20-hardening.md`, `dcbf95f`): phase C leaves these alone until K lands.** `lib/data/messages.ts`, `tags.ts` and `store.ts`; `lib/auth/*`; `lib/messaging/{rules,errors,actions,limits}.ts`; `lib/looking-for/actions.ts`; `app/login/*`, `app/logout/`; `components/auth/SignIn*.tsx`, `components/menu/MenuAccount.tsx`, `components/account/AccountView.tsx`; the how-it-works, trust, safety and privacy pages; `tests/helpers/next-request.ts`, `vitest.setup.ts`, `.env.example`, `playwright.config.ts`, `tests/e2e/info.spec.ts`; `CLAUDE.md` and `GO-LIVE.md`. So C3 (messaging) waits for K, and C0's switch must not need `store.ts` or `tags.ts` changed before then. Main's controller says when K's Route Handler sign-in is committed, which starts phase B.
- **2026-10-20:** K's Route Handler sign-in is on main (`fa71050`, sign-out `33acfcb`): `app/login/{code,profile,sample}/route.ts`, `app/logout/route.ts`, `lib/auth/same-origin.ts`, `lib/auth/sign-in-finish.ts` (`finishCode`, `finishProfile`, `finishSample`), `lib/auth/post-paths.ts`. Step 1, resend and cancel stay Server Actions. **Phase B still waits for K's HMAC change** (`lib/auth/secrets.ts`, `STORE_VERSION` 10), which touches `lib/auth` too; main's controller will say when it lands. Phase B also comes after step 2 here.

Modules that need a signed-in viewer are contract-tested with users created through the admin client on the local stack. The app as a whole runs on Supabase only after phase B (step 4). Until then sample mode stays the default everywhere, Vercel included.

### Step 4: Phase B, sign-in (after stage K lands)
As spec section 5 and phase A's "Found for phase B", on top of stage K's Route Handlers and `VOSSIE_AUTH_HMAC_KEY`: the code sent from a cookieless implicit-flow client, `verifyOtp` on the cookie client, the `vossie_auth` cookie, `proxy.ts` renewing sessions and setting no-store, `getViewer()` via `getClaims()`, account deletion via `forget_account` then the Auth admin delete, the privacy page naming `vossie_auth`, Supabase and Ireland. Built and tested locally with Mailpit.

**Stage K is in (2026-10-20):**
- The Route Handler sign-in is `fa71050`, sign-out `33acfcb`, and the keyed hashes `534af03`.
- `authKey()` in `lib/auth/secrets.ts` reads `VOSSIE_AUTH_HMAC_KEY` on first use: at least 32 characters, and a fixed development key only in sample mode.
- HMAC-SHA-256 hashes codes, session tokens and attempt tokens, with `token:` and `code:` purpose prefixes.
- `getSessionKey()` and `currentAttempt()` return null with sample mode off.

- **Account deletion is a Route Handler** (`5aae6b0`, K's last code change): `app/account/privacy/delete/route.ts`. It checks the post is same-origin, then requires sign-in, then the confirmation; then it deletes, ends the session, sets the flash and answers 303 to `/`.
  - `DELETE_ACCOUNT_PATH` is in `lib/auth/post-paths.ts`.
  - `hubChangedNow()` and `requestsChangedNow()` are in `lib/data/tags.ts`.
  - Phase B's deletion (`forget_account`, then the Auth admin delete) goes in there.

Phase B must also meet stage K's plan amendment 7:
- **The development key is refused on Supabase.** Whenever `VOSSIE_BACKEND=supabase`, `authKey()` refuses it and `isSampleAccount()` is false, whatever `VOSSIE_SAMPLE_MODE` says (`isSampleMode()` defaults to on).
- **Postgres uses the same prefixes.** Any HMAC that Postgres computes uses the same purpose prefixes.

Account deletion calls `forget_account` with the admin client, then deletes the Auth user, and retries once if Postgres aborts the transaction on a deadlock (step 2, Task 8). Phase B's base is main at or after `534af03`. Before it starts, bring main into `backend/phases-b-c` (a merge on the branch, with Lama's go-ahead), or start phase B on a fresh branch from main once step 2 has merged.

### Step 5: Whole-app check on Supabase
The full e2e suite against the local stack with `VOSSIE_BACKEND=supabase`, then **staging checkpoint 2** (any new migrations). Staging sign-in stays off until email is chosen.

## Way of working

- **Controller:** this session, in a fresh worktree off main after step 1 (for example `../Vossie-backend`, branch `backend/phases-b-c`), merged into main step by step with Lama's go-ahead and a quiet window from main's controller.
- **Per step:** a detailed task plan, reviewed before code; implementers by task (test first); one combined reviewer per step (plan, then quality), time-boxed to about 25 minutes; the controller commits.
- **Every task:** `supabase db reset` and `supabase test db` for SQL; `pnpm lint`, `pnpm typecheck` and `pnpm test` for TypeScript. The JS budget can't move (Supabase is server-only), and the performance test confirms it at each merge.
- **Progress:** a section in `docs/PROGRESS.md` at the end of each session, and changes recorded in this file's "Changes made during the build".

## For Lama

1. Log the CLI in to staging from your own terminal with a new token scoped to "Vossie Market" (the phase A token expires 2026-10-22, so revoke it if it isn't already).
2. Confirm or veto the spec's open decisions 3 (whose account holds production), 4 (the sliding 30-day session) and 5 (retention), which phase B and launch need.
3. Upgrade the CLI from 2.118.0 to 2.121 (`brew upgrade supabase`) when convenient.

## Changes made during the build

**Step 1 (done 2026-10-20, `84f61a1`):**
- Merged in main's quiet window, with Lama's go-ahead. No conflicts; `pnpm install --frozen-lockfile` added only phase A's packages.
- Main's untracked copies of the spec and phase A plan were moved to this session's scratchpad (`main-untracked-backup/`), not deleted; the branch's tracked copies replace them (the spec was identical, the plan older).
- The privacy test's source walk hit `app/sw.js`, a route folder main gained after phase A forked (EISDIR). It now skips anything that isn't a file.
- Checks: lint and types clean; 2,468 unit tests pass. Local stack: all 8 migrations applied, `supabase test db` 803 pass. Staging unchecked (CLI login refused).

**Step 3, C0 and C1 (built 2026-10-21; the step 2b and phase C foundation plan, Tasks 12 to 20):**
- `VOSSIE_BACKEND` is read only by `lib/backend.ts` (`backend()`, `onSupabase()`). Switched to a Supabase twin in `lib/data/supabase/`: pickup points, the catalog (listings and shops, over a cached snapshot tagged `listings` and `sellers`), Hub posts, requests (public reads and the settle), Featured's `featuredFor`, `shopStats`, `recentCounts` and `recalculateBadges`. Still sample until their stage: the pins and `featuredChoices` (C5), `recalculateBadgeFor` (messaging, C3), the asker's request reads and every write (C2 to C5).
- Contract tests: `lib/data/contract/*.test.ts` on the sample store (`pnpm test`) and `*.db.test.ts` on the local stack (`pnpm test:db`, after `supabase db reset`), with parity checks against the seed.
- The JS budget is unchanged to the byte (sample build), no chunk names Supabase, and a build with `VOSSIE_BACKEND=supabase` against the local stack builds the same routes with only the URL and publishable key (no secret key at build time).
- Detail in that plan's "Changes made during the build".

**Step 4, phase B (built 2026-10-21; `2026-10-21-supabase-phase-b-sign-in.md`, Tasks 0 to 12; Task 13 is the runbook):**
- With `VOSSIE_BACKEND=supabase`, a student signs in with the 6-digit code Supabase Auth emails; the session lives in `vossie_auth` for a sliding 30 days (the cookie's lifetime from its last renewal, and `private.sweep_idle_sessions()`); `getViewer()` reads the verified claims and the profile every request; sign-out, the data download and account deletion work on Supabase. Sample mode is unchanged and off on Supabase.
- `proxy.ts` is the only place a session is refreshed, and runs only for requests carrying `vossie_auth` (or `vossie_auth.0`); Task 6's spike found Supabase's no-store headers survive on prerendered pages.
- The privacy page names `vossie_auth`, Supabase (Ireland), Vercel (Dublin) and Resend (United States); its cookie guard is whole again.
- `stats.db.test.ts` no longer depends on the hourly `settle-sales` job.
- Checks: unit 2,933; db 60; pgTAP 2,337; `pnpm e2e:supabase` 23 passed; the sample sign-in, accounts and performance specs at 390 and 1440 pass. Detail in that plan's "Changes made during the build".

**Step 3, C2 and C3 (built 2026-10-21; `2026-10-21-supabase-phase-c2-c3-selling-messaging.md`, Tasks 0 to 17):**
- C2: the owner's shop and the wizard's draft, own listings, photos in Storage behind `/photos/[id]` (`photo_file` decides who sees each), and a daily Vercel Cron sweep at `/api/cron/photos` behind `CRON_SECRET`. Photos are 4 MB each and 4 MiB a post (Lama's go-ahead).
- C3: notifications' reads (every notification is written inside a database function; the TypeScript writers throw on Supabase), students' reports, conversations and messages with the 7-day auto-confirm on read and a header count that writes nothing, the message limits counted again by the database under the sender's lock (a race refusal shows the same form error), `startOffer`, and the context strip's numbers (`getAccountActivity`). The rest of offers is C4's.
- Still sample until their stage: `recalculateBadgeFor` (a reply's or a sale's badge; on Supabase the badges move only when an admin opens `/admin`), and everything C4 and C5 own.
- Checks: pgTAP 2,489; unit 3,055; db 168; the JS budget unchanged. Detail in that plan's ledger and "Changes made during the build".

