# Vossie Browse and Listing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the browse page (`/browse`: search, category tabs, filters, sort, Show more) and the full listing page (`/listings/[id]`) on sample data, as the spec `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md` describes, tested at five screen sizes and within the JS budget.

**Architecture:**
- **The URL is the state.** `lib/browse/` turns search params into a `BrowseQuery` and builds every link back out of one. Tabs, chips, sort and Show more are links; Filters and the browse search are plain GET forms; Filters and Sort open with `<details>`. Browse adds no client code and works without the app's JavaScript bundle (plan decision 18).
- **Server first.** Every new component is a Server Component except `ShareButton`. Browse renders per request inside `<Suspense>` (it reads `searchParams` and the campus cookie). Listing pages stay prerendered; only the "not your campus" note reads the cookie, inside its own `<Suspense>`.
- **Data only through `lib/data`.** One listing model for regular, free and swap items. New cached functions: `searchListings`, `getListingDetail`, `getMoreFrom`, `getPickupPoints`. The filtering, sorting and search maths are plain functions in `lib/browse/`, so Supabase later replaces only the data source.

**Tech Stack:** As the homepage left it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5 with Testing Library and jsdom 30;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md`. "Spec 4.8" in this plan means that spec's section 4.8.
- **Homepage spec** (tokens, breakpoints, motion, accessibility, budgets): `docs/superpowers/specs/2026-10-08-homepage-design.md`.
- **Decisions:** `docs/reference/LANDING-DECISIONS.md` (rows 35 to 45 are this stage's).
- **Previous plan, for conventions:** `docs/superpowers/plans/2026-10-12-homepage-part-2-sections.md`.

---

## Before you start

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed. This is Lama's standing preference.
3. **Files this plan removes** (each named here so the go-ahead covers exactly these):
   - `data/fixtures/free-swaps.ts` (Task 2: its items join `listings.ts`);
   - `app/categories/[slug]/page.tsx` and `app/c/[campus]/page.tsx`, then their four folders once empty (`app/categories/[slug]`, `app/categories`, `app/c/[campus]`, `app/c`) (Task 13: replaced by redirects);
   - `components/footer/ShopYourCampusLink.tsx` (Task 13: the link no longer needs client code).
4. **Files this plan moves** (Task 8): `components/home/ListingCard.tsx`, `Photo.tsx` and `SaveHeart.tsx`, with `ListingCard.test.tsx` and `SaveHeart.test.tsx`, into `components/listings/`.

No installs are needed.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time. Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and only `rm` what this plan names.
- Never kill an install or build that is still running.
- Port 3100 is Lama's dev server. Don't touch it. The e2e tests use 3200; the "looking at it" checks use 3201.

## Where the homepage left things (checked on 2026-10-13)

| Area | Fact |
|---|---|
| Repo | `main`, clean, at `a87b72f` (the spec commit) |
| Tests | 310 unit tests. End to end: 283 pass and 142 are skipped by design |
| JS | A first visit to `/` at 390px loads 150,316 B (brotli, quality 5). Limit 153,600 B. `/browse` and `/listings/[id]` haven't been measured; Task 21 measures them |
| `/browse`, `/login` | `ComingSoon` placeholders |
| `/listings/[id]` | A placeholder that records "recently viewed". Prerendered for every id from `getListingIds()`, `params` awaited inside `<Suspense>` |
| `/categories/[slug]`, `/c/[campus]` | Placeholders with `generateStaticParams`; unknown slugs 404 |
| Free and swap items | A separate fixture (`free-swaps.ts`, ids `fs-001` to `fs-007`) and type (`FreeSwapItem`) |
| `priceLabel` | "R250", "From R400" or "Swap". A cash-or-swap R450 shows "R450"; R0 would show "R0" |
| `SectionError` | Its "Try again" link always goes to `/?retry=…`, which only suits the homepage |
| `SaveHeart` | Absolutely positioned over a card photo (`.save-heart`) |
| `NavLink` | Marks itself current when `usePathname() === href`, so a link with a query string is never marked |
| Toasts | `.toast-pop` sits 16px above the bottom of the screen on phones |
| `next/og` | Reads `ttf`, `otf` and `woff` only. The interim fonts come from `next/font/google`; there are no font files in the repo |
| Redirects | `next.config.ts` `redirects()` keeps the request's query and adds the destination's; they run before the filesystem |
| Metadata | Under Cache Components, `generateMetadata` that reads `searchParams` streams with the page's other request-time content. That's fine on `/browse`, whose body is request-time anyway |
| Test helpers | `tests/helpers/dom.ts` exists. `vitest.setup.ts` mocks `next/navigation` and `next/image` |
| `<details name>` | Typed in `@types/react` (`DetailsHTMLAttributes.name`) |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. In this plan, "plan decision N" means this list; "decision N" on its own means a row in the decisions log.

1. **The toolbar's layout.** Filters, Sort and the count share one wrapping row. An open Filters panel takes the full width under the row, so Sort and the count move beneath it. Sort's menu opens in place under its own button. Nothing ever floats over the results, because a `<details>` can't be closed by tapping outside it.
2. **The Filters button's name** is set with `aria-label` ("Filters, 2 active"). Chromium adds spaces between a summary's flex children, so building the name from hidden spans would read "Filters , 2 active".
3. **Browse's links don't prefetch:** tabs, chips, sort links and cards (decision 28). Each is a different query, and prefetching them all would cost mobile data.
4. **Show more is a plain `<a>`, not `<Link>`.** A full page load with `#r-25` puts the keyboard's starting point on the first new card, as spec 4.6 asks. Next's client navigation scrolls to the hash but leaves focus on the button. The lint rule against plain links is switched off on that one line, with the reason.
5. **The Sort and Filters `<details>` are keyed on the query,** so a client-side navigation (a sort link) gives a closed menu instead of one left open.
6. **The denim jacket joins Free & swaps.** `l-010` is already swap-only, so with one model it belongs there. The homepage panel shows 8 items with it first, at every campus that doesn't have its own. Spec 11 said the items would be unchanged; this is the one change.
7. **The seven free and swap items are dated 8 October,** older than every other listing, so Just listed at Midrand and at every campus stays exactly as it is. Pretoria's Just listed loses the paused lash listing and gains the desk lamp swap.
8. **29 sellers** (spec 6.2 said about 20), so every listing's seller is on its campus. The 19 new ones aren't verified, so Featured today doesn't change.
9. **On a desktop listing page, the description, facts and safety note sit in the left column under the photos,** beside the column that stays in view. More from and the report link run full width below. Spec 5.2 had all of them full width; this keeps the column in view for longer and the lines shorter.
10. **The share card uses `next/og`'s built-in font** until Eduvos's font files arrive. `next/og` can't read `woff2`, and there's no font file in the repo to read.
11. **Small API changes:** `SaveHeart` takes a `className`, so the listing page can place it in the action bar. `SectionError` takes a `path`, so "Try again" on a listing page comes back to that listing.
12. **"Shop your campus" becomes a plain link to `/browse`,** which now opens on the chosen campus. `ShopYourCampusLink`, a client component, goes, which takes a little JavaScript off every page.
13. **The menu's category and campus links become plain `Link`s.** `NavLink` would never mark a query link as current, and a plain link skips its `<Suspense>`.
14. **Sample states:** `l-026` (East London's Sharp calculator) is sold, and `l-016` (Pretoria's lash extensions) is paused. Neither is in the homepage's first ten Just listed.
15. **Extra photos** use two labelled placeholders, `/placeholders/photo/2.svg` and `3.svg`. `l-001` and `l-021` have three photos; `l-003` has two.
16. **The budget chips keep their `?max=` links.** `max` is an alias (spec 3.2), so the homepage doesn't change.
17. **Test fakes** live in `tests/helpers/fakes.ts` (`makeListing`, `makeBrowseQuery`), so tests don't each build a 19-field listing.
18. **A correction to the spec: browse works without the app's JavaScript, not with JavaScript switched off.** Browse's body reads the link and the campus cookie, so Cache Components streams it into the page, and a small inline React script puts it in place. With JavaScript switched off entirely, that script can't run and the skeleton stays. Everything else holds: links, the GET forms and `<details>` need no bundle, so browse works before the bundle arrives, or if it never does. The e2e test (Task 19) therefore blocks the app's bundle instead of switching JavaScript off. Task 22 corrects the spec (decision 5, sections 9 and 11) and decisions-log row 39. The homepage's campus-aware sections already behave this way.

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page. **Stop line:** 152,000 B.
- **Browse** adds no client code. Its first visit is the shell plus `SaveHeart` (the cards) and the route's own chunk.
- **The listing page** adds `ShareButton` and `lib/share.ts`, estimated at ~0.5 KB, on top of the shell, `SaveHeart` and `RecordRecentlyViewed`.
- **Recording.** Task 21 extends `tests/e2e/performance.spec.ts` to measure `/`, `/browse` and `/listings/l-001`, and records each `scriptBrotli` in its commit message. Task 16 measures the listing page early, with a throwaway script, because it's the task that first puts `ShareButton` on a page.
- **The stop rule.** If any page passes 152,000 B, stop after that task and report. Don't cut features to fit; that's Lama's decision.

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there.
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, and comments in plain English.
- **Server or client.** Server Components unless a file starts with `"use client"`. Plain `lib/` modules have no directive.
- **Next APIs.** Before using a Next API this plan names, read its page in `node_modules/next/dist/docs/` (AGENTS.md).
- **Breakpoints.**
  - `wide:` is tablet and up; `desk:` is desktop. Never use `md:`, `lg:` or `sm:`.
  - In CSS, write `@media (min-width: 48rem) and (min-height: 30rem)` and `@media (min-width: 64rem) and (min-height: 30rem)`.
- **Effects.** Never call `setState` directly in an effect body, and only touch `ref.current` in effects and handlers.
- **Headings.** One H1 per page. Sections are `<section aria-labelledby="…">` with one H2, visible or `sr-only`. Cards use H3.
- **Request-time parts.** A component that reads the viewer (`getViewerContext()`) or `searchParams` sits inside `<Suspense>`. Data loads use `.catch(() => null)` and show an error state on `null`. There's no `try`/`catch` round JSX: the React Compiler lint rejects it.
- **Async components in tests.** jsdom can't render an async component inside a tree. Render `await Thing(props)` directly, or stand the async part in with `vi.mock` when it sits inside a sync frame.
- **Accessible names.** Name computation trims each element's own text, so put spaces outside `sr-only` spans. Chromium adds spaces between flex children.
- **Contrast.**
  - Sky never carries text, icons or thin borders on white. Links on white are sky-dark; on panel, pale and sky they're navy.
  - Small text on the star texture is white.
- **Motion.** Animate only `transform`/`opacity`, including the CSS `translate`, `scale` and `rotate` properties. Hover effects only under `(hover: hover) and (pointer: fine)`.
- **Images.** Use `Photo` and always pass `sizes`. Decorative images get `alt=""`; content images take their alt from the data.
- **Tap targets.** At least 44 × 44px, with 8px between targets.
- **CSS placement.**
  - New CSS goes at the end of `app/globals.css`, inside `@layer components`, under a banner: `/* --- Browse: <name> (browse and listing plan, Task N, spec 4.x) --- */` or `/* --- Listing: <name> (…, spec 5.x) --- */`.
  - Never put `!important` on a transition or animation property: the motion off-switches rely on it.
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git status --short` on its own, and checks that only the listed files changed;
  2. runs `git add` with the listed files;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.
- **Looking at it.** Check visually on a production build (`pnpm build`, then `pnpm start --port 3201`) at 390 × 844 and 1280 × 800, using a throwaway Playwright script in your scratchpad. Stop the server afterwards.

## File map (end of this plan)

New files are marked **+**, changed **~**, moved **>**, removed **−**.

```
app/
  browse/page.tsx                       ~ the browse page (Task 12)
  listings/[id]/page.tsx                ~ the listing page (Tasks 3, 16)
  listings/[id]/opengraph-image.tsx     + the share card (Task 17)
  login/page.tsx                        ~ reads `next` (Task 18)
  categories/[slug]/page.tsx            − (Task 13)
  c/[campus]/page.tsx                   − (Task 13)
  globals.css                           ~ browse and listing banners (Tasks 9 to 16)
next.config.ts                          ~ redirects (Task 13)
components/
  browse/
    BrowseHeader.tsx  CategoryTabs.tsx                      + (Task 9)
    BrowseToolbar.tsx  FiltersPanel.tsx  SortMenu.tsx       + (Task 10)
    ActiveFilters.tsx  ResultsGrid.tsx  BrowseEmpty.tsx  BrowseError.tsx   + (Task 11)
    BrowseView.tsx  BrowseSkeleton.tsx                      + (Task 12)
  listing/
    Gallery.tsx  AvailabilityBanner.tsx  CollectBox.tsx  CampusNote.tsx   + (Task 14)
    ListingActions.tsx  ShareButton.tsx                     + (Task 15)
    SellerCard.tsx  ListingFacts.tsx  SafetyNote.tsx  MoreFrom.tsx  ListingView.tsx   + (Task 16)
  listings/ListingCard.tsx  Photo.tsx  SaveHeart.tsx        > from components/home (Task 8)
  home/SectionError.tsx                 ~ takes a path (Task 8)
  home/ShopByCategory.tsx               ~ tiles link to browse (Task 13)
  home/FreeAndSwaps.tsx  JustListed.tsx  … ~ import paths (Task 8)
  menu/MenuDrawer.tsx  search/SearchOverlay.tsx  footer/SiteFooter.tsx   ~ links (Task 13)
  footer/ShopYourCampusLink.tsx         − (Task 13)
lib/
  types.ts                              ~ (Tasks 1, 2, 3, 5)
  format.ts  time.ts                    ~ (Task 1)
  share.ts                              + (Task 15)
  next-path.ts                          + (Task 18)
  browse/search.ts                      + (Task 4)
  browse/query.ts                       + (Task 5)
  browse/href.ts  filters.ts  heading.ts   + (Task 6)
  browse/results.ts                     + (Task 7)
  data/index.ts                         ~ (Tasks 2, 3, 7)
data/fixtures/
  listings.ts  sellers.ts               ~ (Task 2)
  pickup-points.ts                      + (Task 2)
  free-swaps.ts                         − (Task 2)
  hero.ts                               ~ CTAs link to browse (Task 13)
scripts/make-placeholders.ts            ~ photos and new sellers (Task 2)
public/placeholders/                    + photo/2.svg, photo/3.svg and 19 seller pictures (Task 2)
tests/helpers/fakes.ts                  + (Tasks 2, 5)
tests/e2e/
  browse.spec.ts                        + (Task 19)
  listing.spec.ts                       + (Task 20)
  routes.spec.ts  shell.spec.ts         ~ (Tasks 12, 13)
  a11y.spec.ts                          ~ (Task 20)
  performance.spec.ts  cls.spec.ts      ~ every page (Task 21)
  screenshots.spec.ts                   ~ (Task 22)
docs/PROGRESS.md  docs/progress/browse-listing/  docs/reference/GO-LIVE.md   ~/+ (Task 22)
```

Each `*.test.ts(x)` sits next to the file it tests.

---

### Task 1: Price wording, condition labels and long dates

Spec 5.3 (price wording), 5.1 (facts, the listed date) and 5.8 (share text).

**Files:**
- Modify: `lib/types.ts` (four small types)
- Modify: `lib/format.ts`, `lib/format.test.ts`
- Modify: `lib/time.ts`, `lib/time.test.ts`

- [ ] **Step 1: Add the small types**

Add to `lib/types.ts`, after `export type TrustBadge = …`:

```ts
export type ListingKind = "item" | "service";

export type Condition = "new" | "like-new" | "good" | "fair";

/** How an item changes hands or a service happens (browse and listing spec 5.3). */
export type Handover = "pickup" | "on-campus" | "on-campus-or-online" | "online";

export type Availability = "available" | "paused" | "sold";
```

- [ ] **Step 2: Write the failing tests**

In `lib/format.test.ts`, change the import to:

```ts
import {
  badgeLabel,
  conditionLabel,
  eventDate,
  formatRand,
  joinWords,
  offersLabel,
  priceLabel,
  shareCardAlt,
  shortDescription,
} from "./format";
```

Replace the whole `describe("priceLabel", …)` block with:

```ts
describe("priceLabel", () => {
  it("shows the price, a 'From' price, Free, Swap, or a price with 'or swap' (spec 5.3)", () => {
    expect(priceLabel({ priceZar: 250, priceIsFrom: false, payMode: "cash" })).toBe("R250");
    expect(priceLabel({ priceZar: 400, priceIsFrom: true, payMode: "cash" })).toBe("From R400");
    expect(priceLabel({ priceZar: 0, priceIsFrom: false, payMode: "cash" })).toBe("Free");
    expect(priceLabel({ priceZar: null, priceIsFrom: false, payMode: "swap" })).toBe("Swap");
    expect(priceLabel({ priceZar: 450, priceIsFrom: false, payMode: "both" })).toBe("R450 or swap");
    expect(priceLabel({ priceZar: 400, priceIsFrom: true, payMode: "both" })).toBe("From R400 or swap");
    expect(priceLabel({ priceZar: 1200, priceIsFrom: false, payMode: "cash" })).toBe("R1,200");
  });
});

describe("conditionLabel", () => {
  it("names each condition", () => {
    expect(conditionLabel("new")).toBe("New");
    expect(conditionLabel("like-new")).toBe("Like new");
    expect(conditionLabel("good")).toBe("Good");
    expect(conditionLabel("fair")).toBe("Fair");
  });
});

describe("shortDescription", () => {
  it("keeps a short description whole, with its line breaks flattened", () => {
    expect(shortDescription("Works perfectly.\nComes with the cover.")).toBe("Works perfectly. Comes with the cover.");
  });

  it("cuts a long one at a word, within the limit, and ends it with an ellipsis", () => {
    const long = "word ".repeat(60).trim(); // 299 characters
    const short = shortDescription(long, 150);
    expect(short.length).toBeLessThanOrEqual(150);
    expect(short.endsWith("word…")).toBe(true);
  });
});

describe("shareCardAlt", () => {
  it("says what, how much and where (spec 5.8)", () => {
    expect(shareCardAlt("Casio fx-991ZA Plus calculator", "R250", "Midrand")).toBe(
      "Casio fx-991ZA Plus calculator, R250, at Midrand on Vossie",
    );
  });
});
```

In `lib/time.test.ts`, change the import to `import { longSastDate, sastDate, sastToday } from "./time";` and add at the end:

```ts
describe("longSastDate", () => {
  it("writes the date in South Africa in words (spec 5.1)", () => {
    expect(longSastDate("2026-10-12T07:40:00Z")).toBe("12 October 2026");
  });

  it("uses South African time, so 22:30 UTC is already the next day", () => {
    expect(longSastDate("2026-10-11T22:30:00Z")).toBe("12 October 2026");
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `pnpm test lib/format.test.ts lib/time.test.ts`
Expected: FAIL. `conditionLabel`, `shareCardAlt`, `shortDescription` and `longSastDate` aren't exported, and `priceLabel` gives "R0" and "R450".

- [ ] **Step 4: Write the code**

In `lib/format.ts`, change the type import to `import type { Condition, Listing, TrustBadge } from "./types";` and replace `priceLabel` with:

```ts
/** "R250", "From R400", "Free", "Swap" or "R450 or swap" (homepage spec 7.8; browse and listing spec 5.3). */
export function priceLabel(listing: Pick<Listing, "priceZar" | "priceIsFrom" | "payMode">): string {
  if (listing.priceZar === null || listing.payMode === "swap") return "Swap";
  if (listing.priceZar === 0) return "Free";
  const amount = formatRand(listing.priceZar);
  const price = listing.priceIsFrom ? `From ${amount}` : amount;
  return listing.payMode === "both" ? `${price} or swap` : price;
}

const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  "like-new": "Like new",
  good: "Good",
  fair: "Fair",
};

export function conditionLabel(condition: Condition): string {
  return CONDITION_LABELS[condition];
}

/** A description for link previews (spec 5.8): line breaks flattened, cut at a word to `max` characters. */
export function shortDescription(text: string, max = 150): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const words = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${words.replace(/[,.;:]$/, "")}…`;
}

/** The share card's alt text (spec 5.8). */
export function shareCardAlt(title: string, price: string, campusName: string): string {
  return `${title}, ${price}, at ${campusName} on Vossie`;
}
```

In `lib/time.ts`, add at the end:

```ts
// en-GB writes "12 October 2026": day, month in words, year.
const SAST_LONG = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Johannesburg",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * A stored UTC time as a date in South Africa, in words: "12 October 2026" (browse and listing spec 5.1). It reads
 * no clock (the time comes from the data), so it's safe while prerendering.
 */
export function longSastDate(iso: string): string {
  return SAST_LONG.format(new Date(iso));
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm test lib/format.test.ts lib/time.test.ts`
Expected: PASS.

Then run `pnpm test` and `pnpm typecheck`. Expected: everything passes. The homepage cards for the gaming headset and the rugby jersey now read "R450 or swap" and "R200 or swap"; no test checks those words.

- [ ] **Step 6: Hand over for commit**

Files: `lib/types.ts`, `lib/format.ts`, `lib/format.test.ts`, `lib/time.ts`, `lib/time.test.ts`.
Message: `feat: price wording for free and cash-or-swap listings, condition labels and long SAST dates`

---

### Task 2: One listing model, pickup points, sellers and sample listings

Spec 6.1 and 6.2; plan decisions 6, 7, 8, 14, 15 and 17.

**Files:**
- Modify: `lib/types.ts` (the listing gains its fields; `PickupPoint`; `ListingDetail`)
- Create: `data/fixtures/pickup-points.ts`
- Modify: `data/fixtures/sellers.ts` (19 more sellers)
- Rewrite: `data/fixtures/listings.ts`
- Remove: `data/fixtures/free-swaps.ts` (approved in "Before you start")
- Modify: `data/fixtures/fixtures.test.ts`
- Modify: `lib/data/index.ts` (`getJustListed`, `getFreeAndSwaps`, `getListing`, `getListingIds`), `lib/data/index.test.ts`
- Modify: `lib/data/placeholders.test.ts`, `scripts/make-placeholders.ts`
- Create: `tests/helpers/fakes.ts`
- Modify: `components/home/ListingCard.test.tsx`, `components/home/FreeAndSwaps.test.tsx`
- Generate: `public/placeholders/photo/2.svg`, `public/placeholders/photo/3.svg`, and 19 pictures in `public/placeholders/seller/`

- [ ] **Step 1: Extend the types**

In `lib/types.ts`, replace the `Listing` type with:

```ts
export type Listing = {
  id: string;
  title: string;
  /** Rand. 0 for a free item; null when the item is swap-only. */
  priceZar: number | null;
  /** True for prices shown as "From R400" (services). */
  priceIsFrom: boolean;
  payMode: PayMode;
  campusSlug: string;
  /** The cover photo. */
  image: ImageRef;
  badge: TrustBadge | null;
  /** ISO 8601 in UTC, e.g. "2026-10-12T07:40:00Z". */
  createdAt: string;
  kind: ListingKind;
  categorySlug: string;
  sellerSlug: string;
  /** Up to five more photos after the cover. */
  morePhotos: readonly ImageRef[];
  /** The seller's own words. Line breaks are kept on the page. */
  description: string;
  /** Null for services. */
  condition: Condition | null;
  handover: Handover;
  /** Set only when the handover is "pickup": one of the listing campus's pickup points. */
  pickupPointId: string | null;
  /** What the seller would swap for. Set only when the pay mode is "swap" or "both". */
  swapFor: string | null;
  availability: Availability;
};
```

Add after the `Seller` type:

```ts
/** An agreed place on campus where items change hands (browse and listing spec 6.1). */
export type PickupPoint = {
  id: string;
  campusSlug: string;
  name: string;
};

/** Everything the listing page needs, looked up once (spec 6.1). */
export type ListingDetail = {
  listing: Listing;
  seller: Seller;
  category: Category;
  campus: Campus;
  pickupPoint: PickupPoint | null;
};
```

Leave `FreeSwapItem` and `ListingSummary` as they are for now (Task 3 removes `ListingSummary`).

- [ ] **Step 2: Add the test fakes**

Create `tests/helpers/fakes.ts`:

```ts
import type { Listing } from "@/lib/types";

/** A listing for tests: an available R100 tech item at Midrand's library. Override what the test is about. */
export function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "l-test",
    title: "Test listing",
    priceZar: 100,
    priceIsFrom: false,
    payMode: "cash",
    campusSlug: "midrand",
    image: { src: "/placeholders/listing/tech.svg", alt: "Test listing" },
    badge: null,
    createdAt: "2026-10-10T10:00:00Z",
    kind: "item",
    categorySlug: "tech",
    sellerSlug: "tech-corner",
    morePhotos: [],
    description: "A test listing.",
    condition: "good",
    handover: "pickup",
    pickupPointId: "pp-midrand-library",
    swapFor: null,
    availability: "available",
    ...overrides,
  };
}
```

- [ ] **Step 3: Write the failing fixture tests**

Replace the contents of `data/fixtures/fixtures.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { campuses } from "./campuses";
import { categories } from "./categories";
import { collections } from "./collections";
import { heroSlides } from "./hero";
import { hubBanner, hubEvents } from "./hub";
import { listings } from "./listings";
import { pickupPoints } from "./pickup-points";
import { requests } from "./requests";
import { sellers } from "./sellers";

const campusSlugs = new Set(campuses.map((campus) => campus.slug));
const categorySlugs = new Set(categories.map((category) => category.slug));
const sellersBySlug = new Map(sellers.map((seller) => [seller.slug, seller]));
const pointsById = new Map(pickupPoints.map((point) => [point.id, point]));
const isUnique = (values: readonly string[]) => new Set(values).size === values.length;

describe("homepage fixtures (spec section 13)", () => {
  it("has three hero slides, each opening one of the categories", () => {
    expect(heroSlides.map((slide) => slide.word)).toEqual(["textbooks", "tech", "services"]);
    const categoryPaths = new Set(categories.map((category) => `/categories/${category.slug}`));
    for (const slide of heroSlides) expect(categoryPaths.has(slide.cta.href)).toBe(true);
  });

  it("has four collections with unique slugs", () => {
    expect(collections).toHaveLength(4);
    expect(isUnique(collections.map((collection) => collection.slug))).toBe(true);
  });

  it("lists items on every campus but Mbombela, so the empty state can be tested", () => {
    const withListings = new Set(listings.map((listing) => listing.campusSlug));
    expect(campuses.filter((campus) => !withListings.has(campus.slug)).map((campus) => campus.slug)).toEqual([
      "mbombela",
    ]);
  });

  it("has at least ten listings at Midrand, to fill the desktop grid", () => {
    expect(listings.filter((listing) => listing.campusSlug === "midrand").length).toBeGreaterThanOrEqual(10);
  });

  it("puts sellers and requests on known campuses", () => {
    for (const item of [...sellers, ...requests]) expect(campusSlugs.has(item.campusSlug)).toBe(true);
    expect(isUnique(sellers.map((seller) => seller.slug))).toBe(true);
  });

  it("dates Hub events as YYYY-MM-DD at a known campus or every campus", () => {
    for (const event of hubEvents) {
      expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.campusSlug === "all" || campusSlugs.has(event.campusSlug)).toBe(true);
    }
    expect(hubBanner.image.src).toMatch(/^\/placeholders\//);
  });
});

describe("listing fixtures (browse and listing spec 6.2)", () => {
  it("gives every listing a unique id, a known campus and category, and a real time", () => {
    expect(isUnique(listings.map((listing) => listing.id))).toBe(true);
    for (const listing of listings) {
      expect(campusSlugs.has(listing.campusSlug), listing.id).toBe(true);
      expect(categorySlugs.has(listing.categorySlug), listing.id).toBe(true);
      expect(Number.isNaN(Date.parse(listing.createdAt)), listing.id).toBe(false);
    }
  });

  it("gives every listing a seller on the listing's own campus", () => {
    for (const listing of listings) {
      expect(sellersBySlug.get(listing.sellerSlug)?.campusSlug, listing.id).toBe(listing.campusSlug);
    }
  });

  it("has no price exactly when a listing is swap-only, and swap terms exactly when it takes swaps", () => {
    for (const listing of listings) {
      expect(listing.priceZar === null, listing.id).toBe(listing.payMode === "swap");
      if (listing.priceZar !== null) expect(listing.priceZar, listing.id).toBeGreaterThanOrEqual(0);
      expect(listing.swapFor !== null, listing.id).toBe(listing.payMode !== "cash");
    }
  });

  it("names a pickup point on the listing's own campus exactly when the handover is a pickup", () => {
    for (const listing of listings) {
      expect(listing.pickupPointId !== null, listing.id).toBe(listing.handover === "pickup");
      if (listing.pickupPointId) {
        expect(pointsById.get(listing.pickupPointId)?.campusSlug, listing.id).toBe(listing.campusSlug);
      }
    }
  });

  it("gives items a condition and services none, and hands over online at Eduvos Online", () => {
    for (const listing of listings) {
      expect(listing.condition === null, listing.id).toBe(listing.kind === "service");
      if (listing.campusSlug === "online") expect(listing.handover, listing.id).toBe("online");
    }
  });

  it("has at most five more photos per listing", () => {
    for (const listing of listings) expect(listing.morePhotos.length, listing.id).toBeLessThanOrEqual(5);
  });

  it("has paused, sold, free and swap-only listings, to test those states", () => {
    expect(listings.some((listing) => listing.availability === "paused")).toBe(true);
    expect(listings.some((listing) => listing.availability === "sold")).toBe(true);
    expect(listings.some((listing) => listing.priceZar === 0)).toBe(true);
    expect(listings.some((listing) => listing.payMode === "swap")).toBe(true);
  });

  it("has pickup points with unique ids on the physical campuses only", () => {
    expect(isUnique(pickupPoints.map((point) => point.id))).toBe(true);
    expect(new Set(pickupPoints.map((point) => point.campusSlug))).toEqual(
      new Set(campuses.filter((campus) => campus.slug !== "online").map((campus) => campus.slug)),
    );
  });
});
```

Run: `pnpm test data/fixtures/fixtures.test.ts`
Expected: FAIL. `./pickup-points` doesn't exist.

- [ ] **Step 4: Add the pickup points**

Create `data/fixtures/pickup-points.ts`:

```ts
import type { PickupPoint } from "@/lib/types";
import { campuses } from "./campuses";

// Generic sample spots on every physical campus. The real ones come from each campus before launch
// (docs/reference/GO-LIVE.md). Eduvos Online has none: everything there happens online.
export const pickupPoints: readonly PickupPoint[] = campuses
  .filter((campus) => campus.slug !== "online")
  .flatMap((campus) => [
    { id: `pp-${campus.slug}-library`, campusSlug: campus.slug, name: "Library entrance" },
    { id: `pp-${campus.slug}-reception`, campusSlug: campus.slug, name: "Main reception" },
  ]);
```

- [ ] **Step 5: Add the sellers**

In `data/fixtures/sellers.ts`, add these lines at the end of the `sellers` array, after `res-kitchen`:

```ts
  // Every listing's seller is on the listing's campus (browse and listing spec 6.2). These sellers aren't verified,
  // so the Featured today draw doesn't change.
  seller("tech-corner", "Tech corner", "Calculators, headsets and chargers, tested before you buy.", "Tech", "midrand", false),
  seller("book-swap", "Book swap", "Last year's textbooks and notes at half the price.", "Textbooks & notes", "midrand", false),
  seller("res-deals", "Res deals", "Fridges, lamps and curtains from students moving out.", "Res & living", "midrand", false),
  seller("closet-clear-out", "Closet clear-out", "Good clothes that need a new home.", "Fashion & thrift", "midrand", false),
  seller("ticket-desk", "Ticket desk", "Spare tickets for events around campus.", "Tickets & events", "midrand", false),
  seller("res-essentials", "Res essentials", "Kettles, lamps and the bits every res room needs.", "Res & living", "pretoria", false),
  seller("lash-lounge", "Lash lounge", "Classic and volume lashes by appointment.", "Hair & beauty", "pretoria", false),
  seller("stationery-stop", "Stationery stop", "Paper, pens and highlighters in bundles.", "Stationery", "pretoria", false),
  seller("bookshelf", "Bookshelf", "Textbooks from finished modules.", "Textbooks & notes", "bedfordview", false),
  seller("moving-out-sale", "Moving-out sale", "Everything from a res room, priced to go.", "Res & living", "bedfordview", false),
  seller("kitchen-kit", "Kitchen kit", "Ovens, kettles and pots for cooking in res.", "Res & living", "bloemfontein", false),
  seller("weekend-market", "Weekend market", "Bikes, cameras and things worth a second life.", "Res & living", "cape-town-mowbray", false),
  seller("accounting-tutor", "Accounting tutor", "Accounting 2 and 3, explained until it clicks.", "Tutoring", "durban-umhlanga", false),
  seller("study-desk", "Study desk", "Calculators and stationery for exam season.", "Stationery", "east-london", false),
  seller("room-refresh", "Room refresh", "Curtains, rugs and cushions for a brighter res room.", "Res & living", "nelson-mandela-bay", false),
  seller("sports-kit", "Sports kit", "Jerseys and gym gear, washed and ready.", "Fashion & thrift", "potchefstroom", false),
  seller("drawing-office", "Drawing office", "Drawing sets and scales for engineering students.", "Stationery", "vanderbijlpark", false),
  seller("cv-clinic", "CV clinic", "CVs and LinkedIn profiles that get replies.", "Services", "online", false),
  seller("logo-lab", "Logo lab", "Logos for student brands, paid for or swapped.", "Services", "online", false),
```

The repo has no formatter, so keep these lines as they are.

- [ ] **Step 6: Rewrite the listings**

Replace the contents of `data/fixtures/listings.ts` with:

```ts
import type {
  Availability,
  Condition,
  Handover,
  ImageRef,
  Listing,
  ListingKind,
  PayMode,
  TrustBadge,
} from "@/lib/types";

type Options = {
  /** Services priced "From R400". */
  from?: boolean;
  payMode?: PayMode;
  kind?: ListingKind;
  /** Items only. Services never have one. */
  condition?: Condition;
  handover?: Handover;
  /** Which of the campus's two pickup points, when the handover is "pickup". */
  pickup?: "library" | "reception";
  swapFor?: string;
  morePhotos?: readonly ImageRef[];
  availability?: Availability;
};

/** A labelled placeholder for the second or third photo (plan decision 15). */
const photo = (n: 2 | 3, alt: string): ImageRef => ({ src: `/placeholders/photo/${n}.svg`, alt });

const listing = (
  id: string,
  title: string,
  priceZar: number | null,
  campusSlug: string,
  categorySlug: string,
  sellerSlug: string,
  badge: TrustBadge | null,
  createdAt: string,
  description: string,
  {
    from = false,
    payMode = priceZar === null ? "swap" : "cash",
    kind = "item",
    condition = "good",
    handover = kind === "service" ? "on-campus-or-online" : "pickup",
    pickup = "library",
    swapFor,
    morePhotos = [],
    availability = "available",
  }: Options = {},
): Listing => ({
  id,
  title,
  priceZar,
  priceIsFrom: from,
  payMode,
  campusSlug,
  // Sellers will upload their own photos; until then each listing shows its category's placeholder.
  image: { src: `/placeholders/listing/${categorySlug}.svg`, alt: title },
  badge,
  createdAt,
  kind,
  categorySlug,
  sellerSlug,
  morePhotos,
  description,
  condition: kind === "service" ? null : condition,
  handover,
  pickupPointId: handover === "pickup" ? `pp-${campusSlug}-${pickup}` : null,
  swapFor: swapFor ?? null,
  availability,
});

const service = { kind: "service" } as const;

// Newest first. Every campus has listings except Mbombela, so its empty state can be tested. l-016 is paused and
// l-026 is sold (plan decision 14). Free items are R0; swap-only items have no price.
export const listings: readonly Listing[] = [
  listing(
    "l-001", "Casio fx-991ZA Plus calculator", 250, "midrand", "tech", "tech-corner", "responsive", "2026-10-12T07:40:00Z",
    "Approved for Eduvos maths and stats exams. Works perfectly, with a new battery fitted in September.\nComes with the slide-on cover.",
    {
      condition: "like-new",
      morePhotos: [photo(2, "The back of the calculator, with the battery cover"), photo(3, "The slide-on cover")],
    },
  ),
  listing(
    "l-018", "HP laptop charger, 65W", 220, "bedfordview", "tech", "phone-fix", "responsive", "2026-10-12T07:05:00Z",
    "Original HP 65W charger with the round pin. Tested and working.",
    { condition: "like-new" },
  ),
  listing(
    "l-002", "Intro to Financial Accounting, 4th edition", 300, "midrand", "textbooks-notes", "book-swap", "new-seller",
    "2026-10-12T06:55:00Z",
    "The prescribed book for Accounting 1. A few highlighted pages, none torn.",
  ),
  listing(
    "l-013", "Python tutoring for beginners, one hour", 150, "pretoria", "tutoring", "code-coach", "trusted",
    "2026-10-12T06:30:00Z",
    "Loops, functions and your first project, at your pace. Bring your laptop, or we meet over video.",
    service,
  ),
  listing(
    "l-024", "Bunny chow lunch special", 75, "durban-umhlanga", "food", "res-kitchen", "trusted", "2026-10-12T06:20:00Z",
    "A quarter mutton bunny with a side salad. Order by 10am and collect at lunch.",
    { condition: "new" },
  ),
  listing(
    "l-003", "Bar fridge, 90 litres", 1200, "midrand", "res-living", "res-deals", "trusted", "2026-10-12T06:10:00Z",
    "Moving out of res, so the fridge has to go. Quiet, cold and clean, with a small freezer box.\nBring a friend to help carry it.",
    { pickup: "reception", morePhotos: [photo(2, "Inside the fridge, with the freezer box")] },
  ),
  listing(
    "l-021", "Bicycle, 21 gears", 1500, "cape-town-mowbray", "res-living", "weekend-market", null, "2026-10-12T05:30:00Z",
    "A mountain bike with 21 gears, serviced last month. The lock is included.",
    {
      pickup: "reception",
      morePhotos: [photo(2, "The gears and the back wheel"), photo(3, "The lock that comes with it")],
    },
  ),
  listing(
    "l-030", "CV and LinkedIn makeover", 200, "online", "services", "cv-clinic", "trusted", "2026-10-12T04:15:00Z",
    "I rewrite your CV and LinkedIn profile for the jobs you want, in three working days.",
    { ...service, handover: "online", from: true },
  ),
  listing(
    "l-004", "Box braids, shoulder length", 400, "midrand", "hair-beauty", "hair-studio", "trusted", "2026-10-11T18:20:00Z",
    "Shoulder-length box braids, about five hours. The price includes the hair.\nBook a weekday afternoon or a Saturday morning.",
    { ...service, handover: "on-campus", from: true },
  ),
  listing(
    "l-031", "Spreadsheet tutoring over video", 130, "online", "tutoring", "study-notes", "responsive",
    "2026-10-11T17:10:00Z",
    "Excel and Google Sheets, from formulas to pivot tables, over video.",
    { ...service, handover: "online" },
  ),
  listing(
    "l-014", "Electric kettle, 1.7 litres", 200, "pretoria", "res-living", "res-essentials", "responsive",
    "2026-10-11T16:45:00Z",
    "A stainless steel kettle that boils fast. The auto switch-off works, and it's been descaled.",
  ),
  listing(
    "l-005", "Statistics 1 exam prep, one hour", 120, "midrand", "tutoring", "maths-tutor", "responsive",
    "2026-10-11T16:05:00Z",
    "One-on-one help with past papers, hypothesis tests and probability, in the library or over video.",
    service,
  ),
  listing(
    "l-023", "Gel nails, full set", 250, "cape-town-tyger-valley", "hair-beauty", "nail-bar", "responsive",
    "2026-10-11T14:35:00Z",
    "A full gel set in the colour of your choice, about an hour and a half.",
    { ...service, handover: "on-campus", from: true },
  ),
  listing(
    "l-006", "Desk lamp with a USB port", 180, "midrand", "res-living", "res-deals", null, "2026-10-11T12:30:00Z",
    "A warm LED desk lamp with a USB port to charge your phone. It bends any way you need.",
    { condition: "like-new" },
  ),
  listing(
    "l-015", "Thrifted puffer jacket", 280, "pretoria", "fashion-thrift", "thrift-rack", "new-seller",
    "2026-10-11T11:30:00Z",
    "A black puffer jacket, size L, washed and ready for winter.",
  ),
  listing(
    "l-027", "Res curtains, two panels", 120, "nelson-mandela-bay", "res-living", "room-refresh", "new-seller",
    "2026-10-11T10:40:00Z",
    "Two blackout curtain panels that fit a standard res window.",
  ),
  listing(
    "l-007", "Gaming headset, barely used", 450, "midrand", "tech", "tech-corner", "responsive", "2026-10-11T09:15:00Z",
    "An over-ear headset with a detachable mic. Used for one semester; the ear pads are like new.",
    { payMode: "both", condition: "like-new", swapFor: "a mechanical keyboard or a Bluetooth speaker" },
  ),
  listing(
    "l-020", "Mini oven for res", 650, "bloemfontein", "res-living", "kitchen-kit", "trusted", "2026-10-11T08:30:00Z",
    "A 25-litre oven with a grill, just right for res. The tray and rack are included.",
  ),
  listing(
    "l-008", "Business Management 1 summary notes", 90, "midrand", "textbooks-notes", "book-swap", "trusted",
    "2026-10-10T19:40:00Z",
    "Typed summaries of every chapter, printed and bound. They got me 78% in the exam.",
  ),
  listing(
    "l-022", "Film camera, working", 900, "cape-town-mowbray", "tech", "weekend-market", "new-seller",
    "2026-10-10T16:20:00Z",
    "A 35mm film camera with a 50mm lens, tested with a roll last month.",
  ),
  listing(
    "l-009", "Cupcake box, a dozen", 150, "midrand", "food", "home-bakery", "trusted", "2026-10-10T14:00:00Z",
    "Twelve vanilla or chocolate cupcakes, baked the morning you collect. Order a day ahead.",
    { condition: "new" },
  ),
  listing(
    "l-016", "Lash extensions, classic set", 300, "pretoria", "hair-beauty", "lash-lounge", "trusted",
    "2026-10-10T13:15:00Z",
    "A classic set that lasts three to four weeks. It takes about two hours.",
    { ...service, handover: "on-campus", from: true, availability: "paused" },
  ),
  listing(
    "l-019", "Economics 1 textbook", 320, "bedfordview", "textbooks-notes", "bookshelf", "trusted",
    "2026-10-10T12:10:00Z",
    "The current edition, with a few pencil notes in the margins.",
  ),
  listing(
    "l-029", "Engineering drawing set", 350, "vanderbijlpark", "stationery", "drawing-office", "trusted",
    "2026-10-10T11:05:00Z",
    "A full drawing set with compasses, scales and set squares in a hard case.",
    { condition: "like-new" },
  ),
  listing(
    "l-010", "Denim jacket, size M", null, "midrand", "fashion-thrift", "closet-clear-out", "new-seller",
    "2026-10-10T10:25:00Z",
    "A classic blue denim jacket, size M, worn a handful of times.",
    { swapFor: "a hoodie, or sneakers in size 7" },
  ),
  listing(
    "l-026", "Sharp scientific calculator", 180, "east-london", "tech", "study-desk", null, "2026-10-10T07:55:00Z",
    "A Sharp scientific calculator in good working order.",
    { availability: "sold" },
  ),
  listing(
    "l-025", "Accounting 2 tutor, two hours", 240, "durban-umhlanga", "tutoring", "accounting-tutor", "trusted",
    "2026-10-09T17:00:00Z",
    "Two hours on consolidations, cash flows or whatever is giving you trouble.",
    service,
  ),
  listing(
    "l-011", "Logo design for your hustle", 350, "midrand", "services", "design-studio", "responsive",
    "2026-10-09T15:10:00Z",
    "A logo and colour set for your small business, with two rounds of changes. Files ready for print and Instagram.",
    { ...service, from: true },
  ),
  listing(
    "l-028", "Rugby jersey, size L", 200, "potchefstroom", "fashion-thrift", "sports-kit", "responsive",
    "2026-10-09T13:20:00Z",
    "A replica home jersey, size L, washed and ironed.",
    { payMode: "both", swapFor: "a cricket shirt or gym gear" },
  ),
  listing(
    "l-017", "Graph paper and highlighter bundle", 60, "pretoria", "stationery", "stationery-stop", null,
    "2026-10-09T09:40:00Z",
    "Two pads of graph paper and six highlighters, all unopened.",
    { condition: "new" },
  ),
  listing(
    "l-012", "Matric dance tickets, a pair", 600, "midrand", "tickets-events", "ticket-desk", null, "2026-10-09T08:00:00Z",
    "Two tickets to a matric dance in Midrand on 31 October. The names on the booking can be changed.",
    { condition: "new" },
  ),

  // Giveaways and swap-only items, once a separate list (the "fs-" ids are kept, so old links still work). They're
  // dated before every other listing, so Just listed doesn't change (plan decision 7).
  listing(
    "fs-001", "Business Management 1 notes", 0, "midrand", "textbooks-notes", "book-swap", null, "2026-10-08T18:00:00Z",
    "Handwritten notes for every chapter. Free to a first-year who needs them.",
    { condition: "fair" },
  ),
  listing(
    "fs-002", "Desk lamp, swap for a kettle", null, "pretoria", "res-living", "res-essentials", null,
    "2026-10-08T16:00:00Z",
    "A working desk lamp. I'd rather swap it for a kettle than sell it.",
    { swapFor: "a kettle" },
  ),
  listing(
    "fs-003", "Res curtains, two panels", 0, "midrand", "res-living", "res-deals", null, "2026-10-08T14:00:00Z",
    "Two curtain panels that fit a res window. Free if you collect this week.",
  ),
  listing(
    "fs-004", "Logo design for a photo shoot", null, "online", "services", "logo-lab", null, "2026-10-08T12:00:00Z",
    "I'll design your logo if you'll take photos for my brand.",
    { ...service, handover: "online", swapFor: "a photo shoot for my brand" },
  ),
  listing(
    "fs-005", "Hangers, bag of 20", 0, "bedfordview", "res-living", "moving-out-sale", null, "2026-10-08T10:00:00Z",
    "Twenty plastic hangers, free to whoever collects first.",
  ),
  listing(
    "fs-006", "Calculator for a textbook", null, "cape-town-mowbray", "tech", "weekend-market", null,
    "2026-10-08T08:00:00Z",
    "A scientific calculator I no longer need. I'm swapping it for a first-year textbook.",
    { swapFor: "an Accounting 1 textbook" },
  ),
  listing(
    "fs-007", "Highlighters, half used", 0, "east-london", "stationery", "study-desk", null, "2026-10-08T06:00:00Z",
    "A pack of highlighters, about half used. Free to a good home.",
    { condition: "fair" },
  ),
];
```

Check the old file is what you expect, then remove it: run `ls data/fixtures/free-swaps.ts`, then `rm data/fixtures/free-swaps.ts` (approved in "Before you start").

Run: `pnpm test data/fixtures/fixtures.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the failing data tests**

In `lib/data/index.test.ts`, add two tests inside `describe("homepage data", …)`, after the Just listed test:

```ts
  it("keeps paused and sold listings out of Just listed", async () => {
    const pretoria = (await getJustListed({ campus: "pretoria", limit: 10 })).map((listing) => listing.id);
    expect(pretoria).not.toContain("l-016");
    expect(pretoria).toContain("fs-002");
    const everywhere = (await getJustListed({ campus: "all", limit: 100 })).map((listing) => listing.id);
    expect(everywhere).not.toContain("l-026");
    expect(everywhere).toHaveLength(36);
  });

  it("picks the free and swap-only listings for Free & swaps, newest first (plan decision 6)", async () => {
    const items = await getFreeAndSwaps({ campus: "all", limit: 10 });
    expect(items.map((item) => item.id)).toEqual([
      "l-010",
      "fs-001",
      "fs-002",
      "fs-003",
      "fs-004",
      "fs-005",
      "fs-006",
      "fs-007",
    ]);
    expect(items[0]).toMatchObject({ kind: "swap", title: "Denim jacket, size M", campusSlug: "midrand" });
    expect(items[1]).toMatchObject({ kind: "free", title: "Business Management 1 notes" });
  });
```

In `components/home/FreeAndSwaps.test.tsx`, replace the body of the first test (from `const cards = …` to the end of that test) with:

```ts
    const cards = within(screen.getByRole("region", { name: "Free and swap items" })).getAllByRole("article");
    expect(cards).toHaveLength(8);
    // The denim jacket is swap-only, so it's here too, and it's Midrand's newest (plan decision 6).
    expect(within(cards[0]).getByText("Swap")).toBeInTheDocument();
    expect(within(cards[0]).getByRole("link", { name: "Denim jacket, size M" })).toHaveAttribute("href", "/listings/l-010");
    expect(within(cards[1]).getByText("Free")).toBeInTheDocument();
    expect(within(cards[1]).getByRole("link", { name: "Business Management 1 notes" })).toHaveAttribute(
      "href",
      "/listings/fs-001",
    );
    expect(within(cards[1]).getByText("Midrand")).toBeInTheDocument();
    expect(screen.getAllByText("Swap")).toHaveLength(4);
```

In `components/home/ListingCard.test.tsx`, replace the `braids` object and the `Listing` type import with:

```ts
import { makeListing } from "@/tests/helpers/fakes";

const braids = makeListing({
  id: "l-004",
  title: "Box braids, shoulder length",
  priceZar: 400,
  priceIsFrom: true,
  image: { src: "/placeholders/listing/hair-beauty.svg", alt: "Box braids, shoulder length" },
  badge: "trusted",
  kind: "service",
  categorySlug: "hair-beauty",
  sellerSlug: "hair-studio",
  condition: null,
  handover: "on-campus",
  pickupPointId: null,
});
```

`@/tests/helpers/fakes` resolves through the `@/*` path in `tsconfig.json`, which Vitest reads (`tsconfigPaths`).

Run: `pnpm test lib/data/index.test.ts components/home/FreeAndSwaps.test.tsx components/home/ListingCard.test.tsx`
Expected: FAIL. `lib/data/index.ts` still imports `free-swaps`, which no longer exists.

- [ ] **Step 8: Update the data functions**

In `lib/data/index.ts`:

1. Remove `import { freeSwapItems } from "@/data/fixtures/free-swaps";`.
2. After the `campusFirst` function, add:

```ts
/** Listings people can buy or book. Paused and sold listings never appear in lists (spec 5.5). */
function available(items: readonly Listing[]): Listing[] {
  return items.filter((listing) => listing.availability === "available");
}

/** Newest first: ISO times in UTC sort as text. */
function newestFirst(a: Pick<Listing, "createdAt">, b: Pick<Listing, "createdAt">): number {
  return b.createdAt.localeCompare(a.createdAt);
}
```

3. Replace the body of `getJustListed` with:

```ts
  "use cache";
  return available(listings)
    .filter((listing) => campus === ALL_CAMPUSES || listing.campusSlug === campus)
    .sort(newestFirst)
    .slice(0, limit);
```

4. Replace `getFreeAndSwaps` with:

```ts
/** Free & swaps (spec 7.12): the free and swap-only listings, the visitor's campus first. */
export async function getFreeAndSwaps({ campus, limit }: CampusQuery): Promise<readonly FreeSwapItem[]> {
  "use cache";
  const items = available(listings)
    .filter((listing) => listing.priceZar === 0 || listing.payMode === "swap")
    .sort(newestFirst)
    .map(
      (listing): FreeSwapItem => ({
        id: listing.id,
        kind: listing.priceZar === 0 ? "free" : "swap",
        title: listing.title,
        campusSlug: listing.campusSlug,
        image: listing.image,
      }),
    );
  return campusFirst(items, campus, limit);
}
```

5. Replace `getListing` and `getListingIds` with:

```ts
/** A listing page's summary. Task 3 replaces this with getListingDetail. */
export async function getListing(id: string): Promise<ListingSummary | null> {
  "use cache";
  const found = listings.find((listing) => listing.id === id);
  return found ? { id: found.id, title: found.title, campusSlug: found.campusSlug, image: found.image } : null;
}

export async function getListingIds(): Promise<readonly string[]> {
  "use cache";
  return listings.map((listing) => listing.id);
}
```

Run: `pnpm test lib/data/index.test.ts components/home/FreeAndSwaps.test.tsx components/home/ListingCard.test.tsx`
Expected: PASS.

- [ ] **Step 9: Placeholder art for the new photos and sellers**

In `scripts/make-placeholders.ts`:

1. Remove `import { freeSwapItems } from "../data/fixtures/free-swaps.ts";` and the line `for (const item of freeSwapItems) add(item.image.src, item.title);`.
2. Add `photo: [800, 800],` to `SIZES` (the gallery's square, like the cards).
3. Change `LABELLED` to `new Set(["hero", "campus", "collection", "seller", "photo"])`, and add above it: `// The gallery's extra photos are labelled "Photo 2" and "Photo 3", so the gallery can be checked by eye.`
4. After the listings loop, add:

```ts
for (const listing of listings) {
  for (const extra of listing.morePhotos) add(extra.src, `Photo ${extra.src.split("/").pop()?.replace(".svg", "")}`);
}
```

In `lib/data/placeholders.test.ts`, add `import { listings } from "@/data/fixtures/listings";` and, inside `sources`, after the `getFreeAndSwaps` line:

```ts
      ...listings.flatMap((listing) => listing.morePhotos.map((extra) => extra.src)),
```

Run: `pnpm test lib/data/placeholders.test.ts`
Expected: FAIL, listing `/placeholders/photo/2.svg`, `/placeholders/photo/3.svg` and the 19 new sellers' pictures as missing.

Run: `node scripts/make-placeholders.ts`
Expected: "Wrote N placeholders under public/placeholders." It rewrites the existing files byte for byte, so `git status --short public/placeholders` shows only new files: `photo/2.svg`, `photo/3.svg` and 19 under `seller/`.

Run: `pnpm test lib/data/placeholders.test.ts`
Expected: PASS.

- [ ] **Step 10: Run everything**

Run: `pnpm test`, then `pnpm typecheck`, then `pnpm lint`.
Expected: all pass. If a homepage test fails on Pretoria's Just listed (it now shows the desk lamp swap and not the paused lash listing), that's plan decision 7: update its expectation and say so in your report.

- [ ] **Step 11: Hand over for commit**

Files: `lib/types.ts`, `data/fixtures/pickup-points.ts`, `data/fixtures/sellers.ts`, `data/fixtures/listings.ts`, `data/fixtures/free-swaps.ts` (removed), `data/fixtures/fixtures.test.ts`, `lib/data/index.ts`, `lib/data/index.test.ts`, `lib/data/placeholders.test.ts`, `scripts/make-placeholders.ts`, `tests/helpers/fakes.ts`, `components/home/ListingCard.test.tsx`, `components/home/FreeAndSwaps.test.tsx`, `public/placeholders/photo/`, the 19 new files in `public/placeholders/seller/`.
Message: `feat: one listing model with descriptions, pickup points, conditions and availability; free and swap items become listings`

---

### Task 3: Listing details and "more from"

Spec 6.1 and 6.3.

**Files:**
- Modify: `lib/types.ts` (remove `ListingSummary`; add `MoreFrom`)
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`
- Modify: `app/listings/[id]/page.tsx`

- [ ] **Step 1: Write the failing tests**

In `lib/data/index.test.ts`:

1. In the import list, replace `getListing,` with `getListingDetail,`, and add `getMoreFrom,` and `getPickupPoints,` (keep the list alphabetical).
2. Inside `describe("homepage data", …)`, replace the test `it("finds listing pages for listings and free and swap items", …)` with:

```ts
  it("finds listing pages for every listing, including paused and sold ones", async () => {
    expect((await getListingDetail("fs-002"))?.listing.title).toBe("Desk lamp, swap for a kettle");
    expect((await getListingDetail("l-026"))?.listing.availability).toBe("sold");
    expect(await getListingDetail("nope")).toBeNull();
    const ids = await getListingIds();
    expect(ids).toHaveLength(38);
    expect(ids).toContain("l-001");
    expect(ids).toContain("fs-001");
  });
```

3. Add this block at the end of the file:

```ts
describe("listing page data (browse and listing spec 6.3)", () => {
  it("looks a listing up with its seller, category, campus and pickup point", async () => {
    const detail = await getListingDetail("l-001");
    expect(detail?.listing.title).toBe("Casio fx-991ZA Plus calculator");
    expect(detail?.seller.name).toBe("Tech corner");
    expect(detail?.category.name).toBe("Tech");
    expect(detail?.campus.name).toBe("Midrand");
    expect(detail?.pickupPoint).toEqual({ id: "pp-midrand-library", campusSlug: "midrand", name: "Library entrance" });
    expect((await getListingDetail("l-013"))?.pickupPoint).toBeNull();
  });

  it("has two pickup points on each physical campus", async () => {
    expect(await getPickupPoints()).toHaveLength(24);
  });

  it("offers more from the seller first", async () => {
    const calculator = (await getListingDetail("l-001"))!.listing;
    const more = await getMoreFrom(calculator, 4);
    expect(more.from).toBe("seller");
    expect(more.items.map((listing) => listing.id)).toEqual(["l-007"]);
  });

  it("falls back to the same category, the listing's campus first, leaving out paused and sold ones", async () => {
    const braids = (await getListingDetail("l-004"))!.listing;
    const forBraids = await getMoreFrom(braids, 4);
    expect(forBraids.from).toBe("category");
    // The paused lash listing (l-016) is left out.
    expect(forBraids.items.map((listing) => listing.id)).toEqual(["l-023"]);

    const python = (await getListingDetail("l-013"))!.listing;
    expect((await getMoreFrom(python, 4)).items.map((listing) => listing.id)).toEqual(["l-031", "l-005", "l-025"]);
  });
});
```

Run: `pnpm test lib/data/index.test.ts`
Expected: FAIL. `getListingDetail`, `getMoreFrom` and `getPickupPoints` don't exist.

- [ ] **Step 2: Update the types**

In `lib/types.ts`, remove the `ListingSummary` type and its comment, and add at the end:

```ts
/** A listing page's "More from" row (spec 5.7): the seller's other listings, or the same category's. */
export type MoreFrom = {
  from: "seller" | "category";
  items: readonly Listing[];
};
```

- [ ] **Step 3: Write the data functions**

In `lib/data/index.ts`:

1. Add `import { pickupPoints } from "@/data/fixtures/pickup-points";` with the other fixture imports.
2. In the type import, remove `ListingSummary` and add `ListingDetail`, `MoreFrom` and `PickupPoint`.
3. Replace `getListing` with:

```ts
/** Everything a listing page needs (spec 6.3), for any listing, paused and sold ones included. */
export async function getListingDetail(id: string): Promise<ListingDetail | null> {
  "use cache";
  const listing = listings.find((item) => item.id === id);
  if (!listing) return null;
  const seller = sellers.find((item) => item.slug === listing.sellerSlug);
  const category = categories.find((item) => item.slug === listing.categorySlug);
  const campus = campuses.find((item) => item.slug === listing.campusSlug);
  if (!seller || !category || !campus) return null;
  const pickupPoint = pickupPoints.find((point) => point.id === listing.pickupPointId) ?? null;
  return { listing, seller, category, campus, pickupPoint };
}

/**
 * A listing page's "More from" row (spec 5.7): up to `limit` of the seller's other available listings, newest first.
 * When the seller has none, the same category's: those at the listing's campus first, then the rest.
 */
export async function getMoreFrom(
  listing: Pick<Listing, "id" | "sellerSlug" | "categorySlug" | "campusSlug">,
  limit: number,
): Promise<MoreFrom> {
  "use cache";
  const others = available(listings)
    .filter((item) => item.id !== listing.id)
    .sort(newestFirst);
  const fromSeller = others.filter((item) => item.sellerSlug === listing.sellerSlug);
  if (fromSeller.length > 0) return { from: "seller", items: fromSeller.slice(0, limit) };
  const sameCategory = others.filter((item) => item.categorySlug === listing.categorySlug);
  const ownCampus = sameCategory.filter((item) => item.campusSlug === listing.campusSlug);
  const elsewhere = sameCategory.filter((item) => item.campusSlug !== listing.campusSlug);
  return { from: "category", items: [...ownCampus, ...elsewhere].slice(0, limit) };
}

export async function getPickupPoints(): Promise<readonly PickupPoint[]> {
  "use cache";
  return pickupPoints;
}
```

Callers pass a whole listing to `getMoreFrom`. That's fine: it's a plain object, so the cache can key on it.

- [ ] **Step 4: Keep the listing placeholder building**

Replace `app/listings/[id]/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { RecordRecentlyViewed } from "@/components/listings/RecordRecentlyViewed";
import { getListingDetail, getListingIds } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getListingDetail(id);
  return { title: detail ? detail.listing.title : "Page not found" };
}

export async function generateStaticParams() {
  return (await getListingIds()).map((id) => ({ id }));
}

export default function ListingPage({ params }: PageProps<"/listings/[id]">) {
  return (
    // Known listings are prerendered, so this fallback only shows for an unknown id, until the 404 takes over.
    <Suspense fallback={null}>
      <ListingDetails params={params} />
    </Suspense>
  );
}

async function ListingDetails({ params }: Pick<PageProps<"/listings/[id]">, "params">) {
  const { id } = await params;
  const detail = await getListingDetail(id);
  if (!detail) notFound();
  const { listing, campus } = detail;
  return (
    <>
      <RecordRecentlyViewed item={{ id: listing.id, title: listing.title, image: listing.image }} />
      <ComingSoon title={listing.title}>
        Listed at {campus.name}. The full listing page arrives later in this build.
      </ComingSoon>
    </>
  );
}
```

Task 16 replaces the `ComingSoon` with the real page.

- [ ] **Step 5: Run the tests**

Run: `pnpm test lib/data/index.test.ts`, then `pnpm test`, `pnpm typecheck` and `pnpm lint`.
Expected: all pass. `grep -rn "ListingSummary\|getListing(" app components lib` finds nothing.

- [ ] **Step 6: Hand over for commit**

Files: `lib/types.ts`, `lib/data/index.ts`, `lib/data/index.test.ts`, `app/listings/[id]/page.tsx`.
Message: `feat: listing details with seller, category, campus and pickup point, and the "more from" row`

---

### Task 4: Search words and matching

Spec 4.8.

**Files:**
- Create: `lib/browse/search.ts`, `lib/browse/search.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/browse/search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchScore, queryWords, searchWords, withinOneEdit, wordMatches } from "./search";

describe("searchWords", () => {
  it("lowercases, drops accents and splits on anything that isn't a letter or digit", () => {
    expect(searchWords("Café Crème, 2-in-1!")).toEqual(["cafe", "creme", "2", "in", "1"]);
    expect(searchWords("Casio fx-991ZA")).toEqual(["casio", "fx", "991za"]);
  });
});

describe("queryWords", () => {
  it("drops stop words and single letters, but keeps digits", () => {
    expect(queryWords("Notes for the Accounting 1 module, a must")).toEqual([
      "notes",
      "accounting",
      "1",
      "module",
      "must",
    ]);
  });

  it("is empty with no search, or a search of only small words", () => {
    expect(queryWords(null)).toEqual([]);
    expect(queryWords("the and a")).toEqual([]);
  });
});

describe("withinOneEdit", () => {
  it("allows one letter added, removed or changed, or two neighbours swapped", () => {
    expect(withinOneEdit("calculater", "calculator")).toBe(true);
    expect(withinOneEdit("brads", "braids")).toBe(true);
    expect(withinOneEdit("braids", "brads")).toBe(true);
    expect(withinOneEdit("kettel", "kettle")).toBe(true);
    expect(withinOneEdit("lamp", "lamp")).toBe(true);
  });

  it("refuses two edits", () => {
    expect(withinOneEdit("bakery", "baked")).toBe(false);
    expect(withinOneEdit("brads", "bread")).toBe(false);
    expect(withinOneEdit("lamp", "lampshade")).toBe(false);
  });
});

describe("wordMatches", () => {
  it("matches the start of a word at any length", () => {
    expect(wordMatches("calc", "calculator")).toBe(true);
    expect(wordMatches("991", "991za")).toBe(true);
    expect(wordMatches("lator", "calculator")).toBe(false);
  });

  it("forgives one typo only in words of five letters or more", () => {
    expect(wordMatches("brads", "braids")).toBe(true);
    expect(wordMatches("brad", "braid")).toBe(false);
  });
});

describe("matchScore", () => {
  const calculator = {
    title: "Casio fx-991ZA Plus calculator",
    category: "Tech",
    seller: "Tech corner",
    description: "Approved for exams.",
  };

  it("scores 3 in the title, 2 in the category or seller name, 1 in the description", () => {
    expect(matchScore(calculator, ["calculator"])).toBe(3);
    expect(matchScore(calculator, ["corner"])).toBe(2);
    expect(matchScore(calculator, ["exams"])).toBe(1);
    expect(matchScore(calculator, ["calculator", "tech"])).toBe(5);
  });

  it("needs every word to match", () => {
    expect(matchScore(calculator, ["calculator", "kettle"])).toBeNull();
  });

  it("matches everything with no words", () => {
    expect(matchScore(calculator, [])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm test lib/browse/search.test.ts`
Expected: FAIL. `./search` doesn't exist.

- [ ] **Step 3: Write the code**

Create `lib/browse/search.ts`:

```ts
// Search on the browse page (browse and listing spec 4.8). Plain functions: Supabase later swaps them for Postgres
// full-text search with trigram matching, and the rules stay the same.

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "on", "or", "the", "to", "with"]);

/** Typos are forgiven only in query words this long or longer. */
const TYPO_MIN_LENGTH = 5;

/** Lowercase words with accents removed, split on anything that isn't a letter or digit. */
export function searchWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The words a search looks for: no stop words and no single letters. Digits stay ("Accounting 1"). */
export function queryWords(q: string | null): string[] {
  if (!q) return [];
  return searchWords(q).filter((word) => !STOP_WORDS.has(word) && !(word.length === 1 && /\p{L}/u.test(word)));
}

/** True when `a` becomes `b` with at most one letter added, removed or changed, or two neighbours swapped. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  if (a.length === b.length) {
    const differences: number[] = [];
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) differences.push(i);
      if (differences.length > 2) return false;
    }
    if (differences.length === 1) return true;
    const [first, second] = differences;
    return second === first + 1 && a[first] === b[second] && a[second] === b[first];
  }

  // One letter added or removed: skip it in the longer word and the rest must match.
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < shorter.length && shorter[i] === longer[i]) i += 1;
  return shorter.slice(i) === longer.slice(i + 1);
}

/** A query word matches a word in the text when the text word starts with it, or, if it's long enough, is one typo away. */
export function wordMatches(queryWord: string, textWord: string): boolean {
  if (textWord.startsWith(queryWord)) return true;
  return queryWord.length >= TYPO_MIN_LENGTH && withinOneEdit(queryWord, textWord);
}

/** The text a listing is searched by. */
export type SearchFields = {
  title: string;
  category: string;
  seller: string;
  description: string;
};

/**
 * The Best match score, or null when any query word is missing. Each word scores where it's found first: 3 in the
 * title, 2 in the category or seller name, 1 in the description. With no words, everything matches with 0.
 */
export function matchScore(fields: SearchFields, words: readonly string[]): number | null {
  if (words.length === 0) return 0;
  const title = searchWords(fields.title);
  const names = searchWords(`${fields.category} ${fields.seller}`);
  const description = searchWords(fields.description);
  const found = (text: readonly string[], word: string) => text.some((textWord) => wordMatches(word, textWord));

  let score = 0;
  for (const word of words) {
    if (found(title, word)) score += 3;
    else if (found(names, word)) score += 2;
    else if (found(description, word)) score += 1;
    else return null;
  }
  return score;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm test lib/browse/search.test.ts`
Expected: PASS.

- [ ] **Step 5: Hand over for commit**

Files: `lib/browse/search.ts`, `lib/browse/search.test.ts`.
Message: `feat: browse search words, one-typo matching and the best match score`

---

### Task 5: Reading the browse link

Spec 3.2; plan decision 17.

**Files:**
- Modify: `lib/types.ts` (the browse types)
- Create: `lib/browse/query.ts`, `lib/browse/query.test.ts`
- Modify: `tests/helpers/fakes.ts` (`makeBrowseQuery`)

- [ ] **Step 1: Add the types**

Add to the end of `lib/types.ts`:

```ts
export type PriceFilter = "free" | "under-50" | "under-100" | "under-250" | "under-500";

export type PayFilter = "cash" | "swap";

export type BrowseSort = "match" | "new" | "price-low" | "price-high";

/** A browse page's whole state, read from its link (browse and listing spec 3.2). */
export type BrowseQuery = {
  q: string | null;
  category: string | null;
  /** A campus slug, or "all". */
  campus: CampusChoice;
  /** Whether the campus came from the link, rather than from the viewer's chosen campus. */
  campusFromLink: boolean;
  price: PriceFilter | null;
  pay: PayFilter | null;
  deals: "free-and-swaps" | null;
  sort: BrowseSort;
  /** How many results to show: 24, 48 … 240. */
  shown: number;
};

/** What a search needs: the query without the paging or where the campus came from (spec 6.3). */
export type SearchQuery = Omit<BrowseQuery, "shown" | "campusFromLink">;

export type SearchResult = {
  /** Every match, filtered and sorted. */
  items: readonly Listing[];
  /** How many match at other campuses, when the query is for one campus. Otherwise 0. */
  elsewhere: number;
};
```

Add to `tests/helpers/fakes.ts` (and add `BrowseQuery` to its type import):

```ts
/** A browse query for tests: every campus, no filters, newest first, 24 shown. */
export function makeBrowseQuery(overrides: Partial<BrowseQuery> = {}): BrowseQuery {
  return {
    q: null,
    category: null,
    campus: "all",
    campusFromLink: false,
    price: null,
    pay: null,
    deals: null,
    sort: "new",
    shown: 24,
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `lib/browse/query.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { parseBrowseParams, parseShown, type BrowseParams } from "./query";

const known = { campuses: new Set(["midrand", "pretoria"]), categories: new Set(["tech", "food"]) };
const parse = (params: BrowseParams, viewerCampus = "all") => parseBrowseParams(params, viewerCampus, known);

describe("parseBrowseParams (spec 3.2)", () => {
  it("reads every parameter", () => {
    expect(
      parse({
        q: " calculator ",
        cat: "tech",
        campus: "pretoria",
        price: "under-100",
        pay: "swap",
        deals: "free-and-swaps",
        sort: "price-low",
        n: "48",
      }),
    ).toEqual(
      makeBrowseQuery({
        q: "calculator",
        category: "tech",
        campus: "pretoria",
        campusFromLink: true,
        price: "under-100",
        pay: "swap",
        deals: "free-and-swaps",
        sort: "price-low",
        shown: 48,
      }),
    );
  });

  it("gives the defaults for a bare link", () => {
    expect(parse({})).toEqual(makeBrowseQuery());
  });

  it("sorts by best match by default with a search, and never without one", () => {
    expect(parse({ q: "lamp" }).sort).toBe("match");
    expect(parse({ q: "lamp", sort: "new" }).sort).toBe("new");
    expect(parse({ sort: "match" }).sort).toBe("new");
  });

  it("uses the viewer's campus when the link has none, and the link's when it has one", () => {
    expect(parse({}, "midrand")).toMatchObject({ campus: "midrand", campusFromLink: false });
    expect(parse({ campus: "all" }, "midrand")).toMatchObject({ campus: "all", campusFromLink: true });
    expect(parse({ campus: "pretoria" }, "midrand")).toMatchObject({ campus: "pretoria", campusFromLink: true });
    expect(parse({ campus: "atlantis" }, "midrand")).toMatchObject({ campus: "midrand", campusFromLink: false });
  });

  it("reads max as another name for price, and lets a valid price win", () => {
    expect(parse({ max: "50" }).price).toBe("under-50");
    expect(parse({ max: "500" }).price).toBe("under-500");
    expect(parse({ max: "75" }).price).toBeNull();
    expect(parse({ max: "constructor" }).price).toBeNull();
    expect(parse({ price: "free", max: "50" }).price).toBe("free");
    expect(parse({ price: "cheap", max: "50" }).price).toBe("under-50");
  });

  it("ignores unknown and empty values, and counts the first of a repeated parameter", () => {
    expect(parse({ cat: "spaceships", price: "", pay: "card", deals: "yes", sort: "random", q: "   " })).toEqual(
      makeBrowseQuery(),
    );
    expect(parse({ cat: ["food", "tech"], q: ["braids", "nails"] })).toMatchObject({ category: "food", q: "braids" });
  });

  it("cuts a long search to 100 characters", () => {
    expect(parse({ q: "a".repeat(150) }).q).toHaveLength(100);
  });
});

describe("parseShown", () => {
  it("rounds up to the next 24 and stops at 240", () => {
    expect(parseShown("48")).toBe(48);
    expect(parseShown("30")).toBe(48);
    expect(parseShown("1")).toBe(24);
    expect(parseShown("9999")).toBe(240);
  });

  it("ignores zero, negatives and anything that isn't a whole number", () => {
    for (const bad of ["0", "-24", "2.5", "abc", "", undefined]) expect(parseShown(bad)).toBe(24);
  });
});
```

Run: `pnpm test lib/browse/query.test.ts`
Expected: FAIL. `./query` doesn't exist.

- [ ] **Step 3: Write the code**

Create `lib/browse/query.ts`:

```ts
import { ALL_CAMPUSES } from "@/lib/campus";
import type {
  BrowseQuery,
  BrowseSort,
  Campus,
  CampusChoice,
  Category,
  PayFilter,
  PriceFilter,
  SearchQuery,
} from "@/lib/types";

export const PAGE_SIZE = 24;
export const MAX_SHOWN = 240;
export const MAX_QUERY_LENGTH = 100;

/** A page's search params, as Next passes them. */
export type BrowseParams = Record<string, string | string[] | undefined>;

/** The slugs a link may name. Anything else in a link is ignored. */
export type KnownSlugs = {
  campuses: ReadonlySet<string>;
  categories: ReadonlySet<string>;
};

const PRICES = new Set<string>(["free", "under-50", "under-100", "under-250", "under-500"]);
// A Map, not an object, so a link like ?max=constructor can't reach Object's own properties.
const MAX_ALIASES = new Map<string, PriceFilter>([
  ["50", "under-50"],
  ["100", "under-100"],
  ["250", "under-250"],
  ["500", "under-500"],
]);
const PAYS = new Set<string>(["cash", "swap"]);
const SORTS = new Set<string>(["match", "new", "price-low", "price-high"]);

/** The first value of a parameter: a repeated parameter counts once. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Best match with a search, newest without one. */
export function defaultSort(q: string | null): BrowseSort {
  return q ? "match" : "new";
}

/** `n`: rounded up to the next 24 and capped at 240. Anything else means the first 24. */
export function parseShown(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return PAGE_SIZE;
  const asked = Number(raw);
  if (asked === 0) return PAGE_SIZE;
  return Math.min(MAX_SHOWN, Math.ceil(asked / PAGE_SIZE) * PAGE_SIZE);
}

/**
 * Turn a browse link into a query (browse and listing spec 3.2). Unknown, empty and repeated values are ignored, so a
 * mangled link still shows results. With no campus in the link, the viewer's chosen campus is used.
 */
export function parseBrowseParams(params: BrowseParams, viewerCampus: CampusChoice, known: KnownSlugs): BrowseQuery {
  const q = first(params.q)?.trim().slice(0, MAX_QUERY_LENGTH).trim() || null;

  const cat = first(params.cat);
  const campusParam = first(params.campus);
  const campusFromLink =
    campusParam !== undefined && (campusParam === ALL_CAMPUSES || known.campuses.has(campusParam));

  const priceParam = first(params.price);
  const price =
    priceParam !== undefined && PRICES.has(priceParam)
      ? (priceParam as PriceFilter)
      : (MAX_ALIASES.get(first(params.max) ?? "") ?? null);

  const payParam = first(params.pay);
  const sortParam = first(params.sort);
  const sortAllowed = sortParam !== undefined && SORTS.has(sortParam) && !(sortParam === "match" && !q);

  return {
    q,
    category: cat !== undefined && known.categories.has(cat) ? cat : null,
    campus: campusFromLink && campusParam !== undefined ? campusParam : viewerCampus,
    campusFromLink,
    price,
    pay: payParam !== undefined && PAYS.has(payParam) ? (payParam as PayFilter) : null,
    deals: first(params.deals) === "free-and-swaps" ? "free-and-swaps" : null,
    sort: sortAllowed ? (sortParam as BrowseSort) : defaultSort(q),
    shown: parseShown(first(params.n)),
  };
}

/** The slugs a link may name, from the campus and category lists. */
export function knownSlugs(
  campuses: readonly Pick<Campus, "slug">[],
  categories: readonly Pick<Category, "slug">[],
): KnownSlugs {
  return {
    campuses: new Set(campuses.map((campus) => campus.slug)),
    categories: new Set(categories.map((category) => category.slug)),
  };
}

/** The part of a query a search needs (spec 6.3): no paging, and no note of where the campus came from. */
export function toSearchQuery({ q, category, campus, price, pay, deals, sort }: BrowseQuery): SearchQuery {
  return { q, category, campus, price, pay, deals, sort };
}
```

Add these tests at the end of `lib/browse/query.test.ts` (and add `knownSlugs` and `toSearchQuery` to its import):

```ts
describe("knownSlugs and toSearchQuery", () => {
  it("collects the slugs a link may name", () => {
    expect(knownSlugs([{ slug: "midrand" }], [{ slug: "tech" }])).toEqual({
      campuses: new Set(["midrand"]),
      categories: new Set(["tech"]),
    });
  });

  it("keeps what a search needs and drops the paging", () => {
    const query = makeBrowseQuery({ q: "lamp", campus: "midrand", campusFromLink: true, shown: 48 });
    expect(toSearchQuery(query)).toEqual({
      q: "lamp",
      category: null,
      campus: "midrand",
      price: null,
      pay: null,
      deals: null,
      sort: "new",
    });
  });
});
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm test lib/browse/query.test.ts`, then `pnpm typecheck`.
Expected: PASS.

- [ ] **Step 5: Hand over for commit**

Files: `lib/types.ts`, `lib/browse/query.ts`, `lib/browse/query.test.ts`, `tests/helpers/fakes.ts`.
Message: `feat: read the browse link into a query, with the campus default and the max alias`

---

### Task 6: Building browse links, chips and headings

Spec 3.3, 4.1, 4.5 and 4.6.

**Files:**
- Create: `lib/browse/href.ts`, `lib/browse/href.test.ts`
- Create: `lib/browse/filters.ts`, `lib/browse/filters.test.ts`
- Create: `lib/browse/heading.ts`, `lib/browse/heading.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/browse/href.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { browseHref } from "./href";

describe("browseHref (spec 3.3)", () => {
  it("leaves out every default", () => {
    expect(browseHref(makeBrowseQuery())).toBe("/browse");
  });

  it("writes the parameters in a fixed order", () => {
    const everything = makeBrowseQuery({
      q: "box braids",
      category: "hair-beauty",
      campus: "midrand",
      campusFromLink: true,
      price: "under-500",
      pay: "cash",
      deals: "free-and-swaps",
      sort: "price-low",
      shown: 48,
    });
    expect(browseHref(everything)).toBe(
      "/browse?q=box+braids&cat=hair-beauty&campus=midrand&price=under-500&pay=cash&deals=free-and-swaps&sort=price-low&n=48",
    );
  });

  it("writes the campus only when it came from the link or is being changed", () => {
    const fromCookie = makeBrowseQuery({ campus: "midrand", campusFromLink: false });
    expect(browseHref(fromCookie)).toBe("/browse");
    expect(browseHref(fromCookie, { category: "tech" })).toBe("/browse?cat=tech");
    expect(browseHref(fromCookie, { campus: "all" })).toBe("/browse?campus=all");
  });

  it("drops the default sort: best match with a search, newest without", () => {
    expect(browseHref(makeBrowseQuery({ q: "lamp", sort: "match" }))).toBe("/browse?q=lamp");
    expect(browseHref(makeBrowseQuery({ q: "lamp", sort: "new" }))).toBe("/browse?q=lamp&sort=new");
    expect(browseHref(makeBrowseQuery({ sort: "match" }))).toBe("/browse");
  });

  it("keeps n for Show more and for the same page, and drops it for any other change", () => {
    const second = makeBrowseQuery({ shown: 48 });
    expect(browseHref(second)).toBe("/browse?n=48");
    expect(browseHref(second, { shown: 72 })).toBe("/browse?n=72");
    expect(browseHref(second, { category: "food" })).toBe("/browse?cat=food");
    expect(browseHref(second, { sort: "price-high" })).toBe("/browse?sort=price-high");
  });
});
```

Create `lib/browse/filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { activeFilters, clearAllHref, clearFiltersHref, countActiveFilters, countLabel } from "./filters";

const names = new Map([["midrand", "Midrand"]]);

describe("activeFilters (spec 4.5)", () => {
  it("has no chips with no filters on", () => {
    expect(activeFilters(makeBrowseQuery(), names)).toEqual([]);
  });

  it("lists campus, price, pay and deals in that order, each with a link that removes only it", () => {
    const query = makeBrowseQuery({
      q: "lamp",
      sort: "match",
      campus: "midrand",
      price: "under-100",
      pay: "swap",
      deals: "free-and-swaps",
    });
    expect(activeFilters(query, names)).toEqual([
      {
        key: "campus",
        label: "Midrand",
        removeHref: "/browse?q=lamp&campus=all&price=under-100&pay=swap&deals=free-and-swaps",
      },
      { key: "price", label: "Under R100", removeHref: "/browse?q=lamp&pay=swap&deals=free-and-swaps" },
      { key: "pay", label: "Swaps", removeHref: "/browse?q=lamp&price=under-100&deals=free-and-swaps" },
      { key: "deals", label: "Free & swaps", removeHref: "/browse?q=lamp&price=under-100&pay=swap" },
    ]);
  });

  it("names Free and Cash", () => {
    const labels = activeFilters(makeBrowseQuery({ price: "free", pay: "cash" }), names).map((chip) => chip.label);
    expect(labels).toEqual(["Free", "Cash"]);
  });
});

describe("counting and clearing", () => {
  it("counts the campus (unless every campus), price, pay and deals", () => {
    expect(countActiveFilters(makeBrowseQuery())).toBe(0);
    expect(countActiveFilters(makeBrowseQuery({ campus: "midrand", price: "free" }))).toBe(2);
  });

  it("clears everything but the search, category and sort, and switches to every campus", () => {
    const query = makeBrowseQuery({
      q: "lamp",
      category: "res-living",
      campus: "midrand",
      price: "free",
      sort: "price-low",
      shown: 48,
    });
    expect(clearAllHref(query)).toBe("/browse?q=lamp&cat=res-living&campus=all&sort=price-low");
  });

  it("clears the filters but keeps the campus for the empty state", () => {
    const query = makeBrowseQuery({ campus: "midrand", campusFromLink: true, pay: "cash", deals: "free-and-swaps" });
    expect(clearFiltersHref(query)).toBe("/browse?campus=midrand");
  });
});

describe("countLabel (spec 4.6)", () => {
  it("counts listings, or says how many of how many are showing", () => {
    expect(countLabel(1, 1)).toBe("1 listing");
    expect(countLabel(29, 29)).toBe("29 listings");
    expect(countLabel(36, 24)).toBe("Showing 24 of 36");
  });
});
```

Create `lib/browse/heading.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { browseHeading } from "./heading";

describe("browseHeading (spec 4.1)", () => {
  it("says Everything with nothing chosen", () => {
    expect(browseHeading(null, null)).toEqual({ eyebrow: "Shop", heading: "Everything", title: "Browse" });
  });

  it("names the category", () => {
    expect(browseHeading(null, "Tech")).toEqual({ eyebrow: "Shop", heading: "Tech", title: "Tech" });
  });

  it("quotes a search, and says where it's searching", () => {
    expect(browseHeading("calculator", null)).toEqual({
      eyebrow: "Search",
      heading: "“calculator”",
      title: "“calculator”",
    });
    expect(browseHeading("calculator", "Tech").eyebrow).toBe("Search in Tech");
  });
});
```

Run: `pnpm test lib/browse`
Expected: FAIL. `./href`, `./filters` and `./heading` don't exist.

- [ ] **Step 2: Write the code**

Create `lib/browse/href.ts`:

```ts
import type { BrowseQuery } from "@/lib/types";
import { PAGE_SIZE, defaultSort } from "./query";

export type BrowseChanges = Partial<Omit<BrowseQuery, "campusFromLink">>;

/**
 * A browse link (browse and listing spec 3.3): the query with `changes` applied, the parameters in a fixed order, and
 * defaults left out, so links stay short and the same results share one link.
 * - The campus is written only when it came from the link or is being changed, so a link never pins a campus the
 *   viewer didn't ask for.
 * - Any change other than `shown` starts the results from the top again.
 */
export function browseHref(query: BrowseQuery, changes: BrowseChanges = {}): string {
  const next = { ...query, ...changes };
  const writeCampus = query.campusFromLink || "campus" in changes;
  const keepShown = "shown" in changes || Object.keys(changes).length === 0;
  const sort = next.sort === "match" && !next.q ? "new" : next.sort;

  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("cat", next.category);
  if (writeCampus) params.set("campus", next.campus);
  if (next.price) params.set("price", next.price);
  if (next.pay) params.set("pay", next.pay);
  if (next.deals) params.set("deals", next.deals);
  if (sort !== defaultSort(next.q)) params.set("sort", sort);
  if (keepShown && next.shown !== PAGE_SIZE) params.set("n", String(next.shown));

  const search = params.toString();
  return search ? `/browse?${search}` : "/browse";
}
```

Create `lib/browse/filters.ts`:

```ts
import { ALL_CAMPUSES } from "@/lib/campus";
import type { BrowseQuery, BrowseSort, PayFilter, PriceFilter } from "@/lib/types";
import { browseHref } from "./href";

export const PRICE_LABELS: Readonly<Record<PriceFilter, string>> = {
  free: "Free",
  "under-50": "Under R50",
  "under-100": "Under R100",
  "under-250": "Under R250",
  "under-500": "Under R500",
};

export const PAY_LABELS: Readonly<Record<PayFilter, string>> = { cash: "Cash", swap: "Swaps" };

export const SORT_LABELS: Readonly<Record<BrowseSort, string>> = {
  match: "Best match",
  new: "Newest",
  "price-low": "Price: low to high",
  "price-high": "Price: high to low",
};

export const DEALS_LABEL = "Free & swaps";

export type FilterChip = {
  key: "campus" | "price" | "pay" | "deals";
  label: string;
  removeHref: string;
};

/** A chip for each active filter, in order, with a link that removes just that one (spec 4.5). */
export function activeFilters(query: BrowseQuery, campusNames: ReadonlyMap<string, string>): FilterChip[] {
  const chips: FilterChip[] = [];
  if (query.campus !== ALL_CAMPUSES) {
    chips.push({
      key: "campus",
      label: campusNames.get(query.campus) ?? query.campus,
      removeHref: browseHref(query, { campus: ALL_CAMPUSES }),
    });
  }
  if (query.price) {
    chips.push({ key: "price", label: PRICE_LABELS[query.price], removeHref: browseHref(query, { price: null }) });
  }
  if (query.pay) chips.push({ key: "pay", label: PAY_LABELS[query.pay], removeHref: browseHref(query, { pay: null }) });
  if (query.deals) chips.push({ key: "deals", label: DEALS_LABEL, removeHref: browseHref(query, { deals: null }) });
  return chips;
}

/** How many filters are on, for the Filters button: the campus (unless every campus), price, pay and deals. */
export function countActiveFilters(query: BrowseQuery): number {
  return [query.campus !== ALL_CAMPUSES, query.price, query.pay, query.deals].filter(Boolean).length;
}

/** "Clear all" (spec 4.5): every campus, and no price, pay or deals. The search, category and sort stay. */
export function clearAllHref(query: BrowseQuery): string {
  return browseHref(query, { campus: ALL_CAMPUSES, price: null, pay: null, deals: null });
}

/** The empty state's "Clear filters" (spec 4.7): price, pay and deals go; the campus stays. */
export function clearFiltersHref(query: BrowseQuery): string {
  return browseHref(query, { price: null, pay: null, deals: null });
}

/** "1 listing", "29 listings", or "Showing 24 of 36" when there are more than shown (spec 4.6). */
export function countLabel(total: number, shown: number): string {
  if (shown < total) return `Showing ${shown} of ${total}`;
  return total === 1 ? "1 listing" : `${total} listings`;
}
```

Create `lib/browse/heading.ts`:

```ts
export type BrowseHeading = {
  eyebrow: string;
  heading: string;
  /** The tab title, before the layout adds " · Vossie". */
  title: string;
};

/** The browse page's eyebrow, h1 and tab title (spec 4.1). A search is wrapped in curly quotes. */
export function browseHeading(q: string | null, categoryName: string | null): BrowseHeading {
  if (q) {
    const quoted = `“${q}”`;
    return { eyebrow: categoryName ? `Search in ${categoryName}` : "Search", heading: quoted, title: quoted };
  }
  if (categoryName) return { eyebrow: "Shop", heading: categoryName, title: categoryName };
  return { eyebrow: "Shop", heading: "Everything", title: "Browse" };
}
```

- [ ] **Step 3: Run the tests to see them pass**

Run: `pnpm test lib/browse`, then `pnpm typecheck`.
Expected: PASS.

- [ ] **Step 4: Hand over for commit**

Files: `lib/browse/href.ts`, `lib/browse/href.test.ts`, `lib/browse/filters.ts`, `lib/browse/filters.test.ts`, `lib/browse/heading.ts`, `lib/browse/heading.test.ts`.
Message: `feat: browse links, filter chips, counts and headings`

---

### Task 7: Filtering, sorting and searchListings

Spec 4.9 and 6.3.

**Files:**
- Create: `lib/browse/results.ts`, `lib/browse/results.test.ts`
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `lib/browse/results.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import type { Listing, SearchQuery } from "@/lib/types";
import { findListings, passesFilters } from "./results";

const names = {
  sellers: new Map([["tech-corner", "Tech corner"]]),
  categories: new Map([["tech", "Tech"]]),
};

const search = (overrides: Partial<SearchQuery> = {}): SearchQuery => ({
  q: null,
  category: null,
  campus: "all",
  price: null,
  pay: null,
  deals: null,
  sort: "new",
  ...overrides,
});

const ids = (items: readonly Listing[]) => items.map((listing) => listing.id);

const free = makeListing({ id: "free", priceZar: 0, createdAt: "2026-10-01T10:00:00Z" });
const cheap = makeListing({ id: "cheap", priceZar: 50, createdAt: "2026-10-02T10:00:00Z" });
const dear = makeListing({ id: "dear", priceZar: 400, createdAt: "2026-10-03T10:00:00Z" });
const swapOnly = makeListing({ id: "swap", priceZar: null, payMode: "swap", swapFor: "a kettle", createdAt: "2026-10-04T10:00:00Z" });
const either = makeListing({ id: "either", priceZar: 120, payMode: "both", swapFor: "a lamp", createdAt: "2026-10-05T10:00:00Z" });
const all = [free, cheap, dear, swapOnly, either];

describe("passesFilters (spec 4.9)", () => {
  it("reads price=free as R0 and under-N as N or less, free included, swap-only left out", () => {
    expect(all.filter((listing) => passesFilters(listing, search({ price: "free" }))).map((l) => l.id)).toEqual(["free"]);
    expect(all.filter((listing) => passesFilters(listing, search({ price: "under-50" }))).map((l) => l.id)).toEqual([
      "free",
      "cheap",
    ]);
  });

  it("reads pay=cash as cash or both (free counts as cash) and pay=swap as swap or both", () => {
    expect(all.filter((listing) => passesFilters(listing, search({ pay: "cash" }))).map((l) => l.id)).toEqual([
      "free",
      "cheap",
      "dear",
      "either",
    ]);
    expect(all.filter((listing) => passesFilters(listing, search({ pay: "swap" }))).map((l) => l.id)).toEqual([
      "swap",
      "either",
    ]);
  });

  it("reads deals as free, or taking swaps", () => {
    expect(all.filter((listing) => passesFilters(listing, search({ deals: "free-and-swaps" }))).map((l) => l.id)).toEqual([
      "free",
      "swap",
      "either",
    ]);
  });
});

describe("findListings (spec 4.8, 4.9)", () => {
  it("sorts newest first, and leaves out paused and sold listings", () => {
    const paused = makeListing({ id: "paused", availability: "paused", createdAt: "2026-10-09T10:00:00Z" });
    const sold = makeListing({ id: "sold", availability: "sold", createdAt: "2026-10-09T10:00:00Z" });
    expect(ids(findListings([...all, paused, sold], search(), names).items)).toEqual([
      "either",
      "swap",
      "dear",
      "cheap",
      "free",
    ]);
  });

  it("sorts by price both ways, swap-only last, ties newest first", () => {
    const twin = makeListing({ id: "twin", priceZar: 50, createdAt: "2026-10-06T10:00:00Z" });
    expect(ids(findListings([...all, twin], search({ sort: "price-low" }), names).items)).toEqual([
      "free",
      "twin",
      "cheap",
      "either",
      "dear",
      "swap",
    ]);
    expect(ids(findListings(all, search({ sort: "price-high" }), names).items)).toEqual([
      "dear",
      "either",
      "cheap",
      "free",
      "swap",
    ]);
  });

  it("keeps one category, and counts matches at other campuses", () => {
    const food = makeListing({ id: "food", categorySlug: "food" });
    const pretoria = makeListing({ id: "pretoria", campusSlug: "pretoria" });
    const result = findListings([...all, food, pretoria], search({ category: "tech", campus: "midrand" }), names);
    expect(ids(result.items)).not.toContain("food");
    expect(ids(result.items)).not.toContain("pretoria");
    expect(result.elsewhere).toBe(1);
  });

  it("searches the title, category, seller name and description, best match first", () => {
    const inTitle = makeListing({ id: "title", title: "Gaming headset", createdAt: "2026-10-01T10:00:00Z" });
    const inDescription = makeListing({
      id: "description",
      title: "Speaker",
      description: "Works with any headset.",
      createdAt: "2026-10-09T10:00:00Z",
    });
    const bySeller = makeListing({ id: "seller", title: "Cable", description: "" });
    const result = findListings([inTitle, inDescription, bySeller], search({ q: "headset", sort: "match" }), names);
    expect(ids(result.items)).toEqual(["title", "description"]);
    expect(ids(findListings([bySeller], search({ q: "corner", sort: "match" }), names).items)).toEqual(["seller"]);
  });
});
```

Run: `pnpm test lib/browse/results.test.ts`
Expected: FAIL. `./results` doesn't exist.

- [ ] **Step 2: Write the code**

Create `lib/browse/results.ts`:

```ts
import { ALL_CAMPUSES } from "@/lib/campus";
import type { BrowseSort, Listing, PriceFilter, SearchQuery, SearchResult } from "@/lib/types";
import { matchScore, queryWords } from "./search";

const PRICE_CAPS: Readonly<Record<Exclude<PriceFilter, "free">, number>> = {
  "under-50": 50,
  "under-100": 100,
  "under-250": 250,
  "under-500": 500,
};

/**
 * The price, pay and deals filters (browse and listing spec 4.9). A free listing is R0 and counts as cash; a
 * swap-only listing has no price, so price filters leave it out. A "From" price counts at its from amount.
 */
export function passesFilters(listing: Listing, query: Pick<SearchQuery, "price" | "pay" | "deals">): boolean {
  const { priceZar, payMode } = listing;
  if (query.price === "free" && priceZar !== 0) return false;
  if (query.price && query.price !== "free" && (priceZar === null || priceZar > PRICE_CAPS[query.price])) return false;
  if (query.pay === "cash" && payMode === "swap") return false;
  if (query.pay === "swap" && payMode === "cash") return false;
  if (query.deals === "free-and-swaps" && priceZar !== 0 && payMode === "cash") return false;
  return true;
}

type Scored = { listing: Listing; score: number };

const newest = (a: Scored, b: Scored) => b.listing.createdAt.localeCompare(a.listing.createdAt);

/** Price order, with swap-only listings (no price) always last. Ties go to the newest. */
function byPrice(direction: 1 | -1) {
  return (a: Scored, b: Scored) => {
    const priceA = a.listing.priceZar;
    const priceB = b.listing.priceZar;
    if (priceA === null || priceB === null) {
      if (priceA === priceB) return newest(a, b);
      return priceA === null ? 1 : -1;
    }
    return (priceA - priceB) * direction || newest(a, b);
  };
}

const COMPARE: Readonly<Record<BrowseSort, (a: Scored, b: Scored) => number>> = {
  new: newest,
  "price-low": byPrice(1),
  "price-high": byPrice(-1),
  match: (a, b) => b.score - a.score || newest(a, b),
};

/** Seller and category names by slug, so a search can find a listing by them. */
export type ListingNames = {
  sellers: ReadonlyMap<string, string>;
  categories: ReadonlyMap<string, string>;
};

/**
 * Every available listing that matches the query, sorted (spec 4.8 and 4.9), and how many matches sit at other
 * campuses when the query is for one campus (for the empty state, spec 4.7).
 */
export function findListings(all: readonly Listing[], query: SearchQuery, names: ListingNames): SearchResult {
  const words = queryWords(query.q);
  const found: Scored[] = [];
  let elsewhere = 0;

  for (const listing of all) {
    if (listing.availability !== "available") continue;
    if (query.category && listing.categorySlug !== query.category) continue;
    if (!passesFilters(listing, query)) continue;
    const score = matchScore(
      {
        title: listing.title,
        category: names.categories.get(listing.categorySlug) ?? "",
        seller: names.sellers.get(listing.sellerSlug) ?? "",
        description: listing.description,
      },
      words,
    );
    if (score === null) continue;
    if (query.campus !== ALL_CAMPUSES && listing.campusSlug !== query.campus) {
      elsewhere += 1;
      continue;
    }
    found.push({ listing, score });
  }

  found.sort(COMPARE[query.sort]);
  return { items: found.map((entry) => entry.listing), elsewhere };
}
```

Run: `pnpm test lib/browse/results.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing data tests**

In `lib/data/index.test.ts`, add `searchListings,` to the import list, add `import type { SearchQuery } from "@/lib/types";`, and add at the end of the file:

```ts
describe("searchListings (browse and listing spec 6.3)", () => {
  const everything: SearchQuery = {
    q: null,
    category: null,
    campus: "all",
    price: null,
    pay: null,
    deals: null,
    sort: "new",
  };

  it("lists every available listing, newest first", async () => {
    const result = await searchListings(everything);
    expect(result.items).toHaveLength(36);
    expect(result.items[0].id).toBe("l-001");
    expect(result.elsewhere).toBe(0);
  });

  it("keeps to one campus and counts the rest", async () => {
    const midrand = await searchListings({ ...everything, campus: "midrand" });
    expect(midrand.items).toHaveLength(14);
    expect(midrand.elsewhere).toBe(22);
    expect(await searchListings({ ...everything, campus: "mbombela" })).toEqual({ items: [], elsewhere: 36 });
  });

  it("finds by title, typo, seller name and several words, leaving out the sold calculator", async () => {
    const ids = async (q: string, campus = "all") =>
      (await searchListings({ ...everything, q, campus, sort: "match" })).items.map((listing) => listing.id);
    expect(await ids("calculator")).toEqual(["l-001", "fs-006"]);
    expect(await ids("calculator", "midrand")).toEqual(["l-001"]);
    expect(await ids("brads")).toEqual(["l-004"]);
    expect(await ids("kettel")).toEqual(["l-014", "fs-002"]);
    expect(await ids("bakery")).toEqual(["l-009"]);
    expect(await ids("notes for accounting")).toEqual(["l-002"]);
  });

  it("filters by category, price, pay and deals", async () => {
    const count = async (changes: Partial<SearchQuery>) =>
      (await searchListings({ ...everything, ...changes })).items.length;
    expect(await count({ category: "tech" })).toBe(5);
    expect(await count({ price: "free" })).toBe(4);
    expect(await count({ price: "under-50" })).toBe(4);
    expect(await count({ price: "under-100" })).toBe(7);
    expect(await count({ pay: "swap" })).toBe(6);
    expect(await count({ deals: "free-and-swaps" })).toBe(10);
  });

  it("sorts tech by price, swap-only last", async () => {
    const tech = await searchListings({ ...everything, category: "tech", sort: "price-low" });
    expect(tech.items.map((listing) => listing.id)).toEqual(["l-018", "l-001", "l-007", "l-022", "fs-006"]);
  });
});
```

Run: `pnpm test lib/data/index.test.ts`
Expected: FAIL. `searchListings` isn't exported.

- [ ] **Step 4: Add searchListings**

In `lib/data/index.ts`, add `import { findListings } from "@/lib/browse/results";`, add `SearchQuery` and `SearchResult` to the type import, and add after `getPickupPoints`:

```ts
/**
 * Browse results (browse and listing spec 6.3): every available listing that matches, filtered and sorted, and how
 * many match at other campuses. The caller shows the first `shown`, so Show more reuses this cached result.
 */
export async function searchListings(query: SearchQuery): Promise<SearchResult> {
  "use cache";
  return findListings(listings, query, {
    sellers: new Map(sellers.map((seller) => [seller.slug, seller.name])),
    categories: new Map(categories.map((category) => [category.slug, category.name])),
  });
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm test lib/data/index.test.ts lib/browse`, then `pnpm test`, `pnpm typecheck` and `pnpm lint`.
Expected: all pass.

- [ ] **Step 6: Hand over for commit**

Files: `lib/browse/results.ts`, `lib/browse/results.test.ts`, `lib/data/index.ts`, `lib/data/index.test.ts`.
Message: `feat: browse filters, sorts and searchListings over the sample listings`

---

### Task 8: Move the shared card pieces, and two small API changes

Spec 7.3; plan decision 11.

**Files:**
- Move: `components/home/ListingCard.tsx`, `ListingCard.test.tsx`, `Photo.tsx`, `SaveHeart.tsx`, `SaveHeart.test.tsx` → `components/listings/` (approved in "Before you start")
- Modify (imports): `components/home/CampusChooser.tsx`, `Collections.tsx`, `ContextStripView.tsx`, `FeaturedToday.tsx`, `FreeAndSwaps.tsx`, `HubBanner.tsx`, `JustListed.tsx`, `ShopByCategory.tsx`, `shared.test.tsx`, `hero/HeroRotator.tsx`
- Modify: `components/listings/SaveHeart.tsx`, `components/listings/SaveHeart.test.tsx`
- Modify: `components/home/SectionError.tsx`, `components/home/shared.test.tsx`

- [ ] **Step 1: Check, then move the files**

Run `ls components/home/ListingCard.tsx components/home/ListingCard.test.tsx components/home/Photo.tsx components/home/SaveHeart.tsx components/home/SaveHeart.test.tsx components/listings/` and check all five files exist and `components/listings/` holds only `RecordRecentlyViewed.tsx` and its test.

Then, one command per file:

```bash
mv components/home/ListingCard.tsx components/listings/ListingCard.tsx
mv components/home/ListingCard.test.tsx components/listings/ListingCard.test.tsx
mv components/home/Photo.tsx components/listings/Photo.tsx
mv components/home/SaveHeart.tsx components/listings/SaveHeart.tsx
mv components/home/SaveHeart.test.tsx components/listings/SaveHeart.test.tsx
```

(Plain `mv`, not `git mv`: implementers leave git alone. The controller's `git add` records the moves.)

The moved files import each other with `./`, so they need no change.

- [ ] **Step 2: Update the imports**

In each file below, change the import to the new path:

| File | New import |
|---|---|
| `components/home/CampusChooser.tsx`, `Collections.tsx`, `ContextStripView.tsx`, `FeaturedToday.tsx`, `FreeAndSwaps.tsx`, `HubBanner.tsx`, `ShopByCategory.tsx`, `shared.test.tsx` | `import { Photo } from "@/components/listings/Photo";` |
| `components/home/hero/HeroRotator.tsx` | `import { Photo } from "@/components/listings/Photo";` (was `"../Photo"`) |
| `components/home/JustListed.tsx` | `import { ListingCard, ListingCardSkeleton } from "@/components/listings/ListingCard";` |

Then run:

```bash
grep -rnE '"\./(Photo|SaveHeart|ListingCard)"|"\.\./Photo"|home/(Photo|SaveHeart|ListingCard)' app components hooks lib tests
```

Expected: four lines, all inside `components/listings/`: `ListingCard.tsx`'s imports of `./Photo` and `./SaveHeart`, and the two moved tests' imports of their own components.

Run: `pnpm test` and `pnpm typecheck`.
Expected: everything passes, as before the move.

- [ ] **Step 3: Write the failing tests**

Add to `components/listings/SaveHeart.test.tsx`:

```tsx
  it("takes an extra class, for the listing page's action bar", () => {
    render(<SaveHeart id="l-001" title="Casio calculator" className="save-heart-inline" />);
    expect(screen.getByRole("button", { name: "Save Casio calculator" })).toHaveClass("save-heart", "save-heart-inline");
  });
```

(Place it inside the file's existing `describe`. If its imports lack `render` or `screen`, add them from `@testing-library/react`.)

Add to the `describe("SectionError", …)` block in `components/home/shared.test.tsx`:

```tsx
  it("comes back to the page it's on, when given one", () => {
    render(<SectionError id="more-from" title="More listings" path="/listings/l-001" />);
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/listings/l-001?retry=more-from#more-from",
    );
  });
```

Run: `pnpm test components/listings/SaveHeart.test.tsx components/home/shared.test.tsx`
Expected: FAIL. `className` and `path` are ignored.

- [ ] **Step 4: Write the code**

In `components/listings/SaveHeart.tsx`, add `import { cx } from "@/lib/cx";`, change the signature to:

```tsx
export function SaveHeart({ id, title, className }: { id: string; title: string; className?: string }) {
```

and the button's class to `className={cx("save-heart", className)}`.

In `components/home/SectionError.tsx`, replace the component with:

```tsx
/**
 * A section's error state (spec section 9). One failing section never blanks the page. "Try again" reloads the page
 * it's on (the homepage unless `path` says otherwise) and comes back to this section: the query string makes it a
 * fresh request, and the hash scrolls back.
 */
export function SectionError({ id, title, path = "/" }: { id: string; title: string; path?: string }) {
  return (
    <div className="section-error">
      <p>{title} didn&apos;t load.</p>
      <a href={`${path}?retry=${id}#${id}`} className="btn btn-outline text-navy">
        Try again
      </a>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm test`, `pnpm typecheck` and `pnpm lint`.
Expected: all pass.

- [ ] **Step 6: Hand over for commit**

Files: the five moved files (old and new paths), the ten files whose imports changed, `components/home/SectionError.tsx`.
Message: `refactor: move the listing card, photo and save heart to components/listings; SaveHeart takes a class, SectionError a path`

---

### Task 9: Browse header and category tabs

Spec 4.1 to 4.3.

**Files:**
- Create: `components/browse/BrowseHeader.tsx`, `BrowseHeader.test.tsx`
- Create: `components/browse/CategoryTabs.tsx`, `CategoryTabs.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing tests**

Create `components/browse/BrowseHeader.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { BrowseHeader } from "./BrowseHeader";

describe("BrowseHeader (spec 4.1, 4.2)", () => {
  it("says Shop and Everything with nothing chosen", () => {
    render(<BrowseHeader query={makeBrowseQuery()} categoryName={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Everything" })).toBeInTheDocument();
    expect(screen.getByText("Shop")).toHaveClass("eyebrow");
  });

  it("quotes the search, says where it's searching, and fills the field", () => {
    render(<BrowseHeader query={makeBrowseQuery({ q: "calculator", sort: "match" })} categoryName="Tech" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("“calculator”");
    expect(screen.getByText("Search in Tech")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search Vossie" })).toHaveValue("calculator");
  });

  it("searches with a plain form that keeps the category and filters, and the campus only from the link", () => {
    const { container } = render(
      <BrowseHeader
        query={makeBrowseQuery({ category: "tech", campus: "midrand", campusFromLink: false, price: "free" })}
        categoryName="Tech"
      />,
    );
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/browse");
    const hidden = Object.fromEntries(
      [...container.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map((input) => [input.name, input.value]),
    );
    expect(hidden).toEqual({ cat: "tech", price: "free" });
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
  });
});
```

Create `components/browse/CategoryTabs.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import type { Category } from "@/lib/types";
import { CategoryTabs } from "./CategoryTabs";

const categories: Category[] = [
  { slug: "tech", name: "Tech", image: { src: "/p.svg", alt: "" } },
  { slug: "food", name: "Food", image: { src: "/p.svg", alt: "" } },
];

describe("CategoryTabs (spec 4.3)", () => {
  it("lists All and each category as links, the chosen one current", () => {
    render(<CategoryTabs query={makeBrowseQuery({ category: "tech" })} categories={categories} />);
    const nav = screen.getByRole("navigation", { name: "Categories" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["All", "Tech", "Food"]);
    expect(within(nav).getByRole("link", { name: "Tech" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the search and filters, and starts the results from the top", () => {
    render(
      <CategoryTabs
        query={makeBrowseQuery({ q: "lamp", sort: "match", category: "tech", price: "under-250", shown: 48 })}
        categories={categories}
      />,
    );
    expect(screen.getByRole("link", { name: "Food" })).toHaveAttribute("href", "/browse?q=lamp&cat=food&price=under-250");
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/browse?q=lamp&price=under-250");
  });

  it("marks All when no category is chosen", () => {
    render(<CategoryTabs query={makeBrowseQuery()} categories={categories} />);
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });
});
```

Run: `pnpm test components/browse`
Expected: FAIL. The components don't exist.

- [ ] **Step 2: Write the components**

Create `components/browse/BrowseHeader.tsx`:

```tsx
import { SearchIcon } from "@/components/icons";
import { browseHeading } from "@/lib/browse/heading";
import type { BrowseQuery } from "@/lib/types";

/** The browse page's eyebrow, h1 and search field (spec 4.1 and 4.2). */
export function BrowseHeader({ query, categoryName }: { query: BrowseQuery; categoryName: string | null }) {
  const { eyebrow, heading } = browseHeading(query.q, categoryName);
  return (
    <div className="browse-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="browse-title">{heading}</h1>
      </div>
      <BrowseSearch query={query} />
    </div>
  );
}

/**
 * A plain GET form, so it works before (or without) the app's JavaScript. A new search keeps the category and filters, and the
 * campus when the link named one; it drops the sort and paging, so it starts at Best match from the top.
 */
function BrowseSearch({ query }: { query: BrowseQuery }) {
  const kept: ReadonlyArray<[name: string, value: string | null]> = [
    ["cat", query.category],
    ["campus", query.campusFromLink ? query.campus : null],
    ["price", query.price],
    ["pay", query.pay],
    ["deals", query.deals],
  ];
  return (
    <form action="/browse" role="search" className="browse-search">
      <label htmlFor="browse-q" className="sr-only">
        Search Vossie
      </label>
      <input
        id="browse-q"
        type="search"
        name="q"
        defaultValue={query.q ?? ""}
        placeholder="Search Vossie"
        autoComplete="off"
        enterKeyHint="search"
        className="browse-search-input"
      />
      {kept.map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
      <button type="submit" aria-label="Search" className="icon-btn">
        <SearchIcon className="size-5" />
      </button>
    </form>
  );
}
```

Create `components/browse/CategoryTabs.tsx`:

```tsx
import Link from "next/link";
import { browseHref } from "@/lib/browse/href";
import type { BrowseQuery, Category } from "@/lib/types";

/**
 * All, then the categories, as a row of links (spec 4.3). Each keeps the search and filters. No prefetching: each
 * tab is a different page of results, and fetching them all would cost mobile data (plan decision 3).
 */
export function CategoryTabs({ query, categories }: { query: BrowseQuery; categories: readonly Category[] }) {
  const tabs = [{ slug: null, name: "All" }, ...categories.map(({ slug, name }) => ({ slug, name }))];
  return (
    <nav aria-label="Categories" className="category-tabs">
      <ul>
        {tabs.map((tab) => (
          <li key={tab.slug ?? "all"}>
            <Link
              href={browseHref(query, { category: tab.slug })}
              prefetch={false}
              aria-current={tab.slug === query.category ? "page" : undefined}
              className="category-tab"
            >
              {tab.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

Run: `pnpm test components/browse`
Expected: PASS.

- [ ] **Step 3: Add the page column and the CSS**

In `app/globals.css`, in the "Homepage: frame and shared pieces" block, add `.page` beside `.home` in both places, so browse and listing pages share the homepage's column:

```css
  .home,
  .page {
    width: 100%;
    …
```

and, inside that block's tablet media query:

```css
    .home,
    .page {
      padding-inline: 24px;
    }
```

Add at the end of `app/globals.css`:

```css
/* --- Browse: frame, header and category tabs (browse and listing plan, Task 9, spec 4.1 to 4.3) --- */
@layer components {
  /* Inside .page's gutters, the same 16px (phones) and 40px (tablet up) content edge as the homepage's sections. */
  .browse {
    padding: 24px 6px 64px;
  }

  /* Phones: the search field first, then the eyebrow and h1. Desktop: the h1 on the left, the field on the right. */
  .browse-head {
    display: grid;
    gap: 18px;
  }

  .browse-search {
    order: -1;
    display: flex;
    align-items: center;
    min-height: 48px;
    padding-inline: 18px 2px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
    background: var(--color-white);
  }

  /* The ring goes round the whole pill. */
  .browse-search:focus-within {
    outline: 2.5px solid var(--color-navy);
    outline-offset: 3px;
  }

  .browse-search-input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    background: transparent;
    color: var(--color-ink);
  }

  .browse-search-input:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .browse-title {
    margin-top: 6px;
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .category-tabs {
    margin-top: 22px;
    border-bottom: 1px solid var(--color-line);
  }

  /* One row that scrolls sideways when it doesn't fit, with no scrollbar showing. The top padding keeps focus
     rings inside the scroll box, which would clip them. */
  .category-tabs ul {
    display: flex;
    gap: 22px;
    margin-bottom: -1px;
    padding-top: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .category-tabs ul::-webkit-scrollbar {
    display: none;
  }

  .category-tab {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    border-bottom: 3px solid transparent;
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }

  .category-tab:focus-visible {
    outline-offset: -2px;
  }

  /* Navy, not sky: a sky underline would be 2.6:1 on white as a state indicator (WCAG 1.4.11). Where the browser
     supports it, the row starts scrolled to the chosen tab; elsewhere it starts at All, and the h1 says where you
     are (spec 4.3). */
  .category-tab[aria-current="page"] {
    border-bottom-color: var(--color-navy);
    color: var(--color-navy);
    font-weight: 700;
    scroll-initial-target: nearest;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .browse {
      padding-inline: 16px;
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .browse-head {
      grid-template-columns: minmax(0, 1fr) minmax(18rem, 26rem);
      align-items: end;
    }

    .browse-search {
      order: 0;
    }
  }
}
```

Before relying on `scroll-initial-target`, check its current browser support (MDN or caniuse). If the name has changed, use the current one; the fallback (starting at All) needs nothing.

- [ ] **Step 4: Run the checks**

Run: `pnpm test`, `pnpm typecheck` and `pnpm lint`.
Expected: all pass. (The page isn't wired up until Task 12, so there's nothing to look at yet.)

- [ ] **Step 5: Hand over for commit**

Files: `components/browse/BrowseHeader.tsx`, `BrowseHeader.test.tsx`, `CategoryTabs.tsx`, `CategoryTabs.test.tsx`, `app/globals.css`.
Message: `feat: browse header with its search form, and the category tabs`

---

### Task 10: The toolbar, Filters panel and Sort menu

Spec 4.4; plan decisions 1, 2, 3 and 5.

**Files:**
- Create: `components/browse/FiltersPanel.tsx`, `FiltersPanel.test.tsx`
- Create: `components/browse/SortMenu.tsx`, `SortMenu.test.tsx`
- Create: `components/browse/BrowseToolbar.tsx`, `BrowseToolbar.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing tests**

Create `components/browse/FiltersPanel.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import type { Campus } from "@/lib/types";
import { FiltersPanel } from "./FiltersPanel";

const campus = (slug: string, name: string): Campus => ({
  slug,
  name,
  region: "Gauteng",
  liveListings: 1,
  image: { src: "/p.svg", alt: "" },
});
const campuses = [campus("midrand", "Midrand"), campus("pretoria", "Pretoria")];

const hiddenFields = (container: HTMLElement) =>
  Object.fromEntries(
    [...container.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map((input) => [input.name, input.value]),
  );

describe("FiltersPanel (spec 4.4)", () => {
  it("is a GET form to /browse that keeps the search, category, deals and a chosen sort", () => {
    const { container } = render(
      <FiltersPanel
        query={makeBrowseQuery({ q: "lamp", category: "res-living", deals: "free-and-swaps", sort: "price-low" })}
        campuses={campuses}
      />,
    );
    const form = container.querySelector("form")!;
    expect(form).toHaveAttribute("action", "/browse");
    expect(form).not.toHaveAttribute("method", "post");
    expect(hiddenFields(container)).toEqual({ q: "lamp", cat: "res-living", deals: "free-and-swaps", sort: "price-low" });
  });

  it("leaves the default sort out", () => {
    const { container } = render(<FiltersPanel query={makeBrowseQuery({ q: "lamp", sort: "match" })} campuses={campuses} />);
    expect(hiddenFields(container)).toEqual({ q: "lamp" });
  });

  it("offers every campus, Every campus first, with the current one selected", () => {
    render(<FiltersPanel query={makeBrowseQuery({ campus: "midrand" })} campuses={campuses} />);
    const select = screen.getByRole("combobox", { name: "Campus" });
    expect(select).toHaveValue("midrand");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Every campus",
      "Midrand",
      "Pretoria",
    ]);
  });

  it("groups price and pay as radios, with the current ones checked", () => {
    render(<FiltersPanel query={makeBrowseQuery({ price: "under-100", pay: "swap" })} campuses={campuses} />);
    const price = screen.getByRole("group", { name: "Price" });
    expect(within(price).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual([
      "Any",
      "Free",
      "Under R50",
      "Under R100",
      "Under R250",
      "Under R500",
    ]);
    expect(within(price).getByRole("radio", { name: "Under R100" })).toBeChecked();
    const pay = screen.getByRole("group", { name: "Paid with" });
    expect(within(pay).getByRole("radio", { name: "Swaps" })).toBeChecked();
    expect(within(pay).getByRole("radio", { name: "Any" })).not.toBeChecked();
  });

  it("checks Any when no price or pay is chosen", () => {
    render(<FiltersPanel query={makeBrowseQuery()} campuses={campuses} />);
    expect(within(screen.getByRole("group", { name: "Price" })).getByRole("radio", { name: "Any" })).toBeChecked();
    expect(within(screen.getByRole("group", { name: "Paid with" })).getByRole("radio", { name: "Any" })).toBeChecked();
  });

  it("shows results with a submit button, and clears to every campus with no filters", () => {
    render(<FiltersPanel query={makeBrowseQuery({ campus: "midrand", price: "free" })} campuses={campuses} />);
    expect(screen.getByRole("button", { name: "Show results" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute("href", "/browse?campus=all");
  });
});
```

Create `components/browse/SortMenu.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { SortMenu } from "./SortMenu";

describe("SortMenu (spec 4.4)", () => {
  it("lists the sorts as links, the current one marked, each starting from the top", () => {
    render(<SortMenu query={makeBrowseQuery({ category: "tech", shown: 48 })} />);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Newest",
      "Price: low to high",
      "Price: high to low",
    ]);
    expect(screen.getByRole("link", { name: "Newest" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Price: low to high" })).toHaveAttribute(
      "href",
      "/browse?cat=tech&sort=price-low",
    );
  });

  it("offers Best match first, and only with a search", () => {
    render(<SortMenu query={makeBrowseQuery({ q: "lamp", sort: "match" })} />);
    expect(screen.getAllByRole("link")[0]).toHaveTextContent("Best match");
    expect(screen.getByRole("link", { name: "Best match" })).toHaveAttribute("href", "/browse?q=lamp");
    expect(screen.getByRole("link", { name: "Newest" })).toHaveAttribute("href", "/browse?q=lamp&sort=new");
  });
});
```

Create `components/browse/BrowseToolbar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { BrowseToolbar } from "./BrowseToolbar";

describe("BrowseToolbar (spec 4.4, 4.6)", () => {
  it("names the Filters button with how many filters are on (plan decision 2)", () => {
    const { container } = render(
      <BrowseToolbar query={makeBrowseQuery({ campus: "midrand", price: "free" })} campuses={[]} total={14} />,
    );
    const summary = container.querySelector(".tool-filters > summary");
    expect(summary).toHaveAttribute("aria-label", "Filters, 2 active");
    expect(summary).toHaveTextContent("Filters (2)");
  });

  it("says just Filters with none on, and shows the sort and the count", () => {
    const { container } = render(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={36} />);
    expect(container.querySelector(".tool-filters > summary")).toHaveAttribute("aria-label", "Filters");
    expect(container.querySelector(".tool-sort > summary")).toHaveTextContent("Sort: Newest");
    expect(screen.getByText("Showing 24 of 36")).toBeInTheDocument();
  });

  it("lets one menu open at a time where the browser supports it", () => {
    const { container } = render(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={1} />);
    const menus = container.querySelectorAll("details");
    expect(menus).toHaveLength(2);
    for (const menu of menus) expect(menu).toHaveAttribute("name", "browse-tools");
  });

  it("hides the count when nothing matches or the search failed", () => {
    const { rerender } = render(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={0} />);
    expect(screen.queryByText(/listing/)).not.toBeInTheDocument();
    rerender(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={null} />);
    expect(screen.queryByText(/listing/)).not.toBeInTheDocument();
  });
});
```

Run: `pnpm test components/browse`
Expected: FAIL. The three components don't exist.

- [ ] **Step 2: Write the components**

Create `components/browse/FiltersPanel.tsx`:

```tsx
import Link from "next/link";
import { PAY_LABELS, PRICE_LABELS, clearAllHref } from "@/lib/browse/filters";
import { defaultSort } from "@/lib/browse/query";
import type { BrowseQuery, Campus } from "@/lib/types";

const PRICE_OPTIONS: ReadonlyArray<[value: string, label: string]> = [["", "Any"], ...Object.entries(PRICE_LABELS)];
const PAY_OPTIONS: ReadonlyArray<[value: string, label: string]> = [["", "Any"], ...Object.entries(PAY_LABELS)];

/**
 * The Filters panel (spec 4.4): a plain GET form to /browse, so it works without the app's JavaScript. Hidden fields keep the
 * search, category, deals and a chosen sort. There's no live count: that would need JavaScript. Empty values ("Any")
 * are sent as `price=` and ignored when the link is read.
 */
export function FiltersPanel({ query, campuses }: { query: BrowseQuery; campuses: readonly Campus[] }) {
  const kept: ReadonlyArray<[name: string, value: string | null]> = [
    ["q", query.q],
    ["cat", query.category],
    ["deals", query.deals],
    ["sort", query.sort === defaultSort(query.q) ? null : query.sort],
  ];
  return (
    <form action="/browse" className="filters-panel">
      {kept.map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
      <div className="filters-fields">
        <div className="filters-group">
          <label htmlFor="filter-campus" className="filters-label">
            Campus
          </label>
          <select id="filter-campus" name="campus" defaultValue={query.campus} className="filters-select">
            <option value="all">Every campus</option>
            {campuses.map((campus) => (
              <option key={campus.slug} value={campus.slug}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>
        <RadioGroup legend="Price" name="price" options={PRICE_OPTIONS} chosen={query.price ?? ""} />
        <RadioGroup legend="Paid with" name="pay" options={PAY_OPTIONS} chosen={query.pay ?? ""} />
      </div>
      <div className="filters-actions">
        <button type="submit" className="btn btn-primary">
          Show results
        </button>
        <Link href={clearAllHref(query)} prefetch={false} className="filters-clear">
          Clear
        </Link>
      </div>
    </form>
  );
}

type RadioGroupProps = {
  legend: string;
  name: string;
  options: ReadonlyArray<[value: string, label: string]>;
  chosen: string;
};

/** Native radios in a fieldset, so they work everywhere; the pill round each one is just a bigger target. */
function RadioGroup({ legend, name, options, chosen }: RadioGroupProps) {
  return (
    <fieldset className="filters-group">
      <legend className="filters-label">{legend}</legend>
      <div className="filters-options">
        {options.map(([value, label]) => (
          <label key={value || "any"} className="filters-option">
            <input type="radio" name={name} value={value} defaultChecked={value === chosen} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

Create `components/browse/SortMenu.tsx`:

```tsx
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { SORT_LABELS } from "@/lib/browse/filters";
import { browseHref } from "@/lib/browse/href";
import type { BrowseQuery, BrowseSort } from "@/lib/types";

/** The Sort menu (spec 4.4): links, so one tap applies. Best match only appears with a search. */
export function SortMenu({ query }: { query: BrowseQuery }) {
  const sorts: readonly BrowseSort[] = query.q
    ? ["match", "new", "price-low", "price-high"]
    : ["new", "price-low", "price-high"];
  return (
    <ul className="sort-menu">
      {sorts.map((sort) => {
        const current = sort === query.sort;
        return (
          <li key={sort}>
            <Link
              href={browseHref(query, { sort })}
              prefetch={false}
              aria-current={current ? "true" : undefined}
              className="sort-option"
            >
              {SORT_LABELS[sort]}
              {current && <CheckIcon className="size-4" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

Create `components/browse/BrowseToolbar.tsx`:

```tsx
import { ChevronDownIcon } from "@/components/icons";
import { SORT_LABELS, countActiveFilters, countLabel } from "@/lib/browse/filters";
import { browseHref } from "@/lib/browse/href";
import type { BrowseQuery, Campus } from "@/lib/types";
import { FiltersPanel } from "./FiltersPanel";
import { SortMenu } from "./SortMenu";

type BrowseToolbarProps = {
  query: BrowseQuery;
  campuses: readonly Campus[];
  /** How many results there are, or null when the search failed. */
  total: number | null;
};

/**
 * Filters, Sort and the count (spec 4.4 and 4.6). Both menus are native <details>, which iPhones on iOS 16 can open
 * (decision 41). They share a name, so opening one closes the other where the browser supports it.
 */
export function BrowseToolbar({ query, campuses, total }: BrowseToolbarProps) {
  const active = countActiveFilters(query);
  // Keyed on the link: a client-side navigation (a sort link) gives closed menus, not ones left open (plan decision 5).
  const href = browseHref(query);
  return (
    <div className="browse-tools">
      <details key={`filters ${href}`} name="browse-tools" className="tool tool-filters">
        {/* aria-label, not hidden spans: Chromium puts spaces between a summary's flex children (plan decision 2). */}
        <summary aria-label={active > 0 ? `Filters, ${active} active` : "Filters"} className="tool-button">
          {active > 0 ? `Filters (${active})` : "Filters"}
          <ChevronDownIcon className="tool-chevron size-4" />
        </summary>
        <FiltersPanel query={query} campuses={campuses} />
      </details>
      <details key={`sort ${href}`} name="browse-tools" className="tool tool-sort">
        <summary className="tool-button">
          Sort: {SORT_LABELS[query.sort]}
          <ChevronDownIcon className="tool-chevron size-4" />
        </summary>
        <SortMenu query={query} />
      </details>
      {total !== null && total > 0 && <p className="browse-count">{countLabel(total, Math.min(total, query.shown))}</p>}
    </div>
  );
}
```

Run: `pnpm test components/browse`
Expected: PASS.

- [ ] **Step 3: Add the CSS**

Add at the end of `app/globals.css`:

```css
/* --- Browse: toolbar, Filters panel and Sort menu (browse and listing plan, Task 10, spec 4.4) --- */
@layer components {
  /* One wrapping row. An open Filters panel takes the whole width under it, so Sort and the count move below it;
     Sort's menu opens in place. Nothing floats over the results, since a <details> can't be closed by tapping
     elsewhere (plan decision 1). */
  .browse-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 10px;
    margin-top: 16px;
  }

  .tool {
    flex: none;
  }

  .tool-filters[open] {
    flex-basis: 100%;
  }

  .tool-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
    color: var(--color-navy);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    list-style: none;
  }

  .tool-button::-webkit-details-marker {
    display: none;
  }

  .tool[open] > .tool-button {
    background: var(--color-navy);
    color: var(--color-white);
  }

  .tool-chevron {
    transition: rotate var(--dur-fast) var(--ease-out);
  }

  .tool[open] .tool-chevron {
    rotate: 180deg;
  }

  .browse-count {
    flex-basis: 100%;
    color: var(--color-muted);
    font-size: 13px;
  }

  .filters-panel {
    display: grid;
    gap: 20px;
    margin-top: 12px;
    padding: 18px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  .filters-fields {
    display: grid;
    gap: 20px;
  }

  .filters-group {
    display: grid;
    align-content: start;
    gap: 10px;
    min-width: 0;
  }

  .filters-label {
    color: var(--color-navy);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .filters-select {
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 1.5px solid var(--color-field);
    border-radius: 12px;
    background: var(--color-white);
    color: var(--color-ink);
  }

  .filters-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filters-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 14px;
    border: 1.5px solid var(--color-field);
    border-radius: 999px;
    background: var(--color-white);
    color: var(--color-navy);
    font-size: 14px;
    cursor: pointer;
  }

  .filters-option input {
    accent-color: var(--color-navy);
  }

  .filters-option:has(input:checked) {
    border-color: var(--color-navy);
    font-weight: 600;
  }

  .filters-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 20px;
  }

  /* Navy on the grey panel: sky-dark is 4.25:1 there. */
  .filters-clear {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-navy);
    font-size: 13px;
    font-weight: 600;
    text-decoration: underline 1.5px;
    text-underline-offset: 4px;
  }

  .sort-menu {
    display: grid;
    min-width: 15rem;
    margin-top: 8px;
    padding: 6px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-white);
  }

  .sort-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    color: var(--color-navy);
    font-size: 14px;
  }

  .sort-option[aria-current="true"] {
    background: var(--color-pale);
    font-weight: 700;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .browse-count {
      flex-basis: auto;
      align-self: center;
      margin-left: auto;
    }

    .filters-fields {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}
```

- [ ] **Step 4: Run the checks**

Run: `pnpm test`, `pnpm typecheck` and `pnpm lint`.
Expected: all pass.

- [ ] **Step 5: Hand over for commit**

Files: `components/browse/FiltersPanel.tsx`, `FiltersPanel.test.tsx`, `SortMenu.tsx`, `SortMenu.test.tsx`, `BrowseToolbar.tsx`, `BrowseToolbar.test.tsx`, `app/globals.css`.
Message: `feat: browse toolbar with the Filters panel and Sort menu as native details`

---

### Task 11: Chips, the results grid, and the empty and error states

Spec 4.5 to 4.7 and section 8; plan decision 4.

**Files:**
- Create: `components/browse/ActiveFilters.tsx`, `ActiveFilters.test.tsx`
- Create: `components/browse/ResultsGrid.tsx`, `ResultsGrid.test.tsx`
- Create: `components/browse/BrowseEmpty.tsx`, `BrowseEmpty.test.tsx`
- Create: `components/browse/BrowseError.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing tests**

Create `components/browse/ActiveFilters.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { ActiveFilters } from "./ActiveFilters";

const names = new Map([["midrand", "Midrand"]]);

describe("ActiveFilters (spec 4.5)", () => {
  it("shows nothing with no filters on", () => {
    const { container } = render(<ActiveFilters query={makeBrowseQuery()} campusNames={names} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("makes each filter a link that removes it", () => {
    render(<ActiveFilters query={makeBrowseQuery({ campus: "midrand" })} campusNames={names} />);
    const chip = screen.getByRole("link", { name: "Remove filter: Midrand" });
    expect(chip).toHaveAttribute("href", "/browse?campus=all");
    expect(chip).toHaveTextContent("Midrand");
    expect(screen.queryByRole("link", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("adds Clear all with two or more chips", () => {
    render(<ActiveFilters query={makeBrowseQuery({ campus: "midrand", price: "free" })} campusNames={names} />);
    expect(screen.getByRole("list", { name: "Active filters" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute("href", "/browse?campus=all");
  });
});
```

Create `components/browse/ResultsGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery, makeListing } from "@/tests/helpers/fakes";
import { ResultsGrid } from "./ResultsGrid";

const names = new Map([["midrand", "Midrand"]]);
const listings = (count: number) =>
  Array.from({ length: count }, (_, n) => makeListing({ id: `l-${n + 1}`, title: `Listing ${n + 1}` }));

describe("ResultsGrid (spec 4.6)", () => {
  it("lists the cards under a hidden Results heading, each with a numbered id", () => {
    const { container } = render(
      <ResultsGrid items={listings(3)} total={3} query={makeBrowseQuery()} campusNames={names} />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Results" })).toHaveClass("sr-only");
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(container.querySelector("li#r-3")).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("offers Show more when there are more, landing on the first new card", () => {
    render(
      <ResultsGrid items={listings(24)} total={36} query={makeBrowseQuery({ category: "tech" })} campusNames={names} />,
    );
    expect(screen.getByRole("link", { name: "Show more" })).toHaveAttribute("href", "/browse?cat=tech&n=48#r-25");
  });
});
```

Create `components/browse/BrowseEmpty.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { BrowseEmpty } from "./BrowseEmpty";

describe("BrowseEmpty (spec 4.7)", () => {
  it("always offers Looking For", () => {
    render(<BrowseEmpty query={makeBrowseQuery()} elsewhere={0} />);
    expect(screen.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask for it on Looking For" })).toHaveAttribute("href", "/looking-for");
    expect(screen.queryByText(/spelling/)).not.toBeInTheDocument();
  });

  it("suggests checking the spelling after a search", () => {
    render(<BrowseEmpty query={makeBrowseQuery({ q: "zebra", sort: "match" })} elsewhere={0} />);
    expect(screen.getByText("Check the spelling, or try a shorter word.")).toBeInTheDocument();
  });

  it("points to other campuses that have matches", () => {
    const { rerender } = render(<BrowseEmpty query={makeBrowseQuery({ campus: "mbombela" })} elsewhere={36} />);
    expect(screen.getByRole("link", { name: "36 more at other campuses" })).toHaveAttribute("href", "/browse?campus=all");
    rerender(<BrowseEmpty query={makeBrowseQuery({ campus: "mbombela" })} elsewhere={1} />);
    expect(screen.getByRole("link", { name: "1 more at another campus" })).toBeInTheDocument();
  });

  it("offers to clear the filters, keeping the campus", () => {
    render(
      <BrowseEmpty
        query={makeBrowseQuery({ campus: "midrand", campusFromLink: true, price: "free" })}
        elsewhere={0}
      />,
    );
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/browse?campus=midrand");
  });
});
```

Run: `pnpm test components/browse`
Expected: FAIL. The components don't exist.

- [ ] **Step 2: Write the components**

Create `components/browse/ActiveFilters.tsx`:

```tsx
import Link from "next/link";
import { CloseIcon } from "@/components/icons";
import { activeFilters, clearAllHref } from "@/lib/browse/filters";
import type { BrowseQuery } from "@/lib/types";

/** A chip for each active filter, and Clear all with two or more (spec 4.5). */
export function ActiveFilters({ query, campusNames }: { query: BrowseQuery; campusNames: ReadonlyMap<string, string> }) {
  const chips = activeFilters(query, campusNames);
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Active filters" className="filter-chips">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={chip.removeHref}
            prefetch={false}
            aria-label={`Remove filter: ${chip.label}`}
            className="filter-chip"
          >
            {chip.label}
            <CloseIcon className="size-4" />
          </Link>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <Link href={clearAllHref(query)} prefetch={false} className="filter-clear">
            Clear all
          </Link>
        </li>
      )}
    </ul>
  );
}
```

Create `components/browse/ResultsGrid.tsx`:

```tsx
import { ListingCard } from "@/components/listings/ListingCard";
import { browseHref } from "@/lib/browse/href";
import { PAGE_SIZE } from "@/lib/browse/query";
import type { BrowseQuery, Listing } from "@/lib/types";

type ResultsGridProps = {
  /** The listings to show: the first `query.shown` of the results. */
  items: readonly Listing[];
  total: number;
  query: BrowseQuery;
  campusNames: ReadonlyMap<string, string>;
};

/** The results (spec 4.6): cards in a grid, then Show more while there are more. */
export function ResultsGrid({ items, total, query, campusNames }: ResultsGridProps) {
  const next = `${browseHref(query, { shown: query.shown + PAGE_SIZE })}#r-${query.shown + 1}`;
  return (
    <section aria-labelledby="results-title">
      <h2 id="results-title" className="sr-only">
        Results
      </h2>
      <ul className="results-grid">
        {items.map((listing, index) => (
          <li key={listing.id} id={`r-${index + 1}`}>
            <ListingCard listing={listing} campusName={campusNames.get(listing.campusSlug) ?? ""} />
          </li>
        ))}
      </ul>
      {total > query.shown && (
        <p className="show-more">
          {/* A full page load, not <Link>: landing on #r-25 puts the keyboard's starting point on the first new card
              (spec 4.6, plan decision 4). */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href={next} className="btn btn-outline text-navy">
            Show more
          </a>
        </p>
      )}
    </section>
  );
}
```

If `pnpm lint` reports the disable comment as unused, delete that comment line.

Create `components/browse/BrowseEmpty.tsx`:

```tsx
import Link from "next/link";
import { ALL_CAMPUSES } from "@/lib/campus";
import { clearFiltersHref } from "@/lib/browse/filters";
import { browseHref } from "@/lib/browse/href";
import type { BrowseQuery } from "@/lib/types";

/** Nothing matches (spec 4.7). The tabs, toolbar and chips stay above it, so the viewer can change course. */
export function BrowseEmpty({ query, elsewhere }: { query: BrowseQuery; elsewhere: number }) {
  const filtered = Boolean(query.price || query.pay || query.deals);
  return (
    <section aria-labelledby="empty-title" className="browse-empty">
      <h2 id="empty-title" className="browse-empty-title">
        Nothing here yet
      </h2>
      {query.q && <p>Check the spelling, or try a shorter word.</p>}
      {query.campus !== ALL_CAMPUSES && elsewhere > 0 && (
        <p>
          <Link href={browseHref(query, { campus: ALL_CAMPUSES })} prefetch={false}>
            {elsewhere === 1 ? "1 more at another campus" : `${elsewhere} more at other campuses`}
          </Link>
        </p>
      )}
      {filtered && (
        <p>
          <Link href={clearFiltersHref(query)} prefetch={false}>
            Clear filters
          </Link>
        </p>
      )}
      <p>
        Can&apos;t find it? <Link href="/looking-for">Ask for it on Looking For</Link>
      </p>
    </section>
  );
}
```

Create `components/browse/BrowseError.tsx`:

```tsx
/** The search failed (spec section 8). "Try again" reloads the same results page, with no JavaScript. */
export function BrowseError({ href }: { href: string }) {
  return (
    <div className="section-error">
      <p>We couldn&apos;t load listings just now.</p>
      <a href={href} className="btn btn-outline text-navy">
        Try again
      </a>
    </div>
  );
}
```

(`BrowseError` is covered by Task 12's `BrowseView` test.)

Run: `pnpm test components/browse`
Expected: PASS.

- [ ] **Step 3: Add the CSS**

Add at the end of `app/globals.css`:

```css
/* --- Browse: chips, results, empty state (browse and listing plan, Task 11, spec 4.5 to 4.7) --- */
@layer components {
  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px 0 16px;
    border-radius: 999px;
    background: var(--color-pale);
    color: var(--color-navy);
    font-size: 13px;
    font-weight: 600;
  }

  .filter-clear {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding-inline: 6px;
    color: var(--color-sky-dark);
    font-size: 13px;
    font-weight: 600;
    text-decoration: underline 1.5px;
    text-underline-offset: 4px;
  }

  /* 2 columns on phones, 3 from the tablet step, 5 from the desktop step. Unlike the homepage's grid, nothing is
     hidden: every card the server sends shows. */
  .results-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 14px;
    margin-top: 20px;
  }

  .show-more {
    display: flex;
    justify-content: center;
    margin-top: 36px;
  }

  .browse-empty {
    display: grid;
    justify-items: start;
    gap: 10px;
    margin-top: 20px;
    padding: 28px 20px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  .browse-empty-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 24px;
    line-height: 1;
    text-transform: uppercase;
  }

  /* Navy on the grey panel: sky-dark is 4.25:1 there. */
  .browse-empty a {
    color: var(--color-navy);
    font-weight: 600;
    text-decoration: underline 1.5px;
    text-underline-offset: 4px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .results-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 28px 18px;
      margin-top: 24px;
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .results-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  /* Landscape phones keep the phone layout but get four cards a row, as the homepage does. */
  @media (orientation: landscape) and (max-height: 29.99rem) {
    .results-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
}
```

- [ ] **Step 4: Run the checks**

Run: `pnpm test`, `pnpm typecheck` and `pnpm lint`.
Expected: all pass.

- [ ] **Step 5: Hand over for commit**

Files: `components/browse/ActiveFilters.tsx`, `ActiveFilters.test.tsx`, `ResultsGrid.tsx`, `ResultsGrid.test.tsx`, `BrowseEmpty.tsx`, `BrowseEmpty.test.tsx`, `BrowseError.tsx`, `app/globals.css`.
Message: `feat: browse filter chips, results grid with Show more, and the empty and error states`

---

### Task 12: The browse page

Spec 4.1, 4.10, 7.1 and section 8.

**Files:**
- Create: `components/browse/BrowseView.tsx`, `BrowseView.test.tsx`
- Create: `components/browse/BrowseSkeleton.tsx`
- Modify: `app/browse/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/e2e/shell.spec.ts`, `tests/e2e/routes.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `components/browse/BrowseView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowseView } from "./BrowseView";

const viewer = vi.hoisted(() => ({ campus: "all" }));
const search = vi.hoisted(() => ({ failing: false }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    searchListings: async (query: Parameters<typeof actual.searchListings>[0]) => {
      if (search.failing) throw new Error("The search didn't run");
      return actual.searchListings(query);
    },
  };
});

afterEach(() => {
  viewer.campus = "all";
  search.failing = false;
});

const view = async (params: Record<string, string> = {}) =>
  render(await BrowseView({ searchParams: Promise.resolve(params) }));

describe("BrowseView (spec 4.1 to 4.7)", () => {
  it("shows a category with its tab current and its listings", async () => {
    await view({ cat: "tech" });
    expect(screen.getByRole("heading", { level: 1, name: "Tech" })).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Categories" });
    expect(within(tabs).getByRole("link", { name: "Tech" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.getByText("5 listings")).toBeInTheDocument();
  });

  it("starts on the viewer's campus, with a chip to see every campus", async () => {
    viewer.campus = "midrand";
    await view();
    expect(screen.getByRole("link", { name: "Remove filter: Midrand" })).toHaveAttribute("href", "/browse?campus=all");
    expect(screen.getAllByRole("article")).toHaveLength(14);
  });

  it("lets a campus in the link win over the viewer's", async () => {
    viewer.campus = "midrand";
    await view({ campus: "all" });
    expect(screen.queryByRole("link", { name: /^Remove filter/ })).not.toBeInTheDocument();
    expect(screen.getByText("Showing 24 of 36")).toBeInTheDocument();
  });

  it("shows the first 24, and Show more lands on the 25th", async () => {
    await view();
    expect(screen.getAllByRole("article")).toHaveLength(24);
    expect(screen.getByRole("link", { name: "Show more" })).toHaveAttribute("href", "/browse?n=48#r-25");
  });

  it("finds a search across every campus, best match first", async () => {
    await view({ q: "calculator" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("“calculator”");
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("offers other campuses when the viewer's has nothing", async () => {
    viewer.campus = "mbombela";
    await view();
    expect(screen.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "36 more at other campuses" })).toHaveAttribute("href", "/browse?campus=all");
  });

  it("says so when the search fails, with a link to try again", async () => {
    search.failing = true;
    await view({ cat: "food" });
    expect(screen.getByText("We couldn't load listings just now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/browse?cat=food");
    expect(screen.getByRole("heading", { level: 1, name: "Food" })).toBeInTheDocument();
  });
});
```

Run: `pnpm test components/browse/BrowseView.test.tsx`
Expected: FAIL. `./BrowseView` doesn't exist.

- [ ] **Step 2: Write the view, the skeleton and the page**

Create `components/browse/BrowseView.tsx`:

```tsx
import type { ReactNode } from "react";
import { getCampuses, getCategories, searchListings } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { browseHref } from "@/lib/browse/href";
import { knownSlugs, parseBrowseParams, toSearchQuery, type BrowseParams } from "@/lib/browse/query";
import { ActiveFilters } from "./ActiveFilters";
import { BrowseEmpty } from "./BrowseEmpty";
import { BrowseError } from "./BrowseError";
import { BrowseHeader } from "./BrowseHeader";
import { BrowseToolbar } from "./BrowseToolbar";
import { CategoryTabs } from "./CategoryTabs";
import { ResultsGrid } from "./ResultsGrid";

/**
 * The browse page's body (browse and listing spec 4). It reads the link and the viewer's campus, so it renders per
 * request, inside the page's <Suspense>. A failed search shows an error in the results' place; everything above it
 * still works.
 */
export async function BrowseView({ searchParams }: { searchParams: Promise<BrowseParams> }) {
  const [params, viewer, campuses, categories] = await Promise.all([
    searchParams,
    getViewerContext(),
    getCampuses(),
    getCategories(),
  ]);
  const query = parseBrowseParams(params, viewer.campus, knownSlugs(campuses, categories));
  const result = await searchListings(toSearchQuery(query)).catch(() => null);

  const categoryName = categories.find((category) => category.slug === query.category)?.name ?? null;
  const campusNames = new Map(campuses.map((campus) => [campus.slug, campus.name]));

  let results: ReactNode;
  if (result === null) results = <BrowseError href={browseHref(query)} />;
  else if (result.items.length === 0) results = <BrowseEmpty query={query} elsewhere={result.elsewhere} />;
  else {
    results = (
      <ResultsGrid
        items={result.items.slice(0, query.shown)}
        total={result.items.length}
        query={query}
        campusNames={campusNames}
      />
    );
  }

  return (
    <>
      <BrowseHeader query={query} categoryName={categoryName} />
      <CategoryTabs query={query} categories={categories} />
      <BrowseToolbar query={query} campuses={campuses} total={result ? result.items.length : null} />
      <ActiveFilters query={query} campusNames={campusNames} />
      {results}
    </>
  );
}
```

Create `components/browse/BrowseSkeleton.tsx`:

```tsx
import { ListingCardSkeleton } from "@/components/listings/ListingCard";

/** The browse page's shape while it streams in (spec section 8): the same sizes, so nothing jumps. */
export function BrowseSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="browse-head">
        <div>
          <span className="skeleton browse-skeleton-eyebrow" />
          <span className="skeleton browse-skeleton-title" />
        </div>
        <span className="skeleton browse-skeleton-search" />
      </div>
      <span className="skeleton browse-skeleton-tabs" />
      <span className="skeleton browse-skeleton-tools" />
      <ul className="results-grid">
        {Array.from({ length: 8 }, (_, n) => (
          <li key={n}>
            <ListingCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Replace `app/browse/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { BrowseSkeleton } from "@/components/browse/BrowseSkeleton";
import { BrowseView } from "@/components/browse/BrowseView";
import { browseHeading } from "@/lib/browse/heading";
import { knownSlugs, parseBrowseParams } from "@/lib/browse/query";
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses, getCategories } from "@/lib/data";

/**
 * The tab title follows the page: "Tech · Vossie", "“calculator” · Vossie" (spec 4.10). It reads searchParams, so it
 * streams with the page's request-time body. Search pages stay out of search engines; category pages are indexed.
 */
export async function generateMetadata({ searchParams }: PageProps<"/browse">): Promise<Metadata> {
  const [params, campuses, categories] = await Promise.all([searchParams, getCampuses(), getCategories()]);
  const query = parseBrowseParams(params, ALL_CAMPUSES, knownSlugs(campuses, categories));
  const categoryName = categories.find((category) => category.slug === query.category)?.name ?? null;
  return {
    title: browseHeading(query.q, categoryName).title,
    robots: query.q ? { index: false } : undefined,
  };
}

export default function BrowsePage({ searchParams }: PageProps<"/browse">) {
  return (
    <div className="page browse">
      <Suspense fallback={<BrowseSkeleton />}>
        <BrowseView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
```

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`, section "With Cache Components", before building. The page body reads request-time data, so the metadata streams with it; if `pnpm build` still reports this route, follow that section's instructions and say what you changed.

Run: `pnpm test components/browse`
Expected: PASS.

- [ ] **Step 3: Add the skeleton CSS**

Add at the end of `app/globals.css`:

```css
/* --- Browse: loading skeleton (browse and listing plan, Task 12, spec section 8) --- */
@layer components {
  .browse-skeleton-eyebrow {
    width: 5rem;
    height: calc(var(--text-eyebrow) * 1.1);
  }

  .browse-skeleton-title {
    width: 60%;
    height: var(--text-section);
    margin-top: 6px;
  }

  .browse-skeleton-search {
    order: -1;
    height: 48px;
    border-radius: 999px;
  }

  .browse-skeleton-tabs {
    height: 49px;
    margin-top: 22px;
  }

  .browse-skeleton-tools {
    width: 14rem;
    height: 44px;
    margin-top: 16px;
    border-radius: 999px;
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .browse-skeleton-search {
      order: 0;
    }
  }
}
```

- [ ] **Step 4: Update the e2e tests that knew the placeholder**

In `tests/e2e/shell.spec.ts`, in "submits to browse and remembers the search", change:

```ts
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Browse");
```

to:

```ts
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("“calculator”");
```

In `tests/e2e/routes.spec.ts`, remove `["/browse", "Browse"],` from `PLACEHOLDERS`.

- [ ] **Step 5: Run the checks and look at it**

Run: `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build`.
Expected: all pass. In the build output, `/browse` is partially prerendered (its shell static, its body per request).

Then run `pnpm e2e tests/e2e/shell.spec.ts tests/e2e/routes.spec.ts`.
Expected: PASS.

Look at it (see "Conventions"): `/browse`, `/browse?cat=tech`, `/browse?q=calculator`, `/browse?campus=mbombela`, and `/browse` with Filters open and then Sort open, at 390 × 844 and 1280 × 800. Check that:
- the search field sits above the title on the phone and beside it on desktop;
- the open Filters panel spans the width with Sort and the count below it;
- the cards line up 2 and 5 across;
- nothing overflows sideways at 390.

Report what you saw. Fix any spacing that's clearly off before handing over.

- [ ] **Step 6: Hand over for commit**

Files: `components/browse/BrowseView.tsx`, `BrowseView.test.tsx`, `BrowseSkeleton.tsx`, `app/browse/page.tsx`, `app/globals.css`, `tests/e2e/shell.spec.ts`, `tests/e2e/routes.spec.ts`.
Message: `feat: the browse page, server-rendered from the link, with its skeleton and tab titles`

---

### Task 13: Redirects, and links straight to browse

Spec 3.1 and 7.3; plan decisions 12 and 13.

**Files:**
- Modify: `next.config.ts`
- Remove: `app/categories/[slug]/page.tsx`, `app/c/[campus]/page.tsx`, `components/footer/ShopYourCampusLink.tsx` (approved in "Before you start")
- Modify: `components/home/ShopByCategory.tsx`, `ShopByCategory.test.tsx`
- Modify: `data/fixtures/hero.ts`, `data/fixtures/fixtures.test.ts`, `components/home/hero/Hero.test.tsx`
- Modify: `components/menu/MenuDrawer.tsx`, `MenuDrawer.test.tsx`
- Modify: `components/search/SearchOverlay.tsx`, `SearchOverlay.test.tsx`
- Modify: `components/footer/SiteFooter.tsx`, `SiteFooter.test.tsx`
- Modify: `tests/e2e/routes.spec.ts`

- [ ] **Step 1: Update the unit tests first**

Change these expectations (each file's test names stay):

| File | Old | New |
|---|---|---|
| `components/home/ShopByCategory.test.tsx` | `.startsWith("/categories/")` | `.startsWith("/browse?cat=")` |
| `components/home/ShopByCategory.test.tsx` | `"/categories/tech"` | `"/browse?cat=tech"` |
| `components/home/hero/Hero.test.tsx` | `"/categories/textbooks-notes"` | `"/browse?cat=textbooks-notes"` |
| `data/fixtures/fixtures.test.ts` | `` `/categories/${category.slug}` `` | `` `/browse?cat=${category.slug}` `` |
| `components/menu/MenuDrawer.test.tsx` | `toHaveAttribute("href", "/categories/tech")` | `toHaveAttribute("href", "/browse?cat=tech")` |
| `components/menu/MenuDrawer.test.tsx` | `name: "All campuses" })).toHaveAttribute("href", "/browse")` | `name: "All campuses" })).toHaveAttribute("href", "/browse?campus=all")` |
| `components/menu/MenuDrawer.test.tsx` | `toHaveAttribute("href", "/c/midrand")` | `toHaveAttribute("href", "/browse?campus=midrand")` |
| `components/search/SearchOverlay.test.tsx` | `"/categories/tech"` | `"/browse?cat=tech"` |
| `components/footer/SiteFooter.test.tsx` | `toHaveAttribute("href", "/c/online")` | `toHaveAttribute("href", "/browse?campus=online")` |

In `components/footer/SiteFooter.test.tsx`, replace the test `it("sends 'Shop your campus' to the chosen campus", …)` with:

```tsx
  it("keeps 'Shop your campus' on /browse, which opens on the chosen campus (plan decision 12)", () => {
    setCampusChoice("midrand");
    render(<SiteFooter campuses={campuses} />);
    expect(screen.getByRole("link", { name: "Shop your campus" })).toHaveAttribute("href", "/browse");
  });
```

Leave `components/home/hero/HeroRotator.test.tsx` alone: it builds its own slides.

Run: `pnpm test components data`
Expected: FAIL in each file above (the components still link to the old routes).

- [ ] **Step 2: Point the links at browse**

- `components/home/ShopByCategory.tsx`: the tile's `href` becomes `` `/browse?cat=${category.slug}` ``. Replace the comment above `BUDGETS` with `// Budget filters. \`max\` is browse's other name for \`price\` (browse and listing spec 3.2), so these links stay.`
- `data/fixtures/hero.ts`: the three CTA `href`s become `"/browse?cat=textbooks-notes"`, `"/browse?cat=tech"` and `"/browse?cat=services"`.
- `components/search/SearchOverlay.tsx`: the category link's `href` becomes `` `/browse?cat=${category.slug}` ``.
- `components/menu/MenuDrawer.tsx`: replace the two drill-down lists' items (plan decision 13) with:

```tsx
              <li>
                <Link href="/browse">Everything</Link>
              </li>
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link href={`/browse?cat=${category.slug}`}>{category.name}</Link>
                </li>
              ))}
```

and

```tsx
              <li>
                <Link href="/browse?campus=all">All campuses</Link>
              </li>
              {campuses.map((campus) => (
                <li key={campus.slug}>
                  <Link href={`/browse?campus=${campus.slug}`}>
                    {campus.name}
                    <span className="sr-only">,</span>{" "}
                    <span className="menu-sublink-detail">{campus.region}</span>
                  </Link>
                </li>
              ))}
```

  `NavLink` stays imported: the menu's main links still use it.
- `components/footer/SiteFooter.tsx`:
  - the three category links become `/browse?cat=textbooks-notes`, `/browse?cat=tech` and `/browse?cat=services`;
  - the campus links become `` `/browse?campus=${campus.slug}` ``;
  - replace `<ShopYourCampusLink campuses={campuses} />` with:

```tsx
          {/* /browse opens on the chosen campus by itself, so this needs no client code (plan decision 12). */}
          <Link href="/browse" className="footer-giant">
            Shop your campus
            <ArrowUpRightIcon className="footer-giant-arrow" />
          </Link>
```

  - remove the `ShopYourCampusLink` import. `Link` and `ArrowUpRightIcon` are already imported there; check, and add them if not.

Run `ls components/footer/ShopYourCampusLink.tsx` and `grep -rn ShopYourCampusLink app components`. When the grep finds nothing, remove the file: `rm components/footer/ShopYourCampusLink.tsx`.

Run: `pnpm test components data`
Expected: PASS.

- [ ] **Step 3: Add the redirects and remove the old pages**

Read `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md` first. Then add to `nextConfig` in `next.config.ts`, after `images`:

```ts
  // The old category and campus pages are now browse views (browse and listing spec 3.1). Temporary (307), so either
  // can get its own page later, such as a campus home. A redirect keeps the request's own query as well.
  async redirects() {
    return [
      { source: "/categories/:slug", destination: "/browse?cat=:slug", permanent: false },
      { source: "/c/:campus", destination: "/browse?campus=:campus", permanent: false },
    ];
  },
```

Check, then remove the two placeholder pages (approved in "Before you start"):
1. `ls -R app/categories app/c`: expect only the two `page.tsx` files.
2. `rm "app/categories/[slug]/page.tsx"`, then `rm "app/c/[campus]/page.tsx"`.
3. `rmdir "app/categories/[slug]" app/categories "app/c/[campus]" app/c`. `rmdir` only removes empty folders, so it stops if anything unexpected is left.

- [ ] **Step 4: Update the route tests**

In `tests/e2e/routes.spec.ts`:

1. Remove these rows from `PLACEHOLDERS`: `["/c/midrand", "Midrand"]`, `["/c/online", "Eduvos Online"]`, `["/categories/tech", "Tech"]`, `["/categories/textbooks-notes", "Textbooks & notes"]`.
2. In "unknown campus, category, listing, collection and seller slugs show the 404 page", remove the `/c/atlantis` and `/categories/spaceships` steps, and rename the test "unknown listing, collection and seller slugs show the 404 page".
3. Add inside the `describe`:

```ts
  test("old category and campus links open browse (spec 3.1)", async ({ page }) => {
    onlyAtPhoneAndDesktop();
    await page.goto("/categories/tech");
    await expect(page).toHaveURL(/\/browse\?cat=tech$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech");
    await page.goto("/c/midrand");
    await expect(page).toHaveURL(/\/browse\?campus=midrand$/);
    await expect(page.getByRole("link", { name: "Remove filter: Midrand" })).toBeVisible();
    // An unknown campus is ignored, so the link still shows results.
    await page.goto("/c/atlantis");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Everything");
  });
```

- [ ] **Step 5: Run the checks**

Run: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, then `pnpm e2e tests/e2e/routes.spec.ts tests/e2e/shell.spec.ts tests/e2e/home.spec.ts`.
Expected: all pass. The build lists no `/categories/[slug]` or `/c/[campus]` routes.

- [ ] **Step 6: Hand over for commit**

Files: `next.config.ts`, the three removed files (and their empty folders), `components/home/ShopByCategory.tsx`, `ShopByCategory.test.tsx`, `data/fixtures/hero.ts`, `data/fixtures/fixtures.test.ts`, `components/home/hero/Hero.test.tsx`, `components/menu/MenuDrawer.tsx`, `MenuDrawer.test.tsx`, `components/search/SearchOverlay.tsx`, `SearchOverlay.test.tsx`, `components/footer/SiteFooter.tsx`, `SiteFooter.test.tsx`, `tests/e2e/routes.spec.ts`.
Message: `feat: category and campus routes redirect to browse; menu, footer, search and tiles link straight to it`

---

### Task 14: Listing photos, availability banner, collect box and campus note

Spec 5.1, 5.3, 5.5 and 5.6.

**Files:**
- Create: `components/listing/Gallery.tsx`, `Gallery.test.tsx`
- Create: `components/listing/AvailabilityBanner.tsx`
- Create: `components/listing/CollectBox.tsx`, `CollectBox.test.tsx`
- Create: `components/listing/CampusNote.tsx`, `CampusNote.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing tests**

Create `components/listing/Gallery.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import { Gallery } from "./Gallery";

const threePhotos = makeListing({
  title: "Casio calculator",
  image: { src: "/placeholders/listing/tech.svg", alt: "Casio calculator" },
  morePhotos: [
    { src: "/placeholders/photo/2.svg", alt: "The back" },
    { src: "/placeholders/photo/3.svg", alt: "The cover" },
  ],
});

describe("Gallery (spec 5.6)", () => {
  it("puts several photos in a labelled region you can scroll from the keyboard", () => {
    render(<Gallery listing={threePhotos} />);
    const region = screen.getByRole("region", { name: "Photos" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(within(region).getAllByRole("img").map((image) => image.getAttribute("alt"))).toEqual([
      "Casio calculator. Photo 1 of 3",
      "The back. Photo 2 of 3",
      "The cover. Photo 3 of 3",
    ]);
  });

  it("loads the cover first and the rest lazily", () => {
    render(<Gallery listing={threePhotos} />);
    const images = within(screen.getByRole("region", { name: "Photos" })).getAllByRole("img");
    expect(images[0]).toHaveAttribute("loading", "eager");
    expect(images[1]).toHaveAttribute("loading", "lazy");
  });

  it("keeps the extra photos behind a button for data saver", () => {
    const { container } = render(<Gallery listing={threePhotos} />);
    expect(container.querySelector(".gallery-saver > summary")).toHaveTextContent("Show 2 more photos");
  });

  it("is a single photo with no region or count when there's only the cover", () => {
    const { container } = render(<Gallery listing={makeListing({ title: "Kettle" })} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Test listing");
    expect(container.querySelector(".gallery-saver")).toBeNull();
  });
});
```

Create `components/listing/CollectBox.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollectBox, collectCopy } from "./CollectBox";

describe("collectCopy (spec 5.3)", () => {
  it("words each way of handing over", () => {
    expect(collectCopy("pickup", "Midrand", "Library entrance")).toEqual({
      heading: "Collect at Midrand · Library entrance",
      line: "See it before you pay, and pay when you collect.",
    });
    expect(collectCopy("on-campus", "Midrand", null)).toEqual({
      heading: "On campus at Midrand",
      line: "Agree a time and place when you message.",
    });
    expect(collectCopy("on-campus-or-online", "Pretoria", null)).toEqual({
      heading: "On campus at Pretoria, or online",
      line: "Agree how when you message.",
    });
    expect(collectCopy("online", "Eduvos Online", null)).toEqual({
      heading: "Online",
      line: "Done online, from anywhere.",
    });
  });
});

describe("CollectBox", () => {
  it("shows the heading and line, with room for the campus note", () => {
    render(
      <CollectBox handover="pickup" campusName="Midrand" pickupPointName="Library entrance">
        <p>Note</p>
      </CollectBox>,
    );
    expect(screen.getByText("Collect at Midrand · Library entrance")).toBeInTheDocument();
    expect(screen.getByText("Note")).toBeInTheDocument();
  });
});
```

Create `components/listing/CampusNote.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampusNote } from "./CampusNote";

const viewer = vi.hoisted(() => ({ campus: "pretoria" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

afterEach(() => {
  viewer.campus = "pretoria";
});

const atMidrand = { campusSlug: "midrand", campusName: "Midrand" } as const;

describe("CampusNote (spec 5.3)", () => {
  it("says when a pickup isn't at the viewer's campus", async () => {
    render((await CampusNote({ ...atMidrand, handover: "pickup" }))!);
    expect(
      screen.getByText(
        "Midrand isn't your chosen campus (Pretoria), so you'd go there for this. Delivery between campuses isn't available yet.",
      ),
    ).toBeInTheDocument();
  });

  it("says so for services that happen on campus too", async () => {
    expect(await CampusNote({ ...atMidrand, handover: "on-campus" })).not.toBeNull();
  });

  it("stays quiet at the viewer's own campus, with no campus chosen, and for anything online", async () => {
    viewer.campus = "midrand";
    expect(await CampusNote({ ...atMidrand, handover: "pickup" })).toBeNull();
    viewer.campus = "all";
    expect(await CampusNote({ ...atMidrand, handover: "pickup" })).toBeNull();
    viewer.campus = "pretoria";
    expect(await CampusNote({ ...atMidrand, handover: "online" })).toBeNull();
    expect(await CampusNote({ ...atMidrand, handover: "on-campus-or-online" })).toBeNull();
  });
});
```

Run: `pnpm test components/listing`
Expected: FAIL. The components don't exist.

- [ ] **Step 2: Write the components**

Create `components/listing/Gallery.tsx`:

```tsx
import { Photo } from "@/components/listings/Photo";
import { cx } from "@/lib/cx";
import type { Listing } from "@/lib/types";

const COVER_SIZES =
  "(min-width: 64rem) and (min-height: 30rem) 720px, (min-width: 48rem) and (min-height: 30rem) 80vw, 100vw";
const MORE_SIZES =
  "(min-width: 64rem) and (min-height: 30rem) 360px, (min-width: 48rem) and (min-height: 30rem) 70vw, 88vw";

/**
 * The listing's photos (spec 5.6). Phones: a strip you swipe, with the next photo's edge peeking in. Desktop: the
 * cover large and the rest two to a row (plan decision 9's layout). With data saver on, only the cover loads; the
 * rest wait behind "Show 2 more photos".
 */
export function Gallery({ listing }: { listing: Pick<Listing, "image" | "morePhotos"> }) {
  const photos = [listing.image, ...listing.morePhotos];
  const count = photos.length;
  const many = count > 1;
  const more = count - 1;
  const alt = (index: number) => (many ? `${photos[index].alt}. Photo ${index + 1} of ${count}` : photos[index].alt);

  return (
    <div className="gallery">
      {/* A scrolling region must be reachable from the keyboard (axe: scrollable-region-focusable). */}
      <div
        className={cx("gallery-strip", many && "gallery-strip-many")}
        role={many ? "region" : undefined}
        aria-label={many ? "Photos" : undefined}
        tabIndex={many ? 0 : undefined}
      >
        <ul className="gallery-list">
          {photos.map((photo, index) => (
            <li key={`${photo.src} ${index}`} className={cx("gallery-item", index > 0 && "gallery-more")}>
              <Photo
                image={{ src: photo.src, alt: alt(index) }}
                ratio="1 / 1"
                sizes={index === 0 ? COVER_SIZES : MORE_SIZES}
                priority={index === 0}
                className="gallery-photo"
              />
            </li>
          ))}
        </ul>
      </div>
      {many && (
        <>
          <p className="gallery-count" aria-hidden="true">
            {count} photos
          </p>
          {/* Shown only with data saver on, in place of the strip's extra photos (spec 5.6). */}
          <details className="gallery-saver">
            <summary className="btn btn-outline text-navy">
              Show {more} more {more === 1 ? "photo" : "photos"}
            </summary>
            <ul className="gallery-saver-list">
              {photos.slice(1).map((photo, index) => (
                <li key={`${photo.src} ${index}`}>
                  <Photo image={{ src: photo.src, alt: alt(index + 1) }} ratio="1 / 1" sizes={MORE_SIZES} />
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
```

Create `components/listing/AvailabilityBanner.tsx`:

```tsx
import type { Availability } from "@/lib/types";

/** Paused or sold (spec 5.5). The page stays up, so shared links never dead-end. */
export function AvailabilityBanner({ availability }: { availability: Availability }) {
  if (availability === "available") return null;
  return <p className="availability-banner">{availability === "sold" ? "Sold" : "Not taking orders right now"}</p>;
}
```

Create `components/listing/CollectBox.tsx`:

```tsx
import type { ReactNode } from "react";
import { MapPinIcon } from "@/components/icons";
import type { Handover } from "@/lib/types";

/** Where and how the listing changes hands, in words (spec 5.3). */
export function collectCopy(
  handover: Handover,
  campusName: string,
  pickupPointName: string | null,
): { heading: string; line: string } {
  switch (handover) {
    case "pickup":
      return {
        heading: pickupPointName ? `Collect at ${campusName} · ${pickupPointName}` : `Collect at ${campusName}`,
        line: "See it before you pay, and pay when you collect.",
      };
    case "on-campus":
      return { heading: `On campus at ${campusName}`, line: "Agree a time and place when you message." };
    case "on-campus-or-online":
      return { heading: `On campus at ${campusName}, or online`, line: "Agree how when you message." };
    case "online":
      return { heading: "Online", line: "Done online, from anywhere." };
  }
}

type CollectBoxProps = {
  handover: Handover;
  campusName: string;
  pickupPointName: string | null;
  /** The campus note, when there is one. */
  children?: ReactNode;
};

/** The collect box (spec 5.3). */
export function CollectBox({ handover, campusName, pickupPointName, children }: CollectBoxProps) {
  const { heading, line } = collectCopy(handover, campusName, pickupPointName);
  return (
    <div className="collect-box">
      <MapPinIcon className="collect-icon size-5" />
      <div>
        <p className="collect-heading">{heading}</p>
        <p className="collect-line">{line}</p>
        {children}
      </div>
    </div>
  );
}
```

Create `components/listing/CampusNote.tsx`:

```tsx
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import type { Handover } from "@/lib/types";

type CampusNoteProps = {
  campusSlug: string;
  campusName: string;
  handover: Handover;
};

/**
 * "Midrand isn't your chosen campus…" (spec 5.3): only for things you go somewhere for, and only when the viewer has
 * chosen another campus. It reads the campus cookie, so it sits inside <Suspense> and renders per request: the only
 * part of a listing page that does. For anything online it returns before reading the cookie, so that page stays
 * fully prerendered.
 */
export async function CampusNote({ campusSlug, campusName, handover }: CampusNoteProps) {
  if (handover !== "pickup" && handover !== "on-campus") return null;
  const { campus } = await getViewerContext();
  if (campus === ALL_CAMPUSES || campus === campusSlug) return null;
  const campuses = await getCampuses().catch(() => null);
  const yours = campuses?.find((item) => item.slug === campus)?.name;
  if (!yours) return null;
  return (
    <p className="campus-note">
      {campusName} isn&apos;t your chosen campus ({yours}), so you&apos;d go there for this. Delivery between campuses
      isn&apos;t available yet.
    </p>
  );
}
```

Run: `pnpm test components/listing`
Expected: PASS.

- [ ] **Step 3: Add the CSS**

Add at the end of `app/globals.css`:

```css
/* --- Listing: photos, banner and collect box (browse and listing plan, Task 14, spec 5.3, 5.5, 5.6) --- */
@layer components {
  /* Phones: edge to edge. The page's gutters are 16px (Task 16), so the strip pulls out by that much. */
  .gallery {
    margin-inline: -16px;
  }

  .gallery-strip {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }

  .gallery-strip::-webkit-scrollbar {
    display: none;
  }

  .gallery-strip:focus-visible {
    outline-offset: -3px;
  }

  .gallery-list {
    display: flex;
    gap: 8px;
  }

  .gallery-item {
    flex: 0 0 100%;
    scroll-snap-align: start;
  }

  /* The next photo's edge peeks in, so it's clear there are more. */
  .gallery-strip-many .gallery-item {
    flex-basis: 88%;
  }

  .gallery-count {
    margin: 10px 16px 0;
    color: var(--color-muted);
    font-size: 12px;
  }

  .gallery-saver {
    display: none;
  }

  .gallery-saver > summary {
    list-style: none;
    cursor: pointer;
  }

  .gallery-saver > summary::-webkit-details-marker {
    display: none;
  }

  .gallery-saver-list {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  /* Data saver (spec 5.6): only the cover loads. Hidden lazy images are never fetched. */
  :root[data-low-data] .gallery-more,
  :root[data-low-data] .gallery-count {
    display: none;
  }

  :root[data-low-data] .gallery-strip-many .gallery-item {
    flex-basis: 100%;
  }

  :root[data-low-data] .gallery-saver {
    display: block;
    margin: 12px 16px 0;
  }

  .availability-banner {
    padding: 12px 16px;
    border-radius: var(--radius-card);
    background: var(--color-pale);
    color: var(--color-navy);
    font-weight: 700;
  }

  .collect-box {
    display: flex;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
  }

  .collect-icon {
    flex: none;
    margin-top: 2px;
    color: var(--color-navy);
  }

  .collect-heading {
    color: var(--color-navy);
    font-weight: 700;
  }

  .collect-line {
    margin-top: 2px;
    color: var(--color-muted);
    font-size: 14px;
  }

  .campus-note {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--color-line);
    color: var(--color-ink);
    font-size: 14px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .gallery {
      margin-inline: 0;
    }

    .gallery-photo {
      border-radius: var(--radius-card);
    }

    .gallery-count,
    :root[data-low-data] .gallery-saver {
      margin-inline: 0;
    }
  }

  /* Desktop: the cover large, the rest two to a row; nothing scrolls sideways. */
  @media (min-width: 64rem) and (min-height: 30rem) {
    .gallery-strip {
      overflow: visible;
    }

    .gallery-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .gallery-item:first-child {
      grid-column: 1 / -1;
    }

    .gallery-count {
      display: none;
    }
  }
}
```

- [ ] **Step 4: Run the checks**

Run: `pnpm test`, `pnpm typecheck` and `pnpm lint`.
Expected: all pass.

- [ ] **Step 5: Hand over for commit**

Files: `components/listing/Gallery.tsx`, `Gallery.test.tsx`, `AvailabilityBanner.tsx`, `CollectBox.tsx`, `CollectBox.test.tsx`, `CampusNote.tsx`, `CampusNote.test.tsx`, `app/globals.css`.
Message: `feat: listing photos with a data saver fallback, the collect box, the campus note and the paused or sold banner`

---

### Task 15: Message, Save and Share, and the phone dock

Spec 5.4 and 5.8.

**Files:**
- Create: `lib/share.ts`, `lib/share.test.ts`
- Create: `components/listing/ShareButton.tsx`, `ShareButton.test.tsx`
- Create: `components/listing/ListingActions.tsx`, `ListingActions.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing tests**

Create `lib/share.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareLink } from "./share";

const define = (name: "share" | "clipboard", value: unknown) =>
  Object.defineProperty(navigator, name, { configurable: true, value });

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("shareLink (spec 5.8)", () => {
  it("uses the share sheet where there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    define("share", share);
    expect(await shareLink("Casio calculator", "https://vossie.example/listings/l-001")).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Casio calculator", url: "https://vossie.example/listings/l-001" });
  });

  it("treats closing the share sheet as cancelled, not failed", async () => {
    define("share", vi.fn().mockRejectedValue(new DOMException("Closed", "AbortError")));
    expect(await shareLink("x", "https://vossie.example")).toBe("cancelled");
  });

  it("copies the link where there's no share sheet, or the share sheet fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    define("clipboard", { writeText });
    expect(await shareLink("x", "https://vossie.example/a")).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://vossie.example/a");

    define("share", vi.fn().mockRejectedValue(new Error("Not allowed")));
    expect(await shareLink("x", "https://vossie.example/b")).toBe("copied");
  });

  it("fails when it can neither share nor copy", async () => {
    define("clipboard", { writeText: vi.fn().mockRejectedValue(new Error("Denied")) });
    expect(await shareLink("x", "https://vossie.example")).toBe("failed");
    Reflect.deleteProperty(navigator, "clipboard");
    expect(await shareLink("x", "https://vossie.example")).toBe("failed");
  });
});
```

Create `components/listing/ShareButton.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShareOutcome } from "@/lib/share";
import { getToast } from "@/lib/toast";
import { ShareButton } from "./ShareButton";

const outcome = vi.hoisted(() => ({ value: "copied" as ShareOutcome }));

vi.mock("@/lib/share", () => ({ shareLink: vi.fn(async () => outcome.value) }));

afterEach(() => {
  outcome.value = "copied";
});

describe("ShareButton (spec 5.8)", () => {
  it("says the link was copied", async () => {
    render(<ShareButton title="Casio calculator" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(getToast()?.message).toBe("Link copied"));
  });

  it("says to copy from the address bar when it couldn't share", async () => {
    outcome.value = "failed";
    render(<ShareButton title="Casio calculator" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(getToast()?.message).toBe("Couldn't share. Copy the link from your address bar."));
  });

  it("stays quiet after the share sheet, whether it was used or closed", async () => {
    outcome.value = "cancelled";
    render(<ShareButton title="Casio calculator" />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(getToast()).toBeNull();
  });
});
```

Create `components/listing/ListingActions.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import { ListingActions } from "./ListingActions";

describe("ListingActions (spec 5.4, 5.5)", () => {
  it("messages the seller through sign-in, and saves and shares", () => {
    render(<ListingActions listing={makeListing({ id: "l-001", title: "Casio calculator" })} />);
    expect(screen.getByRole("link", { name: "Message seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Flistings%2Fl-001",
    );
    expect(screen.getByRole("button", { name: "Save Casio calculator" })).toHaveClass("save-heart-inline");
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("offers similar items instead when the listing is sold or paused", () => {
    render(<ListingActions listing={makeListing({ availability: "sold", categorySlug: "tech" })} />);
    expect(screen.queryByRole("link", { name: "Message seller" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See similar items" })).toHaveAttribute("href", "/browse?cat=tech");
  });
});
```

Run: `pnpm test lib/share.test.ts components/listing`
Expected: FAIL. `lib/share`, `ShareButton` and `ListingActions` don't exist.

- [ ] **Step 2: Write the code**

Create `lib/share.ts`:

```ts
export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

/**
 * Share a page (spec 5.8): the phone's share sheet where there is one, otherwise copy the link. Closing the share
 * sheet isn't a failure; any other share error falls back to copying.
 */
export async function shareLink(title: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
```

Create `components/listing/ShareButton.tsx`:

```tsx
"use client";

import { ShareIcon } from "@/components/icons";
import { shareLink } from "@/lib/share";
import { showToast } from "@/lib/toast";

/** Share (spec 5.8): the share sheet, or a copied link with a toast to say so. */
export function ShareButton({ title }: { title: string }) {
  async function onClick() {
    const outcome = await shareLink(title, window.location.href);
    if (outcome === "copied") showToast("Link copied");
    if (outcome === "failed") showToast("Couldn't share. Copy the link from your address bar.");
  }

  return (
    <button type="button" onClick={onClick} aria-label="Share" className="icon-btn listing-share">
      <ShareIcon className="size-5" />
    </button>
  );
}
```

Create `components/listing/ListingActions.tsx`:

```tsx
import Link from "next/link";
import { SaveHeart } from "@/components/listings/SaveHeart";
import type { Listing } from "@/lib/types";
import { ShareButton } from "./ShareButton";

/**
 * Message seller, Save and Share (spec 5.4). One set of actions: below the tablet step, CSS fixes them to the bottom
 * of the screen as the dock; from it, they sit in the page. Message leads to the sign-in page, which says sign-in is
 * coming (decision 44). A paused or sold listing offers similar items instead (spec 5.5).
 */
export function ListingActions({
  listing,
}: {
  listing: Pick<Listing, "id" | "title" | "categorySlug" | "availability">;
}) {
  const signIn = `/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`;
  return (
    <div className="listing-actions">
      {listing.availability === "available" ? (
        <Link href={signIn} prefetch={false} className="btn btn-primary listing-message">
          Message seller
        </Link>
      ) : (
        <Link href={`/browse?cat=${listing.categorySlug}`} className="btn btn-outline text-navy listing-message">
          See similar items
        </Link>
      )}
      <SaveHeart id={listing.id} title={listing.title} className="save-heart-inline" />
      <ShareButton title={listing.title} />
    </div>
  );
}
```

Run: `pnpm test lib/share.test.ts components/listing`
Expected: PASS.

- [ ] **Step 3: Add the CSS**

Add at the end of `app/globals.css`:

```css
/* --- Listing: actions and the phone dock (browse and listing plan, Task 15, spec 5.4) --- */
@layer components {
  .listing-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .listing-message {
    flex: 1;
    min-height: 48px;
  }

  /* The Save heart in the action bar, not over a card photo. */
  .save-heart-inline {
    position: static;
    flex: none;
    border: 1.5px solid var(--color-navy);
  }

  .listing-share {
    flex: none;
    border: 1.5px solid var(--color-navy);
  }

  /* Below the tablet step: the dock. The same actions, fixed to the bottom of the screen, clear of the iPhone home
     bar. The page keeps room under the footer and under anything focused, so the dock never covers either (WCAG
     2.4.11). Toasts sit above it. */
  @media not all and (min-width: 48rem) and (min-height: 30rem) {
    .listing-actions {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 30;
      padding: 10px max(12px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom))
        max(12px, env(safe-area-inset-left));
      border-top: 1px solid var(--color-line);
      background: var(--color-white);
    }

    body:has(.listing-actions) {
      padding-bottom: calc(69px + env(safe-area-inset-bottom));
    }

    body:has(.listing-actions) :is(main, footer),
    body:has(.listing-actions) :is(main, footer) * {
      scroll-margin-bottom: calc(84px + env(safe-area-inset-bottom));
    }

    body:has(.listing-actions) .toast-pop {
      bottom: calc(84px + env(safe-area-inset-bottom));
    }
  }
}
```

- [ ] **Step 4: Run the checks**

Run: `pnpm test`, `pnpm typecheck` and `pnpm lint`.
Expected: all pass.

- [ ] **Step 5: Hand over for commit**

Files: `lib/share.ts`, `lib/share.test.ts`, `components/listing/ShareButton.tsx`, `ShareButton.test.tsx`, `ListingActions.tsx`, `ListingActions.test.tsx`, `app/globals.css`.
Message: `feat: listing actions (message through sign-in, save, share) and the phone dock`

---

### Task 16: The listing page

Spec 5.1, 5.2, 5.7 and 5.8; plan decision 9. **JS ledger.**

**Files:**
- Create: `components/listing/SellerCard.tsx`, `ListingFacts.tsx`, `SafetyNote.tsx`, `MoreFrom.tsx`, `MoreFrom.test.tsx`
- Create: `components/listing/ListingView.tsx`, `ListingView.test.tsx`
- Modify: `app/listings/[id]/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/e2e/routes.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `components/listing/MoreFrom.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getListingDetail } from "@/lib/data";
import { MoreFrom } from "./MoreFrom";

const more = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getMoreFrom: async (...args: Parameters<typeof actual.getMoreFrom>) => {
      if (more.mode === "failing") throw new Error("Didn't load");
      if (more.mode === "empty") return { from: "seller" as const, items: [] };
      return actual.getMoreFrom(...args);
    },
  };
});

afterEach(() => {
  more.mode = "real";
});

const names = new Map([["midrand", "Midrand"]]);

async function forCalculator() {
  const listing = (await getListingDetail("l-001"))!.listing;
  return MoreFrom({ listing, sellerName: "Tech corner", categoryName: "Tech", campusNames: names });
}

describe("MoreFrom (spec 5.7)", () => {
  it("shows more from the seller", async () => {
    render((await forCalculator())!);
    expect(screen.getByRole("heading", { level: 2, name: "More from Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gaming headset, barely used" })).toHaveAttribute("href", "/listings/l-007");
  });

  it("is hidden when there's nothing to show", async () => {
    more.mode = "empty";
    expect(await forCalculator()).toBeNull();
  });

  it("shows its own error, with a way back to this listing", async () => {
    more.mode = "failing";
    render((await forCalculator())!);
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/listings/l-001?retry=more-from#more-from");
  });
});
```

Create `components/listing/ListingView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getListingDetail } from "@/lib/data";
import { ListingView } from "./ListingView";

// Async parts are tested on their own; here they stand in (jsdom can't render async components in a tree).
vi.mock("./MoreFrom", () => ({ MoreFrom: () => <section aria-label="More from, stood in" /> }));
vi.mock("./CampusNote", () => ({ CampusNote: () => null }));

const names = new Map([["midrand", "Midrand"]]);

async function show(id: string) {
  render(<ListingView detail={(await getListingDetail(id))!} campusNames={names} />);
}

describe("ListingView (spec 5.1)", () => {
  it("leads with the breadcrumb, title, price and actions", async () => {
    await show("l-001");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
    expect(within(crumbs).getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/browse?cat=tech");
    expect(screen.getByRole("heading", { level: 1, name: "Casio fx-991ZA Plus calculator" })).toBeInTheDocument();
    expect(screen.getByText("R250")).toHaveClass("listing-page-price");
    expect(screen.getByRole("link", { name: "Message seller" })).toBeInTheDocument();
  });

  it("shows where to collect it, who's selling, the description and the facts", async () => {
    await show("l-001");
    expect(screen.getByText("Collect at Midrand · Library entrance")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See their shop" })).toHaveAttribute("href", "/sellers/tech-corner");
    expect(screen.getByRole("heading", { level: 2, name: "About this" })).toBeInTheDocument();
    expect(screen.getByText(/Approved for Eduvos maths and stats exams/)).toBeInTheDocument();
    expect(screen.getByText("Like new")).toBeInTheDocument();
    expect(screen.getByText("12 October 2026")).toHaveAttribute("datetime", "2026-10-12T07:40:00Z");
    expect(screen.getByRole("link", { name: "Safety tips" })).toHaveAttribute("href", "/safety");
  });

  it("shows the photos, more from the seller and the report link", async () => {
    await show("l-001");
    expect(within(screen.getByRole("region", { name: "Photos" })).getAllByRole("img")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "More from, stood in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Report this listing" })).toHaveAttribute(
      "href",
      "/login?next=%2Flistings%2Fl-001",
    );
  });

  it("shows swap terms and the cash-or-swap price", async () => {
    await show("l-007");
    expect(screen.getByText("R450 or swap")).toBeInTheDocument();
    expect(screen.getByText(/a mechanical keyboard or a Bluetooth speaker/)).toBeInTheDocument();
  });

  it("marks a sold listing and offers similar items", async () => {
    await show("l-026");
    expect(screen.getByText("Sold")).toHaveClass("availability-banner");
    expect(screen.getByRole("link", { name: "See similar items" })).toHaveAttribute("href", "/browse?cat=tech");
  });

  it("leaves the condition out for a service", async () => {
    await show("l-004");
    expect(screen.queryByText("Condition")).not.toBeInTheDocument();
    expect(screen.getByText("On campus at Midrand")).toBeInTheDocument();
  });
});
```

Run: `pnpm test components/listing`
Expected: FAIL. `MoreFrom` and `ListingView` don't exist.

- [ ] **Step 2: Write the components**

Create `components/listing/SellerCard.tsx`:

```tsx
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { Photo } from "@/components/listings/Photo";
import { badgeLabel } from "@/lib/format";
import type { Seller, TrustBadge } from "@/lib/types";

type SellerCardProps = {
  seller: Seller;
  badge: TrustBadge | null;
  campusName: string;
};

/** Who's selling (spec 5.1): photo, name, Verified, trust badge, campus and their shop. */
export function SellerCard({ seller, badge, campusName }: SellerCardProps) {
  return (
    <section aria-labelledby="seller-title" className="listing-seller">
      <Photo image={{ src: seller.image.src, alt: "" }} ratio="1 / 1" sizes="56px" className="listing-seller-photo" />
      <div className="listing-seller-body">
        <p className="listing-seller-eyebrow">Listed by</p>
        <h2 id="seller-title" className="listing-seller-name">
          {seller.name}
        </h2>
        <p className="listing-seller-meta">{campusName}</p>
        {(seller.verified || badge) && (
          <p className="listing-seller-marks">
            {seller.verified && (
              <span className="listing-verified">
                <CheckIcon className="size-4" />
                Verified by the Hub
              </span>
            )}
            {badge && <span className="listing-badge">{badgeLabel(badge)}</span>}
          </p>
        )}
        <Link href={`/sellers/${seller.slug}`} className="listing-seller-link">
          See their shop
        </Link>
      </div>
    </section>
  );
}
```

Create `components/listing/ListingFacts.tsx`:

```tsx
import Link from "next/link";
import { conditionLabel } from "@/lib/format";
import { longSastDate } from "@/lib/time";
import type { Listing } from "@/lib/types";

type ListingFactsProps = {
  listing: Pick<Listing, "categorySlug" | "condition" | "createdAt">;
  categoryName: string;
  campusName: string;
};

/** The facts (spec 5.1). "Listed" is a date in SAST, not "2 hours ago", so the page needs no clock. */
export function ListingFacts({ listing, categoryName, campusName }: ListingFactsProps) {
  return (
    <dl className="listing-facts">
      <div>
        <dt>Category</dt>
        <dd>
          <Link href={`/browse?cat=${listing.categorySlug}`} prefetch={false}>
            {categoryName}
          </Link>
        </dd>
      </div>
      {listing.condition && (
        <div>
          <dt>Condition</dt>
          <dd>{conditionLabel(listing.condition)}</dd>
        </div>
      )}
      <div>
        <dt>Campus</dt>
        <dd>{campusName}</dd>
      </div>
      <div>
        <dt>Listed</dt>
        <dd>
          <time dateTime={listing.createdAt}>{longSastDate(listing.createdAt)}</time>
        </dd>
      </div>
    </dl>
  );
}
```

Create `components/listing/SafetyNote.tsx`:

```tsx
import Link from "next/link";
import { ShieldIcon } from "@/components/icons";

/** The safety note (spec 5.1). */
export function SafetyNote() {
  return (
    <aside aria-label="Safety" className="safety-note">
      <ShieldIcon className="safety-icon size-5" />
      <p>
        Meet at the pickup point, check it before you pay, and never pay a deposit.{" "}
        <Link href="/safety">Safety tips</Link>
      </p>
    </aside>
  );
}
```

Create `components/listing/MoreFrom.tsx`:

```tsx
import { SectionError } from "@/components/home/SectionError";
import { ListingCard } from "@/components/listings/ListingCard";
import { getMoreFrom } from "@/lib/data";
import type { Listing } from "@/lib/types";

type MoreFromProps = {
  listing: Listing;
  sellerName: string;
  categoryName: string;
  campusNames: ReadonlyMap<string, string>;
};

/** More from the seller, or more in the category (spec 5.7). Hidden when there's nothing to show. */
export async function MoreFrom({ listing, sellerName, categoryName, campusNames }: MoreFromProps) {
  const more = await getMoreFrom(listing, 4).catch(() => null);
  if (more && more.items.length === 0) return null;

  let title = "More listings";
  if (more?.from === "seller") title = `More from ${sellerName}`;
  if (more?.from === "category") title = `More in ${categoryName}`;

  return (
    <section id="more-from" aria-labelledby="more-from-title" className="listing-more">
      <h2 id="more-from-title" className="listing-section-title">
        {title}
      </h2>
      {more ? (
        <ul className="listing-more-grid">
          {more.items.map((item) => (
            <li key={item.id}>
              <ListingCard listing={item} campusName={campusNames.get(item.campusSlug) ?? ""} />
            </li>
          ))}
        </ul>
      ) : (
        <SectionError id="more-from" title="More listings" path={`/listings/${listing.id}`} />
      )}
    </section>
  );
}
```

Create `components/listing/ListingView.tsx`:

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { FlagIcon } from "@/components/icons";
import { priceLabel } from "@/lib/format";
import type { ListingDetail } from "@/lib/types";
import { AvailabilityBanner } from "./AvailabilityBanner";
import { CampusNote } from "./CampusNote";
import { CollectBox } from "./CollectBox";
import { Gallery } from "./Gallery";
import { ListingActions } from "./ListingActions";
import { ListingFacts } from "./ListingFacts";
import { MoreFrom } from "./MoreFrom";
import { SafetyNote } from "./SafetyNote";
import { SellerCard } from "./SellerCard";

/**
 * The listing page (spec 5). On phones everything runs in one column, in reading order, with the actions docked at
 * the bottom. On desktop the photos and details sit on the left, beside a column that stays in view (plan decision 9).
 */
export function ListingView({ detail, campusNames }: { detail: ListingDetail; campusNames: ReadonlyMap<string, string> }) {
  const { listing, seller, category, campus, pickupPoint } = detail;
  const signIn = `/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`;

  return (
    <div className="page listing-page">
      <nav aria-label="Breadcrumb" className="listing-crumbs">
        <ol>
          <li>
            <Link href="/browse">Browse</Link>
          </li>
          <li>
            <Link href={`/browse?cat=${category.slug}`} prefetch={false}>
              {category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="listing-layout">
        <Gallery listing={listing} />

        <div className="listing-panel">
          <AvailabilityBanner availability={listing.availability} />
          <h1 className="listing-heading">{listing.title}</h1>
          <p className="listing-page-price">{priceLabel(listing)}</p>
          {listing.swapFor && (
            <p className="swap-callout">
              <strong>Happy to swap for:</strong> {listing.swapFor}
            </p>
          )}
          <ListingActions listing={listing} />
          <CollectBox handover={listing.handover} campusName={campus.name} pickupPointName={pickupPoint?.name ?? null}>
            <Suspense fallback={null}>
              <CampusNote campusSlug={campus.slug} campusName={campus.name} handover={listing.handover} />
            </Suspense>
          </CollectBox>
          <SellerCard seller={seller} badge={listing.badge} campusName={campus.name} />
        </div>

        <div className="listing-details">
          <section aria-labelledby="about-title">
            <h2 id="about-title" className="listing-section-title">
              About this
            </h2>
            <p className="listing-description">{listing.description}</p>
            <ListingFacts listing={listing} categoryName={category.name} campusName={campus.name} />
          </section>
          <SafetyNote />
        </div>
      </div>

      <MoreFrom listing={listing} sellerName={seller.name} categoryName={category.name} campusNames={campusNames} />

      <p className="listing-report">
        <Link href={signIn} prefetch={false}>
          <FlagIcon className="size-4" />
          Report this listing
        </Link>
      </p>
    </div>
  );
}
```

Run: `pnpm test components/listing`
Expected: PASS.

- [ ] **Step 3: Wire up the page**

Replace `app/listings/[id]/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingView } from "@/components/listing/ListingView";
import { RecordRecentlyViewed } from "@/components/listings/RecordRecentlyViewed";
import { getCampuses, getListingDetail, getListingIds } from "@/lib/data";
import { priceLabel, shortDescription } from "@/lib/format";

/** The tab title is the listing; link previews get "{title} · {price}" and the start of the description (spec 5.8). */
export async function generateMetadata({ params }: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getListingDetail(id);
  if (!detail) return { title: "Page not found" };
  const { listing } = detail;
  const description = shortDescription(listing.description);
  return {
    title: listing.title,
    description,
    openGraph: { title: `${listing.title} · ${priceLabel(listing)}`, description },
  };
}

export async function generateStaticParams() {
  return (await getListingIds()).map((id) => ({ id }));
}

export default function ListingPage({ params }: PageProps<"/listings/[id]">) {
  return (
    // Known listings are prerendered, so this fallback only shows for an unknown id, until the 404 takes over.
    <Suspense fallback={null}>
      <ListingDetails params={params} />
    </Suspense>
  );
}

async function ListingDetails({ params }: Pick<PageProps<"/listings/[id]">, "params">) {
  const { id } = await params;
  const [detail, campuses] = await Promise.all([getListingDetail(id), getCampuses()]);
  if (!detail) notFound();
  const { listing } = detail;
  return (
    <>
      <RecordRecentlyViewed item={{ id: listing.id, title: listing.title, image: listing.image }} />
      <ListingView detail={detail} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />
    </>
  );
}
```

In `tests/e2e/routes.spec.ts`, remove `["/listings/l-001", …]` and `["/listings/fs-002", …]` from `PLACEHOLDERS`; Task 20 tests the listing page.

- [ ] **Step 4: Add the CSS**

Add at the end of `app/globals.css`:

```css
/* --- Listing: layout, panel, seller, details and more from (browse and listing plan, Task 16, spec 5.1, 5.2, 5.7) --- */
@layer components {
  /* Inside .page's gutters: 16px to the content edge on phones (the gallery pulls out by that much), 40px from the
     tablet step. */
  .listing-page {
    padding: 8px 6px 64px;
  }

  .listing-crumbs ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 8px;
    color: var(--color-muted);
    font-size: 13px;
  }

  .listing-crumbs li + li::before {
    content: "/";
    margin-right: 8px;
  }

  .listing-crumbs a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-sky-dark);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .listing-layout {
    display: grid;
    gap: 22px;
  }

  .listing-panel {
    display: grid;
    align-content: start;
    gap: 16px;
  }

  .listing-heading {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem);
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .listing-page-price {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: clamp(2rem, 1.6rem + 1.8vw, 3rem);
    line-height: 1;
    text-transform: uppercase;
  }

  .swap-callout {
    padding: 12px 16px;
    border-radius: var(--radius-card);
    background: var(--color-pale);
    color: var(--color-navy);
  }

  .listing-seller {
    display: flex;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
  }

  .listing-seller-photo {
    flex: none;
    width: 56px;
    border-radius: 999px;
  }

  .listing-seller-body {
    display: grid;
    justify-items: start;
    gap: 4px;
  }

  .listing-seller-eyebrow,
  .listing-seller-meta {
    color: var(--color-muted);
    font-size: 12px;
  }

  .listing-seller-name {
    color: var(--color-navy);
    font-size: 17px;
    font-weight: 700;
  }

  .listing-seller-marks {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .listing-verified {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-navy);
    font-size: 12px;
    font-weight: 600;
  }

  .listing-seller-marks .listing-badge {
    margin-top: 0;
  }

  .listing-seller-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-size: 14px;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .listing-details {
    display: grid;
    align-content: start;
    gap: 24px;
  }

  .listing-section-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 24px;
    line-height: 1;
    text-transform: uppercase;
  }

  /* The seller's own line breaks are kept (spec 5.1). */
  .listing-description {
    max-width: 65ch;
    margin-top: 12px;
    white-space: pre-line;
  }

  .listing-facts {
    display: grid;
    gap: 10px;
    max-width: 32rem;
    margin-top: 20px;
  }

  .listing-facts > div {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--color-line);
  }

  .listing-facts dt {
    color: var(--color-muted);
  }

  .listing-facts dd {
    color: var(--color-navy);
    font-weight: 600;
    text-align: right;
  }

  .listing-facts a {
    color: var(--color-sky-dark);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .safety-note {
    display: flex;
    gap: 12px;
    padding: 16px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
    color: var(--color-ink);
    font-size: 14px;
  }

  .safety-icon {
    flex: none;
    color: var(--color-navy);
  }

  /* Navy on the grey panel: sky-dark is 4.25:1 there. */
  .safety-note a {
    color: var(--color-navy);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .listing-more {
    margin-top: 48px;
  }

  .listing-more-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 14px;
    margin-top: 16px;
  }

  .listing-report {
    margin-top: 32px;
  }

  .listing-report a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-size: 13px;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .listing-page {
      padding-inline: 16px;
    }
  }

  /* Desktop: photos and details on the left, the panel on the right staying in view (spec 5.2, plan decision 9).
     --listing-sticky-top clears the pinned crest; check it by eye and adjust. */
  @media (min-width: 64rem) and (min-height: 30rem) {
    .listing-layout {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      grid-template-areas:
        "gallery panel"
        "details panel";
      align-items: start;
      gap: 32px 40px;
    }

    .gallery {
      grid-area: gallery;
    }

    .listing-panel {
      grid-area: panel;
      position: sticky;
      top: var(--listing-sticky-top, 120px);
    }

    .listing-details {
      grid-area: details;
    }

    .listing-more-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
}
```

- [ ] **Step 5: Run the checks, look at it, and measure the JavaScript**

Run: `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build`.
Expected: all pass. In the build output, `/listings/[id]` is prerendered for every id (partially, for the campus note).

Then run `pnpm e2e tests/e2e/routes.spec.ts tests/e2e/home.spec.ts tests/e2e/a11y.spec.ts`.
Expected: PASS (the existing "a listing page" axe check now covers the real page).

Look at it (see "Conventions"): `/listings/l-001`, `/listings/l-007`, `/listings/l-026` and `/listings/l-030`, at 390 × 844 and 1280 × 800. Check that:
- on the phone, the photo runs edge to edge, the next photo peeks in, and the dock sits at the bottom with nothing hidden behind it when you scroll to the very end;
- on desktop, the right column stays in view below the crest as you scroll; adjust `--listing-sticky-top` if it tucks under the crest or leaves a large gap;
- the price is large, and the title wraps cleanly.

Measure the listing page's first-visit JavaScript with the same method as `tests/e2e/performance.spec.ts` (a throwaway copy in your scratchpad, pointed at `/listings/l-001` at 390px). Report `scriptBrotli`. If it passes 152,000 B, stop and report (see "The JS ledger").

- [ ] **Step 6: Hand over for commit**

Files: `components/listing/SellerCard.tsx`, `ListingFacts.tsx`, `SafetyNote.tsx`, `MoreFrom.tsx`, `MoreFrom.test.tsx`, `ListingView.tsx`, `ListingView.test.tsx`, `app/listings/[id]/page.tsx`, `app/globals.css`, `tests/e2e/routes.spec.ts`.
Message: `feat: the listing page with seller, facts, safety note and more from (listing JS: <scriptBrotli> B)`

---

### Task 17: The share card for WhatsApp

Spec 5.8; plan decision 10.

**Files:**
- Create: `app/listings/[id]/opengraph-image.tsx`

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`, `…/04-functions/image-response.md` and `…/04-functions/generate-image-metadata.md`. Note:
- `next/og` reads `ttf`, `otf` and `woff` fonts only, so the card uses its built-in font (plan decision 10).
- Since v16, the image function's `params` and `id` are promises. The docs' `generateImageMetadata` example types its `params` as a plain object; `await` works on either, so the code awaits it.
- Every `<div>` with more than one child needs `display: "flex"`.

- [ ] **Step 2: Write the card**

Create `app/listings/[id]/opengraph-image.tsx`:

```tsx
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getListingDetail } from "@/lib/data";
import { priceLabel, shareCardAlt } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The white crest, read once. Until Eduvos's font files arrive, the card uses next/og's built-in font: it can't read
// the woff2 files next/font serves (plan decision 10).
const crest = `data:image/png;base64,${(await readFile(join(process.cwd(), "assets/brand/crest-white.png"))).toString("base64")}`;

type Props = { params: Promise<{ id: string }> };

/** One card per listing, with alt text saying what, how much and where (spec 5.8). */
export async function generateImageMetadata({ params }: Props) {
  const { id } = await params;
  const detail = await getListingDetail(id);
  const alt = detail
    ? shareCardAlt(detail.listing.title, priceLabel(detail.listing), detail.campus.name)
    : "Vossie, the Eduvos student marketplace";
  return [{ id: "card", alt, size, contentType }];
}

/** The link preview WhatsApp shows (spec 5.8): navy, the crest, the campus, the title and the price in large sky. */
export default async function Image({ params }: Props) {
  const { id } = await params;
  const detail = await getListingDetail(id);
  const title = detail?.listing.title ?? "Vossie";
  const price = detail ? priceLabel(detail.listing) : "";
  const campus = detail?.campus.name ?? "Every Eduvos campus";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "72px 88px",
          background: "#15305D",
          color: "#FFFFFF",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img> elements */}
        <img src={crest} width={181} height={304} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
          <div style={{ fontSize: 30, letterSpacing: 2, textTransform: "uppercase" }}>{`Vossie · ${campus}`}</div>
          <div style={{ fontSize: 64, lineHeight: 1.05 }}>{title}</div>
          {price && <div style={{ fontSize: 96, lineHeight: 1, color: "#29ABE2" }}>{price}</div>}
        </div>
      </div>
    ),
    size,
  );
}
```

If `pnpm lint` reports the disable comment as unused, delete it.

- [ ] **Step 3: Build and look at the card**

Run: `pnpm typecheck`, `pnpm lint`, then `pnpm build`.
Expected: all pass. Note in your report whether the build lists the card route as prerendered or on demand; either is fine.

Then `pnpm start --port 3201` and open `/listings/l-001` in a throwaway Playwright script: read `meta[property="og:image"]`, fetch that URL, and save the PNG to your scratchpad. Look at it: the crest on the left, "VOSSIE · MIDRAND", the title, and "R250" in sky. Also check `meta[property="og:image:alt"]` reads "Casio fx-991ZA Plus calculator, R250, at Midrand on Vossie". Stop the server.

- [ ] **Step 4: Hand over for commit**

Files: `app/listings/[id]/opengraph-image.tsx`.
Message: `feat: a share card for each listing, for WhatsApp link previews`

---

### Task 18: The sign-in placeholder links back

Spec 5.9.

**Files:**
- Create: `lib/next-path.ts`, `lib/next-path.test.ts`
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/next-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath (spec 5.9)", () => {
  it("accepts a path on this site", () => {
    expect(safeNextPath("/listings/l-001")).toBe("/listings/l-001");
    expect(safeNextPath("/browse?q=lamp")).toBe("/browse?q=lamp");
    expect(safeNextPath(["/saved", "/account"])).toBe("/saved");
  });

  it("refuses anything that could lead to another site", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "listings/l-001",
      "",
      undefined,
    ]) {
      expect(safeNextPath(bad), String(bad)).toBeNull();
    }
  });
});
```

Run: `pnpm test lib/next-path.test.ts`
Expected: FAIL. `./next-path` doesn't exist.

- [ ] **Step 2: Write the code**

Create `lib/next-path.ts`:

```ts
/**
 * A `next` link parameter that's safe to link back to (browse and listing spec 5.9): a path on this site. Anything
 * else is refused: another site, a protocol-relative "//", a backslash (some browsers read it as a slash), and
 * spaces or control characters (browsers drop some of them, which can turn "/\t/" into "//").
 */
export function safeNextPath(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const unsafe = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x20 || code === 0x7f;
  });
  return unsafe ? null : value;
}
```

Replace `app/login/page.tsx` with:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { safeNextPath } from "@/lib/next-path";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <ComingSoon title="Sign in">
      <p>
        Signing in arrives in the next stage. Then you&apos;ll be able to message sellers, report listings and keep your
        saved items on every device.
      </p>
      <Suspense fallback={null}>
        <BackLink searchParams={searchParams} />
      </Suspense>
    </ComingSoon>
  );
}

/** A link back to where the visitor came from, when `next` is a path on this site (spec 5.9). */
async function BackLink({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  if (!next) return null;
  return (
    <p className="mt-4">
      <Link href={next} className="font-semibold text-sky-dark underline underline-offset-4">
        {next.startsWith("/listings/") ? "Back to the listing" : "Go back"}
      </Link>
    </p>
  );
}
```

- [ ] **Step 3: Run the checks**

Run: `pnpm test lib/next-path.test.ts`, then `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm e2e tests/e2e/routes.spec.ts`.
Expected: all pass (`/login` still shows "Coming in the next stage" and the title "Sign in"). Task 20 tests the link back end to end.

- [ ] **Step 4: Hand over for commit**

Files: `lib/next-path.ts`, `lib/next-path.test.ts`, `app/login/page.tsx`.
Message: `feat: the sign-in placeholder explains what's coming and links back to the listing`

---

### Task 19: Browse end-to-end tests

Spec 11; plan decision 18.

**Files:**
- Create: `tests/e2e/browse.spec.ts`

- [ ] **Step 1: Write the tests**

Create `tests/e2e/browse.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

const cards = (page: Page) => page.locator("main article");
const filters = (page: Page) => page.locator("details.tool-filters");
const sort = (page: Page) => page.locator("details.tool-sort");

test("a first visit shows every campus, 24 at a time", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Everything");
  await expect(page.getByText("Showing 24 of 36")).toBeVisible();
  await expect(cards(page)).toHaveCount(24);
  await expect(page).toHaveTitle("Browse · Vossie");
});

test("Show more lands on the 25th card", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse");
  await page.getByRole("link", { name: "Show more" }).click();
  await expect(page).toHaveURL(/\/browse\?n=48#r-25$/);
  await expect(cards(page)).toHaveCount(36);
  await expect(page.locator("#r-25")).toBeInViewport();
  await expect(page.getByText("36 listings")).toBeVisible();
});

test.describe("the campus (decision 40)", () => {
  test("starts on the chosen campus, and the chip widens it to every campus", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
    await page.goto("/browse");
    await expect(cards(page)).toHaveCount(14);
    await page.getByRole("link", { name: "Remove filter: Midrand" }).click();
    await expect(page).toHaveURL(/\/browse\?campus=all$/);
    await expect(page.getByText("Showing 24 of 36")).toBeVisible();
  });

  test("a campus in the link wins over the chosen one", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
    await page.goto("/browse?campus=pretoria");
    await expect(page.getByRole("link", { name: "Remove filter: Pretoria" })).toBeVisible();
    await expect(cards(page)).toHaveCount(5);
  });

  test("a campus with nothing points to the others", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
    await page.goto("/browse");
    await expect(page.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeVisible();
    await page.getByRole("link", { name: "36 more at other campuses" }).click();
    await expect(page).toHaveURL(/\/browse\?campus=all$/);
    await expect(cards(page)).toHaveCount(24);
  });
});

test("the category tabs change the title and the results", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse");
  await page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: "Tech" }).click();
  await expect(page).toHaveURL(/\/browse\?cat=tech$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech");
  await expect(cards(page)).toHaveCount(5);
  await expect(page).toHaveTitle("Tech · Vossie");
});

test("Filters narrows the results and shows a chip", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse");
  await filters(page).locator("summary").click();
  await page.getByRole("radio", { name: "Under R100" }).check();
  await page.getByRole("button", { name: "Show results" }).click();
  await expect(page).toHaveURL(/price=under-100/);
  await expect(cards(page)).toHaveCount(7);
  await expect(page.getByRole("link", { name: "Remove filter: Under R100" })).toBeVisible();
  await expect(filters(page).locator("summary")).toHaveAttribute("aria-label", "Filters, 1 active");
  await expect(filters(page)).not.toHaveAttribute("open");
});

test("Sort reorders by price, offers Best match only with a search, and closes after choosing", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse?cat=tech");
  await sort(page).locator("summary").click();
  await expect(sort(page).getByRole("link", { name: "Best match" })).toHaveCount(0);
  await sort(page).getByRole("link", { name: "Price: low to high" }).click();
  await expect(page).toHaveURL(/\/browse\?cat=tech&sort=price-low$/);
  await expect(cards(page).first()).toContainText("HP laptop charger");
  await expect(sort(page)).not.toHaveAttribute("open");
});

test("search forgives a typo, finds seller names, and stays out of search engines", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse?q=brads");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("“brads”");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Box braids");
  await expect(page).toHaveTitle("“brads” · Vossie");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const box = page.getByRole("search").getByRole("searchbox", { name: "Search Vossie" });
  await box.fill("bakery");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/browse\?q=bakery$/);
  await expect(cards(page).first()).toContainText("Cupcake box");
});

test("homepage links land on the right results", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  const cases: ReadonlyArray<[path: string, count: number, chip: string | null]> = [
    ["/browse?max=50", 4, "Under R50"],
    ["/browse?price=free", 4, "Free"],
    ["/browse?pay=swap", 6, "Swaps"],
    ["/browse?deals=free-and-swaps", 10, "Free & swaps"],
    ["/browse?cat=tech", 5, null],
  ];
  for (const [path, count, chip] of cases) {
    await page.goto(path);
    await expect(cards(page), path).toHaveCount(count);
    if (chip) await expect(page.getByRole("link", { name: `Remove filter: ${chip}` }), path).toBeVisible();
  }
});

test("the homepage's budget chips and category tiles open browse", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/");
  await page.getByRole("list", { name: "Shop by budget" }).getByRole("link", { name: "Under R50" }).click();
  await expect(page).toHaveURL(/\/browse\?max=50$/);
  await expect(cards(page)).toHaveCount(4);
  await page.goto("/");
  await page.getByRole("region", { name: "Categories" }).getByRole("link", { name: "Tech" }).click();
  await expect(page).toHaveURL(/\/browse\?cat=tech$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech");
});

test.describe("without the app's JavaScript (plan decision 18)", () => {
  test.beforeEach(async ({ page }) => {
    // The app's bundle never arrives. React's small inline script still puts the streamed results in place.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
  });

  test("tabs, Filters, Sort and Show more all still work", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/browse");
    await expect(cards(page)).toHaveCount(24);

    await page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: "Res & living" }).click();
    await expect(page).toHaveURL(/\/browse\?cat=res-living$/);

    await filters(page).locator("summary").click();
    await page.getByRole("radio", { name: "Free", exact: true }).check();
    await page.getByRole("button", { name: "Show results" }).click();
    await expect(page).toHaveURL(/price=free/);
    await expect(cards(page)).toHaveCount(2);

    await sort(page).locator("summary").click();
    await sort(page).getByRole("link", { name: "Price: high to low" }).click();
    await expect(page).toHaveURL(/sort=price-high/);
    await expect(cards(page)).toHaveCount(2);

    await page.goto("/browse");
    await page.getByRole("link", { name: "Show more" }).click();
    await expect(cards(page)).toHaveCount(36);
  });
});
```

- [ ] **Step 2: Run them**

Run: `pnpm e2e tests/e2e/browse.spec.ts`
Expected: PASS at every size (most tests skip themselves outside 390 and 1440).

If a count is off, check it against `lib/data/index.test.ts` (Task 7), which pins the same numbers. Don't loosen a test to make it pass; find which side is wrong and report it.

- [ ] **Step 3: Hand over for commit**

Files: `tests/e2e/browse.spec.ts`.
Message: `test: browse end to end, including the campus default and a run without the app's JavaScript`

---

### Task 20: Listing end-to-end and accessibility tests

Spec 11.

**Files:**
- Create: `tests/e2e/listing.spec.ts`
- Modify: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Write the listing tests**

Create `tests/e2e/listing.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

test("shows the photos, price, collect box, seller and more from them", async ({ page }) => {
  await page.goto("/listings/l-001");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Casio fx-991ZA Plus calculator");
  await expect(page.locator(".listing-page-price")).toHaveText("R250");
  await expect(page.getByRole("region", { name: "Photos" }).getByRole("img")).toHaveCount(3);
  await expect(page.getByText("Collect at Midrand · Library entrance")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Tech corner" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "More from Tech corner" })).toBeAttached();
  await expect(page).toHaveTitle("Casio fx-991ZA Plus calculator · Vossie");
});

test("docks Message, Save and Share at the bottom on phones, covering nothing", async ({ page }) => {
  onlyAt("phone-360", "phone-390");
  await page.goto("/listings/l-001");
  const dock = page.locator(".listing-actions");
  await expect(dock).toHaveCSS("position", "fixed");
  const box = (await dock.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);

  // Scrolled to the very end, the footer still finishes above the dock.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const footerBottom = await page.getByRole("contentinfo").evaluate((footer) => footer.getBoundingClientRect().bottom);
  expect(footerBottom).toBeLessThanOrEqual(box.y + 1);
});

test("a keyboard walk goes breadcrumb, photos, then the actions, in reading order", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/listings/l-001");
  await page.locator("#main").focus();
  const names: string[] = [];
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("Tab");
    names.push(
      await page.evaluate(() => {
        const focused = document.activeElement as HTMLElement | null;
        return focused?.getAttribute("aria-label") ?? focused?.textContent?.trim() ?? "";
      }),
    );
  }
  expect(names).toEqual([
    "Browse",
    "Tech",
    "Photos",
    "Message seller",
    "Save Casio fx-991ZA Plus calculator",
    "Share",
  ]);
});

test("keeps the column with the actions in view on desktop", async ({ page }) => {
  onlyAt("laptop-1024", "desktop-1440");
  await page.goto("/listings/l-001");
  await expect(page.locator(".listing-actions")).toHaveCSS("position", "static");
  await expect(page.locator(".listing-panel")).toHaveCSS("position", "sticky");
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(page.getByRole("link", { name: "Message seller" })).toBeInViewport();
});

test("messaging goes through the sign-in page and back", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/listings/l-001");
  await page.getByRole("link", { name: "Message seller" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001$/);
  await expect(page.getByText("Signing in arrives in the next stage.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Back to the listing" }).click();
  await expect(page).toHaveURL(/\/listings\/l-001$/);
});

test("the sign-in page never links back to another site", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/login?next=//evil.example");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await expect(page.getByRole("link", { name: /^(Back to the listing|Go back)$/ })).toHaveCount(0);
});

test("sold and paused listings say so and offer similar items", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/listings/l-026");
  await expect(page.getByText("Sold", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "See similar items" })).toHaveAttribute("href", "/browse?cat=tech");
  await expect(page.getByRole("link", { name: "Message seller" })).toHaveCount(0);
  await page.goto("/listings/l-016");
  await expect(page.getByText("Not taking orders right now")).toBeVisible();
});

test("shows swap terms and the cash-or-swap price", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/listings/l-007");
  await expect(page.locator(".listing-page-price")).toHaveText("R450 or swap");
  await expect(page.getByText("a mechanical keyboard or a Bluetooth speaker", { exact: false })).toBeVisible();
});

test("notes when a pickup isn't at your campus", async ({ page, context, baseURL }) => {
  onlyAt("phone-390", "desktop-1440");
  await context.addCookies([{ name: "vossie_campus", value: "pretoria", url: baseURL! }]);
  await page.goto("/listings/l-001");
  await expect(page.getByText("Midrand isn't your chosen campus (Pretoria)", { exact: false })).toBeVisible();
  await page.goto("/listings/l-030");
  await expect(page.getByText("isn't your chosen campus", { exact: false })).toHaveCount(0);
});

test("with data saver on, only the cover photo loads", async ({ page }) => {
  onlyAt("phone-390");
  const extraPhotos: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/placeholders/photo/")) extraPhotos.push(request.url());
  });
  await page.addInitScript(() => localStorage.setItem("vossie_low_data", "1"));
  await page.goto("/listings/l-001", { waitUntil: "networkidle" });
  const more = page.locator("details.gallery-saver > summary");
  await expect(more).toHaveText("Show 2 more photos");
  expect(extraPhotos).toEqual([]);
  await more.click();
  await expect.poll(() => extraPhotos.length).toBeGreaterThan(0);
});

test("Share copies the link where there's no share sheet", async ({ page, context }) => {
  onlyAt("desktop-1440");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  await page.goto("/listings/l-001");
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("status")).toHaveText("Link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/listings\/l-001$/);
});

test("each listing has a share card for link previews", async ({ page, request, baseURL }) => {
  onlyAt("desktop-1440");
  await page.goto("/listings/l-001");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Casio fx-991ZA Plus calculator · R250",
  );
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    "Casio fx-991ZA Plus calculator, R250, at Midrand on Vossie",
  );
  // Without a metadataBase the card's URL names another port, so fetch its path from the test server
  // (setting metadataBase is on the go-live checklist).
  const card = new URL((await page.locator('meta[property="og:image"]').getAttribute("content"))!);
  const response = await request.get(new URL(`${card.pathname}${card.search}`, baseURL).toString());
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});
```

- [ ] **Step 2: Add the accessibility checks**

Add to `tests/e2e/a11y.spec.ts`:

```ts
test("browse", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.locator("main article").first()).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse with Filters open", async ({ page }) => {
  await page.goto("/browse?cat=tech&price=under-500");
  await page.locator("details.tool-filters > summary").click();
  await expect(page.getByRole("button", { name: "Show results" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse with Sort open", async ({ page }) => {
  await page.goto("/browse?q=calculator");
  await page.locator("details.tool-sort > summary").click();
  await expect(page.getByRole("link", { name: "Best match" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse with nothing found", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
  await page.goto("/browse");
  await expect(page.getByText("Nothing here yet")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a sold listing", async ({ page }) => {
  await page.goto("/listings/l-026");
  expect(await seriousIssues(page)).toEqual([]);
});

test("a listing with several photos and a campus note", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "pretoria", url: baseURL! }]);
  await page.goto("/listings/l-021");
  await expect(page.getByRole("region", { name: "Photos" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});
```

- [ ] **Step 3: Run them**

Run: `pnpm e2e tests/e2e/listing.spec.ts tests/e2e/a11y.spec.ts`
Expected: PASS at every size.

If axe finds a serious issue, fix the component (not the test), add a unit test where one fits, and list the fix in your report.

- [ ] **Step 4: Hand over for commit**

Files: `tests/e2e/listing.spec.ts`, `tests/e2e/a11y.spec.ts`, and any component files you fixed.
Message: `test: listing page end to end, and axe on browse and listing states`

---

### Task 21: Budgets and layout shift for every page (JS ledger)

Spec section 10; "The JS ledger".

**Files:**
- Modify: `tests/e2e/performance.spec.ts`
- Modify: `tests/e2e/cls.spec.ts`

- [ ] **Step 1: Measure every page**

Replace the contents of `tests/e2e/performance.spec.ts` with:

```ts
import { brotliCompressSync, constants } from "node:zlib";
import { expect, test } from "@playwright/test";

const PAGES: ReadonlyArray<[name: string, path: string]> = [
  ["homepage", "/"],
  ["browse page", "/browse"],
  ["listing page", "/listings/l-001"],
];

for (const [name, path] of PAGES) {
  test(`a first visit to the ${name} stays inside the size budgets`, async ({ page }) => {
    test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
    const pending: Array<Promise<void>> = [];
    // script, font and total are the gzip transfer sizes `next start` serves. scriptBrotli is the same scripts
    // compressed the way a host serves them.
    const bytes = { script: 0, scriptBrotli: 0, font: 0, total: 0 };

    page.on("requestfinished", (request) => {
      pending.push(
        request.sizes().then((sizes) => {
          bytes.total += sizes.responseBodySize + sizes.responseHeadersSize;
          if (request.resourceType() === "script") bytes.script += sizes.responseBodySize;
          if (request.resourceType() === "font") bytes.font += sizes.responseBodySize;
        }),
      );
    });

    // response.body() is the decoded body, so compressing it ourselves gives the brotli size.
    page.on("response", (response) => {
      if (response.request().resourceType() !== "script") return;
      pending.push(
        response.body().then((body) => {
          bytes.scriptBrotli += brotliCompressSync(body, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
          }).length;
        }),
      );
    });

    await page.goto(path, { waitUntil: "networkidle" });
    await Promise.all(pending);
    console.log(`${name}: ${JSON.stringify(bytes)}`);

    // The JavaScript budget is measured brotli-compressed, as a host serves it. `next start` only does gzip, which
    // is larger, so it would fail a budget the live site meets. Quality 5 is the level CDNs usually compress at on
    // the fly (their pre-compressed, higher-quality files are smaller still). The gzip figure is logged above for
    // comparison.
    expect(bytes.scriptBrotli, "JavaScript, brotli as a host serves it").toBeLessThanOrEqual(150 * 1024);
    expect(bytes.font, "fonts").toBeLessThanOrEqual(60 * 1024);
    expect(bytes.total, "whole first visit").toBeLessThanOrEqual(350 * 1024);
  });
}
```

Replace the contents of `tests/e2e/cls.spec.ts` with:

```ts
import { expect, test } from "@playwright/test";

type Shift = { value: number; nodes: string[] };

const PAGES: ReadonlyArray<[name: string, path: string]> = [
  ["homepage", "/"],
  ["browse page", "/browse"],
  ["listing page", "/listings/l-001"],
];

for (const [name, path] of PAGES) {
  test(`the ${name} holds still while fonts and content arrive (CLS 0.05 or less, spec 11)`, async ({ page }) => {
    test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Measured at 390 and 1440");

    // Hold the fonts back, so they swap in after first paint: the worst case for shifts.
    await page.route(/\.woff2$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    await page.addInitScript(() => {
      type LayoutShift = PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources?: Array<{ node?: Node | null }>;
      };
      const shifts: Array<{ value: number; nodes: string[] }> = [];
      (window as unknown as { __shifts: typeof shifts }).__shifts = shifts;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LayoutShift[]) {
          if (entry.hadRecentInput) continue;
          shifts.push({
            value: entry.value,
            nodes: (entry.sources ?? []).map(({ node }) =>
              node instanceof Element ? `${node.tagName.toLowerCase()}.${[...node.classList].join(".")}` : String(node?.nodeName),
            ),
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    // Two frames, so a last shift is recorded.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const shifts = await page.evaluate(() => (window as unknown as { __shifts: Shift[] }).__shifts);
    // The sum of every shift: never less than CLS, which only counts the worst burst, so this is the stricter check.
    const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
    console.log(`${name} layout shift: ${total.toFixed(4)} ${JSON.stringify(shifts)}`);
    expect(total, "cumulative layout shift").toBeLessThanOrEqual(0.05);
  });
}
```

Both keep the homepage's checks exactly as they were.

- [ ] **Step 2: Run them**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/cls.spec.ts`
Expected: PASS. Record each page's logged `scriptBrotli` and layout shift.

If a page passes the 152,000 B stop line, stop and report (see "The JS ledger"). If browse's layout shift fails, compare `BrowseSkeleton`'s sizes (Task 12) with the real header, tabs and toolbar, and match them; report what moved.

- [ ] **Step 3: Hand over for commit**

Files: `tests/e2e/performance.spec.ts`, `tests/e2e/cls.spec.ts`, and `app/globals.css` if a skeleton size changed.
Message: `test: size budgets and layout shift for the browse and listing pages (homepage <n> B, browse <n> B, listing <n> B)`

---

### Task 22: Review screenshots, docs and final checks

**Files:**
- Modify: `tests/e2e/screenshots.spec.ts`
- Create: `docs/progress/browse-listing/*.png`
- Modify: `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md`
- Modify: this plan (a "Changes made during the build" section)

- [ ] **Step 1: Add the review screenshots**

Add to `tests/e2e/screenshots.spec.ts`:

```ts
test("browse and listing review screenshots", async ({ page, context, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/browse-listing/${project}-${name}.png`;

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

  await page.goto("/browse");
  await settle();
  await page.screenshot({ path: file("01-browse"), fullPage: true });

  await page.locator("details.tool-filters > summary").click();
  await page.screenshot({ path: file("02-browse-filters") });

  await page.goto("/browse?q=calculator");
  await settle();
  await page.screenshot({ path: file("03-browse-search") });

  await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
  await page.goto("/browse");
  await page.screenshot({ path: file("04-browse-empty") });
  await context.clearCookies();

  await page.goto("/listings/l-001");
  await settle();
  await page.screenshot({ path: file("05-listing") });
  await page.screenshot({ path: file("06-listing-whole"), fullPage: true });

  await page.goto("/listings/l-026");
  await page.screenshot({ path: file("07-listing-sold") });
});
```

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "browse and listing review screenshots"`
Expected: 14 PNGs in `docs/progress/browse-listing/`. Open a few and check they show what their names say.

- [ ] **Step 2: Correct the spec and the decisions log (plan decision 18)**

In `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md`:
- Decision 5: change "Near-zero page JavaScript; everything works with JavaScript off." to "Near-zero page JavaScript: everything works without the app's JavaScript, before it arrives or if it never does. (React's small inline script, which places streamed content, is still needed.)"
- Section 9, the last bullet: "Every flow works without the app's JavaScript bundle."
- Section 11, the e2e bullet: "The browse flow again with the app's JavaScript bundle blocked."

In `docs/reference/LANDING-DECISIONS.md`, row 39: change "it works with JavaScript off" to "it works without the app's JavaScript (React's small inline script still places streamed content)".

- [ ] **Step 3: Update the checklist and the progress log**

In `docs/reference/GO-LIVE.md`:
- Status: `/browse` and `/listings/[id]` become **Built**; the category and campus routes become **Built (redirects into browse)**.
- Under "Production", add: `- [ ] Set metadataBase to the live domain, so share cards and other metadata URLs are absolute.`
- Under the totals, update the count of built screens.

In `docs/PROGRESS.md`, add a section before "Next", in the style of the earlier ones:

```markdown
## 2026-10-<day>: Browse and listing pages built
- **Browse** (`/browse`): search with one-typo tolerance and seller names, ten category tabs, Filters (campus, price, paid with) and Sort as native `<details>`, removable chips, Show more, and empty and error states. The link is the whole state; it opens on the chosen campus. It works without the app's JavaScript.
- **Listing pages** (`/listings/[id]`): photos (a swipe strip on phones, stacked on desktop), price wording for free and cash-or-swap, swap terms, where to collect it and a note when that isn't your campus, the seller, facts, a safety note, more from the seller, and paused and sold states. On phones the actions sit in a dock; on desktop the column stays in view. Message and Report go to the sign-in placeholder, which links back. Each listing has a share card for WhatsApp.
- **Data:** one listing model (free and swap items joined it), pickup points, 29 sellers, `searchListings`, `getListingDetail` and `getMoreFrom`.
- **Links:** `/categories/…` and `/c/…` redirect into browse; the homepage, menu, footer and search link straight to it.
- **Checks:**
  - lint and types are clean;
  - <n> unit tests pass;
  - end to end, <n> pass, <n> are skipped by design and none fail;
  - axe finds no serious or critical issues.
- **First visit at 390px, JS brotli:** homepage <n> B, browse <n> B, listing <n> B (limit 153,600 B).
- **Layout shift:** <figures>.
- Review screenshots: `docs/progress/browse-listing/`.
```

Fill in the numbers from your runs. Then replace "Next" with:

```markdown
## Next
- Lama reviews the screenshots in `docs/progress/browse-listing/`. To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "browse and listing review screenshots"`.
- Then the next stage on the go-live checklist (`docs/reference/GO-LIVE.md`): the other public pages.
```

- [ ] **Step 4: Record what changed during the build**

Add a "Changes made during the build" section to this plan, after "The JS ledger", listing every place the build differed from the tasks as written, with the commit that made each change. Fill in the ledger's "as built" figures.

- [ ] **Step 5: Final checks**

Run, one after another: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`.
Expected: all pass. Record the unit and e2e counts in `docs/PROGRESS.md`.

- [ ] **Step 6: Hand over for commit**

Files: `tests/e2e/screenshots.spec.ts`, `docs/progress/browse-listing/`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, the spec, this plan.
Message: `docs: browse and listing review screenshots, progress, checklist and the JavaScript-off correction`

