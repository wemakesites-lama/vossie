# Vossie Community Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Looking For (`/looking-for`, `/looking-for/[id]`) and the Incubation Hub (`/hub`, `/hub/[id]`) on sample data, as the spec `docs/superpowers/specs/2026-10-14-community-pages-design.md` describes, tested at five screen sizes and within the JS budget.

**Architecture:**
- **Reading is public, acting goes to sign-in.** Every page is Server Components and links. "Post a request", "Offer to help", "RSVP", "Request a slot" and the report link go to `signInHref(<this page>)`. No new client code.
- **Requests grow up.** `LookingForRequest` gains details, a category, a budget, dates and a status; 16 sample requests keep the homepage's 7 as they were. New cached functions: `getOpenRequests`, `getRequest`, `getRequestIds`, `getRelatedListings`. The board's split by campus is a plain function in `lib/requests.ts`.
- **The Hub is one feed of posts.** `HubPost` (event, office hours or tip) replaces `hubEvents`; What's on's `HubEvent`s are derived from the posts (`lib/hub.ts`), so there's one source of truth. New cached functions: `getHubPosts`, `getHubPost`, `getHubPostIds`, `getVerifiedSellers`.
- **Request-time only where it must be.** The board reads the campus cookie and `?cat=`; the Hub feed reads `?type=` and today's date (after `await connection()`); a post page's action and "More from the Hub" read today's date. Each sits in its own `<Suspense>` with a skeleton. Everything else is prerendered.
- **A small markdown subset.** `lib/markdown.ts` parses tip and event bodies into blocks; `components/hub/Markdown.tsx` renders them as React elements. Links survive only when `safeNextPath` says they stay on the site.

**Tech Stack:** As the shopping stage left it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5 with Testing Library and jsdom 30;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-14-community-pages-design.md`. "Spec 4.2" in this plan means that spec's section 4.2; "spec decision 9" means its section 2, item 9.
- **Earlier specs** (tokens, breakpoints, motion, accessibility, budgets; cards, the data layer, `ListingGrid` and the sign-in links): `docs/superpowers/specs/2026-10-08-homepage-design.md`, `2026-10-13-browse-and-listing-design.md` and `2026-10-13-shopping-pages-design.md`.
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`. The spec's ten decisions aren't in the log yet; Task 11 adds them.
- **Previous plans, for conventions and pitfalls:** `docs/superpowers/plans/2026-10-13-shopping-pages.md` and `2026-10-13-browse-and-listing-pages.md`, especially the latter's "Changes made during the build".

---

## Before you start

**This plan starts after the shopping plan.** When it was written, the shopping plan (`2026-10-13-shopping-pages.md`) was at Task 7 of 12. Start only once its Task 12 is committed. Check, one command at a time: `git log --oneline -3` shows the shopping plan's docs commit at the top, and `git status --short` shows only ` M .claude/launch.json`. Several steps below edit what the shopping plan left (`routes.spec.ts`, `performance.spec.ts`, `cls.spec.ts`, `a11y.spec.ts`, `screenshots.spec.ts`, the data saver rule, `docs/PROGRESS.md`); if a file doesn't match what a step expects, stop and report rather than guess.

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. `.claude/launch.json` has a change made outside this work: never stage it.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed. This is Lama's standing preference.
3. **Files this plan removes or moves:** none. Two fixture files are rewritten in place (`data/fixtures/requests.ts`, `data/fixtures/hub.ts`), and `hubEvents` is replaced by `hubPosts`.
4. **Generated files.** Task 2 runs `node scripts/make-placeholders.ts`, which rewrites every placeholder SVG. The 72 existing files come out byte for byte the same; 18 new ones appear (`public/placeholders/hub/h-001.svg` to `h-018.svg`).

No installs are needed.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time. Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` anything: this plan removes no files. If a generated file comes out different from what's committed, stop and report; don't restore it yourself.
- Never kill an install or build that is still running.
- Port 3100 is Lama's dev server. Don't touch it. The e2e tests use 3200; the "looking at it" checks use 3201.

## Where things stand (checked against the code on 2026-10-14)

| Area | Fact |
|---|---|
| Repo | `main`, at `0d3d803` (the community spec), with the shopping plan's Tasks 1 to 6 committed and Task 7 in progress. `.claude/launch.json` is modified by something outside this work |
| Tests | Take the counts from the shopping plan's final commit and `docs/PROGRESS.md` |
| JS | The stop line is the line Lama last accepted: 152,305 B when this plan was written, while a +760 B regression on the listing page was being investigated. The limit is 153,600 B |
| `/looking-for`, `/hub` | `ComingSoon` placeholders, both in `PLACEHOLDERS` in `tests/e2e/routes.spec.ts`. `/looking-for/[id]` and `/hub/[id]` don't exist |
| Requests | 7 in `data/fixtures/requests.ts`, with an id, title, campus and offers count only, all open: Midrand (2), Pretoria (2), Bedfordview, Cape Town Mowbray and Eduvos Online. `getRequests` puts the campus's own first, in fixture order. The homepage shows 3 (2 on phones), each row linking to `/looking-for` |
| Hub events | 10 `hubEvents` in `data/fixtures/hub.ts`: ids `e-001` to `e-010`, a SAST date, `rsvp` or `book`, from 14 October 2026 to 11 February 2027. "Photo day for your shop" (Bedfordview) is booked. `getHubEvents({ campus, limit, from })` feeds What's on, whose RSVP and Book links go to `/hub` |
| Fixtures | `scripts/make-placeholders.ts` runs the fixture files in plain Node, so a fixture may only `import type`. The script sizes art by folder: `hub` is 2400 × 1029 (the banner, unlabelled). 72 files today |
| Time and wording | `lib/time.ts` has `sastDate`, `sastToday` and `longSastDate`, and imports nothing. `lib/format.ts` has `formatRand`, `offersLabel`, `eventDate`, `shortDescription`. No client component imports either file, so helpers added there cost no client JavaScript |
| Links | `safeNextPath` (`lib/next-path.ts`) parses a path and refuses anything that leads off the site; `signInHref(path)` builds `/login?next=…`. The sign-in page's back link reads "Go back" for anything but a listing |
| Class names already taken | The homepage's rows: `.request-list`, `.request-row`, `.request-text`, `.request-title`, `.request-meta`, `.request-arrow`, `.request-skeleton`. The homepage's Hub banner: `.hub-banner…`, `.whats-on…`, `.event…`. The collection page's More from the Hub: `.hub-more…`. Shared by every page that has them: `.listing-crumbs`, `.listing-section-title`, `.listing-report` |
| Browse's tabs | `CategoryTabs` builds browse links from a `BrowseQuery`, so it can't be reused here; its CSS (`.category-tabs`, `.category-tab`) can |
| Clock reads | `await connection()` first, inside `<Suspense>` (decision 26), as What's on and Featured today do |
| Hidden pages | Next keeps the last 3 pages hidden in the DOM for Back (React's `<Activity>`), with an inline `display: none` on their top element. CSS locators in e2e tests still count them; `getByRole` doesn't |
| Dates in tests | The sample events run out on 11 February 2027. e2e tests never assume a date: the homepage's tests already avoid What's on's events for this reason |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. In this plan, "plan decision N" means this list; "decision N" on its own means a row in the decisions log.

1. **The homepage's Looking For band changes at seven campuses.** Spec 4.3 asks for an open request at every campus but Mbombela, and the band shows the viewer's campus first, so Bloemfontein, Cape Town Tyger Valley, Durban Umhlanga, East London, Nelson Mandela Bay, Potchefstroom and Vanderbijlpark now lead with their own new request. "All campuses", Midrand, Pretoria, Bedfordview, Cape Town Mowbray, Eduvos Online and Mbombela show exactly what they did: the 7 existing requests stay the newest, and no new open request is at their campuses (the two closed ones, at Midrand and Pretoria, never show).
2. **Two past posts join the 10 events:** "Hub open day" (16 September) and "Office hours: registering your business" (24 September). They never reach the feed or the homepage, but their pages always say they've passed, so "has passed" can be tested on any date.
3. **"Photo day for your shop" becomes office hours,** because the homepage books it ("Book") and spec 5.3 derives the action from the kind. Like other office hours it starts at 13:00.
4. **Post covers are `/placeholders/hub/<id>.svg` at the banner's 7:3** (2400 × 1029), labelled with the title so they can be told apart. The script labels the `hub` folder, except the banner. Feed cards show no photo (spec 5.1 lists none), so covers load only on post pages.
5. **The All tab shows two lists:** events and office hours, then tips. Each has its own empty line ("Nothing planned right now. Check back soon.", "No tips yet.") and is named for screen readers with `aria-label`, not a heading, because the cards are the h3s (spec 6).
6. **The type tabs land on the feed:** they link to `/hub?type=…#hub-feed`, so a tap below the story and Verified sellers keeps the feed in view, on a full page load too. The feed's Try again and a post's breadcrumb do the same.
7. **One `LinkTabs` component for both filters.** The board's chips are pills; the Hub's tabs reuse browse's underlined tab style. The chips and the Verified sellers row scroll sideways on phones and wrap from the tablet step (spec 5.1 said the sellers wrap on desktop).
8. **A closed request's offers panel says only "This request is closed":** no count and no button.
9. **A post page has two request-time parts:** the action (RSVP or Request a slot, or "has passed") and "More from the Hub", because "upcoming" depends on today too (spec 3 named only the first). Each streams into room kept for it. The action sits after the body, in spec 5.2's order.
10. **"Has passed" means an earlier date in SAST,** as the feed and the homepage count it: an event still offers RSVP until midnight on its day.
11. **Verified sellers are listed A to Z by name,** so no one is favoured. Featured today's fair daily draw stays the homepage's.
12. **No prefetch** on request rows, chips, tabs, Hub cards, Verified sellers, body links, and now the homepage's request rows and RSVP and Book links (decision 28's repeated links). Those homepage links used to share one page; now each opens its own.
13. **Data saver:** the Verified sellers' photos don't load, like Featured today's. The story photo and post covers stay and load first (`priority`), as a collection's header photo does (shopping plan decisions 8 and 15).
14. **Metadata:** the board and the Hub have fixed titles and descriptions; `?cat=` and `?type=` views share them and stay indexed (there are only 11 and 4). A request's description is the start of its details; a post's is the start of its body as plain words, and its link preview uses the summary.
15. **Function shapes:** `getHubPosts({ kinds, from })` takes a list of kinds, so the All tab and More from the Hub each make one call (spec 5.3 wrote `kind`). `getRequests` sorts by `createdAt` instead of trusting the fixture's order. `HubEvent.id` is now the post's id.
16. **The markdown renderer is a parser and a component.** Only `## ` makes a heading (`#` and `###` lines stay text), lines run together into paragraphs until a blank line, and a link's words stay when its link is dropped. HTML is always text.
17. **Shared styles:** breadcrumbs reuse `.listing-crumbs`, section titles `.listing-section-title`, the report link `.listing-report`, as the storefront does. Facts on request and post pages are pale pills (`.fact-pills`).
18. **On desktop, a request's offers panel sits beside it,** like the listing page's panel, without staying in view.
19. **The board's Post a request always comes back to `/looking-for`:** the heading is prerendered, so it can't know the chosen category. The sign-in page's back link reads "Go back" (spec decision 1).
20. **Sample wording:** the 16 requests, the 18 posts and the Hub's story are for Lama and the Hub to change.

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec 7):** if any page passes **the stop line Lama last accepted (152,305 B when this plan was written)**, stop after that task and report. Use the newest line in the shopping plan's ledger or `docs/PROGRESS.md` if it has moved. Don't cut features to fit; that's Lama's decision.
- **Where bytes move:** nowhere, by design. Every new component is a Server Component and the helpers are server-only. Each new page brings its own small route chunk; the request page's "Already on Vossie" cards bring the Save hearts, which other pages already load.
- **Recording.** `tests/e2e/performance.spec.ts` prints each page's `scriptBrotli`. Tasks 4 to 7 add their page to it, run it at 390px and record the figures in their commit messages. Task 8 re-measures the homepage.

**As built** (fill in during the build):

| Point | `/` | `/browse` | Listing | Board | Request | Hub | Hub post |
|---|---|---|---|---|---|---|---|
| Start (the shopping plan's final figures) | | | | | | | |
| Task 4, the board | | | | | | | |
| Task 5, a request | | | | | | | |
| Task 6, the Hub | | | | | | | |
| Task 7, a Hub post | | | | | | | |
| Task 8, homepage links | | | | | | | |
| **Final** | | | | | | | |

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there.
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, and comments in plain English. There's no formatter: match the file you're in.
- **Server or client.** Server Components unless a file starts with `"use client"`. Plain `lib/` modules have no directive. This plan adds no client components.
- **Next APIs.** Before using a Next API this plan names, read its page in `node_modules/next/dist/docs/` (AGENTS.md). This plan uses `connection()`, `generateMetadata`, `generateStaticParams`, `notFound()` and the page's `params` and `searchParams` props, each already used in the repo.
- **Breakpoints.**
  - `wide:` is tablet and up; `desk:` is desktop. Never use `md:`, `lg:` or `sm:`.
  - In CSS, write `@media (min-width: 48rem) and (min-height: 30rem)` and `@media (min-width: 64rem) and (min-height: 30rem)`. Landscape phones are `@media (orientation: landscape) and (max-height: 29.99rem)`.
- **Page padding.** `.page` and the page's own class (`.board`, `.request-page`, `.hub-page`, `.hub-post-page`) sit on one element, so the page class's padding *replaces* `.page`'s gutter. Write the whole content edge: 16px on phones, 40px from the tablet step. Browse and the listing page hit this twice.
- **Effects.** Never call `setState` directly in an effect body, and only touch `ref.current` in effects and handlers. (This plan adds no effects.)
- **Headings.** One H1 per page. Sections are `<section aria-labelledby="…">` with one H2, visible or `sr-only`. Cards and request rows use H3.
- **Request-time parts.** A component that reads cookies, `searchParams` or the clock sits inside `<Suspense>`. Clock reads come after `await connection()` (decision 26). Data loads use `.catch(() => null)` and show an error state on `null`. There's no `try`/`catch` round JSX: the React Compiler lint rejects it. Choose between states with `if`/`else` into a `ReactNode` variable rather than nested ternaries.
- **Async components in tests.** jsdom can't render an async component inside a tree. Render `await Thing(props)` directly, or stand the async part in with `vi.mock` when it sits inside a sync frame. Mock `connection` with `vi.mock("next/server", () => ({ connection: async () => undefined }))`, as `WhatsOn.test.tsx` does.
- **Dates in tests.** Unit tests fake only the date: `vi.useFakeTimers({ toFake: ["Date"] })`, then `vi.setSystemTime(…)`; the setup file restores real timers after each test. e2e tests never assume a date: a test that needs an upcoming event finds one in the feed, and skips with a message when there's none.
- **Accessible names.** Name computation trims each element's own text, so put spaces outside `sr-only` spans. Chromium adds spaces between flex children. Icons from `components/icons.tsx` are `aria-hidden`.
- **Contrast.**
  - Sky never carries text, icons or thin borders on white. Links on white are sky-dark; on panel, pale and sky they're navy.
  - Small text on the star texture is white. (This plan adds nothing on the stars.)
- **Motion.** Animate only `transform`/`opacity`, including the CSS `translate`, `scale` and `rotate` properties. Hover effects only under `(hover: hover) and (pointer: fine)`. This plan adds no animation.
- **Images.** Use `Photo` and always pass `sizes`. Decorative images get `alt=""`; content images take their alt from the data.
- **Tap targets.** At least 44 × 44px, with 8px between targets. Links inside a paragraph are exempt (WCAG 2.5.8).
- **Lint.** `@next/next/no-html-link-for-pages` only checks literal hrefs. Every plain `<a>` in this plan has a computed href, so none needs an `eslint-disable` comment. Don't add one: lint reports unused ones.
- **Class names.** New classes start with `board-`, `request-` (the request page), `hub-` or `link-chip`, or are `.markdown` and `.fact-pills`. Before adding one, check it isn't taken: `grep -n "\.<name>\b" app/globals.css` (see the facts table for the homepage's `.request-…` and the collection page's `.hub-more…`).
- **CSS placement.**
  - New CSS goes at the end of `app/globals.css`, inside `@layer components`, under a banner: `/* --- Community: <name> (community plan, Task N, spec x.y) --- */`.
  - Never put `!important` on a transition or animation property: the motion off-switches rely on it.
- **Hidden pages in CSS and tests.**
  - A `body:has(…)` rule must name a visible page (`.board:not([style*="display"])`), because `:has()` still sees the hidden ones. This plan adds no `body:has()` rules.
  - In e2e tests, after a client-side navigation, count rows and cards with `.filter({ visible: true })`, or find them with `getByRole`.
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git status --short` on its own, and checks that only the listed files changed (and `.claude/launch.json`, which is never staged);
  2. runs `git add` with the listed files;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.
- **Looking at it.** Check visually on a production build (`pnpm build`, then `pnpm start --port 3201`) at 390 × 844, 768 × 1024 and 1280 × 800, using a throwaway Playwright script in your scratchpad. Stop the server afterwards (it's yours, not an install or build).
- **Measuring JS.** `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` builds, starts its own server on 3200, and prints one line per page, such as `Looking For board: {"script":…,"scriptBrotli":…}`. Record `scriptBrotli`.

## File map (end of this plan)

New files are marked **+**, changed **~**.

```
app/
  looking-for/page.tsx                    ~ the board (Task 4)
  looking-for/[id]/page.tsx               + a request (Task 5)
  hub/page.tsx                            ~ the Hub (Task 6)
  hub/[id]/page.tsx                       + a Hub post (Task 7)
  globals.css                             ~ community banners (Tasks 3 to 7)
components/
  ui/LinkTabs.tsx                         + (Task 4)
  looking-for/RequestRow.tsx  RequestBoard.tsx  BoardSkeleton.tsx                      + (Task 4)
  looking-for/RequestView.tsx  RelatedListings.tsx                                     + (Task 5)
  hub/Markdown.tsx                        + (Task 3)
  hub/HubPostCard.tsx  HubStory.tsx  VerifiedSellers.tsx  HubFeed.tsx  HubFeedSkeleton.tsx   + (Task 6)
  hub/HubPostView.tsx  PostAction.tsx  UpcomingPosts.tsx                               + (Task 7)
  home/LookingForRequests.tsx  WhatsOn.tsx   ~ links to the new pages (Task 8)
lib/
  types.ts                                ~ (Tasks 1, 2)
  format.ts  time.ts                      ~ (Tasks 1, 2)
  requests.ts                             + (Task 1)
  hub.ts                                  + (Task 2)
  markdown.ts                             + (Task 3)
  data/index.ts                           ~ (Tasks 1, 2)
data/fixtures/
  requests.ts  hub.ts                     ~ rewritten (Tasks 1, 2)
scripts/make-placeholders.ts              ~ the posts' covers (Task 2)
public/placeholders/hub/h-001.svg … h-018.svg   + written by the script (Task 2)
tests/e2e/
  community.spec.ts                       + (Task 9)
  routes.spec.ts  performance.spec.ts     ~ (Tasks 4 to 8)
  a11y.spec.ts  cls.spec.ts               ~ (Task 10)
  screenshots.spec.ts                     ~ (Task 11)
docs/PROGRESS.md  docs/progress/community/  docs/reference/GO-LIVE.md  docs/reference/LANDING-DECISIONS.md   ~/+ (Task 11)
```

Each `*.test.ts(x)` sits next to the file it tests. Existing tests that change: `data/fixtures/fixtures.test.ts`, `lib/data/index.test.ts`, `lib/data/placeholders.test.ts`, `lib/format.test.ts`, `lib/time.test.ts`, `components/home/LookingForRequests.test.tsx` and `components/home/WhatsOn.test.tsx`.

---


### Task 1: Request data

Requests gain their details, category, budget, dates and status (spec 4.3), and 9 sample requests join the 7 the homepage shows (plan decision 1). The board and the request page get their data functions and wording.

**Files:**
- Modify: `lib/types.ts`
- Modify: `data/fixtures/requests.ts` (rewritten), `data/fixtures/fixtures.test.ts`
- Modify: `lib/format.ts`, `lib/format.test.ts`, `lib/time.ts`, `lib/time.test.ts`
- Create: `lib/requests.ts`, `lib/requests.test.ts`
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`

- [ ] **Step 1: Write the fixture checks**

In `data/fixtures/fixtures.test.ts`, add this block at the end of the file:

```ts
describe("Looking For fixtures (community spec 4.3)", () => {
  const ISO_UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

  it("keeps the homepage's seven requests as they were", () => {
    expect(requests.slice(0, 7).map(({ id, title, campusSlug, offers }) => ({ id, title, campusSlug, offers }))).toEqual([
      { id: "r-001", title: "Accounting 1 tutor this week", campusSlug: "midrand", offers: 2 },
      { id: "r-002", title: "Graphic calculator to borrow for exams", campusSlug: "pretoria", offers: 1 },
      { id: "r-003", title: "Birthday cake for Friday", campusSlug: "midrand", offers: 3 },
      { id: "r-004", title: "Second-hand bar fridge", campusSlug: "bedfordview", offers: 0 },
      { id: "r-005", title: "Someone to fix my laptop hinge", campusSlug: "cape-town-mowbray", offers: 1 },
      { id: "r-006", title: "Lift to campus on Monday mornings", campusSlug: "pretoria", offers: 2 },
      { id: "r-007", title: "Business Law 2 notes", campusSlug: "online", offers: 4 },
    ]);
  });

  it("gives every request a unique id, a known category, real times, a budget that makes sense and details", () => {
    expect(isUnique(requests.map((request) => request.id))).toBe(true);
    for (const request of requests) {
      expect(request.id).toMatch(/^r-\d{3}$/);
      expect(categorySlugs.has(request.categorySlug), request.id).toBe(true);
      expect(request.createdAt, request.id).toMatch(ISO_UTC);
      expect(Number.isNaN(Date.parse(request.createdAt)), request.id).toBe(false);
      if (request.neededBy !== null) expect(request.neededBy, request.id).toMatch(/^\d{4}-\d\d-\d\d$/);
      if (request.budgetZar !== null) expect(request.budgetZar, request.id).toBeGreaterThan(0);
      expect(request.details.trim().length, request.id).toBeGreaterThan(0);
      expect(request.offers, request.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("lists requests newest first", () => {
    const times = requests.map((request) => request.createdAt);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("has an open request at every campus but Mbombela, so its empty state can be tested", () => {
    const stillOpen = requests.filter((request) => request.status === "open");
    const withOpen = new Set(stillOpen.map((request) => request.campusSlug));
    expect(campuses.filter((campus) => !withOpen.has(campus.slug)).map((campus) => campus.slug)).toEqual(["mbombela"]);
  });

  it("has closed, open-to-offers and swap requests, and a category with nothing open, to test those states", () => {
    expect(requests.some((request) => request.status === "closed")).toBe(true);
    expect(requests.some((request) => request.budgetZar === null)).toBe(true);
    expect(requests.some((request) => request.swapWelcome)).toBe(true);
    const openCategories = new Set(
      requests.filter((request) => request.status === "open").map((request) => request.categorySlug),
    );
    expect(openCategories.has("tickets-events")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm test data/fixtures/fixtures.test.ts`
Expected: FAIL (and type errors), because requests have no `createdAt`, `status`, `categorySlug` and so on.

- [ ] **Step 3: Extend the type**

In `lib/types.ts`, replace the `LookingForRequest` type with:

```ts
/** Whether a request still takes offers (community spec 4.3). */
export type RequestStatus = "open" | "closed";

/** A Looking For request (community spec 4.3). It never names the asker (community spec decision 2). */
export type LookingForRequest = {
  id: string;
  title: string;
  campusSlug: string;
  offers: number;
  /** Two or three sentences in the asker's words. Line breaks are kept on the page. */
  details: string;
  categorySlug: string;
  /** Rand, or null for "open to offers". */
  budgetZar: number | null;
  swapWelcome: boolean;
  /** YYYY-MM-DD in South African time, or null. */
  neededBy: string | null;
  /** ISO 8601 in UTC, e.g. "2026-10-13T07:30:00Z". */
  createdAt: string;
  status: RequestStatus;
};
```

- [ ] **Step 4: Rewrite the requests**

Replace `data/fixtures/requests.ts` with:

```ts
{{REQUESTS_TS}}
```

Run: `pnpm test data/fixtures/fixtures.test.ts`
Expected: PASS. If "keeps the homepage's seven requests as they were" fails, a title, campus or offers count was mistyped: compare with `git diff data/fixtures/requests.ts`.

- [ ] **Step 5: Write the wording and board helpers' tests**

In `lib/format.test.ts`, add `budgetLabel`, `dayMonth` and `offersSoFarLabel` to the import list (keeping it alphabetical), and add at the end of the file:

```ts
describe("Looking For wording (community spec 4.1 and 4.2)", () => {
  it("writes a request's budget", () => {
    expect(budgetLabel({ budgetZar: 300, swapWelcome: false })).toBe("Budget R300");
    expect(budgetLabel({ budgetZar: 1200, swapWelcome: false })).toBe("Budget R1,200");
    expect(budgetLabel({ budgetZar: 300, swapWelcome: true })).toBe("Budget R300 or a swap");
    expect(budgetLabel({ budgetZar: null, swapWelcome: false })).toBe("Open to offers");
    expect(budgetLabel({ budgetZar: null, swapWelcome: true })).toBe("Open to offers or a swap");
  });

  it("counts the offers so far, inviting the first", () => {
    expect(offersSoFarLabel(0)).toBe("No offers yet. Be the first.");
    expect(offersSoFarLabel(1)).toBe("1 offer so far");
    expect(offersSoFarLabel(2)).toBe("2 offers so far");
  });

  it("writes a YYYY-MM-DD date as a day and a short month", () => {
    expect(dayMonth("2026-10-24")).toBe("24 Oct");
    expect(dayMonth("2026-11-05")).toBe("5 Nov");
  });
});
```

In `lib/time.test.ts`, change the import to `import { longSastDate, sastDate, sastToday, shortSastDate } from "./time";` and add at the end of the file:

```ts
describe("shortSastDate", () => {
  it("writes a stored UTC time as a short date in South Africa (community spec 4.1)", () => {
    expect(shortSastDate("2026-10-13T07:30:00Z")).toBe("13 Oct");
  });

  it("uses South African time, so 22:40 UTC is already the next day", () => {
    expect(shortSastDate("2026-10-10T22:40:00Z")).toBe("11 Oct");
  });
});
```

Create `lib/requests.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { boardHref, readRequestCategory, splitByCampus } from "./requests";

const categories = [{ slug: "tech" }, { slug: "food" }];

describe("the board's category (community spec 4.1)", () => {
  it("reads a known category from ?cat=, and nothing else", () => {
    expect(readRequestCategory("tech", categories)).toBe("tech");
    expect(readRequestCategory(["food", "tech"], categories)).toBe("food");
    expect(readRequestCategory("nope", categories)).toBeNull();
    expect(readRequestCategory("", categories)).toBeNull();
    expect(readRequestCategory(undefined, categories)).toBeNull();
  });

  it("links to the board with one category, or with all of them", () => {
    expect(boardHref("tech")).toBe("/looking-for?cat=tech");
    expect(boardHref(null)).toBe("/looking-for");
  });
});

describe("splitByCampus (community spec 4.1)", () => {
  const items = [
    { id: "a", campusSlug: "pretoria" },
    { id: "b", campusSlug: "midrand" },
    { id: "c", campusSlug: "pretoria" },
  ];

  it("puts the viewer's campus first and every other campus after, each in the order given", () => {
    expect(splitByCampus(items, "pretoria")).toEqual({ own: [items[0], items[2]], others: [items[1]] });
    expect(splitByCampus(items, "mbombela")).toEqual({ own: [], others: items });
  });

  it("keeps one list when no campus is chosen", () => {
    expect(splitByCampus(items, "all")).toBeNull();
  });
});
```

- [ ] **Step 6: Run them to make sure they fail**

Run: `pnpm test lib/format.test.ts lib/time.test.ts lib/requests.test.ts`
Expected: FAIL, because the helpers and `./requests` don't exist.

- [ ] **Step 7: Write the helpers**

In `lib/format.ts`, change the import to `import type { Condition, Listing, LookingForRequest, TrustBadge } from "./types";` and add at the end of the file:

```ts
/** "2026-10-24" → "24 Oct". The date is already South African, so there's no timezone maths. */
export function dayMonth(date: string): string {
  const { day, month } = eventDate(date);
  return `${day} ${month}`;
}

/** A request's budget (community spec 4.1): "Budget R300", "Budget R300 or a swap", "Open to offers". */
export function budgetLabel(request: Pick<LookingForRequest, "budgetZar" | "swapWelcome">): string {
  const budget = request.budgetZar === null ? "Open to offers" : `Budget ${formatRand(request.budgetZar)}`;
  return request.swapWelcome ? `${budget} or a swap` : budget;
}

/** A request page's offers line (community spec 4.2): "2 offers so far", or an invitation when there are none. */
export function offersSoFarLabel(offers: number): string {
  return offers === 0 ? "No offers yet. Be the first." : `${offersLabel(offers)} so far`;
}
```

In `lib/time.ts`, add `import { dayMonth } from "./format";` and a blank line at the top of the file (before the first comment), and add at the end:

```ts
/** A stored UTC time as a short date in South Africa: "13 Oct" (community spec 4.1). It reads no clock. */
export function shortSastDate(iso: string): string {
  return dayMonth(sastDate(new Date(iso)));
}
```

Create `lib/requests.ts`:

```ts
{{LIB_REQUESTS_TS}}
```

Run: `pnpm test lib/format.test.ts lib/time.test.ts lib/requests.test.ts`
Expected: PASS.

- [ ] **Step 8: Write the data tests**

In `lib/data/index.test.ts`, add `getOpenRequests`, `getRelatedListings`, `getRequest` and `getRequestIds` to the import list (keeping it alphabetical), and add at the end of the file:

```ts
describe("Looking For data (community spec 4.3)", () => {
  const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

  it("keeps the homepage's requests as they were, and never shows a closed one there", async () => {
    expect(ids(await getRequests({ campus: "all", limit: 3 }))).toEqual(["r-001", "r-002", "r-003"]);
    expect(ids(await getRequests({ campus: "midrand", limit: 3 }))).toEqual(["r-001", "r-003", "r-002"]);
    expect(ids(await getRequests({ campus: "mbombela", limit: 3 }))).toEqual(["r-001", "r-002", "r-003"]);
    const everything = ids(await getRequests({ campus: "all", limit: 100 }));
    expect(everything).toHaveLength(14);
    expect(everything).not.toContain("r-015");
  });

  it("leads with a campus's own new request where it has one (plan decision 1)", async () => {
    expect(ids(await getRequests({ campus: "bloemfontein", limit: 3 }))).toEqual(["r-008", "r-001", "r-002"]);
  });

  it("lists every open request for the board, newest first", async () => {
    expect(ids(await getOpenRequests({ category: null }))).toEqual([
      "r-001",
      "r-002",
      "r-003",
      "r-004",
      "r-005",
      "r-006",
      "r-007",
      "r-008",
      "r-009",
      "r-010",
      "r-011",
      "r-012",
      "r-013",
      "r-014",
    ]);
  });

  it("narrows the board to one category", async () => {
    expect(ids(await getOpenRequests({ category: "tech" }))).toEqual(["r-002", "r-013"]);
    expect(ids(await getOpenRequests({ category: "tutoring" }))).toEqual(["r-001", "r-014"]);
    expect(await getOpenRequests({ category: "tickets-events" })).toEqual([]);
  });

  it("finds any request by id, closed ones too, and lists every id for the pages", async () => {
    expect((await getRequest("r-001"))?.title).toBe("Accounting 1 tutor this week");
    expect((await getRequest("r-015"))?.status).toBe("closed");
    expect(await getRequest("nope")).toBeNull();
    const every = await getRequestIds();
    expect(every).toHaveLength(16);
    expect(every).toContain("r-016");
  });

  it("finds listings already on Vossie in the request's category, its campus first, then the newest", async () => {
    expect(ids(await getRelatedListings({ categorySlug: "tutoring", campusSlug: "midrand", limit: 4 }))).toEqual([
      "l-005",
      "l-013",
      "l-031",
      "l-025",
    ]);
    expect(ids(await getRelatedListings({ categorySlug: "res-living", campusSlug: "bedfordview", limit: 4 }))).toEqual([
      "fs-005",
      "l-003",
      "l-021",
      "l-014",
    ]);
    expect(ids(await getRelatedListings({ categorySlug: "tech", campusSlug: "pretoria", limit: 4 }))).toEqual([
      "l-001",
      "l-018",
      "l-007",
      "l-022",
    ]);
  });

  it("leaves paused and sold listings out of Already on Vossie", async () => {
    // The paused lash listing (l-016) is Pretoria's only hair and beauty listing; the sold calculator is East London's.
    expect(ids(await getRelatedListings({ categorySlug: "hair-beauty", campusSlug: "pretoria", limit: 4 }))).toEqual([
      "l-004",
      "l-023",
    ]);
    expect(ids(await getRelatedListings({ categorySlug: "tech", campusSlug: "east-london", limit: 10 }))).not.toContain(
      "l-026",
    );
  });
});
```

The existing test "puts a campus's own requests and free and swap items first, then tops up" stays as it is: Pretoria's requests are still r-002 and r-006, then r-001.

- [ ] **Step 9: Run them to make sure they fail**

Run: `pnpm test lib/data/index.test.ts`
Expected: FAIL, because the four functions don't exist and `getRequests` still counts the two closed requests (16, not 14).

- [ ] **Step 10: Write the data functions**

In `lib/data/index.ts`, replace `getRequests` with:

```ts
/** Open requests only: closed ones never appear in lists (community spec 4.3). */
function openRequests(items: readonly LookingForRequest[]): LookingForRequest[] {
  return items.filter((request) => request.status === "open");
}

/** The homepage's open requests (spec 7.11): newest first, the visitor's campus first (community spec 4.3). */
export async function getRequests({ campus, limit }: CampusQuery): Promise<readonly LookingForRequest[]> {
  "use cache";
  return campusFirst(openRequests(requests).sort(newestFirst), campus, limit);
}

/** The Looking For board (community spec 4.1): open requests, newest first, in one category or in all of them. */
export async function getOpenRequests({ category }: { category: string | null }): Promise<readonly LookingForRequest[]> {
  "use cache";
  return openRequests(requests)
    .filter((request) => category === null || request.categorySlug === category)
    .sort(newestFirst);
}

/** A request's page (community spec 4.2), open or closed. */
export async function getRequest(id: string): Promise<LookingForRequest | null> {
  "use cache";
  return requests.find((request) => request.id === id) ?? null;
}

/** Every request's id, so each request page is prerendered (community spec 3). */
export async function getRequestIds(): Promise<readonly string[]> {
  "use cache";
  return requests.map((request) => request.id);
}

/**
 * "Already on Vossie" (community spec 4.2, decision 4): up to `limit` available listings in a request's category,
 * those at its campus first, then the rest, each part newest first.
 */
export async function getRelatedListings({
  categorySlug,
  campusSlug,
  limit,
}: {
  categorySlug: string;
  campusSlug: string;
  limit: number;
}): Promise<readonly Listing[]> {
  "use cache";
  const sameCategory = available(listings)
    .filter((listing) => listing.categorySlug === categorySlug)
    .sort(newestFirst);
  return campusFirst(sameCategory, campusSlug, limit);
}
```

`newestFirst` takes anything with a `createdAt`, so it sorts requests as well as listings.

Run: `pnpm test lib/data/index.test.ts`
Expected: PASS.

- [ ] **Step 11: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass. The homepage's `LookingForRequests` tests pass unchanged: Midrand still shows r-001, r-003 and r-002.

Then check plain Node still loads the fixture, as `scripts/make-placeholders.ts` would (this writes nothing):

```bash
node -e "import('./data/fixtures/requests.ts').then((r) => console.log(r.requests.length))"
```

Expected: `16` (Node may print a warning about the module type first; that's fine).

- [ ] **Step 12: Hand over for commit**

Files: `lib/types.ts`, `data/fixtures/requests.ts`, `data/fixtures/fixtures.test.ts`, `lib/format.ts`, `lib/format.test.ts`, `lib/time.ts`, `lib/time.test.ts`, `lib/requests.ts`, `lib/requests.test.ts`, `lib/data/index.ts`, `lib/data/index.test.ts`.
Message: `feat: Looking For requests gain details, a category, a budget, dates and a status, with board and request data (community spec 4.3)`

---


### Task 2: Hub data

The Hub becomes one feed of posts (spec 5.3, decision 5): the 10 events keep their titles, campuses and dates, two past posts and six tips join them (plan decision 2), and What's on's `HubEvent`s are derived from the posts. The posts' covers are drawn by the placeholder script (plan decision 4).

**Files:**
- Modify: `lib/types.ts`
- Modify: `data/fixtures/hub.ts` (rewritten), `data/fixtures/fixtures.test.ts`
- Create: `lib/hub.ts`, `lib/hub.test.ts`
- Modify: `lib/format.ts`, `lib/format.test.ts`, `lib/time.ts`, `lib/time.test.ts`
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`, `lib/data/placeholders.test.ts`
- Modify: `scripts/make-placeholders.ts`
- Create (written by the script): `public/placeholders/hub/h-001.svg` to `h-018.svg`

- [ ] **Step 1: Write the fixture checks**

In `data/fixtures/fixtures.test.ts`:

1. Add `import { safeNextPath } from "@/lib/next-path";` above the `@/lib/saved` import, and `import { sastDateTime } from "@/lib/time";` below it.
2. Change `import { hubBanner, hubEvents } from "./hub";` to `import { hubBanner, hubPosts } from "./hub";`.
3. Delete the test "dates Hub events as YYYY-MM-DD at a known campus or every campus" (the whole `it(…)` block) from "homepage fixtures".
4. Add this block at the end of the file:

```ts
describe("Hub fixtures (community spec 5.3)", () => {
  const ISO_UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

  it("gives every post a unique id, a known campus, a real time, its own cover and a body of the allowed length", () => {
    expect(isUnique(hubPosts.map((post) => post.id))).toBe(true);
    for (const post of hubPosts) {
      expect(post.id).toMatch(/^h-\d{3}$/);
      expect(post.campusSlug === "all" || campusSlugs.has(post.campusSlug), post.id).toBe(true);
      expect(post.publishedAt, post.id).toMatch(ISO_UTC);
      expect(post.title.length, post.id).toBeLessThanOrEqual(70);
      expect(post.summary.length, post.id).toBeGreaterThan(0);
      expect(post.body.length, post.id).toBeLessThanOrEqual(4000);
      expect(post.image).toEqual({ src: `/placeholders/hub/${post.id}.svg`, alt: "" });
    }
    expect(hubBanner.image.src).toMatch(/^\/placeholders\//);
  });

  it("times events at 18:00 and office hours at 13:00 in South Africa, after they were posted", () => {
    for (const post of hubPosts) {
      if (post.startsAt === null) continue;
      expect(post.startsAt, post.id).toMatch(ISO_UTC);
      expect(sastDateTime(post.startsAt).endsWith(post.kind === "event" ? "· 18:00" : "· 13:00"), post.id).toBe(true);
      expect(post.publishedAt < post.startsAt, post.id).toBe(true);
      expect(post.place?.length, post.id).toBeGreaterThan(0);
    }
  });

  it("gives tips no time or place, and only events their places and RSVPs", () => {
    for (const post of hubPosts) {
      const tip = post.kind === "tip";
      expect(post.startsAt === null, post.id).toBe(tip);
      expect(post.place === null, post.id).toBe(tip);
      if (tip) expect(post.campusSlug, post.id).toBe("all");
      expect(post.capacity !== null && post.going !== null, post.id).toBe(post.kind === "event");
      if (post.capacity !== null && post.going !== null) expect(post.going, post.id).toBeLessThanOrEqual(post.capacity);
    }
  });

  it("has at least five tips, and a past event and past office hours, so 'has passed' can be tested on any date", () => {
    expect(hubPosts.filter((post) => post.kind === "tip").length).toBeGreaterThanOrEqual(5);
    const past = hubPosts.filter((post) => post.startsAt !== null && post.startsAt < "2026-10-01");
    expect(new Set(past.map((post) => post.kind))).toEqual(new Set(["event", "office-hours"]));
  });

  it("links only inside the site from its bodies, so the renderer drops none of the sample links", () => {
    for (const post of hubPosts) {
      for (const [, href] of post.body.matchAll(/\]\(([^)]*)\)/g)) {
        expect(safeNextPath(href), `${post.id} ${href}`).toBe(href);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm test data/fixtures/fixtures.test.ts`
Expected: FAIL (and type errors), because `hubPosts` and `sastDateTime` don't exist.

- [ ] **Step 3: The post type**

In `lib/types.ts`:

1. Replace the line `export type HubEvent = {` and the `id: string;` line under it with:

```ts
/** What's on's row on the homepage (spec 7.13), derived from a Hub post (community spec 5.3). */
export type HubEvent = {
  /** The post's id, so the row links to its page. */
  id: string;
```

2. Add after `export type HubBanner = { image: ImageRef };`:

```ts

export type HubPostKind = "event" | "office-hours" | "tip";

/** A post in the Incubation Hub's feed (community spec 5.3): an event, office hours or a tip. */
export type HubPost = {
  id: string;
  kind: HubPostKind;
  /** Up to 70 characters. */
  title: string;
  /** A campus slug, or "all" for every campus. Tips are "all". */
  campusSlug: string;
  /** ISO 8601 in UTC: when the Hub posted it. */
  publishedAt: string;
  /** ISO 8601 in UTC, for events and office hours; null for tips. */
  startsAt: string | null;
  /** Where it happens, e.g. "The Hub, Block C"; null for tips. */
  place: string | null;
  /** How many places an event has; null for office hours and tips. */
  capacity: number | null;
  /** How many have said they're going to an event; null for office hours and tips. */
  going: number | null;
  /** One sentence, for cards and link previews. */
  summary: string;
  /** The markdown subset (community spec decision 9), up to 4,000 characters. */
  body: string;
  /** The cover photo. Decorative: the title says what the post is. */
  image: ImageRef;
};
```

- [ ] **Step 4: Rewrite the Hub fixture**

Replace `data/fixtures/hub.ts` with:

```ts
{{HUB_TS}}
```

- [ ] **Step 5: Write the tests for the helpers**

In `lib/time.test.ts`, change the import to `import { longSastDate, sastDate, sastDateTime, sastToday, shortSastDate } from "./time";` and add at the end of the file:

```ts
describe("sastDateTime", () => {
  it("writes the day, date and time in South Africa (community spec 5.3)", () => {
    expect(sastDateTime("2026-10-14T16:00:00Z")).toBe("Wed 14 Oct · 18:00");
    expect(sastDateTime("2026-10-15T11:00:00Z")).toBe("Thu 15 Oct · 13:00");
    expect(sastDateTime("2027-02-11T16:00:00Z")).toBe("Thu 11 Feb · 18:00");
  });

  it("moves to the next day after 22:00 UTC, writing midnight as 00:00", () => {
    expect(sastDateTime("2026-10-14T22:30:00Z")).toBe("Thu 15 Oct · 00:30");
    expect(sastDateTime("2026-10-14T22:00:00Z")).toBe("Thu 15 Oct · 00:00");
  });
});
```

In `lib/format.test.ts`, add `hubKindLabel` and `placesLabel` to the import list (keeping it alphabetical), and add at the end of the file:

```ts
describe("Hub wording (community spec 5.1)", () => {
  it("names each kind of post", () => {
    expect(hubKindLabel("event")).toBe("Event");
    expect(hubKindLabel("office-hours")).toBe("Office hours");
    expect(hubKindLabel("tip")).toBe("Tip");
  });

  it("counts an event's RSVPs and places", () => {
    expect(placesLabel(12, 80)).toBe("12 going · 80 places");
    expect(placesLabel(0, 1)).toBe("0 going · 1 place");
  });
});
```

Create `lib/hub.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hubPosts } from "@/data/fixtures/hub";
import {
  feedKinds,
  feedTypeOf,
  hasPassed,
  hubCampusName,
  hubFeedHref,
  orderHubPosts,
  postDate,
  readHubFeedType,
  toHubEvent,
} from "./hub";

const byId = (id: string) => hubPosts.find((post) => post.id === id)!;
const ids = (posts: readonly { id: string }[]) => posts.map((post) => post.id);

describe("the feed's tabs (community spec 5.1)", () => {
  it("reads ?type=, treating anything it doesn't know as All", () => {
    expect(readHubFeedType("events")).toBe("events");
    expect(readHubFeedType("office-hours")).toBe("office-hours");
    expect(readHubFeedType(["tips", "events"])).toBe("tips");
    expect(readHubFeedType("nope")).toBe("all");
    expect(readHubFeedType(undefined)).toBe("all");
  });

  it("links each tab to the feed, landing on it (plan decision 6)", () => {
    expect(hubFeedHref("all")).toBe("/hub#hub-feed");
    expect(hubFeedHref("office-hours")).toBe("/hub?type=office-hours#hub-feed");
  });

  it("knows which kinds each tab shows, and which tab holds each kind", () => {
    expect(feedKinds("all")).toEqual(["event", "office-hours", "tip"]);
    expect(feedKinds("events")).toEqual(["event"]);
    expect(feedTypeOf("event")).toBe("events");
    expect(feedTypeOf("office-hours")).toBe("office-hours");
    expect(feedTypeOf("tip")).toBe("tips");
  });
});

describe("a post's date (community spec 5.2, decision 6)", () => {
  it("dates events and office hours in South Africa, and tips not at all", () => {
    expect(postDate({ startsAt: "2026-10-14T22:30:00Z" })).toBe("2026-10-15");
    expect(postDate({ startsAt: null })).toBeNull();
  });

  it("counts an event as passed only from the next day in South Africa (plan decision 10)", () => {
    expect(hasPassed(byId("h-001"), "2026-10-14")).toBe(false);
    expect(hasPassed(byId("h-001"), "2026-10-15")).toBe(true);
    expect(hasPassed(byId("h-013"), "2030-01-01")).toBe(false);
  });
});

describe("orderHubPosts (community spec 5.1)", () => {
  it("puts upcoming events and office hours first, soonest first, then tips, newest first", () => {
    const shuffled = [byId("h-014"), byId("h-003"), byId("h-013"), byId("h-002"), byId("h-011")];
    expect(ids(orderHubPosts(shuffled, "2026-10-12"))).toEqual(["h-002", "h-003", "h-013", "h-014"]);
  });

  it("keeps what's on today, and drops what's past", () => {
    expect(ids(orderHubPosts([byId("h-001"), byId("h-002")], "2026-10-15"))).toEqual(["h-002"]);
    expect(ids(orderHubPosts([byId("h-001"), byId("h-002")], "2026-10-14"))).toEqual(["h-001", "h-002"]);
  });
});

describe("toHubEvent (community spec 5.3)", () => {
  it("turns an event into What's on's row with RSVP, and office hours with Book", () => {
    expect(toHubEvent(byId("h-001"))).toEqual({
      id: "h-001",
      date: "2026-10-14",
      title: "Pitch night",
      campusSlug: "all",
      action: "rsvp",
    });
    expect(toHubEvent(byId("h-004"))).toEqual({
      id: "h-004",
      date: "2026-10-22",
      title: "Photo day for your shop",
      campusSlug: "bedfordview",
      action: "book",
    });
  });

  it("leaves tips out", () => {
    expect(toHubEvent(byId("h-013"))).toBeNull();
  });
});

describe("hubCampusName", () => {
  it("says All campuses for every-campus posts, and the campus's name otherwise", () => {
    const names = new Map([["midrand", "Midrand"]]);
    expect(hubCampusName("all", names)).toBe("All campuses");
    expect(hubCampusName("midrand", names)).toBe("Midrand");
  });
});
```

- [ ] **Step 6: Run them to make sure they fail**

Run: `pnpm test lib/time.test.ts lib/format.test.ts lib/hub.test.ts`
Expected: FAIL, because `sastDateTime`, the two wording helpers and `./hub` don't exist.

- [ ] **Step 7: Write the helpers**

In `lib/time.ts`, add at the end:

```ts
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// en-GB writes the 24-hour clock as "18:00"; h23 writes half past midnight as "00:30", never "24:30".
const SAST_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Johannesburg",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * A stored UTC time as a day and time in South Africa: "Wed 14 Oct · 18:00" (community spec 5.3), for events and
 * office hours. It reads no clock, so it's safe while prerendering.
 */
export function sastDateTime(iso: string): string {
  const moment = new Date(iso);
  const date = sastDate(moment);
  const [year, month, day] = date.split("-").map(Number);
  // The weekday of the South African date itself, worked out in UTC so the server's timezone can't move it.
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${dayMonth(date)} · ${SAST_CLOCK.format(moment)}`;
}
```

In `lib/format.ts`, change the import to `import type { Condition, HubPostKind, Listing, LookingForRequest, TrustBadge } from "./types";` and add at the end:

```ts
const HUB_KIND_LABELS: Record<HubPostKind, string> = {
  event: "Event",
  "office-hours": "Office hours",
  tip: "Tip",
};

/** A Hub post's eyebrow (community spec 5.1). */
export function hubKindLabel(kind: HubPostKind): string {
  return HUB_KIND_LABELS[kind];
}

/** An event's numbers (community spec 5.1): "12 going · 80 places". */
export function placesLabel(going: number, capacity: number): string {
  return `${going} going · ${capacity === 1 ? "1 place" : `${capacity} places`}`;
}
```

Create `lib/hub.ts`:

```ts
{{LIB_HUB_TS}}
```

Run: `pnpm test lib/time.test.ts lib/format.test.ts lib/hub.test.ts data/fixtures/fixtures.test.ts`
Expected: PASS.

- [ ] **Step 8: Write the data tests**

In `lib/data/index.test.ts`:

1. Add `getHubPost`, `getHubPostIds`, `getHubPosts` and `getVerifiedSellers` to the import list (keeping it alphabetical).
2. In "lists a campus's events with the every-campus ones, soonest first", the events now carry their posts' ids. Replace the four expected lists, in order, with `["h-001", "h-002", "h-005"]`, `["h-001", "h-005", "h-006"]`, `["h-001", "h-002", "h-003"]` and `["h-002", "h-003", "h-004"]`.
3. Add at the end of the file:

```ts
describe("Hub data (community spec 5.3)", () => {
  const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
  const every = ["event", "office-hours", "tip"] as const;

  it("derives What's on from the posts, with the old events' dates, titles, campuses and actions", async () => {
    const events = await getHubEvents({ campus: "all", limit: 20, from: "2026-10-12" });
    expect(events.map(({ date, title, campusSlug, action }) => ({ date, title, campusSlug, action }))).toEqual([
      { date: "2026-10-14", title: "Pitch night", campusSlug: "all", action: "rsvp" },
      { date: "2026-10-15", title: "Office hours: pricing your hustle", campusSlug: "midrand", action: "book" },
      { date: "2026-10-20", title: "Market day on the lawn", campusSlug: "pretoria", action: "rsvp" },
      { date: "2026-10-22", title: "Photo day for your shop", campusSlug: "bedfordview", action: "book" },
      { date: "2026-10-28", title: "Hub mixer", campusSlug: "all", action: "rsvp" },
      { date: "2026-11-05", title: "Selling online: photos that sell", campusSlug: "all", action: "rsvp" },
      { date: "2026-11-19", title: "Office hours: your first listing", campusSlug: "midrand", action: "book" },
      { date: "2026-12-03", title: "End-of-year market", campusSlug: "all", action: "rsvp" },
      { date: "2027-01-28", title: "Back-to-campus pop-up", campusSlug: "pretoria", action: "rsvp" },
      { date: "2027-02-11", title: "Pitch night", campusSlug: "all", action: "rsvp" },
    ]);
  });

  it("lists the feed: upcoming events and office hours soonest first, then tips newest first", async () => {
    expect(ids(await getHubPosts({ kinds: every, from: "2026-10-12" }))).toEqual([
      "h-001",
      "h-002",
      "h-003",
      "h-004",
      "h-005",
      "h-006",
      "h-007",
      "h-008",
      "h-009",
      "h-010",
      "h-013",
      "h-014",
      "h-015",
      "h-016",
      "h-017",
      "h-018",
    ]);
  });

  it("drops past events and office hours, and has none once the sample ones are over", async () => {
    const upcoming = ids(await getHubPosts({ kinds: ["event", "office-hours"], from: "2026-10-15" }));
    expect(upcoming[0]).toBe("h-002");
    expect(upcoming).toHaveLength(9);
    expect(await getHubPosts({ kinds: ["event", "office-hours"], from: "2027-03-01" })).toEqual([]);
  });

  it("keeps to the kinds asked for", async () => {
    expect(ids(await getHubPosts({ kinds: ["event"], from: "2026-10-12" }))).toEqual([
      "h-001",
      "h-003",
      "h-005",
      "h-006",
      "h-008",
      "h-009",
      "h-010",
    ]);
    expect(ids(await getHubPosts({ kinds: ["office-hours"], from: "2026-10-12" }))).toEqual(["h-002", "h-004", "h-007"]);
    expect(ids(await getHubPosts({ kinds: ["tip"], from: "2026-10-12" }))).toHaveLength(6);
  });

  it("finds any post by id, past ones too, and lists every id for the pages", async () => {
    expect((await getHubPost("h-011"))?.title).toBe("Hub open day");
    expect((await getHubPost("h-013"))?.kind).toBe("tip");
    expect(await getHubPost("nope")).toBeNull();
    expect(await getHubPostIds()).toHaveLength(18);
  });

  it("lists the Hub's Verified sellers A to Z (plan decision 11)", async () => {
    expect((await getVerifiedSellers()).map((seller) => seller.name)).toEqual([
      "Code coach",
      "Design studio",
      "Hair studio",
      "Home bakery",
      "Maths tutor",
      "Nail bar",
      "Phone fix",
      "Study notes",
      "Thrift rack",
    ]);
  });
});
```

In `lib/data/placeholders.test.ts`, add `import { hubPosts } from "@/data/fixtures/hub";` above the `listings` import, and add `...hubPosts.map((post) => post.image.src),` to `sources`, after the `(await getHubBanner()).image.src,` line.

- [ ] **Step 9: Run them to make sure they fail**

Run: `pnpm test lib/data/index.test.ts lib/data/placeholders.test.ts`
Expected: FAIL: the new functions don't exist, `lib/data/index.ts` still imports `hubEvents`, and the posts' covers haven't been drawn.

- [ ] **Step 10: Write the data functions**

In `lib/data/index.ts`:

1. Change `import { hubBanner, hubEvents } from "@/data/fixtures/hub";` to `import { hubBanner, hubPosts } from "@/data/fixtures/hub";`.
2. Add `import { orderHubPosts, toHubEvent } from "@/lib/hub";` after the `@/lib/featured` import.
3. Add `HubPost` and `HubPostKind` to the `import type` list, after `HubEvent`.
4. Replace `getHubEvents` with:

```ts
/**
 * The next Hub events for a campus: its own and the every-campus ones, soonest first (spec 7.13). They're derived from
 * the Hub's posts (community spec 5.3): events become RSVP rows, office hours Book rows.
 */
export async function getHubEvents({ campus, limit, from }: CampusQuery & { from: string }): Promise<readonly HubEvent[]> {
  "use cache";
  // `from` is today's SAST date (YYYY-MM-DD). It keeps past events out, and the cache keys on it, so it turns over each day.
  return orderHubPosts(
    hubPosts.filter((post) => post.kind !== "tip"),
    from,
  )
    .filter((post) => campus === ALL_CAMPUSES || post.campusSlug === ALL_CAMPUSES || post.campusSlug === campus)
    .flatMap((post) => toHubEvent(post) ?? [])
    .slice(0, limit);
}

/**
 * The Hub's feed (community spec 5.1): posts of the given kinds. Events and office hours on or after `from` (today's
 * SAST date) come first, soonest first; tips follow, newest first. The cache keys on `from`, so it turns over each day.
 */
export async function getHubPosts({
  kinds,
  from,
}: {
  kinds: readonly HubPostKind[];
  from: string;
}): Promise<readonly HubPost[]> {
  "use cache";
  return orderHubPosts(
    hubPosts.filter((post) => kinds.includes(post.kind)),
    from,
  );
}

/** A post's page (community spec 5.2), past events and office hours included. */
export async function getHubPost(id: string): Promise<HubPost | null> {
  "use cache";
  return hubPosts.find((post) => post.id === id) ?? null;
}

/** Every post's id, so each post page is prerendered (community spec 3). */
export async function getHubPostIds(): Promise<readonly string[]> {
  "use cache";
  return hubPosts.map((post) => post.id);
}

/** The Hub's Verified sellers (community spec 5.1), A to Z by name so no one is favoured (plan decision 11). */
export async function getVerifiedSellers(): Promise<readonly Seller[]> {
  "use cache";
  return sellers.filter((seller) => seller.verified).sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 11: Draw the posts' covers**

In `scripts/make-placeholders.ts`:

1. Change `import { hubBanner } from "../data/fixtures/hub.ts";` to `import { hubBanner, hubPosts } from "../data/fixtures/hub.ts";`.
2. Replace the comment and the `LABELLED` line:

```ts
// Tiles and cards print their own text over or beside these, so only the larger photos carry a label. The Hub
// banner's heading sits right over its photo, so it has none either.
// The gallery's extra photos are labelled "Photo 2" and "Photo 3", so the gallery can be checked by eye.
const LABELLED = new Set(["hero", "campus", "collection", "seller", "photo"]);
```

with:

```ts
// Tiles and cards print their own text over or beside these, so only the larger photos carry a label. The Hub
// banner's heading sits right over its photo, so it has none either (it's added with no label below); the Hub posts'
// covers share its folder and size, and carry their titles so they can be told apart (community plan decision 4).
// The gallery's extra photos are labelled "Photo 2" and "Photo 3", so the gallery can be checked by eye.
const LABELLED = new Set(["hero", "campus", "collection", "seller", "photo", "hub"]);
```

3. Change `function add(src: string, label: string) {` to `function add(src: string, label: string | null) {`, and in it change `label: LABELLED.has(folder) ? label : null,` to `label: label !== null && LABELLED.has(folder) ? label : null,`.
4. Replace `add(hubBanner.image.src, "Photo: the Incubation Hub");` with:

```ts
for (const post of hubPosts) add(post.image.src, `Photo: ${post.title}`);
add(hubBanner.image.src, null);
```

Check first, then draw (two separate commands):

```bash
git status --short public/placeholders
```

Expected: nothing.

```bash
node scripts/make-placeholders.ts
```

Expected: `Wrote 90 placeholders under public/placeholders.` (the 72 there already, plus 18 covers).

Then run `git status --short public/placeholders` again. Expected: 18 lines, `?? public/placeholders/hub/h-001.svg` to `h-018.svg`, and **no** ` M` lines: the script writes the existing 72 files byte for byte as they were. If any existing file shows as modified, stop and report it; don't restore it yourself.

Open `public/placeholders/hub/h-013.svg` in a browser or viewer: the navy-to-sky gradient, labelled "PHOTO: HOW TO PRICE YOUR FIRST LISTING".

- [ ] **Step 12: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass. `components/home/WhatsOn.test.tsx` passes unchanged: with today faked to 12 October, Midrand still shows Pitch night, Office hours: pricing your hustle and Hub mixer, and its links still go to `/hub` until Task 8.

Then check plain Node still loads the fixture (this writes nothing):

```bash
node -e "import('./data/fixtures/hub.ts').then((h) => console.log(h.hubPosts.length))"
```

Expected: `18`.

- [ ] **Step 13: Hand over for commit**

Files: `lib/types.ts`, `data/fixtures/hub.ts`, `data/fixtures/fixtures.test.ts`, `lib/hub.ts`, `lib/hub.test.ts`, `lib/format.ts`, `lib/format.test.ts`, `lib/time.ts`, `lib/time.test.ts`, `lib/data/index.ts`, `lib/data/index.test.ts`, `lib/data/placeholders.test.ts`, `scripts/make-placeholders.ts`, and the 18 files `public/placeholders/hub/h-001.svg` to `h-018.svg`.
Message: `feat: the Hub becomes one feed of posts, What's on is derived from it, and the posts get covers (community spec 5.3)`

---


### Task 3: The markdown subset

Tip and event bodies use a small markdown subset (spec decision 9): paragraphs, `## ` headings, `- ` bullets, `1. ` numbers, `**bold**`, `*italic*` and `[links](/path)`. `lib/markdown.ts` parses a body into blocks; `components/hub/Markdown.tsx` renders them as React elements on the server, so nothing is ever read as HTML (plan decision 16).

**Files:**
- Create: `lib/markdown.ts`, `lib/markdown.test.ts`
- Create: `components/hub/Markdown.tsx`, `components/hub/Markdown.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the parser's tests**

Create `lib/markdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { markdownText, parseInline, parseMarkdown } from "./markdown";

const text = (value: string) => ({ type: "text", text: value });

describe("parseInline (community spec decision 9)", () => {
  it("keeps plain words as they are", () => {
    expect(parseInline("Plain words")).toEqual([text("Plain words")]);
  });

  it("finds bold and italic", () => {
    expect(parseInline("Price it **fairly**, not *cheaply*.")).toEqual([
      text("Price it "),
      { type: "strong", children: [text("fairly")] },
      text(", not "),
      { type: "em", children: [text("cheaply")] },
      text("."),
    ]);
  });

  it("keeps links to paths on this site", () => {
    expect(parseInline("See [the safety tips](/safety) first.")).toEqual([
      text("See "),
      { type: "link", href: "/safety", children: [text("the safety tips")] },
      text(" first."),
    ]);
    expect(parseInline("[office hours](/hub?type=office-hours)")).toEqual([
      { type: "link", href: "/hub?type=office-hours", children: [text("office hours")] },
    ]);
  });

  it("drops links that lead off the site, keeping their words", () => {
    const source =
      "Read [this](https://evil.example) and [that](//evil.example) and [x](javascript:alert) and [y](/\\evil.example).";
    expect(parseInline(source)).toEqual([text("Read this and that and x and y.")]);
  });

  it("leaves stray stars alone", () => {
    expect(parseInline("2 * 3 * 4 and ** loose **")).toEqual([text("2 * 3 * 4 and ** loose **")]);
  });

  it("allows a link inside bold", () => {
    expect(parseInline("**Bold with [a link](/sell)**")).toEqual([
      { type: "strong", children: [text("Bold with "), { type: "link", href: "/sell", children: [text("a link")] }] },
    ]);
  });

  it("treats HTML as plain text", () => {
    expect(parseInline("<b>hi</b> <script>alert(1)</script>")).toEqual([text("<b>hi</b> <script>alert(1)</script>")]);
  });
});

describe("parseMarkdown (community spec decision 9)", () => {
  it("runs lines together into a paragraph until a blank line", () => {
    expect(parseMarkdown("First line\nsame paragraph\n\nSecond paragraph")).toEqual([
      { type: "paragraph", children: [text("First line same paragraph")] },
      { type: "paragraph", children: [text("Second paragraph")] },
    ]);
  });

  it("reads ## headings, - bullets and 1. numbers", () => {
    expect(parseMarkdown("## A heading\n- one\n- two\n\n1. first\n2. second\nAfter the list")).toEqual([
      { type: "heading", children: [text("A heading")] },
      { type: "bullets", items: [[text("one")], [text("two")]] },
      { type: "numbers", items: [[text("first")], [text("second")]] },
      { type: "paragraph", children: [text("After the list")] },
    ]);
  });

  it("starts a new list when the kind of item changes", () => {
    expect(parseMarkdown("- a\n1. b")).toEqual([
      { type: "bullets", items: [[text("a")]] },
      { type: "numbers", items: [[text("b")]] },
    ]);
  });

  it("treats other hashes as text, and Windows line endings like any others", () => {
    expect(parseMarkdown("# Not a heading\n### Nor this")).toEqual([
      { type: "paragraph", children: [text("# Not a heading ### Nor this")] },
    ]);
    expect(parseMarkdown("\r\n\r\nHello\r\nthere\r\n")).toEqual([{ type: "paragraph", children: [text("Hello there")] }]);
  });

  it("has nothing for an empty body", () => {
    expect(parseMarkdown("")).toEqual([]);
  });
});

describe("markdownText", () => {
  it("gives a body as plain words, for its page's description (community spec 5.2)", () => {
    expect(markdownText("## Start here\nPrice it **fairly**.\n\n- one\n- [two](/sell)")).toBe(
      "Start here Price it fairly. one two",
    );
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test lib/markdown.test.ts`
Expected: FAIL, because `./markdown` doesn't exist.

- [ ] **Step 3: Write the parser**

Create `lib/markdown.ts`:

```ts
{{LIB_MARKDOWN_TS}}
```

Run: `pnpm test lib/markdown.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the renderer's tests**

Create `components/hub/Markdown.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown (community spec decision 9)", () => {
  it("renders paragraphs, headings, bullets and numbers", () => {
    render(<Markdown source={"Intro line\n\n## Before you list\n- one\n- two\n\n1. first\n2. second"} />);
    expect(screen.getByText("Intro line").tagName).toBe("P");
    expect(screen.getByRole("heading", { level: 2, name: "Before you list" })).toBeInTheDocument();
    const [bullets, numbers] = screen.getAllByRole("list");
    expect(bullets.tagName).toBe("UL");
    expect(within(bullets).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["one", "two"]);
    expect(numbers.tagName).toBe("OL");
    expect(within(numbers).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["first", "second"]);
  });

  it("renders bold, italic and links inside the site", () => {
    const { container } = render(
      <Markdown source="Price it **fairly**, not *cheaply*. See [the safety tips](/safety)." />,
    );
    expect(container.querySelector("strong")).toHaveTextContent("fairly");
    expect(container.querySelector("em")).toHaveTextContent("cheaply");
    expect(screen.getByRole("link", { name: "the safety tips" })).toHaveAttribute("href", "/safety");
  });

  it("keeps the words of a link that leads off the site, but not the link", () => {
    render(<Markdown source="Read [this](https://evil.example) and [that](//evil.example)." />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Read this and that.")).toBeInTheDocument();
  });

  it("shows HTML as text, never as markup", () => {
    const { container } = render(<Markdown source={'<img src="x" onerror="alert(1)"> **<b>hi</b>**'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container).toHaveTextContent('<img src="x" onerror="alert(1)"> <b>hi</b>');
  });

  it("takes a class for where it sits", () => {
    const { container } = render(<Markdown source="Hello" className="hub-post-body" />);
    expect(container.firstChild).toHaveClass("markdown", "hub-post-body");
  });
});
```

- [ ] **Step 5: Run them to make sure they fail**

Run: `pnpm test components/hub/Markdown.test.tsx`
Expected: FAIL, because `./Markdown` doesn't exist.

- [ ] **Step 6: Write the renderer**

Create `components/hub/Markdown.tsx`:

```tsx
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { parseMarkdown, type MarkdownBlock, type MarkdownInline } from "@/lib/markdown";

function renderInline(parts: readonly MarkdownInline[]): ReactNode[] {
  return parts.map((part, index) => {
    if (part.type === "text") return <Fragment key={index}>{part.text}</Fragment>;
    if (part.type === "strong") return <strong key={index}>{renderInline(part.children)}</strong>;
    if (part.type === "em") return <em key={index}>{renderInline(part.children)}</em>;
    // Only paths on this site get this far (lib/markdown.ts). No prefetch: a post's links are rarely followed.
    return (
      <Link key={index} href={part.href} prefetch={false}>
        {renderInline(part.children)}
      </Link>
    );
  });
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  if (block.type === "heading") return <h2 key={index}>{renderInline(block.children)}</h2>;
  if (block.type === "paragraph") return <p key={index}>{renderInline(block.children)}</p>;
  const items = block.items.map((item, n) => <li key={n}>{renderInline(item)}</li>);
  return block.type === "bullets" ? <ul key={index}>{items}</ul> : <ol key={index}>{items}</ol>;
}

/**
 * A Hub post's body (community spec decision 9): the markdown subset, turned into React elements on the server. Text
 * is never read as HTML, so anything that looks like a tag shows as written. Headings are h2s, under the page's h1.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return <div className={cx("markdown", className)}>{parseMarkdown(source).map(renderBlock)}</div>;
}
```

Run: `pnpm test components/hub/Markdown.test.tsx`
Expected: PASS.

- [ ] **Step 7: The body's styles**

Add at the end of `app/globals.css`:

```css
/* --- Community: post bodies (community plan, Task 3, spec decision 9) --- */
@layer components {
  /* A Hub post's body (components/hub/Markdown.tsx): lines of about 65 characters, with room between blocks. */
  .markdown {
    max-width: 65ch;
    color: var(--color-ink);
  }

  .markdown > * + * {
    margin-top: 14px;
  }

  .markdown h2 {
    margin-top: 28px;
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 22px;
    line-height: 1.1;
    text-transform: uppercase;
  }

  .markdown > h2:first-child {
    margin-top: 0;
  }

  .markdown ul,
  .markdown ol {
    padding-left: 1.4em;
  }

  .markdown ul {
    list-style: disc;
  }

  .markdown ol {
    list-style: decimal;
  }

  .markdown li + li {
    margin-top: 6px;
  }

  .markdown strong {
    font-weight: 700;
  }

  /* Links on white are sky-dark and underlined (community spec 6). Links inside a paragraph are exempt from the 44px
     target size (WCAG 2.5.8). */
  .markdown a {
    color: var(--color-sky-dark);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}
```

- [ ] **Step 8: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass. Check the renderer never writes raw HTML: `grep -rn "dangerouslySetInnerHTML" components/hub lib/markdown.ts` prints nothing.

- [ ] **Step 9: Hand over for commit**

Files: `lib/markdown.ts`, `lib/markdown.test.ts`, `components/hub/Markdown.tsx`, `components/hub/Markdown.test.tsx`, `app/globals.css`.
Message: `feat: a small server-side markdown renderer for Hub posts, keeping links inside the site (community spec decision 9)`

---


### Task 4: The Looking For board

The board (spec 4.1): the heading and Post a request, prerendered; then, per request, the category chips and the open requests, the viewer's campus first. The chips come from a small `LinkTabs` component the Hub's tabs reuse in Task 6 (plan decision 7).

**Files:**
- Create: `components/ui/LinkTabs.tsx`, `components/ui/LinkTabs.test.tsx`
- Create: `components/looking-for/RequestRow.tsx`, `components/looking-for/RequestRow.test.tsx`
- Create: `components/looking-for/RequestBoard.tsx`, `components/looking-for/RequestBoard.test.tsx`
- Create: `components/looking-for/BoardSkeleton.tsx`
- Modify: `app/looking-for/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`

- [ ] **Step 1: Read the docs**

Read `page.md` in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/` (the `searchParams` prop and `PageProps`) and `cookies.md` in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`. `app/browse/page.tsx` and `components/browse/BrowseView.tsx` are the pattern: a prerendered frame, and a body that reads the link and the viewer inside `<Suspense>`.

- [ ] **Step 2: Write the tabs' tests**

Create `components/ui/LinkTabs.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkTabs } from "./LinkTabs";

const tabs = [
  { key: "all", label: "All", href: "/looking-for" },
  { key: "tech", label: "Tech", href: "/looking-for?cat=tech" },
];

describe("LinkTabs (community spec 4.1 and 5.1)", () => {
  it("lists the links in a named row, marking the current one", () => {
    render(<LinkTabs label="Categories" tabs={tabs} current="tech" look="chips" />);
    const nav = screen.getByRole("navigation", { name: "Categories" });
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/looking-for",
      "/looking-for?cat=tech",
    ]);
    expect(within(nav).getByRole("link", { name: "Tech" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("looks like chips, or like browse's tabs (plan decision 7)", () => {
    const { unmount } = render(<LinkTabs label="Categories" tabs={tabs} current="all" look="chips" />);
    expect(screen.getByRole("navigation")).toHaveClass("link-chips");
    expect(screen.getByRole("link", { name: "All" })).toHaveClass("link-chip");
    unmount();
    render(<LinkTabs label="Post types" tabs={tabs} current="all" look="tabs" />);
    expect(screen.getByRole("navigation")).toHaveClass("category-tabs");
    expect(screen.getByRole("link", { name: "All" })).toHaveClass("category-tab");
  });
});
```

- [ ] **Step 3: Write the row's tests**

Create `components/looking-for/RequestRow.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getRequest } from "@/lib/data";
import { RequestRow } from "./RequestRow";

async function show(id: string, campusName: string, categoryName: string) {
  return render(<RequestRow request={(await getRequest(id))!} campusName={campusName} categoryName={categoryName} />);
}

describe("RequestRow (community spec 4.1)", () => {
  it("links the title to the request's page", async () => {
    await show("r-001", "Midrand", "Tutoring");
    expect(screen.getByRole("heading", { level: 3, name: "Accounting 1 tutor this week" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accounting 1 tutor this week" })).toHaveAttribute(
      "href",
      "/looking-for/r-001",
    );
  });

  it("says where, what and the budget, then when it was posted (in SAST) and the offers", async () => {
    const { container } = await show("r-001", "Midrand", "Tutoring");
    expect(screen.getByText("Midrand · Tutoring · Budget R300")).toBeInTheDocument();
    expect(screen.getByText(/^Posted/)).toHaveTextContent("Posted 13 Oct · 2 offers");
    expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-10-13T07:30:00Z");
  });

  it("shows a swap, an open budget and no offers in plain words", async () => {
    const { unmount } = await show("r-007", "Eduvos Online", "Textbooks & notes");
    expect(screen.getByText("Eduvos Online · Textbooks & notes · Budget R150 or a swap")).toBeInTheDocument();
    unmount();
    await show("r-013", "Potchefstroom", "Tech");
    expect(screen.getByText("Potchefstroom · Tech · Open to offers or a swap")).toBeInTheDocument();
    expect(screen.getByText(/^Posted/)).toHaveTextContent("Posted 6 Oct · No offers yet");
  });
});
```

- [ ] **Step 4: Write the board's tests**

Create `components/looking-for/RequestBoard.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestBoard } from "./RequestBoard";

const viewer = vi.hoisted(() => ({ campus: "all" }));
const board = vi.hoisted(() => ({ failing: false }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getOpenRequests: async (query: Parameters<typeof actual.getOpenRequests>[0]) => {
      if (board.failing) throw new Error("The requests didn't load");
      return actual.getOpenRequests(query);
    },
  };
});

afterEach(() => {
  viewer.campus = "all";
  board.failing = false;
});

const show = async (params: Record<string, string> = {}) =>
  render(await RequestBoard({ searchParams: Promise.resolve(params) }));

/** The request titles in one of the board's sections, in order. */
const titles = (section: string) =>
  within(screen.getByRole("region", { name: section }))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

describe("RequestBoard (community spec 4.1)", () => {
  it("lists every open request, newest first, under one heading when no campus is chosen", async () => {
    await show();
    const all = titles("Open requests");
    expect(all).toHaveLength(14);
    expect(all[0]).toBe("Accounting 1 tutor this week");
    expect(all).not.toContain("Kettle for res");
    expect(screen.queryByRole("region", { name: "Other campuses" })).toBeNull();
  });

  it("puts the viewer's campus first, then every other campus", async () => {
    viewer.campus = "midrand";
    await show();
    expect(titles("At Midrand")).toEqual(["Accounting 1 tutor this week", "Birthday cake for Friday"]);
    expect(titles("Other campuses")).toHaveLength(12);
  });

  it("says when the viewer's campus has none, and still shows the rest", async () => {
    viewer.campus = "mbombela";
    await show();
    const own = screen.getByRole("region", { name: "At Mbombela" });
    expect(within(own).getByText("Nothing at Mbombela yet.")).toBeInTheDocument();
    expect(titles("Other campuses")).toHaveLength(14);
  });

  it("narrows to the category in the link, its chip current", async () => {
    await show({ cat: "tech" });
    const chips = screen.getByRole("navigation", { name: "Categories" });
    expect(within(chips).getAllByRole("link")).toHaveLength(11);
    expect(within(chips).getByRole("link", { name: "Tech" })).toHaveAttribute("aria-current", "page");
    expect(within(chips).getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/looking-for?cat=tech");
    expect(within(chips).getByRole("link", { name: "All" })).toHaveAttribute("href", "/looking-for");
    expect(titles("Open requests")).toEqual(["Graphic calculator to borrow for exams", "Laptop charger, Lenovo 65W"]);
  });

  it("ignores a category it doesn't know", async () => {
    await show({ cat: "nope" });
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    expect(titles("Open requests")).toHaveLength(14);
  });

  it("invites the first request when a category has nothing open", async () => {
    await show({ cat: "tickets-events" });
    expect(screen.getByText("No requests here yet. Be the first to ask.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute("href", "/login?next=%2Flooking-for");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("says so when the requests don't load, with a way to try again, and keeps the chips", async () => {
    board.failing = true;
    await show({ cat: "food" });
    expect(screen.getByText("We couldn't load requests just now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/looking-for?cat=food");
    expect(screen.getByRole("navigation", { name: "Categories" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run them to make sure they fail**

Run: `pnpm test components/ui/LinkTabs.test.tsx components/looking-for`
Expected: FAIL, because the components don't exist.

- [ ] **Step 6: Write the tabs**

Create `components/ui/LinkTabs.tsx`:

```tsx
import Link from "next/link";

export type LinkTab = { key: string; label: string; href: string };

type LinkTabsProps = {
  /** The row's name for screen readers, e.g. "Categories". */
  label: string;
  tabs: readonly LinkTab[];
  /** The key of the tab this page shows. */
  current: string;
  /** "chips": pills, the board's (plan decision 7). "tabs": browse's underlined tabs, the Hub's. */
  look: "chips" | "tabs";
};

/**
 * A row of filter links (community spec 4.1 and 5.1), the one this page shows marked with aria-current. It scrolls
 * sideways on phones when it doesn't fit, like browse's category tabs. No prefetching: each link is a different page
 * of results (decision 28).
 */
export function LinkTabs({ label, tabs, current, look }: LinkTabsProps) {
  const chips = look === "chips";
  return (
    <nav aria-label={label} className={chips ? "link-chips" : "category-tabs"}>
      <ul>
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              prefetch={false}
              aria-current={tab.key === current ? "page" : undefined}
              className={chips ? "link-chip" : "category-tab"}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 7: Write the row**

Create `components/looking-for/RequestRow.tsx`:

```tsx
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { budgetLabel, offersLabel } from "@/lib/format";
import { shortSastDate } from "@/lib/time";
import type { LookingForRequest } from "@/lib/types";

type RequestRowProps = {
  request: LookingForRequest;
  campusName: string;
  categoryName: string;
};

/**
 * One request on the board (community spec 4.1): the title, then where, what and the budget, then when it was posted
 * and how many offers it has. The title's link covers the whole row. It names no one (community spec decision 2).
 */
export function RequestRow({ request, campusName, categoryName }: RequestRowProps) {
  return (
    <article className="board-row">
      <h3 className="board-row-title">
        {/* No prefetch: a list of requests, most of which won't be opened (decision 28). */}
        <Link href={`/looking-for/${request.id}`} prefetch={false} className="board-row-link">
          {request.title}
        </Link>
      </h3>
      <p className="board-row-meta">
        {campusName} · {categoryName} · {budgetLabel(request)}
      </p>
      <p className="board-row-meta">
        Posted <time dateTime={request.createdAt}>{shortSastDate(request.createdAt)}</time> ·{" "}
        {offersLabel(request.offers)}
      </p>
      <ArrowRightIcon className="board-row-arrow" />
    </article>
  );
}
```

- [ ] **Step 8: Write the board and its skeleton**

Create `components/looking-for/RequestBoard.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { getCampuses, getCategories, getOpenRequests } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { signInHref } from "@/lib/next-path";
import { boardHref, readRequestCategory, splitByCampus } from "@/lib/requests";
import type { CampusChoice, LookingForRequest } from "@/lib/types";
import { RequestRow } from "./RequestRow";

type Names = { campuses: ReadonlyMap<string, string>; categories: ReadonlyMap<string, string> };

type RequestBoardProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The Looking For board's body (community spec 4.1): the category chips, then the open requests, the viewer's campus
 * first. It reads the campus cookie and `?cat=`, so it renders per request, inside the page's <Suspense>. If the
 * requests don't load, the chips still work.
 */
export async function RequestBoard({ searchParams }: RequestBoardProps) {
  const [params, viewer, campuses, categories] = await Promise.all([
    searchParams,
    getViewerContext(),
    getCampuses(),
    getCategories(),
  ]);
  const category = readRequestCategory(params.cat, categories);
  const requests = await getOpenRequests({ category }).catch(() => null);
  const names: Names = {
    campuses: new Map(campuses.map((campus) => [campus.slug, campus.name])),
    categories: new Map(categories.map((item) => [item.slug, item.name])),
  };

  let body: ReactNode;
  if (requests === null) {
    body = (
      <div className="section-error">
        <p>We couldn&apos;t load requests just now.</p>
        <a href={boardHref(category)} className="btn btn-outline text-navy">
          Try again
        </a>
      </div>
    );
  } else if (requests.length === 0) {
    body = (
      <div className="board-empty">
        <p>No requests here yet. Be the first to ask.</p>
        <Link href={signInHref("/looking-for")} prefetch={false} className="btn btn-primary">
          Post a request
        </Link>
      </div>
    );
  } else {
    body = <BoardLists requests={requests} campus={viewer.campus} names={names} />;
  }

  const chips = [
    { key: "all", label: "All", href: boardHref(null) },
    ...categories.map((item) => ({ key: item.slug, label: item.name, href: boardHref(item.slug) })),
  ];

  return (
    <>
      <LinkTabs label="Categories" tabs={chips} current={category ?? "all"} look="chips" />
      {body}
    </>
  );
}

type BoardListsProps = { requests: readonly LookingForRequest[]; campus: CampusChoice; names: Names };

/** One list with no campus chosen; otherwise the viewer's campus, then every other (community spec 4.1). */
function BoardLists({ requests, campus, names }: BoardListsProps) {
  const split = splitByCampus(requests, campus);
  if (split === null) {
    return (
      <BoardSection id="board-all" title="Open requests">
        <RequestList requests={requests} names={names} />
      </BoardSection>
    );
  }

  const campusName = names.campuses.get(campus) ?? "";
  return (
    <>
      <BoardSection id="board-own" title={`At ${campusName}`}>
        {split.own.length > 0 ? (
          <RequestList requests={split.own} names={names} />
        ) : (
          <p className="board-none">Nothing at {campusName} yet.</p>
        )}
      </BoardSection>
      {split.others.length > 0 && (
        <BoardSection id="board-others" title="Other campuses">
          <RequestList requests={split.others} names={names} />
        </BoardSection>
      )}
    </>
  );
}

function BoardSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="board-section">
      <h2 id={`${id}-title`} className="listing-section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

function RequestList({ requests, names }: { requests: readonly LookingForRequest[]; names: Names }) {
  return (
    <ul className="board-list">
      {requests.map((request) => (
        <li key={request.id}>
          <RequestRow
            request={request}
            campusName={names.campuses.get(request.campusSlug) ?? ""}
            categoryName={names.categories.get(request.categorySlug) ?? ""}
          />
        </li>
      ))}
    </ul>
  );
}
```

Create `components/looking-for/BoardSkeleton.tsx`:

```tsx
/** The board's shape while it streams in (community spec 3): the chips, a heading and six rows, so nothing jumps. */
export function BoardSkeleton() {
  return (
    <div aria-hidden="true">
      <span className="skeleton board-skeleton-chips" />
      <span className="skeleton board-skeleton-heading" />
      <ul className="board-list">
        {Array.from({ length: 6 }, (_, n) => (
          <li key={n}>
            <span className="skeleton board-skeleton-row" />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Run: `pnpm test components/ui/LinkTabs.test.tsx components/looking-for`
Expected: PASS.

- [ ] **Step 9: The page**

Replace `app/looking-for/page.tsx` with:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BoardSkeleton } from "@/components/looking-for/BoardSkeleton";
import { RequestBoard } from "@/components/looking-for/RequestBoard";
import { signInHref } from "@/lib/next-path";

/** Fixed: `?cat=` views share the board's title and description, and stay indexed (plan decision 14). */
export const metadata: Metadata = {
  title: "Looking For",
  description: "Post what you need, and students who can help will offer. Open requests from every Eduvos campus.",
};

/**
 * The Looking For board (community spec 4.1). The heading is prerendered; the chips and requests read the campus
 * cookie and `?cat=`, so they stream in behind a skeleton. Posting needs an account, so Post a request goes to the
 * sign-in page and comes back to the board (community spec decision 1, plan decision 19).
 */
export default function LookingForPage({ searchParams }: PageProps<"/looking-for">) {
  return (
    <div className="page board">
      <div className="board-head">
        <h1 className="board-title">Looking For</h1>
        <p className="board-lede">Post what you need, and students who can help will offer.</p>
        <Link href={signInHref("/looking-for")} prefetch={false} className="btn btn-primary board-post">
          Post a request
        </Link>
      </div>
      <Suspense fallback={<BoardSkeleton />}>
        <RequestBoard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 10: The board's styles**

Add at the end of `app/globals.css`:

```css
/* --- Community: the Looking For board and filter chips (community plan, Task 4, spec 4.1) --- */
@layer components {
  /* .page and .board sit on one element, so this padding replaces .page's gutter: it's the whole content edge, 16px on
     phones and 40px from the tablet step. */
  .board {
    padding: 24px 16px 64px;
  }

  .board-head {
    display: grid;
    justify-items: start;
    gap: 12px;
  }

  .board-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
  }

  .board-lede {
    max-width: 50ch;
  }

  .board-post {
    margin-top: 4px;
  }

  /* LinkTabs' chips: one row that scrolls sideways on phones, out to the screen's edges, and wraps from the tablet
     step (plan decision 7). The padding keeps focus rings inside the scroll box, which would clip them. */
  .link-chips {
    margin-top: 24px;
  }

  .link-chips ul {
    display: flex;
    gap: 8px;
    margin-inline: -16px;
    padding: 6px 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .link-chips ul::-webkit-scrollbar {
    display: none;
  }

  .link-chip {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
    color: var(--color-navy);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
  }

  .link-chip:focus-visible {
    outline-offset: 2px;
  }

  /* The chosen chip is filled, so it doesn't rely on colour alone. Where the browser supports it, the row starts
     scrolled to it, as browse's tabs do. */
  .link-chip[aria-current="page"] {
    background: var(--color-navy);
    color: var(--color-white);
    scroll-initial-target: nearest;
  }

  .board-section {
    margin-top: 32px;
  }

  .board-list {
    margin-top: 12px;
    border-top: 1px solid var(--color-line);
  }

  .board-list > li {
    border-bottom: 1px solid var(--color-line);
  }

  /* The title's link covers the whole row (::after), so the row is one target, well over 44px tall. */
  .board-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 20px;
    align-items: center;
    column-gap: 12px;
    padding-block: 14px;
  }

  .board-row > :not(.board-row-arrow) {
    grid-column: 1;
  }

  .board-row-arrow {
    grid-column: 2;
    grid-row: 1 / span 3;
    width: 20px;
    height: 20px;
    color: var(--color-navy);
  }

  .board-row-title {
    color: var(--color-navy);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.35;
  }

  .board-row-link::after {
    content: "";
    position: absolute;
    inset: 0;
  }

  /* The ring goes round the whole row. Without :has() (iOS before 15.4) the link keeps its own ring. */
  @supports selector(:has(*)) {
    .board-row-link:focus-visible {
      outline: none;
      box-shadow: none;
    }

    .board-row:has(.board-row-link:focus-visible) {
      border-radius: 8px;
      outline: 2.5px solid var(--color-navy);
      outline-offset: 2px;
    }
  }

  .board-row-meta {
    margin-top: 2px;
    color: var(--color-muted);
    font-size: 13px;
  }

  /* Navy on the grey panel. */
  .board-none,
  .board-empty {
    margin-top: 12px;
    padding: 20px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
    color: var(--color-navy);
    font-weight: 600;
  }

  .board-empty {
    display: grid;
    justify-items: start;
    gap: 14px;
    margin-top: 24px;
    padding: 28px 20px;
  }

  /* The skeleton has the real chips', heading's and rows' heights (a row is 94px with its padding), so the board lands
     where the skeleton was. */
  .board-skeleton-chips {
    height: 44px;
    margin-block: 30px 6px;
    border-radius: 999px;
  }

  .board-skeleton-heading {
    width: 12rem;
    height: 24px;
    margin-top: 32px;
  }

  .board-skeleton-row {
    height: 66px;
    margin-block: 14px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .board {
      padding-inline: 40px;
    }

    .link-chips ul {
      flex-wrap: wrap;
      margin-inline: 0;
      padding-inline: 0;
      overflow-x: visible;
    }

    /* The eleven chips wrap onto two rows from the tablet step. */
    .board-skeleton-chips {
      height: 96px;
      border-radius: var(--radius-card);
    }
  }

  /* Desktop: the heading and lede on the left, Post a request on the right. */
  @media (min-width: 64rem) and (min-height: 30rem) {
    .board-head {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
      column-gap: 40px;
    }

    .board-title,
    .board-lede {
      grid-column: 1;
    }

    .board-post {
      grid-column: 2;
      grid-row: 1 / span 2;
      margin-top: 0;
    }
  }
}
```

- [ ] **Step 11: The board is no longer a placeholder**

In `tests/e2e/routes.spec.ts`, delete the `["/looking-for", "Looking For"],` row from `PLACEHOLDERS`.

In `tests/e2e/performance.spec.ts`, add a row at the end of `PAGES` (after the collection page's):

```ts
  ["Looking For board", "/looking-for"],
```

- [ ] **Step 12: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build lists `/looking-for` as partly prerendered (a static shell with streamed content), like `/browse`.

- [ ] **Step 13: Look at it**

Start the build (`pnpm start --port 3201`) and check, at 390 × 844, 768 × 1024 and 1280 × 800:
- `/looking-for` with no cookie: "LOOKING FOR", the lede, Post a request (navy). The chips: All filled navy, then the ten categories, in one row that scrolls sideways on the phone (out to the screen's edges) and wrapped onto two rows on the tablet and desktop. "OPEN REQUESTS", then 14 rows, each with the title, "Midrand · Tutoring · Budget R300" and "Posted 13 Oct · 2 offers", an arrow on the right, and hairlines between. Tapping anywhere on a row opens the request (a 404 until Task 5; that's expected).
- With the cookie `vossie_campus=midrand` (add it with `context.addCookies`): "AT MIDRAND" with 2 rows, then "OTHER CAMPUSES" with 12.
- With `vossie_campus=mbombela`: "AT MBOMBELA", the grey "Nothing at Mbombela yet.", then "OTHER CAMPUSES" with 14.
- `/looking-for?cat=tickets-events`: the Tickets & events chip filled, then "No requests here yet. Be the first to ask." on grey with Post a request.
- On desktop, Post a request sits to the right of the heading.
- Tab through the page: the ring goes round a whole row.

Stop the server.

- [ ] **Step 14: Measure the JS**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/routes.spec.ts --project=phone-390`
Expected: all pass. Note the `scriptBrotli` figures. If any page is past the stop line (the JS ledger), stop here and report.

- [ ] **Step 15: Hand over for commit**

Files: `components/ui/LinkTabs.tsx`, `components/ui/LinkTabs.test.tsx`, `components/looking-for/RequestRow.tsx`, `components/looking-for/RequestRow.test.tsx`, `components/looking-for/RequestBoard.tsx`, `components/looking-for/RequestBoard.test.tsx`, `components/looking-for/BoardSkeleton.tsx`, `app/looking-for/page.tsx`, `app/globals.css`, `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`.
Message: `feat: the Looking For board, with category chips and the viewer's campus first (community spec 4.1). JS: board <n> B`

---


### Task 5: A request's page

A request's page (spec 4.2): the breadcrumb, the title and facts, the asker's words, the offers and Offer to help, listings already on Vossie, and the report link. Every request is prerendered.

**Files:**
- Create: `components/looking-for/RequestView.tsx`, `components/looking-for/RequestView.test.tsx`
- Create: `components/looking-for/RelatedListings.tsx`, `components/looking-for/RelatedListings.test.tsx`
- Create: `app/looking-for/[id]/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`

- [ ] **Step 1: Read the docs**

Read `generate-metadata.md`, `generate-static-params.md` and `not-found.md` in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`. `app/sellers/[slug]/page.tsx` is the pattern to follow: `generateStaticParams`, `params` awaited inside `<Suspense>`, `notFound()` for an unknown id, and no `dynamicParams` export.

- [ ] **Step 2: Write the related listings' tests**

Create `components/looking-for/RelatedListings.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCampuses, getRequest } from "@/lib/data";
import { RelatedListings } from "./RelatedListings";

const load = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getRelatedListings: async (query: Parameters<typeof actual.getRelatedListings>[0]) => {
      if (load.mode === "failing") throw new Error("Didn't load");
      return load.mode === "empty" ? [] : actual.getRelatedListings(query);
    },
  };
});

afterEach(() => {
  load.mode = "real";
});

async function show(id: string, categoryName: string) {
  const [request, campuses] = await Promise.all([getRequest(id), getCampuses()]);
  return render(
    await RelatedListings({
      request: request!,
      categoryName,
      campusNames: new Map(campuses.map((campus) => [campus.slug, campus.name])),
    }),
  );
}

describe("RelatedListings (community spec 4.2, decision 4)", () => {
  it("shows up to 4 listings in the request's category, its campus first, 4 across on desktop", async () => {
    await show("r-001", "Tutoring");
    const region = screen.getByRole("region", { name: "Already on Vossie" });
    const grid = within(region).getByRole("list");
    expect(grid).toHaveAttribute("data-columns", "four");
    expect(within(grid).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/listings/l-005",
      "/listings/l-013",
      "/listings/l-031",
      "/listings/l-025",
    ]);
    expect(within(grid).getAllByText("Midrand")).toHaveLength(1);
  });

  it("links to the rest of the category in browse", async () => {
    await show("r-001", "Tutoring");
    expect(screen.getByRole("link", { name: "See all in Tutoring" })).toHaveAttribute("href", "/browse?cat=tutoring");
  });

  it("hides when nothing in the category is listed", async () => {
    load.mode = "empty";
    const { container } = await show("r-001", "Tutoring");
    expect(container).toBeEmptyDOMElement();
  });

  it("shows its own error, with a way back to this request", async () => {
    load.mode = "failing";
    await show("r-001", "Tutoring");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/looking-for/r-001?retry=already-on-vossie#already-on-vossie",
    );
  });
});
```

- [ ] **Step 3: Write the page frame's tests**

Create `components/looking-for/RequestView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getCampuses, getCategories, getRequest } from "@/lib/data";
import { RequestView } from "./RequestView";

// The async listings are tested on their own; here they stand in (jsdom can't render async components in a tree).
vi.mock("./RelatedListings", () => ({ RelatedListings: () => <section aria-label="Already on Vossie, stood in" /> }));

async function show(id: string) {
  const [request, categories, campuses] = await Promise.all([getRequest(id), getCategories(), getCampuses()]);
  const category = categories.find((item) => item.slug === request!.categorySlug)!;
  return render(
    <RequestView
      request={request!}
      category={category}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />,
  );
}

const facts = (container: HTMLElement) =>
  within(container.querySelector<HTMLElement>(".request-facts")!)
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("RequestView (community spec 4.2)", () => {
  it("leads with the breadcrumb and the title", async () => {
    await show("r-001");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Looking For" })).toHaveAttribute("href", "/looking-for");
    expect(within(crumbs).getByRole("link", { name: "Tutoring" })).toHaveAttribute("href", "/looking-for?cat=tutoring");
    expect(screen.getByRole("heading", { level: 1, name: "Accounting 1 tutor this week" })).toBeInTheDocument();
  });

  it("lists the facts, naming the campus but never the asker (community spec decision 2)", async () => {
    const { container } = await show("r-001");
    expect(facts(container)).toEqual([
      "Midrand",
      "Tutoring",
      "Budget R300",
      "Needed by 16 Oct",
      "Posted 13 Oct",
      "Asked by a student at Midrand",
    ]);
    expect(container.querySelector('time[datetime="2026-10-16"]')).toHaveTextContent("16 Oct");
  });

  it("leaves Needed by out when there's no date", async () => {
    const { container } = await show("r-004");
    expect(facts(container)).toEqual([
      "Bedfordview",
      "Res & living",
      "Budget R1,200",
      "Posted 11 Oct",
      "Asked by a student at Bedfordview",
    ]);
  });

  it("keeps the asker's own words and line breaks", async () => {
    await show("r-001");
    expect(screen.getByText(/stuck on adjustments and the trial balance/)).toHaveClass("request-details");
  });

  it("counts the offers so far and offers to help, through the sign-in page", async () => {
    await show("r-001");
    const offers = screen.getByRole("region", { name: "Offers" });
    expect(within(offers).getByText("2 offers so far")).toBeInTheDocument();
    expect(within(offers).getByRole("link", { name: "Offer to help" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fr-001",
    );
  });

  it("invites the first offer", async () => {
    await show("r-004");
    expect(screen.getByText("No offers yet. Be the first.")).toBeInTheDocument();
  });

  it("says a closed request is closed, with no count and no button (plan decision 8)", async () => {
    await show("r-015");
    const offers = screen.getByRole("region", { name: "Offers" });
    expect(within(offers).getByText("This request is closed")).toBeInTheDocument();
    expect(screen.queryByText(/offers? so far/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Offer to help" })).toBeNull();
  });

  it("shows listings already on Vossie, then a report link through the sign-in page", async () => {
    await show("r-001");
    expect(screen.getByRole("region", { name: "Already on Vossie, stood in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Report this request" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fr-001",
    );
  });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test components/looking-for/RequestView.test.tsx components/looking-for/RelatedListings.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 5: Write the related listings**

Create `components/looking-for/RelatedListings.tsx`:

```tsx
import Link from "next/link";
import { SectionError } from "@/components/home/SectionError";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { getRelatedListings } from "@/lib/data";
import type { LookingForRequest } from "@/lib/types";

type RelatedListingsProps = {
  request: Pick<LookingForRequest, "id" | "categorySlug" | "campusSlug">;
  categoryName: string;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * "Already on Vossie" (community spec 4.2, decision 4): up to 4 available listings in the request's category, its
 * campus first, then a link to the rest in browse, so a student can find the thing without waiting for offers. Hidden
 * when nothing in the category is listed.
 */
export async function RelatedListings({ request, categoryName, campusNames }: RelatedListingsProps) {
  const listings = await getRelatedListings({
    categorySlug: request.categorySlug,
    campusSlug: request.campusSlug,
    limit: 4,
  }).catch(() => null);
  if (listings && listings.length === 0) return null;

  return (
    <section id="already-on-vossie" aria-labelledby="already-on-vossie-title" className="request-related">
      <h2 id="already-on-vossie-title" className="listing-section-title">
        Already on Vossie
      </h2>
      {listings ? (
        <>
          <ListingGrid listings={listings} campusNames={campusNames} columns="four" />
          <Link href={`/browse?cat=${request.categorySlug}`} prefetch={false} className="section-link request-see-all">
            See all in {categoryName}
          </Link>
        </>
      ) : (
        <SectionError id="already-on-vossie" title="Listings" path={`/looking-for/${request.id}`} />
      )}
    </section>
  );
}
```

- [ ] **Step 6: Write the page frame**

Create `components/looking-for/RequestView.tsx`:

```tsx
import Link from "next/link";
import { FlagIcon } from "@/components/icons";
import { budgetLabel, dayMonth, offersSoFarLabel } from "@/lib/format";
import { signInHref } from "@/lib/next-path";
import { shortSastDate } from "@/lib/time";
import type { Category, LookingForRequest } from "@/lib/types";
import { RelatedListings } from "./RelatedListings";

type RequestViewProps = {
  request: LookingForRequest;
  category: Pick<Category, "slug" | "name">;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * A request's page (community spec 4.2): what's asked for, in the asker's words, the offers so far and a way to help,
 * then listings already on Vossie that might do. The asker stays unnamed (community spec decision 2). On desktop the
 * offers sit beside the request (plan decision 18).
 */
export function RequestView({ request, category, campusNames }: RequestViewProps) {
  const campusName = campusNames.get(request.campusSlug) ?? "";
  const signIn = signInHref(`/looking-for/${request.id}`);

  return (
    <div className="page request-page">
      <nav aria-label="Breadcrumb" className="listing-crumbs">
        <ol>
          <li>
            <Link href="/looking-for">Looking For</Link>
          </li>
          <li>
            <Link href={`/looking-for?cat=${category.slug}`} prefetch={false}>
              {category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="request-layout">
        <div>
          <h1 className="request-heading">{request.title}</h1>
          <ul className="fact-pills request-facts">
            <li>{campusName}</li>
            <li>{category.name}</li>
            <li>{budgetLabel(request)}</li>
            {request.neededBy && (
              <li>
                Needed by <time dateTime={request.neededBy}>{dayMonth(request.neededBy)}</time>
              </li>
            )}
            <li>
              Posted <time dateTime={request.createdAt}>{shortSastDate(request.createdAt)}</time>
            </li>
            <li>Asked by a student at {campusName}</li>
          </ul>
          <p className="request-details">{request.details}</p>
        </div>

        <section aria-labelledby="request-offers-title" className="request-offers">
          <h2 id="request-offers-title" className="sr-only">
            Offers
          </h2>
          {request.status === "open" ? (
            <>
              <p className="request-offers-count">{offersSoFarLabel(request.offers)}</p>
              <Link href={signIn} prefetch={false} className="btn btn-primary request-offer">
                Offer to help
              </Link>
            </>
          ) : (
            <p className="request-offers-count">This request is closed</p>
          )}
        </section>
      </div>

      <RelatedListings request={request} categoryName={category.name} campusNames={campusNames} />

      {/* The listing page's report link style. */}
      <p className="listing-report">
        <Link href={signIn} prefetch={false}>
          <FlagIcon className="size-4" />
          Report this request
        </Link>
      </p>
    </div>
  );
}
```

Run: `pnpm test components/looking-for`
Expected: PASS.

- [ ] **Step 7: The page**

Create `app/looking-for/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequestView } from "@/components/looking-for/RequestView";
import { getCampuses, getCategories, getRequest, getRequestIds } from "@/lib/data";
import { shortDescription } from "@/lib/format";

/**
 * The tab title is the request's ("Accounting 1 tutor this week · Vossie"; the layout adds the suffix) and the
 * description the start of its details (community spec 4.2). A request names no one, so it's indexed: it helps
 * sellers find work. An unknown id gets the 404's title.
 */
export async function generateMetadata({ params }: PageProps<"/looking-for/[id]">): Promise<Metadata> {
  const { id } = await params;
  const request = await getRequest(id);
  if (!request) return { title: "Page not found" };
  return { title: request.title, description: shortDescription(request.details) };
}

export async function generateStaticParams() {
  return (await getRequestIds()).map((id) => ({ id }));
}

export default function RequestPage({ params }: PageProps<"/looking-for/[id]">) {
  return (
    // Known requests are prerendered, so this fallback only shows for an unknown id, until the 404 takes over.
    <Suspense fallback={null}>
      <RequestDetails params={params} />
    </Suspense>
  );
}

async function RequestDetails({ params }: Pick<PageProps<"/looking-for/[id]">, "params">) {
  const { id } = await params;
  const [request, categories, campuses] = await Promise.all([getRequest(id), getCategories(), getCampuses()]);
  const category = categories.find((item) => item.slug === request?.categorySlug);
  if (!request || !category) notFound();
  return (
    <RequestView
      request={request}
      category={category}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />
  );
}
```

- [ ] **Step 8: The request page's styles**

Add at the end of `app/globals.css`:

```css
/* --- Community: a request's page (community plan, Task 5, spec 4.2) --- */
@layer components {
  /* .page and .request-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .request-page {
    padding: 8px 16px 64px;
  }

  .request-layout {
    display: grid;
    gap: 24px;
    margin-top: 8px;
  }

  .request-heading {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem);
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  /* Facts as small pills, navy on pale (plan decision 17). A Hub post's facts use them too. */
  .fact-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .fact-pills > li {
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--color-pale);
    color: var(--color-navy);
    font-size: 13px;
    font-weight: 600;
  }

  .request-facts {
    margin-top: 16px;
  }

  /* The asker's own line breaks are kept (spec 4.2). */
  .request-details {
    max-width: 65ch;
    margin-top: 20px;
    white-space: pre-line;
  }

  .request-offers {
    display: grid;
    justify-items: start;
    gap: 14px;
    padding: 20px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  .request-offers-count {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 24px;
    line-height: 1;
    text-transform: uppercase;
  }

  .request-offer {
    min-height: 48px;
    padding-inline: 32px;
  }

  .request-related {
    margin-top: 48px;
  }

  .request-see-all {
    margin-top: 16px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .request-page {
      padding-inline: 40px;
    }
  }

  /* Desktop: the request on the left, the offers beside it (plan decision 18). */
  @media (min-width: 64rem) and (min-height: 30rem) {
    .request-layout {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      align-items: start;
      gap: 40px;
    }
  }
}
```

- [ ] **Step 9: An unknown request is a 404, and the page is measured**

In `tests/e2e/routes.spec.ts`, rename the test "unknown listing, collection and seller slugs show the 404 page" to "unknown listing, collection, seller and request links show the 404 page", and add at the end of its body, after the `/sellers/nope` lines:

```ts
    await page.goto("/looking-for/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await expect(page).toHaveTitle("Page not found · Vossie");
```

In `tests/e2e/performance.spec.ts`, add a row at the end of `PAGES`:

```ts
  ["request page", "/looking-for/r-001"],
```

(r-001 has four cards in "Already on Vossie", the most a request page shows.)

- [ ] **Step 10: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build lists `/looking-for/[id]` with its 16 requests prerendered.

- [ ] **Step 11: Look at it**

Start the build (`pnpm start --port 3201`) and check, at 390 × 844, 768 × 1024 and 1280 × 800:
- `/looking-for/r-001`: the breadcrumb "Looking For / Tutoring", the title large and navy, six pale pills (Midrand, Tutoring, Budget R300, Needed by 16 Oct, Posted 13 Oct, Asked by a student at Midrand), the details with "Evenings on campus suit me best." on its own line, then the grey offers panel: "2 OFFERS SO FAR" and Offer to help. On desktop the panel sits to the right of the request. Then "ALREADY ON VOSSIE" with four cards (2, 3 and 4 across), "See all in Tutoring", and Report this request.
- `/looking-for/r-015`: the panel says "THIS REQUEST IS CLOSED", with no button.
- `/looking-for/r-016`: one card (the matric dance tickets).
- From the board, tapping a row opens its request.

Stop the server.

- [ ] **Step 12: Measure the JS**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/routes.spec.ts --project=phone-390`
Expected: all pass. Note the `scriptBrotli` figures. If any page is past the stop line, stop here and report.

- [ ] **Step 13: Hand over for commit**

Files: `components/looking-for/RequestView.tsx`, `components/looking-for/RequestView.test.tsx`, `components/looking-for/RelatedListings.tsx`, `components/looking-for/RelatedListings.test.tsx`, `app/looking-for/[id]/page.tsx`, `app/globals.css`, `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`.
Message: `feat: a request's page, with offers through sign-in and listings already on Vossie (community spec 4.2). JS: request <n> B`

---


### Task 6: The Hub page

The Hub page (spec 5.1, decision 8): the story and the Verified sellers, prerendered; then the feed, which reads `?type=` and today's date, behind a skeleton.

**Files:**
- Create: `components/hub/HubPostCard.tsx`, `components/hub/HubPostCard.test.tsx`
- Create: `components/hub/HubStory.tsx`, `components/hub/HubStory.test.tsx`
- Create: `components/hub/VerifiedSellers.tsx`, `components/hub/VerifiedSellers.test.tsx`
- Create: `components/hub/HubFeed.tsx`, `components/hub/HubFeed.test.tsx`
- Create: `components/hub/HubFeedSkeleton.tsx`
- Modify: `app/hub/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`

- [ ] **Step 1: Read the docs**

Read `connection.md` in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`, and look at `components/home/WhatsOn.tsx`: it reads the clock only after `await connection()`, inside `<Suspense>` (decision 26).

- [ ] **Step 2: Write the card's tests**

Create `components/hub/HubPostCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getHubPost } from "@/lib/data";
import { HubPostCard } from "./HubPostCard";

async function show(id: string, campusName: string) {
  return render(<HubPostCard post={(await getHubPost(id))!} campusName={campusName} />);
}

describe("HubPostCard (community spec 5.1)", () => {
  it("shows an event's kind, title, day and time in SAST, place, campus and numbers", async () => {
    const { container } = await show("h-001", "All campuses");
    expect(screen.getByText("Event")).toHaveClass("eyebrow");
    expect(screen.getByRole("heading", { level: 3, name: "Pitch night" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pitch night" })).toHaveAttribute("href", "/hub/h-001");
    expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-10-14T16:00:00Z");
    expect(container.querySelector("time")).toHaveTextContent("Wed 14 Oct · 18:00");
    expect(screen.getByText("Online, with a watch party at every Hub · All campuses")).toBeInTheDocument();
    expect(screen.getByText("12 going · 80 places")).toBeInTheDocument();
  });

  it("shows office hours without numbers", async () => {
    await show("h-002", "Midrand");
    expect(screen.getByText("Office hours")).toHaveClass("eyebrow");
    expect(screen.getByText("Thu 15 Oct · 13:00")).toBeInTheDocument();
    expect(screen.getByText("The Hub, Block C · Midrand")).toBeInTheDocument();
    expect(screen.queryByText(/going/)).toBeNull();
  });

  it("shows a tip's date and one-line summary", async () => {
    const { container } = await show("h-013", "All campuses");
    expect(screen.getByText("Tip")).toHaveClass("eyebrow");
    expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-10-12T07:00:00Z");
    expect(container.querySelector("time")).toHaveTextContent("12 Oct");
    expect(
      screen.getByText("Start from what's already listed, add up your costs, and leave room to say yes to a fair offer."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/All campuses/)).toBeNull();
  });
});
```

- [ ] **Step 3: Write the story's and Verified sellers' tests**

Create `components/hub/HubStory.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HubStory } from "./HubStory";

const banner = { src: "/placeholders/hub/banner.svg", alt: "" };

describe("HubStory (community spec 5.1)", () => {
  it("heads the page with the Hub's name and its story", () => {
    render(<HubStory image={banner} />);
    expect(screen.getByRole("heading", { level: 1, name: "The Incubation Hub" })).toBeInTheDocument();
    expect(screen.getByText(/backs student businesses on every campus/)).toBeInTheDocument();
    expect(screen.getByText(/The Hub also runs Vossie/)).toBeInTheDocument();
  });

  it("keeps the photo out of the reading order", () => {
    const { container } = render(<HubStory image={banner} />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
```

Create `components/hub/VerifiedSellers.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getCampuses, getVerifiedSellers } from "@/lib/data";
import { VerifiedSellers } from "./VerifiedSellers";

async function show({ failed = false } = {}) {
  const [sellers, campuses] = await Promise.all([getVerifiedSellers(), getCampuses()]);
  render(
    <VerifiedSellers
      sellers={failed ? null : sellers}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />,
  );
}

describe("VerifiedSellers (community spec 5.1, decision 8)", () => {
  it("shows every verified seller, A to Z, each linking to their shop", async () => {
    await show();
    const links = within(screen.getByRole("region", { name: "Verified by the Hub" })).getAllByRole("link");
    expect(links).toHaveLength(9);
    expect(links[0]).toHaveAccessibleName("Code coach Pretoria");
    expect(links[0]).toHaveAttribute("href", "/sellers/code-coach");
    expect(links[8]).toHaveAccessibleName("Thrift rack Pretoria");
  });

  it("keeps the photos out of the reading order: the names say who", async () => {
    await show();
    const region = screen.getByRole("region", { name: "Verified by the Hub" });
    for (const image of region.querySelectorAll("img")) expect(image).toHaveAttribute("alt", "");
  });

  it("shows its own error, with a way back to the Hub", async () => {
    await show({ failed: true });
    expect(screen.getByText("Verified sellers didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/hub?retry=hub-verified#hub-verified",
    );
  });
});
```

- [ ] **Step 4: Write the feed's tests**

Create `components/hub/HubFeed.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HubFeed } from "./HubFeed";

const feed = vi.hoisted(() => ({ mode: "real" as "real" | "no-tips" | "failing" }));

// connection() needs Next's request context, which tests don't have.
vi.mock("next/server", () => ({ connection: async () => undefined }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getHubPosts: async (query: Parameters<typeof actual.getHubPosts>[0]) => {
      if (feed.mode === "failing") throw new Error("The posts didn't load");
      const posts = await actual.getHubPosts(query);
      return feed.mode === "no-tips" ? posts.filter((post) => post.kind !== "tip") : posts;
    },
  };
});

beforeEach(() => {
  // Fake only the date, so "today" is 12 October unless a test sets another time; every sample event is upcoming.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T08:00:00Z"));
});

afterEach(() => {
  feed.mode = "real";
});

const show = async (params: Record<string, string> = {}) =>
  render(await HubFeed({ searchParams: Promise.resolve(params) }));

/** The card titles in one of the feed's lists, in order. */
const titles = (list: string) =>
  within(screen.getByRole("list", { name: list }))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

const TIPS = [
  "How to price your first listing",
  "Five phone tricks for better photos",
  "Meeting a buyer safely on campus",
  "Writing a listing people trust",
  "How to get the Verified badge",
  "From side hustle to small business",
];

describe("HubFeed (community spec 5.1)", () => {
  it("shows upcoming events and office hours, soonest first, then tips, newest first", async () => {
    await show();
    expect(titles("Events and office hours")).toEqual([
      "Pitch night",
      "Office hours: pricing your hustle",
      "Market day on the lawn",
      "Photo day for your shop",
      "Hub mixer",
      "Selling online: photos that sell",
      "Office hours: your first listing",
      "End-of-year market",
      "Back-to-campus pop-up",
      "Pitch night",
    ]);
    expect(titles("Tips")).toEqual(TIPS);
    const tabs = screen.getByRole("navigation", { name: "Post types" });
    expect(within(tabs).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "All",
      "Events",
      "Office hours",
      "Tips",
    ]);
    expect(within(tabs).getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("link", { name: "All" })).toHaveAttribute("href", "/hub#hub-feed");
  });

  it("keeps what's on today, until midnight in SAST", async () => {
    vi.setSystemTime(new Date("2026-10-14T21:30:00Z")); // 23:30 on 14 October in South Africa
    await show();
    expect(titles("Events and office hours")[0]).toBe("Pitch night");
  });

  it("drops what has passed", async () => {
    vi.setSystemTime(new Date("2026-10-14T22:30:00Z")); // 00:30 on 15 October in South Africa
    await show();
    const upcoming = titles("Events and office hours");
    expect(upcoming[0]).toBe("Office hours: pricing your hustle");
    expect(upcoming).toHaveLength(9);
  });

  it("narrows to one type from the link, its tab current", async () => {
    await show({ type: "office-hours" });
    const tabs = screen.getByRole("navigation", { name: "Post types" });
    expect(within(tabs).getByRole("link", { name: "Office hours" })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("link", { name: "Office hours" })).toHaveAttribute(
      "href",
      "/hub?type=office-hours#hub-feed",
    );
    expect(titles("Office hours")).toEqual([
      "Office hours: pricing your hustle",
      "Photo day for your shop",
      "Office hours: your first listing",
    ]);
    expect(screen.queryByRole("list", { name: "Tips" })).toBeNull();
  });

  it("shows only tips on the Tips tab", async () => {
    await show({ type: "tips" });
    expect(titles("Tips")).toEqual(TIPS);
    expect(screen.queryByRole("list", { name: "Events and office hours" })).toBeNull();
  });

  it("ignores a type it doesn't know", async () => {
    await show({ type: "nope" });
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });

  it("says when nothing is planned, and still shows the tips", async () => {
    vi.setSystemTime(new Date("2027-03-01T08:00:00Z"));
    await show();
    expect(screen.getByText("Nothing planned right now. Check back soon.")).toBeInTheDocument();
    expect(titles("Tips")).toEqual(TIPS);
  });

  it("says when there are no tips", async () => {
    feed.mode = "no-tips";
    await show({ type: "tips" });
    expect(screen.getByText("No tips yet.")).toBeInTheDocument();
  });

  it("says so when the posts don't load, with a way to try again, and keeps the tabs", async () => {
    feed.mode = "failing";
    await show({ type: "tips" });
    expect(screen.getByText("We couldn't load the Hub's posts just now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/hub?type=tips#hub-feed");
    expect(screen.getByRole("navigation", { name: "Post types" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run them to make sure they fail**

Run: `pnpm test components/hub`
Expected: the new tests FAIL, because the components don't exist (`Markdown.test.tsx` still passes).

- [ ] **Step 6: Write the card**

Create `components/hub/HubPostCard.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { hubKindLabel, placesLabel } from "@/lib/format";
import { sastDateTime, shortSastDate } from "@/lib/time";
import type { HubPost } from "@/lib/types";

/**
 * A post in the Hub's feed (community spec 5.1): the kind as an eyebrow and the title; for events and office hours,
 * when (in SAST), where and for which campus, and for events how many are going; for tips, the date and a one-line
 * summary. The title's link covers the whole card. `campusName` is "All campuses" or the campus's name.
 */
export function HubPostCard({ post, campusName }: { post: HubPost; campusName: string }) {
  let details: ReactNode;
  if (post.startsAt === null) {
    details = (
      <>
        <p className="hub-card-when">
          <time dateTime={post.publishedAt}>{shortSastDate(post.publishedAt)}</time>
        </p>
        <p className="hub-card-summary">{post.summary}</p>
      </>
    );
  } else {
    details = (
      <>
        <p className="hub-card-when">
          <time dateTime={post.startsAt}>{sastDateTime(post.startsAt)}</time>
        </p>
        <p className="hub-card-where">
          {post.place} · {campusName}
        </p>
        {post.capacity !== null && post.going !== null && (
          <p className="hub-card-going">{placesLabel(post.going, post.capacity)}</p>
        )}
      </>
    );
  }

  return (
    <article className="hub-card">
      <p className="eyebrow hub-card-kind">{hubKindLabel(post.kind)}</p>
      <h3 className="hub-card-title">
        {/* No prefetch: a feed of posts, most of which won't be opened (decision 28). */}
        <Link href={`/hub/${post.id}`} prefetch={false} className="hub-card-link">
          {post.title}
        </Link>
      </h3>
      {details}
    </article>
  );
}
```

- [ ] **Step 7: Write the story, Verified sellers, the feed and its skeleton**

Create `components/hub/HubStory.tsx`:

```tsx
import { Photo } from "@/components/listings/Photo";
import type { ImageRef } from "@/lib/types";

/**
 * The Hub's story (community spec 5.1): the banner's photo, which is decorative and loads first (plan decision 13),
 * the page's heading and two short paragraphs. The wording is sample text for the Hub to change.
 */
export function HubStory({ image }: { image: ImageRef }) {
  return (
    <div className="hub-story">
      <Photo
        image={{ src: image.src, alt: "" }}
        sizes="(min-width: 64rem) and (min-height: 30rem) 460px, (min-width: 48rem) and (min-height: 30rem) 40vw, 100vw"
        className="hub-story-photo"
        priority
      />
      <div className="hub-story-text">
        <h1 className="hub-story-title">The Incubation Hub</h1>
        <p>
          The Eduvos Incubation Hub backs student businesses on every campus. Its mentors help you price, plan and grow,
          and it runs pitch nights, workshops and office hours through the year.
        </p>
        <p>
          The Hub also runs Vossie. It checks the sellers who apply and gives the ones it has met and checked the
          Verified badge, so you know who you&apos;re buying from.
        </p>
      </div>
    </div>
  );
}
```

Create `components/hub/VerifiedSellers.tsx`:

```tsx
import Link from "next/link";
import { SectionError } from "@/components/home/SectionError";
import { Photo } from "@/components/listings/Photo";
import type { Seller } from "@/lib/types";

type VerifiedSellersProps = {
  /** Null when they didn't load. */
  sellers: readonly Seller[] | null;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * Verified by the Hub (community spec 5.1, decision 8): every verified seller as a small card (a round photo, the name
 * and the campus) linking to their storefront. One row that scrolls sideways on phones; it wraps from the tablet step
 * (plan decision 7). Hidden when there are none.
 */
export function VerifiedSellers({ sellers, campusNames }: VerifiedSellersProps) {
  if (sellers && sellers.length === 0) return null;
  return (
    <section id="hub-verified" aria-labelledby="hub-verified-title" className="hub-verified">
      <h2 id="hub-verified-title" className="listing-section-title">
        Verified by the Hub
      </h2>
      {sellers ? (
        <ul className="hub-sellers">
          {sellers.map((seller) => (
            <li key={seller.slug}>
              {/* No prefetch: a row of storefronts, most of which won't be opened (decision 28). */}
              <Link href={`/sellers/${seller.slug}`} prefetch={false} className="hub-seller">
                <Photo
                  image={{ src: seller.image.src, alt: "" }}
                  ratio="1 / 1"
                  sizes="56px"
                  className="hub-seller-photo"
                />
                <span className="hub-seller-name">{seller.name}</span>{" "}
                <span className="hub-seller-campus">{campusNames.get(seller.campusSlug)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <SectionError id="hub-verified" title="Verified sellers" path="/hub" />
      )}
    </section>
  );
}
```

Create `components/hub/HubFeed.tsx`:

```tsx
import { connection } from "next/server";
import type { ReactNode } from "react";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { getCampuses, getHubPosts } from "@/lib/data";
import {
  HUB_FEED_LABELS,
  HUB_FEED_TYPES,
  feedKinds,
  hubCampusName,
  hubFeedHref,
  readHubFeedType,
  type HubFeedType,
} from "@/lib/hub";
import { sastToday } from "@/lib/time";
import type { HubPost } from "@/lib/types";
import { HubPostCard } from "./HubPostCard";

/** What screen readers call the events-and-office-hours list on each tab (plan decision 5). */
const DATED_LABELS: Record<Exclude<HubFeedType, "tips">, string> = {
  all: "Events and office hours",
  events: "Events",
  "office-hours": "Office hours",
};

type HubFeedProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The Hub's feed (community spec 5.1): the type tabs, then upcoming events and office hours, soonest first, then tips,
 * newest first, from every campus (community spec decision 7). It reads the link and today's date, so it renders per
 * request, inside the page's <Suspense>.
 */
export async function HubFeed({ searchParams }: HubFeedProps) {
  const type = readHubFeedType((await searchParams).type);
  // Reading the link isn't enough for Next to allow a clock read: connection() defers the rest of this render to the
  // request (decision 26), as What's on does.
  await connection();
  const [posts, campuses] = await Promise.all([
    getHubPosts({ kinds: feedKinds(type), from: sastToday() }).catch(() => null),
    getCampuses(),
  ]);
  const campusNames = new Map(campuses.map((campus) => [campus.slug, campus.name]));

  let body: ReactNode;
  if (posts === null) {
    body = (
      <div className="section-error">
        <p>We couldn&apos;t load the Hub&apos;s posts just now.</p>
        <a href={hubFeedHref(type)} className="btn btn-outline text-navy">
          Try again
        </a>
      </div>
    );
  } else {
    const dated = posts.filter((post) => post.kind !== "tip");
    const tips = posts.filter((post) => post.kind === "tip");
    body = (
      <>
        {type !== "tips" && (
          <FeedList
            label={DATED_LABELS[type]}
            posts={dated}
            empty="Nothing planned right now. Check back soon."
            campusNames={campusNames}
          />
        )}
        {(type === "all" || type === "tips") && (
          <FeedList label="Tips" posts={tips} empty="No tips yet." campusNames={campusNames} />
        )}
      </>
    );
  }

  const tabs = HUB_FEED_TYPES.map((key) => ({ key, label: HUB_FEED_LABELS[key], href: hubFeedHref(key) }));
  return (
    <>
      <LinkTabs label="Post types" tabs={tabs} current={type} look="tabs" />
      {body}
    </>
  );
}

type FeedListProps = {
  label: string;
  posts: readonly HubPost[];
  empty: string;
  campusNames: ReadonlyMap<string, string>;
};

/** One of the feed's lists, named for screen readers, or its empty line (plan decision 5). */
function FeedList({ label, posts, empty, campusNames }: FeedListProps) {
  if (posts.length === 0) return <p className="hub-feed-empty">{empty}</p>;
  return (
    <ul aria-label={label} className="hub-feed-list">
      {posts.map((post) => (
        <li key={post.id}>
          <HubPostCard post={post} campusName={hubCampusName(post.campusSlug, campusNames)} />
        </li>
      ))}
    </ul>
  );
}
```

Create `components/hub/HubFeedSkeleton.tsx`:

```tsx
/** The feed's shape while it streams in (community spec 3): the tab row and three cards, so nothing jumps. */
export function HubFeedSkeleton() {
  return (
    <div aria-hidden="true">
      <span className="skeleton hub-feed-skeleton-tabs" />
      <ul className="hub-feed-list">
        {[0, 1, 2].map((n) => (
          <li key={n}>
            <span className="skeleton hub-card-skeleton" />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Run: `pnpm test components/hub`
Expected: PASS.

- [ ] **Step 8: The page**

Replace `app/hub/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { HubFeed } from "@/components/hub/HubFeed";
import { HubFeedSkeleton } from "@/components/hub/HubFeedSkeleton";
import { HubStory } from "@/components/hub/HubStory";
import { VerifiedSellers } from "@/components/hub/VerifiedSellers";
import { getCampuses, getHubBanner, getVerifiedSellers } from "@/lib/data";

/** Fixed: `?type=` views share the Hub's title and description, and stay indexed (plan decision 14). */
export const metadata: Metadata = {
  title: "The Incubation Hub",
  description:
    "The Eduvos Incubation Hub backs student businesses: its Verified sellers, and its events, office hours and tips.",
};

/**
 * The Incubation Hub (community spec 5.1). The story and the Verified sellers are prerendered; the feed reads `?type=`
 * and today's date, so it streams in behind a skeleton.
 */
export default async function HubPage({ searchParams }: PageProps<"/hub">) {
  const [banner, sellers, campuses] = await Promise.all([
    getHubBanner(),
    getVerifiedSellers().catch(() => null),
    getCampuses(),
  ]);
  return (
    <div className="page hub-page">
      <HubStory image={banner.image} />
      <VerifiedSellers sellers={sellers} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />
      {/* The tabs link to #hub-feed, so a tap keeps the feed in view (plan decision 6). */}
      <section id="hub-feed" aria-labelledby="hub-feed-title" className="hub-feed">
        <h2 id="hub-feed-title" className="listing-section-title">
          What’s on and what’s new
        </h2>
        <Suspense fallback={<HubFeedSkeleton />}>
          <HubFeed searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}
```

- [ ] **Step 9: The Hub page's styles**

In `app/globals.css`, in the data saver rule that starts `:root[data-low-data] :is(.listing-card, .seller-card, .free-card, .collections, .campus-chooser-wide, .context-thumbs, .hub-more) .photo-img`, add `.hub-sellers` at the end of the `:is(…)` list (plan decision 13).

Then add at the end of the file:

```css
/* --- Community: the Hub page, Verified sellers and the feed (community plan, Task 6, spec 5.1) --- */
@layer components {
  /* .page and .hub-page sit on one element, so this padding is the whole content edge: 16px, then 40px. On phones the
     story's photo meets the header, so there's no top padding. */
  .hub-page {
    padding: 0 16px 64px;
  }

  /* Phones: the photo edge to edge at 7:3, pulled out by the page's 16px. */
  .hub-story-photo {
    --photo-ratio: 7 / 3;
    margin-inline: -16px;
  }

  .hub-story-text {
    display: grid;
    gap: 12px;
    max-width: 60ch;
    margin-top: 20px;
  }

  .hub-story-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
  }

  .hub-verified,
  .hub-feed {
    margin-top: 48px;
  }

  /* One row that scrolls sideways on phones, out to the screen's edges, and wraps from the tablet step (plan decision
     7). The padding keeps focus rings inside the scroll box. */
  .hub-sellers {
    display: flex;
    gap: 12px;
    margin: 12px -16px 0;
    padding: 6px 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .hub-sellers::-webkit-scrollbar {
    display: none;
  }

  .hub-sellers > li {
    flex: none;
  }

  .hub-seller {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 2px;
    width: 8.5rem;
    min-height: 44px;
    padding: 14px 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    color: var(--color-navy);
    text-align: center;
  }

  .hub-seller-photo {
    width: 56px;
    margin-bottom: 8px;
    border-radius: 999px;
  }

  .hub-seller-name {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
  }

  .hub-seller-campus {
    color: var(--color-muted);
    font-size: 12px;
  }

  .hub-feed-list {
    display: grid;
    gap: 14px;
    margin-top: 20px;
  }

  /* All shows two lists, events and office hours, then tips (plan decision 5), with room between them. */
  .hub-feed-list + .hub-feed-list,
  .hub-feed-list + .hub-feed-empty,
  .hub-feed-empty + .hub-feed-list {
    margin-top: 32px;
  }

  /* The title's link covers the whole card. */
  .hub-card {
    position: relative;
    display: grid;
    align-content: start;
    gap: 4px;
    height: 100%;
    padding: 18px 20px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-white);
  }

  .hub-card-title {
    color: var(--color-navy);
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
  }

  .hub-card-link::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: var(--radius-card);
  }

  /* The ring goes round the whole card. Without :has() (iOS before 15.4) the link keeps its own ring. */
  @supports selector(:has(*)) {
    .hub-card-link:focus-visible {
      outline: none;
      box-shadow: none;
    }

    .hub-card:has(.hub-card-link:focus-visible) {
      outline: 2.5px solid var(--color-navy);
      outline-offset: 3px;
    }
  }

  .hub-card-when {
    margin-top: 6px;
    color: var(--color-navy);
    font-size: 14px;
    font-weight: 600;
  }

  .hub-card-where,
  .hub-card-going,
  .hub-card-summary {
    color: var(--color-muted);
    font-size: 14px;
  }

  /* Navy on the grey panel. */
  .hub-feed-empty {
    margin-top: 20px;
    padding: 20px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
    color: var(--color-navy);
    font-weight: 600;
  }

  /* The skeleton has the real tab row's height (its 4px padding, 44px tabs and 1px line) and an event card's. */
  .hub-feed-skeleton-tabs {
    height: 49px;
    margin-top: 22px;
  }

  .hub-card-skeleton {
    height: 9.5rem;
    border-radius: var(--radius-card);
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .hub-page {
      padding: 24px 40px 64px;
    }

    /* The text on the left and the photo on the right, at 4:3. The photo is decorative, so its place in the reading
       order doesn't matter. */
    .hub-story {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      grid-template-areas: "text photo";
      align-items: center;
      gap: 40px;
    }

    .hub-story-photo {
      --photo-ratio: 4 / 3;
      grid-area: photo;
      margin-inline: 0;
      border-radius: var(--radius-panel);
    }

    .hub-story-text {
      grid-area: text;
      margin-top: 0;
    }

    .hub-sellers {
      flex-wrap: wrap;
      margin-inline: 0;
      padding-inline: 0;
      overflow-x: visible;
    }

    .hub-feed-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .hub-feed-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  /* Landscape phones keep the phone layout, with the photo cropped short so it doesn't fill the screen. */
  @media (orientation: landscape) and (max-height: 29.99rem) {
    .hub-story-photo {
      --photo-ratio: 4 / 1;
    }
  }
}
```

- [ ] **Step 10: The Hub is no longer a placeholder**

In `tests/e2e/routes.spec.ts`, delete the `["/hub", "The Incubation Hub"],` row from `PLACEHOLDERS`.

In `tests/e2e/performance.spec.ts`, add a row at the end of `PAGES`:

```ts
  ["Hub page", "/hub"],
```

- [ ] **Step 11: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build lists `/hub` as partly prerendered. If the build complains that `HubPage` reads uncached data outside `<Suspense>`, check that `getHubBanner`, `getVerifiedSellers` and `getCampuses` each start with `"use cache"`; don't move the story into the `<Suspense>`.

- [ ] **Step 12: Look at it**

Start the build (`pnpm start --port 3201`) and check, at 390 × 844, 768 × 1024 and 1280 × 800, and once at 844 × 390 (a landscape phone):
- `/hub`: on the phone the photo runs to both screen edges at 7:3 right under the header, then "THE INCUBATION HUB" and the two paragraphs. From the tablet step the text sits on the left and the photo on the right at 4:3. On the landscape phone the photo is a short strip.
- "VERIFIED BY THE HUB": nine small cards, each a round photo, a name and a campus, in a row that scrolls sideways on the phone and wraps on the tablet and desktop.
- "WHAT’S ON AND WHAT’S NEW", the tabs (All underlined in navy), then the upcoming event and office hours cards (1, 2 and 3 across), each with its eyebrow, title, "Wed 14 Oct · 18:00"-style time, place and campus, and "12 going · 80 places" on events; then the six tips with their dates and summaries.
- Tap Tips: the address becomes `/hub?type=tips#hub-feed`, the feed's heading stays in view, and only tips show. Tap Office hours: only office hours (or "Nothing planned right now. Check back soon." once they're past).
- Turn on data saver (in the menu) and reload: the Verified sellers' round photos are pale circles; the story photo stays.

Stop the server.

- [ ] **Step 13: Measure the JS**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/routes.spec.ts --project=phone-390`
Expected: all pass. Note the `scriptBrotli` figures. If any page is past the stop line, stop here and report.

- [ ] **Step 14: Hand over for commit**

Files: `components/hub/HubPostCard.tsx`, `components/hub/HubPostCard.test.tsx`, `components/hub/HubStory.tsx`, `components/hub/HubStory.test.tsx`, `components/hub/VerifiedSellers.tsx`, `components/hub/VerifiedSellers.test.tsx`, `components/hub/HubFeed.tsx`, `components/hub/HubFeed.test.tsx`, `components/hub/HubFeedSkeleton.tsx`, `app/hub/page.tsx`, `app/globals.css`, `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`.
Message: `feat: the Hub page: its story, Verified sellers and a feed of events, office hours and tips (community spec 5.1). JS: Hub <n> B`

---


### Task 7: A Hub post's page

A post's page (spec 5.2): the breadcrumb, the cover, the kind and title, the facts or the posted date, the body, then RSVP or Request a slot (or "has passed"), and More from the Hub. Every post is prerendered; the action and More from the Hub read today's date, each inside its own `<Suspense>` with its room kept (plan decision 9).

**Files:**
- Create: `components/hub/PostAction.tsx`, `components/hub/PostAction.test.tsx`
- Create: `components/hub/UpcomingPosts.tsx`, `components/hub/UpcomingPosts.test.tsx`
- Create: `components/hub/HubPostView.tsx`, `components/hub/HubPostView.test.tsx`
- Create: `app/hub/[id]/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`

- [ ] **Step 1: Write the action's tests**

Create `components/hub/PostAction.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getHubPost } from "@/lib/data";
import { PostAction } from "./PostAction";

// connection() needs Next's request context, which tests don't have.
vi.mock("next/server", () => ({ connection: async () => undefined }));

/** Fake only the date: "now" is the given time. */
function now(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

async function show(id: string) {
  return render(await PostAction({ post: (await getHubPost(id))! }));
}

describe("PostAction (community spec 5.2, decision 6)", () => {
  it("offers RSVP through the sign-in page, until midnight on the event's day in SAST", async () => {
    now("2026-10-14T21:30:00Z"); // 23:30 on the day, in South Africa
    await show("h-001");
    expect(screen.getByRole("link", { name: "RSVP" })).toHaveAttribute("href", "/login?next=%2Fhub%2Fh-001");
  });

  it("says an event has passed from the next day, with no button", async () => {
    now("2026-10-14T22:30:00Z"); // 00:30 the next day, in South Africa
    await show("h-001");
    expect(screen.getByText("This event has passed")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("offers Request a slot for office hours, with a note for the mentor", async () => {
    now("2026-10-12T08:00:00Z");
    await show("h-002");
    expect(screen.getByRole("link", { name: "Request a slot" })).toHaveAttribute("href", "/login?next=%2Fhub%2Fh-002");
    expect(screen.getByText("Tell the mentor what you'd like help with when you sign in.")).toBeInTheDocument();
  });

  it("says office hours have passed, with no button and no note", async () => {
    now("2026-10-12T08:00:00Z");
    await show("h-012");
    expect(screen.getByText("These office hours have passed")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/Tell the mentor/)).toBeNull();
  });

  it("keeps the room for the tallest state of each kind", async () => {
    now("2026-10-12T08:00:00Z");
    const { container, unmount } = await show("h-012");
    expect(container.querySelector(".hub-post-action")).toHaveAttribute("data-kind", "office-hours");
    unmount();
    const event = await show("h-001");
    expect(event.container.querySelector(".hub-post-action")).not.toHaveAttribute("data-kind");
  });
});
```

- [ ] **Step 2: Write More from the Hub's tests**

Create `components/hub/UpcomingPosts.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCampuses } from "@/lib/data";
import { UpcomingPosts } from "./UpcomingPosts";

const load = vi.hoisted(() => ({ failing: false }));

// connection() needs Next's request context, which tests don't have.
vi.mock("next/server", () => ({ connection: async () => undefined }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getHubPosts: async (query: Parameters<typeof actual.getHubPosts>[0]) => {
      if (load.failing) throw new Error("The posts didn't load");
      return actual.getHubPosts(query);
    },
  };
});

beforeEach(() => {
  // Fake only the date: 12 October, when every sample event is upcoming.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T08:00:00Z"));
});

afterEach(() => {
  load.failing = false;
});

async function show(postId: string) {
  const campuses = await getCampuses();
  return render(
    await UpcomingPosts({ postId, campusNames: new Map(campuses.map((campus) => [campus.slug, campus.name])) }),
  );
}

const hrefs = () =>
  within(screen.getByRole("region", { name: "More from the Hub" }))
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));

describe("UpcomingPosts (community spec 5.2)", () => {
  it("offers the next three other events and office hours, as the feed's cards", async () => {
    await show("h-001");
    expect(hrefs()).toEqual(["/hub/h-002", "/hub/h-003", "/hub/h-004"]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Office hours: pricing your hustle",
      "Market day on the lawn",
      "Photo day for your shop",
    ]);
  });

  it("offers events under a tip too, never tips", async () => {
    await show("h-013");
    expect(hrefs()).toEqual(["/hub/h-001", "/hub/h-002", "/hub/h-003"]);
  });

  it("hides when nothing else is planned", async () => {
    vi.setSystemTime(new Date("2027-03-01T08:00:00Z"));
    const { container } = await show("h-013");
    expect(container).toBeEmptyDOMElement();
  });

  it("shows its own error, with a way back to this post", async () => {
    load.failing = true;
    await show("h-001");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/hub/h-001?retry=hub-upcoming#hub-upcoming",
    );
  });
});
```

- [ ] **Step 3: Write the page frame's tests**

Create `components/hub/HubPostView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getCampuses, getHubPost } from "@/lib/data";
import { HubPostView } from "./HubPostView";

// The request-time parts are tested on their own; here they stand in (jsdom can't render async components in a tree).
vi.mock("./PostAction", () => ({ PostAction: () => <p>Action, stood in</p>, PostActionSkeleton: () => null }));
vi.mock("./UpcomingPosts", () => ({
  UpcomingPosts: () => <section aria-label="More from the Hub, stood in" />,
  UpcomingPostsSkeleton: () => null,
}));

async function show(id: string) {
  const [post, campuses] = await Promise.all([getHubPost(id), getCampuses()]);
  return render(
    <HubPostView post={post!} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />,
  );
}

const facts = (container: HTMLElement) =>
  within(container.querySelector<HTMLElement>(".hub-post-facts")!)
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("HubPostView (community spec 5.2)", () => {
  it("leads with the breadcrumb, the cover, the kind and the title", async () => {
    const { container } = await show("h-001");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "The Hub" })).toHaveAttribute("href", "/hub");
    expect(within(crumbs).getByRole("link", { name: "Events" })).toHaveAttribute("href", "/hub?type=events#hub-feed");
    expect(container.querySelector(".hub-post-cover img")).toHaveAttribute("alt", "");
    expect(screen.getByText("Event")).toHaveClass("eyebrow");
    expect(screen.getByRole("heading", { level: 1, name: "Pitch night" })).toBeInTheDocument();
  });

  it("lists an event's facts, then its body, then the action", async () => {
    const { container } = await show("h-001");
    expect(facts(container)).toEqual([
      "Wed 14 Oct · 18:00",
      "Online, with a watch party at every Hub",
      "All campuses",
      "12 going · 80 places",
    ]);
    expect(screen.getByRole("heading", { level: 2, name: "How the night runs" })).toBeInTheDocument();
    expect(screen.getByText("Action, stood in")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "More from the Hub, stood in" })).toBeInTheDocument();
  });

  it("lists office hours' facts without numbers, under their own crumb", async () => {
    const { container } = await show("h-002");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Office hours" })).toHaveAttribute(
      "href",
      "/hub?type=office-hours#hub-feed",
    );
    expect(facts(container)).toEqual(["Thu 15 Oct · 13:00", "The Hub, Block C", "Midrand"]);
  });

  it("shows a tip's posted date and its body, with no facts and no action", async () => {
    const { container } = await show("h-013");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Tips" })).toHaveAttribute("href", "/hub?type=tips#hub-feed");
    expect(screen.getByText(/^Posted/)).toHaveTextContent("Posted 12 October 2026");
    expect(container.querySelector(".hub-post-facts")).toBeNull();
    expect(screen.queryByText("Action, stood in")).toBeNull();
    expect(screen.getByRole("link", { name: "browse what's already listed" })).toHaveAttribute("href", "/browse");
  });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test components/hub/PostAction.test.tsx components/hub/UpcomingPosts.test.tsx components/hub/HubPostView.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 5: Write the action**

Create `components/hub/PostAction.tsx`:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { hasPassed } from "@/lib/hub";
import { signInHref } from "@/lib/next-path";
import { sastToday } from "@/lib/time";
import type { HubPost } from "@/lib/types";

/**
 * RSVP for an event, or Request a slot for office hours, both through the sign-in page (community spec 5.2, decision
 * 1). Once the day has passed in SAST it says so instead (decision 6, plan decision 10). That depends on today's date,
 * so this small part renders per request; the rest of the post is prerendered.
 */
export async function PostAction({ post }: { post: Pick<HubPost, "id" | "kind" | "startsAt"> }) {
  // The clock is read only after connection() (decision 26).
  await connection();
  const passed = hasPassed(post, sastToday());
  const signIn = signInHref(`/hub/${post.id}`);

  let content: ReactNode;
  if (post.kind === "event") {
    content = passed ? (
      <p className="hub-post-passed">This event has passed</p>
    ) : (
      <Link href={signIn} prefetch={false} className="btn btn-primary hub-post-cta">
        RSVP
      </Link>
    );
  } else if (passed) {
    content = <p className="hub-post-passed">These office hours have passed</p>;
  } else {
    content = (
      <>
        <Link href={signIn} prefetch={false} className="btn btn-primary hub-post-cta">
          Request a slot
        </Link>
        <p className="hub-post-note">Tell the mentor what you&apos;d like help with when you sign in.</p>
      </>
    );
  }

  return (
    <div className="hub-post-action" data-kind={post.kind === "office-hours" ? "office-hours" : undefined}>
      {content}
    </div>
  );
}

/** The action's room while it streams in, the same height as its tallest state, so the page doesn't move. */
export function PostActionSkeleton({ kind }: { kind: HubPost["kind"] }) {
  return (
    <div
      className="hub-post-action"
      data-kind={kind === "office-hours" ? "office-hours" : undefined}
      aria-hidden="true"
    >
      <span className="skeleton hub-post-action-skeleton" />
    </div>
  );
}
```

- [ ] **Step 6: Write More from the Hub**

Create `components/hub/UpcomingPosts.tsx`:

```tsx
import { connection } from "next/server";
import { SectionError } from "@/components/home/SectionError";
import { getHubPosts } from "@/lib/data";
import { hubCampusName } from "@/lib/hub";
import { sastToday } from "@/lib/time";
import { HubPostCard } from "./HubPostCard";

type UpcomingPostsProps = {
  /** The post this page shows, which is left out. */
  postId: string;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * More from the Hub (community spec 5.2): up to 3 other upcoming events and office hours, as the feed's cards. What
 * counts as upcoming depends on today's date, so this renders per request (plan decision 9). Hidden when nothing else
 * is planned.
 */
export async function UpcomingPosts({ postId, campusNames }: UpcomingPostsProps) {
  // The clock is read only after connection() (decision 26).
  await connection();
  const posts = await getHubPosts({ kinds: ["event", "office-hours"], from: sastToday() }).catch(() => null);
  const others = posts ? posts.filter((post) => post.id !== postId).slice(0, 3) : null;
  if (others && others.length === 0) return null;

  return (
    <section id="hub-upcoming" aria-labelledby="hub-upcoming-title" className="hub-upcoming">
      <h2 id="hub-upcoming-title" className="listing-section-title">
        More from the Hub
      </h2>
      {others ? (
        <ul className="hub-feed-list">
          {others.map((post) => (
            <li key={post.id}>
              <HubPostCard post={post} campusName={hubCampusName(post.campusSlug, campusNames)} />
            </li>
          ))}
        </ul>
      ) : (
        <SectionError id="hub-upcoming" title="More from the Hub" path={`/hub/${postId}`} />
      )}
    </section>
  );
}

/** More from the Hub's room while it streams in: the heading and three cards. */
export function UpcomingPostsSkeleton() {
  return (
    <div className="hub-upcoming" aria-hidden="true">
      <span className="skeleton hub-upcoming-skeleton-title" />
      <ul className="hub-feed-list">
        {[0, 1, 2].map((n) => (
          <li key={n}>
            <span className="skeleton hub-card-skeleton" />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: Write the page frame**

Create `components/hub/HubPostView.tsx`:

```tsx
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Photo } from "@/components/listings/Photo";
import { hubKindLabel, placesLabel } from "@/lib/format";
import { HUB_FEED_LABELS, feedTypeOf, hubCampusName, hubFeedHref } from "@/lib/hub";
import { longSastDate, sastDateTime } from "@/lib/time";
import type { HubPost } from "@/lib/types";
import { Markdown } from "./Markdown";
import { PostAction, PostActionSkeleton } from "./PostAction";
import { UpcomingPosts, UpcomingPostsSkeleton } from "./UpcomingPosts";

/**
 * A Hub post's page (community spec 5.2): the breadcrumb, the cover (decorative), the kind and title; for events and
 * office hours the facts, the body and then RSVP or Request a slot; for tips the posted date and the body. More from
 * the Hub follows. Only the action and More from the Hub render per request (plan decision 9).
 */
export function HubPostView({ post, campusNames }: { post: HubPost; campusNames: ReadonlyMap<string, string> }) {
  const feedType = feedTypeOf(post.kind);

  let when: ReactNode;
  if (post.startsAt === null) {
    when = (
      <p className="hub-post-date">
        Posted <time dateTime={post.publishedAt}>{longSastDate(post.publishedAt)}</time>
      </p>
    );
  } else {
    when = (
      <ul className="fact-pills hub-post-facts">
        <li>
          <time dateTime={post.startsAt}>{sastDateTime(post.startsAt)}</time>
        </li>
        <li>{post.place}</li>
        <li>{hubCampusName(post.campusSlug, campusNames)}</li>
        {post.capacity !== null && post.going !== null && <li>{placesLabel(post.going, post.capacity)}</li>}
      </ul>
    );
  }

  return (
    <div className="page hub-post-page">
      <nav aria-label="Breadcrumb" className="listing-crumbs">
        <ol>
          <li>
            <Link href="/hub">The Hub</Link>
          </li>
          <li>
            <Link href={hubFeedHref(feedType)} prefetch={false}>
              {HUB_FEED_LABELS[feedType]}
            </Link>
          </li>
        </ol>
      </nav>

      <article className="hub-post">
        <Photo
          image={{ src: post.image.src, alt: "" }}
          sizes="(min-width: 48rem) and (min-height: 30rem) 736px, 100vw"
          className="hub-post-cover"
          priority
        />
        <p className="eyebrow hub-post-kind">{hubKindLabel(post.kind)}</p>
        <h1 className="hub-post-title">{post.title}</h1>
        {when}
        <Markdown source={post.body} className="hub-post-body" />
        {post.startsAt !== null && (
          <Suspense fallback={<PostActionSkeleton kind={post.kind} />}>
            <PostAction post={post} />
          </Suspense>
        )}
      </article>

      <Suspense fallback={<UpcomingPostsSkeleton />}>
        <UpcomingPosts postId={post.id} campusNames={campusNames} />
      </Suspense>
    </div>
  );
}
```

Run: `pnpm test components/hub`
Expected: PASS.

- [ ] **Step 8: The page**

Create `app/hub/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HubPostView } from "@/components/hub/HubPostView";
import { getCampuses, getHubPost, getHubPostIds } from "@/lib/data";
import { shortDescription } from "@/lib/format";
import { markdownText } from "@/lib/markdown";

/**
 * The tab title is the post's ("Pitch night · Vossie"; the layout adds the suffix) and the description the start of
 * its body as plain words (community spec 5.2). Link previews use the one-line summary (plan decision 14). An unknown
 * id gets the 404's title.
 */
export async function generateMetadata({ params }: PageProps<"/hub/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = await getHubPost(id);
  if (!post) return { title: "Page not found" };
  return {
    title: post.title,
    description: shortDescription(markdownText(post.body)),
    openGraph: { title: post.title, description: post.summary },
  };
}

export async function generateStaticParams() {
  return (await getHubPostIds()).map((id) => ({ id }));
}

export default function HubPostPage({ params }: PageProps<"/hub/[id]">) {
  return (
    // Known posts are prerendered, so this fallback only shows for an unknown id, until the 404 takes over.
    <Suspense fallback={null}>
      <PostDetails params={params} />
    </Suspense>
  );
}

async function PostDetails({ params }: Pick<PageProps<"/hub/[id]">, "params">) {
  const { id } = await params;
  const [post, campuses] = await Promise.all([getHubPost(id), getCampuses()]);
  if (!post) notFound();
  return <HubPostView post={post} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />;
}
```

- [ ] **Step 9: The post page's styles**

Add at the end of `app/globals.css`:

```css
/* --- Community: a Hub post (community plan, Task 7, spec 5.2) --- */
@layer components {
  /* .page and .hub-post-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .hub-post-page {
    padding: 8px 16px 64px;
  }

  .hub-post {
    max-width: 46rem;
  }

  /* Phones: the cover edge to edge at 7:3, pulled out by the page's 16px. */
  .hub-post-cover {
    --photo-ratio: 7 / 3;
    margin-inline: -16px;
  }

  .hub-post-kind {
    margin-top: 20px;
  }

  .hub-post-title {
    margin-top: 6px;
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem);
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .hub-post-date {
    margin-top: 12px;
    color: var(--color-muted);
    font-size: 14px;
  }

  .hub-post-facts {
    margin-top: 16px;
  }

  .hub-post-body {
    margin-top: 24px;
  }

  /* RSVP or Request a slot streams in after the rest of the post (plan decision 9). The room is kept for each kind's
     tallest state, so nothing moves: the button, or office hours' button and two-line note. */
  .hub-post-action {
    display: grid;
    justify-items: start;
    align-content: start;
    gap: 8px;
    min-height: 48px;
    margin-top: 28px;
  }

  .hub-post-action[data-kind="office-hours"] {
    min-height: 100px;
  }

  .hub-post-cta {
    min-height: 48px;
    padding-inline: 32px;
  }

  .hub-post-note {
    max-width: 40ch;
    color: var(--color-muted);
    font-size: 14px;
  }

  /* Navy on the grey panel. */
  .hub-post-passed {
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: 0 18px;
    border-radius: 999px;
    background: var(--color-panel);
    color: var(--color-navy);
    font-weight: 600;
  }

  .hub-post-action-skeleton {
    width: 10rem;
    height: 48px;
    border-radius: 999px;
  }

  .hub-upcoming {
    margin-top: 48px;
  }

  .hub-upcoming-skeleton-title {
    width: 14rem;
    height: 24px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .hub-post-page {
      padding-inline: 40px;
    }

    .hub-post-cover {
      margin-top: 8px;
      margin-inline: 0;
      border-radius: var(--radius-panel);
    }
  }

  /* Landscape phones keep the phone layout, with the cover cropped short so it doesn't fill the screen. */
  @media (orientation: landscape) and (max-height: 29.99rem) {
    .hub-post-cover {
      --photo-ratio: 4 / 1;
    }
  }
}
```

- [ ] **Step 10: An unknown post is a 404, and the page is measured**

In `tests/e2e/routes.spec.ts`, rename the test "unknown listing, collection, seller and request links show the 404 page" to "unknown listing, collection, seller, request and Hub post links show the 404 page", and add at the end of its body, after the `/looking-for/nope` lines:

```ts
    await page.goto("/hub/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await expect(page).toHaveTitle("Page not found · Vossie");
```

In `tests/e2e/performance.spec.ts`, add a row at the end of `PAGES`:

```ts
  ["Hub post", "/hub/h-013"],
```

(The tip How to price your first listing has the longest body and the most links.)

- [ ] **Step 11: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build lists `/hub/[id]` with its 18 posts prerendered, each with its streamed parts.

- [ ] **Step 12: Look at it**

Start the build (`pnpm start --port 3201`) and check, at 390 × 844, 768 × 1024 and 1280 × 800:
- `/hub/h-013`: the breadcrumb "The Hub / Tips", the cover (labelled "PHOTO: HOW TO PRICE YOUR FIRST LISTING", edge to edge on the phone), "TIP", the title, "Posted 12 October 2026", then the body: three navy headings, a numbered list, **don't go lower** in bold, *Firm prices are fine too* in italics, and "browse what's already listed" underlined in sky-dark. Then "MORE FROM THE HUB" with up to three event cards.
- `/hub/h-001` (or the first event in the feed, if it has passed): pale pills for the time, the place, "All campuses" and "12 going · 80 places", the body, then RSVP (or "This event has passed" in a grey pill). Nothing moves when the action arrives.
- `/hub/h-002` (or the first office hours in the feed): Request a slot, with the note for the mentor under it.
- `/hub/h-011` and `/hub/h-012`: "This event has passed" and "These office hours have passed".
- From `/hub`, a card opens its post; the breadcrumb's Tips takes you back to the Tips tab, with the feed in view.

Stop the server.

- [ ] **Step 13: Measure the JS**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/routes.spec.ts --project=phone-390`
Expected: all pass. Note the `scriptBrotli` figures. If any page is past the stop line, stop here and report.

- [ ] **Step 14: Hand over for commit**

Files: `components/hub/PostAction.tsx`, `components/hub/PostAction.test.tsx`, `components/hub/UpcomingPosts.tsx`, `components/hub/UpcomingPosts.test.tsx`, `components/hub/HubPostView.tsx`, `components/hub/HubPostView.test.tsx`, `app/hub/[id]/page.tsx`, `app/globals.css`, `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`.
Message: `feat: Hub post pages, with RSVP and Request a slot through sign-in and a request-time "has passed" (community spec 5.2). JS: post <n> B`

---


### Task 8: The homepage's links

The homepage's request rows open their own request, and What's on's RSVP and Book open their own post (spec 4.3 and 5.3). Nothing else on the homepage changes (plan decision 1 covers what the new requests change).

**Files:**
- Modify: `components/home/LookingForRequests.tsx`, `components/home/LookingForRequests.test.tsx`
- Modify: `components/home/WhatsOn.tsx`, `components/home/WhatsOn.test.tsx`

- [ ] **Step 1: Change the tests**

In `components/home/LookingForRequests.test.tsx`, in "lists three open requests, the campus's own first, with their offers", replace `expect(rows[0]).toHaveAttribute("href", "/looking-for");` with:

```tsx
    // Each row opens its own request (community spec 4.3).
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/looking-for/r-001",
      "/looking-for/r-003",
      "/looking-for/r-002",
    ]);
```

In `components/home/WhatsOn.test.tsx`, in "lists the campus's next three events with a date block and an action", replace the last two lines of the test (the `RSVP for Pitch night` and `Book for Office hours: pricing your hustle` expectations) with:

```tsx
    // Each event opens its own post (community spec 5.3).
    expect(within(rows[0]).getByRole("link", { name: "RSVP for Pitch night" })).toHaveAttribute("href", "/hub/h-001");
    expect(within(rows[1]).getByRole("link", { name: "Book for Office hours: pricing your hustle" })).toHaveAttribute(
      "href",
      "/hub/h-002",
    );
```

The empty state's "See what the Hub is planning" still goes to `/hub`; its test stays as it is.

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/home/LookingForRequests.test.tsx components/home/WhatsOn.test.tsx`
Expected: FAIL: the rows still link to `/looking-for`, and RSVP and Book to `/hub`.

- [ ] **Step 3: Point the links at the new pages**

In `components/home/LookingForRequests.tsx`, replace:

```tsx
          {/* Requests open on the Looking For page, a placeholder in this stage (spec 7.11). */}
          <Link href="/looking-for" className="request-row">
```

with:

```tsx
          {/* Each request opens its own page (community spec 4.3). No prefetch: three different pages now (plan
              decision 12, decision 28). */}
          <Link href={`/looking-for/${request.id}`} prefetch={false} className="request-row">
```

In `components/home/WhatsOn.tsx`, replace:

```tsx
            {/* The Hub page is a placeholder in this stage; RSVP and booking arrive with it. */}
            <Link href="/hub" className="event-action">
```

with:

```tsx
            {/* Each event opens its own post, where RSVP and booking go through sign-in (community spec 5.3). No
                prefetch: three different pages (plan decision 12, decision 28). */}
            <Link href={`/hub/${event.id}`} prefetch={false} className="event-action">
```

Run: `pnpm test components/home`
Expected: PASS.

- [ ] **Step 4: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass.

- [ ] **Step 5: Measure the homepage and run its end-to-end tests**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/home.spec.ts tests/e2e/responsive.spec.ts --project=phone-390`
Expected: all pass. The homepage's `scriptBrotli` moves by a few bytes at most (the links' props). If any page is past the stop line, stop here and report.

- [ ] **Step 6: Hand over for commit**

Files: `components/home/LookingForRequests.tsx`, `components/home/LookingForRequests.test.tsx`, `components/home/WhatsOn.tsx`, `components/home/WhatsOn.test.tsx`.
Message: `feat: the homepage's request rows and What's on's RSVP and Book open their own pages (community spec 4.3, 5.3). JS: / <n> B`

---

### Task 9: End-to-end tests for Looking For and the Hub

The spec's end-to-end list (spec 8), at the five sizes: the board with and without a campus, a category filter, a request and its sign-in, a closed request, the Hub feed and its tabs, an event and RSVP's sign-in, a tip's markdown, the homepage's links, and (in `routes.spec.ts`, Tasks 5 and 7) the 404s. Nothing here assumes a date: tests that need an upcoming event find one in the feed and skip with a message when there's none.

**Files:**
- Create: `tests/e2e/community.spec.ts`

- [ ] **Step 1: Write the tests**

Create `tests/e2e/community.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

const SAST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Johannesburg",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A UTC time's date in South Africa, YYYY-MM-DD, as the server works it out. */
const sastDateOf = (iso: string) => SAST_DATE.format(new Date(iso));

/** The request rows on the page that's showing. Next keeps the last few pages hidden in the DOM for Back. */
const rows = (page: Page) => page.locator(".board-row").filter({ visible: true });

/** The request titles in one of the board's sections. */
const sectionTitles = (page: Page, section: string) =>
  page.getByRole("region", { name: section }).getByRole("heading", { level: 3 });

/** The Hub's cards on the page that's showing. */
const hubCards = (page: Page) => page.locator(".hub-card").filter({ visible: true });

const TIPS = [
  "How to price your first listing",
  "Five phone tricks for better photos",
  "Meeting a buyer safely on campus",
  "Writing a listing people trust",
  "How to get the Verified badge",
  "From side hustle to small business",
];

test.describe("the Looking For board (spec 4.1)", () => {
  test("lists every open request, newest first, when no campus is chosen", async ({ page }) => {
    await page.goto("/looking-for");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Looking For");
    await expect(page.getByText("Post what you need, and students who can help will offer.")).toBeVisible();
    const titles = sectionTitles(page, "Open requests");
    await expect(titles).toHaveCount(14);
    await expect(titles.first()).toHaveText("Accounting 1 tutor this week");
    await expect(page.getByText("Kettle for res")).toHaveCount(0);
    await expect(page).toHaveTitle("Looking For · Vossie");
  });

  test("puts the chosen campus first, then every other, naming no one", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
    await page.goto("/looking-for");
    await expect(sectionTitles(page, "At Midrand")).toHaveText([
      "Accounting 1 tutor this week",
      "Birthday cake for Friday",
    ]);
    await expect(sectionTitles(page, "Other campuses")).toHaveCount(12);
    const first = page.getByRole("region", { name: "At Midrand" }).locator(".board-row").first();
    await expect(first).toContainText("Midrand · Tutoring · Budget R300");
    await expect(first).toContainText("Posted 13 Oct · 2 offers");
  });

  test("says when the chosen campus has none, and shows the rest", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
    await page.goto("/looking-for");
    await expect(page.getByRole("region", { name: "At Mbombela" })).toContainText("Nothing at Mbombela yet.");
    await expect(sectionTitles(page, "Other campuses")).toHaveCount(14);
  });

  test("a category chip narrows the board, keeping focus, and All widens it again", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for");
    const chips = page.getByRole("navigation", { name: "Categories" });
    await chips.getByRole("link", { name: "Tech", exact: true }).click();
    await expect(page).toHaveURL(/\/looking-for\?cat=tech$/);
    await expect(chips.getByRole("link", { name: "Tech", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(sectionTitles(page, "Open requests")).toHaveText([
      "Graphic calculator to borrow for exams",
      "Laptop charger, Lenovo 65W",
    ]);
    // The chip that was tapped keeps focus: it isn't left behind in a hidden page.
    await expect(chips.getByRole("link", { name: "Tech", exact: true })).toBeFocused();
    await chips.getByRole("link", { name: "All", exact: true }).click();
    await expect(page).toHaveURL(/\/looking-for$/);
    await expect(rows(page)).toHaveCount(14);
  });

  test("a category with nothing open invites the first request", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for?cat=tickets-events");
    await expect(page.getByText("No requests here yet. Be the first to ask.")).toBeVisible();
    await expect(page.locator(".board-empty").getByRole("link", { name: "Post a request" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for",
    );
  });

  test("Post a request goes through the sign-in page and back", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for");
    await page.locator(".board-head").getByRole("link", { name: "Post a request" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Flooking-for$/);
    await page.getByRole("link", { name: "Go back" }).click();
    await expect(page).toHaveURL(/\/looking-for$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Looking For");
  });

  test("the chips scroll sideways on phones, and the page doesn't", async ({ page }) => {
    onlyAt("phone-360", "phone-390");
    await page.goto("/looking-for");
    const chipRow = page.locator(".link-chips ul");
    await expect(chipRow).toBeVisible();
    expect(await chipRow.evaluate((list) => list.scrollWidth > list.clientWidth)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
  });
});

test.describe("a request's page (spec 4.2)", () => {
  test("shows the facts, the asker's words and the offers, naming no one", async ({ page }) => {
    await page.goto("/looking-for/r-001");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accounting 1 tutor this week");
    await expect(page.locator(".request-facts li")).toHaveText([
      "Midrand",
      "Tutoring",
      "Budget R300",
      "Needed by 16 Oct",
      "Posted 13 Oct",
      "Asked by a student at Midrand",
    ]);
    await expect(page.getByText("stuck on adjustments and the trial balance", { exact: false })).toBeVisible();
    await expect(page.getByText("2 offers so far")).toBeVisible();
    await expect(page.getByRole("link", { name: "Offer to help" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fr-001",
    );
    await expect(page).toHaveTitle("Accounting 1 tutor this week · Vossie");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /^I'm stuck on adjustments/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("shows listings already on Vossie, the request's campus first, and links to the rest", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for/r-001");
    const related = page.getByRole("region", { name: "Already on Vossie" });
    const cards = related.locator("article");
    await expect(cards).toHaveCount(4);
    const hrefs = await cards
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual(["/listings/l-005", "/listings/l-013", "/listings/l-031", "/listings/l-025"]);
    await related.getByRole("link", { name: "See all in Tutoring" }).click();
    await expect(page).toHaveURL(/\/browse\?cat=tutoring$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tutoring");
  });

  test("Offer to help goes through the sign-in page and back", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for/r-001");
    await page.getByRole("link", { name: "Offer to help" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fr-001$/);
    await page.getByRole("link", { name: "Go back" }).click();
    await expect(page).toHaveURL(/\/looking-for\/r-001$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accounting 1 tutor this week");
  });

  test("a closed request says so, with no way to offer", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for/r-015");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kettle for res");
    await expect(page.getByText("This request is closed")).toBeVisible();
    await expect(page.getByRole("link", { name: "Offer to help" })).toHaveCount(0);
  });

  test("a row opens its request, and the breadcrumb leads back to its category", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for");
    await page.getByRole("link", { name: "Business Law 2 notes" }).click();
    await expect(page).toHaveURL(/\/looking-for\/r-007$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Business Law 2 notes");
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Textbooks & notes" }).click();
    await expect(page).toHaveURL(/\/looking-for\?cat=textbooks-notes$/);
    await expect(rows(page)).toHaveCount(1);
  });
});

test.describe("the Hub (spec 5.1)", () => {
  test("tells the Hub's story and shows its Verified sellers", async ({ page }) => {
    await page.goto("/hub");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Incubation Hub");
    await expect(page.getByText("The Hub also runs Vossie.", { exact: false })).toBeVisible();
    const verified = page.getByRole("region", { name: "Verified by the Hub" });
    await expect(verified.getByRole("link")).toHaveCount(9);
    await expect(verified.getByRole("link").first()).toHaveAttribute("href", "/sellers/code-coach");
    await expect(page).toHaveTitle("The Incubation Hub · Vossie");
  });

  test("the Verified sellers scroll sideways on phones and wrap from the tablet step", async ({ page }) => {
    onlyAt("phone-390", "tablet-768", "desktop-1440");
    await page.goto("/hub");
    const row = page.locator(".hub-sellers");
    await expect(row).toBeVisible();
    const scrolls = await row.evaluate((list) => list.scrollWidth > list.clientWidth);
    expect(scrolls).toBe(project() === "phone-390");
  });

  test("lists upcoming events and office hours soonest first, then the tips, newest first", async ({ page }) => {
    await page.goto("/hub");
    await expect(page.getByRole("list", { name: "Tips" }).getByRole("heading", { level: 3 })).toHaveText(TIPS);
    // The past sample posts never show.
    await expect(page.getByText("Hub open day")).toHaveCount(0);
    // What's upcoming depends on the date the tests run, so check the order and that nothing has passed.
    const dated = page.getByRole("list", { name: "Events and office hours" });
    if ((await dated.count()) === 0) {
      await expect(page.getByText("Nothing planned right now. Check back soon.")).toBeVisible();
      return;
    }
    const times = await dated
      .locator("time")
      .evaluateAll((items) => items.map((item) => item.getAttribute("datetime")!));
    expect(times).toEqual([...times].sort());
    const today = SAST_DATE.format(new Date());
    for (const time of times) expect(sastDateOf(time) >= today, time).toBe(true);
  });

  test("the type tabs narrow the feed and keep it in view", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/hub");
    const tabs = page.getByRole("navigation", { name: "Post types" });
    await tabs.getByRole("link", { name: "Tips" }).click();
    await expect(page).toHaveURL(/\/hub\?type=tips#hub-feed$/);
    await expect(tabs.getByRole("link", { name: "Tips" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("list", { name: "Tips" }).getByRole("heading", { level: 3 })).toHaveCount(6);
    await expect(page.getByRole("list", { name: "Events and office hours" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "What’s on and what’s new" })).toBeInViewport();

    await tabs.getByRole("link", { name: "Events" }).click();
    await expect(page).toHaveURL(/\/hub\?type=events#hub-feed$/);
    await expect(page.getByRole("list", { name: "Tips" })).toHaveCount(0);
    // Every card left is an event (or, once the sample events are past, there are none).
    for (const kind of await hubCards(page).locator(".hub-card-kind").allTextContents()) expect(kind).toBe("Event");
  });
});

test.describe("Hub posts (spec 5.2)", () => {
  test("an upcoming event shows its facts, and RSVP goes through the sign-in page and back", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/hub?type=events");
    await expect(page.getByRole("navigation", { name: "Post types" })).toBeVisible();
    test.skip((await hubCards(page).count()) === 0, "No upcoming sample events on the date the tests run");
    const first = hubCards(page).first();
    const title = (await first.getByRole("heading", { level: 3 }).textContent())!;
    await first.getByRole("link").click();
    await expect(page).toHaveURL(/\/hub\/h-\d{3}$/);
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.locator(".hub-post-kind").filter({ visible: true })).toHaveText("Event");
    await expect(page.locator(".hub-post-facts li").filter({ visible: true })).toHaveCount(4);
    await page.getByRole("link", { name: "RSVP" }).click();
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fhub%2F${id}$`));
    await page.getByRole("link", { name: "Go back" }).click();
    await expect(page).toHaveURL(new RegExp(`/hub/${id}$`));
  });

  test("upcoming office hours offer Request a slot through the sign-in page", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/hub?type=office-hours");
    await expect(page.getByRole("navigation", { name: "Post types" })).toBeVisible();
    test.skip((await hubCards(page).count()) === 0, "No upcoming sample office hours on the date the tests run");
    await hubCards(page).first().getByRole("link").click();
    await expect(page).toHaveURL(/\/hub\/h-\d{3}$/);
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.getByRole("link", { name: "Request a slot" })).toHaveAttribute(
      "href",
      `/login?next=%2Fhub%2F${id}`,
    );
    await expect(page.getByText("Tell the mentor what you'd like help with when you sign in.")).toBeVisible();
  });

  test("a past event and past office hours still open, and say they've passed", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/hub/h-011");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hub open day");
    await expect(page.getByText("This event has passed")).toBeVisible();
    await expect(page.getByRole("link", { name: "RSVP" })).toHaveCount(0);
    await page.goto("/hub/h-012");
    await expect(page.getByText("These office hours have passed")).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a slot" })).toHaveCount(0);
  });

  test("a tip shows its date and its markdown body", async ({ page }) => {
    await page.goto("/hub/h-013");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How to price your first listing");
    await expect(page.locator(".hub-post-kind")).toHaveText("Tip");
    await expect(page.getByText("Posted 12 October 2026")).toBeVisible();
    const body = page.locator(".hub-post-body");
    await expect(body.getByRole("heading", { level: 2 })).toHaveText([
      "Start from what's out there",
      "Check your costs",
      "Leave room for a fair offer",
    ]);
    await expect(body.locator("ol > li")).toHaveCount(3);
    await expect(body.locator("strong")).toHaveText("don't go lower");
    await expect(body.locator("em")).toHaveText("Firm prices are fine too");
    const link = body.getByRole("link", { name: "browse what's already listed" });
    await expect(link).toHaveAttribute("href", "/browse");
    await expect(link).toHaveCSS("text-decoration-line", "underline");
    await expect(link).toHaveCSS("color", "rgb(30, 123, 168)");
    await expect(page).toHaveTitle("How to price your first listing · Vossie");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /^Pricing is the first thing buyers look at/,
    );
  });

  test("More from the Hub offers up to three other upcoming posts", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/hub/h-013");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const more = page.getByRole("region", { name: "More from the Hub" });
    // It hides once nothing else is planned, which depends on the date the tests run.
    test.skip((await more.count()) === 0, "No upcoming sample events on the date the tests run");
    const cards = more.locator(".hub-card");
    expect(await cards.count()).toBeGreaterThan(0);
    expect(await cards.count()).toBeLessThanOrEqual(3);
    for (const kind of await cards.locator(".hub-card-kind").allTextContents()) {
      expect(["Event", "Office hours"]).toContain(kind);
    }
  });
});

test.describe("the homepage's links (spec 4.3 and 5.3)", () => {
  test("a request row opens its request", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await page.locator(".request-list").getByRole("link", { name: /Accounting 1 tutor this week/ }).click();
    await expect(page).toHaveURL(/\/looking-for\/r-001$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accounting 1 tutor this week");
  });

  test("What's on's RSVP or Book opens the event's post", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await expect(page.locator("#whats-on").locator(".event-action, .whats-on-empty").first()).toBeAttached();
    // What's on shows only upcoming events, so whether there are any depends on the date the tests run.
    test.skip((await page.locator("#whats-on .event-action").count()) === 0, "No upcoming sample events");
    const row = page.locator("#whats-on .event").first();
    const title = (await row.locator(".event-title").textContent())!;
    const href = (await row.locator(".event-action").getAttribute("href"))!;
    expect(href).toMatch(/^\/hub\/h-\d{3}$/);
    await row.locator(".event-action").click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });
});
```

- [ ] **Step 2: Run them**

Run: `pnpm e2e tests/e2e/community.spec.ts`
Expected: all pass at every size they run at; the rest are skipped by design. Tests that need an upcoming event skip with a message only once the sample events are past (after 11 February 2027; office hours after 19 November 2026).

If "a category chip narrows the board, keeping focus" fails only on `toBeFocused()`, Next has left the tapped chip in a hidden copy of the page: that's the focus loss the browse build met with its sort links. Stop and report it with the trace, rather than changing the test or the links.

If a locator is ambiguous (a strict-mode error naming two elements), make it exact the way the browse and listing tests did, and note it for this plan's "Changes made during the build".

- [ ] **Step 3: Hand over for commit**

Files: `tests/e2e/community.spec.ts`.
Message: `test: Looking For and the Hub end to end`

---


### Task 10: Accessibility and layout shift

axe on every new page and state, and layout shift on each page (spec 8).

**Files:**
- Modify: `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`

- [ ] **Step 1: Run axe on each new page and state**

Add to the end of `tests/e2e/a11y.spec.ts`:

```ts
test("the Looking For board", async ({ page }) => {
  await page.goto("/looking-for");
  await expect(page.getByRole("region", { name: "Open requests" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the Looking For board at a campus with no requests", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
  await page.goto("/looking-for");
  await expect(page.getByText("Nothing at Mbombela yet.")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the Looking For board with nothing in a category", async ({ page }) => {
  await page.goto("/looking-for?cat=tickets-events");
  await expect(page.getByText("No requests here yet. Be the first to ask.")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a request", async ({ page }) => {
  await page.goto("/looking-for/r-001");
  await expect(page.getByRole("region", { name: "Already on Vossie" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a closed request", async ({ page }) => {
  await page.goto("/looking-for/r-015");
  await expect(page.getByText("This request is closed")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the Hub", async ({ page }) => {
  await page.goto("/hub");
  await expect(page.getByRole("list", { name: "Tips" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the Hub's office hours tab", async ({ page }) => {
  await page.goto("/hub?type=office-hours");
  await expect(page.getByRole("navigation", { name: "Post types" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a Hub event", async ({ page }) => {
  await page.goto("/hub/h-001");
  await expect(page.locator(".hub-post-action").getByText(/RSVP|This event has passed/)).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a past Hub event", async ({ page }) => {
  await page.goto("/hub/h-011");
  await expect(page.getByText("This event has passed")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a Hub tip", async ({ page }) => {
  await page.goto("/hub/h-013");
  await expect(page.locator(".hub-post-body").getByRole("heading", { level: 2 }).first()).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});
```

- [ ] **Step 2: Measure layout shift on each new page**

`tests/e2e/cls.spec.ts`'s `PAGES` takes a page's cookies as its third value (the shopping plan's Task 11 made it so). If it still takes a campus string, stop and report: the shopping plan's Task 11 isn't in.

Add these rows at the end of `PAGES`:

```ts
  ["Looking For board", "/looking-for"],
  ["Looking For board (campus mbombela)", "/looking-for", { vossie_campus: "mbombela" }],
  ["request page", "/looking-for/r-001"],
  ["Hub page", "/hub"],
  ["Hub event", "/hub/h-001"],
  ["Hub office hours", "/hub/h-002"],
  ["Hub tip", "/hub/h-013"],
```

and add this sentence to the end of the comment above `PAGES`: `The Looking For board reads the campus cookie too; Mbombela has no requests of its own. A Hub event's and office hours' action streams in, so both are measured.`

- [ ] **Step 3: Run them**

Run: `pnpm e2e tests/e2e/a11y.spec.ts tests/e2e/cls.spec.ts`
Expected: all pass. Note each new page's layout shift at 390 and 1440 for `docs/PROGRESS.md`.

If axe reports a serious or critical issue, fix the cause in the component or CSS (not the test), and note it for this plan's "Changes made during the build". If a page's layout shift is over 0.05, the log line names the moving nodes. The likely causes, in order:
- the board's skeleton chips row (one row of 44px on phones, two rows of 96px from the tablet step) not matching the real chips at that width;
- the feed's skeleton tab row or cards;
- a post's action room (`.hub-post-action`, 48px, or 100px for office hours) being shorter than what arrives;
- a photo box without its ratio.

Fix the CSS so the skeleton matches, not the test.

- [ ] **Step 4: Hand over for commit**

Files: `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`, and any component or CSS file a fix touched.
Message: `test: accessibility and layout shift for Looking For and the Hub`

---

### Task 11: Review screenshots, docs and final checks

**Files:**
- Modify: `tests/e2e/screenshots.spec.ts`
- Create: `docs/progress/community/*.png`
- Modify: `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `CLAUDE.md`, the spec (`docs/superpowers/specs/2026-10-14-community-pages-design.md`)
- Modify: this plan (the ledger and a "Changes made during the build" section)

- [ ] **Step 1: Add the review screenshots**

Add to the end of `tests/e2e/screenshots.spec.ts`:

```ts
test("community review screenshots", async ({ page, context, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/community/${project}-${name}.png`;

  /** Scroll the whole page so every lazy photo loads, then come back to the top. */
  async function settle() {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.scrollTo(0, 0);
      await document.fonts.ready;
    });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });

  // The board, the feed and a post's action stream in behind skeletons, so each shot waits for something the finished
  // page shows.
  const title = page.getByRole("heading", { level: 1 });

  await page.goto("/looking-for");
  await expect(page.getByRole("region", { name: "Open requests" })).toBeVisible();
  await settle();
  await page.screenshot({ path: file("01-board"), fullPage: true });

  await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
  await page.goto("/looking-for");
  await expect(page.getByRole("region", { name: "At Midrand" })).toBeVisible();
  await page.screenshot({ path: file("02-board-campus") });
  await context.clearCookies();

  await page.goto("/looking-for?cat=tickets-events");
  await expect(page.getByText("No requests here yet. Be the first to ask.")).toBeVisible();
  await page.screenshot({ path: file("03-board-empty") });

  await page.goto("/looking-for/r-001");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("04-request"), fullPage: true });

  await page.goto("/looking-for/r-015");
  await expect(page.getByText("This request is closed")).toBeVisible();
  await page.screenshot({ path: file("05-request-closed") });

  await page.goto("/hub");
  await expect(page.getByRole("list", { name: "Tips" })).toBeVisible();
  await settle();
  await page.screenshot({ path: file("06-hub"), fullPage: true });

  await page.goto("/hub?type=tips#hub-feed");
  await expect(page.getByRole("list", { name: "Tips" })).toBeVisible();
  await page.screenshot({ path: file("07-hub-tips") });

  await page.goto("/hub/h-001");
  await expect(page.locator(".hub-post-action").getByText(/RSVP|This event has passed/)).toBeVisible();
  await settle();
  await page.screenshot({ path: file("08-hub-event"), fullPage: true });

  await page.goto("/hub/h-013");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("09-hub-tip"), fullPage: true });

  await page.goto("/hub/h-012");
  await expect(page.getByText("These office hours have passed")).toBeVisible();
  await page.screenshot({ path: file("10-hub-past") });
});
```

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "community review screenshots"`
Expected: 20 PNGs in `docs/progress/community/`. Open a few and check they show what their names say.

- [ ] **Step 2: Bring the spec in line with the build**

In `docs/superpowers/specs/2026-10-14-community-pages-design.md`:
- Status: "Built (2026-10-<day>)". Keep the sentence about Lama's standing goal, and say the decisions are now rows <n> and <n+1> of the decisions log.
- Section 3, the `/hub/[id]` row: More from the Hub also renders per request, because "upcoming" depends on today (plan decision 9).
- Section 4.2, item 4: a closed request's panel says only "This request is closed" (plan decision 8).
- Section 4.3: the homepage's Looking For band now leads with the viewer's own request at the seven campuses that had none (plan decision 1).
- Section 5.1: the Verified sellers wrap from the tablet step (plan decision 7); the tabs link to `#hub-feed` (plan decision 6).
- Section 5.3: two past posts join the 10 events (plan decision 2); "Photo day for your shop" is office hours (plan decision 3); the function is `getHubPosts({ kinds, from })` (plan decision 15).
- Anything else the build changed, from this plan's "Changes made during the build".

In `docs/reference/LANDING-DECISIONS.md`, add rows after the last one, numbered on from it, in the log's style. The spec's ten decisions were never logged, so they come first; then the plan decisions that changed the spec, as Lama confirmed them at plan review:

```markdown
| <n> | 2026-10-14 | Looking For (community spec decisions 1 to 4) | **Reading is public and acting goes to the sign-in page; requests name no one ("Asked by a student at Midrand"); the board opens on your campus, with category chips; a request shows up to 4 listings already on Vossie** | Spec `2026-10-14-community-pages-design.md`, part B of decision 48. Decided under Lama's standing goal; logged when the pages were built |
| <n+1> | 2026-10-14 | The Incubation Hub (community spec decisions 5 to 10) | **One feed of posts (tips, events and office hours) that also feeds What's on; past ones drop off, but their pages stay and say so; every campus, soonest first, with type tabs; the page leads with the story and the Verified sellers; bodies use a small markdown subset rendered on the server, linking inside the site only; no new client code** | As above |
| <n+2> | 2026-10-<day> | Community plan decisions that change the spec | **The homepage's Looking For band leads with a campus's own request at seven more campuses; two past Hub posts; Photo day is office hours; More from the Hub renders per request; a closed request shows only "closed"; the tabs land on the feed** | Plan decisions 1, 2, 3, 6, 8 and 9 in `2026-10-14-community-pages.md`. The spec now says so. Lama, at plan review |
```

Name in the last row any other plan decision Lama changed or kept on purpose, and any JS figure Lama accepted under the stop rule.

- [ ] **Step 3: Update the checklist, CLAUDE.md and the progress log**

In `docs/reference/GO-LIVE.md`:
- The Looking For board row becomes **Built (posting a request waits for accounts)**.
- The single request row becomes **Built (offers wait for accounts)**.
- The Hub feed row becomes **Built**.
- The Hub post row becomes **Built (RSVP and booking wait for accounts)**.
- In the second paragraph, add "and on 2026-10-<day>, after Looking For and the Hub" to the "Updated …" sentence.
- In "Suggested order", item 2 becomes: `**Now, the other public pages:** the storefront, Saved, collections, Looking For and the Hub are done (2026-10-<day>). Next: info and legal pages, and the error page (part C).`

In `CLAUDE.md`, in "Privacy (POPIA)", add after the first bullet:

```markdown
- Looking For requests never name the asker: they say "Asked by a student at {campus}". Sellers are businesses and show their names (community spec decision 2).
```

In `docs/PROGRESS.md`, add a section before "Next", in the style of the earlier ones:

```markdown
## 2026-10-<day>: Community pages built (Looking For and the Hub)
- **Looking For** (`/looking-for`): the board opens on your campus ("At Midrand", then "Other campuses") with category chips. Each row shows where, what, the budget, when it was posted and the offers. Empty and error states; Post a request goes to the sign-in placeholder.
- **A request** (`/looking-for/[id]`): the facts as pills, the asker's words (no names: "Asked by a student at Midrand"), the offers and Offer to help (to sign-in), "This request is closed" when it is, up to four listings already on Vossie in the same category, and Report.
- **The Hub** (`/hub`): the story, the Verified sellers (A to Z, linking to their shops) and one feed: upcoming events and office hours, soonest first, then tips, with a tab for each.
- **A Hub post** (`/hub/[id]`): the cover, the facts, a markdown body rendered on the server (links inside the site only), RSVP or Request a slot through sign-in, "has passed" once the day is over, and More from the Hub.
- **Data:** 16 requests (the homepage's 7 unchanged) and 18 Hub posts (the 10 events, 2 past ones and 6 tips). What's on is derived from the posts, and its RSVP and Book links, like the homepage's request rows, open the new pages. The Looking For band now leads with a campus's own request at seven more campuses (plan decision 1).
- **Plan decisions Lama may want to revisit:** <list any of the 20 that came up in review, or "none">.
- **Checks:**
  - lint and types are clean;
  - <n> unit tests pass;
  - end to end, <n> pass, <n> are skipped by design and none fail;
  - axe finds no serious or critical issues.
- **First visit at 390px, JS brotli:** homepage <n> B, browse <n> B, listing <n> B, board <n> B, request <n> B, Hub <n> B, Hub post <n> B (limit 153,600 B; stop line <n> B).
- **Layout shift** (fonts held back, at 390 and 1440px): <table of the new pages>.
- Review screenshots: `docs/progress/community/`.
```

Fill in the numbers from your runs. Then replace "Next" with:

```markdown
## Next
- Lama reviews the screenshots in `docs/progress/community/`. To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "community review screenshots"`.
- Then part C of the other public pages: info, legal and system pages.
```

- [ ] **Step 4: Record what changed during the build**

Fill in this plan's JS ledger, and add a "Changes made during the build" section after it, listing every place the build differed from the tasks as written, with the commit that made each change.

- [ ] **Step 5: Final checks**

Run, one after another: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`.
Expected: all pass. Record the unit and e2e counts in `docs/PROGRESS.md`.

- [ ] **Step 6: Hand over for commit**

Files: `tests/e2e/screenshots.spec.ts`, `docs/progress/community/`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-14-community-pages-design.md`, this plan.
Message: `docs: community pages review screenshots, progress, checklist, the spec's decisions logged and the spec brought in line`

