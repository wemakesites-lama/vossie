# Vossie Housekeeping (Stage L, Sample Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build stage L as the spec `docs/superpowers/specs/2026-10-20-housekeeping-design.md` describes:
- no admin approves, verifies, pauses, pins, mentors or otherwise judges their own shop, its listings or their own Looking For request: the gate is in the Server Action, and the staff pages say why in place of the controls;
- nobody reads the mentors' notes about themselves (already true at HEAD: plan decision 1 pins it and builds the two parts still open);
- an old Looking For request closes itself (3 days after its needed-by date, else 30 days after it last changed), its asker is told once, and they can reopen it;
- the sitemap lists only open requests, tips, and events and office hours from today on.

Every form works without the app's JavaScript, and no page gains a byte of JavaScript.

**Architecture:**
- **Ownership is three synchronous reads of the store** (`isOwnShop`, `isOwnListing`, `isOwnRequest` in `lib/data/staff-shops.ts`) and one plain mapping, `ownsTarget` (`lib/staff/own.ts`), which names the kind of thing a report is about. Every admin action spec decision 1 names calls one of them after `requireStaff()` and before it reads a reason or writes anything; a refusal leaves the `own-shop` or `own-request` notice and ends with `done()` (Tasks 1 to 3).
- **The views learn whose it is from the data** (`ReportView.own`, `HiddenItem.own`, `PinView.own`, `featuredChoices(viewerId)`, `listMentors(exceptOwnerId)`), and the pages pass the signed-in admin's id (Tasks 2 and 4).
- **The closing rule is a pure function of the stored row** (`closingDay`, `requestOpenOn`, `closedAtFor` in `lib/looking-for/rules.ts`), so cached readers stay pure: `LookingForRequest.closesOn` is worked out in `toRequest`, and the list readers take `today` (Task 5).
- **`settleRequests(now)` stores the close** the first time request-time code looks (the board, the homepage's section, the request page's session part, the offer composer, the asker's own reads, and every Looking For and request staff action), marks every due row before anything is awaited, then tells each asker once (Tasks 6 and 7).
- **The sitemap renders per fetch** (`connection()`, then `sastToday()`), reading two dated, cached readers (Task 10).
- **No new table, cookie, client component or CSS.** `RequestRow` gains one field (`closedBy`), so `STORE_VERSION` moves from 11 to 12 (the Supabase merge took 11 for `AuditRow.relatedId`). No edit to `app/layout.tsx` or `app/globals.css`, and no import of `lib/supabase` or `@supabase/*`.

**Tech Stack:** As stage K leaves it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5.9;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5.0 with Testing Library and jsdom;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-20-housekeeping-design.md` (committed `03afadd`). "Spec 2.N" in this plan means its section 2, decision N; "spec 3" means its section 3.
- **The stages this builds on:** E (`lib/data/messages.ts`' settle on read, notifications), G (`lib/staff/admin-actions.ts`, mentors, Featured; `docs/superpowers/plans/2026-10-14-staff-tools.md`, amendment 15.3), H (`lib/looking-for/*`, `lib/data/requests.ts`; the community actions plan, amendment 19.6), J (roles, Show again, `countAdmins`), K (`docs/superpowers/plans/2026-10-20-hardening.md`, whose format, conventions and scratch copy this plan copies).
- **Where a plan and the code differ, the code at HEAD wins.** Every name, import and signature below was read from the code at `03afadd` on 2026-10-20.
- **Next 16.4's own words** (`node_modules/next/dist/docs/01-app/`):
  - the sitemap: `03-api-reference/03-file-conventions/01-metadata/sitemap.md` (a cached Route Handler "unless it uses a Request-time API");
  - `connection()`: `03-api-reference/04-functions/connection.md`;
  - `cacheLife`'s `default` profile: `03-api-reference/04-functions/cacheLife.md` (the 15 minutes of spec 2.15);
  - `"use cache"` arguments as cache keys: `03-api-reference/01-directives/use-cache.md`.
- **The go-live checklist:** `docs/reference/GO-LIVE.md`, sections 6 and 7.
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`, decision 54 (Claude decides under Lama's standing goal); stage L's row is **80**.

---

## Before you start

**This plan starts after the Supabase phases B and C merge** (`backend/phases-b-c` into main, in progress while this plan was written on top of `03afadd`, stage L's spec). That merge changes `lib/data/{audit,rows,staff-privacy,store}.ts`, `lib/staff/admin-actions.ts` (and its test), `components/account/PrivacySettingsView.tsx` and `lib/supabase/database.types.ts`; for this plan it means only that `STORE_VERSION` is 11 at the start (`AuditRow.relatedId`, so Task 5 makes it 12), and that `assignMentor`'s `recordAudit` call gains `relatedId` (Task 3 inserts its gate after `const now = new Date();`, above that call, so nothing it anchors on moves). Re-read those files at the new HEAD before Tasks 3 and 5. Other sessions share the working tree:
- **The header session** is editing `app/globals.css`, `components/header/*`, `components/tabbar/*` and `tests/e2e/{listing,responsive,a11y}.spec.ts`. **No task edits any of them.** Every new line reuses an existing class, `countNewNotifications` (which the header and tab bar call) keeps its signature and isn't touched, and every new end-to-end check goes in a new spec file (`tests/e2e/housekeeping-writes.spec.ts`). `components/home/LookingForRequests.tsx` is the homepage's, not the header's.
- **The Supabase session** works in another worktree and shares `.git`. No task imports `lib/supabase` or `@supabase/*`. Its untracked plans (`docs/superpowers/plans/2026-10-20-supabase-*.md`) and `docs/superpowers/specs/2026-10-15-positioning-and-editorial-design.md` are never edited.
- `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md` and `.claude/launch.json` carry other sessions' uncommitted lines. No task edits them; Task 12 writes snippets for the controller.
- **Check the dirty list before a task edits a file:** `git --no-optional-locks status --short <file>` prints nothing for it. If it prints a line and the file isn't this stage's, that's another session at work: stop and report.

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. Never stage `.claude/launch.json` or any file this plan doesn't list.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed.
3. **Files this plan removes:** none. No task runs `rm` on a project file.
4. **No new cookie or browser-storage name.** New code never writes a lowercase quoted `"vossie_…"` string (`app/privacy/page.test.tsx` collects those).
5. **A Playwright project that runs last of all** (Task 11): `housekeeping-writes`, after `hardening-writes`. Its first test gives the sample seller (Sipho, Tech corner's owner) the Admin role for its length and takes it away in a `finally`.
6. **Sample wording.** Every sentence in spec 3 "Words" and spec 4 "Words" goes in as written, as samples for Lama to change later; plan decision 7 changes one link's form, not its words.

No installs are needed by this plan. **If `package.json` or `pnpm-lock.yaml` changed at HEAD and `node_modules` doesn't match** (`pnpm typecheck` fails on a missing module), stop and ask the controller. Implementers never run an install.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time, and only read-only ones (`git status`, `git diff`, `git log`, `git show`, `git archive`). Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` a project file.
- Never kill an install or build that is still running.
- **Stop only servers you started, by their PID** (`kill <pid>` for the `pnpm start` you launched, found with `lsof -ti tcp:3204` only after checking it's yours). Never `pkill`, never `killall`, never stop a server on 3100 (Lama's dev server) or 3200 (the shared e2e port).
- **Show red in a scratch copy, never by moving files in the real repo.** A test that needs the old code to fail runs in the task's scratch copy, against the committed code with only the new test copied in.
- **A unit test that times out under load is rerun alone** (`pnpm test <that file>`) before it counts as a failure.
- Before you edit a shared file (`lib/staff/*`, `lib/data/*`, `lib/looking-for/*`, `lib/types.ts`, `components/staff/*`, `components/looking-for/*`, `app/admin/*`, `app/privacy/page.tsx`, `app/how-it-works/page.tsx`, `app/sitemap.ts`, `playwright.config.ts`, `CLAUDE.md`, `docs/*`), read its current text and edit by the exact lines that are there now. Never paste back a whole file from an older copy, except where a step gives a whole new file.

## Recheck before starting

Before Task 1, check each item, one command or file at a time, and write what you find in a message to the controller. If something differs in a way a task's quoted code depends on, stop and report rather than guess.

1. **Git.** `git --no-optional-locks log --oneline -3` shows the Supabase phases B and C merge (after `03afadd`), or later commits from other sessions. If the merge isn't committed yet (`git --no-optional-locks status --short` shows `UU` or staged `lib/data/store.ts`), stop and wait for the controller. For each later commit, `git --no-optional-locks show --stat <hash>` and note any file this plan edits. `git --no-optional-locks status --short` shows only the other sessions' files (at planning: `.claude/launch.json`, `app/globals.css`, `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md`, `tests/e2e/listing.spec.ts`, `tests/e2e/responsive.spec.ts`, and three untracked docs).
2. **The store.** `lib/data/store.ts` has `export const STORE_VERSION = 11;` (the Supabase phases B and C merge: `AuditRow.relatedId`). If another stage moved it, Task 5 adds one to whatever it is.
3. **The notes leak is closed already** (plan decision 1). `lib/data/mentors.ts`' `mentoredShops` has `if (profile.accountId === viewer.id) continue;` before its role check, and `lib/staff/mentor-actions.test.ts` has the describe "nobody writes about their own shop (staff tools amendment 15.3)". If either has gone, stop and report: Task 1 then needs the fix the spec describes, not only the pins.
4. **The admin actions.** `lib/staff/admin-actions.ts` exports `approveSeller`, `declineSeller`, `verifySeller`, `pauseSeller`, `resumeSeller`, `assignMentor`, `dismissReport`, `hideReportedListing`, `hideReportedRequest`, `pauseReportedShop`, `pinSeller`, `unpinSeller`, `addPoint`, `renamePoint`, `retirePoint`, `restorePoint`, `showListingAgain`, `showRequestAgain`, and has the private helpers `idFrom`, `staffOf`, `nothingChanged`, `tellOwner`, `tellReporter`, `backWithReason`.
5. **Looking For.** `lib/data/requests.ts`' `listedRequests()` takes no argument; `getOwnRequest(askerId, id)`, `listOwnRequests(askerId)` and `countOpenRequests(askerId)` take no clock; `setRequestOpen` returns `LookingForRequest | null`. `lib/looking-for/subjects.ts`' `offerStatus(subject, account)` returns `{ kind: "closed" }` when `request.status !== "open"`. `lib/looking-for/actions.test.ts` has the test "saves an edit that leaves a passed needed-by date as it is…" with `neededBy: "2026-10-10"` (plan decision 20).
6. **Playwright.** `playwright.config.ts` line 3 is `const PORT = 3200;`, and the last project is `hardening-writes`.
7. **The JS figures** (the ledger's Start row, from stage K at `16dab6a`): `/` and most pages 150,660 B, listing 151,816 B, browse 151,407 B, storefront 151,420 B, Saved 151,295 B, request and collection 151,136 B, the new and edit listing forms 152,334 B. Task 9 measures them again.

## Where things stand (checked against the code on 2026-10-20)

| Area | Fact |
|---|---|
| Repo | `main` at `03afadd` (stage L's spec), stages D to K built |
| Admin actions | Each checks `requireStaff("admin", path)` first (a forged post gets the 404), then its ids, then its reason; "Nothing changed" (`nothingChanged`) leaves the `nothing` notice and ends with `done(path)`. Nothing checks whose the target is. `approveSeller` and `declineSeller` take a hidden `owner` field, which only guards against a replaced shop (amendment 14.6) |
| Notices | `lib/staff/notices.ts`' map; the shop review page, the report page, `/admin/featured` and `/admin/hidden` show the notice (`takeNotice()`); the confirm pages (`/decline`, `/pause`, `/hide`, Show again's) pass `notice={null}` |
| Mentors | `mentoredShops` already leaves out the viewer's own shop for every role (amendment 15.3, `5af3548`), so `/mentor/{own}` is the 404, `addMentorNote` and `addCheckIn` reach `notFound()`, and the CSV leaves the row out; `setShopMentor` refuses the owner as mentor. `listMentors()` still lists the owner when they hold the mentor role |
| Reports | `getReport(id)` and `listReports()` build `ReportView` with `can.hide` and `can.pause`; `hideReportedListing`, `hideReportedRequest` and `pauseReportedShop` read `getReport` and refuse with `nothing` when `can` says no; `dismissReport` doesn't read the view |
| Featured | `featuredChoices()` returns `Seller[]` (7 call sites, tests included); `listPins(fromDay)` returns `PinView[]`; `removePin(id)` deletes before anyone can look at the pin |
| Requests | `RequestRow` has `closedAt` (null on the seeds), no `closedBy`; the 16 samples have `askerId: null`; `r-015` and `r-016` are seeded closed. `listedRequests()` filters `status === "open"` and not hidden. `getRequests({ campus, limit })` and `getOpenRequests({ category })` are `"use cache"`, tagged `requests`. The edit form keeps a passed needed-by date (amendment 19.6) |
| Request-time callers | `RequestBoard` and `LookingForRequests` read cookies inside `<Suspense>` but don't call `connection()`; `ViewerOffers` reads the session; `RequestForm` calls `connection()` after `getOwnRequest`; `Offer`, `YourRequests` and `DeleteRequest` read the session only |
| Sitemap | `app/sitemap.ts` is cached: it reads `getRequestIds()` and `getHubPostIds()`, every request and post with a page. Its unit test (`app/sitemap.test.ts`) expects closed requests and past events in it |
| Info pages | How it works has no Looking For section; its "Questions and answers" test expects six questions. The privacy page's "Your notifications" and "Your Looking For requests" items are in "Your account" |
| e2e | One `next start` per run; five device projects, then `selling-writes`, `staff-writes`, `community-writes`, `alerts-writes`, `staff-accounts-writes`, `hardening-writes`. `tests/e2e/helpers/messaging.ts`' `signInAsSample` and `signUp` wait for the header to hydrate (`settled()`, stage K's final run) |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. "Plan decision N" means this list; "spec 2.N" means the spec's decisions. The spec's open questions (section 10) have no answers yet: the plan builds the spec's choices, and Task 12 lists the questions as open points.

**Item 1: an admin's own shop.**

1. **The mentors' notes leak the spec describes (spec 2.5) is already closed at HEAD.** `5af3548` (staff tools amendment 15.3) made `mentoredShops` skip the viewer's own shop for every role, admins included, and `lib/data/mentors.test.ts`, `app/mentor/[slug]/page.test.tsx` and `lib/staff/mentor-actions.test.ts` test it. So `/mentor/{own}` is the 404, notes and check-ins about yourself reach `notFound()`, and the CSV leaves the row out. Task 1 adds two pinning tests for the spec's exact case (Sipho made an admin while Naledi mentors Tech corner; the CSV), which pass at HEAD, and builds the two parts still open: the mentor dropdown leaves out the owner (`listMentors(exceptOwnerId)`), and `assignMentor` refuses your own shop (Task 3).
2. **The ownership reads are synchronous**, as the spec's "plain functions" and as `pickupPointById` already is: each is one map lookup. `ownsTarget` returns the kind (`"shop" | "listing" | "request"`) or null, because the report page's words name it ("your own listing").
3. **The viewer arguments are optional, defaulting to null** on `getReport`, `getHidden`, `listHidden`, `listPins`, `featuredChoices` and `listMentors`. Null means "nobody's own". The pages pass `account.id`; the gate in the action is what keeps it safe. This leaves about 45 existing test calls (`getReport(id)` alone is called 27 times in `lib/data/staff-reports.test.ts`) as they are. **`listReports()` doesn't change** (spec 3 says it takes the viewer): the queue has no controls, only Review links, so it passes null.
4. **`featuredChoices` keeps returning `Seller[]`** (spec 3 says `{ choices, ownLeftOut }`). The Featured page reads `featuredChoices()` and `featuredChoices(account.id)` and compares their lengths for `ownLeftOut`, so the seven existing calls stand.
5. **Where a refusal lands:** the page that shows staff notices, which is where the form was or the page its confirm page came from: the shop's review page for the six seller actions (the decline and pause confirm pages show no notice), the report's page for the four report actions, `/admin/featured`, and `/admin/hidden`. An own listing gives the `own-shop` notice (it's a listing of your shop). The refusal comes before the reason is read, so no form state is written but the notice.
6. **The order in each action:** `requireStaff`, `now`, (Task 7: the two request actions settle), the id checks, the own gate, then the action as today. For the four report actions the gate reads `getReport(id, staff.id).own`, before `can.hide` or `can.pause` (which are false when `own` is set, so the gate must come first or it would say "Nothing changed"). `unpinSeller` reads the pin with a new `getPin(id)` before `removePin`.
7. **The only-admin link is a pill of its own** (spec 3 "Words" and "Accessibility" want "Staff" linked and 44px tall). A one-word link inside a sentence can't be 44px without new CSS, so the sentence stays as written and a link named "Staff" follows it on its own line with the existing `staff-row-action` class (44px). No prefetch.
8. **Shared view parts:** `components/staff/OwnShopLine.tsx` (the shop line, and the only-admin part) for the review page and its two confirm pages; `ownReportLine(kind)` exported from `components/staff/AdminReport.tsx` for the report page and its confirm pages. The report page also leaves out "Show it again" for an own hidden target. The hidden list's "Yours" is plain text in the cell.
9. **The review page keeps "See {shop}'s storefront"** for an own shop: it isn't a Hub decision.

**Item 2: old requests close themselves.**

10. **The rule's helpers** in `lib/looking-for/rules.ts`: `NEEDED_BY_GRACE_DAYS`, `IDLE_CLOSE_DAYS`, `closingDay`, `closeReasonOf`, `requestOpenOn` (it takes `{ status, closesOn }`), `closedAtFor`, and the type `CloseReason`.
11. **`settleRequests(now)` returns how many it closed** (`Promise<number>`), so a Server Action knows to call `requestsChanged()`. It sets `status`, `closedAt` and `closedBy` by plain assignment in one loop, then awaits the notifications.
12. **The asker's reads take a required `now`** and settle first: `getOwnRequest(askerId, id, now)`, `listOwnRequests(askerId, now)`, `countOpenRequests(askerId, now)`. Seven components then read the clock after `connection()`: the five the spec names (`RequestBoard`, `LookingForRequests`, `ViewerOffers`, `Offer`, `YourRequests`) and two it doesn't, which call `getOwnRequest` too: `RequestForm` (its `connection()` moves above `getOwnRequest`) and `DeleteRequest` (gains one). All seven already render inside `<Suspense>` and per request.
13. **`OwnRequest` gains four fields:** `closedAt`, `closedAutomatically`, `closeReason` (spec 3) and `neededByPassed`, worked out against the read's `today`, for the reopen hint.
14. **`setRequestOpen` returns `(LookingForRequest & { neededByCleared: boolean }) | null`,** so the existing `toMatchObject({ status: "closed" })` tests stand and Reopen knows which notice to leave.
15. **`offerStatus(subject, account, today)`** gains a third argument and tests `requestOpenOn(subject.request, today)`; `offerSubject` doesn't change (its result type is built by `OfferView.test.tsx`).
16. **The Looking For actions settle through one private helper,** `settle(now)` in `lib/looking-for/actions.ts`, which calls `requestsChanged()` when anything closed, first thing after the session in all six actions (post and edit, close, reopen, delete, offer). The two staff request actions do the same inline.
17. **No `listedRequestIds` in `lib/data/requests.ts`** (spec 3 lists one): `getListedRequestIds({ today })` in `lib/data/index.ts` maps `listedRequests(today)`.
18. **The closed request's edit page** (`RequestLocked`, which has its own Reopen) gets the reopen hint too: the same button with the same consequence. Spec 3 doesn't list it.
19. **Test churn is mechanical and listed per file.** The readers that gain `now` or `today` are called from about 40 test lines; the tasks give one `perl` command per file and a `grep` that proves it. Tests that render the Looking For components with a posted request get a fixed clock and a `next/server` stand-in: on the real clock, their requests (posted on 14 October 2026) would close themselves from mid-November.
20. **One existing test's date moves.** `lib/looking-for/actions.test.ts`' "saves an edit that leaves a passed needed-by date as it is" posts a request needed by 10 October at `STAFF_NOW` (14 October). Its closing day is the 14th, so the edit would now find it closed. Its date becomes 12 October (closing day the 16th): still passed, still open, and the test still pins amendment 19.6.
21. **The seeds:** `data/fixtures/requests.ts`' builder sets `closesOn: null` (they never close themselves), and `data/fixtures/request-rows.ts` sets `closedBy: null`. Spec 3 doesn't list the fixtures.
22. **`STORE_VERSION` 11 → 12** for `closedBy` (spec 3 says 10 to 11; the Supabase merge took 11 first).
23. **How it works' sentence** goes in the answer to "What can I do on Vossie today?", as a paragraph of its own: the page has no Looking For section, and its test's six questions stay six.
24. **The privacy policy's words** go where spec 4 says: "your request closes automatically" after "the Hub acts on your report, your shop, your listing or your request," in "Your notifications", and the new sentence at the end of "Your Looking For requests". Both pages' `updated` become the day Task 9 is built, if it isn't 2026-10-20 (SAST).

**Item 5: the sitemap.**

25. **`app/sitemap.ts` calls `await connection()`, then `sastToday()`,** and reads `getListedRequestIds({ today })` and `getListedHubPostIds({ today })`. The existing unit test "lists every Looking For request and Hub post, closed requests and past events included" is replaced by spec 5's.

**End to end, records, how to run.**

26. **`tests/e2e/housekeeping-writes.spec.ts`** in a new project `housekeeping-writes` (desktop 1440), after `hardening-writes`, ignored by the five device projects. Three tests:
    - the own shop (spec 3 "Tests"): Pieter gives Sipho the Admin role; Sipho's review page shows the line and no controls (axe at 1440 and 390); a forged `verifySeller` post lands with the `own-shop` notice and changes nothing; `/mentor/tech-corner` is the 404 for Sipho; Pieter still has every control; Pieter takes the role away in a `finally`. **The forged post's fields come from Pieter's page drawn without JavaScript**: Sipho's page has no verify form to copy, and a Server Action post needs its `$ACTION_ID_…` field. Verified's state is compared on Pieter's review page (its standing line), which says it in words;
    - the closing dates (spec 4 "Tests"): a fresh account posts a request needed by today plus 7 and one with no date; Your requests says "Closes automatically on" today plus 11 and plus 30, worked out in SAST in the test; the board still shows a sample request;
    - the sitemap (spec 5 "Tests"), read-only.
27. **Builds and e2e run in a scratch copy on port 3204,** as stage K's final run did: `pnpm build`, then your own `pnpm start --port 3204` (note its PID), then `E2E_REUSE_SERVER=1 pnpm e2e … --workers=2`, then `kill <pid>`.
28. **Records:** the plan's ledger and changes, the spec's "Changes on plan review and build" (section 11), CLAUDE.md, GO-LIVE.md, and the snippets `l-progress.md` and `l-decision.md` (decision row **80**) in the scratchpad `/private/tmp/claude-501/-Users-LamaNkuna-Projects-Vossie/27a3bf01-5279-40ef-b17d-be68f2ee9fa1/scratchpad/`. The controller merges `docs/PROGRESS.md` and `docs/reference/LANDING-DECISIONS.md`.

## Amendments on review

Reviewed 2026-10-20 (opus, read-only); all accepted by the controller. They override the tasks below wherever they differ.

1. **"Before you start", Recheck 1 and the ledger: the merge has landed.** The Supabase phases B and C merge is committed (`8644023`) and this plan is `a0d3b1f`; Recheck 1 expects those two commits, not `UU`. In the ledger, "Unit tests at the start: 2,559 (the merge `8644023`)".

2. **Task 6 (Steps 2 and 8): `tests/helpers/viewer-offers.tsx`.** It renders `<PublicOffers request={request} signedIn={false} />`; once `open` is required, typecheck fails, and at runtime `open` is undefined, so it says "This request is closed" and `components/looking-for/RequestView.test.tsx` ("Offer to help", line 80) fails. Add the file to Task 6's list, with:

   ```tsx
   ViewerOffers: ({ request }: { request: LookingForRequest }) => (
     <PublicOffers request={request} signedIn={false} open={request.status === "open"} />
   ),
   ```

3. **Task 4: `components/forms/summary-ids.test.tsx`.** It renders `<SellerConfirm …/>` twice (lines 251 and 252) and `<AdminFeatured …/>` (line 256) without the new required props, so Step 8's `pnpm typecheck` fails. Add the file to Task 4's list: `own={false} onlyAdmin={false}` after `review={crochet}` and after `review={tech}`, and `ownLeftOut={false}` after its `choices=…`.

4. **Task 7 Step 4 and plan decision 6: the two request staff actions settle after the own gate.** Settling first lets a refused post close other due requests, notify their askers and expire `requests` (and in `hideReportedRequest`, close the admin's own due request and notify them) before refusing; spec 2.3 says a refusal writes nothing. Place the settle lines:
   - **`hideReportedRequest`**: right after `if (id && view?.own) return refuseOwn(view.own, adminReportPath(id), now);` (`view.can.hide` doesn't depend on open or closed, so reading `view` first is safe);
   - **`showRequestAgain`**: right after `if (id && isOwnRequest(staff.id, id)) return refuseOwn("request", ADMIN_HIDDEN_PATH, now);`.

   Decision 6's order becomes: `requireStaff`, `now`, the id checks, the own gate, (the two request actions: settle), then the action. Add to Task 7's describe "the two request actions settle first" in `lib/staff/admin-actions.test.ts`:

   ```ts
   it("a refused post settles nothing (stage L spec decision 3)", async () => {
     const due = await dueRequest();
     sampleStore().accounts.get("acc-seller")!.roles = ["admin"];
     const id = (await createRequest({ askerId: "acc-seller", fields: SIPHOS_FIELDS, now: STAFF_NOW })).id;
     const reportId = await report("acc-student", { kind: "request", id }, SIPHOS_FIELDS.title);
     await signedInAs(request, "acc-seller");
     await redirectOf(() => hideReportedRequest(form({ report: reportId, reason: REASON })));
     expect(sampleStore().requests.get(due.id)?.status).toBe("open");
     expect(request.updatedTags).toEqual([]);
   });
   ```

5. **Task 11, test 1: the role grant is safe to retry and always undone.** `giveRole` sits outside the `try`, so a notice timeout after the role was given skips the `finally`; a reused server (`E2E_REUSE_SERVER=1`) left with Sipho as admin by an interrupted run makes `giveRole` fail; and the `plain` and Pieter's contexts close only on the happy path. Replace the opening with:

   ```ts
   const pieter = await signedInPage(browser, baseURL!, "Admin", "/admin/staff");
   let plain: BrowserContext | null = null;
   try {
     // An interrupted earlier run on the same server may have left Sipho an admin: start clean.
     await removeSiphosAdminRole(pieter);
     await giveRole(pieter, "seller@eduvos.com", "Admin");
     plain = await browser.newContext({ baseURL, serviceWorkers: "block" });
     // … the rest of the test as written, from plain.route(…) on …
   ```

   and the end with:

   ```ts
   } finally {
     await plain?.close().catch(() => {});
     await removeSiphosAdminRole(pieter).finally(() => pieter.context().close());
   }
   ```

   Drop the in-body `await plain.close();`, and import `type BrowserContext` from `@playwright/test`. The progress snippet adds: "If a run is killed mid-test, restart the e2e server (the store is in memory) before rerunning the device projects."

6. **Task 5 Step 2: year-edge cases.** Add to the describe "when a request closes itself" in `lib/looking-for/rules.test.ts`:

   ```ts
   it("crosses the year in South African dates", () => {
     expect(closingDay({ ...ROW, neededBy: "2026-12-30" })).toBe("2027-01-03");
     expect(closingDay({ ...ROW, updatedAt: "2026-12-15T22:30:00.000Z" })).toBe("2027-01-15");
     expect(closedAtFor("2027-01-01")).toBe("2026-12-31T22:00:00.000Z");
   });
   ```

7. **Task 12 Step 5 (GO-LIVE): the Supabase functions need the same rule.** After the `requests.closed_by` line, add: "`set_request_open` clears a needed_by that has passed and sets `closed_by`; `start_offer` refuses on or after the closing day; `save_request`'s 5-open count leaves out due requests (stage L spec decisions 13 and 14)."

8. **Task 12 Step 7 (`l-progress.md` open points): two more.**
   - Removing the mentor role from whoever mentors an admin's own shop un-assigns that shop's mentor (`removeStaffRole`), the effect `assignMentor` now refuses. Spec 2.1 leaves roles alone; Lama may want it refused or only noted.
   - A request whose closing day passed while it was hidden closes at the next look after Show again, with `closedAt` at that old closing day, so "Closed automatically on {date}" can predate the "shown again" notice (cosmetic; spec 2.16).

9. **Task 6: the data download settles first.** `exportAccountData(accountId, now)` (`lib/data/accounts.ts`) doesn't settle, so a due, unsettled request exports as open with `closedAutomatically: false`. Add `lib/data/accounts.ts` and `lib/data/accounts.test.ts` to Task 6's files:
   - in `lib/data/accounts.ts`, add `settleRequests` to the import from `./requests` (sorted), and right after `const conversations = await exportConversations(accountId, now);` add:

     ```ts
     // Old requests close themselves first (stage L spec decision 11), so the download says which did, and the asker's
     // notification about it is in the notifications read next. Before exportRequests.
     await settleRequests(now);
     ```

   - in `lib/data/accounts.test.ts`, inside the describe that declares `FIELDS` (the requests and follows export), after the test "exports the account's requests and the names of the shops it follows, with no ids", add:

     ```ts
     it("settles first: a due request nothing has settled exports as closed automatically (stage L amendment 9)", async () => {
       await createRequest({
         askerId: "acc-student",
         fields: { ...FIELDS, neededBy: "2026-10-09" },
         now: new Date("2026-10-05T08:00:00.000Z"),
       });
       const data = await exportAccountData("acc-student", NOW);
       expect(data?.requests).toMatchObject([{ state: "closed", closedAutomatically: true }]);
     });
     ```

     (Needed by 9 October, so its closing day is the 13th, the day before `NOW`.)

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec section 1):** **no page moves by a byte.** Every changed component is a Server Component, and no client component, `"use client"` file or CSS changes. If any figure differs from the Start row, stop after that task and find out why before going on. The listing forms stay at 152,334 B, 29 B past the 152,305 B stop line that Lama accepted as decision 78.
- **Where bytes could move:** nowhere, by design. HTML changes (a line of text, a `<time>`, a removed form) cost no JavaScript. The request page's session part and the homepage's request section call `connection()`, which moves nothing out of the static shell (both already render per request).
- **Recording.** In the scratch copy, `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` prints each page's `scriptBrotli`. Task 9 runs it after item 2, Task 10 after the sitemap, and the controller at Task 12.

**As built** (fill in during the build):

| Point | `/` and most pages | Listing | Browse | Storefront | Saved | Request and collection | New and edit listing forms |
|---|---|---|---|---|---|---|---|
| Start (stage K at `16dab6a`) | 150,660 | 151,816 | 151,407 | 151,420 | 151,295 | 151,136 | 152,334 |
| Task 9, item 2 built | 150,660 | 151,816 | 151,407 | 151,420 | 151,295 | 151,136 | 152,334 |
| Task 10, the sitemap | 150,660 | 151,816 | 151,407 | 151,420 | 151,295 | 151,136 | 152,334 |
| **Final (Task 12)** | 150,660 | 151,816 | 151,407 | 151,420 | 151,295 | 151,136 | 152,334 (the controller confirms with `performance.spec.ts` in the final run) |

The stop line used: 152,305 B (decision 52; the forms' 152,334 B accepted as decision 78). Unit tests at the start: 2,559 (the merge `8644023`). End to end at the start: stage K's final run (devices 1,248 passed; write projects 62 passed). Unit tests at the end: 2,654 (the quiet 2-worker count at `a1da11c`; Task 11 and these docs add none). End to end at the end: the device projects at 2 workers on `83a5458`: 1,251 passed, 1,210 skipped by design, and the same 4 failures that predate stage L (the header and tab bar's `a11y.spec.ts:343` at 360, `responsive.spec.ts:26` at 360 and 390, `listing.spec.ts:34` at 390; the header session has them). The seven write projects with `--no-deps` on a fresh server at `1f55ee5`: 65 passed, 1 skipped. Run on the same server straight after the 17-minute device run, five write tests saw stale pages after a write (a resumed listing missing from browse, a deleted request's page still served, a new office-hours link missing); they all pass on a fresh server.

## Changes made during the build

- **Review fix (`1f55ee5`).** The code review found that an admin could dismiss reports about their own listing or request once they had deleted it, because `own` was worked out only while the target existed. A report now records who owned its target when it is made (`targetOwnerId`, `STORE_VERSION` 13), and `own` falls back to it when the target has gone; deleting an account clears its id from every report (POPIA), and the reports stay for the Hub. The review's test gaps were closed too: a refused Show again settles nothing (mutation-checked), the closing day's last second and first second, a visible-only locator, and Sipho's context closed in the finally. Unit: 2,661.

Written in Task 12 from `git log` and the code. Where an entry differs from the tasks below, the entry wins.

**Commits** (`git log --oneline a0d3b1f..HEAD`; the controller committed each task):

| Task | Commit | What |
|---|---|---|
| Amendments | `63517cd` | Amendments 1 to 9 on review |
| 1 | `999e385` | `isOwnShop`, `isOwnListing`, `isOwnRequest`, `ownsTarget`, `listMentors(exceptOwnerId)`; two tests pinning the mentors' notes |
| 2 | `ac100b1` | The staff views' data say whose it is (`own`, `getPin`, `featuredChoices(viewerId)`) |
| 3 | `726b973` | The gate in the admin actions |
| 4 | `d5c1032` | The staff pages say why in place of the controls |
| 5 | `e6dd279` | The closing rule, the row (`closedBy`, `STORE_VERSION` 12) and the words |
| 6 | `a39f170` | Settling, the dated readers and their callers |
| 7 | `7182a7c` | The Looking For and request staff actions settle, refuse and reopen |
| 8 | `7bc9d20` | The asker's lines, the reopen hint and the form's hint |
| 9 | `46389d4` | The info pages, then the build and size check |
| 10 | `a1da11c` | The sitemap lists only what's worth crawling today |
| 11 | `83a5458` | End to end: an admin's own shop, the closing dates, the sitemap |
| 12 | (this commit) | Docs |

**Where the build differed from the plan:**

1. **The spec's mentors'-notes leak claim was wrong.** `5af3548` (staff tools amendment 15.3) had already closed it; Task 1 pins it with two tests and builds the dropdown and `assignMentor` parts (plan decision 1).
2. **The full-suite unit counts varied under heavy load.** Worker start-up failures dropped whole files from the count. The quiet 2-worker counts were 2,622 (Task 6), 2,651 (Task 9) and 2,654 (Task 10). Every test that failed under load passed alone.
3. **Task 11's `removeSiphosAdminRole` waits for the streamed staff table** before it looks for Sipho's row, and asserts the link is gone afterwards, so a retry after an interrupted run starts clean (amendment 5, tightened in the build).
4. **The sitemap is dynamic** (`ƒ /sitemap.xml`): it calls `connection()`, then `sastToday()`, so it renders per fetch (plan decision 25).
5. **JS:** every public page is unchanged from stage K at `16dab6a` (the ledger's rows). No client component, CSS or cookie changed.
6. **Amendments 2, 3, 4, 6 and 9 were built as written** (the two missed files, the settle after the own gate, the year-edge tests, the data download settling first). Amendment 8's two open points are in the progress snippet.
7. **End to end:** the device projects at 2 workers on `83a5458`: 1,251 passed, 1,210 skipped by design, and the same 4 failures that predate stage L (the header and tab bar's `a11y.spec.ts:343` at 360, `responsive.spec.ts:26` at 360 and 390, `listing.spec.ts:34` at 390; the header session has them). The seven write projects with `--no-deps` on a fresh server at `1f55ee5`: 65 passed, 1 skipped. Run on the same server straight after the 17-minute device run, five write tests saw stale pages after a write (a resumed listing missing from browse, a deleted request's page still served, a new office-hours link missing); they all pass on a fresh server. Task 11's own run was 3 passed, and again twice on the same server; `hardening-writes` and `staff-accounts-writes` 31 passed.
8. **Checkboxes** for Tasks 1 to 11 are ticked from the commits above, not from a re-run of each step; Task 12's Steps 8 and 9 are the controller's.

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there unless a step says to run them in the scratch copy (`$S`).
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, comments in plain English. No formatter: match the file you're in.
- **Server or client.** This plan adds **no** client component and changes none. `lib/staff/admin-actions.ts` and `lib/looking-for/actions.ts` start with `"use server"`: everything they export must be an async function, and nothing helper-like is exported from them (the new `refuseOwn` and `settle` are private). New `lib/` modules have no directive.
- **Next APIs.** Read the page in `node_modules/next/dist/docs/01-app/` before using an API ("Sources"). The first task that uses one says so in its first step.
- **Clock and randomness.** No `Date.now()`, `new Date()`, `Math.random()` or `crypto.random*` while prerendering. A component reads the clock only after `await connection()`, inside the `<Suspense>` it already renders in. Data functions take `now` or `today` from their caller. `new Date(iso)` on stored data reads no clock and is fine anywhere.
- **No write inside `"use cache"`.** `settleRequests` is never called from a cached function.
- **Server Actions.** Identity only from the session (`requireAccount`, `requireStaff`). A refusal goes back with `done()` or `RedirectType.replace`; every write ends with `done()`.
- **Forms.** Every form works without the app's JavaScript. Removed controls are removed, never disabled (spec 2.4).
- **Links.** Links into staff pages never prefetch (`prefetch={false}`).
- **JSX text.** `react/no-unescaped-entities` is on: `&apos;` for an apostrophe in JSX text (a string in braces needs none).
- **Server code in tests.** `tests/helpers/next-request.ts` (`nextHeaders`, `nextNavigation`, `nextServer`, `nextCache`, `redirectOf`, `redirectSignalOf`, `resetRequest`) and `tests/helpers/staff.ts` (`STAFF_NOW`, `signedInAs`, `form`); `resetSampleStore()` and `resetRequest(request)` in `beforeEach`; fake only the date (`vi.useFakeTimers({ toFake: ["Date"] })`). A component test that renders something that calls `connection()` mocks it: `vi.mock("next/server", () => ({ connection: async () => undefined }));`.
- **TDD.** Write the test, watch it fail, write the code, watch it pass. A test that pins behaviour already at HEAD says so and passes at once.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git --no-optional-locks status --short` on its own, and checks that the listed files changed and nothing else of this stage's did;
  2. runs `git add` with the listed files, by name;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.

### The scratch copy (builds, `pnpm start`, e2e, the whole unit suite, lint and typecheck)

Other sessions share the working tree, so nothing builds or starts there. Every task that builds makes a fresh copy of the committed code, adds its own changed files, and works in that:

```bash
# 1. A new, empty folder in your scratchpad (never reuse or delete one). <N> is the task's number.
S="<your scratchpad>/vossie-l-task<N>"
mkdir "$S"
# 2. The committed code (read-only git), then node_modules as an APFS clone.
git -C /Users/LamaNkuna/Projects/Vossie --no-optional-locks archive HEAD | tar -x -C "$S"
cp -cR /Users/LamaNkuna/Projects/Vossie/node_modules "$S/node_modules"
# 3. This stage's changed and new files that aren't committed yet, one line each, quoted. Never the other sessions'
#    files. For example:
mkdir -p "$S/lib/staff" && cp "lib/staff/own.ts" "$S/lib/staff/own.ts"
# 4. The e2e server's port.
sed -i '' 's/^const PORT = 3200;$/const PORT = 3204;/' "$S/playwright.config.ts"
grep -n "^const PORT" "$S/playwright.config.ts"
```

Expected from the last command: `3:const PORT = 3204;`.

**To show red** for a task whose test needs the old code: make the copy at HEAD, copy in **only the new or changed test file**, and run it there. Never move, rename or stash files in the real repo to see a test fail.

**To run e2e** (plan decision 27), from `$S`:

```bash
lsof -ti tcp:3204          # must print nothing; if it prints a PID that isn't yours, stop and report
pnpm build
pnpm start --port 3204 > "$S/server.log" 2>&1 &
echo $!                    # note this PID: it's yours
# wait until the server answers
until curl -s -o /dev/null http://localhost:3204/; do sleep 2; done
E2E_REUSE_SERVER=1 pnpm e2e <files> <projects> --workers=2
kill <your PID>
```

`pnpm test`, `pnpm lint` and `pnpm typecheck` also run from `$S`. A `pnpm start` you start yourself is yours: stop it with `kill <pid>` when you're done. Never `pkill` or `killall`.

## File map (end of this plan)

New files are marked **+**, changed **~**.

```
lib/
  data/staff-shops.ts (+ test)                       ~ isOwnShop, isOwnListing, isOwnRequest, listMentors(except) (Task 1)
  staff/own.ts (+ test)                              + ownsTarget (Task 1)
  data/staff-reports.ts (+ test)                     ~ ReportView.own, HiddenItem.own (Task 2)
  data/featured.ts (+ test)                          ~ featuredChoices(viewer), getPin, PinView.own (Task 2)
  data/mentors.test.ts                               ~ the spec's case pinned (Task 1)
  staff/admin-actions.ts (+ test)                    ~ the own gate (Task 3); the request actions settle (Task 7)
  staff/notices.ts (+ test)                          ~ own-shop, own-request (Task 3)
  looking-for/rules.ts (+ test)                      ~ closingDay, requestOpenOn, closedAtFor… (Task 5)
  looking-for/words.ts (+ test)                      ~ the closing words, the reopen notice (Task 5)
  data/rows.ts  data/store.ts  types.ts              ~ closedBy, STORE_VERSION 12, closesOn (Task 5), OwnRequest (Task 6)
  data/requests.ts (+ test)                          ~ closesOn (Task 5); settleRequests, dated reads (Task 6)
  data/index.ts (+ test)                             ~ today on the request readers, getListedRequestIds (Task 6),
                                                       getListedHubPostIds (Task 10)
  looking-for/subjects.ts (+ test)                   ~ offerStatus(…, today) (Task 6)
  looking-for/actions.ts (+ test)                    ~ now passed (Task 6); settle, the reopen notice (Task 7)
  data/messages.test.ts                              ~ getOwnRequest(…, NOW) (Task 6)
data/fixtures/
  requests.ts  request-rows.ts (+ test)              ~ closesOn and closedBy null (Task 5)
components/
  staff/OwnShopLine.tsx                              + (Task 4)
  staff/AdminSeller.tsx  SellerConfirm.tsx  AdminReport.tsx  ReportConfirm.tsx  AdminHidden.tsx
  ShowAgainConfirm.tsx  AdminFeatured.tsx (+ tests)  ~ the lines in place of controls (Task 4)
  looking-for/RequestBoard.tsx  ViewerOffers.tsx  Offer.tsx  YourRequests.tsx  RequestForm.tsx  DeleteRequest.tsx
  OffersViews.tsx  OffersPanel.tsx (+ tests)         ~ connection(), settle, today (Task 6)
  home/LookingForRequests.tsx (+ test)               ~ connection(), settle, today (Task 6)
  looking-for/AutoCloseLine.tsx                      + (Task 8)
  looking-for/YourRequestsView.tsx  RequestActions.tsx  RequestFormView.tsx (+ tests)  ~ the lines and hints (Task 8)
app/
  admin/sellers/[slug]/page.tsx  decline/page.tsx  pause/page.tsx
  admin/reports/[id]/page.tsx  hide/page.tsx  pause/page.tsx
  admin/hidden/page.tsx  hidden/listings/[id]/page.tsx  hidden/requests/[id]/page.tsx
  admin/featured/page.tsx                            ~ pass the viewer (Task 4)
  mentor/export/route.test.ts                        ~ the CSV pinned (Task 1)
  privacy/page.tsx  how-it-works/page.tsx (+ tests)  ~ words (Task 9)
  sitemap.ts (+ test)                                ~ request-time, dated readers (Task 10)
playwright.config.ts                                 ~ housekeeping-writes (Task 11)
tests/e2e/housekeeping-writes.spec.ts                + (Task 11)
CLAUDE.md  docs/reference/GO-LIVE.md  the spec  this plan  ~ (Task 12)
```

**Tasks that touch the same files:** Tasks 3 and 7 (`lib/staff/admin-actions.ts` and its test), Tasks 5 and 6 (`lib/data/requests.ts`, `lib/types.ts`), Tasks 6 and 7 (`lib/looking-for/actions.ts` and its test), Tasks 6 and 10 (`lib/data/index.ts` and its test), Tasks 6 and 8 (`components/looking-for/OffersViews.tsx`, `OffersPanel.test.tsx`, `YourRequestsView.test.tsx`, `RequestForm.tsx`). Run them in order.

**Suggested pairs for implementers:** Tasks 1 and 2; Task 3 alone; Task 4 alone; Task 5 alone; Task 6 alone; Tasks 7 and 8; Task 9 alone; Task 10 alone; Task 11 alone; Task 12 alone.

## Where each spec decision is built

| Spec | Built in |
|---|---|
| 2.1 One rule: no Hub decision about your own | Task 3 (the gate), Task 4 (the views) |
| 2.2 "Own" read from the store; three functions and `ownsTarget` | Task 1 (plan decision 2) |
| 2.3 The gate is in the action; the notice; `done(path)` | Task 3 (plan decisions 5 and 6) |
| 2.4 The views hide the controls and say why | Task 4 (plan decisions 7 to 9) |
| 2.5 Mentors | Already at HEAD, pinned in Task 1 (plan decision 1); the dropdown (Task 1, Task 4's page); `assignMentor` (Task 3) |
| 2.6 The only admin isn't exempt | Task 4 (`onlyAdmin`, plan decision 7) |
| 2.7 The audit log is unchanged | Task 3 (no entry on refusal) |
| 2.8 The rule and the numbers | Task 5 (plan decision 10) |
| 2.9 The samples never close themselves | Task 5 (`closingDay` null), Task 6 |
| 2.10 A pure function; `closesOn`; dated readers | Task 5, Task 6 (plan decisions 12 and 17) |
| 2.11 The close is stored on the first look | Task 6 (`settleRequests`, the callers), Task 7 (the actions; plan decision 16) |
| 2.12 The asker is told once | Task 6 |
| 2.13 Reopen; a passed needed-by date is removed | Task 6 (`setRequestOpen`), Task 7 (the notice), Task 8 (the hint) |
| 2.14 Where an auto-closed request shows | Task 6 (board, homepage, `offerStatus`, `PublicOffers`), Task 8 (the lines), Task 10 (sitemap) |
| 2.15 Cache tags; the one lag | Task 6 (`PublicOffers`' `open`), Task 7 (`requestsChanged()` in actions) |
| 2.16 A hidden request isn't settled | Task 6 |
| 2.17 Item 3 dropped | Nothing to build; Task 12 records it |
| 2.18 Item 4 nothing to build | Nothing to build; Task 12 records it |
| 2.19 The sitemap | Task 10 (plan decision 25) |
| 2.20 Item 6 no change | Task 12 (GO-LIVE section 7) |
| 3 "Tests", end to end | Task 11 |
| 4 "Words" (info pages) | Task 9 (plan decisions 23 and 24) |
| 4 "Tests", end to end | Task 11 |
| 5 "Tests", end to end; the build check | Task 11; Tasks 9 and 10 |
| 6 Files, CLAUDE.md | Task 12 |
| 8 Go-live changes | Task 12 |
| 10 Open questions | Task 12 (open points for Lama) |

---

### Task 1: Ownership in the data layer, and the mentors' notes pinned

Spec 2.2 and 2.5 with plan decisions 1 and 2. Data only: no action or view changes yet.

**Files:**
- Modify: `lib/data/staff-shops.ts`, `lib/data/staff-shops.test.ts`
- Create: `lib/staff/own.ts`, `lib/staff/own.test.ts`
- Modify: `lib/data/mentors.test.ts`, `app/mentor/export/route.test.ts`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short lib/data/staff-shops.ts lib/data/staff-shops.test.ts lib/data/mentors.test.ts app/mentor/export/route.test.ts lib/staff`
Expected: no output.

- [x] **Step 2: The tests**

In `lib/data/staff-shops.test.ts`, add `isOwnListing`, `isOwnRequest` and `isOwnShop` to the import from `./staff-shops` (keep it sorted), add `import { createRequest } from "./requests";` after the `./catalog` import, and add at the end of the file:

```ts
describe("whose it is (stage L spec decision 2)", () => {
  it("knows a shop's owner now, a waiting shop's too; a sample shop no account owns is nobody's", () => {
    expect(isOwnShop("acc-seller", "tech-corner")).toBe(true);
    expect(isOwnShop("acc-admin", "tech-corner")).toBe(false);
    expect(isOwnShop("acc-pending", "crochet-corner")).toBe(true);
    expect(isOwnShop("acc-admin", "hair-studio")).toBe(false);
    expect(isOwnShop("acc-seller", "no-such-shop")).toBe(false);
  });

  it("reads the store when it's asked, never a form: a shop that changes hands changes owner", () => {
    sampleStore().sellers.get("tech-corner")!.ownerId = "acc-student";
    expect(isOwnShop("acc-seller", "tech-corner")).toBe(false);
    expect(isOwnShop("acc-student", "tech-corner")).toBe(true);
  });

  it("knows a listing by its shop's owner", () => {
    expect(isOwnListing("acc-seller", "l-001")).toBe(true);
    expect(isOwnListing("acc-admin", "l-001")).toBe(false);
    expect(isOwnListing("acc-seller", "l-nope")).toBe(false);
  });

  it("knows a request by its asker; a sample request has none, so it's nobody's", async () => {
    const { id } = await createRequest({
      askerId: "acc-seller",
      fields: {
        title: "Desk lamp for res",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: 150,
        swapWelcome: false,
        neededBy: null,
      },
      now: NOW,
    });
    expect(isOwnRequest("acc-seller", id)).toBe(true);
    expect(isOwnRequest("acc-admin", id)).toBe(false);
    expect(isOwnRequest("acc-seller", "r-001")).toBe(false);
    expect(isOwnRequest("acc-seller", "r-nope")).toBe(false);
  });
});

describe("the mentor choice leaves out the shop's owner (stage L spec decision 5)", () => {
  it("lists every mentor but the owner it's told to leave out", async () => {
    sampleStore().accounts.get("acc-seller")!.roles.push("mentor");
    expect(await listMentors("acc-seller")).toEqual([{ id: "acc-mentor", firstName: "Naledi" }]);
    expect(await listMentors(null)).toContainEqual({ id: "acc-seller", firstName: "Sipho" });
    expect(await listMentors()).toContainEqual({ id: "acc-seller", firstName: "Sipho" });
  });
});
```

Create `lib/staff/own.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { ownsTarget } from "./own";

beforeEach(() => {
  resetSampleStore();
});

describe("whose a report's target is (stage L spec decisions 1 and 2)", () => {
  it("names what's the admin's own: their shop, a listing of it, their request; nothing else", async () => {
    const { id } = await createRequest({
      askerId: "acc-seller",
      fields: {
        title: "Desk lamp for res",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: null,
        swapWelcome: false,
        neededBy: null,
      },
      now: new Date("2026-10-14T08:42:00.000Z"),
    });
    expect(ownsTarget("acc-seller", { kind: "seller", id: "tech-corner" })).toBe("shop");
    expect(ownsTarget("acc-seller", { kind: "listing", id: "l-001" })).toBe("listing");
    expect(ownsTarget("acc-seller", { kind: "request", id })).toBe("request");
    expect(ownsTarget("acc-admin", { kind: "seller", id: "tech-corner" })).toBeNull();
    expect(ownsTarget("acc-admin", { kind: "listing", id: "l-001" })).toBeNull();
    expect(ownsTarget("acc-admin", { kind: "request", id })).toBeNull();
    // A sample shop and a sample request are nobody's.
    expect(ownsTarget("acc-seller", { kind: "seller", id: "hair-studio" })).toBeNull();
    expect(ownsTarget("acc-seller", { kind: "request", id: "r-001" })).toBeNull();
  });
});
```

In `lib/data/mentors.test.ts`, inside the describe "the mentor dashboard (staff tools spec 2.6, plan decision 15)", after the test "leaves out the viewer's own shop, whatever their role (amendment 15.3)", add (it **passes at HEAD**: it pins amendment 15.3 for the spec's exact case, plan decision 1):

```ts
  it("hides Tech corner from Sipho made an admin while Naledi mentors it: the case stage L's spec found (decision 5)", async () => {
    const sipho = { id: "acc-seller", roles: ["admin"] as const };
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
    expect(await mentoredShops(sipho, NOW)).toEqual([]);
    expect(await getMentoredShop("tech-corner", sipho, NOW)).toBeNull();
    expect((await mentoredShops(pieter, NOW)).map((row) => row.slug)).toEqual(["tech-corner"]);
  });
```

In `app/mentor/export/route.test.ts`, change `import { resetSampleStore } from "@/lib/data/store";` to `import { resetSampleStore, sampleStore } from "@/lib/data/store";`, and add inside the describe, after its last test (it **passes at HEAD**, plan decision 1):

```ts
  it("leaves the viewer's own shop out of the file, for an admin too: nobody reads about themselves (stage L spec 2.5)", async () => {
    sampleStore().accounts.get("acc-seller")!.roles = ["admin"];
    await signedInAs(request, "acc-seller");
    const body = new TextDecoder("utf-8").decode(await (await GET()).arrayBuffer());
    expect(body).toContain('"Shop","Campus"');
    expect(body).not.toContain("Tech corner");
  });
```

Run: `pnpm test lib/data/staff-shops.test.ts lib/staff/own.test.ts lib/data/mentors.test.ts app/mentor/export/route.test.ts`
Expected: FAIL in `staff-shops.test.ts` (the three `isOwn…` functions don't exist; `listMentors("acc-seller")` still lists Sipho) and `own.test.ts` (no `./own`). The mentors and CSV tests pass.

- [x] **Step 3: The three reads, and the mentor choice**

In `lib/data/staff-shops.ts`, replace the `listMentors` function and its comment with:

```ts
/**
 * The accounts with the mentor role, by first name, for the seller page's choice (plan decision 15), leaving out
 * `exceptOwnerId`: a shop's owner can't be its mentor (amendment 15.3), so the choice never offers them (stage L spec
 * decision 5). Null leaves nobody out.
 */
export async function listMentors(exceptOwnerId: string | null = null): Promise<{ id: string; firstName: string }[]> {
  return [...sampleStore().accounts.values()]
    .filter((row) => row.roles.includes("mentor") && row.id !== exceptOwnerId)
    .map((row) => ({ id: row.id, firstName: row.firstName }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
}
```

and add at the end of the file:

```ts
// --- Whose it is (stage L spec decision 2) ------------------------------------------------------------------------

/**
 * Whether `accountId` owns the shop on this link now, read from the store at the moment of asking, never from a form
 * (stage L spec decision 2). A waiting shop's row names its owner too; a sample shop no account owns is nobody's.
 */
export function isOwnShop(accountId: string, slug: string): boolean {
  const ownerId = sampleStore().sellers.get(slug)?.ownerId ?? null;
  return ownerId !== null && ownerId === accountId;
}

/** Whether the listing is in `accountId`'s own shop now. */
export function isOwnListing(accountId: string, listingId: string): boolean {
  const slug = sampleStore().listings.get(listingId)?.sellerSlug;
  return slug !== undefined && isOwnShop(accountId, slug);
}

/** Whether `accountId` asked for this Looking For request. A sample request has no asker, so it's nobody's. */
export function isOwnRequest(accountId: string, requestId: string): boolean {
  const askerId = sampleStore().requests.get(requestId)?.askerId ?? null;
  return askerId !== null && askerId === accountId;
}
```

- [x] **Step 4: `ownsTarget`**

Create `lib/staff/own.ts`:

```ts
import { isOwnListing, isOwnRequest, isOwnShop } from "@/lib/data/staff-shops";
import type { ReportTarget } from "@/lib/types";

// Whose a report's target is (stage L spec decisions 1 and 2). A plain module, not a "use server" file: there, every
// export is an endpoint anyone can post to.

/** What of the admin's own a report is about: their shop, a listing of it, or their Looking For request. */
export type OwnKind = "shop" | "listing" | "request";

/** The kind of the admin's own thing this target is, or null when it's someone else's (or nobody's). */
export function ownsTarget(accountId: string, target: ReportTarget): OwnKind | null {
  switch (target.kind) {
    case "seller":
      return isOwnShop(accountId, target.id) ? "shop" : null;
    case "listing":
      return isOwnListing(accountId, target.id) ? "listing" : null;
    case "request":
      return isOwnRequest(accountId, target.id) ? "request" : null;
  }
}
```

Run: `pnpm test lib/data/staff-shops.test.ts lib/staff/own.test.ts lib/data/mentors.test.ts app/mentor/export/route.test.ts`
Expected: PASS.

Run: `pnpm lint lib/data/staff-shops.ts lib/data/staff-shops.test.ts lib/staff/own.ts lib/staff/own.test.ts lib/data/mentors.test.ts app/mentor/export/route.test.ts`
Expected: no output.

- [x] **Step 5: Hand over**

Files: `lib/data/staff-shops.ts`, `lib/data/staff-shops.test.ts`, `lib/staff/own.ts`, `lib/staff/own.test.ts`, `lib/data/mentors.test.ts`, `app/mentor/export/route.test.ts`. Message:

```
feat: whose a shop, listing or request is, read from the store when asked (stage L spec decision 2): isOwnShop, isOwnListing and isOwnRequest, and ownsTarget naming a report's target as the admin's own shop, listing or request; the mentor choice leaves out the shop's owner (listMentors(exceptOwnerId), spec decision 5). Two tests pin what amendment 15.3 already built: an admin who owns a mentored shop doesn't see it on the dashboard or in the CSV (stage L plan decision 1). Unit: <count>
```

---

### Task 2: The staff views' data learn whose it is

Spec 3 "Data and code" with plan decisions 3 and 4.

**Files:**
- Modify: `lib/data/staff-reports.ts`, `lib/data/staff-reports.test.ts`
- Modify: `lib/data/featured.ts`, `lib/data/featured.test.ts`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short lib/data/staff-reports.ts lib/data/staff-reports.test.ts lib/data/featured.ts lib/data/featured.test.ts`
Expected: no output.

- [x] **Step 2: The tests**

In `lib/data/staff-reports.test.ts`:
- change `import { hideRequest } from "./requests";` to `import { createRequest, hideRequest } from "./requests";`;
- in the test that lists hidden listings (it has `expect(listings[0]).toEqual({`), add `own: false,` after `requestClosed: false,` inside that object;
- add at the end of the file:

```ts
describe("whose a report or a hidden item is (stage L spec decisions 1 and 4)", () => {
  const sipho = async () =>
    (
      await createRequest({
        askerId: "acc-seller",
        fields: {
          title: "Desk lamp for res",
          categorySlug: "res-living",
          campusSlug: "midrand",
          details: "A lamp that clips onto a desk, by the weekend.",
          budgetZar: null,
          swapWelcome: false,
          neededBy: null,
        },
        now: NOW,
      })
    ).id;
  const reportOn = (target: { kind: "listing" | "seller" | "request"; id: string }, targetTitle: string) =>
    createReport({ reporterId: "acc-student", target, targetTitle, reason: "scam", detail: "", now: NOW });

  it("says when a report is about the viewing admin's own shop, listing or request, and then allows nothing", async () => {
    const aboutShop = await reportOn({ kind: "seller", id: "tech-corner" }, "Tech corner");
    const aboutListing = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    const aboutRequest = await reportOn({ kind: "request", id: await sipho() }, "Desk lamp for res");
    for (const [id, kind] of [
      [aboutShop, "shop"],
      [aboutListing, "listing"],
      [aboutRequest, "request"],
    ] as const) {
      const view = (await getReport(id, "acc-seller"))!;
      expect([view.own, view.can], kind).toEqual([kind, { hide: false, pause: false }]);
      expect((await getReport(id, "acc-admin"))!.own, kind).toBeNull();
    }
    // Another admin can still act, and with no viewer the view is as before (plan decision 3).
    expect((await getReport(aboutListing, "acc-admin"))!.can).toEqual({ hide: true, pause: true });
    expect((await getReport(aboutListing))!.own).toBeNull();
    // The queue has no controls, so it names no owner.
    expect((await listReports()).every((view) => view.own === null)).toBe(true);
  });

  it("marks the viewer's own hidden listings and requests", async () => {
    await hideListing("l-001", "Checking it.", NOW);
    const id = await sipho();
    await hideRequest(id, "Checking it.", NOW);
    const mine = await listHidden("acc-seller");
    expect(mine.listings.map((item) => [item.id, item.own])).toEqual([["l-001", true]]);
    expect(mine.requests.map((item) => [item.id, item.own])).toEqual([[id, true]]);
    const theirs = await listHidden("acc-admin");
    expect([theirs.listings[0].own, theirs.requests[0].own]).toEqual([false, false]);
    expect((await getHidden("listing", "l-001", "acc-seller"))?.own).toBe(true);
    expect((await getHidden("request", id))?.own).toBe(false);
  });
});
```

(`createReport`, `getReport`, `getHidden`, `listHidden`, `listReports`, `hideListing` and `NOW` are already imported or declared in that file; check, and add any that isn't.)

In `lib/data/featured.test.ts`, change the import from `./featured` to `import { addPin, featuredChoices, featuredFor, getPin, listPins, removePin } from "./featured";` and add at the end of the file:

```ts
describe("an admin's own shop on Featured (stage L spec decision 1)", () => {
  it("leaves the viewer's own shop out of the choices, and marks its pins", async () => {
    sampleStore().sellers.get("tech-corner")!.verified = true;
    expect((await featuredChoices()).map((seller) => seller.slug)).toContain("tech-corner");
    expect((await featuredChoices("acc-seller")).map((seller) => seller.slug)).not.toContain("tech-corner");
    expect(await featuredChoices("acc-admin")).toEqual(await featuredChoices());
    const made = await pin("tech-corner");
    if (typeof made === "string") throw new Error(`The pin wasn't made: ${made}`);
    expect((await listPins(DAY, "acc-seller")).map((view) => [view.sellerSlug, view.own])).toEqual([["tech-corner", true]]);
    expect((await listPins(DAY, "acc-admin"))[0].own).toBe(false);
    expect((await listPins(DAY))[0].own).toBe(false);
  });

  it("finds one pin by id, for Remove's check of whose shop it is", async () => {
    const made = await pin("nail-bar");
    if (typeof made === "string") throw new Error(`The pin wasn't made: ${made}`);
    expect(await getPin(made.id)).toEqual(made);
    expect(await getPin("pin-nope")).toBeNull();
  });
});
```

Run: `pnpm test lib/data/staff-reports.test.ts lib/data/featured.test.ts`
Expected: FAIL (`own` is missing from the views; `getPin` doesn't exist; `featuredChoices("acc-seller")` still has Tech corner).

- [x] **Step 3: Reports and hidden items**

In `lib/data/staff-reports.ts`:
- add, after `import type { ReportRow } from "./rows";`:

```ts
import { ownsTarget, type OwnKind } from "@/lib/staff/own";
import { isOwnListing, isOwnRequest } from "./staff-shops";
```

  and move the two lines so the `@/lib/…` import sits with the other `@/` import at the top (the file's order: `@/lib/types`, then `@/lib/staff/own`, then `./rows`, `./staff-shops`, `./store`);
- in `ReportView`, after the `can` field, add:

```ts
  /**
   * The viewing admin's own shop, listing or request, when it's one (stage L spec decisions 1 and 4): their page says
   * why in place of the controls, and `can` is all false. Null for anyone else's, for something that has gone, and
   * when no viewer is given (the queue, tests).
   */
  own: OwnKind | null;
```

- change `function toView(row: ReportRow): ReportView {` to `function toView(row: ReportRow, viewerId: string | null): ReportView {`;
- in `toView`, after the `switch (row.targetKind) { … }` block, add:

```ts
  // Whose it is (stage L spec decision 2): read now, from the store. Something that has gone is nobody's.
  const own = viewerId !== null && exists ? ownsTarget(viewerId, { kind: row.targetKind, id: row.targetId }) : null;
```

- replace the returned `can` with:

```ts
    can: {
      hide: own === null && canHide,
      pause: own === null && open && shopRow !== undefined && pausable(shopRow.slug),
    },
    own,
```

- in `listReports`, change `return [...open, ...closed].map(toView);` to `return [...open, ...closed].map((row) => toView(row, null));`, and add to its comment: ` The queue has no controls, so it names no owner (stage L plan decision 3).`;
- replace `getReport` with:

```ts
/** A report for its page. `viewerId` is the signed-in admin, so the view knows when it's about their own (stage L). */
export async function getReport(id: string, viewerId: string | null = null): Promise<ReportView | null> {
  const row = sampleStore().reports.get(id);
  return row ? toView(row, viewerId) : null;
}
```

- in `HiddenItem`, after `requestClosed: boolean;`, add:

```ts
  /** The viewing admin's own listing or request: another admin must show it again (stage L spec decision 1). */
  own: boolean;
```

- change `function hiddenListings(): HiddenItem[] {` to `function hiddenListings(viewerId: string | null): HiddenItem[] {` and add `own: viewerId !== null && isOwnListing(viewerId, row.id),` after `requestClosed: false,` in its item;
- change `function hiddenRequests(): HiddenItem[] {` to `function hiddenRequests(viewerId: string | null): HiddenItem[] {` and add `own: viewerId !== null && isOwnRequest(viewerId, row.id),` after `requestClosed: row.status === "closed",` in its item;
- replace `listHidden`, `getHidden` and `countHidden` with:

```ts
/**
 * Everything the Hub has hidden, newest hidden first (spec decision 14). The Reports queue keeps only the 50 most
 * recently closed reports, so this list is the only place an old hide stays reachable. `viewerId` marks the viewing
 * admin's own (stage L).
 */
export async function listHidden(
  viewerId: string | null = null,
): Promise<{ listings: HiddenItem[]; requests: HiddenItem[] }> {
  return {
    listings: hiddenListings(viewerId).sort(newestHiddenFirst),
    requests: hiddenRequests(viewerId).sort(newestHiddenFirst),
  };
}

/** One hidden listing or request, for its Show again page. Null when it's gone or isn't hidden. */
export async function getHidden(
  kind: "listing" | "request",
  id: string,
  viewerId: string | null = null,
): Promise<HiddenItem | null> {
  return (kind === "listing" ? hiddenListings(viewerId) : hiddenRequests(viewerId)).find((item) => item.id === id) ?? null;
}

/** How many of each are hidden, for Overview's line (plan decision 17). */
export async function countHidden(): Promise<{ listings: number; requests: number }> {
  return { listings: hiddenListings(null).length, requests: hiddenRequests(null).length };
}
```

- [x] **Step 4: Featured**

In `lib/data/featured.ts`:
- add `import { isOwnShop } from "./staff-shops";` after `import type { FeaturedPinRow } from "./rows";`;
- replace `featuredChoices` with:

```ts
/**
 * The sellers an admin may pin (spec 2.8), by name, leaving out `viewerId`'s own shop: another admin must pin it
 * (stage L spec decision 1). Null leaves nobody out.
 */
export async function featuredChoices(viewerId: string | null = null): Promise<Seller[]> {
  return eligibleSellers()
    .filter((seller) => viewerId === null || !isOwnShop(viewerId, seller.slug))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

- after `removePin`, add:

```ts
/** One pin, so Remove can check whose shop it is before anything changes (stage L spec decision 1). Null when none. */
export async function getPin(id: string): Promise<FeaturedPinRow | null> {
  const pin = sampleStore().featuredPins.get(id);
  return pin ? { ...pin } : null;
}
```

- replace `PinView` and `listPins` with:

```ts
/** A pin as the admin's Featured page lists it. `own`: the viewing admin's own shop, so another admin removes it. */
export type PinView = FeaturedPinRow & { sellerName: string; pinnedByName: string; own: boolean };

/** Pins from `fromDay` on, soonest first, then by campus, then in the order made. `viewerId` marks their own. */
export async function listPins(fromDay: string, viewerId: string | null = null): Promise<PinView[]> {
  const store = sampleStore();
  return [...store.featuredPins.values()]
    .filter((pin) => pin.day >= fromDay)
    .sort((a, b) => a.day.localeCompare(b.day) || a.campusSlug.localeCompare(b.campusSlug))
    .map((pin) => ({
      ...pin,
      sellerName: store.sellers.get(pin.sellerSlug)?.name ?? pin.sellerSlug,
      pinnedByName: (pin.pinnedBy ? store.accounts.get(pin.pinnedBy)?.firstName : undefined) ?? "Deleted account",
      own: viewerId !== null && isOwnShop(viewerId, pin.sellerSlug),
    }));
}
```

Run: `pnpm test lib/data/staff-reports.test.ts lib/data/featured.test.ts components/staff lib/staff components/forms/summary-ids.test.tsx`
Expected: PASS.

Two component tests build a `HiddenItem` by hand, and `own` is now required: add `own: false,` after `requestClosed: false,` in the `listing` literal of `components/staff/AdminHidden.test.tsx` and of `components/staff/ShowAgainConfirm.test.tsx` (their `request` literals spread it), so `pnpm typecheck` stays green between Tasks 2 and 4.

Run: `pnpm lint lib/data/staff-reports.ts lib/data/staff-reports.test.ts lib/data/featured.ts lib/data/featured.test.ts`
Expected: no output.

- [x] **Step 5: Typecheck in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-l-task2"` with Tasks 1 and 2's files (if Task 1 isn't committed yet). From `$S`: `pnpm typecheck`.
Expected: no errors.

- [x] **Step 6: Hand over**

Files: `lib/data/staff-reports.ts`, `lib/data/staff-reports.test.ts`, `lib/data/featured.ts`, `lib/data/featured.test.ts`, `components/staff/AdminHidden.test.tsx`, `components/staff/ShowAgainConfirm.test.tsx`. Message:

```
feat: the staff views' data say when something is the viewing admin's own (stage L spec section 3): a report's view names its own shop, listing or request and then allows nothing, hidden listings and requests and Featured's pins carry own, the pin choice leaves out the admin's own shop, and getPin reads a pin before Remove. Every viewer argument is optional, so the queue, Overview and the existing tests read as before (plan decisions 3 and 4). Unit: <count>
```

---

### Task 3: The gate in the admin actions

Spec 2.1, 2.3, 2.5 (`assignMentor`), 2.7 and section 3 "Rules", with plan decisions 5 and 6. Server only.

**Files:**
- Modify: `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`
- Modify: `lib/staff/notices.ts`, `lib/staff/notices.test.ts`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short lib/staff`
Expected: no output (or only this stage's uncommitted `lib/staff/own*.ts`).

- [x] **Step 2: The tests**

In `lib/staff/notices.test.ts`, add at the end:

```ts
describe("an admin's own shop or request (stage L spec decision 3)", () => {
  it("says nothing changed and why", () => {
    expect(staffNoticeText("own-shop")).toBe("Nothing changed. It's your own shop, so another admin must do this.");
    expect(staffNoticeText("own-request")).toBe("Nothing changed. It's your own request, so another admin must do this.");
  });
});
```

In `lib/staff/admin-actions.test.ts`, add `import { redirectSignalOf } from …` only if it isn't imported (it is: `redirectOf, redirectSignalOf, resetRequest, type FakeRequest`), and add at the end of the file:

```ts
// --- Stage L: an admin's own shop, listing or request -------------------------------------------------------------

/** A Looking For request's fields, for a request the admin who owns Tech corner asks for. */
const SIPHOS_FIELDS = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};

const siphosRequest = async () => (await createRequest({ askerId: "acc-seller", fields: SIPHOS_FIELDS, now: STAFF_NOW })).id;
const verifyTechCorner = () => {
  sampleStore().sellers.get("tech-corner")!.verified = true;
};

type OwnCase = {
  /** Who owns the target and is made an admin: Lerato (Crochet corner, waiting) or Sipho (Tech corner, open). */
  owner: "acc-pending" | "acc-seller";
  /** The case's setup. Its form's fields. */
  arrange: () => Promise<Record<string, string>>;
  notice: "own-shop" | "own-request";
  /** Where the refusal lands: the page that shows staff notices (plan decision 5). */
  lands: (fields: Record<string, string>) => string;
};

const TECH_CORNER_PAGE = () => "/admin/sellers/tech-corner";
const REPORT_PAGE = (fields: Record<string, string>) => `/admin/reports/${fields.report}`;

// Every action spec decision 1 names, one case each.
const OWN_CASES: Readonly<Record<string, OwnCase>> = {
  approveSeller: {
    owner: "acc-pending",
    arrange: async () => ({ shop: "crochet-corner", owner: "acc-pending" }),
    notice: "own-shop",
    lands: () => "/admin/sellers/crochet-corner",
  },
  declineSeller: {
    owner: "acc-pending",
    arrange: async () => ({ shop: "crochet-corner", owner: "acc-pending", reason: REASON }),
    notice: "own-shop",
    lands: () => "/admin/sellers/crochet-corner",
  },
  verifySeller: {
    owner: "acc-seller",
    arrange: async () => ({ shop: "tech-corner", verified: "yes" }),
    notice: "own-shop",
    lands: TECH_CORNER_PAGE,
  },
  pauseSeller: {
    owner: "acc-seller",
    arrange: async () => ({ shop: "tech-corner", reason: REASON }),
    notice: "own-shop",
    lands: TECH_CORNER_PAGE,
  },
  resumeSeller: {
    owner: "acc-seller",
    arrange: async () => {
      Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "staff", staffReason: REASON });
      return { shop: "tech-corner" };
    },
    notice: "own-shop",
    lands: TECH_CORNER_PAGE,
  },
  assignMentor: {
    owner: "acc-seller",
    arrange: async () => ({ shop: "tech-corner", mentor: "" }),
    notice: "own-shop",
    lands: TECH_CORNER_PAGE,
  },
  dismissReport: {
    owner: "acc-seller",
    arrange: async () => ({
      report: await report("acc-student", { kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator"),
      note: "Looked fine.",
    }),
    notice: "own-shop",
    lands: REPORT_PAGE,
  },
  hideReportedListing: {
    owner: "acc-seller",
    arrange: async () => ({
      report: await report("acc-student", { kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator"),
      reason: REASON,
    }),
    notice: "own-shop",
    lands: REPORT_PAGE,
  },
  hideReportedRequest: {
    owner: "acc-seller",
    arrange: async () => ({
      report: await report("acc-student", { kind: "request", id: await siphosRequest() }, SIPHOS_FIELDS.title),
      reason: REASON,
    }),
    notice: "own-request",
    lands: REPORT_PAGE,
  },
  pauseReportedShop: {
    owner: "acc-seller",
    arrange: async () => ({
      report: await report("acc-student", { kind: "seller", id: "tech-corner" }, "Tech corner"),
      reason: REASON,
    }),
    notice: "own-shop",
    lands: REPORT_PAGE,
  },
  pinSeller: {
    owner: "acc-seller",
    arrange: async () => {
      verifyTechCorner();
      return { seller: "tech-corner", campus: "midrand", day: "2026-10-14" };
    },
    notice: "own-shop",
    lands: () => "/admin/featured",
  },
  unpinSeller: {
    owner: "acc-seller",
    arrange: async () => {
      verifyTechCorner();
      const pin = await addPin({
        sellerSlug: "tech-corner",
        campusSlug: "midrand",
        day: "2026-10-14",
        staffId: "acc-admin",
        now: STAFF_NOW,
      });
      if (typeof pin === "string") throw new Error(`The pin wasn't made: ${pin}`);
      return { pin: pin.id };
    },
    notice: "own-shop",
    lands: () => "/admin/featured",
  },
  showListingAgain: {
    owner: "acc-seller",
    arrange: async () => {
      await hideListing("l-001", REASON, STAFF_NOW);
      return { listing: "l-001" };
    },
    notice: "own-shop",
    lands: () => "/admin/hidden",
  },
  showRequestAgain: {
    owner: "acc-seller",
    arrange: async () => {
      const id = await siphosRequest();
      await hideRequest(id, REASON, STAFF_NOW);
      return { request: id };
    },
    notice: "own-request",
    lands: () => "/admin/hidden",
  },
};

/** The store as a refusal must leave it: everything but form state, which may hold only the notice. */
function everythingButFormState() {
  const copy = structuredClone(sampleStore());
  copy.formStates.clear();
  return copy;
}

describe("no Hub decision about the admin's own shop, its listings or their own request (stage L spec 2.1 to 2.3)", () => {
  it("has a case for every action spec decision 1 names", () => {
    expect(Object.keys(OWN_CASES).sort()).toEqual(
      [
        "approveSeller",
        "declineSeller",
        "verifySeller",
        "pauseSeller",
        "resumeSeller",
        "assignMentor",
        "dismissReport",
        "hideReportedListing",
        "hideReportedRequest",
        "pauseReportedShop",
        "pinSeller",
        "unpinSeller",
        "showListingAgain",
        "showRequestAgain",
      ].sort(),
    );
  });

  it.each(Object.keys(OWN_CASES))(
    "%s refuses the owner: nothing written, logged, sent or expired, and the notice says why",
    async (name) => {
      const own = OWN_CASES[name];
      sampleStore().accounts.get(own.owner)!.roles = ["admin"];
      const fields = await own.arrange();
      await signedInAs(request, own.owner);
      const before = everythingButFormState();
      const redirect = await redirectSignalOf(() => ADMIN_ACTIONS[name](form(fields)));
      expect([redirect.url, redirect.type], name).toEqual([own.lands(fields), "replace"]);
      expect(everythingButFormState(), name).toEqual(before);
      expect(request.updatedTags, name).toEqual([]);
      expect(await notice(), name).toBe(own.notice);
      // Only the notice is kept: no typed reason or note (spec decision 3).
      expect(
        [...sampleStore().formStates.keys()].filter((key) => !key.endsWith(`:${STAFF_NOTICE}`)),
        name,
      ).toEqual([]);
    },
  );

  it.each(Object.keys(OWN_CASES))("%s still works for another admin", async (name) => {
    const own = OWN_CASES[name];
    sampleStore().accounts.get(own.owner)!.roles = ["admin"];
    const fields = await own.arrange();
    await asAdmin();
    await redirectOf(() => ADMIN_ACTIONS[name](form(fields)));
    expect(sampleStore().auditLog.size, name).toBe(1);
  });

  it("checks the role first: an owner who isn't an admin gets the 404, never a hint (spec section 3, Rules)", async () => {
    await signedInAs(request, "acc-seller");
    await expect(verifySeller(form({ shop: "tech-corner", verified: "yes" }))).rejects.toThrow("notFound");
    expect(await notice()).toBeNull();
  });

  it("goes by who owns the shop now, never the form's owner field (spec decision 2)", async () => {
    sampleStore().accounts.get("acc-pending")!.roles = ["admin"];
    await signedInAs(request, "acc-pending");
    // A form that names someone else as the owner is still Lerato's own shop.
    await redirectOf(() => approveSeller(form({ shop: "crochet-corner", owner: "acc-student" })));
    expect(await notice()).toBe("own-shop");
    expect(sampleStore().sellerProfiles.get("acc-pending")?.status).toBe("pending");
  });
});
```

(`hideListing`, `hideRequest`, `addPin`, `createRequest`, `report`, `REASON`, `ADMIN_ACTIONS`, `asAdmin`, `notice`, `STAFF_NOTICE` are already in the file. `ADMIN_ACTIONS` is declared above the new block, so it's in scope.)

Run: `pnpm test lib/staff/notices.test.ts lib/staff/admin-actions.test.ts`
Expected: FAIL: the two notices have no words, and every "refuses the owner" case acts (one audit entry, a changed store) instead of refusing. "still works for another admin" passes.

- [x] **Step 3: The notices**

In `lib/staff/notices.ts`, before `["nothing", "Nothing changed. It was already done."],` add:

```ts
  // Stage L (spec decision 3): a Hub decision about the admin's own shop, a listing of it, or their own request.
  ["own-shop", "Nothing changed. It's your own shop, so another admin must do this."],
  ["own-request", "Nothing changed. It's your own request, so another admin must do this."],
```

- [x] **Step 4: The gate**

In `lib/staff/admin-actions.ts`:
- change `import { addPin, removePin } from "@/lib/data/featured";` to `import { addPin, getPin, removePin } from "@/lib/data/featured";`;
- in the import from `@/lib/data/staff-shops`, add `isOwnListing`, `isOwnRequest` and `isOwnShop` (sorted, after `hideListing`);
- after `import { requireStaff } from "./access";` add `import type { OwnKind } from "./own";` (keep the `./…` imports in their order: `./access`, `./form-state`, `./notification-text`, `./own`, `./paths`, `./rules`: put it after the `./notification-text` import);
- append to the module comment (after `// expires what buyers' pages read, leaves a notice, and ends with done(): refresh, then a replace redirect.`):

```ts
//
// No admin makes a Hub decision about their own shop, a listing of it, or their own Looking For request (stage L spec
// decisions 1 to 3). Whose it is is read from the store after the role and the ids, before anything is read or
// written; a refusal changes nothing and says why (refuseOwn).
```

- after `nothingChanged`, add:

```ts
/**
 * A Hub decision about the admin's own shop, a listing of it, or their own request (stage L spec decisions 1 to 3):
 * nothing is written, logged, sent or expired, a typed reason isn't kept, and the page says why. The views hide these
 * controls, so only a forged post, an old tab or a race reaches here.
 */
async function refuseOwn(kind: OwnKind, path: string, now: Date): Promise<never> {
  await leaveNotice(kind === "request" ? "own-request" : "own-shop", now);
  done(path);
}
```

- **`approveSeller`**: after `const now = new Date();` add:

```ts
  // Whose the shop is now, never the form's owner field (stage L spec decision 2).
  if (slug && isOwnShop(staff.id, slug)) return refuseOwn("shop", path, now);
```

- **`declineSeller`**: after `if (!slug) return nothingChanged(ADMIN_SELLERS_PATH, now);` add:

```ts
  if (isOwnShop(staff.id, slug)) return refuseOwn("shop", adminSellerPath(slug), now);
```

- **`verifySeller`**, **`resumeSeller`** and **`assignMentor`**: after each one's `const now = new Date();` add:

```ts
  if (slug && isOwnShop(staff.id, slug)) return refuseOwn("shop", path, now);
```

- **`pauseSeller`**: after `if (!slug) return nothingChanged(ADMIN_SELLERS_PATH, now);` add:

```ts
  if (isOwnShop(staff.id, slug)) return refuseOwn("shop", adminSellerPath(slug), now);
```

- **`dismissReport`**: after `if (!id) return nothingChanged(ADMIN_REPORTS_PATH, now);` add:

```ts
  const own = (await getReport(id, staff.id))?.own ?? null;
  if (own) return refuseOwn(own, adminReportPath(id), now);
```

- **`hideReportedListing`**, **`hideReportedRequest`** and **`pauseReportedShop`**: in each, change `const view = id ? await getReport(id) : null;` to `const view = id ? await getReport(id, staff.id) : null;`, and add on the next line, before the `if (!id || …` refusal:

```ts
  // Before `can`, which is all false for the admin's own (stage L plan decision 6).
  if (id && view?.own) return refuseOwn(view.own, adminReportPath(id), now);
```

- **`pinSeller`**: after `const seller = idFrom(formData, "seller");` add:

```ts
  if (seller && isOwnShop(staff.id, seller)) return refuseOwn("shop", ADMIN_FEATURED_PATH, now);
```

- **`unpinSeller`**: replace `const pin = id ? await removePin(id) : null;` with:

```ts
  // Whose shop the pin is for, before it's removed (stage L spec decision 1).
  const held = id ? await getPin(id) : null;
  if (held && isOwnShop(staff.id, held.sellerSlug)) return refuseOwn("shop", ADMIN_FEATURED_PATH, now);
  const pin = id ? await removePin(id) : null;
```

- **`showListingAgain`**: after `const now = new Date();` add:

```ts
  if (id && isOwnListing(staff.id, id)) return refuseOwn("listing", ADMIN_HIDDEN_PATH, now);
```

- **`showRequestAgain`**: after `const now = new Date();` add:

```ts
  if (id && isOwnRequest(staff.id, id)) return refuseOwn("request", ADMIN_HIDDEN_PATH, now);
```

The pickup point actions don't change (spec 2.1, "Left alone").

Run: `pnpm test lib/staff/notices.test.ts lib/staff/admin-actions.test.ts`
Expected: PASS, the amendment 14.8 gate tests included (no export was added).

Run: `pnpm lint lib/staff/admin-actions.ts lib/staff/admin-actions.test.ts lib/staff/notices.ts lib/staff/notices.test.ts`
Expected: no output.

- [x] **Step 5: Hand over**

Files: `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`, `lib/staff/notices.ts`, `lib/staff/notices.test.ts`. Message:

```
feat: no admin makes a Hub decision about their own shop, a listing of it or their own Looking For request (stage L spec decisions 1 to 3): approve, decline, verify, pause, resume, the mentor, the four report actions, pin, unpin and both Show agains read whose it is from the store after the role check, and refuse with the own-shop or own-request notice, writing, logging, sending and expiring nothing. Another admin's post still works. Unit: <count>
```

---

### Task 4: The staff pages say why

Spec 2.4, 2.6 and section 3 "Behaviour", "Words" and "Accessibility", with plan decisions 7 to 9. Server Components only.

**Files:**
- Create: `components/staff/OwnShopLine.tsx`
- Modify: `components/staff/AdminSeller.tsx`, `components/staff/AdminSeller.test.tsx`
- Modify: `components/staff/SellerConfirm.tsx`, `components/staff/SellerConfirm.test.tsx`
- Modify: `components/staff/AdminReport.tsx`, `components/staff/AdminReport.test.tsx`
- Modify: `components/staff/ReportConfirm.tsx`, `components/staff/ReportConfirm.test.tsx`
- Modify: `components/staff/AdminHidden.tsx`, `components/staff/AdminHidden.test.tsx`
- Modify: `components/staff/ShowAgainConfirm.tsx`, `components/staff/ShowAgainConfirm.test.tsx`
- Modify: `components/staff/AdminFeatured.tsx`, `components/staff/AdminFeatured.test.tsx`
- Modify: `app/admin/sellers/[slug]/page.tsx`, `app/admin/sellers/[slug]/decline/page.tsx`, `app/admin/sellers/[slug]/pause/page.tsx`
- Modify: `app/admin/reports/[id]/page.tsx`, `app/admin/reports/[id]/hide/page.tsx`, `app/admin/reports/[id]/pause/page.tsx`
- Modify: `app/admin/hidden/page.tsx`, `app/admin/hidden/listings/[id]/page.tsx`, `app/admin/hidden/requests/[id]/page.tsx`
- Modify: `app/admin/featured/page.tsx`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short components/staff app/admin`
Expected: no output (or only Task 2's two test files, if uncommitted).

- [x] **Step 2: The tests**

In `components/staff/AdminSeller.test.tsx`, replace the `show` helper with:

```tsx
async function show(slug: string, { own = false, onlyAdmin = false }: { own?: boolean; onlyAdmin?: boolean } = {}) {
  render(
    <AdminSeller
      review={(await getShopForReview(slug))!}
      campusName="Midrand"
      categoryName="Tech"
      pointNames={["Library entrance", "Main reception"]}
      mentors={[{ id: "acc-mentor", firstName: "Naledi" }]}
      own={own}
      onlyAdmin={onlyAdmin}
    />,
  );
}
```

and add at the end:

```tsx
describe("an admin's own shop (stage L spec section 3)", () => {
  const LINE =
    "This is your own shop, so another admin must make the Hub's decisions about it: approving, verifying, pausing, pinning and choosing its mentor.";

  it("says why in place of every control, and names its mentor as text", async () => {
    await show("tech-corner", { own: true });
    expect(screen.getByRole("region", { name: "What you can do" })).toHaveTextContent(LINE);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link", { name: "Pause Tech corner" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("region", { name: "Mentor" })).toHaveTextContent("Naledi mentors Tech corner.");
    expect(screen.queryByText(/You're the only admin/)).toBeNull();
    // The storefront isn't a decision (plan decision 9).
    expect(screen.getByRole("link", { name: "See Tech corner's storefront" })).toHaveAttribute("href", "/sellers/tech-corner");
  });

  it("tells the only admin how to hand it on, with a link to Staff", async () => {
    await show("crochet-corner", { own: true, onlyAdmin: true });
    expect(screen.getByRole("region", { name: "What you can do" })).toHaveTextContent(LINE);
    expect(screen.getByText("You're the only admin. Give someone else the Admin role in Staff first.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Staff" })).toHaveAttribute("href", "/admin/staff");
    expect(screen.queryByRole("button", { name: "Approve Crochet corner" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Decline Crochet corner" })).toBeNull();
  });
});
```

In `components/staff/SellerConfirm.test.tsx`, add `own={false} onlyAdmin={false}` to each of the three existing `<SellerConfirm …/>` renders (after `review={…}`), and add inside the describe:

```tsx
  it("says why for the admin's own shop, with no form, and the way back (stage L spec section 3)", async () => {
    render(
      <SellerConfirm kind="pause" review={(await getShopForReview("tech-corner"))!} own onlyAdmin reason="" errors={[]} />,
    );
    expect(screen.getByText(/^This is your own shop, so another admin must make the Hub's decisions/)).toBeInTheDocument();
    expect(screen.getByText("You're the only admin. Give someone else the Admin role in Staff first.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to Tech corner" })).toHaveAttribute("href", "/admin/sellers/tech-corner");
  });
```

In `components/staff/AdminReport.test.tsx`, change `import { AdminReport } from "./AdminReport";` to `import { AdminReport, ownReportLine } from "./AdminReport";`, and add at the end:

```tsx
describe("a report about the admin's own (stage L spec section 3)", () => {
  it("says so in place of Hide, Pause and Dismiss", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    render(<AdminReport report={(await getReport(id, "acc-seller"))!} note="" errors={[]} />);
    const actions = screen.getByRole("region", { name: "What you can do" });
    expect(actions).toHaveTextContent("This report is about your own listing, so another admin must handle it.");
    expect(within(actions).queryByRole("link")).toBeNull();
    expect(within(actions).queryByRole("button")).toBeNull();
    expect(within(actions).queryByRole("textbox")).toBeNull();
  });

  it("names a shop and a request in the same words", () => {
    expect(ownReportLine("shop")).toBe("This report is about your own shop, so another admin must handle it.");
    expect(ownReportLine("request")).toBe("This report is about your own request, so another admin must handle it.");
  });

  it("offers no Show it again on a closed report about the admin's own hidden listing", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    await hideListing("l-001", "Checking it.", NOW);
    await closeReportsOn({ kind: "listing", id: "l-001" }, "hidden", "Checking it.", "acc-admin", NOW);
    render(<AdminReport report={(await getReport(id, "acc-seller"))!} note="" errors={[]} />);
    expect(screen.queryByRole("link", { name: "Show it again" })).toBeNull();
  });
});
```

In `components/staff/ReportConfirm.test.tsx`, add inside the describe:

```tsx
  it("says why for the admin's own, with no form and the way back (stage L spec section 3)", async () => {
    const id = await createReport({
      reporterId: "acc-student",
      target: { kind: "seller", id: "tech-corner" },
      targetTitle: "Tech corner",
      reason: "scam",
      detail: "",
      now: NOW,
    });
    render(<ReportConfirm kind="pause" report={(await getReport(id, "acc-seller"))!} reason="" errors={[]} />);
    expect(screen.getByText(/^This report is about your own shop, so another admin must handle it\./)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to the report" })).toHaveAttribute("href", `/admin/reports/${id}`);
  });
```

In `components/staff/AdminHidden.test.tsx` (its `listing` literal has `own: false` from Task 2), add inside the describe:

```tsx
  it("says Yours on the admin's own, where Show again was (stage L spec section 3)", () => {
    render(<AdminHidden listings={[{ ...listing, own: true }]} requests={[{ ...request, own: true }]} campusNames={campusNames} />);
    expect(screen.queryByRole("link", { name: /^Show again/ })).toBeNull();
    expect(screen.getAllByRole("cell", { name: "Yours" })).toHaveLength(2);
  });
```

In `components/staff/ShowAgainConfirm.test.tsx`, add inside the describe:

```tsx
  it("says why for the admin's own, with no button (stage L spec section 3)", () => {
    const { unmount } = render(<ShowAgainConfirm item={{ ...listing, own: true }} />);
    expect(screen.getByText(/^This is your own listing, so another admin must show it again\./)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to hidden listings and requests" })).toHaveAttribute(
      "href",
      "/admin/hidden",
    );
    unmount();
    render(<ShowAgainConfirm item={{ ...request, own: true }} />);
    expect(screen.getByText(/^This is your own request, so another admin must show it again\./)).toBeInTheDocument();
  });
```

In `components/staff/AdminFeatured.test.tsx`:
- change `import { resetSampleStore } from "@/lib/data/store";` to `import { resetSampleStore, sampleStore } from "@/lib/data/store";`;
- in the `show` helper's `<AdminFeatured …/>`, add `ownLeftOut={false}` after `choices={await featuredChoices()}`;
- add at the end:

```tsx
describe("the admin's own shop on Featured (stage L spec section 3)", () => {
  it("says it isn't in the list, tied to the field, and leaves its pins to another admin", async () => {
    sampleStore().sellers.get("tech-corner")!.verified = true;
    await addPin({ sellerSlug: "tech-corner", campusSlug: "pretoria", day: TODAY, staffId: "acc-admin", now: NOW });
    const rows = await Promise.all(places.map(async (campus) => ({ campus, sellers: await featuredFor(campus.slug, TODAY) })));
    render(
      <AdminFeatured
        today={TODAY}
        rows={rows}
        pins={await listPins(TODAY, "acc-seller")}
        choices={await featuredChoices("acc-seller")}
        ownLeftOut
        places={places}
        values={{}}
        errors={[]}
      />,
    );
    const seller = screen.getByLabelText("Seller");
    expect(seller).toHaveAccessibleDescription("Your own shop isn't in the list. Another admin can pin it.");
    expect(within(seller).queryByRole("option", { name: "Tech corner" })).toBeNull();
    const pins = screen.getByRole("table", { name: "Pins from today on, soonest first" });
    expect(within(pins).getByText("Another admin must remove this pin.")).toBeInTheDocument();
    expect(within(pins).queryByRole("button")).toBeNull();
  });
});
```

Run: `pnpm test components/staff`
Expected: FAIL (the new props and words don't exist).

- [x] **Step 3: The shop line**

Create `components/staff/OwnShopLine.tsx`:

```tsx
import Link from "next/link";
import { ADMIN_STAFF_PATH } from "@/lib/staff/paths";

/**
 * What an admin reads on their own shop's review page and its confirm pages, in place of the controls (stage L spec
 * decisions 4 and 6). The only admin is told how to hand the shop on: the link stands on its own line, so it's 44px
 * tall with the frame's existing pill class (plan decision 7). The words are samples for Lama to change.
 */
export function OwnShopLine({ onlyAdmin }: { onlyAdmin: boolean }) {
  return (
    <>
      <p>
        This is your own shop, so another admin must make the Hub&apos;s decisions about it: approving, verifying,
        pausing, pinning and choosing its mentor.
      </p>
      {onlyAdmin && (
        <>
          <p>You&apos;re the only admin. Give someone else the Admin role in Staff first.</p>
          <p>
            <Link href={ADMIN_STAFF_PATH} prefetch={false} className="staff-row-action">
              Staff
            </Link>
          </p>
        </>
      )}
    </>
  );
}
```

- [x] **Step 4: The review page and its confirm pages**

In `components/staff/AdminSeller.tsx`:
- add `import { OwnShopLine } from "./OwnShopLine";` after the `@/lib/time` import;
- in `AdminSellerProps`, after `mentors`, add:

```tsx
  /** The signed-in admin owns this shop: one line in place of the controls (stage L spec decision 4). */
  own: boolean;
  /** …and is the only admin, so the line says how to hand it on (spec decision 6). */
  onlyAdmin: boolean;
```

- change the signature to `export function AdminSeller({ review, campusName, categoryName, pointNames, mentors, own, onlyAdmin }: AdminSellerProps) {`;
- add to the component's comment: ` The admin's own shop shows why instead of the controls (stage L).`;
- replace the whole "What you can do" `<section …>…</section>` with:

```tsx
      <section aria-labelledby="admin-shop-actions-title" className="staff-section">
        <h2 id="admin-shop-actions-title" className="staff-section-title">
          What you can do
        </h2>
        {own ? (
          <OwnShopLine onlyAdmin={onlyAdmin} />
        ) : (
          <>
            {standing === "waiting" && owner && (
              <div className="staff-row-actions">
                <form action={approveSeller}>
                  <input type="hidden" name="shop" value={shop.slug} />
                  {/* The owner reviewed: if the shop is deleted and a new one takes the link, this form does nothing. */}
                  <input type="hidden" name="owner" value={owner.id} />
                  <button type="submit" className="btn btn-primary">
                    Approve {shop.name}
                  </button>
                </form>
                <Link href={declineSellerPath(shop.slug)} prefetch={false} className="btn btn-danger">
                  Decline {shop.name}
                </Link>
              </div>
            )}
            {standing === "declined" && <p>Nothing to do until the seller sends it again.</p>}
            {hasStorefront && (
              <div className="staff-row-actions">
                <form action={verifySeller}>
                  <input type="hidden" name="shop" value={shop.slug} />
                  <input type="hidden" name="verified" value={shop.verified ? "no" : "yes"} />
                  <button type="submit" className="btn btn-outline text-navy">
                    {shop.verified ? `Remove Verified from ${shop.name}` : `Verify ${shop.name}`}
                  </button>
                </form>
                {canPause && (
                  <Link href={pauseSellerPath(shop.slug)} prefetch={false} className="btn btn-danger">
                    Pause {shop.name}
                  </Link>
                )}
                {standing === "paused" && review.pausedBy === "staff" && (
                  <form action={resumeSeller}>
                    <input type="hidden" name="shop" value={shop.slug} />
                    <button type="submit" className="btn btn-primary">
                      Resume {shop.name}
                    </button>
                  </form>
                )}
              </div>
            )}
            {hasStorefront && !owner && <p>A sample shop no account owns can&apos;t be paused.</p>}
          </>
        )}
        {hasStorefront &&
          (standing === "paused" && review.pausedBy === "staff" ? (
            <p className="staff-muted">Buyers can&apos;t see {shop.name} while the Hub&apos;s pause lasts.</p>
          ) : (
            <p>
              <Link href={`/sellers/${shop.slug}`} prefetch={false}>
                See {shop.name}&apos;s storefront
              </Link>
            </p>
          ))}
      </section>
```

- in the Mentor section, replace the whole `<form action={assignMentor} className="form-stack staff-inline-form">…</form>` with:

```tsx
          {own ? (
            // Choosing who writes notes about you is a decision about yourself (stage L spec decision 5).
            <p>{review.mentor ? `${review.mentor.firstName} mentors ${shop.name}.` : `${shop.name} has no mentor.`}</p>
          ) : (
            <form action={assignMentor} className="form-stack staff-inline-form">
              <input type="hidden" name="shop" value={shop.slug} />
              <div className="form-field">
                <label htmlFor={mentorField} className="form-label">
                  Mentor for {shop.name}
                </label>
                <select
                  id={mentorField}
                  name="mentor"
                  defaultValue={review.mentor?.id ?? ""}
                  className="form-input form-select"
                >
                  <option value="">No mentor</option>
                  {mentors.map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.firstName}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-outline text-navy form-submit">
                Save mentor for {shop.name}
              </button>
            </form>
          )}
```

  (the form is the one at HEAD, unchanged, now inside the `own` branch).

In `components/staff/SellerConfirm.tsx`:
- add `import { OwnShopLine } from "./OwnShopLine";` after `import { ConfirmAction } from "./ConfirmAction";`;
- in `SellerConfirmProps`, after `review: ShopReview;`, add:

```tsx
  /** The signed-in admin owns this shop: the line and the way back, no form (stage L spec section 3). */
  own: boolean;
  onlyAdmin: boolean;
```

- change the signature to `export function SellerConfirm({ kind, review, own, onlyAdmin, reason, errors }: SellerConfirmProps) {`;
- after `const who = owner?.firstName ?? "The seller";`, add:

```tsx
  if (own) {
    return (
      <>
        <OwnShopLine onlyAdmin={onlyAdmin} />
        <p>
          <Link href={back} prefetch={false}>
            Back to {shop.name}
          </Link>
        </p>
      </>
    );
  }
```

In `app/admin/sellers/[slug]/page.tsx`:
- add `import { countAdmins } from "@/lib/data/staff-accounts";` before the `@/lib/data/staff-shops` import, and change that import to `import { getShopForReview, isOwnShop, listMentors } from "@/lib/data/staff-shops";`;
- replace from `const [campuses, categories, mentors, notice] = await Promise.all([` to the closing `]);` with:

```tsx
  // The admin's own shop shows why in place of its controls, and its owner is never offered as its mentor (stage L
  // spec decisions 4 to 6).
  const own = isOwnShop(account.id, slug);
  const [campuses, categories, mentors, notice, admins] = await Promise.all([
    getCampuses(),
    getCategories(),
    listMentors(review.shop.ownerId),
    takeNotice(),
    own ? countAdmins() : Promise.resolve(0),
  ]);
```

- add `own={own}` and `onlyAdmin={own && admins === 1}` to `<AdminSeller …/>` after `mentors={mentors}`.

In `app/admin/sellers/[slug]/decline/page.tsx` and `app/admin/sellers/[slug]/pause/page.tsx`:
- add `import { countAdmins } from "@/lib/data/staff-accounts";` before the `@/lib/data/staff-shops` import, and change that import to `import { getShopForReview, isOwnShop } from "@/lib/data/staff-shops";`;
- replace `const state = await readFormState(declineForm(slug));` (in the pause page: `readFormState(shopPauseForm(slug))`) with:

```tsx
  const own = isOwnShop(account.id, slug);
  const [state, admins] = await Promise.all([
    readFormState(declineForm(slug)),
    own ? countAdmins() : Promise.resolve(0),
  ]);
```

  (in the pause page, `shopPauseForm(slug)`);
- add `own={own}` and `onlyAdmin={own && admins === 1}` to `<SellerConfirm …/>` after `review={review}`.

- [x] **Step 5: The report page and its confirm pages**

In `components/staff/AdminReport.tsx`:
- add `import type { OwnKind } from "@/lib/staff/own";` after the `@/lib/staff/admin-actions` import;
- after the `AdminReportProps` type, add:

```tsx
/** What the admin reads about a report on their own shop, listing or request (stage L spec section 3; sample words). */
export function ownReportLine(kind: OwnKind): string {
  return `This report is about your own ${kind}, so another admin must handle it.`;
}
```

- in the "What" row, change `{!report.open && report.unseen === "hidden" && report.target.kind !== "seller" && (` to `{!report.open && report.unseen === "hidden" && report.target.kind !== "seller" && !report.own && (`;
- inside the open report's section, replace everything after its `<h2 id="admin-report-actions-title" …>What you can do</h2>` up to the section's closing `</section>` (the row of actions, the "can only be dismissed" paragraph, the summary and the Dismiss form) with:

```tsx
          {report.own ? (
            <p>{ownReportLine(report.own)}</p>
          ) : (
            <>
              {(report.can.hide || report.can.pause) && (
                <div className="staff-row-actions">
                  {report.can.hide && (
                    <Link href={hideReportedPath(report.id)} prefetch={false} className="btn btn-danger">
                      Hide {report.targetTitle}
                    </Link>
                  )}
                  {report.can.pause && report.shop && (
                    <Link href={pauseReportedPath(report.id)} prefetch={false} className="btn btn-danger">
                      Pause {report.shop.name}
                    </Link>
                  )}
                </div>
              )}
              {!report.can.hide && !report.can.pause && (
                <p>
                  This report is about something that has gone, or a shop the Hub can&apos;t pause, so it can only be
                  dismissed.
                </p>
              )}
              <ErrorSummary id={`dismiss-${report.id}-summary`} errors={errors} />
              <form action={dismissReport} noValidate className="form-stack staff-inline-form">
                <input type="hidden" name="report" value={report.id} />
                <div className="form-field">
                  <label htmlFor={noteId} className="form-label">
                    Note
                  </label>
                  <p id={`${noteId}-hint`} className="form-hint">
                    Only Hub staff see it. Up to {REASON_MAX} characters.
                  </p>
                  <FieldError id={`${noteId}-error`} message={noteError} />
                  <textarea
                    id={noteId}
                    name="note"
                    rows={3}
                    required
                    defaultValue={note}
                    aria-invalid={noteError ? true : undefined}
                    aria-describedby={describedBy(`${noteId}-hint`, noteError && `${noteId}-error`)}
                    className="form-input staff-textarea"
                  />
                </div>
                <button type="submit" className="btn btn-outline text-navy form-submit">
                  Dismiss <span className="sr-only">the report about {report.targetTitle}</span>
                </button>
              </form>
            </>
          )}
```

  (the elements in the second branch are the ones at HEAD, unchanged).

In `components/staff/ReportConfirm.tsx`:
- add `import { ownReportLine } from "./AdminReport";` after `import { ConfirmAction } from "./ConfirmAction";`;
- after `const shop = report.shop;`, add:

```tsx
  // The admin's own shop, listing or request (stage L spec section 3): the line and the way back, no form.
  if (report.own) {
    return (
      <p>
        {ownReportLine(report.own)}{" "}
        <Link href={back} prefetch={false}>
          Back to the report
        </Link>
      </p>
    );
  }
```

In `app/admin/reports/[id]/page.tsx`, `app/admin/reports/[id]/hide/page.tsx` and `app/admin/reports/[id]/pause/page.tsx`, change `const report = isId(id) ? await getReport(id) : null;` to `const report = isId(id) ? await getReport(id, account.id) : null;`.

- [x] **Step 6: Hidden, and Show again**

In `components/staff/AdminHidden.tsx`:
- add to the component's comment: ` The admin's own listing or request says "Yours" where Show again was (stage L).`;
- in both tables, change the last cell `<ShowLink key="show" item={item} />,` to `item.own ? "Yours" : <ShowLink key="show" item={item} />,`.

In `components/staff/ShowAgainConfirm.tsx`:
- add `import Link from "next/link";` as the first import;
- at the top of `ShowAgainConfirm`, before its `return`, add:

```tsx
  // The admin's own listing or request (stage L spec section 3): the line and the way back, no button.
  if (item.own) {
    return (
      <p>
        {`This is your own ${item.kind}, so another admin must show it again.`}{" "}
        <Link href={ADMIN_HIDDEN_PATH} prefetch={false}>
          Back to hidden listings and requests
        </Link>
      </p>
    );
  }
```

In `app/admin/hidden/page.tsx`, change `listHidden()` to `listHidden(account.id)`. In `app/admin/hidden/listings/[id]/page.tsx` and `app/admin/hidden/requests/[id]/page.tsx`, change `getHidden("listing", id)` (or `getHidden("request", id)`) to `getHidden("listing", id, account.id)` (or `getHidden("request", id, account.id)`).

- [x] **Step 7: Featured**

In `components/staff/AdminFeatured.tsx`:
- in `AdminFeaturedProps`, after `choices`, add:

```tsx
  /** The signed-in admin's own shop would be a choice, and is left out: the field says so (stage L spec section 3). */
  ownLeftOut: boolean;
```

- change the signature to `export function AdminFeatured({ today, rows, pins, choices, ownLeftOut, places, values, errors }: AdminFeaturedProps) {`;
- in the Seller field, after `<FieldError id={`${FIELDS.seller}-error`} message={sellerError} />`, add:

```tsx
            {ownLeftOut && (
              <p id={`${FIELDS.seller}-hint`} className="form-hint">
                Your own shop isn&apos;t in the list. Another admin can pin it.
              </p>
            )}
```

  and change the select's `aria-describedby={describedBy(sellerError && `${FIELDS.seller}-error`)}` to `aria-describedby={describedBy(ownLeftOut && `${FIELDS.seller}-hint`, sellerError && `${FIELDS.seller}-error`)}`;
- in the pins table, replace the last cell (the `<form key="remove" action={unpinSeller}>…</form>,`) with:

```tsx
              pin.own ? (
                "Another admin must remove this pin."
              ) : (
                <form key="remove" action={unpinSeller}>
                  <input type="hidden" name="pin" value={pin.id} />
                  <button type="submit" className="staff-row-action staff-row-action-danger">
                    Remove{" "}
                    <span className="sr-only">
                      the pin for {pin.sellerName} at {placeName(pin.campusSlug)} on {dayMonth(pin.day)}
                    </span>
                  </button>
                </form>
              ),
```

In `app/admin/featured/page.tsx`, replace the `const [pins, choices, state, notice] = await Promise.all([…]);` block with:

```tsx
  // The admin's own shop isn't a choice and its pins aren't theirs to remove (stage L spec decision 1); the field
  // says so when it would have been listed (plan decision 4).
  const [pins, everyone, choices, state, notice] = await Promise.all([
    listPins(today, account.id),
    featuredChoices(),
    featuredChoices(account.id),
    readFormState(PIN_FORM),
    takeNotice(),
  ]);
```

and add `ownLeftOut={choices.length < everyone.length}` to `<AdminFeatured …/>` after `choices={choices}`.

Run: `pnpm test components/staff app/admin app/mentor`
Expected: PASS.

Run: `pnpm lint components/staff app/admin`
Expected: no output.

- [x] **Step 8: Typecheck and the staff e2e in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-l-task4"` with every uncommitted file of Tasks 1 to 4. From `$S`: `pnpm typecheck` (no errors), then run e2e as the conventions say, with `tests/e2e/staff.spec.ts tests/e2e/staff-checks.spec.ts tests/e2e/staff-accounts-checks.spec.ts --project=desktop-1440 --project=phone-390`.
Expected: no errors; the e2e pass (no sample admin owns a shop, so nothing they check changes). Stop your server by its PID.

- [x] **Step 9: Hand over**

Files: `components/staff/OwnShopLine.tsx`, `components/staff/AdminSeller.tsx`, `components/staff/AdminSeller.test.tsx`, `components/staff/SellerConfirm.tsx`, `components/staff/SellerConfirm.test.tsx`, `components/staff/AdminReport.tsx`, `components/staff/AdminReport.test.tsx`, `components/staff/ReportConfirm.tsx`, `components/staff/ReportConfirm.test.tsx`, `components/staff/AdminHidden.tsx`, `components/staff/AdminHidden.test.tsx`, `components/staff/ShowAgainConfirm.tsx`, `components/staff/ShowAgainConfirm.test.tsx`, `components/staff/AdminFeatured.tsx`, `components/staff/AdminFeatured.test.tsx`, `app/admin/sellers/[slug]/page.tsx`, `app/admin/sellers/[slug]/decline/page.tsx`, `app/admin/sellers/[slug]/pause/page.tsx`, `app/admin/reports/[id]/page.tsx`, `app/admin/reports/[id]/hide/page.tsx`, `app/admin/reports/[id]/pause/page.tsx`, `app/admin/hidden/page.tsx`, `app/admin/hidden/listings/[id]/page.tsx`, `app/admin/hidden/requests/[id]/page.tsx`, `app/admin/featured/page.tsx`. Message:

```
feat: the staff pages say why in place of the controls on an admin's own shop, listing or request (stage L spec section 3): the review page and its decline and pause pages show one line (and, for the only admin, how to hand it on, with a 44px Staff link), the mentor as text; a report about your own says so instead of Hide, Pause and Dismiss; the hidden list says Yours and Show again's page explains; Featured leaves your shop out of the choice and your pins to another admin. Controls are removed, never disabled. JS: none (Server Components only). Unit: <count>
```

---

### Task 5: The closing rule, the row and the words

Spec 2.8 to 2.10 and section 4 "Data and code" and "Words", with plan decisions 10, 21 and 22. Pure functions, types and one row field; no reader's signature changes yet.

**Files:**
- Modify: `lib/looking-for/rules.ts`, `lib/looking-for/rules.test.ts`
- Modify: `lib/looking-for/words.ts`, `lib/looking-for/words.test.ts`
- Modify: `lib/types.ts`, `lib/data/rows.ts`, `lib/data/store.ts`, `lib/data/requests.ts`
- Modify: `data/fixtures/requests.ts`, `data/fixtures/request-rows.ts`, `data/fixtures/request-rows.test.ts`
- Modify: `components/looking-for/YourRequestsView.test.tsx`, `components/looking-for/RequestFormView.test.tsx`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short lib/looking-for lib/types.ts lib/data/rows.ts lib/data/store.ts lib/data/requests.ts data/fixtures components/looking-for`
Expected: no output.

- [x] **Step 2: The tests**

In `lib/looking-for/rules.test.ts`, change the import from `./rules` to:

```ts
import {
  addDays,
  checkNeededBy,
  checkRequest,
  closedAtFor,
  closeReasonOf,
  closingDay,
  hasContactDetails,
  IDLE_CLOSE_DAYS,
  NEEDED_BY_GRACE_DAYS,
  parseBudget,
  requestOpenOn,
  type RequestInput,
} from "./rules";
```

and add at the end:

```ts
describe("when a request closes itself (stage L spec decisions 8 to 10)", () => {
  const ROW = { askerId: "acc-student", neededBy: null, updatedAt: "2026-10-13T09:30:00.000Z" };

  it("keeps a request 3 whole days after its needed-by date, or 30 days after it last changed", () => {
    expect([NEEDED_BY_GRACE_DAYS, IDLE_CLOSE_DAYS]).toEqual([3, 30]);
    // Needed by Friday 16 October: open through Monday 19, closed from Tuesday 20.
    expect(closingDay({ ...ROW, neededBy: "2026-10-16" })).toBe("2026-10-20");
    // Posted 13 October: closed from 12 November.
    expect(closingDay(ROW)).toBe("2026-11-12");
  });

  it("counts the 30 days from the South African date: 22:30 UTC on 13 October is the 14th there", () => {
    expect(closingDay({ ...ROW, updatedAt: "2026-10-13T22:30:00.000Z" })).toBe("2026-11-13");
  });

  it("starts the 30 days again when the request changes, and lets a needed-by date win even when it's later", () => {
    expect(closingDay({ ...ROW, updatedAt: "2026-10-20T08:00:00.000Z" })).toBe("2026-11-19");
    expect(closingDay({ ...ROW, neededBy: "2027-01-10" })).toBe("2027-01-14");
  });

  it("never closes a sample request, which has no asker (decision 9)", () => {
    expect(closingDay({ ...ROW, askerId: null, neededBy: "2026-10-16" })).toBeNull();
    expect(closingDay({ ...ROW, askerId: null })).toBeNull();
  });

  it("is open the day before its closing day, and closed on it and after", () => {
    const request = { status: "open" as const, closesOn: "2026-10-20" };
    expect(requestOpenOn(request, "2026-10-19")).toBe(true);
    expect(requestOpenOn(request, "2026-10-20")).toBe(false);
    expect(requestOpenOn(request, "2026-10-21")).toBe(false);
    expect(requestOpenOn({ status: "open", closesOn: null }, "2030-01-01")).toBe(true);
    expect(requestOpenOn({ status: "closed", closesOn: null }, "2026-10-14")).toBe(false);
  });

  it("stores the close at the start of the closing day in South Africa, as UTC", () => {
    expect(closedAtFor("2026-10-20")).toBe("2026-10-19T22:00:00.000Z");
  });

  it("says why: its needed-by date, else the 30 days", () => {
    expect(closeReasonOf({ neededBy: "2026-10-16" })).toBe("needed-by");
    expect(closeReasonOf({ neededBy: null })).toBe("idle");
  });
});
```

In `lib/looking-for/words.test.ts`, add `AUTO_CLOSE_WHY`, `CLOSES_BY_ITSELF_HINT`, `REOPEN_CLEARS_DATE_HINT` and `requestAutoClosedText` to the import from `./words` (sorted), and add at the end:

```ts
describe("requests that close themselves (stage L spec section 4, Words)", () => {
  it("tells the asker once, in the app, why it closed and that they can reopen it", () => {
    expect(requestAutoClosedText("Kettle for res", "needed-by")).toBe(
      "Your request Kettle for res closed automatically 3 days after the date you needed it by. Reopen it in Your requests if you still need it.",
    );
    expect(requestAutoClosedText("Kettle for res", "idle")).toBe(
      "Your request Kettle for res closed automatically after 30 days with no changes. Reopen it in Your requests if you still need it.",
    );
  });

  it("gives the asker's lines their reasons, the reopen hint and notice, and the form's hint", () => {
    expect(AUTO_CLOSE_WHY).toEqual({
      "needed-by": "3 days after the date you needed it by",
      idle: "after 30 days with no changes",
    });
    expect(REOPEN_CLEARS_DATE_HINT).toBe("Reopening removes the needed-by date, which has passed.");
    expect(requestNoticeText("reopened-date-cleared")).toBe(
      "Request reopened. Its needed-by date had passed, so it's been removed. Add a new one with Edit.",
    );
    expect(CLOSES_BY_ITSELF_HINT).toBe(
      "Your request closes automatically 3 days after this date. Without one, it closes after 30 days with no changes.",
    );
  });
});
```

In `data/fixtures/request-rows.test.ts`, change the second test to:

```ts
  it("names no asker, and none is closed by anyone or hidden", () => {
    for (const row of sampleRequestRows) {
      expect([row.askerId, row.closedAt, row.closedBy, row.hiddenAt, row.hiddenReason], row.id).toEqual([
        null,
        null,
        null,
        null,
        null,
      ]);
    }
  });
```

and add after it:

```ts
  it("never closes a sample by itself: none has a closing day (stage L spec decision 9)", () => {
    for (const request of requests) expect(request.closesOn, request.id).toBeNull();
  });
```

Run: `pnpm test lib/looking-for/rules.test.ts lib/looking-for/words.test.ts data/fixtures/request-rows.test.ts`
Expected: FAIL (the new names and fields don't exist).

- [x] **Step 3: The rule**

In `lib/looking-for/rules.ts`:
- after `import { parsePrice } from "@/lib/selling/rules";`, add:

```ts
import { sastDate } from "@/lib/time";
import type { RequestStatus } from "@/lib/types";
```

- after the `checkNeededBy` function, add:

```ts
// --- Closing by itself (stage L spec decisions 8 to 10) ----------------------------------------------------------

/** Whole days a request stays up after the date it was needed by (stage L spec decision 8). */
export const NEEDED_BY_GRACE_DAYS = 3;
/** Days a request with no needed-by date stays up after it was posted, last edited or reopened. */
export const IDLE_CLOSE_DAYS = 30;

/** Why a request closed by itself: its needed-by date passed, or 30 days went by with no changes. */
export type CloseReason = "needed-by" | "idle";

/**
 * The SAST date (YYYY-MM-DD) an open request counts as closed from (stage L spec decision 8): 4 days after its
 * needed-by date (3 whole days of grace), else 30 days after the SAST date it last changed (`updatedAt`: posted,
 * edited, reopened, or hidden and shown again by the Hub). A needed-by date always wins, even when it's later: it's
 * the asker's own word, and the form caps it at 90 days. Null for a sample request, which has no asker and never
 * closes itself (decision 9). A function of the row alone: it reads no clock, so a cached reader can hold it.
 */
export function closingDay(row: { askerId: string | null; neededBy: string | null; updatedAt: string }): string | null {
  if (row.askerId === null) return null;
  if (row.neededBy !== null) return addDays(row.neededBy, NEEDED_BY_GRACE_DAYS + 1);
  return addDays(sastDate(new Date(row.updatedAt)), IDLE_CLOSE_DAYS);
}

/** Why a request that closed by itself did: the needed-by date it had, else the 30 days. */
export function closeReasonOf(row: { neededBy: string | null }): CloseReason {
  return row.neededBy !== null ? "needed-by" : "idle";
}

/**
 * The one test of whether a request is open on `today`, a SAST date (stage L spec decision 10): open, and not yet at
 * its closing day. True of a stored close or not, so the board, the homepage, the sitemap and offers agree at midnight.
 */
export function requestOpenOn(request: { status: RequestStatus; closesOn: string | null }, today: string): boolean {
  return request.status === "open" && (request.closesOn === null || today < request.closesOn);
}

/**
 * The start of a SAST day as a UTC time (stage L spec decision 11): what a request that closed by itself stores as
 * `closedAt`, so the date it shows is the rule's, not the day someone happened to look.
 */
export function closedAtFor(day: string): string {
  return new Date(`${day}T00:00:00+02:00`).toISOString();
}
```

- [x] **Step 4: The words**

In `lib/looking-for/words.ts`:
- change `import { OPEN_REQUESTS_MAX } from "./rules";` to `import { type CloseReason, IDLE_CLOSE_DAYS, NEEDED_BY_GRACE_DAYS, OPEN_REQUESTS_MAX } from "./rules";`;
- in `NOTICES`, after `["reopen-limit", …],`, add:

```ts
  // Stage L (spec decision 13): reopening took off a needed-by date that had passed, or it would close again at once.
  ["reopened-date-cleared", "Request reopened. Its needed-by date had passed, so it's been removed. Add a new one with Edit."],
```

- after `requestHiddenText`, add:

```ts
/** Why a request closed by itself, as the asker's notification and lines end it (stage L spec section 4, Words). */
export const AUTO_CLOSE_WHY: Readonly<Record<CloseReason, string>> = {
  "needed-by": `${NEEDED_BY_GRACE_DAYS} days after the date you needed it by`,
  idle: `after ${IDLE_CLOSE_DAYS} days with no changes`,
};

/** The asker's notification when their request closes by itself (stage L spec decision 12), "request-update" kind. */
export function requestAutoClosedText(title: string, reason: CloseReason): string {
  return `Your request ${title} closed automatically ${AUTO_CLOSE_WHY[reason]}. Reopen it in Your requests if you still need it.`;
}

/** Under Reopen when the request's needed-by date has passed (stage L spec decision 13). */
export const REOPEN_CLEARS_DATE_HINT = "Reopening removes the needed-by date, which has passed.";

/** Added to the request form's needed-by hint (stage L spec section 4). */
export const CLOSES_BY_ITSELF_HINT = `Your request closes automatically ${NEEDED_BY_GRACE_DAYS} days after this date. Without one, it closes after ${IDLE_CLOSE_DAYS} days with no changes.`;
```

- [x] **Step 5: The type, the row, the store and the seeds**

In `lib/types.ts`, in `LookingForRequest`, after `status: RequestStatus;`, add:

```ts
  /**
   * The SAST date it closes by itself from (stage L spec decision 10), or null for a sample request. A function of the
   * stored row, so a cached copy is never wrong about it; whether it's open today is `requestOpenOn`.
   */
  closesOn: string | null;
```

In `lib/data/rows.ts`, in `RequestRow`, replace

```ts
  /** When the asker closed it; null while it's open, and for the sample requests. */
  closedAt: string | null;
```

with

```ts
  /**
   * When it closed: the asker's Close, or the start of its closing day in SAST when it closed by itself (stage L). Null
   * while it's open, and for the sample requests.
   */
  closedAt: string | null;
  /** Who closed it (stage L spec decision 11): its asker, or "auto" when it closed by itself. Null while it's open, and on the samples. */
  closedBy: "asker" | "auto" | null;
```

In `lib/data/store.ts`, replace the comment and line

```ts
 * 11: audit rows gain relatedId, so a deleted mentor's name leaves the entries that assigned them.
 */
export const STORE_VERSION = 11;
```

(the Supabase phases B and C merge's lines) with

```ts
 * 11: audit rows gain relatedId, so a deleted mentor's name leaves the entries that assigned them.
 * 12: a Looking For request says who closed it, its asker or the rule (`closedBy`, stage L spec decision 11).
 */
export const STORE_VERSION = 12;
```

If the number at HEAD isn't 11, add one to whatever it is and say so in the hand-over.

In `data/fixtures/requests.ts`, in the `request` builder's returned object, after `status,` add:

```ts
  // The samples never close themselves (stage L spec decision 9): they have no asker to tell or to reopen them.
  closesOn: null,
```

In `data/fixtures/request-rows.ts`, change the comment's last sentence `nothing closed by anyone or hidden.` to `nothing closed by anyone or hidden, and no closedBy (stage L).`, and after `closedAt: null,` add `closedBy: null,`.

In `lib/data/requests.ts` (Task 6 replaces this file whole; these are the smallest changes that keep it compiling now):
- change `import type { RequestFields } from "@/lib/looking-for/rules";` to `import { closingDay, type RequestFields } from "@/lib/looking-for/rules";`;
- in `toRequest`, after `status: row.status,`, add `closesOn: closingDay(row),`;
- in `createRequest`'s row, after `closedAt: null,`, add `closedBy: null,`;
- in `setRequestOpen`, after `row.closedAt = open ? null : now.toISOString();`, add `row.closedBy = open ? null : "asker";`.

In `components/looking-for/YourRequestsView.test.tsx`, in the `own` helper's `request`, after `status: state === "closed" ? "closed" : "open",`, add `closesOn: null,`. In `components/looking-for/RequestFormView.test.tsx`, in the test "fills an edit with the request, and posts its id", after `status: "open",` add `closesOn: null,`.

Run: `pnpm test lib/looking-for data/fixtures lib/data/requests.test.ts components/looking-for`
Expected: PASS.

Run: `pnpm lint lib/looking-for lib/types.ts lib/data/rows.ts lib/data/store.ts lib/data/requests.ts data/fixtures components/looking-for/YourRequestsView.test.tsx components/looking-for/RequestFormView.test.tsx`
Expected: no output.

- [x] **Step 6: Typecheck in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-l-task5"` with this stage's uncommitted files. From `$S`: `pnpm typecheck`.
Expected: no errors. If it names another literal typed `LookingForRequest` (a test building one by hand), add `closesOn: null,` after its `status` and list the file in the hand-over.

- [x] **Step 7: Hand over**

Files: `lib/looking-for/rules.ts`, `lib/looking-for/rules.test.ts`, `lib/looking-for/words.ts`, `lib/looking-for/words.test.ts`, `lib/types.ts`, `lib/data/rows.ts`, `lib/data/store.ts`, `lib/data/requests.ts`, `data/fixtures/requests.ts`, `data/fixtures/request-rows.ts`, `data/fixtures/request-rows.test.ts`, `components/looking-for/YourRequestsView.test.tsx`, `components/looking-for/RequestFormView.test.tsx`. Message:

```
feat: when a Looking For request closes itself (stage L spec decisions 8 to 10): closingDay gives the SAST date, 3 whole days after the needed-by date or 30 days after it last changed, null for the samples; requestOpenOn is the one test by date; closedAtFor stores the start of that day. A request carries closesOn, a row says who closed it (closedBy), and the words for the asker's notification, lines, reopen hint and notice and the form's hint are in. STORE_VERSION 12. Unit: <count>
```

---

### Task 6: Settling, the dated readers and their callers

Spec 2.10 to 2.16 and section 4 "Data and code", with plan decisions 11 to 15, 17, 19 and 20. The readers take `now` or `today`, and every caller passes it. Behaviour in the Server Actions beyond passing `now` is Task 7's.

**Files:**
- Modify: `lib/data/requests.ts` (whole new file below), `lib/data/requests.test.ts`
- Modify: `lib/types.ts` (`OwnRequest`)
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`
- Modify: `lib/looking-for/subjects.ts`, `lib/looking-for/subjects.test.ts`
- Modify: `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts`
- Modify: `lib/data/messages.test.ts`
- Modify: `components/looking-for/RequestBoard.tsx`, `components/looking-for/RequestBoard.test.tsx`
- Modify: `components/home/LookingForRequests.tsx`, `components/home/LookingForRequests.test.tsx`
- Modify: `components/looking-for/ViewerOffers.tsx`, `components/looking-for/ViewerOffers.test.tsx`
- Modify: `components/looking-for/OffersViews.tsx`, `components/looking-for/OffersPanel.tsx`, `components/looking-for/OffersPanel.test.tsx`
- Modify: `components/looking-for/Offer.tsx`, `components/looking-for/Offer.test.tsx`
- Modify: `components/looking-for/YourRequests.tsx`, `components/looking-for/YourRequests.test.tsx`
- Modify: `components/looking-for/RequestForm.tsx`
- Modify: `components/looking-for/DeleteRequest.tsx`, `components/looking-for/DeleteRequest.test.tsx`
- Modify: `components/looking-for/YourRequestsView.test.tsx`

- [x] **Step 1: Check the files are yours to edit, and read the docs**

Run: `git --no-optional-locks status --short lib components/looking-for components/home`
Expected: only this stage's uncommitted files, if any.

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md` and `03-api-reference/01-directives/use-cache.md` (arguments are part of the cache key: `today` turns each reader's entry over at SAST midnight).

- [x] **Step 2: The existing tests' new arguments (mechanical; plan decision 19)**

Run each command, then the `grep` after it, from the repo root:

```bash
perl -pi -e 's/listedRequests\(\)/listedRequests(TODAY)/g; s/getOwnRequest\(("[^"]+"), ([^)]+)\)/getOwnRequest($1, $2, NOW)/g; s/listOwnRequests\(("[^"]+")\)/listOwnRequests($1, NOW)/g; s/countOpenRequests\(("[^"]+")\)/countOpenRequests($1, NOW)/g' lib/data/requests.test.ts
grep -c "listedRequests(TODAY)\|, NOW)" lib/data/requests.test.ts
```

Expected: `18` (4 lines that already had `, NOW)`, then 4 `listedRequests`, 4 `getOwnRequest`, 3 `listOwnRequests` and 3 `countOpenRequests`; checked on a copy while planning). Then add `const TODAY = "2026-10-14";` after `const NOW = …;` in that file, and in the test "exports the account's requests by name, with no ids", add `closedAutomatically: false,` after `closedAt: later(1).toISOString(),`.

```bash
perl -pi -e 's/getOwnRequest\(("[^"]+"), ([^)]+)\)/getOwnRequest($1, $2, STAFF_NOW)/g' lib/looking-for/actions.test.ts
grep -c "STAFF_NOW))" lib/looking-for/actions.test.ts
perl -pi -e 's/getOwnRequest\(("[^"]+"), ([^)]+)\)/getOwnRequest($1, $2, NOW)/g' lib/data/messages.test.ts
grep -n "getOwnRequest(" lib/data/messages.test.ts
```

Expected: `14` in `actions.test.ts` (one line already had `STAFF_NOW))`, then 13 calls); in `messages.test.ts`, one call: `600:    const request = (await getOwnRequest("acc-student", id, NOW))!.request;`.

In `lib/looking-for/actions.test.ts`, in the test "saves an edit that leaves a passed needed-by date as it is, and refuses a changed date that has passed", change each of the four `"2026-10-10"` to `"2026-10-12"`, and add above `await asStudent();`:

```ts
    // Needed by the 12th, so it's passed by STAFF_NOW (the 14th) but within its 3 days' grace: still open (stage L plan
    // decision 20; on the 10th its closing day would be the 14th, and the edit would find it closed).
```

```bash
perl -pi -e 's/offerStatus\((.*?)\)\)\.toEqual/offerStatus($1, TODAY)).toEqual/; s/offerStatus\(subject, TECH_CORNER\);/offerStatus(subject, TECH_CORNER, TODAY);/' lib/looking-for/subjects.test.ts
grep -c "offerStatus(" lib/looking-for/subjects.test.ts
grep -c "TODAY)" lib/looking-for/subjects.test.ts
```

Expected: `11` and `11`. Then add `const TODAY = "2026-10-14";` after `const NOW = …;` in that file.

```bash
perl -pi -e 's/getRequests\(\{ campus: ("[^"]+"), limit: (\d+) \}\)/getRequests({ campus: $1, limit: $2, today: TODAY })/g; s/getOpenRequests\(\{ category: ([^}]+?) \}\)/getOpenRequests({ category: $1, today: TODAY })/g' lib/data/index.test.ts
grep -c "today: TODAY" lib/data/index.test.ts
```

Expected: `15`. Then add, after the imports and before the first `beforeEach` in `lib/data/index.test.ts`:

```ts
/** The SAST date the request readers are asked about (stage L spec decision 10). No sample request closes itself. */
const TODAY = "2026-10-14";
```

In `components/looking-for/YourRequestsView.test.tsx` and `components/looking-for/OffersPanel.test.tsx`, in each `own` helper, after `hiddenReason…,` (the helper's last field), add:

```ts
  closedAt: null,
  closedAutomatically: false,
  closeReason: null,
  neededByPassed: false,
```

In `components/looking-for/OffersPanel.test.tsx`, change `render(<PublicOffers request={OPEN} signedIn />);` to `render(<PublicOffers request={OPEN} signedIn open />);` and `render(<PublicOffers request={CLOSED} signedIn />);` to `render(<PublicOffers request={CLOSED} signedIn open={false} />);`.

The components that now call `connection()` and read the clock (plan decision 19): in each of `components/looking-for/RequestBoard.test.tsx`, `components/home/LookingForRequests.test.tsx`, `components/looking-for/ViewerOffers.test.tsx`, `components/looking-for/Offer.test.tsx`, `components/looking-for/YourRequests.test.tsx` and `components/looking-for/DeleteRequest.test.tsx`, add after the other `vi.mock` lines:

```ts
// It reads the clock after connection() (stage L): a stand-in here, and a fixed day in the tests that post requests.
vi.mock("next/server", () => ({ connection: async () => undefined }));
```

and in the four that post requests (`ViewerOffers`, `Offer`, `YourRequests`, `DeleteRequest`), add as the first lines of their `beforeEach`:

```ts
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T08:42:00.000Z"));
```

(`RequestForm.test.tsx` already mocks `next/server` and fixes the clock.)

- [x] **Step 3: The new tests**

In `lib/data/requests.test.ts`, add `settleRequests` to the import from `./requests` (sorted), and add at the end of the file:

```ts
describe("old requests close themselves (stage L spec decisions 8 to 16)", () => {
  // Posted 5 October, needed by the 9th: its closing day is 13 October, the day before NOW.
  const EARLY = new Date("2026-10-05T08:00:00.000Z");
  const DUE: RequestFields = { ...FIELDS, neededBy: "2026-10-09" };
  const autoNotes = async () =>
    (await getNotifications("acc-student", 20)).filter((item) => item.kind === "request-update");

  it("leaves a due request out of the list readers before anything has settled it", async () => {
    const { id } = await post("acc-student", EARLY, DUE);
    expect(listedRequests(TODAY).map((request) => request.id)).not.toContain(id);
    expect(listedRequests("2026-10-12").map((request) => request.id)).toContain(id);
    expect(sampleStore().requests.get(id)?.status).toBe("open");
    expect(publicRequest(id)?.closesOn).toBe("2026-10-13");
  });

  it("stores the close once, from the closing day, and tells the asker once", async () => {
    const { id } = await post("acc-student", EARLY, DUE);
    expect(await settleRequests(NOW)).toBe(1);
    expect(sampleStore().requests.get(id)).toMatchObject({
      status: "closed",
      closedBy: "auto",
      closedAt: "2026-10-12T22:00:00.000Z",
      updatedAt: EARLY.toISOString(),
    });
    expect(await autoNotes()).toEqual([
      expect.objectContaining({
        text: "Your request Desk lamp for res closed automatically 3 days after the date you needed it by. Reopen it in Your requests if you still need it.",
        href: "/account/requests",
      }),
    ]);
    expect(await settleRequests(later(60))).toBe(0);
    expect(await autoNotes()).toHaveLength(1);
  });

  it("closes a request with no needed-by date 30 days after it last changed, and says so", async () => {
    // Posted 14 September at 10:00 in South Africa: closed from 14 October.
    const { id } = await post("acc-student", new Date("2026-09-14T08:00:00.000Z"));
    expect(await settleRequests(NOW)).toBe(1);
    expect(sampleStore().requests.get(id)?.closedAt).toBe("2026-10-13T22:00:00.000Z");
    expect((await autoNotes())[0].text).toBe(
      "Your request Desk lamp for res closed automatically after 30 days with no changes. Reopen it in Your requests if you still need it.",
    );
  });

  it("leaves the samples, hidden requests and closed ones alone", async () => {
    const hidden = await post("acc-student", EARLY, DUE);
    await hideRequest(hidden.id, "Checking it.", EARLY);
    const closed = await post("acc-student", EARLY, DUE);
    await setRequestOpen("acc-student", closed.id, false, EARLY);
    // r-001 was needed by 16 October: the samples never close themselves (decision 9).
    expect(await settleRequests(new Date("2026-12-01T08:00:00.000Z"))).toBe(0);
    expect(sampleStore().requests.get("r-001")?.status).toBe("open");
    expect(sampleStore().requests.get(hidden.id)?.status).toBe("open");
    expect(sampleStore().requests.get(closed.id)?.closedBy).toBe("asker");
    expect(await autoNotes()).toEqual([]);
  });

  it("settles before the asker's reads: the 5 open no longer count it, and Your requests says how it closed", async () => {
    await post("acc-student", EARLY, DUE);
    await post("acc-student", NOW);
    expect(await countOpenRequests("acc-student", NOW)).toBe(1);
    const own = await listOwnRequests("acc-student", NOW);
    expect(own.map((item) => [item.state, item.closedAutomatically, item.closeReason, item.neededByPassed])).toEqual([
      ["open", false, null, false],
      ["closed", true, "needed-by", true],
    ]);
    expect(own[0].request.closesOn).toBe("2026-11-13");
    expect(own[1].closedAt).toBe("2026-10-12T22:00:00.000Z");
  });

  it("reopens without a needed-by date that has passed, and says it did; keeps one still to come", async () => {
    const { id } = await post("acc-student", EARLY, DUE);
    await settleRequests(NOW);
    expect(await setRequestOpen("acc-student", id, true, NOW)).toMatchObject({
      status: "open",
      neededBy: null,
      neededByCleared: true,
      // A fresh 30 days from the reopening.
      closesOn: "2026-11-13",
    });
    expect(sampleStore().requests.get(id)).toMatchObject({ closedBy: null, closedAt: null, updatedAt: NOW.toISOString() });
    const soon = await post("acc-student", NOW, { ...FIELDS, neededBy: "2026-10-20" });
    await setRequestOpen("acc-student", soon.id, false, NOW);
    expect(sampleStore().requests.get(soon.id)?.closedBy).toBe("asker");
    expect(await setRequestOpen("acc-student", soon.id, true, later(5))).toMatchObject({
      neededBy: "2026-10-20",
      neededByCleared: false,
      closesOn: "2026-10-24",
    });
  });

  it("exports whether each request closed by itself", async () => {
    await post("acc-student", EARLY, DUE);
    await settleRequests(NOW);
    expect((await exportRequests("acc-student")).map((row) => row.closedAutomatically)).toEqual([true]);
  });
});
```

In `lib/data/index.test.ts`, add `getListedRequestIds` to the import from `./index` (sorted), and add inside the describe "Looking For data (community spec 4.3)", after its last test:

```ts
  it("leaves a request out from its closing day, settled or not, keyed on today (stage L spec decision 10)", async () => {
    const posted = await createRequest({
      askerId: "acc-student",
      fields: {
        title: "Desk lamp for res",
        categorySlug: "res-living",
        campusSlug: "mbombela",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: null,
        swapWelcome: false,
        neededBy: "2026-10-16",
      },
      now: new Date("2026-10-14T08:42:00.000Z"),
    });
    expect(ids(await getOpenRequests({ category: "res-living", today: "2026-10-19" }))).toContain(posted.id);
    expect(ids(await getOpenRequests({ category: "res-living", today: "2026-10-20" }))).not.toContain(posted.id);
    expect(ids(await getRequests({ campus: "mbombela", limit: 3, today: "2026-10-19" }))[0]).toBe(posted.id);
    expect(ids(await getRequests({ campus: "mbombela", limit: 3, today: "2026-10-20" }))).not.toContain(posted.id);
    const listed = await getListedRequestIds({ today: "2026-10-20" });
    expect(listed).not.toContain(posted.id);
    // The samples never close themselves, and the two seeded as closed stay out.
    expect(listed).toContain("r-001");
    expect(listed).not.toContain("r-015");
    // Its page stays: getRequest and getRequestIds are date-free.
    expect((await getRequest(posted.id))?.closesOn).toBe("2026-10-20");
    expect(await getRequestIds()).toContain(posted.id);
  });
```

and in the test "tags the four request readers with requests only (community actions plan decision 1)", add `() => getListedRequestIds({ today: TODAY }),` to `requestReaders`.

In `lib/looking-for/subjects.test.ts`, add inside the first describe:

```ts
  it("takes no offers on a request's closing day, settled or not (stage L spec decision 14)", async () => {
    const posted = await createRequest({ askerId: "acc-student", fields: { ...FIELDS, neededBy: "2026-10-16" }, now: NOW });
    const subject = (await offerSubject(posted.id))!;
    expect((await offerStatus(subject, TECH_CORNER, "2026-10-19")).kind).toBe("open");
    expect(await offerStatus(subject, TECH_CORNER, "2026-10-20")).toEqual({ kind: "closed" });
  });
```

In `components/looking-for/OffersPanel.test.tsx`, add inside the describe that tests `PublicOffers`:

```tsx
  it("says closed when today has closed it, though the cached request still says open (stage L spec decision 15)", () => {
    render(<PublicOffers request={OPEN} signedIn open={false} />);
    expect(screen.getByText("This request is closed")).toHaveClass("request-offers-count");
    expect(screen.queryByRole("link", { name: "Offer to help" })).toBeNull();
  });
```

In `components/looking-for/ViewerOffers.test.tsx`, add inside the describe:

```tsx
  it("works out from today whether it takes offers, and stores a due request's close (stage L spec decisions 11 and 15)", async () => {
    const { id } = await createRequest({
      askerId: "acc-student",
      fields: {
        title: "Kettle for res",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "A working kettle for my res room, please.",
        budgetZar: null,
        swapWelcome: false,
        neededBy: "2026-10-09",
      },
      now: new Date("2026-10-05T08:00:00.000Z"),
    });
    // The page's cached copy still says open: nothing has settled it yet.
    const request = publicRequest(id)!;
    expect(request.status).toBe("open");
    render(await ViewerOffers({ request }));
    expect(screen.getByText("This request is closed")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Offer to help" })).toBeNull();
    expect(publicRequest(id)?.status).toBe("closed");
  });
```

Run: `pnpm test lib/data/requests.test.ts lib/data/index.test.ts lib/looking-for components/looking-for components/home lib/data/messages.test.ts`
Expected: FAIL (typecheck-level failures show as failing imports: `settleRequests`, `getListedRequestIds`; the new arguments are ignored by the old code, so the new tests fail on their expectations).

- [x] **Step 4: `lib/data/requests.ts`**

Replace the whole of `lib/data/requests.ts` with:

```ts
import { randomUUID } from "node:crypto";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { closedAtFor, closeReasonOf, closingDay, requestOpenOn, type RequestFields } from "@/lib/looking-for/rules";
import { requestAutoClosedText } from "@/lib/looking-for/words";
import { sastDate } from "@/lib/time";
import type { LookingForRequest, OwnRequest, RequestState } from "@/lib/types";
import { deleteNotificationsAbout, notify } from "./notifications";
import { offerThreadCount } from "./offers";
import type { RequestRow } from "./rows";
import { sampleStore } from "./store";

// Looking For requests in the sample store (community actions spec 2.1, 2.6, 2.11, 2.14 and 2.23; plan decisions 1,
// 4, 6, 10 and 21). Plain functions over the store: lib/data/index.ts wraps the public reads in "use cache", tagged
// "requests"; Server Actions call the writes, then requestsChanged(). The asker is never part of what buyers see.
// Times come from the caller; only Server Actions call createRequest, which makes ids.
//
// Old requests close themselves (stage L spec decisions 8 to 16). Every reader that lists requests applies the rule by
// `today`, so it's right whether or not the close has been stored, and settleRequests(now) stores it the first time
// something request-time looks, telling the asker once. Nothing here that's called from "use cache" writes.

/** A row as part B's LookingForRequest. The offers count is the offer threads plus the sample's number (spec 2.11). */
function toRequest(row: RequestRow): LookingForRequest {
  return {
    id: row.id,
    title: row.title,
    campusSlug: row.campusSlug,
    offers: row.seedOffers + offerThreadCount(row.id),
    details: row.details,
    categorySlug: row.categorySlug,
    budgetZar: row.budgetZar,
    swapWelcome: row.swapWelcome,
    neededBy: row.neededBy,
    createdAt: row.createdAt,
    status: row.status,
    closesOn: closingDay(row),
  };
}

const notHidden = (row: RequestRow) => row.hiddenAt === null;

function stateOf(row: RequestRow): RequestState {
  return row.hiddenAt !== null ? "hidden" : row.status;
}

/**
 * The asker's own view of a row on `today`, a SAST date: where it stands, and (stage L) when and how it closed, and
 * whether reopening it would take off a needed-by date that has passed (plan decision 13).
 */
function toOwn(row: RequestRow, today: string): OwnRequest {
  const auto = row.closedBy === "auto";
  return {
    request: toRequest(row),
    state: stateOf(row),
    hiddenReason: row.hiddenReason,
    closedAt: row.closedAt,
    closedAutomatically: auto,
    closeReason: auto ? closeReasonOf(row) : null,
    neededByPassed: row.neededBy !== null && row.neededBy < today,
  };
}

/**
 * The board's, the homepage's and the sitemap's: open on `today` (a SAST date) and not hidden, in the store's order
 * (plan decision 1). A request on or past its closing day is left out whether or not it has been settled (stage L).
 */
export function listedRequests(today: string): LookingForRequest[] {
  return [...sampleStore().requests.values()]
    .filter(notHidden)
    .map(toRequest)
    .filter((request) => requestOpenOn(request, today));
}

/** A request's page: anything not hidden, open or closed (spec 2.14). */
export function publicRequest(id: string): LookingForRequest | null {
  const row = sampleStore().requests.get(id);
  return row && notHidden(row) ? toRequest(row) : null;
}

/**
 * Whether the Hub has hidden this request: its page is gone but the request is not, so an offer thread can say who took
 * it down (plan amendment 19.4). False for one that has been deleted.
 */
export function requestIsHidden(id: string): boolean {
  const row = sampleStore().requests.get(id);
  return row !== undefined && !notHidden(row);
}

/** Every request with a page, for prerendering, open or closed (stage L keeps a closed request's page). */
export function publicRequestIds(): string[] {
  return [...sampleStore().requests.values()].filter(notHidden).map((row) => row.id);
}

/**
 * Stores the close of every open, unhidden request whose closing day has come (stage L spec decisions 11, 12 and 16),
 * and tells each asker once, in the app: `status` "closed", `closedAt` the start of the closing day in SAST, `closedBy`
 * "auto", `updatedAt` as it was. Every due row is marked in one pass before anything is awaited, so two renders at once
 * can't close a request twice or tell its asker twice, and a closed row is never settled again. A hidden request
 * waits until it's shown again; a sample one never closes. It writes, so request-time code only: never inside
 * "use cache". How many it closed, so a Server Action knows to call requestsChanged().
 */
export async function settleRequests(now: Date): Promise<number> {
  const today = sastDate(now);
  const closed: RequestRow[] = [];
  for (const row of sampleStore().requests.values()) {
    if (row.status !== "open" || row.hiddenAt !== null) continue;
    const day = closingDay(row);
    if (day === null || today < day) continue;
    row.status = "closed";
    row.closedAt = closedAtFor(day);
    row.closedBy = "auto";
    closed.push(row);
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
  return closed.length;
}

/**
 * The asker's own request, or null when it isn't theirs or doesn't exist (their pages then answer 404). It settles
 * first, so a request whose closing day has come reads as closed (stage L spec decision 11).
 */
export async function getOwnRequest(askerId: string, id: string, now: Date): Promise<OwnRequest | null> {
  await settleRequests(now);
  const row = sampleStore().requests.get(id);
  return row && row.askerId === askerId ? toOwn(row, sastDate(now)) : null;
}

/** Who asked, for an offer's thread (spec 2.7): null for a sample request, which can't take offers, or one that's gone. */
export async function requestAskerId(id: string): Promise<string | null> {
  return sampleStore().requests.get(id)?.askerId ?? null;
}

const ORDER: Readonly<Record<RequestState, number>> = { open: 0, closed: 1, hidden: 2 };

/** Your requests (spec 2.13, plan decision 18): open, then closed, then hidden, each newest first. Settled first. */
export async function listOwnRequests(askerId: string, now: Date): Promise<OwnRequest[]> {
  await settleRequests(now);
  const today = sastDate(now);
  return [...sampleStore().requests.values()]
    .filter((row) => row.askerId === askerId)
    .sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || b.createdAt.localeCompare(a.createdAt))
    .map((row) => toOwn(row, today));
}

/** How many of the account's requests are open (not hidden), for the limit of 5 (spec 2.5). Settled first (stage L). */
export async function countOpenRequests(askerId: string, now: Date): Promise<number> {
  await settleRequests(now);
  return [...sampleStore().requests.values()].filter((row) => row.askerId === askerId && stateOf(row) === "open")
    .length;
}

/** How many of the account's requests made since `since` are still in the store (plan decision 4). */
export async function countRequestsSince(askerId: string, since: Date): Promise<number> {
  return [...sampleStore().requests.values()].filter(
    (row) => row.askerId === askerId && Date.parse(row.createdAt) > since.getTime(),
  ).length;
}

/** A new, open request (spec 2.3). Server Actions only: it makes ids. */
export async function createRequest({
  askerId,
  fields,
  now,
}: {
  askerId: string;
  fields: RequestFields;
  now: Date;
}): Promise<LookingForRequest> {
  const at = now.toISOString();
  const row: RequestRow = {
    id: `r-${randomUUID()}`,
    askerId,
    ...fields,
    status: "open",
    createdAt: at,
    updatedAt: at,
    closedAt: null,
    closedBy: null,
    seedOffers: 0,
    hiddenAt: null,
    hiddenReason: null,
  };
  sampleStore().requests.set(row.id, row);
  return toRequest(row);
}

/** The asker's row, when it's in `state` (spec 2.6, plan decision 6). */
function ownRow(askerId: string, id: string, state: RequestState): RequestRow | null {
  const row = sampleStore().requests.get(id);
  return row && row.askerId === askerId && stateOf(row) === state ? row : null;
}

/** Edit (spec 2.6): only while it's open. Null when it isn't the asker's open request. */
export async function updateRequest(
  askerId: string,
  id: string,
  fields: RequestFields,
  now: Date,
): Promise<LookingForRequest | null> {
  const row = ownRow(askerId, id, "open");
  if (!row) return null;
  Object.assign(row, fields, { updatedAt: now.toISOString() });
  return toRequest(row);
}

/**
 * Close (`open` false) or Reopen (`open` true) (spec 2.6). Null when there was nothing to do. Reopening starts a fresh
 * 30 days (its `updatedAt`) and takes off a needed-by date that has passed, which would close it again at the next
 * look (stage L spec decision 13); `neededByCleared` says it did, for the notice.
 */
export async function setRequestOpen(
  askerId: string,
  id: string,
  open: boolean,
  now: Date,
): Promise<(LookingForRequest & { neededByCleared: boolean }) | null> {
  const row = ownRow(askerId, id, open ? "closed" : "open");
  if (!row) return null;
  const at = now.toISOString();
  const neededByCleared = open && row.neededBy !== null && row.neededBy < sastDate(now);
  row.status = open ? "open" : "closed";
  row.closedAt = open ? null : at;
  row.closedBy = open ? null : "asker";
  row.updatedAt = at;
  if (neededByCleared) row.neededBy = null;
  return { ...toRequest(row), neededByCleared };
}

/**
 * Delete (spec 2.6), in any state: the request goes, so its page 404s, and so does the Hub's notification about it.
 * Its offer threads stay, with its title (requestTitle) and "This request was removed." False when it isn't the asker's.
 */
export async function deleteRequest(askerId: string, id: string): Promise<boolean> {
  const { requests } = sampleStore();
  const row = requests.get(id);
  if (!row || row.askerId !== askerId) return false;
  requests.delete(id);
  await deleteNotificationsAbout("request-update", new Set([id]));
  return true;
}

/** What hiding a request tells the action: its title for the log, and the asker to tell (null for a sample). */
export type HiddenRequest = { id: string; title: string; askerId: string | null };

/** The Hub's Hide the request (spec 2.14): it leaves every list and its page 404s. Null when it's gone or hidden already. */
export async function hideRequest(id: string, reason: string, now: Date): Promise<HiddenRequest | null> {
  const row = sampleStore().requests.get(id);
  if (!row || row.hiddenAt !== null) return null;
  row.hiddenAt = now.toISOString();
  row.hiddenReason = reason;
  row.updatedAt = now.toISOString();
  return { id: row.id, title: row.title, askerId: row.askerId };
}

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

/** Deleting an account (spec 2.23): its requests go. Their offer threads follow messaging's rules. */
export async function forgetRequestsOf(accountId: string): Promise<void> {
  const { requests } = sampleStore();
  for (const [id, row] of requests) {
    if (row.askerId === accountId) requests.delete(id);
  }
}

/** A request in the account's data export (plan decision 21). No ids. */
export type RequestExport = {
  title: string;
  category: string;
  campus: string;
  details: string;
  budgetZar: number | null;
  swapWelcome: boolean;
  neededBy: string | null;
  state: RequestState;
  /** The Hub's reason, when it hid it. */
  hubReason: string | null;
  postedAt: string;
  closedAt: string | null;
  /** It closed by itself rather than by its asker (stage L spec decision 14). */
  closedAutomatically: boolean;
  offers: number;
};

const categoryName = (slug: string) => categories.find((category) => category.slug === slug)?.name ?? slug;
const campusName = (slug: string) => campuses.find((campus) => campus.slug === slug)?.name ?? slug;

/** The account's requests for its data export, newest first. */
export async function exportRequests(accountId: string): Promise<RequestExport[]> {
  return [...sampleStore().requests.values()]
    .filter((row) => row.askerId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((row) => ({
      title: row.title,
      category: categoryName(row.categorySlug),
      campus: campusName(row.campusSlug),
      details: row.details,
      budgetZar: row.budgetZar,
      swapWelcome: row.swapWelcome,
      neededBy: row.neededBy,
      state: stateOf(row),
      hubReason: row.hiddenReason,
      postedAt: row.createdAt,
      closedAt: row.closedAt,
      closedAutomatically: row.closedBy === "auto",
      offers: row.seedOffers + offerThreadCount(row.id),
    }));
}
```

Before replacing it, compare the current file with the copy above apart from stage L's lines (`git --no-optional-locks diff lib/data/requests.ts` shows only Task 5's lines): if anything else differs, another session changed it; stop and report.

- [x] **Step 5: `OwnRequest`**

In `lib/types.ts`, in `OwnRequest`, after `hiddenReason: string | null;`, add:

```ts
  /** When it closed (stage L): the asker's Close, or the start of its closing day when it closed by itself. */
  closedAt: string | null;
  /** It closed by itself rather than by its asker (stage L spec decision 11). */
  closedAutomatically: boolean;
  /** Why it closed by itself: its needed-by date, or 30 days with no changes. Null otherwise. */
  closeReason: "needed-by" | "idle" | null;
  /** Its needed-by date is before the asker's today, so reopening takes it off (stage L spec decision 13). */
  neededByPassed: boolean;
```

- [x] **Step 6: The dated readers**

In `lib/data/index.ts`, replace `getRequests` and `getOpenRequests` with:

```ts
/**
 * The homepage's open requests (spec 7.11): newest first, the visitor's campus first (community spec 4.3). `today` is
 * the SAST date: a request leaves on its closing day, settled or not (stage L spec decision 10). The cache keys on
 * it, so the entry turns over at SAST midnight.
 */
export async function getRequests({
  campus,
  limit,
  today,
}: CampusQuery & { today: string }): Promise<readonly LookingForRequest[]> {
  "use cache";
  tagRequests();
  return campusFirst(listedRequests(today).sort(newestFirst), campus, limit);
}

/**
 * The Looking For board (community spec 4.1): requests open on `today`, newest first, in one category or in all of
 * them (stage L spec decision 10).
 */
export async function getOpenRequests({
  category,
  today,
}: {
  category: string | null;
  today: string;
}): Promise<readonly LookingForRequest[]> {
  "use cache";
  tagRequests();
  return listedRequests(today)
    .filter((request) => category === null || request.categorySlug === category)
    .sort(newestFirst);
}
```

and after `getRequestIds`, add:

```ts
/**
 * The requests the sitemap offers crawlers: open on `today` (stage L spec decision 19). Their pages stay up and
 * prerendered either way (getRequestIds).
 */
export async function getListedRequestIds({ today }: { today: string }): Promise<readonly string[]> {
  "use cache";
  tagRequests();
  return listedRequests(today).map((request) => request.id);
}
```

- [x] **Step 7: Offers**

In `lib/looking-for/subjects.ts`:
- after `import type { Account, LookingForRequest } from "@/lib/types";`, add `import { requestOpenOn } from "./rules";`;
- change the `offerStatus` signature to:

```ts
export async function offerStatus(
  subject: OfferSubject,
  account: Pick<Account, "id" | "seller">,
  today: string,
): Promise<OfferStatus> {
```

- add to its comment: ` \`today\` is the SAST date: a request on its closing day takes no offers, settled or not (stage L spec decision 14).`;
- change `if (request.status !== "open") return { kind: "closed" };` to `if (!requestOpenOn(request, today)) return { kind: "closed" };`.

In `lib/looking-for/actions.ts` (passing the clock only; Task 7 adds the settling):
- in `saveMyRequest`, change `const own = await getOwnRequest(account.id, editing);` to `const own = await getOwnRequest(account.id, editing, now);` and `if ((await countOpenRequests(account.id)) >= OPEN_REQUESTS_MAX) errors.push("open-limit");` to `if ((await countOpenRequests(account.id, now)) >= OPEN_REQUESTS_MAX) errors.push("open-limit");`;
- in `changeOpen`, change `(await getOwnRequest(account.id, id))?.state` to `(await getOwnRequest(account.id, id, now))?.state` and `(await countOpenRequests(account.id))` to `(await countOpenRequests(account.id, now))`;
- in `sendOffer`, move `const now = new Date();` up to just after `const account = await requireAccount(path);`, and change `const status = await offerStatus(subject, account);` to `const status = await offerStatus(subject, account, sastDate(now));` (`sastDate` is already imported).

- [x] **Step 8: The callers**

`components/looking-for/RequestBoard.tsx`:
- add `import { connection } from "next/server";` after `import type { ReactNode } from "react";`, `import { settleRequests } from "@/lib/data/requests";` after the `@/lib/data` import, and `import { sastDate } from "@/lib/time";` after the `@/lib/requests` import;
- replace `const requests = await getOpenRequests({ category }).catch(() => null);` with:

```tsx
  // A request leaves the board on its closing day, and the first look after it stores the close and tells its asker
  // (stage L spec decisions 10 and 11). Both read the clock; this part renders per request already.
  await connection();
  const now = new Date();
  const requests = await settleRequests(now)
    .then(() => getOpenRequests({ category, today: sastDate(now) }))
    .catch(() => null);
```

`components/home/LookingForRequests.tsx`:
- add `import { connection } from "next/server";` after `import Link from "next/link";`, `import { settleRequests } from "@/lib/data/requests";` after the `@/lib/data` import, and `import { sastDate } from "@/lib/time";` after the `@/lib/format` import;
- replace `const data = await Promise.all([getRequests({ campus, limit: 3 }), getCampuses()]).catch(() => null);` with:

```tsx
  // The board's rule (stage L spec decisions 10 and 11). The section renders per request already: it reads the campus
  // cookie, so connection() moves nothing out of the homepage's static shell.
  await connection();
  const now = new Date();
  const data = await settleRequests(now)
    .then(() => Promise.all([getRequests({ campus, limit: 3, today: sastDate(now) }), getCampuses()]))
    .catch(() => null);
```

`components/looking-for/OffersViews.tsx`:
- change `PublicOffers`' signature to `export function PublicOffers({ request, signedIn, open }: { request: LookingForRequest; signedIn: boolean; open: boolean }) {`, add to its comment ` \`open\`: whether it takes offers today. The static shell passes the cached status; the session's part works it out by date, so on a closing day Offer to help gives way to "This request is closed" as the page finishes (stage L spec decision 15).`, and change `if (request.status !== "open") return …` to `if (!open) return <p className="request-offers-count">This request is closed</p>;`.

`components/looking-for/OffersPanel.tsx`: change the fallback to `<PublicOffers request={request} signedIn={false} open={request.status === "open"} />`.

`components/looking-for/ViewerOffers.tsx`, whole new file:

```tsx
import { connection } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { offersForRequest } from "@/lib/data/offers";
import { getOwnRequest, settleRequests } from "@/lib/data/requests";
import { takeNote } from "@/lib/looking-for/form-state";
import { requestNoteKey } from "@/lib/looking-for/paths";
import { requestOpenOn } from "@/lib/looking-for/rules";
import { requestNoticeText } from "@/lib/looking-for/words";
import { sastDate } from "@/lib/time";
import type { LookingForRequest } from "@/lib/types";
import { AskerOffers, PublicOffers } from "./OffersViews";

/**
 * The offers panel once the session is read (community actions plan decision 19): the asker's panel for the asker,
 * the public one for everyone else. An async Server Component: OffersPanel puts it inside <Suspense>. A failed
 * session read gives the signed-out panel, which still works. Whether the request takes offers is worked out from
 * today, since the page's cached copy may still say open on its closing day, and a due request's close is stored here
 * (stage L spec decisions 11 and 15).
 */
export async function ViewerOffers({ request }: { request: LookingForRequest }) {
  await connection();
  const now = new Date();
  await settleRequests(now);
  const open = requestOpenOn(request, sastDate(now));
  const account = await getViewer().catch(() => null);
  if (!account) return <PublicOffers request={request} signedIn={false} open={open} />;
  const own = await getOwnRequest(account.id, request.id, now);
  if (!own) return <PublicOffers request={request} signedIn open={open} />;
  const [offers, note] = await Promise.all([offersForRequest(request.id), takeNote(requestNoteKey(request.id))]);
  return <AskerOffers own={own} offers={offers} notice={requestNoticeText(note?.notice)} />;
}
```

(Compare with HEAD's file first: only the clock, the settle, `open` and `getOwnRequest`'s `now` are new.)

`components/looking-for/Offer.tsx`:
- add `import { connection } from "next/server";` after the `next/navigation` import, `import { settleRequests } from "@/lib/data/requests";` after the `@/lib/auth/session` import, and `import { sastDate } from "@/lib/time";` after the `@/lib/looking-for/subjects` import;
- replace the body of `Offer` with:

```tsx
  // Whether the request still takes offers reads the clock, and a due request's close is stored (stage L spec
  // decisions 11 and 14).
  await connection();
  const now = new Date();
  await settleRequests(now);
  const subject = await offerSubject(requestId);
  if (!subject) notFound();
  const account = await requireAccount(offerPath(requestId));
  const [status, state] = await Promise.all([
    offerStatus(subject, account, sastDate(now)),
    readFormState(offerFormKey(requestId)),
  ]);
  return <OfferView subject={subject} status={status} form={offerForm(state, offerFieldPrefix(requestId))} />;
```

`components/looking-for/YourRequests.tsx`:
- add `import { connection } from "next/server";` as the first import;
- replace `const [items, note] = await Promise.all([listOwnRequests(account.id), takeNote(YOUR_REQUESTS_FORM)]);` with:

```tsx
  // The list settles first, so a request whose closing day has come shows as closed (stage L spec decision 11).
  await connection();
  const [items, note] = await Promise.all([listOwnRequests(account.id, new Date()), takeNote(YOUR_REQUESTS_FORM)]);
```

`components/looking-for/RequestForm.tsx`: replace the body of `RequestForm` from `const own = requestId ? …` down to `const today = sastDate(new Date());` with:

```tsx
  // The date's first and last days, the token and whether the request has closed itself all read the clock (decision
  // 26; stage L spec decision 11), so connection() comes before the request is read.
  await connection();
  const now = new Date();
  const own = requestId ? await getOwnRequest(account.id, requestId, now) : null;
  if (requestId && !own) notFound();
  if (own && own.state !== "open") {
    return <RequestLocked requestId={own.request.id} title={own.request.title} state={own.state} />;
  }
  const today = sastDate(now);
```

(Task 8 adds the reopen hint's prop to `RequestLocked` here.)

`components/looking-for/DeleteRequest.tsx`:
- add `import { connection } from "next/server";` after the `next/navigation` import;
- replace `const own = await getOwnRequest(account.id, requestId);` with:

```tsx
  // Reading the asker's own request settles first, which reads the clock (stage L spec decision 11).
  await connection();
  const own = await getOwnRequest(account.id, requestId, new Date());
```

Run: `pnpm test lib/data lib/looking-for components/looking-for components/home app/sitemap.test.ts`
Expected: PASS. (`app/sitemap.test.ts` still reads `getRequestIds` and `getHubPostIds`: Task 10 changes it.)

Run: `pnpm lint lib/data lib/looking-for lib/types.ts components/looking-for components/home`
Expected: no output.

- [x] **Step 9: The whole unit suite, typecheck and lint in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-l-task6"` with every uncommitted file of this stage. From `$S`: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
Expected: no errors; every unit test passing (rerun alone any that timed out under load). If `pnpm typecheck` names another caller of a changed signature, update it the same way and list it in the hand-over.

- [x] **Step 10: Hand over**

Files: every file in this task's list. Message:

```
feat: old Looking For requests close themselves (stage L spec decisions 10 to 16): the board, the homepage and the sitemap's reader apply the rule by today inside "use cache", so a request leaves at SAST midnight settled or not; settleRequests(now) stores the close (closedBy auto, closedAt the closing day's start) and tells the asker once, from request-time code only, and never a sample or a hidden request; the asker's reads take now and settle first; reopening takes off a passed needed-by date and starts a fresh 30 days; offers and the request page's panel go by today's date; the data download says which closed by themselves. One test's needed-by date moves from 10 to 12 October (plan decision 20). Unit: <count>
```

---

### Task 7: The Looking For and request staff actions settle, refuse and reopen

Spec 2.11, 2.13 to 2.16 and section 4 "Tests" (the actions), with plan decision 16. Server only.

**Files:**
- Modify: `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts`
- Modify: `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short lib/looking-for/actions.ts lib/looking-for/actions.test.ts lib/staff/admin-actions.ts lib/staff/admin-actions.test.ts`
Expected: only this stage's uncommitted changes, if any.

- [x] **Step 2: The tests**

In `lib/looking-for/actions.test.ts`, add `import { getNotifications } from "@/lib/data/notifications";` after the `@/lib/data/messages` import, and add at the end:

```ts
describe("old requests close themselves in every Looking For action (stage L spec decisions 11 to 15)", () => {
  // Posted 5 October, needed by the 9th: its closing day is 13 October, the day before STAFF_NOW.
  const due = () =>
    createRequest({
      askerId: "acc-student",
      fields: { ...FIELDS, title: "Kettle for res", neededBy: "2026-10-09" },
      now: new Date("2026-10-05T08:00:00.000Z"),
    });
  const closedItself = (id: string) => sampleStore().requests.get(id)?.closedBy === "auto";

  it("expires the board when it stored a close, even when the press itself changes nothing", async () => {
    await asStudent();
    const old = await due();
    const theirs = await posted("acc-mentor");
    await redirectOf(() => closeMyRequest(form({ request: theirs.id })));
    expect(closedItself(old.id)).toBe(true);
    expect(request.updatedTags).toEqual(["requests"]);
    const told = (await getNotifications("acc-student", 20)).filter((item) => item.kind === "request-update");
    expect(told).toHaveLength(1);
  });

  it("lets a post through when one of the 5 open requests has just come due", async () => {
    await asStudent();
    const old = await due();
    for (let n = 0; n < 4; n += 1) await posted();
    expect((await send()).url).toMatch(/^\/looking-for\/r-[0-9a-f-]{36}$/);
    expect(closedItself(old.id)).toBe(true);
  });

  it("refuses an offer on a due request, back to the composer that says it's closed, and stores the close", async () => {
    const old = await due();
    await signedInAs(request, "acc-seller");
    expect(await redirectOf(() => sendOffer(form({ request: old.id, body: "I have a kettle, R100." })))).toBe(
      `/looking-for/${old.id}/offer`,
    );
    expect(closedItself(old.id)).toBe(true);
    expect([...sampleStore().conversations.values()].some((row) => row.requestId === old.id)).toBe(false);
    expect(request.updatedTags).toEqual(["requests"]);
  });

  it("reopens without a needed-by date that has passed, and says so", async () => {
    await asStudent();
    const old = await due();
    expect(await redirectOf(() => reopenMyRequest(form({ request: old.id, from: "list" })))).toBe("/account/requests");
    expect(sampleStore().requests.get(old.id)).toMatchObject({ status: "open", neededBy: null, closedBy: null });
    expect(await readFormState(YOUR_REQUESTS_FORM)).toMatchObject({ notice: "reopened-date-cleared" });
  });

  it("settles before deleting, so the asker's other due request is closed and the board expires", async () => {
    await asStudent();
    const old = await due();
    const other = await posted();
    await redirectOf(() => deleteMyRequest(form({ request: other.id })));
    expect(closedItself(old.id)).toBe(true);
  });
});
```

(`createRequest`, `sampleStore`, `FIELDS`, `posted`, `send`, `asStudent`, `readFormState`, `YOUR_REQUESTS_FORM`, `signedInAs`, `redirectOf` and the five actions are already imported or declared in the file.)

In `lib/staff/admin-actions.test.ts`, inside the stage L section (after the own-shop describe), add:

```ts
describe("the two request actions settle first (stage L spec decision 11)", () => {
  const dueRequest = () =>
    createRequest({
      askerId: "acc-student",
      fields: { ...SIPHOS_FIELDS, neededBy: "2026-10-09" },
      now: new Date("2026-10-05T08:00:00.000Z"),
    });

  it("Show again stores a due request's close, and expires the board", async () => {
    const due = await dueRequest();
    Object.assign(sampleStore().requests.get("r-002")!, { hiddenAt: STAFF_NOW.toISOString(), hiddenReason: REASON });
    await asAdmin();
    await redirectOf(() => showRequestAgain(form({ request: "r-002" })));
    expect(sampleStore().requests.get(due.id)).toMatchObject({ status: "closed", closedBy: "auto" });
    expect(request.updatedTags).toEqual(["requests", "requests"]);
  });

  it("Hide the request closes a due request before hiding it, so its asker hears both", async () => {
    const due = await dueRequest();
    const reportId = await report("acc-mentor", { kind: "request", id: due.id }, due.title);
    await asAdmin();
    await redirectOf(() => hideReportedRequest(form({ report: reportId, reason: REASON })));
    expect(sampleStore().requests.get(due.id)).toMatchObject({ status: "closed", closedBy: "auto" });
    expect(sampleStore().requests.get(due.id)?.hiddenAt).not.toBeNull();
    const told = (await getNotifications("acc-student", 20)).filter((item) => item.kind === "request-update");
    expect(told).toHaveLength(2);
  });
});
```

Run: `pnpm test lib/looking-for/actions.test.ts lib/staff/admin-actions.test.ts`
Expected: FAIL. Without the actions settling: the press that changes nothing expires no tag and stores no close; the offer is refused (Task 6's `offerStatus`) but nothing is stored; Reopen leaves "reopened", not "reopened-date-cleared"; the staff actions store nothing. ("lets a post through" passes already: `countOpenRequests` settles since Task 6.)

- [x] **Step 3: The Looking For actions**

In `lib/looking-for/actions.ts`:
- add `settleRequests` to the import from `@/lib/data/requests` (sorted: after `setRequestOpen`);
- add to the module comment: `// Every action stores the close of any request whose closing day has come first, and expires "requests" when one closed (stage L spec decision 11).`;
- after `leaveNote`, add:

```ts
/**
 * Stores the close of any request whose closing day has come, first thing after the session (stage L spec decision
 * 11), and expires the board's and the homepage's cache when one closed.
 */
async function settle(now: Date): Promise<void> {
  if ((await settleRequests(now)) > 0) requestsChanged();
}
```

- **`saveMyRequest`**: after `const now = new Date();`, add `await settle(now);`;
- **`changeOpen`**: replace from `if (!id) done(YOUR_REQUESTS_PATH);` to the end of the function with:

```ts
  if (!id) done(YOUR_REQUESTS_PATH);
  const now = new Date();
  await settle(now);
  const note = landing === YOUR_REQUESTS_PATH ? YOUR_REQUESTS_FORM : requestNoteKey(id);
  if (open && (await getOwnRequest(account.id, id, now))?.state === "closed") {
    if ((await countOpenRequests(account.id, now)) >= OPEN_REQUESTS_MAX) {
      await leaveNote(note, "reopen-limit", now);
      done(landing);
    }
  }
  const changed = await setRequestOpen(account.id, id, open, now);
  if (changed) {
    requestsChanged();
    // Reopening took off a needed-by date that had passed (stage L spec decision 13): the notice says so.
    await leaveNote(note, open ? (changed.neededByCleared ? "reopened-date-cleared" : "reopened") : "closed", now);
  }
  done(landing);
}
```

- **`deleteMyRequest`**: replace its body after `const account = …;` with:

```ts
  const now = new Date();
  await settle(now);
  if (id && (await deleteRequest(account.id, id))) {
    requestsChanged();
    await leaveNote(YOUR_REQUESTS_FORM, "deleted", now);
  }
  done(YOUR_REQUESTS_PATH);
```

- **`sendOffer`**: after `const now = new Date();` (moved up in Task 6), add `await settle(now);`, so it comes before `offerSubject`;
- add to `sendOffer`'s comment: ` A request on its closing day takes no offers, settled or not (stage L spec decision 14).`.

- [x] **Step 4: The two staff request actions**

In `lib/staff/admin-actions.ts`:
- change `import { hideRequest, showRequest } from "@/lib/data/requests";` to `import { hideRequest, settleRequests, showRequest } from "@/lib/data/requests";`;
- in **`hideReportedRequest`** and **`showRequestAgain`**, add right after `const now = new Date();`:

```ts
  // Old requests close themselves first, so a due one is closed before it's hidden or shown (stage L spec decision 11).
  if ((await settleRequests(now)) > 0) requestsChanged();
```

Run: `pnpm test lib/looking-for/actions.test.ts lib/staff/admin-actions.test.ts`
Expected: PASS, the own-shop cases included (their fresh requests aren't due, so nothing settles and no tag is expired).

Run: `pnpm lint lib/looking-for/actions.ts lib/looking-for/actions.test.ts lib/staff/admin-actions.ts lib/staff/admin-actions.test.ts`
Expected: no output.

- [x] **Step 5: Hand over**

Files: `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts`, `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`. Message:

```
feat: every Looking For action and the Hub's hide and show of a request store any due request's close first, and expire requests when one closed (stage L spec decision 11): a post counts the 5 open after the close, an offer on a request past its closing day goes back to the composer that says it's closed, and Reopen says when it took off a needed-by date that had passed (spec decision 13). Unit: <count>
```

---

### Task 8: The asker's lines, the reopen hint and the form's hint

Spec section 4 "Behaviour", "Words" and "Accessibility", with plan decision 18. Server Components only.

**Files:**
- Create: `components/looking-for/AutoCloseLine.tsx`
- Modify: `components/looking-for/YourRequestsView.tsx`, `components/looking-for/YourRequestsView.test.tsx`
- Modify: `components/looking-for/OffersViews.tsx`, `components/looking-for/OffersPanel.test.tsx`
- Modify: `components/looking-for/RequestActions.tsx`
- Modify: `components/looking-for/RequestFormView.tsx`, `components/looking-for/RequestFormView.test.tsx`
- Modify: `components/looking-for/RequestForm.tsx`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short components/looking-for`
Expected: only this stage's uncommitted changes, if any.

- [x] **Step 2: The tests**

In `components/looking-for/YourRequestsView.test.tsx`, add at the end:

```tsx
describe("requests that close themselves (stage L spec section 4)", () => {
  const open = own("r-e", "Clip-on lamp", "open");
  const OPEN_UNTIL = { ...open, request: { ...open.request, closesOn: "2026-11-13" } };
  const AUTO = {
    ...own("r-d", "Kettle for res", "closed"),
    closedAt: "2026-10-19T22:00:00.000Z",
    closedAutomatically: true,
    closeReason: "needed-by" as const,
    neededByPassed: true,
  };
  const IDLE = {
    ...own("r-f", "Desk chair", "closed"),
    closedAt: "2026-11-11T22:00:00.000Z",
    closedAutomatically: true,
    closeReason: "idle" as const,
  };

  it("says when an open request will close, and when and why a closed one closed itself, with dates in <time>", () => {
    render(<YourRequestsView items={[OPEN_UNTIL, AUTO, IDLE]} notice={null} />);
    const [first, second, third] = screen.getAllByRole("listitem");
    expect(first).toHaveTextContent("Closes automatically on 13 Nov.");
    expect(first.querySelector('time[datetime="2026-11-13"]')).not.toBeNull();
    expect(second).toHaveTextContent("Closed automatically on 20 Oct, 3 days after the date you needed it by.");
    expect(second.querySelector('time[datetime="2026-10-19T22:00:00.000Z"]')).not.toBeNull();
    expect(third).toHaveTextContent("Closed automatically on 12 Nov, after 30 days with no changes.");
  });

  it("ties a hint to Reopen when reopening takes off a passed needed-by date, and only then", () => {
    render(<YourRequestsView items={[AUTO, IDLE]} notice={null} />);
    expect(screen.getByRole("button", { name: "Reopen Kettle for res" })).toHaveAccessibleDescription(
      "Reopening removes the needed-by date, which has passed.",
    );
    expect(screen.getByRole("button", { name: "Reopen Desk chair" })).not.toHaveAccessibleDescription();
  });

  it("says nothing of closing for a request its asker closed", () => {
    render(<YourRequestsView items={[own("r-b", "Kettle for res", "closed")]} notice={null} />);
    expect(screen.queryByText(/automatically/)).toBeNull();
  });
});
```

In `components/looking-for/OffersPanel.test.tsx`, add inside the describe "the asker's panel (community actions spec 2.13, plan decision 19)":

```tsx
  it("tells the asker when the request will close, or that it closed itself and why (stage L spec section 4)", () => {
    const open = own("open");
    const { unmount } = render(
      <AskerOffers own={{ ...open, request: { ...open.request, closesOn: "2026-11-13" } }} offers={[]} notice={null} />,
    );
    expect(screen.getByText(/^Closes automatically on/)).toHaveTextContent("Closes automatically on 13 Nov.");
    unmount();
    render(
      <AskerOffers
        own={{
          ...own("closed"),
          closedAt: "2026-11-11T22:00:00.000Z",
          closedAutomatically: true,
          closeReason: "idle",
          neededByPassed: false,
        }}
        offers={[]}
        notice={null}
      />,
    );
    expect(screen.getByText("This request is closed")).toBeInTheDocument();
    expect(screen.getByText(/^Closed automatically on/)).toHaveTextContent(
      "Closed automatically on 12 Nov, after 30 days with no changes.",
    );
    expect(screen.getByRole("button", { name: "Reopen Desk lamp for res" })).not.toHaveAccessibleDescription();
  });
```

In `components/looking-for/RequestFormView.test.tsx`, add inside the first describe:

```tsx
  it("says under Needed by how a request closes itself (stage L spec section 4)", () => {
    render(
      <RequestFormView
        requestId={null}
        once={TOKEN}
        form={{ values: EMPTY, errors: [] }}
        campuses={campuses}
        categories={categories}
        today={TODAY}
      />,
    );
    expect(screen.getByLabelText("Needed by (optional)")).toHaveAccessibleDescription(
      "Today or within 90 days, as year, month and day, like 2026-10-21. Your request closes automatically 3 days after this date. Without one, it closes after 30 days with no changes.",
    );
  });

  it("warns on a closed request's edit page that reopening takes off a passed needed-by date (plan decision 18)", () => {
    const { unmount } = render(<RequestLocked requestId="r-abc" title="Kettle for res" state="closed" reopenClearsDate />);
    expect(screen.getByRole("button", { name: "Reopen Kettle for res" })).toHaveAccessibleDescription(
      "Reopening removes the needed-by date, which has passed.",
    );
    unmount();
    render(<RequestLocked requestId="r-abc" title="Kettle for res" state="closed" />);
    expect(screen.getByRole("button", { name: "Reopen Kettle for res" })).not.toHaveAccessibleDescription();
  });
```

Run: `pnpm test components/looking-for`
Expected: FAIL (no lines, hints or `reopenClearsDate`).

- [x] **Step 3: The line**

Create `components/looking-for/AutoCloseLine.tsx`:

```tsx
import { dayMonth } from "@/lib/format";
import { AUTO_CLOSE_WHY } from "@/lib/looking-for/words";
import { shortSastDate } from "@/lib/time";
import type { OwnRequest } from "@/lib/types";

/**
 * For the asker only (stage L spec section 4): when their open request closes by itself, or that a closed one did,
 * when, and why, in the style of the line it sits under (`className`). Nothing for a request its asker closed, a
 * hidden one, or one with no closing day. The words are samples for Lama to change.
 */
export function AutoCloseLine({ own, className }: { own: OwnRequest; className: string }) {
  const { request, state } = own;
  if (state === "open" && request.closesOn) {
    return (
      <p className={className}>
        Closes automatically on <time dateTime={request.closesOn}>{dayMonth(request.closesOn)}</time>.
      </p>
    );
  }
  if (state === "closed" && own.closedAutomatically && own.closedAt && own.closeReason) {
    return (
      <p className={className}>
        Closed automatically on <time dateTime={own.closedAt}>{shortSastDate(own.closedAt)}</time>,{" "}
        {AUTO_CLOSE_WHY[own.closeReason]}.
      </p>
    );
  }
  return null;
}
```

- [x] **Step 4: Your requests, the asker's panel, and Reopen's hint**

In `components/looking-for/YourRequestsView.tsx`:
- add `import { AutoCloseLine } from "./AutoCloseLine";` before `import { RequestActions } from "./RequestActions";`;
- after the `</p>` that closes `<p className="requests-item-meta">…</p>`, add:

```tsx
                  <AutoCloseLine own={own} className="requests-item-meta" />
```

In `components/looking-for/OffersViews.tsx`:
- add `import { AutoCloseLine } from "./AutoCloseLine";` before `import { RequestActions } from "./RequestActions";`;
- in `AskerOffers`, after `{state === "closed" && <p className="request-offers-state">This request is closed</p>}`, add:

```tsx
      <AutoCloseLine own={own} className="request-offers-state" />
```

In `components/looking-for/RequestActions.tsx`:
- add `import { REOPEN_CLEARS_DATE_HINT } from "@/lib/looking-for/words";` after the `@/lib/looking-for/paths` import;
- add to the component's comment: ` When reopening would take off a needed-by date that has passed, a hint says so, tied to Reopen (stage L spec decision 13).`;
- after `const { request, state } = own;`, add:

```tsx
  const reopenHint = state === "closed" && own.neededByPassed ? `reopen-hint-${from}-${request.id}` : undefined;
```

- change the Reopen button's opening tag to `<button type="submit" className="btn btn-outline text-navy" aria-describedby={reopenHint}>`;
- wrap the returned `<div className="requests-actions">…</div>` in a fragment and add after it:

```tsx
      {reopenHint && (
        <p id={reopenHint} className="form-hint">
          {REOPEN_CLEARS_DATE_HINT}
        </p>
      )}
```

- [x] **Step 5: The request form and the closed request's edit page**

In `components/looking-for/RequestFormView.tsx`:
- add `import { CLOSES_BY_ITSELF_HINT, REOPEN_CLEARS_DATE_HINT } from "@/lib/looking-for/words";` after the `@/lib/looking-for/rules` import;
- change the needed-by hint's text to:

```tsx
            {`Today or within ${NEEDED_BY_DAYS} days, as year, month and day, like ${addDays(today, 7)}. ${CLOSES_BY_ITSELF_HINT}`}
```

- change `type RequestLockedProps = { requestId: string; title: string; state: "closed" | "hidden" };` to:

```tsx
type RequestLockedProps = {
  requestId: string;
  title: string;
  state: "closed" | "hidden";
  /** Reopening takes off a needed-by date that has passed: a hint says so, tied to Reopen (plan decision 18). */
  reopenClearsDate?: boolean;
};
```

- change `export function RequestLocked({ requestId, title, state }: RequestLockedProps) {` to `export function RequestLocked({ requestId, title, state, reopenClearsDate = false }: RequestLockedProps) {`, and add after its `const back = …;`:

```tsx
  const hintId = reopenClearsDate ? `reopen-hint-locked-${requestId}` : undefined;
```

- change its Reopen button's opening tag to `<button type="submit" className="btn btn-outline text-navy" aria-describedby={hintId}>`, and after that `</form>` add:

```tsx
          {hintId && (
            <p id={hintId} className="form-hint">
              {REOPEN_CLEARS_DATE_HINT}
            </p>
          )}
```

In `components/looking-for/RequestForm.tsx`, change `return <RequestLocked requestId={own.request.id} title={own.request.title} state={own.state} />;` to:

```tsx
    return (
      <RequestLocked
        requestId={own.request.id}
        title={own.request.title}
        state={own.state}
        reopenClearsDate={own.neededByPassed}
      />
    );
```

Run: `pnpm test components/looking-for`
Expected: PASS.

Run: `pnpm lint components/looking-for`
Expected: no output.

- [x] **Step 6: Hand over**

Files: `components/looking-for/AutoCloseLine.tsx`, `components/looking-for/YourRequestsView.tsx`, `components/looking-for/YourRequestsView.test.tsx`, `components/looking-for/OffersViews.tsx`, `components/looking-for/OffersPanel.test.tsx`, `components/looking-for/RequestActions.tsx`, `components/looking-for/RequestFormView.tsx`, `components/looking-for/RequestFormView.test.tsx`, `components/looking-for/RequestForm.tsx`. Message:

```
feat: the asker sees when a request closes itself (stage L spec section 4): Your requests and the request page's panel say "Closes automatically on" its date, or when and why it closed itself; Reopen carries a hint, tied by aria-describedby, when reopening takes off a passed needed-by date, on the closed request's edit page too (plan decision 18); the form's needed-by hint says how requests close. Dates in <time>, existing classes only. JS: none. Unit: <count>
```

---

### Task 9: The info pages, then the build and size check for items 1 and 2

Spec section 4 "Words" (How it works, the privacy policy) with plan decisions 23 and 24; spec section 9's check after item 2.

**Files:**
- Modify: `app/how-it-works/page.tsx`, `app/how-it-works/page.test.tsx`
- Modify: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short app/how-it-works app/privacy`
Expected: no output. (`app/privacy/page.test.tsx` collects cookie names; nothing here adds one.)

- [x] **Step 2: The tests**

In `app/how-it-works/page.test.tsx`, in the test "answers six short questions, including what works today", add before its closing `});`:

```tsx
    // Stage L: requests close themselves, and can be reopened (spec section 4, Words).
    expect(
      within(questions).getByText(
        "Requests close automatically 3 days after their needed-by date, or after 30 days with no changes. You can reopen one.",
      ),
    ).toBeInTheDocument();
```

In `app/privacy/page.test.tsx`, add inside the last describe that has the "lists every kind of notification" test, after that test:

```tsx
  it("says requests close themselves, that you're told, and that you can reopen one (stage L spec section 4)", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(account).toHaveTextContent(/the Hub acts on your report, your shop, your listing or your request, your request closes automatically, a mentor answers/);
    expect(account).toHaveTextContent(
      "An open request closes automatically 3 days after its needed-by date, or after 30 days with no changes; you're told, and you can reopen it.",
    );
  });
```

Run: `pnpm test app/how-it-works app/privacy`
Expected: FAIL (the sentences aren't there).

- [x] **Step 3: The words**

In `app/how-it-works/page.tsx`, after the paragraph that ends `…and set up a shop of your own.` (the first answer to "What can I do on Vossie today?"), add:

```tsx
        <p>
          Requests close automatically 3 days after their needed-by date, or after 30 days with no changes. You can
          reopen one.
        </p>
```

In `app/privacy/page.tsx`:
- in "Your notifications.", change `match, the Hub acts on your report, your shop, your listing or your request, a mentor answers your slot` to `match, the Hub acts on your report, your shop, your listing or your request, your request closes automatically, a mentor answers your slot` (rewrap the lines at about 120 characters, keeping the words);
- in "Your Looking For requests.", after `delete it. Allowed under POPIA section 11: needed to run the service you ask for.`, add ` An open request closes automatically 3 days after its needed-by date, or after 30 days with no changes; you&apos;re told, and you can reopen it.` (rewrap as above).

On both pages, if the day you build this isn't 2026-10-20 in SAST, set `updated` to that day (plan decision 24).

Run: `pnpm test app/how-it-works app/privacy`
Expected: PASS, every existing test in both files included.

Run: `pnpm lint app/how-it-works app/privacy`
Expected: no output.

- [x] **Step 4: Build and size check (items 1 and 2), in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-l-task9"` with every uncommitted file of this stage. From `$S`:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build 2>&1 | tee "$S/build.log" | tail -60
grep -n "new Date()\|Math.random\|uncached data\|Route .* used" "$S/build.log"
grep -l "serviceWorker.register" .next/static/chunks/*.js
```

Expected:
- types and lint clean; every unit test passing (record the count);
- the build succeeds, with the same route list as stage K's (no route changes kind before Task 10, which makes `/sitemap.xml` per request);
- the first `grep` prints nothing (no clock warning: every new clock read is after `connection()` inside an existing `<Suspense>`, or in a Server Action);
- the second `grep` prints nothing (CLAUDE.md).

Then run e2e as the conventions say, with:

```bash
E2E_REUSE_SERVER=1 pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 --workers=2
E2E_REUSE_SERVER=1 pnpm e2e tests/e2e/community.spec.ts tests/e2e/community-actions.spec.ts tests/e2e/home.spec.ts tests/e2e/cls.spec.ts tests/e2e/info.spec.ts tests/e2e/staff.spec.ts --project=phone-390 --project=desktop-1440 --workers=2
```

Expected: every `scriptBrotli` equal to the ledger's Start row, to the byte (fill in the Task 9 row in your report); the device runs pass. Any byte that moved stops the build: report it before going on. Stop your server by its PID.

- [x] **Step 5: Hand over**

Files: `app/how-it-works/page.tsx`, `app/how-it-works/page.test.tsx`, `app/privacy/page.tsx`, `app/privacy/page.test.tsx`. Message:

```
docs: How it works and the privacy policy say requests close themselves 3 days after their needed-by date or after 30 days with no changes, that the asker is told, and that one can be reopened (stage L spec section 4). JS: every page the same to the byte. Unit: <count>
```

---

### Task 10: The sitemap lists only what's worth crawling today

Spec 2.19 and section 5, with plan decision 25.

**Files:**
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`
- Modify: `app/sitemap.ts`, `app/sitemap.test.ts`

- [x] **Step 1: Check the files are yours to edit, and read the docs**

Run: `git --no-optional-locks status --short lib/data/index.ts lib/data/index.test.ts app/sitemap.ts app/sitemap.test.ts`
Expected: only Task 6's uncommitted changes to the two `lib/data` files, if any.

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md` (a sitemap that uses a Request-time API is generated per request) and `03-api-reference/04-functions/connection.md`.

- [x] **Step 2: The tests**

In `lib/data/index.test.ts`, add `getListedHubPostIds` to the import from `./index` (sorted), and add inside the describe "Hub data (community spec 5.3)":

```ts
  it("lists the posts worth crawling on a day: tips, and events and office hours from that day on (stage L spec 2.19)", async () => {
    const onThe20th = await getListedHubPostIds({ today: "2026-10-20" });
    expect(onThe20th).toContain("h-003"); // Market day, 20 October: today still counts
    expect(onThe20th).toContain("h-005"); // Hub mixer, 28 October
    expect(onThe20th).toContain("h-013"); // a tip, which doesn't date
    expect(onThe20th).not.toContain("h-002"); // office hours on 15 October
    expect(onThe20th).not.toContain("h-011"); // the open day of 16 September
    expect(await getListedHubPostIds({ today: "2026-10-12" })).toContain("h-002");
  });
```

and in the cache-tags describe, after the request readers' test, add:

```ts
  it("tags the sitemap's Hub reader with hub (stage L spec section 5)", async () => {
    expect(await tagsOf(() => getListedHubPostIds({ today: TODAY }))).toEqual([["hub"]]);
  });
```

Replace the whole of `app/sitemap.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCollections, getListingIds, getSellerSlugs } from "@/lib/data";
import { createRequest, hideRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { siteUrl } from "@/lib/site-url";
import sitemap from "./sitemap";

// It reads today's date after connection() (stage L plan decision 25): a stand-in, and a fixed clock.
vi.mock("next/server", () => ({ connection: async () => undefined }));

// Tuesday 20 October 2026, 10:00 in South Africa.
const NOW = new Date("2026-10-20T08:00:00.000Z");

// Requests come from the sample store (community actions plan decision 1). A fresh one for each test.
beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

const paths = async () => (await sitemap()).map((entry) => new URL(entry.url).pathname);

const LAMP = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: null,
  swapWelcome: false,
  neededBy: null,
};

describe("sitemap.xml (info and system spec 2.8)", () => {
  it("lists every listing, seller and collection at the site's own address", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const id of await getListingIds()) expect(urls).toContain(`${siteUrl()}/listings/${id}`);
    for (const slug of await getSellerSlugs()) expect(urls).toContain(`${siteUrl()}/sellers/${slug}`);
    for (const collection of await getCollections()) expect(urls).toContain(`${siteUrl()}/collections/${collection.slug}`);
  });

  it("lists the indexable info pages, each address once, and not the three noindex drafts (plan amendment 1)", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const path of ["/how-it-works", "/safety", "/trust"]) expect(urls).toContain(`${siteUrl()}${path}`);
    for (const path of ["/privacy", "/terms", "/seller-guidelines"]) expect(urls).not.toContain(`${siteUrl()}${path}`);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("only what's worth crawling today (stage L spec 2.19 and section 5)", () => {
  it("leaves out closed, hidden and due requests, and keeps open ones", async () => {
    const open = await createRequest({ askerId: "acc-student", fields: LAMP, now: NOW });
    // Needed by the 16th: its closing day is today, the 20th, and nothing has settled it.
    const due = await createRequest({
      askerId: "acc-student",
      fields: { ...LAMP, neededBy: "2026-10-16" },
      now: new Date("2026-10-14T08:00:00.000Z"),
    });
    await hideRequest("r-002", "Checking it.", NOW);
    const listed = await paths();
    expect(listed).toContain(`/looking-for/${open.id}`);
    expect(listed).toContain("/looking-for/r-001");
    for (const id of ["r-015", "r-016", "r-002", due.id]) expect(listed).not.toContain(`/looking-for/${id}`);
  });

  it("keeps tips and today's and later events, and leaves out the ones that have passed", async () => {
    const listed = await paths();
    for (const id of ["h-013", "h-003", "h-005"]) expect(listed).toContain(`/hub/${id}`);
    for (const id of ["h-002", "h-011"]) expect(listed).not.toContain(`/hub/${id}`);
  });
});
```

Run: `pnpm test lib/data/index.test.ts app/sitemap.test.ts`
Expected: FAIL (`getListedHubPostIds` doesn't exist; the sitemap still lists every request and post).

- [x] **Step 3: The Hub reader**

In `lib/data/index.ts`:
- change `import { orderHubPosts, toHubEvent } from "@/lib/hub";` to `import { hasPassed, orderHubPosts, toHubEvent } from "@/lib/hub";`;
- after `getHubPostIds`, add:

```ts
/**
 * The posts the sitemap offers crawlers (stage L spec decision 19): tips, which don't date, and events and office hours
 * from `today` (a SAST date) on, as the feed shows them. A past post's page stays up and prerendered (getHubPostIds).
 */
export async function getListedHubPostIds({ today }: { today: string }): Promise<readonly string[]> {
  "use cache";
  tagHub();
  return publishedPosts()
    .filter((post) => !hasPassed(post, today))
    .map((post) => post.id);
}
```

- [x] **Step 4: The sitemap**

Replace the whole of `app/sitemap.ts` with:

```ts
import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getCollections, getListedHubPostIds, getListedRequestIds, getListingIds, getSellerSlugs } from "@/lib/data";
import { siteUrl } from "@/lib/site-url";
import { sitemapEntries } from "@/lib/sitemap";
import { sastToday } from "@/lib/time";

/**
 * Every public page worth crawling today (info and system spec 2.8; stage L spec decision 19): the static pages,
 * collections, open shops and listings, then the requests open today and the Hub's tips and events from today on.
 * Closed requests and past events keep their pages; they just aren't offered to crawlers. "Today" is a request-time
 * read, so the sitemap is generated per fetch; its two dated readers are cached per day, the rest as before.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const today = sastToday();
  const [listingIds, sellerSlugs, collections, requestIds, hubPostIds] = await Promise.all([
    getListingIds(),
    getSellerSlugs(),
    getCollections(),
    getListedRequestIds({ today }),
    getListedHubPostIds({ today }),
  ]);
  return sitemapEntries(siteUrl(), {
    listingIds,
    sellerSlugs,
    collectionSlugs: collections.map((collection) => collection.slug),
    requestIds,
    hubPostIds,
  });
}
```

(`lib/sitemap.ts` doesn't change.)

Run: `pnpm test lib/data/index.test.ts app/sitemap.test.ts lib/sitemap.test.ts`
Expected: PASS.

Run: `pnpm lint lib/data/index.ts lib/data/index.test.ts app/sitemap.ts app/sitemap.test.ts`
Expected: no output.

- [x] **Step 5: Build and size check, in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-l-task10"` with every uncommitted file of this stage. From `$S`:

```bash
pnpm typecheck
pnpm build 2>&1 | tee "$S/build.log" | grep -n "sitemap"
grep -n "new Date()\|uncached data\|Route .* used" "$S/build.log"
```

Expected: no type errors; the route list shows `/sitemap.xml` as rendered per request (`ƒ`, Dynamic), where stage K's build showed it static or cached; the second `grep` prints nothing. If the build refuses `connection()` in the sitemap, stop and report with the build's words (the docs say a Request-time API makes it per request).

Then run e2e as the conventions say, with:

```bash
curl -s http://localhost:3204/sitemap.xml | grep -c "<loc>"
curl -s http://localhost:3204/sitemap.xml | grep -c "/hub/h-011\|/looking-for/r-015\|/looking-for/r-016"
E2E_REUSE_SERVER=1 pnpm e2e tests/e2e/system.spec.ts --project=desktop-1440 --workers=2
E2E_REUSE_SERVER=1 pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 --workers=2
```

Expected: a count of `<loc>` lines; `0` for the passed event and the closed seeds; `system.spec.ts` passes; every `scriptBrotli` equal to the Start row (fill in the Task 10 row). Stop your server by its PID.

- [x] **Step 6: Hand over**

Files: `lib/data/index.ts`, `lib/data/index.test.ts`, `app/sitemap.ts`, `app/sitemap.test.ts`. Message:

```
feat: the sitemap offers crawlers only what's current (stage L spec decision 19): requests open today, tips, and events and office hours from today on, through two cached readers keyed on the SAST date; closed requests and past events keep their pages. It reads today after connection(), so it renders per fetch. JS: every page the same to the byte. Unit: <count>
```

---

### Task 11: End to end: an admin's own shop, the closing dates, the sitemap

Spec 3, 4 and 5 "Tests" (end to end), with plan decisions 26 and 27.

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/housekeeping-writes.spec.ts`

- [x] **Step 1: Check the files are yours to edit**

Run: `git --no-optional-locks status --short playwright.config.ts tests/e2e`
Expected: only the header session's `tests/e2e/listing.spec.ts` and `tests/e2e/responsive.spec.ts` (and perhaps `a11y.spec.ts`), which this task never touches. If `playwright.config.ts` is modified by someone else, stop and report.

- [x] **Step 2: The project**

In `playwright.config.ts`, after the `HARDENING_WRITES` line add:

```ts
// Stage L's tests give the sample seller the Admin role for their length, and post requests as a fresh account, so
// they run after every other test (stage L plan decision 26).
const HOUSEKEEPING_WRITES = /housekeeping-writes\.spec\.ts$/;
```

In each of the five device projects, add `HOUSEKEEPING_WRITES` to the end of `testIgnore`'s list (five lines, the same change). After the `hardening-writes` project add:

```ts
    // After everything else (stage L plan decision 26). Run it alone with --project=housekeeping-writes --no-deps.
    {
      name: "housekeeping-writes",
      use: desktop(1440, 900),
      testMatch: HOUSEKEEPING_WRITES,
      dependencies: [
        ...DEVICE_PROJECTS,
        "selling-writes",
        "staff-writes",
        "community-writes",
        "alerts-writes",
        "staff-accounts-writes",
        "hardening-writes",
      ],
    },
```

- [x] **Step 3: The tests**

Create `tests/e2e/housekeeping-writes.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { fillRequest, NEW_REQUEST_URL, offersPanel } from "./helpers/community";
import { button, field, main, newBuyer, signUp } from "./helpers/messaging";
import { notFoundHeading, POST_LANDS, uniqueWord } from "./helpers/selling";
import { signedInPage, staffNotice } from "./helpers/staff";
import { copySession, giveRole } from "./helpers/staff-accounts";

// Stage L's end to end (spec sections 3 to 5; plan decision 26). They run last, in the housekeeping-writes project:
// the first gives the sample seller (Sipho, Tech corner's owner) the Admin role for its length and takes it away in a
// finally; the second posts requests as a fresh account. A built server's clock can't be moved, so the closing itself
// is unit-tested; here, the dates the asker is shown.

const OWN_SHOP_LINE =
  "This is your own shop, so another admin must make the Hub's decisions about it: approving, verifying, pausing, pinning and choosing its mentor.";
const VERIFY = /^(Verify|Remove Verified from) Tech corner$/;

/** Pieter takes Sipho's Admin role away again, so a rerun on the same server starts clean. */
async function removeSiphosAdminRole(pieter: Page) {
  await pieter.goto("/admin/staff");
  const remove = main(pieter)
    .getByRole("row")
    .filter({ hasText: "seller@eduvos.com" })
    .getByRole("link", { name: "Remove admin role for Sipho" });
  if ((await remove.count()) === 0) return;
  await remove.click();
  await button(pieter, "Remove Sipho's admin role").click();
  await expect(staffNotice(pieter)).toHaveText("Role removed. They've been told.", POST_LANDS);
}

test("an admin who owns a shop sees why in place of its controls, and a forged post changes nothing (spec section 3)", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const pieter = await signedInPage(browser, baseURL!, "Admin", "/admin/staff");
  await giveRole(pieter, "seller@eduvos.com", "Admin");
  try {
    // The verify form as another admin's page draws it without the app's JavaScript: its fields, the Server Action's
    // own among them, are what a forged post or an old tab would send (plan decision 26).
    const plain = await browser.newContext({ baseURL, serviceWorkers: "block" });
    await plain.route("**/_next/static/**/*.js", (route) => route.abort());
    await copySession(browser, plain, baseURL!, "Admin");
    const pieterPlain = await plain.newPage();
    await pieterPlain.goto("/admin/sellers/tech-corner");
    const verifyForm = main(pieterPlain)
      .locator("form")
      .filter({ has: pieterPlain.getByRole("button", { name: VERIFY }) });
    const fields = await verifyForm.evaluate((form) =>
      Object.fromEntries([...new FormData(form as HTMLFormElement)].map(([name, value]) => [name, String(value)])),
    );
    expect(fields.shop).toBe("tech-corner");
    const standing = (await main(pieterPlain).locator(".staff-standing").first().textContent()) ?? "";

    // Sipho, now an admin, on his own shop's review page.
    const sipho = await signedInPage(browser, baseURL!, "Seller, Tech corner", "/admin/sellers/tech-corner");
    await expect(main(sipho).getByRole("region", { name: "What you can do" })).toContainText(OWN_SHOP_LINE);
    await expect(main(sipho).getByRole("button", { name: VERIFY })).toHaveCount(0);
    await expect(main(sipho).getByRole("link", { name: "Pause Tech corner" })).toHaveCount(0);
    const mentor = main(sipho).getByRole("region", { name: "Mentor" });
    await expect(mentor.getByRole("combobox")).toHaveCount(0);
    await expect(mentor).toContainText("Tech corner");
    // Pieter is an admin too, so Sipho isn't the only one.
    await expect(main(sipho).getByText(/You're the only admin/)).toHaveCount(0);
    // axe on Sipho's view, at 1440 and at 390 (spec section 3, Tests).
    expect(await seriousIssues(sipho)).toEqual([]);
    await sipho.setViewportSize({ width: 390, height: 844 });
    await sipho.reload();
    await expect(main(sipho).getByRole("region", { name: "What you can do" })).toContainText(OWN_SHOP_LINE);
    expect(await seriousIssues(sipho)).toEqual([]);
    await sipho.setViewportSize({ width: 1440, height: 900 });

    // A forged verify: the form's own fields, sent with Sipho's session. It lands with the notice and changes nothing.
    const posted = await sipho.request.post("/admin/sellers/tech-corner", {
      multipart: fields,
      headers: { Origin: new URL(baseURL!).origin },
      maxRedirects: 0,
    });
    expect(posted.status(), "the Server Action ends with a redirect").toBeGreaterThanOrEqual(300);
    expect(posted.status()).toBeLessThan(400);
    await sipho.goto("/admin/sellers/tech-corner");
    await expect(staffNotice(sipho)).toHaveText("Nothing changed. It's your own shop, so another admin must do this.");
    await pieterPlain.reload();
    await expect(main(pieterPlain).locator(".staff-standing").first()).toHaveText(standing);

    // Nobody reads the mentors' notes about themselves: the shop's mentor page is the 404 for Sipho (spec 2.5).
    await sipho.goto("/mentor/tech-corner");
    await expect(notFoundHeading(sipho)).toBeVisible();
    await plain.close();
    await sipho.context().close();

    // Pieter, who doesn't own it, still has every control.
    await pieter.goto("/admin/sellers/tech-corner");
    await expect(main(pieter).getByRole("button", { name: VERIFY })).toBeVisible();
    await expect(main(pieter).getByRole("link", { name: "Pause Tech corner" })).toBeVisible();
    await expect(main(pieter).getByRole("region", { name: "Mentor" }).getByRole("combobox")).toBeVisible();
  } finally {
    await removeSiphosAdminRole(pieter);
    await pieter.context().close();
  }
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Today's date in South Africa, YYYY-MM-DD, as the server works it out. A run across SAST midnight may fail: rerun. */
const sastToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
const plusDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
/** "13 Nov", as the site writes a date. */
const dayMonth = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

test("Your requests says when each request will close itself: 3 days after its needed-by date, or 30 days on (spec section 4)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUp(page, newBuyer());
  const today = sastToday();
  const word = uniqueWord();
  const dated = `Desk lamp ${word}`;
  const undated = `Kettle ${word}`;

  await page.goto("/looking-for/new");
  await fillRequest(page, dated);
  await field(page, "Needed by (optional)").fill(plusDays(today, 7));
  await button(page, "Post request").click();
  await expect(page).toHaveURL(NEW_REQUEST_URL, POST_LANDS);
  await expect(offersPanel(page)).toContainText(`Closes automatically on ${dayMonth(plusDays(today, 11))}.`);

  await page.goto("/looking-for/new");
  await fillRequest(page, undated);
  await button(page, "Post request").click();
  await expect(page).toHaveURL(NEW_REQUEST_URL, POST_LANDS);
  await expect(offersPanel(page)).toContainText(`Closes automatically on ${dayMonth(plusDays(today, 30))}.`);

  await page.goto("/account/requests");
  const item = (title: string) => main(page).getByRole("listitem").filter({ hasText: title });
  await expect(item(dated)).toContainText(`Closes automatically on ${dayMonth(plusDays(today, 11))}.`);
  await expect(item(undated)).toContainText(`Closes automatically on ${dayMonth(plusDays(today, 30))}.`);

  // The sample requests never close themselves: the board still shows the first, needed by 16 October 2026.
  await page.goto("/looking-for");
  await expect(main(page).getByText("Accounting 1 tutor this week", { exact: true }).first()).toBeVisible();
});

test("the sitemap offers only open requests, tips, and events from today on, and the rest keep their pages (spec section 5)", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const paths = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  // The Hub open day of 16 September 2026 has passed; the two sample requests seeded as closed are closed.
  for (const path of ["/hub/h-011", "/looking-for/r-015", "/looking-for/r-016"]) expect(paths, path).not.toContain(path);
  // A tip doesn't date; a sample request never closes itself.
  for (const path of ["/hub/h-013", "/looking-for/r-001"]) expect(paths, path).toContain(path);
  // Their pages still answer.
  expect((await request.get("/looking-for/r-015")).status()).toBe(200);
  expect((await request.get("/hub/h-011")).status()).toBe(200);
});
```

Run: `pnpm lint tests/e2e/housekeeping-writes.spec.ts playwright.config.ts`
Expected: no output.

Run: `grep -rn "newContext(" tests/e2e | grep -v serviceWorkers`
Expected: no output (CLAUDE.md).

- [x] **Step 4: Run it and the write projects, in a scratch copy**

Make the scratch copy `S="<your scratchpad>/vossie-l-task11"` with every uncommitted file of this stage. Run e2e as the conventions say, with:

```bash
E2E_REUSE_SERVER=1 pnpm e2e tests/e2e/housekeeping-writes.spec.ts --project=housekeeping-writes --no-deps --workers=2
E2E_REUSE_SERVER=1 pnpm e2e --project=staff-writes --project=community-writes --project=staff-accounts-writes --no-deps --workers=2
```

Expected: 3 passed; the three write projects pass as at stage K. If the forged post's status isn't a redirect, report what it was and what the response body says before changing the test (the notice check is the real proof). Stop your server by its PID.

- [x] **Step 5: Hand over**

Files: `playwright.config.ts`, `tests/e2e/housekeeping-writes.spec.ts`. Message:

```
test: stage L end to end, in a new housekeeping-writes project that runs last: Sipho, given the Admin role, sees one line and no controls on his own shop (axe clean at 1440 and 390), a forged verify post lands with the own-shop notice and changes nothing, his mentor page is the 404, Pieter keeps every control, and the role is taken away again; a fresh account's requests show their closing dates in SAST; the sitemap leaves out the passed event and the closed seeds, which keep their pages (spec sections 3 to 5). JS: unchanged
```

---

### Task 12: Docs and final checks

The stage's records. **`docs/PROGRESS.md` and `docs/reference/LANDING-DECISIONS.md` carry other sessions' uncommitted lines, so this task doesn't edit them:** it writes their new text as `l-progress.md` and `l-decision.md` in the scratchpad `/private/tmp/claude-501/-Users-LamaNkuna-Projects-Vossie/27a3bf01-5279-40ef-b17d-be68f2ee9fa1/scratchpad/`, and the controller merges them.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-20-housekeeping-design.md`
- Modify: `docs/reference/GO-LIVE.md`
- Modify: `docs/superpowers/plans/2026-10-20-housekeeping.md` (this plan)
- Create (scratchpad, not the project): `l-progress.md`, `l-decision.md`

- [x] **Step 1: Check the docs are yours to edit**

Run: `git --no-optional-locks status --short CLAUDE.md docs/reference/GO-LIVE.md docs/superpowers/specs/2026-10-20-housekeeping-design.md docs/superpowers/plans/2026-10-20-housekeeping.md`
Expected: no output (this plan may show as modified by the build's own ledger notes). If any shows as modified by someone else, stop and report.

- [x] **Step 2: Screenshots: none**

Nothing new is drawn but lines of text in existing styles, and one link in the existing pill style. No screenshots spec is added; say so in the progress snippet.

- [x] **Step 3: CLAUDE.md**

After the line that starts `- Looking For requests live in the sample store`, add:

```md
- Looking For requests close themselves (`closingDay` in `lib/looking-for/rules.ts`: 3 days after the needed-by date, else 30 days after the last change; the samples never). The list readers take `today` and apply `requestOpenOn` inside `"use cache"`. `settleRequests(now)` stores the close and tells the asker, only from request-time code (after `connection()`, or first thing in a Server Action, which then calls `requestsChanged()`), never inside `"use cache"`. The asker's reads (`getOwnRequest`, `listOwnRequests`, `countOpenRequests`) take `now` and settle first (stage L).
```

After the line that starts `- Every staff action is a Server Action in \`lib/staff/*-actions.ts\``, add:

```md
- No admin makes a Hub decision about their own shop, its listings or their own Looking For request. The gate is in the action, after `requireStaff()` and before anything is read or written (`isOwnShop`, `isOwnListing`, `isOwnRequest` in `lib/data/staff-shops.ts`; `ownsTarget` in `lib/staff/own.ts`); a refusal writes and logs nothing and leaves the `own-shop` or `own-request` notice. The views show one line in place of the controls, never a disabled one (stage L).
```

After the line that starts `- End-to-end tests that write messages at volume (the message limits)`, add:

```md
- Stage L's end-to-end tests (an admin's own shop, the closing dates, the sitemap) go in `tests/e2e/housekeeping-writes.spec.ts`, which runs last, in the `housekeeping-writes` project, after `hardening-writes`.
```

In the line that starts `- Mentors' notes are about a shop's owner`, change `seen by mentors and admins only, never by the seller,` to `seen by mentors and admins only, never by the seller (an admin who sells included: \`mentoredShops\` leaves out the viewer's own shop),`.

- [x] **Step 4: The spec's "Changes on plan review and build"**

At the end of `docs/superpowers/specs/2026-10-20-housekeeping-design.md`, add `## 11. Changes on plan review and build`, a numbered list, one sentence or two each, naming the plan decision:
1. The mentors' notes leak in spec 2.5 and section 3 was already closed by staff tools amendment 15.3 (`5af3548`): `mentoredShops` leaves out the viewer's own shop for every role. Stage L pinned it with two tests and built the two parts still open, the dropdown and `assignMentor` (plan decision 1).
2. The ownership reads are synchronous; `ownsTarget` returns the kind (plan decision 2).
3. The viewer arguments are optional and `listReports` doesn't take one; `featuredChoices` keeps returning `Seller[]`, and the page works out `ownLeftOut` (plan decisions 3 and 4).
4. Where a refusal lands: the page that shows staff notices, since the confirm pages show none (plan decision 5).
5. The only-admin link is a 44px pill named "Staff" on its own line, after the spec's sentence (plan decision 7).
6. `RequestForm` and `DeleteRequest` read the clock too; `OwnRequest` gains `neededByPassed`; `setRequestOpen` returns `neededByCleared`; `offerStatus` takes `today`; no `listedRequestIds` in `requests.ts` (plan decisions 12 to 15 and 17).
7. The closed request's edit page gets the reopen hint (plan decision 18).
8. The seeds' fixtures set `closesOn` and `closedBy` to null (plan decision 21); one existing test's date moved from 10 to 12 October (plan decision 20).
9. How it works' sentence went into "What can I do on Vossie today?" (plan decision 23).
10. The sitemap's old unit test (closed requests and past events included) was replaced (plan decision 25).
11. Section 10's questions stay open for Lama: the build used the spec's choices.
12. Anything in this plan's "Changes made during the build" that changes what the spec says.

- [x] **Step 5: The go-live checklist**

In `docs/reference/GO-LIVE.md`:
- line 5: change `info pages; stage K). Update the status column` to `info pages; stage K), and after housekeeping (an admin's own shop, requests that close themselves, the sitemap; stage L). Update the status column`;
- **Section 6, Backend**, in the scheduled jobs line: change `confirming sales automatically after 7 days, closing old Looking For requests (stage H leaves them open),` to `confirming sales automatically after 7 days (it's settled when a conversation is read today, stage E), closing old Looking For requests and telling their askers (stage L closes them when something looks, by \`closingDay\`; the job runs the same rule nightly at 00:05 SAST),`;
- **Section 6, Backend**, after that line, add: `- [ ] Supabase: \`requests.closed_by\` (\`asker\`, \`auto\`), and the closing day as a generated column or a view, so the board's query and the nightly job use one rule (stage L spec decision 10).`;
- **Section 6, Backend**, in the line that starts `- [ ] **Re-check the actor's role inside the transaction**`, change `for every staff action.` to `for every staff action, and that the target isn't the actor's own shop, listing or request (stage L).`;
- **Section 6, Production**: tick `- [ ] Decide whether the sitemap should keep listing closed requests and past Hub posts.` (`- [x]`) and append ` Decided in stage L: it lists open requests, tips, and events and office hours from today on, and is rendered per fetch; the other pages keep their addresses.`;
- **Section 7**:
  - tick `- [ ] **Should an admin be able to act on their own shop?**` (`- [x]`) and replace `Not prevented today (stage J spec section 10).` with `No: refused in the action, the controls replaced by a line, and nobody reads mentors' notes about themselves (stage L). Reports an admin made about someone else's shop are theirs to act on (stage L spec section 10, question 3).`;
  - in `- [ ] **Featured with few Verified sellers.**`, append ` Assessed in stage L: a strict break would leave rows short three days in seven; a least-recently-featured order for resting sellers is offered (stage L spec decision 20).`;
- **Section 8**: after the stage K bullet under item 6, add `   - **Done in sample mode (<day>): housekeeping (stage L).** No admin decides about their own shop, its listings or their own request; old Looking For requests close themselves and their askers are told; the sitemap lists only open requests and Hub posts that haven't passed.`; and in item 7's paragraph, after `…and brought-up-to-date info pages.`, add ` Stage L adds housekeeping: the own-shop guard, requests that close themselves, and a sitemap of what's current.`

- [x] **Step 6: This plan's ledger and changes**

In this plan, fill in the JS ledger's rows from Tasks 9 and 10's reports, `UNIT_COUNT` and the device projects at 2 workers on `83a5458`: 1,251 passed, 1,210 skipped by design, and the same 4 failures that predate stage L (the header and tab bar's `a11y.spec.ts:343` at 360, `responsive.spec.ts:26` at 360 and 390, `listing.spec.ts:34` at 390; the header session has them). The seven write projects with `--no-deps` on a fresh server at `1f55ee5`: 65 passed, 1 skipped. Run on the same server straight after the 17-minute device run, five write tests saw stale pages after a write (a resumed listing missing from browse, a deleted request's page still served, a new office-hours link missing); they all pass on a fresh server; under "Changes made during the build", list each task with its commit (`git --no-optional-locks log --oneline`, one command) and every place the build differed from the tasks.

- [x] **Step 7: The snippets for the controller**

Write, in the scratchpad named above:
- `l-progress.md`: a section for `docs/PROGRESS.md` in the shape of stage K's (`## 2026-10-<day>: Housekeeping built, in sample mode (stage L)`): what was built (the own-shop gate and lines, the mentors' notes pinned, requests that close themselves, the sitemap); the spec points the code had already settled (plan decision 1); the JS figures; the unit and e2e counts; no screenshots (Step 2); and the open points for Lama: spec section 10's seven questions (the numbers 3 and 30 and whether an edit restarts the 30; reopening removing a passed date; reports an admin made about someone else; the only admin who sells; Featured's resting order; a reminder before a request closes; the sample words), and the one lag of spec 2.15 (a request page's shell can say "open" for up to 15 minutes on its closing day);
- `l-decision.md`: one row for `docs/reference/LANDING-DECISIONS.md`, **row 80**, summarising the stage (the own-shop rule and where its gate is, the closing rule's numbers and the sample exemption, the stored close and the one notification, reopen removing a passed date, the sitemap rendered per fetch, items 3, 4 and 6 assessed with no build), the plan decisions that changed the spec (1, 3 to 5, 7, 12 to 18, 20, 23 and 25), and "decided by Claude under decision 54; Lama may revisit".

- [ ] **Step 8: Final checks (the controller)**

In a fresh scratch copy of HEAD with this task's files copied in, run e2e as the conventions say, after:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
grep -l "serviceWorker.register" .next/static/chunks/*.js
```

and then `E2E_REUSE_SERVER=1 pnpm e2e --workers=2`.

Expected: clean lint and types; every unit test passing (record the count); the build listing `/sitemap.xml` as dynamic with no error and no clock warning; the `grep` printing nothing (CLAUDE.md); the whole e2e run passing, with `housekeeping-writes` last, apart from any test already reported to Lama (stage K's four that predate it, with the header session); `performance.spec.ts`'s figures equal to the ledger's to the byte. Fill in the ledger's Final row.

- [ ] **Step 9: Hand over**

Files: `CLAUDE.md`, `docs/superpowers/specs/2026-10-20-housekeeping-design.md`, `docs/reference/GO-LIVE.md`, `docs/superpowers/plans/2026-10-20-housekeeping.md`. Snippets: `<scratchpad>/l-progress.md`, `<scratchpad>/l-decision.md`. Message:

```
docs: stage L's records: CLAUDE.md (requests that close themselves and where they're settled, the own-shop gate, the housekeeping-writes project, mentors' notes and an admin who sells), the spec's changes on plan review and build, the go-live checklist (the own-shop question and the sitemap decided, the closing job and closed_by for the real backend, the role re-check covers the actor's own) and the plan's ledger and build changes. Unit: <count>. E2E: <counts>. JS: no page moved
```

---

## Self-review (while drafting the tasks)

- **Spec coverage.** Every spec decision maps to a task in "Where each spec decision is built". Spec 3's unit list: the three `isOwn…` functions and `listMentors` (Task 1), `ownsTarget` (Task 1), every action in decision 1 with an owning admin and a second admin (Task 3), mentors and the CSV (Task 1, pinned), `own` and `can` on reports, hidden items, choices and pins (Task 2). Its component list: Task 4 (the dropdown is the page's `listMentors(owner)`, tested in Task 1). Its e2e: Task 11. Spec 4's unit list: `rules.test.ts` (Task 5), `requests.test.ts` and `index.test.ts` (Task 6), `actions.test.ts` (Task 7); its component list: Tasks 6 and 8; its e2e: Task 11. Spec 5's: Task 10 (unit) and Task 11 (e2e), with the build checks in Tasks 9 and 10.
- **Names against HEAD.** `approveSeller`, `declineSeller`, `verifySeller`, `pauseSeller`, `resumeSeller`, `assignMentor`, `dismissReport`, `hideReportedListing`, `hideReportedRequest`, `pauseReportedShop`, `pinSeller`, `unpinSeller`, `showListingAgain`, `showRequestAgain`, `nothingChanged`, `leaveNotice`, `takeNotice`, `done`, `requireStaff`, `getReport`, `listReports`, `listHidden`, `getHidden`, `countHidden`, `featuredChoices`, `listPins`, `addPin`, `removePin`, `listMentors`, `setShopMentor`, `getShopForReview`, `countAdmins`, `mentoredShops`, `getMentoredShop`, `listedRequests`, `publicRequest`, `publicRequestIds`, `getOwnRequest`, `listOwnRequests`, `countOpenRequests`, `setRequestOpen`, `hideRequest`, `showRequest`, `exportRequests`, `getRequests`, `getOpenRequests`, `getRequestIds`, `getHubPostIds`, `publishedPosts`, `hasPassed`, `offerSubject`, `offerStatus`, `saveMyRequest`, `closeMyRequest`, `reopenMyRequest`, `deleteMyRequest`, `sendOffer`, `requestsChanged`, `notify`, `getNotifications`, `sastDate`, `sastToday`, `shortSastDate`, `dayMonth`, `addDays` (Looking For's), `STAFF_NOW`, `signedInAs`, `form`, `redirectOf`, `redirectSignalOf`, and the e2e helpers (`signedInPage`, `staffNotice`, `copySession`, `giveRole`, `signUp`, `newBuyer`, `main`, `field`, `button`, `fillRequest`, `NEW_REQUEST_URL`, `offersPanel`, `notFoundHeading`, `POST_LANDS`, `uniqueWord`, `seriousIssues`) were read from the code at `03afadd`.
- **Shared files left alone.** `app/globals.css`, `app/layout.tsx`, `components/header/*`, `components/tabbar/*`, `tests/e2e/{listing,responsive,a11y}.spec.ts`, `lib/supabase/*`, `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md` and the other sessions' untracked docs are never edited.
- **Type consistency.** `OwnKind`, `ReportView.own`, `HiddenItem.own`, `PinView.own`, `CloseReason`, `LookingForRequest.closesOn`, `RequestRow.closedBy`, `OwnRequest`'s four new fields, `setRequestOpen`'s `neededByCleared` and `settleRequests`' `Promise<number>` are used with the same names in every task.
