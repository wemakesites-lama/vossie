# Supabase step 2b (stages L and M, and what production needs) and phase C's foundation (C0, C1): build plan

- **Programme:** `docs/superpowers/plans/2026-10-20-supabase-phases-b-c.md`, steps 2 and 3. **Spec:** `docs/superpowers/specs/2026-10-15-supabase-backend-design.md` (sections 3 to 8, and the amendments in 12). **Stage specs:** `docs/superpowers/specs/2026-10-20-housekeeping-design.md` (stage L) and `docs/superpowers/specs/2026-10-21-follow-ups-design.md` (stage M), with their plans `docs/superpowers/plans/2026-10-20-housekeeping.md` and `2026-10-21-follow-ups.md`; `docs/reference/GO-LIVE.md` section 6 (Backend).
- **Format:** as the step 2 plan (`2026-10-20-supabase-schema-catch-up.md`): test first, one writer per file, the controller commits.
- **Status:** draft for review, 2026-10-21. Nothing is built.

## Goal

**Part 1, step 2b.** Stages L and M were built in sample mode after the schema catch-up, so the database is missing them. After this part:
- requests close themselves by the same rule as `closingDay` (a stored column), and a settle function and a nightly job close them, remind once and tell the asker once;
- reports remember who owned their target, and no admin can act on their own shop, its listings or their own request in any staff function;
- `remove_role` refuses to take the mentor role from whoever mentors the acting admin's own shop;
- production gets its reference rows (campuses, categories, pickup points) and its allowed sign-in domains (`eduvos.com`, `vossie.net`) from migrations, and the seed keeps only sample content;
- three read-only views give phase C's public reads what the anon role can't otherwise see.

**Part 2, phase C's foundation (C0) and public reads (C1).** After this part:
- `VOSSIE_BACKEND` is read in one place;
- every `lib/data` module keeps its exported signatures and can switch to a Supabase twin;
- one contract-test approach runs the same tests against the sample store (`pnpm test`) and the local stack (`pnpm test:db`);
- the public reads (pickup points, the catalog, Hub posts, requests, Featured, shop stats and badges, the sitemap's readers) work on Supabase, with the cache tags as they are and no byte of client JavaScript added.

**Not in this plan:** phase B (sign-in: `lib/auth/*`, `lib/data/accounts.ts`, `sessions.ts`, `sign-in.ts`, `form-states.ts`, `viewer.ts`), C2 to C5 (writes, messaging, community writes, staff), and running the app as a whole on Supabase (step 5). Until step 5, `VOSSIE_BACKEND=supabase` is for the contract tests only: modules not yet switched still read the sample store.

## Where and safety (from CLAUDE.md, highest priority)

- **Worktree:** `/Users/LamaNkuna/Projects/Vossie-backend`, branch `backend/phases-b-c`, level with main at `04aa943` when this was written. Main's tree (`/Users/LamaNkuna/Projects/Vossie`) is never edited from here.
- **Git:** implementers never `git add` or `git commit`. The controller checks each task, stages files by path and commits with Lama's go-ahead. One git command per tool call. No merge of main into the branch without Lama's go-ahead.
- **The local stack** (`supabase_*_vossie`, ports 5532x) is shared by every Vossie checkout. `supabase db reset` (local only) wipes local data, which is fine here. **Never `--linked`**, except in Task 11 with Lama's go-ahead for that run. Leave other projects' containers alone. Never stop or kill `supabase start`, `pnpm install`, a build or a migration mid-run; stop only servers this session started, by PID or port.
- **Tokens and passwords** never pass through chat or a file in the repo. The local stack's keys come from `supabase status -o json` at test time and are never written down.
- **Main's sessions:** stages A to M are built; the header session owns `app/globals.css`, `components/header/*`, `components/tabbar/*` and three e2e specs. Nothing here touches them. `docs/PROGRESS.md`, `CLAUDE.md` and `GO-LIVE.md` are written on main at merge time (as step 2 did), because main has other sessions' uncommitted lines in them.

## Recheck before starting

Run each as its own command and compare. If anything differs, stop and tell the controller.

1. `git status` in the worktree: clean, on `backend/phases-b-c`. `git log --oneline -1`: `04aa943` or a later commit of this programme.
2. `git log --oneline 04aa943..main -- lib/data lib/looking-for lib/staff lib/auth supabase scripts` (main's tree, read-only): empty. If main changed any of these, the controller asks Lama before merging main into the branch, and every "copy the latest version" step below is re-read.
3. `supabase status`: the stack is up (API 55321, DB 55322, Mailpit 55324). `supabase db reset`, then `supabase test db`: **1,976** pgTAP tests pass (the step 2 ledger), 20 migrations applied.
4. `pnpm test`: the unit count matches stage M's (**2,701**), all passing. `pnpm lint` and `pnpm typecheck` clean.
5. `lib/data/store.ts`: `STORE_VERSION = 14`. Nothing in this plan changes the store's shape.
6. The latest definition of each function this plan replaces (the file is the base to copy, never an earlier one):

   | Function or view | Latest definition |
   |---|---|
   | `public.save_request`, `public.set_request_open` | `20261020120500_community_actions.sql:245`, `:314` |
   | `public.start_offer`, `public.create_report` | `20261020120700_message_limits.sql:258`, `:350` |
   | `public.approve_shop`, `decline_shop`, `set_shop_verified`, `staff_pause_shop`, `staff_resume_shop`, `dismiss_report`, `show_listing`, `show_request` | `20261020120300_staff_shop_actions.sql:309`, `:343`, `:400`, `:440`, `:481`, `:565`, `:675`, `:710` |
   | `public.set_shop_mentor` | `20261020121100_audit_related_account.sql:55` |
   | `public.pin_shop`, `unpin_shop`, `remove_role`, `hide_listing`, `hide_request` | `20261020120400_staff_tools_actions.sql:333`, `:388`, `:918`, `:984`, `:1030` |
   | `public.my_requests` (view) | `20261020120200_community_tables.sql:329` |
   | `public.staff_reports` (view over `private.staff_reports()`) | `20261020120100_staff_tables.sql:388` |

   Check with `grep -n "function public.<name>\|view public.<name>" supabase/migrations/*.sql`: the last match must be the one listed.
7. `supabase status -o env | cut -d= -f1` lists `API_URL`, `PUBLISHABLE_KEY` and `SECRET_KEY` (CLI 2.118; the test setup reads them).

---

## Decisions made in this plan (for Lama to confirm or veto)

**Step 2b**

1. **The closing day is a stored generated column, `requests.closes_on`,** from an immutable `private.request_closing_day(asker_id, needed_by, updated_at)`: null without an asker (a sample), `needed_by + 4` (`NEEDED_BY_GRACE_DAYS` 3, plus 1), else the SAST date of `updated_at` plus 30 (`IDLE_CLOSE_DAYS`). The board's query, the settle, the job and the functions all read it, so there is one rule (GO-LIVE's "generated column or a view"). anon reads it: the asker stays hidden, because anon never needs `asker_id` to know whether a request closes.
2. **`public.settle_requests(p_now)` is server-only** (`service_role`). The app calls it with the admin client from request-time code, where `settleRequests(now)` runs today; pg_cron calls it nightly at 00:05 SAST (22:05 UTC). `p_now` is capped at `now()`, so no caller can close requests early. A transaction-level advisory lock serialises settles, and each `UPDATE … RETURNING` re-checks its rows, so two looks close, remind and tell once. It returns how many it closed, as the app's does.
3. **The functions treat a due request that hasn't been settled yet as closed**, which is what the app sees after its own settle: `save_request` won't edit it (`not-open`) and leaves it out of the 5 open; `set_request_open` won't close it by hand (`nothing`) and leaves it out of the reopen count; `start_offer` answers `closed`.
4. **`set_request_open` keeps its text result and gains `reopened-date-cleared`**, for the app's `neededByCleared` notice. Reopening clears a `needed_by` before today (SAST), sets `closed_by` and `closed_at` null and `updated_at` now; closing sets `closed_by = 'asker'`. Nothing clears `reminded_for`.
5. **Column grants:** `closes_on` to anon and authenticated; `closed_by` to authenticated only (for `my_requests`; it says "closed automatically", about the request, never who); `reminded_for` and `reports.target_owner_id` to no API role.
6. **`reports.target_owner_id` is cleared by its foreign key** (`on delete set null`) when the account is deleted. `forget_account` deletes the profile last, so the key clears it there; it isn't replaced again. A pgTAP case proves it.
7. **The own-target gate:**
   - results `own-shop` (a shop or a listing of it) and `own-request`, as the app's notices;
   - checked after `is_staff` and before the reason is checked or anything is read for writing;
   - "own" means owned now, read in the function: `shops.owner_id = auth.uid()` (a new `private.is_own_shop`, which mirrors `isOwnShop`; phase A's `owns_shop` reads `seller_profiles.shop_id`), `requests.asker_id = auth.uid()`, and for reports `private.report_own_kind`, which falls back to `target_owner_id` once the target has gone, as `staff-reports.ts:93` does;
   - owners and askers never change, so the gate takes no new lock and adds no deadlock.
8. **`remove_role`'s own-shop-mentor read keeps the lock order.** After it locks the target's profile, it reads the acting admin's seller profile `for share`. That is the same order as `set_shop_mentor` (mentor's profile, then the seller profile), so the two can't deadlock. The check comes after "no such role" and before any write, as `removeRole` does.
9. **Featured's resting order stays in TypeScript.** The draw is chosen in `drawFeatured` on the first view of the day (step 2 decision 5), and `featured_draws.shop_ids` already keeps each day's row in order. On Supabase, `featuredFor` builds the same map of last days from the campus's last 6 draws (admin client). No SQL change.
10. **Reference rows come from a migration, generated from the fixtures.** Campuses, categories and the 24 pickup points (with the same fixed ids the seed uses, `seedUuid('pickup-point', id)`) are inserted `on conflict do nothing`, so staging, which has them from its seed, is unchanged. `scripts/reference-sql.ts` writes the SQL, and a test fails if the migration and the fixtures disagree. The seed loses those rows.
11. **Allowed sign-in domains from a migration:** `eduvos.com` and `vossie.net` (Lama, 2026-10-21), `on conflict do nothing`. **Exact domains only, no subdomains** (controller, 2026-10-21; amendment 2): `private.email_allowed` and the app's `checkEmail` both drop their subdomain rule; no pattern on the part before the @. The seed keeps only `vossie.test`, so production never allows it.
12. **The app's default list matches:** `emailDomains()` (`lib/auth/config.ts`) defaults to `["eduvos.com", "vossie.net"]`, exported as `DEFAULT_EMAIL_DOMAINS`, which the migration's generator reads. It's a one-line change in phase B's area, made now so the two lists can't drift. Production needn't set `VOSSIE_EMAIL_DOMAINS`.
13. **Three read-only views for public reads,** each `security_invoker`, so the tables' policies still apply:
    - `public.storefronts (shop_id, slug, status)`: a public shop's `approved` or `paused`. anon can't read `seller_profiles`, so today it can't tell an open shop from one its seller paused, which `liveSellerRows` and `toListing`'s "paused" need. The status comes from `private.storefront_status`, a security definer helper granted to anon (the grants test's allowlist grows by one);
    - `public.request_cards`: the public request columns with `closes_on` and `offers` (`request_offer_count`);
    - `public.hub_cards`: published posts with `going_now` (`hub_going`).

    One query per page of rows instead of one call per row.

**Phase C (C0, C1)**

14. **Campuses and categories stay read from the code fixtures in both backends.** They ship with a release, the app's types and cookies depend on their slugs, and Task 1's test keeps the database rows equal to the fixtures. A new campus is a code change plus a migration. `getCampuses` and `getCategories` don't change. Pickup points come from the database, because staff edit them.
15. **The switch pattern keeps diffs small and sample tests untouched:**
    - each `lib/data/<module>.ts` keeps its code and exports;
    - its Supabase twin is `lib/data/supabase/<module>.ts`, typed `typeof Sample.<fn>` against the sample module, so the signatures can't drift;
    - the module loads it with a dynamic `import()` behind `onSupabase()`, one line at the top of each switched function;
    - sample mode never loads Supabase code: no `server-only` in `pnpm test`, no new client in sample builds' code paths.

    Considered and not chosen:
    - moving every module into `lib/data/sample/` (huge diffs and churned blame on files other sessions read);
    - static imports (they need `server-only` stubbed for every unit test, and load supabase-js into every sample test file).
16. **`backend()` moves to a plain module, `lib/backend.ts`.** `lib/supabase/env.ts` imports `server-only`, which throws in a unit test and must never reach `lib/data`'s sample path. `env.ts` re-exports it, so `env.test.ts` is unchanged. Phase B's `authKey()` reads the same function.
17. **The catalog's 10 sync exports stay sync over a source.**
    - **The 10:** `shopStatus`, `categoryPicture`, `toSeller`, `toListing`, `liveSellerRows`, `storefrontRow`, `sellerFor`, `listedListings`, `publicListing`, `publicListingIds`.
    - **Why they're sync:** they are plain functions over the in-memory store. The cached readers in `index.ts`, and the sample versions of featured, follows, saved searches, staff shops, numbers, badges and messages, compose them with no await. Some writes rely on that: no await between a check and its write.
    - **How they stay sync:** `catalog.ts` gains `catalogOver(source)`, the same rules over a `CatalogSource` (rows and a status lookup). The 10 exports become one-line wrappers over the sample store's source, with unchanged signatures, so their callers and tests don't change.
    - **On Supabase:** `index.ts` awaits `catalog()`, which builds the source from `catalogSnapshot()`, a `"use cache"` function tagged `listings` and `sellers`. It reads every public shop, its status, its pickup points and every public listing with its photos through the public client, a page of 1,000 rows at a time. Then the same sync functions run on it. Spec section 11 already plans search over the cached list of live listings while there are hundreds.
18. **Contract tests in two layers:**
    - **parity:** the seed is generated from the same fixtures as the sample store, so on a freshly reset stack each public reader must return deep-equal results in both backends, after normalising the ids that differ: pickup points are uuids in the database (`seedUuid`);
    - **behaviour:** scenarios such as a hidden listing, a staff-paused shop or a due request, written once against a `World` interface that each backend implements, and run twice:
      - `lib/data/contract/<area>.test.ts` runs in `pnpm test`, on the sample world;
      - `<area>.db.test.ts` runs in `pnpm test:db`, on the Supabase world: a separate Vitest config, the node environment, files one at a time, after `supabase db reset`.
19. **A viewer until phase B lands:**
    - Vitest's global setup for `pnpm test:db` makes a few test accounts (`contract-<name>@vossie.test`) with the admin client, with a profile;
    - it mints each a real session: `auth.admin.generateLink({ type: "magiclink" })` gives an email code, and `verifyOtp({ type: "email" })` on a cookieless client checks it. The custom access token hook sees an `otp` sign-in, and no email is sent;
    - it hands the access tokens to the test files with Vitest's `provide`/`inject`. Minting once per run keeps under Auth's 30 verifications per 5 minutes (`config.toml`);
    - signed-in Supabase twins get their client from one seam, `forViewer()` in `lib/data/supabase/clients.ts`, which tests replace with `vi.mock`;
    - phase B later points `forViewer()` at the cookie client, and nothing else changes;
    - teardown deletes the accounts (`forget_account`, then the Auth user).

    C1 needs a viewer only for the requests scenario's asker. The seam is built now so C2 to C5 can use it.
20. **A Supabase twin never trusts an account-id argument over the session:** where a sample signature takes `accountId`, the twin compares it with the session's user and throws on a mismatch. A programming error then fails loudly, never reads someone else's rows.
21. **Four C1 reads use the admin client, server-side,** because they need rows no API role may read, and only counts or the row's outcome leave the server:
    - `settleRequests` (decision 2);
    - `featuredFor` (pins and draws are admins' and the server's: step 2 decision 5);
    - `shopStats` (every conversation of a shop, also for a buyer's reply);
    - badges (they write `shops.badge`: step 2's note).

    Each is request-time code, never inside `"use cache"`.
22. **Mapping rules shared by every twin** (`lib/data/supabase/rows.ts`):
    - times through `new Date(x).toISOString()`, because PostgREST writes `+00:00` where the store writes `.000Z`;
    - dates stay `YYYY-MM-DD`;
    - the app's `"all"` is null and back (spec amendment 12.2);
    - a stored photo's address is `/photos/<uuid>`, a placeholder keeps its path, and an empty alt stays empty.
23. **Builds on Supabase read the database at build time.** `generateStaticParams` calls the cached readers. A Vercel build with `VOSSIE_BACKEND=supabase` needs the project reachable; the go-live notes say so.

## Open questions for Lama

**Answered by the controller, 2026-10-21: see amendment 1.** The recommendations below are kept for the record; where an answer differs (question 2: exact domains only), the amendment wins.

1. **Pickup points.** Production starts with the 24 sample points ("Library entrance" and "Main reception" on each of the 12 campuses), which the Hub can rename, retire or add to. Are they real places on each campus, or should production start with none? (Recommended: start with them; Eduvos confirms before launch.)
2. **`vossie.net` subdomains.** The database and the app both allow a listed domain's subdomains (`x@mail.vossie.net`). Keep that, or allow the exact domains only? (Recommended: keep it, since one rule serves both today.)
3. **Settling on every board view.** On Supabase, every board and homepage render makes one call to `settle_requests` (a few milliseconds when nothing is due), as sample mode settles on every look. The nightly job alone would also do, with the asker's own pages settling first. (Recommended: keep the app's behaviour for now; drop the board's call if it shows in timings.)
4. **Old pins.** The sample store tidies away pins and draws more than 7 days old. On Supabase, should old pins be kept (they cost nothing, and the audit log already names them) and only old draws deleted? (Recommended: keep pins, delete draws older than 7 days.)
5. **Decision 12 touches `lib/auth/config.ts`,** phase B's area, before phase B starts. Veto it to leave the app's default as `eduvos.com` and set `VOSSIE_EMAIL_DOMAINS` on each deployment instead.

---

## Order, and files each task writes

Tasks that write the same file run one after another. The rest may run side by side, with one implementer per task.

| Task | Writes | After |
|---|---|---|
| 0 Baseline | nothing | |
| 1 Reference rows, domains | `supabase/migrations/20261021120000_reference_data.sql`, `…20261021120010_exact_email_domains.sql` (hand-written, amendment 2), `supabase/tests/24_reference_data.test.sql`, `supabase/tests/05_sign_in.test.sql` (the subdomain cases flip), `scripts/reference-sql.ts` (+ `.test.ts`), `scripts/make-reference.ts`, `scripts/seed-sql.ts` (+ `.test.ts`), `supabase/seed.sql`, `lib/auth/config.ts` (+ `.test.ts`), `lib/auth/email.ts` (+ `.test.ts`) | 0; one after phase B's Task 1 or before it, never beside it (shared `config.ts`) |
| 2 Requests close themselves: schema | `…20261021120100_requests_closing.sql`, `25_requests_closing.test.sql` | 0 |
| 3 Settle and the nightly job | `…20261021120200_requests_settle.sql`, `26_requests_settle.test.sql`, `lib/looking-for/words.test.ts` (adds cases), `06_account_actions.test.sql` (amendment 6) | 2 |
| 4 Request functions | `…20261021120300_requests_actions.sql`, `27_requests_actions.test.sql` | 2 |
| 5 Report target owner | `…20261021120400_report_target_owner.sql`, `28_report_target_owner.test.sql`, `06_account_actions.test.sql` (amendment 6) | 0; after 3 for `06` |
| 6 Own-target gate | `…20261021120500_own_target_gate.sql`, `29_own_target_gate.test.sql`, earlier tests only if a case acted on its own admin's shop | 5 |
| 7 Own shop's mentor | `…20261021120600_own_shop_mentor.sql`, `30_own_shop_mentor.test.sql` | 0 |
| 8 Public read views | `…20261021120700_public_reads.sql`, `31_public_reads.test.sql`, `supabase/tests/21_grants.test.sql`, `06_account_actions.test.sql` (amendment 6) | 2; after 5 for `06` |
| 9 Seed, types, advisors | `scripts/seed-sql.ts` (+ test), `supabase/seed.sql`, `lib/supabase/database.types.ts`, this plan's ledger | 1 to 8 |
| 10 Review of 2b | nothing (read-only) | 9 |
| 11 Staging checkpoint 1b | nothing in the repo | 10, Lama |
| 12 C0 plumbing | `lib/backend.ts` (+ test), `lib/supabase/env.ts`, `lib/data/supabase/clients.ts`, `lib/data/supabase/rows.ts` (+ test), `lib/data/boundaries.test.ts`, `vitest.config.mts`, `vitest.db.config.mts`, `tests/db/setup.ts`, `tests/db/empty.ts`, `package.json`, `app/privacy/page.test.tsx` (the guard narrowed, amendment 9; phase B's Task 9 writes it too) | 9 |
| 13 C0 harness | `tests/db/global-setup.ts`, `tests/db/accounts.ts`, `tests/db/viewer.ts`, `tests/contract/world.ts`, `tests/contract/sample-world.ts`, `tests/db/supabase-world.ts`, `tests/db/parity.ts`, `lib/data/contract/smoke.*` | 12 |
| 14 C1 pickup points | `lib/data/pickup-points.ts`, `lib/data/supabase/pickup-points.ts`, `lib/data/index.ts`, `lib/data/contract/pickup-points.*`, `lib/data/contract/reference.db.test.ts` | 13 |
| 15 C1 catalog | `lib/data/catalog.ts`, `lib/data/supabase/catalog.ts`, `lib/data/index.ts`, `lib/data/contract/catalog.*` | 14 |
| 16 C1 Hub posts | `lib/data/hub-posts.ts`, `lib/data/supabase/hub-posts.ts`, `lib/data/index.ts`, `lib/data/contract/hub.*` | 15 |
| 17 C1 requests | `lib/data/requests.ts`, `lib/data/supabase/requests.ts`, `lib/data/index.ts`, `lib/data/contract/requests.*` | 16 |
| 18 C1 Featured | `lib/data/featured.ts`, `lib/data/supabase/featured.ts`, `lib/data/contract/featured.*` | 15 |
| 19 C1 shop stats and badges | `lib/data/shop-stats.ts`, `lib/data/badges.ts`, `lib/data/supabase/{shop-stats,badges}.ts`, `lib/data/contract/stats.*` | 15 |
| 20 C1 check and docs | `lib/data/contract/sitemap.db.test.ts`, this plan, the programme plan | 14 to 19 |

- Tasks 2 to 8 each write their own migration and test file, so after Task 2 they may run side by side, except 6 after 5. Migration names are fixed above, so their order never depends on who finishes first.
- `lib/data/index.ts` is written by 14, 15, 16 and 17, in that order. Tasks 18 and 19 may run beside 16 and 17.

## Shared commands

- **SQL tasks:** `supabase db reset` (local), then `supabase test db`. Run a single file with `supabase test db supabase/tests/<file>`. Then `supabase db lint`.
- **TypeScript tasks:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (sample, unit and contract), and, from Task 12, `pnpm test:db` after a fresh `supabase db reset`. Run a single file with `pnpm vitest run <path>` or `pnpm vitest run --config vitest.db.config.mts <path>`.
- **The wording rule (step 2's):** every sentence a function builds in SQL is pinned twice, by the same literal string:
  - in pgTAP;
  - in a Vitest case that calls the TypeScript function.

  The two can't drift without one failing.

---

## Task 0: Baseline

1. Run "Recheck before starting" 1 to 7.
2. Record in the ledger: pgTAP 1,976, unit 2,701, HEAD.

## Task 1: Reference rows and allowed domains, from a migration (decisions 10, 11, 12)

**Files:** `supabase/migrations/20261021120000_reference_data.sql` (generated), `supabase/tests/24_reference_data.test.sql`, `scripts/reference-sql.ts`, `scripts/reference-sql.test.ts`, `scripts/make-reference.ts`, `scripts/seed-sql.ts`, `scripts/seed-sql.test.ts`, `supabase/seed.sql`, `lib/auth/config.ts`, `lib/auth/config.test.ts`.

**Failing tests first.**
1. `lib/auth/config.test.ts`: change the default case to expect `["eduvos.com", "vossie.net"]` and add `DEFAULT_EMAIL_DOMAINS` equal to it. `pnpm vitest run lib/auth/config.test.ts` fails.
2. `scripts/reference-sql.test.ts` (new):
   - `makeReferenceSql({ campuses, categories, pickupPoints, domains: DEFAULT_EMAIL_DOMAINS })` returns:
     - one `insert … on conflict do nothing` per table: `private.allowed_email_domains`, `public.campuses`, `public.categories`, `public.pickup_points`;
     - the pickup points with ids `seedUuid("pickup-point", id)` and `retired_at` null;
   - the committed migration file equals `makeReferenceSql(...)` byte for byte. When a fixture changes later, this fails and says: write a new migration, never edit this one;
   - no `vossie.test` in the output.
3. `scripts/seed-sql.test.ts`:
   - the domains line expects only `('vossie.test')`;
   - new: the seed has no `insert into public.campuses`, `public.categories` or `public.pickup_points`.
4. `supabase/tests/24_reference_data.test.sql`, about 14 tests:
   - `eduvos.com` and `vossie.net` are in `private.allowed_email_domains`;
   - `private.email_allowed` (as `supabase_auth_admin`, like test 05) gives:
     - `eduv1234567@vossie.net`: true;
     - `someone@vossie.net`: true (no pattern on the part before the @);
     - `a@mail.vossie.net` and `a@students.eduvos.com`: false (exact domains only, amendment 2);
     - `a@vossie.network` and `a@notvossie.net`: false;
     - `thandi@eduvos.com`: true;
   - 13 campuses (one `is_online`), 10 categories and 24 pickup points, none retired;
   - re-running the migration's insert statements inside the test changes no row count (idempotent).

**Implementation.**
- `lib/auth/config.ts`: `export const DEFAULT_EMAIL_DOMAINS = ["eduvos.com", "vossie.net"] as const;` and `emailDomains` falls back to `[...DEFAULT_EMAIL_DOMAINS]`. Comment: students sign in as `eduv` and 7 digits `@vossie.net`, staff at `eduvos.com` (Lama, 2026-10-21). Update `.env.example`'s commented example only if it names the default.
- `scripts/reference-sql.ts`: a pure `makeReferenceSql(fixtures)`, reusing `seed-sql.ts`'s `literal`. Export `literal` and `insert` from there, with an `onConflict` option, rather than copying them. Its header comment says it is production's reference data and that the file is generated once.
- `scripts/make-reference.ts`: prints the SQL. Run once: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/make-reference.ts > supabase/migrations/20261021120000_reference_data.sql`.
- `scripts/seed-sql.ts`:
  - drop the campuses, categories and pickup-point inserts;
  - `SEED_EMAIL_DOMAINS = ["vossie.test"]`;
  - the header comment: "Reference rows and production's domains come from `…_reference_data.sql`."
- Regenerate the seed: `pnpm db:seed`.

**Commands and expected results.**
- `supabase db reset`: the reset succeeds with migrations then seed. The seed no longer inserts campuses, so there's no conflict.
- `supabase test db`: 1,976 + about 14 pass. Test 05 still passes: it empties and refills the domains inside its own transaction.
- `pnpm vitest run scripts lib/auth`, `pnpm lint`, `pnpm typecheck`: pass.

## Task 2: Requests close themselves: the schema (decisions 1 and 5)

**Files:** `supabase/migrations/20261021120100_requests_closing.sql`, `supabase/tests/25_requests_closing.test.sql`.

**Failing test first:** `25_requests_closing.test.sql`, about 40 tests. Requests are inserted as `postgres`, with `pg_temp` accounts as in test 18.
- `closes_on`:
  - needed by `2026-10-16`: `2026-10-20` (stage L's example);
  - no date, `updated_at = '2026-10-13T09:30:00Z'`: `2026-11-12`;
  - `updated_at = '2026-10-13T22:30:00Z'` (14 October in SAST): `2026-11-13`;
  - a sample (`asker_id` null): null;
  - year edges: needed by `2026-12-29` gives `2027-01-02`; updated `2026-12-31T21:59:59Z` gives `2027-01-30`, and `22:00:00Z` gives `2027-01-31`;
  - an update of `needed_by` or `updated_at` moves it (stored generated columns recompute);
- `closed_by`:
  - only `'asker'` or `'auto'`;
  - only on a closed request with an asker: an open one with `closed_by` is refused, and so is a sample with it (amendment 3: the check is one-way, so a closed asker's request with no `closed_by`, as tests 15, 18 and 19 make, is still allowed);
  - a sample may be closed with neither (the two closed fixtures);
- `reminded_for`: a date, only on a request with an asker;
- grants:
  - anon and authenticated may select `closes_on`;
  - authenticated may select `closed_by` and anon may not;
  - neither may select `reminded_for` or `asker_id`;
- `public.my_requests`: for its asker, `closed_by` and `closes_on`, a sample has neither, and another account sees no row;
- the backfill can't be tested from an empty database (step 2's Tasks 1–3 review). The reviewer reads it (Task 10), and staging's dry run is read with it in mind (Task 11).

**Implementation** (header comment cites `lib/looking-for/rules.ts` `closingDay`, `NEEDED_BY_GRACE_DAYS`, `IDLE_CLOSE_DAYS`, `REMINDER_DAYS_BEFORE` and stage L decisions 8 to 16, stage M 13 to 16):

```sql
-- closingDay (lib/looking-for/rules.ts): the first SAST day the request counts as closed. Immutable, for the column.
create function private.request_closing_day(asker uuid, needed date, updated timestamptz)
returns date language sql immutable set search_path = '' as $$
  select case
    when asker is null then null                     -- a sample never closes itself (stage L decision 9)
    when needed is not null then needed + 4          -- NEEDED_BY_GRACE_DAYS (3) whole days after, then closed
    else private.sast_day(updated) + 30              -- IDLE_CLOSE_DAYS after the last post, edit, reopen or Show again
  end;
$$;
revoke all on function private.request_closing_day(uuid, date, timestamptz) from public, anon, authenticated;
-- The service role writes requests directly (the contract tests' world, amendment 4): a generated column's function is
-- executed with the writer's rights, as private.sast_day already is.
grant execute on function private.request_closing_day(uuid, date, timestamptz) to service_role;

alter table public.requests
  add column closed_by text check (closed_by in ('asker', 'auto')),
  add column reminded_for date,
  add column closes_on date generated always as (private.request_closing_day(asker_id, needed_by, updated_at)) stored;

update public.requests set closed_by = 'asker' where status = 'closed' and asker_id is not null;  -- backfill first
alter table public.requests
  add constraint requests_closed_by_when_closed check (closed_by is null or (status = 'closed' and asker_id is not null)),  -- one-way (amendment 3)
  add constraint requests_reminded_for_askers check (reminded_for is null or asker_id is not null);

-- The settle's and the job's rows: open, shown, an asker's, by closing day.
create index requests_settle_idx on public.requests (closes_on) where status = 'open' and hidden_at is null and asker_id is not null;

grant select (closes_on) on table public.requests to anon, authenticated;
grant select (closed_by) on table public.requests to authenticated;
```
- `create or replace view public.my_requests with (security_invoker = true)`: the same columns, with `r.closed_by, r.closes_on` added at the end (CREATE OR REPLACE VIEW only appends, and replaces the view's options with the ones given, so the `with` clause must be restated: amendment 5). Grants as before.
- Note in the header: changing the rule later means a new immutable function and a column swap (stored values recompute only when a row is updated).

**Commands:**
- `supabase db reset`, then `supabase test db`: everything passes (tests 15, 18 and 19 are unchanged: the check is one-way, and their requests have `updated_at` now);
- `supabase db lint`: clean.

## Task 3: The settle and the nightly job (decision 2)

**Files:** `supabase/migrations/20261021120200_requests_settle.sql`, `supabase/tests/26_requests_settle.test.sql`, `lib/looking-for/words.test.ts` (new cases only).

**Failing tests first.**
1. `lib/looking-for/words.test.ts` pins four strings:
   - `requestAutoClosedText("Calculator", "needed-by")` is `"Your request Calculator closed automatically 3 days after the date you needed it by. Reopen it in Your requests if you still need it."`;
   - the `"idle"` version;
   - `requestCloseReminderText("Calculator", "2026-10-20", "needed-by")` is `"Your request Calculator closes automatically on 20 Oct, 3 days after the date you needed it by. Still need it? Give it a new date in Your requests."`;
   - the idle reminder with `"2026-11-05"` gives `"… on 5 Nov, after 30 days with no changes. Still need it? Edit it in Your requests and it stays up for 30 days more."`.

   They pass at once: they pin today's words for the SQL to match.
2. `26_requests_settle.test.sql`, about 45 tests. Dates are relative to `private.sast_day(now())`, so `p_now` can stay `now()`:
   - the words: `private.request_auto_closed_note_text(...)` and `private.request_close_reminder_note_text(...)` equal the four strings above;
   - **closing:**
     - an open request with `closes_on = today` is closed by `settle_requests(now())`: `closed_by 'auto'`, `closed_at = (closes_on::timestamp at time zone 'Africa/Johannesburg')`, `updated_at` unchanged;
     - one `request-update` notification to the asker, with the reason's words and `/account/requests`;
     - the call returns 1, and a second call returns 0 and adds no notification;
   - **reminding:**
     - `closes_on = today + 2` and `today + 1`: reminded once, `reminded_for = closes_on`, the reminder's words, and the call returns 0;
     - `today + 3`: nothing;
     - already reminded for that closing day: nothing;
     - reminded for an older closing day: reminded again;
   - **skipped:** a sample, a hidden request and a closed one: nothing;
   - **a missed night catches up:** `closes_on = today - 5` closes (with no reminder), and `today + 1` with no reminder yet is reminded;
   - **the cap:** `settle_requests(now() + interval '30 days')` closes nothing that isn't due today;
   - **the lock:** `pg_advisory_xact_lock` is held for `hashtext('vossie:settle-requests')` during the call, checked through `pg_locks` from inside a wrapper, as test 17 checks `remove_role`'s;
   - **who may call it:** anon and authenticated may not execute it; service_role may;
   - **the job:** `cron.job` has `settle-requests` at `'5 22 * * *'` running `select public.settle_requests()`.

**Implementation:**
```sql
-- requestAutoClosedText and requestCloseReminderText (lib/looking-for/words.ts), word for word; dates as dayMonth.
create function private.request_close_why(needed date) returns text language sql immutable set search_path = '' as $$
  select case when needed is not null then '3 days after the date you needed it by' else 'after 30 days with no changes' end;
$$;
create function private.request_auto_closed_note_text(title text, needed date) returns text ... as $$
  select 'Your request ' || title || ' closed automatically ' || private.request_close_why(needed)
    || '. Reopen it in Your requests if you still need it.';
$$;
create function private.request_close_reminder_note_text(title text, closes date, needed date) returns text ... as $$
  select 'Your request ' || title || ' closes automatically on ' || to_char(closes, 'FMDD Mon') || ', '
    || private.request_close_why(needed) || '. Still need it? '
    || case when needed is not null then 'Give it a new date in Your requests.'
            else 'Edit it in Your requests and it stays up for 30 days more.' end;
$$;

-- settleRequests (lib/data/requests.ts): stores every due close and the one reminder, telling the asker in the app.
create function public.settle_requests(p_now timestamptz default now())
returns int language plpgsql volatile security definer set search_path = '' as $$
declare
  today date := private.sast_day(least(coalesce(p_now, now()), now()));
  closed int;
begin
  perform pg_advisory_xact_lock(hashtext('vossie:settle-requests'), 0);
  with done as (
    update public.requests r
    set status = 'closed', closed_by = 'auto',
        closed_at = (r.closes_on::timestamp at time zone 'Africa/Johannesburg')   -- closedAtFor(day)
    where r.status = 'open' and r.hidden_at is null and r.asker_id is not null and r.closes_on <= today
    returning r.id, r.asker_id, r.title, r.needed_by
  )
  insert into public.notifications (account_id, kind, subject_id, text, href)
  select d.asker_id, 'request-update', d.id, private.request_auto_closed_note_text(d.title, d.needed_by), '/account/requests'
  from done d;
  get diagnostics closed = row_count;
  with due as (
    update public.requests r set reminded_for = r.closes_on
    where r.status = 'open' and r.hidden_at is null and r.asker_id is not null
      and r.closes_on - 2 <= today and today < r.closes_on            -- REMINDER_DAYS_BEFORE
      and r.reminded_for is distinct from r.closes_on
    returning r.id, r.asker_id, r.title, r.closes_on, r.needed_by
  )
  insert into public.notifications (account_id, kind, subject_id, text, href)
  select d.asker_id, 'request-update', d.id,
    private.request_close_reminder_note_text(d.title, d.closes_on, d.needed_by), '/account/requests'
  from due d;
  return closed;
end;
$$;
revoke all on function public.settle_requests(timestamptz) from public, anon, authenticated;
grant execute on function public.settle_requests(timestamptz) to service_role;
select cron.schedule('settle-requests', '5 22 * * *', 'select public.settle_requests()');
```
- Neither UPDATE sets `updated_at`, so `closes_on` doesn't move. There's no trigger on `requests` (checked 2026-10-21: only `seller_profiles` has one).
- The private text functions are revoked from every API role, as Task 4 of step 2 did.
- Lock order: the settle takes its own lock, then row locks. `save_request` and `set_request_open` take the asker's lock and then one row, and never the settle's lock, so no cycle.

**Commands:** `supabase db reset`, then `supabase test db` (all pass), `pnpm vitest run lib/looking-for/words.test.ts`, `supabase db lint`.

## Task 4: The request functions follow the rule (decisions 3 and 4)

**Files:** `supabase/migrations/20261021120300_requests_actions.sql`, `supabase/tests/27_requests_actions.test.sql`.

**Failing test first:** `27_requests_actions.test.sql`, about 35 tests, signed in with `pg_temp.sign_in` as test 18:
- **`save_request`:**
  - an asker with 4 open requests and a fifth whose `closes_on` is today posts a new one (`posted`), where 5 open would be `open-limit`;
  - editing the due one answers `not-open` and changes nothing;
  - editing one due tomorrow saves it and moves `closes_on` (idle: today + 30);
- **`set_request_open`:**
  - Close sets `closed_by 'asker'` and `closed_at` now (`closed`);
  - Close on a due, unsettled request answers `nothing`;
  - Reopen answers `reopened` and sets `closed_by` and `closed_at` null, `updated_at` now, and `closes_on` today + 30 (no date);
  - Reopen with `needed_by` before today answers `reopened-date-cleared` and clears `needed_by`;
  - Reopen with `needed_by` today or later keeps it and answers `reopened`;
  - `reminded_for` is kept through Close and Reopen;
  - the reopen count leaves due requests out;
  - a hidden request: `nothing`;
- **`start_offer`:** on a request with `closes_on` today answers `closed` and writes no conversation; on one due tomorrow, `offered`;
- **the earlier tests still pass:** tests 18 and 20 are unchanged (their requests aren't due).

**Implementation:** each function is copied from its latest definition (Recheck 6), with only these changes. Each change is marked `-- stage L` in the body.
- `save_request`:
  - `today date := private.sast_day(now());`;
  - the edit's `where` adds `and (q.closes_on is null or q.closes_on > today)`;
  - the open-limit count adds the same condition.
- `set_request_open`:
  - the row lock's condition adds, for a close, `and (q.closes_on is null or q.closes_on > today)`;
  - reads `q.needed_by` into a variable under that lock (PG 17 has no OLD in RETURNING);
  - the reopen count adds the closing condition;
  - the update:
    ```sql
    set status = case when p_open then 'open' else 'closed' end,
        closed_at = case when p_open then null else now() end,
        closed_by = case when p_open then null else 'asker' end,
        needed_by = case when p_open and kept_needed < today then null else kept_needed end,
        updated_at = now()
    ```
  - it returns `reopened-date-cleared` when it cleared the date.
- `start_offer`: `if request.status <> 'open' or (request.closes_on is not null and request.closes_on <= private.sast_day(now())) then return '{"result": "closed"}'::jsonb;` in the same place as today's status check, so the result order doesn't change.
- Signatures, grants and the asker's lock stay as they are.

**Commands:** `supabase db reset`, then `supabase test db` (all pass), `supabase db lint`.

## Task 5: Reports remember who owned their target (decision 6)

**Files:** `supabase/migrations/20261021120400_report_target_owner.sql`, `supabase/tests/28_report_target_owner.test.sql`.

**Failing test first:** `28_report_target_owner.test.sql`, about 25 tests:
- **when it's made:** `create_report` records `target_owner_id`:
  - a listing's shop owner;
  - a shop's owner;
  - a request's asker;
  - null for a sample shop, a sample listing and a sample request;
- **who can read it:** authenticated can't select it (the reports column grant); `staff_reports` doesn't show it;
- **`private.report_own_kind(report, account)`:**
  - **exists now:**
    - `shop` when the reported shop is the account's;
    - `listing` for a listing of the account's shop;
    - `request` for the account's request;
    - null for someone else's;
  - **gone:**
    - after the listing is deleted, `listing` from `target_owner_id`;
    - after the request is deleted, `request`;
    - with `target_gone` set on a shop report, `shop` from `target_owner_id`, even when a new shop has taken the link;
  - **a sample target:** null;
- **`staff_reports.own`:** as above for the signed-in admin, null for another admin;
- **account deletion:** `forget_account(owner)` leaves the reports and clears `target_owner_id`;
- **the backfill** is read in review, as Task 2's is.

**Implementation:**
- `alter table public.reports add column target_owner_id uuid references public.profiles (id) on delete set null;`, an index on it, and the backfill: shop and listing reports where `not target_gone` from `shops.owner_id`, request reports from `requests.asker_id`. The comment cites `ReportRow.targetOwnerId` (`lib/data/rows.ts:225`) and `createReport` (`lib/data/reports.ts:29`).
- `create_report`: copied from `message_limits.sql:350`. After `title` is resolved it reads `owner`, using the same `case` as the title, and inserts it:
  - listing: the owner of `shops` joined on `l.shop_id`;
  - seller: `shops.owner_id` by slug;
  - request: `asker_id`.
- `private.report_own_kind(p_report uuid, p_account uuid) returns text` (stable, security definer, revoked from anon). It mirrors `toView`'s `own` (`staff-reports.ts:93-105`):
  - **`exists`:**
    - a seller report: `not target_gone` and a shop with that slug;
    - a listing report: `not target_gone` and that listing (hidden ones included);
    - a request report: that request;
  - **when it exists:** whose it is now (a shop's and a listing's shop's `owner_id`, a request's `asker_id`);
  - **when it doesn't:** `target_owner_id = p_account`, with the seller kind mapped to `shop`.
- Replace the view: `create or replace view public.staff_reports with (security_invoker = true) as … , private.report_own_kind(r.id, (select auth.uid())) as own from private.staff_reports() r;` (the `with` clause restated: amendment 5). `report_own_kind` is revoked from `public` and `anon` and granted to `authenticated` and `service_role`, because the invoker's view calls it (amendment 6). The column is appended, and `private.staff_reports()` is unchanged: it returns `setof reports`, so it gains the column, and no API role can call it, because `private` isn't exposed.

**Commands:** `supabase db reset`, then `supabase test db`, `supabase db lint`.

## Task 6: No admin acts on their own (decision 7)

**Files:** `supabase/migrations/20261021120500_own_target_gate.sql`, `supabase/tests/29_own_target_gate.test.sql`; an earlier test file only if one of its cases has an admin acting on a shop they own (then that case moves to a second admin, recorded in "Changes made during the build").

**Failing test first:** `29_own_target_gate.test.sql`, about 90 tests.
- **The fixture:**
  - admin A owns an approved shop SA with a listing LA, and a request RA;
  - A also has a waiting shop application, in a second fixture with its own account, A2, who is made admin;
  - admin B owns nothing;
  - open reports on SA, LA and RA by a student;
  - a mentor who holds the role;
  - one pin on SA.
- **For each function,** called by A on its own target. Each case checks it **returns the code and writes nothing**:
  - the target row, the seller profile, the reports, `featured_pins` and `featured_draws` are unchanged (compared with a copy taken before the call);
  - no new `audit_log` row;
  - no new notification.

  | Function | Target | Code |
  |---|---|---|
  | `approve_shop(A2)` | A2's own application | `own-shop` |
  | `decline_shop(A2, 'x')` | A2's own application, with a bad reason too: the gate comes before the reason check | `own-shop` |
  | `set_shop_verified(SA, true)` | SA | `own-shop` |
  | `staff_pause_shop(SA, reason)` | SA | `own-shop` |
  | `staff_resume_shop(SA)` | SA after B paused it | `own-shop` |
  | `set_shop_mentor(SA, mentor)` | SA | `own-shop` |
  | `dismiss_report(report on SA)` | SA | `own-shop` |
  | `dismiss_report(report on LA)` | LA | `own-shop` |
  | `dismiss_report(report on RA)` | RA | `own-request` |
  | `dismiss_report(...)` | after LA is deleted (the fallback) | `own-shop` |
  | `dismiss_report(...)` | after RA is deleted | `own-request` |
  | `hide_listing(LA, reason)` | LA | `own-shop` |
  | `hide_request(RA, reason)` | RA | `own-request` |
  | `show_listing(LA)` | LA after B hid it | `own-shop` |
  | `show_request(RA)` | RA after B hid it | `own-request` |
  | `pin_shop(SA, campus, today)` | SA | `own-shop` |
  | `unpin_shop(pin on SA)` | SA's pin | `own-shop` |

- **The same calls by B** all answer `changed`, as before, each in its own savepoint so they don't depend on each other.
- **Unchanged rules:**
  - a sample shop (no owner) is nobody's: A may verify it;
  - a mentor note about yourself is still `forbidden` (`can_mentor`; a regression case);
  - someone without the role still gets `forbidden` before the gate, so no hint that a shop is staff-owned.

**Implementation:**
- `private.is_own_shop(shop uuid) returns boolean`: `exists (select 1 from public.shops s where s.id = shop and s.owner_id = (select auth.uid()))`. Stable, security definer, revoked from every API role.
- Each of the 13 functions is copied from its latest definition (Recheck 6). One block goes right after the `is_staff` check, before `check_reason`, every `select … for update` and every write:

  | Function | Gate |
  |---|---|
  | `approve_shop`, `decline_shop` | `if p_account = (select auth.uid()) then return 'own-shop'; end if;` (the waiting shop's owner is the account named, `isOwnShop` on its profile's account) |
  | `set_shop_verified`, `staff_pause_shop`, `staff_resume_shop`, `set_shop_mentor`, `pin_shop` | `if private.is_own_shop(p_shop) then return 'own-shop'; end if;` |
  | `unpin_shop` | `if private.is_own_shop((select f.shop_id from public.featured_pins f where f.id = p_pin)) then return 'own-shop'; end if;` |
  | `hide_listing`, `show_listing` | `if private.is_own_shop((select l.shop_id from public.listings l where l.id = p_listing)) then return 'own-shop'; end if;` |
  | `hide_request`, `show_request` | `if private.is_my_request(p_request) then return 'own-request'; end if;` |
  | `dismiss_report` | `own := private.report_own_kind(p_report, (select auth.uid()));`, then `if own = 'request' then return 'own-request'; elsif own is not null then return 'own-shop'; end if;` |

- Each function's header comment gains `'own-shop' | 'own-request'` in its "Returns" line.
- Signatures and grants are unchanged.
- **Ordering note (from the app):** `pin_shop`'s gate goes after its two argument raises (no such campus, no day) and before `day-past`, `day-far` and the eligibility read, as `pinSeller` checks ownership before the day. A malformed campus still raises first, because that's an argument error, not a decision (amendment 7).

**Commands:**
- `supabase db reset`, then `supabase test db`: all pass. If test 16, 17, 18b or 22 has an admin acting on a shop they own, it now gets `own-shop`; move that case to a second admin and note it;
- `supabase db lint`.

## Task 7: No admin takes away their own shop's mentor (decision 8)

**Files:** `supabase/migrations/20261021120600_own_shop_mentor.sql`, `supabase/tests/30_own_shop_mentor.test.sql`.

**Failing test first:** about 15 tests.
- **The refusal:**
  - admin A owns shop SA, mentored by M (who also holds admin in one case);
  - `remove_role(M, 'mentor')` by A answers `own-shop-mentor`;
  - M keeps the role, SA keeps `mentor_id = M`, and there's no audit row and no notification.
- **What still works:**
  - by admin B, `changed`, and SA's mentor is cleared, as before;
  - `remove_role(M, 'admin')` by A, when M holds both roles, is unaffected;
  - A's shop paused, or sent back to waiting: still refused, because the check reads the seller profile, not the shop's status (stage M decision 2);
  - an admin with no shop: unaffected.
- **The order:**
  - "no such role" comes first: `remove_role(account without the role, 'mentor')` by A is `nothing`, even if it's A's shop's mentor's id;
  - removing your own admin role is still `own-admin`.
- **The lock order:** `remove_role` locks M's profile first, then A's seller profile `for share`. A two-session deadlock can't be tested without dblink, so a `pg_locks` check inside a wrapper shows both locks held, in the order the function takes them, as test 17 did.

**Implementation:** copy `remove_role` (`staff_tools_actions.sql:918`) and add this after the target's `for update` and the "no such role" check, and before the last-admin check:
```sql
if p_role = 'mentor' and exists (
  select 1 from public.seller_profiles sp
  where sp.account_id = me and sp.mentor_id = target.id
  for share of sp
) then
  return 'own-shop-mentor';
end if;
```
The comment cites `removeRole` (`lib/data/staff-accounts.ts:128`), stage M decisions 2 and 5, and the lock order shared with `set_shop_mentor`.

**Commands:** `supabase db reset`, then `supabase test db`, `supabase db lint`.

## Task 8: Read-only views for phase C's public reads (decision 13)

**Files:** `supabase/migrations/20261021120700_public_reads.sql`, `supabase/tests/31_public_reads.test.sql`, `supabase/tests/21_grants.test.sql`.

**Failing tests first:**
1. `21_grants.test.sql`: the anon allowlist becomes `array['hub_going', 'request_offer_count', 'shop_is_public', 'storefront_status']`.
2. `31_public_reads.test.sql`, about 30 tests, as anon and as a signed-in student:
   - **`storefronts`:**
     - a sample shop is `approved`;
     - an approved owned shop is `approved`;
     - a shop its seller paused is `paused`;
     - a Hub-paused shop, a waiting shop and a declined shop have no row;
     - anon can't select `seller_profiles` (unchanged);
   - **`request_cards`:**
     - the 16 samples with `closes_on` null and `offers` equal to `seed_offers`;
     - a hidden request has no row;
     - an asker's request has `closes_on`;
     - an offer thread adds one to `offers`;
     - no `asker_id` column;
   - **`hub_cards`:**
     - only published posts;
     - `going_now = going + RSVPs` for events, null for tips and office hours;
     - no `author_id`;
   - **all three:**
     - `security_invoker` (checked in `pg_class.reloptions`);
     - select granted to anon, authenticated and service_role, and nothing else.

**Implementation:**
```sql
-- A public shop's status, for the catalog (shopStatus and hasStorefront, lib/data/catalog.ts): 'approved' or 'paused'
-- (by its seller); null for any shop without a storefront. What a storefront shows anyway ("paused").
create function private.storefront_status(shop uuid) returns text language sql stable security definer set search_path = '' as $$
  select case when private.shop_is_public(shop) then private.shop_status(shop) end;
$$;
revoke all on function private.storefront_status(uuid) from public, anon, authenticated;
grant execute on function private.storefront_status(uuid) to anon, authenticated, service_role;

create view public.storefronts with (security_invoker = true) as
select s.id as shop_id, s.slug, private.storefront_status(s.id) as status
from public.shops s where private.shop_is_public(s.id);

create view public.request_cards with (security_invoker = true) as
select r.id, r.title, r.category_slug, r.campus_slug, r.details, r.budget_zar, r.swap_welcome, r.needed_by, r.status,
  r.created_at, r.updated_at, r.closed_at, r.closes_on, public.request_offer_count(r.id) as offers
from public.requests r where r.hidden_at is null;

create view public.hub_cards with (security_invoker = true) as
select p.id, p.kind, p.title, p.summary, p.place, p.body, p.campus_slug, p.starts_at, p.capacity, p.going,
  public.hub_going(p.id) as going_now, p.image_src, p.image_alt, p.cover_photo_id, p.published_at, p.created_at
from public.hub_posts p where p.published;
```
Then revoke all on the three views from `public, anon, authenticated, service_role`, and grant select to `anon, authenticated, service_role`.

**Commands:** `supabase db reset`, then `supabase test db`, `supabase db lint`, and the advisors (security and performance, local): no new warning.

## Task 9: Seed, types, advisors, ledger

1. `scripts/seed-sql.ts`: the requests insert writes `closed_by` (null for every sample: the fixtures' `closedBy` is null) only if a column list needs it. The column's default is null, so prefer no change. `scripts/seed-sql.test.ts`: nothing more to change unless the generator changed. `pnpm db:seed`; the seed test passes.
2. `pnpm db:types` (`supabase gen types typescript --local`), then `pnpm typecheck`.
3. `supabase db reset`, then `supabase test db`: about 1,976 + 300 pass. `supabase db lint` clean. Security and performance advisors at every level: no warnings or errors. Info-level items are explained in the migration that causes them, as step 2's Task 11 did (for example `requests_settle_idx` unused on an idle stack).
4. Docs on the branch: this plan's ledger and "Changes made during the build". The programme plan's step 2 gains a line: "Step 2b (stages L and M, reference rows, domains, public read views): this plan, Part 1".

## Task 10: Review of step 2b (read-only)

One combined reviewer, time-boxed to about 25 minutes, runs only `supabase test db`. It checks:
- each rule against `lib/looking-for/rules.ts`, `lib/data/requests.ts`, `lib/staff/admin-actions.ts`, `lib/data/staff-reports.ts` and `lib/data/staff-accounts.ts`;
- that every replaced function keeps every earlier change (diff each against its Recheck 6 base);
- grants: no `asker_id`, `reminded_for` or `target_owner_id` reachable through the API;
- the lock orders;
- that the wording is pinned twice.

Findings go to the controller; fixes are a follow-up migration, never an edit to a committed one.

## Task 11: Staging checkpoint 1b (Lama's go-ahead)

"Staging" here is the CLI's `staging` remote, which is the live project "Vossie Market" (Lama, 2026-10-21; amendment 17).

1. Lama logs the CLI in from their own terminal, with a token scoped to "Vossie Market" (programme "For Lama" 1).
2. `supabase migration list --linked`: shows which of step 2's and this step's migrations staging lacks (step 2's checkpoint may still be pending).
3. `supabase db push --linked --dry-run`, shown to Lama.
4. On Lama's go-ahead for that run: `supabase db push --linked`.
5. Confirm on staging:
   - `migration list --linked` shows local and remote equal;
   - the project's `allowed_email_domains` holds `eduvos.com`, `vossie.net` and `vossie.test` (the last from its old seed). `vossie.test` stays only until phase B's clean-up script (its Task 13, B3) deletes every domain but the two; no migration here removes it.

---

## Task 12: C0, the plumbing (decisions 15, 16, 22)

**Files:** `lib/backend.ts`, `lib/backend.test.ts`, `lib/supabase/env.ts`, `lib/data/supabase/clients.ts`, `lib/data/supabase/rows.ts`, `lib/data/supabase/rows.test.ts`, `lib/data/boundaries.test.ts`, `vitest.config.mts`, `vitest.db.config.mts`, `tests/db/setup.ts`, `tests/db/empty.ts`, `package.json`.

**Failing tests first.**
1. `lib/backend.test.ts`:
   - `backend({})` is `"sample"`, and so is `" "`;
   - `backend({ VOSSIE_BACKEND: "supabase" })` is `"supabase"`, and anything else throws, naming the variable;
   - `onSupabase(env)` follows;
   - the module imports nothing (a source check: no `import`), so a unit test and the client bundle can't pull a server-only module through it.
2. `lib/data/supabase/rows.test.ts`:
   - `iso("2026-10-01T08:00:00+00:00")` is `"2026-10-01T08:00:00.000Z"`, and `iso(null)` is null;
   - `campusToDb("all")` is null, and `campusToDb("pretoria")` is `"pretoria"`;
   - `campusFromDb(null)` is `"all"`;
   - `photoSrc({ photo_id, placeholder_src })` gives `/photos/<uuid>` or the placeholder's path;
   - `selectAll` pages with `.range()` until a page is shorter than 1,000 (with a stub query builder).
3. `lib/data/boundaries.test.ts` (static source checks, plain `fs`):
   - no file with `"use client"` under `app`, `components`, `hooks` or `lib` imports `@/lib/data`, `@/lib/supabase`, `@supabase/` or `@/lib/backend`;
   - no `lib/data/*.ts` outside `lib/data/supabase/` has a static `import … from "./supabase/…"` or `"@/lib/supabase…"`: only `import("./supabase/…")`;
   - every file under `lib/data/supabase/` starts with `import "server-only";` (except `*.test.ts`);
   - nothing outside `lib/data/supabase`, `lib/supabase`, `tests/db` and (later, phase B) `lib/auth` imports `@/lib/supabase`.

**Implementation.**
- `lib/backend.ts`: `backend(env)` moved from `env.ts` word for word, plus `onSupabase(env = process.env)`. It reads the environment on each call, never at module scope. `lib/supabase/env.ts` re-exports `backend` and drops its own copy; `env.test.ts` is unchanged and passes.
- `lib/data/supabase/clients.ts` (`server-only`): the one seam the twins use and the tests replace.
  - `forPublic()`: `publicClient()`, safe inside `"use cache"`;
  - `forServer()`: `adminClient()`, request-time server code only, never inside `"use cache"`;
  - `forViewer()`: throws "forViewer() is wired by phase B" until phase B points it at `viewerClient()`. C0 never imports `lib/supabase/viewer` or `cookies` (amendment 9); the db tests replace it with `vi.mock`.

  Its comment says which each may do, from spec decision 5 and decisions 19 to 21 here.
- `lib/data/supabase/rows.ts` (`server-only`): `iso`, `campusToDb`, `campusFromDb`, `photoSrc`, `selectAll`.
- `vitest.config.mts`: `exclude` adds `"**/*.db.test.ts"`.
- `vitest.db.config.mts` (new):
  - `environment: "node"`, `include: ["**/*.db.test.ts"]`;
  - `globalSetup: ["./vitest.global-setup.ts", "./tests/db/global-setup.ts"]` (Task 13 adds the second; until then only the first);
  - `setupFiles: ["./tests/db/setup.ts"]`;
  - `fileParallelism: false`, `testTimeout: 30_000`;
  - `resolve.alias: { "server-only": "./tests/db/empty.ts" }`, `resolve.tsconfigPaths: true`.
- `tests/db/setup.ts`: the `next/cache` stand-in from `vitest.setup.ts`, copied, since `vitest.setup.ts` is jsdom-specific.
- `package.json`: `"test:db": "vitest run --config vitest.db.config.mts"`.

**Commands and expected results:**
- `pnpm test`: 2,701 plus the new tests, all passing, and no `.db.test.ts` collected;
- `pnpm test:db`: "No test files found" until Task 13, exit 0 with `passWithNoTests`;
- `pnpm lint`, `pnpm typecheck`: clean.

**JS budget:** no client file changes, and `boundaries.test.ts` now guards the rule in every `pnpm test`.

## Task 13: C0, the contract harness and a viewer (decisions 18, 19, 20)

**Files:** `tests/db/global-setup.ts`, `tests/db/accounts.ts`, `tests/db/viewer.ts`, `tests/contract/world.ts`, `tests/contract/sample-world.ts`, `tests/db/supabase-world.ts`, `tests/db/parity.ts`, `lib/data/contract/smoke.contract.ts`, `lib/data/contract/smoke.test.ts`, `lib/data/contract/smoke.db.test.ts`.

**A spike first,** about 10 minutes, a throwaway script in the scratchpad, never committed. On the local stack:
1. `auth.admin.createUser({ email: "contract-spike@vossie.test", email_confirm: true })`;
2. `auth.admin.generateLink({ type: "magiclink", email })` gives `properties.email_otp`;
3. `verifyOtp({ email, token, type: "email" })` on a cookieless publishable client returns a session whose `amr` is `otp`, which the custom access token hook accepts.

Then delete the user.
- **If the hook refuses it:** fall back to `signInWithOtp` and read the code from Mailpit's API (`MAILPIT_URL`, `GET /api/v1/messages`, then the message), within Auth's 30 emails an hour.
- Record the outcome in "Changes made during the build".

**Failing tests first:** `lib/data/contract/smoke.contract.ts` exports `smokeContract(world)`:
- `getCampuses()` has 13 campuses;
- `world.signedIn("asker")` gives an account id;
- `world.asViewer("asker", read)` runs `read` with that account as the viewer.

`smoke.test.ts` runs it with the sample world and `smoke.db.test.ts` with the Supabase world.

The db file also checks:
- a `forViewer()` client reads `my_requests` as the asker, and sees none of another account's;
- `forPublic()` can't read `profiles`;
- `forServer()` can.

**Implementation.**
- **`tests/db/global-setup.ts`:**
  - reads `supabase status -o json` with `execFileSync`. It fails with "Start the local stack (supabase start) and reset it (supabase db reset) first" if the stack is down;
  - sets `VOSSIE_BACKEND=supabase`, `SUPABASE_URL` (API_URL), `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in `process.env` before the workers start, as `vitest.global-setup.ts` sets `TZ`;
  - makes or reuses accounts `asker`, `shopper` and `staff`, with profiles on Pretoria;
  - mints one session each (the spike's way) and `provide("dbSessions", { asker: { id, accessToken }, … })`;
  - its teardown runs `forget_account` and `auth.admin.deleteUser` for each. It never prints a key or a token.
- **`tests/db/viewer.ts`:**
  - `sessionClient(token)`: `createClient(url, publishable, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false, autoRefreshToken: false } })`;
  - `useViewer(name)` sets which session the mocked `forViewer()` returns. Each db test file mocks the seam with `vi.mock("@/lib/data/supabase/clients", async (original) => ({ ...(await original()), forViewer: async () => currentViewerClient() }))`.
- **`tests/contract/world.ts`:** the `World` interface, which grows per task:
  - `name: "sample" | "supabase"`;
  - `signedIn(name)`;
  - `asViewer(name, fn)`;
  - `cleanup()`;
  - a verb per scenario: `hideListing(id, reason)`, `pauseShop(slug, by: "seller" | "staff")`, `retirePickupPoint(id)`, `addRequest(fields)`, `addRsvp(postId, account)`, `recordDraw(campus, day, slugs)`, `addPin(...)`, `notificationsOf(name)`.

  Every verb on the Supabase side records an undo, and `cleanup()` runs the undos in reverse order in `afterEach`, so the seed is the same after each test.
- **`tests/contract/sample-world.ts`:**
  - `resetSampleStore()` in `beforeEach`;
  - the verbs write the store as the existing unit tests do;
  - `signedIn` makes an `AccountRow`.
- **`tests/db/supabase-world.ts`:** the verbs write with the admin client, never through a function a test is checking.
- **`tests/db/parity.ts`:**
  - `parity(read)` runs `read` with `VOSSIE_BACKEND=sample` (fresh `resetSampleStore()`) and then `supabase` (`vi.stubEnv`), and returns both;
  - `normalise(value)` maps the sample's pickup point ids through `seedUuid("pickup-point", id)` (`scripts/seed-sql.ts`) and leaves everything else as it is.

  This works because `onSupabase()` reads the environment on each call.

**Commands:** `supabase db reset`, then `pnpm test:db` (the smoke file passes), and `pnpm test`, `pnpm lint`, `pnpm typecheck`.

## Task 14: C1, pickup points (decision 14)

**Files:** `lib/data/pickup-points.ts`, `lib/data/supabase/pickup-points.ts`, `lib/data/index.ts`, `lib/data/contract/pickup-points.contract.ts`, `.test.ts`, `.db.test.ts`, `lib/data/contract/reference.db.test.ts`.

**Failing tests first.**
- **`pickup-points.contract.ts`:**
  - `getPickupPoints()` lists 24 points;
  - after `world.retirePickupPoint(id)`, it leaves that one out, and `getListingDetail` of a listing on it shows the point with `retired: true`.
- **`pickup-points.db.test.ts`:** `parity(() => getPickupPoints())` is deep-equal after normalising.
- **`reference.db.test.ts`:** the database's campuses (slug, name, region, order, Online) and categories equal `data/fixtures/campuses.ts` and `categories.ts` (decision 14's drift check).

**Implementation.**
- `lib/data/supabase/pickup-points.ts` (`server-only`):
  - `pickupPointRows()` is `"use cache"`, with `tagPickupPoints()`;
  - `forPublic().from("pickup_points").select("id, campus_slug, name, retired_at, created_at")`, ordered by campus and `created_at`, mapped to `PickupPointRow`;
  - `pointsInUse()` and `pickupPointById(id)` are async twins over it, reusing the sample module's `toPoint`, which becomes exported.
- `lib/data/index.ts`:
  - `getPickupPoints`: after `tagPickupPoints()`, `if (onSupabase()) return (await import("./supabase/pickup-points")).pointsInUse();`;
  - `getListingDetail`'s point lookup goes through one local `pointById(id)` that picks the same way.
- The sample functions are unchanged.

**Commands:** `pnpm test`, `supabase db reset`, `pnpm test:db`, `pnpm lint`, `pnpm typecheck`.

**JS budget:** only `lib/data` changes; `boundaries.test.ts` passes.

## Task 15: C1, the catalog (decision 17)

**Files:** `lib/data/catalog.ts`, `lib/data/supabase/catalog.ts`, `lib/data/index.ts`, `lib/data/contract/catalog.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.**
- **`catalog.contract.ts`, behaviour:**
  - `world.hideListing("l-001")`: not in `getJustListed`, `searchListings` or `getListingIds`, and `getListingDetail("l-001")` is null;
  - `world.pauseShop(slug, "seller")`: the shop stays in `getSeller`, its listings' `availability` is `"paused"` on `getListingDetail`, it leaves `getSellerSlugs` and `getVerifiedSellers`, and its listings leave `getJustListed`;
  - `world.pauseShop(slug, "staff")`: `getSeller` is null and its listing pages are null;
  - a draft listing has no page.
- **`catalog.db.test.ts`, parity on the seed** for each of:
  - `getJustListed({ campus: "all", limit: 12 })` and `({ campus: "pretoria", limit: 6 })`;
  - `getCollectionListings` for every collection;
  - `getFreeAndSwaps`;
  - `getRelatedListings`;
  - `searchListings` for three queries (words, a category with a price filter, a campus);
  - `getListingDetail` for every listing id;
  - `getMoreFrom`;
  - `getListingIds`;
  - `getSeller` for every slug;
  - `getSellerSlugs`;
  - `getSellerListings`;
  - `getVerifiedSellers`;
  - `getListingsByIds`, with an unknown id included.

  Where the app doesn't sort (store order: `getListingIds`, `getSellerSlugs`), compare as sets.

**Implementation.**
- **`catalog.ts`:**
  - a `CatalogSource` type: `sellers: ReadonlyMap<string, SellerRow>`, `listings: ReadonlyMap<string, ListingRow>`, `statusOf(row: SellerRow): SellerStatus` and `pausedByStaff(row: SellerRow): boolean`;
  - `export function catalogOver(source)` returns `{ shopStatus, toListing, liveSellerRows, storefrontRow, sellerFor, listedListings, publicListing, publicListingIds }` with today's bodies, reading `source` instead of `sampleStore()`;
  - `sampleCatalog()` is `catalogOver` over the store;
  - each of today's 10 exports becomes a one-line wrapper with the same signature. `categoryPicture` and `toSeller` stay pure.
- **`lib/data/supabase/catalog.ts`:**
  - `catalogSnapshot()` is `"use cache"`, with `tagListings()` and `tagSellers()` (both: a seller write must refresh the snapshot itself, not only the readers around it; amendment 14). It runs `selectAll` through `forPublic()` on:
    - `shops` (the column grant's columns);
    - `storefronts` (`shop_id, status`);
    - `shop_pickup_points`;
    - `listings` with `listing_photos(position, photo_id, placeholder_src, alt)`;
  - it returns plain arrays, which are serialisable for the cache;
  - `catalogSourceFrom(snapshot)` builds `CatalogSource`:
    - shops by slug, with `ownerId: null` (anon can't read it; status comes from `storefronts`);
    - `image` from `image_photo_id` / `image_placeholder` / `image_alt` through `photoSrc`;
    - `pickupPointIds`;
    - `previousSlugs: []`;
    - listings with `sellerSlug` from `shop_id`, `photos` ordered by `position`, `createdAt = iso(first_published_at ?? created_at)` (the store's "first published" time; parity decides);
    - `statusOf` from the `storefronts` map;
    - `pausedByStaff` always false (RLS already leaves those shops out).
- **`index.ts`:**
  - `async function catalog(): Promise<Catalog> { if (!onSupabase()) return sampleCatalog(); const { catalogSnapshot, catalogSourceFrom } = await import("./supabase/catalog"); return catalogOver(catalogSourceFrom(await catalogSnapshot())); }`;
  - every reader that calls a catalog function calls it on `await catalog()`;
  - the tags stay first in each reader, as today, so `index.test.ts` passes unchanged.

**Commands:** `pnpm test` (`index.test.ts` and `catalog.test.ts` unchanged and passing), `supabase db reset`, `pnpm test:db`, `pnpm lint`, `pnpm typecheck`.

## Task 16: C1, Hub posts (public)

**Files:** `lib/data/hub-posts.ts`, `lib/data/supabase/hub-posts.ts`, `lib/data/index.ts`, `lib/data/contract/hub.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first:**
- **behaviour:**
  - `world.addRsvp("h-00x", "shopper")` adds one to that event's `going` in `getHubPost` and `getHubEvents`;
  - an unpublished post has no page and isn't in `getHubPostIds`.
- **parity:**
  - `getHubPosts` for each kind set, with two `from` dates;
  - `getHubEvents` for "all" and a campus;
  - `getHubPost` for every id;
  - `getHubPostIds` (as a set);
  - `getListedHubPostIds` with two dates.

**Implementation:**
- `hub-posts.ts` exports a pure `toHubPost(row, going)`, which today's private one becomes, unchanged in what it returns.
- `supabase/hub-posts.ts`:
  - `publishedPostRows()` is `"use cache"` with `tagHub()`, from `hub_cards` through `forPublic()`;
  - `campus_slug` goes through `campusFromDb`;
  - `image` is `cover_photo_id ? { src: "/photos/" + id, alt: "" } : { src: image_src ?? HUB_BANNER_IMAGE.src, alt: image_alt }`. Covers are served in C2: `/photos/[id]` must accept a uuid and refuse a cover of an unpublished post (step 2 review M4);
  - `going` is `going_now`;
  - `publishedAt` is `iso(published_at ?? created_at)`.
- `index.ts`'s five Hub readers each take `const posts = onSupabase() ? await (await import("./supabase/hub-posts")).publishedPosts() : publishedPosts();` after their tag.

**Commands:** as Task 15.

## Task 17: C1, requests (public) and the settle (decisions 1 to 3, 21)

**Files:** `lib/data/requests.ts`, `lib/data/supabase/requests.ts`, `lib/data/index.ts`, `lib/data/contract/requests.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.** Times are relative to the real clock, because the database caps `p_now` at `now()`.
- **Behaviour, `requests.contract.ts`:**
  - `world.addRequest({ asker: "asker", neededBy: today - 5 })` is absent from `getOpenRequests({ category: null, today })`, `getRequests` and `getListedRequestIds`;
  - `getRequest(id)` still returns it, `status: "open"`, with `closesOn = today - 1`;
  - `settleRequests(now)` returns 1, and the asker has one `request-update` notification with the "3 days after" words;
  - a second `settleRequests(now)` returns 0 and adds nothing;
  - after it, `getRequest(id).status` is `"closed"`;
  - a request whose closing day is the day after tomorrow:
    - `settleRequests` returns 0;
    - the asker has the reminder's words;
    - a second call adds nothing;
  - the 16 samples never close.
- **Parity, `requests.db.test.ts`, on the seed:**
  - `getOpenRequests` for null and each category, with today;
  - `getRequests({ campus, limit, today })` for "all" and a campus;
  - `getRequest` for every id;
  - `getRequestIds` (as a set);
  - `getListedRequestIds({ today })`.

**Implementation.**
- `supabase/requests.ts` (`server-only`):
  - `listedRequests(today)`: `request_cards` where `status = 'open'` and (`closes_on` is null or `closes_on > today`), through `forPublic()` and `selectAll`;
  - `publicRequest(id)` and `publicRequestIds()` from `request_cards`;
  - the mapper gives `LookingForRequest`, with `offers` from the view and `closesOn` from `closes_on`;
  - `settleRequests: typeof Sample.settleRequests = async (now) => { const { data, error } = await forServer().rpc("settle_requests", { p_now: now.toISOString() }); if (error) throw error; return data; }`.
- `requests.ts`: `settleRequests` gains `if (onSupabase()) return (await supabase()).settleRequests(now);` as its first line. The rest is unchanged.
- `index.ts`: the five request readers pick the twin after `tagRequests()`.
- Callers (`RequestBoard`, `LookingForRequests`, `ViewerOffers`, the composer, actions) are unchanged: they call `settleRequests(now)` after `connection()` or in an action, never inside `"use cache"`.

**Commands:** as Task 15.

## Task 18: C1, Featured (decisions 9 and 21)

**Files:** `lib/data/featured.ts`, `lib/data/supabase/featured.ts`, `lib/data/contract/featured.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.** The day is a fixed future date such as `"2031-03-10"`, so the tests never meet a real draw; the world's cleanup deletes its draws and pins.
- **Behaviour:**
  - `featuredFor("all", day)` returns at most 4 eligible sellers and records the row, so a second call returns the same;
  - with `world.recordDraw` on days −1, −3 and −5 (sellers a, c and b), the resting part comes back b, c, a (stage M's test, through the data layer);
  - a pin comes first;
  - a seller made ineligible after the draw drops out, and the place stays empty.
- **Parity:** `featuredFor` for "all" and two campuses on the same day, from an empty draw table, gives the same slugs in the same order.

**Implementation.**
- `supabase/featured.ts`, request-time:
  - `eligible` from `catalog()`'s snapshot: Verified, approved, something listed;
  - the campus's pins for the day, through `forServer()`, with `campus_slug` from `campusToDb`, ordered by `created_at`;
  - an existing draw for `(campus, day)`;
  - if there is none: the last 6 days' draws, walked back from yesterday, keeping each slug's latest day (shop ids mapped to slugs through the snapshot). Then `drawFeatured(...)`. Then `insert … on conflict (campus_slug, day) do nothing`, and a re-read, so two first views on the same day agree. Then `delete from featured_draws where day < day − 7` (open question 4: pins are kept);
  - it returns the row's sellers that are still eligible.
- `featured.ts`: `featuredFor` gains the one-line switch. `featuredChoices`, the pins and `listPins` stay sample until C5.

**Commands:** as Task 15.

## Task 19: C1, shop stats and badges (decision 21)

**Files:** `lib/data/shop-stats.ts`, `lib/data/badges.ts`, `lib/data/supabase/shop-stats.ts`, `lib/data/supabase/badges.ts`, `lib/data/contract/stats.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first:**
- **parity on the seed's conversations:**
  - `shopStats(slug, now)` for every shop with conversations;
  - `recentCounts(slug, 14, now)`;
  - `recalculateBadges(now)` returns the same changed slugs;
- **the database after recalculating:** each shop's `badge` is what the sample store holds after the same call. The world restores every badge in cleanup.

**Implementation.**
- `shop-stats.ts` exports its pure `counts(rows, enquiriesSince, salesSince, now)` and `soldAt`, unchanged.
- The twin reads conversations of the shop's id (resolved from the slug), `not seller_gone`, through `forServer()`. It maps the columns `listing_id`, `is_offer` (for `requestId`), `created_at`, `first_reply_at`, `status`, `completed_at` and `confirmed_at` to the fields `counts` reads, and calls `counts`.
- Badges' twin:
  - for each owned shop with a storefront or a pause (`forServer()`: shops joined to seller profiles and the owner's `created_at`), `earnedBadge(...)`;
  - updates `shops.badge` where it changed;
  - returns the changed slugs. The callers still expire `sellers`.

**Commands:** as Task 15.

## Task 20: C1 check, JS budget and docs

1. `lib/data/contract/sitemap.db.test.ts`: `parity(() => sitemap())` (`app/sitemap.ts`, with `connection` mocked and `siteUrl()` set) gives the same entries as sets.
2. `supabase db reset`; then:
   - `pnpm test` and `pnpm test:db`: all pass;
   - `pnpm lint` and `pnpm typecheck`: clean.
3. **The JS budget, three ways:**
   - `pnpm build` in sample mode, then `tests/e2e/performance.spec.ts` on a fresh server: every page's first-visit JavaScript equals stage M's to the byte (`/` 150,660 B; the listing forms 152,334 B);
   - `grep -l "supabase" .next/static/chunks/*.js` prints nothing, and neither does `grep -l "serviceWorker.register" .next/static/chunks/*.js` (CLAUDE.md);
   - `VOSSIE_BACKEND=supabase pnpm build` against the local stack (with the keys exported in the shell from `supabase status -o env`, never written to a file) builds every route as in sample mode, with:
     - the same route list in the build output;
     - no "unstable value" or clock warning while prerendering;
     - no cookies read inside a cache.

     If supabase-js reads the clock while prerendering, stop and report: the fix belongs in `lib/data/supabase/clients.ts`'s public client options, and the controller decides.
4. **Docs on the branch:**
   - this plan's ledger and "Changes made during the build";
   - the programme plan's C0 and C1 lines, and its "Changes made during the build".
5. **Lines for main at merge time**, prepared in the plan's changes section, not written into main:
   - **CLAUDE.md:**
     - "`VOSSIE_BACKEND` is read only by `lib/backend.ts`";
     - "a `lib/data` module's Supabase twin lives in `lib/data/supabase/`, is loaded with `import()` behind `onSupabase()`, and is typed `typeof` the sample function";
     - "public reads use `forPublic()` inside `"use cache"`; `forServer()` only in request-time code";
     - "contract tests: `lib/data/contract/*.test.ts` (sample) and `*.db.test.ts` (`pnpm test:db`, after `supabase db reset`)";
     - "production's reference rows and allowed domains come from migrations; the seed is sample content only".
   - **GO-LIVE section 6:**
     - tick the `requests.closed_by` / `reminded_for` / closing-day line, the `target_owner_id` line and the own-target re-check (database half);
     - add "Vercel builds with `VOSSIE_BACKEND=supabase` read the project at build time";
     - tick "Which email proves someone is a student?" in section 7 with Lama's answer.
   - **PROGRESS:** a section for step 2b and C0 to C1.

## Review

- One combined reviewer after Task 9 (Task 10).
- One after Task 13 (the harness, before any twin is built on it).
- One after Task 20, each read-only and time-boxed to about 25 minutes.
- The final one checks:
  - every Supabase twin against its sample function, line by line;
  - that every reader keeps its tags;
  - that no twin uses `forServer()` inside `"use cache"`;
  - that the boundaries test would catch a client import.

---

## Self-review

- **Coverage of the brief.**
  - **Stage L:**
    - closing columns: Tasks 2 and 3;
    - the rule as SQL: Task 2;
    - settle, notification and reminder under a lock: Task 3;
    - reopen clearing a passed date and restarting 30 days: Task 4;
    - `set_request_open`, `start_offer` and `save_request` matching GO-LIVE: Task 4;
    - `target_owner_id` with its fallback and deletion: Task 5;
    - every staff function's own gate: Task 6.
  - **Stage M:**
    - `remove_role`'s refusal in its lock order: Task 7;
    - Featured's resting order: decision 9 (TypeScript, why), built in Task 18.
  - **Production:** reference rows and domains, Task 1 (decisions 10 to 12).
  - **Seed and types:** Tasks 1 and 9.
  - **C0:** the switch in one place, the pattern, the contract approach and a viewer before phase B: Tasks 12 and 13.
  - **C1:** pickup points (14), the catalog with its 10 sync exports (15), Hub (16), requests and the settle (17), Featured (18), shop stats and badges (19), the sitemap (20), `'all'` and null (Task 12's helpers, used in 16 and 18), photos' addresses (Task 12's `photoSrc`, used in 15 and 16), and the JS budget (12's guard and 20's builds).
- **Checked against the code, not the brief:**
  - the closing rule reads `updatedAt`, which Hide and Show again also change. The SQL does the same, since `hide_request` and `show_request` set `updated_at`;
  - stage M's reminder is due from 2 days before and skips a request that closes on the same pass. The SQL closes first, then reminds only rows still open;
  - the app's report `own` falls back only when the target no longer "exists" by the app's own test, which `report_own_kind` copies kind by kind;
  - `approve_shop` names the account, not the shop, so its gate compares the account;
  - `remove_role`'s check comes after "no such role", as `removeRole` (`staff-accounts.ts:127-128`).
- **Found beyond the brief,** which changes the programme:
  - anon can't tell an approved shop from a seller-paused one, nor a sample request from an asker's, nor count offers or RSVPs per row. Hence decision 13's three views, and the closing day as a column;
  - `backend()` sat in a `server-only` module;
  - `staff_reports` needs `own`;
  - `featuredFor`, `settleRequests`, `shopStats` and badges need the admin client on public pages;
  - Supabase builds read the database;
  - Auth's verification limit shapes the test harness;
  - photo ids are uuids on Supabase, so C2's `/photos/[id]` must accept them.
- **Risks named:**
  - a generated column's function can't change in place (Task 2's note);
  - supabase-js and the prerender clock (Task 20's stop);
  - PostgREST's 1,000-row pages (`selectAll`);
  - an earlier pgTAP case with an admin acting on their own shop (Task 6's note);
  - mixed mode until C5 (the goal's last line).
- **No placeholders:**
  - every task names its files, its failing test, its implementation and its commands;
  - pgTAP counts are approximate ("about"): the implementer sets `plan(n)` exactly, and the ledger records it.
- **One writer per file:** the table above; `index.ts` is written by 14 to 17 in order, and `21_grants.test.sql` only in Task 8.

## Ledger

| Task | Status | Commit |
|---|---|---|
| 0 Baseline | done: HEAD `ec436f6`, pgTAP 1,976 (20 migrations), unit 2,701, lint and typecheck clean | |
| 1 Reference rows, domains | built, uncommitted: pgTAP 1,995 (24: 18; 05: 77), unit +6 | |
| 2 Closing schema | built, uncommitted: pgTAP 2,040 (25: 45) | |
| 3 Settle and job | built, uncommitted: pgTAP 2,088 (26: 48), unit +2 | |
| 4 Request functions | built, uncommitted: pgTAP 2,126 (27: 38); unit 2,709, lint and typecheck clean | |
| 5 Report target owner | built, uncommitted: pgTAP 2,157 (28: 31; 06's authenticated list +1) | |
| 6 Own-target gate | built, uncommitted: pgTAP 2,233 (29: 76); no earlier test changed | |
| 7 Own shop's mentor | built, uncommitted: pgTAP 2,250 (30: 17) | |
| 8 Public read views | built, uncommitted: pgTAP 2,277 (31: 27; 06 and 21 allowlists +1) | |
| 9 Seed, types, advisors | built, uncommitted: seed unchanged, types regenerated; pgTAP 2,277 (34 files, 24 migrations); advisors: no warning or error, info items all from earlier migrations; unit 2,709, lint and typecheck clean | |
| 10 Review of 2b | | |
| 11 Staging checkpoint 1b | waits on Lama | |
| 12 C0 plumbing | built, uncommitted: unit 2,737 (+28: backend 5, rows 15, boundaries 7, privacy +1); `pnpm test:db` "No test files found", exit 0; lint and typecheck clean | |
| 13 C0 harness | built, uncommitted: unit 2,740 (+3, smoke on the sample store); `pnpm test:db` 9 (smoke contract 3, clients and parity 6); lint and typecheck clean; no `supabase db reset` (the run leaves no account or row behind) | |
| 14 Pickup points | | |
| 15 Catalog | | |
| 16 Hub posts | | |
| 17 Requests | | |
| 18 Featured | | |
| 19 Shop stats, badges | | |
| 20 C1 check, docs | | |

## Changes made during the build

- Task 1: `SeedFixtures` loses `campuses` and `categories` (the seed no longer inserts them), so `scripts/make-seed.ts` drops their two imports. It keeps `pickupPoints`, now only to refuse a shop or listing on an unknown point (a new seed-sql test), since the rows come from the reference migration.
- Task 1: the old seed test "keeps phase A's 24 pickup points" moves to `scripts/reference-sql.test.ts` (same assertion, on the migration's SQL).
- Task 1: `24_reference_data.test.sql` calls `private.email_allowed` as the test role, as test 05 does, and checks that `supabase_auth_admin` may execute it: the test role can't `set role supabase_auth_admin` (permission denied). Its idempotence case re-runs the migration's own statements from `supabase_migrations.schema_migrations` (the CLI's record), after checking the four inserts are there.
- Task 1: `05_sign_in.test.sql` keeps a refresh case on the exact domain (`a@eduvos.com`, allowed) beside the flipped subdomain one, so it has 77 tests, not 76.
- Task 1: `.env.example`'s `VOSSIE_EMAIL_DOMAINS` comment named the default and the subdomain rule; it now says exact domains, `eduvos.com` and `vossie.net`.
- Task 2: `private.request_closing_day` writes the SAST day inline (`(updated at time zone 'Africa/Johannesburg')::date`, `sast_day`'s own body) instead of calling `private.sast_day`: the service role has no usage on the `private` schema, so a call by name inside the body failed when it wrote a request (amendment 4's case). The execute grant to `service_role` stays (the column refers to the function by oid).
- Task 3: `11_storage_and_jobs.test.sql`'s "each once" counted every `settle-%`/`sweep-%` job (4); `settle-requests` is a fifth, so it now counts the four by name. Not in Task 3's file list; one assertion.
- Task 4: found while testing, no change needed: between Task 2 and Task 4 the old `set_request_open` can't reopen a request the backfill gave `closed_by = 'asker'` (the one-way check refuses an open row with `closed_by`). Tasks 2 to 4 ship together, so production never runs that pair; staging's push (Task 11) applies them in one go.
- Task 5: `create_report` reads the owner after its `not-found` check, so only for a target that exists. `supabase db lint`'s one warning (`create_report`'s unused `p_target_title`) is inherited unchanged from the base definition, which never used it either.
- Task 6: no earlier test had an admin acting on a shop they own (16, 17, 18b and 22 checked), so none changed. `set_shop_verified`'s gate comes before its null-argument raise, as the table says (right after the role check) and as `verifySeller` checks ownership first; only `pin_shop`'s comes after its argument raises (amendment 7). Busi's calls and the setup for Adam's resume and show-again cases each run inside a savepoint that is rolled back; pgTAP keeps numbering through the rollback and pg_prove counts a `not ok` printed there (checked with a deliberate failure on a scratch copy), as `00_foundation` already relies on.
- Task 7: row locks aren't listed in `pg_locks` (they live in the row), so the lock cases read them with `pgrowlocks`, created inside the test's transaction and rolled back with it: the mentor's profile is held `For Update` and the admin's seller profile `For Share`. The order itself can't be observed in one session; it is the code's, for the review. The "waiting again" case sets the status to `pending` and keeps `approved_at` (its trigger keeps it once set).
- Task 8: `31_public_reads` also checks that an asker finds their own hidden request nowhere in `request_cards`, and a Hub-paused shop's owner finds no storefront, though the tables' policies let them read those rows: the views' own `where` clauses decide.
- Task 9: `pnpm db:seed` wrote an identical `seed.sql` (the generator never names `closed_by`; its default is null), so `seed-sql.ts` and its test are unchanged. Advisors on the local stack (`supabase db advisors --local --type all`): nothing at warn or error. At info, 23 items, none from this plan's migrations: 17 `unused_index` on an idle stack, 5 `rls_enabled_no_policy` (`private.code_sends`, `policy_versions`, `sign_in_attempts`, `public.featured_draws`, `shop_previous_slugs`) and 1 `unindexed_foreign_keys` (`consents_version_fkey`). The programme plan's step 2 gains the step 2b line.
- Task 12: `lib/data/boundaries.test.ts` reads imports itself (static, `import type`/`export type`, side-effect, `import()`, `require()`; the alias and relative paths) and pins that reading in three cases. Rules 2 and 4 also cover Supabase's packages (`@supabase/*`), and rule 2 `lib/supabase` as well as `./supabase/…`, so sample mode can't load Supabase code by any static path; rule 4 counts `import()` too and scans app, components, hooks, lib, scripts, tests and the root's files (test files aside, as the privacy guard does). Rule 4 lists no `lib/auth`: phase B's amendment 4 moves its Supabase code into `lib/data/supabase` behind `lib/data` façades, which settles amendment 10's question. Rule 3 covers `lib/supabase` (amendment 10); its six modules already start with `import "server-only";`.
- Task 12: `app/privacy/page.test.tsx`: the narrowed guard (amendment 9) reads through a new `cookieSetterImports` (the four modules by resolved path, with or without an extension, and `@supabase/ssr`), and one new test pins it, including that `public`, `admin` and `@supabase/supabase-js` aren't setters. `supabaseImports` and its test are unchanged.
- Task 12: `rows.ts`: `photoSrc` gives null when there's neither a photo nor a placeholder (a shop showing its category's picture: `shops.image_photo_id` and `image_placeholder` may both be null); `iso` throws on something that isn't a time; `selectAll(query, order)` applies the order itself, ascending, before each page's `range()`, and refuses an empty order (amendment 13); `SELECT_PAGE` is exported. A type test checks it takes PostgREST's own builder and keeps its row type. `clients.ts` exports `DbClient` (`ReturnType<typeof publicClient>`), and `forViewer()` is async, so it rejects.
- Task 12: `vitest.db.config.mts` had `passWithNoTests` (amendment 20) until Task 13, which removed it.
- Task 13: the spike worked: `generateLink({ type: "magiclink" })` gives `email_otp`, and `verifyOtp({ type: "email" })` on a cookieless publishable client returns a session with `amr` `[{ method: "otp" }]` and role `authenticated`, which the hook accepts; no email is sent, so the Mailpit fallback isn't needed. Found: `verifyOtp` keeps the session in the client's memory even with `persistSession: false`, so each verification gets a fresh client that nothing else uses.
- Task 13: `useViewer` is `setViewer`: the React hooks lint rule takes any `use…` function for a hook.
- Task 13: `eslint.config.mjs` (not in the file list): the Supabase import rule also ignores `tests/db/**`, the harness that boundaries rule 4 allows; without it `pnpm lint` fails on `tests/db/accounts.ts` and `viewer.ts`.
- Task 13: the `World` has its base members only (`name`, `signedIn`, `asViewer`, `cleanup`); each verb comes with the task whose scenario needs it, test first, so Tasks 14 to 18 also write `tests/contract/world.ts`, `tests/contract/sample-world.ts` and `tests/db/supabase-world.ts`. The order table doesn't say so yet, and it lets 18 and 19 run beside 16 and 17: the controller either runs those in order or merges the three files. The Supabase world gives verbs `admin` (the secret key's client) and `undoLater(undo)`; `cleanup()` runs every undo newest first and then throws if any failed.
- Task 13: `asViewer(name, read)` passes the account's id to `read`, since the sample functions take it as an argument (decision 20). The accounts: `contract-<name>@vossie.test`, first names Asker, Shopper and Staff, on Pretoria; `staff` holds the Admin role (`profiles.roles`), in both worlds (the sample world's ids are `acc-contract-<name>`).
- Task 13: `parity` returns both answers as they came, and the test normalises both sides (amendment 11's times, the pickup point ids, object keys too); it restores `VOSSIE_BACKEND` to what it was rather than unstubbing every variable. `smoke.db.test.ts` also checks that `forViewer()` throws outside `asViewer`, the undo order, and `getCampuses` through `parity`.

## Amendments on review (2026-10-21)

Checked against the code at `04aa943`, the local stack (PG 17.6, 20 migrations) and the phase B plan. Read-only: no reset, build or server. Where an amendment and the text above disagree, the amendment wins. The text above already carries the small fixes marked "(fixed in the text)".

1. **The controller's answers to the open questions.**
   - (1) Exact domains only, no subdomains: `vossie.net` and `eduvos.com`. See amendment 2.
   - (2) Changing `lib/auth/config.ts`'s default list now is fine (decision 12 stands).
   - (3) Settling follows CLAUDE.md as built: the board, the homepage section, the request page, the offer composer, the asker's reads, the request staff actions and the data download settle, from request-time code only. Task 17's callers stay unchanged; the nightly job is a backstop, not a replacement.
   - (4) Old Featured pins stay as rows; the draw reads only the pins for its own day, so it ignores ones that have passed. Task 18 never deletes pins (it may still delete draws older than 7 days).
   - (5) The 24 pickup points are sample places. They go into the reference migration for now. The migration's header comment says so, and Task 20's go-live lines add a GO-LIVE item: "Eduvos replaces the 24 sample pickup points (Hub: rename, retire, add)".

2. **Exact domains (blocker for Task 1 as written).** Both checks allow subdomains today: `private.email_allowed` (`20261015004614_sign_in.sql:146`, the `right(...) = '.' || domain` branch) and `checkEmail` (`lib/auth/email.ts:27`, `endsWith(".${allowed}")`). Task 1 gains:
   - a hand-written migration, `20261021120010_exact_email_domains.sql`, outside the generated file, which replaces `email_allowed` with the same shape check and `exists (select 1 from private.allowed_email_domains a where a.domain = address_domain)`. Its grants are restated as in the sign-in migration (`supabase_auth_admin` only);
   - `05_sign_in.test.sql`: the subdomain cases flip to refused (`:65` `a@students.eduvos.com`, `:104` its refresh, `:126` `a@x.eduvos.com`), and their descriptions change;
   - `lib/auth/email.ts`: `domains.some((allowed) => domain === allowed)`. In `email.test.ts`, the `:17-19` case becomes "accepts only an address at a listed domain", and `student.eduvos.com` is refused. `maskEmail`'s case is unchanged;
   - `24_reference_data.test.sql`: the subdomain cases are refused (fixed in the text).
   - **Phase B:** `lib/auth/config.ts` is phase B's Task 1 file too, so the two Task 1s run one after the other, and the second rebases on the first. `email.ts` isn't in phase B's file list; tell its controller.

3. **Task 2's `closed_by` check is one-way (blocker).** The two-way check refuses rows that existing tests make: `15_community_tables.test.sql:123` (`cm-closed`), `19_numbers.test.sql:156` (`nb-r4`), and test 18's `set_request_open(..., false)` (`:247`, `:271`) through the old function, until Task 4 replaces it. Use `closed_by is null or (status = 'closed' and asker_id is not null)` (fixed in the text). The backfill is unchanged. Task 4's tests pin that Close sets `'asker'` and that the settle sets `'auto'`.

4. **The generated column runs with the writer's rights.** A stored generated column's function is permission-checked for the role that inserts or updates. Task 13's Supabase world writes `requests` with the admin client, so grant execute on `private.request_closing_day` to `service_role` (fixed in the text; `sast_day` already has it). `25_requests_closing.test.sql` adds a case: `set local role service_role; insert into public.requests …` succeeds and computes `closes_on`.

5. **`create or replace view` drops options it isn't given.** It replaces the view's options with the ones in the statement, so without `with (security_invoker = true)` `my_requests` (Task 2) and `staff_reports` (Task 5) would run as their owner and skip RLS. Both statements restate it (fixed in the text). Tests 25 and 28 each assert `security_invoker=true` in `pg_class.reloptions` for the view they replace.

6. **`06_account_actions.test.sql` holds allowlists these tasks change.**
   - Task 3: `settle_requests(timestamp with time zone)` joins the service-role-only list (`:136`).
   - Task 5: `private.report_own_kind(uuid,uuid)` joins the authenticated private list (`:282`). `staff_reports` is `security_invoker`, so its caller needs execute. It's granted to `authenticated` and `service_role` and revoked from `public` and `anon` (fixed in the text). The private schema has no usage for API roles, so nobody can call it by name.
   - Task 8: `private.storefront_status(uuid)` joins the anon list (`:273`) and the authenticated list.
   - These three tasks write `06` in the order 3, 5, 8 (the order table is updated).

7. **`pin_shop`'s gate goes after the two argument raises and before `day-past`** (fixed in the text). Task 6's table covers every gate `lib/staff/admin-actions.ts` has. `hideReportedListing`, `hideReportedRequest` and `pauseReportedShop` reach `hide_listing`, `hide_request` and `staff_pause_shop`, whose gates read the target, and that agrees with the report view's `own` while the target exists.

8. **Task 3's text functions are `stable`, not `immutable`.** `to_char(timestamp, text)` is stable. Keep `'FMDD Mon'` (English without the `TM` prefix), and test "5 Nov" and "20 Oct" as in the text.

9. **The privacy guard fails at Task 12 (blocker).** `app/privacy/page.test.tsx:273-285` fails while `NOT_YET_SET` holds `vossie_auth` if any app, components, hooks or lib file outside `lib/supabase/` imports `lib/supabase` or `@supabase/*`. `lib/data/supabase/clients.ts` does.
   - C0 never imports `lib/supabase/viewer` (`forViewer()` throws until phase B; fixed in the text).
   - Task 12 narrows the guard: while `vossie_auth` is unnamed, nothing outside `lib/supabase/` imports `lib/supabase/viewer`, `lib/supabase/cookies`, `lib/supabase/auth` or `@supabase/ssr`, which are the only ways to set the cookie. Its third test (`supabaseImports`) is unchanged.
   - Phase B's Task 9 also writes this file, so the two run one after the other.
   - The controller confirms the edit, since it's a privacy guard.

10. **`boundaries.test.ts`.**
    - Rules 2 and 4 ignore `import type`.
    - Rule 4 lists phase B's files by name (`lib/data/auth-session.ts`, `lib/data/session-renewal.ts` and `proxy.ts` if they import `lib/supabase`), or phase B moves them under `lib/data/supabase/`. Settle this with phase B's reviewer before Task 12.
    - Add a rule: every file under `lib/supabase/` except `database.types.ts` and tests starts with `import "server-only";`. That rule, not the `"use client"` scan (which isn't transitive), is what keeps the admin client out of a client bundle. Task 20's chunk grep checks it.
    - Phase B names the switch `usesSupabase()`. This plan's `onSupabase()` is the one name, and phase B's Task 0 adopts it (its recheck 2 allows for that).

11. **Parity normalises timestamps.** 84 fixture timestamps (listings 38, Hub 30, requests 16) are written `…:00Z` with no milliseconds, while `iso()` gives `.000Z`. `normalise()` maps every ISO-8601 string to `new Date(s).toISOString()` on both sides. Decision 22's "the store writes .000Z" is true only of rows the app writes.

12. **Pickup points keep a stable order.** All 24 share `createdAt` (`POINTS_SINCE`).
    - The reference migration writes `created_at` from `samplePickupPointRows`, as the seed does today.
    - The twin orders by `campus_slug, created_at, name`, which gives the seed's library-then-reception order.
    - `campus_slug` order matches the fixtures, which are alphabetical with `online`, which has no points, last.

13. **`selectAll` pages over a stable order.** Every paged query has an `order()` on a unique key (id last), or `.range()` pages can skip or repeat rows. The stub test asserts it.

14. **Tags and the catalog snapshot.**
    - `catalogSnapshot()` carries `listings` and `sellers` (fixed in the text). A nested cache entry keeps its own tags, so a `sellersChanged()` must reach the snapshot itself.
    - The Featured and badges twins (Tasks 18 and 19) import `catalogSnapshot`, `catalogSourceFrom` and `catalogOver` directly, never `index.ts`, which imports `featured.ts` (a cycle).

15. **Staleness on Supabase, written down.** Writes the app doesn't make expire no tag: the nightly `settle-requests` job, the hourly `settle_auto_confirm` and dashboard edits. No reader sets `cacheLife`, so the default profile's revalidate (about 15 minutes) bounds them. Lists stay right anyway: the request readers filter by `today`, and the app's own settles expire `requests` when they close something. Task 20's go-live lines state the 15 minutes. The sample store has no writer outside the app, so this is new, not worse.

16. **Builds on an empty database (Lama or the controller decides when).**
    - The listing, seller, collection, request and Hub `generateStaticParams` return the cached readers' ids. On the live project after phase B's clean-up, that's an empty list, which a Cache Components build refuses (CLAUDE.md: at least one value).
    - The fix: each data-driven `generateStaticParams` falls back to one placeholder id when the list is empty, as `/sell/listings/[id]/edit` does. Unknown ids already call `notFound()`.
    - That's app code outside this plan's files. Either it becomes a small C1 task after Task 17, or it goes on GO-LIVE before phase B's Part B. Decision 23's note gains: "and the build needs `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; it never needs the secret key".

17. **Task 11's "staging" is the live project "Vossie Market"** (fixed in the text). `vossie.test` stays there until phase B's B3 script removes it. The push needs Lama's go-ahead for that run, as written.

18. **Reopen on a due, unsettled request.** Here the SQL answers `nothing` (the row is still `open`), but the app settles first (`lib/looking-for/actions.ts:80`) and then reopens. Task 4 adds a pgTAP case that pins this. C4's note: the request actions keep settling first on Supabase.

19. **Shared files with phase B.**
    - `lib/supabase/database.types.ts` is regenerated (`pnpm db:types`), never merged by hand, by whichever plan lands second.
    - Phase B numbers its migration and pgTAP files after this plan's last (`…120700`, `31_…`).
    - The other shared files: `app/privacy/page.test.tsx` (amendment 9), `lib/auth/config.ts` (amendment 2), and `supabase/config.toml` (untouched here).

20. **`vitest.db.config.mts`.**
    - It copies the unit config's `exclude` list (`.next`, `docs`, `vossie-audit`, `tests/e2e`).
    - It aliases `server-only` by absolute path: `fileURLToPath(new URL("./tests/db/empty.ts", import.meta.url))`.
    - `passWithNoTests: true` until Task 13.

21. **Fidelity confirmed, no change:**
    - `closingDay`'s examples and year edges (Task 2's test cases);
    - `sast_day` is immutable;
    - `closedAtFor` equals `closes_on::timestamp at time zone 'Africa/Johannesburg'`;
    - the reminder window and close-before-remind order;
    - the words (`words.ts:50-71`);
    - the `report_own_kind` fallback against `staff-reports.ts:94-105`;
    - `removeRole`'s own-shop-mentor check, which reads the seller profile whatever the shop's status;
    - Recheck 6's line numbers;
    - the status variable names (`API_URL`, `PUBLISHABLE_KEY`, `SECRET_KEY`);
    - anon can't read `shops.owner_id`, `requests.asker_id`, `hub_posts.author_id` or `featured_*`;
    - `forget_account` cascades requests, so the one-way check meets no orphaned `closed_by`.

### The controller's answers to the amendments (2026-10-21)
- **Amendment 9 confirmed:** Task 12 narrows the privacy guard exactly as written (only the modules that can set `vossie_auth` are banned outside `lib/supabase/` until the page names it). Phase B's Task 9 restores the full check by naming the cookie.
- **Amendment 16 becomes Task 17b** (after Task 17, before Task 18): each data-driven `generateStaticParams` (listings, sellers, collections, requests, Hub) falls back to one placeholder id when its list is empty, as `/sell/listings/[id]/edit` does, with a unit test per route that an empty reader still gives one value. The live project starts empty, so this can't wait for GO-LIVE.
- **Amendment 10:** `onSupabase()` is the one name; phase B's Task 0 adopts it.
- **Amendment 2:** exact domains only (`vossie.net`, `eduvos.com`), as Lama decided; no Eduvos subdomains are known.
- **Resend** (phase B amendment 21) changes nothing here.
