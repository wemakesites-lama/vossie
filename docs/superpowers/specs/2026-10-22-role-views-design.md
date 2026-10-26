# Role views: a focused home for each role (design)

**Date:** 2026-10-22 · **Status:** design approved section by section by Lama in the brainstorm; waiting for Lama's review of this document · **Stages:** N1 to N5

**Background:** `docs/reference/ROLE-VIEWS-AUDIT.md` (the audit of every role's screens, and the research on components, charts and navigation). Mockups: `.superpowers/brainstorm/24320-1792672761/content/role-homes-v1.html` (untracked).

---

## 1. Why

The team wants each role to have its own focused experience: buyers, sellers, admins and mentors. Every screen already exists, but:

- each dashboard reports on the past instead of saying what needs doing now;
- daily tools (Messages, Notifications, Your requests, the staff areas) sit behind the Account page, below the Edit details form;
- every action lands back on a list instead of on the next thing to do;
- everyone gets the same bottom bar.

The dashboards are also almost all text: there are no charts, meters or trend arrows anywhere in the app.

**Goal:** each role opens on a home that answers "what needs me now?", followed by a few honest numbers and small charts. The role's bottom bar holds its own tools. Navigation feels smooth. All of it stays inside the first-visit JavaScript budget.

## 2. Lama's decisions (2026-10-22)

| # | Question | Decision |
|---|---|---|
| 1 | How are multi-role accounts handled? | **Workspaces.** One account. The buyer app is the default. Entering `/sell`, `/admin` or `/mentor` puts you in that area's own workspace, with no mode to remember (research: role-based navigation beats audience-picking). |
| 2 | How is the work split? | **Kit first, then role by role:** N1 kit, N2 seller, N3 admin, N4 mentor, N5 buyer. Each stage ships and is reviewed on its own. |
| 3 | What does the bottom bar do inside a section? | **It swaps** to the section's own bar, with an Exit back to CampusCart. On desktop it becomes a left sidebar. |
| 4 | What is the buyer's hub? | **"You" replaces Account.** `/account` becomes the activity hub. The URL is unchanged. |
| 5 | Direction | The four mockups (seller, buyer, admin, mentor) were approved as the direction. |

## 3. What stays true (constraints)

- **Smooth, functional, fast (Lama, 2026-10-22):** every page stays inside the first-visit JavaScript budget (150 KB brotli, homepage spec section 11; 150,661 B at `88ba438`), and the numbers are measured and recorded each stage. Small client costs are fine when they buy function, accessibility or smoothness; nothing is dropped only to keep bundles byte-identical. Server Components stay the default.
- **Privacy (POPIA):**
  - no view counts;
  - a shop sees only how many follow it;
  - Looking For requests never name the asker;
  - mentors' notes never reach the seller, and an admin who sells never sees notes about their own shop;
  - the admin's private counts only through `protectCounts`;
  - every account-scoped reader filters by the signed-in account.
- **Brand:**
  - sky never carries text, icons or thin lines on white (2.6:1);
  - data marks are navy (13:1) or sky-dark (4.7:1);
  - sky only as a solid pill with navy text, or as a track next to a printed value;
  - fonts only through `font-display`, `font-text` and `font-accent`;
  - icons only from `components/icons.tsx`.
- **Both backends:** every new reader has a sample-store version and a Supabase version, with a contract test that runs the same scenarios on both.
- **House rules:**
  - `<Suspense>` around anything that reads the session;
  - staff links never prefetch;
  - no `Date.now()` while prerendering;
  - ages and dates in SAST, worked out at request time;
  - touch targets 44px or more;
  - motion only on `transform` and `opacity`, off under reduced motion and `html[data-low-data]`;
  - `wide:` and `desk:`, never `md:` or `lg:`.

## 4. Structure (stage N1)

### 4.1 Section bars

- New `app/sell/layout.tsx`, `app/admin/layout.tsx` and `app/mentor/layout.tsx` each render a server `SectionBar` (`components/kit/SectionBar.tsx`) with `className="section-bar"`.

  | Section | Tabs |
  |---|---|
  | Sell | Overview `/sell` · Listings `/sell/listings` · Messages `/messages?tab=selling` · Shop `/sell/profile` · CampusCart (Exit, `/`) |
  | Admin | Today `/admin` · Shops `/admin/sellers` · Reports `/admin/reports` · Hub `/hub/manage` · More `/admin/more` |
  | Mentor | Shops `/mentor` · Office hours `/hub/manage#hub-queue` · Posts `/hub/manage` · Export `/mentor/export` · CampusCart (Exit, `/`) |

- **Admin's More** is a new server page at `/admin/more`. It lists Hidden, Featured, Pickup points, Staff, Numbers and the Audit log as `ListRow`s, each with its count where one exists.
  - `more` joins `RESERVED_SLUGS` if any `[slug]` route sits beside it. It doesn't today, and the folder test checks.
- **Hiding the main bar:** the root `TabBar` stays in `app/layout.tsx`. CSS hides it when a section bar is on the page: `body:has(.section-bar) .tabbar { display: none; }`.
  - Where `:has` isn't supported (about 7% of phones), both bars show. The section bar sits above the main bar, so both are usable.
- **Slim footer:** the same rule hides the marketing footer's blocks (Shop your campus, Start selling, newsletter, wordmark) on section pages. Only the legal links and the campus line stay.
- **Desktop (`desk:`):** the section bar becomes a sticky left sidebar (icon + label + count) beside the page column. On staff pages, `StaffFrame`'s pill row shows only between `wide:` and `desk:`, and is hidden on phones, where the bar replaces it.
- **Pages outside the folders:** `/messages` and `/hub/manage` keep the main bar when reached from a section bar. This is accepted for N1 to N5; bringing them under the section bars is in §11.
- **Tab-bar rules carried over:**
  - `aria-label` is "Selling", "Hub console" or "Mentoring";
  - `aria-current` comes through `NavLink`;
  - only the Overview, Today and Shops tabs may prefetch, and only when their route has no client component; everything else uses `prefetch={false}`.

### 4.2 Badges

- Each badge comes from the same reader that builds the list it links to (§6), so the number always equals the list's length. A unit test checks this for every badge.
- Badges are read inside `<Suspense>`, never cached. When a read fails, the badge shows nothing, never a guess.
- A count is capped at "99+". It has `aria-describedby` words ("2 buyers waiting"), as the Saved tab does today.

### 4.3 "You" in the main bar

- The Account tab's label becomes "You", with the User icon.
- Its badge counts the For you items (§7.4) in place of the notifications count. It is decided in N1 and filled in N5; until then it keeps the notifications count.

### 4.4 Page transitions

- Every page under the three section layouts, plus `/account`, wraps its content in React's `<ViewTransition>`. It is already in `react-dom`, so it adds about 0 bytes, but N1 measures this (§9).
- **Tab switches crossfade** (opacity only).
- **Going deeper slides:** links one level deeper (a queue row, a list row) pass `transitionTypes={['nav-forward']}` for a 12px horizontal slide plus a fade, 200ms.
- ~~Browser Back has no direction, so it crossfades.~~ React never animates browser Back (it skips popstate).
- Amended by `2026-10-26-calm-navigation-design.md` (decision 90): every page, `nav-back`, an untyped page change crossfades, and Suspense reveals fade through `Reveal`.
- The header, the main bar and the section bar have their own `view-transition-name` with `animation: none`, so they never move.
- `::view-transition { pointer-events: none; }` stops a tap from being lost during a transition.
- Under `prefers-reduced-motion` or `html[data-low-data]`, every view-transition pseudo-element has `animation: none`.
- **Not used:**
  - shared-element morphs (they only pair on prefetched links, and decision 53 keeps most links unprefetched);
  - `blur` and `filter` keyframes;
  - animating width or height;
  - cross-document `@view-transition`.
- N1 measures what `<ViewTransition>` costs and records it. Transitions stay as long as every page stays inside the budget.

### 4.5 Press feedback

- Tabs, rows, tiles and buttons get a CSS `:active` state: `scale: 0.98` and opacity 0.85, for 100ms.
- It is off under reduced motion and data saver.

## 5. The kit (stage N1)

Everything here is a Server Component. Chart modules `import "server-only"`. Every part has a unit test next to it, covering its empty, zero, masked and low-data states.

### 5.1 Tokens and icons (`app/globals.css` `@theme`, `components/icons.tsx`)

| Token | Value | Tint token | Checked contrast |
|---|---|---|---|
| `--color-success` | `#14663A` | `--color-success-tint` `#E3F4EA` | 7.02 on white, 6.15 on tint, 6.33 on panel |
| `--color-warning` | `#7A4A00` | `--color-warning-tint` `#FDF1DC` | 7.48, 6.69, 6.74 |
| `--color-danger` (exists) | `#B42318` | `--color-danger-tint` `#FDE7E5` | 6.57, 5.55, 5.92 |

- **Status colours are never the only signal:** each comes with an arrow, a sign or a word.
- **Shadow and spacing tokens:**
  - `--shadow-card`: one soft shadow;
  - `--space-card`: 12px on phones, 16px from `wide:`;
  - card radius reuses `--radius-card`.
- **New icons:** Alert, Info, Calendar, Download, Chart, plus ArrowUp and ArrowDown for deltas. All follow `IconProps`.

### 5.2 Building blocks (`components/kit/`)

| Component | Props (summary) | Behaviour |
|---|---|---|
| `Card` | `title?`, `count?`, `action?: {label, href}`, `tone?` | White card on the panel background. Its title is a `SectionHeader` (h2 or h3, given by the caller). |
| `SectionHeader` | `title`, `level`, `count?`, `action?` | The action is a "Manage ›" text link in sky-dark. |
| `NeedsYouList` | `items: {count, title, detail?, age?: {label, tone}, href, urgent?}[]`, `allClear` | Each row is one link at least 44px tall: count circle (navy if `urgent`, else pale), title and detail, age chip, chevron. When every count is 0, it shows one "All clear" line with a Check icon. Zero rows are hidden unless the caller asks to keep them. |
| `StatTile`, `StatRow` | `label`, `value: number \| "hidden" \| "under5"`, `delta?`, `href?` | Replace `.sell-numbers` and `.staff-counts`. On phones, three tiles share one row. When `href` is set, the whole tile is a link. The number uses tabular figures in the display font. |
| `ListRow` | `href`, `lead: {kind: "thumb"\|"initials"\|"icon", …}`, `title`, `detail?`, `pill?`, `meta?` | One link at least 56px tall, ending in a chevron. A thumbnail uses the existing `Thumb` and respects data saver. |
| `SegmentedLinks` | `items: {label, count?, href, current}[]` | 2 to 4 links styled as a segmented control, built on `LinkTabs` with a new `look: "segmented"`. Each segment is at least 44px tall. |
| `Pill` | `tone: neutral \| info \| success \| warning \| danger \| live`, `children` | Replaces the scattered pill styles. `live` is solid sky with navy text. |
| `Banner` | `tone`, `icon`, `children`, `action?` | A tinted panel with one sentence and at most one link. |
| `EmptyState` | `icon`, `title`, `line`, `action` | One primary button. The icon is decorative. |
| `Feed` | `groups` grouped into Today, Yesterday and This week (SAST) | Repeats are collapsed by the caller ("3 new enquiries on Desk lamp"). Used from N4 onward. |
| `SetupChecklist` | `steps: {label, done, href}[]` | "2 of 5 done", a `RatioBar`, the steps as an `<ol>` with ticks, and the next step's link as the primary button. Each step completes itself from data; nothing is stored. |

### 5.3 Charts (`components/charts/`)

Every chart sits in a `<figure>` with a visible takeaway sentence (`figcaption`). Any chart with more than 3 values also has a `<details>` "Show the numbers" table.

| Component | Data | Drawing |
|---|---|---|
| `StatDelta` | `now`, `previous`, `unit?`, `masked?` | "↑ 3 on last week", "↓ 1 on last week" or "= same as last week", using an ArrowUp or ArrowDown icon with the success or danger colour. "Can't compare" when either value is masked or missing. |
| `Sparkline` | `points: (number \| null)[]`, `label`, `summary` | Inline SVG (`viewBox`, width 100%, `preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`). A 2px navy line, a final dot, and the last value printed in HTML beside it. `null` breaks the line, with open circles at the gap's edges. |
| `BarList` | `rows: {label, value: number \| "hidden" \| "under5", href?}[]`, `max?` | HTML bars (`--v` custom property), 12px tall, navy on a grey track, with the value printed at the end. A masked row is a dashed, hatched outline with the word "Hidden" or "Under 5". A row with `href` is a 44px link. |
| `RatioBar` | `done`, `total`, `target?`, `label` | "12 of 15 replied within 48h". An 8px sky-dark fill on a grey track, with a navy tick at `target`. `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext`. |
| `SplitBar` | `parts: {label, value, tone}[]` | One 10px bar in navy, sky-dark, muted and a hatched idle, with 2px white gaps. The labels and counts sit underneath in reading order; there is no legend. |

**Rules for all charts:**
- Bars start at 0.
- No motion.
- The SVG is `aria-hidden`; the figure carries `role="img"` and an `aria-label` that states the takeaway.
- With fewer than 2 points, or a maximum of 3 or under, the component writes the numbers as text instead.
- Never draw a masked value as 0, and never join a line across one.

## 6. New and changed data readers

Every reader runs at request time inside `<Suspense>`. Each has a sample version (`lib/data/…`) and a Supabase version (`lib/data/supabase/…`) with a contract test. Any Supabase function behind them gets pgTAP tests.

| Reader | Stage | Returns | Notes |
|---|---|---|---|
| `sellerQueue(slug, now)` | N2 | Counts and the oldest item for: unanswered enquiries (status `asked`, last message from the buyer), sales waiting to be marked sold, drafts, Hub-hidden listings, paused listings | One slim read. Offer threads are left out, as F's counting does. Also feeds the seller bar's Messages badge. |
| `recentCounts(slug, days, now)` + `previous` | N2 | Today's counts plus the window before | Extends the existing reader, so no second call. |
| `dailyEnquiries(slug, days, now)` | N2 | `(number \| null)[]` by SAST day | Days before the shop existed are `null`. |
| `dailyEnquiriesFor(slugs, days, now)` | N4 | A map from slug to series | One query for the whole caseload, replacing a query per shop. |
| `lastCheckIns(ownerIds)` | N4 | A map from owner to the latest check-in date | **The date only, never note text.** Called only with owners from `mentoredShops`, which leaves out the viewer's own shop. On Supabase it reads with the viewer's session, so `private.can_mentor` applies. A pgTAP test proves that a seller and an admin-who-sells get nothing about their own shop. |
| `listOwnBookings(accountId, now)` | N5 | Upcoming RSVPs and slot requests: post title, date, status | Filtered by account. Past items are left out. It joins the data download if bookings aren't already in it (check in N5). |
| `mentoredShops` (changed) | N4 | Sorted by flag count (most first), then days since the last check-in, then name | Changed on both backends. |
| `listBookings` (changed) | N3 | Open requests sorted oldest first | |

The admin's Today page uses `listShopsForReview`, `listReports`, `listBookings` and `countHidden` as they are, plus the existing numbers through `countByWeek` and `protectCounts`.

## 7. The four homes

### 7.1 Seller: `/sell` (N2)

The page order for a live or paused shop:

1. **Header card:**
   - shop name;
   - `Pill` live/paused, or "Paused by the Hub";
   - the badge;
   - "38 followers" (`countFollowers`, a number only).
2. **Needs you** (`NeedsYouList` from `sellerQueue`):
   - "Buyers waiting for a reply" with the oldest wait. The age chip turns warning at 24h, so the 48-hour badge rule is visible before it's missed. It links to the selling inbox.
   - "Sales to mark as sold" links to the thread.
   - "Drafts ready to publish", "Hidden by the Hub" and "Paused" each link to My listings on that tab.
3. **Buttons:** New listing (primary) and Messages (outline), side by side.
4. **Numbers:** a `StatRow` of Enquiries and Sales, each with a `StatDelta` against the previous 7 days, and Followers with "+N new this week": follows made in the last 7 days that still stand, from the follow's `createdAt` / `created_at`. An unfollow deletes its row, so a net change can't be known and isn't shown. This is a count only, never who.
5. **Chart:** "Enquiries, last 7 days", a `Sparkline` from `dailyEnquiries(slug, 7)`.
6. **Your badge:** a `RatioBar` of replies within 48h against the next badge's threshold, from the existing badge rules in `lib/selling/badges.ts`. The line under it says what the next badge needs.
7. **Listings:** a `SplitBar` of available, paused, sold and drafts, with "Manage ›".
8. **Pause my shop** at the bottom, as today.

**New shop:** while the shop has no published listing or has never replied, a `SetupChecklist` replaces the Numbers, Chart and Badge cards. Its steps are: shop photo, about, pickup point, first listing, first reply. The pitch, waiting and declined states stay as they are.

**Fixes in N2:**
- My listings uses `SegmentedLinks` that fit one line at 360px. Its rows are `ListRow`s.
- Delete becomes a text link set apart from the other actions. Mark sold is never next to Delete.
- Every empty tab is an `EmptyState` with a New listing button.
- After "Mark as completed" in a selling thread whose listing is still available, the thread shows a one-button form, "Mark {title} as sold", that calls `changeListingState`.
- The selling inbox's empty state gets a next step.
- Back links on the Delete page and on the owner's storefront ("Back to your shop").
- Seller page titles use "Your" throughout.

### 7.2 Admin: `/admin` "Today" (N3)

1. **Header:** "Today", with "7 waiting · oldest 3 days".
2. **Waiting, oldest first** (`NeedsYouList`): shops to approve, open reports, slot requests and hidden items.
   - Each row links **straight to the oldest item** (`adminSellerPath`, `adminReportPath`, `/hub/manage#hub-queue`, `/admin/hidden`) and shows its age. Waits over 2 days are warning.
   - "All clear" when nothing is waiting.
   - The badge-recalculation paragraph moves below the fold.
3. **Last week:** `StatTile`s with `StatDelta` (listings published, shops approved, reports), only through `protectCounts`. A masked value says "Hidden" or "Under 5", with "Can't compare". "Numbers ›" links to `/admin/numbers`.
4. **Listings by campus:** a `BarList`. Masked campuses are hatched.

**Fixes in N3:**
- Shop and report pages get a "Next waiting shop" or "Next open report" link: the first open item that isn't this one.
- Campus filter chips (`?campus=`) on Shops, Reports and Hidden, from `getCampuses()`. A link-only form, with no JavaScript.
- `/admin/numbers` keeps its tables and adds a `BarList` for each measure. Its title and navigation say "Last week".
- Staff lists people before the Give a role form.
- Names are made consistent: Shops (not Sellers), Hub posts, "Hub console" as the one eyebrow.
- Hidden's pages mark Hidden as the current page, not Reports.

### 7.3 Mentor: `/mentor` (N4)

1. **Header:** "Your shops", with "2 of 6 need you · 2 slot requests" (`openBookingCount`).
2. **Segments:** `SegmentedLinks` "Needs you (2)" or "All (6)" (`?view=all`). A shop needs you when it has any flag or a check-in is due.
3. **Rows:** `ListRow` with initials, the shop name, each flag's reason in words (`FLAG_WORDS[flag].explanation`), and a check-in chip ("Due" after 30 days with no check-in, else "9 days ago").
   - "Paused by the Hub" and "Paused by the seller" are told apart (`pausedBy`).
   - A shop with no available listings is flagged "No listings yet" instead of "No enquiries".
4. **Chart:** "Enquiries, 14 days", `Sparkline` small multiples, one per shop, on one shared scale, from `dailyEnquiriesFor`.
5. Export (CSV) stays as it is, reached from the bar.

**The shop page `/mentor/[slug]`:**
- the facts card;
- a `StatRow` comparing this 14 days with the previous 14;
- the **Add note and Add check-in forms**;
- then the notes and check-ins history as a `Feed`.

**Assigning a mentor:** `assignMentor` now notifies the mentor ("You're now mentoring {shop}", linking to the shop page). This is the only new notification in this spec. It reuses an existing kind if one fits; otherwise N4 adds a kind and its words.

### 7.4 Buyer: `/account` becomes "You" (N5)

1. **Header:** "Hi, {first name}" and the campus.
2. **For you** (`NeedsYouList`):
   - unread messages (`unreadCounts`), linking to `/messages`;
   - offers on my requests (`listOwnRequests` with `offerThreadCount`), linking to the request;
   - new saved-search matches and new listings from followed shops, from unread `search-match` and `new-listing` notifications (`getNotifications`).

   Showing these doesn't mark them read; opening Notifications still does. The You tab's badge is the sum of these counts.
3. **Banner:** when one of my open requests closes within 2 days ("Your request closes in 2 days"), linking to Your requests, using the existing reminder rule.
4. **Your stuff** (`ListRow`s):
   - Saved: listings counted from the `vossie_saved` cookie, so they're per device and the row says "on this phone"; shops from `listFollowedShops`.
   - Your requests: open and closed counts.
   - Saved searches: count, and whether alerts are on.
   - Hub bookings: from `listOwnBookings`.
   - Your shop: shown only to sellers, linking to `/sell`.
   - Staff tools: shown only to staff, linking to `/admin` or `/mentor`, with no prefetch.
5. **Settings:** Your details (the form moves to a new `/account/details` page), Privacy, Sign out.

**Fixes in N5:**
- Looking For joins the menu drawer and the header quick links.
- The board shows "Your requests (N open)" to signed-in askers (`countOpenRequests`).
- The dead `savedItemsBack` line is removed from both backends and from the context strip.
- The home context strip adds a notifications count line linking to Notifications.

## 8. Errors and edge cases

- A failed reader inside a home shows that card's `section-error` box. Other cards and both bars still work.
- A failed badge shows no number.
- An account with several roles sees the bar of the folder it's in. Anyone without the role gets the existing 404 view, and the section layout renders no bar for them: the bar sits inside the same `<Suspense>`, after the role check.
  - On `/sell`, the seller bar shows only to an account that has a shop: waiting, declined, live or paused. Signed-out visitors and students without a shop (the pitch and onboarding) keep the main bar, so its Sell tab stays the way in. A waiting or declined shop's bar shows Overview, Listings (for drafts), Shop and Exit, without Messages.
- Masked admin counts never become 0, never draw a joined line, and never produce an arrow.
- Every age chip and day boundary is in SAST, from `now` at request time.
- A shop with no history shows the setup checklist, never empty charts.

## 9. Testing and gates

- **Unit:** every kit and chart component (empty, zero, masked, low-data, long labels at 360px); every new reader; `mentoredShops`' new order; "badge equals list" for every bar badge; that `StatDelta` says "Can't compare" whenever either side is masked.
- **Contract and pgTAP:** the new readers on both backends. `lastCheckIns` returns no text and nothing about the viewer's own shop.
- **End to end (Playwright + axe) at 360, 390, 768 and 1440px:**
  - the section bar swaps in and the main bar hides;
  - Exit returns home;
  - desktop shows the sidebar;
  - every Needs-you row opens the right item;
  - no serious or critical axe issues;
  - `aria-current` is correct;
  - with reduced motion and with data saver, view-transition pseudo-elements compute `animation-name: none`.
  - Writes (mark sold from a thread, the mentor notification) go in `tests/e2e/role-views-writes.spec.ts`, in a new `role-views-writes` project that runs last, after `housekeeping-writes`. Every `browser.newContext(` in it says `serviceWorkers: "block"`.
- **Screenshots:** `tests/e2e/role-views-screenshots.spec.ts` (only with `SCREENSHOTS=1`), each home at 390 and 1440px, saved in `docs/progress/role-views/`.
- **Gates for every stage:**
  - first-visit JS on every page inside the 150 KB budget, each page's number recorded against the stage's baseline, and any page that grows by more than 1 KB explained in the progress entry;
  - layout shift under 0.05 at 390 and 1440px, and on 375×667 for short pages;
  - each home's skeleton no taller than its shortest state ("All clear" or the setup checklist);
  - each home's added HTML under about 8 KB before compression.

## 10. Rollout

| Stage | Contents | Visible change |
|---|---|---|
| **N1: the kit** | Tokens, icons, `components/kit`, `components/charts`, section layouts and bars, `/admin/more`, the desktop sidebar, the slim footer, view transitions, press states; the "You" label. The current dashboards swap their tiles for `StatTile` with no new data. | New bottom bars in the three areas, smoother navigation |
| **N2: seller** | §7.1, `sellerQueue`, `dailyEnquiries`, `recentCounts.previous` | The seller home |
| **N3: admin** | §7.2, `listBookings` order | The admin Today page |
| **N4: mentor** | §7.3, `dailyEnquiriesFor`, `lastCheckIns`, the assignment notification | The mentor caseload |
| **N5: buyer** | §7.4, `listOwnBookings`, `/account/details` | You |

Each stage gets its own plan in `docs/superpowers/plans/`, a plan review before code, test-first building, a code review, a progress entry and a decisions-log row. It is merged and committed only on Lama's go-ahead.

N1 also adds three rules to `CLAUDE.md`:
- the section-bar pattern and its `:has` rule;
- the chart rules (§5.3);
- "a badge counts from its list's reader".

## 11. Left out on purpose

These can each be a later spec:
- dark mode;
- swipe gestures;
- bulk admin actions;
- a separate `/activity` page;
- Saved listings stored with the account;
- claiming slot requests per mentor or campus;
- trends beyond the previous window;
- a seller-visible action plan;
- bringing `/messages` and `/hub/manage` under the section bars.

## 12. Open questions for Lama

1. **The warning thresholds:** an enquiry over 24h, a shop waiting over 2 days, a check-in due after 30 days. Do they suit the Hub?
2. **The setup checklist's five steps** (§7.1): add or drop any?
3. **Admin's fifth tab:** "More" (a list page). The alternative is Numbers there and the rest in a list.
4. **The sample words:** all new wording in this spec is a first draft.
