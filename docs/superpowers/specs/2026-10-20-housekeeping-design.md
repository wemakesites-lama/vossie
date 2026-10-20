# Vossie housekeeping: design spec

- **Date:** 2026-10-20
- **Status:** Draft (2026-10-20), decided by Claude under Lama's standing goal (decision 54); Lama may revisit.
- **Scope:** stage L. The go-live checklist's (`docs/reference/GO-LIVE.md`) items that sample mode can build, refined against the code:
  1. **An admin can't act on their own shop** (section 7, "Should an admin be able to act on their own shop?"; stage J spec section 10; PROGRESS's stage J open point 1).
  2. **Old Looking For requests close themselves** (section 6, Backend, the scheduled jobs line; PROGRESS's stage H open point "Nothing closes a request on its own").
  3. **Sales confirmed automatically after 7 days.** Dropped: stage E built it (decision 17).
  4. **Trust badges recalculated.** Nothing to build in sample mode (decision 18).
  5. **The sitemap leaves out closed requests and past Hub events** (section 6, Production).
  6. **Featured with few Verified sellers** (section 7). Assessed; no change (decision 20).

  It builds on stages E (the 7-day settle, notifications), G (the admin's actions, mentors' notes, Featured), H (requests, Close and Reopen, offers) and J (roles, Show again). It needs none of the header session's files (`app/globals.css`, `components/header/*`, `components/tabbar/*`, `tests/e2e/{listing,responsive,a11y}.spec.ts`): every new line reuses an existing class, and `countNewNotifications`, which the header and tab bar call, keeps its signature. Its tests go in new spec files.

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-14-staff-tools-design.md` | Stage G: the admin's actions (2.3), mentors (2.6), Featured (2.8) |
| `docs/superpowers/plans/2026-10-14-staff-tools.md` | Amendment 15.3: a shop's owner can't be its mentor, "nobody reads notes about their own shop" |
| `docs/superpowers/specs/2026-10-20-staff-accounts-and-numbers-design.md` | Stage J: roles, Show again; section 10 leaves the own-shop question open |
| `docs/superpowers/specs/2026-10-14-community-actions-design.md` | Stage H: posting, Close, Reopen (2.6), the 5 open requests (2.5), offers (2.9), Hide (2.14) |
| `docs/superpowers/specs/2026-10-14-messaging-design.md` | Stage E: the 7-day auto-confirm, settled when read (2.5) |
| `docs/superpowers/specs/2026-10-20-hardening-design.md` | Stage K: the shape this spec follows |
| `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md` | The sitemap is a cached Route Handler "unless it uses a Request-time API" |
| `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md` | The `default` profile: revalidate after 15 minutes |

---

## 1. Goal

- No admin approves, verifies, pauses, pins or otherwise judges their own shop, its listings or their own request, and no staff member reads the mentors' notes about themselves.
- A request nobody needs any more leaves the board by itself, its asker is told once, and they can bring it back.
- The sitemap lists only pages worth crawling today.

No public page gains a byte of JavaScript. Every page stays at stage K's figures to the byte (the listing forms at 152,334 B, 29 B past the 152,305 B stop line under decision 78).

## 2. Decisions

### Item 1: an admin's own shop

1. **One rule: an admin makes no Hub decision about their own shop, its listings or their own Looking For request.** Every action in `lib/staff/admin-actions.ts` that targets one of those is refused:
   - **Sellers:** `approveSeller`, `declineSeller`, `verifySeller` (both ways), `pauseSeller`, `resumeSeller`, `assignMentor`;
   - **Reports** whose target is the admin's own shop, a listing of it or their own request: `dismissReport`, `hideReportedListing`, `hideReportedRequest`, `pauseReportedShop`. Dismissing a report about yourself is the clearest conflict of all;
   - **Featured:** `pinSeller` and `unpinSeller` for the admin's own shop. Removing your own pin is harmless, but one rule with no exceptions is easier to state, test and trust;
   - **Show again:** `showListingAgain` for a listing of the admin's own shop, `showRequestAgain` for their own request.

   **Left alone, and why:**
   - **Overview's badge recalculation** (`recalculateBadges`, run when `/admin` renders). It applies the trust page's rules to every shop with no judgement, so the admin's own shop is recalculated like any other.
   - **Pickup points, Hub posts, slot requests, roles.** None is a shop. Stage J already refuses removing your own admin role.
   - **Reports the admin made about someone else's shop.** Hiding needs a report (stage J, "Hiding a listing or request without a report" is not built), so an admin who spots a scam reports it and then acts on it. Refusing that would stop a lone admin moderating at all. An open question (section 10).
2. **"Own" means owned now, read from the store at the moment of the action, never from a form field.**
   - A shop: `sellers.get(slug).ownerId === account.id`. A waiting shop's owner is its profile's `accountId`.
   - A listing: its shop's owner.
   - A request: `requests.get(id).askerId === account.id`.
   - A sample shop no account owns is nobody's, so every admin may act on it.

   Three plain functions in `lib/data/staff-shops.ts` (only `lib/data` touches the store): `isOwnShop(accountId, slug)`, `isOwnListing(accountId, listingId)`, `isOwnRequest(accountId, requestId)`. One helper in a plain module, `lib/staff/own.ts`, maps a report's target to the right one: `ownsTarget(accountId, target)`. Not in a `"use server"` file: every export there is an endpoint.
3. **The gate is in the action.** After `requireStaff` and the id checks, before reading the reason or writing anything:
   - nothing is written: no store change, no audit entry, no notification, no tag expired, and a typed reason isn't kept;
   - the page gets a notice, `own-shop` or `own-request`, and the action ends with `done(path)` to where the form was, as "Nothing changed" does today.
   The view hides the controls (decision 4), so only a forged post, an old tab or a race (the admin opened a shop on another tab) reaches the refusal.
4. **The views hide the controls and say why, in one line.** The controls are removed rather than disabled: a disabled button can't take focus, says nothing to a screen reader user about why, and an admin has nothing to try. Section 3 has the words.
5. **Mentors: no shop actions of their own, and nobody reads notes about themselves.** Mentors' only shop actions are notes and check-ins. Amendment 15.3 already keeps a shop's owner from being its mentor, so a mentor never sees their own shop on `/mentor`. The gap is an admin: `mentoredShops` shows admins every shop with a mentor, their own included, so an admin who sells can open `/mentor/{their shop}`, read what mentors wrote about them and add notes about themselves. That breaks CLAUDE.md's "never seen by the seller". So:
   - `mentoredShops` leaves out the viewer's own shop for everyone, admins included. `/mentor/{own}` becomes the 404, `addMentorNote` and `addCheckIn` reach `notFound()` through `mentoredFrom`, and the CSV (`/mentor/export`) leaves the row out. The 404 matches how the mentor area already treats a shop that isn't yours.
   - `assignMentor` on your own shop is refused (decision 1): choosing who writes notes about you is a decision about yourself.
   - The mentor dropdown leaves out the shop's owner (stage G's open point: "The admin mentor dropdown still lists a shop's owner").
6. **The only admin isn't exempt.** If they own a shop, it waits until there's a second admin. The way out is stage J's: give someone the Admin role in `/admin/staff`. The line on their own shop's page says so, only when they're the only admin (section 3).
7. **The audit log is unchanged.** A refusal writes no entry, as "Nothing changed" writes none (stage G plan decision 23). No new action kind, no new words in `lib/staff/audit-words.ts`.

### Item 2: old requests close themselves

8. **The rule, and the numbers.** An open request counts as closed from its **closing day**, a SAST date:
   - **With a needed-by date:** 4 days after it, so the request stays up for 3 whole days after the date it was needed by. Needed by Friday 16 October: open through Monday 19, closed from Tuesday 20.
     - **Why 3:** a need that slips past a Friday is often still met over the weekend, and an offer in flight deserves a day or two. Longer, and the board shows requests whose date is well gone.
   - **Without one:** 30 days after the SAST date it was posted, last edited or reopened (the row's `updatedAt`, which only those three, and the Hub's Hide and Show again, change). Posted 13 October: closed from 12 November.
     - **Why 30:** a month covers the slow asks (a res fridge, a semester's textbook) and is about a quarter of an Eduvos semester. The board stays fresh, and an asker who still needs it reopens it in one press. An edit restarting the month is deliberate: an asker who edits is still looking.
   - A needed-by date always wins over the 30 days, even when it's further out: it's the asker's own word on how long they need it, and the form already caps it at 90 days (`NEEDED_BY_DAYS`).
   - The day is SAST's, compared with `sastDate(now)` as text, as the Hub's feed compares event dates. Nothing turns on the server's timezone.
9. **The 16 sample requests never close themselves.** A request with no asker (`askerId === null`) has no closing day.
   - Their October dates would empty the board within weeks, in every demo and every end-to-end run, and two of them (needed by 16 and 19 October) would close today.
   - They're stand-ins that go with sample mode. Nobody is there to tell, and nobody could reopen them.
   - The two seeded as closed stay closed. This is the same reasoning as stage K's sample exemption from the message limits.
10. **The rule is a pure function of stored fields and today's date, so cached readers stay pure.**
    - `closingDay(row)` in `lib/looking-for/rules.ts` returns the SAST date or null. It reads no clock.
    - `LookingForRequest` gains `closesOn: string | null`, worked out in `toRequest`. It's a function of the row alone, so a cached entry that holds it is never wrong about it.
    - `requestOpenOn(request, today)` is the one test: `status === "open"` and (`closesOn === null` or `today < closesOn`).
    - The list readers take `today` as an argument and apply it inside `"use cache"`, as `getHubPosts` takes `from`. The cache keys on it, so each reader's entry turns over at SAST midnight:
      - `getRequests({ campus, limit, today })` (the homepage);
      - `getOpenRequests({ category, today })` (the board);
      - a new `getListedRequestIds({ today })` (the sitemap, decision 19).

      Their callers read `today` with `sastToday()` after `await connection()`, inside the `<Suspense>` they already render in, as `HubFeed` does. Nothing reads the clock while prerendering.
    - `getRequest(id)` and `getRequestIds()` stay date-free: a request's page, open or closed, stays prerendered and reachable.
11. **The close is also stored, the first time something request-time looks.** As stage E settles the 7-day auto-confirm when a conversation is read (messaging spec 2.5), `settleRequests(now)` in `lib/data/requests.ts` closes every open, unhidden request that has an asker and whose closing day has come:
    - `status: "closed"`;
    - `closedAt`: the start of the closing day in SAST, as UTC (`2026-10-20T00:00:00+02:00` is stored as `2026-10-19T22:00:00.000Z`), so the date shown is the rule's, not the date someone happened to look;
    - `closedBy: "auto"` (a new field: `"asker"` when the asker closes it, `null` on the seeds);
    - `updatedAt` stays as it was.

    It marks every due row in one synchronous pass, before any `await`, and only then sends the notifications. Two renders at once can't close a request twice or notify twice.

    **Where it runs.** Every caller is request-time and outside `"use cache"`:
    - the board's `RequestBoard` and the homepage's `LookingForRequests`, after `connection()`, with the same `now` that gives `today`. These run on most visits, so a due request is settled within moments of SAST midnight;
    - the request page's session part (`ViewerOffers`) and the offer composer's page;
    - the asker's own reads: `listOwnRequests`, `getOwnRequest` and `countOpenRequests`, which gain a `now` argument;
    - every Looking For Server Action (post, edit, close, reopen, delete, offer) and the staff actions that touch a request (`hideReportedRequest`, `showRequestAgain`), first thing after the session.

    **Not in the header's notification count.** `countNewNotifications` is called by `components/header/AccountLink.tsx` and `components/tabbar/TabBar.tsx`, which belong to the header session, and it has no clock (a clock read there needs `connection()` in those files). The board and homepage settle often enough that it isn't needed.
12. **The asker is told once, in the app.** One notification of the existing `request-update` kind, sent by `settleRequests` when it closes the row, linking to Your requests. The stored close is what makes it once: a closed row is never settled again. No email (decision 57 stands).
13. **The asker can reopen it, as any closed request.**
    - Reopen counts towards the 5 open (spec 2.5), as today.
    - Reopening sets `closedBy` and `closedAt` back to null and `updatedAt` to now, which starts a fresh 30 days.
    - **A needed-by date that has passed is removed on reopening** (`neededBy < sastDate(now)`). Otherwise the request would close again at the next look. The notice says so, and Edit can set a new date. This applies to a request the asker closed by hand too: the same reopen would otherwise vanish the same way.
14. **Where an auto-closed request shows.** It's a closed request in every way a closed request already is:
    - **the board and the homepage** leave it out (they list open requests);
    - **the sitemap** leaves it out (decision 19);
    - **its page** stays up and says "This request is closed", with no Offer to help;
    - **the offer composer and `sendOffer`** refuse it with stage H's closed words ("This request is closed, so it isn't taking offers."). They test `requestOpenOn(request, today)`, not the cached status alone;
    - **offer threads** carry on, as when an asker closes a request;
    - **the 5 open** no longer counts it (the asker's reads settle first);
    - **the admin's numbers** count requests posted, which doesn't change;
    - **the data download** gains `closedAutomatically: boolean` on each request.
15. **Cache tags: nothing writes inside a cached reader, and the rule never waits on a tag.**
    - The list readers apply the rule by `today`, so they're right whether or not the row has been settled.
    - `settleRequests` writes the store from a render, where `updateTag` and `revalidateTag` aren't allowed, and it doesn't try. In a Server Action, when it closed anything, the action calls `requestsChanged()` (most already do).
    - **The one lag:** a request page's prerendered shell (`PublicOffers` in the `OffersPanel` fallback, from `getRequest`) still holds "open" until that cached entry is refreshed. It is refreshed at the next write that expires `requests`, or 15 minutes after it was made (the `default` cache life). The session part, which streams in on every view, applies the rule by date. So in that window a visitor may see Offer to help replaced by "This request is closed" as the page finishes, and a press is refused with the closed words. It's rare (a request on its closing day, before any write) and harmless, and stage G's badges already accept the same 15 minutes.
16. **A hidden request isn't settled while it's hidden.** The asker can't act on it, and a "closed automatically" note about a request the Hub took down would only confuse. After Show again (which sets `updatedAt`), the rule applies as to any open request. A request needed by a date long gone then closes at the next look, and its asker hears both: shown, then closed.

### Item 3: sales confirmed after 7 days

17. **Dropped: stage E built it.** Messaging spec 2.5's Done-to-Confirmed after 7 days is settled when read:
    - `settle` in `lib/data/messages.ts` stores `status: "confirmed"`, `confirmedAt` (the due moment) and `confirmedBy: "auto"`, and marks the buyer's "sale to confirm" notification read;
    - `soldAt` in `lib/data/shop-stats.ts` counts the sale from the due moment without writing, so the dashboard, the badges and the mentor dashboard agree;
    - `components/messages/SaleActions.tsx` says "Sale confirmed automatically on {date}, a week after it was marked completed."

    GO-LIVE already records this ("it's checked on read today"). The real backend's job stays a go-live item.

### Item 4: trust badges

18. **Nothing to build in sample mode.** Badges are worked out from the store by `recalculateBadges` every time `/admin` renders, and by `recalculateBadgeFor` after a reply or a buyer's confirmation. Between those, a badge can lag for two reasons:
    - the 90-day window moving on;
    - a sale confirming itself on read.

    Buyers see it within 15 minutes of the next recalculation (stage G's open point). In sample mode the server restarts often and admins open Overview daily, so a nightly job would add nothing. The real backend's nightly job stays a go-live item. Settling requests (decision 11) doesn't touch badges: requests count for no badge.

### Item 5: the sitemap

19. **The sitemap lists only open requests and Hub posts that haven't passed, and works out "today" per request.**
    - **Requests:** only those `requestOpenOn(request, today)`. Closed ones (by the asker, automatically, or the two closed seeds) and hidden ones are left out.
    - **Hub posts:** events and office hours whose SAST date is before today are left out (`hasPassed(post, today)` in `lib/hub.ts`, the same test as the feed's). Today's still count. **Tips stay:** they don't date, and they're the Hub's lasting content.
    - **Pages stay reachable.** `getRequestIds()` and `getHubPostIds()` keep feeding `generateStaticParams`, so a closed request's page and a past event's page stay prerendered, linked from where they were, and indexable. Only the list of pages offered to crawlers changes.
    - **How:** `app/sitemap.ts` calls `await connection()`, then `sastToday()`, then the dated readers `getListedRequestIds({ today })` and `getListedHubPostIds({ today })`, each cached and keyed on `today`. The sitemap docs say a sitemap that uses a request-time API is generated per request; it was cached before. A crawler fetches it rarely, and the two readers are cached per day, so the cost is one small render per fetch.
    - `lib/sitemap.ts`'s `sitemapEntries` doesn't change: it already takes the id lists.

### Item 6: Featured with few Verified sellers

20. **No change; it stays Lama's.**
    - A strict week's break is worse with today's numbers: nine Verified sellers for four places gives 4, then 4, then 1, so the row runs short three days in seven on every campus (stage G's open point found it emptied rows for four days of each week).
    - The trust page is already honest about it: "A seller who has been featured sits out for a week when there are enough other Verified sellers to fill the row." Making the break a rule would make the homepage worse to keep a promise nobody was given.
    - The break holds in full once about 28 sellers are Verified (four places for seven days).
    - **A small refinement Lama may want** (not in this stage): among resting sellers, order the least recently featured first, rather than by the day's rotation. Today, when the row has to dip into the resting sellers, it can pick one featured yesterday over one featured five days ago. It's a few lines in `drawFeatured` (`lib/featured.ts`) and `featuredFor`, which would pass each resting seller's last day. Section 10 asks.

---

## 3. Item 1: an admin's own shop

### Behaviour

- **`/admin/sellers/{own}`:** the shop's facts as today. "What you can do" holds the line below in place of Approve, Decline, Verify, Pause and Resume. The Mentor section shows who mentors it, as text, with no form.
- **`/admin/sellers/{own}/decline` and `/pause`:** the line, with no form, and the existing link back.
- **`/admin/reports/{id}`** about the admin's own shop, a listing of it or their own request: the report's facts as today. The line replaces Hide, Pause and the Dismiss form. The `/hide` and `/pause` confirm pages show the line too.
- **`/admin/hidden`:** an own listing's or request's row shows "Yours" where the Show again link was. Its confirm page shows the line, with no button.
- **`/admin/featured`:**
  - the seller list leaves out the admin's own shop;
  - a line under the field says why, when that shop would otherwise be listed;
  - in the pins list, the admin's own shop's pins show the line in place of Remove.
- **`/mentor` and `/mentor/export`:** the admin's own shop isn't listed. `/mentor/{own}` is the 404.
- **Another admin** sees every control as today.
- **A forged or stale post** reaches the gate (decision 3) and lands back with the notice.

### Data and code

- `lib/data/staff-shops.ts`: `isOwnShop`, `isOwnListing`, `isOwnRequest` (decision 2).
- `lib/staff/own.ts` (new, plain module): `ownsTarget(accountId, target: ReportTarget)`.
- `lib/staff/admin-actions.ts`: each action in decision 1 checks ownership after the role and the id. One shared helper, `refuseOwn(kind: "shop" | "request", path, now)`, leaves the notice and calls `done(path)`.
- `lib/data/staff-reports.ts`: `ReportView` gains `own: "shop" | "listing" | "request" | null`, and `HiddenItem` gains `own: boolean`. `getReport`, `listReports`, `getHidden` and `listHidden` take the viewer's account id. When `own` is set, `can.hide` and `can.pause` are false.
- `lib/data/featured.ts`: `featuredChoices(viewerId)` leaves out the viewer's shops and returns `{ choices, ownLeftOut: boolean }`. `PinView` gains `own: boolean`.
- `lib/data/mentors.ts`: `mentoredShops` skips rows whose owner is the viewer (decision 5).
- `lib/data/staff-shops.ts`: `listMentors(exceptOwnerId)`, so the dropdown leaves out the shop's owner.
- `lib/staff/notices.ts`: two codes, `own-shop` and `own-request`.
- Views: `components/staff/AdminSeller.tsx`, `SellerConfirm.tsx`, `AdminReport.tsx`, `ReportConfirm.tsx`, `AdminHidden.tsx`, `ShowAgainConfirm.tsx`, `AdminFeatured.tsx`. Their pages pass the viewer's id, and `AdminSeller` also gets whether the viewer is the only admin.
- No new row, field, cookie or table. `STORE_VERSION` moves for item 2, not for this.

### Rules

- Ownership is checked against the store in the action, never a hidden field. `approveSeller`'s `owner` field still only guards against a replaced shop (amendment 14.6).
- The check runs after `requireStaff`, so someone without the role still gets the 404, never a hint that the shop is staff-owned.
- Server Components only. No `"use client"`.

### Words

Samples for Lama to change, in the views and `lib/staff/notices.ts`:

| Where | Words |
|---|---|
| Own shop's page and its confirm pages | "This is your own shop, so another admin must make the Hub's decisions about it: approving, verifying, pausing, pinning and choosing its mentor." |
| The same, when the viewer is the only admin | Adds: "You're the only admin. Give someone else the Admin role in Staff first." ("Staff" links to `/admin/staff`, no prefetch.) |
| A report about your own shop, listing or request | "This report is about your own shop, so another admin must handle it." (or "your own listing", "your own request") |
| Hidden list row | "Yours" |
| Show again's confirm page | "This is your own listing, so another admin must show it again." (or "request") |
| Featured, under the seller field | "Your own shop isn't in the list. Another admin can pin it." |
| Featured, an own pin | "Another admin must remove this pin." |
| Notice `own-shop` | "Nothing changed. It's your own shop, so another admin must do this." |
| Notice `own-request` | "Nothing changed. It's your own request, so another admin must do this." |

### Privacy (POPIA)

- Nothing new is collected or kept.
- Closing the admin route to `/mentor/{own}` restores what the policy and CLAUDE.md already promise: mentors' notes are never seen by the person they're about.
- The report and hidden views learn whether the target is the viewer's own from server-side data. No asker is named to anyone: "your own request" is shown only to the asker.

### Accessibility

- The lines are plain paragraphs in the section where the controls were, so a screen reader user meets the reason exactly where they'd look for the button.
- The notices use the existing staff notice region (`role="status"`).
- The "Staff" link is a real link with its own name, 44px tall as the frame's other links.
- No disabled controls (decision 4).

### Performance

- Server only. The staff pages have no client components, and no public page changes.
- Each ownership check is one map lookup, plus a scan of the reports for the queue.

### Tests

- **Unit:**
  - `lib/data/staff-shops.test.ts`: the three `isOwn…` functions, with a sample shop (nobody's), an owned shop, a listing, a request with an asker and a seed request.
  - `lib/staff/own.test.ts`: `ownsTarget` for each target kind.
  - `lib/staff/admin-actions.test.ts`, for each action in decision 1, with an admin who owns the target:
    - the store is unchanged;
    - no audit entry and no notification;
    - no tag is expired;
    - the notice is `own-shop` or `own-request`;
    - it ends with `done` to the right path.

    The same post by a second admin still works.
  - `lib/data/mentors.test.ts`: an admin who owns a mentored shop doesn't see it in `mentoredShops`, and `getMentoredShop` returns null for it. Another admin does see it.
  - `lib/staff/mentor-actions.test.ts`: a note or check-in about the viewer's own shop reaches `notFound()` and writes nothing.
  - `lib/data/staff-reports.test.ts`: `own` and `can` for an own target. `lib/data/featured.test.ts`: `featuredChoices` leaves out the viewer's shop and says so; `PinView.own`.
- **Component:** `AdminSeller`, `AdminReport`, `AdminFeatured`, `AdminHidden`, `ShowAgainConfirm`, `SellerConfirm` and `ReportConfirm`, each with the viewer as owner:
  - no form or button;
  - the line's words;
  - the only-admin sentence present only when the viewer is the only admin;
  - the mentor dropdown has no option for the owner.
- **End to end:** `tests/e2e/housekeeping-writes.spec.ts`, a new `housekeeping-writes` project that runs last, after `hardening-writes`:
  - Pieter (admin) gives Sipho (owner of Tech corner) the Admin role.
  - Sipho opens `/admin/sellers/tech-corner`: the line, no Verify or Pause, the mentor as text.
  - A forged `verifySeller` post (the form's fields, sent with `page.request`) lands with the `own-shop` notice, and Tech corner's Verified state is unchanged on `/sellers/tech-corner`.
  - `/mentor/tech-corner` shows the 404's heading for Sipho.
  - Pieter, signed in again, still sees every control.
  - Pieter removes Sipho's role, so later runs start clean.
  - axe finds no serious or critical issues on Sipho's view, at 390 and 1440px.

## 4. Item 2: old requests close themselves

### Behaviour

- **On the board and the homepage**, a request leaves on its closing day, at SAST midnight, whether or not anything has settled it.
- **The first request-time look after that** stores the close and sends the asker one notification.
- **Your requests:**
  - an open request with a closing day shows "Closes automatically on {date}." under its meta line;
  - an auto-closed one shows "Closed automatically on {date}" and why;
  - Reopen shows, as for any closed request. When its needed-by date has passed, a hint under it says reopening removes it.
- **The request page** for the asker: the same lines in the asker's panel. For everyone else, "This request is closed", as now.
- **The request form:** the needed-by hint says how requests close.
- **Reopening** a request whose needed-by date has passed: the request opens without the date, and the notice says so.

### Data and code

- `lib/data/rows.ts`: `RequestRow` gains `closedBy: "asker" | "auto" | null`. Seeds have `null`, and `setRequestOpen` sets `"asker"` on Close and `null` on Reopen. `lib/data/store.ts`: `STORE_VERSION` 10 to 11.
- `lib/looking-for/rules.ts`:
  - `NEEDED_BY_GRACE_DAYS = 3` and `IDLE_CLOSE_DAYS = 30`;
  - `closingDay({ askerId, neededBy, updatedAt })` returns `addDays(neededBy, NEEDED_BY_GRACE_DAYS + 1)`, or `addDays(sastDate(updatedAt), IDLE_CLOSE_DAYS)`, or `null` without an asker;
  - `requestOpenOn(request, today)`;
  - `closedAtFor(day)`, the start of a SAST day as a UTC ISO time.
- `lib/types.ts`:
  - `LookingForRequest` gains `closesOn: string | null`;
  - `OwnRequest` gains `closedAutomatically: boolean` and `closeReason: "needed-by" | "idle" | null`.
- `lib/data/requests.ts`:
  - `toRequest` fills `closesOn`;
  - `listedRequests(today)` and a new `listedRequestIds(today)` apply the rule;
  - `settleRequests(now)` (decisions 11, 12 and 16);
  - `listOwnRequests`, `getOwnRequest` and `countOpenRequests` take `now` and settle first;
  - `setRequestOpen` handles `closedBy`, and on reopening clears a passed needed-by date. It returns whether it did, for the notice;
  - `exportRequests` adds `closedAutomatically`.
- `lib/data/index.ts`:
  - `getRequests` and `getOpenRequests` take `today`;
  - a new `getListedRequestIds({ today })`, each `"use cache"` with `tagRequests()`.
- `lib/looking-for/words.ts`: `requestAutoClosedText(title, reason)`, the Your requests lines and the `reopened-date-cleared` notice.
- **Callers:**
  - `components/looking-for/RequestBoard.tsx` and `components/home/LookingForRequests.tsx`: `await connection()`, `now`, `settleRequests(now)`, `today`;
  - `components/looking-for/ViewerOffers.tsx`: the same, and passes `open` to `PublicOffers`;
  - `components/looking-for/OffersViews.tsx`: `PublicOffers` takes `open: boolean` (the `OffersPanel` fallback passes `request.status === "open"`), and `AskerOffers` shows the lines;
  - `components/looking-for/YourRequestsView.tsx` and `RequestActions.tsx`: the lines and the reopen hint;
  - `components/looking-for/RequestFormView.tsx`: the hint;
  - `lib/looking-for/subjects.ts` and the composer's page: `requestOpenOn` with today;
  - `lib/looking-for/actions.ts`: settle first, pass `now` to the reads, `requestsChanged()` when settle closed anything, the new notice;
  - `lib/staff/admin-actions.ts`: `hideReportedRequest` and `showRequestAgain` settle first.
- `app/privacy/page.tsx` and `app/how-it-works/page.tsx`: words below.

### Rules

- No clock read while prerendering: every `new Date()` here is in a Server Action, or after `connection()` inside an existing `<Suspense>`.
- No write inside `"use cache"`. `settleRequests` is never called from a cached function.
- Seeds never close themselves (decision 9). Hidden requests aren't settled (decision 16).
- One notification per close. A closed row is never settled again.
- The asker stays unnamed: the notification goes to their account, and nothing public changes but the request's absence.

### Words

Samples for Lama to change, in `lib/looking-for/words.ts` and the views:

| Where | Words |
|---|---|
| Notification, needed-by | "Your request {title} closed automatically 3 days after the date you needed it by. Reopen it in Your requests if you still need it." |
| Notification, 30 days | "Your request {title} closed automatically after 30 days with no changes. Reopen it in Your requests if you still need it." |
| Your requests and the asker's panel, open | "Closes automatically on {13 Nov}." |
| The same, auto-closed, needed-by | "Closed automatically on {20 Oct}, 3 days after the date you needed it by." |
| The same, auto-closed, 30 days | "Closed automatically on {12 Nov}, after 30 days with no changes." |
| Reopen's hint, needed-by passed | "Reopening removes the needed-by date, which has passed." |
| Notice `reopened-date-cleared` | "Request reopened. Its needed-by date had passed, so it's been removed. Add a new one with Edit." |
| Request form, needed-by hint, added | "Your request closes automatically 3 days after this date. Without one, it closes after 30 days with no changes." |
| How it works, Looking For | "Requests close automatically 3 days after their needed-by date, or after 30 days with no changes. You can reopen one." |
| Privacy policy, notifications | Adds "your request closes automatically" to the list. |
| Privacy policy, Your Looking For requests | Adds: "An open request closes automatically 3 days after its needed-by date, or after 30 days with no changes; you're told, and you can reopen it." |

Dates are `shortSastDate(closedAt)` and `dayMonth(closesOn)`, in `<time dateTime>`.

### Privacy (POPIA)

- Nothing new is collected. `closedBy` is a fact about the request, kept with it and deleted with it.
- Closing forgotten requests takes them off the board and out of the sitemap sooner, so less about a student's needs stays on show. How long closed requests are kept is still Eduvos's call (Waiting on).
- The data download says which requests closed automatically.

### Accessibility

- The lines are text in the existing meta and hint styles (`requests-item-meta`, `form-hint`, `request-offers-state`), with dates in `<time>`.
- The reopen hint is tied to the Reopen button by `aria-describedby`.
- The notice uses the existing `role="status"` line.
- No new controls.

### Performance

- **No JavaScript:** every changed component is a Server Component.
- **HTML:** one short line per request on Your requests and the asker's panel, and one sentence on the form.
- **Server:** `settleRequests` scans the requests map once per board or homepage render (tens of rows in sample mode). The dated readers make one cache entry per argument set per day, as the Hub's do.
- **The homepage's request section** now calls `connection()`. It already renders per request (it reads the campus cookie), so nothing moves from the static shell.

### Tests

- **Unit:**
  - `lib/looking-for/rules.test.ts`:
    - `closingDay` for a needed-by date: 16 October gives 20 October;
    - for none: posted 13 October 09:30 UTC gives 12 November;
    - a late-evening UTC time that is the next day in SAST (22:30 UTC on 13 October counts from 14 October);
    - an edit moving the day;
    - a seed gives null;
    - `requestOpenOn` the day before, on and after the closing day;
    - `closedAtFor("2026-10-20")` is `"2026-10-19T22:00:00.000Z"`.
  - `lib/data/requests.test.ts`:
    - the list readers leave out a due, unsettled request;
    - `settleRequests` closes it with `closedBy: "auto"` and the closing day's `closedAt`, sends one notification with the right words, and a second call sends none;
    - it leaves seeds, hidden requests and closed ones alone;
    - `countOpenRequests` no longer counts it;
    - reopening clears a passed needed-by date and reports it, keeps a future one, resets `closedBy`, and gives a fresh 30 days;
    - `exportRequests` says `closedAutomatically`.
  - `lib/data/index.test.ts`: `getOpenRequests` and `getRequests` with two `today` values.
  - `lib/looking-for/actions.test.ts`:
    - an offer on a due request is refused with the closed words;
    - a post when one of the 5 has just come due succeeds;
    - Reopen's new notice;
    - `requestsChanged` is called when settle closed something.
- **Component:**
  - `YourRequestsView` and `AskerOffers`: the open and closed lines for both reasons, and the hint with `aria-describedby`;
  - `PublicOffers` with `open` false;
  - `RequestFormView`: the hint.
- **End to end** (`housekeeping-writes`): a fresh account posts a request needed by today plus 7, and one with no date. Your requests shows "Closes automatically on" today plus 11 and today plus 30, worked out in SAST in the test. The board still shows the sample requests. Time can't be moved in a built server, so the closing itself is unit-tested only.
- **The privacy page test** (`app/privacy/page.test.tsx`) still passes: no new cookie or storage key.

## 5. Item 5: the sitemap

### Behaviour

`/sitemap.xml` lists the static pages, collections, open shops and listings as today, then requests open today, then Hub tips and events and office hours from today on. The pages it leaves out answer as before.

### Data and code

- `lib/data/index.ts`: `getListedRequestIds({ today })` (item 2) and `getListedHubPostIds({ today })`, which is published posts with `!hasPassed(post, today)`. Both are `"use cache"`, tagged.
- `app/sitemap.ts`: `await connection()`, `sastToday()`, the two dated readers in place of `getRequestIds()` and `getHubPostIds()`.
- `lib/sitemap.ts`: unchanged.

### Rules, privacy and accessibility

- Today's events and office hours stay in the sitemap until SAST midnight, as on the feed.
- No new data, and nothing for anyone to read.

### Performance

The sitemap is rendered per fetch rather than cached at build. Crawlers fetch it rarely. Both readers are cached per day, and the other three are unchanged.

### Tests

- **Unit** (`app/sitemap.test.ts`, with `connection` mocked and the clock fixed): a closed request, a hidden one, a due one and a past event are absent. An open request, a tip, today's event and a future one are present.
- **Unit** (`lib/data/index.test.ts`): `getListedHubPostIds` with two dates.
- **End to end** (`housekeeping-writes`, read-only, at 1440 only): `/sitemap.xml` has no entry for the event of 16 September 2026 or the closed seed requests, and has a tip and an open seed request.
- **The plan's build step** checks the sitemap shows as rendered per request in `pnpm build`'s route list, and that the build logs no clock warning.

## 6. Files (summary)

| File | Change |
|---|---|
| `lib/staff/admin-actions.ts`, `lib/staff/own.ts` (new), `lib/staff/notices.ts` | Own-shop gate and notices (item 1); the two request actions settle first (item 2) |
| `lib/data/staff-shops.ts`, `staff-reports.ts`, `featured.ts`, `mentors.ts` | Ownership, `own` flags, choices, mentors (item 1) |
| `components/staff/AdminSeller.tsx`, `SellerConfirm.tsx`, `AdminReport.tsx`, `ReportConfirm.tsx`, `AdminHidden.tsx`, `ShowAgainConfirm.tsx`, `AdminFeatured.tsx`, and their pages under `app/admin` | Lines in place of controls |
| `lib/looking-for/rules.ts`, `words.ts`, `actions.ts`, `subjects.ts` | Closing day, words, settle in actions (item 2) |
| `lib/data/requests.ts`, `rows.ts`, `store.ts`, `index.ts`, `lib/types.ts` | `closedBy`, `closesOn`, `settleRequests`, dated readers, `STORE_VERSION` 11 |
| `components/looking-for/RequestBoard.tsx`, `ViewerOffers.tsx`, `OffersViews.tsx`, `YourRequestsView.tsx`, `RequestActions.tsx`, `RequestFormView.tsx`, the composer's page, `components/home/LookingForRequests.tsx` | `connection()`, today, the lines |
| `app/sitemap.ts` | Request-time, dated readers (item 5) |
| `app/privacy/page.tsx`, `app/how-it-works/page.tsx` | Words |
| `tests/e2e/housekeeping-writes.spec.ts` (new), `playwright.config.ts` | The new project, run last, and its `testIgnore` in the device projects |
| `CLAUDE.md` | Two lines once built: "No admin makes a Hub decision about their own shop, its listings or their own request; the gate is in the action (`lib/staff/own.ts`)", and "Looking For requests close themselves (`closingDay`): list readers take `today`, and `settleRequests(now)` stores the close from request-time code, never inside `use cache`" |

None of these is in the header session's set. `components/home/LookingForRequests.tsx` is the homepage's, not the header's.

## 7. Not in this stage

- **Two admins approving each other's shops.** The rule stops self-dealing, not collusion. Only Eduvos's choice of who holds the role answers that.
- **Reports the admin made** (decision 1). Open question.
- **Answering your own slot request,** or editing your own Hub post's RSVPs. Neither is a shop.
- **Telling the asker before their request closes** (a reminder a few days ahead). It needs a second notification and a second settle. Worth adding if askers are surprised.
- **Closing requests from the header's notification count** (decision 11). It needs the header's files and a clock read there.
- **Deleting old closed requests.** Retention is Eduvos's call.
- **The least-recently-featured order** (decision 20). Open question.
- **Any scheduled job.** All of them are the real backend's.

## 8. Go-live changes

For `docs/reference/GO-LIVE.md`, when the stage is built:

- **Section 6, Backend, the scheduled jobs line:**
  - "closing old Looking For requests (stage H leaves them open)" becomes "closing old Looking For requests and telling their askers (stage L closes them when something looks, by `closingDay`; the job runs the same rule nightly at 00:05 SAST)";
  - the 7-day auto-confirm keeps its job ("it's checked on read today");
  - the trust badges keep theirs.
- **Section 6, Backend, add:** "Supabase: `requests.closed_by` (`asker`, `auto`), and the closing day as a generated column or a view, so the board's query and the job use one rule (stage L decision 10)."
- **Section 6, Production:** tick "Decide whether the sitemap should keep listing closed requests and past Hub posts", with "it lists open requests, tips and events from today on, and is rendered per fetch (stage L)".
- **Section 7:**
  - tick "Should an admin be able to act on their own shop?", with "No: refused in the action, controls hidden, and nobody reads mentors' notes about themselves (stage L)";
  - leave "Featured with few Verified sellers" open, with "assessed in stage L: a strict break would leave rows short; a least-recently-featured order is offered".
- **Section 6, Backend, the staff actions' "re-check the actor's role inside the transaction":** add "and that the target isn't the actor's own (stage L)".

## 9. Order

1. Item 1 (own shop): no data change, the smallest risk, its own end-to-end test.
2. Item 2 (requests): `STORE_VERSION`, the rule, settle, the readers and callers, words.
3. Item 5 (sitemap): needs item 2's `getListedRequestIds`.
4. Docs: GO-LIVE, CLAUDE.md, PROGRESS, the decisions log's next row.

The plan checks `pnpm build` and `tests/e2e/performance.spec.ts` after items 2 and 5. Every page's first-visit JavaScript must equal stage K's to the byte. Any change stops the build to find out why.

## 10. Open questions for Lama

1. **The numbers:** 3 days after the needed-by date, and 30 days without a change. Should an edit restart the 30 days (decision 8)?
2. **Reopening removes a passed needed-by date** (decision 13). The alternative is refusing to reopen until the date is changed, but Edit only works on open requests.
3. **Reports an admin made about someone else** (decision 1): should another admin act on them too? It would stop a lone admin moderating, so this spec allows it.
4. **The only admin who sells** waits for a second admin (decision 6). Eduvos may want at least two admins from day one anyway.
5. **Featured's resting order** (decision 20): order resting sellers least recently featured first? A few lines, no change on the page.
6. **A reminder before a request closes** (section 7): wanted?
7. **The sample words** in sections 3 and 4.
