# Vossie build progress

## 2026-10-08
- Audited the live demo and mapped its functions (`docs/reference/LIVE-INVENTORY.md`, `docs/reference/FUNCTION-MAP.md`).
- Brainstormed the new homepage with Lama. Decisions are in `docs/reference/LANDING-DECISIONS.md`.
- Wrote the homepage spec, revision 2 (`docs/superpowers/specs/2026-10-08-homepage-design.md`).
- Wrote Part 1 of the build plan (`docs/superpowers/plans/2026-10-08-homepage-part-1-foundation-and-shell.md`).

## 2026-10-12: Part 1 built (foundation and site shell)
- Next.js 16.4 app with Eduvos tokens, interim fonts and a typed sample-data layer.
- Shell: announcement bar, crest header (crest-only on scroll, tap to reveal), menu, campus picker, search, toasts and the bold footer.
- Placeholder pages for every link, a branded 404, app icons and the install manifest.
- Checks:
  - lint and types are clean;
  - 173 unit tests pass;
  - end to end, 191 pass, 68 are skipped by design and 1 fails on purpose (the JS budget, below), across 360, 390, 768, 1024 and 1440px;
  - axe finds no serious or critical issues.
- First visit to the shell at 390px, gzipped as `next start` serves it:
  - JS 154.3 KB, against a budget of 150;
  - fonts 46.2 KB, against 60;
  - in total 234.9 KB, against 350.

  The JS is 697 bytes over the test's limit of 153,600 bytes (150 × 1,024). About 132 KB of it is the framework itself.
- Every task was reviewed, and a final review of the whole of Part 1 found nothing that needed restructuring.
- Review screenshots: `docs/progress/part-1/`.

## 2026-10-12: Lama's decisions applied
These are decisions 13 to 19 in `docs/reference/LANDING-DECISIONS.md`.
- **JS budget.** It's measured as a host serves it, brotli at quality 5. The shell uses 145,671 bytes of the 153,600 (150 × 1,024), so the performance test passes. Part 2 has 7,929 bytes, about 7.7 KB, to spend. (An earlier version of this note said about 4 KB, which mixed up the units.)
- **Contrast.** Small text on the star texture is now white: the footer headings, the menu's "Change" link and the current campus row. Sky stays for large text, icons, pills and the wordmark.
- **Unchanged by choice:**
  - the footer wordmark stays sky;
  - the announcement bar stays flush on the header on phones;
  - the footer's campuses go into two columns in Part 2.
- **Dev server.** Tailwind now runs through PostCSS, and the Turbopack dev cache is off. `pnpm dev` shows `globals.css` edits in about 0.1s; before, they never showed. Production CSS is byte-identical.
- **Checks:** 173 unit tests pass. End to end, 199 pass and 71 are skipped by design, with no failures.

## 2026-10-12: Part 2 planned
- Wrote Part 2 of the build plan (`docs/superpowers/plans/2026-10-12-homepage-part-2-sections.md`): 26 tasks covering spec 7.3 to 7.13, placeholder art, the end-to-end tests, the layout-shift check and Lighthouse.
- The plan lists 19 decisions made while planning for Lama to confirm or veto. Among them:
  - a darker idle grey that passes contrast;
  - a pause button for the Shop by campus cycle;
  - CSS-only scroll reveals.
- It keeps a JS ledger against the 7,929 bytes left, and stops for Lama at 152,000.

## 2026-10-12: Part 2 built (the homepage sections)
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
  - 302 unit tests pass;
  - end to end, 282 pass, 138 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px;
  - axe finds no serious or critical issues.
- First visit at 390px:
  - JS 151,705 B brotli, against 153,600;
  - fonts 46,212 B;
  - in total 332,372 B.
- Layout shift 0.0015 at 390 and 0.0036 at 1440. Lighthouse mobile (median of three): Performance 0.93, Accessibility 1.00.
- Review screenshots: `docs/progress/part-2/`.

## 2026-10-12: Lama's open points after Part 2
Lama went with Claude's recommendations. They are decisions 27 to 34 in `docs/reference/LANDING-DECISIONS.md`.
- **JavaScript.** The search overlay's `next/form` became a plain form with `router.push()`, saving 1,503 B. First visit JS is now 150,316 B brotli, 1,684 B under the stop line.
- **Mobile data.** Repeated card and tile links no longer prefetch. With data saver on, card and tile photos below the hero never load.
- **Shop by campus.** The cycle pauses off screen. On phones the chosen campus comes second, with its tick top-left. The header pill fills navy once a campus is chosen. Campus names have 8px gaps.
- **Smaller changes:**
  - Looking For's keyboard order matches its layout.
  - Footer columns no longer wrap at 1280 or 1440.
  - Sample events run to February 2027.
  - Collections hover is for a mouse only, and its arrow follows the title.
  - The viewer survives a failed campus lookup.
  - Just listed has an "all quiet" message.
- **Kept as built, with reasons in decision 33:** the hero's Play under reduced motion, the chip and pill wording, the scroll reveal's fade near the bottom edge, and the centred How it works heading.
- **LCP** (3.3 s simulated, against the spec's 2.5 s) is revisited when real photos arrive (decision 34).
- **Checks:** 310 unit tests. End to end, 283 pass, 142 are skipped by design and none fail.

## 2026-10-13: Browse and listing pages designed and planned
- **Go-live checklist:** `docs/reference/GO-LIVE.md` lists every page and view the marketplace needs before launch (about 45), the work that isn't a screen, the decisions for Lama and Eduvos, and a suggested order.
- **Brainstorm** (decisions 35 to 45): UI first on sample data. Every campus is browsable, and you collect at the listing's campus. Browse is category-led; the listing page has a gallery and an action dock. The link is the whole state, and the page opens on your chosen campus.
- **Spec:** `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md`.
- **Plan:** `docs/superpowers/plans/2026-10-13-browse-and-listing-pages.md`, 22 tasks. Its 18 plan decisions are for Lama to confirm or veto. Decision 18 corrects the spec: browse works without the app's JavaScript bundle, but not with JavaScript switched off entirely, because streamed content needs React's small inline script.

## 2026-10-13: Browse and listing pages built
- **Browse** (`/browse`): search with one-typo tolerance and seller names, ten category tabs, Filters (campus, price, paid with) and Sort as native `<details>`, removable chips, Show more, and empty and error states. The link is the whole state; it opens on the chosen campus. It works without the app's JavaScript (it still needs React's small inline script, which places the streamed results).
- **Listing pages** (`/listings/[id]`): photos (a swipe strip on phones, stacked on desktop), price wording for free and cash-or-swap, swap terms, where to collect it and a note when that isn't your campus, the seller, facts, a safety note, more from the seller, and paused and sold states. On phones the actions sit in a dock; on desktop the column stays in view. Message and Report go to the sign-in placeholder, which links back. Each listing has a share card for WhatsApp.
- **Data:** one listing model (free and swap items joined it), pickup points, 29 sellers, `searchListings`, `getListingDetail` and `getMoreFrom`.
- **Links:** `/categories/…` and `/c/…` redirect into browse; the homepage, menu, footer and search link straight to it.
- **Where the build differed from the plan** is in the plan's "Changes made during the build (2026-10-13)". The ones worth knowing:
  - Just listed changed at four more campuses than the plan said, as well as Pretoria (Bedfordview, Cape Town Mowbray, Eduvos Online and East London).
  - Listing pages stream their body too, so with JavaScript switched off entirely they are blank, like browse, and an unknown listing shows the 404 page with a 200 status. The spec and decision 39 now say so.
  - Show more has one small client effect, `ScrollToResult`, because Chrome sometimes ran its fragment scroll before the streamed card arrived.
- **Checks:**
  - lint and types are clean;
  - 453 unit tests pass;
  - end to end, 358 pass, 212 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px;
  - axe finds no serious or critical issues.
- **First visit at 390px, JS brotli:** homepage 150,937 B, browse 151,560 B, listing 152,078 B (limit 153,600 B).
  - The share card's `next/og` import adds 430 B to every page. That put the listing page 78 B over the 152,000 B stop line.
  - Lama accepted 152,078 B (decision 46). A branded `app/global-error.tsx` was tried to win bytes back; it added 207 B, so it was dropped.
- **Layout shift** (fonts held back, at 390 and 1440px):

  | Page | 390px | 1440px |
  |---|---|---|
  | Homepage | 0.0015 | 0.0036 |
  | Browse | 0.0003 | 0.0003 |
  | Listing | 0.0110 | 0.0055 |
  | Listing, campus Pretoria | 0.0110 | 0.0071 |
  | Browse, campus Midrand | 0.0003 | 0.0004 |
  | Browse, campus Mbombela | 0.0006 | 0.0004 |

- Review screenshots: `docs/progress/browse-listing/`.

## 2026-10-13: Open points for Lama after the browse and listing build
Review notes that were deliberately not acted on:
- Searches typed in browse's own field don't reach Recent searches. That needs client code, and the listing page has 1,522 B left under the limit.
- Header, footer and menu links to `/browse?…` still prefetch. Decision 28 keeps that for the header and footer.
- The gallery's focusable region is a tab stop on desktop, where it doesn't scroll.
- Small code-tidy items:
  - a duplicated newest-first comparator;
  - the `getMoreFrom` cache key carries the whole listing;
  - `lib/browse/query.ts` uses casts rather than type guards;
  - `scripts/make-placeholders.ts` has a double loop.
- `searchListings` caches free text. That's fine for sample data; revisit it with Supabase.

## Next
- Lama reviews the screenshots in `docs/progress/browse-listing/`. To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "browse and listing review screenshots"`.
- Then the next stage on the go-live checklist (`docs/reference/GO-LIVE.md`): the other public pages.

## Waiting on
- Eduvos font files and licence confirmation.
- The official crest SVG.
- Photos. The homepage is built, so each one is now a file drop plus one line in a fixture.
