# Vossie Shopping Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the seller storefront (`/sellers/[slug]`), Saved (`/saved`) and collection pages (`/collections/[slug]`) on sample data, as the spec `docs/superpowers/specs/2026-10-13-shopping-pages-design.md` describes, tested at five screen sizes and within the JS budget.

**Architecture:**
- **Saved moves to a cookie.** `lib/saved.ts` keeps its exports but reads and writes a first-party `vossie_saved` cookie instead of local storage, so the server can build the Saved page from the same ids (`lib/data/saved.ts`). The Saved page's hearts are told they start pressed.
- **Server first.** Every new component is a Server Component. The only client code these pages use already exists: the Save hearts, and Share on the storefront. Storefronts and collections are prerendered; Saved's list renders per request inside `<Suspense>`.
- **Data only through `lib/data`.** Sellers gain `about`, `since`, `badge` and `categorySlug`; collections gain an `intro` and a `rule` (categories and an optional price cap). New cached functions: `getSellerListings`, `getCollection`, `getCollectionListings`, `getListingsByIds`. The rule matching is a plain function in `lib/collections.ts`, so Supabase later replaces only the data source.
- **One shared grid.** `ListingGrid` (`"five"` or `"four"` columns) serves Saved, collections, storefronts and the listing page's More from. Browse keeps its own.

**Tech Stack:** As the browse and listing stage left it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5 with Testing Library and jsdom 30;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-13-shopping-pages-design.md`. "Spec 5.3" in this plan means that spec's section 5.3.
- **Earlier specs** (tokens, breakpoints, motion, accessibility, budgets; cards and the data layer): `docs/superpowers/specs/2026-10-08-homepage-design.md` and `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md`.
- **Decisions:** `docs/reference/LANDING-DECISIONS.md` (rows 48 to 51 are this stage's).
- **Previous plan, for conventions and pitfalls:** `docs/superpowers/plans/2026-10-13-browse-and-listing-pages.md`, especially its "Changes made during the build".

---

## Before you start

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. `.claude/launch.json` has a change made outside this work: never stage it.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed. This is Lama's standing preference.
3. **Files this plan removes or moves:** none. Task 4 deletes two `.listing-more-grid` rule blocks from `app/globals.css` (an edit, not a file).

No installs are needed.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time. Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` anything: this plan removes no files.
- Never kill an install or build that is still running.
- Port 3100 is Lama's dev server. Don't touch it. The e2e tests use 3200; the "looking at it" checks use 3201.

## Where the browse and listing stage left things (checked on 2026-10-13)

| Area | Fact |
|---|---|
| Repo | `main`, at `c056296` (the shopping spec). `.claude/launch.json` is modified by something outside this work |
| Tests | 455 unit tests. End to end: 366 pass and 229 are skipped by design |
| JS | First visit at 390px, brotli quality 5: `/` 150,937 B, `/browse` 151,607 B, `/listings/l-001` 152,078 B (accepted, decision 46). Limit 153,600 B |
| `/sellers/[slug]`, `/collections/[slug]`, `/saved` | `ComingSoon` placeholders. The two dynamic routes are prerendered from `generateStaticParams`, await `params` inside `<Suspense>` and 404 unknown slugs. `tests/e2e/routes.spec.ts` lists all three as placeholders |
| Saved | `lib/saved.ts` keeps a JSON array in local storage (`vossie_saved`). `useIsSaved` and `useSavedCount` read it through `useSyncExternalStore`; the server value is "not saved" and 0. The header's `SavedLink` puts the store in every page's shell |
| Sellers | 29 in `data/fixtures/sellers.ts`. No about, start month, badge or category slug. Trust badges live on listings only, and 7 listings disagree with the rest of their seller's |
| Collections | 4 in `data/fixtures/collections.ts`: slug, eyebrow, title and photo (960 × 1200, so 4:5) |
| Fixtures | `scripts/make-placeholders.ts` runs the fixture files in plain Node (`node scripts/make-placeholders.ts`). A fixture may only `import type`; a runtime import would break the script |
| More from | `MoreFrom` uses `.listing-more-grid`: 2 across, then 4 on desktop (2 on tablets) |
| `ShareButton` | Always `icon-btn listing-share` (a navy outline) |
| Hidden pages | Next keeps the last 3 pages hidden in the DOM for Back (React's `<Activity>`), with an inline `display: none` on their top element. CSS locators in e2e tests still count them; `getByRole` doesn't |
| Status roles | The footer sign-up and the toast region both have `role="status"`. Pick the one you mean by its text |
| `og:image` | While `metadataBase` is unset, the client adds a second `og:image` after hydration. Read `.first()`, the server's |
| `max=` links | Browse reads `?max=50`, `100`, `250` and `500` as its price caps (`lib/browse/query.ts`) |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. In this plan, "plan decision N" means this list; "decision N" on its own means a row in the decisions log.

1. **Saved's count streams with the list.** The device note sits under the h1 and is prerendered; the count line ("3 saved") streams in with the list, just above the cards. Spec 5.2 put the count before the note, but the count needs the cookie, and spec 3 keeps the note prerendered. With nothing saved there's no count line: the empty state says it.
2. **One helper for both preference cookies.** `lib/cookies.ts` (`preferenceCookie`, `readCookie`) builds and reads the campus and saved cookies. The saved store is in every page's shell and the listing page has 100 B of room, so sharing code keeps the bytes down.
3. **Fixtures stay free of runtime imports** (see the facts table). Sellers keep their `category` name beside the new `categorySlug`, filled from a small map in `sellers.ts`, and a fixture test checks the map against `categories.ts`.
4. **Seller badges, with seven listings changed to match** (spec 6.1). Each seller's badge is the one most of their listings already show:

   | Listing | Seller | Badge before | Badge after |
   |---|---|---|---|
   | l-002 | book-swap | New seller | Trusted |
   | fs-001 | book-swap | none | Trusted |
   | l-006 | res-deals | none | Trusted |
   | fs-003 | res-deals | none | Trusted |
   | fs-002 | res-essentials | none | Responsive |
   | l-021 | weekend-market | none | New seller |
   | fs-006 | weekend-market | none | New seller |

   Just listed shows these badges on the homepage; Free & swaps shows none. Five sellers have no badge: ticket-desk, stationery-stop, moving-out-sale, study-desk and logo-lab.
5. **A storefront with nothing listed** is headed "Listings", not "0 listings". Its link reads "More in {category}", like a collection's browse links.
6. **The card tags** ("Sold", "Not taking orders", "Removed") sit together at the top left of the photo, under the card's link layer, so a tap still opens the listing. In reading order they come after the badge. The Removed tag is only in Saved's cards, is `aria-hidden` (the heart's pressed state already says it), and CSS shows it.
7. **The collection header goes side by side from the tablet step,** not only on desktop: photo on the left (two-fifths, 4:5), text on the right. Phones keep the photo on top, edge to edge at 4:3; landscape phones crop it to 2:1 so it doesn't fill the screen. Spec 7.2 named phones and desktop only.
8. **Data saver:** the collection's header photo stays, as a listing's cover does. More from the Hub's thumbnails hide, like the homepage's collection rows. The storefront's photo stays (spec 9).
9. **The storefront band sits on the page column's edge,** like the homepage's panels: 10px from the screen on phones, 24px from the tablet step.
10. **"More in browse" links name no campus,** as spec 7.2's example does, so they open on the viewer's campus like every other category link. Decision 47 made Free & swaps' "See all" open every campus; if Lama wants the same here, the links gain `&campus=all`.
11. **Message on a storefront** goes to the sign-in page, whose back link reads "Go back" (it names only listings). The sign-in page doesn't change.
12. **The grid's class is `card-grid`,** with `data-columns`. `listing-grid` is taken by Just listed, which hides cards past a count. More from moves onto it, and `.listing-more-grid` goes.
13. **`getListingsByIds` caches per list of ids,** as `searchListings` caches free text: fine for sample data, revisit with Supabase.
14. **Sample wording:** the sellers' about texts and start months, and the collection intros, are for Lama and the Hub to change.
15. **The storefront's and collection's photos load eagerly** (`priority`): each is the first image on its page.
16. **Saved's "Try again"** is a plain `<a href="/saved">`, a full page load, as browse's is.
17. **The trust badge on the storefront band is a white pill with navy text.** Spec 4.1 asked for the listing page's style, but that pill is navy and would vanish on the navy band. The shape, size and lettering are the same.

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec 10):** if any page passes **152,178 B** (the listing page's accepted 152,078 B plus 100 B), stop after that task and report. Don't cut features to fit; that's Lama's decision.
- **Where bytes move:**
  - Task 1 changes the saved store, which is in every page's shell (the header's count). Every page moves by the same amount, up or down.
  - Task 4 adds the hearts' `savedOnServer` prop and Share's `className`: a few bytes on every page with cards or Share.
  - The storefront adds Share (already written); Saved and collections add nothing beyond the shell and the hearts.
- **Recording.** `tests/e2e/performance.spec.ts` prints each page's `scriptBrotli`. Tasks 1, 6, 7 and 9 run it at 390px and record the figures in their commit messages; Tasks 6, 7 and 9 add their page to it first.

**As built** (fill in during the build):

| Point | `/` | `/browse` | Listing | Storefront | Saved | Collection |
|---|---|---|---|---|---|---|
| Start | 150,937 B | 151,607 B | 152,078 B | | | |
| Task 1, the cookie store | | | | | | |
| Task 6, storefront | | | | | | |
| Task 7, Saved | | | | | | |
| Task 9, collections | | | | | | |
| **Final** | | | | | | |

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there.
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, and comments in plain English. There's no formatter: match the file you're in.
- **Server or client.** Server Components unless a file starts with `"use client"`. Plain `lib/` modules have no directive. This plan adds no client components.
- **Next APIs.** Before using a Next API this plan names, read its page in `node_modules/next/dist/docs/` (AGENTS.md). This plan uses `cookies()`, `generateMetadata`, `generateStaticParams`, `generateImageMetadata` and `ImageResponse`, each already used in the repo.
- **Breakpoints.**
  - `wide:` is tablet and up; `desk:` is desktop. Never use `md:`, `lg:` or `sm:`.
  - In CSS, write `@media (min-width: 48rem) and (min-height: 30rem)` and `@media (min-width: 64rem) and (min-height: 30rem)`. Landscape phones are `@media (orientation: landscape) and (max-height: 29.99rem)`.
- **Page padding.** `.page` and the page's own class (`.seller-page`, `.saved-page`, `.collection-page`) sit on one element, so the page class's padding *replaces* `.page`'s gutter. Write the whole content edge: 16px on phones, 40px from the tablet step. Browse and the listing page hit this twice.
- **Effects.** Never call `setState` directly in an effect body, and only touch `ref.current` in effects and handlers.
- **Headings.** One H1 per page. Sections are `<section aria-labelledby="…">` with one H2, visible or `sr-only`. Cards use H3.
- **Request-time parts.** A component that reads cookies or `searchParams` sits inside `<Suspense>`. Data loads use `.catch(() => null)` and show an error state on `null`. There's no `try`/`catch` round JSX: the React Compiler lint rejects it. Choose between states with `if`/`else` into a `ReactNode` variable rather than nested ternaries.
- **Async components in tests.** jsdom can't render an async component inside a tree. Render `await Thing(props)` directly, or stand the async part in with `vi.mock` when it sits inside a sync frame.
- **Server values in tests.** A heart's server value only shows in server rendering: check it with `renderToString` from `react-dom/server`. A client `render` uses the browser value.
- **Accessible names.** Name computation trims each element's own text, so put spaces outside `sr-only` spans. Chromium adds spaces between flex children. Icons from `components/icons.tsx` are `aria-hidden`.
- **Contrast.**
  - Sky never carries text, icons or thin borders on white. Links on white are sky-dark; on panel, pale and sky they're navy.
  - Small text on the star texture is white. Sky there is for large text, icons, and solid pills with navy text.
- **Motion.** Animate only `transform`/`opacity`, including the CSS `translate`, `scale` and `rotate` properties. Hover effects only under `(hover: hover) and (pointer: fine)`. This plan adds no animation.
- **Images.** Use `Photo` and always pass `sizes`. Decorative images get `alt=""`; content images take their alt from the data.
- **Tap targets.** At least 44 × 44px, with 8px between targets.
- **Lint.** `@next/next/no-html-link-for-pages` only checks literal hrefs, so a plain `<a href="/saved">` needs `{/* eslint-disable-next-line @next/next/no-html-link-for-pages -- <reason> */}` on the line above it, and a computed href needs nothing. Don't add a disable comment that isn't needed: lint reports unused ones.
- **CSS placement.**
  - New CSS goes at the end of `app/globals.css`, inside `@layer components`, under a banner: `/* --- Shopping: <name> (shopping plan, Task N, spec x.y) --- */`.
  - Never put `!important` on a transition or animation property: the motion off-switches rely on it.
- **Hidden pages in CSS and tests.**
  - A `body:has(…)` rule must name a visible page (`.seller-page:not([style*="display"])`), because `:has()` still sees the hidden ones. This plan's `:has()` rules are scoped inside a card, so they're safe.
  - In e2e tests, after a client-side navigation, count cards with `.filter({ visible: true })`.
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git status --short` on its own, and checks that only the listed files changed (and `.claude/launch.json`, which is never staged);
  2. runs `git add` with the listed files;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.
- **Looking at it.** Check visually on a production build (`pnpm build`, then `pnpm start --port 3201`) at 390 × 844, 768 × 1024 and 1280 × 800, using a throwaway Playwright script in your scratchpad. Stop the server afterwards (it's yours, not an install or build).
- **Measuring JS.** `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` builds, starts its own server on 3200, and prints one line per page, such as `storefront: {"script":…,"scriptBrotli":…}`. Record `scriptBrotli`.

## File map (end of this plan)

New files are marked **+**, changed **~**.

```
app/
  sellers/[slug]/page.tsx                 ~ the storefront (Task 6)
  sellers/[slug]/opengraph-image.tsx      + the seller's share card (Task 6)
  saved/page.tsx                          ~ Saved (Task 7)
  collections/[slug]/page.tsx             ~ the collection page (Task 9)
  globals.css                             ~ shopping banners (Tasks 4, 5, 7, 8)
components/
  listings/ListingGrid.tsx                + (Task 4)
  listings/ListingCard.tsx  SaveHeart.tsx ~ tags, `saved`, `savedOnServer` (Tasks 1, 4)
  listing/ShareButton.tsx  MoreFrom.tsx   ~ `className`, ListingGrid (Task 4)
  seller/SellerHero.tsx  SellerListings.tsx  SellerView.tsx      + (Task 5)
  saved/SavedList.tsx  SavedSkeleton.tsx                         + (Task 7)
  collection/CollectionHeader.tsx  CollectionBrowseLinks.tsx  MoreFromHub.tsx  CollectionView.tsx   + (Task 8)
hooks/useIsSaved.ts                       ~ server value (Task 1)
lib/
  cookies.ts                              + (Task 1)
  campus.ts  saved.ts                     ~ (Task 1)
  types.ts  format.ts                     ~ (Task 2)
  collections.ts                          + (Task 2)
  data/index.ts                           ~ (Task 3)
  data/saved.ts                           + (Task 3)
data/fixtures/
  sellers.ts  collections.ts  listings.ts ~ (Task 2)
tests/helpers/dom.ts  fakes.ts            ~ `blockCookies`, `makeSeller` (Tasks 1, 2)
vitest.setup.ts                           ~ (Task 1)
tests/e2e/
  shopping.spec.ts                        + (Task 10)
  routes.spec.ts                          ~ (Tasks 6, 7, 9)
  performance.spec.ts                     ~ (Tasks 6, 7, 9)
  a11y.spec.ts  cls.spec.ts               ~ (Task 11)
  screenshots.spec.ts                     ~ (Task 12)
docs/PROGRESS.md  docs/progress/shopping/  docs/reference/GO-LIVE.md  CLAUDE.md   ~/+ (Task 12)
```

Each `*.test.ts(x)` sits next to the file it tests.

---

### Task 1: The saved cookie store

Saves move from local storage to the `vossie_saved` cookie (spec 5.1). The store keeps its exports, so the hearts, `useIsSaved` and the header's count don't change. The Save heart learns to start pressed when the page says so (spec 5.3).

**Files:**
- Create: `lib/cookies.ts`, `lib/cookies.test.ts`
- Modify: `lib/campus.ts`
- Modify: `lib/saved.ts`, `lib/saved.test.ts`
- Modify: `hooks/useIsSaved.ts`, `hooks/home-hooks.test.tsx`, `hooks/hooks.test.tsx`
- Modify: `components/listings/SaveHeart.tsx`, `components/listings/SaveHeart.test.tsx`
- Modify: `components/header/SiteHeader.test.tsx`
- Modify: `tests/helpers/dom.ts`, `vitest.setup.ts`

- [ ] **Step 1: Write the cookie helper's test**

Create `lib/cookies.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { preferenceCookie, readCookie } from "./cookies";

describe("preference cookies (shopping spec 5.1)", () => {
  it("builds a one-year Lax cookie for the whole site, adding Secure only on https", () => {
    expect(preferenceCookie("vossie_saved", "l-001", false)).toBe(
      "vossie_saved=l-001; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(preferenceCookie("vossie_saved", "l-001", true)).toMatch(/; Secure$/);
  });

  it("deletes the cookie when the value is empty", () => {
    expect(preferenceCookie("vossie_saved", "", false)).toBe("vossie_saved=; Path=/; Max-Age=0; SameSite=Lax");
  });

  it("reads one cookie's raw value, keeping any = inside it", () => {
    expect(readCookie("theme=dark; vossie_saved=l-001.l-002; other=a=b", "vossie_saved")).toBe("l-001.l-002");
    expect(readCookie("theme=dark; other=a=b", "other")).toBe("a=b");
    expect(readCookie("theme=dark", "vossie_saved")).toBeNull();
    expect(readCookie("", "vossie_saved")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm test lib/cookies.test.ts`
Expected: FAIL, because `./cookies` doesn't exist.

- [ ] **Step 3: Write the helper**

Create `lib/cookies.ts`:

```ts
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * A first-party preference cookie, as the campus choice and the saved list use (shopping spec 5.1): one year, the
 * whole site, Lax, and Secure on https. An empty value deletes the cookie.
 */
export function preferenceCookie(name: string, value: string, secure: boolean): string {
  const parts = [`${name}=${value}`, "Path=/", `Max-Age=${value ? ONE_YEAR_SECONDS : 0}`, "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** One cookie's raw value out of a `document.cookie`-style string, or null when it isn't there. */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}
```

- [ ] **Step 4: Move the campus cookie onto it (plan decision 2)**

In `lib/campus.ts`:

1. Add `import { preferenceCookie, readCookie } from "./cookies";` above the `import type` line.
2. Delete the line `const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;` and the blank line after it.
3. Replace `readCampusCookie` and `campusCookieString` with:

```ts
/** Read the campus cookie out of a `document.cookie`-style string. A malformed value counts as no choice. */
export function readCampusCookie(cookieString: string): string | null {
  const raw = readCookie(cookieString, CAMPUS_COOKIE);
  if (raw === null) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/** A first-party preference cookie: one year, whole site, Lax, Secure on https. */
export function campusCookieString(choice: CampusChoice, secure: boolean): string {
  return preferenceCookie(CAMPUS_COOKIE, encodeURIComponent(choice), secure);
}
```

Run: `pnpm test lib/cookies.test.ts lib/campus.test.ts`
Expected: PASS. The campus tests haven't changed, so they show the move kept the campus cookie exactly as it was.

- [ ] **Step 5: Add a way to block cookies in tests**

Append to `tests/helpers/dom.ts`:

```ts
/**
 * Make cookie writes vanish without a word, as in a browser with cookies blocked. The setup file undoes it after
 * each test.
 */
export function blockCookies(): void {
  Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: () => {} });
}
```

In `vitest.setup.ts`:

1. Add `import { SAVED_COOKIE } from "./lib/saved";` after the `LOW_DATA_ATTR` import (the imports stay in alphabetical order of path).
2. In the `afterEach`, replace the campus cookie's reset line (``document.cookie = `${CAMPUS_COOKIE}=; Path=/; Max-Age=0`;``) with:

```ts
    // Undo blockCookies() (tests/helpers/dom.ts), so the resets below reach the real cookie jar.
    Reflect.deleteProperty(document, "cookie");
    document.cookie = `${CAMPUS_COOKIE}=; Path=/; Max-Age=0`;
    document.cookie = `${SAVED_COOKIE}=; Path=/; Max-Age=0`;
```

Keep `localStorage.clear();`: recently viewed, recent searches and data saver still use it.

`SAVED_COOKIE` doesn't exist until Step 8, so until then tests may fail to load, or the new reset line may do nothing. That's expected; don't run the whole suite until Step 13.

- [ ] **Step 6: Write the store's tests**

Replace `lib/saved.test.ts` with:

```ts
import { describe, expect, it, vi } from "vitest";
import { blockCookies } from "@/tests/helpers/dom";
import {
  getSavedCount,
  isSaved,
  parseSavedIds,
  readSavedIds,
  SAVED_COOKIE,
  SAVED_LIMIT,
  savedCookieString,
  subscribeSaved,
  toggleSaved,
} from "./saved";

/** `count` ids, newest first: l-0 is the newest, the last is the oldest. */
const many = (count: number) => Array.from({ length: count }, (_, n) => `l-${n}`);

describe("reading the saved cookie (shopping spec 5.1)", () => {
  it("splits the ids, newest first", () => {
    expect(parseSavedIds("l-003.l-001.fs-002")).toEqual(["l-003", "l-001", "fs-002"]);
  });

  it("treats a missing or empty cookie as nothing saved", () => {
    expect(parseSavedIds(undefined)).toEqual([]);
    expect(parseSavedIds(null)).toEqual([]);
    expect(parseSavedIds("")).toEqual([]);
  });

  it("drops bad values and repeats", () => {
    expect(parseSavedIds("l-001..L-002.l 3.l-001.%3Cb%3E.l-004")).toEqual(["l-001", "l-004"]);
    expect(parseSavedIds(`${"a".repeat(41)}.${"b".repeat(40)}`)).toEqual(["b".repeat(40)]);
  });

  it("keeps the first 100", () => {
    expect(parseSavedIds(many(120).join("."))).toEqual(many(SAVED_LIMIT));
  });

  it("writes the ids joined with dots, and deletes the cookie when there are none", () => {
    expect(savedCookieString(["l-002", "l-001"], false)).toBe(
      "vossie_saved=l-002.l-001; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(savedCookieString([], false)).toBe("vossie_saved=; Path=/; Max-Age=0; SameSite=Lax");
  });
});

describe("saved items on this device", () => {
  it("starts empty", () => {
    expect(readSavedIds()).toEqual([]);
    expect(getSavedCount()).toBe(0);
  });

  it("toggles an id, newest first, keeps it in the cookie and tells subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    expect(toggleSaved("a")).toBe(true);
    expect(toggleSaved("b")).toBe(true);
    expect(readSavedIds()).toEqual(["b", "a"]);
    expect(document.cookie).toContain(`${SAVED_COOKIE}=b.a`);
    expect(isSaved("a")).toBe(true);
    expect(toggleSaved("a")).toBe(false);
    expect(readSavedIds()).toEqual(["b"]);
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it("drops the oldest when saving past 100", () => {
    document.cookie = savedCookieString(many(SAVED_LIMIT), false);
    expect(toggleSaved("newest")).toBe(true);
    expect(getSavedCount()).toBe(SAVED_LIMIT);
    expect(readSavedIds()[0]).toBe("newest");
    expect(isSaved(`l-${SAVED_LIMIT - 1}`)).toBe(false);
  });

  it("throws when cookies are blocked, telling no one", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    blockCookies();
    expect(() => toggleSaved("a")).toThrow();
    expect(readSavedIds()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("re-checks when the tab comes back into view, for saves made in another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 7: Run them to make sure they fail**

Run: `pnpm test lib/saved.test.ts`
Expected: FAIL, because `SAVED_COOKIE`, `SAVED_LIMIT`, `parseSavedIds` and `savedCookieString` don't exist.

- [ ] **Step 8: Rewrite the store**

Replace `lib/saved.ts` with:

```ts
import { preferenceCookie, readCookie } from "./cookies";

/** The saved list's cookie (shopping spec 5.1): listing ids, newest first, joined with ".". */
export const SAVED_COOKIE = "vossie_saved";
/** The most it keeps; saving another drops the oldest. 100 of Supabase's 36-character ids fit in a cookie's 4 KB. */
export const SAVED_LIMIT = 100;

const SAVED_ID = /^[a-z0-9-]{1,40}$/;

/**
 * The saved ids in the cookie's value, newest first. Bad values and repeats are dropped, and only the first 100 are
 * kept. The server reads the cookie with this too (lib/data/saved.ts), so both agree on what's saved.
 */
export function parseSavedIds(raw: string | null | undefined): string[] {
  const ids: string[] = [];
  for (const id of raw?.split(".") ?? []) {
    if (ids.length < SAVED_LIMIT && SAVED_ID.test(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The cookie that holds `ids`. An empty list deletes it. */
export function savedCookieString(ids: readonly string[], secure: boolean): string {
  return preferenceCookie(SAVED_COOKIE, ids.join("."), secure);
}

// --- Client store over the cookie ----------------------------------------

const listeners = new Set<() => void>();

/** Saved listing ids on this device, newest first. */
export function readSavedIds(): string[] {
  return parseSavedIds(readCookie(document.cookie, SAVED_COOKIE));
}

export function getSavedCount(): number {
  return readSavedIds().length;
}

export function isSaved(id: string): boolean {
  return readSavedIds().includes(id);
}

/**
 * Save or unsave a listing. Returns true when it is now saved.
 * Throws when the cookie didn't take (cookies are blocked), so the caller can show "Couldn't update. Try again."
 */
export function toggleSaved(id: string): boolean {
  const ids = readSavedIds();
  const saving = !ids.includes(id);
  const next = saving ? [id, ...ids].slice(0, SAVED_LIMIT) : ids.filter((saved) => saved !== id);
  document.cookie = savedCookieString(next, window.location.protocol === "https:");
  // A browser with cookies blocked drops the write without a word, so check it took.
  if (readSavedIds().join(".") !== next.join(".")) throw new Error("The saved list couldn't be updated");
  listeners.forEach((listener) => listener());
  return saving;
}

export function subscribeSaved(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab may have saved something: re-check when this tab comes back into view.
  document.addEventListener("visibilitychange", listener);
  return () => {
    listeners.delete(listener);
    document.removeEventListener("visibilitychange", listener);
  };
}
```

Run: `pnpm test lib/saved.test.ts lib/cookies.test.ts lib/campus.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the tests for a heart that starts pressed**

In `components/listings/SaveHeart.test.tsx`:

1. Add `import { renderToString } from "react-dom/server";` after the `@testing-library/user-event` import, and `import { blockCookies } from "@/tests/helpers/dom";` after the `@/lib/toast` import. Remove `vi` from the `vitest` import if nothing else uses it.
2. Replace the test "stays as it was, and says so, when storage is blocked" with:

```tsx
  it("stays as it was, and says so, when cookies are blocked", async () => {
    const user = userEvent.setup();
    blockCookies();
    render(<SaveHeart id="l-001" title="Casio calculator" />);
    const heart = screen.getByRole("button", { name: "Save Casio calculator" });
    await user.click(heart);
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(getToast()?.message).toBe("Couldn't update. Try again.");
  });
```

3. Add at the end of the `describe`:

```tsx
  it("starts pressed on the server when the page says it's saved (the Saved page, shopping spec 5.3)", () => {
    expect(renderToString(<SaveHeart id="l-001" title="Casio calculator" savedOnServer />)).toContain(
      'aria-pressed="true"',
    );
    expect(renderToString(<SaveHeart id="l-001" title="Casio calculator" />)).toContain('aria-pressed="false"');
  });
```

In `hooks/home-hooks.test.tsx`:

1. Replace `import { toggleSaved } from "@/lib/saved";` with `import { savedCookieString, toggleSaved } from "@/lib/saved";`.
2. In "render nothing saved and nothing viewed on the server", replace `localStorage.setItem("vossie_saved", JSON.stringify(["l-001"]));` with `document.cookie = savedCookieString(["l-001"], false);`.
3. Add a component under `ServerValues`:

```tsx
function SavedOnServer() {
  return <output>{String(useIsSaved("l-001", true))}</output>;
}
```

4. Add at the end of the `describe`:

```tsx
  it("renders the server value the page gives, for the Saved page", () => {
    expect(renderToString(<SavedOnServer />)).toContain("true");
  });
```

- [ ] **Step 10: Run them to make sure they fail**

Run: `pnpm test components/listings/SaveHeart.test.tsx hooks/home-hooks.test.tsx`
Expected: FAIL on the two new tests (and a type error for `savedOnServer`), because neither the heart nor the hook takes a server value yet.

- [ ] **Step 11: Give the hook and the heart a server value**

Replace `hooks/useIsSaved.ts` with:

```ts
import { useSyncExternalStore } from "react";
import { isSaved, subscribeSaved } from "@/lib/saved";

/**
 * Whether one listing is saved on this device. A yes-or-no snapshot, so it's safe for useSyncExternalStore.
 * `savedOnServer` is what the server renders: "not saved", except on the Saved page, whose cards are all saved
 * (shopping spec 5.3).
 */
export function useIsSaved(id: string, savedOnServer = false): boolean {
  return useSyncExternalStore(subscribeSaved, () => isSaved(id), () => savedOnServer);
}
```

In `components/listings/SaveHeart.tsx`, replace the doc comment, the signature and the first line of the body with:

```tsx
type SaveHeartProps = {
  id: string;
  title: string;
  className?: string;
  /** What the server shows: pressed on the Saved page (shopping spec 5.3), not pressed everywhere else. */
  savedOnServer?: boolean;
};

/** The Save heart (spec 7.8). Saves stay on this device until sign-in exists, and the toast says so. */
export function SaveHeart({ id, title, className, savedOnServer }: SaveHeartProps) {
  const saved = useIsSaved(id, savedOnServer);
```

and change the comment in the `catch` to `// The cookie didn't take (cookies are blocked). Nothing changed, so there's nothing to roll back.`

Run: `pnpm test components/listings/SaveHeart.test.tsx hooks/home-hooks.test.tsx`
Expected: PASS.

- [ ] **Step 12: Seed the other tests through the cookie**

In `hooks/hooks.test.tsx`:
1. Replace `import { SAVED_KEY, toggleSaved } from "@/lib/saved";` with `import { savedCookieString, toggleSaved } from "@/lib/saved";`.
2. Replace `localStorage.setItem(SAVED_KEY, JSON.stringify(["a", "b"]));` with `document.cookie = savedCookieString(["a", "b"], false);`.
3. Replace `localStorage.setItem(SAVED_KEY, JSON.stringify(["a"]));` with `document.cookie = savedCookieString(["a"], false);`.

In `components/header/SiteHeader.test.tsx`:
1. Replace `import { SAVED_KEY } from "@/lib/saved";` with `import { savedCookieString } from "@/lib/saved";`.
2. Replace `localStorage.setItem(SAVED_KEY, JSON.stringify(["a", "b"]));` with `document.cookie = savedCookieString(["a", "b"], false);`.
3. Replace `localStorage.setItem(SAVED_KEY, JSON.stringify(["a"]));` with `document.cookie = savedCookieString(["a"], false);`.
4. Replace the last two lines of "says 1 item in the singular and caps the badge at 99+" with:

```tsx
    // 120 ids in the cookie: the store keeps 100 (shopping spec 5.1), and the badge shows 99+.
    document.cookie = savedCookieString(Array.from({ length: 120 }, (_, i) => `id${i}`), false);
    render(<SavedLink />);
    expect(screen.getByRole("link", { name: "Saved, 100 items" })).toHaveTextContent("99+");
```

Check nothing else still uses the old key: `grep -rn "SAVED_KEY" --include="*.ts" --include="*.tsx" app components hooks lib tests vitest.setup.ts` should print nothing.

- [ ] **Step 13: Run every check**

Run, one after another: `pnpm test`, `pnpm lint`, `pnpm typecheck`.
Expected: all pass. The unit count is 455 plus the new tests.

- [ ] **Step 14: Measure the JS (the store is in every page's shell)**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: 3 pass. Note the three `scriptBrotli` figures. If any page is past **152,178 B**, stop here and report the figures (the JS ledger's stop rule).

Also run the end-to-end save test, which now saves through the cookie: `pnpm e2e tests/e2e/home.spec.ts -g "a heart saves" --project=phone-390`. Expected: PASS.

- [ ] **Step 15: Hand over for commit**

Files: `lib/cookies.ts`, `lib/cookies.test.ts`, `lib/campus.ts`, `lib/saved.ts`, `lib/saved.test.ts`, `hooks/useIsSaved.ts`, `hooks/home-hooks.test.tsx`, `hooks/hooks.test.tsx`, `components/listings/SaveHeart.tsx`, `components/listings/SaveHeart.test.tsx`, `components/header/SiteHeader.test.tsx`, `tests/helpers/dom.ts`, `vitest.setup.ts`.
Message: `feat: saved items live in a first-party cookie, so the server can build Saved (shopping spec 5.1). JS: / <n> B, browse <n> B, listing <n> B`

---

### Task 2: Seller and collection data

Sellers gain an about, a start month, a trust badge and a category slug; the badge moves to the seller, and the seven listings that disagreed now match (plan decision 4). Collections gain an intro and a rule (spec 6.1). Small helpers for the pages' wording, and the rule matching, come with them.

**Files:**
- Modify: `lib/types.ts`
- Modify: `data/fixtures/sellers.ts` (rewritten), `data/fixtures/collections.ts` (rewritten), `data/fixtures/listings.ts` (seven badges and a comment)
- Modify: `data/fixtures/fixtures.test.ts`
- Modify: `lib/format.ts`, `lib/format.test.ts`
- Create: `lib/collections.ts`, `lib/collections.test.ts`
- Modify: `tests/helpers/fakes.ts`, `lib/featured.test.ts`

- [ ] **Step 1: Write the fixture checks**

In `data/fixtures/fixtures.test.ts`, add this block at the end of the file:

```ts
describe("seller and collection fixtures (shopping spec 6.1)", () => {
  it("gives every seller an about, a start month and a known category with its own name", () => {
    for (const seller of sellers) {
      expect(seller.about.trim().length, seller.slug).toBeGreaterThan(0);
      expect(seller.since, seller.slug).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      expect(seller.since <= "2026-10", seller.slug).toBe(true);
      expect(categories.find((category) => category.slug === seller.categorySlug)?.name, seller.slug).toBe(
        seller.category,
      );
    }
  });

  it("gives every listing its seller's trust badge", () => {
    for (const listing of listings) {
      expect(listing.badge, listing.id).toBe(sellersBySlug.get(listing.sellerSlug)?.badge);
    }
  });

  it("has a seller with nothing available, so the storefront's empty state can be tested", () => {
    const selling = new Set(
      listings.filter((listing) => listing.availability === "available").map((listing) => listing.sellerSlug),
    );
    expect(sellers.filter((seller) => !selling.has(seller.slug)).map((seller) => seller.slug)).toContain("lash-lounge");
  });

  it("builds every collection from known categories, with an intro", () => {
    for (const collection of collections) {
      expect(collection.intro.length, collection.slug).toBeGreaterThan(0);
      expect(collection.rule.categories.length, collection.slug).toBeGreaterThan(0);
      for (const slug of collection.rule.categories) expect(categorySlugs.has(slug), collection.slug).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm test data/fixtures/fixtures.test.ts`
Expected: FAIL (and type errors), because sellers have no `about`, `since`, `badge` or `categorySlug`, and collections have no `intro` or `rule`.

- [ ] **Step 3: Extend the types**

In `lib/types.ts`, replace the `Collection` type with:

```ts
export type Collection = {
  slug: string;
  eyebrow: string;
  title: string;
  image: ImageRef;
  /** One sentence under the title (shopping spec 7.2). */
  intro: string;
  rule: CollectionRule;
};

/** Browse's price caps, in rand (browse and listing spec 4.9). Browse reads them from links as ?max=50 and so on. */
export type PriceCap = 50 | 100 | 250 | 500;

/** Which listings a collection shows (shopping spec 6.1), like a saved browse: these categories, under an optional cap. */
export type CollectionRule = {
  categories: readonly string[];
  maxPrice?: PriceCap;
};
```

and replace the `Seller` type with:

```ts
export type Seller = {
  slug: string;
  name: string;
  tagline: string;
  /** The category as shown, e.g. "Hair & beauty". */
  category: string;
  /** The same category's slug, for links (shopping spec 6.1). */
  categorySlug: string;
  campusSlug: string;
  verified: boolean;
  /** The seller's trust badge. Each of their listings shows the same one (shopping spec 6.1). */
  badge: TrustBadge | null;
  /** Two or three sentences in the seller's own words. Line breaks are kept on the page. */
  about: string;
  /** YYYY-MM: the month they started selling. */
  since: string;
  image: ImageRef;
};
```

- [ ] **Step 4: Rewrite the sellers**

Replace `data/fixtures/sellers.ts` with:

```ts
import type { Seller, TrustBadge } from "@/lib/types";

// The category names as shown, by slug. Fixtures import nothing at run time (scripts/make-placeholders.ts runs them in
// plain Node), so these repeat data/fixtures/categories.ts, and a fixture test checks the two agree.
const CATEGORY_NAMES: Record<string, string> = {
  "textbooks-notes": "Textbooks & notes",
  tech: "Tech",
  "res-living": "Res & living",
  "fashion-thrift": "Fashion & thrift",
  food: "Food",
  "hair-beauty": "Hair & beauty",
  tutoring: "Tutoring",
  services: "Services",
  "tickets-events": "Tickets & events",
  stationery: "Stationery",
};

type Standing = {
  verified?: boolean;
  badge: TrustBadge | null;
  /** YYYY-MM. */
  since: string;
};

const seller = (
  slug: string,
  name: string,
  tagline: string,
  categorySlug: string,
  campusSlug: string,
  { verified = false, badge, since }: Standing,
  about: string,
): Seller => ({
  slug,
  name,
  tagline,
  category: CATEGORY_NAMES[categorySlug],
  categorySlug,
  campusSlug,
  verified,
  badge,
  about,
  since,
  image: { src: `/placeholders/seller/${slug}.svg`, alt: `The ${name.toLowerCase()} at work` },
});

// Generic names (spec 13), not the old demo's sellers. Only verified sellers are featured. Each seller's badge is the
// one their listings show (shopping spec 6.1). The about texts and start months are sample wording.
export const sellers: readonly Seller[] = [
  seller(
    "hair-studio", "Hair studio", "Braids, cornrows and wash days on campus.", "hair-beauty", "midrand",
    { verified: true, badge: "trusted", since: "2025-02" },
    "I've been braiding since high school and started taking bookings on campus in my first year.\n" +
      "Bring a picture of the style you want, and I'll tell you how long it takes and which hair to buy.",
  ),
  seller(
    "maths-tutor", "Maths tutor", "Exam prep that sticks, one hour at a time.", "tutoring", "midrand",
    { verified: true, badge: "responsive", since: "2025-08" },
    "I'm a third-year student who tutors first-years in Statistics 1 and Maths 1. We work through past papers " +
      "together until the method sticks.",
  ),
  seller(
    "home-bakery", "Home bakery", "Cupcakes and cookie boxes for any occasion.", "food", "midrand",
    { verified: true, badge: "trusted", since: "2025-04" },
    "I bake at home in Midrand and bring orders to campus in the morning. Cupcakes, cookie boxes and birthday " +
      "cakes, with a day's notice.",
  ),
  seller(
    "design-studio", "Design studio", "Logos and posters for student hustles.", "services", "midrand",
    { verified: true, badge: "responsive", since: "2025-11" },
    "I study graphic design and make logos, posters and social media posts for student hustles. You get two rounds " +
      "of changes and the files in every size you need.",
  ),
  seller(
    "thrift-rack", "Thrift rack", "Pre-loved jackets and denim, washed and pressed.", "fashion-thrift", "pretoria",
    { verified: true, badge: "new-seller", since: "2026-09" },
    "I hunt the thrift shops for good jackets and denim, then wash and press everything before it's listed. New " +
      "stock most weeks.",
  ),
  seller(
    "code-coach", "Code coach", "Python and Java help before your practicals.", "tutoring", "pretoria",
    { verified: true, badge: "trusted", since: "2025-03" },
    "I'm in my final year of IT and help first- and second-years with Python and Java. Bring your practical and " +
      "we'll debug it together, step by step.",
  ),
  seller(
    "phone-fix", "Phone fix", "Cracked screens and batteries, same day.", "services", "bedfordview",
    { verified: true, badge: "responsive", since: "2025-06" },
    "I replace cracked screens and tired batteries on most Samsung and iPhone models. Most repairs are done the " +
      "same day.",
  ),
  seller(
    "nail-bar", "Nail bar", "Gel, acrylics and nail art between lectures.", "hair-beauty", "cape-town-tyger-valley",
    { verified: true, badge: "responsive", since: "2025-09" },
    "Gel, acrylics and nail art, done between lectures at Tyger Valley. Book a slot and send me a picture of what " +
      "you'd like.",
  ),
  seller(
    "study-notes", "Study notes", "Typed summaries for first-year modules.", "textbooks-notes", "online",
    { verified: true, badge: "responsive", since: "2025-05" },
    "I type up clear summaries for first-year modules and tutor spreadsheets over video. Everything comes as a " +
      "PDF, so you can study anywhere.",
  ),
  seller(
    "res-kitchen", "Res kitchen", "Home-cooked lunch boxes, ordered by 10am.", "food", "durban-umhlanga",
    { badge: "trusted", since: "2025-07" },
    "Home-cooked lunch boxes for students in res. Order by 10am and collect at lunchtime; the menu changes every " +
      "week.",
  ),
  // Every listing's seller is on the listing's campus (browse and listing spec 6.2). These sellers aren't verified,
  // so the Featured today draw doesn't change.
  seller(
    "tech-corner", "Tech corner", "Calculators, headsets and chargers, tested before you buy.", "tech", "midrand",
    { badge: "responsive", since: "2026-03" },
    "I test every calculator, headset and charger before I list it, so you know it works.\n" +
      "Ask me anything about a listing. I usually reply within the hour.",
  ),
  seller(
    "book-swap", "Book swap", "Last year's textbooks and notes at half the price.", "textbooks-notes", "midrand",
    { badge: "trusted", since: "2025-01" },
    "I sell last year's textbooks and notes at about half the bookshop price. If a book has notes in the margins, " +
      "the listing says so.",
  ),
  seller(
    "res-deals", "Res deals", "Fridges, lamps and curtains from students moving out.", "res-living", "midrand",
    { badge: "trusted", since: "2025-10" },
    "When students move out of res, I find their fridges, lamps and curtains a new home. Everything is cleaned and " +
      "checked before it's listed.",
  ),
  seller(
    "closet-clear-out", "Closet clear-out", "Good clothes that need a new home.", "fashion-thrift", "midrand",
    { badge: "new-seller", since: "2026-09" },
    "Clearing out clothes I don't wear any more. Everything is washed, and I'm happy to swap.",
  ),
  seller(
    "ticket-desk", "Ticket desk", "Spare tickets for events around campus.", "tickets-events", "midrand",
    { badge: null, since: "2026-07" },
    "Spare tickets for events around Midrand, sold at what I paid. I'll help you change the name on the booking.",
  ),
  seller(
    "res-essentials", "Res essentials", "Kettles, lamps and the bits every res room needs.", "res-living", "pretoria",
    { badge: "responsive", since: "2026-02" },
    "Kettles, lamps and the small things every res room needs. I'm on campus most days, so collecting is easy.",
  ),
  seller(
    "lash-lounge", "Lash lounge", "Classic and volume lashes by appointment.", "hair-beauty", "pretoria",
    { badge: "trusted", since: "2025-05" },
    "Classic and volume lash sets by appointment. I'm taking a short break, and bookings open again soon.",
  ),
  seller(
    "stationery-stop", "Stationery stop", "Paper, pens and highlighters in bundles.", "stationery", "pretoria",
    { badge: null, since: "2026-06" },
    "Paper, pens and highlighters in bundles, for less than buying them one at a time.",
  ),
  seller(
    "bookshelf", "Bookshelf", "Textbooks from finished modules.", "textbooks-notes", "bedfordview",
    { badge: "trusted", since: "2025-03" },
    "Textbooks from modules I've finished, kept in good condition. Ask if you need a book that isn't listed yet.",
  ),
  seller(
    "moving-out-sale", "Moving-out sale", "Everything from a res room, priced to go.", "res-living", "bedfordview",
    { badge: null, since: "2026-09" },
    "I'm moving out of res at the end of the term, so everything has to go. Free things go to whoever collects " +
      "first.",
  ),
  seller(
    "kitchen-kit", "Kitchen kit", "Ovens, kettles and pots for cooking in res.", "res-living", "bloemfontein",
    { badge: "trusted", since: "2025-08" },
    "Ovens, kettles and pots for cooking in res, tested and cleaned. I can hold an item for a day while you arrange " +
      "to collect it.",
  ),
  seller(
    "weekend-market", "Weekend market", "Bikes, cameras and things worth a second life.", "res-living",
    "cape-town-mowbray",
    { badge: "new-seller", since: "2026-08" },
    "Bikes, cameras and other things worth a second life, found at weekend markets around Cape Town.\n" +
      "I'm open to swaps.",
  ),
  seller(
    "accounting-tutor", "Accounting tutor", "Accounting 2 and 3, explained until it clicks.", "tutoring",
    "durban-umhlanga",
    { badge: "trusted", since: "2025-02" },
    "I tutor Accounting 2 and 3 and explain each step until it clicks. Two-hour sessions, with past-paper questions " +
      "to take home.",
  ),
  seller(
    "study-desk", "Study desk", "Calculators and stationery for exam season.", "stationery", "east-london",
    { badge: null, since: "2026-05" },
    "Calculators and stationery for exam season. Whatever I can't sell, I give away.",
  ),
  seller(
    "room-refresh", "Room refresh", "Curtains, rugs and cushions for a brighter res room.", "res-living",
    "nelson-mandela-bay",
    { badge: "new-seller", since: "2026-09" },
    "Curtains, rugs and cushions to make a res room feel like home. Most things are under R200.",
  ),
  seller(
    "sports-kit", "Sports kit", "Jerseys and gym gear, washed and ready.", "fashion-thrift", "potchefstroom",
    { badge: "responsive", since: "2025-12" },
    "Jerseys and gym gear from teams and players who've moved on. Everything is washed and ready to wear.",
  ),
  seller(
    "drawing-office", "Drawing office", "Drawing sets and scales for engineering students.", "stationery",
    "vanderbijlpark",
    { badge: "trusted", since: "2025-04" },
    "Drawing sets, scales and templates for engineering students, from someone who's finished with them. Every set " +
      "is complete.",
  ),
  seller(
    "cv-clinic", "CV clinic", "CVs and LinkedIn profiles that get replies.", "services", "online",
    { badge: "trusted", since: "2025-06" },
    "I rewrite CVs and LinkedIn profiles for students looking for internships and first jobs. We start with a short " +
      "video call about the jobs you want.",
  ),
  seller(
    "logo-lab", "Logo lab", "Logos for student brands, paid for or swapped.", "services", "online",
    { badge: null, since: "2026-08" },
    "Logos for student brands, paid for or swapped for something I need, like photos or a website. Tell me about " +
      "your brand and I'll send three ideas.",
  ),
];
```

The 29 sellers, their order, names, taglines, campuses and verified flags are as before; check with `git diff data/fixtures/sellers.ts` that only the new fields and the layout changed.

- [ ] **Step 5: Give seven listings their seller's badge (plan decision 4)**

In `data/fixtures/listings.ts`, make these seven edits, each inside one `listing(` call:

| Listing | Replace | With |
|---|---|---|
| l-002 | `"book-swap", "new-seller",` | `"book-swap", "trusted",` |
| l-021 | `"weekend-market", null, "2026-10-12T05:30:00Z",` | `"weekend-market", "new-seller",` and move `"2026-10-12T05:30:00Z",` onto its own line below, as l-002 does |
| l-006 | `"res-deals", null, "2026-10-11T12:30:00Z",` | `"res-deals", "trusted", "2026-10-11T12:30:00Z",` |
| fs-001 | `"book-swap", null, "2026-10-08T18:00:00Z",` | `"book-swap", "trusted",` and move `"2026-10-08T18:00:00Z",` onto its own line |
| fs-002 | `"res-essentials", null,` | `"res-essentials", "responsive",` |
| fs-003 | `"res-deals", null, "2026-10-08T14:00:00Z",` | `"res-deals", "trusted", "2026-10-08T14:00:00Z",` |
| fs-006 | `"weekend-market", null,` | `"weekend-market", "new-seller",` |

Then change the comment above `export const listings` to:

```ts
// Newest first. Every campus has listings except Mbombela, so its empty state can be tested. l-016 is paused and
// l-026 is sold (plan decision 14). Free items are R0; swap-only items have no price. Each listing's badge is its
// seller's (shopping spec 6.1).
```

- [ ] **Step 6: Rewrite the collections**

Replace `data/fixtures/collections.ts` with:

```ts
import type { Collection, CollectionRule } from "@/lib/types";

const collection = (
  slug: string,
  eyebrow: string,
  title: string,
  intro: string,
  rule: CollectionRule,
): Collection => ({
  slug,
  eyebrow,
  title,
  image: { src: `/placeholders/collection/${slug}.svg`, alt: title },
  intro,
  rule,
});

// Curated by the Incubation Hub for the season (spec 7.6). Each is a rule, like a saved browse, so it fills itself as
// listings come and go (shopping spec 6.1). The intros are sample wording for the Hub to change.
export const collections: readonly Collection[] = [
  collection(
    "start-of-semester", "Start of semester", "Back-to-campus essentials",
    "Books, stationery and tech to start the semester ready.",
    { categories: ["textbooks-notes", "stationery", "tech"] },
  ),
  collection(
    "exam-season", "Exam season", "Notes, tutors & cram snacks",
    "Everything for exam season, from summaries to snacks.",
    { categories: ["textbooks-notes", "tutoring", "food"] },
  ),
  collection(
    "moving-in", "Moving in", "Res setup under R500",
    "Make your room a home without breaking the bank.",
    { categories: ["res-living"], maxPrice: 500 },
  ),
  collection(
    "skills-for-hire", "Skills for hire", "Book a student",
    "Skills for hire from students on every campus.",
    { categories: ["services", "tutoring", "hair-beauty"] },
  ),
];
```

Run: `pnpm test data/fixtures/fixtures.test.ts`
Expected: PASS. If "gives every listing its seller's trust badge" fails, the message names the listing: check its row against the table in Step 5.

- [ ] **Step 7: Write the wording helpers' tests**

In `lib/format.test.ts`, add `listingsLabel`, `monthYear` and `sellerCardAlt` to the import list (keeping it alphabetical), and add at the end of the file:

```ts
describe("shopping wording (shopping spec 4 and 7)", () => {
  it("writes a YYYY-MM month in words, for Selling since", () => {
    expect(monthYear("2026-03")).toBe("March 2026");
    expect(monthYear("2025-12")).toBe("December 2025");
  });

  it("counts listings in plain words", () => {
    expect(listingsLabel(1)).toBe("1 listing");
    expect(listingsLabel(0)).toBe("0 listings");
    expect(listingsLabel(12)).toBe("12 listings");
  });

  it("says who, what and where on a seller's share card", () => {
    expect(sellerCardAlt("Tech corner", "Tech", "Midrand")).toBe("Tech corner, Tech at Midrand on Vossie");
  });
});
```

- [ ] **Step 8: Write the rule's tests**

Create `lib/collections.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import { collectionBrowseLinks, matchesRule } from "./collections";
import type { CollectionRule } from "./types";

const categories = [
  { slug: "res-living", name: "Res & living" },
  { slug: "services", name: "Services" },
  { slug: "tutoring", name: "Tutoring" },
];

const resUnder500: CollectionRule = { categories: ["res-living"], maxPrice: 500 };
const skills: CollectionRule = { categories: ["services", "tutoring"] };

describe("matchesRule (shopping spec 6.2)", () => {
  it("takes listings in the rule's categories only", () => {
    expect(matchesRule(makeListing({ categorySlug: "services" }), skills)).toBe(true);
    expect(matchesRule(makeListing({ categorySlug: "food" }), skills)).toBe(false);
  });

  it("keeps to the cap: the cap itself and free listings count, dearer and swap-only ones don't", () => {
    const res = (priceZar: number | null) => makeListing({ categorySlug: "res-living", priceZar });
    expect(matchesRule(res(500), resUnder500)).toBe(true);
    expect(matchesRule(res(0), resUnder500)).toBe(true);
    expect(matchesRule(res(501), resUnder500)).toBe(false);
    expect(matchesRule(res(null), resUnder500)).toBe(false);
  });

  it("takes swap-only listings when there's no cap", () => {
    expect(matchesRule(makeListing({ categorySlug: "services", priceZar: null, payMode: "swap" }), skills)).toBe(true);
  });
});

describe("collectionBrowseLinks (shopping spec 7.2)", () => {
  it("links to each category in browse, keeping the cap", () => {
    expect(collectionBrowseLinks(resUnder500, categories)).toEqual([
      { label: "More in Res & living under R500", href: "/browse?cat=res-living&max=500" },
    ]);
  });

  it("follows the rule's order without a cap, and skips a category that doesn't exist", () => {
    expect(collectionBrowseLinks({ categories: ["tutoring", "nope", "services"] }, categories)).toEqual([
      { label: "More in Tutoring", href: "/browse?cat=tutoring" },
      { label: "More in Services", href: "/browse?cat=services" },
    ]);
  });
});
```

- [ ] **Step 9: Run them to make sure they fail**

Run: `pnpm test lib/format.test.ts lib/collections.test.ts`
Expected: FAIL, because the helpers and `./collections` don't exist.

- [ ] **Step 10: Write the helpers**

In `lib/format.ts`, add at the end:

```ts
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-03" → "March 2026", for "Selling since" (shopping spec 4.1). No timezone maths: it's a month, not a moment. */
export function monthYear(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "1 listing", "12 listings". */
export function listingsLabel(count: number): string {
  return count === 1 ? "1 listing" : `${count} listings`;
}

/** A seller's share card's alt text (shopping spec 4.3). */
export function sellerCardAlt(name: string, category: string, campusName: string): string {
  return `${name}, ${category} at ${campusName} on Vossie`;
}
```

Create `lib/collections.ts`:

```ts
import { formatRand } from "./format";
import type { Category, CollectionRule, Listing } from "./types";

/**
 * Whether a listing belongs in a collection (shopping spec 6.2): its category is one of the rule's and, under a cap,
 * it costs the cap or less. A free listing (R0) counts; a swap-only one has no price, so a capped rule leaves it out.
 * Whether it's available is the caller's job.
 */
export function matchesRule(listing: Pick<Listing, "categorySlug" | "priceZar">, rule: CollectionRule): boolean {
  if (!rule.categories.includes(listing.categorySlug)) return false;
  if (rule.maxPrice === undefined) return true;
  return listing.priceZar !== null && listing.priceZar <= rule.maxPrice;
}

export type BrowseLink = { label: string; href: string };

/**
 * "More in browse" (shopping spec 7.2): one link per category in the rule, in the rule's order, keeping the cap.
 * "More in Res & living under R500" goes to /browse?cat=res-living&max=500. The links name no campus, so browse opens
 * on the viewer's own (plan decision 10).
 */
export function collectionBrowseLinks(
  rule: CollectionRule,
  categories: readonly Pick<Category, "slug" | "name">[],
): BrowseLink[] {
  const cap = rule.maxPrice;
  return rule.categories.flatMap((slug) => {
    const category = categories.find((item) => item.slug === slug);
    if (!category) return [];
    if (cap === undefined) return [{ label: `More in ${category.name}`, href: `/browse?cat=${slug}` }];
    return [{ label: `More in ${category.name} under ${formatRand(cap)}`, href: `/browse?cat=${slug}&max=${cap}` }];
  });
}
```

Run: `pnpm test lib/format.test.ts lib/collections.test.ts`
Expected: PASS.

- [ ] **Step 11: A seller for tests**

In `tests/helpers/fakes.ts`, change the import to `import type { BrowseQuery, Listing, Seller } from "@/lib/types";` and add:

```ts
/** A seller for tests: an unverified Midrand tech seller with no badge. Override what the test is about. */
export function makeSeller(overrides: Partial<Seller> = {}): Seller {
  return {
    slug: "test-seller",
    name: "Test seller",
    tagline: "A test tagline.",
    category: "Tech",
    categorySlug: "tech",
    campusSlug: "midrand",
    verified: false,
    badge: null,
    about: "A test seller.",
    since: "2026-03",
    image: { src: "/placeholders/seller/tech-corner.svg", alt: "The test seller at work" },
    ...overrides,
  };
}
```

In `lib/featured.test.ts`, add `import { makeSeller } from "@/tests/helpers/fakes";` after the `vitest` import, and replace the `seller` helper with:

```ts
const seller = (slug: string, campusSlug: string, verified = true): Seller =>
  makeSeller({ slug, name: slug, campusSlug, verified });
```

- [ ] **Step 12: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass. Then check plain Node still loads the fixtures, as `scripts/make-placeholders.ts` does (this writes nothing):

```bash
node -e "Promise.all([import('./data/fixtures/sellers.ts'), import('./data/fixtures/collections.ts')]).then(([s, c]) => console.log(s.sellers.length, c.collections.length))"
```

Expected: `29 4`.

- [ ] **Step 13: Hand over for commit**

Files: `lib/types.ts`, `data/fixtures/sellers.ts`, `data/fixtures/collections.ts`, `data/fixtures/listings.ts`, `data/fixtures/fixtures.test.ts`, `lib/format.ts`, `lib/format.test.ts`, `lib/collections.ts`, `lib/collections.test.ts`, `tests/helpers/fakes.ts`, `lib/featured.test.ts`.
Message: `feat: sellers gain an about, a start month, their trust badge and a category slug; collections become rules (shopping spec 6.1)`

---

### Task 3: Data functions

The cached lookups the three pages need (spec 6.2), and the server's read of the saved cookie (spec 5.1).

**Files:**
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`
- Create: `lib/data/saved.ts`, `lib/data/saved.test.ts`

- [ ] **Step 1: Write the data tests**

In `lib/data/index.test.ts`, add `getCollection`, `getCollectionListings`, `getListingsByIds` and `getSellerListings` to the import list (keeping it alphabetical), and add at the end of the file:

```ts
describe("shopping page data (shopping spec 6.2)", () => {
  const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

  it("lists a seller's available listings, newest first", async () => {
    expect(ids(await getSellerListings("tech-corner"))).toEqual(["l-001", "l-007"]);
    expect(ids(await getSellerListings("weekend-market"))).toEqual(["l-021", "l-022", "fs-006"]);
  });

  it("leaves paused and sold listings off a storefront", async () => {
    expect(await getSellerListings("lash-lounge")).toEqual([]);
    expect(ids(await getSellerListings("study-desk"))).toEqual(["fs-007"]);
    expect(await getSellerListings("nope")).toEqual([]);
  });

  it("finds a collection by slug", async () => {
    expect((await getCollection("moving-in"))?.title).toBe("Res setup under R500");
    expect(await getCollection("nope")).toBeNull();
  });

  it("fills Res setup under R500 from every campus: free ones in, swap-only and dearer ones out", async () => {
    expect(ids(await getCollectionListings("moving-in"))).toEqual(["l-014", "l-006", "l-027", "fs-003", "fs-005"]);
  });

  it("fills the uncapped collections, swap-only listings in, paused and sold ones out", async () => {
    const semester = ids(await getCollectionListings("start-of-semester"));
    expect(semester).toHaveLength(12);
    expect(semester).toContain("fs-006");
    expect(semester).not.toContain("l-026");
    expect(await getCollectionListings("exam-season")).toHaveLength(10);
    const skills = ids(await getCollectionListings("skills-for-hire"));
    expect(skills).toHaveLength(9);
    expect(skills).toContain("fs-004");
    expect(skills).not.toContain("l-016");
  });

  it("has no listings for an unknown collection", async () => {
    expect(await getCollectionListings("nope")).toEqual([]);
  });

  it("looks listings up by id in the order given, paused and sold ones in, unknown ids out", async () => {
    expect(ids(await getListingsByIds(["l-026", "nope", "l-001", "l-016"]))).toEqual(["l-026", "l-001", "l-016"]);
    expect(await getListingsByIds([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test lib/data/index.test.ts`
Expected: FAIL, because the four functions don't exist.

- [ ] **Step 3: Write the functions**

In `lib/data/index.ts`:

1. Add `import { matchesRule } from "@/lib/collections";` after the `@/lib/campus` import.
2. Add after `getCollections`:

```ts
export async function getCollection(slug: string): Promise<Collection | null> {
  "use cache";
  return collections.find((collection) => collection.slug === slug) ?? null;
}

/** The most a collection page shows (shopping spec 6.2). */
const COLLECTION_LIMIT = 48;

/**
 * A collection's listings (shopping spec 6.2): the available listings its rule matches, at every campus, newest first,
 * at most 48. An unknown collection has none.
 */
export async function getCollectionListings(slug: string): Promise<readonly Listing[]> {
  "use cache";
  const collection = collections.find((item) => item.slug === slug);
  if (!collection) return [];
  return available(listings)
    .filter((listing) => matchesRule(listing, collection.rule))
    .sort(newestFirst)
    .slice(0, COLLECTION_LIMIT);
}
```

3. Add after `getSellerSlugs`, at the end of the file:

```ts
/** A storefront's listings (shopping spec 4.1): the seller's available listings, newest first. */
export async function getSellerListings(slug: string): Promise<readonly Listing[]> {
  "use cache";
  return available(listings)
    .filter((listing) => listing.sellerSlug === slug)
    .sort(newestFirst);
}

/**
 * The Saved page's listings (shopping spec 5.2): one per id, in the order given, paused and sold ones included. Ids
 * that don't exist any more are dropped. The cache keys on the whole list of ids, which is fine for sample data;
 * revisit it with Supabase (plan decision 13).
 */
export async function getListingsByIds(ids: readonly string[]): Promise<readonly Listing[]> {
  "use cache";
  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
```

Run: `pnpm test lib/data/index.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the saved-ids test**

Create `lib/data/saved.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSavedIds } from "./saved";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "vossie_saved" && cookieValue.current !== undefined ? { value: cookieValue.current } : undefined,
  }),
}));

afterEach(() => {
  cookieValue.current = undefined;
});

describe("getSavedIds (shopping spec 5.1)", () => {
  it("reads the saved ids from the cookie, newest first", async () => {
    cookieValue.current = "l-003.l-001";
    expect(await getSavedIds()).toEqual(["l-003", "l-001"]);
  });

  it("has none without the cookie", async () => {
    expect(await getSavedIds()).toEqual([]);
  });

  it("drops bad values and repeats, as the browser does", async () => {
    cookieValue.current = "l-001.<script>.l-001.l-002";
    expect(await getSavedIds()).toEqual(["l-001", "l-002"]);
  });
});
```

Run: `pnpm test lib/data/saved.test.ts`
Expected: FAIL, because `./saved` doesn't exist.

- [ ] **Step 5: Read the cookie on the server**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` first. Then create `lib/data/saved.ts`:

```ts
import { cookies } from "next/headers";
import { parseSavedIds, SAVED_COOKIE } from "@/lib/saved";

/**
 * The viewer's saved listing ids, newest first (shopping spec 5.1), read from the vossie_saved cookie with the same
 * rules as the browser. Request-time: call it only inside <Suspense>.
 */
export async function getSavedIds(): Promise<string[]> {
  const store = await cookies();
  return parseSavedIds(store.get(SAVED_COOKIE)?.value);
}
```

Run: `pnpm test lib/data/saved.test.ts`
Expected: PASS.

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass.

- [ ] **Step 7: Hand over for commit**

Files: `lib/data/index.ts`, `lib/data/index.test.ts`, `lib/data/saved.ts`, `lib/data/saved.test.ts`.
Message: `feat: storefront, collection and saved-list data (shopping spec 5.1, 6.2)`

---

### Task 4: The shared grid, card tags and Share's class

`ListingGrid` serves every new page and the listing page's More from. Cards learn to show "Sold", "Not taking orders" and, on Saved, "Removed". Share takes a class so the storefront can style it on navy (spec 7.1).

**Files:**
- Create: `components/listings/ListingGrid.tsx`, `components/listings/ListingGrid.test.tsx`
- Modify: `components/listings/ListingCard.tsx`, `components/listings/ListingCard.test.tsx`
- Modify: `components/listing/ShareButton.tsx`, `components/listing/ShareButton.test.tsx`
- Modify: `components/listing/MoreFrom.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the card's tests**

In `components/listings/ListingCard.test.tsx`, add `import { renderToString } from "react-dom/server";` after the Testing Library import, and add at the end of the `describe`:

```tsx
  it("tags a sold or paused listing (only Saved shows them, shopping spec 7.1)", () => {
    const { unmount } = render(<ListingCard listing={{ ...braids, availability: "sold" }} campusName="Midrand" />);
    expect(screen.getByText("Sold")).toHaveClass("listing-tag");
    unmount();
    render(<ListingCard listing={{ ...braids, availability: "paused" }} campusName="Midrand" />);
    expect(screen.getByText("Not taking orders")).toHaveClass("listing-tag");
  });

  it("has no tag when the listing is available", () => {
    const { container } = render(<ListingCard listing={braids} campusName="Midrand" />);
    expect(container.querySelector(".listing-tags")).toBeNull();
  });

  it("on Saved, starts its heart pressed and carries a hidden Removed tag for CSS to show (shopping spec 5.3)", () => {
    const html = renderToString(<ListingCard listing={braids} campusName="Midrand" saved />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toMatch(/<p class="listing-tag listing-removed" aria-hidden="true">Removed<\/p>/);
    expect(renderToString(<ListingCard listing={braids} campusName="Midrand" />)).not.toContain("Removed");
  });
```

- [ ] **Step 2: Write the grid's tests**

Create `components/listings/ListingGrid.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import { ListingGrid } from "./ListingGrid";

const items = [
  makeListing({ id: "l-a", title: "Kettle", campusSlug: "pretoria" }),
  makeListing({ id: "l-b", title: "Lamp", campusSlug: "midrand" }),
];
const names = new Map([
  ["midrand", "Midrand"],
  ["pretoria", "Pretoria"],
]);

describe("ListingGrid (shopping spec 7.1)", () => {
  it("lists one card per listing, in order, each with its campus", () => {
    render(<ListingGrid listings={items} campusNames={names} columns="five" />);
    const cards = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(cards.map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual(["Kettle", "Lamp"]);
    expect(within(cards[0]).getByText("Pretoria")).toBeInTheDocument();
  });

  it("names its column setting for CSS", () => {
    render(<ListingGrid listings={items} campusNames={names} columns="four" />);
    expect(screen.getByRole("list")).toHaveClass("card-grid");
    expect(screen.getByRole("list")).toHaveAttribute("data-columns", "four");
  });

  it("tells every card it's saved, on the Saved page", () => {
    const html = renderToString(<ListingGrid listings={items} campusNames={names} columns="five" saved />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Write Share's test**

In `components/listing/ShareButton.test.tsx`, add at the end of the `describe`:

```tsx
  it("takes a class for where it sits: the listing page's by default, or the storefront's", () => {
    const { unmount } = render(<ShareButton title="Casio calculator" />);
    expect(screen.getByRole("button", { name: "Share" })).toHaveClass("icon-btn", "listing-share");
    unmount();
    render(<ShareButton title="Tech corner" className="seller-share" />);
    const button = screen.getByRole("button", { name: "Share" });
    expect(button).toHaveClass("icon-btn", "seller-share");
    expect(button).not.toHaveClass("listing-share");
  });
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test components/listings components/listing/ShareButton.test.tsx`
Expected: FAIL: no `ListingGrid`, no tags, no `saved` prop, no `className` on Share.

- [ ] **Step 5: Tag the card and pass `saved` to the heart**

Replace the imports and the `ListingCard` function in `components/listings/ListingCard.tsx` with (keep `ListingCardSkeleton` as it is):

```tsx
import Link from "next/link";
import { badgeLabel, priceLabel } from "@/lib/format";
import type { Availability, Listing } from "@/lib/types";
import { Photo } from "./Photo";
import { SaveHeart } from "./SaveHeart";

const STATE_TAGS: Partial<Record<Availability, string>> = { paused: "Not taking orders", sold: "Sold" };

type ListingCardProps = {
  listing: Listing;
  campusName: string;
  /** On the Saved page: the heart starts pressed, and a "Removed" tag shows once it's unpressed (shopping spec 5.3). */
  saved?: boolean;
};

/** A listing in a grid (spec 7.8). The title's link covers the whole card, and the heart sits on top of it. */
export function ListingCard({ listing, campusName, saved = false }: ListingCardProps) {
  const stateTag = STATE_TAGS[listing.availability];
  return (
    <article className="listing-card">
      <Photo
        image={{ src: listing.image.src, alt: "" }}
        ratio="1 / 1"
        sizes="(orientation: landscape) and (max-height: 29.99rem) 23vw, (min-width: 64rem) and (min-height: 30rem) 220px, (min-width: 48rem) and (min-height: 30rem) 30vw, 46vw"
        className="listing-photo"
      />
      <h3 className="listing-title">
        {/* No prefetch: a row of cards would fetch every page as it scrolls past (mobile data). */}
        <Link href={`/listings/${listing.id}`} prefetch={false} className="listing-link">
          {listing.title}
        </Link>
      </h3>
      <p className="listing-price">{priceLabel(listing)}</p>
      <p className="listing-meta">{campusName}</p>
      {listing.badge && <p className="listing-badge">{badgeLabel(listing.badge)}</p>}
      {/* On the photo, but last in reading order (plan decision 6). Only Saved shows paused and sold listings. The
          Removed tag is for sight only: the heart's pressed state already tells screen readers. */}
      {(stateTag || saved) && (
        <div className="listing-tags">
          {stateTag && <p className="listing-tag">{stateTag}</p>}
          {saved && (
            <p className="listing-tag listing-removed" aria-hidden="true">
              Removed
            </p>
          )}
        </div>
      )}
      <SaveHeart id={listing.id} title={listing.title} savedOnServer={saved} />
    </article>
  );
}
```

- [ ] **Step 6: Write the grid**

Create `components/listings/ListingGrid.tsx`:

```tsx
import type { Listing } from "@/lib/types";
import { ListingCard } from "./ListingCard";

type ListingGridProps = {
  listings: readonly Listing[];
  campusNames: ReadonlyMap<string, string>;
  /** "five": 2, 3 and 5 across (Saved, collections). "four": 2, 3 and 4 across (storefronts, More from). */
  columns: "five" | "four";
  /** The Saved page's cards: their hearts start pressed (shopping spec 5.3). */
  saved?: boolean;
};

/** A grid of listing cards (shopping spec 7.1). Browse keeps its own, for its numbered cards and Show more. */
export function ListingGrid({ listings, campusNames, columns, saved = false }: ListingGridProps) {
  return (
    <ul className="card-grid" data-columns={columns}>
      {listings.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} campusName={campusNames.get(listing.campusSlug) ?? ""} saved={saved} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 7: Give Share a class**

In `components/listing/ShareButton.tsx`, add `import { cx } from "@/lib/cx";` after the icons import, add this sentence to the end of the doc comment: `` `className` places it: the listing page's navy outline by default, or the storefront's white one on navy. ``, and replace the signature and the button with:

```tsx
export function ShareButton({ title, className = "listing-share" }: { title: string; className?: string }) {
```

```tsx
    <button type="button" onClick={onClick} aria-label="Share" className={cx("icon-btn", className)}>
```

- [ ] **Step 8: Move More from onto the grid**

In `components/listing/MoreFrom.tsx`, replace `import { ListingCard } from "@/components/listings/ListingCard";` with `import { ListingGrid } from "@/components/listings/ListingGrid";`, and replace the `<ul className="listing-more-grid">…</ul>` block with:

```tsx
        <ListingGrid listings={more.items} campusNames={campusNames} columns="four" />
```

On tablets More from now shows 3 across instead of 2 (spec 7.1).

- [ ] **Step 9: The grid and tag styles**

In `app/globals.css`, in the "Listing: layout, panel, seller, details and more from" block, delete this rule:

```css
  .listing-more-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 14px;
    margin-top: 16px;
  }

```

and, in the same block's desktop media query, delete this rule (and the blank line before it):

```css

    .listing-more-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
```

Then add at the end of the file:

```css
/* --- Shopping: the card grid and card tags (shopping plan, Task 4, spec 7.1 and 5.3) --- */
@layer components {
  /* 2 across on phones, 3 from the tablet step, then 5 ("five") or 4 ("four") from the desktop step. */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 14px;
    margin-top: 16px;
  }

  /* On the photo, under the card's link layer (z-index 1), so a tap still opens the listing. Clear of the heart. */
  .listing-tags {
    position: absolute;
    top: 8px;
    left: 8px;
    display: grid;
    justify-items: start;
    gap: 4px;
    max-width: calc(100% - 64px);
  }

  /* Navy on pale, like the listing page's availability banner. */
  .listing-tag {
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--color-pale);
    color: var(--color-navy);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  /* Saved's removed state (spec 5.3): once the heart is unpressed the card stays, its photo grey and tagged. The text
     keeps full contrast. Without :has() (iOS before 15.4) only the heart shows it. */
  .listing-removed {
    display: none;
  }

  .listing-card:has(.save-heart[aria-pressed="false"]) .listing-removed {
    display: block;
  }

  .listing-card:has(.listing-removed):has(.save-heart[aria-pressed="false"]) .listing-photo {
    filter: grayscale(1);
    opacity: 0.6;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .card-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 28px 18px;
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .card-grid[data-columns="five"] {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .card-grid[data-columns="four"] {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  /* Landscape phones keep the phone layout but get four cards a row, as the homepage does. */
  @media (orientation: landscape) and (max-height: 29.99rem) {
    .card-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
}
```

Check nothing else uses the old class: `grep -rn "listing-more-grid" app components tests` should print nothing.

- [ ] **Step 10: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass, including the existing `MoreFrom` and `ListingView` tests.

- [ ] **Step 11: Look at it**

Build and start (`pnpm build`, then `pnpm start --port 3201`). Open `/listings/l-001` at 768 × 1024 and 1280 × 800: More from shows 3 across on the tablet and 4 on desktop, spaced as before. Open `/` at 390 × 844: Just listed's cards look unchanged. Stop the server.

- [ ] **Step 12: Hand over for commit**

Files: `components/listings/ListingGrid.tsx`, `components/listings/ListingGrid.test.tsx`, `components/listings/ListingCard.tsx`, `components/listings/ListingCard.test.tsx`, `components/listing/ShareButton.tsx`, `components/listing/ShareButton.test.tsx`, `components/listing/MoreFrom.tsx`, `app/globals.css`.
Message: `feat: ListingGrid, card tags, hearts that start pressed on Saved, and Share's class (shopping spec 7.1)`

---

### Task 5: The storefront's parts

The poster band, About, and the seller's listings (spec 4.1 and 4.2, layout A).

**Files:**
- Create: `components/seller/SellerHero.tsx`, `components/seller/SellerHero.test.tsx`
- Create: `components/seller/SellerListings.tsx`, `components/seller/SellerListings.test.tsx`
- Create: `components/seller/SellerView.tsx`, `components/seller/SellerView.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the band's tests**

Create `components/seller/SellerHero.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeSeller } from "@/tests/helpers/fakes";
import { SellerHero } from "./SellerHero";

const techCorner = makeSeller({
  slug: "tech-corner",
  name: "Tech corner",
  tagline: "Calculators, headsets and chargers, tested before you buy.",
  badge: "responsive",
});

const stamps = () => within(screen.getByRole("list")).getAllByRole("listitem").map((item) => item.textContent);

describe("SellerHero (shopping spec 4.1)", () => {
  it("names the seller in the page's heading, with the tagline and their photo", () => {
    render(<SellerHero seller={techCorner} campusName="Midrand" />);
    expect(screen.getByRole("heading", { level: 1, name: "Tech corner" })).toBeInTheDocument();
    expect(screen.getByText("Calculators, headsets and chargers, tested before you buy.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "The test seller at work" })).toBeInTheDocument();
  });

  it("stamps the campus, the category and the badge, and leaves Verified off an unverified seller", () => {
    render(<SellerHero seller={techCorner} campusName="Midrand" />);
    expect(stamps()).toEqual(["Midrand", "Tech", "Responsive"]);
  });

  it("stamps Verified for a verified seller", () => {
    render(<SellerHero seller={{ ...techCorner, verified: true, badge: null }} campusName="Midrand" />);
    expect(stamps()).toEqual(["Midrand", "Tech", "Verified"]);
  });

  it("sends Message through the sign-in page, back to this shop, and offers Share", () => {
    render(<SellerHero seller={techCorner} campusName="Midrand" />);
    expect(screen.getByRole("link", { name: "Message seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsellers%2Ftech-corner",
    );
    expect(screen.getByRole("button", { name: "Share" })).toHaveClass("seller-share");
  });
});
```

- [ ] **Step 2: Write the listings' tests**

Create `components/seller/SellerListings.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSeller } from "@/lib/data";
import { SellerListings } from "./SellerListings";

const load = vi.hoisted(() => ({ failing: false }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getSellerListings: async (slug: string) => {
      if (load.failing) throw new Error("Didn't load");
      return actual.getSellerListings(slug);
    },
  };
});

afterEach(() => {
  load.failing = false;
});

const names = new Map([
  ["midrand", "Midrand"],
  ["pretoria", "Pretoria"],
]);

async function show(slug: string) {
  render(await SellerListings({ seller: (await getSeller(slug))!, campusNames: names }));
}

describe("SellerListings (shopping spec 4.1)", () => {
  it("counts the seller's listings and shows them newest first, 4 across on desktop", async () => {
    await show("tech-corner");
    expect(screen.getByRole("heading", { level: 2, name: "2 listings" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Casio fx-991ZA Plus calculator",
      "Gaming headset, barely used",
    ]);
    expect(screen.getByRole("list")).toHaveAttribute("data-columns", "four");
  });

  it("says 1 listing in the singular", async () => {
    await show("ticket-desk");
    expect(screen.getByRole("heading", { level: 2, name: "1 listing" })).toBeInTheDocument();
  });

  it("says when nothing is listed, and links to the seller's category (plan decision 5)", async () => {
    await show("lash-lounge");
    expect(screen.getByRole("heading", { level: 2, name: "Listings" })).toBeInTheDocument();
    expect(screen.getByText("Nothing listed right now")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "More in Hair & beauty" })).toHaveAttribute(
      "href",
      "/browse?cat=hair-beauty",
    );
  });

  it("shows its own error, with a way back to this shop", async () => {
    load.failing = true;
    await show("tech-corner");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/sellers/tech-corner?retry=seller-listings#seller-listings",
    );
  });
});
```

- [ ] **Step 3: Write the page frame's tests**

Create `components/seller/SellerView.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getSeller } from "@/lib/data";
import { SellerView } from "./SellerView";

// The async listings are tested on their own; here they stand in (jsdom can't render async components in a tree).
vi.mock("./SellerListings", () => ({ SellerListings: () => <section aria-label="Listings, stood in" /> }));

async function show(slug: string) {
  render(<SellerView seller={(await getSeller(slug))!} campusNames={new Map([["midrand", "Midrand"]])} />);
}

describe("SellerView (shopping spec 4.1)", () => {
  it("leads with the band, then About in the seller's own words and the month they started", async () => {
    await show("tech-corner");
    expect(screen.getByRole("heading", { level: 1, name: "Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "About" })).toBeInTheDocument();
    expect(screen.getByText(/I test every calculator, headset and charger/)).toHaveClass("seller-about-text");
    expect(screen.getByText("Selling since March 2026")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Listings, stood in" })).toBeInTheDocument();
  });

  it("ends with a report link through the sign-in page", async () => {
    await show("tech-corner");
    expect(screen.getByRole("link", { name: "Report this seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsellers%2Ftech-corner",
    );
  });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test components/seller`
Expected: FAIL, because the three components don't exist.

- [ ] **Step 5: Write the band**

Create `components/seller/SellerHero.tsx`:

```tsx
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { ShareButton } from "@/components/listing/ShareButton";
import { Photo } from "@/components/listings/Photo";
import { badgeLabel } from "@/lib/format";
import { signInHref } from "@/lib/next-path";
import type { Seller } from "@/lib/types";

/**
 * The storefront's poster band (shopping spec 4.1, layout A): the seller's photo, name and tagline on navy stars, with
 * stamps for the campus, the category, Verified and the trust badge, then Message and Share. Small text on the stars is
 * white; sky only fills the Verified stamp and the Message pill, which carry navy text.
 */
export function SellerHero({ seller, campusName }: { seller: Seller; campusName: string }) {
  return (
    <div className="seller-hero surface-navy texture-stars">
      <Photo
        image={seller.image}
        ratio="1 / 1"
        sizes="(min-width: 64rem) and (min-height: 30rem) 96px, 64px"
        className="seller-hero-photo"
        priority
      />
      <div className="seller-hero-text">
        <h1 className="seller-hero-name">{seller.name}</h1>
        <p className="seller-hero-tagline">{seller.tagline}</p>
        <ul className="seller-stamps">
          <li className="seller-stamp">{campusName}</li>
          <li className="seller-stamp">{seller.category}</li>
          {seller.verified && (
            <li className="seller-stamp seller-verified">
              <CheckIcon className="size-4" />
              Verified
            </li>
          )}
          {seller.badge && <li className="seller-stamp seller-badge">{badgeLabel(seller.badge)}</li>}
        </ul>
      </div>
      <div className="seller-hero-actions">
        <Link href={signInHref(`/sellers/${seller.slug}`)} prefetch={false} className="btn btn-sky seller-message">
          Message seller
        </Link>
        <ShareButton title={seller.name} className="seller-share" />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write the listings**

Create `components/seller/SellerListings.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { SectionError } from "@/components/home/SectionError";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { getSellerListings } from "@/lib/data";
import { listingsLabel } from "@/lib/format";
import type { Seller } from "@/lib/types";

type SellerListingsProps = {
  seller: Seller;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * The seller's available listings, newest first, 4 across on desktop (shopping spec 4.1). With none, a link to their
 * category; if they fail to load, the section's own error.
 */
export async function SellerListings({ seller, campusNames }: SellerListingsProps) {
  const listings = await getSellerListings(seller.slug).catch(() => null);

  let body: ReactNode;
  if (listings === null) {
    body = <SectionError id="seller-listings" title="Listings" path={`/sellers/${seller.slug}`} />;
  } else if (listings.length === 0) {
    body = (
      <div className="seller-empty">
        <p className="seller-empty-title">Nothing listed right now</p>
        <Link href={`/browse?cat=${seller.categorySlug}`} prefetch={false}>
          More in {seller.category}
        </Link>
      </div>
    );
  } else {
    body = <ListingGrid listings={listings} campusNames={campusNames} columns="four" />;
  }

  return (
    <section id="seller-listings" aria-labelledby="seller-listings-title" className="seller-listings">
      <h2 id="seller-listings-title" className="listing-section-title">
        {listings && listings.length > 0 ? listingsLabel(listings.length) : "Listings"}
      </h2>
      {body}
    </section>
  );
}
```

- [ ] **Step 7: Write the page frame**

Create `components/seller/SellerView.tsx`:

```tsx
import Link from "next/link";
import { FlagIcon } from "@/components/icons";
import { monthYear } from "@/lib/format";
import { signInHref } from "@/lib/next-path";
import type { Seller } from "@/lib/types";
import { SellerHero } from "./SellerHero";
import { SellerListings } from "./SellerListings";

type SellerViewProps = {
  seller: Seller;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * A seller's storefront (shopping spec 4): the poster band, About, their listings and the report link. On desktop
 * About sits on the left, beside the listings (spec 4.2).
 */
export function SellerView({ seller, campusNames }: SellerViewProps) {
  const signIn = signInHref(`/sellers/${seller.slug}`);
  return (
    <div className="page seller-page">
      <SellerHero seller={seller} campusName={campusNames.get(seller.campusSlug) ?? ""} />

      <div className="seller-layout">
        <section aria-labelledby="seller-about-title" className="seller-about">
          <h2 id="seller-about-title" className="listing-section-title">
            About
          </h2>
          <p className="seller-about-text">{seller.about}</p>
          <p className="seller-since">Selling since {monthYear(seller.since)}</p>
        </section>
        <SellerListings seller={seller} campusNames={campusNames} />
      </div>

      {/* The listing page's report link style. */}
      <p className="listing-report">
        <Link href={signIn} prefetch={false}>
          <FlagIcon className="size-4" />
          Report this seller
        </Link>
      </p>
    </div>
  );
}
```

Run: `pnpm test components/seller`
Expected: PASS.

- [ ] **Step 8: The storefront's styles**

Add at the end of `app/globals.css`:

```css
/* --- Shopping: the storefront (shopping plan, Task 5, spec 4.1 and 4.2) --- */
@layer components {
  /* .page and .seller-page sit on one element, so this padding replaces .page's gutter: it's the whole content edge,
     16px on phones and 40px from the tablet step. */
  .seller-page {
    padding: 16px 16px 64px;
  }

  /* The band sits on the page column's edge, like the homepage's panels: 10px from the screen on phones, 24px from the
     tablet step (plan decision 9). */
  .seller-hero {
    display: grid;
    gap: 18px;
    margin-inline: -6px;
    padding: 24px 20px;
    border-radius: var(--radius-panel);
  }

  .seller-hero-photo {
    width: 64px;
    border: 2px solid var(--color-white);
    border-radius: 999px;
  }

  .seller-hero-name {
    font-family: var(--vos-font-display);
    font-size: var(--text-hero);
    line-height: 0.96;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .seller-hero-tagline {
    max-width: 40ch;
    margin-top: 10px;
    font-size: 15px;
  }

  .seller-stamps {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  /* White outline and white text on the stars. */
  .seller-stamp {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1.5px solid var(--color-white);
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  /* Solid pills with navy text: navy on sky is 4.97:1. */
  .seller-verified {
    border-color: var(--color-sky);
    background: var(--color-sky);
    color: var(--color-navy);
  }

  .seller-badge {
    background: var(--color-white);
    color: var(--color-navy);
  }

  .seller-hero-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .seller-message {
    flex: 1;
    min-height: 48px;
  }

  .seller-share {
    flex: none;
    border: 1.5px solid var(--color-white);
    color: var(--color-white);
  }

  .seller-layout {
    display: grid;
    gap: 40px;
    margin-top: 32px;
  }

  /* The seller's own line breaks are kept (spec 4.1). */
  .seller-about-text {
    max-width: 65ch;
    margin-top: 12px;
    white-space: pre-line;
  }

  .seller-since {
    margin-top: 12px;
    color: var(--color-muted);
    font-size: 13px;
  }

  .seller-empty {
    display: grid;
    justify-items: start;
    gap: 6px;
    margin-top: 16px;
    padding: 24px 20px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  .seller-empty-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 24px;
    line-height: 1;
    text-transform: uppercase;
  }

  /* Navy on the grey panel: sky-dark is 4.25:1 there. */
  .seller-empty a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-navy);
    font-weight: 600;
    text-decoration: underline 1.5px;
    text-underline-offset: 4px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .seller-page {
      padding-inline: 40px;
    }

    .seller-hero {
      margin-inline: -16px;
      padding: 32px;
    }

    .seller-hero-actions {
      justify-self: start;
    }

    .seller-message {
      padding-inline: 32px;
    }
  }

  /* Desktop (spec 4.2): photo, name and stamps on the left, the actions on the right; About beside the listings. */
  @media (min-width: 64rem) and (min-height: 30rem) {
    .seller-hero {
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 28px;
      padding: 40px;
    }

    .seller-hero-photo {
      width: 96px;
    }

    .seller-layout {
      grid-template-columns: minmax(0, 1fr) minmax(0, 3fr);
      align-items: start;
    }
  }
}
```

- [ ] **Step 9: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass. (The page itself arrives in Task 6, so there's nothing to look at yet.)

- [ ] **Step 10: Hand over for commit**

Files: `components/seller/SellerHero.tsx`, `components/seller/SellerHero.test.tsx`, `components/seller/SellerListings.tsx`, `components/seller/SellerListings.test.tsx`, `components/seller/SellerView.tsx`, `components/seller/SellerView.test.tsx`, `app/globals.css`.
Message: `feat: the storefront's poster band, About and listings (shopping spec 4.1, 4.2)`

---

### Task 6: The storefront page and its share card

**Files:**
- Modify: `app/sellers/[slug]/page.tsx`
- Create: `app/sellers/[slug]/opengraph-image.tsx`
- Modify: `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`

- [ ] **Step 1: Read the docs**

Read `generate-metadata.md`, `generate-image-metadata.md` and `image-response.md` in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`, and `opengraph-image.md` in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/`. The listing page's `app/listings/[id]/page.tsx` and `opengraph-image.tsx` are the pattern to follow.

- [ ] **Step 2: The page**

Replace `app/sellers/[slug]/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SellerView } from "@/components/seller/SellerView";
import { getCampuses, getSeller, getSellerSlugs } from "@/lib/data";

/**
 * The tab title is the seller's name ("Tech corner · Vossie"; the layout adds the suffix) and the description their
 * tagline. Link previews say where: "Tech corner · Midrand on Vossie" (spec 4.3). An unknown slug gets the 404's title.
 */
export async function generateMetadata({ params }: PageProps<"/sellers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [seller, campuses] = await Promise.all([getSeller(slug), getCampuses()]);
  if (!seller) return { title: "Page not found" };
  const campus = campuses.find((item) => item.slug === seller.campusSlug)?.name ?? "Eduvos";
  return {
    title: seller.name,
    description: seller.tagline,
    openGraph: { title: `${seller.name} · ${campus} on Vossie`, description: seller.tagline },
  };
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
  const [seller, campuses] = await Promise.all([getSeller(slug), getCampuses()]);
  if (!seller) notFound();
  return <SellerView seller={seller} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />;
}
```

- [ ] **Step 3: The share card**

Create `app/sellers/[slug]/opengraph-image.tsx`:

```tsx
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getCampuses, getSeller } from "@/lib/data";
import { sellerCardAlt, shortDescription } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The white crest, read once. The card uses next/og's built-in font, as the listings' cards do, until Eduvos's font
// files arrive.
const crest = `data:image/png;base64,${(await readFile(join(process.cwd(), "assets/brand/crest-white.png"))).toString("base64")}`;

type Props = { params: Promise<{ slug: string }> };

async function lookUp(slug: string) {
  const [seller, campuses] = await Promise.all([getSeller(slug), getCampuses()]);
  if (!seller) return null;
  return { seller, campusName: campuses.find((campus) => campus.slug === seller.campusSlug)?.name ?? "Eduvos" };
}

/**
 * One card per seller, with alt text saying who, what and where (shopping spec 4.3). An unknown seller has no card:
 * with no images, Next answers 404 instead of serving a generic card that would be cached for a year.
 */
export async function generateImageMetadata({ params }: Props) {
  const { slug } = await params;
  const found = await lookUp(slug);
  if (!found) return [];
  const alt = sellerCardAlt(found.seller.name, found.seller.category, found.campusName);
  return [{ id: "card", alt, size, contentType }];
}

/** The link preview WhatsApp shows: navy, the crest, "Vossie · {campus}", and the seller's name and tagline in white. */
export default async function Image({ params }: Props) {
  const { slug } = await params;
  const found = await lookUp(slug);
  // Capped, so long text can't run past the 630px height.
  const name = found ? shortDescription(found.seller.name, 40) : "Vossie";
  const tagline = found ? shortDescription(found.seller.tagline, 110) : "";
  const campus = found?.campusName ?? "Every Eduvos campus";

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
        <img src={crest} width={181} height={304} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
          <div style={{ fontSize: 30, letterSpacing: 2, textTransform: "uppercase" }}>{`Vossie · ${campus}`}</div>
          <div style={{ fontSize: 88, lineHeight: 1, textTransform: "uppercase" }}>{name}</div>
          {tagline && <div style={{ fontSize: 40, lineHeight: 1.2 }}>{tagline}</div>}
        </div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 4: The storefront is no longer a placeholder**

In `tests/e2e/routes.spec.ts`, delete the `["/sellers/hair-studio", "Hair studio"],` row from `PLACEHOLDERS`. The 404 test for `/sellers/nope` stays.

In `tests/e2e/performance.spec.ts`, add a row to `PAGES`, after the listing page:

```ts
  ["storefront", "/sellers/tech-corner"],
```

- [ ] **Step 5: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build lists `/sellers/[slug]` with its 29 sellers prerendered, and `/sellers/[slug]/opengraph-image/[__metadata_id__]` (or similar).

- [ ] **Step 6: Look at it**

Start the build you just made (`pnpm start --port 3201`) and check, at 390 × 844, 768 × 1024 and 1280 × 800:
- `/sellers/tech-corner`: the navy band with the round photo, the name large and white, the tagline, stamps (Midrand, Tech, Responsive), then Message (sky) and Share (white outline). About with its line break kept and "Selling since March 2026", then "2 listings". On desktop the photo, name and stamps sit left, the actions right, and About sits left of a 4-column grid.
- `/sellers/hair-studio`: the Verified stamp, sky with navy text and a tick.
- `/sellers/lash-lounge`: "Listings", then "Nothing listed right now" and "More in Hair & beauty".
- `/sellers/tech-corner/opengraph-image/card`: a 1200 × 630 PNG with the crest, "VOSSIE · MIDRAND", the name and the tagline.

Stop the server.

- [ ] **Step 7: Measure the JS**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/routes.spec.ts --project=phone-390`
Expected: all pass. Note the `scriptBrotli` figures. If any page is past **152,178 B**, stop here and report.

- [ ] **Step 8: Hand over for commit**

Files: `app/sellers/[slug]/page.tsx`, `app/sellers/[slug]/opengraph-image.tsx`, `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`.
Message: `feat: seller storefronts and their share cards (shopping spec 4). JS: / <n> B, browse <n> B, listing <n> B, storefront <n> B`

---

### Task 7: The Saved page

The heading and device note are prerendered; the list reads the saved cookie per request inside `<Suspense>` (spec 5.2 to 5.4, plan decision 1).

**Files:**
- Create: `components/saved/SavedList.tsx`, `components/saved/SavedList.test.tsx`, `components/saved/SavedSkeleton.tsx`
- Modify: `app/saved/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`

- [ ] **Step 1: Write the list's tests**

Create `components/saved/SavedList.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SavedList } from "./SavedList";

const saved = vi.hoisted(() => ({ ids: [] as string[], failing: false }));

vi.mock("@/lib/data/saved", () => ({ getSavedIds: async () => saved.ids }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getListingsByIds: async (ids: readonly string[]) => {
      if (saved.failing) throw new Error("Didn't load");
      return actual.getListingsByIds(ids);
    },
  };
});

afterEach(() => {
  saved.ids = [];
  saved.failing = false;
});

describe("SavedList (shopping spec 5.2)", () => {
  it("counts the saved listings and shows them in saved order, 5 across on desktop", async () => {
    saved.ids = ["l-007", "l-001"];
    render(await SavedList());
    expect(screen.getByText("2 saved")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Gaming headset, barely used",
      "Casio fx-991ZA Plus calculator",
    ]);
    expect(screen.getByRole("list")).toHaveAttribute("data-columns", "five");
  });

  it("keeps sold and paused listings, tagged, and drops ids that no longer exist", async () => {
    saved.ids = ["l-026", "gone", "l-016"];
    render(await SavedList());
    expect(screen.getByText("2 saved")).toBeInTheDocument();
    expect(screen.getByText("Sold")).toBeInTheDocument();
    expect(screen.getByText("Not taking orders")).toBeInTheDocument();
  });

  it("starts every heart pressed in the server's HTML (spec 5.3)", async () => {
    saved.ids = ["l-001", "l-007"];
    const html = renderToString(await SavedList());
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  });

  it("shows the empty state when nothing is saved", async () => {
    render(await SavedList());
    expect(screen.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeInTheDocument();
    expect(screen.getByText("Tap the heart on any listing to keep it here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start browsing" })).toHaveAttribute("href", "/browse");
    expect(screen.queryByText(/saved$/)).toBeNull();
  });

  it("shows the empty state when nothing saved exists any more", async () => {
    saved.ids = ["gone"];
    render(await SavedList());
    expect(screen.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeInTheDocument();
  });

  it("says when the list couldn't load, with a way to try again (spec 5.4)", async () => {
    saved.ids = ["l-001"];
    saved.failing = true;
    render(await SavedList());
    expect(screen.getByText("We couldn't load your saved listings just now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/saved");
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/saved`
Expected: FAIL, because `./SavedList` doesn't exist.

- [ ] **Step 3: Write the list and its skeleton**

Create `components/saved/SavedList.tsx`:

```tsx
import Link from "next/link";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { getCampuses, getListingsByIds } from "@/lib/data";
import { getSavedIds } from "@/lib/data/saved";

/**
 * The saved listings (shopping spec 5.2), read from the saved cookie on each request: a count, then the cards in saved
 * order, newest first. Paused and sold ones stay, tagged; ids that no longer exist are dropped. The hearts start
 * pressed, and unpressing one leaves the card in place, greyed, until the next visit (spec 5.3).
 */
export async function SavedList() {
  const ids = await getSavedIds();
  const [listings, campuses] = await Promise.all([
    getListingsByIds(ids).catch(() => null),
    getCampuses().catch(() => []),
  ]);

  if (listings === null) {
    return (
      <div className="section-error">
        <p>We couldn&apos;t load your saved listings just now.</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load, so the list is read again */}
        <a href="/saved" className="btn btn-outline text-navy">
          Try again
        </a>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <section aria-labelledby="saved-empty-title" className="saved-empty">
        <h2 id="saved-empty-title" className="saved-empty-title">
          Nothing saved yet
        </h2>
        <p>Tap the heart on any listing to keep it here.</p>
        <Link href="/browse" className="btn btn-primary">
          Start browsing
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="saved-list-title">
      <h2 id="saved-list-title" className="sr-only">
        Your saved listings
      </h2>
      <p className="saved-count">{listings.length} saved</p>
      <ListingGrid
        listings={listings}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
        columns="five"
        saved
      />
    </section>
  );
}
```

Create `components/saved/SavedSkeleton.tsx`:

```tsx
import { ListingCardSkeleton } from "@/components/listings/ListingCard";

/** Saved's shape while the list streams in (shopping spec 5.4): the count line and 8 card shapes, so nothing jumps. */
export function SavedSkeleton() {
  return (
    <div aria-hidden="true">
      <span className="skeleton saved-skeleton-count" />
      <ul className="card-grid" data-columns="five">
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

Run: `pnpm test components/saved`
Expected: PASS. If lint later reports the `eslint-disable` comment as unused, delete it (see Conventions, "Lint").

- [ ] **Step 4: The page**

Replace `app/saved/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { SavedList } from "@/components/saved/SavedList";
import { SavedSkeleton } from "@/components/saved/SavedSkeleton";

/** Saved belongs to one device, so search engines leave it out (shopping spec 5.4). */
export const metadata: Metadata = { title: "Saved", robots: { index: false } };

/**
 * Saved (shopping spec 5). The heading and device note are prerendered; the count and the list read the saved cookie
 * on each request, so they stream in behind a skeleton (plan decision 1).
 */
export default function SavedPage() {
  return (
    <div className="page saved-page">
      <h1 className="saved-title">Saved</h1>
      <p className="saved-note">Saved on this device. When sign-in arrives, your saves will follow you to any device.</p>
      <Suspense fallback={<SavedSkeleton />}>
        <SavedList />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 5: Saved's styles**

Add at the end of `app/globals.css`:

```css
/* --- Shopping: Saved (shopping plan, Task 7, spec 5.2 to 5.4) --- */
@layer components {
  /* .page and .saved-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .saved-page {
    padding: 24px 16px 64px;
  }

  .saved-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
  }

  .saved-note {
    max-width: 60ch;
    margin-top: 10px;
    color: var(--color-muted);
    font-size: 13px;
  }

  /* The skeleton's count line has the same height, so the cards land where the skeleton's were. */
  .saved-count,
  .saved-skeleton-count {
    height: 20px;
    margin-top: 20px;
  }

  .saved-count {
    color: var(--color-navy);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  .saved-skeleton-count {
    width: 5rem;
  }

  .saved-empty {
    display: grid;
    justify-items: start;
    gap: 12px;
    margin-top: 24px;
    padding: 28px 20px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  .saved-empty-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 24px;
    line-height: 1;
    text-transform: uppercase;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .saved-page {
      padding-inline: 40px;
    }
  }
}
```

- [ ] **Step 6: Saved is no longer a placeholder**

In `tests/e2e/routes.spec.ts`, delete the `["/saved", "Saved"],` row from `PLACEHOLDERS`.

In `tests/e2e/performance.spec.ts`, measure Saved with listings saved, so its cards and hearts load as they would:
1. Change `PAGES` to:

```ts
// Saved reads the saved cookie, so it's measured with two listings saved: its cards and their hearts load as they would.
const PAGES: ReadonlyArray<[name: string, path: string, saved?: string]> = [
  ["homepage", "/"],
  ["browse page", "/browse"],
  ["listing page", "/listings/l-001"],
  ["storefront", "/sellers/tech-corner"],
  ["Saved page", "/saved", "l-001.l-026"],
];
```

2. Change the loop's first line to `for (const [name, path, saved] of PAGES) {`, the test's arguments from `async ({ page }) => {` to `async ({ page, context, baseURL }) => {`, and add after the `test.skip(…)` line:

```ts
    if (saved) await context.addCookies([{ name: "vossie_saved", value: saved, url: baseURL! }]);
```

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass.

- [ ] **Step 8: Look at it**

Build and start (`pnpm build`, then `pnpm start --port 3201`). In a throwaway Playwright script, at 390 × 844 and 1280 × 800:
- `/saved` with no cookie: "Saved", the device note, then "Nothing saved yet" and Start browsing.
- `/saved` with the cookie `vossie_saved=l-001.l-026.l-016.l-007` (add it with `context.addCookies`): "4 saved", the cards 2 across on the phone and 5 on desktop, every heart filled, "Sold" on the Sharp calculator and "Not taking orders" on the lashes, at the top left of the photo.
- Tap the calculator's heart: the "Removed from saved" toast, the photo turns grey and "Removed" appears on it; the text below stays dark. Tap again: it's back to normal.

Stop the server.

- [ ] **Step 9: Measure the JS**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/routes.spec.ts --project=phone-390`
Expected: all pass. Note the `scriptBrotli` figures. If any page is past **152,178 B**, stop here and report.

- [ ] **Step 10: Hand over for commit**

Files: `components/saved/SavedList.tsx`, `components/saved/SavedList.test.tsx`, `components/saved/SavedSkeleton.tsx`, `app/saved/page.tsx`, `app/globals.css`, `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`.
Message: `feat: the Saved page, built from the saved cookie (shopping spec 5). JS: Saved <n> B`

---

### Task 8: The collection page's parts

The header, the listings with their empty and error states, "More in browse" and "More from the Hub" (spec 7.2, plan decisions 7 and 8).

**Files:**
- Create: `components/collection/CollectionHeader.tsx`, `components/collection/CollectionHeader.test.tsx`
- Create: `components/collection/CollectionBrowseLinks.tsx`, `components/collection/MoreFromHub.tsx`
- Create: `components/collection/CollectionView.tsx`, `components/collection/CollectionView.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the header's tests**

Create `components/collection/CollectionHeader.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getCollection } from "@/lib/data";
import { CollectionHeader } from "./CollectionHeader";

describe("CollectionHeader (shopping spec 7.2)", () => {
  it("shows the eyebrow, title, intro, who curated it and the count", async () => {
    render(<CollectionHeader collection={(await getCollection("moving-in"))!} count={5} />);
    expect(screen.getByText("Moving in")).toHaveClass("eyebrow");
    expect(screen.getByRole("heading", { level: 1, name: "Res setup under R500" })).toBeInTheDocument();
    expect(screen.getByText("Make your room a home without breaking the bank.")).toBeInTheDocument();
    expect(screen.getByText("Curated by the Incubation Hub")).toBeInTheDocument();
    expect(screen.getByText("5 listings")).toBeInTheDocument();
  });

  it("keeps the photo out of the reading order: the title says what it is", async () => {
    const { container } = render(<CollectionHeader collection={(await getCollection("moving-in"))!} count={5} />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("leaves the count out when the listings didn't load", async () => {
    render(<CollectionHeader collection={(await getCollection("moving-in"))!} count={null} />);
    expect(screen.queryByText(/listings?$/)).toBeNull();
  });
});
```

- [ ] **Step 2: Write the page frame's tests**

Create `components/collection/CollectionView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getCampuses, getCategories, getCollection, getCollectionListings, getCollections } from "@/lib/data";
import type { Listing } from "@/lib/types";
import { CollectionView } from "./CollectionView";

async function show(slug: string, listings?: readonly Listing[] | null) {
  const [collection, collections, categories, campuses] = await Promise.all([
    getCollection(slug),
    getCollections(),
    getCategories(),
    getCampuses(),
  ]);
  render(
    <CollectionView
      collection={collection!}
      listings={listings === undefined ? await getCollectionListings(slug) : listings}
      others={collections.filter((item) => item.slug !== slug)}
      categories={categories}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />,
  );
}

describe("CollectionView (shopping spec 7.2)", () => {
  it("shows the matching listings from every campus, each with its campus, 5 across on desktop", async () => {
    await show("moving-in");
    const grid = within(screen.getByRole("region", { name: "Listings in Res setup under R500" })).getByRole("list");
    expect(grid).toHaveAttribute("data-columns", "five");
    expect(within(grid).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/listings/l-014",
      "/listings/l-006",
      "/listings/l-027",
      "/listings/fs-003",
      "/listings/fs-005",
    ]);
    expect(within(grid).getByText("Pretoria")).toBeInTheDocument();
    expect(within(grid).getAllByText("Midrand").length).toBeGreaterThan(0);
  });

  it("links on to browse, keeping the price cap", async () => {
    await show("moving-in");
    const browse = screen.getByRole("region", { name: "More in browse" });
    expect(within(browse).getByRole("link", { name: "More in Res & living under R500" })).toHaveAttribute(
      "href",
      "/browse?cat=res-living&max=500",
    );
  });

  it("links one browse category per rule category", async () => {
    await show("skills-for-hire");
    const browse = screen.getByRole("region", { name: "More in browse" });
    expect(within(browse).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "More in Services",
      "More in Tutoring",
      "More in Hair & beauty",
    ]);
  });

  it("offers the Hub's other collections, each with its eyebrow and title", async () => {
    await show("moving-in");
    const hub = screen.getByRole("region", { name: "More from the Hub" });
    const links = within(hub).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/collections/start-of-semester",
      "/collections/exam-season",
      "/collections/skills-for-hire",
    ]);
    expect(links[0]).toHaveAccessibleName("Start of semester Back-to-campus essentials");
  });

  it("says when nothing matches, and still links on to browse", async () => {
    await show("moving-in", []);
    expect(screen.getByText("Nothing here right now")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "More in browse" })).toBeInTheDocument();
  });

  it("shows its own error when the listings didn't load, with a way back to this page", async () => {
    await show("moving-in", null);
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/collections/moving-in?retry=collection-listings#collection-listings",
    );
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test components/collection`
Expected: FAIL, because the components don't exist.

- [ ] **Step 4: Write the header**

Create `components/collection/CollectionHeader.tsx`:

```tsx
import { Photo } from "@/components/listings/Photo";
import { listingsLabel } from "@/lib/format";
import type { Collection } from "@/lib/types";

/**
 * A collection's header (shopping spec 7.2): the photo, then the eyebrow, title, intro, who curated it and the count.
 * Phones show the photo edge to edge at 4:3; from the tablet step it sits on the left at 4:5 (plan decision 7). The
 * photo is decorative: the title says what the collection is.
 */
export function CollectionHeader({ collection, count }: { collection: Collection; count: number | null }) {
  return (
    <div className="collection-head">
      <Photo
        image={{ src: collection.image.src, alt: "" }}
        sizes="(min-width: 64rem) and (min-height: 30rem) 480px, (min-width: 48rem) and (min-height: 30rem) 40vw, 100vw"
        className="collection-photo"
        priority
      />
      <div className="collection-head-text">
        <p className="eyebrow">{collection.eyebrow}</p>
        <h1 className="collection-title">{collection.title}</h1>
        <p className="collection-intro">{collection.intro}</p>
        <p className="collection-curator">Curated by the Incubation Hub</p>
        {count !== null && <p className="collection-count">{listingsLabel(count)}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write the browse links and More from the Hub**

Create `components/collection/CollectionBrowseLinks.tsx`:

```tsx
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import type { BrowseLink } from "@/lib/collections";

/** "More in browse" (shopping spec 7.2): one link per category in the collection's rule, keeping its price cap. */
export function CollectionBrowseLinks({ links }: { links: readonly BrowseLink[] }) {
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="collection-browse-title" className="collection-browse">
      <h2 id="collection-browse-title" className="listing-section-title">
        More in browse
      </h2>
      <ul className="collection-browse-list">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} prefetch={false} className="collection-browse-link">
              {link.label}
              <ArrowRightIcon className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `components/collection/MoreFromHub.tsx`:

```tsx
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { Photo } from "@/components/listings/Photo";
import type { Collection } from "@/lib/types";

/** The Hub's other collections (shopping spec 7.2): rows with a 64px thumbnail, the eyebrow and the title. */
export function MoreFromHub({ collections }: { collections: readonly Collection[] }) {
  if (collections.length === 0) return null;
  return (
    <section aria-labelledby="hub-more-title" className="hub-more">
      <h2 id="hub-more-title" className="listing-section-title">
        More from the Hub
      </h2>
      <ul className="hub-more-list">
        {collections.map((collection) => (
          <li key={collection.slug}>
            {/* No prefetch: a list of pages, most of which won't be opened (mobile data). */}
            <Link href={`/collections/${collection.slug}`} prefetch={false} className="hub-more-link">
              <Photo
                image={{ src: collection.image.src, alt: "" }}
                ratio="1 / 1"
                sizes="64px"
                className="hub-more-thumb"
              />
              <span className="hub-more-text">
                <span className="hub-more-eyebrow">{collection.eyebrow}</span>{" "}
                <span className="hub-more-title">{collection.title}</span>
              </span>
              <ArrowRightIcon className="hub-more-arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: Write the page frame**

Create `components/collection/CollectionView.tsx`:

```tsx
import type { ReactNode } from "react";
import { SectionError } from "@/components/home/SectionError";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { collectionBrowseLinks } from "@/lib/collections";
import type { Category, Collection, Listing } from "@/lib/types";
import { CollectionBrowseLinks } from "./CollectionBrowseLinks";
import { CollectionHeader } from "./CollectionHeader";
import { MoreFromHub } from "./MoreFromHub";

type CollectionViewProps = {
  collection: Collection;
  /** Null when they didn't load. */
  listings: readonly Listing[] | null;
  /** The Hub's other collections. */
  others: readonly Collection[];
  categories: readonly Category[];
  campusNames: ReadonlyMap<string, string>;
};

/**
 * A collection page (shopping spec 7.2): the header, the matching listings from every campus, then more in browse and
 * more from the Hub. With nothing matching, "Nothing here right now", and the browse links still follow.
 */
export function CollectionView({ collection, listings, others, categories, campusNames }: CollectionViewProps) {
  let body: ReactNode;
  if (listings === null) {
    body = <SectionError id="collection-listings" title="Listings" path={`/collections/${collection.slug}`} />;
  } else if (listings.length === 0) {
    body = <p className="collection-empty">Nothing here right now</p>;
  } else {
    body = <ListingGrid listings={listings} campusNames={campusNames} columns="five" />;
  }

  return (
    <div className="page collection-page">
      <CollectionHeader collection={collection} count={listings?.length ?? null} />
      <section id="collection-listings" aria-labelledby="collection-listings-title" className="collection-listings">
        <h2 id="collection-listings-title" className="sr-only">
          Listings in {collection.title}
        </h2>
        {body}
      </section>
      <CollectionBrowseLinks links={collectionBrowseLinks(collection.rule, categories)} />
      <MoreFromHub collections={others} />
    </div>
  );
}
```

Run: `pnpm test components/collection`
Expected: PASS.

- [ ] **Step 7: The collection page's styles**

In `app/globals.css`, in the data saver rule that starts `:root[data-low-data] :is(.listing-card, .seller-card, .free-card, .collections, .campus-chooser-wide, .context-thumbs) .photo-img`, add `.hub-more` to the list, after `.context-thumbs` (plan decision 8).

Then add at the end of the file:

```css
/* --- Shopping: collection pages (shopping plan, Task 8, spec 7.2) --- */
@layer components {
  /* .page and .collection-page sit on one element, so this padding is the whole content edge: 16px, then 40px. On
     phones the photo meets the header, so there's no top padding. */
  .collection-page {
    padding: 0 16px 64px;
  }

  /* Phones: edge to edge at 4:3, pulled out by the page's 16px (spec 7.2). */
  .collection-photo {
    --photo-ratio: 4 / 3;
    margin-inline: -16px;
  }

  .collection-head-text {
    display: grid;
    justify-items: start;
    gap: 8px;
    margin-top: 20px;
  }

  .collection-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .collection-intro {
    max-width: 50ch;
    color: var(--color-ink);
    font-size: 16px;
  }

  .collection-curator {
    color: var(--color-muted);
    font-size: 13px;
  }

  .collection-count {
    color: var(--color-navy);
    font-size: 14px;
    font-weight: 600;
  }

  .collection-listings {
    margin-top: 32px;
  }

  .collection-empty {
    padding: 28px 20px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 24px;
    line-height: 1;
    text-transform: uppercase;
  }

  .collection-browse,
  .hub-more {
    margin-top: 48px;
  }

  .collection-browse-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 16px;
  }

  .collection-browse-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
    color: var(--color-navy);
    font-size: 14px;
    font-weight: 600;
  }

  .hub-more-list {
    max-width: 40rem;
    margin-top: 8px;
  }

  /* Rows with a 64px thumbnail, like the homepage's collections on phones. Rows in a hairline-divided list may touch. */
  .hub-more-link {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) 22px;
    align-items: center;
    gap: 14px;
    padding-block: 12px;
    color: var(--color-navy);
  }

  .hub-more-list li + li .hub-more-link {
    border-top: 1px solid var(--color-line);
  }

  .hub-more-thumb {
    border-radius: 10px;
  }

  .hub-more-text {
    display: grid;
  }

  .hub-more-eyebrow {
    color: var(--color-sky-dark);
    font-family: var(--vos-font-display);
    font-size: var(--text-eyebrow);
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .hub-more-title {
    margin-top: 2px;
    font-family: var(--vos-font-display);
    font-size: 24px;
    line-height: 1;
    text-transform: uppercase;
  }

  .hub-more-arrow {
    width: 20px;
    height: 20px;
  }

  /* From the tablet step: the photo on the left, two-fifths wide at 4:5, and the text beside it (plan decision 7). */
  @media (min-width: 48rem) and (min-height: 30rem) {
    .collection-page {
      padding: 24px 40px 64px;
    }

    .collection-head {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      align-items: center;
      gap: 40px;
    }

    .collection-photo {
      --photo-ratio: 4 / 5;
      margin-inline: 0;
      border-radius: var(--radius-panel);
    }

    .collection-head-text {
      margin-top: 0;
    }
  }

  /* Landscape phones keep the phone layout, with the photo cropped short so it doesn't fill the screen. */
  @media (orientation: landscape) and (max-height: 29.99rem) {
    .collection-photo {
      --photo-ratio: 2 / 1;
    }
  }
}
```

- [ ] **Step 8: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass. (The page arrives in Task 9.)

- [ ] **Step 9: Hand over for commit**

Files: `components/collection/CollectionHeader.tsx`, `components/collection/CollectionHeader.test.tsx`, `components/collection/CollectionBrowseLinks.tsx`, `components/collection/MoreFromHub.tsx`, `components/collection/CollectionView.tsx`, `components/collection/CollectionView.test.tsx`, `app/globals.css`.
Message: `feat: the collection header, browse links and more from the Hub (shopping spec 7.2)`

---

### Task 9: The collection page

**Files:**
- Modify: `app/collections/[slug]/page.tsx`
- Modify: `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`

- [ ] **Step 1: The page**

Replace `app/collections/[slug]/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CollectionView } from "@/components/collection/CollectionView";
import { getCampuses, getCategories, getCollection, getCollectionListings, getCollections } from "@/lib/data";

/**
 * The tab title is the collection's ("Res setup under R500 · Vossie"; the layout adds the suffix) and the description
 * its intro (shopping spec 7.2). An unknown slug gets the 404's title.
 */
export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return { title: "Page not found" };
  return { title: collection.title, description: collection.intro };
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
  const [collection, collections, categories, campuses, listings] = await Promise.all([
    getCollection(slug),
    getCollections(),
    getCategories(),
    getCampuses(),
    getCollectionListings(slug).catch(() => null),
  ]);
  if (!collection) notFound();
  return (
    <CollectionView
      collection={collection}
      listings={listings}
      others={collections.filter((item) => item.slug !== slug)}
      categories={categories}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />
  );
}
```

- [ ] **Step 2: Collections are no longer placeholders**

In `tests/e2e/routes.spec.ts`, delete the `["/collections/exam-season", "Notes, tutors & cram snacks"],` row from `PLACEHOLDERS`. The 404 test for `/collections/nope` stays.

In `tests/e2e/performance.spec.ts`, add a row to `PAGES`, after the Saved page:

```ts
  ["collection page", "/collections/start-of-semester"],
```

(Back-to-campus essentials has the most cards, 12, so it's the heaviest collection.)

- [ ] **Step 3: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build lists `/collections/[slug]` with its 4 collections prerendered.

- [ ] **Step 4: Look at it**

Start the build (`pnpm start --port 3201`) and check, at 390 × 844, 768 × 1024 and 1280 × 800, and once at 844 × 390 (a landscape phone):
- `/collections/moving-in`: on the phone the photo runs to both screen edges at 4:3, right under the header, with the eyebrow, title, intro, "Curated by the Incubation Hub" and "5 listings" below. On the tablet and desktop the photo sits on the left at 4:5 with the text beside it. On the landscape phone the photo is short (2:1).
- The 5 cards (2, 3 and 5 across), each with its campus; "More in browse" with one pill, "More in Res & living under R500"; "More from the Hub" with three rows, each a thumbnail, eyebrow and title.
- From the homepage, a collection link opens its page.

Stop the server.

- [ ] **Step 5: Measure the JS**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/routes.spec.ts --project=phone-390`
Expected: all pass. Note the `scriptBrotli` figures. If any page is past **152,178 B**, stop here and report.

- [ ] **Step 6: Hand over for commit**

Files: `app/collections/[slug]/page.tsx`, `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`.
Message: `feat: collection pages fill themselves from their rules (shopping spec 7.2). JS: collection <n> B`

---

### Task 10: End-to-end tests for the three pages

**Files:**
- Create: `tests/e2e/shopping.spec.ts`

- [ ] **Step 1: Write the tests**

Create `tests/e2e/shopping.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

/** The cards on the page that's showing. Next keeps the last few pages hidden in the DOM for Back, cards and all. */
const cards = (page: Page) => page.locator("main article").filter({ visible: true });

/** One card, found by its title. */
const card = (page: Page, title: string) => cards(page).filter({ hasText: title });

test.describe("the seller storefront (spec 4)", () => {
  test("shows the band, About and the seller's listings", async ({ page }) => {
    await page.goto("/sellers/tech-corner");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech corner");
    await expect(page.getByText("Calculators, headsets and chargers, tested before you buy.")).toBeVisible();
    await expect(page.locator(".seller-stamps li")).toHaveText(["Midrand", "Tech", "Responsive"]);
    await expect(page.getByRole("heading", { level: 2, name: "About" })).toBeVisible();
    await expect(page.getByText("Selling since March 2026")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "2 listings" })).toBeVisible();
    await expect(cards(page).getByRole("link")).toHaveText([
      "Casio fx-991ZA Plus calculator",
      "Gaming headset, barely used",
    ]);
    await expect(page).toHaveTitle("Tech corner · Vossie");
  });

  test("puts About beside the listings, 4 across, on desktop", async ({ page }) => {
    onlyAt("laptop-1024", "desktop-1440");
    await page.goto("/sellers/tech-corner");
    const about = (await page.getByRole("region", { name: "About" }).boundingBox())!;
    const listings = (await page.getByRole("region", { name: "2 listings" }).boundingBox())!;
    expect(about.x + about.width).toBeLessThanOrEqual(listings.x);
    const columns = await page
      .locator(".card-grid")
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(4);
  });

  test("stamps a verified seller", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/sellers/hair-studio");
    await expect(page.locator(".seller-stamps li")).toHaveText(["Midrand", "Hair & beauty", "Verified", "Trusted"]);
  });

  test("Message goes through the sign-in page and back", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/sellers/tech-corner");
    await page.getByRole("link", { name: "Message seller" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsellers%2Ftech-corner$/);
    await page.getByRole("link", { name: "Go back" }).click();
    await expect(page).toHaveURL(/\/sellers\/tech-corner$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech corner");
  });

  test("says when a seller has nothing listed, and points to their category", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/sellers/lash-lounge");
    await expect(page.getByRole("heading", { level: 2, name: "Listings" })).toBeVisible();
    await expect(page.getByText("Nothing listed right now")).toBeVisible();
    await page.getByRole("link", { name: "More in Hair & beauty" }).click();
    await expect(page).toHaveURL(/\/browse\?cat=hair-beauty$/);
  });

  test("each seller has a share card for link previews", async ({ page, request, baseURL }) => {
    onlyAt("desktop-1440");
    await page.goto("/sellers/tech-corner");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Tech corner · Midrand on Vossie");
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      "content",
      "Tech corner, Tech at Midrand on Vossie",
    );
    // As on the listing page: without a metadataBase the card's URL names another port, and the browser adds a
    // second og:image after hydration, so read the first (the server's) and fetch its path from the test server.
    const cardUrl = new URL((await page.locator('meta[property="og:image"]').first().getAttribute("content"))!);
    const response = await request.get(new URL(`${cardUrl.pathname}${cardUrl.search}`, baseURL).toString());
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    // An unknown seller has no card.
    const missing = await request.get(new URL(cardUrl.pathname.replace("tech-corner", "nope"), baseURL).toString());
    expect(missing.status()).toBe(404);
  });
});

test.describe("Saved (spec 5)", () => {
  test("a listing saved on its page shows up on Saved, even when Saved was open before", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    // Open Saved first, so Next keeps it hidden for Back: coming back to it by a link must still show the new save.
    await page.goto("/saved");
    await expect(page.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeVisible();
    await page.getByRole("link", { name: "Start browsing" }).click();
    await expect(page).toHaveURL(/\/browse$/);
    await page.getByRole("link", { name: "Casio fx-991ZA Plus calculator" }).click();
    await expect(page).toHaveURL(/\/listings\/l-001$/);

    await page.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" }).click();
    const savedLink = page.locator(".site-header").getByRole("link", { name: "Saved, 1 item" });
    await expect(savedLink).toBeVisible();
    await savedLink.click();

    await expect(page).toHaveURL(/\/saved$/);
    await expect(page.getByText("1 saved", { exact: true })).toBeVisible();
    await expect(cards(page).getByRole("link")).toHaveText(["Casio fx-991ZA Plus calculator"]);
    await expect(cards(page).getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("removing a listing greys its card until the next visit", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_saved", value: "l-001.l-007", url: baseURL! }]);
    await page.goto("/saved");
    await expect(page.getByText("2 saved", { exact: true })).toBeVisible();
    const calculator = card(page, "Casio fx-991ZA Plus calculator");
    const heart = calculator.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" });
    const removed = calculator.getByText("Removed", { exact: true });
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await expect(removed).toBeHidden();

    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".toast")).toHaveText("Removed from saved");
    await expect(removed).toBeVisible();
    await expect(calculator.locator(".listing-photo")).toHaveCSS("filter", "grayscale(1)");
    await expect(calculator.locator(".listing-title")).not.toHaveCSS("opacity", "0.6");

    // Another tap saves it back.
    await heart.click();
    await expect(removed).toBeHidden();

    await heart.click();
    await page.reload();
    await expect(page.getByText("1 saved", { exact: true })).toBeVisible();
    await expect(cards(page)).toHaveCount(1);
    await expect(card(page, "Casio fx-991ZA Plus calculator")).toHaveCount(0);
  });

  test("keeps sold and paused listings, tagged, and drops ones that no longer exist", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_saved", value: "l-026.gone.l-016", url: baseURL! }]);
    await page.goto("/saved");
    await expect(page.getByText("2 saved", { exact: true })).toBeVisible();
    await expect(card(page, "Sharp scientific calculator").getByText("Sold", { exact: true })).toBeVisible();
    await expect(card(page, "Lash extensions, classic set").getByText("Not taking orders")).toBeVisible();
  });

  test("with nothing saved, says so and points to browse", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/saved");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saved");
    await expect(page.getByText("Saved on this device. When sign-in arrives")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeVisible();
    await page.getByRole("link", { name: "Start browsing" }).click();
    await expect(page).toHaveURL(/\/browse$/);
  });

  test("the hearts start pressed before the app's JavaScript arrives (spec 5.3)", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    // The app's bundle never arrives. React's small inline script still puts the streamed list in place.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await context.addCookies([{ name: "vossie_saved", value: "l-001", url: baseURL! }]);
    await page.goto("/saved");
    const calculator = card(page, "Casio fx-991ZA Plus calculator");
    await expect(calculator.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(calculator.getByText("Removed", { exact: true })).toBeHidden();
  });

  test("stays out of search engines", async ({ page }) => {
    onlyAt("desktop-1440");
    await page.goto("/saved");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(page).toHaveTitle("Saved · Vossie");
  });
});

test.describe("collection pages (spec 7.2)", () => {
  test("Res setup under R500 shows res listings at R500 or less, from every campus", async ({ page }) => {
    await page.goto("/collections/moving-in");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Res setup under R500");
    await expect(page.getByText("Make your room a home without breaking the bank.")).toBeVisible();
    await expect(page.getByText("Curated by the Incubation Hub")).toBeVisible();
    await expect(page.getByText("5 listings", { exact: true })).toBeVisible();
    const hrefs = await cards(page)
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual(["/listings/l-014", "/listings/l-006", "/listings/l-027", "/listings/fs-003", "/listings/fs-005"]);
    await expect(page).toHaveTitle("Res setup under R500 · Vossie");
  });

  test("runs the photo edge to edge on phones, and beside the text from the tablet step", async ({ page }) => {
    await page.goto("/collections/moving-in");
    const photo = (await page.locator(".collection-photo").boundingBox())!;
    if (project().startsWith("phone-")) {
      expect(photo.x).toBe(0);
      expect(Math.round(photo.width)).toBe(page.viewportSize()!.width);
    } else {
      const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(photo.x + photo.width).toBeLessThanOrEqual(title.x);
    }
  });

  test("links on to browse, keeping the price cap", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/collections/moving-in");
    await page.getByRole("link", { name: "More in Res & living under R500" }).click();
    await expect(page).toHaveURL(/\/browse\?cat=res-living&max=500$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Res & living");
  });

  test("offers the Hub's other collections", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/collections/moving-in");
    const more = page.getByRole("region", { name: "More from the Hub" });
    await expect(more.getByRole("link")).toHaveText([
      /Back-to-campus essentials/,
      /Notes, tutors & cram snacks/,
      /Book a student/,
    ]);
    await more.getByRole("link", { name: /Book a student/ }).click();
    await expect(page).toHaveURL(/\/collections\/skills-for-hire$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Book a student");
  });

  test("the homepage's collections open their pages", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await page.locator(".collections").getByRole("link", { name: /Res setup under R500/ }).click();
    await expect(page).toHaveURL(/\/collections\/moving-in$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Res setup under R500");
  });
});
```

- [ ] **Step 2: Run them**

Run: `pnpm e2e tests/e2e/shopping.spec.ts`
Expected: all pass at every size they run at; the rest are skipped by design.

If "a listing saved on its page shows up on Saved, even when Saved was open before" fails because Saved still shows "Nothing saved yet", that's a real bug (Next showing the hidden page's old list on a link visit), not a test problem: stop and report it with the trace, rather than changing the test to a full page load.

If a locator is ambiguous (a strict-mode error naming two elements), make it exact the way the browse and listing tests did, and note it for the plan's "Changes made during the build".

- [ ] **Step 3: Hand over for commit**

Files: `tests/e2e/shopping.spec.ts`.
Message: `test: storefront, Saved and collection pages end to end`

---

### Task 11: Accessibility and layout shift

**Files:**
- Modify: `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`

- [ ] **Step 1: Run axe on each new page and state**

Add to the end of `tests/e2e/a11y.spec.ts`:

```ts
test("a storefront", async ({ page }) => {
  await page.goto("/sellers/tech-corner");
  await expect(page.getByRole("heading", { level: 2, name: "2 listings" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a verified storefront", async ({ page }) => {
  await page.goto("/sellers/hair-studio");
  await expect(page.locator(".seller-verified")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a storefront with nothing listed", async ({ page }) => {
  await page.goto("/sellers/lash-lounge");
  await expect(page.getByText("Nothing listed right now")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("Saved, with sold and paused listings and one removed", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_saved", value: "l-001.l-026.l-016", url: baseURL! }]);
  await page.goto("/saved");
  const heart = page.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" });
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  expect(await seriousIssues(page)).toEqual([]);
});

test("Saved with nothing saved", async ({ page }) => {
  await page.goto("/saved");
  await expect(page.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a collection", async ({ page }) => {
  await page.goto("/collections/moving-in");
  await expect(page.getByText("5 listings", { exact: true })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});
```

- [ ] **Step 2: Measure layout shift on each new page**

In `tests/e2e/cls.spec.ts`, pages can now carry a saved list as well as a campus:

1. Replace the comment above `PAGES` and `PAGES` itself with:

```ts
// A campus (the `vossie_campus` cookie) changes what the page shows and where the campus note, the empty state and the
// results fall, so those pages are measured with one chosen too. Midrand has results; Mbombela has none. Saved reads
// the `vossie_saved` cookie, so it's measured with listings saved and with none.
const PAGES: ReadonlyArray<[name: string, path: string, cookies?: Readonly<Record<string, string>>]> = [
  ["homepage", "/"],
  ["browse page", "/browse"],
  ["listing page", "/listings/l-001"],
  ["listing page (campus pretoria)", "/listings/l-001", { vossie_campus: "pretoria" }],
  ["browse page (campus midrand)", "/browse", { vossie_campus: "midrand" }],
  ["browse page (campus mbombela)", "/browse", { vossie_campus: "mbombela" }],
  ["storefront", "/sellers/tech-corner"],
  ["storefront (nothing listed)", "/sellers/lash-lounge"],
  ["Saved page", "/saved", { vossie_saved: "l-001.l-026.l-016.l-007.l-004.l-009" }],
  ["Saved page (nothing saved)", "/saved"],
  ["collection page", "/collections/start-of-semester"],
];
```

2. Change `for (const [name, path, campus] of PAGES) {` to `for (const [name, path, cookies] of PAGES) {`, and replace the line `if (campus) await context.addCookies([{ name: "vossie_campus", value: campus, url: baseURL! }]);` with:

```ts
    if (cookies) {
      await context.addCookies(Object.entries(cookies).map(([cookie, value]) => ({ name: cookie, value, url: baseURL! })));
    }
```

The existing pages keep their names, so their results stay comparable.

- [ ] **Step 3: Run them**

Run: `pnpm e2e tests/e2e/a11y.spec.ts tests/e2e/cls.spec.ts`
Expected: all pass. Note each new page's layout shift at 390 and 1440 for `docs/PROGRESS.md`.

If axe reports a serious or critical issue, fix the cause in the component or CSS (not the test), and note it for the plan's "Changes made during the build". If a page's layout shift is over 0.05, the log line names the moving nodes: usually a skeleton that doesn't match (Saved) or a photo box without its ratio.

- [ ] **Step 4: Hand over for commit**

Files: `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`, and any component or CSS file a fix touched.
Message: `test: accessibility and layout shift for the storefront, Saved and collection pages`

---

### Task 12: Review screenshots, docs and final checks

**Files:**
- Modify: `tests/e2e/screenshots.spec.ts`
- Create: `docs/progress/shopping/*.png`
- Modify: `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `CLAUDE.md`, the spec (`docs/superpowers/specs/2026-10-13-shopping-pages-design.md`)
- Modify: this plan (the ledger and a "Changes made during the build" section)

- [ ] **Step 1: Add the review screenshots**

Add to the end of `tests/e2e/screenshots.spec.ts`:

```ts
test("shopping review screenshots", async ({ page, context, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/shopping/${project}-${name}.png`;

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

  // Saved streams its list behind a skeleton, so each shot waits for something the finished page shows.
  const title = page.getByRole("heading", { level: 1 });

  await page.goto("/sellers/tech-corner");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("01-storefront"), fullPage: true });

  await page.goto("/sellers/hair-studio");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("02-storefront-verified") });

  await page.goto("/sellers/lash-lounge");
  await expect(page.getByText("Nothing listed right now")).toBeVisible();
  await page.screenshot({ path: file("03-storefront-empty"), fullPage: true });

  await context.addCookies([{ name: "vossie_saved", value: "l-001.l-026.l-016.l-007.l-004", url: baseURL! }]);
  await page.goto("/saved");
  await expect(page.getByText("5 saved", { exact: true })).toBeVisible();
  await settle();
  await page.screenshot({ path: file("04-saved"), fullPage: true });

  const calculator = page.locator("main article").filter({ hasText: "Casio fx-991ZA Plus calculator" });
  await calculator.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" }).click();
  await expect(calculator.getByText("Removed", { exact: true })).toBeVisible();
  await page.screenshot({ path: file("05-saved-removed") });
  await context.clearCookies();

  await page.goto("/saved");
  await expect(page.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeVisible();
  await page.screenshot({ path: file("06-saved-empty") });

  await page.goto("/collections/moving-in");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("07-collection"), fullPage: true });

  await page.goto("/collections/start-of-semester");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("08-collection-first-screen") });
});
```

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "shopping review screenshots"`
Expected: 16 PNGs in `docs/progress/shopping/`. Open a few and check they show what their names say.

- [ ] **Step 2: Bring the spec in line with the build**

In `docs/superpowers/specs/2026-10-13-shopping-pages-design.md`:
- Status: "Built (2026-10-<day>)".
- Section 5.2, item 1: the device note sits under the heading, and the count line ("3 saved") streams in with the list, above the cards (plan decision 1).
- Section 7.2, item 1: the photo sits beside the text from the tablet step; landscape phones crop it to 2:1 (plan decision 7).
- Section 4.1, the trust badge: a white pill with navy text on the band (plan decision 17).
- Anything else the build changed, from this plan's "Changes made during the build".

In `docs/reference/LANDING-DECISIONS.md`, add a row after 51 for the plan decisions that changed the spec, as Lama confirmed them at plan review, in the log's style:

```markdown
| 52 | 2026-10-<day> | Shopping plan decisions that change the spec | **Saved's count streams in with the list, under the device note; the collection header sits side by side from the tablet step; the band's trust badge is a white pill** | Plan decisions 1, 7 and 17 in `2026-10-13-shopping-pages.md`. The spec now says so. Lama, at plan review |
```

Name in it any other plan decision Lama changed or kept on purpose (plan decision 10, the browse links' campus, is the likeliest), and any JS figure Lama accepted under the stop rule.

- [ ] **Step 3: Update the checklist, CLAUDE.md and the progress log**

In `docs/reference/GO-LIVE.md`:
- The seller storefront and collection rows become **Built**.
- The Saved row becomes **Built (followed sellers wait for accounts)**.
- In "Suggested order", item 2 becomes: `**Now, the other public pages:** the storefront, Saved and collections are done (2026-10-<day>). Next: the Looking For board and Hub to read, info and legal pages, and the error page.`

In `CLAUDE.md`:
- In "Code rules", the device preferences line becomes: `- Device preferences (campus cookie \`vossie_campus\`, saved cookie \`vossie_saved\`, recent searches, data saver) go through the stores in \`lib/\` and \`useSyncExternalStore\`.`
- In "Privacy (POPIA)", the first bullet becomes: `- Collect the minimum. This stage stores nothing on a server: the campus choice and saved listings are first-party cookies, and recent searches stay in the browser.`

In `docs/PROGRESS.md`, add a section before "Next", in the style of the earlier ones:

```markdown
## 2026-10-<day>: Shopping pages built (storefront, Saved, collections)
- **Seller storefronts** (`/sellers/[slug]`): a navy poster band with the seller's photo, name, tagline, stamps for campus, category, Verified and their badge, then Message (to the sign-in placeholder) and Share. About with "Selling since", their listings (4 across on desktop, beside About), an empty state that points to their category, and Report. Each seller has a share card.
- **Saved** (`/saved`): saves now live in a first-party cookie, so the server builds the page. Cards show in saved order with their hearts pressed; sold and paused ones are tagged; removing one greys it until the next visit. Empty and error states; not indexed.
- **Collections** (`/collections/[slug]`): each is a rule (categories and a price cap) that fills itself from every campus. Header with the photo, intro and count, the listings, "More in browse" links that keep the cap, and the Hub's other collections.
- **Data:** sellers gain an about, a start month, their trust badge and a category slug; seven listings' badges now match their seller's. `ListingGrid` is shared by the new pages and the listing page's More from (3 across on tablets now).
- **Plan decisions Lama may want to revisit:** <list any of the 16 that came up in review, or "none">.
- **Checks:**
  - lint and types are clean;
  - <n> unit tests pass;
  - end to end, <n> pass, <n> are skipped by design and none fail;
  - axe finds no serious or critical issues.
- **First visit at 390px, JS brotli:** homepage <n> B, browse <n> B, listing <n> B, storefront <n> B, Saved <n> B, collection <n> B (limit 153,600 B; stop line 152,178 B).
- **Layout shift** (fonts held back, at 390 and 1440px): <table of the new pages>.
- Review screenshots: `docs/progress/shopping/`.
```

Fill in the numbers from your runs. Then replace "Next" with:

```markdown
## Next
- Lama reviews the screenshots in `docs/progress/shopping/`. To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "shopping review screenshots"`.
- Then part B of the other public pages: Looking For and the Hub.
```

- [ ] **Step 4: Record what changed during the build**

Fill in this plan's JS ledger, and add a "Changes made during the build" section after it, listing every place the build differed from the tasks as written, with the commit that made each change.

- [ ] **Step 5: Final checks**

Run, one after another: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`.
Expected: all pass. Record the unit and e2e counts in `docs/PROGRESS.md`.

- [ ] **Step 6: Hand over for commit**

Files: `tests/e2e/screenshots.spec.ts`, `docs/progress/shopping/`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-13-shopping-pages-design.md`, this plan.
Message: `docs: shopping pages review screenshots, progress, checklist, CLAUDE.md privacy line and the spec brought in line`
