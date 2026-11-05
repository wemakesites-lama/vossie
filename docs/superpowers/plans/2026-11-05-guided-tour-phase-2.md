# Guided tour, phase 2: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tours for the six remaining screens (Looking For, Launchpad, Messages, the new-listing form, the admin's Today and Mentoring), and the JavaScript room to afford them.

**Architecture:** Phase 1's engine is unchanged. Each screen gets a `data-tour-page` on its wrapper, `data-tour` on its parts, and its steps' words in `lib/tour/tours.ts`. A step whose part isn't on screen is skipped, as before. The menu stops importing `lib/tour/resolve.ts` and checks for a visible `[data-tour-page]` inline, so the six new tour ids never reach the menu's chunk.

**Tech Stack:** As phase 1: Next.js 16.4, React 19.3, TypeScript, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-guided-tour-design.md` (section 4.2 names the six screens; section 13, added in Task 3, records these steps). Phase 1's plan: `docs/superpowers/plans/2026-11-05-guided-tour.md`.

**House rules for every task:** as phase 1. Implementers don't commit or run state-changing git; the controller stages only the task's files by path (Lama's `.claude/launch.json`, `docs/PROGRESS.md` line and `docs/pitch/` stay out) and commits with Lama's go-ahead. No servers or builds in Tasks 1 and 2. Use Edit for every change to an existing file.

**Why the byte saving comes first:** after phase 1 the listing forms are 153,496 B brotli, 104 B under 150 KB (decision 99). The menu, in every page's first load, imports `findTourPage` and with it `TOUR_IDS`, which this phase grows by six ids. An inline check drops the import.

---

## File map

| File | Change |
|---|---|
| `components/menu/MenuDrawer.tsx` | Inline visible-page check; no `lib/tour` import |
| `lib/tour/targets.ts` | Six ids, 23 targets |
| `lib/tour/tours.ts` | Six tours' words |
| `components/ui/LinkTabs.tsx` | Optional `tour` prop on its root |
| `components/kit/sections.tsx` | `tour="staff-bar"` on `AdminBar` and `MentorBar` |
| `app/looking-for/page.tsx`, `components/looking-for/RequestBoard.tsx` | Looking For's markup |
| `app/hub/page.tsx`, `components/hub/HubIntro.tsx`, `components/hub/HubFeed.tsx`, `components/hub/CoachOnHub.tsx`, `components/hub/VerifiedShops.tsx` | Launchpad's markup |
| `components/messages/InboxView.tsx` | Messages' markup (both inboxes render it) |
| `app/sell/listings/new/page.tsx`, `components/sell/PhotoFieldset.tsx`, `components/sell/PhotoStart.tsx`, `components/sell/ListingFormView.tsx` | The new-listing form's markup |
| `components/staff/AdminToday.tsx`, `components/staff/MentorDashboard.tsx` | Today's and Mentoring's markup |
| `tests/e2e/tour.spec.ts` | One test opening each new tour |
| `docs/…` | Spec section 13, decision 99's notes, PROGRESS |

---

### Task 1: Make room in the menu

**Files:**
- Modify: `components/menu/MenuDrawer.tsx`

- [ ] **Step 1: Replace the import with an inline check**

Remove `import { findTourPage } from "@/lib/tour/resolve";`. In the `useOverlayDialog("menu", …)` callback, replace

```tsx
    setTourHere(findTourPage(document) !== null);
```

with

```tsx
    // Inline rather than lib/tour/resolve.ts, so the tour ids stay out of every page's first load (guided tour
    // phase 2). markup.test.ts makes sure every data-tour-page names a real tour.
    setTourHere([...document.querySelectorAll("[data-tour-page]")].some((page) => page.checkVisibility()));
```

Keep the comment above it ("Offered only on a page with a tour…").

- [ ] **Step 2: Check**

Run: `pnpm test components/menu lib/tour --exclude '.claude/**'`
Expected: PASS.

Run: `pnpm exec eslint components/menu/MenuDrawer.tsx`, then `pnpm typecheck`
Expected: clean. `grep -n "lib/tour" components/menu/MenuDrawer.tsx` prints nothing.

- [ ] **Step 3: Commit (controller)**

```bash
git add components/menu/MenuDrawer.tsx
```
```bash
git commit -m "perf: the menu checks for a tour inline, keeping the tour ids out of first loads (decision 99)"
```

---

### Task 2: Six tours, their words and their markup

**Files:**
- Modify: `lib/tour/targets.ts`, `lib/tour/tours.ts`
- Modify: the markup files in the file map
- Test: `lib/tour/tours.test.ts` and `lib/tour/markup.test.ts` (unchanged; they cover new tours by iterating)

- [ ] **Step 1: Add the ids and targets**

`lib/tour/targets.ts`:

```ts
export const TOUR_IDS = [
  "home",
  "browse",
  "listing",
  "sell",
  "you",
  "looking-for",
  "hub",
  "messages",
  "listing-form",
  "admin-today",
  "mentor",
] as const;
```

and append to the `TourTarget` union, after `"you-settings"`:

```ts
  | "lf-post"
  | "lf-categories"
  | "lf-requests"
  | "hub-start"
  | "hub-coach"
  | "hub-coming-up"
  | "hub-tips"
  | "hub-verified"
  | "inbox-list"
  | "inbox-tabs"
  | "inbox-refresh"
  | "form-photos"
  | "form-photo-start"
  | "form-price"
  | "form-publish"
  | "today-waiting"
  | "today-week"
  | "today-campuses"
  | "staff-bar"
  | "mentor-shops"
  | "mentor-enquiries";
```

- [ ] **Step 2: Add the words**

`lib/tour/tours.ts`, inside `TOURS` after `you: [ … ],`:

```ts
  "looking-for": [
    {
      target: "lf-post",
      title: "Post a request",
      body: "Say what you need and by when. Students who can help will offer.",
    },
    { target: "lf-categories", title: "Categories", body: "Show only one kind of request." },
    {
      target: "lf-requests",
      title: "Open requests",
      body: "What students are looking for, your campus first. Open one to offer.",
    },
  ],
  hub: [
    {
      target: "hub-start",
      title: "Get started",
      body: "Book a slot with a mentor, or open your shop and start selling.",
    },
    {
      target: "hub-coach",
      title: "Your week",
      body: "Up to three small steps for your shop this week, the same as on your shop's home.",
    },
    { target: "hub-coming-up", title: "Coming up", body: "Events and office hours. Pick a tab to see just one kind." },
    { target: "hub-tips", title: "Tips", body: "Short, practical tips from the Hub for running a student business." },
    { target: "hub-verified", title: "Verified shops", body: "Student businesses the Hub has checked." },
  ],
  messages: [
    {
      target: "inbox-list",
      title: "Your conversations",
      body: "Every conversation with a buyer or seller. Open one to reply.",
    },
    { target: "inbox-tabs", title: "Buying and selling", body: "With a shop, your buyers' messages are under Selling." },
    { target: "inbox-refresh", title: "Refresh", body: "New messages show when you refresh or open the page again." },
  ],
  "listing-form": [
    { target: "form-photos", title: "Photos", body: "Up to 6 photos. The first is the cover. Ask anyone in a photo first." },
    {
      target: "form-photo-start",
      title: "Fill in from my photo",
      body: "We'll fill in what we can see from your photo. You check it before anything goes live.",
    },
    { target: "form-price", title: "Price", body: "What buyers pay, in rand." },
    { target: "form-publish", title: "Publish or save", body: "Publish when it's ready, or save a draft and finish later." },
  ],
  "admin-today": [
    {
      target: "today-waiting",
      title: "Waiting",
      body: "Everything waiting for the Hub: new shops, reports and booking requests.",
    },
    {
      target: "today-week",
      title: "Last week",
      body: "Last week's numbers. Small counts show as Hidden or Under 5, to protect students' privacy.",
    },
    { target: "today-campuses", title: "Listings by campus", body: "How many listings each campus has." },
    { target: "staff-bar", title: "The console", body: "Every section of the Hub console. On phones, the rest are under More." },
  ],
  mentor: [
    {
      target: "mentor-shops",
      title: "Your shops",
      body: "The shops you mentor, most flags first, then the longest since a check-in.",
    },
    { target: "mentor-enquiries", title: "Enquiries", body: "Each shop's enquiries over the last 14 days." },
    { target: "staff-bar", title: "Mentoring", body: "Mentoring's sections. Export downloads your caseload as a CSV file." },
  ],
```

- [ ] **Step 3: Run the tests to see the markup test fail**

Run: `pnpm test lib/tour --exclude '.claude/**'`
Expected: `tours.test.ts` PASSES (11 tours, each 3+ steps, bodies within 140); `markup.test.ts` FAILS, listing every new target and the six new pages as not marked.

- [ ] **Step 4: Shared pieces**

`components/ui/LinkTabs.tsx`: add an optional `tour?: TourTarget` prop (`import type { TourTarget } from "@/lib/tour/targets";`) and put `data-tour={tour}` on the component's root element (the `<nav>` it renders). Every existing caller passes none.

`components/kit/sections.tsx`: `AdminBar`'s return becomes `<SectionBar label="Hub console" tabs={[...tabs, more, { ...EXIT, only: "wide" }]} tour="staff-bar" />`; `MentorBar`'s `<SectionBar label="Mentoring" tabs={tabs} tour="staff-bar" />`. (Both render inside `StaffShell`'s `.section-shell`, where the engine looks.)

- [ ] **Step 5: Looking For**

`app/looking-for/page.tsx`: `<div className="page board" data-tour-page="looking-for">`, and `<div className="board-actions" data-tour="lf-post">`.

`components/looking-for/RequestBoard.tsx`:
- `<LinkTabs label="Categories" tabs={chips} current={category ?? "all"} look="chips" tour="lf-categories" />`;
- `BoardSection` takes an optional `tour?: TourTarget` and puts `data-tour={tour}` on its `<section>`; the first section shown passes it: `<BoardSection id="board-all" title="Open requests" tour="lf-requests">` and `<BoardSection id="board-own" … tour="lf-requests">` (only one of the two renders). "Other campuses" passes none.

- [ ] **Step 6: Launchpad**

- `app/hub/page.tsx`: `<div className="page hub-page" data-tour-page="hub">`.
- `components/hub/HubIntro.tsx`: `<p className="hub-intro-actions" data-tour="hub-start">`.
- `components/hub/CoachOnHub.tsx`: `<div id="hub-coach" className="hub-section" data-tour="hub-coach">`.
- `components/hub/HubFeed.tsx`: `<section id="hub-coming-up" … data-tour="hub-coming-up">` and `<section id="hub-tips" … data-tour="hub-tips">`.
- `components/hub/VerifiedShops.tsx`: `<section id="hub-verified" … data-tour="hub-verified">`.

The steps' order follows the page (intro, coach, Coming up, Tips, Verified shops). If `HubFeed` renders Tips above Coming up, swap the two steps in `TOURS.hub` so the tour moves down the page.

- [ ] **Step 7: Messages**

`components/messages/InboxView.tsx` (both `/messages` and the seller's `/sell/messages` render it):
- `<div className="inbox-body" data-tour-page="messages">`;
- `<nav aria-label="Buying and selling" className="inbox-tabs" data-tour="inbox-tabs">` (shown only with a shop, so the step skips itself otherwise);
- `<a href={inboxPath(tab)} className="msg-refresh" data-tour="inbox-refresh">`;
- `<section aria-labelledby="inbox-list-title" data-tour="inbox-list">` (it holds the list or the empty state, so it always has a box).

- [ ] **Step 8: The new-listing form**

- `app/sell/listings/new/page.tsx`: `<div className="sell-column" data-tour-page="listing-form">` (the new form only; the edit page gets no tour).
- `components/sell/PhotoFieldset.tsx`: `<fieldset className="form-field sell-fieldset" data-tour="form-photos">`.
- `components/sell/PhotoStart.tsx`: `<fieldset className="photo-start" … data-tour="form-photo-start">` (shown only while photo-to-listing is on, so the step skips itself otherwise).
- `components/sell/ListingFormView.tsx`: `<div className="sell-price" data-tour="form-price">` and `<div className="sell-form-buttons" data-tour="form-publish">`.

`PhotoFieldset` and `PhotoStart` are Server Components; `PhotoField` (client) is untouched.

- [ ] **Step 9: Today and Mentoring**

`components/staff/AdminToday.tsx`:
- `<div className="today" data-tour-page="admin-today">`;
- wrap the Waiting card: `<div data-tour="today-waiting"><Card title="Waiting" level={2}>…</Card></div>`; likewise `today-week` round "Last week" and `today-campuses` round "Listings by campus".

`components/staff/MentorDashboard.tsx`:
- `<div className="mentor-home" data-tour-page="mentor">`;
- wrap the first card (`"Every mentored shop"` / `"Your shops"`) in `<div data-tour="mentor-shops">`, and the "Enquiries, 14 days" card in `<div data-tour="mentor-enquiries">`.

Before wrapping, grep `app/globals.css` for `.today >`, `.mentor-home >`, `:first-child`, `:last-child` or sibling selectors on those cards; if one exists, put the `data-tour` on the card's own wrapper instead and say so in the report.

- [ ] **Step 10: Run the tests**

Run: `pnpm test lib/tour components/ui components/looking-for components/hub components/messages components/sell components/staff components/kit --exclude '.claude/**'`
Expected: PASS, `markup.test.ts` included. An existing test that fails only because the markup gained `data-tour` or a wrapper `div` is updated; any other failure is reported. A 5-second timeout that passes when its file runs alone is load, not a failure.

Run: `pnpm typecheck`, and `pnpm exec eslint` on every changed file.
Expected: clean.

Run: `grep -rn "lib/tour/tours" components app --include=*.tsx | grep -v "components/tour/Tour.tsx"`
Expected: nothing.

- [ ] **Step 11: Commit (controller)**

```bash
git add lib/tour/targets.ts lib/tour/tours.ts components/ui/LinkTabs.tsx components/kit/sections.tsx app/looking-for/page.tsx components/looking-for/RequestBoard.tsx app/hub/page.tsx components/hub/HubIntro.tsx components/hub/CoachOnHub.tsx components/hub/HubFeed.tsx components/hub/VerifiedShops.tsx components/messages/InboxView.tsx app/sell/listings/new/page.tsx components/sell/PhotoFieldset.tsx components/sell/PhotoStart.tsx components/sell/ListingFormView.tsx components/staff/AdminToday.tsx components/staff/MentorDashboard.tsx
```
(plus any test Step 10 updated)
```bash
git commit -m "feat: tours for Looking For, Launchpad, Messages, the new-listing form, Today and Mentoring (decision 99)"
```

---

### Task 3: End to end, bytes and docs

**Files:**
- Modify: `tests/e2e/tour.spec.ts`
- Modify: `docs/superpowers/specs/2026-11-05-guided-tour-design.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`

- [ ] **Step 1: Add the test**

At the end of `tests/e2e/tour.spec.ts`:

```ts
test("Looking For, Launchpad, Messages, the listing form, Today and Mentoring each have a tour", async ({ page }) => {
  onlyAt("phone-390");
  async function hasTour(path: string) {
    await page.goto(path);
    await openTour(page);
    await page.keyboard.press("Escape");
    await expect(tour(page)).toBeHidden();
  }
  await hasTour("/looking-for");
  await hasTour("/hub");
  await signInAsSample(page, "Seller, Tech corner", "/messages");
  await hasTour("/messages");
  await hasTour("/sell/listings/new");
  await signInAsSample(page, "Admin", "/admin");
  await hasTour("/admin");
  await signInAsSample(page, "Mentor", "/mentor");
  await hasTour("/mentor");
});
```

`signInAsSample` lands on its `next` page and waits for it (`tests/e2e/helpers/messaging.ts`); signing in as another sample account replaces the session. If a sample label differs from "Admin" or "Mentor", read the labels from the sign-in page's buttons (`lib/auth/sample-accounts.ts`).

- [ ] **Step 2: Run the tour tests and the budget**

Before each run, check nothing else holds port 3200 or is building in this checkout (`lsof -iTCP:3200 -sTCP:LISTEN`, `pgrep -fl "playwright/test/cli.js|next build"`); if something does, wait for it to finish. Never stop another session's server.

Run: `pnpm e2e tests/e2e/tour.spec.ts --project=phone-390 --project=desktop-1440`
Expected: PASS (11 runs; the phone-only tests skip at desktop).

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Record the listing forms', the homepage's and the listing page's brotli bytes against phase 1's 153,496 B, 151,455 B and 152,609 B. The listing forms should be at or below phase 1's figure: the menu lost an import, and the new markup is HTML.

After the build: `grep -l "Every section of the Hub console" .next/static/chunks/*.js | wc -l` prints `1` (the engine's chunk), and `grep -c "admin-today" <the menu's chunk, found with grep -l "Show me around this page">` prints `0`.

- [ ] **Step 3: Docs**

Spec: add section 13, "Phase 2 tours (2026-11-05)", with one line per screen naming its steps (from Task 2 Step 2), these departures from section 4.2 — Messages has no safety step (the safety line is in the composer, not the inbox), the listing form's "Fill in from my photo" step shows only while photo-to-listing is on, and Today's and Mentoring's last step lights their section bar (`staff-bar`) — and the menu's inline check. Set the status line to `phase 1 and 2 built`.

Decision 99's row in `docs/reference/LANDING-DECISIONS.md`: append to its notes "Phase 2 (`<commits>`): the six remaining tours; the menu's inline check took the listing forms to N B" with the measured figure.

`docs/PROGRESS.md`: add a "Guided tour, phase 2" entry under phase 1's, following the shared-file rule (back the file up, stage only the new lines with `git apply --cached`, check Lama's uncommitted line is unchanged).

- [ ] **Step 4: Commit (controller)**

```bash
git add tests/e2e/tour.spec.ts docs/superpowers/specs/2026-11-05-guided-tour-design.md docs/reference/LANDING-DECISIONS.md
```
Then stage the PROGRESS lines by patch, and:
```bash
git commit -m "docs: the guided tour's phase 2, and its end-to-end test (decision 99)"
```

---

## Self-review against the spec

| Spec | Task |
|---|---|
| 4.2 the six screens | 2 (words and markup), 3 (e2e) |
| 5 pieces (markup, words only in the engine's chunk) | 2 (grep), 3 (chunk grep) |
| 7.4 bytes | 1, 3 |
| 9 testing (markup test, one e2e line per screen) | 2, 3 |
| 10 phase 2 "markup and words only" | 2; plus the menu saving (1), which the headroom needs |
