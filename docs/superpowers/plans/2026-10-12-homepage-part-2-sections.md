# Vossie Homepage, Part 2: The Homepage Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder homepage with the homepage sections from spec section 7 (7.3 hero to 7.13 Hub banner), on realistic sample data and within the JS budget, tested at five screen sizes.

**Architecture:**
- **Server first.** Every section is a Server Component.
  - Client code exists only for the interactive pieces: the hero rotator, one shared carousel controller, the save heart, the Just listed switch, the campus chooser, the context strip and a campus-picker button.
  - The Collections photo "deal" is plain CSS (`:has()`).
- **A static shell with campus-aware holes.**
  - The campus-aware parts read the `vossie_campus` cookie through `getViewerContext()`, each inside its own `<Suspense>` with a skeleton as the fallback: Just listed, Featured today, Looking For, Free & swaps, What's on, the phone hero chip and the context strip.
  - Everything else is prerendered.
  - Choosing a campus calls `router.refresh()`, so those parts re-render.
- **Data only through `lib/data`.** New cached functions read fixtures shaped like the future tables. `getViewerContext()` (request-time) lives in `lib/data/viewer.ts`.
- **A JS ledger.** Every task that adds client code records the homepage's brotli JavaScript. The budget is a hard stop (see "The JS ledger").

**Tech Stack:** As Part 1 built it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5;
- Tailwind CSS 4.3 through PostCSS (`@tailwindcss/postcss`);
- pnpm 10.30;
- Vitest 5 with Testing Library and jsdom 30;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-08-homepage-design.md`, section 7 for the sections, and sections 8 to 11 and 13 for motion, states, accessibility, budgets and data.
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`.
- **Approved mockup:** `docs/reference/mockups/home-v2.html`.
- **Part 1 plan:** `docs/superpowers/plans/2026-10-08-homepage-part-1-foundation-and-shell.md`. Its "Handoff to Part 2" section is the starting point for this plan.

---

## Before you start

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Commit after every task, as in Part 1. `vossie-audit/` and `.superpowers/` stay out of git and untouched.
2. **Execution.** Subagent-driven, with one combined reviewer per task (plan check first, then code quality). This is Lama's standing preference.
3. **Lighthouse (Task 25).** `pnpm dlx lighthouse@12` downloads Lighthouse into pnpm's cache for one run. Nothing is added to `package.json`.

No other installs are needed.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time. Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and only `rm` what Lama named.
- Never kill an install or build that is still running.

## Where Part 1 left things (checked on 2026-10-12)

| Area | Fact |
|---|---|
| Repo | `main` with a clean tree. Part 1 is finished and every review is closed |
| Tests | 173 unit tests. 270 end-to-end tests at 360, 390, 768, 1024 and 1440px: 199 pass and 71 are skipped by design |
| JS | A first visit to `/` at 390px loads 145,671 B of JavaScript (brotli, quality 5). The test's limit is 150 × 1024 = 153,600 B, so **7,929 B is left** |
| Homepage | `app/page.tsx` is a placeholder hero plus a list of "coming in Part 2" boxes. This plan replaces it |
| Fixture images | `campuses.ts` and `categories.ts` point at `/placeholders/…svg` files that don't exist yet. Task 5 creates them |
| CSS in dev | Tailwind runs through PostCSS, so `pnpm dev` shows `globals.css` edits within a second |
| `next/image` | A `src` ending in `.svg` is served unoptimized automatically (docs). `fill` needs a positioned parent. Use `fetchPriority`/`loading`, not the deprecated `priority` |
| `cookies()` | It must be awaited inside `<Suspense>` for the page to stay prerendered. After awaiting it, a component renders per request and may read the clock (docs: Caching → "Random values and timestamps") |
| `catchError` | Stable in Next 16.3+ for component error boundaries, but it ships client JavaScript. Part 2 catches data errors on the server instead (plan decision 6 below) |
| React `cache()` | Exported in both the server build and the client build that Vitest uses (it passes through there) |
| Test setup | `vitest.setup.ts` mocks `next/navigation` (its spies can't be asserted on), `next/image` (it drops `fill`, `sizes` and `fetchPriority`) and `next/form`. A test that asserts on the router mocks `next/navigation` in its own file with `vi.hoisted` spies |
| jsdom gaps | No `Element.prototype.scrollBy` or `scrollIntoView`. Define them in a test that needs them |
| Node | 26.10 runs `.ts` files directly (type stripping). The placeholder script uses this |

**What Part 1 gives you** (see its handoff):
- **Campus:**
  - `useCampusChoice(campuses)`, `setCampusChoice()`, `parseCampusChoice()`, `campusLabel()`;
  - `ALL_CAMPUSES` (`"all"`), `CAMPUS_COOKIE`;
  - `openOverlay("campus", trigger)`.
- **Saves:** `toggleSaved()` throws when storage is blocked. Also `isSaved()`, `subscribeSaved()`, `useSavedCount()`.
- **Toasts:** `showToast()`.
- **Motion:** `useMotionAllowed()`, `isMotionAllowedNow()`, `useReducedMotion()`, `useLowData()`.
- **Helpers:** `cx()`, `isPlainClick()`, `WIDE_QUERY`, `DESK_QUERY`.
- **Components:** the `Pennant`, `NavLink` and `ComingSoon` components, and the icon set.
- **CSS:**
  - utilities: `surface-navy`, `texture-stars`, `.eyebrow`, `.btn`, `.btn-primary`, `.btn-sky`, `.btn-outline`, `.icon-btn`;
  - text tokens: `text-hero`, `text-section`, `text-eyebrow`, `text-list`, `text-body`, `text-meta`;
  - radii: `rounded-panel`, `rounded-card`, `rounded-strip`;
  - colours: `--color-field`, `--color-idle`, and the rest of the palette.

## Plan decisions (made while planning)

Lama can veto any of these at plan review.

In this plan, "plan decision N" means this list. "Decision N" on its own means a row in the decisions log, `docs/reference/LANDING-DECISIONS.md`.

1. **Every card goes somewhere.**
   - New placeholder pages: `/listings/[id]` (Task 10), `/sellers/[slug]` (Task 18) and `/collections/[slug]` (Task 14, from the handoff).
   - A listing page records itself as "recently viewed" on the device. That makes the context strip's returning state real (spec 7.4).
2. **Just listed loads both views at once,** the campus's and every campus's, so the switch is instant.
   - Skeletons show while the section first streams in.
   - Spec 7.8 asks for skeletons on switching, but nothing needs to load, so there's nothing to wait for.
3. **The hero's changing word sits on its own line** ("BUY & SELL / TEXTBOOKS / ON CAMPUS"), so the headline never reflows between slides.
   - Screen readers hear one stable sentence: "Buy & sell textbooks, tech and services on campus".
4. **The Collections photo deal on hover and focus is CSS only** (`:has()`). It costs no JavaScript.
5. **Shop by campus:**
   - The highlight cycles only while no campus is chosen ("All campuses"). With a campus chosen, it rests on that campus.
   - Choosing a campus scrolls to Just listed and moves keyboard focus to its heading.
6. **Errors.**
   - The campus-aware sections catch data errors on the server and show "{Section} didn't load" with a "Try again" link that reloads the page at that section.
   - One failing section never blanks the page, and this needs no client error boundaries.
7. **Eyebrows on grey, pale and sky panels are navy.** Sky-dark fails contrast there (4.25:1 and 4.04:1).
8. **Photos:**
   - They sit in fixed-ratio boxes with a pale preview, so nothing moves.
   - There's no fade-in: that needs JavaScript on every image.
   - With data saver on, the hero loads only the large photo on show (the three thumbnails are small), and the Hub banner drops its background photo.
9. **Featured today:** verified sellers take turns, starting one place further on each day (SAST). The campus's own sellers come first.
10. **The signed-in strip** shows only in development, with `VOSSIE_SAMPLE_SIGNED_IN=1` and sample activity. No accounts exist yet.
11. **Just listed shows** 4 cards on phones, 9 on tablets (three full rows of three) and 10 on desktop.
12. **Eduvos Online** is found with one helper, `isOnlineCampus()`, rather than a change to the `Campus` type that Part 1's tests construct everywhere.
13. **Saving** shows a toast: "Saved on this device" or "Removed from saved". The first doubles as the spec's quiet note that saves stay on the device.
14. **Idle grey text is `#7E879A`,** a new `idle-text` token, not the spec's `#B9C0CC`.
    - `#B9C0CC` is 1.8:1 on white. Large text needs 3:1 (WCAG 1.4.3), and axe reports it as serious, which would fail the tests.
    - `#7E879A` is 3.6:1 on white and 3.25:1 on the grey panel, and still reads as inactive beside navy.
    - The live counts beside idle campus names are small text, so they're muted (5.9:1).
    - `idle` stays for decoration, such as the sheet handle.
15. **Shop by campus gets a Pause/Play button** on its photo while the highlight cycles. WCAG 2.2.2: anything that moves by itself for more than 5 seconds needs one.
16. **Scroll reveals (spec 8) are CSS only,** using scroll-driven animations.
    - Browsers without support show the content as it is.
    - They're off with reduced motion and data saver.
    - The hero, the strip under it and the Hub banner never animate.
17. **On phones the hero's panel comes first in the page,** and CSS moves the photo above it. Screen readers and keyboards reach the headline and buttons before the slide controls.
18. **Touch targets stay 44px** where the mockup draws them smaller:
    - the hero thumbnails (36px in the mockup) and the hero's campus chip (30px);
    - the Just listed switch (32px);
    - the budget chips (36 to 40px);
    - the RSVP and Book buttons.
19. **The chosen campus card on phones gets a navy tick** as well as the sky ring, because a sky ring alone is 2.6:1 on white (WCAG 1.4.11).

## The JS ledger

- **Start:** 145,671 B (brotli, quality 5) on a first visit at 390px. **Limit:** 153,600 B. **Left:** 7,929 B.
- **Estimate for Part 2,** brotli:

  | Piece | Estimate |
  |---|---|
  | Hero rotator | ~1.1 KB |
  | Carousel controller | ~0.6 KB |
  | Campus chooser | ~1.0 KB |
  | Context strip and its store | ~0.8 KB |
  | Save heart | ~0.4 KB |
  | Just listed switch | ~0.3 KB |
  | Picker button and choose hook | ~0.3 KB |
  | **Total** | **~4.5 KB** |

- **Recording.** Tasks marked **JS ledger** (11, 12, 13, 15, 16 and 25) end by running `pnpm e2e tests/e2e/performance.spec.ts` and reporting the logged `scriptBrotli` value. Client code written in earlier tasks only reaches the homepage when a section uses it, so the first entry is Task 11's.
- **The stop rule.** If `scriptBrotli` passes **152,000 B** (1.6 KB left), stop after that task's commit and report. Don't cut features to fit; that's Lama's decision.
- **First saving to propose:** the search overlay's `next/form` replaced by a plain `<form>` plus `router.push()`. Measure it before proposing it.

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there.
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, and comments in plain English.
- **Server or client.** Server Components unless a file starts with `"use client"`. Hooks files and plain `lib/` modules have no directive.
- **Breakpoints.**
  - `wide:` is tablet and up; `desk:` is desktop. Never use `md:`, `lg:` or `sm:`.
  - In CSS, write `@media (min-width: 48rem) and (min-height: 30rem)` and `@media (min-width: 64rem) and (min-height: 30rem)`.
  - In code, use `WIDE_QUERY` and `DESK_QUERY`.
- **Effects.** Never call `setState` directly in an effect body. Use `useSyncExternalStore`, or set state in an event, timer or observer callback. Only touch `ref.current` in effects and handlers.
- **Sections.**
  - Each section is `<section aria-labelledby="…-title">` with exactly one H2, visible or `sr-only`. Cards inside use H3.
  - The page has one H1, the hero headline.
- **Campus-aware sections.**
  - A sync component renders `<Suspense fallback={<Skeleton />}>` around an exported async component (`…Content`, or a named part such as `LookingForRequests`).
  - That component awaits `getViewerContext()` first, then loads its data with `.catch(() => null)` and shows `SectionError` on `null` (plan decision 6). There's no `try`/`catch` round JSX: the React Compiler lint rejects it.
  - Each section that can show `SectionError` has an `id`, so "Try again" can come back to it.
  - Unit tests mock `@/lib/data/viewer` with a `vi.hoisted` value and render `await …Content()`. To test failures and empty results, they wrap one `@/lib/data` function with `vi.mock(…, async (importOriginal) => …)`.
  - When a static frame holds an async part, the part lives in its own module, so the frame's test can stand it in with `vi.mock`. jsdom can't render async components.
- **Contrast.**
  - Sky-dark eyebrows go on white only; on panel, pale and sky they're navy.
  - Small text on the star texture is white.
  - Sky is for large text, icons, solid pills and the wordmark.
- **Motion.** Animate only `transform`/`opacity`, including the CSS `translate`, `scale` and `rotate` properties. Autoplay follows spec 8. New tappable cards and tiles get `:active { scale: 0.98 }` press feedback. Hover effects only under `(hover: hover) and (pointer: fine)`.
- **Images.**
  - Use the `Photo` component (Task 8) and always pass `sizes`.
  - Decorative images get `alt=""`.
  - Content images take their alt from the data.
- **Tap targets.** At least 44 × 44px, with 8px between targets. Rows in a hairline-divided list may touch (spec 5).
- **CSS placement.**
  - Section CSS goes at the end of `app/globals.css`, inside `@layer components`, under a banner: `/* --- Homepage: <name> (Part 2, Task N, spec 7.x) --- */`.
  - Never put `!important` on a transition or animation property: the motion off-switches rely on it.
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Commit steps.**
  1. Run `git status --short` on its own and check that only the listed files changed.
  2. Run `git add` with the listed files.
  3. Run `git commit` with the given message. It ends with a blank line and `Co-Authored-By: <your model> <noreply@anthropic.com>`.
  - One git command per tool call.
- **Looking at it.** Check visually on a production build (`pnpm build`, then `pnpm start --port 3201`) at 390 × 844 and 1280 × 800, using a throwaway Playwright script in your scratchpad. Stop the server afterwards.

## File map (end of Part 2)

New files are marked **+**; changed files are marked **~**.

```
app/
  page.tsx                          ~ the homepage (Tasks 11 to 21)
  globals.css                       ~ a banner per section; the idle-text token (Task 14)
  listings/[id]/page.tsx            + (Task 10)
  sellers/[slug]/page.tsx           + (Task 18)
  collections/[slug]/page.tsx       + (Task 14)
components/
  icons.tsx                         ~ ArrowRight, ChevronLeft, Shield, Flag (Task 1)
  announcement/AnnouncementBar.tsx  ~ uses usePageHidden (Task 11)
  campus/CampusPicker.tsx           ~ uses useChooseCampus (Task 7)
  campus/CampusPickerButton.tsx     + (Task 7)
  footer/SiteFooter.tsx             ~ campuses in two columns (Task 23)
  listings/RecordRecentlyViewed.tsx + (Task 10)
  home/
    SectionHeader.tsx  Photo.tsx  SectionError.tsx            + (Task 8)
    Carousel.tsx                                            + (Task 9)
    SaveHeart.tsx  ListingCard.tsx                          + (Task 10)
    hero/Hero.tsx  hero/HeroRotator.tsx  hero/HeroCampusChip.tsx   + (Task 11)
    ContextStrip.tsx  ContextStripView.tsx                  + (Task 12)
    ShopByCategory.tsx                                      + (Task 13)
    Collections.tsx                                         + (Task 14)
    ShopByCampus.tsx  CampusChooser.tsx                     + (Task 15)
    JustListed.tsx  JustListedViews.tsx                     + (Task 16)
    HowItWorks.tsx                                          + (Task 17)
    FeaturedToday.tsx                                       + (Task 18)
    LookingFor.tsx  LookingForRequests.tsx                  + (Task 19)
    FreeAndSwaps.tsx                                        + (Task 20)
    HubBanner.tsx  WhatsOn.tsx                              + (Task 21)
hooks/
  useIsSaved.ts  useRecentlyViewed.ts                       + (Task 6)
  useChooseCampus.ts                                        + (Task 7)
  usePageHidden.ts                                          + (Task 11)
lib/
  types.ts                          ~ (Task 2)
  format.ts  featured.ts            + (Task 3)
  time.ts                           + sastDate (Task 3); ~ sastToday (Task 18)
  campus.ts                         ~ isOnlineCampus, ONLINE_CAMPUS (Task 3)
  data/index.ts                     ~ the new functions (Task 4)
  data/viewer.ts                    + getViewerContext (Task 4)
  data/placeholders.test.ts         + (Task 5)
  recently-viewed.ts                + (Task 6)
data/fixtures/
  hero.ts  collections.ts  listings.ts  sellers.ts
  requests.ts  free-swaps.ts  hub.ts  viewer.ts             + (Task 2)
scripts/make-placeholders.ts        + (Task 5)
public/placeholders/                + generated art (Task 5)
tsconfig.json                       ~ allowImportingTsExtensions (Task 5)
tests/e2e/
  reveal.spec.ts                    + (Task 22)
  home.spec.ts                      + (Task 24)
  cls.spec.ts                       + (Task 25)
  brand.spec.ts                     ~ the new hero (Task 11)
  routes.spec.ts                    ~ listing, collection and seller pages (Tasks 10, 14, 18)
  responsive.spec.ts                ~ a longer keyboard walk (Task 21)
  a11y.spec.ts                      ~ more homepage states (Task 24)
  screenshots.spec.ts               ~ homepage review shots (Task 26)
docs/PROGRESS.md  docs/progress/part-2/                     ~/+ (Task 26)
docs/reference/LANDING-DECISIONS.md  the spec  CLAUDE.md    ~ decisions and the idle-text token (Task 26)
```

Each `*.test.ts(x)` sits next to the file it tests.

---

### Task 1: Icons for the homepage

The sections need four more icons from the mockup's set:
- a right arrow, for tiles, collections and requests;
- a left chevron, for the carousels' "previous" button;
- a shield, for "Verified sellers";
- a flag, for "Never pay before you see it".

**Files:**
- Modify: `components/icons.tsx`, `components/icons.test.tsx`

- [ ] **Step 1: Write the failing test**

In `components/icons.test.tsx`, replace the expected list in "exports the shell's icon set" with:

```ts
    expect(Object.keys(icons).sort()).toEqual([
      "ArrowLeftIcon",
      "ArrowRightIcon",
      "ArrowUpRightIcon",
      "CheckIcon",
      "ChevronDownIcon",
      "ChevronLeftIcon",
      "ChevronRightIcon",
      "ClockIcon",
      "CloseIcon",
      "FlagIcon",
      "HeartIcon",
      "MapPinIcon",
      "MenuIcon",
      "PauseIcon",
      "PlayIcon",
      "PlusSquareIcon",
      "SearchIcon",
      "ShareIcon",
      "ShieldIcon",
      "TrendingIcon",
      "UserIcon",
    ]);
```

Rename the test to "exports the site's icon set".

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/icons.test.tsx`
Expected: FAIL. The list is missing the four new names.

- [ ] **Step 3: Add the icons**

In `components/icons.tsx`, add after `ArrowLeftIcon`:

```tsx
export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </Svg>
  );
}
```

after `ChevronDownIcon`:

```tsx
export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}
```

and at the end of the file:

```tsx
export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 19 6.5v5.3c0 4.2-2.9 7.6-7 9.2-4.1-1.6-7-5-7-9.2V6.5Z" />
    </Svg>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 20.5v-16h11l-2 4 2 4h-11" />
    </Svg>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/icons.test.tsx`
Expected: PASS. The `it.each` check now also covers the four new icons.

- [ ] **Step 5: Commit**

Files: `components/icons.tsx components/icons.test.tsx`
Message: `feat: add the homepage icons (arrow, chevron, shield, flag)`

---

### Task 2: Types and sample fixtures for the homepage

Spec section 13 lists the shapes. The fixtures cover all 12 campuses plus Eduvos Online, with generic names.
- Mbombela has no new listings, so the empty state can be tested.
- Midrand has twelve, enough to fill the desktop grid.

Fixture files import types only, so Node can read them directly in Task 5.

**Files:**
- Modify: `lib/types.ts`
- Create: `data/fixtures/hero.ts`, `collections.ts`, `listings.ts`, `sellers.ts`, `requests.ts`, `free-swaps.ts`, `hub.ts`, `viewer.ts`
- Create: `data/fixtures/fixtures.test.ts`

- [ ] **Step 1: Add the types**

Append to `lib/types.ts`:

```ts
export type HeroSlide = {
  id: string;
  /** The word that changes in the headline: "Buy & sell {word} on campus". */
  word: string;
  body: string;
  cta: { label: string; href: string };
  image: ImageRef;
};

export type Collection = {
  slug: string;
  eyebrow: string;
  title: string;
  image: ImageRef;
};

export type PayMode = "cash" | "swap" | "both";

export type TrustBadge = "trusted" | "responsive" | "new-seller";

export type Listing = {
  id: string;
  title: string;
  /** Rand. Null when the item is swap-only. */
  priceZar: number | null;
  /** True for prices shown as "From R400" (services). */
  priceIsFrom: boolean;
  payMode: PayMode;
  campusSlug: string;
  image: ImageRef;
  badge: TrustBadge | null;
  /** ISO 8601 in UTC, e.g. "2026-10-12T07:40:00Z". */
  createdAt: string;
};

export type Seller = {
  slug: string;
  name: string;
  tagline: string;
  /** The category as shown, e.g. "Hair & beauty". */
  category: string;
  campusSlug: string;
  verified: boolean;
  image: ImageRef;
};

export type LookingForRequest = {
  id: string;
  title: string;
  campusSlug: string;
  offers: number;
};

export type FreeSwapItem = {
  id: string;
  kind: "free" | "swap";
  title: string;
  campusSlug: string;
  image: ImageRef;
};

export type HubEvent = {
  id: string;
  /** YYYY-MM-DD in South African time. */
  date: string;
  title: string;
  /** A campus slug, or "all" for an every-campus event. */
  campusSlug: string;
  action: "rsvp" | "book";
};

export type HubBanner = { image: ImageRef };

export type ViewerActivity = {
  newMessages: number;
  salesToConfirm: number;
  savedItemsBack: number;
};

/** Who is looking (spec section 13). No accounts exist yet, so `signedIn` is a development switch. */
export type Viewer = {
  campus: CampusChoice;
  signedIn: boolean;
  activity: ViewerActivity | null;
};

/** What a listing page needs, for regular listings and free and swap items alike. */
export type ListingSummary = {
  id: string;
  title: string;
  campusSlug: string;
  image: ImageRef;
};
```

- [ ] **Step 2: Write the failing fixture test, `data/fixtures/fixtures.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { campuses } from "./campuses";
import { categories } from "./categories";
import { collections } from "./collections";
import { freeSwapItems } from "./free-swaps";
import { heroSlides } from "./hero";
import { hubBanner, hubEvents } from "./hub";
import { listings } from "./listings";
import { requests } from "./requests";
import { sellers } from "./sellers";

const campusSlugs = new Set(campuses.map((campus) => campus.slug));
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

  it("gives every listing a known campus, a real time and a price that matches how it's paid", () => {
    for (const listing of listings) {
      expect(campusSlugs.has(listing.campusSlug)).toBe(true);
      expect(Number.isNaN(Date.parse(listing.createdAt))).toBe(false);
      if (listing.payMode === "swap") expect(listing.priceZar).toBeNull();
      else expect(listing.priceZar).toBeGreaterThan(0);
    }
  });

  it("keeps ids unique across listings and free and swap items, so one listing page finds either", () => {
    expect(isUnique([...listings, ...freeSwapItems].map((item) => item.id))).toBe(true);
  });

  it("puts sellers, requests and free and swap items on known campuses", () => {
    for (const item of [...sellers, ...requests, ...freeSwapItems]) expect(campusSlugs.has(item.campusSlug)).toBe(true);
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
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm test data/fixtures`
Expected: FAIL, because the fixture modules don't exist.

- [ ] **Step 4: Write the fixtures**

`data/fixtures/hero.ts`:

```ts
import type { HeroSlide } from "@/lib/types";

// Spec 7.3: one fixed headline frame with one changing word per slide.
export const heroSlides: readonly HeroSlide[] = [
  {
    id: "textbooks",
    word: "textbooks",
    body: "Set books and notes from students who aced the module, handed over at a campus pickup point.",
    cta: { label: "Shop textbooks", href: "/categories/textbooks-notes" },
    image: { src: "/placeholders/hero/textbooks.svg", alt: "A student holding a stack of set books" },
  },
  {
    id: "tech",
    word: "tech",
    body: "Laptops, calculators and chargers from students on your campus, checked when you meet.",
    cta: { label: "Shop tech", href: "/categories/tech" },
    image: { src: "/placeholders/hero/tech.svg", alt: "A student checking a laptop before buying it" },
  },
  {
    id: "services",
    word: "services",
    body: "Braids, tutoring, logos and repairs from students who do it well.",
    cta: { label: "Shop services", href: "/categories/services" },
    image: { src: "/placeholders/hero/services.svg", alt: "A student braiding a classmate's hair" },
  },
];
```

`data/fixtures/collections.ts`:

```ts
import type { Collection } from "@/lib/types";

const collection = (slug: string, eyebrow: string, title: string): Collection => ({
  slug,
  eyebrow,
  title,
  image: { src: `/placeholders/collection/${slug}.svg`, alt: title },
});

// Curated by the Incubation Hub for the season (spec 7.6).
export const collections: readonly Collection[] = [
  collection("start-of-semester", "Start of semester", "Back-to-campus essentials"),
  collection("exam-season", "Exam season", "Notes, tutors & cram snacks"),
  collection("moving-in", "Moving in", "Res setup under R500"),
  collection("skills-for-hire", "Skills for hire", "Book a student"),
];
```

`data/fixtures/listings.ts`:

```ts
import type { Listing, PayMode, TrustBadge } from "@/lib/types";

type Options = { from?: boolean; payMode?: PayMode };

const listing = (
  id: string,
  title: string,
  priceZar: number | null,
  campusSlug: string,
  categorySlug: string,
  badge: TrustBadge | null,
  createdAt: string,
  { from = false, payMode = priceZar === null ? "swap" : "cash" }: Options = {},
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
});

// Newest first. Every campus has listings except Mbombela, so its empty state can be tested.
export const listings: readonly Listing[] = [
  listing("l-001", "Casio fx-991ZA Plus calculator", 250, "midrand", "tech", "responsive", "2026-10-12T07:40:00Z"),
  listing("l-018", "HP laptop charger, 65W", 220, "bedfordview", "tech", "responsive", "2026-10-12T07:05:00Z"),
  listing("l-002", "Intro to Financial Accounting, 4th edition", 300, "midrand", "textbooks-notes", "new-seller", "2026-10-12T06:55:00Z"),
  listing("l-013", "Python tutoring for beginners, one hour", 150, "pretoria", "tutoring", "trusted", "2026-10-12T06:30:00Z"),
  listing("l-024", "Bunny chow lunch special", 75, "durban-umhlanga", "food", "trusted", "2026-10-12T06:20:00Z"),
  listing("l-003", "Bar fridge, 90 litres", 1200, "midrand", "res-living", "trusted", "2026-10-12T06:10:00Z"),
  listing("l-021", "Bicycle, 21 gears", 1500, "cape-town-mowbray", "res-living", null, "2026-10-12T05:30:00Z"),
  listing("l-030", "CV and LinkedIn makeover", 200, "online", "services", "trusted", "2026-10-12T04:15:00Z", { from: true }),
  listing("l-004", "Box braids, shoulder length", 400, "midrand", "hair-beauty", "trusted", "2026-10-11T18:20:00Z", { from: true }),
  listing("l-031", "Spreadsheet tutoring over video", 130, "online", "tutoring", "responsive", "2026-10-11T17:10:00Z"),
  listing("l-014", "Electric kettle, 1.7 litres", 200, "pretoria", "res-living", "responsive", "2026-10-11T16:45:00Z"),
  listing("l-005", "Statistics 1 exam prep, one hour", 120, "midrand", "tutoring", "responsive", "2026-10-11T16:05:00Z"),
  listing("l-023", "Gel nails, full set", 250, "cape-town-tyger-valley", "hair-beauty", "responsive", "2026-10-11T14:35:00Z", { from: true }),
  listing("l-006", "Desk lamp with a USB port", 180, "midrand", "res-living", null, "2026-10-11T12:30:00Z"),
  listing("l-015", "Thrifted puffer jacket", 280, "pretoria", "fashion-thrift", "new-seller", "2026-10-11T11:30:00Z"),
  listing("l-027", "Res curtains, two panels", 120, "nelson-mandela-bay", "res-living", "new-seller", "2026-10-11T10:40:00Z"),
  listing("l-007", "Gaming headset, barely used", 450, "midrand", "tech", "responsive", "2026-10-11T09:15:00Z", { payMode: "both" }),
  listing("l-020", "Mini oven for res", 650, "bloemfontein", "res-living", "trusted", "2026-10-11T08:30:00Z"),
  listing("l-008", "Business Management 1 summary notes", 90, "midrand", "textbooks-notes", "trusted", "2026-10-10T19:40:00Z"),
  listing("l-022", "Film camera, working", 900, "cape-town-mowbray", "tech", "new-seller", "2026-10-10T16:20:00Z"),
  listing("l-009", "Cupcake box, a dozen", 150, "midrand", "food", "trusted", "2026-10-10T14:00:00Z"),
  listing("l-016", "Lash extensions, classic set", 300, "pretoria", "hair-beauty", "trusted", "2026-10-10T13:15:00Z", { from: true }),
  listing("l-019", "Economics 1 textbook", 320, "bedfordview", "textbooks-notes", "trusted", "2026-10-10T12:10:00Z"),
  listing("l-029", "Engineering drawing set", 350, "vanderbijlpark", "stationery", "trusted", "2026-10-10T11:05:00Z"),
  listing("l-010", "Denim jacket, size M", null, "midrand", "fashion-thrift", "new-seller", "2026-10-10T10:25:00Z"),
  listing("l-026", "Sharp scientific calculator", 180, "east-london", "tech", null, "2026-10-10T07:55:00Z"),
  listing("l-025", "Accounting 2 tutor, two hours", 240, "durban-umhlanga", "tutoring", "trusted", "2026-10-09T17:00:00Z"),
  listing("l-011", "Logo design for your hustle", 350, "midrand", "services", "responsive", "2026-10-09T15:10:00Z", { from: true }),
  listing("l-028", "Rugby jersey, size L", 200, "potchefstroom", "fashion-thrift", "responsive", "2026-10-09T13:20:00Z", { payMode: "both" }),
  listing("l-017", "Graph paper and highlighter bundle", 60, "pretoria", "stationery", null, "2026-10-09T09:40:00Z"),
  listing("l-012", "Matric dance tickets, a pair", 600, "midrand", "tickets-events", null, "2026-10-09T08:00:00Z"),
];
```

`data/fixtures/sellers.ts`:

```ts
import type { Seller } from "@/lib/types";

const seller = (
  slug: string,
  name: string,
  tagline: string,
  category: string,
  campusSlug: string,
  verified = true,
): Seller => ({
  slug,
  name,
  tagline,
  category,
  campusSlug,
  verified,
  image: { src: `/placeholders/seller/${slug}.svg`, alt: `The ${name.toLowerCase()} at work` },
});

// Generic names (spec 13), not the old demo's sellers. Only verified sellers are featured.
export const sellers: readonly Seller[] = [
  seller("hair-studio", "Hair studio", "Braids, cornrows and wash days on campus.", "Hair & beauty", "midrand"),
  seller("maths-tutor", "Maths tutor", "Exam prep that sticks, one hour at a time.", "Tutoring", "midrand"),
  seller("home-bakery", "Home bakery", "Cupcakes and cookie boxes for any occasion.", "Food", "midrand"),
  seller("design-studio", "Design studio", "Logos and posters for student hustles.", "Services", "midrand"),
  seller("thrift-rack", "Thrift rack", "Pre-loved jackets and denim, washed and pressed.", "Fashion & thrift", "pretoria"),
  seller("code-coach", "Code coach", "Python and Java help before your practicals.", "Tutoring", "pretoria"),
  seller("phone-fix", "Phone fix", "Cracked screens and batteries, same day.", "Services", "bedfordview"),
  seller("nail-bar", "Nail bar", "Gel, acrylics and nail art between lectures.", "Hair & beauty", "cape-town-tyger-valley"),
  seller("study-notes", "Study notes", "Typed summaries for first-year modules.", "Textbooks & notes", "online"),
  seller("res-kitchen", "Res kitchen", "Home-cooked lunch boxes, ordered by 10am.", "Food", "durban-umhlanga", false),
];
```

`data/fixtures/requests.ts`:

```ts
import type { LookingForRequest } from "@/lib/types";

// Open Looking For requests, newest first.
export const requests: readonly LookingForRequest[] = [
  { id: "r-001", title: "Accounting 1 tutor this week", campusSlug: "midrand", offers: 2 },
  { id: "r-002", title: "Graphic calculator to borrow for exams", campusSlug: "pretoria", offers: 1 },
  { id: "r-003", title: "Birthday cake for Friday", campusSlug: "midrand", offers: 3 },
  { id: "r-004", title: "Second-hand bar fridge", campusSlug: "bedfordview", offers: 0 },
  { id: "r-005", title: "Someone to fix my laptop hinge", campusSlug: "cape-town-mowbray", offers: 1 },
  { id: "r-006", title: "Lift to campus on Monday mornings", campusSlug: "pretoria", offers: 2 },
  { id: "r-007", title: "Business Law 2 notes", campusSlug: "online", offers: 4 },
];
```

`data/fixtures/free-swaps.ts`:

```ts
import type { FreeSwapItem } from "@/lib/types";

const item = (id: string, kind: FreeSwapItem["kind"], title: string, campusSlug: string, categorySlug: string): FreeSwapItem => ({
  id,
  kind,
  title,
  campusSlug,
  image: { src: `/placeholders/listing/${categorySlug}.svg`, alt: title },
});

// Giveaways and swap-only items, newest first. Ids start "fs-" so they never clash with listings.
export const freeSwapItems: readonly FreeSwapItem[] = [
  item("fs-001", "free", "Business Management 1 notes", "midrand", "textbooks-notes"),
  item("fs-002", "swap", "Desk lamp, swap for a kettle", "pretoria", "res-living"),
  item("fs-003", "free", "Res curtains, two panels", "midrand", "res-living"),
  item("fs-004", "swap", "Logo design for a photo shoot", "online", "services"),
  item("fs-005", "free", "Hangers, bag of 20", "bedfordview", "res-living"),
  item("fs-006", "swap", "Calculator for a textbook", "cape-town-mowbray", "tech"),
  item("fs-007", "free", "Highlighters, half used", "east-london", "stationery"),
];
```

`data/fixtures/hub.ts`:

```ts
import type { HubBanner, HubEvent } from "@/lib/types";

export const hubBanner: HubBanner = {
  image: { src: "/placeholders/hub/banner.svg", alt: "" },
};

// Upcoming Incubation Hub events. "all" means every campus.
export const hubEvents: readonly HubEvent[] = [
  { id: "e-001", date: "2026-10-14", title: "Pitch night", campusSlug: "all", action: "rsvp" },
  { id: "e-002", date: "2026-10-15", title: "Office hours: pricing your hustle", campusSlug: "midrand", action: "book" },
  { id: "e-003", date: "2026-10-20", title: "Market day on the lawn", campusSlug: "pretoria", action: "rsvp" },
  { id: "e-004", date: "2026-10-22", title: "Photo day for your shop", campusSlug: "bedfordview", action: "book" },
  { id: "e-005", date: "2026-10-28", title: "Hub mixer", campusSlug: "all", action: "rsvp" },
];
```

`data/fixtures/viewer.ts`:

```ts
import type { ViewerActivity } from "@/lib/types";

// Sample activity for the signed-in context strip (spec 7.4), shown only behind the development switch.
export const sampleActivity: ViewerActivity = { newMessages: 2, salesToConfirm: 1, savedItemsBack: 1 };
```

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm test data/fixtures`
Expected: PASS (8 tests). Then run `pnpm typecheck`; it should exit 0.

- [ ] **Step 6: Commit**

Files: `lib/types.ts data/fixtures`
Message: `feat: add homepage types and sample fixtures for every campus`

---

### Task 3: Prices, dates, the fair daily draw and Eduvos Online

These are pure helpers the sections share, so they're easy to test on their own.

**Files:**
- Create: `lib/format.ts`, `lib/format.test.ts`, `lib/time.ts`, `lib/time.test.ts`, `lib/featured.ts`, `lib/featured.test.ts`
- Modify: `lib/campus.ts`, `lib/campus.test.ts`

- [ ] **Step 1: Write the failing tests**

`lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { badgeLabel, eventDate, formatRand, joinWords, offersLabel, priceLabel } from "./format";

describe("formatRand", () => {
  it("writes rand with commas between thousands, as the mockup does", () => {
    expect(formatRand(60)).toBe("R60");
    expect(formatRand(1200)).toBe("R1,200");
    expect(formatRand(1250000)).toBe("R1,250,000");
  });
});

describe("priceLabel", () => {
  it("shows the price, a 'From' price, or Swap", () => {
    expect(priceLabel({ priceZar: 250, priceIsFrom: false, payMode: "cash" })).toBe("R250");
    expect(priceLabel({ priceZar: 400, priceIsFrom: true, payMode: "cash" })).toBe("From R400");
    expect(priceLabel({ priceZar: 450, priceIsFrom: false, payMode: "both" })).toBe("R450");
    expect(priceLabel({ priceZar: null, priceIsFrom: false, payMode: "swap" })).toBe("Swap");
  });
});

describe("labels", () => {
  it("names the trust badges", () => {
    expect(badgeLabel("trusted")).toBe("Trusted");
    expect(badgeLabel("responsive")).toBe("Responsive");
    expect(badgeLabel("new-seller")).toBe("New seller");
  });

  it("counts offers in plain words", () => {
    expect(offersLabel(0)).toBe("No offers yet");
    expect(offersLabel(1)).toBe("1 offer");
    expect(offersLabel(3)).toBe("3 offers");
  });

  it("joins words into a sentence list", () => {
    expect(joinWords(["textbooks"])).toBe("textbooks");
    expect(joinWords(["textbooks", "tech"])).toBe("textbooks and tech");
    expect(joinWords(["textbooks", "tech", "services"])).toBe("textbooks, tech and services");
  });
});

describe("eventDate", () => {
  it("splits a YYYY-MM-DD date into the day and short month for the date block", () => {
    expect(eventDate("2026-10-05")).toEqual({ day: "5", month: "Oct" });
    expect(eventDate("2026-12-31")).toEqual({ day: "31", month: "Dec" });
  });
});
```

`lib/time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sastDate } from "./time";

describe("sastDate", () => {
  it("gives the date in South Africa (UTC+2), whatever the server's timezone", () => {
    expect(sastDate(new Date("2026-10-11T23:30:00Z"))).toBe("2026-10-12");
    expect(sastDate(new Date("2026-10-12T21:59:00Z"))).toBe("2026-10-12");
    expect(sastDate(new Date("2026-10-12T22:00:00Z"))).toBe("2026-10-13");
  });
});
```

`lib/featured.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Seller } from "./types";
import { dayNumber, drawFeatured } from "./featured";

const seller = (slug: string, campusSlug: string, verified = true): Seller => ({
  slug,
  name: slug,
  tagline: "",
  category: "Food",
  campusSlug,
  verified,
  image: { src: "/p.svg", alt: "" },
});

const sellers = [
  seller("a", "midrand"),
  seller("b", "midrand"),
  seller("c", "pretoria"),
  seller("d", "pretoria"),
  seller("e", "midrand", false),
  seller("f", "online"),
];

describe("dayNumber", () => {
  it("counts whole days since 1 January 1970", () => {
    expect(dayNumber("1970-01-02")).toBe(1);
    expect(dayNumber("2026-10-13") - dayNumber("2026-10-12")).toBe(1);
  });
});

describe("drawFeatured (spec 7.10)", () => {
  it("only features verified sellers", () => {
    expect(drawFeatured(sellers, "all", "2026-10-12", 10).map((s) => s.slug)).not.toContain("e");
  });

  it("starts one place further on each day, so every seller takes a turn", () => {
    const firstOn = (day: string) => drawFeatured(sellers, "all", day, 1)[0].slug;
    const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"];
    expect(new Set(week.map(firstOn)).size).toBe(5);
  });

  it("is the same all day", () => {
    expect(drawFeatured(sellers, "all", "2026-10-12")).toEqual(drawFeatured(sellers, "all", "2026-10-12"));
  });

  it("puts the campus's own sellers first, then tops up from other campuses", () => {
    const drawn = drawFeatured(sellers, "pretoria", "2026-10-12", 4);
    expect(drawn).toHaveLength(4);
    expect(drawn.slice(0, 2).map((s) => s.campusSlug)).toEqual(["pretoria", "pretoria"]);
  });
});
```

Add to `lib/campus.test.ts`. Add `isOnlineCampus` to its import from `./campus`:

```ts
describe("isOnlineCampus", () => {
  it("is true only for Eduvos Online", () => {
    expect(isOnlineCampus({ slug: "online" })).toBe(true);
    expect(isOnlineCampus({ slug: "midrand" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test lib/format.test.ts lib/time.test.ts lib/featured.test.ts lib/campus.test.ts`
Expected: FAIL. The new modules don't exist, and `isOnlineCampus` isn't exported.

- [ ] **Step 3: Write the helpers**

`lib/format.ts`:

```ts
import type { Listing, TrustBadge } from "./types";

/** Rand with commas between thousands, as the approved mockup shows ("R1,200"). */
export function formatRand(amount: number): string {
  return `R${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** "R250", "From R400" or "Swap" (spec 7.8). */
export function priceLabel(listing: Pick<Listing, "priceZar" | "priceIsFrom" | "payMode">): string {
  if (listing.priceZar === null || listing.payMode === "swap") return "Swap";
  const amount = formatRand(listing.priceZar);
  return listing.priceIsFrom ? `From ${amount}` : amount;
}

const BADGE_LABELS: Record<TrustBadge, string> = {
  trusted: "Trusted",
  responsive: "Responsive",
  "new-seller": "New seller",
};

export function badgeLabel(badge: TrustBadge): string {
  return BADGE_LABELS[badge];
}

export function offersLabel(offers: number): string {
  if (offers === 0) return "No offers yet";
  return offers === 1 ? "1 offer" : `${offers} offers`;
}

/** ["a", "b", "c"] → "a, b and c". */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-05" → { day: "5", month: "Oct" }, for an event's date block. No timezone maths: the date is already SAST. */
export function eventDate(date: string): { day: string; month: string } {
  const [, month, day] = date.split("-").map(Number);
  return { day: String(day), month: MONTHS[month - 1] };
}
```

`lib/time.ts`:

```ts
// Store UTC, render in Africa/Johannesburg (SAST, UTC+2, no daylight saving). Never rely on the server's timezone.
const SAST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Johannesburg",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The date in South Africa at `now`, as YYYY-MM-DD. */
export function sastDate(now: Date): string {
  return SAST_DATE.format(now);
}
```

`lib/featured.ts`:

```ts
import { ALL_CAMPUSES } from "./campus";
import type { CampusChoice, Seller } from "./types";

const DAY_MS = 86_400_000;

/** Whole days since 1 January 1970 for a YYYY-MM-DD date. */
export function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** The list rotated to start `dayNumber(day)` places on, so each day a different seller leads. */
function rotate(list: readonly Seller[], day: string): Seller[] {
  if (list.length === 0) return [];
  const start = dayNumber(day) % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

/**
 * The fair daily seller draw (spec 7.10). Verified sellers take turns: each day the order starts one place further
 * on, so nobody is favoured. The campus's own sellers come first, topped up from other campuses.
 */
export function drawFeatured(
  sellers: readonly Seller[],
  campus: CampusChoice,
  day: string,
  count = 4,
): Seller[] {
  const eligible = sellers.filter((seller) => seller.verified).sort((a, b) => a.slug.localeCompare(b.slug));
  if (campus === ALL_CAMPUSES) return rotate(eligible, day).slice(0, count);
  const own = rotate(
    eligible.filter((seller) => seller.campusSlug === campus),
    day,
  );
  const others = rotate(
    eligible.filter((seller) => seller.campusSlug !== campus),
    day,
  );
  return [...own, ...others].slice(0, count);
}
```

In `lib/campus.ts`, add below `export const ALL_CAMPUSES = "all";`:

```ts
/** Eduvos Online is listed with the campuses but shown apart from the 12 physical ones. */
export const ONLINE_CAMPUS = "online";

export function isOnlineCampus(campus: Pick<Campus, "slug">): boolean {
  return campus.slug === ONLINE_CAMPUS;
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `pnpm test lib/format.test.ts lib/time.test.ts lib/featured.test.ts lib/campus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Files: `lib/format.ts lib/format.test.ts lib/time.ts lib/time.test.ts lib/featured.ts lib/featured.test.ts lib/campus.ts lib/campus.test.ts`
Message: `feat: add price, SAST date and fair daily draw helpers`

---

### Task 4: The data functions and the viewer

These are the remaining functions from spec section 13, over the fixtures.
- **Cached functions** take plain arguments, so `"use cache"` keys on them.
- **`getViewerContext()`** reads the cookie, so it's request-time. Call it only inside `<Suspense>`. React's `cache()` makes it one cookie read per request.

**Files:**
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`
- Create: `lib/data/viewer.ts`, `lib/data/viewer.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `lib/data/index.test.ts`, first extending its import:

```ts
import {
  getAnnouncements,
  getCampuses,
  getCategories,
  getCollections,
  getFeatured,
  getFreeAndSwaps,
  getHeroSlides,
  getHubBanner,
  getHubEvents,
  getJustListed,
  getListing,
  getListingIds,
  getRequests,
  getSeller,
  getSellerSlugs,
  getTrendingSearches,
} from "./index";
```

Then add this block:

```ts
describe("homepage data", () => {
  it("has the hero slides and four collections", async () => {
    expect((await getHeroSlides()).map((slide) => slide.word)).toEqual(["textbooks", "tech", "services"]);
    expect(await getCollections()).toHaveLength(4);
    expect((await getHubBanner()).image.alt).toBe("");
  });

  it("lists the newest listings first, at one campus or every campus", async () => {
    const all = await getJustListed({ campus: "all", limit: 10 });
    expect(all).toHaveLength(10);
    const times = all.map((listing) => listing.createdAt);
    expect(times).toEqual([...times].sort().reverse());

    const midrand = await getJustListed({ campus: "midrand", limit: 10 });
    expect(midrand).toHaveLength(10);
    expect(midrand.every((listing) => listing.campusSlug === "midrand")).toBe(true);

    expect(await getJustListed({ campus: "mbombela", limit: 10 })).toEqual([]);
  });

  it("puts a campus's own requests and free and swap items first, then tops up", async () => {
    expect((await getRequests({ campus: "pretoria", limit: 3 })).map((r) => r.campusSlug)).toEqual([
      "pretoria",
      "pretoria",
      "midrand",
    ]);
    expect((await getFreeAndSwaps({ campus: "pretoria", limit: 3 })).map((item) => item.campusSlug)).toEqual([
      "pretoria",
      "midrand",
      "midrand",
    ]);
    expect(await getRequests({ campus: "all", limit: 2 })).toHaveLength(2);
  });

  it("lists a campus's events with the every-campus ones, soonest first", async () => {
    expect((await getHubEvents({ campus: "midrand", limit: 3 })).map((event) => event.id)).toEqual([
      "e-001",
      "e-002",
      "e-005",
    ]);
    expect((await getHubEvents({ campus: "mbombela", limit: 3 })).map((event) => event.id)).toEqual(["e-001", "e-005"]);
    expect((await getHubEvents({ campus: "all", limit: 3 })).map((event) => event.id)).toEqual([
      "e-001",
      "e-002",
      "e-003",
    ]);
  });

  it("draws four verified sellers for the day, the campus's own first", async () => {
    const featured = await getFeatured({ campus: "midrand", day: "2026-10-12" });
    expect(featured).toHaveLength(4);
    expect(featured.every((seller) => seller.verified && seller.campusSlug === "midrand")).toBe(true);
  });

  it("finds listing pages for listings and free and swap items", async () => {
    expect(await getListing("l-001")).toMatchObject({ title: "Casio fx-991ZA Plus calculator", campusSlug: "midrand" });
    expect(await getListing("fs-002")).toMatchObject({ title: "Desk lamp, swap for a kettle" });
    expect(await getListing("nope")).toBeNull();
    const ids = await getListingIds();
    expect(ids).toContain("l-001");
    expect(ids).toContain("fs-001");
  });

  it("finds sellers by slug", async () => {
    expect(await getSeller("hair-studio")).toMatchObject({ name: "Hair studio" });
    expect(await getSeller("nope")).toBeNull();
    expect(await getSellerSlugs()).toContain("maths-tutor");
  });
});
```

`lib/data/viewer.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getViewerContext } from "./viewer";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "vossie_campus" && cookieValue.current ? { value: cookieValue.current } : undefined),
  }),
}));

afterEach(() => {
  cookieValue.current = undefined;
  vi.unstubAllEnvs();
});

describe("getViewerContext", () => {
  it("reads the chosen campus from the cookie", async () => {
    cookieValue.current = "midrand";
    expect(await getViewerContext()).toEqual({ campus: "midrand", signedIn: false, activity: null });
  });

  it("treats a missing or unknown campus as all campuses", async () => {
    expect((await getViewerContext()).campus).toBe("all");
    cookieValue.current = "atlantis";
    expect((await getViewerContext()).campus).toBe("all");
  });

  it("shows sample activity only behind the development switch", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_SIGNED_IN", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(await getViewerContext()).toMatchObject({ signedIn: true, activity: { newMessages: 2 } });
    vi.stubEnv("NODE_ENV", "production");
    expect((await getViewerContext()).signedIn).toBe(false);
  });
});
```

The cookie store is mocked, so this runs in the usual jsdom environment. Don't switch it to `node`: the shared setup file's clean-up touches `localStorage` and `document` after every test.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test lib/data`
Expected: FAIL. The new functions and `./viewer` don't exist.

- [ ] **Step 3: Write the data functions**

In `lib/data/index.ts`:

1. **Replace the imports** with:

```ts
import { announcements } from "@/data/fixtures/announcements";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { collections } from "@/data/fixtures/collections";
import { freeSwapItems } from "@/data/fixtures/free-swaps";
import { heroSlides } from "@/data/fixtures/hero";
import { hubBanner, hubEvents } from "@/data/fixtures/hub";
import { listings } from "@/data/fixtures/listings";
import { requests } from "@/data/fixtures/requests";
import { sellers } from "@/data/fixtures/sellers";
import { trendingSearches } from "@/data/fixtures/trending";
import { ALL_CAMPUSES } from "@/lib/campus";
import { drawFeatured } from "@/lib/featured";
import type {
  Announcement,
  Campus,
  CampusChoice,
  Category,
  Collection,
  FreeSwapItem,
  HeroSlide,
  HubBanner,
  HubEvent,
  Listing,
  ListingSummary,
  LookingForRequest,
  Seller,
  TrendingSearches,
} from "@/lib/types";
```

2. **Append:**

```ts
type CampusQuery = { campus: CampusChoice; limit: number };

/** Up to `limit` items, the campus's own first, topped up from every other campus. */
function campusFirst<T extends { campusSlug: string }>(items: readonly T[], campus: CampusChoice, limit: number): T[] {
  if (campus === ALL_CAMPUSES) return items.slice(0, limit);
  const own = items.filter((item) => item.campusSlug === campus);
  const others = items.filter((item) => item.campusSlug !== campus);
  return [...own, ...others].slice(0, limit);
}

export async function getHeroSlides(): Promise<readonly HeroSlide[]> {
  "use cache";
  return heroSlides;
}

export async function getCollections(): Promise<readonly Collection[]> {
  "use cache";
  return collections;
}

/** The newest listings at one campus, or at every campus for "all" (spec 7.8). */
export async function getJustListed({ campus, limit }: CampusQuery): Promise<readonly Listing[]> {
  "use cache";
  return listings
    .filter((listing) => campus === ALL_CAMPUSES || listing.campusSlug === campus)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) // ISO times in UTC sort as text
    .slice(0, limit);
}

/** Today's featured sellers (spec 7.10). `day` is the SAST date, so the draw changes at midnight in South Africa. */
export async function getFeatured({ campus, day }: { campus: CampusChoice; day: string }): Promise<readonly Seller[]> {
  "use cache";
  return drawFeatured(sellers, campus, day);
}

export async function getRequests({ campus, limit }: CampusQuery): Promise<readonly LookingForRequest[]> {
  "use cache";
  return campusFirst(requests, campus, limit);
}

export async function getFreeAndSwaps({ campus, limit }: CampusQuery): Promise<readonly FreeSwapItem[]> {
  "use cache";
  return campusFirst(freeSwapItems, campus, limit);
}

/** The next Hub events for a campus: its own and the every-campus ones, soonest first (spec 7.13). */
export async function getHubEvents({ campus, limit }: CampusQuery): Promise<readonly HubEvent[]> {
  "use cache";
  // The sample events are all upcoming. With live data, leave out past dates (SAST) in the query.
  return hubEvents
    .filter((event) => campus === ALL_CAMPUSES || event.campusSlug === ALL_CAMPUSES || event.campusSlug === campus)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

export async function getHubBanner(): Promise<HubBanner> {
  "use cache";
  return hubBanner;
}

/** A listing page's summary, for regular listings and free and swap items alike. */
export async function getListing(id: string): Promise<ListingSummary | null> {
  "use cache";
  const found = listings.find((listing) => listing.id === id) ?? freeSwapItems.find((item) => item.id === id);
  return found ? { id: found.id, title: found.title, campusSlug: found.campusSlug, image: found.image } : null;
}

export async function getListingIds(): Promise<readonly string[]> {
  "use cache";
  return [...listings, ...freeSwapItems].map((item) => item.id);
}

export async function getSeller(slug: string): Promise<Seller | null> {
  "use cache";
  return sellers.find((seller) => seller.slug === slug) ?? null;
}

export async function getSellerSlugs(): Promise<readonly string[]> {
  "use cache";
  return sellers.map((seller) => seller.slug);
}
```

`lib/data/viewer.ts`:

```ts
import { cookies } from "next/headers";
import { cache } from "react";
import { sampleActivity } from "@/data/fixtures/viewer";
import { CAMPUS_COOKIE, parseCampusChoice } from "@/lib/campus";
import type { Viewer } from "@/lib/types";
import { getCampuses } from "./index";

/**
 * Who is looking (spec section 13): the campus from the vossie_campus cookie, and whether they're signed in.
 *
 * Request-time: call it only inside <Suspense>, or the page can't be prerendered. React's cache() makes it one
 * cookie read per request. There are no accounts yet: VOSSIE_SAMPLE_SIGNED_IN=1 shows the signed-in context strip
 * with sample activity, in development only.
 */
export const getViewerContext = cache(async (): Promise<Viewer> => {
  const [store, campuses] = await Promise.all([cookies(), getCampuses()]);
  const campus = parseCampusChoice(store.get(CAMPUS_COOKIE)?.value, campuses);
  const signedIn = process.env.NODE_ENV !== "production" && process.env.VOSSIE_SAMPLE_SIGNED_IN === "1";
  return { campus, signedIn, activity: signedIn ? sampleActivity : null };
});
```

- [ ] **Step 4: Run them and watch them pass**

Run: `pnpm test lib/data`
Expected: PASS. Then run `pnpm typecheck` and `pnpm lint`, one at a time. Both should exit 0.

- [ ] **Step 5: Check the build**

Run: `pnpm build`
Expected: exit 0. `/` is still static, because nothing calls `getViewerContext()` yet.

- [ ] **Step 6: Commit**

Files: `lib/data/index.ts lib/data/index.test.ts lib/data/viewer.ts lib/data/viewer.test.ts`
Message: `feat: add the homepage data functions and the request-time viewer`

---

### Task 5: Placeholder art at the final ratios

Spec section 12 says Lama supplies the photos after the homepage is built. Until then, every image slot shows clearly labelled placeholder art at its final ratio. Swapping in a real photo is then a file drop plus one line in a fixture, and the layout doesn't change.

The script reads the fixtures, so the art can never drift from the data. A test then checks every image the data points at exists.

**Files:**
- Modify: `tsconfig.json` (Node runs `.ts` files directly, but only with explicit `.ts` import paths)
- Create: `scripts/make-placeholders.ts`, `lib/data/placeholders.test.ts`
- Create (generated): `public/placeholders/**`

- [ ] **Step 1: Write the failing test, `lib/data/placeholders.test.ts`**

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sellers } from "@/data/fixtures/sellers";
import {
  getCampuses,
  getCategories,
  getCollections,
  getFreeAndSwaps,
  getHeroSlides,
  getHubBanner,
  getJustListed,
} from "./index";

describe("placeholder art (spec section 12)", () => {
  it("exists for every image the data points at", async () => {
    const sources = [
      ...(await getCampuses()).map((campus) => campus.image.src),
      ...(await getCategories()).map((category) => category.image.src),
      ...(await getCollections()).map((collection) => collection.image.src),
      ...(await getHeroSlides()).map((slide) => slide.image.src),
      (await getHubBanner()).image.src,
      ...(await getJustListed({ campus: "all", limit: 1000 })).map((listing) => listing.image.src),
      ...(await getFreeAndSwaps({ campus: "all", limit: 1000 })).map((item) => item.image.src),
      ...sellers.map((seller) => seller.image.src),
    ];
    const missing = sources.filter((src) => !existsSync(join(process.cwd(), "public", src)));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test lib/data/placeholders.test.ts`
Expected: FAIL, listing every missing file.

- [ ] **Step 3: Let TypeScript accept `.ts` import paths**

In `tsconfig.json` → `compilerOptions`, add after `"noEmit": true,`:

```json
    "allowImportingTsExtensions": true,
```

This is allowed because `noEmit` is on. Node needs the explicit `.ts` paths the script uses.

- [ ] **Step 4: Write `scripts/make-placeholders.ts`**

```ts
// Writes the labelled placeholder art the fixtures point at (spec section 12), at the final ratios. Swapping in a real
// photo later changes no layout: drop the file in and change its src in the fixture.
// Run from the project root: node scripts/make-placeholders.ts   (Node 26 runs TypeScript directly.)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { campuses } from "../data/fixtures/campuses.ts";
import { categories } from "../data/fixtures/categories.ts";
import { collections } from "../data/fixtures/collections.ts";
import { freeSwapItems } from "../data/fixtures/free-swaps.ts";
import { heroSlides } from "../data/fixtures/hero.ts";
import { hubBanner } from "../data/fixtures/hub.ts";
import { listings } from "../data/fixtures/listings.ts";
import { sellers } from "../data/fixtures/sellers.ts";

type Art = { label: string | null; width: number; height: number };

// Final ratios from spec section 12. The phone hero crops the 16:10 art to 4:3; listing art is cropped to each card.
const SIZES: Record<string, [number, number]> = {
  hero: [1600, 1000],
  campus: [1200, 1200],
  category: [800, 800],
  collection: [960, 1200],
  hub: [2400, 1029],
  seller: [1000, 750],
  listing: [800, 800],
};

// Tiles and cards print their own text over or beside these, so only the larger photos carry a label.
const LABELLED = new Set(["hero", "campus", "collection", "hub", "seller"]);

const art = new Map<string, Art>();

function add(src: string, label: string) {
  const folder = src.split("/")[2]; // "/placeholders/<folder>/<file>.svg"
  const size = SIZES[folder];
  if (!size) throw new Error(`No size for ${src}`);
  if (!art.has(src)) art.set(src, { label: LABELLED.has(folder) ? label : null, width: size[0], height: size[1] });
}

for (const slide of heroSlides) add(slide.image.src, `Photo: ${slide.word}`);
for (const campus of campuses) add(campus.image.src, `Photo: ${campus.name}`);
for (const category of categories) add(category.image.src, category.name);
for (const collection of collections) add(collection.image.src, `Photo: ${collection.eyebrow}`);
for (const seller of sellers) add(seller.image.src, `Photo: ${seller.name}`);
for (const listing of listings) add(listing.image.src, listing.title);
for (const item of freeSwapItems) add(item.image.src, item.title);
add(hubBanner.image.src, "Photo: the Incubation Hub");

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The mockup's placeholder look: a navy-to-sky gradient with faint diagonal stripes.
function svg({ label, width, height }: Art): string {
  const fontSize = Math.round(Math.min(width, height) / 18);
  const text = label
    ? `<text x="50%" y="50%" fill="#ffffff" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="600" letter-spacing="1" text-anchor="middle" dominant-baseline="middle">${escapeXml(label.toUpperCase())}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d3a68"/><stop offset=".55" stop-color="#2c6197"/><stop offset="1" stop-color="#7cbadc"/></linearGradient>
<pattern id="s" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="16" fill="#ffffff" fill-opacity=".06"/></pattern>
</defs>
<rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#s)"/>${text}
</svg>
`;
}

for (const [src, item] of art) {
  const file = join("public", src);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, svg(item));
}

console.log(`Wrote ${art.size} placeholders under public/placeholders.`);
```

- [ ] **Step 5: Generate the art**

Run: `ls public 2>&1`. Expected: `public/icons` exists from Part 1, and there's no `public/placeholders` yet. If it exists, stop and report.

Run: `node scripts/make-placeholders.ts`
Expected: `Wrote 51 placeholders under public/placeholders.`
- 3 hero, 13 campus, 10 category, 4 collection, 10 seller, 1 hub;
- the 10 listing categories, shared by listings and free and swap items: Tech, Textbooks & notes, Tutoring, Food, Res & living, Services, Hair & beauty, Fashion & thrift, Stationery, Tickets & events.

Open `public/placeholders/hero/textbooks.svg` and `public/placeholders/campus/midrand.svg` with the Read tool. Each should be a navy-to-sky gradient with a centred white label.

- [ ] **Step 6: Run the test and watch it pass**

Run: `pnpm test lib/data/placeholders.test.ts`
Expected: PASS. Then run `pnpm typecheck`; it should exit 0.

- [ ] **Step 7: Commit**

Files: `tsconfig.json scripts/make-placeholders.ts lib/data/placeholders.test.ts public/placeholders`
Message: `feat: generate labelled placeholder art at the final photo ratios`

---

### Task 6: Device stores for hearts and recently viewed

The save heart needs a yes-or-no hook. `readSavedIds()` returns a new array on every call, so it can't feed `useSyncExternalStore` directly.

The context strip needs the listings viewed on this device. They're stored in `localStorage` only, as POPIA requires.

**Files:**
- Create: `lib/recently-viewed.ts`, `lib/recently-viewed.test.ts`
- Create: `hooks/useIsSaved.ts`, `hooks/useRecentlyViewed.ts`, `hooks/home-hooks.test.tsx`

- [ ] **Step 1: Write the failing tests**

`lib/recently-viewed.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  getRecentlyViewed,
  recordRecentlyViewed,
  RECENTLY_VIEWED_KEY,
  subscribeRecentlyViewed,
  type ViewedItem,
} from "./recently-viewed";

const item = (id: string): ViewedItem => ({ id, title: `Item ${id}`, image: { src: `/placeholders/listing/${id}.svg`, alt: "" } });

describe("recently viewed on this device", () => {
  it("starts empty and survives broken storage", () => {
    expect(getRecentlyViewed()).toEqual([]);
    localStorage.setItem(RECENTLY_VIEWED_KEY, "{not json");
    expect(getRecentlyViewed()).toEqual([]);
  });

  it("keeps the newest first, moves a repeat to the front, and keeps six", () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "g"]) recordRecentlyViewed(item(id));
    recordRecentlyViewed(item("c"));
    expect(getRecentlyViewed().map((viewed) => viewed.id)).toEqual(["c", "g", "f", "e", "d", "b"]);
  });

  it("returns the same array until storage changes, as useSyncExternalStore needs", () => {
    recordRecentlyViewed(item("a"));
    expect(getRecentlyViewed()).toBe(getRecentlyViewed());
  });

  it("drops anything that isn't one of our own images, since storage can be edited by hand", () => {
    localStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify([item("a"), { id: "x", title: "X", image: { src: "https://evil.example/x.png", alt: "" } }, { id: 1 }]),
    );
    expect(getRecentlyViewed().map((viewed) => viewed.id)).toEqual(["a"]);
  });

  it("tells subscribers when something is recorded", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRecentlyViewed(listener);
    recordRecentlyViewed(item("a"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
```

`hooks/home-hooks.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { recordRecentlyViewed } from "@/lib/recently-viewed";
import { toggleSaved } from "@/lib/saved";
import { useIsSaved } from "./useIsSaved";
import { useRecentlyViewed } from "./useRecentlyViewed";

function ServerValues() {
  const saved = useIsSaved("l-001");
  const viewed = useRecentlyViewed();
  return <output>{`${saved}|${viewed.length}`}</output>;
}

describe("homepage device hooks", () => {
  it("useIsSaved follows saves on this device", () => {
    const { result } = renderHook(() => useIsSaved("l-001"));
    expect(result.current).toBe(false);
    act(() => {
      toggleSaved("l-001");
    });
    expect(result.current).toBe(true);
  });

  it("useRecentlyViewed follows listings viewed on this device", () => {
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current).toEqual([]);
    act(() => recordRecentlyViewed({ id: "l-001", title: "Calculator", image: { src: "/p.svg", alt: "" } }));
    expect(result.current.map((item) => item.id)).toEqual(["l-001"]);
  });

  it("render nothing saved and nothing viewed on the server", () => {
    localStorage.setItem("vossie_saved", JSON.stringify(["l-001"]));
    expect(renderToString(<ServerValues />)).toContain("false|0");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test lib/recently-viewed.test.ts hooks/home-hooks.test.tsx`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Write the store and hooks**

`lib/recently-viewed.ts`:

```ts
import type { ImageRef } from "./types";

export const RECENTLY_VIEWED_KEY = "vossie_recently_viewed";
const MAX_ITEMS = 6;

/** What the context strip needs to show a listing again. Kept on this device only (POPIA: it never leaves it). */
export type ViewedItem = { id: string; title: string; image: ImageRef };

const EMPTY: readonly ViewedItem[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedItems: readonly ViewedItem[] = EMPTY;

function readRaw(): string | null {
  try {
    return localStorage.getItem(RECENTLY_VIEWED_KEY);
  } catch {
    return null;
  }
}

function isViewedItem(value: unknown): value is ViewedItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as { id?: unknown; title?: unknown; image?: { src?: unknown; alt?: unknown } | null };
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.image === "object" &&
    item.image !== null &&
    typeof item.image.alt === "string" &&
    typeof item.image.src === "string" &&
    // Only our own files: next/image refuses unknown hosts, and storage can be edited by hand.
    item.image.src.startsWith("/") &&
    !item.image.src.startsWith("//")
  );
}

function parse(raw: string | null): readonly ViewedItem[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isViewedItem).slice(0, MAX_ITEMS) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Listings viewed on this device, newest first. The same array until storage changes, as useSyncExternalStore needs. */
export function getRecentlyViewed(): readonly ViewedItem[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = parse(raw);
  }
  return cachedItems;
}

export function recordRecentlyViewed(item: ViewedItem): void {
  const rest = getRecentlyViewed().filter((existing) => existing.id !== item.id);
  try {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify([item, ...rest].slice(0, MAX_ITEMS)));
  } catch {
    return; // Storage blocked: the strip just won't remember this one.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeRecentlyViewed(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    // A null key means another tab cleared all storage.
    if (event.key === RECENTLY_VIEWED_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
```

`hooks/useIsSaved.ts`:

```ts
import { useSyncExternalStore } from "react";
import { isSaved, subscribeSaved } from "@/lib/saved";

const notSavedOnServer = () => false;

/** Whether one listing is saved on this device. A yes-or-no snapshot, so it's safe for useSyncExternalStore. */
export function useIsSaved(id: string): boolean {
  return useSyncExternalStore(subscribeSaved, () => isSaved(id), notSavedOnServer);
}
```

`hooks/useRecentlyViewed.ts`:

```ts
import { useSyncExternalStore } from "react";
import { getRecentlyViewed, subscribeRecentlyViewed, type ViewedItem } from "@/lib/recently-viewed";

const NONE: readonly ViewedItem[] = [];
const noneOnServer = () => NONE;

export function useRecentlyViewed(): readonly ViewedItem[] {
  return useSyncExternalStore(subscribeRecentlyViewed, getRecentlyViewed, noneOnServer);
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `pnpm test lib/recently-viewed.test.ts hooks/home-hooks.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

Files: `lib/recently-viewed.ts lib/recently-viewed.test.ts hooks/useIsSaved.ts hooks/useRecentlyViewed.ts hooks/home-hooks.test.tsx`
Message: `feat: add device stores for saved hearts and recently viewed listings`

---

### Task 7: One way to choose a campus

Choosing a campus does the same thing from the picker, the hero chip and Shop by campus:
1. remember it;
2. confirm it with a toast;
3. re-render the campus-aware server sections with `router.refresh()`.

That last step is handoff item 2. The picker and the new pieces share one hook.

**Files:**
- Create: `hooks/useChooseCampus.ts`, `hooks/useChooseCampus.test.tsx`
- Create: `components/campus/CampusPickerButton.tsx`, `components/campus/CampusPickerButton.test.tsx`
- Modify: `components/campus/CampusPicker.tsx`, `components/campus/CampusPicker.test.tsx`

- [ ] **Step 1: Write the failing tests**

`hooks/useChooseCampus.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getCampusCookieValue } from "@/lib/campus";
import { getToast } from "@/lib/toast";
import { useChooseCampus } from "./useChooseCampus";

// The shared setup's router mock can't be asserted on, so this file has its own.
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const campuses = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

describe("useChooseCampus", () => {
  it("remembers the campus, confirms it and re-renders the campus-aware sections", () => {
    const { result } = renderHook(() => useChooseCampus(campuses));
    act(() => result.current("midrand"));
    expect(getCampusCookieValue()).toBe("midrand");
    expect(getToast()?.message).toBe("Showing Midrand first");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("confirms all campuses in words", () => {
    const { result } = renderHook(() => useChooseCampus(campuses));
    act(() => result.current("all"));
    expect(getToast()?.message).toBe("Showing all campuses");
  });
});
```

`components/campus/CampusPickerButton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { onOverlayOpen } from "@/lib/overlays";
import { CampusPickerButton } from "./CampusPickerButton";

describe("CampusPickerButton", () => {
  it("opens the campus picker and hands it the button, so focus can come back", async () => {
    const user = userEvent.setup();
    const opened = vi.fn();
    const stop = onOverlayOpen("campus", opened);
    render(<CampusPickerButton className="chip">Shopping at Midrand</CampusPickerButton>);
    const button = screen.getByRole("button", { name: "Shopping at Midrand" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(button);
    expect(opened).toHaveBeenCalledWith(button);
    stop();
  });
});
```

In `components/campus/CampusPicker.test.tsx`, add the same `router` hoisted mock and `vi.mock("next/navigation", …)` as above, below the imports, and add `vi` to the vitest import if it's missing. Then add this test, using the file's existing helper that opens the picker:

```tsx
  it("re-renders the campus-aware sections after a choice", async () => {
    const user = userEvent.setup();
    render(<CampusPicker campuses={campuses} />);
    const dialog = openPicker();
    await user.click(within(dialog).getByRole("button", { name: "Midrand, Gauteng" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
```

The file's helper is `openPicker(trigger?)`, and its fixture campuses include Midrand, Gauteng. The file already imports `vi`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test hooks/useChooseCampus.test.tsx components/campus`
Expected: FAIL. The hook and the button don't exist, and the picker never calls `refresh`.

- [ ] **Step 3: Write the hook and the button**

`hooks/useChooseCampus.ts`:

```ts
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { setCampusChoice } from "@/lib/campus";
import { showToast } from "@/lib/toast";
import type { Campus, CampusChoice } from "@/lib/types";

/**
 * Choose a campus (spec 6.4): remember it, confirm it, and re-render the campus-aware server sections.
 * Close any dialog first: a toast isn't announced while a modal is open.
 */
export function useChooseCampus(campuses: readonly Pick<Campus, "slug" | "name">[]) {
  const router = useRouter();
  return useCallback(
    (choice: CampusChoice) => {
      setCampusChoice(choice);
      const name = campuses.find((campus) => campus.slug === choice)?.name;
      showToast(name ? `Showing ${name} first` : "Showing all campuses");
      router.refresh();
    },
    [campuses, router],
  );
}
```

`components/campus/CampusPickerButton.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { openOverlay } from "@/lib/overlays";

/** Opens the campus picker. Lets a Server Component render its own label (the hero chip reads the campus on the server). */
export function CampusPickerButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => openOverlay("campus", event.currentTarget)}
      className={className}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Use the hook in the picker**

In `components/campus/CampusPicker.tsx`:
1. Replace `import { ALL_CAMPUSES, setCampusChoice } from "@/lib/campus";` with `import { ALL_CAMPUSES } from "@/lib/campus";`.
2. Remove `import { showToast } from "@/lib/toast";`.
3. Add `import { useChooseCampus } from "@/hooks/useChooseCampus";`.
4. Below `const choice = useCampusChoice(campuses);`, add `const chooseCampus = useChooseCampus(campuses);`.
5. Replace the whole `choose` function with:

```tsx
  function choose(next: CampusChoice) {
    // Close first, so the confirmation toast isn't hidden behind the modal from screen readers.
    close();
    chooseCampus(next);
  }
```

- [ ] **Step 5: Run them and watch them pass**

Run: `pnpm test hooks components/campus components/menu components/header`
Expected: PASS. The menu and header tests open the picker indirectly, so check they still pass. Then run `pnpm typecheck` and `pnpm lint`, one at a time.

- [ ] **Step 6: Commit**

Files: `hooks/useChooseCampus.ts hooks/useChooseCampus.test.tsx components/campus/CampusPickerButton.tsx components/campus/CampusPickerButton.test.tsx components/campus/CampusPicker.tsx components/campus/CampusPicker.test.tsx`
Message: `feat: one way to choose a campus, which re-renders campus-aware sections`

---

### Task 8: The homepage frame and shared pieces

These are the pieces every section uses:
- **a header:** an eyebrow, an optional H2, and a link;
- **`Photo`:** a photo in a fixed-ratio box;
- **an error state;**
- **CSS:** the page column, section spacing and skeletons.

`app/page.tsx` changes in Task 11, when the hero arrives.

**Files:**
- Create: `components/home/SectionHeader.tsx`, `components/home/Photo.tsx`, `components/home/SectionError.tsx`, `components/home/shared.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing test, `components/home/shared.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Photo } from "./Photo";
import { SectionError } from "./SectionError";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("makes the title the H2 when there is one, with the eyebrow above it", () => {
    render(<SectionHeader id="just-listed" eyebrow="Just listed" title="New at Midrand" />);
    const heading = screen.getByRole("heading", { level: 2, name: "New at Midrand" });
    expect(heading).toHaveAttribute("id", "just-listed-title");
    expect(screen.getByText("Just listed")).toHaveClass("eyebrow");
  });

  it("makes the eyebrow itself the H2 when there's no title", () => {
    render(<SectionHeader id="categories" eyebrow="Shop by category" />);
    expect(screen.getByRole("heading", { level: 2, name: "Shop by category" })).toHaveClass("eyebrow");
  });

  it("gives its link extra words for screen readers, so two 'See all' links differ", () => {
    render(<SectionHeader id="x" eyebrow="X" link={{ href: "/browse", label: "See all", context: " new listings" }} />);
    expect(screen.getByRole("link", { name: "See all new listings" })).toHaveAttribute("href", "/browse");
  });

  it("uses navy eyebrows on grey, pale and sky panels", () => {
    render(<SectionHeader id="x" eyebrow="Free & swaps" title="Pass it on" tone="navy" />);
    expect(screen.getByText("Free & swaps")).toHaveClass("text-navy");
  });
});

describe("Photo", () => {
  it("shows the image in a fixed-ratio box", () => {
    const { container } = render(
      <Photo image={{ src: "/placeholders/campus/midrand.svg", alt: "Midrand campus" }} ratio="1 / 1" sizes="300px" />,
    );
    expect(screen.getByRole("img", { name: "Midrand campus" })).toHaveAttribute("src", "/placeholders/campus/midrand.svg");
    // A custom property, which jsdom keeps (it drops aspect-ratio itself).
    expect(container.querySelector<HTMLElement>(".photo")!.style.getPropertyValue("--photo-ratio")).toBe("1 / 1");
  });
});

describe("SectionError", () => {
  it("says what didn't load and offers a reload that comes back to the section", () => {
    render(<SectionError id="just-listed" title="Just listed" />);
    expect(screen.getByText("Just listed didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/?retry=just-listed#just-listed");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/home/shared.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 3: Write the pieces**

`components/home/SectionHeader.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type SectionHeaderProps = {
  /** The H2 gets the id `${id}-title`, which the section's aria-labelledby points at. */
  id: string;
  eyebrow: string;
  /** The large heading. Without it, the eyebrow itself is the section's H2. */
  title?: string;
  /** "navy" on grey, pale and sky panels, where sky-dark fails contrast. */
  tone?: "default" | "navy";
  align?: "start" | "center";
  /** `context` is read after the label by screen readers only, e.g. " new listings". */
  link?: { href: string; label: string; context?: string };
  /** Extra controls beside the link, such as the Just listed switch. */
  children?: ReactNode;
};

/** A section's eyebrow, heading and "See all" link (spec section 7). */
export function SectionHeader({ id, eyebrow, title, tone = "default", align = "start", link, children }: SectionHeaderProps) {
  const eyebrowClass = cx("eyebrow", tone === "navy" && "text-navy");
  return (
    <div className={cx("section-head", align === "center" && "section-head-center")}>
      <div>
        {title ? (
          <>
            <p className={eyebrowClass}>{eyebrow}</p>
            <h2 id={`${id}-title`} tabIndex={-1} className="section-title">
              {title}
            </h2>
          </>
        ) : (
          <h2 id={`${id}-title`} tabIndex={-1} className={eyebrowClass}>
            {eyebrow}
          </h2>
        )}
      </div>
      {(link || children) && (
        <div className="section-head-side">
          {children}
          {link && (
            <Link href={link.href} className="section-link">
              {link.label}
              {link.context && <span className="sr-only">{link.context}</span>}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
```

`tabIndex={-1}` lets code move focus to a section's heading. Choosing a campus in Shop by campus does that with Just listed.

`components/home/Photo.tsx`:

```tsx
import Image from "next/image";
import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import type { ImageRef } from "@/lib/types";

type PhotoProps = {
  image: ImageRef;
  /** CSS aspect ratio, e.g. "1 / 1". Leave it out when CSS sizes the box. */
  ratio?: string;
  /** How wide the photo shows at each breakpoint, for the srcset. Always set it. */
  sizes: string;
  className?: string;
  /** Only the hero's first photo: fetch it straight away and early. */
  priority?: boolean;
};

/** A photo in a box of fixed ratio over a pale preview (spec section 9), so nothing moves while it loads. */
export function Photo({ image, ratio, sizes, className, priority = false }: PhotoProps) {
  return (
    <span className={cx("photo", className)} style={ratio ? ({ "--photo-ratio": ratio } as CSSProperties) : undefined}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className="photo-img"
      />
    </span>
  );
}
```

`components/home/SectionError.tsx`:

```tsx
/**
 * A section's error state (spec section 9). One failing section never blanks the page. "Try again" reloads the page
 * and comes back to this section: the query string makes it a fresh request, and the hash scrolls back.
 */
export function SectionError({ id, title }: { id: string; title: string }) {
  return (
    <div className="section-error">
      <p>{title} didn&apos;t load.</p>
      <a href={`/?retry=${id}#${id}`} className="btn btn-outline text-navy">
        Try again
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/home/shared.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Add the frame CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: frame and shared pieces (Part 2, Task 8, spec sections 4, 7 and 9) --- */
@layer components {
  /* The page column: 1200px of content, with 10px gutters on phones and 24px from the tablet step (spec section 4). */
  .home {
    width: 100%;
    max-width: calc(var(--container-page) + 48px);
    margin-inline: auto;
    padding-inline: 10px;
  }

  /* Sections sit 52-56px apart on phones and 72-92px apart on desktop. Text sections add 6px (phones) or 16px
     (tablet up) to reach the mockup's 16px and 40px content edge. Panels (.home-panel) sit on the column's edge. */
  .home-section,
  .home-panel {
    margin-top: clamp(3.25rem, 2.6rem + 2.4vw, 5.5rem);
  }

  .home-section {
    padding-inline: 6px;
  }

  .section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px 20px;
  }

  .section-head-center {
    justify-content: center;
    text-align: center;
  }

  .section-head-side {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 18px;
  }

  .section-title {
    margin-top: 6px;
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
  }

  /* A heading only takes focus from code (tabindex -1), so it needs no ring. */
  .section-title:focus,
  .section-head h2:focus {
    outline: none;
  }

  .section-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-navy);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    text-decoration: underline 1.5px;
    text-underline-offset: 5px;
    white-space: nowrap;
  }

  .photo {
    position: relative;
    display: block;
    aspect-ratio: var(--photo-ratio, auto);
    overflow: hidden;
    background: var(--color-pale);
  }

  .photo-img {
    object-fit: cover;
  }

  /* Skeletons keep the final size while a section streams in (spec section 9). They don't shimmer: nothing loops
     for decoration (spec section 8). */
  .skeleton {
    display: block;
    border-radius: 8px;
    background: var(--color-panel);
  }

  .section-error {
    display: grid;
    justify-items: start;
    gap: 12px;
    margin-top: 16px;
    padding: 20px;
    border: 1.5px dashed var(--color-line);
    border-radius: var(--radius-card);
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .home {
      padding-inline: 24px;
    }

    .home-section {
      padding-inline: 16px;
    }
  }
}
```

- [ ] **Step 6: Check and commit**

Run `pnpm lint`, then `pnpm build`, one at a time. Both should exit 0.

Files: `components/home/SectionHeader.tsx components/home/Photo.tsx components/home/SectionError.tsx components/home/shared.test.tsx app/globals.css`
Message: `feat: add the homepage frame, section header, photo box and error state`

---

### Task 9: The carousel controller

Spec 7.5 and section 10 ask for swipe rows on all sizes, previous and next arrows on desktop, a progress bar underneath, and labelled regions that work by keyboard. This is the one small client component every carousel shares.
- **Scrolling** is native CSS scroll snapping, so swiping costs no JavaScript.
- **The component** only drives the arrows and the progress bar.
- **The slides** are Server Components passed in as children.

**Files:**
- Create: `components/home/Carousel.tsx`, `components/home/Carousel.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing test, `components/home/Carousel.test.tsx`**

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { Carousel } from "./Carousel";

const scrollBy = vi.fn();

beforeEach(() => {
  // jsdom can't scroll elements.
  Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, writable: true, value: scrollBy });
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1000);
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollBy");
});

function renderCarousel() {
  return render(
    <Carousel label="Categories" header={<h2>Shop by category</h2>}>
      <li>
        <a href="/categories/tech">Tech</a>
      </li>
      <li>
        <a href="/categories/food">Food</a>
      </li>
    </Carousel>,
  );
}

describe("Carousel", () => {
  it("is a labelled carousel region holding its slides and header", () => {
    renderCarousel();
    const region = screen.getByRole("region", { name: "Categories" });
    expect(region).toHaveAttribute("aria-roledescription", "carousel");
    expect(within(region).getAllByRole("listitem")).toHaveLength(2);
    expect(within(region).getByRole("heading", { name: "Shop by category" })).toBeInTheDocument();
  });

  it("names its buttons after what it shows, with Previous unavailable at the start", () => {
    renderCarousel();
    expect(screen.getByRole("button", { name: "Previous categories" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Next categories" })).toHaveAttribute("aria-disabled", "false");
  });

  it("scrolls most of a view smoothly, or straight there with reduced motion", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: "Next categories" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 850, behavior: "smooth" });

    mockMatchMedia((query) => query.includes("reduce"));
    await user.click(screen.getByRole("button", { name: "Next categories" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 850, behavior: "auto" });
  });

  it("leaves out the arrows and bar when asked", () => {
    render(
      <Carousel label="Sellers" controls={false}>
        <li>One</li>
      </Carousel>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/home/Carousel.test.tsx`
Expected: FAIL, because `./Carousel` can't be resolved.

- [ ] **Step 3: Write `components/home/Carousel.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { isMotionAllowedNow } from "@/hooks/useMotionAllowed";
import { cx } from "@/lib/cx";

type CarouselProps = {
  /** Names the region and its buttons: "Categories" gives "Previous categories" and "Next categories". */
  label: string;
  /** The section's heading and links, shown left of the arrows. */
  header?: ReactNode;
  /** The slides, each an <li>. */
  children: ReactNode;
  className?: string;
  /** The arrows (desktop only) and the progress bar. */
  controls?: boolean;
};

/**
 * A swipe row (spec 7.5 and section 10). Scrolling and snapping are native CSS. This component only moves the
 * arrows and the progress bar, and the slides stay Server Components.
 */
export function Carousel({ label, header, children, className, controls = true }: CarouselProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const max = track.scrollWidth - track.clientWidth;
      const visible = track.scrollWidth > 0 ? Math.min(1, track.clientWidth / track.scrollWidth) : 1;
      root.style.setProperty("--carousel-visible", visible.toFixed(3));
      root.style.setProperty("--carousel-progress", (max > 0 ? track.scrollLeft / max : 0).toFixed(3));
      const atStart = track.scrollLeft <= 1;
      const atEnd = track.scrollLeft >= max - 1;
      setEdges((current) => (current.atStart === atStart && current.atEnd === atEnd ? current : { atStart, atEnd }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(track);
    track.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      track.removeEventListener("scroll", schedule);
    };
  }, []);

  function page(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    if ((direction === -1 && edges.atStart) || (direction === 1 && edges.atEnd)) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: isMotionAllowedNow() ? "smooth" : "auto" });
  }

  const name = label.toLowerCase();

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cx("carousel", className)}
    >
      {(header || controls) && (
        <div className="carousel-head">
          <div className="carousel-header">{header}</div>
          {controls && (
            <div className="carousel-arrows">
              {/* aria-disabled, not disabled: a disabled button would drop keyboard focus at the end of the row. */}
              <button
                type="button"
                onClick={() => page(-1)}
                aria-label={`Previous ${name}`}
                aria-disabled={edges.atStart}
                className="carousel-arrow"
              >
                <ChevronLeftIcon className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => page(1)}
                aria-label={`Next ${name}`}
                aria-disabled={edges.atEnd}
                className="carousel-arrow"
              >
                <ChevronRightIcon className="size-5" />
              </button>
            </div>
          )}
        </div>
      )}
      <ul ref={trackRef} className="carousel-track">
        {children}
      </ul>
      {controls && (
        <div className="carousel-bar" aria-hidden="true">
          <span className="carousel-thumb" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/home/Carousel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the carousel CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: carousel (Part 2, Task 9, spec 7.5 and section 10) --- */
@layer components {
  .carousel-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px 20px;
  }

  .carousel-header {
    flex: 1;
    min-width: 0;
  }

  /* Arrows are for desktop; phones and tablets swipe (spec 7.5). */
  .carousel-arrows {
    display: none;
    gap: 10px;
  }

  .carousel-arrow {
    display: inline-grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
    color: var(--color-navy);
  }

  .carousel-arrow[aria-disabled="true"] {
    opacity: 0.35;
    cursor: default;
  }

  .carousel-track {
    display: flex;
    gap: var(--carousel-gap, 12px);
    margin-top: 16px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }

  .carousel-track::-webkit-scrollbar {
    display: none;
  }

  .carousel-track > li {
    flex: none;
    width: var(--carousel-item, 70%);
    scroll-snap-align: start;
  }

  /* The row clips anything outside it, so rings inside it are drawn just inside each slide. */
  .carousel-track :focus-visible {
    outline-offset: -3px;
  }

  .carousel-bar {
    position: relative;
    height: 3px;
    margin-top: 16px;
    overflow: hidden;
    border-radius: 2px;
    background: var(--color-line);
  }

  /* The thumb is as wide as the share of the row on screen, and slides across as the row scrolls. */
  .carousel-thumb {
    position: absolute;
    inset: 0 auto 0 0;
    width: calc(var(--carousel-visible, 0.3) * 100%);
    border-radius: 2px;
    background: var(--color-navy);
    translate: calc(var(--carousel-progress, 0) * (100% / var(--carousel-visible, 0.3) - 100%)) 0;
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .carousel-arrows {
      display: flex;
    }

    .carousel-track {
      --carousel-gap: 16px;
      margin-top: 22px;
    }

    .carousel-bar {
      margin-top: 22px;
    }
  }
}
```

- [ ] **Step 6: Check and commit**

Run `pnpm lint`, then `pnpm typecheck`, one at a time.

Files: `components/home/Carousel.tsx components/home/Carousel.test.tsx app/globals.css`
Message: `feat: add the shared carousel controller with arrows and progress bar`

---

### Task 10: The listing card, the save heart and listing pages

Just listed (Task 16) uses the card, and so does Free & swaps (Task 20) in a different form.

**The card** (spec 7.8):
- a square photo with a Save heart;
- the title, clamped to two lines;
- the price in the display face;
- the campus;
- the trust badge.

**The heart:**
- it updates instantly and says "Couldn't update. Try again." if storage is blocked;
- it remembers saves on this device;
- the toast says so.

**Every card links to a listing page.** For now that page is a placeholder. It records the listing as recently viewed, which feeds the context strip (plan decision 1).

**Files:**
- Create: `components/home/SaveHeart.tsx`, `components/home/SaveHeart.test.tsx`
- Create: `components/home/ListingCard.tsx`, `components/home/ListingCard.test.tsx`
- Create: `components/listings/RecordRecentlyViewed.tsx`, `components/listings/RecordRecentlyViewed.test.tsx`
- Create: `app/listings/[id]/page.tsx`
- Modify: `app/globals.css`, `tests/e2e/routes.spec.ts`

- [ ] **Step 1: Write the failing tests**

`components/home/SaveHeart.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { isSaved } from "@/lib/saved";
import { getToast } from "@/lib/toast";
import { SaveHeart } from "./SaveHeart";

describe("SaveHeart (spec 7.8)", () => {
  it("saves on this device, says so, and shows it pressed", async () => {
    const user = userEvent.setup();
    render(<SaveHeart id="l-001" title="Casio calculator" />);
    const heart = screen.getByRole("button", { name: "Save Casio calculator" });
    expect(heart).toHaveAttribute("aria-pressed", "false");

    await user.click(heart);
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(isSaved("l-001")).toBe(true);
    expect(getToast()?.message).toBe("Saved on this device");

    await user.click(heart);
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(getToast()?.message).toBe("Removed from saved");
  });

  it("stays as it was, and says so, when storage is blocked", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<SaveHeart id="l-001" title="Casio calculator" />);
    const heart = screen.getByRole("button", { name: "Save Casio calculator" });
    await user.click(heart);
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(getToast()?.message).toBe("Couldn't update. Try again.");
  });
});
```

`components/home/ListingCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/types";
import { ListingCard } from "./ListingCard";

const braids: Listing = {
  id: "l-004",
  title: "Box braids, shoulder length",
  priceZar: 400,
  priceIsFrom: true,
  payMode: "cash",
  campusSlug: "midrand",
  image: { src: "/placeholders/listing/hair-beauty.svg", alt: "Box braids, shoulder length" },
  badge: "trusted",
  createdAt: "2026-10-11T18:20:00Z",
};

describe("ListingCard (spec 7.8)", () => {
  it("links its title to the listing page and shows price, campus and trust badge", () => {
    render(<ListingCard listing={braids} campusName="Midrand" />);
    expect(screen.getByRole("heading", { level: 3, name: "Box braids, shoulder length" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Box braids, shoulder length" })).toHaveAttribute("href", "/listings/l-004");
    expect(screen.getByText("From R400")).toBeInTheDocument();
    expect(screen.getByText("Midrand")).toBeInTheDocument();
    expect(screen.getByText("Trusted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Box braids, shoulder length" })).toBeInTheDocument();
  });

  it("keeps the photo out of the reading order, since the title follows it", () => {
    const { container } = render(<ListingCard listing={braids} campusName="Midrand" />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("shows Swap for a swap-only item and no badge when there is none", () => {
    render(<ListingCard listing={{ ...braids, priceZar: null, payMode: "swap", badge: null }} campusName="Midrand" />);
    expect(screen.getByText("Swap")).toBeInTheDocument();
    expect(screen.queryByText("Trusted")).not.toBeInTheDocument();
  });
});
```

`components/listings/RecordRecentlyViewed.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getRecentlyViewed } from "@/lib/recently-viewed";
import { RecordRecentlyViewed } from "./RecordRecentlyViewed";

describe("RecordRecentlyViewed", () => {
  it("remembers the listing on this device", () => {
    render(<RecordRecentlyViewed item={{ id: "l-001", title: "Calculator", image: { src: "/p.svg", alt: "" } }} />);
    expect(getRecentlyViewed().map((item) => item.id)).toEqual(["l-001"]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test components/home/SaveHeart.test.tsx components/home/ListingCard.test.tsx components/listings`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Write the components**

`components/home/SaveHeart.tsx`:

```tsx
"use client";

import { useState } from "react";
import { HeartIcon } from "@/components/icons";
import { useIsSaved } from "@/hooks/useIsSaved";
import { toggleSaved } from "@/lib/saved";
import { showToast } from "@/lib/toast";

/** The Save heart (spec 7.8). Saves stay on this device until sign-in exists, and the toast says so. */
export function SaveHeart({ id, title }: { id: string; title: string }) {
  const saved = useIsSaved(id);
  // The pop plays only when someone saves, never when a saved heart first appears.
  const [popping, setPopping] = useState(false);

  function onClick() {
    try {
      const nowSaved = toggleSaved(id);
      setPopping(nowSaved);
      showToast(nowSaved ? "Saved on this device" : "Removed from saved");
    } catch {
      // Storage is blocked. Nothing changed, so there's nothing to roll back.
      showToast("Couldn't update. Try again.");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onAnimationEnd={() => setPopping(false)}
      aria-label={`Save ${title}`}
      aria-pressed={saved}
      data-pop={popping ? "" : undefined}
      className="save-heart"
    >
      <HeartIcon className="size-5" />
    </button>
  );
}
```

`components/home/ListingCard.tsx`:

```tsx
import Link from "next/link";
import { badgeLabel, priceLabel } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { Photo } from "./Photo";
import { SaveHeart } from "./SaveHeart";

/** A listing in a grid (spec 7.8). The title's link covers the whole card, and the heart sits on top of it. */
export function ListingCard({ listing, campusName }: { listing: Listing; campusName: string }) {
  return (
    <article className="listing-card">
      <Photo
        image={{ src: listing.image.src, alt: "" }}
        ratio="1 / 1"
        sizes="(min-width: 64rem) 220px, (min-width: 48rem) 30vw, 46vw"
        className="listing-photo"
      />
      <h3 className="listing-title">
        <Link href={`/listings/${listing.id}`} className="listing-link">
          {listing.title}
        </Link>
      </h3>
      <p className="listing-price">{priceLabel(listing)}</p>
      <p className="listing-meta">{campusName}</p>
      {listing.badge && <p className="listing-badge">{badgeLabel(listing.badge)}</p>}
      <SaveHeart id={listing.id} title={listing.title} />
    </article>
  );
}

/** The card's shape while Just listed streams in (spec section 9). */
export function ListingCardSkeleton() {
  return (
    <div className="listing-card" aria-hidden="true">
      <span className="skeleton listing-photo listing-skeleton-photo" />
      <span className="skeleton listing-skeleton-line" />
      <span className="skeleton listing-skeleton-price" />
      <span className="skeleton listing-skeleton-meta" />
    </div>
  );
}
```

`components/listings/RecordRecentlyViewed.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { recordRecentlyViewed, type ViewedItem } from "@/lib/recently-viewed";

/** Remembers a listing page on this device, for the homepage's "Pick up where you left off" (spec 7.4). */
export function RecordRecentlyViewed({ item }: { item: ViewedItem }) {
  useEffect(() => {
    recordRecentlyViewed(item);
  }, [item]);
  return null;
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `pnpm test components/home/SaveHeart.test.tsx components/home/ListingCard.test.tsx components/listings`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the listing page, `app/listings/[id]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { RecordRecentlyViewed } from "@/components/listings/RecordRecentlyViewed";
import { getCampuses, getListing, getListingIds } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  return { title: listing ? listing.title : "Page not found" };
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
  const listing = await getListing(id);
  if (!listing) notFound();
  const campus = (await getCampuses()).find((item) => item.slug === listing.campusSlug);
  return (
    <>
      <RecordRecentlyViewed item={{ id: listing.id, title: listing.title, image: listing.image }} />
      <ComingSoon title={listing.title}>
        Listed at {campus?.name ?? "an Eduvos campus"}. Listing pages, with photos, messages and safe pickup, arrive in
        the next stage.
      </ComingSoon>
    </>
  );
}
```

- [ ] **Step 6: Add the card CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: listing card and save heart (Part 2, Task 10, spec 7.8) --- */
@layer components {
  .listing-card {
    position: relative;
    display: flex;
    flex-direction: column;
    transition: scale var(--dur-fast) var(--ease-out);
  }

  .listing-photo {
    border-radius: var(--radius-card);
  }

  .listing-title {
    display: -webkit-box;
    min-height: calc(2 * 1.35em);
    margin-top: 12px;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    color: var(--color-navy);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.35;
  }

  /* The title's link covers the whole card, so the whole card is one target. The heart sits above it (z-index 2). */
  .listing-link::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: var(--radius-card);
  }

  /* The ring goes round the whole card, not just the title. */
  .listing-link:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .listing-card:has(.listing-link:focus-visible) {
    border-radius: var(--radius-card);
    outline: 2.5px solid var(--focus-ring, var(--color-navy));
    outline-offset: 4px;
  }

  .listing-card:has(.listing-link:active) {
    scale: 0.98;
  }

  .listing-price {
    margin-top: 6px;
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: clamp(1.5rem, 1.35rem + 0.5vw, 1.75rem);
    line-height: 1;
    text-transform: uppercase;
  }

  .listing-meta {
    margin-top: 6px;
    color: var(--color-muted);
    font-size: 12px;
  }

  .listing-badge {
    align-self: flex-start;
    margin-top: 8px;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--color-navy);
    color: var(--color-white);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .save-heart {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: var(--color-white);
    color: var(--color-navy);
  }

  .save-heart[aria-pressed="true"] svg {
    fill: currentColor;
  }

  .save-heart[data-pop] svg {
    animation: heart-pop 420ms var(--ease-spring);
  }

  .listing-skeleton-photo {
    aspect-ratio: 1 / 1;
  }

  .listing-skeleton-line {
    height: 14px;
    margin-top: 14px;
  }

  .listing-skeleton-price {
    width: 45%;
    height: 24px;
    margin-top: 10px;
  }

  .listing-skeleton-meta {
    width: 60%;
    height: 12px;
    margin-top: 8px;
  }
}

@keyframes heart-pop {
  40% {
    scale: 1.3;
  }
}
```

- [ ] **Step 7: Add the listing page to the route tests**

In `tests/e2e/routes.spec.ts`, add to `PLACEHOLDERS`:

```ts
  ["/listings/l-001", "Casio fx-991ZA Plus calculator"],
  ["/listings/fs-002", "Desk lamp, swap for a kettle"],
```

Add `"/listings/nope"` to the unknown-slug test, in the same form as `/c/atlantis`.

- [ ] **Step 8: Check**

Run, one at a time:
1. `pnpm test`, the full suite;
2. `pnpm typecheck`;
3. `pnpm lint`;
4. `pnpm build`. In the route table every `/listings/[id]` is prerendered;
5. `pnpm e2e tests/e2e/routes.spec.ts`.

- [ ] **Step 9: Commit**

Files: `components/home/SaveHeart.tsx components/home/SaveHeart.test.tsx components/home/ListingCard.tsx components/home/ListingCard.test.tsx components/listings app/listings app/globals.css tests/e2e/routes.spec.ts`
Message: `feat: add the listing card, the save heart and listing placeholder pages`

---

### Task 11: The hero slider (JS ledger)

Spec 7.3 asks for:
- three slides, each with one fixed headline frame and one changing word;
- a navy panel and a photo;
- thumbnails plus Pause/Play;
- swipe on touch;
- autoplay every 7 seconds, following spec 8's rules.

**How it's built.**
- `Hero` (server) reads the slides and hands them to `HeroRotator` (client).
- The phone's campus chip needs the cookie, so it streams in through `<Suspense>`.
- The H1 reads as one stable sentence. The visible frame is `aria-hidden`, and its word sits on its own line (plan decision 3).
- `usePageHidden` replaces the hidden-tab store the announcement bar keeps to itself, so the hero and Shop by campus can share it.

This task also rewrites `app/page.tsx` with a slot per section to come.

**Files:**
- Create: `hooks/usePageHidden.ts`
- Create: `components/home/hero/Hero.tsx`, `components/home/hero/HeroRotator.tsx`, `components/home/hero/HeroCampusChip.tsx`
- Create: `components/home/hero/HeroRotator.test.tsx`, `components/home/hero/Hero.test.tsx`, `components/home/hero/HeroCampusChip.test.tsx`
- Modify: `components/announcement/AnnouncementBar.tsx`, `app/page.tsx`, `app/globals.css`, `tests/e2e/brand.spec.ts`

- [ ] **Step 1: Write the failing tests**

`components/home/hero/HeroRotator.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LOW_DATA_ATTR } from "@/lib/low-data";
import type { HeroSlide } from "@/lib/types";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { HeroRotator } from "./HeroRotator";

const slide = (word: string): HeroSlide => ({
  id: word,
  word,
  body: `All about ${word}.`,
  cta: { label: `Shop ${word}`, href: `/categories/${word}` },
  image: { src: `/placeholders/hero/${word}.svg`, alt: `A photo about ${word}` },
});

const slides = [slide("textbooks"), slide("tech"), slide("services")];

const hero = (
  <HeroRotator
    slides={slides}
    sentence="Buy & sell textbooks, tech and services on campus"
    chip={<button type="button">Shopping at Midrand</button>}
  />
);

const activeWord = (container: HTMLElement) => container.querySelector(".hero-word[data-active]")?.textContent;
const photos = (container: ParentNode) => container.querySelectorAll(".hero-photo");

describe("HeroRotator (spec 7.3)", () => {
  it("gives screen readers one stable headline and shows one word at a time", () => {
    const { container } = render(hero);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "Buy & sell textbooks, tech and services on campus",
    );
    expect(activeWord(container)).toBe("textbooks");
    expect(screen.getByRole("link", { name: "Shop textbooks" })).toHaveAttribute("href", "/categories/textbooks");
    // The other slides' copy is there, so the panel keeps its height, but nobody can reach it.
    expect(screen.getByText("All about tech.").closest(".hero-copy")).toHaveAttribute("inert");
  });

  it("moves to the next slide every seven seconds and loops", () => {
    vi.useFakeTimers();
    const { container } = render(hero);
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(activeWord(container)).toBe("tech");
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(activeWord(container)).toBe("textbooks");
  });

  it("stops when paused, and a thumbnail shows its slide and stops autoplay", () => {
    vi.useFakeTimers();
    const { container } = render(hero);
    fireEvent.click(screen.getByRole("button", { name: "Pause slides" }));
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(activeWord(container)).toBe("textbooks");

    fireEvent.click(screen.getByRole("button", { name: "Play slides" }));
    const third = screen.getByRole("button", { name: "Show slide 3 of 3: services" });
    fireEvent.click(third);
    expect(activeWord(container)).toBe("services");
    expect(third).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Play slides" })).toBeInTheDocument();
  });

  it("never autoplays with reduced motion", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query.includes("reduce"));
    const { container } = render(hero);
    act(() => {
      vi.advanceTimersByTime(21000);
    });
    expect(activeWord(container)).toBe("textbooks");
    expect(screen.getByRole("button", { name: "Play slides" })).toBeInTheDocument();
  });

  it("holds while a mouse is over it", () => {
    vi.useFakeTimers();
    const { container } = render(hero);
    fireEvent.pointerEnter(container.querySelector(".hero")!, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(activeWord(container)).toBe("textbooks");
  });

  it("holds while the tab is hidden", () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    const { container } = render(hero);
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(activeWord(container)).toBe("textbooks");
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("changes slide with a sideways swipe, but not with a mostly vertical one", () => {
    const { container } = render(hero);
    const media = container.querySelector(".hero-media")!;
    fireEvent.pointerDown(media, { pointerType: "touch", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(media, { pointerType: "touch", clientX: 200, clientY: 110 });
    expect(activeWord(container)).toBe("tech");
    fireEvent.pointerDown(media, { pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerUp(media, { pointerType: "touch", clientX: 160, clientY: 260 });
    expect(activeWord(container)).toBe("tech");
    fireEvent.pointerDown(media, { pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerUp(media, { pointerType: "touch", clientX: 220, clientY: 100 });
    expect(activeWord(container)).toBe("textbooks");
  });

  it("puts only the first photo in the server's HTML", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(hero);
    expect(photos(host)).toHaveLength(1);
  });

  it("mounts the other photos once the page has loaded, for the cross-fade", () => {
    const { container } = render(hero);
    expect(photos(container)).toHaveLength(3);
  });

  it("with data saver on, loads only the photo on show", () => {
    document.documentElement.setAttribute(LOW_DATA_ATTR, "");
    const { container } = render(hero);
    expect(photos(container)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Show slide 2 of 3: tech" }));
    // The first stays: it's already loaded, and it's the server's photo.
    expect(photos(container)).toHaveLength(2);
  });
});
```

`components/home/hero/Hero.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";

// The chip reads the cookie on the server; HeroCampusChip.test.tsx covers it.
vi.mock("./HeroCampusChip", () => ({
  HeroCampusChip: () => <button type="button">Shopping at Midrand</button>,
  HeroCampusChipFallback: () => <button type="button">Choose your campus</button>,
}));

describe("Hero", () => {
  it("is a section named by the one H1, built from the sample slides", async () => {
    render(await Hero());
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAccessibleName("Buy & sell textbooks, tech and services on campus");
    expect(screen.getByRole("region", { name: "Buy & sell textbooks, tech and services on campus" })).toContainElement(
      heading,
    );
    expect(screen.getByRole("link", { name: "Shop textbooks" })).toHaveAttribute("href", "/categories/textbooks-notes");
    expect(screen.getByRole("button", { name: "Shopping at Midrand" })).toBeInTheDocument();
  });
});
```

`components/home/hero/HeroCampusChip.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeroCampusChip, HeroCampusChipFallback } from "./HeroCampusChip";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

describe("HeroCampusChip", () => {
  it("names the chosen campus and opens the picker", async () => {
    viewer.campus = "midrand";
    render(await HeroCampusChip());
    expect(screen.getByRole("button", { name: "Shopping at Midrand" })).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("says when the visitor shops every campus", async () => {
    viewer.campus = "all";
    render(await HeroCampusChip());
    expect(screen.getByRole("button", { name: "Shopping all campuses" })).toBeInTheDocument();
  });

  it("asks for a campus until the cookie has been read", () => {
    render(<HeroCampusChipFallback />);
    expect(screen.getByRole("button", { name: "Choose your campus" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test components/home/hero`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Write `hooks/usePageHidden.ts`**

```ts
import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

const isHidden = () => document.visibilityState === "hidden";
const visibleOnServer = () => false;

/** Whether this tab is hidden. Autoplay holds while it is (spec 8). */
export function usePageHidden(): boolean {
  return useSyncExternalStore(subscribe, isHidden, visibleOnServer);
}
```

In `components/announcement/AnnouncementBar.tsx`:
1. Delete `subscribeVisibility`, `isTabHidden` and `visibleOnServer`.
2. Replace `const pageHidden = useSyncExternalStore(subscribeVisibility, isTabHidden, visibleOnServer);` with `const pageHidden = usePageHidden();`.
3. Remove `useSyncExternalStore` from the `react` import, and add `import { usePageHidden } from "@/hooks/usePageHidden";`.

- [ ] **Step 4: Write the hero**

`components/home/hero/HeroRotator.tsx`:

```tsx
"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import { usePageHidden } from "@/hooks/usePageHidden";
import { cx } from "@/lib/cx";
import type { HeroSlide } from "@/lib/types";
import { Photo } from "../Photo";

const ROTATE_MS = 7000;
const SWIPE_PX = 40;

// The other slides' photos wait for the page's load event, so they never compete with the first (spec 7.3).
function subscribeLoad(listener: () => void) {
  window.addEventListener("load", listener);
  return () => window.removeEventListener("load", listener);
}
const isPageLoaded = () => document.readyState === "complete";
const notLoadedOnServer = () => false;

type PlayChoice = "auto" | "playing" | "paused";

type HeroRotatorProps = {
  slides: readonly HeroSlide[];
  /** What screen readers hear as the H1: one stable sentence (plan decision 3). */
  sentence: string;
  /** The phone's campus chip, which the server streams in. */
  chip: ReactNode;
};

/**
 * The hero slider (spec 7.3): one fixed headline with a changing word, a photo per slide, thumbnails and Pause/Play.
 * Autoplay follows spec 8. It holds for hover, focus and a hidden tab, stops once someone chooses a slide, and never
 * starts with reduced motion or data saver.
 */
export function HeroRotator({ slides, sentence, chip }: HeroRotatorProps) {
  const [index, setIndex] = useState(0);
  const [playChoice, setPlayChoice] = useState<PlayChoice>("auto");
  // Two holds: a mouse over the hero (touch doesn't count), and keyboard focus inside it.
  const [mouseOver, setMouseOver] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const pageHidden = usePageHidden();
  const pageLoaded = useSyncExternalStore(subscribeLoad, isPageLoaded, notLoadedOnServer);
  const motionAllowed = useMotionAllowed();

  const count = slides.length;
  const playing = playChoice === "playing" || (playChoice === "auto" && motionAllowed);
  const rotating = count > 1 && playing && !mouseOver && !focusInside && !pageHidden;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating, count]);

  /** Someone chose a slide, so autoplay stops (spec 7.3). */
  function show(next: number) {
    setIndex((next + count) % count);
    setPlayChoice("paused");
  }

  const onPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setMouseOver(true);
  };
  const onPointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setMouseOver(false);
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusInside(false);
  };

  const onSwipeStart = (event: PointerEvent<HTMLElement>) => {
    swipeStart.current = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY };
  };
  const onSwipeEnd = (event: PointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(event.clientY - start.y)) show(index + (dx < 0 ? 1 : -1));
  };

  // The first photo is in the prerendered page. After the load event the others mount, ready for the cross-fade.
  // With reduced motion or data saver nothing rotates, so only the slide on show loads (plan decision 8).
  const mountPhoto = (n: number) => n === 0 || n === index || (pageLoaded && motionAllowed);

  return (
    <div
      className="hero"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={() => setFocusInside(true)}
      onBlur={onBlur}
    >
      <div className="hero-panel surface-navy texture-stars">
        <div className="hero-chip">{chip}</div>
        <p className="eyebrow text-white">Eduvos student marketplace</p>
        <h1 id="hero-title" className="hero-title">
          <span className="sr-only">{sentence}</span>
          {/* What sighted visitors see: the frame stays put, and only the word on its own line changes (plan decision 3). */}
          <span aria-hidden="true" className="hero-frame">
            <span>Buy &amp; sell</span>
            <span className="hero-words">
              {slides.map((slide, n) => (
                <span key={slide.id} className="hero-word" data-active={n === index ? "" : undefined}>
                  {slide.word}
                </span>
              ))}
            </span>
            <span>on campus</span>
          </span>
        </h1>
        {/* Announced when someone changes the slide, never while it turns by itself. */}
        <div className="hero-copies" aria-live={rotating ? "off" : "polite"}>
          {slides.map((slide, n) => (
            <div key={slide.id} className="hero-copy" data-active={n === index ? "" : undefined} inert={n !== index}>
              <p className="hero-body">{slide.body}</p>
              <div className="hero-ctas">
                <Link href={slide.cta.href} prefetch={n === index ? undefined : false} className="btn btn-sky">
                  {slide.cta.label}
                </Link>
                <Link href="/sell" className="btn btn-ghost">
                  Start selling
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className="hero-media"
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        {slides.map((slide, n) =>
          mountPhoto(n) ? (
            <div key={slide.id} className={cx("hero-photo", n === index && "hero-photo-active")} inert={n !== index}>
              <Photo
                image={slide.image}
                sizes="(min-width: 75rem) 744px, (min-width: 48rem) 62vw, 100vw"
                priority={n === 0}
                className="hero-photo-img"
              />
            </div>
          ) : null,
        )}
        <div className="hero-controls">
          {slides.map((slide, n) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => show(n)}
              aria-label={`Show slide ${n + 1} of ${count}: ${slide.word}`}
              aria-current={n === index ? "true" : undefined}
              className="hero-thumb"
            >
              <Photo image={{ src: slide.image.src, alt: "" }} sizes="48px" className="hero-thumb-img" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPlayChoice(playing ? "paused" : "playing")}
            aria-label={playing ? "Pause slides" : "Play slides"}
            className="hero-toggle"
          >
            {playing ? <PauseIcon className="size-6" /> : <PlayIcon className="size-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}
```

`components/home/hero/HeroCampusChip.tsx`:

```tsx
import { CampusPickerButton } from "@/components/campus/CampusPickerButton";
import { ChevronDownIcon, MapPinIcon } from "@/components/icons";
import { ALL_CAMPUSES, campusLabel } from "@/lib/campus";
import { getCampuses } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";

/** The phone's campus chip, the first thing in the hero panel (spec 6.2 and 7.3). It reads the cookie, so it streams in. */
export async function HeroCampusChip() {
  const [{ campus }, campuses] = await Promise.all([getViewerContext(), getCampuses()]);
  return (
    <ChipButton
      label={campus === ALL_CAMPUSES ? "Shopping all campuses" : `Shopping at ${campusLabel(campus, campuses)}`}
    />
  );
}

/** In the prerendered page until the cookie has been read. It already opens the picker. */
export function HeroCampusChipFallback() {
  return <ChipButton label="Choose your campus" />;
}

function ChipButton({ label }: { label: string }) {
  return (
    <CampusPickerButton className="hero-campus-chip">
      <MapPinIcon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      <ChevronDownIcon className="size-4 shrink-0" />
    </CampusPickerButton>
  );
}
```

`components/home/hero/Hero.tsx`:

```tsx
import { Suspense } from "react";
import { getHeroSlides } from "@/lib/data";
import { joinWords } from "@/lib/format";
import { HeroCampusChip, HeroCampusChipFallback } from "./HeroCampusChip";
import { HeroRotator } from "./HeroRotator";

/** The hero (spec 7.3). The slides are prerendered; only the phone's campus chip waits for the cookie. */
export async function Hero() {
  const slides = await getHeroSlides();
  return (
    <section aria-labelledby="hero-title">
      <HeroRotator
        slides={slides}
        sentence={`Buy & sell ${joinWords(slides.map((slide) => slide.word))} on campus`}
        chip={
          <Suspense fallback={<HeroCampusChipFallback />}>
            <HeroCampusChip />
          </Suspense>
        }
      />
    </section>
  );
}
```

- [ ] **Step 5: Run them and watch them pass**

Run: `pnpm test components/home/hero components/announcement`
Expected: PASS. The announcement bar's tests still pass with the shared hook.

- [ ] **Step 6: Add the hero CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: hero (Part 2, Task 11, spec 7.3) --- */
@layer components {
  .hero {
    display: grid;
    overflow: hidden;
    border-radius: var(--radius-card);
    background: var(--color-navy);
  }

  .hero-panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 22px 20px 26px;
  }

  .hero-chip {
    max-width: 100%;
    margin-bottom: 16px;
  }

  .hero-campus-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-height: 44px;
    padding: 0 14px;
    border: 1.5px solid rgb(255 255 255 / 0.6);
    border-radius: 999px;
    color: var(--color-white);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .hero-title {
    margin-top: 10px;
    color: var(--color-white);
    font-family: var(--vos-font-display);
    /* 44px on phones to 64px on desktop (spec section 4), a little smaller on tablets, where the panel is narrow. */
    font-size: clamp(2.75rem, 1.2rem + 3.4vw, 4rem);
    line-height: var(--text-hero--line-height);
    text-transform: uppercase;
  }

  .hero-frame {
    display: flex;
    flex-direction: column;
  }

  /* The words share one grid cell, so their line is as wide as the longest and nothing reflows between slides. */
  .hero-words {
    display: grid;
    color: var(--color-sky);
  }

  .hero-word {
    grid-area: 1 / 1;
    opacity: 0;
    translate: 0 0.3em;
    transition:
      opacity 350ms var(--ease-out),
      translate 350ms var(--ease-out);
  }

  .hero-word[data-active] {
    opacity: 1;
    translate: 0 0;
  }

  /* The slides' copy shares one grid cell too, so the panel is as tall as the longest copy and never jumps. */
  .hero-copies {
    display: grid;
    width: 100%;
    margin-top: 14px;
  }

  .hero-copy {
    grid-area: 1 / 1;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity var(--dur-base) var(--ease-out),
      visibility 0s linear var(--dur-base);
  }

  .hero-copy[data-active] {
    opacity: 1;
    visibility: visible;
    transition-delay: 0s;
  }

  .hero-body {
    max-width: 34ch;
    color: rgb(255 255 255 / 0.86);
  }

  .hero-ctas {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .btn-ghost {
    border: 1.5px solid rgb(255 255 255 / 0.7);
    color: var(--color-white);
  }

  /* Phones: the photo sits above the panel (spec 7.3). It comes after the panel in the page, so the headline and
     buttons come before the slide controls for screen readers and keyboards (plan decision 17). */
  .hero-media {
    position: relative;
    order: -1;
    aspect-ratio: 4 / 3;
    background: var(--color-pale);
    /* Sideways swipes change the slide; up and down still scroll the page. */
    touch-action: pan-y;
    --focus-ring: var(--color-sky);
    --focus-halo: var(--color-navy);
  }

  .hero-photo {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 500ms var(--ease-out);
  }

  .hero-photo-active {
    opacity: 1;
  }

  .hero-photo-img,
  .hero-thumb-img {
    position: absolute;
    inset: 0;
  }

  .hero-controls {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px;
    border-radius: 10px;
    background: rgb(9 20 42 / 0.72);
  }

  /* 44px, not the mockup's 36px: spec section 5's touch target (plan decision 18). */
  .hero-thumb {
    position: relative;
    width: 44px;
    height: 44px;
    overflow: hidden;
    border-radius: 6px;
  }

  /* The slide on show: a sky frame drawn inside the thumbnail, so it never clashes with the focus ring. */
  .hero-thumb[aria-current="true"]::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 2px solid var(--color-sky);
    border-radius: inherit;
  }

  .hero-toggle {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 6px;
    color: var(--color-white);
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .hero {
      grid-template-columns: 38% 62%;
      min-height: 480px;
      border-radius: var(--radius-panel);
    }

    .hero-panel {
      padding: 36px 28px;
    }

    /* The header's campus pill takes over from the tablet step (spec 6.2). */
    .hero-chip {
      display: none;
    }

    .hero-title {
      margin-top: 18px;
    }

    .hero-copies {
      margin-top: auto;
      padding-top: 24px;
    }

    .hero-media {
      order: 0;
      aspect-ratio: auto;
    }

    .hero-controls {
      right: 20px;
      bottom: 20px;
      gap: 8px;
      padding: 8px;
    }

    .hero-thumb {
      width: 48px;
      height: 48px;
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .hero-panel {
      padding: 48px 44px;
    }
  }
}
```

- [ ] **Step 7: Rewrite the homepage with slots, `app/page.tsx`**

```tsx
import { Hero } from "@/components/home/hero/Hero";

// Sections that haven't landed yet hold their place, so the page stays about as tall as the finished one and the
// header's scroll tests keep their room. Each section's task swaps its slot comment for the section and takes its
// name off this list. Task 21 removes the list.
const COMING_IN_PART_2 = [
  "Context strip",
  "Shop by category",
  "Collections",
  "Shop by campus",
  "Just listed",
  "How it works",
  "Featured today",
  "Looking For",
  "Free & swaps",
  "Hub and What's on",
];

export default function HomePage() {
  return (
    <>
      <div className="home">
        <Hero />
        {/* Task 12: <ContextStrip /> */}
        {/* Task 13: <ShopByCategory /> */}
        {/* Task 14: <Collections /> */}
        {/* Task 15: <ShopByCampus /> */}
        {/* Task 16: <JustListed /> */}
        {/* Task 17: <HowItWorks /> */}
        {/* Task 18: <FeaturedToday /> */}
        {/* Task 19: <LookingFor /> */}
        {/* Task 20: <FreeAndSwaps /> */}
        <ol aria-label="Homepage sections still to come" className="mt-12 grid gap-4">
          {COMING_IN_PART_2.map((name) => (
            <li
              key={name}
              className="grid min-h-[38vh] place-items-center rounded-panel border-[1.5px] border-dashed border-line text-muted"
            >
              {name}
            </li>
          ))}
        </ol>
      </div>
      {/* Task 21: <HubBanner /> */}
    </>
  );
}
```

- [ ] **Step 8: Point the brand test at the new hero**

In `tests/e2e/brand.spec.ts`, the H1's first `span` is now the screen-reader sentence. Replace the two lookups at the top of the `page.evaluate` callback with:

```ts
    const hero = document.querySelector(".hero-panel")!;
    const word = document.querySelector("#hero-title .hero-word[data-active]")!;
```

The rest of the test stays as it is.

- [ ] **Step 9: Check, look, and record the JS**

Run, one at a time:
1. `pnpm test`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`. The route table shows `/` as partially prerendered (◐).
5. `pnpm e2e tests/e2e/brand.spec.ts tests/e2e/shell.spec.ts tests/e2e/a11y.spec.ts`
6. `pnpm e2e tests/e2e/performance.spec.ts`. Report `scriptBrotli` (JS ledger).

Look at the hero at 390 × 844 and 1280 × 800, as the conventions describe:
- the photo is above the panel on the phone and on the right on desktop;
- the headline is three lines with the sky word in the middle;
- the chip shows on the phone only;
- the thumbnails and Pause sit bottom-right of the photo.

- [ ] **Step 10: Commit**

Files: `hooks/usePageHidden.ts components/home/hero components/announcement/AnnouncementBar.tsx app/page.tsx app/globals.css tests/e2e/brand.spec.ts`
Message: `feat: add the hero slider with its campus chip, and slots for the sections to come`

---

### Task 12: The context strip (JS ledger)

Spec 7.4: the strip under the hero changes with the visitor.

| Visitor | What it shows |
|---|---|
| First visit | The trust strip |
| Returning | "Pick up where you left off", with up to six listings viewed on this device |
| Signed in | Activity. Development only, behind `VOSSIE_SAMPLE_SIGNED_IN=1` (plan decision 10) |

**How it's built.**
- The server decides "signed in" (`getViewerContext`).
- The device decides "returning" (`useRecentlyViewed`).
- The prerendered page shows the trust strip until the page hydrates. Every state has the same minimum height, so the swap moves nothing below it.

**Files:**
- Create: `components/home/ContextStrip.tsx`, `components/home/ContextStripView.tsx`, `components/home/ContextStrip.test.tsx`
- Modify: `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Write the failing test, `components/home/ContextStrip.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { recordRecentlyViewed } from "@/lib/recently-viewed";
import { ContextStripContent } from "./ContextStrip";
import { ContextStripView } from "./ContextStripView";

const viewer = vi.hoisted(() => ({ signedIn: true }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({
    campus: "all",
    signedIn: viewer.signedIn,
    activity: viewer.signedIn ? { newMessages: 2, salesToConfirm: 1, savedItemsBack: 1 } : null,
  }),
}));

describe("ContextStripView (spec 7.4)", () => {
  it("shows the trust strip on a first visit", () => {
    render(<ContextStripView activity={null} />);
    expect(screen.getByRole("heading", { level: 2, name: "Why you can trust Vossie" })).toBeInTheDocument();
    expect(screen.getByText("Verified Incubation Hub sellers")).toBeInTheDocument();
    expect(screen.getByText("Never pay before you see it")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How trust works" })).toHaveAttribute("href", "/safety");
  });

  it("picks up where a returning visitor left off", () => {
    recordRecentlyViewed({ id: "l-001", title: "Casio calculator", image: { src: "/p.svg", alt: "" } });
    render(<ContextStripView activity={null} />);
    expect(screen.getByRole("heading", { level: 2, name: "Pick up where you left off" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Casio calculator" })).toHaveAttribute("href", "/listings/l-001");
  });

  it("shows activity when signed in", () => {
    render(<ContextStripView activity={{ newMessages: 2, salesToConfirm: 1, savedItemsBack: 1 }} />);
    expect(screen.getByRole("heading", { level: 2, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("2 new messages")).toBeInTheDocument();
    expect(screen.getByText("1 sale to confirm")).toBeInTheDocument();
    expect(screen.getByText("1 saved item is back")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open inbox" })).toHaveAttribute("href", "/account");
  });
});

describe("ContextStripContent", () => {
  it("passes the viewer's activity to the strip", async () => {
    viewer.signedIn = true;
    render(await ContextStripContent());
    expect(screen.getByRole("heading", { level: 2, name: "Welcome back" })).toBeInTheDocument();
  });

  it("shows the trust strip to a signed-out first visitor", async () => {
    viewer.signedIn = false;
    render(await ContextStripContent());
    expect(screen.getByRole("heading", { level: 2, name: "Why you can trust Vossie" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/home/ContextStrip.test.tsx`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Write the strip**

`components/home/ContextStripView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { FlagIcon, MapPinIcon, ShieldIcon } from "@/components/icons";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import type { ViewedItem } from "@/lib/recently-viewed";
import type { ViewerActivity } from "@/lib/types";
import { Photo } from "./Photo";

// Phones and tablets get the short words; the desktop strip has room for the long ones.
const TRUST = [
  { Icon: ShieldIcon, long: "Verified Incubation Hub sellers", short: "Verified sellers" },
  { Icon: MapPinIcon, long: "Approved campus pickup points", short: "Pickup points" },
  { Icon: FlagIcon, long: "Never pay before you see it", short: "See it, then pay" },
];

/**
 * The strip under the hero (spec 7.4): activity when signed in, otherwise the listings viewed on this device,
 * otherwise the trust strip. Every state has the same minimum height, so swapping after hydration moves nothing.
 */
export function ContextStripView({ activity }: { activity: ViewerActivity | null }) {
  const viewed = useRecentlyViewed();
  if (activity) return <SignedInStrip activity={activity} viewed={viewed} />;
  if (viewed.length > 0) return <ReturningStrip viewed={viewed} />;
  return <TrustStrip />;
}

function TrustStrip() {
  return (
    <div className="context-strip context-outlined">
      <h2 id="context-title" className="sr-only">
        Why you can trust Vossie
      </h2>
      <ul className="context-row context-trust">
        {TRUST.map(({ Icon, long, short }) => (
          <li key={short} className="context-chip">
            <Icon className="context-icon" />
            <span className="desk:hidden">{short}</span>
            <span className="hidden desk:inline">{long}</span>
          </li>
        ))}
        <li className="context-end">
          <Link href="/safety" className="context-link">
            How trust works
          </Link>
        </li>
      </ul>
    </div>
  );
}

function ReturningStrip({ viewed }: { viewed: readonly ViewedItem[] }) {
  return (
    <div className="context-strip context-outlined">
      <h2 id="context-title" className="context-label">
        Pick up where you left off
      </h2>
      <ViewedThumbs viewed={viewed} />
    </div>
  );
}

function SignedInStrip({ activity, viewed }: { activity: ViewerActivity; viewed: readonly ViewedItem[] }) {
  const lines = [
    activity.newMessages > 0 && `${activity.newMessages} new ${activity.newMessages === 1 ? "message" : "messages"}`,
    activity.salesToConfirm > 0 &&
      `${activity.salesToConfirm} ${activity.salesToConfirm === 1 ? "sale" : "sales"} to confirm`,
    activity.savedItemsBack > 0 &&
      `${activity.savedItemsBack} saved ${activity.savedItemsBack === 1 ? "item is" : "items are"} back`,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="context-strip context-signed-in surface-navy">
      <h2 id="context-title" className="context-welcome">
        Welcome back
      </h2>
      <ul className="context-activity">
        {lines.map((line) => (
          <li key={line}>
            <span className="context-dot" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>
      {viewed.length > 0 && <ViewedThumbs viewed={viewed} />}
      <Link href="/account" className="context-link">
        Open inbox
      </Link>
    </div>
  );
}

function ViewedThumbs({ viewed }: { viewed: readonly ViewedItem[] }) {
  return (
    <ul className="context-row context-thumbs">
      {viewed.map((item) => (
        <li key={item.id}>
          <Link href={`/listings/${item.id}`} className="context-thumb">
            <Photo image={{ src: item.image.src, alt: "" }} sizes="44px" className="context-thumb-img" />
            <span className="sr-only">{item.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

`components/home/ContextStrip.tsx`:

```tsx
import { Suspense } from "react";
import { getViewerContext } from "@/lib/data/viewer";
import { ContextStripView } from "./ContextStripView";

/** The strip under the hero (spec 7.4). Until the viewer is known, it shows what a signed-out visitor sees. */
export function ContextStrip() {
  return (
    <section aria-labelledby="context-title" className="context-section">
      <Suspense fallback={<ContextStripView activity={null} />}>
        <ContextStripContent />
      </Suspense>
    </section>
  );
}

export async function ContextStripContent() {
  const { activity } = await getViewerContext();
  return <ContextStripView activity={activity} />;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/home/ContextStrip.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Add the CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: context strip (Part 2, Task 12, spec 7.4) --- */
@layer components {
  .context-section {
    margin-top: 12px;
  }

  /* Every state is at least this tall, so the swap after hydration moves nothing below it. */
  .context-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }

  /* Phones: one swipe row. The trust row ends with its link, so the row always holds something focusable. */
  .context-row {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .context-row::-webkit-scrollbar {
    display: none;
  }

  .context-chip {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 12px;
    border: 1.5px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-navy);
    font-size: 12px;
    white-space: nowrap;
  }

  .context-icon {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--color-sky-dark);
  }

  .context-end {
    flex: none;
  }

  .context-link {
    display: inline-flex;
    flex: none;
    align-items: center;
    min-height: 44px;
    padding-inline: 4px;
    color: var(--color-navy);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    text-decoration: underline 1.5px;
    text-underline-offset: 4px;
    white-space: nowrap;
  }

  .context-label {
    flex: none;
    max-width: 8.5rem;
    color: var(--color-navy);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
  }

  .context-thumb {
    position: relative;
    display: block;
    width: 44px;
    height: 44px;
    overflow: hidden;
    border-radius: 8px;
  }

  .context-thumb-img {
    position: absolute;
    inset: 0;
  }

  /* Development only (plan decision 10). */
  .context-signed-in {
    flex-wrap: wrap;
    padding: 12px 14px;
    border-radius: var(--radius-strip);
  }

  .context-welcome {
    font-size: 13px;
    font-weight: 600;
  }

  .context-activity {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-size: 12px;
  }

  .context-activity li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .context-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--color-sky);
  }

  .context-signed-in .context-link {
    color: var(--color-white);
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .context-section {
      margin-top: 16px;
    }

    .context-strip {
      min-height: 56px;
    }

    .context-outlined {
      padding: 0 8px 0 18px;
      border: 1.5px solid var(--color-line);
      border-radius: var(--radius-strip);
    }

    .context-trust {
      gap: 24px;
      overflow: visible;
    }

    .context-trust .context-chip {
      height: auto;
      padding: 0;
      border: 0;
      font-size: 13px;
    }

    .context-end {
      margin-left: auto;
    }

    .context-label {
      max-width: none;
      font-size: 13px;
    }
  }
}
```

- [ ] **Step 6: Put the strip on the page**

In `app/page.tsx`:
1. Add `import { ContextStrip } from "@/components/home/ContextStrip";`.
2. Replace `{/* Task 12: <ContextStrip /> */}` with `<ContextStrip />`.
3. Take `"Context strip"` off `COMING_IN_PART_2`.

- [ ] **Step 7: Check, look, and record the JS**

Run, one at a time: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, then `pnpm e2e tests/e2e/performance.spec.ts`. Report `scriptBrotli`.

Look at 390 × 844 and 1280 × 800:
- **First visit:** the trust strip.
- **Returning:** open `/listings/l-001`, then come back. The returning strip should be the same height as the trust strip.
- **Signed in:** run `VOSSIE_SAMPLE_SIGNED_IN=1 pnpm dev --port 3100` and look at the signed-in strip there. Stop that server afterwards.

- [ ] **Step 8: Commit**

Files: `components/home/ContextStrip.tsx components/home/ContextStripView.tsx components/home/ContextStrip.test.tsx app/page.tsx app/globals.css`
Message: `feat: add the context strip (trust, recently viewed, and signed-in activity)`

---

### Task 13: Shop by category and budget (JS ledger)

Spec 7.5: square photo tiles in the first carousel, with the label top-left and a round arrow in a cut-out corner. About 2.3 tiles show on phones, 4 on tablets and 6.5 on desktop. A row of budget chips sits underneath. This is the first section to use the shared `Carousel`.

**Files:**
- Create: `components/home/ShopByCategory.tsx`, `components/home/ShopByCategory.test.tsx`
- Modify: `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Write the failing test, `components/home/ShopByCategory.test.tsx`**

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShopByCategory } from "./ShopByCategory";

describe("ShopByCategory (spec 7.5)", () => {
  it("is a carousel of the ten categories under its heading", async () => {
    render(await ShopByCategory());
    expect(screen.getByRole("heading", { level: 2, name: "Shop by category" })).toBeInTheDocument();
    const carousel = screen.getByRole("region", { name: "Categories" });
    const tiles = within(carousel).getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/categories/"));
    expect(tiles).toHaveLength(10);
    expect(within(carousel).getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/categories/tech");
    expect(screen.getByRole("link", { name: "All categories" })).toHaveAttribute("href", "/browse");
  });

  it("keeps the tile photos out of the reading order, since the name follows", async () => {
    const { container } = render(await ShopByCategory());
    for (const image of container.querySelectorAll(".category-tile img")) expect(image).toHaveAttribute("alt", "");
  });

  it("offers the budget filters as a labelled list", async () => {
    render(await ShopByCategory());
    const budgets = screen.getByRole("list", { name: "Shop by budget" });
    expect(within(budgets).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/browse?max=50",
      "/browse?max=100",
      "/browse?max=250",
      "/browse?price=free",
      "/browse?pay=swap",
    ]);
    expect(within(budgets).getByRole("link", { name: "Swaps" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/home/ShopByCategory.test.tsx`
Expected: FAIL, because `./ShopByCategory` doesn't exist.

- [ ] **Step 3: Write `components/home/ShopByCategory.tsx`**

```tsx
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { getCategories } from "@/lib/data";
import { Carousel } from "./Carousel";
import { Photo } from "./Photo";
import { SectionHeader } from "./SectionHeader";

// Browse filters (a placeholder page in this stage). The query names will be settled with the browse page.
const BUDGETS = [
  { label: "Under R50", href: "/browse?max=50" },
  { label: "Under R100", href: "/browse?max=100" },
  { label: "Under R250", href: "/browse?max=250" },
  { label: "Free", href: "/browse?price=free" },
  { label: "Swaps", href: "/browse?pay=swap" },
];

/** Shop by category and budget (spec 7.5), the first carousel. */
export async function ShopByCategory() {
  const categories = await getCategories();
  return (
    <section aria-labelledby="categories-title" className="home-section">
      <Carousel
        label="Categories"
        className="category-carousel"
        header={
          <SectionHeader id="categories" eyebrow="Shop by category" link={{ href: "/browse", label: "All categories" }} />
        }
      >
        {categories.map((category) => (
          <li key={category.slug}>
            <Link href={`/categories/${category.slug}`} className="category-tile">
              <Photo
                image={{ src: category.image.src, alt: "" }}
                sizes="(min-width: 64rem) 172px, (min-width: 48rem) 22vw, 42vw"
                className="category-photo"
              />
              <span className="category-name">{category.name}</span>
              <span className="category-cut" aria-hidden="true">
                <span>
                  <ArrowRightIcon className="size-3.5" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </Carousel>
      <div className="budget-row">
        <p id="budget-label" className="budget-label sr-only wide:not-sr-only">
          Shop by budget
        </p>
        <ul aria-labelledby="budget-label" className="budget-chips">
          {BUDGETS.map((budget) => (
            <li key={budget.href}>
              <Link href={budget.href} className="budget-chip">
                {budget.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/home/ShopByCategory.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: shop by category and budget (Part 2, Task 13, spec 7.5) --- */
@layer components {
  /* About 2.3 tiles on phones, 4 on tablets and 6.5 on desktop, each with a peek of the next. */
  .category-carousel {
    --carousel-item: calc((100% - 2 * 12px) / 2.3);
  }

  .category-tile {
    position: relative;
    display: block;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: var(--radius-card);
    transition: scale var(--dur-fast) var(--ease-out);
  }

  .category-tile:active {
    scale: 0.98;
  }

  .category-photo {
    position: absolute;
    inset: 0;
    transition: scale var(--dur-base) var(--ease-out);
  }

  /* A shade behind the label, so white text stays readable on any photo. */
  .category-tile::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(180deg, rgb(9 20 42 / 0.55), transparent 55%);
  }

  .category-name {
    position: absolute;
    top: 12px;
    left: 14px;
    right: 14px;
    z-index: 2;
    color: var(--color-white);
    font-family: var(--vos-font-display);
    font-size: clamp(1.3125rem, 1.15rem + 0.5vw, 1.5rem);
    line-height: 0.95;
    text-transform: uppercase;
  }

  /* The round arrow in a cut-out corner: a page-coloured circle over the corner, clipped by the tile itself. */
  .category-cut {
    position: absolute;
    right: -6px;
    bottom: -6px;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 999px;
    background: var(--color-white);
  }

  .category-cut > span {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    box-shadow: 0 0 0 1px var(--color-line);
    color: var(--color-navy);
    transition: translate var(--dur-fast) var(--ease-out);
  }

  @media (hover: hover) and (pointer: fine) {
    .category-tile:hover .category-photo {
      scale: 1.04;
    }

    .category-tile:hover .category-cut > span {
      translate: 2px 0;
    }
  }

  .budget-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    margin-top: 16px;
  }

  .budget-label {
    margin-right: 4px;
    color: var(--color-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .budget-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .budget-chip {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
    color: var(--color-navy);
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    transition: scale var(--dur-fast) var(--ease-out);
  }

  .budget-chip:active {
    scale: 0.97;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .category-carousel {
      --carousel-item: calc((100% - 4 * 12px) / 4.3);
    }

    .budget-row {
      margin-top: 22px;
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .category-carousel {
      --carousel-item: calc((100% - 6 * 16px) / 6.5);
    }
  }
}
```

- [ ] **Step 6: Put the section on the page**

In `app/page.tsx`:
1. Add `import { ShopByCategory } from "@/components/home/ShopByCategory";`.
2. Replace `{/* Task 13: <ShopByCategory /> */}` with `<ShopByCategory />`.
3. Take `"Shop by category"` off `COMING_IN_PART_2`.

- [ ] **Step 7: Check, look, and record the JS**

Run, one at a time:
1. `pnpm test`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm e2e tests/e2e/responsive.spec.ts tests/e2e/a11y.spec.ts`. There should be no sideways scrolling, and axe should be clean.
6. `pnpm e2e tests/e2e/performance.spec.ts`. Report `scriptBrotli`; the carousel controller is now on the page.

Look at 390 × 844 and 1280 × 800. Expect:
- about 2.3 tiles with a peek on the phone and 6.5 on desktop;
- the arrows on desktop only;
- the progress bar's thumb moves as the row scrolls;
- the budget chips wrap onto two rows on the phone.

- [ ] **Step 8: Commit**

Files: `components/home/ShopByCategory.tsx components/home/ShopByCategory.test.tsx app/page.tsx app/globals.css`
Message: `feat: add Shop by category with budget filters, the first carousel`

---

### Task 14: Collections

Spec 7.6: a grey panel. On desktop and tablet, a fanned photo stack sits on the left and four Hub-curated collections on the right. The active title is navy and the rest are idle grey. Hovering or focusing a title deals its photo onto the stack in 350ms. Phones get rows with a 64px thumbnail.

The deal is plain CSS (`:has()`), so it costs no JavaScript (plan decision 4).

**The idle grey (plan decision 14).** The spec's `#B9C0CC` is 1.8:1 on white and 1.65:1 on the grey panel. Large text needs 3:1 (WCAG 1.4.3), and axe reports it as serious. A new token, `idle-text` (`#7E879A`), reaches 3.6:1 on white and 3.25:1 on the panel. The existing `idle` token stays for decoration, such as the sheet handle.

Each collection links to a new placeholder page, `/collections/[slug]` (spec section 14).

**Files:**
- Create: `components/home/Collections.tsx`, `components/home/Collections.test.tsx`, `app/collections/[slug]/page.tsx`
- Modify: `app/page.tsx`, `app/globals.css`, `tests/e2e/routes.spec.ts`

- [ ] **Step 1: Write the failing test, `components/home/Collections.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Collections } from "./Collections";

describe("Collections (spec 7.6)", () => {
  it("is a section with a screen-reader heading and the four collections", async () => {
    render(await Collections());
    expect(
      screen.getByRole("region", { name: "Collections from the Incubation Hub" }),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Start of semester Back-to-campus essentials" })).toHaveAttribute(
      "href",
      "/collections/start-of-semester",
    );
  });

  it("keeps the photos decorative, since each title says it all", async () => {
    const { container } = render(await Collections());
    for (const image of container.querySelectorAll("img")) expect(image).toHaveAttribute("alt", "");
    expect(container.querySelector(".collections-stack")).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/home/Collections.test.tsx`
Expected: FAIL, because `./Collections` doesn't exist.

- [ ] **Step 3: Write `components/home/Collections.tsx`**

```tsx
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { getCollections } from "@/lib/data";
import { Photo } from "./Photo";

/**
 * The Hub's collections (spec 7.6). On desktop and tablet, hovering or focusing a title deals its photo onto the stack.
 * That is CSS only (:has() in globals.css), written for four collections.
 */
export async function Collections() {
  const collections = (await getCollections()).slice(0, 4);
  return (
    <section aria-labelledby="collections-title" className="home-panel collections">
      <h2 id="collections-title" className="sr-only">
        Collections from the Incubation Hub
      </h2>
      <div className="collections-stack" aria-hidden="true">
        <span className="collections-fan collections-fan-back" />
        <span className="collections-fan collections-fan-middle" />
        {collections.map((collection) => (
          <Photo
            key={collection.slug}
            image={{ src: collection.image.src, alt: "" }}
            sizes="330px"
            className="collections-photo"
          />
        ))}
      </div>
      <ul className="collections-list">
        {collections.map((collection) => (
          <li key={collection.slug} className="collections-item">
            <Link href={`/collections/${collection.slug}`} className="collections-link">
              <Photo
                image={{ src: collection.image.src, alt: "" }}
                ratio="1 / 1"
                sizes="64px"
                className="collections-thumb"
              />
              <span className="collections-text">
                <span className="collections-eyebrow">{collection.eyebrow}</span>{" "}
                <span className="collections-title">{collection.title}</span>
              </span>
              <ArrowRightIcon className="collections-arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/home/Collections.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the collection page, `app/collections/[slug]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { getCollections } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const collection = (await getCollections()).find((item) => item.slug === slug);
  return { title: collection ? collection.title : "Page not found" };
}

export async function generateStaticParams() {
  return (await getCollections()).map((collection) => ({ slug: collection.slug }));
}

export default function CollectionPage({ params }: PageProps<"/collections/[slug]">) {
  return (
    // Known collections are prerendered, so this fallback only shows for an unknown slug, until the 404 takes over.
    <Suspense fallback={null}>
      <CollectionDetails params={params} />
    </Suspense>
  );
}

async function CollectionDetails({ params }: Pick<PageProps<"/collections/[slug]">, "params">) {
  const { slug } = await params;
  const collection = (await getCollections()).find((item) => item.slug === slug);
  if (!collection) notFound();
  return (
    <ComingSoon title={collection.title}>
      {collection.eyebrow}: the Incubation Hub&apos;s picks for the season arrive in the next stage.
    </ComingSoon>
  );
}
```

- [ ] **Step 6: Add the token and the CSS**

In `app/globals.css` → `@theme`, add below `--color-idle: #b9c0cc;`:

```css
  --color-idle-text: #7e879a; /* inactive large display text: 3.6:1 on white, 3.25:1 on panel (plan decision 14) */
```

Append:

```css
/* --- Homepage: collections (Part 2, Task 14, spec 7.6) --- */
@layer components {
  .home-panel {
    border-radius: var(--radius-card);
  }

  .collections {
    padding: 6px 16px;
    background: var(--color-panel);
  }

  .collections-stack {
    display: none;
  }

  /* Phones: rows with a 64px thumbnail. Rows in a hairline-divided list may touch (spec section 5). */
  .collections-link {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) 22px;
    align-items: center;
    gap: 14px;
    padding-block: 12px;
    color: var(--color-navy);
  }

  .collections-item + .collections-item {
    border-top: 1px solid var(--color-line);
  }

  .collections-thumb {
    border-radius: 10px;
  }

  .collections-text {
    display: grid;
  }

  /* Navy, not sky-dark: sky-dark is 4.25:1 on the grey panel (plan decision 7). */
  .collections-eyebrow {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-eyebrow);
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .collections-title {
    margin-top: 2px;
    font-family: var(--vos-font-display);
    font-size: var(--text-list);
    line-height: 1;
    text-transform: uppercase;
  }

  .collections-arrow {
    width: 20px;
    height: 20px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .collections {
      display: grid;
      grid-template-columns: minmax(0, 330px) minmax(0, 1fr);
      align-items: center;
      gap: clamp(32px, 6vw, 72px);
      padding: clamp(32px, 5vw, 60px) clamp(24px, 4.5vw, 56px);
      border-radius: var(--radius-panel);
    }

    .collections-stack {
      position: relative;
      display: block;
      aspect-ratio: 33 / 32;
    }

    .collections-fan,
    .collections-photo {
      position: absolute;
      inset: 0;
      border-radius: var(--radius-panel);
    }

    .collections-fan-back {
      background: #cfe6f3;
      rotate: -6deg;
      translate: -12px 8px;
    }

    .collections-fan-middle {
      background: #9fd1ec;
      rotate: 4deg;
      translate: 10px 2px;
    }

    .collections-photo {
      opacity: 0;
      scale: 0.94;
      rotate: -3deg;
      transition:
        opacity 350ms var(--ease-out),
        scale 350ms var(--ease-out),
        rotate 350ms var(--ease-out);
    }

    .collections-thumb {
      display: none;
    }

    .collections-link {
      grid-template-columns: minmax(0, 1fr) auto;
      padding-block: 14px;
    }

    .collections-title {
      color: var(--color-idle-text);
    }

    .collections-arrow {
      width: 26px;
      height: 26px;
      opacity: 0;
      translate: -6px 0;
      transition:
        opacity var(--dur-fast) var(--ease-out),
        translate var(--dur-fast) var(--ease-out);
    }

    /* The active collection is the first, until another title is hovered or focused. Then that one is navy, shows its
       arrow and deals its photo onto the stack. On touch screens a tap follows the link, so a hover never lingers. */
    .collections:not(:has(.collections-link:is(:hover, :focus-visible))) .collections-item:first-child .collections-title,
    .collections-link:is(:hover, :focus-visible) .collections-title {
      color: var(--color-navy);
    }

    .collections:not(:has(.collections-link:is(:hover, :focus-visible))) .collections-item:first-child .collections-arrow,
    .collections-link:is(:hover, :focus-visible) .collections-arrow {
      opacity: 1;
      translate: 0 0;
    }

    .collections:not(:has(.collections-link:is(:hover, :focus-visible))) .collections-photo:nth-child(1 of .collections-photo),
    .collections:has(.collections-item:nth-child(1) .collections-link:is(:hover, :focus-visible)) .collections-photo:nth-child(1 of .collections-photo),
    .collections:has(.collections-item:nth-child(2) .collections-link:is(:hover, :focus-visible)) .collections-photo:nth-child(2 of .collections-photo),
    .collections:has(.collections-item:nth-child(3) .collections-link:is(:hover, :focus-visible)) .collections-photo:nth-child(3 of .collections-photo),
    .collections:has(.collections-item:nth-child(4) .collections-link:is(:hover, :focus-visible)) .collections-photo:nth-child(4 of .collections-photo) {
      z-index: 1;
      opacity: 1;
      scale: 1;
      rotate: 0deg;
    }
  }
}
```

- [ ] **Step 7: Put the section on the page, and add the route tests**

In `app/page.tsx`:
1. Add `import { Collections } from "@/components/home/Collections";`.
2. Replace `{/* Task 14: <Collections /> */}` with `<Collections />`.
3. Take `"Collections"` off `COMING_IN_PART_2`.

In `tests/e2e/routes.spec.ts`:
- Add `["/collections/exam-season", "Notes, tutors & cram snacks"],` to `PLACEHOLDERS`.
- Add `"/collections/nope"` to the unknown-slug test, in the same form as the others.

- [ ] **Step 8: Check and look**

Run, one at a time:
1. `pnpm test`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm e2e tests/e2e/routes.spec.ts tests/e2e/a11y.spec.ts`. axe must pass with the idle titles.

Look at 1280 × 800:
- the first title is navy with its photo on the stack;
- hovering the third title deals its photo in;
- with the keyboard, focusing a title does the same.

At 390 × 844, check the four rows with thumbnails.

- [ ] **Step 9: Commit**

Files: `components/home/Collections.tsx components/home/Collections.test.tsx app/collections app/page.tsx app/globals.css tests/e2e/routes.spec.ts`
Message: `feat: add the Hub's collections with a CSS-only photo deal`

---

### Task 15: Shop by campus (JS ledger)

Spec 7.7.
- **Desktop and tablet:** a centred eyebrow, and six campus names on each side of one square campus photo. Each name has a live-listing count. "All campuses" and "Eduvos Online" buttons sit underneath.
- **Phones:** a swipeable campus card carousel, with "All campuses" first.
- **Choosing** does what the campus picker does (Task 7), then scrolls to Just listed and moves focus to its heading (plan decision 5).

**The highlight** (plan decision 5):
- it cycles every 4 seconds with a photo cross-fade, only while no campus is chosen;
- it holds for hover, focus and a hidden tab;
- it stops after any choice;
- it's off for reduced motion and data saver;
- with a campus chosen, it rests on that campus.

**WCAG 2.2.2 (plan decision 15).** Anything that moves by itself for more than 5 seconds needs a way to pause it. So the photo gets a Pause/Play button while the highlight cycles.

**Photos.** Only the highlighted photo and its neighbours mount, so the cycle never loads all thirteen photos at once.

**The selected card (plan decision 19).** On phones it gets a sky ring plus a navy tick. A sky ring alone is 2.6:1 on white (WCAG 1.4.11).

The section reads the campus from the cookie store on the device, so it's prerendered whole and needs no `<Suspense>`.

**Files:**
- Create: `components/home/ShopByCampus.tsx`, `components/home/CampusChooser.tsx`, `components/home/CampusChooser.test.tsx`
- Modify: `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Write the failing test, `components/home/CampusChooser.test.tsx`**

```tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WIDE_QUERY } from "@/lib/breakpoints";
import { getCampusCookieValue, setCampusChoice } from "@/lib/campus";
import type { Campus } from "@/lib/types";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { CampusChooser } from "./CampusChooser";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const campus = (slug: string, name: string, liveListings: number): Campus => ({
  slug,
  name,
  region: "Gauteng",
  liveListings,
  image: { src: `/placeholders/campus/${slug}.svg`, alt: `${name} campus` },
});

const campuses = [
  campus("bedfordview", "Bedfordview", 132),
  campus("bloemfontein", "Bloemfontein", 58),
  campus("midrand", "Midrand", 214),
  campus("pretoria", "Pretoria", 187),
  campus("online", "Eduvos Online", 63),
];

const scrollIntoView = vi.fn();

beforeEach(() => {
  // jsdom can't scroll.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, writable: true, value: scrollIntoView });
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

/** The tablet and desktop layout, shown from the wide step. */
const wideLayout = (container: HTMLElement) => within(container.querySelector<HTMLElement>(".campus-chooser-wide")!);
const highlighted = (container: HTMLElement) => container.querySelector(".campus-name-on")?.firstChild?.textContent;

function renderChooser() {
  return render(
    <>
      <CampusChooser campuses={campuses} />
      <section id="just-listed">
        <h2 id="just-listed-title" tabIndex={-1}>
          New on all campuses
        </h2>
      </section>
    </>,
  );
}

describe("CampusChooser (spec 7.7)", () => {
  it("lists the campuses with their live counts, and Eduvos Online apart", () => {
    const { container } = renderChooser();
    const wide = wideLayout(container);
    expect(wide.getByRole("button", { name: "Midrand, 214 live listings" })).toBeInTheDocument();
    expect(wide.getByRole("button", { name: "All campuses" })).toBeInTheDocument();
    expect(wide.getByRole("button", { name: "Eduvos Online" })).toBeInTheDocument();
    expect(wide.queryByRole("button", { name: /^Eduvos Online, / })).not.toBeInTheDocument();
    const cards = within(screen.getByRole("region", { name: "Campuses" }));
    expect(cards.getByRole("button", { name: "All campuses, Every Eduvos campus" })).toBeInTheDocument();
    expect(cards.getByRole("button", { name: "Eduvos Online, 63 live listings" })).toBeInTheDocument();
  });

  it("cycles the highlight every four seconds on larger screens while no campus is chosen", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY);
    const { container } = renderChooser();
    expect(highlighted(container)).toBe("Bedfordview");
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(highlighted(container)).toBe("Bloemfontein");
  });

  it("pauses and plays the cycle with its button", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY);
    const { container } = renderChooser();
    fireEvent.click(screen.getByRole("button", { name: "Pause campus highlights" }));
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(highlighted(container)).toBe("Bedfordview");
    fireEvent.click(screen.getByRole("button", { name: "Play campus highlights" }));
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(highlighted(container)).toBe("Bloemfontein");
  });

  it("rests on the chosen campus", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY);
    setCampusChoice("pretoria");
    const { container } = renderChooser();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(highlighted(container)).toBe("Pretoria");
    expect(wideLayout(container).getByRole("button", { name: "Pretoria, 187 live listings" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("doesn't cycle with reduced motion, or on phones", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY || query.includes("reduce"));
    const { container } = renderChooser();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(highlighted(container)).toBe("Bedfordview");
    expect(screen.queryByRole("button", { name: /campus highlights/ })).not.toBeInTheDocument();
  });

  it("chooses like the picker, then shows Just listed with focus on its heading", () => {
    const { container } = renderChooser();
    fireEvent.click(wideLayout(container).getByRole("button", { name: "Midrand, 214 live listings" }));
    expect(getCampusCookieValue()).toBe("midrand");
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "New on all campuses" })).toHaveFocus();
  });

  it("marks the chosen card on phones", () => {
    setCampusChoice("midrand");
    render(<CampusChooser campuses={campuses} />);
    const cards = within(screen.getByRole("region", { name: "Campuses" }));
    expect(cards.getByRole("button", { name: "Midrand, 214 live listings" })).toHaveAttribute("aria-current", "true");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/home/CampusChooser.test.tsx`
Expected: FAIL, because `./CampusChooser` doesn't exist.

- [ ] **Step 3: Write the chooser and the section**

`components/home/CampusChooser.tsx`:

```tsx
"use client";

import { useEffect, useState, useSyncExternalStore, type FocusEvent, type PointerEvent } from "react";
import { CheckIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { useChooseCampus } from "@/hooks/useChooseCampus";
import { isMotionAllowedNow, useMotionAllowed } from "@/hooks/useMotionAllowed";
import { usePageHidden } from "@/hooks/usePageHidden";
import { WIDE_QUERY } from "@/lib/breakpoints";
import { ALL_CAMPUSES, isOnlineCampus } from "@/lib/campus";
import { cx } from "@/lib/cx";
import type { Campus, CampusChoice } from "@/lib/types";
import { Carousel } from "./Carousel";
import { Photo } from "./Photo";

const CYCLE_MS = 4000;

// The cycle only runs where it shows: the tablet and desktop layout.
function subscribeWide(listener: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const isWide = () => window.matchMedia(WIDE_QUERY).matches;
const narrowOnServer = () => false;

/** Shop by campus (spec 7.7): campus names round one photo from the tablet step, a card carousel on phones. */
export function CampusChooser({ campuses }: { campuses: readonly Campus[] }) {
  const choice = useCampusChoice(campuses);
  const chooseCampus = useChooseCampus(campuses);
  const motionAllowed = useMotionAllowed();
  const wide = useSyncExternalStore(subscribeWide, isWide, narrowOnServer);
  const pageHidden = usePageHidden();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  // Two holds, as in the hero: a mouse over the layout, and keyboard focus inside it.
  const [mouseOver, setMouseOver] = useState(false);
  const [focusInside, setFocusInside] = useState(false);

  const physical = campuses.filter((campus) => !isOnlineCampus(campus));
  const online = campuses.find(isOnlineCampus);
  // Until the cookie has been read (server render and hydration), behave as "all campuses".
  const allChosen = choice === null || choice === ALL_CAMPUSES;
  const canCycle = allChosen && motionAllowed && wide && physical.length > 1;
  const cycling = canCycle && !paused && !mouseOver && !focusInside && !pageHidden;

  useEffect(() => {
    if (!cycling) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % physical.length), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [cycling, physical.length]);

  const near = (offset: number) => physical[(step + offset + physical.length) % physical.length];
  const highlighted = allChosen ? near(0) : (campuses.find((campus) => campus.slug === choice) ?? near(0));
  // Only the photo on show and its neighbours mount: the one fading out, and the next one, so it's ready in time.
  const mounted = new Set([highlighted.slug, ...(canCycle ? [near(-1).slug, near(1).slug] : [])]);

  function choose(next: CampusChoice) {
    setPaused(true);
    chooseCampus(next);
    // Show what changed: Just listed, with keyboard focus on its heading (plan decision 5).
    document.getElementById("just-listed-title")?.focus({ preventScroll: true });
    document
      .getElementById("just-listed")
      ?.scrollIntoView({ behavior: isMotionAllowedNow() ? "smooth" : "auto", block: "start" });
  }

  const onPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setMouseOver(true);
  };
  const onPointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setMouseOver(false);
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusInside(false);
  };

  const half = Math.ceil(physical.length / 2);
  const nameButton = (campus: Campus) => (
    <li key={campus.slug}>
      <button
        type="button"
        onClick={() => choose(campus.slug)}
        aria-current={choice === campus.slug ? "true" : undefined}
        className={cx("campus-name", campus.slug === highlighted.slug && "campus-name-on")}
      >
        {campus.name}
        <span className="campus-count">
          <span className="sr-only">, </span>
          {campus.liveListings}
          <span className="sr-only"> live listings</span>
        </span>
      </button>
    </li>
  );

  return (
    <>
      <div
        className="campus-chooser-wide"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={() => setFocusInside(true)}
        onBlur={onBlur}
      >
        <ul className="campus-names campus-names-start">{physical.slice(0, half).map(nameButton)}</ul>
        <div className="campus-photo-box">
          <div aria-hidden="true">
            {campuses.map((campus) =>
              mounted.has(campus.slug) ? (
                <div
                  key={campus.slug}
                  className={cx("campus-photo", campus.slug === highlighted.slug && "campus-photo-active")}
                >
                  <Photo image={{ src: campus.image.src, alt: "" }} sizes="300px" className="campus-photo-img" />
                </div>
              ) : null,
            )}
            {canCycle && (
              // A new key restarts the bar's 4-second fill at each step.
              <span key={step} className="campus-progress" data-running={cycling ? "" : undefined} />
            )}
          </div>
          {canCycle && (
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              aria-label={paused ? "Play campus highlights" : "Pause campus highlights"}
              className="campus-toggle"
            >
              {paused ? <PlayIcon className="size-5" /> : <PauseIcon className="size-5" />}
            </button>
          )}
        </div>
        <ul className="campus-names campus-names-end">{physical.slice(half).map(nameButton)}</ul>
        <div className="campus-chooser-foot">
          <button
            type="button"
            onClick={() => choose(ALL_CAMPUSES)}
            aria-current={choice === ALL_CAMPUSES ? "true" : undefined}
            className={cx("campus-choice", allChosen && "campus-choice-on")}
          >
            All campuses
          </button>
          {online && (
            <button
              type="button"
              onClick={() => choose(online.slug)}
              aria-current={choice === online.slug ? "true" : undefined}
              className={cx("campus-choice", choice === online.slug && "campus-choice-on")}
            >
              {online.name}
            </button>
          )}
        </div>
        <p className="campus-caption">Small numbers show live listings.</p>
      </div>

      <Carousel label="Campuses" className="campus-cards">
        <li>
          <button
            type="button"
            onClick={() => choose(ALL_CAMPUSES)}
            aria-current={choice === ALL_CAMPUSES ? "true" : undefined}
            className={cx("campus-card campus-card-all surface-navy texture-stars", choice === ALL_CAMPUSES && "campus-card-on")}
          >
            <span className="campus-card-name">All campuses</span>
            <span className="campus-card-meta">
              <span className="sr-only">, </span>Every Eduvos campus
            </span>
            {choice === ALL_CAMPUSES && <CheckIcon className="campus-card-tick" />}
          </button>
        </li>
        {campuses.map((campus) => (
          <li key={campus.slug}>
            <button
              type="button"
              onClick={() => choose(campus.slug)}
              aria-current={choice === campus.slug ? "true" : undefined}
              className={cx("campus-card", choice === campus.slug && "campus-card-on")}
            >
              <Photo image={{ src: campus.image.src, alt: "" }} sizes="60vw" className="campus-card-photo" />
              <span className="campus-card-name">{campus.name}</span>
              <span className="campus-card-meta">
                <span className="sr-only">, </span>
                {campus.liveListings} live listings
              </span>
              {choice === campus.slug && <CheckIcon className="campus-card-tick" />}
            </button>
          </li>
        ))}
      </Carousel>
    </>
  );
}
```

`components/home/ShopByCampus.tsx`:

```tsx
import { getCampuses } from "@/lib/data";
import { CampusChooser } from "./CampusChooser";
import { SectionHeader } from "./SectionHeader";

/** Shop by campus (spec 7.7). The campus comes from the cookie on the device, so the section is prerendered whole. */
export async function ShopByCampus() {
  const campuses = await getCampuses();
  return (
    <section aria-labelledby="campuses-title" className="home-section">
      <SectionHeader id="campuses" eyebrow="Shop by campus" align="center" />
      <CampusChooser campuses={campuses} />
    </section>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/home/CampusChooser.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Add the CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: shop by campus (Part 2, Task 15, spec 7.7) --- */
@layer components {
  .campus-chooser-wide {
    display: none;
  }

  /* Phones: the card carousel. */
  .campus-cards {
    --carousel-item: 56%;
  }

  .campus-card {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    width: 100%;
    aspect-ratio: 4 / 5;
    overflow: hidden;
    padding: 0 14px 16px;
    border-radius: var(--radius-card);
    background: var(--color-navy);
    color: var(--color-white);
    text-align: left;
    transition: scale var(--dur-fast) var(--ease-out);
  }

  .campus-card:active {
    scale: 0.98;
  }

  .campus-card-photo {
    position: absolute;
    inset: 0;
  }

  /* A shade under the words, so white text stays readable on any photo. */
  .campus-card:not(.campus-card-all)::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(0deg, rgb(9 20 42 / 0.75), transparent 60%);
  }

  .campus-card-name,
  .campus-card-meta {
    position: relative;
    z-index: 2;
  }

  .campus-card-name {
    font-family: var(--vos-font-display);
    font-size: 28px;
    line-height: 0.95;
    text-transform: uppercase;
  }

  .campus-card-meta {
    margin-top: 6px;
    font-size: 12px;
  }

  /* The chosen card: a sky ring, plus a navy tick, because a sky ring alone is 2.6:1 on white (plan decision 19). */
  .campus-card-on::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 3;
    border: 3px solid var(--color-sky);
    border-radius: inherit;
  }

  .campus-card-tick {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 3;
    width: 28px;
    height: 28px;
    padding: 6px;
    border-radius: 999px;
    background: var(--color-navy);
    box-shadow: 0 0 0 2px var(--color-white);
    color: var(--color-white);
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .campus-cards {
      display: none;
    }

    .campus-chooser-wide {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(180px, 300px) minmax(0, 1fr);
      align-items: center;
      gap: 24px clamp(20px, 3vw, 36px);
      margin-top: 28px;
    }

    .campus-names {
      display: grid;
      gap: 3px;
    }

    .campus-names-start {
      justify-items: end;
      text-align: right;
    }

    .campus-names-end {
      justify-items: start;
    }

    /* Idle names use the darker idle grey, which keeps 3:1 for large text (plan decision 14). */
    .campus-name {
      position: relative;
      display: inline-flex;
      align-items: flex-start;
      min-height: 44px;
      color: var(--color-idle-text);
      font-family: var(--vos-font-display);
      font-size: var(--text-list);
      line-height: 1.02;
      text-align: inherit;
      text-transform: uppercase;
    }

    .campus-name-on {
      color: var(--color-navy);
    }

    .campus-name-on::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 2px;
      height: 3px;
      border-radius: 2px;
      background: var(--color-sky);
    }

    /* Small text, so muted (5.9:1), not idle grey. */
    .campus-count {
      margin-left: 5px;
      color: var(--color-muted);
      font-family: var(--vos-font-text);
      font-size: 11px;
      font-weight: 600;
      line-height: 1.6;
    }

    .campus-name-on .campus-count {
      color: var(--color-sky-dark);
    }

    .campus-photo-box {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: var(--radius-panel);
      background: var(--color-pale);
    }

    .campus-photo {
      position: absolute;
      inset: 0;
      opacity: 0;
      transition: opacity 500ms var(--ease-out);
    }

    .campus-photo-active {
      opacity: 1;
    }

    .campus-photo-img {
      position: absolute;
      inset: 0;
    }

    .campus-progress {
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 14px;
      height: 3px;
      overflow: hidden;
      border-radius: 2px;
      background: rgb(255 255 255 / 0.35);
    }

    .campus-progress::after {
      content: "";
      position: absolute;
      inset: 0;
      background: var(--color-white);
      transform-origin: left;
      scale: 0 1;
      animation: campus-progress 4s linear forwards;
      animation-play-state: paused;
    }

    .campus-progress[data-running]::after {
      animation-play-state: running;
    }

    .campus-toggle {
      position: absolute;
      top: 10px;
      right: 10px;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      background: rgb(9 20 42 / 0.72);
      color: var(--color-white);
      --focus-ring: var(--color-sky);
      --focus-halo: var(--color-navy);
    }

    .campus-chooser-foot {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
    }

    .campus-choice {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0 18px;
      border: 1.5px solid var(--color-navy);
      border-radius: 999px;
      color: var(--color-navy);
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }

    .campus-choice-on {
      background: var(--color-navy);
      color: var(--color-white);
    }

    .campus-caption {
      grid-column: 1 / -1;
      margin-top: -8px;
      color: var(--color-muted);
      font-size: 12px;
      text-align: center;
    }
  }
}

@keyframes campus-progress {
  to {
    scale: 1 1;
  }
}
```

- [ ] **Step 6: Put the section on the page**

In `app/page.tsx`:
1. Add `import { ShopByCampus } from "@/components/home/ShopByCampus";`.
2. Replace `{/* Task 15: <ShopByCampus /> */}` with `<ShopByCampus />`.
3. Take `"Shop by campus"` off `COMING_IN_PART_2`.

Until Task 16 there's no `#just-listed` on the page. Choosing still works; it just has nowhere to scroll.

- [ ] **Step 7: Check, look, and record the JS**

Run, one at a time:
1. `pnpm test`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm e2e tests/e2e/responsive.spec.ts tests/e2e/a11y.spec.ts`
6. `pnpm e2e tests/e2e/performance.spec.ts`. Report `scriptBrotli`.

Look at 1280 × 800:
- the names are round the photo;
- the highlight moves every 4 seconds while the bar fills;
- hovering stops it;
- Pause stops it.

Choose Midrand: the toast shows, and the highlight rests on Midrand. At 390 × 844, check the cards, and the tick on the chosen one.

- [ ] **Step 8: Commit**

Files: `components/home/ShopByCampus.tsx components/home/CampusChooser.tsx components/home/CampusChooser.test.tsx app/page.tsx app/globals.css`
Message: `feat: add Shop by campus with the cycling highlight and phone cards`

---

### Task 16: Just listed (JS ledger)

Spec 7.8.
- **Header:** the "Just listed" eyebrow, and "New at {campus}" (or "New on all campuses").
- **Switch:** a [{Campus} | All campuses] switch and "See all".
- **Grid:** cards in 2, 3 or 5 columns.
- **Empty state:** "Nothing new at {campus} yet", with a button to all campuses.
- **Saves:** a quiet note that saves stay on this device.

**How it's built.**
- The server renders both grids, so the switch is instant and the cards stay Server Components (plan decision 2). The client switch only chooses which grid shows.
- The switch's state resets when the campus changes. It's derived, not keyed, so the heading is never remounted: Shop by campus may have just put keyboard focus on it.
- The server fetches ten cards. CSS shows 4 on phones, 9 on tablets and 10 on desktop (plan decision 11).

**Files:**
- Create: `components/home/JustListed.tsx`, `components/home/JustListedViews.tsx`, `components/home/JustListed.test.tsx`
- Modify: `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Write the failing test, `components/home/JustListed.test.tsx`**

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JustListedContent, JustListedSkeleton } from "./JustListed";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));
const listings = vi.hoisted(() => ({ failing: false }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getJustListed: async (query: Parameters<typeof actual.getJustListed>[0]) => {
      if (listings.failing) throw new Error("The listings didn't load");
      return actual.getJustListed(query);
    },
  };
});

afterEach(() => {
  listings.failing = false;
});

const heading = () => screen.getByRole("heading", { level: 2 });
const firstLink = (card: HTMLElement) => within(card).getByRole("link");

describe("Just listed (spec 7.8)", () => {
  it("shows the newest at the chosen campus, with a switch to every campus", async () => {
    viewer.campus = "midrand";
    render(await JustListedContent());
    expect(heading()).toHaveTextContent("New at Midrand");
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(10);
    expect(firstLink(cards[0])).toHaveAttribute("href", "/listings/l-001");
    const campusButton = screen.getByRole("button", { name: "Midrand" });
    expect(campusButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "All campuses" }));
    expect(heading()).toHaveTextContent("New on all campuses");
    expect(campusButton).toHaveAttribute("aria-pressed", "false");
    expect(firstLink(screen.getAllByRole("article")[1])).toHaveAttribute("href", "/listings/l-018");
  });

  it("has no switch when the visitor shops every campus", async () => {
    viewer.campus = "all";
    render(await JustListedContent());
    expect(heading()).toHaveTextContent("New on all campuses");
    expect(screen.queryByRole("group", { name: "Show new listings from" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all new listings" })).toHaveAttribute("href", "/browse");
  });

  it("offers every campus when the chosen one has nothing new, and keeps focus on the heading", async () => {
    viewer.campus = "mbombela";
    render(await JustListedContent());
    expect(screen.getByText("Nothing new at Mbombela yet")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all campuses" }));
    expect(heading()).toHaveTextContent("New on all campuses");
    expect(heading()).toHaveFocus();
    expect(screen.getAllByRole("article")).toHaveLength(10);
  });

  it("says saves stay on this device for now", async () => {
    viewer.campus = "all";
    render(await JustListedContent());
    expect(screen.getByText(/Hearts save to this device for now/)).toBeInTheDocument();
  });

  it("shows its own error state when the listings don't load", async () => {
    viewer.campus = "midrand";
    listings.failing = true;
    render(await JustListedContent());
    expect(heading()).toHaveTextContent("New listings");
    expect(screen.getByText("Just listed didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/?retry=just-listed#just-listed");
  });

  it("keeps its heading and card shapes while it streams in", () => {
    const { container } = render(<JustListedSkeleton />);
    expect(heading()).toHaveTextContent("New listings");
    expect(container.querySelectorAll(".listing-grid > li")).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/home/JustListed.test.tsx`
Expected: FAIL, because `./JustListed` doesn't exist.

- [ ] **Step 3: Write the section**

`components/home/JustListedViews.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";

type Scope = "campus" | "all";

type JustListedViewsProps = {
  /** The chosen campus's name, or null when the visitor shops every campus. */
  campusName: string | null;
  campusCount: number;
  /** Both grids come from the server, so switching is instant and the cards stay Server Components (plan decision 2). */
  campusView: ReactNode;
  allView: ReactNode;
  link: { href: string; label: string; context?: string };
};

/** Just listed's heading, the [Campus | All campuses] switch and the grid on show (spec 7.8). */
export function JustListedViews({ campusName, campusCount, campusView, allView, link }: JustListedViewsProps) {
  // Back to the campus view whenever the campus changes. Derived, not keyed: remounting would drop the heading,
  // which has keyboard focus after a choice in Shop by campus.
  const [picked, setPicked] = useState<{ campusName: string | null; scope: Scope }>({
    campusName,
    scope: "campus",
  });
  const scope: Scope = campusName === null ? "all" : picked.campusName === campusName ? picked.scope : "campus";

  function choose(next: Scope) {
    setPicked({ campusName, scope: next });
  }

  function showAllFromEmpty() {
    choose("all");
    // The button goes with the empty state, so focus moves to the heading rather than dropping to the page.
    document.getElementById("just-listed-title")?.focus();
  }

  let body: ReactNode = allView;
  if (scope === "campus") {
    body =
      campusCount > 0 ? (
        campusView
      ) : (
        <div className="just-listed-empty">
          <p className="just-listed-empty-title">Nothing new at {campusName} yet</p>
          <button type="button" onClick={showAllFromEmpty} className="btn btn-primary">
            Show all campuses
          </button>
        </div>
      );
  }

  return (
    <>
      <SectionHeader
        id="just-listed"
        eyebrow="Just listed"
        title={scope === "all" ? "New on all campuses" : `New at ${campusName}`}
        link={link}
      >
        {campusName && (
          <div role="group" aria-label="Show new listings from" className="scope-switch">
            <button
              type="button"
              aria-pressed={scope === "campus"}
              onClick={() => choose("campus")}
              className="scope-switch-campus"
            >
              {campusName}
            </button>
            <button type="button" aria-pressed={scope === "all"} onClick={() => choose("all")}>
              All campuses
            </button>
          </div>
        )}
      </SectionHeader>
      {body}
    </>
  );
}
```

`components/home/JustListed.tsx`:

```tsx
import { Suspense } from "react";
import { ALL_CAMPUSES, campusLabel } from "@/lib/campus";
import { getCampuses, getJustListed } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import type { CampusChoice, Listing } from "@/lib/types";
import { JustListedViews } from "./JustListedViews";
import { ListingCard, ListingCardSkeleton } from "./ListingCard";
import { SectionError } from "./SectionError";
import { SectionHeader } from "./SectionHeader";

const LIMIT = 10;
const SEE_ALL = { href: "/browse", label: "See all", context: " new listings" };
// Spec 7.8's quiet note. The "Saved on this device" toast says the same at the moment of saving (plan decision 13).
const SAVE_NOTE = "Hearts save to this device for now. They'll move to your account once sign-in arrives.";

/** Just listed (spec 7.8): the newest listings at the visitor's campus, with a switch to every campus. */
export function JustListed() {
  return (
    <section id="just-listed" aria-labelledby="just-listed-title" className="home-section">
      <Suspense fallback={<JustListedSkeleton />}>
        <JustListedContent />
      </Suspense>
    </section>
  );
}

async function loadListings(campus: CampusChoice) {
  const [campuses, own, everywhere] = await Promise.all([
    getCampuses(),
    campus === ALL_CAMPUSES ? [] : getJustListed({ campus, limit: LIMIT }),
    getJustListed({ campus: ALL_CAMPUSES, limit: LIMIT }),
  ]);
  return { campuses, own, everywhere };
}

export async function JustListedContent() {
  const { campus } = await getViewerContext();
  // A failure shows this section's error state, and the rest of the page carries on (plan decision 6).
  const data = await loadListings(campus).catch(() => null);
  if (!data) {
    return (
      <>
        <SectionHeader id="just-listed" eyebrow="Just listed" title="New listings" />
        <SectionError id="just-listed" title="Just listed" />
      </>
    );
  }

  const names = new Map(data.campuses.map((item) => [item.slug, item.name]));
  const grid = (items: readonly Listing[]) => (
    <ul className="listing-grid">
      {items.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} campusName={names.get(listing.campusSlug) ?? ""} />
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <JustListedViews
        campusName={campus === ALL_CAMPUSES ? null : campusLabel(campus, data.campuses)}
        campusCount={data.own.length}
        campusView={grid(data.own)}
        allView={grid(data.everywhere)}
        link={SEE_ALL}
      />
      <p className="just-listed-note">{SAVE_NOTE}</p>
    </>
  );
}

/** The section's shape while it streams in (spec section 9). */
export function JustListedSkeleton() {
  return (
    <>
      <SectionHeader id="just-listed" eyebrow="Just listed" title="New listings" link={SEE_ALL} />
      <ul className="listing-grid" aria-hidden="true">
        {Array.from({ length: LIMIT }, (_, n) => (
          <li key={n}>
            <ListingCardSkeleton />
          </li>
        ))}
      </ul>
      <p className="just-listed-note">{SAVE_NOTE}</p>
    </>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/home/JustListed.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: just listed (Part 2, Task 16, spec 7.8) --- */
@layer components {
  /* 2 columns and 4 cards on phones, 3 and 9 on tablets, 5 and 10 on desktop (plan decision 11). Hidden cards don't
     load their photos. */
  .listing-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 14px;
    margin-top: 16px;
  }

  .listing-grid > li:nth-child(n + 5) {
    display: none;
  }

  .scope-switch {
    display: inline-flex;
    max-width: 100%;
    gap: 3px;
    padding: 2px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
  }

  .scope-switch button {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    color: var(--color-navy);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* A long campus name shortens rather than pushing the switch off a small screen. */
  .scope-switch .scope-switch-campus {
    min-width: 0;
    max-width: 11rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .scope-switch [aria-pressed="true"] {
    background: var(--color-navy);
    color: var(--color-white);
  }

  .just-listed-empty {
    display: grid;
    justify-items: start;
    gap: 14px;
    margin-top: 16px;
    padding: 28px 20px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  .just-listed-empty-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 24px;
    line-height: 1;
    text-transform: uppercase;
  }

  .just-listed-note {
    margin-top: 18px;
    color: var(--color-muted);
    font-size: 12.5px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .listing-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 28px 18px;
      margin-top: 24px;
    }

    .listing-grid > li:nth-child(n + 5) {
      display: list-item;
    }

    .listing-grid > li:nth-child(n + 10) {
      display: none;
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .listing-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .listing-grid > li:nth-child(n + 10) {
      display: list-item;
    }
  }
}
```

- [ ] **Step 6: Put the section on the page**

In `app/page.tsx`:
1. Add `import { JustListed } from "@/components/home/JustListed";`.
2. Replace `{/* Task 16: <JustListed /> */}` with `<JustListed />`.
3. Take `"Just listed"` off `COMING_IN_PART_2`.

- [ ] **Step 7: Check, look, and record the JS**

Run, one at a time:
1. `pnpm test`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`
5. `pnpm e2e tests/e2e/responsive.spec.ts tests/e2e/a11y.spec.ts`
6. `pnpm e2e tests/e2e/performance.spec.ts`. Report `scriptBrotli`.

Look at 390 × 844 and 1280 × 800:
- 4 cards in two columns on the phone, and 10 in five columns on desktop;
- save a card: the heart fills, the toast says "Saved on this device", and the header's Saved count goes up.

Then choose Midrand in Shop by campus:
- the page scrolls to "New at Midrand" and focus is on the heading;
- the switch works.

Then choose Mbombela from the header pill. The empty state shows, and "Show all campuses" works.

- [ ] **Step 8: Commit**

Files: `components/home/JustListed.tsx components/home/JustListedViews.tsx components/home/JustListed.test.tsx app/page.tsx app/globals.css`
Message: `feat: add Just listed with the campus switch, the empty state and skeletons`

---

### Task 17: How it works

Spec 7.9: two cards, each with three numbered steps and a button. Buying is a grey card and Selling a navy textured card. A safety row sits underneath. On phones the cards stack. Everything is static.

**Files:**
- Create: `components/home/HowItWorks.tsx`, `components/home/HowItWorks.test.tsx`
- Modify: `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Write the failing test, `components/home/HowItWorks.test.tsx`**

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HowItWorks } from "./HowItWorks";

describe("HowItWorks (spec 7.9)", () => {
  it("explains buying and selling in three steps each, with a button for each", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("region", { name: "Safe, simple, on campus" })).toBeInTheDocument();
    for (const [title, action, href] of [
      ["Buying", "Start shopping", "/browse"],
      ["Selling", "Start selling", "/sell"],
    ]) {
      const card = screen.getByRole("heading", { level: 3, name: title }).parentElement!;
      expect(within(card).getAllByRole("listitem")).toHaveLength(3);
      expect(within(card).getByRole("link", { name: action })).toHaveAttribute("href", href);
    }
  });

  it("ends with the safety rules", () => {
    render(<HowItWorks />);
    const rules = screen.getByRole("list", { name: "How Vossie keeps you safe" });
    expect(within(rules).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Verified sellers",
      "Approved pickup points",
      "Never pay before you see it",
    ]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/home/HowItWorks.test.tsx`
Expected: FAIL, because `./HowItWorks` doesn't exist.

- [ ] **Step 3: Write `components/home/HowItWorks.tsx`**

```tsx
import Link from "next/link";
import { FlagIcon, MapPinIcon, ShieldIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { SectionHeader } from "./SectionHeader";

type Step = { title: string; body: string };

const BUYING: readonly Step[] = [
  { title: "Find it on your campus", body: "Search, browse categories, or shop every campus." },
  { title: "Message the seller", body: "Chat in Vossie or on WhatsApp. Offer a swap if they accept one." },
  { title: "Meet at a pickup point", body: "See it first, then pay or swap on the spot." },
];

const SELLING: readonly Step[] = [
  { title: "Set up your shop", body: "About three minutes, from your phone." },
  { title: "Get approved by the Hub", body: "The Incubation Hub checks every new seller." },
  { title: "List, chat, hand over", body: "Earn badges as buyers confirm your sales." },
];

const SAFETY = [
  { Icon: ShieldIcon, label: "Verified sellers" },
  { Icon: MapPinIcon, label: "Approved pickup points" },
  { Icon: FlagIcon, label: "Never pay before you see it" },
];

/** How it works (spec 7.9). */
export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="home-section">
      <SectionHeader id="how" eyebrow="How Vossie works" title="Safe, simple, on campus" align="center" />
      <div className="how-grid">
        <HowCard title="Buying" steps={BUYING} action={{ href: "/browse", label: "Start shopping" }} tone="grey" />
        <HowCard title="Selling" steps={SELLING} action={{ href: "/sell", label: "Start selling" }} tone="navy" />
      </div>
      <ul aria-label="How Vossie keeps you safe" className="safety-row">
        {SAFETY.map(({ Icon, label }) => (
          <li key={label}>
            <Icon className="safety-icon" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

type HowCardProps = {
  title: string;
  steps: readonly Step[];
  action: { href: string; label: string };
  tone: "grey" | "navy";
};

function HowCard({ title, steps, action, tone }: HowCardProps) {
  return (
    <div className={cx("how-card", tone === "navy" ? "surface-navy texture-stars how-card-navy" : "how-card-grey")}>
      <h3 className="how-card-title">{title}</h3>
      <ol className="how-steps">
        {steps.map((step, n) => (
          <li key={step.title} className="how-step">
            <span className="how-step-number" aria-hidden="true">
              {n + 1}
            </span>
            <span>
              <strong className="how-step-title">{step.title}</strong>
              <span className="how-step-body">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link href={action.href} className={cx("btn how-card-action", tone === "navy" ? "btn-sky" : "btn-primary")}>
        {action.label}
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/home/HowItWorks.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: how it works (Part 2, Task 17, spec 7.9) --- */
@layer components {
  .how-grid {
    display: grid;
    gap: 12px;
    margin-top: 18px;
  }

  .how-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 20px 18px;
    border-radius: var(--radius-panel);
  }

  .how-card-grey {
    background: var(--color-panel);
    color: var(--color-navy);
  }

  .how-card-title {
    font-family: var(--vos-font-display);
    font-size: clamp(1.625rem, 1.45rem + 0.6vw, 1.875rem);
    line-height: 1;
    text-transform: uppercase;
  }

  .how-steps {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }

  .how-step {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    align-items: start;
    gap: 10px;
  }

  .how-step-number {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1.5px solid currentColor;
    border-radius: 999px;
    font-family: var(--vos-font-display);
    font-size: 17px;
  }

  .how-step-title {
    display: block;
    font-size: 13.5px;
    font-weight: 600;
  }

  .how-step-body {
    display: block;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 1.45;
  }

  /* Small text on the star texture is white (decision 14). */
  .how-card-navy .how-step-body {
    color: rgb(255 255 255 / 0.85);
  }

  .how-card-action {
    margin-top: 18px;
  }

  .safety-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 18px;
    color: var(--color-muted);
    font-size: 11.5px;
  }

  .safety-row li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .safety-icon {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--color-sky-dark);
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .how-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
      margin-top: 26px;
    }

    .how-card {
      padding: 30px 30px 26px;
    }

    .how-steps {
      gap: 14px;
      margin-top: 20px;
    }

    .how-step {
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 12px;
    }

    .how-step-number {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }

    .how-step-title {
      font-size: 15px;
    }

    .how-step-body {
      font-size: 13px;
    }

    .how-card-action {
      margin-top: 22px;
    }

    .safety-row {
      justify-content: center;
      gap: 12px 34px;
      margin-top: 22px;
      font-size: 12.5px;
    }
  }
}
```

- [ ] **Step 6: Put the section on the page, and check**

In `app/page.tsx`:
1. Add `import { HowItWorks } from "@/components/home/HowItWorks";`.
2. Replace `{/* Task 17: <HowItWorks /> */}` with `<HowItWorks />`.
3. Take `"How it works"` off `COMING_IN_PART_2`.

Run, one at a time: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

Look at 390 × 844 (the cards stack) and 1280 × 800 (side by side, with the safety row centred).

- [ ] **Step 7: Commit**

Files: `components/home/HowItWorks.tsx components/home/HowItWorks.test.tsx app/page.tsx app/globals.css`
Message: `feat: add How it works with the safety row`

---

### Task 18: Featured today

Spec 7.10: the fair daily seller draw.
- **Cards:** four seller cards, each with a photo, a Featured tag, the business name, the tagline, a Verified seal, and the category and campus.
- **Link:** "How we pick".
- **Layout:** a grid of 4 on desktop, and a swipe row on phones and tablets.
- **Empty:** the section hides when nobody is featured.

The draw changes at midnight in South Africa (plan decision 9). Reading the clock is allowed here because the cookie read before it makes this render per request.

Each card links to a new placeholder page, `/sellers/[slug]`.

**Files:**
- Create: `components/home/FeaturedToday.tsx`, `components/home/FeaturedToday.test.tsx`, `app/sellers/[slug]/page.tsx`
- Modify: `lib/time.ts`, `lib/time.test.ts`, `app/page.tsx`, `app/globals.css`, `tests/e2e/routes.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `lib/time.test.ts`. Change its imports to `import { describe, expect, it, vi } from "vitest";` and `import { sastDate, sastToday } from "./time";`:

```ts
describe("sastToday", () => {
  it("reads the clock and gives today's date in South Africa", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T22:30:00Z"));
    expect(sastToday()).toBe("2026-10-12");
  });
});
```

`components/home/FeaturedToday.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeaturedTodayContent, FeaturedTodaySkeleton } from "./FeaturedToday";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));
const featured = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getFeatured: async (query: Parameters<typeof actual.getFeatured>[0]) => {
      if (featured.mode === "failing") throw new Error("The draw didn't load");
      return featured.mode === "empty" ? [] : actual.getFeatured(query);
    },
  };
});

afterEach(() => {
  featured.mode = "real";
});

describe("Featured today (spec 7.10)", () => {
  it("features four verified sellers from the chosen campus", async () => {
    viewer.campus = "midrand";
    render(await FeaturedTodayContent());
    expect(screen.getByRole("heading", { level: 2, name: "Hustles at Midrand" })).toBeInTheDocument();
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(4);
    expect(within(cards[0]).getByRole("link")).toHaveAttribute("href", expect.stringMatching(/^\/sellers\//));
    expect(within(cards[0]).getByText("Featured")).toBeInTheDocument();
    expect(screen.getAllByText("Verified seller.")).toHaveLength(4);
    expect(screen.getAllByText(/· Midrand$/)).toHaveLength(4);
    expect(screen.getByRole("link", { name: "How we pick featured sellers" })).toHaveAttribute("href", "/how-it-works");
  });

  it("features sellers from every campus when none is chosen", async () => {
    viewer.campus = "all";
    render(await FeaturedTodayContent());
    expect(screen.getByRole("heading", { level: 2, name: "Hustles on every campus" })).toBeInTheDocument();
  });

  it("hides when nobody is featured", async () => {
    featured.mode = "empty";
    const { container } = render(await FeaturedTodayContent());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows its own error state when the draw doesn't load", async () => {
    featured.mode = "failing";
    render(await FeaturedTodayContent());
    expect(screen.getByText("Featured today didn't load.")).toBeInTheDocument();
  });

  it("keeps its heading while it streams in", () => {
    render(<FeaturedTodaySkeleton />);
    expect(screen.getByRole("heading", { level: 2, name: "Hustles on campus" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test lib/time.test.ts components/home/FeaturedToday.test.tsx`
Expected: FAIL. `sastToday` isn't exported, and `./FeaturedToday` doesn't exist.

- [ ] **Step 3: Write the code**

Append to `lib/time.ts`:

```ts
/**
 * Today's date in South Africa. It reads the clock, so call it only where the page renders per request: after a
 * cookie read inside <Suspense>, never while prerendering.
 */
export function sastToday(): string {
  return sastDate(new Date());
}
```

`components/home/FeaturedToday.tsx`:

```tsx
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses, getFeatured } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { sastToday } from "@/lib/time";
import type { Seller } from "@/lib/types";
import { Carousel } from "./Carousel";
import { Photo } from "./Photo";
import { SectionError } from "./SectionError";
import { SectionHeader } from "./SectionHeader";

const HOW_WE_PICK = { href: "/how-it-works", label: "How we pick", context: " featured sellers" };

/** Featured today (spec 7.10): the fair daily draw of verified sellers, the visitor's campus first. */
export function FeaturedToday() {
  return (
    <Suspense fallback={<FeaturedTodaySkeleton />}>
      <FeaturedTodayContent />
    </Suspense>
  );
}

export async function FeaturedTodayContent() {
  const { campus } = await getViewerContext();
  // The cookie read above makes this a per-request render, where reading the clock is allowed.
  const day = sastToday();
  const data = await Promise.all([getFeatured({ campus, day }), getCampuses()]).catch(() => null);
  if (!data) {
    return (
      <FeaturedFrame>
        <SectionHeader id="featured" eyebrow="Featured today" title="Hustles on campus" />
        <SectionError id="featured" title="Featured today" />
      </FeaturedFrame>
    );
  }

  const [sellers, campuses] = data;
  // Spec 7.10: with nobody to feature, the section hides.
  if (sellers.length === 0) return null;
  const names = new Map(campuses.map((item) => [item.slug, item.name]));
  const fromCampus = campus !== ALL_CAMPUSES && sellers.some((seller) => seller.campusSlug === campus);
  const title = fromCampus ? `Hustles at ${names.get(campus)}` : "Hustles on every campus";

  return (
    <FeaturedFrame>
      <Carousel
        label="Featured sellers"
        className="featured-carousel"
        header={<SectionHeader id="featured" eyebrow="Featured today" title={title} link={HOW_WE_PICK} />}
      >
        {sellers.map((seller) => (
          <li key={seller.slug}>
            <SellerCard seller={seller} campusName={names.get(seller.campusSlug) ?? ""} />
          </li>
        ))}
      </Carousel>
    </FeaturedFrame>
  );
}

function FeaturedFrame({ children }: { children: ReactNode }) {
  return (
    <section id="featured" aria-labelledby="featured-title" className="home-section">
      {children}
    </section>
  );
}

function SellerCard({ seller, campusName }: { seller: Seller; campusName: string }) {
  return (
    <article className="seller-card">
      <span className="seller-media">
        <Photo image={seller.image} ratio="4 / 3" sizes="(min-width: 64rem) 270px, (min-width: 48rem) 40vw, 64vw" />
        <span className="seller-tag">Featured</span>
      </span>
      <div className="seller-body">
        <h3 className="seller-name">
          <Link href={`/sellers/${seller.slug}`} className="seller-link">
            {seller.name}
          </Link>
        </h3>
        <p className="seller-tagline">{seller.tagline}</p>
        <p className="seller-meta">
          {seller.verified && (
            <span className="seller-seal">
              <CheckIcon className="size-2.5" strokeWidth={3} />
              <span className="sr-only">Verified seller.</span>
            </span>
          )}
          {seller.category} · {campusName}
        </p>
      </div>
    </article>
  );
}

/** The section's shape while it streams in (spec section 9). */
export function FeaturedTodaySkeleton() {
  return (
    <FeaturedFrame>
      <Carousel
        label="Featured sellers"
        className="featured-carousel"
        header={<SectionHeader id="featured" eyebrow="Featured today" title="Hustles on campus" link={HOW_WE_PICK} />}
      >
        {Array.from({ length: 4 }, (_, n) => (
          <li key={n}>
            <div className="seller-card" aria-hidden="true">
              <span className="skeleton seller-skeleton-photo" />
              <div className="seller-body">
                <span className="skeleton seller-skeleton-name" />
                <span className="skeleton seller-skeleton-line" />
                <span className="skeleton seller-skeleton-line" />
              </div>
            </div>
          </li>
        ))}
      </Carousel>
    </FeaturedFrame>
  );
}
```

`app/sellers/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { getSeller, getSellerSlugs } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/sellers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const seller = await getSeller(slug);
  return { title: seller ? seller.name : "Page not found" };
}

export async function generateStaticParams() {
  return (await getSellerSlugs()).map((slug) => ({ slug }));
}

export default function SellerPage({ params }: PageProps<"/sellers/[slug]">) {
  return (
    // Known sellers are prerendered, so this fallback only shows for an unknown slug, until the 404 takes over.
    <Suspense fallback={null}>
      <SellerDetails params={params} />
    </Suspense>
  );
}

async function SellerDetails({ params }: Pick<PageProps<"/sellers/[slug]">, "params">) {
  const { slug } = await params;
  const seller = await getSeller(slug);
  if (!seller) notFound();
  return <ComingSoon title={seller.name}>{seller.tagline} Seller storefronts arrive in the next stage.</ComingSoon>;
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `pnpm test lib/time.test.ts components/home/FeaturedToday.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: featured today (Part 2, Task 18, spec 7.10) --- */
@layer components {
  .featured-carousel {
    --carousel-item: 64%;
  }

  .seller-card {
    position: relative;
    height: 100%;
    overflow: hidden;
    border: 1.5px solid var(--color-line);
    border-radius: var(--radius-panel);
    background: var(--color-white);
    transition: scale var(--dur-fast) var(--ease-out);
  }

  .seller-card:has(.seller-link:active) {
    scale: 0.98;
  }

  .seller-media {
    position: relative;
    display: block;
  }

  /* Navy on solid sky: 5.0:1. */
  .seller-tag {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--color-sky);
    color: var(--color-navy);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .seller-body {
    padding: 14px 16px 16px;
  }

  .seller-name {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 24px;
    line-height: 1;
    text-transform: uppercase;
  }

  /* The name's link covers the whole card. Its ring is drawn inside the card, which the row would otherwise clip. */
  .seller-link::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .seller-link:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .seller-card:has(.seller-link:focus-visible) {
    outline: 2.5px solid var(--focus-ring, var(--color-navy));
    outline-offset: -4px;
  }

  .seller-tagline {
    margin-top: 6px;
    color: var(--color-muted);
    font-size: 13px;
    line-height: 1.4;
  }

  .seller-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    color: var(--color-muted);
    font-size: 11.5px;
  }

  .seller-seal {
    display: grid;
    flex: none;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--color-navy);
    color: var(--color-white);
  }

  .seller-skeleton-photo {
    display: block;
    aspect-ratio: 4 / 3;
    border-radius: 0;
  }

  .seller-skeleton-name {
    width: 60%;
    height: 22px;
  }

  .seller-skeleton-line {
    height: 12px;
    margin-top: 8px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .featured-carousel {
      --carousel-item: 40%;
    }
  }

  /* Desktop: a grid of four, so the row has nothing to scroll and needs no arrows or bar (spec 7.10). */
  @media (min-width: 64rem) and (min-height: 30rem) {
    .featured-carousel .carousel-track {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      overflow: visible;
    }

    .featured-carousel .carousel-track > li {
      width: auto;
    }

    .featured-carousel .carousel-arrows,
    .featured-carousel .carousel-bar {
      display: none;
    }
  }
}
```

- [ ] **Step 6: Put the section on the page, and add the route tests**

In `app/page.tsx`:
1. Add `import { FeaturedToday } from "@/components/home/FeaturedToday";`.
2. Replace `{/* Task 18: <FeaturedToday /> */}` with `<FeaturedToday />`.
3. Take `"Featured today"` off `COMING_IN_PART_2`.

In `tests/e2e/routes.spec.ts`:
- Add `["/sellers/hair-studio", "Hair studio"],` to `PLACEHOLDERS`.
- Add `"/sellers/nope"` to the unknown-slug test, in the same form as the others.

- [ ] **Step 7: Check and look**

Run, one at a time:
1. `pnpm test`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`. Every `/sellers/[slug]` is prerendered.
5. `pnpm e2e tests/e2e/routes.spec.ts tests/e2e/a11y.spec.ts`

Look at 390 × 844 (a swipe row with a peek of the next card) and 1280 × 800 (a grid of four, with no arrows or bar).

- [ ] **Step 8: Commit**

Files: `components/home/FeaturedToday.tsx components/home/FeaturedToday.test.tsx app/sellers lib/time.ts lib/time.test.ts app/page.tsx app/globals.css tests/e2e/routes.spec.ts`
Message: `feat: add Featured today with the fair daily draw and seller pages`

---

### Task 19: The Looking For band

Spec 7.11: a full-width sky band with navy text.
- **Left:** "Can't find it? Ask for it." with "Post a request".
- **Right:** three open requests from the campus, with their offer counts.
- **Phones:** it stacks and shows two requests.
- **This stage:** the button and the requests go to the `/looking-for` placeholder.

The heading, copy and button are prerendered. Only the requests stream in, so they live in their own module, where tests can stand them in.

**Files:**
- Create: `components/home/LookingFor.tsx`, `components/home/LookingForRequests.tsx`
- Create: `components/home/LookingFor.test.tsx`, `components/home/LookingForRequests.test.tsx`
- Modify: `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Write the failing tests**

`components/home/LookingFor.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LookingFor } from "./LookingFor";

// The requests read the cookie on the server; LookingForRequests.test.tsx covers them.
vi.mock("./LookingForRequests", () => ({
  LookingForRequests: () => <ul aria-label="Open requests" />,
  RequestsSkeleton: () => null,
}));

describe("LookingFor (spec 7.11)", () => {
  it("asks for requests, with a navy eyebrow on the sky band", () => {
    render(<LookingFor />);
    expect(screen.getByRole("region", { name: "Can’t find it? Ask for it." })).toBeInTheDocument();
    expect(screen.getByText("Looking For")).toHaveClass("text-navy");
    expect(screen.getByRole("list", { name: "Open requests" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute("href", "/looking-for");
  });
});
```

`components/home/LookingForRequests.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LookingForRequests } from "./LookingForRequests";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));
const requests = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getRequests: async (query: Parameters<typeof actual.getRequests>[0]) => {
      if (requests.mode === "failing") throw new Error("The requests didn't load");
      return requests.mode === "empty" ? [] : actual.getRequests(query);
    },
  };
});

afterEach(() => {
  requests.mode = "real";
});

describe("LookingForRequests", () => {
  it("lists three open requests, the campus's own first, with their offers", async () => {
    viewer.campus = "midrand";
    render(await LookingForRequests());
    const rows = within(screen.getByRole("list", { name: "Open requests" })).getAllByRole("link");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Accounting 1 tutor this week Midrand · 2 offers",
      "Birthday cake for Friday Midrand · 3 offers",
      "Graphic calculator to borrow for exams Pretoria · 1 offer",
    ]);
    expect(rows[0]).toHaveAttribute("href", "/looking-for");
  });

  it("invites the first request when there are none", async () => {
    requests.mode = "empty";
    render(await LookingForRequests());
    expect(screen.getByText("No open requests yet. Be the first to ask.")).toBeInTheDocument();
  });

  it("shows its own error state when the requests don't load", async () => {
    requests.mode = "failing";
    render(await LookingForRequests());
    expect(screen.getByText("Open requests didn't load.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test components/home/LookingFor`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Write the band**

`components/home/LookingForRequests.tsx`:

```tsx
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { getCampuses, getRequests } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { offersLabel } from "@/lib/format";
import { SectionError } from "./SectionError";

/** Three open requests, the visitor's campus first. Phones show two (spec 7.11). */
export async function LookingForRequests() {
  const { campus } = await getViewerContext();
  const data = await Promise.all([getRequests({ campus, limit: 3 }), getCampuses()]).catch(() => null);
  if (!data) return <SectionError id="looking-for" title="Open requests" />;

  const [requests, campuses] = data;
  if (requests.length === 0) return <p className="looking-for-empty">No open requests yet. Be the first to ask.</p>;
  const names = new Map(campuses.map((item) => [item.slug, item.name]));

  return (
    <ul aria-label="Open requests" className="request-list">
      {requests.map((request) => (
        <li key={request.id}>
          {/* Requests open on the Looking For page, a placeholder in this stage (spec 7.11). */}
          <Link href="/looking-for" className="request-row">
            <span className="request-text">
              <span className="request-title">{request.title}</span>{" "}
              <span className="request-meta">
                {names.get(request.campusSlug)} · {offersLabel(request.offers)}
              </span>
            </span>
            <ArrowRightIcon className="request-arrow" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The request rows' shape while they stream in (spec section 9). */
export function RequestsSkeleton() {
  return (
    <ul className="request-list" aria-hidden="true">
      {[0, 1, 2].map((n) => (
        <li key={n}>
          <span className="skeleton request-skeleton" />
        </li>
      ))}
    </ul>
  );
}
```

`components/home/LookingFor.tsx`:

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { LookingForRequests, RequestsSkeleton } from "./LookingForRequests";
import { SectionHeader } from "./SectionHeader";

/** The Looking For band (spec 7.11). Only the open requests depend on the campus, so only they stream in. */
export function LookingFor() {
  return (
    <section id="looking-for" aria-labelledby="looking-for-title" className="home-panel looking-for">
      <div className="looking-for-intro">
        <SectionHeader id="looking-for" eyebrow="Looking For" title="Can’t find it? Ask for it." tone="navy" />
        <p className="looking-for-copy">Post what you need and sellers on your campus come to you with offers.</p>
      </div>
      <div className="looking-for-requests">
        <Suspense fallback={<RequestsSkeleton />}>
          <LookingForRequests />
        </Suspense>
      </div>
      <Link href="/looking-for" className="btn btn-primary looking-for-action">
        Post a request
      </Link>
    </section>
  );
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `pnpm test components/home/LookingFor`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: looking for (Part 2, Task 19, spec 7.11) --- */
@layer components {
  /* Navy on sky is 5.0:1 at any size. */
  .looking-for {
    display: grid;
    gap: 16px;
    padding: 26px 20px;
    background: var(--color-sky);
    color: var(--color-navy);
  }

  .looking-for .section-title {
    font-size: clamp(2.5rem, 1.75rem + 2.6vw, 3.625rem);
    line-height: 0.96;
  }

  .looking-for-copy {
    max-width: 44ch;
    margin-top: 12px;
    font-size: 14px;
    line-height: 1.55;
  }

  .looking-for-action {
    justify-self: start;
  }

  .request-list {
    display: grid;
    gap: 10px;
  }

  /* Two requests on phones (spec 7.11). */
  .request-list > li:nth-child(n + 3) {
    display: none;
  }

  .request-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    padding: 12px 14px;
    border-radius: var(--radius-strip);
    background: var(--color-white);
    transition: scale var(--dur-fast) var(--ease-out);
  }

  .request-row:active {
    scale: 0.98;
  }

  .request-text {
    display: grid;
  }

  .request-title {
    font-size: 13px;
    font-weight: 600;
  }

  .request-meta {
    margin-top: 2px;
    color: var(--color-muted);
    font-size: 12px;
  }

  .request-arrow {
    flex: none;
    width: 18px;
    height: 18px;
  }

  .request-skeleton {
    display: block;
    height: 64px;
    border-radius: var(--radius-strip);
    background: rgb(255 255 255 / 0.5);
  }

  .looking-for-empty {
    font-size: 14px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .looking-for {
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      grid-template-areas:
        "intro requests"
        "action requests";
      align-items: center;
      gap: 22px 44px;
      padding: 48px;
      border-radius: var(--radius-panel);
    }

    .looking-for-intro {
      grid-area: intro;
      align-self: end;
    }

    .looking-for-requests {
      grid-area: requests;
    }

    .looking-for-action {
      grid-area: action;
      align-self: start;
    }

    .request-list > li:nth-child(n + 3) {
      display: list-item;
    }

    .request-row {
      padding: 14px 16px;
    }

    .request-title {
      font-size: 14px;
    }

    .looking-for-copy {
      font-size: 15px;
    }
  }
}
```

- [ ] **Step 6: Put the band on the page, and check**

In `app/page.tsx`:
1. Add `import { LookingFor } from "@/components/home/LookingFor";`.
2. Replace `{/* Task 19: <LookingFor /> */}` with `<LookingFor />`.
3. Take `"Looking For"` off `COMING_IN_PART_2`.

Run, one at a time: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm e2e tests/e2e/a11y.spec.ts`.

Look at 390 × 844 (it stacks, with two requests and the button last) and 1280 × 800 (two columns, with three requests).

- [ ] **Step 7: Commit**

Files: `components/home/LookingFor.tsx components/home/LookingForRequests.tsx components/home/LookingFor.test.tsx components/home/LookingForRequests.test.tsx app/page.tsx app/globals.css`
Message: `feat: add the Looking For band with open requests from the campus`

---

### Task 20: Free & swaps

Spec 7.12: a pale sky panel with a swipe row of item cards, each stamped FREE (navy) or SWAP (sky-dark). The header is "Pass it on" with "See all". The section hides when there's nothing to show.

**Files:**
- Create: `components/home/FreeAndSwaps.tsx`, `components/home/FreeAndSwaps.test.tsx`
- Modify: `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Write the failing test, `components/home/FreeAndSwaps.test.tsx`**

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FreeAndSwapsContent, FreeAndSwapsSkeleton } from "./FreeAndSwaps";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));
const items = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getFreeAndSwaps: async (query: Parameters<typeof actual.getFreeAndSwaps>[0]) => {
      if (items.mode === "failing") throw new Error("The items didn't load");
      return items.mode === "empty" ? [] : actual.getFreeAndSwaps(query);
    },
  };
});

afterEach(() => {
  items.mode = "real";
});

describe("Free & swaps (spec 7.12)", () => {
  it("is a pale panel of stamped items, the campus's own first", async () => {
    viewer.campus = "midrand";
    render(await FreeAndSwapsContent());
    expect(screen.getByRole("region", { name: "Pass it on" })).toBeInTheDocument();
    expect(screen.getByText("Free & swaps")).toHaveClass("text-navy");
    const cards = within(screen.getByRole("region", { name: "Free and swap items" })).getAllByRole("article");
    expect(cards).toHaveLength(7);
    expect(within(cards[0]).getByText("Free")).toBeInTheDocument();
    expect(within(cards[0]).getByRole("link", { name: "Business Management 1 notes" })).toHaveAttribute(
      "href",
      "/listings/fs-001",
    );
    expect(within(cards[0]).getByText("Midrand")).toBeInTheDocument();
    expect(screen.getAllByText("Swap")).toHaveLength(3);
  });

  it("hides when there's nothing to give away or swap", async () => {
    items.mode = "empty";
    const { container } = render(await FreeAndSwapsContent());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows its own error state when the items don't load", async () => {
    items.mode = "failing";
    render(await FreeAndSwapsContent());
    expect(screen.getByText("Free & swaps didn't load.")).toBeInTheDocument();
  });

  it("keeps its heading while it streams in", () => {
    render(<FreeAndSwapsSkeleton />);
    expect(screen.getByRole("heading", { level: 2, name: "Pass it on" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/home/FreeAndSwaps.test.tsx`
Expected: FAIL, because `./FreeAndSwaps` doesn't exist.

- [ ] **Step 3: Write `components/home/FreeAndSwaps.tsx`**

```tsx
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getCampuses, getFreeAndSwaps } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { cx } from "@/lib/cx";
import type { FreeSwapItem } from "@/lib/types";
import { Carousel } from "./Carousel";
import { Photo } from "./Photo";
import { SectionError } from "./SectionError";
import { SectionHeader } from "./SectionHeader";

// Browse filters are settled with the browse page (a placeholder in this stage); this one asks for both kinds.
const SEE_ALL = { href: "/browse?deals=free-and-swaps", label: "See all", context: " free and swap items" };

/** Free & swaps (spec 7.12): giveaways and swap-only items, the visitor's campus first. */
export function FreeAndSwaps() {
  return (
    <Suspense fallback={<FreeAndSwapsSkeleton />}>
      <FreeAndSwapsContent />
    </Suspense>
  );
}

export async function FreeAndSwapsContent() {
  const { campus } = await getViewerContext();
  const data = await Promise.all([getFreeAndSwaps({ campus, limit: 8 }), getCampuses()]).catch(() => null);
  if (!data) {
    return (
      <FreeAndSwapsFrame>
        <Header />
        <SectionError id="free-swaps" title="Free & swaps" />
      </FreeAndSwapsFrame>
    );
  }

  const [items, campuses] = data;
  // Spec 7.12: with nothing to show, the section hides.
  if (items.length === 0) return null;
  const names = new Map(campuses.map((item) => [item.slug, item.name]));

  return (
    <FreeAndSwapsFrame>
      <Carousel label="Free and swap items" className="free-swaps-carousel" header={<Header />}>
        {items.map((item) => (
          <li key={item.id}>
            <FreeSwapCard item={item} campusName={names.get(item.campusSlug) ?? ""} />
          </li>
        ))}
      </Carousel>
    </FreeAndSwapsFrame>
  );
}

function FreeAndSwapsFrame({ children }: { children: ReactNode }) {
  return (
    <section id="free-swaps" aria-labelledby="free-swaps-title" className="home-panel free-swaps">
      {children}
    </section>
  );
}

/** Navy, not sky-dark: sky-dark is 4.04:1 on the pale panel (plan decision 7). */
function Header() {
  return <SectionHeader id="free-swaps" eyebrow="Free & swaps" title="Pass it on" tone="navy" link={SEE_ALL} />;
}

function FreeSwapCard({ item, campusName }: { item: FreeSwapItem; campusName: string }) {
  return (
    <article className="free-card">
      <span className="free-card-media">
        <Photo
          image={{ src: item.image.src, alt: "" }}
          ratio="4 / 3"
          sizes="(min-width: 64rem) 204px, (min-width: 48rem) 30vw, 46vw"
        />
        <span className={cx("free-stamp", item.kind === "swap" && "free-stamp-swap")}>
          {item.kind === "free" ? "Free" : "Swap"}
        </span>
      </span>
      <h3 className="free-card-title">
        <Link href={`/listings/${item.id}`} className="free-card-link">
          {item.title}
        </Link>
      </h3>
      <p className="free-card-meta">{campusName}</p>
    </article>
  );
}

/** The section's shape while it streams in (spec section 9). */
export function FreeAndSwapsSkeleton() {
  return (
    <FreeAndSwapsFrame>
      <Carousel label="Free and swap items" className="free-swaps-carousel" header={<Header />}>
        {Array.from({ length: 5 }, (_, n) => (
          <li key={n}>
            <div className="free-card" aria-hidden="true">
              <span className="skeleton free-skeleton-photo" />
              <span className="skeleton free-skeleton-line" />
              <span className="skeleton free-skeleton-meta" />
            </div>
          </li>
        ))}
      </Carousel>
    </FreeAndSwapsFrame>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/home/FreeAndSwaps.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: free and swaps (Part 2, Task 20, spec 7.12) --- */
@layer components {
  .free-swaps {
    padding: 24px 16px;
    background: var(--color-pale);
  }

  .free-swaps-carousel {
    --carousel-item: 46%;
  }

  .free-card {
    position: relative;
    height: 100%;
    overflow: hidden;
    border-radius: var(--radius-card);
    background: var(--color-white);
    transition: scale var(--dur-fast) var(--ease-out);
  }

  .free-card:has(.free-card-link:active) {
    scale: 0.98;
  }

  .free-card-media {
    position: relative;
    display: block;
  }

  /* Navy (FREE) and sky-dark (SWAP) on white: 13:1 and 4.7:1. */
  .free-stamp {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 4px 10px;
    border: 2px solid currentColor;
    border-radius: 6px;
    background: var(--color-white);
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 20px;
    line-height: 1;
    text-transform: uppercase;
    rotate: -6deg;
  }

  .free-stamp-swap {
    color: var(--color-sky-dark);
  }

  .free-card-title {
    padding: 12px 14px 4px;
    color: var(--color-navy);
    font-size: 13.5px;
    font-weight: 500;
    line-height: 1.35;
  }

  /* The title's link covers the whole card. Its ring is drawn inside the card, which the row would otherwise clip. */
  .free-card-link::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .free-card-link:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .free-card:has(.free-card-link:focus-visible) {
    outline: 2.5px solid var(--focus-ring, var(--color-navy));
    outline-offset: -4px;
  }

  .free-card-meta {
    padding: 0 14px 14px;
    color: var(--color-muted);
    font-size: 12px;
  }

  .free-skeleton-photo {
    display: block;
    aspect-ratio: 4 / 3;
    border-radius: 0;
  }

  .free-skeleton-line {
    display: block;
    height: 14px;
    margin: 14px 14px 0;
  }

  .free-skeleton-meta {
    display: block;
    width: 50%;
    height: 12px;
    margin: 8px 14px 14px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .free-swaps {
      padding: 44px 40px 40px;
      border-radius: var(--radius-panel);
    }

    .free-swaps-carousel {
      --carousel-item: 30%;
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .free-swaps-carousel {
      --carousel-item: calc((100% - 4 * 16px) / 5.4);
    }
  }
}
```

- [ ] **Step 6: Put the section on the page, and check**

In `app/page.tsx`:
1. Add `import { FreeAndSwaps } from "@/components/home/FreeAndSwaps";`.
2. Replace `{/* Task 20: <FreeAndSwaps /> */}` with `<FreeAndSwaps />`.
3. Take `"Free & swaps"` off `COMING_IN_PART_2`.

Run, one at a time: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm e2e tests/e2e/a11y.spec.ts`.

Look at 390 × 844 and 1280 × 800. Check:
- the stamps tilt and sit top-left on each photo;
- the row swipes;
- the arrows page it on desktop.

- [ ] **Step 7: Commit**

Files: `components/home/FreeAndSwaps.tsx components/home/FreeAndSwaps.test.tsx app/page.tsx app/globals.css`
Message: `feat: add Free & swaps with FREE and SWAP stamps`

---

### Task 21: The Hub banner and What's on, and the finished page

Spec 7.13: a full-width photo with a navy gradient and rounded top corners, sitting on the footer.
- **Left:** "The Eduvos Incubation Hub", the heading, a paragraph and "Our story".
- **Right:** a white "What's on" card with the next three events. Each has a date block, the title, the campus and RSVP or Book.
- **Phones:** the photo and text stack, with the events card underneath.
- **Empty:** the card says "No events this week" and links to the Hub.

**How it's built.**
- The banner photo is decorative. With data saver on, it isn't loaded (plan decision 8).
- The events depend on the campus, so they stream in from their own module.
- This task finishes `app/page.tsx`. The "coming in Part 2" list goes, and the banner sits outside the page column, so it can run full width.
- The page now has far more stops for the keyboard, so the keyboard-reach test gets a longer walk.

**Files:**
- Create: `components/home/HubBanner.tsx`, `components/home/WhatsOn.tsx`
- Create: `components/home/HubBanner.test.tsx`, `components/home/WhatsOn.test.tsx`
- Modify: `app/page.tsx`, `app/globals.css`, `tests/e2e/responsive.spec.ts`

- [ ] **Step 1: Write the failing tests**

`components/home/HubBanner.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HubBanner } from "./HubBanner";

// The events read the cookie on the server; WhatsOn.test.tsx covers them.
vi.mock("./WhatsOn", () => ({
  WhatsOnEvents: () => <ul aria-label="Events" />,
  EventsSkeleton: () => null,
}));

describe("HubBanner (spec 7.13)", () => {
  it("introduces the Hub and holds What's on", async () => {
    const { container } = render(await HubBanner());
    expect(screen.getByRole("region", { name: "Built for student hustles, backed by the Hub" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Our story" })).toHaveAttribute("href", "/hub");
    expect(screen.getByRole("heading", { level: 3, name: "What’s on" })).toBeInTheDocument();
    expect(container.querySelector(".hub-banner-media")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".hub-banner-media img")).toHaveAttribute("alt", "");
  });
});
```

`components/home/WhatsOn.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatsOnEvents } from "./WhatsOn";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));
const events = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getHubEvents: async (query: Parameters<typeof actual.getHubEvents>[0]) => {
      if (events.mode === "failing") throw new Error("The events didn't load");
      return events.mode === "empty" ? [] : actual.getHubEvents(query);
    },
  };
});

afterEach(() => {
  events.mode = "real";
});

describe("WhatsOnEvents (spec 7.13)", () => {
  it("lists the campus's next three events with a date block and an action", async () => {
    viewer.campus = "midrand";
    const { container } = render(await WhatsOnEvents());
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Pitch night")).toBeInTheDocument();
    expect(within(rows[0]).getByText("All campuses")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Midrand")).toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-10-14");
    expect(container.querySelector("time")).toHaveTextContent("14Oct");
    expect(within(rows[0]).getByRole("link", { name: "RSVP for Pitch night" })).toHaveAttribute("href", "/hub");
    expect(within(rows[1]).getByRole("link", { name: "Book for Office hours: pricing your hustle" })).toBeInTheDocument();
  });

  it("says when nothing is on, and points to the Hub", async () => {
    events.mode = "empty";
    render(await WhatsOnEvents());
    expect(screen.getByText(/No events this week/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See what the Hub is planning" })).toHaveAttribute("href", "/hub");
  });

  it("shows its own error state when the events don't load", async () => {
    events.mode = "failing";
    render(await WhatsOnEvents());
    expect(screen.getByText("What’s on didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/?retry=whats-on#whats-on");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test components/home/HubBanner.test.tsx components/home/WhatsOn.test.tsx`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Write the banner and the events**

`components/home/WhatsOn.tsx`:

```tsx
import Link from "next/link";
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses, getHubEvents } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { eventDate } from "@/lib/format";
import { SectionError } from "./SectionError";

/** The next three Hub events for the visitor's campus, every-campus events included (spec 7.13). */
export async function WhatsOnEvents() {
  const { campus } = await getViewerContext();
  const data = await Promise.all([getHubEvents({ campus, limit: 3 }), getCampuses()]).catch(() => null);
  if (!data) return <SectionError id="whats-on" title="What’s on" />;

  const [events, campuses] = data;
  if (events.length === 0) {
    return (
      <p className="whats-on-empty">
        No events this week. <Link href="/hub">See what the Hub is planning</Link>
      </p>
    );
  }
  const names = new Map(campuses.map((item) => [item.slug, item.name]));

  return (
    <ul className="events">
      {events.map((event) => {
        const { day, month } = eventDate(event.date);
        const action = event.action === "rsvp" ? "RSVP" : "Book";
        return (
          <li key={event.id} className="event">
            <time dateTime={event.date} className="event-date">
              <span className="event-day">{day}</span>
              <span className="event-month">{month}</span>
            </time>
            <span className="event-text">
              <span className="event-title">{event.title}</span>{" "}
              <span className="event-where">
                {event.campusSlug === ALL_CAMPUSES ? "All campuses" : names.get(event.campusSlug)}
              </span>
            </span>
            {/* The Hub page is a placeholder in this stage; RSVP and booking arrive with it. */}
            <Link href="/hub" className="event-action">
              {action}
              <span className="sr-only"> for {event.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The event rows' shape while they stream in (spec section 9). */
export function EventsSkeleton() {
  return (
    <ul className="events" aria-hidden="true">
      {[0, 1, 2].map((n) => (
        <li key={n} className="event">
          <span className="skeleton event-skeleton-date" />
          <span className="skeleton event-skeleton-text" />
        </li>
      ))}
    </ul>
  );
}
```

`components/home/HubBanner.tsx`:

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { getHubBanner } from "@/lib/data";
import { Photo } from "./Photo";
import { EventsSkeleton, WhatsOnEvents } from "./WhatsOn";

/** The Hub banner and What's on (spec 7.13): full width, sitting on the footer. */
export async function HubBanner() {
  const banner = await getHubBanner();
  return (
    <section aria-labelledby="hub-title" className="hub-banner">
      <div className="hub-banner-inner">
        <div className="hub-banner-text">
          {/* Decorative, and not loaded at all with data saver on (plan decision 8). */}
          <div className="hub-banner-media" aria-hidden="true">
            <Photo image={{ src: banner.image.src, alt: "" }} sizes="100vw" className="hub-banner-photo" />
          </div>
          <p className="hub-banner-label">The Eduvos Incubation Hub</p>
          <h2 id="hub-title" className="hub-banner-title">
            Built for student hustles, backed by the Hub
          </h2>
          <p className="hub-banner-copy">
            Vossie is run by the Eduvos Incubation Hub. Mentors help sellers grow, and the Hub runs pitch nights,
            workshops and office hours on every campus.
          </p>
          <Link href="/hub" className="btn btn-sky hub-banner-action">
            Our story
          </Link>
        </div>
        <div id="whats-on" className="whats-on">
          <h3 className="whats-on-title">What’s on</h3>
          <Suspense fallback={<EventsSkeleton />}>
            <WhatsOnEvents />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `pnpm test components/home/HubBanner.test.tsx components/home/WhatsOn.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the CSS**

Append to `app/globals.css`:

```css
/* --- Homepage: hub banner and what's on (Part 2, Task 21, spec 7.13) --- */
@layer components {
  /* Edge to edge: #main pads itself for the iPhone notch, so the band cancels that padding and puts it back inside
     (Part 1 handoff, "Full-width bands"). Without this, landscape iPhones show thin white strips at the sides. */
  .hub-banner {
    position: relative;
    isolation: isolate;
    margin-top: clamp(3.25rem, 2.6rem + 2.4vw, 5.75rem);
    margin-inline: calc(env(safe-area-inset-left) * -1) calc(env(safe-area-inset-right) * -1);
    padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);
    overflow: hidden;
    border-radius: var(--radius-card) var(--radius-card) 0 0;
    background: var(--color-navy);
    color: var(--color-white);
    --focus-ring: var(--color-sky);
    --focus-halo: var(--color-navy);
  }

  /* The banner sits on the footer (spec 7.13), so the footer drops its usual gap. */
  body:has(.hub-banner) .site-footer {
    margin-top: 0;
  }

  .hub-banner-inner {
    display: grid;
    max-width: calc(var(--container-page) + 48px);
    margin-inline: auto;
  }

  /* Phones: the photo behind the text, then the white events card underneath. */
  .hub-banner-text {
    position: relative;
    z-index: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    min-height: 300px;
    padding: 24px 20px;
  }

  .hub-banner-media {
    position: absolute;
    inset: 0;
    z-index: -1;
  }

  /* Navy over the photo, so the white text reads on any picture. */
  .hub-banner-media::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(0deg, rgb(9 20 42 / 0.9), rgb(9 20 42 / 0.35));
  }

  .hub-banner-photo {
    position: absolute;
    inset: 0;
  }

  /* With data saver on, the photo is never requested: lazy images that aren't displayed don't load (plan decision 8). */
  :root[data-low-data] .hub-banner-media {
    display: none;
  }

  .hub-banner-label {
    margin-bottom: 12px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }

  .hub-banner-title {
    max-width: 16ch;
    font-family: var(--vos-font-display);
    font-size: clamp(2.375rem, 1.6rem + 2.6vw, 3.625rem);
    line-height: 0.98;
    text-transform: uppercase;
  }

  .hub-banner-copy {
    max-width: 46ch;
    margin-top: 12px;
    color: rgb(255 255 255 / 0.88);
    font-size: 14px;
    line-height: 1.6;
  }

  .hub-banner-action {
    margin-top: 18px;
  }

  /* White card: back to the navy ring for white surfaces. */
  .whats-on {
    padding: 14px 20px 4px;
    background: var(--color-white);
    color: var(--color-navy);
    --focus-ring: var(--color-navy);
    --focus-halo: transparent;
  }

  .whats-on-title {
    margin-bottom: 6px;
    font-family: var(--vos-font-display);
    font-size: 20px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .event {
    display: grid;
    grid-template-columns: 50px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding-block: 10px;
    border-top: 1px solid var(--color-line);
  }

  .event-date {
    display: grid;
    justify-items: center;
    font-family: var(--vos-font-display);
    line-height: 0.85;
    text-transform: uppercase;
  }

  .event-day {
    font-size: 28px;
  }

  .event-month {
    margin-top: 2px;
    color: var(--color-sky-dark);
    font-size: 12px;
  }

  .event-text {
    display: grid;
  }

  .event-title {
    font-size: 13.5px;
    font-weight: 600;
  }

  .event-where {
    color: var(--color-muted);
    font-size: 12px;
  }

  .event-action {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 12px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .event-skeleton-date {
    width: 40px;
    height: 40px;
  }

  .event-skeleton-text {
    height: 32px;
  }

  .whats-on-empty {
    padding: 12px 0 16px;
    border-top: 1px solid var(--color-line);
    font-size: 13.5px;
  }

  .whats-on-empty a {
    color: var(--color-sky-dark);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .hub-banner {
      border-radius: var(--radius-panel) var(--radius-panel) 0 0;
    }

    .hub-banner-inner {
      grid-template-columns: minmax(0, 1fr) minmax(0, 340px);
      align-items: end;
      gap: 40px;
      min-height: 440px;
      padding: 48px clamp(24px, 4vw, 56px);
    }

    /* From the tablet step the photo fills the whole banner, so the text box stops being its frame. */
    .hub-banner-text {
      position: static;
      min-height: 0;
      padding: 0;
    }

    .hub-banner-media::after {
      background: linear-gradient(90deg, rgb(9 20 42 / 0.85), rgb(9 20 42 / 0.4));
    }

    .whats-on {
      position: relative;
      padding: 16px 18px 6px;
      border-radius: var(--radius-card);
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .hub-banner-inner {
      grid-template-columns: minmax(0, 1fr) 410px;
      gap: 56px;
    }
  }
}
```

- [ ] **Step 6: Finish `app/page.tsx`**

Replace the whole file:

```tsx
import { Collections } from "@/components/home/Collections";
import { ContextStrip } from "@/components/home/ContextStrip";
import { FeaturedToday } from "@/components/home/FeaturedToday";
import { FreeAndSwaps } from "@/components/home/FreeAndSwaps";
import { Hero } from "@/components/home/hero/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { HubBanner } from "@/components/home/HubBanner";
import { JustListed } from "@/components/home/JustListed";
import { LookingFor } from "@/components/home/LookingFor";
import { ShopByCampus } from "@/components/home/ShopByCampus";
import { ShopByCategory } from "@/components/home/ShopByCategory";

/**
 * The homepage (spec section 7), in the approved order (decision 4). The campus-aware parts stream in behind
 * skeletons; everything else is prerendered.
 */
export default function HomePage() {
  return (
    <>
      <div className="home">
        <Hero />
        <ContextStrip />
        <ShopByCategory />
        <Collections />
        <ShopByCampus />
        <JustListed />
        <HowItWorks />
        <FeaturedToday />
        <LookingFor />
        <FreeAndSwaps />
      </div>
      {/* Full width, sitting on the footer (spec 7.13). */}
      <HubBanner />
    </>
  );
}
```

- [ ] **Step 7: Give the keyboard test a longer walk**

The finished page has about 110 stops for the keyboard before the footer's sign-up button on desktop. In `tests/e2e/responsive.spec.ts`, in "the main controls are reachable with the keyboard", change `i < 120` to `i < 250`.

- [ ] **Step 8: Check the whole suite, and look**

Run, one at a time:
1. `pnpm test`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm build`. `/` is partially prerendered (◐).
5. `pnpm e2e`, the full suite on all five projects. Report pass, skip and fail counts.

Expect the shell tests to pass unchanged, now with real content below the hero.

Look at the whole page at 390 × 844 and 1280 × 800, top to bottom, against `docs/reference/mockups/home-v2.html`:
- the banner runs full width and sits flush on the footer;
- the events card is on the right on desktop and underneath on the phone.

Then turn data saver on in the menu and reload. The banner shows navy with no photo, and the network panel has no request for `banner.svg`.

- [ ] **Step 9: Commit**

Files: `components/home/HubBanner.tsx components/home/WhatsOn.tsx components/home/HubBanner.test.tsx components/home/WhatsOn.test.tsx app/page.tsx app/globals.css tests/e2e/responsive.spec.ts`
Message: `feat: add the Hub banner with What's on, and finish the homepage`

---

### Task 22: Scroll reveals

Spec 8: "Scroll reveals (a 16px rise and fade) are an enhancement that only applies where supported."

They're CSS scroll-driven animations (plan decision 16). There's no JavaScript, and browsers without support show the content as it is.

**Where they don't run:**
- with reduced motion or data saver. They're scoped out, so the off switches never have to stop them;
- on the hero and the strip under it, which are above the fold;
- on the Hub banner, which sits on the footer.

**Finishing early.** Each reveal is done within the first 120px of a section entering the screen, so anything you can read is fully shown.

**Files:**
- Create: `tests/e2e/reveal.spec.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing test, `tests/e2e/reveal.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

// Scroll reveals (spec 8) are CSS scroll-driven animations. Chromium runs them, so they are checked here.
test.describe("scroll reveals (spec 8)", () => {
  test.beforeEach(() => {
    test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Checked at 390 and 1440");
  });

  test("a section below the fold waits to rise in", async ({ page }) => {
    await page.goto("/");
    const opacity = await page.locator("#featured").evaluate((element) => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBeLessThan(1);
  });

  test("a section is fully shown once it's on screen", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#featured");
    await section.evaluate((element) => element.scrollIntoView({ block: "start" }));
    await expect.poll(() => section.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  });

  test("nothing reveals with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(await page.locator("#featured").evaluate((element) => element.getAnimations().length)).toBe(0);
  });

  test("nothing reveals with data saver on", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vossie_low_data", "1"));
    await page.goto("/");
    expect(await page.locator("#featured").evaluate((element) => element.getAnimations().length)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm e2e tests/e2e/reveal.spec.ts`
Expected: the first test fails, because the section is fully shown already. The other three pass.

- [ ] **Step 3: Add the reveal**

Append to `app/globals.css`, outside any layer:

```css
/* --- Homepage: scroll reveals (Part 2, Task 22, spec 8) ---
   Each section rises 16px and fades in as it enters the screen. CSS only (scroll-driven animations): it costs no
   JavaScript, and browsers without support simply show the content (plan decision 16). It never runs with
   reduced motion or data saver, so the off switches above never have to stop it. It's done within the first 120px
   of a section entering, so anything you can read is fully shown. The hero, the strip under it and the Hub banner
   aren't sections of this kind, so they never animate. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    :root:not([data-low-data]) :is(.home-section, .home-panel) {
      animation: section-reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 120px;
    }
  }
}

@keyframes section-reveal {
  from {
    opacity: 0;
    translate: 0 16px;
  }
}
```

The `animation` shorthand resets `animation-timeline`, so the timeline must come after it, as written.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm e2e tests/e2e/reveal.spec.ts`
Expected: PASS (4 tests at 390 and 4 at 1440).

Then run `pnpm e2e tests/e2e/a11y.spec.ts tests/e2e/shell.spec.ts`. The a11y run uses reduced motion, so axe never sees a section mid-fade.

- [ ] **Step 5: Look at it**

On a production build at 1280 × 800, scroll slowly. Each section should rise and fade in once, within a short distance, and stay put when you scroll back up. With reduced motion emulated, nothing moves.

- [ ] **Step 6: Commit**

Files: `app/globals.css tests/e2e/reveal.spec.ts`
Message: `feat: add CSS-only scroll reveals to the homepage sections`

---

### Task 23: Footer campuses in two columns

Decision 17: the footer is about 1,620px tall at 1280px, so on desktop the campus list goes into two columns, as in the mockup. Part 1's handoff gives the order:
1. narrow the sign-up column by stacking the email field above its button;
2. put the campuses in two columns;
3. check at 1024, 1280 and 1440.

The phone accordions keep one column.

**Files:**
- Modify: `components/footer/SiteFooter.tsx`, `components/footer/SiteFooter.test.tsx`, `app/globals.css`

- [ ] **Step 1: Measure the footer now**

Build and start production (`pnpm build`, then `pnpm start --port 3201`). With a throwaway Playwright script at 1280 × 800, log `document.querySelector(".site-footer").offsetHeight`. Note the number, then stop the server.

- [ ] **Step 2: Write the failing test**

Add `within` to the Testing Library import in `components/footer/SiteFooter.test.tsx`, and add:

```tsx
  it("sets the campuses in two columns on desktop, but not in the phone's accordion (decision 17)", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    const columns = container.querySelectorAll<HTMLElement>(".footer-links-columns");
    expect(columns).toHaveLength(1);
    expect(columns[0].closest("details")).toBeNull();
    expect(within(columns[0]).getAllByRole("link")).toHaveLength(campuses.length);
  });
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm test components/footer/SiteFooter.test.tsx`
Expected: FAIL, because nothing has the class yet.

- [ ] **Step 4: Mark the campus list**

In `components/footer/SiteFooter.tsx`:

1. Add `import { cx } from "@/lib/cx";`.
2. Change the group type to:

```tsx
type LinkGroup = {
  title: string;
  links: readonly FooterLink[];
  /** Two columns from the desktop step (decision 17). */
  columns?: boolean;
};
```

3. Give the campuses group `columns: true`:

```tsx
    {
      title: "Campuses",
      columns: true,
      links: campuses.map((campus) => ({ href: `/c/${campus.slug}`, label: campus.name })),
    },
```

4. In the larger-screen block, pass it on: `<FooterLinks links={group.links} columns={group.columns} />`. The accordion's `<FooterLinks links={group.links} />` stays as it is.
5. Replace `FooterLinks` with:

```tsx
function FooterLinks({ links, columns = false }: { links: readonly FooterLink[]; columns?: boolean }) {
  return (
    <ul className={cx("footer-links", columns && "footer-links-columns")}>
      {links.map((link) => (
        <li key={`${link.href}-${link.label}`}>
          <Link href={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm test components/footer`
Expected: PASS.

- [ ] **Step 6: Change the desktop footer CSS in place**

In `app/globals.css`, in the footer block's `@media (min-width: 64rem) and (min-height: 30rem)` rule:
- change `.footer-grid`'s `grid-template-columns` from `1.6fr repeat(3, minmax(0, 1fr)) 1.3fr` to `1.35fr repeat(3, minmax(0, 0.8fr)) 1.45fr`;
- add these rules inside the same media query:

```css
    /* Two columns of campuses, as in the mockup (decision 17). Columns need a block list, not the grid the other
       lists use, so each row keeps its 8px gap with a margin instead. */
    .footer-links-columns {
      display: block;
      columns: 2;
      column-gap: 20px;
    }

    .footer-links-columns li {
      margin-bottom: 8px;
      break-inside: avoid;
    }

    /* The narrower sign-up column: the email field above its button. The field keeps its 44px height, which a
       column flex item with flex: 1 would otherwise lose. */
    .footer-signup-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .footer-signup-row .footer-input {
      flex: none;
      width: 100%;
    }
```

- [ ] **Step 7: Check and measure again**

Run, one at a time:
1. `pnpm lint`
2. `pnpm build`
3. `pnpm e2e tests/e2e/shell.spec.ts tests/e2e/responsive.spec.ts tests/e2e/a11y.spec.ts`. The footer tests include the wordmark fit and the arrow edges.

Measure the footer at 1280 × 800 again, and report both heights. Look at it at 1024, 1280 and 1440:
- the email field sits above "Get updates";
- the campuses read down the first column, then the second;
- report any labels that wrap. At 1024 a few wrapped before this change, such as "Browse everything" and "Cape Town Tyger Valley".

- [ ] **Step 8: Commit**

Files: `components/footer/SiteFooter.tsx components/footer/SiteFooter.test.tsx app/globals.css`
Message: `feat: set the footer's campuses in two columns on desktop`

---

### Task 24: Homepage end-to-end tests

Spec 15 lists behaviours to prove in a real browser. This task covers them for the homepage at all five sizes:
- the hero's autoplay and pause rules;
- the carousel buttons and keyboard;
- choosing a campus;
- Just listed's switch and empty state;
- saving;
- the context strip.

It also adds axe runs for a chosen campus, a returning visitor and a listing page.

The tests use Playwright's clock for autoplay and cookies for the campus. Nothing here changes app code. If a test fails because the app is wrong, stop and report it rather than loosening the test.

**Files:**
- Create: `tests/e2e/home.spec.ts`
- Modify: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Write `tests/e2e/home.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

/** Cards Just listed shows at each size (plan decision 11). */
const VISIBLE_CARDS: Record<string, number> = {
  "phone-360": 4,
  "phone-390": 4,
  "tablet-768": 9,
  "laptop-1024": 10,
  "desktop-1440": 10,
};

test("the homepage has one H1 and the sections in the approved order", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  // Text content, so the screen-reader-only headings count too.
  expect(await page.locator("main h2").allTextContents()).toEqual([
    "Why you can trust Vossie",
    "Shop by category",
    "Collections from the Incubation Hub",
    "Shop by campus",
    "New on all campuses",
    "Safe, simple, on campus",
    "Hustles on every campus",
    "Can’t find it? Ask for it.",
    "Pass it on",
    "Built for student hustles, backed by the Hub",
  ]);
});

test.describe("hero (spec 7.3)", () => {
  test("turns every seven seconds, and Pause stops it", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.clock.install();
    await page.goto("/");
    // "Pause slides" only appears once the page has hydrated and autoplay is allowed.
    const pause = page.getByRole("button", { name: "Pause slides" });
    await expect(pause).toBeVisible();
    const word = page.locator(".hero-word[data-active]");
    await expect(word).toHaveText("textbooks");
    await page.clock.runFor(7_000);
    await expect(word).toHaveText("tech");
    await pause.click();
    await page.clock.runFor(21_000);
    await expect(word).toHaveText("tech");
  });

  test("never turns by itself with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await page.goto("/");
    await page.clock.runFor(21_000);
    await expect(page.locator(".hero-word[data-active]")).toHaveText("textbooks");
    await expect(page.getByRole("button", { name: "Play slides" })).toBeVisible();
  });

  test("a thumbnail shows its slide", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await page.getByRole("button", { name: "Show slide 3 of 3: services" }).click();
    await expect(page.getByRole("link", { name: "Shop services" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play slides" })).toBeVisible();
  });

  // Part 1 handoff, "Scroll after navigation": a client navigation that starts near the top could leave the new
  // page's top under the sticky header.
  test("a hero link opens its page with the heading clear of the header", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 80));
    await page.getByRole("link", { name: "Shop textbooks" }).click();
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Textbooks & notes");
    const headingBox = await heading.boundingBox();
    const barBox = await page.locator(".hdr-bar").boundingBox();
    expect(headingBox!.y).toBeGreaterThanOrEqual(barBox!.y + barBox!.height);
  });
});

test.describe("data saver (plan decision 8)", () => {
  async function scrollToTheEnd(page: Page) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState("networkidle");
  }

  test("loads only the hero photo on show, and no Hub banner photo", async ({ page }) => {
    onlyAt("phone-390");
    await page.addInitScript(() => localStorage.setItem("vossie_low_data", "1"));
    const requested: string[] = [];
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator(".hero-photo img")).toHaveCount(1);
    await scrollToTheEnd(page);
    expect(requested).not.toContain("/placeholders/hub/banner.svg");
  });

  test("without it, the Hub banner photo loads as it comes near", async ({ page }) => {
    onlyAt("phone-390");
    const requested: string[] = [];
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    await page.goto("/", { waitUntil: "networkidle" });
    await scrollToTheEnd(page);
    expect(requested).toContain("/placeholders/hub/banner.svg");
  });
});

test.describe("carousels (spec 7.5 and section 10)", () => {
  test("the arrows page through the categories on desktop", async ({ page }) => {
    onlyAt("laptop-1024", "desktop-1440");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const row = page.getByRole("region", { name: "Categories" });
    const previous = row.getByRole("button", { name: "Previous categories" });
    await expect(previous).toHaveAttribute("aria-disabled", "true");
    await row.getByRole("button", { name: "Next categories" }).click();
    await expect.poll(() => row.locator(".carousel-track").evaluate((track) => track.scrollLeft)).toBeGreaterThan(0);
    await expect(previous).toHaveAttribute("aria-disabled", "false");
  });

  test("the keyboard reaches every tile, and the row follows focus", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    const row = page.getByRole("region", { name: "Categories" });
    await row.getByRole("link", { name: "Textbooks & notes" }).focus();
    for (let i = 0; i < 9; i++) await page.keyboard.press("Tab");
    const last = row.getByRole("link", { name: "Stationery" });
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
  });

  // Spec section 5. The browser does this for a scrolling row: no script is involved.
  test("arrow keys scroll the row while a tile has focus", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const row = page.getByRole("region", { name: "Categories" });
    await row.getByRole("link", { name: "Textbooks & notes" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => row.locator(".carousel-track").evaluate((track) => track.scrollLeft)).toBeGreaterThan(0);
  });
});

test.describe("choosing a campus (spec 7.7 and 7.8)", () => {
  test("Shop by campus applies the choice and moves focus to Just listed", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("region", { name: "Shop by campus" })
      .getByRole("button", { name: "Midrand, 214 live listings" })
      .click();
    const heading = page.locator("#just-listed-title");
    await expect(heading).toHaveText("New at Midrand");
    await expect(heading).toBeFocused();
    await expect(page.getByText("Showing Midrand first")).toBeVisible();
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === "vossie_campus")?.value).toBe("midrand");
  });

  test("an empty campus offers every campus, and the switch flips the grid", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
    await page.goto("/");
    const section = page.locator("#just-listed");
    const heading = section.getByRole("heading", { level: 2 });
    await expect(heading).toHaveText("New at Mbombela");
    await expect(section.getByText("Nothing new at Mbombela yet")).toBeVisible();

    await section.getByRole("button", { name: "Show all campuses" }).click();
    await expect(heading).toHaveText("New on all campuses");
    await expect(section.getByRole("button", { name: "All campuses", pressed: true })).toBeVisible();
    await expect(section.getByRole("article")).toHaveCount(VISIBLE_CARDS[project()]);

    await section.getByRole("button", { name: "Mbombela", pressed: false }).click();
    await expect(heading).toHaveText("New at Mbombela");
  });
});

test("a heart saves on this device, and the header counts it (spec 7.8)", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/");
  const heart = page.locator("#just-listed").getByRole("button", { name: /^Save / }).first();
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await expect(page.locator('.site-header a[aria-label="Saved, 1 item"]').first()).toBeAttached();
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Removed from saved")).toBeVisible();
});

test.describe("the strip under the hero (spec 7.4)", () => {
  test("a first visit sees the trust strip", async ({ page }) => {
    await page.goto("/");
    const strip = page.getByRole("region", { name: "Why you can trust Vossie" });
    await expect(strip.getByRole("link", { name: "How trust works" })).toBeVisible();
  });

  test("a returning visitor picks up where they left off", async ({ page }) => {
    await page.goto("/listings/l-001");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("vossie_recently_viewed"))).not.toBeNull();
    await page.goto("/");
    const strip = page.getByRole("region", { name: "Pick up where you left off" });
    await expect(strip.getByRole("link", { name: "Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "href",
      "/listings/l-001",
    );
  });
});
```

- [ ] **Step 2: Add the axe runs**

Append to `tests/e2e/a11y.spec.ts`:

```ts
test("the homepage with a campus that has nothing new", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
  await page.goto("/");
  await expect(page.getByText("Nothing new at Mbombela yet")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the homepage for a returning visitor", async ({ page }) => {
  await page.goto("/listings/l-001");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("vossie_recently_viewed"))).not.toBeNull();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Pick up where you left off" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a listing page", async ({ page }) => {
  await page.goto("/listings/l-001");
  expect(await seriousIssues(page)).toEqual([]);
});
```

- [ ] **Step 3: Run them**

Run: `pnpm e2e tests/e2e/home.spec.ts tests/e2e/a11y.spec.ts`
Expected: PASS on all five projects, with skips where a test names its sizes.

If something fails:
- **The arrow-key test:** stop and report. Making arrow keys scroll the row by script would cost JavaScript, which is Lama's call.
- **The hero link test:** this is the scroll issue Part 1 accepted. Stop and report with the two boxes' positions; the fix (`scroll-padding-top` on `html`, which Next reads) changes how the whole site scrolls, so it's Lama's call.
- **The app is wrong:** fix the app in the task the code belongs to, then commit it separately.
- **The test is wrong** (a selector, or a size it can't apply to): fix the test.
- **Unsure:** stop and report.

- [ ] **Step 4: Run the whole suite**

Run: `pnpm e2e`
Report pass, skip and fail counts per project.

- [ ] **Step 5: Commit**

Files: `tests/e2e/home.spec.ts tests/e2e/a11y.spec.ts`
Message: `test: prove the homepage's behaviour end to end at five sizes`

---

### Task 25: Layout shift, the budgets and Lighthouse (JS ledger)

Spec 11 asks for:
- 150 KB of JavaScript;
- 60 KB of fonts;
- 350 KB for the first visit;
- a CLS of 0.05 or less;
- Lighthouse mobile scores of Performance 90+ and Accessibility 95+.

This task proves each one. Lighthouse needs Lama's approval to download it into pnpm's cache for the run; nothing is added to `package.json`.

**Stop rule.** If CLS is over 0.05, or Lighthouse is under target, stop after this task and report:
- the numbers;
- the shifting elements (the CLS test logs them);
- the failing audits.

Don't redesign a section to fit; that's Lama's call.

If the shifts come from the display font swapping in, report the two options from Part 1's handoff ("Display-font layout shift"):
- `display: "optional"` for the display face;
- keeping `swap`, until the Eduvos fonts arrive through `next/font/local`, which computes fallback metrics itself.

**Files:**
- Create: `tests/e2e/cls.spec.ts`

- [ ] **Step 1: Write `tests/e2e/cls.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

type Shift = { value: number; nodes: string[] };

test("the homepage holds still while fonts and sections arrive (CLS 0.05 or less, spec 11)", async ({ page }) => {
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

  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Two frames, so a last shift is recorded.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const shifts = await page.evaluate(() => (window as unknown as { __shifts: Shift[] }).__shifts);
  // The sum of every shift: never less than CLS, which only counts the worst burst, so this is the stricter check.
  const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
  console.log(`Homepage layout shift: ${total.toFixed(4)} ${JSON.stringify(shifts)}`);
  expect(total, "cumulative layout shift").toBeLessThanOrEqual(0.05);
});
```

- [ ] **Step 2: Run it**

Run: `pnpm e2e tests/e2e/cls.spec.ts`
Expected: PASS at 390 and 1440. Report the logged totals. If it fails, the log names the elements that moved; stop and report (the stop rule).

- [ ] **Step 3: Measure the budgets**

Run: `pnpm e2e tests/e2e/performance.spec.ts`
Expected: PASS. Report the logged line (`script`, `scriptBrotli`, `font` and `total`) as the final JS ledger entry.

- [ ] **Step 4: Run Lighthouse (needs Lama's approval)**

1. Run `pnpm build`.
2. In the background, run `pnpm start --port 3201`.
3. Run this three times, numbering the output file each time:

```bash
CHROME_PATH="$(node -e "console.log(require('@playwright/test').chromium.executablePath())")" pnpm dlx lighthouse@12 http://localhost:3201/ --only-categories=performance,accessibility --form-factor=mobile --chrome-flags="--headless=new" --output=json --output-path=<your scratchpad>/lighthouse-1.json --quiet
```

4. Read the scores and the key metrics from each file:

```bash
node -e "const r=require(process.argv[1]); const a=r.audits; console.log(JSON.stringify({performance:r.categories.performance.score, accessibility:r.categories.accessibility.score, lcp:a['largest-contentful-paint'].displayValue, cls:a['cumulative-layout-shift'].displayValue, tbt:a['total-blocking-time'].displayValue}))" <your scratchpad>/lighthouse-1.json
```

5. Stop the server.

Report all three runs and the median.

**Targets:** Performance 0.90 or more, and Accessibility 0.95 or more.

**If a score is short:**
- list the failing audits: in each file, `categories.<name>.auditRefs` joined with `audits`, where the score is under 1;
- stop and report (the stop rule).

- [ ] **Step 5: Commit**

Files: `tests/e2e/cls.spec.ts`
Message: `test: hold the homepage's layout shift under 0.05 while fonts and sections arrive`

---

### Task 26: Final checks, review screenshots and the progress log

This task closes Part 2:
- the full suite;
- review screenshots for Lama, set against the mockup;
- the decision and spec records brought up to date;
- the progress log.

**Files:**
- Modify: `tests/e2e/screenshots.spec.ts`
- Modify: `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/superpowers/specs/2026-10-08-homepage-design.md`, `CLAUDE.md`
- Create (generated): `docs/progress/part-2/*.png`

- [ ] **Step 1: Run every check**

Run, one at a time:
1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`
5. `pnpm e2e`

Record:
- the unit test count;
- the end-to-end pass, skip and fail counts per project;
- the route table's symbol for `/` (◐).

Nothing may fail. If something does, stop and report.

- [ ] **Step 2: Add the homepage review screenshots**

Append to `tests/e2e/screenshots.spec.ts`:

```ts
test("homepage review screenshots", async ({ page, context, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/part-2/${project}-${name}.png`;

  /** Scroll the whole page so every lazy photo loads, then come back to the top for a full-page shot. */
  async function wholePage(name: string) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.scrollTo(0, 0);
      await document.fonts.ready;
    });
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".site-header")).toHaveAttribute("data-mode", "expanded");
    await page.screenshot({ path: file(name), fullPage: true });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.screenshot({ path: file("01-first-screen") });
  await wholePage("02-whole-page");

  await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
  await page.goto("/");
  await wholePage("03-whole-page-midrand");
});
```

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "homepage review screenshots"`

The `-g` filter leaves Part 1's screenshots in `docs/progress/part-1/` as they are; they record the shell as it was signed off.

Check that `docs/progress/part-2/` holds six PNGs (three at 390 and three at 1440), each different by md5. Then run `git status --short`: only the new folder and the spec file should show.

- [ ] **Step 3: Compare with the mockup**

Open each screenshot with the Read tool beside `docs/reference/mockups/home-v2.html`, section by section. List every visible difference in the report.

A difference that the plan explains doesn't count:
- placeholder art;
- 44px targets;
- the idle grey;
- navy eyebrows on panels;
- the hero word on its own line.

Fix only plain mistakes, such as a wrong gap, colour or order. Fix them in the section's CSS and commit separately as `fix: …`. Bring everything else to Lama.

- [ ] **Step 4: Bring the records up to date**

**`docs/reference/LANDING-DECISIONS.md`.** Add a row for each plan decision Lama approved at plan review, continuing the numbering from 20. Use the plan's wording and "Lama, on Claude's recommendation", as earlier rows do. At least:
- the idle text colour (plan decision 14);
- the Shop by campus pause (15);
- the CSS-only scroll reveals (16);
- the phone hero's reading order (17);
- the 44px targets (18);
- the chosen card's tick (19).

**The spec, `docs/superpowers/specs/2026-10-08-homepage-design.md`:**
- in section 4's colour table, add an `idle-text` row: `#7E879A`, "Inactive large display text (campus names, collection titles); 3.6:1 on white". Change the `idle` row's use to "Decorative only (the sheet handle)". Change the idle contrast rule to name `idle-text`;
- in section 9, after the photos line, add: "No fade-in: it would need JavaScript on every image (Part 2 plan decision 8)."

**`CLAUDE.md`.** In the Brand line, after `idle #B9C0CC`, add `, idle-text #7E879A (inactive large text)`.

- [ ] **Step 5: Write the progress log**

Add a section to `docs/PROGRESS.md` above "## Next", in the style of the existing entries:

```markdown
## 2026-10-<day>: Part 2 built (the homepage sections)
- Every homepage section from spec 7.3 to 7.13 on sample data:
  - hero slider;
  - context strip;
  - Shop by category and budget;
  - collections;
  - Shop by campus;
  - Just listed;
  - How it works;
  - Featured today;
  - Looking For;
  - Free & swaps;
  - Hub banner and What's on.
- Placeholder pages for listings, sellers and collections, so every card goes somewhere. Labelled placeholder art at the final ratios (spec 12).
- Campus-aware parts stream in behind skeletons; everything else is prerendered. Choosing a campus anywhere re-renders them.
- Checks:
  - lint and types are clean;
  - <n> unit tests pass;
  - end to end, <pass> pass, <skip> are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px;
  - axe finds no serious or critical issues.
- First visit at 390px:
  - JS <scriptBrotli> B brotli, against 153,600;
  - fonts <font> B;
  - in total <total> B.
- Layout shift <cls> at 390 and <cls> at 1440. Lighthouse mobile (median of three): Performance <p>, Accessibility <a>.
- Review screenshots: `docs/progress/part-2/`.
```

Fill in every `<…>` from Steps 1 and 2 and Task 25.

Then replace the "## Next" section's bullet with what comes next: Lama's review of the screenshots, then the next stage of pages.

Under "## Waiting on", the photos stay. Note that each one is now a file drop plus one line in a fixture.

- [ ] **Step 6: Commit**

Files: `tests/e2e/screenshots.spec.ts docs/progress/part-2 docs/PROGRESS.md docs/reference/LANDING-DECISIONS.md docs/superpowers/specs/2026-10-08-homepage-design.md CLAUDE.md`
Message: `docs: Part 2 review screenshots, decisions and progress log`

- [ ] **Step 7: Report to Lama**

Report:
1. **Checks:** the results from Step 1.
2. **JS ledger:** every task's `scriptBrotli`, from Task 11 to Task 25.
3. **CLS and Lighthouse:** the figures, plus anything short of target.
4. **The mockup:** the differences from Step 3, and what you fixed.
5. **Decisions:** the decisions still to confirm, plus Part 1's open question on whether data saver should also stop link prefetching.
6. **Screenshots:** the paths.
