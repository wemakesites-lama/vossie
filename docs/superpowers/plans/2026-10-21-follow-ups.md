# Vossie Follow-ups (Stage M, Sample Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build stage M as the spec `docs/superpowers/specs/2026-10-21-follow-ups-design.md` describes:
- an admin can't remove the mentor role from whoever mentors the admin's own shop: the refusal is in the data write, the action lands on `/admin/staff` with a notice, and the staff pages say why in place of the control;
- when Featured must bring back resting sellers, the ones featured longest ago come back first, the campus's own still ahead of others';
- an asker is reminded once, in the app, two days before their request closes itself.

Every form works without the app's JavaScript, and no page gains a byte of JavaScript.

**Architecture:**
- **Who mentors your own shop is one synchronous read** (`ownShopMentorId(ownerId)` in `lib/data/staff-accounts.ts`), used by `removeRole` for its new `"own-shop-mentor"` refusal (checked before any write, in the same synchronous pass as `own-admin` and `last-admin`) and by the two staff pages to replace the control with a line (Task 1).
- **The resting order is still a pure function.** `FeaturedOptions.resting` becomes a `ReadonlyMap<string, string>` (slug to the latest day in this campus's recorded row); `drawFeatured` sorts each campus group of resting sellers stably by that day, oldest first, so ties keep the day's rotation; `featuredFor` builds the map walking back from yesterday (Task 2).
- **The reminder rides on `settleRequests(now)`.** `reminderDue(row, today)` (`lib/looking-for/rules.ts`) is a pure function of the row and the date; `settleRequests` marks `remindedFor` in its one synchronous loop, before any `await`, then sends the closes and the reminders. It still returns how many it **closed**, so no Server Action expires `requests` for a reminder (Task 3).
- **No new table, cookie, notification kind, client component or CSS.** `RequestRow` gains `remindedFor`, so `STORE_VERSION` moves from 13 to 14. No edit to `app/layout.tsx`, `app/globals.css`, `components/messages/NotificationsView.tsx`, the header or the tab bar, and no import of `lib/supabase` or `@supabase/*`.

**Tech Stack:** As stage L leaves it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5.9;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5.0 with Testing Library and jsdom;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-21-follow-ups-design.md` (committed `1782962`). "Spec 2.N" in this plan means its section 2, decision N; "spec 3" means its section 3.
- **The stages this builds on:** G (Featured, mentors; `docs/superpowers/plans/2026-10-14-staff-tools.md`, amendments 3 and 15.3), H (`lib/looking-for/*`, `lib/data/requests.ts`), J (roles given and removed, the confirm pages), L (`docs/superpowers/plans/2026-10-20-housekeeping.md`: the own-shop gate, `settleRequests`, the `housekeeping-writes` project, and the format, conventions and scratch copy this plan copies).
- **Where a plan and the code differ, the code at HEAD wins.** Every name, import and signature below was read from the code at `1782962` on 2026-10-21.
- **Next 16.4's own words** (`node_modules/next/dist/docs/01-app/`): nothing new is used. Server Actions, `redirect`, `refresh` and `connection()` are used exactly as stage L uses them.
- **Playwright's own words:** `test.describe.configure({ mode: "default" })` runs a file's tests in order in one worker when `fullyParallel` is on (`node_modules/.pnpm/playwright@1.64.0/node_modules/playwright/types/test.d.ts`, the `configure` doc comment).
- **The go-live checklist:** `docs/reference/GO-LIVE.md`, sections 6 and 7.
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`, decision 54 (Claude decides under Lama's standing goal); stage M's row is **81**.

---

## Before you start

Other sessions share the working tree:
- **The header session** may have uncommitted `app/globals.css`, `components/header/*`, `components/tabbar/*` and `tests/e2e/{listing,responsive,a11y}.spec.ts`. **No task edits any of them.** Every new line reuses an existing class (`staff-muted`, `staff-confirm`, `staff-confirm-lead`), the reminder reuses the `request-update` kind (so `NotificationsView` and the header's count are untouched), and `countNewNotifications` keeps its signature.
- **The Supabase session** works in another worktree and shares `.git`. No task imports `lib/supabase` or `@supabase/*`. Its untracked docs and `docs/superpowers/specs/2026-10-15-positioning-and-editorial-design.md` are never edited.
- `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md` and `.claude/launch.json` carry other sessions' uncommitted lines. No task edits them; Task 5 writes snippets for the controller.
- **Check the dirty list before a task edits a file:** `git --no-optional-locks status --short <file>` prints nothing for it. If it prints a line and the file isn't this stage's, that's another session at work: stop and report.

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. Never stage `.claude/launch.json` or any file this plan doesn't list.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed.
3. **Files this plan removes:** none. No task runs `rm` on a project file.
4. **No new cookie or browser-storage name.** New code never writes a lowercase quoted `"vossie_…"` string (`app/privacy/page.test.tsx` collects those).
5. **No new Playwright project.** Stage M's end-to-end test joins `tests/e2e/housekeeping-writes.spec.ts`, which already runs last (plan decision 13).
6. **Sample wording.** Every sentence in spec 3, 4 and 5 "Words" goes in as written, as samples for Lama to change later.

No installs are needed by this plan. **If `package.json` or `pnpm-lock.yaml` changed at HEAD and `node_modules` doesn't match** (`pnpm typecheck` fails on a missing module), stop and ask the controller. Implementers never run an install.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time, and only read-only ones (`git status`, `git diff`, `git log`, `git show`, `git archive`). Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` a project file.
- Never kill an install or build that is still running.
- **Stop only servers you started, by their PID:** the `pnpm start` parent you launched (`echo $!` when you start it) and its `next-server` child (`pgrep -P <parent pid>`), each with `kill <pid>`, after checking with `lsof -ti tcp:3204` that the port's PID is one of yours. Never `pkill`, never `killall`, never stop a server on 3100 (Lama's dev server) or 3200 (the shared e2e port).
- **Show red in a tests-only scratch copy, never by moving files in the real repo.** A new or changed test runs first in a scratch copy of the committed code with only the test files copied in. Never move, rename or stash files in the real repo.
- **A unit test that times out or fails to load under load is rerun alone** (`pnpm test <that file>`) before it counts as a failure.
- Before you edit a shared file (`lib/staff/*`, `lib/data/*`, `lib/looking-for/*`, `lib/featured.ts`, `components/staff/*`, `components/forms/summary-ids.test.tsx`, `app/admin/*`, `app/trust/*`, `app/privacy/*`, `app/how-it-works/*`, `data/fixtures/*`, `tests/e2e/housekeeping-writes.spec.ts`, `CLAUDE.md`, `docs/*`), read its current text and edit by the exact lines that are there now. Never paste back a whole file from an older copy.

## Recheck before starting

Before Task 1, check each item, one command or file at a time, and write what you find in a message to the controller. If something differs in a way a task's quoted code depends on, stop and report rather than guess.

1. **Git.** `git --no-optional-locks log --oneline -3` shows `1782962` (stage M's spec) or this plan's commit on top of it, or later commits from other sessions. For each later commit, `git --no-optional-locks show --stat <hash>` and note any file this plan edits. `git --no-optional-locks status --short` shows only the other sessions' files (at planning: `.claude/launch.json`, `app/globals.css`, `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md`, `tests/e2e/listing.spec.ts`, `tests/e2e/responsive.spec.ts`, and the untracked positioning spec).
2. **The store.** `lib/data/store.ts` has `export const STORE_VERSION = 13;`. If another stage moved it, Task 3 adds one to whatever it is (spec section 6) and words its comment line with that number.
3. **Roles.** `lib/data/staff-accounts.ts`' `removeRole(accountId, role, byId)` returns `Promise<RemovedRole | "own-admin" | "last-admin" | null>`; `lib/staff/account-actions.ts`' `removeStaffRole` maps `own-admin` and `last-admin` to the confirm page's form state, then `if (!removed) return nothingChanged(now);`. `app/admin/staff/[id]/remove-mentor/page.tsx` writes its title as `` `Remove ${person.firstName}'s mentor role` `` (it doesn't use `roleConfirmTitle`).
4. **Featured.** `lib/featured.ts`' `FeaturedOptions.resting` is `ReadonlySet<string>`, and `drawFeatured` ends `return [...pins, ...inOrder(pool), ...inOrder(rested)].slice(0, count);`. `lib/data/featured.ts`' `featuredFor` builds `const resting = new Set<string>();` over `back` 1 to `REST_DAYS` (6). `featuredChoices()` returns 9 sellers on the seeds.
5. **Requests.** `lib/data/requests.ts`' `settleRequests(now)` returns `Promise<number>` and has one loop with `if (day === null || today < day) continue;`. `RequestRow` has `closedBy` and no `remindedFor`.
6. **Playwright.** `playwright.config.ts` has `fullyParallel: true`, and the last project is `housekeeping-writes`. `tests/e2e/housekeeping-writes.spec.ts` has three tests and the helper `removeSiphosAdminRole`.
7. **The JS figures** (the ledger's Start row, stage K's at `16dab6a`, unchanged by stage L): `/` and most pages 150,660 B, listing 151,816 B, browse 151,407 B, storefront 151,420 B, Saved 151,295 B, request and collection 151,136 B, the new and edit listing forms 152,334 B. Task 4 measures them again.

## Where things stand (checked against the code on 2026-10-21)

| Area | Fact |
|---|---|
| Repo | `main` at `1782962` (stage M's spec), stages D to L built. Unit tests: 2,661 (stage L's final count) |
| Role removal | `removeRole` checks "no such role", then `own-admin` and `last-admin` (admin only), then for a mentor role sets `mentorId` to null on every profile the person mentors, the acting admin's own included. Nothing awaits between a check and its write |
| The seeds | Sipho (`acc-seller`) owns Tech corner, and his profile's `mentorId` is Naledi (`acc-mentor`). Lerato (`acc-pending`) has a waiting profile with no mentor. Pieter (`acc-admin`) is the only admin |
| Staff pages | `/admin/staff` shows notices (`takeNotice()`); the remove confirm pages pass `notice={null}`. `AdminStaff`'s `RowActions` shows "This is you." for the viewer's own admin role. `StaffRoleConfirm` refuses the viewer's own admin role with a `staff-confirm` block and "Back to staff accounts" |
| Featured | `drawFeatured`: pins, then the sellers not resting by `inOrder` (the campus's own rotated, then others rotated; "all" is one rotation), then the resting by the same `inOrder`. Rows are recorded per `${campus}:${day}` and kept 7 days |
| Requests | `closingDay(row)` (null for the samples), `requestOpenOn`, `closedAtFor`, `closeReasonOf`, `addDays` in `lib/looking-for/rules.ts`; `requestAutoClosedText` and `AUTO_CLOSE_WHY` in `words.ts`; `notify` adds plainly (no folding for `request-update`); `deleteRequest` deletes the request's `request-update` notifications; `exportRequests` lists its fields by name (so a new row field isn't exported) |
| Info pages | `/trust`'s Featured list item 4 is one sentence, pinned whole by `app/trust/page.test.tsx`; `/how-it-works` and `/privacy` carry stage L's closing sentences, pinned by their tests; both already say `updated="2026-10-21"`, `/trust` says `2026-10-20` |
| e2e | `playwright.config.ts` has `fullyParallel: true`. `housekeeping-writes` runs last; its first test gives Sipho the Admin role and takes it away in a `finally` |
| Client code | No `"use client"` file imports `lib/featured.ts`, `lib/looking-for/*`, `lib/format.ts`, `lib/data/*` or `components/staff/*` (checked with `grep`), so nothing in this plan can move a page's JavaScript |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. "Plan decision N" means this list; "spec 2.N" means the spec's decisions. The spec's open questions (section 10) have no answers yet: the plan builds the spec's choices, and Task 5 lists the questions as open points.

**Item 1: your own shop's mentor.**

1. **`removeRole`'s new check comes straight after "no such role"**, before `own-admin` and `last-admin`. Those two apply only to the admin role and the new one only to the mentor role, so the order between them changes nothing; first is simplest to read. `ownShopMentorId` is synchronous, so the check and the write stay in one pass (spec 2.5).
2. **`AdminStaff`'s `ownShopMentorId` prop is required** (`string | null`): two callers, the page and two tests (`AdminStaff.test.tsx`'s `view` helper, `components/forms/summary-ids.test.tsx`). **`StaffRoleConfirm`'s `mentorsOwnShop` and `onlyAdmin` are optional, defaulting to false**, and `roleConfirmTitle` gains an optional fourth argument `mentorsOwnShop = false`: only the remove-mentor page passes them, so the remove-admin page and the six existing renders stay as they are (stage L plan decision 3's pattern).
3. **The refusal is inline in `removeStaffRole`** (`leaveNotice("own-shop-mentor", now)`, then `done(ADMIN_STAFF_PATH)`), before the `own-admin`/`last-admin` branch: one case doesn't need a helper. The confirm page's form state (`removeRoleForm(…)`) is left as it was: neither written nor cleared (spec 2.5).
4. **The remove-mentor page always works out `onlyAdmin`** (`countAdmins() === 1`), as stage L's review page does; `StaffRoleConfirm` shows the sentence only in the refusal branch.
5. **Only the page's heading changes to "{Name}'s mentor role"** (`roleConfirmTitle`). The tab title comes from `staffMetadata("admin", "Remove a role")`, which can't know the viewer before the session streams in, so it stays (spec 2.6 says "the page's title"; the remove-admin page works the same way).

**Item 2: Featured's resting order.**

6. **One helper, `groups(list)`, serves both orders** in `drawFeatured`: `[list]` for "all", else the campus's own and then the others. The sellers not resting are each group rotated, as today; the resting are each group rotated and then sorted stably by their last day with `localeCompare` (YYYY-MM-DD strings sort as dates). A seller missing from the map (none, by construction) sorts first with `""`.
7. **`app/trust/page.test.tsx`' existing test changes.** It pins item 4's whole text (`toBe(…)`), so the clause makes it fail; the test takes the new text (spec 4 "Tests" says "the clause is there"). `components/staff/AdminFeatured.tsx` repeats the old sentence for staff; the spec doesn't name it, so it stays (open point in Task 5).
8. **The latest-day test seeds the recorded rows directly** (`featuredDraws`), so it fails at HEAD for certain: on 14 October, 20740 days since 1970, the nine-seller rotation starts at place 20740 % 9 = 4, so HEAD's row is `[e4, e5, e6, e7]` and stage M's is `[e3, e4, e5, e6]` (`e` the eligible slugs in `localeCompare` order, as `drawFeatured` sorts them). The spec's "pins count" test passes at HEAD (pins are in the recorded row already) and says so.

**Item 3: the reminder.**

9. **`reminderDue(row, today)` takes the six row fields it reads** (`askerId`, `neededBy`, `updatedAt`, `status`, `hiddenAt`, `remindedFor`), so tests can call it with a plain object. `settleRequests` copies each reminder's words-data (asker, id, title, closing day, reason) when it marks the row, so the words match what was marked even if the row changes while the notifications are awaited.
10. **The seeds' `remindedFor: null` is tested in `data/fixtures/request-rows.test.ts`** (where the seeds' other nulls are tested), not `lib/data/store.test.ts` (spec 5 "Tests"); no test pins `STORE_VERSION`'s number, and none is added.
11. **The info pages keep literal numbers** ("2 days"), as stage L's sentences do ("3 days", "30 days"); `lib/looking-for/words.ts` uses the constants (spec 5 "Words").
12. **Two existing info-page tests change**, `app/how-it-works/page.test.tsx` and `app/privacy/page.test.tsx`: they pin stage L's sentences, which spec 5 rewrites. Both pages already say `updated="2026-10-21"`; `/trust` moves to the day Task 2 is built.

**End to end, records, how to run.**

13. **The end-to-end test joins `tests/e2e/housekeeping-writes.spec.ts`**, and `playwright.config.ts` doesn't change (spec 3 "Tests"). **But `fullyParallel` is on**, and the new test, like the first, gives Sipho the Admin role and takes it away in a `finally`; run in two workers at once, one would take the role away mid-test of the other. So the file gains one line at the top, `test.describe.configure({ mode: "default" });`, which runs its tests in order in one worker (retries stay per test; a failure doesn't skip the rest).
14. **The forged post's fields come from Pieter's confirm page drawn without JavaScript**, as stage L's did: Sipho's page has no form to copy, and a Server Action post needs its `$ACTION_ID_…` field. It's posted to the confirm page's address with Sipho's session.
15. **One build and size check, in Task 4**, after all three items, rather than after items 2 and 3 separately (spec section 9). No task touches a client component, CSS or a module any client file imports (the table above), so a page's JavaScript can't move between items; Tasks 1 to 3 run typecheck, lint and the whole unit suite in their scratch copies, and Task 4 builds, measures every page and runs the end-to-end tests. Any byte that moved stops the build.
16. **E2E write runs use a fresh server** (stage L's ledger: a long-running server served stale pages after writes). Task 4 runs the write projects first on a server it has just started, then the read-only device files.
17. **Records:** this plan's ledger and changes, the spec's new section 11 ("Changes on plan review and build"), CLAUDE.md, GO-LIVE.md, and the snippets `m-progress.md` and `m-decision.md` (decision row **81**) in the scratchpad `/private/tmp/claude-501/-Users-LamaNkuna-Projects-Vossie/27a3bf01-5279-40ef-b17d-be68f2ee9fa1/scratchpad/`. The controller merges `docs/PROGRESS.md` and `docs/reference/LANDING-DECISIONS.md`.

## Amendments on review

Reviewed 2026-10-21 (opus, read-only); all accepted by the controller. Where an amendment and a task differ, the amendment wins.

1. **Task 4, Step 2: the heading check passes at HEAD for the wrong reason.** Playwright's `name` string matches substrings, so "Naledi's mentor role" already matches HEAD's heading "Remove Naledi's mentor role". Replace
   `await expect(main(sipho).getByRole("heading", { level: 1, name: "Naledi's mentor role" })).toBeVisible();`
   with
   `await expect(main(sipho).getByRole("heading", { level: 1, name: "Naledi's mentor role", exact: true })).toBeVisible();`
2. **Task 4, Step 3: a device run that tests nothing.** `tests/e2e/staff-accounts-checks.spec.ts` is in every device project's `testIgnore` (`STAFF_ACCOUNTS`), so `--project=phone-390 --project=desktop-1440` runs none of its tests. It already runs under `--project=staff-accounts-writes --no-deps`, whose `testMatch` covers writes, checks and screenshots. The second device command becomes:
   `E2E_REUSE_SERVER=1 pnpm e2e tests/e2e/staff.spec.ts tests/e2e/info.spec.ts tests/e2e/home.spec.ts tests/e2e/community-actions.spec.ts --project=phone-390 --project=desktop-1440 --workers=2`
   and after the `staff-accounts-writes` expectation add: "(this project also runs `staff-accounts-checks.spec.ts` and `staff-accounts-screenshots.spec.ts`)".
3. **Self-review "Risk noted for the reviewer", and Task 3 Step 9's note: a second existing test now sends a reminder.** `lib/data/requests.test.ts`' "closes at the very start of the closing day in South Africa, not a second before" settles at `2026-10-12T21:59:59Z` (SAST the 12th: closing day the 13th, reminder from the 11th), so it now reminds as well as returning 0; it counts no notifications, so it still passes. The risk bullet's middle sentence becomes: "The plan's search found two existing tests where this happens, neither counting notifications: `lib/looking-for/actions.test.ts` (needed by the 12th, at `STAFF_NOW`) and `lib/data/requests.test.ts`'s 'closes at the very start of the closing day…' (its 21:59:59Z settle on the 12th falls in the window). No e2e test can: a needed-by date can't be in the past, so a request posted in e2e closes at today+4 at the earliest."
4. **Plan decision 13: wording.** "which runs its tests in order in one worker (retries stay per test; a failure doesn't skip the rest)" becomes "which runs its tests one at a time in file order (after a failure the rest carry on in a fresh worker; retries stay per test, and a failure doesn't skip the rest)". In Task 4's e2e comment, "run this file's tests in order, in one worker" becomes "run this file's tests one at a time, in order".
5. **Task 3, Step 3, "reminds again when an edit moves the closing day": clarity only.** The second `updateRequest` spreads `DATED`, which puts the title back to "Desk lamp for res" after the first edit changed it; that's why the regex expects that title. Add above that call: `// DATED's own title again, so the new reminder names "Desk lamp for res".`

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec section 1 and 9):** **no page moves by a byte.** Every changed component is a Server Component, and no client component, `"use client"` file or CSS changes. If any figure differs from the Start row, stop and find out why before going on. The listing forms stay at 152,334 B, 29 B past the 152,305 B stop line that Lama accepted as decision 78.
- **Where bytes could move:** nowhere, by design. The changes are HTML text (`/trust`, `/how-it-works`, `/privacy`, two staff pages) and server code.
- **Recording.** In the scratch copy, `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` prints each page's `scriptBrotli`. Task 4 runs it, and the controller at Task 5.

**As built** (fill in during the build):

| Point | `/` and most pages | Listing | Browse | Storefront | Saved | Request and collection | New and edit listing forms |
|---|---|---|---|---|---|---|---|
| Start (stage K at `16dab6a`, unchanged by stage L) | 150,660 | 151,816 | 151,407 | 151,420 | 151,295 | 151,136 | 152,334 |
| Task 4, items 1 to 3 built | 150,660 | 151,816 | 151,407 | 151,420 | 151,295 | 151,136 | 152,334 |
| **Final (Task 5)** | 150,660 | 151,816 | 151,407 | 151,420 | 151,295 | 151,136 | 152,334 |

The stop line used: 152,305 B (decision 52; the forms' 152,334 B accepted as decision 78). Unit tests at the start: 2,661 (stage L's final count). End to end at the start: stage L's final run (devices 1,251 passed, 1,210 skipped by design, and the 4 failures that predate stage L, with the header session; the seven write projects 65 passed, 1 skipped, on a fresh server). Unit tests at the end: 2,701. End to end at the end, on a fresh server: the seven write projects 66 passed, 1 skipped; `housekeeping-writes` again on the same server 4 passed; devices (staff, info, home, community-actions at 390 and 1440) 88 passed; `performance.spec.ts` 45 passed. Every page's JS is the same to the byte as the Start row. The full device suite was not run in this stage; the four phone tests that predate stage L (header session) are unchanged.

## Changes made during the build

(Where an entry differs from the tasks below, the entry wins.)

**Commits** (`git log --oneline bd82ece..HEAD`):
- Task 1: `b70b170`, the mentor-role guard (`ownShopMentorId`, the `"own-shop-mentor"` refusal in `removeRole`, the notice, the two staff views). Unit: 2,675.
- Task 2: `58d0338`, Featured's resting order. Unit: 2,682.
- Task 3: `c6cebed`, the reminder (`reminderDue`, `remindedFor`, `STORE_VERSION` 14). Unit: 2,698.
- Review fixes: `488c878`. The remove-mentor page's two inline reads became `removeMentorView(viewerId, personId)`, unit tested with mutation checks on both reads; a test shows a closing day moved away and back to one already reminded for sends nothing the second time (spec decision 15); the `requests.ts` header comment was re-wrapped; the admin Featured page now says the sellers featured longest ago come back first, as the trust page does (this closes plan decision 7's open point). Unit: 2,701.
- Task 4: `81dab39`, the end-to-end test in `housekeeping-writes.spec.ts` (with `test.describe.configure({ mode: "default" })`).
- Task 5: this documentation commit.

**Where the build differed from the tasks:**
- `removeMentorView` is a new helper the plan didn't name; it replaces the remove-mentor page's two inline reads (review, `488c878`).
- `AdminFeatured`'s copy of the break sentence was changed after all (plan decision 7 left it; the review made it match the trust page).
- The code review found nothing blocking; its low-severity gaps were fixed in `488c878`.
- The device run was the amendment 2 command (staff, info, home, community-actions at 390 and 1440): 88 passed. No full device run was made.
- Amendment 3's risk note held: two existing tests now send a reminder and neither counts notifications.
- No screenshots spec was added (nothing new is drawn but lines in existing styles).

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there unless a step says to run them in the scratch copy (`$S`).
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, comments in plain English. No formatter: match the file you're in.
- **Server or client.** This plan adds **no** client component and changes none. `lib/staff/account-actions.ts` starts with `"use server"`: everything it exports must be an async function, and nothing helper-like is exported from it (its gate test lists the exports: `giveStaffRole`, `removeStaffRole`). `ownShopMentorId` lives in `lib/data/staff-accounts.ts`, which has no directive.
- **Clock and randomness.** No `Date.now()`, `new Date()`, `Math.random()` or `crypto.random*` while prerendering. Nothing in this plan reads a clock in a component: the staff pages read the store after `requireStaff()` inside their `<Suspense>`, `featuredFor` takes `day`, and `settleRequests` takes `now` from its callers, which stage L placed.
- **No write inside `"use cache"`.** `settleRequests` is never called from a cached function, and this plan adds no caller.
- **Server Actions.** Identity only from the session (`requireStaff`). A refusal goes back with `done()`; every write ends with `done()`.
- **Forms.** Every form works without the app's JavaScript. Removed controls are removed, never disabled (spec 2.6).
- **Links.** Links into staff pages never prefetch (`prefetch={false}`).
- **JSX text.** `react/no-unescaped-entities` is on: `&apos;` for an apostrophe in JSX text (a string in braces needs none).
- **Server code in tests.** `tests/helpers/next-request.ts` (`nextHeaders`, `nextNavigation`, `nextServer`, `nextCache`, `redirectOf`, `redirectSignalOf`, `resetRequest`) and `tests/helpers/staff.ts` (`STAFF_NOW`, `signedInAs`, `form`); `resetSampleStore()` and `resetRequest(request)` in `beforeEach`; fake only the date (`vi.useFakeTimers({ toFake: ["Date"] })`).
- **TDD.** Write the test, show it fail in a tests-only scratch copy, write the code, watch it pass in the real repo. A test that pins behaviour already at HEAD says so and passes at once.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git --no-optional-locks status --short` on its own, and checks that the listed files changed and nothing else of this stage's did;
  2. runs `git add` with the listed files, by name;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.

### The scratch copy (red, builds, `pnpm start`, e2e, the whole unit suite, lint and typecheck)

Other sessions share the working tree, so nothing builds or starts there, and nothing there is moved to make a test fail. Every task makes a fresh copy of the committed code:

```bash
# 1. A new, empty folder in your scratchpad (never reuse or delete one). <N> is the task's number, <step> a word.
S="<your scratchpad>/vossie-m-task<N>-<step>"
mkdir "$S"
# 2. The committed code (read-only git), then node_modules as an APFS clone.
git -C /Users/LamaNkuna/Projects/Vossie --no-optional-locks archive HEAD | tar -x -C "$S"
cp -cR /Users/LamaNkuna/Projects/Vossie/node_modules "$S/node_modules"
# 3. The files to try, one line each, quoted. Never the other sessions' files. For example:
cp "lib/data/staff-accounts.test.ts" "$S/lib/data/staff-accounts.test.ts"
# 4. Only when the task runs e2e: the server's port.
sed -i '' 's/^const PORT = 3200;$/const PORT = 3204;/' "$S/playwright.config.ts"
grep -n "^const PORT" "$S/playwright.config.ts"
```

Expected from the last command, when you run it: `3:const PORT = 3204;`.

**To show red** (every task's first run): the copy is `vossie-m-task<N>-red`, and step 3 copies in **only the new or changed test files**. Run them there; they fail against the committed code.

**To check the whole task** (typecheck, lint, the unit suite): the copy is `vossie-m-task<N>-check`, and step 3 copies in **every file the task changed**, tests and code. From `$S`:

```bash
pnpm typecheck
pnpm lint
pnpm test --maxWorkers=2
```

A file that fails to load or times out under load is rerun alone (`pnpm test <file>`) before it counts.

**To run e2e** (Task 4 only), from `$S`:

```bash
lsof -ti tcp:3204          # must print nothing; if it prints a PID that isn't yours, stop and report
pnpm build
pnpm start --port 3204 > "$S/server.log" 2>&1 &
echo $!                    # note this PID: the pnpm parent, yours
# wait until the server answers
until curl -s -o /dev/null http://localhost:3204/; do sleep 2; done
pgrep -P <the parent PID>  # note this PID too: the next-server child, yours
E2E_REUSE_SERVER=1 pnpm e2e <files> <projects> --workers=2
kill <child PID> <parent PID>
lsof -ti tcp:3204          # prints nothing once they've stopped
```

A `pnpm start` you start yourself is yours: stop it with `kill` by its PIDs when you're done. Never `pkill` or `killall`.

## File map (end of this plan)

New files are marked **+**, changed **~**.

```
lib/
  data/staff-accounts.ts (+ test)                    ~ ownShopMentorId, removeRole's "own-shop-mentor" (Task 1)
  staff/account-actions.ts (+ test)                  ~ removeStaffRole's notice (Task 1)
  staff/notices.ts (+ test)                          ~ own-shop-mentor (Task 1)
  featured.ts (+ test)                               ~ resting as a Map, longest wait first (Task 2)
  data/featured.ts (+ test)                          ~ the latest day per resting seller (Task 2)
  looking-for/rules.ts (+ test)                      ~ REMINDER_DAYS_BEFORE, reminderDay, reminderDue (Task 3)
  looking-for/words.ts (+ test)                      ~ requestCloseReminderText (Task 3)
  looking-for/actions.test.ts                        ~ a reminder expires nothing (Task 3)
  data/rows.ts  data/store.ts                        ~ remindedFor, STORE_VERSION 14 (Task 3)
  data/requests.ts (+ test)                          ~ createRequest's remindedFor, settleRequests reminds (Task 3)
data/fixtures/
  request-rows.ts (+ test)                           ~ remindedFor null (Task 3)
components/
  staff/AdminStaff.tsx (+ test)                      ~ "Mentors your shop." (Task 1)
  staff/StaffRoleConfirm.tsx (+ test)                ~ the refusal, roleConfirmTitle's flag (Task 1)
  forms/summary-ids.test.tsx                         ~ AdminStaff's new prop (Task 1)
app/
  admin/staff/page.tsx                               ~ passes ownShopMentorId (Task 1)
  admin/staff/[id]/remove-mentor/page.tsx            ~ passes mentorsOwnShop, onlyAdmin; roleConfirmTitle (Task 1)
  trust/page.tsx (+ test)                            ~ the clause (Task 2)
  how-it-works/page.tsx  privacy/page.tsx (+ tests)  ~ the reminder's words (Task 3)
tests/e2e/housekeeping-writes.spec.ts                ~ mode "default", one more test (Task 4)
CLAUDE.md  docs/reference/GO-LIVE.md  the spec  this plan  ~ (Task 5)
```

**Tasks that touch the same files:** none share a file. Run them in order anyway: Task 4's end-to-end test needs Task 1, and its size check needs Tasks 1 to 3.

**Suggested implementers:** one per task.

## Where each spec decision is built

| Spec | Built in |
|---|---|
| 2.1 The gap is real (removing the mentor role un-assigns your own shop) | Task 1 (the refusal) |
| 2.2 The rule, read from the store's profile, any shop state; a sample shop is nobody's | Task 1 (`ownShopMentorId`, plan decision 1) |
| 2.3 Removing the admin role is unaffected | Task 1 (a test) |
| 2.4 Left alone: the mentor's own deletion, other shops' mentors, giving roles | Task 1 (no change; a test for another admin) |
| 2.5 The gate is in the data write; the notice on `/admin/staff`; a refusal writes nothing | Task 1 (plan decisions 1 and 3) |
| 2.6 The views say why | Task 1 (plan decisions 2, 4 and 5) |
| 2.7 The audit log is unchanged | Task 1 (no entry on refusal; no new words) |
| 2.8 Featured's gap is real | Task 2 |
| 2.9 The order: pins, not resting, then resting by campus group, longest wait, rotation on ties | Task 2 (plan decision 6) |
| 2.10 The campus comes before the waiting | Task 2 (a test) |
| 2.11 `resting` as a Map; `featuredFor` builds it | Task 2 (plan decision 8) |
| 2.12 The trust page's clause | Task 2 (plan decision 7) |
| 2.13 One reminder from two days before the closing day | Task 3 (`reminderDay`, `reminderDue`) |
| 2.14 Sent in the same settle pass; the count stays the closes | Task 3 (`settleRequests`, plan decision 9; the actions test) |
| 2.15 Once per closing day; `remindedFor`; `STORE_VERSION` 14 | Task 3 |
| 2.16 Skipped: samples, hidden, closed | Task 3 (`reminderDue`, tests) |
| 2.17 The `request-update` kind | Task 3 |
| 2.18 Links to Your requests | Task 3 |
| 2.19 The old reminder stays when the date moves | Task 3 (nothing clears it; a test) |
| 2.20 In-app only; `remindedFor` not exported | Task 3 (a test of the export) |
| 2.21 The nightly job | Task 5 (GO-LIVE) |
| 3 "Tests", end to end | Task 4 (plan decisions 13, 14 and 16) |
| 4 and 5 "Words" | Tasks 2 and 3 (plan decisions 11 and 12) |
| 5 "Tests", end to end: none | Nothing to build |
| 6 Files, CLAUDE.md | Task 5 |
| 8 Go-live changes | Task 5 |
| 9 The build check | Task 4 (plan decision 15) |
| 10 Open questions | Task 5 (open points for Lama) |

---

### Task 1: An admin can't remove the mentor role from whoever mentors their own shop

Spec section 3 and decisions 1 to 7, with plan decisions 1 to 5.

**Files:**
- Modify: `lib/data/staff-accounts.ts`, `lib/data/staff-accounts.test.ts`
- Modify: `lib/staff/account-actions.ts`, `lib/staff/account-actions.test.ts`
- Modify: `lib/staff/notices.ts`, `lib/staff/notices.test.ts`
- Modify: `components/staff/AdminStaff.tsx`, `components/staff/AdminStaff.test.tsx`
- Modify: `components/staff/StaffRoleConfirm.tsx`, `components/staff/StaffRoleConfirm.test.tsx`
- Modify: `components/forms/summary-ids.test.tsx`
- Modify: `app/admin/staff/page.tsx`, `app/admin/staff/[id]/remove-mentor/page.tsx`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short lib/data/staff-accounts.ts lib/data/staff-accounts.test.ts lib/staff components/staff components/forms/summary-ids.test.tsx app/admin/staff`
Expected: no output.

- [x] **Step 2: The data tests**

In `lib/data/staff-accounts.test.ts`, change the import from `./staff-accounts` to:

```ts
import { countAdmins, getStaffAccount, giveRole, listStaffAccounts, ownShopMentorId, removeRole } from "./staff-accounts";
```

and add at the end of the file:

```ts
describe("the mentor of the admin's own shop (stage M spec decisions 1 to 5)", () => {
  it("reads who mentors an owner's shop from the store: Naledi for Sipho, nobody for Lerato or a student", () => {
    expect(ownShopMentorId("acc-seller")).toBe("acc-mentor");
    expect(ownShopMentorId("acc-pending")).toBeNull();
    expect(ownShopMentorId("acc-student")).toBeNull();
    sampleStore().sellerProfiles.get("acc-seller")!.mentorId = null;
    expect(ownShopMentorId("acc-seller")).toBeNull();
  });

  it("refuses to remove the mentor role of whoever mentors the asking admin's own shop, changing nothing at all", async () => {
    sampleStore().accounts.get("acc-seller")!.roles = ["admin"];
    const before = structuredClone(sampleStore());
    expect(await removeRole("acc-mentor", "mentor", "acc-seller")).toBe("own-shop-mentor");
    expect(sampleStore()).toEqual(before);
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
  });

  it("goes by the seller profile, not the live shop: a paused shop is still the admin's own", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect(await removeRole("acc-mentor", "mentor", "acc-seller")).toBe("own-shop-mentor");
  });

  it("still lets another admin remove it, and Tech corner loses its mentor as before (stage J)", async () => {
    expect(await removeRole("acc-mentor", "mentor", "acc-admin")).toMatchObject({
      role: "mentor",
      unassigned: ["Tech corner"],
    });
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
  });

  it("leaves removing the admin role alone, for someone who holds both (decision 3)", async () => {
    sampleStore().accounts.get("acc-mentor")!.roles = ["mentor", "admin"];
    expect(await removeRole("acc-mentor", "admin", "acc-seller")).toMatchObject({ role: "admin", unassigned: [] });
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
  });
});
```

- [x] **Step 3: The action and notice tests**

In `lib/staff/account-actions.test.ts`:
- change `import { readFormState } from "@/lib/auth/form-state";` to `import { readFormState, writeFormState } from "@/lib/auth/form-state";`;
- change `import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";` to `import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";`;
- add at the end of the file:

```ts
describe("the mentor of the admin's own shop (stage M spec decisions 2, 5 and 7)", () => {
  /** The store as a refusal must leave it: everything but form state, which may gain only the notice. */
  function everythingButFormState() {
    const copy = structuredClone(sampleStore());
    copy.formStates.clear();
    return copy;
  }

  it("refuses Sipho, an admin, removing Naledi's mentor role: only the notice, on the staff page", async () => {
    sampleStore().accounts.get("acc-seller")!.roles = ["admin"];
    await signedInAs(request, "acc-seller");
    // A refusal left on the confirm page by an earlier try stays as it was: the form state isn't written or cleared.
    await writeFormState(removeRoleForm("acc-mentor", "mentor"), { errors: ["once-expired"], values: {}, notice: null }, STAFF_NOW);
    const before = everythingButFormState();
    const redirect = await redirectSignalOf(() => removeStaffRole(form({ account: "acc-mentor", role: "mentor" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/admin/staff", "replace", true]);
    expect(everythingButFormState()).toEqual(before);
    expect(await notice()).toBe("own-shop-mentor");
    expect((await readFormState(removeRoleForm("acc-mentor", "mentor")))?.errors).toEqual(["once-expired"]);
    expect([auditRows(), notesOf("acc-mentor"), request.updatedTags]).toEqual([[], [], []]);
  });

  it("still lets another admin remove it", async () => {
    sampleStore().accounts.get("acc-seller")!.roles = ["admin"];
    await asAdmin();
    expect(await redirectOf(() => removeStaffRole(form({ account: "acc-mentor", role: "mentor" })))).toBe("/admin/staff");
    expect(await notice()).toBe("role-removed");
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect(auditRows()).toHaveLength(1);
  });

  it("checks the role first: Sipho without the Admin role gets the 404, never the notice (spec section 3, Rules)", async () => {
    await signedInAs(request, "acc-seller");
    await expect(removeStaffRole(form({ account: "acc-mentor", role: "mentor" }))).rejects.toThrow("notFound");
    expect(await notice()).toBeNull();
  });
});
```

(`removeRoleForm`, `STAFF_NOW`, `signedInAs`, `form`, `asAdmin`, `notice`, `auditRows` and `notesOf` are already imported or declared in that file.)

In `lib/staff/notices.test.ts`, add at the end:

```ts
describe("the mentor of the admin's own shop (stage M spec decision 5)", () => {
  it("says nothing changed and why", () => {
    expect(staffNoticeText("own-shop-mentor")).toBe(
      "Nothing changed. They mentor your own shop, so another admin must remove their mentor role.",
    );
  });
});
```

- [x] **Step 4: The view tests**

In `components/staff/AdminStaff.test.tsx`, in the `view` helper's `<AdminStaff … />`, add `ownShopMentorId={null}` after `viewerId="acc-admin"`, and add inside the describe "Staff accounts (stage J spec decision 2)", after the test "says This is you. on the admin's own admin role…":

```tsx
  it("says Mentors your shop. on the mentor role of whoever mentors the viewer's shop, with no link (stage M spec decision 6)", () => {
    const sipho: StaffAccount = {
      id: "acc-seller",
      firstName: "Sipho",
      email: "seller@eduvos.com",
      campusSlug: "midrand",
      roles: ["admin"],
      mentors: [],
    };
    view({
      people: [{ ...naledi, roles: ["mentor", "admin"] }, pieter, sipho],
      viewerId: "acc-seller",
      ownShopMentorId: "acc-mentor",
    });
    const [, nalediRow, pieterRow, siphoRow] = screen.getAllByRole("row");
    expect(within(nalediRow).getByText("Mentors your shop.")).toHaveClass("staff-muted");
    expect(within(nalediRow).queryByRole("link", { name: "Remove mentor role for Naledi" })).toBeNull();
    // Her admin role is another matter (decision 3).
    expect(within(nalediRow).getByRole("link", { name: "Remove admin role for Naledi" })).toBeInTheDocument();
    expect(within(pieterRow).getByRole("link", { name: "Remove admin role for Pieter" })).toBeInTheDocument();
    expect(within(siphoRow).getByText("This is you.")).toBeInTheDocument();
  });

  it("offers every Remove link when nobody mentors the viewer's shop", () => {
    view();
    expect(screen.getByRole("link", { name: "Remove mentor role for Naledi" })).toBeInTheDocument();
    expect(screen.queryByText("Mentors your shop.")).toBeNull();
  });
```

In `components/staff/StaffRoleConfirm.test.tsx`, add inside the describe, after its last test:

```tsx
  it("refuses the mentor role of whoever mentors your own shop: the line, no form, a way back (stage M spec decision 6)", () => {
    render(<StaffRoleConfirm person={naledi} role="mentor" viewerId="acc-seller" errors={[]} mentorsOwnShop />);
    expect(
      screen.getByText(
        "Naledi mentors your own shop, so another admin must remove this role: it would leave your shop without a mentor.",
      ),
    ).toHaveClass("staff-confirm-lead");
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector("form")).toBeNull();
    expect(screen.queryByText(/You're the only admin/)).toBeNull();
    expect(screen.getByRole("link", { name: "Back to staff accounts" })).toHaveAttribute("href", "/admin/staff");
  });

  it("tells the only admin to give someone else the Admin role first", () => {
    render(<StaffRoleConfirm person={naledi} role="mentor" viewerId="acc-seller" errors={[]} mentorsOwnShop onlyAdmin />);
    expect(screen.getByText("You're the only admin. Give someone else the Admin role first.")).toBeInTheDocument();
  });

  it("titles that page with the person's role, since it refuses rather than asks", () => {
    expect(roleConfirmTitle(naledi, "mentor", "acc-seller", true)).toBe("Naledi's mentor role");
    expect(roleConfirmTitle(naledi, "mentor", "acc-seller", false)).toBe("Remove Naledi's mentor role");
    expect(roleConfirmTitle(naledi, "mentor", "acc-seller")).toBe("Remove Naledi's mentor role");
  });
```

In `components/forms/summary-ids.test.tsx`, in its `<AdminStaff … />` (about line 324), add `ownShopMentorId={null}` after `viewerId="acc-admin"`. (Its `<StaffRoleConfirm … />` needs nothing: the new props are optional, plan decision 2.)

- [x] **Step 5: Show red in a tests-only scratch copy**

Make `S="<your scratchpad>/vossie-m-task1-red"` as the conventions say, copying in only `lib/data/staff-accounts.test.ts`, `lib/staff/account-actions.test.ts`, `lib/staff/notices.test.ts`, `components/staff/AdminStaff.test.tsx`, `components/staff/StaffRoleConfirm.test.tsx` and `components/forms/summary-ids.test.tsx`. From `$S`:

Run: `pnpm test lib/data/staff-accounts.test.ts lib/staff/account-actions.test.ts lib/staff/notices.test.ts components/staff/AdminStaff.test.tsx components/staff/StaffRoleConfirm.test.tsx`
Expected: FAIL: `ownShopMentorId` isn't exported, the refusals remove the role (`role-removed`), the notice has no words, "Mentors your shop." and the refusal's line aren't drawn, and `roleConfirmTitle(…, true)` says "Remove Naledi's mentor role". The tests that pin stage J ("still lets another admin…", "leaves removing the admin role alone…", "checks the role first…", "offers every Remove link…") pass.

- [x] **Step 6: `ownShopMentorId` and the refusal in the data write**

In `lib/data/staff-accounts.ts`, after the line `const adminRows = () => [...sampleStore().accounts.values()].filter((row) => row.roles.includes("admin"));`, add:

```ts

/**
 * Who mentors `ownerId`'s own shop, read from the store now, never from a form (stage M spec decision 2): their seller
 * profile's mentor, whatever state the shop is in (live, paused or waiting), or null. Synchronous, so removeRole checks
 * it and writes in one pass.
 */
export function ownShopMentorId(ownerId: string): string | null {
  return sampleStore().sellerProfiles.get(ownerId)?.mentorId ?? null;
}
```

Replace `removeRole`'s doc comment, signature and first lines, from `/**` above it down to `if (!row || !row.roles.includes(role)) return null;`, with:

```ts
/**
 * Takes `role` away from `accountId`, asked by the admin `byId` (spec decisions 5 and 6). Never your own admin role
 * ("own-admin"), never the last admin ("last-admin"), and never the mentor role of whoever mentors `byId`'s own shop
 * ("own-shop-mentor", stage M spec decision 2): leaving your own shop without a mentor is another admin's decision. A
 * mentor's shops lose their mentor, as deleting the account does (lib/data/staff-privacy.ts); their notes, check-ins
 * and Hub posts stay. Null when there's no such role to take.
 */
export async function removeRole(
  accountId: string,
  role: StaffRole,
  byId: string,
): Promise<RemovedRole | "own-admin" | "last-admin" | "own-shop-mentor" | null> {
  const store = sampleStore();
  const row = store.accounts.get(accountId);
  if (!row || !row.roles.includes(role)) return null;
  if (role === "mentor" && ownShopMentorId(byId) === accountId) return "own-shop-mentor";
```

(The rest of the function stays as it is.) In the file's header comment, nothing changes: its promise ("Nothing here awaits between a check and its write") still holds.

- [x] **Step 7: The notice and the action**

In `lib/staff/notices.ts`, after the line `["own-request", "Nothing changed. It's your own request, so another admin must do this."],` add:

```ts
  // Stage M (spec decision 5): removing the mentor role of whoever mentors the admin's own shop.
  ["own-shop-mentor", "Nothing changed. They mentor your own shop, so another admin must remove their mentor role."],
```

In `lib/staff/account-actions.ts`, in `removeStaffRole`:
- replace its doc comment with:

```ts
/**
 * Take a role away, from its confirm page (spec decisions 4 and 5). Never your own admin role, never the last admin:
 * those go back to the confirm page with the words. Never the mentor role of whoever mentors your own shop (stage M
 * spec decision 5): that lands on the staff page with a notice, and nothing else is written. A mentor's shops lose
 * their mentor, and the entry names them.
 */
```

- after `const removed = await removeRole(accountId, role, staff.id);` add:

```ts
  if (removed === "own-shop-mentor") {
    // Another admin's decision (stage M spec decisions 2 and 5): the notice is the only write, on the page that shows
    // staff notices. The confirm page's form state is left as it was.
    await leaveNotice("own-shop-mentor", now);
    done(ADMIN_STAFF_PATH);
  }
```

- [x] **Step 8: The views**

In `components/staff/AdminStaff.tsx`:
- in `AdminStaffProps`, after the `viewerId` field, add:

```ts
  /** Who mentors the signed-in admin's own shop: their mentor role has no Remove link (stage M spec decision 6). */
  ownShopMentorId: string | null;
```

- replace `RowActions` (its doc comment and function) with:

```tsx
/**
 * One link per role. The admin's own admin role says "This is you." instead (spec decision 5), and the mentor role of
 * whoever mentors the admin's own shop says "Mentors your shop." (stage M spec decision 6).
 */
function RowActions({
  person,
  viewerId,
  ownShopMentorId,
}: {
  person: StaffAccount;
  viewerId: string;
  ownShopMentorId: string | null;
}) {
  return (
    <div className="staff-row-actions">
      {person.roles.map((role) => {
        if (role === "admin" && person.id === viewerId) {
          return (
            <span key={role} className="staff-muted">
              This is you.
            </span>
          );
        }
        if (role === "mentor" && person.id === ownShopMentorId) {
          return (
            <span key={role} className="staff-muted">
              Mentors your shop.
            </span>
          );
        }
        return <RemoveLink key={role} person={person} role={role} />;
      })}
    </div>
  );
}
```

- change `export function AdminStaff({ people, viewerId, campusNames, values, errors, once }: AdminStaffProps) {` to `export function AdminStaff({ people, viewerId, ownShopMentorId, campusNames, values, errors, once }: AdminStaffProps) {`;
- change `<RowActions key="change" person={person} viewerId={viewerId} />,` to `<RowActions key="change" person={person} viewerId={viewerId} ownShopMentorId={ownShopMentorId} />,`.

In `components/staff/StaffRoleConfirm.tsx`:
- in `StaffRoleConfirmProps`, after `errors: readonly FormError[];`, add:

```ts
  /**
   * Whether `person` mentors the signed-in admin's own shop: the page refuses rather than asks (stage M spec decision
   * 6). Only the remove-mentor page passes it.
   */
  mentorsOwnShop?: boolean;
  /** Whether the signed-in admin is the only one, so the refusal says how to hand the role on (stage M spec section 3). */
  onlyAdmin?: boolean;
```

- replace `roleConfirmTitle` (its doc comment and function) with:

```ts
/**
 * The page's heading. Your own admin role is named as yours, and the mentor role of whoever mentors your own shop as
 * theirs (stage M spec decision 6), since those pages refuse rather than ask.
 */
export function roleConfirmTitle(
  person: Pick<StaffAccount, "id" | "firstName">,
  role: StaffRole,
  viewerId: string,
  mentorsOwnShop = false,
): string {
  if (role === "admin" && person.id === viewerId) return "Your admin role";
  if (role === "mentor" && mentorsOwnShop) return `${person.firstName}'s mentor role`;
  return `Remove ${person.firstName}'s ${role} role`;
}
```

- change `export function StaffRoleConfirm({ person, role, viewerId, errors }: StaffRoleConfirmProps) {` to:

```tsx
export function StaffRoleConfirm({
  person,
  role,
  viewerId,
  errors,
  mentorsOwnShop = false,
  onlyAdmin = false,
}: StaffRoleConfirmProps) {
```

- after the own-admin branch's closing `}` (the `if (role === "admin" && person.id === viewerId) { … }` block), add:

```tsx
  if (role === "mentor" && mentorsOwnShop) {
    // Stage M spec decision 6: the reason where the button was, and no button. The words are samples for Lama.
    return (
      <div className="staff-confirm">
        <p className="staff-confirm-lead">
          {`${person.firstName} mentors your own shop, so another admin must remove this role: it would leave your shop without a mentor.`}
        </p>
        {onlyAdmin && <p>You&apos;re the only admin. Give someone else the Admin role first.</p>}
        <p>
          <Link href={ADMIN_STAFF_PATH} prefetch={false}>
            Back to staff accounts
          </Link>
        </p>
      </div>
    );
  }
```

- add to the doc comment above `StaffRoleConfirm`, after `the action refuses it too.`: ` So does the mentor role of whoever mentors your own shop (stage M).`

- [x] **Step 9: The pages**

In `app/admin/staff/page.tsx`:
- change `import { listStaffAccounts } from "@/lib/data/staff-accounts";` to `import { listStaffAccounts, ownShopMentorId } from "@/lib/data/staff-accounts";`;
- in `<AdminStaff …>`, after `viewerId={account.id}`, add `ownShopMentorId={ownShopMentorId(account.id)}`.

In `app/admin/staff/[id]/remove-mentor/page.tsx`:
- change `import { StaffRoleConfirm } from "@/components/staff/StaffRoleConfirm";` to `import { roleConfirmTitle, StaffRoleConfirm } from "@/components/staff/StaffRoleConfirm";`;
- change `import { getStaffAccount } from "@/lib/data/staff-accounts";` to `import { countAdmins, getStaffAccount, ownShopMentorId } from "@/lib/data/staff-accounts";`;
- after `const state = await readFormState(removeRoleForm(id, "mentor"));` add:

```tsx
  // Whether this person mentors the admin's own shop, read from the store now (stage M spec decisions 2 and 6).
  const mentorsOwnShop = ownShopMentorId(account.id) === id;
  const onlyAdmin = (await countAdmins()) === 1;
```

- change `` title={`Remove ${person.firstName}'s mentor role`} `` to `title={roleConfirmTitle(person, "mentor", account.id, mentorsOwnShop)}`;
- replace the `<StaffRoleConfirm … />` line with:

```tsx
      <StaffRoleConfirm
        person={person}
        role="mentor"
        viewerId={account.id}
        errors={staffErrors(state?.errors ?? [], {})}
        mentorsOwnShop={mentorsOwnShop}
        onlyAdmin={onlyAdmin}
      />
```

Run: `pnpm test lib/data/staff-accounts.test.ts lib/staff/account-actions.test.ts lib/staff/notices.test.ts components/staff/AdminStaff.test.tsx components/staff/StaffRoleConfirm.test.tsx components/forms/summary-ids.test.tsx`
Expected: PASS, every existing test in these files included.

Run: `pnpm lint lib/data/staff-accounts.ts lib/data/staff-accounts.test.ts lib/staff/account-actions.ts lib/staff/account-actions.test.ts lib/staff/notices.ts lib/staff/notices.test.ts components/staff/AdminStaff.tsx components/staff/AdminStaff.test.tsx components/staff/StaffRoleConfirm.tsx components/staff/StaffRoleConfirm.test.tsx components/forms/summary-ids.test.tsx app/admin/staff`
Expected: no output.

- [x] **Step 10: Typecheck, lint and the unit suite in a scratch copy**

Make `S="<your scratchpad>/vossie-m-task1-check"` with every file this task changed, and run the three commands the conventions give.
Expected: types and lint clean; every unit test passing (record the count: 2,661 plus this task's 14).

- [x] **Step 11: Hand over**

Files: `lib/data/staff-accounts.ts`, `lib/data/staff-accounts.test.ts`, `lib/staff/account-actions.ts`, `lib/staff/account-actions.test.ts`, `lib/staff/notices.ts`, `lib/staff/notices.test.ts`, `components/staff/AdminStaff.tsx`, `components/staff/AdminStaff.test.tsx`, `components/staff/StaffRoleConfirm.tsx`, `components/staff/StaffRoleConfirm.test.tsx`, `components/forms/summary-ids.test.tsx`, `app/admin/staff/page.tsx`, `app/admin/staff/[id]/remove-mentor/page.tsx`. Message:

```
feat: an admin can't remove the mentor role from whoever mentors their own shop (stage M spec decisions 1 to 7): removeRole refuses with "own-shop-mentor" before any write, read from the admin's seller profile now (ownShopMentorId); removeStaffRole lands on /admin/staff with the notice and writes nothing else; Staff accounts says "Mentors your shop." in place of the link, and the confirm page refuses with the reason, the only-admin sentence when it applies, and no button. Another admin still removes it as before, and removing the admin role is unchanged. Unit: <count>
```

---

### Task 2: Featured brings back the sellers featured longest ago first

Spec section 4 and decisions 8 to 12, with plan decisions 6 to 8.

**Files:**
- Modify: `lib/featured.ts`, `lib/featured.test.ts`
- Modify: `lib/data/featured.ts`, `lib/data/featured.test.ts`
- Modify: `app/trust/page.tsx`, `app/trust/page.test.tsx`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short lib/featured.ts lib/featured.test.ts lib/data/featured.ts lib/data/featured.test.ts app/trust`
Expected: no output.

- [x] **Step 2: The tests**

In `lib/featured.test.ts`, turn the three `Set`s into maps (the existing tests keep their meaning: every resting seller has the same last day, so the rotation decides, as before):
- in "draws resting sellers only after everyone else, and a pin ignores the break…", change `{ resting: new Set(["a", "c"]) }` to `{ resting: new Map([["a", "2026-10-11"], ["c", "2026-10-11"]]) }`, and `{ pinned: ["a"], resting: new Set(["a"]) }` to `{ pinned: ["a"], resting: new Map([["a", "2026-10-11"]]) }`;
- in "puts the campus's own sellers first among the resting ones too…", change `{ resting: new Set(["a", "b", "c", "d"]) }` to `{ resting: new Map(["a", "b", "c", "d"].map((slug) => [slug, "2026-10-13"])) }`.

Then add at the end of the file:

```ts
describe("which resting sellers come back first (stage M spec decisions 9 to 11)", () => {
  it("brings back the one featured longest ago first, after everyone who isn't resting", () => {
    // 12 October: a was in the row yesterday, b five days ago, c three days ago.
    const resting = new Map([
      ["a", "2026-10-11"],
      ["b", "2026-10-07"],
      ["c", "2026-10-09"],
    ]);
    const drawn = drawFeatured(sellers, "all", "2026-10-12", 10, { resting }).map((s) => s.slug);
    expect(drawn.slice(0, 2).sort()).toEqual(["d", "f"]);
    expect(drawn.slice(2)).toEqual(["b", "c", "a"]);
  });

  it("keeps the day's rotation between sellers last featured on the same day", () => {
    const resting = new Map([
      ["a", "2026-10-10"],
      ["c", "2026-10-10"],
    ]);
    const restedOn = (day: string) =>
      drawFeatured(sellers, "all", day, 10, { resting })
        .slice(3)
        .map((s) => s.slug);
    // The two-seller rotation leads with a on 12 October and with c on the 13th.
    expect(restedOn("2026-10-12")).toEqual(["a", "c"]);
    expect(restedOn("2026-10-13")).toEqual(["c", "a"]);
  });

  it("keeps the campus's own first: one resting since yesterday comes before another campus's resting five days", () => {
    // Pretoria on 12 October: only f (online) isn't resting; c and d are Pretoria's, a and b Midrand's.
    const resting = new Map([
      ["c", "2026-10-11"],
      ["d", "2026-10-08"],
      ["a", "2026-10-07"],
      ["b", "2026-10-10"],
    ]);
    expect(drawFeatured(sellers, "pretoria", "2026-10-12", 10, { resting }).map((s) => s.slug)).toEqual([
      "f",
      "d",
      "c",
      "a",
      "b",
    ]);
  });

  it("still lets a pin ignore the break", () => {
    const resting = new Map([
      ["a", "2026-10-11"],
      ["b", "2026-10-07"],
    ]);
    const drawn = drawFeatured(sellers, "all", "2026-10-12", 4, { pinned: ["a"], resting }).map((s) => s.slug);
    expect(drawn[0]).toBe("a");
    expect(drawn).toHaveLength(4);
    expect(drawn).not.toContain("b");
  });
});
```

In `lib/data/featured.test.ts`, add at the end of the file:

```ts
describe("the resting sellers who waited longest come back first (stage M spec decisions 9 to 11)", () => {
  /** A recorded row for "all", as featuredFor stores one. */
  const record = (day: string, sellerSlugs: string[]) =>
    sampleStore().featuredDraws.set(`all:${day}`, { key: `all:${day}`, campusSlug: "all", day, sellerSlugs });
  /** The nine sellers who may be featured, in the order drawFeatured sorts them. */
  const everyone = async () =>
    (await featuredChoices()).map((seller) => seller.slug).sort((a, b) => a.localeCompare(b));

  it("rests a seller with the latest day it was shown: shown five days ago and yesterday, it waited one day", async () => {
    const e = await everyone();
    expect(e).toHaveLength(9);
    record("2026-10-09", [e[0], e[1], e[2], e[3]]);
    record("2026-10-11", [e[4], e[5], e[6], e[7]]);
    record("2026-10-13", [e[8], e[0], e[1], e[2]]);
    // Everyone is resting. e[3] was shown on the 9th only, so it comes back first; then the 11th's, in the day's
    // rotation (on 14 October it starts at place 4 of 9). e[0] to e[2] count from the 13th, not the 9th.
    expect((await featuredFor("all", DAY)).map((seller) => seller.slug)).toEqual([e[3], e[4], e[5], e[6]]);
  });

  it("fills a nine-seller walk's resting places from the oldest row", async () => {
    const day1 = (await featuredFor("all", "2026-10-14")).map((seller) => seller.slug);
    const day2 = (await featuredFor("all", "2026-10-15")).map((seller) => seller.slug);
    const day3 = (await featuredFor("all", "2026-10-16")).map((seller) => seller.slug);
    expect(day2.some((slug) => day1.includes(slug))).toBe(false);
    // Day 3: the one seller shown on neither day, then three of day 1's, never day 2's.
    expect(day3).toHaveLength(4);
    expect(day3.slice(1).every((slug) => day1.includes(slug))).toBe(true);
  });

  it("counts a pinned day as a featured day: pins are in the recorded row (passes at HEAD)", async () => {
    const e = await everyone();
    await pin(e[0], "all", "2026-10-13");
    expect((await featuredFor("all", "2026-10-13"))[0].slug).toBe(e[0]);
    expect((await featuredFor("all", DAY)).map((seller) => seller.slug)).not.toContain(e[0]);
  });
});
```

In `app/trust/page.test.tsx`, in the test "says the week's break is a preference, kept only while there are enough other Verified sellers (amendment 3)", change the expected text to:

```tsx
      "A seller who has been featured sits out for a week when there are enough other Verified sellers to fill the row. When there aren't, the sellers featured longest ago come back first.",
```

and the test's name to `"says the week's break is a preference, and who comes back first when it gives (amendment 3, stage M spec decision 12)"`.

- [x] **Step 3: Show red in a tests-only scratch copy**

Make `S="<your scratchpad>/vossie-m-task2-red"`, copying in only `lib/featured.test.ts`, `lib/data/featured.test.ts` and `app/trust/page.test.tsx`. From `$S`:

Run: `pnpm test lib/featured.test.ts lib/data/featured.test.ts app/trust/page.test.tsx`
Expected: FAIL in "brings back the one featured longest ago first" (HEAD gives `["c", "a", "b"]`), "keeps the campus's own first" (HEAD gives `c` before `d`), "rests a seller with the latest day it was shown" (HEAD gives `[e[4], e[5], e[6], e[7]]`) and the trust test. The rotation-tie test, the pin tests and the existing tests pass (vitest doesn't typecheck, and a `Map` has `has`). The nine-seller walk may pass or fail at HEAD, by chance of the rotation.

- [x] **Step 4: The draw**

In `lib/featured.ts`, replace the `resting` field of `FeaturedOptions` (its doc comment and line) with:

```ts
  /**
   * Sellers who featured recently (the week's break), each with the latest SAST day (YYYY-MM-DD) they were in this
   * campus's row. They come after everyone else, so a pin ignores the break, and the one featured longest ago comes
   * back first (stage M spec decisions 9 to 11).
   */
  resting?: ReadonlyMap<string, string>;
```

Replace `drawFeatured` (its doc comment and function) with:

```ts
/**
 * The fair daily seller draw (spec 7.10). Verified sellers take turns: each day the order starts one place further
 * on, so nobody is favoured. The campus's own sellers come first, topped up from other campuses. Pins come before
 * the draw. Sellers resting after a recent turn come after everyone else, so the break is a preference: with nine
 * sellers for four places a strict break would empty the row for days (staff tools plan amendment 3). Among the
 * resting, the campus's own still come first, then whoever was featured longest ago, the day's rotation settling
 * ties (stage M spec decisions 9 and 10). Only sellers in `sellers` can be pinned: the caller passes the ones who may
 * be featured.
 */
export function drawFeatured(
  sellers: readonly Seller[],
  campus: CampusChoice,
  day: string,
  count = 4,
  { pinned = [], resting = new Map<string, string>() }: FeaturedOptions = {},
): Seller[] {
  const eligible = sellers.filter((seller) => seller.verified).sort((a, b) => a.slug.localeCompare(b.slug));
  const bySlug = new Map(eligible.map((seller) => [seller.slug, seller]));
  const pins = [...new Set(pinned)].flatMap((slug) => bySlug.get(slug) ?? []).slice(0, count);
  const taken = new Set(pins.map((seller) => seller.slug));
  // The campus's own sellers first, then the others; "all" is one group.
  const groups = (list: readonly Seller[]): (readonly Seller[])[] =>
    campus === ALL_CAMPUSES
      ? [list]
      : [list.filter((seller) => seller.campusSlug === campus), list.filter((seller) => seller.campusSlug !== campus)];
  const inOrder = (list: readonly Seller[]) => groups(list).flatMap((group) => rotate(group, day));
  // Within each group, the resting seller featured longest ago first. YYYY-MM-DD sorts as a date, and the sort is
  // stable, so sellers last featured on the same day keep the day's rotation (stage M spec decision 9).
  const lastDay = (seller: Seller) => resting.get(seller.slug) ?? "";
  const longestWaitFirst = (list: readonly Seller[]) =>
    groups(list).flatMap((group) => rotate(group, day).sort((a, b) => lastDay(a).localeCompare(lastDay(b))));
  const rested = eligible.filter((seller) => !taken.has(seller.slug) && resting.has(seller.slug));
  const pool = eligible.filter((seller) => !taken.has(seller.slug) && !resting.has(seller.slug));
  return [...pins, ...inOrder(pool), ...longestWaitFirst(rested)].slice(0, count);
}
```

(`rotate` returns a new array, so sorting it in place touches nothing else.)

- [x] **Step 5: The caller**

In `lib/data/featured.ts`, in `featuredFor`, replace:

```ts
    const resting = new Set<string>();
    for (let back = 1; back <= REST_DAYS; back += 1) {
      for (const slug of store.featuredDraws.get(drawKey(campus, addDays(day, -back)))?.sellerSlugs ?? []) resting.add(slug);
    }
```

with:

```ts
    // The week's break, with the latest day each resting seller was in this campus's row: walking back from
    // yesterday, the first day met is the latest (stage M spec decision 11). A pinned day counts: pins are in the row.
    const resting = new Map<string, string>();
    for (let back = 1; back <= REST_DAYS; back += 1) {
      const shown = addDays(day, -back);
      for (const slug of store.featuredDraws.get(drawKey(campus, shown))?.sellerSlugs ?? []) {
        if (!resting.has(slug)) resting.set(slug, shown);
      }
    }
```

In the file's header comment, after the sentence that ends `so a row is only short when there aren't enough eligible sellers at all.`, add ` When resting sellers are needed, the campus's own come first, then whoever was featured longest ago (stage M).` (rewrap the comment at about 120 characters, keeping the words).

- [x] **Step 6: The trust page**

In `app/trust/page.tsx`, replace the list item:

```tsx
          <li>
            A seller who has been featured sits out for a week when there are enough other Verified sellers to fill the
            row.
          </li>
```

with:

```tsx
          <li>
            A seller who has been featured sits out for a week when there are enough other Verified sellers to fill the
            row. When there aren&apos;t, the sellers featured longest ago come back first.
          </li>
```

and set its `updated` to the day you build this in SAST (`updated="2026-10-21"` if it's still the 21st).

Run: `pnpm test lib/featured.test.ts lib/data/featured.test.ts app/trust/page.test.tsx lib/data/index.test.ts`
Expected: PASS, every existing test included (`lib/data/index.test.ts` reads `getFeatured`, which calls `featuredFor`).

Run: `pnpm lint lib/featured.ts lib/featured.test.ts lib/data/featured.ts lib/data/featured.test.ts app/trust`
Expected: no output.

- [x] **Step 7: Typecheck, lint and the unit suite in a scratch copy**

Make `S="<your scratchpad>/vossie-m-task2-check"` with every file this task changed, and run the three commands the conventions give.
Expected: types and lint clean (TypeScript now checks that every `resting` is a `Map`); every unit test passing (record the count).

- [x] **Step 8: Hand over**

Files: `lib/featured.ts`, `lib/featured.test.ts`, `lib/data/featured.ts`, `lib/data/featured.test.ts`, `app/trust/page.tsx`, `app/trust/page.test.tsx`. Message:

```
feat: Featured brings back the sellers featured longest ago first when it must use resting ones (stage M spec decisions 8 to 12): the resting are each campus group, the campus's own still first, sorted stably by the latest day each was in that campus's row, so ties keep the day's rotation; featuredFor builds that map from the recorded rows, a pinned day counting. A pure function still: no clock. The trust page says which come back first. Unit: <count>
```

---

### Task 3: One reminder before a request closes itself

Spec section 5 and decisions 13 to 20, with plan decisions 9 to 12.

**Files:**
- Modify: `lib/looking-for/rules.ts`, `lib/looking-for/rules.test.ts`
- Modify: `lib/looking-for/words.ts`, `lib/looking-for/words.test.ts`
- Modify: `lib/data/rows.ts`, `lib/data/store.ts`
- Modify: `data/fixtures/request-rows.ts`, `data/fixtures/request-rows.test.ts`
- Modify: `lib/data/requests.ts`, `lib/data/requests.test.ts`
- Modify: `lib/looking-for/actions.test.ts`
- Modify: `app/how-it-works/page.tsx`, `app/how-it-works/page.test.tsx`
- Modify: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short lib/looking-for lib/data/rows.ts lib/data/store.ts lib/data/requests.ts lib/data/requests.test.ts data/fixtures app/how-it-works app/privacy`
Expected: no output. Then `grep -n "^export const STORE_VERSION" lib/data/store.ts` prints `export const STORE_VERSION = 13;` (Recheck 2; if it's higher, use the next number in Step 7).

- [x] **Step 2: The rule's and the words' tests**

In `lib/looking-for/rules.test.ts`, add `REMINDER_DAYS_BEFORE`, `reminderDay` and `reminderDue` to the import from `./rules` (keep it sorted: after `parseBudget`, `REMINDER_DAYS_BEFORE`, `reminderDay`, `reminderDue`, then `requestOpenOn`), and add at the end of the file:

```ts
describe("the reminder before a request closes itself (stage M spec decisions 13 to 16)", () => {
  // Needed by Friday 16 October: closed from Tuesday 20, reminded from Sunday 18.
  const ROW = {
    askerId: "acc-student",
    neededBy: "2026-10-16",
    updatedAt: "2026-10-13T09:30:00.000Z",
    status: "open" as const,
    hiddenAt: null,
    remindedFor: null,
  };

  it("is due from two days before the closing day, in South African dates", () => {
    expect(REMINDER_DAYS_BEFORE).toBe(2);
    expect(reminderDay("2026-10-20")).toBe("2026-10-18");
    // Posted 13 October with no date: closed from 12 November, reminded from the 10th.
    expect(reminderDay("2026-11-12")).toBe("2026-11-10");
    expect(reminderDay("2027-01-01")).toBe("2026-12-30");
  });

  it("is due on the two days before the closing day, and not the day before them or on the closing day", () => {
    expect(reminderDue(ROW, "2026-10-17")).toBe(false);
    expect(reminderDue(ROW, "2026-10-18")).toBe(true);
    expect(reminderDue(ROW, "2026-10-19")).toBe(true);
    expect(reminderDue(ROW, "2026-10-20")).toBe(false);
  });

  it("is sent once per closing day: not again for the same day, again for a new one", () => {
    expect(reminderDue({ ...ROW, remindedFor: "2026-10-20" }, "2026-10-18")).toBe(false);
    expect(reminderDue({ ...ROW, remindedFor: "2026-10-15" }, "2026-10-18")).toBe(true);
  });

  it("is never due for a sample, a hidden request or a closed one", () => {
    expect(reminderDue({ ...ROW, askerId: null }, "2026-10-18")).toBe(false);
    expect(reminderDue({ ...ROW, hiddenAt: "2026-10-15T08:00:00.000Z" }, "2026-10-18")).toBe(false);
    expect(reminderDue({ ...ROW, status: "closed" }, "2026-10-18")).toBe(false);
  });
});
```

In `lib/looking-for/words.test.ts`, add `requestCloseReminderText` to the import from `./words` (sorted: after `requestAutoClosedText`), and add at the end of the file:

```ts
describe("the reminder before a request closes itself (stage M spec section 5, Words)", () => {
  it("names the closing day and why, and what keeps the request up", () => {
    expect(requestCloseReminderText("Kettle for res", "2026-10-20", "needed-by")).toBe(
      "Your request Kettle for res closes automatically on 20 Oct, 3 days after the date you needed it by. Still need it? Give it a new date in Your requests.",
    );
    expect(requestCloseReminderText("Kettle for res", "2026-11-12", "idle")).toBe(
      "Your request Kettle for res closes automatically on 12 Nov, after 30 days with no changes. Still need it? Edit it in Your requests and it stays up for 30 days more.",
    );
  });
});
```

- [x] **Step 3: Settling's, the seeds' and the action's tests**

In `data/fixtures/request-rows.test.ts`, replace the test "names no asker, and none is closed by anyone or hidden" with:

```ts
  it("names no asker, and none is closed by anyone, hidden or reminded (stage M spec decision 15)", () => {
    for (const row of sampleRequestRows) {
      expect(
        [row.askerId, row.closedAt, row.closedBy, row.hiddenAt, row.hiddenReason, row.remindedFor],
        row.id,
      ).toEqual([null, null, null, null, null, null]);
    }
  });
```

In `lib/data/requests.test.ts`, add at the end of the file (every name it uses is already imported there):

```ts
describe("one reminder before a request closes itself (stage M spec decisions 13 to 20)", () => {
  // Needed by 16 October: closed from the 20th, reminded from the 18th (00:00 in South Africa is 22:00 UTC the day before).
  const DATED: RequestFields = { ...FIELDS, neededBy: "2026-10-16" };
  const ON_THE_18TH = new Date("2026-10-18T08:00:00.000Z");
  const notes = async () =>
    (await getNotifications("acc-student", 20)).filter((item) => item.kind === "request-update");

  it("reminds the asker once from the reminder day, linking to Your requests, and closes nothing", async () => {
    const { id } = await post("acc-student", NOW, DATED);
    expect(await settleRequests(ON_THE_18TH)).toBe(0);
    expect(sampleStore().requests.get(id)).toMatchObject({ status: "open", closedAt: null, remindedFor: "2026-10-20" });
    expect(await notes()).toEqual([
      expect.objectContaining({
        text: "Your request Desk lamp for res closes automatically on 20 Oct, 3 days after the date you needed it by. Still need it? Give it a new date in Your requests.",
        href: "/account/requests",
      }),
    ]);
    expect(await settleRequests(new Date("2026-10-19T08:00:00.000Z"))).toBe(0);
    expect(await notes()).toHaveLength(1);
  });

  it("words the 30 days' reminder for a request with no needed-by date", async () => {
    // Posted 14 October: closed from 13 November, reminded from the 11th.
    await post("acc-student", NOW);
    await settleRequests(new Date("2026-11-11T08:00:00.000Z"));
    expect((await notes()).map((item) => item.text)).toEqual([
      "Your request Desk lamp for res closes automatically on 13 Nov, after 30 days with no changes. Still need it? Edit it in Your requests and it stays up for 30 days more.",
    ]);
  });

  it("starts at the very start of the reminder day in South Africa, not a second before", async () => {
    const { id } = await post("acc-student", NOW, DATED);
    await settleRequests(new Date("2026-10-17T21:59:59.000Z"));
    expect(await notes()).toEqual([]);
    expect(sampleStore().requests.get(id)?.remindedFor).toBeNull();
    await settleRequests(new Date("2026-10-17T22:00:00.000Z"));
    expect(await notes()).toHaveLength(1);
  });

  it("reminds again when an edit moves the closing day, and not when it keeps it", async () => {
    const { id } = await post("acc-student", NOW, DATED);
    await settleRequests(ON_THE_18TH);
    // A new title, the same date: the same closing day, so no second reminder.
    await updateRequest("acc-student", id, { ...DATED, title: "Clip-on desk lamp" }, ON_THE_18TH);
    await settleRequests(new Date("2026-10-19T08:00:00.000Z"));
    expect(await notes()).toHaveLength(1);
    // Needed by the 25th now: closed from the 29th, reminded from the 27th.
    await updateRequest("acc-student", id, { ...DATED, neededBy: "2026-10-25" }, new Date("2026-10-19T09:00:00.000Z"));
    await settleRequests(new Date("2026-10-26T08:00:00.000Z"));
    expect(await notes()).toHaveLength(1);
    await settleRequests(new Date("2026-10-27T08:00:00.000Z"));
    // Newest first; the old reminder stays, naming the day it was sent for (decision 19).
    expect((await notes()).map((item) => item.text)).toEqual([
      expect.stringMatching(/^Your request Desk lamp for res closes automatically on 29 Oct,/),
      expect.stringMatching(/closes automatically on 20 Oct,/),
    ]);
    expect(sampleStore().requests.get(id)?.remindedFor).toBe("2026-10-29");
  });

  it("reminds again after a reopen gives the request a new closing day", async () => {
    // Posted 14 September: closed from 14 October, reminded from the 12th.
    const { id } = await post("acc-student", new Date("2026-09-14T08:00:00.000Z"));
    await settleRequests(new Date("2026-10-12T08:00:00.000Z"));
    expect(await settleRequests(NOW)).toBe(1);
    await setRequestOpen("acc-student", id, true, NOW);
    // Reopened 14 October: closed from 13 November, reminded from the 11th.
    await settleRequests(new Date("2026-11-11T08:00:00.000Z"));
    expect((await notes()).map((item) => item.text)).toEqual([
      expect.stringMatching(/closes automatically on 13 Nov,/),
      expect.stringMatching(/closed automatically after 30 days/),
      expect.stringMatching(/closes automatically on 14 Oct,/),
    ]);
    expect(sampleStore().requests.get(id)?.remindedFor).toBe("2026-11-13");
  });

  it("sends only the close when nothing looked during the two days", async () => {
    await post("acc-student", NOW, DATED);
    expect(await settleRequests(new Date("2026-10-20T08:00:00.000Z"))).toBe(1);
    expect((await notes()).map((item) => item.text)).toEqual([
      expect.stringMatching(/closed automatically 3 days after the date you needed it by/),
    ]);
  });

  it("never reminds about a sample, a hidden request or a closed one", async () => {
    const hidden = await post("acc-student", NOW, DATED);
    await hideRequest(hidden.id, "Checking it.", NOW);
    const closed = await post("acc-student", NOW, DATED);
    await setRequestOpen("acc-student", closed.id, false, NOW);
    // r-001 was needed by 16 October too, but a sample has no asker and no closing day.
    await settleRequests(ON_THE_18TH);
    expect(await notes()).toEqual([]);
    expect([...sampleStore().requests.values()].every((row) => row.remindedFor === null)).toBe(true);
  });

  it("reminds once when two looks come at once", async () => {
    await post("acc-student", NOW, DATED);
    await Promise.all([settleRequests(ON_THE_18TH), settleRequests(ON_THE_18TH)]);
    expect(await notes()).toHaveLength(1);
  });

  it("goes with the request when it's deleted", async () => {
    const { id } = await post("acc-student", NOW, DATED);
    await settleRequests(ON_THE_18TH);
    expect(await deleteRequest("acc-student", id)).toBe(true);
    expect(await notes()).toEqual([]);
  });

  it("starts every new request unreminded, and leaves the field out of the data download (decision 20)", async () => {
    const { id } = await post("acc-student", NOW, DATED);
    expect(sampleStore().requests.get(id)?.remindedFor).toBeNull();
    await settleRequests(ON_THE_18TH);
    expect(Object.keys((await exportRequests("acc-student"))[0])).not.toContain("remindedFor");
  });
});
```

In `lib/looking-for/actions.test.ts`, add at the end of the file:

```ts
describe("the reminder in a Looking For action (stage M spec decision 14)", () => {
  it("reminds the asker without expiring the board: only a close does", async () => {
    await asStudent();
    // Needed by the 12th: closed from the 16th, reminded from the 14th, STAFF_NOW's day.
    const { id } = await createRequest({
      askerId: "acc-student",
      fields: { ...FIELDS, neededBy: "2026-10-12" },
      now: STAFF_NOW,
    });
    const theirs = await posted("acc-mentor");
    // A press that changes nothing itself (Close on someone else's request), so only the settle could expire a tag.
    await redirectOf(() => closeMyRequest(form({ request: theirs.id })));
    expect(sampleStore().requests.get(id)).toMatchObject({ status: "open", remindedFor: "2026-10-16" });
    expect(request.updatedTags).toEqual([]);
    const told = (await getNotifications("acc-student", 20)).filter((item) => item.kind === "request-update");
    expect(told).toHaveLength(1);
  });
});
```

- [x] **Step 4: The info pages' tests**

In `app/how-it-works/page.test.tsx`, change the expected text `"Requests close automatically 3 days after their needed-by date, or after 30 days with no changes. You can reopen one."` to:

```tsx
        "Requests close automatically 3 days after their needed-by date, or after 30 days with no changes. You're reminded 2 days before, and you can reopen one.",
```

In `app/privacy/page.test.tsx`, in the test "says requests close themselves, that you're told, and that you can reopen one (stage L spec section 4)":
- rename it `"says requests close themselves, that you're reminded and told, and that you can reopen one (stages L and M)"`;
- change the regex to `/the Hub acts on your report, your shop, your listing or your request, your request is about to close automatically, or does, a mentor answers/`;
- change the sentence to:

```tsx
      "An open request closes automatically 3 days after its needed-by date, or after 30 days with no changes; you're reminded 2 days before and told when it does, and you can reopen it.",
```

- [x] **Step 5: Show red in a tests-only scratch copy**

Make `S="<your scratchpad>/vossie-m-task3-red"`, copying in only `lib/looking-for/rules.test.ts`, `lib/looking-for/words.test.ts`, `data/fixtures/request-rows.test.ts`, `lib/data/requests.test.ts`, `lib/looking-for/actions.test.ts`, `app/how-it-works/page.test.tsx` and `app/privacy/page.test.tsx`. From `$S`:

Run: `pnpm test lib/looking-for/rules.test.ts lib/looking-for/words.test.ts data/fixtures/request-rows.test.ts lib/data/requests.test.ts lib/looking-for/actions.test.ts app/how-it-works app/privacy`
Expected: FAIL: the rule and the words don't exist, the seeds have no `remindedFor` (undefined, not null), nothing is reminded, and the info pages' sentences are stage L's. "Sends only the close…", "never reminds…" and "goes with the request…" may pass at HEAD (nothing reminds there yet); every existing test passes.

- [x] **Step 6: The rule and the words**

In `lib/looking-for/rules.ts`, after the function `closedAtFor` (and before `cleanTitle`), add:

```ts
// --- The reminder (stage M spec decisions 13 to 16) ---------------------------------------------------------------

/** Days before the closing day the asker is reminded, once: two whole open days to act (stage M spec decision 13). */
export const REMINDER_DAYS_BEFORE = 2;

/** The SAST date (YYYY-MM-DD) the reminder is due from, for a request that closes on `closesOn`. */
export function reminderDay(closesOn: string): string {
  return addDays(closesOn, -REMINDER_DAYS_BEFORE);
}

/**
 * Whether the asker is due their one reminder on `today`, a SAST date (stage M spec decisions 13, 15 and 16): the
 * request is open, not hidden and has an asker (so a closing day); today is from its reminder day to the day before its
 * closing day; and no reminder has been sent for that closing day. An edit or a reopen that moves the closing day
 * allows a new one. A function of the row and the date alone: it reads no clock.
 */
export function reminderDue(
  row: {
    askerId: string | null;
    neededBy: string | null;
    updatedAt: string;
    status: RequestStatus;
    hiddenAt: string | null;
    remindedFor: string | null;
  },
  today: string,
): boolean {
  if (row.status !== "open" || row.hiddenAt !== null) return false;
  const closesOn = closingDay(row);
  return closesOn !== null && reminderDay(closesOn) <= today && today < closesOn && row.remindedFor !== closesOn;
}
```

In `lib/looking-for/words.ts`:
- add `import { dayMonth } from "@/lib/format";` as the first import (before `import type { RequestState } from "@/lib/types";`);
- after the function `requestAutoClosedText`, add:

```ts
/** What keeps the request up, by why it would close (stage M spec section 5, Words). */
const REMINDER_NEXT: Readonly<Record<CloseReason, string>> = {
  "needed-by": "Give it a new date in Your requests.",
  idle: `Edit it in Your requests and it stays up for ${IDLE_CLOSE_DAYS} days more.`,
};

/**
 * The asker's one reminder, 2 days before their request closes itself (stage M spec decisions 13 and 17), with the
 * "request-update" kind. `closesOn` is the closing day, written as Your requests writes it.
 */
export function requestCloseReminderText(title: string, closesOn: string, reason: CloseReason): string {
  return `Your request ${title} closes automatically on ${dayMonth(closesOn)}, ${AUTO_CLOSE_WHY[reason]}. Still need it? ${REMINDER_NEXT[reason]}`;
}
```

- [x] **Step 7: The row, the store and the seeds**

In `lib/data/rows.ts`, in `RequestRow`, after the `closedBy` field, add:

```ts
  /**
   * The closing day (SAST date) the asker was reminded about, 2 days before it (stage M spec decision 15). A new
   * closing day, after an edit or a reopen, allows a new reminder; nothing clears it. Null until one is sent, and on
   * the samples.
   */
  remindedFor: string | null;
```

In `lib/data/store.ts`, in the comment above `STORE_VERSION`, after the line that starts ` * 13: a report remembers who owned its target`, add:

```ts
 * 14: a Looking For request remembers the closing day its reminder was sent for (`remindedFor`, stage M spec decision 15).
```

and change `export const STORE_VERSION = 13;` to `export const STORE_VERSION = 14;` (Recheck 2: the next number, whatever it is).

In `data/fixtures/request-rows.ts`, add `remindedFor: null,` after `closedBy: null,`, and in its comment change `nothing closed by anyone or hidden, and no closedBy (stage L).` to `nothing closed by anyone or hidden, no closedBy (stage L) and no reminder sent (stage M).` (rewrap at about 120 characters).

- [x] **Step 8: Settling sends the reminder**

In `lib/data/requests.ts`:
- change the import from `@/lib/looking-for/rules` to:

```ts
import {
  closedAtFor,
  closeReasonOf,
  closingDay,
  type CloseReason,
  reminderDue,
  requestOpenOn,
  type RequestFields,
} from "@/lib/looking-for/rules";
```

- change `import { requestAutoClosedText } from "@/lib/looking-for/words";` to `import { requestAutoClosedText, requestCloseReminderText } from "@/lib/looking-for/words";`;
- in `createRequest`, add `remindedFor: null,` after `closedBy: null,`;
- replace `settleRequests` (its doc comment and function) with:

```ts
/**
 * Stores the close of every open, unhidden request whose closing day has come (stage L spec decisions 11, 12 and 16),
 * and tells each asker once, in the app: `status` "closed", `closedAt` the start of the closing day in SAST, `closedBy`
 * "auto", `updatedAt` as it was. From 2 days before the closing day it reminds the asker once instead, marking
 * `remindedFor` with that closing day (stage M spec decisions 13 to 15); a request that reaches its closing day
 * unreminded gets only the close. Every due row is marked in one pass before anything is awaited, so two renders at
 * once can't close a request twice, or tell or remind its asker twice, and a closed row is never settled again. A
 * hidden request waits until it's shown again; a sample one never closes. It writes, so request-time code only: never
 * inside "use cache". How many it closed, so a Server Action knows to call requestsChanged(): a reminder changes
 * nothing a cached page shows.
 */
export async function settleRequests(now: Date): Promise<number> {
  const today = sastDate(now);
  const closed: RequestRow[] = [];
  // Copied when marked, so the words are the ones that were due (stage M plan decision 9).
  const reminders: { askerId: string; id: string; title: string; closesOn: string; reason: CloseReason }[] = [];
  for (const row of sampleStore().requests.values()) {
    if (row.status !== "open" || row.hiddenAt !== null) continue;
    const day = closingDay(row);
    if (day === null) continue;
    if (today >= day) {
      row.status = "closed";
      row.closedAt = closedAtFor(day);
      row.closedBy = "auto";
      closed.push(row);
    } else if (row.askerId !== null && reminderDue(row, today)) {
      row.remindedFor = day;
      reminders.push({ askerId: row.askerId, id: row.id, title: row.title, closesOn: day, reason: closeReasonOf(row) });
    }
  }
  for (const row of closed) {
    if (row.askerId === null) continue;
    await notify({
      accountId: row.askerId,
      kind: "request-update",
      subjectId: row.id,
      text: requestAutoClosedText(row.title, closeReasonOf(row)),
      href: YOUR_REQUESTS_PATH,
      now,
    });
  }
  for (const reminder of reminders) {
    await notify({
      accountId: reminder.askerId,
      kind: "request-update",
      subjectId: reminder.id,
      text: requestCloseReminderText(reminder.title, reminder.closesOn, reminder.reason),
      href: YOUR_REQUESTS_PATH,
      now,
    });
  }
  return closed.length;
}
```

- in the file's header comment, after `…telling the asker once.`, add ` Two days before, it reminds them once (stage M).` (rewrap at about 120 characters).

- [x] **Step 9: The info pages**

In `app/how-it-works/page.tsx`, replace:

```tsx
          Requests close automatically 3 days after their needed-by date, or after 30 days with no changes. You can
          reopen one.
```

with:

```tsx
          Requests close automatically 3 days after their needed-by date, or after 30 days with no changes. You&apos;re
          reminded 2 days before, and you can reopen one.
```

In `app/privacy/page.tsx`:
- in "Your notifications.", replace:

```tsx
            match, the Hub acts on your report, your shop, your listing or your request, your request closes
            automatically, a mentor answers your slot request, someone asks for a slot at your office hours, or your
            staff role changes. Only you see them.
```

  with:

```tsx
            match, the Hub acts on your report, your shop, your listing or your request, your request is about to
            close automatically, or does, a mentor answers your slot request, someone asks for a slot at your office
            hours, or your staff role changes. Only you see them.
```

- in "Your Looking For requests.", replace:

```tsx
            automatically 3 days after its needed-by date, or after 30 days with no changes; you&apos;re told, and you
            can reopen it.
```

  with:

```tsx
            automatically 3 days after its needed-by date, or after 30 days with no changes; you&apos;re reminded 2
            days before and told when it does, and you can reopen it.
```

Both pages already say `updated="2026-10-21"`; if the day you build this in SAST is later, set both to it.

Run: `pnpm test lib/looking-for data/fixtures/request-rows.test.ts lib/data/requests.test.ts lib/data/store.test.ts lib/data/accounts.test.ts lib/staff/admin-actions.test.ts app/how-it-works app/privacy`
Expected: PASS, every existing test included. (Stage L's settle tests still pass: their due requests are past their closing day, so they close and aren't reminded; the edit test that keeps a passed needed-by date of the 12th now also reminds, and checks no notification.) If an existing test fails because a reminder appeared where it counts notifications, report it to the controller before changing it.

Run: `pnpm lint lib/looking-for lib/data/rows.ts lib/data/store.ts lib/data/requests.ts lib/data/requests.test.ts data/fixtures app/how-it-works app/privacy`
Expected: no output.

- [x] **Step 10: Typecheck, lint and the unit suite in a scratch copy**

Make `S="<your scratchpad>/vossie-m-task3-check"` with every file this task changed, and run the three commands the conventions give.
Expected: types and lint clean (every `RequestRow` literal names `remindedFor`: the fixture and `createRequest`; `lib/data/numbers.test.ts` copies a seeded row with `structuredClone`, so it needs nothing); every unit test passing (record the count).

- [x] **Step 11: Hand over**

Files: `lib/looking-for/rules.ts`, `lib/looking-for/rules.test.ts`, `lib/looking-for/words.ts`, `lib/looking-for/words.test.ts`, `lib/data/rows.ts`, `lib/data/store.ts`, `data/fixtures/request-rows.ts`, `data/fixtures/request-rows.test.ts`, `lib/data/requests.ts`, `lib/data/requests.test.ts`, `lib/looking-for/actions.test.ts`, `app/how-it-works/page.tsx`, `app/how-it-works/page.test.tsx`, `app/privacy/page.tsx`, `app/privacy/page.test.tsx`. Message:

```
feat: one in-app reminder two days before a request closes itself (stage M spec decisions 13 to 20): reminderDue is a pure function of the row and the SAST date; settleRequests marks remindedFor with the closing day in its one synchronous loop and sends the closes, then the reminders, with the request-update kind, linking to Your requests, so two looks at once remind once, an edit or reopen that moves the closing day allows a new one, and a request that reaches its closing day unreminded gets only the close. The count it returns is still the closes, so a reminder expires no tag. RequestRow.remindedFor, STORE_VERSION 14; not in the data download. How it works and the privacy policy say so. Unit: <count>
```

---

### Task 4: End to end, the build and the size check

Spec section 3 "Tests" (end to end) and section 9's build check, with plan decisions 13 to 16.

**Files:**
- Modify: `tests/e2e/housekeeping-writes.spec.ts`

- [x] **Step 1: Check the file is yours to edit**

Run: `git --no-optional-locks status --short playwright.config.ts tests/e2e`
Expected: only the header session's `tests/e2e/listing.spec.ts` and `tests/e2e/responsive.spec.ts` (and perhaps `a11y.spec.ts`), which this task never touches. If `playwright.config.ts` or `housekeeping-writes.spec.ts` shows, stop and report.

- [x] **Step 2: The test**

In `tests/e2e/housekeeping-writes.spec.ts`:
- after the file's opening comment (the one that ends `…here, the dates the asker is shown.`), add:

```ts

// Two tests give Sipho the Admin role for their length and take it away in a finally, and fullyParallel is on: run this
// file's tests in order, in one worker, or one would take the role away mid-test of the other (stage M plan decision
// 13). Retries stay per test, and a failure doesn't skip the rest.
test.describe.configure({ mode: "default" });
```

- after the first test (the one that ends `await removeSiphosAdminRole(pieter).finally(() => pieter.context().close());` and `});`), add:

```ts

const REMOVE_NALEDIS_MENTOR_ROLE = "/admin/staff/acc-mentor/remove-mentor";
const OWN_MENTOR_LINE =
  "Naledi mentors your own shop, so another admin must remove this role: it would leave your shop without a mentor.";

test("an admin can't remove the mentor role from whoever mentors their own shop, and a forged post changes nothing (stage M spec section 3)", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const pieter = await signedInPage(browser, baseURL!, "Admin", "/admin/staff");
  let plain: BrowserContext | null = null;
  let siphoContext: BrowserContext | null = null;
  try {
    // An interrupted earlier run on the same server may have left Sipho an admin: start clean.
    await removeSiphosAdminRole(pieter);
    await giveRole(pieter, "seller@eduvos.com", "Admin");
    // The remove form as Pieter's page draws it without the app's JavaScript: its fields, the Server Action's own among
    // them, are what a forged post or an old tab would send (stage M plan decision 14).
    plain = await browser.newContext({ baseURL, serviceWorkers: "block" });
    await plain.route("**/_next/static/**/*.js", (route) => route.abort());
    await copySession(browser, plain, baseURL!, "Admin");
    const pieterPlain = await plain.newPage();
    await pieterPlain.goto(REMOVE_NALEDIS_MENTOR_ROLE);
    const removeForm = main(pieterPlain)
      .locator("form")
      .filter({ has: pieterPlain.getByRole("button", { name: "Remove Naledi's mentor role" }) });
    const fields = await removeForm.evaluate((form) =>
      Object.fromEntries([...new FormData(form as HTMLFormElement)].map(([name, value]) => [name, String(value)])),
    );
    expect([fields.account, fields.role]).toEqual(["acc-mentor", "mentor"]);

    // Sipho, now an admin, on Staff accounts: Naledi mentors his shop, so her row says so in place of the link.
    const sipho = await signedInPage(browser, baseURL!, "Seller, Tech corner", "/admin/staff");
    siphoContext = sipho.context();
    await expect(main(sipho).getByRole("table", { name: /^Staff accounts/ })).toBeVisible(POST_LANDS);
    const naledisRow = main(sipho).getByRole("row").filter({ hasText: "mentor@eduvos.com" });
    await expect(naledisRow).toContainText("Mentors your shop.");
    await expect(naledisRow.getByRole("link", { name: "Remove mentor role for Naledi" })).toHaveCount(0);
    await expect(
      main(sipho)
        .getByRole("row")
        .filter({ hasText: "admin@eduvos.com" })
        .getByRole("link", { name: "Remove admin role for Pieter" }),
    ).toBeVisible();

    // The confirm page refuses rather than asks: the line, no button, the way back. axe at 1440 and 390.
    await sipho.goto(REMOVE_NALEDIS_MENTOR_ROLE);
    await expect(main(sipho).getByRole("heading", { level: 1, name: "Naledi's mentor role" })).toBeVisible();
    await expect(main(sipho).getByText(OWN_MENTOR_LINE)).toBeVisible();
    await expect(main(sipho).getByRole("button", { name: "Remove Naledi's mentor role" })).toHaveCount(0);
    await expect(main(sipho).getByRole("link", { name: "Back to staff accounts" })).toBeVisible();
    // Pieter is an admin too, so Sipho isn't the only one.
    await expect(main(sipho).getByText(/You're the only admin/)).toHaveCount(0);
    // A staff page's tab title streams in after its heading (stage J's checks): axe once the page is whole.
    await expect(sipho).toHaveTitle(/\S/);
    expect(await seriousIssues(sipho)).toEqual([]);
    await sipho.setViewportSize({ width: 390, height: 844 });
    await sipho.reload();
    await expect(main(sipho).getByText(OWN_MENTOR_LINE)).toBeVisible();
    await expect(sipho).toHaveTitle(/\S/);
    expect(await seriousIssues(sipho)).toEqual([]);
    await sipho.setViewportSize({ width: 1440, height: 900 });

    // A forged removal: the form's own fields, sent with Sipho's session. It lands with the notice and changes nothing.
    const posted = await sipho.request.post(REMOVE_NALEDIS_MENTOR_ROLE, {
      multipart: fields,
      headers: { Origin: new URL(baseURL!).origin },
      maxRedirects: 0,
    });
    expect(posted.status(), "the Server Action ends with a redirect").toBeGreaterThanOrEqual(300);
    expect(posted.status()).toBeLessThan(400);
    await sipho.goto("/admin/staff");
    await expect(staffNotice(sipho)).toHaveText(
      "Nothing changed. They mentor your own shop, so another admin must remove their mentor role.",
    );
    await expect(naledisRow).toContainText("Mentors your shop.");

    // Pieter, whose shop it isn't: Naledi keeps the role and still mentors Tech corner.
    await pieter.goto("/admin/staff");
    await expect(main(pieter).getByRole("table", { name: /^Staff accounts/ })).toBeVisible(POST_LANDS);
    await expect(main(pieter).getByRole("link", { name: "Remove mentor role for Naledi" })).toBeVisible();
    await pieter.goto("/admin/sellers/tech-corner");
    await expect(main(pieter).getByRole("combobox", { name: "Mentor for Tech corner" })).toHaveValue("acc-mentor");
  } finally {
    await plain?.close().catch(() => {});
    await siphoContext?.close().catch(() => {});
    await removeSiphosAdminRole(pieter).finally(() => pieter.context().close());
  }
});
```

(Every helper it uses is already imported in that file: `BrowserContext`, `seriousIssues`, `main`, `button`, `POST_LANDS`, `signedInPage`, `staffNotice`, `copySession`, `giveRole`, `removeSiphosAdminRole`.)

Run: `pnpm lint tests/e2e/housekeeping-writes.spec.ts`
Expected: no output.

Run: `grep -rn "newContext(" tests/e2e | grep -v serviceWorkers`
Expected: no output (CLAUDE.md).

- [x] **Step 3: Build, e2e and the size check, in a scratch copy**

Make `S="<your scratchpad>/vossie-m-task4"` at HEAD (Tasks 1 to 3 committed) with this task's file copied in, and the port changed to 3204. From `$S`:

```bash
pnpm typecheck
pnpm lint
pnpm build 2>&1 | tee "$S/build.log" | tail -60
grep -n "new Date()\|Math.random\|uncached data\|Route .* used" "$S/build.log"
grep -l "serviceWorker.register" .next/static/chunks/*.js
```

Expected: types and lint clean; the build succeeds with the same route list as stage L's (`ƒ /sitemap.xml` still dynamic, nothing else changes kind); both `grep`s print nothing.

Then start your own server as the conventions say (a fresh one: plan decision 16), and run the write projects first:

```bash
E2E_REUSE_SERVER=1 pnpm e2e tests/e2e/housekeeping-writes.spec.ts --project=housekeeping-writes --no-deps --workers=2
E2E_REUSE_SERVER=1 pnpm e2e --project=staff-accounts-writes --no-deps --workers=2
```

Expected: 4 passed (stage L's three and this one, in order); `staff-accounts-writes` passes as at stage L. Then the read-only device files on the same server:

```bash
E2E_REUSE_SERVER=1 pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 --workers=2
E2E_REUSE_SERVER=1 pnpm e2e tests/e2e/staff-accounts-checks.spec.ts tests/e2e/staff.spec.ts tests/e2e/info.spec.ts tests/e2e/home.spec.ts tests/e2e/community-actions.spec.ts --project=phone-390 --project=desktop-1440 --workers=2
```

Expected: every `scriptBrotli` equal to the ledger's Start row, to the byte (report the figures for the Task 4 row); the device runs pass. Any byte that moved stops the build: report it before going on. If a read-only test fails on a page a write changed, stop your server, start a fresh one and rerun that file before calling it a failure (stage L's ledger). If the forged post's status isn't a redirect, report what it was and what the response body says before changing the test (the notice check is the real proof). Stop your server by its two PIDs.

- [x] **Step 4: Hand over**

Files: `tests/e2e/housekeeping-writes.spec.ts`. Message:

```
test: stage M end to end, in housekeeping-writes (its tests now run in order, since two give Sipho the Admin role): Sipho, given the Admin role, sees "Mentors your shop." in Naledi's row and a refusal with no button on her remove-mentor page (axe clean at 1440 and 390); a forged removal lands on Staff accounts with the notice, Naledi keeps the role, and Tech corner keeps her as its mentor; the role is taken away again. JS: every page the same to the byte
```

---

### Task 5: Docs and final checks

The stage's records. **`docs/PROGRESS.md` and `docs/reference/LANDING-DECISIONS.md` carry other sessions' uncommitted lines, so this task doesn't edit them:** it writes their new text as `m-progress.md` and `m-decision.md` in the scratchpad `/private/tmp/claude-501/-Users-LamaNkuna-Projects-Vossie/27a3bf01-5279-40ef-b17d-be68f2ee9fa1/scratchpad/`, and the controller merges them.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-21-follow-ups-design.md`
- Modify: `docs/reference/GO-LIVE.md`
- Modify: `docs/superpowers/plans/2026-10-21-follow-ups.md` (this plan)
- Create (scratchpad, not the project): `m-progress.md`, `m-decision.md`

- [x] **Step 1: Check the docs are yours to edit**

Run: `git --no-optional-locks status --short CLAUDE.md docs/reference/GO-LIVE.md docs/superpowers/specs/2026-10-21-follow-ups-design.md docs/superpowers/plans/2026-10-21-follow-ups.md`
Expected: no output (this plan may show as modified by the build's own ledger notes). If any shows as modified by someone else, stop and report.

- [x] **Step 2: Screenshots: none**

Nothing new is drawn but lines of text in existing styles (`staff-muted`, `staff-confirm-lead`). No screenshots spec is added; say so in the progress snippet.

- [x] **Step 3: CLAUDE.md**

In the line that starts `- Looking For requests close themselves`, after `` `settleRequests(now)` stores the close and tells the asker, `` insert `` and, from 2 days before the closing day, sends one reminder (`reminderDue`, marked by `remindedFor` with the closing day, so a moved closing day allows a new one; it still returns only the count closed, so a reminder expires no tag), `` (keep the rest of the line as it is).

In the line that starts `- No admin makes a Hub decision about their own shop`, after `leaves the \`own-shop\` or \`own-request\` notice.`, insert `` Removing the mentor role of whoever mentors the acting admin's own shop is refused in `removeRole` itself (`"own-shop-mentor"`, read with `ownShopMentorId`), before any write; `removeStaffRole` leaves the `own-shop-mentor` notice on `/admin/staff` (stage M). ``

In the line that starts `- Stage L's end-to-end tests`, change `go in \`tests/e2e/housekeeping-writes.spec.ts\`, which runs last,` to `` and stage M's (your own shop's mentor) go in `tests/e2e/housekeeping-writes.spec.ts`, whose tests run in order (`mode: "default"`: two give Sipho the Admin role) and which runs last, ``.

- [x] **Step 4: The spec's "Changes on plan review and build"**

At the end of `docs/superpowers/specs/2026-10-21-follow-ups-design.md`, add `## 11. Changes on plan review and build`, a numbered list, one sentence or two each, naming the plan decision:
1. `StaffRoleConfirm`'s `mentorsOwnShop` and `onlyAdmin` and `roleConfirmTitle`'s flag are optional, defaulting to false; `AdminStaff`'s `ownShopMentorId` is required, so `components/forms/summary-ids.test.tsx` passes it (plan decision 2).
2. The refusal is inline in `removeStaffRole`, and the confirm page's form state is neither written nor cleared (plan decision 3). The "confirm page shows no notices" rule is stage L plan decision 5 (decision 5 here cites stage L amendment 4, which is about settling after the gate).
3. Only the remove-mentor page's heading becomes "{Name}'s mentor role"; the tab title stays "Remove a role" (plan decision 5).
4. The trust page's existing test, which pins item 4's whole text, takes the new text; `AdminFeatured`'s copy of the old sentence is unchanged (plan decision 7).
5. The latest-day Featured test seeds the recorded rows (plan decision 8).
6. The seeds' `remindedFor` is tested in `data/fixtures/request-rows.test.ts`, and no test pins `STORE_VERSION` (plan decision 10); the info pages write "2 days" as a literal, as stage L's sentences do (plan decision 11).
7. `playwright.config.ts` is unchanged, but `housekeeping-writes.spec.ts` runs its tests in order (`mode: "default"`), because `fullyParallel` is on and two of its tests give Sipho the Admin role (plan decision 13).
8. One build and size check after all three items instead of two (plan decision 15).
9. Section 10's questions stay open for Lama: the build used the spec's choices.
10. Anything in this plan's "Changes made during the build" that changes what the spec says.

- [x] **Step 5: The go-live checklist**

In `docs/reference/GO-LIVE.md`:
- line 5: change `and after housekeeping (an admin's own shop, requests that close themselves, the sitemap; stage L). Update the status column` to `and after housekeeping (an admin's own shop, requests that close themselves, the sitemap; stage L), and after the follow-ups (your own shop's mentor, Featured's resting order, the request reminder; stage M). Update the status column`;
- **Section 6, Backend**, in the scheduled jobs line, change `closing old Looking For requests and telling their askers (stage L closes them when something looks, by \`closingDay\`; the job runs the same rule nightly at 00:05 SAST),` to `reminding askers 2 days before a request closes itself, then closing it and telling them (stages L and M settle both when something looks; the job runs the same rules nightly at 00:05 SAST, reminding where \`reminder_day <= today < closing_day\` and \`reminded_for\` isn't the closing day, so a missed night catches up),`;
- **Section 6, Backend**, in the line that starts `- [ ] Supabase: \`requests.closed_by\``, after `(\`asker\`, \`auto\`),` insert `` `requests.reminded_for` (date), set in the job's transaction (stage M), ``;
- **Section 6, Backend**, in the line that starts `- [ ] **Re-check the actor's role inside the transaction**`, after `for approve, decline, verify, pause, resume, mentor, the four report actions, pin, unpin and both Show agains)` insert `, and that removing a mentor role doesn't take the acting admin's own shop's mentor (stage M, for the role-removal function)`;
- **Section 7**: tick `- [ ] **Featured with few Verified sellers.**` (`- [x]`) and append ` Decided in stage M: the break stays a preference; resting sellers come back least recently featured first, the campus's own still first. The draw function on the real backend takes the same map of last days from \`featured_draws\`. Decided by Claude under decision 54; Lama may revisit.`;
- **Section 8**: after the stage L bullet under item 6, add `   - **Done in sample mode (<day>): follow-ups (stage M).** An admin can't remove the mentor role from whoever mentors their own shop; Featured brings back the sellers featured longest ago first; an asker is reminded once, 2 days before a request closes itself.`; and in item 7's paragraph, after `…and a sitemap of what's current.`, add ` Stage M adds three follow-ups: your own shop's mentor, Featured's resting order and the request reminder.`

- [x] **Step 6: This plan's ledger and changes**

In this plan, fill in the JS ledger's Task 4 row from Task 4's report, the unit counts, and the end-to-end counts (Task 4's runs and the controller's final run); under "Changes made during the build", list each task with its commit (`git --no-optional-locks log --oneline`, one command) and every place the build differed from the tasks.

- [x] **Step 7: The snippets for the controller**

Write, in the scratchpad named above:
- `m-progress.md`: a section for `docs/PROGRESS.md` in the shape of stage L's (`## 2026-10-<day>: Follow-ups built, in sample mode (stage M)`): what was built (the mentor-role refusal and its lines, Featured's resting order, the reminder); the spec points the plan corrected (Task 5 Step 4's list); the JS figures; the unit and e2e counts; no screenshots (Step 2); and the open points for Lama: spec section 10's five questions (refuse rather than note; the campus before the longest wait; the 2 days and the link to Your requests; "Closes automatically on" naming the first closed day; the sample words), and `AdminFeatured`'s staff copy of the break sentence, which doesn't yet say who comes back first (plan decision 7);
- `m-decision.md`: one row for `docs/reference/LANDING-DECISIONS.md`, **row 81**, in the shape of row 80: the date, "Follow-ups (stage M): …", what was decided (the refusal in `removeRole` and where it lands, the views' lines; resting sellers by campus group, then longest wait, the rotation on ties; one in-app reminder 2 days before the closing day, marked per closing day, with the `request-update` kind and Your requests' link, counted apart from closes), the plan decisions that changed the spec (2, 3, 5, 7, 10, 11, 13 and 15), and "decided by Claude under decision 54; Lama may revisit".

- [ ] **Step 8: Final checks (the controller)**

In a fresh scratch copy of HEAD with this task's files copied in, run e2e as the conventions say, after:

```bash
pnpm lint
pnpm typecheck
pnpm test --maxWorkers=2
pnpm build
grep -l "serviceWorker.register" .next/static/chunks/*.js
```

and then, on a fresh server, the write projects first (`E2E_REUSE_SERVER=1 pnpm e2e --project=selling-writes --project=staff-writes --project=community-writes --project=alerts-writes --project=staff-accounts-writes --project=hardening-writes --project=housekeeping-writes --no-deps --workers=2`), then a fresh server again for the device projects (`E2E_REUSE_SERVER=1 pnpm e2e --project=phone-360 --project=phone-390 --project=tablet-768 --project=laptop-1024 --project=desktop-1440 --workers=2`; use the five device project names `playwright.config.ts` lists).

Expected: clean lint and types; every unit test passing (record the count); the build listing the same routes with no error and no clock warning; the `grep` printing nothing (CLAUDE.md); the write projects passing; the device projects passing apart from any test already reported to Lama (stage K's four that predate stage L, with the header session); `performance.spec.ts`'s figures equal to the ledger's to the byte. Fill in the ledger's Final row.

- [ ] **Step 9: Hand over**

Files: `CLAUDE.md`, `docs/superpowers/specs/2026-10-21-follow-ups-design.md`, `docs/reference/GO-LIVE.md`, `docs/superpowers/plans/2026-10-21-follow-ups.md`. Snippets: `<scratchpad>/m-progress.md`, `<scratchpad>/m-decision.md`. Message:

```
docs: stage M's records: CLAUDE.md (the reminder in settleRequests, the own-shop mentor refusal in removeRole, housekeeping-writes running in order), the spec's changes on plan review and build, the go-live checklist (the nightly job reminds, requests.reminded_for, the role-removal function's own-shop check, Featured's resting order decided) and the plan's ledger and build changes. Unit: <count>. E2E: <counts>. JS: no page moved
```

---

## Self-review (while drafting the tasks)

- **Spec coverage.** Every spec decision maps to a task in "Where each spec decision is built". Spec 3's unit list: `ownShopMentorId` for an owner with a mentor, with none, and an account with no shop; the refusal with the store unchanged (`structuredClone`, as stage J's `giveRole` test and stage L's refusal tests do); another admin; the admin role for someone with both (Task 1 Step 2). Its action list: the notice, `done("/admin/staff")`, no entry, no notification, the form state kept, another admin (Task 1 Step 3). Its notice and component lists: Task 1 Steps 3 and 4. Its e2e: Task 4. Spec 4's: `lib/featured.test.ts` (the order, ties on two days, the campus first, a pin, the maps), `lib/data/featured.test.ts` (the latest day, the nine-seller walk, pins), the trust test (Task 2). Spec 5's: `rules.test.ts` (the reminder day across a year, the window, `remindedFor`, the skips), `requests.test.ts` (both reasons' words and link, `remindedFor`, the count 0, once, the SAST edge at 21:59:59Z and 22:00:00Z, an edit that moves or keeps the day, a reopen, the close only, the skips, `Promise.all`, delete), `actions.test.ts` (no `requestsChanged()` for a reminder), the seeds (Task 3).
- **Names against HEAD.** `removeRole`, `RemovedRole`, `giveRole`, `countAdmins`, `getStaffAccount`, `listStaffAccounts`, `adminRows`, `removeStaffRole`, `leaveNotice`, `done`, `requireStaff`, `ADMIN_STAFF_PATH`, `removeRolePath`, `removeRoleForm`, `STAFF_NOTICE`, `writeFormState`, `readFormState`, `staffNoticeText`, `AdminStaff`, `RowActions`, `RemoveLink`, `StaffRoleConfirm`, `roleConfirmTitle`, `removalLines`, `ConfirmAction`, `StaffFrame`, `staffErrors`, `drawFeatured`, `FeaturedOptions`, `rotate`, `ALL_CAMPUSES`, `featuredFor`, `featuredChoices`, `addPin`, `REST_DAYS`, `addDays` (both), `drawKey`, `closingDay`, `closeReasonOf`, `closedAtFor`, `requestOpenOn`, `CloseReason`, `NEEDED_BY_GRACE_DAYS`, `IDLE_CLOSE_DAYS`, `AUTO_CLOSE_WHY`, `requestAutoClosedText`, `dayMonth` (`lib/format.ts`), `sastDate`, `settleRequests`, `createRequest`, `updateRequest`, `setRequestOpen`, `deleteRequest`, `hideRequest`, `exportRequests`, `notify`, `getNotifications`, `YOUR_REQUESTS_PATH`, `STORE_VERSION`, `sampleRequestRows`, `closeMyRequest`, `STAFF_NOW`, `signedInAs`, `form`, `redirectOf`, `redirectSignalOf`, and the e2e helpers (`signedInPage`, `staffNotice`, `copySession`, `giveRole`, `main`, `button`, `POST_LANDS`, `seriousIssues`, `removeSiphosAdminRole`) were read from the code at `1782962`.
- **Determinism.** The day numbers the Featured tests rely on were worked out: 12 October 2026 is day 20,738 (even; 20,738 % 3 = 2), the 13th is 20,739 (odd), the 14th is 20,740 (20,740 % 9 = 4, % 4 = 0). The reminder tests' times are fixed instants; none reads the real clock.
- **Shared files left alone.** `app/globals.css`, `app/layout.tsx`, `components/header/*`, `components/tabbar/*`, `components/messages/NotificationsView.tsx`, `tests/e2e/{listing,responsive,a11y}.spec.ts`, `playwright.config.ts`, `lib/supabase/*`, `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md` and the other sessions' untracked docs are never edited.
- **Type consistency.** `"own-shop-mentor"` (the result, the notice code), `ownShopMentorId` (the function and `AdminStaff`'s prop), `mentorsOwnShop` and `onlyAdmin` (`StaffRoleConfirm`'s props, the page's locals, `roleConfirmTitle`'s flag), `FeaturedOptions.resting: ReadonlyMap<string, string>`, `REMINDER_DAYS_BEFORE`, `reminderDay`, `reminderDue`, `requestCloseReminderText`, `RequestRow.remindedFor` and `settleRequests`' unchanged `Promise<number>` are used with the same names in every task.
- **Risk noted for the reviewer.** A reminder is a new `request-update` notification wherever a test's request has a closing day two days or less after the test's clock. The plan's search found two existing tests where this happens, neither counting notifications: `lib/looking-for/actions.test.ts` (needed by the 12th, at `STAFF_NOW`) and `lib/data/requests.test.ts`'s "closes at the very start of the closing day…" (its 21:59:59Z settle on the 12th falls in the window). No e2e test can: a needed-by date can't be in the past, so a request posted in e2e closes at today+4 at the earliest. Task 3 Step 9 runs every file that settles and asks the implementer to report, not quietly change, any other.
