# Calm navigation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Every page moves the same calm way: tabs crossfade, going deeper slides, "Back to…" links slide back.
- Page outlines (skeletons) fade into their content instead of snapping.
- The five pages with nothing to show while they load (listing, storefront, Looking For request, collection, Hub post) show a breathing Eduvos crest, but only once the wait passes a second.
- Most clicks get motion only, never a loader (Lama, 2026-10-26).

**Architecture:**
- Everything is CSS, React's built-in `<ViewTransition>` and Server Components. No new client component.
- `components/brand/CrestLoader.tsx` sits inside `PageFallback`.
- `components/kit/Reveal.tsx` is `<Suspense>` plus an exit `ViewTransition` on the fallback and an enter `ViewTransition` on the content. Page-level boundaries move onto it.
- `lib/motion.ts` names the three link types once (`TAB`, `FORWARD`, `BACK`).
- `PageTransition` goes on every page.
- Motion tokens and keyframes live in `app/globals.css`, beside the existing page transition block (around line 10362).

**Tech Stack:** Next.js 16.4 App Router (Cache Components), React 19.3 `<ViewTransition>`, TypeScript, Tailwind CSS 4.3 with component CSS in `app/globals.css`, Vitest 5 + Testing Library, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-26-calm-navigation-design.md` (revised after research; Lama approved it, including the two reversed answers, on 2026-10-26).

---

## Rules for whoever builds this

- **Commits:** implementers leave their work uncommitted. The controller checks each task and commits it, only with Lama's go-ahead (project memory, CLAUDE.md). Every "Commit" step is for the controller.
- **Git:** one git command at a time, with `git status` first as its own call. Stage only this plan's files: other sessions share the tree, and `.claude/launch.json`, `docs/stakeholder/` and the untracked C5 and photo specs aren't ours. Never `git add .`.
- **Shared files:** `app/globals.css` and `CLAUDE.md` are shared. Back them up first, and stage only your own hunks (`git apply --cached`, project memory "Shared file edits").
- **Servers and builds:** stop only your own server (by PID or port), never `pkill` by name. Never kill an install or a build mid-flight.
- **Before touching `<ViewTransition>` or `transitionTypes`,** read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` and react.dev's `<ViewTransition>` reference. Its caveats matter here:
  - It must come before any DOM node, or enter and exit don't fire.
  - Browser Back (popstate) never animates.
  - React waits up to 500 ms for visible images and fonts before animating.
- **Motion:** only `opacity` and `transform` (the CSS `scale` and `translate` properties count). Every new animation is off under `prefers-reduced-motion` and `html[data-low-data]`. Never put `!important` on an animation property (the motion off switches near `globals.css:288` rely on that).
- **Colours and fonts:** never a hex colour or a font name in a component. The crest is navy on white, from `assets/brand/` only.
- **JS:** this plan adds no client component. `SiteHeader` and `MenuDrawer` (client) gain an import of `lib/motion.ts` (a few dozen bytes). Every page stays inside the 150 KB first-visit budget, and each page's number is recorded against Task 0's baseline. Smooth beats bytes (Lama, 2026-10-22), but a page that grows by more than 1 KB gets a one-line reason.
- **Testing:** speed first (project memory "Efficient testing"). Run only the targeted specs each task names. The full e2e run is in Task 7.

## Plan decisions (where this plan narrows or adds to the spec; Lama to confirm at plan review)

1. **The crest is exempt from the global motion off switch.** *(Built in Task 2 as `.crest-loader`; Task 5b generalises it to a `.motion-own` class, carried by the crest loader and the header pennant.)*
   - The problem: the switch (`globals.css:295-319`) forces `animation-delay: 0s !important` under reduced motion and data saver. That would show the crest, and announce "Loading…", the instant any fallback mounts, even for a 50 ms wait.
   - The fix: the switch's selectors become `*:not(.crest-loader, .crest-loader *)` (and the same for `::before` and `::after`). The crest's own CSS then gives those users the 1 s delay and a 400 ms fade, with no breathing (spec 8.2).
   - No `!important` is added anywhere. Test: `motion.spec.ts`.
2. **The home sections aren't wrapped in `Reveal`.** They already rise in with CSS scroll-driven reveals (`reveal.spec.ts`), and a second motion on the same block breaks "never two motions at once". The same goes for small inline boundaries (`fallback={null}`, the hero's campus chip, `HubPostView`'s action and upcoming blocks): nothing visible leaves, or the block is too small to need it. `Reveal` is for each page's main content boundary only.
3. **Which links slide is decided by Task 1's spike,** not up front. `lib/motion.ts` exports `CARD`, which is either `FORWARD` or `TAB`, with the measured numbers in a comment.
   - **Why:** React waits up to 500 ms for visible images before any view transition, and that applies to tab crossfades into photo-heavy pages too (`/browse`, `/saved`).
   - **The thresholds:** if a transition adds more than 150 ms on slow 3G, that link family gets no type at all, and its pages swap instantly.
4. **Guard tests read the folders,** like the existing `RESERVED_SLUGS` and `STAFF_EYEBROW` tests:
   - every `app/**/page.tsx` imports `PageTransition` (the only exceptions are listed in the test with a reason);
   - every component with a visible "Back to" link passes `BACK`;
   - no file passes a literal `["nav-…"]` array (use `lib/motion.ts`).
5. **The first-load reveal is measured, not assumed.**
   - On a first visit, Chrome may animate a streamed Suspense reveal too. That's only opacity and a 6 px rise, but it could move LCP.
   - Task 4 compares LCP on `/listings/[id]` and `/browse` at 390 before and after, through the performance spec's existing timing.
   - If LCP grows by more than 100 ms, `reveal-in` drops the 150 ms delay. If it still grows, `Reveal` skips the enter on documents (`enter={{ "nav-tab": "reveal-in", "nav-forward": "reveal-in", "nav-back": "reveal-in", default: "none" }}`, so only client navigations animate the reveal).
6. **The header crest breathes while a tap waits (added during the build, Lama 2026-10-26; spec layer 4).** Task 3's test found the old page frozen, with no feedback, until a slow server answered. Most links aren't prefetched, so that's most taps on slow data. Task 5b adds `NavPending` (`useLinkStatus`) inside `NavLink` and every typed link. The header comes back if it was hidden, and its crest breathes after 150 ms.
7. **Task 1's results (2026-10-26, slow 3G at 390, 5 runs each, median):**

   | Navigation | Before | With motion |
   |---|---|---|
   | Tab to `/browse`: new page in place | 124 ms | 151 ms (+27 ms) |
   | Card to listing: new page in place | 586 ms | 565 ms (noise) |
   | Tab: animation finished | 137 ms | 415 ms (the animation itself) |
   | Card: animation finished | 594 ms | 859 ms (the animation itself) |

   First-visit LCP was unchanged (/ 2896 to 2888 ms, /browse 3856 to 3856, listing 3680 to 3652). So `TAB` goes on the tabs and `CARD = FORWARD`.

---

## File map

| File | Change |
|---|---|
| `lib/motion.ts` (new) | `TAB`, `FORWARD`, `BACK`, `CARD` |
| `lib/motion.test.ts` (new) | Types match `globals.css` classes; the three folder guards |
| `components/brand/CrestLoader.tsx` (new) + test | The breathing crest with delayed status text |
| `components/ui/PageFallback.tsx` | Renders `CrestLoader` |
| `components/kit/Reveal.tsx` (new) + test | Suspense with exit and enter view transitions |
| `components/kit/PageTransition.tsx` | Adds `nav-back` |
| `app/globals.css` | Motion tokens, the switch's exemption, crest CSS, `reveal-*` and `nav-back` animations |
| about 57 `app/**/page.tsx` | `Reveal` in place of the page-level `Suspense`; `PageTransition` where missing (31 pages) |
| `components/saved/SavedTabs.tsx` | `Reveal` |
| Links (Task 5's list) | `transitionTypes={TAB / FORWARD / BACK / CARD}` |
| `tests/e2e/motion.spec.ts` (new) | Crest timing, reduced motion, data saver, axe |
| `CLAUDE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/superpowers/specs/2026-10-22-role-views-design.md` §4.4, `docs/PROGRESS.md` | Docs |

---

### Task 0: Baseline

- [ ] `git status` (its own call). Note anything that isn't ours, and leave it alone.
- [ ] `pnpm build`, then `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`. Record each page's first-visit JS (brotli) and the LCP the spec logs for `/`, `/browse` and `/listings/[id]` in the plan's progress notes (scratch, not committed).

### Task 1: Spike: what does the image wait cost? (decision 3)

Throwaway. Nothing from this task is committed except the numbers, which go in `lib/motion.ts`'s comment (Task 5) and in PROGRESS.

- [ ] In a scratch copy of the e2e setup (scratchpad, or an uncommitted `tests/e2e/spike-motion.spec.ts`), use the slow network from `tests/e2e/cls.spec.ts` (350 ms latency, 400 kbps, CSS and scripts cached) at `phone-390`.
- [ ] Measure the time from tap to the destination's `h1` being visible, 5 runs each, median:
  - a. **Tab:** `/` to `/browse` through the tab bar, without and with `transitionTypes={["nav-tab"]}` on the tab bar's links (temporary edit), and with `PageTransition` around `/browse`'s content (temporary).
  - b. **Card:** a `/browse` listing card to `/listings/[id]`, without and with `["nav-forward"]` on `ListingCard`'s link, and `PageTransition` on both pages (temporary).
- [ ] **Decide (decision 3):**
  - 150 ms or less added: tabs get `TAB`, cards get `FORWARD`.
  - Over 150 ms for cards: `CARD = TAB` (a crossfade). Measure that too; if it's still over 150 ms, `CARD` is `undefined` (no type).
  - The same rule for tabs.
- [ ] Revert every temporary edit (check with `git diff --stat`), and record the medians.

### Task 2: Motion tokens and the switch's exemption

**Files:** `app/globals.css`

- [ ] Back up `app/globals.css` to the scratchpad.
- [ ] Add the tokens to the existing `:root` token block (beside `--ease-out`, line 77):

```css
  --motion-exit: 150ms;
  --motion-enter: 220ms;
  --motion-breathe: 3600ms;
  --motion-loader-delay: 1000ms;
  --ease-calm: cubic-bezier(0.37, 0, 0.63, 1); /* ease-in-out sine: the crest's breath only */
```

- [ ] Change both motion off switches (`globals.css:295-319`), so the crest keeps its own delay (decision 1). Keep every declaration as it is; only the selectors change:

```css
@media (prefers-reduced-motion: reduce) {
  *:not(.crest-loader, .crest-loader *),
  *:not(.crest-loader, .crest-loader *)::before,
  *:not(.crest-loader, .crest-loader *)::after,
  *::backdrop {
```

and the same `:not(…)` on the three `:root[data-low-data] …` selectors. Extend the comment above them: "The crest loader is left out: its 1 s delay keeps a fast load from showing or announcing it, and its own rules give these users a still fade (calm navigation plan decision 1)."

- [ ] `pnpm e2e tests/e2e/reveal.spec.ts tests/e2e/role-views.spec.ts --project=phone-390` (the existing reduced-motion and data-saver checks still pass).
- [ ] Commit: `style: motion tokens, and the crest loader left out of the motion off switches (calm navigation Task 2)`

### Task 3: The breathing crest in `PageFallback`

**Files:** create `components/brand/CrestLoader.tsx` and `CrestLoader.test.tsx`; modify `components/ui/PageFallback.tsx`, `app/globals.css`

- [ ] **Write the failing test** (`components/brand/CrestLoader.test.tsx`):

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CrestLoader } from "./CrestLoader";

describe("CrestLoader", () => {
  it("draws the navy crest as decoration and says Loading in a status", () => {
    const { container } = render(<CrestLoader />);
    const crest = container.querySelector("img");
    expect(crest).toHaveAttribute("alt", "");
    expect(crest?.getAttribute("src")).toMatch(/crest-navy/);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
```

- [ ] Run `pnpm test components/brand/CrestLoader`. Expect it to fail (no module).
- [ ] **Write `components/brand/CrestLoader.tsx`:**

```tsx
import Image from "next/image";
import crestNavy from "@/assets/brand/crest-navy.png";

/**
 * The loading sign for a page with nothing to show yet (calm navigation spec 4, layer 1). Hidden for a second, so a
 * fast load never shows it, then it fades in and breathes. The status text appears with it, so a screen reader hears
 * "Loading…" only on a real wait. Only PageFallback uses it: pages with a skeleton already show what's coming.
 */
export function CrestLoader() {
  return (
    <div className="crest-loader">
      <Image src={crestNavy} alt="" width={33} height={56} fetchPriority="low" className="crest-loader-mark" />
      <p role="status" className="crest-loader-status">
        <span className="sr-only">Loading…</span>
      </p>
    </div>
  );
}
```

(The crest is 362 × 609, so 33 × 56 keeps its shape. Check `Pennant.tsx` for how it sizes the same import, and match it.)

- [ ] **`PageFallback`:** render `<CrestLoader />` inside the `page-fallback` div. Drop `aria-hidden` from the outer div, because the status must be heard. Update its doc comment: "…and, once the wait passes a second, the breathing crest (calm navigation spec 4)."
- [ ] **The CSS** (`app/globals.css`, in the page transition block):

```css
/* --- The crest loader (calm navigation spec 4, layer 1) --------------------------------------------------------------
   Inside PageFallback's screen-tall space, centred in the first screen. Hidden for --motion-loader-delay so a fast load
   never shows it; then a 400 ms fade, then a slow breath (motion only when wanted). Left out of the motion off switches
   (plan decision 1), so reduced motion and data saver keep the delay and the fade, with no breath. */
.page-fallback {
  display: grid;
  place-items: start center;
}

.crest-loader {
  display: grid;
  justify-items: center;
  margin-top: 30svh;
  opacity: 0;
  animation: crest-in 400ms var(--ease-out) var(--motion-loader-delay) both;
}

.crest-loader-status {
  visibility: hidden;
  animation: crest-announce 1ms linear var(--motion-loader-delay) both;
}

@media (prefers-reduced-motion: no-preference) {
  :root:not([data-low-data]) .crest-loader-mark {
    animation: crest-breathe var(--motion-breathe) var(--ease-calm) calc(var(--motion-loader-delay) + 400ms) infinite;
  }
}

@keyframes crest-in {
  to {
    opacity: 1;
  }
}

@keyframes crest-announce {
  to {
    visibility: visible;
  }
}

@keyframes crest-breathe {
  50% {
    opacity: 0.65;
    scale: 1.04;
  }
}
```

(Check `.page-fallback` at `globals.css:2045` first: if it already sets `display`, merge into that rule rather than adding a second.)

- [ ] Run `pnpm test components/brand components/ui`. Expect a pass.
- [ ] **Check the announcement with VoiceOver** (macOS Safari, and iOS if at hand). Screen readers don't all announce a live region whose text goes from `visibility: hidden` to visible.
  - If VoiceOver says nothing, try the text as a CSS-revealed `::after { content: "Loading…" }` inside the status. Generated content changes are announced more widely.
  - If neither works, keep the status as it is, and record in PROGRESS that the wait isn't announced. That's acceptable: the crest is decorative, and the page's heading is announced when it arrives. No JavaScript is added for this.
- [ ] **Look at it:** `preview_start` `vossie-dev`. Throttle a client navigation to a listing (delay its RSC request in DevTools or with a short Playwright snippet), and screenshot at 390 and 1440 at about 2 s.
- [ ] Commit: `feat: the breathing crest in PageFallback, shown only after a second (calm navigation Task 3)`

### Task 4: `Reveal`: outlines fade into content

**Files:** create `components/kit/Reveal.tsx` and `Reveal.test.tsx`; modify about 57 `app/**/page.tsx`, `components/saved/SavedTabs.tsx`, `app/globals.css`

- [ ] **Write the failing test:** with a suspending child (a thrown promise, as other kit tests do, or `React.lazy`), `Reveal` renders the fallback first, then the child once it resolves.
- [ ] **Write `components/kit/Reveal.tsx`:**

```tsx
import { Suspense, ViewTransition, type ReactNode } from "react";

/**
 * A page's main Suspense boundary, whose outline fades out as the content fades in (calm navigation spec 4, layer 2).
 * default="none" on both, so neither animates on anything else. The fallback's root must be an element: a
 * ViewTransition only fires enter and exit when it comes before any DOM node. Not for small inline boundaries or the
 * home sections, which have their own scroll reveals (plan decision 2).
 */
export function Reveal({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="reveal-out" default="none">
          {fallback}
        </ViewTransition>
      }
    >
      <ViewTransition enter="reveal-in" default="none">
        {children}
      </ViewTransition>
    </Suspense>
  );
}
```

- [ ] **The CSS** (page transition block, inside the existing `@media (prefers-reduced-motion: no-preference)`, with `:root:not([data-low-data])` like its siblings):

```css
  :root:not([data-low-data])::view-transition-old(.reveal-out) {
    animation: var(--motion-exit) var(--ease-out) both vt-fade reverse;
  }

  :root:not([data-low-data])::view-transition-new(.reveal-in) {
    animation:
      var(--motion-enter) var(--ease-out) var(--motion-exit) both vt-fade,
      var(--motion-enter) var(--ease-out) var(--motion-exit) both vt-rise;
  }
```

with `@keyframes vt-rise { from { transform: translateY(6px); } }` beside `vt-slide-in`. The existing reduced-motion and data-saver rules (`animation: none` on every view-transition pseudo-element) already cover these.

- [ ] **Move the page-level boundaries.** In every file `grep -rln "fallback={<[A-Z]\w*\(Skeleton\|Fallback\)" app` lists (57 at writing), plus `components/saved/SavedTabs.tsx`:
  - Replace that `<Suspense fallback={<X />}>…</Suspense>` with `<Reveal fallback={<X />}>…</Reveal>`.
  - Leave `fallback={null}` boundaries and every boundary under `components/home/` alone (decision 2).
  - Keep each page's comment on its boundary.
  - Where a page has two skeleton boundaries, only the one around the main content moves. Read each page; don't sed.
- [ ] **Check that each fallback's root is an element,** not a fragment or a component returning several siblings. `PageFallback` and the `*Skeleton` components are single elements; check the rest.
- [ ] Run `pnpm typecheck && pnpm lint && pnpm test components/kit app`.
- [ ] **Measure decision 5:** `pnpm build`, then `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/cls.spec.ts --project=phone-390 --project=desktop-1440`. Compare LCP with Task 0. Apply decision 5's fallback steps if needed, and record the numbers.
- [ ] Commit: `feat: page outlines fade into their content through Reveal (calm navigation Task 4)`

### Task 5: Every page moves the same way

**Files:** create `lib/motion.ts` and `lib/motion.test.ts`; modify `components/kit/PageTransition.tsx`, `app/globals.css`, the 31 pages without `PageTransition`, and the links below

- [ ] **Write `lib/motion.ts`:**

```ts
// The navigation types a link can carry (calm navigation spec 4, layer 3). PageTransition maps them to animations;
// links pass them as transitionTypes. Untyped navigations (Server Action redirects, browser Back) don't animate.
export const TAB = ["nav-tab"];
export const FORWARD = ["nav-forward"];
export const BACK = ["nav-back"];

/** Listing and shop cards. Task 1 measured <numbers> on slow 3G at 390, so cards <slide / crossfade / don't animate>. */
export const CARD = FORWARD; // or TAB, or undefined, per Task 1
```

- [ ] **Write the failing guard tests** (`lib/motion.test.ts`, reading files with `node:fs` like `app/privacy/page.test.tsx` does):
  1. Each of `nav-tab`, `nav-forward`, `nav-back`, `reveal-in` and `reveal-out` has a `::view-transition-new(.…)` or `-old(.…)` rule in `app/globals.css`.
  2. Every `app/**/page.tsx` contains `PageTransition`. List any exception in the test with its reason (expect none; `not-found.tsx` and `error.tsx` aren't `page.tsx`).
  3. Every `.tsx` under `components/` and `app/` whose JSX has a link reading "Back to" also contains `BACK`.
  4. No file under `components/` or `app/` (tests aside) contains `transitionTypes={["`.
- [ ] Run `pnpm test lib/motion`. Expect guards 2 to 4 to fail.
- [ ] **`PageTransition`:** add `"nav-back": "nav-back"` to `BY_TYPE`, and update the comment: "…links back carry 'nav-back' (the slide mirrored). Browser Back never animates: React skips popstate."
- [ ] **CSS:** a `nav-back` pair beside `nav-forward`, inside the same media query, with the slide mirrored:

```css
  :root:not([data-low-data])::view-transition-old(.nav-back) {
    animation:
      140ms ease-in both vt-fade reverse,
      200ms ease-in both vt-slide-back-out;
  }

  :root:not([data-low-data])::view-transition-new(.nav-back) {
    animation:
      200ms var(--ease-out) 60ms both vt-fade,
      200ms var(--ease-out) both vt-slide-back-in;
  }
```

with `vt-slide-back-out` (to `translateX(12px)`) and `vt-slide-back-in` (from `translateX(-12px)`).

- [ ] **`PageTransition` on the 31 pages without it** (`for f in $(find app -name page.tsx); do grep -q PageTransition $f || echo $f; done`):
  - Wrap each page's returned content, outside its `<Suspense>`/`<Reveal>`, as CLAUDE.md says.
  - The homepage too: its scroll reveals sit inside and don't conflict, because the page transition only runs on a typed navigation.
- [ ] **Tag the links** (import from `@/lib/motion`):
  - **TAB:**
    - `components/tabbar/TabBar.tsx`: passes `transitionTypes` to each `NavLink`.
    - `components/header/SiteHeader.tsx`: the quick links (Shop, Sell, Hub, Looking For, How it works, Safety). Not the pennant home link: it calls `goHome`, so check that it still works with a type before tagging it, and leave it untagged if unsure.
    - `components/menu/MenuDrawer.tsx`: the drawer's page links. The drawer closes on navigation; check that the crossfade doesn't fight its close animation at 390, and leave it untagged if it does.
    - `components/kit/SectionBar.tsx`: the literal becomes `TAB`.
  - **FORWARD:**
    - The existing literals in `components/kit/ListRow.tsx`, `StatTile.tsx`, `NeedsYouList.tsx`, `components/charts/BarList.tsx` and `components/staff/NextInQueue.tsx` become `FORWARD`.
    - New: `components/hub/HubPostCard.tsx`, `components/looking-for/RequestRow.tsx`, the rows in `components/messages/InboxView.tsx` and `NotificationsView.tsx`.
  - **CARD:** `components/listings/ListingCard.tsx`, and the shop links in `components/hub/VerifiedSellers.tsx` and `components/saved/FollowedShopsView.tsx`.
  - **BACK:** every "Back to…" link that `grep -rln "Back to" components app` finds (about 20 files: messaging's thread, composer and report views, Looking For's offer, form, delete and your-requests views, `BookSlot`, the staff confirm pages, the selling and account pages, sign-in). Guard 3 lists any that are missed.
  - **Pass `transitionTypes` only to `next/link` or `NavLink`,** never to a `<form>` or a Server Action button. Redirects stay untyped (spec 8.3).
- [ ] Run `pnpm test lib/motion components app && pnpm typecheck && pnpm lint`. Expect a pass.
- [ ] **Look at it:** `preview_start` `vossie-dev` at 390. Tap a tab, a card, a row, then a "Back to…" link, then browser Back (instant). Check for no double animation on the homepage and that the header and bars never move.
- [ ] Commit: `feat: every page moves the same way: tabs crossfade, deeper slides, Back to slides back (calm navigation Task 5)`

### Task 5b: The header crest breathes while a tap waits (decision 6)

**Files:**
- create `components/ui/NavPending.tsx` and `NavPending.test.tsx`
- modify `components/ui/NavLink.tsx`, `components/header/useHeaderMode.ts`, `components/brand/Pennant.tsx` (or `SiteHeader.tsx`, wherever the slot is), `app/globals.css`, `lib/motion.test.ts`, and each typed link from Task 5

- [ ] **Write the failing test** (`NavPending.test.tsx`). Mock `next/link`'s `useLinkStatus`:
  - pending sets `data-nav-pending` on `<html>` and fires `vossie:nav-pending` once;
  - not pending, or unmounted, removes the attribute;
  - two pending instances, one then the other, leave it set until both are done (a module-level count).
- [ ] **Write `NavPending`:**

```tsx
"use client";

import { useLinkStatus } from "next/link";
import { useEffect } from "react";

// Pending links on the page (Next shows only the last tapped one, but a quick second tap can overlap the first's cleanup).
let pendingCount = 0;

/**
 * Renders nothing. Inside a <Link>, it marks <html data-nav-pending> while that link waits for the server, so the header
 * crest breathes (calm navigation spec 4, layer 4), and asks the header to come back if scrolling hid it. Only taps on
 * links that weren't prefetched are ever pending.
 */
export function NavPending() {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    pendingCount += 1;
    document.documentElement.setAttribute("data-nav-pending", "");
    window.dispatchEvent(new Event("vossie:nav-pending"));
    return () => {
      pendingCount -= 1;
      if (pendingCount === 0) document.documentElement.removeAttribute("data-nav-pending");
    };
  }, [pending]);
  return null;
}
```

- [ ] **Its event name** gets a constant (as `lib/install-event.ts` does for the install event), imported by both files.
- [ ] **`NavLink`:** render `<NavPending />` as the last child, both in the plain fallback link and in `CurrentAwareLink`. Keep NavLink's "props passed through" style.
- [ ] **`useHeaderMode`:** listen for the event and call its existing `show()`. Remove the listener on cleanup. Read the hook first: if `show()` scrolls or moves focus, use the part that only changes the mode.
- [ ] **The typed links** (Task 5's TAB, FORWARD, CARD and BACK sites that are plain `next/link`): add `<NavPending />` as the link's last child. It's a client component inside a server one, which is fine.
  - Add guard 5 to `lib/motion.test.ts`: every file that passes `transitionTypes={` either is a `NavLink` user or renders `<NavPending`.
- [ ] **CSS:**
  1. Rename the switch's exemption from `.crest-loader` to `.motion-own` (both switches, and the comment), and put the `motion-own` class on `.crest-loader`'s div and on `.hdr-pennant-slot`.
  2. Add the cue:

```css
/* The header crest while a tapped link waits (calm navigation spec 4, layer 4). After 150 ms, so a fast tap shows
   nothing. Reduced motion and data saver dim it, still; .hdr-pennant-slot is .motion-own, so they keep the delay. */
html[data-nav-pending] .hdr-pennant-slot .pennant-crest {
  animation: crest-wait-dim 1ms linear 150ms both;
}

@media (prefers-reduced-motion: no-preference) {
  :root:not([data-low-data])[data-nav-pending] .hdr-pennant-slot .pennant-crest {
    animation: crest-breathe var(--motion-breathe) var(--ease-calm) 150ms infinite;
  }
}

@keyframes crest-wait-dim {
  to {
    opacity: 0.65;
  }
}
```

  Check that `.pennant-crest`'s existing rules (`globals.css:429`) have no `animation` of their own to override. If they do, combine them.
- [ ] Run `pnpm test components/ui components/header lib/motion && pnpm typecheck && pnpm lint`.
- [ ] **Measure:** rebuild, run `performance.spec.ts` at 390, and record each page against Task 0. If the listing forms come within 150 B of the budget, tell Lama before going on.
- [ ] **Look at it:** reuse the Task 3 throwaway (a 3 s delayed RSC response). Tap a card at 390 after scrolling the list, and screenshot at 0.5 s and 1.6 s. Expect the header back and the crest mid-breath.
- [ ] Commit: `feat: the header crest breathes while a tapped link waits for the server (calm navigation Task 5b)`

### Task 6: `motion.spec.ts`

**Files:** create `tests/e2e/motion.spec.ts` (device projects, run at `phone-390` and `desktop-1440`, skipping others like `reveal.spec.ts`)

- [ ] **The crest waits:**
  - From `/browse`, delay the RSC request for the tapped listing's route by 2.5 s with `page.route` (match `/listings/` requests carrying the `RSC` header), then tap the card.
  - At 500 ms, `.crest-loader` has computed opacity 0, and the status's `visibility` is `hidden`.
  - At 1.6 s, opacity is above 0.9 and the status reads "Loading…".
  - After the content arrives, there's no `.crest-loader`.
- [ ] **A fast load says nothing:** with no delay, the same tap never makes the status visible (poll every 100 ms until the `h1` shows).
- [ ] **Reduced motion** (`page.emulateMedia({ reducedMotion: "reduce" })`) **and data saver** (set `html[data-low-data]` the way `shell.spec.ts` does):
  - The crest still waits a second (same timings as above).
  - `.crest-loader-mark`'s computed `animation-name` isn't `crest-breathe`.
  - During a tab navigation, `::view-transition-new(*)` computes `animation-name: none`. Reuse the role views spec's pseudo-element check if it has one (`grep -rn "view-transition" tests/e2e`).
- [ ] **The header cue (Task 5b):** delay a card's RSC response by 3 s, scroll the list so the header hides, then tap.
  - At 100 ms, `<html>` may have `data-nav-pending`, but the header crest's opacity is still 1.
  - At 600 ms, the header is shown (`data-mode` isn't `hidden`) and the crest's `animation-name` is `crest-breathe`. Under reduced motion it's `crest-wait-dim`, with opacity 0.65.
  - Once the listing arrives, `data-nav-pending` is gone.
- [ ] **The crest loader (layer 1)** shows only while a page's frame waits on streaming content, which is rare live (Task 3 found it never showed on a slow listing: the whole response was slow, so the old page stayed). Check its timings with no test-only route:
  - Mount `PageFallback` on a real page by holding the streamed part, if Playwright can separate it.
  - Failing that, put a `PageFallback` into a page with `page.evaluate`, and read the computed opacity and status visibility at 500 ms and 1.6 s.
  - Note in PROGRESS that the live case is rare.
- [ ] **Axe:** no serious or critical issues on a listing page while the crest shows.
- [ ] **Service workers:** every `browser.newContext(` says `serviceWorkers: "block"` (CLAUDE.md).
- [ ] Run `pnpm e2e tests/e2e/motion.spec.ts`. Expect a pass.
- [ ] Commit: `test: motion spec: the crest's delay and announcement, reduced motion and data saver (calm navigation Task 6)`

### Task 7: Gates and docs

- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. After the build, `grep -l "serviceWorker.register" .next/static/chunks/*.js` prints nothing.
- [ ] Run `pnpm e2e`. If tests fail under load, re-run them alone and record both runs, as earlier stages did. Record each page's first-visit JS against Task 0 (expected change: about 0, plus a few dozen bytes on every page from `SiteHeader` and `MenuDrawer` importing `lib/motion.ts`).
- [ ] Have Lama do a manual pass: slow 3G on a cheap Android (tabs, a card, Back to, a slow listing). Note what Lama says in PROGRESS.
- [ ] **`docs/reference/LANDING-DECISIONS.md`:** the next decision (90 at writing), "Calm navigation". It says:
  - Motion by default, and the crest only in `PageFallback` after 1 s.
  - Suspense reveals fade (this amends role views plan decision 2).
  - Browser Back and redirects don't animate.
  - No cross-document transitions.
  - Task 1's numbers and the `CARD` choice.
  - Decision 5's LCP result.
- [ ] **`docs/superpowers/specs/2026-10-22-role-views-design.md` §4.4:**
  - Strike "Browser Back has no direction, so it crossfades".
  - Add one line: "Amended by `2026-10-26-calm-navigation-design.md`: every page, `nav-back`, and Suspense reveals."
- [ ] **`CLAUDE.md`:** replace the "Page transitions" bullet with:

> - Page transitions (calm navigation, decision 90): every page wraps its content in `PageTransition` (outside the page's `<Suspense>`; a test reads the folders). Links take their type only from `lib/motion.ts`: `TAB` (tab bar, header quick links, menu, section bars), `FORWARD` (rows one level deeper), `CARD` (listing and shop cards), `BACK` ("Back to…" links; a test checks). Never a literal `["nav-…"]`. Browser Back and Server Action redirects don't animate. A page's main Suspense boundary is `Reveal` (`components/kit/Reveal.tsx`: the outline fades out, the content fades in); not the home sections (they have scroll reveals) or `fallback={null}` boundaries. The breathing crest (`CrestLoader`) is only in `PageFallback` and appears after `--motion-loader-delay` (1 s); it is left out of the motion off switches so reduced motion and data saver keep that delay, with a still fade. Never two elements with one `view-transition-name`. All of it is off for reduced motion and data saver.

- [ ] **`docs/PROGRESS.md`:** the session's entry (tasks, numbers, the test results with counts, anything left).
- [ ] Commit (controller, with Lama's go-ahead): `docs: calm navigation: decision 90, CLAUDE.md's page transitions rule, role views 4.4 amended, progress`

---

## Self-review against the spec

- **Spec §2's table,** row by row:
  - tabs → Task 5 TAB; cards and rows → Task 5 FORWARD/CARD; Back to → BACK;
  - browser Back → nothing (`PageTransition` comment);
  - outline → Task 4; crest → Task 3;
  - full page loads → untouched; press → untouched.
- **Spec §4 layer 1:**
  - the 1 s delay, the 400 ms fade, the 3.6 s breath, opacity and transform only → Task 3's CSS;
  - status after the delay → `crest-announce`;
  - reduced motion still fade → decision 1 and Task 6;
  - `fetchPriority="low"`, navy → Task 3.
- **Layer 2:**
  - 150 ms out, 220 ms in with a 6 px rise delayed 150 ms → Task 4's CSS;
  - not the home sections and inline boundaries → decision 2.
- **Layer 3:**
  - site-wide `PageTransition`, `default="none"` kept, `lib/motion.ts`, `nav-back` → Task 5;
  - card sliding depends on the image wait → Task 1 and decision 3.
- **Spec §7 tests** → Tasks 3 to 6. **Spec §9 order** → Tasks 1 to 7. **Spec §8 answers** → reflected.
- **Not in this plan** (spec 8.1): the link pending cue (`useLinkStatus`) and the official crest SVG (waiting on Eduvos).
