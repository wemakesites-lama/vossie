# Vossie landing page: brainstorm decisions log

Running record of choices made in the visual brainstorm, so the final spec and anyone picking this up later can see what was decided and why. Reference material: `BRIGADE-REFERENCE.md`, `FUNCTION-MAP.md`, `LIVE-INVENTORY.md`.

The approved mockup screens are in `docs/reference/mockups/` (`home-v2.html` is the approved structure).

| # | Date | Question | Decision | Notes |
|---|---|---|---|---|
| 1 | 2026-10-08 | How should the Eduvos crest hang from the header (Brigade-style "indent")? | **B: Varsity pennant.** White crest inside a navy pennant hanging from the white sticky header, with a white edge where it meets the hero | Chosen in the mockup (screen `header-badge.html`). Eduvos has since approved the crest inside the pennant (decision 10); the official crest SVG is still to come |
| 2 | 2026-10-08 | How should people choose their campus while still shopping every campus? | **B: Campus card carousel.** A swipeable row of campus cards under the hero ("All campuses" first, then the 12 campuses and Eduvos Online), drifting slowly until touched; tapping a card opens that campus's home. A campus pill in the header handles switching later | Locked in by Lama. Shared rule: picking a campus puts it first everywhere; "All campuses" is always one tap away. Needs one photo per campus (12 + Online) |
| 3 | 2026-10-08 | Home page structure (first draft) | Superseded by decision 4 | |
| 3a | 2026-10-08 | Extras | **All 8 approved:** activity strip, budget picks, free and swaps row, recently viewed, Looking For band, What's on at the Hub, trust strip, add to home screen | Approved by Lama |
| 3b | 2026-10-08 | Layout rules | **Shop by campus uses Brigade's "Shop by brand" pattern** (campus names left and right of one photo). **No two neighbouring blocks may share a layout** (e.g. two photo-card rows in a row). **Footer must be bold** | Direction from Lama with Brigade screenshots. Interpretation used in the next draft: the block after the hero and the first carousel (categories) must look different; campus selection moves to the "Shop by brand" slot, and on phones it becomes the swipeable campus card carousel from decision 2 |
| 4 | 2026-10-08 | Home page structure (second draft, `home-v2.html`) | **Approved** | Order: 1 announcement bar, 2 header (campus pill), 3 hero slider, 4 context strip (trust strip on first visit; activity + recently viewed when signed in), 5 Shop by category + budget buttons (first carousel), 6 Hub collections (grey panel, photo stack + hover list), 7 Shop by campus (Brigade "Shop by brand" style on desktop with live counts and auto-cycling photo; swipeable campus card carousel on phones), 8 Just listed (campus / All campuses switch), 9 How it works, 10 Featured today, 11 Looking For band (sky), 12 Free & swaps (pale sky panel, FREE/SWAP stamps), 13 Hub banner + What's on, 14 bold footer (two giant links, sign-up, all campuses, add to home screen, full-width VOSSIE wordmark). The first draft (`home-structure.html`) had 11 sections: announcement bar, header, hero slider, Shop your campus carousel, Shop by category tiles, Just listed, Featured today, Hub-curated collections, How it works, Incubation Hub banner, footer |
| 5 | 2026-10-08 | Header behaviour | **After scrolling, every header item hides except the crest pennant, which stays pinned on screen. Tapping it pops the whole header back out (crest included) without moving the page** | Clarified by Lama in spec review (replaces the earlier "tuck and scroll to top" reading). Full state rules in the spec, section 6.2 |
| 6 | 2026-10-08 | Responsive priority | **Optimised for every screen size, mobile usability first** | Requested by Lama |
| 7 | 2026-10-08 | Where to build | **New repo, same stack:** fresh Next.js + Tailwind project in `~/Projects/Vossie`, homepage first on realistic sample data behind a data layer that can plug into the existing Supabase later | Chosen by Lama |
| 8 | 2026-10-08 | Fonts | **Try Eduvos's own fonts** (Cocogoose Pro, Larken); interim mockup fonts until Eduvos supplies the files; compare both before choosing | Lama. Files to request: cocogoose-pro, LarkenBlack, LarkenBold, LarkenMedium, LarkenMediumItalic (.woff2) |
| 9 | 2026-10-08 | Categories | **Keep the ten proposed** (Textbooks & notes, Tech, Res & living, Fashion & thrift, Food, Hair & beauty, Tutoring, Services, Tickets & events, Stationery) | Lama; may change later |
| 10 | 2026-10-08 | Crest | **Eduvos approved the crest inside the pennant.** Use the current cleaned artwork until the official SVG arrives | Lama |
| 11 | 2026-10-08 | Photos | **Supplied by Lama after the homepage is built**; placeholders at final sizes until then | Lama |
| 12 | 2026-10-08 | Package manager | **pnpm** | Lama |

## Still open

- Cross-campus buying of physical items: services and digital only, courier with held payment, or self-arranged handover.
- Eduvos's font files and licence confirmation, then the final font choice after comparing (decision 8).
- The official crest SVG (decision 10).
- The photos (decision 11).
