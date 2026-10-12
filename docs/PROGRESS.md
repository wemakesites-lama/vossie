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

## Next
- Lama reviews the Part 1 screenshots and settles the decisions below.
- Write Part 2 of the plan (the 14 homepage sections) against the real Part 1 code, then build it. The plan's "Handoff to Part 2" section lists what to use and what to add.

## Decisions for Lama
- **JS budget.** Do we measure JS as the host serves it (brotli, about 146 KB) or as `next start` serves it (gzip, over budget)? Either way, Part 2 needs its own JS allowance.
- **Small sky text on the star texture** (the footer headings and the menu's "Change" link). It is 4.97:1 on plain navy, but about 4.0:1 where a star sits behind a letter.
- **Footer wordmark colour:** white in the mockup, sky in the build.
- **Announcement bar on phones and tablets.** It sits flush on the header, so the pennant hangs from it, as in the mockup. Its tap target therefore touches the pennant's.
- **Footer height.** It is about 1620px at 1280. Should the campuses go into two columns in Part 2?

## Known issue: the dev server and CSS
- **Live edits.** While `pnpm dev` runs, edits to `app/globals.css` don't reach the page. Restart the dev server to see them.
- **Restarts.** Turbopack's dev cache (`.next/dev/cache`) can bring back stale CSS even after a restart. Setting `turbopackFileSystemCacheForDev: false` in `next.config.ts` stops that (tested), at the cost of slower dev starts.
- **Likely cause.** Live edits are missed with the cache off too, so the likely cause is the `@tailwindcss/turbopack` loader. Next's documented PostCSS setup (`@tailwindcss/postcss`) is the likely fix, but this isn't tested.
- **Production builds aren't affected.** That covers `pnpm build` and every end-to-end run. All CSS in Part 1 was checked on production builds.

## Waiting on
- Eduvos font files and licence confirmation.
- The official crest SVG.
- Photos (after the homepage is built).
