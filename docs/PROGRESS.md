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

## Next
- Lama reviews the Part 2 plan and its decisions, then approves the build (git commits, subagent-driven execution, and the one-off Lighthouse download).

## Waiting on
- Eduvos font files and licence confirmation.
- The official crest SVG.
- Photos (after the homepage is built).
