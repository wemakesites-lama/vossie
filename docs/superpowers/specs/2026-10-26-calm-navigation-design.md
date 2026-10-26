# Calm navigation and the breathing crest: design

Date: 2026-10-26 · Status: revised after research, for Lama's review · Amends role views spec 4.4 and its plan decision 2 ("only typed navigations animate; Suspense reveals don't")

## 1. What Lama asked for

Moving between pages, and waiting for one to load, should feel smooth and calming. While a page loads, the Eduvos crest fades in, breathes slowly, and fades out.

Lama, 2026-10-26: most clicks shouldn't show the crest, only smooth animation. Research how the industry does this before building. Scope: layers 1 to 3 (the ones that add no JavaScript), with the recommended answers to the open questions (section 8).

## 2. The rule this design follows

**Motion by default; the crest only when waiting is real.**

Most clicks get no loader at all. They get a short, soft animation from the old page to the new one. The crest appears only when there's nothing to show and the wait has passed about a second.

| What happens | How often | What the student sees |
|---|---|---|
| A tapped link is still waiting for the server (over 150 ms) | on slow data, most taps | The header comes back if it was hidden, and its crest breathes until the new page arrives (layer 4). |
| Tap a tab, the menu or a header link | dozens of times a day | 120 ms out and 180 ms in, opacity only. No loader. |
| Open a card or row (going deeper) | often | 200 ms 12 px slide plus fade. No loader. |
| A "Back to…" link | often | The same slide, reversed. |
| Browser Back or a swipe back | often | Instant swap. React doesn't animate it (section 3.4). |
| The page's outline is shown while content streams | sometimes | The skeleton fades out (150 ms) and the content fades in with a 6 px rise (220 ms). |
| Nothing to show, and the wait passes about 1 s | rarely | The breathing crest fades in. When the content arrives, it fades out as the page fades in. |
| Sign-in, sign-out, account deletion (full page loads) | rarely | Unchanged: the browser's own load. |
| A button or row is pressed | constantly | The existing 100 ms scale 0.98 (role views spec 4.5). |

## 3. Research: how the industry does this

### 3.1 When a loading indicator helps (Nielsen Norman Group)

- **Under 1 second, show no loader.** Looping a loading animation for anything faster is distracting. Still give immediate feedback: that's the press state and the page transition.
- **1 to 10 seconds:** a skeleton for a full page whose layout is known, or a looped indicator for one part of a page. Looped indicators are meant for 2 to 10 seconds.
- **Over 10 seconds:** a percent-done bar. That doesn't apply to navigation. Photo uploads keep their own progress.
- **Frame-only placeholders** (header and background, no content shapes) aren't recommended. That's today's blank `PageFallback`, so it's the right place for the crest: it gives the empty frame a sign that something is coming.

### 3.2 Splash screens (Apple's Human Interface Guidelines)

- A launch screen isn't a splash screen or a branding moment. It should look like the first screen, so the app feels ready at once.
- A logo belongs only where it's part of the real screen.

So: no full-screen crest over pages, and no crest on a first visit. The crest is a loading sign inside the page's own space, never a cover. A cover would also become, or delay, the page's LCP and risk layout shift on mobile data.

### 3.3 Motion by frequency (Material motion; Emil Kowalski's animation guidance)

- **The more often something happens, the less it should move.** Constant actions get little or no animation. Occasional ones (drawers, dialogs) get standard motion. Rare moments can be more expressive.
- **Keep UI transitions under about 300 ms.** Ease-out (fast start, gentle stop) for things arriving. Avoid ease-in on entrances, which feels sluggish.
- **Material's navigation patterns:** a crossfade ("fade through") between unrelated destinations, a shared axis (a short slide) between parent and child, and a plain fade for things appearing.
- **What this means here:** tabs and the menu get the 120/180 ms crossfade CampusCart already has (tab switches are the most frequent action). Cards and rows get the slide. Everything stays in the 150 to 220 ms range.

### 3.4 What React and Next actually do (react.dev `<ViewTransition>`; Next 16.4 docs in `node_modules/next/dist/docs`)

- **What animates:** `<ViewTransition>` animates updates made in a Transition, a `<Suspense>` reveal or `useDeferredValue`. App Router navigations are Transitions, so typed links animate. It's part of React, so it adds about 0 bytes.
- **Browser Back doesn't animate.** React skips animations started by `popstate`, because scroll and form restoration must finish synchronously. The earlier draft's "Back crossfades" isn't possible, and the spec 4.4 line "Browser Back has no direction, so it crossfades" was never true in practice. Back stays an instant swap.
- **React waits up to 500 ms for visible images and fonts** before animating, so they don't pop in mid-animation. A slide from a card to a listing page full of photos could hold the navigation up to 500 ms on slow data. It has to be measured (Task 1 of the build) before card links get the slide.
- **The fallback-out, content-in handoff:** a Suspense reveal can animate as two parts, an `exit` on a `ViewTransition` around the fallback and an `enter` on one around the content. This is the crest fading out as the page fades in.
- **Wrapping a whole page:** the outer `ViewTransition` needs `default="none"` (or `update="none"`), so ordinary updates inside the page (search filters, form states) don't crossfade the whole page. `PageTransition` already does this.
- **`<ViewTransition>` must come before any DOM node,** or enter and exit don't fire.
- **Reduced motion:** React doesn't turn anything off by itself. CSS must, and CampusCart already does for reduced motion and data saver.

### 3.5 Full page loads (Chrome guidance, via Shopify's theme docs)

- **Cross-document view transitions** (`@view-transition { navigation: auto }`) hold rendering while the browser waits for the next page. Input in that window shows up as poor INP, and Chrome's advice is to cancel them on interaction.
- **Why that rules them out here:** sign-in and sign-out are 303 round trips. On a South African phone on mobile data, that's a frozen page. **Dropped.** Spec 4.4's "not used" line stands.

### 3.6 Accessibility (WCAG 2.2)

- **2.2.2 Pause, Stop, Hide:** a looping animation during a loading phase is allowed when nothing else can be done and its absence could confuse. The breathing crest fits this.
- **Reduced motion:** `prefers-reduced-motion` turns the breathing off. The crest fades in and stays still.
- **Screen readers:** a `role="status"` with "Loading…" appears after the same delay, so a fast load says nothing.

## 4. Design

Three layers. All are CSS and Server Components, with no new client code, and all are off under reduced motion and data saver (`html[data-low-data]`).

### Layer 1: the crest, only in the empty fallback (0 B JS)

- **A new `CrestLoader`** (Server Component, `components/brand/CrestLoader.tsx`). It's the navy crest on white (brand rules), about 56 px tall, centred in `PageFallback`'s screen-tall space.
- **Timing:**
  - Hidden for 1 s, so most waits never show it.
  - It fades in over 400 ms, then breathes: scale 1 to 1.04 and opacity 0.65 to 1, 3.6 s per breath, eased in and out.
  - Only `opacity` and `transform`.
  - A load that ends between 1 and 1.4 s shows a faint glimpse, never a flash.
- **Where it goes:** only `PageFallback`. That's the five pages that wait on their params: listing, storefront, Looking For request, collection, Hub post. Their layout varies too much for a skeleton.
  - The fallback keeps its height, so layout shift doesn't change.
- **Where it doesn't go:** anywhere with a skeleton. A crest over a skeleton is two loading signs at once.
- **Screen readers:** visually hidden "Loading…" in a `role="status"`. It's revealed by the same 1 s delay through a `visibility` keyframe, so it's announced once, and only on a real wait.
- **Reduced motion and data saver:** the crest fades in after 1 s and stays still.
- **The image:**
  - The 35 KB PNG goes through `next/image` at 56 px, which gives an AVIF of about 2 to 3 KB.
  - It's loaded with `fetchPriority="low"`, so it's fetched during the 1 s delay and never competes with the page.
  - It's inlined as an SVG (no request) once Eduvos sends the official one. CLAUDE.md: the crest comes only from `assets/brand/`.

### Layer 2: content arrives softly (0 B JS)

- **A small `Reveal` helper** (Server Component, `components/kit/Reveal.tsx`): `<Suspense>` with `<ViewTransition exit="reveal-out" default="none">` around the fallback and `<ViewTransition enter="reveal-in" default="none">` around the content.
- **Where it goes:** the page-level boundaries whose fallback is `PageFallback` or a page skeleton, plus the homepage's section skeletons (each fades in on its own, which reads as calm).
  - Inline boundaries with `fallback={null}` (badges, links) stay plain Suspense. Nothing visible leaves, so nothing should move.
- **Out:** 150 ms fade. **In:** 220 ms fade plus a 6 px rise, the fade delayed 150 ms so the two never overlap.
- **The guardrail:** a skeleton must still be no taller than its page. The existing `cls.spec.ts` and skeleton-height tests keep guarding it.

### Layer 3: every page moves the same way (about 0 B JS)

- **`PageTransition` on every page.** Today it's only on section pages and `/account`. Add the public pages: home, browse, listing, storefront, Hub, Looking For, Saved, inbox, thread, notifications, the info pages and sign-in.
  - It stays in the page, never a layout (layouts don't remount).
  - It stays `default="none"`, so updates inside a page never crossfade.
- **One place names the types:** `lib/motion.ts` exports `TAB`, `FORWARD` and `BACK` (`["nav-tab"]`, `["nav-forward"]`, `["nav-back"]`). Links pass `transitionTypes={TAB}` and so on. No wrapper component is needed: `next/link` already takes the prop, and server components pass it as a plain array.
  - **Tab:** the main tab bar, the header's quick links, the menu drawer's links.
  - **Forward:** listing cards, list rows (already), shop cards, Hub posts, Looking For requests. Cards to listing pages only if Task 1's image-wait measurement is fine (section 3.4).
  - **Back:** the "Back to…" links.
- **A new `nav-back` animation:** the same slide as `nav-forward`, mirrored.
- **Untyped navigations** (Server Action redirects, links nobody tagged): no animation, as now. Browser Back can't animate anyway (section 3.4).

### Layer 4: the header crest breathes while a tap waits (one small client component)

**Why it was added (build, 2026-10-26).** Task 3's test slowed a listing's response and tapped a card. For as long as the server took, the old page stayed on screen unchanged, with no crest and no feedback.

- **Why the old page stays:** a tap swaps pages only once the server answers, and most links don't load ahead of time (decision 53, prefetching is off on most links). So on slow data, the old page sits frozen.
- **Why layer 1 rarely helps:** the `PageFallback` crest shows only when a page's frame arrives quickly and its content is slow. That's rare, because listings and most pages are built ahead of time.
- **Lama's choice (2026-10-26):** use Next's documented tool for blocked navigations, `useLinkStatus`. While a tapped link is pending, the crest in the header pennant breathes.

The design:

- **`NavPending`** (`components/ui/NavPending.tsx`, the one new client component) renders nothing.
  - It sits inside a `<Link>` and reads `useLinkStatus()`. While pending, it adds a count on `<html data-nav-pending>`, and its effect cleanup takes the count away again.
  - It also fires a `vossie:nav-pending` event once, which the header's `useHeaderMode` answers with its existing `show()`. If the header was hidden by scrolling, it comes back so the crest can be seen. The new page opens at the top with the header showing anyway, so this only brings forward what was coming.
  - Next shows only the last tapped link's pending state, so a second tap moves the cue rather than stacking it.
- **Where it goes:**
  - inside `NavLink`, which covers the tab bar, the header quick links and the menu;
  - inside every typed link: cards, rows, section bars and "Back to…" links.
  - A prefetched link is never pending, so it never shows the cue. That's fine, because it's already fast.
- **The look** is CSS only, in `app/globals.css`: `html[data-nav-pending] .hdr-pennant-slot .pennant-crest` breathes, with the same keyframes and timing as layer 1 (3.6 s, scale 1 to 1.04, opacity 0.65 to 1). It starts after a 150 ms delay, so a fast tap shows nothing.
- **Reduced motion and data saver:** no breath. After 150 ms the crest dims to 0.65 and stays still until the page arrives.
  - The header pennant keeps its 150 ms delay by leaving the motion off switches, like the crest loader. The exemption becomes one class, `.motion-own`, meaning "this element has its own reduced-motion rules".
- **Screen readers:** nothing new. The crest is decorative, and the destination's title and heading are announced on arrival, as now.
- **Cost:** one tiny client component in the layout chunk, plus a listener in `useHeaderMode`. Estimated at 250 to 400 B brotli on every page. The listing forms have 742 B of headroom (Task 0), so it's measured and recorded.

## 5. Motion tokens (one place, `app/globals.css`)

```css
:root {
  --motion-exit: 150ms;
  --motion-enter: 220ms;
  --motion-breathe: 3600ms;
  --motion-loader-delay: 1000ms;
  --ease-calm: cubic-bezier(0.37, 0, 0.63, 1); /* ease-in-out sine: the breath only */
}
```

- Arrivals keep `--ease-out`, as research says (section 3.3).
- `--ease-calm` is only for the breathing loop.
- The existing `vt-fade` and `vt-slide-*` keyframes keep their 120/180/200 ms timings and move onto these tokens.

## 6. What it costs and what it risks

| | JS | Risk and guard |
|---|---|---|
| Layer 1 crest | 0 B (CSS plus a 2 to 3 KB image, fetched only while a fallback shows) | Image late. `fetchPriority="low"` during a 1 s delay, SVG later. |
| Layer 2 reveals | 0 B | Layout shift. Skeleton heights are already tested; `cls.spec.ts` still runs. |
| Layer 3 transitions | 0 B (React's own), plus about 40 B of arrays | Up to 500 ms waiting for images before a slide (measured in Task 1). A lost tap is already handled by `::view-transition { pointer-events: none }`. Never two elements with one `view-transition-name`. |

## 7. Tests

- **Unit:** `CrestLoader` is decorative apart from its status text and uses the crest from `assets/brand/`. `Reveal` renders its fallback, then its children. `lib/motion.ts`'s types match the CSS class names (a test reads `globals.css`).
- **E2E (`tests/e2e/motion.spec.ts`, device projects):**
  - On a slow listing page, the crest isn't visible at 500 ms and is visible at 1.6 s.
  - The status text appears once.
  - Under reduced motion and under data saver, every view-transition pseudo-element and the crest's breathing compute `animation-name: none`.
  - Axe has no serious issues.
- **The existing guards:** `cls.spec.ts`, `performance.spec.ts` and `reveal.spec.ts` at 360, 390 and 1440.
- **Manual:** a slow-3G pass on a cheap Android (Lama). Calm is a feeling no test measures.

## 8. Lama's answers (2026-10-26)

1. **Scope:** layers 1 to 3 now. The link pending cue waits until these are tried. **Changed during the build (2026-10-26):** the frozen-page finding (layer 4) brought the cue in, as the header crest breathing, by Lama's choice.
2. **Reduced motion:** the crest fades in and stays still.
3. **Browser Back and form redirects:** asked as "a soft crossfade". Research found React doesn't animate Back (section 3.4). Redirects stay unanimated, so a form's result doesn't move under the student's finger.
4. **Sign-in full page loads:** asked as "add the crossfade". Research found it freezes the page on slow data (section 3.5), so it's dropped.
5. **Crest colour:** navy on white.

Answers 3 and 4 change because of the research, so Lama confirms them at plan review.

**Changed during the build (2026-10-26):** a page change with no type crossfades. Next 16.4 sometimes drops a link's types, and a redirect to another page has none, so a redirect crossfades too, which reverses answer 3's "redirects stay unanimated". Lama kept it.

## 9. Build order

1. **A spike:** measure the image wait. Time a card-to-listing navigation with and without `nav-forward` on slow 3G, at 390, as the Seller. If the slide adds more than about 150 ms, cards don't slide (they crossfade or don't animate).
2. Motion tokens, and the keyframes moved onto them (no visible change).
3. `CrestLoader` in `PageFallback`, with its tests.
4. `Reveal`, and the page-level boundaries moved onto it.
5. `lib/motion.ts`, the `nav-back` animation, `PageTransition` site-wide, and links tagged.
5b. `NavPending` in `NavLink` and the typed links; the header comes back while a tap waits, and its crest breathes.
6. `motion.spec.ts`, the CLS, performance and reveal runs, a decisions log entry, CLAUDE.md's "Page transitions" rule rewritten, and `docs/PROGRESS.md`.

## Sources

- Nielsen Norman Group, [Progress indicators](https://www.nngroup.com/articles/progress-indicators/) and [Skeleton screens](https://www.nngroup.com/articles/skeleton-screens/)
- Apple Human Interface Guidelines, [Launching](https://developer-rno.apple.com/design/human-interface-guidelines/patterns/launching)
- React, [`<ViewTransition>` reference](https://react.dev/reference/react/ViewTransition)
- Next.js 16.4 docs (installed): `01-app/02-guides/view-transitions.md`, `03-api-reference/04-functions/use-link-status.md`
- Material Design, [Duration and easing](https://m1.material.io/motion/duration-easing.html) and [Motion customization](https://material.io/design/motion/customization.html)
- Shopify (Chrome's guidance), [Cancel view transitions on interaction](https://shopify.dev/docs/storefronts/themes/best-practices/performance/cancel-view-transitions-on-interaction)
- web.dev, [View transitions for single page applications](https://web.dev/learn/css/view-transitions-spas)
- Emil Kowalski's animation guidance (secondhand, through [emil-design-eng](https://tessl.io/registry/skills/github/emilkowalski/skill/emil-design-eng))
