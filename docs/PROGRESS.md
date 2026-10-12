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
- **JS budget.** It's measured as a host serves it, brotli at quality 5. The shell uses 145.7 KB of the 150 KB, so the performance test passes. Part 2 has about 4 KB of JS to spend.
- **Contrast.** Small text on the star texture is now white: the footer headings, the menu's "Change" link and the current campus row. Sky stays for large text, icons, pills and the wordmark.
- **Unchanged by choice:**
  - the footer wordmark stays sky;
  - the announcement bar stays flush on the header on phones;
  - the footer's campuses go into two columns in Part 2.
- **Dev server.** Tailwind now runs through PostCSS, and the Turbopack dev cache is off. `pnpm dev` shows `globals.css` edits in about 0.1s; before, they never showed. Production CSS is byte-identical.
- **Checks:** 173 unit tests pass. End to end, 199 pass and 71 are skipped by design, with no failures.

## Next
- Write Part 2 of the plan (the 14 homepage sections) against the real Part 1 code, then build it. The plan's "Handoff to Part 2" section lists what to use and what to add.

## Waiting on
- Eduvos font files and licence confirmation.
- The official crest SVG.
- Photos (after the homepage is built).
