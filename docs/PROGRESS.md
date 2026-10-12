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

## Next
- Lama reviews the Part 2 screenshots in `docs/progress/part-2/` against the mockup. They were retaken after the open-point changes; to retake them again, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "homepage review screenshots"`.
- Then the next stage of pages.

## Waiting on
- Eduvos font files and licence confirmation.
- The official crest SVG.
- Photos. The homepage is built, so each one is now a file drop plus one line in a fixture.
