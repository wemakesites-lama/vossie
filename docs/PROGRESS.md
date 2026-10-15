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

## 2026-10-14: Alongside stage E (a hidden deployment, and the plans for F to H)
- **`VOSSIE_NOINDEX=1` hides the whole site from search engines** (decision 68, `d484971`): every response says `X-Robots-Tag: noindex, nofollow`, and robots.txt disallows everything with no sitemap. Off unless set, and read at build time. Lama wants the Vercel deployment public but out of search results until launch; the go-live checklist has unsetting it.
- **Stage H's spec, community actions** (`2026-10-14-community-actions-design.md`, decision 67, `3551bfc`): posting Looking For requests, offers from approved shops (as messaging conversations), following shops, and the offline page.
- **Stage F's plan, selling** (`2026-10-14-selling.md`, 18 tasks, `6a2fc9b`), with the spec's changes on plan review.
- **Stage G's plan, staff tools** (`2026-10-14-staff-tools.md`, 22 tasks, `903abb6`), written before review.

## 2026-10-15: Messaging, reports and notifications built, in sample mode (stage E)
- **Messages** (`/listings/[id]/message`, `/sellers/[slug]/message`, `/messages`, `/messages/[id]`): a signed-in student messages a seller about a listing, with a swap offer when it takes swaps, or asks a shop a question from its storefront. Three safety tips sit beside the composer, and the server checks each message for paying in advance, bank details, a deposit, a courier or a code, with Send anyway. The inbox has Buying and Selling; a thread shows who wrote what and when, the status (Asked, Replied, Done, Confirmed), Mark as completed, Confirm the sale and It didn't happen, and confirms a sale itself a week after it's marked done. Refresh reloads; there are no live updates.
- **Reports** (`/report`, `/report/sent`): seven reasons and a detail for a listing, a seller or a request, one per target and 10 in 24 hours, then a thank-you. Privacy settings list the reports you've made.
- **Notifications** (`/notifications`): new messages and sales to confirm, marked read on opening. The header's account icon carries a red count of new ones; the account page lists Messages and Notifications with their counts; the homepage strip counts new messages and sales to confirm.
- **Every form works without the app's JavaScript**, and every post makes the browser drop its kept pages (`refresh()`), so Back never shows a page from before your own change.
- **Privacy:** the policy, the export and deletion take in messages, reports and notifications; deleting an account keeps the other person's side of each conversation; how long they're kept is Eduvos's call before launch.
- **Built in two sessions:** Tasks 1 to 7 on 2026-10-14, Tasks 8 to 17 on 2026-10-15 in a Claude Code cloud session (`a045119` to `fdd08fd`, then the docs).
- **Where the build differed from the plan** is in the plan's "Changes made during the build". The ones worth knowing:
  - The review of Tasks 1 to 5 (`3688ea9`, amendment 3): no completing a sale with a buyer who has left, a wider scam check, a sale to confirm as a notification of its own, "asked" until the first reply, invisible characters dropped, and the deleted side named "Deleted account".
  - The review of Tasks 8 to 14 (`38d23a7`): the report page's back link is as wide as its words; the privacy policy says a shop keeps a deleted buyer's conversation times without their name; the notifications test checks other accounts stay unread.
  - Every link the plan's code left prefetching ("See similar items", the inbox's empty Browse) has `prefetch={false}`.
  - The report form's radios carry no `aria-invalid` (a lint rule); the error is announced through the group's `aria-describedby`.
  - A thread, composer or report target that doesn't exist shows the 404 page with HTTP status 200, because `notFound()` runs after streaming has started. The pages are `noindex` and need sign-in.
  - Task 16 resized the inbox and notifications skeletons to their content.
- **Plan decisions Lama may want to revisit:** none came up in review. The ones with an effect Lama can see: the red badge on the account icon instead of a bell (plan decision 10), the count fresh only as of the last page load or post (11), and the sample wording in plan decision 26 (the tips, notification sentences, empty states, sale lines and report words).
- **Checks:**
  - lint and types are clean;
  - 1,175 unit tests pass, in 180 files;
  - end to end, 828 pass, 642 are skipped by design and 5 fail, all from the cloud container, not the code (see the open points): four layout-shift checks and one keyboard test that timed out under load and passes alone;
  - axe finds no serious or critical issues on the composer, inbox, thread, report and notifications pages, signed in.
- **First visit at 390px, JS brotli:** homepage 150,613 B, browse 151,360 B, listing 151,769 B, storefront 151,373 B, request 151,089 B, Saved 151,248 B, collection 151,089 B; info, sign-in, board, Hub and Hub post 150,613 B; signed in: account, inbox, thread, composer, report and notifications 150,613 B (stop line 152,305 B, never reached; limit 153,600 B). The listing page is the highest, 536 B under the stop line. Every page is 1 B lighter than at the start of the stage.
- **Layout shift** (fonts held back, at 390 and 1440px, the final run; measured in the cloud container, so see the open points):

  | Page | 390px | 1440px |
  |---|---|---|
  | Homepage (signed in: the badge and the strip) | 0.0016 | 0.0042 |
  | Composer | 0.0311 | 0.0049 |
  | Inbox | 0.0242 | 0.0029 |
  | Thread | 0.0006 | 0.0006 |
  | Report | 0.0497 | 0.0013 |
  | Notifications | 0.0474 | 0.0093 |

  Task 16's run read the composer 0.0513 at 390 (0.0311 in other runs) and notifications 0.047 to 0.070. At 390 the composer, report and notifications pages sit near the limit here because of the missing fallback fonts; the Mac's figures will be lower.
- Review screenshots: `docs/progress/messaging/` (24, at 390 and 1440px).

## 2026-10-15: Open points for Lama after the messaging build
- **Re-run the layout-shift test on the Mac: `pnpm e2e tests/e2e/cls.spec.ts`.** The cloud container that built Tasks 8 to 17 has no Arial (so `Geist Fallback`'s `local(Arial)` fails) and no Arial Narrow for the display font. Text drawn before the fonts arrive wraps differently and then reflows, so layout shift there is higher than on a Mac and isn't comparable with earlier figures. It fails `/privacy` at 390 (0.098), Hub office hours at 390 (0.157 to 0.168), privacy settings at 1440 (0.116 to 0.14) and, in two of three runs, the listing page with campus Pretoria at 390 (0.078). The same failures, with the same figures, happen at `903abb6`, before this stage's pages, and serving the CSS with `local("Liberation Sans")` in place of `local(Arial)` drops the first three to 0.0006, 0.0058 and 0.0175. The new pages at 390 (composer, report, notifications) sit near 0.05 there for the same reason.
- **A suggestion, not built:** a metric-adjusted fallback for the display font (`size-adjust` and the ascent and descent overrides on a local face), so text drawn before the font arrives takes the same room on any machine. Any phone without Arial Narrow sees the same reflow.
- **Screen readers may not announce "Sent."** on a thread. The note is a `role="status"` that is already in the page when it loads, and some screen readers announce a status only when it changes. Worth a check with VoiceOver; moving focus to it, or adding it after load, would need client code.
- **Opening `/notifications` marks every notification read,** including any beyond the 50 it shows. Harmless today; worth knowing when stage G adds its own kinds.
- **The signed-in Message and Report links stream in 71 to 171 ms** after the page on a production server. An earlier note of "a few seconds" was load on the test machine.
- **Messages live in the server's memory** in sample mode, like accounts. The go-live checklist has the real tables, a messages-per-account limit, a scheduled job for the 7-day auto-confirm and for deleting old messages, and Eduvos's retention periods.
- **Playwright in the cloud container** needs `PLAYWRIGHT_BROWSERS_PATH` pointing at an alias of the container's Chromium 1194 (the repo expects 1248). The repo's config is unchanged; on the Mac nothing is needed.

## 2026-10-15: Selling built, in sample mode (stage F)
- **Listings and sellers now come from the sample store**, seeded from the fixtures and tagged, so a change shows on the next request: new listings appear in browse, on their page, on the storefront and in collections straight away. A paused shop's listings leave every list, but its storefront and listing pages stay up, marked paused, and it takes no new messages (replies still go).
- **Becoming a seller** (`/sell`, `/sell/onboarding`): the pitch, then five steps (basics, about, photo, campus and pickup points, review) and Send for approval; the waiting page says the Hub is checking and lets the seller prepare drafts. The sample "Seller waiting for approval" shows it. Approving is stage G's.
- **The dashboard** (`/sell`): live or paused, the last 7 days' enquiries, replies within 48 hours and confirmed sales, the badge and what the next one needs, the shop's pages, and Pause my shop.
- **Listings** (`/sell/listings`, `/sell/listings/new`, `/sell/listings/[id]/edit`, `/sell/listings/[id]/delete`): four tabs (Available, Paused, Sold, Drafts), Pause, Resume, Mark sold, Relist and Delete with a confirmation; the listing form with every field of the listing model, Save and publish or Save as draft.
- **Photos**: shrunk and re-encoded in the browser (WebP, JPEG on Safari) when the app's JavaScript runs; checked by signature, 5 MB each, 6 per listing, and on the server every file keeps only what a decoder needs (location, thumbnails and every other hidden part go); served privately from `/photos/[id]` and resized by next/image, with no copies kept on the server's disk. The photo field's buttons work without JavaScript too.
- **Edit shop** (`/sell/profile`), with the link changeable once; a link buyers saw is never given to another shop. The listing page and storefront show their owner Edit listing and Edit shop; the account page's Your shop goes to `/sell`.
- **Privacy:** the policy, privacy settings, the export and deletion take in shops, listings and photos.
- **Built in one session** (2026-10-15, a Claude Code cloud session): Tasks 1 to 17, each reviewed, `5fd86a2` to `d856cb3`, then the docs.
- **Where the build differed from the plan** is in the plan's "Changes made during the build". The ones worth knowing:
  - **The photo stripper keeps a list** of what a decoder needs rather than dropping a list of known metadata (amendment 8). Its review dropped JFIF and JFXX thumbnails, refused files with no image, and moved it to one preallocated buffer: a crafted 5 MB file had cost about 300 MB.
  - **Posts at the same time can't corrupt a shop** (two tabs, a double click): each write checks and writes with no await between (`74d2c99`, `a936c89`).
  - **Photos are cached privately**, so a shared cache never keeps one that was deleted (`65cc89f`).
  - "R250,00" is no longer read as R25,000, and shop names in non-Latin scripts no longer collide (`82c392b`).
  - **A paused shop takes no new messages** (amendment 10), and its owner still sees Edit shop on its storefront (`ced2860`).
  - **The end-to-end tests that change listings** (`selling-writes`) run last as the teardown of a `setup` project, so they still run when a device test fails. A filtered run (`pnpm e2e <file>`) runs them too unless you add `--no-deps`.
  - **Matched fallbacks for the display font** (decision 71), so headings don't rewrap when it loads. CSS only.
- **Plan decisions Lama may want to revisit:** decision 70's figure (below); the sample wording in plan decision 27 (the pitch, the waiting page, the dashboard's lines, the hints, errors, notices and empty states, and Lerato's "Crochet corner"). See the open points.
- **Unused files, for Lama to delete or keep:** `components/ComingSoon.tsx` and `components/ComingSoon.test.tsx` (the selling pitch replaced its last use).
- **Checks:**
  - lint and types are clean;
  - 1,472 unit tests pass, in 213 files (1,175 in 180 at the start of the stage);
  - end to end (`pnpm e2e --workers=4`, 13.2 minutes), 900 pass, 707 are skipped by design and 3 fail, all layout shift from the cloud container's missing Arial, not the code: `/privacy` at 390 (0.0816), Hub office hours at 390 (0.1515) and privacy settings at 1440 (0.1179), the same three as stage E. All four `selling-writes` tests pass, last;
  - axe finds no serious or critical issues on the pitch, the wizard's steps, the waiting page, the dashboard, each My listings tab, Delete listing, the listing form (with photos, a photo picked and errors), Edit shop (with an error), and the owner's listing and storefront.
- **First visit at 390px, JS brotli:** homepage 150,613 B, browse 151,360 B, listing 151,769 B, storefront 151,373 B, `/sell` 150,613 B, Saved 151,248 B, collection and request 151,089 B; info, sign-in, board, Hub and Hub post 150,613 B; signed in: every page from D and E 150,613 B, new and edit listing forms 153,086 B (stop line 152,305 B, limit 153,600 B). Every public page is where stage E left it; the listing page is still the highest, 536 B under the line. The two form pages are 781 B over the line and 514 B under the limit: Lama accepted 152,950 B for them (decision 70), and Task 12's review fixes added 136 B.
- **Layout shift** (fonts held back, at 390 and 1440px, a fresh run of `cls.spec.ts` in the cloud container, so see the open points):

  | Page | 390px | 1440px |
  |---|---|---|
  | Sell pitch | 0.0184 | 0.0025 |
  | Waiting for approval | 0.0003 | 0.0002 |
  | Dashboard | 0.0005 | 0.0006 |
  | My listings | 0.0008 | 0.0003 |
  | Delete listing | 0.0019 | 0.0003 |
  | New listing form | 0.0003 | 0.0002 |
  | Edit listing form | 0.0003 | 0.0002 |
  | Edit shop | 0.0003 | 0.0002 |
  | Onboarding, step 1 | 0.0003 | 0.0002 |
  | Listing page (signed out; it changed in Task 14) | 0.0000 | 0.0002 |
  | Storefront (signed out; it changed in Task 14) | 0.0003 | 0.0002 |

  The same run failed the three pages stage E's did, for the same reason (no Arial in the container): `/privacy` at 390 (0.0816), Hub office hours at 390 (0.1515) and privacy settings at 1440 (0.1179).
- Review screenshots: `docs/progress/selling/` (26, at 390 and 1440px).

## 2026-10-15: Open points for Lama after the selling build
- **Decision 70: the listing form's two pages are 153,086 B.** You accepted 152,950 B; the review's fixes to the photo field (no unready photos posted, one photo shrunk at a time, descriptions kept after a failed save) added 136 B. Still 514 B under the limit, and only on those two signed-in pages. Veto it if you'd rather trim.
- **The data export and the wizard's draft.** The export gives each photo as `/photos/…`, not a full web address, and leaves out an unfinished become-a-seller draft. Both are on the go-live checklist; whether the draft belongs in the export (POPIA section 23) is your call.
- **"Buyers pay you when you meet"** on the pitch doesn't fit an Eduvos Online shop, which has no pickup.
- **Sample wording** (plan decision 27) is for you to change: the pitch's benefits and steps (`components/sell/SellPitch.tsx`), the waiting page (`ShopWaiting.tsx`), the dashboard's lines and the badge progress (`Dashboard.tsx`, `lib/selling/badges.ts`), the errors (`lib/selling/errors.ts`), the notices after each action (`lib/selling/notices.ts`), the hints and empty states, and Lerato's "Crochet corner" (`data/fixtures/shops.ts`).
- **`components/ComingSoon.tsx` and its test are unused** now. Delete them or keep them for a later placeholder.
- **Re-run the layout-shift test on the Mac: `pnpm e2e tests/e2e/cls.spec.ts`.** The cloud container still has no Arial, so `Geist Fallback`'s `local(Arial)` fails and the body text reflows when Geist arrives: `/privacy` at 390, Hub office hours at 390 and privacy settings at 1440 fail here, and all three read 0.0011 or less with Arial. Decision 71 fixed the display font's half of this. **An optional follow-up:** adding `local("Liberation Sans")` to Geist's fallback would make the test pass in the container too.
- **Go-live notes from the build** are on the checklist (`docs/reference/GO-LIVE.md`): a deleted listing's or shop's page can reappear after a restart, because Next keeps public page copies on disk and `updateTag`'s expiry in memory, per instance (POPIA); one stale response can follow a write (Next's two clocks); a CDN must purge `/photos/*` and `/_next/image` on delete; the 32 MB body limit applies to every Server Action; expired unsaved photos stay servable until the next upload; the real database needs a unique index on a shop's (campus, name) and transactions; a phone photo posted without JavaScript may show sideways; the wizard in two tabs can undo itself; stage G must rewrite notifications that name a changed shop link; and "apply, then the Hub approves" can only be tested end to end once stage G exists.
- **Playwright in the cloud container** needs `PLAYWRIGHT_BROWSERS_PATH` pointing at an alias of the installed Chromium, as in stage E. On the Mac nothing is needed.

## Next
- Lama reviews the screenshots in `docs/progress/selling/`. To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "selling review screenshots" --no-deps`.
- Lama re-runs `pnpm e2e tests/e2e/cls.spec.ts` on the Mac (see the open points above).
- Then the review of stage G's plan (`docs/superpowers/plans/2026-10-14-staff-tools.md`, committed before review): recheck it against stage F as built, as this stage's plan was rechecked against D and E.
- Then stage G: staff tools (`2026-10-14-staff-tools-design.md`): approving the waiting shops, Verified, hiding listings and the Featured rules.

## Waiting on
- Eduvos font files and licence confirmation.
- The official crest SVG.
- Photos. The homepage is built, so each one is now a file drop plus one line in a fixture.
- Eduvos's legal review of the privacy policy, terms of use and seller guidelines; the Information Officer's name; a contact address for privacy requests and support.
