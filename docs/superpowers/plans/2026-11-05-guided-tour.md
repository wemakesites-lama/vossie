# Guided tour, phase 1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Show me around this page" tour for Home, Shop, a listing, Sell and You: started from the menu or Home's one-time nudge, drawn by a small engine that loads only on tap.

**Architecture:** Pages mark themselves (`data-tour-page`) and their parts (`data-tour`) in server markup. A 200 B `TourHost` in the root layout listens on the overlay bus for `"tour"` and lazy-loads `components/tour/Tour.tsx`, a native modal `<dialog>` that dims the page around one part with a box-shadow window and places a card with pure `placeCard`. The steps' words live in `lib/tour/tours.ts`, imported only by the engine. A step whose part isn't on screen is skipped, so one tour fits every role and screen size.

**Tech Stack:** Next.js 16.4 App Router, React 19.3 (`lazy`, `useEffectEvent`), Tailwind CSS 4.3 tokens in `app/globals.css`, Vitest 5 + jsdom, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-05-guided-tour-design.md` (decision 99). Its section 12 lists where this plan departs from the first draft; build to section 12 where they differ.

**House rules for every task:**
- No `#fff`, `white` or `navy` literals in CSS; tokens only. Fonts only through `var(--vos-font-*)` or `font-*` classes.
- Animate only `transform` and `opacity`. The global motion switches in `app/globals.css` (reduced motion, `html[data-low-data]`) already stop the card's animation; don't add `.motion-own`.
- Implementers leave work uncommitted. The controller checks each task, stages only that task's files (`git add <paths>`, never `git add -A`: Lama's own `.claude/launch.json`, `docs/PROGRESS.md` and `docs/pitch/` changes are in the tree), and commits only with Lama's go-ahead. One git command at a time.
- Stop only a server you started, by its port or PID.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `lib/tour/targets.ts` | create | `TOUR_IDS`, `TourId`, `TourTarget`, `StepTarget`, `isTourId`. Types and one tiny array: pages and the menu import it. |
| `lib/tour/seen.ts` | create | `vossie_tour_seen` key, `data-toured` attribute, `markTourSeen()`. Shared by the boot script and client code. |
| `lib/tour/resolve.ts` | create | `isShown`, `findTourPage`, `finderFor`, `pickTarget`, `resolveSteps`. |
| `lib/tour/place.ts` | create | `placeCard`, pure. |
| `lib/tour/tours.ts` | create | `TOURS` (the words), `TourStep`, `NOTHING_HERE`. Engine chunk only. |
| `lib/tour/*.test.ts` | create | Unit tests for the above, plus `markup.test.ts` reading the folders. |
| `components/tour/TourHost.tsx` | create | Lazy-loads the engine on `openOverlay("tour")`. |
| `components/tour/Tour.tsx` | create | The engine (default export, for `lazy`). |
| `components/home/TourNudge.tsx`, `TourNudgeButtons.tsx` | create | Home's invitation. |
| `lib/overlays.ts` | modify | Add `"tour"`. |
| `lib/boot-script.ts` (+ test) | modify | Read `vossie_tour_seen` before first paint. |
| `app/layout.tsx` | modify | Mount `<TourHost />`. |
| `app/globals.css` | modify | `--color-scrim`, `--color-tour-ring` in three themes; the tour and nudge CSS. |
| `lib/theme-contrast.test.ts` | modify | Ring against the dim, three themes. |
| `components/menu/MenuDrawer.tsx` | modify | The "Show me around this page" row. |
| `components/tabbar/TabBar.tsx`, `components/header/SiteHeader.tsx`, `CampusPill.tsx`, `SavedLink.tsx`, `AccountLink.tsx`, `components/campus/CampusPickerButton.tsx`, `components/home/hero/HeroCampusChip.tsx`, `components/kit/SectionBar.tsx`, `components/kit/sections.tsx` | modify | `data-tour` on shared chrome. |
| `app/page.tsx`, `app/browse/page.tsx`, `components/browse/{CategoryTabs,BrowseToolbar,SaveSearchControl}.tsx`, `components/listing/{ListingView,Gallery,SellerCard,ListingActions}.tsx`, `components/sell/Dashboard.tsx`, `components/account/AccountView.tsx` | modify | `data-tour-page` and `data-tour` on the five pages. |
| `app/privacy/page.tsx` | modify | Name `vossie_tour_seen`. |
| `tests/e2e/tour.spec.ts` | create | End-to-end, device projects. |

---

### Task 1: Names and the seen key

**Files:**
- Create: `lib/tour/targets.ts`
- Create: `lib/tour/seen.ts`
- Test: `lib/tour/seen.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/tour/seen.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { markTourSeen, TOUR_SEEN_ATTR, TOUR_SEEN_KEY } from "./seen";

afterEach(() => {
  localStorage.removeItem(TOUR_SEEN_KEY);
  document.documentElement.removeAttribute(TOUR_SEEN_ATTR);
  vi.restoreAllMocks();
});

describe("markTourSeen (guided tour spec 3.5)", () => {
  it("remembers the tour and hides Home's invitation at once", () => {
    markTourSeen();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe("1");
    expect(document.documentElement.hasAttribute(TOUR_SEEN_ATTR)).toBe(true);
  });

  it("still hides the invitation for this visit when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    expect(() => markTourSeen()).not.toThrow();
    expect(document.documentElement.hasAttribute(TOUR_SEEN_ATTR)).toBe(true);
  });

  it("is named vossie_…, so the privacy page must list it", () => {
    expect(TOUR_SEEN_KEY).toBe("vossie_tour_seen");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/tour/seen.test.ts`
Expected: FAIL, `Failed to resolve import "./seen"`.

- [ ] **Step 3: Write `lib/tour/seen.ts`**

```ts
/**
 * Whether Home's tour invitation has been answered (guided tour spec 3.5 and 8). A module of its own, holding names
 * and one small function, so the boot script (server code written into <head>) and the nudge's buttons (client code)
 * share the names without client code importing lib/boot-script.ts (see lib/install-event.ts).
 */
export const TOUR_SEEN_KEY = "vossie_tour_seen";
export const TOUR_SEEN_ATTR = "data-toured";

/** Marks <html> so CSS hides the invitation now, and remembers it for the next visit. */
export function markTourSeen(): void {
  document.documentElement.setAttribute(TOUR_SEEN_ATTR, "");
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // Storage blocked: the invitation is still hidden for this visit.
  }
}
```

- [ ] **Step 4: Write `lib/tour/targets.ts`**

```ts
/**
 * The guided tour's names (guided tour spec 5). Pages and the menu import this, so it holds types, one short array
 * and one check: nothing else. The steps' words are in lib/tour/tours.ts, which only the tour's own chunk imports.
 */
export const TOUR_IDS = ["home", "browse", "listing", "sell", "you"] as const;
export type TourId = (typeof TOUR_IDS)[number];

/** Every part a step can point at, written in markup as data-tour="…". */
export type TourTarget =
  | "search"
  | "hero-campus"
  | "hdr-campus"
  | "tab-shop"
  | "hdr-shop"
  | "tab-sell"
  | "hdr-sell"
  | "tab-myshop"
  | "tab-mentoring"
  | "tab-today"
  | "tab-saved"
  | "hdr-saved"
  | "tab-messages"
  | "tab-you"
  | "hdr-account"
  | "menu"
  | "browse-categories"
  | "browse-filters"
  | "browse-sort"
  | "browse-save-search"
  | "listing-gallery"
  | "listing-seller"
  | "listing-actions"
  | "listing-report"
  | "sell-needs-you"
  | "sell-coach"
  | "sell-add"
  | "sell-listings"
  | "sell-bar"
  | "you-for-you"
  | "you-stuff"
  | "you-settings";

/** One part, or a list where the first one on screen wins (a phone tab, then its header link). */
export type StepTarget = TourTarget | readonly TourTarget[];

export function isTourId(value: string | undefined): value is TourId {
  return (TOUR_IDS as readonly string[]).includes(value ?? "");
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm test lib/tour/seen.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit (controller)**

```bash
git add lib/tour/targets.ts lib/tour/seen.ts lib/tour/seen.test.ts
```
```bash
git commit -m "feat: the guided tour's names and seen key (decision 99)"
```

---

### Task 2: Finding the page and its parts

**Files:**
- Create: `lib/tour/resolve.ts`
- Test: `lib/tour/resolve.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/tour/resolve.test.ts`. jsdom has no layout, so every function takes a `shown` check; the tests pass one that treats anything inside `[hidden]` as off screen.

```ts
import { afterEach, describe, expect, it } from "vitest";
import { finderFor, findTourPage, pickTarget, resolveSteps } from "./resolve";

const shown = (element: Element) => element.closest("[hidden]") === null;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findTourPage (guided tour spec 6.1)", () => {
  it("takes the page that's showing, not one Next kept hidden", () => {
    document.body.innerHTML = `
      <div hidden><div data-tour-page="browse"></div></div>
      <div data-tour-page="home"></div>`;
    expect(findTourPage(document, shown)?.id).toBe("home");
  });

  it("ignores an unknown tour id", () => {
    document.body.innerHTML = `<div data-tour-page="nope"></div>`;
    expect(findTourPage(document, shown)).toBeNull();
  });

  it("finds nothing on a page without a tour", () => {
    document.body.innerHTML = `<div class="page"></div>`;
    expect(findTourPage(document, shown)).toBeNull();
  });
});

describe("finderFor", () => {
  it("looks in the page, then in the shared header, tab bar and section shell", () => {
    document.body.innerHTML = `
      <header class="site-header"><button data-tour="search"></button></header>
      <div data-tour-page="home"><div data-tour="hero-campus"></div></div>
      <nav class="tabbar"><a data-tour="tab-shop"></a></nav>
      <div class="other"><a data-tour="tab-saved"></a></div>`;
    const page = findTourPage(document, shown)!.page;
    const find = finderFor(document, page, shown);
    expect(find("search")).not.toBeNull();
    expect(find("hero-campus")).not.toBeNull();
    expect(find("tab-shop")).not.toBeNull();
    expect(find("tab-saved"), "outside the page and the chrome").toBeNull();
  });

  it("skips a copy that's off screen and takes the one showing", () => {
    document.body.innerHTML = `
      <div data-tour-page="sell">
        <nav hidden data-tour="sell-bar" id="side"></nav>
        <nav data-tour="sell-bar" id="bar"></nav>
      </div>`;
    const find = finderFor(document, findTourPage(document, shown)!.page, shown);
    expect(find("sell-bar")?.id).toBe("bar");
  });
});

describe("pickTarget and resolveSteps (spec 3.3)", () => {
  function setUp() {
    document.body.innerHTML = `
      <header class="site-header"><button data-tour="search"></button><a data-tour="hdr-sell" hidden></a></header>
      <div data-tour-page="home"></div>
      <nav class="tabbar"><a data-tour="tab-myshop"></a></nav>`;
    return finderFor(document, findTourPage(document, shown)!.page, shown);
  }

  it("takes the first target on screen from a list", () => {
    const find = setUp();
    expect(pickTarget(["tab-sell", "hdr-sell", "tab-myshop"], find)?.dataset.tour).toBe("tab-myshop");
  });

  it("drops a step whose part isn't on screen, keeping the order", () => {
    const find = setUp();
    const steps = [
      { target: "search" as const, title: "a" },
      { target: ["tab-sell", "hdr-sell"] as const, title: "b" },
      { target: "tab-myshop" as const, title: "c" },
    ];
    expect(resolveSteps(steps, find).map(({ step }) => step.title)).toEqual(["a", "c"]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/tour/resolve.test.ts`
Expected: FAIL, `Failed to resolve import "./resolve"`.

- [ ] **Step 3: Write `lib/tour/resolve.ts`**

```ts
import { isTourId, type StepTarget, type TourId, type TourTarget } from "./targets";

/** Whether an element is on screen. Injectable, because jsdom has no layout. */
export type Shown = (element: Element) => boolean;
export type Find = (target: TourTarget) => HTMLElement | null;

/**
 * On screen: rendered (not inside a page Next keeps hidden, not display: none at this size) and with a box (guided
 * tour spec 6.1).
 */
export function isShown(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return element.checkVisibility() && box.width > 0 && box.height > 0;
}

/** The shared chrome a step may point into, beside the page itself: the header, the tab bar and a section's bar. */
const CHROME = ".site-header, .tabbar, .section-shell";

/** The toured page that's showing. Next keeps pages you've left in the DOM, hidden, so only a visible one counts. */
export function findTourPage(doc: Document, shown: Shown = isShown): { id: TourId; page: HTMLElement } | null {
  for (const page of doc.querySelectorAll<HTMLElement>("[data-tour-page]")) {
    const id = page.dataset.tourPage;
    if (isTourId(id) && shown(page)) return { id, page };
  }
  return null;
}

/** Finds a part on screen: in the page first, then in the chrome. */
export function finderFor(doc: Document, page: HTMLElement, shown: Shown = isShown): Find {
  const roots: ParentNode[] = [page, ...doc.querySelectorAll(CHROME)];
  return (target) => {
    for (const root of roots) {
      for (const element of root.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
        if (shown(element)) return element;
      }
    }
    return null;
  };
}

/** The first of a step's targets that's on screen. */
export function pickTarget(target: StepTarget, find: Find): HTMLElement | null {
  const names: readonly TourTarget[] = typeof target === "string" ? [target] : target;
  for (const name of names) {
    const element = find(name);
    if (element) return element;
  }
  return null;
}

/** The steps that can show, each with its part (spec 3.3 and 6.2). "Step N of M" counts these. */
export function resolveSteps<S extends { target: StepTarget }>(
  steps: readonly S[],
  find: Find,
): { step: S; element: HTMLElement }[] {
  return steps.flatMap((step) => {
    const element = pickTarget(step.target, find);
    return element ? [{ step, element }] : [];
  });
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test lib/tour/resolve.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/tour/resolve.ts lib/tour/resolve.test.ts
```
```bash
git commit -m "feat: find the tour's page and the parts on screen (decision 99)"
```

---

### Task 3: Placing the card

**Files:**
- Create: `lib/tour/place.ts`
- Test: `lib/tour/place.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/tour/place.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { placeCard } from "./place";

const phone = { width: 390, height: 844 };
const desk = { width: 1440, height: 900 };
const card = { width: 358, height: 180 };

describe("placeCard on phones (guided tour spec 3.2)", () => {
  it("sits at the bottom, above the tab bar, when the part is high", () => {
    const target = { x: 300, y: 10, width: 44, height: 44 };
    expect(placeCard({ target, viewport: phone, card, wide: false, bottomInset: 64 })).toEqual({
      x: 16,
      y: 844 - 64 - 180 - 16,
    });
  });

  it("moves to the top when the part is low, as the tab bar is", () => {
    const target = { x: 300, y: 790, width: 60, height: 50 };
    expect(placeCard({ target, viewport: phone, card, wide: false, bottomInset: 64 })).toEqual({ x: 16, y: 16 });
  });

  it("sits at the bottom when there's no part to show", () => {
    expect(placeCard({ target: null, viewport: phone, card, wide: false }).y).toBe(844 - 180 - 16);
  });
});

describe("placeCard from the tablet step", () => {
  const wideCard = { width: 352, height: 180 };

  it("sits below the part, lined up with its start edge", () => {
    const target = { x: 200, y: 60, width: 120, height: 44 };
    expect(placeCard({ target, viewport: desk, card: wideCard, wide: true })).toEqual({ x: 200, y: 60 + 44 + 12 });
  });

  it("goes above when there's no room below", () => {
    const target = { x: 200, y: 700, width: 120, height: 100 };
    expect(placeCard({ target, viewport: desk, card: wideCard, wide: true })).toEqual({ x: 200, y: 700 - 12 - 180 });
  });

  it("keeps 16px inside the right edge", () => {
    const target = { x: 1400, y: 60, width: 40, height: 40 };
    expect(placeCard({ target, viewport: desk, card: wideCard, wide: true }).x).toBe(1440 - 352 - 16);
  });

  it("stays on screen for a part taller than the screen", () => {
    const target = { x: 100, y: 20, width: 600, height: 870 };
    const at = placeCard({ target, viewport: desk, card: wideCard, wide: true });
    expect(at.y).toBe(900 - 180 - 16);
  });

  it("centres when there's no part to show", () => {
    expect(placeCard({ target: null, viewport: desk, card: wideCard, wide: true })).toEqual({
      x: (1440 - 352) / 2,
      y: (900 - 180) / 2,
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/tour/place.test.ts`
Expected: FAIL, `Failed to resolve import "./place"`.

- [ ] **Step 3: Write `lib/tour/place.ts`**

```ts
export type Box = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

const EDGE = 16;
const GAP = 12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Where the tour's card goes (guided tour spec 3.2). Phones: full width less 16px a side (CSS sets the width), at the
 * bottom above the tab bar (`bottomInset`), or at the top when the part is in the lower half. From the tablet step:
 * below the part, or above it, lined up with its start edge and kept 16px inside the screen. `target` is the lit
 * window's box, padding included; null when there's nothing to show.
 */
export function placeCard({
  target,
  viewport,
  card,
  wide,
  bottomInset = 0,
}: {
  target: Box | null;
  viewport: Size;
  card: Size;
  wide: boolean;
  bottomInset?: number;
}): { x: number; y: number } {
  if (!wide) {
    const low = target !== null && target.y + target.height / 2 > viewport.height / 2;
    return { x: EDGE, y: low ? EDGE : viewport.height - bottomInset - card.height - EDGE };
  }
  if (!target) return { x: (viewport.width - card.width) / 2, y: (viewport.height - card.height) / 2 };
  const x = clamp(target.x, EDGE, viewport.width - card.width - EDGE);
  const below = target.y + target.height + GAP;
  if (below + card.height <= viewport.height - EDGE) return { x, y: below };
  const above = target.y - GAP - card.height;
  if (above >= EDGE) return { x, y: above };
  return { x, y: clamp(viewport.height - card.height - EDGE, EDGE, viewport.height) };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test lib/tour/place.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/tour/place.ts lib/tour/place.test.ts
```
```bash
git commit -m "feat: place the tour's card beside the lit part (decision 99)"
```

---

### Task 4: The tours' words

**Files:**
- Create: `lib/tour/tours.ts`
- Test: `lib/tour/tours.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/tour/tours.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TOUR_IDS } from "./targets";
import { TOURS } from "./tours";

describe("the tours' words (guided tour spec 4)", () => {
  it("has a tour for every id", () => {
    expect(Object.keys(TOURS).sort()).toEqual([...TOUR_IDS].sort());
  });

  it.each(Object.entries(TOURS))("%s: steps are short and plain", (_, steps) => {
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (const step of steps) {
      expect(step.body.length, step.title).toBeLessThanOrEqual(140);
      expect(step.title.length, step.title).toBeLessThanOrEqual(30);
      expect(`${step.title} ${step.body}`, "no exclamation marks").not.toContain("!");
    }
  });

  it("names each part once per tour, so no step shows twice", () => {
    for (const steps of Object.values(TOURS)) {
      const names = steps.flatMap((step) => (typeof step.target === "string" ? [step.target] : [...step.target]));
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/tour/tours.test.ts`
Expected: FAIL, `Failed to resolve import "./tours"`.

- [ ] **Step 3: Write `lib/tour/tours.ts`**

The words are spec section 4's drafts, as amended in section 12. Lama edits them here.

```ts
import type { StepTarget, TourId } from "./targets";

export type TourStep = { target: StepTarget; title: string; body: string };

/** The card's heading when no step can show (spec 6.2): only if the page changed between the menu and the tap. */
export const NOTHING_HERE = "Nothing to show here right now";

/**
 * Each page's steps, in order (guided tour spec 4). A step whose part isn't on screen is skipped, so Home's role steps
 * are alternatives: only the tabs the bar is showing have parts on screen. Only the tour's own chunk imports this file:
 * its words must never reach a page's first load (spec 7.4).
 */
export const TOURS: Record<TourId, readonly TourStep[]> = {
  home: [
    {
      target: "search",
      title: "Search",
      body: "Look for anything on campus: textbooks, tech, services. A few words or a whole sentence both work.",
    },
    {
      target: ["hero-campus", "hdr-campus"],
      title: "Your campus",
      body: "We show listings from your campus first. Change it any time.",
    },
    {
      target: ["tab-shop", "hdr-shop"],
      title: "Shop",
      body: "Every listing, by category, with filters for price and campus.",
    },
    {
      target: ["tab-sell", "hdr-sell"],
      title: "Sell",
      body: "List something in a few minutes. Once you have a shop, it lives here too.",
    },
    {
      target: "tab-myshop",
      title: "My shop",
      body: "Your listings, messages from buyers and this week's next steps.",
    },
    { target: "tab-mentoring", title: "Mentoring", body: "The shops you mentor, and who's due a check-in." },
    { target: "tab-today", title: "Today", body: "What's waiting for the Hub: new shops, reports and bookings." },
    {
      target: ["tab-saved", "hdr-saved"],
      title: "Saved",
      body: "Tap the heart on any listing and it lands here, so you can come back to it.",
    },
    { target: "tab-messages", title: "Messages", body: "Talk to buyers and sellers. Meet on campus, somewhere public." },
    {
      target: ["tab-you", "hdr-account"],
      title: "You",
      body: "Notifications, your requests and your details, in one place.",
    },
    { target: "menu", title: "The menu", body: "Categories, Launchpad, Looking For, and your theme and data saver." },
  ],
  browse: [
    { target: "browse-categories", title: "Categories", body: "Jump to one kind of thing. All shows everything." },
    { target: "browse-filters", title: "Filters", body: "Narrow down by price, campus and more." },
    { target: "browse-sort", title: "Sort", body: "Best match, newest, or by price." },
    {
      target: "browse-save-search",
      title: "Save this search",
      body: "We'll tell you when something new matches, once a day at most.",
    },
  ],
  listing: [
    { target: "listing-gallery", title: "Photos", body: "Swipe through the seller's photos." },
    {
      target: "listing-seller",
      title: "The seller",
      body: "Every seller is a student business. Verified means the Hub has checked them.",
    },
    {
      target: "listing-actions",
      title: "Message, save or share",
      body: "Ask the seller a question or arrange to meet, keep it in Saved, or send it to a friend.",
    },
    { target: "listing-report", title: "Report", body: "Something wrong with this listing? Tell the Hub." },
  ],
  sell: [
    { target: "sell-needs-you", title: "Needs you", body: "Buyers waiting for a reply, and sales to mark sold." },
    { target: "sell-coach", title: "This week", body: "Up to three small steps to help your shop this week." },
    { target: "sell-add", title: "New listing", body: "Add something to sell, or answer your buyers." },
    { target: "sell-listings", title: "Your listings", body: "What's live, paused, sold and still a draft." },
    { target: "sell-bar", title: "Your shop's sections", body: "Listings, messages and your shop's profile." },
  ],
  you: [
    { target: "you-for-you", title: "For you", body: "New messages, offers and notifications." },
    { target: "you-stuff", title: "Your stuff", body: "Messages, notifications, saved things and your requests." },
    {
      target: "you-settings",
      title: "Settings",
      body: "Your details, privacy (download your data or delete your account) and signing out.",
    },
  ],
};
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test lib/tour/tours.test.ts`
Expected: PASS, 7 tests (3, with one per tour in the middle one).

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/tour/tours.ts lib/tour/tours.test.ts
```
```bash
git commit -m "feat: the words for Home, Shop, a listing, Sell and You's tours (decision 99)"
```

---

### Task 5: The tour's colours and CSS

**Files:**
- Modify: `app/globals.css` (the `@theme` block from line 53, the dark `:root` block from line 115, the night block from line 145, and a new section at the end of the file)
- Test: `lib/theme-contrast.test.ts`

- [ ] **Step 1: Write the failing test**

In `lib/theme-contrast.test.ts`, add after the `contrast` function:

```ts
/** `fg` at `alpha` laid over `bg`, as the browser paints a translucent colour. */
function over(fg: string, bg: string, alpha: number): string {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [f, b] = [rgb(fg), rgb(bg)];
  return `#${f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
}

/** The tour's dim (guided tour spec 7.2): the scrim at 70% over the page. The CSS test below keeps the two in step. */
const SCRIM_ALPHA = 0.7;
```

Inside the `describe.each(...)` block, after the "an action stands apart" test:

```ts
  it("the tour's ring stands apart from the dim around it (3:1, WCAG 1.4.11)", () => {
    expect(contrast(t["tour-ring"], over(t.scrim, t.white, SCRIM_ALPHA))).toBeGreaterThanOrEqual(3);
  });
```

At the end of the file:

```ts
it("dims with the scrim at the alpha the ring check uses", () => {
  expect(css).toContain(`var(--color-scrim) ${SCRIM_ALPHA * 100}%`);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/theme-contrast.test.ts`
Expected: FAIL, `tour-ring` and `scrim` are undefined (`over` reads `undefined.slice`), and the CSS check fails.

- [ ] **Step 3: Add the tokens**

In `app/globals.css`'s `@theme {` block, after `--color-sky: #29abe2;`:

```css
  --color-scrim: #15305d; /* the guided tour's dim, at 70% (guided tour spec 7.2) */
  --color-tour-ring: #ffffff; /* the ring round the tour's lit part: 3:1 against the dim */
```

In the dark block (`:root { @variant dark {`), after `--color-action: #29abe2;`:

```css
    --color-scrim: #050e1e;
    --color-tour-ring: #29abe2;
```

In the night block (`:root { @variant night {`), after `--color-action: #4fa9d1;`:

```css
    --color-scrim: #000000;
    --color-tour-ring: #4fa9d1;
```

Measured on 2026-11-05: the ring against the dim is 5.2:1 in Light (white on navy at 70% over white), 7.1:1 in Dark and 7.8:1 in Night.

- [ ] **Step 4: Add the tour's CSS at the end of `app/globals.css`**

```css
/* --- Guided tour (guided tour spec 7): the dim, the lit window and the card. Only transform and opacity animate,
   and the motion switches at the top of this file stop the card's rise for reduced motion and data saver. --- */
.tour {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: hidden;
}

.tour::backdrop {
  background: transparent;
}

/* Sized with width and height (never animated) and moved with translate; its spread shadow is the dim. */
.tour-window {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 12px;
  pointer-events: none;
  box-shadow: 0 0 0 100vmax color-mix(in srgb, var(--color-scrim) 70%, transparent);
  outline: 2px solid var(--color-tour-ring);
  outline-offset: 2px;
}

.tour-window[data-empty] {
  outline: none;
}

.tour-card {
  position: absolute;
  top: 0;
  left: 0;
  width: calc(100% - 32px);
  padding: 16px;
  border-radius: 16px;
  background: var(--color-white);
  color: var(--color-ink);
  animation: tour-card-in var(--motion-enter) ease-out both;
}

@media (min-width: 48rem) and (min-height: 30rem) {
  .tour-card {
    width: 22rem;
  }
}

.tour-title {
  padding-right: 40px;
  font-family: var(--vos-font-display);
  font-size: 1.25rem;
  line-height: 1.2;
  color: var(--color-navy);
}

.tour-title:focus {
  outline: none;
}

.tour-count {
  display: block;
  margin-bottom: 2px;
  font-family: var(--vos-font-text);
  font-size: 0.875rem;
  color: var(--color-muted);
}

.tour-body {
  margin-top: 6px;
}

.tour-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.tour-close {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--color-navy);
}

@keyframes tour-card-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* Home's invitation (spec 3.1 and 8): in the static HTML for everyone, hidden before first paint once answered. */
.tour-nudge {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 16px;
  background: var(--color-pale);
}

html[data-toured] .tour-nudge {
  display: none;
}

.tour-nudge-title {
  font-family: var(--vos-font-display);
  font-size: 1.25rem;
  color: var(--color-navy);
}

.tour-nudge-actions {
  display: flex;
  gap: 8px;
}

@media (min-width: 48rem) and (min-height: 30rem) {
  .tour-nudge {
    margin-top: 16px;
  }
}

/* The menu's row (spec 3.1): with the settings, sized like them, not like the menu's big links. */
.menu-tour {
  justify-self: start;
  min-height: 44px;
  font-weight: 600;
  text-align: start;
}
```

Check before going on: `--vos-font-text` is the body font variable's name (`grep -n "\-\-vos-font-" app/globals.css | head`); use the one the file defines.

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm test lib/theme-contrast.test.ts`
Expected: PASS, every theme's ring check and the CSS check.

- [ ] **Step 6: Commit (controller)**

```bash
git add app/globals.css lib/theme-contrast.test.ts
```
```bash
git commit -m "feat: the tour's dim, ring and card in the three themes (decision 99)"
```

---

### Task 6: The engine and its host

**Files:**
- Modify: `lib/overlays.ts`
- Create: `components/tour/TourHost.tsx`
- Create: `components/tour/Tour.tsx`
- Modify: `app/layout.tsx:110` (after `<CampusPicker … />`)

No unit test: jsdom has no `showModal` or layout, and the engine is covered end to end in Task 9.

- [ ] **Step 1: Add the overlay name**

`lib/overlays.ts`:

```ts
export type OverlayName = "menu" | "search" | "campus" | "install-help" | "tour";
```

and in `listeners`, after `"install-help": new Set(),`:

```ts
  tour: new Set(),
```

- [ ] **Step 2: Write `components/tour/TourHost.tsx`**

```tsx
"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { onOverlayOpen } from "@/lib/overlays";

/** The engine, loaded on the first "Show me around" (guided tour spec 5): no page pays for it up front. */
const Tour = lazy(() => import("./Tour"));

type Open = { trigger: HTMLElement | null; run: number };

/** In the root layout, beside the other overlays. Renders nothing until a tour is asked for. */
export function TourHost() {
  const [open, setOpen] = useState<Open | null>(null);
  useEffect(() => onOverlayOpen("tour", (trigger) => setOpen((was) => ({ trigger, run: (was?.run ?? 0) + 1 }))), []);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <Tour key={open.run} trigger={open.trigger} onClose={() => setOpen(null)} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Write `components/tour/Tour.tsx`**

```tsx
"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { NAV_PENDING_EVENT } from "@/components/ui/NavPending";
import { LOW_DATA_ATTR } from "@/lib/low-data";
import { placeCard, type Box } from "@/lib/tour/place";
import { finderFor, findTourPage, isShown, resolveSteps } from "@/lib/tour/resolve";
import { markTourSeen } from "@/lib/tour/seen";
import type { TourId } from "@/lib/tour/targets";
import { NOTHING_HERE, TOURS, type TourStep } from "@/lib/tour/tours";

/** Room round the lit part, so its edge isn't cut by the dim. */
const PAD = 6;
const WIDE = "(min-width: 48rem) and (min-height: 30rem)";

type Run = { id: TourId | null; steps: { step: TourStep; element: HTMLElement }[] };

/** Reads the page once, when the tour opens (spec 6.2). The tour renders only in the browser, after a tap. */
function startRun(): Run {
  const found = findTourPage(document);
  if (!found) return { id: null, steps: [] };
  return { id: found.id, steps: resolveSteps(TOURS[found.id], finderFor(document, found.page)) };
}

function padded(rect: DOMRect): Box {
  return { x: rect.left - PAD, y: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
}

function still(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute(LOW_DATA_ATTR);
}

/**
 * The guided tour (guided tour spec 7): a native modal <dialog>, so the browser traps focus, Escape closes it and the
 * page behind is inert. One window lights the step's part; its spread shadow dims the rest. The card says
 * "Step N of M", the step's words, and Back, Next or Done, and Close.
 */
export default function Tour({ trigger, onClose }: { trigger: HTMLElement | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [run, setRun] = useState(startRun);
  const [index, setIndex] = useState(0);
  const current = run.steps[index] ?? null;
  const count = run.steps.length;
  const last = index === count - 1;

  function finish(done: boolean) {
    // Only a finished Home tour answers Home's invitation (spec 3.5); closing early doesn't.
    if (done && run.id === "home") markTourSeen();
    dialogRef.current?.close();
    onClose();
    // Back to what opened it, or to the page when that's gone (the invitation hides once answered).
    if (trigger?.isConnected && isShown(trigger)) trigger.focus();
    else document.getElementById("main")?.focus();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Browser Back closes the tour (spec 6.4).
  const onLeave = useEffectEvent(() => finish(false));
  useEffect(() => {
    addEventListener("popstate", onLeave);
    return () => removeEventListener("popstate", onLeave);
  }, []);

  // The part left the screen (a phone turned past the tablet step): go on to the next step that can show (spec 6.3).
  const onGone = useEffectEvent(() => {
    const found = findTourPage(document);
    const rest = found
      ? resolveSteps(
          run.steps.slice(index + 1).map(({ step }) => step),
          finderFor(document, found.page),
        )
      : [];
    if (rest.length === 0) finish(false);
    else setRun({ id: run.id, steps: [...run.steps.slice(0, index), ...rest] });
  });

  useLayoutEffect(() => {
    const element = current?.element ?? null;
    if (element) {
      element.scrollIntoView({ block: "center", behavior: still() ? "instant" : "smooth" });
      // The header hides on scroll: ask it back, as a tapped link does (calm navigation), when the part is in it.
      if (element.closest(".site-header")) dispatchEvent(new Event(NAV_PENDING_EVENT));
    }

    let frame = 0;
    function place() {
      frame = 0;
      const win = windowRef.current;
      const card = cardRef.current;
      if (!win || !card) return;
      if (element && !isShown(element)) {
        onGone();
        return;
      }
      const viewport = { width: innerWidth, height: innerHeight };
      const box = element ? padded(element.getBoundingClientRect()) : null;
      const lit = box ?? { x: viewport.width / 2, y: viewport.height / 2, width: 0, height: 0 };
      win.style.translate = `${lit.x}px ${lit.y}px`;
      win.style.width = `${lit.width}px`;
      win.style.height = `${lit.height}px`;
      const bar = document.querySelector(".tabbar");
      const bottomInset = bar && isShown(bar) ? bar.getBoundingClientRect().height : 0;
      const at = placeCard({
        target: box,
        viewport,
        card: { width: card.offsetWidth, height: card.offsetHeight },
        wide: matchMedia(WIDE).matches,
        bottomInset,
      });
      card.style.translate = `${at.x}px ${at.y}px`;
    }
    const later = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    place();
    // Screen readers hear "Step 2 of 5, Saved", then the words (spec 7.1).
    titleRef.current?.focus();
    addEventListener("resize", later);
    addEventListener("scroll", later, { passive: true, capture: true });
    const observer = element ? new ResizeObserver(later) : null;
    if (element) observer?.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", later);
      removeEventListener("scroll", later, { capture: true });
      observer?.disconnect();
    };
  }, [current]);

  return (
    <dialog
      ref={dialogRef}
      className="tour"
      aria-labelledby="tour-title"
      aria-describedby={current ? "tour-body" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        finish(false);
      }}
    >
      <div ref={windowRef} className="tour-window" data-empty={current ? undefined : ""} />
      {/* Keyed by the step, so the card rises in again on each one. */}
      <section ref={cardRef} key={index} className="tour-card">
        <h2 id="tour-title" ref={titleRef} tabIndex={-1} className="tour-title">
          {current ? (
            <>
              <span className="tour-count">{`Step ${index + 1} of ${count}`}</span> {current.step.title}
            </>
          ) : (
            NOTHING_HERE
          )}
        </h2>
        {current && (
          <p id="tour-body" className="tour-body">
            {current.step.body}
          </p>
        )}
        {current && (
          <div className="tour-actions">
            {index > 0 && (
              <button type="button" className="btn btn-outline text-navy" onClick={() => setIndex(index - 1)}>
                Back
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (last ? finish(true) : setIndex(index + 1))}
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        )}
        <button type="button" aria-label="Close the tour" className="tour-close" onClick={() => finish(false)}>
          <CloseIcon />
        </button>
      </section>
    </dialog>
  );
}
```

- [ ] **Step 4: Mount the host**

`app/layout.tsx`: add `import { TourHost } from "@/components/tour/TourHost";` with the other component imports (alphabetical, after `ToastRegion`'s line is fine), and render it after `<CampusPicker campuses={campuses} />`:

```tsx
        <CampusPicker campuses={campuses} />
        <TourHost />
        <ToastRegion />
```

- [ ] **Step 5: Check types and lint**

Run: `pnpm typecheck`
Expected: no errors.

Run: `pnpm lint components/tour lib/tour lib/overlays.ts app/layout.tsx`
Expected: no errors. If the React Compiler rule reports `setRun` inside `onGone`, the call is from an effect event, not the effect body; if the rule still flags it, move the `isShown` check and `onGone()` call into the `later` (event) path only and keep `place()` in the effect free of state.

- [ ] **Step 6: Commit (controller)**

```bash
git add lib/overlays.ts components/tour/TourHost.tsx components/tour/Tour.tsx app/layout.tsx
```
```bash
git commit -m "feat: the tour engine, loaded on the first tap (decision 99)"
```

---

### Task 7: Marking the pages and their parts

**Files:**
- Test: `lib/tour/markup.test.ts`
- Modify: the shared chrome and the five pages (listed in each step)

- [ ] **Step 1: Write the failing test**

`lib/tour/markup.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isTourId, TOUR_IDS } from "./targets";
import { TOURS } from "./tours";

// Guided tour spec 9: every part a tour names is marked somewhere in the markup, and every marked page has a tour.

const ROOT = process.cwd();
const source = ["app", "components"]
  .flatMap((folder) =>
    (readdirSync(join(ROOT, folder), { recursive: true }) as string[])
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .map((file) => readFileSync(join(ROOT, folder, file), "utf8")),
  )
  .join("\n");

const targets = [
  ...new Set(
    Object.values(TOURS).flatMap((steps) =>
      steps.flatMap((step) => (typeof step.target === "string" ? [step.target] : [...step.target])),
    ),
  ),
];

describe("the tours' markup", () => {
  it.each(targets)("%s is marked in the markup", (target) => {
    // data-tour="…", a component's tour="…" prop, or a map's value (the tab bar's PILL_TOURS).
    expect(source).toMatch(new RegExp(`(?:data-tour=|tour=\\{?|[a-z]+: )"${target}"`));
  });

  it("marks a page only with a tour that exists", () => {
    const pages = [...source.matchAll(/data-tour-page="([^"]+)"/g)].map((match) => match[1]);
    expect(pages.filter((id) => !isTourId(id))).toEqual([]);
    expect(new Set(pages)).toEqual(new Set(TOUR_IDS));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/tour/markup.test.ts`
Expected: FAIL: every target missing, and no `data-tour-page`.

- [ ] **Step 3: The tab bar**

`components/tabbar/TabBar.tsx`:
- import `type TourTarget` from `@/lib/tour/targets`;
- `TabProps` gains `tour?: TourTarget;`, `Tab` takes `tour` and passes `data-tour={tour}` to `NavLink` (it spreads to the `<a>`);
- the Shop tab: `tour="tab-shop"`; `StudentTail`'s Sell: `tour="tab-sell"`, Saved: `tour="tab-saved"`; `AccountTab`'s `Tab`: `tour="tab-you"`;
- in `RoleTabs`, beside `PILL_ICONS`:

```tsx
/** The pill's part in Home's tour (guided tour spec 4.1). */
const PILL_TOURS: Record<Exclude<BarKind, "student">, TourTarget> = {
  seller: "tab-myshop",
  mentor: "tab-mentoring",
  admin: "tab-today",
};
```

and the pill's `Tab` gets `tour={PILL_TOURS[kind]}`, the Messages `Tab` `tour="tab-messages"`.

- [ ] **Step 4: The header**

`components/header/SiteHeader.tsx`: the quick links' Shop `NavLink` gets `data-tour="hdr-shop"`, Sell `data-tour="hdr-sell"`; the menu button `data-tour="menu"`; the search button `data-tour="search"`; `<CampusPill … tour="hdr-campus" />`; `<SavedLink className="hdr-item hidden wide:inline-grid" tour="hdr-saved" />`.

`components/header/CampusPill.tsx`: `CampusPillProps` gains `tour?: TourTarget`; the `<button>` gets `data-tour={tour}`.

`components/header/SavedLink.tsx`: `SavedLink({ className, tour }: { className?: string; tour?: TourTarget })`, and the `<Link>` gets `data-tour={tour}`. (`PhoneSaved` passes none.)

`components/header/AccountLink.tsx`: the `<Link>` in `AccountLink` gets `data-tour="hdr-account"`.

`components/campus/CampusPickerButton.tsx`: takes `tour?: TourTarget` and puts `data-tour={tour}` on its `<button>`.

`components/home/hero/HeroCampusChip.tsx`: `ChipButton`'s `<CampusPickerButton className="hero-campus-chip" tour="hero-campus">`, so the chip and its fallback both carry it.

- [ ] **Step 5: The Sell bar**

`components/kit/SectionBar.tsx`: `SectionBar` takes `tour?: TourTarget` (beside `side`) and its `<nav>` gets `data-tour={tour}`.

`components/kit/sections.tsx`, `SellBar`: `return <SectionBar label="Selling" tabs={tabs} tour="sell-bar" />;`

- [ ] **Step 6: Home and Browse**

`app/page.tsx`: `<div className="home" data-tour-page="home">`.

`app/browse/page.tsx`: `<div className="page browse" data-tour-page="browse">`.

`components/browse/CategoryTabs.tsx`: `<nav aria-label="Categories" className="category-tabs" data-tour="browse-categories">`.

`components/browse/BrowseToolbar.tsx`: the Filters `<details … className="tool tool-filters" data-tour="browse-filters">`, the Sort `<details … className="tool tool-sort" data-tour="browse-sort">`.

`components/browse/SaveSearchControl.tsx`: `<div className="save-search" data-tour="browse-save-search">`.

- [ ] **Step 7: A listing**

`components/listing/ListingView.tsx`: `<div className="page listing-page" data-tour-page="listing">`, and `<p className="listing-report" data-tour="listing-report">`.

`components/listing/Gallery.tsx`: `<div className="gallery" data-tour="listing-gallery">`.

`components/listing/SellerCard.tsx`: `<section aria-labelledby="seller-title" className="listing-seller" data-tour="listing-seller">`.

`components/listing/ListingActions.tsx`: `<div className="listing-actions" data-tour="listing-actions">`.

- [ ] **Step 8: Sell (an approved shop's dashboard only)**

`components/sell/Dashboard.tsx`:
- `<div className="sell-column sell-home" data-tour-page="sell">`;
- wrap the Needs you card: `<div data-tour="sell-needs-you"><Card title="Needs you">…</Card></div>`;
- the coach, both branches wrapped:

```tsx
      {coach === "error" ? (
        <div data-tour="sell-coach">
          <Card title="This week">
            <SectionError id="sell-coach" title="This week" path={SELL_PATH} />
          </Card>
        </div>
      ) : (
        coach && (
          <div data-tour="sell-coach">
            <CoachWeek view={coach} from="sell" />
          </div>
        )
      )}
```

- `<div className="sell-home-buttons" data-tour="sell-add">`;
- wrap Your listings: `<div data-tour="sell-listings"><Card title="Your listings" …>…</Card></div>`.

`.sell-home` spaces its children with `gap`, and no rule selects `.sell-home > .kit-card`, so the wrappers change no spacing. The visitor's pitch, a waiting shop and a declined one render other components and get no `data-tour-page`.

- [ ] **Step 9: You**

`components/account/AccountView.tsx`, `YouView`:
- `<div className="you-body" data-tour-page="you">`;
- `<div id="you-for-you" data-tour="you-for-you">`, `<div id="you-stuff" data-tour="you-stuff">`;
- wrap the Settings card: `<div data-tour="you-settings"><Card title="Settings">…</Card></div>`.

- [ ] **Step 10: Run the markup test and the touched components' tests**

Run: `pnpm test lib/tour components/tabbar components/header components/kit components/browse components/listing components/sell components/account components/home components/campus`
Expected: PASS. A snapshot or exact-markup assertion that now sees `data-tour` is updated to include it; no behaviour changes.

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 11: Commit (controller)**

```bash
git add lib/tour/markup.test.ts components/tabbar/TabBar.tsx components/header/SiteHeader.tsx components/header/CampusPill.tsx components/header/SavedLink.tsx components/header/AccountLink.tsx components/campus/CampusPickerButton.tsx components/home/hero/HeroCampusChip.tsx components/kit/SectionBar.tsx components/kit/sections.tsx app/page.tsx app/browse/page.tsx components/browse/CategoryTabs.tsx components/browse/BrowseToolbar.tsx components/browse/SaveSearchControl.tsx components/listing/ListingView.tsx components/listing/Gallery.tsx components/listing/SellerCard.tsx components/listing/ListingActions.tsx components/sell/Dashboard.tsx components/account/AccountView.tsx
```
```bash
git commit -m "feat: mark the tours' pages and parts (decision 99)"
```

(Add any test file Step 10 changed to the `git add`.)

---

### Task 8: The menu row, the Home nudge, the boot script and the privacy page

**Files:**
- Modify: `components/menu/MenuDrawer.tsx`
- Create: `components/home/TourNudge.tsx`, `components/home/TourNudgeButtons.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/boot-script.ts`, `lib/boot-script.test.ts`
- Modify: `app/privacy/page.tsx`

- [ ] **Step 1: Write the failing boot-script test**

`lib/boot-script.test.ts`: add `import { TOUR_SEEN_ATTR, TOUR_SEEN_KEY } from "./tour/seen";` and, inside `describe("boot script", …)`:

```ts
  describe("Home's tour invitation (guided tour spec 8)", () => {
    afterEach(() => {
      localStorage.removeItem(TOUR_SEEN_KEY);
      document.documentElement.removeAttribute(TOUR_SEEN_ATTR);
      vi.restoreAllMocks();
    });

    it("marks <html> before first paint once the invitation was answered", () => {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
      runBootScript();
      expect(document.documentElement.hasAttribute(TOUR_SEEN_ATTR)).toBe(true);
    });

    it("leaves the invitation for a first visit", () => {
      runBootScript();
      expect(document.documentElement.hasAttribute(TOUR_SEEN_ATTR)).toBe(false);
    });

    it("never throws when storage is blocked", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("Blocked", "SecurityError");
      });
      expect(() => runBootScript()).not.toThrow();
      expect(document.documentElement.hasAttribute(TOUR_SEEN_ATTR)).toBe(false);
    });
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/boot-script.test.ts`
Expected: FAIL on "marks <html> before first paint".

- [ ] **Step 3: Read the key in the boot script**

`lib/boot-script.ts`: add `import { TOUR_SEEN_ATTR, TOUR_SEEN_KEY } from "./tour/seen";`. In `BOOT_BODY`, insert after the theme's closing `}` and before `window.addEventListener("beforeinstallprompt"`:

```ts
try{if(localStorage.getItem(${JSON.stringify(TOUR_SEEN_KEY)})==="1")d.setAttribute(${JSON.stringify(TOUR_SEEN_ATTR)},"")}catch(e){}
```

and add to the comment's list, after the theme's line:

```ts
 * - marks <html data-toured> once Home's tour invitation was answered, so CSS hides it before first paint (guided
 *   tour spec 8);
```

- [ ] **Step 4: Run the boot-script tests**

Run: `pnpm test lib/boot-script.test.ts lib/install-event.test.ts`
Expected: PASS. (`lib/install-event.test.ts` still passes: client code imports `lib/tour/seen.ts`, never the boot script.)

- [ ] **Step 5: The nudge**

`components/home/TourNudgeButtons.tsx`:

```tsx
"use client";

import { openOverlay } from "@/lib/overlays";
import { markTourSeen } from "@/lib/tour/seen";

/** The invitation's two buttons (guided tour spec 3.1): the only client code it has. */
export function TourNudgeButtons() {
  return (
    <div className="tour-nudge-actions">
      <button type="button" className="btn btn-primary" onClick={(event) => openOverlay("tour", event.currentTarget)}>
        Take the tour
      </button>
      <button
        type="button"
        className="btn btn-outline text-navy"
        onClick={() => {
          markTourSeen();
          // The invitation is gone, and focus with it: start again from the page.
          document.getElementById("main")?.focus();
        }}
      >
        Not now
      </button>
    </div>
  );
}
```

`components/home/TourNudge.tsx`:

```tsx
import { TourNudgeButtons } from "./TourNudgeButtons";

/**
 * Home's one invitation to the tour (guided tour spec 3.1). In the static HTML for everyone; the boot script marks
 * <html data-toured> once it's answered and CSS hides it before first paint, so nothing moves (spec 8).
 */
export function TourNudge() {
  return (
    <aside aria-labelledby="tour-nudge-title" className="tour-nudge">
      <h2 id="tour-nudge-title" className="tour-nudge-title">
        New here?
      </h2>
      <TourNudgeButtons />
    </aside>
  );
}
```

`app/page.tsx`: import it and render it after `<ContextStrip />`:

```tsx
        <ContextStrip />
        <TourNudge />
        <ShopByCategory />
```

- [ ] **Step 6: The menu row**

`components/menu/MenuDrawer.tsx`:
- add `import { findTourPage } from "@/lib/tour/resolve";`;
- beside `const [opened, setOpened] = useState(false);`: `const [tourHere, setTourHere] = useState(false);`
- in the `useOverlayDialog("menu", (trigger) => { … })` callback, after `setOpened(true);`:

```tsx
    // Offered only on a page with a tour (guided tour spec 3.1). The menu is open, but the page underneath is still
    // laid out, so the check sees what's on screen.
    setTourHere(findTourPage(document) !== null);
```

- beside `changeCampus`:

```tsx
  /** Close the menu first, then start the tour, as Change campus does; focus goes back to the menu's opener after. */
  function startTour() {
    const openedBy = openedByRef.current;
    close();
    openOverlay("tour", openedBy);
  }
```

- in `<div className="menu-bottom">`, before the settings' `<Suspense>`:

```tsx
          {tourHere && (
            <button type="button" onClick={startTour} className="menu-tour">
              Show me around this page
            </button>
          )}
```

The menu imports only `findTourPage` and `isTourId`'s small array from `lib/tour`; it never imports `lib/tour/tours.ts`.

- [ ] **Step 7: The privacy page**

`app/privacy/page.tsx`: after the `vossie_theme` list item:

```tsx
          <li>
            <code>vossie_tour_seen</code>: that you took or turned down the tour of the homepage, so we don&apos;t offer
            it again.
          </li>
```

- [ ] **Step 8: Run the tests**

Run: `pnpm test app/privacy components/menu components/home lib`
Expected: PASS. `app/privacy/page.test.tsx` finds `vossie_tour_seen` in `lib/tour/seen.ts` and on the page.

- [ ] **Step 9: Commit (controller)**

```bash
git add components/menu/MenuDrawer.tsx components/home/TourNudge.tsx components/home/TourNudgeButtons.tsx app/page.tsx lib/boot-script.ts lib/boot-script.test.ts app/privacy/page.tsx
```
```bash
git commit -m "feat: start the tour from the menu or Home's one-time invitation (decision 99)"
```

---

### Task 9: End-to-end tests

**Files:**
- Create: `tests/e2e/tour.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { onlyAt, signInAsSample } from "./helpers/messaging";
import { expectStill, recordShifts } from "./helpers/shifts";

// The guided tour (guided tour spec 9). Read-only: it writes nothing to the store, so it runs in the device projects
// and isn't in playwright.config.ts's WRITES. Only the built-in page is used, which already blocks service workers.

const tour = (page: Page) => page.getByRole("dialog", { name: /^Step \d+ of \d+/ });

async function openTour(page: Page) {
  // The menu offers a tour only once the page's content has streamed in.
  await expect(page.locator("[data-tour-page]:visible").first()).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Show me around this page" }).click();
  await expect(tour(page)).toBeVisible();
}

/** Every step's title, pressing Next to the end and then Done. */
async function stepTitles(page: Page): Promise<string[]> {
  await openTour(page);
  const titles: string[] = [];
  for (;;) {
    const heading = (await tour(page).getByRole("heading").textContent()) ?? "";
    titles.push(heading.replace(/^Step \d+ of \d+\s*/, "").trim());
    const done = tour(page).getByRole("button", { name: "Done" });
    if (await done.isVisible()) {
      await done.click();
      break;
    }
    await tour(page).getByRole("button", { name: "Next" }).click();
  }
  await expect(tour(page)).toBeHidden();
  return titles;
}

test("Home's tour walks the navigation and ends on Done", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/");
  const titles = await stepTitles(page);
  expect(titles.slice(0, 3)).toEqual(["Search", "Your campus", "Shop"]);
  expect(titles).toContain("Saved");
  expect(titles.at(-1)).toBe("The menu");
});

test("Escape closes the tour and gives focus back to the menu button", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse");
  await openTour(page);
  await page.keyboard.press("Escape");
  await expect(tour(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
});

test("the open tour has no serious accessibility issues", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/");
  await openTour(page);
  expect(await seriousIssues(page)).toEqual([]);
});

test("Home's tour fits the bar: a student's Sell, a seller's My shop and Messages", async ({ page }) => {
  onlyAt("phone-390");
  await page.goto("/");
  const student = await stepTitles(page);
  expect(student).toContain("Sell");
  expect(student).not.toContain("My shop");

  await signInAsSample(page, "Seller, Tech corner", "/");
  const seller = await stepTitles(page);
  expect(seller).toContain("My shop");
  expect(seller).toContain("Messages");
  expect(seller).not.toContain("Sell");
});

test("Not now hides Home's invitation for good, without moving the page", async ({ page }) => {
  onlyAt("phone-390");
  await page.goto("/");
  const invitation = page.getByRole("complementary", { name: "New here?" });
  await expect(invitation).toBeVisible();
  await invitation.getByRole("button", { name: "Not now" }).click();
  await expect(invitation).toBeHidden();

  await recordShifts(page);
  await expectStill(page, "homepage after Not now", "/");
  await expect(invitation).toBeHidden();
});

test("Shop, a listing, Sell and You each have a tour", async ({ page }) => {
  onlyAt("phone-390");
  for (const path of ["/browse", "/listings/l-001"]) {
    await page.goto(path);
    await openTour(page);
    await page.keyboard.press("Escape");
  }
  await signInAsSample(page, "Seller, Tech corner", "/sell");
  for (const path of ["/sell", "/account"]) {
    await page.goto(path);
    await openTour(page);
    await page.keyboard.press("Escape");
  }
});
```

- [ ] **Step 2: Run it**

Run: `pnpm e2e tests/e2e/tour.spec.ts --project=phone-390 --project=desktop-1440`
Expected: PASS, 10 runs (4 tests at two sizes, 2 at phone-390 only, the others skipped).

If "Home's tour walks the navigation" fails at desktop-1440 on "Your campus" because the header has scrolled away, check that `NAV_PENDING_EVENT` brings it back (`components/header/useHeaderMode.ts`); the step must light a part that's on screen.

- [ ] **Step 3: Run the existing checks the markup could touch**

Run: `pnpm e2e tests/e2e/a11y.spec.ts tests/e2e/cls.spec.ts tests/e2e/role-bars.spec.ts tests/e2e/home.spec.ts --project=phone-390 --project=desktop-1440`
Expected: PASS, apart from any failure that also fails on `main` before this work (note it, don't fix it here: decision 98 records `/sell`'s font-swap shift at phone-390).

- [ ] **Step 4: Commit (controller)**

```bash
git add tests/e2e/tour.spec.ts
```
```bash
git commit -m "test: the guided tour end to end (decision 99)"
```

---

### Task 10: Bytes, the full checks and the docs

**Files:**
- Modify: `docs/reference/LANDING-DECISIONS.md` (decision 99 row, after decision 98)
- Modify: `docs/superpowers/specs/2026-11-05-guided-tour-design.md` (status line)
- Modify: `docs/PROGRESS.md` (Lama has uncommitted edits here: back the file up first, add only this session's entry, and stage only those lines with `git apply --cached`, per the shared-file rule)

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: the build passes.

- [ ] **Step 2: The words stay out of first loads**

Run: `grep -l "lands here, so you can come back" .next/static/chunks/*.js | wc -l`
Expected: `1` (the tour's own chunk).

Run: `grep -l "Show me around this page" .next/static/chunks/*.js | wc -l`
Expected: `1` (the menu's chunk). Then check that file doesn't also hold the words: `grep -c "lands here, so you can come back" <that file>` prints `0`.

Run: `grep -o "\-\-color-scrim:[^;]*" .next/static/css/*.css | head -3`
Expected: the scrim token is in the built CSS (Tailwind keeps it because the tour's CSS uses it). If it's missing, the dim is transparent: add `--color-scrim` and `--color-tour-ring` to a plain `:root` beside the motion timings instead, and repeat this step.

- [ ] **Step 3: The JavaScript budget**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Note the homepage's, the listing page's and the listing forms' brotli bytes from the output, against decision 98's 152,753 B for the listing forms. If a page is over 150 KB, the menu's import is the first place to look: replace `findTourPage` in `MenuDrawer.tsx` with the inline check below and measure again.

```tsx
    setTourHere([...document.querySelectorAll("[data-tour-page]")].some((page) => page.checkVisibility()));
```

- [ ] **Step 4: The full checks**

Run: `pnpm lint`, then `pnpm typecheck`, then `pnpm test`.
Expected: all pass.

- [ ] **Step 5: Decision 99 and the docs**

Add decision 99's row to `docs/reference/LANDING-DECISIONS.md` after decision 98's, in the table's form: date 2026-11-05, question "A guided tour (`2026-11-05-guided-tour-design.md`)", the decision in bold (a tour per screen from the menu's "Show me around this page" and Home's one-time invitation; our own engine loaded on tap; steps skip what isn't on screen; phase 1 Home, Shop, a listing, Sell and You), and the notes (Lama's three answers, the bytes measured in Step 3, the e2e result).

Set the spec's status line to `Status: phase 1 built (decision 99, <commit>).`

Add this session's entry to `docs/PROGRESS.md`.

- [ ] **Step 6: Commit (controller)**

```bash
git add docs/reference/LANDING-DECISIONS.md docs/superpowers/specs/2026-11-05-guided-tour-design.md
```
Then stage only the new `docs/PROGRESS.md` lines (back up, `git diff docs/PROGRESS.md` to a patch holding only this entry, `git apply --cached` it), and:
```bash
git commit -m "docs: decision 99, the guided tour's phase 1"
```

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| 3.1 Starting (menu row, nudge) | 8 |
| 3.2 A step (dim, ring, card, phone and wide placement) | 3, 5, 6 |
| 3.3 Fitting the person (skipped steps) | 2, 6, 9 |
| 3.4 Ending (Escape, Close, Done, focus, Back) | 6, 9 |
| 3.5 Remembering (`vossie_tour_seen`) | 1, 8 |
| 4.1 Phase 1 tours | 4, 7 |
| 5 Pieces | 1 to 8 |
| 6 Finding parts, scrolling, the header, leaving | 2, 6 |
| 7 Engine, look, motion, bytes | 5, 6, 10 |
| 8 Nudge and boot script | 8 |
| 9 Testing | 1 to 4, 5, 7, 8, 9 |
| 12 Departures | 4, 5, 7, 8 |
