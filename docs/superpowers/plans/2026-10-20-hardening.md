# Vossie Hardening (Stage K, Sample Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build stage K as the spec `docs/superpowers/specs/2026-10-20-hardening-design.md` describes, with Lama's answers of 2026-10-20 folded in (plan decisions 1 to 5):
- a spike first reproduces stage D's sign-in replay on today's code;
- if it reproduces, the three posts that start a session (step 2's code, step 3's profile, the sample buttons) become plain HTML posts to Route Handlers that answer 303, so signing in always ends with a full page load;
- signing out ends with a full page load too (a `/logout` Route Handler, Lama's answer 2), whatever the spike finds;
- the three message forms refuse a 41st new conversation in 24 hours and a 121st message in an hour (Lama's answer 1), with the sample accounts exempt in sample mode;
- sign-in codes and tokens are hashed with HMAC-SHA-256 under `VOSSIE_AUTH_HMAC_KEY`;
- How it works, How trust works, Safety and the privacy policy say what's true after stages H to J.

Every form works without the app's JavaScript, and no public page gains a byte of JavaScript.

**Architecture:**
- **One shared check, three sign-in handlers and one sign-out handler.** `lib/auth/same-origin.ts` holds `isSameOrigin(request)`, `notFromVossie()` (the 403) and `seeOther(path)` (the 303). `app/logout/route.ts` (Task 2) and, if the spike holds, `app/login/code/route.ts`, `app/login/profile/route.ts` and `app/login/sample/route.ts` (Task 4) use them. Each answers `POST` (check, then read, then act, then 303) and `GET` (303 away).
- **The steps' logic leaves the Server Actions** (Task 3): `lib/auth/sign-in-finish.ts`, a plain module, holds the attempt helpers that `lib/auth/actions.ts` used privately and the three functions `finishCode`, `finishProfile` and `finishSample`, which return a path instead of redirecting. `lib/auth/actions.ts` keeps `startSignIn`, `resendCode`, `cancelSignIn`, `updateDetails` and `deleteAccount`.
- **The limits are server only** (Tasks 6 and 7): two counts in `lib/data/messages.ts`, `isSampleAccount` in `lib/auth/sample-accounts.ts`, `messageLimitErrors` in `lib/messaging/limits.ts`, called by `sendFirstMessage`, `sendReply` and `sendOffer`.
- **Keyed hashes** (Task 8): `lib/auth/secrets.ts` keeps its function names; `authKey()` reads the key on first use. `STORE_VERSION` 9 → 10.
- **Words only** on the four info pages (Task 9).
- **No new table, row, cookie or client component.** No edit to `app/layout.tsx` or `app/globals.css`, and no import of `lib/supabase` or `@supabase/*`. Existing e2e specs change only where a reload breaks one of their tests ("Before you start").

**Phase B builds on this.** The Supabase session's phase B (Supabase sign-in in `lib/auth`) starts only after this stage's Route Handler sign-in lands, and builds on it: the handlers, `sign-in-finish.ts`, `same-origin.ts` and `authKey()`. So every `lib/auth` change here is self-contained: no task imports `lib/supabase/*`, and no task changes a `lib/auth` export that this plan doesn't name.

**Tech Stack:** As stage J leaves it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5.9;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5.0 with Testing Library and jsdom;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-20-hardening-design.md` (committed `7e5df20`). "Spec 2.6" in this plan means its section 2, decision 6; "spec 4" means its section 4.
- **The stages this builds on:** D (`lib/auth/*`, the accounts spec), E (`lib/messaging/*`), H (`lib/looking-for/*`, community actions plan amendment 18), J (`docs/superpowers/plans/2026-10-20-staff-accounts-and-numbers.md`, "J's plan", whose conventions this plan copies, scratch copy included).
- **Where a plan and the code differ, the code at HEAD wins.** Every name, import and signature below was read from the code at `7e5df20` (with `6c71c0b`'s header work) on 2026-10-20; `84f61a1` changed none of them.
- **Next 16.4's own words** (`node_modules/next/dist/docs/01-app/`):
  - Route Handlers: `03-api-reference/03-file-conventions/route.md` ("Cookies", "Redirects") and `01-getting-started/15-route-handlers.md` ("With Cache Components": a `GET` that reads no request data is prerendered at build);
  - `cookies()` in a Route Handler: `03-api-reference/04-functions/cookies.md` (setting and deleting are allowed in Server Functions and Route Handlers);
  - `revalidateTag`: `03-api-reference/04-functions/revalidateTag.md`. Its 16.4 signature is `revalidateTag(tag: string, profile: string | { expire?: number }): void`. "Pass `{ expire: 0 }` to expire the data immediately" when `updateTag` isn't available, as in a Route Handler. The one-argument form is deprecated;
  - `updateTag`: `03-api-reference/04-functions/updateTag.md` (Server Actions only);
  - `connection()`: `03-api-reference/04-functions/connection.md`;
  - kept pages: `02-guides/preserving-ui-state.md`.
- **The go-live checklist:** `docs/reference/GO-LIVE.md`, section 6.
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`, decision 54 (Claude decides under Lama's standing goal); stage K's row is 78.

---

## Before you start

**This plan starts at `84f61a1`** (stage K's spec `7e5df20`, then the Supabase phase A merge) or later. Other sessions share the working tree:
- **The header and tab bar work is committed** (`6c71c0b`). `app/layout.tsx`, `app/globals.css`, `components/header/*`, `components/ui/NavLink*`, `components/tabbar/`, `components/icons*`, `tests/e2e/{a11y,accounts,messaging,screenshots,shell,shopping}.spec.ts` and `tests/e2e/helpers/messaging.ts` are no longer anyone's uncommitted edits. So:
  - **New tests still go in new spec files** (`sign-in-return.spec.ts`, `hardening-writes.spec.ts`); importing helpers from `tests/e2e/helpers/messaging.ts` is fine.
  - **An existing e2e test that breaks because sign-in or sign-out now reloads the page** (most likely in `accounts.spec.ts`, `messaging.spec.ts` or `a11y.spec.ts`) is fixed in its own file with the smallest change that keeps what it checks, and the change is listed in the hand-over and in "Changes made during the build". If keeping what it checks isn't possible (the toast-once test counts toasts across a soft Back, say), report it to the controller before changing it.
  - **`app/layout.tsx` and `app/globals.css` stay untouched**: nothing in this stage needs them.
  - The coordinator's message of 2026-10-20 replaces the brief's "never edit these files" rule; the recheck confirms they're still clean before a task edits one.
- **The Supabase phase A merge** (`84f61a1`) added `supabase/`, `lib/supabase/` and `scripts/seed-sql*`, and changed `package.json` (`@supabase/ssr`, `@supabase/supabase-js`, `server-only`), `eslint.config.mjs` (only `lib/data` and `lib/supabase` may import `lib/supabase` or `@supabase/*`), `.env.example` (a Supabase block that already lists `# VOSSIE_AUTH_HMAC_KEY=`) and `app/privacy/page.test.tsx` (it fails if anything outside `lib/supabase` imports it while `vossie_auth` is unnamed). **No stage K file imports `lib/supabase` or `@supabase/*`.** Its phase B waits for this stage's sign-in handlers (`docs/superpowers/plans/2026-10-20-supabase-phases-b-c.md`, the Supabase session's untracked file: read it if useful, never edit it).
- `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md` and `.claude/launch.json` carry other sessions' uncommitted lines. No task edits them; Task 11 writes snippets for the controller.

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. Never stage `.claude/launch.json` or any file this plan doesn't list.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed.
3. **Files this plan removes:** none. No task runs `rm` on a project file. The Server Actions `signOut`, `verifyCode`, `completeProfile` and `signInAsSample` leave `lib/auth/actions.ts` (their bodies move; Tasks 2 and 3).
4. **No new cookie or browser-storage name.** The privacy test's list of `vossie_…` names doesn't change. New code never writes a lowercase quoted `"vossie_…"` string: `app/privacy/page.test.tsx` collects those with `/"(vossie_[a-z_]+)"/g`. The key's name, `VOSSIE_AUTH_HMAC_KEY`, is upper case, so it isn't collected.
5. **A Playwright project that runs last of all** (Task 10): `hardening-writes`, after `staff-accounts-writes`.
6. **Sample wording.** The trust page's new section (Lama: "yes for now"), the Continue button, and the limits' error words are samples for Lama to change later. Plan decision 21 lists where they live.

No installs are needed by this plan. **If `package.json` or `pnpm-lock.yaml` changed at HEAD after the Supabase merge, and `node_modules` doesn't match** (`pnpm install --frozen-lockfile --offline` would change it, or `pnpm typecheck` fails on a missing module from `lib/supabase/`), stop and ask the controller. Implementers never run an install.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time, and only read-only ones (`git status`, `git diff`, `git log`, `git show`, `git archive`). Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` a project file.
- Never kill an install or build that is still running.
- **Stop only servers you started, by their PID** (`kill <pid>` for the `pnpm start` you launched, found with `lsof -ti tcp:3204` only after checking it's yours). Never `pkill`, never `killall`, never stop a server on 3100 (Lama's dev server) or 3200 (the shared e2e port).
- This stage builds, starts and runs e2e only in a scratch copy on **3204** (conventions, "The scratch copy").
- Before you edit a shared file (`lib/auth/*`, `lib/data/messages.ts`, `lib/data/store.ts`, `lib/data/tags.ts`, `lib/messaging/*`, `lib/looking-for/*`, `components/auth/*`, `components/menu/MenuAccount.tsx`, `components/account/AccountView.tsx`, `tests/helpers/next-request.ts`, `vitest.setup.ts`, `.env.example`, the four info pages, `tests/e2e/info.spec.ts`, `playwright.config.ts`, `CLAUDE.md`, `docs/*`), read its current text and edit by the exact lines that are there now. Never paste back a whole file from an older copy, except where a step gives a whole new file.

## Recheck before starting

Before Task 1, check each item, one command or file at a time, and write what you find in the ledger's "Start" row or a message to the controller. If something differs in a way a task's quoted code depends on, stop and report rather than guess.

1. **Git.** `git --no-optional-locks log --oneline -5` shows `84f61a1`, or later commits from other sessions. For each later commit, `git --no-optional-locks show --stat <hash>` and note any file this plan edits. `git --no-optional-locks status --short` shows only the other sessions' files (`.claude/launch.json`, `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md` and untracked docs).
2. **Files other work may hold.** Before a task edits any file, `git --no-optional-locks status --short <file>` prints nothing for it. If it's modified and not by this stage, that's another session at work: stop and report.
3. **Changed by the Supabase merge: re-read at HEAD before Task 8 and Task 9.**
   - `.env.example`: its Supabase block already has `# VOSSIE_AUTH_HMAC_KEY=`. Task 8 moves that line into a block of its own with stage K's explanation. Edit by the text that's there now.
   - `app/privacy/page.test.tsx`: it may now expect Supabase-related names or sentences. Task 9 adds tests to it and must keep every test that's there now. Note anything that looks like it conflicts with spec 6's sentences and report it before editing.
   - `eslint.config.mjs`: if its ignores or rules changed, run `pnpm lint` on a task's files as the task says and report any new rule that fires.
4. **The store.** `lib/data/store.ts` has `export const STORE_VERSION = 9;`. If the Supabase merge or another stage moved it, Task 8 adds one to whatever it is.
5. **Auth.** `lib/auth/actions.ts` exports `startSignIn`, `verifyCode`, `resendCode`, `cancelSignIn`, `completeProfile`, `signInAsSample`, `signOut`, `updateDetails`, `deleteAccount`, and has the private helpers `text`, `nextFrom`, `backToSignIn`, `afterSignIn`, `currentAttempt`, `endAttempt`, `beginAttempt`, `saveAfterPost`, `sendCode`, `finishSignIn`. `lib/auth/secrets.ts` uses `createHash`. `lib/auth/session.ts` exports `getSessionKey`, `getViewer`, `requireAccount`, `startSession`, `endSession`.
6. **Messaging.** `lib/messaging/rules.ts` has `DAY_MS` and `REPORTS_PER_DAY = 10`. `lib/messaging/errors.ts`'s `MESSAGES` map ends with `report-rate`. `lib/looking-for/actions.ts`'s `sendOffer` checks the message, then the scam words, then `countOffersSince` (in that order). `lib/looking-for/errors.ts`'s `offerErrors` sends every code but `offer-rate` to `messagingErrors`.
7. **Tests' stand-ins.** `tests/helpers/next-request.ts`'s `nextCache` has `refresh`, `updateTag`, `cacheTag`, `cacheLife` and no `revalidateTag`. `vitest.setup.ts` mocks `next/cache` with a `revalidateTag` that does nothing.
8. **Playwright.** `playwright.config.ts` line 3 is `const PORT = 3200;`, and the last project is `staff-accounts-writes`.
9. **The JS figures** (stage J's final ledger, 2026-10-20): `/` 150,591 B, `/browse` 151,338 B, listing 151,747 B, storefront 151,351 B, Saved 151,226 B, privacy 150,591 B, sign-in 150,591 B, new listing form (signed in) 152,265 B. The stop line is 152,305 B. Task 1 measures them again from HEAD.

## Where things stand (checked against the code on 2026-10-20)

| Area | Fact |
|---|---|
| Repo | `main` at `84f61a1` (stage K's spec, then Supabase phase A), stages D to J built |
| Sign-in | `/login` (`app/login/page.tsx`) renders `SignIn` inside `<Suspense>` and already passes it `next`. Every step is a Server Component form posting to a Server Action in `lib/auth/actions.ts`. A step's errors live on the attempt row (`SignInAttemptRow.errors`, stamped `postedAt`), not in form state: there is no session yet. No sign-in form carries a one-time token. `next` is a hidden field, checked with `safeNextPath` on every post |
| Sessions | `vossie_session` holds a random UUID; the store keeps `hashToken(token)` (SHA-256). Form state is keyed by that hash (`getSessionKey()`) |
| Sign-out | `signOut` (Server Action): `endSession()`, `setFlash("signed-out")`, `redirect("/")`. Posted from `components/menu/MenuAccount.tsx` and `components/account/AccountView.tsx` |
| Route Handlers | One exists: `app/account/privacy/export/route.ts` (`GET`, reads the session), with a unit test that mocks `next/headers` through `tests/helpers/next-request.ts`; and `app/mentor/export/route.ts` |
| Origin check | Next's Server Action check (`action-handler.js`) compares the `Origin` header's host with the first `x-forwarded-host`, else `host`; it lets a missing `Origin` through with a warning. Route Handlers get no check |
| Messaging | `startConversation` joins the buyer's existing conversation (`findRow`) or makes one; offers (`startOffer`) carry `requestId`. A message row has `from: "buyer" \| "seller"`; a seller's side is the shop (`sellerSlug`), owned through `sellerProfiles`. `countReportsSince` and `countOffersSince` count rows strictly after `since` |
| Sample accounts | `data/fixtures/accounts.ts`'s `sampleAccounts`: student, seller (Tech corner), pending, mentor, admin `@eduvos.com` |
| Tests | Vitest runs in jsdom (`vitest.setup.ts` touches `window`), so a test can't switch to the node environment; Node's `Request`, `Response` and `Headers` are still there, `FormData` is jsdom's |
| e2e | One `next start` per run; five device projects, then `selling-writes`, `staff-writes`, `community-writes`, `alerts-writes`, `staff-accounts-writes` |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. "Plan decision N" means this list; "spec 2.N" means the spec's decisions.

**Lama's answers to the spec's open questions (Lama, 2026-10-20).** The docs task brings spec section 10 and "Changes on plan review and build" in line with these.

1. **The limits are 40 and 120** (Lama, 2026-10-20; spec 10.1). `CONVERSATIONS_PER_DAY = 40` new conversations in any 24 hours (offers still left out) and `MESSAGES_PER_HOUR = 120` messages in any hour. The words: "You've started 40 conversations in the last 24 hours. You can still reply in those. Try again later to start a new one." and "You've sent 120 messages in the last hour. Try again later.", built from the constants. The e2e test sends 40 and is refused on the 41st.
2. **Signing out ends with a full page load too** (Lama, 2026-10-20; spec 10.2, moving out of spec 8). A `/logout` Route Handler: `POST` only does anything; `isSameOrigin` first (403 otherwise); `endSession()`, `setFlash("signed-out")` (the homepage toast as today); 303 to `/`. `GET` answers 303 to `/` and does nothing else (a link can't sign anyone out). `MenuAccount` and `AccountView` post `<form action="/logout" method="post">`. **`signOut` leaves `lib/auth/actions.ts`**: nothing else calls it, and an exported Server Action is an endpoint anyone can post to. Built in Task 2, **whatever the spike finds**: it rests on the kept-pages privacy point (spec 8), not on the replay. Account deletion stays a Server Action (not asked).
3. **Reporting the kept-redirect behaviour to Next.js** (Lama, 2026-10-20; spec 10.3): only if necessary. Nothing to build; Task 11 adds an optional go-live note, and the spike's spec file is the reproduction if it's ever needed.
4. **`VOSSIE_AUTH_HMAC_KEY` on the Vercel preview** (Lama, 2026-10-20; spec 10.4): only if needed. The preview runs on the development key with its warning; Task 11 keeps the go-live item to set it before real accounts.
5. **The trust page's new section** (Lama, 2026-10-20; spec 10.5): "yes for now". The spec's sentences go in as written, marked as sample wording for later review (a comment above the section, and plan decision 21).

**The spike and sign-in.**

6. **The spike's stop rule is the spec's (spec 2.6), on variants 1 to 4.** Task 1 runs `tests/e2e/sign-in-return.spec.ts` on HEAD with `SIGN_IN_SPIKE=1` at `phone-390` and `desktop-1440`. Variants 1 to 4 (client navigations) decide it; variants 5 and 6 are controls that should pass on HEAD; 7, 8 and the Continue axe check need the fix to exist, so they're expected to fail on HEAD and decide nothing. Three outcomes:
   - **Confirmed:** a client-navigation variant ends stranded on `/login` while the sign-in post's response carries the gated page's own heading. Tasks 3 to 5 go ahead.
   - **Server-side cause:** a variant fails and the response carries a redirect to `/login`. Tasks 3 to 5 still go ahead (the 303's request carries the new cookie), and "Changes made during the build" records the different cause.
   - **Not reproduced:** no variant 1 to 4 fails, at either size. Tasks 3 to 5 are skipped, `SIGN_IN_ENDS_IN_A_PAGE_LOAD` stays `false`, CLAUDE.md's two sign-in lines don't change, the go-live item stays open with the spike's findings, and Task 11 says so. Tasks 2 and 6 to 11 go ahead.
7. **The spike's spec file is committed either way, gated by two constants.** `SIGN_IN_ENDS_IN_A_PAGE_LOAD` and `SIGN_OUT_ENDS_IN_A_PAGE_LOAD` start `false`. A test that needs the fix calls `needsTheFix(constant)`, which skips it unless the constant is true **or** `SIGN_IN_SPIKE=1` is set, so a normal run on HEAD skips them and the spike runs them all. Task 2 flips the sign-out constant; Task 5 flips the sign-in one. If the stop rule fires, the sign-in constant stays `false` and the file is the reproduction (plan decision 3). The controls (variants 5 and 6) and the layout-shift check always run.
8. **The steps' logic moves to a plain module, `lib/auth/sign-in-finish.ts`** (spec 3, "Data and code"). The helpers `actions.ts` keeps private (`currentAttempt`, `beginAttempt`, `sendCode`…) can't simply be exported from a `"use server"` file: every exported async function there becomes an endpoint anyone can post to. So they move, exported, to `sign-in-finish.ts`, and `actions.ts` imports them for `startSignIn`, `resendCode` and `cancelSignIn`. `backToSignIn` and `afterSignIn` become `signInPath(next)` and `afterSignInPath(next)`, which return paths. The three finish functions take `(formData, now)` and return a path, never redirect.
9. **What a Route Handler does about form state, `next` and one-time tokens.**
   - **Errors:** a step's errors are already on the attempt row (`attempt.errors`, `postedAt`), keyed by the `vossie_signin` cookie's hash, which the handler reads through `cookies()` exactly as the action did. No form state (there's no session yet), so nothing changes.
   - **`next`:** the hidden field, read from `request.formData()` and checked with `safeNextPath` (`nextFrom`), as now.
   - **One-time tokens:** no sign-in form carries one (`lib/staff/once.ts` is for signed-in create forms). A second press of Sign in finds the attempt gone and lands on `/login`, signed in, which shows the signed-in note: harmless.
10. **The handlers' responses.** `seeOther(path)`: status 303, `Location` a relative path, `Cache-Control: no-store`, no body. `notFromVossie()`: status 403, `text/plain; charset=utf-8`, "This form must be sent from Vossie.". Each `GET` calls `await connection()` first: with Cache Components a `GET` that reads no request data is prerendered at build, and a 303 has no reason to be a static file.
11. **`isSameOrigin` refuses a missing `Origin` and `Origin: null`** (spec 2.3). That's stricter than Next's Server Action check, which lets a missing `Origin` through with a warning. Browsers send `Origin` on every form post, so a real visitor never meets it. It takes `Pick<Request, "headers">`, so its unit test needs no real `Request`.
12. **`SignedInNote` shows Continue only when `next` is safe, isn't under `/login`, and isn't `/account`** (spec 2.5). For `next=/account`, "Your account" already goes there. With Continue, Continue is the primary button and "Your account" the outline one; the two sit in a `flex flex-col gap-3` column (Tailwind utilities; no edit to `app/globals.css`). The paths the forms post to live in `lib/auth/post-paths.ts`, so components never import server modules for a string.
13. **`sellersChangedNow()`** (spec 2.4) calls `revalidateTag(SELLERS_TAG, { expire: 0 })`. `tests/helpers/next-request.ts`'s `nextCache` gains a `revalidateTag` that records `{ tag, profile }` in `request.revalidatedTags`, which `resetRequest` clears.

**The message limits.**

14. **The order of checks** (spec 2.9). In `sendFirstMessage` and `sendReply`: fields, then the limits, then the scam words. In `sendOffer`: fields, then the shop's 20 offers a day, then the hour's messages, then the scam words. **This moves `offer-rate` before the scam check** (at HEAD it comes after): spec 2.9 wants "a refusal never follows a Check this before you send", and its "after the shop's 20 offers a day" puts the message limit after `offer-rate`. A test pins the new order.
15. **`messageLimitErrors(account, { newConversation }, now)` is async** (it awaits the counts) and returns at most one code: the conversations limit first, only for a new conversation. `newConversation` in `sendFirstMessage` is `(await findConversation(account.id, target)) === null`.
16. **Unit tests of the actions mock `isSampleAccount` to `false`.** The sample seller (`acc-seller`) owns Tech corner, the only shop that can offer or reply as a seller in the fixtures, and is exempt in sample mode. The action tests mock `@/lib/auth/sample-accounts` with a hoisted flag; `limits.test.ts` and `sample-accounts.test.ts` test the real exemption both ways. Limits are reached by seeding rows straight into the store (`sampleStore().conversations` and `.messages`), not by 40 posts.
17. **`lib/looking-for/errors.ts` doesn't change** (spec 4 "Words" says it gains `message-rate`). `offerErrors` already hands every code but `offer-rate` to `messagingErrors`, so `message-rate` in messaging's map reaches the offer composer. A test proves it.

**Keyed hashes.**

18. **`authKey()` caches only a usable key.** A short key and "unset with sample mode off" throw every time they're met, and nothing is cached. The development key is cached after its one warning, so the warning comes once per process. An empty `VOSSIE_AUTH_HMAC_KEY` counts as unset. Tests import a fresh module (`vi.resetModules()`) per case.
19. **Unit tests get a key of their own.** `vitest.setup.ts` sets `process.env.VOSSIE_AUTH_HMAC_KEY` to a fixed 40-character test key when it's unset, so the development key's warning doesn't print once per test file. `secrets.test.ts` unsets it where a test needs that. Nothing outside tests reads the test key.

**Info pages, tests, records.**

20. **Spec 6's sentences go in as written,** with three test changes the spec missed: `app/trust/page.test.tsx` ("four sections" → five), `app/safety/page.test.tsx` (its old "Every listing and every seller's page has a Report link" sentence) and `tests/e2e/info.spec.ts` (the trust page's section list). The spec's key phrase "saved a search" doesn't occur in its own How it works sentences; the test uses "save a search and hear when a new listing matches it". `updated` on each changed page is the day Task 9 is built (`2026-10-20` below; use the real day, SAST).
21. **Wording the spec doesn't give, or Lama keeps as a sample:** the Continue button (`components/auth/SignInSteps.tsx`), the trust page's "When something is reported" (`app/trust/page.tsx`, Lama "yes for now"), and the two limit messages (`lib/messaging/errors.ts`).
22. **End to end** (spec 3 "Tests", 4 "Tests").
    - `tests/e2e/sign-in-return.spec.ts` runs in the device projects, at `phone-390` and `desktop-1440` only (`onlyAt`). It signs in as sample accounts and fresh accounts, signs out, and writes nothing else.
    - `tests/e2e/hardening-writes.spec.ts` runs in a new project, `hardening-writes` (desktop 1440), after `staff-accounts-writes`. It messages 40 targets (open listings, then shops' question composers, skipping any that a test before it hid or paused), is refused on the 41st with the app's JavaScript blocked, runs axe there, then replies in one of its threads.
    - Axe on the info pages is already in `tests/e2e/a11y.spec.ts` (all six, every device project), and on `/login`'s signed-in note (`a11y.spec.ts`, "/login?next=%2Fsellers%2Ftech-corner"), which now shows Continue too. The new axe checks (the note with Continue; the composer at the limit) go in the two new files.
23. **The scratch copy** is J's (conventions), with port 3204 on line 3.
24. **Where tests run.** A task's own unit tests run in the working tree (`pnpm test <files>`). The whole unit suite, `pnpm lint` and `pnpm typecheck` run in the scratch copy.

## Amendments on review

The controller adds amendments here; they override the tasks below wherever they differ.

(none yet)

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec 3 "Performance"):** **public pages don't move by a byte, `/login` included.** If any figure changes from the Start row, stop after that task and find out why before going on. If any page passes the stop line (152,305 B), stop and report.
- **Where bytes could move:** nowhere, by design. A form's `action` changing from a Server Action reference to a string changes the HTML (a hidden `$ACTION_ID_…` input goes) and no JavaScript. `MenuAccount` is on every page (Task 2), so Task 2 measures every page; Task 5 measures `/login`.
- **Recording.** In the scratch copy, `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` prints each page's `scriptBrotli`. Task 1 runs it for the Start row (HEAD, nothing copied in), Task 2 after sign-out moves, Task 5 after the sign-in forms move, Task 10 at the end, and the controller at Task 11.

**As built** (fill in during the build):

| Point | `/` | `/browse` | Listing | Storefront | Saved | Privacy | Sign-in | New listing form (signed in) |
|---|---|---|---|---|---|---|---|---|
| J's final figures (2026-10-20) | 150,591 | 151,338 | 151,747 | 151,351 | 151,226 | 150,591 | 150,591 | 152,265 |
| Start (Task 1, from HEAD `<hash>`) | | | | | | | | |
| Task 2, sign-out posts to `/logout` | | | | | | | | |
| Task 5, sign-in posts to the handlers | | | | | | | | |
| Task 10, the stage's checks | | | | | | | | |
| **Final (Task 11)** | | | | | | | | |

The stop line used: 152,305 B (decision 52). Unit tests at the start: `<count>` in `<files>` files at HEAD. End to end at the start: J's final run (1,277 passed, 1,159 skipped).

## Changes made during the build

Written in Task 11 from `git log` and the code. Where an entry differs from the tasks below, the entry wins.

(none yet)

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there unless a step says to run them in the scratch copy (`$S`).
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, comments in plain English. No formatter: match the file you're in.
- **Server or client.** This plan adds **no** client component and changes none. `lib/auth/actions.ts`, `lib/messaging/actions.ts` and `lib/looking-for/actions.ts` start with `"use server"`: everything they export must be an async function, and nothing helper-like is exported from them (plan decision 8). New `lib/` modules have no directive.
- **Next APIs.** Read the page in `node_modules/next/dist/docs/01-app/` before using an API ("Sources"). The first task that uses one says so in its first step.
- **Route Handlers.** `export async function POST(request: Request)` and `export async function GET()`. `isSameOrigin(request)` before anything reads the body or a cookie. Set and delete cookies only through `lib/auth/cookies.ts` and `lib/auth/session.ts`. Read the clock with `new Date()` only inside `POST` (never prerendered). Never `redirect()` from `next/navigation` in them: they return `seeOther(path)`.
- **Clock and randomness.** No `Date.now()`, `new Date()`, `Math.random()` or `crypto.random*` while prerendering. Data functions take `now` from their caller.
- **Server Actions.** Identity only from the session (`requireAccount`). A refusal writes form state with what was typed and goes back with `RedirectType.replace`; every write ends with `done()`.
- **Forms.** Every form works without the app's JavaScript. A form whose `action` is a string has `method="post"`. Errors use D's `ErrorSummary` and `FieldError`.
- **Links.** The two anchors on the signed-in note are plain `<a>`, on purpose (spec 2.5): no `Link`, no prefetch.
- **JSX text.** `react/no-unescaped-entities` is on: `&apos;` for an apostrophe in JSX text.
- **Server code in tests.** D's `tests/helpers/next-request.ts` (`nextHeaders`, `nextNavigation`, `nextServer`, `nextCache`, `redirectOf`, `redirectSignalOf`, `resetRequest`) and G's `tests/helpers/staff.ts` (`STAFF_NOW`, `signedInAs`, `form`); `resetSampleStore()` and `resetRequest(request)` in `beforeEach`; fake only the date (`vi.useFakeTimers({ toFake: ["Date"] })`). Route Handler tests build a stand-in request (`{ headers: new Headers(…), formData: async () => form(…) } as unknown as Request`), because jsdom's `FormData` can't be a `Request` body.
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git --no-optional-locks status --short` on its own, and checks that the listed files changed and nothing else of this stage's did;
  2. runs `git add` with the listed files, by name;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.

### The scratch copy (builds, `pnpm start`, e2e, the whole unit suite, lint and typecheck)

Other sessions share the working tree, so nothing builds or starts there. Every task that builds makes a fresh copy of the committed code, adds its own changed files, and works in that:

```bash
# 1. A new, empty folder in your scratchpad (never reuse or delete one). <N> is the task's number.
S="<your scratchpad>/vossie-k-task<N>"
mkdir "$S"
# 2. The committed code (read-only git), then node_modules as an APFS clone.
git -C /Users/LamaNkuna/Projects/Vossie --no-optional-locks archive HEAD | tar -x -C "$S"
cp -cR /Users/LamaNkuna/Projects/Vossie/node_modules "$S/node_modules"
# 3. This task's own changed and new files, one line each, quoted. Never the other sessions' files. For example:
mkdir -p "$S/app/logout" && cp "app/logout/route.ts" "$S/app/logout/route.ts"
# 4. The e2e server's port.
sed -i '' 's/^const PORT = 3200;$/const PORT = 3204;/' "$S/playwright.config.ts"
grep -n "^const PORT" "$S/playwright.config.ts"
```

Expected from the last command: `3:const PORT = 3204;`.

Then, from `$S`: `pnpm build`, `pnpm start --port 3204`, `pnpm e2e …` (which builds and starts its own server on 3204), `pnpm test`, `pnpm lint`, `pnpm typecheck`. Before `pnpm e2e`, check nothing is on 3204: `lsof -ti tcp:3204` prints nothing. A `pnpm start` you start yourself is yours: note its PID and stop it with `kill <pid>` when you're done. Never `pkill` or `killall`.

## File map (end of this plan)

New files are marked **+**, changed **~**. Tasks 3 to 5 apply only if the spike holds (plan decision 6).

```
app/
  logout/route.ts  route.test.ts                                + sign-out (Task 2)
  login/code/route.ts  profile/route.ts  sample/route.ts (+ tests) + (Task 4)
  how-it-works/page.tsx  trust/page.tsx  safety/page.tsx  privacy/page.tsx (+ tests) ~ words (Task 9)
components/
  menu/MenuAccount.tsx (+ test)  account/AccountView.tsx (+ test) ~ post to /logout (Task 2)
  auth/SignInSteps.tsx  SignIn.tsx (+ tests)                    ~ string actions, SignedInNote (Task 5)
lib/
  auth/same-origin.ts (+ test)                                  + (Task 2)
  auth/post-paths.ts                                            + (Task 2: SIGN_OUT_PATH; Task 4: the sign-in posts)
  auth/actions.ts                                               ~ loses signOut (Task 2), the three steps (Task 3)
  auth/sign-in-finish.ts (+ test)                               + (Task 3)
  auth/sign-in-actions.test.ts                                  ~ (Task 3)
  auth/sample-accounts.ts (+ test)                              + (Task 6)
  auth/secrets.ts (+ test)  session.test.ts                     ~ (Task 8)
  data/tags.ts (+ test)                                         ~ sellersChangedNow (Task 4)
  data/messages.ts (+ test)                                     ~ the two counts (Task 6)
  data/store.ts                                                 ~ STORE_VERSION (Task 8)
  messaging/rules.ts  errors.ts (+ tests)                       ~ (Task 6)
  messaging/limits.ts (+ test)                                  + (Task 6)
  messaging/actions.ts (+ test)                                 ~ (Task 7)
  looking-for/actions.ts (+ test)  errors.test.ts               ~ (Task 7)
tests/helpers/next-request.ts                                   ~ revalidateTag (Task 4)
vitest.setup.ts  .env.example                                   ~ (Task 8)
playwright.config.ts                                            ~ hardening-writes (Task 10)
tests/e2e/
  sign-in-return.spec.ts                                        + (Task 1; constants flipped in Tasks 2 and 5)
  hardening-writes.spec.ts                                      + (Task 10)
  info.spec.ts                                                  ~ the trust page's sections (Task 9)
docs/reference/GO-LIVE.md  CLAUDE.md  the spec  this plan       ~ (Task 11)
```

**Tasks that touch the same files:** Tasks 2 and 3 (`lib/auth/actions.ts`), Tasks 2 and 4 (`lib/auth/post-paths.ts`), Tasks 2 and 5 (`sign-in-return.spec.ts`'s constants), Tasks 6 and 7 (`lib/messaging/*`). Run them in order.

**Suggested pairs for implementers:** Task 1 alone; Task 2 alone; Tasks 3 and 4; Task 5 alone; Tasks 6 and 7; Task 8 alone; Task 9 alone; Task 10 alone; Task 11 alone.

## Where each spec decision is built

| Spec | Built in |
|---|---|
| 2.1 The mechanism (a kept page's redirect) | Task 1 checks it (plan decision 6) |
| 2.2 Three posts become Route Handlers answering 303 | Tasks 3 (logic), 4 (handlers), 5 (forms) |
| 2.3 The same-origin check, 403, `GET` → 303 | Task 2 (`isSameOrigin`; plan decisions 10 and 11), Task 4 |
| 2.4 `sellersChangedNow()` | Task 4 (plan decision 13) |
| 2.5 Continue and Your account as plain anchors | Task 5 (plan decision 12) |
| 2.6 The spike and its stop rule | Task 1 (plan decisions 6 and 7) |
| 2.7 Session-following links stay; CLAUDE.md softens | Task 11 (only if the spike holds) |
| 2.8 Two limits per account | Task 6 (plan decision 1: 40 and 120) |
| 2.9 Where and in what order | Task 7 (plan decisions 14 and 15) |
| 2.10 Sample accounts exempt in sample mode | Task 6 (`isSampleAccount`), Task 7 (plan decision 16) |
| 2.11 Counting with the write on the real backend | Task 11 (GO-LIVE) |
| 2.12 to 2.15 Keyed hashes, the key, `STORE_VERSION` | Task 8 (plan decisions 18 and 19) |
| 2.16, 2.17 The info pages' words and dates | Task 9 (plan decision 20) |
| 3 Item 1 | Tasks 1 to 5 |
| 4 Item 2 | Tasks 6, 7, 10 |
| 5 Item 3 | Task 8 |
| 6 Item 4 | Task 9 |
| 8 Not in this stage | Sign-out moves in (plan decision 2), Task 2 |
| 9 Go-live changes | Task 11 |
| 10 Open questions | Plan decisions 1 to 5; Task 11 |

---

### Task 1: The spike: does the replay reproduce on today's code, and which way?

Spec 2.6's stop rule, before anything changes. Write the reproduction tests, run them on HEAD in a scratch copy with `SIGN_IN_SPIKE=1`, read the log, and report one of the three outcomes in plan decision 6. Also measure the ledger's Start row.

**Files:**
- Create: `tests/e2e/sign-in-return.spec.ts`

- [ ] **Step 1: Read Next's words on it**

Read `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` and `03-api-reference/04-functions/cacheLife.md` ("Client cache behavior"). Note in your report anything that contradicts spec 2.1.

- [ ] **Step 2: Measure the Start row, from HEAD, before changing anything**

Make the scratch copy (conventions) with **no** files copied in: `S="<your scratchpad>/vossie-k-task1-start"`. From `$S`:

```bash
pnpm e2e tests/e2e/performance.spec.ts --project=phone-390
pnpm test 2>&1 | tail -5
```

Expected: every test passes; one line per page such as `homepage: {"script":…,"scriptBrotli":150591}`. Write the `scriptBrotli` figures for homepage, browse page, listing page, storefront, Saved page, privacy page, sign-in page and new listing form (signed in) into your report, and the unit count (tests and files).

- [ ] **Step 3: Write the reproduction tests**

Create `tests/e2e/sign-in-return.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { button, field, main, newBuyer, onlyAt, project, signInAsSample, signUpHere } from "./helpers/messaging";
import { POST_LANDS } from "./helpers/selling";
import { expectStill, holdFonts, recordShifts } from "./helpers/shifts";

// Stage K's sign-in and sign-out tests (spec section 3 "Tests", decision 6; plan decisions 6, 7 and 22). They run in
// the device projects at 390 and 1440px, sign in as sample accounts and fresh ones, sign out, and write nothing else.

/**
 * Whether the posts that start a session end with a full page load (plan Task 5). Until then the tests of the fix
 * skip, unless SIGN_IN_SPIKE=1, which runs them on today's code as the spike's reproduction (plan Task 1).
 */
const SIGN_IN_ENDS_IN_A_PAGE_LOAD = false;
/** Whether signing out ends with a full page load (plan Task 2; Lama, 2026-10-20). */
const SIGN_OUT_ENDS_IN_A_PAGE_LOAD = false;
const SPIKE = process.env.SIGN_IN_SPIKE === "1";

function needsTheFix(built: boolean) {
  test.skip(!built && !SPIKE, "Needs stage K's fix; SIGN_IN_SPIKE=1 runs it anyway");
}

type NextWindow = { next?: { router?: { push: (href: string) => void; prefetch: (href: string) => void } } };

/** Waits until the app's router is there, so a push is a client navigation. */
async function hydrated(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as NextWindow).next?.router));
}

/** A client navigation, as a <Link> makes, without needing a link on the page (messaging.spec.ts does the same). */
async function push(page: Page, href: string) {
  await page.evaluate((target) => (window as unknown as NextWindow).next!.router!.push(target), href);
}

async function prefetch(page: Page, href: string) {
  await page.evaluate((target) => (window as unknown as NextWindow).next!.router!.prefetch(target), href);
}

const GATED_HEADINGS = ["Ask for what you need", "Your account", "Message "];

/**
 * For the spike's report: every address the page passes through, and each POST's answer (its status, Location,
 * Next's x-action-redirect, and whether its body carries a gated page's heading or a redirect to sign-in).
 */
function watch(page: Page, label: string): () => void {
  const urls: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) urls.push(frame.url());
  });
  page.on("response", async (response) => {
    const request = response.request();
    if (request.method() !== "POST") return;
    const url = new URL(request.url());
    const body = response.status() >= 300 && response.status() < 400 ? "" : await response.text().catch(() => "");
    const headers = response.headers();
    console.log(
      `${label} [${project()}] POST ${url.pathname}${url.search} -> ${response.status()}` +
        ` location=${headers["location"] ?? ""} x-action-redirect=${headers["x-action-redirect"] ?? ""}` +
        ` carries-gated-heading=${GATED_HEADINGS.some((heading) => body.includes(heading))}` +
        ` carries-redirect-to-sign-in=${body.includes("/login?next=")}`,
    );
  });
  return () => console.log(`${label} [${project()}] urls: ${JSON.stringify(urls)}`);
}

const visibleHeading = (page: Page, name: string | RegExp) =>
  main(page).getByRole("heading", { level: 1, name }).filter({ visible: true });

/** Still on the page 2 seconds later: the replay was a late `replace` (spec 2.1). */
async function staysOn(page: Page, url: RegExp, heading: string | RegExp) {
  await expect(page).toHaveURL(url, POST_LANDS);
  await expect(visibleHeading(page, heading)).toBeVisible(POST_LANDS);
  await page.waitForTimeout(2_000);
  await expect(page).toHaveURL(url);
  await expect(visibleHeading(page, heading)).toBeVisible();
}

test.describe("signing in comes back to the page that asked (stage K spec 3)", () => {
  test.beforeEach(() => onlyAt("phone-390", "desktop-1440"));

  test("1. a client navigation to Post a request, then a sample account, opens the form", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    const report = watch(page, "variant 1");
    try {
      await page.goto("/");
      await hydrated(page);
      await push(page, "/looking-for/new");
      await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fnew$/, POST_LANDS);
      await button(page, "Student, Midrand").click();
      await staysOn(page, /\/looking-for\/new$/, "Ask for what you need");
    } finally {
      report();
    }
  });

  test("2. the same with a prefetch first, as the board's old plain link made", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    const report = watch(page, "variant 2");
    try {
      await page.goto("/");
      await hydrated(page);
      await prefetch(page, "/looking-for/new");
      await page.waitForTimeout(1_000);
      await push(page, "/looking-for/new");
      await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fnew$/, POST_LANDS);
      await button(page, "Student, Midrand").click();
      await staysOn(page, /\/looking-for\/new$/, "Ask for what you need");
    } finally {
      report();
    }
  });

  test("3. a client navigation to /account, then a first sign-in by code, opens the account", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    const report = watch(page, "variant 3");
    try {
      await page.goto("/");
      await hydrated(page);
      await push(page, "/account");
      await expect(page).toHaveURL(/\/login\?next=%2Faccount$/, POST_LANDS);
      await signUpHere(page, newBuyer());
      await staysOn(page, /\/account$/, "Your account");
    } finally {
      report();
    }
  });

  test("4. a client navigation to a dynamic gated page, the composer, then a sample account", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    const report = watch(page, "variant 4");
    try {
      await page.goto("/");
      await hydrated(page);
      await push(page, "/listings/l-001/message");
      await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001%2Fmessage$/, POST_LANDS);
      await button(page, "Student, Midrand").click();
      await staysOn(page, /\/listings\/l-001\/message$/, /^Message /);
    } finally {
      report();
    }
  });

  test("5. a full page load of /account first, then a sample account (a control)", async ({ page }) => {
    const report = watch(page, "variant 5");
    try {
      await page.goto("/account");
      await expect(page).toHaveURL(/\/login\?next=%2Faccount$/, POST_LANDS);
      await button(page, "Student, Midrand").click();
      await staysOn(page, /\/account$/, "Your account");
    } finally {
      report();
    }
  });

  test.describe("6. without the app's JavaScript (controls)", () => {
    test.beforeEach(async ({ page }) => {
      // The app's bundle never arrives. React's small inline script still puts streamed content in place.
      await page.route("**/_next/static/**/*.js", (route) => route.abort());
    });

    test("a first sign-in by code from /login?next=/account opens the account", async ({ page }) => {
      await page.goto("/login?next=%2Faccount");
      await signUpHere(page, newBuyer());
      await staysOn(page, /\/account$/, "Your account");
    });

    test("a full page load of /account, then a first sign-in by code, opens the account", async ({ page }) => {
      await page.goto("/account");
      await expect(page).toHaveURL(/\/login\?next=%2Faccount$/, POST_LANDS);
      await signUpHere(page, newBuyer());
      await staysOn(page, /\/account$/, "Your account");
    });
  });

  test("7. Back after variant 1 shows the signed-in note, whose Continue opens the form", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    await page.goto("/");
    await hydrated(page);
    await push(page, "/looking-for/new");
    await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fnew$/, POST_LANDS);
    await button(page, "Student, Midrand").click();
    await staysOn(page, /\/looking-for\/new$/, "Ask for what you need");
    await page.goBack();
    await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fnew$/);
    await expect(main(page).getByText(/You're signed in as/).filter({ visible: true })).toContainText(
      "student@eduvos.com",
    );
    const onward = main(page).getByRole("link", { name: "Continue", exact: true }).filter({ visible: true });
    await expect(onward).toHaveAttribute("href", "/looking-for/new");
    await onward.click();
    await staysOn(page, /\/looking-for\/new$/, "Ask for what you need");
  });

  test("8. a sample sign-in posted from another site is refused, and the visitor stays signed out", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    const response = await page.request.post("/login/sample", {
      headers: { Origin: "https://evil.example" },
      form: { email: "student@eduvos.com", next: "/account" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    expect(await response.text()).toBe("This form must be sent from Vossie.");
    const away = await page.request.get("/login/sample", { maxRedirects: 0 });
    expect([away.status(), away.headers()["location"]]).toEqual([303, "/login"]);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/, POST_LANDS);
  });
});

test.describe("signing out leaves nothing signed in behind (Lama, 2026-10-20)", () => {
  test.beforeEach(() => onlyAt("phone-390", "desktop-1440"));

  test("the account's email isn't in the document after signing out, even in a hidden kept page", async ({
    page,
    baseURL,
  }) => {
    needsTheFix(SIGN_OUT_ENDS_IN_A_PAGE_LOAD);
    await signInAsSample(page, "Student, Midrand", "/account");
    await expect(main(page).getByText("student@eduvos.com").filter({ visible: true })).toBeVisible();
    // A client navigation away: Next keeps /account hidden in the document (spec 2.1).
    await main(page).getByRole("link", { name: "Saved" }).click();
    await expect(page).toHaveURL(/\/saved$/);
    expect(await page.content(), "the kept /account is still in the document before signing out").toContain(
      "student@eduvos.com",
    );
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(`${baseURL}/`, POST_LANDS);
    await expect(page.locator(".toast")).toHaveText("You're signed out");
    expect(await page.content()).not.toContain("student@eduvos.com");
  });

  test("a sign-out posted from another site is refused, and the visitor stays signed in", async ({ page }) => {
    needsTheFix(SIGN_OUT_ENDS_IN_A_PAGE_LOAD);
    await signInAsSample(page, "Student, Midrand", "/account");
    const response = await page.request.post("/logout", {
      headers: { Origin: "https://evil.example" },
      form: {},
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    const away = await page.request.get("/logout", { maxRedirects: 0 });
    expect([away.status(), away.headers()["location"]]).toEqual([303, "/"]);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account$/);
  });
});

test.describe("checks (stage K spec 3 \"Checks\")", () => {
  test.beforeEach(() => onlyAt("phone-390", "desktop-1440"));

  test("the signed-in note with Continue has no serious or critical axe issues", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    await signInAsSample(page, "Student, Midrand", "/account");
    await page.goto("/login?next=%2Flooking-for%2Fnew");
    await expect(main(page).getByRole("link", { name: "Continue", exact: true }).filter({ visible: true })).toBeVisible();
    expect(await seriousIssues(page)).toEqual([]);
  });

  test("step 2 after a wrong code holds still while fonts and content arrive (CLS 0.05 or less)", async ({ page }) => {
    await page.goto("/login?next=%2Faccount");
    await field(page, "Your Eduvos email address").fill(newBuyer().email);
    await field(page, "I agree to the privacy policy").check();
    await button(page, "Send code").click();
    const note = main(page).getByText(/Sample mode: your code is/).filter({ visible: true });
    await expect(note).toBeVisible(POST_LANDS);
    const code = /(\d{6})/.exec((await note.textContent()) ?? "")![1];
    await field(page, "6-digit code").fill(code === "111111" ? "222222" : "111111");
    await button(page, "Sign in").click();
    const summary = main(page).locator(".form-summary").filter({ visible: true });
    await expect(summary).toContainText("That code isn't right.", POST_LANDS);
    // A step's errors show for a minute after their post (accounts spec 3.1), so a fresh load still has them.
    await holdFonts(page);
    await recordShifts(page);
    await expectStill(page, `sign-in step 2 after a wrong code (${project()})`, "/login?next=%2Faccount");
    await expect(summary).toBeVisible();
  });
});
```

Run: `pnpm lint tests/e2e/sign-in-return.spec.ts`
Expected: no output.

- [ ] **Step 4: Run it on HEAD with the spike switch**

Make a second scratch copy, `S="<your scratchpad>/vossie-k-task1"`, copying in `tests/e2e/sign-in-return.spec.ts`. From `$S`:

```bash
SIGN_IN_SPIKE=1 pnpm e2e tests/e2e/sign-in-return.spec.ts --project=phone-390 --project=desktop-1440 2>&1 | tee spike.log
grep -E "^variant|passed|failed|skipped" spike.log
grep -E "✘|✓" spike.log
```

Expected on HEAD:
- variants 5 and 6 (three tests) and the layout-shift check pass at both sizes;
- variant 7, variant 8, both sign-out tests and the Continue axe check fail (the fix doesn't exist yet: no Continue, no handlers, a Server Action sign-out). They decide nothing;
- variants 1 to 4: the spike's question. Each `variant N … POST` line says what the sign-in post answered; each `variant N … urls:` line lists where the page went.

If variant 5 or 6 fails on HEAD, stop and report: the controls must hold, or nothing below can be read.

- [ ] **Step 5: Decide, by plan decision 6, and report**

Report one of:
- **Confirmed:** list which of variants 1 to 4 failed, at which sizes; quote their `POST` lines (`x-action-redirect` set to the gated page and `carries-gated-heading=true`) and their `urls:` lines (ending on `/login?next=…`). Tasks 3 to 5 follow.
- **Server-side cause:** a variant failed and its `POST` line has `carries-redirect-to-sign-in=true` and no gated heading. Tasks 3 to 5 follow; say so plainly for "Changes made during the build".
- **Not reproduced:** variants 1 to 4 all passed at both sizes. Tasks 3 to 5 are skipped. Paste every `variant` line for Lama.

Also report the sign-out test's result on HEAD (it shows whether a kept `/account` really holds the email after a Server Action sign-out; Task 2 goes ahead either way), and the Start row's figures from Step 2.

- [ ] **Step 6: Hand over**

Files: `tests/e2e/sign-in-return.spec.ts` (both constants still `false`, so a normal run skips the tests of the fix; plan decision 7). Message (fill in the outcome and the figures):

```
test: stage K's sign-in spike: tests/e2e/sign-in-return.spec.ts reproduces stage D's replay of a gated page's redirect (client navigation with and without a prefetch, by code, a dynamic page; full-load and no-JavaScript controls; Back with Continue; a foreign post; signing out with a kept page). On HEAD with SIGN_IN_SPIKE=1: <Confirmed | Server-side cause | Not reproduced>, <variants and sizes>. The tests of the fix skip until Tasks 2 and 5 switch them on. JS Start row: <figures>
```

---

### Task 2: The same-origin check, and signing out with a full page load

Lama's answer 2 (plan decision 2) and spec 2.3's check. Built whatever Task 1 found. Sign-out moves from the Server Action to `POST /logout`, which answers 303 to `/` with the toast's flash cookie set. Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` ("Cookies", "Redirects"), `01-getting-started/15-route-handlers.md` ("With Cache Components") and `03-api-reference/04-functions/connection.md` first.

**Files:**
- Create: `lib/auth/same-origin.ts`, `lib/auth/same-origin.test.ts`
- Create: `lib/auth/post-paths.ts`
- Create: `app/logout/route.ts`, `app/logout/route.test.ts`
- Modify: `lib/auth/actions.ts` (remove `signOut`)
- Modify: `components/menu/MenuAccount.tsx`, `components/menu/MenuAccount.test.tsx`
- Modify: `components/account/AccountView.tsx`, `components/account/AccountView.test.tsx`
- Modify: `tests/e2e/sign-in-return.spec.ts` (one constant)

- [ ] **Step 1: The check's test**

Create `lib/auth/same-origin.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSameOrigin, notFromVossie, seeOther } from "./same-origin";

/** The parts of a request the check reads. */
const from = (headers: Record<string, string>) => ({ headers: new Headers(headers) });

describe("posts that start or end a session come from Vossie (stage K spec decision 3)", () => {
  it("accepts a post whose Origin's host is the request's host", () => {
    expect(isSameOrigin(from({ origin: "http://localhost:3204", host: "localhost:3204" }))).toBe(true);
    expect(isSameOrigin(from({ origin: "https://vossie-pi.vercel.app", host: "vossie-pi.vercel.app" }))).toBe(true);
  });

  it("refuses a post with no Origin, or Origin null", () => {
    expect(isSameOrigin(from({ host: "localhost:3204" }))).toBe(false);
    expect(isSameOrigin(from({ origin: "null", host: "localhost:3204" }))).toBe(false);
    expect(isSameOrigin(from({ origin: "not a url", host: "localhost:3204" }))).toBe(false);
  });

  it("refuses another host, and another port", () => {
    expect(isSameOrigin(from({ origin: "https://evil.example", host: "localhost:3204" }))).toBe(false);
    expect(isSameOrigin(from({ origin: "http://localhost:3100", host: "localhost:3204" }))).toBe(false);
  });

  it("uses the first x-forwarded-host when the host sets it, as Next's own check does", () => {
    const proxied = { host: "internal:3000", "x-forwarded-host": "vossie.example, internal:3000" };
    expect(isSameOrigin(from({ ...proxied, origin: "https://vossie.example" }))).toBe(true);
    expect(isSameOrigin(from({ ...proxied, origin: "http://internal:3000" }))).toBe(false);
  });

  it("refuses when the request names no host at all", () => {
    expect(isSameOrigin(from({ origin: "http://localhost:3204" }))).toBe(false);
  });

  it("answers 403 in plain words, and 303 to a relative path that's never stored", async () => {
    const refused = notFromVossie();
    expect(refused.status).toBe(403);
    expect(refused.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await refused.text()).toBe("This form must be sent from Vossie.");
    const onward = seeOther("/looking-for/new");
    expect([onward.status, onward.headers.get("location"), onward.headers.get("cache-control")]).toEqual([
      303,
      "/looking-for/new",
      "no-store",
    ]);
  });
});
```

Run: `pnpm test lib/auth/same-origin.test.ts`
Expected: FAIL (`./same-origin` doesn't exist).

- [ ] **Step 2: The check**

Create `lib/auth/same-origin.ts`:

```ts
// The Route Handlers that start or end a session (stage K spec decisions 2 and 3; plan decisions 10 and 11). Server
// Actions get Next's Origin check; Route Handlers get none, so each of ours calls isSameOrigin() before it reads the
// body or a cookie. Without it, another site could post a sample account's button and sign a visitor in (login CSRF),
// or sign them out.

/**
 * Whether the post came from a page on this site: its Origin header's host (with any port) must equal the first
 * x-forwarded-host when the host sets one, else the host header, which is Next's own rule. A missing Origin, or
 * "null", is refused: browsers send one with every form post (plan decision 11).
 */
export function isSameOrigin(request: Pick<Request, "headers">): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host");
  return Boolean(host) && originHost === host;
}

/** The answer to a post from anywhere else. Nobody using Vossie ever sees it. */
export function notFromVossie(): Response {
  return new Response("This form must be sent from Vossie.", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * 303 See Other to a path on this site: the browser loads it as a new document with GET, so nothing from the page it
 * left survives (spec decision 2). A relative Location avoids building an address from the request behind a proxy.
 */
export function seeOther(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}
```

Run: `pnpm test lib/auth/same-origin.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 3: The handler's test**

Create `lib/auth/post-paths.ts`:

```ts
// The paths of the Route Handlers that start or end a session (stage K plan decision 12). Plain strings, so a Server
// Component can post a form to one without importing server code.

/** Signing out (Lama, 2026-10-20). */
export const SIGN_OUT_PATH = "/logout";
```

Create `app/logout/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import { FLASH_COOKIE } from "@/lib/flash";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs } from "@/tests/helpers/staff";
import { GET, POST } from "./route";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
});

/** A form post, as the browser sends it from `origin` (jsdom's FormData can't be a real Request's body). */
function posted(origin: string | null = "http://localhost:3204") {
  const headers = new Headers({ host: "localhost:3204" });
  if (origin) headers.set("origin", origin);
  let read = false;
  const stand = {
    headers,
    formData: async () => {
      read = true;
      return form({});
    },
  } as unknown as Request;
  return { stand, wasRead: () => read };
}

describe("POST /logout (Lama, 2026-10-20; stage K plan decision 2)", () => {
  it("ends the session, leaves the homepage's toast and answers 303 to /", async () => {
    await signedInAs(request, "acc-student");
    const key = hashToken("token-acc-student");
    expect(sampleStore().sessions.has(key)).toBe(true);
    const response = await POST(posted().stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/"]);
    expect(sampleStore().sessions.has(key)).toBe(false);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
    expect(request.sent.get(FLASH_COOKIE)?.value).toBe("signed-out");
  });

  it("says signed out even when there was no session, as the Server Action did", async () => {
    const response = await POST(posted().stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/"]);
    expect(request.sent.get(FLASH_COOKIE)?.value).toBe("signed-out");
  });

  it("refuses a post from another site with 403, touching nothing", async () => {
    await signedInAs(request, "acc-student");
    for (const origin of ["https://evil.example", null]) {
      const { stand, wasRead } = posted(origin);
      const response = await POST(stand);
      expect(response.status).toBe(403);
      expect(wasRead()).toBe(false);
    }
    expect(sampleStore().sessions.has(hashToken("token-acc-student"))).toBe(true);
    expect(request.sent.size).toBe(0);
  });
});

describe("GET /logout", () => {
  it("answers 303 to / and signs nobody out: a link can't end a session", async () => {
    await signedInAs(request, "acc-student");
    const response = await GET();
    expect([response.status, response.headers.get("location")]).toEqual([303, "/"]);
    expect(sampleStore().sessions.has(hashToken("token-acc-student"))).toBe(true);
  });
});
```

`sampleStore().sessions` is the sessions table's name in `SampleStore`; check it in `lib/data/store.ts` and use the name that's there if it differs.

Run: `pnpm test app/logout/route.test.ts`
Expected: FAIL (`./route` doesn't exist).

- [ ] **Step 4: The handler**

Create `app/logout/route.ts`:

```ts
import { connection } from "next/server";
import { setFlash } from "@/lib/auth/cookies";
import { isSameOrigin, notFromVossie, seeOther } from "@/lib/auth/same-origin";
import { endSession } from "@/lib/auth/session";

/**
 * Sign out (accounts spec 2.5; Lama, 2026-10-20). A plain form post, answered with 303 to the homepage, so the
 * browser loads it as a new document and drops every signed-in page Next was keeping hidden (stage K spec section 8).
 * The homepage's toast says so, as before (accounts plan decision 12).
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return notFromVossie();
  await endSession();
  await setFlash("signed-out");
  return seeOther("/");
}

/** A link or a typed address signs nobody out. Request-time, so the 303 is never a prerendered file (plan decision 10). */
export async function GET(): Promise<Response> {
  await connection();
  return seeOther("/");
}
```

Run: `pnpm test app/logout/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: The two forms post to it**

In `components/menu/MenuAccount.tsx`:
- replace `import { signOut } from "@/lib/auth/actions";` with `import { SIGN_OUT_PATH } from "@/lib/auth/post-paths";`;
- replace `<form action={signOut}>` with `<form action={SIGN_OUT_PATH} method="post">`;
- in the doc comment, replace "Sign out is a plain form posting to a Server Action" with "Sign out is a plain form posting to `/logout`, which answers with a full page load (stage K)".

In `components/account/AccountView.tsx`:
- replace `import { signOut, updateDetails } from "@/lib/auth/actions";` with `import { updateDetails } from "@/lib/auth/actions";` and add `import { SIGN_OUT_PATH } from "@/lib/auth/post-paths";` after it;
- replace `<form action={signOut}>` with `<form action={SIGN_OUT_PATH} method="post">`.

In `components/menu/MenuAccount.test.tsx`:
- delete `vi.mock("@/lib/auth/actions", () => ({ signOut: async () => {} }));` (remove `vi` from the vitest import if nothing else uses it);
- after `expect(signOut.closest("form")).not.toBeNull();` add:

```ts
    // A plain post to /logout, which answers with a full page load (stage K plan decision 2).
    expect(signOut.closest("form")).toHaveAttribute("action", "/logout");
    expect(signOut.closest("form")).toHaveAttribute("method", "post");
```

In `components/account/AccountView.test.tsx`, change the mock to `vi.mock("@/lib/auth/actions", () => ({ updateDetails: async () => {} }));`, and after `expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute("type", "submit");` add:

```ts
    expect(screen.getByRole("button", { name: "Sign out" }).closest("form")).toHaveAttribute("action", "/logout");
```

- [ ] **Step 6: `signOut` leaves the actions**

In `lib/auth/actions.ts`:
- delete the whole `signOut` function with its doc comment (`/** Sign out (spec 2.5): … */` through its closing `}`);
- in the import from `"./session"`, remove `endSession` (it reads `import { requireAccount, startSession } from "./session";`).

`setFlash` stays imported: `deleteAccount` uses it.

Run: `grep -rn "signOut" app components lib --include="*.ts" --include="*.tsx"` (or, in zsh, `grep -rn "signOut" app components lib`)
Expected: only `components/menu/MenuAccount.test.tsx`'s local `const signOut = screen.getByRole(…)` lines.

Run: `pnpm test lib/auth components/menu components/account app/logout`
Expected: PASS.

- [ ] **Step 7: Switch the sign-out tests on**

In `tests/e2e/sign-in-return.spec.ts`, change `const SIGN_OUT_ENDS_IN_A_PAGE_LOAD = false;` to `const SIGN_OUT_ENDS_IN_A_PAGE_LOAD = true;`.

- [ ] **Step 8: Build, measure and run in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-k-task2"`, copying in every file in this task's list (`mkdir -p` each folder first: `app/logout`). From `$S`:

```bash
pnpm lint
pnpm typecheck
pnpm test 2>&1 | tail -5
pnpm e2e tests/e2e/sign-in-return.spec.ts tests/e2e/accounts.spec.ts --project=phone-390 --project=desktop-1440 2>&1 | tee e2e.log
grep -E "passed|failed|skipped" e2e.log
pnpm e2e tests/e2e/performance.spec.ts --project=phone-390
```

Expected:
- lint and typecheck clean; every unit test passing (Start's count + 10);
- in `sign-in-return.spec.ts`, both sign-out tests pass, and the sign-in tests of the fix skip;
- `accounts.spec.ts`: every test passes. **If one fails because signing out now reloads the page**, fix it in `accounts.spec.ts` with the smallest change that keeps what it checks, and list the change in your hand-over ("Before you start"). The toast-once test, which counts toasts across a Back, is the likeliest; if what it checks can't be kept, report to the controller before changing it;
- every `scriptBrotli` equal to the Start row. If any page moved, stop and find out why.

- [ ] **Step 9: Hand over**

Files: `lib/auth/same-origin.ts`, `lib/auth/same-origin.test.ts`, `lib/auth/post-paths.ts`, `app/logout/route.ts`, `app/logout/route.test.ts`, `lib/auth/actions.ts`, `components/menu/MenuAccount.tsx`, `components/menu/MenuAccount.test.tsx`, `components/account/AccountView.tsx`, `components/account/AccountView.test.tsx`, `tests/e2e/sign-in-return.spec.ts`, and `tests/e2e/accounts.spec.ts` only if Step 8 changed it. Message:

```
feat: signing out ends with a full page load: the menu's and the account page's Sign out post to /logout, a Route Handler that checks the post came from Vossie (403 otherwise), ends the session, leaves the homepage's toast and answers 303 to /, so no signed-in page stays hidden in the document (Lama, 2026-10-20; stage K plan decision 2). GET /logout answers 303 to / and signs nobody out. The signOut Server Action goes. isSameOrigin, notFromVossie and seeOther in lib/auth/same-origin.ts (spec decision 3). Unit: <count>. JS: every page the same to the byte
```

---

### Task 3 (only if Task 1 held): The steps' logic leaves the Server Actions

Spec 3 "Data and code" and plan decision 8. Behaviour doesn't change: the same checks, the same writes, the same destinations, returned as paths.

**Tasks 3, 4 and 5 are one build step, committed together after Task 5's checks.** This task removes `verifyCode`, `completeProfile` and `signInAsSample` from `actions.ts`, but `components/auth/SignInSteps.tsx` imports them until Task 5 points its forms at the handlers (Task 4). In between, `pnpm typecheck` and `pnpm build` fail on that import, which is expected: Tasks 3 and 4 run their own unit tests and lint their own files, and the whole suite, typecheck and build run in Task 5's scratch copy, which has all three tasks' files.

**Files:**
- Create: `lib/auth/sign-in-finish.ts`, `lib/auth/sign-in-finish.test.ts`
- Modify: `lib/auth/actions.ts`, `lib/auth/sign-in-actions.test.ts`

- [ ] **Step 1: The tests, moved and reshaped**

Create `lib/auth/sign-in-finish.test.ts`. It holds every path `sign-in-actions.test.ts` covers for step 2, step 3 and the sample buttons, now as returned paths (spec 3 "Tests"):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccount, deleteAccountData, findAccountByEmail, getLatestConsent } from "@/lib/data/accounts";
import { getSampleEmail, recordCodeSent } from "@/lib/data/sign-in";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form } from "@/tests/helpers/staff";
import { resendCode, startSignIn } from "./actions";
import { SESSION_COOKIE, SIGN_IN_COOKIE } from "./cookies";
import { hashToken } from "./secrets";
import { getViewer } from "./session";
import { afterSignInPath, finishCode, finishProfile, finishSample, signInPath } from "./sign-in-finish";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** This browser's attempt, straight from the store, or null. */
function attempt() {
  const token = request.cookies.get(SIGN_IN_COOKIE);
  return token ? (sampleStore().signInAttempts.get(hashToken(token)) ?? null) : null;
}

async function sentCode(): Promise<string> {
  return (await getSampleEmail(attempt()!.key))!.code;
}

async function wrongCode(): Promise<string> {
  return (await sentCode()) === "111111" ? "222222" : "111111";
}

/** Step 1 (still a Server Action) for `email`, with the box ticked, coming back to `next`. */
function start(email: string, next = "/listings/l-001") {
  return redirectSignalOf(() => startSignIn(form({ email, consent: "yes", next })));
}

const code = (fields: Record<string, string>) => finishCode(form(fields), new Date());
const profile = (fields: Record<string, string>) => finishProfile(form(fields), new Date());
const sample = (fields: Record<string, string>) => finishSample(form(fields), new Date());

describe("where a step goes (stage K spec section 3)", () => {
  it("goes back to sign-in, keeping next", () => {
    expect(signInPath(null)).toBe("/login");
    expect(signInPath("/listings/l-001")).toBe("/login?next=%2Flistings%2Fl-001");
  });

  it("finishes at next, unless it's missing or under /login, then at the account (accounts plan decision 9)", () => {
    expect(afterSignInPath("/saved")).toBe("/saved");
    expect(afterSignInPath(null)).toBe("/account");
    expect(afterSignInPath("/login?next=%2Fsaved")).toBe("/account");
  });
});

describe("step 2: the code (accounts spec 3.1)", () => {
  it("signs an existing account straight in and follows next", async () => {
    await start("student@eduvos.com");
    expect(await code({ code: await sentCode(), next: "/listings/l-001" })).toBe("/listings/l-001");
    expect((await getViewer())?.email).toBe("student@eduvos.com");
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
    expect(sampleStore().signInAttempts.size).toBe(0);
  });

  it("goes to the account page when next is missing, or is the sign-in page itself", async () => {
    await redirectSignalOf(() => startSignIn(form({ email: "student@eduvos.com", consent: "yes" })));
    expect(await code({ code: await sentCode() })).toBe("/account");
    await start("student@eduvos.com", "/login?next=%2Fsaved");
    expect(await code({ code: await sentCode(), next: "/login?next=%2Fsaved" })).toBe("/account");
  });

  it("ignores spaces in the code", async () => {
    await start("student@eduvos.com");
    const sent = await sentCode();
    expect(await code({ code: `${sent.slice(0, 3)} ${sent.slice(3)}`, next: "/saved" })).toBe("/saved");
  });

  it("moves a new email on to step 3 without making an account yet", async () => {
    await start("new@eduvos.com");
    expect(await code({ code: await sentCode(), next: "/listings/l-001" })).toBe("/login?next=%2Flistings%2Fl-001");
    expect(attempt()).toMatchObject({ step: "profile", codeHash: null, errors: [] });
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("counts wrong tries, and the fifth ends the attempt, back on step 1 with the email kept", async () => {
    await start("thandi@eduvos.com");
    const wrong = await wrongCode();
    for (let tries = 1; tries <= 4; tries++) {
      expect(await code({ code: wrong, next: "/saved" })).toBe("/login?next=%2Fsaved");
      expect(attempt()).toMatchObject({ step: "code", wrongTries: tries, errors: ["code-wrong"] });
    }
    await code({ code: wrong });
    expect(attempt()).toMatchObject({ step: "email", email: "thandi@eduvos.com", codeHash: null, errors: ["locked"] });
  });

  it("counts every wrong try, even when posts overlap", async () => {
    await start("thandi@eduvos.com");
    const wrong = await wrongCode();
    await Promise.all(Array.from({ length: 3 }, () => code({ code: wrong })));
    expect(attempt()).toMatchObject({ step: "code", wrongTries: 3 });
    await Promise.all(Array.from({ length: 2 }, () => code({ code: wrong })));
    expect(attempt()).toMatchObject({ step: "email", codeHash: null, errors: ["locked"] });
  });

  it("refuses the right code once its 10 minutes are up", async () => {
    await start("student@eduvos.com");
    const sent = await sentCode();
    vi.setSystemTime(new Date("2026-10-14T08:52:00.000Z"));
    await code({ code: sent });
    expect(attempt()).toMatchObject({ step: "code", errors: ["code-expired"] });
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("asks for 6 digits without using a try", async () => {
    await start("thandi@eduvos.com");
    for (const typed of ["", "12345", "1234567", "12a456"]) {
      await code({ code: typed });
      expect(attempt()).toMatchObject({ errors: ["code-missing"], wrongTries: 0 });
    }
  });

  it("sends a browser with no attempt back to sign-in", async () => {
    expect(await code({ code: "123456", next: "/saved" })).toBe("/login?next=%2Fsaved");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("does nothing with sample mode off (spec 2.1)", async () => {
    await start("student@eduvos.com");
    const sent = await sentCode();
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect(await code({ code: sent, next: "/saved" })).toBe("/login?next=%2Fsaved");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });
});

describe("the stamp that lets a step's errors show only straight after their post (accounts spec 3.1)", () => {
  const at = (seconds: number) => vi.setSystemTime(new Date(NOW.getTime() + seconds * 1000));
  const stamp = (seconds: number) => new Date(NOW.getTime() + seconds * 1000).toISOString();

  it("stamps the attempt with the time of every post that saves it", async () => {
    await start("thandi@eduvos.com");
    expect(attempt()?.postedAt).toBe(stamp(0));
    at(5);
    await code({ code: await wrongCode() });
    expect(attempt()).toMatchObject({ errors: ["code-wrong"], postedAt: stamp(5) });
    at(10);
    await redirectSignalOf(() => resendCode(form({})));
    expect(attempt()).toMatchObject({ resent: true, postedAt: stamp(10) });
    at(15);
    await code({ code: await sentCode() });
    expect(attempt()).toMatchObject({ step: "profile", postedAt: stamp(15) });
    at(20);
    await profile({ firstName: "A", campus: "atlantis" });
    expect(attempt()).toMatchObject({ errors: ["first-name-length", "campus-missing"], postedAt: stamp(20) });
  });

  it("stamps the rate-limit error that replaces a good email's code", async () => {
    for (const minutes of [0, 5, 10, 15, 20]) {
      await recordCodeSent("thandi@eduvos.com", new Date(NOW.getTime() - minutes * 60_000));
    }
    at(7);
    await start("thandi@eduvos.com");
    expect(attempt()).toMatchObject({ errors: ["email-rate"], postedAt: stamp(7) });
  });
});

describe("step 3: first sign-in (accounts spec 2.6)", () => {
  async function toStep3() {
    await start("new@eduvos.com");
    await code({ code: await sentCode() });
  }

  it("makes the account with the name and campus, records consent, signs in and follows next", async () => {
    await toStep3();
    vi.setSystemTime(new Date("2026-10-14T08:45:00.000Z"));
    expect(await profile({ firstName: "  Ayanda ", campus: "pretoria", next: "/listings/l-001" })).toBe(
      "/listings/l-001",
    );
    const account = await findAccountByEmail("new@eduvos.com");
    expect(account).toMatchObject({ firstName: "Ayanda", campusSlug: "pretoria", roles: [], createdAt: "2026-10-14T08:45:00.000Z" });
    expect(await getLatestConsent(account!.id)).toEqual({ version: "2026-10-draft", agreedAt: NOW.toISOString() });
    expect((await getViewer())?.id).toBe(account!.id);
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
  });

  it("keeps step 3's answers and says what's wrong, making nothing", async () => {
    await toStep3();
    expect(await profile({ firstName: "A", campus: "atlantis", next: "/saved" })).toBe("/login?next=%2Fsaved");
    expect(attempt()).toMatchObject({ step: "profile", errors: ["first-name-length", "campus-missing"], firstName: "A", campusSlug: "" });
    await profile({ firstName: "", campus: "midrand" });
    expect(attempt()).toMatchObject({ errors: ["first-name-missing"], campusSlug: "midrand" });
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });

  it("signs in to the account another tab made first, rather than making a second", async () => {
    await toStep3();
    const other = await createAccount({ email: "new@eduvos.com", firstName: "Zola", campusSlug: "midrand", now: NOW });
    await profile({ firstName: "Ayanda", campus: "pretoria" });
    expect((await getViewer())?.id).toBe(other.id);
    expect([...sampleStore().accounts.values()].filter((row) => row.email === "new@eduvos.com")).toHaveLength(1);
  });

  it("can't be reached without the right code", async () => {
    await start("new@eduvos.com");
    expect(await profile({ firstName: "Ayanda", campus: "pretoria" })).toBe("/login");
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });

  it("can't be finished once the attempt's 30 minutes are up", async () => {
    await toStep3();
    vi.setSystemTime(new Date("2026-10-14T09:12:00.000Z"));
    expect(await profile({ firstName: "Ayanda", campus: "pretoria" })).toBe("/login");
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });
});

describe("the sample accounts' buttons (accounts spec 2.8)", () => {
  it("signs straight in as a sample account and follows next", async () => {
    expect(await sample({ email: "mentor@eduvos.com", next: "/saved" })).toBe("/saved");
    expect((await getViewer())?.roles).toEqual(["mentor"]);
  });

  it("only signs in as one of the five", async () => {
    await createAccount({ email: "someone@eduvos.com", firstName: "Zola", campusSlug: "midrand", now: NOW });
    expect(await sample({ email: "someone@eduvos.com" })).toBe("/login");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("puts a deleted sample account back first", async () => {
    sampleStore().accounts.delete("acc-admin");
    await sample({ email: "admin@eduvos.com" });
    expect((await getViewer())?.id).toBe("acc-admin");
  });

  it("brings a deleted sample seller's shop back, expiring the sellers tag with revalidateTag, never updateTag", async () => {
    await deleteAccountData("acc-seller");
    expect(sampleStore().sellers.has("tech-corner")).toBe(false);
    await sample({ email: "seller@eduvos.com" });
    expect(sampleStore().sellers.get("tech-corner")?.ownerId).toBe("acc-seller");
    expect(sampleStore().listings.has("l-001")).toBe(true);
    // A Route Handler can't call updateTag (stage K spec decision 4).
    expect(request.revalidatedTags).toEqual([{ tag: "sellers", profile: { expire: 0 } }]);
    expect(request.updatedTags).toEqual([]);
  });

  it("expires nothing when the sample account has no shop to bring back", async () => {
    await sample({ email: "student@eduvos.com" });
    await sample({ email: "seller@eduvos.com" });
    expect(request.revalidatedTags).toEqual([]);
  });

  it("ends a sign-in that was under way", async () => {
    await start("thandi@eduvos.com");
    const key = attempt()!.key;
    await sample({ email: "student@eduvos.com" });
    expect(sampleStore().signInAttempts.has(key)).toBe(false);
    expect(request.cookies.has(SIGN_IN_COOKIE)).toBe(false);
  });

  it("is off with sample mode off", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect(await sample({ email: "student@eduvos.com" })).toBe("/login");
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });
});
```

`request.revalidatedTags` comes in Task 4, Step 1. If you build Task 3 alone, do Task 4's Step 1 first (it's two small edits to the test helper), or expect those two tests to fail until it lands.

Run: `pnpm test lib/auth/sign-in-finish.test.ts`
Expected: FAIL (`./sign-in-finish` doesn't exist).

- [ ] **Step 2: The module**

Create `lib/auth/sign-in-finish.ts`:

```ts
import { getCampuses } from "@/lib/data";
import { createAccount, findAccountByEmail, recordConsent, restoreSampleAccount } from "@/lib/data/accounts";
import type { SignInAttemptRow, SignInError } from "@/lib/data/rows";
import { restoreSampleShop } from "@/lib/data/shops";
import {
  deleteSignInAttempt,
  getSignInAttempt,
  recordWrongTry,
  reserveCodeSend,
  saveSampleEmail,
  saveSignInAttempt,
} from "@/lib/data/sign-in";
import { sellersChangedNow } from "@/lib/data/tags";
import { safeNextPath, signInHref } from "@/lib/next-path";
import { ATTEMPT_TTL_MS, CODE_TTL_MS, CODES_PER_HOUR, isSampleMode, MAX_WRONG_TRIES, POLICY_VERSION } from "./config";
import { deleteCookie, readCookieValue, setPrivateCookie, SIGN_IN_COOKIE } from "./cookies";
import { normaliseEmail } from "./email";
import { checkCampus, checkFirstName } from "./profile";
import { codeMatches, hashCode, hashToken, newCode, newToken } from "./secrets";
import { startSession } from "./session";

// Signing in's steps (accounts spec 2 and 3), shared by the Server Actions in actions.ts (step 1, a new code, a
// different email) and the Route Handlers that finish a sign-in (app/login/code, profile and sample; stage K spec
// decision 2). A plain module, not "use server": every async function a "use server" file exports is an endpoint, and
// these helpers must never be (plan decision 8). Nothing here redirects: each step returns the path to go to.

// --- Shared helpers -------------------------------------------------------------------------------------------------

/** A form field as text. A missing field, or a file, is "". */
export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** The `next` path the form carried, when it's a safe path on this site (spec 2.10). */
export function nextFrom(formData: FormData): string | null {
  return safeNextPath(text(formData, "next") || undefined);
}

/** The sign-in page again, keeping `next`. */
export function signInPath(next: string | null): string {
  return next ? signInHref(next) : "/login";
}

/** Where a finished sign-in goes (accounts plan decision 9): `next`, unless it's the sign-in page itself; else the account. */
export function afterSignInPath(next: string | null): string {
  return next && !next.startsWith("/login") ? next : "/account";
}

/** This browser's sign-in attempt, while it hasn't run out. */
export async function currentAttempt(now: Date): Promise<SignInAttemptRow | null> {
  const token = await readCookieValue(SIGN_IN_COOKIE);
  return token ? getSignInAttempt(hashToken(token), now) : null;
}

/** Ends this browser's attempt, if it has one, and clears its cookie. */
export async function endAttempt(now: Date): Promise<void> {
  const attempt = await currentAttempt(now);
  if (attempt) await deleteSignInAttempt(attempt.key);
  await deleteCookie(SIGN_IN_COOKIE);
}

/**
 * A new attempt under a new token, replacing this browser's old one, so a token is never reused. It has 30 minutes
 * for all three steps. The caller saves it.
 */
export async function beginAttempt(
  now: Date,
  fields: Pick<SignInAttemptRow, "email" | "errors" | "consentedAt">,
): Promise<SignInAttemptRow> {
  const old = await currentAttempt(now);
  if (old) await deleteSignInAttempt(old.key);
  const token = newToken();
  await setPrivateCookie(SIGN_IN_COOKIE, token, ATTEMPT_TTL_MS / 1000);
  return {
    key: hashToken(token),
    step: "email",
    resent: false,
    codeHash: null,
    codeExpiresAt: null,
    wrongTries: 0,
    firstName: "",
    campusSlug: "",
    postedAt: null,
    expiresAt: new Date(now.getTime() + ATTEMPT_TTL_MS).toISOString(),
    ...fields,
  };
}

/**
 * Saves an attempt as the post that's ending left it, stamped with that post's time. Every post sets the attempt's
 * `errors` (and `resent`) afresh, so the stamp tells the page how old they are: it shows them only straight after the
 * post, not on a visit 20 minutes later (spec 3.1, SIGN_IN_ERRORS_SHOW_MS).
 */
export async function saveAfterPost(attempt: SignInAttemptRow, now: Date): Promise<void> {
  attempt.postedAt = now.toISOString();
  await saveSignInAttempt(attempt, now);
}

/**
 * Makes a code, keeps only its hash on the attempt, and "sends" it (spec 2.2, 2.3 and 5). A new code gives 5 fresh
 * tries (plan decision 6). False, and nothing sent, when this email has had its 5 codes this hour.
 */
export async function sendCode(attempt: SignInAttemptRow, now: Date): Promise<boolean> {
  // The place is counted and taken in one step, so posts at once can't each find room and all send (spec 5).
  if (!(await reserveCodeSend(attempt.email, now, CODES_PER_HOUR))) return false;
  const code = newCode();
  attempt.codeHash = hashCode(attempt.key, code);
  attempt.codeExpiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  attempt.wrongTries = 0;
  // Sample mode has no email service: its outbox stands in for one, and the sign-in page shows the code from it
  // (plan decision 5). The real email service replaces this call.
  await saveSampleEmail({ attemptKey: attempt.key, to: attempt.email, code, sentAt: now.toISOString() });
  return true;
}

/** Finishes signing in: consent recorded, the attempt gone, a new session (spec 2.5 and 2.7). */
async function finishSignIn(accountId: string, attempt: SignInAttemptRow, now: Date): Promise<void> {
  await recordConsent(accountId, POLICY_VERSION, attempt.consentedAt ? new Date(attempt.consentedAt) : now);
  await deleteSignInAttempt(attempt.key);
  await deleteCookie(SIGN_IN_COOKIE);
  await startSession(accountId, now);
}

// --- The three posts that can start a session (stage K spec decision 2) ---------------------------------------------

/**
 * Step 2 (spec 3.1): the 6-digit code. Right, for an existing account: signed in, on to `next`. Right, for a new
 * email: on to step 3. Wrong: a try used, and the fifth ends the attempt, back on step 1 (spec 2.2). Expired: say so.
 * Not 6 digits: say so, without using a try. POST /login/code.
 */
export async function finishCode(formData: FormData, now: Date): Promise<string> {
  const next = nextFrom(formData);
  const attempt = isSampleMode() ? await currentAttempt(now) : null;
  if (!attempt || attempt.step !== "code" || !attempt.codeHash || !attempt.codeExpiresAt) return signInPath(next);
  const code = text(formData, "code").replace(/\s/g, "");
  attempt.resent = false;
  if (Date.parse(attempt.codeExpiresAt) <= now.getTime()) {
    attempt.errors = ["code-expired"];
  } else if (!/^\d{6}$/.test(code)) {
    attempt.errors = ["code-missing"];
  } else if (codeMatches(attempt.key, code, attempt.codeHash)) {
    const account = await findAccountByEmail(attempt.email);
    if (account) {
      await finishSignIn(account.id, attempt, now);
      return afterSignInPath(next);
    }
    attempt.step = "profile";
    attempt.codeHash = null;
    attempt.codeExpiresAt = null;
    attempt.errors = [];
  } else {
    // The try is counted in one step in the store, not read, added to and saved back with the row, so posts at once
    // each count their own and none is lost (spec 2.2).
    attempt.wrongTries = await recordWrongTry(attempt.key);
    if (attempt.wrongTries < MAX_WRONG_TRIES) {
      attempt.errors = ["code-wrong"];
    } else {
      // The fifth wrong try ends the attempt (spec 2.2): back to step 1, the email kept, the code gone.
      attempt.step = "email";
      attempt.codeHash = null;
      attempt.codeExpiresAt = null;
      attempt.errors = ["locked"];
    }
  }
  await saveAfterPost(attempt, now);
  return signInPath(next);
}

/**
 * Step 3, a first sign-in only (spec 2.6): a first name and a campus. Only now is the account made, consent recorded
 * and the session started (plan decision 8). POST /login/profile.
 */
export async function finishProfile(formData: FormData, now: Date): Promise<string> {
  const next = nextFrom(formData);
  const attempt = isSampleMode() ? await currentAttempt(now) : null;
  if (!attempt || attempt.step !== "profile") return signInPath(next);
  const name = checkFirstName(text(formData, "firstName"));
  const campuses = await getCampuses();
  const campusSlug = checkCampus(text(formData, "campus"), campuses.map((campus) => campus.slug));
  const errors: SignInError[] = [];
  if (name.error) errors.push(name.error);
  if (!campusSlug) errors.push("campus-missing");
  if (errors.length > 0 || !campusSlug) {
    attempt.errors = errors;
    attempt.firstName = name.value.slice(0, 80);
    attempt.campusSlug = campusSlug ?? "";
    await saveAfterPost(attempt, now);
    return signInPath(next);
  }
  // Another tab may have finished first: then this signs in to that account rather than making a second one.
  const account =
    (await findAccountByEmail(attempt.email)) ??
    (await createAccount({ email: attempt.email, firstName: name.value, campusSlug, now }));
  await finishSignIn(account.id, attempt, now);
  return afterSignInPath(next);
}

/** "Sign in as a sample account" (spec 2.8): straight in, in sample mode only, and only as one of the five. POST /login/sample. */
export async function finishSample(formData: FormData, now: Date): Promise<string> {
  const next = nextFrom(formData);
  if (!isSampleMode()) return signInPath(next);
  const account = await restoreSampleAccount(normaliseEmail(text(formData, "email")));
  if (!account) return signInPath(next);
  // A sample shop deleted with its account comes back with it, and its sample listings (selling plan, Task 7). A Route
  // Handler can't call updateTag (stage K spec decision 4).
  if (await restoreSampleShop(account.id)) sellersChangedNow();
  await endAttempt(now);
  await startSession(account.id, now);
  return afterSignInPath(next);
}
```

- [ ] **Step 3: The Server Actions keep the three steps that start no session**

Replace the whole of `lib/auth/actions.ts` (as Task 2 left it, without `signOut`) with:

```ts
"use server";

import { redirect, RedirectType } from "next/navigation";
import { getCampuses } from "@/lib/data";
import { deleteAccountData, updateAccountDetails } from "@/lib/data/accounts";
import type { SignInError } from "@/lib/data/rows";
import { hubChanged, requestsChanged, sellersChanged } from "@/lib/data/tags";
import { isSampleMode } from "./config";
import { deleteCookie, SESSION_COOKIE, setFlash } from "./cookies";
import { checkEmail, normaliseEmail } from "./email";
import { DELETE_FORM, DETAILS_FORM, writeFormState } from "./form-state";
import { checkCampus, checkFirstName } from "./profile";
import { requireAccount } from "./session";
import { beginAttempt, currentAttempt, endAttempt, nextFrom, saveAfterPost, sendCode, signInPath, text } from "./sign-in-finish";

// The Server Actions behind the account forms that don't start a session (accounts spec 2 and 3). Each is a plain
// form's action, so it works before the app's JavaScript arrives (plan decision 2). It checks its own input, takes
// identity only from the session, keeps errors in the store rather than the URL (plan decision 3), and ends with a
// redirect. The three posts that start a session, and signing out, are Route Handlers that answer 303 instead, so
// they end with a full page load (stage K spec decision 2; app/login/*/route.ts and app/logout/route.ts).

/** The sign-in page again, keeping `next`, replacing the form in history (plan decision 19). */
function backToSignIn(next: string | null): never {
  redirect(signInPath(next), RedirectType.replace);
}

// --- Signing in ---------------------------------------------------------------
```

followed, unchanged, by HEAD's `startSignIn`, `resendCode` and `cancelSignIn` (with their doc comments), then `// --- Your account ---` and HEAD's `updateDetails` and `deleteAccount` (with their doc comments). Nothing in those five bodies changes: they call `beginAttempt`, `currentAttempt`, `endAttempt`, `sendCode`, `saveAfterPost`, `text`, `nextFrom` and `backToSignIn` by the same names.

- [ ] **Step 4: Trim the old test file**

In `lib/auth/sign-in-actions.test.ts`:
- delete the `describe` blocks "step 2: the code (accounts spec 3.1)", "the stamp that lets a step's errors show only straight after their post (accounts spec 3.1)", "step 3: first sign-in (accounts spec 2.6)" and "the sample accounts' buttons (accounts spec 2.8)" (all moved to `sign-in-finish.test.ts`);
- in "sending a new code (plan decision 6)", replace each of the two lines `await redirectSignalOf(async () => verifyCode(form({ code: await wrongCode() })));` with `await finishCode(form({ code: await wrongCode() }), new Date());`;
- replace the import block (everything from the first `import` to `import { getViewer } from "./session";`) with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSampleEmail, recordCodeSent } from "@/lib/data/sign-in";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { cancelSignIn, resendCode, startSignIn } from "./actions";
import { SIGN_IN_COOKIE } from "./cookies";
import { hashToken } from "./secrets";
import { finishCode } from "./sign-in-finish";
```

Run: `pnpm lint lib/auth`
Expected: no output (an unused import left behind would show here).

Run: `pnpm test lib/auth`
Expected: PASS, with the same number of tests in `lib/auth` as before plus the new ones (2 path tests and "does nothing with sample mode off" for step 2).

- [ ] **Step 5: Hand over (with Tasks 4 and 5)**

Files: `lib/auth/sign-in-finish.ts`, `lib/auth/sign-in-finish.test.ts`, `lib/auth/actions.ts`, `lib/auth/sign-in-actions.test.ts`. Committed together with Tasks 4 and 5 (Task 5's message).

---

### Task 4 (only if Task 1 held): The three sign-in Route Handlers

Spec 2.2 to 2.4 and 3 "Data and code". Each handler: `isSameOrigin` first, then `request.formData()`, then the finish function with `new Date()`, then `seeOther(path)`; `GET` gives 303 to `/login`. Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` first.

**Files:**
- Modify: `tests/helpers/next-request.ts`
- Modify: `lib/data/tags.ts` (+ its test if one exists: `ls lib/data/tags.test.ts`)
- Modify: `lib/auth/post-paths.ts`
- Create: `app/login/code/route.ts`, `app/login/profile/route.ts`, `app/login/sample/route.ts`, and a `route.test.ts` beside each

- [ ] **Step 1: The test helper records `revalidateTag`**

In `tests/helpers/next-request.ts`:
- in `FakeRequest`, after the `updatedTags?: string[];` line, add:

```ts
  /** The cache tags a Route Handler expired with revalidateTag, with their profile, in order (stage K plan decision 13). */
  revalidatedTags?: Array<{ tag: string; profile: unknown }>;
```

- in `resetRequest`, after `request.updatedTags = [];`, add `request.revalidatedTags = [];`;
- in `nextCache`'s returned object, after `updateTag`, add:

```ts
    revalidateTag: (tag: string, profile: unknown) => {
      request.revalidatedTags = [...(request.revalidatedTags ?? []), { tag, profile }];
    },
```

and add "and revalidateTag()" to its doc comment's list.

- [ ] **Step 2: `sellersChangedNow()`**

In `lib/data/tags.ts`:
- change the first line to `import { cacheTag, revalidateTag, updateTag } from "next/cache";`;
- after `sellersChanged()`, add:

```ts
/**
 * The same, from a Route Handler, where updateTag throws (stage K spec decision 4): `{ expire: 0 }` means the next
 * request never gets the stale catalog, as updateTag's would (Next 16.4's revalidateTag docs).
 */
export function sellersChangedNow(): void {
  revalidateTag(SELLERS_TAG, { expire: 0 });
}
```

If `lib/data/tags.test.ts` exists, add a test there in its style that `sellersChangedNow()` calls `revalidateTag` with `("sellers", { expire: 0 })` and not `updateTag`. If it doesn't, Task 3's two sample tests cover it.

- [ ] **Step 3: The paths**

In `lib/auth/post-paths.ts`, add after `SIGN_OUT_PATH`:

```ts
/** The three posts that start a session (stage K spec decision 2): step 2's code, step 3's profile, a sample account. */
export const SIGN_IN_POSTS = { code: "/login/code", profile: "/login/profile", sample: "/login/sample" } as const;
```

- [ ] **Step 4: The handlers' tests**

Create `app/login/code/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSampleEmail } from "@/lib/data/sign-in";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { SESSION_COOKIE, SIGN_IN_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import { startSignIn } from "@/lib/auth/actions";
import { redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form } from "@/tests/helpers/staff";
import { GET, POST } from "./route";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T08:42:00.000Z"));
});

/** A form post from `origin`, as the browser sends it (conventions: a stand-in, since jsdom's FormData can't be a body). */
function posted(fields: Record<string, string>, origin: string | null = "http://localhost:3204") {
  const headers = new Headers({ host: "localhost:3204" });
  if (origin) headers.set("origin", origin);
  let read = false;
  const stand = {
    headers,
    formData: async () => {
      read = true;
      return form(fields);
    },
  } as unknown as Request;
  return { stand, wasRead: () => read };
}

async function sentCode(): Promise<string> {
  const token = request.cookies.get(SIGN_IN_COOKIE)!;
  return (await getSampleEmail(hashToken(token)))!.code;
}

describe("POST /login/code (stage K spec decision 2)", () => {
  it("signs an existing account in and answers 303 to next, a relative path", async () => {
    await redirectSignalOf(() => startSignIn(form({ email: "student@eduvos.com", consent: "yes", next: "/looking-for/new" })));
    const response = await POST(posted({ code: await sentCode(), next: "/looking-for/new" }).stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/looking-for/new"]);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(true);
  });

  it("answers 303 back to sign-in, keeping next, on a wrong code", async () => {
    await redirectSignalOf(() => startSignIn(form({ email: "student@eduvos.com", consent: "yes" })));
    const wrong = (await sentCode()) === "111111" ? "222222" : "111111";
    const response = await POST(posted({ code: wrong, next: "/saved" }).stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/login?next=%2Fsaved"]);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("refuses a post from another site, or with no Origin, with 403, reading and writing nothing", async () => {
    await redirectSignalOf(() => startSignIn(form({ email: "student@eduvos.com", consent: "yes" })));
    const code = await sentCode();
    const attempts = sampleStore().signInAttempts.size;
    for (const origin of ["https://evil.example", null]) {
      const { stand, wasRead } = posted({ code }, origin);
      const response = await POST(stand);
      expect(response.status).toBe(403);
      expect(wasRead()).toBe(false);
    }
    expect(sampleStore().signInAttempts.size).toBe(attempts);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });
});

describe("GET /login/code", () => {
  it("answers 303 to /login", async () => {
    const response = await GET();
    expect([response.status, response.headers.get("location")]).toEqual([303, "/login"]);
  });
});
```

Create `app/login/profile/route.test.ts` with the same header (imports, mocks, `beforeEach`, `posted`, `sentCode`; add `findAccountByEmail` from `@/lib/data/accounts`) and:

```ts
describe("POST /login/profile (stage K spec decision 2)", () => {
  async function toStep3(next: string) {
    await redirectSignalOf(() => startSignIn(form({ email: "new@eduvos.com", consent: "yes", next })));
    await POST_CODE(posted({ code: await sentCode(), next }).stand);
  }

  it("makes the account, signs in and answers 303 to next", async () => {
    await toStep3("/account");
    const response = await POST(posted({ firstName: "Ayanda", campus: "pretoria", next: "/account" }).stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/account"]);
    expect(await findAccountByEmail("new@eduvos.com")).not.toBeNull();
  });

  it("answers 303 back to sign-in with a missing name, making nothing", async () => {
    await toStep3("/saved");
    const response = await POST(posted({ firstName: "", campus: "pretoria", next: "/saved" }).stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/login?next=%2Fsaved"]);
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });

  it("refuses a foreign post with 403, reading nothing", async () => {
    await toStep3("/account");
    const { stand, wasRead } = posted({ firstName: "Ayanda", campus: "pretoria" }, "https://evil.example");
    expect((await POST(stand)).status).toBe(403);
    expect(wasRead()).toBe(false);
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });
});

describe("GET /login/profile", () => {
  it("answers 303 to /login", async () => {
    const response = await GET();
    expect([response.status, response.headers.get("location")]).toEqual([303, "/login"]);
  });
});
```

with `import { POST as POST_CODE } from "../code/route";` among its imports.

Create `app/login/sample/route.test.ts` with the same header (`sentCode` not needed; add `deleteAccountData` from `@/lib/data/accounts`) and:

```ts
describe("POST /login/sample (stage K spec decisions 2 to 4)", () => {
  it("signs in as the sample account and answers 303 to next", async () => {
    const response = await POST(posted({ email: "student@eduvos.com", next: "/looking-for/new" }).stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/looking-for/new"]);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(true);
  });

  it("refuses a post from another site with 403: no login CSRF (spec decision 3)", async () => {
    const { stand, wasRead } = posted({ email: "student@eduvos.com" }, "https://evil.example");
    const response = await POST(stand);
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("This form must be sent from Vossie.");
    expect(wasRead()).toBe(false);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("expires the sellers tag with revalidateTag when a sample shop comes back, never updateTag", async () => {
    await deleteAccountData("acc-seller");
    await POST(posted({ email: "seller@eduvos.com" }).stand);
    expect(request.revalidatedTags).toEqual([{ tag: "sellers", profile: { expire: 0 } }]);
    expect(request.updatedTags).toEqual([]);
  });
});

describe("GET /login/sample", () => {
  it("answers 303 to /login", async () => {
    const response = await GET();
    expect([response.status, response.headers.get("location")]).toEqual([303, "/login"]);
  });
});
```

Run: `pnpm test app/login`
Expected: FAIL (no `route.ts` files yet).

- [ ] **Step 5: The handlers**

Create `app/login/code/route.ts`:

```ts
import { connection } from "next/server";
import { isSameOrigin, notFromVossie, seeOther } from "@/lib/auth/same-origin";
import { finishCode } from "@/lib/auth/sign-in-finish";

/**
 * Step 2's Sign in (accounts spec 3.1; stage K spec decision 2). A plain form post, answered with 303, so the browser
 * loads where it leads as a new document: a page Next kept from before signing in can't replay its redirect to
 * sign-in. The Origin is checked before anything is read (spec decision 3).
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return notFromVossie();
  return seeOther(await finishCode(await request.formData(), new Date()));
}

/** Nothing to do on a GET: back to sign-in. Request-time, so the 303 is never a prerendered file (plan decision 10). */
export async function GET(): Promise<Response> {
  await connection();
  return seeOther("/login");
}
```

Create `app/login/profile/route.ts` and `app/login/sample/route.ts` the same way, with `finishProfile` ("Step 3's Continue, a first sign-in only (accounts spec 2.6; …)") and `finishSample` ("A sample account's button (accounts spec 2.8; …). The Origin check matters most here: the button needs no cookie, so without it another site could sign a visitor in as a sample account (login CSRF)").

Run: `pnpm test app/login lib/auth tests/helpers`
Expected: PASS.

Run: `pnpm lint app/login lib/auth lib/data/tags.ts tests/helpers/next-request.ts`
Expected: no output.

- [ ] **Step 6: Hand over (with Tasks 3 and 5)**

Files: `tests/helpers/next-request.ts`, `lib/data/tags.ts` (and its test if changed), `lib/auth/post-paths.ts`, `app/login/code/route.ts`, `app/login/code/route.test.ts`, `app/login/profile/route.ts`, `app/login/profile/route.test.ts`, `app/login/sample/route.ts`, `app/login/sample/route.test.ts`. Committed with Tasks 3 and 5.

---

### Task 5 (only if Task 1 held): The forms post to the handlers; the signed-in note's plain anchors

Spec 2.2's forms and 2.5's anchors, then the e2e run that proves the fix. After this task, Tasks 3 to 5 are committed together.

**Files:**
- Modify: `components/auth/SignInSteps.tsx`, `components/auth/SignInSteps.test.tsx`
- Modify: `components/auth/SignIn.tsx`, `components/auth/SignIn.test.tsx`
- Modify: `tests/e2e/sign-in-return.spec.ts` (one constant)

`app/login/page.tsx` doesn't change: it already passes `next` to `SignIn` (the spec's file list names it, but there's nothing to do).

- [ ] **Step 1: The tests**

In `components/auth/SignInSteps.test.tsx`:
- change the `vi.mock("@/lib/auth/actions", …)` factory to `({ cancelSignIn: async () => {}, resendCode: async () => {}, startSignIn: async () => {} })`;
- add `import { SIGN_IN_POSTS } from "@/lib/auth/post-paths";`;
- in "offers the sample accounts in sample mode", after the last `expect`, add:

```ts
    // A plain post to a Route Handler, which answers 303: a full page load (stage K spec decision 2).
    const list = buttons[0].closest("form")!;
    expect([list.getAttribute("action"), list.getAttribute("method")]).toEqual([SIGN_IN_POSTS.sample, "post"]);
```

- in "says where the code went, and asks for it", add:

```ts
    const signIn = screen.getByRole("button", { name: "Sign in" }).closest("form")!;
    expect([signIn.getAttribute("action"), signIn.getAttribute("method")]).toEqual([SIGN_IN_POSTS.code, "post"]);
```

- in "asks for a first name and a campus, starting on the campus given", add:

```ts
    const step3 = screen.getByRole("button", { name: "Continue" }).closest("form")!;
    expect([step3.getAttribute("action"), step3.getAttribute("method")]).toEqual([SIGN_IN_POSTS.profile, "post"]);
```

- replace the test "says who's signed in, with the way to the account (plan decision 10)" with:

```ts
  it("says who's signed in, with plain links on to next and to the account (stage K spec decision 5)", () => {
    const { unmount } = render(<SignedInNote email="student@eduvos.com" next="/looking-for/new" />);
    expect(screen.getByText(/You're signed in as/)).toHaveTextContent("You're signed in as student@eduvos.com.");
    const onward = screen.getByRole("link", { name: "Continue" });
    expect(onward).toHaveAttribute("href", "/looking-for/new");
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");
    // Plain anchors, not Next's Link: a full page load, so no kept redirect can catch them.
    expect(onward.tagName).toBe("A");
    expect(onward).not.toHaveAttribute("data-prefetch");
    unmount();
  });

  it("has no Continue without a next, or with one under /login or the account itself (plan decision 12)", () => {
    for (const next of [null, "/login?next=%2Fsaved", "/account"]) {
      const { unmount } = render(<SignedInNote email="student@eduvos.com" next={next} />);
      expect(screen.queryByRole("link", { name: "Continue" })).toBeNull();
      expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");
      unmount();
    }
  });
```

In `components/auth/SignIn.test.tsx`:
- change its `vi.mock("@/lib/auth/actions", …)` factory the same way;
- in "says who's signed in, or that sign-in isn't available", change the first `render(await SignIn({ next: null }))` to `render(await SignIn({ next: "/saved" }))`, and after `expect(screen.getByText(/You're signed in as/)).toBeInTheDocument();` add `expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/saved");`.

Run: `pnpm test components/auth`
Expected: FAIL (the forms still post to Server Actions; no Continue).

- [ ] **Step 2: The forms and the note**

In `components/auth/SignInSteps.tsx`:
- replace the actions import with `import { cancelSignIn, resendCode, startSignIn } from "@/lib/auth/actions";` and add `import { SIGN_IN_POSTS } from "@/lib/auth/post-paths";`;
- replace the file's opening comment with:

```ts
// The sign-in card's states (accounts spec 3.1). Server Components: every form is a plain post, so each step works
// before the app's JavaScript arrives (plan decision 2). Step 1, Send a new code and Use a different email post to
// Server Actions; the three posts that can start a session post to Route Handlers that answer 303, so signing in ends
// with a full page load (stage K spec decision 2).
```

- `<form action={signInAsSample} className="signin-sample-list">` → `<form action={SIGN_IN_POSTS.sample} method="post" className="signin-sample-list">`;
- `<form action={verifyCode} noValidate className="form-stack">` → `<form action={SIGN_IN_POSTS.code} method="post" noValidate className="form-stack">`;
- `<form action={completeProfile} noValidate className="form-stack">` → `<form action={SIGN_IN_POSTS.profile} method="post" noValidate className="form-stack">`;
- replace `SignedInNote` with:

```tsx
/** Where Continue leads: `next`, unless it's missing, the sign-in page itself, or the account (plan decision 12). */
function continuePath(next: string | null): string | null {
  return next && !next.startsWith("/login") && next !== "/account" ? next : null;
}

/**
 * Signed in already (spec 3.1, plan decision 10): who as, Continue on to `next`, and the account. Plain anchors, not
 * Link (stage K spec decision 5): each is a full page load, so a redirect Next kept from before signing in can't catch
 * it. The back link sits below.
 */
export function SignedInNote({ email, next }: { email: string; next: string | null }) {
  const onward = continuePath(next);
  return (
    <div className="signin-card">
      <p className="signin-lede">
        You&apos;re signed in as <strong>{email}</strong>.
      </p>
      <div className="flex flex-col gap-3">
        {onward && (
          <a href={onward} className="btn btn-primary form-submit">
            Continue
          </a>
        )}
        <a href="/account" className={onward ? "btn btn-outline text-navy form-submit" : "btn btn-primary form-submit"}>
          Your account
        </a>
      </div>
    </div>
  );
}
```

`Link` stays imported: `EmailStep` and `SignInUnavailable` use it.

In `components/auth/SignIn.tsx`, `<SignedInNote email={view.email} />` → `<SignedInNote email={view.email} next={next} />`.

Run: `pnpm test components/auth components/forms`
Expected: PASS (`components/forms/summary-ids.test.tsx` mocks `@/lib/auth/actions` with the old names too; extra names in a mock are harmless, so it isn't edited).

Run: `pnpm lint components/auth`
Expected: no output. (`@next/next/no-html-link-for-pages` doesn't fire in this app: `components/saved/SavedList.tsx` already has `<a href="/saved">`.)

- [ ] **Step 3: Switch the sign-in tests on**

In `tests/e2e/sign-in-return.spec.ts`, change `const SIGN_IN_ENDS_IN_A_PAGE_LOAD = false;` to `const SIGN_IN_ENDS_IN_A_PAGE_LOAD = true;`.

- [ ] **Step 4: Build, prove, measure**

Make the scratch copy `S="<your scratchpad>/vossie-k-task5"`, copying in every file from Tasks 3, 4 and 5 (`mkdir -p "$S/app/login/code" "$S/app/login/profile" "$S/app/login/sample"` first). From `$S`:

```bash
pnpm lint
pnpm typecheck
pnpm test 2>&1 | tail -5
pnpm build 2>&1 | tee build.log
grep -n "/login" build.log
pnpm e2e tests/e2e/sign-in-return.spec.ts --project=phone-390 --project=desktop-1440 2>&1 | tee return.log
grep -E "passed|failed|skipped" return.log
pnpm e2e tests/e2e/accounts.spec.ts tests/e2e/messaging.spec.ts tests/e2e/community-actions.spec.ts tests/e2e/staff.spec.ts tests/e2e/a11y.spec.ts --project=phone-390 --project=desktop-1440 2>&1 | tee others.log
grep -E "✘|passed|failed|skipped" others.log
pnpm e2e tests/e2e/performance.spec.ts --project=phone-390
```

Expected:
- lint, types and units clean;
- the build lists `/login/code`, `/login/profile` and `/login/sample` as dynamic (`ƒ`), with no error;
- **every test in `sign-in-return.spec.ts` passes at both sizes** (spec 2.6: "After the fix, every variant must pass");
- the other specs: every test passes. **A failure in any of them because a step now reloads the page** (a wait for a soft navigation, say) is fixed in its own file with the smallest change that keeps what it checks, and listed in the hand-over with the file added to the task's files. Any other failure: report it to the controller with the error before changing anything;
- the sign-in page's `scriptBrotli` is the Start row's 150,591, and every other page equals the Start row.

- [ ] **Step 5: Hand over (Tasks 3, 4 and 5 together)**

Files: Task 3's, Task 4's, and `components/auth/SignInSteps.tsx`, `components/auth/SignInSteps.test.tsx`, `components/auth/SignIn.tsx`, `components/auth/SignIn.test.tsx`, `tests/e2e/sign-in-return.spec.ts`, and any existing e2e spec Step 4 changed. Message:

```
feat: signing in ends with a full page load: step 2's Sign in, step 3's Continue and the sample buttons post to Route Handlers (/login/code, /login/profile, /login/sample) that check the post came from Vossie (403 otherwise) and answer 303, so a redirect to sign-in that Next kept from before signing in can't replay (stage K spec decisions 1 to 4, the spike's <outcome>). The steps' logic moves from the Server Actions to lib/auth/sign-in-finish.ts, returning paths; sellersChangedNow() expires the sellers tag with revalidateTag(…, { expire: 0 }); the signed-in note's Continue and Your account are plain anchors (decision 5). sign-in-return.spec.ts: every variant passes at 390 and 1440. Unit: <count>. JS: /login 150,591, every page the same
```

---

### Task 6: The message limits' rules, words, counts and the sample exemption

Spec 4 with plan decision 1's numbers. Server only: no component changes.

**Files:**
- Modify: `lib/messaging/rules.ts`, `lib/messaging/rules.test.ts`
- Modify: `lib/messaging/errors.ts`, `lib/messaging/errors.test.ts`
- Create: `lib/auth/sample-accounts.ts`, `lib/auth/sample-accounts.test.ts`
- Modify: `lib/data/messages.ts`, `lib/data/messages.test.ts`
- Create: `lib/messaging/limits.ts`, `lib/messaging/limits.test.ts`

- [ ] **Step 1: The tests**

In `lib/messaging/rules.test.ts` add (importing `CONVERSATIONS_PER_DAY`, `HOUR_MS`, `MESSAGES_PER_HOUR` from `./rules`):

```ts
describe("the message limits (stage K spec decision 8; Lama, 2026-10-20)", () => {
  it("allows 40 new conversations in any 24 hours and 120 messages in any hour", () => {
    expect(CONVERSATIONS_PER_DAY).toBe(40);
    expect(MESSAGES_PER_HOUR).toBe(120);
    expect(HOUR_MS).toBe(60 * 60 * 1000);
  });
});
```

In `lib/messaging/errors.test.ts` add (in its style; `messagingErrors` and `composerFields` are already imported there, or import them):

```ts
describe("the limits' words (stage K spec 4 \"Words\")", () => {
  it("says what was counted and what still works, linked to no field", () => {
    const fields = composerFields({ kind: "listing", listingId: "l-001" });
    expect(messagingErrors(["conversation-rate", "message-rate"], fields)).toEqual([
      {
        message:
          "You've started 40 conversations in the last 24 hours. You can still reply in those. Try again later to start a new one.",
        fieldId: null,
      },
      { message: "You've sent 120 messages in the last hour. Try again later.", fieldId: null },
    ]);
  });
});
```

Create `lib/auth/sample-accounts.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { isSampleAccount } from "./sample-accounts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the sample accounts (stage K spec decision 10)", () => {
  const SAMPLES = ["student@eduvos.com", "seller@eduvos.com", "pending@eduvos.com", "mentor@eduvos.com", "admin@eduvos.com"];

  it("knows the five, in sample mode", () => {
    for (const email of SAMPLES) expect(isSampleAccount({ email }), email).toBe(true);
    expect(isSampleAccount({ email: "ayanda@eduvos.com" })).toBe(false);
  });

  it("knows none of them with sample mode off", () => {
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    for (const email of SAMPLES) expect(isSampleAccount({ email }), email).toBe(false);
  });
});
```

In `lib/data/messages.test.ts`, add `countConversationsStartedSince` and `countMessagesSentSince` to the import from `./messages`, and add:

```ts
describe("counting what an account started and sent (stage K spec 4)", () => {
  const DAY_AGO = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
  const HOUR_AGO = new Date(NOW.getTime() - 60 * 60 * 1000);

  it("counts the conversations a buyer started after since: enquiries and shop questions, never offers", async () => {
    const buyer = await newBuyer();
    await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: NOW });
    await startConversation({ buyerId: buyer.id, listing: null, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: NOW });
    // Joining the conversation it already has about the calculator starts nothing (messaging spec 2.2).
    await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Again", swapOffer: null, now: later(1) });
    const request = await createRequest({ askerId: buyer.id, fields: LAMP, now: NOW });
    await startOffer({ askerId: buyer.id, request: { id: request.id, title: request.title }, sellerSlug: "tech-corner", listing: null, body: "I can help.", now: NOW });
    expect(await countConversationsStartedSince(buyer.id, DAY_AGO)).toBe(2);
  });

  it("counts only conversations after since, strictly (the 24 hours slide)", async () => {
    const buyer = await newBuyer();
    await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: DAY_AGO });
    expect(await countConversationsStartedSince(buyer.id, DAY_AGO)).toBe(0);
    expect(await countConversationsStartedSince(buyer.id, new Date(DAY_AGO.getTime() - 1))).toBe(1);
  });

  it("forgets a deleted buyer's conversations", async () => {
    const buyer = await newBuyer();
    await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: NOW });
    await forgetAccountInMessaging(buyer.id, null);
    expect(await countConversationsStartedSince(buyer.id, DAY_AGO)).toBe(0);
  });

  it("counts a buyer's messages and a seller's messages through their shop, never the other side's", async () => {
    const buyer = await newBuyer();
    const { conversationId } = await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: NOW });
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(1) });
    await sendMessage({ conversationId, accountId: buyer.id, body: "Great.", now: later(2) });
    expect(await countMessagesSentSince(buyer.id, null, HOUR_AGO)).toBe(2);
    // The sample seller's own fixture conversations are older than the hour.
    expect(await countMessagesSentSince("acc-seller", "tech-corner", HOUR_AGO)).toBe(1);
    // The same account, asked about without its shop, counts only what it sent as a buyer.
    expect(await countMessagesSentSince("acc-seller", null, HOUR_AGO)).toBe(0);
  });

  it("counts an offer's first message for the shop that sent it", async () => {
    const asker = await newBuyer();
    const request = await createRequest({ askerId: asker.id, fields: LAMP, now: NOW });
    await startOffer({ askerId: asker.id, request: { id: request.id, title: request.title }, sellerSlug: "tech-corner", listing: null, body: "I can help.", now: NOW });
    expect(await countMessagesSentSince("acc-seller", "tech-corner", HOUR_AGO)).toBe(1);
    expect(await countMessagesSentSince(asker.id, null, HOUR_AGO)).toBe(0);
  });

  it("counts only messages after since, strictly (the hour slides)", async () => {
    const buyer = await newBuyer();
    await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: HOUR_AGO });
    expect(await countMessagesSentSince(buyer.id, null, HOUR_AGO)).toBe(0);
    expect(await countMessagesSentSince(buyer.id, null, new Date(HOUR_AGO.getTime() - 1))).toBe(1);
  });
});
```

`LAMP` is a `RequestFields` value: if `messages.test.ts` already has request fields (it imports `createRequest`), reuse that constant's name; otherwise add, beside `CALCULATOR`:

```ts
const LAMP = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};
```

Check the sample seller has no fixture message within the hour before `NOW`: `data/fixtures/messages.ts`' times are before 14 October 2026 08:42 UTC less an hour. If one is inside, change the expected counts by what's there and say so in a comment.

Create `lib/messaging/limits.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationRow } from "@/lib/data/rows";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { messageLimitErrors } from "./limits";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const AYANDA = { id: "acc-ayanda", email: "ayanda@eduvos.com", seller: null };

/** `count` conversations the account started as a buyer, `minutes` ago, each with its first message. */
function started(buyerId: string, count: number, minutes: number) {
  const { conversations, messages } = sampleStore();
  for (let n = 0; n < count; n += 1) {
    const id = `conv-limit-${buyerId}-${minutes}-${n}`;
    const at = minutesAgo(minutes);
    const row: ConversationRow = {
      id,
      listingId: null,
      listingTitle: null,
      sellerSlug: "tech-corner",
      buyerId,
      sellerGone: false,
      status: "asked",
      createdAt: at,
      lastMessageAt: at,
      firstReplyAt: null,
      completedAt: null,
      confirmedAt: null,
      confirmedBy: null,
    };
    conversations.set(id, row);
    messages.set(`msg-${id}`, { id: `msg-${id}`, conversationId: id, from: "buyer", body: "Hi", swapOffer: null, sentAt: at, readAt: null });
  }
}

/** `count` more messages from the buyer in one of its conversations, `minutes` ago. */
function sent(buyerId: string, count: number, minutes: number) {
  started(buyerId, 1, minutes + 5000);
  const conversationId = `conv-limit-${buyerId}-${minutes + 5000}-0`;
  for (let n = 0; n < count; n += 1) {
    sampleStore().messages.set(`msg-extra-${minutes}-${n}`, {
      id: `msg-extra-${minutes}-${n}`,
      conversationId,
      from: "buyer",
      body: "More",
      swapOffer: null,
      sentAt: minutesAgo(minutes),
      readAt: null,
    });
  }
}

describe("messageLimitErrors (stage K spec 4; Lama, 2026-10-20)", () => {
  it("lets the 40th new conversation in 24 hours through, and refuses the 41st", async () => {
    started(AYANDA.id, 39, 60 * 23);
    expect(await messageLimitErrors(AYANDA, { newConversation: true }, NOW)).toEqual([]);
    started(AYANDA.id, 1, 30);
    expect(await messageLimitErrors(AYANDA, { newConversation: true }, NOW)).toEqual(["conversation-rate"]);
  });

  it("counts conversations only for a new one: a message into one it has goes through at 40", async () => {
    started(AYANDA.id, 40, 60);
    expect(await messageLimitErrors(AYANDA, { newConversation: false }, NOW)).toEqual([]);
  });

  it("forgets conversations started more than 24 hours ago", async () => {
    started(AYANDA.id, 40, 60 * 24 + 1);
    expect(await messageLimitErrors(AYANDA, { newConversation: true }, NOW)).toEqual([]);
  });

  it("lets the 120th message in an hour through, and refuses the 121st", async () => {
    sent(AYANDA.id, 119, 10);
    expect(await messageLimitErrors(AYANDA, { newConversation: false }, NOW)).toEqual([]);
    sent(AYANDA.id, 1, 5);
    expect(await messageLimitErrors(AYANDA, { newConversation: false }, NOW)).toEqual(["message-rate"]);
  });

  it("forgets messages sent more than an hour ago", async () => {
    sent(AYANDA.id, 120, 61);
    expect(await messageLimitErrors(AYANDA, { newConversation: false }, NOW)).toEqual([]);
  });

  it("names the conversations limit first when both are reached", async () => {
    started(AYANDA.id, 40, 30);
    sent(AYANDA.id, 120, 10);
    expect(await messageLimitErrors(AYANDA, { newConversation: true }, NOW)).toEqual(["conversation-rate"]);
    expect(await messageLimitErrors(AYANDA, { newConversation: false }, NOW)).toEqual(["message-rate"]);
  });

  it("counts a seller's messages through their shop", async () => {
    const seller = { id: "acc-sipho-2", email: "sipho2@eduvos.com", seller: { sellerSlug: "tech-corner" } };
    const { conversations, messages } = sampleStore();
    conversations.set("conv-shop", { ...([...conversations.values()][0] as ConversationRow), id: "conv-shop", sellerSlug: "tech-corner", sellerGone: false });
    for (let n = 0; n < 120; n += 1) {
      messages.set(`msg-shop-${n}`, { id: `msg-shop-${n}`, conversationId: "conv-shop", from: "seller", body: "Yes", swapOffer: null, sentAt: minutesAgo(1), readAt: null });
    }
    expect(await messageLimitErrors(seller as never, { newConversation: false }, NOW)).toEqual(["message-rate"]);
  });

  it("holds for staff as for anyone: a role changes nothing (spec decision 10)", async () => {
    started("acc-staffer", 40, 30);
    const staffer = { id: "acc-staffer", email: "staffer@eduvos.com", seller: null, roles: ["admin"] };
    expect(await messageLimitErrors(staffer, { newConversation: true }, NOW)).toEqual(["conversation-rate"]);
  });

  it("exempts each sample account in sample mode, and none with sample mode off", async () => {
    started("acc-student", 40, 30);
    const student = { id: "acc-student", email: "student@eduvos.com", seller: null };
    expect(await messageLimitErrors(student, { newConversation: true }, NOW)).toEqual([]);
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect(await messageLimitErrors(student, { newConversation: true }, NOW)).toEqual(["conversation-rate"]);
  });
});
```

`messageLimitErrors` takes `Pick<Account, "id" | "email" | "seller">`. Where a test's object doesn't match `SellerProfile` exactly (the seller test), it's cast; check `SellerProfile`'s fields in `lib/types.ts` and build a full one instead of `as never` if `pnpm typecheck` would object to the cast.

Run: `pnpm test lib/messaging lib/auth/sample-accounts.test.ts lib/data/messages.test.ts`
Expected: FAIL (the new names don't exist).

- [ ] **Step 2: The constants**

In `lib/messaging/rules.ts`, after `export const DAY_MS = 24 * 60 * 60 * 1000;` add:

```ts
export const HOUR_MS = 60 * 60 * 1000;
```

and after `REPORTS_PER_DAY` add:

```ts
/**
 * New conversations an account can start as a buyer in any 24 hours, offers left out (stage K spec decision 8; Lama,
 * 2026-10-20): the 41st within a day is refused. Well past a busy first week of term; what a spammer would need.
 */
export const CONVERSATIONS_PER_DAY = 40;
/** Messages an account can send in any hour, as buyer or seller, offers included (Lama, 2026-10-20). */
export const MESSAGES_PER_HOUR = 120;
```

- [ ] **Step 3: The words**

In `lib/messaging/errors.ts`:
- change `import { REPORT_REASONS, REPORTS_PER_DAY } from "./rules";` to `import { CONVERSATIONS_PER_DAY, MESSAGES_PER_HOUR, REPORT_REASONS, REPORTS_PER_DAY } from "./rules";`;
- change the comment above `MESSAGES` to `// A Map, so a stray code such as "toString" finds nothing. "report-rate" and the two message limits belong to no field.`;
- after the `report-rate` entry add:

```ts
  [
    "conversation-rate",
    {
      message: `You've started ${CONVERSATIONS_PER_DAY} conversations in the last 24 hours. You can still reply in those. Try again later to start a new one.`,
      field: "none",
    },
  ],
  [
    "message-rate",
    { message: `You've sent ${MESSAGES_PER_HOUR} messages in the last hour. Try again later.`, field: "none" },
  ],
```

- [ ] **Step 4: The sample accounts**

Create `lib/auth/sample-accounts.ts`:

```ts
import { sampleAccounts } from "@/data/fixtures/accounts";
import type { Account } from "@/lib/types";
import { isSampleMode } from "./config";

// The five sample accounts (accounts spec 2.8). Every end-to-end project and every demo shares them, so they're exempt
// from the message limits while sample mode is on (stage K spec decision 10). Sample mode, and with it the exemption,
// goes at launch.

const SAMPLE_EMAILS: ReadonlySet<string> = new Set(sampleAccounts.map(({ account }) => account.email));

/** Whether the account is one of the five fixtures', in sample mode. Never true with sample mode off. */
export function isSampleAccount(account: Pick<Account, "email">): boolean {
  return isSampleMode() && SAMPLE_EMAILS.has(account.email);
}
```

- [ ] **Step 5: The counts**

In `lib/data/messages.ts`, after `findConversation`, add:

```ts
/**
 * How many conversations `buyerId` started as a buyer after `since` (stage K spec 4): enquiries and shop questions.
 * Offers are left out (they have their own limit; community actions spec 2.9), and a message that joins a
 * conversation the buyer has already makes no row, so it isn't counted. A deleted buyer's rows have no buyer.
 */
export async function countConversationsStartedSince(buyerId: string, since: Date): Promise<number> {
  return [...sampleStore().conversations.values()].filter(
    (row) => row.buyerId === buyerId && !row.requestId && Date.parse(row.createdAt) > since.getTime(),
  ).length;
}

/**
 * How many messages the account sent after `since` (stage K spec 4): as the buyer in its own conversations, and as the
 * seller in its shop's (`shopSlug`, null for an account with no shop). Offers' first messages count for the shop.
 */
export async function countMessagesSentSince(accountId: string, shopSlug: string | null, since: Date): Promise<number> {
  const { conversations, messages } = sampleStore();
  let count = 0;
  for (const message of messages.values()) {
    if (Date.parse(message.sentAt) <= since.getTime()) continue;
    const row = conversations.get(message.conversationId);
    if (!row) continue;
    const mine =
      message.from === "buyer"
        ? row.buyerId === accountId
        : shopSlug !== null && !row.sellerGone && row.sellerSlug === shopSlug;
    if (mine) count += 1;
  }
  return count;
}
```

- [ ] **Step 6: `messageLimitErrors`**

Create `lib/messaging/limits.ts`:

```ts
import { isSampleAccount } from "@/lib/auth/sample-accounts";
import { countConversationsStartedSince, countMessagesSentSince } from "@/lib/data/messages";
import type { Account } from "@/lib/types";
import { CONVERSATIONS_PER_DAY, DAY_MS, HOUR_MS, MESSAGES_PER_HOUR } from "./rules";

// The limits on messages per account (stage K spec decisions 8 to 10; Lama, 2026-10-20), checked by the composer's
// Send, a reply and the offer composer's Send, after the fields and before the scam words. Both windows slide ("in the
// last 24 hours", not "today"), so nothing resets at midnight for a script to wait for. On the real backend the count
// goes with the write, in one transaction (spec decision 11); here it's an await before the write.

export type MessageLimitError = "conversation-rate" | "message-rate";

/**
 * [] when the post may go, else the one limit it meets: the conversations limit first, and only when the post would
 * start a conversation. Every account meets them, staff included; the sample accounts don't, in sample mode.
 */
export async function messageLimitErrors(
  account: Pick<Account, "id" | "email" | "seller">,
  { newConversation }: { newConversation: boolean },
  now: Date,
): Promise<MessageLimitError[]> {
  if (isSampleAccount(account)) return [];
  const dayAgo = new Date(now.getTime() - DAY_MS);
  if (newConversation && (await countConversationsStartedSince(account.id, dayAgo)) >= CONVERSATIONS_PER_DAY) {
    return ["conversation-rate"];
  }
  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const shopSlug = account.seller?.sellerSlug ?? null;
  if ((await countMessagesSentSince(account.id, shopSlug, hourAgo)) >= MESSAGES_PER_HOUR) return ["message-rate"];
  return [];
}
```

(`account.seller?.sellerSlug` is `shopSlugOf` in `lib/messaging/subjects.ts`, written out here so this module doesn't import the subjects' data readers.)

Run: `pnpm test lib/messaging lib/auth/sample-accounts.test.ts lib/data/messages.test.ts`
Expected: PASS.

Run: `pnpm lint lib/messaging lib/auth/sample-accounts.ts lib/data/messages.ts`
Expected: no output.

- [ ] **Step 7: Hand over**

Files: `lib/messaging/rules.ts`, `lib/messaging/rules.test.ts`, `lib/messaging/errors.ts`, `lib/messaging/errors.test.ts`, `lib/auth/sample-accounts.ts`, `lib/auth/sample-accounts.test.ts`, `lib/data/messages.ts`, `lib/data/messages.test.ts`, `lib/messaging/limits.ts`, `lib/messaging/limits.test.ts`. Message:

```
feat: the message limits' rules: 40 new conversations in any 24 hours (offers left out) and 120 messages in any hour, as buyer or through a shop (Lama, 2026-10-20; stage K spec decisions 8 and 10). countConversationsStartedSince and countMessagesSentSince count the store; messageLimitErrors names the one limit a post meets, conversations first; the five sample accounts are exempt in sample mode only (isSampleAccount). The words, built from the constants, belong to no field. Unit: <count>
```

---

### Task 7: The limits in the three send actions

Spec 2.9 with plan decisions 14 to 16.

**Files:**
- Modify: `lib/messaging/actions.ts`, `lib/messaging/actions.test.ts`
- Modify: `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts`
- Modify: `lib/looking-for/errors.test.ts`

- [ ] **Step 1: The tests**

In `lib/messaging/actions.test.ts`, after the `vi.mock("next/cache", …)` line, add:

```ts
// The sample accounts are exempt from the message limits in sample mode (stage K spec decision 10), and these tests
// sign in as them, so the exemption is switched off here unless a test switches it on (plan decision 16).
const samples = vi.hoisted(() => ({ exempt: false }));
vi.mock("@/lib/auth/sample-accounts", () => ({ isSampleAccount: () => samples.exempt }));
```

add `samples.exempt = false;` to the `beforeEach`, add `import type { ConversationRow } from "@/lib/data/rows";`, and add:

```ts
/** `count` conversations `buyerId` started as a buyer half an hour ago, each with its first message (plan decision 16). */
function seedConversations(buyerId: string, count: number) {
  const at = new Date(NOW.getTime() - 30 * 60_000).toISOString();
  for (let n = 0; n < count; n += 1) {
    const id = `conv-seed-${n}`;
    const row: ConversationRow = {
      id,
      listingId: null,
      listingTitle: null,
      sellerSlug: `seed-shop-${n}`,
      buyerId,
      sellerGone: false,
      status: "asked",
      createdAt: at,
      lastMessageAt: at,
      firstReplyAt: null,
      completedAt: null,
      confirmedAt: null,
      confirmedBy: null,
    };
    sampleStore().conversations.set(id, row);
    sampleStore().messages.set(`msg-${id}`, { id: `msg-${id}`, conversationId: id, from: "buyer", body: "Hi", swapOffer: null, sentAt: at, readAt: null });
  }
}

/** `count` more messages from `from` in `conversationId`, ten minutes ago. */
function seedMessages(conversationId: string, from: "buyer" | "seller", count: number) {
  const at = new Date(NOW.getTime() - 10 * 60_000).toISOString();
  for (let n = 0; n < count; n += 1) {
    sampleStore().messages.set(`msg-seed-${conversationId}-${n}`, { id: `msg-seed-${conversationId}-${n}`, conversationId, from, body: "More", swapOffer: null, sentAt: at, readAt: null });
  }
}

describe("the message limits (stage K spec 4; Lama, 2026-10-20)", () => {
  it("refuses a 41st new conversation in 24 hours, keeping what was typed and writing nothing", async () => {
    await signedInAs("acc-mentor");
    seedConversations("acc-mentor", 40);
    const conversations = sampleStore().conversations.size;
    const messages = sampleStore().messages.size;
    const redirect = await redirectSignalOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/listings/l-001/message", "replace", false]);
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-001" }))).toMatchObject({
      errors: ["conversation-rate"],
      values: { body: "Is it still available?" },
      notice: null,
    });
    expect([sampleStore().conversations.size, sampleStore().messages.size]).toEqual([conversations, messages]);
  });

  it("refuses before the scam check: no Check this before you send first", async () => {
    await signedInAs("acc-mentor");
    seedConversations("acc-mentor", 40);
    await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Pay a deposit first and I'll bring it." })));
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-001" }))).toMatchObject({
      errors: ["conversation-rate"],
      notice: null,
    });
  });

  it("lets a message into a conversation the buyer has go through at 40 conversations", async () => {
    await signedInAs("acc-mentor");
    const first = await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" })));
    seedConversations("acc-mentor", 39);
    const again = await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "And the case?" })));
    expect(again).toBe(first);
  });

  it("refuses the 121st message in an hour on a reply, keeping it", async () => {
    await signedInAs("acc-mentor");
    const thread = idOf(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" }))));
    seedMessages(thread, "buyer", 119);
    const messages = sampleStore().messages.size;
    await redirectOf(() => sendReply(form({ conversation: thread, body: "Hello again" })));
    expect(await readFormState(replyFormKey(thread))).toMatchObject({ errors: ["message-rate"], values: { body: "Hello again" } });
    expect(sampleStore().messages.size).toBe(messages);
  });

  it("refuses the 121st message in an hour on a first message too", async () => {
    await signedInAs("acc-mentor");
    const thread = idOf(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" }))));
    seedMessages(thread, "buyer", 119);
    await redirectOf(() => sendFirstMessage(form({ listing: "l-002", body: "And this one?" })));
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-002" }))).toMatchObject({ errors: ["message-rate"] });
  });

  it("lets a sample account through in sample mode (spec decision 10)", async () => {
    samples.exempt = true;
    await signedInAs("acc-mentor");
    seedConversations("acc-mentor", 40);
    expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" })))).toMatch(
      /^\/messages\/conv-/,
    );
  });
});
```

Use the account the file's other composer tests use (`acc-mentor` above, from its first test). If `acc-mentor` already has a fixture conversation about `l-001`, pick a listing it hasn't asked about and adjust the paths.

In `lib/looking-for/actions.test.ts`, add the same `samples` mock and `beforeEach` line, and in the offers' `describe` add:

```ts
  it("refuses the 121st message in an hour on an offer, after the shop's daily limit and before the scam check", async () => {
    const { id } = await posted();
    await asSeller();
    const shopThread = [...sampleStore().conversations.values()].find((row) => row.sellerSlug === "tech-corner")!.id;
    const at = new Date(STAFF_NOW.getTime() - 10 * 60_000).toISOString();
    for (let n = 0; n < 120; n += 1) {
      sampleStore().messages.set(`msg-seed-${n}`, { id: `msg-seed-${n}`, conversationId: shopThread, from: "seller", body: "Yes", swapOffer: null, sentAt: at, readAt: null });
    }
    const conversations = sampleStore().conversations.size;
    await redirectOf(() => sendOffer(form({ request: id, body: "Pay a deposit first and I'll bring it." })));
    expect(await readFormState(offerFormKey(id))).toMatchObject({ errors: ["message-rate"], notice: null });
    expect(sampleStore().conversations.size).toBe(conversations);
  });

  it("names the shop's 20 offers a day before the scam words (plan decision 14)", async () => {
    const { id } = await posted();
    for (let n = 0; n < 20; n += 1) {
      const other = await posted("acc-mentor");
      await startOffer({ askerId: "acc-mentor", request: { id: other.id, title: other.title }, sellerSlug: "tech-corner", listing: null, body: "I can help.", now: STAFF_NOW });
    }
    await asSeller();
    await redirectOf(() => sendOffer(form({ request: id, body: "Pay a deposit first and I'll bring it." })));
    expect(await readFormState(offerFormKey(id))).toMatchObject({ errors: ["offer-rate"], notice: null });
  });
```

`asSeller` and `posted` are the file's own helpers; the seeded thread is any of Tech corner's fixture conversations.

In `lib/looking-for/errors.test.ts` add (plan decision 17):

```ts
it("words the hour's message limit as messaging does (stage K spec 4)", () => {
  expect(offerErrors(["message-rate"], offerFieldIds("offer-r-001"))).toEqual([
    { message: "You've sent 120 messages in the last hour. Try again later.", fieldId: null },
  ]);
});
```

(inside its existing `describe`, importing `offerErrors` and `offerFieldIds` if it doesn't already).

Run: `pnpm test lib/messaging/actions.test.ts lib/looking-for`
Expected: FAIL on the new limit tests (nothing checks the limits yet; the offer-rate order test fails because the scam check comes first); `errors.test.ts`'s new test passes already (plan decision 17).

- [ ] **Step 2: The composer and a reply**

In `lib/messaging/actions.ts`:
- change `import { confirmSale, markCompleted, rejectSale, sendMessage, startConversation } from "@/lib/data/messages";` to `import { confirmSale, findConversation, markCompleted, rejectSale, sendMessage, startConversation } from "@/lib/data/messages";`;
- add `import { messageLimitErrors } from "./limits";` after `import { clearOwnFormState } from "./form-state";`;
- in `sendFirstMessage`, between the field-errors block (`if (errors.length > 0) { … back(path); }`) and `const warnings = …`, add:

```ts
  // The limits (stage K spec decision 9): after the fields, before the scam words, so a refusal never follows a
  // "Check this before you send". A message into a conversation the buyer has already starts nothing.
  const newConversation = (await findConversation(account.id, target)) === null;
  const limits = await messageLimitErrors(account, { newConversation }, now);
  if (limits.length > 0) {
    await writeFormState(form, { errors: limits, values, notice: null }, now);
    back(path);
  }
```

- in `sendReply`, between the `if (message.error) { … back(path); }` block and `const warnings = …`, add:

```ts
  // The hour's messages (stage K spec decision 9), before the scam words.
  const limits = await messageLimitErrors(account, { newConversation: false }, now);
  if (limits.length > 0) {
    await writeFormState(form, { errors: limits, values: { body }, notice: null }, now);
    back(path);
  }
```

- add to `sendFirstMessage`'s doc comment, after "…unless Send anyway was pressed (spec 2.3, plan decision 9).": " The message limits come between the two (stage K spec decision 9)."

- [ ] **Step 3: The offer**

In `lib/looking-for/actions.ts`:
- add `import { messageLimitErrors } from "@/lib/messaging/limits";` after the `@/lib/messaging/form-state` import;
- in `sendOffer`, move the block

```ts
  if ((await countOffersSince(status.shopSlug, new Date(now.getTime() - DAY_MS))) >= OFFERS_PER_DAY) {
    await writeFormState(form, { errors: ["offer-rate"], values, notice: null }, now);
    back(path);
  }
```

from after the scam-words block to straight after the `if (message.error) { … }` block, and follow it with:

```ts
  // The hour's messages (stage K spec decision 9): after the shop's daily offers, before the scam words, so a refusal
  // never follows a "Check this before you send" (plan decision 14).
  const limits = await messageLimitErrors(account, { newConversation: false }, now);
  if (limits.length > 0) {
    await writeFormState(form, { errors: limits, values, notice: null }, now);
    back(path);
  }
```

- in `sendOffer`'s doc comment, replace "then E's scam words unless Send anyway was pressed; a listing only if it's one of the shop's listed ones (plan decision 13); at most 20 a shop in 24 hours." with "then at most 20 a shop in 24 hours and stage K's 120 messages an hour, then E's scam words unless Send anyway was pressed; a listing only if it's one of the shop's listed ones (plan decision 13)."

Run: `pnpm test lib/messaging lib/looking-for`
Expected: PASS, the existing tests included (the "stops at 20 offers a shop in a day" test's body has no scam words, so the move doesn't change it).

Run: `pnpm lint lib/messaging lib/looking-for`
Expected: no output.

- [ ] **Step 4: The whole suite in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-k-task7"` with Task 6's and this task's files. From `$S`: `pnpm lint`, `pnpm typecheck`, `pnpm test 2>&1 | tail -5`.
Expected: clean, all passing.

- [ ] **Step 5: Hand over**

Files: `lib/messaging/actions.ts`, `lib/messaging/actions.test.ts`, `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts`, `lib/looking-for/errors.test.ts`. Message:

```
feat: the composer, a reply and the offer composer check the message limits after the fields and before the scam words: a 41st new conversation in 24 hours, or a 121st message in an hour, is refused with what was typed kept and nothing written (stage K spec decision 9; Lama, 2026-10-20). The offer's 20-a-day check moves before the scam words too (plan decision 14). Unit: <count>
```

---

### Task 8: Keyed hashes under `VOSSIE_AUTH_HMAC_KEY`

Spec 5 and decisions 12 to 15, with plan decisions 18 and 19.

**Files:**
- Modify: `lib/auth/secrets.ts`, `lib/auth/secrets.test.ts`
- Modify: `lib/data/store.ts`
- Modify: `lib/auth/session.test.ts`
- Modify: `vitest.setup.ts`
- Modify: `.env.example`

- [ ] **Step 1: Re-read `.env.example` at HEAD**

The Supabase merge changed it. Read it whole; Step 6 appends after its last block.

- [ ] **Step 2: The tests**

Replace `lib/auth/secrets.test.ts`'s test "keeps a token as its SHA-256, in hex" with the block below, and add `readdirSync` to the `node:fs` import and `afterEach, vi` to the vitest import:

```ts
const KEY = "a-test-key-that-is-long-enough-0123456789";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A fresh copy of the module, so authKey() reads the environment as this test sets it (plan decision 18). */
async function fresh(env: { key?: string; sampleMode?: "0" }) {
  vi.resetModules();
  vi.stubEnv("VOSSIE_AUTH_HMAC_KEY", env.key);
  if (env.sampleMode) vi.stubEnv("VOSSIE_SAMPLE_MODE", env.sampleMode);
  return import("./secrets");
}

describe("keyed hashes (stage K spec 5)", () => {
  it("hashes a token with HMAC-SHA-256 under the key, in hex, the same every time", async () => {
    const { hashToken } = await fresh({ key: KEY });
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc")).toBe(hashToken("abc"));
    // Not the plain SHA-256 a leaked store could be checked against.
    expect(hashToken("abc")).not.toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("gives another hash under another key", async () => {
    const first = (await fresh({ key: KEY })).hashToken("abc");
    const second = (await fresh({ key: `${KEY}-rotated` })).hashToken("abc");
    expect(first).not.toBe(second);
  });

  it("never gives a token the hash of a code, whatever joins to the same text (the purpose prefixes)", async () => {
    const { hashCode, hashToken } = await fresh({ key: KEY });
    expect(hashToken("key-a:123456")).not.toBe(hashCode("key-a", "123456"));
  });

  it("uses the development key with one warning, however many hashes, when unset in sample mode", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { hashCode, hashToken } = await fresh({ key: undefined });
    hashToken("a");
    hashToken("b");
    hashCode("k", "123456");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe(
      "[vossie] VOSSIE_AUTH_HMAC_KEY is not set, so sign-in codes and sessions are hashed with the development key. Set it before any real account signs in.",
    );
  });

  it("refuses a short key in any mode, without saying what it was", async () => {
    const { hashToken } = await fresh({ key: "short-key-31-characters-long-xx" });
    expect(() => hashToken("abc")).toThrow("VOSSIE_AUTH_HMAC_KEY is too short: use at least 32 characters.");
    try {
      hashToken("abc");
    } catch (error) {
      expect(String(error)).not.toContain("short-key-31");
    }
  });

  it("refuses to hash with no key when sample mode is off", async () => {
    const { hashToken } = await fresh({ key: undefined, sampleMode: "0" });
    expect(() => hashToken("abc")).toThrow("VOSSIE_AUTH_HMAC_KEY must be set when sample mode is off.");
  });

  it("reads nothing when imported, so a build without the key can't fail (spec decision 14)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fresh({ key: undefined, sampleMode: "0" })).resolves.toBeDefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("leaves no unkeyed hash in lib/auth (spec 5 \"Tests\")", () => {
    const folder = join(process.cwd(), "lib/auth");
    for (const file of readdirSync(folder).filter((name) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name))) {
      expect(readFileSync(join(folder, file), "utf8"), file).not.toMatch(/createHash\(/);
    }
  });
});
```

The other tests in the file (random tokens, codes with leading zeros, `randomInt`, a code hashed with its attempt's key, constant-time `codeMatches`, a broken stored hash) stay: they use the static import and run under the test key from `vitest.setup.ts` (Step 4). In "checks a code in constant time", the source check `timingSafeEqual(expected, actual)` stays true.

If `vi.stubEnv(name, undefined)` isn't accepted by Vitest 5.0's types, use `delete process.env.VOSSIE_AUTH_HMAC_KEY` in `fresh` and restore the setup key in `afterEach` (`process.env.VOSSIE_AUTH_HMAC_KEY = TEST_KEY`), and say so in the hand-over.

In `lib/auth/session.test.ts`, add `STORE_VERSION` to the import from `@/lib/data/store`, and add, in the describe that covers `getViewer`:

```ts
  it("finds no session stored before the store's version moved, as the keyed hashes need (stage K spec decision 15)", async () => {
    await signedInAs("acc-student");
    expect((await getViewer())?.id).toBe("acc-student");
    sampleStore().version = STORE_VERSION - 1;
    expect(await getViewer()).toBeNull();
  });
```

Run: `pnpm test lib/auth/secrets.test.ts lib/auth/session.test.ts`
Expected: FAIL (still SHA-256; no warning; nothing refused). The session test passes already (a version move has always reseeded); it pins the behaviour spec decision 15 relies on.

- [ ] **Step 3: The keyed hashes**

Replace the whole of `lib/auth/secrets.ts` with:

```ts
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { isSampleMode } from "./config";

// Tokens and codes (accounts spec sections 4 and 5; stage K spec decisions 12 to 15). Making one reads randomness, so
// only Server Actions and Route Handlers call newToken() and newCode(), never a render. Hashes are HMAC-SHA-256 under a
// server secret, VOSSIE_AUTH_HMAC_KEY, so a leaked copy of the store gives back no codes and no live sessions. The key
// is read the first time something is hashed, never at module scope: `next build` prerenders without cookies, so it
// never hashes, and a missing runtime secret can't fail a build.

/** The shortest key accepted (stage K spec decision 14). `openssl rand -base64 32` makes a 44-character one. */
export const AUTH_KEY_MIN_LENGTH = 32;

/** Sample mode's stand-in when the key is unset. Public on purpose: it protects nothing, and the log says so. */
const DEVELOPMENT_KEY = "vossie-development-key-not-a-secret";

let cachedKey: string | null = null;

/**
 * The key, read once per server process (plan decision 18). Set, with at least 32 characters: used as given. Set but
 * shorter: refused in any mode. Unset in sample mode: the development key, with one warning per process. Unset with
 * sample mode off: refused. A refusal is never cached, and no message includes the value.
 */
export function authKey(): string {
  if (cachedKey !== null) return cachedKey;
  const key = process.env.VOSSIE_AUTH_HMAC_KEY;
  if (key) {
    if (key.length < AUTH_KEY_MIN_LENGTH) {
      throw new Error("VOSSIE_AUTH_HMAC_KEY is too short: use at least 32 characters.");
    }
    cachedKey = key;
  } else if (isSampleMode()) {
    console.warn(
      "[vossie] VOSSIE_AUTH_HMAC_KEY is not set, so sign-in codes and sessions are hashed with the development key. Set it before any real account signs in.",
    );
    cachedKey = DEVELOPMENT_KEY;
  } else {
    throw new Error("VOSSIE_AUTH_HMAC_KEY must be set when sample mode is off.");
  }
  return cachedKey;
}

/** HMAC-SHA-256 of `purpose:value` under the key, in hex. The purpose keeps a token's hash and a code's apart. */
function keyedHash(purpose: "token" | "code", value: string): string {
  return createHmac("sha256", authKey()).update(`${purpose}:${value}`).digest("hex");
}

/** A random token for a cookie: a session's or a sign-in attempt's. */
export function newToken(): string {
  return randomUUID();
}

/** What the store keeps instead of a token (spec decision 12): its keyed hash. */
export function hashToken(token: string): string {
  return keyedHash("token", token);
}

/** A 6-digit code, leading zeros kept. */
export function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** A code's keyed hash, salted with its attempt's key, so the same code hashes differently for every attempt (spec 5). */
export function hashCode(attemptKey: string, code: string): string {
  return keyedHash("code", `${attemptKey}:${code}`);
}

/** Whether `code` is the attempt's code. The hashes are compared in constant time (spec 5). */
export function codeMatches(attemptKey: string, code: string, storedHash: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashCode(attemptKey, code), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
```

- [ ] **Step 4: A key for the unit tests**

In `vitest.setup.ts`, after the imports and before `// --- Next.js modules …`, add:

```ts
// --- A key for the keyed hashes ---------------------------------------------

// lib/auth/secrets.ts hashes under VOSSIE_AUTH_HMAC_KEY and, without it in sample mode, warns once per process with
// the development key (stage K plan decision 19). Every unit test file is a process of its own here, so without this
// the warning would print in each. lib/auth/secrets.test.ts unsets it where a test needs that.
process.env.VOSSIE_AUTH_HMAC_KEY ??= "vitest-only-key-0123456789-0123456789-ab";
```

- [ ] **Step 5: The store's version**

In `lib/data/store.ts`, `export const STORE_VERSION = 9;` → `export const STORE_VERSION = 10;` (or one more than whatever Recheck item 4 found), and change its comment to:

```ts
/**
 * Bump it when a table is added or a row changes shape, so `next dev` reseeds instead of keeping an old store. 10:
 * sessions, sign-in attempts and codes are hashed with a key (stage K spec decision 15), so no old row is ever matched.
 */
```

Run: `pnpm test lib/auth lib/data/store.test.ts`
Expected: PASS.

- [ ] **Step 6: `.env.example`**

The Supabase block (`84f61a1`) already lists `# VOSSIE_AUTH_HMAC_KEY=` with no explanation. So the variable appears once, with its rules: delete that one line from the Supabase block (its other lines stay as they are), then append to `.env.example`, after its last block and a blank line:

```
# The secret that keys the hashes of sign-in codes, session tokens and sign-in attempt tokens (stage K). At least 32
# characters: make one with `openssl rand -base64 32`. Unset in sample mode, a fixed development key is used and the
# server logs a warning; unset with sample mode off, signing in refuses to run. Changing it signs everyone out.
# VOSSIE_AUTH_HMAC_KEY=
```

- [ ] **Step 7: The whole suite, and a build with no key, in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-k-task8"` with this task's files. From `$S`:

```bash
pnpm lint
pnpm typecheck
pnpm test 2>&1 | tail -5
env -u VOSSIE_AUTH_HMAC_KEY pnpm build 2>&1 | tee build.log
grep -c "VOSSIE_AUTH_HMAC_KEY" build.log
```

Expected: clean, all passing; the build exits 0 and the last `grep` prints `0` (nothing hashed while prerendering, so no warning in the build). Then:

```bash
pnpm e2e tests/e2e/accounts.spec.ts tests/e2e/sign-in-return.spec.ts --project=desktop-1440 2>&1 | tail -5
```

Expected: all pass (sign-in works under the development key). Treat any `accounts.spec.ts` failure as in Task 2, Step 8.

- [ ] **Step 8: Hand over**

Files: `lib/auth/secrets.ts`, `lib/auth/secrets.test.ts`, `lib/auth/session.test.ts`, `lib/data/store.ts`, `vitest.setup.ts`, `.env.example`. Message:

```
feat: sign-in codes, session tokens and sign-in attempt tokens are hashed with HMAC-SHA-256 under VOSSIE_AUTH_HMAC_KEY, with purpose prefixes, so a leaked store gives back nothing (stage K spec decisions 12 and 13). The key is read on first use, never at build: 32 characters or more; in sample mode a development key with one warning when unset; refused when too short, or unset with sample mode off (decision 14). STORE_VERSION 10, so every old row resets (decision 15). .env.example names the variable. Unit: <count>
```

---

### Task 9: The info pages say what's true today

Spec 6 and decisions 16 and 17, with plan decisions 5 and 20. Words only. Use the day you build this task as `updated` (SAST, `YYYY-MM-DD`); the snippets say `2026-10-20`.

**Files:**
- Modify: `app/how-it-works/page.tsx`, `app/how-it-works/page.test.tsx`
- Modify: `app/trust/page.tsx`, `app/trust/page.test.tsx`
- Modify: `app/safety/page.tsx`, `app/safety/page.test.tsx`
- Modify: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`
- Modify: `tests/e2e/info.spec.ts`

- [ ] **Step 1: Re-read `app/privacy/page.test.tsx` at HEAD**

The Supabase merge changed it. Keep every test that's there. If one pins a sentence spec 6 changes, report it to the controller before editing.

- [ ] **Step 2: The tests**

In `app/how-it-works/page.test.tsx`, in "answers six short questions, including what works today", after the `queryByText(/once selling opens|Selling arrives/)` line, add:

```ts
    // What stages H to J added (stage K spec 6).
    expect(within(questions).getByText(/Messaging, selling, reporting, posting a request, following a shop, saving a search/)).toBeInTheDocument();
    expect(within(questions).getByText(/save a search and hear when a new listing matches it/)).toBeInTheDocument();
    expect(within(questions).getByText(/Notifications show on Vossie only: nothing is emailed yet\./)).toBeInTheDocument();
    expect(within(questions).queryByText(/Messaging and selling need an account/)).toBeNull();
```

In `app/trust/page.test.tsx`:
- "has one h1 and four sections" becomes "has one h1 and five sections", and its list gains `"When something is reported",` after `"What counts",`;
- `expect(metadata.description).toMatch(/Verified sellers/);` gains a second line `expect(metadata.description).toMatch(/what happens after a report/);`;
- add:

```ts
  it("says what the Hub does with a report, Show again included (stage K spec 6)", () => {
    render(<TrustPage />);
    const reports = screen.getByRole("region", { name: "When something is reported" });
    expect(within(reports).getByText(/report a listing, a shop or a Looking For request/)).toBeInTheDocument();
    expect(within(reports).getByText(/never names them to the seller/)).toBeInTheDocument();
    expect(within(reports).getByText(/it can show it again/)).toBeInTheDocument();
    expect(within(reports).getByText(/only a Hub admin can give someone that role/)).toBeInTheDocument();
  });
```

In `app/safety/page.test.tsx`, replace `/Every listing and every seller's page has a Report link/` with `/Every listing, every seller's page and every Looking For request has a Report link/`, and add after that line:

```ts
    expect(within(reporting).getByText(/can hide a listing or a request, or pause an account/)).toBeInTheDocument();
    expect(within(reporting).queryByText(/can hide a listing or pause an account\./)).toBeNull();
```

In `app/privacy/page.test.tsx`, add:

```ts
describe("what stages H to K changed in the policy (stage K spec 6)", () => {
  it("opens Your account with everything that needs one, never the old \"Messaging, selling and, later\"", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(account).toHaveTextContent(
      "You need an account to message, sell, report, post on Looking For, follow shops, save searches and RSVP to the Hub.",
    );
    expect(account).not.toHaveTextContent("Messaging, selling and, later");
  });

  it("says a code and the session are kept only as keyed fingerprints", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("region", { name: "Your account" })).toHaveTextContent(
      "A sign-in code is kept only as a fingerprint made with a secret key, and only until you finish signing in or the attempt runs out after 30 minutes.",
    );
    expect(screen.getByRole("region", { name: "What this site stores today" })).toHaveTextContent(
      "Vossie's server keeps only a fingerprint of it, made with a secret key, so the code can't be read back from the server's records.",
    );
  });

  it("lists every kind of notification, and what a staff role keeps", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(account).toHaveTextContent(/a search you saved has a new match, the Hub acts on your report/);
    expect(account).toHaveTextContent(/your staff role changes\. Only you see them\./);
    expect(within(account).getByText(/If you're Hub staff: your role\./)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "What this site stores today" })).toHaveTextContent(
      "your consent, your staff role if you have one, your Looking For requests",
    );
  });
});
```

(importing `within` if the file doesn't).

In `tests/e2e/info.spec.ts`, the `/trust` case's `sections` becomes `["Verified by the Hub", "The three badges", "What counts", "When something is reported", "How Featured today is picked"]`.

Run: `pnpm test app/how-it-works app/trust app/safety app/privacy app/info-pages.test.tsx`
Expected: FAIL on the new checks.

- [ ] **Step 3: How it works**

In `app/how-it-works/page.tsx`, replace the paragraph under `<h3>Who can use Vossie?</h3>` with:

```tsx
        <p>
          Anyone can browse, save and share listings, and read Looking For and the Hub. Messaging, selling, reporting,
          posting a request, following a shop, saving a search and saying you&apos;ll go to a Hub event need an
          account. Accounts are for Eduvos students, who sign in with their Eduvos email address.
        </p>
```

and the paragraph under `<h3>What can I do on Vossie today?</h3>` with:

```tsx
        <p>
          Browse every campus, save listings on your device and share them, and sign in with your Eduvos email. Signed
          in, you can message sellers, report a problem, ask for something on Looking For and read shops&apos; offers,
          follow shops, save a search and hear when a new listing matches it, say you&apos;ll go to a Hub event or ask
          for an office-hours slot, and set up a shop of your own.
        </p>
        <p>
          While Vossie is a preview, what you add lives in the server&apos;s memory, so it can disappear when the
          server restarts. Notifications show on Vossie only: nothing is emailed yet.
        </p>
```

`updated="2026-10-15"` → `updated="2026-10-20"`.

- [ ] **Step 4: How trust works**

In `app/trust/page.tsx`:
- `description` becomes `"How Vossie decides who to trust: Verified sellers, the New seller, Responsive and Trusted badges, what happens after a report, and how Featured today is picked."`;
- after the `trust-counts` section's closing `},`, add:

```tsx
  // Sample wording for later review: Lama kept the spec's sentences "for now" on 2026-10-20 (stage K plan decision 5).
  {
    id: "trust-reports",
    title: "When something is reported",
    children: (
      <>
        <p>
          Anyone signed in can report a listing, a shop or a Looking For request. A member of the Hub team reads every
          report.
        </p>
        <p>
          The Hub can hide a listing or a request, or pause a shop. It tells the seller, or the student who asked, and
          they can see why. It tells the person who reported it that the Hub has acted, and never names them to the
          seller.
        </p>
        <p>
          If the Hub hid something it shouldn&apos;t have, it can show it again, and tells the seller or the student
          who asked. Hub staff are mentors and admins from the Eduvos Incubation Hub, and only a Hub admin can give
          someone that role.
        </p>
      </>
    ),
  },
```

- `updated="2026-10-18"` → `updated="2026-10-20"`.

- [ ] **Step 5: Safety**

In `app/safety/page.tsx`, the first paragraph of `safety-reporting` becomes:

```tsx
        <p>
          If a listing, a request or a person worries you, report it. Every listing, every seller&apos;s page and every
          Looking For request has a Report link. Reporting needs an account: signed out, the link takes you to sign in
          first, then to the report. A member of the Hub team reads every report, and can hide a listing or a request,
          or pause an account.
        </p>
```

`updated="2026-10-14"` → `updated="2026-10-20"`.

- [ ] **Step 6: The privacy policy**

In `app/privacy/page.tsx`, editing by the exact text that's there now:
- in "What this site stores today"'s first paragraph, `your sign-ins, your consent, your` → `your sign-ins, your consent, your staff role if you have one, your`;
- the `vossie_session` item becomes:

```tsx
          <li>
            <code>vossie_session</code>: a random code that keeps you signed in, for up to 30 days. Vossie&apos;s
            server keeps only a fingerprint of it, made with a secret key, so the code can&apos;t be read back from the
            server&apos;s records. Signing out or deleting your account ends it.
          </li>
```

- "Your account"'s opening paragraph becomes:

```tsx
        <p>
          You need an account to message, sell, report, post on Looking For, follow shops, save searches and RSVP to
          the Hub. Later, keeping your saved listings on every device will need one too. This is what your account
          holds, and why.
        </p>
```

- the email bullet becomes:

```tsx
          <li>
            <strong>Your Eduvos email address.</strong> To check that you are an Eduvos student and to send you sign-in
            codes. A sign-in code is kept only as a fingerprint made with a secret key, and only until you finish
            signing in or the attempt runs out after 30 minutes. Allowed under POPIA section 11: it is needed to run the
            account you ask for.
          </li>
```

- the notifications bullet becomes:

```tsx
          <li>
            <strong>Your notifications.</strong> A note when someone messages you, a sale needs confirming, a shop
            offers to help with your request, a shop you follow lists something new, a search you saved has a new
            match, the Hub acts on your report, your shop, your listing or your request, or your staff role changes.
            Only you see them. Allowed under POPIA section 11: needed to run your account.
          </li>
```

- after the "A log of what Hub staff do." item, add:

```tsx
          <li>
            <strong>If you&apos;re Hub staff: your role.</strong> Whether you&apos;re a mentor or an admin. A Hub admin
            gives the role using your exact Eduvos email, and Hub admins see the first name, email and campus of
            everyone with a role. Nobody can search or list students who don&apos;t have one. Allowed under POPIA
            section 11: our legitimate interest in running Vossie safely.
          </li>
```

- `updated` becomes `"2026-10-20"` (it may already be). The draft banner stays.

Run: `pnpm test app`
Expected: PASS, `app/info-pages.test.tsx` included (the new section id starts `trust-`).

Run: `pnpm lint app/how-it-works app/trust app/safety app/privacy tests/e2e/info.spec.ts`
Expected: no output.

- [ ] **Step 7: Measure the privacy page, and the info pages' e2e, in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-k-task9"` with this task's files. From `$S`:

```bash
pnpm e2e tests/e2e/info.spec.ts --project=phone-390 --project=desktop-1440 2>&1 | tail -3
pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 2>&1 | grep -E "privacy page|info page"
```

Expected: all pass; `privacy page` and `info page` `scriptBrotli` equal to the Start row. Axe on the four pages runs in `a11y.spec.ts` (every device project); Task 10's run includes it.

- [ ] **Step 8: Hand over**

Files: the four pages and their tests, `tests/e2e/info.spec.ts`. Message:

```
docs: the info pages say what's true after stages H to J: How it works names everything that needs an account and what you can do today; How trust works gains "When something is reported" (with Show again; sample wording Lama kept for now); Safety says requests can be reported and hidden; the privacy policy opens Your account with everything that needs one, lists every notification, says what a staff role keeps, and says codes and sessions are kept only as keyed fingerprints (stage K spec section 6). Unit: <count>. JS: privacy 150,591
```

---

### Task 10: End to end: the message limit, checks and size

Spec 4 "Tests" and the stage's checks, with plan decision 22.

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/hardening-writes.spec.ts`

- [ ] **Step 1: Check the files are still yours to edit**

Run: `git --no-optional-locks status --short playwright.config.ts tests/e2e`
Expected: only this stage's uncommitted files, if any. If `playwright.config.ts` is modified by someone else, stop and report.

- [ ] **Step 2: The project**

In `playwright.config.ts`, after the `STAFF_ACCOUNTS` line add:

```ts
// Stage K's message-limit test starts 40 conversations as a fresh account, which the sample shops' inboxes then show,
// so it runs after every other test (stage K plan decision 22).
const HARDENING_WRITES = /hardening-writes\.spec\.ts$/;
```

In each of the five device projects, add `HARDENING_WRITES` to the end of `testIgnore`'s list (five lines, the same change). After the `staff-accounts-writes` project add:

```ts
    // After everything else (stage K plan decision 22). Run it alone with --project=hardening-writes --no-deps.
    {
      name: "hardening-writes",
      use: desktop(1440, 900),
      testMatch: HARDENING_WRITES,
      dependencies: [...DEVICE_PROJECTS, "selling-writes", "staff-writes", "community-writes", "alerts-writes", "staff-accounts-writes"],
    },
```

- [ ] **Step 3: The test**

Create `tests/e2e/hardening-writes.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { bubble, button, field, main, newBuyer, reply, signUp } from "./helpers/messaging";
import { POST_LANDS } from "./helpers/selling";

// Stage K's message limit, end to end (spec 4 "Tests"; Lama, 2026-10-20: 40 new conversations a day). It runs last, in
// the hardening-writes project: a fresh account starts 40 conversations with the sample shops, whose inboxes then show
// them. The hour's 120 is unit-tested only: 121 posts would make a slow test of a rule the unit tests pin.

const CONVERSATIONS_PER_DAY = 40;

// Every composer a fresh buyer might open: the sample listings, then the sample shops' questions. Some won't take a
// message by the time this runs (sold, paused, or hidden by the staff tests), so the test skips any without a form.
const LISTINGS = Array.from({ length: 31 }, (_, n) => `/listings/l-${String(n + 1).padStart(3, "0")}/message`);
const SHOPS = [
  "hair-studio", "maths-tutor", "home-bakery", "design-studio", "thrift-rack", "code-coach", "phone-fix", "nail-bar",
  "study-notes", "res-kitchen", "tech-corner", "book-swap", "res-deals", "closet-clear-out", "ticket-desk",
  "res-essentials", "lash-lounge", "stationery-stop", "bookshelf", "moving-out-sale", "kitchen-kit", "weekend-market",
  "accounting-tutor", "study-desk", "room-refresh", "sports-kit", "drawing-office", "cv-clinic", "logo-lab",
].map((slug) => `/sellers/${slug}/message`);

/** Opens the next composer on the list that has a message field; null when the list runs out. */
async function nextComposer(page: Page, remaining: string[]): Promise<string | null> {
  for (let path = remaining.shift(); path; path = remaining.shift()) {
    await page.goto(path, { waitUntil: "networkidle" });
    if ((await field(page, "Your message").count()) > 0) return path;
  }
  return null;
}

test("a fresh account starts 40 conversations in a day; the 41st is refused with what was typed kept, and a reply still goes", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(480_000);
  const context = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const page = await context.newPage();
  await signUp(page, newBuyer());
  const remaining = [...LISTINGS, ...SHOPS];
  const threads: string[] = [];
  while (threads.length < CONVERSATIONS_PER_DAY) {
    const path = await nextComposer(page, remaining);
    expect(path, "enough open listings and shops to start 41 conversations").not.toBeNull();
    await field(page, "Your message").fill(`Hello, is this still on offer? (${threads.length + 1})`);
    await button(page, "Send").click();
    await expect(page).toHaveURL(/\/messages\/conv-[0-9a-f-]{36}$/, POST_LANDS);
    threads.push(new URL(page.url()).pathname);
  }

  // Without the app's JavaScript: a page load is what focuses the error summary (accounts plan decision 11).
  await context.route("**/_next/static/**/*.js", (route) => route.abort());
  const last = await nextComposer(page, remaining);
  expect(last, "a 41st composer").not.toBeNull();
  const typed = "Hello, is this still on offer? (41)";
  await field(page, "Your message").fill(typed);
  await button(page, "Send").click();
  const summary = main(page).locator(".form-summary").filter({ visible: true });
  await expect(summary).toContainText(
    "You've started 40 conversations in the last 24 hours. You can still reply in those. Try again later to start a new one.",
    POST_LANDS,
  );
  await expect(summary).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`${last!.replace(/[/]/g, "\\/")}$`));
  await expect(field(page, "Your message")).toHaveValue(typed);
  // The composer showing the limit (spec 4 "Checks", at 1440px).
  expect(await seriousIssues(page)).toEqual([]);
  await context.unroute("**/_next/static/**/*.js");

  // A reply in one of its 40 conversations isn't a new conversation, so it goes (spec 4 "Behaviour").
  await page.goto(threads[0]);
  await reply(page, "Can I collect it tomorrow?");
  await expect(bubble(page, "Can I collect it tomorrow?")).toBeVisible(POST_LANDS);
  await context.close();
});
```

`reply` and `bubble` are `tests/e2e/helpers/messaging.ts`'s (imported, not edited).

Run: `pnpm lint tests/e2e/hardening-writes.spec.ts playwright.config.ts`
Expected: no output.

- [ ] **Step 4: Run it, the stage's checks and the size, in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-k-task10"` with this task's files. From `$S`:

```bash
pnpm e2e tests/e2e/hardening-writes.spec.ts --project=hardening-writes --no-deps 2>&1 | tail -5
pnpm e2e tests/e2e/sign-in-return.spec.ts tests/e2e/a11y.spec.ts tests/e2e/info.spec.ts --project=phone-390 --project=desktop-1440 2>&1 | tail -5
pnpm e2e tests/e2e/performance.spec.ts --project=phone-390
```

Expected: 1 passed; the device runs pass (any failure from a reloaded sign-in or sign-out is handled as in Task 5, Step 4); every `scriptBrotli` equal to the Start row. Fill in the ledger's Task 10 row in your report.

- [ ] **Step 5: Hand over**

Files: `playwright.config.ts`, `tests/e2e/hardening-writes.spec.ts`. Message:

```
test: stage K's message limit end to end, in a new hardening-writes project that runs last: a fresh account starts 40 conversations with the sample shops, the 41st is refused with the summary focused without JavaScript and the message kept, axe finds nothing on that composer, and a reply in one of the 40 still goes (spec section 4; Lama, 2026-10-20). JS: every page the same to the byte
```

---

### Task 11: Docs and final checks

The stage's records. **`docs/PROGRESS.md` and `docs/reference/LANDING-DECISIONS.md` carry other sessions' uncommitted lines, so this task doesn't edit them:** it writes their new text as `k-progress.md` and `k-decision.md` in the scratchpad `/private/tmp/claude-501/-Users-LamaNkuna-Projects-Vossie/27a3bf01-5279-40ef-b17d-be68f2ee9fa1/scratchpad/`, and the controller merges them.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-20-hardening-design.md`
- Modify: `docs/reference/GO-LIVE.md`
- Modify: `docs/superpowers/plans/2026-10-20-hardening.md` (this plan)
- Create (scratchpad, not the project): `k-progress.md`, `k-decision.md`

- [ ] **Step 1: Check the docs are still yours to edit**

Run: `git --no-optional-locks status --short CLAUDE.md docs/reference/GO-LIVE.md docs/superpowers/specs/2026-10-20-hardening-design.md docs/superpowers/plans/2026-10-20-hardening.md`
Expected: no output. If any shows as modified by someone else, stop and report.

- [ ] **Step 2: Screenshots: none**

Nothing new is drawn except Continue on the signed-in note and the limit's message in an existing summary. No screenshots spec is added; say so in the progress snippet.

- [ ] **Step 3: CLAUDE.md**

**Only if the sign-in fix was built (Tasks 3 to 5):**
- in the line that starts `- Who's signed in comes only from`, replace `Forms are plain \`<form action={serverAction}>\`:` with `Forms are plain \`<form action={serverAction}>\`, except the three sign-in posts that start a session and sign-out, which post to Route Handlers that answer 303 (stage K):`;
- replace the line that starts `- Never link a signed-out visitor straight at a page that needs sign-in.` with:

```md
- Prefer `signInHref(next)` or a session-following link (a `<Suspense>` whose fallback is the sign-in link and whose server child streams in the real one) for signed-out visitors: it saves a bounce. A direct link is no longer a trap: sign-in ends with a full page load (stage K).
```

**If the spike didn't reproduce:** in the `Forms are plain…` line, add only the sign-out exception: `…, except sign-out, which posts to a Route Handler that answers 303 (stage K):`. The "Never link…" line stays.

**Either way**, add after the line that starts `- Messaging's Server Actions end every write with \`done()\``:

```md
- The composer, a reply and the offer composer check `messageLimitErrors` (`lib/messaging/limits.ts`) after the fields and before the scam words: 40 new conversations in any 24 hours, offers left out, and 120 messages in any hour. The five sample accounts are exempt only in sample mode (`isSampleAccount`, `lib/auth/sample-accounts.ts`).
- Sign-in codes, session tokens and sign-in attempt tokens are hashed only through `lib/auth/secrets.ts` (HMAC-SHA-256 under `VOSSIE_AUTH_HMAC_KEY`, read on first use, never at module scope or during a build). Never `createHash` in `lib/auth` (a test checks). A Route Handler that starts or ends a session calls `isSameOrigin` (`lib/auth/same-origin.ts`) before it reads anything, and answers with `seeOther()`.
```

and after the `staff-accounts-writes` line:

```md
- End-to-end tests that reach the message limits go in `tests/e2e/hardening-writes.spec.ts`, which runs last, in the `hardening-writes` project, after `staff-accounts-writes`. Sign-in's and sign-out's full page loads are checked in `tests/e2e/sign-in-return.spec.ts` (device projects).
```

- [ ] **Step 4: The spec's "Changes on plan review and build"**

At the end of `docs/superpowers/specs/2026-10-20-hardening-design.md`, add `## 11. Changes on plan review and build`, a numbered list, one sentence or two each, naming the plan decision:
1. The spike's outcome and its figures (plan decision 6); what it means for item 1.
2. Lama's answers of 2026-10-20 (plan decisions 1 to 5): 40 and 120; sign-out as a full page load (built, moving out of section 8; `signOut` goes); no upstream report unless needed; the preview runs on the development key; the trust section kept as sample wording. Mark section 10's five questions answered.
3. The steps' helpers move to a plain module because a `"use server"` file's exports are endpoints (plan decision 8).
4. `isSameOrigin` refuses a missing `Origin`, which Next's own check lets through (plan decision 11); the `GET`s call `connection()` (plan decision 10).
5. Continue is left out for `next=/account` (plan decision 12); `app/login/page.tsx` needed no change.
6. The offer's 20-a-day check moved before the scam words (plan decision 14); `lib/looking-for/errors.ts` needed no change (plan decision 17).
7. Unit tests get a key of their own (plan decision 19).
8. The test changes the spec missed: the trust and safety page tests and `info.spec.ts`; the key phrase "save a search…" (plan decision 20).
9. Anything in "Changes made during the build" that changes what the spec says, and every existing test changed (or reported) because a page now reloads.

- [ ] **Step 5: The go-live checklist**

In `docs/reference/GO-LIVE.md`:
- line 5's "Updated …" sentence: append ", and after hardening (sign-in and sign-out as full page loads, message limits, keyed hashes, info pages; stage K)" to the end of that same line;
- **Quality:** if the fix was built, tick "**Stage D's sign-in replay of a gated page's redirect.**" (`- [x]`) and append " Fixed in stage K: the posts that start a session go to Route Handlers that answer 303, so sign-in ends with a full page load." If the spike didn't reproduce, leave it open and append the spike's findings in one sentence;
- **Backend:**
  - tick "**Keyed hashes for codes.**" and append " Built in stage K: HMAC-SHA-256 under `VOSSIE_AUTH_HMAC_KEY`.";
  - add `- [ ] Set \`VOSSIE_AUTH_HMAC_KEY\` (32+ characters) in every deployed environment before any real account signs in. The Vercel preview runs on the development key, with its warning, until then (Lama, 2026-10-20).`;
  - add `- [ ] Phase B: confirm from Supabase's own docs how Supabase Auth stores email codes.`;
  - tick "A limit on messages per account" and append " Built in stage K: 40 new conversations a day and 120 messages an hour (Lama, 2026-10-20).";
  - add `- [ ] The message limits counted in the database: \`start_conversation\` and \`send_message\` count with the write, under an advisory lock on the sender; \`messages.sender_id\` with an index on \`(sender_id, sent_at)\`; a partial index on \`conversations (buyer_id, created_at) where request_id is null\` (stage K spec decision 11).`;
- **Content:** in "Info pages say what's true today", append " Brought up to date after stages H to J in stage K; keep updating them as stages land.";
- **Production:** add `- [x] Sign-out ends with a full page load (\`/logout\`, stage K), so a shared computer keeps no hidden signed-in pages. Account deletion still ends with a Server Action's redirect.`;
- **Launch:** add `- [ ] Remove the sample accounts' exemption from the message limits with sample mode (it goes by itself, since \`isSampleAccount\` needs sample mode; listed so nobody keeps it on purpose).`;
- **Section 7:** add `- [ ] **Report the kept-redirect behaviour to Next.js?** Only if needed (Lama, 2026-10-20). \`tests/e2e/sign-in-return.spec.ts\` with \`SIGN_IN_SPIKE=1\` is the reproduction.`;
- **Section 8:** add stage K after stage J, as J's line is written.

- [ ] **Step 6: This plan's ledger and changes**

In this plan, fill in the JS ledger's rows from Tasks 1, 2, 5, 9 and 10's reports and the unit and e2e counts at the start; under "Changes made during the build", list each task with its commit (`git --no-optional-locks log --oneline`, one command) and every place the build differed from the tasks (the spike's outcome first), and every existing test changed because a page now reloads.

- [ ] **Step 7: The snippets for the controller**

Write, in the scratchpad named above:
- `k-progress.md`: a section for `docs/PROGRESS.md` in the shape of stage J's (`## 2026-10-<day>: Hardening, built in sample mode (stage K)`): what was built; the spike's outcome; Lama's five answers; the JS figures; the unit and e2e counts; no screenshots (Step 2); the open points for Lama: the existing tests changed because a page now reloads, account deletion still a Server Action, the key on the preview, the sample wording (plan decision 21), and the go-live items;
- `k-decision.md`: one row for `docs/reference/LANDING-DECISIONS.md`, **row 78**, summarising the stage, Lama's answers of 2026-10-20, and "decided by Claude under decision 54; Lama may revisit" for the rest.

- [ ] **Step 8: Final checks (the controller)**

In a fresh scratch copy of HEAD with this task's files copied in:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
grep -l "serviceWorker.register" .next/static/chunks/*.js
pnpm e2e
```

Expected: clean lint and types; every unit test passing (record the count); the build listing `/logout` (and, if built, the three `/login/*` handlers) as dynamic with no error; the `grep` printing nothing (CLAUDE.md); the whole e2e run passing, with `hardening-writes` last, apart from any test already reported to Lama; `performance.spec.ts`'s figures equal to the ledger's to the byte. Fill in the ledger's Final row.

- [ ] **Step 9: Hand over**

Files: `CLAUDE.md`, `docs/superpowers/specs/2026-10-20-hardening-design.md`, `docs/reference/GO-LIVE.md`, `docs/superpowers/plans/2026-10-20-hardening.md`. Snippets: `<scratchpad>/k-progress.md`, `<scratchpad>/k-decision.md`. Message:

```
docs: stage K's records: CLAUDE.md (the sign-in and sign-out posts as Route Handlers, the message limits, keyed hashes, the hardening-writes project), the spec's changes on plan review and build (Lama's answers of 2026-10-20 among them), the go-live checklist and the plan's ledger and build changes. Unit: <count>. E2E: <counts>. JS: no page moved
```

---

## Self-review (while drafting the tasks)

- **Spec coverage.** Every spec decision maps to a task in "Where each spec decision is built". Spec 3's unit list: the finish functions (Task 3), `isSameOrigin` (Task 2), each handler (Tasks 2 and 4), `SignedInNote` (Task 5). Its e2e list: variants 1 to 8 (Task 1's file, switched on in Task 5). Spec 4's unit list: Tasks 6 and 7; its e2e: Task 10. Spec 5's: Task 8. Spec 6's: Task 9. Lama's sign-out: Task 2 and `sign-in-return.spec.ts`.
- **Names against HEAD.** `startSignIn`, `verifyCode`, `resendCode`, `cancelSignIn`, `completeProfile`, `signInAsSample`, `signOut`, `updateDetails`, `deleteAccount`, `endSession`, `startSession`, `getSessionKey`, `getViewer`, `setFlash`, `deleteCookie`, `readCookieValue`, `setPrivateCookie`, `SIGN_IN_COOKIE`, `SESSION_COOKIE`, `FLASH_COOKIE`, `safeNextPath`, `signInHref`, `restoreSampleAccount`, `restoreSampleShop`, `SELLERS_TAG`, `startConversation`, `startOffer`, `findConversation`, `sendMessage`, `forgetAccountInMessaging`, `countOffersSince`, `messagingErrors`, `composerFields`, `offerErrors`, `offerFieldIds`, `composerFormKey`, `replyFormKey`, `offerFormKey`, `sampleAccounts`, `isSampleMode`, `STORE_VERSION`, and the e2e helpers (`signInAsSample`, `signUp`, `signUpHere`, `newBuyer`, `main`, `field`, `button`, `onlyAt`, `project`, `reply`, `bubble`, `POST_LANDS`, `seriousIssues`, `recordShifts`, `holdFonts`, `expectStill`) were read from the code at `7e5df20` with `6c71c0b`; `84f61a1` changed none of them.
- **Shared files left alone.** `app/globals.css`, `app/layout.tsx`, `lib/supabase/*`, `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md` and the Supabase session's untracked plan are never edited; existing e2e specs only where a reload breaks a test.
- **Type consistency.** `MessageLimitError`, `SIGN_IN_POSTS`, `SIGN_OUT_PATH`, `revalidatedTags` and the finish functions' `(formData, now) => Promise<string>` are used with the same names in every task.
