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

## Next
- Lama reviews the screenshots in `docs/progress/community-actions/` (22, at 390 and 1440px), and the staff ones in `docs/progress/staff/`, the selling ones in `docs/progress/selling/` and the messaging ones in `docs/progress/messaging/` if not yet seen. To retake the community actions ones, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "community actions review screenshots"`; the staff ones use `-g "staff tools review screenshots"`, the selling ones `-g "selling review screenshots"` and the messaging ones `-g "messaging review screenshots"`.
- Stage I is built, so every planned stage (A to I) is done in sample mode. What's left waits on Lama and Eduvos (below), on the Supabase phases (their own session) and on Lama's review of the positioning and editorial spec. Lama reviews stage I's screenshots in `docs/progress/search-alerts/` (12, at 390 and 1440px); to retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/alerts-screenshots.spec.ts`.

## Waiting on
- Eduvos font files and licence confirmation.
- The official crest SVG.
- Photos. The homepage is built, so each one is now a file drop plus one line in a fixture.
- The Hub's real posts and office hours, and the real mentor and admin accounts. The 18 posts are samples, and managing staff accounts in the app isn't built.
- Eduvos's legal review of the privacy policy, terms of use and seller guidelines; the Information Officer's name; a contact address for privacy requests and support; whether POPIA's right of access puts mentors' notes in a seller's data download (today the Information Officer is asked for them); how long the staff log, RSVPs and slot requests are kept; and how long closed requests and follows are kept.
- A real phone to try the offline worker and its kill switch on before launch (the kill switch reaches a phone through the browser's own update check, which can take up to about a day).
