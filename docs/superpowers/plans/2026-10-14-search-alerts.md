# Vossie Saved-Search Alerts (Sample Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build stage I as the spec `docs/superpowers/specs/2026-10-14-search-alerts-design.md` describes: a signed-in student saves a browse search with one press of **Save this search** under the results' chips; their saved searches live on Saved's third tab, **Searches**, where they can open, pause, resume and delete them; and when an approved shop publishes a listing for the first time that one of them matches, by browse's own rules, the student gets one `search-match` notification a day for that search, made unread again by a later match. Everything runs on the sample store, every form works without the app's JavaScript, and browse and Saved get no new client code. Tested at five screen sizes and within the JS budget.

**Architecture:**
- **One new table in the sample store** (`lib/data/rows.ts`, `lib/data/store.ts`): `savedSearches`. Only `lib/data/saved-searches.ts` touches it. E's `NotificationRow` keeps H's optional `count`, now for `search-match` too.
- **One matcher.** The per-listing test inside browse's `findListings` becomes `listingMatches(listing, query, names)` in `lib/browse/results.ts`. Browse calls it for its results; `notifySavedSearches` calls it for each saved search. A test holds the two to the same answer on every sample listing.
- **One parser.** Save this search posts browse's own fields; the action reads them with `parseBrowseParams`, so a saved search, its link and its alert always agree (`lib/saved-searches/rules.ts`).
- **One "something new" rule.** H's one-a-day rule for `new-listing` moves into a private helper in E's `lib/data/notifications.ts`, `notifyOncePerDay`, with a `reopenWhenRead` option: off for H's `notifyNewListing`, on for the new `notifySearchMatch`.
- **Matching on F's publish write, no scheduler.** In F's `saveListingForm`, inside H's first-publish block and straight after H's `notifyFollowers`, the action calls `notifySavedSearches`.
- **Plain forms, Server Actions, redirects** (D's to H's pattern). Save, Pause, Resume and Delete post to `lib/saved-searches/actions.ts`; each takes identity only from the session, leaves its line in D's form state and ends with F's `done(path)` (`refresh()`, then a `replace` redirect).
- **The session's parts are server slots.** Browse's Save row sits in its own `<Suspense>` whose fallback is the signed-out row, in a box that keeps its height. Saved's Searches tab streams with H's tabs. No client code is added anywhere.

**Tech Stack:** As stage H leaves it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5.9;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5 with Testing Library and jsdom 30;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-14-search-alerts-design.md`. "Spec 2.5" in this plan means that spec's section 2, decision 5; "spec 4" means its section 4.
- **The stages this builds on:**
  - stage D, `docs/superpowers/plans/2026-10-14-accounts.md` ("D's plan", "D decision 3");
  - stage E, `docs/superpowers/plans/2026-10-14-messaging.md` ("E's plan", "E Task 7"), whose spec's section 9 wins;
  - stage F, `docs/superpowers/plans/2026-10-14-selling.md` ("F's plan", "F decision 25"), whose spec's section 8 wins;
  - stage G, `docs/superpowers/plans/2026-10-14-staff-tools.md` ("G's plan");
  - stage H, `docs/superpowers/plans/2026-10-14-community-actions.md` ("H's plan", "H Task 5", "H decision 15").
  **Where E's built code and E's plan differ, the code wins:** this plan quotes E's `lib/data/notifications.ts`, `lib/data/messages.ts` and `lib/messaging/*` as they were on 2026-10-14.
- **Browse (built):** `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md`: parameters (3.2), links (3.3), search (4.8) and filters (4.9). The code: `app/browse/page.tsx`, `components/browse/`, `lib/browse/`.
- **The old demo:** `docs/reference/FUNCTION-MAP.md`, section 10's "Add" list ("Saved-search or new-listing alerts by category and campus").
- **The go-live checklist:** `docs/reference/GO-LIVE.md`, section 2 ("Saved searches") and section 6 (the matching note).
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`, row 69 (this stage's spec) and whatever D to H add.

---

## Before you start

**This plan starts after stage H.** When it was written (2026-10-14), stage E's build was under way (its notifications page and report pages committed, `1376c89` and `5fbd3b2`, with later work in the working tree), and stages F, G and H had committed plans and no code. Start only once H's last task (its docs) is committed. Then work through "Recheck before starting" below before Task 1: this plan is written against E's code and F's, G's and H's planned names, and their builds may have changed some.

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. `.claude/launch.json` has a change made outside this work: never stage it.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed. This is Lama's standing preference.
3. **Files this plan removes or moves:** none. No task runs `rm`. If something looks unused, leave it and list it in the hand-over for Lama.
4. **No new cookie or browser-storage name** (spec 2.15). The privacy test's list of `vossie_…` names doesn't change.
5. **H's new-listing rule moves into a shared helper** (spec 2.12). Its behaviour doesn't change: H's three tests for it stay as they are and must still pass.
6. **A Playwright project that runs last of all** (Task 8): `alerts-writes`, after the five device projects and F's `selling-writes`, G's `staff-writes` and H's `community-writes`, for the tests that publish listings (plan decision 19).
7. **Sample wording.** The row's lines, the Searches tab's words, the status lines and the notification sentences are for Lama to change. Plan decision 18 lists where they live.

No installs are needed.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time. Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` anything.
- Never kill an install or build that is still running.
- Port 3100 is Lama's dev server. Don't touch it. The e2e tests use 3200; the "looking at it" checks use 3201.
- Before you edit a shared file (`app/globals.css`, `lib/types.ts`, `lib/time.ts`, `lib/data/rows.ts`, `lib/data/store.ts`, `lib/data/notifications.ts`, `lib/data/accounts.ts`, `lib/browse/results.ts`, `app/privacy/page.tsx`, `playwright.config.ts`, `tests/e2e/*.spec.ts`, `docs/*`, and every file stages D to H created), read its current text and edit by the exact lines that are there now. Never paste back a whole list or file from an older copy. Where this plan quotes a line from D's to H's plans or code and the built file says it differently, edit by meaning and note it in the hand-over.

## Recheck before starting

Stages F to H weren't built when this plan was written. Before Task 1, check each item against the code, one command or file at a time, and write what you find in the ledger's "Start" row or a message to the controller. If something differs in a way a task's quoted code depends on, stop and report rather than guess. Items marked **(H)** name things from H's plan, the last written and the likeliest to have moved in H's review or build; check them most carefully.

1. **Git.** `git log --oneline -5` shows H's docs commit (H's last task) at the top; `git status --short` shows only ` M .claude/launch.json`.
2. **The stop line and the figures.** Read `docs/PROGRESS.md` and the decisions log for the newest accepted JS figures and stop line (152,305 B when this plan was written; browse was 151,361 B at E's start, the most exposed page here). Use H's final figures and the newest stop line in the ledger.
3. **The store** (D to H Task 1). `lib/data/store.ts`: `SampleStore` ending with H's `requests` and `follows`; `STORE_VERSION` 5 after H; `seedStore()`'s returned object listing the tables in that order, ending `follows: new Map(),`. `lib/data/store.test.ts` has the "is seeded with …, and nothing else" test with H's `expect(store.follows.size).toBe(0);`. Task 1 adds one to `STORE_VERSION` and one table.
4. **The rows.** `lib/data/rows.ts` imports its types from `@/lib/types` in one `import type { … }` block. E's `NotificationRow` has H's `count?: number | null;` after `readAt`. F's `ListingRow` has G's optional `hiddenAt` and `hiddenReason`; F's `SellerRow` has `ownerId: string | null`.
5. **Types.** `lib/types.ts`: `NotificationKind` is E's four, G's `"shop-update"` and `"booking"`, then H's `"offer"`, `"request-update"` and `"new-listing"`, ending `| "new-listing";`. Browse's `SearchQuery`, `BrowseQuery`, `PriceFilter`, `PayFilter` and `CampusChoice` are as built. Nothing is called `MatchQuery`, `SaveSearchState` or `SavedSearchItem`.
6. **E's notifications, with H's changes** (E's code and H Tasks 3 and 5). `lib/data/notifications.ts` has the private `add({ accountId, kind, subjectId, text, href, now })` and `ofAccount`, and exports `notify`, `notifyAboutMessage`, `getNotifications`, `countNewNotifications`, `markNotificationsRead`, `markSaleNotificationsRead`, `markConversationNotificationsRead`, `deleteNotifications`, `exportNotifications`, **(H)** `deleteNotificationsAbout(kind, subjectIds)` and `notifyNewListing({ accountId, sellerSlug, shopName, listing, now }): Promise<void>`, whose body loops over the store's notifications with `const today = sastDate(now);`, returns at `if (row.readAt !== null) return;`, and otherwise sets `row.count`, `row.text = newListingsText(shopName, count)`, `row.href = \`/sellers/${sellerSlug}\`` and `row.createdAt`. The file imports `newListingsText` and `newListingText` from `@/lib/following/rules` and `sastDate` from `@/lib/time`. **(H)** `lib/data/notifications.test.ts` has the describe "a followed shop's new listings (community actions spec 2.19, plan decision 15)" with three tests.
7. **E's notifications page.** `components/messages/NotificationsView.tsx`'s private `KindIcon` has a `switch` over every kind (E's four, G Task 18's `"shop-update"` and `"booking"`, H Task 1's `"offer"`, `"request-update"` and `"new-listing"`), each returning an icon with `className="notes-icon"`; each row is a `Link` with `prefetch={false}`. `components/messages/Notifications.tsx` marks everything read on opening (`markNotificationsRead`).
8. **F's data** (F Tasks 4 and 5, G Task 4). `lib/data/catalog.ts` exports `shopStatus`, `toListing(row, shop)`, `liveSellerRows`, `storefrontRow` and `listedListings`. `lib/data/index.ts`'s `searchListings` returns `findListings(listedListings(), query, { sellers: …, categories: … })`. `lib/data/own-listings.ts` exports `saveOwnListing`, `setOwnListingState`, `getOwnListing` and `listOwnListings`. `tests/helpers/fakes.ts` exports `makeListing` (built) and F's `makeListingRow` (Tech corner's available R100 tech item at Midrand).
9. **F's actions, with H's change** (F Tasks 7 and 8, H Task 9). `lib/selling/action-helpers.ts` exports `field(formData, name)` and `done(path): never`. `lib/selling/listing-actions.ts`'s `saveListingForm` has `const now = new Date();` near its top, and after `listingsChanged();` **(H)** the block that starts `const firstPublish = saved.state !== "draft" && (!existing || existing.state === "draft");` and `if (firstPublish && owner.status === "approved" && !saved.hiddenAt) {`, holding `await notifyFollowers({ … });`. `changeListingState` is there. `lib/selling/shop-actions.ts` exports `resumeShop()`. `lib/selling/listing-actions.test.ts` has its own `NOW`, `form(fields)`, `signedInAs(accountId)`, `fanForm(overrides)` and `fan()` helpers and **(H)** the describe "telling followers (community actions spec 2.19, plan decision 15)".
10. **H's data** (H Tasks 3 and 5). `lib/data/follows.ts` exports `notifyFollowers` and `forgetFollowsOf`. `lib/data/accounts.ts`'s `deleteAccountData` has **(H)** `await forgetFollowsOf(accountId);` straight after `await forgetRequestsOf(accountId);`; `AccountExport` and `exportAccountData` end with **(H)** `requests` and `following`; `lib/data/accounts.test.ts`'s export test lists the keys, ending `"requests"`, `"following"`.
11. **H's rules and status lines** (H Tasks 2 and 7). `lib/following/rules.ts` has `export type SavedTab = "listings" | "shops";`, `parseSavedTab(raw)` (Shops only for `"shops"`) and `savedTabPath(tab)`; its test file has the describe "following shops (community actions spec 2.15 to 2.19)". `lib/looking-for/form-state.ts` exports `takeNote(form)` (read and clear, once).
12. **H's Saved** (H Task 18). `app/saved/page.tsx` renders `<Suspense fallback={<SavedSkeleton />}><SavedTabs searchParams={searchParams} /></Suspense>` under the h1. `components/saved/SavedTabs.tsx` renders `LinkTabs` (`label="What's saved"`, `look="tabs"`) with two tabs and a ternary `{tab === "listings" ? (…device note… <SavedList />) : (… "Kept with your account." … <FollowedShops />)}`. `components/saved/SavedTabs.test.tsx` mocks `./SavedList` and `./FollowedShops` and has a `tabs(params)` helper. `components/saved/FollowedShopsView.tsx` uses `.saved-empty`, `.saved-empty-title`, `.saved-count` and `section aria-labelledby="saved-shops-title"`.
13. **D's forms and session.** `lib/auth/session.ts` (`getViewer`, `requireAccount(nextPath)`), `lib/auth/form-state.ts` (`readFormState(form)`, `writeFormState(form, state, now)`), `lib/next-path.ts` (`safeNextPath`, `signInHref`), E's `lib/messaging/paths.ts` (`isId`), the CSS classes `.btn`, `.btn-outline`, `.btn-primary`, `.form-notice`, `.saved-empty`, `.saved-empty-title`, `.saved-count`, and the Tailwind colour `text-navy`.
14. **Browse (built).** `components/browse/BrowseView.tsx` returns `BrowseHeader`, `CategoryTabs`, `BrowseToolbar`, `ActiveFilters`, then `{results}`; `components/browse/BrowseView.test.tsx` mocks `@/lib/data/viewer` and `@/lib/data` and has a `view(params)` helper. `lib/browse/results.ts` exports `passesFilters`, `ListingNames` and `findListings`, and has a private `Scored` type, `newest`, `byPrice` and `COMPARE`. `lib/browse/query.ts` exports `PAGE_SIZE`, `parseBrowseParams`, `knownSlugs`, `defaultSort`, `BrowseParams`, `KnownSlugs`; `lib/browse/search.ts` exports `queryWords`; `lib/browse/filters.ts` exports `PRICE_LABELS`, `PAY_LABELS` and `DEALS_LABEL`; `lib/browse/href.ts` exports `browseHref`. `lib/campus.ts` exports `ALL_CAMPUSES` and `ONLINE_CAMPUS`.
15. **Privacy and robots, with H's changes** (H Task 19). `app/privacy/page.tsx`'s `privacy-sign-in` section ("Your account") has **(H)** the bullet that starts `<strong>The shops you follow.</strong>`; the `privacy-keep` section's bullet that says what deleting your account removes names **(H)** "your Looking For requests, the shops you follow,". `app/privacy/page.test.tsx` imports `PrivacyPage` and finds sections with `getByRole("region", { name: … })`. `components/account/PrivacySettingsView.tsx`'s "Download your data" sentence and its list of what deleting does carry H's words. `app/robots.ts`'s `DISALLOWED` has `"/saved"`; `app/robots.test.ts` has the `blocked(path)` helper.
16. **Test helpers.** `tests/helpers/next-request.ts` (`FakeRequest` with F's `updatedTags`, `nextCache` with `refresh` and `updateTag`, `redirectOf`, `redirectSignalOf`); G's `tests/helpers/staff.ts` (`STAFF_NOW`, `signedInAs(request, accountId)`, `form(fields)`); H's `tests/helpers/viewer-follow.tsx` (the pattern Task 4 copies).
17. **End to end** (E Task 15, F Task 16, G Task 20, H Tasks 22 and 23). `tests/e2e/helpers/messaging.ts` exports `project`, `onlyAt`, `main`, `field`, `button`, `newBuyer`, `signUpHere`, `signUp`, `signInAsSample` and `sellerPage`; `tests/e2e/helpers/selling.ts` exports `uniqueWord` and `publishListing(page, title)` (Res & living, R150, "Quiet and strong.", ending on `/sell/listings` and giving back the id). `playwright.config.ts` has `DEVICE_PROJECTS`, `SELLING_WRITES`, `STAFF_WRITES`, **(H)** `COMMUNITY_WRITES = /community-(writes|checks)\.spec\.ts$/`, `testIgnore: [SELLING_WRITES, STAFF_WRITES, COMMUNITY_WRITES]` on the five device projects, and the `selling-writes`, `staff-writes` and **(H)** `community-writes` projects. **(H)** `community-writes.spec.ts`'s follow test publishes two listings for Tech corner and counts them.
18. **The size, axe and layout shift tests.** `tests/e2e/performance.spec.ts` (`PAGES` rows `[name, path, saved?]`, and **(H)** the `SIGNED_IN_PAGES` list and its loop); `tests/e2e/cls.spec.ts` (`PAGES` rows `[name, path, cookies?, signedIn?]`); `tests/e2e/a11y.spec.ts` (`seriousIssues(page)` and its own `signInAsSample(page, label?)`); `tests/e2e/screenshots.spec.ts`.
19. **Icons and time.** `components/icons.tsx` has `SearchIcon` (a circle and the path `m16 16 4.5 4.5`). `lib/time.ts` has `sastDate` and `longSastDate`, and nothing called `sastDayMonth`.
20. **Class names.** `grep -n "\.save-search\|\.saved-search" app/globals.css` prints nothing.

## Where things stand (checked against the code on 2026-10-14)

| Area | Fact |
|---|---|
| Repo | `main`, with stage E's build under way (its notifications page `1376c89` and report pages `5fbd3b2` committed; account-page and menu changes in the working tree). F, G and H have plans and no code. Decision 69 records this stage's spec. `.claude/launch.json` is modified outside this work |
| JS | First visit at 390px, brotli quality 5, at E's start: browse 151,361 B, 944 B under the stop line (152,305 B, decision 52) and 2,239 B under the limit (153,600 B). Browse is this stage's most exposed page. E's to H's changes come before this plan; take H's final figures as the start |
| Browse | `app/browse/page.tsx` renders `BrowseView` inside one `<Suspense fallback={<BrowseSkeleton />}>`. `BrowseView` reads `searchParams`, `getViewerContext()` (the campus cookie and the session), `getCampuses()` and `getCategories()`, parses with `parseBrowseParams(params, viewer.campus, knownSlugs(…))`, searches with `searchListings(toSearchQuery(query))`, and renders the header, tabs, toolbar (with its `role="status"` count), `ActiveFilters`, then the grid, `BrowseEmpty` or `BrowseError`. Browse's client code is `ScrollToResult` and the Save hearts |
| Search | `findListings(all, query, names)` in `lib/browse/results.ts` tests each listing inline: available, category, `passesFilters`, `matchScore(fields, queryWords(query.q))`, then the campus (counting `elsewhere`). `searchListings` (`"use cache"`) wraps it; after F it reads `listedListings()` and the live shops' names |
| Notifications | E's `lib/data/notifications.ts` makes a row per thing (`add`), folds a busy conversation's messages into one unread row (`notifyAboutMessage`), and marks everything read when `/notifications` opens. H Task 5 adds `notifyNewListing`'s one-a-day rule with `count` on the row; H Task 3 adds `deleteNotificationsAbout` |
| Saved | After H Task 18, `/saved` has two tab links (`?tab=shops` for Shops, anything else Listings) streaming in with their notes and lists behind `SavedSkeleton`. `/saved` is in `robots.txt`'s `DISALLOWED` and `noindex` |
| Publishing | F has no `publishListing` data function: publishing is `saveListingForm` with the intent `publish`, writing through `saveOwnListing` (F Task 8). H Task 9 adds its first-publish block calling `notifyFollowers` |
| Privacy guard | `app/privacy/page.test.tsx` fails when a `"vossie_…"` name in `app`, `components`, `hooks` or `lib` isn't on the privacy page. This plan adds no such name |
| Next 16.4 | A `<form action={serverAction}>` in a Server Component posts without the app's JavaScript and adds no client code; `refresh()` then `redirect(path, RedirectType.replace)` ends every write (E decision 6, F's `done`) |
| e2e | One `next start` on 3200, five device projects, then F's `selling-writes`, G's `staff-writes` and H's `community-writes`. Every test shares one sample store. `getByRole("alert")` also matches Next's route announcer. Next keeps the last 3 pages hidden in the DOM |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. In this plan, "plan decision N" means this list; "spec 2.N" means the spec's decisions; "D decision N" to "H decision N" mean those plans' lists; "decision N" on its own means a row in the decisions log.

1. **One matcher** (spec 2.2). `listingMatches(listing, query, names)` returns a listing's Best match score when it passes the query's availability, category, campus, filters and words, and null when it doesn't. `findListings` calls it for each listing at the query's campus, and, for a listing at another campus, calls it with every campus to count "N more at other campuses", so its results, order and `elsewhere` are unchanged. The alert passes the listing as buyers see it (F's `toListing`), its category's name and its shop's name. A test runs both over every sample listing for ten queries and expects the same set.
2. **What a saved search holds** (spec 2.1 and 2.4). A new type, `MatchQuery`, is browse's `SearchQuery` without the sort; a saved search is one, plus its account and times. The action reads the posted `q`, `cat`, `campus`, `price`, `max`, `pay` and `deals` through `parseBrowseParams` with every campus as the fallback: the form always posts the campus, so the fallback only covers a hand-made post. A `q` with no search words (only stop words or single letters) is kept as null, because it matches like none.
3. **The same search** (spec 2.4). `searchKey` is the set of query words (lower case, accents gone, repeats dropped, sorted) and the category, campus, price, pay and deals. "Calculator casio", "casio calculator" and "CÁSIO the calculator" are one search. A second save keeps the first's words as typed.
4. **The label** (spec 2.3). Built each time it's shown, from the fixtures' category and campus names: the words as typed, in curly quotes (as browse's heading writes them), then " in {Category}", or the category alone, or "Everything"; then " at {Campus}", " on Eduvos Online" or " at every campus"; then each filter after a comma in the chips' words with a lower-case first letter ("under R100", "cash", "swaps", "free", "free & swaps").
5. **Links** (spec 2.7, 2.12 and 2.13). `savedSearchHref(search)` is `browseHref` with the campus pinned and the default sort (Best match with words, Newest without). A notification about several listings links with `sort=new`; for a search without words Newest is already the default, so the link is the same as the label's.
6. **The browse row** (spec 2.5 and 2.6). `SaveSearchControl` sits in `BrowseView` between `ActiveFilters` and the results, the empty state or the error, whenever the search is worth saving. It's a box that's always there, with the session's part (`ViewerSaveSearch`) in its own `<Suspense>` and the signed-out row as the fallback. Each state is one 20px line and one 44px control: stacked on phones (72px), side by side from the tablet step (44px), so the box never changes height. The button and the sign-in link are a white pill with a navy outline and navy text; Manage saved searches is a sky-dark link, 44px high.
7. **Status lines** (spec 2.6 and section 4). Each action leaves a code in D's form state and the page takes it once with H's `takeNote`: Save this search under `save-search:<searchKey>`, so the line shows only on its own search's row; Pause, Resume and Delete under `saved-searches`, with the search's label and link in `values`. Codes: `saved` (notice), `already` and `limit` (errors); `paused`, `resumed` and `deleted` (notices).
8. **No error summaries.** None of the four forms has a field to correct, so none uses D's `ErrorSummary` and `components/forms/summary-ids.test.tsx` doesn't change. The row's refusals are its one line with `role="alert"` (spec 2.6). The forms post only hidden fields and ids.
9. **Where Save goes back** (spec 2.5). `from` is accepted when `safeNextPath` gives `/browse` or `/browse?…`; anything else goes to the saved search's own results. A signed-out post goes to sign-in and back to that link. A post that isn't worth saving goes back with nothing written.
10. **The Searches tab** (spec 2.7). H's `SavedTabs` gains a third link, **Searches**. Task 1 adds `"searches"` to H's `SavedTab` type and its address only; Task 5 teaches `parseSavedTab` and renders the tab, so `?tab=searches` never shows Shops in between. A row: the label linking to its results, "Saved 12 October" (a `<time>`, through a new `sastDayMonth` in `lib/time.ts`), "Alerts on" or "Paused", then Pause alerts (or Resume alerts) and Delete. A count line, "1 saved search" or "3 saved searches", as Saved's other tabs have.
11. **Pause, Resume and Delete** (spec 2.8). Owner only, by id; someone else's id changes nothing and says nothing. Pausing keeps when it was first paused; resuming clears it and looks back at nothing (matching only ever runs at publish). Delete removes the search and its notifications (H's `deleteNotificationsAbout("search-match", …)`), and its line links to the search's results.
12. **One a day, made unread again** (spec 2.12). `notifyOncePerDay` (private, `lib/data/notifications.ts`) holds H's rule with a `reopenWhenRead` option and says whether it made or changed a notification. H's `notifyNewListing` calls it with `false` and keeps its signature. `notifySearchMatch` calls it with `true`: when today's row was read, the next match makes it unread, moves it to the top and starts its count again at 1, naming that listing and linking to it; a further match while unread makes "2 new listings match…", linking to the results Newest first. Its `subjectId` is the saved search's id. "Never more than one unread" holds within a SAST day: an unread one from an earlier day stays, and the day's first match starts today's (H's rule).
13. **Matching** (spec 2.9 to 2.11). `notifySavedSearches({ listingId, now })` in `lib/data/saved-searches.ts` reads the listing and its shop from the store, and tells no one about a listing that's hidden or whose shop isn't approved (a guard; F's action already checks), or one buyers can't see (`toListing` says paused for a draft). It goes through the saved searches oldest first, skips paused ones and the shop owner's own, and tells each account at most once, under its oldest matching search. It's called in `saveListingForm` straight after H's `notifyFollowers`, inside the same `if`.
14. **The notification's words** (spec 2.12). "{title} matches your search {label}" and "{count} new listings match your search {label}"; the kind is `search-match`, drawn with `SearchIcon`.
15. **Deletion and the export** (spec 2.15). `deleteAccountData` calls `forgetSavedSearchesOf` straight after H's `forgetFollowsOf` (E's `deleteNotifications` already removes the account's own notifications). The export gains `savedSearches`, newest first: the label, `words`, the category's and campus's names ("Every campus" for every campus), the price, pay and deals chips' words, `alerts` (`"on"` or `"paused"`) and `savedAt`. No ids. Other students' `search-match` notifications that name a deleted shop's listing stay: they name a listing, not a person, and lead to its 404 as a deleted listing's link would.
16. **The privacy words** (spec 2.15). The policy's "Your account" section gains a bullet for saved searches, and its "How long we keep it" deletion bullet names them. Privacy settings' "Download your data" sentence names them, and its list of what deleting removes gains a line. This goes slightly past the spec's "privacy page" so the settings page stays true, as H's did.
17. **Robots** (spec 3). No change: `/saved` is already disallowed. Task 7 adds a test that pins `/saved?tab=searches` as blocked and `/browse?q=…` as open.
18. **Wording the spec doesn't give** (Lama may change it): the refused-at-the-limit line ("You have 20 saved searches. Delete one first."), the count line, "No saved searches yet" with "Search on Browse and press Save this search.", the export's field names, and the privacy sentences. The words live in `lib/saved-searches/words.ts`, `components/saved/SavedSearchesView.tsx`, `app/privacy/page.tsx` and `components/account/PrivacySettingsView.tsx`.
19. **End to end** (spec 6). Tests that only save searches (each for a student of its own, searching a word no other test uses) run in the five device projects: nothing else counts saved searches. Tests that publish run in a new project, `alerts-writes`, after every other one, rather than in F's `selling-writes` as spec 6 says: they change browse's counts, and Tech corner's new listings would otherwise land in H's follow test in `community-writes` (which runs after `selling-writes`), which counts them. The two-context test publishes three listings: the first is named and opened (which marks it read); the next two make the same line unread again as "2 new listings match…", linking to results with them at the top. That checks spec 6's flow and decision 12's "counting only the listings since it was read" together.
20. **Measuring** (spec 5). `performance.spec.ts` gains "browse page, a search" at the start of Task 4, "Saved page, Searches tab" at the start of Task 5 and "privacy page" at the start of Task 7, each measured before its page changes, so "the same to the byte" has a figure to hold to. Task 9 adds the signed-in measures.

## Amendments on review

The controller adds amendments here; they override the tasks below wherever they differ.

1. **The match hangs on F's own first-publish rule** (selling plan amendment 9.2 and community actions plan amendment 1, controller, 2026-10-15). The `firstPublish` condition this plan reuses from H is `isFirstPublish(existing, saved.state)` from `lib/data/own-listings.ts`, true only while `firstPublishedAt` is null, so a listing republished from a draft alerts no saved search a second time. Add that case to Task 2's tests. The export's key order ends `…, shop, listings, onboardingDraft`, then H's keys, then `savedSearches`.

## Store design

The table, the field it reuses, and who touches them:

- **`savedSearches`** (by id, `ss-<uuid>`): `SavedSearchRow`: the account; `q` (as typed, trimmed and cut to 100 characters, or null with no search words); `category`, `campus` (a slug or `all`, always set), `price`, `pay` and `deals`, as browse's parser gives them; `createdAt`; and `pausedAt` (null while alerts are on). Category and campus names aren't stored: the label looks them up when it's shown. Only `lib/data/saved-searches.ts` reads or writes it.
- **Reused:** E's `NotificationRow` with H's optional `count` (how many listings a `new-listing` or `search-match` notification is about since it was last read; absent means one). A `search-match` row's `subjectId` is the saved search's id.
- **Types:** `NotificationKind` gains `"search-match"`; new `MatchQuery`, `SaveSearchState` and `SavedSearchItem` in `lib/types.ts`.
- **Who reads what:** `lib/data/saved-searches.ts` (the table; F's `catalog.ts` for the listing as buyers see it; E's `notifications.ts` for `notifySearchMatch` and H's `deleteNotificationsAbout`), and `lib/data/accounts.ts` (`forgetSavedSearchesOf`, `exportSavedSearches`). `saved-searches.ts` imports nothing from `accounts.ts`, `follows.ts` or `messages.ts`, so there's no cycle. `notifications.ts` imports only words from `lib/saved-searches/words.ts`.

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec 5):** if any page passes **the stop line Lama last accepted (152,305 B when this plan was written; use the newer figure from "Recheck" item 2 if there is one)**, stop after that task and report the figures. Don't cut features to fit; that's Lama's decision. **Every page's first-visit JavaScript stays the same to the byte** (spec 5): if any figure moves, stop and find out why before going on. Browse was 944 B under the stop line at E's start, the least room of the pages this stage touches.
- **Where bytes could move:**
  - Tasks 1 to 3 change no page.
  - **Task 4 changes browse** (a Server Component row, a `<Suspense>`, a form and a `Link` inside `BrowseView`). Task 4 measures every page.
  - **Task 5 changes Saved** (a third tab link and a Server Component list with forms). Task 5 measures every page.
  - Task 6 changes the notifications page (signed in only; a Server Component's icon).
  - **Task 7 changes the privacy page** (text in a Server Component). Task 7 measures every page.
- **Recording.** `tests/e2e/performance.spec.ts` prints each page's `scriptBrotli`. Tasks 4, 5, 7 and 10 run it at 390px and put the figures in their commit messages. Tasks 4, 5 and 7 each add their page's row first and measure it before the change (plan decision 20); those first figures go in the "Start" row. Task 9 adds browse with a search and the Searches tab measured signed in.

**As built** (fill in during the build):

| Point | `/` | `/browse` | Browse, a search | Listing | Storefront | Saved | Saved, Searches tab | Privacy |
|---|---|---|---|---|---|---|---|---|
| Start (H's final figures; the three new columns from Tasks 4, 5 and 7, Step 1) | | | | | | | | |
| Task 4, Save this search | | | | | | | | |
| Task 5, the Searches tab | | | | | | | | |
| Task 7, the privacy words | | | | | | | | |
| **Final (Task 10)** | | | | | | | | |

Signed in (Task 9): browse with a search ________ B, Saved's Searches tab ________ B.

The stop line used: ________ B. Unit tests at the start: ________. End to end at the start: ________ pass, ________ skipped.

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there.
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, and comments in plain English. There's no formatter: match the file you're in.
- **Server or client.** Server Components unless a file starts with `"use client"`. This plan adds **no** client component and changes none. Plain `lib/` modules have no directive. `lib/saved-searches/actions.ts` starts with `"use server"`: everything it exports must be an async function (a private helper inside it is fine).
- **Next APIs.** Before using a Next API this plan names, read its page in `node_modules/next/dist/docs/01-app/` (AGENTS.md). This plan uses:
  - Server Actions in forms, `refresh()` and `redirect()`/`RedirectType`: `02-guides/server-actions.md`, `02-guides/forms.md`, `03-api-reference/04-functions/refresh.md`, `redirect.md`, `03-api-reference/01-directives/use-server.md`;
  - the session behind `<Suspense>`: `02-guides/authentication-with-cache-components.md`;
  - kept pages: `02-guides/preserving-ui-state.md`.

  The first task that uses one says so in its first step.
- **Breakpoints.**
  - `wide:` is tablet and up; `desk:` is desktop. Never use `md:`, `lg:` or `sm:`.
  - In CSS, write `@media (min-width: 48rem) and (min-height: 30rem)` and `@media (min-width: 64rem) and (min-height: 30rem)`.
- **Effects.** None in this plan.
- **Headings and ids.** One H1 per page. Sections are `<section aria-labelledby="…">` with one H2, visible or `sr-only`. The one new id is `saved-searches-title`; it's unique across pages because Next keeps earlier pages hidden in the DOM.
- **Request-time parts.** Anything that reads cookies, headers, `params`, `searchParams` or the clock sits inside `<Suspense>`. Clock reads come after `await connection()` (decision 26); D's `getViewer()` and `readFormState()` already await it. No `Date.now()`, `new Date()`, `Math.random()` or `crypto.random*` while prerendering: new ids and times are made only in Server Actions. There's no `try`/`catch` round JSX: the React Compiler lint rejects it.
- **Data functions** take `now` from their caller, never read the clock, and hand out copies.
- **Server Actions.** Read every field with F's `field(formData, name)` (a missing field or a file is `""`). Never take identity from a field: the account comes from `requireAccount()`. Check every id from a field with E's `isId` and look it up among the account's own. Call `redirect()` outside any `try`. Every action ends with F's `done(path)` (`refresh()`, then a `replace` redirect). Saved searches aren't cached and buyers never see them, so no action expires a tag.
- **Forms.** Plain `<form action={serverAction}>` with hidden fields and one submit button. None has a field to fill, so none has an error summary (plan decision 8).
- **User text.** Search words and listing titles are React text, never `dangerouslySetInnerHTML`.
- **Async components in tests.** jsdom can't render an async component inside a tree. Render `await Thing(props)` directly, or stand the async part in with `vi.mock` (H's `tests/helpers/viewer-follow.tsx` pattern).
- **Server code in tests.** Use D's `tests/helpers/next-request.ts` for `next/headers`, `next/navigation`, `next/server` and `next/cache`, and G's `tests/helpers/staff.ts` for `signedInAs(request, accountId)`, `form(fields)` and `STAFF_NOW` (Wednesday 14 October 2026, 10:42 in SAST); call `resetSampleStore()` and `resetRequest(request)` in `beforeEach`. Fake only the date: `vi.useFakeTimers({ toFake: ["Date"] })`, then `vi.setSystemTime(…)`.
- **JSX text.** The `react/no-unescaped-entities` rule is on: write `&apos;` for an apostrophe inside JSX text (a string in an attribute, a prop or `{"…"}` is fine). JSX drops the space at a line break next to a tag, so end a text line with `{" "}` when the next line starts with a tag.
- **Links.** Pages on this site use `Link` from `next/link`, with `prefetch={false}` on every link this plan adds (CLAUDE.md, decision 53): browse carries `ScrollToResult` and the hearts, Saved carries the hearts.
- **Accessible names.** Name computation trims each element's own text, so put spaces outside `sr-only` spans. Icons from `components/icons.tsx` are `aria-hidden`. A button that acts on one saved search names it (spec 4): "Pause alerts <span className="sr-only">for “calculator” at Midrand</span>", "Delete <span className="sr-only">saved search “calculator” at Midrand</span>". Save this search needs no target: browse shows one search.
- **Contrast.** Sky never carries text, icons or thin borders on white. Links on white are sky-dark; on panel and pale they're navy. Save this search is a white pill with a navy outline and navy text (spec 4).
- **Motion.** This plan adds none. Animate only `transform`/`opacity` if a reviewer asks for any.
- **Tap targets.** At least 44 × 44px, with 8px between targets. Links inside a sentence (the delete line's) are exempt (WCAG 2.5.8).
- **Class names.** New classes start with `save-search` or `saved-search`. Before adding one, check it isn't taken: `grep -n "\.<name>\b" app/globals.css`.
- **CSS placement.**
  - New CSS goes at the end of `app/globals.css`, inside `@layer components`, under a banner: `/* --- Search alerts: <name> (search alerts plan, Task N, spec x) --- */`.
  - Never put `!important` on a transition or animation property: the motion off-switches rely on it.
- **Hidden pages in tests.** In e2e tests, find things with `getByRole`/`getByLabel` and `.filter({ visible: true })`; a CSS locator also counts the kept copies. `getByRole("alert")` also matches Next's route announcer: look for an alert inside the Save row, or by its text, never `page.getByRole("alert")` alone.
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git status --short` on its own, and checks that only the listed files changed (and `.claude/launch.json`, which is never staged);
  2. runs `git add` with the listed files;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.
- **Looking at it.** Check visually on a production build (`pnpm build`, then `pnpm start --port 3201`) at 390 × 844, 768 × 1024 and 1280 × 800, using a throwaway Playwright script in your scratchpad. Stop the server afterwards (it's yours, not an install or build).
- **Measuring JS.** `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` builds, starts its own server on 3200, and prints one line per page, such as `browse page: {"script":…,"scriptBrotli":…}`. Record `scriptBrotli`, and compare every figure with the ledger's last row: any change at all means stop and find out why (spec 5).

## File map (end of this plan)

New files are marked **+**, changed **~**.

```
app/
  privacy/page.tsx  page.test.tsx  robots.test.ts                 ~ (Task 7)
  globals.css                                                     ~ search alerts banners (Tasks 4 and 5)
components/
  browse/SaveSearchControl.tsx  ViewerSaveSearch.tsx  (+ tests)  + (Task 4)
  browse/BrowseView.tsx  BrowseView.test.tsx                      ~ the row (Task 4)
  saved/SavedSearchesView.tsx  SavedSearches.tsx  (+ tests)       + (Task 5)
  saved/SavedTabs.tsx  SavedTabs.test.tsx                         ~ the third tab (Task 5)
  messages/NotificationsView.tsx  NotificationsView.test.tsx      ~ search-match's icon (Task 6)
  account/PrivacySettingsView.tsx  PrivacySettingsView.test.tsx   ~ (Task 7)
lib/
  types.ts                                                        ~ (Task 1)
  browse/results.ts  results.test.ts                              ~ listingMatches (Task 1)
  following/rules.ts  rules.test.ts                               ~ the Searches tab: type and path (Task 1), parse (Task 5)
  saved-searches/rules.ts  words.ts  (+ tests)                    + (Task 1)
  data/rows.ts  store.ts  store.test.ts                           ~ one table (Task 1)
  data/notifications.ts  notifications.test.ts                    ~ notifyOncePerDay, notifySearchMatch (Task 1)
  data/saved-searches.ts  saved-searches.test.ts                  + (Task 1)
  selling/listing-actions.ts  listing-actions.test.ts             ~ the match on publish (Task 2)
  saved-searches/actions.ts  actions.test.ts                      + (Task 3)
  time.ts  time.test.ts                                           ~ sastDayMonth (Task 5)
  data/accounts.ts  accounts.test.ts                              ~ deletion and export (Task 7)
tests/helpers/viewer-save-search.tsx                              + (Task 4)
playwright.config.ts                                              ~ alerts-writes (Task 8)
tests/e2e/
  helpers/alerts.ts  search-alerts.spec.ts  alerts-writes.spec.ts + (Task 8)
  performance.spec.ts                                             ~ (Tasks 4, 5, 7 and 9)
  a11y.spec.ts  cls.spec.ts                                       ~ (Task 9)
  alerts-checks.spec.ts                                           + axe on the signed-in states (Task 9)
  screenshots.spec.ts                                             ~ (Task 10)
docs/PROGRESS.md  docs/progress/search-alerts/  docs/reference/GO-LIVE.md  docs/reference/LANDING-DECISIONS.md
CLAUDE.md  the spec  this plan                                    ~ / + (Task 10)
```

Each `*.test.ts(x)` sits next to the file it tests.

## Where each spec decision is built

| Spec | Built in |
|---|---|
| 2.1 Browse's parsed query, the campus always stored, `ss-` ids, no names stored | Task 1 (`SavedSearchRow`, `savedSearchFrom`, `addSavedSearch`; plan decision 2), Task 3 (`saveThisSearch`) |
| 2.2 Browse's own word rules through `listingMatches` | Task 1 (`listingMatches`, the agreement test; plan decision 1) |
| 2.3 The label, no renaming | Task 1 (`savedSearchLabel`; plan decision 4), Task 5 (shown on the tab) |
| 2.4 Worth saving, the same search, 20 per account | Task 1 (`isWorthSaving`, `searchKey`, `SAVED_SEARCH_LIMIT`; plan decision 3), Task 3 (the refusals), Task 4 (no row on plain browse) |
| 2.5 A plain form in its own server slot, the hidden fields, `from` | Task 3 (plan decision 9), Task 4 (plan decision 6) |
| 2.6 The row's states, fixed height, status and alert | Task 4 (plan decisions 6 and 7), Task 9 (layout shift, axe) |
| 2.7 Saved's third tab | Task 1 (the address), Task 5 (plan decision 10) |
| 2.8 Pause and Delete without a confirm page; delete removes notifications | Task 1 (data; plan decision 11), Task 3 (actions), Task 5 (buttons and lines) |
| 2.9 Matching on F's publish write, after `notifyFollowers` | Task 1 (`notifySavedSearches`), Task 2 (the call; plan decision 13) |
| 2.10 What doesn't alert | Task 1 (guards, paused searches, the owner), Task 2 (edits, relists, resumes, a paused shop), Task 8 (end to end) |
| 2.11 How a listing is matched; once per account | Task 1 (plan decision 13) |
| 2.12 One a day, `count`, made unread again, `reopenWhenRead`, `search-match` | Task 1 (`notifyOncePerDay`, `notifySearchMatch`; plan decisions 12 and 14), Task 6 (the icon), Task 8 (end to end) |
| 2.13 No "new since" marker; Newest first | Task 1 (`savedSearchHref(…, "new")`; plan decision 5) |
| 2.14 No email | Nothing to build; Task 10 keeps the go-live question |
| 2.15 What's stored, deletion, the export, the privacy page, no new key | Task 1 (`forgetSavedSearchesOf`, `exportSavedSearches`), Task 7 (plan decisions 15 to 17) |
| 3 Screens: no new routes; robots | Tasks 4 and 5; Task 7 (plan decision 17) |
| 4 Accessibility | Tasks 4 to 6; axe in Task 9 |
| 5 Performance | Tasks 4, 5 and 7 (the ledger; plan decision 20), Task 9 (signed in) |
| 6 Testing | Unit tests in Tasks 1 to 7; end to end in Task 8; axe, layout shift and size in Task 9; screenshots in Task 10 |
| 7 Not in this stage | Task 10 (the checklist) |

---

### Task 1: Saved searches' data and rules: one matcher, the table, the label, and one a day made unread again

Everything the rest of the plan stands on, with no page changed: browse's per-listing test pulled out of `findListings` as `listingMatches` (browse's own tests stay green, and a new test holds the two together); the types, the `savedSearches` table and its rules (what's worth saving, when two are the same, the label, the links, the status lines' keys); the words; H's one-a-day rule moved into a shared helper with `reopenWhenRead`; and `lib/data/saved-searches.ts`, which saves, lists, pauses, deletes, matches a new listing, forgets and exports.

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/data/rows.ts`, `lib/data/store.ts`, `lib/data/store.test.ts`
- Modify: `lib/browse/results.ts`, `lib/browse/results.test.ts`
- Modify: `lib/following/rules.ts`, `lib/following/rules.test.ts`
- Create: `lib/saved-searches/rules.ts`, `lib/saved-searches/rules.test.ts`
- Create: `lib/saved-searches/words.ts`, `lib/saved-searches/words.test.ts`
- Modify: `lib/data/notifications.ts`, `lib/data/notifications.test.ts`
- Create: `lib/data/saved-searches.ts`, `lib/data/saved-searches.test.ts`

- [ ] **Step 1: The types**

In `lib/types.ts`:

1. In `NotificationKind` (G's, with H's three), add one member after `| "new-listing"`, so the union ends:

```ts
  | "new-listing"
  | "search-match";
```

and add to its comment, before the closing `*/`, on its own ` * ` line: ` Saved-search alerts add a saved search's new match (search alerts spec 2.12).`

2. Append to the end of the file:

```ts

// --- Saved-search alerts (search alerts plan, Task 1) -------------------------------------------------------------

/**
 * What a listing is matched against (search alerts spec 2.1 and 2.2, plan decision 2): browse's search without its
 * order. The browse page's query is one, and so is a saved search.
 */
export type MatchQuery = Omit<SearchQuery, "sort">;

/** Whether this account can save the browse page's search (search alerts spec 2.6). */
export type SaveSearchState = "new" | "saved" | "limit";

/** One of the account's saved searches, as Saved's Searches tab shows it (search alerts spec 2.7). */
export type SavedSearchItem = {
  id: string;
  /** "“calculator” in Tech at Midrand, under R100" (spec 2.3). */
  label: string;
  /** Its results, with the campus pinned. */
  href: string;
  /** When it was saved, ISO 8601 in UTC. */
  savedAt: string;
  paused: boolean;
};
```

Run: `pnpm typecheck`
Expected: PASS. (`KindIcon` in `NotificationsView.tsx` has no case for the new kind yet; a `switch` that falls through returns nothing, which TypeScript allows here. Task 6 adds the icon.)

- [ ] **Step 2: Change the store's test first**

In `lib/data/store.test.ts`, in the "is seeded with …, and nothing else" test, add at its end (after H's `expect(store.follows.size).toBe(0);`):

```ts
    expect(store.savedSearches.size).toBe(0);
```

and add ", no saved searches" before ", and nothing else" in its name.

Run: `pnpm test lib/data/store.test.ts`
Expected: FAIL: the store has no `savedSearches`.

- [ ] **Step 3: The row and the table**

In `lib/data/rows.ts`:
1. Add `CampusChoice`, `PayFilter` and `PriceFilter` to the `import type { … } from "@/lib/types";` block, keeping the names in alphabetical order.
2. In E's `NotificationRow`, replace H's comment on `count` with:

```ts
  /**
   * How many new listings a "new-listing" or "search-match" notification is about since it was last read (community
   * actions spec 2.19, search alerts spec 2.12). Absent means one.
   */
```

3. Append to the end of the file:

```ts

// --- Saved-search alerts (search alerts plan, Task 1; "Store design") ---------------------------------------------

/**
 * A saved search (search alerts spec 2.1): browse's filters, the campus always pinned, and when its alerts were
 * paused. Category and campus names aren't kept: its label looks them up each time it's shown.
 */
export type SavedSearchRow = {
  /** "ss-" and a UUID. */
  id: string;
  accountId: string;
  /** As typed, trimmed and cut to 100 characters; null when it has no search words (plan decision 2). */
  q: string | null;
  category: string | null;
  /** A campus slug, or "all". */
  campus: CampusChoice;
  price: PriceFilter | null;
  pay: PayFilter | null;
  deals: "free-and-swaps" | null;
  createdAt: string;
  /** When its alerts were paused; null while they're on. */
  pausedAt: string | null;
};
```

In `lib/data/store.ts`:
1. Add `SavedSearchRow` to the `import type { … } from "./rows";` block, in alphabetical order.
2. In the `SampleStore` type, after H's `follows: Map<string, FollowRow>;`, add:

```ts
  /** By id: saved searches (search alerts spec 2.1). */
  savedSearches: Map<string, SavedSearchRow>;
```

3. Add one to `STORE_VERSION` (5 after H, so 6).
4. In `seedStore()`'s returned object, after H's `follows: new Map(),`, add:

```ts
    savedSearches: new Map(),
```

Run: `pnpm test lib/data/store.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the matcher's tests**

In `lib/browse/results.test.ts`:
1. Change `import type { Listing, SearchQuery } from "@/lib/types";` to `import type { Listing, MatchQuery, SearchQuery } from "@/lib/types";`, change `import { findListings, passesFilters } from "./results";` to `import { findListings, listingMatches, passesFilters } from "./results";`, and add, above the `@/tests/helpers/fakes` import:

```ts
import { categories } from "@/data/fixtures/categories";
import { listings } from "@/data/fixtures/listings";
import { sellers } from "@/data/fixtures/sellers";
```

2. Add at the end of the file:

```ts

const match = (overrides: Partial<MatchQuery> = {}): MatchQuery => ({
  q: null,
  category: null,
  campus: "all",
  price: null,
  pay: null,
  deals: null,
  ...overrides,
});

describe("listingMatches (search alerts spec 2.2, plan decision 1)", () => {
  it("gives a matching listing's Best match score, and null for one that doesn't match", () => {
    const listing = makeListing({ title: "Casio calculator", description: "Barely used." });
    const query = match({ q: "casio", category: "tech", campus: "midrand" });
    expect(listingMatches(listing, query, names)).toBe(3);
    expect(listingMatches(listing, { ...query, q: null }, names)).toBe(0);
    expect(listingMatches(listing, { ...query, campus: "all" }, names)).toBe(3);
    expect(listingMatches(listing, { ...query, campus: "pretoria" }, names)).toBeNull();
    expect(listingMatches(listing, { ...query, category: "food" }, names)).toBeNull();
    expect(listingMatches(listing, { ...query, price: "under-50" }, names)).toBeNull();
    expect(listingMatches(listing, { ...query, q: "sharp" }, names)).toBeNull();
    expect(listingMatches({ ...listing, availability: "paused" }, query, names)).toBeNull();
  });

  it("agrees with findListings on every sample listing, so browse and the alerts can't drift apart", () => {
    const sampleNames = {
      sellers: new Map(sellers.map((seller) => [seller.slug, seller.name])),
      categories: new Map(categories.map((category) => [category.slug, category.name])),
    };
    const queries = [
      match(),
      match({ q: "calculator" }),
      match({ q: "calculater" }),
      match({ q: "Tech corner" }),
      match({ q: "the" }),
      match({ category: "tech", campus: "midrand" }),
      match({ q: "textbook", price: "under-250" }),
      match({ pay: "swap" }),
      match({ deals: "free-and-swaps", campus: "pretoria" }),
      match({ category: "tutoring", campus: "online" }),
    ];
    let found = 0;
    for (const query of queries) {
      const fromBrowse = ids(findListings(listings, { ...query, sort: "new" }, sampleNames).items).sort();
      const fromAlerts = listings
        .filter((listing) => listingMatches(listing, query, sampleNames) !== null)
        .map((listing) => listing.id)
        .sort();
      expect(fromAlerts, JSON.stringify(query)).toEqual(fromBrowse);
      found += fromBrowse.length;
    }
    expect(found).toBeGreaterThan(0);
  });
});
```

Run: `pnpm test lib/browse/results.test.ts`
Expected: FAIL: `listingMatches` isn't exported.

- [ ] **Step 5: Pull the per-listing test out of findListings**

In `lib/browse/results.ts`:
1. Change `import type { BrowseSort, Listing, PriceFilter, SearchQuery, SearchResult } from "@/lib/types";` to `import type { BrowseSort, Listing, MatchQuery, PriceFilter, SearchQuery, SearchResult } from "@/lib/types";`.
2. Replace `findListings` and its comment (from `/**` above `export function findListings` to the end of the file) with:

```ts
/**
 * The per-listing test (browse and listing spec 4.8 and 4.9; search alerts spec 2.2): an available listing in the
 * query's category and campus that passes its price, pay and deals filters and has every one of its words. Its Best
 * match score when it matches; null when it doesn't. Browse's results and saved-search alerts both call it, so they
 * can't disagree.
 */
export function listingMatches(listing: Listing, query: MatchQuery, names: ListingNames): number | null {
  if (listing.availability !== "available") return null;
  if (query.category && listing.categorySlug !== query.category) return null;
  if (query.campus !== ALL_CAMPUSES && listing.campusSlug !== query.campus) return null;
  if (!passesFilters(listing, query)) return null;
  return matchScore(
    {
      title: listing.title,
      category: names.categories.get(listing.categorySlug) ?? "",
      seller: names.sellers.get(listing.sellerSlug) ?? "",
      description: listing.description,
    },
    queryWords(query.q),
  );
}

/**
 * Every available listing that matches the query, sorted (spec 4.8 and 4.9), and how many matches sit at other
 * campuses when the query is for one campus (for the empty state, spec 4.7). A listing at another campus counts when
 * it would match with every campus.
 */
export function findListings(all: readonly Listing[], query: SearchQuery, names: ListingNames): SearchResult {
  const everyCampus = { ...query, campus: ALL_CAMPUSES };
  const found: Scored[] = [];
  let elsewhere = 0;

  for (const listing of all) {
    if (query.campus === ALL_CAMPUSES || listing.campusSlug === query.campus) {
      const score = listingMatches(listing, query, names);
      if (score !== null) found.push({ listing, score });
    } else if (listingMatches(listing, everyCampus, names) !== null) {
      elsewhere += 1;
    }
  }

  found.sort(COMPARE[query.sort]);
  return { items: found.map((entry) => entry.listing), elsewhere };
}
```

Run: `pnpm test lib/browse`
Expected: PASS: the two new tests, and every one of browse's own (`results.test.ts`, `query.test.ts`, `search.test.ts`, `filters.test.ts`, `href.test.ts`, `heading.test.ts`) unchanged.

Run: `pnpm test components/browse lib/data/index.test.ts`
Expected: PASS: the browse page's components and the data layer's search give the same results as before.

- [ ] **Step 6: Saved's third tab's address**

In `lib/following/rules.test.ts` (H Task 2), add at the end of the file:

```ts

describe("Saved's Searches tab (search alerts spec 2.7, plan decision 10)", () => {
  it("has an address of its own", () => {
    expect(savedTabPath("searches")).toBe("/saved?tab=searches");
  });
});
```

Run: `pnpm test lib/following/rules.test.ts`
Expected: FAIL: the address comes back as `/saved` (Vitest doesn't check types; `pnpm typecheck` would also reject `"searches"`).

In `lib/following/rules.ts`, replace `export type SavedTab = "listings" | "shops";` with:

```ts
/** Saved's tabs (community actions spec 2.17; search alerts spec 2.7). parseSavedTab learns "searches" in Task 5. */
export type SavedTab = "listings" | "shops" | "searches";
```

and replace `savedTabPath`'s body with:

```ts
  return tab === "listings" ? "/saved" : `/saved?tab=${tab}`;
```

Leave `parseSavedTab` as it is: until Task 5 renders the tab, `?tab=searches` must keep opening Listings, never Shops (plan decision 10).

Run: `pnpm test lib/following/rules.test.ts`
Expected: PASS, H's tests unchanged.

- [ ] **Step 7: Write the rules' and words' tests**

Create `lib/saved-searches/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { knownSlugs } from "@/lib/browse/query";
import type { MatchQuery } from "@/lib/types";
import {
  browseFrom,
  filterWords,
  isWorthSaving,
  matchQueryOf,
  SAVED_SEARCH_LIMIT,
  SAVED_SEARCHES_FORM,
  SAVED_SEARCHES_PATH,
  saveNoteOf,
  saveSearchNoteKey,
  savedSearchFrom,
  savedSearchHref,
  savedSearchLabel,
  savedSearchNoticeOf,
  searchKey,
} from "./rules";

const KNOWN = knownSlugs(campuses, categories);
const NAMES = {
  categories: new Map(categories.map((category) => [category.slug, category.name])),
  campuses: new Map(campuses.map((campus) => [campus.slug, campus.name])),
};

const search = (overrides: Partial<MatchQuery> = {}): MatchQuery => ({
  q: null,
  category: null,
  campus: "all",
  price: null,
  pay: null,
  deals: null,
  ...overrides,
});

describe("a saved search from Save this search's fields (search alerts spec 2.1, plan decision 2)", () => {
  it("reads them as browse reads its link, dropping sort and n", () => {
    const posted = {
      q: "  calculator ",
      cat: "tech",
      campus: "midrand",
      price: "under-100",
      pay: "cash",
      sort: "price-low",
      n: "48",
    };
    expect(savedSearchFrom(posted, KNOWN)).toEqual(
      search({ q: "calculator", category: "tech", campus: "midrand", price: "under-100", pay: "cash" }),
    );
  });

  it("takes browse's max alias, ignores unknown values and cuts the words at 100 characters", () => {
    const posted = { q: "x".repeat(120), cat: "nope", campus: "nowhere", max: "250", pay: "card", deals: "free-and-swaps" };
    expect(savedSearchFrom(posted, KNOWN)).toEqual(
      search({ q: "x".repeat(100), price: "under-250", deals: "free-and-swaps" }),
    );
  });

  it("always has a campus: the one posted, or every campus", () => {
    expect(savedSearchFrom({ q: "lamp", campus: "online" }, KNOWN).campus).toBe("online");
    expect(savedSearchFrom({ q: "lamp" }, KNOWN).campus).toBe("all");
  });

  it("keeps no words when there are only stop words and single letters", () => {
    expect(savedSearchFrom({ q: "the a", cat: "tech" }, KNOWN)).toEqual(search({ category: "tech" }));
    expect(matchQueryOf(search({ q: "Accounting 1" })).q).toBe("Accounting 1");
  });
});

describe("what's worth saving, and when two are the same (spec 2.4, plan decision 3)", () => {
  it("needs words, a category or a filter; a campus alone isn't a search", () => {
    expect(isWorthSaving(search({ campus: "midrand" }))).toBe(false);
    expect(isWorthSaving(search({ q: "the" }))).toBe(false);
    expect(isWorthSaving(search({ q: "lamp" }))).toBe(true);
    expect(isWorthSaving(search({ category: "tech" }))).toBe(true);
    expect(isWorthSaving(search({ price: "free" }))).toBe(true);
    expect(isWorthSaving(search({ pay: "swap" }))).toBe(true);
    expect(isWorthSaving(search({ deals: "free-and-swaps" }))).toBe(true);
    expect(SAVED_SEARCH_LIMIT).toBe(20);
  });

  it("treats word order, case, accents, stop words and repeats as the same search, and any other filter as another", () => {
    const key = searchKey(search({ q: "Calculator casio", campus: "midrand" }));
    expect(searchKey(search({ q: "casio calculator", campus: "midrand" }))).toBe(key);
    expect(searchKey(search({ q: "CÁSIO the calculator calculator", campus: "midrand" }))).toBe(key);
    expect(searchKey(search({ q: "casio calculator", campus: "pretoria" }))).not.toBe(key);
    expect(searchKey(search({ q: "casio calculator", campus: "midrand", pay: "cash" }))).not.toBe(key);
    expect(searchKey(search({ q: "casio", campus: "midrand" }))).not.toBe(key);
  });
});

describe("the label (spec 2.3, plan decision 4)", () => {
  it("names the words, the category, the campus, then the filters in the chips' words and order", () => {
    const label = (overrides: Partial<MatchQuery>) => savedSearchLabel(search(overrides), NAMES);
    expect(label({ q: "calculator", category: "tech", campus: "midrand", price: "under-100" })).toBe(
      "“calculator” in Tech at Midrand, under R100",
    );
    expect(label({ q: "calculator", campus: "midrand" })).toBe("“calculator” at Midrand");
    expect(label({ category: "tech" })).toBe("Tech at every campus");
    expect(label({ campus: "online", price: "free" })).toBe("Everything on Eduvos Online, free");
    expect(label({ category: "res-living", campus: "pretoria", pay: "swap", deals: "free-and-swaps" })).toBe(
      "Res & living at Pretoria, swaps, free & swaps",
    );
    expect(filterWords(search({ price: "under-500", pay: "cash" }))).toEqual(["under R500", "cash"]);
  });
});

describe("links (spec 2.5, 2.7 and 2.12; plan decisions 5 and 9)", () => {
  it("opens a saved search's results with the campus pinned: Best match with words, Newest without", () => {
    expect(savedSearchHref(search({ q: "casio calculator", campus: "midrand" }))).toBe(
      "/browse?q=casio+calculator&campus=midrand",
    );
    expect(savedSearchHref(search({ category: "tech" }))).toBe("/browse?cat=tech&campus=all");
  });

  it("opens them Newest first for a notification about several", () => {
    expect(savedSearchHref(search({ q: "calculator", campus: "midrand" }), "new")).toBe(
      "/browse?q=calculator&campus=midrand&sort=new",
    );
    expect(savedSearchHref(search({ category: "tech" }), "new")).toBe("/browse?cat=tech&campus=all");
  });

  it("goes back only to a browse link on this site", () => {
    expect(browseFrom("/browse?q=lamp&campus=midrand")).toBe("/browse?q=lamp&campus=midrand");
    expect(browseFrom("/browse")).toBe("/browse");
    expect(browseFrom("/browsers")).toBeNull();
    expect(browseFrom("/saved")).toBeNull();
    expect(browseFrom("//evil.example/browse")).toBeNull();
    expect(browseFrom("https://evil.example/browse")).toBeNull();
    expect(browseFrom("")).toBeNull();
  });

  it("keeps the Searches tab's address and the status lines' keys", () => {
    expect(SAVED_SEARCHES_PATH).toBe("/saved?tab=searches");
    expect(SAVED_SEARCHES_FORM).toBe("saved-searches");
    expect(saveSearchNoteKey(search({ q: "Casio calculator", campus: "midrand" }))).toBe(
      "save-search:calculator casio||midrand|||",
    );
  });
});

describe("status lines (plan decision 7)", () => {
  it("reads what the last Save this search said", () => {
    expect(saveNoteOf({ errors: [], notice: "saved" })).toBe("saved");
    expect(saveNoteOf({ errors: ["already"], notice: null })).toBe("already");
    expect(saveNoteOf({ errors: ["limit"], notice: null })).toBe("limit");
    expect(saveNoteOf({ errors: ["toString"], notice: null })).toBeNull();
    expect(saveNoteOf(null)).toBeNull();
  });

  it("reads what the Searches tab's last press did, to which search", () => {
    const values = { label: "“lamp” at Midrand", href: "/browse?q=lamp&campus=midrand" };
    expect(savedSearchNoticeOf({ notice: "deleted", values })).toEqual({ code: "deleted", ...values });
    expect(savedSearchNoticeOf({ notice: "paused", values })).toEqual({ code: "paused", ...values });
    expect(savedSearchNoticeOf({ notice: "saved", values })).toBeNull();
    expect(savedSearchNoticeOf(null)).toBeNull();
  });
});
```

Create `lib/saved-searches/words.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ALREADY_SAVED_LINE,
  alertsNoticeText,
  AT_LIMIT_LINE,
  MANAGE_SEARCHES,
  SAVE_SEARCH_BUTTON,
  SAVE_SEARCH_PROMPT,
  saveNoteText,
  savedSearchesCount,
  SEARCHES_NOTE,
  searchMatchesText,
  searchMatchText,
} from "./words";

describe("saved searches' words (search alerts spec 2.6 to 2.8 and 2.12)", () => {
  it("has the browse row's lines (spec 2.6)", () => {
    expect(SAVE_SEARCH_PROMPT).toBe("Hear when something new matches.");
    expect(SAVE_SEARCH_BUTTON).toBe("Save this search");
    expect(MANAGE_SEARCHES).toBe("Manage saved searches");
    expect(ALREADY_SAVED_LINE).toBe("You've saved this search.");
    expect(AT_LIMIT_LINE).toBe("You have 20 saved searches.");
    expect(saveNoteText("saved")).toBe("Search saved.");
    expect(saveNoteText("already")).toBe("You've saved this search already.");
    expect(saveNoteText("limit")).toBe("You have 20 saved searches. Delete one first.");
  });

  it("has the Searches tab's words (spec 2.7 and section 4)", () => {
    expect(SEARCHES_NOTE).toBe("Kept with your account. Each search sends at most one notification a day.");
    expect(savedSearchesCount(1)).toBe("1 saved search");
    expect(savedSearchesCount(3)).toBe("3 saved searches");
    expect(alertsNoticeText("paused", "“lamp” at Midrand")).toBe("Alerts paused for “lamp” at Midrand.");
    expect(alertsNoticeText("resumed", "“lamp” at Midrand")).toBe("Alerts on for “lamp” at Midrand.");
  });

  it("writes the notification, one match and then several (spec 2.12)", () => {
    expect(searchMatchText("Casio fx-991ZA Plus calculator", "“calculator” at Midrand")).toBe(
      "Casio fx-991ZA Plus calculator matches your search “calculator” at Midrand",
    );
    expect(searchMatchesText(3, "“calculator” at Midrand")).toBe(
      "3 new listings match your search “calculator” at Midrand",
    );
  });
});
```

Run: `pnpm test lib/saved-searches`
Expected: FAIL, because `./rules` and `./words` don't exist.

- [ ] **Step 8: Write the rules and the words**

Create `lib/saved-searches/rules.ts`:

```ts
import { DEALS_LABEL, PAY_LABELS, PRICE_LABELS } from "@/lib/browse/filters";
import { browseHref } from "@/lib/browse/href";
import { defaultSort, PAGE_SIZE, parseBrowseParams, type BrowseParams, type KnownSlugs } from "@/lib/browse/query";
import { queryWords } from "@/lib/browse/search";
import { ALL_CAMPUSES, ONLINE_CAMPUS } from "@/lib/campus";
import { savedTabPath } from "@/lib/following/rules";
import { safeNextPath } from "@/lib/next-path";
import type { MatchQuery } from "@/lib/types";

// Saved searches (search alerts spec 2.1 to 2.8; plan decisions 2 to 5, 7 and 9): what one is, when two are the same,
// what's worth saving, its label and links, and where the status lines wait. Plain functions over browse's own
// parser and search words, so a saved search, its link and its alert always agree.

/** The most an account keeps (spec 2.4). */
export const SAVED_SEARCH_LIMIT = 20;

/** The fields Save this search posts (spec 2.5), read as browse reads its link. `max` is browse's price alias. */
export const SEARCH_FIELDS = ["q", "cat", "campus", "price", "max", "pay", "deals"] as const;

/** Saved's Searches tab (spec 2.7). */
export const SAVED_SEARCHES_PATH = savedTabPath("searches");

/** Where Pause, Resume and Delete leave the Searches tab's status line (plan decision 7). */
export const SAVED_SEARCHES_FORM = "saved-searches";

/**
 * A search as it's matched and saved (plan decision 2): browse's query without its order or paging. Words that are
 * all stop words or single letters match like none, so they're kept as null.
 */
export function matchQueryOf({ q, category, campus, price, pay, deals }: MatchQuery): MatchQuery {
  return { q: queryWords(q).length > 0 ? q : null, category, campus, price, pay, deals };
}

/**
 * A saved search from Save this search's fields (spec 2.1), read with browse's own parser, so the max alias, unknown
 * values and the 100-character cut work as they do on the page. The form always posts the campus; a post without
 * one is for every campus. Sort and n are dropped.
 */
export function savedSearchFrom(params: BrowseParams, known: KnownSlugs): MatchQuery {
  return matchQueryOf(parseBrowseParams(params, ALL_CAMPUSES, known));
}

/** Worth saving (spec 2.4): words, a category, or a price, pay or deals filter. A campus alone isn't. */
export function isWorthSaving(search: MatchQuery): boolean {
  return (
    queryWords(search.q).length > 0 ||
    search.category !== null ||
    search.price !== null ||
    search.pay !== null ||
    search.deals !== null
  );
}

/**
 * Two searches are the same (spec 2.4, plan decision 3) when they have the same set of words and the same filters:
 * "Calculator casio" is "casio calculator", and case, accents, stop words and repeats don't count.
 */
export function searchKey(search: MatchQuery): string {
  const words = [...new Set(queryWords(search.q))].sort();
  return [
    words.join(" "),
    search.category ?? "",
    search.campus,
    search.price ?? "",
    search.pay ?? "",
    search.deals ?? "",
  ].join("|");
}

/** Category and campus names by slug, for the label. */
export type SearchNames = {
  categories: ReadonlyMap<string, string>;
  campuses: ReadonlyMap<string, string>;
};

/** A browse chip's words inside a sentence: "Under R100" becomes "under R100". */
const inSentence = (chip: string) => chip.charAt(0).toLowerCase() + chip.slice(1);

/** The filters' words, in the browse chips' order (spec 2.3): "under R100", "cash", "free & swaps". */
export function filterWords(search: Pick<MatchQuery, "price" | "pay" | "deals">): string[] {
  const words: string[] = [];
  if (search.price) words.push(inSentence(PRICE_LABELS[search.price]));
  if (search.pay) words.push(inSentence(PAY_LABELS[search.pay]));
  if (search.deals) words.push(inSentence(DEALS_LABEL));
  return words;
}

/** " at Midrand", " on Eduvos Online" or " at every campus" (spec 2.3). */
function campusWords(campus: string, names: SearchNames): string {
  if (campus === ALL_CAMPUSES) return " at every campus";
  if (campus === ONLINE_CAMPUS) return " on Eduvos Online";
  return ` at ${names.campuses.get(campus) ?? campus}`;
}

/**
 * A saved search's name (spec 2.3, plan decision 4), built from the query whenever it's shown: "“calculator” in Tech
 * at Midrand, under R100", "Tech at every campus", "Everything on Eduvos Online, free". It can't be renamed.
 */
export function savedSearchLabel(search: MatchQuery, names: SearchNames): string {
  const category = search.category ? (names.categories.get(search.category) ?? search.category) : null;
  let what = category ?? "Everything";
  if (search.q) what = category ? `“${search.q}” in ${category}` : `“${search.q}”`;
  return [`${what}${campusWords(search.campus, names)}`, ...filterWords(search)].join(", ");
}

/**
 * A saved search's results (spec 2.7, plan decision 5): browse's link with the campus pinned, so it never depends on
 * one device's cookie. "new" is for a notification about several new listings (spec 2.12): Newest first.
 */
export function savedSearchHref(search: MatchQuery, sort?: "new"): string {
  return browseHref({ ...search, campusFromLink: true, sort: sort ?? defaultSort(search.q), shown: PAGE_SIZE });
}

/** Save this search's `from` (spec 2.5, plan decision 9): a browse link on this site, or null. */
export function browseFrom(raw: string): string | null {
  const path = safeNextPath(raw);
  return path && (path === "/browse" || path.startsWith("/browse?")) ? path : null;
}

/** Where the browse row's status line waits, so it shows only on its own search's row (plan decision 7). */
export function saveSearchNoteKey(search: MatchQuery): string {
  return `save-search:${searchKey(search)}`;
}

/** What the last Save this search said (spec 2.6): saved, or why not. */
export type SaveNote = "saved" | "already" | "limit";

export function saveNoteOf(state: { errors: readonly string[]; notice: string | null } | null): SaveNote | null {
  if (!state) return null;
  if (state.notice === "saved") return "saved";
  const [error] = state.errors;
  return error === "already" || error === "limit" ? error : null;
}

/** The Searches tab's status line (plan decision 7): what was done, to which search, and where its results are. */
export type SavedSearchNotice = { code: "paused" | "resumed" | "deleted"; label: string; href: string };

export function savedSearchNoticeOf(
  state: { notice: string | null; values: Record<string, string> } | null,
): SavedSearchNotice | null {
  if (!state) return null;
  const { notice, values } = state;
  if (notice !== "paused" && notice !== "resumed" && notice !== "deleted") return null;
  return { code: notice, label: values.label ?? "", href: values.href ?? SAVED_SEARCHES_PATH };
}
```

Create `lib/saved-searches/words.ts`:

```ts
import { SAVED_SEARCH_LIMIT, type SaveNote } from "./rules";

// Saved searches' words (search alerts spec 2.6 to 2.8 and 2.12; plan decisions 14 and 18): the browse row's lines,
// the Searches tab's note, count and status lines, and the notification's sentences. Samples for Lama to change.

/** The row's line before a save, signed in or out (spec 2.6). */
export const SAVE_SEARCH_PROMPT = "Hear when something new matches.";
export const SAVE_SEARCH_BUTTON = "Save this search";
export const MANAGE_SEARCHES = "Manage saved searches";
export const ALREADY_SAVED_LINE = "You've saved this search.";
export const AT_LIMIT_LINE = `You have ${SAVED_SEARCH_LIMIT} saved searches.`;

/** The line after a press (spec 2.6): a status after a save, an alert after a refusal. */
export function saveNoteText(note: SaveNote): string {
  switch (note) {
    case "saved":
      return "Search saved.";
    case "already":
      return "You've saved this search already.";
    case "limit":
      return `You have ${SAVED_SEARCH_LIMIT} saved searches. Delete one first.`;
  }
}

/** The Searches tab's note (spec 2.7). */
export const SEARCHES_NOTE = "Kept with your account. Each search sends at most one notification a day.";

/** "1 saved search", "3 saved searches". */
export function savedSearchesCount(count: number): string {
  return count === 1 ? "1 saved search" : `${count} saved searches`;
}

/** Pause's and Resume's status lines (spec section 4). Delete's links its label, so the view writes it (spec 2.8). */
export function alertsNoticeText(code: "paused" | "resumed", label: string): string {
  return code === "paused" ? `Alerts paused for ${label}.` : `Alerts on for ${label}.`;
}

/** A saved search's first match of the day, or its first since it was read (spec 2.12), linking to the listing. */
export function searchMatchText(title: string, label: string): string {
  return `${title} matches your search ${label}`;
}

/** The same notification once more match while it's unread, linking to the results, Newest first. */
export function searchMatchesText(count: number, label: string): string {
  return `${count} new listings match your search ${label}`;
}
```

Run: `pnpm test lib/saved-searches`
Expected: PASS (16 tests).

- [ ] **Step 9: Write the notifications' tests**

In `lib/data/notifications.test.ts`, add `notifySearchMatch` to the import from `./notifications` (with `notifyNewListing` and `markNotificationsRead`, which H added), keeping the names in alphabetical order, and add at the end of the file:

```ts

describe("a saved search's matches (search alerts spec 2.12, plan decision 12)", () => {
  const SEARCH = {
    accountId: "acc-student",
    savedSearchId: "ss-1",
    label: "“calculator” at Midrand",
    resultsHref: "/browse?q=calculator&campus=midrand&sort=new",
  };
  // 10:00, 14:00 and 18:00 on Wednesday 14 October in SAST, then 00:01 on Thursday.
  const morning = new Date("2026-10-14T08:00:00.000Z");
  const afternoon = new Date("2026-10-14T12:00:00.000Z");
  const evening = new Date("2026-10-14T16:00:00.000Z");
  const nextDay = new Date("2026-10-14T22:01:00.000Z");
  const casio = { id: "l-001", title: "Casio fx-991ZA Plus calculator" };
  const sharp = { id: "l-026", title: "Sharp scientific calculator" };
  const lamp = { id: "l-016", title: "Desk lamp" };
  const matches = async () =>
    (await getNotifications("acc-student", 50)).filter((item) => item.kind === "search-match");

  it("names the first match of the day, linking to it", async () => {
    expect(await notifySearchMatch({ ...SEARCH, listing: casio, now: morning })).toBe(true);
    expect(await matches()).toMatchObject([
      {
        text: "Casio fx-991ZA Plus calculator matches your search “calculator” at Midrand",
        href: "/listings/l-001",
        isNew: true,
      },
    ]);
  });

  it("counts more while it's unread, linking to the results Newest first and moving to the top", async () => {
    await notifySearchMatch({ ...SEARCH, listing: casio, now: morning });
    await notifySearchMatch({ ...SEARCH, listing: sharp, now: afternoon });
    await notifySearchMatch({ ...SEARCH, listing: lamp, now: evening });
    expect(await matches()).toMatchObject([
      {
        text: "3 new listings match your search “calculator” at Midrand",
        href: SEARCH.resultsHref,
        createdAt: evening.toISOString(),
        isNew: true,
      },
    ]);
  });

  it("makes a read one unread again, counting only the matches since it was read", async () => {
    await notifySearchMatch({ ...SEARCH, listing: casio, now: morning });
    await markNotificationsRead("acc-student", morning);
    expect(await notifySearchMatch({ ...SEARCH, listing: sharp, now: afternoon })).toBe(true);
    expect(await matches()).toMatchObject([
      {
        text: "Sharp scientific calculator matches your search “calculator” at Midrand",
        href: "/listings/l-026",
        createdAt: afternoon.toISOString(),
        isNew: true,
      },
    ]);
    await notifySearchMatch({ ...SEARCH, listing: lamp, now: evening });
    expect(await matches()).toMatchObject([
      { text: "2 new listings match your search “calculator” at Midrand", href: SEARCH.resultsHref, isNew: true },
    ]);
  });

  it("starts a new one on a new SAST day", async () => {
    await notifySearchMatch({ ...SEARCH, listing: casio, now: morning });
    await notifySearchMatch({ ...SEARCH, listing: sharp, now: nextDay });
    expect((await matches()).map((item) => item.text)).toEqual([
      "Sharp scientific calculator matches your search “calculator” at Midrand",
      "Casio fx-991ZA Plus calculator matches your search “calculator” at Midrand",
    ]);
  });

  it("keeps each saved search's notification apart", async () => {
    await notifySearchMatch({ ...SEARCH, listing: casio, now: morning });
    await notifySearchMatch({ ...SEARCH, savedSearchId: "ss-2", label: "Tech at every campus", listing: casio, now: morning });
    expect(await matches()).toHaveLength(2);
  });

  it("still never reopens a followed shop's new-listing notification (community actions plan decision 15)", async () => {
    const shop = { accountId: "acc-student", sellerSlug: "tech-corner", shopName: "Tech corner" };
    await notifyNewListing({ ...shop, listing: casio, now: morning });
    await markNotificationsRead("acc-student", morning);
    await notifyNewListing({ ...shop, listing: { id: "l-007", title: "Gaming headset, barely used" }, now: evening });
    const newListings = (await getNotifications("acc-student", 50)).filter((item) => item.kind === "new-listing");
    expect(newListings).toMatchObject([{ text: "Tech corner listed Casio fx-991ZA Plus calculator", isNew: false }]);
  });
});
```

Run: `pnpm test lib/data/notifications.test.ts`
Expected: FAIL: `notifySearchMatch` doesn't exist.

- [ ] **Step 10: One rule, two kinds**

In `lib/data/notifications.ts`:
1. Add `import { searchMatchesText, searchMatchText } from "@/lib/saved-searches/words";` among the `@/lib/…` imports, in alphabetical order (after H's `@/lib/following/rules` import, before `@/lib/time`).
2. Replace H's `notifyNewListing` and its comment (from the `/**` above `export async function notifyNewListing` to that function's closing `}`) with:

```ts
/** What a once-a-day notification says, and where it leads. */
type NoteWords = { text: string; href: string };

/**
 * One notification a SAST day about one thing (community actions plan decision 15; search alerts spec 2.12, plan
 * decision 12). The day's first says `first`. Another that day, while it's unread, says `more(count)` and moves to the
 * top. Once it's been read, `reopenWhenRead` decides: off, the day's later ones make none (a followed shop's new
 * listings); on, the next one makes it unread again and moves it to the top, counting from one, so nothing is missed
 * (a saved search's matches). True when it made or changed a notification.
 */
async function notifyOncePerDay({
  accountId,
  kind,
  subjectId,
  first,
  more,
  reopenWhenRead,
  now,
}: {
  accountId: string;
  kind: NotificationKind;
  subjectId: string;
  first: NoteWords;
  more: (count: number) => NoteWords;
  reopenWhenRead: boolean;
  now: Date;
}): Promise<boolean> {
  const today = sastDate(now);
  for (const row of sampleStore().notifications.values()) {
    if (row.accountId !== accountId || row.kind !== kind || row.subjectId !== subjectId) continue;
    if (sastDate(new Date(row.createdAt)) !== today) continue;
    if (row.readAt !== null) {
      if (!reopenWhenRead) return false;
      // Unread again, counting only what came after it was read: this one, so it names it.
      row.count = 1;
      row.text = first.text;
      row.href = first.href;
      row.readAt = null;
    } else {
      const count = (row.count ?? 1) + 1;
      const words = more(count);
      row.count = count;
      row.text = words.text;
      row.href = words.href;
    }
    row.createdAt = now.toISOString();
    return true;
  }
  add({ accountId, kind, subjectId, text: first.text, href: first.href, now });
  return true;
}

/**
 * A followed shop's new listing (community actions spec 2.19, plan decision 15): one notification per shop per
 * follower per SAST day. The first names the listing and links to it. Another listing that day, while it's unread,
 * updates it ("Tech corner listed 2 new things", linking to the shop) and brings it to the top. Once it's read, the
 * shop's other listings that day make none.
 */
export async function notifyNewListing({
  accountId,
  sellerSlug,
  shopName,
  listing,
  now,
}: {
  accountId: string;
  sellerSlug: string;
  shopName: string;
  listing: { id: string; title: string };
  now: Date;
}): Promise<void> {
  await notifyOncePerDay({
    accountId,
    kind: "new-listing",
    subjectId: sellerSlug,
    first: { text: newListingText(shopName, listing.title), href: `/listings/${listing.id}` },
    more: (count) => ({ text: newListingsText(shopName, count), href: `/sellers/${sellerSlug}` }),
    reopenWhenRead: false,
    now,
  });
}

/**
 * A saved search's new match (search alerts spec 2.12, plan decisions 12 and 14): one notification per saved search
 * per SAST day. The first names the listing and links to it. More while it's unread make "3 new listings match your
 * search …", linking to the search's results, Newest first. A match after it's been read makes it unread again,
 * counting from that match. True when it made or changed one.
 */
export async function notifySearchMatch({
  accountId,
  savedSearchId,
  label,
  resultsHref,
  listing,
  now,
}: {
  accountId: string;
  savedSearchId: string;
  /** The saved search's label (spec 2.3), fixed in the sentence when it's written. */
  label: string;
  /** Its results, Newest first. */
  resultsHref: string;
  listing: { id: string; title: string };
  now: Date;
}): Promise<boolean> {
  return notifyOncePerDay({
    accountId,
    kind: "search-match",
    subjectId: savedSearchId,
    first: { text: searchMatchText(listing.title, label), href: `/listings/${listing.id}` },
    more: (count) => ({ text: searchMatchesText(count, label), href: resultsHref }),
    reopenWhenRead: true,
    now,
  });
}
```

(If H's built `notifyNewListing` has a different body but the same rule, replace it all the same, and say so in the hand-over. If its signature differs, keep the built signature and pass its values into `notifyOncePerDay` the same way.)

Run: `pnpm test lib/data/notifications.test.ts lib/data/follows.test.ts lib/data/shops.test.ts`
Expected: PASS: the six new tests, and H's "a followed shop's new listings" tests, follows' tests and `moveShop`'s test unchanged.

- [ ] **Step 11: Write the saved searches' tests**

Create `lib/data/saved-searches.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { MatchQuery } from "@/lib/types";
import { makeListingRow } from "@/tests/helpers/fakes";
import { getNotifications } from "./notifications";
import {
  addSavedSearch,
  deleteSavedSearch,
  exportSavedSearches,
  forgetSavedSearchesOf,
  getSaveSearchState,
  listSavedSearches,
  notifySavedSearches,
  setSavedSearchPaused,
} from "./saved-searches";
import { resetSampleStore, sampleStore } from "./store";

const at = (hour: number) => new Date(`2026-10-14T${String(hour).padStart(2, "0")}:00:00.000Z`);

/** "calculator" at Midrand, unless the test says otherwise. */
const search = (overrides: Partial<MatchQuery> = {}): MatchQuery => ({
  q: "calculator",
  category: null,
  campus: "midrand",
  price: null,
  pay: null,
  deals: null,
  ...overrides,
});

/** A listing Tech corner has just published (F's row: an available R100 tech item at Midrand), by its id. */
const publish = (overrides: Parameters<typeof makeListingRow>[0] = {}) => {
  const row = makeListingRow({ id: "l-new", title: "Casio calculator, barely used", ...overrides });
  sampleStore().listings.set(row.id, row);
  return row.id;
};

const matches = async (accountId: string) =>
  (await getNotifications(accountId, 50)).filter((item) => item.kind === "search-match");

const idOf = async (accountId: string, label: string) =>
  (await listSavedSearches(accountId)).find((item) => item.label === label)!.id;

beforeEach(() => {
  resetSampleStore();
});

describe("saving searches (search alerts spec 2.1 and 2.4)", () => {
  it("saves one with an ss- id, and lists them newest first with their labels and pinned links", async () => {
    expect(await addSavedSearch("acc-student", search({ category: "tech", price: "under-100" }), at(8))).toBe("saved");
    expect(await addSavedSearch("acc-student", search({ q: null, category: "res-living", campus: "all" }), at(9))).toBe(
      "saved",
    );
    expect(await listSavedSearches("acc-student")).toEqual([
      {
        id: expect.stringMatching(/^ss-[0-9a-f-]{36}$/),
        label: "Res & living at every campus",
        href: "/browse?cat=res-living&campus=all",
        savedAt: at(9).toISOString(),
        paused: false,
      },
      {
        id: expect.stringMatching(/^ss-[0-9a-f-]{36}$/),
        label: "“calculator” in Tech at Midrand, under R100",
        href: "/browse?q=calculator&cat=tech&campus=midrand&price=under-100",
        savedAt: at(8).toISOString(),
        paused: false,
      },
    ]);
    expect(await listSavedSearches("acc-mentor")).toEqual([]);
  });

  it("knows the same search in other words, whatever the case, accents or order", async () => {
    await addSavedSearch("acc-student", search({ q: "Casio calculator" }), at(8));
    expect(await addSavedSearch("acc-student", search({ q: "calculator CÁSIO" }), at(9))).toBe("already");
    expect(await getSaveSearchState("acc-student", search({ q: "casio calculator" }))).toBe("saved");
    expect(await getSaveSearchState("acc-student", search({ q: "casio" }))).toBe("new");
    expect(await getSaveSearchState("acc-student", search({ q: "casio calculator", campus: "all" }))).toBe("new");
    expect(sampleStore().savedSearches.size).toBe(1);
  });

  it("keeps 20 at most, and says so", async () => {
    for (let n = 0; n < 20; n += 1) await addSavedSearch("acc-student", search({ q: `lamp${n}` }), at(8));
    expect(await addSavedSearch("acc-student", search(), at(9))).toBe("limit");
    expect(await getSaveSearchState("acc-student", search())).toBe("limit");
    expect(await getSaveSearchState("acc-student", search({ q: "lamp3" }))).toBe("saved");
    expect(await addSavedSearch("acc-mentor", search(), at(9))).toBe("saved");
  });
});

describe("pausing, resuming and deleting (spec 2.8, plan decision 11)", () => {
  it("pauses and resumes the owner's search only, keeping when it was first paused", async () => {
    await addSavedSearch("acc-student", search(), at(8));
    const id = await idOf("acc-student", "“calculator” at Midrand");
    expect(await setSavedSearchPaused("acc-mentor", id, true, at(9))).toBeNull();
    expect(await setSavedSearchPaused("acc-student", id, true, at(9))).toMatchObject({
      id,
      label: "“calculator” at Midrand",
      paused: true,
    });
    expect(await setSavedSearchPaused("acc-student", id, true, at(10))).toMatchObject({ paused: true });
    expect(sampleStore().savedSearches.get(id)?.pausedAt).toBe(at(9).toISOString());
    expect(await setSavedSearchPaused("acc-student", id, false, at(11))).toMatchObject({ paused: false });
    expect(sampleStore().savedSearches.get(id)?.pausedAt).toBeNull();
  });

  it("deletes the owner's search with its notifications, saying what it was", async () => {
    await addSavedSearch("acc-student", search(), at(8));
    const id = await idOf("acc-student", "“calculator” at Midrand");
    await notifySavedSearches({ listingId: publish(), now: at(9) });
    expect(await matches("acc-student")).toHaveLength(1);
    expect(await deleteSavedSearch("acc-mentor", id)).toBeNull();
    expect(await deleteSavedSearch("acc-student", id)).toMatchObject({
      label: "“calculator” at Midrand",
      href: "/browse?q=calculator&campus=midrand",
    });
    expect(sampleStore().savedSearches.has(id)).toBe(false);
    expect(await matches("acc-student")).toEqual([]);
  });
});

describe("telling students about a new listing (spec 2.9 to 2.11, plan decision 13)", () => {
  it("tells a matching search's account, naming the listing", async () => {
    await addSavedSearch("acc-student", search(), at(8));
    expect(await notifySavedSearches({ listingId: publish(), now: at(9) })).toBe(1);
    expect(await matches("acc-student")).toMatchObject([
      {
        text: "Casio calculator, barely used matches your search “calculator” at Midrand",
        href: "/listings/l-new",
        isNew: true,
      },
    ]);
  });

  it("matches by browse's rules: the shop's name counts; another campus or category doesn't", async () => {
    await addSavedSearch("acc-student", search({ q: "tech corner", campus: "all" }), at(8));
    await addSavedSearch("acc-mentor", search({ campus: "pretoria" }), at(8));
    await addSavedSearch("acc-admin", search({ category: "food" }), at(8));
    expect(await notifySavedSearches({ listingId: publish(), now: at(9) })).toBe(1);
    expect(await matches("acc-student")).toHaveLength(1);
    expect(await matches("acc-mentor")).toEqual([]);
    expect(await matches("acc-admin")).toEqual([]);
  });

  it("tells an account once, under its oldest matching search", async () => {
    await addSavedSearch("acc-student", search({ q: null, category: "tech" }), at(7));
    await addSavedSearch("acc-student", search(), at(8));
    const oldest = await idOf("acc-student", "Tech at Midrand");
    await notifySavedSearches({ listingId: publish(), now: at(9) });
    expect(await matches("acc-student")).toMatchObject([
      { text: "Casio calculator, barely used matches your search Tech at Midrand" },
    ]);
    const rows = [...sampleStore().notifications.values()].filter((row) => row.kind === "search-match");
    expect(rows.map((row) => row.subjectId)).toEqual([oldest]);
  });

  it("skips paused searches, the shop's own owner, and listings buyers can't see", async () => {
    await addSavedSearch("acc-seller", search(), at(7));
    await addSavedSearch("acc-mentor", search(), at(7));
    await setSavedSearchPaused("acc-mentor", await idOf("acc-mentor", "“calculator” at Midrand"), true, at(7));
    expect(await notifySavedSearches({ listingId: publish(), now: at(9) })).toBe(0);
    await addSavedSearch("acc-student", search(), at(8));
    expect(await notifySavedSearches({ listingId: publish({ id: "l-draft", state: "draft" }), now: at(9) })).toBe(0);
    const hidden = publish({ id: "l-hidden", hiddenAt: at(8).toISOString(), hiddenReason: "Not allowed on Vossie." });
    expect(await notifySavedSearches({ listingId: hidden, now: at(9) })).toBe(0);
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect(await notifySavedSearches({ listingId: publish({ id: "l-paused-shop" }), now: at(9) })).toBe(0);
    expect(await notifySavedSearches({ listingId: "l-nope", now: at(9) })).toBe(0);
    expect(await matches("acc-student")).toEqual([]);
  });
});

describe("deleting an account, and its data export (spec 2.15, plan decision 15)", () => {
  it("forgets the account's saved searches and their notifications, and no one else's", async () => {
    await addSavedSearch("acc-student", search(), at(8));
    await addSavedSearch("acc-mentor", search(), at(8));
    await notifySavedSearches({ listingId: publish(), now: at(9) });
    await forgetSavedSearchesOf("acc-student");
    expect([...sampleStore().savedSearches.values()].map((row) => row.accountId)).toEqual(["acc-mentor"]);
    expect(await matches("acc-student")).toEqual([]);
    expect(await matches("acc-mentor")).toHaveLength(1);
  });

  it("exports each search by name, newest first, with no ids", async () => {
    await addSavedSearch("acc-student", search({ category: "tech", price: "under-100", pay: "cash" }), at(8));
    const textbooks = search({ q: null, category: "textbooks-notes", campus: "all", deals: "free-and-swaps" });
    await addSavedSearch("acc-student", textbooks, at(9));
    const label = "Textbooks & notes at every campus, free & swaps";
    await setSavedSearchPaused("acc-student", await idOf("acc-student", label), true, at(10));
    const exported = await exportSavedSearches("acc-student");
    expect(exported).toEqual([
      {
        label,
        words: null,
        category: "Textbooks & notes",
        campus: "Every campus",
        price: null,
        pay: null,
        deals: "Free & swaps",
        alerts: "paused",
        savedAt: at(9).toISOString(),
      },
      {
        label: "“calculator” in Tech at Midrand, under R100, cash",
        words: "calculator",
        category: "Tech",
        campus: "Midrand",
        price: "Under R100",
        pay: "Cash",
        deals: null,
        alerts: "on",
        savedAt: at(8).toISOString(),
      },
    ]);
    expect(JSON.stringify(exported)).not.toContain("ss-");
    expect(await exportSavedSearches("acc-mentor")).toEqual([]);
  });
});
```

Run: `pnpm test lib/data/saved-searches.test.ts`
Expected: FAIL: `./saved-searches` doesn't exist.

- [ ] **Step 12: Write the saved searches**

Create `lib/data/saved-searches.ts`:

```ts
import { randomUUID } from "node:crypto";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { DEALS_LABEL, PAY_LABELS, PRICE_LABELS } from "@/lib/browse/filters";
import { listingMatches } from "@/lib/browse/results";
import { ALL_CAMPUSES } from "@/lib/campus";
import {
  SAVED_SEARCH_LIMIT,
  savedSearchHref,
  savedSearchLabel,
  searchKey,
  type SearchNames,
} from "@/lib/saved-searches/rules";
import type { MatchQuery, SavedSearchItem, SaveSearchState } from "@/lib/types";
import { shopStatus, toListing } from "./catalog";
import { deleteNotificationsAbout, notifySearchMatch } from "./notifications";
import type { SavedSearchRow } from "./rows";
import { sampleStore } from "./store";

// Saved searches in the sample store (search alerts spec 2.1, 2.4, 2.7 to 2.11 and 2.15; plan decisions 2, 3, 11,
// 13 and 15). Only their owner ever sees them. Server Actions call the writes and pass `now`; only they make ids.
// Labels look up category and campus names each time they're shown.

const NAMES: SearchNames = {
  categories: new Map(categories.map((category) => [category.slug, category.name])),
  campuses: new Map(campuses.map((campus) => [campus.slug, campus.name])),
};

export type AddResult = "saved" | "already" | "limit";

/** The account's saved searches, newest first. */
function searchesOf(accountId: string): SavedSearchRow[] {
  return [...sampleStore().savedSearches.values()]
    .filter((row) => row.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** What a saved search matches, as browse's query does (plan decision 2). */
function queryOf({ q, category, campus, price, pay, deals }: SavedSearchRow): MatchQuery {
  return { q, category, campus, price, pay, deals };
}

function toItem(row: SavedSearchRow): SavedSearchItem {
  const search = queryOf(row);
  return {
    id: row.id,
    label: savedSearchLabel(search, NAMES),
    href: savedSearchHref(search),
    savedAt: row.createdAt,
    paused: row.pausedAt !== null,
  };
}

const sameAs = (search: MatchQuery) => {
  const key = searchKey(search);
  return (row: SavedSearchRow) => searchKey(queryOf(row)) === key;
};

/** Save this search (spec 2.4): refused when the account has the same search already, or 20 of them. */
export async function addSavedSearch(accountId: string, search: MatchQuery, now: Date): Promise<AddResult> {
  const mine = searchesOf(accountId);
  if (mine.some(sameAs(search))) return "already";
  if (mine.length >= SAVED_SEARCH_LIMIT) return "limit";
  const id = `ss-${randomUUID()}`;
  const { q, category, campus, price, pay, deals } = search;
  sampleStore().savedSearches.set(id, {
    id,
    accountId,
    q,
    category,
    campus,
    price,
    pay,
    deals,
    createdAt: now.toISOString(),
    pausedAt: null,
  });
  return "saved";
}

/** The browse row's state (spec 2.6): this search saved already, the account at 20, or new. */
export async function getSaveSearchState(accountId: string, search: MatchQuery): Promise<SaveSearchState> {
  const mine = searchesOf(accountId);
  if (mine.some(sameAs(search))) return "saved";
  return mine.length >= SAVED_SEARCH_LIMIT ? "limit" : "new";
}

/** Saved's Searches tab (spec 2.7): the account's saved searches, newest first, with their labels and links. */
export async function listSavedSearches(accountId: string): Promise<SavedSearchItem[]> {
  return searchesOf(accountId).map(toItem);
}

/**
 * Pause or Resume alerts (spec 2.8, plan decision 11) on one of the account's saved searches. A second pause keeps
 * the first time. Null when it isn't theirs.
 */
export async function setSavedSearchPaused(
  accountId: string,
  id: string,
  paused: boolean,
  now: Date,
): Promise<SavedSearchItem | null> {
  const row = sampleStore().savedSearches.get(id);
  if (!row || row.accountId !== accountId) return null;
  row.pausedAt = paused ? (row.pausedAt ?? now.toISOString()) : null;
  return toItem(row);
}

/** Delete (spec 2.8): the search and its notifications go. What it was, for the status line; null when not theirs. */
export async function deleteSavedSearch(accountId: string, id: string): Promise<SavedSearchItem | null> {
  const { savedSearches } = sampleStore();
  const row = savedSearches.get(id);
  if (!row || row.accountId !== accountId) return null;
  savedSearches.delete(id);
  await deleteNotificationsAbout("search-match", new Set([id]));
  return toItem(row);
}

/**
 * Tells the students whose saved searches match a listing published for the first time (spec 2.9 to 2.11, plan
 * decision 13), through notifySearchMatch's one-a-day rule. Each active search is tried with browse's own
 * listingMatches, on the listing as buyers see it, oldest search first; an account hears once, under its oldest
 * matching search, and never about its own shop. A listing buyers can't see (hidden, a draft, a paused or waiting
 * shop's) tells no one. How many accounts it told.
 */
export async function notifySavedSearches({ listingId, now }: { listingId: string; now: Date }): Promise<number> {
  const { listings, sellers, savedSearches } = sampleStore();
  const row = listings.get(listingId);
  const shop = row ? sellers.get(row.sellerSlug) : undefined;
  if (!row || !shop || row.hiddenAt || shopStatus(shop) !== "approved") return 0;
  const listing = toListing(row, shop);
  const names = { sellers: new Map([[shop.slug, shop.name]]), categories: NAMES.categories };
  const oldestFirst = [...savedSearches.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const told = new Set<string>();
  for (const saved of oldestFirst) {
    if (saved.pausedAt !== null || told.has(saved.accountId) || saved.accountId === shop.ownerId) continue;
    const search = queryOf(saved);
    if (listingMatches(listing, search, names) === null) continue;
    const notified = await notifySearchMatch({
      accountId: saved.accountId,
      savedSearchId: saved.id,
      label: savedSearchLabel(search, NAMES),
      resultsHref: savedSearchHref(search, "new"),
      listing: { id: listing.id, title: listing.title },
      now,
    });
    if (notified) told.add(saved.accountId);
  }
  return told.size;
}

/** Deleting an account (spec 2.15, plan decision 15): its saved searches and their notifications. */
export async function forgetSavedSearchesOf(accountId: string): Promise<void> {
  const { savedSearches } = sampleStore();
  const ids = new Set<string>();
  for (const [id, row] of savedSearches) {
    if (row.accountId !== accountId) continue;
    savedSearches.delete(id);
    ids.add(id);
  }
  await deleteNotificationsAbout("search-match", ids);
}

/** A saved search in the account's data export (spec 2.15, plan decision 15): by name, with no ids. */
export type SavedSearchExport = {
  label: string;
  /** The words as typed, or null. */
  words: string | null;
  category: string | null;
  /** The campus's name, or "Every campus". */
  campus: string;
  price: string | null;
  pay: string | null;
  deals: string | null;
  alerts: "on" | "paused";
  savedAt: string;
};

export async function exportSavedSearches(accountId: string): Promise<SavedSearchExport[]> {
  return searchesOf(accountId).map((row) => ({
    label: savedSearchLabel(queryOf(row), NAMES),
    words: row.q,
    category: row.category ? (NAMES.categories.get(row.category) ?? row.category) : null,
    campus: row.campus === ALL_CAMPUSES ? "Every campus" : (NAMES.campuses.get(row.campus) ?? row.campus),
    price: row.price ? PRICE_LABELS[row.price] : null,
    pay: row.pay ? PAY_LABELS[row.pay] : null,
    deals: row.deals ? DEALS_LABEL : null,
    alerts: row.pausedAt === null ? "on" : "paused",
    savedAt: row.createdAt,
  }));
}
```

Run: `pnpm test lib/data/saved-searches.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 13: Run every check**

Run, one after another: `pnpm typecheck`, `pnpm test`, `pnpm lint`.
Expected: all pass; 36 more unit tests than at the start. If `pnpm typecheck` names a `Record<NotificationKind, …>` a later stage added, add `"search-match"` to it (the words: "A saved search's new match") and say so in the hand-over.

- [ ] **Step 14: Hand over for commit**

Files: `lib/types.ts`, `lib/data/rows.ts`, `lib/data/store.ts`, `lib/data/store.test.ts`, `lib/browse/results.ts`, `lib/browse/results.test.ts`, `lib/following/rules.ts`, `lib/following/rules.test.ts`, `lib/saved-searches/rules.ts`, `lib/saved-searches/rules.test.ts`, `lib/saved-searches/words.ts`, `lib/saved-searches/words.test.ts`, `lib/data/notifications.ts`, `lib/data/notifications.test.ts`, `lib/data/saved-searches.ts`, `lib/data/saved-searches.test.ts`.
Message: `feat: saved searches' data and rules: browse's per-listing test as listingMatches, the savedSearches table, labels, links and sameness, and one search-match notification a day made unread again by a later match, through H's one-a-day rule moved into a shared helper (search alerts spec 2.1 to 2.4, 2.8, 2.11, 2.12 and 2.15)`

---

### Task 2: A first publish tells the matching saved searches

The match runs on F's publish write (spec 2.9 to 2.11; plan decision 13): in `saveListingForm`, inside H's first-publish block and straight after `notifyFollowers`, so both notifications share one condition (a new listing, or a draft published, by an approved shop, not hidden). Edits, relists, a listing resumed, a shop resumed, a paused search and the shop's own owner send nothing (spec 2.10).

**Files:**
- Modify: `lib/selling/listing-actions.ts`, `lib/selling/listing-actions.test.ts`

- [ ] **Step 1: Write the tests**

In `lib/selling/listing-actions.test.ts` (F Task 8, with H Task 9's changes):
1. Add, among the `@/lib/data/…` imports in alphabetical order: `import { addSavedSearch, listSavedSearches, setSavedSearchPaused } from "@/lib/data/saved-searches";`. Keep H's `import { getNotifications } from "@/lib/data/notifications";`, and add `import type { MatchQuery } from "@/lib/types";` after the `@/lib/…` imports.
2. Add `import { resumeShop } from "./shop-actions";` after the `./form-state` import.
3. Add at the end of the file (it uses the file's own `NOW`, `form`, `signedInAs`, `fanForm` and `fan`):

```ts

describe("saved-search alerts (search alerts spec 2.9 and 2.10, plan decision 13)", () => {
  const FAN: MatchQuery = { q: "fan", category: null, campus: "midrand", price: null, pay: null, deals: null };
  const matches = async (accountId = "acc-student") =>
    (await getNotifications(accountId, 50)).filter((item) => item.kind === "search-match");

  it("tells a matching saved search about a first publish, naming the listing", async () => {
    await addSavedSearch("acc-student", FAN, NOW);
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm()));
    const row = (await fan())!;
    expect(await matches()).toMatchObject([
      { text: "Desk fan matches your search “fan” at Midrand", href: `/listings/${row.id}` },
    ]);
  });

  it("tells it when a draft is published, not when it's saved as one", async () => {
    await addSavedSearch("acc-student", FAN, NOW);
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm({ intent: "draft" })));
    expect(await matches()).toEqual([]);
    const row = (await fan())!;
    await redirectOf(() => saveListingForm(fanForm({ listing: row.id })));
    expect(await matches()).toHaveLength(1);
  });

  it("says nothing about an edit, even one that makes the listing match", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm({ title: "Desk cooler" })));
    await addSavedSearch("acc-student", FAN, NOW);
    const row = (await listOwnListings("tech-corner")).find((item) => item.title === "Desk cooler")!;
    await redirectOf(() => saveListingForm(fanForm({ listing: row.id, title: "Desk fan" })));
    expect((await fan())?.id).toBe(row.id);
    expect(await matches()).toEqual([]);
  });

  it("says nothing about a relist, or a listing resumed", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm()));
    await addSavedSearch("acc-student", FAN, NOW);
    const row = (await fan())!;
    const move = (to: string, tab: string) => redirectOf(() => changeListingState(form({ listing: row.id, to, tab })));
    await move("sold", "available");
    await move("available", "sold");
    await move("paused", "available");
    await move("available", "paused");
    expect((await fan())?.state).toBe("available");
    expect(await matches()).toEqual([]);
  });

  it("stays quiet while the shop is paused, and when it resumes", async () => {
    await addSavedSearch("acc-student", FAN, NOW);
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm()));
    await redirectOf(() => resumeShop());
    expect(sampleStore().sellerProfiles.get("acc-seller")?.status).toBe("approved");
    expect(await matches()).toEqual([]);
  });

  it("never tells the shop's own owner, or a paused search", async () => {
    await addSavedSearch("acc-seller", FAN, NOW);
    await addSavedSearch("acc-student", FAN, NOW);
    const [saved] = await listSavedSearches("acc-student");
    await setSavedSearchPaused("acc-student", saved.id, true, NOW);
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm()));
    expect(await matches("acc-seller")).toEqual([]);
    expect(await matches()).toEqual([]);
  });
});
```

(`listOwnListings` and `changeListingState` are already imported for F's tests, and `sampleStore` for H's; add any that aren't.)

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test lib/selling/listing-actions.test.ts`
Expected: FAIL: the first two tests find no `search-match` notification. The other four pass already (nothing tells anyone yet); they guard what mustn't change.

- [ ] **Step 3: Publishing tells the matching saved searches**

In `lib/selling/listing-actions.ts` (F Task 8, with G's and H's changes):
1. Add `import { notifySavedSearches } from "@/lib/data/saved-searches";` among the `@/lib/data/…` imports, in alphabetical order.
2. In `saveListingForm`, inside H's block that starts `if (firstPublish && owner.status === "approved" && !saved.hiddenAt) {`, straight after its `await notifyFollowers({ … });` statement, add:

```ts
    // …and the students whose saved searches match it, once a day per search, under the same condition, so the two
    // can't disagree about what's new (search alerts spec 2.9 to 2.11). Matching reads saved searches, never listings.
    await notifySavedSearches({ listingId: saved.id, now });
```

3. Change H's comment above the block from "tells its followers, once a day" to "tells its followers and the matching saved searches, once a day" (edit by meaning if H's built comment differs), keeping "Edits, relists and a shop resuming don't."

- [ ] **Step 4: Run them to make sure they pass**

Run: `pnpm test lib/selling/listing-actions.test.ts`
Expected: PASS: the six new tests, F's and H's tests unchanged.

- [ ] **Step 5: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 6 more unit tests than after Task 1.

- [ ] **Step 6: Hand over for commit**

Files: `lib/selling/listing-actions.ts`, `lib/selling/listing-actions.test.ts`.
Message: `feat: a listing's first publish tells the matching saved searches, after the shop's followers and under the same condition; edits, relists, resumes, a paused shop, a paused search and the shop's own owner don't (search alerts spec 2.9 to 2.11)`

---

### Task 3: The Server Actions: Save this search, Pause, Resume and Delete

Four plain forms' actions (spec 2.5, 2.6 and 2.8; plan decisions 7, 9 and 11): identity only from the session, the search read with browse's own parser, the line left in D's form state for the page it lands on, and F's `done()`. Save goes back to the browse link it came from; the others to Saved's Searches tab. The pages that post to them come in Tasks 4 and 5.

**Files:**
- Create: `lib/saved-searches/actions.ts`, `lib/saved-searches/actions.test.ts`

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` ("Security"), `02-guides/forms.md`, `03-api-reference/04-functions/refresh.md`, `redirect.md` and `03-api-reference/01-directives/use-server.md`. Note: every action is a public endpoint, so check every field and take identity only from the session; `refresh()` comes before `redirect()`, which throws, never inside a `try`; a `"use server"` file may export only async functions.

- [ ] **Step 2: Write the tests**

Create `lib/saved-searches/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { getNotifications, notifySearchMatch } from "@/lib/data/notifications";
import { addSavedSearch, listSavedSearches } from "@/lib/data/saved-searches";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { MatchQuery } from "@/lib/types";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { deleteSearch, pauseSearchAlerts, resumeSearchAlerts, saveThisSearch } from "./actions";
import { SAVED_SEARCHES_FORM, saveSearchNoteKey } from "./rules";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

const asStudent = () => signedInAs(request, "acc-student");

/** Save this search's hidden fields on "calculator" in Tech at Midrand, under R100 (spec 2.5). */
const FROM = "/browse?q=calculator&cat=tech&campus=midrand&price=under-100";
const SAVE = { q: "calculator", cat: "tech", campus: "midrand", price: "under-100", pay: "", deals: "", from: FROM };
const CALCULATOR: MatchQuery = {
  q: "calculator",
  category: "tech",
  campus: "midrand",
  price: "under-100",
  pay: null,
  deals: null,
};

describe("Save this search (search alerts spec 2.5 and 2.6)", () => {
  it("saves it, and goes back to the same browse link with a status line", async () => {
    await asStudent();
    const redirect = await redirectSignalOf(() => saveThisSearch(form(SAVE)));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual([FROM, "replace", true]);
    expect(await listSavedSearches("acc-student")).toMatchObject([
      { label: "“calculator” in Tech at Midrand, under R100", paused: false },
    ]);
    expect(await readFormState(saveSearchNoteKey(CALCULATOR))).toMatchObject({ notice: "saved", errors: [] });
  });

  it("takes the account from the session, never from the form", async () => {
    await asStudent();
    await redirectOf(() => saveThisSearch(form({ ...SAVE, account: "acc-mentor", accountId: "acc-mentor" })));
    expect(await listSavedSearches("acc-mentor")).toEqual([]);
    expect(await listSavedSearches("acc-student")).toHaveLength(1);
  });

  it("says when it's saved already, or 20 are kept, saving nothing more", async () => {
    await asStudent();
    await addSavedSearch("acc-student", CALCULATOR, STAFF_NOW);
    await redirectOf(() => saveThisSearch(form(SAVE)));
    expect(await readFormState(saveSearchNoteKey(CALCULATOR))).toMatchObject({ notice: null, errors: ["already"] });
    for (let n = 0; n < 19; n += 1) await addSavedSearch("acc-student", { ...CALCULATOR, q: `lamp${n}` }, STAFF_NOW);
    await redirectOf(() => saveThisSearch(form({ ...SAVE, q: "desk lamp", from: "/browse?q=desk+lamp" })));
    expect(await readFormState(saveSearchNoteKey({ ...CALCULATOR, q: "desk lamp" }))).toMatchObject({
      errors: ["limit"],
    });
    expect(await listSavedSearches("acc-student")).toHaveLength(20);
  });

  it("reads the fields as browse does: the max alias, the campus always kept, sort and n dropped", async () => {
    await asStudent();
    const posted = { q: "lamp", campus: "all", max: "250", sort: "price-low", n: "48", from: "/browse?q=lamp&max=250" };
    await redirectOf(() => saveThisSearch(form(posted)));
    expect([...sampleStore().savedSearches.values()]).toMatchObject([
      { accountId: "acc-student", q: "lamp", category: null, campus: "all", price: "under-250", pay: null, deals: null },
    ]);
  });

  it("goes back only to a browse link, or else to the search's own results (plan decision 9)", async () => {
    await asStudent();
    expect(await redirectOf(() => saveThisSearch(form({ ...SAVE, from: "https://evil.example/browse" })))).toBe(FROM);
    expect(await redirectOf(() => saveThisSearch(form({ ...SAVE, q: "kettle", from: "/account" })))).toBe(
      "/browse?q=kettle&cat=tech&campus=midrand&price=under-100",
    );
  });

  it("saves nothing that isn't worth saving: a campus alone", async () => {
    await asStudent();
    const campusOnly = { q: "", cat: "", campus: "midrand", price: "", pay: "", deals: "", from: "/browse?campus=midrand" };
    expect(await redirectOf(() => saveThisSearch(form(campusOnly)))).toBe("/browse?campus=midrand");
    expect(sampleStore().savedSearches.size).toBe(0);
  });

  it("sends a signed-out visitor to sign in, coming back to the same browse link", async () => {
    expect(await redirectOf(() => saveThisSearch(form(SAVE)))).toBe(`/login?next=${encodeURIComponent(FROM)}`);
    expect(sampleStore().savedSearches.size).toBe(0);
  });
});

describe("Pause, Resume and Delete on Saved (spec 2.8, plan decision 11)", () => {
  const saved = async (accountId = "acc-student") => {
    await addSavedSearch(accountId, CALCULATOR, STAFF_NOW);
    return (await listSavedSearches(accountId))[0];
  };

  it("pauses and resumes alerts, back on the Searches tab with a status line", async () => {
    await asStudent();
    const { id, label, href } = await saved();
    const redirect = await redirectSignalOf(() => pauseSearchAlerts(form({ search: id })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/saved?tab=searches", "replace", true]);
    expect((await listSavedSearches("acc-student"))[0].paused).toBe(true);
    expect(await readFormState(SAVED_SEARCHES_FORM)).toMatchObject({ notice: "paused", values: { label, href } });
    await redirectOf(() => resumeSearchAlerts(form({ search: id })));
    expect((await listSavedSearches("acc-student"))[0].paused).toBe(false);
    expect(await readFormState(SAVED_SEARCHES_FORM)).toMatchObject({ notice: "resumed", values: { label, href } });
  });

  it("deletes the search and its notifications, keeping its label and link for the status line", async () => {
    await asStudent();
    const { id, label, href } = await saved();
    await notifySearchMatch({
      accountId: "acc-student",
      savedSearchId: id,
      label,
      resultsHref: href,
      listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" },
      now: STAFF_NOW,
    });
    expect(await redirectOf(() => deleteSearch(form({ search: id })))).toBe("/saved?tab=searches");
    expect(await listSavedSearches("acc-student")).toEqual([]);
    expect((await getNotifications("acc-student", 50)).some((item) => item.kind === "search-match")).toBe(false);
    expect(await readFormState(SAVED_SEARCHES_FORM)).toMatchObject({
      notice: "deleted",
      values: { label: "“calculator” in Tech at Midrand, under R100", href: FROM },
    });
  });

  it("changes nothing of someone else's, and says nothing", async () => {
    const theirs = await saved("acc-mentor");
    await asStudent();
    await redirectOf(() => pauseSearchAlerts(form({ search: theirs.id })));
    await redirectOf(() => deleteSearch(form({ search: theirs.id })));
    await redirectOf(() => deleteSearch(form({ search: "Not an id!" })));
    expect(await listSavedSearches("acc-mentor")).toMatchObject([{ id: theirs.id, paused: false }]);
    expect(await readFormState(SAVED_SEARCHES_FORM)).toBeNull();
  });

  it("sends a signed-out visitor to sign in, back to the tab", async () => {
    expect(await redirectOf(() => deleteSearch(form({ search: "ss-1" })))).toBe("/login?next=%2Fsaved%3Ftab%3Dsearches");
    expect(await redirectOf(() => pauseSearchAlerts(form({ search: "ss-1" })))).toBe(
      "/login?next=%2Fsaved%3Ftab%3Dsearches",
    );
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/saved-searches/actions.test.ts`
Expected: FAIL, because `./actions` doesn't exist.

- [ ] **Step 4: Write the actions**

Create `lib/saved-searches/actions.ts`:

```ts
"use server";

import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { knownSlugs } from "@/lib/browse/query";
import { getCampuses, getCategories } from "@/lib/data";
import { addSavedSearch, deleteSavedSearch, setSavedSearchPaused } from "@/lib/data/saved-searches";
import { isId } from "@/lib/messaging/paths";
import { done, field } from "@/lib/selling/action-helpers";
import {
  browseFrom,
  isWorthSaving,
  SAVED_SEARCHES_FORM,
  SAVED_SEARCHES_PATH,
  saveSearchNoteKey,
  savedSearchFrom,
  savedSearchHref,
  SEARCH_FIELDS,
} from "./rules";

// Saved searches' actions (search alerts spec 2.5, 2.6 and 2.8; plan decisions 7, 9 and 11): plain forms, so they
// work before the app's JavaScript arrives. Identity comes only from the session; each leaves its line in D's form
// state for the page it lands on, and ends with F's done(), whose refresh() drops the browser's kept pages. Saved
// searches aren't cached and buyers never see them, so no tag is expired.

/**
 * Save this search (spec 2.5): the posted fields read as browse reads its link, saved for the signed-in account, and
 * back to the browse link it came from with "Search saved.", or why not.
 */
export async function saveThisSearch(formData: FormData): Promise<void> {
  const [campuses, categories] = await Promise.all([getCampuses(), getCategories()]);
  const params = Object.fromEntries(SEARCH_FIELDS.map((name) => [name, field(formData, name) || undefined]));
  const search = savedSearchFrom(params, knownSlugs(campuses, categories));
  const back = browseFrom(field(formData, "from")) ?? savedSearchHref(search);
  const account = await requireAccount(back);
  if (!isWorthSaving(search)) done(back);
  const now = new Date();
  const result = await addSavedSearch(account.id, search, now);
  await writeFormState(
    saveSearchNoteKey(search),
    result === "saved" ? { errors: [], values: {}, notice: "saved" } : { errors: [result], values: {}, notice: null },
    now,
  );
  done(back);
}

/** Pause alerts or Resume alerts (spec 2.8) on one of the account's saved searches, back to the Searches tab. */
async function setAlerts(formData: FormData, paused: boolean): Promise<void> {
  const account = await requireAccount(SAVED_SEARCHES_PATH);
  const id = field(formData, "search");
  if (isId(id)) {
    const now = new Date();
    const item = await setSavedSearchPaused(account.id, id, paused, now);
    if (item) {
      const values = { label: item.label, href: item.href };
      await writeFormState(SAVED_SEARCHES_FORM, { errors: [], values, notice: paused ? "paused" : "resumed" }, now);
    }
  }
  done(SAVED_SEARCHES_PATH);
}

export async function pauseSearchAlerts(formData: FormData): Promise<void> {
  await setAlerts(formData, true);
}

export async function resumeSearchAlerts(formData: FormData): Promise<void> {
  await setAlerts(formData, false);
}

/** Delete (spec 2.8): no confirm page; the status line links to the search's results, to save it again. */
export async function deleteSearch(formData: FormData): Promise<void> {
  const account = await requireAccount(SAVED_SEARCHES_PATH);
  const id = field(formData, "search");
  const item = isId(id) ? await deleteSavedSearch(account.id, id) : null;
  if (item) {
    const values = { label: item.label, href: item.href };
    await writeFormState(SAVED_SEARCHES_FORM, { errors: [], values, notice: "deleted" }, new Date());
  }
  done(SAVED_SEARCHES_PATH);
}
```

- [ ] **Step 5: Run them to make sure they pass**

Run: `pnpm test lib/saved-searches/actions.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 11 more unit tests than after Task 2.

- [ ] **Step 7: Hand over for commit**

Files: `lib/saved-searches/actions.ts`, `lib/saved-searches/actions.test.ts`.
Message: `feat: the saved-search Server Actions: Save this search read with browse's own parser and back to its browse link with a status line, and Pause, Resume and Delete back to Saved's Searches tab (search alerts spec 2.5, 2.6 and 2.8)`

---

### Task 4: Save this search on browse

The row under browse's chips (spec 2.5, 2.6 and section 4; plan decisions 6 and 7): there for every search worth saving, above the results, the empty state or the error; a box of fixed height with the session's part in its own `<Suspense>` and the signed-out row as the fallback, so the results never wait for it and nothing moves when it streams in. Signed out (and in the shell): "Hear when something new matches." and a **Save this search** link to sign-in that comes back to the same link. Signed in: the same line and a **Save this search** button. Then "You've saved this search." or "You have 20 saved searches." with **Manage saved searches**, and after a press "Search saved." as a status or the refusal as an alert. Browse is a shared page, so this task measures before and after.

**Files:**
- Create: `components/browse/SaveSearchControl.tsx`, `components/browse/SaveSearchControl.test.tsx`
- Create: `components/browse/ViewerSaveSearch.tsx`, `components/browse/ViewerSaveSearch.test.tsx`
- Create: `tests/helpers/viewer-save-search.tsx`
- Modify: `components/browse/BrowseView.tsx`, `components/browse/BrowseView.test.tsx`
- Modify: `tests/e2e/performance.spec.ts`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Measure browse with a search before changing it**

In `tests/e2e/performance.spec.ts`, add this row to `PAGES`, straight after `["browse page", "/browse"],`:

```ts
  ["browse page, a search", "/browse?q=calculator"],
```

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Write every page's `scriptBrotli` into the ledger's "Start" row, the new "Browse, a search" column included (plan decision 20). Every existing figure must equal H's final ones; if one doesn't, stop and report.

- [ ] **Step 2: Read the docs**

Read `node_modules/next/dist/docs/01-app/02-guides/forms.md` (a form whose action is a Server Action, rendered by a Server Component), `02-guides/authentication-with-cache-components.md` (the session in its own `<Suspense>`) and `02-guides/preserving-ui-state.md` (why the e2e tests look only at what's visible).

- [ ] **Step 3: Write the tests**

Create `components/browse/SaveSearchControl.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BrowseQuery, MatchQuery } from "@/lib/types";
import { SaveSearchControl, SaveSearchRow } from "./SaveSearchControl";

// The session's part never arrives here, so what renders is the static shell's fallback (plan decision 6).
vi.mock("./ViewerSaveSearch", async () => {
  const { use } = await import("react");
  const never = new Promise<never>(() => {});
  return { ViewerSaveSearch: () => use(never) };
});
vi.mock("@/lib/saved-searches/actions", () => ({ saveThisSearch: async () => {} }));

const QUERY: BrowseQuery = {
  q: "calculator",
  category: "tech",
  campus: "midrand",
  campusFromLink: true,
  price: "under-100",
  pay: null,
  deals: null,
  sort: "match",
  shown: 24,
};
const SEARCH: MatchQuery = { q: "calculator", category: "tech", campus: "midrand", price: "under-100", pay: null, deals: null };
const FROM = "/browse?q=calculator&cat=tech&campus=midrand&price=under-100";

describe("Save this search on browse (search alerts spec 2.5, 2.6 and section 4)", () => {
  it("is a link through sign-in, back to the same results, in the static shell", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<SaveSearchControl query={QUERY} />);
    expect(within(container).getByText("Hear when something new matches.")).toBeInTheDocument();
    const link = within(container).getByRole("link", { name: "Save this search" });
    expect(link).toHaveAttribute("href", `/login?next=${encodeURIComponent(FROM)}`);
    expect(link).toHaveClass("btn-outline");
    expect(container.querySelector(".save-search")).not.toBeNull();
  });

  it("is a button when signed in, posting the search's fields and where it came from", () => {
    render(<SaveSearchRow search={SEARCH} from={FROM} state="new" note={null} />);
    expect(screen.getByText("Hear when something new matches.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save this search" })).toHaveAttribute("type", "submit");
    const hidden = [...document.querySelectorAll<HTMLInputElement>('input[type="hidden"]')];
    expect(Object.fromEntries(hidden.map((input) => [input.name, input.value]))).toEqual({
      q: "calculator",
      cat: "tech",
      campus: "midrand",
      price: "under-100",
      pay: "",
      deals: "",
      from: FROM,
    });
  });

  it("says when it's saved, or when 20 are, with Manage saved searches instead of the button", () => {
    const { unmount } = render(<SaveSearchRow search={SEARCH} from={FROM} state="saved" note={null} />);
    expect(screen.getByText("You've saved this search.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage saved searches" })).toHaveAttribute("href", "/saved?tab=searches");
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    render(<SaveSearchRow search={SEARCH} from={FROM} state="limit" note={null} />);
    expect(screen.getByText("You have 20 saved searches.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage saved searches" })).toBeInTheDocument();
  });

  it("says Search saved. as a status after a save, and a refusal as an alert (plan decision 7)", () => {
    const { unmount } = render(<SaveSearchRow search={SEARCH} from={FROM} state="saved" note="saved" />);
    expect(screen.getByRole("status")).toHaveTextContent("Search saved.");
    unmount();
    const again = render(<SaveSearchRow search={SEARCH} from={FROM} state="saved" note="already" />);
    expect(screen.getByRole("alert")).toHaveTextContent("You've saved this search already.");
    again.unmount();
    render(<SaveSearchRow search={SEARCH} from={FROM} state="limit" note="limit" />);
    expect(screen.getByRole("alert")).toHaveTextContent("You have 20 saved searches. Delete one first.");
    expect(screen.getByRole("link", { name: "Manage saved searches" })).toBeInTheDocument();
  });
});
```

Create `components/browse/ViewerSaveSearch.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addSavedSearch } from "@/lib/data/saved-searches";
import { resetSampleStore } from "@/lib/data/store";
import type { MatchQuery } from "@/lib/types";
import { ViewerSaveSearch } from "./ViewerSaveSearch";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));
const note = vi.hoisted(() => ({
  forms: [] as string[],
  state: null as null | { notice: string | null; errors: string[]; values: Record<string, string> },
}));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async (form: string) => {
    note.forms.push(form);
    return note.state;
  },
}));
vi.mock("@/lib/saved-searches/actions", () => ({ saveThisSearch: async () => {} }));

const SEARCH: MatchQuery = { q: "calculator", category: null, campus: "midrand", price: null, pay: null, deals: null };
const FROM = "/browse?q=calculator&campus=midrand";

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
  note.forms = [];
  note.state = null;
});

describe("Save this search, once the session is read (search alerts spec 2.6)", () => {
  it("is the sign-in link when signed out, taking no status line", async () => {
    render(await ViewerSaveSearch({ search: SEARCH, from: FROM }));
    expect(screen.getByRole("link", { name: "Save this search" })).toHaveAttribute(
      "href",
      "/login?next=%2Fbrowse%3Fq%3Dcalculator%26campus%3Dmidrand",
    );
    expect(note.forms).toEqual([]);
  });

  it("is the button, then says it's saved once the account has the same search", async () => {
    viewer.account = { id: "acc-student" };
    const { unmount } = render(await ViewerSaveSearch({ search: SEARCH, from: FROM }));
    expect(screen.getByRole("button", { name: "Save this search" })).toBeInTheDocument();
    unmount();
    await addSavedSearch("acc-student", { ...SEARCH, q: "Calculator" }, new Date("2026-10-14T08:42:00.000Z"));
    render(await ViewerSaveSearch({ search: SEARCH, from: FROM }));
    expect(screen.getByText("You've saved this search.")).toBeInTheDocument();
  });

  it("takes this search's own status line, once", async () => {
    viewer.account = { id: "acc-student" };
    note.state = { notice: "saved", errors: [], values: {} };
    render(await ViewerSaveSearch({ search: SEARCH, from: FROM }));
    expect(screen.getByRole("status")).toHaveTextContent("Search saved.");
    expect(note.forms).toEqual(["save-search:calculator||midrand|||"]);
  });
});
```

In `components/browse/BrowseView.test.tsx`:
1. Add straight after its last `vi.mock(…)` call:

```tsx

// Save this search's session part is an async Server Component; here it's the signed-out row (search alerts plan,
// Task 4). The actions only need something to post to.
vi.mock("@/components/browse/ViewerSaveSearch", async () =>
  (await import("@/tests/helpers/viewer-save-search")).signedOutViewerSaveSearch,
);
vi.mock("@/lib/saved-searches/actions", () => ({ saveThisSearch: async () => {} }));
```

2. Add at the end of its `describe`:

```tsx

  it("offers Save this search for a search, through sign-in, and not on plain browse (search alerts spec 2.4 and 2.5)", async () => {
    const { unmount } = await view({ q: "calculator" });
    expect(screen.getByRole("link", { name: "Save this search" })).toHaveAttribute(
      "href",
      "/login?next=%2Fbrowse%3Fq%3Dcalculator",
    );
    unmount();
    viewer.campus = "midrand";
    await view();
    expect(screen.queryByRole("link", { name: "Save this search" })).toBeNull();
  });

  it("offers it above the empty state too, when nothing matches yet (search alerts spec 2.5)", async () => {
    await view({ q: "xylophone", campus: "midrand" });
    const save = screen.getByRole("link", { name: "Save this search" });
    const empty = screen.getByRole("heading", { level: 2, name: "Nothing here yet" });
    expect(save.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test components/browse`
Expected: FAIL: the two components and the helper don't exist, and browse has no row.

- [ ] **Step 5: Write the row**

Create `components/browse/SaveSearchControl.tsx`:

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { browseHref } from "@/lib/browse/href";
import { signInHref } from "@/lib/next-path";
import { saveThisSearch } from "@/lib/saved-searches/actions";
import { matchQueryOf, SAVED_SEARCHES_PATH, type SaveNote } from "@/lib/saved-searches/rules";
import {
  ALREADY_SAVED_LINE,
  AT_LIMIT_LINE,
  MANAGE_SEARCHES,
  SAVE_SEARCH_BUTTON,
  SAVE_SEARCH_PROMPT,
  saveNoteText,
} from "@/lib/saved-searches/words";
import type { BrowseQuery, MatchQuery, SaveSearchState } from "@/lib/types";
import { ViewerSaveSearch } from "./ViewerSaveSearch";

/** Save this search for a signed-out visitor, and the static shell: sign in, then back to the same results (spec 2.6). */
export function SaveSearchSignedOut({ from }: { from: string }) {
  return (
    <>
      <p className="save-search-line">{SAVE_SEARCH_PROMPT}</p>
      <Link href={signInHref(from)} prefetch={false} className="btn btn-outline text-navy save-search-btn">
        {SAVE_SEARCH_BUTTON}
      </Link>
    </>
  );
}

/** Manage saved searches (spec 2.6). No prefetch: Saved carries the hearts' client code (spec 5). */
function ManageLink() {
  return (
    <Link href={SAVED_SEARCHES_PATH} prefetch={false} className="save-search-manage">
      {MANAGE_SEARCHES}
    </Link>
  );
}

type SaveSearchRowProps = {
  search: MatchQuery;
  /** The browse link it's on, to come back to. */
  from: string;
  state: SaveSearchState;
  /** What the last press said, once (plan decision 7). */
  note: SaveNote | null;
};

/**
 * The row once the session is read (spec 2.6, plan decision 6): one short line and one 44px control. After a press
 * the line says what happened: "Search saved." as a status, a refusal as an alert. The button is a plain form, so it
 * works before the app's JavaScript arrives.
 */
export function SaveSearchRow({ search, from, state, note }: SaveSearchRowProps) {
  if (note) {
    return (
      <>
        <p role={note === "saved" ? "status" : "alert"} className="save-search-line">
          {saveNoteText(note)}
        </p>
        <ManageLink />
      </>
    );
  }
  if (state !== "new") {
    return (
      <>
        <p className="save-search-line">{state === "saved" ? ALREADY_SAVED_LINE : AT_LIMIT_LINE}</p>
        <ManageLink />
      </>
    );
  }
  return (
    <>
      <p className="save-search-line">{SAVE_SEARCH_PROMPT}</p>
      <form action={saveThisSearch}>
        <input type="hidden" name="q" value={search.q ?? ""} />
        <input type="hidden" name="cat" value={search.category ?? ""} />
        <input type="hidden" name="campus" value={search.campus} />
        <input type="hidden" name="price" value={search.price ?? ""} />
        <input type="hidden" name="pay" value={search.pay ?? ""} />
        <input type="hidden" name="deals" value={search.deals ?? ""} />
        <input type="hidden" name="from" value={from} />
        <button type="submit" className="btn btn-outline text-navy save-search-btn">
          {SAVE_SEARCH_BUTTON}
        </button>
      </form>
    </>
  );
}

/**
 * Save this search under browse's chips (search alerts spec 2.5 and 2.6, plan decision 6): a box that's always there,
 * holding the session's part in its own <Suspense> with the signed-out row as the fallback, so the results never wait
 * for it and nothing moves when it streams in. The campus is always posted: the link's, or the viewer's chosen one,
 * which browse shows as a chip. No client bytes.
 */
export function SaveSearchControl({ query }: { query: BrowseQuery }) {
  const search = matchQueryOf(query);
  const from = browseHref(query);
  return (
    <div className="save-search">
      <Suspense fallback={<SaveSearchSignedOut from={from} />}>
        <ViewerSaveSearch search={search} from={from} />
      </Suspense>
    </div>
  );
}
```

Create `components/browse/ViewerSaveSearch.tsx`:

```tsx
import { getViewer } from "@/lib/auth/session";
import { getSaveSearchState } from "@/lib/data/saved-searches";
import { takeNote } from "@/lib/looking-for/form-state";
import { saveNoteOf, saveSearchNoteKey } from "@/lib/saved-searches/rules";
import type { MatchQuery } from "@/lib/types";
import { SaveSearchRow, SaveSearchSignedOut } from "./SaveSearchControl";

/**
 * Save this search once the session is read (search alerts spec 2.6): the sign-in link when signed out; otherwise the
 * button, "saved" or "at the limit", with the last press's line for this search, taken once. An async Server
 * Component: SaveSearchControl puts it inside <Suspense>. A failed session read gives the signed-out row.
 */
export async function ViewerSaveSearch({ search, from }: { search: MatchQuery; from: string }) {
  const account = await getViewer().catch(() => null);
  if (!account) return <SaveSearchSignedOut from={from} />;
  const [state, note] = await Promise.all([
    getSaveSearchState(account.id, search),
    takeNote(saveSearchNoteKey(search)),
  ]);
  return <SaveSearchRow search={search} from={from} state={state} note={saveNoteOf(note)} />;
}
```

Create `tests/helpers/viewer-save-search.tsx`:

```tsx
import { SaveSearchSignedOut } from "@/components/browse/SaveSearchControl";
import type { MatchQuery } from "@/lib/types";

/**
 * Stands in for components/browse/ViewerSaveSearch.tsx in component tests (search alerts plan, Task 4): the real one
 * is an async Server Component, which jsdom can't render inside a tree. In a test file:
 *
 *   vi.mock("@/components/browse/ViewerSaveSearch", async () =>
 *     (await import("@/tests/helpers/viewer-save-search")).signedOutViewerSaveSearch,
 *   );
 */
export const signedOutViewerSaveSearch = {
  ViewerSaveSearch: ({ from }: { search: MatchQuery; from: string }) => <SaveSearchSignedOut from={from} />,
};
```

- [ ] **Step 6: Put it under the chips**

In `components/browse/BrowseView.tsx`:
1. Add `import { isWorthSaving, matchQueryOf } from "@/lib/saved-searches/rules";` after the `@/lib/browse/query` import, and `import { SaveSearchControl } from "./SaveSearchControl";` among the `./…` imports, in alphabetical order (after `./ResultsGrid`).
2. Replace:

```tsx
      <ActiveFilters query={query} campusNames={campusNames} />
      {results}
```

with:

```tsx
      <ActiveFilters query={query} campusNames={campusNames} />
      {isWorthSaving(matchQueryOf(query)) && <SaveSearchControl query={query} />}
      {results}
```

3. Add to the component's comment, before `*/`: "Save this search sits under the chips for any search worth saving, above the results, the empty state or the error, with the session in its own <Suspense> (search alerts spec 2.5)."

Find every other test that renders `BrowseView` or `app/browse/page.tsx`: `grep -rln "BrowseView\|app/browse/page" components app --include="*.test.tsx"`, and add the same two `vi.mock` lines to each.

- [ ] **Step 7: Style it**

Check the names are free (`grep -n "\.save-search" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Search alerts: Save this search on browse (search alerts plan, Task 4, spec 2.5 and 2.6) --- */
@layer components {
  /* Always there and the same height in every state, whatever the session says, so nothing below moves when it
     streams in (plan decision 6): one 20px line over one 44px control on phones, side by side from the tablet step. */
  .save-search {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-height: 72px;
    margin-top: 14px;
  }

  .save-search-line {
    color: var(--color-ink);
    font-size: 14px;
    line-height: 20px;
  }

  /* A white pill with a navy outline and navy text (spec 4): sky never carries text on white. */
  .save-search-btn {
    min-height: 44px;
    background: var(--color-white);
  }

  /* A link on white is sky-dark (4.7:1), 44px high. */
  .save-search-manage {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-size: 14px;
    font-weight: 600;
    text-decoration: underline 1.5px;
    text-underline-offset: 4px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .save-search {
      flex-direction: row;
      align-items: center;
      gap: 16px;
      min-height: 44px;
    }
  }
}
```

- [ ] **Step 8: Run them to make sure they pass**

Run: `pnpm test components/browse`
Expected: PASS: the nine new tests, and browse's own tests unchanged.

- [ ] **Step 9: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 9 more unit tests than after Task 3.

- [ ] **Step 10: Measure the JavaScript**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Write every page's `scriptBrotli` into the ledger's "Task 4" row. **Every figure must equal the "Start" row's to the byte** (spec 5): the row is a Server Component with a form and a `Link`, both already in browse's code. If any page moved, stop and find out why before going on. If any page is past the stop line, stop and report.

- [ ] **Step 11: Look at it**

Start the build (`pnpm start --port 3201`) at 390 × 844, 768 × 1024 and 1280 × 800.
- `/browse`: no row. `/browse?campus=midrand`: no row (a campus alone isn't a search).
- `/browse?q=calculator`: the row under the chips (or the toolbar), above the cards: "Hear when something new matches." and SAVE THIS SEARCH, a white pill with a navy outline. Press it: the sign-in page, then back to `/browse?q=calculator` once signed in as "Student, Midrand".
- Press SAVE THIS SEARCH: "Search saved." and Manage saved searches. Reload: "You've saved this search."
- `/browse?q=xylophone&campus=midrand`: the row above "Nothing here yet".
- With the network throttled, nothing below the row moves when the session's part replaces the fallback.

Stop the server.

- [ ] **Step 12: Hand over for commit**

Files: `components/browse/SaveSearchControl.tsx`, `components/browse/SaveSearchControl.test.tsx`, `components/browse/ViewerSaveSearch.tsx`, `components/browse/ViewerSaveSearch.test.tsx`, `tests/helpers/viewer-save-search.tsx`, `components/browse/BrowseView.tsx`, `components/browse/BrowseView.test.tsx`, `tests/e2e/performance.spec.ts`, `app/globals.css` (and any other test file Step 6's grep found).
Message: `feat: Save this search on browse: a fixed-height row under the chips for any search worth saving, a sign-in link signed out and a plain form signed in, saved or at the limit with Manage saved searches, and its status line or refusal once (search alerts spec 2.5 and 2.6). JS: browse <n> B, browse with a search <n> B, unchanged`

---

### Task 5: Saved's Searches tab

Saved gains a third tab link, **Searches** (`/saved?tab=searches`; spec 2.7, 2.8 and section 4; plan decisions 7, 10 and 11): "Kept with your account. Each search sends at most one notification a day."; the account's saved searches, newest first, each with its label linking to its results, "Saved 12 October" in SAST, "Alerts on" or "Paused", and **Pause alerts** (or **Resume alerts**) and **Delete**, which come back here with a status line; none yet, a sentence and **Browse**; signed out, a sentence and a sign-in link back to the tab. It streams in with H's tabs behind the same skeleton. Saved is a shared page, so this task measures before and after.

**Files:**
- Modify: `lib/following/rules.ts`, `lib/following/rules.test.ts`
- Modify: `lib/time.ts`, `lib/time.test.ts`
- Create: `components/saved/SavedSearchesView.tsx`, `components/saved/SavedSearchesView.test.tsx`
- Create: `components/saved/SavedSearches.tsx`, `components/saved/SavedSearches.test.tsx`
- Modify: `components/saved/SavedTabs.tsx`, `components/saved/SavedTabs.test.tsx`
- Modify: `tests/e2e/performance.spec.ts`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Measure the tab's address before changing it**

In `tests/e2e/performance.spec.ts`, add this row to `PAGES`, after H's `["Saved page, Shops tab", "/saved?tab=shops"],`:

```ts
  ["Saved page, Searches tab", "/saved?tab=searches"],
```

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Every figure equals Task 4's. Write the new row's `scriptBrotli` (today it shows Listings: `parseSavedTab` doesn't know "searches" yet) into the ledger's "Start" row, "Saved, Searches tab" column (plan decision 20).

- [ ] **Step 2: Write the tests**

In `lib/following/rules.test.ts`, add to the end of the describe "Saved's Searches tab (search alerts spec 2.7, plan decision 10)" (Task 1):

```ts

  it("opens for ?tab=searches", () => {
    expect(parseSavedTab("searches")).toBe("searches");
    expect(parseSavedTab(["searches", "shops"])).toBe("searches");
  });
```

In `lib/time.test.ts`, add `sastDayMonth` to the import from `./time` (alphabetical order), and add at the end of the file:

```ts

describe("sastDayMonth (search alerts spec 2.7)", () => {
  it("writes the South African date's day and month in words", () => {
    expect(sastDayMonth("2026-10-12T07:40:00Z")).toBe("12 October");
    // 23:30 on 13 October in UTC is already 14 October in South Africa.
    expect(sastDayMonth("2026-10-13T23:30:00Z")).toBe("14 October");
  });
});
```

Create `components/saved/SavedSearchesView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SavedSearchItem } from "@/lib/types";
import { SavedSearchesView } from "./SavedSearchesView";

vi.mock("@/lib/saved-searches/actions", () => ({
  deleteSearch: async () => {},
  pauseSearchAlerts: async () => {},
  resumeSearchAlerts: async () => {},
}));

const item = (overrides: Partial<SavedSearchItem> = {}): SavedSearchItem => ({
  id: "ss-1",
  label: "“calculator” at Midrand",
  href: "/browse?q=calculator&campus=midrand",
  savedAt: "2026-10-12T07:40:00Z",
  paused: false,
  ...overrides,
});

const DELETED = { code: "deleted", label: "“calculator” at Midrand", href: "/browse?q=calculator&campus=midrand" } as const;

describe("Saved's Searches tab (search alerts spec 2.7, 2.8 and section 4)", () => {
  it("lists each search with its results, when it was saved, its alerts and its two buttons", () => {
    const tech = item({
      id: "ss-2",
      label: "Tech at every campus",
      href: "/browse?cat=tech&campus=all",
      savedAt: "2026-10-10T09:00:00Z",
      paused: true,
    });
    render(<SavedSearchesView searches={[item(), tech]} notice={null} />);
    expect(screen.getByText("2 saved searches")).toBeInTheDocument();
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first).getByRole("link", { name: "“calculator” at Midrand" })).toHaveAttribute(
      "href",
      "/browse?q=calculator&campus=midrand",
    );
    expect(within(first).getByText("12 October").closest("time")).toHaveAttribute("datetime", "2026-10-12T07:40:00Z");
    expect(within(first).getByText("Alerts on")).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "Pause alerts for “calculator” at Midrand" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(within(first).getByRole("button", { name: "Delete saved search “calculator” at Midrand" })).toBeInTheDocument();
    expect([...first.querySelectorAll<HTMLInputElement>('input[name="search"]')].map((input) => input.value)).toEqual([
      "ss-1",
      "ss-1",
    ]);
    expect(within(second).getByText("Paused")).toBeInTheDocument();
    expect(within(second).getByRole("button", { name: "Resume alerts for Tech at every campus" })).toBeInTheDocument();
  });

  it("says what the last press did; Delete's line links to the search's results (spec 2.8)", () => {
    const paused = { ...DELETED, code: "paused" } as const;
    const { unmount } = render(<SavedSearchesView searches={[item({ paused: true })]} notice={paused} />);
    expect(screen.getByRole("status")).toHaveTextContent("Alerts paused for “calculator” at Midrand.");
    unmount();
    const resumed = render(<SavedSearchesView searches={[item()]} notice={{ ...DELETED, code: "resumed" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Alerts on for “calculator” at Midrand.");
    resumed.unmount();
    render(<SavedSearchesView searches={[]} notice={DELETED} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Deleted “calculator” at Midrand.");
    expect(within(status).getByRole("link", { name: "“calculator” at Midrand" })).toHaveAttribute(
      "href",
      "/browse?q=calculator&campus=midrand",
    );
  });

  it("says how to save one when there are none", () => {
    render(<SavedSearchesView searches={[]} notice={null} />);
    expect(screen.getByText("No saved searches yet")).toBeInTheDocument();
    expect(screen.getByText("Search on Browse and press Save this search.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
  });

  it("asks a signed-out visitor to sign in, coming back to the tab", () => {
    render(<SavedSearchesView searches={null} notice={null} />);
    expect(screen.getByText("Sign in to save searches. They'll show here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fsaved%3Ftab%3Dsearches");
  });
});
```

Create `components/saved/SavedSearches.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addSavedSearch } from "@/lib/data/saved-searches";
import { resetSampleStore } from "@/lib/data/store";
import type { MatchQuery } from "@/lib/types";
import { SavedSearches } from "./SavedSearches";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));
const note = vi.hoisted(() => ({
  forms: [] as string[],
  state: null as null | { notice: string | null; errors: string[]; values: Record<string, string> },
}));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async (form: string) => {
    note.forms.push(form);
    return note.state;
  },
}));
vi.mock("@/lib/saved-searches/actions", () => ({
  deleteSearch: async () => {},
  pauseSearchAlerts: async () => {},
  resumeSearchAlerts: async () => {},
}));

const search = (overrides: Partial<MatchQuery>): MatchQuery => ({
  q: null,
  category: null,
  campus: "all",
  price: null,
  pay: null,
  deals: null,
  ...overrides,
});

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
  note.forms = [];
  note.state = null;
});

describe("the Searches tab, for this visitor (search alerts spec 2.7)", () => {
  it("lists the visitor's saved searches, newest first, with the tab's last status line", async () => {
    await addSavedSearch("acc-student", search({ q: "calculator", campus: "midrand" }), new Date("2026-10-12T07:40:00Z"));
    await addSavedSearch("acc-student", search({ category: "tech" }), new Date("2026-10-13T07:40:00Z"));
    await addSavedSearch("acc-mentor", search({ q: "lamp" }), new Date("2026-10-13T07:40:00Z"));
    viewer.account = { id: "acc-student" };
    note.state = {
      notice: "resumed",
      errors: [],
      values: { label: "Tech at every campus", href: "/browse?cat=tech&campus=all" },
    };
    render(await SavedSearches());
    const labels = screen.getAllByRole("listitem").map((row) => row.querySelector("a")?.textContent);
    expect(labels).toEqual(["Tech at every campus", "“calculator” at Midrand"]);
    expect(screen.getByRole("status")).toHaveTextContent("Alerts on for Tech at every campus.");
    expect(note.forms).toEqual(["saved-searches"]);
  });

  it("asks a signed-out visitor to sign in, taking no status line", async () => {
    render(await SavedSearches());
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(note.forms).toEqual([]);
  });
});
```

In `components/saved/SavedTabs.test.tsx` (H Task 18):
1. Add after its `vi.mock("./FollowedShops", …)` line:

```tsx
vi.mock("./SavedSearches", () => ({ SavedSearches: () => <p>Your saved searches</p> }));
```

2. Add at the end of its `describe`:

```tsx

  it("opens Searches for ?tab=searches: kept with the account, one notification a day (search alerts spec 2.7)", async () => {
    await tabs({ tab: "searches" });
    expect(screen.getByRole("link", { name: "Searches" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Searches" })).toHaveAttribute("href", "/saved?tab=searches");
    expect(screen.getByRole("link", { name: "Shops" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Kept with your account. Each search sends at most one notification a day.")).toBeInTheDocument();
    expect(screen.getByText("Your saved searches")).toBeInTheDocument();
    expect(screen.queryByText("The shops you follow")).toBeNull();
    expect(screen.queryByText(/Saved on this device/)).toBeNull();
  });
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/following lib/time.test.ts components/saved`
Expected: FAIL: `parseSavedTab` gives Listings for "searches", `sastDayMonth` and the two components don't exist, and the tabs have no Searches.

- [ ] **Step 4: The tab's address and the date**

In `lib/following/rules.ts`, replace `parseSavedTab`'s body and comment with:

```ts
/**
 * "?tab=shops" opens Shops and "?tab=searches" Searches; anything else is Listings (community actions plan decision
 * 17, search alerts plan decision 10).
 */
export function parseSavedTab(raw: string | string[] | undefined): SavedTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "shops" || value === "searches" ? value : "listings";
}
```

and change the comment on `SavedTab` (Task 1) to `/** Saved's tabs (community actions spec 2.17; search alerts spec 2.7). */`.

In `lib/time.ts`, add after `longSastDate`:

```ts

// en-GB writes "12 October": the day, then the month in words.
const SAST_DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Johannesburg",
  day: "numeric",
  month: "long",
});

/** A stored UTC time as its day and month in South Africa: "12 October" (search alerts spec 2.7). It reads no clock. */
export function sastDayMonth(iso: string): string {
  return SAST_DAY_MONTH.format(new Date(iso));
}
```

- [ ] **Step 5: Write the tab**

Create `components/saved/SavedSearchesView.tsx`:

```tsx
import Link from "next/link";
import { signInHref } from "@/lib/next-path";
import { deleteSearch, pauseSearchAlerts, resumeSearchAlerts } from "@/lib/saved-searches/actions";
import { SAVED_SEARCHES_PATH, type SavedSearchNotice } from "@/lib/saved-searches/rules";
import { alertsNoticeText, savedSearchesCount } from "@/lib/saved-searches/words";
import { sastDayMonth } from "@/lib/time";
import type { SavedSearchItem } from "@/lib/types";

type SavedSearchesViewProps = {
  /** Newest first; null when signed out. */
  searches: readonly SavedSearchItem[] | null;
  /** The last Pause, Resume or Delete, once (plan decision 7). */
  notice: SavedSearchNotice | null;
};

/** The last press's status line (spec section 4). Delete's links to the search's results, to save it again (spec 2.8). */
function Notice({ notice }: { notice: SavedSearchNotice }) {
  return (
    <p role="status" className="form-notice saved-searches-notice">
      {notice.code === "deleted" ? (
        <>
          Deleted{" "}
          <Link href={notice.href} prefetch={false}>
            {notice.label}
          </Link>
          .
        </>
      ) : (
        alertsNoticeText(notice.code, notice.label)
      )}
    </p>
  );
}

/**
 * Saved's Searches tab (search alerts spec 2.7, 2.8 and section 4; plan decisions 10 and 11): newest first, each with
 * its label linking to its results, when it was saved, whether its alerts are on, and Pause or Resume and Delete,
 * which come back here with a status line. No confirm pages: pausing loses nothing, and a deleted search is one press
 * from coming back. No prefetch on the results: browse carries client code (spec 5).
 */
export function SavedSearchesView({ searches, notice }: SavedSearchesViewProps) {
  if (searches === null) {
    return (
      <section aria-labelledby="saved-searches-title" className="saved-empty">
        <h2 id="saved-searches-title" className="saved-empty-title">
          Saved searches
        </h2>
        <p>Sign in to save searches. They&apos;ll show here.</p>
        <Link href={signInHref(SAVED_SEARCHES_PATH)} prefetch={false} className="btn btn-primary">
          Sign in
        </Link>
      </section>
    );
  }
  return (
    <section aria-labelledby="saved-searches-title">
      <h2 id="saved-searches-title" className="sr-only">
        Saved searches
      </h2>
      {notice && <Notice notice={notice} />}
      {searches.length === 0 ? (
        <div className="saved-empty">
          <p className="saved-empty-title">No saved searches yet</p>
          <p>Search on Browse and press Save this search.</p>
          <Link href="/browse" prefetch={false} className="btn btn-primary">
            Browse
          </Link>
        </div>
      ) : (
        <>
          <p className="saved-count">{savedSearchesCount(searches.length)}</p>
          <ul className="saved-searches">
            {searches.map((search) => (
              <li key={search.id} className="saved-search">
                <Link href={search.href} prefetch={false} className="saved-search-label">
                  {search.label}
                </Link>
                <p className="saved-search-meta">
                  Saved <time dateTime={search.savedAt}>{sastDayMonth(search.savedAt)}</time>
                  {" · "}
                  <span className="saved-search-state">{search.paused ? "Paused" : "Alerts on"}</span>
                </p>
                <div className="saved-search-actions">
                  <form action={search.paused ? resumeSearchAlerts : pauseSearchAlerts}>
                    <input type="hidden" name="search" value={search.id} />
                    <button type="submit" className="btn btn-outline text-navy saved-search-btn">
                      {search.paused ? "Resume alerts" : "Pause alerts"}{" "}
                      <span className="sr-only">for {search.label}</span>
                    </button>
                  </form>
                  <form action={deleteSearch}>
                    <input type="hidden" name="search" value={search.id} />
                    <button type="submit" className="btn btn-outline text-navy saved-search-btn">
                      Delete <span className="sr-only">saved search {search.label}</span>
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
```

Create `components/saved/SavedSearches.tsx`:

```tsx
import { getViewer } from "@/lib/auth/session";
import { listSavedSearches } from "@/lib/data/saved-searches";
import { takeNote } from "@/lib/looking-for/form-state";
import { SAVED_SEARCHES_FORM, savedSearchNoticeOf } from "@/lib/saved-searches/rules";
import { SavedSearchesView } from "./SavedSearchesView";

/** The Searches tab for this request's visitor (search alerts spec 2.7). Request-time: inside Saved's <Suspense>. */
export async function SavedSearches() {
  const account = await getViewer().catch(() => null);
  if (!account) return <SavedSearchesView searches={null} notice={null} />;
  const [searches, note] = await Promise.all([listSavedSearches(account.id), takeNote(SAVED_SEARCHES_FORM)]);
  return <SavedSearchesView searches={searches} notice={savedSearchNoticeOf(note)} />;
}
```

- [ ] **Step 6: The third tab**

In `components/saved/SavedTabs.tsx` (H Task 18):
1. Add `import { SEARCHES_NOTE } from "@/lib/saved-searches/words";` after the `@/lib/following/rules` import, and `import { SavedSearches } from "./SavedSearches";` among the `./…` imports, in alphabetical order.
2. In the `tabs` list, after the Shops tab, add:

```tsx
          { key: "searches", label: "Searches", href: savedTabPath("searches") },
```

3. Replace the ternary that renders Listings or Shops (from `{tab === "listings" ? (` to its closing `)}`) with three branches, moving the Listings and Shops notes' words exactly as they are in the file:

```tsx
      {tab === "listings" && (
        <>
          <p className="saved-note">
            Saved on this device. Once Vossie is live, your saves will follow your account to any device.
          </p>
          <SavedList />
        </>
      )}
      {tab === "shops" && (
        <>
          <p className="saved-note">Kept with your account.</p>
          <FollowedShops />
        </>
      )}
      {tab === "searches" && (
        <>
          <p className="saved-note">{SEARCHES_NOTE}</p>
          <SavedSearches />
        </>
      )}
```

4. Change "Saved's two tabs" to "Saved's three tabs" in its comment, and add "Searches are kept with the account too (search alerts spec 2.7)."

- [ ] **Step 7: Style it**

Check the names are free (`grep -n "\.saved-search" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Search alerts: Saved's Searches tab (search alerts plan, Task 5, spec 2.7 and 2.8) --- */
@layer components {
  .saved-searches-notice {
    margin-top: 20px;
  }

  /* The delete line's link sits on the pale notice, where links are navy (sky-dark is for white). */
  .saved-searches-notice a {
    color: var(--color-navy);
    text-decoration: underline 1.5px;
    text-underline-offset: 3px;
  }

  .saved-searches {
    margin-top: 8px;
  }

  /* One search a row, a line between them. From the desktop step its buttons sit to the right of its label. */
  .saved-search {
    display: grid;
    gap: 4px;
    padding-block: 14px;
    border-bottom: 1px solid var(--color-panel);
  }

  /* A link on white is sky-dark (4.7:1), 44px high. */
  .saved-search-label {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-size: 16px;
    font-weight: 600;
    text-decoration: underline 1.5px;
    text-underline-offset: 4px;
  }

  .saved-search-meta {
    color: var(--color-muted);
    font-size: 13px;
  }

  .saved-search-state {
    color: var(--color-navy);
    font-weight: 600;
  }

  .saved-search-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }

  .saved-search-btn {
    min-height: 44px;
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .saved-search {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 24px;
    }

    .saved-search-actions {
      grid-column: 2;
      grid-row: 1 / span 2;
      margin-top: 0;
    }
  }
}
```

- [ ] **Step 8: Run them to make sure they pass**

Run: `pnpm test lib/following lib/time.test.ts components/saved`
Expected: PASS: the nine new tests; H's Saved tests and `SavedList.test.tsx` unchanged.

- [ ] **Step 9: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 9 more unit tests than after Task 4.

- [ ] **Step 10: Measure the JavaScript**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Write every page's `scriptBrotli` into the ledger's "Task 5" row. **Every figure must equal Task 4's, and the Searches tab's must equal its Step 1 figure, to the byte** (spec 5): the tab is a `LinkTabs` link and a Server Component list with forms and `Link`s, all on the route Saved already loads. If any page moved, stop and find out why before going on. If any page is past the stop line, stop and report.

- [ ] **Step 11: Look at it**

Start the build (`pnpm start --port 3201`) at 390 × 844, 768 × 1024 and 1280 × 800.
- `/saved?tab=searches` signed out: the three tabs (Searches underlined), "Kept with your account. Each search sends at most one notification a day.", "SAVED SEARCHES", the sentence and SIGN IN, which comes back to the tab.
- Signed in as "Student, Midrand": "No saved searches yet" and BROWSE. Save `/browse?q=calculator` and `/browse?cat=tech&campus=all`, then back: "2 saved searches", newest first, each with its label, "Saved 14 October · Alerts on" and the two buttons (beside the label from 1280).
- PAUSE ALERTS: "Alerts paused for “calculator” at every campus." (or the campus the cookie chose) and "Paused". RESUME ALERTS. DELETE: "Deleted …" with the label as a link, which opens its results with SAVE THIS SEARCH.
- With the network throttled, nothing jumps when the tab replaces the skeleton.

Stop the server.

- [ ] **Step 12: Hand over for commit**

Files: `lib/following/rules.ts`, `lib/following/rules.test.ts`, `lib/time.ts`, `lib/time.test.ts`, `components/saved/SavedSearchesView.tsx`, `components/saved/SavedSearchesView.test.tsx`, `components/saved/SavedSearches.tsx`, `components/saved/SavedSearches.test.tsx`, `components/saved/SavedTabs.tsx`, `components/saved/SavedTabs.test.tsx`, `tests/e2e/performance.spec.ts`, `app/globals.css`.
Message: `feat: Saved's Searches tab: each saved search with its results, when it was saved and its alerts, Pause or Resume and Delete with status lines, and sign-in or Browse when there's nothing to show (search alerts spec 2.7 and 2.8). JS: Saved <n> B, Searches tab <n> B, unchanged`

---

### Task 6: `search-match` on the notifications page

E's `/notifications` shows the new kind (spec 2.12 and section 4; plan decision 14): the search icon already in `components/icons.tsx`, decorative, beside the sentence, in a row that links where the notification leads, with no prefetch (E's rows already have none). The page marks everything read on opening, which is what lets a later match make the line unread again (Task 1).

**Files:**
- Modify: `components/messages/NotificationsView.tsx`, `components/messages/NotificationsView.test.tsx`

- [ ] **Step 1: Write the test**

In `components/messages/NotificationsView.test.tsx`, add `render` and `screen` from `@testing-library/react` and `NotificationsView` from `./NotificationsView` to the imports if they aren't there, and add at the end of the file:

```tsx

describe("a saved search's matches (search alerts spec 2.12 and section 4)", () => {
  it("draws the search icon, decorative, beside the sentence, and leads to the results", () => {
    const { container } = render(
      <NotificationsView
        now={new Date("2026-10-14T13:00:00Z")}
        items={[
          {
            id: "note-ss",
            kind: "search-match",
            text: "3 new listings match your search “calculator” at Midrand",
            href: "/browse?q=calculator&campus=midrand&sort=new",
            createdAt: "2026-10-14T12:05:00Z",
            isNew: true,
          },
        ]}
      />,
    );
    const icon = container.querySelector(".notes-row svg.notes-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon?.querySelector("circle")).not.toBeNull();
    expect(icon?.querySelector("path")).toHaveAttribute("d", "m16 16 4.5 4.5");
    expect(screen.getByRole("link", { name: /3 new listings match your search “calculator” at Midrand/ })).toHaveAttribute(
      "href",
      "/browse?q=calculator&campus=midrand&sort=new",
    );
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm test components/messages/NotificationsView.test.tsx`
Expected: FAIL: the row has no icon for `search-match`.

- [ ] **Step 3: Draw it**

In `components/messages/NotificationsView.tsx`:
1. Add `SearchIcon` to the `@/components/icons` import, in alphabetical order.
2. In `KindIcon`'s `switch`, after H's `case "new-listing":` branch, add:

```tsx
    case "search-match":
      return <SearchIcon className="notes-icon" />;
```

3. Add to `KindIcon`'s comment (or above the function, if it has none), on its own line: `Saved-search alerts add "search-match", drawn with the search icon (search alerts plan decision 14).`

Run: `pnpm test components/messages/NotificationsView.test.tsx`
Expected: PASS, E's, G's and H's tests in the file unchanged.

- [ ] **Step 4: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 1 more unit test than after Task 5.

- [ ] **Step 5: Hand over for commit**

Files: `components/messages/NotificationsView.tsx`, `components/messages/NotificationsView.test.tsx`.
Message: `feat: search-match notifications show the search icon on /notifications (search alerts spec 2.12)`

---

### Task 7: Deleting an account, the data export, the privacy words and robots

POPIA (spec 2.15; plan decisions 15 to 17): deleting an account removes its saved searches (its notifications already go with it); "Download your data" gains `savedSearches`, by name, with no ids; the privacy policy's "Your account" section says what a saved search keeps, that only its owner sees it and what it's used for, and its deletion bullet names it; privacy settings say the same; and a robots test pins Saved's Searches tab as kept out of search engines. No new cookie or browser-storage key, so the privacy test's list of names is unchanged. The privacy page is a shared page, so this task measures before and after.

**Files:**
- Modify: `lib/data/accounts.ts`, `lib/data/accounts.test.ts`
- Modify: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`
- Modify: `components/account/PrivacySettingsView.tsx`, `components/account/PrivacySettingsView.test.tsx`
- Modify: `app/robots.test.ts`
- Modify: `tests/e2e/performance.spec.ts`

- [ ] **Step 1: Measure the privacy page before changing it**

In `tests/e2e/performance.spec.ts`, add this row to `PAGES`, straight after `["info page", "/how-it-works"],`:

```ts
  ["privacy page", "/privacy"],
```

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Every figure equals Task 5's. Write the new row's `scriptBrotli` into the ledger's "Start" row, "Privacy" column (plan decision 20).

- [ ] **Step 2: Change the tests first**

In `lib/data/accounts.test.ts` (D Task 3, with E's to H's changes):
1. Add, among the `./…` imports in alphabetical order: `import { addSavedSearch, listSavedSearches } from "./saved-searches";`, and add `import type { MatchQuery } from "@/lib/types";` after the `@/tests/helpers/fakes` import.
2. In the data export test that checks `Object.keys(data!)` (E's list with F's to H's keys), add `"savedSearches"` at the end of the expected keys, after H's `"following"`.
3. Add at the end of the file:

```ts

describe("saved searches in the export and in deletion (search alerts spec 2.15, plan decision 15)", () => {
  const NOW = new Date("2026-10-14T08:42:00.000Z");
  const CALCULATOR: MatchQuery = {
    q: "calculator",
    category: "tech",
    campus: "midrand",
    price: "under-100",
    pay: null,
    deals: null,
  };

  it("exports each saved search by name, with no ids", async () => {
    await addSavedSearch("acc-student", CALCULATOR, NOW);
    const data = await exportAccountData("acc-student", NOW);
    expect(data?.savedSearches).toEqual([
      {
        label: "“calculator” in Tech at Midrand, under R100",
        words: "calculator",
        category: "Tech",
        campus: "Midrand",
        price: "Under R100",
        pay: null,
        deals: null,
        alerts: "on",
        savedAt: NOW.toISOString(),
      },
    ]);
    const [saved] = await listSavedSearches("acc-student");
    expect(JSON.stringify(data)).not.toContain(saved.id);
  });

  it("deletes the account's saved searches with it, and no one else's", async () => {
    await addSavedSearch("acc-student", CALCULATOR, NOW);
    await addSavedSearch("acc-mentor", CALCULATOR, NOW);
    await deleteAccountData("acc-student");
    expect([...sampleStore().savedSearches.values()].map((row) => row.accountId)).toEqual(["acc-mentor"]);
  });
});
```

In `app/privacy/page.test.tsx`, add after the last test:

```tsx

  it("says what saved searches keep, that only you see them, and that deleting your account removes them (search alerts spec 2.15)", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(within(account).getByText(/Only you see them/)).toBeInTheDocument();
    expect(within(account).getByText(/used only to tell you about new listings/)).toBeInTheDocument();
    const keep = screen.getByRole("region", { name: "How long we keep it" });
    expect(within(keep).getByText(/your saved searches/)).toBeInTheDocument();
  });
```

(Add `within` to the `@testing-library/react` import if it isn't there. If the file renders the page another way by now, use its way.)

In `components/account/PrivacySettingsView.test.tsx`, add at the end of its `describe` (pass the same props the file's other renders pass by now; when this plan was written they were `consent={consent} deleteErrors={[]} reports={[]}`):

```tsx

  it("says the download holds your saved searches, and deleting removes them (search alerts spec 2.15)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    expect(screen.getByText(/your saved searches and their notifications go too/)).toBeInTheDocument();
    expect(screen.getAllByText(/your saved searches/)).toHaveLength(2);
  });
```

In `app/robots.test.ts`, add at the end of its `describe`:

```ts

  it("keeps crawlers off Saved's Searches tab, and not off browse's searches (search alerts spec 3, plan decision 17)", () => {
    expect(blocked("/saved?tab=searches")).toBe(true);
    expect(blocked("/browse?q=calculator&campus=midrand")).toBe(false);
  });
```

Run: `pnpm test lib/data/accounts.test.ts app/privacy components/account/PrivacySettingsView.test.tsx app/robots.test.ts`
Expected: FAIL: the export has no `savedSearches`, deletion leaves them, and the privacy words aren't there. The robots test passes already (`/saved` is disallowed): it guards that.

- [ ] **Step 3: Deletion and the export**

In `lib/data/accounts.ts`:
1. Add, among the `./…` imports in alphabetical order:

```ts
import { exportSavedSearches, forgetSavedSearchesOf, type SavedSearchExport } from "./saved-searches";
```

2. In the `AccountExport` type, after H's `following: string[];`, add:

```ts
  /** The account's saved searches by name, newest first, with no ids (search alerts spec 2.15, plan decision 15). */
  savedSearches: SavedSearchExport[];
```

and add to the type's comment: "Saved-search alerts add saved searches."
3. In `exportAccountData`, add straight before the `return {`:

```ts
  const savedSearches = await exportSavedSearches(accountId);
```

and add `    savedSearches,` as the last property of the returned object, after H's `following,`.
4. In `deleteAccountData`, straight after H's `await forgetFollowsOf(accountId);`, add:

```ts
  // And its saved searches (search alerts spec 2.15). Its own notifications, search-match ones among them, go with
  // messaging's deleteNotifications.
  await forgetSavedSearchesOf(accountId);
```

and add to its comment: "saved-search alerts' searches go with community actions' follows."

Run: `pnpm test lib/data/accounts.test.ts`
Expected: PASS.

- [ ] **Step 4: The words**

In `app/privacy/page.tsx` (edit by meaning: E to H changed these lists):
1. In the `privacy-sign-in` section's list, straight after H's bullet that starts `<strong>The shops you follow.</strong>`, add:

```tsx
          <li>
            <strong>Your saved searches.</strong> The words and filters of each search you save, when you saved it and
            whether its alerts are paused, kept with your account. Only you see them: shops never learn who was told,
            and Hub staff tools don&apos;t show them. They are used only to tell you about new listings that match.
            Allowed under POPIA section 11: needed to run the service you ask for.
          </li>
```

2. In the `privacy-keep` list, in the bullet that says what deleting your account removes, add "your saved searches," straight after H's "the shops you follow," (or, if the sentence is built differently by now, at the end of what goes straight away).

In `components/account/PrivacySettingsView.tsx` (edit by meaning: E to H changed these sentences):
1. In "Download your data"'s sentence, add "your saved searches" to the list of what the file holds, before its last item.
2. In the list of what deleting does, add this bullet before its last one:

```tsx
          <li>your saved searches and their notifications go too;</li>
```

Run: `pnpm test app/privacy components/account/PrivacySettingsView.test.tsx app/robots.test.ts`
Expected: PASS, with `app/privacy/page.test.tsx`'s test that every `vossie_…` name is on the page unchanged.

- [ ] **Step 5: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 5 more unit tests than after Task 6.

- [ ] **Step 6: Measure the JavaScript**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Write every page's `scriptBrotli` into the ledger's "Task 7" row. **Every figure must equal Task 5's, and the privacy page's must equal its Step 1 figure, to the byte** (spec 5): the privacy page is a Server Component, and only its text changed. If any page moved, stop and find out why before going on.

- [ ] **Step 7: Hand over for commit**

Files: `lib/data/accounts.ts`, `lib/data/accounts.test.ts`, `app/privacy/page.tsx`, `app/privacy/page.test.tsx`, `components/account/PrivacySettingsView.tsx`, `components/account/PrivacySettingsView.test.tsx`, `app/robots.test.ts`, `tests/e2e/performance.spec.ts`.
Message: `feat: deleting an account removes its saved searches, the data export gains them by name, and the privacy policy and settings say what they keep and who sees them (search alerts spec 2.15). JS: privacy <n> B, unchanged`

---

### Task 8: End-to-end tests for saved-search alerts

Every flow in spec 6's end-to-end list, with plan decision 19's split: the device projects check what changes nothing anyone else counts (saving through sign-in, saving without the app's JavaScript, the Searches tab's link, pause, resume and delete, its signed-out state, and no row on plain browse), each for a student of its own searching a word no other test uses; a new project, `alerts-writes`, runs after every other one for the tests that publish (the notification, opened, then made unread again by two more; an edit and a relist that send nothing). The publishing shop is the sample "Seller, Tech corner", acting only on the test's own listings.

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/helpers/alerts.ts`
- Create: `tests/e2e/search-alerts.spec.ts`, `tests/e2e/alerts-writes.spec.ts`

- [ ] **Step 1: A project that runs last of all**

In `playwright.config.ts` (F Task 16, G Task 20, H Tasks 22 and 23):
1. After H's `const COMMUNITY_WRITES = …;` line, add:

```ts
// The saved-search tests that publish run after every other test: new listings change browse's counts, and Tech
// corner's would land in community-writes' follow test, which counts them (search alerts plan decision 19).
const ALERTS_WRITES = /alerts-writes\.spec\.ts$/;
```

2. On each of the five device projects, replace `testIgnore: [SELLING_WRITES, STAFF_WRITES, COMMUNITY_WRITES]` with `testIgnore: [SELLING_WRITES, STAFF_WRITES, COMMUNITY_WRITES, ALERTS_WRITES]`.
3. After H's `community-writes` project, add:

```ts
    // After everything else (search alerts plan decision 19). Run it alone with --project=alerts-writes --no-deps.
    {
      name: "alerts-writes",
      use: phone(390, 844),
      testMatch: ALERTS_WRITES,
      dependencies: [...DEVICE_PROJECTS, "selling-writes", "staff-writes", "community-writes"],
    },
```

Run: `pnpm exec playwright test --list --project=alerts-writes`
Expected: it lists nothing yet, and no error (the file comes in Step 4).

- [ ] **Step 2: Write the helpers**

Create `tests/e2e/helpers/alerts.ts` (Playwright only runs `*.spec.ts`, so this file is never run on its own):

```ts
import { expect, type Page } from "@playwright/test";
import { main } from "./messaging";

// Shared by the saved-search tests (search alerts plan, Task 8). Every test shares one server and one sample store, so
// each signs up its own student and searches for a word no other test uses (plan decision 19).

/** A browse link for one word, with the campus pinned so no cookie changes it. */
export const searchAt = (word: string, campus = "midrand") => `/browse?q=${word}&campus=${campus}`;

/** The Save this search row on the page that's showing (a CSS locator, so only the visible copy). */
export const saveRow = (page: Page) => main(page).locator(".save-search").filter({ visible: true });

/** Presses Save this search on the browse page that's showing, and waits for "Search saved.". */
export async function pressSave(page: Page) {
  await saveRow(page).getByRole("button", { name: "Save this search" }).click();
  await expect(saveRow(page).getByRole("status")).toHaveText("Search saved.");
}

/** The search-match lines on /notifications about this word's search. */
export const matchNotes = (page: Page, word: string) =>
  main(page).getByRole("link", { name: new RegExp(`match(es)? your search “${word}”`) });

/** The path and query of the page that's showing. */
export const pathOf = (page: Page) => {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
};
```

- [ ] **Step 3: Write the tests that change nothing anyone counts**

Create `tests/e2e/search-alerts.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { pathOf, pressSave, saveRow, searchAt } from "./helpers/alerts";
import { button, main, newBuyer, onlyAt, signUp, signUpHere } from "./helpers/messaging";
import { uniqueWord } from "./helpers/selling";

const BOTH = ["phone-390", "desktop-1440"];

test.describe("saved searches (search alerts spec section 6)", () => {
  test("signed out, Save this search goes through sign-in and back to the same link, then saves (spec 2.6)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    const word = uniqueWord();
    await page.goto(searchAt(word));
    await expect(saveRow(page)).toContainText("Hear when something new matches.");
    await saveRow(page).getByRole("link", { name: "Save this search" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === searchAt(word));
    await signUpHere(page, newBuyer());
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === searchAt(word));
    await pressSave(page);
    await page.reload();
    await expect(saveRow(page)).toContainText("You've saved this search.");
    await expect(saveRow(page).getByRole("link", { name: "Manage saved searches" })).toHaveAttribute(
      "href",
      "/saved?tab=searches",
    );
  });

  test("Save this search works with the app's JavaScript blocked (spec section 4)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.route(/\/_next\/static\/.+\.js$/, (route) => route.abort());
    const word = uniqueWord();
    await page.goto(searchAt(word));
    await pressSave(page);
    expect(pathOf(page)).toBe(searchAt(word));
  });

  test("Saved's Searches tab: the label's link, pause, resume, and delete with its status line (spec 2.7 and 2.8)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const word = uniqueWord();
    const results = `/browse?q=${word}&cat=tech&campus=midrand&price=under-100`;
    const label = `“${word}” in Tech at Midrand, under R100`;
    await page.goto(results);
    await pressSave(page);

    await page.goto("/saved?tab=searches");
    const tabs = page.getByRole("navigation", { name: "What's saved" });
    await expect(tabs.getByRole("link", { name: "Searches" })).toHaveAttribute("aria-current", "page");
    await expect(main(page).getByText("Kept with your account. Each search sends at most one notification a day.")).toBeVisible();
    const row = main(page).getByRole("listitem").filter({ hasText: label });
    await expect(row).toContainText("Alerts on");
    await row.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === results);

    await page.goto("/saved?tab=searches");
    await button(page, `Pause alerts for ${label}`).click();
    await expect(main(page).getByRole("status")).toHaveText(`Alerts paused for ${label}.`);
    await expect(row).toContainText("Paused");
    await button(page, `Resume alerts for ${label}`).click();
    await expect(main(page).getByRole("status")).toHaveText(`Alerts on for ${label}.`);
    await expect(row).toContainText("Alerts on");
    await button(page, `Delete saved search ${label}`).click();
    await expect(main(page).getByRole("status")).toHaveText(`Deleted ${label}.`);
    await expect(main(page).getByText("No saved searches yet")).toBeVisible();

    await main(page).getByRole("status").getByRole("link", { name: label }).click();
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === results);
    await expect(saveRow(page).getByRole("button", { name: "Save this search" })).toBeVisible();
  });

  test("Saved's Searches tab asks a signed-out visitor to sign in, coming back to it (spec 2.7)", async ({ page }) => {
    onlyAt(...BOTH);
    await page.goto("/saved?tab=searches");
    await expect(main(page).getByText("Sign in to save searches. They'll show here.")).toBeVisible();
    await main(page).getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsaved%3Ftab%3Dsearches$/);
  });

  test("plain browse and a campus alone have no Save row (spec 2.4)", async ({ page }) => {
    onlyAt(...BOTH);
    await page.goto("/browse");
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
    await expect(saveRow(page)).toHaveCount(0);
    await page.goto("/browse?campus=midrand");
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
    await expect(saveRow(page)).toHaveCount(0);
  });
});
```

(If D's built sign-up lands somewhere else before following `next`, adjust only the URL check after `signUpHere`, and say so in the hand-over.)

- [ ] **Step 4: Write the tests that publish**

Create `tests/e2e/alerts-writes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { matchNotes, pathOf, pressSave, searchAt } from "./helpers/alerts";
import { button, field, main, newBuyer, sellerPage, signUp } from "./helpers/messaging";
import { publishListing, uniqueWord } from "./helpers/selling";

// Runs in the alerts-writes project, after every other test (search alerts plan decision 19): publishing changes
// browse's counts, and Tech corner's new listings would otherwise land in community-writes' follow test.

test.describe("saved-search alerts (search alerts spec section 6)", () => {
  test("a match is named and opened; two more later make the same line unread again, linking to them newest first", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUp(page, newBuyer());
    const word = uniqueWord();
    await page.goto(searchAt(word));
    await pressSave(page);

    const shop = await sellerPage(browser, baseURL!);
    const first = `Desk fan ${word}`;
    const firstId = await publishListing(shop, first);

    await page.goto("/notifications");
    const note = matchNotes(page, word);
    await expect(note).toHaveCount(1);
    await expect(note).toContainText(`${first} matches your search “${word}” at Midrand`);
    await note.click();
    await expect(page).toHaveURL(new RegExp(`/listings/${firstId}$`));

    // Opening /notifications marked it read; the next two make it unread again, counting only them (spec 2.12).
    const second = `Desk lamp ${word}`;
    const third = `Desk clock ${word}`;
    await publishListing(shop, second);
    await publishListing(shop, third);
    await shop.context().close();

    await page.goto("/notifications");
    await expect(note).toHaveCount(1);
    await expect(note).toContainText("New");
    await expect(note).toContainText(`2 new listings match your search “${word}” at Midrand`);
    await note.click();
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === `/browse?q=${word}&campus=midrand&sort=new`);
    const cards = page.getByRole("article").filter({ visible: true });
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText(third);
    await expect(cards.nth(1)).toContainText(second);
  });

  test("an edit that makes a listing match, and a relist, send no alert (spec 2.10)", async ({ page, browser, baseURL }) => {
    const word = uniqueWord();
    const shop = await sellerPage(browser, baseURL!);
    const kettle = `Kettle ${uniqueWord()}`;
    const kettleId = await publishListing(shop, kettle);
    const lamp = `Desk lamp ${word}`;
    await publishListing(shop, lamp);

    await signUp(page, newBuyer());
    await page.goto(searchAt(word));
    await pressSave(page);
    expect(pathOf(page)).toBe(searchAt(word));

    // The kettle is renamed to match; the lamp, which matches already, is marked sold and relisted.
    await shop.goto(`/sell/listings/${kettleId}/edit`);
    await field(shop, "Title").fill(`Kettle ${word}`);
    await button(shop, "Save and publish").click();
    await expect(main(shop).getByRole("status")).toContainText("Your changes are saved.");
    await main(shop).getByRole("button", { name: `Mark sold ${lamp}` }).click();
    await shop.goto("/sell/listings?tab=sold");
    await main(shop).getByRole("button", { name: `Relist ${lamp}` }).click();
    await shop.goto("/sell/listings");
    await expect(main(shop).getByRole("link", { name: `Edit ${lamp}` })).toBeVisible();
    await shop.context().close();

    await page.goto("/notifications");
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
    await expect(matchNotes(page, word)).toHaveCount(0);
  });
});
```

(If F's built listing form names its save button differently on an available listing's edit page, use its name.)

- [ ] **Step 5: Run them**

Run, one after another:
- `pnpm e2e tests/e2e/search-alerts.spec.ts`
- `pnpm e2e --project=alerts-writes --no-deps tests/e2e/alerts-writes.spec.ts`

Expected: PASS. Then run the whole suite once: `pnpm e2e`. Expected: all pass, the `alerts-writes` project last. Record the counts for Task 10.

If the first write test counts more than one line, two of the test's publishes landed on different SAST days (run it again away from midnight) or `notifySavedSearches` told the account twice: check the oldest-first loop's `told` set. If H's follow test in `community-writes` now counts a third new listing, `alerts-writes` didn't wait for it: check its `dependencies`.

- [ ] **Step 6: Hand over for commit**

Files: `playwright.config.ts`, `tests/e2e/helpers/alerts.ts`, `tests/e2e/search-alerts.spec.ts`, `tests/e2e/alerts-writes.spec.ts`.
Message: `test: end to end for saved-search alerts: saving through sign-in and without JavaScript, the Searches tab's link, pause, resume and delete, a match named and opened then made unread again by two more, and no alert for an edit or a relist, in a project that runs last (search alerts spec section 6)`

---

### Task 9: Accessibility, layout shift and size

axe on every state of the Save row and on the Searches tab (with rows, empty and signed out), layout shift on browse with a search and on the Searches tab, and the JS budget for both signed in (spec sections 4 to 6). The checks that need a saved search save one for a student of their own, which nothing else counts, so they run in the device projects at 390 and 1440 (plan decision 19). The refused save is checked here too: two tabs, the second pressing Save after the first. The "at the limit" state isn't saved 20 times here: its markup is the "saved" state's (one line and the same Manage link), which axe checks, and Task 4's unit tests cover its words.

**Files:**
- Modify: `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`, `tests/e2e/performance.spec.ts`
- Create: `tests/e2e/alerts-checks.spec.ts`

- [ ] **Step 1: axe on the states that need nothing saved**

Add to the end of `tests/e2e/a11y.spec.ts` (it has `seriousIssues(page)` and its own `signInAsSample(page, label?)`, D Task 14):

```ts

test("browse with a search, signed out: the Save this search row (search alerts spec section 4)", async ({ page }) => {
  await page.goto("/browse?q=calculator&campus=midrand");
  await expect(page.locator("main").getByRole("link", { name: "Save this search" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("Saved's Searches tab, signed out and with none yet (search alerts spec 2.7)", async ({ page }) => {
  await page.goto("/saved?tab=searches");
  await expect(page.getByText("Sign in to save searches.", { exact: false })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await signInAsSample(page);
  await page.goto("/saved?tab=searches");
  await expect(page.getByText("No saved searches yet")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});
```

(The sample student only reads here: no test saves a search for a sample account, so "No saved searches yet" holds.)

- [ ] **Step 2: axe on the states that need a saved search**

Create `tests/e2e/alerts-checks.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { pressSave, saveRow, searchAt } from "./helpers/alerts";
import { button, main, newBuyer, onlyAt, signUp } from "./helpers/messaging";
import { uniqueWord } from "./helpers/selling";

// axe on Save this search's signed-in states and the Searches tab with a row (search alerts spec section 4). Each test
// saves searches for a student of its own, which nothing else counts, so they run in the device projects (plan
// decision 19), at 390 and 1440.

test.use({ reducedMotion: "reduce" });

async function seriousIssues(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target.join(" ")) }));
}

test("Save this search's states, then the Searches tab with a row and its status line", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await signUp(page, newBuyer());
  const word = uniqueWord();
  const label = `“${word}” at Midrand`;
  await page.goto(searchAt(word));
  await expect(saveRow(page).getByRole("button", { name: "Save this search" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await pressSave(page);
  expect(await seriousIssues(page)).toEqual([]);
  await page.reload();
  await expect(saveRow(page)).toContainText("You've saved this search.");
  expect(await seriousIssues(page)).toEqual([]);

  await page.goto("/saved?tab=searches");
  await expect(main(page).getByRole("link", { name: label })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await button(page, `Pause alerts for ${label}`).click();
  await expect(main(page).getByRole("status")).toHaveText(`Alerts paused for ${label}.`);
  expect(await seriousIssues(page)).toEqual([]);
  await button(page, `Delete saved search ${label}`).click();
  await expect(main(page).getByRole("status")).toHaveText(`Deleted ${label}.`);
  expect(await seriousIssues(page)).toEqual([]);
});

test("a save refused in another tab says why in the row, as an alert (search alerts spec 2.6)", async ({
  page,
  context,
}) => {
  onlyAt("phone-390", "desktop-1440");
  await signUp(page, newBuyer());
  const word = uniqueWord();
  const other = await context.newPage();
  await page.goto(searchAt(word));
  await other.goto(searchAt(word));
  await pressSave(page);
  await saveRow(other).getByRole("button", { name: "Save this search" }).click();
  await expect(saveRow(other).getByRole("alert")).toHaveText("You've saved this search already.");
  await expect(saveRow(other).getByRole("link", { name: "Manage saved searches" })).toBeVisible();
  expect(await seriousIssues(other)).toEqual([]);
});
```

- [ ] **Step 3: Layout shift**

In `tests/e2e/cls.spec.ts`, add these rows at the end of `PAGES` (after the rows D to H added):

```ts
  ["browse page, a search", "/browse?q=calculator"],
  ["browse page, a search (signed in)", "/browse?q=calculator", undefined, true],
  ["Saved page, Searches tab", "/saved?tab=searches"],
  ["Saved page, Searches tab (signed in)", "/saved?tab=searches", undefined, true],
```

The row's box keeps its height whatever the session says (plan decision 6); Saved's Searches tab streams in with H's tabs behind `SavedSkeleton`.

- [ ] **Step 4: The JavaScript, signed in**

In `tests/e2e/performance.spec.ts`, add these rows at the end of H's `SIGNED_IN_PAGES` list:

```ts
  ["browse page, a search (signed in)", "/browse?q=calculator"],
  ["Saved page, Searches tab (signed in)", "/saved?tab=searches"],
```

(If H's build named the list or its loop differently, add the two paths to whatever measures pages signed in.)

- [ ] **Step 5: Run them**

Run, one after another:
- `pnpm e2e tests/e2e/a11y.spec.ts tests/e2e/alerts-checks.spec.ts tests/e2e/cls.spec.ts`
- `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`

Expected: PASS: no serious or critical axe issues; every layout shift 0.05 or less at 390 and 1440; every page inside the budget. Write the two signed-in figures into the ledger's line under the table. Every page's signed-out `scriptBrotli` must still equal the ledger's "Task 7" row (spec 5). If an axe check fails, fix the page (contrast, names, ids), not the test. If browse's shift fails, check that `.save-search` keeps its 72px (44px from the tablet step) in every state; if Saved's fails, check `SavedSkeleton`'s tabs and note against the Searches tab's note, which may run to two lines at 360px.

- [ ] **Step 6: Hand over for commit**

Files: `tests/e2e/a11y.spec.ts`, `tests/e2e/alerts-checks.spec.ts`, `tests/e2e/cls.spec.ts`, `tests/e2e/performance.spec.ts`.
Message: `test: axe, layout shift and the JS budget for Save this search's states and Saved's Searches tab, and a save refused in another tab (search alerts spec sections 4 to 6). JS signed in: browse with a search <n> B, Searches tab <n> B`

---

### Task 10: Review screenshots, docs and final checks

**Files:**
- Modify: `tests/e2e/screenshots.spec.ts`
- Create: `docs/progress/search-alerts/*.png`
- Modify: `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, the spec (`docs/superpowers/specs/2026-10-14-search-alerts-design.md`)
- Modify: this plan (the ledger and a "Changes made during the build" section)

- [ ] **Step 1: Check the docs are free to edit**

Run `git status --short` on its own. Expected: only ` M .claude/launch.json` and nothing of this stage's left uncommitted. If another stage's work has the docs open (changed and uncommitted), stop and ask the controller before editing them. Read each doc's current text before editing it, and edit by meaning where this step's quoted lines have moved.

- [ ] **Step 2: Add the review screenshots**

In `tests/e2e/screenshots.spec.ts`, add below the `@playwright/test` import (skip any name the file already imports; H added several):

```ts
import { pressSave } from "./helpers/alerts";
import { button, newBuyer, sellerPage, signUp } from "./helpers/messaging";
import { publishListing } from "./helpers/selling";
```

and add to the end of the file:

```ts

test("search alerts review screenshots", async ({ page, browser, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/search-alerts/${project}-${name}.png`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  const word = `lamp${Date.now().toString(36)}`;
  const results = `/browse?q=${word}&campus=midrand`;
  const label = `“${word}” at Midrand`;

  await page.goto(results);
  await expect(page.locator("main .save-search").filter({ visible: true })).toBeVisible();
  await page.screenshot({ path: file("01-browse-save-signed-out"), fullPage: true });

  await signUp(page, newBuyer());
  await page.goto(results);
  await page.screenshot({ path: file("02-browse-save-button"), fullPage: true });
  await pressSave(page);
  await page.screenshot({ path: file("03-browse-search-saved"), fullPage: true });

  await page.goto("/browse?cat=tech&campus=all&price=under-500");
  await pressSave(page);
  await page.goto("/saved?tab=searches");
  await page.screenshot({ path: file("04-saved-searches"), fullPage: true });
  await button(page, `Pause alerts for ${label}`).click();
  await expect(page.locator("main").getByRole("status")).toHaveText(`Alerts paused for ${label}.`);
  await page.screenshot({ path: file("05-saved-searches-paused"), fullPage: true });
  await button(page, `Resume alerts for ${label}`).click();
  await expect(page.locator("main").getByRole("status")).toHaveText(`Alerts on for ${label}.`);

  const shop = await sellerPage(browser, baseURL!);
  await publishListing(shop, `Desk lamp ${word}`);
  await publishListing(shop, `Desk fan ${word}`);
  await shop.context().close();
  await page.goto("/notifications");
  await page.screenshot({ path: file("06-notification"), fullPage: true });
});
```

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "search alerts review screenshots"`
Expected: 12 PNGs in `docs/progress/search-alerts/`. Open a few and check they show what their names say: 06 shows one line, "2 new listings match your search “lamp…” at Midrand", marked New.

- [ ] **Step 3: Bring the spec in line with the build**

In `docs/superpowers/specs/2026-10-14-search-alerts-design.md`, set the status to "Built (2026-10-<day>), in sample mode." and add a section at the end, "## 8. Changes on plan review and build", listing where the plan and the build refined the spec (they win over the decisions above):
- words that are all stop words or single letters are kept as no words, and a post without a campus is for every campus (plan decision 2);
- the row also shows above browse's error, and its states stack on phones and sit side by side from the tablet step (plan decision 6);
- status lines wait under `save-search:<the search's key>` and `saved-searches` (plan decision 7), and no form has an error summary (plan decision 8);
- the Searches tab's count line and "Saved 12 October" through `sastDayMonth` (plan decision 10);
- a read notification made unread again counts from one and names that listing; "never more than one unread" holds within a SAST day (plan decision 12);
- the match also refuses a hidden listing, a draft and a shop that isn't approved on its own, not only through F's condition (plan decision 13);
- the export's fields, and other students' notifications naming a deleted shop's listing staying (plan decision 15); privacy settings' words too (plan decision 16);
- the refusal at the limit: "You have 20 saved searches. Delete one first." (plan decision 18);
- the end-to-end tests that publish run in their own `alerts-writes` project after H's `community-writes`, not in F's `selling-writes` (plan decision 19);
- anything else from this plan's "Changes made during the build".

- [ ] **Step 4: Log the decisions**

In `docs/reference/LANDING-DECISIONS.md`, add a row after the last, numbered one more than it, in the log's style:

```markdown
| N | 2026-10-<day> | Saved-search alerts plan decisions that change the spec (search alerts spec decisions 1, 4, 6, 12 and 15, and section 6) | **Words that are all stop words count as none; the Save row shows above an error too; a read search-match notification made unread again counts from one and names its listing, and "one unread" holds within a SAST day; the match guards against hidden, draft and unapproved listings itself; the export names each search's filters; privacy settings name saved searches too; the publishing end-to-end tests run in their own project, last** | Plan decisions 2, 6, 12, 13, 15, 16 and 19 in `2026-10-14-search-alerts.md`. The spec now says so. No page's JavaScript changed. H's one-a-day rule for new-listing notifications is now a shared helper with the same behaviour. <Lama, at plan review, or: Claude, under Lama's standing goal> |
```

Name in it any other plan decision Lama changed or kept on purpose, and any JS figure Lama accepted under the stop rule.

- [ ] **Step 5: Update the go-live checklist**

In `docs/reference/GO-LIVE.md` (edit by meaning; earlier stages changed it):
- Section 2: the row "Saved searches: save from browse, pause and delete on Saved, a notification when a new listing matches": **Built (sample mode)**.
- Section 6, Backend: keep "Saved-search matching runs inside the publish Server Action (stage I). On the real backend, run it as a database query or from a queue, so publishing doesn't wait." Add after it: `- [ ] Supabase behind \`lib/data/saved-searches.ts\`. The match keeps browse's rules: \`listingMatches\` becomes the query's WHERE, or the queue worker calls it.`
- Section 7: keep "And do new messages, or saved-search alerts (stage I), send an email?".
- Section 8: mark stage I done in sample mode, in the style of the earlier stages. On its "After launch" line, add "saved-search email alerts or a digest, once there's an email service and a consent choice, and alerts on price drops (search alerts spec 7)".
- The "Totals" line: add the screens this stage built (Save this search on browse, Saved's Searches tab).

- [ ] **Step 6: Update CLAUDE.md**

In `CLAUDE.md`:
- Under "Code rules", after H's line about Looking For requests (or after the line that starts `- Who's signed in comes only from`, if H's isn't there), add:
  `- Saved searches live in the sample store and are read through \`lib/data/saved-searches.ts\`. They match listings only through browse's \`listingMatches\` (\`lib/browse/results.ts\`): never copy browse's search rules. Matching runs in F's \`saveListingForm\` on a first publish, after \`notifyFollowers\` and under its condition. A notification that comes at most once a day goes through \`notifyOncePerDay\` in \`lib/data/notifications.ts\`.`
- Under "Privacy (POPIA)", after H's line about follows, add: `- Saved searches are seen only by their owner and used only for their alerts. Deleting one removes its notifications; deleting an account removes them all.`

- [ ] **Step 7: Update the progress log**

In `docs/PROGRESS.md`, add a section before "Next", in the style of the earlier ones:

```markdown
## 2026-10-<day>: Saved-search alerts built, in sample mode (stage I)
- **Save this search** on browse (`components/browse/SaveSearchControl.tsx`): a fixed-height row under the chips for any search with words, a category or a filter; a sign-in link signed out and a plain form signed in; "Search saved." once, then "You've saved this search." with Manage saved searches. Up to 20 per account; the same words in another order are the same search.
- **Saved's Searches tab** (`/saved?tab=searches`): each search's label linking to its results with the campus pinned, when it was saved, Pause or Resume alerts, and Delete, with status lines.
- **Alerts:** a listing's first publish by an approved shop is matched against every active saved search with browse's own `listingMatches`. Each search makes at most one `search-match` notification a SAST day, made unread again by a later match. Edits, relists, resumes and the shop's own owner send nothing. No email.
- **Privacy:** the policy and privacy settings name saved searches; deleting an account removes them; the data export gains them by name.
- **Where the build differed from the plan** is in the plan's "Changes made during the build".
- **Plan decisions Lama may want to revisit:** <list any that came up in review, or "none">.
- **Checks:**
  - lint and types are clean;
  - <n> unit tests pass;
  - end to end, <n> pass, <n> are skipped by design and none fail (the `alerts-writes` project last);
  - axe finds no serious or critical issues.
- **First visit at 390px, JS brotli:** homepage <n> B, browse <n> B, browse with a search <n> B, listing <n> B, storefront <n> B, Saved <n> B, Saved's Searches tab <n> B, privacy <n> B, all unchanged (stop line <n> B, limit 153,600 B). Signed in: browse with a search <n> B, the Searches tab <n> B.
- **Layout shift** (fonts held back, at 390 and 1440px): <a table of browse with a search and the Searches tab, signed out and in>.
- Review screenshots: `docs/progress/search-alerts/`.
```

Fill in the numbers from your runs. Then make "Next" say:

```markdown
## Next
- Lama reviews the screenshots in `docs/progress/search-alerts/`. To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "search alerts review screenshots"`.
- Then the go-live checklist's backend work (`docs/reference/GO-LIVE.md`, section 6): Supabase and an email service in place of the sample store.
```

- [ ] **Step 8: Fill in this plan**

Fill in the JS ledger, and add a "Changes made during the build" section after it, listing every place the build differed from the tasks as written, with the commit that made each change.

- [ ] **Step 9: Final checks**

Run, one after another: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`.
Expected: all pass. Record the unit and e2e counts in `docs/PROGRESS.md`.

Then run `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` once more and write the "Final (Task 10)" row of the ledger. Every figure must equal the "Task 7" row's.

- [ ] **Step 10: Hand over for commit**

Files: `tests/e2e/screenshots.spec.ts`, `docs/progress/search-alerts/`, `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/superpowers/specs/2026-10-14-search-alerts-design.md`, this plan.
Message: `docs: saved-search alerts built in sample mode (stage I): review screenshots, the spec's changes, decision <N>, the go-live checklist, CLAUDE.md and the progress log`
