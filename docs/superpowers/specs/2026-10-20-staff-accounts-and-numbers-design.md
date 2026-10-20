# Vossie staff accounts, numbers and Show again: design spec

- **Date:** 2026-10-20
- **Status:** Built (2026-10-20), in sample mode. Decided by Claude under Lama's standing goal (decision 54); Lama may revisit.
- **Scope:** stage J. It builds the parts of stage G's "Not in this stage" (staff tools spec 7) that sample mode can build:
  - staff accounts management: giving and taking away the mentor and admin roles;
  - the admin's numbers: counts per campus and in total, with no names;
  - Show again for a listing or a Looking For request the Hub hid.

  It also settles stage G's open point about the staff 404's status. It builds on stages D (sessions, form state), E (notifications), G (the staff console, the audit log, `requireStaff`, one-time tokens, Hide the listing) and H (Hide the request, follows).

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-14-staff-tools-design.md` | Stage G. Its section 8 wins over its decisions, and this spec reuses its patterns: the staff frame, confirm pages, notices, "Nothing changed", the audit rules (8.11) and one-time tokens (8.16) |
| `docs/superpowers/specs/2026-10-14-community-actions-design.md` | Hide the request (2.14) and follows (2.15) |
| `docs/superpowers/specs/2026-10-14-search-alerts-design.md` | Saved searches' privacy promise (2.15), which keeps them out of the numbers |
| `docs/superpowers/specs/2026-10-14-accounts-design.md` | Accounts, roles (2.9), the data export and deletion |
| `docs/reference/GO-LIVE.md` | Section 5 (staff tools), section 6 (the true 404 item, scheduled jobs) and section 7 ("Showing a hidden listing again") |
| `node_modules/next/dist/docs/01-app/02-guides/streaming.md` | "The HTTP contract": why a `notFound()` inside `<Suspense>` answers 200 |
| `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md` | `export const instant = false`, the "block" fix for runtime data outside `<Suspense>` |

---

## 1. Goal

The Hub can run its own staff list from the admin console instead of the fixtures:
- give a student the mentor or admin role by their exact Eduvos email;
- take a role away.

It can see how Vossie is doing at each campus, week by week, without seeing who did what. It can undo its own Hide.

All of it is plain server-rendered forms, links and tables, with no new client code. Staff pages also start answering a real 404 status to anyone without the role.

## 2. Decisions

### Staff accounts

1. **Two roles, as the code has them.** `StaffRole` is `"mentor" | "admin"` (`lib/types.ts`). There is no "Hub staff" role: the Hub's tools (`/hub/manage`, `/hub/new`, `/hub/[id]/edit`) are open to mentors and admins (`lib/staff/roles.ts`). This stage adds no role, and doesn't change what each role opens.
   - **Changed from the brief:** "Hub staff, if that's a role in the code". It isn't, so it isn't listed.
   - Roles aren't tied to a campus. The list shows each person's own campus (the one they chose at sign-in) as information only. A campus-scoped mentor is a later question (section 10).
2. **`/admin/staff` lists everyone who holds a role, and no one else.** It's admin only, behind `requireStaff("admin", …)`, and it's linked in the staff frame's row as **Staff**, after **Numbers** and before **Audit log**.
   - It shows a table, "Staff accounts (N)", with these columns:
     - Name (first name);
     - Email;
     - Campus;
     - Roles ("Mentor", "Admin" or "Mentor, Admin");
     - Shops they mentor (a number; "None" for an admin who mentors none);
     - one action cell.
   - Rows are sorted by first name, then email.
   - The email is shown because the admin gives roles by email and two staff may share a first name. Students who hold no role never appear on this page, in any form.
3. **Give a role by exact email: never a search, a suggestion or a list of students** (POPIA section 10, minimality). The form sits above the table, with the heading "Give a staff role":
   - **Eduvos email:** `type="email"`, `autocomplete="off"`, and the hint "The email they sign in with. They need to have signed in to Vossie once."
   - **Role:** a fieldset of two radios:
     - **Mentor:** "The Hub's posts and office hours, and the mentor dashboard";
     - **Admin:** "Everything, including this page".
   - A **Give role** button, and a hidden one-time token (`lib/staff/once.ts`, as G's create forms), so a second press gives nothing and goes where the first went.
   - The action normalises the email with `normaliseEmail` (`lib/auth/email.ts`) and looks it up with `findAccountByEmail`, the exact lookup sign-in already uses.
   - It fails with one of these errors, kept in form state with the typed email, never in the URL:
     - `staff-email-missing`: "Enter their Eduvos email."
     - `staff-email-unknown`: "No Vossie account uses that email. Ask them to sign in once, then try again."
     - `staff-role-missing`: "Choose Mentor or Admin."
     - `staff-role-held`: "That account has that role already."

     The unknown-email error tells an admin whether an address has an account. That's the least this feature can reveal, and only admins see it.
4. **Take a role away, through a confirm page** (G decision 9: actions that take something away get a confirm page). Each role in a row has its own link, **Remove mentor role** or **Remove admin role**, with the person in visually hidden text ("Remove Naledi's mentor role"). The links go to:
   - `/admin/staff/[id]/remove-mentor`
   - `/admin/staff/[id]/remove-admin`

   The confirm page is G's `ConfirmAction` (`components/staff/ConfirmAction.tsx`). It repeats what will happen, and has a **Remove Naledi's mentor role** (or **Remove Pieter's admin role**) button and G's **Keep it** link back to `/admin/staff`.
   - There's no reason field: the person doesn't need one to read, and the audit entry records the role.
   - `ConfirmAction` always draws its required reason today, so it gains a `reason: false` mode with no field. Its other users don't change.
   - **Mentor:**
     - "Naledi loses the Hub's tools and the mentor dashboard straight away."
     - "These shops will have no mentor: Tech corner. Give them a new one on each shop's page." Or "Naledi mentors no shops."
     - "Naledi's notes, check-ins and Hub posts stay. Only an admin can edit those posts afterwards."
   - **Admin:**
     - "Pieter loses the admin console straight away."
     - "Pieter's entries in the audit log stay."
   - **Changed from the brief:** removing has a confirm page, which the brief didn't name. Losing a role is immediate, and for a mentor it unassigns shops.
5. **An admin can't remove their own admin role, and Vossie always keeps one admin.**
   - Your own row shows no Remove admin role link; the cell says "This is you." The confirm page and the action refuse it too, with the error `staff-own-admin`: "You can't remove your own admin role. Ask another admin."
   - With that rule, the last admin is always the person on the page. The data function still refuses to remove the last admin (`staff-last-admin`: "Vossie needs at least one admin."), so two admins removing each other at the same moment can't leave none. In sample mode the check and the write have no `await` between them. The real backend needs a transaction or a trigger (a go-live item).
   - A mentor role can always be removed, your own included.
6. **What a change does, and when.**
   - The role changes on the account row. `getViewer()` reads roles from the store on every request, so the person's next page load shows or hides their tools. Their sessions aren't touched.
   - Removing a mentor role also clears `mentorId` on every shop they mentor, as deleting their account does (`lib/data/staff-privacy.ts`). Their notes, check-ins and Hub posts stay as they are.
   - Giving a role changes nothing else. A new mentor appears in the seller page's mentor choice, which reads `listMentors()`.
7. **One audit entry and one notification for each change** (CLAUDE.md's staff action rules: `requireStaff()` first, then one `recordAudit()` only when something changed).
   - **New audit actions:**
     - `role-given`, worded "Gave a staff role";
     - `role-removed`, worded "Removed a staff role".

     Both are filed under a new kind, `staff` ("Staff accounts"), which the audit log's filter lists after "Mentoring".
   - **The entry:**
     - target: a new target kind, `account`, with the person's id and first name;
     - detail: "Mentor" or "Admin"; for a mentor removal that unassigned shops, "Mentor. No mentor now: Tech corner, Plug & play";
     - subject: the person, so deleting their account forgets them in it (G 8.11).
   - **The notification:** a new kind, `staff-role`, drawn with `ShieldIcon` (already in `components/icons.tsx`). Its subject is the role. It links to `/account`, where the account page lists each staff area by role (G plan decision 19). The sentences are in `lib/staff/notification-text.ts`:
     - Mentor given: "You're a Vossie mentor now. The Hub's tools and the mentor dashboard are on your account page."
     - Admin given: "You're a Vossie admin now. The admin console is on your account page."
     - Mentor removed: "Your mentor role on Vossie has ended. Thank you for helping student sellers."
     - Admin removed: "Your admin role on Vossie has ended."
   - **The page's notices** (`lib/staff/notices.ts`):
     - `role-given`: "Role given. They've been told, and their tools are on their account page."
     - `role-removed`: "Role removed. They've been told."
     - A repeat, or a removal that finds the role already gone, says G's "Nothing changed. It was already done." and writes nothing.
8. **Deleting a staff account says what happens to their work** (G's open point "Deleting a staff account says nothing about their own work").
   - Privacy settings' delete step gains a line, shown only to accounts with a role: "You're Hub staff. Your Hub posts stay with no author, your notes and check-ins stay as "Deleted account", the shops you mentor lose their mentor, and the audit log keeps your entries without your name."
   - If the account is the only admin, it adds: "You're Vossie's only admin. Give someone else the admin role first, or no one can use the admin console."
   - The warning doesn't block deletion, because deleting your account is your right under POPIA. Sample mode gets its admin back on restart, or through the sample admin's sign-in button. The real backend needs a way to give the first admin role outside the app (a go-live item).

### The admin's numbers

9. **`/admin/numbers`, admin only, linked as Numbers in the staff frame's row.** Mentors don't see it.
   - Roles aren't tied to campuses, so a mentor "at a campus" isn't something the code knows.
   - Mentors already have their own shops' numbers on `/mentor`.
   - The page counts enquiries and reports that mentors never see one by one, and the least access is admins only.
   - Revisit this if Eduvos wants campus-scoped mentors (section 10).
10. **What it counts.** Every figure is worked out from the store as the page renders. There are no names, ids or links to anything counted. Each measure is a row:

    | Measure | Counted when | Campus | Kind |
    |---|---|---|---|
    | Listings published | A listing's `firstPublishedAt` | The listing's | Public |
    | Shops approved | A shop's new `approvedAt` (section 4); a sample shop with no owner counts at its `createdAt` | The shop's | Public |
    | Looking For requests posted | A request's `createdAt` | The request's | Public |
    | Enquiries started | A conversation's `createdAt`, offers left out (`requestId` set), as F's counting does | The shop's | Private |
    | Reports made | A report's `createdAt` | The reported listing's, shop's or request's | Private |
    | Reports closed | A report's `closedAt` | As above | Private |
    | Shops followed | A follow's `createdAt` | The followed shop's | Private |

    There's also a snapshot, **Open shops now**: approved, not paused, with at least one available listing the Hub hasn't hidden (Featured's own test of a shop worth showing, G decision 8).
    - **Public** measures count things anyone can already see with their campus on them (listings, storefronts, the board). **Private** measures count what students do out of sight.
    - Things deleted since don't count: the store no longer has them. Something whose campus has gone (a conversation with a deleted shop, say) counts in the all-campus total only. The page says both.
    - **Changed from the brief:**
      - **Saved searches are left out.** Their spec (2.15) and the privacy policy promise that "Hub staff tools don't show them" and that they are "used only to tell you about new listings". Counting them would break that promise, and nothing the Hub decides needs the number.
      - "Shops approved and active" becomes two measures: approvals by week, and open shops now.
11. **Fixed SAST weeks, Monday to Sunday.** The page shows two weeks:
    - **Last week:** the most recent complete week, from Monday 00:00 to Sunday 24:00 in South African time (Sunday 22:00 UTC to Sunday 22:00 UTC);
    - **The week before:** the complete week before that.

    The column headings name the dates: "Last week (12 to 18 Oct)" and "The week before (5 to 11 Oct)", in `shortSastDate`'s style.
    - **Since the start:** everything in the store up to the end of last week.
    - **Change:** last week less the week before, signed ("+3", "−2", "0").
    - **Changed from the brief:** "the last 7 days against the 7 before" becomes complete calendar weeks. The two match on Mondays, and the brief asked for SAST weeks. Rolling windows also give away a single day's figure when someone compares the page on two days in a row. Fixed weeks change once a week, so the finest grain anyone can see is a week, which the small-number rule (decision 13) protects. Fixed weeks are also the shape a nightly roll-up stores (decision 15).
12. **Two plain tables and a campus view, with no charts and no client code.** All of them are in `<table>` elements with captions and header cells. They stack into G's card rows on phones (`StaffTable`), with the table roles kept.
    - **"All campuses":** a row for each measure, then Open shops now. Its columns are Last week, The week before, Change and Since the start. Open shops now shows its single figure under Since the start and "Not counted by week" in the others.
    - **"By campus, last week":** a row for each campus (Eduvos Online included) and a final "All campuses" row. Its columns are the seven measures and Open shops now. Each campus name links to that campus's view (`/admin/numbers?campus=midrand`, `prefetch={false}`).
    - **The campus view:** the "All campuses" table's shape for one campus, captioned with its name, with an "All campuses" link back.
    - An unknown `campus` value shows the main page: it's a query, not a route, so there's no 404.
    - A line above the tables: "Counted from Vossie's store as this page opens. Weeks run Monday to Sunday, South African time. Things deleted since aren't counted. Small numbers of private things show as "Under 5" so no one can be picked out." In sample mode a second line adds: "In this preview the store starts again whenever the server restarts."
13. **The small-number rule** (POPIA section 6(1)(b) and section 10). Counts that can't identify a person are de-identified information, and POPIA doesn't reach information that can't be re-identified. So the page must keep a private count from pointing at a student.
    - On a small campus in a quiet week, "1 report" or "2 enquiries" can name a person to an admin, or to anyone a screenshot reaches (these pages will be shared with Eduvos), who knows who complained or who was buying.
    - Five is the threshold national statistics offices and health registers commonly use for small cells. It's large enough that a figure doesn't single anyone out on Vossie's smallest campus, and small enough that most campus figures still show.
    - Public measures need no rule: each listing, shop and request is already visible with its campus.

    The rule applies to the private measures only, at every campus and in the totals. It's a pure function, `protectCounts`, in `lib/staff/numbers.ts`:
    1. **Under 5.** A count from 1 to 4 shows as "Under 5". 0 shows as 0: nobody did anything, so no one is described.
    2. **No working back from the total.** If a column (one measure, one week) has exactly one campus showing "Under 5" while its total is shown, the next-smallest non-zero campus in that column shows as "Hidden". The key under the table says: "Hidden: not shown, so the total can't reveal a small number." There's always such a campus, because a total of 5 or more with one campus under 5 means another campus holds the rest. That campus may be "a gone campus", counted only in the total, which hides it already.
    3. **Change.** Change shows "—" unless both weeks are shown at that campus.
    4. **Since the start, rounded down to tens.** Private Since the start figures show as "Under 10", "10+", "20+" and so on. Otherwise the figure on this week's page, less the figure on last week's, would give last week's exact count after the rule hid it.

    Admins can still open each report in the queue: the rule protects the numbers page and what's copied from it, not the console. The page says so in its key.

### Show again

14. **An admin can show a hidden listing or a hidden Looking For request again: the mirror of G's Hide the listing and H's Hide the request.**
    - **Where:** a new page, `/admin/hidden`, admin only. Two tables, each newest hidden first:
      - "Hidden listings (N)": Listing, Shop, Campus, Hidden on (SAST date), Reason, and a **Show again** link ("Show Casio fx-991ZA Plus again" in full for screen readers);
      - "Hidden requests (N)": Request, Campus, Hidden on, Reason, and **Show again**.

      Empty: "No hidden listings." and "No hidden requests."
    - **How it's reached:**
      - a "Hidden listings and requests" link above the Reports queue;
      - an Overview line, "2 listings and 1 request are hidden", linking to it;
      - on a closed report whose target is hidden (`unseen === "hidden"`), a **Show it again** link beside "Buyers can't see this listing: the Hub has hidden it."

      The Reports queue keeps only the 50 most recently closed reports, so a page of its own is the only place an old hide stays reachable. **Changed from the brief:** "where the hidden item is reachable in the admin console" becomes a page of its own, with links from those three places.
    - **The confirm page:** `/admin/hidden/listings/[id]` or `/admin/hidden/requests/[id]`. Showing something again can't be undone from the console: hiding it again needs a new report, because Hide lives on the report's confirm page. So it gets a confirm page. Its lines:
      - **Listing:** "Show "Casio fx-991ZA Plus" again?" "Buyers will see it in browse, on Tech corner's shop and on its own page again." "Its seller is told. The reports about it stay closed, and the people who made them aren't told." "To hide it again, someone has to report it."
        - When the shop is paused by the Hub, it adds: "Tech corner is paused by the Hub, so buyers won't see it until the shop is resumed."
        - When the listing is sold, paused by its seller, or a draft, it adds: "It's marked sold, so buyers will see it as sold." (or "paused", or "a draft, so only its seller sees it").
      - **Request:** "Show "Graphing calculator for MAT2" again?" "Students will see it on Looking For and on its own page again." "The asker is told. The reports about it stay closed, and the people who made them aren't told." "To hide it again, someone has to report it." If the asker had closed it, it adds: "Its asker had closed it, so it shows as closed."
      - It's `ConfirmAction` in its no-reason mode (decision 4), with a **Show Casio fx-991ZA Plus again** button and **Keep it** back to `/admin/hidden`. There's no reason field: the student needs none, and the log records the action.
    - **What it does** (`showListing(id)` in `lib/data/staff-shops.ts`, `showRequest(id)` in `lib/data/requests.ts`):
      - It clears `hiddenAt` and `hiddenReason`. It returns null when the thing has gone or isn't hidden, which gives "Nothing changed. It was already done."
      - It writes one audit entry: `listing-shown` ("Showed a listing again") or `request-shown` ("Showed a request again"), under the `reports` kind beside the hides, with the seller or asker as subject.
      - It tells the student:
        - the seller, with kind `shop-update`: "The Hub is showing {title} again. It's back in My listings." linking to the listing's My listings tab;
        - the asker, with kind `request-update`: "The Hub is showing your request {title} again." linking to Your requests.
      - It expires the right tag: `listingsChanged()` for a listing (as Hide does), `requestsChanged()` for a request. So browse, the storefront, the sitemap, the board and the request's page read it again.
      - Reports already closed stay closed with their outcome. Reporters aren't told again: they were told the Hub acted, and it did.
      - Followers and saved searches aren't told. Showing again isn't a first publish (`firstPublishedAt` is already set), just as resuming isn't (search alerts spec 2.10).
      - A listing's photos become public again by themselves: `lib/data/photos.ts` hides photos only while `hiddenAt` is set.
    - The notices: `listing-shown`, "Showing again. Its seller has been told."; `request-shown`, "Showing again. The asker has been told."

### The staff 404's status

15. **Staff pages answer a real 404 status to anyone without the role.**
    - Today `requireStaff` runs inside `<Suspense>`, after the 200 has been sent (G 8.1). Next's streaming guide is plain about it: once a fallback renders, the status is committed, and a `notFound()` after that can only add `noindex`. The same guide gives the fix: check before any `<Suspense>`.
    - Cache Components refuses a session read outside `<Suspense>` at build, but the build error names a third option: `export const instant = false`, which allows a blocking route. A blocking page holds the response until its top-level awaits finish. The root layout has no `<Suspense>` around `{children}` (`app/layout.tsx`), so a `notFound()` or `redirect()` thrown at the page's top level comes before the first byte, and Next sends a real 404 or a real 307.
    - The cost:
      - Staff pages lose their static shell (the wordless `StaffSkeleton`): a staff page now arrives whole, after one session read, which takes microseconds in sample mode and one indexed lookup on the real backend.
      - Staff links never prefetch anyway (G 8.20), and no buyer ever loads a staff page, so nothing public changes. It costs no JavaScript.
    - So every staff page, G's and this stage's, does this:
      1. `export const instant = false`;
      2. `await requireStaff(area, path)` at the top of the page component, before it returns anything (awaiting `params` there first on dynamic routes);
      3. then the page renders, as it does today. Its inner `<Suspense>` boundaries may stay, but they no longer guard the role.

      `staffMetadata` is unchanged. Server Actions and the CSV route already check first.
    - **A spike comes first, with a stop rule.** The plan's first task changes `/admin` alone, and checks that `pnpm build` passes and that `curl -I` gives 404 for a student and 307 for a signed-out visitor. If the build refuses it, or the status is still 200, the stage keeps G's pattern, says why in the plan, and leaves the proxy item on the go-live list. If it works, the go-live item is ticked, and the plan updates two lines of CLAUDE.md: the staff pages line (blocking pages with `instant = false`, not a skeleton shell), and the `cookies()` rule's exception.
    - `StaffSkeleton` may become unused; it stays for Lama to delete or keep (no `rm`).

---

## 3. Screens (summary)

| Route | Role | What |
|---|---|---|
| `/admin/staff` | Admin | Everyone with a role, and the Give a staff role form (decisions 2 and 3) |
| `/admin/staff/[id]/remove-mentor`, `/admin/staff/[id]/remove-admin` | Admin | The confirm page for taking a role away (decisions 4 and 5) |
| `/admin/numbers`, `/admin/numbers?campus=…` | Admin | All campuses and By campus, or one campus's view (decisions 9 to 13) |
| `/admin/hidden` | Admin | Hidden listings and hidden requests (decision 14) |
| `/admin/hidden/listings/[id]`, `/admin/hidden/requests/[id]` | Admin | The Show again confirm page |
| `/admin`, `/admin/reports`, `/admin/reports/[id]` | Admin | As now, with links to `/admin/hidden` (decision 14) |
| `/admin/audit` | Admin | As now, with the Staff accounts kind |
| `/notifications` | Signed in | The `staff-role` notification, and Show again's sentences |
| `/account/privacy` | Signed in | The staff lines on the delete step (decision 8) |
| Every staff page | Staff | A real 404 or 307 for anyone else (decision 15) |

The staff frame's row for an admin becomes: Overview, Sellers, Reports, Featured, Pickup points, Numbers, Staff, Audit log, Hub posts, Mentoring. All new pages are `noindex`, titled through `staffMetadata()` ("Staff accounts", "Remove a role", "Numbers", "Hidden", "Show again"), and linked only from staff pages, without prefetch.

Dynamic routes follow CLAUDE.md:
- `generateStaticParams` returns one sample that matches nothing (`acc-sample`, `l-sample`, `r-sample`);
- an unknown id, or an account with no role, calls `notFound()`;
- the remove-admin page calls `notFound()` for an account that isn't an admin, and the remove-mentor page for one that isn't a mentor.

The confirm page for your own admin role shows the refusal and no button.

## 4. Data

- **No new tables.** Roles live on `AccountRow.roles` already.
- **`SellerProfileRow.approvedAt?: string | null`.** `approveShop` sets it the first time a shop opens, and a decline or a pause leaves it alone. Fixture shops with an owner are seeded with their shop's `createdAt`. `STORE_VERSION` goes from 8 to 9.
- **New functions, all in `lib/data`:**
  - `lib/data/staff-accounts.ts`:
    - `listStaffAccounts()`;
    - `giveRole(email, role)`, which returns the account, `"no-account"` or `"held"`;
    - `removeRole(accountId, role, byId)`, which returns the change with the shops left without a mentor, or `"own-admin"`, `"last-admin"` or null;
    - `countAdmins()`.
  - `lib/data/numbers.ts`: `countByWeek(now)` returns raw counts by measure, period and campus. A count on a campus that has gone is kept under a `gone` key, which only totals use.
  - `showListing(id)` in `lib/data/staff-shops.ts`, and `showRequest(id)` in `lib/data/requests.ts`.
  - `listHidden()` in `lib/data/staff-reports.ts`: hidden listings and requests, with the shop's name and the campus.
- **Pure functions in `lib/staff`:**
  - `numbers.ts`: `sastWeeks(now)` gives the two weeks' bounds in UTC; `protectCounts(grid)` applies decision 13; `changeText()`.
  - The new words go in `notices.ts`, `errors.ts`, `audit-words.ts` and `notification-text.ts`.
- **New Server Actions:**
  - `lib/staff/account-actions.ts`: `giveStaffRole` and `removeStaffRole`.
  - `lib/staff/admin-actions.ts`: `showListingAgain` and `showRequestAgain`.

  Each follows CLAUDE.md's staff action order: `requireStaff()`, check, write, one `recordAudit()` if something changed, notify, expire the tag, notice, `done()`.
- **Types** (`lib/types.ts`):
  - `AuditAction` gains `role-given`, `role-removed`, `listing-shown` and `request-shown`;
  - `AuditKind` gains `staff`;
  - `AuditTargetKind` gains `account`;
  - `NotificationKind` gains `staff-role`.

## 5. Rules

- Only an admin can call any of this stage's actions. Anyone else gets the 404, signed out goes to sign-in, and a forged post changes nothing.
- The account is always taken from the session, never from the form. A role is read from a fixed list, so a forged role value is `staff-role-missing`.
- Giving a role never creates an account. Removing a role never deletes anything but the role and the shops' mentor links.
- An admin never removes their own admin role. Vossie never has no admin through this page.
- Show again acts only on something hidden that's still there. It never reopens a report or changes a listing's or request's own state (sold, paused, closed).
- The numbers never name, link or id anything counted. Private counts follow decision 13 everywhere they appear: the main tables, the campus view and the totals.
- No numbers page reads the clock while prerendering: it awaits `connection()` first (CLAUDE.md). Times are stored in UTC; the weeks are worked out in `Africa/Johannesburg`.

## 6. Privacy (POPIA)

- **Staff accounts:**
  - The page shows staff only: first name, email, campus and roles. No student without a role is listed, searched or suggested.
  - The audit log records who gave or removed which role and when. Deleting the account forgets the person in those entries (G 8.11).
  - The data export already includes `roles`.
- **Numbers:**
  - Counts only, with decision 13's rule for private measures, and saved searches left out (decision 10).
  - The privacy policy's "Who can see it" gains a sentence for Lama to review: "Hub admins see weekly counts for each campus (listings, shops, requests, enquiries, reports and follows), never who; small numbers are hidden so no one can be picked out."
  - The policy's staff-log sentence adds "and who was given or lost a staff role".
- **Show again:** it changes no personal information. It writes one log entry and sends one notification to the student whose listing or request it was.
- **No new cookie or browser-storage key,** so the privacy page's name test needs nothing new.

## 7. Accessibility

WCAG 2.2 AA, as G's section 4. In particular:
- Every table has a caption and header cells. The numbers tables use `scope="row"` on measure and campus names.
- "Under 5", "Hidden", "—" and "20+" are words, not symbols alone. The key under each numbers table says what each means.
- Every action names its target in visually hidden text ("Remove Naledi's mentor role", "Show Graphing calculator for MAT2 again").
- The Give a staff role form has the G error summary (`<prefix>-problems`) with links to its fields. The role radios sit in a `<fieldset>` with the legend "Role". The email field keeps what was typed after an error.
- Confirm pages repeat what will happen, and their buttons say the action: never "OK" or "Yes".
- Notices use `role="status"`, as the staff frame's do.
- Every target is at least 44px.
- Brand rules (CLAUDE.md):
  - The confirm buttons use G's existing `btn btn-danger`, never sky with text on white. Give role uses the staff pages' existing primary button.
  - Links on white are sky-dark.
  - The campus links in By campus are 44px tall rows on phones.
- Every flow works without the app's JavaScript.

## 8. Performance

- **No client code.** Every form posts to a Server Action, every view is server-rendered, and the campus view is a link.
- **Public pages don't move by a byte.**
  - The only shared code touched is server-only: `NotificationsView`, which gains one case using an icon it already imports, the account and privacy settings pages, and the staff frame's links.
  - At the last measure the listing forms were the highest pages at 152,265 B, 40 B under the 152,305 B stop line. Nothing this stage adds may load on a public page. The performance test runs as it is, and if any public figure changes, the build stops to find out why.
- **Staff pages stay at the shell's 150,591 B.** The performance test adds `/admin/staff`, `/admin/numbers` and `/admin/hidden`, signed in as the admin.
- **The numbers are worked out by looping over the store on each request.** That's fine for sample mode's few hundred rows. For the real backend:
  - **First:** a SQL view, `admin_weekly_counts(week_start, campus_slug, measure, count)`. It groups each table by `date_trunc('week', created_at at time zone 'Africa/Johannesburg')`, and the page reads it through an admin-only RPC. That's enough while Vossie is small, and needs no job.
  - **Then:** a scheduled roll-up into a `weekly_campus_counts` table, run at 00:15 SAST each Monday, once the view is slow or once Eduvos's retention periods start deleting old messages and reports. A roll-up keeps last year's counts after the rows behind them are gone. It's raw counts, readable by admins only. The small-number rule stays in the app, so it applies however the counts are made.

  Both are go-live items.

## 9. Testing

- **Unit:**
  - `giveRole`: an unknown email, a role already held, case and spaces in the email, and nothing else changing.
  - `removeRole`:
    - your own admin role refused;
    - the last admin refused, even when called by another id;
    - a mentor removal clearing every shop's `mentorId` and keeping notes, check-ins and posts.
  - Each action:
    - `requireStaff("admin")` first: a mentor gets the 404;
    - the one-time token: a repeat gives nothing and goes where the first went;
    - exactly one audit entry with the right action, kind, target, detail and subject;
    - the notification's kind, sentence and link;
    - "Nothing changed" with no entry and no notification.
  - Account deletion: forgets the person in role entries; the privacy settings view shows the staff line and the only-admin line only when they apply.
  - `sastWeeks`: the bounds at Sunday 21:59:59 and 22:00:00 UTC, on a Monday and a Sunday.
  - `countByWeek`, for each measure:
    - offers left out of enquiries;
    - a draft never published not counted;
    - a re-published listing counted once;
    - a sample shop counted at its `createdAt`;
    - a gone campus counted only in the total;
    - Open shops now matching Featured's test.
  - `protectCounts`:
    - 0 shown;
    - 1 to 4 as Under 5;
    - the second hidden cell, and the case where a gone campus holds the rest;
    - totals under 5;
    - Change shown as "—";
    - private Since the start in tens;
    - public measures exact.
  - Show again:
    - clears the hide, and is null when the thing has gone or isn't hidden;
    - reports stay closed with their outcome;
    - the seller or asker is told and reporters aren't;
    - the tag expires (`updateTag` mocked);
    - no `new-listing` or `search-match` notification;
    - the listing's photos are public again.
  - `audit-words`, `parseAuditFilter` with `kind=staff`, and `NotificationsView`'s `staff-role` icon.
- **End to end.** These tests write things other tests could see: a Tech corner listing hidden then shown, and a role on an account. So they run in a new project, `staff-accounts-writes`, at 1440px, after `alerts-writes`, rather than in `staff-writes` (which runs before `community-writes` and `alerts-writes` and would hide a listing under them). Role tests use fresh accounts, signed in once by a new address, and never change the sample staff.
  - Give a fresh account the mentor role by email. They see the notification and the Hub's tools on their account page. Remove it through the confirm page, and their `/mentor` answers 404.
  - The admin's own row has no Remove admin role. An unknown email gives the error, with focus on the summary and the typed email kept.
  - A student reports a Tech corner listing, the admin hides it, and it's gone from browse. It's listed on `/admin/hidden`. Show again through the confirm page, and it's back in browse and on its page. The seller's notification says so, and the report still reads closed.
  - The same for a fresh student's Looking For request: hidden, then shown again on the board.
  - `/admin/numbers` and a campus view render their captions and keys, and a student gets a 404 status.
  - **The status checks** move to `staff.spec.ts` (device projects, read only). For every staff page:
    - `page.request.get(path, { maxRedirects: 0 })` answers 404 for a student and a mentor on admin pages;
    - signed out, it answers 307 to `/login?next=…`.

    G's "Page not found" title checks stay.
- **Checks** (`tests/e2e/staff-accounts-checks.spec.ts`, in the same project):
  - axe on `/admin/staff` (with and without an error), both confirm pages, `/admin/hidden` (empty and with rows), `/admin/numbers` and a campus view;
  - layout shift on `/admin/numbers` and `/admin/staff` at 390 and 1440px;
  - the JS budget (section 8);
  - review screenshots in `docs/progress/staff-accounts/`, taken by `tests/e2e/staff-accounts-screenshots.spec.ts`.

## 10. Not in this stage

- Scheduled jobs: the numbers roll-up, the nightly badge job, and auto-closing requests (go-live).
- Email of any kind: no email to a person given a role, and none to staff.
- CSV or other exports of the numbers, staff or hidden lists. The mentor CSV stays the only export.
- Editing anyone else's profile: name, email or campus.
- Searching or listing student accounts, or giving a role to someone who has never signed in (an invitation).
- Campus-scoped roles, a separate "Hub staff" role, finer permissions, and numbers for mentors.
- Charts, trends beyond two weeks, view counts and analytics.
- Saved searches in the numbers (decision 10).
- Hiding a listing or request without a report, or hiding again from `/admin/hidden`.
- Stopping an admin from acting on their own shop (an open question).
- Anything that needs the real backend: the roll-up or view, a database guard for the last admin, and a way to give the first admin role outside the app.

## 11. Go-live items this stage adds

For `docs/reference/GO-LIVE.md`, when the stage is built:
- **Section 6:**
  - The numbers as a SQL view, then a weekly roll-up (section 8).
  - The last-admin rule in the database: a transaction, or a trigger that refuses removing the last `admin`.
  - A way to give the first admin role outside the app: a seed or a one-off script, never a page.
  - Tick "A true 404 status for staff pages" if decision 15's spike holds.
- **Section 7:**
  - Tick "Showing a hidden listing again".
  - Add "Should an admin be able to act on their own shop?" (approve, verify, pin).
- **Section 6, Content:** "the real staff accounts" becomes "give the real staff their roles in `/admin/staff` (stage J)".

## 12. Changes on plan review and build

Where this section differs from the sections above, this section wins.

1. **Decision 13's rules 1 to 4 are replaced (plan amendment 1).** The drafted rule leaked: a brute-force check of the "audit" version found 765 cases where a hidden figure could be pinned exactly, because choosing what to hide from the hidden values makes the pattern of hidden cells give values away ("total Hidden, one Under 5" can only be 4). The decision to hide must depend only on something the reader can already see:
   - **A private week column with any small number shows no campus breakdown.** If any campus, or the count on a campus that has gone, is from 1 to 4 that week, every campus in that column shows "Hidden", zeros included. Otherwise every campus shows exactly. The total always shows: exact, "Under 5" from 1 to 4, and 0 as 0.
   - **Change** is "—" unless both figures are exact.
   - **Since the start** shows in tens. Campus figures show only when both week columns are shown by campus and no campus (or gone) is from 1 to 9 since the start; otherwise every campus shows "Hidden". The total shows in tens, unless either week's total is "Under 5"; then it shows "Hidden".
   - **Public measures and open shops** stay exact.

   *For Lama.* The page shows every all-campus total, so Vossie-wide figures are always there. A campus breakdown of something private shows only when no campus had between 1 and 4 that week; if one did, the whole column is hidden, zeros too. Hiding only the small cell isn't enough: the total less the cells you can see gives it back, and choosing which extra cells to hide gives clues of its own. Since-the-start figures are in tens, and shown by campus only under the same condition, so two weeks' pages can't be subtracted. No figure from 1 to 4 can be worked out from the page, from two weeks' pages, or from the rule itself. The cost: while campuses are small, the private columns in By campus and the campus view will often say Hidden (totals are unaffected). An "Other campuses" row that groups small campuses is a possible later improvement. Two residuals: deletions change past weeks' figures between page loads (two loads can show that something was deleted, never a small activity count), and the rule assumes a reader may know the gone figure. This replaces plan decision 14's residual, so the hand-over and the go-live list no longer carry it.
2. **Task 1's spike failed (plan Task 1).** With `export const instant = false` and the gate at the top level, `/admin` and `/admin/sellers/[slug]` built, and no public route's line in the build output changed, but every request still answered 200: the response carries `x-nextjs-prerender: 1` and `x-nextjs-postponed: 1`, because the root layout's streaming shell (its `<Suspense>` round the header's account link and the menu's account links) is sent before the page's role check runs. A real status needs the root layout changed, which another session has uncommitted edits to. So decision 15 does not hold: staff pages keep stage G's pattern (status 200 with the 404 view and `noindex`, a client-side redirect to sign-in), the status checks in `staff.spec.ts` skip (`STAFF_404_IS_REAL = false`), and the go-live item for a status from the proxy or the real backend stays open.
3. **Open shops now doesn't need Verified (plan decision 12),** unlike Featured's test: it is approved, unpaused shops with at least one listed listing.
4. **Only Tech corner is seeded with `approvedAt`;** Lerato's waiting shop has none (plan decision 4). `approveShop` takes `now`, and the shop export carries `approvedAt`.
5. **`getStaffAccount`, `getHidden` and `countHidden` join the data functions;** `showRequest` takes `now` (plan decisions 5 and 16).
6. **The policy's "Who can see it" is its "Who it is shared with" section (plan decision 20).**
7. **The unknown email's focus is checked without the app's JavaScript (plan decision 21),** because only a page load focuses the error summary.
8. **The role actions expire no tag (plan decision 8):** nothing cached reads roles.
9. **No new CSS in `app/globals.css`;** utilities on the new row headers and campus links (plan decision 3).
10. **Page titles (plan amendment 13).** `/admin/hidden`'s title is "Hidden listings and requests", through `staffMetadata("admin", "Hidden listings and requests")`, so the tab matches the H1.
11. **The short skeleton.** `StaffSkeleton` takes `short` (no body block) on the four confirm pages: a role's removal, the admin's own-role refusal, and the two Show again pages. The full skeleton shifted a short phone's confirm page when it arrived (Show again at 375x667: 0.0892 to 0.0437; the own-admin refusal 0.0437). One entry on the footer's list items remains, under the 0.05 limit but close.
12. **Show again's link name (plan amendment 12).** Show again's link is named by `aria-label` "Show again: {title}", so its name starts with its visible words (WCAG 2.5.3) with no stray space; the role links read "Remove mentor role for Naledi".
13. **"Your admin role".** The admin's own-role refusal page is headed "Your admin role", not "Remove {name}'s admin role", since nothing is being removed.
14. **The numbers' intro** says small private numbers show as "Under 5" or "Hidden".
