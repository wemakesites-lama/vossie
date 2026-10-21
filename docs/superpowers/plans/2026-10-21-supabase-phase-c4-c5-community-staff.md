# Supabase phase C4 (community and alerts) and C5 (staff): build plan

- **Programme:** `docs/superpowers/plans/2026-10-20-supabase-phases-b-c.md`, step 3 (C4, C5) and step 5. **Spec:** `docs/superpowers/specs/2026-10-15-supabase-backend-design.md` (sections 3 to 8, and amendment 12: staff writes run with the staff member's own session; the admin client only for jobs, deletion, photo files, `admin_weekly_counts` and the featured draws).
- **Pattern:** `docs/superpowers/plans/2026-10-21-supabase-step-2b-and-phase-c-foundation.md` (decisions 15 to 22, Tasks 12 to 17b, its amendments, the controller's answers and "Changes made during the build", Task 9b's note for C4 included). Phase B: `2026-10-21-supabase-phase-b-sign-in.md` (`forViewer()`, `requireLiveAccount()`, Supabase form states, amendments 4 and 20).
- **Sibling:** C2 and C3 (selling, messaging) are planned at the same time in `2026-10-21-supabase-phase-c2-c3-selling-messaging.md`. This plan doesn't plan their modules; "Shared files" lists what both touch.
- **Format:** test first, one writer per file, the controller commits.
- **Status:** draft for review, 2026-10-21. Nothing is built.

## Goal

After this plan, with `VOSSIE_BACKEND=supabase`:

- **C4.** Looking For requests' writes and the asker's reads, the request side of offers, follows, saved searches and alert matching run on Supabase:
  - the asker's reads and every request action settle first, from request-time code only;
  - matching stays in TypeScript through browse's `listingMatches`, after the followers are told, under the same condition;
  - the once-a-day notifications are `private.notify_once_per_day`'s.
- **C5.** The audit log, staff shops, the reports queue, mentors, Hub management, staff accounts, the admin's numbers, Show again, Featured pins, pickup point writes and the staff tools' part of the data download run on Supabase:
  - every staff action checks the role first (with phase B's live re-check) and writes through the staff function with the staff member's own session;
  - each staff function makes its one audit row, closes its reports and sends its notifications in the same transaction;
  - every gate in CLAUDE.md holds, and a contract scenario proves each refusal against both backends.
- **Step 5.** The whole e2e suite runs against the local stack with `VOSSIE_BACKEND=supabase`.

Cache tags stay as they are, and no byte of client JavaScript is added.

**Not in this plan:**
- C2 and C3: shops, listings, photos and Storage, conversations, messages, reports by students, notifications' reads, `startOffer`;
- phase B: sign-in, sessions, form states, accounts, the deletion Route Handler, `exportAccountData`'s own sections;
- staging pushes (step 5's staging checkpoint 2 is its own runbook step, after this plan).

## Where and safety (from CLAUDE.md, highest priority)

- **Worktree:** `/Users/LamaNkuna/Projects/Vossie-backend`, branch `backend/phases-b-c`. Main's tree is never edited from here.
- **Git:**
  - Implementers never `git add` or `git commit`. The controller checks each task, stages files by path and commits with Lama's go-ahead.
  - One git command per tool call.
  - Another implementer may be working in the same tree: stage only your own files.
- **The local stack** (`supabase_*_vossie`, API 55321, DB 55322, Mailpit 55324) is shared by every Vossie checkout.
  - `supabase db reset` (local only) wipes local data. Before running it, the controller checks that no other session is using the stack (C1's implementer, phase B's, C2/C3's).
  - Never `--linked`.
  - Never stop `supabase start`, `pnpm install`, a build or a migration mid-run. Stop only servers this session started, by PID or port.
- **Keys and tokens** come from `supabase status -o json` at run time, live only in process memory, and are never printed or written to a file (as `tests/db/global-setup.ts` does).

## Recheck before starting

Run each as its own command and compare. If anything differs, stop and tell the controller.

1. **The tree.** `git status` in the worktree shows no file this plan writes as modified by someone else. `git log --oneline -5` shows C1's Tasks 14 to 20 (and 17b) and step 2b's Task 9b committed.
   - `lib/data/supabase/` must hold `catalog.ts`, `hub-posts.ts`, `requests.ts`, `featured.ts`, `shop-stats.ts`, `badges.ts` and `pickup-points.ts`. C4 and C5 extend five of them.
2. **Phase B.**
   - Before **Tasks 2, 6, 16, 18 to 20 and 23**, phase B's Tasks 4 and 5 must be committed:
     - `forViewer()` wired to the cookie client;
     - Supabase form states (`getFormState`, `saveFormState`, and the `takeFormState` stub that throws);
     - `requireLiveAccount()` in `lib/auth/session.ts`.
   - Data-level tasks (3 to 5, 7 to 9, 12 to 15, 17, 21) don't need it: the db tests replace `forViewer()`.
   - Record which phase B commit the branch has.
3. **C2 and C3.**
   - Note which of these exist, and their names:
     - C2's photo-file helpers (a Hub cover's Storage upload and removal; Task 18 uses them);
     - C2's twin of `saveOwnListing`;
     - C3's twins of `notifications.ts` and `messages.ts` (`startOffer`).
   - Re-read "Shared files" with the C2/C3 controller before Tasks 1, 3, 9 and 18.
4. **The stack.**
   - `supabase status`: the stack is up.
   - `supabase db reset` (after the check in "Where and safety"), then `supabase test db`: the count matches the 2b ledger after Task 9b (**2,289**, 25 migrations) plus whatever phase B and C2/C3 have added since. Record it.
   - The last migration's name, from `ls supabase/migrations | tail -1`. This plan's migration must sort after it (Task 1 renames it if needed).
5. **Tests.** `pnpm test` and `pnpm test:db`: all pass; record both counts. `pnpm lint` and `pnpm typecheck`: clean.
6. **The latest definition of each SQL function this plan calls.** The last match of `grep -nE "create (or replace )?(function|view) public\.<name>\b" supabase/migrations/*.sql` must be the one listed (a bare `function public.<name>` also matches the `grant` lines):

   | Function | Latest definition |
   |---|---|
   | `save_request`, `set_request_open`, `start_offer` | `20261021120300_requests_actions.sql:22`, `:97`, `:147` |
   | `delete_request`, `follow_shop`, `unfollow_shop`, `save_search`, `set_search_paused`, `delete_search`, `record_search_matches` | `20261020120500_community_actions.sql:354`, `:599`, `:630`, `:654`, `:683`, `:709`, `:738` |
   | `settle_requests` | `20261021120200_requests_settle.sql:46` |
   | `approve_shop`, `decline_shop`, `set_shop_verified`, `staff_pause_shop`, `staff_resume_shop`, `set_shop_mentor`, `hide_listing`, `hide_request`, `show_listing`, `show_request`, `pin_shop`, `unpin_shop` | `20261021120500_own_target_gate.sql:43`, `:82`, `:123`, `:167`, `:213`, `:258`, `:358`, `:412`, `:461`, `:501`, `:541`, `:603` |
   | `dismiss_report` | `20261021120800_review_fixes_2b.sql:84` (Task 9b) |
   | `resend_for_approval` | `20261020120300_staff_shop_actions.sql:379` |
   | `remove_role` | `20261021120600_own_shop_mentor.sql:20` |
   | `give_role`, `add_pickup_point`, `rename_pickup_point`, `retire_pickup_point`, `restore_pickup_point`, `add_hub_photo`, `save_hub_post`, `rsvp`, `cancel_rsvp`, `request_slot`, `answer_booking`, `add_mentor_note`, `add_check_in` | `20261020120400_staff_tools_actions.sql:859`, `:190`, `:225`, `:258`, `:285`, `:428`, `:485`, `:616`, `:645`, `:666`, `:711`, `:796`, `:815` |
   | `admin_weekly_counts` | `20261020120800_numbers.sql:48` |
   | `follower_count`, `request_offer_count` | `20261020120200_community_tables.sql:309`, `:292` |
   | views `my_requests`, `staff_reports`, `staff_seller_profiles`, `staff_hub_posts`, `request_cards` | `20261021120100_requests_closing.sql:55`, `20261021120800_review_fixes_2b.sql`, `20261020120100_staff_tables.sql:396`, `:380`, `20261021120700_public_reads.sql:46` |

7. **Callers.** `grep -rn "isOwnShop\|isOwnListing\|isOwnRequest\|ownsTarget\|ownShopMentorId" app components lib | grep -v "\.test\."` lists the callers Task 12 moves to async checks:
   - three `app/admin/sellers/[slug]` pages;
   - `app/admin/staff/page.tsx`;
   - `lib/staff/admin-actions.ts` (8 calls);
   - `lib/staff/own.ts`;
   - inside `lib/data`: `featured.ts`, `staff-reports.ts` and `staff-accounts.ts`.

   If there are more, add them to Task 12's list.
8. **`countAdmins()` is called only for an admin.** On `app/account/privacy/page.tsx:45`, `account.roles.includes("admin") && …` must still guard it: a non-staff session reads only its own profile, so the count would be wrong.
9. **`lib/data/supabase/rows.ts`** exports `AsyncTwin`, `iso`, `campusToDb`, `campusFromDb`, `photoSrc` and `selectAll`. `tests/contract/world.ts` has C1's verbs: `hideListing`, `pauseShop`, `draftListing`, `retirePickupPoint`, `addRequest`, `addRsvp`, `recordDraw`, `addPin` and `notificationsOf`.

---

## What exists, and what each module needs

### C4

| Module | Reads on Supabase | Writes on Supabase |
|---|---|---|
| `requests.ts` (C1 has the public reads and `settleRequests`) | `getOwnRequest`, `listOwnRequests`, `countOpenRequests`, `countRequestsSince`, `exportRequests` from `my_requests` (viewer), each settling first where the sample does; `requestAskerId` via `forServer()` (decision 9) | `createRequest`/`updateRequest` → `save_request`; `setRequestOpen` → `set_request_open`; `deleteRequest` → `delete_request`; `hideRequest`/`showRequest` → `hide_request`/`show_request` (C5's callers; the twin lives here). `forgetRequestsOf` throws (`forget_account` does it) |
| `offers.ts` (request side) | `findOffer`, `countOffersSince` from `my_conversations` (viewer, the shop's owner); `offersForRequest` from **`my_request_offers`** (new, Task 1) and the asker's `messages` | none (`startOffer` is C3's) |
| `follows.ts` | `isFollowing`, `listFollowedShops`, `shopNameOf`, `exportFollowing` from **`my_follows`** (new); `countFollowers` → `follower_count` | `addFollow` → `follow_shop`; `removeFollow` → `unfollow_shop`; `notifyFollowers`: a no-op returning 0 (decision 10); `forgetFollowsOf` throws |
| `saved-searches.ts` | `getSaveSearchState`, `listSavedSearches`, `exportSavedSearches` from `saved_searches` (viewer) | `addSavedSearch` → `save_search`; `setSavedSearchPaused` → `set_search_paused`; `deleteSavedSearch` → `delete_search`; `notifySavedSearches`: TypeScript matching, then `record_search_matches` via `forServer()` (decision 9); `forgetSavedSearchesOf` throws |
| `notifications.ts` | C3's | `notifyNewListing`, `notifySearchMatch` and `notifyOncePerDay` run only in SQL on Supabase (`private.notify_once_per_day`, inside `tell_followers` and `record_search_matches`); C4 needs no TypeScript twin of them |

### C5

| Module | Reads on Supabase | Writes on Supabase |
|---|---|---|
| `audit.ts` | `listAudit`, `auditStaff` from `audit_log` (admins' policy) | `recordAudit` throws: the staff functions write the row (decision 3) |
| `staff-shops.ts` | `listShopsForReview`, `getShopForReview`, `countWaitingShops`, `listMentors`, `shopStanding` through `shops`, `staff_seller_profiles`, `profiles` (decision 11); new async `ownsShop`, `ownsListing`, `ownsRequest` (decision 5) | `approveShop`, `declineShop`, `setVerified`, `staffPauseShop`, `staffResumeShop`, `setShopMentor`, `hideListing`, `showListing`, `resendForApproval` → the functions of the same names |
| `staff-reports.ts` | `listReports`, `getReport` (with `own` from the view), `openReportCount`, `listHidden`, `getHidden`, `countHidden` | `closeReport` → `dismiss_report`; `closeReportsOn` and `closeReportsAboutShop` throw (the hide and pause functions close the reports themselves) |
| `mentors.ts` | `mentoredShops`, `getMentoredShop` (with C1's `recentCounts`), `listNotes` | `addNote` → `add_mentor_note` / `add_check_in` with the token (decision 6) |
| `hub-posts.ts` (C1 has the public reads) | `listPostsForStaff`, `getPostRow` from `staff_hub_posts`; `listBookings`, `openBookingCount`, `latestBooking`, `hasRsvp` | `saveHubPost` → `save_hub_post` (with the cover's id and the token); `addRsvp` → `rsvp`; `removeRsvp` → `cancel_rsvp`; `requestSlot` → `request_slot`; `answerBooking` → `answer_booking` |
| `staff-accounts.ts` | `listStaffAccounts`, `getStaffAccount` from **`staff_accounts`** (new); `countAdmins`, `removeMentorView`, new async `ownShopMentor` | `giveRole` → `give_role` (with the token); `removeRole` → `remove_role` |
| `numbers.ts` | `countByWeek` → `admin_weekly_counts` via `forServer()`, turned into `RawCounts`; `protectCounts` unchanged in `lib/staff/numbers.ts` | none |
| `staff-privacy.ts` | `exportStaffToolsData` (viewer: own RSVPs and slot requests; never notes) | `forgetAccountInStaffTools` throws |
| `featured.ts` (C1 has `featuredFor`) | `featuredChoices`, `getPin`, `listPins` | `addPin` → `pin_shop`; `removePin` → `unpin_shop` |
| `pickup-points.ts` (C1 has the public reads) | `listPickupPoints`, `isPointNameTaken` | `addPickupPoint`, `renamePickupPoint`, `retirePickupPoint`, `restorePickupPoint` → the four functions |
| `form-states.ts` (phase B's file) | | `takeFormState`'s twin → **`take_form_state`** (new), for the one-time tokens SQL doesn't take itself (decision 6) |
| `accounts.ts` (phase B's file) | `findAccountByEmail` is phase B's and throws on Supabase; the give-role form's check uses **`staff_find_account`** (new) through `staff-accounts.ts` | |

### Missing SQL (Task 1 adds it)

1. **`public.my_follows`.**
   - **Who needs it:** Saved's Shops tab must list a followed shop the Hub has paused, by name, with no storefront (community actions amendment 17.6). The follower can't read that shop's row: the shops policy shows only `shop_is_public` shops to others. Unfollow and the data download need it too.
   - **What it gives:** the signed-in account's follows, each with the shop's id, link, name, category, campus, image columns, status and whether it has a storefront.
2. **`public.my_request_offers`.**
   - **Who needs it:** the asker's list of offers names each shop. A shop the Hub paused is unreadable to the asker, so today it would show as "A closed shop" (`offers.ts:41` names it while it exists).
   - **What it gives:** for the signed-in asker's requests only, each offer thread's id, request, time and shop name (null once the seller has gone).
   - **C3:** its inbox has the same gap for a Hub-paused shop's name. It can read this view's pattern, or append a column to `my_conversations` itself. This plan doesn't touch `my_conversations`.
3. **`public.staff_accounts`.** `listStaffAccounts` and `getStaffAccount` show each staff member's email (stage J spec decision 2), and no API role can read `auth.users`. The view gives admins only, and only accounts that hold a role: id, first name, lower-case email, campus and roles.
4. **`public.staff_find_account(p_email)`.** Give a staff role checks the email and the role held before it takes the token (`account-actions.ts:61`). The function is an exact lookup, trimmed and lower-cased, never a search. For admins only, it returns the account's id, first name and roles.
5. **`public.take_form_state(p_form)`.**
   - **Who needs it:** `authenticated` can't set `form_states.taken` the way `takeFormState` does. Phase B's decision 15 makes it throw until phase C replaces its callers. Two callers take a token that no SQL function takes:
     - save this search (`lib/saved-searches/actions.ts:48`);
     - C2's new listing (`lib/selling/form-state.ts:99`, form `listing-once:<token>`).
   - **What it does:** it generalises `private.take_once_token` (which only knows `staff-once:`) to the signed-in session's own `staff-once:` or `listing-once:` row. It returns `first`, `again` or `none`.

Nothing else is missing. Every write the C4 and C5 modules make has a function, every staff read has a policy or view, and the gates are in SQL (step 2b). The SQL has none of the wording rules, which stay pinned twice.

---

## Decisions made in this plan (for Lama to confirm or veto)

1. **The C0 and C1 pattern, unchanged.**
   - Each module keeps its code and exports. Its Supabase twin is `lib/data/supabase/<module>.ts`, typed `typeof Sample.<fn>`, or `AsyncTwin<typeof Sample.<fn>>` for a synchronous sample function.
   - It's loaded with `import()` behind `onSupabase()`, one line at the top of each switched function.
   - Sample mode never loads Supabase code (`boundaries.test.ts`).
   - New exports (`ownsShop`, `ownsListing`, `ownsRequest`, `ownShopMentor`) get a sample body too.
2. **Writes go through the existing functions, with the viewer's session.**
   - **Who's asking:** every twin that writes or reads someone's own rows gets its client from `forViewerAs(accountId)`. That is `forViewer()` after checking that `accountId` is the session's user (2b decision 20).
   - **Mapping the result:** the function's text or jsonb result maps onto the sample's return shape:
     - `'nothing'` and `'not-found'` become null or false, as the sample's;
     - unions the sample already has pass through (`'held'`, `'own-admin'`, `'full'`…).
   - **Results the sample's shape can't carry** throw `Refused(code)`, from a plain module, `lib/data/refused.ts`. The codes: `forbidden`, `own-shop`, `own-request`, `once-expired`, `once-taken`, `open-limit`, `daily-limit`, `reopen-limit`, `day-past`, `day-far`, `date-past`, `cover-invalid`, `check-in-day-future`.
   - **Catching them:** actions catch `Refused` only at named places (each task lists them) and rethrow anything else. So Next's redirects pass through, and an unexpected code fails loudly.
3. **On Supabase a staff action's write, audit row, report closes and notifications are one transaction.**
   - In each staff action, the sample's follow-ups (`recordAudit`, `closeReportsOn`, `closeReportsAboutShop`, `notify`, `tellOwner`, `tellReporter`) run inside `sampleFollowUps(async () => …)`, from a new `lib/staff/follow-ups.ts`. It runs the callback only on the sample backend.
   - The twins of `recordAudit`, `closeReportsOn` and `closeReportsAboutShop` throw, so a missed wrap fails in the db tests.
   - The action contract tests (decision 13) count audit rows and notifications exactly, so a double write fails too.
   - The order CLAUDE.md gives still holds on both backends:
     - role first;
     - one audit row only when something changed;
     - the notifications;
     - the tag;
     - `done()`.
4. **Staff actions start with `requireStaffAction(area, nextPath)`** (`lib/staff/access.ts`): phase B's `requireLiveAccount(nextPath)`, then `canUse(account, area)` or `notFound()`.
   - On the sample backend `requireLiveAccount` is `requireAccount`, so behaviour is unchanged.
   - On Supabase it re-checks the session with Auth (`getUser()`, spec 5).
   - Pages and the mentor CSV route (a read) keep `requireStaff`.
   - A `'forbidden'` from SQL (a role removed between the check and the write) becomes the same 404, through one helper (`orNotFound`).
   - CLAUDE.md's "`requireStaff()` first" line becomes "`requireStaffAction()` first" at merge.
5. **Whose it is, asynchronously, on both backends.**
   - The synchronous `isOwnShop`, `isOwnListing`, `isOwnRequest` and `ownShopMentorId` stay as sample internals, with their tests.
   - Callers outside `lib/data` use new async exports: `ownsShop(accountId, slug)`, `ownsListing(accountId, id)` and `ownsRequest(accountId, id)` in `staff-shops.ts`, and `ownShopMentor(ownerId)` in `staff-accounts.ts`.
   - `lib/staff/own.ts`'s `ownsTarget` becomes async.
   - **On Supabase, ownership reads `seller_profiles.shop_id → account_id`**, phase A's `owns_shop` rule. Admins read every seller profile; owners read their own. Never `shops.owner_id`, which no API role is granted. A request is yours when `my_requests` holds it.
   - The SQL gates (step 2b decision 7) stay the authority. The TypeScript check only decides what the page shows and lets the action refuse before the call. Owners never change, so the two can't disagree, except where a shop is deleted and recreated on the same link. There the SQL's own `Refused` is mapped to the same `refuseOwn`.
6. **One-time tokens on Supabase.**
   - **Five functions take the token in the same transaction as their write:** `save_request`, `save_hub_post`, `add_mentor_note`, `add_check_in` and `give_role`.
     - The data functions behind them gain an optional token: a field `onceToken` on `createRequest`'s and `saveHubPost`'s argument objects, and an optional last argument on `addNote` and `giveRole`. The sample ignores it.
     - On Supabase their actions don't call `takeOnceToken` (`tokenTakenInSql()` in `lib/staff/once.ts`). They pass the token, and map `Refused('once-expired' | 'once-taken')` to today's `none` and `again` branches, with `sentOnceToken` for where the first send went.
   - **Every other token** (save this search, C2's new listing) is taken through `takeFormState`. Its Supabase twin calls the new `take_form_state`, so `lib/staff/once.ts`'s `takeOnceToken` and `lib/selling/form-state.ts` need no change for them.
   - `leaveOnceToken` saves `taken: true` through phase B's `saveFormState`. The trigger keeps `taken`, which only ever goes from false to true.
7. **Limits are counted twice, as now.**
   - The action's TypeScript counts stay for the form's errors: `countOpenRequests`, `countRequestsSince`, `countOffersSince`, `isPointNameTaken` and the pin checks.
   - The SQL counts under its advisory lock are the backstop.
   - A backstop refusal, which only a race can reach, throws `Refused(code)`, and the action shows the same error as its own check would.
8. **Requests settle first.**
   - The asker's reads (`getOwnRequest`, `listOwnRequests`, `countOpenRequests`), every request action and the data download keep calling the switched `settleRequests(now)` first. That is C1's RPC through `forServer()`, from request-time code only.
   - The twins of `setRequestOpen` and `hideRequest` also settle before their call, as Task 9b's note and 2b amendment 18 say. `set_request_open` and `hide_request` treat a due, unsettled request as still open. A second settle in the same action finds nothing.
   - No twin settles inside `"use cache"`.
9. **Admin-client reads added** (request-time only, never in `"use cache"`; listed in `clients.ts`'s comment). Each needs rows no API role may read, and only an outcome leaves the server:
   - `notifySavedSearches` reads every active saved search, and the listing's owner to leave out. It calls `record_search_matches`, which is service-role only by design (step 2 plan decision 4). Saved searches are never shown to anyone but their owner.
   - `requestAskerId` reads one request's `asker_id` for the offer composer's status. The id is compared with the viewer's and handed to C3's `startOffer`, whose SQL derives the asker itself. It never reaches a page.
   - `countByWeek` calls `admin_weekly_counts`, as spec amendment 12 says, after `requireStaff('admin')`, and passes the result straight to `protectCounts`.
   - `mentoredShops` uses C1's `recentCounts` (already admin-client).
10. **`notifyFollowers` on Supabase is a no-op returning 0.**
    - `save_listing` tells the followers inside C2's save, through `private.tell_followers` and `notify_once_per_day`, under the same condition as `saveListingForm`: a first publish by an approved shop of a listing the Hub hasn't hidden.
    - `saveListingForm` keeps its call order unchanged (C2's file), so the TypeScript and the SQL can't disagree about what's new.
    - A C4 contract scenario proves followers are told once, then "listed 2 new things", on both backends.
11. **Staff views are built "over a source", as 2b decision 17 did for the catalog.**
    - `staff-reports.ts`'s `toView` and `staff-shops.ts`'s `review` become pure functions over lookups: listings, shops, requests, seller profiles, first names and `own`. The sample builds the lookups from the store; the twin builds them from Supabase reads.
    - So the rules (`exists`, `unseen`, `can.hide`, `can.pause`, standing) stay in one place, and parity holds.
    - On Supabase, a report's `own` comes from `staff_reports.own` (Task 9b's one-argument `report_own_kind`), and only when the twin is given the viewer.
12. **The new SQL is read-only and answers only about the signed-in account or only for admins.**
    - Each view is `security_invoker` over a `private` `security definer` function with `search_path = ''`. Every function is revoked from `public` and `anon`, and granted only as Task 1 lists.
    - `take_form_state` touches only the caller's own session's one-time-token rows.
13. **Contract tests at two levels.**
    - **Data contracts** (`lib/data/contract/<area>.contract.ts`, run by `.test.ts` and `.db.test.ts`): a twin and its sample function give the same answer and leave the same state.
    - **Action contracts** (`lib/staff/contract/*.contract.ts` and `lib/looking-for/contract/*.contract.ts`): the real Server Action runs on both worlds, with the session seam set to a world account. They cover:
      - every staff gate CLAUDE.md names (role, own-shop, own-request, own-shop-mentor, own admin role, the last admin, roles by exact email only);
      - the one-time tokens;
      - "one audit row only when something changed";
      - settle-first.

      Gates live in the action on the sample backend and in SQL on Supabase, so only an action-level test proves both.
    - **Every refusal asserts that nothing changed:**
      - the target row;
      - the audit rows (a count);
      - the notifications of everyone involved;
      - the cache tag (not expired).
14. **The world's accounts stay three** (`asker`, `shopper`, `staff`), so no new session is minted and Auth's verification limit is untouched. Roles, shops, listings, reports, posts and tokens are made per test by verbs with undos (Task 3), for example `setRoles("asker", ["admin"])` for a second admin, or `openShop("staff")` for an admin who owns a shop. Roles are read from `profiles` on each request (spec 4.3), so a role changed by a verb works with the session minted at setup.
15. **Parity's `normalise` learns the seed's other uuids:** accounts, reports, bookings, notes, pins and posts with a uuid id. They come from `scripts/seed-sql.ts`'s `seedUuid`, added by the first task that needs each. The staff parity tests drop the three contract accounts from both answers.
16. **Deletion and the download.**
    - The `forget…Of` twins and `forgetAccountInStaffTools` throw "forget_account does this (phase B's deleteAccountData)". Phase B's Supabase `deleteAccountData` calls only `forget_account`.
    - The export twins read with the viewer's session. `exportAccountData` (phase B's file) already settles before `exportRequests` (`accounts.ts:201`), so no change is needed there.
    - Mentors' notes are never in the download. The export has no field for them, and a db test proves the subject's own session reads no note about them (`mentor_notes`' policy).
17. **Tags unchanged.** Each action keeps its tag call, after the write and before `done()`. The table in Task 22 lists them. Two follow from the catalog snapshot's tags (`listings` and `sellers`, 2b amendment 14):
    - Show again and Hide the listing expire `listings`;
    - Approve, Verify, Pause and Resume expire `sellers`.

    Featured, roles, follows, saved searches and mentors' notes expire nothing, as now.
18. **A Hub cover** is stored by C2's photo-file helper on Supabase: `add_hub_photo`, then the Storage upload with the admin client. `save_hub_post` takes the cover's id and returns `removed_paths`, which C2's removal helper deletes from Storage. The sample's `attachPhotos` and `deletePhotosUsedBy` calls in `savePost` move into `sampleFollowUps`, because the function does them.
19. **The last admin.**
    - Neither backend reaches "last admin" one action at a time: "own admin role" comes first. Only two admins removing each other at once reach it.
    - **On the sample backend** the second removal answers `last-admin`.
    - **On Supabase** the second waits for the lock and finds its own role gone (`forbidden`), which the action turns into the 404. That is right, since it is no longer an admin.
    - The contract scenario asserts what matters on both: one removal lands, the other changes nothing, and one admin remains.
20. **Step 5 signs the sample personas in with minted sessions, not email codes.**
    - The app allows 5 codes an hour per email, and Supabase allows one code a minute per address. The suite signs the same five personas in about 135 times per project.
    - So on Supabase, `signInAsSample` mints a fresh session for the persona in the test process (`tests/db/accounts.ts`'s way) and sets the `vossie_auth` cookies through `@supabase/ssr`'s own encoding.
    - Fresh accounts still sign up through the real form, with the code read from Mailpit.

## Open questions for Lama

1. **Decision 9's two admin-client reads.**
   - Matching saved searches and the offer composer's asker check both read with the secret key, server-side. The alternative for the asker check is a function `request_offer_side(p_request)` returning `own`, `sample` or `other`, plus a change to `offerStatus`.
   - Recommended: the admin read. It's one row, request-time, and the id never leaves the server.
2. **A student's download names a draft post "A removed post"** on Supabase if the event or office hours they RSVP'd to (or asked a slot of) has since been put back to draft. Students can't read a draft's title; the sample store names it.
   - Recommended: accept. A published post going back to draft is rare, and the RSVP itself is still listed.
3. **`cover-invalid`.** A Hub cover can pass its 24-hour window in the moment between the editor's check and the save. Recommended: show the editor's existing "This form is out of date…" words (`once-expired`), with the cover cleared and everything typed kept, rather than add new words.
4. **`my_request_offers` and C3.** Should C3's inbox use the same approach (a definer view naming the shop) for a Hub-paused shop's threads? That's C3's to decide. Recommended: yes, so the two lists can't differ.

## Shared files

| File | Who else writes it | How |
|---|---|---|
| `lib/data/supabase/requests.ts`, `hub-posts.ts`, `featured.ts`, `pickup-points.ts` | C1 (creates them) | C4 and C5 append twins after C1's tasks are committed; C1's functions are unchanged |
| `lib/data/supabase/clients.ts` | C0, phase B (`forViewer`), C2/C3 | Task 2 adds `viewerId()` (phase B wires it to `currentClaims()`; the db tests' `withViewerSeam` mocks it) and `forViewerAs(accountId)`, unless C2/C3 add the same first. Then use theirs. The comment's list of admin-client uses gains decision 9's |
| `lib/data/supabase/form-states.ts` | phase B (creates it) | Task 2 replaces the `takeFormState` stub that throws with the `take_form_state` twin, after phase B's Task 4; tell C2, whose new listing uses it |
| `lib/data/notifications.ts`, its twin | C3 owns | C4 and C5 need nothing in it. Recommended to C3: the twins of `notify`, `notifyNewListing`, `notifySearchMatch`, `deleteNotificationsAbout` and `deleteNotifications` throw "runs in SQL", so a missed `sampleFollowUps` fails loudly |
| `lib/data/messages.ts`, its twin | C3 owns | C3's `startOffer` twin ignores `askerId` (`start_offer` derives it). C3's thread view replaces `requestIsHidden` (`messages.ts:467`) with `my_conversations.request_state`; C4 adds no twin of `requestIsHidden` |
| `lib/data/photos.ts`, its twin | C2 owns | Task 18 calls C2's helpers for a Hub cover (store, removal) |
| `lib/selling/listing-actions.ts` | C2 owns | Unchanged here. C2 keeps `notifyFollowers` (a no-op on Supabase) and `notifySavedSearches` in place, after the save, under the same condition |
| `lib/selling/form-state.ts`, `lib/selling/action-helpers.ts` | C2 | Not edited here |
| `lib/data/accounts.ts`, `lib/auth/*` | phase B owns | Not edited here. Task 20 uses `staff_find_account` through `staff-accounts.ts` instead of `findAccountByEmail` |
| `tests/contract/world.ts`, `sample-world.ts`, `tests/db/supabase-world.ts`, `tests/db/parity.ts` | C1, C2, C3 | Task 3 adds C4 and C5's verbs in one go; the names are proposed to C2/C3 (`openShop`, `addListing`, `publishListing`, `addReport`, `setRoles`, `viewerAccount`, `signIn`, `issueOnceToken`, `auditCount`). Whoever lands second rebases; no verb is defined twice |
| `supabase/migrations/*`, `supabase/tests/06_account_actions.test.sql`, `21_grants.test.sql` | phase B, C2/C3 | Task 1's migration sorts after the last one present (Recheck 4); the two allowlist tests are edited by one task at a time |
| `lib/supabase/database.types.ts` | everyone | Regenerated (`pnpm db:types`), never merged by hand |
| `supabase/config.toml` | phase B (Task 10) | Step 5 needs local-only Auth limits raised (Task 23); phase B's Task 10 writes them, or Task 23 does after it |
| `tests/e2e/helpers/*`, `playwright.config.ts` | phase B (Task 11, the sign-in specs) | Task 23 |
| `CLAUDE.md`, `GO-LIVE.md`, `docs/PROGRESS.md` | main's sessions | Written on main at merge time; Task 22 prepares the lines |

## Order, and files each task writes

Tasks that write the same file run one after another; the rest may run side by side, one implementer per task.

| Task | Writes | After |
|---|---|---|
| 0 Baseline | nothing | |
| 1 Missing SQL | `supabase/migrations/20261023120000_c4_c5_reads.sql`, `supabase/tests/50_c4_c5_reads.test.sql`, `supabase/tests/06_account_actions.test.sql`, `supabase/tests/21_grants.test.sql`, `lib/supabase/database.types.ts` | 0 |
| 2 Shared seams | `lib/data/refused.ts` (+ test), `lib/staff/follow-ups.ts` (+ test), `lib/staff/once.ts` (+ test), `lib/staff/access.ts` (+ test), `lib/data/supabase/clients.ts`, `lib/data/supabase/form-states.ts`, `lib/data/form-states.ts`, `tests/db/viewer.ts`, `lib/data/contract/form-states.*` | 1; phase B Tasks 4 and 5 |
| 3 World verbs and the action harness | `tests/contract/world.ts`, `tests/contract/sample-world.ts`, `tests/db/supabase-world.ts`, `tests/db/parity.ts`, `tests/contract/actions.ts`, `tests/db/actions.ts`, `lib/data/contract/world.*` | 1 |
| 4 Requests: writes and the asker's reads | `lib/data/requests.ts`, `lib/data/supabase/requests.ts`, `lib/data/contract/requests-own.*` | 2, 3 |
| 5 Offers (request side) | `lib/data/offers.ts`, `lib/data/supabase/offers.ts`, `lib/data/contract/offers.*` | 4 |
| 6 Looking For actions on Supabase | `lib/looking-for/actions.ts` (+ test), `lib/looking-for/contract/actions.*` | 4, 5 |
| 7 Follows | `lib/data/follows.ts`, `lib/data/supabase/follows.ts`, `lib/data/contract/follows.*`, `lib/following/actions.ts` (+ test) | 3 |
| 8 Saved searches and alerts | `lib/data/saved-searches.ts`, `lib/data/supabase/saved-searches.ts`, `lib/data/contract/alerts.*`, `lib/saved-searches/actions.ts` (only if Task 2's twin needs a change there; expected none) | 2, 3, 7 (shared scenario helpers) |
| 9 C4 check | `lib/data/contract/c4-download.db.test.ts`, this plan | 4 to 8 |
| 10 (reserved: review of C4, read-only) | nothing | 9 |
| 11 (reserved: C4 fixes) | as found | 10 |
| 12 Async ownership and the follow-up wrap | `lib/data/staff-shops.ts`, `lib/data/staff-accounts.ts`, `lib/staff/own.ts` (+ test), `lib/staff/admin-actions.ts`, `lib/staff/hub-actions.ts`, `lib/staff/mentor-actions.ts`, `lib/staff/account-actions.ts`, `lib/hub-actions.ts`, the four app pages from Recheck 7, their tests | 2 |
| 13 Audit | `lib/data/audit.ts`, `lib/data/supabase/audit.ts`, `lib/data/contract/audit.*` | 3, 12 |
| 14 Staff shops | `lib/data/staff-shops.ts`, `lib/data/supabase/staff-shops.ts`, `lib/data/contract/staff-shops.*` | 12, 13 |
| 15 Staff reports and Show again's reads | `lib/data/staff-reports.ts`, `lib/data/supabase/staff-reports.ts`, `lib/data/contract/staff-reports.*` | 14 |
| 16 Admin actions on Supabase | `lib/staff/admin-actions.ts` (+ test), `lib/staff/contract/admin-gates.*` | 14, 15, 17 |
| 17 Featured pins and pickup points | `lib/data/featured.ts`, `lib/data/pickup-points.ts`, `lib/data/supabase/featured.ts`, `lib/data/supabase/pickup-points.ts`, `lib/data/contract/pins-points.*` | 12 |
| 18 The Hub | `lib/data/hub-posts.ts`, `lib/data/supabase/hub-posts.ts`, `lib/staff/hub-actions.ts`, `lib/hub-actions.ts`, `lib/data/contract/hub-staff.*`, `lib/staff/contract/hub.*` | 12, C2's photo helpers |
| 19 Mentors | `lib/data/mentors.ts`, `lib/data/supabase/mentors.ts`, `lib/staff/mentor-actions.ts`, `lib/data/contract/mentors.*`, `lib/staff/contract/mentor.*` | 12, 14 |
| 20 Staff accounts | `lib/data/staff-accounts.ts`, `lib/data/supabase/staff-accounts.ts`, `lib/staff/account-actions.ts`, `lib/data/contract/staff-accounts.*`, `lib/staff/contract/roles.*` | 12, 14 |
| 21 Numbers and the staff tools' privacy | `lib/data/numbers.ts`, `lib/data/supabase/numbers.ts`, `lib/data/staff-privacy.ts`, `lib/data/supabase/staff-privacy.ts`, `lib/data/contract/numbers.*`, `lib/data/contract/staff-privacy.*` | 3 |
| 22 C5 check, JS budget, docs | `lib/data/contract/tags.test.ts`, this plan, the programme plan | 13 to 21 |
| 23 Step 5: the e2e suite on Supabase | `scripts/e2e-supabase.ts`, `package.json`, `tests/e2e/helpers/supabase-session.ts`, `tests/e2e/helpers/messaging.ts`, `tests/e2e/helpers/staff.ts`, `tests/e2e/helpers/staff-accounts.ts`, the specs listed there, `.gitignore` only if a file is added | 22, phase B complete, C2 and C3 complete |

- `lib/staff/admin-actions.ts` is written by 12 and then 16, in that order.
- `lib/data/staff-shops.ts` is written by 12 and then 14; `staff-accounts.ts` by 12 and then 20.
- `hub-actions.ts` by 12 and then 18; `mentor-actions.ts` by 12 and then 19.
- C4 (Tasks 4 to 9) and C5's data tasks (13, 14, 15, 17, 19 to 21) may run side by side after 3 and 12.

## Shared commands

- **SQL (Task 1):** `supabase db reset` (local, after the stack check), then `supabase test db`; a single file with `supabase test db supabase/tests/50_c4_c5_reads.test.sql`; `supabase db lint`; `supabase db advisors --local --type all`.
- **TypeScript:**
  - `pnpm lint`, `pnpm typecheck`, `pnpm test` (sample: unit, data contracts, action contracts);
  - `pnpm test:db` after a fresh `supabase db reset` (the same contracts on the local stack);
  - single files: `pnpm vitest run <path>`, or `pnpm vitest run --config vitest.db.config.mts <path>`.
- **The wording rule:** no new sentence is built in SQL here. Every notification and audit wording is already pinned twice (step 2), and the action contracts compare the notification text each backend writes.

---

## Task 0: Baseline

1. Run "Recheck before starting" 1 to 9.
2. Record in the ledger: HEAD, the pgTAP, unit and db counts, and which of phase B, C1, C2 and C3 are in the branch.

## Task 1: The missing SQL (decision 12)

**Files:** `supabase/migrations/20261023120000_c4_c5_reads.sql`, `supabase/tests/50_c4_c5_reads.test.sql`, `supabase/tests/06_account_actions.test.sql` (allowlists), `supabase/tests/21_grants.test.sql` (only if its view or function lists name these), `lib/supabase/database.types.ts` (regenerated).

The number follows the programme's scheme (amendment 2): after C2/C3's `20261022120200`, since `take_form_state` may reuse C2's `private.take_form_once` (amendment 5). If a later migration exists when this task starts, rename to sort after it.

**Failing test first:** `50_c4_c5_reads.test.sql`, about 55 tests. Accounts use `pg_temp` helpers and `pg_temp.sign_in` as tests 18 and 29 do. The fixture:
- a follower F;
- shops: approved A, seller-paused SP, Hub-paused HP, waiting W, and a sample shop S with no owner;
- F follows each of them;
- an asker Q with a request R that has offer threads from A and from a shop whose seller has gone;
- an admin AD, a mentor M and a student T.

1. **`my_follows`, as F:**
   - 5 rows (A, SP, HP, W, S), each with its `slug` and `name`;
   - `status`: `approved` for A and S, `paused` for SP and HP, `pending` for W;
   - `storefront`: true for A, SP and S, false for HP and W;
   - `followed_at` is the follow's `created_at`;
   - the image and category columns equal the shop's;
   - no `account_id`, `owner_id` or `mentor_id` column (checked in `information_schema.columns`);
   - as T: no row. As anon: permission denied;
   - `security_invoker` in `pg_class.reloptions`.
2. **`my_request_offers`:**
   - as Q: two rows for R, with `shop_name` A's name and null for the gone seller;
   - newest first by `created_at` when ordered;
   - a plain enquiry to A by Q isn't listed;
   - as A's owner: no row, though they're in the thread;
   - as T: none;
   - after the Hub pauses A, Q still reads A's name;
   - `security_invoker`.
3. **`staff_accounts`:**
   - as AD: every profile with a role, the email lower case (an Auth user made with `Mixed@Vossie.Test` reads `mixed@vossie.test`), campus and roles in stored order;
   - T (no role) is absent;
   - as M: no row. As T: no row. As anon: permission denied;
   - `security_invoker`.
4. **`staff_find_account(p_email)`:**
   - as AD: `' T@Vossie.Test '` finds T (id, first name, roles `{}`);
   - `'t@vossie'` and `'@vossie.test'` find nothing (exact only, no prefix or pattern);
   - an Auth user with no profile finds nothing;
   - as M or T: nothing (no error, no hint);
   - anon can't execute.
5. **`take_form_state(p_form)`:**
   - as T, with a `form_states` row for T's JWT `session_id`, form `staff-once:<uuid>`, not taken: `first`, and the row is now taken;
   - again: `again`;
   - `listing-once:<uuid>`: the same;
   - a row of another session, or another account's: `none`;
   - a run-out row: `none`;
   - a form that isn't a one-time token (`listing:new`, `staff-once:x`): `none`, and nothing changes;
   - no session: `none`;
   - anon can't execute.
6. **Grants:**
   - the three views: select to `authenticated` and `service_role` only;
   - the two functions: execute to `authenticated` and `service_role` only;
   - the private helpers are revoked from `public` and `anon`.

   Test 06's authenticated lists gain `public.staff_find_account(text)`, `public.take_form_state(text)` and the three `private.*` helpers. `21_grants` changes only if its allowlists name views or authenticated functions.

**Implementation** (header cites this plan's decision 12, `follows.ts:61`, `offers.ts:39`, `staff-accounts.ts:72`, `account-actions.ts:61`, `once.ts:65`, `lib/selling/form-state.ts:99`):

```sql
-- The signed-in account's follows, with what Saved's Shops tab, Unfollow and the data download show of each shop
-- (listFollowedShops, shopNameOf, exportFollowing; community actions amendment 17.6): a shop the Hub paused is listed by
-- name, without a storefront, so its follower can unfollow it. Nothing about the shop's owner or mentor.
create function private.my_follows()
returns table (
  shop_id uuid, slug text, name text, category_slug text, campus_slug text, image_photo_id uuid,
  image_placeholder text, image_alt text, status text, storefront boolean, followed_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.slug, s.name, s.category_slug, s.campus_slug, s.image_photo_id, s.image_placeholder, s.image_alt,
    private.shop_status(s.id), private.shop_has_storefront(s.id), f.created_at
  from public.follows f join public.shops s on s.id = f.shop_id
  where f.account_id = (select auth.uid());
$$;
create view public.my_follows with (security_invoker = true) as select * from private.my_follows();

-- The asker's offers on their own requests (offersForRequest), naming each shop while it's there, a shop the Hub paused
-- included; null once the seller has gone ("A closed shop"). The first line comes from messages, which the asker reads.
create function private.my_request_offers()
returns table (conversation_id uuid, request_id text, created_at timestamptz, shop_name text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.request_id, c.created_at, case when c.seller_gone then null else s.name end
  from public.conversations c left join public.shops s on s.id = c.shop_id
  where c.is_offer and c.request_id is not null and private.is_my_request(c.request_id);
$$;
create view public.my_request_offers with (security_invoker = true) as select * from private.my_request_offers();

-- Staff accounts (listStaffAccounts, getStaffAccount; stage J spec decision 2): for admins only, everyone with a role
-- and no one else, with the email roles are given by. Students without a role are never listed (POPIA section 10).
create function private.staff_accounts()
returns table (id uuid, first_name text, email text, campus_slug text, roles text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.first_name, lower(u.email), p.campus_slug, p.roles
  from public.profiles p join auth.users u on u.id = p.id
  where cardinality(p.roles) > 0 and (select private.is_staff('admin'));
$$;
create view public.staff_accounts with (security_invoker = true) as select * from private.staff_accounts();

-- Give a staff role's check (giveStaffRole, account-actions.ts:61): the account with exactly this email, trimmed and lower
-- case (normaliseEmail), never a search; for admins only. No row for anyone else, or an address with no profile.
create function public.staff_find_account(p_email text)
returns table (id uuid, first_name text, roles text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.first_name, p.roles
  from public.profiles p join auth.users u on u.id = p.id
  where (select private.is_staff('admin')) and lower(btrim(coalesce(p_email, ''))) <> ''
    and lower(u.email) = lower(btrim(p_email));
$$;

-- Takes one of this session's one-time tokens (takeFormState, lib/data/form-states.ts:35) for a form whose own SQL
-- function doesn't take it: save this search (staff-once:) and a new listing (listing-once:). private.take_once_token's
-- rule, for both prefixes: the row of the JWT's session and the signed-in account, while it lasts, checked and marked
-- under the row's lock. Returns 'first' | 'again' | 'none'. Any other form name is 'none' and changes nothing.
create function public.take_form_state(p_form text)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  sid text := (select auth.jwt()) ->> 'session_id';
  was boolean;
begin
  if p_form is null or p_form !~ '^(staff-once|listing-once):[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or sid is null or sid !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    return 'none';
  end if;
  select f.taken into was from public.form_states f
  where f.session_id = sid::uuid and f.form = p_form and f.account_id = (select auth.uid()) and f.expires_at > now()
  for update;
  if not found then return 'none'; end if;
  if was then return 'again'; end if;
  update public.form_states f set taken = true where f.session_id = sid::uuid and f.form = p_form;
  return 'first';
end;
$$;
```

Then:
- revoke all on the three private helpers from `public`, `anon` and `authenticated`, and grant execute to `authenticated` and `service_role`. The invoker views run them as the caller (2b amendment 6's reason);
- revoke the two public functions from `public` and `anon`, and grant them to `authenticated` and `service_role`;
- for the three views, revoke all from `public`, `anon`, `authenticated` and `service_role`, then grant select to `authenticated` and `service_role`;
- comments mark `staff_find_account` and `take_form_state` "A staff action / A user action (advisor 0029 lists it on purpose)", as earlier migrations do.

**Commands:**
- the stack check, then `supabase db reset`, then `supabase test db`: everything passes, the new file's count recorded;
- `supabase db lint`: clean;
- the advisors: no new warning;
- `pnpm db:types`, then `pnpm typecheck`.

## Task 2: The shared seams (decisions 2, 3, 4 and 6)

**Files:** `lib/data/refused.ts` (+ `.test.ts`), `lib/staff/follow-ups.ts` (+ `.test.ts`), `lib/staff/once.ts` (+ `once.test.ts` cases), `lib/staff/access.ts` (+ `access.test.ts` cases), `lib/data/supabase/clients.ts`, `lib/data/supabase/form-states.ts` (phase B's), `tests/db/viewer.ts`, `lib/data/contract/form-states.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.**
1. **`refused.test.ts`:**
   - `new Refused("own-shop")` is an `Error` with `code` `"own-shop"` and name `"Refused"`;
   - `isRefused(error, "once-taken", "once-expired")` is true only for those codes;
   - `isRefused(new Error("x"))` and a Next redirect error (`redirectSignalOf` from `tests/helpers/next-request.ts`) are false;
   - the module imports nothing (source check), so client and sample code can read it.
2. **`follow-ups.test.ts`:** `sampleFollowUps(fn)` runs `fn` once with `VOSSIE_BACKEND` unset, and never with `"supabase"` (`vi.stubEnv`). It awaits `fn`.
3. **`once.test.ts`:** `tokenTakenInSql()` is false on the sample backend and true on Supabase. The existing cases are unchanged.
4. **`access.test.ts`:**
   - `requireStaffAction("admin", next)` with `lib/auth/session` mocked:
     - signed out: the sign-in redirect;
     - a student: `notFound()`;
     - an admin: the account;
     - on Supabase with `requireLiveAccount` redirecting: the redirect, before any role check;
   - `orNotFound(promise)` passes a value through, turns `Refused("forbidden")` into `notFound()` and rethrows anything else.
5. **The form-states contract:**
   - `issueOnceToken` through the world (Task 3's `issueOnceToken` verb is needed: run this after Task 3, or add the verb here and Task 3 builds on it; the controller picks);
   - then `takeFormState(sessionKey, "staff-once:<token>", now)` gives `first`, then `again` with the same state, and `none` for a made-up token;
   - on the db side, `listing-once:` works the same.

**Implementation.**

```ts
// lib/data/refused.ts
// A Supabase function's answer that the sample function's return type has no room for (C4/C5 plan decision 2). Twins
// throw it; actions catch it only where their task says, and rethrow everything else (Next's redirects included).
export type RefusalCode =
  | "forbidden" | "own-shop" | "own-request" | "once-expired" | "once-taken" | "open-limit" | "daily-limit"
  | "reopen-limit" | "day-past" | "day-far" | "date-past" | "cover-invalid" | "check-in-day-future";
export class Refused extends Error {
  constructor(readonly code: RefusalCode) {
    super(`Refused: ${code}`);
    this.name = "Refused";
  }
}
export function isRefused(error: unknown, ...codes: RefusalCode[]): error is Refused {
  return error instanceof Refused && (codes.length === 0 || codes.includes(error.code));
}
```

```ts
// lib/staff/follow-ups.ts
import { onSupabase } from "@/lib/backend";
/**
 * A staff action's follow-ups after its write: the audit entry, the reports it closes and the notifications it sends
 * (staff tools plan decisions 6 and 23). On Supabase the staff function did all of them in its own transaction (spec
 * amendment 12.1), so they run on the sample store only (C4/C5 plan decision 3).
 */
export async function sampleFollowUps(work: () => Promise<void>): Promise<void> {
  if (onSupabase()) return;
  await work();
}
```

- **`lib/staff/once.ts`:** `export const tokenTakenInSql = () => onSupabase();`, with a comment naming the five functions (decision 6). `takeOnceToken` is unchanged: on Supabase it goes through `takeFormState`'s twin.
- **`lib/staff/access.ts`:**
  ```ts
  /** The first line of every staff Server Action (C4/C5 plan decision 4): signed in, re-checked with Auth on Supabase,
   * then the role, or the 404. Pages keep requireStaff. */
  export async function requireStaffAction(area: StaffArea, nextPath: string): Promise<Account> {
    const account = await requireLiveAccount(nextPath);
    if (!canUse(account, area)) notFound();
    return account;
  }
  /** A staff function's "forbidden" (the role went after requireStaffAction) is the same 404. */
  export async function orNotFound<T>(write: Promise<T>): Promise<T> {
    try { return await write; } catch (error) { if (isRefused(error, "forbidden")) notFound(); throw error; }
  }
  ```
- **`lib/data/supabase/clients.ts`:**
  - `export async function viewerId(): Promise<string>`: throws until phase B points it at `currentClaims()`; if phase B has landed, it is `(await currentClaims())?.userId` or throws "No viewer";
  - `export async function forViewerAs(accountId: string): Promise<DbClient>`: throws "Not the signed-in account" when `accountId !== await viewerId()` (2b decision 20), and otherwise returns `forViewer()`;
  - the comment's admin-client list gains decision 9's uses.
- **`tests/db/viewer.ts`:** `withViewerSeam` also replaces `viewerId()` with the chosen account's id.
- **`lib/data/supabase/form-states.ts`** (phase B's): `takeFormState: typeof Sample.takeFormState`:
  - it checks that `sessionKey` is the JWT's `session_id`, through `currentClaims()` or the seam, and throws on a mismatch;
  - it calls `rpc("take_form_state", { p_form: form })`;
  - `'none'` gives null;
  - otherwise it reads the row through `getFormState` and returns `{ first: result === "first", state }`.

**Commands:** `pnpm test`, `supabase db reset`, `pnpm test:db`, `pnpm lint`, `pnpm typecheck`.

## Task 3: World verbs and the action harness (decisions 13 to 15)

**Files:** `tests/contract/world.ts`, `tests/contract/sample-world.ts`, `tests/db/supabase-world.ts`, `tests/db/parity.ts`, `tests/contract/actions.ts`, `tests/db/actions.ts`, `lib/data/contract/world.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first:** `world.contract.ts`, a self-test of every new verb, so later tasks can trust them:
- **`setRoles`:** `setRoles("asker", ["admin"])` makes `viewerAccount("asker").roles` `["admin"]`; the undo restores `[]`.
- **`openShop`:** `openShop("shopper", { name: "Contract bakes", status: "approved" })` returns a slug:
  - `getSeller(slug)` has it;
  - `viewerAccount("shopper").seller` is `{ status: "approved", sellerSlug: slug }`;
  - after `cleanup()`, `getSeller(slug)` is null.

  The statuses `pending`, `paused-seller` and `paused-staff` read as such in `getShopForReview` (Task 14 checks the view; here only the row).
- **`addListing`:** `addListing(slug, { title })` is a published, available listing, in `getSellerListings(slug)`.
- **`publishListing`:** `publishListing("shopper", slug, fields)` first-publishes through the real path:
  - on Supabase, `rpc("save_listing")` with the owner's session client;
  - on sample, `saveOwnListing` then `notifyFollowers`, as `saveListingForm` does;
  - it returns the id.
- **`addReport`:** `addReport("asker", { kind: "listing", id })` is an open report, `getReport(id)` shows it, and `addReport` returns its id.
- **`follow` and `saveSearch`:** each writes a row, with an undo.
- **`setMentor`:** `setMentor(slug, "shopper")` sets the shop's mentor.
- **`issueOnceToken`:** `issueOnceToken("asker")` makes a `staff-once:<uuid>` row in that account's session:
  - on Supabase, the admin client inserts `form_states` with the access token's `session_id` claim (decoded, not verified), `account_id` and an expiry an hour on;
  - on sample, `saveFormState` with the sample session key.
- **`auditCount()`** and **`notificationsOf(name)`** (C1's) read the real tables or store.
- **`viewerAccount`:** `viewerAccount(name)` gives an `Account` as `getViewer()` would: profile, roles, seller.

**`tests/contract/actions.ts`:** `actionContract(makeWorld, run)`. It gives each scenario:
- `signIn(name)`:
  - on sample, `signedInAs(request, id)` from `tests/helpers/staff.ts`;
  - on Supabase, it sets the mocked session (below) and `setViewer(name)`;
- `post(action, fields)`: runs the Server Action with `form(fields)` and returns `{ redirect, notFound }` through `tests/helpers/next-request.ts`'s `redirectOf` and `redirectSignalOf`;
- `notice()`: the staff notice left (`readFormState(STAFF_NOTICE)`).

**`tests/db/actions.ts`** (db files only) holds the mocks for an action-level db test file:
- `vi.mock("@/lib/auth/session", …)`: `getViewer`, `requireAccount`, `requireLiveAccount` and `requireStaff`'s reader return `world.viewerAccount(current)`, and `getSessionKey` returns the session's `session_id`;
- `next/navigation`, `next/headers`, `next/server` and `next/cache` from `tests/helpers/next-request.ts`;
- the client seam, with `withViewerSeam`.

**`tests/db/parity.ts`:** `normalise` gains a map from the sample's account ids to the seed's (`seedUuid("account", id)`, as `scripts/seed-sql.ts` names them) and a `dropContractAccounts(list)` helper. More maps (reports, bookings, posts, pins) are added by the task that first needs them.

**Commands:** `pnpm test`, `supabase db reset`, `pnpm test:db`, `pnpm lint`, `pnpm typecheck`. Then check by hand that no row is left behind: the db run ends with `cleanup()` errors as failures, and a second `pnpm test:db` passes.

## Task 4: Requests, the writes and the asker's reads (decisions 2, 6, 7 and 8)

**Files:** `lib/data/requests.ts`, `lib/data/supabase/requests.ts` (C1's file, appended), `lib/data/contract/requests-own.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.** Times are relative to the real clock, because the database caps `now`.
1. **The asker's reads** (`world.asViewer("asker", …)`):
   - after `world.addRequest({ asker: "asker" })`, `getOwnRequest(asker, id, now)` gives `state "open"`, `closedAutomatically false`, `closesOn` today + 30;
   - `listOwnRequests` orders open, closed, hidden, each newest first (three requests, one closed by the verb and one hidden);
   - `countOpenRequests` is 1;
   - `countRequestsSince(asker, now − 24h)` is 3;
   - another account's request is never returned (`getOwnRequest` null);
   - a request whose `neededBy` is 5 days ago:
     - `getOwnRequest` returns it **closed**, `closedAutomatically true`, `closeReason "needed-by"`: it settled first;
     - the asker has the one auto-closed notification;
     - a second read adds none.
2. **The writes:**
   - `createRequest({ askerId, fields, now, onceToken })` returns the new request, with the fields as given and `offers 0`. On Supabase, `onceToken` from `world.issueOnceToken("asker")`;
   - **on Supabase only**, a second `createRequest` with the same token throws `Refused("once-taken")`, and a made-up token `Refused("once-expired")`. The sample ignores the token; its once-only rule lives in the action (Task 6 proves both);
   - `updateRequest` edits an open request (`updatedAt` moves); a closed one gives null;
   - `setRequestOpen(..., false)` closes it (`closedBy "asker"` in `getOwnRequest`); `true` reopens:
     - with a passed `neededBy`: `neededByCleared true` and `neededBy` null;
     - on a due, unsettled request, Close gives null and the request is closed by `'auto'`. The twin settled first (decision 8);
   - `deleteRequest` gives true, then false; `getRequest(id)` is null;
   - **the reopen limit on Supabase only:** five open, reopen a sixth: `Refused("reopen-limit")`.
3. **Hide and Show again's data** (`world.setRoles("staff", ["admin"])`, `world.addReport` on the request):
   - `hideRequest(id, "Contract reason", now)` gives `{ id, title, askerId }`. On Supabase `askerId` is null (decision 2's note: the admin can't read it, and the function told the asker);
   - a second hide gives null;
   - `showRequest` gives the same shape; a second gives null;
   - **settle first:** a due request hidden through `hideRequest` ends `closedBy 'auto'` and hidden, on both backends.
4. **The download:** `exportRequests(asker)` equals on both backends after the same verbs:
   - newest first, no ids;
   - `closedAutomatically` and `hubReason` set;
   - `offers` as `getOwnRequest`'s.
5. **Deletion:** on Supabase, `forgetRequestsOf` throws "forget_account does this".

**Implementation** (`lib/data/supabase/requests.ts`, appended):
- **`ownRows(client)`:** selects from `my_requests` (every column, including `closed_by` and `closes_on`). The mapper is shared:
  - `toOwnFrom(row, today)` mirrors `toOwn`;
  - its `request` is `LookingForRequest` with `offers` from the view and `closesOn` from `closes_on`;
  - `closeReasonOf` reads `neededBy` (`lib/looking-for/rules.ts`).
- **The asker's reads:** `getOwnRequest`, `listOwnRequests` and `countOpenRequests` call the switched `settleRequests(now)` first, then read through `forViewerAs(askerId)`. `listOwnRequests` sorts with the sample's `ORDER` (exported from `requests.ts`).
- **`createRequest`:**
  - `rpc("save_request", { p_id: null, p_title, p_category_slug, p_campus_slug, p_details, p_budget_zar, p_swap_welcome, p_needed_by, p_once_token: onceToken ?? null })`;
  - `posted` is read back by id;
  - `open-limit`, `daily-limit`, `once-expired` and `once-taken` throw `Refused`;
  - `RequestFields`' names map one to one.
- **`updateRequest`:** the same function with `p_id`. `saved` is read back; `not-open` and `not-found` give null.
- **`setRequestOpen`:**
  - `settleRequests(now)` first, then `rpc("set_request_open")`;
  - `closed`, `reopened` and `reopened-date-cleared` are read back, with `neededByCleared` set by the last;
  - `nothing` gives null;
  - `reopen-limit` throws `Refused`.
- **`deleteRequest`:** `rpc("delete_request")`; `deleted` gives true.
- **`hideRequest`:** `settleRequests(now)` first (Task 9b's note), then `rpc("hide_request", { p_request, p_reason })`.
  - `changed`: the title is read back through the admin's session (admins read every request), with `askerId: null`;
  - `nothing` and `no-open-report` give null;
  - `own-request` and `forbidden` throw `Refused`.
- **`showRequest`:** the same through `show_request`, without a settle (a hidden request is never settled).
- **`requestAskerId`:** `forServer().from("requests").select("asker_id")` by id (decision 9).
- **`countRequestsSince`:** a count from `my_requests` where `created_at > since`.
- **`exportRequests`:** maps `my_requests`, newest first, with category and campus names from the fixtures, as the sample does.
- **The forgets:** `forgetRequestsOf` throws.
- **`requests.ts`:** each listed function gains its one switch line. `createRequest`'s argument type gains `onceToken?: string`, which the sample ignores (a comment says the action takes it on this backend).

**Commands:** `pnpm test`, `supabase db reset`, `pnpm test:db`, `pnpm lint`, `pnpm typecheck`.

## Task 5: Offers, the request side

**Files:** `lib/data/offers.ts`, `lib/data/supabase/offers.ts`, `lib/data/contract/offers.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.**
- **The fixture:** `world.openShop("shopper")`, `world.addRequest({ asker: "asker" })`, and an offer thread on it from the shop, written by the verb `world.addOffer(slug, requestId, body)`:
  - on Supabase, `rpc("start_offer")` as the shop's owner. That is C3's function, but no C3 code is involved;
  - on sample, `startOffer`.
- **`offersForRequest(requestId)`, as the asker:** one row:
  - `shopName` is the shop's name;
  - `preview` is the first line of the shop's message;
  - `offeredAt` is the thread's time.
- **After `world.pauseShop(slug, "staff")`:** still the shop's name, on both backends (the new view's point).
- **After the shop's owner is deleted** (the verb `forgetAccount("shopper")` through each backend's own deletion, restored by the undo making the account again): `"A closed shop"`.
- **`findOffer(requestId, slug)`, as the shop's owner:** the thread's id; for another shop, null.
- **`countOffersSince(slug, now − 24h)`, as the owner:** 1; with `since` after the offer, 0.

**Implementation:**
- **`offersForRequest`:** reads `my_request_offers` where `request_id`, through `forViewer()`.
  - The first seller message for those conversations comes from `messages` (`conversation_id in (…)`, `side = 'seller'`, ordered by `sent_at`; the column names are checked against `database.types.ts`), as `firstLine(body)`.
  - Rows are sorted newest first, and `shopName` defaults to `CLOSED_SHOP`.
- **`findOffer`:** `my_conversations` where `is_offer`, `request_id`, `shop_id` (the slug's id from `shops`) and `not seller_gone`.
- **`countOffersSince`:** a count with `created_at > since`.
- `offerRow` and `offerThreadCount` stay sample-only (C1 and C3 don't call them on Supabase), each with a comment.

**Commands:** as Task 4.

## Task 6: The Looking For actions on Supabase (decisions 6 to 8, 13)

**Files:** `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts` (new cases), `lib/looking-for/contract/actions.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first** (action contracts):
1. **Save a new request once:**
   - `saveMyRequest` with a token, twice: one request, and both posts land on its page with the "posted" notice;
   - a made-up token: the form's `form-expired` error and what was typed, with no request;
   - on both backends.
2. **The limits:** five open requests, then a sixth post gives `open-limit` in the form. On Supabase the TypeScript count answers first; the backstop is pgTAP's (test 27).
3. **Settle first:** a due request (`neededBy` 5 days ago):
   - `closeMyRequest` leaves it closed by `'auto'`, with no "closed" notice;
   - `reopenMyRequest` then reopens it with `reopened-date-cleared`;
   - `requestsChanged` was called (the `next/cache` stand-in records tags).
4. **Delete:** `deleteMyRequest` removes it, with the "deleted" notice on Your requests.
5. **Unit (`actions.test.ts`, Supabase mode with `lib/data/requests` mocked):**
   - `saveMyRequest` doesn't call `takeOnceToken` (`tokenTakenInSql()`);
   - it passes `onceToken` to `createRequest`;
   - `Refused("once-taken")` goes to `sentOnceToken`'s path, or Your requests;
   - `Refused("once-expired")` writes `form-expired` with the values;
   - `Refused("open-limit")` writes `open-limit`;
   - anything else is rethrown.

**Implementation** (`saveMyRequest`):

```ts
if (!editing && !tokenTakenInSql()) {
  const token = await takeOnceToken(once, now);
  if (token.kind === "none") return expired();          // the existing branch, as a local function
  if (token.kind === "again") done(token.sent?.path ?? YOUR_REQUESTS_PATH);
}
let saved: LookingForRequest | null;
try {
  saved = editing
    ? await updateRequest(account.id, editing, check.value, now)
    : await createRequest({ askerId: account.id, fields: check.value, now, onceToken: once });
} catch (error) {
  // Supabase took the token, or counted the limits, in the same transaction (C4/C5 plan decisions 6 and 7).
  if (isRefused(error, "once-expired")) return expired();
  if (isRefused(error, "once-taken")) done((await sentOnceToken(once, now))?.path ?? YOUR_REQUESTS_PATH);
  if (isRefused(error, "open-limit", "daily-limit")) return backWith(error.code);
  throw error;
}
```

- **`changeOpen`:** catches `Refused("reopen-limit")` from `setRequestOpen` and leaves the `reopen-limit` note, as its own check does.
- **`sendOffer`:** unchanged here. Its `countOffersSince` and `offerStatus` reads are Task 5's twins; `startOffer` is C3's.
- The settle-first lines (`settle(now)`) are unchanged and stay first after the session.

**Commands:** `pnpm vitest run lib/looking-for`, `pnpm test`, `supabase db reset`, `pnpm test:db`, `pnpm lint`, `pnpm typecheck`.

## Task 7: Follows (decision 10)

**Files:** `lib/data/follows.ts`, `lib/data/supabase/follows.ts`, `lib/data/contract/follows.contract.ts`, `.test.ts`, `.db.test.ts`, `lib/following/actions.ts` (+ test).

**Failing tests first.**
1. **The data contract**, as `asker`, with shops made by `world.openShop("shopper", …)`:
   - **`addFollow`:**
     - `followed`, then `already`;
     - `own` for the owner, using `openShop("asker")`;
     - `not-found` for a waiting shop and for a Hub-paused one;
     - `limit` at 200 (`world.follow` 200 times through the admin client in one insert; sample, the store);
   - **`isFollowing`:** true, then false after `removeFollow` (which gives true, then false);
   - **`listFollowedShops`:**
     - newest follow first;
     - a seller-paused shop is `paused true, storefront true`;
     - a Hub-paused shop is `paused true, storefront false`, with its name;
     - a waiting shop isn't listed;
     - `listed` counts the listings buyers see (two `addListing` and a hidden one: 2);
     - `image` is the photo or the category's picture;
   - **`shopNameOf(slug)`:** the name for a Hub-paused shop the account follows; null for an unknown slug;
   - **`countFollowers(slug)`, as the owner:** 1;
   - **`exportFollowing`:** names, newest first, including a Hub-paused shop's;
   - **`notifyFollowers` on both backends**, through `world.publishListing`:
     - each follower has one `new-listing` notification naming the listing, linking to it;
     - a second listing that day makes it "listed 2 new things", linking to the shop, still one row;
     - once it's read, a third makes no new row;
     - the owner, following their own shop through the admin client, is never told.
2. **`lib/following/actions.ts`:** Unfollow reads the shop's name **before** removing the follow, so a Hub-paused shop's status line still names it. Unit test: `unfollowShop` on a Hub-paused shop leaves `{ shop: "<name>" }`.

**Implementation:**
- **Reads:** `myFollows(client)` reads `my_follows` ordered by `followed_at desc, shop_id` through `forViewerAs(accountId)`.
- **`addFollow`:**
  - the shop's id by slug through the viewer's `shops` (null gives `not-found`);
  - `rpc("follow_shop", { p_shop })`, whose result passes through.
- **`removeFollow`:** the id from `myFollows` by slug (none gives false); `rpc("unfollow_shop")`; `unfollowed` gives true.
- **`isFollowing`, `shopNameOf`, `exportFollowing`:** from `myFollows`. `shopNameOf` falls back to the public `shops` read by slug, so a name the account doesn't follow still shows.
- **`listFollowedShops`:**
  - `myFollows` filtered to `approved` and `paused`;
  - `listed` per slug from C1's catalog snapshot (`catalogSnapshot`, `catalogSourceFrom`, `catalogOver(...).listedListings()`, imported directly, not through `index.ts`: 2b amendment 14);
  - `image` through `photoSrc` and `categoryPicture`.
- **`countFollowers`:** `rpc("follower_count", { p_shop })`, null giving 0.
- **`notifyFollowers`:** returns 0, commented (decision 10).
- **`forgetFollowsOf`:** throws.

**Commands:** as Task 4, plus `pnpm vitest run lib/following`.

## Task 8: Saved searches and alerts (decisions 6, 9 and 10)

**Files:** `lib/data/saved-searches.ts`, `lib/data/supabase/saved-searches.ts`, `lib/data/contract/alerts.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.**
1. **Saving, as `asker`:**
   - `addSavedSearch` gives `saved`;
   - the same words in another order give `already`;
   - the 21st gives `limit` (20 inserted by `world.saveSearch`);
   - `getSaveSearchState` follows;
   - `listSavedSearches` is newest first, with the label and link from `lib/saved-searches/rules.ts`;
   - `setSavedSearchPaused` true, true again (the first time kept), then false;
   - another account's id gives null;
   - `deleteSavedSearch` gives the item, then null, and its `search-match` notifications go;
   - `exportSavedSearches` equals on both backends.
2. **Alerts** (`world.openShop("shopper")`, `world.saveSearch("asker", { q: "calculator" })` and one for `staff` with `campus` Pretoria, a paused search for `staff`, and one for `shopper`, the owner):
   - `world.publishListing("shopper", slug, { title: "Casio calculator", campus: "pretoria" })`, then `notifySavedSearches({ listingId, now })`, returns 2;
   - `asker` and `staff` each have one `search-match` notification with the sample's words (`searchMatchText`) and the listing's link;
   - the owner and the paused search are told nothing;
   - a second matching listing that day makes "2 new listings match your search …", linking to the search's results;
   - after it's read, a third makes it unread again at one, naming that listing;
   - a hidden listing, or one of a paused shop, tells no one (returns 0);
   - an account with two matching searches hears once, under the older.
3. **On Supabase, `forgetSavedSearchesOf` throws.**

**Implementation:**
- **`addSavedSearch`:** `rpc("save_search", { p_q: q, p_category, p_campus_slug: campusToDb(campus), p_price, p_pay, p_deals, p_search_key: searchKey(search) })`.
- **Reads** go through `forViewerAs(accountId)`. The row's `campus_slug` passes through `campusFromDb`, and `queryOf` gives the `MatchQuery`.
- **`setSavedSearchPaused`:** the rpc, then the row read back for `toItem`.
- **`deleteSavedSearch`:** the row read first, then `rpc("delete_search")`; `deleted` gives the item.
- **`notifySavedSearches({ listingId, now })`, request-time, `forServer()`:**
  1. reads the one listing as buyers see it: `listings` with `listing_photos`, its shop and `storefronts` row, through `forPublic()`. It builds `catalogOver(catalogSourceFrom(miniSnapshot)).toListing(...)`, so it never meets a cache that the save has just expired. Not listed (hidden, draft, a paused or waiting shop) returns 0;
  2. reads the owner as `seller_profiles.account_id` for the listing's shop, and every saved search where `paused_at is null` and `account_id` isn't the owner, ordered by `created_at, id`;
  3. matches each with `listingMatches(listing, queryOf(row), names)`;
  4. calls `rpc("record_search_matches", { p_listing_id, p_search_ids, p_texts })`, where `p_texts` is `{ [id]: { label: savedSearchLabel(...), href: savedSearchHref(..., "new") } }`;
  5. returns the count. Only ids, the label and the link reach SQL; the matching never leaves TypeScript (CLAUDE.md).
- **`lib/saved-searches/actions.ts`:** no change expected. `takeOnceToken` works on Supabase through Task 2's twin. If the db contract shows otherwise, the fix goes here, and the controller is told.

**Commands:** as Task 4.

## Task 9: C4 check

1. **`lib/data/contract/c4-download.db.test.ts`:**
   - as `asker` with a request, a follow and a saved search, `exportRequests`, `exportFollowing` and `exportSavedSearches` on Supabase give the same shapes and key order as the sample's (the existing export test's order check, run on the twins);
   - nothing in them names an id.
2. `supabase db reset`, then `pnpm test` and `pnpm test:db`: all pass. `pnpm lint` and `pnpm typecheck`: clean.
3. The ledger and "Changes made during the build".

Tasks 10 and 11 are reserved for C4's review (read-only, about 25 minutes) and its fixes.

## Task 12: Async ownership and the follow-up wrap (decisions 3, 4 and 5)

The sample backend's behaviour must not change. Every existing unit test passes unchanged except where a sync call became `await`.

**Files:** `lib/data/staff-shops.ts`, `lib/data/staff-accounts.ts`, `lib/staff/own.ts` (+ test), `lib/staff/admin-actions.ts`, `lib/staff/hub-actions.ts`, `lib/staff/mentor-actions.ts`, `lib/staff/account-actions.ts`, `lib/hub-actions.ts`, `app/admin/sellers/[slug]/page.tsx`, `…/decline/page.tsx`, `…/pause/page.tsx`, `app/admin/staff/page.tsx`, and the tests that call what changed.

**Failing tests first.**
1. **`lib/staff/own.test.ts`:** `await ownsTarget(account, { kind, id })` gives `shop`, `listing`, `request` or null, as today's cases.
2. **`staff-shops.test.ts`:** `ownsShop`, `ownsListing` and `ownsRequest` agree with the sync versions on the sample fixtures.
3. **`staff-accounts.test.ts`:** `ownShopMentor` agrees with `ownShopMentorId`.
4. **A source check, `lib/staff/follow-ups.test.ts`:** in `lib/staff/*-actions.ts` and `lib/hub-actions.ts`, every call to `recordAudit(`, `notify(`, `tellOwner(`, `tellReporter(`, `closeReportsOn(`, `closeReportsAboutShop(`, `attachPhotos(` and `deletePhotosUsedBy(` sits inside a `sampleFollowUps(` callback. The test reads the file and checks each call's enclosing call expression with TypeScript's parser (`typescript` is a dev dependency), not a regex.
5. **A source check:** no file outside `lib/data` imports `isOwnShop`, `isOwnListing`, `isOwnRequest` or `ownShopMentorId`.
6. **A source check:** every exported action in `lib/staff/*-actions.ts` calls `requireStaffAction(` first; `lib/hub-actions.ts` keeps `requireAccount`.

**Implementation:**
- **`staff-shops.ts`:** `export async function ownsShop(accountId, slug)` (switch line, then `isOwnShop`), and the same for `ownsListing` and `ownsRequest`.
- **`staff-accounts.ts`:** `ownShopMentor(ownerId)` likewise.
- **`lib/staff/own.ts`:** `ownsTarget` becomes async over them.
- **The pages:** `const own = await ownsShop(account.id, slug)`. `app/admin/staff/page.tsx` passes `await ownShopMentor(account.id)`.
- **`admin-actions.ts`:**
  - every `isOwn…(staff.id, …)` becomes `await owns…(staff.id, …)`;
  - `requireStaff(` becomes `requireStaffAction(`;
  - each action's follow-ups move into `await sampleFollowUps(async () => { … })`. For example, `pauseSeller`:
    ```ts
    const decision = await orNotFound(staffPauseShop(slug, reason.value));
    if (!decision) return nothingChanged(adminSellerPath(slug), now);
    await sampleFollowUps(async () => {
      // On Supabase staff_pause_shop closed these reports, wrote the entry and told everyone (decision 3).
      const reports = await closeReportsAboutShop(decision.slug, reason.value, staff.id, now);
      await recordAudit({ … });
      await tellOwner(decision, "paused", now);
      for (const closed of reports) await tellReporter(closed, "acted", now);
    });
    sellersChanged();
    ```
  - `renamePoint`'s `pickupPointById(id)` becomes the async reader C1 made (`lib/data/index.ts`'s `pointById`, or the module's async export).
- **`hub-actions.ts`, `mentor-actions.ts`, `account-actions.ts`:** the same moves. `savePost`'s `attachPhotos` and `deletePhotosUsedBy` go inside the wrap (decision 18).
- **`lib/hub-actions.ts`:** `sendSlotRequest`'s `notify` goes inside the wrap (`request_slot` tells the author).

**Commands:** `pnpm vitest run lib/staff lib/hub-actions.test.ts app/admin`, `pnpm test`, `pnpm lint`, `pnpm typecheck`. No `test:db` change yet.

## Task 13: Audit

**Files:** `lib/data/audit.ts`, `lib/data/supabase/audit.ts`, `lib/data/contract/audit.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first:**
- **The fixture:** entries are written by real staff actions through the action harness: `staff` (admin) verifies a shop made by `openShop("shopper")`, then un-verifies it, then adds a pickup point.
- **`listAudit({ staff: null, kind: null })`, as `staff`:** the three entries newest first, with the actions, target names and details the sample writes. The details must match, for example `point-added` with the campus's name: on Supabase SQL writes them, so this proves the wording is the same.
- **Filters:** `kind: "shops"` gives the two shop entries; `staff: <shopper's id>` gives none; `limit` is respected.
- **`auditStaff()`:** `[{ id: staff's, name: "Staff" }]`.
- **As `asker` (no role) on Supabase:** `listAudit` gives `[]`, because the policy hides the log.
- **On Supabase, `recordAudit` throws** "the staff function writes the audit row".

**Implementation:** `listAudit` reads `audit_log` with `.in("action", actionsOf(kind))`, where `actionsOf` is the inverse of `auditKindOf`, added beside it in `lib/staff/audit-words.ts` with a unit test. It orders by `at desc, id desc` and limits. `auditStaff` uses `selectAll` ordered by `at, id`, and keeps the last name per `staff_id` (the sample's map overwrite).

**Commands:** as Task 4.

## Task 14: Staff shops (decisions 5 and 11)

**Files:** `lib/data/staff-shops.ts`, `lib/data/supabase/staff-shops.ts`, `lib/data/contract/staff-shops.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.**
1. **Parity on the seed, as `staff`:** `listShopsForReview()`, `getShopForReview(slug)` for every seed shop, `countWaitingShops()` and `listMentors(null)`, with the contract accounts dropped.
2. **Behaviour.** `openShop("shopper", { status: "pending" })`, then:
   - `approveShop(slug, shopperId, now)` gives `{ slug, name, ownerId }`, the standing becomes `open`, and `approvedAt` is set;
   - a second call gives null;
   - with the wrong `ownerId`, null (amendment 14.6).
3. **`declineShop`, then `resendForApproval`** (as the shopper): the decline and its reason, then waiting again.
4. **`setVerified(slug, true)`, then true again:** the shop, then null.
5. **`staffPauseShop`, then `staffResumeShop`:**
   - over a seller's own pause, `stillPausedBySeller` is true;
   - `shopStanding(ownerId)` shows `pausedByHub` while the Hub's pause lasts.
6. **`setShopMentor(slug, mentorId)`:**
   - with `setRoles("asker", ["mentor"])`, the shop's mentor is asker, and `mentorName` "Asker";
   - the owner as mentor: null;
   - an account without the role: null;
   - the same mentor again: null.
7. **`hideListing` and `showListing`** (needs an open report: `world.addReport`):
   - the shapes, `ownerId` the shop's owner;
   - hidden again gives null;
   - on Supabase with no open report: null (`no-open-report`, decision 2).
8. **Ownership:** `ownsShop(staffId, slug)` is true after `openShop("staff")` and false for the shopper's shop; `ownsListing` and `ownsRequest` likewise.
9. **Refusals at the data level, on Supabase only** (the sample's data functions have no gate; Task 16 proves the actions on both):
   - as `staff` on its own shop: `approveShop`, `setVerified`, `staffPauseShop` and the rest throw `Refused("own-shop")`, and nothing changed (row, audit count, notifications);
   - as `asker` (no role): `Refused("forbidden")`, nothing changed.

**Implementation:**
- **Refactor `review(row, counts)` over a source:** `reviewOver({ shops, profileOf, personOf, listed })`, pure. The sample source is the store, unchanged in what it returns.
- **The twin's source:**
  - `shops` (an admin reads every shop; slug, name and every column the review shows);
  - `staff_seller_profiles` keyed by `shop_id` and by `account_id`;
  - first names from `profiles`;
  - `listed` from C1's snapshot.

  A shop's owner is `staff_seller_profiles.account_id` where `shop_id` is the shop's id (decision 5). A shop with no profile row is a sample shop: `owner: null`, `open`.
- **Writes:** each `rpc`, with the slug resolved to the id first. `approveShop` and `declineShop` call with `p_account = ownerId`, after checking that the shop's profile names that account (the `reviewed` rule). The results:
  - `changed` gives the decision, read back;
  - `nothing` gives null;
  - `own-shop` and `forbidden` throw `Refused`.
- **`shopStanding`:** the viewer's own `seller_profiles` row.
- **`resendForApproval`:** `rpc("resend_for_approval")`; `changed` gives true.
- **`listMentors`:** `profiles` where `roles` contains `mentor`, sorted by first name, leaving out `exceptOwnerId`.

**Commands:** as Task 4.

## Task 15: The reports queue and Show again's reads (decision 11)

**Files:** `lib/data/staff-reports.ts`, `lib/data/supabase/staff-reports.ts`, `lib/data/contract/staff-reports.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.**
1. **Parity on the seed, as `staff`:** `listReports()`, `getReport(id)` for each seed report (normalise's report map), `openReportCount()` and `countHidden()`.
2. **Behaviour:**
   - **a report on a listing:**
     - `getReport(id)` gives `exists`, `can.hide`, and `can.pause` when the shop is pausable;
     - after the hide (Task 14's `hideListing`), `unseen` is `"hidden"`, and `can` is all false once closed;
   - **a report on a request:** `can.hide` until hidden;
   - **a report on a shop:** after the shop is deleted (verb), `exists` false and `shop` null;
   - **`getReport(id, staffId)`** on a report about staff's own shop, listing or request: `own` is `shop`, `listing` or `request` and `can` all false. After the listing is deleted, `own` is still `listing` (the recorded owner, Task 9b);
   - **`closeReport`:**
     - gives `{ id, reporterId, title }`, then null;
     - on Supabase, on staff's own: `Refused("own-shop")`;
   - **`listHidden(staffId)` and `getHidden`:** a hidden listing and a hidden request, newest first, with `own` set for staff's own; `shopPausedByHub` and `requestClosed` as the sample's;
   - **on Supabase, `closeReportsOn` and `closeReportsAboutShop` throw** "the staff function closed them".

**Implementation:**
- `toView` becomes `reportViewOver(lookups)(row, viewerId)`, pure.
- The twin reads:
  - `staff_reports` (with `own`);
  - the listings, shops and requests the reports name (admins read every one);
  - `staff_seller_profiles`, for `pausable` and `unseen`;
  - first names.
- `getReport(id, viewerId)` checks that `viewerId` is the session's user before using the view's `own`.
- The hidden lists read listings and requests where `hidden_at is not null`. `own` comes from `ownsListing` and `ownsRequest`, batched: the viewer's shop id once, and `my_requests` ids once.

**Commands:** as Task 4.

## Task 16: The admin actions on Supabase, and every gate (decisions 2 to 5, 13, 19)

**Files:** `lib/staff/admin-actions.ts` (+ `admin-actions.test.ts` cases), `lib/staff/contract/admin-gates.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first:** `admin-gates.contract.ts`, on both worlds through the action harness. Each refusal asserts nothing changed:
- the target's row as before;
- `auditCount()` unchanged;
- `notificationsOf` every person involved unchanged;
- no tag expired;

and the notice or 404 as listed.

1. **The role first,** table-driven over every export of `admin-actions.ts`. As `asker` (no role), each post answers `notFound()` before anything is read. Signed out, each redirects to sign-in with its `next`.
2. **Own shop,** with `openShop("staff")` (staff is an admin and owns it), a listing, a request by staff, and reports by `asker` on each:

   | Action | Fields | Notice |
   |---|---|---|
   | `approveSeller` | staff's own waiting shop (`openShop("staff", { status: "pending" })`) | `own-shop` |
   | `declineSeller` | the same, with no reason (the gate comes before the reason) | `own-shop` |
   | `verifySeller`, `pauseSeller`, `resumeSeller` (after `setRoles("asker", ["admin"])` and asker pauses it), `assignMentor` | staff's shop | `own-shop` |
   | `dismissReport` | the report on the shop, on the listing, on the request | `own-shop`, `own-shop`, `own-request` |
   | `dismissReport` | the listing's report after the listing is deleted | `own-shop` |
   | `hideReportedListing`, `pauseReportedShop` | the listing's report | `own-shop` |
   | `hideReportedRequest` | the request's report | `own-request` |
   | `pinSeller`, `unpinSeller` (pin made by asker as a second admin) | staff's shop | `own-shop` |
   | `showListingAgain`, `showRequestAgain` (hidden by asker as a second admin) | staff's | `own-shop`, `own-request` |

3. **The same posts by `asker` as a second admin** each change what they should:
   - one audit row each;
   - the owner and the reporters told (counted);
   - the right tag expired.

   Run them in that order on the same fixture, so a second post of the same thing writes no second row: "one audit row only when something changed".
4. **Show again:**
   - `showListingAgain` by asker gives one `listing-shown` row, one `shop-update` notification to the owner (`listingShownText`), the report stays closed, and `listingsChanged`;
   - a second post gives `nothing` and no row;
   - the same for `showRequestAgain` (`request-shown`, `requestsChanged`).
5. **Settle first:** `hideReportedRequest` on a due request ends with the request closed by `'auto'` and hidden. The asker has the auto-closed notice and the hidden notice, in that order.
6. **Unit (Supabase mode, data mocked):**
   - `recordAudit`, `notify`, `closeReportsOn` and `closeReportsAboutShop` are never called;
   - `Refused("forbidden")` gives `notFound()`;
   - `Refused("own-shop")` gives `refuseOwn`;
   - `pinSeller` maps `Refused("day-past" | "day-far")` to those form errors.

**Implementation:**
- A local `decide(write, kindPath, now)`: `orNotFound`, plus `Refused("own-shop" | "own-request")` to `refuseOwn`. It wraps every data write in this file.
- `pinSeller` catches `Refused("day-past" | "day-far")` and pushes the code (`PIN_ERRORS` is unchanged).
- The rest is Task 12's shape: no other change.

**Commands:** `pnpm vitest run lib/staff`, `pnpm test`, `supabase db reset`, `pnpm test:db`, `pnpm lint`, `pnpm typecheck`.

## Task 17: Featured pins and pickup point writes

**Files:** `lib/data/featured.ts`, `lib/data/pickup-points.ts`, `lib/data/supabase/featured.ts`, `lib/data/supabase/pickup-points.ts` (both C1's, appended), `lib/data/contract/pins-points.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first** (as `staff`, days in the next week):
- **`addPin`:**
  - a Verified, open seller with a listing gives the pin (`sellerSlug`, `campusSlug`, `day`, `pinnedBy`);
  - the same again gives `taken`;
  - a fifth on that campus and day gives `full`;
  - an unverified seller gives `not-eligible`;
  - the day's draw row for that campus is gone (`featuredFor` draws again: C1's twin reads it);
  - `campus "all"` round-trips as null.
- **`getPin` and `listPins(today, staffId)`:** names, `pinnedByName`, `own` for staff's own shop; `featuredChoices(staffId)` leaves it out.
- **`removePin`:** the pin, then null.
- **On Supabase:** `addPin` on staff's own shop gives `Refused("own-shop")`; a past day gives `Refused("day-past")`.
- **Points:**
  - `addPickupPoint("pretoria", "Contract gate", now)` gives the row; the same name in another case gives null;
  - Eduvos Online gives null;
  - `isPointNameTaken` follows;
  - `renamePickupPoint` gives `{ before }`, then null for the same name;
  - `retirePickupPoint`, then `restorePickupPoint`, give the rows, then null;
  - `listPickupPoints()` includes retired ones.

**Implementation:**
- `pin_shop(p_shop, campusToDb(campus), p_day)`, with the shop's id by slug; `changed` gives the pin read back from `featured_pins`.
- `unpin_shop(p_pin)`, after `getPin`.
- The points' four functions. `changed` gives the row read back (by campus and name key for a new one). `name-taken` and `nothing` give null.
- C1's cached `pickupPointRows` serves `isPointNameTaken` and `listPickupPoints`. The writes' actions expire `pickup-points` before `done()`, as now.

**Commands:** as Task 4.

## Task 18: The Hub (decisions 3, 6 and 18)

**Files:** `lib/data/hub-posts.ts`, `lib/data/supabase/hub-posts.ts` (C1's, appended), `lib/staff/hub-actions.ts`, `lib/hub-actions.ts`, `lib/data/contract/hub-staff.contract.ts`, `.test.ts`, `.db.test.ts`, `lib/staff/contract/hub.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.**
1. **Data:**
   - **parity on the seed, as `staff`:** `listPostsForStaff()`, `getPostRow(id)` for each seed post, `listBookings()` and `openBookingCount()`;
   - **`saveHubPost`:**
     - a new tip with `onceToken` gives `created`, `publishedNow`, and the author staff;
     - an unchanged save gives `changed false` (no audit row on Supabase: the count);
     - an edit gives `changed`;
     - a mentor (`setRoles("asker", ["mentor"])`) editing staff's post: on Supabase `Refused("forbidden")`; the action 404s before (below);
   - **RSVP and slots:**
     - `addRsvp` gives `going`, `already`, then `full` at capacity; `closed` for a tip;
     - `removeRsvp` gives true, then false; `hasRsvp` follows;
     - `requestSlot` gives the booking, then `open-already`; `latestBooking` shows it;
     - `answerBooking(id, "accepted", staffId, now)` gives the student and post, then null.
2. **Actions:**
   - `savePost` twice with one token makes one post and one `post-created` row, and the second lands where the first went with its notice;
   - a made-up token gives `once-expired` with what was typed;
   - a mentor posting to another's post id gets `notFound()`;
   - `answerSlot` tells the student once (`slotAnswerText`);
   - `sendSlotRequest` tells the post's author once (`slotRequestedText`);
   - `rsvpToEvent` expires `hub`.
3. **A cover** (only if C2's photo helpers are in the branch; otherwise the case is `todo` with the controller's note):
   - a new cover stored on Preview, then saved, makes the post's image `/photos/<id>`;
   - a second cover removes the first's file (C2's removal helper called with `removed_paths`).

**Implementation:**
- **`saveHubPost`:** `rpc("save_hub_post", { p_id, p_kind, p_title, p_campus: campusToDb(...), p_starts_at, p_place, p_capacity, p_summary, p_body, p_published, p_cover_photo_id: photoIdOf(cover?.src) when it's a Hub photo, p_once_token })`.
  - `created` and `changed` give the row read back from `staff_hub_posts` and mapped to `HubPostRow`. `publishedNow` is true when the post had no `published_at` before and has one now;
  - `nothing` gives `changed false` with the row;
  - `not-found` gives null;
  - `forbidden`, `date-past`, `cover-invalid`, `once-expired` and `once-taken` throw `Refused`;
  - `removed_paths` go to C2's removal helper.
- **`savePost`:**
  - on Supabase it skips `takeOnceToken` (`tokenTakenInSql()`) and passes `onceToken: once` for a new post;
  - it catches the once codes as Task 6 does, and `date-past` as `withPastDate`'s form error;
  - `cover-invalid` writes the form back with `once-expired`'s words and the cover cleared (open question 3);
  - the cover's Supabase storage is C2's helper: the twin of `storePhotos(HUB_PHOTOS, …)` calls `add_hub_photo`, then uploads.
- **The other writes:** `rsvp`, `cancel_rsvp`, `request_slot` and `answer_booking`, each mapped. `requestSlot`'s twin reads the new booking back and returns `authorId: null`. Its `notify` runs only in `sampleFollowUps`, since `request_slot` told the author.

**Commands:** as Task 16.

## Task 19: Mentors (decisions 6 and 16)

**Files:** `lib/data/mentors.ts`, `lib/data/supabase/mentors.ts`, `lib/staff/mentor-actions.ts`, `lib/data/contract/mentors.contract.ts`, `.test.ts`, `.db.test.ts`, `lib/staff/contract/mentor.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.**
1. **Data:**
   - **parity on the seed:** `mentoredShops(viewer, now)` for the seed's mentor and admin (as `staff`);
   - **behaviour,** with `setRoles("asker", ["mentor"])`, `openShop("shopper")` and `setMentor(slug, "asker")`:
     - as asker, `mentoredShops` lists the shop, with its counts and flags (C1's `recentCounts`);
     - as staff (admin), it's listed too;
     - once `openShop("staff")` is mentored by asker, staff doesn't see its own shop (amendment 15.3);
   - **`listNotes(ownerId)`:** newest first;
   - **on Supabase, as the shop's owner (shopper):** `listNotes(shopperId)` gives `[]`. The owner never reads notes about themselves (RLS), which is the rule that keeps notes out of the download too.
2. **Actions:**
   - `addMentorNote` twice with one token: one note, one `note-added` row;
   - `addCheckIn` with a future day: the form error, no note;
   - a mentor of another shop gets `notFound()`;
   - a made-up token gives `once-expired`.

**Implementation:**
- **`mentoredShops`:**
  - `staff_seller_profiles` where `mentor_id is not null`, `status <> 'pending'` and `shop_id is not null`, through the viewer's session (RLS gives a mentor theirs and an admin all);
  - the viewer's own profile is left out;
  - shops and first names; `recentCounts(slug, MENTOR_WINDOW_DAYS, now)`; `mentorFlags`.
- **`addNote`:** `add_mentor_note(p_owner, p_text, p_once_token)` or `add_check_in(p_owner, p_day, p_text, p_once_token)`.
  - `changed` gives the newest note id by this author about that owner;
  - `check-in-day-future`, `forbidden` and the once codes throw `Refused`.
- **`mentor-actions.ts`:**
  - `takeOnce` is skipped on Supabase, and `once` is passed to `addNote`;
  - the codes are caught as in Task 6;
  - `Refused("check-in-day-future")` gives the same form error as `checkCheckInDay`.

**Commands:** as Task 16.

## Task 20: Staff accounts and every role gate (decisions 6 and 19)

**Files:** `lib/data/staff-accounts.ts`, `lib/data/supabase/staff-accounts.ts`, `lib/staff/account-actions.ts`, `lib/data/contract/staff-accounts.contract.ts`, `.test.ts`, `.db.test.ts`, `lib/staff/contract/roles.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.**
1. **Data:**
   - **parity on the seed, as `staff`:** `listStaffAccounts()` (contract accounts dropped), `getStaffAccount(id)` and `countAdmins()`;
   - **`findStaffCandidate(email)`** (new export, both backends: the sample uses `findAccountByEmail`, the twin `staff_find_account`):
     - `" Contract-Asker@VOSSIE.test "` finds asker;
     - `"contract-ask"` finds nothing;
   - **`removeMentorView(viewerId, personId)`:** `mentorsOwnShop` true when asker mentors staff's shop.
2. **Actions** (each asserting nothing changed on a refusal):
   - **`giveStaffRole`:**
     - by exact email gives the role, one `role-given` row, and one `staff-role` notification;
     - sent twice with the token: one change;
     - a prefix of the email: `staff-email-unknown`;
     - a role held: `staff-role-held`;
     - a made-up token: `once-expired`;
     - as a mentor: `notFound()`;
   - **`removeStaffRole`:**
     - of your own admin role: `staff-own-admin` on the confirm page, role kept;
     - of the mentor role of whoever mentors your own shop: the `own-shop-mentor` notice, role kept, the shop keeps its mentor;
     - by another admin: changed, the shop loses its mentor, and the entry's detail names it ("Mentor. No mentor now: …");
   - **The last admin (decision 19):**
     - with `setRoles("asker", ["admin"])` and every other admin's role taken off by the verb (undone after), staff and asker each post the other's removal at once (`Promise.all`);
     - afterwards exactly one of them is still an admin;
     - exactly one `role-removed` row was written;
     - the other post answered `staff-last-admin` (sample) or `notFound()` (Supabase).

**Implementation:**
- **`listStaffAccounts` and `getStaffAccount`:** from `staff_accounts`, with `mentors` from `staff_seller_profiles` and `shops` (names, sorted).
- **`countAdmins`:** `profiles` where `roles` contains `admin`.
- **`giveRole(email, role, onceToken?)`:** `rpc("give_role")`:
  - `changed` gives `{ id, firstName }` read back from `staff_find_account`;
  - `no-account` and `held` pass through;
  - once codes and `forbidden` throw `Refused`.
- **`removeRole(accountId, role, byId)`:** `byId` must be the session's user; then `rpc("remove_role")`:
  - `changed` gives `{ id, firstName, role, unassigned }`, with the names read before the call;
  - `nothing` gives null;
  - `own-admin`, `last-admin` and `own-shop-mentor` pass through;
  - `forbidden` throws.
- **`account-actions.ts`:**
  - `findAccountByEmail` becomes `findStaffCandidate`;
  - the token is passed on Supabase;
  - `Refused` is mapped as in Task 6, and `forbidden` through `orNotFound`.

**Commands:** as Task 16.

## Task 21: The admin's numbers and the staff tools' privacy (decisions 9 and 16)

**Files:** `lib/data/numbers.ts`, `lib/data/supabase/numbers.ts`, `lib/data/staff-privacy.ts`, `lib/data/supabase/staff-privacy.ts`, `lib/data/contract/numbers.*`, `lib/data/contract/staff-privacy.*`.

**Failing tests first.**
1. **Numbers:**
   - `parity(() => countByWeek(now))` gives deep-equal `{ weeks, raw }` on the seed;
   - `protectCounts(raw)` of both is equal too;
   - **after the verbs** (a request, a follow, a report made and closed, with times set into last week by the admin client, or sample by the store), both backends move the same cells. Not this week's: this week is never counted;
   - **a source check:** `app/admin/numbers/page.tsx` reads private counts only through `protectCounts` (the existing check, if there is one; else new), and nothing outside `lib/data/numbers.ts` and its twin calls `admin_weekly_counts`.
2. **Privacy:**
   - `exportStaffToolsData(asker)` after an RSVP and a slot request gives the same shape on both backends, with no ids and no notes;
   - on Supabase, `forgetAccountInStaffTools` throws;
   - **the download never holds notes,** checked on the key list of `StaffToolsExport` (no `notes`) and by Task 19's RLS case.

**Implementation:**
- **`countByWeek(now)`:**
  - `weeks = sastWeeks(now)`;
  - `forServer().rpc("admin_weekly_counts", { p_now: now.toISOString() })`;
  - rows fold into `RawCounts`: each measure and period gets `{ campuses: { [slug]: n }, gone: n where slug is null }`; `open-shops` rows become `openShops`; a missing row is 0.
  - The comment cites `20261020120800_numbers.sql`'s shape and that the result goes straight to `protectCounts` (CLAUDE.md).
- **`exportStaffToolsData`:** the viewer's `hub_rsvps` and `hub_bookings`, with titles from `hub_cards` (C1), and "A removed post" otherwise (open question 2).

**Commands:** as Task 4.

## Task 22: C5 check, tags, JS budget, docs

1. **`lib/data/contract/tags.test.ts`:** a table of every write action in `lib/staff/*-actions.ts`, `lib/hub-actions.ts`, `lib/looking-for/actions.ts`, `lib/following/actions.ts` and `lib/saved-searches/actions.ts` against the tag it expires (from the `next/cache` stand-in), run on the sample backend and on Supabase with the data mocked. Both must expire the same tags:

   | Action | Tag |
   |---|---|
   | approve, verify, unverify, pause, resume, pause from a report | `sellers` |
   | hide the listing, show the listing again | `listings` |
   | post, edit, close, reopen or delete a request; send an offer; hide the request; show it again; a settle that closed something | `requests` |
   | save a Hub post, RSVP, cancel an RSVP | `hub` |
   | add, rename, retire or restore a point | `pickup-points` |
   | decline, assign a mentor, dismiss, pin, unpin, give or remove a role, a note or check-in, answer a slot, request a slot, follow, unfollow, save a search, pause or delete alerts | none |

2. **The suites:** `supabase db reset`, then `pnpm test` and `pnpm test:db`: all pass. `pnpm lint` and `pnpm typecheck`: clean.
3. **The JS budget, as 2b's Task 20:**
   - `pnpm build` in sample mode, then `tests/e2e/performance.spec.ts`: every page's first-visit JavaScript equals the last recorded figures to the byte;
   - `grep -l "supabase" .next/static/chunks/*.js` and `grep -l "serviceWorker.register" .next/static/chunks/*.js` print nothing;
   - `lib/data/refused.ts` and `lib/staff/follow-ups.ts` are server-only in practice: no `"use client"` file imports them (the boundaries test, extended to name them).
4. **Docs on the branch:** this plan's ledger and "Changes made during the build", and the programme plan's C4 and C5 lines.
5. **Lines for main at merge time** (prepared here, not written into main):
   - **CLAUDE.md:**
     - "staff actions start with `requireStaffAction()`";
     - "a staff action's audit, report closes and notifications run in `sampleFollowUps()`; on Supabase the staff function does them";
     - "a SQL answer the sample's type can't carry throws `Refused`";
     - "ownership on Supabase reads `seller_profiles.shop_id`";
     - "tokens for the five SQL-token forms are passed to the function (`tokenTakenInSql()`)";
     - "the action contracts live in `lib/staff/contract` and `lib/looking-for/contract`".
   - **GO-LIVE:**
     - the admin client's uses (decision 9);
     - tick the phase C staff items.

## Task 23: Step 5, the whole e2e suite on Supabase (decision 20)

**Needs:** phase B complete (its Task 11 has the sign-in specs on Supabase), C1 to C5 complete, and Task 22 green. The controller confirms nobody else is using the local stack (it is reset twice).

**Files:**
- `scripts/e2e-supabase.ts` (+ `.test.ts` for its env building) and `package.json` (`"e2e:supabase"`);
- `tests/e2e/helpers/supabase-session.ts`;
- `tests/e2e/helpers/messaging.ts` (`signInAsSample`, `signUpHere`, `sellerPage`), `tests/e2e/helpers/staff.ts` (`signedInPage`), `tests/e2e/helpers/staff-accounts.ts`;
- the spec changes listed below;
- `supabase/config.toml` (local limits) only if phase B's Task 10 hasn't set them.

**1. How it runs.**
- `pnpm e2e:supabase` runs `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e-supabase.ts [playwright args]`. The script:
  1. reads `supabase status -o json`, as `tests/db/global-setup.ts` does, and fails with its message when the stack is down;
  2. builds the child environment in memory: `VOSSIE_BACKEND=supabase`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `MAILPIT_URL`, `NEXT_PUBLIC_SITE_URL=http://localhost:3200`, and a random 48-character `VOSSIE_AUTH_HMAC_KEY` and `CRON_SECRET` made per run with `crypto.randomBytes`. It never writes them to a file or prints them;
  3. spawns `pnpm exec playwright test …` with that environment. Playwright's `webServer` inherits it, so `pnpm build && pnpm start --port 3200` builds and serves on Supabase.
- **Before each full run:** `supabase db reset` (local). Supabase keeps what earlier runs wrote, unlike the sample store, which a restart wipes. The suite's counts (36 listings, "2 listings" on Tech corner) assume the seed.
- **The unit test of the script:** the environment it builds has the five names, a 48-character key, and never the sample-mode development key. The keys are mocked.

**2. Signing in** (`tests/e2e/helpers/supabase-session.ts`):
- **`mintPersonaSession(email)`:** in the test process, `auth.admin.generateLink({ type: "magiclink" })` with the secret key from the environment, then `verifyOtp({ type: "email" })` on a fresh cookieless client: the spike's way, which the access token hook accepts.
- **`cookiesFor(session)`:** a `createServerClient` from `@supabase/ssr`, with `cookieOptions.name = "vossie_auth"` and an in-memory cookie store. It calls `auth.setSession(session)` and collects what `setAll` writes, so the chunking and `base64-` encoding are the library's own. It returns Playwright cookies for `localhost`, `httpOnly`, `sameSite: "Lax"`.
- **`signInAsSample(page, label, next)`:** on Supabase, maps the button label to the persona's seed email (`data/fixtures/accounts.ts`'s five), mints a **fresh** session per call, adds the cookies to the page's context, `goto(next)`, then `settled(page)`. Fresh per call, so no two contexts share a refresh token (phase B amendment 3's revoked-token cascade). Sample mode is unchanged.
- **`signUpHere`:** on Supabase it uses the real form. The code comes from Mailpit (phase B Task 11's helper if it exists; else `GET ${MAILPIT_URL}/api/v1/search?query=to:"<email>"`, newest, the 6 digits), and the "Sample mode: your code is" line isn't expected.
- **Local Auth limits** (local only; `[remotes.*]` untouched): `[auth.rate_limit] token_verifications` and `sign_in_sign_ups` at least 2,000 per 5 minutes, and `[auth.email] max_frequency = "1s"`. With about 135 sign-in call sites across 5 device projects, the defaults (30) fail within a minute. This is phase B's Task 10's file: it sets them, or this task does after it, with the controller's go-ahead.

**3. Specs that need a Supabase variant** (each change is `onSupabaseE2E()`-guarded, so sample runs are byte for byte the same tests; any `test.skip` needs a one-line reason and the controller's OK):

| Spec | What differs on Supabase |
|---|---|
| every spec through the helpers above | sign-in through `signInAsSample`, `sellerPage`, `signedInPage` and `signUpHere` (no spec text changes) |
| `accounts.spec.ts` | no sample buttons, no on-screen code, no "Sample mode" note; Your sessions lists Supabase's sessions; Download and Delete go through phase B's paths |
| `sign-in-return.spec.ts`, `account-delete-return.spec.ts` | phase B's Task 11 owns them; run as they are |
| `info.spec.ts` (privacy page) | names `vossie_auth` (phase B Task 9) |
| `routes.spec.ts`, `system.spec.ts` | `/login/sample` signs nobody in on Supabase (phase B decision 1); check any test that posts there |
| `hardening-writes.spec.ts` | unchanged (a fresh account), but read below on limits |
| `performance.spec.ts` | the byte counts must equal sample mode's: Supabase adds no client code |
| `offline.spec.ts` | unchanged |

**Message limits on Supabase:** the sample personas aren't exempt (`isSampleAccount()` is false). Before the first run, count the first messages and offers each persona sends across every project:

```
grep -rn "sendFirstMessage\|signInAsSample" tests/e2e
```

Then read which persona each test uses.
- If a persona starts more than 40 conversations in 24 hours, or sends more than 120 messages in an hour, across one run: stop and report.
- The fix is the controller's: those tests use a fresh account on Supabase, or the run is split with a reset between.

**4. Expected results.**
- `supabase db reset`, then `pnpm e2e:supabase`: the same pass and skip counts as the last sample run (record both: devices, and the seven write projects in their order).
- The JS budget check passes.
- `supabase db reset` again afterwards, so the next session finds the seed.
- **Failures:**
  - a failure that sample mode doesn't have is a C4, C5, C2, C3 or phase B bug, fixed in that module with a contract test first, never by changing the e2e assertion;
  - a test that can't pass on Supabase by design (for example one reading the on-screen sample code) gets its Supabase variant in the same spec.
- Then the programme's **staging checkpoint 2** (any new migrations), as its own runbook step with Lama's go-ahead for each run.

---

## Review

- **C4** (Tasks 10 and 11): one combined reviewer after Task 9, read-only, time-boxed to about 25 minutes, running `pnpm test` and `pnpm test:db` only.
- **C5:** one after Task 16 (the gates) and one after Task 22. The last checks:
  - every twin against its sample function, line by line;
  - that every staff action's first line is `requireStaffAction`;
  - that no follow-up runs on Supabase;
  - that no twin uses `forServer()` inside `"use cache"`;
  - each refusal scenario's "nothing changed" assertions.
- **Step 5:** its own review of the e2e diffs: no assertion weakened.

## Self-review

- **Coverage of the brief:**
  - **C4:**
    - request writes and the asker's reads, with `now` and settle-first: Task 4 (decision 8, Task 9b's note);
    - the request actions: Task 6;
    - offers' request side: Task 5;
    - follows: Task 7;
    - saved searches with matching in TypeScript after `notifyFollowers`, under its condition: Task 8 and decision 10;
    - `notifyOncePerDay` is SQL's on Supabase, shared with C3 (table, Shared files).
  - **C5:**
    - audit: 13;
    - staff shops: 14;
    - staff reports and Show again: 15 and 16;
    - mentors: 19;
    - Hub writes and staff reads: 18;
    - staff accounts with exact email, the last admin and own admin role: 20;
    - numbers through `admin_weekly_counts` then `protectCounts`: 21;
    - staff privacy and the download without notes: 21 and 19;
    - Featured writes and pins, pickup point writes: 17;
    - `lib/staff/*`: Tasks 2, 12, 16, 18 to 20.
  - **Gates:**
    - role: 16.1 and each action contract;
    - own-shop and own-request: 16.2;
    - own-shop-mentor, own admin role, last admin: 20;
    - one-time tokens: 6, 18, 19, 20;
    - one audit row only when changed: 16.3 and 13.
  - **Writes and reads:** writes through existing functions with the viewer's session (decision 2); reads through views and `is_staff` policies, plus Task 1's five additions.
  - **Tags:** decision 17 and Task 22.
  - **Step 5:** Task 23.
- **Checked against the code, not the brief:**
  - the SQL functions do the audit, the report closes and the notifications themselves (`staff_pause_shop`, `hide_listing`, `hide_request`), so the actions must not repeat them (decision 3);
  - `shops.owner_id` and `requests.asker_id` are not granted to `authenticated`, so ownership and the asker come from elsewhere (decisions 5 and 9);
  - `take_once_token` knows only `staff-once:`, and C2's token is `listing-once:` (Task 1's wrapper);
  - `findAccountByEmail` throws on Supabase (phase B), so Give a staff role needs `staff_find_account`;
  - `offersForRequest` and Saved's Shops tab name Hub-paused shops their reader can't otherwise see;
  - `last-admin` is unreachable one action at a time on both backends (decision 19);
  - the sample's `hideRequest` returns the asker's id, which the admin can't read on Supabase. It's used only by the follow-ups, which don't run there.
- **Found beyond the brief, and changing the programme:**
  - phase B's `takeFormState` stub needs Task 1's `take_form_state` (C2's new listing too);
  - C3's inbox likely needs a Hub-paused shop's name (open question 4);
  - step 5 can't sign the personas in by email code (decision 20) and needs local Auth limits raised.
- **Risks:**
  1. Phase B's timing gates Tasks 2, 6, 16, 18 to 20 and 23.
  2. Action-level tests on Supabase mock `lib/auth/session`, so the live re-check itself is phase B's to test.
  3. C2's photo helpers gate the Hub cover case.
  4. Persona message limits in step 5.
  5. Five files are shared with C1 and the world files with C2/C3.
  6. `selectAll`'s order on every new paged read (2b amendment 13).
  7. `audit_log.at` is the transaction's start, so two entries in one transaction would tie. None does today: each staff function writes one.
- **No placeholders:** every task names its files, its failing tests, its implementation and its commands. pgTAP and test counts are approximate ("about"); the implementer records them.
- **One writer per file:** the order table. `admin-actions.ts`, `staff-shops.ts`, `staff-accounts.ts`, `hub-actions.ts` and `mentor-actions.ts` are each written by Task 12 and then one later task.

## Ledger

| Task | Status | Commit |
|---|---|---|
| 0 Baseline | done, uncommitted | |
| 1 Missing SQL | done, uncommitted | |
| 2 Shared seams | done, uncommitted | |
| 3 World verbs, action harness | done, uncommitted | |
| 4 Requests | done, uncommitted | |
| 5 Offers | done, uncommitted | |
| 6 Looking For actions | done, uncommitted | |
| 7 Follows | done, uncommitted | |
| 8 Saved searches, alerts | done, uncommitted | |
| 9 C4 check | done, uncommitted | |
| 10 C4 review | | |
| 11 C4 fixes | | |
| 12 Ownership, follow-up wrap | done, uncommitted | |
| 13 Audit | done, uncommitted | |
| 14 Staff shops | done, uncommitted | |
| 15 Staff reports | done, uncommitted | |
| 16 Admin actions, gates | done, uncommitted | |
| 17 Pins, points | done, uncommitted | |
| 18 Hub | done, uncommitted | |
| 19 Mentors | done, uncommitted | |
| 20 Staff accounts | done, uncommitted | |
| 21 Numbers, privacy | done, uncommitted | |
| 22 C5 check, docs | done, uncommitted | |
| 23 Step 5 e2e | | |

## Changes made during the build

- Task 0: baseline on `944e182` (phase B, C1, C2 and C3 committed): pgTAP 2,489 in 40 files, unit 3,061, db 172 in 24 files; lint and typecheck clean. Recheck 6: every latest definition as listed, except that `take_form_state(p_key)` is C2/C3's (`20261022120000_c2_selling.sql:192`). Recheck 7: 47 lines (C5's). Recheck 8: `countAdmins()` still guarded by the admin check. The stack was this session's alone.
- Task 1, **amendment 3's probe held**: the follower reads a Hub-paused shop's row (and a seller-paused one) and never a waiting one; `storefronts` lists a seller's pause as `paused` and leaves the Hub's out; after the Hub pauses the offering shop, the asker (the offer thread's buyer) still reads its name through `shops`, the thread through `my_conversations` and the shop's message through `messages`. So `my_follows` and `my_request_offers` are not made (nor the cross-plan note to C3). The probe is the first 14 assertions of `50_c4_c5_reads.test.sql` (43 in all). `take_form_state` is not made (C2/C3's). The migration has `private.staff_accounts()` with the `public.staff_accounts` view and `public.staff_find_account(text)`, as written; test 06's allowlists gain `staff_find_account(text)` and `private.staff_accounts()`; `21_grants` unchanged. `supabase db lint`: only the inherited `create_report` warning; advisors: none. `pnpm db:types` adds the view and the function.
- Task 2: `lib/data/refused.ts`, `isRefused` and the codes, `viewerId()` and `forViewerAs()` are C2/C3's, reused. New: `lib/staff/follow-ups.ts` (`sampleFollowUps`), `tokenTakenInSql()` in `lib/staff/once.ts`, `requireStaffAction` and `orNotFound` in `lib/staff/access.ts` (its test stands in for `requireLiveAccount` with a partial mock, so the sample cases run on real sessions). The `takeFormState` twin calls `rpc("take_form_state", { p_key })` after checking the key is the session's `session_id` (`currentClaims()`), returns null for `none`, and reads the row back. The form-states contract runs the `onceRow` verb (amendment 6) for both prefixes on both backends; "a form that isn't a token gives none" is Supabase-only, since the sample store takes any form it's asked about and no caller asks about another.
- Task 2/3, **the viewer seam** (amendment 7): `tests/db/viewer.ts` keeps the viewer in an `AsyncLocalStorage` (`withViewer(name, run)`; `setViewer` is the default), and the Supabase world's `asViewer` uses it; a db case runs two overlapping `asViewer` calls. It also gains `withSessionSeam(authSession)`: `currentClaims`, `readClaims`, `viewerSession` and `liveUserId` answer the viewer's minted session.
- Task 3, **the action harness differs from the plan in one way**: instead of a `vi.mock` of `lib/auth/session`, the db action tests mock the two seams (`clients` and `auth-session`), so the real `lib/auth/session` runs as it does on Supabase (`getViewer` reads the profile with the viewer's client, `requireLiveAccount` finds the session live, `getSessionKey` is its `session_id`, form states are its session's). `tests/contract/actions.ts`: `actionContract(makeWorld, request, backend, scenarios)` with `signIn`, `post` (redirect, its type, or the 404), `notice` and `tags`; the sample side signs in with a stored session timed from the real clock (`signInSample`). `tests/db/actions.ts`: `signInDb` and `tidyFormStates` (the world accounts' form states go after each action test, since their sessions last the run). New verbs on both worlds: `setRoles`, `viewerAccount`, `addListing`, `publishListing` (Supabase: `save_listing` with the owner's session; sample: `saveOwnListing`, then `notifyFollowers` for an approved shop's available listing), `addReport`, `saveSearch` (times a millisecond apart unless given), `fillFollows` (the 200-follow limit needs 200 shops: owner-less ones made for the test), `setMentor`, `auditCount`, `addOffer` (Task 5), `offerFromGoneShop` (amendment 8: a throwaway Auth user and shop, the offer, an answer from the asker so the thread outlives the seller, then `forget_account` and the user's deletion; sample: `deleteAccountData`) and `tidyCommunity` (removes the requests, follows and saved searches the world accounts made during the test, with their notifications). `listingFields` lives in `tests/contract/world.ts`. Parity's `normalise` maps the sample's account ids to the seed's, and `dropContractAccounts(list, idOf)` is there for C5. The world contract's "cleanup puts it back" checks are Supabase-only (the sample world needs no undo).
- Task 4: the sample module exports `ownView` (the asker's view of a request from its parts), `OwnParts`, `ORDER` and `requestExport`, which its own functions now use, so the twin maps `my_requests` rows through the same rules. Settle-first: on Supabase `getOwnRequest`, `listOwnRequests`, `countOpenRequests`, `setRequestOpen` and `hideRequest` call the switched `settleRequests` first; `showRequest` doesn't. **Two contract cases are Supabase-only**, because the sample's settle-first lives in its actions, not its data functions (sample unchanged): Close on a due, unsettled request answering null, and (on the sample, the contract settles first, as `hideReportedRequest` does) the hide of a due request. Task 6's action contract proves settle-first on both. `updatedAt` isn't in `LookingForRequest`, so "edits" checks the title. `hideRequest` needs an open report on Supabase (`no-open-report` gives null); the contract reports the request first on both.
- Task 5: as planned with amendment 3's answer (no view). `countOffersSince` filters `is_offer`, `shop_id` and `not seller_gone`, **not** `request_id is not null` (amendment 11's list): the database clears `request_id` when a request is deleted and keeps `is_offer`, while the store keeps `requestId`, so `is_offer` is the sample's rule (C1's Task 19 note). The gone shop's offer shows "A closed shop" with an empty preview on both (the seller's messages go with the account).
- Task 6: the unit cases are a new file, `lib/looking-for/actions-supabase.test.ts` (Supabase mode, `lib/data` mocked), so `actions.test.ts` stays as it was; they fail on `944e182`'s `actions.ts` (8 of 10) and pass now. `saveMyRequest` gains a local `backWith(errors)`; `changeOpen` catches `Refused("reopen-limit")`; `sendOffer` catches `Refused("offer-rate" | "message-rate")` (amendment 11). The action contract (`lib/looking-for/contract/actions.*`) runs the five scenarios on both backends.
- Task 7: as planned with amendment 3's answer: follows, then the shops the follower may read, then `storefronts`; a readable shop with no storefront is a Hub pause, unless the reader is an admin and `staff_seller_profiles` says it's waiting (an admin reads waiting shops). `shopNameOf` reads any shop the signed-in reader may see. `listed` comes from C1's catalog snapshot. **"The owner following their own shop is never told" is Supabase-only**: the sample's `notifyFollowers` tells every follower (Follow refuses an owner, so only a row put in by hand reaches it); `private.tell_followers` leaves the owner out. Sample unchanged. Unfollow reads the shop's name before removing the follow, tested in `lib/following/actions-order.test.ts` (fails on `944e182`).
- Task 8: the sample module exports `NAMES`, `queryOf`, `toItem` and `searchExport` (its own functions use them). `notifySavedSearches` on Supabase builds the listing through `catalogOver(catalogSourceFrom(…))` over one listing, its shop and its `storefronts` row read with the public client, so it is listed exactly when buyers see it. `lib/saved-searches/actions.ts` needed no change; an action contract (`lib/saved-searches/contract/actions.*`, not in the plan's list) proves Save this search's token on both backends through `take_form_state`.
- Task 9: `lib/data/contract/c4-download.db.test.ts` runs the same story on both backends in one test and compares the three exports' key order and values (times aside) and that no id appears. Phase B's `app/route-handlers-supabase.test.ts` stubs the three new export twins, as C2/C3 did for theirs.
- Task 9's checks: `supabase db reset`, then pgTAP 2,532 (41 files), `pnpm test` 3,145 (384 files), `pnpm test:db` 237 (33 files, twice: the stack is left clean); lint and typecheck clean. One sample `pnpm build`: no client chunk names Supabase or a key, or registers the worker; only the font warning that predates this. E2E on that build (port 3308, scratch config): `performance.spec.ts` at phone-390, 45 passed, every figure unchanged (homepage 150,661 B brotli, listing 151,817, browse 151,408, storefront 151,421, Saved 151,296, request and collection 151,137, listing forms 152,334); `community*` and `alerts*` device parts at 390 and 1440, 77 passed (3 skipped); `community-writes` and `alerts-writes` with `--no-deps` on a fresh server, 19 passed.

- Task 12: as planned with amendment 9 (`ownKindOf`, sync, in `staff-shops.ts`; `staff-reports.ts` uses it). The async point reader is a new `findPickupPoint` in `pickup-points.ts` (index.ts's `pointById` isn't exported). `ownShopMentor`'s Supabase body is in `lib/data/supabase/staff-accounts.ts` (Task 20's file, only that function: `staff_seller_profiles`' mentor for the viewer's own row). The three source checks read the files with TypeScript's parser (`tests/helpers/action-sources.ts`): follow-ups in `lib/staff/follow-ups.test.ts` (calls inside `tellOwner` and `tellReporter`, themselves follow-ups, are checked where those are called), the sync imports in `own.test.ts`, the first gate in `access.test.ts` (followed through `mentoredFrom` and `setRetired`). Every write in `admin-actions.ts` is wrapped in `orNotFound` here (Task 16 turns it into `decide`). The seller review page also reads its points' names through `listPickupPoints()` (it used the sample's sync `pickupPointName`, empty on Supabase).
- Task 13: the fixture is the real `verifySeller` (twice) and `addPoint` through the action harness, as planned; the log has no delete on Supabase, so the checks read the newest entries, and `auditStaff()` is exact on the sample store and contains staff on Supabase (other runs' admins may be in it). New world verb `tidyPickupPoints` (removes points the test added).
- Task 14: `reviewOver`, `inReviewOrder`, `listedCountsOf` and `ReviewSource` are the sample's, exported. On Supabase a review's `shop.previousSlugs` is `[]` (an admin can't read another shop's old links; the review never shows them). `approveShop`/`declineShop` read the named owner's profile for the `reviewed` rule; when nothing is readable (no admin role) they call the function anyway, which answers `forbidden` (so the data-level refusal holds for them too). `approvedAt` isn't in the review, so "approvedAt is set" isn't asserted. Parity (`listShopsForReview`, every seed shop's review, `countWaitingShops`, `listMentors`) holds on the seed.
- Task 15: `reportViewOver(lookups)`, `ReportLookups` and `DELETED` are exported; the twin's `own` is `staff_reports.own`, read with `forViewerAs(viewerId)`. The seed has no reports and hides nothing, so parity is the empty queue and counts. New world verbs `deleteListing` and `closeShop` (the shop goes as `forget_account` takes it: its reports gone, its listings and pins deleted).
- Task 16: the Supabase-mode unit cases are a new file, `lib/staff/admin-actions-supabase.test.ts` (as Task 6), not `admin-actions.test.ts`. The contract's reports are by `seller`, so the reporter is never the acting admin; the unpin refusal's pin is the world's `addPin` verb (not a post by asker). The contract passed on both backends with Task 12's shape; the unit cases failed until `decide` and `pinSeller`'s mapping went in.
- Task 17: `pin_shop` and `unpin_shop` already forget that campus's `featured_draws` row for the day (since `20261020120400`, kept in `20261021120500`), so no SQL there; the contract proves `featuredFor` draws again on both. **`update_shop` keeps a pickup listing on a retired point** (the controller's ruling after C2): `20261023120100_c5_pickup_keep.sql` (copied from `20261020120000_widen.sql`, one condition added), pgTAP `51_c5_pickup_keep.test.sql` (9), and a contract case on both backends; the C2 shops contract's workaround is left as it is. `WorldListing` gains `pickupPointId`. A new point is read back by its campus and exact name.
- While in this area: `lib/data/supabase/accounts.ts` removes a deleted account's files with `photos.ts`' shared `removePhotoFiles` (batches of 100, its log wording); `accounts.test.ts` follows.
- Tasks 12 to 17's checks: `supabase db reset`, pgTAP 2,541 (42 files); `pnpm test` 3,207 (390 files); `pnpm test:db` 285 (38 files, twice, the stack left clean); lint and typecheck clean; `supabase db lint` only the inherited `create_report` warning; advisors none; types unchanged. `/api/cron/badges` is left for the next batch.

- C4 fix 1: `sendOffer` (`lib/looking-for/actions.ts`) keeps catching `offer-rate`/`message-rate` with their form errors; any other refusal of C3's list (`LATE_OFFER_REFUSALS`: `not-found`, `own`, `no-shop`, `pending`, `paused`, `closed`, `sample`, `listing-invalid`) saves the typed values with no error (`listing: ""` for `listing-invalid`) and goes back to the composer, which shows the request's current status; a plain `Error`, or a code outside the list, is rethrown. `actions-supabase.test.ts`: the rethrow case is replaced by `closed`, `listing-invalid` (text kept, listing dropped), `not-found` (listing kept) and a plain `Error` (rethrown, nothing saved); the composer's status mock is per test.
- C4 fix 2: `lib/data/contract/community-limits.db.test.ts` (Supabase only, C3's `limits.db.test.ts` pattern), four cases, each two at once through the real twins: `createRequest` at 4 open (one posted, one `open-limit`, 5 requests); one token sent twice (one posted, one `once-taken`, 1 request); `addFollow` at 199 (one `followed`, one `limit`, 200 follows); `startOffer` at 19 offers that day (19 offer threads with no messages, so the hour's limit stays out; one offer, one `offer-rate`, 20 threads). All held on the existing SQL locks (`vossie:requests:`, `vossie:follows:`, `vossie:offers:`), so no SQL changed.
- C4 fix 3: `myFollows` (`lib/data/supabase/follows.ts`) filters `.eq("account_id", accountId)` as well as the policy. New contract cases on both backends: another account's follows never show in `listFollowedShops`, `isFollowing` or `exportFollowing` (`follows.contract.ts`), another account's saved searches never in `exportSavedSearches` (`alerts.contract.ts`). Supabase only (`offers.contract.ts`): with offers from two shops, the asker sees both, each shop's owner only their own thread, and an account with none `[]`. The conversations policy (`private.conversation_side`) already allows only the reader's own threads, so `offers.ts` needed no check. (`saved-searches.ts`' `searchesOf` relies on its policy alone, as decided.)
- C4 fix 4: the Supabase `settleRequests` (`lib/data/supabase/requests.ts`) goes through React `cache()` keyed by the SAST minute (`sastDate` and `sastClock`): within one render the first caller's settle runs, with its time, and the render's other callers share its promise and count; the next minute or the next render settles again. React's `cache()` memoises only inside a Flight render (outside one, `getCacheForType` gives a new map), so a Server Action or Route Handler settles on every call and an action that writes still settles at its start. Unit test `lib/data/supabase/requests-settle.test.ts` stands in for a render's scope (the client build's `cache` is a pass-through); the db tests run outside a render, unchanged.
- C4 fix 5 (a difference for Lama, accepted): on Supabase `exportFollowing` (and Saved's Shops tab) leaves out a followed shop the follower can't read: a waiting one. The sample's download would name it. It's unreachable in practice: a shop can't be followed while it waits (`follow_shop` needs a storefront), and an approved shop can't go back to waiting.
- C4 fix 6 (Task 21b): `app/api/cron/badges/route.ts`, built as `/api/cron/photos` (`connection()` first, `no-store`, a 404 in sample mode, `cronAllowed` against `CRON_SECRET`), calls `recalculateBadges(new Date())` and answers `{ changed: n }`; when any badge changed it expires `sellers` with `sellersChangedNow()` (a Route Handler can't `updateTag`; `badges.ts` says the caller expires `sellers`). `vercel.json` gains `{ "path": "/api/cron/badges", "schedule": "5 22 * * *" }` (00:05 SAST); `lib/cron-config.test.ts` now expects the two jobs. Tests: `route.test.ts` (sample 404 with nothing worked out, proxy never matches; Supabase mode with `recalculateBadges` mocked: 401s, the count, `sellers` expired only on a change) and `route.db.test.ts` (401s change nothing; a wrong badge on Tech corner is put back, `sellers` expired, then `{ changed: 0 }`; `keepBadges` restores).
- The C4 fixes' checks: `supabase db reset`, pgTAP 2,541 (42 files, no SQL changed); `pnpm test` 3,221 (392 files); `pnpm test:db` 294 (40 files, twice, the stack left clean); lint and typecheck clean.

- Task 18: C2's photo helpers are in the branch, so the cover case is built (not `todo`): Preview stores a real upload through `storePhotos("hub", …)` (`add_hub_photo`, then the Storage upload), the save sends the cover's id, and `save_hub_post`'s `removed_paths` go to C2's `removePhotoFiles` after the commit, behind `.catch(() => 0)`; `lib/data/supabase/hub-posts.test.ts` proves the save stands when the removal throws (amendment 12). `PostSave` gains `onceToken`. On Supabase `publishedNow` is "no `published_at` before, one now", read from `staff_hub_posts` before and after. `listPostsForStaff` breaks a tie in `updated_at` by id, newest first, which is the store's reversed insertion order on the seed (parity holds). `answerBooking` answers null for an id that isn't a uuid. A student's `latestBooking` names the office hours through `hub_posts`, so a post put back to draft reads "Office hours that were removed" to them (unreachable: its page is the 404). `savePost` catches `once-expired`, `once-taken`, `date-past` (as `withPastDate`) and `cover-invalid` (the `once-expired` words, the cover cleared, everything typed kept: open question 3); `forbidden` is the 404 through `orNotFound`, in `answerSlot` too. New world verbs: `tidyStaffTools` (posts, RSVPs, slot requests and mentors' notes the test made, the authors' booking notifications, and the world accounts' roles put back) and `photoStored`; the harness's `post` takes `File` fields.
- Task 19: `addNote`'s token is an optional second argument, as decision 6 says. The seed parity runs for an admin (`staff`) only: the seed's mentor has no session in the db tests, so a mentor's own view is proven by behaviour ("asker" as mentor). `mentor-actions.ts`: `takeOnce` takes nothing on Supabase, and `writeNote` maps `once-expired`, `once-taken`, `check-in-day-future` (the form's own error) and `forbidden` (the 404). Amendment 17 (an admin who sells) is in the data contract on both backends, with the owner's empty `listNotes` on Supabase.
- Task 20: the sample's `findStaffCandidate` is `findAccountByEmail(normaliseEmail(email))` (staff-accounts.ts imports accounts.ts: no cycle). `getStaffAccount` and `removeRole` answer null for an id that isn't a uuid; `removeRole` reads the person's name and the shops they mentor before the call. `giveStaffRole` uses `findStaffCandidate`, takes no token on Supabase and maps `once-expired`/`once-taken`; both actions go through `orNotFound`. **The race (decision 19) runs truly at once on both backends**: the harness gains `postAs(name, …)` and `noticeAs` (the sample store through a per-call cookie jar, `withCookies` in `tests/helpers/next-request.ts`; Supabase through `withViewer`). Outcome as decision 19 says: the sample's second post answers `staff-last-admin`, Supabase's the 404, one admin left, one `role-removed` row. New verb `onlyAdmins`. **A test-runner finding**: two `import()`s at once of a `vi.mock`ed module can hand the second the unmocked module (Vitest 5), which signed the second admin out; `roles.db.test.ts` therefore also mocks `lib/data/auth-session` (`withAuthSessionWrapperSeam`, static imports only) and the race starts after one lone post. No production code changed for it.
- Task 21: `countByWeek` folds `admin_weekly_counts`' rows into `RawCounts` (an unknown measure throws); parity on the seed, `protectCounts` of both equal, and last week's request, follow and closed report move the same cells on both (verb `addPastActivity`), this week's request none. Source checks in `numbers.test.ts`: only the twin calls `rpc("admin_weekly_counts")`, only the numbers page calls `countByWeek`, and its raw counts go only into `protectCounts`. `exportStaffToolsData` reads the viewer's RSVPs and slot requests ordered by `created_at` (the store's insertion order), titled through `hub_cards`; `forgetAccountInStaffTools` throws. Phase B's `app/route-handlers-supabase.test.ts` stubs the new export twin, as C4 did for its three.
- The batch's extra item: `searchesOf` (`lib/data/supabase/saved-searches.ts`) filters `.eq("account_id", accountId)` as well as the policy. `lib/data/supabase/saved-searches.test.ts` (three cases, failing before) checks the filter on the list, the state and the download; `alerts.contract.ts` gains "never lists another account's search, or calls it saved" on both backends.
- Task 22: **`tags.test.ts` replays rather than hand-mocks**: each row's post runs on the sample store with `lib/data`'s modules and `lib/auth/session` recorded at their edge (`tests/contract/replay.ts`), then again with `VOSSIE_BACKEND=supabase` and every call answered by the recording, so only the actions' own backend-dependent code (`sampleFollowUps`, `tokenTakenInSql`, the refusal mapping) can differ; a call the sample never made fails the row. 41 rows: every export of the eight action files (a coverage check), plus unverify, an edit and a settle that closed something; each row proves on the sample store that it changed something. Both backends expire the table's tags. The boundaries test names `lib/data/refused.ts` and `lib/staff/follow-ups.ts` (no client file imports them).
- Task 22's checks: `supabase db reset`, pgTAP 2,541 (42 files, no SQL changed); `pnpm test` 3,308 (403 files); `pnpm test:db` 338 (48 files, twice, the stack left clean); lint and typecheck clean. One sample `pnpm build` (only the font warning): no client chunk names Supabase or a key, or registers the worker. E2E on that build (port 3310, scratch config): `performance.spec.ts` at phone-390 45 passed, every figure unchanged (homepage 150,661 B brotli, listing 151,817, browse 151,408, storefront 151,421, Saved 151,296, request and collection 151,137, listing forms 152,334); `staff.spec.ts` and `staff-checks.spec.ts` at 390 and 1440, 62 passed, 10 skipped; each write project with `--no-deps` on a fresh server: `staff-writes` 6 passed, `housekeeping-writes` 4 passed, `staff-accounts-writes` 29 passed, 1 skipped, **1 failed**: "a Show again confirm page holds still on a short phone" measured CLS 0.0892 (the figure before stage M's short skeleton) in 3 of 4 runs and 0.0437 in the other. Nothing this batch changed is on that page's path (`getHidden`, `StaffSkeleton short`, `ShowAgainConfirm` untouched; sample mode); for the controller to look at.

### Lines for main at merge time (Task 22, prepared here)

- **CLAUDE.md** (code rules):
  - "Every staff action is a Server Action in `lib/staff/*-actions.ts`: `requireStaffAction()` first" (in place of `requireStaff()`; pages and the mentor CSV keep `requireStaff`).
  - "A staff action's audit entry, report closes and notifications run inside `sampleFollowUps()` (`lib/staff/follow-ups.ts`); on Supabase the staff function does them in its own transaction."
  - "A Supabase answer the sample function's type can't carry throws `Refused` (`lib/data/refused.ts`); actions catch it only around the one call that can meet it, and a `forbidden` is the 404 (`orNotFound`)."
  - "Ownership on Supabase reads `seller_profiles.shop_id` (never `shops.owner_id`); pages and actions ask the async `ownsShop`, `ownsListing`, `ownsRequest` and `ownShopMentor`."
  - "The five SQL-token forms (a new request, a new Hub post, a note, a check-in, a role given) pass the token to their function on Supabase (`tokenTakenInSql()`); every other token goes through `takeOnceToken`."
  - "Action contracts live in `lib/staff/contract` and `lib/looking-for/contract` (and `lib/saved-searches/contract`); `lib/data/contract/tags.test.ts` holds every write action's tags."
- **GO-LIVE**: the admin client's request-time uses (decision 9: `notifySavedSearches`, `requestAskerId`, `countByWeek`, C1's `recentCounts`, plus the jobs); tick phase C's staff items (audit, shops, reports, Show again, Featured pins, pickup points, the Hub, mentors, staff accounts with the last-admin lock, numbers, the staff tools' download).

## Amendments on review (2026-10-21)

Checked against the branch at `28799de` (C1 Tasks 14 to 17b), the migrations, the local database's catalog (read only), the C2/C3 and phase B plans, and the code. Where an amendment and the text above disagree, the amendment wins.

**Fixed directly in the text:** Recheck 6's `dismiss_report` is `20261021120800_review_fixes_2b.sql:84`, and its grep is `create (or replace)? (function|view)` (the bare form also matched the `grant` lines); Task 1's files are renumbered by amendment 2 (`20261023120000_c4_c5_reads.sql`, `50_c4_c5_reads.test.sql`) in Task 1, the order table and "Shared commands".

1. **The controller's answers to the four open questions.**
   1. Decision 9's admin-client reads stand, as recommended (`notifySavedSearches`, `requestAskerId`, `countByWeek`, C1's `recentCounts`).
   2. Accepted: a student's download names a post put back to draft "A removed post".
   3. `cover-invalid` shows the existing `once-expired` words, with the cover cleared and everything typed kept.
   4. Yes: C3's inbox uses the same definer-view approach as `my_request_offers` for a Hub-paused shop's threads. **Cross-plan amendment for C3** (the controller carries it to `2026-10-21-supabase-phase-c2-c3-selling-messaging.md`): the buyer's inbox names a Hub-paused shop the way the asker's offers list does, so the two lists can't differ. *Read amendment 3 first: the premise may not hold.*
2. **One migration and pgTAP numbering scheme for the programme,** in build order, so each phase sorts after the one it builds on whenever it was written:

   | Phase | Migrations | pgTAP files |
   |---|---|---|
   | step 2b and C1 (incl. C1 Tasks 18 to 20, any fixes) | `20261021120000` to `20261021129900` (next free: `…120900`) | 24 to 35 (next free: 33) |
   | phase B | `20261021130000_sign_in_phase_b.sql`; its fixes `…130100` on | 36 to 39 (`36_sign_in_phase_b.test.sql`, not 32, which is `32_review_fixes_2b`) |
   | C2 and C3 | `20261022120000_c2_selling`, `…120100_c2_photos`, `…120200_c3_messaging` (unchanged); fixes `…120300` on | 40 to 49 (40 to 42 as planned) |
   | C4 and C5 | `20261023120000_c4_c5_reads.sql`; fixes `…120100` on | 50 to 59 (`50_c4_c5_reads.test.sql`) |
   | step 5 and later | `20261024120000` on | 60 on |

   A fix to an earlier phase made after a later phase's migration exists takes the next timestamp after the latest file (never a back-dated one), and the next pgTAP number in its own phase's range. Phase B's plan (Task 1, amendment 14) needs the same rename; the controller carries it.
3. **Check the premise of `my_follows` and `my_request_offers` before writing them.** `private.is_shop_contact` (`20261020120600_staff_pause_storefront.sql:53`) already lets a signed-in account read a shop whose status is `paused` (the seller's pause and the Hub's) when it follows it or is the buyer in one of its conversations; the asker is the buyer in every offer thread. So:
   - Task 1 first adds pgTAP probes: after the Hub pauses A, Q reads `shops.name` for A, and F reads HP's row; `storefronts` (`shop_id, slug, status`) tells a seller's pause (listed, `paused`) from the Hub's (not listed).
   - If both hold (they do on today's schema), **drop `my_request_offers`**: `offersForRequest` reads `my_conversations` (`is_offer`, `request_id`, `shop_id`, `seller_gone`), `shops` by id and the seller's first `messages`. **Drop `my_follows`** too: the twin reads `follows`, `shops` by id and `storefronts`; a waiting shop is unreadable and is left out, as `listFollowedShops` already does (Task 7's `exportFollowing` and `shopNameOf` cases for a waiting shop then expect the sample's answer only if the sample names one; check, and record any difference for Lama).
   - Then answer 4's cross-plan note becomes "C3 needs nothing: the policy already names a Hub-paused shop to its buyer". **Lama or the controller confirms** which way before Task 1.
4. **C2/C3 lands first, so use its seams; don't make them twice** (C2/C3 Task 4):
   - `lib/data/refused.ts` is C2/C3's (`Refused`, `refusalOf`). Task 2 adds `isRefused(error, ...codes)` and this plan's codes to it (in whatever form C2 typed `code`), and doesn't redefine the class. Actions may use `refusalOf` or `isRefused`.
   - `forViewerAs` lives in `lib/data/supabase/viewer.ts` (C2/C3), and `viewerId()` in `clients.ts` (C2/C3, wired by phase B). Task 2 imports them; its only `clients.ts` change is decision 9's line in the admin-client comment. `tests/db/viewer.ts` is edited only for amendment 7.
   - Decision 2's "from a plain module, `lib/data/refused.ts`" and Shared files' `clients.ts` row read accordingly.
5. **`take_form_state`: corrected reason, narrower body.**
   - The reason given in "Missing SQL" 5 is out of date: `authenticated` has had full `UPDATE` on `form_states` since review fix I1 (`20261020120400_staff_tools_actions.sql:32-33`), and two triggers keep `taken`. (Phase B's decision 15 repeats the stale reason; harmless.) The function is still the right tool: check and mark under the row lock, in one call, by the same rule as `take_once_token`.
   - C2 takes `listing-once:` inside `save_listing` (C2/C3 decision 9), so the only caller left is save this search (`lib/saved-searches/actions.ts:48`, a `staff-once:` token). `take_form_state` accepts only `^staff-once:<uuid>$` and its body is `return private.take_once_token(substr(p_form, 12));` (security definer, so it can call the revoked private helper; no copy of the rule). Task 1's tests: `listing-once:<uuid>` gives `none` and changes nothing; Task 2's contract drops its `listing-once:` case.
6. **The world after C2/C3 has four accounts** (`asker`, `shopper`, `staff`, `seller`, C2/C3 Task 4); decision 14 reads "stay four". Task 3 reuses C2/C3's verbs of the same meaning, with their signatures: `openShop`, `pauseShop`, `addHubPost`, `signedIn`, and `onceRow(name, form)` in place of `issueOnceToken` (Tasks 2, 4, 6, 18 to 20 call `onceRow(name, "staff-once:<t>")`). Task 3 adds only the verbs still missing.
7. **The viewer seam can't hold two viewers at once.** `tests/db/viewer.ts` keeps one module-level `current`, so Task 20's `Promise.all` race (two admins removing each other) would run both posts as the last viewer set. Task 3 scopes the viewer with `AsyncLocalStorage` (`asViewer(name, fn)` runs `fn` with its own viewer; `setViewer` stays the default), and `tests/db/actions.ts`'s session mock reads the same store. Test first: two overlapping `asViewer` calls each see their own `viewerId()`.
8. **Task 5 must not delete a world account.** Sessions are minted once per run (`tests/db/global-setup.ts`), so `forgetAccount("shopper")` and remaking it would leave every later file with a dead session and a stale id. The gone-seller case uses a throwaway account made by the admin client (one extra minted session), whose shop makes the offer; then `forget_account` through the admin client. On sample, a throwaway sample account.
9. **Task 12 also writes `lib/data/staff-reports.ts`.** It calls `ownsTarget` (`lib/staff/own.ts`) synchronously at `:100`, so making `ownsTarget` async breaks it. Task 12 adds a synchronous sample-internal `ownKindOf(accountId, target)` beside `isOwnShop` in `staff-shops.ts`; `staff-reports.ts` uses it (and keeps `isOwnListing`/`isOwnRequest` at `:260`/`:281`), and the async `ownsTarget` wraps the async exports. The order table: `staff-reports.ts` is written by 12, then 15. Recheck 7's three `lib/data` callers stay synchronous sample internals; none "moves to async".
10. **Task 12's "first line" source check** accepts a local helper whose first awaited call is `requireStaffAction(`: the mentor actions reach it through `mentoredFrom` (`mentor-actions.ts:27`).
11. **Task 6 also catches the offer race.** C2/C3 (decision 23 and its line 241) leaves `sendOffer`'s handling of `Refused("offer-rate" | "message-rate")` from C3's `startOffer` twin to C4. `sendOffer` catches them and writes the same form errors its own checks do; a unit case each. And Task 5's `countOffersSince` twin filters `is_offer`, `request_id is not null`, `shop_id`, `not seller_gone` and `created_at > since`, as the sample does.
12. **Atomicity (decision 3) confirmed against the SQL, no gap.** Each function does in its own transaction what the action's follow-ups do on the sample: approve, decline, verify, pause, resume (audit and the owner told; pause also closes the shop's reports and tells each reporter); `hide_listing`, `hide_request` (report closes, audit, owner or asker, reporters); `dismiss_report` (audit, reporter); `show_listing`, `show_request` (audit, owner or asker); `set_shop_mentor`, `pin_shop`, `unpin_shop` and the four point functions (audit only, as the sample); `give_role`, `remove_role` (audit, the person); `save_hub_post` (token, cover, audit); `answer_booking` (audit, student); `request_slot` (the author); `add_mentor_note`, `add_check_in` (token, note and audit in `private.write_mentor_note`). Outside the transaction, by design: `hide_request`'s settle (decision 8) and the Storage removal of `removed_paths` after the commit; a failed removal leaves a file for C2's sweep. Task 18 asserts the post saved even when the removal throws.
13. **Step 5's local Auth limits.** `supabase/config.toml` today: `token_verifications = 30`, `sign_in_sign_ups = 30`, `token_refresh = 150` (each per 5 minutes per IP) and `[auth.email] max_frequency = "60s"`; phase B's Task 10 raises only the local `email_sent` (to 1,000). So Task 23 writes, locally only: `token_verifications`, `sign_in_sign_ups` and `token_refresh` 2,000, and `max_frequency = "1s"`; `[remotes.*]` untouched. They take effect only after `supabase stop` and `supabase start` of the **shared** stack: a quiet window the controller arranges, with Lama's go-ahead, never during another session's run.
14. **Step 5's message limits, concretely.** Before the first run, Task 23 counts per persona from the specs: conversations started (an enquiry on a listing the persona already has a thread on starts none: `conversations_one_per_listing`) across the five device projects plus the write projects, and messages sent in any hour. If a persona passes 40 or 120, the run splits: device projects, then write projects, each after `supabase db reset` and a fresh server (no `E2E_REUSE_SERVER`). No exemption in SQL: the database has none on purpose (`20261020120700_message_limits.sql:8`).
15. **Step 5's spec table misses two specs:** `a11y.spec.ts:258` and `screenshots.spec.ts:341` expect the "Sign in as a sample account" heading, which Supabase mode doesn't show. Each gets its Supabase variant (or phase B's Task 11 takes them; the controller decides who).
16. **Task 20's verb that takes every other admin's role off** changes seed rows on the shared stack. Its undo runs in `finally`, and the controller runs Task 20's db file only when no other session's `pnpm test:db` is running.
17. **Task 19 adds the admin who sells:** with `openShop("staff")` mentored by asker and a note about staff, `listNotes(staffId)` as staff is `[]` on Supabase (`private.can_mentor` leaves out the owner, admins included) and `mentoredShops` leaves the shop out on both.
18. **Order with the programme** (C1 Tasks 18 to 20 → phase B → C2/C3 → C4/C5) fits, with these "After" additions: Task 0 after C1 Tasks 18 to 20 (Recheck 1's `featured.ts`, `shop-stats.ts`, `badges.ts` are theirs); Task 1 after C2/C3 Task 1 (migration order, amendment 5); Task 2 after C2/C3 Task 4 (amendment 4); Task 3 after C2/C3's last task that adds world verbs; Task 18 after C2's photo tasks. Phase B is complete before Task 2, so Recheck 2's split of phase B-gated tasks is moot.

### The controller's answers to the review (2026-10-21)
- **Amendment 3:** run the probe first; if `private.is_shop_contact` already lets a follower and a requester's offer thread read a Hub-paused shop, drop `my_follows` and `my_request_offers`, and the cross-plan note to C3 (answer 4) falls away with them. Record the probe's result.
- **Amendment 13:** the controller restarts the local stack for the local-only `config.toml` Auth limits at step 5, in a quiet window; implementers never run `supabase stop`.
- **Amendment 14:** if the sample personas meet the message limits on Supabase, step 5 splits the e2e run (fresh `supabase db reset` between parts) rather than exempting anyone on Supabase.
- **Cross-plan (after C2/C3's review):** C2/C3 creates `take_form_state` (both `listing-once:` and `staff-once:`), `lib/data/refused.ts` with both plans' helpers and codes, and the fourth world account `seller`. This plan reuses all three and doesn't recreate them.
- **After C2/C3 Task 1 (`687974e`):** `public.take_form_state(p_key text)` exists (listing-once and staff-once; the rule lives in `private.take_form_once`, which `take_once_token` wraps). Task 1 here drops its own `take_form_state`, and the `takeFormState` twin in Task 2 calls `rpc("take_form_state", { p_key })`. `lib/data/refused.ts` already exports both plans' codes, and `WORLD_ACCOUNTS` has `seller`.
- **After C2 (controller, 2026-10-21):** (a) `update_shop` moves a pickup listing off a retired point while the sample keeps it there (C2/C3 amendment 13.6): the sample's behaviour is the rule, so C5's pickup-point task changes the SQL to match, with a parity test. (b) C4's Task 2 wiring `takeFormState` to `take_form_state` is what lets a new listing save on Supabase; until then that path fails on Supabase only. (c) Phase B's `lib/data/supabase/accounts.ts` keeps its own `removePhotoFiles`; switch it to the shared one in `lib/data/supabase/photos.ts` while C5 is in that area.
- **After the C2/C3 fixes (controller):** add `/api/cron/badges`, a daily Vercel Cron Route Handler built like `app/api/cron/photos/route.ts` (`lib/cron.ts`' secret check, `connection()` first, `no-store`, 404 in sample mode), calling `recalculateBadges` on Supabase; add it to `vercel.json`; unit and db tests.

## C4 review fixes and the badge cron (the controller's decisions, 2026-10-21)
The C4 review (`636f6a3`) found no blockers. Built as one batch before Tasks 18–22, test first:
1. **A late offer refusal:** in `lib/looking-for/actions.ts`' `sendOffer`, any refusal from C3's list other than `offer-rate`/`message-rate` (`closed`, `not-found`, `listing-invalid`, …) saves the typed values (`listing: ""` for `listing-invalid`) and returns to the composer, which shows the request's current status; a plain `Error` is still rethrown. Replace `actions-supabase.test.ts:162`'s rethrow expectation with cases for `closed` and `listing-invalid` (text kept) and a plain `Error` (rethrown).
2. **C4's limits under concurrency (db tests, the pattern of C3's `limits.db.test.ts`):** two `createRequest` at 4 open requests (one posts, one `open-limit`); the same token twice at once (one request, one `once-taken`); `follow_shop` at 199 follows (one each way); `start_offer` at 19 offers that day.
3. **Follows and other accounts:** `myFollows` filters `.eq("account_id", accountId)`; tests on both backends that another account's follow never shows in `listFollowedShops`, `isFollowing` or `exportFollowing`, and another account's saved search never in `exportSavedSearches`; Supabase-only: `offersForRequest` read by someone other than the asker returns only their own thread (add a check in `lib/data/supabase/offers.ts` if the policy alone allows more).
4. **Settle once per request:** wrap the Supabase settle in React `cache()` keyed by the SAST minute, so one request settles once; a Server Action that writes still settles at its start. Record it.
5. **Download difference:** record in the plan's differences that on Supabase `exportFollowing` leaves out a followed shop the follower can't read (a waiting one, unreachable while an approved shop can't go back to waiting).
6. **`/api/cron/badges`** (Task 21b): as in the controller's note above, with `vercel.json`, unit and db tests.

## The MVP cut for Task 23 (Lama, 2026-10-21, approved in the "In" session; recorded by the controller)
- **Task 21** shipped whole (the numbers and staff-privacy twins), and **Task 22** shipped whole too, including 22.1's tag parity table (`9edecd6`), so nothing from 22 is deferred.
- **Task 23 is cut to one serial spec, `tests/e2e-supabase/mvp.spec.ts`,** in `playwright.supabase.config.ts`, after `supabase db reset`, fresh addresses through the existing helpers (`newAddress`, `latestCode`, `removeE2eAccounts`), and the first admin from `private.make_first_admin`. Twelve flows: (1) public reads; (2) becoming a seller and publishing a listing with a photo; (3) messaging; (4) report, hide and Show again; (5) a Looking For request and an offer; (6) follow and saved-search alerts; (7) a Hub event, an RSVP and the RSVP in the data download; (8) staff roles and the 404 view; (9) no admin decisions on their own shop; (10) the numbers page through `protectCounts`; (11) account deletion; (12) both crons answer 401 without `CRON_SECRET` and 200 with it (a random `CRON_SECRET` in the config's `webServer.env`). Flows 2–11 run in order; 1 and 12 stand alone. A failure is fixed in its module with a contract test first, never by changing the assertion.
- **Deferred to before the Eduvos rollout:** the full e2e suite on Supabase (Task 23 as written). Staging checkpoint 2 stays as planned.
