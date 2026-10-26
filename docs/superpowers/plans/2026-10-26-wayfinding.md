# Wayfinding: build plan

Spec: `docs/superpowers/specs/2026-10-26-wayfinding-design.md`. Status: built 2026-10-26 (spec section 7 has what changed).

## Before starting

- **Start only once the calm navigation work is committed** (`docs/superpowers/plans/2026-10-26-calm-navigation.md`). It edits the same ~60 pages (`Reveal`, `PageTransition`). Check with `git status` (its own call): if any page under `app/` still shows as modified and isn't ours, stop and ask Lama.
- If `lib/motion.ts` exists, the back link uses its `BACK`; otherwise no transition type.
- Testing: speed first (memory "Efficient testing"). Each task names its targeted run; the full device run is Task 7.
- Commits: one per task, only with Lama's go-ahead (memory "Controller commits").

## Decisions

1. **The trail is in the static shell** wherever the page's title is static. Pages whose trail needs a dynamic name (a shop, a report, a listing) render it inside their existing `<Suspense>` with the title, and their fallback reserves one trail line.
2. **Role-aware parents** (`/hub/manage`, `/hub/new`, `/hub/[id]/edit`, `/mentor`, `/mentor/[slug]`) take `account.roles`, which those pages already read after `requireStaff()`.
3. **`/admin/more` is not a crumb.** Its own parent is Hub console.
4. **Section names** (one list, `lib/staff/sections.ts`, replacing `STAFF_SECTIONS`): label, href, group, purpose line, icon, `phone` flag. The sidebar, More, `StaffFrame`'s lede and the trail all read it.

## Tasks

### Task 1: The parent map and its guard

- `lib/nav/trail.ts`: `TOP_LEVEL` (set of routes), `PARENTS` (route to parent route), `LABELS` (fixed route to label), `trailFor(route, { names, roles })` returning `{ label, href | null }[]` from CampusCart down.
- `lib/nav/trail.test.ts`: the guard (reads `app/**/page.tsx`, every route is in `TOP_LEVEL` or `PARENTS`); one case per row of the spec's table; the role-aware cases.
- Full parent table (route: parent):
  - `/account/details`, `/account/privacy`, `/account/requests`, `/notifications`: `/account`
  - `/collections/[slug]`, `/how-it-works`, `/privacy`, `/safety`, `/seller-guidelines`, `/terms`, `/trust`: `/`
  - `/listings/[id]`, `/sellers/[slug]`: `/browse`
  - `/listings/[id]/message`: `/listings/[id]`; `/sellers/[slug]/message`: `/sellers/[slug]`
  - `/hub/[id]`: `/hub`; `/hub/[id]/book`: `/hub/[id]`
  - `/looking-for/new`, `/looking-for/[id]`: `/looking-for`; `/looking-for/[id]/edit|offer|delete`: `/looking-for/[id]`
  - `/messages/[id]`: `/messages` (with `?tab=selling` for a selling thread, passed by the page)
  - `/sell/listings`, `/sell/profile`, `/sell/onboarding`: `/sell`; `/sell/listings/new`, `/sell/listings/[id]/edit|delete`: `/sell/listings`
  - `/report`, `/report/sent`: the subject, passed by the page (fallback `/`)
  - `/admin/sellers|reports|hidden|featured|pickup-points|numbers|staff|audit|more`: `/admin`
  - `/admin/sellers/[slug]`: `/admin/sellers`; `.../decline|pause`: `/admin/sellers/[slug]`
  - `/admin/reports/[id]`: `/admin/reports`; `.../hide|pause`: `/admin/reports/[id]`
  - `/admin/hidden/listings/[id]`, `/admin/hidden/requests/[id]`: `/admin/hidden`
  - `/admin/staff/[id]/remove-admin|remove-mentor`: `/admin/staff`
  - `/hub/manage`, `/mentor`: `/admin` for an admin, top-level otherwise
  - `/hub/new`, `/hub/[id]/edit`: `/hub/manage`; `/mentor/[slug]`: `/mentor`
  - Top-level: `/`, `/browse`, `/saved`, `/messages`, `/account`, `/hub`, `/looking-for`, `/sell`, `/admin`, `/login`
- Run `pnpm test lib/nav`.

### Task 2: `Trail`

- `components/ui/Trail.tsx` (Server Component) and its test: one `nav` named "Breadcrumb", one `ol`, separators `aria-hidden`, last crumb `aria-current="page"`, the parent crumb carries class `trail-back` and an accessible name "Back to {label}", links `prefetch={false}`.
- CSS in `app/globals.css`: below `wide:` only `.trail-back` shows, with a chevron (`ChevronLeftIcon` from `components/icons.tsx`; add it there if missing), 44 px tall, sky-dark; from `@media (min-width: 48rem) and (min-height: 30rem)` the whole trail, muted with sky-dark links, ellipsis on long crumbs.
- Run `pnpm test components/ui/Trail`.

### Task 3: Trails on every page

- Add `<Trail crumbs={trailFor(…)} />` above the heading on every non-top-level page, following decision 1. `StaffFrame` takes a `trail` prop and renders it above the eyebrow.
- Remove the top-of-page "Back to…" links it replaces (`ThreadView`, `ComposerView`, `OfferView`, `RequestFormView`, `DeleteRequestView`, `YourRequestsView`, `BookSlot`, the staff confirm pages, `account/details`, `account/privacy`) and update their tests. Keep action results (`ReportSentBack`, `ComingSoon`, `not-found`, `ViewerFollow`).
- Skeletons gain a trail line: `StaffSkeleton` (both sizes), `SellSkeleton`, `YouSkeleton`, card/page skeletons used under a trail.
- Run `pnpm typecheck && pnpm lint && pnpm test components app lib`.

### Task 4: One console nav

- `lib/staff/sections.ts` (decision 4), groups and purpose lines from the spec 3.3. Delete `STAFF_SECTIONS`; keep `ADMIN_MORE_SECTIONS` derived from it.
- `SectionBar` takes `groups`; phone shows `phone` tabs plus More, tablet and up shows every group with an `h2` heading. `SellBar` and `MentorBar` pass one unnamed group.
- `AdminBar` builds from `sections.ts`. New `StaffBar`: `AdminBar` for an admin, else `MentorBar`.
- Layouts: `app/hub/manage/layout.tsx`, `app/hub/new/layout.tsx`, `app/hub/[id]/edit/layout.tsx` render the section shell with `StaffBar` (same shape as `app/admin/layout.tsx`); `app/mentor/layout.tsx` switches to `StaffBar`.
- `StaffFrame`: remove the pill `nav`; `lede` required, from the section's purpose line where the page has no lede of its own. Rename "Hub posts" to "Posts and office hours" and "Staff accounts" to "Staff" (titles, tab titles via `staffMetadata()`, tests).
- `AdminMore`: the four groups as headed lists, rows from `sections.ts`.
- CSS: delete `.staff-nav*` and the `.section-shell:has(.section-bar) .staff-nav` rule; sidebar group headings.
- Run `pnpm test components/kit components/staff lib/staff && pnpm e2e tests/e2e/role-views.spec.ts --project=phone-390 --project=desktop-1440`.

### Task 5: Filters as dropdowns

- `components/staff/FilterForm.tsx` (Server Component): `<form method="get">`, a labelled `<select>` per filter, a "Filter" button, and a line saying what's chosen with a Clear link.
- `CampusFilter` and `AdminAudit`'s filters move onto it. `readCampusFilter` and the audit parsing are unchanged.
- Delete the `.staff-filters` CSS; update `AdminAudit.test.tsx`, the campus filter tests and the e2e specs that clicked a chip.
- Run `pnpm test components/staff && pnpm e2e tests/e2e/staff-accounts-checks.spec.ts --project=desktop-1440`.

### Task 6: Look at it

- `preview_start` `vossie-dev`. As Admin, Mentor, Seller and Buyer, at 390 and 1440: a deep page's back link, the full trail, the console's sidebar identical on `/admin/audit`, `/hub/manage` and `/mentor`, the More page, the filters. Screenshots to Lama.

### Task 7: Checks and docs

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Record page sizes (0 B JS expected) against the 150 KB budget.
- E2E: `cls`, `performance`, `role-views`, `you`, the staff specs and the write projects that click staff navigation, at 360, 390 and 1440.
- A decisions log entry, CLAUDE.md lines (the trail rule, `lib/nav/trail.ts`'s guard, the console's single nav, `lib/staff/sections.ts`), and `docs/PROGRESS.md`.
