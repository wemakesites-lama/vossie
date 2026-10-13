# Vossie staff tools: design spec

- **Date:** 2026-10-14
- **Status:** Approved under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision is Claude's recommendation, logged in the decisions log.
- **Scope:** stage G:
  - the admin console;
  - the Hub's post editor and office-hours queue;
  - the mentor dashboard;
  - the trust-badge and Featured calculations that run on the sample store.

  It builds on stages D to F.

## Related documents

| File | What it is |
|---|---|
| `docs/reference/FUNCTION-MAP.md` | J (Hub Growth corner), K (mentor tools), L (admin), section 6 (badge rules, Featured, mentor flags) |
| `docs/superpowers/specs/2026-10-14-community-pages-design.md` | Hub posts (`HubPost`) and requests |
| `docs/superpowers/specs/2026-10-14-messaging-design.md` | Reports, conversations and confirmed sales |
| `docs/superpowers/specs/2026-10-14-selling-design.md` | Seller profiles, approval and listings |

---

## 1. Goal

The Hub can run the marketplace from inside it:
- approve sellers and grant Verified;
- handle reports;
- hide a listing or pause an account;
- pin Featured sellers;
- manage pickup points;
- publish Hub posts;
- answer office-hours requests;
- see an audit log of every staff action.

Mentors can follow their sellers' health.

## 2. Decisions

1. **Staff pages live under `/admin`, `/hub/manage` and `/mentor`,** and each checks its role on the server: admin for `/admin`, admin or mentor for the Hub and mentor tools.
   - Anyone else gets the 404, not a "forbidden" page, so staff routes aren't advertised (the old demo's behaviour).
   - Signed-out visitors go to sign-in first.
2. **Every staff action is a Server Action that writes an audit entry:** who, what, the target, the reason when one is asked for, and when (UTC, shown in SAST). The log can't be edited.
3. **Admin console sections:**
   - **Overview:** counts that need attention (sellers waiting, open reports), with links.
   - **Sellers:** waiting for approval first.
     - Each row: shop, campus, applied date, and a link to review.
     - The review page: the onboarding answers, **Approve** or **Decline**. Decline asks for a reason; the seller sees it and can apply again.
     - Approved shops: **Verify** (or remove Verified), **Pause shop**, **Resume**.
   - **Reports:** open first. Each one shows the target, the reason, the detail and the reporter's first name. Actions:
     - **Dismiss** (with a note);
     - **Hide the listing** (it disappears from buyers and the seller is told why);
     - **Pause the account** (the seller's shop and listings disappear; they can still sign in and see why).

     Each action closes the report and notifies the reporter: "Thanks, we've acted on your report", or "We looked and didn't find a problem".
   - **Featured:** today's draw per campus. An admin can pin a verified seller to a campus for a date, which takes one of the 4 slots before the draw.
   - **Pickup points:** per campus, the approved points. An admin can add, rename or retire one. Retired points stay on existing listings, marked "no longer used".
   - **Audit log:** newest first, filterable by staff member and by kind, as links.
4. **The Hub's tools** (`/hub/manage`, `/hub/new`, `/hub/[id]/edit`) let mentors and admins write tips, events and office hours.
   - **Fields:** kind, title (70), campus or all, the date and time (events and office hours, SAST), place, capacity (events), summary, the body (the markdown subset, 4,000 characters), a cover photo (stage F's photo path), and **Published** (untick to keep a draft).
   - **A preview** shows the body rendered, on the server, after **Preview**.
   - **The office-hours queue:** requests ("what you'd like help with", the time that suits) with **Accept** or **Decline**. Each answer notifies the student.
5. **RSVP and booking become real for signed-in visitors.**
   - On an event, **RSVP** toggles "You're going" (the count updates).
   - On office hours, **Request a slot** opens a short form (what you'd like help with, 300 characters; a time that suits, 100).
   - Signed-out visitors still go to sign-in first.
6. **The mentor dashboard** (`/mentor`): the mentor's assigned sellers, each with:
   - their badge;
   - enquiries in the last 14 days and the share answered within 48 hours;
   - confirmed sales;
   - flags: "No enquiries in 14 days", "Slow replies (under 50% in 48 hours)", "Shop paused".

   A seller's page (`/mentor/[sellerSlug]`) adds private notes and check-ins (date, note), shared with other mentors and admins, never shown to the seller. **Download CSV** exports the dashboard's table (`/mentor/export`). Assignments are set by an admin on the seller's admin page.
7. **Trust badges are calculated from the store,** with the rules in the info pages (part C, decision 4): New seller, Responsive, Trusted. Listings show their seller's badge.
   - The calculation runs when an admin opens Overview, and after each confirmed sale or first reply. There's no scheduler yet.
   - The nightly job is a go-live item.
8. **Featured honours pins,** then fills the other slots with the existing fair daily draw (the homepage's `drawFeatured`), now only from approved, unpaused shops with at least one available listing, and with a week's break before the same seller is drawn again (as the trust page says). Draws are recorded in the store so the break can be checked.
9. **Staff tools are desktop-first but work on phones.**
   - Tables become stacked rows below the tablet step.
   - Every action is a form button, with no client code beyond the shell.
   - Destructive actions (decline, hide, pause) go through a confirm page.

---

## 3. Screens (summary)

| Route | Role | What |
|---|---|---|
| `/admin` | Admin | Overview |
| `/admin/sellers`, `/admin/sellers/[slug]` | Admin | The approval queue, a seller's review and actions, mentor assignment |
| `/admin/reports`, `/admin/reports/[id]` | Admin | The reports queue and a report's actions |
| `/admin/featured` | Admin | Today's Featured per campus, and pins |
| `/admin/pickup-points` | Admin | Points per campus |
| `/admin/audit` | Admin | The audit log |
| `/hub/manage` | Mentor or admin | Your posts, drafts, and the office-hours queue |
| `/hub/new`, `/hub/[id]/edit` | Mentor or admin | The post editor with preview |
| `/mentor`, `/mentor/[slug]`, `/mentor/export` | Mentor or admin | The dashboard, a seller's notes and check-ins, the CSV |

All are `noindex`, render per request inside `<Suspense>`, and share a simple staff frame: a heading, a row of section links, and the content.

## 4. Accessibility

- Tables have captions and header cells.
- Every action button names its target ("Approve Tech corner").
- Confirm pages repeat what will happen.
- Status changes after a post show a status message at the top of the page.

## 5. Performance

No client code beyond the shell. Staff pages aren't in the public budget, but each still stays under the limit.

## 6. Testing

- **Unit:**
  - role checks;
  - each staff action and its audit entry and notification;
  - the badge calculation for each rule's edges;
  - Featured with pins;
  - the mentor flags and CSV;
  - the post editor's validation and preview.
- **End to end:**
  - approve a pending seller, who then sees the dashboard;
  - verify a seller and see the Verified stamp on their storefront;
  - handle a report each way and see the reporter's notification;
  - hide a listing and see it gone from browse;
  - pin a Featured seller;
  - publish a Hub post and see it on `/hub`;
  - RSVP and request a slot, then accept it;
  - a mentor note, and the CSV download;
  - a student gets the 404 on `/admin`.
- **Checks:** axe on each page and the JS budget.

## 7. Not in this stage

Scheduled jobs (go-live), email to staff, staff accounts management beyond the seeded ones, and analytics.
