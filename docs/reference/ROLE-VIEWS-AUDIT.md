# Role views audit (2026-10-22)

An audit of how well CampusCart serves each role today (buyer, seller, admin, mentor), what good marketplaces and staff tools do instead, and the easiest wins. It comes before the role-focused views spec. Nothing here is built yet.

Method: four read-only code audits (one per role, with the review screenshots in `docs/progress/`) and one desk-research pass (sources at the end). Many of the screenshots predate the tab bar and the CampusCart rename, so the navigation was taken from the code.

Effort: **S** is a few lines in one or two files; **M** is a new reader or a new block; **L** is a new page or a new pattern across pages. Every win listed is server-rendered (no new client JavaScript), because first-visit JS is at about 150.6 KB against a 150 KB budget.

---

## The pattern across all four roles

1. **Dashboards report instead of telling you what to do next.** The seller sees last week's numbers, the admin sees three counts, the mentor sees an A to Z table. None of them puts "this needs you now, oldest first" at the top.
2. **Daily tools sit behind the Account page.** Messages, Notifications, Your requests, the Admin console and the Mentor dashboard are all rows on `/account`, and those rows sit *below* the Edit details form, so a phone has to scroll past a form nobody came to fill in.
3. **Hub-and-spoke navigation.** Every move goes back through a section's front page: `/sell`, `/admin` or `/mentor`. After an action you land on a list, not on the next thing to do.
4. **Mixed signals.** One Account badge counts buying and selling together, the inbox opens on Buying for a seller, and opening Notifications marks everything read at once.

The research agrees on the fix in principle: one account with role-aware navigation; a "needs you now" home per role; staff tools in their own areas with their own navigation (they already have `StaffFrame`); and at most 5 bottom tabs.

---

## Buyer (every student)

**What exists:** home, browse, listing, storefront, collections, Saved (Listings, Shops, Searches), Messages, Notifications, Looking For, Your requests, the Hub, Account. Signed in, the home page changes only its context strip.

**Taps from home (phone):**

| Job | Today | Note |
|---|---|---|
| Search | 2 | Fine |
| Reply to a seller | 3 + a scroll | Account → past the form → Messages → thread. No Messages entry in the tab bar, header or menu |
| See what's new | 2 | Account → Notifications, which clears every "new" mark at once |
| Saved listings | 1 | Fine, but kept on this device only |
| Post a request and see offers | ~3 + finding it | Looking For isn't in the header, menu or tab bar |
| Manage my requests | 2 + a scroll | The board has no link to Your requests |

**Problems, by impact:**
1. Messages, the main buying loop, is buried in Account (`components/account/AccountView.tsx:67-118` puts the form first).
2. Looking For is hard to find, and the board is a dead end for an asker.
3. No "new since last time" on saved searches or followed shops. The only signal is a notification that disappears once Notifications is opened.
4. No "my activity" overview. Signed-in home barely differs from signed-out, and `savedItemsBack` is hard-coded to 0 (`lib/data/accounts.ts:167`), so that line never shows.
5. There's no list of my RSVPs or slot bookings anywhere.

**Easiest wins:**
- **S** On `/account`, put the page links above Edit details, or fold Edit details into `<details>`.
- **S** Add Looking For to the menu drawer and the header quick links.
- **S** On the board, signed in: "Your requests (N open)" (`countOpenRequests`). Only the asker sees it.
- **S** Add a notifications count and link to the home context strip (`unreadCounts` already returns it).
- **S** Remove or fix the dead `savedItemsBack` line.
- **M** A "Your activity" block at the top of `/account`: unread messages, offers on my requests, open requests, followed shops, saved searches (`unreadCounts`, `listOwnRequests`, `offerThreadCount`, `listFollowedShops`, `listSavedSearches`).
- **M** "New" marks on the Saved tabs from unread `search-match` and `new-listing` notifications, without marking them read.

**Later:** a "You" or Activity page replacing the Account tab; a Messages tab with a badge; per-item read on notifications; Saved listings kept with the account; a "My Hub" list of RSVPs and bookings.

---

## Seller

**What exists:** `/sell` in four states (pitch, waiting, declined, dashboard); My listings with four tabs; the listing form; Edit shop; the Selling tab of Messages; the owner's storefront. The waiting page is good. The dashboard is a report: live/paused, followers, last 7 days (enquiries, replies in 48h, sales), badge, then five link rows and Pause.

**Taps (phone):**

| Job | Today | Note |
|---|---|---|
| Reply to a new enquiry | 3 + a scroll | Every dashboard action is below the fold (~790px down at 390px). "New enquiries 2" is not a link |
| …via Account | 4 + a scroll | The inbox opens on **Buying** (`lib/messaging/paths.ts:29`) |
| Add a listing | 2 + a scroll | |
| Mark sold | 3, plus ~5 more | "Mark as completed" in the thread doesn't touch the listing, so it stays Available |
| Resume a paused listing | 4 | |
| Edit the shop | 2 | No way back to the storefront after saving |

**Problems, by impact:**
1. **No action queue.** Nothing shows unanswered enquiries (they drive the 48-hour badge), drafts, Hub-hidden listings or sales waiting on the buyer.
2. **Upside-down hierarchy on a phone.** Three full-width stat cards and the badge come before every action.
3. The inbox opens on Buying, and the unread counts don't separate selling from buying.
4. A sale lives in two places (the thread and My listings) with no link between them.
5. Hub-and-spoke: no seller sub-navigation, no back link on Delete, no way from the storefront back to the dashboard.
6. My listings at 390px: the tabs wrap to two lines, and the four equal pills put Delete right next to Mark sold.
7. Thin empty states: "Nothing available right now." has no New listing button.

**Easiest wins:**
- **M** A **"Needs you" block** at the top of the dashboard: unanswered enquiries, unread, sales waiting for the buyer (from the selling inbox rows; a slim count reader is better than `getInbox`), plus drafts, Hub-hidden and paused counts (`listOwnListings`). Each line links to the thread or the right tab.
- **S** Put New listing (primary) and Messages above the numbers; put the three numbers in one compact row on phones (CSS only).
- **S** Make "New enquiries" a link to `inboxPath("selling")`. Open the Selling tab by default when selling has unread.
- **S–M** After "Mark as completed", offer a one-button "Mark {listing} as sold" (`changeListingState`).
- **S** My listings: one-line tabs, Delete as a text link set apart from the rest, New listing in each empty state.
- **S** Back links on Delete; "Back to your shop" on the owner's storefront.
- Followers stay a count only. No view counts, by design.

**Later:** a seller sub-nav across `/sell/*` (Overview · Listings · Messages · Shop); an unanswered-enquiries badge on the Sell tab; enquiry counts per listing; 30- and 90-day numbers (already computed for badges); a "what Trusted needs" checklist linking to the threads; split seller notifications.

---

## Admin

**What exists:** a sound structure. `StaffFrame` already gives every staff page a row of section pills filtered by role. The sections are Overview, Sellers, Reports, Hidden, Featured, Pickup points, Staff, Numbers, Audit, plus the Hub tools. The only way in is Account → Admin console.

**Clicks from home:**

| Job | Today | Note |
|---|---|---|
| Approve a waiting shop | 5 | Then back to Sellers for the next one |
| Handle a report | 5–6 | Lands on the list, not the next open report |
| Show again | 5–6 | Hidden has no nav pill; its pages highlight Reports |
| Give a staff role | 4 | The form sits above the list |
| Weekly numbers | 3 | Shows last week only; not labelled as such |
| Answer a slot request | 4 | The queue is sorted newest first |

**Problems, by impact:**
1. **No "next item" flow.** Every action returns to a fixed list, so working a queue of 10 doubles the clicks.
2. **The Overview is a half-triage.** It has counts but no age ("oldest since 10 Oct"), no direct link to the oldest item and no "All clear". Hidden is a prose line, not a card. Section pages show no counts.
3. **Nav:** no Hidden pill, no counts, and ten pills wrap to four rows at 390px.
4. **Desktop density:** every staff page sits above the full marketing footer (Start selling, the newsletter, the giant wordmark), about half of a 1440px screen. No campus filter or search on Sellers, Reports or Hidden.
5. **Inconsistent confirms:** Approve and Accept/Decline slot have no confirm page, but Show again does; "Keep it" sometimes returns to the item and sometimes to a list.
6. **Naming drift:** Staff vs Staff accounts, Hub posts vs Hub posts and office hours, Sellers vs Shops, and the eyebrow switching mid-task.

**Easiest wins:**
- **S** Add Hidden to `STAFF_SECTIONS` (`lib/staff/paths.ts:51`) and highlight it on its own pages.
- **S** Overview cards: add Hidden as a 4th card (`countHidden`), show "All clear" at 0 and drop the button.
- **S** Show the oldest waiting date on each card and link straight to that item (`listShopsForReview`, `listReports`).
- **S** Sort open slot requests oldest first.
- **M** A "Next waiting shop / Next open report" link on the item pages (first open item that isn't this one).
- **S** A slim footer on staff pages (no marketing blocks); move the badge paragraph down.
- **S** One name per section, and Staff's list above its form.
- **M** A campus filter as a query string on Sellers, Reports and Hidden (`getCampuses`), the way Numbers already does it.

**Later:** one triage inbox (every waiting item, oldest first, with age); list-and-detail layouts on desktop; a sidebar at `wide:` with counts; search on Every shop and Staff; audit entries that link to their subject; bulk actions on desktop only.

---

## Mentor

**What exists:** `/mentor` is a table of my shops (Campus, Badge, 14-day Enquiries, Replied in 48h, Sales, Flags) sorted **A to Z**, with a CSV export. `/mentor/[slug]` has facts, flags with reasons, the notes and check-ins history, then the Add note and Add check-in forms. Flags: no enquiries in 14 days, slow replies, paused.

**Clicks:**

| Job | Today | Note |
|---|---|---|
| Which shop needs help today | 2 + scanning | Flags are the last column of an A to Z list |
| Write a note or check-in | 3 + a long scroll | The forms sit under the whole history (~6,300px at 390px with two notes) |
| Answer a slot request | 3–4 | Only the post's author is told; the queue sits under the posts table |
| Post a tip | 4–5 | |
| Export | 3 | |

**Problems, by impact:**
1. **No triage:** A to Z order, flags at the far right, reasons only on the shop page, no "N shops need you".
2. **No last check-in date** on the dashboard, so neglected shops are invisible.
3. **Slot requests are invisible** to every mentor except the post's author.
4. **History above the forms** on the shop page, and it gets worse with every note.
5. **Assignment is silent:** `assignMentor` notifies no one.
6. "Paused" doesn't say who paused it; a shop with no listings is flagged "No enquiries".

**Easiest wins:**
- **S** Sort flagged shops first (both backends' `mentoredShops`), and add a summary: "2 of 6 shops need attention".
- **S** Show each flag's reason (`FLAG_WORDS[flag].explanation`) on the dashboard, and "Paused by the Hub / by the seller" (`pausedBy`).
- **S** "3 slot requests waiting" on `/mentor`, linking to `/hub/manage#hub-queue` (`openBookingCount`). Move the queue above the posts.
- **S** Put the two forms first on the shop page, or add jump links (the anchors already exist).
- **S** Notify the mentor when a shop is assigned (`notify()` in `assignMentor`).
- **M** Add a "Last check-in" column from a new `lastCheckIns(ownerIds)` reader. It shows the date only, never the note, only for rows `mentoredShops` returns (so an admin who sells never sees their own), and never reaches the seller. Optionally add a "No check-in in 30 days" flag.

**Later:** a next check-in date and a "Due this week" section; a trend against the previous 14 days (and one batched counts query instead of one query per shop); more flags (no available listings, stale listings); claiming slot requests per mentor or campus; a seller-visible action plan kept apart from private notes.

---

## Research: the patterns that fit CampusCart

1. **One account, role-aware navigation; staff in their own areas** with their own service navigation. NN/g found role-based personalisation works and audience-picking menus don't; GOV.UK service navigation is the model for staff.
2. **Seller home = "needs you now", then 3–4 numbers** (Etsy Seller app Home, Uber Eats Manager). CampusCart's numbers stay enquiries, replies, sales and followers: no views.
3. **A new-seller setup checklist** with status tags and a direct "Add a listing" (Polaris setup guide, GOV.UK task list, NN/g empty states).
4. **Listings as a status list,** with per-item actions on the detail page on phones (Polaris).
5. **A buyer activity page:** open conversations and requests first, then Saved and alerts, with icon-plus-label links (Baymard: 78% of sites miss paths from the account dashboard).
6. **At most 5 bottom tabs;** badges as a dot or a capped count, cleared on visit (Apple HIG, Material 3). Vinted folds notifications into Inbox to save a tab.
7. **Admin queues as link-based views** (Oldest first, Most reported, by campus) with an age chip per row (Zendesk views and SLA columns, Reddit mod queue).
8. **Single actions through a confirm page plus an audit entry;** bulk actions on desktop only (NN/g bulk actions).
9. **Mentor caseload sorted by "needs attention", then days since the last check-in,** with the next action shown (caseworker dashboards: Cúram, Wisconsin's worker dashboard).
10. **Plain-link sub-tabs (no scrolling carousels), back links in flows, breadcrumbs only in staff hierarchies, and `<details>` only for secondary content** (NN/g tabs and mobile sub-navigation, GOV.UK).

Sources: nngroup.com (personalization, audience-based navigation, empty states, dashboards-preattentive, tabs-used-right, mobile-subnavigation, bulk actions); baymard.com (current state of accounts self-service; icons in account dashboard); developer.apple.com HIG tab bars; m3.material.io navigation bar and badges; design-system.service.gov.uk (navigate a service, breadcrumbs, back link, task list); polaris-react.shopify.com (index table); changelog.shopify.com (home metrics, tablet navigation); etsy.com seller handbook (Etsy Seller app); merchants.ubereats.com (Uber Eats Manager); vinted.com help; arxiv.org/html/2509.07314v1 (moderator practices); Zendesk views and SLA guides (third-party); Cúram and Wisconsin DCF caseworker dashboards. The Airbnb mode-switch details come from community posts only (unverified).

---

## Part 2: components, charts and navigation (research, 2026-10-22)

Four more passes: what today's apps put on their dashboards, charts on small screens, smooth navigation with no added JavaScript, and what CampusCart's own kit already has.

### What the kit has today
- **To build on:** `StaffFrame` (shell + section nav), `LinkTabs` (tabs or chips as links), `StaffTable` (a real table on `wide:`, label/value cards on phones), the `.btn*` set, `.status-pill`, skeletons, `ConfirmAction`, native `<dialog>` sheets (`useOverlayDialog`), `<details>`, scroll-snap rails, toasts.
- **Missing:** any chart, meter or progress bar (none in the app; `AdminNumbers` says "no charts" on purpose); a shared stat tile (`.sell-numbers` and `.staff-counts` are two copies); trend arrows; success and warning colours (only `danger`); a generic empty state, list row and section header; alert, info, calendar and download icons; dark mode (none).

### Components to adopt (every one server-rendered, no client JS)

| Component | Seen in | Use in CampusCart |
|---|---|---|
| **"Needs you" queue**: rows with a count and an age chip ("2d"), most urgent first, tap opens the item | Airbnb Today, Meta Seller app (2026), Etsy Top tasks, Linear inbox | Top of the seller, admin and mentor homes |
| **Stat tile with delta chip**: label, big number, "↑ 3 on last week" (arrow + sign + word, never colour alone); the whole tile links on | Shopify metrics card, Uber Eats Manager | Seller numbers, admin numbers, mentor shop page |
| **Setup checklist**: "2 of 5 done", a bar, ticked steps, the next one open with one button | Shopify setup guide, GOV.UK task list | New sellers until the shop is complete; badge progress ("what Trusted needs") |
| **List row**: thumbnail or initials, title, one line, status pill, meta, chevron; one 56px link | Apple inset lists, Polaris resource list | My listings, inbox, caseload, queues |
| **Segmented control as links** (2–5 views, `?view=`) and **filter chips** beyond that | Android/Material, Zendesk views | My listings states, Open/Closed requests, admin campus filter |
| **Activity feed**: grouped by Today / Yesterday / This week, repeats collapsed ("3 new enquiries on Desk lamp") | Linear, Airbnb | Notifications, mentor notes and check-ins, audit log |
| **Empty state**: icon, action title, one line, one primary button | Polaris, NN/g | Every empty tab and queue |
| **Inline banner**: tinted panel, icon, one sentence, one link | Airbnb alerts | "Your request closes in 2 days", "Paused by the Hub" |
| **Shop identity header**: initials/photo, name, campus, badge, followers | Most marketplaces | Seller dashboard top, storefront |
| **Sticky primary action** (full-width button or bottom bar, not a FAB, which fights the tab bar) | Material/Fluent guidance | New listing; Approve on a review page |
| **Action sheet** as a `popover` (no JS, ~94% support), confirm page as the fallback | Apple HIG | A listing row's Mark sold / Pause / Delete |

Leave out swipe actions (they need JS, and every swipe would need a visible twin anyway), streaks that punish, and view counts (by design).

### Charts

The rules from NN/g, GOV.UK's Analysis Function, Tufte and WAI: bars, sparklines, progress and bullet bars, and deltas work on a phone. Avoid pies and donuts, stacked bars with many parts, dual axes, legends and dense line charts.

**Five server components** (`components/charts/`, guarded with `server-only`, so 0 bytes of client JS; about 0.3–2 KB of HTML each):

| Component | Shows | Where |
|---|---|---|
| `StatDelta` | Big number + arrow + signed change + word; "Can't compare" when a week is hidden | Every role's numbers |
| `Sparkline` | 7/14/30 daily points, 96×24, 2px navy line, gaps for missing days, value in HTML beside it | Seller enquiries per day; mentor's shops as small multiples on one scale |
| `BarList` | Horizontal HTML/CSS bars with the value at the end; each row a 44px link | Admin counts by campus; mentor's shops compared |
| `RatioBar` | "12 of 15 replied within 48h", a fill plus an optional target tick | Seller reply rate and badge progress; mentor reply rate |
| `SplitBar` | One stacked bar of listing states, labels underneath, 2px white gaps | Seller dashboard only |

Buyers get counts, not charts: their data is too thin to chart.

**Chart rules:**
- Each chart sits in a `<figure>` with a visible one-sentence takeaway, plus a "Show the numbers" `<details>` table when it has more than 3 values. `role="img"` and a label go on the figure.
- Bars start at 0.
- Labels are HTML text (`font-text`, 14px or more), never inside a stretched SVG.
- With fewer than 2 points, or values of 3 or under, write the numbers instead of a chart.
- **Contrast for marks (3:1):**
  - Navy (13:1) and sky-dark (4.7:1) carry data.
  - Sky (2.6:1) and idle (1.8:1) fail, so they may only be tracks or decoration next to a printed value.
  - Navy next to sky-dark is 2.8:1, so adjacent parts need a 2px white gap.
- **Masked counts** (`protectCounts`):
  - never drawn as 0 or joined across;
  - a hatched outline with the word "Hidden" or "Under 5";
  - deltas say "Can't compare";
  - an exact total says so ("Total 23 · 2 campuses hidden").
- Charts are static. Any grow-in is `scaleX` only, and off under reduced motion and data saver.
- New tokens needed: a success green and a warning amber (contrast-checked) for delta chips and pills. Each is always paired with an arrow or word.

### Navigation and motion (Next 16.4, React 19.3, as installed)

Ranked by value for cost:

| # | Technique | JS | Support | Where |
|---|---|---|---|---|
| 1 | CSS `:active` press feedback on tabs, rows and buttons | 0 | all | everyone |
| 2 | **A tab bar per section**, server-rendered in `app/sell/layout.tsx`, `app/admin/layout.tsx` and `app/mentor/layout.tsx` (Overview · Listings · Messages · Shop for sellers; a way back to CampusCart in each) | 0 | all | seller, admin, mentor |
| 3 | Sticky sub-nav chips with `scroll-margin-top` anchors | 0 | all | dashboards, admin queues |
| 4 | Scroll-snap rails with a peek of the next card | 0 | all | home, storefront, Hub |
| 5 | **React `<ViewTransition>`**, already inside react-dom: header and tab bar held still, a crossfade on tab switches, a short slide on `<Link transitionTypes={['nav-forward']}>`; all off under reduced motion and data saver | ~0 | ~93% (iOS 18+) | everyone |
| 6 | `popover` + `@starting-style` action sheets and menus | 0 | ~94% (iOS 18.3+) | buyer, seller |
| 7 | Skeleton → content crossfade with `<ViewTransition>` | ~0 | as 5 | listing, messages |
| 8 | `useLinkStatus` in the existing `NavLink`, a delayed pending dot | a few hundred B (to measure) | all | tab bar on slow networks |

Notes and limits:
- Next already keeps scroll position, open `<details>` and form drafts when you go back (Activity), so nothing is needed for that.
- Thumbnail-to-photo morphs only pair when the link prefetches, and decision 53 keeps most links unprefetched. Skip morphs, or use them only on prefetched links.
- Browser Back carries no direction, so it gets the crossfade, not the slide.
- Avoid: `blur`/`filter` keyframes, width/height animation, many `view-transition-name`s (memory on cheap phones), custom pull-to-refresh, `command`/`commandfor` or `closedby` on their own (iOS gaps).
- Cross-document `@view-transition` only helps the 303 sign-in and sign-out loads.

Sources for part 2: shopify.dev App Home (metrics card, setup guide, onboarding); polaris.shopify.com (empty state); airbnb.ca redesigned reservations (May 2026); about.fb.com Seller app (July 2026); merchants.ubereats.com (Manager, June 2025 update); docs.stripe.com/dashboard/mobile; linear.app/docs/inbox; support.strava.com progress chart; blog.duolingo.com streak milestones; developer.apple.com HIG (action sheets, sheets, charting data, tab bars); developer.android.com segmented button; fluent2.microsoft.design; nngroup.com (choosing chart types, dashboards-preattentive, skeleton screens); analysisfunction.civilservice.gov.uk (data visualisation, symbols in tables); service-manual.ons.gov.uk; datawrapper.de mobile charts; edwardtufte.com sparklines; chartability.fizz.studio; tpgi.com SVG accessibility; w3.org WAI (non-text contrast, complex images); caniuse.com (view-transitions, popover, starting-style, scroll timelines, invoker commands, closedby); the installed Next docs (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`, `preserving-ui-state.md`, `link.md`, `05-server-and-client-components.md`).
