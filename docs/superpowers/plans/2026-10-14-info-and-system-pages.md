# Vossie Info, Legal and System Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the six info and legal pages (How it works, Safety, How trust works, Privacy, Terms, Seller guidelines), a branded error page, and the production basics that aren't screens (`metadataBase`, `robots.txt`, a sitemap, security headers), as the spec `docs/superpowers/specs/2026-10-14-info-and-system-pages-design.md` describes, tested at five screen sizes and within the JS budget.

**Architecture:**
- **One frame, six pages.** `InfoPage` (`components/info/InfoPage.tsx`) draws the h1, lede, "Last updated" date, optional draft banner, an "On this page" list and the sections. Each page is a Server Component in `app/<route>/page.tsx` that holds its own `metadata` and its full text as a list of sections.
- **No new client code, except the error page.** Every info page is prerendered. `app/error.tsx` must be a client component, so it is built last and measured against the JS stop line, then kept or dropped.
- **Production basics are small pure functions.** `lib/site-url.ts` (the site's address from `NEXT_PUBLIC_SITE_URL`), `lib/sitemap.ts` (sitemap entries from plain lists of ids), then thin `app/robots.ts` and `app/sitemap.ts` around them, and `headers()` in `next.config.ts`.
- **Text is tied to code where it can drift.** The privacy page's test imports the real cookie and storage keys and checks the page names each one; a cross-page test checks the contents lists, section ids and internal links of all six pages.

**Tech Stack:** As the shopping stage left it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5 with Testing Library and jsdom 30;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-14-info-and-system-pages-design.md`. "Spec 2.5" in this plan means that spec's section 2, decision 5; "spec 4" means its section 4.
- **Earlier specs** (tokens, breakpoints, motion, accessibility, budgets): `docs/superpowers/specs/2026-10-08-homepage-design.md`.
- **Neighbouring specs that this plan's text must agree with:** `2026-10-14-community-pages-design.md` (part B: Looking For and the Hub), `2026-10-14-accounts-design.md` (stage D), `2026-10-14-messaging-design.md` (stage E), `2026-10-14-selling-design.md` (stage F) and `2026-10-14-staff-tools-design.md` (stage G).
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`. **Trust rules:** `docs/reference/FUNCTION-MAP.md` sections 5H, 5M and 6.
- **Previous plan, for conventions and pitfalls:** `docs/superpowers/plans/2026-10-13-shopping-pages.md`.

---

## Before you start

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. `.claude/launch.json` has a change made outside this work: never stage it.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed. This is Lama's standing preference.
3. **Files this plan removes or moves:** none, with one possible exception. If the JS stop rule fires in Task 8, the task removes its own two new, uncommitted files, `app/error.tsx` and `app/error.test.tsx`, by name. Nothing else is ever removed. Tracked files that are edited, not replaced: `.gitignore` (one line), `app/layout.tsx`, `next.config.ts`, `app/globals.css`, the footer and homepage components named in Tasks 3 and 5, the existing end-to-end specs, and the docs in Task 10.
4. **The page text.** Tasks 2 to 4 contain the complete wording of six pages. It ships as the first version; Lama edits it afterwards, and Eduvos's legal team owns the final wording of the three drafts. Plan decision 17 lists the legal claims they are asked to confirm.

No installs are needed. `NEXT_PUBLIC_SITE_URL` does not have to be set to build or test; Task 6 explains the fallback.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time. Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` anything except the one case in approval 3.
- Never kill an install or build that is still running.
- Port 3100 is Lama's dev server. Don't touch it. The e2e tests use 3200; the "looking at it" checks use 3201.
- Part B (community) may be built by other work at the same time. Before you edit a shared file (`app/globals.css`, `app/layout.tsx`, `tests/e2e/*.spec.ts`, `docs/*`), read its current text, and edit by the exact lines this plan quotes. Never paste back a whole list or file from an older copy.

## Where things stand (checked on 2026-10-14)

| Area | Fact |
|---|---|
| Repo | `main` at `cb763a0` (part A's docs: the storefront, Saved and collection pages are built and logged). `.claude/launch.json` is modified outside this work. Part B (Looking For and the Hub) has a spec and no code yet. Specs for stages D to G exist; none of their code does |
| Placeholders | `app/how-it-works/page.tsx`, `app/safety/page.tsx` and `app/privacy/page.tsx` render `ComingSoon` (eyebrow "Coming in the next stage") with the titles "How Vossie works", "Safety" and "Privacy (POPIA)". `/trust`, `/terms` and `/seller-guidelines` don't exist. `tests/e2e/routes.spec.ts` lists the three in `PLACEHOLDERS`, and `tests/e2e/a11y.spec.ts` uses `/privacy` for "a placeholder page". No other test visits them |
| The 404 frame | `app/not-found.tsx`: `<section aria-labelledby="page-title" className="mx-auto w-full max-w-page px-4 pb-8 pt-16 wide:px-8 wide:pt-24">`, an `eyebrow` paragraph, an h1 (`mt-3 font-display text-section uppercase text-navy`), a `mt-4 max-w-[60ch] text-muted` paragraph, and a `mt-8 flex flex-wrap gap-3` row with `btn btn-primary` and `btn btn-outline text-navy` links. Its tab title comes from `metadata` and the layout's template `%s · Vossie` |
| Layout | `app/layout.tsx` exports a `metadata` object with no `metadataBase`. `app/manifest.ts` with `app/manifest.test.ts` is the existing pattern for a metadata file and its test |
| Config | `next.config.ts` has `cacheComponents`, `partialPrefetching`, `images`, `redirects()` and two `experimental` flags. No `headers()` |
| Env | `.gitignore` ignores `.env*`, so a committed `.env.example` would be ignored too (`git check-ignore -v .env.example` names the `.env*` rule). There are no `.env` files |
| Footer | `components/footer/SiteFooter.tsx`: Sell has "Seller safety" (`/safety`); Help has How it works, Safety, Privacy (POPIA), Your account; the legal row is "Privacy (POPIA) · Safety". Each link group is drawn twice (the phone accordion and the wide column), so in jsdom every group link appears twice |
| Trust links | `components/home/ContextStripView.tsx` (a client component) links "How trust works" to `/safety`; `ContextStrip.test.tsx` checks it, and `tests/e2e/home.spec.ts` checks the link is visible. `components/home/FeaturedToday.tsx` links "How we pick" (read as "How we pick featured sellers") to `/how-it-works`; `FeaturedToday.test.tsx` checks it. `SafetyNote` links "Safety tips" to `/safety` and stays |
| Stored on a device | Cookies `vossie_campus` (`CAMPUS_COOKIE`, `lib/campus.ts`) and `vossie_saved` (`SAVED_COOKIE`, `lib/saved.ts`). Browser storage: `vossie_recently_viewed` (`RECENTLY_VIEWED_KEY`, `lib/recently-viewed.ts`), `vossie_recent_searches` (`RECENT_KEY`, `lib/recent-searches.ts`), `vossie_low_data` (`LOW_DATA_KEY`, `lib/low-data.ts`). The footer sign-up sends and stores nothing. `package.json` has no analytics |
| Data | `lib/data/index.ts` has `getListingIds`, `getSellerSlugs` and `getCollections`. `getRequestIds` and `getHubPostIds` do not exist yet: part B adds them (community spec 4.3 and 5.3). `/looking-for` and `/hub` are still `ComingSoon` |
| Dates | `lib/time.ts` `longSastDate("2026-10-14")` gives "14 October 2026" and reads no clock |
| Share cards | `app/listings/[id]/opengraph-image.tsx` and `app/sellers/[slug]/opengraph-image.tsx` make the cards. With no `metadataBase`, the server's `og:image` names `localhost` and the client adds a second one after hydration. `tests/e2e/listing.spec.ts` ("each listing has a share card for link previews") and `tests/e2e/shopping.spec.ts` (the seller's share card) read `og:image` with `.first()` and fetch its path from the test server, each with a comment about the missing `metadataBase` |
| Next 16.4.0 | `error.tsx` receives `error`, `reset` and `retry`; `retry` is stable since 16.3 and the docs say to use it in most cases. `robots.ts` and `sitemap.ts` are cached route handlers unless they use a request-time API. A relative URL in metadata needs a `metadataBase`. Next's resolvers don't use `metadataBase` for the icons or the manifest (Task 6 re-checks the built head) |
| End to end | `performance.spec.ts` has rows for the homepage, browse, a listing, a storefront and Saved, and fails above 153,600 B of brotli JS. `cls.spec.ts` rows run at 390 and 1440. `screenshots.spec.ts` is skipped unless `SCREENSHOTS=1` |
| Other stages' decisions this plan's text follows | The WhatsApp handoff is cut (messaging decision 7). A sale is confirmed by the buyer, or 7 days after the seller marks it done (messaging decision 5). Reports need an account (messaging decision 8). The seller onboarding links to `/seller-guidelines` (selling decision 6). Staff routes answer 404 to non-staff (staff tools decision 1). Sign-in is an Eduvos email code, and account deletion is immediate (accounts decisions 2, 4 and 13) |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. In this plan, "plan decision N" means this list; "spec 2.N" means the spec's decisions; "decision N" on its own means a row in the decisions log.

1. **"Try again" calls `retry`, not `reset`.** Spec 4 says `reset()`. Next 16.3 made `retry` stable and its docs say to use it in most cases: it fetches the page again, which can fix a failure on the server, while `reset` only re-renders the same broken output. The component still receives both.
2. **Page text lives in the page files.** Each `app/<route>/page.tsx` holds its `metadata` and its sections, and `page.test.tsx` beside it tests both. The frame takes the sections as data (`id`, `title`, `children`), so it can build the contents list from the same list.
3. **Section ids are unique across all six pages** (each is prefixed with its page: `privacy-today`, `trust-featured`). Next keeps the last three pages in the DOM, hidden, and both `aria-labelledby` and `#` links find the first match, which could be a hidden page's. A cross-page test checks the ids never repeat. (The open point in `docs/PROGRESS.md` about one page being kept twice does not arise here: these pages have no parameters, so each is in the DOM once.)
4. **The contents list is pills on phones and tablets and a column on the desktop step.** One markup, restyled: a row that scrolls sideways like browse's tabs (so nine sections don't push the text down), and from 64rem a column on the left. It isn't sticky, because the header's height changes as it hides.
5. **The privacy page is titled "Privacy policy"** (the placeholder said "Privacy (POPIA)"). Its lede names POPIA. The footer link keeps its "Privacy (POPIA)" label, which South African visitors know.
6. **The footer's "Seller safety" becomes "Seller guidelines"** (to `/seller-guidelines`). "How trust works" and "Terms of use" join Help, and "Terms of use" joins the legal row. Spec 2.11 sends "Seller safety" to the guidelines; the label now matches the page.
7. **"How we pick featured sellers" moves to `/trust#trust-featured`.** Spec 2.3 moves only the context strip's link, but the trust page is where Featured is explained, and How it works doesn't mention it.
8. **`robots.txt` blocks `/sell$` and `/sell/`, not `/sell`.** A `Disallow` matches a prefix, so `/sell` would also hide all 29 storefronts at `/sellers/…`. `$` ends a pattern, and Google, Bing and RFC 9309 all read it.
9. **Staff routes stay out of `robots.txt`.** Listing `/admin` would advertise it (staff tools decision 1). They answer 404 to non-staff and are `noindex`. Later stages add their own signed-in routes (messages, notifications, report) if they want them listed.
10. **The sitemap carries no `lastModified`.** It would need a clock while prerendering (CLAUDE.md), and crawlers cope without one. Sold and paused listings are in (spec 2.8: every listing). Entries come from `lib/sitemap.ts`, a plain function over lists of ids, so part B's ids are one optional argument (Task 6, Step 2).
11. **`siteUrl()` throws on an address that is set but wrong.** Unset or blank falls back to `http://localhost:3000`. A value that isn't an http or https address (a typo such as `vossie.co.za`) fails the build with a clear message, rather than shipping wrong share cards. It returns the origin only.
12. **HSTS is `max-age=31536000` and nothing more,** in production only. `includeSubDomains` and preload are commitments that depend on a domain nobody has chosen; both go on the go-live checklist.
13. **`.gitignore` gets `!.env.example`.** It ignores `.env*`, which would hide the example file spec 2.7 asks for.
14. **The error page is small on purpose and can't be tested end to end.** No `<title>`, no logging and no hooks: it adds to every page's JavaScript, and a `<title>` rendered by a client component can clash with Next's own. No route fails on purpose, and a test-only route would ship, so unit tests cover it, including one that pins its frame to the 404 page's.
15. **Info pages say what is real today.** Badges, Featured and sign-in are described as how they will work, with a sentence saying so, and How it works ends with "What can I do on Vossie today?". Those sentences come out as stages land; the go-live checklist says so (Task 10).
16. **Trust wording follows the messaging spec where it differs from spec 3.** Spec 3 says sales "the buyer didn't confirm" don't count and WhatsApp leads are left out. The messaging spec confirms a sale after 7 days of silence (decision 5) and cuts the WhatsApp handoff (decision 7). The trust page says: a sale counts when the buyer confirms it or a week after the seller marks it done; "it didn't happen" doesn't count; chats outside Vossie can't be seen, so they don't count.
17. **The legal drafts make claims for Eduvos's lawyers to confirm,** each worded plainly: Eduvos is the responsible party; under-18s need a parent's or guardian's consent; Vossie doesn't sell personal information; the lawful basis for each thing accounts collect; and the retention promises (such as deleting an account removing its data straight away). The report to Lama lists them.
18. **No share cards for the info pages.** The spec doesn't ask for them, although the community spec's section 9 expects part C to add "share images for the remaining pages". This is raised with Lama in the report, not built.
19. **End to end: content at 390 and 1440, layout at all five sizes.** The text doesn't change with width; where the contents list sits and whether the page scrolls sideways do.
20. **One date constant per page.** All six say "Last updated 14 October 2026". Whoever changes a page's text changes its date.
21. **The privacy page says the cookies last "up to a year" and that some browsers clear them sooner.** Decision 58: Safari caps a cookie written by the page at 7 days. The page stays true on iPhones without waiting for the fix.

## Amendments on review (2026-10-14, the controller)

These override the tasks below wherever they differ. The spec has been updated to match.

1. **Task 4: the three draft legal pages are `noindex`.** Privacy, Terms and Seller guidelines each export `robots: { index: false }` in their metadata until Eduvos signs them off (spec decision 8). Their unit tests check it. Leave them in the sitemap only if a test wants them there; otherwise leave them out, so search engines aren't asked to index a draft.
2. **Task 6: a default share card.** Add `app/opengraph-image.tsx` (spec decision 12): 1200 × 630, navy `#15305D`, the white crest (read `assets/brand/crest-white.png` as `app/listings/[id]/opengraph-image.tsx` does), "VOSSIE" at about 120px and "The student marketplace for every Eduvos campus" at about 44px in white, with `alt` "Vossie, the student marketplace for every Eduvos campus". The listing and seller cards override it on their routes.
   - A unit test isn't practical for `ImageResponse`. Instead, the Task 9 e2e test fetches `/opengraph-image` and expects a 200 `image/png`, and checks that `/how-it-works` has an absolute `og:image` that isn't a listing's.
3. **Task 8: measure the error page in a throwaway copy before it enters the repo.** Nothing is ever removed from the repo.
   - Make a copy of the committed tree in the scratchpad: `git -C /Users/LamaNkuna/Projects/Vossie archive HEAD | tar -x -C <dir>`, then `cp -Rc /Users/LamaNkuna/Projects/Vossie/node_modules <dir>/`.
   - Write `app/error.tsx` and its test there, and run the performance spec there (`pnpm exec playwright test tests/e2e/performance.spec.ts --project=phone-390`).
   - **If every page stays under the stop line,** create the two files in the real repo and continue with the task.
   - **If not,** don't create them in the repo at all. Report the figures, and record the drop in Task 10.

   This replaces approval 3's removal path and the `rm` step in Task 8.

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec 2.6):** if any page passes **152,305 B**, stop after that task and report. That is the line Lama last accepted when this plan was written (decision 52). The listing-page investigation in decision 53 brought that page back to 152,209 B, so it has about 96 B of room. Before Task 8, read `docs/PROGRESS.md` and the decisions log for a newer accepted figure, use it if there is one, and write the figure you used in the ledger below. Expect Task 8 to be tight: a client component referenced from the root layout can easily cost more than 96 B on that page, and then the rule says to drop it. Don't cut features to fit; that's Lama's decision.
- **Where bytes move:**
  - Tasks 1 to 7 add no client code. The info pages, `metadataBase`, robots, the sitemap and the headers are all server-side.
  - Task 3 changes one link's address in `ContextStripView`, a client component: a byte or two.
  - Task 8 adds `app/error.tsx`, a client component referenced from the root layout, so it can add bytes to every page. It is the only task that can, and it is measured before and after.
- **Recording.** `tests/e2e/performance.spec.ts` prints each page's `scriptBrotli`. Tasks 1, 2, 3, 8 and 10 run it at 390px and record the figures in their commit messages. Task 2 adds `/how-it-works` to it.

**As built** (first visit at 390px, brotli quality 5):

| Point | `/` | `/browse` | Listing | `/how-it-works` |
|---|---|---|---|---|
| Start (Task 1; the shopping stage's final figures) | 151,058 B | 151,740 B | 152,214 B | |
| Task 2, How it works and Safety (`8aa1d49`) | 151,058 B | 151,740 B | 152,214 B | 151,058 B |
| Task 3, trust links (`10158ae`) | 151,054 B | 151,736 B | 152,210 B | |
| Task 8, before the error page (after `31f59ad`) | 151,082 B | 151,764 B | 152,238 B | |
| Task 8, with the error page (throwaway copy, +472 B on every page) | 151,554 B | 152,236 B | 152,710 B | |
| **Final (Task 10, after `a41662c`)** | **151,082 B** | **151,829 B** | **152,238 B** | **151,082 B** |

- **The stop line used:** 152,305 B (decision 52). Nothing newer had been accepted.
- **Unit tests at the start:** 528. **End to end at the start:** 444 pass, 296 skipped. (The figures the shopping stage ended on; Task 1 didn't log its own.) **At the end:** 626 unit tests in 111 files; 520 pass and 375 are skipped by design, none fail.
- **Two figures in the Task 8 "with" row are derived.** The listing page (152,710 B) and the storefront (152,314 B) were measured. `/` and browse are each 472 B above their "before" figure. The listing page and the storefront were both past the stop line, so the error page was dropped (Task 8, below).
- **Tasks 1 to 7 added no client code,** as planned. The small moves are Task 3's link change (-4 B on every page, in `ContextStripView`) and, later, `31f59ad` (+28 B on every page, Saved forgetting dead ids) and `a41662c` (+65 B on browse, `ScrollToResult`).
- **Final, the other pages:** storefront 151,842 B, Saved 151,717 B, collection 151,558 B. The listing page ends 67 B under the stop line and 1,362 B under the limit (153,600 B).

## Changes made during the build (2026-10-14)

The tasks above were built as written, except for these. The commits run from `42e0fee` (this plan's own review) to `a41662c`.

- **Plan review (`42e0fee`):** the controller's amendments above, plus corrections to the specs.
  - The three draft legal pages are `noindex`.
  - A default share card was added to Task 6.
  - The error page is measured in a throwaway copy before it enters the repo (Task 8).
  - The spec was corrected: the error page calls `retry()`; robots blocks `/sell$` and `/sell/`; the trust rules follow the messaging spec (and Trusted needs 3 enquiries); staff tools keep Featured's week-long break.
- **Tasks 1 and 2 (`f957a10`, `8aa1d49`):** built as written. The "looking at it" check used port 3202, because the final reviewer's server held 3201.
- **Task 3 (`10158ae`):** interrupted at the usage limit after Steps 1 and 2, and finished by a new agent from the files already written.
- **Task 4 (`b3e2cec`):** the privacy draft says plainly that saved ids travel to Vossie in `vossie_saved` with each visit (a finding of the shopping stage's final review). Privacy, Terms and Seller guidelines are `noindex`, with tests.
- **Task 5 (`27a85fc`):**
  - the footer's Saved link doesn't prefetch, because it cost about 0.6 KB per page on tablet and desktop (the shopping stage's final review);
  - the footer test mocks `next/link`.
- **Task 6 (`6f86b11`):**
  - the sitemap uses the variant without part B's ids: 7 static paths, with the three drafts left out;
  - the default share card is `app/opengraph-image.tsx`;
  - the seller share-card test's `og:image` change landed in `31f59ad`, which shares that file.
- **Task 7 (`27b1efd`):** built as written.
- **`31f59ad` (the shopping stage's final review):** Saved forgets saved ids whose listings are gone (`forgetSaved`), so the header stops counting them. +28 B on every page.
- **Task 8: the error page was dropped.** Measured in a copy of the committed tree, `app/error.tsx` added 472 B to every page: the listing page reached 152,710 B and the storefront 152,314 B, past the stop line (152,305 B). Nothing was created in the repo, so Next's default error page stays (spec decision 6, decision 62). Its unit test was never written, since the page was never created.
- **Task 9 (`fec8074`):**
  - the sitemap end-to-end test expects the three drafts absent;
  - the 404 axe row is kept on its own account;
  - checks for the default share card were added;
  - layout shift: How it works 0.0031 at 390 and 0.0312 at 1440 (the 1440 figure is unexplained and under the limit), Privacy 0.0011 and 0.0031.
- **Review of Tasks 1 to 7 (`60b466e`):**
  - the homepage's How it works step no longer says WhatsApp (decision 57);
  - the privacy draft says "Allowed under POPIA section 11" instead of GDPR's "lawful basis", says section 72 "generally allows", and no longer invents a contact route;
  - a guard test finds every `"vossie_…"` name in the code and fails until the privacy page names it;
  - `siteUrl()` warns once when a production build has no `NEXT_PUBLIC_SITE_URL`.
- **Kept as it was in that review:** `/looking-for` and `/hub` stay in the sitemap until part B builds them; two footer links wrap at 1024px; the desktop contents column's 44px links touch, which passes WCAG 2.2's target size rule.
- **A browse fix found in this build (`a41662c`):** the flaky end-to-end test "Show more lands on the 25th card" was a real bug. Chrome's fragment step clears focus after `DOMContentLoaded`, so `ScrollToResult` now runs again one task after it and takes focus only if nothing has it. +65 B on browse.
- **Task 10 (the commit that holds this section):**
  - the screenshots test is as written, except that its comment about the error page now says the 404 page stands in for it. It passed on the first run and wrote 16 PNGs, which show what their names say: the draft banner on Privacy, Terms and Seller guidelines, the contents list as a row of pills at 390 and a left column at 1440, and the 404 page;
  - the spec: its edits 2, 4 and 5 were already in it from the plan's review, so only the "Built" line, decision 11, and the error-page outcome were added as written. Also updated: the goal and decision 6 (the error page), decision 2 (saved ids travel with each visit), decision 8 (the sitemap as built), the `/privacy` row (section 11 grounds), the testing and "not in this part" sections;
  - the decisions log has two rows, 61 and 62, instead of the plan's five. Row 61 sums up the pages, robots, sitemap, headers and share card, with the plan decisions that go beyond the spec (the spec already carries decisions 1 and 16); row 62 is the dropped error page;
  - the go-live checklist follows Step 5, with the totals brought up to 14 built and 31 not, and the lawyers' claims added under "POPIA and legal";
  - `CLAUDE.md` keeps its privacy line (campus choice and saved listings are first-party cookies, nothing stored on a server) is still true. Step 6's two additions (the `siteUrl()` line and the privacy page's guard test) were made by the controller, with a third line on prefetch costs (decision 53);
  - `docs/PROGRESS.md` has the part C section, its open points, and `ScrollToResult`'s earlier note brought up to date. It records the final run's layout shift: How it works 0.0031 at 390 and 0.0350 at 1440 (Task 9 measured 0.0312), Privacy 0.0011 and 0.0022. The 1440 figure for How it works moves from run to run and is still unexplained; it is an open point.

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there.
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, and comments in plain English. There's no formatter: match the file you're in.
- **Server or client.** Server Components unless a file starts with `"use client"`. Plain `lib/` modules have no directive. This plan adds one client component, `app/error.tsx` (Task 8).
- **Next APIs.** Before using a Next API this plan names, read its page in `node_modules/next/dist/docs/01-app/03-api-reference/` (AGENTS.md). This plan uses: static `metadata` and `metadataBase` (`04-functions/generate-metadata.md`), `error.tsx` (`03-file-conventions/error.md`), `robots.ts` (`03-file-conventions/01-metadata/robots.md`), `sitemap.ts` (`03-file-conventions/01-metadata/sitemap.md`) and `headers` (`05-config/01-next-config-js/headers.md`). The first task that uses one says so in its first step.
- **Breakpoints.**
  - `wide:` is tablet and up; `desk:` is desktop. Never use `md:`, `lg:` or `sm:`.
  - In CSS, write `@media (min-width: 48rem) and (min-height: 30rem)` and `@media (min-width: 64rem) and (min-height: 30rem)`. Landscape phones are `@media (orientation: landscape) and (max-height: 29.99rem)`.
- **Page padding.** `.page` and the page's own class (`.info-page`) sit on one element, so the page class's padding *replaces* `.page`'s gutter. Write the whole content edge: 16px on phones, 40px from the tablet step.
- **Effects.** Never call `setState` directly in an effect body, and only touch `ref.current` in effects and handlers. This plan has no effects.
- **Headings.** One H1 per page. Sections are `<section aria-labelledby="…">` with one H2. Sub-points inside a section use H3.
- **Request-time parts.** Nothing in this plan reads cookies, headers or `searchParams`. Every info page is prerendered. No `Date.now()`, `new Date()` or `Math.random()` while prerendering: `longSastDate` takes its date from the data, so it is fine.
- **Async components in tests.** jsdom can't render an async component inside a tree. Every component in this plan is synchronous, so `render(<Page />)` works.
- **JSX text.** The `react/no-unescaped-entities` lint rule is on: write `&apos;` for an apostrophe and `&quot;` for a double quote inside JSX text (a string in an attribute or a prop is fine). JSX drops the space at a line break next to a tag, so end a text line with `{" "}` when the next line starts with a tag.
- **Links.** Pages on this site use `Link` from `next/link`. A plain `<a href>` is for a `#` jump inside the page and for other websites only.
- **Accessible names.** Name computation trims each element's own text, so put spaces outside `sr-only` spans. Chromium adds spaces between flex children. Icons from `components/icons.tsx` are `aria-hidden`. This plan adds no icons.
- **Contrast.**
  - Sky never carries text, icons or thin borders on white. Links on white are sky-dark and underlined; on panel, pale and sky they're navy.
  - Small text on the star texture is white. Sky there is for large text, icons, and solid pills with navy text.
- **Motion.** Animate only `transform`/`opacity`, including the CSS `translate`, `scale` and `rotate` properties. Hover effects only under `(hover: hover) and (pointer: fine)`. This plan adds no animation.
- **Tap targets.** At least 44 × 44px, with 8px between targets.
- **CSS placement.**
  - New CSS goes at the end of `app/globals.css`, inside `@layer components`, under a banner: `/* --- Info pages: <name> (info and system plan, Task N, spec x) --- */`.
  - Never put `!important` on a transition or animation property: the motion off-switches rely on it.
- **Hidden pages in tests.** Next keeps the last 3 pages hidden in the DOM for Back (React's `<Activity>`), with an inline `display: none` on their top element. CSS locators in e2e tests still count them; `getByRole` doesn't. Scope CSS locators to `main .info-body`, and keep section ids unique (plan decision 3).
- **Edits to shared files.** Use the Edit tool with the exact lines this plan quotes. If the quoted lines aren't there any more (another part changed them), stop and report rather than guess.
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git status --short` on its own, and checks that only the listed files changed (and `.claude/launch.json`, which is never staged, and any other part's files, which are never part of this commit);
  2. runs `git add` with the listed files;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.
- **Looking at it.** Check visually on a production build (`pnpm build`, then `pnpm start --port 3201`) at 390 × 844, 768 × 1024 and 1280 × 800, using a throwaway Playwright script in your scratchpad. Stop the server afterwards (it's yours, not an install or build).
- **Measuring JS.** `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` builds, starts its own server on 3200, and prints one line per page, such as `homepage: {"script":…,"scriptBrotli":…}`. Record `scriptBrotli`.

## File map (end of this plan)

New files are marked **+**, changed **~**.

```
app/
  how-it-works/page.tsx  page.test.tsx       ~ / + the page and its test (Task 2)
  safety/page.tsx  page.test.tsx             ~ / + (Task 2)
  trust/page.tsx  page.test.tsx              + (Task 3)
  privacy/page.tsx  page.test.tsx            ~ / + (Task 4)
  terms/page.tsx  page.test.tsx              + (Task 4)
  seller-guidelines/page.tsx  page.test.tsx  + (Task 4)
  info-pages.test.tsx                        + the cross-page checks (Task 4)
  robots.ts  robots.test.ts                  + (Task 6)
  sitemap.ts  sitemap.test.ts                + (Task 6)
  error.tsx  error.test.tsx                  + (Task 8, kept only if it passes the JS stop rule)
  layout.tsx                                 ~ metadataBase (Task 6)
  globals.css                                ~ the info frame (Task 1)
components/
  info/InfoPage.tsx  InfoPage.test.tsx       + (Task 1)
  home/ContextStripView.tsx  ContextStrip.test.tsx   ~ the trust link (Task 3)
  home/FeaturedToday.tsx  FeaturedToday.test.tsx     ~ the "How we pick" link (Task 3)
  footer/SiteFooter.tsx  SiteFooter.test.tsx         ~ (Task 5)
lib/
  site-url.ts  site-url.test.ts              + (Task 6)
  sitemap.ts  sitemap.test.ts                + (Task 6)
next.config.ts  next.config.test.ts          ~ / + headers (Task 7)
.gitignore  .env.example                     ~ / + (Task 6)
tests/e2e/
  info.spec.ts  system.spec.ts               + (Task 9)
  routes.spec.ts                             ~ placeholders leave (Tasks 2, 4)
  listing.spec.ts  shopping.spec.ts          ~ the og:image check (Task 6)
  performance.spec.ts                        ~ a row (Task 2)
  a11y.spec.ts  cls.spec.ts                  ~ (Tasks 4, 9)
  screenshots.spec.ts                        ~ (Task 10)
docs/PROGRESS.md  docs/progress/info-system/  docs/reference/GO-LIVE.md  docs/reference/LANDING-DECISIONS.md
CLAUDE.md  the spec  this plan               ~ / + (Task 10)
```

Each `*.test.ts(x)` sits next to the file it tests.

## Where each spec decision is built

| Spec | Built in |
|---|---|
| 2.1 Legal pages are drafts | Task 1 (the banner), Task 4 (the three pages) |
| 2.2 Privacy describes this stage truthfully | Task 4 |
| 2.3 One trust page, homepage link moves | Task 3 |
| 2.4 Badge rules | Task 3 (text), Task 4 (the guidelines point to it) |
| 2.5 One frame | Task 1 |
| 2.6 Error page built, then measured | Task 8 |
| 2.7 `metadataBase` from `NEXT_PUBLIC_SITE_URL`, `.env.example` | Task 6 |
| 2.8 Robots and sitemap | Task 6 |
| 2.9 Security headers | Task 7 |
| 2.10 No offline page | Task 10 (the checklist keeps it) |
| 2.11 Footer links | Task 5 |
| 3 Pages | Tasks 2, 3, 4 |
| 4 The error page | Task 8 |
| 5 Production basics | Tasks 6 and 7 |
| 6 Accessibility | Task 1 (markup and CSS), Task 9 (axe) |
| 7 Testing | Unit tests in every task; end to end, axe, layout shift and size in Task 9 |
| 8 Not in this part | Task 10 (the checklist) |

---

### Task 1: The InfoPage frame

The shared frame (spec 2.5 and 6): an h1, a lede, "Last updated {date}", an optional draft banner, an "On this page" list, and sections with h2s. Nothing uses it until Task 2.

**Files:**
- Create: `components/info/InfoPage.tsx`, `components/info/InfoPage.test.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Record where things start**

Run, one after another: `git status --short`, `pnpm test`, `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`.
Expected: `git status` shows only files from other parts' work and `.claude/launch.json`. Note the unit test count. Note the `scriptBrotli` figures for `homepage`, `browse page` and `listing page`, and write them, the counts and the stop line you will use (read `docs/PROGRESS.md` and the decisions log for a newer accepted figure than 152,305 B) into the ledger above (the "Start" row). If a page is already past the stop line, stop here and report: the error page can't be added on top (Task 8).

- [ ] **Step 2: Write the frame's test**

Create `components/info/InfoPage.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { InfoPage, type InfoSection } from "./InfoPage";

const sections: InfoSection[] = [
  { id: "demo-first", title: "First part", children: <p>First body.</p> },
  { id: "demo-second", title: "Second part", children: <p>Second body.</p> },
];

function renderPage(props: Partial<ComponentProps<typeof InfoPage>> = {}) {
  return render(
    <InfoPage title="Demo page" lede="One line about it." updated="2026-10-14" sections={sections} {...props} />,
  );
}

describe("InfoPage (info and system spec 2.5)", () => {
  it("has one h1, the lede and the date the page last changed", () => {
    const { container } = renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Demo page" })).toBeInTheDocument();
    expect(screen.getByText("One line about it.")).toBeInTheDocument();
    expect(container.querySelector(".info-updated")).toHaveTextContent("Last updated 14 October 2026");
    expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-10-14");
  });

  it("lists every section under 'On this page', each link pointing at its section", () => {
    const { container } = renderPage();
    const nav = screen.getByRole("navigation", { name: "On this page" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["First part", "Second part"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#demo-first", "#demo-second"]);
    expect(container.querySelector("section#demo-first")).not.toBeNull();
    expect(container.querySelector("section#demo-second")).not.toBeNull();
  });

  it("gives each section an h2 that names it, followed by its text", () => {
    renderPage();
    const first = screen.getByRole("region", { name: "First part" });
    expect(within(first).getByRole("heading", { level: 2, name: "First part" })).toBeInTheDocument();
    expect(within(first).getByText("First body.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Second part" })).getByText("Second body.")).toBeInTheDocument();
  });

  it("says in words that a page is a draft, and says nothing otherwise", () => {
    const { unmount } = renderPage({ draft: true });
    expect(screen.getByRole("note")).toHaveTextContent("Draft for Eduvos to review. Not yet in force.");
    unmount();
    renderPage();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("puts the contents list before the text, so on phones it sits under the lede", () => {
    const { container } = renderPage();
    const nav = container.querySelector(".info-toc")!;
    const body = container.querySelector(".info-body")!;
    expect(nav.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `pnpm test components/info/InfoPage.test.tsx`
Expected: FAIL, because `./InfoPage` doesn't exist.

- [ ] **Step 4: Write the frame**

Create `components/info/InfoPage.tsx`:

```tsx
import type { ReactNode } from "react";
import { longSastDate } from "@/lib/time";

export type InfoSection = {
  /**
   * The section's address and its link in "On this page". It must be unique across every info page: Next keeps the last
   * few pages hidden in the DOM, and a `#` link or an aria-labelledby finds the first match (plan decision 3).
   */
  id: string;
  title: string;
  children: ReactNode;
};

type InfoPageProps = {
  title: string;
  /** One line under the title. */
  lede: string;
  /** When the text last changed, as YYYY-MM-DD. */
  updated: string;
  /** Legal drafts say so in a banner, in words (spec 2.1 and section 6). */
  draft?: boolean;
  sections: readonly InfoSection[];
};

/**
 * The frame every info and legal page shares (spec 2.5): the title, a one-line lede, when it last changed, the draft
 * banner when there is one, then "On this page" and the sections. The list is a row of pills under the lede on phones
 * and tablets, and a column on the left from the desktop step. The text keeps to about 65 characters a line.
 */
export function InfoPage({ title, lede, updated, draft = false, sections }: InfoPageProps) {
  return (
    <div className="page info-page">
      <h1 className="info-title">{title}</h1>
      <p className="info-lede">{lede}</p>
      <p className="info-updated">
        Last updated <time dateTime={updated}>{longSastDate(updated)}</time>
      </p>
      {draft && (
        <p role="note" className="info-draft">
          <strong>Draft for Eduvos to review.</strong> Not yet in force.
        </p>
      )}
      <div className="info-layout">
        <nav aria-label="On this page" className="info-toc">
          <p className="info-toc-label" aria-hidden="true">
            On this page
          </p>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="info-body">
          {sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="info-section">
              <h2 id={`${section.id}-title`} className="info-section-title">
                {section.title}
              </h2>
              {section.children}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Run: `pnpm test components/info/InfoPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the frame's CSS**

Append to the end of `app/globals.css`:

```css

/* --- Info pages: the frame (info and system plan, Task 1, spec 2.5 and section 6) --- */
@layer components {
  /* .page and .info-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .info-page {
    padding: 24px 16px 64px;
  }

  .info-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .info-lede {
    max-width: 50ch;
    margin-top: 12px;
    color: var(--color-ink);
    font-size: 18px;
    line-height: 1.5;
  }

  .info-updated {
    margin-top: 8px;
    color: var(--color-muted);
    font-size: 13px;
  }

  /* The banner says it in words; the border and the pale fill only back the words up (spec section 6). Navy on pale
     is about 10:1. */
  .info-draft {
    max-width: 65ch;
    margin-top: 20px;
    padding: 14px 16px;
    border: 1.5px solid var(--color-navy);
    border-radius: var(--radius-card);
    background: var(--color-pale);
    color: var(--color-navy);
  }

  .info-layout {
    margin-top: 28px;
  }

  .info-toc-label {
    color: var(--color-muted);
    font-size: 13px;
    font-weight: 600;
  }

  /* Phones and tablets: one row of pills that scrolls sideways when it doesn't fit, with no scrollbar showing, like
     browse's tabs. The 4px of padding above and below keeps focus rings inside the scroll box, which would clip them.
     The row pulls out by the page's own padding, so the pills run to the screen's edge. */
  .info-toc ol {
    display: flex;
    gap: 8px;
    margin: 4px -16px 0;
    padding: 4px 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .info-toc ol::-webkit-scrollbar {
    display: none;
  }

  .info-toc a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding-inline: 16px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
    color: var(--color-navy);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
  }

  @media (hover: hover) and (pointer: fine) {
    .info-toc a:hover {
      background: var(--color-pale);
    }
  }

  /* The text is about 65 characters wide, whatever the screen (spec 2.5). */
  .info-body {
    max-width: 65ch;
    margin-top: 28px;
  }

  .info-section + .info-section {
    margin-top: 40px;
  }

  .info-section-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: clamp(1.5rem, 1.2rem + 1vw, 1.875rem);
    line-height: 1.05;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  /* Tailwind's reset strips the browser's text styles, so the page's own text is set back here. */
  .info-body p,
  .info-body ul,
  .info-body ol {
    margin-top: 12px;
  }

  .info-body ul,
  .info-body ol {
    padding-left: 1.25rem;
  }

  .info-body ul {
    list-style: disc;
  }

  .info-body ol {
    list-style: decimal;
  }

  .info-body li + li {
    margin-top: 8px;
  }

  .info-body li::marker {
    color: var(--color-navy);
  }

  .info-body h3 {
    margin-top: 24px;
    color: var(--color-navy);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.3;
  }

  .info-body h3 + p {
    margin-top: 4px;
  }

  .info-body strong {
    color: var(--color-navy);
  }

  /* Links in the text are underlined, so colour isn't the only sign of them; sky-dark is 4.7:1 on white (spec 6). */
  .info-body a {
    color: var(--color-sky-dark);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .info-body code {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--color-panel);
    font-size: 0.9em;
    overflow-wrap: anywhere;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .info-page {
      padding-inline: 40px;
    }

    .info-toc ol {
      margin-inline: -40px;
      padding-inline: 40px;
    }
  }

  /* Desktop: the contents list stands on the left as a quiet column of links with a hairline beside them, and the
     text takes the 65-character column next to it. */
  @media (min-width: 64rem) and (min-height: 30rem) {
    .info-layout {
      display: grid;
      grid-template-columns: 14rem minmax(0, 65ch);
      column-gap: 64px;
      align-items: start;
    }

    .info-toc ol {
      display: grid;
      gap: 0;
      margin: 8px 0 0;
      padding: 0;
      overflow: visible;
    }

    .info-toc a {
      padding: 6px 0 6px 14px;
      border: 0;
      border-left: 2px solid var(--color-line);
      border-radius: 0;
      font-weight: 500;
      white-space: normal;
    }

    .info-body {
      margin-top: 0;
    }
  }
}
```

- [ ] **Step 6: Run the checks**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass. There is nothing to look at yet: no page uses the frame.

- [ ] **Step 7: Hand over for commit**

Files: `components/info/InfoPage.tsx`, `components/info/InfoPage.test.tsx`, `app/globals.css`.
Message: `feat: InfoPage, the shared frame for info and legal pages (info and system spec 2.5)`

---

### Task 2: How it works and Safety

The first two pages replace `ComingSoon` (spec 3). Each page file holds its metadata and its complete text; the test beside it checks both.

**Files:**
- Modify: `app/how-it-works/page.tsx`, `app/safety/page.tsx`
- Create: `app/how-it-works/page.test.tsx`, `app/safety/page.test.tsx`
- Modify: `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`

- [ ] **Step 1: Read the docs**

Read `generate-metadata.md` in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/` (the static `metadata` export). The placeholder pages already use it.

- [ ] **Step 2: Write the How it works test**

Create `app/how-it-works/page.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorksPage, { metadata } from "./page";

describe("How it works (info and system spec 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("How Vossie works");
    expect(metadata.description).toMatch(/find it, message the seller, meet on campus/i);
  });

  it("has one h1 and four sections", () => {
    render(<HowItWorksPage />);
    expect(screen.getByRole("heading", { level: 1, name: "How Vossie works" })).toBeInTheDocument();
    const names = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(names).toEqual(["Buying", "Selling", "Trust, in one paragraph", "Questions and answers"]);
  });

  it("walks through buying: find it, message the seller, meet at a pickup point, pay or swap", () => {
    render(<HowItWorksPage />);
    const buying = screen.getByRole("region", { name: "Buying" });
    const steps = within(buying)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("strong")?.textContent);
    expect(steps).toEqual(["Find it.", "Message the seller.", "Meet at a pickup point.", "See it, then pay or swap."]);
    expect(within(buying).getByText(/Vossie takes no online payments/)).toBeInTheDocument();
    expect(within(buying).getByRole("link", { name: "safety guide" })).toHaveAttribute("href", "/safety");
  });

  it("walks through selling: apply, the Hub checks you, list, reply within 48 hours", () => {
    render(<HowItWorksPage />);
    const selling = screen.getByRole("region", { name: "Selling" });
    const steps = within(selling)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("strong")?.textContent);
    expect(steps).toEqual(["Apply.", "Get checked by the Hub.", "List what you have.", "Reply within 48 hours."]);
    expect(within(selling).getByRole("link", { name: "seller guidelines" })).toHaveAttribute(
      "href",
      "/seller-guidelines",
    );
  });

  it("explains trust in one paragraph that links to the trust page", () => {
    render(<HowItWorksPage />);
    const trust = screen.getByRole("region", { name: "Trust, in one paragraph" });
    expect(trust.querySelectorAll("p")).toHaveLength(1);
    expect(within(trust).getByRole("link", { name: "How trust works" })).toHaveAttribute("href", "/trust");
  });

  it("answers six short questions, including what works today", () => {
    render(<HowItWorksPage />);
    const questions = screen.getByRole("region", { name: "Questions and answers" });
    expect(within(questions).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Who can use Vossie?",
      "Does it cost anything?",
      "How do I pay?",
      "Can I buy from another campus?",
      "How do I become a seller?",
      "What can I do on Vossie today?",
    ]);
    expect(within(questions).getByText(/Browse every campus, save listings on your device and share them/)).toBeInTheDocument();
  });

  it("is not a draft", () => {
    render(<HowItWorksPage />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
```

- [ ] **Step 3: Write the Safety test**

Create `app/safety/page.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SafetyPage, { metadata } from "./page";

describe("Safety (info and system spec 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("Safety");
    expect(metadata.description).toMatch(/never paying in advance/i);
  });

  it("has one h1 and five sections", () => {
    render(<SafetyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Safety" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Meeting safely",
      "Checking before you pay",
      "Paying safely",
      "Signs of a scam",
      "Reporting a problem",
    ]);
  });

  it("tells people to meet at pickup points, in daylight, with a friend", () => {
    render(<SafetyPage />);
    const meeting = screen.getByRole("region", { name: "Meeting safely" });
    expect(within(meeting).getByText(/approved pickup point on campus/)).toBeInTheDocument();
    expect(within(meeting).getByText(/Go in daylight/)).toBeInTheDocument();
    expect(within(meeting).getByText(/Take a friend/)).toBeInTheDocument();
  });

  it("says never to pay in advance and never to share bank details or codes", () => {
    render(<SafetyPage />);
    const paying = screen.getByRole("region", { name: "Paying safely" });
    expect(within(paying).getByText(/Never pay a deposit or pay in advance/)).toBeInTheDocument();
    expect(within(paying).getByText(/Never share your bank card details, PIN, passwords or one-time codes/)).toBeInTheDocument();
  });

  it("lists the signs of a scam", () => {
    render(<SafetyPage />);
    const scams = screen.getByRole("region", { name: "Signs of a scam" });
    expect(within(scams).getAllByRole("listitem")).toHaveLength(6);
    expect(within(scams).getByText(/asks you to pay first/)).toBeInTheDocument();
    expect(within(scams).getByText(/screenshot as proof that they've paid/)).toBeInTheDocument();
  });

  it("says how to report, gives the police number, and links to the trust page and the Hub", () => {
    render(<SafetyPage />);
    const reporting = screen.getByRole("region", { name: "Reporting a problem" });
    expect(within(reporting).getByText(/Every listing and every seller's page has a Report link/)).toBeInTheDocument();
    expect(within(reporting).getByText(/10111/)).toBeInTheDocument();
    expect(within(reporting).getByRole("link", { name: "how trust works" })).toHaveAttribute("href", "/trust");
    expect(within(reporting).getByRole("link", { name: "Incubation Hub" })).toHaveAttribute("href", "/hub");
  });

  it("is not a draft", () => {
    render(<SafetyPage />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test app/how-it-works app/safety`
Expected: FAIL. The placeholder pages have no sections, no notes and no `description`.

- [ ] **Step 5: Write How it works**

Replace `app/how-it-works/page.tsx` with:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "How Vossie works",
  description:
    "How buying and selling work on Vossie, the Eduvos student marketplace: find it, message the seller, meet on campus, then pay or swap.",
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "how-buying",
    title: "Buying",
    children: (
      <>
        <p>
          Vossie is where Eduvos students buy and sell textbooks, tech, food, services and more. There&apos;s no cart and
          no checkout. You and the seller agree the details, then meet.
        </p>
        <ol>
          <li>
            <strong>Find it.</strong> Search, or browse by category. Your campus comes first, and you can shop every
            campus.
          </li>
          <li>
            <strong>Message the seller.</strong> Ask what you need to know. If they take swaps, you can offer one.
          </li>
          <li>
            <strong>Meet at a pickup point.</strong> Pickup points are approved spots on campus, like the library
            entrance or the main reception. Agree a time that suits you both.
          </li>
          <li>
            <strong>See it, then pay or swap.</strong> Check the item first. If it&apos;s what you were promised, pay
            cash or swap on the spot. Vossie takes no online payments.
          </li>
        </ol>
        <p>
          Never pay before you&apos;ve seen it. The <Link href="/safety">safety guide</Link> has the rest.
        </p>
      </>
    ),
  },
  {
    id: "how-selling",
    title: "Selling",
    children: (
      <>
        <p>Listing is free. Here&apos;s how a shop gets going:</p>
        <ol>
          <li>
            <strong>Apply.</strong> Sign in with your Eduvos email and set up your shop. It takes about three minutes,
            from your phone.
          </li>
          <li>
            <strong>Get checked by the Hub.</strong> The Eduvos Incubation Hub looks at every new seller before they can
            list.
          </li>
          <li>
            <strong>List what you have.</strong> Add clear photos, an honest description and a fair price in rand. Say
            if you&apos;ll take a swap.
          </li>
          <li>
            <strong>Reply within 48 hours.</strong> Buyers don&apos;t like waiting, and quick replies help you earn
            badges.
          </li>
        </ol>
        <p>
          The rules for sellers are in the <Link href="/seller-guidelines">seller guidelines</Link>.
        </p>
      </>
    ),
  },
  {
    id: "how-trust",
    title: "Trust, in one paragraph",
    children: (
      <p>
        Vossie has no star ratings. The Incubation Hub marks the sellers it has checked as Verified, and Vossie awards
        badges for what a seller actually does: replying quickly and completing sales that buyers confirm.{" "}
        <Link href="/trust">How trust works</Link> explains each one.
      </p>
    ),
  },
  {
    id: "how-questions",
    title: "Questions and answers",
    children: (
      <>
        <h3>Who can use Vossie?</h3>
        <p>
          Anyone can browse, save and share listings. Messaging and selling need an account, and accounts are for
          Eduvos students, who sign in with their Eduvos email address.
        </p>
        <h3>Does it cost anything?</h3>
        <p>Listing is free. Vossie doesn&apos;t handle payments, so it takes no cut of a sale.</p>
        <h3>How do I pay?</h3>
        <p>
          Straight to the seller, in cash or as a swap, when you meet. Agree it when you message. Don&apos;t pay before
          you&apos;ve seen the item or had the service.
        </p>
        <h3>Can I buy from another campus?</h3>
        <p>
          You can browse every campus. Things you collect in person are collected at the campus where they&apos;re
          listed, and each listing says where. Delivery between campuses isn&apos;t available yet.
        </p>
        <h3>How do I become a seller?</h3>
        <p>
          Set up your shop once you can sign in. The Incubation Hub then checks it, and you can start listing.
        </p>
        <h3>What can I do on Vossie today?</h3>
        <p>
          Browse every campus, save listings on your device and share them. Sign-in, messaging and selling arrive in the
          next stages, so this page describes how they will work.
        </p>
      </>
    ),
  },
];

export default function HowItWorksPage() {
  return (
    <InfoPage
      title="How Vossie works"
      lede="Find it, message the seller, meet on campus, then pay or swap."
      updated="2026-10-14"
      sections={SECTIONS}
    />
  );
}
```

- [ ] **Step 6: Write Safety**

Replace `app/safety/page.tsx` with:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "Safety",
  description:
    "How to buy and sell safely on Vossie: meeting on campus, checking an item, never paying in advance, spotting a scam and reporting a problem.",
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "safety-meeting",
    title: "Meeting safely",
    children: (
      <ul>
        <li>Meet at an approved pickup point on campus. A listing you collect in person shows where.</li>
        <li>Go in daylight, while there are other people around.</li>
        <li>Take a friend, or tell someone where you&apos;re going and when you expect to be back.</li>
        <li>
          Stick to the plan. If the other person suggests somewhere else, say no and offer a pickup point instead.
        </li>
        <li>
          For tutoring and other services, meet in a busy part of campus, or online, and keep to the time you agreed.
        </li>
      </ul>
    ),
  },
  {
    id: "safety-checking",
    title: "Checking before you pay",
    children: (
      <ul>
        <li>Look at the item properly. Switch it on, open it, try it.</li>
        <li>
          With a phone, laptop or calculator, check that it works and that it isn&apos;t locked to someone else&apos;s
          account.
        </li>
        <li>With a textbook, check the edition and that every page is there.</li>
        <li>
          Make sure it matches the listing: the photos, the description and the price. If it doesn&apos;t, you can walk
          away.
        </li>
        <li>Take your time. A good seller won&apos;t rush you.</li>
      </ul>
    ),
  },
  {
    id: "safety-paying",
    title: "Paying safely",
    children: (
      <ul>
        <li>
          Pay only when you have the item in your hands, or you&apos;ve had the service. Never pay a deposit or pay in
          advance, even a small amount.
        </li>
        <li>
          Vossie has no online payments, so nobody on Vossie should ask you to pay by EFT, voucher or app before you
          meet.
        </li>
        <li>
          Never share your bank card details, PIN, passwords or one-time codes (OTPs), not with a seller, a buyer or
          anyone who says they&apos;re from Vossie.
        </li>
        <li>
          If you&apos;re paid in cash, check it before you hand over the item. If it&apos;s a swap, see what you&apos;re
          getting before you hand over what you&apos;re giving.
        </li>
      </ul>
    ),
  },
  {
    id: "safety-scams",
    title: "Signs of a scam",
    children: (
      <>
        <p>Be careful if someone:</p>
        <ul>
          <li>asks you to pay first, or to pay a &quot;deposit&quot; or &quot;booking fee&quot; to hold something;</li>
          <li>sends a screenshot as proof that they&apos;ve paid. Check your own bank balance instead;</li>
          <li>is in a hurry, or says someone else is about to buy it;</li>
          <li>offers a price that&apos;s too good to be true;</li>
          <li>asks for your ID number, bank details or a code sent to your phone;</li>
          <li>wants to move the chat somewhere else, or won&apos;t meet on campus or show you the item first.</li>
        </ul>
        <p>If something feels wrong, stop. You don&apos;t owe anyone an explanation.</p>
      </>
    ),
  },
  {
    id: "safety-reporting",
    title: "Reporting a problem",
    children: (
      <>
        <p>
          If a listing or a person worries you, report it. Every listing and every seller&apos;s page has a Report link.
          Reporting needs an account, so the link takes you to sign in first. A member of the Hub team reads every
          report, and can hide a listing or pause an account.
        </p>
        <p>
          If you&apos;re in danger, get somewhere safe and tell campus security. If a crime has happened, call the police
          on 10111.
        </p>
        <p>
          Want to know how Vossie checks its sellers? Read <Link href="/trust">how trust works</Link>, or find out about
          the <Link href="/hub">Incubation Hub</Link> that runs Vossie.
        </p>
      </>
    ),
  },
];

export default function SafetyPage() {
  return (
    <InfoPage
      title="Safety"
      lede="Meet in a safe place, check before you pay, and trust your gut."
      updated="2026-10-14"
      sections={SECTIONS}
    />
  );
}
```

Run: `pnpm test app/how-it-works app/safety components/info`
Expected: PASS.

- [ ] **Step 7: These two pages are no longer placeholders**

In `tests/e2e/routes.spec.ts`, delete these two lines from `PLACEHOLDERS` (each is unique; leave every other row alone):

```ts
  ["/how-it-works", "How Vossie works"],
  ["/safety", "Safety"],
```

In `tests/e2e/performance.spec.ts`, add a row to `PAGES` right after the listing page's row:

```ts
  ["info page", "/how-it-works"],
```

(Use Edit on the line `  ["listing page", "/listings/l-001"],` and add the new line after it.)

- [ ] **Step 8: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build lists `/how-it-works` and `/safety` as prerendered (static) routes.

- [ ] **Step 9: Look at it**

Start the build you just made (`pnpm start --port 3201`) and check `/how-it-works` and `/safety` at 390 × 844, 768 × 1024 and 1280 × 800:
- The h1, the one-line lede, "Last updated 14 October 2026", and no banner.
- Phones and tablet: "On this page" with a row of navy-outlined pills under the date. The row scrolls sideways, with no scrollbar, and the page itself doesn't scroll sideways. The text below it is a comfortable column.
- 1280: the contents list is a column on the left with a hairline beside the links; the text column is about 65 characters wide beside it.
- Numbered steps have navy numbers; links are sky-dark and underlined; every pill and link is easy to tap.
- Tab a few times: the focus ring is visible on the pills and links, and clicking "Selling" jumps to the section with its heading clear of the sticky header.

Stop the server.

- [ ] **Step 10: Measure the JS**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/routes.spec.ts --project=phone-390`
Expected: all pass. Note the four `scriptBrotli` figures (`homepage`, `browse page`, `listing page`, `info page`) in the ledger. The first three should equal the start figures to within a few bytes. If any page is past the stop line, stop here and report.

- [ ] **Step 11: Hand over for commit**

Files: `app/how-it-works/page.tsx`, `app/how-it-works/page.test.tsx`, `app/safety/page.tsx`, `app/safety/page.test.tsx`, `tests/e2e/routes.spec.ts`, `tests/e2e/performance.spec.ts`.
Message: `feat: How it works and Safety pages (info and system spec 3). JS: / <n> B, browse <n> B, listing <n> B, How it works <n> B`

---

### Task 3: How trust works, and the homepage's trust links

One trust page (spec 2.3): Verified, the three badges and how Featured today is picked, in plain words. The homepage's "How trust works" link moves to it, and so does Featured today's "How we pick" (plan decision 7).

**Files:**
- Create: `app/trust/page.tsx`, `app/trust/page.test.tsx`
- Modify: `components/home/ContextStripView.tsx`, `components/home/ContextStrip.test.tsx`
- Modify: `components/home/FeaturedToday.tsx`, `components/home/FeaturedToday.test.tsx`

- [ ] **Step 1: Write the trust page's test**

Create `app/trust/page.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrustPage, { metadata } from "./page";

/** The paragraph under a heading. */
function paragraphUnder(heading: HTMLElement): string {
  return heading.nextElementSibling?.textContent ?? "";
}

describe("How trust works (info and system spec 2.3, 2.4 and 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("How trust works");
    expect(metadata.description).toMatch(/Verified sellers/);
  });

  it("has one h1 and four sections", () => {
    render(<TrustPage />);
    expect(screen.getByRole("heading", { level: 1, name: "How trust works" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Verified by the Hub",
      "The three badges",
      "What counts",
      "How Featured today is picked",
    ]);
  });

  it("explains Verified as the Hub's own check, and says it isn't a promise", () => {
    render(<TrustPage />);
    const verified = screen.getByRole("region", { name: "Verified by the Hub" });
    expect(
      within(verified).getByText(/means the Eduvos Incubation Hub has looked at a seller and approved their shop/),
    ).toBeInTheDocument();
    expect(within(verified).getByText(/isn't a promise that a deal will go well/)).toBeInTheDocument();
    expect(within(verified).getByRole("link", { name: "safety steps" })).toHaveAttribute("href", "/safety");
  });

  it("gives the three badges and their rules (spec 2.4)", () => {
    render(<TrustPage />);
    const badges = screen.getByRole("region", { name: "The three badges" });
    const names = within(badges).getAllByRole("heading", { level: 3 });
    expect(names.map((heading) => heading.textContent)).toEqual(["New seller", "Responsive", "Trusted"]);
    expect(paragraphUnder(names[0])).toMatch(/^Everyone starts here\./);
    expect(paragraphUnder(names[1])).toBe(
      "In the last 90 days the seller has had at least 3 enquiries and replied to at least 80% of them within 48 hours.",
    );
    expect(paragraphUnder(names[2])).toBe(
      "In the last 90 days the seller has had at least 3 enquiries and replied to at least 85% of them within 48 hours. " +
        "They also have at least 5 sales or swaps that buyers have confirmed, and their account is at least 30 days old.",
    );
  });

  it("says the badges on sellers today are samples, and that a badge can go down", () => {
    render(<TrustPage />);
    const badges = screen.getByRole("region", { name: "The three badges" });
    expect(within(badges).getByText(/the badges you see on sellers today are samples/)).toBeInTheDocument();
    expect(within(badges).getByText(/a badge can go down again/)).toBeInTheDocument();
  });

  it("has no Top Hustler badge, which this build doesn't have", () => {
    const { container } = render(<TrustPage />);
    expect(container).not.toHaveTextContent("Top Hustler");
  });

  it("says what counts and what doesn't (plan decision 16)", () => {
    render(<TrustPage />);
    const counts = screen.getByRole("region", { name: "What counts" });
    const items = within(counts)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items).toHaveLength(4);
    expect(items[1]).toMatch(/still inside its 48 hours doesn't count against the seller/);
    expect(items[2]).toMatch(/a week after the seller marks it completed/);
    expect(items[2]).toMatch(/says it didn't happen, it doesn't count/);
    expect(items[3]).toMatch(/outside Vossie, such as on WhatsApp/);
  });

  it("explains how Featured today is picked", () => {
    render(<TrustPage />);
    const featured = screen.getByRole("region", { name: "How Featured today is picked" });
    const items = within(featured)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items).toHaveLength(5);
    expect(items[0]).toMatch(/Only Verified sellers with an open shop and something listed/);
    expect(items[1]).toMatch(/fair draw/);
    expect(items[2]).toMatch(/its sellers come first/);
    expect(items[3]).toMatch(/sits out for a week/);
    expect(items[4]).toMatch(/Hub staff can pin a Verified seller/);
  });

  it("is not a draft", () => {
    render(<TrustPage />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
```

- [ ] **Step 2: Change the two links' tests**

In `components/home/ContextStrip.test.tsx`, replace
`expect(screen.getByRole("link", { name: "How trust works" })).toHaveAttribute("href", "/safety");`
with
`expect(screen.getByRole("link", { name: "How trust works" })).toHaveAttribute("href", "/trust");`

In `components/home/FeaturedToday.test.tsx`, replace
`expect(screen.getByRole("link", { name: "How we pick featured sellers" })).toHaveAttribute("href", "/how-it-works");`
with
`expect(screen.getByRole("link", { name: "How we pick featured sellers" })).toHaveAttribute("href", "/trust#trust-featured");`

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test app/trust components/home/ContextStrip.test.tsx components/home/FeaturedToday.test.tsx`
Expected: FAIL. `./page` for the trust page doesn't exist, and the two links still point at the old pages.

- [ ] **Step 4: Write the trust page**

Create `app/trust/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "How trust works",
  description:
    "How Vossie decides who to trust: Verified sellers, the New seller, Responsive and Trusted badges, and how Featured today is picked.",
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "trust-verified",
    title: "Verified by the Hub",
    children: (
      <>
        <p>
          <strong>Verified</strong> means the Eduvos Incubation Hub has looked at a seller and approved their shop. The
          Hub does this by hand, before a new seller can list anything. A Verified seller has a tick and the word
          Verified on their listings and their shop.
        </p>
        <p>
          Verified tells you the Hub knows who the seller is. It isn&apos;t a promise that a deal will go well, so keep
          to the <Link href="/safety">safety steps</Link> every time.
        </p>
      </>
    ),
  },
  {
    id: "trust-badges",
    title: "The three badges",
    children: (
      <>
        <p>
          Badges are worked out by Vossie from what a seller does, not from what they say. A seller shows the highest
          badge they meet, and a badge can go down again if their habits change.
        </p>
        <p>
          Vossie is still being built, so the badges you see on sellers today are samples. The rules below are how real
          badges will be worked out once accounts are live.
        </p>
        <h3>New seller</h3>
        <p>
          Everyone starts here. It means the seller hasn&apos;t built up a record on Vossie yet, which is normal for a
          new shop.
        </p>
        <h3>Responsive</h3>
        <p>
          In the last 90 days the seller has had at least 3 enquiries and replied to at least 80% of them within 48
          hours.
        </p>
        <h3>Trusted</h3>
        <p>
          In the last 90 days the seller has had at least 3 enquiries and replied to at least 85% of them within 48
          hours. They also have at least 5 sales or swaps that buyers have confirmed, and their account is at least 30
          days old.
        </p>
      </>
    ),
  },
  {
    id: "trust-counts",
    title: "What counts",
    children: (
      <>
        <ul>
          <li>An enquiry is a buyer&apos;s first message to a seller about a listing, sent through Vossie.</li>
          <li>
            The 48 hours run from when the message arrives. A message that is still inside its 48 hours doesn&apos;t
            count against the seller.
          </li>
          <li>
            A sale or swap counts once the buyer confirms it, or a week after the seller marks it completed if the buyer
            says nothing. If the buyer says it didn&apos;t happen, it doesn&apos;t count.
          </li>
          <li>
            Chats that happen outside Vossie, such as on WhatsApp, can&apos;t be seen, so they don&apos;t count either
            way.
          </li>
        </ul>
        <p>A badge is a record of how someone has behaved on Vossie so far. It isn&apos;t a guarantee.</p>
      </>
    ),
  },
  {
    id: "trust-featured",
    title: "How Featured today is picked",
    children: (
      <>
        <p>
          The Featured today row on the homepage shows sellers the Hub has verified. Once accounts are live, each campus
          gets its own draw every day, for up to four places:
        </p>
        <ul>
          <li>Only Verified sellers with an open shop and something listed can be picked.</li>
          <li>It&apos;s a fair draw. There are no paid places.</li>
          <li>
            If you&apos;ve chosen a campus, its sellers come first, and sellers from other campuses fill any gaps.
          </li>
          <li>A seller who has been featured sits out for a week before they can be picked again.</li>
          <li>
            Hub staff can pin a Verified seller to a campus for a day. A pinned seller takes one of the places before the
            draw.
          </li>
        </ul>
      </>
    ),
  },
];

export default function TrustPage() {
  return (
    <InfoPage
      title="How trust works"
      lede="No star ratings. Trust here comes from checks by the Hub and from what sellers actually do."
      updated="2026-10-14"
      sections={SECTIONS}
    />
  );
}
```

- [ ] **Step 5: Move the two links**

In `components/home/ContextStripView.tsx`, replace `<Link href="/safety" className="context-link">` with `<Link href="/trust" className="context-link">`. (It is the only `/safety` link in that file.)

In `components/home/FeaturedToday.tsx`, replace
`const HOW_WE_PICK = { href: "/how-it-works", label: "How we pick", context: " featured sellers" };`
with
`const HOW_WE_PICK = { href: "/trust#trust-featured", label: "How we pick", context: " featured sellers" };`

Run: `pnpm test app/trust components/home`
Expected: PASS.

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build lists `/trust` as a prerendered route.

- [ ] **Step 7: Look at it**

Start the build (`pnpm start --port 3201`) and check at 390 × 844, 768 × 1024 and 1280 × 800:
- `/trust`: one h1, four sections, the three badges as bold sub-headings with one paragraph each, no banner.
- On `/`, a first visit (no campus, nothing viewed) shows the trust strip under the hero: "How trust works" opens `/trust`.
- On `/`, Featured today's "How we pick" opens `/trust` scrolled to "How Featured today is picked", the heading clear of the sticky header.

Stop the server.

- [ ] **Step 8: Measure the JS**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/home.spec.ts --project=phone-390`
Expected: all pass. `ContextStripView` is a client component, but only an address in it changed, so the figures should match Task 2's within a byte or two. Note them in the ledger. If any page is past the stop line, stop here and report.

- [ ] **Step 9: Hand over for commit**

Files: `app/trust/page.tsx`, `app/trust/page.test.tsx`, `components/home/ContextStripView.tsx`, `components/home/ContextStrip.test.tsx`, `components/home/FeaturedToday.tsx`, `components/home/FeaturedToday.test.tsx`.
Message: `feat: How trust works page, and the homepage's trust links move to it (info and system spec 2.3). JS: / <n> B, browse <n> B, listing <n> B`

---

### Task 4: Privacy, Terms and Seller guidelines

The three legal pages are clearly marked drafts (spec 2.1 and 2.2). The privacy page's test imports the real cookie and storage names, so the page can't drift from the code. A cross-page test checks all six pages together.

**Files:**
- Modify: `app/privacy/page.tsx`
- Create: `app/privacy/page.test.tsx`, `app/terms/page.tsx`, `app/terms/page.test.tsx`
- Create: `app/seller-guidelines/page.tsx`, `app/seller-guidelines/page.test.tsx`
- Create: `app/info-pages.test.tsx`
- Modify: `tests/e2e/routes.spec.ts`, `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Write the privacy page's test**

Create `app/privacy/page.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CAMPUS_COOKIE } from "@/lib/campus";
import { LOW_DATA_KEY } from "@/lib/low-data";
import { RECENT_KEY } from "@/lib/recent-searches";
import { RECENTLY_VIEWED_KEY } from "@/lib/recently-viewed";
import { SAVED_COOKIE } from "@/lib/saved";
import PrivacyPage, { metadata } from "./page";

/** The `code` words in the first list after a heading. */
function codesAfter(heading: HTMLElement): string[] {
  let node = heading.nextElementSibling;
  while (node && node.tagName !== "UL") node = node.nextElementSibling;
  return [...(node?.querySelectorAll("code") ?? [])].map((code) => code.textContent ?? "");
}

describe("Privacy policy (info and system spec 2.1, 2.2 and 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("Privacy policy");
    expect(metadata.description).toMatch(/POPIA/);
  });

  it("has one h1 and nine sections", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Who is responsible",
      "What this site stores today",
      "When sign-in arrives",
      "How long we keep it",
      "Who it is shared with",
      "Where it is hosted",
      "Your rights",
      "Contact the Hub",
      "Changes to this policy",
    ]);
  });

  it("is a draft, in words (spec 2.1)", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("note")).toHaveTextContent("Draft for Eduvos to review. Not yet in force.");
  });

  it("says the Information Officer is to be named by Eduvos, and names no one", () => {
    render(<PrivacyPage />);
    const who = screen.getByRole("region", { name: "Who is responsible" });
    expect(within(who).getByText(/to be named by Eduvos/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Contact the Hub" })).getByText(/to be named by Eduvos/)).toBeInTheDocument();
    expect(within(who).getByText(/Eduvos is the responsible party/)).toBeInTheDocument();
  });

  it("lists the two cookies and the three browser-only stores by their real names (spec 2.2)", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(within(today).getByText(/stores nothing about you on a server/)).toBeInTheDocument();
    expect(codesAfter(within(today).getByRole("heading", { level: 3, name: "Two first-party cookies" }))).toEqual([
      CAMPUS_COOKIE,
      SAVED_COOKIE,
    ]);
    expect(
      codesAfter(within(today).getByRole("heading", { level: 3, name: "Three things kept only in your browser" })),
    ).toEqual([RECENTLY_VIEWED_KEY, RECENT_KEY, LOW_DATA_KEY]);
  });

  it("says what else happens: searches in the address, server logs, the unsent sign-up, no tracking", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(within(today).getByText(/\/browse\?q=calculator/)).toBeInTheDocument();
    expect(within(today).getByText(/ordinary server logs/)).toBeInTheDocument();
    expect(within(today).getByText(/doesn't send or store your email address yet/)).toBeInTheDocument();
    expect(within(today).getByText(/no advertising or tracking cookies, and no analytics/)).toBeInTheDocument();
    expect(within(today).getByText(/clear cookies like these after a week/)).toBeInTheDocument();
  });

  it("lists what accounts will collect, why and the lawful basis, so it needn't be rewritten", () => {
    render(<PrivacyPage />);
    const accounts = screen.getByRole("region", { name: "When sign-in arrives" });
    const items = within(accounts).getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(8);
    expect(within(accounts).getByText("Your Eduvos email address.")).toBeInTheDocument();
    expect(within(accounts).getByText("Your first name and campus.")).toBeInTheDocument();
    expect(within(accounts).getByText("Your agreement to this policy.")).toBeInTheDocument();
    expect(within(accounts).getAllByText(/Lawful basis/).length).toBe(items.length);
  });

  it("says nobody is sold anything, and who sees what", () => {
    render(<PrivacyPage />);
    const sharing = screen.getByRole("region", { name: "Who it is shared with" });
    expect(within(sharing).getByText(/does not sell personal information to anyone/)).toBeInTheDocument();
    expect(within(sharing).getByText(/say "a student", never a name/)).toBeInTheDocument();
  });

  it("says where it is hosted is still to be decided, with the section 72 safeguards", () => {
    render(<PrivacyPage />);
    const hosting = screen.getByRole("region", { name: "Where it is hosted" });
    expect(within(hosting).getByText(/still to be decided/)).toBeInTheDocument();
    expect(within(hosting).getByText(/POPIA section 72/)).toBeInTheDocument();
  });

  it("lists the rights and points to the Information Regulator", () => {
    render(<PrivacyPage />);
    const rights = screen.getByRole("region", { name: "Your rights" });
    expect(within(rights).getAllByRole("listitem")).toHaveLength(6);
    expect(within(rights).getByRole("link", { name: "inforegulator.org.za" })).toHaveAttribute(
      "href",
      "https://inforegulator.org.za",
    );
  });
});
```

- [ ] **Step 2: Write the terms' test**

Create `app/terms/page.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TermsPage, { metadata } from "./page";

describe("Terms of use (info and system spec 2.1 and 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("Terms of use");
    expect(metadata.description).toMatch(/rules for using Vossie/);
  });

  it("has one h1 and seven sections", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of use" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Who can use Vossie",
      "Vossie is not part of your deal",
      "What you can't do",
      "What you post",
      "Moderation and suspension",
      "Our responsibility",
      "Changes and the law",
    ]);
  });

  it("is a draft, in words", () => {
    render(<TermsPage />);
    expect(screen.getByRole("note")).toHaveTextContent("Draft for Eduvos to review. Not yet in force.");
  });

  it("says Vossie is not a party to a sale and holds no money or goods", () => {
    render(<TermsPage />);
    const deal = screen.getByRole("region", { name: "Vossie is not part of your deal" });
    expect(within(deal).getByText(/Vossie is not the buyer or the seller, does not hold anyone's money or goods/)).toBeInTheDocument();
    expect(within(deal).getByRole("link", { name: "safety guide" })).toHaveAttribute("href", "/safety");
  });

  it("points to the seller guidelines for what can't be sold", () => {
    render(<TermsPage />);
    const prohibited = screen.getByRole("region", { name: "What you can't do" });
    expect(within(prohibited).getByRole("link", { name: "seller guidelines" })).toHaveAttribute(
      "href",
      "/seller-guidelines",
    );
  });

  it("covers content, moderation, liability and changes", () => {
    render(<TermsPage />);
    expect(screen.getByText(/Do not post photos of other people without their consent/)).toBeInTheDocument();
    expect(screen.getByText(/can hide a listing, remove content, or pause or close an account/)).toBeInTheDocument();
    expect(screen.getByText(/Eduvos is not responsible for losses from deals between users/)).toBeInTheDocument();
    expect(screen.getByText(/These terms follow South African law/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Write the seller guidelines' test**

Create `app/seller-guidelines/page.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SellerGuidelinesPage, { metadata } from "./page";

describe("Seller guidelines (info and system spec 2.1 and 3)", () => {
  it("is titled and described for search results and link previews", () => {
    expect(metadata.title).toBe("Seller guidelines");
    expect(metadata.description).toMatch(/what can't be sold/);
  });

  it("has one h1 and seven sections", () => {
    render(<SellerGuidelinesPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Seller guidelines" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Who can sell",
      "What can't be sold",
      "Honest listings and photos",
      "Prices and swaps",
      "Replying within 48 hours",
      "Meeting buyers",
      "After a report",
    ]);
  });

  it("is a draft, in words", () => {
    render(<SellerGuidelinesPage />);
    expect(screen.getByRole("note")).toHaveTextContent("Draft for Eduvos to review. Not yet in force.");
  });

  it("lists what can't be sold: weapons, alcohol and tobacco to under-18s, medicines, counterfeits, cheating", () => {
    render(<SellerGuidelinesPage />);
    const banned = screen.getByRole("region", { name: "What can't be sold" });
    const items = within(banned)
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(items).toHaveLength(7);
    expect(items[0]).toMatch(/^weapons/);
    expect(items[1]).toMatch(/^alcohol or tobacco sold to anyone under 18/);
    expect(items[2]).toMatch(/^medicines/);
    expect(items[3]).toMatch(/^counterfeit goods/);
    expect(items[4]).toMatch(/^academic dishonesty/);
    expect(items[4]).toMatch(/Tutoring and study notes are welcome/);
  });

  it("asks for a reply within 48 hours and links to the trust page", () => {
    render(<SellerGuidelinesPage />);
    const reply = screen.getByRole("region", { name: "Replying within 48 hours" });
    expect(within(reply).getByText(/Reply to every enquiry within 48 hours/)).toBeInTheDocument();
    expect(within(reply).getByRole("link", { name: "How trust works" })).toHaveAttribute("href", "/trust");
  });

  it("says to meet at pickup points and links to the safety guide", () => {
    render(<SellerGuidelinesPage />);
    const meeting = screen.getByRole("region", { name: "Meeting buyers" });
    expect(within(meeting).getByText(/approved pickup point on campus, in daylight/)).toBeInTheDocument();
    expect(within(meeting).getByRole("link", { name: "safety guide" })).toHaveAttribute("href", "/safety");
  });

  it("says what happens after a report, and that you can ask for a second look", () => {
    render(<SellerGuidelinesPage />);
    const reports = screen.getByRole("region", { name: "After a report" });
    expect(within(reports).getByText(/A member of the Hub team reads every report/)).toBeInTheDocument();
    expect(within(reports).getByText(/contact the Hub and we will look again/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Write the cross-page test**

Create `app/info-pages.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import HowItWorksPage from "./how-it-works/page";
import PrivacyPage from "./privacy/page";
import SafetyPage from "./safety/page";
import SellerGuidelinesPage from "./seller-guidelines/page";
import TermsPage from "./terms/page";
import TrustPage from "./trust/page";

const PAGES: ReadonlyArray<[path: string, Page: ComponentType]> = [
  ["/how-it-works", HowItWorksPage],
  ["/safety", SafetyPage],
  ["/trust", TrustPage],
  ["/privacy", PrivacyPage],
  ["/terms", TermsPage],
  ["/seller-guidelines", SellerGuidelinesPage],
];

/** Every route a link on these pages may point at: the six pages, and the rest of the site. */
const ROUTES = new Set([...PAGES.map(([path]) => path), "/", "/browse", "/hub", "/looking-for", "/sell", "/login", "/account"]);

type Inspected = { path: string; h1s: number; sectionIds: string[]; contents: string[]; links: string[] };

function inspect(path: string, Page: ComponentType): Inspected {
  const { container, unmount } = render(<Page />);
  const inspected = {
    path,
    h1s: container.querySelectorAll("h1").length,
    sectionIds: [...container.querySelectorAll(".info-body > section")].map((section) => section.id),
    contents: [...container.querySelectorAll(".info-toc a")].map((link) => link.getAttribute("href") ?? ""),
    links: [...container.querySelectorAll(".info-body a")].map((link) => link.getAttribute("href") ?? ""),
  };
  unmount();
  return inspected;
}

describe("the six info pages together (info and system spec 3 and 6)", () => {
  let pages: Inspected[] = [];

  beforeAll(() => {
    pages = PAGES.map(([path, Page]) => inspect(path, Page));
  });

  it("each has one h1 and a contents list that matches its sections, in order", () => {
    for (const page of pages) {
      expect(page.h1s, page.path).toBe(1);
      expect(page.sectionIds.length, page.path).toBeGreaterThan(0);
      expect(page.contents, page.path).toEqual(page.sectionIds.map((id) => `#${id}`));
    }
  });

  it("never repeats a section id across pages (Next keeps the last pages hidden in the DOM)", () => {
    const all = pages.flatMap((page) => page.sectionIds);
    expect(new Set(all).size).toBe(all.length);
    for (const page of pages) {
      const prefix = page.path === "/how-it-works" ? "how-" : `${page.path.slice(1).replace("seller-", "")}-`;
      for (const id of page.sectionIds) expect(id.startsWith(prefix), `${page.path}: ${id}`).toBe(true);
    }
  });

  it("links only to pages that exist, and to sections that exist", () => {
    for (const page of pages) {
      for (const href of page.links) {
        if (href.startsWith("https://")) continue;
        const [route, hash] = href.split("#");
        const target = route === "" ? page : pages.find((other) => other.path === route);
        expect(route === "" || ROUTES.has(route), `${page.path} links to ${href}`).toBe(true);
        if (hash) expect(target?.sectionIds, `${page.path} links to ${href}`).toContain(hash);
      }
    }
  });

  it("sends people to other websites over https only", () => {
    for (const page of pages) {
      for (const href of page.links.filter((link) => /^[a-z]+:/.test(link))) {
        expect(href, page.path).toMatch(/^https:\/\//);
      }
    }
  });
});
```

(The prefix check ties each id to its page: `/how-it-works` ids start `how-`; `/safety` → `safety-`; `/trust` → `trust-`; `/privacy` → `privacy-`; `/terms` → `terms-`; `/seller-guidelines` → `guidelines-`.)

- [ ] **Step 5: Run them to make sure they fail**

Run: `pnpm test app/privacy app/terms app/seller-guidelines app/info-pages.test.tsx`
Expected: FAIL. The privacy page is still a placeholder, and the other two pages and their modules don't exist.

- [ ] **Step 6: Write the privacy policy**

Replace `app/privacy/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Vossie handles your personal information under POPIA: what this site stores today, what accounts will collect, who sees it and your rights. A draft for Eduvos to review.",
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "privacy-who",
    title: "Who is responsible",
    children: (
      <>
        <p>
          Vossie is an Eduvos Incubation Hub project. Under the Protection of Personal Information Act 4 of 2013 (POPIA),
          Eduvos is the responsible party for the personal information collected through Vossie.
        </p>
        <ul>
          <li>
            <strong>Information Officer:</strong> to be named by Eduvos.
          </li>
          <li>
            <strong>Contact:</strong> the Incubation Hub team. See <a href="#privacy-contact">Contact the Hub</a> below.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "privacy-today",
    title: "What this site stores today",
    children: (
      <>
        <p>
          Right now Vossie has no accounts and stores nothing about you on a server. A few small things are kept on your
          own device, so the site can remember your choices.
        </p>
        <h3>Two first-party cookies</h3>
        <p>
          A cookie is a small file your browser keeps and sends back to Vossie with each page it asks for. These two
          belong to Vossie and nobody else. Some browsers, such as Safari on an iPhone, clear cookies like these after a
          week.
        </p>
        <ul>
          <li>
            <code>vossie_campus</code>: the campus you chose, so pages can show it first. It lasts up to a year.
          </li>
          <li>
            <code>vossie_saved</code>: the listings you have saved, as a list of listing codes, so the Saved page can
            show them. It lasts up to a year. It does not say who you are.
          </li>
        </ul>
        <h3>Three things kept only in your browser</h3>
        <p>These stay in your browser&apos;s own storage. They are never sent to Vossie.</p>
        <ul>
          <li>
            <code>vossie_recently_viewed</code>: the last few listings you opened, for &quot;Pick up where you left
            off&quot; on the homepage.
          </li>
          <li>
            <code>vossie_recent_searches</code>: your last few searches, offered as suggestions in the search box.
          </li>
          <li>
            <code>vossie_low_data</code>: whether you turned data saver on.
          </li>
        </ul>
        <h3>What else happens</h3>
        <ul>
          <li>
            When you search, the words you type are sent to Vossie in the page address (for example{" "}
            <code>/browse?q=calculator</code>), so it can find results.
          </li>
          <li>
            Whoever hosts Vossie keeps ordinary server logs (page addresses, times and technical details of each
            request) to keep the site running and secure. The hosting service is still to be decided.
          </li>
          <li>
            The campus updates form in the footer doesn&apos;t send or store your email address yet. When there is a real
            mailing list, it will ask for your consent first, and this policy will say so.
          </li>
          <li>Vossie uses no advertising or tracking cookies, and no analytics.</li>
        </ul>
        <p>Clearing your browser&apos;s cookies and site data removes everything listed here.</p>
      </>
    ),
  },
  {
    id: "privacy-sign-in",
    title: "When sign-in arrives",
    children: (
      <>
        <p>
          Messaging, selling and keeping your saves on every device will need an account. This is what accounts will
          collect, and why. This section will be updated when accounts go live.
        </p>
        <ul>
          <li>
            <strong>Your Eduvos email address.</strong> To check that you are an Eduvos student and to send you sign-in
            codes. Lawful basis: it is needed to run the account you ask for.
          </li>
          <li>
            <strong>Your first name and campus.</strong> Sellers see your first name in messages, so they know who they
            are talking to. Your campus puts your campus first. Lawful basis: needed to run your account.
          </li>
          <li>
            <strong>Your agreement to this policy.</strong> We keep the version you agreed to and the time, as a record
            that you were asked. Lawful basis: your consent.
          </li>
          <li>
            <strong>A sign-in cookie.</strong> A random code that keeps you signed in for up to 30 days. Lawful basis:
            needed to run your account.
          </li>
          <li>
            <strong>Your messages, swap offers and reports.</strong> To pass them to the other person, to work out reply
            times for trust badges, and to keep Vossie safe. Lawful basis: needed to run the service, and our legitimate
            interest in keeping students safe.
          </li>
          <li>
            <strong>If you sell: your shop and listings.</strong> Shop name, tagline, about text, photos, campus, pickup
            points and what you list, shown to buyers. Hidden location data, such as GPS, is removed from photos you
            upload. Lawful basis: needed to run your shop.
          </li>
          <li>
            <strong>If you are in the Hub&apos;s programme: mentors&apos; notes.</strong> Mentors can keep private notes
            and check-ins about your shop. Only Hub staff can see them, never the seller. Lawful basis: our legitimate
            interest in supporting student businesses.
          </li>
          <li>
            <strong>A log of what Hub staff do.</strong> Who approved, hid or paused what, and when, so staff actions can
            be checked. Lawful basis: our legitimate interest in running Vossie fairly.
          </li>
        </ul>
        <p>Vossie does not ask for your ID number, your bank details or your home address.</p>
      </>
    ),
  },
  {
    id: "privacy-keep",
    title: "How long we keep it",
    children: (
      <ul>
        <li>
          The two cookies last up to a year, and some browsers clear them sooner. Your browser keeps the other three
          until you clear them.
        </li>
        <li>Once accounts exist, your account details stay until you delete your account.</li>
        <li>
          Deleting your account removes your account, your sign-in sessions and your record of consent straight away,
          along with your shop and listings if you have them.
        </li>
        <li>How long messages and reports are kept will be set before messaging opens, and this policy will say so.</li>
        <li>
          Server logs are kept for a short time. The hosting service decides how long, and this policy will say once it
          is chosen.
        </li>
      </ul>
    ),
  },
  {
    id: "privacy-sharing",
    title: "Who it is shared with",
    children: (
      <>
        <p>Vossie does not sell personal information to anyone, and does not share it for advertising.</p>
        <ul>
          <li>
            <strong>Other students</strong> see only what they need. A seller&apos;s shop name, photos and listings are
            public. A buyer&apos;s first name is shown to the seller they message. Requests on the Looking For board say
            &quot;a student&quot;, never a name.
          </li>
          <li>
            <strong>Hub staff</strong> can see reports and account details when they need to, to approve sellers and
            keep Vossie safe.
          </li>
          <li>
            <strong>Service providers</strong> that run Vossie for Eduvos, such as hosting, the database and the service
            that sends sign-in codes, handle information for us and only for that purpose. They are still to be chosen.
          </li>
          <li>
            <strong>The law.</strong> We will share information if the law requires it.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "privacy-hosting",
    title: "Where it is hosted",
    children: (
      <p>
        The hosting for Vossie is still to be decided. If personal information is stored outside South Africa, POPIA
        section 72 only allows it where the country, the company or a binding agreement gives it protection at least as
        strong as POPIA, or where you consent. Eduvos will confirm where Vossie&apos;s data lives before launch, and this
        page will say so.
      </p>
    ),
  },
  {
    id: "privacy-rights",
    title: "Your rights",
    children: (
      <>
        <p>Under POPIA you can:</p>
        <ul>
          <li>ask what personal information Vossie holds about you;</li>
          <li>ask for it to be corrected;</li>
          <li>ask for it to be deleted;</li>
          <li>object to Vossie using it;</li>
          <li>take back consent you gave; and</li>
          <li>
            complain to the Information Regulator, at <a href="https://inforegulator.org.za">inforegulator.org.za</a>.
          </li>
        </ul>
        <p>
          Once accounts exist, you will be able to download your data and delete your account yourself, from your
          account&apos;s privacy settings. Until then, ask the Hub.
        </p>
      </>
    ),
  },
  {
    id: "privacy-contact",
    title: "Contact the Hub",
    children: (
      <>
        <p>
          Questions, or want to use one of your rights? Ask the Incubation Hub team on any Eduvos campus. A contact
          address for privacy requests will be added here before launch.
        </p>
        <p>
          <strong>Information Officer:</strong> to be named by Eduvos.
        </p>
      </>
    ),
  },
  {
    id: "privacy-changes",
    title: "Changes to this policy",
    children: (
      <p>
        This is a draft for Eduvos to review. When Eduvos approves the final version, the banner at the top will go and
        the date will change. If what we collect changes in a way that matters to you, we will tell you before it takes
        effect.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy policy"
      lede="How Vossie handles your personal information, under the Protection of Personal Information Act (POPIA)."
      updated="2026-10-14"
      draft
      sections={SECTIONS}
    />
  );
}
```

- [ ] **Step 7: Write the terms of use**

Create `app/terms/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "The rules for using Vossie, the Eduvos student marketplace, in plain words: who can use it, what you can't do, and what Vossie is and isn't responsible for. A draft for Eduvos to review.",
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "terms-who",
    title: "Who can use Vossie",
    children: (
      <ul>
        <li>
          Anyone can browse Vossie. To message a seller, sell or report something, you need an account, and accounts are
          for Eduvos students.
        </li>
        <li>If you are under 18, you need the consent of a parent or guardian to use Vossie.</li>
        <li>Keep your sign-in to yourself. You are responsible for what happens under your account.</li>
      </ul>
    ),
  },
  {
    id: "terms-deal",
    title: "Vossie is not part of your deal",
    children: (
      <>
        <p>
          Vossie is a noticeboard that helps students find each other. When you buy, sell or swap, the deal is between
          you and the other person. Vossie is not the buyer or the seller, does not hold anyone&apos;s money or goods,
          and does not check every listing. It cannot promise that an item is as described or that someone will turn up.
        </p>
        <p>
          Check what you are buying, meet safely and read the <Link href="/safety">safety guide</Link>. The Verified tick
          and the badges show how a seller has behaved on Vossie. They are not a guarantee.
        </p>
      </>
    ),
  },
  {
    id: "terms-prohibited",
    title: "What you can't do",
    children: (
      <>
        <p>You may not use Vossie to:</p>
        <ul>
          <li>
            sell anything the <Link href="/seller-guidelines">seller guidelines</Link> say cannot be sold;
          </li>
          <li>post anything false, misleading, offensive or against the law;</li>
          <li>harass, threaten or discriminate against anyone;</li>
          <li>send spam, or advertise things that are not for sale on Vossie;</li>
          <li>collect other people&apos;s personal information;</li>
          <li>pretend to be someone else; or</li>
          <li>break, overload or get around the site.</li>
        </ul>
      </>
    ),
  },
  {
    id: "terms-content",
    title: "What you post",
    children: (
      <>
        <p>
          What you post is yours: your photos, descriptions and messages. By posting it on Vossie you let Eduvos show it
          on Vossie and in link previews, and store and copy it as the site needs, for as long as it is on Vossie.
        </p>
        <ul>
          <li>Only post what you have the right to share.</li>
          <li>Do not post photos of other people without their consent.</li>
          <li>Keep phone numbers, addresses, ID numbers and other personal information out of listings and messages.</li>
        </ul>
      </>
    ),
  },
  {
    id: "terms-moderation",
    title: "Moderation and suspension",
    children: (
      <p>
        The Incubation Hub team can hide a listing, remove content, or pause or close an account that breaks these terms,
        the seller guidelines or the law, or that puts people at risk. Where we can, we will tell you why. If you think we
        got it wrong, contact the Hub and we will look again.
      </p>
    ),
  },
  {
    id: "terms-liability",
    title: "Our responsibility",
    children: (
      <>
        <p>
          We work to keep Vossie running and accurate, but it is provided as it is. We cannot promise that it will always
          be available or free of mistakes.
        </p>
        <p>
          As far as the law allows, Eduvos is not responsible for losses from deals between users, for items that are not
          as described, or for what other users say or do. Nothing here limits a right you have by law that cannot be
          limited.
        </p>
      </>
    ),
  },
  {
    id: "terms-changes",
    title: "Changes and the law",
    children: (
      <>
        <p>
          We may change these terms. The new version will go on this page with a new date, and signed-in users will be
          told about changes that matter. If you keep using Vossie after a change, you accept it.
        </p>
        <p>These terms follow South African law.</p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <InfoPage
      title="Terms of use"
      lede="The rules for using Vossie, in plain words."
      updated="2026-10-14"
      draft
      sections={SECTIONS}
    />
  );
}
```

- [ ] **Step 8: Write the seller guidelines**

Create `app/seller-guidelines/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, type InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "Seller guidelines",
  description:
    "How to sell well on Vossie, and what can't be sold: honest listings, fair prices, quick replies and safe handovers. A draft for Eduvos to review.",
};

const SECTIONS: readonly InfoSection[] = [
  {
    id: "guidelines-who",
    title: "Who can sell",
    children: (
      <p>
        Eduvos students can sell on Vossie once the Incubation Hub has checked their shop. You can sell as yourself or as
        your small business. What you list must be yours to sell.
      </p>
    ),
  },
  {
    id: "guidelines-banned",
    title: "What can't be sold",
    children: (
      <>
        <p>These can never be sold on Vossie, whatever the price:</p>
        <ul>
          <li>weapons, and anything made to hurt people;</li>
          <li>alcohol or tobacco sold to anyone under 18;</li>
          <li>medicines;</li>
          <li>counterfeit goods, such as fake brands, copied software or pirated books and music;</li>
          <li>
            academic dishonesty, such as writing someone&apos;s assignment or sitting a test for them. Tutoring and study
            notes are welcome. Passing off someone else&apos;s work is not;
          </li>
          <li>stolen goods, and anything you do not have the right to sell; and</li>
          <li>anything else that is against the law.</li>
        </ul>
        <p>Not sure? Ask the Hub before you list it.</p>
      </>
    ),
  },
  {
    id: "guidelines-honest",
    title: "Honest listings and photos",
    children: (
      <ul>
        <li>Use your own photos of the real item, not pictures from the internet.</li>
        <li>Give it a title that says what it is, and describe its condition honestly, faults included.</li>
        <li>Keep people, ID documents and anything private out of your photos.</li>
        <li>Mark a listing Sold or Paused as soon as it is no longer available.</li>
      </ul>
    ),
  },
  {
    id: "guidelines-prices",
    title: "Prices and swaps",
    children: (
      <ul>
        <li>Prices are in rand. The price you list is the price you ask, with no extras added at pickup.</li>
        <li>Free is fine. If you are giving something away, say so.</li>
        <li>
          For a swap, say what you would take in return and be fair. A swap works like a sale: both people see what they
          are getting before anything changes hands.
        </li>
      </ul>
    ),
  },
  {
    id: "guidelines-reply",
    title: "Replying within 48 hours",
    children: (
      <p>
        Buyers are waiting. Reply to every enquiry within 48 hours, even if the answer is no. Quick replies are what earn
        the Responsive and Trusted badges. <Link href="/trust">How trust works</Link> has the rules.
      </p>
    ),
  },
  {
    id: "guidelines-meeting",
    title: "Meeting buyers",
    children: (
      <ul>
        <li>
          Hand over at an approved pickup point on campus, in daylight, as the <Link href="/safety">safety guide</Link>{" "}
          describes.
        </li>
        <li>Never ask a buyer for money before you meet, or for their bank details or codes.</li>
        <li>
          When the handover is done, mark the sale completed so the buyer can confirm it. Confirmed sales count towards
          your badges.
        </li>
      </ul>
    ),
  },
  {
    id: "guidelines-reports",
    title: "After a report",
    children: (
      <>
        <p>
          Anyone can report a listing or a seller. A member of the Hub team reads every report. We may hide the listing
          while we look, ask you to change it, or, in serious cases, pause your account. Where we can, we will tell you
          what happened and why.
        </p>
        <p>
          If you think we got it wrong, contact the Hub and we will look again. Repeated or serious breaches can mean
          your account is closed.
        </p>
      </>
    ),
  },
];

export default function SellerGuidelinesPage() {
  return (
    <InfoPage
      title="Seller guidelines"
      lede="How to sell well on Vossie, and what is not allowed."
      updated="2026-10-14"
      draft
      sections={SECTIONS}
    />
  );
}
```

Run: `pnpm test app`
Expected: PASS, including the cross-page test.

- [ ] **Step 9: The privacy page is no longer a placeholder**

In `tests/e2e/routes.spec.ts`, delete this line from `PLACEHOLDERS` (leave every other row alone):

```ts
  ["/privacy", "Privacy (POPIA)"],
```

In `tests/e2e/a11y.spec.ts`, the test "a placeholder page" visits `/privacy`. Replace its line `await page.goto("/privacy");` with `await page.goto("/sell");` (the selling stage keeps `/sell` a placeholder longest). The new pages get their own axe tests in Task 9.

- [ ] **Step 10: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build lists `/privacy`, `/terms` and `/seller-guidelines` as prerendered routes. If lint reports an unescaped apostrophe or quote in JSX text, replace it with `&apos;` or `&quot;`; the tests' expected strings use plain characters.

- [ ] **Step 11: Look at it**

Start the build (`pnpm start --port 3201`) and check `/privacy`, `/terms` and `/seller-guidelines` at 390 × 844, 768 × 1024 and 1280 × 800:
- Under the date, a pale box with a navy outline that reads "Draft for Eduvos to review. Not yet in force." (bold first sentence).
- Phones: nine pills in a sideways-scrolling row (privacy), the text below at the full phone width. 1280: the contents column on the left, the text about 65 characters wide beside it.
- The cookie and storage names on the privacy page are in small grey code boxes, and none runs off a 360px-wide screen.
- The Information Regulator link and the in-page "Contact the Hub" link are underlined sky-dark.
- No horizontal page scroll at 360 (check with `document.documentElement.scrollWidth <= innerWidth`).

Stop the server.

- [ ] **Step 12: Hand over for commit**

Files: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`, `app/terms/page.tsx`, `app/terms/page.test.tsx`, `app/seller-guidelines/page.tsx`, `app/seller-guidelines/page.test.tsx`, `app/info-pages.test.tsx`, `tests/e2e/routes.spec.ts`, `tests/e2e/a11y.spec.ts`.
Message: `feat: privacy policy, terms of use and seller guidelines as marked drafts for Eduvos (info and system spec 2.1, 2.2)`

---

### Task 5: Footer links

The footer gains How trust works, Terms of use and Seller guidelines (spec 2.11, plan decision 6).

**Files:**
- Modify: `components/footer/SiteFooter.tsx`, `components/footer/SiteFooter.test.tsx`

- [ ] **Step 1: Write the footer's tests**

In `components/footer/SiteFooter.test.tsx`:

1. Add this helper under the `campuses` constant:

```tsx
/** The distinct addresses of every footer link with this name. Each group is drawn twice (the accordion and the column). */
const hrefsOf = (name: string) => [
  ...new Set(screen.getAllByRole("link", { name }).map((link) => link.getAttribute("href"))),
];
```

2. Add these two tests inside the `describe`, after "links every campus, the privacy notice and the sign-up":

```tsx
  it("links the info and legal pages (info and system spec 2.11)", () => {
    render(<SiteFooter campuses={campuses} />);
    expect(hrefsOf("Seller guidelines")).toEqual(["/seller-guidelines"]);
    expect(hrefsOf("How trust works")).toEqual(["/trust"]);
    expect(hrefsOf("Terms of use")).toEqual(["/terms"]);
    expect(hrefsOf("Privacy (POPIA)")).toEqual(["/privacy"]);
    expect(hrefsOf("Safety")).toEqual(["/safety"]);
    expect(screen.queryByRole("link", { name: "Seller safety" })).toBeNull();
  });

  it("keeps privacy, terms and safety in the legal row, which a phone shows even with the groups folded", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    const legal = container.querySelector<HTMLElement>(".footer-legal-links")!;
    expect(within(legal).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Privacy (POPIA)",
      "Terms of use",
      "Safety",
    ]);
  });
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/footer/SiteFooter.test.tsx`
Expected: FAIL. There is no Seller guidelines, How trust works or Terms of use link yet, and "Seller safety" is still there.

- [ ] **Step 3: Change the footer**

In `components/footer/SiteFooter.tsx`:

1. In the Sell group, replace
`      { href: "/safety", label: "Seller safety" },`
with
`      { href: "/seller-guidelines", label: "Seller guidelines" },`

2. In the Help group, replace these four lines:

```tsx
      { href: "/safety", label: "Safety" },
      { href: "/privacy", label: "Privacy (POPIA)" },
      { href: "/account", label: "Your account" },
```

with:

```tsx
      { href: "/safety", label: "Safety" },
      { href: "/trust", label: "How trust works" },
      { href: "/privacy", label: "Privacy (POPIA)" },
      { href: "/terms", label: "Terms of use" },
      { href: "/account", label: "Your account" },
```

3. In the legal row, replace
`            <Link href="/privacy">Privacy (POPIA)</Link> · <Link href="/safety">Safety</Link>`
with:

```tsx
            <Link href="/privacy">Privacy (POPIA)</Link> · <Link href="/terms">Terms of use</Link> ·{" "}
            <Link href="/safety">Safety</Link>
```

Run: `pnpm test components/footer`
Expected: PASS.

- [ ] **Step 4: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass.

- [ ] **Step 5: Look at it**

Start the build (`pnpm start --port 3201`) and check the footer at 390 × 844, 768 × 1024 and 1280 × 800:
- 390: the legal row reads "Privacy (POPIA) · Terms of use · Safety" and fits on one or two lines with every link at least 44px tall. Opening Help shows How it works, Safety, How trust works, Privacy (POPIA), Terms of use, Your account; Sell shows Seller guidelines.
- 1280 and 1440: in the Shop, Sell and Help columns no label wraps onto a second line (decision 32 left about 5px of slack in the widest column; "Seller guidelines" is the longest new label). Check with `[...document.querySelectorAll(".footer-links:not(.footer-links-columns) a")].filter((a) => a.offsetParent).map((a) => a.getBoundingClientRect().height)`: every value should be 44, none about 50. If one wraps, stop and report: the grid split in `app/globals.css` (decision 32) is Lama's to change.
- Each new link opens its page.

Stop the server.

- [ ] **Step 6: Hand over for commit**

Files: `components/footer/SiteFooter.tsx`, `components/footer/SiteFooter.test.tsx`.
Message: `feat: the footer links the trust, terms and seller guidelines pages (info and system spec 2.11)`

---

### Task 6: siteUrl, metadataBase, robots and the sitemap

The site's address comes from one place (spec 2.7). `metadataBase`, `robots.txt` and the sitemap all start from it, so share cards and sitemap entries are absolute and the duplicated `og:image` goes away (spec 2.7, 2.8 and 5).

**Files:**
- Create: `lib/site-url.ts`, `lib/site-url.test.ts`, `lib/sitemap.ts`, `lib/sitemap.test.ts`
- Create: `app/robots.ts`, `app/robots.test.ts`, `app/sitemap.ts`, `app/sitemap.test.ts`
- Modify: `app/layout.tsx`
- Create: `.env.example`; modify: `.gitignore`
- Modify: `tests/e2e/listing.spec.ts`, `tests/e2e/shopping.spec.ts`

- [ ] **Step 1: Read the docs**

Read `robots.md` and `sitemap.md` in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/`, and the `metadataBase` section of `generate-metadata.md` in `.../04-functions/`. Note that `robots.ts` and `sitemap.ts` are cached route handlers, that `lastModified: new Date()` in their examples would read the clock while prerendering (CLAUDE.md forbids it), and that a `Disallow` is a prefix match.

- [ ] **Step 2: Find out whether part B's id functions exist**

Decision 55 orders the stages B, then C, so expect part B to have landed. Run: `grep -nE "export async function (getRequestIds|getHubPostIds)" lib/data/index.ts`

- Both lines printed: part B has landed. Use **variant A** in Step 11.
- Nothing printed: part B hasn't landed. Use **variant B** in Step 11, and write down "part B must add its ids to the sitemap" for Task 10 (the checklist row, and the diff in Step 11's last paragraph).
- Only one line printed: stop and report. Part B is half done and the right move is Lama's.

- [ ] **Step 3: Change the og:image checks first (they should fail)**

In `tests/e2e/listing.spec.ts`, in the test "each listing has a share card for link previews", replace these five lines:

```ts
  // Without a metadataBase the card's URL names another port, so fetch its path from the test server
  // (setting metadataBase is on the go-live checklist). The same gap makes the browser add a second
  // og:image after hydration (it resolves against the page's own origin), so read the first, which is
  // the one in the server's HTML and the one a link preview sees.
  const card = new URL((await page.locator('meta[property="og:image"]').first().getAttribute("content"))!);
```

with:

```ts
  // metadataBase comes from NEXT_PUBLIC_SITE_URL (http://localhost:3000 when it isn't set), so the card's address is
  // absolute, and in this test it names another port: fetch its path from the test server. There is one og:image, in
  // the server's HTML and after hydration alike (before metadataBase the browser added a second one).
  await page.waitForLoadState("networkidle");
  const images = page.locator('meta[property="og:image"]');
  await expect(images).toHaveCount(1);
  const content = (await images.getAttribute("content"))!;
  expect(content).toMatch(/^https?:\/\//);
  const card = new URL(content);
```

In `tests/e2e/shopping.spec.ts`, in the seller share card test, replace these three lines:

```ts
    // As on the listing page: without a metadataBase the card's URL names another port, and the browser adds a
    // second og:image after hydration, so read the first (the server's) and fetch its path from the test server.
    const cardUrl = new URL((await page.locator('meta[property="og:image"]').first().getAttribute("content"))!);
```

with:

```ts
    // As on the listing page: metadataBase makes the card's address absolute, so there is one og:image, and its
    // address names the site's own origin. Fetch its path from the test server.
    await page.waitForLoadState("networkidle");
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    const cardUrl = new URL((await page.locator('meta[property="og:image"]').getAttribute("content"))!);
```

If either block isn't there as quoted (another part changed it), stop and report.

Run: `pnpm e2e tests/e2e/listing.spec.ts tests/e2e/shopping.spec.ts -g "share card" --project=desktop-1440`
Expected: FAIL on `toHaveCount(1)`, with 2 `og:image` tags after hydration. If both pass, the duplicate was already gone: carry on, and say so in the commit message and in Task 10's decisions row.

- [ ] **Step 4: Write siteUrl's test**

Create `lib/site-url.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_URL, siteUrl } from "./site-url";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl (info and system spec 2.7)", () => {
  it("falls back to the local server when nothing is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    expect(siteUrl()).toBe("http://localhost:3000");
    expect(DEFAULT_SITE_URL).toBe("http://localhost:3000");
  });

  it("treats a blank value as unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(siteUrl()).toBe(DEFAULT_SITE_URL);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "   ");
    expect(siteUrl()).toBe(DEFAULT_SITE_URL);
  });

  it("returns the site's origin, without a trailing slash, a path or a query", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vossie.example/");
    expect(siteUrl()).toBe("https://vossie.example");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.vossie.example/some/page?x=1");
    expect(siteUrl()).toBe("https://www.vossie.example");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", " http://localhost:3200 ");
    expect(siteUrl()).toBe("http://localhost:3200");
  });

  it("refuses a value that isn't a web address, so a typo can't ship wrong share cards", () => {
    for (const bad of ["vossie.example", "localhost:3000", "ftp://vossie.example", "javascript:alert(1)", "https://"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", bad);
      expect(() => siteUrl(), bad).toThrow(/NEXT_PUBLIC_SITE_URL must be a web address/);
    }
  });
});
```

Run: `pnpm test lib/site-url.test.ts`
Expected: FAIL, because `./site-url` doesn't exist.

- [ ] **Step 5: Write siteUrl**

Create `lib/site-url.ts`:

```ts
/** Where the site is served from when nothing says otherwise: the local server. */
export const DEFAULT_SITE_URL = "http://localhost:3000";

/**
 * The address the site is served from, as an origin with no trailing slash (info and system spec 2.7). It comes from
 * NEXT_PUBLIC_SITE_URL, which Next reads when it builds, so the host needs it in its build environment. `metadataBase`,
 * `robots.txt` and the sitemap all start from this, so none of them writes a domain.
 *
 * Unset or blank means the local server. Anything else must be an http or https address: a typo such as
 * "vossie.co.za" would otherwise quietly give every share card and sitemap entry a wrong address, so it stops the
 * build instead (plan decision 11).
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    // Not an address at all: handled below, with the same message as a wrong scheme.
  }
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
    throw new Error(`NEXT_PUBLIC_SITE_URL must be a web address such as https://vossie.example, but it is "${raw}"`);
  }
  return url.origin;
}
```

Run: `pnpm test lib/site-url.test.ts`
Expected: PASS. (`new URL("https://")` throws, so it takes the same path.)

- [ ] **Step 6: Use it as the layout's `metadataBase`**

In `app/layout.tsx`:

1. Add the import `import { siteUrl } from "@/lib/site-url";` on the line before `import { fontVariables } from "./fonts";`.
2. Replace `export const metadata: Metadata = {` with:

```tsx
export const metadata: Metadata = {
  // The base of every relative address in metadata, such as the share cards' (info and system spec 2.7).
  metadataBase: new URL(siteUrl()),
```

(The `title` object that follows stays as it is.)

Run: `pnpm e2e tests/e2e/listing.spec.ts tests/e2e/shopping.spec.ts -g "share card" --project=desktop-1440`
Expected: PASS. One `og:image`, absolute, and its path answers 200 with `image/png` from the test server. If the count is still 2, stop and report: spec 2.7's claim that `metadataBase` fixes the duplicate needs another look.

- [ ] **Step 7: Let the example env file be committed**

`.gitignore` ignores `.env*`, so the example file would be ignored too (plan decision 13). In `.gitignore`, replace

```
# env files (can opt-in for committing if needed)
.env*
```

with:

```
# env files (can opt-in for committing if needed)
.env*
!.env.example
```

Create `.env.example`:

```
# The address the live site is served from, with no path. It becomes the base of share-card, robots.txt and sitemap
# addresses (lib/site-url.ts). Next reads it when it builds, so set it in the host's build environment too, not only at
# run time. Leave it unset while developing: it falls back to http://localhost:3000.
# NEXT_PUBLIC_SITE_URL=https://vossie.example
```

Run: `git check-ignore -v .env.example`
Expected: it prints nothing (the file is no longer ignored). `git status --short` now lists `.env.example`.

- [ ] **Step 8: Write the sitemap entries' test**

Create `lib/sitemap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sitemapEntries, STATIC_PATHS } from "./sitemap";

const BASE = "https://vossie.example";
const SOURCES = {
  listingIds: ["l-001", "fs-002"],
  sellerSlugs: ["tech-corner", "res-deals"],
  collectionSlugs: ["exam-season"],
};

const paths = (entries: ReturnType<typeof sitemapEntries>) => entries.map((entry) => new URL(entry.url).pathname);

describe("sitemapEntries (info and system spec 2.8)", () => {
  it("starts with the pages that have no id in their address, as absolute addresses", () => {
    const entries = sitemapEntries(BASE, SOURCES);
    expect(entries.slice(0, STATIC_PATHS.length).map((entry) => entry.url)).toEqual([
      "https://vossie.example/",
      "https://vossie.example/browse",
      "https://vossie.example/looking-for",
      "https://vossie.example/hub",
      "https://vossie.example/how-it-works",
      "https://vossie.example/safety",
      "https://vossie.example/trust",
      "https://vossie.example/privacy",
      "https://vossie.example/terms",
      "https://vossie.example/seller-guidelines",
    ]);
  });

  it("lists every collection, seller and listing", () => {
    expect(paths(sitemapEntries(BASE, SOURCES)).slice(STATIC_PATHS.length)).toEqual([
      "/collections/exam-season",
      "/sellers/tech-corner",
      "/sellers/res-deals",
      "/listings/l-001",
      "/listings/fs-002",
    ]);
  });

  it("adds Looking For requests and Hub posts when it is given them, and not otherwise", () => {
    const without = paths(sitemapEntries(BASE, SOURCES));
    expect(without.some((path) => path.startsWith("/looking-for/") || path.startsWith("/hub/"))).toBe(false);
    const withThem = paths(sitemapEntries(BASE, { ...SOURCES, requestIds: ["r-001"], hubPostIds: ["h-001", "h-002"] }));
    expect(withThem.slice(-3)).toEqual(["/looking-for/r-001", "/hub/h-001", "/hub/h-002"]);
  });

  it("never lists a page that belongs to one person or one device", () => {
    const listed = paths(sitemapEntries(BASE, SOURCES));
    for (const path of ["/saved", "/login", "/account", "/sell"]) expect(listed).not.toContain(path);
  });

  it("lists each address once", () => {
    const listed = paths(sitemapEntries(BASE, { ...SOURCES, requestIds: ["r-001"], hubPostIds: ["h-001"] }));
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("carries no last-modified time, which would need the clock while prerendering", () => {
    for (const entry of sitemapEntries(BASE, SOURCES)) expect(entry).not.toHaveProperty("lastModified");
  });
});
```

Run: `pnpm test lib/sitemap.test.ts`
Expected: FAIL, because `./sitemap` doesn't exist.

- [ ] **Step 9: Write the sitemap entries**

Create `lib/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";

/**
 * The pages with no id in their address (info and system spec 2.8), in the order they appear. Saved, sign-in, the
 * account pages and the selling pages are left out on purpose: they belong to one person or one device.
 */
export const STATIC_PATHS = [
  "/",
  "/browse",
  "/looking-for",
  "/hub",
  "/how-it-works",
  "/safety",
  "/trust",
  "/privacy",
  "/terms",
  "/seller-guidelines",
] as const;

type SitemapSources = {
  listingIds: readonly string[];
  sellerSlugs: readonly string[];
  collectionSlugs: readonly string[];
  /** Part B: the Looking For requests. Left out until that part exists. */
  requestIds?: readonly string[];
  /** Part B: the Hub's posts. Left out until that part exists. */
  hubPostIds?: readonly string[];
};

/**
 * The sitemap's entries: the static pages, then every collection, seller and listing, then (when given) requests and
 * Hub posts. `base` is the site's origin (`siteUrl()`). There is no `lastModified`: it would need the clock while
 * prerendering, and crawlers cope without it (plan decision 10).
 */
export function sitemapEntries(base: string, sources: SitemapSources): MetadataRoute.Sitemap {
  const paths = [
    ...STATIC_PATHS,
    ...sources.collectionSlugs.map((slug) => `/collections/${slug}`),
    ...sources.sellerSlugs.map((slug) => `/sellers/${slug}`),
    ...sources.listingIds.map((id) => `/listings/${id}`),
    ...(sources.requestIds ?? []).map((id) => `/looking-for/${id}`),
    ...(sources.hubPostIds ?? []).map((id) => `/hub/${id}`),
  ];
  return paths.map((path) => ({ url: new URL(path, base).href }));
}
```

Run: `pnpm test lib/sitemap.test.ts`
Expected: PASS.

- [ ] **Step 10: Write robots.txt, test first**

Create `app/robots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/site-url";
import robots from "./robots";

/** Does a robots.txt path pattern block `path`? Patterns match from the start; `*` is anything, a final `$` is the end. */
function blocks(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

describe("robots.txt (info and system spec 2.8)", () => {
  const { rules, sitemap } = robots();
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = [rule.disallow ?? []].flat();
  const blocked = (path: string) => disallow.some((pattern) => blocks(pattern, path));

  it("lets every crawler in", () => {
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
  });

  it("keeps crawlers off Saved, sign-in, the account pages and the selling pages", () => {
    for (const path of ["/saved", "/login", "/login?next=%2Flistings%2Fl-001", "/account", "/account/privacy", "/sell", "/sell/onboarding"]) {
      expect(blocked(path), path).toBe(true);
    }
  });

  it("doesn't catch pages that only start with the same letters (a bare /sell would hide every storefront)", () => {
    for (const path of ["/", "/browse", "/hub", "/looking-for", "/privacy", "/sellers/tech-corner", "/listings/l-001"]) {
      expect(blocked(path), path).toBe(false);
    }
  });

  it("doesn't advertise staff pages", () => {
    expect(disallow.join(" ")).not.toMatch(/admin|mentor|manage/);
  });

  it("points to the sitemap at the site's own address", () => {
    expect(sitemap).toBe(`${siteUrl()}/sitemap.xml`);
  });
});
```

Run: `pnpm test app/robots.test.ts`
Expected: FAIL, because `./robots` doesn't exist.

Create `app/robots.ts`:

```ts
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Pages that belong to one person or one device (info and system spec 2.8). A Disallow matches from the start of the
// address, so a bare "/sell" would also hide every storefront at /sellers/…; `$` ends a pattern, so "/sell$" is the
// pitch page and "/sell/" is everything under it (plan decision 8). Staff pages aren't listed: naming them would
// advertise them, and they answer 404 to everyone else (staff tools decision 1).
const DISALLOWED = ["/saved", "/login", "/account", "/sell$", "/sell/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOWED },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
```

Run: `pnpm test app/robots.test.ts`
Expected: PASS.

- [ ] **Step 11: Write the sitemap route, test first**

Create `app/sitemap.test.ts`. **Variant A** (Step 2 found both functions):

```ts
import { describe, expect, it } from "vitest";
import {
  getCollections,
  getHubPostIds,
  getListingIds,
  getRequestIds,
  getSellerSlugs,
} from "@/lib/data";
import { siteUrl } from "@/lib/site-url";
import sitemap from "./sitemap";

describe("sitemap.xml (info and system spec 2.8)", () => {
  it("lists every listing, seller and collection at the site's own address", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const id of await getListingIds()) expect(urls).toContain(`${siteUrl()}/listings/${id}`);
    for (const slug of await getSellerSlugs()) expect(urls).toContain(`${siteUrl()}/sellers/${slug}`);
    for (const collection of await getCollections()) expect(urls).toContain(`${siteUrl()}/collections/${collection.slug}`);
  });

  it("lists every Looking For request and Hub post", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const id of await getRequestIds()) expect(urls).toContain(`${siteUrl()}/looking-for/${id}`);
    for (const id of await getHubPostIds()) expect(urls).toContain(`${siteUrl()}/hub/${id}`);
  });

  it("lists the info pages, and each address once", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const path of ["/how-it-works", "/safety", "/trust", "/privacy", "/terms", "/seller-guidelines"]) {
      expect(urls).toContain(`${siteUrl()}${path}`);
    }
    expect(new Set(urls).size).toBe(urls.length);
  });
});
```

**Variant B** (Step 2 found neither): the same file without the `getRequestIds`/`getHubPostIds` imports and without the middle test.

Run: `pnpm test app/sitemap.test.ts`
Expected: FAIL, because `./sitemap` doesn't exist.

Create `app/sitemap.ts`. **Variant A:**

```ts
import type { MetadataRoute } from "next";
import { getCollections, getHubPostIds, getListingIds, getRequestIds, getSellerSlugs } from "@/lib/data";
import { siteUrl } from "@/lib/site-url";
import { sitemapEntries } from "@/lib/sitemap";

/** Every public page (info and system spec 2.8). A cached route handler: the data functions are cached too. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listingIds, sellerSlugs, collections, requestIds, hubPostIds] = await Promise.all([
    getListingIds(),
    getSellerSlugs(),
    getCollections(),
    getRequestIds(),
    getHubPostIds(),
  ]);
  return sitemapEntries(siteUrl(), {
    listingIds,
    sellerSlugs,
    collectionSlugs: collections.map((collection) => collection.slug),
    requestIds,
    hubPostIds,
  });
}
```

**Variant B:**

```ts
import type { MetadataRoute } from "next";
import { getCollections, getListingIds, getSellerSlugs } from "@/lib/data";
import { siteUrl } from "@/lib/site-url";
import { sitemapEntries } from "@/lib/sitemap";

/** Every public page (info and system spec 2.8). A cached route handler: the data functions are cached too. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listingIds, sellerSlugs, collections] = await Promise.all([getListingIds(), getSellerSlugs(), getCollections()]);
  return sitemapEntries(siteUrl(), {
    listingIds,
    sellerSlugs,
    collectionSlugs: collections.map((collection) => collection.slug),
  });
}
```

Run: `pnpm test app/sitemap.test.ts lib/sitemap.test.ts`
Expected: PASS.

**If you used variant B, part B must finish the job when it lands.** Whoever lands part B's data functions (its final task, or the controller straight after) makes exactly these changes to `app/sitemap.ts`, and the matching ones to `app/sitemap.test.ts` (variant A above), then runs `pnpm test app/sitemap.test.ts`: import `getHubPostIds` and `getRequestIds` from `@/lib/data`; add `getRequestIds(), getHubPostIds()` to the `Promise.all` and to its destructuring (`requestIds, hubPostIds`); and pass `requestIds, hubPostIds` to `sitemapEntries`. `lib/sitemap.ts` already handles them. Task 10 writes this into the go-live checklist so it isn't forgotten.

- [ ] **Step 12: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build lists `/robots.txt` and `/sitemap.xml` as static routes. If the build fails with "used `new Date()`" or similar, something in `lib/sitemap.ts` or `app/sitemap.ts` reads the clock: remove it.

- [ ] **Step 13: Look at it**

Start the build (`pnpm start --port 3201`) and check:
- `curl -s localhost:3201/robots.txt` prints `User-Agent: *`, `Allow: /`, five `Disallow:` lines (`/saved`, `/login`, `/account`, `/sell$`, `/sell/`) and `Sitemap: http://localhost:3000/sitemap.xml` (or your `NEXT_PUBLIC_SITE_URL`).
- `curl -s localhost:3201/sitemap.xml` is XML with a `<loc>` for each static page, 4 collections, 29 sellers and every listing, and none for `/saved`, `/login`, `/account` or `/sell`.
- `curl -s localhost:3201/listings/l-001 | grep -o '<meta property="og:image"[^>]*>'` prints exactly one tag, with an absolute address.
- The head's manifest and icon links keep relative addresses such as `/manifest.webmanifest` and `/icon.png?…`: `curl -s localhost:3201/ | grep -oE '<link rel="(manifest|icon|apple-touch-icon)"[^>]*>'`. (`metadataBase` shouldn't touch them. If one now starts with `http`, report it: it would point installs at the wrong origin.)

Stop the server.

- [ ] **Step 14: Hand over for commit**

Files: `lib/site-url.ts`, `lib/site-url.test.ts`, `lib/sitemap.ts`, `lib/sitemap.test.ts`, `app/robots.ts`, `app/robots.test.ts`, `app/sitemap.ts`, `app/sitemap.test.ts`, `app/layout.tsx`, `.gitignore`, `.env.example`, `tests/e2e/listing.spec.ts`, `tests/e2e/shopping.spec.ts`.
Message: `feat: siteUrl and metadataBase, robots.txt and the sitemap (info and system spec 2.7, 2.8). One og:image per page now`

---

### Task 7: Security headers

Four headers on every response, plus HSTS in production (spec 2.9, plan decision 12). No Content Security Policy: it needs a nonce per request for Next's inline scripts, which would make every prerendered page dynamic. It goes on the go-live checklist instead.

**Files:**
- Modify: `next.config.ts`
- Create: `next.config.test.ts`

- [ ] **Step 1: Read the docs**

Read `headers.md` in `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/`. Note that `source: "/:path*"` matches every path, and that a later rule would override an earlier one for the same key.

- [ ] **Step 2: Write the test**

Create `next.config.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "./next.config";

afterEach(() => vi.unstubAllEnvs());

/** The headers sent on every path, by name. */
async function sitewideHeaders(): Promise<Record<string, string>> {
  const rules = await nextConfig.headers!();
  const rule = rules.find((item) => item.source === "/:path*");
  return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]));
}

describe("security headers (info and system spec 2.9)", () => {
  it("sends the four headers on every path", async () => {
    expect(await sitewideHeaders()).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("adds Strict-Transport-Security in production only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await sitewideHeaders()).not.toHaveProperty("Strict-Transport-Security");
    vi.stubEnv("NODE_ENV", "production");
    expect(await sitewideHeaders()).toHaveProperty("Strict-Transport-Security", "max-age=31536000");
  });

  it("sets no Content-Security-Policy yet (it needs a nonce per request; see the go-live checklist)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await sitewideHeaders()).not.toHaveProperty("Content-Security-Policy");
  });

  it("keeps the redirects it already had", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects.map((redirect) => redirect.source)).toEqual(
      expect.arrayContaining(["/categories/:slug", "/c/:campus"]),
    );
  });
});
```

Run: `pnpm test next.config.test.ts`
Expected: FAIL, because `nextConfig.headers` isn't defined (calling it throws).

- [ ] **Step 3: Add the headers**

In `next.config.ts`, add this block immediately before the comment that starts `// Always build from scratch.`:

```ts
  // Security headers on every response (info and system spec 2.9). There is no Content Security Policy yet: it needs a
  // nonce per request for Next's inline scripts, which would make every prerendered page dynamic (go-live checklist).
  // Strict-Transport-Security is for production only, so a development server on http doesn't send it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
    ];
  },
```

Run: `pnpm test next.config.test.ts`
Expected: PASS.

- [ ] **Step 4: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass.

- [ ] **Step 5: Look at it**

Start the build (`pnpm start --port 3201`) and run `curl -sI localhost:3201/` and `curl -sI localhost:3201/robots.txt`.
Expected: each prints `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `x-frame-options: DENY`, `permissions-policy: camera=(), microphone=(), geolocation=()` and `strict-transport-security: max-age=31536000`. Then click around the site in a browser at `localhost:3201`: the share button, "Add to home screen" help and the search overlay still work (nothing here uses the camera, microphone or location). Stop the server.

- [ ] **Step 6: Hand over for commit**

Files: `next.config.ts`, `next.config.test.ts`.
Message: `feat: security headers on every response, and Strict-Transport-Security in production (info and system spec 2.9)`

---

### Task 8: The error page, measured

A branded `app/error.tsx` (spec 2.6 and 4): the 404 page's frame, "Something went wrong", a Try again button and a Go home link. It is built, then measured, and dropped if it puts any page past the stop line. `app/global-error.tsx` stays Next's default, and `app/not-found.tsx` is unchanged.

**Files:**
- Create: `app/error.tsx`, `app/error.test.tsx`

If the stop rule fires, both files are removed again (Step 9, and approval 3 at the top of this plan), and the task hands over nothing to commit.

- [ ] **Step 1: Read the docs**

Read `error.md` in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/`. Note: error boundaries must be client components; the component receives `error`, `reset` and `retry`; `retry` (stable since 16.3) fetches the page again, `reset` only re-renders the boundary's children without fetching (plan decision 1); `error.tsx` doesn't wrap the root layout (that's `global-error.tsx`, which stays default).

Remember what happened last time (decision 46): a branded `app/global-error.tsx` added 207 B to every page, because Next's default error UI stays in the framework chunk and the branded one was extra. `app/error.tsx` is a different file and may behave differently, which is why it is measured and not assumed.

- [ ] **Step 2: Measure the starting point**

Read `docs/PROGRESS.md` and the decisions log for the newest JS figure Lama has accepted (decision 52: 152,305 B; decision 53: the listing page at 152,209 B), and write the stop line you will use in the ledger. Check that `app/error.tsx` doesn't exist: `ls app/error.tsx` should say there is no such file. If it exists, stop and ask.

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: all pass. Write `/`, `/browse` and the listing page's `scriptBrotli` in the ledger's "Task 8, before" row.

If any of the three is already past the stop line, do not create the files. Skip to Step 10, and report that the error page can't be added until Lama moves the line.

- [ ] **Step 3: Write the error page's test**

Create `app/error.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";
import NotFound from "./not-found";

/** What Next gives the page: the error (its message can name a server or a query) and the two recovery functions. */
function props() {
  const error = Object.assign(new Error("connect ECONNREFUSED db.internal:5432"), { digest: "8123456789" });
  return { error, reset: vi.fn(), retry: vi.fn() };
}

describe("the error page (info and system spec 4)", () => {
  it("says what happened in plain words, with a way to try again and a way home", () => {
    render(<ErrorPage {...props()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText("It's not you. Try again, or head back home.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
  });

  it("asks Next to fetch the page afresh when you try again (plan decision 1)", async () => {
    const user = userEvent.setup();
    const given = props();
    render(<ErrorPage {...given} />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(given.retry).toHaveBeenCalledTimes(1);
    expect(given.reset).not.toHaveBeenCalled();
  });

  it("never shows the error's message, stack or digest", () => {
    const { container } = render(<ErrorPage {...props()} />);
    expect(container).not.toHaveTextContent("ECONNREFUSED");
    expect(container).not.toHaveTextContent("db.internal");
    expect(container).not.toHaveTextContent("8123456789");
  });

  it("wears the 404 page's frame, so the two look like one family", () => {
    const notFound = render(<NotFound />).container;
    const failed = render(<ErrorPage {...props()} />).container;
    const classes = (root: HTMLElement, selector: string) => root.querySelector(selector)?.className;
    for (const selector of ["section", ".eyebrow", "h1", "section > p:not(.eyebrow)", "section > div", ".btn-primary", ".btn-outline"]) {
      expect(classes(failed, selector), selector).toBeTruthy();
      expect(classes(failed, selector), selector).toBe(classes(notFound, selector));
    }
  });
});
```

- [ ] **Step 4: Run it to make sure it fails**

Run: `pnpm test app/error.test.tsx`
Expected: FAIL, because `./error` doesn't exist.

- [ ] **Step 5: Write the error page**

Create `app/error.tsx`:

```tsx
"use client";

import Link from "next/link";

type ErrorPageProps = {
  /** Never shown: its message and stack can name servers, queries or people (info and system spec 4). */
  error: Error & { digest?: string };
  reset: () => void;
  retry: () => void;
};

/**
 * What a failure shows (info and system spec 4): the 404 page's frame, a plain sentence, a way to try again and a way
 * home. "Try again" asks Next to fetch the page afresh (`retry`), which can fix a failure on the server; `reset` would
 * only show the same broken output again (plan decision 1). It has to be a client component, so it is kept small: no
 * hooks, no logging and no <title>, because it adds to every page's JavaScript (plan decision 14).
 */
export default function ErrorPage({ retry }: ErrorPageProps) {
  return (
    <section aria-labelledby="page-title" className="mx-auto w-full max-w-page px-4 pb-8 pt-16 wide:px-8 wide:pt-24">
      <p className="eyebrow">Unexpected error</p>
      <h1 id="page-title" className="mt-3 font-display text-section uppercase text-navy">
        Something went wrong
      </h1>
      <p className="mt-4 max-w-[60ch] text-muted">It&apos;s not you. Try again, or head back home.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-outline text-navy">
          Go home
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Run it to make sure it passes**

Run: `pnpm test app/error.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass. The build output now lists the error boundary among the app's files; nothing else changes.

- [ ] **Step 8: Measure with the error page in**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Write `/`, `/browse` and the listing page's `scriptBrotli` in the ledger's "Task 8, with the error page" row, and the difference from the "before" row for each page.

- [ ] **Step 9: Apply the stop rule (spec 2.6)**

- **All three pages are at or under the stop line:** the error page stays. The test run must also have passed: the performance test fails above 153,600 B. Go to Step 11.
- **Any of the three is past the stop line:** drop the error page. Don't try to trim it to fit; whether to accept the bytes is Lama's call, so report the figures. First check what's there, as its own step: `ls app/error.tsx app/error.test.tsx`. Then remove exactly these two files, which this task created and nothing has committed (approval 3): `rm app/error.tsx app/error.test.tsx`. Then run `pnpm test` (it should pass without them) and `git status --short` (neither file should appear, and nothing else should have changed). Go to Step 10.

- [ ] **Step 10: If it was dropped, or never started**

Write "dropped" in the ledger with the figures that made the rule fire (or "not started: `/` was already past the line"). There is nothing to commit. Tell the controller the error page was dropped under spec 2.6, with the numbers, so Task 10 can record it in the decisions log, the go-live checklist and the spec. Skip Step 11.

- [ ] **Step 11: Hand over for commit (error page kept)**

There's no end-to-end test for the error page: no route fails on purpose, and a test-only route would ship (plan decision 14). Its frame is pinned to the 404 page's by the unit test, and Task 10's screenshots show the 404 page.

Files: `app/error.tsx`, `app/error.test.tsx`.
Message: `feat: a branded error page (info and system spec 4). JS: / <n> B, browse <n> B, listing <n> B`

---

### Task 9: End-to-end, accessibility and layout-shift checks

The pages exist, so these tests check them in a real browser at five sizes (spec 7): each page, its contents list, the footer, the homepage's trust links, `robots.txt`, the sitemap and the headers; then axe on every page and layout shift on the longest ones.

**Files:**
- Create: `tests/e2e/info.spec.ts`, `tests/e2e/system.spec.ts`
- Modify: `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`

- [ ] **Step 1: Write the info pages' end-to-end tests**

Create `tests/e2e/info.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

const width = (page: Page) => page.viewportSize()?.width ?? 0;

type InfoCase = { path: string; title: string; draft: boolean; sections: string[] };

const PAGES: readonly InfoCase[] = [
  {
    path: "/how-it-works",
    title: "How Vossie works",
    draft: false,
    sections: ["Buying", "Selling", "Trust, in one paragraph", "Questions and answers"],
  },
  {
    path: "/safety",
    title: "Safety",
    draft: false,
    sections: ["Meeting safely", "Checking before you pay", "Paying safely", "Signs of a scam", "Reporting a problem"],
  },
  {
    path: "/trust",
    title: "How trust works",
    draft: false,
    sections: ["Verified by the Hub", "The three badges", "What counts", "How Featured today is picked"],
  },
  {
    path: "/privacy",
    title: "Privacy policy",
    draft: true,
    sections: [
      "Who is responsible",
      "What this site stores today",
      "When sign-in arrives",
      "How long we keep it",
      "Who it is shared with",
      "Where it is hosted",
      "Your rights",
      "Contact the Hub",
      "Changes to this policy",
    ],
  },
  {
    path: "/terms",
    title: "Terms of use",
    draft: true,
    sections: [
      "Who can use Vossie",
      "Vossie is not part of your deal",
      "What you can't do",
      "What you post",
      "Moderation and suspension",
      "Our responsibility",
      "Changes and the law",
    ],
  },
  {
    path: "/seller-guidelines",
    title: "Seller guidelines",
    draft: true,
    sections: [
      "Who can sell",
      "What can't be sold",
      "Honest listings and photos",
      "Prices and swaps",
      "Replying within 48 hours",
      "Meeting buyers",
      "After a report",
    ],
  },
];

test.describe("the info and legal pages (spec 3)", () => {
  for (const { path, title, draft, sections } of PAGES) {
    test(`${path} has its heading, tab title and sections, and ${draft ? "a draft banner" : "no banner"}`, async ({ page }) => {
      onlyAt("phone-390", "desktop-1440");
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page).toHaveTitle(`${title} · Vossie`);
      await expect(page.locator("main .info-body h2")).toHaveText(sections);
      await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link")).toHaveText(sections);
      await expect(page.getByText("Coming in the next stage")).toHaveCount(0);
      if (draft) {
        await expect(page.getByRole("note")).toHaveText("Draft for Eduvos to review. Not yet in force.");
      } else {
        await expect(page.getByRole("note")).toHaveCount(0);
      }
    });
  }

  test("the contents list sits under the lede on phones and tablets, and beside the text on desktop (spec 2.5)", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const toc = (await page.locator(".info-toc").boundingBox())!;
    const body = (await page.locator(".info-body").boundingBox())!;
    if (width(page) >= 1024) {
      expect(toc.x + toc.width).toBeLessThanOrEqual(body.x);
      expect(Math.abs(toc.y - body.y)).toBeLessThan(40);
    } else {
      expect(toc.y + toc.height).toBeLessThanOrEqual(body.y);
      // The row of pills scrolls inside itself.
      const row = await page.locator(".info-toc ol").evaluate((list) => list.scrollWidth - list.clientWidth);
      expect(row).toBeGreaterThan(0);
    }
    // About 65 characters a line, whatever the screen.
    expect(body.width).toBeLessThanOrEqual(700);
    // The page itself never scrolls sideways.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("a contents link jumps to its section", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/safety");
    await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Signs of a scam" }).click();
    await expect(page).toHaveURL(/\/safety#safety-scams$/);
    await expect(page.getByRole("heading", { level: 2, name: "Signs of a scam" })).toBeInViewport();
  });

  test("the pages link to each other", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/safety");
    await page.locator("main").getByRole("link", { name: "how trust works", exact: true }).click();
    await expect(page).toHaveURL(/\/trust$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How trust works");

    await page.goto("/how-it-works");
    await page.locator("main").getByRole("link", { name: "seller guidelines", exact: true }).click();
    await expect(page).toHaveURL(/\/seller-guidelines$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Seller guidelines");

    await page.goto("/terms");
    await page.locator("main").getByRole("link", { name: "safety guide", exact: true }).click();
    await expect(page).toHaveURL(/\/safety$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Safety");
  });
});

test.describe("the footer reaches the info and legal pages (spec 2.11)", () => {
  const LINKS: ReadonlyArray<[name: string, href: string, group: "Sell" | "Help"]> = [
    ["Seller guidelines", "/seller-guidelines", "Sell"],
    ["How trust works", "/trust", "Help"],
    ["Terms of use", "/terms", "Help"],
    ["Privacy (POPIA)", "/privacy", "Help"],
  ];

  for (const [name, href, group] of LINKS) {
    test(`${name} opens ${href}`, async ({ page }) => {
      onlyAt("phone-390", "desktop-1440");
      await page.goto("/");
      const footer = page.getByRole("contentinfo");
      // On phones the link groups are folded.
      if (width(page) < 768) {
        await footer.locator("summary.footer-summary", { hasText: new RegExp(`^${group}$`) }).click();
      }
      await footer.getByRole("link", { name, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
    });
  }

  test("no footer link wraps onto a second line at 1280 or 1440 (decision 32)", async ({ page }) => {
    onlyAt("desktop-1440");
    for (const wide of [1280, 1440]) {
      await page.setViewportSize({ width: wide, height: 900 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const heights = await page
        .locator(".footer-links:not(.footer-links-columns) a:visible")
        .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().height)));
      expect(heights.length).toBeGreaterThan(10);
      expect(Math.max(...heights), `tallest footer link at ${wide}px`).toBeLessThanOrEqual(46);
    }
  });
});

test.describe("the homepage's trust links (spec 2.3)", () => {
  test("How trust works, under the hero, opens the trust page", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await page
      .getByRole("region", { name: "Why you can trust Vossie" })
      .getByRole("link", { name: "How trust works" })
      .click();
    await expect(page).toHaveURL(/\/trust$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How trust works");
  });

  test("How we pick, on Featured today, opens that part of the trust page", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    const link = page.locator("#featured").getByRole("link", { name: "How we pick featured sellers" });
    await expect(link).toHaveAttribute("href", "/trust#trust-featured");
    await link.click();
    await expect(page).toHaveURL(/\/trust#trust-featured$/);
    await expect(page.getByRole("heading", { level: 2, name: "How Featured today is picked" })).toBeInViewport();
  });
});
```

- [ ] **Step 2: Write the system tests**

Create `tests/e2e/system.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

test.describe("robots.txt and the sitemap (info and system spec 2.8)", () => {
  test("robots.txt lets crawlers in, keeps them off private pages and names the sitemap", async ({ request }) => {
    onlyAt("desktop-1440");
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    const lines = (await response.text()).split("\n");
    expect(lines).toContain("User-Agent: *");
    expect(lines).toContain("Allow: /");
    for (const path of ["/saved", "/login", "/account", "/sell$", "/sell/"]) {
      expect(lines).toContain(`Disallow: ${path}`);
    }
    // A bare "/sell" would also hide every /sellers/… storefront (plan decision 8).
    expect(lines).not.toContain("Disallow: /sell");
    expect(lines.some((line) => /^Sitemap: https?:\/\/\S+\/sitemap\.xml$/.test(line))).toBe(true);
  });

  test("the sitemap lists the public pages, listings, sellers and collections, and nothing private", async ({
    request,
  }) => {
    onlyAt("desktop-1440");
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    const paths = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
    for (const path of [
      "/",
      "/browse",
      "/looking-for",
      "/hub",
      "/how-it-works",
      "/safety",
      "/trust",
      "/privacy",
      "/terms",
      "/seller-guidelines",
      "/listings/l-001",
      "/sellers/tech-corner",
      "/collections/exam-season",
    ]) {
      expect(paths, path).toContain(path);
    }
    for (const path of ["/saved", "/login", "/account", "/sell"]) expect(paths, path).not.toContain(path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("the share card, robots.txt and the sitemap all name the same site (spec 2.7)", async ({ page, request }) => {
    onlyAt("desktop-1440");
    await page.goto("/listings/l-001");
    await page.waitForLoadState("networkidle");
    const images = page.locator('meta[property="og:image"]');
    await expect(images).toHaveCount(1);
    const origin = new URL((await images.getAttribute("content"))!).origin;
    expect(await (await request.get("/robots.txt")).text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
    expect(await (await request.get("/sitemap.xml")).text()).toContain(`<loc>${origin}/listings/l-001</loc>`);
  });
});

test.describe("security headers (info and system spec 2.9)", () => {
  test("every kind of response carries them, and none sets a Content-Security-Policy yet", async ({ request }) => {
    onlyAt("desktop-1440");
    for (const path of ["/", "/browse", "/listings/l-001", "/how-it-works", "/robots.txt", "/definitely-not-a-page"]) {
      const headers = (await request.get(path)).headers();
      expect(headers["x-content-type-options"], path).toBe("nosniff");
      expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(headers["x-frame-options"], path).toBe("DENY");
      expect(headers["permissions-policy"], path).toBe("camera=(), microphone=(), geolocation=()");
      expect(headers["strict-transport-security"], path).toBe("max-age=31536000");
      expect(headers["content-security-policy"], path).toBeUndefined();
    }
  });
});
```

- [ ] **Step 3: Add axe and layout-shift rows**

Append to the end of `tests/e2e/a11y.spec.ts`:

```ts
for (const path of ["/how-it-works", "/safety", "/trust", "/privacy", "/terms", "/seller-guidelines"]) {
  test(`the info page ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await seriousIssues(page)).toEqual([]);
  });
}

// The error page shares this frame, and no route fails on purpose, so this is its stand-in (plan decision 14).
test("the 404 page", async ({ page }) => {
  const response = await page.goto("/there-is-no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
  expect(await seriousIssues(page)).toEqual([]);
});
```

In `tests/e2e/cls.spec.ts`, add two rows to `PAGES`, right after the row `["listing page", "/listings/l-001"],` (use Edit on that line; leave the rest of the list as it is):

```ts
  ["how it works page", "/how-it-works"],
  ["privacy page", "/privacy"],
```

- [ ] **Step 4: Run them**

Run: `pnpm e2e tests/e2e/info.spec.ts tests/e2e/system.spec.ts`
Expected: all pass across the five sizes, with the tests that name sizes skipped at the others.

Run: `pnpm e2e tests/e2e/a11y.spec.ts tests/e2e/cls.spec.ts`
Expected: all pass. Note the layout-shift values for the two new rows at 390 and 1440 (the log prints `how it works page layout shift: …`) for `docs/PROGRESS.md`.

If axe reports a serious or critical issue, fix the cause in the component or CSS (not the test), and note it for the plan's "Changes made during the build". The likeliest candidates: the pills row (a scrollable region needs a focusable child, and has them), small text contrast in the draft banner, or the `code` boxes. If a page's layout shift is over 0.05, the log line names the moving nodes.

If the footer-wrapping test fails, stop and report as in Task 5, Step 5.

- [ ] **Step 5: Hand over for commit**

Files: `tests/e2e/info.spec.ts`, `tests/e2e/system.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`, and any component or CSS file a fix touched.
Message: `test: end-to-end, accessibility and layout-shift checks for the info and system pages`

---

### Task 10: Review screenshots, docs and final checks

**Files:**
- Modify: `tests/e2e/screenshots.spec.ts`
- Create: `docs/progress/info-system/*.png`
- Modify: `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `CLAUDE.md`, the spec (`docs/superpowers/specs/2026-10-14-info-and-system-pages-design.md`)
- Modify: this plan (the ledger and a "Changes made during the build" section)

- [ ] **Step 1: Check the docs are free to edit**

Other parts' docs tasks (part B's, for one) edit the same files. Run `git status --short`.
Expected: `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md` and `CLAUDE.md` are not listed as modified. If they are, someone else's docs edit hasn't been committed: stop and ask the controller to commit that first, so the two sets of edits don't mix.

Then read the current text of each file before editing it. Other parts have changed these files since this plan was written, so each edit below is anchored on the exact line it quotes; if a quoted line has changed, adapt the edit to the new wording and say so in "Changes made during the build".

- [ ] **Step 2: Add the review screenshots**

Add to the end of `tests/e2e/screenshots.spec.ts`:

```ts
test("info and system review screenshots", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/info-system/${project}-${name}.png`;

  await page.emulateMedia({ reducedMotion: "reduce" });
  const title = page.getByRole("heading", { level: 1 });
  const fontsIn = () => page.evaluate(() => document.fonts.ready.then(() => undefined));

  const pages: Array<[name: string, path: string]> = [
    ["01-how-it-works", "/how-it-works"],
    ["02-safety", "/safety"],
    ["03-trust", "/trust"],
    ["04-privacy", "/privacy"],
    ["05-terms", "/terms"],
    ["06-seller-guidelines", "/seller-guidelines"],
  ];
  for (const [name, path] of pages) {
    await page.goto(path);
    await expect(title).toBeVisible();
    await fontsIn();
    await page.screenshot({ path: file(name), fullPage: true });
  }

  // The first screen of a draft page, where the banner and the contents list sit.
  await page.goto("/privacy");
  await expect(title).toBeVisible();
  await fontsIn();
  await page.screenshot({ path: file("07-privacy-first-screen") });

  // The error page shares this frame and can't be reached on purpose (plan decision 14).
  await page.goto("/there-is-no-such-page");
  await expect(title).toHaveText("We couldn't find that page");
  await page.screenshot({ path: file("08-not-found") });
});
```

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "info and system review screenshots"`
Expected: 16 PNGs in `docs/progress/info-system/`. Open a few and check they show what their names say: the draft banner is visible in `04-privacy`, `05-terms`, `06-seller-guidelines` and `07-privacy-first-screen`; the contents list is a row of pills at 390 and a left column at 1440.

- [ ] **Step 3: Bring the spec in line with the build**

In `docs/superpowers/specs/2026-10-14-info-and-system-pages-design.md`, make these edits (each quoted text appears once):

1. Before the line starting `- **Scope:** part C`, add:
`- **Built:** 2026-10-<day>, as `docs/superpowers/plans/2026-10-14-info-and-system-pages.md` describes. Where the build differs from this spec, the text below now says so.`

2. In decision 8, replace
`**Robots:** everything is crawlable except `/saved`, `/login`, `/account` and `/sell`.`
with
`**Robots:** everything is crawlable except `/saved`, `/login`, `/account` and `/sell`. A `Disallow` matches a prefix, so the file says `/sell$` and `/sell/`, which keeps `/sellers/…` crawlable. Staff pages aren't listed, because naming them would advertise them.`

3. In decision 11, replace
`"Seller safety" in the Sell column points to `/seller-guidelines`.`
with
`"Seller safety" in the Sell column became "Seller guidelines" and points to `/seller-guidelines`. Featured today's "How we pick" link points to `/trust#trust-featured`.`

4. In the `/trust` row of the table in section 3, replace
`what doesn't count (WhatsApp leads, sales the buyer didn't confirm)`
with
`what doesn't count (chats outside Vossie, such as on WhatsApp, and a sale the buyer says didn't happen; a sale counts once the buyer confirms it or a week after the seller marks it done, as the messaging spec says)`

5. In section 4, replace
`a **Try again** button (calls `reset()`)`
with
`a **Try again** button (calls `retry()`, which fetches the page again; `reset()` would only show the same output)`

6. At the end of section 4, add a bullet:
`- **Outcome:** <Built. It added <n> B to `/`, <n> B to `/browse` and <n> B to the listing page, and every page stays under the stop line (<n> B). OR: Dropped. With it, <page> reached <n> B, past the stop line (<n> B), so Next's default error page stays (decision <n>).>`
Write whichever is true, with the real numbers from Task 8's ledger rows.

- [ ] **Step 4: Log the decisions**

In `docs/reference/LANDING-DECISIONS.md`, add rows after the last row of the table (read the last row's number first and continue from it; the examples below call them `N`, `N+1` and so on). Use the date 2026-10-14 and the table's style. Keep Task 8's row to whichever of the two versions is true.

```markdown
| N | 2026-10-14 | Legal pages before Eduvos signs them off | **The privacy policy, terms of use and seller guidelines ship as clearly marked drafts** ("Draft for Eduvos to review. Not yet in force."), and the Information Officer is "to be named by Eduvos", never a made-up person | The privacy policy describes this stage truthfully (two first-party cookies, three browser-only stores, nothing stored on a server) and has a "When sign-in arrives" section listing what accounts will collect and why, so it needn't be rewritten. A test ties the page to the real cookie and storage names. Eduvos's legal team owns the final wording; the claims they are asked to confirm are plan decision 17 in `2026-10-14-info-and-system-pages.md`. Spec `2026-10-14-info-and-system-pages-design.md` decisions 1 and 2. Claude, under decision 54 |
| N+1 | 2026-10-14 | Trust, and the shape of the info pages | **One trust page, `/trust`,** explains Verified, the three badges (New seller, Responsive, Trusted) and how Featured today is picked, as how it will work once accounts are live. **Every info page shares one frame, `InfoPage`** | Top Hustler isn't in this build. The rules are the old demo's (`FUNCTION-MAP.md` section 6). The homepage's "How trust works" and "How we pick" links go there. Spec decisions 3, 4, 5 and 11. Claude, under decision 54 |
| N+2 | 2026-10-14 | The site's address, robots.txt, the sitemap and security headers | **The site's address comes from `NEXT_PUBLIC_SITE_URL`** (`lib/site-url.ts`, falling back to `http://localhost:3000`) and is the `metadataBase`, so each page has one absolute `og:image`. **robots.txt** blocks `/saved`, `/login`, `/account`, `/sell$` and `/sell/`. The **sitemap** lists the public pages. **Headers:** `nosniff`, a strict referrer policy, `X-Frame-Options: DENY`, camera, microphone and location off, and HSTS for a year in production. **No Content Security Policy yet, and no offline page** | A bare `/sell` would also have hidden every `/sellers/…` storefront. Staff pages aren't listed. A CSP needs a nonce per request for Next's inline scripts, which would make every prerendered page dynamic; the offline page needs a service worker. Both are on the go-live checklist. Spec decisions 7 to 10. Claude, under decision 54 |
| N+3 | 2026-10-14 | The branded error page | **Built (`app/error.tsx`).** It adds <n> B to `/`, <n> B to `/browse` and <n> B to the listing page, and every page stays under the stop line (<n> B). `app/global-error.tsx` stays Next's default | "Try again" calls `retry()`, which fetches the page again. Spec decision 6. Claude, under decision 54 |
| N+4 | 2026-10-14 | Info and system plan decisions that go beyond the spec | **"Try again" calls `retry()`; the footer's "Seller safety" is now "Seller guidelines"; Featured today's "How we pick" opens `/trust#trust-featured`; the trust page counts a sale the buyer confirms, or leaves unconfirmed for a week (the messaging spec's rule), not "sales the buyer didn't confirm"; robots uses `/sell$` and `/sell/`** | Plan decisions 1, 6, 7, 8 and 16 in `2026-10-14-info-and-system-pages.md`. The spec now says so. Lama accepted the plan, which listed them |
```

If the error page was dropped, replace the `N+3` row with:

```markdown
| N+3 | 2026-10-14 | The branded error page | **Not built.** With it, <page> reached <n> B, past the stop line (<n> B), so it was dropped as spec decision 6 says, and Next's default error page stays | As with the global error page in decision 46: a client component referenced from the root layout adds to every page, and the listing page has little room. Revisit if a later change frees the bytes. Claude, under decision 54 |
```

- [ ] **Step 5: Update the go-live checklist**

In `docs/reference/GO-LIVE.md` (read it first; each quoted line below was there on 2026-10-14):

1. Replace the row
`| How it works, Safety, Privacy policy | `/how-it-works`, `/safety`, `/privacy` | Placeholder |`
with two rows:

```markdown
| How it works, Safety | `/how-it-works`, `/safety` | Built |
| Privacy policy | `/privacy` | Built as a draft; Eduvos signs off the wording |
```

2. Replace the row
`| How trust badges work, how Featured is picked, seller guidelines, terms of use | none yet | Missing |`
with two rows:

```markdown
| How trust works (the badges and how Featured is picked) | `/trust` | Built |
| Terms of use, seller guidelines | `/terms`, `/seller-guidelines` | Built as drafts; Eduvos signs off the wording |
```

3. Replace the row
`| Error page (when something breaks) | `error.tsx` | Missing |`
with `| Error page (when something breaks) | `error.tsx` | Built |` (or, if Task 8 dropped it: `| Error page (when something breaks) | `error.tsx` | Dropped over the JS stop line (decision <n>); Next's default shows |`).

4. In "POPIA and legal", replace
`- [ ] Final privacy policy, with a named Information Officer.`
with
`- [ ] Final privacy policy, with a named Information Officer. A draft is live at `/privacy`; Eduvos's legal team reviews it (plan decision 17 lists the claims to confirm).`
and replace
`- [ ] Terms of use and seller guidelines.`
with
`- [ ] Terms of use and seller guidelines. Drafts are live at `/terms` and `/seller-guidelines`; Eduvos's legal team reviews them.`

5. In "Content", add:
`- [ ] Revisit the info pages as each stage lands: How it works' "What can I do on Vossie today?" answer, the trust page's notes that badges and Featured picks are samples, and the privacy policy's "When sign-in arrives", cookie lists and "How long we keep it".`

6. In "Production", replace `- [ ] Security headers.` with:

```markdown
- [x] Security headers: `nosniff`, referrer policy, `X-Frame-Options`, `Permissions-Policy` and HSTS (2026-10-14).
- [ ] A Content Security Policy. It needs a nonce per request for Next's inline scripts, which makes every page dynamic; decide whether that is worth it.
- [ ] HSTS: decide on `includeSubDomains` and preload once the domain is known.
```

7. Replace `- [ ] robots.txt and a sitemap.` with `- [x] robots.txt and a sitemap (2026-10-14).` If Task 6 used variant B, add under it: `- [ ] Add Looking For requests and Hub posts to the sitemap (`app/sitemap.ts`) once part B's `getRequestIds` and `getHubPostIds` exist; Task 6, Step 11 has the exact change.`

8. Replace the whole `metadataBase` line, which starts `- [ ] Set `metadataBase` to the live domain`, with:
`- [ ] Set `NEXT_PUBLIC_SITE_URL` to the live domain in the host's build environment (see `.env.example`). `metadataBase`, share cards, `robots.txt` and the sitemap all follow it; until it is set they name `http://localhost:3000`.`

9. Replace `- [ ] A support contact.` with `- [ ] A support contact, and a privacy contact address for `/privacy` and `/terms`, which say one will be added.`

10. In "Suggested order", set item 2 to say the other public pages are done, in the style of item 1 (`**Done (2026-10-<day>):** …`), naming the shopping, community, and info and system pages.

The "Offline page" row stays as it is (`/offline`, "Missing; can follow launch"): spec 2.10 keeps it on the checklist.

- [ ] **Step 6: Update CLAUDE.md**

In `CLAUDE.md` (additions only; part A's edits to the same sections stay):

1. In "Code rules", after the line `- Touch targets are at least 44px. No hover-only features.`, add:
`- The site's address comes from `siteUrl()` (`lib/site-url.ts`, from `NEXT_PUBLIC_SITE_URL`, which Next reads at build time). Never write the live domain in code.`

2. In "Privacy (POPIA)", after the line `- Photos of people need their consent.`, add:
`- The privacy page (`app/privacy/page.tsx`) names every cookie and browser store by its real key, and its test imports those keys from `lib/`. When you add or rename a cookie or a browser store, update the page and that test.`

- [ ] **Step 7: Update the progress log**

In `docs/PROGRESS.md`, add a section before "Next", in the style of the earlier ones (read the current "Next" and "Waiting on" first):

```markdown
## 2026-10-<day>: Info, legal and system pages built (part C)
- **Info pages** share one frame (`InfoPage`: title, lede, "Last updated", an "On this page" list, then sections):
  - `/how-it-works` (buying, selling, trust in a paragraph, six questions), `/safety` and `/trust` (Verified, the three badges, what counts, how Featured today is picked);
  - `/privacy`, `/terms` and `/seller-guidelines` are **drafts for Eduvos to review**, with a banner saying so, and the Information Officer is "to be named by Eduvos". The privacy policy names every cookie and browser store this stage has, and its test fails if the page and the code disagree;
  - the footer links them all, and the homepage's "How trust works" and "How we pick" links open `/trust`.
- **Production basics:**
  - the site's address comes from `NEXT_PUBLIC_SITE_URL` (`.env.example`), so every page has one absolute `og:image`;
  - `robots.txt` keeps crawlers off Saved, sign-in, the account pages and the selling pages (as `/sell$` and `/sell/`, so storefronts stay listed);
  - the sitemap lists the public pages, collections, sellers and listings <and Looking For requests and Hub posts, OR: and will list requests and Hub posts once part B's functions exist>;
  - security headers on every response (`nosniff`, referrer policy, `X-Frame-Options`, camera, microphone and location off, HSTS in production). No Content Security Policy yet.
- **Error page:** <built, adding <n> B, OR: dropped, because with it <page> reached <n> B, past the stop line (decision <n>)>.
- **Where the build differed from the plan** is in the plan's "Changes made during the build". Plan decisions worth knowing: "Try again" calls `retry()`, not `reset()`; the footer's "Seller safety" became "Seller guidelines"; the trust page follows the messaging spec on auto-confirmed sales.
- **Checks:**
  - lint and types are clean;
  - <n> unit tests pass;
  - end to end, <n> pass, <n> are skipped by design and none fail;
  - axe finds no serious or critical issues on the six pages or the 404 page.
- **First visit at 390px, JS brotli:** homepage <n> B, browse <n> B, listing <n> B, How it works <n> B (limit 153,600 B; stop line <n> B).
- **Layout shift** (fonts held back, at 390 and 1440px): How it works <n> and <n>; Privacy <n> and <n>.
- Review screenshots: `docs/progress/info-system/`.

## 2026-10-<day>: Open points for Lama after the info and system build
- **Eduvos has to review three pages:** the privacy policy, terms of use and seller guidelines are drafts. The claims for their lawyers to confirm: Eduvos is the responsible party; under-18s need a parent's or guardian's consent; Vossie doesn't sell personal information; the lawful basis for each thing accounts will collect; and where the data is hosted. A contact address and the Information Officer's name are still to come.
- **The drafts are indexable.** Spec decision 8 lets crawlers read everything but four routes. If Eduvos would rather not have a draft policy in search results before it signs off, add `robots: { index: false }` to the three pages until then.
- **The info pages describe the future in places.** How it works' "What can I do on Vossie today?", the trust page's "badges are samples", and the privacy policy's "When sign-in arrives" are true today and go stale as stages land (the checklist lists them).
- **The Featured draw doesn't match the trust page yet.** The page says a featured seller sits out for a week and needs something listed. The sample draw (`lib/featured.ts`) does neither, and the staff tools spec adds the second but not the first.
- **The homepage's How it works card still says "Chat in Vossie or on WhatsApp."** Decision 57 cut the WhatsApp handoff; the messaging stage should change that card.
- **No share cards for the info pages, requests or Hub posts.** The community spec expected part C to add them; this part's spec didn't. A single default card in `app/opengraph-image.tsx` would do it.
- **Later stages add to `robots.txt`.** Messages, notifications and report are signed-in pages that a crawler only meets behind sign-in links, so none needs listing, but add them if you'd like it explicit. Staff pages stay unlisted on purpose.
```

Fill in the numbers from your runs, and keep only the true alternative where one is offered. Then, in "Next", edit the bullet that begins "The remaining stages are" so it no longer lists part C as pending and names part D (accounts) as next, and add this bullet:
`- Lama reviews the screenshots in `docs/progress/info-system/`. To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "info and system review screenshots"`.`

In "Waiting on", add:
`- Eduvos's legal review of the privacy policy, terms of use and seller guidelines; the Information Officer's name; a contact address for privacy requests and support.`

- [ ] **Step 8: Fill in this plan**

Fill in this plan's JS ledger. Add a "Changes made during the build" section after it, listing every place the build differed from the tasks as written (including any quoted line you had to adapt), with the commit that made each change.

- [ ] **Step 9: Final checks**

Run, one after another: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`.
Expected: all pass. Record the unit and end-to-end counts in `docs/PROGRESS.md` and the ledger. Then run `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` once more and write the final figures in the ledger's "Final" row. If a page is past the stop line, stop and report.

- [ ] **Step 10: Hand over for commit**

Files: `tests/e2e/screenshots.spec.ts`, `docs/progress/info-system/`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-14-info-and-system-pages-design.md`, this plan.
Message: `docs: info and system review screenshots, progress, checklist, decisions and the spec brought in line`
