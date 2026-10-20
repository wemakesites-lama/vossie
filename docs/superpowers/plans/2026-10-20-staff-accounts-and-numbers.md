# Vossie Staff Accounts, Numbers and Show Again (Sample Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build stage J as the spec `docs/superpowers/specs/2026-10-20-staff-accounts-and-numbers-design.md` describes: an admin gives the mentor or admin role by exact Eduvos email and takes one away through a confirm page (never their own admin role, never the last admin); an admin sees weekly counts per campus and in total, with a small-number rule that keeps private counts from pointing at a student; and an admin can show a hidden listing or Looking For request again. First, a spike checks whether staff pages can answer a real 404 (and a real 307 to sign-in) by blocking before the first byte; if it holds, every staff page does. Every form works without the app's JavaScript, staff pages load no new client code, and no public page moves by a byte.

**Architecture:**
- **No new table.** Roles stay on `AccountRow.roles`. One optional field joins G's `SellerProfileRow`: `approvedAt`, set the first time the Hub approves a shop. `STORE_VERSION` goes from 8 to 9.
- **Three new data modules' worth of reads and writes, all in `lib/data`:** `lib/data/staff-accounts.ts` (list, give, remove, count admins), `lib/data/numbers.ts` (`countByWeek`, raw counts by measure, week and campus, with a `gone` key for things whose campus has gone), and Show again beside the hides: `showListing` in `lib/data/staff-shops.ts`, `showRequest` in `lib/data/requests.ts`, `listHidden`, `getHidden` and `countHidden` in `lib/data/staff-reports.ts`.
- **Pure rules in `lib/staff`:** `lib/staff/numbers.ts` holds the SAST Monday-to-Sunday weeks (`sastWeeks`), the small-number rule (`protectCounts`) and the words for each figure; `lib/staff/roles.ts` gains the role choices and their words.
- **G's action pattern** (`lib/staff/admin-actions.ts`, and a new `lib/staff/account-actions.ts`): `requireStaff("admin", …)` first, check, write, one `recordAudit()` only when something changed, the notification, the tag (only Show again has one), a notice, then F's `done()`. Give role carries G's one-time token (`lib/staff/once.ts`).
- **Blocking staff pages** (Task 1's spike, then Task 2): `export const instant = false`, and `await requireStaff(…)` at the top of the page component, so Next sends a real 404 or 307 before the first byte. If the spike fails, the stage keeps G's `<Suspense>` pattern (conventions, "If Task 1 failed").
- **No new CSS in `app/globals.css`.** Another session has uncommitted edits in it, so this stage reuses G's staff classes and adds a few Tailwind utilities on its new elements (plan decision 3).

**Tech Stack:** As stage I leaves it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5.9;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5 with Testing Library and jsdom 30;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-20-staff-accounts-and-numbers-design.md` (committed `85e3b28`). "Spec 2.5" in this plan means its section 2, decision 5; "spec 6" means its section 6.
- **The stages this builds on:**
  - stage G, `docs/superpowers/plans/2026-10-14-staff-tools.md` ("G's plan", "G decision 18", "G amendment 15.7"), whose spec's section 8 wins;
  - stage H, `docs/superpowers/plans/2026-10-14-community-actions.md` ("H decision 20");
  - stage I, `docs/superpowers/plans/2026-10-14-search-alerts.md` ("I's plan"), the latest, whose "Changes made during the build" set the scratch-copy procedure this plan writes down once.
  **Where a plan and the code differ, the code at HEAD wins.** Every name, import and signature below was read from the code at `85e3b28` on 2026-10-20.
- **Next 16.4's own words:** `node_modules/next/dist/docs/01-app/02-guides/streaming.md` ("The HTTP contract") and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md` ("Disabling instant", "Disabling static shell validation").
- **The go-live checklist:** `docs/reference/GO-LIVE.md`, sections 5 to 7.
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`, decision 54 (Claude decides under Lama's standing goal) and the stage I row.

---

## Before you start

**This plan starts at `85e3b28`** (stage J's spec). Stages D to I are built and committed. Other sessions share the working tree: the header and tab-bar session has uncommitted edits to `app/globals.css`, `app/layout.tsx`, `components/header/*`, `components/icons.tsx`, `components/ui/NavLink*`, several e2e specs (`a11y`, `accounts`, `helpers/messaging`, `messaging`, `screenshots`, `shell`, `shopping`), `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md` and the homepage spec, and untracked `components/tabbar/`; the Supabase session has untracked plan and spec files. **None of those files is edited by this plan.** Where this stage needs a change in one of them, it says how it does without (plan decisions 3, 21 and 27).

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. Never stage `.claude/launch.json` or any file this plan doesn't list.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed. This is Lama's standing preference.
3. **Files this plan removes or moves:** none. No task runs `rm` on a project file. `StaffSkeleton` becomes unused if Task 1 holds; it stays for Lama to delete or keep (spec 2.15).
4. **No new cookie or browser-storage name** (spec 6). The privacy test's list of `vossie_…` names doesn't change.
5. **A Playwright project that runs last of all** (Task 13): `staff-accounts-writes`, after `alerts-writes`.
6. **Sample wording.** The confirm pages' lines, the numbers' key, the Overview line and the privacy sentences are samples for Lama to change. Plan decision 28 lists where they live.

No installs are needed.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time, and only read-only ones (`git status`, `git diff`, `git log`, `git show`, `git archive`). Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` a project file.
- Never kill an install or build that is still running. A `pnpm start` you started yourself is yours to stop when you're done with it.
- Port 3100 is Lama's dev server and 3200 is the shared e2e port: don't touch either. This stage builds, starts and runs e2e only in a scratch copy on **3204** (conventions, "The scratch copy").
- Before you edit a shared file (`lib/types.ts`, `lib/data/rows.ts`, `lib/data/store.ts`, `data/fixtures/accounts.ts`, `lib/data/staff-shops.ts`, `lib/data/staff-reports.ts`, `lib/data/requests.ts`, `lib/data/shops.ts`, `lib/staff/*`, `components/staff/*`, `components/messages/NotificationsView.tsx`, `components/account/PrivacySettingsView.tsx`, `app/privacy/page.tsx`, `components/forms/summary-ids.test.tsx`, `playwright.config.ts`, `tests/e2e/staff.spec.ts`, `CLAUDE.md`, `docs/*`), read its current text and edit by the exact lines that are there now. Never paste back a whole list or file from an older copy, except where a step gives a whole new file for a page this plan rewrites.

## Recheck before starting

Before Task 1, check each item, one command or file at a time, and write what you find in the ledger's "Start" row or a message to the controller. If something differs in a way a task's quoted code depends on, stop and report rather than guess.

1. **Git.** `git --no-optional-locks log --oneline -3` shows `85e3b28` at the top (or a later commit from another session that touches none of this plan's files: check with `git --no-optional-locks show --stat <hash>`). `git --no-optional-locks status --short` shows the other sessions' files listed in "Before you start" and nothing else.
2. **Dirty files this plan must not touch.** `git --no-optional-locks status --short app/globals.css app/layout.tsx tests/e2e` still lists `app/globals.css`, `app/layout.tsx` and the e2e files named above as modified. `tests/e2e/staff.spec.ts`, `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`, `tests/e2e/cls.spec.ts` and `playwright.config.ts` are **not** listed (this plan edits the first and last; if either is now dirty, stop and report).
3. **The store.** `lib/data/store.ts` has `export const STORE_VERSION = 8;` and `SampleStore` ends with `savedSearches`. `lib/data/rows.ts`'s `SellerProfileRow` ends with `mentorId?: string | null;`.
4. **Types.** `lib/types.ts`: `AuditAction` ends `| "check-in-added";`, `AuditKind` is the seven kinds ending `"mentoring"`, `AuditTargetKind` ends `| "request";`, `NotificationKind` ends `| "search-match";`, `StaffRole` is `"mentor" | "admin"`.
5. **G's staff code.** `lib/staff/access.ts` exports `requireStaff(area, nextPath)` and `staffMetadata(area, title)`. `lib/staff/paths.ts`'s `STAFF_SECTIONS` has eight entries, Overview to Mentoring. `lib/staff/admin-actions.ts` has the private `idFrom`, `staffOf`, `nothingChanged(path, now)`, `tellReporter`, and exports the 16 actions that `admin-actions.test.ts`'s `GATE_CASES` lists. `lib/staff/once.ts` exports `issueOnceToken`, `sentOnceToken`, `takeOnceToken`, `leaveOnceToken` and `OnceSent`. `lib/staff/form-state.ts` exports `STAFF_NOTICE`, `clearStaffForm`, `leaveNotice` and `takeNotice`.
6. **G's data.** `lib/data/staff-shops.ts`'s `approveShop(slug, ownerId)` takes no `now`, and `hideListing(id, reason, now)` returns `{ id, title, sellerSlug, state, ownerId }`. `lib/data/requests.ts`'s `hideRequest(id, reason, now)` sets `hiddenAt`, `hiddenReason` and `updatedAt`. `lib/data/staff-reports.ts`'s `ReportView.unseen` is `"hidden" | "paused" | null`.
7. **Components.** `components/staff/ConfirmAction.tsx` always draws a required Reason field. `components/staff/StaffTable.tsx` renders every cell as `<td role="cell">`. `components/messages/NotificationsView.tsx`'s `KindIcon` has a case for each of the ten kinds and already imports `ShieldIcon`. `components/account/PrivacySettingsView.tsx` takes `consent`, `deleteErrors` and `reports`, and its delete list has seven items.
8. **The JS figures** (I's final ledger, 2026-10-20): `/` 150,591 B, `/browse` 151,338 B, listing 151,747 B, storefront 151,351 B, Saved 151,226 B, privacy 150,591 B, new and edit listing forms 152,265 B signed in (40 B under the stop line, 152,305 B, decision 52). Task 1 measures them again from HEAD.
9. **Class names this plan reuses** exist at HEAD: `git --no-optional-locks show HEAD:app/globals.css | grep -c "\.staff-radio\b\|\.staff-radio-hint\|\.staff-unseen\|\.staff-row-action-danger\|\.staff-inline-form\|\.staff-confirm-lead"` prints at least 6.

## Where things stand (checked against the code on 2026-10-20)

| Area | Fact |
|---|---|
| Repo | `main` at `85e3b28`, stages D to I built. Other sessions' uncommitted work in the tree (see "Before you start"), which this plan never stages |
| JS | First visit at 390px, brotli quality 5: the listing forms (signed in) are the highest pages at 152,265 B, 40 B under the stop line (152,305 B) and 1,335 B under the limit (153,600 B). Staff pages are at the shell's 150,591 B |
| Staff gate | `requireStaff` runs inside `<Suspense>` on every staff page, after the static shell (`StaffSkeleton`) has gone out with status 200; `notFound()` there only adds `noindex`, and `redirect()` there is a client-side redirect (G 8.1, Next's "HTTP contract") |
| Roles | `AccountRow.roles` (`StaffRole[]`); `getViewer()` (`lib/auth/session.ts`, React `cache`, per request) reads them from the store; `canUse` and `staffAreasOf` (`lib/staff/roles.ts`); `listMentors()` reads accounts with the mentor role. The sample staff are Naledi (`acc-mentor`, mentor, mentors Tech corner) and Pieter (`acc-admin`, the only admin) |
| Hiding | `hideListing` and `hideRequest` set `hiddenAt` and `hiddenReason`; nothing clears them. Hidden listings leave every list and their photos are private (`isHiddenFrom` in `lib/data/photos.ts`); hidden requests leave the board |
| Counting | `listedListings()`, `liveSellerRows()` (`lib/data/catalog.ts`); conversations carry `requestId` for offers and `sellerGone` once a shop is deleted; reports carry `targetGone` |
| Time | `sastDate`, `shortSastDate` (`lib/time.ts`), `addDays` (`lib/staff/rules.ts`), `dayMonth` (`lib/format.ts`, "12 Oct"). Unit tests run with `TZ=UTC` (`vitest.global-setup.ts`) |
| e2e | One `next start` per run; five device projects, then `selling-writes`, `staff-writes`, `community-writes`, `alerts-writes`. Every test shares one sample store. Since stage I, builds and e2e run in a scratch copy on 3204 |
| Next 16.4 | `export const instant = false` on a page opts it out of static-shell validation, so it may read the session outside `<Suspense>` and block; a `notFound()` or `redirect()` thrown before anything streams gives a real status. The spike proves it for this app before anything relies on it |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. In this plan, "plan decision N" means this list; "spec 2.N" means the spec's decisions; "G decision N", "H decision N", "I decision N" mean those plans' lists; "decision N" on its own means a row in the decisions log.

1. **The spike decides, and a constant carries the answer** (spec 2.15). Task 1 changes `/admin` alone. It passes when `pnpm build` passes in the scratch copy with no error about `/admin`, and `curl` gives 307 to `/login?next=%2Fadmin` signed out, 404 for a student and a mentor, and 200 for the admin; `/admin/sellers` still gives 200 to a student (the control). Pass: Task 2 converts every other staff page, Tasks 9 to 11 write the new pages blocking, `STAFF_404_IS_REAL` in `tests/e2e/helpers/staff-accounts.ts` (Task 13) is `true`, and Task 14 ticks the go-live item and changes CLAUDE.md. Fail: `/admin` goes back to HEAD's text, Task 2 is skipped, Tasks 9 to 11 use the "If Task 1 failed" shape, the constant is `false`, and the go-live item stays.
2. **Blocking pages render whole.** A converted page has no `<Suspense>` of its own: `export const instant = false`, `await params` (dynamic routes), `await requireStaff(…)`, then everything the inner component did, in the page component itself. Nothing streams after the gate, so there's no skeleton to swap and nothing to shift. `StaffSkeleton` and its test stay (approval 3).
3. **No edit to `app/globals.css`** (another session's uncommitted hunks are in it, and the controller can't stage part of a file). The new screens reuse G's classes (`staff-section`, `staff-table`, `staff-row-actions`, `staff-row-action-danger`, `staff-radio`, `staff-radio-hint`, `staff-inline-form`, `staff-confirm`, `staff-muted`, `staff-unseen`, `form-*`, `btn`). The two things G's CSS doesn't cover use Tailwind utilities, which Tailwind adds to the built stylesheet from the class names: the numbers tables' row headers (`block py-1 text-left text-body font-semibold text-ink wide:table-cell wide:py-3`) and the By campus links (`inline-flex min-h-11 items-center font-semibold text-sky-dark underline underline-offset-3`). Utilities sit in a later cascade layer than G's components, so they win over `.staff-table th` without `!important`. CSS isn't in the JS budget.
4. **`approvedAt`** (spec section 4). `approveShop(slug, ownerId, now)` gains `now` and sets `approvedAt` only when it's unset, so a shop approved, paused and resumed keeps its first approval. Sipho's seller profile in `data/fixtures/accounts.ts` is seeded with Tech corner's `createdAt`, `"2026-03-01T08:00:00.000Z"`. Lerato's shop is owned but waiting, so it has none (the spec's "fixture shops with an owner" would have given a waiting shop an approval). The shop's part of the data export gains `approvedAt` (spec 6 asks whether anything new belongs there; this is about the student's own shop).
5. **Staff accounts' data** (spec section 4). Beyond the spec's four functions, `getStaffAccount(id)` reads one person with a role for the confirm pages. `StaffAccount` carries the names of the shops the person mentors (the confirm page names them; the table shows their number). `giveRole` returns `{ id, firstName }` rather than a whole account, since that's all the action uses. Roles are written in a fixed order, mentor then admin.
6. **Role words in `lib/staff/roles.ts`:** `ROLE_CHOICES` (the form's two radios with their hints), `parseStaffRole` (a fixed list, so a forged value is null), `roleLabel` and `rolesText` ("Mentor", "Admin", "Mentor, Admin").
7. **Give role's order** (spec 2.3, G amendment 15.7). A repeat of a sent form goes where the first went (`sentOnceToken`). The fields are checked before the token is taken, so a mistake keeps the token for the next try. A missing, made-up or expired token is refused with G's `once-expired` words, as G's create forms are. "That account has that role already" comes from `giveRole` itself, after the token is taken; the page draws a fresh token with the error.
8. **The role actions expire no tag.** Nothing cached reads roles: `getViewer()` and `listMentors()` read the store per request. Show again expires `listings` or `requests`, as the hides do.
9. **Ids.** The Give a staff role form's fields are `give-role-email` and `give-role-role-mentor`/`give-role-role-admin`, its summary `give-role-problems` (spec 7's `<prefix>-problems`). A role confirm page's form is `remove-<role>-<account id>`, a Show again page's `show-listing-<id>` or `show-request-<id>`. Section ids start `admin-staff-`, `admin-numbers-`, `admin-hidden-`.
10. **A mentor who is also an admin** keeps the Hub's tools and the dashboard through the admin role, so their remove-mentor page's first line says "{name} stays an admin, so keeps the Hub's tools and the mentor dashboard." instead of "loses".
11. **The "Shops they mentor" column** shows the number for anyone with the mentor role, 0 included, and "None" for an admin without it who mentors none (spec 2.2).
12. **Open shops now** is approved shops (not paused) with at least one listed listing: `liveSellerRows()` whose slug has a `listedListings()` entry. Featured's test also needs Verified (`eligibleSellers` in `lib/data/featured.ts`), which the spec's "Featured's own test" would have counted by mistake; the test checks the plan's rule.
13. **What counts, and where** (spec 2.10).
    - A listing counts at `firstPublishedAt`, hidden or not (it was published; a hide doesn't unpublish it).
    - A report's campus is its target's as the page renders; a report with `targetGone`, or whose target has been deleted, is on a gone campus.
    - An enquiry to a shop that has gone (`sellerGone`) is on a gone campus, so a new shop on the same link never takes it.
    - Something from this week (after last week's end) isn't counted anywhere yet.
    - The campus list is the fixtures' 13 (`data/fixtures/campuses.ts`), as `lib/data/requests.ts` reads it; any other slug is a gone campus.
    - `countByWeek(now)` returns `{ weeks, raw }`, so the page's headings and the counts use the same weeks.
14. **The small-number rule is built exactly as spec 2.13 writes it.** One residual is left for Lama (it's in the hand-over and the spec's changes): with two or more campuses at "Under 5" in one column, the total less the shown figures gives their sum (two cells summing to 2 are both 1), and a "Hidden" cell of exactly 5 can be worked out the same way. A stronger rule (rounding totals, or more secondary hiding) is a later question.
15. **Week bounds without `sastToUtc`.** `lib/staff/numbers.ts` works the weeks out from `sastDate(now)`, `addDays` and a local `sastMidnight(day)` (`Date.UTC(year, month - 1, day, -2)`, SAST being UTC+2 with no daylight saving). G's `sastToUtc` returns `string | null` for form input, which a known-good date doesn't need.
16. **Show again's data** (spec 2.14). `showRequest(id, now)` sets `updatedAt` as `hideRequest` does (the spec's signature has no `now`). `HiddenItem` carries what the confirm page's extra lines need: the listing's own state, whether its shop is paused by the Hub, and whether the request's asker had closed it. `getHidden(kind, id)` and `countHidden()` sit beside `listHidden()`. The two Show again sentences live in `lib/staff/notification-text.ts` with the role sentences.
17. **Overview's line** (spec 2.14). A new section, "Hidden by the Hub", below Needs attention: "2 listings and 1 request are hidden" as a link to `/admin/hidden`, or "Nothing is hidden." as text. G's three Needs attention items stay as they are.
18. **Show it again on a report's page** shows only on a closed report whose listing or request is hidden (`!report.open && report.unseen === "hidden"`). A hidden target's reports are always closed by the hide, so this is every report that led to one.
19. **Privacy settings' staff lines** (spec 2.8) are paragraphs after the delete list, not list items, so G's "seven items" stays true. `PrivacySettingsView` takes an optional `staff` (`{ onlyAdmin: boolean } | null`); its other users don't change.
20. **The privacy policy** (spec 6). The spec's "Who can see it" is the policy's "Who it is shared with" section (`privacy-sharing`): its Hub staff bullet gains the numbers sentence. The staff-log bullet gains "and who was given or lost a staff role". `updated` becomes the day Task 12 is built.
21. **End to end** (spec 9).
    - One project, `staff-accounts-writes` (desktop 1440), runs `staff-accounts-writes.spec.ts`, `staff-accounts-checks.spec.ts` and `staff-accounts-screenshots.spec.ts`, after `alerts-writes`. Checks at 390px make their own phone-sized contexts.
    - Hide and show use a fresh Tech corner listing named with `uniqueWord()`, not a sample listing, so browse can be searched for it exactly and no other test's count is touched even if the test stops halfway.
    - `/admin/hidden`'s empty state is checked by the unit test only: by the time this project runs, `staff-writes` and `community-writes` have hidden things on the shared server.
    - The unknown-email test runs with the app's JavaScript off, because only a page load focuses the error summary (`autoFocus`; with JavaScript, `role="alert"` announces it instead).
22. **Status checks** go in `tests/e2e/staff.spec.ts` (clean at HEAD): every staff page answers 404 to a student, admin pages 404 to a mentor, and every staff page a 307 to `/login?next=…` signed out. The new pages also join G's "Page not found" title test there. They skip when `STAFF_404_IS_REAL` is false.
23. **The scratch copy** (I's "Changes made during the build"): `git archive HEAD` into a new folder in your scratchpad, a clone-copy of `node_modules`, then the task's own changed files copied over it, and `PORT` set to 3204 in the copy's `playwright.config.ts`. Written once in the conventions and used by every task that builds.
24. **Where tests run.** A task's own unit tests run in the working tree (`pnpm test <files>`). The whole unit suite, `pnpm lint` and `pnpm typecheck` run in the scratch copy, because other sessions' unfinished files in the tree are none of this stage's business.
25. **The numbers page's preview line** shows while `isSampleMode()` (`lib/auth/config.ts`) is true.
26. **The numbers page's sign-in return** is always `/admin/numbers`: the campus is a query, read after the gate.
27. **Checks and screenshots get new spec files,** because `tests/e2e/a11y.spec.ts` and `tests/e2e/screenshots.spec.ts` have another session's uncommitted edits. `cls.spec.ts` and `performance.spec.ts` are clean but are not edited: the staff pages' layout-shift and size checks follow G's `staff-checks.spec.ts`, in this stage's checks file.
28. **Wording the spec doesn't give** (Lama may change it): the confirm pages' "Back to staff accounts" link and own-admin page, plan decision 10's line, the numbers key's lines (except the spec's "Hidden" line), the hidden page's headings, the Overview section, and the "sold / paused / draft" lines on the listing's Show again page. They live in `components/staff/AdminStaff.tsx`, `StaffRoleConfirm.tsx`, `AdminNumbers.tsx`, `AdminHidden.tsx`, `ShowAgainConfirm.tsx` and `AdminOverview.tsx`.

## Amendments on review

The controller adds amendments here; they override the tasks below wherever they differ.

Reviewed 2026-10-20 (opus, read-only); all accepted by the controller.

**1. Tasks 5, 10, 13, 14, plan decision 14 and spec 2.13: the small-number rule is replaced.**

*Problem.* The drafted rule leaks, and so does an "audit" rule (keep hiding until nothing can be worked out). A brute-force check of the audit version found 765 cases where a hidden figure could be pinned exactly. The cause is that the choice of what to hide depends on the hidden values, so the pattern of hidden cells itself gives values away:
- "total Hidden, one Under 5" can only be 4;
- "Under 5 + Hidden, and the next campus hidden too" means exactly 1 and 5.

Rounding totals or cells to fives or tens fails the same way at a band's edges. For example, nine "Under 10" campuses and one "10+" with a "10+" total force every campus to its minimum.

There is also a leak between Since the start and the weeks, in the campus view: Since "Under 10" with last week 8 means the week before is exactly 1. On a new campus this is common.

The fix: the decision to hide must depend only on something the reader can already see.

*Replacement rule.* This replaces spec 2.13's rules 1 to 4 and plan decision 14.
1. **A private week column with any small number shows no campus breakdown.** If any campus, or the count on a campus that has gone, is from 1 to 4 that week, every campus in that column shows "Hidden", zeros included. Otherwise every campus shows exactly. The total always shows: exact, "Under 5" from 1 to 4, and 0 as 0.
2. **Change** is "—" unless both figures are exact. This is unchanged.
3. **Since the start** shows in tens.
   - Campus figures show only when both week columns are shown by campus and no campus (or gone) is from 1 to 9 since the start. Otherwise every campus shows "Hidden".
   - The total shows in tens, unless either week's total is "Under 5"; then it shows "Hidden".
4. **Public measures and open shops** stay exact.

*Paragraph for Lama.* "The page shows every all-campus total, so Vossie-wide figures are always there. A campus breakdown of something private shows only when no campus had between 1 and 4 that week; if one did, the whole column is hidden, zeros too. Hiding only the small cell isn't enough: the total less the cells you can see gives it back, and choosing which extra cells to hide gives clues of its own. Since-the-start figures are in tens, and shown by campus only under the same condition, so two weeks' pages can't be subtracted. No figure from 1 to 4 can be worked out from the page, from two weeks' pages, or from the rule itself."

*Cost.* While campuses are small, private columns in By campus and the campus view will often say Hidden. Totals are unaffected. An "Other campuses" row that groups small campuses is a possible later improvement.

*Task 5, Step 2.* In `lib/staff/numbers.ts`, keep `countAt` and `totalOf`, and replace everything from `const exact = …` through the end of `protectCounts` with:

```ts
const isSmall = (count: number, below: number) => count >= 1 && count < below;
const isFigure = (text: string) => /^\d+$/.test(text);
const everyCampus = (slugs: readonly string[], text: (slug: string) => string) =>
  Object.fromEntries(slugs.map((slug) => [slug, text(slug)]));

/** Whether any campus in a column, or what's counted on a campus that has gone, is from 1 to `below - 1`. */
function hasSmall(column: RawColumn, slugs: readonly string[], below: number): boolean {
  return isSmall(column.gone, below) || slugs.some((slug) => isSmall(countAt(column, slug), below));
}

/** Exact, for public measures and open shops: each listing, shop and request is already visible with its campus. */
function exactColumn(column: RawColumn, slugs: readonly string[]): ShownColumn {
  return { campuses: everyCampus(slugs, (slug) => String(countAt(column, slug))), total: String(totalOf(column, slugs)) };
}

/**
 * A private week (spec decision 13, rule 1, amended on review): when any campus, or a campus that has gone, has 1 to 4,
 * every campus is "Hidden", zeros too, so neither the total nor the gaps can give a small number away. The decision
 * rests only on whether a small number exists, so the pattern of hidden cells reveals no figure. The total is exact,
 * or "Under 5" from 1 to 4.
 */
function weekColumn(column: RawColumn, slugs: readonly string[], isPrivate: boolean): ShownColumn {
  if (!isPrivate) return exactColumn(column, slugs);
  const total = totalOf(column, slugs);
  const small = hasSmall(column, slugs, SMALL_COUNT);
  return {
    campuses: everyCampus(slugs, (slug) => (small ? HIDDEN : String(countAt(column, slug)))),
    total: isSmall(total, SMALL_COUNT) ? UNDER_FIVE : String(total),
  };
}

/** Change (spec decision 13, rule 2): "—" unless both weeks show a figure. */
function changeOf(last: string, before: string): string {
  return isFigure(last) && isFigure(before) ? changeText(Number(last) - Number(before)) : NO_CHANGE;
}

function changeColumn(last: ShownColumn, before: ShownColumn, slugs: readonly string[]): ShownColumn {
  return {
    campuses: everyCampus(slugs, (slug) => changeOf(last.campuses[slug], before.campuses[slug])),
    total: changeOf(last.total, before.total),
  };
}

/**
 * Since the start (spec decision 13, rule 3, amended on review), private in tens. By campus only when both weeks are
 * shown by campus and nothing since the start is from 1 to 9; otherwise a campus's tens, less its weeks, could leave a
 * week's hidden figure one value. The total is "Hidden" when a week's total is "Under 5", for the same reason.
 */
function sinceColumn(
  column: RawColumn,
  slugs: readonly string[],
  isPrivate: boolean,
  last: ShownColumn,
  before: ShownColumn,
): ShownColumn {
  if (!isPrivate) return exactColumn(column, slugs);
  const byCampus =
    slugs.every((slug) => isFigure(last.campuses[slug]) && isFigure(before.campuses[slug])) && !hasSmall(column, slugs, 10);
  return {
    campuses: everyCampus(slugs, (slug) => (byCampus ? sinceText(countAt(column, slug)) : HIDDEN)),
    total: last.total === UNDER_FIVE || before.total === UNDER_FIVE ? HIDDEN : sinceText(totalOf(column, slugs)),
  };
}

/** The small-number rule (spec decision 13, amended on review). `slugs` are the campuses in the page's order. */
export function protectCounts(raw: RawCounts, slugs: readonly string[]): ShownCounts {
  const counts = Object.fromEntries(
    MEASURES.map(({ measure, isPrivate }) => {
      const columns = raw.counts[measure];
      const last = weekColumn(columns.last, slugs, isPrivate);
      const before = weekColumn(columns.before, slugs, isPrivate);
      return [
        measure,
        { last, before, since: sinceColumn(columns.since, slugs, isPrivate, last, before), change: changeColumn(last, before, slugs) },
      ];
    }),
  ) as ShownCounts["counts"];
  return { counts, openShops: exactColumn(raw.openShops, slugs) };
}
```

*Task 5, Step 1.* Replace the `describe("the small-number rule …")` block with the one below, and add the brute-force block after it. The other `describe` blocks and the imports stay.

```ts
describe("the small-number rule (stage J spec decision 13, as amended on review)", () => {
  it("shows a private week by campus, exactly, when no campus is from 1 to 4", () => {
    const shown = protectCounts(raw({ enquiries: { last: column({ a: 0, b: 12, c: 7 }) } }), SLUGS);
    expect(shown.counts.enquiries.last).toEqual({ campuses: { a: "0", b: "12", c: "7" }, total: "19" });
  });

  it("hides every campus in a private week, zeros too, when any campus is from 1 to 4, and keeps the total", () => {
    const shown = protectCounts(raw({ "reports-made": { last: column({ a: 3, b: 20, c: 0 }) } }), SLUGS);
    expect(shown.counts["reports-made"].last).toEqual({ campuses: { a: HIDDEN, b: HIDDEN, c: HIDDEN }, total: "23" });
  });

  it("hides every campus when the small number is on a campus that has gone", () => {
    const shown = protectCounts(raw({ enquiries: { last: column({ a: 7 }, 2) } }), SLUGS);
    expect(shown.counts.enquiries.last).toEqual({ campuses: { a: HIDDEN, b: HIDDEN, c: HIDDEN }, total: "9" });
  });

  it("shows a private total from 1 to 4 as Under 5, and 0 as 0", () => {
    const shown = protectCounts(raw({ "reports-closed": { last: column({ a: 1, b: 1 }) } }), SLUGS);
    expect(shown.counts["reports-closed"].last).toEqual({ campuses: { a: HIDDEN, b: HIDDEN, c: HIDDEN }, total: UNDER_FIVE });
    expect(shown.counts["reports-closed"].before).toEqual({ campuses: { a: "0", b: "0", c: "0" }, total: "0" });
  });

  it("shows Change only where both weeks show a figure, signed", () => {
    const shown = protectCounts(raw({ enquiries: { last: column({ a: 12, c: 9 }), before: column({ a: 3, c: 11 }) } }), SLUGS);
    expect(shown.counts.enquiries.change).toEqual({ campuses: { a: NO_CHANGE, b: NO_CHANGE, c: NO_CHANGE }, total: "+7" });
    const both = protectCounts(raw({ enquiries: { last: column({ a: 12 }), before: column({ a: 5 }) } }), SLUGS);
    expect(both.counts.enquiries.change).toEqual({ campuses: { a: "+7", b: "0", c: "0" }, total: "+7" });
  });

  it("rounds a private Since the start down to tens, by campus only when both weeks are by campus and nothing is under 10", () => {
    const shown = protectCounts(raw({ follows: { since: column({ a: 0, b: 17, c: 23 }) } }), SLUGS);
    expect(shown.counts.follows.since).toEqual({ campuses: { a: "0", b: "10+", c: "20+" }, total: "40+" });
    const small = protectCounts(raw({ follows: { since: column({ a: 0, b: 7, c: 23 }) } }), SLUGS);
    expect(small.counts.follows.since).toEqual({ campuses: { a: HIDDEN, b: HIDDEN, c: HIDDEN }, total: "30+" });
    const weekHidden = protectCounts(raw({ follows: { last: column({ a: 2, b: 8 }), since: column({ a: 12, b: 18, c: 20 }) } }), SLUGS);
    expect(weekHidden.counts.follows.since.campuses).toEqual({ a: HIDDEN, b: HIDDEN, c: HIDDEN });
  });

  it("hides the Since the start total when either week's total is Under 5", () => {
    // 8 last week and "Under 10" since the start would leave the week before only 1.
    const shown = protectCounts(raw({ enquiries: { last: column({ a: 8 }), before: column({ a: 1 }), since: column({ a: 9 }) } }), SLUGS);
    expect(shown.counts.enquiries.before.total).toBe(UNDER_FIVE);
    expect(shown.counts.enquiries.since.total).toBe(HIDDEN);
  });

  it("shows public counts exactly, with their change, and open shops exactly", () => {
    const shown = protectCounts(
      raw({ listings: { last: column({ a: 1, b: 2 }), before: column({ a: 4 }), since: column({ a: 9, b: 2 }, 1) } }, column({ a: 2, c: 1 })),
      SLUGS,
    );
    expect(shown.counts.listings.last).toEqual({ campuses: { a: "1", b: "2", c: "0" }, total: "3" });
    expect(shown.counts.listings.change).toEqual({ campuses: { a: "−3", b: "+2", c: "0" }, total: "−1" });
    expect(shown.counts.listings.since).toEqual({ campuses: { a: "9", b: "2", c: "0" }, total: "12" });
    expect(shown.openShops).toEqual({ campuses: { a: "2", b: "0", c: "1" }, total: "3" });
  });
});

describe("no small figure can be worked out (a brute-force check of the week rule)", () => {
  it("leaves every campus in a hidden week at least two possible values, for three campuses at 0 to 20 and a gone campus at 0 to 2", () => {
    const groups = new Map<string, number[][]>();
    for (let a = 0; a <= 20; a++) for (let b = 0; b <= 20; b++) for (let c = 0; c <= 20; c++) for (const gone of [0, 1, 2]) {
      const shown = protectCounts(raw({ enquiries: { last: column({ a, b, c }, gone) } }), SLUGS).counts.enquiries.last;
      // A reader is assumed to know what's counted on a campus that has gone.
      const key = `${JSON.stringify(shown)}|${gone}`;
      groups.set(key, [...(groups.get(key) ?? []), [a, b, c]]);
    }
    for (const [key, members] of groups) {
      if (!key.includes(HIDDEN)) continue;
      // Leave out the grid's edge, where a value can't be larger only because the loop stops at 20.
      if (members.some((member) => member.some((value) => value > 12))) continue;
      SLUGS.forEach((slug, index) => {
        expect(new Set(members.map((member) => member[index])).size, `${key} at ${slug}`).toBeGreaterThan(1);
      });
    }
  });
});
```

*Task 5, Step 4 commit message.* Replace "the next-smallest campus Hidden when one would give it away" with "a private week's campuses all Hidden when any campus has 1 to 4, totals always shown".

*Task 10, Step 1 (`AdminNumbers.test.tsx`).*
- Replace the two lines `// Midrand's 3 enquiries are Under 5, so Pretoria's 12, the next smallest, is Hidden.` and `expect(midrand.closest("tr")).toHaveTextContent("Under 5");` with:
  ```ts
  // Midrand had 3 enquiries, so last week's enquiries aren't shown by campus at all.
  expect(midrand.closest("tr")).toHaveTextContent("Hidden");
  ```
- In `getAllByText(…)`, the Hidden key text becomes `"Hidden: not shown by campus, because a campus had from 1 to 4 that week (or 1 to 9 since the start), so no one can be picked out."`.
- The campus view's regex `/Under 5.*8.*—.*20\+/` becomes `/Hidden.*8.*—.*Hidden/`.
- The All campuses figures (15, 8, +7, 20+) don't change.

*Task 10, Step 2 (`NumbersKey`).*
- The `UNDER_FIVE` item becomes `` {`${UNDER_FIVE}: a private total from 1 to 4.`} ``.
- The `HIDDEN` item becomes `` {`${HIDDEN}: not shown by campus, because a campus had from 1 to 4 that week (or 1 to 9 since the start), so no one can be picked out.`} ``.
- The tens line stays.

*Task 13.* The numbers test's `getByText("Hidden: not shown, so the total can't reveal a small number.")` takes the same new Hidden text.

*Task 14.*
- **CLAUDE.md.** In the new numbers line, replace "1 to 4 as "Under 5", a second cell "Hidden" where the total would give one away, Since the start in tens" with "a private week's campuses all "Hidden" when any campus (or a gone one) has 1 to 4, totals exact or "Under 5", Since the start in tens and by campus only when both weeks are".
- **GO-LIVE.** Drop the item "**The numbers' small-number rule** leaves one inference…".
- **Hand-over.** Drop item 7, "The small-number rule's residual…".
- **Spec 2.13.** Record the replacement rule under "Changes on plan review".

*Residuals to note for Lama.*
- Deletions change past weeks' figures between page loads. Two loads can show that something was deleted, but never a small activity count.
- The rule assumes a reader may know the gone figure.

**2. Task 5, Step 2: the week label.** At HEAD, `dayMonth` (`lib/format.ts`) returns "12 Oct", so the plan's `weekFrom` gives "12 Oct to 18 Oct". Task 5 and Task 10 both expect "12 to 18 Oct". Import `eventDate` from `@/lib/format` as well, use `label: weekLabel(monday)` in `weekFrom`, and add:

```ts
/** "12 to 18 Oct", or "28 Sep to 4 Oct" across a month's end. */
function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  return eventDate(monday).month === eventDate(sunday).month
    ? `${eventDate(monday).day} to ${dayMonth(sunday)}`
    : `${dayMonth(monday)} to ${dayMonth(sunday)}`;
}
```

**3. Task 1: the spike also proves the dynamic-route shape, and the working tree stays clean.**
- **Edit only the scratch copy.** Do Step 3 in the scratch copy: write the new `/admin` text into `$S/app/admin/page.tsx`. On Pass, Step 10 copies it into the working tree. Step 9 (restoring with Write) goes away.
- **Add a dynamic route, in `$S` only.** Also apply Task 2's text for `app/admin/sellers/[slug]/page.tsx`. A blocking page with `generateStaticParams` is otherwise untested, and Task 2 converts eight of them. Add to Step 6:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: vossie_session=$STUDENT" http://localhost:3204/admin/sellers/tech-corner   # 404
  curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: vossie_session=$ADMIN" http://localhost:3204/admin/sellers/tech-corner     # 200
  curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: vossie_session=$ADMIN" http://localhost:3204/admin/sellers/no-such-shop    # 404
  ```
  `/admin/featured` then becomes the control (unchanged, G's pattern, still 200 with the 404 page inside), in place of `/admin/sellers`.
- **Public pages don't move.** In Step 2, also run `pnpm build 2>&1 | tee build.log` in the start copy. In Step 4, add the check below; the expected output is nothing. Pass also requires that no other route's symbol or size changes.
  ```bash
  diff <(grep -E "^[┌├└]" "$START/build.log" | grep -v " /admin") <(grep -E "^[┌├└]" build.log | grep -v " /admin")
  ```
- **`j-session.mjs`.** Use `browser.newPage({ baseURL: "http://localhost:3204", serviceWorkers: "block" })`.
- **Confirmed against Next 16.4's docs:**
  - `instant.md`: `false` opts the segment out of static-shell validation.
  - `streaming.md` ("The HTTP contract") and `not-found.md`: a `notFound()` before anything streams gives a 404.
  - `redirect.md`: a page `redirect()` outside streaming gives a 307.
  - HEAD's root layout has no `<Suspense>` round `{children}`.
  - `signInHref` gives `/login?next=%2Fadmin`, and `app/not-found.tsx` contains "find that page".
  - `staff.spec.ts`'s noindex check still holds, because Next adds noindex to every 404.
  - `routes.spec.ts` checks only the final URL.

**4. Task 8, Step 2 (`giveStaffRole`).** "Already has that role" is checked after the token is taken. That contradicts plan decision 7: sending the same form again would go silently to `/admin/staff`. Replace the three field checks with the code below, and keep the later `given === "held"` branch as the race fallback:

```ts
  const target = email === "" ? null : await findAccountByEmail(email);
  if (email === "") errors.push("staff-email-missing");
  else if (!target) errors.push("staff-email-unknown");
  if (!role) errors.push("staff-role-missing");
  else if (target?.roles.includes(role)) errors.push("staff-role-held");
```

**5. Task 4, Files.** `lib/staff/admin-actions.test.ts` is listed but never changed. Keep it, and add to its "approves a waiting shop" test:
`expect(sampleStore().sellerProfiles.get("acc-pending")?.approvedAt).toBe(STAFF_NOW.toISOString());`
Add the file to Step 8's hand-over list.

**6. Task 3, Step 6 → Task 9.** Move these into Task 9, so no admin page links to a 404 between Tasks 3 and 9:
- the two new `STAFF_SECTIONS` entries (Numbers, Staff);
- `lib/staff/paths.test.ts`'s section-list change;
- `staff-parts.test.tsx`'s `toHaveLength(10)`.

Task 9 adds them, with a note that `/admin/numbers` returns 404 until Task 10. The path constants stay in Task 3.

**7. Task 2, Step 3.** Also replace `staffMetadata`'s comment in `lib/staff/access.ts`, which says the title "streams in", with:

```ts
/**
 * A staff page's tab title (plan decision 1): its own for staff, "Page not found" for everyone else, so the title never
 * names the page. Never indexed. It reads the session; staff pages are blocking pages, so it resolves before the first
 * byte (stage J spec decision 15).
 */
```

**8. Task 14, Step 3 (CLAUDE.md, only if Task 1 passed).**
- Line 42: "(staff pages and `/browse` do this)" becomes "(`/browse` does this; staff pages block instead, so theirs resolves before the first byte)".
- Line 43: append " (staff pages, which block, call `requireStaff()` at the top instead)" to its first sentence.
- In the new "Staff pages" line, keep ", which marks them `noindex`" after "Their tab title comes from `staffMetadata()`".

**9. Task 14, Step 5 (GO-LIVE).**
- Add a stage J row to section 5's table, `| Admin: staff accounts, weekly numbers, hidden listings and requests with Show again (stage J) | /admin/staff, /admin/numbers, /admin/hidden | **Built in sample mode** |`, and update the Totals.
- Extend line 5's "Updated …" sentence with ", and after staff accounts, the admin's numbers and Show again, in sample mode (stage J)".
- "add after it" reads "append to the end of that same line".

**10. Task 13, Step 6: stale comments.**
- `tests/e2e/staff.spec.ts:34` becomes "// Next adds its own noindex to every 404 page, beside the page's: every one says so."
- `staff.spec.ts:40` becomes "// The CSV is a real 404 too: a route handler answers before anything is sent."
- `staff-checks.spec.ts`'s `expectNoSeriousIssues` doc drops "streams in".

**11. Task 13, the Show again test.** The fresh Tech corner listing stays published. Say so in the test's comment: "The listing stays published: harmless with a fresh server per run; with E2E_REUSE_SERVER=1, Tech corner's and browse's counts drift, as after selling-writes and alerts-writes." There is no delete flow. No other project's counts are affected: the project runs last, and the listing is a fresh `uniqueWord()` one.

**12. Tasks 9, 11 and 13: WCAG 2.5.3 (Label in Name).** Each link's accessible name now starts with its visible words.
- In Task 9's `RemoveLink`, the link text is `Remove {role} role<span className="sr-only">{` for ${person.firstName}`}</span>`, named "Remove mentor role for Naledi".
- In Task 11's `ShowLink`, the link text is `Show again<span className="sr-only">{`: ${item.title}`}</span>`, named "Show again: Casio fx-991ZA Plus".
- Update the link names in `AdminStaff.test.tsx`, `AdminHidden.test.tsx` and Task 13's e2e to match.

**13. Task 11, Step 4.** `app/admin/hidden/page.tsx` uses `staffMetadata("admin", "Hidden listings and requests")`, so the tab title matches the H1. Record this in spec section 3's page titles.

**14. Task 11: a check.** `components/forms/summary-ids.test.tsx:62` mocks `@/lib/staff/admin-actions` with a fixed list of exports. If any view rendered there imports `showListingAgain` or `showRequestAgain`, add both to that factory. As written, the Show again views render no `ErrorSummary` and aren't rendered there.

**15. Sizing: Task 13 splits in two.**
- **13a:** `playwright.config.ts` (the `staff-accounts-writes` project), `tests/e2e/helpers/staff-accounts.ts`, `staff-accounts-writes.spec.ts`, and `staff.spec.ts`'s status checks with amendment 10's comments.
- **13b:** `staff-accounts-checks.spec.ts` (axe, layout shift, size), with the ledger's Task 13 row and the staff pages' sizes.

13b runs after 13a is committed. Task 2 stays one task: it's mechanical, and all 16 pages were diffed against HEAD with nothing lost or reordered.

## Store design

- **No new table.** Roles are `AccountRow.roles` (accounts spec 2.9). Only `lib/data/staff-accounts.ts` changes them, and only through `giveRole` and `removeRole`.
- **One optional field:** `SellerProfileRow.approvedAt?: string | null`, written only by `approveShop`, read only by `lib/data/numbers.ts` and the shop export. Absent means null, so no other seed changes. `STORE_VERSION` 8 → 9, so `next dev` reseeds.
- **Reused:** `ListingRow.hiddenAt`/`hiddenReason` and `RequestRow.hiddenAt`/`hiddenReason` are cleared by `showListing` and `showRequest`; `SellerProfileRow.mentorId` is cleared by `removeRole` for a mentor, as `forgetAccountInStaffTools` already does on deletion; G's `auditLog` gains four actions and the `account` target; E's notifications gain the `staff-role` kind, whose `subjectId` is the role.
- **Who reads what:** `lib/data/staff-accounts.ts` reads accounts, seller profiles and sellers; `lib/data/numbers.ts` reads listings, sellers, seller profiles, requests, conversations, reports and follows (never `savedSearches`), plus `catalog.ts`; `lib/data/staff-reports.ts`'s new readers read listings, sellers, seller profiles and requests. None imports `accounts.ts`, so there's no cycle.

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec section 8):** **public pages don't move by a byte.** If any figure changes from the Start row, stop after that task and find out why before going on. If any page passes the stop line Lama last accepted (152,305 B; use a newer figure from "Recheck" item 8 if there is one), stop and report: don't cut features to fit.
- **Where bytes could move:** nowhere public, by design. Every change is a Server Component, a Server Action or server-only data. The pages buyers open that this stage touches are the notifications page (Task 3, one `case` in a Server Component), privacy settings (Task 12, server text) and the privacy policy (Task 12, server text). Staff pages gain no client component.
- **Recording.** In the scratch copy, `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` prints each page's `scriptBrotli`. Task 1 runs it for the Start row (from HEAD, before any change is copied in), Task 12 after the privacy words, Task 13 with the staff pages' own sizes, and the controller at Task 14.

**As built** (fill in during the build):

| Point | `/` | `/browse` | Listing | Storefront | Saved | Privacy | Notifications (signed in) | New listing form (signed in) |
|---|---|---|---|---|---|---|---|---|
| I's final figures (2026-10-20) | 150,591 | 151,338 | 151,747 | 151,351 | 151,226 | 150,591 | not in I's ledger | 152,265 |
| Start (Task 1, Step 2, from HEAD) | | | | | | | | |
| Task 12, the privacy words | | | | | | | | |
| Task 13, the stage's checks | | | | | | | | |
| **Final (Task 14)** | | | | | | | | |

Staff pages, signed in as the admin (Task 13): Staff accounts —, Numbers —, Hidden —. The shell's figure is 150,591 B.

The stop line used: 152,305 B (decision 52). Unit tests at the start: — (Task 1 records them). End to end at the start: 1,247 passed, 1,144 skipped (I's final run, `d3526fd`).

## Changes made during the build

Written in Task 14 from `git log` and the code. Where an entry differs from the tasks above, the entry wins.

(Filled in at Task 14.)

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there unless a step says to run them in the scratch copy (`$S`).
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, and comments in plain English. There's no formatter: match the file you're in.
- **Server or client.** Server Components unless a file starts with `"use client"`. This plan adds **no** client component and changes none. Plain `lib/` modules have no directive. `lib/staff/admin-actions.ts` and the new `lib/staff/account-actions.ts` start with `"use server"`: everything they export must be an async function (a private helper inside is fine; no exported constants or types).
- **Next APIs.** Before using a Next API this plan names, read its page in `node_modules/next/dist/docs/01-app/` (AGENTS.md):
  - blocking pages and real statuses: `02-guides/streaming.md` ("The HTTP contract"), `03-api-reference/03-file-conventions/02-route-segment-config/instant.md`;
  - `notFound()` and `redirect()`: `03-api-reference/04-functions/not-found.md`, `redirect.md`;
  - Server Actions in forms, `refresh()`: `02-guides/server-actions.md`, `02-guides/forms.md`, `03-api-reference/04-functions/refresh.md`;
  - `updateTag`: `03-api-reference/04-functions/updateTag.md`;
  - `connection()`: `03-api-reference/04-functions/connection.md`;
  - `searchParams` and `params` on a page: `03-api-reference/03-file-conventions/page.md`, `dynamic-routes.md`;
  - `generateMetadata` with request data: `03-api-reference/04-functions/generate-metadata.md` ("With Cache Components").

  The first task that uses one says so in its first step.
- **Breakpoints.** `wide:` is tablet and up; `desk:` is desktop. Never `md:`, `lg:` or `sm:`. In CSS (there's none new here), `@media (min-width: 48rem) and (min-height: 30rem)`.
- **Effects and motion.** None in this plan.
- **Headings and ids.** One H1 per page (the staff frame's). Sections are `<section aria-labelledby="…">` with one H2. Ids are unique across pages (plan decision 9), because Next keeps earlier pages hidden in the DOM.
- **Request-time parts.** With Task 1 holding, a staff page reads the session, `params` and `searchParams` at its top level, after `export const instant = false`. Clock reads still come after `await connection()` (decision 26). No `Date.now()`, `new Date()`, `Math.random()` or `crypto.random*` while prerendering: ids and times are made only in Server Actions, and pages read the clock after `connection()`. There's no `try`/`catch` round JSX.
- **Data functions** take `now` from their caller, never read the clock, and hand out copies.
- **Server Actions.** Read every field with F's `field(formData, name)`. Never take identity from a field: the admin comes from `requireStaff()`. Check every id from a field with E's `isId` and look it up in the store. A role is read with `parseStaffRole`. Call `redirect()` and `notFound()` outside any `try`. Every action ends with F's `done(path)`.
- **Forms.** Plain `<form action={serverAction} noValidate>`. Every field has a `<label>` (a `<legend>` for the role radios); hints and errors join `aria-describedby`; an invalid field has `aria-invalid="true"`. Errors use D's `ErrorSummary` and `FieldError`. A new form with an `ErrorSummary` joins `components/forms/summary-ids.test.tsx` (G amendment 1).
- **User text.** Names, emails, shop names, titles and reasons are React text, never `dangerouslySetInnerHTML`.
- **Async components in tests.** jsdom can't render an async component inside a tree. Render a view component with plain props, or `await` the page function and render what it returns.
- **Server code in tests.** Use D's `tests/helpers/next-request.ts` (`nextHeaders`, `nextNavigation`, `nextServer`, `nextCache`, `redirectOf`, `resetRequest`) and G's `tests/helpers/staff.ts` (`STAFF_NOW`, `signedInAs(request, accountId)`, `form(fields)`); call `resetSampleStore()` and `resetRequest(request)` in `beforeEach`. Fake only the date: `vi.useFakeTimers({ toFake: ["Date"] })`, then `vi.setSystemTime(…)`.
- **JSX text.** `react/no-unescaped-entities` is on: write `&apos;` for an apostrophe inside JSX text (a string in an attribute, a prop or `{"…"}` is fine). End a text line with `{" "}` when the next line starts with a tag.
- **Links.** `Link` from `next/link` with `prefetch={false}` on every link this plan adds (G 8.20, decision 53).
- **Accessible names.** Put spaces outside `sr-only` spans: `Remove{" "}<span className="sr-only">{`${name}'s`}</span>{" "}mentor role` is named "Remove Naledi's mentor role" and reads "Remove mentor role". Icons are `aria-hidden`.
- **Contrast.** Sky never carries text on white. Links on white are sky-dark. Confirm buttons are G's `btn btn-danger`; Give role is G's `btn btn-primary form-submit`.
- **Tap targets.** At least 44 × 44px, 8px apart. Row actions use `staff-row-action` (44px). Links inside a paragraph or a fact are exempt (WCAG 2.5.8).
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git --no-optional-locks status --short` on its own, and checks that the listed files changed and nothing else of this stage's did (the other sessions' files stay as they were);
  2. runs `git add` with the listed files, by name;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.

### The scratch copy (builds, `pnpm start`, e2e, the whole unit suite, lint and typecheck)

Another session shares the working tree, so nothing builds or starts there. Every task that builds makes a fresh copy of the committed code, adds its own changed files, and works in that:

```bash
# 1. A new, empty folder in your scratchpad (never reuse or delete one). <N> is the task's number.
S="<your scratchpad>/vossie-j-task<N>"
mkdir "$S"
# 2. The committed code (read-only git), then node_modules as an APFS clone (fast, no extra disk).
git -C /Users/LamaNkuna/Projects/Vossie --no-optional-locks archive HEAD | tar -x -C "$S"
cp -cR /Users/LamaNkuna/Projects/Vossie/node_modules "$S/node_modules"
# 3. This task's own changed and new files, one line each, quoted (paths like [id] are globs to zsh). Never the other
#    sessions' files. For example:
mkdir -p "$S/app/admin" && cp "app/admin/page.tsx" "$S/app/admin/page.tsx"
mkdir -p "$S/app/admin/staff/[id]/remove-mentor" && cp "app/admin/staff/[id]/remove-mentor/page.tsx" "$S/app/admin/staff/[id]/remove-mentor/page.tsx"
# 4. The e2e server's port.
sed -i '' 's/^const PORT = 3200;$/const PORT = 3204;/' "$S/playwright.config.ts"
grep -n "^const PORT" "$S/playwright.config.ts"
```

Expected from the last command: `4:const PORT = 3204;`.

Then, from `$S`: `pnpm build`, `pnpm start --port 3204`, `pnpm e2e …` (which builds and starts its own server on 3204), `pnpm test`, `pnpm lint`, `pnpm typecheck`. Each step says which. Screenshots and other files a test writes land in `$S`; a step that keeps them says where to copy them. Stop any `pnpm start` you started before you finish (it's yours, not an install or build).

### If Task 1 failed

Tasks 9 to 11 write each new page as a blocking page. If Task 1 failed, write each one in G's shape instead: no `instant` export, the default export returns the page's body inside `<Suspense fallback={<StaffSkeleton />}>`, and the body (everything after the default export's first line, `requireStaff` included) moves into an inner async component that takes the page's `params` or `searchParams`. For `/admin/staff` it reads:

```tsx
import { Suspense } from "react";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
// …the imports Task 9 lists…

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Staff accounts");
}

export default function AdminStaffPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <StaffAccounts />
    </Suspense>
  );
}

async function StaffAccounts() {
  const account = await requireStaff("admin", ADMIN_STAFF_PATH);
  // …the rest of Task 9's AdminStaffPage body, unchanged…
}
```

Dynamic routes await `params` first inside the inner component, as G's do. Task 13's status tests skip (`STAFF_404_IS_REAL = false`), and Task 14 leaves CLAUDE.md's staff page line and the go-live item as they are.

## File map (end of this plan)

New files are marked **+**, changed **~**.

```
app/
  admin/page.tsx                                                ~ blocking (Task 1); the hidden count (Task 11)
  admin/**/page.tsx, hub/manage, hub/new, hub/[id]/edit,
  mentor/page.tsx, mentor/[slug]/page.tsx (+ its test)          ~ blocking (Task 2, only if Task 1 holds)
  admin/staff/page.tsx                                          + (Task 9)
  admin/staff/[id]/remove-mentor/page.tsx, remove-admin/page.tsx + (Task 9)
  admin/numbers/page.tsx                                        + (Task 10)
  admin/hidden/page.tsx                                         + (Task 11)
  admin/hidden/listings/[id]/page.tsx, requests/[id]/page.tsx   + (Task 11)
  account/privacy/page.tsx                                      ~ the staff lines (Task 12)
  privacy/page.tsx  page.test.tsx                               ~ (Task 12)
components/
  staff/ConfirmAction.tsx  StaffTable.tsx  staff-parts.test.tsx ~ no-reason mode, row headers (Task 9); 10 sections (Task 3)
  staff/AdminStaff.tsx  StaffRoleConfirm.tsx  (+ tests)         + (Task 9)
  staff/AdminNumbers.tsx  (+ test)                              + (Task 10)
  staff/AdminHidden.tsx  ShowAgainConfirm.tsx  (+ tests)        + (Task 11)
  staff/AdminOverview.tsx  AdminReports.tsx  AdminReport.tsx (+ tests) ~ links to Hidden (Task 11)
  messages/NotificationsView.tsx  (+ test)                      ~ staff-role's icon (Task 3)
  account/PrivacySettingsView.tsx  (+ test)                     ~ (Task 12)
  forms/summary-ids.test.tsx                                    ~ (Task 9)
lib/
  types.ts                                                      ~ (Task 3)
  staff/audit-words.ts  notices.ts  errors.ts  notification-text.ts  paths.ts  roles.ts  form-state.ts (+ tests) ~ (Task 3)
  staff/access.ts                                               ~ its comment (Task 2)
  staff/numbers.ts  (+ test)                                    + (Task 5)
  staff/admin-actions.ts  (+ test)                              ~ approveShop's now (Task 4); Show again (Task 7)
  staff/account-actions.ts  (+ test)                            + (Task 8)
  data/rows.ts  store.ts  shops.ts  staff-shops.ts  (+ tests)   ~ approvedAt (Task 4); showListing (Task 7)
  data/staff-reports.test.ts                                    ~ approveShop's now (Task 4)
  data/staff-accounts.ts  (+ test)                              + (Task 4)
  data/numbers.ts  (+ test)                                     + (Task 6)
  data/requests.ts  staff-reports.ts  (+ tests)                 ~ (Task 7)
data/fixtures/accounts.ts                                       ~ Sipho's approvedAt (Task 4)
playwright.config.ts                                            ~ staff-accounts-writes (Task 13)
tests/e2e/
  helpers/staff-accounts.ts                                     + (Task 13)
  staff-accounts-writes.spec.ts  staff-accounts-checks.spec.ts  + (Task 13)
  staff.spec.ts                                                 ~ status checks (Task 13)
  staff-accounts-screenshots.spec.ts                            + (Task 14)
docs/progress/staff-accounts/  docs/reference/GO-LIVE.md  CLAUDE.md  the spec  this plan   ~ / + (Task 14)
```

Each `*.test.ts(x)` sits next to the file it tests.

**Tasks that touch files other work also touches:** Task 3 (`lib/types.ts`, the staff word modules, `NotificationsView`, `staff-parts.test.tsx`), Task 4 (`rows.ts`, `store.ts`, `data/fixtures/accounts.ts`, `shops.ts`, `staff-shops.ts`, `admin-actions.ts`), Task 7 (`requests.ts`, `staff-reports.ts`, `admin-actions.ts` and its gate test), Task 9 (`ConfirmAction`, `StaffTable`, `summary-ids.test.tsx`), Task 11 (`AdminOverview`, `AdminReports`, `AdminReport`), Task 12 (`PrivacySettingsView`, `app/privacy/page.tsx`), Task 13 (`playwright.config.ts`, `staff.spec.ts`), Task 14 (`CLAUDE.md`, `GO-LIVE.md`, the spec). Run them one at a time; the others can follow the suggested pairs.

**Suggested pairs for implementers:** Task 1 alone; Task 2 alone; Tasks 3 and 4; Tasks 5 and 6; Tasks 7 and 8; Task 9; Tasks 10 and 11; Task 12; Task 13; Task 14.

## Where each spec decision is built

| Spec | Built in |
|---|---|
| 2.1 Two roles, no "Hub staff" role | Task 3 (`ROLE_CHOICES`; plan decision 6) |
| 2.2 `/admin/staff`, the table, the frame's row | Task 3 (paths, `STAFF_SECTIONS`), Task 4 (`listStaffAccounts`), Task 9 (`AdminStaff`; plan decision 11) |
| 2.3 Give a role by exact email, the token, the four errors | Task 3 (errors), Task 4 (`giveRole`), Task 8 (`giveStaffRole`; plan decision 7), Task 9 (the form) |
| 2.4 Remove through a confirm page, `ConfirmAction`'s no-reason mode | Task 9 (`ConfirmAction`, `StaffRoleConfirm`, the two routes; plan decision 10) |
| 2.5 Never your own admin role, always one admin | Task 4 (`removeRole`), Task 8 (the action), Task 9 (the row and the page) |
| 2.6 What a change does | Task 4 (roles, `mentorId`), Task 8 |
| 2.7 One audit entry and one notification, the notices | Task 3 (words, types, the icon), Task 8 |
| 2.8 Deleting a staff account | Task 12 (plan decision 19), Task 8 (the deletion test) |
| 2.9 `/admin/numbers`, admin only | Task 3 (paths), Task 10 |
| 2.10 What it counts | Task 4 (`approvedAt`), Task 6 (`countByWeek`; plan decisions 12 and 13) |
| 2.11 Fixed SAST weeks | Task 5 (`sastWeeks`; plan decision 15) |
| 2.12 Two tables and a campus view, no client code | Task 9 (`StaffTable`'s row headers), Task 10 (plan decisions 25 and 26) |
| 2.13 The small-number rule | Task 5 (`protectCounts`; plan decision 14) |
| 2.14 Show again | Task 7 (data and actions; plan decision 16), Task 11 (pages and links; plan decisions 17 and 18) |
| 2.15 The staff 404's status | Task 1 (the spike; plan decision 1), Task 2 (plan decision 2), Task 13 (status checks), Task 14 (CLAUDE.md, GO-LIVE) |
| 3 Screens | Tasks 9 to 11 |
| 4 Data | Tasks 4 to 7 |
| 5 Rules | Tasks 4, 7 and 8 |
| 6 Privacy | Task 12 (plan decision 20), Task 4 (the export) |
| 7 Accessibility | Tasks 9 to 11, axe in Task 13 |
| 8 Performance | The ledger; Tasks 1, 12 and 13 |
| 9 Testing | Unit tests in Tasks 3 to 12; end to end in Task 13; screenshots in Task 14 |
| 10, 11 Not in this stage, go-live items | Task 14 |

---

### Task 1: The spike: `/admin` answers a real 404 and 307, or the stage keeps G's pattern

Spec 2.15's stop rule, on one page. `/admin` becomes a blocking page: `export const instant = false`, and the role check at the top of the page component, before anything is returned. Nothing else changes. The task measures the public JS figures first (the ledger's Start row), then builds and checks the statuses with `curl` against `pnpm start` in a scratch copy.

**Pass** when every one of these holds:
- `pnpm build` in the scratch copy exits 0, with no error naming `/admin` (no "Uncached data was accessed outside of `<Suspense>`", no "runtime data in generateMetadata()");
- signed out, `/admin` answers `307` with `location: /login?next=%2Fadmin`;
- signed in as the sample student, and as the sample mentor, `/admin` answers `404`, and its body is the site's 404 page;
- signed in as the sample admin, `/admin` answers `200` with the Overview;
- the control: signed in as the student, `/admin/sellers` (unchanged, G's pattern) still answers `200` with the 404 page inside, so the difference is this change's;
- in the scratch copy, the whole unit suite, `pnpm lint` and `pnpm typecheck` pass, and `tests/e2e/staff.spec.ts` and `tests/e2e/routes.spec.ts` pass at `desktop-1440`.

**Fail** when any of them doesn't. Then:
- put `app/admin/page.tsx` back to HEAD's text (Step 9), so `git --no-optional-locks status --short app/admin` prints nothing;
- report to the controller what failed, with the build's error or `curl`'s output;
- the controller writes the outcome into "Changes made during the build", skips Task 2, and tells every later implementer to use "If Task 1 failed" (conventions), with `STAFF_404_IS_REAL = false` in Task 13;
- nothing is committed for this task except the ledger's Start row, in this plan, by the controller.

**Pass follow-on:** commit `app/admin/page.tsx`; Task 2 converts every other staff page; Tasks 9 to 11 write blocking pages; Task 13's `STAFF_404_IS_REAL` is `true`; Task 14 ticks GO-LIVE's "A true 404 status for staff pages" and changes CLAUDE.md's staff page line and its `cookies()` rule.

**`app/layout.tsx`:** another session has uncommitted edits to it. The spike doesn't edit it, and the scratch copy has HEAD's. **If the spike can only pass by changing the root layout** (for example, wrapping `{children}` in a `<Suspense>`, or adding `instant` there), it fails: the stage keeps G's pattern.

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Read Next's words on it**

Read `node_modules/next/dist/docs/01-app/02-guides/streaming.md`, section "The HTTP contract", and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md`, sections "Disabling instant" and "Disabling static shell validation". Note in your report whether either says anything this plan has missed.

- [ ] **Step 2: Measure the Start row, from HEAD, before changing anything**

Make the scratch copy (conventions, "The scratch copy") with **no** files copied in at step 3: it's HEAD as committed. Use `S="<your scratchpad>/vossie-j-task1-start"`. Then, from `$S`:

```bash
pnpm e2e tests/e2e/performance.spec.ts --project=phone-390
```

Expected: every test passes, and the output has one line per page, such as `homepage: {"script":…,"scriptBrotli":150591}`. Write the `scriptBrotli` figures for homepage, browse page, listing page, storefront, Saved page, privacy page, notifications page (signed in) and new listing form (signed in) into your report, for the ledger's Start row. Also run `pnpm test` there and note the count of tests and files (the ledger's "Unit tests at the start").

- [ ] **Step 3: Make `/admin` a blocking page**

Replace the whole of `app/admin/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { connection } from "next/server";
import { AdminOverview } from "@/components/staff/AdminOverview";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { recalculateBadges } from "@/lib/data/badges";
import { openBookingCount } from "@/lib/data/hub-posts";
import { openReportCount } from "@/lib/data/staff-reports";
import { countWaitingShops } from "@/lib/data/staff-shops";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_PATH } from "@/lib/staff/paths";

/**
 * A blocking page (stage J spec decision 15): Next holds the response until the role is checked, so a signed-out
 * visitor gets a real 307 to sign in and anyone without the role a real 404, before the first byte. Every staff page
 * needs the session, so there's no static shell to lose.
 */
export const instant = false;

/** "Admin console" for admins, "Page not found" for everyone else (staff tools plan decision 1). */
export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Admin console");
}

/** Overview (staff tools spec 2.3). The role first, before anything is returned. */
export default async function AdminPage() {
  const account = await requireStaff("admin", ADMIN_PATH);
  // The badges read the clock (decision 26).
  await connection();
  // Overview works the badges out as it renders (staff tools spec 2.7, plan decision 8). A render can't expire tags.
  const changed = await recalculateBadges(new Date());
  const [waiting, openReports, openSlots, notice] = await Promise.all([
    countWaitingShops(),
    openReportCount(),
    openBookingCount(),
    takeNotice(),
  ]);
  return (
    <StaffFrame account={account} area="Admin console" title="Overview" current={ADMIN_PATH} notice={staffNoticeText(notice)}>
      <AdminOverview waiting={waiting} openReports={openReports} openSlots={openSlots} badgesChanged={changed.length} />
    </StaffFrame>
  );
}
```

Run: `pnpm lint app/admin/page.tsx`
Expected: no output (no problems).

- [ ] **Step 4: Build it in a scratch copy**

Make a second scratch copy, `S="<your scratchpad>/vossie-j-task1"`, copying in `app/admin/page.tsx` at the procedure's step 3. From `$S`:

```bash
pnpm build 2>&1 | tee build.log
echo "exit: ${PIPESTATUS[0]}"
grep -n "/admin " build.log
grep -n -i "uncached data\|outside of <Suspense>\|runtime data in generateMetadata" build.log
```

Expected: `exit: 0`; the route table lists `/admin` as dynamic (`ƒ`); the last `grep` prints nothing. If the build fails, keep `build.log`'s error for the report and go to Step 9 (the spike has failed).

- [ ] **Step 5: Start it, and get a session cookie for each sample account**

From `$S`, start the server in the background: `pnpm start --port 3204` (run it with `run_in_background`), and wait until `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3204/` prints `200`.

Write this throwaway script as `$S/j-session.mjs` (it lives in the scratch copy so it finds `@playwright/test` there):

```js
// Signs in with a sample account's button and prints its session cookie, for curl (stage J plan, Task 1).
import { chromium } from "@playwright/test";

const [label] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: "http://localhost:3204" });
await page.goto("/login?next=%2Faccount");
await page.locator("main").getByRole("button", { name: label, exact: true }).click();
await page.waitForURL("**/account");
const cookie = (await page.context().cookies()).find((item) => item.name === "vossie_session");
console.log(cookie?.value ?? "");
await browser.close();
```

From `$S`:

```bash
STUDENT=$(node j-session.mjs "Student, Midrand")
MENTOR=$(node j-session.mjs "Mentor")
ADMIN=$(node j-session.mjs "Admin")
echo "${#STUDENT} ${#MENTOR} ${#ADMIN}"
```

Expected: three non-zero lengths.

- [ ] **Step 6: Check the statuses**

From `$S`, with the server still running:

```bash
curl -sI http://localhost:3204/admin | grep -i -E "^HTTP|^location"
curl -sI -H "Cookie: vossie_session=$STUDENT" http://localhost:3204/admin | grep -i "^HTTP"
curl -sI -H "Cookie: vossie_session=$MENTOR" http://localhost:3204/admin | grep -i "^HTTP"
curl -sI -H "Cookie: vossie_session=$ADMIN" http://localhost:3204/admin | grep -i "^HTTP"
curl -s -H "Cookie: vossie_session=$STUDENT" http://localhost:3204/admin | grep -c "find that page"
curl -s -H "Cookie: vossie_session=$ADMIN" http://localhost:3204/admin | grep -c "Needs attention"
# The control: G's pattern, unchanged, still answers 200 with the 404 page inside.
curl -sI -H "Cookie: vossie_session=$STUDENT" http://localhost:3204/admin/sellers | grep -i "^HTTP"
# The same with GET, in case HEAD is answered differently.
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3204/admin
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: vossie_session=$STUDENT" http://localhost:3204/admin
```

Expected, line by line:
- `HTTP/1.1 307 Temporary Redirect` and `location: /login?next=%2Fadmin`;
- `HTTP/1.1 404 Not Found`;
- `HTTP/1.1 404 Not Found`;
- `HTTP/1.1 200 OK`;
- `1` or more;
- `1` or more;
- `HTTP/1.1 200 OK` (the control);
- `307 http://localhost:3204/login?next=%2Fadmin`;
- `404`.

Then stop the server you started (it's yours). Paste the output into your report.

- [ ] **Step 7: The suites, in the same scratch copy**

From `$S` (the server stopped):

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm e2e tests/e2e/staff.spec.ts tests/e2e/routes.spec.ts --project=desktop-1440
```

Expected: the unit count from Step 2, all passing; no lint or type errors; the e2e tests pass (the student's 404 title checks and the signed-out redirect to sign-in both still hold; the latter now through a real 307).

- [ ] **Step 8: Report the verdict**

Report **Pass** or **Fail** with Steps 4, 6 and 7's output and the Start row's figures. On Pass, go to Step 10. On Fail, Step 9.

- [ ] **Step 9 (Fail only): Put `/admin` back as it was**

Read HEAD's text with `git --no-optional-locks show HEAD:app/admin/page.tsx`, and write it back into `app/admin/page.tsx` with the Write tool, exactly. Then run `git --no-optional-locks status --short app/admin` on its own.
Expected: no output. Hand over with no files to commit.

- [ ] **Step 10 (Pass only): Hand over**

Files: `app/admin/page.tsx`. Message:

```
feat: the admin console's Overview is a blocking page: its role is checked before the first byte, so a student or mentor gets a real 404 and a signed-out visitor a real 307 to sign in (stage J spec decision 15's spike; plan decision 1). Build passes with no Suspense error; curl: 307, 404, 404, 200, and the control /admin/sellers still 200. JS: Start row <figures>
```

---

### Task 2 (only if Task 1 passed): Every other staff page blocks

Spec 2.15's follow-on: G's sixteen other staff pages become blocking pages, written as plan decision 2 says. Each loses its `<Suspense>` and `StaffSkeleton` import, gains `export const instant = false`, and does in its default export what its inner component did, in the same order: `await params` on dynamic routes, then `requireStaff`, then the rest. Nothing else about any page changes. The mentor shop page's test calls the page directly now.

**Files:**
- Modify: `app/admin/sellers/page.tsx`, `app/admin/sellers/[slug]/page.tsx`, `app/admin/sellers/[slug]/decline/page.tsx`, `app/admin/sellers/[slug]/pause/page.tsx`
- Modify: `app/admin/reports/page.tsx`, `app/admin/reports/[id]/page.tsx`, `app/admin/reports/[id]/hide/page.tsx`, `app/admin/reports/[id]/pause/page.tsx`
- Modify: `app/admin/featured/page.tsx`, `app/admin/pickup-points/page.tsx`, `app/admin/audit/page.tsx`
- Modify: `app/hub/manage/page.tsx`, `app/hub/new/page.tsx`, `app/hub/[id]/edit/page.tsx`
- Modify: `app/mentor/page.tsx`, `app/mentor/[slug]/page.tsx`, `app/mentor/[slug]/page.test.tsx`
- Modify: `lib/staff/access.ts` (its comment)

- [ ] **Step 1: The mentor page's test calls the page itself (failing first)**

In `app/mentor/[slug]/page.test.tsx`, replace the `open` helper:

```ts
/** The page's request-time part, run on its own: jsdom can't render an async component inside a tree. */
async function open(slug: string): Promise<unknown> {
  const page = MentorShopPage({ params: Promise.resolve({ slug }) } as never) as ReactElement<{
    children: ReactElement<Record<string, unknown>>;
  }>;
  const shop = page.props.children;
  return (shop.type as (props: Record<string, unknown>) => Promise<unknown>)(shop.props);
}
```

with:

```ts
/** The page, which checks the role before it returns anything (stage J plan decision 2). */
async function open(slug: string): Promise<unknown> {
  return MentorShopPage({ params: Promise.resolve({ slug }) } as never);
}
```

and delete the `import type { ReactElement } from "react";` line at the top.

Run: `pnpm test "app/mentor/[slug]/page.test.tsx"` (quoted: zsh reads `[slug]` as a pattern)
Expected: FAIL. "sends a signed-out visitor to sign in…" and "gives the 404 for the viewer's own shop…" fail, because the page still returns its `<Suspense>` element without checking anything, so nothing throws.

- [ ] **Step 2: Rewrite the sixteen pages**

Replace each file's whole text with the one below.

`app/admin/sellers/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AdminSellers } from "@/components/staff/AdminSellers";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { getCampuses } from "@/lib/data";
import { listShopsForReview } from "@/lib/data/staff-shops";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_SELLERS_PATH } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Sellers");
}

/** Sellers (staff tools spec 2.3): waiting for approval first. */
export default async function AdminSellersPage() {
  const account = await requireStaff("admin", ADMIN_SELLERS_PATH);
  const [rows, campuses, notice] = await Promise.all([listShopsForReview(), getCampuses(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title="Sellers" current={ADMIN_SELLERS_PATH} notice={staffNoticeText(notice)}>
      <AdminSellers rows={rows} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />
    </StaffFrame>
  );
}
```

`app/admin/sellers/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminSeller } from "@/components/staff/AdminSeller";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { getCampuses, getCategories } from "@/lib/data";
import { pickupPointName } from "@/lib/data/pickup-points";
import { getShopForReview, listMentors } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_SELLERS_PATH, adminSellerPath } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Review a shop");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no shop. */
export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** A shop's review page (staff tools spec 2.3). An unknown shop is the 404. */
export default async function AdminSellerPage({ params }: PageProps<"/admin/sellers/[slug]">) {
  const { slug } = await params;
  // The role first, so someone without it gets the 404 whatever the address says (staff tools plan decision 1).
  const account = await requireStaff("admin", adminSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  const [campuses, categories, mentors, notice] = await Promise.all([
    getCampuses(),
    getCategories(),
    listMentors(),
    takeNotice(),
  ]);
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title={review.shop.name}
      current={ADMIN_SELLERS_PATH}
      notice={staffNoticeText(notice)}
    >
      <AdminSeller
        review={review}
        campusName={campuses.find((campus) => campus.slug === review.shop.campusSlug)?.name ?? ""}
        categoryName={categories.find((category) => category.slug === review.shop.categorySlug)?.name ?? ""}
        pointNames={review.shop.pickupPointIds.flatMap((id) => pickupPointName(id) ?? [])}
        mentors={mentors}
      />
    </StaffFrame>
  );
}
```

`app/admin/sellers/[slug]/decline/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SellerConfirm } from "@/components/staff/SellerConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { getShopForReview } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { declineForm } from "@/lib/staff/form-state";
import { ADMIN_SELLERS_PATH, declineSellerPath } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Decline a shop");
}

export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** Decline's confirm page (staff tools spec 2.9, plan decision 18). */
export default async function DeclineSellerPage({ params }: PageProps<"/admin/sellers/[slug]/decline">) {
  const { slug } = await params;
  const account = await requireStaff("admin", declineSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  const state = await readFormState(declineForm(slug));
  return (
    <StaffFrame account={account} area="Admin console" title={`Decline ${review.shop.name}`} current={ADMIN_SELLERS_PATH} notice={null}>
      <SellerConfirm
        kind="decline"
        review={review}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`decline-${slug}`))}
      />
    </StaffFrame>
  );
}
```

`app/admin/sellers/[slug]/pause/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SellerConfirm } from "@/components/staff/SellerConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { getShopForReview } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { shopPauseForm } from "@/lib/staff/form-state";
import { ADMIN_SELLERS_PATH, pauseSellerPath } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Pause a shop");
}

export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** Pause shop's confirm page (staff tools spec 2.9, plan decisions 3 and 18). */
export default async function PauseSellerPage({ params }: PageProps<"/admin/sellers/[slug]/pause">) {
  const { slug } = await params;
  const account = await requireStaff("admin", pauseSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  const state = await readFormState(shopPauseForm(slug));
  return (
    <StaffFrame account={account} area="Admin console" title={`Pause ${review.shop.name}`} current={ADMIN_SELLERS_PATH} notice={null}>
      <SellerConfirm
        kind="pause"
        review={review}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`pause-${slug}`))}
      />
    </StaffFrame>
  );
}
```

`app/admin/reports/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AdminReports } from "@/components/staff/AdminReports";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { listReports } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_REPORTS_PATH } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Reports");
}

/** Reports (staff tools spec 2.3): open first. */
export default async function AdminReportsPage() {
  const account = await requireStaff("admin", ADMIN_REPORTS_PATH);
  const [reports, notice] = await Promise.all([listReports(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title="Reports" current={ADMIN_REPORTS_PATH} notice={staffNoticeText(notice)}>
      <AdminReports reports={reports} />
    </StaffFrame>
  );
}
```

`app/admin/reports/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminReport } from "@/components/staff/AdminReport";
import { reportedThing } from "@/components/staff/AdminReports";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { getReport } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { dismissForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_REPORTS_PATH, adminReportPath } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "A report");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no report. */
export function generateStaticParams() {
  return [{ id: "rep-sample" }];
}

/** A report's page (staff tools spec 2.3). An unknown report is the 404. */
export default async function AdminReportPage({ params }: PageProps<"/admin/reports/[id]">) {
  const { id } = await params;
  const account = await requireStaff("admin", adminReportPath(id));
  const report = isId(id) ? await getReport(id) : null;
  if (!report) notFound();
  const [state, notice] = await Promise.all([readFormState(dismissForm(id)), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title={reportedThing(report)} current={ADMIN_REPORTS_PATH} notice={staffNoticeText(notice)}>
      <AdminReport
        report={report}
        note={state?.values.note ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`dismiss-${id}`))}
      />
    </StaffFrame>
  );
}
```

`app/admin/reports/[id]/hide/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportConfirm } from "@/components/staff/ReportConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { getReport } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { hideForm } from "@/lib/staff/form-state";
import { ADMIN_REPORTS_PATH, hideReportedPath } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Hide a listing or request");
}

export function generateStaticParams() {
  return [{ id: "rep-sample" }];
}

/**
 * Hide the listing's or request's confirm page (staff tools spec 2.9, plan decisions 4 and 18; community actions plan
 * decision 20).
 */
export default async function HideReportedPage({ params }: PageProps<"/admin/reports/[id]/hide">) {
  const { id } = await params;
  const account = await requireStaff("admin", hideReportedPath(id));
  const report = isId(id) ? await getReport(id) : null;
  if (!report) notFound();
  const state = await readFormState(hideForm(id));
  return (
    <StaffFrame account={account} area="Admin console" title={`Hide ${report.targetTitle}`} current={ADMIN_REPORTS_PATH} notice={null}>
      <ReportConfirm
        kind="hide"
        report={report}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`hide-${id}`))}
      />
    </StaffFrame>
  );
}
```

`app/admin/reports/[id]/pause/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportConfirm } from "@/components/staff/ReportConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { getReport } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { reportPauseForm } from "@/lib/staff/form-state";
import { ADMIN_REPORTS_PATH, pauseReportedPath } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Pause a shop");
}

export function generateStaticParams() {
  return [{ id: "rep-sample" }];
}

/** Pause the account's confirm page (staff tools spec 2.9, plan decisions 3, 5 and 18). */
export default async function PauseReportedPage({ params }: PageProps<"/admin/reports/[id]/pause">) {
  const { id } = await params;
  const account = await requireStaff("admin", pauseReportedPath(id));
  const report = isId(id) ? await getReport(id) : null;
  if (!report) notFound();
  const state = await readFormState(reportPauseForm(id));
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title={report.shop ? `Pause ${report.shop.name}` : "Pause a shop"}
      current={ADMIN_REPORTS_PATH}
      notice={null}
    >
      <ReportConfirm
        kind="pause"
        report={report}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`report-pause-${id}`))}
      />
    </StaffFrame>
  );
}
```

`app/admin/featured/page.tsx`:

```tsx
import type { Metadata } from "next";
import { connection } from "next/server";
import { AdminFeatured } from "@/components/staff/AdminFeatured";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses } from "@/lib/data";
import { featuredChoices, featuredFor, listPins } from "@/lib/data/featured";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { PIN_FORM, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_FEATURED_PATH } from "@/lib/staff/paths";
import { sastDate } from "@/lib/time";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Featured");
}

/** Featured (staff tools spec 2.3 and 2.8). */
export default async function AdminFeaturedPage() {
  const account = await requireStaff("admin", ADMIN_FEATURED_PATH);
  // Today's date reads the clock (decision 26).
  await connection();
  const today = sastDate(new Date());
  const campuses = await getCampuses();
  const places = [
    { slug: ALL_CAMPUSES, name: "No campus chosen" },
    ...campuses.map((campus) => ({ slug: campus.slug, name: campus.name })),
  ];
  // Each row as visitors see it; one not drawn yet today is drawn and recorded now, as a visit would (plan decision 9).
  const rows = await Promise.all(
    places.map(async (place) => ({ campus: place, sellers: await featuredFor(place.slug, today) })),
  );
  const [pins, choices, state, notice] = await Promise.all([
    listPins(today),
    featuredChoices(),
    readFormState(PIN_FORM),
    takeNotice(),
  ]);
  return (
    <StaffFrame account={account} area="Admin console" title="Featured" current={ADMIN_FEATURED_PATH} notice={staffNoticeText(notice)}>
      <AdminFeatured
        today={today}
        rows={rows}
        pins={pins}
        choices={choices}
        places={places}
        values={state?.values ?? {}}
        errors={staffErrors(state?.errors ?? [], staffFieldIds("pin"))}
      />
    </StaffFrame>
  );
}
```

`app/admin/pickup-points/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AdminPickupPoints, type PointForm } from "@/components/staff/AdminPickupPoints";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { listPickupPoints } from "@/lib/data/pickup-points";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors } from "@/lib/staff/errors";
import { pointAddForm, pointRenameForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_POINTS_PATH } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Pickup points");
}

/** A failed post's typed name and errors, keyed as the view wants them; nothing for forms with no state. */
async function formsFor(keys: readonly { key: string; form: string; fieldId: string }[]) {
  const forms: Record<string, PointForm> = {};
  for (const { key, form, fieldId } of keys) {
    const state = await readFormState(form);
    if (state) forms[key] = { name: state.values.name ?? "", errors: staffErrors(state.errors, { name: fieldId }) };
  }
  return forms;
}

/** Pickup points (staff tools spec 2.3, plan decision 10). */
export default async function AdminPickupPointsPage() {
  const account = await requireStaff("admin", ADMIN_POINTS_PATH);
  const [campuses, points, notice] = await Promise.all([getCampuses(), listPickupPoints(), takeNotice()]);
  const addForms = await formsFor(
    campuses.map((campus) => ({ key: campus.slug, form: pointAddForm(campus.slug), fieldId: `point-add-${campus.slug}-name` })),
  );
  const renameForms = await formsFor(
    points.map((point) => ({ key: point.id, form: pointRenameForm(point.id), fieldId: `point-${point.id}-name` })),
  );
  return (
    <StaffFrame account={account} area="Admin console" title="Pickup points" current={ADMIN_POINTS_PATH} notice={staffNoticeText(notice)}>
      <AdminPickupPoints
        campuses={campuses.map((campus) => ({ slug: campus.slug, name: campus.name }))}
        points={points}
        addForms={addForms}
        renameForms={renameForms}
      />
    </StaffFrame>
  );
}
```

`app/admin/audit/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AdminAudit } from "@/components/staff/AdminAudit";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { auditStaff, listAudit } from "@/lib/data/audit";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { parseAuditFilter } from "@/lib/staff/audit-words";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_AUDIT_PATH } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Audit log");
}

/** The audit log (staff tools spec 2.2 and 2.3). Its filters are in the link, read after the role. */
export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const account = await requireStaff("admin", ADMIN_AUDIT_PATH);
  const filter = parseAuditFilter(await searchParams);
  const [entries, staff, notice] = await Promise.all([listAudit(filter), auditStaff(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title="Audit log" current={ADMIN_AUDIT_PATH} notice={staffNoticeText(notice)}>
      <AdminAudit entries={entries} staff={staff} filter={filter} />
    </StaffFrame>
  );
}
```

`app/hub/manage/page.tsx`:

```tsx
import type { Metadata } from "next";
import { HubManage } from "@/components/staff/HubManage";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { getCampuses } from "@/lib/data";
import { canEditPost, listBookings, listPostsForStaff } from "@/lib/data/hub-posts";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { HUB_MANAGE_PATH } from "@/lib/staff/paths";
import { isAdmin } from "@/lib/staff/roles";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("hub", "Hub posts and office hours");
}

/** The Hub's tools (staff tools spec 3): posts and the office-hours queue. Mentors and admins only. */
export default async function HubManagePage() {
  const account = await requireStaff("hub", HUB_MANAGE_PATH);
  const [posts, bookings, campuses, notice] = await Promise.all([
    listPostsForStaff(),
    listBookings(),
    getCampuses(),
    takeNotice(),
  ]);
  return (
    <StaffFrame
      account={account}
      area="Hub tools"
      title="Hub posts"
      current={HUB_MANAGE_PATH}
      notice={staffNoticeText(notice)}
    >
      <HubManage
        posts={posts.filter((post) => canEditPost(account, post))}
        everyPost={isAdmin(account)}
        bookings={bookings}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      />
    </StaffFrame>
  );
}
```

`app/hub/new/page.tsx`:

```tsx
import type { Metadata } from "next";
import { NEW_POST_VALUES, PostEditor } from "@/components/staff/PostEditor";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { sellingErrors } from "@/lib/selling/errors";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { postFieldIds, staffErrors } from "@/lib/staff/errors";
import { postForm, postPrefix } from "@/lib/staff/form-state";
import { issueOnceToken } from "@/lib/staff/once";
import { HUB_MANAGE_PATH, HUB_NEW_PATH } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("hub", "Write a post");
}

/** A new Hub post (staff tools spec 2.4). */
export default async function NewPostPage() {
  const account = await requireStaff("hub", HUB_NEW_PATH);
  // A new post gets a one-time token, made now, at request time (staff tools amendment 15.7).
  const [campuses, state, once] = await Promise.all([getCampuses(), readFormState(postForm(null)), issueOnceToken()]);
  const ids = postFieldIds(postPrefix(null));
  const codes = state?.errors ?? [];
  return (
    <StaffFrame account={account} area="Hub tools" title="Write a post" current={HUB_MANAGE_PATH} notice={null}>
      <PostEditor
        postId={null}
        values={state?.values ?? NEW_POST_VALUES}
        errors={[...staffErrors(codes, ids), ...sellingErrors(codes, { photos: ids.photos })]}
        preview={state?.notice === "preview" ? (state.values.body ?? "") : null}
        campuses={campuses.map((campus) => ({ slug: campus.slug, name: campus.name }))}
        coverSrc={null}
        once={once}
      />
    </StaffFrame>
  );
}
```

`app/hub/[id]/edit/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostEditor, postValues } from "@/components/staff/PostEditor";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { canEditPost, getPostRow } from "@/lib/data/hub-posts";
import { isId } from "@/lib/messaging/paths";
import { sellingErrors } from "@/lib/selling/errors";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { postFieldIds, staffErrors } from "@/lib/staff/errors";
import { postForm, postPrefix } from "@/lib/staff/form-state";
import { editPostPath, HUB_MANAGE_PATH } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("hub", "Edit a post");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no post. */
export function generateStaticParams() {
  return [{ id: "h-sample" }];
}

/** Editing a post (staff tools spec 2.4): its author, or an admin. Anyone else, or an unknown post, gets the 404. */
export default async function EditPostPage({ params }: PageProps<"/hub/[id]/edit">) {
  const { id } = await params;
  // The role first, so someone without it gets the 404 whatever the address says (staff tools plan decision 1).
  const account = await requireStaff("hub", editPostPath(id));
  const row = isId(id) ? await getPostRow(id) : null;
  if (!row || !canEditPost(account, row)) notFound();
  const [campuses, state] = await Promise.all([getCampuses(), readFormState(postForm(id))]);
  const ids = postFieldIds(postPrefix(id));
  const codes = state?.errors ?? [];
  return (
    <StaffFrame account={account} area="Hub tools" title={`Edit ${row.title}`} current={HUB_MANAGE_PATH} notice={null}>
      <PostEditor
        postId={id}
        values={state?.values ?? postValues(row)}
        errors={[...staffErrors(codes, ids), ...sellingErrors(codes, { photos: ids.photos })]}
        preview={state?.notice === "preview" ? (state.values.body ?? "") : null}
        campuses={campuses.map((campus) => ({ slug: campus.slug, name: campus.name }))}
        coverSrc={row.image.src}
      />
    </StaffFrame>
  );
}
```

`app/mentor/page.tsx`:

```tsx
import type { Metadata } from "next";
import { connection } from "next/server";
import { MentorDashboard } from "@/components/staff/MentorDashboard";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { getCampuses } from "@/lib/data";
import { mentoredShops } from "@/lib/data/mentors";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { MENTOR_PATH } from "@/lib/staff/paths";
import { isAdmin } from "@/lib/staff/roles";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("mentor", "Mentor dashboard");
}

/** The mentor dashboard (staff tools spec 2.6). Mentors and admins only. */
export default async function MentorPage() {
  const account = await requireStaff("mentor", MENTOR_PATH);
  // The 14 days read the clock (decision 26).
  await connection();
  const [rows, campuses, notice] = await Promise.all([mentoredShops(account, new Date()), getCampuses(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Mentoring" title="Mentor dashboard" current={MENTOR_PATH} notice={staffNoticeText(notice)}>
      <MentorDashboard
        rows={rows}
        showMentor={isAdmin(account)}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      />
    </StaffFrame>
  );
}
```

`app/mentor/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MentorShop } from "@/components/staff/MentorShop";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { getMentoredShop, listNotes } from "@/lib/data/mentors";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { checkInForm, noteForm, takeNotice } from "@/lib/staff/form-state";
import { issueOnceToken } from "@/lib/staff/once";
import { staffNoticeText } from "@/lib/staff/notices";
import { MENTOR_PATH, mentorShopPath } from "@/lib/staff/paths";
import { sastDate } from "@/lib/time";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("mentor", "A mentored shop");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no shop. */
export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** A shop's mentor page (staff tools spec 2.6): its mentor or an admin; anyone else, or a shop with none, the 404. */
export default async function MentorShopPage({ params }: PageProps<"/mentor/[slug]">) {
  const { slug } = await params;
  const account = await requireStaff("mentor", mentorShopPath(slug));
  await connection();
  const now = new Date();
  const shop = isId(slug) ? await getMentoredShop(slug, account, now) : null;
  if (!shop) notFound();
  // A note and a check-in each get a one-time token, made now, at request time (staff tools amendment 15.7).
  const [campuses, notes, note, checkIn, notice, noteOnce, checkInOnce] = await Promise.all([
    getCampuses(),
    listNotes(shop.ownerId),
    readFormState(noteForm(shop.slug)),
    readFormState(checkInForm(shop.slug)),
    takeNotice(),
    issueOnceToken(),
    issueOnceToken(),
  ]);
  return (
    <StaffFrame account={account} area="Mentoring" title={shop.name} current={MENTOR_PATH} notice={staffNoticeText(notice)}>
      <MentorShop
        shop={shop}
        campusName={campuses.find((campus) => campus.slug === shop.campusSlug)?.name ?? ""}
        notes={notes}
        noteForm={{ values: note?.values ?? {}, errors: staffErrors(note?.errors ?? [], staffFieldIds(`note-${shop.slug}`)) }}
        checkInForm={{
          values: checkIn?.values ?? {},
          errors: staffErrors(checkIn?.errors ?? [], staffFieldIds(`check-in-${shop.slug}`)),
        }}
        noteOnce={noteOnce}
        checkInOnce={checkInOnce}
        today={sastDate(now)}
      />
    </StaffFrame>
  );
}
```

- [ ] **Step 3: `requireStaff`'s comment says what pages do now**

In `lib/staff/access.ts`, replace the doc comment above `requireStaff`:

```ts
/**
 * The one gate for every staff page, Server Action and the CSV route (staff tools spec 2.1, plan decision 1): a
 * signed-out visitor goes to sign in and comes back to `nextPath`; anyone signed in without the role gets the 404,
 * not a "forbidden" page, so staff pages aren't advertised. Pages call it inside <Suspense>, after the page has
 * started streaming, so the visitor sees the site's 404 page (status 200, noindex); actions and the route call it
 * first.
 */
```

with:

```ts
/**
 * The one gate for every staff page, Server Action and the CSV route (staff tools spec 2.1, plan decision 1): a
 * signed-out visitor goes to sign in and comes back to `nextPath`; anyone signed in without the role gets the 404,
 * not a "forbidden" page, so staff pages aren't advertised. Staff pages are blocking pages (`instant = false`) that
 * call it before they return anything, so Next answers a real 307 or 404 before the first byte (stage J spec
 * decision 15); actions and the route call it first too.
 */
```

- [ ] **Step 4: Run the page test and the staff tests**

Run: `pnpm test "app/mentor/[slug]/page.test.tsx" components/staff lib/staff`
Expected: PASS.

Run: `pnpm lint app lib/staff/access.ts`
Expected: no problems.

- [ ] **Step 5: Build, and check every page's status**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task2"`), copying in the 18 files above. From `$S`: `pnpm build`, expecting exit 0 with every staff route listed as dynamic (`ƒ`) and no Suspense or generateMetadata error. Start `pnpm start --port 3204` in the background, make `j-session.mjs` as in Task 1, Step 5, and get `STUDENT`, `MENTOR` and `ADMIN`. Then:

```bash
for path in /admin/sellers /admin/sellers/tech-corner /admin/sellers/crochet-corner/decline /admin/sellers/tech-corner/pause \
  /admin/reports /admin/reports/rep-sample /admin/reports/rep-sample/hide /admin/reports/rep-sample/pause \
  /admin/featured /admin/pickup-points /admin/audit /hub/manage /hub/new /hub/h-003/edit /mentor /mentor/tech-corner; do
  out=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3204$path")
  student=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: vossie_session=$STUDENT" "http://localhost:3204$path")
  admin=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: vossie_session=$ADMIN" "http://localhost:3204$path")
  echo "$path signed-out:$out student:$student admin:$admin"
done
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: vossie_session=$MENTOR" http://localhost:3204/admin/sellers
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: vossie_session=$MENTOR" http://localhost:3204/hub/manage
```

Expected: every line says `signed-out:307 student:404`, and `admin:200` except `/admin/reports/rep-sample`, `/admin/reports/rep-sample/hide` and `/admin/reports/rep-sample/pause` (no such report: `admin:404`), `/hub/h-003/edit` (`admin:200`, an admin edits any post) and `/mentor/tech-corner` (`admin:200`). The mentor gets `404` on `/admin/sellers` and `200` on `/hub/manage`. Stop the server.

Then, from `$S`: `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm e2e tests/e2e/staff.spec.ts tests/e2e/routes.spec.ts tests/e2e/staff-checks.spec.ts --project=phone-390 --project=desktop-1440`. Expected: all pass (the layout-shift rows for Overview and the mentor dashboard included: a page that arrives whole has nothing to shift).

- [ ] **Step 6: Hand over**

Files: the 16 pages, `app/mentor/[slug]/page.test.tsx` and `lib/staff/access.ts`. Message:

```
feat: every staff page is a blocking page: the role is checked before anything is returned, so a student or mentor gets a real 404 and a signed-out visitor a real 307 to sign in, on all sixteen of stage G's staff pages (stage J spec decision 15; plan decision 2). StaffSkeleton is no longer used and stays for Lama. curl: every page 307 signed out and 404 for a student
```

---

### Task 3: Types, words, addresses and the `staff-role` icon

Everything later tasks name, with no page changed: the four new audit actions, the `staff` kind and the `account` target, the `staff-role` notification kind and its icon, the new error codes, notices and sentences, the role choices, the new addresses and the staff frame's two new sections. TypeScript's exhaustive records (`ACTIONS` in `audit-words.ts`, `KindIcon`'s `switch`) make the types and their words land in the same task.

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/staff/audit-words.ts`, `lib/staff/audit-words.test.ts`
- Modify: `lib/staff/notices.ts`, `lib/staff/notices.test.ts`
- Modify: `lib/staff/errors.ts`, `lib/staff/errors.test.ts`
- Modify: `lib/staff/notification-text.ts`, `lib/staff/notification-text.test.ts`
- Modify: `lib/staff/paths.ts`, `lib/staff/paths.test.ts`
- Modify: `lib/staff/roles.ts`, `lib/staff/roles.test.ts`
- Modify: `lib/staff/form-state.ts`, `lib/staff/form-state.test.ts`
- Modify: `components/messages/NotificationsView.tsx`, `components/messages/NotificationsView.test.tsx`
- Modify: `components/staff/staff-parts.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `lib/staff/audit-words.test.ts`, add these four to the end of `EVERY_ACTION` (after `"check-in-added",`):

```ts
  "role-given",
  "role-removed",
  "listing-shown",
  "request-shown",
```

and change the first test's title from `"words every action and files it under one of the seven kinds"` to `"words every action and files it under one of the eight kinds"`. Then add at the end of the file:

```ts
describe("staff accounts and Show again (stage J spec decisions 7 and 14)", () => {
  it("words the role changes, filed under Staff accounts, the last kind in the filter", () => {
    expect(auditLabel("role-given")).toBe("Gave a staff role");
    expect(auditLabel("role-removed")).toBe("Removed a staff role");
    expect(auditKindOf("role-given")).toBe("staff");
    expect(auditKindOf("role-removed")).toBe("staff");
    expect(AUDIT_KINDS.at(-1)).toEqual({ kind: "staff", label: "Staff accounts" });
    expect(AUDIT_KINDS.at(-2)?.kind).toBe("mentoring");
  });

  it("words Show again, filed under Reports beside the hides", () => {
    expect(auditLabel("listing-shown")).toBe("Showed a listing again");
    expect(auditLabel("request-shown")).toBe("Showed a request again");
    expect(auditKindOf("listing-shown")).toBe("reports");
    expect(auditKindOf("request-shown")).toBe("reports");
  });

  it("reads kind=staff from the link", () => {
    expect(parseAuditFilter({ kind: "staff" })).toEqual({ staff: null, kind: "staff" });
  });
});
```

In `lib/staff/notices.test.ts`, add at the end:

```ts
describe("staff accounts and Show again (stage J spec decisions 7 and 14)", () => {
  it("words a role given or removed, and a listing or request shown again", () => {
    expect(staffNoticeText("role-given")).toBe("Role given. They've been told, and their tools are on their account page.");
    expect(staffNoticeText("role-removed")).toBe("Role removed. They've been told.");
    expect(staffNoticeText("listing-shown")).toBe("Showing again. Its seller has been told.");
    expect(staffNoticeText("request-shown")).toBe("Showing again. The asker has been told.");
  });
});
```

In `lib/staff/errors.test.ts`, change the import line to

```ts
import { GIVE_ROLE_FIELDS, postFieldIds, staffErrors, staffFieldIds } from "./errors";
```

and add at the end:

```ts
describe("Give a staff role and Remove a role (stage J spec decisions 3 and 5)", () => {
  it("words each of the form's errors, linked to the email or the first role radio", () => {
    expect(
      staffErrors(["staff-email-missing", "staff-role-missing"], GIVE_ROLE_FIELDS).map((error) => [error.message, error.fieldId]),
    ).toEqual([
      ["Enter their Eduvos email.", "give-role-email"],
      ["Choose Mentor or Admin.", "give-role-role-mentor"],
    ]);
    expect(staffErrors(["staff-email-unknown"], GIVE_ROLE_FIELDS)).toEqual([
      {
        message: "No Vossie account uses that email. Ask them to sign in once, then try again.",
        fieldId: "give-role-email",
      },
    ]);
    expect(staffErrors(["staff-role-held"], GIVE_ROLE_FIELDS)).toEqual([
      { message: "That account has that role already.", fieldId: "give-role-role-mentor" },
    ]);
    expect(GIVE_ROLE_FIELDS).toEqual({ email: "give-role-email", role: "give-role-role-mentor" });
  });

  it("words a refused removal, linked to no field", () => {
    expect(staffErrors(["staff-own-admin", "staff-last-admin"], {})).toEqual([
      { message: "You can't remove your own admin role. Ask another admin.", fieldId: null },
      { message: "Vossie needs at least one admin.", fieldId: null },
    ]);
  });
});
```

In `lib/staff/notification-text.test.ts`, add `listingShownText`, `requestShownText` and `staffRoleText` to the import list from `"./notification-text"`, and add at the end:

```ts
describe("staff roles and Show again (stage J spec decisions 7 and 14)", () => {
  it("tells someone given a role where their tools are, and someone who lost one that it has ended", () => {
    expect(staffRoleText("given", "mentor")).toBe(
      "You're a Vossie mentor now. The Hub's tools and the mentor dashboard are on your account page.",
    );
    expect(staffRoleText("given", "admin")).toBe("You're a Vossie admin now. The admin console is on your account page.");
    expect(staffRoleText("removed", "mentor")).toBe(
      "Your mentor role on Vossie has ended. Thank you for helping student sellers.",
    );
    expect(staffRoleText("removed", "admin")).toBe("Your admin role on Vossie has ended.");
  });

  it("tells a seller or an asker the Hub is showing their listing or request again", () => {
    expect(listingShownText("Desk lamp")).toBe("The Hub is showing Desk lamp again. It's back in My listings.");
    expect(requestShownText("Lab coat")).toBe("The Hub is showing your request Lab coat again.");
  });
});
```

In `lib/staff/paths.test.ts`, add `ADMIN_HIDDEN_PATH`, `ADMIN_NUMBERS_PATH`, `ADMIN_STAFF_PATH`, `numbersPath`, `removeRolePath`, `showListingPath` and `showRequestPath` to the import list from `"./paths"`. Replace the third test's title and its expected list:

```ts
  it("lists the frame's sections, the admin console's eight first", () => {
    expect(STAFF_SECTIONS.map((section) => section.label)).toEqual([
      "Overview",
      "Sellers",
      "Reports",
      "Featured",
      "Pickup points",
      "Numbers",
      "Staff",
      "Audit log",
      "Hub posts",
      "Mentoring",
    ]);
    expect(AREA_HOME.hub).toEqual({ href: "/hub/manage", label: "Hub posts and office hours" });
  });
```

and add at the end of the file:

```ts
describe("stage J's addresses (spec section 3)", () => {
  it("puts staff accounts, the numbers and the hidden list under /admin", () => {
    expect(ADMIN_STAFF_PATH).toBe("/admin/staff");
    expect(ADMIN_NUMBERS_PATH).toBe("/admin/numbers");
    expect(ADMIN_HIDDEN_PATH).toBe("/admin/hidden");
    expect(removeRolePath("acc-mentor", "mentor")).toBe("/admin/staff/acc-mentor/remove-mentor");
    expect(removeRolePath("acc-admin", "admin")).toBe("/admin/staff/acc-admin/remove-admin");
    expect(showListingPath("l-001")).toBe("/admin/hidden/listings/l-001");
    expect(showRequestPath("r-001")).toBe("/admin/hidden/requests/r-001");
  });

  it("puts a campus's view of the numbers in the link", () => {
    expect(numbersPath(null)).toBe("/admin/numbers");
    expect(numbersPath("midrand")).toBe("/admin/numbers?campus=midrand");
  });

  it("puts Numbers and Staff after Pickup points and before Audit log, for admins only", () => {
    const admin = STAFF_SECTIONS.filter((section) => section.area === "admin").map((section) => section.href);
    expect(admin.slice(4, 7)).toEqual(["/admin/pickup-points", "/admin/numbers", "/admin/staff"]);
  });
});
```

In `lib/staff/roles.test.ts`, change the import to

```ts
import { canUse, isAdmin, parseStaffRole, ROLE_CHOICES, roleLabel, rolesText, staffAreasOf } from "./roles";
```

and add at the end:

```ts
describe("the roles an admin gives (stage J spec decisions 1 and 3)", () => {
  it("offers the two roles the code has, mentor first, each with what it opens", () => {
    expect(ROLE_CHOICES).toEqual([
      { role: "mentor", label: "Mentor", hint: "The Hub's posts and office hours, and the mentor dashboard" },
      { role: "admin", label: "Admin", hint: "Everything, including this page" },
    ]);
  });

  it("reads a role only from that list, so a forged value is no role", () => {
    expect(parseStaffRole("mentor")).toBe("mentor");
    expect(parseStaffRole("admin")).toBe("admin");
    expect(parseStaffRole("Admin")).toBeNull();
    expect(parseStaffRole("hub-staff")).toBeNull();
    expect(parseStaffRole("")).toBeNull();
  });

  it("words one role, or both, mentor first whatever order they're stored in", () => {
    expect(roleLabel("mentor")).toBe("Mentor");
    expect(roleLabel("admin")).toBe("Admin");
    expect(rolesText(["admin"])).toBe("Admin");
    expect(rolesText(["admin", "mentor"])).toBe("Mentor, Admin");
    expect(rolesText([])).toBe("");
  });
});
```

In `lib/staff/form-state.test.ts`, add `GIVE_ROLE_FORM` and `removeRoleForm` to the import list from `"./form-state"`, and add at the end:

```ts
describe("stage J's form keys (plan decision 9)", () => {
  it("keeps Give a staff role's state under one key, and each removal's under its person and role", () => {
    expect(GIVE_ROLE_FORM).toBe("staff-give-role");
    expect(removeRoleForm("acc-mentor", "mentor")).toBe("staff-remove:acc-mentor:mentor");
    expect(removeRoleForm("acc-admin", "admin")).toBe("staff-remove:acc-admin:admin");
  });
});
```

In `components/messages/NotificationsView.test.tsx`, add at the end of the file:

```ts
describe("a staff role given or taken away (stage J spec decision 7)", () => {
  it("draws it with the shield, hidden from screen readers", () => {
    const { container } = render(
      <NotificationsView
        now={NOW}
        items={[item({ kind: "staff-role", text: "You're a Vossie mentor now.", href: "/account" })]}
      />,
    );
    const icon = container.querySelector("svg.notes-icon")!;
    const shield = render(<ShieldIcon className="notes-icon" />).container.querySelector("svg")!;
    expect(icon.innerHTML).toBe(shield.innerHTML);
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: /You're a Vossie mentor now\./ })).toHaveAttribute("href", "/account");
  });
});
```

In `components/staff/staff-parts.test.tsx`, in "gives an admin every section, and shows the last action's notice as a status line (spec 4)", change `toHaveLength(8)` to `toHaveLength(10)`.

Run: `pnpm test lib/staff components/messages/NotificationsView.test.tsx components/staff/staff-parts.test.tsx`
Expected: FAIL: the new names aren't exported (`GIVE_ROLE_FIELDS`, `staffRoleText`, `ROLE_CHOICES`, `GIVE_ROLE_FORM`, the paths), `auditLabel("role-given")` throws, the sections are eight, and the staff-role row has no icon.

- [ ] **Step 2: The types**

In `lib/types.ts`:
- in `NotificationKind`, replace `  | "search-match";` with:

```ts
  | "search-match"
  | "staff-role";
```

and add this line to the end of the doc comment above it, before ` */`:

```ts
 * Staff accounts add a staff role given or taken away (stage J spec decision 7).
```

- in `AuditAction`, replace `  | "check-in-added";` with:

```ts
  | "check-in-added"
  | "role-given"
  | "role-removed"
  | "listing-shown"
  | "request-shown";
```

- replace the `AuditKind` line with:

```ts
export type AuditKind =
  | "shops"
  | "reports"
  | "featured"
  | "pickup-points"
  | "posts"
  | "office-hours"
  | "mentoring"
  | "staff";
```

- replace the `AuditTargetKind` line with:

```ts
export type AuditTargetKind = "shop" | "listing" | "report" | "pickup-point" | "post" | "booking" | "request" | "account";
```

- [ ] **Step 3: The log's words**

In `lib/staff/audit-words.ts`, add after `  "check-in-added": { label: "Added a check-in", kind: "mentoring" },`:

```ts
  // Stage J: staff accounts (spec decision 7), and Show again beside the hides (spec decision 14).
  "role-given": { label: "Gave a staff role", kind: "staff" },
  "role-removed": { label: "Removed a staff role", kind: "staff" },
  "listing-shown": { label: "Showed a listing again", kind: "reports" },
  "request-shown": { label: "Showed a request again", kind: "reports" },
```

and add after `  { kind: "mentoring", label: "Mentoring" },`:

```ts
  { kind: "staff", label: "Staff accounts" },
```

- [ ] **Step 4: The notices and the errors**

In `lib/staff/notices.ts`, add after `  ["check-in-added", "Check-in saved."],`:

```ts
  // Stage J (spec decisions 7 and 14).
  ["role-given", "Role given. They've been told, and their tools are on their account page."],
  ["role-removed", "Role removed. They've been told."],
  ["listing-shown", "Showing again. Its seller has been told."],
  ["request-shown", "Showing again. The asker has been told."],
```

In `lib/staff/errors.ts`, add before the comment `  // The Hub's post editor (lib/staff/post-rules.ts), in the form's order.`:

```ts
  // Give a staff role (stage J spec decision 3), in the form's order, and a refused removal (spec decision 5).
  ["staff-email-missing", { message: "Enter their Eduvos email.", field: "email" }],
  [
    "staff-email-unknown",
    { message: "No Vossie account uses that email. Ask them to sign in once, then try again.", field: "email" },
  ],
  ["staff-role-missing", { message: "Choose Mentor or Admin.", field: "role" }],
  ["staff-role-held", { message: "That account has that role already.", field: "role" }],
  ["staff-own-admin", { message: "You can't remove your own admin role. Ask another admin.", field: "none" }],
  ["staff-last-admin", { message: "Vossie needs at least one admin.", field: "none" }],
```

and add at the end of the file:

```ts
/**
 * Give a staff role's field ids (stage J plan decision 9). One form on one page, so no prefix by thing. The role's
 * error goes to its first radio.
 */
export const GIVE_ROLE_FIELDS = { email: "give-role-email", role: "give-role-role-mentor" } as const;
```

- [ ] **Step 5: The sentences**

In `lib/staff/notification-text.ts`, add at the top, before the first comment:

```ts
import type { StaffRole } from "@/lib/types";

```

and add at the end:

```ts
/** A staff role given or taken away, with the "staff-role" kind (stage J spec decision 7). */
export function staffRoleText(change: "given" | "removed", role: StaffRole): string {
  if (change === "given") {
    return role === "mentor"
      ? "You're a Vossie mentor now. The Hub's tools and the mentor dashboard are on your account page."
      : "You're a Vossie admin now. The admin console is on your account page.";
  }
  return role === "mentor"
    ? "Your mentor role on Vossie has ended. Thank you for helping student sellers."
    : "Your admin role on Vossie has ended.";
}

/** A hidden listing shown again, for its seller, with the "shop-update" kind (stage J spec decision 14). */
export function listingShownText(title: string): string {
  return `The Hub is showing ${title} again. It's back in My listings.`;
}

/** A hidden request shown again, for its asker, with the "request-update" kind (stage J spec decision 14). */
export function requestShownText(title: string): string {
  return `The Hub is showing your request ${title} again.`;
}
```

- [ ] **Step 6: The addresses and the frame's sections**

In `lib/staff/paths.ts`, change the first import to:

```ts
import type { AuditKind, StaffArea, StaffRole } from "@/lib/types";
```

add after `export const ADMIN_AUDIT_PATH = "/admin/audit";`:

```ts
export const ADMIN_NUMBERS_PATH = "/admin/numbers";
export const ADMIN_STAFF_PATH = "/admin/staff";
export const ADMIN_HIDDEN_PATH = "/admin/hidden";
```

add after `export const mentorShopPath = (slug: string) => \`/mentor/${slug}\`;`:

```ts
/** A role's confirm page (stage J spec decision 4). */
export const removeRolePath = (accountId: string, role: StaffRole) => `/admin/staff/${accountId}/remove-${role}`;
/** Show again's confirm pages (stage J spec decision 14). */
export const showListingPath = (id: string) => `/admin/hidden/listings/${id}`;
export const showRequestPath = (id: string) => `/admin/hidden/requests/${id}`;

/** The numbers, or one campus's view of them (stage J spec decision 12): a query, not a route. */
export function numbersPath(campusSlug: string | null): string {
  return campusSlug ? `${ADMIN_NUMBERS_PATH}?campus=${encodeURIComponent(campusSlug)}` : ADMIN_NUMBERS_PATH;
}
```

and in `STAFF_SECTIONS`, add after `  { href: ADMIN_POINTS_PATH, label: "Pickup points", area: "admin" },`:

```ts
  { href: ADMIN_NUMBERS_PATH, label: "Numbers", area: "admin" },
  { href: ADMIN_STAFF_PATH, label: "Staff", area: "admin" },
```

and change the comment above `STAFF_SECTIONS` from "the admin console's six sections" to "the admin console's eight sections".

- [ ] **Step 7: The role choices and the form keys**

In `lib/staff/roles.ts`, add at the end:

```ts
/** The roles an admin can give, in the form's order, with what each opens (stage J spec decisions 1 and 3). */
export const ROLE_CHOICES: ReadonlyArray<{ role: StaffRole; label: string; hint: string }> = [
  { role: "mentor", label: "Mentor", hint: "The Hub's posts and office hours, and the mentor dashboard" },
  { role: "admin", label: "Admin", hint: "Everything, including this page" },
];

/** A role from a form, only from the fixed list: anything else, a forged value included, is null (spec section 5). */
export function parseStaffRole(raw: string): StaffRole | null {
  return ROLE_CHOICES.find((choice) => choice.role === raw)?.role ?? null;
}

/** "Mentor" or "Admin", as the staff list, the audit log and the confirm pages write it. */
export function roleLabel(role: StaffRole): string {
  return role === "mentor" ? "Mentor" : "Admin";
}

/** "Mentor", "Admin" or "Mentor, Admin": always in the form's order (spec decision 2). */
export function rolesText(roles: readonly StaffRole[]): string {
  return ROLE_CHOICES.filter((choice) => roles.includes(choice.role))
    .map((choice) => choice.label)
    .join(", ");
}
```

In `lib/staff/form-state.ts`, add after `export const slotForm = (postId: string) => \`slot:${postId}\`;`:

```ts
/** Give a staff role (stage J spec decision 3): one form, its errors and typed email. */
export const GIVE_ROLE_FORM = "staff-give-role";
/** A role's confirm page: a refusal (your own admin role, the last admin) shows there (stage J spec decision 5). */
export const removeRoleForm = (accountId: string, role: "mentor" | "admin") => `staff-remove:${accountId}:${role}`;
```

- [ ] **Step 8: The shield for a role change**

In `components/messages/NotificationsView.tsx`, add after the `case "search-match":` lines:

```tsx
    case "staff-role":
      return <ShieldIcon className="notes-icon" />;
```

and add this line to the end of `KindIcon`'s doc comment, before ` */`:

```tsx
 * Staff accounts add "staff-role", drawn with the shield like the Hub's other word about you (stage J spec decision 7).
```

- [ ] **Step 9: Run the tests**

Run: `pnpm test lib/staff components/messages/NotificationsView.test.tsx components/staff/staff-parts.test.tsx`
Expected: PASS.

Run: `pnpm lint lib/types.ts lib/staff components/messages`
Expected: no problems.

- [ ] **Step 10: Typecheck and the whole suite, in a scratch copy**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task3"`), copying in every file this task changed. From `$S`: `pnpm typecheck`, `pnpm test`, `pnpm lint`.
Expected: no type errors (every `Record<AuditAction, …>` and the icon's `switch` are complete); all tests pass.

- [ ] **Step 11: Hand over**

Files: `lib/types.ts`, `lib/staff/audit-words.ts`, `lib/staff/audit-words.test.ts`, `lib/staff/notices.ts`, `lib/staff/notices.test.ts`, `lib/staff/errors.ts`, `lib/staff/errors.test.ts`, `lib/staff/notification-text.ts`, `lib/staff/notification-text.test.ts`, `lib/staff/paths.ts`, `lib/staff/paths.test.ts`, `lib/staff/roles.ts`, `lib/staff/roles.test.ts`, `lib/staff/form-state.ts`, `lib/staff/form-state.test.ts`, `components/messages/NotificationsView.tsx`, `components/messages/NotificationsView.test.tsx`, `components/staff/staff-parts.test.tsx`. Message:

```
feat: stage J's words and types: the role-given, role-removed, listing-shown and request-shown audit actions with the Staff accounts kind and the account target, the staff-role notification drawn with the shield, the Give a staff role errors and notices, the role and Show again sentences, the role choices, and the Numbers and Staff sections in the staff frame (stage J spec decisions 1 to 7 and 14; plan decisions 6 and 9)
```

---

### Task 4: `approvedAt`, the store's version, and staff accounts' data

The data the staff page and the numbers stand on. `approveShop` records the first approval; Sipho's sample profile has one; the shop export says it. `lib/data/staff-accounts.ts` lists everyone with a role, gives a role by exact email, removes one (never your own admin role, never the last admin, and a mentor's shops lose their mentor), and counts admins.

**Files:**
- Modify: `lib/data/rows.ts`, `lib/data/store.ts`, `data/fixtures/accounts.ts`
- Modify: `lib/data/staff-shops.ts`, `lib/data/staff-shops.test.ts`, `lib/data/staff-reports.test.ts`
- Modify: `lib/staff/admin-actions.ts` (one line), `lib/staff/admin-actions.test.ts`
- Modify: `lib/data/shops.ts`, `lib/data/shops.test.ts`
- Create: `lib/data/staff-accounts.ts`, `lib/data/staff-accounts.test.ts`

- [ ] **Step 1: Write the failing tests**

In `lib/data/staff-shops.test.ts`, change every call `approveShop(<slug>, <owner>)` to pass the time as a third argument: `approveShop("crochet-corner", "acc-pending", NOW)`, and the same for every other call in the file (lines 82, 90, 91, 92, 112, 121, 125 and 126 at HEAD). Then add to the describe "approving and declining (staff tools spec 2.3, plan decision 2)":

```ts
  it("records when a shop was first approved, not declined, and keeps it through a pause (stage J spec section 4)", async () => {
    // A decline records no approval.
    await declineShop("crochet-corner", "acc-pending", "Add a photo of your work.", NOW);
    expect(sampleStore().sellerProfiles.get("acc-pending")?.approvedAt).toBeUndefined();
    await resendForApproval("acc-pending", NOW);
    await approveShop("crochet-corner", "acc-pending", LATER);
    expect(sampleStore().sellerProfiles.get("acc-pending")?.approvedAt).toBe(LATER.toISOString());
    // The Hub's pause and resume don't approve it again.
    await staffPauseShop("crochet-corner", "Checking it.");
    await staffResumeShop("crochet-corner");
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      status: "approved",
      approvedAt: LATER.toISOString(),
    });
  });

  it("seeds Sipho's open shop with its start as its approval, and Lerato's waiting one with none (stage J plan decision 4)", () => {
    expect(sampleStore().sellerProfiles.get("acc-seller")?.approvedAt).toBe("2026-03-01T08:00:00.000Z");
    expect(sampleStore().sellers.get("tech-corner")?.createdAt).toBe("2026-03-01T08:00:00.000Z");
    expect(sampleStore().sellerProfiles.get("acc-pending")?.approvedAt).toBeUndefined();
  });
```

In `lib/data/staff-reports.test.ts`, change `await approveShop("tech-corner", "acc-mentor");` to `await approveShop("tech-corner", "acc-mentor", new Date("2026-10-14T08:42:00.000Z"));`.

In `lib/data/shops.test.ts`, in "gives the shop and its listings, with pickup points by name and photos by address, and no ids", add `approvedAt: "2026-03-01T08:00:00.000Z",` after `status: "approved",` inside the `toMatchObject` for `data.shop`.

Create `lib/data/staff-accounts.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createAccount } from "./accounts";
import { countAdmins, getStaffAccount, giveRole, listStaffAccounts, removeRole } from "./staff-accounts";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-20T08:00:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

/** A student who has signed in once (stage J spec decision 3: no account, no role). */
async function zola() {
  return createAccount({ email: "zola@eduvos.com", firstName: "Zola", campusSlug: "pretoria", now: NOW });
}

describe("who has a role (stage J spec decision 2)", () => {
  it("lists everyone with a role and no one else, by first name then email, with the shops each mentors", async () => {
    const people = await listStaffAccounts();
    expect(people).toEqual([
      {
        id: "acc-mentor",
        firstName: "Naledi",
        email: "mentor@eduvos.com",
        campusSlug: "midrand",
        roles: ["mentor"],
        mentors: ["Tech corner"],
      },
      {
        id: "acc-admin",
        firstName: "Pieter",
        email: "admin@eduvos.com",
        campusSlug: "pretoria",
        roles: ["admin"],
        mentors: [],
      },
    ]);
    // Students without a role never appear, in any form.
    expect(JSON.stringify(people)).not.toMatch(/student@|seller@|pending@/);
  });

  it("sorts two people with the same first name by email, and writes roles mentor first", async () => {
    const other = await createAccount({ email: "a-naledi@eduvos.com", firstName: "Naledi", campusSlug: "midrand", now: NOW });
    sampleStore().accounts.get(other.id)!.roles = ["admin", "mentor"];
    const people = await listStaffAccounts();
    expect(people.map((person) => person.email)).toEqual(["a-naledi@eduvos.com", "mentor@eduvos.com", "admin@eduvos.com"]);
    expect(people[0].roles).toEqual(["mentor", "admin"]);
  });

  it("reads one person with a role, and nobody without one", async () => {
    expect(await getStaffAccount("acc-mentor")).toMatchObject({ firstName: "Naledi", mentors: ["Tech corner"] });
    expect(await getStaffAccount("acc-student")).toBeNull();
    expect(await getStaffAccount("acc-nobody")).toBeNull();
  });

  it("counts the admins", async () => {
    expect(await countAdmins()).toBe(1);
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    expect(await countAdmins()).toBe(2);
  });
});

describe("giving a role by exact email (stage J spec decisions 3 and 6)", () => {
  it("gives the role to the account with that email, whatever its case and spaces, and changes nothing else", async () => {
    const account = await zola();
    const before = structuredClone(sampleStore());
    expect(await giveRole("  ZOLA@Eduvos.com ", "mentor")).toEqual({ id: account.id, firstName: "Zola" });
    expect(sampleStore().accounts.get(account.id)?.roles).toEqual(["mentor"]);
    // Only the roles changed: no session, shop, notification or other account.
    sampleStore().accounts.get(account.id)!.roles = [];
    expect(sampleStore()).toEqual(before);
  });

  it("adds a second role in the fixed order", async () => {
    expect(await giveRole("admin@eduvos.com", "mentor")).toEqual({ id: "acc-admin", firstName: "Pieter" });
    expect(sampleStore().accounts.get("acc-admin")?.roles).toEqual(["mentor", "admin"]);
  });

  it("refuses an email no account uses, and never makes one", async () => {
    const accounts = sampleStore().accounts.size;
    expect(await giveRole("nobody@eduvos.com", "admin")).toBe("no-account");
    expect(await giveRole("", "admin")).toBe("no-account");
    expect(sampleStore().accounts.size).toBe(accounts);
  });

  it("says when the account has that role already", async () => {
    expect(await giveRole("mentor@eduvos.com", "mentor")).toBe("held");
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
  });
});

describe("taking a role away (stage J spec decisions 5 and 6)", () => {
  it("removes a mentor role, clears that mentor from every shop, and keeps their notes, check-ins and posts", async () => {
    const notes = [...sampleStore().mentorNotes.values()].filter((row) => row.authorId === "acc-mentor").length;
    const posts = [...sampleStore().hubPosts.values()].filter((row) => row.authorId === "acc-mentor").length;
    expect(notes).toBeGreaterThan(0);
    expect(await removeRole("acc-mentor", "mentor", "acc-admin")).toEqual({
      id: "acc-mentor",
      firstName: "Naledi",
      role: "mentor",
      unassigned: ["Tech corner"],
    });
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual([]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect([...sampleStore().mentorNotes.values()].filter((row) => row.authorId === "acc-mentor")).toHaveLength(notes);
    expect([...sampleStore().hubPosts.values()].filter((row) => row.authorId === "acc-mentor")).toHaveLength(posts);
  });

  it("lets a mentor remove their own mentor role", async () => {
    expect(await removeRole("acc-mentor", "mentor", "acc-mentor")).toMatchObject({ role: "mentor" });
  });

  it("never removes your own admin role", async () => {
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    expect(await removeRole("acc-admin", "admin", "acc-admin")).toBe("own-admin");
    expect(sampleStore().accounts.get("acc-admin")?.roles).toEqual(["admin"]);
  });

  it("never removes the last admin, even when another id asks", async () => {
    expect(await removeRole("acc-admin", "admin", "acc-mentor")).toBe("last-admin");
    expect(sampleStore().accounts.get("acc-admin")?.roles).toEqual(["admin"]);
  });

  it("removes another admin's role while one is left", async () => {
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    expect(await removeRole("acc-mentor", "admin", "acc-admin")).toEqual({
      id: "acc-mentor",
      firstName: "Naledi",
      role: "admin",
      unassigned: [],
    });
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
    // Removing an admin role leaves the shops they mentor alone.
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
  });

  it("changes nothing for a role already gone or an unknown account", async () => {
    expect(await removeRole("acc-student", "mentor", "acc-admin")).toBeNull();
    expect(await removeRole("acc-nobody", "admin", "acc-admin")).toBeNull();
  });
});
```

Run: `pnpm test lib/data/staff-accounts.test.ts lib/data/staff-shops.test.ts lib/data/shops.test.ts`
Expected: FAIL: `./staff-accounts` doesn't exist, `approvedAt` is never set, and Sipho's profile has none.

- [ ] **Step 2: The field and the store's version**

In `lib/data/rows.ts`, in `SellerProfileRow`, add after `  mentorId?: string | null;`:

```ts
  /**
   * When the Hub first approved the shop (stage J spec section 4), for the admin's numbers. Set once by approveShop and
   * kept through pauses and resumes. Absent or null until then.
   */
  approvedAt?: string | null;
```

In `lib/data/store.ts`, change `export const STORE_VERSION = 8;` to `export const STORE_VERSION = 9;`.

In `data/fixtures/accounts.ts`, in Sipho's `seller`, add after `      mentorId: "acc-mentor",`:

```ts
      // Tech corner's start, as its first approval, for the admin's numbers (stage J plan decision 4).
      approvedAt: "2026-03-01T08:00:00.000Z",
```

- [ ] **Step 3: `approveShop` records the first approval**

In `lib/data/staff-shops.ts`, replace `approveShop`:

```ts
/**
 * Approve (spec 2.3): a waiting shop opens, with its storefront at its link (selling plan decision 1). `ownerId` is the
 * owner on the page the Hub reviewed.
 */
export async function approveShop(slug: string, ownerId: string): Promise<ShopDecision | null> {
  const shop = owned(slug);
  if (!shop || !reviewed(shop, ownerId) || shop.profile.status !== "pending" || shop.profile.declinedAt) return null;
  Object.assign(shop.profile, {
    status: "approved",
    sellerSlug: shop.row.slug,
    declinedAt: null,
    pausedBy: null,
    staffReason: null,
  });
  return decided(shop.row);
}
```

with:

```ts
/**
 * Approve (spec 2.3): a waiting shop opens, with its storefront at its link (selling plan decision 1). `ownerId` is the
 * owner on the page the Hub reviewed. The first approval's time is kept for the admin's numbers (stage J spec
 * section 4).
 */
export async function approveShop(slug: string, ownerId: string, now: Date): Promise<ShopDecision | null> {
  const shop = owned(slug);
  if (!shop || !reviewed(shop, ownerId) || shop.profile.status !== "pending" || shop.profile.declinedAt) return null;
  Object.assign(shop.profile, {
    status: "approved",
    sellerSlug: shop.row.slug,
    declinedAt: null,
    pausedBy: null,
    staffReason: null,
    approvedAt: shop.profile.approvedAt ?? now.toISOString(),
  });
  return decided(shop.row);
}
```

In `lib/staff/admin-actions.ts`, in `approveSeller`, change `const decision = slug && owner ? await approveShop(slug, owner) : null;` to `const decision = slug && owner ? await approveShop(slug, owner, now) : null;`. (`now` is already declared on the line above it.)

- [ ] **Step 4: The export says when the shop was approved**

In `lib/data/shops.ts`, in `ShopExport`, add after `  status: SellerStatus;`:

```ts
  /** When the Hub first approved it, or null (stage J plan decision 4). */
  approvedAt: string | null;
```

and in `exportShop`, add after `      status,`:

```ts
      approvedAt: sampleStore().sellerProfiles.get(accountId)?.approvedAt ?? null,
```

- [ ] **Step 5: Staff accounts' data**

Create `lib/data/staff-accounts.ts`:

```ts
import { normaliseEmail } from "@/lib/auth/email";
import type { StaffRole } from "@/lib/types";
import type { AccountRow } from "./rows";
import { sampleStore } from "./store";

// Staff accounts (stage J spec decisions 1 to 6): who holds the mentor or admin role, giving one by exact email, and
// taking one away. Roles live on the account row, which getViewer() reads on every request, so a change shows on the
// person's next page; their sessions aren't touched. Students without a role are never listed, searched or suggested
// (POPIA section 10). Only Server Actions call the writes. Nothing here awaits between a check and its write, so in
// sample mode two admins removing each other can't both pass the last-admin check; the real backend needs a
// transaction or a trigger (a go-live item).

/** Someone with a role, as /admin/staff lists them (spec decision 2). */
export type StaffAccount = {
  id: string;
  firstName: string;
  /** Lower case. Shown because roles are given by email and two staff may share a first name. */
  email: string;
  /** Their own campus, chosen at sign-in: information only, roles aren't tied to it (spec decision 1). */
  campusSlug: string;
  /** Mentor first, then admin. */
  roles: StaffRole[];
  /** The names of the shops they mentor, by name. */
  mentors: string[];
};

/** A role given (spec decision 3): who to tell and name in the log. */
export type GivenRole = { id: string; firstName: string };

/** A role taken away, and the shops a mentor leaves without a mentor (spec decisions 6 and 7). */
export type RemovedRole = { id: string; firstName: string; role: StaffRole; unassigned: string[] };

/** Roles are stored in this order, so "Mentor, Admin" always reads the same (plan decision 5). */
const ROLE_ORDER: readonly StaffRole[] = ["mentor", "admin"];

function mentoredShopNames(accountId: string): string[] {
  const { sellerProfiles, sellers } = sampleStore();
  const owners = new Set(
    [...sellerProfiles.values()].filter((profile) => profile.mentorId === accountId).map((profile) => profile.accountId),
  );
  return [...sellers.values()]
    .filter((row) => row.ownerId !== null && owners.has(row.ownerId))
    .map((row) => row.name)
    .sort((a, b) => a.localeCompare(b));
}

function toStaff(row: AccountRow): StaffAccount {
  return {
    id: row.id,
    firstName: row.firstName,
    email: row.email,
    campusSlug: row.campusSlug,
    roles: ROLE_ORDER.filter((role) => row.roles.includes(role)),
    mentors: mentoredShopNames(row.id),
  };
}

const adminRows = () => [...sampleStore().accounts.values()].filter((row) => row.roles.includes("admin"));

/** Everyone with a role, and no one else, by first name, then email (spec decision 2). */
export async function listStaffAccounts(): Promise<StaffAccount[]> {
  return [...sampleStore().accounts.values()]
    .filter((row) => row.roles.length > 0)
    .map(toStaff)
    .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.email.localeCompare(b.email));
}

/** One person with a role, for a confirm page (plan decision 5). Null for an unknown account or one with no role. */
export async function getStaffAccount(id: string): Promise<StaffAccount | null> {
  const row = sampleStore().accounts.get(id);
  return row && row.roles.length > 0 ? toStaff(row) : null;
}

/** How many accounts hold the admin role, for privacy settings' "only admin" line (spec decision 8). */
export async function countAdmins(): Promise<number> {
  return adminRows().length;
}

/**
 * Gives `role` to the account with exactly this email (spec decision 3): trimmed and lower case, the lookup sign-in
 * uses, never a search. "no-account" when none has it (giving a role never makes an account), "held" when it has the
 * role already.
 */
export async function giveRole(email: string, role: StaffRole): Promise<GivenRole | "no-account" | "held"> {
  const wanted = normaliseEmail(email);
  const row = wanted === "" ? undefined : [...sampleStore().accounts.values()].find((item) => item.email === wanted);
  if (!row) return "no-account";
  if (row.roles.includes(role)) return "held";
  row.roles = ROLE_ORDER.filter((item) => item === role || row.roles.includes(item));
  return { id: row.id, firstName: row.firstName };
}

/**
 * Takes `role` away from `accountId`, asked by the admin `byId` (spec decisions 5 and 6). Never your own admin role
 * ("own-admin"), never the last admin ("last-admin"). A mentor's shops lose their mentor, as deleting the account does
 * (lib/data/staff-privacy.ts); their notes, check-ins and Hub posts stay. Null when there's no such role to take.
 */
export async function removeRole(
  accountId: string,
  role: StaffRole,
  byId: string,
): Promise<RemovedRole | "own-admin" | "last-admin" | null> {
  const store = sampleStore();
  const row = store.accounts.get(accountId);
  if (!row || !row.roles.includes(role)) return null;
  if (role === "admin" && accountId === byId) return "own-admin";
  if (role === "admin" && adminRows().length <= 1) return "last-admin";
  const unassigned = role === "mentor" ? mentoredShopNames(accountId) : [];
  if (role === "mentor") {
    for (const profile of store.sellerProfiles.values()) {
      if (profile.mentorId === accountId) profile.mentorId = null;
    }
  }
  row.roles = row.roles.filter((item) => item !== role);
  return { id: row.id, firstName: row.firstName, role, unassigned };
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm test lib/data lib/staff/admin-actions.test.ts`
Expected: PASS. The store test "reseeds a store left behind by an older version…" still passes with version 9.

Run: `pnpm lint lib/data data/fixtures lib/staff/admin-actions.ts`
Expected: no problems.

- [ ] **Step 7: Typecheck and the whole suite, in a scratch copy**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task4"`), copying in this task's files. From `$S`: `pnpm typecheck`, `pnpm test`, `pnpm lint`. Expected: clean, all passing. (`approveShop`'s callers are all listed above; a missed one is a type error here.)

- [ ] **Step 8: Hand over**

Files: `lib/data/rows.ts`, `lib/data/store.ts`, `data/fixtures/accounts.ts`, `lib/data/staff-shops.ts`, `lib/data/staff-shops.test.ts`, `lib/data/staff-reports.test.ts`, `lib/staff/admin-actions.ts`, `lib/data/shops.ts`, `lib/data/shops.test.ts`, `lib/data/staff-accounts.ts`, `lib/data/staff-accounts.test.ts`. Message:

```
feat: a shop's first approval is recorded (approvedAt, seeded on Sipho's Tech corner, in the shop export), STORE_VERSION 9, and staff accounts' data: everyone with a role listed by name, a role given only by exact email, a role taken away never from your own admin or the last admin, a mentor's shops left without one, and the admins counted (stage J spec sections 2 and 4; plan decisions 4 and 5)
```

---

### Task 5: The numbers' rules: SAST weeks and the small-number rule

Pure functions, with no store and no page: the two complete SAST weeks before `now` (Monday 00:00 to Sunday 24:00, South African time), the seven measures and their kind, `protectCounts` (spec 2.13's four rules) and the words for each figure. Every other part of the numbers reads these.

**Files:**
- Create: `lib/staff/numbers.ts`, `lib/staff/numbers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/staff/numbers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  changeText,
  HIDDEN,
  MEASURES,
  NO_CHANGE,
  parseNumbersCampus,
  protectCounts,
  sastWeeks,
  sinceText,
  UNDER_FIVE,
  type Measure,
  type Period,
  type RawColumn,
  type RawCounts,
} from "./numbers";

const SLUGS = ["a", "b", "c"];

const column = (campuses: Record<string, number> = {}, gone = 0): RawColumn => ({ campuses, gone });

/** Raw counts that are 0 everywhere but the columns given. */
function raw(
  set: Partial<Record<Measure, Partial<Record<Period, RawColumn>>>> = {},
  openShops: RawColumn = column(),
): RawCounts {
  const counts = Object.fromEntries(
    MEASURES.map(({ measure }) => [
      measure,
      { last: column(), before: column(), since: column(), ...set[measure] },
    ]),
  ) as Record<Measure, Record<Period, RawColumn>>;
  return { counts, openShops };
}

describe("fixed SAST weeks, Monday to Sunday (stage J spec decision 11)", () => {
  it("ends last week at Sunday 24:00 in South Africa: 21:59:59 UTC is still the week before's Sunday", () => {
    const weeks = sastWeeks(new Date("2026-10-18T21:59:59.000Z"));
    expect(weeks.last).toEqual({
      start: "2026-10-04T22:00:00.000Z",
      end: "2026-10-11T22:00:00.000Z",
      label: "5 to 11 Oct",
    });
    expect(weeks.before).toEqual({
      start: "2026-09-27T22:00:00.000Z",
      end: "2026-10-04T22:00:00.000Z",
      label: "28 Sep to 4 Oct",
    });
  });

  it("starts a new week at 22:00 UTC on Sunday, which is Monday 00:00 in South Africa", () => {
    const weeks = sastWeeks(new Date("2026-10-18T22:00:00.000Z"));
    expect(weeks.last).toEqual({
      start: "2026-10-11T22:00:00.000Z",
      end: "2026-10-18T22:00:00.000Z",
      label: "12 to 18 Oct",
    });
    expect(weeks.before.label).toBe("5 to 11 Oct");
  });

  it("gives the same weeks all through a week, Monday to Sunday", () => {
    const monday = sastWeeks(new Date("2026-10-19T08:00:00.000Z"));
    const sunday = sastWeeks(new Date("2026-10-25T12:00:00.000Z"));
    expect(monday).toEqual(sunday);
    expect(monday.last.label).toBe("12 to 18 Oct");
  });
});

describe("the measures (stage J spec decision 10)", () => {
  it("lists the seven, public ones first, and never saved searches", () => {
    expect(MEASURES.map(({ label, isPrivate }) => [label, isPrivate])).toEqual([
      ["Listings published", false],
      ["Shops approved", false],
      ["Looking For requests posted", false],
      ["Enquiries started", true],
      ["Reports made", true],
      ["Reports closed", true],
      ["Shops followed", true],
    ]);
    expect(JSON.stringify(MEASURES)).not.toMatch(/search/i);
  });
});

describe("the small-number rule (stage J spec decision 13)", () => {
  it("shows 0 as 0, and 1 to 4 of a private count as Under 5", () => {
    const shown = protectCounts(raw({ enquiries: { last: column({ b: 3, c: 2 }) } }), SLUGS);
    expect(shown.counts.enquiries.last).toEqual({
      campuses: { a: "0", b: UNDER_FIVE, c: UNDER_FIVE },
      total: "5",
    });
  });

  it("hides the next-smallest campus when one campus is under 5 and the total is shown", () => {
    const shown = protectCounts(raw({ "reports-made": { last: column({ a: 3, b: 20, c: 7 }) } }), SLUGS);
    expect(shown.counts["reports-made"].last).toEqual({
      campuses: { a: UNDER_FIVE, b: "20", c: HIDDEN },
      total: "30",
    });
  });

  it("hides the first of two equal next-smallest campuses", () => {
    const shown = protectCounts(raw({ follows: { before: column({ a: 3, b: 7, c: 7 }) } }), SLUGS);
    expect(shown.counts.follows.before.campuses).toEqual({ a: UNDER_FIVE, b: HIDDEN, c: "7" });
  });

  it("hides nothing more when the rest is on a campus that has gone, which only the total counts", () => {
    const shown = protectCounts(raw({ enquiries: { last: column({ a: 3 }, 4) } }), SLUGS);
    expect(shown.counts.enquiries.last).toEqual({ campuses: { a: UNDER_FIVE, b: "0", c: "0" }, total: "7" });
  });

  it("shows a total under 5 as Under 5, with nothing else to hide", () => {
    const shown = protectCounts(raw({ "reports-closed": { last: column({ a: 2 }) } }), SLUGS);
    expect(shown.counts["reports-closed"].last).toEqual({ campuses: { a: UNDER_FIVE, b: "0", c: "0" }, total: UNDER_FIVE });
  });

  it("shows Change only where both weeks are shown, signed", () => {
    const shown = protectCounts(
      raw({ enquiries: { last: column({ a: 12, b: 0, c: 9 }), before: column({ a: 3, b: 0, c: 11 }) } }),
      SLUGS,
    );
    // a's week before is Under 5 and c's is Hidden by the rule, so neither change can be shown; b's is 0 both weeks.
    expect(shown.counts.enquiries.before.campuses).toEqual({ a: UNDER_FIVE, b: "0", c: HIDDEN });
    expect(shown.counts.enquiries.change).toEqual({ campuses: { a: NO_CHANGE, b: "0", c: NO_CHANGE }, total: "+7" });
  });

  it("rounds a private Since the start down to tens", () => {
    const shown = protectCounts(raw({ follows: { since: column({ a: 0, b: 7, c: 23 }) } }), SLUGS);
    expect(shown.counts.follows.since).toEqual({ campuses: { a: "0", b: "Under 10", c: "20+" }, total: "30+" });
  });

  it("shows public counts exactly, with their change, and open shops exactly", () => {
    const shown = protectCounts(
      raw({ listings: { last: column({ a: 1, b: 2 }), before: column({ a: 4 }), since: column({ a: 9, b: 2 }, 1) } }, column({ a: 2, c: 1 })),
      SLUGS,
    );
    expect(shown.counts.listings.last).toEqual({ campuses: { a: "1", b: "2", c: "0" }, total: "3" });
    expect(shown.counts.listings.change).toEqual({ campuses: { a: "−3", b: "+2", c: "0" }, total: "−1" });
    expect(shown.counts.listings.since).toEqual({ campuses: { a: "9", b: "2", c: "0" }, total: "12" });
    expect(shown.openShops).toEqual({ campuses: { a: "2", b: "0", c: "1" }, total: "3" });
  });
});

describe("the words for a figure", () => {
  it("signs a change with a plus or a minus sign, and 0 as 0", () => {
    expect(changeText(3)).toBe("+3");
    expect(changeText(-2)).toBe("−2");
    expect(changeText(0)).toBe("0");
  });

  it("rounds down to tens", () => {
    expect(sinceText(0)).toBe("0");
    expect(sinceText(1)).toBe("Under 10");
    expect(sinceText(9)).toBe("Under 10");
    expect(sinceText(10)).toBe("10+");
    expect(sinceText(19)).toBe("10+");
    expect(sinceText(120)).toBe("120+");
  });
});

describe("the campus view's link (stage J spec decision 12)", () => {
  it("reads a known campus from the link, and anything else as the main page", () => {
    expect(parseNumbersCampus({ campus: "b" }, SLUGS)).toBe("b");
    expect(parseNumbersCampus({ campus: ["c", "a"] }, SLUGS)).toBe("c");
    expect(parseNumbersCampus({ campus: "nowhere" }, SLUGS)).toBeNull();
    expect(parseNumbersCampus({}, SLUGS)).toBeNull();
  });
});
```

Run: `pnpm test lib/staff/numbers.test.ts`
Expected: FAIL: `./numbers` doesn't exist.

- [ ] **Step 2: The rules**

Create `lib/staff/numbers.ts`:

```ts
import { dayMonth } from "@/lib/format";
import { sastDate } from "@/lib/time";
import { addDays } from "./rules";

// The admin's numbers' rules (stage J spec decisions 10 to 13): the measures, fixed SAST weeks, and what the page may
// show of each count. Plain functions: lib/data/numbers.ts counts the store, and these decide what reaches the page.
// The small-number rule lives here, not in the data layer, so it applies however the counts are made (spec section 8).

/** What the page counts (spec decision 10). Saved searches are never one of them. */
export type Measure =
  | "listings"
  | "shops"
  | "requests"
  | "enquiries"
  | "reports-made"
  | "reports-closed"
  | "follows";

/**
 * Each measure, in the tables' order, and whether it's private: things students do out of sight, which the
 * small-number rule protects. Public measures count what anyone can already see with its campus on it.
 */
export const MEASURES: ReadonlyArray<{ measure: Measure; label: string; isPrivate: boolean }> = [
  { measure: "listings", label: "Listings published", isPrivate: false },
  { measure: "shops", label: "Shops approved", isPrivate: false },
  { measure: "requests", label: "Looking For requests posted", isPrivate: false },
  { measure: "enquiries", label: "Enquiries started", isPrivate: true },
  { measure: "reports-made", label: "Reports made", isPrivate: true },
  { measure: "reports-closed", label: "Reports closed", isPrivate: true },
  { measure: "follows", label: "Shops followed", isPrivate: true },
];

/** Last week, the week before, and everything up to the end of last week. */
export type Period = "last" | "before" | "since";

/** A Monday-to-Sunday week in South Africa: its bounds in UTC (start included, end not) and "12 to 18 Oct". */
export type Week = { start: string; end: string; label: string };

export type SastWeeks = { last: Week; before: Week };

/** One column of raw counts: each campus's, and what's counted on a campus that has gone, which only totals use. */
export type RawColumn = { campuses: Readonly<Record<string, number>>; gone: number };

/** What lib/data/numbers.ts gives the page. */
export type RawCounts = {
  counts: Readonly<Record<Measure, Readonly<Record<Period, RawColumn>>>>;
  /** Open shops now (spec decision 10): a snapshot, never by week. */
  openShops: RawColumn;
};

/** One column as the page shows it: each campus's figure, and the total. */
export type ShownColumn = { campuses: Readonly<Record<string, string>>; total: string };

export type ShownCounts = {
  counts: Readonly<Record<Measure, Readonly<Record<Period | "change", ShownColumn>>>>;
  openShops: ShownColumn;
};

/** The smallest private count shown as itself (spec decision 13: the usual threshold for small cells). */
export const SMALL_COUNT = 5;
export const UNDER_FIVE = "Under 5";
export const HIDDEN = "Hidden";
/** Change, where a week's figure isn't shown. */
export const NO_CHANGE = "—";
/** Open shops now, in the week columns. */
export const NOT_BY_WEEK = "Not counted by week";

/** 00:00 in South Africa on a YYYY-MM-DD date, in UTC: 22:00 the day before (SAST is UTC+2, no daylight saving). */
function sastMidnight(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date, -2)).toISOString();
}

/** The Monday of the South African week a SAST date is in. */
function mondayOf(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  // 0 is Sunday. Worked out in UTC from the South African date, so the server's timezone can't move it.
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

function weekFrom(monday: string): Week {
  return {
    start: sastMidnight(monday),
    end: sastMidnight(addDays(monday, 7)),
    label: `${dayMonth(monday)} to ${dayMonth(addDays(monday, 6))}`,
  };
}

/**
 * The two complete SAST weeks before `now` (spec decision 11): last week, Monday 00:00 to Sunday 24:00 in South
 * Africa, and the week before it. They change once a week, at Monday 00:00 SAST. `now` comes from the caller, which
 * reads the clock only after `await connection()`.
 */
export function sastWeeks(now: Date): SastWeeks {
  const thisMonday = mondayOf(sastDate(now));
  return { last: weekFrom(addDays(thisMonday, -7)), before: weekFrom(addDays(thisMonday, -14)) };
}

/** "+3", "−2" (with a minus sign) or "0" (spec decision 11). */
export function changeText(difference: number): string {
  if (difference > 0) return `+${difference}`;
  if (difference < 0) return `−${-difference}`;
  return "0";
}

/** A private Since the start figure, rounded down to tens (spec decision 13.4): 0, "Under 10", "10+", "20+"… */
export function sinceText(count: number): string {
  if (count === 0) return "0";
  if (count < 10) return "Under 10";
  return `${Math.floor(count / 10) * 10}+`;
}

const countAt = (column: RawColumn, slug: string) => column.campuses[slug] ?? 0;

/** Every campus's count and the gone campus's: the column's total. */
function totalOf(column: RawColumn, slugs: readonly string[]): number {
  return slugs.reduce((sum, slug) => sum + countAt(column, slug), column.gone);
}

const exact = (count: number) => String(count);
const smallHidden = (count: number) => (count >= 1 && count < SMALL_COUNT ? UNDER_FIVE : String(count));

/**
 * A week's column (spec decision 13, rules 1 and 2). Private: 1 to 4 is "Under 5", and when exactly one campus is
 * "Under 5" while the total is shown, the next-smallest non-zero campus is "Hidden" too, so the total can't give the
 * small one away. There may be no such campus: then the rest is on a campus that has gone, which shows only in the
 * total, so it's hidden already.
 */
function weekColumn(column: RawColumn, slugs: readonly string[], isPrivate: boolean): ShownColumn {
  const show = isPrivate ? smallHidden : exact;
  const campuses: Record<string, string> = Object.fromEntries(slugs.map((slug) => [slug, show(countAt(column, slug))]));
  const total = show(totalOf(column, slugs));
  const small = slugs.filter((slug) => campuses[slug] === UNDER_FIVE);
  if (isPrivate && total !== UNDER_FIVE && small.length === 1) {
    // The next-smallest non-zero campus; the first in the list on a tie.
    const next = slugs
      .filter((slug) => slug !== small[0] && countAt(column, slug) > 0)
      .reduce<string | null>((best, slug) => (best === null || countAt(column, slug) < countAt(column, best) ? slug : best), null);
    if (next) campuses[next] = HIDDEN;
  }
  return { campuses, total };
}

const isFigure = (text: string) => /^\d+$/.test(text);

/** Change (spec decision 13, rule 3): "—" unless both weeks show a figure. */
function changeOf(last: string, before: string): string {
  return isFigure(last) && isFigure(before) ? changeText(Number(last) - Number(before)) : NO_CHANGE;
}

function changeColumn(last: ShownColumn, before: ShownColumn, slugs: readonly string[]): ShownColumn {
  return {
    campuses: Object.fromEntries(slugs.map((slug) => [slug, changeOf(last.campuses[slug], before.campuses[slug])])),
    total: changeOf(last.total, before.total),
  };
}

/** Since the start (spec decision 13, rule 4): a private figure in tens, so two weeks' pages can't be subtracted. */
function sinceColumn(column: RawColumn, slugs: readonly string[], isPrivate: boolean): ShownColumn {
  const show = isPrivate ? sinceText : exact;
  return {
    campuses: Object.fromEntries(slugs.map((slug) => [slug, show(countAt(column, slug))])),
    total: show(totalOf(column, slugs)),
  };
}

/**
 * The small-number rule (spec decision 13), applied to every private column at every campus and in the totals.
 * Public measures and open shops are exact: each listing, shop and request is already visible with its campus.
 * `slugs` are the campuses in the page's order.
 */
export function protectCounts(raw: RawCounts, slugs: readonly string[]): ShownCounts {
  const counts = Object.fromEntries(
    MEASURES.map(({ measure, isPrivate }) => {
      const columns = raw.counts[measure];
      const last = weekColumn(columns.last, slugs, isPrivate);
      const before = weekColumn(columns.before, slugs, isPrivate);
      return [
        measure,
        { last, before, since: sinceColumn(columns.since, slugs, isPrivate), change: changeColumn(last, before, slugs) },
      ];
    }),
  ) as ShownCounts["counts"];
  return { counts, openShops: sinceColumn(raw.openShops, slugs, false) };
}

/** The campus view's campus from `?campus=` (spec decision 12): a known campus, or null for the main page. */
export function parseNumbersCampus(
  params: Readonly<Record<string, string | string[] | undefined>>,
  slugs: readonly string[],
): string | null {
  const raw = params.campus;
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return slugs.includes(value) ? value : null;
}
```

- [ ] **Step 3: Run the tests**

Run: `pnpm test lib/staff/numbers.test.ts`
Expected: PASS.

Run: `pnpm lint lib/staff/numbers.ts lib/staff/numbers.test.ts`
Expected: no problems.

- [ ] **Step 4: Hand over**

Files: `lib/staff/numbers.ts`, `lib/staff/numbers.test.ts`. (Its typecheck runs with Task 6's.) Message:

```
feat: the admin's numbers' rules: the seven measures, fixed Monday-to-Sunday SAST weeks with their dates, and the small-number rule as a pure function: 1 to 4 private as Under 5, the next-smallest campus Hidden when one would give it away, Change only where both weeks show, private Since the start in tens (stage J spec decisions 10, 11 and 13; plan decisions 14 and 15)
```

---

### Task 6: The numbers from the store

`countByWeek(now)` counts each thing the spec lists at its moment and its campus, into last week, the week before and Since the start, with a `gone` key for things whose campus has gone. Open shops now is a snapshot. Saved searches are never read.

**Files:**
- Create: `lib/data/numbers.ts`, `lib/data/numbers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/data/numbers.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { Measure, Period, RawCounts } from "@/lib/staff/numbers";
import { listedListings, liveSellerRows } from "./catalog";
import { addFollow } from "./follows";
import { countByWeek } from "./numbers";
import { closeReport } from "./staff-reports";
import { createReport } from "./reports";
import type { ConversationRow } from "./rows";
import { approveShop, staffPauseShop } from "./staff-shops";
import { resetSampleStore, sampleStore } from "./store";

// Tuesday 20 October 2026, 10:00 in South Africa: last week is 12 to 18 October, the week before 5 to 11 October.
const NOW = new Date("2026-10-20T08:00:00.000Z");
const LAST_WEEK = new Date("2026-10-14T08:00:00.000Z");
const WEEK_BEFORE = new Date("2026-10-07T08:00:00.000Z");
const THIS_WEEK = new Date("2026-10-19T09:00:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

const at = (raw: RawCounts, measure: Measure, period: Period, campus: string) => raw.counts[measure][period].campuses[campus] ?? 0;
const gone = (raw: RawCounts, measure: Measure, period: Period) => raw.counts[measure][period].gone;

async function counted() {
  return (await countByWeek(NOW)).raw;
}

/** A conversation row with the fields that matter here. */
function conversation(id: string, overrides: Partial<ConversationRow>): ConversationRow {
  return {
    id,
    listingId: "l-001",
    listingTitle: "Casio fx-991ZA Plus calculator",
    sellerSlug: "tech-corner",
    buyerId: "acc-student",
    sellerGone: false,
    status: "asked",
    createdAt: LAST_WEEK.toISOString(),
    lastMessageAt: LAST_WEEK.toISOString(),
    firstReplyAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    ...overrides,
  };
}

describe("the weeks (stage J spec decision 11)", () => {
  it("counts in the two complete SAST weeks before now, and gives their dates", async () => {
    const { weeks } = await countByWeek(NOW);
    expect(weeks.last.label).toBe("12 to 18 Oct");
    expect(weeks.before.label).toBe("5 to 11 Oct");
  });
});

describe("listings published (stage J spec decision 10)", () => {
  it("counts a listing at its first publish, on its campus, in its week and since the start", async () => {
    const before = await counted();
    const row = structuredClone(sampleStore().listings.get("l-001")!);
    Object.assign(row, { id: "l-new", campusSlug: "pretoria", firstPublishedAt: LAST_WEEK.toISOString() });
    sampleStore().listings.set(row.id, row);
    const after = await counted();
    expect(at(after, "listings", "last", "pretoria") - at(before, "listings", "last", "pretoria")).toBe(1);
    expect(at(after, "listings", "since", "pretoria") - at(before, "listings", "since", "pretoria")).toBe(1);
    expect(at(after, "listings", "before", "pretoria")).toBe(at(before, "listings", "before", "pretoria"));
  });

  it("counts a listing saved back as a draft and published again once, at its first publish", async () => {
    const before = await counted();
    const row = structuredClone(sampleStore().listings.get("l-001")!);
    // Published the week before, then a draft, then published again last week: firstPublishedAt never moves.
    Object.assign(row, {
      id: "l-again",
      campusSlug: "pretoria",
      firstPublishedAt: WEEK_BEFORE.toISOString(),
      updatedAt: LAST_WEEK.toISOString(),
    });
    sampleStore().listings.set(row.id, row);
    const after = await counted();
    expect(at(after, "listings", "before", "pretoria") - at(before, "listings", "before", "pretoria")).toBe(1);
    expect(at(after, "listings", "last", "pretoria")).toBe(at(before, "listings", "last", "pretoria"));
  });

  it("doesn't count a draft never published, or anything from this week", async () => {
    const before = await counted();
    const draft = structuredClone(sampleStore().listings.get("l-001")!);
    Object.assign(draft, { id: "l-draft", state: "draft", firstPublishedAt: null });
    const fresh = structuredClone(sampleStore().listings.get("l-001")!);
    Object.assign(fresh, { id: "l-fresh", firstPublishedAt: THIS_WEEK.toISOString() });
    sampleStore().listings.set(draft.id, draft);
    sampleStore().listings.set(fresh.id, fresh);
    expect(await counted()).toEqual(before);
  });
});

describe("shops approved (stage J spec decision 10)", () => {
  it("counts a student's shop at its first approval, and not while it waits", async () => {
    const before = await counted();
    expect(at(before, "shops", "since", "pretoria")).toBe(
      [...sampleStore().sellers.values()].filter((row) => row.ownerId === null && row.campusSlug === "pretoria").length,
    );
    await approveShop("crochet-corner", "acc-pending", LAST_WEEK);
    const after = await counted();
    expect(at(after, "shops", "last", "pretoria") - at(before, "shops", "last", "pretoria")).toBe(1);
  });

  it("counts a sample shop no account owns at its createdAt", async () => {
    const before = await counted();
    const shop = [...sampleStore().sellers.values()].find((row) => row.ownerId === null && row.campusSlug === "midrand")!;
    shop.createdAt = LAST_WEEK.toISOString();
    const after = await counted();
    expect(at(after, "shops", "last", "midrand") - at(before, "shops", "last", "midrand")).toBe(1);
  });
});

describe("enquiries started (stage J spec decision 10)", () => {
  it("counts a buyer's conversation on its shop's campus, and leaves offers out", async () => {
    const before = await counted();
    sampleStore().conversations.set("conv-e1", conversation("conv-e1", {}));
    sampleStore().conversations.set("conv-o1", conversation("conv-o1", { requestId: "r-001", requestTitle: "A lab coat" }));
    const after = await counted();
    expect(at(after, "enquiries", "last", "midrand") - at(before, "enquiries", "last", "midrand")).toBe(1);
  });

  it("counts an enquiry to a shop that has gone in the total only", async () => {
    const before = await counted();
    sampleStore().conversations.set("conv-g1", conversation("conv-g1", { sellerGone: true }));
    const after = await counted();
    expect(gone(after, "enquiries", "last") - gone(before, "enquiries", "last")).toBe(1);
    expect(at(after, "enquiries", "last", "midrand")).toBe(at(before, "enquiries", "last", "midrand"));
  });
});

describe("reports made and closed (stage J spec decision 10)", () => {
  it("counts a report when it's made and when it's closed, on its target's campus", async () => {
    const before = await counted();
    const id = await createReport({
      reporterId: "acc-student",
      target: { kind: "listing", id: "l-001" },
      targetTitle: "Casio fx-991ZA Plus calculator",
      reason: "scam",
      detail: "",
      now: WEEK_BEFORE,
    });
    await closeReport(id, "Looked fine.", "acc-admin", LAST_WEEK);
    const after = await counted();
    expect(at(after, "reports-made", "before", "midrand") - at(before, "reports-made", "before", "midrand")).toBe(1);
    expect(at(after, "reports-closed", "last", "midrand") - at(before, "reports-closed", "last", "midrand")).toBe(1);
    expect(at(after, "reports-closed", "before", "midrand")).toBe(at(before, "reports-closed", "before", "midrand"));
  });

  it("counts a report on something that has gone in the total only", async () => {
    const before = await counted();
    const id = await createReport({
      reporterId: "acc-student",
      target: { kind: "seller", id: "tech-corner" },
      targetTitle: "Tech corner",
      reason: "scam",
      detail: "",
      now: LAST_WEEK,
    });
    sampleStore().reports.get(id)!.targetGone = true;
    const after = await counted();
    expect(gone(after, "reports-made", "last") - gone(before, "reports-made", "last")).toBe(1);
  });
});

describe("shops followed (stage J spec decision 10)", () => {
  it("counts a follow on the followed shop's campus", async () => {
    const before = await counted();
    expect(await addFollow("acc-student", "tech-corner", LAST_WEEK)).toBe("followed");
    const after = await counted();
    expect(at(after, "follows", "last", "midrand") - at(before, "follows", "last", "midrand")).toBe(1);
  });
});

describe("open shops now (stage J spec decision 10, plan decision 12)", () => {
  it("counts approved, unpaused shops with something listed, Verified or not", async () => {
    const { openShops } = await counted();
    const listed = new Set(listedListings().map((listing) => listing.sellerSlug));
    const expected = liveSellerRows().filter((row) => listed.has(row.slug));
    expect(Object.values(openShops.campuses).reduce((sum, count) => sum + count, 0)).toBe(expected.length);
    expect(expected.some((row) => !row.verified)).toBe(true);
    expect(openShops.gone).toBe(0);
  });

  it("drops a shop the Hub pauses", async () => {
    const before = (await counted()).openShops.campuses.midrand ?? 0;
    await staffPauseShop("tech-corner", "Checking it.");
    expect((await counted()).openShops.campuses.midrand ?? 0).toBe(before - 1);
  });
});
```

Run: `pnpm test lib/data/numbers.test.ts`
Expected: FAIL: `./numbers` doesn't exist.

- [ ] **Step 2: The counting**

Create `lib/data/numbers.ts`:

```ts
import { campuses } from "@/data/fixtures/campuses";
import {
  MEASURES,
  sastWeeks,
  type Measure,
  type Period,
  type RawColumn,
  type RawCounts,
  type SastWeeks,
} from "@/lib/staff/numbers";
import { listedListings, liveSellerRows } from "./catalog";
import type { ReportRow } from "./rows";
import { sampleStore } from "./store";

// The admin's numbers from the sample store (stage J spec decision 10), worked out by looping over the store as the
// page renders: fine for sample mode's few hundred rows. Each thing counts at its moment and on its campus. Things
// deleted since aren't in the store, so they aren't counted; something whose campus has gone (an enquiry to a deleted
// shop, a report on something deleted) is kept under `gone`, which only totals use. Saved searches are never read
// (spec decision 10: their promise). The real backend reads a SQL view, then a weekly roll-up (spec section 8).

/** The fixtures' 13 campuses (plan decision 13). Any other slug is a campus that has gone. */
const KNOWN = new Set(campuses.map((campus) => campus.slug));

type Column = { campuses: Record<string, number>; gone: number };

const emptyColumn = (): Column => ({ campuses: {}, gone: 0 });

function add(column: Column, campus: string | null | undefined): void {
  if (campus && KNOWN.has(campus)) column.campuses[campus] = (column.campuses[campus] ?? 0) + 1;
  else column.gone += 1;
}

/**
 * Counts one thing that happened `at` on `campus`: into Since the start when it's before the end of last week, and
 * into last week or the week before when it falls in one. Something from this week isn't counted yet.
 */
function tally(
  counter: Record<Measure, Record<Period, Column>>,
  measure: Measure,
  weeks: SastWeeks,
  at: string | null | undefined,
  campus: string | null | undefined,
): void {
  if (!at) return;
  const moment = Date.parse(at);
  if (!(moment < Date.parse(weeks.last.end))) return;
  add(counter[measure].since, campus);
  if (moment >= Date.parse(weeks.last.start)) add(counter[measure].last, campus);
  else if (moment >= Date.parse(weeks.before.start)) add(counter[measure].before, campus);
}

/** A report's campus: its listing's, shop's or request's as the page renders, or null once that has gone. */
function reportCampus(row: ReportRow): string | null {
  if (row.targetGone === true) return null;
  const { listings, sellers, requests } = sampleStore();
  switch (row.targetKind) {
    case "listing":
      return listings.get(row.targetId)?.campusSlug ?? null;
    case "seller":
      return sellers.get(row.targetId)?.campusSlug ?? null;
    case "request":
      return requests.get(row.targetId)?.campusSlug ?? null;
  }
}

/**
 * Raw counts by measure, week and campus, and the weeks they're counted in (spec decisions 10 and 11). `now` comes
 * from the caller, which reads the clock only after `await connection()`.
 */
export async function countByWeek(now: Date): Promise<{ weeks: SastWeeks; raw: RawCounts }> {
  const weeks = sastWeeks(now);
  const store = sampleStore();
  const counter = Object.fromEntries(
    MEASURES.map(({ measure }) => [measure, { last: emptyColumn(), before: emptyColumn(), since: emptyColumn() }]),
  ) as Record<Measure, Record<Period, Column>>;

  // A listing counts once, at its first publish, hidden or not (plan decision 13).
  for (const row of store.listings.values()) tally(counter, "listings", weeks, row.firstPublishedAt, row.campusSlug);
  // A student's shop at its first approval; a sample shop no account owns has always been open, so at its createdAt.
  for (const row of store.sellers.values()) {
    const approvedAt = row.ownerId === null ? row.createdAt : store.sellerProfiles.get(row.ownerId)?.approvedAt;
    tally(counter, "shops", weeks, approvedAt, row.campusSlug);
  }
  for (const row of store.requests.values()) tally(counter, "requests", weeks, row.createdAt, row.campusSlug);
  // Offers on a request (requestId set) aren't enquiries, as selling's counting has it. A conversation whose shop has
  // gone is on a gone campus, so a new shop on the same link never takes it.
  for (const row of store.conversations.values()) {
    if (row.requestId) continue;
    const campus = row.sellerGone ? null : store.sellers.get(row.sellerSlug)?.campusSlug;
    tally(counter, "enquiries", weeks, row.createdAt, campus);
  }
  for (const row of store.reports.values()) {
    const campus = reportCampus(row);
    tally(counter, "reports-made", weeks, row.createdAt, campus);
    tally(counter, "reports-closed", weeks, row.status === "closed" ? row.closedAt : null, campus);
  }
  for (const row of store.follows.values()) {
    tally(counter, "follows", weeks, row.createdAt, store.sellers.get(row.sellerSlug)?.campusSlug);
  }

  // Open shops now (plan decision 12): approved and not paused, with something listed that the Hub hasn't hidden.
  const openShops = emptyColumn();
  const listed = new Set(listedListings().map((listing) => listing.sellerSlug));
  for (const row of liveSellerRows()) {
    if (listed.has(row.slug)) add(openShops, row.campusSlug);
  }

  return { weeks, raw: { counts: counter as Record<Measure, Record<Period, RawColumn>>, openShops } };
}
```

- [ ] **Step 3: Run the tests**

Run: `pnpm test lib/data/numbers.test.ts lib/staff/numbers.test.ts`
Expected: PASS.

Run: `pnpm lint lib/data/numbers.ts lib/data/numbers.test.ts`
Expected: no problems.

- [ ] **Step 4: Typecheck and the whole suite, in a scratch copy**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task6"`), copying in Task 5's and this task's files if Task 5 isn't committed yet, or this task's only. From `$S`: `pnpm typecheck`, `pnpm test`, `pnpm lint`. Expected: clean, all passing.

- [ ] **Step 5: Hand over**

Files: `lib/data/numbers.ts`, `lib/data/numbers.test.ts`. Message:

```
feat: the admin's numbers from the store: listings at their first publish, shops at their first approval (sample shops at their start), requests, enquiries without offers, reports made and closed, and follows, each on its campus in last week, the week before and since the start, with a gone campus for the totals only; open shops now as a snapshot; never saved searches (stage J spec decision 10; plan decisions 12 and 13)
```

---

### Task 7: Show again: the hidden lists, the data and the two actions

The mirror of G's Hide the listing and H's Hide the request (spec 2.14). `showListing` and `showRequest` clear a hide and nothing else; `listHidden`, `getHidden` and `countHidden` read what's hidden; `showListingAgain` and `showRequestAgain` are G-shaped admin actions with one audit entry, the student's notification, the tag and a notice. G's gate test (amendment 14.8) learns the two new actions.

**Files:**
- Modify: `lib/data/staff-shops.ts`, `lib/data/staff-shops.test.ts`
- Modify: `lib/data/requests.ts`, `lib/data/requests.test.ts`
- Modify: `lib/data/staff-reports.ts`, `lib/data/staff-reports.test.ts`
- Modify: `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`

- [ ] **Step 1: Write the failing data tests**

In `lib/data/staff-shops.test.ts`, add `showListing` to the import list from `"./staff-shops"`, and add at the end:

```ts
describe("Show again (stage J spec decision 14)", () => {
  it("clears a listing's hide and keeps its own state; null when it isn't hidden or has gone", async () => {
    sampleStore().listings.get("l-001")!.state = "sold";
    await hideListing("l-001", "Checking it.", NOW);
    expect(await showListing("l-001")).toEqual({
      id: "l-001",
      title: "Casio fx-991ZA Plus calculator",
      state: "sold",
      ownerId: "acc-seller",
    });
    expect(sampleStore().listings.get("l-001")).toMatchObject({ hiddenAt: null, hiddenReason: null, state: "sold" });
    expect(await showListing("l-001")).toBeNull();
    expect(await showListing("l-nope")).toBeNull();
  });
});
```

In `lib/data/requests.test.ts`, add `hideRequest` (if it isn't there already) and `showRequest` to the import list from `"./requests"`, and add at the end:

```ts
describe("Show again (stage J spec decision 14)", () => {
  const hiddenAt = new Date("2026-10-14T08:42:00.000Z");
  const shownAt = new Date("2026-10-15T09:00:00.000Z");

  it("clears a request's hide and keeps it closed if its asker had closed it; null when it isn't hidden or has gone", async () => {
    const row = sampleStore().requests.get("r-001")!;
    Object.assign(row, { status: "closed", closedAt: hiddenAt.toISOString() });
    await hideRequest("r-001", "Checking it.", hiddenAt);
    expect(await showRequest("r-001", shownAt)).toEqual({ id: "r-001", title: row.title, askerId: null });
    expect(sampleStore().requests.get("r-001")).toMatchObject({
      hiddenAt: null,
      hiddenReason: null,
      status: "closed",
      updatedAt: shownAt.toISOString(),
    });
    expect(await showRequest("r-001", shownAt)).toBeNull();
    expect(await showRequest("r-nope", shownAt)).toBeNull();
  });
});
```

In `lib/data/staff-reports.test.ts`, add these imports:

```ts
import { hideRequest } from "./requests";
```

add `hideListing` to the import from `"./staff-shops"`, add `countHidden`, `getHidden` and `listHidden` to the import list from `"./staff-reports"`, and add at the end:

```ts
describe("hidden listings and requests (stage J spec decision 14)", () => {
  const early = new Date("2026-10-13T08:00:00.000Z");
  const late = new Date("2026-10-14T08:00:00.000Z");

  it("lists what the Hub has hidden, newest first, with what the page and its confirm pages need", async () => {
    await hideListing("l-004", "Not allowed.", early);
    await hideListing("l-001", "Checking it.", late);
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "staff" });
    Object.assign(sampleStore().requests.get("r-001")!, { status: "closed" });
    await hideRequest("r-001", "Exam answers.", early);
    const { listings, requests } = await listHidden();
    expect(listings.map((item) => item.id)).toEqual(["l-001", "l-004"]);
    expect(listings[0]).toEqual({
      kind: "listing",
      id: "l-001",
      title: "Casio fx-991ZA Plus calculator",
      shopName: "Tech corner",
      campusSlug: "midrand",
      hiddenAt: late.toISOString(),
      reason: "Checking it.",
      listingState: "available",
      shopPausedByHub: true,
      requestClosed: false,
    });
    expect(listings[1].shopPausedByHub).toBe(false);
    expect(requests).toEqual([
      expect.objectContaining({
        kind: "request",
        id: "r-001",
        shopName: null,
        reason: "Exam answers.",
        listingState: null,
        requestClosed: true,
      }),
    ]);
    expect(await countHidden()).toEqual({ listings: 2, requests: 1 });
    expect(await getHidden("listing", "l-001")).toEqual(listings[0]);
    expect(await getHidden("listing", "l-002")).toBeNull();
    expect(await getHidden("request", "l-001")).toBeNull();
  });

  it("is empty when nothing is hidden", async () => {
    expect(await listHidden()).toEqual({ listings: [], requests: [] });
    expect(await countHidden()).toEqual({ listings: 0, requests: 0 });
  });
});
```

Run: `pnpm test lib/data/staff-shops.test.ts lib/data/requests.test.ts lib/data/staff-reports.test.ts`
Expected: FAIL: `showListing`, `showRequest`, `listHidden`, `getHidden` and `countHidden` aren't exported.

- [ ] **Step 2: The data**

In `lib/data/staff-shops.ts`, add after `hideListing`:

```ts
/** What showing a listing again tells the action: its title for the log, its state for the seller's tab, its owner. */
export type ShownListing = { id: string; title: string; state: ListingState; ownerId: string | null };

/**
 * Show again (stage J spec decision 14): the mirror of Hide the listing. Its hide and reason are cleared and nothing else
 * changes: its own state (sold, paused, a draft) stays, and so do the reports that closed. Its photos are public again
 * by themselves (lib/data/photos.ts hides them only while hiddenAt is set). Null when it has gone or isn't hidden.
 */
export async function showListing(id: string): Promise<ShownListing | null> {
  const row = sampleStore().listings.get(id);
  if (!row || !row.hiddenAt) return null;
  row.hiddenAt = null;
  row.hiddenReason = null;
  const ownerId = sampleStore().sellers.get(row.sellerSlug)?.ownerId ?? null;
  return { id: row.id, title: row.title, state: row.state, ownerId };
}
```

In `lib/data/requests.ts`, add after `hideRequest`:

```ts
/**
 * Show again (stage J spec decision 14): the mirror of Hide the request. Its hide and reason are cleared; open or
 * closed stays as its asker left it (stage J plan decision 16). Null when it's gone or isn't hidden.
 */
export async function showRequest(id: string, now: Date): Promise<HiddenRequest | null> {
  const row = sampleStore().requests.get(id);
  if (!row || row.hiddenAt === null) return null;
  row.hiddenAt = null;
  row.hiddenReason = null;
  row.updatedAt = now.toISOString();
  return { id: row.id, title: row.title, askerId: row.askerId };
}
```

In `lib/data/staff-reports.ts`, change the first import to:

```ts
import type { ListingState, ReportOutcome, ReportReason, ReportTarget } from "@/lib/types";
```

and add at the end of the file:

```ts
// --- Hidden listings and requests (stage J spec decision 14) -----------------------------------------------------

/** A listing or request the Hub has hidden, as /admin/hidden and its confirm pages show it. */
export type HiddenItem = {
  kind: "listing" | "request";
  id: string;
  title: string;
  /** The listing's shop's name; null for a request, which never names its asker. */
  shopName: string | null;
  campusSlug: string;
  hiddenAt: string;
  /** The Hub's reason, which the seller or asker saw. */
  reason: string;
  /** A listing's own state, which showing it again keeps (plan decision 16); null for a request. */
  listingState: ListingState | null;
  /** The listing's shop is paused by the Hub, so buyers won't see it until the shop is resumed. */
  shopPausedByHub: boolean;
  /** The request's asker had closed it, so it shows as closed. */
  requestClosed: boolean;
};

function hiddenListings(): HiddenItem[] {
  const store = sampleStore();
  return [...store.listings.values()].flatMap((row): HiddenItem[] => {
    if (!row.hiddenAt) return [];
    const shop = store.sellers.get(row.sellerSlug);
    const profile = shop?.ownerId ? store.sellerProfiles.get(shop.ownerId) : undefined;
    return [
      {
        kind: "listing",
        id: row.id,
        title: row.title,
        shopName: shop?.name ?? row.sellerSlug,
        campusSlug: row.campusSlug,
        hiddenAt: row.hiddenAt,
        reason: row.hiddenReason ?? "",
        listingState: row.state,
        shopPausedByHub: profile?.status === "paused" && profile.pausedBy === "staff",
        requestClosed: false,
      },
    ];
  });
}

function hiddenRequests(): HiddenItem[] {
  return [...sampleStore().requests.values()].flatMap((row): HiddenItem[] => {
    if (row.hiddenAt === null) return [];
    return [
      {
        kind: "request",
        id: row.id,
        title: row.title,
        shopName: null,
        campusSlug: row.campusSlug,
        hiddenAt: row.hiddenAt,
        reason: row.hiddenReason ?? "",
        listingState: null,
        shopPausedByHub: false,
        requestClosed: row.status === "closed",
      },
    ];
  });
}

const newestHiddenFirst = (a: HiddenItem, b: HiddenItem) => b.hiddenAt.localeCompare(a.hiddenAt);

/**
 * Everything the Hub has hidden, newest hidden first (spec decision 14). The Reports queue keeps only the 50 most
 * recently closed reports, so this list is the only place an old hide stays reachable.
 */
export async function listHidden(): Promise<{ listings: HiddenItem[]; requests: HiddenItem[] }> {
  return { listings: hiddenListings().sort(newestHiddenFirst), requests: hiddenRequests().sort(newestHiddenFirst) };
}

/** One hidden listing or request, for its Show again page. Null when it's gone or isn't hidden. */
export async function getHidden(kind: "listing" | "request", id: string): Promise<HiddenItem | null> {
  return (kind === "listing" ? hiddenListings() : hiddenRequests()).find((item) => item.id === id) ?? null;
}

/** How many of each are hidden, for Overview's line (plan decision 17). */
export async function countHidden(): Promise<{ listings: number; requests: number }> {
  return { listings: hiddenListings().length, requests: hiddenRequests().length };
}
```

Run: `pnpm test lib/data/staff-shops.test.ts lib/data/requests.test.ts lib/data/staff-reports.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing action tests**

In `lib/staff/admin-actions.test.ts`:
- add these imports:

```ts
import { isHiddenFrom } from "@/lib/data/photos";
import { hideRequest } from "@/lib/data/requests";
import { closeReportsOn } from "@/lib/data/staff-reports";
import { hideListing } from "@/lib/data/staff-shops";
import { myListingsPath } from "@/lib/selling/paths";
```

  (merge each into an existing import from the same module, if the file already has one);
- add `showListingAgain` and `showRequestAgain` to the import list from `"./admin-actions"`;
- in `GATE_CASES`, add after the `restorePoint` case:

```ts
  // Stage J: Show again acts on something hidden, so each setup hides one (spec decision 14).
  showListingAgain: {
    setup: () => {
      Object.assign(sampleStore().listings.get("l-001")!, { hiddenAt: STAFF_NOW.toISOString(), hiddenReason: REASON });
    },
    fields: () => ({ listing: "l-001" }),
  },
  showRequestAgain: {
    setup: () => {
      Object.assign(sampleStore().requests.get("r-002")!, { hiddenAt: STAFF_NOW.toISOString(), hiddenReason: REASON });
    },
    fields: () => ({ request: "r-002" }),
  },
```

- add at the end of the file:

```ts
describe("Show again (stage J spec decision 14)", () => {
  const title = "Casio fx-991ZA Plus calculator";
  const photo = "ph-00000000-0000-4000-8000-000000000001";
  const auditRows = () => [...sampleStore().auditLog.values()];
  const alerts = () =>
    [...sampleStore().notifications.values()].filter((row) => row.kind === "new-listing" || row.kind === "search-match").length;

  /** l-001, with an uploaded photo, reported by Thandi and hidden, its report closed, as G's Hide leaves it. */
  async function hiddenListing(): Promise<string> {
    const reportId = await report("acc-student", { kind: "listing", id: "l-001" }, title);
    sampleStore().listings.get("l-001")!.photos.push({ src: `/photos/${photo}`, alt: "" });
    await hideListing("l-001", "Checking it.", STAFF_NOW);
    await closeReportsOn({ kind: "listing", id: "l-001" }, "hidden", "Checking it.", "acc-admin", STAFF_NOW);
    return reportId;
  }

  it("shows a hidden listing again: one entry, its seller told, buyers' pages expired, its photos public, a notice", async () => {
    const reportId = await hiddenListing();
    expect(isHiddenFrom(photo, null)).toBe(true);
    const notes = sampleStore().notifications.size;
    const before = alerts();
    await asAdmin();
    expect(await redirectOf(() => showListingAgain(form({ listing: "l-001" })))).toBe("/admin/hidden");
    expect(sampleStore().listings.get("l-001")).toMatchObject({ hiddenAt: null, hiddenReason: null, state: "available" });
    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0]).toMatchObject({
      action: "listing-shown",
      targetKind: "listing",
      targetId: "l-001",
      targetName: title,
      detail: "",
      subjectId: "acc-seller",
      staffId: "acc-admin",
    });
    expect(await newest("acc-seller")).toMatchObject({
      kind: "shop-update",
      text: `The Hub is showing ${title} again. It's back in My listings.`,
      href: "/sell/listings",
    });
    // Only the seller is told: not the reporter again, and no follower or saved search (it isn't a first publish).
    expect(sampleStore().notifications.size).toBe(notes + 1);
    expect(alerts()).toBe(before);
    expect(sampleStore().reports.get(reportId)).toMatchObject({ status: "closed", outcome: "hidden" });
    expect(request.updatedTags).toEqual(["listings"]);
    expect(await notice()).toBe("listing-shown");
    expect(isHiddenFrom(photo, null)).toBe(false);
  });

  it("keeps a sold listing sold, and links its seller to the tab it's on", async () => {
    sampleStore().listings.get("l-001")!.state = "sold";
    await hiddenListing();
    await asAdmin();
    await redirectOf(() => showListingAgain(form({ listing: "l-001" })));
    expect(sampleStore().listings.get("l-001")?.state).toBe("sold");
    expect((await newest("acc-seller")).href).toBe(myListingsPath("sold"));
  });

  it("says nothing changed for a listing that isn't hidden or has gone, writing and sending nothing", async () => {
    await asAdmin();
    for (const listing of ["l-001", "l-nope", "<bad>"]) {
      expect(await redirectOf(() => showListingAgain(form({ listing })))).toBe("/admin/hidden");
      expect(await notice(), listing).toBe("nothing");
    }
    expect(sampleStore().auditLog.size).toBe(0);
    expect(request.updatedTags).toEqual([]);
  });

  it("shows a hidden request again: its asker told, the board expired, its reports still closed, the reporter not told", async () => {
    const requestTitle = "Graphic calculator to borrow for exams";
    sampleStore().requests.get("r-002")!.askerId = "acc-student";
    const reportId = await report("acc-mentor", { kind: "request", id: "r-002" }, requestTitle);
    await hideRequest("r-002", "Checking it.", STAFF_NOW);
    await closeReportsOn({ kind: "request", id: "r-002" }, "hidden", "Checking it.", "acc-admin", STAFF_NOW);
    const mentorNotes = (await getNotifications("acc-mentor", 50)).length;
    await asAdmin();
    expect(await redirectOf(() => showRequestAgain(form({ request: "r-002" })))).toBe("/admin/hidden");
    expect(sampleStore().requests.get("r-002")).toMatchObject({ hiddenAt: null, hiddenReason: null, status: "open" });
    expect(auditRows()[0]).toMatchObject({ action: "request-shown", targetKind: "request", subjectId: "acc-student" });
    expect(await newest("acc-student")).toMatchObject({
      kind: "request-update",
      text: `The Hub is showing your request ${requestTitle} again.`,
      href: "/account/requests",
    });
    expect(await getNotifications("acc-mentor", 50)).toHaveLength(mentorNotes);
    expect(sampleStore().reports.get(reportId)).toMatchObject({ status: "closed", outcome: "hidden" });
    expect(request.updatedTags).toEqual(["requests"]);
    expect(await notice()).toBe("request-shown");
  });

  it("shows a hidden sample request, which has no asker to tell", async () => {
    await hideRequest("r-002", "Checking it.", STAFF_NOW);
    const notes = sampleStore().notifications.size;
    await asAdmin();
    await redirectOf(() => showRequestAgain(form({ request: "r-002" })));
    expect(sampleStore().requests.get("r-002")?.hiddenAt).toBeNull();
    expect(sampleStore().notifications.size).toBe(notes);
    expect(auditRows()[0]).toMatchObject({ action: "request-shown", subjectId: null });
  });
});
```

Run: `pnpm test lib/staff/admin-actions.test.ts`
Expected: FAIL: `showListingAgain` and `showRequestAgain` aren't exported, and the gate test's "has a case for every exported action" fails the other way until they are.

- [ ] **Step 4: The two actions**

In `lib/staff/admin-actions.ts`:
- add `showRequest` to the import from `"@/lib/data/requests"` (`import { hideRequest, showRequest } from "@/lib/data/requests";`);
- add `showListing` to the import list from `"@/lib/data/staff-shops"`;
- change the import from `"./notification-text"` to:

```ts
import {
  listingHiddenText,
  listingShownText,
  reportOutcomeText,
  requestShownText,
  shopApprovedText,
  shopDecisionText,
} from "./notification-text";
```

- add `ADMIN_HIDDEN_PATH`, `showListingPath` and `showRequestPath` to the import list from `"./paths"`;
- add at the end of the file:

```ts
// --- Show again (stage J spec decision 14) ----------------------------------------------------------------------

/**
 * Show the listing again, from its confirm page: the mirror of Hide the listing. Its seller is told and buyers' pages
 * read it again. The reports that closed stay closed and their reporters aren't told again; followers and saved
 * searches aren't told, since it isn't a first publish. Its own state (sold, paused, a draft) stays.
 */
export async function showListingAgain(formData: FormData): Promise<void> {
  const id = idFrom(formData, "listing");
  const staff = await requireStaff("admin", id ? showListingPath(id) : ADMIN_HIDDEN_PATH);
  const now = new Date();
  const shown = id ? await showListing(id) : null;
  if (!shown) return nothingChanged(ADMIN_HIDDEN_PATH, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "listing-shown",
    target: { kind: "listing", id: shown.id, name: shown.title },
    subjectId: shown.ownerId,
    now,
  });
  if (shown.ownerId) {
    await notify({
      accountId: shown.ownerId,
      kind: "shop-update",
      subjectId: shown.id,
      text: listingShownText(shown.title),
      href: myListingsPath(tabFor(shown.state)),
      now,
    });
  }
  listingsChanged();
  await leaveNotice("listing-shown", now);
  done(ADMIN_HIDDEN_PATH);
}

/**
 * Show the request again, from its confirm page: the mirror of Hide the request. Its asker is told and the board, the
 * homepage, the sitemap and its page read it again. Open or closed stays as its asker left it.
 */
export async function showRequestAgain(formData: FormData): Promise<void> {
  const id = idFrom(formData, "request");
  const staff = await requireStaff("admin", id ? showRequestPath(id) : ADMIN_HIDDEN_PATH);
  const now = new Date();
  const shown = id ? await showRequest(id, now) : null;
  if (!shown) return nothingChanged(ADMIN_HIDDEN_PATH, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "request-shown",
    target: { kind: "request", id: shown.id, name: shown.title },
    subjectId: shown.askerId,
    now,
  });
  if (shown.askerId) {
    await notify({
      accountId: shown.askerId,
      kind: "request-update",
      subjectId: shown.id,
      text: requestShownText(shown.title),
      href: YOUR_REQUESTS_PATH,
      now,
    });
  }
  requestsChanged();
  await leaveNotice("request-shown", now);
  done(ADMIN_HIDDEN_PATH);
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test lib/staff/admin-actions.test.ts lib/data`
Expected: PASS, the gate test's `it.each` included (18 actions, each logged once for an admin and refused for a mentor and a student).

Run: `pnpm lint lib/staff/admin-actions.ts lib/data`
Expected: no problems.

- [ ] **Step 6: Typecheck and the whole suite, in a scratch copy**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task7"`), copying in this task's files. From `$S`: `pnpm typecheck`, `pnpm test`, `pnpm lint`. Expected: clean, all passing.

- [ ] **Step 7: Hand over**

Files: `lib/data/staff-shops.ts`, `lib/data/staff-shops.test.ts`, `lib/data/requests.ts`, `lib/data/requests.test.ts`, `lib/data/staff-reports.ts`, `lib/data/staff-reports.test.ts`, `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`. Message:

```
feat: Show again: a hidden listing or Looking For request is shown again by an admin, with one audit entry, its seller or asker told, browse or the board expired and its photos public again; its reports stay closed and nobody else is told; what's hidden is listed newest first and counted (stage J spec decision 14; plan decision 16)
```

---

### Task 8: Giving and taking away a role

`lib/staff/account-actions.ts`: `giveStaffRole` (G's one-time token, the four errors kept in form state with the typed email) and `removeStaffRole` (the refusals shown on the confirm page). Both follow G's order: `requireStaff("admin", …)` first, check, write, one `recordAudit()`, one `staff-role` notification, a notice, `done()`. Neither expires a tag (plan decision 8).

**Files:**
- Create: `lib/staff/account-actions.ts`, `lib/staff/account-actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/staff/account-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { createAccount, deleteAccountData } from "@/lib/data/accounts";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { giveStaffRole, removeStaffRole } from "./account-actions";
import { GIVE_ROLE_FORM, removeRoleForm, STAFF_NOTICE } from "./form-state";
import { issueOnceToken } from "./once";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

const asAdmin = () => signedInAs(request, "acc-admin");
const notice = async () => (await readFormState(STAFF_NOTICE))?.notice ?? null;
const auditRows = () => [...sampleStore().auditLog.values()];
const notesOf = (accountId: string) =>
  [...sampleStore().notifications.values()].filter((row) => row.accountId === accountId && row.kind === "staff-role");

/** A student who has signed in once (spec decision 3). */
async function zola() {
  return createAccount({ email: "zola@eduvos.com", firstName: "Zola", campusSlug: "pretoria", now: STAFF_NOW });
}

/** Give a staff role's form, as the page draws it: with a fresh token for this session. */
async function giveForm(fields: Record<string, string>): Promise<FormData> {
  return form({ once: (await issueOnceToken()) ?? "", ...fields });
}

describe("the gate (stage J spec section 5)", () => {
  it("sends a signed-out visitor to sign in, and gives a mentor or a student the 404, changing nothing", async () => {
    expect(await redirectOf(() => giveStaffRole(form({ email: "zola@eduvos.com", role: "mentor" })))).toBe(
      "/login?next=%2Fadmin%2Fstaff",
    );
    expect(await redirectOf(() => removeStaffRole(form({ account: "acc-mentor", role: "mentor" })))).toBe(
      "/login?next=%2Fadmin%2Fstaff%2Facc-mentor%2Fremove-mentor",
    );
    await zola();
    for (const accountId of ["acc-mentor", "acc-student"]) {
      await signedInAs(request, accountId);
      const before = structuredClone(sampleStore());
      await expect(giveStaffRole(await giveForm({ email: "zola@eduvos.com", role: "admin" }))).rejects.toThrow("notFound");
      await expect(removeStaffRole(form({ account: "acc-mentor", role: "mentor" }))).rejects.toThrow("notFound");
      // The token the form drew is the only change, and it's this session's form state.
      sampleStore().formStates.clear();
      before.formStates.clear();
      expect(sampleStore(), accountId).toEqual(before);
    }
  });
});

describe("giving a role (stage J spec decisions 3, 6 and 7)", () => {
  it("gives the role by exact email: one entry, the person told, a notice, and no tag", async () => {
    const account = await zola();
    await asAdmin();
    const sent = await giveForm({ email: "  ZOLA@Eduvos.com ", role: "mentor" });
    expect(await redirectOf(() => giveStaffRole(sent))).toBe("/admin/staff");
    expect(sampleStore().accounts.get(account.id)?.roles).toEqual(["mentor"]);
    expect(auditRows()).toEqual([
      expect.objectContaining({
        action: "role-given",
        staffId: "acc-admin",
        staffName: "Pieter",
        targetKind: "account",
        targetId: account.id,
        targetName: "Zola",
        detail: "Mentor",
        subjectId: account.id,
      }),
    ]);
    expect(notesOf(account.id)).toEqual([
      expect.objectContaining({
        subjectId: "mentor",
        text: "You're a Vossie mentor now. The Hub's tools and the mentor dashboard are on your account page.",
        href: "/account",
        readAt: null,
      }),
    ]);
    expect(await notice()).toBe("role-given");
    expect(request.updatedTags).toEqual([]);
    expect(request.refreshed).toBe(true);
  });

  it("gives nothing on a second press of the same form, and goes where the first went", async () => {
    const account = await zola();
    await asAdmin();
    const sent = await giveForm({ email: "zola@eduvos.com", role: "admin" });
    await redirectOf(() => giveStaffRole(sent));
    expect(await redirectOf(() => giveStaffRole(sent))).toBe("/admin/staff");
    expect(await notice()).toBe("role-given");
    expect(auditRows()).toHaveLength(1);
    expect(notesOf(account.id)).toHaveLength(1);
    expect(sampleStore().accounts.get(account.id)?.roles).toEqual(["admin"]);
  });

  it("keeps the errors and the typed email in form state, never the link, and gives nothing", async () => {
    await zola();
    await asAdmin();
    const cases: Array<[Record<string, string>, string[], string]> = [
      [{ email: "", role: "" }, ["staff-email-missing", "staff-role-missing"], ""],
      [{ email: "nobody@eduvos.com", role: "mentor" }, ["staff-email-unknown"], "nobody@eduvos.com"],
      [{ email: "zola@eduvos.com", role: "owner" }, ["staff-role-missing"], "zola@eduvos.com"],
      [{ email: "Mentor@Eduvos.com", role: "mentor" }, ["staff-role-held"], "Mentor@Eduvos.com"],
    ];
    for (const [fields, errors, typed] of cases) {
      expect(await redirectOf(async () => giveStaffRole(await giveForm(fields)))).toBe("/admin/staff");
      expect(await readFormState(GIVE_ROLE_FORM), JSON.stringify(fields)).toMatchObject({ errors, values: { email: typed } });
    }
    expect(auditRows()).toEqual([]);
    expect(notesOf("acc-mentor")).toEqual([]);
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
  });

  it("keeps a chosen role with the error, so the radio stays chosen", async () => {
    await asAdmin();
    await redirectOf(async () => giveStaffRole(await giveForm({ email: "nobody@eduvos.com", role: "admin" })));
    expect((await readFormState(GIVE_ROLE_FORM))?.values).toEqual({ email: "nobody@eduvos.com", role: "admin" });
  });

  it("refuses a form with no token, or a made-up one, and gives nothing", async () => {
    await zola();
    await asAdmin();
    for (const once of ["", "6f1c2a3e-8c1b-4d6e-9a43-0f6f1b3a9e55"]) {
      expect(await redirectOf(() => giveStaffRole(form({ once, email: "zola@eduvos.com", role: "mentor" })))).toBe(
        "/admin/staff",
      );
      expect((await readFormState(GIVE_ROLE_FORM))?.errors).toEqual(["once-expired"]);
    }
    expect(auditRows()).toEqual([]);
  });

  it("forgets the person in the log when their account is deleted (staff tools spec 8.11)", async () => {
    const account = await zola();
    await asAdmin();
    await redirectOf(async () => giveStaffRole(await giveForm({ email: "zola@eduvos.com", role: "mentor" })));
    await deleteAccountData(account.id);
    expect(auditRows()[0]).toMatchObject({ action: "role-given", targetId: "", targetName: "Deleted account", subjectId: null });
  });
});

describe("taking a role away (stage J spec decisions 4 to 7)", () => {
  it("removes a mentor role: one entry naming the shops left without a mentor, the person told, a notice", async () => {
    await asAdmin();
    expect(await redirectOf(() => removeStaffRole(form({ account: "acc-mentor", role: "mentor" })))).toBe("/admin/staff");
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual([]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect(auditRows()).toEqual([
      expect.objectContaining({
        action: "role-removed",
        targetKind: "account",
        targetId: "acc-mentor",
        targetName: "Naledi",
        detail: "Mentor. No mentor now: Tech corner",
        subjectId: "acc-mentor",
      }),
    ]);
    expect(notesOf("acc-mentor")).toEqual([
      expect.objectContaining({
        subjectId: "mentor",
        text: "Your mentor role on Vossie has ended. Thank you for helping student sellers.",
        href: "/account",
      }),
    ]);
    // Naledi's notes and check-ins stay.
    expect([...sampleStore().mentorNotes.values()].some((row) => row.authorId === "acc-mentor")).toBe(true);
    expect(await notice()).toBe("role-removed");
    expect(request.updatedTags).toEqual([]);
  });

  it("removes another admin's role, and words the entry Admin", async () => {
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    await asAdmin();
    await redirectOf(() => removeStaffRole(form({ account: "acc-mentor", role: "admin" })));
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
    expect(auditRows()[0]).toMatchObject({ action: "role-removed", detail: "Admin" });
    expect(notesOf("acc-mentor")[0]?.text).toBe("Your admin role on Vossie has ended.");
  });

  it("refuses your own admin role, back on its confirm page with the words, changing nothing", async () => {
    await asAdmin();
    expect(await redirectOf(() => removeStaffRole(form({ account: "acc-admin", role: "admin" })))).toBe(
      "/admin/staff/acc-admin/remove-admin",
    );
    expect((await readFormState(removeRoleForm("acc-admin", "admin")))?.errors).toEqual(["staff-own-admin"]);
    expect(sampleStore().accounts.get("acc-admin")?.roles).toEqual(["admin"]);
    expect(auditRows()).toEqual([]);
    expect(notesOf("acc-admin")).toEqual([]);
  });

  it("says nothing changed for a role already gone, a forged role or a bad id, writing and sending nothing", async () => {
    await asAdmin();
    for (const fields of [
      { account: "acc-student", role: "mentor" },
      { account: "acc-mentor", role: "owner" },
      { account: "<bad>", role: "mentor" },
    ]) {
      expect(await redirectOf(() => removeStaffRole(form(fields)))).toBe("/admin/staff");
      expect(await notice(), JSON.stringify(fields)).toBe("nothing");
    }
    expect(auditRows()).toEqual([]);
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
  });
});
```

Run: `pnpm test lib/staff/account-actions.test.ts`
Expected: FAIL: `./account-actions` doesn't exist.

- [ ] **Step 2: The actions**

Create `lib/staff/account-actions.ts`:

```ts
"use server";

import { normaliseEmail } from "@/lib/auth/email";
import { writeFormState } from "@/lib/auth/form-state";
import { findAccountByEmail } from "@/lib/data/accounts";
import { recordAudit } from "@/lib/data/audit";
import { notify } from "@/lib/data/notifications";
import { giveRole, removeRole } from "@/lib/data/staff-accounts";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field } from "@/lib/selling/action-helpers";
import { requireStaff } from "./access";
import { clearStaffForm, GIVE_ROLE_FORM, leaveNotice, removeRoleForm } from "./form-state";
import { staffRoleText } from "./notification-text";
import { leaveOnceToken, type OnceSent, sentOnceToken, takeOnceToken } from "./once";
import { ADMIN_STAFF_PATH, removeRolePath } from "./paths";
import { parseStaffRole, roleLabel } from "./roles";

// Staff accounts' Server Actions (stage J spec decisions 3 to 7): giving the mentor or admin role by exact email, and
// taking one away. G's order (staff tools spec 2.2): the admin's role first, so a forged post gets the 404; the
// checks; the write; one audit entry, only when something changed; the person told, with the "staff-role" kind; a
// notice; done(). Nothing cached reads roles (getViewer() reads the store per request), so no tag is expired (plan
// decision 8). The person's next page load shows or hides their tools; their sessions aren't touched.

/** Where a role notification leads: the account page lists each staff area by role (staff tools plan decision 19). */
const ACCOUNT_PAGE = "/account";

/** A form sent again after its first send gave the role: back where that went, with its notice (G amendment 15.7). */
async function sentAgain(sent: OnceSent, now: Date): Promise<never> {
  await leaveNotice(sent.notice, now);
  done(sent.path);
}

/** Give a staff role's errors and typed values, kept in form state, never in the link (spec decision 3). */
async function backToForm(errors: string[], values: Record<string, string>, now: Date): Promise<never> {
  await writeFormState(GIVE_ROLE_FORM, { errors, values, notice: null }, now);
  done(ADMIN_STAFF_PATH);
}

/** A change that didn't happen: no audit entry, nothing sent, and the page says so (staff tools plan decision 23). */
async function nothingChanged(now: Date): Promise<never> {
  await leaveNotice("nothing", now);
  done(ADMIN_STAFF_PATH);
}

/**
 * Give a staff role (spec decision 3): the account with exactly this email, never a search. The fields are checked
 * before the one-time token is taken, so a mistake keeps it for the next try (plan decision 7).
 */
export async function giveStaffRole(formData: FormData): Promise<void> {
  const staff = await requireStaff("admin", ADMIN_STAFF_PATH);
  const now = new Date();
  const once = field(formData, "once");
  const earlier = await sentOnceToken(once, now);
  if (earlier) await sentAgain(earlier, now);
  const typed = field(formData, "email");
  const email = normaliseEmail(typed);
  const role = parseStaffRole(field(formData, "role"));
  const values = { email: keepTyped(typed), role: role ?? "" };
  const errors: string[] = [];
  if (email === "") errors.push("staff-email-missing");
  else if (!(await findAccountByEmail(email))) errors.push("staff-email-unknown");
  if (!role) errors.push("staff-role-missing");
  if (errors.length > 0 || !role) return backToForm(errors, values, now);
  const token = await takeOnceToken(once, now);
  if (token.kind === "none") return backToForm(["once-expired"], values, now);
  if (token.kind === "again") {
    if (token.sent) await sentAgain(token.sent, now);
    done(ADMIN_STAFF_PATH);
  }
  const given = await giveRole(email, role);
  if (given === "no-account") return backToForm(["staff-email-unknown"], values, now);
  if (given === "held") return backToForm(["staff-role-held"], values, now);
  await recordAudit({
    staff: { id: staff.id, firstName: staff.firstName },
    action: "role-given",
    target: { kind: "account", id: given.id, name: given.firstName },
    detail: roleLabel(role),
    subjectId: given.id,
    now,
  });
  await notify({
    accountId: given.id,
    kind: "staff-role",
    subjectId: role,
    text: staffRoleText("given", role),
    href: ACCOUNT_PAGE,
    now,
  });
  await clearStaffForm(GIVE_ROLE_FORM);
  await leaveOnceToken(once, { path: ADMIN_STAFF_PATH, notice: "role-given" }, now);
  await leaveNotice("role-given", now);
  done(ADMIN_STAFF_PATH);
}

/**
 * Take a role away, from its confirm page (spec decisions 4 and 5). Never your own admin role, never the last admin:
 * those go back to the confirm page with the words. A mentor's shops lose their mentor, and the entry names them.
 */
export async function removeStaffRole(formData: FormData): Promise<void> {
  const raw = field(formData, "account");
  const accountId = isId(raw) ? raw : null;
  const role = parseStaffRole(field(formData, "role"));
  const path = accountId && role ? removeRolePath(accountId, role) : ADMIN_STAFF_PATH;
  const staff = await requireStaff("admin", path);
  const now = new Date();
  if (!accountId || !role) return nothingChanged(now);
  const removed = await removeRole(accountId, role, staff.id);
  if (removed === "own-admin" || removed === "last-admin") {
    await writeFormState(removeRoleForm(accountId, role), { errors: [`staff-${removed}`], values: {}, notice: null }, now);
    done(path);
  }
  if (!removed) return nothingChanged(now);
  const detail =
    role === "mentor" && removed.unassigned.length > 0
      ? `Mentor. No mentor now: ${removed.unassigned.join(", ")}`
      : roleLabel(role);
  await recordAudit({
    staff: { id: staff.id, firstName: staff.firstName },
    action: "role-removed",
    target: { kind: "account", id: removed.id, name: removed.firstName },
    detail,
    subjectId: removed.id,
    now,
  });
  await notify({
    accountId: removed.id,
    kind: "staff-role",
    subjectId: role,
    text: staffRoleText("removed", role),
    href: ACCOUNT_PAGE,
    now,
  });
  await clearStaffForm(removeRoleForm(accountId, role));
  await leaveNotice("role-removed", now);
  done(ADMIN_STAFF_PATH);
}
```

- [ ] **Step 3: Run the tests**

Run: `pnpm test lib/staff/account-actions.test.ts`
Expected: PASS.

Run: `pnpm lint lib/staff/account-actions.ts lib/staff/account-actions.test.ts`
Expected: no problems.

- [ ] **Step 4: Typecheck and the whole suite, in a scratch copy**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task8"`), copying in this task's files. From `$S`: `pnpm typecheck`, `pnpm test`, `pnpm lint`. Expected: clean, all passing.

- [ ] **Step 5: Hand over**

Files: `lib/staff/account-actions.ts`, `lib/staff/account-actions.test.ts`. Message:

```
feat: giving and taking away a staff role: Give role finds the account by exact email, keeps its errors and the typed email in form state, and gives nothing on a second press; Remove refuses your own admin role on its confirm page; each change writes one audit entry under Staff accounts and tells the person with a staff-role notification linking to their account page (stage J spec decisions 3 to 7; plan decisions 7 and 8)
```

---

### Task 9: `/admin/staff` and the role confirm pages

The Staff accounts page (spec 2.2 and 2.3): the Give a staff role form above a table of everyone with a role, each role with its own Remove link, and "This is you." on the admin's own admin role. The two confirm pages (spec 2.4 and 2.5) use `ConfirmAction`'s new no-reason mode. `StaffTable` gains row headers, for Task 10's numbers.

**Files:**
- Modify: `components/staff/ConfirmAction.tsx`, `components/staff/StaffTable.tsx`, `components/staff/staff-parts.test.tsx`
- Create: `components/staff/AdminStaff.tsx`, `components/staff/AdminStaff.test.tsx`
- Create: `components/staff/StaffRoleConfirm.tsx`, `components/staff/StaffRoleConfirm.test.tsx`
- Create: `app/admin/staff/page.tsx`, `app/admin/staff/[id]/remove-mentor/page.tsx`, `app/admin/staff/[id]/remove-admin/page.tsx`
- Modify: `components/forms/summary-ids.test.tsx`

- [ ] **Step 1: Read Next's words**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (`params`, `searchParams`) and `dynamic-routes.md` ("With Cache Components"). The new pages follow Task 1's shape (or "If Task 1 failed").

- [ ] **Step 2: Write the failing tests for the shared parts**

In `components/staff/staff-parts.test.tsx`, add to the describe "staff tables (staff tools spec 2.9 and 4, plan decision 20)":

```tsx
  it("can make each row's first cell its header, with scope row and no phone label (stage J spec section 7)", () => {
    render(
      <StaffTable
        caption="All campuses, by week"
        columns={["Measure", "Last week"]}
        rows={[{ key: "listings", cells: ["Listings published", "12"] }]}
        empty=""
        rowHeader
      />,
    );
    const table = screen.getByRole("table", { name: "All campuses, by week" });
    const header = within(table).getByRole("rowheader", { name: "Listings published" });
    expect(header.tagName).toBe("TH");
    expect(header).toHaveAttribute("scope", "row");
    expect(header.querySelector(".staff-cell-label")).toBeNull();
    expect(within(table).getByRole("cell", { name: "12" })).toHaveTextContent("Last week12");
  });
```

and to the describe "confirm pages (staff tools spec 2.9 and 4, plan decision 18)":

```tsx
  it("has no reason field in its no-reason mode, and still says what's wrong (stage J spec decision 4)", () => {
    const { rerender } = render(
      <ConfirmAction
        id="remove-mentor-acc-mentor"
        lead="Remove Naledi's mentor role?"
        consequences={["Naledi mentors no shops."]}
        action={noop}
        hidden={{ account: "acc-mentor", role: "mentor" }}
        reason={false}
        errors={[]}
        confirmLabel="Remove Naledi's mentor role"
        keepHref="/admin/staff"
      />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByLabelText("Reason")).toBeNull();
    expect(screen.getByRole("button", { name: "Remove Naledi's mentor role" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="role"]')).toHaveValue("mentor");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/staff");
    rerender(
      <ConfirmAction
        id="remove-admin-acc-other"
        lead="Remove Sam's admin role?"
        consequences={[]}
        action={noop}
        hidden={{ account: "acc-other", role: "admin" }}
        reason={false}
        errors={[{ message: "Vossie needs at least one admin.", fieldId: null }]}
        confirmLabel="Remove Sam's admin role"
        keepHref="/admin/staff"
      />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveTextContent("Vossie needs at least one admin.");
  });
```

Run: `pnpm test components/staff/staff-parts.test.tsx`
Expected: FAIL: `rowHeader` still draws a `<td>` (no row header), and `reason={false}` still draws the Reason field. (Vitest doesn't typecheck, so the new props reach the components.)

- [ ] **Step 3: `StaffTable`'s row headers and `ConfirmAction`'s no-reason mode**

Replace the whole of `components/staff/StaffTable.tsx` with:

```tsx
import type { ReactNode } from "react";

type StaffTableProps = {
  caption: string;
  columns: readonly string[];
  rows: ReadonlyArray<{ key: string; cells: readonly ReactNode[] }>;
  /** What to say instead of an empty table. */
  empty: string;
  /**
   * The first cell names its row: a header cell with scope="row" (stage J spec section 7, the numbers' measures and
   * campuses). It's the card's title on phones, so it has no column label.
   */
  rowHeader?: boolean;
};

/**
 * A staff table (spec 2.9 and 4, plan decision 20): a caption and header cells. Below the tablet step each row
 * stacks into a card and each cell shows its column's name in a span screen readers skip, since the header cells
 * already name it. Explicit roles keep it a table for screen readers when CSS changes how it displays.
 */
export function StaffTable({ caption, columns, rows, empty, rowHeader = false }: StaffTableProps) {
  if (rows.length === 0) return <p className="staff-empty">{empty}</p>;
  return (
    <table role="table" className="staff-table">
      <caption className="staff-caption">{caption}</caption>
      <thead role="rowgroup">
        <tr role="row">
          {columns.map((column) => (
            <th key={column} role="columnheader" scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((row) => (
          <tr key={row.key} role="row">
            {row.cells.map((cell, index) =>
              rowHeader && index === 0 ? (
                // Utilities, not new CSS (stage J plan decision 3): a block on phones, a cell from the tablet step,
                // and body text rather than .staff-table th's small muted column-header style.
                <th
                  key={columns[index]}
                  role="rowheader"
                  scope="row"
                  className="block py-1 text-left text-body font-semibold text-ink wide:table-cell wide:py-3"
                >
                  {cell}
                </th>
              ) : (
                <td key={columns[index]} role="cell">
                  <span className="staff-cell-label" aria-hidden="true">
                    {columns[index]}
                  </span>
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Replace the whole of `components/staff/ConfirmAction.tsx` with:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { REASON_MAX } from "@/lib/staff/rules";

type ConfirmActionProps = {
  /** The form's id prefix, unique across the pages Next keeps ("decline-crochet-corner"). */
  id: string;
  /** What will happen, in a sentence (spec 4: confirm pages repeat what will happen). */
  lead: ReactNode;
  /** What follows from it, a line each. */
  consequences: readonly string[];
  action: (formData: FormData) => Promise<void>;
  /** The hidden fields that say what it's about. */
  hidden: Readonly<Record<string, string>>;
  errors: readonly FormError[];
  /** The button names what it does to what: "Decline Crochet corner" (spec 4). */
  confirmLabel: string;
  /** Where Keep it goes back to. */
  keepHref: string;
} & (
  | {
      /** What was typed before a failed post, or "". */
      reason: string;
      /** Who sees the reason. */
      reasonHint: string;
    }
  | {
      /**
       * No reason field (stage J spec decision 4): taking a role away and Show again need none, as the person needs
       * none to read and the audit log records the action.
       */
      reason: false;
      reasonHint?: undefined;
    }
);

function ReasonField({ fieldId, hint, reason, error }: { fieldId: string; hint: string; reason: string; error: string | undefined }) {
  return (
    <div className="form-field">
      <label htmlFor={fieldId} className="form-label">
        Reason
      </label>
      <p id={`${fieldId}-hint`} className="form-hint">
        {hint} Up to {REASON_MAX} characters.
      </p>
      <FieldError id={`${fieldId}-error`} message={error} />
      <textarea
        id={fieldId}
        name="reason"
        rows={4}
        required
        defaultValue={reason}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${fieldId}-hint`, error && `${fieldId}-error`)}
        className="form-input staff-textarea"
      />
    </div>
  );
}

/**
 * A destructive action's confirm page (spec 2.9, plan decision 18): what will happen, the reason (required, up to 500
 * characters) unless the page has none, the button that does it, and Keep it, a link back. A plain form: it works
 * without the app's JavaScript, and the server checks everything again.
 */
export function ConfirmAction(props: ConfirmActionProps) {
  const { id, lead, consequences, action, hidden, errors, confirmLabel, keepHref } = props;
  const fieldId = `${id}-reason`;
  return (
    <div className="staff-confirm">
      <p className="staff-confirm-lead">{lead}</p>
      {consequences.length > 0 && (
        <ul className="staff-confirm-list">
          {consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <ErrorSummary id={`${id}-summary`} errors={errors} />
      <form action={action} noValidate className="form-stack">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {props.reason === false ? null : (
          <ReasonField fieldId={fieldId} hint={props.reasonHint} reason={props.reason} error={errorFor(errors, fieldId)} />
        )}
        <div className="staff-actions">
          <button type="submit" className="btn btn-danger">
            {confirmLabel}
          </button>
          <Link href={keepHref} prefetch={false} className="link-button">
            Keep it
          </Link>
        </div>
      </form>
    </div>
  );
}
```

Run: `pnpm test components/staff`
Expected: PASS (G's confirm-page and table tests unchanged, the two new ones passing).

- [ ] **Step 4: Write the failing tests for the page's parts**

Create `components/staff/AdminStaff.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StaffAccount } from "@/lib/data/staff-accounts";
import { AdminStaff, mentoredText } from "./AdminStaff";

// The form only needs something to post to; the actions have their own tests.
vi.mock("@/lib/staff/account-actions", () => ({ giveStaffRole: async () => {}, removeStaffRole: async () => {} }));

const naledi: StaffAccount = {
  id: "acc-mentor",
  firstName: "Naledi",
  email: "mentor@eduvos.com",
  campusSlug: "midrand",
  roles: ["mentor"],
  mentors: ["Tech corner"],
};
const pieter: StaffAccount = {
  id: "acc-admin",
  firstName: "Pieter",
  email: "admin@eduvos.com",
  campusSlug: "pretoria",
  roles: ["admin"],
  mentors: [],
};
const campusNames = new Map([
  ["midrand", "Midrand"],
  ["pretoria", "Pretoria"],
]);
const TOKEN = "6f1c2a3e-8c1b-4d6e-9a43-0f6f1b3a9e55";

function view(overrides: Partial<Parameters<typeof AdminStaff>[0]> = {}) {
  return render(
    <AdminStaff
      people={[naledi, pieter]}
      viewerId="acc-admin"
      campusNames={campusNames}
      values={{}}
      errors={[]}
      once={TOKEN}
      {...overrides}
    />,
  );
}

describe("Staff accounts (stage J spec decision 2)", () => {
  it("lists everyone with a role in a captioned table: name, email, campus, roles, shops and one action cell", () => {
    view();
    const table = screen.getByRole("table", { name: "Staff accounts (2)" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Name",
      "Email",
      "Campus",
      "Roles",
      "Shops they mentor",
      "Change",
    ]);
    const [, first, second] = within(table).getAllByRole("row");
    expect(within(first).getAllByRole("cell").slice(0, 5).map((cell) => cell.textContent)).toEqual([
      "NameNaledi",
      "Emailmentor@eduvos.com",
      "CampusMidrand",
      "RolesMentor",
      "Shops they mentor1",
    ]);
    expect(within(second).getAllByRole("cell")[4]).toHaveTextContent("None");
  });

  it("gives each role its own Remove link, naming the person for screen readers", () => {
    view({ people: [{ ...naledi, roles: ["mentor", "admin"] }, pieter] });
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByRole("link", { name: "Remove Naledi's mentor role" })).toHaveAttribute(
      "href",
      "/admin/staff/acc-mentor/remove-mentor",
    );
    expect(within(row).getByRole("link", { name: "Remove Naledi's admin role" })).toHaveAttribute(
      "href",
      "/admin/staff/acc-mentor/remove-admin",
    );
    // The name is for screen readers; the pill itself reads "Remove mentor role".
    expect(within(row).getAllByText("Naledi's")[0]).toHaveClass("sr-only");
  });

  it("says This is you. on the admin's own admin role, with no link to remove it (spec decision 5)", () => {
    view();
    const own = screen.getAllByRole("row")[2];
    expect(within(own).queryByRole("link")).toBeNull();
    expect(within(own).getByText("This is you.")).toBeInTheDocument();
  });

  it("counts the shops a mentor mentors, and says None for an admin who isn't one (plan decision 11)", () => {
    expect(mentoredText({ roles: ["mentor"], mentors: [] })).toBe("0");
    expect(mentoredText({ roles: ["mentor", "admin"], mentors: ["A", "B"] })).toBe("2");
    expect(mentoredText({ roles: ["admin"], mentors: [] })).toBe("None");
  });
});

describe("Give a staff role (stage J spec decision 3)", () => {
  it("asks for the exact email and one of two roles, with a one-time token, and searches nothing", () => {
    view();
    const section = screen.getByRole("region", { name: "Give a staff role" });
    const email = within(section).getByLabelText("Eduvos email");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "off");
    expect(email).toHaveAccessibleDescription(
      "The email they sign in with. They need to have signed in to Vossie once.",
    );
    const group = within(section).getByRole("group", { name: "Role" });
    expect(within(group).getByRole("radio", { name: "Mentor" })).toHaveAccessibleDescription(
      "The Hub's posts and office hours, and the mentor dashboard",
    );
    expect(within(group).getByRole("radio", { name: "Admin" })).toHaveAccessibleDescription("Everything, including this page");
    expect(section.querySelector('input[name="once"]')).toHaveValue(TOKEN);
    expect(within(section).getByRole("button", { name: "Give role" })).toHaveAttribute("type", "submit");
    expect(within(section).queryByRole("combobox")).toBeNull();
    expect(within(section).queryByRole("listbox")).toBeNull();
  });

  it("keeps the typed email and the chosen role with what's wrong", () => {
    view({
      values: { email: "nobody@eduvos.com", role: "admin" },
      errors: [
        {
          message: "No Vossie account uses that email. Ask them to sign in once, then try again.",
          fieldId: "give-role-email",
        },
      ],
    });
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveAttribute("id", "give-role-problems");
    const email = screen.getByLabelText("Eduvos email");
    expect(email).toHaveValue("nobody@eduvos.com");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("radio", { name: "Admin" })).toBeChecked();
  });
});
```

Create `components/staff/StaffRoleConfirm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StaffAccount } from "@/lib/data/staff-accounts";
import { removalLines, StaffRoleConfirm } from "./StaffRoleConfirm";

vi.mock("@/lib/staff/account-actions", () => ({ giveStaffRole: async () => {}, removeStaffRole: async () => {} }));

const naledi: StaffAccount = {
  id: "acc-mentor",
  firstName: "Naledi",
  email: "mentor@eduvos.com",
  campusSlug: "midrand",
  roles: ["mentor"],
  mentors: ["Plug & play", "Tech corner"],
};

describe("taking a role away (stage J spec decisions 4 and 5)", () => {
  it("says what removing a mentor role does, names the shops, and has no reason field", () => {
    render(<StaffRoleConfirm person={naledi} role="mentor" viewerId="acc-admin" errors={[]} />);
    expect(screen.getByText("Remove Naledi's mentor role?")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Naledi loses the Hub's tools and the mentor dashboard straight away.",
      "These shops will have no mentor: Plug & play, Tech corner. Give them a new one on each shop's page.",
      "Naledi's notes, check-ins and Hub posts stay. Only an admin can edit those posts afterwards.",
    ]);
    expect(screen.queryByLabelText("Reason")).toBeNull();
    expect(screen.getByRole("button", { name: "Remove Naledi's mentor role" })).toHaveClass("btn-danger");
    expect(document.querySelector('input[name="account"]')).toHaveValue("acc-mentor");
    expect(document.querySelector('input[name="role"]')).toHaveValue("mentor");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/staff");
  });

  it("says a mentor with no shops mentors none, and that an admin keeps the tools (plan decision 10)", () => {
    expect(removalLines({ ...naledi, mentors: [] }, "mentor")[1]).toBe("Naledi mentors no shops.");
    expect(removalLines({ ...naledi, roles: ["mentor", "admin"] }, "mentor")[0]).toBe(
      "Naledi stays an admin, so keeps the Hub's tools and the mentor dashboard.",
    );
  });

  it("says what removing another admin's role does", () => {
    const sam: StaffAccount = { ...naledi, id: "acc-sam", firstName: "Sam", roles: ["admin"], mentors: [] };
    render(<StaffRoleConfirm person={sam} role="admin" viewerId="acc-admin" errors={[]} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Sam loses the admin console straight away.",
      "Sam's entries in the audit log stay.",
    ]);
    expect(screen.getByRole("button", { name: "Remove Sam's admin role" })).toBeInTheDocument();
  });

  it("refuses your own admin role, with no button and a way back", () => {
    const pieter: StaffAccount = { ...naledi, id: "acc-admin", firstName: "Pieter", roles: ["admin"], mentors: [] };
    render(<StaffRoleConfirm person={pieter} role="admin" viewerId="acc-admin" errors={[]} />);
    expect(screen.getByText("You can't remove your own admin role. Ask another admin.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to staff accounts" })).toHaveAttribute("href", "/admin/staff");
  });

  it("shows a refusal from the last post at the top", () => {
    const sam: StaffAccount = { ...naledi, id: "acc-sam", firstName: "Sam", roles: ["admin"], mentors: [] };
    render(
      <StaffRoleConfirm
        person={sam}
        role="admin"
        viewerId="acc-admin"
        errors={[{ message: "Vossie needs at least one admin.", fieldId: null }]}
      />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveTextContent("Vossie needs at least one admin.");
  });
});
```

Run: `pnpm test components/staff/AdminStaff.test.tsx components/staff/StaffRoleConfirm.test.tsx`
Expected: FAIL: the components don't exist.

- [ ] **Step 5: The page's parts**

Create `components/staff/AdminStaff.tsx`:

```tsx
import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { StaffAccount } from "@/lib/data/staff-accounts";
import { giveStaffRole } from "@/lib/staff/account-actions";
import { GIVE_ROLE_FIELDS } from "@/lib/staff/errors";
import { removeRolePath } from "@/lib/staff/paths";
import { ROLE_CHOICES, rolesText } from "@/lib/staff/roles";
import type { StaffRole } from "@/lib/types";
import { StaffTable } from "./StaffTable";

type AdminStaffProps = {
  people: readonly StaffAccount[];
  /** The signed-in admin: their own admin role has no Remove link (spec decision 5). */
  viewerId: string;
  campusNames: ReadonlyMap<string, string>;
  /** What was typed and chosen before a failed Give role. */
  values: Readonly<Record<string, string>>;
  errors: readonly FormError[];
  /** Give role's one-time token (staff tools amendment 15.7), or null, when a send is refused as out of date. */
  once: string | null;
};

/** "1", "0", or "None" for an admin who isn't a mentor and mentors none (spec decision 2, plan decision 11). */
export function mentoredText(person: Pick<StaffAccount, "roles" | "mentors">): string {
  if (person.mentors.length === 0 && !person.roles.includes("mentor")) return "None";
  return String(person.mentors.length);
}

function RemoveLink({ person, role }: { person: StaffAccount; role: StaffRole }) {
  return (
    <Link href={removeRolePath(person.id, role)} prefetch={false} className="staff-row-action staff-row-action-danger">
      Remove <span className="sr-only">{`${person.firstName}'s`}</span> {role} role
    </Link>
  );
}

/** One link per role; the admin's own admin role says "This is you." instead (spec decision 5). */
function RowActions({ person, viewerId }: { person: StaffAccount; viewerId: string }) {
  return (
    <div className="staff-row-actions">
      {person.roles.map((role) =>
        role === "admin" && person.id === viewerId ? (
          <span key={role} className="staff-muted">
            This is you.
          </span>
        ) : (
          <RemoveLink key={role} person={person} role={role} />
        ),
      )}
    </div>
  );
}

/** Give a staff role (spec decision 3): the exact email and a role, never a search, a suggestion or a list. */
function GiveRoleForm({ values, errors, once }: Pick<AdminStaffProps, "values" | "errors" | "once">) {
  const emailError = errorFor(errors, GIVE_ROLE_FIELDS.email);
  const roleError = errorFor(errors, GIVE_ROLE_FIELDS.role);
  const emailHint = `${GIVE_ROLE_FIELDS.email}-hint`;
  const emailErrorId = `${GIVE_ROLE_FIELDS.email}-error`;
  return (
    <section aria-labelledby="admin-staff-give-title" className="staff-section">
      <h2 id="admin-staff-give-title" className="staff-section-title">
        Give a staff role
      </h2>
      <ErrorSummary id="give-role-problems" errors={errors} />
      <form action={giveStaffRole} noValidate className="form-stack staff-inline-form">
        {once && <input type="hidden" name="once" value={once} />}
        <div className="form-field">
          <label htmlFor={GIVE_ROLE_FIELDS.email} className="form-label">
            Eduvos email
          </label>
          <p id={emailHint} className="form-hint">
            The email they sign in with. They need to have signed in to Vossie once.
          </p>
          <FieldError id={emailErrorId} message={emailError} />
          <input
            id={GIVE_ROLE_FIELDS.email}
            name="email"
            type="email"
            autoComplete="off"
            required
            defaultValue={values.email ?? ""}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={describedBy(emailHint, emailError && emailErrorId)}
            className="form-input"
          />
        </div>
        <fieldset className="form-field" aria-describedby={describedBy(roleError && "give-role-role-error")}>
          <legend className="form-label">Role</legend>
          <FieldError id="give-role-role-error" message={roleError} />
          {ROLE_CHOICES.map((choice) => {
            const radioId = `give-role-role-${choice.role}`;
            return (
              <div key={choice.role} className="staff-radio">
                <div className="form-check">
                  <input
                    id={radioId}
                    type="radio"
                    name="role"
                    value={choice.role}
                    required
                    defaultChecked={values.role === choice.role}
                    aria-describedby={`${radioId}-hint`}
                    className="form-checkbox"
                  />
                  <label htmlFor={radioId}>{choice.label}</label>
                </div>
                <p id={`${radioId}-hint`} className="form-hint staff-radio-hint">
                  {choice.hint}
                </p>
              </div>
            );
          })}
        </fieldset>
        <button type="submit" className="btn btn-primary form-submit">
          Give role
        </button>
      </form>
    </section>
  );
}

/**
 * Staff accounts (spec decisions 2 and 3): the Give a staff role form, then everyone with a role, and no one else. The
 * email is shown because roles are given by email and two staff may share a first name. Server-rendered, with no
 * client code. The words are samples for Lama to change.
 */
export function AdminStaff({ people, viewerId, campusNames, values, errors, once }: AdminStaffProps) {
  return (
    <>
      <GiveRoleForm values={values} errors={errors} once={once} />
      <section aria-labelledby="admin-staff-list-title" className="staff-section">
        <h2 id="admin-staff-list-title" className="staff-section-title">
          Who has a role
        </h2>
        <p className="staff-muted">
          Only people with a staff role are listed. Roles aren&apos;t tied to a campus: each person&apos;s campus is the
          one they chose.
        </p>
        <StaffTable
          caption={`Staff accounts (${people.length})`}
          columns={["Name", "Email", "Campus", "Roles", "Shops they mentor", "Change"]}
          rows={people.map((person) => ({
            key: person.id,
            cells: [
              person.firstName,
              person.email,
              campusNames.get(person.campusSlug) ?? person.campusSlug,
              rolesText(person.roles),
              mentoredText(person),
              <RowActions key="change" person={person} viewerId={viewerId} />,
            ],
          }))}
          empty="No one has a staff role."
        />
      </section>
    </>
  );
}
```

(`Remove <span className="sr-only">…</span> {role} role` keeps the spaces outside the span, so the link is named "Remove Naledi's mentor role" and reads "Remove mentor role".)

Create `components/staff/StaffRoleConfirm.tsx`:

```tsx
import Link from "next/link";
import type { FormError } from "@/lib/auth/messages";
import type { StaffAccount } from "@/lib/data/staff-accounts";
import { removeStaffRole } from "@/lib/staff/account-actions";
import { ADMIN_STAFF_PATH } from "@/lib/staff/paths";
import type { StaffRole } from "@/lib/types";
import { ConfirmAction } from "./ConfirmAction";

type StaffRoleConfirmProps = {
  person: StaffAccount;
  role: StaffRole;
  /** The signed-in admin, who can't remove their own admin role (spec decision 5). */
  viewerId: string;
  errors: readonly FormError[];
};

/** What taking `role` away does, a line each (spec decision 4, plan decision 10). Samples for Lama to change. */
export function removalLines(person: Pick<StaffAccount, "firstName" | "roles" | "mentors">, role: StaffRole): string[] {
  const name = person.firstName;
  if (role === "admin") {
    return [`${name} loses the admin console straight away.`, `${name}'s entries in the audit log stay.`];
  }
  return [
    person.roles.includes("admin")
      ? `${name} stays an admin, so keeps the Hub's tools and the mentor dashboard.`
      : `${name} loses the Hub's tools and the mentor dashboard straight away.`,
    person.mentors.length > 0
      ? `These shops will have no mentor: ${person.mentors.join(", ")}. Give them a new one on each shop's page.`
      : `${name} mentors no shops.`,
    `${name}'s notes, check-ins and Hub posts stay. Only an admin can edit those posts afterwards.`,
  ];
}

/**
 * A role's confirm page (spec decisions 4 and 5): what will happen, then the button, with no reason field. Your own
 * admin role gets the refusal and no button; the action refuses it too.
 */
export function StaffRoleConfirm({ person, role, viewerId, errors }: StaffRoleConfirmProps) {
  if (role === "admin" && person.id === viewerId) {
    return (
      <div className="staff-confirm">
        <p className="staff-confirm-lead">You can&apos;t remove your own admin role. Ask another admin.</p>
        <p>
          <Link href={ADMIN_STAFF_PATH} prefetch={false}>
            Back to staff accounts
          </Link>
        </p>
      </div>
    );
  }
  const label = `Remove ${person.firstName}'s ${role} role`;
  return (
    <ConfirmAction
      id={`remove-${role}-${person.id}`}
      lead={`${label}?`}
      consequences={removalLines(person, role)}
      action={removeStaffRole}
      hidden={{ account: person.id, role }}
      reason={false}
      errors={errors}
      confirmLabel={label}
      keepHref={ADMIN_STAFF_PATH}
    />
  );
}
```

Run: `pnpm test components/staff`
Expected: PASS.

- [ ] **Step 6: The three pages**

Create `app/admin/staff/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AdminStaff } from "@/components/staff/AdminStaff";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { listStaffAccounts } from "@/lib/data/staff-accounts";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { GIVE_ROLE_FIELDS, staffErrors } from "@/lib/staff/errors";
import { GIVE_ROLE_FORM, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { issueOnceToken } from "@/lib/staff/once";
import { ADMIN_STAFF_PATH } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Staff accounts");
}

/** Staff accounts (stage J spec decisions 2 and 3). Admins only. */
export default async function AdminStaffPage() {
  const account = await requireStaff("admin", ADMIN_STAFF_PATH);
  // Give role gets a one-time token, made now, at request time (staff tools amendment 15.7).
  const [people, campuses, state, notice, once] = await Promise.all([
    listStaffAccounts(),
    getCampuses(),
    readFormState(GIVE_ROLE_FORM),
    takeNotice(),
    issueOnceToken(),
  ]);
  return (
    <StaffFrame account={account} area="Admin console" title="Staff accounts" current={ADMIN_STAFF_PATH} notice={staffNoticeText(notice)}>
      <AdminStaff
        people={people}
        viewerId={account.id}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
        values={state?.values ?? {}}
        errors={staffErrors(state?.errors ?? [], GIVE_ROLE_FIELDS)}
        once={once}
      />
    </StaffFrame>
  );
}
```

Create `app/admin/staff/[id]/remove-mentor/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffRoleConfirm } from "@/components/staff/StaffRoleConfirm";
import { readFormState } from "@/lib/auth/form-state";
import { getStaffAccount } from "@/lib/data/staff-accounts";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors } from "@/lib/staff/errors";
import { removeRoleForm } from "@/lib/staff/form-state";
import { ADMIN_STAFF_PATH, removeRolePath } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Remove a role");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no account. */
export function generateStaticParams() {
  return [{ id: "acc-sample" }];
}

/** Remove a mentor role's confirm page (stage J spec decision 4). Someone who isn't a mentor is the 404. */
export default async function RemoveMentorPage({ params }: PageProps<"/admin/staff/[id]/remove-mentor">) {
  const { id } = await params;
  const account = await requireStaff("admin", removeRolePath(id, "mentor"));
  const person = isId(id) ? await getStaffAccount(id) : null;
  if (!person || !person.roles.includes("mentor")) notFound();
  const state = await readFormState(removeRoleForm(id, "mentor"));
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title={`Remove ${person.firstName}'s mentor role`}
      current={ADMIN_STAFF_PATH}
      notice={null}
    >
      <StaffRoleConfirm person={person} role="mentor" viewerId={account.id} errors={staffErrors(state?.errors ?? [], {})} />
    </StaffFrame>
  );
}
```

Create `app/admin/staff/[id]/remove-admin/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffRoleConfirm } from "@/components/staff/StaffRoleConfirm";
import { readFormState } from "@/lib/auth/form-state";
import { getStaffAccount } from "@/lib/data/staff-accounts";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors } from "@/lib/staff/errors";
import { removeRoleForm } from "@/lib/staff/form-state";
import { ADMIN_STAFF_PATH, removeRolePath } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Remove a role");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no account. */
export function generateStaticParams() {
  return [{ id: "acc-sample" }];
}

/**
 * Remove an admin role's confirm page (stage J spec decisions 4 and 5). Someone who isn't an admin is the 404; your
 * own admin role shows the refusal and no button.
 */
export default async function RemoveAdminPage({ params }: PageProps<"/admin/staff/[id]/remove-admin">) {
  const { id } = await params;
  const account = await requireStaff("admin", removeRolePath(id, "admin"));
  const person = isId(id) ? await getStaffAccount(id) : null;
  if (!person || !person.roles.includes("admin")) notFound();
  const state = await readFormState(removeRoleForm(id, "admin"));
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title={`Remove ${person.firstName}'s admin role`}
      current={ADMIN_STAFF_PATH}
      notice={null}
    >
      <StaffRoleConfirm person={person} role="admin" viewerId={account.id} errors={staffErrors(state?.errors ?? [], {})} />
    </StaffFrame>
  );
}
```

If Task 1 failed, write these three pages in G's shape instead (conventions, "If Task 1 failed").

- [ ] **Step 7: The error summaries' ids**

In `components/forms/summary-ids.test.tsx`:
- add the imports

```tsx
import { AdminStaff } from "@/components/staff/AdminStaff";
import { StaffRoleConfirm } from "@/components/staff/StaffRoleConfirm";
```

- add after the `vi.mock("@/lib/staff/mentor-actions", …)` line:

```tsx
vi.mock("@/lib/staff/account-actions", () => ({ giveStaffRole: async () => {}, removeStaffRole: async () => {} }));
```

- inside the rendered fragment, after the `<OfferView … />` element, add:

```tsx
        <AdminStaff
          people={[]}
          viewerId="acc-admin"
          campusNames={new Map()}
          values={{}}
          errors={oops}
          once="5c2e8a1d-3b4f-4e6a-9d71-2f8c0b6e4a19"
        />
        <StaffRoleConfirm
          person={{
            id: "acc-mentor",
            firstName: "Naledi",
            email: "mentor@eduvos.com",
            campusSlug: "midrand",
            roles: ["mentor"],
            mentors: [],
          }}
          role="mentor"
          viewerId="acc-admin"
          errors={oops}
        />
```

- change `expect(summaries).toHaveLength(32);` to `expect(summaries).toHaveLength(34);`, and add after `"offer-r-001-summary",` in the expected id list:

```tsx
      "give-role-problems",
      "remove-mentor-acc-mentor-summary",
```

Run: `pnpm test components/forms/summary-ids.test.tsx components/staff`
Expected: PASS.

Run: `pnpm lint components/staff components/forms app/admin/staff`
Expected: no problems.

- [ ] **Step 8: Build, check the statuses, and look at it**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task9"`), copying in this task's files. From `$S`: `pnpm typecheck`, `pnpm test`, `pnpm lint`, then `pnpm build`. Expected: clean; the build lists `/admin/staff`, `/admin/staff/[id]/remove-mentor` and `/admin/staff/[id]/remove-admin` as dynamic, with no Suspense or generateMetadata error.

Start `pnpm start --port 3204` in the background, make `j-session.mjs` (Task 1, Step 5) and get `STUDENT`, `MENTOR` and `ADMIN`. Then:

```bash
for path in /admin/staff /admin/staff/acc-mentor/remove-mentor /admin/staff/acc-admin/remove-admin \
  /admin/staff/acc-student/remove-mentor /admin/staff/acc-mentor/remove-admin; do
  echo "$path $(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3204$path") \
$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: vossie_session=$MENTOR" "http://localhost:3204$path") \
$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: vossie_session=$ADMIN" "http://localhost:3204$path")"
done
```

Expected (signed out, mentor, admin): `307 404 200` for the first three; `307 404 404` for `acc-student/remove-mentor` (no role) and `acc-mentor/remove-admin` (not an admin). If Task 1 failed, every status is `200` and the student's and mentor's pages show the 404 inside.

**Looking at it.** Write this throwaway script as `$S/j-look.mjs` (Tasks 10 and 11 reuse it):

```js
// Screenshots of staff pages, signed in as the sample admin, at three sizes (stage J plan, "Looking at it").
import { chromium } from "@playwright/test";

const [out, ...paths] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [width, height] of [
  [390, 844],
  [768, 1024],
  [1280, 800],
]) {
  const page = await browser.newPage({ baseURL: "http://localhost:3204", viewport: { width, height } });
  await page.goto("/login?next=%2Faccount");
  await page.locator("main").getByRole("button", { name: "Admin", exact: true }).click();
  await page.waitForURL("**/account");
  for (const path of paths) {
    await page.goto(path);
    await page.screenshot({ path: `${out}/${path.replaceAll(/[^a-z0-9]+/gi, "-")}-${width}.png`, fullPage: true });
  }
  await page.close();
}
await browser.close();
```

From `$S`: `mkdir look && node j-look.mjs look /admin/staff /admin/staff/acc-mentor/remove-mentor /admin/staff/acc-admin/remove-admin`. Open the PNGs and check: the form and the table read at each size, the table is cards on the phone, the Remove links are red-outlined 44px pills with "Remove mentor role" on them, the own row says "This is you.", and the refusal page has no button. Press Give role with nothing typed and look again at 390px: the summary and both field errors. Stop the server.

- [ ] **Step 9: Hand over**

Files: `components/staff/ConfirmAction.tsx`, `components/staff/StaffTable.tsx`, `components/staff/staff-parts.test.tsx`, `components/staff/AdminStaff.tsx`, `components/staff/AdminStaff.test.tsx`, `components/staff/StaffRoleConfirm.tsx`, `components/staff/StaffRoleConfirm.test.tsx`, `app/admin/staff/page.tsx`, `app/admin/staff/[id]/remove-mentor/page.tsx`, `app/admin/staff/[id]/remove-admin/page.tsx`, `components/forms/summary-ids.test.tsx`. Message:

```
feat: /admin/staff lists everyone with a staff role (name, email, campus, roles, shops mentored) under the Give a staff role form, with a Remove link per role and "This is you." on the admin's own admin role; the remove-mentor and remove-admin confirm pages say what will happen, through ConfirmAction's new no-reason mode, and refuse your own admin role; StaffTable gains row headers (stage J spec decisions 2 to 5; plan decisions 3, 9 to 11). Blocking pages: 307 signed out, 404 for a mentor
```

---

### Task 10: `/admin/numbers`

The admin's numbers page (spec 2.9 to 2.13): the lines above the tables, "All campuses" by week, "By campus, last week" with a link to each campus's view, the campus view, and the key under each table. Every figure goes through `protectCounts`. No client code, no charts.

**Files:**
- Create: `components/staff/AdminNumbers.tsx`, `components/staff/AdminNumbers.test.tsx`
- Create: `app/admin/numbers/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/staff/AdminNumbers.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MEASURES,
  protectCounts,
  sastWeeks,
  type Measure,
  type Period,
  type RawColumn,
  type RawCounts,
} from "@/lib/staff/numbers";
import { AdminNumbers } from "./AdminNumbers";

const CAMPUSES = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];
const SLUGS = CAMPUSES.map((campus) => campus.slug);
const WEEKS = sastWeeks(new Date("2026-10-20T08:00:00.000Z"));

const column = (campuses: Record<string, number> = {}, gone = 0): RawColumn => ({ campuses, gone });

function shown() {
  const counts = Object.fromEntries(
    MEASURES.map(({ measure }) => [measure, { last: column(), before: column(), since: column() }]),
  ) as Record<Measure, Record<Period, RawColumn>>;
  counts.listings = { last: column({ midrand: 6, pretoria: 2 }), before: column({ midrand: 4 }), since: column({ midrand: 40, pretoria: 9 }) };
  counts.enquiries = { last: column({ midrand: 3, pretoria: 12 }), before: column({ midrand: 8 }), since: column({ midrand: 23 }) };
  const raw: RawCounts = { counts, openShops: column({ midrand: 5, pretoria: 2 }) };
  return protectCounts(raw, SLUGS);
}

function view(campus: (typeof CAMPUSES)[number] | null = null, sampleMode = true) {
  return render(<AdminNumbers weeks={WEEKS} shown={shown()} campuses={CAMPUSES} campus={campus} sampleMode={sampleMode} />);
}

describe("the admin's numbers (stage J spec decisions 10 to 13)", () => {
  it("says how it counts, and that the preview's store starts again on restart", () => {
    view();
    expect(screen.getByText(/^Counted from Vossie's store as this page opens\./)).toHaveTextContent(
      'Small numbers of private things show as "Under 5" so no one can be picked out.',
    );
    expect(screen.getByText("In this preview the store starts again whenever the server restarts.")).toBeInTheDocument();
  });

  it("leaves the preview line out outside sample mode", () => {
    view(null, false);
    expect(screen.queryByText(/In this preview/)).toBeNull();
  });

  it("has an All campuses table by week, each measure a row header, with Open shops now not counted by week", () => {
    view();
    const table = screen.getByRole("table", { name: "All campuses, by week" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Measure",
      "Last week (12 to 18 Oct)",
      "The week before (5 to 11 Oct)",
      "Change",
      "Since the start",
    ]);
    const listings = within(table).getByRole("rowheader", { name: "Listings published" });
    expect(listings).toHaveAttribute("scope", "row");
    expect(listings.closest("tr")).toHaveTextContent(/Listings published.*8.*4.*\+4.*49/);
    // Enquiries are private: the week before's total is 8, so last week's change shows; since the start is in tens.
    expect(within(table).getByRole("rowheader", { name: "Enquiries started" }).closest("tr")).toHaveTextContent(
      /Enquiries started.*15.*8.*\+7.*20\+/,
    );
    const open = within(table).getByRole("rowheader", { name: "Open shops now" }).closest("tr")!;
    expect(within(open).getAllByText("Not counted by week")).toHaveLength(3);
    expect(open).toHaveTextContent("7");
  });

  it("has a By campus table for last week, each campus a 44px link to its view, then All campuses", () => {
    view();
    const table = screen.getByRole("table", { name: "By campus, last week (12 to 18 Oct)" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Campus",
      ...MEASURES.map((measure) => measure.label),
      "Open shops now",
    ]);
    const midrand = within(table).getByRole("link", { name: "Midrand" });
    expect(midrand).toHaveAttribute("href", "/admin/numbers?campus=midrand");
    expect(midrand).toHaveClass("min-h-11");
    // Midrand's 3 enquiries are Under 5, so Pretoria's 12, the next smallest, is Hidden.
    expect(midrand.closest("tr")).toHaveTextContent("Under 5");
    expect(within(table).getByRole("link", { name: "Pretoria" }).closest("tr")).toHaveTextContent("Hidden");
    expect(within(table).getByRole("rowheader", { name: "All campuses" }).closest("tr")).toHaveTextContent("15");
  });

  it("explains every word under each table, and names, ids or links nothing counted", () => {
    const { container } = view();
    expect(screen.getAllByText("Hidden: not shown, so the total can't reveal a small number.")).toHaveLength(2);
    expect(screen.getAllByText(/Admins can still open each report in the Reports queue/)).toHaveLength(2);
    const links = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(links.every((href) => href?.startsWith("/admin/numbers?campus="))).toBe(true);
  });

  it("shows one campus's view, captioned with its name, with a link back to All campuses", () => {
    view(CAMPUSES[0]);
    const table = screen.getByRole("table", { name: "Midrand, by week" });
    expect(within(table).getByRole("rowheader", { name: "Listings published" }).closest("tr")).toHaveTextContent(
      /Listings published.*6.*4.*\+2.*40/,
    );
    expect(within(table).getByRole("rowheader", { name: "Enquiries started" }).closest("tr")).toHaveTextContent(
      /Under 5.*8.*—.*20\+/,
    );
    expect(screen.getByRole("link", { name: "All campuses" })).toHaveAttribute("href", "/admin/numbers");
    expect(screen.queryByRole("table", { name: /^By campus/ })).toBeNull();
  });
});
```

Run: `pnpm test components/staff/AdminNumbers.test.tsx`
Expected: FAIL: `./AdminNumbers` doesn't exist.

- [ ] **Step 2: The view**

Create `components/staff/AdminNumbers.tsx`:

```tsx
import Link from "next/link";
import {
  HIDDEN,
  MEASURES,
  NO_CHANGE,
  NOT_BY_WEEK,
  UNDER_FIVE,
  type SastWeeks,
  type ShownColumn,
  type ShownCounts,
} from "@/lib/staff/numbers";
import { ADMIN_NUMBERS_PATH, numbersPath } from "@/lib/staff/paths";
import { StaffTable } from "./StaffTable";

type Place = { slug: string; name: string };

type AdminNumbersProps = {
  weeks: SastWeeks;
  /** Every figure, after the small-number rule (lib/staff/numbers.ts). */
  shown: ShownCounts;
  /** Every campus, Eduvos Online included, in the page's order. */
  campuses: readonly Place[];
  /** The campus view's campus, or null for the main page. */
  campus: Place | null;
  /** The preview's line (plan decision 25). */
  sampleMode: boolean;
};

/** A By campus link: 44px tall, sky-dark and underlined (utilities, stage J plan decision 3). */
const CAMPUS_LINK = "inline-flex min-h-11 items-center font-semibold text-sky-dark underline underline-offset-3";

/** One place's rows, measure by measure, then Open shops now: the All campuses table's, or one campus's. */
function placeRows(shown: ShownCounts, pick: (column: ShownColumn) => string) {
  return [
    ...MEASURES.map(({ measure, label }) => {
      const columns = shown.counts[measure];
      return {
        key: measure,
        cells: [label, pick(columns.last), pick(columns.before), pick(columns.change), pick(columns.since)],
      };
    }),
    { key: "open-shops", cells: ["Open shops now", NOT_BY_WEEK, NOT_BY_WEEK, NOT_BY_WEEK, pick(shown.openShops)] },
  ];
}

/** What each word means (spec decision 13 and section 7), under each table. Samples for Lama to change. */
function NumbersKey() {
  return (
    <ul className="staff-confirm-list staff-muted">
      <li>{`${UNDER_FIVE}: a private count from 1 to 4. It isn't shown, so no one can be picked out.`}</li>
      <li>{`${HIDDEN}: not shown, so the total can't reveal a small number.`}</li>
      <li>{`${NO_CHANGE}: no change is worked out, because one of the two weeks isn't shown.`}</li>
      <li>Under 10, 10+, 20+: private counts since the start, rounded down to tens, so two weeks&apos; pages can&apos;t be subtracted.</li>
      <li>{`${NOT_BY_WEEK}: open shops are counted as the page opens.`}</li>
      <li>
        Private counts are enquiries, reports and follows. Admins can still open each report in the Reports queue: these
        rules protect this page and what&apos;s copied from it.
      </li>
    </ul>
  );
}

/**
 * The admin's numbers (spec decisions 9 to 13): plain tables with captions and row headers, no charts and no client
 * code. Nothing counted is named, linked or identified; the only links are each campus's view.
 */
export function AdminNumbers({ weeks, shown, campuses, campus, sampleMode }: AdminNumbersProps) {
  const columns = [
    "Measure",
    `Last week (${weeks.last.label})`,
    `The week before (${weeks.before.label})`,
    "Change",
    "Since the start",
  ];
  return (
    <>
      <section aria-labelledby="admin-numbers-about-title" className="staff-section">
        <h2 id="admin-numbers-about-title" className="sr-only">
          How these are counted
        </h2>
        <p>
          Counted from Vossie&apos;s store as this page opens. Weeks run Monday to Sunday, South African time. Things
          deleted since aren&apos;t counted. Small numbers of private things show as &quot;Under 5&quot; so no one can be
          picked out.
        </p>
        <p className="staff-muted">
          Something whose campus has gone, such as an enquiry to a shop that has closed, counts only in the All campuses
          figures.
        </p>
        {sampleMode && <p className="staff-muted">In this preview the store starts again whenever the server restarts.</p>}
      </section>
      {campus ? (
        <section aria-labelledby="admin-numbers-campus-title" className="staff-section">
          <h2 id="admin-numbers-campus-title" className="staff-section-title">
            {campus.name}
          </h2>
          <p>
            <Link href={ADMIN_NUMBERS_PATH} prefetch={false}>
              All campuses
            </Link>
          </p>
          <StaffTable
            caption={`${campus.name}, by week`}
            columns={columns}
            rows={placeRows(shown, (column) => column.campuses[campus.slug] ?? "0")}
            empty=""
            rowHeader
          />
          <NumbersKey />
        </section>
      ) : (
        <>
          <section aria-labelledby="admin-numbers-all-title" className="staff-section">
            <h2 id="admin-numbers-all-title" className="staff-section-title">
              All campuses
            </h2>
            <StaffTable
              caption="All campuses, by week"
              columns={columns}
              rows={placeRows(shown, (column) => column.total)}
              empty=""
              rowHeader
            />
            <NumbersKey />
          </section>
          <section aria-labelledby="admin-numbers-by-campus-title" className="staff-section">
            <h2 id="admin-numbers-by-campus-title" className="staff-section-title">
              By campus, last week
            </h2>
            <StaffTable
              caption={`By campus, last week (${weeks.last.label})`}
              columns={["Campus", ...MEASURES.map((measure) => measure.label), "Open shops now"]}
              rows={[
                ...campuses.map((place) => ({
                  key: place.slug,
                  cells: [
                    <Link key="campus" href={numbersPath(place.slug)} prefetch={false} className={CAMPUS_LINK}>
                      {place.name}
                    </Link>,
                    ...MEASURES.map(({ measure }) => shown.counts[measure].last.campuses[place.slug] ?? "0"),
                    shown.openShops.campuses[place.slug] ?? "0",
                  ],
                })),
                {
                  key: "all",
                  cells: [
                    "All campuses",
                    ...MEASURES.map(({ measure }) => shown.counts[measure].last.total),
                    shown.openShops.total,
                  ],
                },
              ]}
              empty=""
              rowHeader
            />
            <NumbersKey />
          </section>
        </>
      )}
    </>
  );
}
```

Run: `pnpm test components/staff/AdminNumbers.test.tsx`
Expected: PASS.

- [ ] **Step 3: The page**

Create `app/admin/numbers/page.tsx`:

```tsx
import type { Metadata } from "next";
import { connection } from "next/server";
import { AdminNumbers } from "@/components/staff/AdminNumbers";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { isSampleMode } from "@/lib/auth/config";
import { getCampuses } from "@/lib/data";
import { countByWeek } from "@/lib/data/numbers";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { parseNumbersCampus, protectCounts } from "@/lib/staff/numbers";
import { ADMIN_NUMBERS_PATH } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Numbers");
}

/**
 * The admin's numbers (stage J spec decisions 9 to 13). Admins only. `?campus=` is a query, not a route, so an unknown
 * value shows the main page (spec decision 12). The weeks read the clock, after `connection()` (spec section 5).
 */
export default async function AdminNumbersPage({ searchParams }: PageProps<"/admin/numbers">) {
  const account = await requireStaff("admin", ADMIN_NUMBERS_PATH);
  await connection();
  const [params, campuses, notice] = await Promise.all([searchParams, getCampuses(), takeNotice()]);
  const places = campuses.map((campus) => ({ slug: campus.slug, name: campus.name }));
  const slugs = places.map((place) => place.slug);
  const { weeks, raw } = await countByWeek(new Date());
  const chosen = parseNumbersCampus(params, slugs);
  return (
    <StaffFrame account={account} area="Admin console" title="Numbers" current={ADMIN_NUMBERS_PATH} notice={staffNoticeText(notice)}>
      <AdminNumbers
        weeks={weeks}
        shown={protectCounts(raw, slugs)}
        campuses={places}
        campus={places.find((place) => place.slug === chosen) ?? null}
        sampleMode={isSampleMode()}
      />
    </StaffFrame>
  );
}
```

If Task 1 failed, write it in G's shape instead (conventions, "If Task 1 failed"), with `searchParams` passed to the inner component.

Run: `pnpm lint components/staff/AdminNumbers.tsx app/admin/numbers`
Expected: no problems.

- [ ] **Step 4: Build, check, look**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task10"`), copying in this task's files. From `$S`: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` (expected: clean, `/admin/numbers` dynamic, no "Date" or Suspense error). Start the server, get the cookies, and check:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3204/admin/numbers
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: vossie_session=$STUDENT" http://localhost:3204/admin/numbers
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: vossie_session=$MENTOR" "http://localhost:3204/admin/numbers?campus=midrand"
curl -s -H "Cookie: vossie_session=$ADMIN" "http://localhost:3204/admin/numbers?campus=nowhere" | grep -c "All campuses, by week"
curl -s -H "Cookie: vossie_session=$ADMIN" "http://localhost:3204/admin/numbers?campus=midrand" | grep -c "Midrand, by week"
```

Expected: `307 http://localhost:3204/login?next=%2Fadmin%2Fnumbers`, `404`, `404`, `1` or more, `1` or more. Then `node j-look.mjs look /admin/numbers "/admin/numbers?campus=midrand"` (make `j-look.mjs` as in Task 9, Step 8, if this copy lacks it) and check: the tables become cards on the phone with each measure or campus as the card's title in ink, not grey; the campus links are 44px tall; the long "Not counted by week" wraps without pushing the page sideways at 390px. Stop the server.

- [ ] **Step 5: Hand over**

Files: `components/staff/AdminNumbers.tsx`, `components/staff/AdminNumbers.test.tsx`, `app/admin/numbers/page.tsx`. Message:

```
feat: /admin/numbers: the admin's weekly counts in two plain tables, All campuses (last week, the week before, change, since the start) and By campus for last week, each campus linking to its own view, with row headers, a key under each table, and every private figure through the small-number rule; no names, no charts, no client code (stage J spec decisions 9 to 13; plan decisions 3, 25 and 26)
```

---

### Task 11: `/admin/hidden`, the Show again pages, and the links to them

The hidden list (spec 2.14): two tables, newest hidden first, each row with a Show again link to its confirm page. The confirm pages say what showing it again does, with the extra lines for a Hub-paused shop, a sold, paused or draft listing, and a request its asker had closed. Three ways in: a link above the Reports queue, an Overview line, and Show it again on a closed report whose listing or request is hidden.

**Files:**
- Create: `components/staff/AdminHidden.tsx`, `components/staff/AdminHidden.test.tsx`
- Create: `components/staff/ShowAgainConfirm.tsx`, `components/staff/ShowAgainConfirm.test.tsx`
- Create: `app/admin/hidden/page.tsx`, `app/admin/hidden/listings/[id]/page.tsx`, `app/admin/hidden/requests/[id]/page.tsx`
- Modify: `components/staff/AdminOverview.tsx`, `components/staff/AdminOverview.test.tsx`, `app/admin/page.tsx`
- Modify: `components/staff/AdminReports.tsx`, `components/staff/AdminReports.test.tsx`
- Modify: `components/staff/AdminReport.tsx`, `components/staff/AdminReport.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `components/staff/AdminHidden.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HiddenItem } from "@/lib/data/staff-reports";
import { AdminHidden } from "./AdminHidden";

const listing: HiddenItem = {
  kind: "listing",
  id: "l-001",
  title: "Casio fx-991ZA Plus calculator",
  shopName: "Tech corner",
  campusSlug: "midrand",
  hiddenAt: "2026-10-14T08:42:00.000Z",
  reason: "Exam papers aren't allowed.",
  listingState: "available",
  shopPausedByHub: false,
  requestClosed: false,
};
const request: HiddenItem = {
  ...listing,
  kind: "request",
  id: "r-001",
  title: "Graphing calculator for MAT2",
  shopName: null,
  listingState: null,
};
const campusNames = new Map([["midrand", "Midrand"]]);

describe("hidden listings and requests (stage J spec decision 14)", () => {
  it("lists hidden listings with their shop, campus, date and reason, each with Show again", () => {
    render(<AdminHidden listings={[listing]} requests={[request]} campusNames={campusNames} />);
    const table = screen.getByRole("table", { name: "Hidden listings (1)" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Listing",
      "Shop",
      "Campus",
      "Hidden on",
      "Reason",
      "Show again",
    ]);
    const row = within(table).getAllByRole("row")[1];
    expect(row).toHaveTextContent(/Casio fx-991ZA Plus calculator.*Tech corner.*Midrand.*14 Oct.*Exam papers aren't allowed\./);
    expect(within(row).getByRole("link", { name: "Show Casio fx-991ZA Plus calculator again" })).toHaveAttribute(
      "href",
      "/admin/hidden/listings/l-001",
    );
    expect(within(row).getByText("14 Oct")).toHaveAttribute("datetime", "2026-10-14T08:42:00.000Z");
  });

  it("lists hidden requests without anyone's name", () => {
    render(<AdminHidden listings={[]} requests={[request]} campusNames={campusNames} />);
    const table = screen.getByRole("table", { name: "Hidden requests (1)" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Request",
      "Campus",
      "Hidden on",
      "Reason",
      "Show again",
    ]);
    expect(within(table).getByRole("link", { name: "Show Graphing calculator for MAT2 again" })).toHaveAttribute(
      "href",
      "/admin/hidden/requests/r-001",
    );
  });

  it("says so when nothing is hidden", () => {
    render(<AdminHidden listings={[]} requests={[]} campusNames={campusNames} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("No hidden listings.")).toBeInTheDocument();
    expect(screen.getByText("No hidden requests.")).toBeInTheDocument();
  });
});
```

Create `components/staff/ShowAgainConfirm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HiddenItem } from "@/lib/data/staff-reports";
import { ShowAgainConfirm, showAgainLines } from "./ShowAgainConfirm";

vi.mock("@/lib/staff/admin-actions", () => ({ showListingAgain: async () => {}, showRequestAgain: async () => {} }));

const listing: HiddenItem = {
  kind: "listing",
  id: "l-001",
  title: "Casio fx-991ZA Plus",
  shopName: "Tech corner",
  campusSlug: "midrand",
  hiddenAt: "2026-10-14T08:42:00.000Z",
  reason: "Checking it.",
  listingState: "available",
  shopPausedByHub: false,
  requestClosed: false,
};
const request: HiddenItem = {
  ...listing,
  kind: "request",
  id: "r-001",
  title: "Graphing calculator for MAT2",
  shopName: null,
  listingState: null,
};

describe("Show again's confirm page (stage J spec decision 14)", () => {
  it("says what showing a listing again does, with no reason field, and names its button", () => {
    render(<ShowAgainConfirm item={listing} />);
    expect(screen.getByText('Show "Casio fx-991ZA Plus" again?')).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Buyers will see it in browse, on Tech corner's shop and on its own page again.",
      "Its seller is told. The reports about it stay closed, and the people who made them aren't told.",
      "To hide it again, someone has to report it.",
    ]);
    expect(screen.queryByLabelText("Reason")).toBeNull();
    expect(screen.getByRole("button", { name: "Show Casio fx-991ZA Plus again" })).toHaveClass("btn-danger");
    expect(document.querySelector('input[name="listing"]')).toHaveValue("l-001");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/hidden");
  });

  it("adds a line for a Hub-paused shop, and for a sold, paused or draft listing", () => {
    expect(showAgainLines({ ...listing, shopPausedByHub: true })).toContain(
      "Tech corner is paused by the Hub, so buyers won't see it until the shop is resumed.",
    );
    expect(showAgainLines({ ...listing, listingState: "sold" })).toContain("It's marked sold, so buyers will see it as sold.");
    expect(showAgainLines({ ...listing, listingState: "paused" })).toContain(
      "It's marked paused, so buyers will see it as paused.",
    );
    expect(showAgainLines({ ...listing, listingState: "draft" })).toContain("It's a draft, so only its seller sees it.");
  });

  it("says what showing a request again does, and that it stays closed if its asker had closed it", () => {
    render(<ShowAgainConfirm item={{ ...request, requestClosed: true }} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Students will see it on Looking For and on its own page again.",
      "The asker is told. The reports about it stay closed, and the people who made them aren't told.",
      "To hide it again, someone has to report it.",
      "Its asker had closed it, so it shows as closed.",
    ]);
    expect(document.querySelector('input[name="request"]')).toHaveValue("r-001");
    expect(screen.getByRole("button", { name: "Show Graphing calculator for MAT2 again" })).toBeInTheDocument();
  });
});
```

In `components/staff/AdminOverview.test.tsx`:
- in each of the three `render`/`rerender` calls, add `hidden={{ listings: 0, requests: 0 }}` to `AdminOverview`'s props;
- change the import to `import { AdminOverview, hiddenLine } from "./AdminOverview";`;
- add at the end:

```tsx
describe("what the Hub has hidden (stage J spec decision 14, plan decision 17)", () => {
  it("links the count to the hidden list, and says so when nothing is hidden", () => {
    const { rerender } = render(
      <AdminOverview waiting={0} openReports={0} openSlots={0} badgesChanged={0} hidden={{ listings: 2, requests: 1 }} />,
    );
    const section = screen.getByRole("region", { name: "Hidden by the Hub" });
    expect(within(section).getByRole("link", { name: "2 listings and 1 request are hidden" })).toHaveAttribute(
      "href",
      "/admin/hidden",
    );
    rerender(<AdminOverview waiting={0} openReports={0} openSlots={0} badgesChanged={0} hidden={{ listings: 0, requests: 0 }} />);
    expect(within(screen.getByRole("region", { name: "Hidden by the Hub" })).queryByRole("link")).toBeNull();
    expect(screen.getByText("Nothing is hidden.")).toBeInTheDocument();
  });

  it("words one or several of each", () => {
    expect(hiddenLine({ listings: 1, requests: 0 })).toBe("1 listing is hidden");
    expect(hiddenLine({ listings: 0, requests: 1 })).toBe("1 request is hidden");
    expect(hiddenLine({ listings: 0, requests: 3 })).toBe("3 requests are hidden");
    expect(hiddenLine({ listings: 1, requests: 1 })).toBe("1 listing and 1 request are hidden");
    expect(hiddenLine({ listings: 0, requests: 0 })).toBeNull();
  });
});
```

In `components/staff/AdminReports.test.tsx`, add at the end:

```tsx
describe("the way to hidden listings and requests (stage J spec decision 14)", () => {
  it("links to them above the queue", () => {
    render(<AdminReports reports={[]} />);
    expect(screen.getByRole("link", { name: "Hidden listings and requests" })).toHaveAttribute("href", "/admin/hidden");
  });
});
```

In `components/staff/AdminReport.test.tsx`, add `hideListing` and `hideRequest` imports:

```tsx
import { hideRequest } from "@/lib/data/requests";
import { hideListing } from "@/lib/data/staff-shops";
```

and add at the end:

```tsx
describe("Show it again (stage J spec decision 14, plan decision 18)", () => {
  it("links a closed report's hidden listing to its Show again page", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    await hideListing("l-001", "Not allowed.", NOW);
    await closeReportsOn({ kind: "listing", id: "l-001" }, "hidden", "Not allowed.", "acc-admin", NOW);
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    const facts = screen.getByRole("region", { name: "The report" });
    expect(within(facts).getByText("Buyers can't see this listing: the Hub has hidden it.")).toBeInTheDocument();
    expect(within(facts).getByRole("link", { name: "Show it again" })).toHaveAttribute("href", "/admin/hidden/listings/l-001");
  });

  it("links a closed report's hidden request to its Show again page", async () => {
    const id = await reportOn({ kind: "request", id: "r-001" }, "Looking for a lab coat");
    await hideRequest("r-001", "Not allowed.", NOW);
    await closeReportsOn({ kind: "request", id: "r-001" }, "hidden", "Not allowed.", "acc-admin", NOW);
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    expect(screen.getByRole("link", { name: "Show it again" })).toHaveAttribute("href", "/admin/hidden/requests/r-001");
  });

  it("offers nothing on a report that's still open, or whose target is there to see", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    expect(screen.queryByRole("link", { name: "Show it again" })).toBeNull();
  });
});
```

Run: `pnpm test components/staff`
Expected: FAIL: `AdminHidden`, `ShowAgainConfirm` and `hiddenLine` don't exist, and neither link is drawn.

- [ ] **Step 2: The hidden list and the confirm page**

Create `components/staff/AdminHidden.tsx`:

```tsx
import Link from "next/link";
import type { HiddenItem } from "@/lib/data/staff-reports";
import { showListingPath, showRequestPath } from "@/lib/staff/paths";
import { shortSastDate } from "@/lib/time";
import { StaffTable } from "./StaffTable";

type AdminHiddenProps = {
  /** Newest hidden first. */
  listings: readonly HiddenItem[];
  requests: readonly HiddenItem[];
  campusNames: ReadonlyMap<string, string>;
};

function ShowLink({ item }: { item: HiddenItem }) {
  const href = item.kind === "listing" ? showListingPath(item.id) : showRequestPath(item.id);
  return (
    <Link href={href} prefetch={false} className="staff-row-action">
      Show <span className="sr-only">{item.title}</span> again
    </Link>
  );
}

function HiddenOn({ item }: { item: HiddenItem }) {
  return <time dateTime={item.hiddenAt}>{shortSastDate(item.hiddenAt)}</time>;
}

/**
 * What the Hub has hidden (spec decision 14): listings and Looking For requests, newest hidden first, each with Show
 * again. A request never names its asker. The words are samples for Lama to change.
 */
export function AdminHidden({ listings, requests, campusNames }: AdminHiddenProps) {
  const campus = (slug: string) => campusNames.get(slug) ?? slug;
  return (
    <>
      <p>
        Everything the Hub has hidden after a report, newest first. Showing one again can&apos;t be undone here: to hide
        it again, someone has to report it.
      </p>
      <section aria-labelledby="admin-hidden-listings-title" className="staff-section">
        <h2 id="admin-hidden-listings-title" className="staff-section-title">
          Listings
        </h2>
        <StaffTable
          caption={`Hidden listings (${listings.length})`}
          columns={["Listing", "Shop", "Campus", "Hidden on", "Reason", "Show again"]}
          rows={listings.map((item) => ({
            key: item.id,
            cells: [
              item.title,
              item.shopName ?? "",
              campus(item.campusSlug),
              <HiddenOn key="on" item={item} />,
              item.reason,
              <ShowLink key="show" item={item} />,
            ],
          }))}
          empty="No hidden listings."
        />
      </section>
      <section aria-labelledby="admin-hidden-requests-title" className="staff-section">
        <h2 id="admin-hidden-requests-title" className="staff-section-title">
          Looking For requests
        </h2>
        <StaffTable
          caption={`Hidden requests (${requests.length})`}
          columns={["Request", "Campus", "Hidden on", "Reason", "Show again"]}
          rows={requests.map((item) => ({
            key: item.id,
            cells: [
              item.title,
              campus(item.campusSlug),
              <HiddenOn key="on" item={item} />,
              item.reason,
              <ShowLink key="show" item={item} />,
            ],
          }))}
          empty="No hidden requests."
        />
      </section>
    </>
  );
}
```

Create `components/staff/ShowAgainConfirm.tsx`:

```tsx
import type { HiddenItem } from "@/lib/data/staff-reports";
import { showListingAgain, showRequestAgain } from "@/lib/staff/admin-actions";
import { ADMIN_HIDDEN_PATH } from "@/lib/staff/paths";
import type { ListingState } from "@/lib/types";
import { ConfirmAction } from "./ConfirmAction";

/** A listing's own state, which showing it again keeps (spec decision 14). Samples for Lama to change. */
const STATE_LINES: Readonly<Partial<Record<ListingState, string>>> = {
  sold: "It's marked sold, so buyers will see it as sold.",
  paused: "It's marked paused, so buyers will see it as paused.",
  draft: "It's a draft, so only its seller sees it.",
};

/** What showing it again does, a line each (spec decision 14). */
export function showAgainLines(item: HiddenItem): string[] {
  if (item.kind === "request") {
    return [
      "Students will see it on Looking For and on its own page again.",
      "The asker is told. The reports about it stay closed, and the people who made them aren't told.",
      "To hide it again, someone has to report it.",
      ...(item.requestClosed ? ["Its asker had closed it, so it shows as closed."] : []),
    ];
  }
  const shop = item.shopName ?? "its shop";
  const stateLine = item.listingState ? STATE_LINES[item.listingState] : undefined;
  return [
    `Buyers will see it in browse, on ${shop}'s shop and on its own page again.`,
    "Its seller is told. The reports about it stay closed, and the people who made them aren't told.",
    "To hide it again, someone has to report it.",
    ...(item.shopPausedByHub ? [`${shop} is paused by the Hub, so buyers won't see it until the shop is resumed.`] : []),
    ...(stateLine ? [stateLine] : []),
  ];
}

/**
 * Show again's confirm page (spec decision 14): it can't be undone from the console, since hiding it again needs a
 * new report, so it's confirmed. No reason field: the student needs none, and the log records the action.
 */
export function ShowAgainConfirm({ item }: { item: HiddenItem }) {
  return (
    <ConfirmAction
      id={`show-${item.kind}-${item.id}`}
      lead={`Show "${item.title}" again?`}
      consequences={showAgainLines(item)}
      action={item.kind === "listing" ? showListingAgain : showRequestAgain}
      hidden={item.kind === "listing" ? { listing: item.id } : { request: item.id }}
      reason={false}
      errors={[]}
      confirmLabel={`Show ${item.title} again`}
      keepHref={ADMIN_HIDDEN_PATH}
    />
  );
}
```

- [ ] **Step 3: The three ways in**

Replace the whole of `components/staff/AdminOverview.tsx` with:

```tsx
import Link from "next/link";
import { ADMIN_HIDDEN_PATH, ADMIN_REPORTS_PATH, ADMIN_SELLERS_PATH, HUB_MANAGE_PATH } from "@/lib/staff/paths";

type AdminOverviewProps = {
  waiting: number;
  openReports: number;
  openSlots: number;
  /** How many shops' badges the calculation Overview just ran changed (spec 2.7, plan decision 8). */
  badgesChanged: number;
  /** How many listings and requests the Hub has hidden (stage J spec decision 14). */
  hidden: { listings: number; requests: number };
};

/** "2 listings and 1 request are hidden", "1 listing is hidden", or null when nothing is (stage J plan decision 17). */
export function hiddenLine({ listings, requests }: { listings: number; requests: number }): string | null {
  const parts = [
    listings > 0 ? `${listings} ${listings === 1 ? "listing" : "listings"}` : null,
    requests > 0 ? `${requests} ${requests === 1 ? "request" : "requests"}` : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return `${parts.join(" and ")} ${listings + requests === 1 ? "is" : "are"} hidden`;
}

/**
 * Overview (spec 2.3): what needs attention, with links, what the Hub has hidden (stage J spec decision 14), and the
 * trust badges worked out as the page rendered (spec 2.7). Public pages show a changed badge when their cached data
 * next revalidates, within 15 minutes, or at the next write that expires sellers (plan decision 8). The words are
 * samples for Lama to change.
 */
export function AdminOverview({ waiting, openReports, openSlots, badgesChanged, hidden }: AdminOverviewProps) {
  const items = [
    { id: "waiting", count: waiting, label: "Sellers waiting for approval", href: ADMIN_SELLERS_PATH, action: "Review sellers" },
    { id: "reports", count: openReports, label: "Open reports", href: ADMIN_REPORTS_PATH, action: "Review reports" },
    {
      id: "slots",
      count: openSlots,
      label: "Slot requests waiting for an answer",
      href: `${HUB_MANAGE_PATH}#hub-queue`,
      action: "Answer slot requests",
    },
  ];
  const changed =
    badgesChanged === 0
      ? "None changed."
      : `${badgesChanged} ${badgesChanged === 1 ? "shop's badge" : "shops' badges"} changed.`;
  const hiddenNow = hiddenLine(hidden);
  return (
    <>
      <section aria-labelledby="admin-attention-title" className="staff-section">
        <h2 id="admin-attention-title" className="staff-section-title">
          Needs attention
        </h2>
        <ul className="staff-counts">
          {items.map((item) => (
            <li key={item.id} className="staff-count">
              <p className="staff-count-number">{item.count}</p>
              <p className="staff-count-label">{item.label}</p>
              <Link href={item.href} prefetch={false} className="staff-row-action">
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="admin-hidden-title" className="staff-section">
        <h2 id="admin-hidden-title" className="staff-section-title">
          Hidden by the Hub
        </h2>
        <p>
          {hiddenNow ? (
            <Link href={ADMIN_HIDDEN_PATH} prefetch={false}>
              {hiddenNow}
            </Link>
          ) : (
            "Nothing is hidden."
          )}
        </p>
      </section>
      <section aria-labelledby="admin-badges-title" className="staff-section">
        <h2 id="admin-badges-title" className="staff-section-title">
          Trust badges
        </h2>
        <p>
          Worked out just now from each shop&apos;s conversations, by the rules on the trust page. {changed} Buyers see a
          change within 15 minutes. Sample shops no account owns keep their sample badges.
        </p>
      </section>
    </>
  );
}
```

In `app/admin/page.tsx` (Task 1's blocking version), add `countHidden` to the import from `"@/lib/data/staff-reports"` (`import { countHidden, openReportCount } from "@/lib/data/staff-reports";`), and replace the `Promise.all` and the `AdminOverview` element:

```tsx
  const [waiting, openReports, openSlots, hidden, notice] = await Promise.all([
    countWaitingShops(),
    openReportCount(),
    openBookingCount(),
    countHidden(),
    takeNotice(),
  ]);
  return (
    <StaffFrame account={account} area="Admin console" title="Overview" current={ADMIN_PATH} notice={staffNoticeText(notice)}>
      <AdminOverview
        waiting={waiting}
        openReports={openReports}
        openSlots={openSlots}
        badgesChanged={changed.length}
        hidden={hidden}
      />
    </StaffFrame>
  );
```

(If Task 1 failed, make the same change inside G's inner `Overview` component.)

In `components/staff/AdminReports.tsx`, change `import { adminReportPath } from "@/lib/staff/paths";` to `import { ADMIN_HIDDEN_PATH, adminReportPath } from "@/lib/staff/paths";`, and in `AdminReports`'s returned fragment, add before the first `<section …>`:

```tsx
      <p>
        <Link href={ADMIN_HIDDEN_PATH} prefetch={false}>
          Hidden listings and requests
        </Link>
      </p>
```

In `components/staff/AdminReport.tsx`, change `import { hideReportedPath, pauseReportedPath } from "@/lib/staff/paths";` to

```tsx
import { hideReportedPath, pauseReportedPath, showListingPath, showRequestPath } from "@/lib/staff/paths";
```

and, inside the "What" `<dd>`, add straight after the `{report.unseen && ( … )}` block, before `</dd>`:

```tsx
              {/* Show it again (stage J spec decision 14): a hide closes every report on its target. */}
              {!report.open && report.unseen === "hidden" && report.target.kind !== "seller" && (
                <>
                  {" "}
                  <Link
                    href={
                      report.target.kind === "request" ? showRequestPath(report.target.id) : showListingPath(report.target.id)
                    }
                    prefetch={false}
                  >
                    Show it again
                  </Link>
                </>
              )}
```

Run: `pnpm test components/staff`
Expected: PASS.

- [ ] **Step 4: The three pages**

Create `app/admin/hidden/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AdminHidden } from "@/components/staff/AdminHidden";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { getCampuses } from "@/lib/data";
import { listHidden } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_HIDDEN_PATH, ADMIN_REPORTS_PATH } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Hidden");
}

/** Hidden listings and requests (stage J spec decision 14). Admins only; it sits under Reports in the frame. */
export default async function AdminHiddenPage() {
  const account = await requireStaff("admin", ADMIN_HIDDEN_PATH);
  const [hidden, campuses, notice] = await Promise.all([listHidden(), getCampuses(), takeNotice()]);
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title="Hidden listings and requests"
      current={ADMIN_REPORTS_PATH}
      notice={staffNoticeText(notice)}
    >
      <AdminHidden
        listings={hidden.listings}
        requests={hidden.requests}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      />
    </StaffFrame>
  );
}
```

Create `app/admin/hidden/listings/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShowAgainConfirm } from "@/components/staff/ShowAgainConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { getHidden } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { ADMIN_REPORTS_PATH, showListingPath } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Show again");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no listing. */
export function generateStaticParams() {
  return [{ id: "l-sample" }];
}

/** Show a hidden listing again: its confirm page (stage J spec decision 14). One that isn't hidden is the 404. */
export default async function ShowListingPage({ params }: PageProps<"/admin/hidden/listings/[id]">) {
  const { id } = await params;
  const account = await requireStaff("admin", showListingPath(id));
  const item = isId(id) ? await getHidden("listing", id) : null;
  if (!item) notFound();
  return (
    <StaffFrame account={account} area="Admin console" title={`Show ${item.title} again`} current={ADMIN_REPORTS_PATH} notice={null}>
      <ShowAgainConfirm item={item} />
    </StaffFrame>
  );
}
```

Create `app/admin/hidden/requests/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShowAgainConfirm } from "@/components/staff/ShowAgainConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { getHidden } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { ADMIN_REPORTS_PATH, showRequestPath } from "@/lib/staff/paths";

/** A blocking page: the role is checked before the first byte, so others get a real 404 (stage J spec decision 15). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Show again");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no request. */
export function generateStaticParams() {
  return [{ id: "r-sample" }];
}

/** Show a hidden request again: its confirm page (stage J spec decision 14). One that isn't hidden is the 404. */
export default async function ShowRequestPage({ params }: PageProps<"/admin/hidden/requests/[id]">) {
  const { id } = await params;
  const account = await requireStaff("admin", showRequestPath(id));
  const item = isId(id) ? await getHidden("request", id) : null;
  if (!item) notFound();
  return (
    <StaffFrame account={account} area="Admin console" title={`Show ${item.title} again`} current={ADMIN_REPORTS_PATH} notice={null}>
      <ShowAgainConfirm item={item} />
    </StaffFrame>
  );
}
```

If Task 1 failed, write the three pages in G's shape instead.

Run: `pnpm lint components/staff app/admin`
Expected: no problems.

- [ ] **Step 5: Build, check, look**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task11"`), copying in this task's files. From `$S`: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` (expected: clean; `/admin/hidden`, `/admin/hidden/listings/[id]` and `/admin/hidden/requests/[id]` dynamic). Start the server, get the cookies, then:

```bash
for path in /admin/hidden /admin/hidden/listings/l-001 /admin/hidden/requests/r-001; do
  echo "$path $(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3204$path") \
$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: vossie_session=$STUDENT" "http://localhost:3204$path") \
$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: vossie_session=$ADMIN" "http://localhost:3204$path")"
done
```

Expected: `/admin/hidden 307 404 200`; the two confirm pages `307 404 404` (nothing is hidden on a fresh server, so the admin gets the 404 too).

To look at a hidden row and its confirm page, hide one through the app: as the student, report l-001 (`/report?listing=l-001`), then as the admin hide it from the report's page. Do it with a throwaway Playwright script in `$S` (the same sign-in as `j-look.mjs`, then the steps `tests/e2e/staff-writes.spec.ts`'s hide test takes), then `node j-look.mjs look /admin /admin/reports /admin/hidden /admin/hidden/listings/l-001`, and the closed report's page. Check: the Overview line is a link; the queue's link sits above Open; the hidden table becomes cards at 390px; the confirm page's lines and its red Show button; the report page's "Show it again" sits after the hidden line. Stop the server. (This scratch server's store is thrown away with it.)

- [ ] **Step 6: Hand over**

Files: `components/staff/AdminHidden.tsx`, `components/staff/AdminHidden.test.tsx`, `components/staff/ShowAgainConfirm.tsx`, `components/staff/ShowAgainConfirm.test.tsx`, `app/admin/hidden/page.tsx`, `app/admin/hidden/listings/[id]/page.tsx`, `app/admin/hidden/requests/[id]/page.tsx`, `components/staff/AdminOverview.tsx`, `components/staff/AdminOverview.test.tsx`, `app/admin/page.tsx`, `components/staff/AdminReports.tsx`, `components/staff/AdminReports.test.tsx`, `components/staff/AdminReport.tsx`, `components/staff/AdminReport.test.tsx`. Message:

```
feat: /admin/hidden lists the Hub's hidden listings and requests, newest first, each with Show again through a confirm page that says what it does (a Hub-paused shop, a sold, paused or draft listing, a closed request); reached from a link above the Reports queue, an Overview line, and Show it again on a closed report whose listing or request is hidden (stage J spec decision 14; plan decisions 17 and 18)
```

---

### Task 12: Privacy: a staff account's delete step, and the policy's words

Spec 2.8 and section 6. Privacy settings' delete step tells staff what happens to their work, and an only admin that no one else could use the console; the privacy policy says admins see weekly counts (never who) and that the staff log records roles. The data export already has `roles` and, since Task 4, the shop's `approvedAt`.

**Files:**
- Modify: `components/account/PrivacySettingsView.tsx`, `components/account/PrivacySettingsView.test.tsx`
- Modify: `app/account/privacy/page.tsx`
- Modify: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `components/account/PrivacySettingsView.test.tsx`, add at the end:

```tsx
describe("deleting a staff account (stage J spec decision 8)", () => {
  const STAFF_LINE =
    "You're Hub staff. Your Hub posts stay with no author, your notes and check-ins stay as \"Deleted account\", the shops you mentor lose their mentor, and the audit log keeps your entries without your name.";
  const ONLY_ADMIN = "You're Vossie's only admin. Give someone else the admin role first, or no one can use the admin console.";

  it("says nothing about staff work to a student", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    const section = screen.getByRole("region", { name: "Delete your account" });
    expect(within(section).queryByText(/Hub staff/)).toBeNull();
    expect(within(section).getAllByRole("listitem")).toHaveLength(7);
  });

  it("tells staff what happens to their work, without blocking the delete", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} staff={{ onlyAdmin: false }} />);
    const section = screen.getByRole("region", { name: "Delete your account" });
    expect(within(section).getByText(STAFF_LINE)).toBeInTheDocument();
    expect(within(section).queryByText(/only admin/)).toBeNull();
    expect(within(section).getAllByRole("listitem")).toHaveLength(7);
    expect(within(section).getByRole("button", { name: "Delete my account" })).toBeEnabled();
  });

  it("warns Vossie's only admin to give the role to someone else first", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} staff={{ onlyAdmin: true }} />);
    const section = screen.getByRole("region", { name: "Delete your account" });
    expect(within(section).getByText(STAFF_LINE)).toBeInTheDocument();
    expect(within(section).getByText(/^You're Vossie's only admin\./).closest("p")).toHaveTextContent(ONLY_ADMIN);
    expect(within(section).getByRole("button", { name: "Delete my account" })).toBeEnabled();
  });
});
```

In `app/privacy/page.test.tsx`, add a test inside the first `describe`:

```tsx
  it("says Hub admins see weekly counts, never who, and that the staff log records roles (stage J spec section 6)", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("region", { name: "Who it is shared with" })).toHaveTextContent(
      "Hub admins see weekly counts for each campus (listings, shops, requests, enquiries, reports and follows), never who; small numbers are hidden so no one can be picked out.",
    );
    expect(screen.getByRole("region", { name: "Your account" })).toHaveTextContent(
      "Who approved, declined, verified, hid or paused what, when and why, and who was given or lost a staff role, so staff actions can be checked.",
    );
  });
```

Run: `pnpm test components/account/PrivacySettingsView.test.tsx app/privacy/page.test.tsx`
Expected: FAIL: no staff lines, and the policy has neither sentence.

- [ ] **Step 2: The delete step's staff lines**

In `components/account/PrivacySettingsView.tsx`, add to `PrivacySettingsViewProps`, after `reports`:

```tsx
  /**
   * Set for an account with a staff role (stage J spec decision 8): the delete step says what happens to their work,
   * and warns Vossie's only admin. Absent or null for everyone else.
   */
  staff?: { onlyAdmin: boolean } | null;
```

change the function's first line to:

```tsx
export function PrivacySettingsView({ consent, deleteErrors, reports, staff = null }: PrivacySettingsViewProps) {
```

and add after the delete list's closing `</ul>`, before `<p>Saved listings stay on this device until you clear them.</p>`:

```tsx
        {staff && (
          <p>
            You&apos;re Hub staff. Your Hub posts stay with no author, your notes and check-ins stay as &quot;Deleted
            account&quot;, the shops you mentor lose their mentor, and the audit log keeps your entries without your name.
          </p>
        )}
        {/* A warning, not a block: deleting your account is your right under POPIA (spec decision 8). */}
        {staff?.onlyAdmin && (
          <p>
            <strong>You&apos;re Vossie&apos;s only admin.</strong> Give someone else the admin role first, or no one can
            use the admin console.
          </p>
        )}
```

In `app/account/privacy/page.tsx`, add the import

```tsx
import { countAdmins } from "@/lib/data/staff-accounts";
```

and in `PrivacySettings`, add after the `Promise.all` and before `return`:

```tsx
  // Staff see what happens to their work; Vossie's only admin is warned (stage J spec decision 8).
  const staff =
    account.roles.length > 0 ? { onlyAdmin: account.roles.includes("admin") && (await countAdmins()) === 1 } : null;
```

and pass `staff={staff}` to `PrivacySettingsView`.

- [ ] **Step 3: The policy's words**

In `app/privacy/page.tsx`:
- in the "Your account" section's staff-log bullet, change `Who approved, declined, verified, hid or paused what, when and` / `why, so staff actions can be checked.` to read `Who approved, declined, verified, hid or paused what, when and why, and who was given or lost a staff role, so staff actions can be checked.` (re-wrap the JSX lines to about 120 characters);
- in the "Who it is shared with" section's Hub staff bullet, add after `never your messages.`:

```tsx
            {" "}Hub admins see weekly counts for each campus (listings, shops, requests, enquiries, reports and follows),
            never who; small numbers are hidden so no one can be picked out.
```

- change `updated="2026-10-19"` to the date you build this task, as `YYYY-MM-DD`.

Both sentences are for Lama to review (spec 6).

Run: `pnpm test components/account app/privacy app/info-pages.test.tsx components/forms/summary-ids.test.tsx`
Expected: PASS. (`info-pages.test.tsx` checks every info page's date; if it pins the privacy page's, change it there too and list the file.)

Run: `pnpm lint components/account app/account app/privacy`
Expected: no problems.

- [ ] **Step 4: Measure: no public page moves**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task12"`), copying in this task's files. From `$S`: `pnpm typecheck`, `pnpm test`, `pnpm lint`, then:

```bash
pnpm e2e tests/e2e/performance.spec.ts --project=phone-390
```

Expected: all pass, and every `scriptBrotli` equals the ledger's Start row to the byte (the notifications page included: Task 3's change is a Server Component's `case`). Write the figures into your report for the ledger's "Task 12" row. If any figure moved, stop and report.

- [ ] **Step 5: Hand over**

Files: `components/account/PrivacySettingsView.tsx`, `components/account/PrivacySettingsView.test.tsx`, `app/account/privacy/page.tsx`, `app/privacy/page.tsx`, `app/privacy/page.test.tsx` (and `app/info-pages.test.tsx` if Step 3 changed it). Message:

```
feat: deleting a staff account says what happens to their posts, notes, mentored shops and audit entries, and warns Vossie's only admin without blocking; the privacy policy says Hub admins see weekly counts per campus, never who, and that the staff log records who was given or lost a role (stage J spec decision 8 and section 6; plan decisions 19 and 20). JS: every public page the same to the byte (<figures>)
```

---

### Task 13: End to end, status checks, axe, layout shift and size

The stage's browser tests (spec section 9). A new project, `staff-accounts-writes`, runs last, after `alerts-writes`, for the tests that give roles, hide and show, and check the numbers, with their axe, layout-shift and size checks beside them. The status checks go in G's `tests/e2e/staff.spec.ts` (device projects, read only), where the new pages also join G's "Page not found" test.

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/helpers/staff-accounts.ts`
- Create: `tests/e2e/staff-accounts-writes.spec.ts`, `tests/e2e/staff-accounts-checks.spec.ts`
- Modify: `tests/e2e/staff.spec.ts`

- [ ] **Step 1: Check the files are still yours to edit**

Run: `git --no-optional-locks status --short playwright.config.ts tests/e2e/staff.spec.ts tests/e2e/helpers`
Expected: only ` M tests/e2e/helpers/messaging.ts` (the header session's, which this task imports but never edits). If `playwright.config.ts` or `staff.spec.ts` shows as modified, stop and report: another session has started on them.

- [ ] **Step 2: The project**

In `playwright.config.ts`, add after the `ALERTS_WRITES` line:

```ts
// Stage J's tests that give and take away staff roles, hide and show listings and requests again, and read the admin's
// numbers, with their checks and screenshots, run after every other test, so a new staff role or a hidden listing never
// lands under another test (stage J plan decision 21).
const STAFF_ACCOUNTS = /staff-accounts-(writes|checks|screenshots)\.spec\.ts$/;
```

In each of the five device projects, change `testIgnore: [SELLING_WRITES, STAFF_WRITES, COMMUNITY_WRITES, ALERTS_WRITES]` to `testIgnore: [SELLING_WRITES, STAFF_WRITES, COMMUNITY_WRITES, ALERTS_WRITES, STAFF_ACCOUNTS]` (five lines, the same change). Then add after the `alerts-writes` project:

```ts
    // After everything else (stage J plan decision 21). Run it alone with --project=staff-accounts-writes --no-deps.
    {
      name: "staff-accounts-writes",
      use: desktop(1440, 900),
      testMatch: STAFF_ACCOUNTS,
      dependencies: [...DEVICE_PROJECTS, "selling-writes", "staff-writes", "community-writes", "alerts-writes"],
    },
```

- [ ] **Step 3: The helpers**

Create `tests/e2e/helpers/staff-accounts.ts`:

```ts
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { button, field, main, signInAsSample } from "./messaging";
import { POST_LANDS } from "./selling";
import { staffNotice } from "./staff";

// Shared by stage J's end-to-end tests (stage J plan, Task 13). Every test shares one server and one sample store;
// these run last, in the staff-accounts-writes project, and each acts only on accounts, listings and requests it makes.

/**
 * Whether staff pages answer a real 404 and 307 (stage J plan decision 1): true when Task 1's spike held. False keeps
 * stage G's pattern, where the 404 page streams in with status 200, and the status checks skip.
 */
export const STAFF_404_IS_REAL = true;

/** Every admin console page, with ids that match nothing where a page needs one: the role is checked first. */
export const ADMIN_PAGES: readonly string[] = [
  "/admin",
  "/admin/sellers",
  "/admin/sellers/tech-corner",
  "/admin/sellers/crochet-corner/decline",
  "/admin/sellers/tech-corner/pause",
  "/admin/reports",
  "/admin/reports/rep-sample",
  "/admin/reports/rep-sample/hide",
  "/admin/reports/rep-sample/pause",
  "/admin/featured",
  "/admin/pickup-points",
  "/admin/audit",
  "/admin/numbers",
  "/admin/staff",
  "/admin/staff/acc-mentor/remove-mentor",
  "/admin/staff/acc-admin/remove-admin",
  "/admin/hidden",
  "/admin/hidden/listings/l-001",
  "/admin/hidden/requests/r-001",
];

/** The Hub's tools and the mentor dashboard. */
export const HUB_AND_MENTOR_PAGES: readonly string[] = [
  "/hub/manage",
  "/hub/new",
  "/hub/h-003/edit",
  "/mentor",
  "/mentor/tech-corner",
];

/** A phone, as the device projects' phone-390 is. */
export const PHONE = {
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

/** A desktop, as desktop-1440 is. */
export const DESKTOP = { viewport: { width: 1440, height: 900 } };

/** Signs `context` in through another browser, copying only the session cookie across, so nothing is cached yet. */
export async function copySession(browser: Browser, context: BrowserContext, baseURL: string, label: string): Promise<void> {
  const other = await browser.newContext({ baseURL, serviceWorkers: "block" });
  await signInAsSample(await other.newPage(), label, "/account");
  await context.addCookies((await other.cookies()).filter((cookie) => cookie.name === "vossie_session"));
  await other.close();
}

/** As `admin`, gives the account with this email a role on /admin/staff, and waits for the notice. */
export async function giveRole(admin: Page, email: string, role: "Mentor" | "Admin"): Promise<void> {
  await admin.goto("/admin/staff");
  await field(admin, "Eduvos email").fill(email);
  await main(admin).getByRole("radio", { name: role, exact: true }).check();
  await button(admin, "Give role").click();
  await expect(staffNotice(admin)).toHaveText(
    "Role given. They've been told, and their tools are on their account page.",
    POST_LANDS,
  );
}

/** As `reporter`, reports a listing; then, as `admin`, hides it from the report's confirm page. */
export async function hideListingByReport(reporter: Page, admin: Page, id: string, title: string): Promise<void> {
  await reporter.goto(`/report?listing=${id}`);
  await main(reporter).getByRole("radio", { name: "Prohibited item" }).check();
  await button(reporter, "Send report").click();
  await expect(reporter).toHaveURL(new RegExp(`/report/sent\\?listing=${id}$`), POST_LANDS);
  await admin.goto("/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
  await main(admin).getByRole("link", { name: `Hide ${title}` }).click();
  await field(admin, "Reason").fill("Hidden while the Hub checks it.");
  await button(admin, `Hide ${title}`).click();
  await expect(staffNotice(admin)).toHaveText("Hidden. Its seller and everyone who reported it have been told.", POST_LANDS);
}

/** As `reporter`, reports a Looking For request; then, as `admin`, hides it from the report's confirm page. */
export async function hideRequestByReport(reporter: Page, admin: Page, id: string, title: string): Promise<void> {
  await reporter.goto(`/report?request=${id}`);
  await main(reporter).getByRole("radio", { name: "Prohibited item" }).check();
  await button(reporter, "Send report").click();
  await expect(reporter).toHaveURL(/\/report\/sent/, POST_LANDS);
  await admin.goto("/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
  await main(admin).getByRole("link", { name: `Hide ${title}` }).click();
  await field(admin, "Reason").fill("Hidden while the Hub checks it.");
  await button(admin, `Hide ${title}`).click();
  await expect(staffNotice(admin)).toHaveText("Hidden. The asker and everyone who reported it have been told.", POST_LANDS);
}
```

- [ ] **Step 4: The writes**

Create `tests/e2e/staff-accounts-writes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { postRequest } from "./helpers/community";
import { button, field, main, newBuyer, signInAsSample, signUp } from "./helpers/messaging";
import { browseFor, cardsFor, notFoundHeading, POST_LANDS, publishListing, uniqueWord } from "./helpers/selling";
import { signedInPage, staffNotice } from "./helpers/staff";
import {
  copySession,
  giveRole,
  hideListingByReport,
  hideRequestByReport,
  STAFF_404_IS_REAL,
} from "./helpers/staff-accounts";

// Stage J's end to end (plan Task 13; spec section 9). These run last, in the staff-accounts-writes project, because
// they give roles and hide and show listings and requests other tests could see. Role tests use fresh accounts and never
// change the sample staff; hide and show use a fresh listing and a fresh request (plan decision 21).

test("an admin gives a fresh account the mentor role by email, and takes it away through its confirm page (spec 2.3 to 2.7)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const student = newBuyer();
  await signUp(page, student);

  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/staff");
  await expect(main(admin).getByRole("heading", { level: 1, name: "Staff accounts" })).toBeVisible();
  await expect(admin).toHaveTitle("Staff accounts · Vossie");
  // The email's case doesn't matter: it's matched exactly once normalised (spec decision 3).
  await giveRole(admin, student.email.toUpperCase(), "Mentor");
  const row = main(admin).getByRole("row").filter({ hasText: student.email });
  await expect(row).toContainText("Mentor");

  // The person is told, and their tools are on their account page at their next page load.
  await page.goto("/notifications");
  await expect(
    main(page)
      .getByText("You're a Vossie mentor now. The Hub's tools and the mentor dashboard are on your account page.")
      .filter({ visible: true }),
  ).toBeVisible();
  await page.goto("/account");
  await expect(main(page).getByRole("link", { name: "Mentor dashboard" })).toBeVisible();
  await expect(main(page).getByRole("link", { name: "Hub posts and office hours" })).toBeVisible();
  await page.goto("/mentor");
  await expect(main(page).getByRole("heading", { level: 1, name: "Mentor dashboard" })).toBeVisible();

  // Remove it through the confirm page.
  await row.getByRole("link", { name: `Remove ${student.firstName}'s mentor role` }).click();
  await expect(main(admin).getByRole("heading", { level: 1, name: `Remove ${student.firstName}'s mentor role` })).toBeVisible();
  await expect(main(admin)).toContainText(`${student.firstName} mentors no shops.`);
  await expect(field(admin, "Reason")).toHaveCount(0);
  await button(admin, `Remove ${student.firstName}'s mentor role`).click();
  await expect(staffNotice(admin)).toHaveText("Role removed. They've been told.", POST_LANDS);
  await expect(main(admin).getByRole("row").filter({ hasText: student.email })).toHaveCount(0);

  // The log has both, under Staff accounts.
  await admin.goto("/admin/audit?kind=staff");
  await expect(main(admin).getByRole("row").filter({ hasText: student.firstName }).filter({ hasText: "Gave a staff role" })).toHaveCount(1);
  await expect(main(admin).getByRole("row").filter({ hasText: student.firstName }).filter({ hasText: "Removed a staff role" })).toHaveCount(1);
  await admin.context().close();

  await page.goto("/notifications");
  await expect(
    main(page).getByText("Your mentor role on Vossie has ended. Thank you for helping student sellers.").filter({ visible: true }),
  ).toBeVisible();
  if (STAFF_404_IS_REAL) expect((await page.request.get("/mentor", { maxRedirects: 0 })).status()).toBe(404);
  await page.goto("/mentor");
  await expect(notFoundHeading(page)).toBeVisible();
});

test("the admin's own row has no Remove admin role, and an unknown email keeps what was typed, the summary focused (spec 2.3, 2.5 and 7)", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  // Without the app's JavaScript: a page load is what focuses the error summary (plan decision 21).
  const context = await browser.newContext({ baseURL, serviceWorkers: "block", javaScriptEnabled: false });
  await copySession(browser, context, baseURL!, "Admin");
  const admin = await context.newPage();
  await admin.goto("/admin/staff");
  const own = main(admin).getByRole("row").filter({ hasText: "admin@eduvos.com" });
  await expect(own).toContainText("This is you.");
  await expect(own.getByRole("link", { name: /admin role$/ })).toHaveCount(0);

  const unknown = `nobody-${uniqueWord()}@eduvos.com`;
  await field(admin, "Eduvos email").fill(unknown);
  await main(admin).getByRole("radio", { name: "Admin", exact: true }).check();
  await button(admin, "Give role").click();
  const summary = main(admin).getByRole("alert", { name: "There's a problem" });
  await expect(summary).toContainText(
    "No Vossie account uses that email. Ask them to sign in once, then try again.",
    POST_LANDS,
  );
  await expect(summary).toBeFocused();
  await expect(field(admin, "Eduvos email")).toHaveValue(unknown);
  await expect(main(admin).getByRole("radio", { name: "Admin", exact: true })).toBeChecked();
  // The address isn't in the link.
  expect(admin.url()).not.toContain("nobody");
  await context.close();
});

test("a hidden listing is shown again from /admin/hidden: back in browse and on its page, its seller told, its report still closed (spec 2.14)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const word = uniqueWord();
  const title = `Desk fan ${word}`;
  const seller = await signedInPage(browser, baseURL!, "Seller, Tech corner", "/sell");
  const id = await publishListing(seller, title);
  await signUp(page, newBuyer());
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
  await hideListingByReport(page, admin, id, title);
  await page.goto(browseFor(word));
  await expect(page.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeVisible();

  // Overview says something is hidden, and links to the list; the list has it.
  await admin.goto("/admin");
  await main(admin).getByRole("link", { name: / (is|are) hidden$/ }).click();
  await expect(admin).toHaveURL(/\/admin\/hidden$/);
  const row = main(admin).getByRole("row").filter({ hasText: title });
  await expect(row).toContainText("Tech corner");
  await expect(row).toContainText("Hidden while the Hub checks it.");
  await row.getByRole("link", { name: `Show ${title} again` }).click();
  await expect(main(admin).getByRole("heading", { level: 1, name: `Show ${title} again` })).toBeVisible();
  await expect(main(admin)).toContainText("To hide it again, someone has to report it.");
  await button(admin, `Show ${title} again`).click();
  await expect(staffNotice(admin)).toHaveText("Showing again. Its seller has been told.", POST_LANDS);
  await expect(main(admin).getByRole("row").filter({ hasText: title })).toHaveCount(0);

  // Back for buyers: browse (its counts read again) and its own page.
  await page.goto(browseFor(word));
  await expect(cardsFor(page, word)).toHaveCount(1);
  await page.goto(`/listings/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // The seller is told; the report still reads closed, as hidden.
  await seller.goto("/notifications");
  await expect(
    main(seller).getByText(`The Hub is showing ${title} again. It's back in My listings.`).filter({ visible: true }),
  ).toBeVisible();
  await admin.goto("/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
  await expect(main(admin)).toContainText(/Listing hidden on .+ by Pieter\./);
  await admin.context().close();
  await seller.context().close();
});

test("a hidden Looking For request is shown again from its report's page: back on the board, its asker told (spec 2.14)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  await signUp(page, newBuyer());
  const title = `Lab coat ${uniqueWord()}`;
  const id = await postRequest(page, title);
  const reporting = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const reporter = await reporting.newPage();
  await signUp(reporter, newBuyer());
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
  await hideRequestByReport(reporter, admin, id, title);
  await page.goto(`/looking-for/${id}`);
  await expect(notFoundHeading(page)).toBeVisible();

  // The closed report's page offers Show it again beside the hidden line (plan decision 18).
  await admin.goto("/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
  await expect(main(admin)).toContainText("Students can't see this request: the Hub has hidden it.");
  await main(admin).getByRole("link", { name: "Show it again" }).click();
  await expect(admin).toHaveURL(new RegExp(`/admin/hidden/requests/${id}$`));
  await button(admin, `Show ${title} again`).click();
  await expect(staffNotice(admin)).toHaveText("Showing again. The asker has been told.", POST_LANDS);
  await admin.context().close();
  await reporting.close();

  // Back on its page and the board (newest first, so near the top), and the asker is told.
  await page.goto(`/looking-for/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await page.goto("/looking-for");
  await expect(page.getByRole("heading", { level: 3, name: title })).toBeVisible();
  await page.goto("/notifications");
  await expect(
    main(page).getByText(`The Hub is showing your request ${title} again.`).filter({ visible: true }),
  ).toBeVisible();
});

test("the numbers: both tables, a campus view and the key, and a real 404 for a student (spec 2.9 to 2.13)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/numbers");
  await expect(main(admin).getByRole("heading", { level: 1, name: "Numbers" })).toBeVisible();
  await expect(admin).toHaveTitle("Numbers · Vossie");
  await expect(main(admin).getByRole("table", { name: "All campuses, by week" })).toBeVisible();
  await expect(main(admin).getByRole("table", { name: /^By campus, last week \(/ })).toBeVisible();
  await expect(main(admin).getByText("Hidden: not shown, so the total can't reveal a small number.").first()).toBeVisible();
  await main(admin).getByRole("link", { name: "Midrand", exact: true }).click();
  await expect(admin).toHaveURL(/\/admin\/numbers\?campus=midrand$/);
  await expect(main(admin).getByRole("table", { name: "Midrand, by week" })).toBeVisible();
  await main(admin).getByRole("link", { name: "All campuses", exact: true }).click();
  await expect(main(admin).getByRole("table", { name: "All campuses, by week" })).toBeVisible();
  await admin.context().close();

  await signInAsSample(page, "Student, Midrand", "/account");
  if (STAFF_404_IS_REAL) expect((await page.request.get("/admin/numbers", { maxRedirects: 0 })).status()).toBe(404);
  await page.goto("/admin/numbers");
  await expect(notFoundHeading(page)).toBeVisible();
});
```

If the board turns out to page its requests so a new one isn't on the first page, check `/looking-for` filtered to the request's campus instead, and say so in the hand-over.

- [ ] **Step 5: The checks**

Create `tests/e2e/staff-accounts-checks.spec.ts`:

```ts
import { brotliCompressSync, constants } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { postRequest } from "./helpers/community";
import { button, main, newBuyer, signInAsSample, signUp } from "./helpers/messaging";
import { POST_LANDS, uniqueWord } from "./helpers/selling";
import { expectStill, holdFonts, recordShifts } from "./helpers/shifts";
import { signedInPage, staffNotice } from "./helpers/staff";
import { copySession, DESKTOP, giveRole, hideRequestByReport, PHONE } from "./helpers/staff-accounts";

// Accessibility, layout shift and size for stage J's staff pages (plan Task 13; spec sections 7 and 8). They run in the
// staff-accounts-writes project, signed in as the sample admin. The only writes are a fresh account's role (given and
// taken away again) and a fresh request (hidden and shown again).

test.use({ reducedMotion: "reduce" });

const SIZES = [
  ["390", PHONE],
  ["1440", DESKTOP],
] as const;

/** Axe once the page's title has streamed in (staff tools plan, Task 21's finding). */
async function expectNoSeriousIssues(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  expect(await seriousIssues(page)).toEqual([]);
}

const PAGES: ReadonlyArray<[path: string, heading: string]> = [
  ["/admin/staff", "Staff accounts"],
  ["/admin/staff/acc-mentor/remove-mentor", "Remove Naledi's mentor role"],
  ["/admin/staff/acc-admin/remove-admin", "Remove Pieter's admin role"],
  ["/admin/numbers", "Numbers"],
  ["/admin/numbers?campus=midrand", "Numbers"],
  ["/admin/hidden", "Hidden listings and requests"],
];

test.describe("stage J's staff pages have no serious or critical axe issues (spec section 7)", () => {
  for (const [path, heading] of PAGES) {
    for (const [size, device] of SIZES) {
      test(`${path} at ${size}px, signed in as the admin`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({ ...device, baseURL, serviceWorkers: "block" });
        const page = await context.newPage();
        await signInAsSample(page, "Admin", path);
        await expect(main(page).getByRole("heading", { level: 1, name: heading })).toBeVisible();
        await expectNoSeriousIssues(page);
        await context.close();
      });
    }
  }

  test("/admin/staff with Give role's errors", async ({ page }) => {
    await signInAsSample(page, "Admin", "/admin/staff");
    await button(page, "Give role").click();
    await expect(main(page).getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
    await expectNoSeriousIssues(page);
  });

  test("a remove-admin confirm page with its button, for a fresh second admin, given and taken away again", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const student = newBuyer();
    await signUp(page, student);
    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/staff");
    await giveRole(admin, student.email, "Admin");
    await main(admin)
      .getByRole("row")
      .filter({ hasText: student.email })
      .getByRole("link", { name: `Remove ${student.firstName}'s admin role` })
      .click();
    await expect(button(admin, `Remove ${student.firstName}'s admin role`)).toBeVisible();
    await expectNoSeriousIssues(admin);
    await button(admin, `Remove ${student.firstName}'s admin role`).click();
    await expect(staffNotice(admin)).toHaveText("Role removed. They've been told.", POST_LANDS);
    await admin.context().close();
  });

  test("/admin/hidden with rows, and a request's Show again page", async ({ page, browser, baseURL }) => {
    test.setTimeout(120_000);
    await signUp(page, newBuyer());
    const title = `Kettle ${uniqueWord()}`;
    const id = await postRequest(page, title);
    const reporting = await browser.newContext({ baseURL, serviceWorkers: "block" });
    const reporter = await reporting.newPage();
    await signUp(reporter, newBuyer());
    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
    await hideRequestByReport(reporter, admin, id, title);
    await admin.goto("/admin/hidden");
    await expect(main(admin).getByRole("row").filter({ hasText: title })).toBeVisible();
    await expectNoSeriousIssues(admin);
    await admin.goto(`/admin/hidden/requests/${id}`);
    await expect(button(admin, `Show ${title} again`)).toBeVisible();
    await expectNoSeriousIssues(admin);
    // Leave it as it was.
    await button(admin, `Show ${title} again`).click();
    await expect(staffNotice(admin)).toHaveText("Showing again. The asker has been told.", POST_LANDS);
    await admin.context().close();
    await reporting.close();
  });
});

const SHIFT_PAGES: ReadonlyArray<[name: string, path: string]> = [
  ["Staff accounts", "/admin/staff"],
  ["Numbers", "/admin/numbers"],
];

for (const [name, path] of SHIFT_PAGES) {
  for (const [size, device] of SIZES) {
    test(`the ${name} page holds still at ${size}px while fonts and content arrive (CLS 0.05 or less, homepage spec 11)`, async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({ ...device, baseURL, serviceWorkers: "block" });
      await copySession(browser, context, baseURL!, "Admin");
      const page = await context.newPage();
      await holdFonts(page);
      await recordShifts(page);
      await expectStill(page, `${name} (${size}px)`, path);
      await context.close();
    });
  }
}

const SIZE_PAGES: ReadonlyArray<[name: string, path: string]> = [
  ["Overview", "/admin"],
  ["Staff accounts", "/admin/staff"],
  ["Numbers", "/admin/numbers"],
  ["Hidden", "/admin/hidden"],
];

for (const [name, path] of SIZE_PAGES) {
  test(`a first visit to the staff ${name} page at 390px, signed in, loads no new JavaScript (spec section 8)`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ ...PHONE, baseURL, serviceWorkers: "block" });
    await copySession(browser, context, baseURL!, "Admin");
    const page = await context.newPage();
    let scriptBrotli = 0;
    const pending: Array<Promise<void>> = [];
    page.on("response", (response) => {
      if (response.request().resourceType() !== "script") return;
      pending.push(
        response.body().then((body) => {
          scriptBrotli += brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
        }),
      );
    });
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
    await Promise.all(pending);
    console.log(`staff ${name} (signed in): ${JSON.stringify({ scriptBrotli })}`);
    expect(scriptBrotli, "JavaScript, brotli as a host serves it").toBeLessThanOrEqual(150 * 1024);
    await context.close();
  });
}
```

- [ ] **Step 6: The status checks, in G's staff tests**

In `tests/e2e/staff.spec.ts`, add the import:

```ts
import { ADMIN_PAGES, HUB_AND_MENTOR_PAGES, STAFF_404_IS_REAL } from "./helpers/staff-accounts";
```

In the first test ("answer 404 to a student, titled Page not found, and never advertise themselves"), add these to the list of paths, after `"/admin/audit",`:

```ts
      "/admin/numbers",
      "/admin/staff",
      "/admin/staff/acc-mentor/remove-mentor",
      "/admin/hidden",
      "/admin/hidden/listings/l-001",
```

and add at the end of the file:

```ts
test.describe("staff pages' status (stage J spec decision 15)", () => {
  test.skip(!STAFF_404_IS_REAL, "Stage J's spike kept stage G's pattern: the 404 page streams in with status 200");

  test("answer a real 404 to a student on every staff page", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Student, Midrand", "/account");
    for (const path of [...ADMIN_PAGES, ...HUB_AND_MENTOR_PAGES]) {
      expect((await page.request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
    }
  });

  test("answer a real 404 to a mentor on the admin console, and 200 on the Hub's tools and the dashboard", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Mentor", "/account");
    for (const path of ADMIN_PAGES) {
      expect((await page.request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
    }
    for (const path of ["/hub/manage", "/mentor"]) {
      expect((await page.request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
    }
  });

  test("send a signed-out visitor to sign in with a real 307, coming back to the page afterwards", async ({ request }) => {
    onlyAt(...BOTH);
    for (const path of [...ADMIN_PAGES, ...HUB_AND_MENTOR_PAGES]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      const location = new URL(response.headers().location ?? "", "http://localhost");
      expect(`${location.pathname}${location.search}`, path).toBe(`/login?next=${encodeURIComponent(path)}`);
    }
  });
});
```

If Task 1 failed, set `STAFF_404_IS_REAL = false` in the helpers: the three tests skip, and the writes spec's two status lines are skipped by their `if`.

Run: `pnpm lint tests/e2e playwright.config.ts`
Expected: no problems. Then `grep -rn "newContext(" tests/e2e | grep -v serviceWorkers`
Expected: no output (CLAUDE.md's rule).

- [ ] **Step 7: Run them in a scratch copy**

Make the scratch copy (`S="<your scratchpad>/vossie-j-task13"`), copying in this task's files. From `$S`:

```bash
pnpm typecheck
pnpm e2e tests/e2e/staff.spec.ts tests/e2e/routes.spec.ts --project=phone-390 --project=desktop-1440
pnpm e2e --project=staff-accounts-writes --no-deps
pnpm e2e tests/e2e/performance.spec.ts tests/e2e/staff-checks.spec.ts --project=phone-390
```

Expected:
- the type check is clean;
- `staff.spec.ts` and `routes.spec.ts` pass, the three status tests included (or skipped, if Task 1 failed);
- `staff-accounts-writes` passes: 5 writes tests, 12 + 3 axe tests, 4 layout-shift tests (each printing a total of 0.05 or less), 4 size tests;
- the size lines print `staff Overview (signed in)`, `staff Staff accounts (signed in)`, `staff Numbers (signed in)` and `staff Hidden (signed in)` with the same `scriptBrotli`, the shell's 150,591 B (the staff pages load no new client code);
- `performance.spec.ts`'s figures equal Task 12's row to the byte.

Write the figures and the layout-shift totals into your report for the ledger. If any staff page's figure differs from Overview's, or any public figure from Task 12's, stop and report.

- [ ] **Step 8: Hand over**

Files: `playwright.config.ts`, `tests/e2e/helpers/staff-accounts.ts`, `tests/e2e/staff-accounts-writes.spec.ts`, `tests/e2e/staff-accounts-checks.spec.ts`, `tests/e2e/staff.spec.ts`. Message:

```
test: end to end for stage J in a staff-accounts-writes project that runs last: a fresh account given the mentor role by email and its removal, the admin's own row and an unknown email without JavaScript, a listing and a request hidden and shown again, the numbers' tables and campus view; real 404 and 307 status checks for every staff page in staff.spec.ts; axe, layout shift and size for the new pages (stage J spec section 9; plan decisions 21 and 22). E2E: staff-accounts-writes <n> passed. JS signed in: Overview, Staff accounts, Numbers, Hidden <figure> B; public pages unchanged
```

---

### Task 14: Review screenshots, docs and final checks

The stage's records: review screenshots, CLAUDE.md, the spec's "Changes on plan review and build", the go-live checklist, and this plan's ledger and changes. **`docs/PROGRESS.md` and `docs/reference/LANDING-DECISIONS.md` hold other sessions' uncommitted lines, so this task doesn't edit them:** it writes their new text as two snippet files in your scratchpad, `j-progress.md` and `j-decision.md`, and the controller merges them, as for stages G and I.

**Files:**
- Create: `tests/e2e/staff-accounts-screenshots.spec.ts`
- Create: `docs/progress/staff-accounts/*.png` (18 files)
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-20-staff-accounts-and-numbers-design.md`
- Modify: `docs/reference/GO-LIVE.md`
- Modify: `docs/superpowers/plans/2026-10-20-staff-accounts-and-numbers.md` (this plan)
- Create (scratchpad, not the project): `j-progress.md`, `j-decision.md`

- [ ] **Step 1: Check the docs are still yours to edit**

Run: `git --no-optional-locks status --short CLAUDE.md docs/reference/GO-LIVE.md docs/superpowers/specs/2026-10-20-staff-accounts-and-numbers-design.md docs/superpowers/plans/2026-10-20-staff-accounts-and-numbers.md docs/progress`
Expected: no output (all committed). If any shows as modified by someone else, stop and report.

- [ ] **Step 2: The screenshots test**

Create `tests/e2e/staff-accounts-screenshots.spec.ts`:

```ts
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { postRequest } from "./helpers/community";
import { button, main, newBuyer, signInAsSample, signUp } from "./helpers/messaging";
import { POST_LANDS, uniqueWord } from "./helpers/selling";
import { signedInPage } from "./helpers/staff";
import { DESKTOP, hideRequestByReport, PHONE } from "./helpers/staff-accounts";

// Review screenshots for stage J (plan Task 14), at 390 and 1440px, into docs/progress/staff-accounts/. They run last, in
// the staff-accounts-writes project, and hide one fresh request of their own for the hidden list and its Show again page.

const OUT = "docs/progress/staff-accounts";
const SIZES = [
  ["390", PHONE],
  ["1440", DESKTOP],
] as const;

test("review screenshots of staff accounts, the numbers and the hidden list (stage J spec section 9)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  await mkdir(OUT, { recursive: true });
  await signUp(page, newBuyer());
  const title = `Lab coat ${uniqueWord()}`;
  const id = await postRequest(page, title);
  const reporting = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const reporter = await reporting.newPage();
  await signUp(reporter, newBuyer());
  const hider = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
  await hideRequestByReport(reporter, hider, id, title);
  await hider.context().close();
  await reporting.close();

  const shots: ReadonlyArray<[name: string, path: string, heading: string]> = [
    ["overview", "/admin", "Overview"],
    ["staff", "/admin/staff", "Staff accounts"],
    ["remove-mentor", "/admin/staff/acc-mentor/remove-mentor", "Remove Naledi's mentor role"],
    ["remove-own-admin", "/admin/staff/acc-admin/remove-admin", "Remove Pieter's admin role"],
    ["numbers", "/admin/numbers", "Numbers"],
    ["numbers-midrand", "/admin/numbers?campus=midrand", "Numbers"],
    ["hidden", "/admin/hidden", "Hidden listings and requests"],
    ["show-request-again", `/admin/hidden/requests/${id}`, `Show ${title} again`],
  ];
  for (const [size, device] of SIZES) {
    const context = await browser.newContext({ ...device, baseURL, serviceWorkers: "block" });
    const admin = await context.newPage();
    await signInAsSample(admin, "Admin", "/admin");
    for (const [name, path, heading] of shots) {
      await admin.goto(path);
      await expect(main(admin).getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await admin.evaluate(() => window.scrollTo(0, 0));
      await admin.screenshot({ path: `${OUT}/${name}-${size}.png`, fullPage: true });
    }
    // Give role with nothing typed: the summary and both fields' errors.
    await admin.goto("/admin/staff");
    await button(admin, "Give role").click();
    await expect(main(admin).getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
    await admin.evaluate(() => window.scrollTo(0, 0));
    await admin.screenshot({ path: `${OUT}/staff-errors-${size}.png`, fullPage: true });
    await context.close();
  }
});
```

Make the scratch copy (`S="<your scratchpad>/vossie-j-task14"`), copying in the new spec. From `$S`: `pnpm e2e tests/e2e/staff-accounts-screenshots.spec.ts --project=staff-accounts-writes --no-deps`. Expected: 1 passed, and `ls "$S/docs/progress/staff-accounts" | wc -l` prints `18`. Copy them into the project: `mkdir -p docs/progress/staff-accounts` (it's new; check with `ls docs/progress` first), then `cp "$S"/docs/progress/staff-accounts/*.png docs/progress/staff-accounts/`. Open a few and check they show what their names say.

- [ ] **Step 3: CLAUDE.md**

**If Task 1 passed**, in `CLAUDE.md`:
- replace the line `- Never read \`cookies()\`, \`headers()\` or \`searchParams\` outside \`<Suspense>\`.` with:

```md
- Never read `cookies()`, `headers()` or `searchParams` outside `<Suspense>`. The one exception is a staff page, which blocks on purpose (below).
```

- replace the line that starts `- Staff pages (\`/admin\`, \`/hub/manage\`, …) render a wordless \`StaffSkeleton\`…` with:

```md
- Staff pages (`/admin`, `/hub/manage`, `/hub/new`, `/hub/[id]/edit`, `/mentor`) are blocking pages: `export const instant = false`, then `await requireStaff(area, nextPath)` (`lib/staff/access.ts`) at the top of the page component, before it returns anything (after awaiting `params` on dynamic routes), so Next answers a real 307 to sign-in when signed out and a real 404 for anyone without the role, before the first byte (stage J spec decision 15). They have no static shell and no `<Suspense>` of their own (`StaffSkeleton` is unused). Their tab title comes from `staffMetadata()`. No public page links to them, and links into them never prefetch.
```

- in the dynamic routes list, add at the end of the line that starts `  - \`params\` is awaited inside \`<Suspense>\`…`: ` Staff pages are the exception: they await \`params\` at the top, before the role check.`

**Either way**, add after the line that starts `- Every staff action is a Server Action in \`lib/staff/*-actions.ts\`…`:

```md
- Staff roles are given only by exact email (`giveRole` in `lib/data/staff-accounts.ts`), never through a search, a suggestion or a list of students. An admin never removes their own admin role, and `removeRole` refuses to remove the last admin. Nothing cached reads roles: `getViewer()` reads them on every request.
- The admin's numbers (`/admin/numbers`) show private counts (enquiries, reports, follows) only through `protectCounts` (`lib/staff/numbers.ts`): 1 to 4 as "Under 5", a second cell "Hidden" where the total would give one away, Since the start in tens. They never name, link or id anything counted, and never count saved searches.
```

and add after the `alerts-writes` line:

```md
- End-to-end tests that give or take away staff roles, hide and show listings or requests again, or read the admin's numbers go in `tests/e2e/staff-accounts-writes.spec.ts`, with their checks in `staff-accounts-checks.spec.ts` and screenshots in `staff-accounts-screenshots.spec.ts`: all three run last, in the `staff-accounts-writes` project, after `alerts-writes`. Fresh accounts only: never change the sample staff's roles.
```

- [ ] **Step 4: The spec's "Changes on plan review and build"**

At the end of `docs/superpowers/specs/2026-10-20-staff-accounts-and-numbers-design.md`, add a section `## 12. Changes on plan review and build`, a numbered list with one item for each of these (write each as a sentence or two, in the spec's style, naming the plan decision):
1. Task 1's spike: passed or failed, with its `curl` figures; what that means for every staff page.
2. Open shops now doesn't need Verified (plan decision 12), unlike Featured's test.
3. Only Tech corner is seeded with `approvedAt`; Lerato's waiting shop has none (plan decision 4); `approveShop` takes `now`; the shop export carries `approvedAt`.
4. `getStaffAccount`, `getHidden` and `countHidden` join the data functions; `showRequest` takes `now` (plan decisions 5 and 16).
5. The policy's "Who can see it" is its "Who it is shared with" section (plan decision 20).
6. Unknown email's focus is checked without the app's JavaScript (plan decision 21).
7. The small-number rule's residual with two or more "Under 5" cells, or a "Hidden" 5, for Lama (plan decision 14).
8. The role actions expire no tag (plan decision 8).
9. No new CSS in `app/globals.css`; utilities on the new row headers and campus links (plan decision 3).
10. Whatever "Changes made during the build" below records that changes what the spec says.

- [ ] **Step 5: The go-live checklist**

In `docs/reference/GO-LIVE.md`:
- **Section 6:** if Task 1 passed, tick `- [ ] A true 404 status for staff pages: …` (`- [x]`) and add after it ` Built in stage J as blocking pages (instant = false); a proxy is no longer needed for it.` Then add, below the stage G items:

```md
- [x] Stage J: staff accounts (roles given by exact email and removed on a confirm page), the admin's weekly numbers with the small-number rule, and Show again for hidden listings and requests. Built in sample mode (<date>); the items below move it to the real database.
- [ ] The admin's numbers as a SQL view, `admin_weekly_counts(week_start, campus_slug, measure, count)`, grouping each table by `date_trunc('week', created_at at time zone 'Africa/Johannesburg')`, read through an admin-only RPC; then a weekly roll-up into `weekly_campus_counts` at 00:15 SAST each Monday, once the view is slow or retention starts deleting old rows (stage J spec section 8). The small-number rule stays in the app.
- [ ] The last-admin rule in the database: a transaction, or a trigger that refuses removing the last `admin` (stage J spec decision 5).
- [ ] A way to give the first admin role outside the app: a seed or a one-off script, never a page (stage J spec decision 8).
```

- in the scheduled jobs item, add "the numbers' weekly roll-up" to its list;
- in section 6's content list, change "the real staff accounts (mentors and admins); managing them in the app is not built (staff tools spec 7)" to "give the real staff their roles in `/admin/staff` (stage J)";
- **Section 7:** tick "**Showing a hidden listing again.**" and replace its sentence with "Built in stage J: `/admin/hidden`, with a confirm page; hiding it again needs a new report.", and add:

```md
- [ ] **Should an admin be able to act on their own shop?** Approve, verify or pin it. Not prevented today (stage J spec section 10).
- [ ] **The numbers' small-number rule** leaves one inference: two or more "Under 5" cells in a column, or a "Hidden" cell of exactly 5, can be worked out from the total. Rounding totals or hiding more is a later choice (stage J plan decision 14).
```

- in section 8's suggested order, add stage J after stage I, as G's and I's lines are written.

- [ ] **Step 6: This plan's ledger and changes**

In this plan:
- fill in the JS ledger's rows from Tasks 1, 12 and 13's reports (the Final row is the controller's, Step 8), the staff pages' line, and the unit and e2e counts at the start;
- under "Changes made during the build", list each task with its commit (`git --no-optional-locks log --oneline`, one command), and every place where the build differed from the tasks as written (the spike's outcome first), as I's and G's plans do.

- [ ] **Step 7: The snippets for the controller**

Write, in your scratchpad (not the project):
- `j-progress.md`: a section for `docs/PROGRESS.md` in the shape of stage I's (`## 2026-10-<day>: Staff accounts, the admin's numbers and Show again, built in sample mode (stage J)`), with what was built, the JS figures, the unit and e2e counts, the screenshots' folder, and the open points for Lama (plan decisions 10, 14, 20 and 28's wording; the spike's outcome; `StaffSkeleton` unused if it held; the go-live items);
- `j-decision.md`: one row for `docs/reference/LANDING-DECISIONS.md`, numbered with the next free number (read the file; stage I's is 76, and another session's rows may follow it), summarising the stage and "decided by Claude under decision 54; Lama may revisit".

Give both files' paths to the controller in the hand-over. The controller merges them into the two files by hand, around the other sessions' uncommitted lines, and stages only its own lines (as for stages G and I).

- [ ] **Step 8: Final checks (the controller)**

The controller, in a fresh scratch copy of HEAD with this task's files copied in:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Expected: clean lint and types; every unit test passing (record the count); the build listing every staff page as dynamic with no Suspense or generateMetadata error; the whole e2e run passing, with `staff-accounts-writes` last; `performance.spec.ts`'s figures equal to the ledger's to the byte. After the build: `grep -l "serviceWorker.register" .next/static/chunks/*.js` prints nothing (CLAUDE.md). Fill in the ledger's Final row.

- [ ] **Step 9: Hand over**

Files: `tests/e2e/staff-accounts-screenshots.spec.ts`, `docs/progress/staff-accounts/` (18 PNGs), `CLAUDE.md`, `docs/superpowers/specs/2026-10-20-staff-accounts-and-numbers-design.md`, `docs/reference/GO-LIVE.md`, `docs/superpowers/plans/2026-10-20-staff-accounts-and-numbers.md`. Snippets for the controller: `<scratchpad>/j-progress.md`, `<scratchpad>/j-decision.md`. Message:

```
docs: stage J's review screenshots (18, at 390 and 1440px, from tests/e2e/staff-accounts-screenshots.spec.ts), CLAUDE.md (blocking staff pages, roles by exact email, the numbers' small-number rule, the staff-accounts-writes project), the spec's changes on plan review and build, the go-live checklist and the plan's ledger and build changes. Unit: <count>. E2E: <counts>. JS: no public page moved
```

---

## Self-review (while drafting the tasks)

- **Spec coverage.** Every spec decision maps to a task in "Where each spec decision is built". Section 9's unit list: `giveRole` (Task 4), `removeRole` (Task 4), each action's gate, token, entry, notification and "Nothing changed" (Tasks 7 and 8), deletion and privacy settings (Tasks 8 and 12), `sastWeeks` (Task 5), `countByWeek` (Task 6), `protectCounts` (Task 5), Show again (Task 7), the words and `parseAuditFilter` and the icon (Task 3). Its end to end list: Task 13, the screenshots Task 14.
- **Names against HEAD.** `requireStaff`, `staffMetadata`, `recordAudit`, `notify`, `leaveNotice`, `takeNotice`, `clearStaffForm`, `issueOnceToken`, `sentOnceToken`, `takeOnceToken`, `leaveOnceToken`, `staffErrors`, `field`, `done`, `isId`, `keepTyped`, `normaliseEmail`, `findAccountByEmail`, `hideListing`, `hideRequest`, `closeReportsOn`, `listedListings`, `liveSellerRows`, `myListingsPath`, `tabFor`, `YOUR_REQUESTS_PATH`, `listingsChanged`, `requestsChanged`, `shortSastDate`, `sastDate`, `addDays`, `dayMonth`, `isSampleMode` and the e2e helpers (`signInAsSample`, `signUp`, `newBuyer`, `main`, `field`, `button`, `onlyAt`, `uniqueWord`, `POST_LANDS`, `publishListing`, `browseFor`, `cardsFor`, `notFoundHeading`, `postRequest`, `signedInPage`, `staffNotice`, `seriousIssues`, `recordShifts`, `holdFonts`, `expectStill`) were read from the code at `85e3b28`.
- **Shared files left alone.** `app/globals.css`, `app/layout.tsx`, `tests/e2e/a11y.spec.ts`, `tests/e2e/screenshots.spec.ts`, `tests/e2e/helpers/messaging.ts`, `docs/PROGRESS.md` and `docs/reference/LANDING-DECISIONS.md` are never edited.
- **Type consistency.** `StaffAccount`, `GivenRole`, `RemovedRole` (Task 4); `Measure`, `Period`, `RawColumn`, `RawCounts`, `ShownColumn`, `ShownCounts`, `SastWeeks` (Task 5); `HiddenItem`, `ShownListing` (Task 7); `GIVE_ROLE_FIELDS`, `GIVE_ROLE_FORM`, `removeRoleForm`, `ROLE_CHOICES` (Task 3) are used with the same names in every later task.
