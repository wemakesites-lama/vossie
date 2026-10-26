# Wayfinding: breadcrumbs, back links and one Hub console nav: design

Date: 2026-10-26 · Status: built (decision 91), after the calm navigation work (`2e01a3c`). Section 7 lists what the build changed.

## 1. What Lama asked for

1. A back link and breadcrumbs on every screen, so moving around is easier and smoother.
2. The Hub console's navigation is unclear and doesn't say what each part is for. Clicking Audit log "changes into a better UI", and other pages don't. Move away from the pill navigation.

Lama's answers (2026-10-26):

- A back link goes to **the page above** (a report to Reports), not browser history.
- The console's **filters leave pills too**: a labelled dropdown and a Filter button.
- Build **after** the calm navigation session's work is committed.

## 2. What's wrong today

**Two navs for one console.** Every staff page renders `StaffFrame`'s row of 11 pills (`STAFF_SECTIONS`). Under `app/admin/` the layout also renders `AdminBar` (a sidebar from the tablet step, a bottom bar on phones), and CSS hides the pills there (`.section-shell:has(.section-bar) .staff-nav`). The Hub's staff pages (`/hub/manage`, `/hub/new`, `/hub/[id]/edit`) aren't under `app/admin/`, so they get no bar and the pills come back. That's the jump Lama saw: Audit log is under `/admin`, Hub posts isn't.

A second jump: an admin who opens Mentoring lands on `/mentor`, whose layout swaps the console's sidebar for the mentor bar.

**The sidebar doesn't say what's where.** Five tabs (Today, Shops, Reports, Hub, More); six sections hide behind More with no hint of what they're for.

**Back links are scattered.** About 20 components write their own "Back to…" link, each placed and worded differently. No page has a breadcrumb. Pages with no back link (a shop's review page, a report, Hub post editing, Notifications) leave only the browser's Back.

## 3. Design

### 3.1 Breadcrumbs and the back link: one component, `Trail`

- **One Server Component, `components/ui/Trail.tsx`,** at the top of the page's content, above the eyebrow and title. No client code.
- **Phone (below `wide:`):** one link, `‹ {parent}` ("‹ Reports"). Sky-dark on white, at least 44 px tall, left-aligned. It's the standard phone pattern and takes one line.
- **From `wide:`:** the full trail, `CampusCart / Hub console / Reports / Report on Tech corner`. Every crumb but the last is a link; the last is plain text with `aria-current="page"`. Long names truncate with an ellipsis; the last crumb wraps rather than hides.
- **Markup:** `<nav aria-label="Breadcrumb"><ol>…</ol></nav>`. The phone's back link is the same `ol`'s parent item shown alone (CSS), so there's one set of links in the page, not two.
- **Links:** `prefetch={false}` (decision 53), and the calm navigation's `nav-back` transition type on the back link (`BACK` from `lib/motion.ts`, if that work landed it; otherwise none).
- **Where it goes:** every page except the top-level destinations, which are the places the tab bars open: Home, Browse, Saved, Messages, You, Hub, Looking For, Sell's overview, the console's Today, and the mentor's caseload for a mentor without the admin role. Sign-in keeps its own return link.
- **Replaces** the scattered "Back to…" links at the top of pages. Links that are the result of an action (Report sent's "Back to the listing", Coming soon's "Back to the homepage") stay: they're the page's next step, not navigation.

### 3.2 One map of parents: `lib/nav/trail.ts`

- **A static map from route to parent** (`"/admin/reports/[id]": "/admin/reports"`) and each fixed route's label. Dynamic labels (a shop's name, a report's subject, a listing's title) are passed by the page, which already reads them.
- **`trailFor(route, names)`** returns the crumbs. Pages call it; nothing works out a parent from the URL string.
- **A guard test** reads `app/**/page.tsx` and fails for any route that is neither in the map nor listed as top-level, so a new page can't ship without a back link.
- **Role-aware where it must be:** `/hub/manage` and `/mentor` sit under Hub console for an admin and are top-level for a mentor (they have no console). The page passes the viewer's roles.

The parents (summary; the plan has the full table):

| Pages | Parent |
|---|---|
| Your details, privacy, requests; Notifications | You |
| Collections, info pages (How it works, Safety, Trust, Terms, Privacy, Seller guidelines) | Home |
| A listing; a shop | Browse |
| Message a listing or shop | That listing or shop |
| A Hub post; its booking | Hub; the post |
| A request; offer, edit, delete | Looking For; the request |
| A thread | Messages (the Selling tab when it's a selling thread) |
| Your listings, Shop profile, Onboarding | Sell |
| New, edit, delete a listing | Your listings |
| Report | Its subject (listing, shop or request) |
| Console sections (Shops, Reports, Hidden, Featured, Pickup points, Last week, Staff, Audit log, Posts and office hours, Mentoring) | Hub console |
| A shop's review; decline, pause | Shops; the shop |
| A report; hide, pause | Reports; the report |
| Show again (listing, request) | Hidden |
| Remove a role | Staff |
| Write or edit a post | Posts and office hours |
| A mentored shop | Mentoring |

`/admin/more` stays as the phone's More page; it isn't a breadcrumb level (desktop never shows it).

### 3.3 The Hub console: one nav everywhere

- **`StaffFrame` loses its pill row** and `STAFF_SECTIONS` goes. The frame keeps the heading, a purpose line and the notice.
- **The same bar on every console page.** The Hub's staff pages get a layout each (`app/hub/manage/layout.tsx`, `app/hub/new/layout.tsx`, `app/hub/[id]/edit/layout.tsx`) rendering `StaffBar`: the admin bar for an admin, the mentor bar for a mentor. `/mentor` does the same, so an admin keeps the console's sidebar there with Mentoring current. Addresses don't change.
- **Desktop and tablet: a grouped sidebar** with every section, each group named:
  - **Needs you:** Today, Shops, Reports, Hidden (badges as today)
  - **Hub:** Posts and office hours (slot badge), Mentoring
  - **Insight:** Last week, Audit log
  - **Set up:** Featured, Pickup points, Staff
  - then "Back to CampusCart"
- **Phone: the bottom bar stays at five tabs** (Today, Shops, Reports, Hub, More), since eleven don't fit. More becomes the same four groups as rows, each with its one-line purpose.
- **`SectionBar` gains groups** (`groups: { label, tabs }[]`): on phones it renders only the tabs marked `phone`, from the tablet step every group with its heading. Seller and mentor bars keep one unnamed group, so they don't change.
- **Every console page says what it's for.** One line under the title, from the same words as the More rows (Shops: "Approve new shops and pause ones that break the rules"). `StaffFrame`'s `lede` becomes required.
- **The section titles match the nav.** "Hub posts" becomes "Posts and office hours" in both places; "Staff accounts" and "Staff" become "Staff".

### 3.4 Filters: dropdowns, not pills

- **Audit log** (staff member, kind) and the **campus filter** (Shops, Reports, Hidden; Last week has its own campus links) become a GET form: a labelled `<select>` per filter and a "Filter" button. No JavaScript; the filter stays in the address, so it can be shared and Back works.
- **The chosen filter is said in words** above the list ("Showing Pretoria · Everyone · Every kind", with a "Clear" link when anything is chosen).
- **The readers don't change:** `readCampusFilter` and the audit's filter parsing already read the query, and an unknown value still means "all".
- Shared with the public pages: nothing. Browse's filters and Saved's tabs are out of scope.

## 4. Accessibility (WCAG 2.2 AA)

- Breadcrumb: `nav` named "Breadcrumb", an ordered list, `aria-current="page"` on the last crumb, the separators `aria-hidden`.
- The back link's accessible name says where it goes ("Back to Reports"); the visible text is "Reports" beside the chevron.
- Sidebar group headings are text in the `nav` (`h2` styled small) so screen readers can jump between groups.
- Filter selects have visible labels; the Filter button is 44 px.
- Focus order: trail, eyebrow, title, content. The sidebar stays after the content in source order (as now).

## 5. Cost and risk

- **JS:** 0 B. `Trail`, `StaffBar` and the filter forms are Server Components; `NavLink` is already in every page's chunk.
- **HTML:** a breadcrumb is about 300 to 500 B per page before compression.
- **Layout shift:** the trail is in the static shell where the page's title is, so it arrives with the frame. Skeletons gain a trail-height line so they don't jump (`StaffSkeleton`, `SellSkeleton`, `YouSkeleton`, `PageFallback`'s spacing). The skeleton-height and `cls.spec.ts` guards keep running.
- **Tests that name the pills** (`staff-parts.test.tsx`, the role views and staff e2e specs that click a pill) move to the sidebar or More.

## 6. Tests

- **Unit:** `trailFor` for each kind of page, including role-aware ones; the guard that every page has a parent or is top-level; `Trail`'s markup (one `ol`, `aria-current`, back link name); `SectionBar` groups on phone and tablet; the filter forms keep the query.
- **E2E (device projects, 390 and 1440):** a back link on a sample of deep pages leads to the parent; the console's sidebar is identical on `/admin/audit`, `/hub/manage` and `/mentor` for an admin; no pill nav on any staff page; the audit and campus filters work with a select; axe; layout shift.

## 7. Changes made during the build

- **The first crumb is "Home", not "CampusCart",** and fixed sections use the tab bars' words ("Shop" for `/browse`, "Hub", "Sell"). On a phone the back link reads "‹ Home", which is clearer than "‹ CampusCart".
- **Pages that already had a category breadcrumb keep the category** (a listing's, a request's, a Hub post's feed), through `trailFor`'s `between`: "Home / Shop / Tech / Casio fx-991ZA Plus calculator", so the phone's back link is "‹ Tech".
- **A hidden request's edit and delete pages** go back through Your requests (its page is gone), through `names` and `hrefs`.
- **Mentoring** is titled "Mentoring" with the console's eyebrow ("Hub console" for an admin, "Hub tools" for a mentor), as the Hub's tools are; `STAFF_EYEBROW.mentor` went. The tab titles follow the new names: "Posts and office hours", "Staff", "Mentoring".
- **The sidebar's long names wrap** ("Posts and office hours" with its badge), and the console's sidebar scrolls on its own when it is taller than the screen.
- **`StaffSkeleton` has the trail's line**, and Today, which has no trail, renders `<StaffSkeleton trail={false} />`.
- **`auditPath`, `campusFilterTabs` and `campusFilterPath` went** with the pills, and so did the old crumb styles (`.msg-crumb`, `.account-crumb`, `.sell-crumb`, `.listing-crumbs`) and `.staff-nav`.
