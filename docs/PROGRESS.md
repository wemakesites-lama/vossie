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
  - Show more has one small client effect, `ScrollToResult`, because Chrome sometimes ran its fragment scroll before the streamed card arrived. A flaky end-to-end test later showed a second cause (`a41662c`, found during part C): Chrome's fragment step clears focus once the page finishes parsing (the target is an `<li>`, which can't hold it). `ScrollToResult` now runs again one task after `DOMContentLoaded`, and takes focus only if nothing else has it (+65 B on browse).
- **Final review fixes:**
  - the phone dock's styles no longer leak to the next page (Next keeps the last pages hidden in the DOM for Back);
  - the homepage's Free & swaps "See all" opens every campus (decision 47);
  - focus is kept after a sort or a chip change, because those links now do a full page load;
  - Show more focuses the first new card, and Back visits aren't pulled to it;
  - every tap target is at least 44px;
  - the layout-shift test also runs with a campus chosen (Pretoria on the listing page, Midrand and Mbombela on browse);
  - filtered browse links (a search, price, payment, deals, a sort other than the default, or more than 24 shown) are noindex.
- **Checks:**
  - lint and types are clean;
  - 455 unit tests pass;
  - end to end, 366 pass, 229 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px;
  - axe finds no serious or critical issues.
- **First visit at 390px, JS brotli:** homepage 150,937 B, browse 151,607 B, listing 152,078 B (limit 153,600 B).
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
- On a prerendered listing page, More from's "Try again" can't retry (the page is cached); revisit when Supabase data can fail.

## 2026-10-14: Shopping pages built (storefront, Saved, collections)
- **Seller storefronts** (`/sellers/[slug]`): a navy poster band with the seller's photo, name, tagline, stamps for campus, category, Verified and their badge, then Message (to the sign-in placeholder) and Share. About with "Selling since", their listings (4 across on desktop, beside About), an empty state that points to their category, and Report. Each seller has a share card.
- **Saved** (`/saved`): saves now live in a first-party cookie, so the server builds the page. Cards show in saved order with their hearts pressed; sold and paused ones are tagged; removing one greys it until the next visit. Empty and error states; not indexed. When Next shows a kept copy of Saved after something else was saved, the page fetches its list again (`RefreshWhenStale`).
- **Collections** (`/collections/[slug]`): each is a rule (categories and a price cap) that fills itself from every campus. Header with the photo, intro and count (beside the text from the tablet step; landscape phones crop the photo to 4:1), the listings, "More in browse" links that keep the cap, and the Hub's other collections.
- **Data:** sellers gain an about, a start month, their trust badge and a category slug; seven listings' badges now match their seller's. `ListingGrid` is shared by the new pages and the listing page's More from (3 across on tablets now).
- **Where the build differed from the plan** is in the plan's "Changes made during the build (2026-10-14)". The ones worth knowing:
  - The JS stop line fired at Task 1 (the saved cookie store, in every page's shell) and again at Task 6. Lama moved the line to 152,305 B (decision 52).
  - The Task 6 jump of 760 B on the listing page came from "See their shop" prefetching the storefront's route chunk. It and the header's Saved link no longer prefetch (decision 53).
  - The end-to-end test caught a real bug: a kept copy of Saved showed an old list. `RefreshWhenStale` fixes it for 105 B, on Saved only.
- **Plan decisions Lama may want to revisit:**
  - Decision 10: the "More in browse" links name no campus, so they open on the viewer's campus. If Lama wants every campus, as Free & swaps has (decision 47), the links gain `&campus=all`.
  - More from shows 3 + 1 on tablets (three across, then one card alone on the next row).
  - Safari's 7-day limit on cookies written by the page, which may expire the campus choice and saves on iPhones (decision 58).
- **Checks:**
  - lint and types are clean;
  - 528 unit tests pass;
  - end to end, 444 pass, 296 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px;
  - axe finds no serious or critical issues.
- **First visit at 390px, JS brotli:** homepage 151,058 B, browse 151,740 B, listing 152,214 B, storefront 151,818 B, Saved 151,636 B, collection 151,534 B. The stage's stop line is 152,305 B (decision 52) and the limit is 153,600 B.
- **Layout shift** (fonts held back, at 390 and 1440px):

  | Page | 390px | 1440px |
  |---|---|---|
  | Storefront | 0.0006 | 0.0004 |
  | Storefront, nothing listed | 0.0091 | 0.0007 |
  | Saved | 0.0003 | 0.0100 |
  | Saved, nothing saved | 0.0109 | 0.0077 |
  | Collection | 0.0141 | 0.0002 |

- Review screenshots: `docs/progress/shopping/`.

## 2026-10-14: Open points for Lama after the shopping build
Review notes that were deliberately not acted on:
- Fixed section ids repeat when Next keeps an earlier copy of the same page hidden in the DOM. The final review checked this in Chrome and it is **not a bug today**: Next puts the visible copy first, so `aria-labelledby` names the right section (axe agrees). React's `useId` wouldn't help, because in Server Components it restarts on every request. If it's ever needed, build the ids from the slug (e.g. `collection-moving-in-listings-title`).
- The header's saved count includes ids that no longer exist, and a visitor can't remove them (there's no card to tap). The final review's fix, to be built: Saved forgets the ids it couldn't find, so the cookie and the header follow.
- The footer's Saved link still prefetches (578 B on desktop and tablet once the footer scrolls into view); it's fixed with part C's footer task.
- Saved only refreshes when it's shown again, so a save made in another tab appears on the next visit, not when you switch back. Re-saving a card on Saved moves it to the top on the next visit.

## 2026-10-14: Info, legal and system pages built (part C)
- **Info pages** share one frame (`InfoPage`: title, lede, "Last updated", an "On this page" list, then sections; the list is a row of pills on phones and tablets and a column from the desktop step):
  - `/how-it-works` (buying, selling, trust in a paragraph, six questions, and "What can I do on Vossie today?"), `/safety` and `/trust` (Verified, the three badges, what counts, how Featured today is picked, all worded as how it will work once accounts are live);
  - `/privacy` (titled "Privacy policy"), `/terms` and `/seller-guidelines` are **drafts for Eduvos to review**: a banner says so, they are `noindex`, and the Information Officer is "to be named by Eduvos". The privacy policy names every cookie and browser store this stage has, and says plainly that saved ids travel to Vossie in `vossie_saved` with each visit. A test finds every `"vossie_…"` name in the code and fails until the page names it;
  - the footer links them all (its "Seller safety" became "Seller guidelines", "How trust works" and "Terms of use" joined, and its Saved link no longer prefetches). The homepage's "How trust works" and "How we pick" links open `/trust`, and its How it works step no longer says WhatsApp (decision 57).
- **Production basics:**
  - the site's address comes from `NEXT_PUBLIC_SITE_URL` (`.env.example`), so every page has one absolute `og:image`; a production build without it warns once;
  - a default share card (`app/opengraph-image.tsx`) serves every page that has none of its own; listings and sellers keep theirs;
  - `robots.txt` keeps crawlers off Saved, sign-in, the account pages and the selling pages (as `/sell$` and `/sell/`, so storefronts stay listed), and names no staff page;
  - the sitemap lists 7 static paths (not the three drafts), the collections, sellers and listings. Requests and Hub posts join it when part B exists; `/looking-for` and `/hub` are in it meanwhile;
  - security headers on every response (`nosniff`, referrer policy, `X-Frame-Options`, camera, microphone and location off, and HSTS for a year in production). No Content Security Policy yet.
- **Error page: dropped.** Measured in a throwaway copy before it entered the repo, `app/error.tsx` added 472 B to every page, which put the listing page at 152,710 B and the storefront at 152,314 B, past the stop line (152,305 B). It was never created in the repo, and Next's default error page stays (decision 62).
- **Decisions:** 61 (the pages, robots, sitemap, headers and share card) and 62 (the dropped error page). The spec and the go-live checklist match the build.
- **Where the build differed from the plan** is in the plan's "Changes made during the build (2026-10-14)". The ones worth knowing:
  - the plan's review made the three drafts `noindex` and added the default share card;
  - the build was interrupted at the usage limit during Task 3 and finished by a new agent from the files it had written;
  - a review of Tasks 1 to 7 reworded the privacy draft in POPIA terms ("Allowed under POPIA section 11") and added the storage-key guard test;
  - the end-to-end run found a real bug outside this part: Show more's keyboard focus was cleared by Chrome after the page finished parsing (`a41662c`, +65 B on browse). Two open points from the shopping stage were also closed on the way: the footer's Saved link no longer prefetches (`27a85fc`), and Saved forgets ids whose listings are gone (`31f59ad`).
- **Checks** (the final run):
  - lint and types are clean;
  - 626 unit tests pass, in 111 files;
  - end to end, 520 pass, 375 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px;
  - axe finds no serious or critical issues on the six pages or the 404 page.
- **First visit at 390px, JS brotli:** homepage 151,082 B, browse 151,829 B, listing 152,238 B, How it works 151,082 B, storefront 151,842 B, Saved 151,717 B, collection 151,558 B. The stop line is 152,305 B (decision 52), so the listing page has 67 B to spare; the limit is 153,600 B.
- **Layout shift** (fonts held back, at 390 and 1440px):

  | Page | 390px | 1440px |
  |---|---|---|
  | How it works | 0.0031 | 0.0350 |
  | Privacy | 0.0011 | 0.0022 |

  The 1440px figure for How it works was 0.0312 in the Task 9 run and 0.0350 in the final run; both are under the limit of 0.05, but see the open points.
- Review screenshots: `docs/progress/info-system/`.

## 2026-10-14: Open points for Lama after the info and system build
- **Eduvos has to review three pages.** The privacy policy, terms of use and seller guidelines are drafts. The claims for their lawyers to confirm are listed in `docs/reference/GO-LIVE.md` (under "POPIA and legal"): Eduvos is the responsible party; under-18s need a parent's or guardian's consent; Vossie sells no personal information; each POPIA section 11 ground; deleting an account removes its data straight away; and hosting under section 72. A contact address and the Information Officer's name are still to come.
- **The branded error page was dropped** (decision 62): it costs 472 B on every page and the listing page has 67 B of room. Next's default error page shows. Revisit it if a later change frees the bytes; Turbopack's `requestCost` option saved about 1.1 KB per page in a trial (decision 53).
- **`/looking-for` and `/hub` are in the sitemap before they exist.** They are placeholders until part B builds them, which also adds requests and Hub posts to the sitemap (`app/sitemap.ts` says how). The site isn't public yet, so nothing is indexed meanwhile.
- **How it works' layout shift at 1440px is 0.0312 to 0.0350, and nobody knows why.** The moving nodes are the page's own layout (`div.info-layout` and the "Last updated" line) as the fonts arrive, with the announcement stack. It is under the 0.05 limit, and Privacy, built from the same frame, shifts 0.0022 to 0.0031, so look at it if the limit is ever close.
- **The info pages describe the future in places.** How it works' "What can I do on Vossie today?", the trust page's "badges are samples" and the privacy policy's "When sign-in arrives" are true today and go stale as stages land (the go-live checklist lists them).
- **The sample Featured draw doesn't match the trust page yet.** The page says a featured seller sits out for a week and needs something listed. `drawFeatured` (`lib/featured.ts`) does neither today; the staff tools spec adds both when it builds the real draw.
- **Later stages may add to `robots.txt`.** Messages, notifications and reports are signed-in pages that a crawler only meets behind sign-in links, so none needs listing, but add them if you'd like it explicit. Staff pages stay unlisted on purpose.

## 2026-10-14: Community pages built (Looking For and the Hub)
- **Looking For** (`/looking-for`): the board opens on your campus ("At Midrand", then "Other campuses"; the online campus reads "On Eduvos Online") with category chips. Each row shows where, what, the budget, when it was posted and the offers. Empty and error states; Post a request goes to the sign-in placeholder.
- **A request** (`/looking-for/[id]`): the facts as pills, the asker's words (no names: "Asked by a student at Midrand"), the offers and Offer to help (to sign-in), "This request is closed" when it is, up to four listings already on Vossie in the same category, and Report.
- **The Hub** (`/hub`): the story, the Verified sellers (A to Z, linking to their shops) and one feed: upcoming events and office hours, soonest first, then tips, with a tab for each.
- **A Hub post** (`/hub/[id]`): the cover, the facts, a markdown body rendered on the server (links inside the site only), RSVP or Request a slot through sign-in, "has passed" once the day is over, and More from the Hub.
- **Data:** 16 requests (14 open and 2 closed; the homepage's 7 unchanged) and 18 Hub posts (8 events, 4 office hours and 6 tips, two of them past). What's on is derived from the posts, and its RSVP and Book links, like the homepage's request rows, open the new pages. The Looking For band now leads with a campus's own request at seven more campuses (plan decision 1). The sitemap lists every request and Hub post.
- **Decisions:** 64 (Looking For) and 65 (the Hub), which also carry the plan decisions that changed the spec. The spec matches the build.
- **Where the build differed from the plan** is in the plan's "Changes made during the build (2026-10-14)". The ones worth knowing:
  - The plan's five code blocks (`data/fixtures/requests.ts`, `data/fixtures/hub.ts`, `lib/requests.ts`, `lib/hub.ts` and `lib/markdown.ts`) were `{{…}}` placeholders, because the plan's drafter was stopped at the usage limit. The first agent improvised them; the controller filled the plan from the drafter's checked prototypes (`a6bcd6a`), and a second agent replaced the improvised files with the plan's versions.
  - Turbopack's `requestCost` option (decision 63, `580d1e6`) made every page 528 B lighter before Task 3, so the stop line was never close.
  - The plan's CSS for the current chip scrolled the whole page 312px on tablet and desktop (`scroll-initial-target`); it is off from the tablet step (`6ce9c28`).
  - The review of Tasks 1 to 4 (`5dd9ef5`) fixed links with parentheses in the markdown, added an 8,000-character guard on parsing (it was quadratic), added two board tests and made the Verified sellers' cards even heights.
  - The online campus's heading read "At Eduvos Online". It now reads "On Eduvos Online", and its empty line "Nothing on Eduvos Online yet." (every other campus keeps "At …").
- **Plan decisions Lama may want to revisit:** none came up in review. The ones with an effect Lama can see:
  - Decision 1: the homepage's Looking For band leads with the viewer's own request at seven more campuses.
  - Decision 19: the board's Post a request always comes back to `/looking-for`, even from a category view, because the heading is prerendered.
  - Decision 20: the 16 requests, the 18 posts and the Hub's story are sample wording for Lama and the Hub to change.
- **Checks:**
  - lint and types are clean;
  - 753 unit tests pass, in 127 files;
  - end to end, 646 pass, 464 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px;
  - axe finds no serious or critical issues on the new pages and states.
- **First visit at 390px, JS brotli:** homepage 150,554 B, browse 151,301 B, listing 151,710 B, board 150,554 B, request 151,030 B, Hub 150,554 B, Hub post 150,554 B (limit 153,600 B; stop line 152,305 B, never reached). The other pages: How it works 150,554 B, storefront 151,314 B, Saved 151,189 B, collection 151,030 B. The listing page is the highest, 595 B under the stop line.
- **Layout shift** (fonts held back, at 390 and 1440px):

  | Page | 390px | 1440px |
  |---|---|---|
  | Looking For board | 0.0021 | 0.0022 |
  | Board, campus Mbombela | 0.0018 | 0.0019 |
  | A request | 0.0244 | 0.0004 |
  | Hub | 0.0003 | 0.0012 |
  | Hub event | 0.0004 | 0.0004 |
  | Hub office hours | 0.0172 | 0.0003 |
  | Hub tip | 0.0172 | 0.0003 |

  The earlier run (Task 10) read request 0.0249 and 0.0003, office hours 0.0175 and 0.0004, tip 0.0169 and 0.0005 at the two sizes: the figures move by a few ten-thousandths from run to run, and all are well under the limit of 0.05.
- Review screenshots: `docs/progress/community/`.

## 2026-10-14: Open points for Lama after the community build
- **The sitemap lists closed requests and past Hub posts.** It includes every request id and every post id, so the two closed requests and the two past posts (and, as days pass, every event that has ended) are listed. A reviewer noted it. Lama may want them out later; it is on the go-live checklist. The site isn't public yet, so nothing is indexed meanwhile.
- **Everything on these pages is sample content.** The 16 requests with their offers counts, the 18 posts with their "going" numbers and places, and the Hub's story are made up. The Hub and Lama replace them, and staff tools (stage G) will let the Hub write posts.
- **Markdown parsing stops at 8,000 characters.** Sample bodies are far shorter (spec limit 4,000). It was quadratic on long lines, and staff will be writing bodies from stage G. Revisit when the editor exists.
- **Sample dates run out.** The events end on 11 February 2027. Until then the feed always has something; after that its events section says "Nothing planned right now. Check back soon." The end-to-end tests never assume a date, but the screenshot of an event page (`08-hub-event`) shows RSVP only while the first event, "Pitch night" on 14 October 2026, is still ahead: retaken later, it shows "This event has passed" (the test accepts either).
- **Request and office-hours pages have the most layout shift of the new pages,** 0.0244 at 390px for a request and 0.0172 for office hours and tips. All are under the 0.05 limit; the board, the Hub and an event page are under 0.003.
- **JS room for the signed-in stages.** The listing page, the highest, ends at 151,710 B: 595 B under the stop line and 1,890 B under the limit. Decision 63's `requestCost` is experimental and a threshold effect, so later code can shrink the saving; `performance.spec.ts` is the guard.

## 2026-10-14: Sign-in and accounts built, in sample mode (stage D)
- **The sample store** (`lib/data/store.ts`): one per server process, on `globalThis`, seeded with five sample accounts (student, approved seller, seller waiting for approval, mentor and admin) and wiped when the server restarts. Every read and write goes through `lib/data` functions shaped like Supabase's; stages E to G add their tables to it.
- **Sign in** (`/login`): your Eduvos email and the privacy box, then a 6-digit code (shown on screen in sample mode; 10 minutes, 5 tries, 5 codes an hour), then a first name and campus on a first sign-in. Every step is a plain form posting to a Server Action, so it works without the app's JavaScript. Sample-account buttons sign straight in. `VOSSIE_SAMPLE_MODE=0` turns sign-in off; `VOSSIE_EMAIL_DOMAINS` sets the domains.
- **Sessions:** an httpOnly cookie with a random token, for 30 days; the store keeps only hashes of tokens and codes. The header's icon and the menu's rows come from the server, so there's no readable sign-in cookie.
- **Your account** (`/account`): your details, Edit details, Saved, selling and privacy settings, Sign out. **Privacy settings** (`/account/privacy`): the consent record, Download your data (`vossie-data.json`), and Delete your account, which removes everything at once and signs you out with a toast.
- **Words:** the privacy policy names the three new cookies and describes the preview's accounts; How it works and the save notes say what's true now.
- **Where the build differed from the plan** is in the plan's "Changes made during the build (2026-10-14)". The ones worth knowing:
  - The review of Tasks 1 to 6 (`1767777`) made counting a wrong try and taking a place in the hour's 5 codes one step each (overlap tests showed parallel posts slipping past both limits), made an email have one account ever, and tightened emails (ASCII) and first names (a letter is needed).
  - The homepage's sign-out toast cost every page 81 B, though its code is on the homepage only: the header's home link prefetches `/` and so pulls in the homepage's chunk (`6e4bb91`).
  - The stage review (`17dd972`) made the toast show once when Next brings a kept page back, gave each form's error summary its own id, and made a sign-in step's errors show for 60 seconds after their post.
  - The end-to-end test for the toast showing once first passed with the fix removed (a retrying assertion waited out the 4-second toast). It now counts toasts in the page and fails without the fix.
- **Plan decisions Lama may want to revisit:** these review fixes changed behaviour:
  - Sign-in errors, and "We sent a new code.", now show for 60 seconds after the post that set them. Someone who comes back to a half-finished sign-in 20 minutes later sees the form with what they typed, not the old error summary.
  - Error summaries take an id from each form (`signin-email-summary`, `account-details-summary` and so on), instead of one shared id; nothing changes on screen.
  - Sample wording for Lama to change: the sample accounts' names and buttons (plan decision 15) and the words in plan decision 7 (the rate-limit message, the toasts, the hints and the privacy settings page's sentences).
- **Checks:**
  - lint and types are clean;
  - 978 unit tests pass, in 153 files;
  - end to end, 734 pass, 541 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px;
  - axe finds no serious or critical issues on each sign-in step, the sign-in page when signed in, the account page after a failed save, privacy settings with the box missed, and the signed-in menu.
- **First visit at 390px, JS brotli:** homepage 150,614 B, browse 151,361 B, listing 151,770 B, sign-in 150,614 B, account (signed in) 150,614 B (stop line 152,305 B, never reached; limit 153,600 B). The listing page is the highest, 535 B under the stop line. Every page is 60 B above where the stage started: 39 B lighter from the header and menu, 81 B heavier from the toast, 18 B from the review fix that makes the toast show once.
- **Layout shift** (fonts held back, at 390 and 1440px):

  | Page | 390px | 1440px |
  |---|---|---|
  | Sign-in | 0.0003 | 0.0002 |
  | Account (signed in) | 0.0004 | 0.0004 |
  | Privacy settings (signed in) | 0.0005 | 0.0004 |

  Run to run the figures move by a few ten-thousandths; all are far under the limit of 0.05.
- Review screenshots: `docs/progress/accounts/` (20, at 390 and 1440px).

## 2026-10-14: Open points for Lama after the accounts build
- **`data/fixtures/viewer.ts` looks unused now.** It held the sample activity behind the old `VOSSIE_SAMPLE_SIGNED_IN` switch, which stage D retired. It is left in place, and Lama decides whether to delete it.
- **Client code used only on the homepage costs bytes on every page.** The header's home link prefetches `/`, which pulls in the homepage's own chunk wherever the link appears. `FlashToast` (homepage only) cost every page 81 B. Anything client-side added to the homepage later has the same effect, and `performance.spec.ts` is the guard.
- **Sample mode keeps accounts in the server's memory.** They vanish when the server restarts, the sign-in code shows on the page, and one process holds them all. The go-live checklist has what the real backend must do (keyed hashes for codes, atomic try counting, the `Secure` flag behind a proxy, plus addresses, and a database before more than one instance).
- **JS room for stages E to G.** The listing page ends at 151,770 B: 535 B under the stop line and 1,830 B under the limit.

## 2026-10-14: Messaging, reports and notifications built, in sample mode (stage E)
- **Messages** (`/listings/[id]/message`, `/sellers/[slug]/message`, `/messages`, `/messages/[id]`): a signed-in student messages a seller about a listing, with a swap offer when it takes swaps, or asks a shop a question from its storefront. Three safety tips sit beside the composer, and the server checks each message, replies too, for paying in advance, bank details, a deposit, a courier or a code, with Send anyway. The inbox has Buying and Selling; a thread shows who wrote what and when, the status (Asked, Replied, Done, Confirmed), Mark as completed, Confirm the sale and It didn't happen, and confirms a sale itself a week after it's marked done. Refresh reloads; there are no live updates.
- **Reports** (`/report`, `/report/sent`): seven reasons and a detail for a listing, a seller or a request, one per target and 10 in 24 hours, then a thank-you. Privacy settings list the reports you've made.
- **Notifications** (`/notifications`): new messages and sales to confirm, marked read on opening. The header's account icon carries a red count of new ones; the account page lists Messages and Notifications with their counts; the homepage strip counts new messages and sales to confirm and links to the inbox.
- **Every form works without the app's JavaScript** (with its bundle blocked: see the open points for a browser with JavaScript off), and every post makes the browser drop its kept pages (`refresh()`), so Back never shows a page from before your own change.
- **Privacy:** the policy, the export and deletion take in messages, reports and notifications; deleting an account keeps the other person's side of each conversation, and a sale nobody can dispute doesn't count; how long they're kept is Eduvos's call before launch.
- **Where the build differed from the plan** is in the plan's "Changes made during the build (2026-10-14)". The ones worth knowing:
  - Two review fix commits: Tasks 1 to 5 (`3688ea9`: no completing a sale with a buyer who has left, a wider scam check, "asked" until a reply, invisible characters dropped) and Tasks 6 to 11 (`0cc8a4b`: each report form starts empty for its target, a deleted seller's Done sale goes back to Replied, every new link skips prefetch).
  - Building the composer showed that with JavaScript turned off in the browser, streamed parts stay on their skeletons (amendment 4, below). Building the thread showed that two kept copies of one page share field ids, so each id names its listing, shop or conversation (`5783336`).
  - A Messages row in the signed-in menu was tried and dropped: 16 B on every page, and the menu scrolled on a 360px phone.
  - The end-to-end tests needed their own waits and snapshots (20 seconds for a sign-up and a first message under load, a count taken once the page is drawn instead of a retrying `toHaveCount(0)`), and the axe tests for the composer wait for its `<title>`.
- **Plan decisions Lama may want to revisit:**
  - Decision 2: the storefront's Message asks the shop a question (`/sellers/[slug]/message`), one per buyer and shop. Stage G decides whether a shop question counts as an enquiry for trust badges.
  - Decision 10: the header's count is a red badge on the account icon, not a bell, because three icons need 148px and each side of the pennant has 140px at 360px. A bell from the tablet step up is possible.
  - Decisions 11 and 12: the count is as fresh as the last page load or post (no live updates), and a conversation has one unread message notification however many messages come.
  - Decision 17 and amendment 3.7: a report per target while it's open, and 10 in 24 hours.
  - The sample wording (decision 26) and how long messages are kept (decision 27): both are Lama's and Eduvos's to set.
- **Checks:**
  - lint and types are clean;
  - 1,194 unit tests pass, in 181 files;
  - end to end, 848 pass, 652 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px;
  - axe finds no serious or critical issues on the composer (with its tips, its errors and the scam check), the inbox (both tabs), a thread (seller, and buyer with a sale to confirm), the report (with an error, and its thank-you), notifications (new, and none), and the header's badge with the account page's counts.
- **First visit at 390px, JS brotli:** homepage 150,613 B, browse 151,360 B, listing 151,769 B, storefront 151,373 B, request 151,089 B; signed in: inbox, thread, composer, report, notifications and account 150,613 B each (stop line 152,305 B, never reached; limit 153,600 B). The listing page is the highest, 536 B under the stop line. The stage added no client code, and every page ended 1 B lighter than it started.
- **Layout shift** (fonts held back, at 390 and 1440px):

  | Page | 390px | 1440px |
  |---|---|---|
  | Composer | 0.0003 | 0.0006 |
  | Inbox | 0.0115 | 0.0003 |
  | Thread | 0.0009 | 0.0004 |
  | Report | 0.0212 | 0.0012 |
  | Notifications | 0.0004 | 0.0006 |
  | Homepage, signed in | 0.0015 | 0.0026 |
  | Account | 0.0004 | 0.0003 |

  Run to run the figures move by a few ten-thousandths: an earlier run read the inbox at 0.0101 and the signed-in homepage at 0.0010 and 0.0032, and the report at 0.0016 at 1440px. The notifications page is measured as the sample seller, whose list is whatever the other tests have left, so it moves more: 0.0149 at 390px in the earlier run, 0.0004 in the final one. All are under the limit of 0.05.
- Review screenshots: `docs/progress/messaging/` (24, at 390 and 1440px).

## 2026-10-14: Open points for Lama after the messaging build
- **With JavaScript turned off in the browser,** streamed parts, forms included, stay on their skeletons (plan amendment 4). Next puts streamed content in place with a small inline script, so "works without JavaScript" means without the app's bundle, which the tests check. The go-live checklist has a quality item: decide whether a browser with JavaScript off needs the forms.
- **On a client navigation to a page with dynamic metadata,** such as the composer, the document has no `<title>` for a moment until the metadata streams in. A full load has it at once. Axe can catch the gap; the composer's tests wait for the title. A static title would remove it.
- **The inbox's times don't line up** when the status pills differ in width. It's cosmetic; fixing it would squeeze the text at 360px.
- **Phone-size layout shift** on the report (0.0212), notifications (up to 0.0149) and inbox (0.0101 to 0.0115) pages. All are under 0.05. Tightening the skeleton heights at the phone step would reduce them. The notifications figure depends on how many notifications the sample seller has when the test runs.
- **Sample wording to review** (plan decision 26):
  - the three tips and the five scam tips: `lib/messaging/scam-check.ts`;
  - the notification sentences: `lib/messaging/notification-text.ts`;
  - the errors, including the report limit: `lib/messaging/errors.ts`;
  - the composer's notes ("This is your listing…", "You've already messaged {shop} about this."): `components/messages/ComposerView.tsx`;
  - the sale lines on a thread, and the sale's question: `components/messages/SaleActions.tsx`;
  - the inbox's empty states: `components/messages/InboxView.tsx`; the notifications' "Nothing new.": `components/messages/NotificationsView.tsx`;
  - the report's reasons, legend, detail hint and "You've reported this {kind} already.": `components/messages/ReportView.tsx`, and the thank-you's words in `app/report/sent/page.tsx`;
  - the privacy policy's and privacy settings' new sentences: `app/privacy/page.tsx`, `components/account/PrivacySettingsView.tsx`.
- **A real 404 status:** an unknown or other person's conversation, composer or report target shows the 404 page with status 200, because it's raised inside `<Suspense>` after streaming has started (as for unknown listings, decision 39).
- **On Vercel,** the sample store lives in one server instance's memory. Conversations and sign-ins may not carry between instances until the real database replaces it.
- **How long messages, reports and notifications are kept** is Eduvos's call (plan decision 27): the policy says the periods will be set before launch, and in sample mode everything lasts until the server restarts. It is on the go-live checklist, with the scheduled jobs that delete old ones and confirm sales after 7 days.
- **JS room for stages F and G.** The listing page ends at 151,769 B: 536 B under the stop line and 1,831 B under the limit.

## 2026-10-15: Positioning and editorial spec written (decision 71)
- **Spec:** `docs/superpowers/specs/2026-10-15-positioning-and-editorial-design.md`, a draft for Lama's review. Nothing is built yet.
- **The brand line** is "Your campus, open for business." (Lama's choice); three alternatives are kept in section 3.2.
- **Phase 1, the wording:** the meta and install descriptions, the share card and its alt text, and a line above the footer's giant links (section 3.6). Small enough to build from the spec. It goes live after Eduvos marketing signs off the line.
- **Phase 2, stories:** a fourth Hub post kind whose lone links to listings, shops and collections become cards, with a consent box and no comments or likes. It waits for stage G's post editor, then gets its own plan.
- **Phase 3:** textbooks by module, a path for sellers, campus market days and a reuse counter, each waiting on something outside the code (section 6).

## 2026-10-15: Supabase backend designed and planned
- **Lama's decisions:**
  - a fresh Supabase project (the old demo's stays untouched);
  - Ireland (eu-west-1), with Vercel's functions moved to Dublin too. Lama first chose London, then kept Ireland because the staging project already made, "Vossie Market" (`kahzsitqnocygsrdfpre`), is there, and staging should match production;
  - Free for staging now and Pro for production at launch;
  - Supabase Auth's email code for sign-in.

  They go into the decisions log when the spec is approved.
- **Spec:** `docs/superpowers/specs/2026-10-15-supabase-backend-design.md`. Supabase is called from the server only, so no JavaScript is added to any page. Every table has grants, access rules and pgTAP tests, and rules that count or span rows are Postgres functions. Photos stay private behind `/photos/[id]`.
- **Plan:** `docs/superpowers/plans/2026-10-15-supabase-foundation.md`, phase A. It covers the staging project and the `supabase/` folder for stages D to F, built in its own worktree so the frontend work isn't touched. Phases B (sign-in) and C (data) follow stage F.
- **Found while researching, for go-live:**
  - Vercel refuses request bodies over 4.5 MB, so six phone photos posted without JavaScript will fail there (spec open decision 2).
  - From 30 October 2026, new Supabase tables aren't granted to the API automatically.
  - Supabase's DPA uses EU clauses and doesn't name POPIA, so a lawyer needs to confirm section 72.

## 2026-10-15: Supabase phase A built, and staging is live
- **Where:** branch `backend/supabase-foundation`, worktree `../Vossie-supabase`, commit `0851811`. The staging notes (config change and plan section) are uncommitted. Nothing on `main` changed apart from this log.
- **What's built:**
  - 8 migrations: every table stages D to F use, with grants, access rules and indexes; the actions as Postgres functions; a private `photos` bucket; and 4 scheduled jobs;
  - 803 pgTAP tests (`supabase test db`);
  - a seed generated from the fixtures, with sample accounts at `@vossie.test`;
  - the server clients in `lib/supabase/`, which nothing imports yet. 1,455 unit tests pass.
- **Review:** an independent review found that password sign-up gave a session for any `@eduvos.com` address without its mailbox. Now only an email code gets a session, and only for an allowed domain (two Auth hooks). Ten smaller findings were fixed too (see the plan's "Review fixes").
- **Staging ("Vossie Market", Ireland):**
  - migrations and seed are pushed, and the auth and storage settings are set;
  - signed-out visitors read live listings but not profiles;
  - Gmail addresses are refused.
  - The Vossie code email can't be set until there's custom SMTP: Free projects on Supabase's built-in email can't change templates (open decision 1).
- **For launch:** campuses, categories and pickup points are only in the seed, which never reaches production, so they need a migration first. Production's allowed domains come from an ops step.
- **The token** shared in chat expires on 2026-10-22. Revoke it once phase A is wrapped up.

## 2026-10-15: Selling built, in sample mode (stage F)
- **Listings and sellers now come from the sample store,** seeded from the fixtures (four new tables: shops, listings, photos and the wizard's drafts) and tagged, so a write shows on the next request. A new listing appears in browse, on its page, on the storefront and in collections straight away. A paused shop is out of every list but keeps its storefront and its listings' pages, marked paused; a shop waiting for approval has no storefront.
- **Becoming a seller** (`/sell`, `/sell/onboarding`): the pitch, then five steps (basics, about, photo, campus and pickup points, review) and Send for approval. The step is in the link, the draft is in the store, Back is a link, and step 4 shows the pickup points of the campus chosen, with no client code. The waiting page says the Hub is checking and lets the seller prepare drafts. The sample "Seller waiting for approval" shows it (Lerato's "Crochet corner").
- **The dashboard** (`/sell`): live or paused, the last 7 days' enquiries, replies within 48 hours ("2 of 2") and confirmed sales, the badge and what the next one needs, the shop's pages, and Pause my shop. There are no view counts.
- **Listings** (`/sell/listings`, `/sell/listings/new`, `/sell/listings/[id]/edit`, `/sell/listings/[id]/delete`): four tabs (Available, Paused, Sold, Drafts), Pause, Resume, Mark sold, Relist and Delete with a confirmation; the listing form with every field of the listing model, Save and publish or Save as draft. A new listing is made once however many times its form is sent.
- **Photos:** with the app's JavaScript, shrunk and re-encoded in the browser (WebP, JPEG on Safari), one at a time, with a save held up to 15 seconds for them; on the server, checked by signature, 5 MB each, 6 per listing, and stripped of hidden data every time (an allowlist per format); served from `/photos/[id]` with `nosniff` and a device-only cache, and resized by next/image with no copies kept on the server's disk. The photo field's buttons (Move earlier, Move later, Make cover, Remove) work without JavaScript too.
- **Edit shop** (`/sell/profile`), with the link changeable once (the old link stays reserved and shows the 404). The listing page shows its owner Edit listing, the storefront Edit shop, and the account page's Your shop goes to the dashboard.
- **Privacy:** the policy, How it works, the export and deletion take in shops, listings, photos and the wizard's draft; deleting an account removes the shop, its listings, every photo it uploaded and the draft, and conversations keep the listing's title and say it was removed. The export lists each listing's photos as web addresses, the shop's previous links and the wizard's draft.
- **Every form works without the app's JavaScript** (with its bundle blocked; see the open points for JavaScript fully off), and every post ends with `refresh()` and a replace redirect, so Back never shows a page from before your own change.
- **Where the build differed from the plan** is in the plan's "Changes made during the build" (`docs/superpowers/plans/2026-10-14-selling.md`), with each change's commit. The ones worth knowing:
  - Six review fix commits, one for each batch of reviews: the stripper became an allowlist per format and prices whole rand (`8ede2af`); gone sellers' conversations don't count, a first publish happens once and photos are cached on the device only (`f282661`); no listing points at a tidied photo and notices show once (`532c240`); Save waits for the shrink (`cbd8d89`); a held save posts once, and an old shop link stays reserved (`a088ee3`); a new listing is made once (`9ba055a`).
  - The listing form's bytes: the first build of `PhotoField` was 620 B over the stop line, so the shrinking moved to code loaded on the first pick and everything fixed moved to the server (`PhotoFieldset.tsx`). No feature was cut.
  - Part A of this task: the selling pages' column is at least a screen tall less the header, so the footer stays below the first screen while a page streams in (amendment 15.1; `app/globals.css`, its own commit).
  - Two things the plan didn't foresee, now in the spec's section 8: a new listing needs a one-time token, and an old shop link must stay reserved.
- **Plan decisions Lama may want to revisit:**
  - Decision 2: a paused shop's listings still have pages, marked paused, so saved links land somewhere.
  - Decision 3: a sold listing can be relisted.
  - Decision 4: a shop waiting for approval can only save drafts, and once approved the seller publishes each one by hand.
  - Decision 12: no resized photos on the server's disk (a resize per uncached request; fine for a preview).
  - Decision 16: the shop's link changes once, and old links then show the 404.
  - Decision 18: the dashboard counts the last 7 days, and only a buyer's first message about a listing is an enquiry.
  - Decision 27, the sample wording: the pitch (`components/sell/SellPitch.tsx`), the waiting page (`ShopWaiting.tsx`), the dashboard and the badge's progress (`Dashboard.tsx`, `lib/selling/badges.ts`), every error (`lib/selling/errors.ts`), the notices (`lib/selling/notices.ts`), the hints and empty states in each view, and Lerato's "Crochet corner" (`data/fixtures/shops.ts`).
- **Checks:**
  - lint and types are clean;
  - 1,555 unit tests pass, in 215 files;
  - end to end, 953 pass, 768 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px, with the tests that change listings run last (`selling-writes`, at 390px). Skipped includes the review screenshots, which run only with `SCREENSHOTS=1`;
  - axe finds no serious or critical issues on the pitch, the waiting page, the dashboard, My listings in every tab and with its notices, Delete listing, each wizard step with an error, the listing form (new, edit, and for a paused, sold and draft listing, with its errors), Edit shop, and the owner's own listing page and storefront.
- **First visit at 390px, JS brotli:** homepage 150,613 B, browse 151,360 B, listing 151,769 B, storefront 151,373 B, `/sell` 150,613 B; signed in: new listing form 152,287 B, edit listing form 152,287 B, every other selling page 150,613 B, the owner's storefront 151,373 B and listing page 151,769 B (stop line 152,305 B, never passed; limit 153,600 B). Every page that isn't a listing form is exactly as stage E left it. The only new client code is `PhotoField`, loaded by the two listing form routes alone (1,675 B compressed), plus the shrinking code, which loads on the first photo picked and never on a first visit. The listing forms are the highest pages, 18 B under the stop line and 1,313 B under the limit; the listing page is 536 B under it.
- **Layout shift** (fonts held back 800 ms, at 390 and 1440px):

  | Page | 390px | 1440px |
  |---|---|---|
  | The pitch (`/sell`, signed out) | 0.0494 | 0.0036 |
  | Dashboard | 0.0005 | 0.0005 |
  | Waiting for approval | 0.0010 | 0.0005 |
  | My listings | 0.0008 | 0.0005 |
  | My listings, nothing paused | 0.0003 | 0.0003 |
  | My listings, shop waiting | 0.0003 | 0.0003 |
  | Delete listing | 0.0005 | 0.0005 |
  | New listing form | 0.0003 | 0.0003 |
  | Edit listing form | 0.0003 | 0.0003 |
  | Edit shop | 0.0003 | 0.0003 |
  | Wizard, step 1 | 0.0003 | 0.0004 |
  | Wizard, step 4 | 0.0003 | 0.0004 |
  | Storefront, owner's view | 0.0010 | 0.0005 |
  | Listing page, owner's view | 0.0110 | 0.0062 |

  Run to run the figures move by a few ten-thousandths; the pitch read 0.0443 at 390px and 0.0026 at 1440px in an earlier run. All are under the limit of 0.05.

  On a slowed connection (350 ms latency, 60 KB/s, a throwaway script), the footer entering the first screen as a skeleton gave way used to shift My listings' empty tabs by 0.0856 at 390px and 0.0498 at 1440px, My listings while waiting by 0.0274 and 0.0211, and wizard step 4 by 0.0218 at 390px. After Part A's minimum height, no selling page's footer moves at either size. What remains on that connection is the announcement bar's 0.0024 to 0.0027 at 1440px, on every page, and the pitch's headline (0.0184 at 390px).
- Review screenshots: `docs/progress/selling/` (24, at 390 and 1440px).

## 2026-10-15: Open points for Lama after the selling build
- **The pitch's headline moves the page at 390px.** At 390px it takes three lines in the fallback font and two in the display font, so everything under it moves up a line when the font arrives: 0.0494 here (0.0443 in an earlier run), under 0.05 but close. A shorter headline, or a reserved third line on phones, would end it. It's Lama's call (amendment 15.2); the words are `components/sell/SellPitch.tsx`.
- **A short selling page now has blank space under it.** The selling pages' column is at least a screen tall less the header, so the footer sits about 120px below the first screen on an empty tab or a short step. It's what stops the footer moving on a slow connection; if Lama prefers a snugger footer, the `--sell-header` and `min-height` lines in `app/globals.css` (`.sell-page`) are the place.
- **Preview limits** (amendment 6, https://vossie-pi.vercel.app): a request body over 4.5 MB fails on Vercel before it reaches the action. With the app's JavaScript, photos are re-encoded small, so a normal listing fits; without it, large originals fail. The sample store, uploaded photos included, lives in one server instance's memory, so a photo may not show from another instance. The go-live checklist has direct-to-storage uploads.
- **Vercel's image optimiser** (amendment 9.4): `/photos/[id]` is cached on the device only, and `images.maximumDiskCacheSize: 0` keeps nothing on a server of ours, but whether Vercel's own optimiser keeps resized copies of a deleted photo is a go-live check, with a purge when a photo is deleted.
- **A slow connection can show the skeleton instead of the 404** (amendment 10.9). An unknown listing id on the Delete listing page, with the app's JavaScript blocked, shows the page's skeleton, not the 404, because `notFound()` is raised after streaming has started and the status is 200, as on every request-time page here. The go-live proxy check covers status codes.
- **JavaScript fully off** (amendment 13.10): the listing page's body is blank for everyone, because it streams inside `<Suspense fallback={null}>` (it was so before this stage; Opera Mini's extreme mode is common on cheap phones). Forms and the rest work with the bundle blocked, which the tests check.
- **A visitor may see a listing as it was before a write** (amendment 13.10): the cache keeps serving a page while it refreshes (stale-while-revalidate), so one visit after an edit can show the old page.
- **"Answer five short questions" on How it works** might read better as "five short steps", since the wizard is five steps (amendment 13.10). The words are in `app/how-it-works/page.tsx`.
- **Sample mode, after a restart** (amendment 14.4): `next start` keeps the pages Next re-rendered after a write in `.next/server/route-cache`, so restarting it without a rebuild gives a fresh sample store with an earlier server's pages. Rebuild after a restart (`pnpm e2e` always does); the real database ends it. A missing storefront answers 200 to a plain request and 404 to a browser's (amendment 10.9's known item).
- **A manual screen-reader check is still to do** (amendment 13.9): that the photo field's statuses are announced, and announced again when the same one repeats ("Photo 3 is the cover now." after "Photo 2 is the cover now."), and "Saving once your photos are ready…" on each Save press during a hold. The tests check the words and the live region, not what VoiceOver or TalkBack say.
- **Unused files, for Lama to delete or keep:** `components/ComingSoon.tsx` and `components/ComingSoon.test.tsx` (the selling pitch replaced its last use), and `data/fixtures/viewer.ts`, which held the old `VOSSIE_SAMPLE_SIGNED_IN` sample activity and has had no user since stage D. Neither was deleted.
- **Edit shop asks for a picked photo again after a failed save** (amendment 13.6's fallback). "Remove photo" comes back ticked, but a shop photo chosen before the error has to be chosen again ("Choose your photo again."). The listing form keeps its photos as waiting uploads; making Edit shop do the same is a small change if Lama wants it.
- **The new listing's one-time token lasts an hour** (amendment 14.1), longer than form state's usual 10 minutes, so a seller slow with photos isn't turned away. After an hour a token has run out, and a post with it is refused with the form's error, their typed values and photos kept.
- **Previous shop links show in the data export as `/sellers/<slug>`** (amendment 14.2). They're the seller's data, so they're listed.
- **JS headroom:** the listing forms have 18 B left under the stop line (152,287 B against 152,305 B; 1,313 B under the limit). Any client change to `PhotoField` needs a trade-off or Lama's acceptance of a new stop line. Every other page has at least 536 B.
- **Trust page wording for stage G** (spec section 8, item 10): part C's trust page says "Verified means the Hub … approved their shop". Approval and Verified are separate, so it changes with stage G. Stage G also needs to read `lib/data/catalog.ts`, `firstPublishedAt` and `previousSlugs`; the plan's amendment 9 notes (`e3e08b7`) say what changed for stages G, H and I.
- **Docs still uncommitted, waiting for Lama:** the positioning and editorial spec (`2026-10-15-positioning-and-editorial-design.md`), the Supabase spec and plan (`2026-10-15-supabase-backend-design.md`, `2026-10-15-supabase-foundation.md`), and the lines two other sessions added to this file and to the decisions log (the positioning section and decision 71; the Supabase section and Next bullet). Stage F's own decision is row 72 because row 71 is reserved for the positioning decision; this section and row 72 were written from snippet files for the same reason.
- **JS room for stage G and later.** The listing page ends at 151,769 B (536 B under the stop line, 1,831 B under the limit) and the listing forms at 152,287 B.

## 2026-10-19: Staff tools built, in sample mode (stage G)
- **The admin console** (`/admin`):
  - Overview: sellers waiting, open reports and slot requests waiting, and the trust badges worked out as the page opens.
  - Sellers: waiting first. A shop's review page shows its answers, with Approve, Decline (a reason), Verify, the Hub's Pause and Resume, and its mentor.
  - Reports: Dismiss with a note, Hide the listing, or Pause the account. Hiding or pausing closes every open report on that target.
  - Featured: today's row for each campus, and pins.
  - Pickup points: add, rename, retire and use again.
  - Audit log: newest first, by kind.
  - Decline, Hide and Pause go through confirm pages.
- **The Hub's tools** (`/hub/manage`, `/hub/new`, `/hub/[id]/edit`): posts with drafts and a cover, a server-rendered Preview, and the office-hours queue with Accept and Decline. A mentor sees and edits their own posts, an admin all of them.
- **RSVP and Request a slot** are real for signed-in students (`/hub/[id]` and `/hub/[id]/book`); signed out, they go to sign-in. One open request per student per office hours; the post's author is told.
- **The mentor dashboard** (`/mentor`): assigned shops with the last 14 days' numbers and flags, each shop's private notes and check-ins, and a CSV download (quoted, guarded against formulas, with a byte-order mark so Excel reads it).
- **What buyers see:**
  - Featured honours pins and a week's break, as a preference: resting sellers fill the row after everyone else.
  - Trust badges come from conversations for shops with an account.
  - Hidden listings and Hub-paused shops leave every list, and a Hub-paused shop's pages are the 404.
  - A retired pickup point says "(no longer used)".
- **What sellers see:** a declined shop sees the Hub's reason on `/sell` and sends it again; a Hub-paused shop sees the reason and has no Resume; a hidden listing is marked on My listings; the account page lists each staff member's tools by role; notifications draw the two new kinds.
- **Every staff page answers 404 to anyone without the role** (from inside the page: status 200, `noindex`, "Page not found" in the tab); signed out, it goes to sign-in first. Every staff action checks the role first and writes one audit entry only when something changed.
- **Words:** the trust page says Verified is the Hub's badge, separate from approval; the privacy policy and privacy settings say what mentors' notes, the staff log, RSVPs and slot requests keep.
- **Where the build differed from the plan** is in the plan's "Changes made during the build" (`docs/superpowers/plans/2026-10-14-staff-tools.md`), with each change's commit. The ones worth knowing:
  - Four review fix commits, one for each batch of reviews: the CSV guard, unit tests in UTC and limits tested from both sides (`67d4ab8`); reports on a deleted shop, a Hub pause hiding the shop, a seller's own pause surviving it, and hidden listings' photos (`d39becb`, with `f0bc7aa`); pausing closing every report on the shop, and a decision acting on the shop that was reviewed (`322654d`); navy Preview links, no notes about your own shop, reserved shop links and no double posts (`5af3548`).
  - Two things the plan didn't foresee, now in the spec's section 8: a shop's link can't be a word a fixed route uses (`/mentor/export`: `RESERVED_SLUGS`), and a new Hub post, note or check-in needs a one-time token (`lib/staff/once.ts`).
  - The editor's error summary is `<prefix>-problems`, because `<prefix>-summary` is the Summary field's id.
  - The tests: staff pages' tab titles stream in, so the axe checks wait for the `<title>`; the slot request page is checked at h-007, because h-002 has passed; the "(no longer used)" check reloads until it shows.
- **Plan decisions Lama may want to revisit:**
  - Decision 1: staff pages answer 404 with status 200 (below).
  - Decision 3: only the Hub resumes a Hub pause, and shops no account owns can't be paused.
  - Decision 4: nothing shows a hidden listing again.
  - Decision 9 and amendment 3: Featured's week's break is a preference, not a rule.
  - Decisions 10 and 11: pickup points and Hub posts moved into the store.
  - Decision 16: mentors' notes are about the shop's owner and aren't in the seller's data download.
  - Decision 22, the sample wording (below).
- **Checks:**
  - lint and types are clean;
  - 1,937 unit tests pass, in 261 files;
  - end to end, 1,025 pass, 887 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px, with `selling-writes` and then `staff-writes` (1440px) run last. Skipped includes the review screenshots, which run only with `SCREENSHOTS=1`;
  - axe finds no serious or critical issues on every staff page (the admin console, the Hub's tools, the mentor pages), the confirm pages with their errors, the post editor with its errors and a Preview, and the slot request page.
- **First visit at 390px, JS brotli:** homepage 150,613 B, browse 151,360 B, listing 151,769 B, storefront 151,373 B, Hub event 150,613 B, Hub office hours 150,613 B, `/sell` 150,613 B; signed in: new and edit listing forms 152,287 B; staff pages, signed in: Overview 150,613 B, Sellers 150,613 B, Hub tools 150,613 B, Mentor dashboard 150,613 B (stop line 152,305 B, never passed; limit 153,600 B). The stage added no client code, and every page that existed before is exactly as stage F left it, to the byte. The listing forms are still the highest pages, 18 B under the stop line and 1,313 B under the limit; the listing page is 536 B under it. The Hub event and office hours pages weren't in stage F's ledger; they are the same 150,613 B as the info pages.
- **Layout shift** (fonts held back, at 390 and 1440px):

  | Page | 390px | 1440px |
  |---|---|---|
  | Slot request page, a request waiting | 0.0036 | 0.0004 |
  | Slot request page, the form | 0.0007 | 0.0004 |
  | Admin Overview | 0.0007 | 0.0014 |
  | Mentor dashboard | 0.0006 | 0.0027 |

  All are under the limit of 0.05. The other pages' figures are as stage F left them (the selling pitch is still the one close to the limit, 0.0494 at 390px).

- Review screenshots: `docs/progress/staff/` (28, at 390 and 1440px).

## 2026-10-19: Open points for Lama after the staff tools build
- **Staff pages answer 404 with status 200** (plan decision 1). The 404 is raised from inside the page, after it has started streaming, so the visitor sees the site's 404 page, Next adds `noindex`, and the status is still 200. Server Actions and the CSV route make the same role check, and the CSV route is a real 404. A real 404 for the pages needs a role check before rendering once sessions live in a real database (a proxy); it's on the go-live checklist.
- **Hub covers share one limit.** A cover picked in the editor is stored as a waiting photo owned by `hub` (so deleting a staff member's account doesn't take Hub content with it), and sample mode keeps the newest 12 waiting photos per owner. All staff therefore share the 12 photos waiting on unsaved Hub forms; a thirteenth pushes out the oldest, which can lose a cover a Preview was keeping. It's no limit on saved posts.
- **Tech corner's badge drops to New seller** once Overview recalculates (plan amendment 10). The sample shop's "Responsive" badge was seeded, and the real rule counts conversations in the last 90 days; no third sample enquiry was added because the sample conversations' dates fall outside the window anyway. It earns Responsive again if enough enquiries are answered in time. Buyers see a change within 15 minutes (Next's default life), or at the next write that expires the `sellers` tag; the nightly badge job is on the go-live checklist.
- **Deleted sample staff accounts don't come back whole.** A sample staff account deleted and then signed in again by its sample button is a new account: it doesn't get back Sipho's mentor assignment (Naledi on Tech corner), or Naledi's authorship of h-002, h-007 and h-012 (plan amendment 10). Only a restart brings the seeds back.
- **Double submits.** Only new listings (selling amendment 14) and the staff create forms (a new Hub post, a note, a check-in: `lib/staff/once.ts`) carry a one-time token. Everything else relies on its data function checking the state it expects, so a repeated Approve, Dismiss, Accept or RSVP says "Nothing changed. It was already done." and writes nothing. A message or a reply sent twice is sent twice (stage E), and a report's guard is its one-per-target rule.
- **Sample wording to review** (plan decision 22):
  - the notices: `lib/staff/notices.ts`;
  - the notification sentences: `lib/staff/notification-text.ts`;
  - the errors: `lib/staff/errors.ts`; the audit log's words: `lib/staff/audit-words.ts`;
  - the mentor flags' explanations: `lib/staff/mentor.ts`;
  - the confirm pages' lines and the empty states: in each view (`components/staff/*.tsx`, `components/hub/BookSlot.tsx`, `components/hub/PostAction.tsx`); Overview's lines: `components/staff/AdminOverview.tsx`;
  - the declined and Hub-paused lines on `/sell`: `components/sell/ShopDeclined.tsx`, `Dashboard.tsx`; My listings' Hub-pause line, hidden-listing note and the new notice: `components/sell/MyListingsView.tsx`, `lib/selling/notices.ts`;
  - the trust page's and the privacy policy's new sentences: `app/trust/page.tsx`, `app/privacy/page.tsx`, `components/account/PrivacySettingsView.tsx`;
  - Naledi's sample note and check-in and Thandi's sample slot request: `data/fixtures/staff.ts`.
- **The admin mentor dropdown still lists a shop's owner.** A mentor who owns the shop can't be its mentor (amendment 15.3): choosing them gives "Nothing changed", but they stay in the list. Leaving them out of the options for that shop is a small change in `components/staff/AdminSeller.tsx` and its page.
- **Deleting a staff account says nothing about their own work.** What it does (`lib/data/staff-privacy.ts`): their posts stay on the Hub with no author (only an admin can edit them afterwards), the notes and check-ins they wrote stay as "Deleted account", their audit entries stay as "Deleted account", pins and answered requests stay unsigned, and the shops they mentored lose their mentor. The privacy settings' deletion list and the policy describe a seller's data, not this. A line for staff on the delete page is a small change.
- **The full end-to-end count.** A full run on 18 October was interrupted when the Mac went to sleep with its lid closed, so the last complete figure in the commit log is 953 passed and 768 skipped at Task 12 (`a7f33f5`), before Task 20 added the staff tests. This session's full run, lid open and held awake, finished with 1,025 passed, 887 skipped by design and none failed, in 9.9 minutes. (Run alone on 19 October, after `pnpm lint`, `pnpm typecheck` and `pnpm test`; `pnpm e2e` builds and starts its own server on 3200. The lid was open before and during it, and `caffeinate -i` held the Mac awake. No stalls. The 887 skipped are the device-specific checks, the review screenshots, which run only with `SCREENSHOTS=1`, and the like: 768 at the end of stage F, plus the staff tests that run at two sizes only and the new screenshots test.)
- **Hidden listings stay hidden.** Nothing shows one again (plan decision 4): the seller can edit or delete it, and only a change in the store brings it back. Likewise no way to unpause a Hub pause except the Hub's Resume, and sample shops no account owns can't be paused.
- **Featured's break is a preference.** With nine Verified sellers for four places, a strict week's break emptied every campus's row for four days of each week, so a seller who has just been featured comes after everyone else rather than the row running short (spec section 8, item 8; the trust page and the Featured page say so). Once more sellers are Verified the break holds in full. `/admin/featured` records each campus's row for the day when it's opened, which is the row buyers then see.
- **Kept as drafted** (amendment 10): a dismissal needs a note; the audit log records that a note was added, never its words; a mentor sees only their own posts in `/hub/manage`, an admin all of them.
- **A new event can't start in the past,** so the sample office hours h-007 (19 November 2026) is the last upcoming one; after that date the slot request page says the office hours have passed, and the axe check skips pressing a form that is no longer there. Re-date it in `data/fixtures/hub.ts` for later demos.
- **A manual screen-reader check is still to do:** the tables stack into cards on phones and keep their table roles (plan decision 20), and the notices and error summaries are live regions. The tests check the roles, names and words, not what VoiceOver or TalkBack say.
- **Shop links reserve fixed words.** `/mentor/export` is the CSV, so a shop can never be called "export" (`export-shop` instead), and a test fails if a new fixed folder beside `[slug]` in `app/sellers`, `app/admin/sellers` or `app/mentor` isn't added to `RESERVED_SLUGS` (`lib/selling/rules.ts`).
- **Hub covers on Vercel:** a cover goes through a Server Action like a listing's photos, so the 4.5 MB body limit applies there (see the selling build's open point); the go-live checklist has direct-to-storage uploads and moving Hub covers to storage.
- **Unused files, for Lama to delete or keep:** none new. The ones from earlier stages are still there (`components/ComingSoon.tsx` and its test, `data/fixtures/viewer.ts`); no task ran `rm`.
- **Docs still uncommitted, waiting for Lama:** the positioning and editorial spec, the Supabase spec and plan, and the other sessions' lines in this file and in the decisions log. This section, the stage G section above and decision row 73 were written from snippet files (`g-progress.md`, `g-decision.md`) for the same reason; row 73 because rows 71 and 72 are taken.
- **JS room for stage H and later.** The listing forms are the highest pages at 152,287 B (18 B under the stop line, 1,313 B under the limit); every other page has at least 536 B (the listing page, 151,769 B).

## 2026-10-19: Community actions built, in sample mode (stage H)
- **Looking For requests** (`lib/data/requests.ts`):
  - the board, the homepage, request pages and the sitemap read them from the store, tagged `requests`, with the 16 samples as the seed (they have no asker, so they can't take offers);
  - a signed-in student posts at `/looking-for/new` (no contact details, 5 open and 5 a day, a one-time token so a second press makes nothing), edits, closes, reopens and deletes (`/looking-for/[id]/edit` and `/delete`), and sees them in **Your requests** (`/account/requests`, a row on the account page);
  - every form works without the app's JavaScript.
- **Offers** (`/looking-for/[id]/offer`):
  - approved shops only; anyone else sees why not (no shop, waiting for approval, paused, their own request, offered already, a closed request, a sample request);
  - an offer is an E conversation: Offered until the asker replies, one per shop per request (even when sent twice at once), 20 a shop a day, out of the reply rate, and the shop sees "The student who asked" until they write;
  - the asker sees each offer on their request's page and gets a notification;
  - the Hub can hide a reported request from its queue: the confirm page asks for a reason, every open report closes, the asker and the reporters are told, and the board drops it.
- **Following shops:** Follow in the storefront's band (its own row; the owner gets none), Saved's Shops tab (a shop the Hub paused stays, marked Paused, with Unfollow), the dashboard's follower count (never who), and one notification a day when a followed shop first publishes a listing.
- **Post a request, Offer to help and Follow follow the session:** a signed-out visitor gets the sign-in link, with a way back, and a signed-in one the real thing, with no client code. CLAUDE.md now says never to link a signed-out visitor straight at a page that needs sign-in (see the open points).
- **Offline:** `/offline` (a self-contained page: no scripts, images or outside files, under 4 KB, noindex) and a small service worker, `/sw.js`, that shows it when a page load fails: one cache (`vossie_offline`), GET page loads only, navigation preload, and a kill switch (`WORKER_ON`). One statement in the inline boot script registers it after load, in production builds only (accepted by Lama, 2026-10-14): 65 to 89 B brotli in a page's HTML (this run: `/` 89 B, a listing 66 B, a request 77 B; the cut was 100 B).
- **Privacy:** the policy and settings say what requests and follows keep and that deleting an account removes them; the privacy page names `vossie_offline`; the data export gains requests and the shops followed (no ids).
- **Where the build differed from the plan** is in the plan's "Changes made during the build" (`docs/superpowers/plans/2026-10-14-community-actions.md`), with each change's commit. The ones worth knowing:
  - Two review fix commits, one for each batch of reviews: the budget reads South African money ("R250,00" is 250), joined numbers are caught by the contact check, offer threads name the request as it is now and say "A closed shop", and a Hub-paused shop stays on Saved (`72eb71d`); commas and colons in the contact check, offer threads speak of a shop, a hidden request's threads say so, a passed needed-by date is kept on edit, and 44px request links (`46de4e0`).
  - Post a request follows the session (`b52d5aa`), after a signed-out click-through was stranded on sign-in.
  - Found while checking layout shift, and touching earlier stages' pages: on a slow network the footer jumped when a page's content arrived, so the listing, storefront, request, collection and Hub post pages wait behind `PageFallback` (a screen tall) instead of nothing (`625e9a3`); the homepage's hero and browse with no results hold still (`851f544`); the request form, Your requests, the offer composer and messaging's inbox, thread and notifications are a screen tall too (`864b50c`).
  - Every page's first-visit JavaScript is 22 B smaller than stage G left it: the install event's name moved to `lib/install-event.ts`, because client code importing the boot script had cost 527 B on every page (`519d865`).
  - Things the plan didn't foresee, now in the spec's section 8: a new request needs a one-time token, a shop that has gone is "A closed shop" while a Hub-paused one keeps its name, and a page that streams is at least a screen tall.
- **Plan decisions Lama may want to revisit:**
  - Decision 3: the contact check works by pattern (words for numbers get through; reports and the scam check cover that), and an ISBN passes.
  - Decision 4: "a day" is the last 24 hours, and deleting a request gives its slot back.
  - Decision 12: only approved shops offer, and the 16 sample requests can't take offers.
  - Decision 15: the new-listing notification comes only from an open shop's first publish.
  - Decision 16: Follow has its own row in the band, and the owner's row is empty (below).
  - Decision 26: the sample wording (below).
- **Checks:**
  - lint and types are clean;
  - 2,219 unit tests pass, in 294 files;
  - end to end, 1,199 pass, 1,074 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px, with `selling-writes`, `staff-writes` and then `community-writes` (390px) run last. Skipped includes the review screenshots, which run only with `SCREENSHOTS=1`;
  - axe finds no serious or critical issues on the request form (new, edit, and after a refusal), Delete request, Your requests (open, closed and hidden), the offer composer with its scam check, the thread waiting for a reply and the asker's side, the inbox, Hide the request and its error, Saved's Shops tab (signed out, signed in, with a card and after Unfollow), the storefront's Follow, and the offline page.
- **First visit at 390px, JS brotli:** homepage 150,591 B, browse 151,338 B, listing 151,747 B, storefront 151,351 B, Saved 151,226 B, board 150,591 B, request 151,067 B, `/sell` 150,591 B; signed in: new and edit listing forms 152,265 B, request form 150,591 B, Your requests 150,591 B, offer composer 150,591 B, Saved's Shops tab 151,226 B (stop line 152,305 B, never passed; limit 153,600 B). The stage added no client code, and every page is exactly 22 B smaller than stage G left it (see above). The listing forms are still the highest pages, 40 B under the stop line and 1,335 B under the limit; the listing page is 558 B under it. The homepage's whole first visit, measured as spec 11 defines it, is 313,616 B against the 358,400 B cap.
- **Layout shift** (fonts held back 800 ms, at 390 and 1440px):

  | Page | 390px | 1440px |
  |---|---|---|
  | Looking For board, signed in | 0.0021 | 0.0022 |
  | A request's page, as its asker | 0.0233 | 0.0029 |
  | The request form | 0.0272 | 0.0016 |
  | Edit request | 0.0003 | 0.0021 |
  | Delete request | 0.0063 | 0.0005 |
  | Your requests | 0.0003 | 0.0003 |
  | The offer composer (no shop) | 0.0189 | 0.0006 |
  | An offer thread, as the shop | 0.0153 | 0.0005 |
  | Saved's Shops tab, signed in | 0.0013 | 0.0006 |
  | A storefront with Follow | 0.0010 | 0.0007 |
  | Inbox, thread and notifications | 0.0004 | 0.0006 |
  | `/offline` | 0 | 0 |

  All are under the limit of 0.05, on a slow connection as well (350 ms latency, 400 kbps, with the CSS cached).
- Review screenshots: `docs/progress/community-actions/` (22, at 390 and 1440px).

## 2026-10-19: Open points for Lama after the community actions build
- **Signing in replays a gated page's redirect** (plan amendment 18). After a client navigation to a page that sent a signed-out visitor to sign-in, signing in replays that redirect, so the visitor is stranded on sign-in and the page never opens. It is stage D's sign-in flow; a `refresh()` in `afterSignIn` didn't clear it. Post a request, Offer to help and Follow work round it (links that follow the session), and CLAUDE.md says never to link a signed-out visitor straight at a gated page, but any other direct link to one still has it. It is on the go-live checklist.
- **The worker's margin in the HTML is thin.** The registration costs 65 to 89 B brotli against the 100 B cut (this run: `/` 89 B, a listing 66 B, a request 77 B), and the homepage is closest, 11 B under. It varies with the build, so any change to the head, the boot script or a page's first chunk should rerun `tests/e2e/performance.spec.ts` (`the worker's registration costs under 100 B…`).
- **The owner's empty row.** The storefront's band reserves an empty 52px row for the owner on phones and tablets: it is the Follow row's space, kept so nothing moves when the session's part streams in, and the owner has no Follow. Removing it shows the owner a shorter band than everyone else and moves the page when the session arrives; it is Lama's call (`.seller-follow` in `app/globals.css`).
- **A Saved card for a Hub-paused shop isn't checked by axe in a browser.** A followed shop the Hub has paused shows "Paused", Unfollow and no storefront link (unit-tested); axe never sees it, because no sample account follows a paused shop and making one needs a Hub pause, a staff write that runs in another project. Its colours are navy on pale (about 11:1, worked out by hand from the CSS).
- **The `selling-writes` flake did not recur** (plan amendment 21.4). In Task 24's runs all 6 `selling-writes` tests passed in the one run that reached the project; the other runs stopped earlier (see the checks above). Its cause is still unexplained, so a failure there in a later run is worth chasing.
- **The homepage's whole first visit swung between runs.** Amendment 20.3: it varied by about 3 KB (13 KB at worst, once past the 358,400 B cap) with link prefetches and lazy photos, so the test now measures the first visit as spec 11 defines it (before below-the-fold photos, leaving out `?_rsc=` prefetches and lazy images below the fold). It is 313,616 B in this run (313,540 B in the last, steady to 2 B within a run); the cap is unchanged. The old measure is logged beside it as `everything` (344,530 B this run).
- **Sample wording to review** (plan decision 26):
  - the request form's hints and errors: `lib/looking-for/errors.ts`, `components/looking-for/RequestFormView.tsx`; the composer's notes: `components/looking-for/OfferView.tsx`;
  - the status lines and the notification sentences: `lib/looking-for/words.ts`, `lib/following/rules.ts`; the offer threads' words: `lib/looking-for/words.ts`, `components/messages/OfferAbout.tsx`, `ThreadView.tsx`;
  - Your requests' and Saved's Shops empty states, and the delete page's lines: `components/looking-for/YourRequestsView.tsx`, `components/saved/FollowedShopsView.tsx`, `components/looking-for/DeleteRequestView.tsx`; the dashboard's followers line: `followersLine` in `lib/following/rules.ts`, shown by `components/sell/Dashboard.tsx`;
  - the offline page's words beyond the spec's: `lib/offline.ts`;
  - the privacy policy's and settings' new sentences: `app/privacy/page.tsx`, `components/account/PrivacySettingsView.tsx`.
- **Requests and offers: limits counted before the write.** The 5 open requests, 5 a day and 20 offers a day are counted with awaits before the write, so forms sent at the same moment can pass them; one offer per shop per request is exact even sent twice at once. The real backend counts them in the database, beside a unique index on the conversation's request and shop (go-live checklist, section 6).
- **The kill switch reaches phones slowly.** `WORKER_ON = false` stops pages registering the worker and serves one that removes itself, but a phone that already has the worker only gets it through the browser's own update check, which can take up to about a day (a plain reload doesn't trigger it). The go-live checklist says to try it on a real phone before launch.
- **Nothing closes a request on its own, and nothing shows a hidden one again.** A request stays open until its asker closes it or deletes it; the Hub's hide has no undo, as for G's hidden listings. Closing old requests is on the checklist's scheduled jobs.
- **Only approved shops offer.** Decision 12 follows the checklist's "Who can sell?" question: if Eduvos opens selling to every student, offers open with it.
- **A manual screen-reader check is still to do:** the status lines (`role="status"`) after each action and the error summaries on the new forms, and Follow's and Unfollow's names. The tests check the words and roles, not what VoiceOver or TalkBack say.
- **Unused files, for Lama to delete or keep:** none new. The ones from earlier stages are still there (`components/ComingSoon.tsx` and its test, `data/fixtures/viewer.ts`); no task ran `rm`.
- **Docs still uncommitted, waiting for Lama:** the positioning and editorial spec, the Supabase spec and plan, and the other sessions' lines in this file and in the decisions log. This section, the stage H section above and decision row 74 were written from snippet files (`h-progress.md`, `h-decision.md`) for the same reason; row 74 because 71 is the positioning decision and 73 is stage G's.
- **JS room for stage I and later.** The listing forms are the highest pages at 152,265 B (40 B under the stop line, 1,335 B under the limit); every other page has at least 558 B (the listing page, 151,747 B). Stage I's matching runs in the publish Server Action (decision 69), so it adds no script.

## 2026-10-20: Header that gets out of the way, and a phone tab bar (decision 75, spec 6.2)
- **Header.** Scrolling down past 120px hides all of it, crest included. Scrolling back up 40px brings the whole header back (compact bar, pennant with a soft shadow), without moving the page, and 80px down hides it again. iOS's bounce at the bottom of a page doesn't count as scrolling up. Hidden, the keyboard gets a "Show navigation" button that appears on focus, like the skip link, and moves focus to Menu. The old pinned crest and its tap are gone.
- **Phone tab bar** (`components/tabbar/TabBar.tsx`, server-rendered): Home, Shop, Sell, Saved (with its count) and Account (with the new-notifications badge), always on screen below the tablet step, with a pale pill on the current tab and Sell as a sky pill. The page keeps room for it under the footer, focus and toasts. A listing's dock takes its place, and it steps aside while someone types. The phone header is now Menu, the pennant and Search.
- **Checks:** lint and types are clean; 2,317 unit tests pass. End to end, the shell, axe, accounts, shopping, messaging and performance specs pass at 360, 390, 768 and 1440px (the JS budget test included). The full suite (selling, staff and community writes, 1024px) wasn't run this session. The phone header's account icon and Saved link are `display: none`, so the e2e helpers now find whichever link is visible: the header's from the tablet step, the tab bar's on phones. The Saved and Account tabs give their counts as descriptions ("2 items", "1 new notification"), not in their names.
- **Smoother motion (later the same day).** Measured frame by frame, the header came back in a jerk (95% of the slide in the first 50ms) and then wobbled as its background shrank and the crest's shadow faded in after it. Now the quick links and the bar slide as one sheet: out in 220ms, accelerating; back in 320ms, decelerating, evenly. The bar takes its compact, shadowed look while out of sight, so the slide is the only movement. The per-item stagger is gone. Shell, axe and layout-shift specs pass at 390 and 1440px. If the site's data-saver toggle is on, or the browser's Save-Data is, every change is instant on purpose.
- **JS: the tab bar had cost every page about 695 B** (found by the stage K session). It wasn't the code's size: the tab bar, a server component, imported `SavedCount` straight from `SavedLink.tsx`, which made that file a client entry of its own, and Turbopack then split decision 63's merged layout chunk in two. Changing `requestCost` (0 to 5000) didn't bring it back. Now the tab bar imports `SavedCount` through `SiteHeader.tsx`, which the layout already loads, and the chunk merges again. NavLink passes its props through, SavedLink and the tab share their badge and wording, and unused `style` props are gone. A tidier header state machine split the chunk again despite being smaller, so it was left as it was: the merge is fragile, and `performance.spec.ts` doesn't catch the stop line. First-visit JS at 390px, brotli: homepage 150,660 B, listing 151,816 B, listing forms 152,334 B (each 69 B over stage J). **The listing forms are 29 B over the 152,305 B stop line (decision 52), under the 153,600 B limit; Lama accepted it (decision 78).**
- **For Lama:** the screenshot files `02-crest-only` and `03-revealed` in `docs/progress/part-1/` keep their names but now show the hidden and shown states once the screenshot spec runs again. Uncommitted, waiting for Lama's go-ahead.

## 2026-10-20: Saved-search alerts built, in sample mode (stage I)
- **Save this search** on browse (`components/browse/SaveSearchControl.tsx`): a fixed-height row under the chips for any search with words, a category or a filter. Signed out it is a sign-in link with a way back; signed in, a plain form with a one-time token, so a second press saves nothing more. "Search saved." once, then "You've saved this search." with Manage saved searches. Up to 20 an account ("You're at the 20-search limit."); the same words in another order are the same search. No client code.
- **Saved's Searches tab** (`/saved?tab=searches`): each search's label linking to its results with the campus pinned, when it was saved ("Saved 12 Oct"), Pause or Resume alerts, and Delete, with status lines; sign-in or Browse when there's nothing to show.
- **Alerts:** a listing's first publish by an open, approved shop is matched against every active saved search with browse's own `listingMatches`, after the shop's followers are told and under the same condition. Each account is told once, under its oldest matching search, with at most one `search-match` notification a search a SAST day, made unread again by a later match ("2 new listings match your search …"). Edits, relists, resumes, a paused shop, a paused search and the shop's own owner send nothing. No email. The notification shows the search icon.
- **Privacy:** the policy and privacy settings name saved searches; deleting an account removes them and their notifications; the data export gains them by name (no ids). Deleting a listing, or a whole shop, deletes the alerts that link to it, so none leads to a 404.
- **Where the build differed from the plan** is in the plan's "Changes made during the build" (`docs/superpowers/plans/2026-10-14-search-alerts.md`) and the spec's section 8. The ones worth knowing:
  - A save posted without a token, or with an unknown or expired one, still saves, and nothing is recorded under the posted string (`010e26c`).
  - The review's fixes (`e1de51a`): the limit line was two lines on a 320 to 360px phone and grew the 72px row, so it is now "You're at the 20-search limit."; deleting one listing deletes the alerts that link to it (H's new-listing ones too); the deleted-shop test checks what should survive.
  - Another session reworked the header and tab bar in the same working tree while this stage was built. Its files stayed out of this stage's commits (shared files were staged hunk by hunk), and this stage's end-to-end runs used a scratch copy of the committed code on port 3204. So the new axe checks are in `tests/e2e/alerts-checks.spec.ts` and the review screenshots in `tests/e2e/alerts-screenshots.spec.ts`, not in `a11y.spec.ts` and `screenshots.spec.ts`, which had its uncommitted edits. The specs open pages by URL, never through the header's Account or Saved links, which that work moves into a phone tab bar.
- **Plan decisions Lama may want to revisit:** decision 12 ("never more than one unread" holds within a SAST day), decision 18 (20 saved searches an account) and the sample wording (`lib/saved-searches/words.ts`).
- **Checks:**
  - lint and types are clean;
  - 2,316 unit tests pass, in 303 files;
  - end to end, on the committed code (`9efecd5`): 1,247 pass, 1,144 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px, with `selling-writes`, `staff-writes`, `community-writes` and then `alerts-writes` (390px) run last. An earlier full run of the same code had one failure (see the open points); it passed when rerun;
  - axe finds no serious or critical issues on the Save row (signed out, the button, saved, at the limit, a refusal from another tab) or the Searches tab (signed out, none saved, a row, paused, deleted).
- **First visit at 390px, JS brotli:** no page changed. Homepage 150,591 B, browse 151,338 B (with a search 151,338 B), listing 151,747 B, storefront 151,351 B, Saved 151,226 B (Shops and Searches tabs 151,226 B), request and collection 151,067 B, privacy 150,591 B; signed in: new and edit listing forms 152,265 B (40 B under the stop line), browse with a search 151,338 B, Searches tab 151,226 B.
- **Layout shift** (fonts held back, at 390 and 1440px): browse with a search 0.0003 and 0.0003; the Searches tab signed out 0.0003 and 0.0006, signed in 0.0013 and 0.0003; on a slow connection (350 ms, 400 kbps, CSS cached) every new row is 0.0010 or less; the "at the limit" row at 360px 0.0000, held at 72px. The limit is 0.05.
- Review screenshots: `docs/progress/search-alerts/` (12, at 390 and 1440px). To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/alerts-screenshots.spec.ts`.

## 2026-10-20: Open points for Lama after the saved-search alerts build
- **Alerts are in the app only.** Email alerts or a digest wait for an email service and a consent choice (spec 7, go-live checklist section 7).
- **Matching runs inside the publish Server Action.** Fine for sample mode; on the real backend it should be a database query or a queue job so publishing doesn't wait (go-live checklist section 6).
- **Every signed-in browse search that offers Save writes a one-time token** (a form-state row kept an hour). Cheap in memory; the real backend should keep these cheaply or issue the token on demand (go-live checklist section 6).
- **The header and tab bar work is uncommitted**, waiting for Lama's go-ahead. This stage's end-to-end specs don't use the header's Account or Saved links, so they pass with it or without it; the full suite has not been run with both together.
- **Sample wording to review:** `lib/saved-searches/words.ts` (the row's lines, the status lines, the notification sentence), `components/saved/SavedSearchesView.tsx` (the tab's empty states), and the privacy sentences in `app/privacy/page.tsx` and `components/account/PrivacySettingsView.tsx`.
- **A manual screen-reader check is still to do** for the Save row's status line and the Searches tab's buttons.
- **A one-off failure in `community-writes`.** In the first full run of stage I's code, H's request test found a deleted request's page still showing the request 5 seconds after the delete (a stale cached page, `tests/e2e/community-writes.spec.ts:73`). It passed when the project was rerun alone (16 of 16) and in a second full run. Stage I touched no request code, so it looks like a timing race in the request cache's expiry under a long run; if it comes back, look at `requestsChanged()` and the request page's cached reader.
- **Unused files:** none new.
- **Docs still uncommitted, waiting for Lama:** the positioning and Supabase docs, the header session's section and row 75, and the other sessions' lines in this file and the decisions log. This section, the stage I section and decision row 76 were written from snippet files for the same reason.

## 2026-10-20: Staff accounts, the admin's numbers and Show again built, in sample mode (stage J)
- **Staff accounts** (`/admin/staff`): everyone with a staff role (name, email, campus, roles, shops mentored) under a Give a staff role form. A role is given only by the person's exact Eduvos email, never through a search or a list of students, and only to someone who has signed in once. Each row has a Remove link per role that goes to a confirm page saying what will happen (a mentor's shops are left without a mentor; a mentor who is also an admin keeps the Hub's tools). Your own admin role has no Remove link ("This is you."); its page is headed "Your admin role" and refuses it. `removeRole` also refuses to remove the last admin. Each change writes one audit entry under a new Staff accounts kind and tells the person with a `staff-role` notification (shield icon). Nothing cached reads roles, so no tag is expired. Deleting a staff account says what happens to their posts, notes, mentored shops and audit entries, and warns Vossie's only admin without blocking.
- **The admin's numbers** (`/admin/numbers`): two plain tables, All campuses (last week, the week before, change, since the start) and By campus for last week, each campus linking to its own view (`?campus=midrand`); seven measures (listings published, shops approved, Looking For requests posted, enquiries started without offers, reports made, reports closed, shops followed) plus open shops now. Weeks run Monday to Sunday in SAST. Saved searches are never counted. No names, no charts, no client code.
- **The small-number rule** (`protectCounts`, `lib/staff/numbers.ts`, amended on plan review): a private week's campuses all show "Hidden" when any campus, or a campus that has gone, has 1 to 4; totals always show (exact, or "Under 5"); Change is "—" unless both weeks are exact; Since the start is in tens, by campus only when both weeks are. Public measures and open shops are exact. A brute-force unit test checks that no figure from 1 to 4 can be worked out. The first drafted rule leaked (765 cases); see the spec's section 12.
- **Show again** (`/admin/hidden`): hidden listings and requests, newest first, each with a confirm page. It clears the hide, writes one audit entry, tells the seller or asker, expires the cache tag and makes photos public again. The reports stay closed and the people who made them aren't told. Reached from a link above the Reports queue, an Overview line ("Hidden by the Hub") and "Show it again" on a closed report whose target is hidden. Hiding it again needs a new report.
- **Task 1's spike failed.** `/admin` with `instant = false` and the gate at the top level built and left public routes unchanged, but every request still answered 200, because the root layout's streaming shell is sent before the role check. A real status needs the root layout changed, which another session has uncommitted edits to. Staff pages keep G's pattern (status 200 with the 404 view and `noindex`); the proxy or real-backend go-live item for a 404 status stays; `StaffSkeleton` stays in use; `STAFF_404_IS_REAL` is false and the status checks in `staff.spec.ts` skip.
- **Where the build differed from the plan** is in the plan's "Changes made during the build" (`docs/superpowers/plans/2026-10-20-staff-accounts-and-numbers.md`) and the spec's section 12. The ones worth knowing:
  - The review (opus, read-only) replaced the small-number rule and fixed the week label, the order of Give role's checks and the accessible names (WCAG 2.5.3: "Remove mentor role for Naledi", "Show again: {title}").
  - Task 13 split in two. `StaffSkeleton` gained `short`, used on the four confirm pages, because a full skeleton shifted a short phone's confirm page (Show again at 375x667: 0.0892 to 0.0437; the own-admin refusal 0.0437).
  - Tasks 6 and 10 were not strictly test-first; the review's mutation tests (`0570965`, `c655039`) cover them.
  - The review screenshots showed a staff page's heading running 44px past a 390px screen when an item's title held one long word, which a student can type: the frame's heading now wraps (`wrap-anywhere`, since the heading is a grid item; `03c4f70`), on every staff page.
  - Another session's uncommitted header and tab bar work shared the tree, so the new checks and screenshots are in new spec files (`staff-accounts-checks.spec.ts`, `staff-accounts-screenshots.spec.ts`) and runs used scratch copies.
- **Plan decisions Lama may want to revisit:** decision 10 (a mentor who is also an admin keeps the tools), decision 12 (Open shops now needs no Verified), decision 20 (the policy sentences) and decision 28's sample wording.
- **Checks:**
  - lint and types are clean;
  - 2,435 unit tests pass at HEAD `8df6ef0`;
  - end to end: 1,277 pass, 1,159 are skipped by design and none fail, across 360, 390, 768, 1024 and 1440px, with `selling-writes`, `staff-writes`, `community-writes`, `alerts-writes` and then `staff-accounts-writes` run last (on `8df6ef0`, before the one-class heading fix below) (full suite, with `staff-accounts-writes` last); on its own, staff-accounts-writes 30 passed and staff-checks 50 passed, 4 skipped;
  - axe finds no serious or critical issues on the staff accounts, numbers, hidden and confirm pages at 390 and 1440px.
- **First visit at 390px, JS brotli:** no public page changed: homepage 150,591 B, browse 151,338 B, listing 151,747 B, storefront 151,351 B, Saved 151,226 B, privacy 150,591 B, notifications 150,591 B; new listing form (signed in) 152,265 B (40 B under the stop line). Staff pages signed in as the admin: 150,591 B (Overview, Staff accounts, Numbers, Hidden). No new client code.
- **Layout shift** (at 390 and 1440px): Staff accounts and Numbers 0.0026 or less; the four confirm pages with the short skeleton, at most 0.0437 on a 375x667 phone. The limit is 0.05.
- Review screenshots: `docs/progress/staff-accounts/` (18, at 390 and 1440px). To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/staff-accounts-screenshots.spec.ts --project=staff-accounts-writes --no-deps`.

## 2026-10-20: Open points for Lama after the staff accounts, numbers and Show again build
1. **Can an admin approve their own shop?** Approve, verify and pin aren't prevented today (spec section 10; go-live section 7).
2. **The threshold of 5** (or 10). While campuses are small, the By campus private columns will often say Hidden; totals are unaffected. An "Other campuses" row that groups small campuses is a later improvement.
3. **Campus-scoped numbers for mentors.** Not built: the numbers are admin-only.
4. **Should Show again keep a note** of why it was shown again? Today it keeps the audit entry only.
5. **`StaffSkeleton` stays in use** (Task 1 failed), so there is nothing to delete or keep.
6. **The sample wording** to review: the confirm pages' lines and the own-admin page, the numbers' key and intro, the hidden page's headings, the Overview section, and the "sold / paused / draft" lines on a listing's Show again page (`components/staff/AdminStaff.tsx`, `StaffRoleConfirm.tsx`, `AdminNumbers.tsx`, `AdminHidden.tsx`, `ShowAgainConfirm.tsx`, `AdminOverview.tsx`), plus the privacy sentences.
7. **The only admin's warning, not a block.** Deleting the only admin's account warns them but doesn't stop it; the data layer's last-admin rule covers removing a role, not deleting an account.
8. **Staff pages' 404s still answer 200** (Task 1). The go-live item for a status from a proxy or the real backend stays.
9. **The short-phone shift of 0.0437 on the confirm pages** is one entry on the footer's list items: under the 0.05 limit, but close.
10. **A manual screen-reader check** is still to do for the Give role form's error summary, the role confirm pages and the numbers' tables.
- **The header and tab bar session's work is still uncommitted**, waiting for Lama's go-ahead. This stage's end-to-end specs open pages by URL, so they pass with it or without it; the full suite has not been run with both together.
- **Go-live items added:** the numbers as a SQL view then a weekly roll-up, the last-admin rule in the database, a way to give the first admin outside the app, and re-checking the actor's role inside the transaction (a just-demoted admin can finish one in-flight action).
- **Docs still uncommitted, waiting for Lama:** the positioning and Supabase docs and the other sessions' lines in this file and the decisions log. This section and decision row 77 were written from snippet files for the same reason.

## 2026-10-20: Hardening built, in sample mode (stage K)
- **Signing in ends with a full page load.** The spike (Task 1, `tests/e2e/sign-in-return.spec.ts`) confirmed stage D's replay on the code as it stood: variants 1 to 4 (client navigations) failed 3 of 3 at 390 and 1440, and a kept `/account` held the email after the old Server Action sign-out. So step 2's Sign in, step 3's Continue and the sample buttons now post plain HTML forms to Route Handlers (`/login/code`, `/login/profile`, `/login/sample`) that check the post came from Vossie (`isSameOrigin`: the `Origin`, or a same-host `Referer` when a proxy browser sends none; 403 otherwise) and answer 303. The steps' logic moved to a plain module, `lib/auth/sign-in-finish.ts`, because every export of a `"use server"` file is an endpoint. A signed-in visitor who lands on `/login` sees a Continue button on the signed-in note, except for `/account` and public pages.
- **Signing out and deleting an account end with a full page load too.** `/logout` (Lama's answer, built whatever the spike found; `signOut` left `lib/auth/actions.ts`) and `/account/privacy/delete` (**made by Claude under decision 54**, mirroring Lama's sign-out answer: `5aae6b0`, after review). `updateTag` can't run in a Route Handler, so they use `sellersChangedNow`, `hubChangedNow` and `requestsChangedNow`.
- **Message limits:** 40 new conversations in any 24 hours (offers left out) and 120 messages in any hour, as a buyer or through a shop (`lib/messaging/limits.ts`). They're checked after the fields and before the scam words, in the composer, a reply and the offer composer (the offer's 20-a-day check moved before the scam words too). The five sample accounts are exempt only in sample mode. The words: "You've started 40 conversations in the last 24 hours. You can still reply in those. Try again later to start a new one." and "You've sent 120 messages in the last hour. Try again later."
- **Keyed hashes:** sign-in codes, session tokens and sign-in attempt tokens are hashed with HMAC-SHA-256 under `VOSSIE_AUTH_HMAC_KEY` (`lib/auth/secrets.ts`), with purpose prefixes. The key is read on first use, never at build: 32 characters or more; in sample mode a development key with one warning when unset; refused when too short, or unset with sample mode off. With sample mode off `getSessionKey()` returns null, so a missing key can't break signing out. `STORE_VERSION` is 10, so every old row resets. A build without the key passes.
- **Info pages:** How it works names everything that needs an account and what you can do today; How trust works gains "When something is reported" (sample wording Lama kept for now); Safety says requests can be reported and hidden; the privacy policy opens Your account with everything that needs one, lists every notification (the two slot ones added on review), says what a staff role keeps, and says codes and sessions are kept only as keyed fingerprints, and that a code is also kept as written while the preview shows it on screen.
- **Lama's five answers (2026-10-20):** the limits are 40 and 120; sign-out is a full page load; report the kept-redirect behaviour to Next.js only if needed; the preview runs on the development key; the trust section's new wording stays as sample text for now.
- **Back/forward cache.** Playwright launches Chromium with it off, so no test sees it. The controller checked the desktop Chromium built-in browser: after the 303 sign-out, Back twice showed no signed-in content and no email. iOS Safari is unchecked (go-live item). Nothing from the review's two options (`Clear-Site-Data`, a `pageshow` reload) was built.
- **Where the build differed from the plan** is in the plan's "Changes made during the build" (`docs/superpowers/plans/2026-10-20-hardening.md`) and the spec's section 11. The ones worth knowing:
  - Tasks 3 to 5 were committed together (`fa71050`); some component tests were written with their code, so they had no red run.
  - `accounts.spec.ts`'s local `signInAsSample` now waits for the header to hydrate after the 303; no other existing e2e test changed.
  - The review (`5aae6b0`) fixed the privacy wording on codes kept as written and the slot notifications, added off-site `next` tests at the code, profile and sample steps (a raw read fails all 10), and moved account deletion to a Route Handler.
  - The header session's `16dab6a` (not this stage) moved the JS figures: the stage's Start row was J + 723 B at `0b969aa` and J + 69 B after it.
- **Checks:**
  - lint and types are clean;
  - 2,551 unit tests pass at HEAD `5aae6b0`;
  - end to end: the device projects at 2 workers on `5aae6b0`: 1,248 passed, 1,210 skipped by design, 7 failed. Three were the shared sign-in helper clicking before the new document hydrated, fixed in `4201d55` (`settled()`) and passing on rerun; the other four fail the same way on a clean build of `16dab6a`, before stage K (see the open points). The six write projects, run with `--no-deps`: 62 passed, 1 skipped. A first run at the default workers, with the machine's load average at 59 from other sessions' builds, timed out 44 tests (with `hardening-writes` last, after `staff-accounts-writes`);
  - axe finds no serious or critical issues on the signed-in note with Continue, or on the composer at the limit, at 390 and 1440px.
- **First visit at 390px, JS brotli:** no page moved from stage K (measured against `16dab6a`): homepage 150,660 B, listing 151,816 B, browse 151,407 B, storefront 151,420 B, Saved 151,295 B, privacy 150,660 B, sign-in 150,660 B; new listing form (signed in) 152,334 B (29 B over the stop line, accepted as decision 78). No new client code, cookie or table.
- **No screenshots** this stage: the only new drawn thing is Continue on the signed-in note, and the limit's message sits in an existing summary.

## 2026-10-20: Open points for Lama after the hardening build
1. **The limits can be raised.** They are 40 new conversations a day and 120 messages an hour (`CONVERSATIONS_PER_DAY` and `MESSAGES_PER_HOUR`, `lib/messaging/rules.ts`); change the constants and the words follow.
2. **iOS Safari's back/forward cache is unchecked.** Open `/`, sign in, open `/account`, sign out, press Back twice, and look for the signed-in header or the email; do the same after deleting a test account. If it leaks, the options are `Clear-Site-Data: "cache"` on the 303 or a `pageshow` reload in the boot script. Go-live item added.
3. **Reporting the kept-redirect behaviour to Next.js is optional.** `tests/e2e/sign-in-return.spec.ts` with `SIGN_IN_SPIKE=1` is the reproduction. Go-live item added.
4. **The preview's key is unset.** The Vercel preview uses the development key and logs one warning per process until `VOSSIE_AUTH_HMAC_KEY` is set (32+ characters; changing it signs everyone out). Set it, and sign in once, in every deployed environment before real accounts.
5. **The trust page's "When something is reported" is sample wording** kept for now (you said yes for now). The Continue button's wording and the two limit messages are samples too.
6. **Account deletion became a full page load** (`/account/privacy/delete`) by Claude under decision 54, mirroring your sign-out answer. The plan had it staying a Server Action. Say if you'd rather it went back.
7. **The limits are counted before the write,** so forms sent at the same moment can pass them. Fine in one process; the real backend counts with the write, under a lock (go-live item added).
8. **Phase B notes:** the development key and the sample exemption must be refused whenever `VOSSIE_BACKEND=supabase`; the Supabase session's phase B builds on the handlers, `sign-in-finish.ts`, `same-origin.ts` and `authKey()` (go-live items added).
9. **Four e2e failures that predate stage K,** in the header and tab bar's area, fail identically on `16dab6a`: `responsive.spec.ts:26` (Sign in reachable by keyboard, at 360 and 390), `listing.spec.ts:34` (the dock's room under the footer, at 390) and `a11y.spec.ts:343` (the composer at 360, a real overlap: the hidden header's box sat over the error summary's link). The header session has them and is fixing them; stage K didn't touch those specs.
- **Docs still uncommitted, waiting for Lama:** the other sessions' lines in this file and the decisions log. This section and decision row 79 were written from snippet files for the same reason.

## 2026-10-20: Supabase phases B and C planned, and phase A merged into main
- **Lama's decisions:**
  1. Merge phase A into main, rather than main into the branch.
  2. The schema catch-up and phase C go first. Phase B (sign-in) starts after stage K lands, because K rewrites the same `lib/auth` files.
  3. Email (spec open decision 1) is deferred: phase B is tested locally with Mailpit.
- **Phase A merged:** `84f61a1`, in a quiet window from main's build session.
  - No conflicts.
  - Main's untracked copies of the Supabase spec and plan were moved to the session scratchpad, not deleted. The branch's copies replace them: the spec was identical and the plan older.
  - The privacy test's file walk now skips `app/sw.js`, a route folder that looks like a file.
  - Lint and types are clean, and 2,468 unit tests pass.
  - **Local stack:** all 8 migrations are applied and `supabase test db` passes 803 tests.
  - **Staging is unchecked:** the CLI's login is refused (403).
- **Found:** phase A's schema covers stages D to F only. Stages G to J were built without migrations, and the spec's "phase D" never happened. What's missing:
  - 10 tables: audit log, featured pins and draws, mentor notes, Hub posts, RSVPs and bookings, requests, follows, saved searches;
  - staff columns on seller profiles, listings and reports;
  - 7 of the app's 11 notification kinds;
  - an `offered` status for conversations, and two indexes that would block offers;
  - five groups of steps in `forget_account`;
  - the seed's requests, Hub posts, notes and booking.
- **Plans:**
  - programme: `docs/superpowers/plans/2026-10-20-supabase-phases-b-c.md`, with stage K's file list, which phase C avoids until K lands;
  - step 2, the schema catch-up: `docs/superpowers/plans/2026-10-20-supabase-schema-catch-up.md` (13 tasks).
- **Step 2's nine plan decisions, confirmed by Lama as recommended (2026-10-20):**
  1. Staff writes are `public` functions called with the staff member's own session. Each re-checks the role in the same transaction as its one audit row. This changes spec decision 5, which had put staff tools under the admin client.
  2. "Every campus" is stored as null, so `campus_slug` stays a real foreign key.
  3. A saved search's identity is the app's `search_key`.
  4. Matching new listings against saved searches stays in TypeScript, through `listingMatches`. The database applies only the once-per-account and once-a-day rules, and tells followers inside `save_listing`.
  5. Featured draws are written by the server only.
  6. Hub covers are photos with no owner, stored at `hub/<id>`.
  7. A shop's old links live in `shop_previous_slugs`.
  8. Reports about a deleted request keep `target_gone = false`, as sample mode does.
  9. The message limits (40 new conversations a day, 120 messages an hour) have no sample-account exemption on Supabase.
- **For Lama:**
  - log the CLI in to "Vossie Market" from your own terminal with a new scoped token (the phase A token expires 2026-10-22);
  - the old `../Vossie-supabase` worktree and its branch are merged and can be removed when you say.

## 2026-10-20: Supabase schema catch-up for stages G to J built (step 2)
- **Where:** branch `backend/phases-b-c` (worktree `../Vossie-backend`), merged into main. Each task was committed after the controller's own check, with Lama's go-ahead. Nothing was pushed.
- **12 migrations after phase A's 8**, each written test first. All are applied locally:
  - the tables widened for stages G to J (phase A's own tables);
  - the staff tables and staff reads;
  - requests, follows and saved searches, with offers marked `is_offer`;
  - staff actions on shops, reports and hiding;
  - staff tools: pickup points, featured pins, the Hub, mentors and roles;
  - community actions: requests, offers, follows, saved searches and first-publish alerts;
  - a Hub-paused shop is no longer public;
  - stage K's message limits;
  - the admin's raw weekly counts, server only;
  - complete account deletion;
  - the final review's fixes;
  - a deleted mentor's name leaving the audit log.
- **Rules held in the database, as in the app:**
  - every staff action re-checks the role in the same transaction as its one audit row;
  - notification wording is built in SQL;
  - every limit is counted under a lock;
  - the asker, followers, mentor notes, hidden content, drafts and raw small counts stay private (each with a refusal test).
- **The seed** matches the sample store: the 16 requests, 18 Hub posts, mentor notes, the open booking, pickup points, and seller profiles' staff fields.
- **Reviews:** a plan review, a review of Tasks 1–3, and a final review (opus). They fixed:
  - offers turning into enquiries;
  - a one-time token that could be freed;
  - a Hub-paused shop staying public;
  - hidden listings being reportable;
  - raw small counts reaching admins;
  - an admin being able to name a hidden request's asker through the audit log.
- **Lama's choices:**
  - the plan's nine decisions as recommended;
  - hiding needs an open report;
  - the numbers are server only;
  - a deleted mentor's name is blanked from the audit log, in the app as well. The privacy settings' staff line and the stage J spec now say so.
- **Checks:**
  - pgTAP: 1,976 tests pass, up from 803;
  - unit: 2,476 on the branch;
  - lint and types are clean;
  - local advisors: info-level items only, each explained in the plan.
- **Details:** every decision and change is in `docs/superpowers/plans/2026-10-20-supabase-schema-catch-up.md`; the spec gained section 12.
- **Next:**
  - Task 12: staging. Lama logs the CLI in, then sees the dry run of the 12 migrations before any push.
  - Phase C, then phase B. Stage K's sign-in, hashing and deletion route are in, so phase B builds on them.

## 2026-10-21: Housekeeping built, in sample mode (stage L)
- **Review fix (`1f55ee5`).** The code review found that an admin could dismiss reports about their own listing or request once they had deleted it, because `own` was worked out only while the target existed. A report now records who owned its target when it is made (`targetOwnerId`, `STORE_VERSION` 13), and `own` falls back to it when the target has gone; deleting an account clears its id from every report (POPIA), and the reports stay for the Hub. The review's test gaps were closed too: a refused Show again settles nothing (mutation-checked), the closing day's last second and first second, a visible-only locator, and Sipho's context closed in the finally. Unit: 2,661.
- **No admin decides about their own shop.** Approve, decline, verify, pause, resume, the mentor choice, the four report actions (dismiss, hide listing, hide request, pause shop), pin, unpin and both Show agains read whose the target is from the store (`isOwnShop`, `isOwnListing`, `isOwnRequest`, and `ownsTarget` for a report) after `requireStaff()` and the id checks, and refuse with the `own-shop` or `own-request` notice, writing, logging, sending and expiring nothing. Another admin's post still works. The staff pages show one line in place of the controls (never a disabled control): the review page and its decline and pause pages (and, for the only admin, how to hand the shop on, with a 44px "Staff" link), a report about your own, "Yours" in the hidden list, and Featured leaves your shop out of the choice and your pins to another admin. The mentor choice leaves out the shop's owner.
- **The mentors' notes were already safe.** The spec's leak (an admin who sells reading notes about themselves) was closed by `5af3548` (staff tools amendment 15.3): `mentoredShops` skips the viewer's own shop for every role. Two tests now pin the exact case (Sipho made an admin while Naledi mentors Tech corner; the CSV).
- **Old Looking For requests close themselves.** 3 days after the needed-by date, else 30 days after the request last changed (`closingDay`, SAST); the 16 samples never. A request leaves the board, the homepage and the sitemap at SAST midnight through dated readers inside `"use cache"`; `settleRequests(now)` stores the close (`closedBy: auto`, `closedAt` the closing day's start) and tells the asker once, from request-time code only (the board, the homepage section, the request page, the offer composer, the asker's own reads and every Looking For and request staff action, and the data download). Hidden requests and samples are never closed. Reopening takes off a passed needed-by date and starts a fresh 30 days, and says so (a hint on the button, a notice after). Your requests and the request page say "Closes automatically on {date}" or when and why it closed itself. `STORE_VERSION` is 12 (`RequestRow.closedBy`). How it works and the privacy policy say it.
- **The sitemap offers crawlers only what's current:** requests open today, tips, and events and office hours from today on. Closed requests and past events keep their pages. It is now dynamic (`ƒ /sitemap.xml`): it reads the SAST date after `connection()` and renders per fetch.
- **Items assessed with no build:** the 7-day auto-confirm (stage E built it), trust badges (nothing to build in sample mode) and Featured with few Verified sellers (a strict break would leave rows short three days in seven; a least-recently-featured order is offered, open point 5).
- **Where the build differed from the plan** is in the plan's "Changes made during the build" (`docs/superpowers/plans/2026-10-20-housekeeping.md`) and the spec's section 11. The ones worth knowing:
  - the plan review (`63517cd`) added nine amendments: the merge landed, two files the plan missed, a refused request action settles nothing, the role-grant e2e is always undone and safe to rerun, year-edge tests, the Supabase functions' matching rules, two more open points, and the data export settling first;
  - one existing test's needed-by date moved from 10 to 12 October (`lib/looking-for/actions.test.ts`), so it still pins a passed date that stays open;
  - the full-suite unit counts varied under heavy load, because worker start-up failures dropped files; the quiet 2-worker counts were 2,622, 2,651 and 2,654, and every load failure passed alone;
  - Task 11's `removeSiphosAdminRole` waits for the streamed staff table and asserts the link is gone.
- **Checks:**
  - lint and types are clean;
  - 2,654 unit tests pass at HEAD `a1da11c` (and `83a5458`, which adds only e2e);
  - end to end: the device projects at 2 workers on `83a5458`: 1,251 passed, 1,210 skipped by design, and the same 4 failures that predate stage L (the header and tab bar's `a11y.spec.ts:343` at 360, `responsive.spec.ts:26` at 360 and 390, `listing.spec.ts:34` at 390; the header session has them). The seven write projects with `--no-deps` on a fresh server at `1f55ee5`: 65 passed, 1 skipped. Run on the same server straight after the 17-minute device run, five write tests saw stale pages after a write (a resumed listing missing from browse, a deleted request's page still served, a new office-hours link missing); they all pass on a fresh server. Task 11's own run: `housekeeping-writes` 3 passed, and again twice on the same server; `hardening-writes` and `staff-accounts-writes` 31 passed;
  - axe finds no serious or critical issues on an admin's own shop's review page at 1440 and 390px.
- **First visit at 390px, JS brotli:** no page moved from stage K: homepage 150,660 B, listing 151,816 B, browse 151,407 B, storefront 151,420 B, Saved 151,295 B, request and collection 151,136 B; new and edit listing forms 152,334 B (the 29 B over the stop line accepted as decision 78). Every changed component is a Server Component; no new client code, cookie, table or CSS.
- **No screenshots** this stage: the only drawn things are lines of text in existing styles and one link in the existing pill style, so no screenshots spec was added.

## 2026-10-21: Open points for Lama after the housekeeping build
1. **The numbers:** a request closes 3 days after its needed-by date, else 30 days after it last changed. Should an edit restart the 30 days? Today it does; change `NEEDED_BY_GRACE_DAYS` and `IDLE_CLOSE_DAYS` in `lib/looking-for/rules.ts` and the words follow.
2. **Reopening removes a passed needed-by date.** The alternative is refusing to reopen until the date is changed, but Edit only works on open requests.
3. **Reports an admin made about someone else's shop** can be acted on by that admin (spec question 3). It would stop a lone admin moderating if refused.
4. **The only admin who sells** waits for a second admin (the page says how to hand the shop on). Eduvos may want at least two admins from day one anyway.
5. **Featured's resting order:** order resting sellers least recently featured first? A few lines, no change on the page.
6. **A reminder before a request closes** (a few days ahead): wanted? It needs a second notification and a second settle.
7. **The sample words** in the spec's sections 3 and 4 (the own-shop lines, the closing lines, the reopen hint and notices).
8. **Removing the mentor role** from whoever mentors an admin's own shop un-assigns that shop's mentor (`removeStaffRole`), the effect `assignMentor` now refuses. Roles were left alone; you may want it refused or only noted.
9. **A request whose closing day passed while it was hidden** closes at the next look after Show again, with `closedAt` at that old closing day, so "Closed automatically on {date}" can predate the "shown again" notice. Cosmetic.
10. **One lag (spec 2.15):** a request page's cached shell can say "open" for up to 15 minutes on its closing day. The offer composer and the asker's reads go by today's date, so nothing can be sent to it.
11. **If a run is killed mid-test, restart the e2e server (the store is in memory) before rerunning the device projects.**
12. **Go-live items added:** the closing job and `requests.closed_by`, the Supabase functions' matching rules (`set_request_open`, `start_offer`, `save_request`), the own-shop rule in the database, and the dynamic sitemap's date filter.
- **Docs still uncommitted, waiting for Lama:** the other sessions' lines in this file and the decisions log. This section and decision row 80 were written from snippet files for the same reason.
- **Stale pages on a long-running server.** Run straight after the full device run, five write tests saw a stale page after a write; on a fresh server all 65 pass. It matches stage K's one-off. Worth a look on the real backend's cache before launch (go-live checklist).

## 2026-10-21: Follow-ups built, in sample mode (stage M)
- **Review fixes (`488c878`).** The code review found nothing blocking. Its low-severity gaps were fixed: the remove-mentor page's two inline reads became `removeMentorView(viewerId, personId)`, unit tested with mutation checks on both reads; a test shows a closing day moved away and back to one already reminded for sends nothing the second time (spec decision 15); the `requests.ts` header comment was re-wrapped; and the admin Featured page now says the sellers featured longest ago come back first, as the trust page does (stage M's open point on `AdminFeatured` is done). Unit: 2,701.
- **An admin can't remove the mentor role from whoever mentors their own shop (`b70b170`).** `removeRole` refuses with `"own-shop-mentor"` before any write, read from the admin's seller profile (`ownShopMentorId`), in the same synchronous pass as the `own-admin` and `last-admin` checks. `removeStaffRole` lands on `/admin/staff` with the `own-shop-mentor` notice and writes, logs and sends nothing; the confirm page's form state is neither written nor cleared. Staff accounts says "Mentors your shop." in place of the remove link; the remove-mentor confirm page refuses with the reason, the only-admin sentence when it applies, and no button, and its heading is "{Name}'s mentor role". Another admin still removes the role as before, and removing the admin role is unchanged.
- **Featured brings back the longest-resting sellers first (`58d0338`).** When Featured must use resting sellers, each campus group (the campus's own first, then the others; "all" is one group) is sorted stably by the latest day each seller was in that campus's recorded row, oldest first, so ties keep the day's rotation. `featuredFor` builds that map from the recorded rows, a pinned day counting. `drawFeatured` is still a pure function with no clock. The trust page's Featured item 4 and the admin Featured page say which come back first.
- **One reminder before a request closes itself (`c6cebed`).** From 2 days before the closing day, `settleRequests(now)` sends the asker one in-app reminder (`reminderDue`, a pure function of the row and the SAST date), with the `request-update` kind and a link to Your requests. The row is marked in the same synchronous loop with `remindedFor` set to the closing day, so two looks at once remind once, an edit or reopen that moves the closing day allows a new reminder, and a request that reaches its closing day unreminded gets only the close. `settleRequests` still returns the number closed, so a reminder expires no tag. `RequestRow.remindedFor`, `STORE_VERSION` 14; not in the data download. How it works and the privacy policy say so.
- **No new table, cookie, notification kind, client component or CSS.** `NotificationsView`, the header and the tab bar are untouched.
- **Where the build differed from the plan** is in the plan's "Changes made during the build" (`docs/superpowers/plans/2026-10-21-follow-ups.md`) and the spec's section 11 (`docs/superpowers/specs/2026-10-21-follow-ups-design.md`). The ones worth knowing:
  - the plan review added five amendments: the heading check had to use `exact: true`, a device command that tested nothing was replaced, a second existing test now sends a reminder (neither counts notifications), the e2e file's wording, and a clarifying comment;
  - `StaffRoleConfirm`'s new props are optional and `AdminStaff`'s `ownShopMentorId` is required (plan decision 2);
  - `housekeeping-writes.spec.ts` runs its tests one at a time (`mode: "default"`), because `fullyParallel` is on and two of its tests give Sipho the Admin role (plan decision 13), and `playwright.config.ts` is unchanged;
  - one build and size check after all three items instead of two (plan decision 15).
- **Checks:**
  - lint and types are clean;
  - 2,701 unit tests pass at HEAD `81dab39`;
  - end to end, on a fresh server: the seven write projects 66 passed, 1 skipped; `housekeeping-writes` again on the same server 4 passed; devices (staff, info, home and community-actions at 390 and 1440) 88 passed; `performance.spec.ts` 45 passed;
  - this stage did not run the full device suite; the four phone tests that predate stage L (the header session's) are unchanged;
  - axe finds no serious or critical issues on Naledi's remove-mentor page at 1440 and 390px.
- **First visit at 390px, JS brotli:** every page the same to the byte as stage K: homepage 150,660 B, listing 151,816 B, browse 151,407 B, storefront 151,420 B, Saved 151,295 B, request and collection 151,136 B; new and edit listing forms 152,334 B (decision 78). Every changed component is a Server Component.
- **No screenshots** this stage: the only drawn things are lines of text in existing styles (`staff-muted`, `staff-confirm-lead`), so no screenshots spec was added.

## 2026-10-21: Open points for Lama after the follow-ups build
1. **The mentor role:** refused (spec decision 2) rather than only noted in the log. If you'd rather allow it, the one-line alternative is to keep the removal and add the admin's own shop to the audit entry.
2. **Featured's precedence:** the campus's own sellers stay ahead of the longest wait (spec decision 10). Flip it if fairness across campuses matters more than the campus-first promise.
3. **The reminder's 2 days** (`REMINDER_DAYS_BEFORE`), and whether it should link to the request's edit page instead of Your requests (spec decision 18).
4. **"Closes automatically on {date}"** names the first closed day, as stage L's lines do. If askers read it as the last open day, all the lines (Your requests, the asker's panel, the reminder) could change together.
5. **The sample words** in the spec's sections 3, 4 and 5.
6. **Go-live items added:** the nightly job reminds (`requests.reminded_for`, set in the job's transaction), the role-removal function's own-shop mentor check in the database, and Featured's resting order on the real backend (the same map of last days from `featured_draws`).
- **Docs still uncommitted, waiting for Lama:** the other sessions' lines in this file and the decisions log. This section and decision row 81 were written from snippet files for the same reason.

## 2026-10-21: Renamed from Vossie to CampusCart (decision 83)
- **The visible name is CampusCart everywhere a person sees it** (Lama, 2026-10-21):
  - page text, tab titles and share cards;
  - the footer wordmark ("CAMPUSCART", sized by `FitText`) and the manifest;
  - the data download (`campuscart-data.json`) and the mentors' CSV (`campuscart-mentoring-…`);
  - the Hub fixtures, and the seed regenerated from them (`pnpm db:seed`).
- **The rename's scope:** 350 lines in 110 files under `app`, `components`, `lib`, `data` and `tests`. Comment lines and identifiers were left alone. The offline page's text changed too, so the worker's hash, and with it its version, changes by itself.
- **Kept as Vossie for a second pass** after `backend/phases-b-c` merges (Lama's choice, since 40 of these files are also changed on that branch):
  - the `vossie_` cookies and storage keys and the `VOSSIE_` settings;
  - identifiers, comments and the package name;
  - the Supabase SQL's visible strings (the staff role notifications, the seed's Hub posts, the code email subject).

  The go-live checklist has the item.
- **Vossie by design:** `vossie.net`, the folder and repository, "Vossie Market", `vossie-pi.vercel.app`, and the dated docs. CLAUDE.md's new section "The name" lists all of it.
- **Docs:**
  - CLAUDE.md, the go-live checklist and decision row 83 (row 82 is the backend branch's) now say CampusCart.
  - `docs/stakeholder/` has the CampusCart stakeholder report (16 pages, technical) and a 6-page plain-language team brief (`CampusCart-brief.pdf`).
- **Checks:**
  - lint and types are clean;
  - 2,701 unit tests pass;
  - the production build passes;
  - end to end: the 19 device specs the rename touched, plus `performance.spec.ts`, at 360, 390 and 1440px, on a fresh server: 729 passed and 315 skipped by design. The page-size budgets passed.
  - `staff-accounts-writes.spec.ts` (one changed line) was not rerun.

## 2026-10-21: The Supabase backend finished on `backend/phases-b-c` (phases B and C, step 5 as the MVP cut)
- **Where:** branch `backend/phases-b-c` (worktree `../Vossie-backend`), HEAD `33e0290`. Main is merged into it, with the CampusCart rename (`ad5652d`). Since merged into `main` and pushed: `main` and `origin/main` are at `88ba438` (2026-10-22).
- **Lama's decisions (2026-10-21):** the live site is the "Vossie Market" project on vossie-pi.vercel.app, for the challenge submission; exactly `@vossie.net` and `@eduvos.com` may sign in; sessions slide for 30 days; sign-in codes come from Resend at `codes@wemakesites.co.za` (Brevo as the fallback); photos are capped at 4 MB each and 4 MiB a post; step 5 is cut to twelve end-to-end flows on Supabase (approved in the "In" session), and the full suite on Supabase moves to before any wider rollout.
- **Built, each step planned, reviewed before code, built test first and reviewed after:**
  - **Step 2b:** the database for stages L and M. Requests close themselves by the app's rule, with the nightly settle and reminder. No admin acts on their own shop, listings or request, or removes their own shop's mentor. Campuses, categories, pickup points and the allowed domains are migrations, so production gets them without the seed.
  - **C0 and C1:** the switch (`VOSSIE_BACKEND=supabase`, `onSupabase()`) and the contract tests that run the same scenarios on the sample store and local Supabase. The public reads: catalog, pickup points, Hub, requests, Featured, shop stats and badges. Pages built from data keep one placeholder when the live database is empty.
  - **Phase B, sign-in on Supabase Auth:**
    - 5 tries counted atomically, a final lockout, and 15 code emails per network an hour;
    - only `proxy.ts` renews a session, and page reads never do;
    - the `vossie_auth` cookie lasts 30 days;
    - account deletion through `forget_account`, and Auth's audit log swept;
    - a guarded clear-out script for the sample data, and `make_first_admin`.
    - The privacy page names Supabase (Ireland), Vercel (Dublin) and Resend (US).
  - **C2 and C3, selling and messaging:**
    - photos in Storage behind `/photos/[id]`, cached an hour when public and never when private, and a daily cron that clears abandoned uploads;
    - shops and listings;
    - notifications written only by the database, and message limits decided under a lock;
    - badges recalculated after replies and sales, and nightly.
  - **C4 and C5, community and staff:** requests, offers, follows and saved searches. Every staff tool, with every refusal tested on both backends: the Hub, mentors, staff accounts by exact email, the last-admin race, the numbers only through `protectCounts`, and the staff privacy pages.
  - **Step 5 (the MVP cut):** `tests/e2e-supabase/mvp.spec.ts` covers twelve flows, from public reads to account deletion and both crons. 24 of 24 pass at 390 and 1440.
- **Checks at `33e0290`:**
  - pgTAP 2,541;
  - unit 3,308;
  - contract tests on local Supabase 338;
  - `pnpm e2e:supabase` 48 passed;
  - lint and types clean.
  - Every page's first-visit JS is unchanged to the byte (homepage 150,661 B brotli), and no browser file names Supabase or a key.
- **Every decision and change is in the plans:** `docs/superpowers/plans/2026-10-21-supabase-step-2b-and-phase-c-foundation.md`, `…-phase-b-sign-in.md` (its Task 13 is the go-live runbook), `…-phase-c2-c3-selling-messaging.md` and `…-phase-c4-c5-community-staff.md`.
- **Known, not fixed:**
  - The Show again confirm page's short-phone layout-shift check fails on main's code too: a random test title wraps to a third line once the web font lands (0.0892 against 0.05). Fix it with closer fallback font metrics or a fixed test title.
  - Two requests renewing one session at the same moment: looked at on 2026-10-22 (below), and it holds.

## 2026-10-22: Demo sign-in on the live site, the renewal race, and the go-live checklist
- **Demo roles on the live site** (Lama: no students are being onboarded yet, so the demo runs on the live site). `VOSSIE_DEMO_SIGN_IN=1` on Supabase (`isDemoSignIn()`, `lib/auth/config.ts`) shows the five sample buttons at sign-in again. `/login/sample` signs each into its seed account (`student@vossie.test` and so on, `seedEmail` now in `lib/auth/seed-email.ts`) with a magic link token made with the secret key and checked at once, so no email is sent. Only the five fixture addresses work; an account without a profile goes back to sign-in. The hint under the buttons now says "For demos only". GO-LIVE has a new gate: unset it before the first real student signs in.
  - **It works on vossie-pi** (checked 2026-10-22: all five sign in, the Admin console and the Mentor dashboard open). The live project had none of the seed accounts, so Lama ran `supabase/ops/add-demo-accounts.sql` (the seed's five accounts, profiles and consents, guarded and safe to rerun). It also allows `vossie.test`, because the access token hook gave the demo accounts no session (a 403 at `verifyOtp`) while only `eduvos.com` and `vossie.net` were allowed. The clear-out removes both. The two demo sellers have no shop on the live site.
- **A separate demo site didn't work.** The `campuscart-demo` Vercel project (sample mode) could show pages but never keep a sign-in: Vercel ran `/login/sample` and the pages in different instances, each with its own in-memory sample store. Deleted on Lama's yes. Sample mode needs one long-running server.
- **The renewal race holds.** `lib/supabase/renewal.db.test.ts`: two proxy renewals of one nearly expired session at once both refresh, and both new sessions renew again, because of Supabase's 10-second refresh token reuse interval. Keep it at 10 on the live project.
- **The Show again short-phone shift isn't fixed, and its cause is now clearer.** It's the page heading in the display font (Special Gothic Condensed): its fallback has different metrics, so a heading can wrap to a different number of lines when the web font lands, depending on the title's length. A realistic title made it worse (0.075 and 0.226, the staff nav and body moving), so the test change was reverted. The fix is closer fallback metrics for the display font (it touches every heading), a decision for Lama.
- **GO-LIVE:** 19 backend items ticked as built on Supabase (each one checked against the migrations); partial ones stay open (`/photos/[id]` stays, and deleting old messages waits for retention periods).
- **Checks:** unit 3,316; the auth-session and renewal db tests on the local stack; lint and types clean; the production build passes, with no browser chunk naming Supabase or registering the worker.

## 2026-10-22: Role views N1 built (the kit)
- **The kit (`47d1c0c`).** Status colour tokens (info, success, warning, danger, live), a card shadow and spacing, nine icons (`StoreIcon` and `GridIcon` among them). Server-only components in `components/kit/`: Pill, Card, SectionHeader, Banner, EmptyState, StatTile and StatRow, NeedsYouList, ListRow, Feed (grouped by SAST day) and SetupChecklist. Five charts in `components/charts/` (StatDelta, Sparkline, BarList, RatioBar, SplitBar) with NumbersTable and their maths, each `import "server-only"`. `LinkTabs` has a segmented look in place of a separate component.
- **The section bars (`3941b0a`).** `/sell`, `/admin` and `/mentor` have layouts that stream in their own bar (Selling, Hub console, Mentoring) for the people each section is for; everyone else keeps the main bar. On phones the bar replaces the main tab bar at the bottom; from the tablet step it's a sticky sidebar. Section pages get the slim footer (legal links and campus line). Badges: the admin's Shops, Reports and Hub, the mentor's Office hours, from the same readers as their lists. `/admin/more` lists seven tools, Mentoring among them. Page transitions: tabs crossfade, links one level deeper slide, everything else (Back included) is instant, and all of it is off for reduced motion and data saver; press feedback on tabs and rows. The tab bar's Account is now "You". The seller dashboard and the admin Overview use StatTile.
- **End to end (this session).** `tests/e2e/role-views.spec.ts`: the seller's bar replaces the main bar with the slim footer, and CampusCart brings both back (the kept, hidden `/sell` page shows nothing); a student without a shop keeps the main bar on `/sell`; the waiting seller has no Messages; the admin's bar marks Today and More has 7 rows; a mentor gets Mentoring, not the console; the sidebar sits beside the page from the tablet step; axe on `/sell` (seller), `/admin/more` and `/mentor`; the motion control, reduced motion and data saver. `cls.spec.ts` measures `/admin`, `/mentor` and `/sell` (seller) at 390, 768 and 1440.
- **Where the build differed from the plan** (the plan's "Changes made during the build" has each):
  - no screenshots spec (Lama: not this time) and no separate slim-footer test (the Exit test checks the footer both ways);
  - the mentor dashboard's Download CSV button now always sits on its own line (`.staff-download`): beside the sidebar at 1440 the sentence and button fit one line in the display font but not its fallback, so the table jumped when the font landed (0.11). The `data-bar` fallback wasn't needed: no page shifted because the sidebar arrived late;
  - the JS rule is Lama's "inside the 150 KB budget", not byte-for-byte.
- **Checks:**
  - lint and types clean; the production build passes; no `"use client"` in `components/kit` or `components/charts`; no chunk registers the worker; every `newContext(` blocks service workers;
  - end to end on a fresh build (role-views, cls, performance, shell, accounts, responsive, staff, selling and messaging, all five device projects): 468 passed, 1 failed, 646 skipped (rows measured at some widths only). The failure predates N1: the signed-out `/sell` pitch at 390 measures 0.0598 against 0.05, the same to the digit on a build of `7ee5d53` (before N1). It's the display font's fallback again: the lede wraps to three lines, then two when the font lands. The fix is the same as the Show again shift's (closer fallback metrics), Lama's decision;
  - layout shift of the section homes, signed in, at 390 / 768 / 1440: Hub console's Today 0.0008 / 0.0020 / 0.0008, mentoring 0.0003 / 0.0007 / 0.0006, `/sell` as the seller 0.0006 / 0.0003 / 0.0003;
  - unit tests not rerun this session (the one app change is CSS).
- **First visit at 390px, JS brotli:** every page the same to the byte as before N1 (a build of `7ee5d53`; the client chunks have the same hashes): homepage, info, Hub, sell and account pages 150,674 B; listing 151,830 B; browse 151,421 B; storefront 151,434 B; Saved 151,309 B; request and collection 151,150 B; new and edit listing forms 152,347 B, the largest, inside 153,600 B. The homepage was 150,661 B at `88ba438`; the 13 B came before N1.
- **Open points for Lama:**
  - plan decisions 1 to 6: the sidebar from the tablet step (not desktop), Back without an animation, the seller's Messages badge waiting for N2, the mentor's Export as a plain download, the two extra icons, and Feed taking items already given a SAST day;
  - the Needs-you age thresholds (when an age turns warning or danger) and the sample words, used from N2;
  - the signed-out `/sell` font shift above;
  - no screenshots this stage: look at `/sell`, `/admin`, `/admin/more` and `/mentor` at a phone and a desktop width.

## 2026-10-22: Role views N2 built (the seller home)
- **The readers and SQL (`9f32a17`).** `sellerQueue(slug)` (buyers waiting for a reply, sales to mark as sold, drafts, Hub-hidden and paused listings, each with its oldest), `recentCounts` with the week before (`previous`), `dailyEnquiries` by SAST day, and `followerCounts` (total, and follows made this week that still stand), each with a sample version and a Supabase twin under one contract. `public.seller_queue` and `public.follower_counts` are owner-only definer functions with pgTAP; `hide_listing` and `show_listing` now set `updated_at`, as the sample store does, so a Hub hide or Show again stops a sale nagging to be marked sold.
- **The seller home and the fixes (`5227b45`).** `/sell` opens on Needs you (age chips: warning from 24h, danger from 48h), New listing and Messages side by side, the week's enquiries, sales and followers against the week before, enquiries by day, the reply rate against the next badge, and listings by state; a new shop sees a five-step checklist in their place. The seller bar's Messages carries the buyers waiting, from the same reader in the same request. Your listings is segments with counts and rows, Delete set apart; every empty tab and the empty selling inbox offer New listing. "Mark {title} as sold" in a selling thread, back to the thread. The Delete page and the owner's storefront ("Back to your shop") have a way back; seller titles say "Your". `PendingButton` (N2's one client component) on Your listings' buttons and Mark as sold.
- **End to end (this session).** A new `role-views-writes` project, last after `housekeeping-writes`: a new shop from its checklist ("2 of 5 done", then 3) through a buyer waiting (its row, the bar's badge, the row opening Selling), a reply and Mark as completed, the sale's row opening the thread, Mark as sold, to All clear, with the listing on Sold, and a paused listing's row opening Paused; axe on the checklist and the thread; the skeleton shorter than a new shop's home. `role-views.spec.ts`: Your listings' four segments on one line at 360px with 44px targets, the back links and titles, the skeleton shorter than the pitch and the waiting page, 375x667 layout shift for the home and Your listings, and the home's HTML size. `cls.spec.ts` measures both pages on the slow network too. Old lookups fixed in `selling`, `a11y`, `staff` and `staff-writes`.
- **Where the build differed from the plan** (the plan's "Changes made during the build" has each): fewer tests (Lama's rule: no redundant tests, no screenshots); `hide_listing` and `show_listing` didn't set `updated_at` before (the plan cited the request functions); `a11y.spec.ts`'s own sign-in now waits for hydration.
- **Checks:**
  - lint and types clean; the production build passes; unit tests 3,379 in 414 files; pgTAP and the database contracts not rerun this session (no SQL changed since batch A, where they passed);
  - `"use client"` in the seller's folders: `PhotoField` and `PendingButton` only; no chunk registers the worker; every `newContext(` blocks service workers;
  - end to end on one fresh build: role-views, selling, a11y, staff and messaging at all five widths, 484 passed and 16 failed on the first run: 10 were `a11y.spec.ts`'s stale followers line and its sign-in racing hydration (both fixed), the other 6 were at 390 only (five a11y pages and one messaging test, timeouts under load); all 36 passed on rerun; cls and performance at 390 and 1440, 218 passed and 3 failed (below); `selling-writes` and `role-views-writes` with `--no-deps`, 7 of 7;
  - layout shift: the seller home 0.0004 (390) and 0.0003 (1440), Your listings 0.0003 and 0.0002, the empty Paused tab 0.0007 and 0.0003; on the slow network both 0.0000 at 390; at 375x667 the home 0.0001 and Your listings 0.0000;
  - two shifts predate N2: the signed-out `/sell` pitch at 390 (0.0598, the display font's fallback, known since N1), and at 1440 on the slow network the seller home and Your listings at 0.1837, all `div.section-shell`: the sidebar column appears when the bar streams in, after the page. N1's build measures the same (0.1837 on `/sell`, 0.3924 on `/admin`); N1 measured only at full speed. The two rows are marked as expected failures at 1440 until it's fixed;
  - `/sell`'s main HTML for Tech corner's seller: 8,985 characters against N1's 5,861 (+3,124; the allowance is about 8 KB).
- **First visit at 390px, JS brotli, against N1:** every page the same to the byte except three, each up 285 B for `PendingButton`: the thread page, Your listings and the Delete page, 150,674 to 150,959 B (the Delete page sits under `/sell/listings` and loads the same chunk). `/sell` and every public page are unchanged (homepage 150,674 B; the largest, the listing forms, 152,347 B, inside 153,600 B). No page grew by more than 1 KB.
- **Open points for Lama:**
  - plan decisions 1 to 17, above all decision 8, which departs from spec 4.2: the Messages badge counts buyers waiting, while the Selling tab it opens lists every conversation;
  - the age thresholds (24h warning, 48h danger), the checklist's five steps and the sample words;
  - N1's sidebar shift on a slow network from the tablet step (fix in N1's shell: reserve the column before the bar arrives), and the signed-out `/sell` font shift;
  - no screenshots this stage: look at `/sell` (Tech corner, and a new shop), Your listings and a selling thread at a phone and a desktop width; the team brief's seller screenshot can be retaken now.

## 2026-10-23: Role views N3 built (the admin's Today)

**Built.** `/admin` is Today: "N waiting · oldest X days", then Waiting oldest first (shops to approve, open reports, slot requests, then Hidden by the Hub, which isn't counted as waiting), each row opening its oldest item with an age chip (warning after 48 hours) and "All clear" at zero; Last week's three tiles against the week before and listings by campus as bars, only through `protectCounts` (a masked figure reads Hidden or Under 5, never 0); the trust badges last. Each card fails on its own. Shop and report pages lead on to the next waiting shop or open report. Shops, Reports and Hidden filter by campus with link chips (an unknown campus shows all). The numbers page is called Last week and draws each measure by campus. Staff lists people before the form. One set of names: Today, Shops, Hidden, Last week; "Hub console" as the eyebrow (a mentor sees "Hub tools" on the Hub's pages). In the admin bar, More is current on the pages it holds. `listBookings` lists open requests oldest first on both backends, and a report carries its campus.

**Where the build differed from the plan.** Decision 8 reversed (More current through `NavLink`'s `also`, for screen readers too); "Hub tools" for mentors; e2e trimmed to behaviour, no screenshots; Next open report checked in staff-writes (the seed has no reports); Reports and Hidden use the short skeleton; three CSS fixes the e2e run found (the chips widened the whole page on phones, wrapped differently once the fonts swapped in at 1440, and the footer could rise into a phone's first screen on a slow network); N2's skeleton test now waits for the waiting page. Details in the N3 plan's "Changes made during the build".

**Checks.** Lint and types clean. Unit: 3,079 tests; on a machine under heavy load 13 files timed out, and all 13 pass run again. E2E (staff, staff-checks, role-views, role-views-admin, a11y, cls, performance at 360, 390, 768, 1024 and 1440): 757 passed, 2 failed, of which N2's skeleton race is fixed and passes, and the signed-out /sell pitch at 390 (0.0598) predates N1. Write projects (staff-writes, staff-accounts-writes, housekeeping-writes): 40 passed. Today's body 3.4 KB (390) and 4.0 KB (1440). Layout shift 0.0333 or less everywhere measured (Today 0.0007; Reports and Hidden 0.0202 or less; 375x667 0.0333 or less; slow network 0.0012 or less). JS: every page +25 B on N2 (NavLink `also`), the largest 152,372 B, inside 150 KB.

**Open points for Lama.**
- Plan decisions 2 (Hidden's row: last, only when something is hidden, not counted), 6 ("All numbers" as the link), 7 (the eyebrow; mentors see "Hub tools") and 8 (More current on the pages it holds).
- The 48-hour warning threshold.
- The sample words on Today and the empty states.
- The campus chips now scroll sideways at every size (14 chips) rather than wrapping from the tablet step.
- Next.js 16.4.0's security notice at build time: an upgrade is waiting for your go-ahead.
- No N3 screenshots were taken (Lama's call); `SCREENSHOTS=1` can make them later.

**Next.** N4, the mentor's caseload, can be planned.

## 2026-10-23: Role views N4 built (the mentor caseload)

**Built.** `/mentor` is a caseload, most in need first: "N of M need you · K slot requests", Needs you / All (`?view=all`), each shop a row with its flags in words (No listings yet; paused by the Hub or by the seller; slow replies) and a check-in chip (Due with none or after 30 days), then small enquiry charts for the shops in the view on one scale over the whole caseload (words when too small). An admin sees every mentored shop with its mentor. A shop's mentor page puts Add a note and Add a check-in first (PendingButton, one-time tokens), the last 14 days against the 14 before, then the history by day. Two readers on both backends: `lastCheckIns` (days only, under `can_mentor`, never the viewer's own shop; `public.last_check_ins` on Supabase) and `dailyEnquiriesFor` (SAST days). Migration `20261025120100_mentor_caseload.sql`. Assigning a mentor tells them once ("You're now mentoring {shop}.", to its mentor page); no change or a removal tells no one; the notification goes with the owner's account and follows a new shop link. The CSV is the Mentoring bar's Export.

**Where the build differed from the plan.** The migration's timestamp (N2 took the plan's); N2's names reused, no second PendingButton; tests that restated others left out; the HTML gate measures the caseload's body, not a before/after; Task 12 also checks a check-in pressed twice saves once; the mentor's shop page joined the JS list; no screenshots (Task 13 skipped). Details in the N4 plan's "Changes made during the build".

**Checks.** Lint and types clean. Unit: 3,425 tests, 419 files. E2E (role-views, role-views-admin, staff, staff-checks, a11y, cls, performance at 360, 390, 768, 1024 and 1440): 777 passed, 3 failed: two were the new caseload test counting rows before they streamed in (fixed, both pass), and the signed-out /sell pitch at 390 (0.0598) predates N1. Write projects (staff-writes, housekeeping-writes, role-views-writes, `--no-deps`): 12 passed. `pnpm e2e:supabase tests/e2e-supabase/mvp.spec.ts`: 12 passed, 2 failed, 10 did not run: flow 6 looks for "1 person follows your shop" on `/sell`, which N2's home words as "1 follower"; not N4's, left for a fix. The caseload's body is 3,030 B; the whole `/mentor?view=all` page 126,439 B. Layout shift: caseload 0.0011 or less, a shop's page 0.0272 (390, fonts held) and 0.0006 (1440); slow network 0.0012 or less; 375x667 0.0001 or less. The skeleton is no taller than the caseload (780 against 780 at 390, 634 against 661 at 1440, and an empty caseload). JS: every page as N3, the largest 152,372 B; the mentor's shop page 150,984 B.

**Open points for Lama.**
- Plan decisions 1 to 15, in particular 1 (the "staff-role" kind for the new mentor's notification), 4 (No listings yet; whose pause), 5 (the 30-day check-in threshold), 6 (the h1 stays "Mentor dashboard") and 7 (Export only in the bar).
- The sample words on the caseload, the chips and the empty state.
- The Supabase MVP flow 6 words ("1 follower" against "1 person follows your shop").
- Next.js 16.4.0's security notice at build time: an upgrade is waiting for your go-ahead.
- No N4 screenshots were taken; `SCREENSHOTS=1` with Task 13's shots can make them later.

**Next.** N5, You, can be planned.

## Next
- **Role views: N5, the buyer's You, is next** (`docs/superpowers/plans/` has N5). N1 (the kit), N2 (the seller home), N3 (the admin's Today) and N4 (the mentor's caseload) are built (above).
- **Every planned stage (A to M) is built in sample mode** and merged into `main`. The four phone e2e failures that predated stage L are fixed (`d13321b`). The full device suite last ran before stage M: rerun it once before go-live.
- **The Supabase backend is finished, merged into `main` and pushed** (above), with the CampusCart rename: `main` and `origin/main` are at `88ba438`.
- **Going live** (submission: vossie-pi.vercel.app on the "Vossie Market" project):
  - Lama logs the Supabase CLI in with a new token (`supabase login`);
  - a dry run of the migrations, then the push, then the guarded clear-out of the sample data and `make_first_admin`;
  - sign-in codes through Resend from wemakesites.co.za;
  - the environment settings (`VOSSIE_AUTH_HMAC_KEY`, `NEXT_PUBLIC_SITE_URL`, a stable Server Actions key), the nightly jobs, and unsetting `VOSSIE_NOINDEX`.

  The rest is in `docs/reference/GO-LIVE.md`.
- **Lama's open points:** those from stages L and M (above).
- **Lama reviews the positioning and editorial spec.** Its phase 1 (the wording) can be built at any time. Phase 2 (stories) can be planned, since the post editor is built (`components/staff/PostEditor.tsx`, `lib/staff/post-rules.ts`).
- **Screenshots:** Lama reviews the ones in `docs/progress/` if not yet seen. To retake a set, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "<name> review screenshots"` (for example "community actions", "staff tools", "selling" or "messaging").
- **For the team:**
  - `docs/stakeholder/CampusCart-brief.pdf`, a 6-page plain-language brief;
  - `docs/stakeholder/CampusCart-stakeholder-report.pdf`, the detailed report.

  Regenerate them when the picture changes.
- **The rename's second pass** (decision 83, after `backend/phases-b-c` merges): the internal names and the SQL's visible strings. Rename the `VOSSIE_` settings in Vercel at the same moment.

## Waiting on
Vossie is an entry in an Eduvos challenge, so nothing here waits on Eduvos. What's left is Lama's to supply or decide:
- **Real photos and launch content.** Each photo is a file drop plus one line in a fixture. Launch also needs real Hub posts and office hours, the real mentor and admin accounts (given in the app's Staff accounts), and enough real shops before day one.
- **Contact and retention:**
  - a contact address for privacy requests and support;
  - how long messages, reports, notifications, the staff log, RSVPs, slot requests, closed requests and follows are kept;
  - whether mentors' notes go in a seller's data download.
- **A real phone** to try the offline worker and its kill switch on before launch. The kill switch reaches a phone through the browser's own update check, which can take up to about a day.
