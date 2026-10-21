# Vossie follow-ups: design spec

- **Date:** 2026-10-21
- **Status:** Built (2026-10-21), in sample mode.
- **Scope:** stage M. Three small follow-ups from stage L's open points (PROGRESS, "Open points for Lama after the housekeeping build"), each built with the safe default and refined against the code at HEAD `5c5fcef`:
  1. **An admin can't remove the mentor role from whoever mentors the admin's own shop** (open point 8; stage L spec section 11, amendment 8).
  2. **Featured's resting order: least recently featured first** (open point 5; stage L spec decision 20 and question 5).
  3. **One reminder before a request closes itself** (open point 6; stage L spec section 7 and question 6).

  None was dropped: each premise holds in the code (sections 2 to 5 say where). It builds on stages G (Featured, mentors), H (requests), J (roles) and L (the own-shop gate, `settleRequests`). It needs none of the header session's files (`app/globals.css`, `components/header/*`, `components/tabbar/*`, `tests/e2e/{listing,responsive,a11y}.spec.ts`): every new line reuses an existing class, the reminder reuses an existing notification kind (so `components/messages/NotificationsView.tsx` and the header's count are untouched), and `countNewNotifications` keeps its signature.

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-20-housekeeping-design.md` | Stage L: the own-shop gate (decisions 1 to 7), requests that close themselves (8 to 16), Featured assessed (20); section 11's amendments |
| `docs/superpowers/specs/2026-10-20-staff-accounts-and-numbers-design.md` | Stage J: roles given and removed (decisions 3 to 7), the confirm pages |
| `docs/superpowers/specs/2026-10-14-staff-tools-design.md` | Stage G: Featured (2.8), mentors (2.6) |
| `docs/superpowers/plans/2026-10-14-staff-tools.md` | Amendment 3 (the week's break is a preference), amendment 15.3 (a shop's owner is never its mentor) |
| `docs/superpowers/specs/2026-10-14-community-actions-design.md` | Stage H: requests, Edit, Close and Reopen (2.6), notifications |
| `docs/reference/GO-LIVE.md` | Sections 6 and 7, changed in section 8 below |

---

## 1. Goal

- Choosing who mentors your own shop is another admin's decision, by every route, not only the shop's mentor field.
- When Featured has to bring back a seller who featured recently, it brings back the one who waited longest.
- An asker hears once, two days ahead, that their request is about to close itself, while there's still time to keep it.

No public page gains a byte of JavaScript. Every page stays at `16dab6a`'s figures to the byte: `/` 150,660 B, and the new and edit listing forms 152,334 B (past the stop line under decision 78, so nothing may move).

## 2. Decisions

### Item 1: removing the mentor role of your own shop's mentor

1. **The gap is real.** `removeRole` (`lib/data/staff-accounts.ts`) sets `mentorId` to null on every seller profile the person mentors, the admin's own included. That is the effect of `assignMentor(own shop, no mentor)`, which stage L refuses (`isOwnShop` then `refuseOwn`). So an admin who sells can, today, take away their own shop's mentor by removing that mentor's role.
2. **The rule: an admin can't remove the mentor role from the person who mentors the admin's own shop.** "Mentors the admin's own shop" means, read from the store at the moment of the action, never from a form field: the acting admin's seller profile (`sellerProfiles.get(adminId)`, one per account) has `mentorId === personId`. The check reads the profile, not the live shop, so a paused shop or one sent back to waiting is covered too. A shop that has no owner (a sample) is nobody's, as in stage L decision 2.
   - **Why refuse rather than note:** stage L's one rule is "no Hub decision about your own shop". Leaving the shop without a mentor is one, and a rule with a side door is harder to trust than one with none. The cost is small: the role is removed by another admin, or the mentor leaves by deleting their own account (decision 4).
3. **Removing the admin role is unaffected.** The mentor dropdown and `setShopMentor` accept only holders of the mentor role, so a mentor link never hangs on the admin role: removing someone's admin role leaves every shop's mentor as it was. Removing your own admin role is already refused (stage J). Nothing about the acting admin's shop changes, so there's nothing to gate.
4. **Left alone, and why:**
   - **The mentor deleting their own account** (`lib/data/staff-privacy.ts` clears their `mentorId`s). It's the mentor's choice about themselves, not an admin's decision, and POPIA's deletion path must never be blocked.
   - **Removing the mentor role from someone who mentors other shops but not yours:** unchanged, as stage J built it.
   - **Giving roles:** giving the mentor role changes no shop.
5. **The gate is in the data write, and the action lands on the staff page with a notice.**
   - `removeRole(accountId, role, byId)` gains one more refusal, `"own-shop-mentor"`, checked after "no such role" and before anything is written, in the same synchronous pass as its `own-admin` and `last-admin` checks. Putting it there (rather than in the action, as stage L's `isOwnShop` gates are) keeps the file's promise that "nothing here awaits between a check and its write".
   - `removeStaffRole` maps it, as stage L's `refuseOwn` does, to a notice on the page that shows staff notices: `leaveNotice("own-shop-mentor")`, then `done(ADMIN_STAFF_PATH)`. The confirm page shows no notices (stage L amendment 4), and it already says why (decision 6), so a form error there would only repeat it.
   - **A refusal writes nothing:** no role or profile change, no audit entry, no notification, no form state cleared, no tag expired (none is expired by role changes anyway, stage J plan decision 8). The notice is the only write, as for every stage L refusal.
6. **The views say why, in one line, instead of offering the control** (stage L decision 4, and stage J's own admin role):
   - **`/admin/staff`:** in the row of the person who mentors the viewer's shop, "Mentors your shop." stands where "Remove mentor role" was, as "This is you." stands for the viewer's own admin role. Their other role's link, if they're also an admin, stays.
   - **`/admin/staff/{id}/remove-mentor`:** the line, the only-admin sentence when it applies, and "Back to staff accounts", with no button. The page's title becomes "{Name}'s mentor role", as your own admin role's page is "Your admin role", since the page refuses rather than asks.
   - No disabled controls.
7. **The audit log is unchanged.** No new action kind, no new words in `lib/staff/audit-words.ts`.

### Item 2: Featured's resting order

8. **The gap is real, and worth a few lines.** `drawFeatured` (`lib/featured.ts`) orders the resting sellers by the same day's rotation as everyone else (`inOrder(rested)`), so when the row must dip into them it can bring back a seller shown yesterday ahead of one shown five days ago. With nine Verified sellers for four places, that happens most days. Ordering by who waited longest spreads the four places more evenly over the week, which is what the break is for. It's server-only and changes nothing a buyer is told.
9. **The order, exactly.** Pins first, then the sellers not resting, as today. Then the resting sellers:
   1. **The campus's own first**, then other campuses', as everywhere else in the draw (the trust page: "its sellers come first"). For "all" there's one group.
   2. **Within each group, least recently featured first:** by the latest SAST day, within the last `REST_DAYS` (6), that the seller was in this campus's recorded row, oldest first.
   3. **Ties (the same latest day): the day's rotation**, as today. `Array.prototype.sort` is stable, so sorting the rotated group by its last day keeps the rotation among equals.

   It reads no clock: the days come from the recorded rows and the `day` argument, so it stays a pure, testable function.
10. **The campus comes before the waiting.** Putting least-recent first across campuses would let another campus's seller beat the campus's own, which the trust page promises the other way round. Within a campus's own sellers, the longest wait wins. Question 2 asks.
11. **Shape:** `FeaturedOptions.resting` changes from a `ReadonlySet<string>` to a `ReadonlyMap<string, string>`: slug to the latest day (YYYY-MM-DD) the seller was shown in this campus's row within the break. A seller in the map is resting, as before. `featuredFor` (`lib/data/featured.ts`) builds it by walking back from yesterday (`back` 1 to 6) and keeping the first day it meets for each slug, which is the latest. A pinned day counts as a featured day, as it does today (pins are in the recorded row).
12. **The trust page gains one clause** (decision 15's words). It's already true that resting sellers come after everyone else; the clause says which of them come back first, so the promise is exact. Static HTML on `/trust`, no script.

### Item 3: one reminder before a request closes itself

13. **One in-app notification, from two days before the closing day.**
    - The **closing day** is stage L's `closingDay(row)`: the first SAST day a request counts as closed. Its last open day is the day before.
    - The **reminder day** is two days before the closing day (`addDays(closingDay, -REMINDER_DAYS_BEFORE)`, with `REMINDER_DAYS_BEFORE = 2` in `lib/looking-for/rules.ts`). So the asker has two whole open days to act. Needed by Friday 16 October: closing day Tuesday 20, reminder from Sunday 18. Posted 13 October with no date: closing day 12 November, reminder from 10 November.
    - A request is **due a reminder** on `today` when it's open, not hidden, has an asker (so a closing day), `reminderDay <= today < closingDay`, and it hasn't been reminded for this closing day (decision 15).
    - **Why 2:** one day can fall on a day the asker doesn't open Vossie; more than two days reads as nagging about a request that's still well up. It's one number to change.
14. **Sent in the same settle pass, from request-time code only.** There are no scheduled jobs in sample mode. `settleRequests(now)` already runs from request-time code on most visits (the board, the homepage, the request page's session part, the composer, the asker's reads, every Looking For and request staff action, the data download), never inside `"use cache"`. It gains a second check in its one synchronous loop:
    - a row whose closing day has come is closed, as today, and gets **no** reminder (its close notification says it all);
    - a row due a reminder is marked (`remindedFor = closingDay`) in the same loop, before any `await`;
    - after the loop, the close notifications and then the reminders are sent.

    So two renders at once can't remind twice. `settleRequests` still returns how many it **closed**: a reminder changes no cached data (the board, the homepage and the sitemap don't show it), so a Server Action calls `requestsChanged()` only when something closed, as today.
15. **At most once per request per closing day.** `RequestRow` gains `remindedFor: string | null`, the closing day (SAST date) the reminder was sent for. A row isn't due when `remindedFor === closingDay(row)`.
    - **An edit or reopen that moves the closing day allows a new one,** with no extra code: the new closing day no longer matches `remindedFor`. An edit that keeps the same closing day (a needed-by request whose date wasn't changed) doesn't.
    - Nothing clears the field: Close, Reopen, Edit, Hide and Show again leave it alone. Moving the day and moving it back to a day already reminded for sends nothing the second time, which is right: the asker was told about that day.
    - Seeds and new rows start at `null`. `STORE_VERSION` 13 to 14.
16. **Skipped:** the 16 samples (no asker, so no closing day, stage L decision 9), hidden requests (as stage L decision 16: the asker can't act on them; once shown again, the rule applies at the next look), and closed ones (status not open).
17. **The kind: reuse `request-update`.** It's the kind of every word about your own request (the Hub's hide and show again, the close). Reusing it means:
    - no icon, no new case in `NotificationsView` (a component the notifications page and its tests own), and no type change for the header's count;
    - deleting the request deletes the reminder too: `deleteRequest` already calls `deleteNotificationsAbout("request-update", {id})`;
    - deleting the account deletes it with the account's notifications, as today.
18. **It links to Your requests (`/account/requests`), not the edit page.**
    - Your requests shows "Closes automatically on {date}." and offers both answers: Edit (keep it) and Close or Delete (done with it).
    - The link stays good whatever happens next: if the request closes, is hidden or is deleted before the asker clicks, the edit page would be a dead end or a 404, and Your requests isn't.
    - It matches the close notification's link.
19. **The old reminder stays when the date moves.** Its words name the day it was sent for, and Your requests always shows the current one. Rewriting or removing a read notification is more than this needs (section 6).
20. **Privacy: in-app only.** No email, no push (decision 57 stands). Nothing new is collected: `remindedFor` is a date about the request, kept with it and deleted with it, and not in the data download (the reminder itself is, among the notifications).
21. **The real backend: the nightly job sends it.** The closing job (GO-LIVE section 6, 00:05 SAST) also sends reminders, with the same rule: open, not hidden, an asker, `reminder_day <= today < closing_day`, and `reminded_for is distinct from closing_day`, marked in the same transaction. Using `<=` rather than `=` lets a missed night catch up.

---

## 3. Item 1: your own shop's mentor

### Behaviour

- **Sipho, an admin who owns Tech corner, which Naledi mentors:**
  - `/admin/staff`: Naledi's row shows "Mentors your shop." in place of "Remove mentor role".
  - `/admin/staff/{naledi}/remove-mentor`: titled "Naledi's mentor role", with the line and "Back to staff accounts", and no button.
  - A forged or stale post of the remove form lands on `/admin/staff` with the `own-shop-mentor` notice. Naledi keeps the role, and Tech corner keeps Naledi.
  - If Sipho is the only admin, the confirm page adds the only-admin sentence.
- **Pieter, another admin:** sees "Remove mentor role" on Naledi's row and the confirm page as today, and removing it un-assigns Tech corner as today.
- **Removing Naledi's or anyone's admin role:** unchanged (decision 3).

### Data and code

- `lib/data/staff-accounts.ts`:
  - `ownShopMentorId(ownerId: string): string | null`, synchronous: `sampleStore().sellerProfiles.get(ownerId)?.mentorId ?? null`;
  - `removeRole` returns `"own-shop-mentor"` when `role === "mentor" && ownShopMentorId(byId) === accountId`, after the "no such role" check and before any write.
- `lib/staff/account-actions.ts`: `removeStaffRole` handles `"own-shop-mentor"` before the `!removed` check: `leaveNotice("own-shop-mentor", now)`, `done(ADMIN_STAFF_PATH)`.
- `lib/staff/notices.ts`: the `own-shop-mentor` code.
- `components/staff/AdminStaff.tsx`: `AdminStaffProps` gains `ownShopMentorId: string | null`; `RowActions` shows the line for that person's mentor role.
- `components/staff/StaffRoleConfirm.tsx`: props gain `mentorsOwnShop: boolean` and `onlyAdmin: boolean`; when `role === "mentor" && mentorsOwnShop`, it renders the line in `staff-confirm`, as the own-admin branch does. `roleConfirmTitle` takes the same flag.
- `app/admin/staff/page.tsx`: passes `ownShopMentorId(account.id)`.
- `app/admin/staff/[id]/remove-mentor/page.tsx`: passes `mentorsOwnShop` (`ownShopMentorId(account.id) === id`) and `onlyAdmin` (`countAdmins() === 1`), and uses `roleConfirmTitle` for its title.
- No new row, field, cookie or table.

### Rules

- Mentoring is read from the store in the write, never from a hidden field.
- The check runs after `requireStaff`, so someone without the role still gets the 404.
- Server Components only. No `"use client"`.

### Words

Samples for Lama to change:

| Where | Words |
|---|---|
| `/admin/staff`, the mentor's row | "Mentors your shop." |
| Remove-mentor page, title | "{Name}'s mentor role" |
| Remove-mentor page, the line | "{Name} mentors your own shop, so another admin must remove this role: it would leave your shop without a mentor." |
| The same, when the viewer is the only admin | Adds: "You're the only admin. Give someone else the Admin role first." (The page's "Back to staff accounts" link is the way there, so no second link.) |
| Notice `own-shop-mentor` | "Nothing changed. They mentor your own shop, so another admin must remove their mentor role." |

### Privacy (POPIA)

- Nothing new is collected or kept. Who mentors a shop is already on the admin's own shop page (stage L shows it as text).
- The mentor's own deletion path is untouched (decision 4).

### Accessibility

- The line is a paragraph where the button was, in the existing `staff-confirm-lead` style, so a screen reader user meets the reason where they'd look for the control.
- "Mentors your shop." uses `staff-muted`, as "This is you." does.
- The notice uses the existing staff notice region (`role="status"`).
- No disabled controls.

### Performance

- Server only. Staff pages have no client components, and no public page changes.
- One map lookup per staff page and per removal.

### Tests

- **Unit:**
  - `lib/data/staff-accounts.test.ts`:
    - `ownShopMentorId` for an owner with a mentor, with none, and an account with no shop;
    - `removeRole(naledi, "mentor", sipho)` returns `"own-shop-mentor"`, and Naledi's roles and Tech corner's `mentorId` are unchanged (checked against a copy taken before);
    - `removeRole(naledi, "mentor", pieter)` still removes it and lists Tech corner in `unassigned`;
    - `removeRole(naledi, "admin", sipho)` when she holds both roles is unaffected (decision 3).
  - `lib/staff/account-actions.test.ts`: the refused post leaves the `own-shop-mentor` notice and ends with `done("/admin/staff")`; no audit entry, no notification, the form state not cleared. A second admin's post still works.
  - `lib/staff/notices.test.ts`: the new code has words.
- **Component:**
  - `StaffRoleConfirm`: with `mentorsOwnShop`, no form or button, the line's words, the only-admin sentence only when `onlyAdmin`; `roleConfirmTitle` for the case.
  - `AdminStaff`: "Mentors your shop." in that row, and no remove-mentor link for that person; another person's link stays.
- **End to end:** one more test in `tests/e2e/housekeeping-writes.spec.ts` (the `housekeeping-writes` project already runs last, so `playwright.config.ts` doesn't change), using its helpers that give Sipho the Admin role and always take it away again in a `finally`:
  - Sipho's `/admin/staff` shows "Mentors your shop." in Naledi's row;
  - the remove-mentor page shows the line and no button;
  - a forged post (the form's fields through `page.request`) lands on `/admin/staff` with the notice;
  - Pieter's `/admin/sellers/tech-corner` still names Naledi as the mentor;
  - axe finds no serious or critical issues on Sipho's confirm page at 390 and 1440px.

## 4. Item 2: Featured's resting order

### Behaviour

Nothing changes on a day with enough sellers who aren't resting. On a day when the row must bring back resting sellers, the ones who waited longest come back first, the campus's own still ahead of others'. The row is still recorded on its first view of the day and stays the same all day.

### Data and code

- `lib/featured.ts`: `FeaturedOptions.resting` becomes `ReadonlyMap<string, string>` (decision 11). The resting part of the draw becomes, per campus group, the rotated group sorted stably by its last day, oldest first.
- `lib/data/featured.ts`: `featuredFor` builds the map, latest day per slug.
- `app/trust/page.tsx`: the clause below.
- No store change: the recorded rows (`featuredDraws`) already hold the days, and are kept for 7.

### Rules

- Pure and deterministic: same sellers, campus, day, pins and map give the same row.
- No clock read: days come from the stored rows and the caller's SAST `day`.

### Words

| Where | Words |
|---|---|
| `/trust`, "How Featured today is picked", the break | "A seller who has been featured sits out for a week when there are enough other Verified sellers to fill the row. When there aren't, the sellers featured longest ago come back first." |

### Privacy, accessibility and performance

- No personal data: the draw is about shops.
- `/trust` gains one sentence of static text, no script, no change to its structure or headings.
- One extra sort of at most a handful of sellers per campus per day, on the first view only.

### Tests

- **Unit, `lib/featured.test.ts`:**
  - with `"all"` and resting `{a: day−1, b: day−5, c: day−3}`, the resting part is b, c, a, after the sellers not resting;
  - two resting sellers with the same last day keep the rotation's order (checked on two days that rotate them differently);
  - with a campus, a campus seller resting since yesterday still comes before another campus's seller resting for five days (decision 10);
  - a pin still ignores the break;
  - the existing tests pass with their `Set`s turned into maps.
- **Unit, `lib/data/featured.test.ts`:**
  - a seller shown on days −5 and −1 rests with day −1;
  - the nine-seller walk on `"all"` (one campus group): day 3's three resting places are filled from day 1's row, not day 2's;
  - pins count as featured days.
- **Unit, `app/trust/page.test.tsx`:** the clause is there.

## 5. Item 3: the reminder

### Behaviour

- From the reminder day, the first request-time look (the board, the homepage, the asker's own pages, any Looking For action) sends the asker one notification, linking to Your requests.
- Your requests already shows "Closes automatically on {date}." The asker can Edit (which, with no needed-by date, starts a fresh 30 days, and with one, lets them set a later date), Close or Delete.
- If nothing request-time looks between the reminder day and the closing day, no reminder is sent and the request closes as in stage L. In practice the board and homepage settle within moments of SAST midnight.
- A request that reaches its closing day before a reminder was sent closes with one notification, the close.

### Data and code

- `lib/data/rows.ts`: `RequestRow.remindedFor: string | null`. `data/fixtures/request-rows.ts`: `remindedFor: null`. `lib/data/requests.ts`'s `createRequest`: `remindedFor: null`. `lib/data/store.ts`: `STORE_VERSION` 14, with its line in the comment: "14: a Looking For request remembers the closing day its reminder was sent for (`remindedFor`, stage M spec decision 15)."
- `lib/looking-for/rules.ts`:
  - `REMINDER_DAYS_BEFORE = 2`;
  - `reminderDay(closesOn: string): string`;
  - `reminderDue(row, today): boolean` (decision 13), a pure function of the row and the date.
- `lib/looking-for/words.ts`: `requestCloseReminderText(title, closesOn, reason)`.
- `lib/data/requests.ts`: `settleRequests` (decision 14). Its doc comment names the reminder. The return value stays the count closed.
- `app/privacy/page.tsx` and `app/how-it-works/page.tsx`: the words below.
- No new notification kind, no change to `NotificationsView`, the header or the tab bar.

### Rules

- No clock read while prerendering, and no write inside `"use cache"`: the reminder lives in `settleRequests`, which only request-time code calls.
- One synchronous marking pass before any `await`.
- A refused request action still settles nothing (stage L amendment 4): the settle stays after the gates.
- The asker stays unnamed: the reminder goes to their account only.

### Words

Samples for Lama to change, in `lib/looking-for/words.ts` and the info pages. Dates are `dayMonth(closesOn)`, as Your requests writes them.

| Where | Words |
|---|---|
| Reminder, needed-by | "Your request {title} closes automatically on {20 Oct}, 3 days after the date you needed it by. Still need it? Give it a new date in Your requests." |
| Reminder, 30 days | "Your request {title} closes automatically on {12 Nov}, after 30 days with no changes. Still need it? Edit it in Your requests and it stays up for 30 days more." |
| How it works, Looking For | "Requests close automatically 3 days after their needed-by date, or after 30 days with no changes. You're reminded 2 days before, and you can reopen one." |
| Privacy policy, notifications | "your request closes automatically" becomes "your request is about to close automatically, or does". |
| Privacy policy, Your Looking For requests | "you're told, and you can reopen it" becomes "you're reminded 2 days before and told when it does, and you can reopen it". |

The numbers in the words come from `NEEDED_BY_GRACE_DAYS`, `IDLE_CLOSE_DAYS` and `REMINDER_DAYS_BEFORE`, as stage L's do.

### Privacy (POPIA)

- In-app only (decision 20). Nothing new is collected; `remindedFor` is deleted with the request, and the reminder with the request or the account.
- The privacy policy's list of notifications names it.

### Accessibility

- A notification row like every other, with the existing kind's icon and text. No new controls or styles.

### Performance

- **No JavaScript:** nothing client-side changes. `/how-it-works` and `/privacy` gain a few words of static text.
- **Server:** one more comparison per open row in the settle loop (tens of rows in sample mode).
- No tag is expired for a reminder, so no cache entry turns over because of one.

### Tests

- **Unit, `lib/looking-for/rules.test.ts`:**
  - `reminderDay("2026-10-20")` is `"2026-10-18"`; across a year (`"2027-01-01"` gives `"2026-12-30"`);
  - `reminderDue` is false on closing day − 3, true on − 2 and − 1, false on the closing day; false when `remindedFor` is the closing day, true when it's an older one; false for a seed, a hidden row and a closed row.
- **Unit, `lib/data/requests.test.ts`:**
  - on the reminder day, `settleRequests` sends one `request-update` notification to the asker, with each reason's words and `/account/requests`, sets `remindedFor`, and returns 0; a second call sends none;
  - the SAST edge: at `21:59:59Z` on the day before the reminder day (23:59:59 SAST), nothing; at `22:00:00Z`, one;
  - an edit that moves the closing day, then the new reminder day: a second reminder; an edit that doesn't move it: none;
  - a reopen whose new closing day has its own reminder day: a new one;
  - on the closing day with no reminder sent: the close notification only;
  - seeds, hidden and closed rows: none;
  - two calls started together (`Promise.all`) send one;
  - `deleteRequest` removes the reminder with the other `request-update` notifications.
- **Unit, `lib/looking-for/actions.test.ts`:** an action whose settle only reminded doesn't call `requestsChanged()`.
- **Unit, `lib/data/store.test.ts`:** seeded rows have `remindedFor: null` (and `STORE_VERSION` is 14, if a test pins it).
- **End to end:** none. Time can't be moved in a built server, as stage L found for the close itself; stage L's Your requests test already covers the date the asker sees.
- **The privacy page test** still passes: no new cookie or storage key.

## 6. Files (summary)

| File | Change |
|---|---|
| `lib/data/staff-accounts.ts`, `lib/staff/account-actions.ts`, `lib/staff/notices.ts` | `ownShopMentorId`, the refusal, the notice (item 1) |
| `components/staff/AdminStaff.tsx`, `StaffRoleConfirm.tsx`, `app/admin/staff/page.tsx`, `app/admin/staff/[id]/remove-mentor/page.tsx` | The line in place of the control (item 1) |
| `lib/featured.ts`, `lib/data/featured.ts`, `app/trust/page.tsx` | The resting order, its words (item 2) |
| `lib/looking-for/rules.ts`, `words.ts`, `lib/data/requests.ts`, `rows.ts`, `store.ts`, `data/fixtures/request-rows.ts` | The reminder, `remindedFor`, `STORE_VERSION` 14 (item 3) |
| `app/privacy/page.tsx`, `app/how-it-works/page.tsx` | Words (item 3) |
| `tests/e2e/housekeeping-writes.spec.ts` | One more test (item 1) |
| `CLAUDE.md` | Once built, the stage L requests line gains: "`settleRequests` also sends one reminder 2 days before the closing day (`remindedFor`)" |

None is in the header session's set. If the Supabase worktree has moved `lib/data/store.ts`'s version past 13 by build time, the reminder takes the next number (as stage L's did, its plan decision 22).

## 7. Not in this stage

- **Email or push reminders.** In-app only until there's a consented channel (decision 57).
- **A "Keep it open" button in the notification.** Notifications are links; a one-press keep would be a new action and a new form. Edit does it.
- **Rewriting or removing an old reminder when the date moves** (decision 19).
- **Reminders from the header's notification count.** As stage L decision 11: it needs the header's files and a clock read there.
- **Refusing the mentor's own account deletion** while they mentor an admin's shop. Never: it's their POPIA right (decision 4).
- **Least-recently-featured across campuses** (decision 10). Question 2.
- **A strict week's break.** Still a preference (stage L decision 20).
- **Any scheduled job.** The real backend's.

## 8. Go-live changes

For `docs/reference/GO-LIVE.md`, when the stage is built:

- **Section 6, Backend, the scheduled jobs line:** "closing old Looking For requests and telling their askers" becomes "reminding askers 2 days before a request closes itself, then closing it and telling them (stages L and M settle both when something looks; the job runs the same rules nightly at 00:05 SAST, reminding where `reminder_day <= today < closing_day` and `reminded_for` isn't the closing day, so a missed night catches up)".
- **Section 6, Backend, the `requests.closed_by` line:** add "`requests.reminded_for` (date), set in the job's transaction (stage M)".
- **Section 6, Backend, re-check the actor's role inside the transaction:** add "and that removing a mentor role doesn't take the acting admin's own shop's mentor (stage M)", for the Supabase role-removal function.
- **Section 7:** tick "Featured with few Verified sellers", with "the break stays a preference; resting sellers come back least recently featured first, the campus's own still first (stage M). Decided by Claude under decision 54; Lama may revisit." The draw function on the real backend takes the same map of last days from `featured_draws`.

## 9. Order

1. Item 1 (the mentor role): no data change, its own end-to-end test.
2. Item 2 (Featured): pure function and its caller, the trust page clause.
3. Item 3 (the reminder): `STORE_VERSION`, the rule, settle, words.
4. Docs: GO-LIVE, CLAUDE.md, PROGRESS, the decisions log's next row (81).

The plan checks `pnpm build` and `tests/e2e/performance.spec.ts` after items 2 and 3. Every page's first-visit JavaScript must equal `16dab6a`'s to the byte (`/` 150,660 B, the listing forms 152,334 B). Any change stops the build to find out why.

## 10. Open questions for Lama

1. **The mentor role:** refused (decision 2) rather than only noted in the log. If you'd rather allow it, the one-line alternative is to keep the removal and add the admin's own shop to the audit entry's detail.
2. **Featured's precedence:** the campus's own sellers stay ahead of the longest wait (decision 10). Flip it if fairness across campuses matters more than the campus-first promise.
3. **The reminder's 2 days** (`REMINDER_DAYS_BEFORE`), and whether it should link to the request's edit page instead of Your requests (decision 18).
4. **"Closes automatically on {date}"** names the first closed day, as stage L's lines do. If askers read it as the last open day, all the lines (Your requests, the asker's panel, the reminder) could say "Open until {the day before}" instead.
5. **The sample words** in sections 3, 4 and 5.

## 11. Changes on plan review and build

1. `StaffRoleConfirm`'s `mentorsOwnShop` and `onlyAdmin` and `roleConfirmTitle`'s flag are optional, defaulting to false; `AdminStaff`'s `ownShopMentorId` is required, so `components/forms/summary-ids.test.tsx` passes it (plan decision 2).
2. The refusal is inline in `removeStaffRole`, and the confirm page's form state is neither written nor cleared (plan decision 3). The "confirm page shows no notices" rule is stage L plan decision 5 (decision 5 here cites stage L amendment 4, which is about settling after the gate).
3. Only the remove-mentor page's heading becomes "{Name}'s mentor role"; the tab title stays "Remove a role" (plan decision 5).
4. The trust page's existing test, which pins item 4's whole text, takes the new text. `AdminFeatured`'s copy of the old sentence, left alone in the plan (plan decision 7), was changed in review (`488c878`): the admin Featured page now says the sellers featured longest ago come back first, as the trust page does.
5. The latest-day Featured test seeds the recorded rows (plan decision 8).
6. The seeds' `remindedFor` is tested in `data/fixtures/request-rows.test.ts`, and no test pins `STORE_VERSION` (plan decision 10); the info pages write "2 days" as a literal, as stage L's sentences do (plan decision 11).
7. `playwright.config.ts` is unchanged, but `housekeeping-writes.spec.ts` runs its tests one at a time (`mode: "default"`), because `fullyParallel` is on and two of its tests give Sipho the Admin role (plan decision 13).
8. One build and size check after all three items instead of two (plan decision 15).
9. Section 10's questions stay open for Lama: the build used the spec's choices.
10. Review (`488c878`): the remove-mentor page's two inline reads became `removeMentorView(viewerId, personId)`, unit tested with mutation checks on both reads; a test shows a closing day moved away and back to one already reminded for sends nothing the second time (decision 15); the `requests.ts` header comment was re-wrapped.
