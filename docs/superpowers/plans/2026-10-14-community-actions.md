# Vossie Community Actions (Sample Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build stage H as the spec `docs/superpowers/specs/2026-10-14-community-actions-design.md` describes: a signed-in student posts a Looking For request, edits, closes, reopens and deletes it, and sees its offers on its page and in Your requests; an approved shop offers to help through a composer page, and the offer is an E conversation in the inbox both sides already use, with the asker unnamed until they reply; the Hub can hide a reported request from G's queue; students follow shops from the storefront's band, find them on Saved's Shops tab, and get one notification a day when a followed shop lists something new; and when the network drops, a small service worker shows Vossie's own offline page. Everything runs on the sample store, every form works without the app's JavaScript, and no shared page gets new client code. Tested at five screen sizes and within the JS budget.

**Architecture:**
- **Two new tables in the sample store** (`lib/data/rows.ts`, `lib/data/store.ts`): `requests`, seeded from part B's 16 fixtures (which stay as they are), and `follows`. Two optional fields join earlier rows: `requestId` and `requestTitle` on E's `ConversationRow`, and `count` on E's `NotificationRow`. Only `lib/data/requests.ts`, `offers.ts`, `follows.ts`, and E's `messages.ts` and `notifications.ts` touch them.
- **Requests are read like F's listings.** The four cached request functions in `lib/data/index.ts` keep their names and signatures, read the store through `lib/data/requests.ts`, and are tagged `requests`. Every write calls `requestsChanged()` (`updateTag`), then F's `done()` (`refresh()`, then a `replace` redirect), so the board, the homepage's band, request pages and the sitemap follow on the next request.
- **An offer is an E conversation** that the shop starts (`startOffer` in E's `lib/data/messages.ts`), with the status `offered` until the asker replies. E's inbox, thread, scam check, reports, sale status, notifications and deletion rules carry it; F's counting leaves offer threads out of enquiries and the reply rate.
- **Plain forms, Server Actions, redirects** (D's, E's, F's and G's pattern). Requests and offers post to `lib/looking-for/actions.ts`, follows to `lib/following/actions.ts`, and the Hub's Hide the request to G's `lib/staff/admin-actions.ts`. Each takes identity only from the session, keeps errors and typed values in D's form state, and ends with `done(path)`.
- **The session's parts are server slots.** The request page's asker panel and the storefront's Follow each sit in their own `<Suspense>`, whose fallback is the signed-out version, so the prerendered shells stay and no client code is added. Saved's tabs are links.
- **Offline without a script file.** `/offline` and `/sw.js` are route handlers. One statement in the inline boot script registers the worker after the page's `load`, in production builds only.

**Tech Stack:** As stage G leaves it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5.9;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5 with Testing Library and jsdom 30;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-14-community-actions-design.md`. "Spec 2.5" in this plan means that spec's section 2, decision 5; "spec 4" means its section 4.
- **The stages this builds on:** stage D, `docs/superpowers/plans/2026-10-14-accounts.md` ("D's plan", "D decision 3"); stage E, `docs/superpowers/plans/2026-10-14-messaging.md` ("E's plan", "E Task 7", "E decision 6"), whose spec's section 9 wins; stage F, `docs/superpowers/plans/2026-10-14-selling.md` ("F's plan", "F decision 2"), whose spec's section 8 wins; stage G, `docs/superpowers/plans/2026-10-14-staff-tools.md` ("G's plan", "G decision 5"). **Where E's built code and E's plan differ, the code wins:** this plan quotes E's code as it was on 2026-10-14 (its Tasks 1 to 6 built).
- **Part B (built):** the board, the request page and the homepage's band (`2026-10-14-community-pages-design.md`, decision 2: requests name no one); **the shopping pages (built):** the storefront's band and Saved (`2026-10-13-shopping-pages-design.md`, 4.1 and section 5).
- **The old demo:** `docs/reference/FUNCTION-MAP.md`, E2 and E3 (follows), N1 (Looking For), G9 and G12 (the worker and the offline page).
- **The go-live checklist:** `docs/reference/GO-LIVE.md`, sections 1 and 2 (`/offline`, "followed sellers once accounts exist").
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`, row 67 (this stage's spec) and whatever D to G add.

---

## Before you start

**This plan starts after stage G.** When it was written (2026-10-14), stage E's build was under way (its Tasks 1 to 6 committed, Task 7's session links in the working tree), stage F had a committed plan and no code, and stage G's plan was being written alongside this one (its 22 tasks were finished as this plan was). Start only once G's last task (its docs) is committed. Then work through "Recheck before starting" below before Task 1: this plan is written against E's code and E's, F's and G's planned names, and the builds may have changed some.

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. `.claude/launch.json` has a change made outside this work: never stage it.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed. This is Lama's standing preference.
3. **Files this plan removes or moves:** none. No task runs `rm`. If something looks unused, leave it and list it in the hand-over for Lama.
4. **One new browser-storage name, no new cookie:** the service worker's cache, `vossie_offline` (spec 23). The privacy page names it (its test checks).
5. **The service worker's registration** (spec 22): **accepted by Lama, 2026-10-14.** It stays its own task (Task 21), last before the end-to-end tests, and it's cut if it costs 100 B or more compressed or moves any script figure (the JS ledger's cut rule).
6. **A Playwright project that runs last of all** (Task 22): `community-writes`, after the five device projects, F's `selling-writes` and G's `staff-writes`, for the writes buyers see (new requests on the board and the homepage, offers counted, hidden requests, Tech corner's new listings), as F and G do. Every other test blocks service workers (Task 21).
7. **Sample wording.** The request form's hints and errors, the status lines, the notification sentences, the composer's notes, the empty states, the offline page and the followers line are for Lama to change. Plan decision 26 lists where they live.

No installs are needed.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time. Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` anything.
- Never kill an install or build that is still running.
- Port 3100 is Lama's dev server. Don't touch it. The e2e tests use 3200; the "looking at it" checks use 3201.
- Before you edit a shared file (`app/globals.css`, `app/layout.tsx`, `lib/types.ts`, `lib/data/rows.ts`, `lib/data/store.ts`, `lib/data/index.ts`, `lib/data/accounts.ts`, `lib/data/messages.ts`, `lib/data/notifications.ts`, `app/privacy/page.tsx`, `playwright.config.ts`, `tests/e2e/*.spec.ts`, `docs/*`, and every file stages D to G created), read its current text and edit by the exact lines that are there now. Never paste back a whole list or file from an older copy. Where this plan quotes a line from D's, E's, F's or G's plan or code and the built file says it differently, edit by meaning and note it in the hand-over.

## Recheck before starting

Stages E to G weren't fully built when this plan was written, and G's plan was finished alongside it. Before Task 1, check each item against the code, one command or file at a time, and write what you find in the ledger's "Start" row or a message to the controller. If something differs in a way a task's quoted code depends on, stop and report rather than guess. Items marked **(G, not yet planned)** name things G's unwritten or unfinished tasks were expected to add; check them most carefully.

1. **Git.** `git log --oneline -5` shows G's docs commit (G's last task) at the top; `git status --short` shows only ` M .claude/launch.json`.
2. **The stop line and the figures.** Read `docs/PROGRESS.md` and the decisions log for the newest accepted JS figures and stop line (152,305 B when this plan was written; the listing page was 151,770 B at E's start, the highest page). Use G's final figures and the newest stop line in the ledger. Plan for little room on the listing page whatever the figures say: decision 63's saving is a threshold effect that new code can undo.
3. **The store** (D, E, F and G Task 1). `lib/data/store.ts`: `SampleStore` with D's eight tables, E's `conversations`, `messages`, `reports`, `notifications`, F's `sellers`, `listings`, `photos`, `onboardingDrafts`, and G's `auditLog`, `featuredPins`, `featuredDraws`, `pickupPoints`, `mentorNotes`, `hubPosts`, `hubRsvps`, `hubBookings`; `STORE_VERSION` (4 after G); `sampleStore()`, `resetSampleStore()` and a private `seedStore()` whose returned object lists the tables in that order. `lib/data/store.test.ts` has the "is seeded with …, and nothing else" test. Task 1 adds one to `STORE_VERSION` and two tables.
4. **The rows** (D to G Task 1). `lib/data/rows.ts` imports its types from `@/lib/types` in one `import type { … }` block; E's `ConversationRow` (`listingId`, `listingTitle`, `sellerSlug`, `buyerId`, `sellerGone`, `status`, `createdAt`, `lastMessageAt`, `firstReplyAt`, `completedAt`, `confirmedAt`, `confirmedBy`) and `NotificationRow` (`id`, `accountId`, `kind`, `subjectId`, `text`, `href`, `createdAt`, `readAt`); G's optional fields on `ReportRow` (`outcome`, `note`, `closedAt`, `closedBy`) and F's `ListingRow` (`hiddenReason`, `hiddenAt`). Task 1 adds two optional fields the same way.
5. **Types** (E, F and G Task 1). `lib/types.ts`: E's `ConversationStatus` (`"asked" | "replied" | "done" | "confirmed"`), G's `NotificationKind` (E's four plus `"shop-update"` and `"booking"`), G's `AuditAction` (ending `"check-in-added"`) and `AuditTargetKind` (`"shop" | "listing" | "report" | "pickup-point" | "post" | "booking"`), part B's `LookingForRequest` and `RequestStatus`, E's `ConversationSummary` (with `listingTitle`) and `Thread` (with `listingTitle` and `listing`). Tasks 1 and 4 add to them.
6. **E's conversations** (E Tasks 4 and 5; the code as built wins). `lib/data/messages.ts` has the private `shopOwnerId`, `sideOf`, `otherSideThere`, `messagesOf`, `settle` (async), `buyerName`, `shopOf`, `otherName(row, side, shopName)`, `addMessage(row, from, body, swapOffer, now)`, `tellOtherSide(row, from, now)` (which works out "asked" or "replied" from the status) and `findRow(buyerId, target)`; it exports `findConversation`, `startConversation`, `SendResult` (`"sent" | "not-found" | "closed"`), `sendMessage`, `markCompleted` (needs `"replied"`), `getInbox`, `getThread`, `forgetAccountInMessaging` and `exportConversations(accountId, now)`. E's amendment 3 was changing this file while this plan was written: Task 4 edits by meaning.
7. **E's notifications and reports.** `lib/data/notifications.ts` has the private `add(…)` and `ofAccount`, and exports `notify`, `notifyAboutMessage`, `markConversationNotificationsRead`, `markSaleNotificationsRead` and `deleteNotifications({ accountId, subjectIds })`. `lib/data/reports.ts` exports `createReport`.
8. **E's messaging library.** `lib/messaging/rules.ts`: `MESSAGE_MAX`, `DAY_MS`, `KEEP_MAX`, `cleanText`, `characterCount`, `firstLine`, `checkMessage`, `keepTyped`, `TextCheck` and the private `STATUS_LABELS` (a `Record<ConversationStatus, string>`). `lib/messaging/paths.ts`: `isId`, `threadPath`, `sentNoteKey`, and `backPathFor` with G Task 15's `ACCOUNT_ONLY`, `HUB_EDIT` and `HUB_BOOK`. `lib/messaging/errors.ts`: `messagingErrors(codes, fieldIds)` with `"message-missing"` and `"message-length"` on the field `body`. `lib/messaging/scam-check.ts`: `scamWarnings`, `parseWarnings`, `ScamWarning`, `SAFETY_TIPS`. `lib/messaging/form-state.ts`: `clearOwnFormState(form)` and `takeSentNote`. `lib/messaging/notification-text.ts`: `messageNoteText({ sender, listingTitle, first })`. `lib/messaging/subjects.ts`: `shopSlugOf(account)`. `lib/messaging/actions.ts`: `sendReply` (with G Task 17's badge line after `if (result === "not-found") back("/messages");`).
9. **E's pages** (E Tasks 7 to 12; not built when this plan was written). `components/messages/`:
   - `SessionLinks.tsx` (`MessageSellerLink`, `ReportLink`), `ViewerLinks.tsx` and `tests/helpers/viewer-links.tsx` (`signedOutViewerLinks`); `components/looking-for/RequestView.tsx` renders `ReportLink` for "Report this request" and keeps `const signIn = signInHref(\`/looking-for/${request.id}\`)` for Offer to help (E's amendment 2).
   - `MessageField.tsx` (props `id`, `name`, `label`, `hint`, `defaultValue`, `error`, `rows`, `required?`), `SafetyTips.tsx` (no props; its heading id `composer-tips-title`), `ScamCheck.tsx` (`warnings`, `idPrefix`), `MessageSummary.tsx` (`listing`, `listingTitle`, `shop`, `campusName`, `children?`), `ComposerSkeleton.tsx`.
   - `StatusPill.tsx` (`status`); `InboxView.tsx` whose private `InboxRow` destructures `listingTitle` and renders `{listingTitle ?? "A question for the shop"}` in `.inbox-about`.
   - `ThreadView.tsx` (`ThreadView({ thread, now, reply, sent, campusName })`, the `<MessageSummary …><StatusPill …/></MessageSummary>` card, the `{sent && (<p role="status" className="form-notice">Sent. Sellers usually reply within a day.</p>)}` note, and `{thread.otherPresent ? <ReplyFormView …/> : <p className="form-notice">The other person has left Vossie…</p>}`); `SaleActions.tsx` returns null for any status it doesn't name; `OpenThread.tsx`.
   - `NotificationsView.tsx`'s `KindIcon` with a `switch` over G's six kinds (G Task 18 added `"shop-update"` with `ShieldIcon` and `"booking"` with `ClockIcon`).
   Tasks 1, 13 and 14 edit these by meaning.
10. **E's and G's account page and privacy** (D Tasks 10 and 11, E Tasks 13 and 14, F Tasks 14 and 15, G Tasks 18 and 19). `components/account/AccountView.tsx`'s `account-rows` list: E's Messages and Notifications rows, then Saved, then F's `SellingRow`, G's staff rows, then Privacy settings. `components/account/PrivacySettingsView.tsx`'s "Download your data" and "Delete your account" sentences as E, F and G left them. `app/privacy/page.tsx`: the `privacy-today` section's `<h3>Three things kept only in your browser</h3>` list (`vossie_recently_viewed`, `vossie_recent_searches`, `vossie_low_data`); the `privacy-sign-in` bullets (E's messages bullet starts `<strong>Your messages, swap offers and reports.</strong>`); the `privacy-keep` bullets on how long the browser keeps things and what deleting an account removes. `app/privacy/page.test.tsx` checks the "Three things kept only in your browser" heading's codes. Task 19 edits all of these by meaning.
11. **Robots.** `app/robots.ts`'s `DISALLOWED` has E's `/messages`, `/notifications`, `/report`, `/listings/*/message`, `/sellers/*/message` and G's `/hub/*/book`. Task 19 adds to it.
12. **F's data** (F Tasks 4 and 5, G Task 4). `lib/data/tags.ts` exports `LISTINGS_TAG`, `SELLERS_TAG`, `tagListings`, `tagSellers`, `listingsChanged`, `sellersChanged` and G's `hubChanged` and `pickupPointsChanged`. `lib/data/catalog.ts` exports `shopStatus`, `toSeller`, `storefrontRow` and `listedListings`. `lib/data/shops.ts` has the private `moveShop(from, to)` whose loops end with E's `reports`. `lib/data/shop-stats.ts`'s private `counts(rows, enquiriesSince, salesSince, now)` starts `const enquiries = rows.filter((row) => row.listingId !== null && Date.parse(row.createdAt) >= enquiriesSince);`, used by `shopStats` and G's `recentCounts`. `lib/data/index.ts`'s `getSellerListings(slug)` returns the shop's listed listings, newest first.
13. **F's actions and pages** (F Tasks 7 to 14). `lib/selling/action-helpers.ts` exports `field(formData, name)` and `done(path)`. `lib/selling/listing-actions.ts`'s `saveListingForm` ends with `listingsChanged();`, the `let notice = "published";` lines and `done(myListingsPath(tabFor(saved.state)));`, with `owner` (a `ShopOwner`: `account`, `shop`, `status`), `existing` and `saved`. `components/seller/SellerHero.tsx` has the `seller-hero-actions` div holding `MessageSellerLink` and `ShareButton`; F Task 14's `ViewerMessageLink` shows the owner **Edit shop** there. `components/sell/Dashboard.tsx` takes `{ shop, paused, stats, badgeLine, notice, hubPause }` (G Task 18) and has the `sell-status` paragraph; `components/sell/SellHome.tsx` returns `<Dashboard … hubPause={…} />`. Tasks 9 and 19 edit them.
14. **G's reports and admin actions** (G Tasks 4, 5, 10 and 12). `lib/data/staff-reports.ts`'s private `toView` has `const exists = row.targetKind === "request" || …;` and `can: { hide: open && Boolean(listing) && !listing?.hiddenAt, pause: … }`; `lib/data/staff-reports.test.ts` expects `request.can` to equal `{ hide: false, pause: false }`. `lib/staff/admin-actions.ts` has the private `idFrom`, `staffOf`, `nothingChanged`, `tellReporter` and `backWithReason`, and exports `hideReportedListing`. `lib/staff/notices.ts` has the `NOTICES` map ending with the students' four; `lib/staff/audit-words.ts` has the `ACTIONS` record; `lib/staff/form-state.ts` exports `hideForm(id)`, `clearStaffForm` and `leaveNotice`; `lib/staff/rules.ts` exports `checkReason`. `components/staff/ReportConfirm.tsx` has the `kind === "hide" && report.can.hide` branch; `components/staff/AdminReport.tsx` has the sentence "This report is about a Looking For request, something that has gone, or a shop the Hub can&apos;t pause, so it can only be dismissed."; its test "offers only Dismiss for a report about a request, and says why". `app/admin/reports/[id]/hide/page.tsx`'s `generateMetadata` returns `staffMetadata("admin", "Hide a listing")`. Task 10 edits all of these.
15. **D's forms and session.** `lib/auth/session.ts` (`getViewer`, `requireAccount(nextPath)`, `getSessionKey`), `lib/auth/form-state.ts` (`readFormState(form)`, `writeFormState(form, state, now)`), `lib/auth/messages.ts` (`FormError`, `errorFor`), `components/forms/ErrorSummary.tsx` (`id`, `errors`), `FieldError.tsx` (`FieldError`, `describedBy`), `CampusSelect.tsx` (`id`, `defaultValue`, `campuses`, `invalid`, `describedBy`; posts as `campus`), and `components/forms/summary-ids.test.tsx`, which renders every form with a summary showing and lists their ids in order. The CSS classes `.form-stack`, `.form-field`, `.form-label`, `.form-hint`, `.form-input`, `.form-select`, `.form-check`, `.form-checkbox`, `.form-error`, `.form-summary`, `.form-notice`, `.form-submit`, `.link-button`, `.btn-danger`.
16. **Accounts data and D's actions** (D, E, F and G). `lib/data/accounts.ts`'s `deleteAccountData` runs E's `await forgetAccountInMessaging(…)` and `await deleteReportsBy(accountId);`, then F's `await forgetShopOf(accountId);`, then G's `await forgetAccountInStaffTools(accountId);`; `AccountExport` and `exportAccountData` end with G's `hubRsvps` and `slotRequests`. `lib/data/accounts.test.ts` checks the export's keys. `lib/auth/actions.ts`'s `deleteAccount` has F's `if (account.seller) sellersChanged();` and G's `hubChanged();` after `await deleteAccountData(account.id);`. Task 6 and Task 7 edit them.
17. **Test helpers.** `tests/helpers/next-request.ts` (`FakeRequest` with `refreshed` and `updatedTags`, `nextCache` with `refresh` and `updateTag`); `tests/helpers/staff.ts` (G Task 9: `STAFF_NOW`, `signedInAs(request, accountId)`, `form(fields)`); `tests/helpers/fakes.ts` (E's `makeThread`, `makeSummary`); `vitest.setup.ts` mocks `next/cache` (F Task 4).
18. **Part B and the shopping pages.** `data/fixtures/requests.ts` has 16 requests (`r-001` to `r-016`; `r-015` and `r-016` closed; r-001 has 2 offers). `app/looking-for/page.tsx` and `components/looking-for/RequestBoard.tsx` each link **Post a request** to `signInHref("/looking-for")`; `components/home/LookingFor.tsx` links it to `/looking-for` with the default prefetch. `app/saved/page.tsx` has the `saved-note` paragraph and `<Suspense fallback={<SavedSkeleton />}><SavedList /></Suspense>`. `components/ui/LinkTabs.tsx` (`label`, `tabs`, `current`, `look`). `lib/format.ts` has `budgetLabel`, `offersLabel`, `offersSoFarLabel`, `listingsLabel` and `dayMonth`; `lib/time.ts` has `sastDate`, `longSastDate` and `shortSastDate`.
19. **The boot script.** `lib/boot-script.ts` exports `BOOT_SCRIPT` (an IIFE string) and `INSTALL_PROMPT_EVENT`; `app/layout.tsx` renders `<script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />`. Task 21 changes the first.
20. **End-to-end** (E Task 15, F Task 16, G Task 20). `tests/e2e/helpers/messaging.ts` exports `project`, `onlyAt`, `main`, `field`, `button`, `newBuyer`, `signUpHere`, `signUp`, `signInAsSample`, `sellerPage`, `reply`, `bubble` and `statusPill`; `tests/e2e/helpers/selling.ts` exports `uniqueWord`, `publishListing` and `notFoundHeading`; `tests/e2e/helpers/staff.ts` exports `signedInPage(browser, baseURL, label, next)`. `playwright.config.ts` has `SELLING_WRITES`, `DEVICE_PROJECTS`, **(G, not yet planned when checked)** `STAFF_WRITES`, `testIgnore: [SELLING_WRITES, STAFF_WRITES]` on the five device projects, and the `selling-writes` and `staff-writes` projects. Task 22 adds a project after them.
21. **The size, axe and layout shift tests.** `tests/e2e/performance.spec.ts` (`PAGES` rows `[name, path, saved?]` and the signed-in measures D to G added); `tests/e2e/cls.spec.ts` (`PAGES` rows with a fourth value, `signedIn`); `tests/e2e/a11y.spec.ts` (`seriousIssues(page)` and its own `signInAsSample(page, label)`); `tests/e2e/community.spec.ts`'s checks of the Post a request and Offer to help links. Tasks 15, 16, 17, 18 and 23 change them.
22. **Icons.** `components/icons.tsx` has `MessageIcon` (E), `FlagIcon`, `ShieldIcon`, `ClockIcon` and `PlusSquareIcon`. This plan adds none.
23. **G's names this plan uses from G's later tasks, which were the last written and are the likeliest to change in G's review or build (G, not yet planned when this plan started):** the ACCOUNT_ONLY list in `backPathFor` (G Task 15); `sendReply`'s badge line (G Task 17); `KindIcon`'s six cases, the staff rows in `AccountView` and `Dashboard`'s `hubPause` (G Task 18); the privacy page's wording (G Task 19); `STAFF_WRITES`, the `staff-writes` project and `tests/e2e/helpers/staff.ts`'s `signedInPage` (G Task 20); `tests/e2e/staff-checks.spec.ts` (G Task 21); the decisions log's last row number (G's docs task). Check each against the code; where one differs, edit this plan's step by meaning and say so in the hand-over.
24. **Class names.** `grep -n "\.request-form\|\.requests-\|\.offer-\|\.seller-follow\|\.saved-shop\|\.saved-skeleton-tabs" app/globals.css` prints nothing.

## Where things stand (checked against the code on 2026-10-14)

| Area | Fact |
|---|---|
| Repo | `main`, with stage E's Tasks 1 to 6 committed and E Task 7 (the session links) in the working tree; F has a plan and no code; G's plan was being written (all 22 tasks by the end). Decision 67 records this stage's spec. `.claude/launch.json` is modified outside this work |
| JS | First visit at 390px, brotli quality 5, at E's start (`f7e1bee`): `/` 150,614 B, browse 151,361 B, listing 151,770 B, storefront 151,374 B, request 151,090 B. Stop line 152,305 B (decision 52), limit 153,600 B. The listing page is the highest, 535 B under the stop line. E's links, F's owner links and G's changes come before this plan; take G's final figures as the start |
| Requests | `lib/data/index.ts` reads `data/fixtures/requests.ts` (16 requests, `offers` a fixed number, no asker) in `getRequests`, `getOpenRequests`, `getRequest` and `getRequestIds`, each `"use cache"` with no tag. The board, the homepage's band, the request page, the sitemap and E's `reportSubject` call them |
| Request page | `app/looking-for/[id]/page.tsx` prerenders every id from `getRequestIds()`, awaits `params` inside `<Suspense fallback={null}>` and calls `notFound()` for an unknown one. `RequestView`'s `request-offers` section shows `offersSoFarLabel(request.offers)` and **Offer to help** (`signInHref(\`/looking-for/${id}\`)`), or "This request is closed" |
| Board and homepage | **Post a request** goes to `/login?next=%2Flooking-for` on the board (head and empty state), and to `/looking-for` (default prefetch) on the homepage's band. `community.spec.ts` checks both board links and the request page's Offer to help |
| Storefront | `SellerHero` (Server Component): photo, name, tagline, stamps, then `seller-hero-actions` with `MessageSellerLink` (E) and `ShareButton` (client, already on the page). Prerendered from `getSellerSlugs()` |
| Saved | `app/saved/page.tsx`: the h1 and the device note are prerendered; `SavedList` (the saved cookie) streams in behind `SavedSkeleton`. `SavedList` holds the client `RefreshWhenStale` and the hearts |
| E's conversations | A conversation belongs to a shop (`sellerSlug`); `buyerId` is the other side. `findRow` matches a buyer's thread about a listing, or a question (`listingId === null`) to a shop. `tellOtherSide` names the buyer by first name. F's `counts` call any conversation with a `listingId` an enquiry |
| G's reports | `toView` says a request report `exists` always and `can.hide` only for listings; `hideReportedListing` is the only hide action; G decision 5: "a report about … a Looking For request can only be dismissed" |
| Boot script | `lib/boot-script.ts`'s `BOOT_SCRIPT`, inline in `<head>` on every page: data saver and the install prompt. About 640 characters |
| Privacy guard | `app/privacy/page.test.tsx` fails when a `"vossie_…"` name in `app`, `components`, `hooks` or `lib` isn't on the privacy page. This plan adds `vossie_offline` (Task 20 names it in `lib/offline.ts`; Task 19 puts it on the page) |
| Next 16.4 | A route handler with Cache Components is prerendered at build unless it reads request data or awaits `connection()` (`01-getting-started/15-route-handlers.md`); a folder named `sw.js` under `app/` serves `/sw.js`. `updateTag` works only in Server Actions and expires every prerendered page that read the tag (F's reading) |
| e2e | One `next start` on 3200, five device projects, then F's `selling-writes` and G's `staff-writes`. `community.spec.ts` counts 14 open requests on the board and 2 at Midrand, and `LookingForRequests.test.tsx` expects the homepage's first three to be `r-001`, `r-003`, `r-002`. Every test shares one sample store |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. In this plan, "plan decision N" means this list; "spec 2.N" means the spec's decisions; "D decision N" to "G decision N" mean those plans' lists; "decision N" on its own means a row in the decisions log.

1. **Requests read like F's listings** (spec 2.1). `lib/data/requests.ts` turns `RequestRow`s into part B's `LookingForRequest` and decides what shows where: the board and the homepage list *open* requests that aren't hidden; a request has a *page* (and a sitemap entry) unless it's hidden. The four cached functions in `index.ts` keep their signatures and are tagged `requests`. The 16 fixtures stay the seed through `data/fixtures/request-rows.ts` (types only from `lib`), so part B's tests keep passing with a `resetSampleStore()`. A new id is `r-` and a UUID; its page renders on first request (F decision 8, and its restart quirk).
2. **Ids unique per page** (spec 2.2 named `request-form-summary` and `offer-summary`). Next keeps earlier pages hidden in the DOM, so the new form and an edit form, or two edit forms, can be there together. Every id on the request form starts `request-new` or `request-<id>` (its summary `request-new-summary` or `request-r-001-summary`), and on the offer composer `offer-<id>` (`offer-r-001-summary`), as F's `edit-<id>-` fields do. Each form joins `components/forms/summary-ids.test.tsx`.
3. **No contact details** (spec 2.4). After ISBNs are taken out, a title or details are refused when they hold an email address (`name@domain.tld`) or a phone number: a run of digits, spaces, dots, dashes and brackets holding 10 digits that start with 0, or 11 that start with 27 (`+27 82 …`). ISBNs taken out first: anything after "ISBN", a 13-digit number starting 978 or 979 (with or without dashes or spaces), and a dashed ISBN-10 in four groups whose check digit is right. So "0821234567", "082 123 4567", "+27 82 123 4567" and "sipho@gmail.com" are refused; "ISBN 0-306-40615-2", "978-0-306-40615-7", "R300 by 2026-10-16" and "1 200" pass. Words for numbers ("zero eight two…") get through: reports and the scam check cover that.
4. **"A day" is the last 24 hours**, as E's 10 reports a day. The daily limits (5 new requests an account, 20 offers a shop) count rows that still exist: deleting a request gives its slot back, which is fine, because deleting also takes it off the board. The open limit counts open requests that aren't hidden; Reopen counts towards it (spec 2.6).
5. **The request form's fields** (spec 2.3). Budget is whole rand from R1 to R100,000, read like F's price ("R1 200", "1,200" and "300" are fine; empty is "Open to offers"). Needed by is a native date field (it works without JavaScript; a browser without one shows a text box, and the hint gives the format), with `min` and `max` from today in SAST; the server checks it again. The campus starts on the account's campus. The title and details are cleaned with E's `cleanText`; the title is one line (runs of white space become one space).
6. **Edit, Close, Reopen and Delete** (spec 2.6). Edit only while open: the edit page of a closed request says "This request is closed. Reopen it to change it." with Reopen, and a hidden one "The Hub hid this request, so it can't be changed." Close and Reopen are one form button each, posting where they came from (the request page or Your requests, a `from` field the action checks). Delete's confirm page leads back to the request's page, or to Your requests for a hidden one (its page 404s). A hidden request can't be closed, reopened or edited; it can be deleted.
7. **Status lines** (spec section 4). After each action the page it lands on says what happened, once: the action leaves a code in D's form state (`request-note:<id>` for the request page, `your-requests` for Your requests, `follow:<slug>` for the storefront, `saved-shops` for Saved), and the page takes it (reads and clears it) as it renders, like E's "Sent." note (E decision 7). The words live in `lib/looking-for/words.ts` and `lib/following/rules.ts`.
8. **Offer threads in E's pages** (spec 2.7). The inbox's about line is "Your request: {title}" for the asker and "Request: {title}" for the shop. The thread's card is the request (linked while its page is up, "This request was removed." once it isn't) with the pointed-to listing, if any, under it as E's summary. The pill says "Offered" until the asker replies. The shop's reply form is replaced by "You can write again when they reply." (spec 2.9). After Send offer, the thread's note is "Sent. The student who asked gets a notification." (E's words, "Sellers usually reply within a day.", would be wrong for the shop).
9. **The unnamed asker** (spec 2.10). Until the asker writes in that thread, the shop's inbox, thread, messages and data export call them "The student who asked"; then their first name, as E names any buyer. The asker's own notifications name the shop (a business).
10. **The offers count** (spec 2.11) is the request's offer threads, whatever their state (a thread whose shop has left still counts), plus `seedOffers`. Sending an offer and deleting an account call `requestsChanged()`, so the board, the homepage and the request page show the new count on the next request. The asker's panel counts live.
11. **Offers out of the reply rate** (spec 2.12). F's `counts` leaves out conversations with a `requestId` from enquiries (and so from the reply rate, the dashboard and G's mentor numbers); sales still count. E's `findRow` skips offer threads, so a shop question or a listing enquiry never lands in one. `markCompleted` already needs Replied, which an offer thread reaches only when the asker writes.
12. **Who can offer** (spec 2.8). An account whose seller profile is approved with a storefront. The composer page says why anyone else can't: no shop (the spec's sentence and **Start selling**), a shop waiting for approval ("Your shop can make offers once the Hub approves it."), a paused shop ("Your shop is paused, so it can't make offers right now."), your own request, an offer already made ("You've offered already", with **Open the conversation**), a closed request, or one of the 16 sample requests, which have no asker to answer (spec 2.11): "This is one of Vossie's sample requests, so it can't take offers." A post that arrives anyway goes back to the page, which says why.
13. **Point to one of your listings** (spec 2.9) lists the shop's listed listings (available, in an approved shop, not hidden), "None" first. A posted id that isn't one of them is ignored.
14. **Notification kinds and words** (spec 2.13, 2.14 and 2.19). Three kinds join G's six: `offer` (E's speech bubble), `request-update` (the flag) and `new-listing` (the plus-square). "Tech corner offered to help with Accounting 1 tutor this week" links to the thread; "The Hub hid your request {title}. See why in Your requests." links to `/account/requests`; "Tech corner listed {title}" links to the listing, and later the same SAST day, while unread, "Tech corner listed 2 new things", linking to the storefront. Replies in an offer thread use E's sentences with the request's title ("Thandi replied about Accounting 1 tutor this week").
15. **New-listing notifications** (spec 2.19) come from F's `saveListingForm` when a listing is published for the first time (a new one, or a draft published) by an approved shop, not a paused one, and the listing isn't hidden. One per shop per follower per SAST day: `NotificationRow` gains an optional `count`; a read one that day means no more that day. A shop changing its link moves its follows and these notifications with it (F's `moveShop`).
16. **Follow in the storefront's band** (spec 2.16). It's its own 44px row under Message seller and Share, at every size, inside a `seller-follow` box that's always there: the signed-out link, Follow, "You follow this shop" with **Unfollow**, or, for the owner, nothing (F's Edit shop is in the Message slot). The box keeps its height and, from the tablet step, the actions keep a fixed width, so nothing moves when the session's part streams in. After a follow the row says "You follow Tech corner." as a status; after an unfollow, "Unfollowed." beside Follow. 200 follows at most: "You follow 200 shops. Unfollow one first."
17. **Saved's tabs** (spec 2.17). The h1 is the static shell; the tabs, the note and the list stream in together behind one skeleton (the tabs' row, the note and the cards), since the tab comes from `searchParams`. The tabs are E's-style links (`LinkTabs`, `look="tabs"`, named "What's saved"), `aria-current="page"` on the open one; anything but `?tab=shops` is Listings. Shops shows the Hub's small seller card (round photo, name, campus, "Paused"), the number listed ("Nothing listed right now" at 0) and **Unfollow {shop}**; signed out, the spec's sentence and a sign-in link back to the tab; none yet, "No shops yet. Follow a shop from its page and it shows here." with **Browse**.
18. **Your requests** (spec 2.13) lists open requests, then closed, then hidden, each newest first: the title (linked unless hidden), "Open", "Closed" or "Hidden by the Hub", the offers count, the date posted, the Hub's reason for a hidden one, and the actions its state allows. **Post a request** sits at the top; the empty state says "You haven't asked for anything yet."
19. **The asker's panel** (spec 2.13) replaces the public offers panel for the asker only, so the shell keeps the public panel and only the asker's page moves when theirs streams in (the layout shift tests run signed out). It shows "Your request", the count, each offer newest first (the shop, the offer's first line and its time in SAST, linking to the thread), the status line, and the actions.
20. **Hide the request** (spec 2.14) uses G's confirm page and queue: G's `ReportView.can.hide` becomes true for an open report about a request that's there and not hidden, and a new action, `hideReportedRequest`, does what `hideReportedListing` does for a listing. The audit entry is "Hid a request" (`request-hidden`, filed under Reports, target kind `request`); the notice is "Hidden. The asker and everyone who reported it have been told." `hideReportedListing` now refuses anything but a listing report. G decision 5's "a report about a request can only be dismissed" no longer holds; the docs task says so.
21. **Deleting an account** (spec 2.23) removes its requests (and their `request-update` notifications), its follows, the follows of every shop it owns and its followers' `new-listing` notifications about those shops, before F's `forgetShopOf` removes the shop. Its offer threads follow E's rules: the shop keeps its own messages, with "Deleted account" and no reply form. **The data export** gains `requests` (title, category and campus by name, details, budget, swap, needed by, state, the Hub's reason, when posted and closed, and the count of offers) and `following` (the shops' names, newest first). No ids.
22. **The sign-in page's back link** (E decision 4): `/looking-for/new` goes back to the board; a request's offer, edit and delete pages go back to the request; `/account/requests` has none (E's `ACCOUNT_ONLY`).
23. **Robots and search engines.** `robots.txt` gains `/looking-for/new`, `/looking-for/*/offer`, `/looking-for/*/edit`, `/looking-for/*/delete` and `/offline`; every new page is `noindex`, and `/offline` also sends `X-Robots-Tag: noindex`.
24. **The new dynamic routes export `generateStaticParams` with `r-001`** (CLAUDE.md), so the build checks their request-time parts sit inside `<Suspense>`; r-001 has no asker, so its edit and delete pages are the 404 for everyone.
25. **The offline page and the worker** (spec 2.20 to 2.22). `lib/offline.ts` holds the page's HTML, the worker's source and the names (`OFFLINE_CACHE = "vossie_offline"`, `OFFLINE_PATH = "/offline"`, `WORKER_VERSION`). `/offline` is prerendered (it has no request data); `/sw.js` awaits `connection()` so it's sent per request with exactly the `Cache-Control: no-cache` the handler sets. The worker answers only GET requests whose `mode` is `navigate` on this site; it enables navigation preload; it caches nothing but `/offline`. The kill switch is `WORKER_ON = false` in `lib/offline.ts`: the same address then serves a worker that deletes `vossie_offline` and unregisters itself. The registration is `if("serviceWorker"in navigator)addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})});` (131 characters; a refused registration is caught), joined to the boot script only when `process.env.NODE_ENV === "production"`.
26. **Wording the spec doesn't give** (Lama may change it):
    - the request form's hints and errors, and the composer's notes (`lib/looking-for/errors.ts`, the views in `components/looking-for/`);
    - the status lines and the notification sentences (`lib/looking-for/words.ts`, `lib/following/rules.ts`);
    - Your requests' and Saved's Shops empty states, the delete page's lines, the dashboard's followers line ("12 people follow your shop", "1 person follows your shop", "No one follows your shop yet");
    - the offline page's words beyond the spec's, and the privacy policy's and privacy settings' new sentences (Task 19).
27. **End to end** (spec section 6). Tests that only read, or write nothing anyone else counts (the composer's notes for a student without a shop, the form's errors, the contact-details refusal), run in the five device projects. Tests that post requests, offer, hide or publish run in a new project, `community-writes`, after every other project: new requests change the board's and the homepage's counts, and new listings change browse's. Each test signs up its own students, posts its own requests, and finds them by a word no other test uses; the offering and publishing shop is the sample "Seller, Tech corner", acting only on the test's own request and listings. The offline test runs in the device projects at 390px only, in its own browser context with service workers allowed; every other test blocks them (`serviceWorkers: "block"`).

## Amendments on review

The controller adds amendments here; they override the tasks below wherever they differ.

1. **A first publish is decided once, by stage F** (selling plan amendment 9.2, controller, 2026-10-15). `ListingRow` has `firstPublishedAt`, and `lib/data/own-listings.ts` exports `isFirstPublish(before, state)`. Wherever this plan computes `firstPublish` in `saveListingForm` (as `saved.state !== "draft" && (!existing || existing.state === "draft")`), use `isFirstPublish(existing, saved.state)` instead, with `existing` the row read before the save. Otherwise a listing published, saved back as a draft and published again would notify every follower twice. Add a test: publish, draft, publish again sends one new-listing notification.
2. **Also from stage F's amendments 8 and 9:** `AccountExport` ends `…, shop, listings, onboardingDraft` (this plan's `requests` and `following` go after it, and its key-order test says so); `getPhoto(id, now)` takes a required `now`; `/photos/[id]` is `private`; `shopStats` skips `sellerGone` conversations, and so should any count this plan adds (offer threads included); prices are whole rand ("R250,00" is 250) and shop names compare in any alphabet. Read the selling plan's amendments 8 and 9 before Task 1.
3. **A new request is made once, however many times its form is sent** (selling plan amendment 14.1; staff tools amendment 15.7; plan review, Claude under decision 54, 2026-10-18).
   - **The form.** `RequestForm` (new request only) calls `issueOnceToken()` from `lib/staff/once.ts` after `connection()`, inside its `<Suspense>`. `RequestFormView` takes an `once: string | null` prop and renders `<input type="hidden" name="once" value={once}>` when `requestId` is null.
   - **The action.** In `saveMyRequest`, for a new request, after the field and limit checks pass and straight before `createRequest`, it calls `takeOnceToken(field(formData, "once"), now)`:
     - `"none"`: keep the typed values, write the error `form-expired` ("This form has expired. Check it and send it again.", no field), and `back(path)`.
     - `"again"`: `done(sent?.path ?? YOUR_REQUESTS_PATH)`, creating nothing.
     - `"first"`: create the request, then `leaveOnceToken(once, { path: requestPath(saved.id), notice: "posted" }, now)`.
   - **Tests.**
     - Two posts with one token make one request, and the second lands on the first one's page.
     - A missing or forged token is refused, with the typed values kept.
     - `actions.test.ts`'s new-request posts and `summary-ids.test.tsx` pass a token or `once={null}`.
     - The e2e `postRequest` helper needs no change.
4. **Every hand-made browser context blocks the worker.** Playwright 1.64's `use.serviceWorkers` reaches only the built-in `context` and `page` fixtures.
   - Task 21 also adds `serviceWorkers: "block"` to every `browser.newContext(…)` in `tests/e2e`. Start with the two helpers, `tests/e2e/helpers/messaging.ts` (`sellerPage`) and `helpers/staff.ts` (`signedInPage`); there were 11 calls on 2026-10-18.
   - Task 21's Step 7 and Task 24 check that `grep -rn "newContext(" tests/e2e | grep -v serviceWorkers` prints nothing.
   - `offline.spec.ts` stays the only place that allows the worker.
5. **The boot script stays out of the client bundle.** `lib/install.ts`, which is client code on every page, imports from `lib/boot-script.ts`.
   - Keep `BOOT_SCRIPT` a plain template literal: `` export const BOOT_SCRIPT = `(function(){${BOOT_BODY}${process.env.NODE_ENV === "production" && WORKER_ON ? WORKER_REGISTRATION : ""}})();` ``, with `WORKER_ON` from `lib/offline.ts`. `bootScript(withWorker)` stays an exported function declaration, for the tests only.
   - After `pnpm build`, `grep -l "serviceWorker.register" .next/static/chunks/*.js` must print nothing. If it prints a file, stop: that is the cut rule.
6. **The kill switch also stops registering, and the worker's version follows the page.**
   - The registration joins the boot script only when `WORKER_ON` is set (amendment 5). Devices that already have the worker get the off worker through the browser's own update check.
   - `workerSource` puts a short hash of `OFFLINE_PAGE` (a 32-bit FNV of its text, in hex) beside `WORKER_VERSION` in its first line. A test checks that changing the page changes `workerSource(true)`.
   - Task 21's Step 9 uses a throwaway Playwright context, never a personal Chrome profile, and never opens a production build on port 3100: a worker registered there would control Lama's dev pages.
7. **One offer per shop per request, even when it's sent twice at once.**
   - In `startOffer`, the find and the insert run with no `await` between them: use a private synchronous `offerRow(requestId, sellerSlug)` in place of `await findOffer(…)`. `findOffer` stays for the composer.
   - Test: `await Promise.all([offer(), offer()])` gives one thread with one message.
   - Task 24 adds to the go-live checklist that Supabase needs a unique index on the conversation's request and shop where the request is set.
8. **A hidden request shows as hidden on its reports** (staff tools rule, `bda34a5`).
   - In `toView`, when `requestRow?.hiddenAt` is set, set `unseen = "hidden"`.
   - `AdminReport`'s unseen sentence names the kind: "Students can't see this request: the Hub has hidden it." for a request, and the existing listing sentence otherwise.
   - Test both.
9. **Which offer counts skip a shop that has gone.**
   - The request's offers count (`offerThreadCount`, `offersForRequest`) keeps threads whose shop has gone, and the asker sees "A closed shop" (plan decision 10).
   - `countOffersSince` (the 20-a-day limit) skips rows with `sellerGone`.
   - Amendment 2's "offer threads included" means shop counts only.
   - Test: a thread with `sellerGone` doesn't count toward a shop's 20 a day.
10. **The JS ledger has a column for the new-listing form.** It starts at 152,287 B, 18 B under the stop line. Tasks 15 to 19, 21 and 24 fill it from `performance.spec.ts`'s signed-in "new listing form" row. The stop line is 152,305 B; the listing page is at 151,769 B.
11. **Built tests that list everything:**
    - **Task 6:** the export test destructures `requests, following` beside the other keys (its `rest` is compared with `toEqual`) and expects each to equal `[]`, as staff tools amendment 4 did.
    - **Task 7:** in `lib/auth/account-actions.test.ts`, `toEqual(["sellers", "hub"])` becomes `["sellers", "hub", "requests"]`, and `toEqual(["hub"])` becomes `["hub", "requests"]`; rename that test "…the Hub's and the board's tags…". `next/cache` is already mocked there.
    - **Task 19:** `AccountView.test.tsx`'s "links to messages, notifications, Saved, selling and privacy settings" gains `["Your requests", "/account/requests"]` after Saved.
    - **Tasks 11 and 13:** `summary-ids.test.tsx` has no `toHaveLength`. Append `"request-new-summary"`, `"request-r-001-summary"` and `"offer-r-001-summary"` to its `toEqual` list.
12. **The privacy page covers the new data everywhere** (Task 19, spec 2.23). In "What this site stores today", the list of what the server keeps in memory adds "your Looking For requests and the shops you follow". So does the "While Vossie is a preview…" bullet in "How long we keep it".
13. **Skeletons fit their pages** (Tasks 12 and 23).
    - The delete page gets its own skeleton, sized to its content, not `RequestFormSkeleton` (selling found a 240px footer jump on Delete listing).
    - `cls.spec.ts` gains signed-in rows for a request's delete and edit pages, using the asker's own request in `community-checks.spec.ts`.
14. **Saved's tab switch shows the skeleton.** Key Saved's `<Suspense>` by tab (`key={tab}`, passed from a small wrapper), so a client-side switch never shows the other tab's content while the new one loads.
15. **Odds and ends:**
    - **The offered pill:** add `.status-pill[data-status="offered"]` colours, navy on pale.
    - **A wrong task number:** the "Where things stand" privacy-guard row should say that Task 21, not Task 20, names `vossie_offline`.
    - **The storefront band:** Task 17's `.seller-hero-actions { width: 18rem }` stretches Message seller (`flex: 1`) on every storefront at tablet and desktop. Check it at 768 and 1440 against the owner's view. If it changes the look, give `.seller-follow` `width: 0; min-width: 100%` instead, so its words never widen the band.
    - **No new summary id:** the request variant of `ReportConfirm` reuses the `hide-<report>-summary` id, so `summary-ids.test.tsx` needs nothing new for it.
16. **Mechanical renames and quote fixes** (the review, against `0d396c6`; edit in place, no behaviour change):

    | Task / step | Plan says | Built code |
    |---|---|---|
    | Recheck 3; Task 1 Step 7.3 | `STORE_VERSION` "4 after G, so 5" | It's 6 now (`lib/data/store.ts`), so set it to **7** (or one more than it is when you start) |
    | Recheck 1; Tasks 1 and 24, Step 1 | `git status` shows only ` M .claude/launch.json` | It also shows ` M docs/PROGRESS.md`, ` M docs/reference/LANDING-DECISIONS.md` and three untracked 2026-10-15 docs: other sessions' work. Never stage them. Task 24 hands its PROGRESS section and decision row to the controller as snippet files, as stage F did |
    | Recheck 12; Task 5 Step 5 | `moveShop`'s loops "end with E's reports" | They end with G's `featuredPins` and `featuredDraws` loops (`lib/data/shops.ts`); add the follows loop after them |
    | Recheck 14; Task 10 Step 2.3 | Replace `hide: open && Boolean(listing) && !listing?.hiddenAt` in `can` | `toView` sets `canHide` in a `switch (row.targetKind)`. Change `case "request": canHide = false; // stage H` to `canHide = open && Boolean(requestRow) && !requestRow?.hiddenAt;` (`lib/data/staff-reports.ts`) |
    | Task 10 Step 4.2 | Insert before `if (kind === "hide" && report.can.hide) {` | The line is `if (kind === "hide" && report.can.hide && report.target.kind === "listing") {` (`ReportConfirm.tsx`) |
    | Task 10 Step 4 | `AdminReport`'s one-line sentence | The sentence spans two lines; edit by meaning |
    | Task 9 Step 1 (listing-actions test) | `saveListingForm(fanForm())`, `fanForm({ … })` | `fanForm` is async (it carries the token): `saveListingForm(await fanForm(…))`, after `signedInAs` |
    | Task 9 Step 4 (and amendment 1) | `firstPublish = saved.state !== "draft" && …` | `isFirstPublish(existing, saved.state)` (`lib/data/own-listings.ts`). Insert it after `listingsChanged();` in `listing-actions.ts` |
    | Task 14 Step 1 tests | `replyForm(null)` | `replyForm(null, offer.id)`: it takes `(state, conversationId)` |
    | Task 14 Step 4.5 | "The other person has left Vossie, so you can't reply." | Keep the built words: "This person has left Vossie, so you can't reply." (messaging amendment 3.9) |
    | Task 23 Step 2 (cls rows) | A fourth value of `true` | The fourth value is `signIn?: string`, the sample's button label: `"Student, Midrand"` |
    | Task 23 Step 3 (performance) | Declares a new `const SIGNED_IN_PAGES: [name, path][]` and loop | It already exists as `[name, path, account]` with a loop. Add rows with `"Student, Midrand"`; don't redeclare it |
    | Task 7 Step 5 | "If the file has no `vi.mock("next/cache")`, add one" | It has one; nothing to add |
    | Everywhere | Staff create forms | Since this plan was written, staff create forms carry a one-time token (`lib/staff/once.ts`), shop links reserve `export` (`RESERVED_SLUGS`), and `approveShop`/`declineShop` take the owner's id |
17. **The review of Tasks 1 to 5** (Claude, under decision 54, 2026-10-19). One fix task runs after Task 9 and before Task 10, test first.
    1. **The budget reads South African money right** (important). `parseBudget` uses `parsePrice` from `lib/selling/rules.ts`, so "R250,00" is 250, and "99,99" and "1,2" are invalid; then the 1 to `BUDGET_MAX` range check. Before this, every comma was stripped, so cents were read as rand and "R250,00" showed as R25,000 on the board.
    2. **The contact-details check catches joined numbers.** `holdsPhone` first takes dates out (`/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{2,4})\b/g`), then splits runs on `/[\s()./+-]+/`, so "082 123 4567-083 123 4567", "R300-0821234567", "Price 1.082 123 4567" and "082/123/4567" are refused, while "2026-10-01 - 2026-10-05", "01.10.2026 - 05.10.2026" and "R1 200 - R2 000" still pass.
       - `ISBN_LABEL` accepts "ISBN 10:" as well as "ISBN-10" (`/ISBN(?:[\s-]?1[03])?[\s:]*$/i`).
       - The refusal adds "If it's an ISBN, write ISBN before it."
    3. **The limits say what they count:** "You've posted 5 requests in the last 24 hours. Try again later." and the same for offers (plan decision 4; messaging amendment 3.7).
    4. **An offer thread shows the request's current title** while the request is up: `getThread` and the inbox use `request?.title ?? row.requestTitle`. The kept title is only for once the request has gone.
    5. **A shop that has gone is "A closed shop" in every offer thread:** the asker's panel, the inbox, the thread and the export. Other conversations keep "Deleted account". There is one `CLOSED_SHOP` constant.
    6. **A Hub-paused shop you follow shows on Saved, marked Paused,** with Unfollow and no storefront link (spec 2.17). Before this, it disappeared from Saved but still counted toward the 200. As built (`72eb71d`): `FollowedShop` has a required `storefront: boolean`, and Task 18's `FollowedShopsView` links a card to `/sellers/<slug>` only when it is true (its test helper sets `storefront: true`). Follow and Unfollow's status lines name the shop through `shopNameOf(slug)`.
    7. **Tidying up:**
       - The synchronous `offerRow` moves into `lib/data/offers.ts`; `startOffer`, `findOffer` and `offerThreadCount` use it.
       - `notify`'s comment names the new kinds.
    8. **Go-live (Task 24):** the 5 open requests, 5 new a day and 20 offers a day are counted with awaits before the write, so forms sent at the same moment can pass them. The real backend counts them in the database, beside amendment 7's unique index.

## Store design

The two tables, the fields added to earlier rows, and who touches them:

- **`requests`** (by id): `RequestRow`: the asker's account (null for the 16 samples, never shown), the title, category, campus, details, budget, swap, needed by, `open` or `closed`, when it was made, last changed and closed, `seedOffers` (the fixture's number; 0 for requests posted on Vossie), and `hiddenAt` and `hiddenReason` (G's names for a hidden listing). Seeded from `data/fixtures/request-rows.ts`. Only `lib/data/requests.ts` reads or writes it.
- **`follows`** (by id, `follow-<uuid>`): `FollowRow`: the account, the shop's slug and when. Only `lib/data/follows.ts`, and F's `moveShop`, which moves a shop's follows with its link.
- **Fields added to earlier rows, all optional** (absent means null, so E's seeds and every earlier test need no change): `ConversationRow` gains `requestId` and `requestTitle` (kept for when the request has gone, as `listingTitle` is); `NotificationRow` gains `count` (how many listings a `new-listing` notification is about).
- **Types:** `ConversationStatus` gains `"offered"`; `NotificationKind` gains `"offer"`, `"request-update"` and `"new-listing"`; G's `AuditAction` gains `"request-hidden"` and `AuditTargetKind` gains `"request"`.
- **Who reads what:** `lib/data/requests.ts` (requests and their offer counts), `lib/data/offers.ts` (offer threads, read-only), E's `lib/data/messages.ts` (`startOffer`, and the offer rules inside its reads and writes), `lib/data/follows.ts`, E's `lib/data/notifications.ts` (`notifyNewListing`, `deleteNotificationsAbout`), F's `shops.ts` (`moveShop`) and `shop-stats.ts` (`counts`), and G's `staff-reports.ts` (`toView`). `lib/data/accounts.ts` imports `forgetRequestsOf`, `exportRequests`, `forgetFollowsOf` and `exportFollowing`; none of these modules imports `accounts.ts`, so there's no cycle. `requests.ts` and `offers.ts` import nothing from `messages.ts`.

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec 5):** if any page passes **the stop line Lama last accepted (152,305 B when this plan was written; use the newer figure from "Recheck" item 2 if there is one)**, stop after that task and report the figures. Don't cut features to fit; that's Lama's decision. **Every existing page's first-visit JavaScript stays the same to the byte** (spec 5): if any figure moves, stop and find out why before going on.
- **Where bytes move:**
  - Tasks 1 to 14 add no client code. The new pages carry only the shell.
  - **Task 15 changes the request page** (a `<Suspense>` and a Server Component for the asker's panel). Task 15 measures every page.
  - **Task 16 changes the board and the homepage's band** (two links; the homepage is prefetched from every page's header). Task 16 measures every page.
  - **Task 17 changes the storefront's band** (a `<Suspense>`, a form and a link). Task 17 measures every page.
  - **Task 18 changes Saved** (the tabs, as links). Task 18 measures every page.
  - **Task 19 changes `/sell`'s dashboard and the account page** (Server Components; `/sell` is prefetched from every page's header, F decision 20). Task 19 measures every page.
  - **Task 21 adds the worker's registration to the inline boot script** (HTML, not a script file). **Accepted by Lama, 2026-10-14**, with the cut rule: if the statement costs 100 B or more brotli-compressed in a page's HTML, or moves any script figure, stop: the worker is cut (Task 21 isn't committed), and `/offline` goes back on the go-live checklist. Task 21 measures both.
- **Recording.** `tests/e2e/performance.spec.ts` prints each page's `scriptBrotli`. Tasks 15 to 19, 21 and 24 run it at 390px and put the figures in their commit messages; Task 23 adds Saved's Shops tab and the new pages, measured signed in; Task 21 adds the HTML measure of the registration.

**As built** (fill in during the build):

| Point | `/` | `/browse` | Listing | Storefront | Saved | Board | Request | `/sell` (signed out) | New listing form (signed in; amendment 10) |
|---|---|---|---|---|---|---|---|---|---|
| Start (G's final figures) | 150,613 | 151,360 | 151,769 | 151,373 | 151,248 | not measured at the start (Task 15 measures it) | 151,089 | 150,613 | 152,287 |
| Task 15, the asker's panel | 150,613 | 151,360 | 151,769 | 151,373 | 151,248 | 150,613 | 151,089 | 150,613 | 152,287 |
| Task 16, Post a request | | | | | | | | | |
| Task 17, Follow | | | | | | | | | |
| Task 18, Saved's tabs | | | | | | | | | |
| Task 19, the dashboard and the account page | | | | | | | | | |
| Task 21, the worker's registration | | | | | | | | | |
| **Final (Task 24)** | | | | | | | | | |

The worker's registration: accepted by Lama, 2026-10-14; its cost in a page's HTML ________ B brotli (cut at 100 B). New pages, signed in (Task 23): new request ________ B, Your requests ________ B, offer composer ________ B, Saved's Shops tab ________ B.

The stop line used: 152,305 B (decision 52). Unit tests at the start: 1,937. End to end at the start: 1,025 pass, 887 skipped.

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there.
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, and comments in plain English. There's no formatter: match the file you're in.
- **Server or client.** Server Components unless a file starts with `"use client"`. This plan adds **no** client component and changes none. Plain `lib/` modules have no directive. `lib/looking-for/actions.ts` and `lib/following/actions.ts` start with `"use server"`: everything they export must be an async function (types are fine; constants are not).
- **Next APIs.** Before using a Next API this plan names, read its page in `node_modules/next/dist/docs/01-app/` (AGENTS.md). This plan uses:
  - Server Actions in forms, `refresh()` and `redirect()`/`RedirectType`: `02-guides/server-actions.md`, `02-guides/forms.md`, `03-api-reference/04-functions/refresh.md`, `redirect.md`, `03-api-reference/01-directives/use-server.md`;
  - `cacheTag` and `updateTag`: `03-api-reference/04-functions/cacheTag.md`, `updateTag.md`;
  - `connection()`: `03-api-reference/04-functions/connection.md`;
  - `notFound()` after streaming has started: `03-api-reference/04-functions/not-found.md`;
  - dynamic routes and `generateStaticParams` with Cache Components: `03-api-reference/03-file-conventions/dynamic-routes.md`, `03-api-reference/04-functions/generate-static-params.md`;
  - route handlers: `03-api-reference/03-file-conventions/route.md`, `01-getting-started/15-route-handlers.md` ("With Cache Components");
  - the session behind `<Suspense>`: `02-guides/authentication-with-cache-components.md`;
  - kept pages: `02-guides/preserving-ui-state.md`.

  The first task that uses one says so in its first step.
- **Breakpoints.**
  - `wide:` is tablet and up; `desk:` is desktop. Never use `md:`, `lg:` or `sm:`.
  - In CSS, write `@media (min-width: 48rem) and (min-height: 30rem)` and `@media (min-width: 64rem) and (min-height: 30rem)`. Landscape phones are `@media (orientation: landscape) and (max-height: 29.99rem)`.
- **Page padding.** `.page` and the page's own class (`.request-form-page`, `.requests-page`; the offer composer uses E's `.composer-page`) sit on one element, so the page class's padding *replaces* `.page`'s gutter. Write the whole content edge: 16px on phones, 40px from the tablet step.
- **Effects.** None in this plan.
- **Headings.** One H1 per page. Sections are `<section aria-labelledby="…">` with one H2, visible or `sr-only`. Ids are unique across pages (`request-new-…`, `request-<id>-…`, `requests-…`, `offer-<id>-…`, `delete-<id>-…`, `saved-…`), because Next keeps earlier pages hidden in the DOM (plan decision 2).
- **Request-time parts.** Anything that reads cookies, headers, `params`, `searchParams` or the clock sits inside `<Suspense>`. Clock reads come after `await connection()` (decision 26). No `Date.now()`, `new Date()`, `Math.random()` or `crypto.random*` while prerendering: new ids are made only in Server Actions. There's no `try`/`catch` round JSX: the React Compiler lint rejects it.
- **Data functions** take `now` from their caller, never read the clock, and hand out copies (D's "Store design").
- **Server Actions.** Read every field with F's `field(formData, name)` (a missing field or a file is `""`). Never take identity from a field: the account comes from `requireAccount()`, a staff member from G's `requireStaff()`. Check every id from a field with E's `isId` and look it up in the store, among the account's own where it must be. Call `redirect()` and `notFound()` outside any `try`. Every write ends with F's `done(path)` (`refresh()`, then a `replace` redirect), after `requestsChanged()` when what buyers see changed; a post that fails its checks keeps its errors and typed values in form state and goes back with a `replace` redirect and no refresh (E's `back`).
- **Forms.** Plain `<form action={serverAction} noValidate>`: `noValidate` so the server's messages show rather than the browser's bubbles; fields keep `required` where they're required, so it's announced. Every field has a `<label>`; hints and errors join `aria-describedby`; an invalid field has `aria-invalid="true"`. Errors use D's `ErrorSummary` (with its own `id`, plan decision 2) and `FieldError`. **Every new form with an error summary joins `components/forms/summary-ids.test.tsx`** in the task that adds it.
- **User text.** Request titles and details, offers, shop names and the Hub's reasons are React text, never `dangerouslySetInnerHTML`. Line breaks in details show with `white-space: pre-line` (part B's `.request-details`).
- **Async components in tests.** jsdom can't render an async component inside a tree. Render `await Thing(props)` directly, or stand the async part in with `vi.mock`.
- **Server code in tests.** Use D's `tests/helpers/next-request.ts` for `next/headers`, `next/navigation`, `next/server` and `next/cache`, and G's `tests/helpers/staff.ts` for `signedInAs(request, accountId)`, `form(fields)` and `STAFF_NOW` (Wednesday 14 October 2026, 10:42 in SAST); call `resetSampleStore()` and `resetRequest(request)` in `beforeEach`. Fake only the date: `vi.useFakeTimers({ toFake: ["Date"] })`, then `vi.setSystemTime(…)`.
- **JSX text.** The `react/no-unescaped-entities` rule is on: write `&apos;` for an apostrophe inside JSX text (a string in an attribute, a prop or `{"…"}` is fine). JSX drops the space at a line break next to a tag, so end a text line with `{" "}` when the next line starts with a tag.
- **Links.** Pages on this site use `Link` from `next/link`, with `prefetch={false}` on every link this plan adds (CLAUDE.md, decision 53). A plain `<a href>` is for Try again on the offline page and other websites.
- **Accessible names.** Name computation trims each element's own text, so put spaces outside `sr-only` spans. Icons from `components/icons.tsx` are `aria-hidden`. A button or link that acts on one thing names it (spec 4): "Close <span className="sr-only">Accounting 1 tutor this week</span>", "Unfollow <span className="sr-only">Tech corner</span>".
- **Contrast.**
  - Sky never carries text, icons or thin borders on white. Links on white are sky-dark; on panel and pale they're navy.
  - On the storefront's stars, small text is white; Follow is a sky pill with navy text, Unfollow a white outline with white text (spec 4).
  - Danger red is 6.6:1 on white, and white on it is 6.6:1.
- **Motion.** Animate only `transform`/`opacity`. Hover effects only under `(hover: hover) and (pointer: fine)`. This plan adds no animation.
- **Tap targets.** At least 44 × 44px, with 8px between targets. Links inside a paragraph are exempt (WCAG 2.5.8).
- **Class names.** New classes start with `request-form`, `requests-`, `offer-`, `seller-follow`, `saved-tab`, `saved-shop` or `saved-skeleton-`. Before adding one, check it isn't taken: `grep -n "\.<name>\b" app/globals.css`.
- **CSS placement.**
  - New CSS goes at the end of `app/globals.css`, inside `@layer components`, under a banner: `/* --- Community actions: <name> (community actions plan, Task N, spec x) --- */`.
  - Never put `!important` on a transition or animation property: the motion off-switches rely on it.
- **Hidden pages in tests.** In e2e tests, find things with `getByRole`/`getByLabel` and `.filter({ visible: true })`; a CSS locator also counts the kept copies. `getByRole("alert")` also matches Next's route announcer: name it, `{ name: "There's a problem" }`.
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git status --short` on its own, and checks that only the listed files changed (and `.claude/launch.json`, which is never staged);
  2. runs `git add` with the listed files;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.
- **Looking at it.** Check visually on a production build (`pnpm build`, then `pnpm start --port 3201`) at 390 × 844, 768 × 1024 and 1280 × 800, using a throwaway Playwright script in your scratchpad. Stop the server afterwards (it's yours, not an install or build).
- **Measuring JS.** `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` builds, starts its own server on 3200, and prints one line per page, such as `listing page: {"script":…,"scriptBrotli":…}`. Record `scriptBrotli`, and compare every figure with the ledger's last row: any change at all on an existing page means stop and find out why (spec 5).

## File map (end of this plan)

New files are marked **+**, changed **~**.

```
app/
  looking-for/new/page.tsx  looking-for/[id]/edit/page.tsx      + the request form (Task 11)
  looking-for/[id]/delete/page.tsx  account/requests/page.tsx    + confirm delete, Your requests (Task 12)
  looking-for/[id]/offer/page.tsx                                + the offer composer (Task 13)
  looking-for/page.tsx                                           ~ Post a request (Task 16)
  saved/page.tsx                                                 ~ the tabs (Task 18)
  admin/reports/[id]/hide/page.tsx                               ~ its title (Task 10)
  privacy/page.tsx  page.test.tsx  robots.ts  robots.test.ts     ~ (Task 19)
  offline/route.ts  route.test.ts                                + (Task 20)
  sw.js/route.ts  route.test.ts                                  + (Task 21)
  globals.css                                                    ~ community actions banners (Tasks 11 to 15, 17 to 19)
components/
  looking-for/RequestFormView.tsx  RequestForm.tsx  RequestFormSkeleton.tsx  (+ tests)   + (Task 11)
  looking-for/RequestActions.tsx  DeleteRequestView.tsx  DeleteRequest.tsx  YourRequestsView.tsx  YourRequests.tsx  (+ tests)   + (Task 12)
  looking-for/OfferView.tsx  Offer.tsx  (+ tests)                + (Task 13)
  looking-for/OffersPanel.tsx  ViewerOffers.tsx  (+ tests)        + (Task 15)
  looking-for/RequestView.tsx  RequestView.test.tsx              ~ the panel (Task 15)
  looking-for/RequestBoard.tsx  RequestBoard.test.tsx            ~ Post a request (Task 16)
  home/LookingFor.tsx  LookingFor.test.tsx                       ~ Post a request (Task 16)
  messages/NotificationsView.tsx  NotificationsView.test.tsx     ~ three kinds (Task 1)
  messages/SafetyTips.tsx                                        ~ its id (Task 13)
  messages/InboxView.tsx  ThreadView.tsx  OfferAbout.tsx  (+ tests)   ~ / + offer threads (Task 14)
  seller/FollowControl.tsx  ViewerFollow.tsx  (+ tests)          + (Task 17)
  seller/SellerHero.tsx  SellerHero.test.tsx                     ~ Follow (Task 17)
  saved/SavedTabs.tsx  FollowedShops.tsx  FollowedShopsView.tsx  (+ tests)  SavedSkeleton.tsx   + / ~ (Task 18)
  account/AccountView.tsx  PrivacySettingsView.tsx  (+ tests)    ~ (Task 19)
  sell/Dashboard.tsx  SellHome.tsx  (+ tests)                    ~ followers (Task 19)
  staff/ReportConfirm.tsx  AdminReport.tsx  (+ tests)            ~ hide a request (Task 10)
  forms/summary-ids.test.tsx                                     ~ (Tasks 11 to 13)
lib/
  types.ts                                                       ~ (Tasks 1 and 4)
  messaging/rules.ts                                             ~ Offered (Task 1)
  messaging/paths.ts  paths.test.ts                              ~ back links (Task 15)
  staff/audit-words.ts  audit-words.test.ts                      ~ Hid a request (Task 1)
  looking-for/rules.ts  errors.ts  paths.ts  words.ts  (+ tests) + (Task 2)
  following/rules.ts  rules.test.ts                              + (Task 2)
  data/rows.ts  store.ts  store.test.ts                          ~ two tables (Task 1)
  data/tags.ts  requests.ts  requests.test.ts  index.ts  index.test.ts   ~ / + (Task 3)
  data/messages.ts  messages.test.ts  offers.ts  offers.test.ts  shop-stats.ts  shop-stats.test.ts   ~ / + (Task 4)
  data/notifications.ts  notifications.test.ts                   ~ deleteNotificationsAbout (Task 3), notifyNewListing (Task 5)
  data/follows.ts  follows.test.ts  shops.ts  shops.test.ts      + / ~ (Task 5)
  data/accounts.ts  accounts.test.ts                             ~ deletion and export (Task 6)
  looking-for/form-state.ts  actions.ts  actions.test.ts         + (Task 7)
  auth/actions.ts                                                ~ requestsChanged() (Task 7)
  looking-for/subjects.ts  subjects.test.ts                      + (Task 8); actions.ts ~ sendOffer (Task 8)
  following/actions.ts  actions.test.ts                          + (Task 9)
  selling/listing-actions.ts  listing-actions.test.ts            ~ tell followers (Task 9)
  data/staff-reports.ts  staff-reports.test.ts                   ~ (Task 10)
  staff/admin-actions.ts  admin-actions.test.ts  notices.ts      ~ (Task 10)
  offline.ts  offline.test.ts                                    + (Task 20); ~ the worker (Task 21)
  boot-script.ts  boot-script.test.ts                            ~ the registration (Task 21)
data/fixtures/
  request-rows.ts  request-rows.test.ts                          + (Task 1)
tests/helpers/fakes.ts                                           ~ makeThread, makeSummary (Task 4)
tests/helpers/viewer-offers.tsx  viewer-follow.tsx               + (Tasks 15 and 17)
playwright.config.ts                                             ~ serviceWorkers (Task 21), community-writes (Task 22)
tests/e2e/
  offline.spec.ts                                                + (Task 21)
  helpers/community.ts  community-actions.spec.ts  community-writes.spec.ts   + (Task 22)
  community.spec.ts                                              ~ (Tasks 15, 16)
  routes.spec.ts                                                 ~ (Task 22)
  a11y.spec.ts  cls.spec.ts  performance.spec.ts                 ~ (Task 23; performance also Task 21)
  community-checks.spec.ts                                       + axe and the JS budget after writes (Task 23)
  screenshots.spec.ts                                            ~ (Task 24)
docs/PROGRESS.md  docs/progress/community-actions/  docs/reference/GO-LIVE.md  docs/reference/LANDING-DECISIONS.md
CLAUDE.md  the spec  this plan                                   ~ / + (Task 24)
```

Each `*.test.ts(x)` sits next to the file it tests.

## Where each spec decision is built

| Spec | Built in |
|---|---|
| 2.1 Requests in the store, tagged, `updateTag` on writes, fixtures as the seed, new ids | Task 1 (table, seed), Task 3 (`requests.ts`, tags, `index.ts`; plan decision 1), Tasks 7, 8 and 10 (`requestsChanged()`) |
| 2.2 Plain forms posting to Server Actions, form state, `redirect()`, summary ids | Tasks 7 to 10 (actions), Tasks 11 to 13 (forms; plan decision 2); the bundle-blocked post in Task 22 |
| 2.3 The request form | Task 2 (`checkRequest`; plan decision 5), Task 7 (`saveMyRequest`), Task 11 (the pages) |
| 2.4 No contact details, ISBNs pass | Task 2 (`hasContactDetails`; plan decision 3), Task 22 (end to end) |
| 2.5 5 open, 5 a day | Task 2 (limits), Task 3 (counts), Task 7 (plan decision 4) |
| 2.6 Edit, Close, Reopen, Delete with a confirm page, nothing closes on its own | Task 3 (data), Task 7 (actions), Tasks 11, 12 and 15 (pages; plan decision 6), Task 24 (the checklist's scheduled job) |
| 2.7 An offer is a conversation | Task 1 (`requestId`, `"offered"`), Task 4 (`startOffer`), Task 14 (E's pages; plan decision 8) |
| 2.8 Only approved shops offer | Task 8 (`offerStatus`; plan decision 12), Task 13 (the notes) |
| 2.9 The offer composer page, one offer per shop per request, limits, waiting for a reply, E's lookup skips offers | Task 4 (`findOffer`, `"waiting"`, `findRow`), Task 8 (`sendOffer`), Task 13 (the page), Task 14 (the thread's note; plan decisions 11 and 13) |
| 2.10 The asker unnamed until they reply | Task 4 (`otherName`; plan decision 9), Task 14 |
| 2.11 The offers count from the store | Task 3 (`toRequest`), Task 4 (offer threads; plan decision 10) |
| 2.12 Offers out of the reply rate; Mark as completed only after a reply | Task 4 (`counts`, plan decision 11) |
| 2.13 The asker's panel, Your requests, the `offer` notification | Task 4 (the notification), Task 12 (Your requests), Task 15 (the panel; plan decisions 18 and 19), Task 19 (the account page's row) |
| 2.14 Hide the request from G's queue | Task 3 (`hideRequest`), Task 10 (plan decision 20) |
| 2.15 Follows in the store, `moveShop`, 200, not your own | Task 1 (table), Task 5 (`follows.ts`, `moveShop`) |
| 2.16 Follow in the band | Task 9 (actions), Task 17 (plan decision 16) |
| 2.17 Shops you follow on Saved | Task 5 (`listFollowedShops`), Task 18 (plan decision 17) |
| 2.18 Followers private; the dashboard's count | Task 5 (`countFollowers`), Task 19 |
| 2.19 The `new-listing` notification, one a day | Task 5 (`notifyNewListing`, `notifyFollowers`), Task 9 (F's publish; plan decision 15) |
| 2.20 `/offline`, self-contained, under 4 KB, `noindex` | Task 20 |
| 2.21 `/sw.js`, the `vossie_offline` cache, navigation preload, `no-cache`, the kill switch | Task 21 (plan decision 25) |
| 2.22 Registration in the boot script, production only, after load | Task 21 (accepted by Lama, 2026-10-14; the cut rule) |
| 2.23 What's stored, deletion, the export, the privacy page | Task 6 (plan decision 21), Task 19 (the words), Task 20 (`vossie_offline` in `lib/`) |
| 3 Screens, `noindex`, per request inside `<Suspense>`, `requireAccount` | Tasks 11 to 13, 15, 17 and 18; robots in Task 19 (plan decision 23) |
| 4 Accessibility | Tasks 11 to 18 and 20; axe in Task 23 |
| 5 Performance | Tasks 15 to 19 and 21 (the ledger), Task 23 (the new pages) |
| 6 Testing | Unit tests in every task; end to end in Tasks 21 (offline) and 22; axe, layout shift and size in Task 23; screenshots in Task 24 |
| 7 Not in this stage | Task 24 (the checklist) |

---

### Task 1: Community types, the sample requests as rows, and the store's two tables

The shapes the rest of the plan uses, part B's 16 requests as the store's rows (plan decision 1), the `requests` and `follows` tables, and the new values in every closed list the types feed (a status's words, the audit log's words, the notifications' icons). Nothing reads the tables yet.

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/data/rows.ts`
- Create: `data/fixtures/request-rows.ts`, `data/fixtures/request-rows.test.ts`
- Modify: `lib/data/store.ts`, `lib/data/store.test.ts`
- Modify: `lib/messaging/rules.ts`, `lib/messaging/rules.test.ts`
- Modify: `lib/staff/audit-words.ts`, `lib/staff/audit-words.test.ts`
- Modify: `components/messages/NotificationsView.tsx`, `components/messages/NotificationsView.test.tsx`

- [ ] **Step 1: Record where things start**

Work through "Recheck before starting" first. Then run, one after another: `git status --short`, `pnpm test`, `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`.
Expected: `git status` shows only ` M .claude/launch.json`. Note the unit test count and the `scriptBrotli` figures for the homepage, browse, the listing page, the storefront, Saved, the board, the request page and `/sell`, and write them, the e2e counts from `docs/PROGRESS.md` and the stop line you'll use into the ledger's "Start" row. If a page is already past the stop line, stop here and report.

- [ ] **Step 2: Add the types**

In `lib/types.ts`:

1. Replace E's `ConversationStatus` and its comment (`/** Where a conversation stands (messaging spec 2.5): asked, the seller replied, marked done, the sale confirmed. */` and the line after it) with:

```ts
/**
 * Where a conversation stands (messaging spec 2.5): asked, the seller replied, marked done, the sale confirmed. An
 * offer on a Looking For request starts "offered" and becomes "replied" when the asker writes back (community actions
 * spec 2.7 and 2.12).
 */
export type ConversationStatus = "offered" | "asked" | "replied" | "done" | "confirmed";
```

2. In G's `NotificationKind`, add three members after `| "booking"`, so the union ends:

```ts
  | "shop-update"
  | "booking"
  | "offer"
  | "request-update"
  | "new-listing";
```

and add to its comment, before the closing `*/`: ` Community actions add an offer on your request, the Hub's update about your request, and a followed shop's new listing (community actions plan decision 14).` (on its own ` * ` line).

3. In G's `AuditAction`, add `  | "request-hidden"` on the line after `  | "listing-hidden"`. In G's `AuditTargetKind`, add `| "request"` at the end of the union, before the `;`.

4. Append to the end of the file:

```ts

// --- Community actions (community actions plan, Task 1) -----------------------------------------------------------

/** Where one of the asker's own requests stands (community actions spec 2.6 and 2.14). */
export type RequestState = "open" | "closed" | "hidden";

/** One of the asker's own requests, for its page's panel and Your requests (community actions spec 2.13). */
export type OwnRequest = {
  /** As the board shows it, with the offers count worked out now. */
  request: LookingForRequest;
  state: RequestState;
  /** The Hub's reason, once it has hidden it. */
  hiddenReason: string | null;
};

/** One offer on a request, as its asker sees it (community actions spec 2.13). */
export type OfferSummary = {
  conversationId: string;
  /** The shop's name, or "A closed shop" once it has gone. */
  shopName: string;
  /** The offer's first line, or "" once the shop has left. */
  preview: string;
  /** When the shop offered, ISO 8601 in UTC. */
  offeredAt: string;
};

/** A shop the account follows, as Saved's Shops tab shows it (community actions spec 2.17). */
export type FollowedShop = {
  slug: string;
  name: string;
  campusSlug: string;
  image: ImageRef;
  paused: boolean;
  /** How many of its listings buyers can see now. */
  listed: number;
};
```

- [ ] **Step 3: Add the rows**

In `lib/data/rows.ts`, add `RequestStatus` to the `import type { … } from "@/lib/types";` block at the top, keeping the names in alphabetical order.

In E's `ConversationRow`, after `confirmedBy: "buyer" | "auto" | null;`, add:

```ts
  /** The Looking For request an offer answers (community actions spec 2.7). Absent or null for any other conversation. */
  requestId?: string | null;
  /** The request's title when the offer was made, kept for when the request has gone, as listingTitle is. */
  requestTitle?: string | null;
```

In E's `NotificationRow`, after `readAt: string | null;`, add:

```ts
  /** How many new listings a "new-listing" notification is about (community actions spec 2.19). Absent means one. */
  count?: number | null;
```

The new fields are optional, so E's rows, seeds and tests need no change. Then append to the end of the file:

```ts

// --- Community actions (community actions plan, Task 1; "Store design") -------------------------------------------

/** A Looking For request (community actions spec 2.1). Part B's LookingForRequest is made from it (lib/data/requests.ts). */
export type RequestRow = {
  id: string;
  /** Who asked: never shown to anyone (community spec decision 2). Null for the 16 sample requests. */
  askerId: string | null;
  title: string;
  categorySlug: string;
  campusSlug: string;
  /** In the asker's words, line breaks kept. */
  details: string;
  /** Rand, or null for "Open to offers". */
  budgetZar: number | null;
  swapWelcome: boolean;
  /** YYYY-MM-DD in South African time, or null. */
  neededBy: string | null;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  /** When the asker closed it; null while it's open, and for the sample requests. */
  closedAt: string | null;
  /** The fixture's offers number, kept only on the samples, which have no offer threads (spec 2.11). 0 otherwise. */
  seedOffers: number;
  /** When and why the Hub hid it (spec 2.14), as G's hidden listings. Null while it isn't hidden. */
  hiddenAt: string | null;
  hiddenReason: string | null;
};

/** A student following a shop (community actions spec 2.15), by the shop's slug, which moveShop keeps up to date. */
export type FollowRow = {
  id: string;
  accountId: string;
  sellerSlug: string;
  createdAt: string;
};
```

- [ ] **Step 4: Write the sample rows' test**

Create `data/fixtures/request-rows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sampleRequestRows } from "./request-rows";
import { requests } from "./requests";

describe("the sample requests as the store's rows (community actions plan decision 1)", () => {
  it("keeps every request's words, campus, budget and status, in the same order, with its offers as seedOffers", () => {
    expect(sampleRequestRows.map((row) => row.id)).toEqual(requests.map((request) => request.id));
    for (const [index, row] of sampleRequestRows.entries()) {
      const request = requests[index];
      expect(row, request.id).toMatchObject({
        title: request.title,
        categorySlug: request.categorySlug,
        campusSlug: request.campusSlug,
        details: request.details,
        budgetZar: request.budgetZar,
        swapWelcome: request.swapWelcome,
        neededBy: request.neededBy,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.createdAt,
        seedOffers: request.offers,
      });
    }
  });

  it("names no asker, and none is closed by anyone or hidden", () => {
    for (const row of sampleRequestRows) {
      expect([row.askerId, row.closedAt, row.hiddenAt, row.hiddenReason], row.id).toEqual([null, null, null, null]);
    }
  });
});
```

Run: `pnpm test data/fixtures/request-rows.test.ts`
Expected: FAIL, because `./request-rows` doesn't exist.

- [ ] **Step 5: Write the sample rows**

Create `data/fixtures/request-rows.ts`:

```ts
import type { RequestRow } from "@/lib/data/rows";
import { requests } from "./requests";

// Part B's 16 sample requests as the store's rows (community actions plan decision 1). The fixtures stay as they are;
// the rows add what the store keeps: no asker (so no offer threads), the fixture's offers number as seedOffers, and
// nothing closed by anyone or hidden. Types only from lib, like every fixture.
export const sampleRequestRows: readonly RequestRow[] = requests.map((request) => ({
  id: request.id,
  askerId: null,
  title: request.title,
  categorySlug: request.categorySlug,
  campusSlug: request.campusSlug,
  details: request.details,
  budgetZar: request.budgetZar,
  swapWelcome: request.swapWelcome,
  neededBy: request.neededBy,
  status: request.status,
  createdAt: request.createdAt,
  updatedAt: request.createdAt,
  closedAt: null,
  seedOffers: request.offers,
  hiddenAt: null,
  hiddenReason: null,
}));
```

Run: `pnpm test data/fixtures/request-rows.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Change the store's tests first**

In `lib/data/store.test.ts`:
1. Add `import { sampleRequestRows } from "@/data/fixtures/request-rows";` among the `@/data/fixtures/…` imports, in alphabetical order.
2. In the "is seeded with …, and nothing else" test, add at its end:

```ts
    expect([...store.requests.keys()]).toEqual(sampleRequestRows.map((row) => row.id));
    expect(store.follows.size).toBe(0);
```

and add ", the sample requests" before ", and nothing else" in its name.
3. Add this test after the last "copies the …" test:

```ts
  it("copies the sample requests too (community actions plan, Task 1)", () => {
    sampleStore().requests.get("r-001")!.title = "Changed";
    expect(sampleRequestRows[0].title).toBe("Accounting 1 tutor this week");
    expect(resetAndRead().requests.get("r-001")?.title).toBe("Accounting 1 tutor this week");
  });
```

Run: `pnpm test lib/data/store.test.ts`
Expected: FAIL: the store has no `requests` or `follows`.

- [ ] **Step 7: Add the tables**

In `lib/data/store.ts`:
1. Add `import { sampleRequestRows } from "@/data/fixtures/request-rows";` among the `@/data/fixtures/…` imports, in alphabetical order, and add `FollowRow` and `RequestRow` to the `import type { … } from "./rows";` block, in alphabetical order.
2. In the `SampleStore` type, after G's last table (`hubBookings`), add:

```ts
  /** By id: Looking For requests (community actions spec 2.1). */
  requests: Map<string, RequestRow>;
  /** By id: who follows which shop (community actions spec 2.15). */
  follows: Map<string, FollowRow>;
```

3. Add one to `STORE_VERSION` (4 after G, so 5).
4. In `seedStore()`'s returned object, after G's last table, add:

```ts
    // Copies, like the others (community actions plan decision 1).
    requests: new Map(structuredClone(sampleRequestRows).map((row) => [row.id, row])),
    follows: new Map(),
```

Run: `pnpm test lib/data/store.test.ts`
Expected: PASS.

- [ ] **Step 8: The new values in every closed list**

These lists are typed over the unions Step 2 changed, so the type check fails until each has the new values. Write the tests first.

In `lib/messaging/rules.test.ts`, add `statusLabel` to the import from `./rules` if it isn't there, and add at the end of the file:

```ts

describe("an offer's status (community actions spec 2.7)", () => {
  it("says Offered until the asker replies", () => {
    expect(statusLabel("offered")).toBe("Offered");
  });
});
```

In `lib/staff/audit-words.test.ts`, add `auditKindOf` and `auditLabel` to the import from `./audit-words` if they aren't there, and add at the end of the file:

```ts

describe("hiding a request (community actions plan decision 20)", () => {
  it("is Hid a request, filed under Reports", () => {
    expect(auditLabel("request-hidden")).toBe("Hid a request");
    expect(auditKindOf("request-hidden")).toBe("reports");
  });
});
```

In `components/messages/NotificationsView.test.tsx`, add `render` from `@testing-library/react` and `NotificationsView` from `./NotificationsView` to the imports if they aren't there, and add at the end of the file:

```tsx

describe("community actions' kinds (community actions plan decision 14)", () => {
  it("draws an icon for an offer, a request's update and a followed shop's new listing", () => {
    const items = (["offer", "request-update", "new-listing"] as const).map((kind, n) => ({
      id: `note-${n}`,
      kind,
      text: `Note ${n}`,
      href: "/notifications",
      createdAt: "2026-10-14T08:00:00.000Z",
      isNew: false,
    }));
    const { container } = render(<NotificationsView items={items} now={new Date("2026-10-14T09:00:00.000Z")} />);
    expect(container.querySelectorAll(".notes-row .notes-icon")).toHaveLength(3);
  });
});
```

Run: `pnpm test lib/messaging/rules.test.ts lib/staff/audit-words.test.ts components/messages/NotificationsView.test.tsx`
Expected: FAIL: no words for "offered" or "request-hidden", and no icons for the three kinds.

Then:
- In `lib/messaging/rules.ts`'s `STATUS_LABELS`, add `  offered: "Offered",` as its first entry.
- In `lib/staff/audit-words.ts`'s `ACTIONS`, after the `"listing-hidden"` entry, add `  "request-hidden": { label: "Hid a request", kind: "reports" },`.
- In `components/messages/NotificationsView.tsx`, add `PlusSquareIcon` to the `@/components/icons` import (alphabetical order), add after G's `case "booking":` branch:

```tsx
    case "offer":
      return <MessageIcon className="notes-icon" />;
    case "request-update":
      return <FlagIcon className="notes-icon" />;
    case "new-listing":
      return <PlusSquareIcon className="notes-icon" />;
```

  and add to `KindIcon`'s comment, before `*/`: `Community actions add "offer", "request-update" and "new-listing" (community actions plan decision 14).`

Run: `pnpm test lib/messaging/rules.test.ts lib/staff/audit-words.test.ts components/messages/NotificationsView.test.tsx`
Expected: PASS.

- [ ] **Step 9: Run every check**

Run, one after another: `pnpm typecheck`, `pnpm test`, `pnpm lint`.
Expected: all pass; 6 more unit tests than at the start. If `pnpm typecheck` names another `Record<ConversationStatus, …>`, `Record<NotificationKind, …>` or `Record<AuditAction, …>` (a later stage may have added one), add the new values there with the words above and say so in the hand-over.

- [ ] **Step 10: Hand over for commit**

Files: `lib/types.ts`, `lib/data/rows.ts`, `data/fixtures/request-rows.ts`, `data/fixtures/request-rows.test.ts`, `lib/data/store.ts`, `lib/data/store.test.ts`, `lib/messaging/rules.ts`, `lib/messaging/rules.test.ts`, `lib/staff/audit-words.ts`, `lib/staff/audit-words.test.ts`, `components/messages/NotificationsView.tsx`, `components/messages/NotificationsView.test.tsx`.
Message: `feat: community actions' types, the sample requests as rows, and the requests and follows tables in the sample store, with Offered, Hid a request and three notification icons (community actions spec 2.1, 2.7, 2.14 and 2.15)`

---

### Task 2: Looking For's and following's rules: limits, the contact check, addresses, error words and sentences

The plain functions every later task uses (spec 2.3 to 2.5, 2.9, 2.10, 2.13, 2.15 to 2.19; plan decisions 2 to 5, 7 to 9 and 14): the request form's checks with the contact-details refusal, the limits, the addresses and form-state keys, the error words, the status lines and notification sentences, and following's limit, Saved's tabs and the followers line. No store, no session.

**Files:**
- Create: `lib/looking-for/rules.ts`, `lib/looking-for/rules.test.ts`
- Create: `lib/looking-for/errors.ts`, `lib/looking-for/errors.test.ts`
- Create: `lib/looking-for/paths.ts`, `lib/looking-for/paths.test.ts`
- Create: `lib/looking-for/words.ts`, `lib/looking-for/words.test.ts`
- Create: `lib/following/rules.ts`, `lib/following/rules.test.ts`

- [ ] **Step 1: Write the rules' tests**

Create `lib/looking-for/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addDays, checkNeededBy, checkRequest, hasContactDetails, parseBudget, type RequestInput } from "./rules";

const KNOWN = { categorySlugs: ["tutoring", "tech"], campusSlugs: ["midrand", "online"], today: "2026-10-14" };

const input = (overrides: Partial<RequestInput> = {}): RequestInput => ({
  title: "Accounting 1 tutor this week",
  categorySlug: "tutoring",
  campusSlug: "midrand",
  details: "Stuck on adjustments before Friday's test.\nEvenings suit me.",
  budget: "300",
  swap: false,
  neededBy: "2026-10-16",
  ...overrides,
});

describe("contact details (community actions spec 2.4, plan decision 3)", () => {
  it("finds phone numbers however they're written", () => {
    for (const text of [
      "Call 0821234567",
      "WhatsApp 082 123 4567",
      "082-123-4567 after six",
      "Ring (012) 345 6789",
      "+27 82 123 4567",
      "0027821234567",
      "R300 0821234567",
      "0 8 2 1 2 3 4 5 6 7",
    ]) {
      expect(hasContactDetails(text), text).toBe(true);
    }
  });

  it("finds email addresses", () => {
    expect(hasContactDetails("Mail sipho.m@gmail.com")).toBe(true);
    expect(hasContactDetails("student@eduvos.com please")).toBe(true);
  });

  it("lets ISBNs, prices, dates and plain numbers through", () => {
    for (const text of [
      "ISBN 0-306-40615-2",
      "ISBN: 0306406152",
      "0-306-40615-2",
      "978-0-306-40615-7",
      "9780306406157",
      "978 0 306 40615 7",
      "Budget R1 200 by 2026-10-16",
      "Two past papers, 2024 and 2025",
      "Room 12, block 3, from 18:00",
    ]) {
      expect(hasContactDetails(text), text).toBe(false);
    }
  });

  it("doesn't take a phone number for an ISBN because it's labelled one", () => {
    expect(hasContactDetails("ISBN 0821234567")).toBe(true);
  });
});

describe("the budget (community actions plan decision 5)", () => {
  it("reads whole rand, with or without R, spaces and commas; empty is open to offers", () => {
    expect(parseBudget("300")).toBe(300);
    expect(parseBudget(" R1 200 ")).toBe(1200);
    expect(parseBudget("r1,200")).toBe(1200);
    expect(parseBudget("100000")).toBe(100000);
    expect(parseBudget("")).toBeNull();
    expect(parseBudget("  ")).toBeNull();
  });

  it("refuses anything else", () => {
    for (const raw of ["0", "100001", "12.50", "about 300", "-5", "R"]) {
      expect(parseBudget(raw), raw).toBe(raw === "R" ? null : "invalid");
    }
  });
});

describe("needed by (community actions spec 2.3)", () => {
  it("adds days to a South African date without the clock", () => {
    expect(addDays("2026-10-14", 90)).toBe("2027-01-12");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("is empty, or today to 90 days on", () => {
    expect(checkNeededBy("", "2026-10-14")).toEqual({ value: null, error: null });
    expect(checkNeededBy("2026-10-14", "2026-10-14")).toEqual({ value: "2026-10-14", error: null });
    expect(checkNeededBy("2027-01-12", "2026-10-14")).toEqual({ value: "2027-01-12", error: null });
    expect(checkNeededBy("2027-01-13", "2026-10-14").error).toBe("needed-far");
    expect(checkNeededBy("2026-10-13", "2026-10-14").error).toBe("needed-past");
  });

  it("refuses what isn't a real date", () => {
    for (const raw of ["16 Oct", "2026-02-30", "2026-13-01", "tomorrow"]) {
      expect(checkNeededBy(raw, "2026-10-14").error, raw).toBe("needed-invalid");
    }
  });
});

describe("the request form's checks (community actions spec 2.3)", () => {
  it("gives the fields back cleaned: one-line title, details' line breaks kept, the budget in rand", () => {
    expect(checkRequest(input({ title: "  Accounting 1\n tutor   this week ", details: " A\r\nB is what I need, please. " }), KNOWN)).toEqual({
      value: {
        title: "Accounting 1 tutor this week",
        categorySlug: "tutoring",
        campusSlug: "midrand",
        details: "A\nB is what I need, please.",
        budgetZar: 300,
        swapWelcome: false,
        neededBy: "2026-10-16",
      },
      errors: [],
    });
  });

  it("takes an empty budget and no date as open to offers, any time", () => {
    expect(checkRequest(input({ budget: "", neededBy: "", swap: true }), KNOWN).value).toMatchObject({
      budgetZar: null,
      neededBy: null,
      swapWelcome: true,
    });
  });

  it("lists every problem in the form's order", () => {
    expect(
      checkRequest(
        { title: "", categorySlug: "", campusSlug: "mars", details: "", budget: "lots", swap: false, neededBy: "soon" },
        KNOWN,
      ),
    ).toEqual({
      value: null,
      errors: ["title-missing", "category-missing", "campus-missing", "details-missing", "budget-invalid", "needed-invalid"],
    });
  });

  it("checks the lengths: a title of 5 to 70, details of 20 to 600", () => {
    expect(checkRequest(input({ title: "Desk" }), KNOWN).errors).toEqual(["title-length"]);
    expect(checkRequest(input({ title: "x".repeat(71) }), KNOWN).errors).toEqual(["title-length"]);
    expect(checkRequest(input({ title: "x".repeat(70) }), KNOWN).errors).toEqual([]);
    expect(checkRequest(input({ details: "Too short." }), KNOWN).errors).toEqual(["details-length"]);
    expect(checkRequest(input({ details: "x".repeat(601) }), KNOWN).errors).toEqual(["details-length"]);
  });

  it("refuses contact details in the title or the details (spec 2.4)", () => {
    expect(checkRequest(input({ title: "Tutor, call 0821234567" }), KNOWN).errors).toEqual(["title-contact"]);
    expect(checkRequest(input({ details: "Email me at thandi@gmail.com about it." }), KNOWN).errors).toEqual([
      "details-contact",
    ]);
    expect(checkRequest(input({ details: "The textbook is ISBN 978-0-306-40615-7, any edition." }), KNOWN).errors).toEqual(
      [],
    );
  });
});
```

- [ ] **Step 2: Write the words' and addresses' tests**

Create `lib/looking-for/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { offerErrors, offerFieldIds, requestErrors, requestFieldIds } from "./errors";

describe("the request form's error words (community actions spec 2.3 and 2.4)", () => {
  it("links each to its field, by the form's own ids (plan decision 2)", () => {
    const ids = requestFieldIds("request-new");
    expect(ids).toEqual({
      title: "request-new-title",
      category: "request-new-category",
      campus: "request-new-campus",
      details: "request-new-details",
      budget: "request-new-budget",
      swap: "request-new-swap",
      neededBy: "request-new-needed-by",
    });
    expect(requestErrors(["title-contact", "needed-past", "open-limit"], ids)).toEqual([
      { message: "Take out the phone number or email. Shops will message you on Vossie.", fieldId: "request-new-title" },
      { message: "Choose today or a later date.", fieldId: "request-new-needed-by" },
      { message: "You have 5 open requests. Close one before you post another.", fieldId: null },
    ]);
    expect(requestFieldIds("request-r-001").title).toBe("request-r-001-title");
  });

  it("drops a code it doesn't know", () => {
    expect(requestErrors(["toString", "made-up"], requestFieldIds("request-new"))).toEqual([]);
  });
});

describe("the offer composer's error words (community actions spec 2.9)", () => {
  it("uses E's words for the message, and says when the shop has offered enough today", () => {
    const ids = offerFieldIds("offer-r-001");
    expect(ids).toEqual({ body: "offer-r-001-body", listing: "offer-r-001-listing" });
    expect(offerErrors(["message-missing", "offer-rate"], ids)).toEqual([
      { message: "Write a message first.", fieldId: "offer-r-001-body" },
      { message: "Your shop has made 20 offers today. Try again tomorrow.", fieldId: null },
    ]);
  });
});
```

Create `lib/looking-for/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  deleteRequestPath,
  editRequestPath,
  NEW_REQUEST_PATH,
  offerFieldPrefix,
  offerFormKey,
  offerPath,
  requestFieldPrefix,
  requestFormKey,
  requestNoteKey,
  requestPath,
  YOUR_REQUESTS_FORM,
  YOUR_REQUESTS_PATH,
} from "./paths";

describe("Looking For's addresses and form keys (community actions spec section 3, plan decisions 2 and 7)", () => {
  it("has a page for each action", () => {
    expect(NEW_REQUEST_PATH).toBe("/looking-for/new");
    expect(YOUR_REQUESTS_PATH).toBe("/account/requests");
    expect(requestPath("r-001")).toBe("/looking-for/r-001");
    expect(editRequestPath("r-001")).toBe("/looking-for/r-001/edit");
    expect(deleteRequestPath("r-001")).toBe("/looking-for/r-001/delete");
    expect(offerPath("r-001")).toBe("/looking-for/r-001/offer");
  });

  it("keeps each form's state, and each page's status line, apart", () => {
    expect(requestFormKey(null)).toBe("request:new");
    expect(requestFormKey("r-001")).toBe("request:r-001");
    expect(offerFormKey("r-001")).toBe("offer:r-001");
    expect(requestNoteKey("r-001")).toBe("request-note:r-001");
    expect(YOUR_REQUESTS_FORM).toBe("your-requests");
  });

  it("gives each form's ids a prefix of their own", () => {
    expect(requestFieldPrefix(null)).toBe("request-new");
    expect(requestFieldPrefix("r-001")).toBe("request-r-001");
    expect(offerFieldPrefix("r-001")).toBe("offer-r-001");
  });
});
```

Create `lib/looking-for/words.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  offerAbout,
  offerNoteText,
  requestHiddenText,
  requestNoticeText,
  requestStateLabel,
  UNNAMED_ASKER,
} from "./words";

describe("Looking For's words (community actions spec 2.10, 2.13, 2.14 and section 4)", () => {
  it("says what each action did, once (plan decision 7), and nothing for a code it doesn't know", () => {
    expect(requestNoticeText("posted")).toBe("Your request is up.");
    expect(requestNoticeText("saved")).toBe("Your changes are saved.");
    expect(requestNoticeText("closed")).toBe("Request closed.");
    expect(requestNoticeText("reopened")).toBe("Request reopened.");
    expect(requestNoticeText("deleted")).toBe("Request deleted.");
    expect(requestNoticeText("reopen-limit")).toBe("You have 5 open requests. Close one before you reopen this one.");
    expect(requestNoticeText("toString")).toBeNull();
    expect(requestNoticeText(null)).toBeNull();
  });

  it("writes the notifications' sentences (plan decision 14)", () => {
    expect(offerNoteText("Tech corner", "Accounting 1 tutor this week")).toBe(
      "Tech corner offered to help with Accounting 1 tutor this week",
    );
    expect(requestHiddenText("Kettle for res")).toBe("The Hub hid your request Kettle for res. See why in Your requests.");
  });

  it("names an offer thread by its request, and the asker not at all (plan decisions 8 and 9)", () => {
    expect(offerAbout("buyer", "Kettle for res")).toBe("Your request: Kettle for res");
    expect(offerAbout("seller", "Kettle for res")).toBe("Request: Kettle for res");
    expect(UNNAMED_ASKER).toBe("The student who asked");
  });

  it("says where a request stands", () => {
    expect(["open", "closed", "hidden"].map((state) => requestStateLabel(state as "open"))).toEqual([
      "Open",
      "Closed",
      "Hidden by the Hub",
    ]);
  });
});
```

Create `lib/following/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FOLLOW_LIMIT,
  followersLine,
  followNoteKey,
  followNoticeText,
  newListingsText,
  newListingText,
  parseSavedTab,
  SAVED_SHOPS_FORM,
  savedTabPath,
} from "./rules";

describe("following shops (community actions spec 2.15 to 2.19)", () => {
  it("has a cap of 200", () => {
    expect(FOLLOW_LIMIT).toBe(200);
  });

  it("reads Saved's tab from the link: Shops only for ?tab=shops (plan decision 17)", () => {
    expect(parseSavedTab("shops")).toBe("shops");
    expect(parseSavedTab(["shops", "listings"])).toBe("shops");
    expect(parseSavedTab(undefined)).toBe("listings");
    expect(parseSavedTab("anything")).toBe("listings");
    expect(savedTabPath("listings")).toBe("/saved");
    expect(savedTabPath("shops")).toBe("/saved?tab=shops");
  });

  it("keeps the band's and Saved's status lines apart (plan decision 7)", () => {
    expect(followNoteKey("tech-corner")).toBe("follow:tech-corner");
    expect(SAVED_SHOPS_FORM).toBe("saved-shops");
    expect(followNoticeText("followed", "Tech corner")).toBe("You follow Tech corner.");
    expect(followNoticeText("unfollowed", "Tech corner")).toBe("You've unfollowed Tech corner.");
    expect(followNoticeText("follow-limit", "Tech corner")).toBe("You follow 200 shops. Unfollow one first.");
    expect(followNoticeText("toString", "Tech corner")).toBeNull();
  });

  it("writes the new-listing notification, one and then several (spec 2.19)", () => {
    expect(newListingText("Tech corner", "Casio fx-991ZA Plus calculator")).toBe(
      "Tech corner listed Casio fx-991ZA Plus calculator",
    );
    expect(newListingsText("Tech corner", 2)).toBe("Tech corner listed 2 new things");
  });

  it("tells a shop how many follow it, never who (spec 2.18)", () => {
    expect(followersLine(0)).toBe("No one follows your shop yet");
    expect(followersLine(1)).toBe("1 person follows your shop");
    expect(followersLine(12)).toBe("12 people follow your shop");
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/looking-for lib/following`
Expected: FAIL, because none of the five modules exists.

- [ ] **Step 4: Write the rules**

Create `lib/looking-for/rules.ts`:

```ts
import { characterCount, cleanText } from "@/lib/messaging/rules";

// Looking For's limits and checks (community actions spec 2.3 to 2.5 and 2.9; plan decisions 3 to 5). Plain values
// and functions: safe anywhere on the server and in tests.

export const TITLE_MIN = 5;
export const TITLE_MAX = 70;
export const DETAILS_MIN = 20;
export const DETAILS_MAX = 600;
/** Whole rand, as F's prices (plan decision 5). */
export const BUDGET_MAX = 100_000;
/** Needed by is today or later in SAST, and within this many days (spec 2.3). */
export const NEEDED_BY_DAYS = 90;
/** Open requests an account can have at once, and new ones in 24 hours (spec 2.5, plan decision 4). */
export const OPEN_REQUESTS_MAX = 5;
export const REQUESTS_PER_DAY = 5;
/** Offers a shop can make in 24 hours (spec 2.9). */
export const OFFERS_PER_DAY = 20;

export type RequestError =
  | "title-missing"
  | "title-length"
  | "title-contact"
  | "category-missing"
  | "campus-missing"
  | "details-missing"
  | "details-length"
  | "details-contact"
  | "budget-invalid"
  | "needed-invalid"
  | "needed-past"
  | "needed-far"
  | "open-limit"
  | "daily-limit";

/** What the request form posts (spec 2.3). */
export type RequestInput = {
  title: string;
  categorySlug: string;
  campusSlug: string;
  details: string;
  budget: string;
  swap: boolean;
  neededBy: string;
};

/** A request's fields once they're right. */
export type RequestFields = {
  title: string;
  categorySlug: string;
  campusSlug: string;
  details: string;
  budgetZar: number | null;
  swapWelcome: boolean;
  neededBy: string | null;
};

// --- Contact details (spec 2.4, plan decision 3) -------------------------------------------------------------------

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/u;
/** A run of digits that may hold spaces, dots, dashes and brackets, perhaps after a "+". */
const DIGIT_RUN = /\+?\d[\d\s().-]*\d/g;
/** 13 digits starting 978 or 979, each perhaps after one space or dash. */
const ISBN_13 = /\b97[89](?:[\s-]?\d){10}\b/g;
/** 10 characters, digits and a last X, each perhaps after one space or dash. */
const ISBN_10 = /\b\d(?:[\s-]?\d){8}[\s-]?[\dXx]\b/g;
const ISBN_LABEL = /ISBN(?:-?10)?[\s:]*$/i;
const FOUR_GROUPS = /^\d{1,5}-\d{1,7}-\d{1,7}-[\dXx]$/;

/** An ISBN-10's check digit: the digits weighted 10 down to 1 add up to a multiple of 11 (X is 10). */
function isbn10CheckIsRight(chars: string): boolean {
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const char = chars[index];
    sum += (char === "X" || char === "x" ? 10 : Number(char)) * (10 - index);
  }
  return sum % 11 === 0;
}

/**
 * The text with its ISBNs taken out, so they're never read as phone numbers: every 978 or 979 number, and a 10-digit
 * one whose check digit is right when it's labelled "ISBN" or dashed in four groups.
 */
function withoutIsbns(text: string): string {
  return text.replace(ISBN_13, " ").replace(ISBN_10, (match: string, offset: number, whole: string) => {
    const labelled = ISBN_LABEL.test(whole.slice(0, offset));
    const isbn = (labelled || FOUR_GROUPS.test(match)) && isbn10CheckIsRight(match.replace(/[\s-]/g, ""));
    return isbn ? " " : match;
  });
}

/** A South African number's digits: 10 starting 0, or 11 starting 27, or 13 starting 0027. */
function isPhoneDigits(digits: string): boolean {
  return (
    (digits.length === 10 && digits.startsWith("0")) ||
    (digits.length === 11 && digits.startsWith("27")) ||
    (digits.length === 13 && digits.startsWith("0027"))
  );
}

/** Whether some words in a run of digits, one after another, make a phone number ("R300 082 123 4567"). */
function holdsPhone(run: string): boolean {
  const parts = run.trim().split(/\s+/);
  for (let start = 0; start < parts.length; start += 1) {
    let digits = "";
    for (let end = start; end < parts.length && digits.length <= 13; end += 1) {
      digits += parts[end].replace(/\D/g, "");
      if (isPhoneDigits(digits)) return true;
    }
  }
  return false;
}

/** Whether `text` holds an email address or a phone number (spec 2.4). ISBNs pass. */
export function hasContactDetails(text: string): boolean {
  const plain = withoutIsbns(text);
  if (EMAIL.test(plain)) return true;
  return [...plain.matchAll(DIGIT_RUN)].some(([run]) => holdsPhone(run));
}

// --- The fields (spec 2.3, plan decision 5) ------------------------------------------------------------------------

/** The budget in whole rand: "300", "R1 200" or "1,200". Empty is null ("Open to offers"); anything else is "invalid". */
export function parseBudget(raw: string): number | null | "invalid" {
  const value = raw.trim().replace(/^R\s*/i, "").replace(/[\s,]/g, "");
  if (value === "") return null;
  if (!/^\d{1,6}$/.test(value)) return "invalid";
  const rand = Number(value);
  return rand >= 1 && rand <= BUDGET_MAX ? rand : "invalid";
}

/** Whether a YYYY-MM-DD date exists ("2026-02-30" doesn't). */
function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** A South African date `days` days on, YYYY-MM-DD. It reads no clock: the date comes from the caller. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export type NeededByCheck = { value: string | null; error: "needed-invalid" | "needed-past" | "needed-far" | null };

/** Needed by (spec 2.3): empty is none; otherwise a real date from `today` (in SAST) to 90 days on. */
export function checkNeededBy(raw: string, today: string): NeededByCheck {
  const value = raw.trim();
  if (value === "") return { value: null, error: null };
  if (!isRealDate(value)) return { value: null, error: "needed-invalid" };
  if (value < today) return { value: null, error: "needed-past" };
  if (value > addDays(today, NEEDED_BY_DAYS)) return { value: null, error: "needed-far" };
  return { value, error: null };
}

/** A title on one line: E's cleanText, then every run of white space as one space. */
function cleanTitle(raw: string): string {
  return cleanText(raw).replace(/\s+/g, " ");
}

/** What the form needs to know: the categories and campuses there are, and today's date in SAST. */
export type RequestContext = { categorySlugs: readonly string[]; campusSlugs: readonly string[]; today: string };

/**
 * The request form's checks (spec 2.3 and 2.4), in the form's order: the fields once they're right, or every problem.
 * The limits (spec 2.5) need the store, so the Server Action checks them.
 */
export function checkRequest(
  input: RequestInput,
  known: RequestContext,
): { value: RequestFields | null; errors: RequestError[] } {
  const errors: RequestError[] = [];
  const title = cleanTitle(input.title);
  const titleLength = characterCount(title);
  if (title === "") errors.push("title-missing");
  else if (titleLength < TITLE_MIN || titleLength > TITLE_MAX) errors.push("title-length");
  else if (hasContactDetails(title)) errors.push("title-contact");
  if (!known.categorySlugs.includes(input.categorySlug)) errors.push("category-missing");
  if (!known.campusSlugs.includes(input.campusSlug)) errors.push("campus-missing");
  const details = cleanText(input.details);
  const detailsLength = characterCount(details);
  if (details === "") errors.push("details-missing");
  else if (detailsLength < DETAILS_MIN || detailsLength > DETAILS_MAX) errors.push("details-length");
  else if (hasContactDetails(details)) errors.push("details-contact");
  const budget = parseBudget(input.budget);
  if (budget === "invalid") errors.push("budget-invalid");
  const neededBy = checkNeededBy(input.neededBy, known.today);
  if (neededBy.error) errors.push(neededBy.error);
  if (errors.length > 0 || budget === "invalid") return { value: null, errors };
  return {
    value: {
      title,
      categorySlug: input.categorySlug,
      campusSlug: input.campusSlug,
      details,
      budgetZar: budget,
      swapWelcome: input.swap,
      neededBy: neededBy.value,
    },
    errors,
  };
}
```

- [ ] **Step 5: Write the error words, the addresses and the sentences**

Create `lib/looking-for/errors.ts`:

```ts
import type { FormError } from "@/lib/auth/messages";
import { messagingErrors } from "@/lib/messaging/errors";
import {
  DETAILS_MAX,
  DETAILS_MIN,
  NEEDED_BY_DAYS,
  OFFERS_PER_DAY,
  OPEN_REQUESTS_MAX,
  REQUESTS_PER_DAY,
  TITLE_MAX,
  TITLE_MIN,
} from "./rules";

// Looking For's error words (community actions spec 2.3, 2.4, 2.5 and 2.9; plan decision 26 for the ones the spec
// doesn't give), each linked to its field, in the shape D's ErrorSummary and errorFor take.

const CONTACT = "Take out the phone number or email. Shops will message you on Vossie.";

// A Map, so a stray code such as "toString" finds nothing. The limits belong to no field.
const MESSAGES: ReadonlyMap<string, { message: string; field: string }> = new Map([
  ["title-missing", { message: "Say what you need.", field: "title" }],
  ["title-length", { message: `Keep it between ${TITLE_MIN} and ${TITLE_MAX} characters.`, field: "title" }],
  ["title-contact", { message: CONTACT, field: "title" }],
  ["category-missing", { message: "Choose a category.", field: "category" }],
  ["campus-missing", { message: "Choose a campus.", field: "campus" }],
  ["details-missing", { message: "Add the details: what you need and when.", field: "details" }],
  ["details-length", { message: `Write between ${DETAILS_MIN} and ${DETAILS_MAX} characters.`, field: "details" }],
  ["details-contact", { message: CONTACT, field: "details" }],
  ["budget-invalid", { message: "Enter a budget in whole rand, like 300, or leave it empty.", field: "budget" }],
  [
    "needed-invalid",
    { message: "Enter the date as year, month and day, like 2026-10-24, or leave it empty.", field: "neededBy" },
  ],
  ["needed-past", { message: "Choose today or a later date.", field: "neededBy" }],
  ["needed-far", { message: `Choose a date within ${NEEDED_BY_DAYS} days.`, field: "neededBy" }],
  [
    "open-limit",
    { message: `You have ${OPEN_REQUESTS_MAX} open requests. Close one before you post another.`, field: "none" },
  ],
  ["daily-limit", { message: `You've posted ${REQUESTS_PER_DAY} requests today. Try again tomorrow.`, field: "none" }],
]);

export type RequestFieldIds = {
  title: string;
  category: string;
  campus: string;
  details: string;
  budget: string;
  swap: string;
  neededBy: string;
};

/** The request form's fields' ids, from the form's prefix (plan decision 2): "request-new" or "request-<id>". */
export function requestFieldIds(prefix: string): RequestFieldIds {
  return {
    title: `${prefix}-title`,
    category: `${prefix}-category`,
    campus: `${prefix}-campus`,
    details: `${prefix}-details`,
    budget: `${prefix}-budget`,
    swap: `${prefix}-swap`,
    neededBy: `${prefix}-needed-by`,
  };
}

/** The words for the request form's error codes, in order, each linked to its field's id. */
export function requestErrors(codes: readonly string[], fieldIds: Readonly<Record<string, string>>): FormError[] {
  return codes.flatMap((code) => {
    const known = MESSAGES.get(code);
    if (!known) return [];
    return [{ message: known.message, fieldId: Object.hasOwn(fieldIds, known.field) ? fieldIds[known.field] : null }];
  });
}

export type OfferFieldIds = { body: string; listing: string };

/** The offer composer's fields' ids (plan decision 2): "offer-<id>-body" and "offer-<id>-listing". */
export function offerFieldIds(prefix: string): OfferFieldIds {
  return { body: `${prefix}-body`, listing: `${prefix}-listing` };
}

/** The offer composer's errors, in order: E's words for the message, and the shop's daily limit (spec 2.9). */
export function offerErrors(codes: readonly string[], fieldIds: Readonly<Record<string, string>>): FormError[] {
  return codes.flatMap((code) =>
    code === "offer-rate"
      ? [{ message: `Your shop has made ${OFFERS_PER_DAY} offers today. Try again tomorrow.`, fieldId: null }]
      : messagingErrors([code], fieldIds),
  );
}
```

Create `lib/looking-for/paths.ts`:

```ts
// Looking For's addresses (community actions spec section 3), the keys its forms and status lines keep their state
// under (D decision 3, plan decision 7), and the prefixes that keep its ids unique across kept pages (plan decision 2).

export const NEW_REQUEST_PATH = "/looking-for/new";
export const YOUR_REQUESTS_PATH = "/account/requests";

export const requestPath = (id: string) => `/looking-for/${id}`;
export const editRequestPath = (id: string) => `/looking-for/${id}/edit`;
export const deleteRequestPath = (id: string) => `/looking-for/${id}/delete`;
export const offerPath = (id: string) => `/looking-for/${id}/offer`;

/** The request form's state: the new request's, or one request's edit. */
export const requestFormKey = (id: string | null) => (id ? `request:${id}` : "request:new");
export const offerFormKey = (id: string) => `offer:${id}`;
/** A request page's status line, left by an action and taken once by the asker's panel (plan decision 7). */
export const requestNoteKey = (id: string) => `request-note:${id}`;
/** Your requests' status line. */
export const YOUR_REQUESTS_FORM = "your-requests";

export const requestFieldPrefix = (id: string | null) => (id ? `request-${id}` : "request-new");
export const offerFieldPrefix = (id: string) => `offer-${id}`;
```

Create `lib/looking-for/words.ts`:

```ts
import type { RequestState } from "@/lib/types";
import { OPEN_REQUESTS_MAX } from "./rules";

// Looking For's words (community actions spec 2.10, 2.13, 2.14 and section 4; plan decisions 7 to 9, 14 and 26). The
// status lines are kept as codes in form state, never words, so a stale or made-up code shows nothing. The words are
// samples for Lama to change.

/** What the shop calls the asker until the asker writes (spec 2.10). */
export const UNNAMED_ASKER = "The student who asked";

/** The thread's note after Send offer (plan decision 8). */
export const OFFER_SENT_NOTE = "Sent. The student who asked gets a notification.";
/** In place of the shop's reply form until the asker replies (spec 2.9). */
export const SHOP_WAITS_NOTE = "You can write again when they reply.";
/** An offer thread's card once its request has gone (spec 2.6). */
export const REQUEST_REMOVED_NOTE = "This request was removed.";

const NOTICES: ReadonlyMap<string, string> = new Map([
  ["posted", "Your request is up."],
  ["saved", "Your changes are saved."],
  ["closed", "Request closed."],
  ["reopened", "Request reopened."],
  ["deleted", "Request deleted."],
  ["reopen-limit", `You have ${OPEN_REQUESTS_MAX} open requests. Close one before you reopen this one.`],
]);

export function requestNoticeText(code: string | null | undefined): string | null {
  return code ? (NOTICES.get(code) ?? null) : null;
}

/** The asker's notification for each offer (spec 2.13), with the "offer" kind. */
export function offerNoteText(shop: string, requestTitle: string): string {
  return `${shop} offered to help with ${requestTitle}`;
}

/** The asker's notification when the Hub hides their request (spec 2.14), with the "request-update" kind. */
export function requestHiddenText(title: string): string {
  return `The Hub hid your request ${title}. See why in Your requests.`;
}

/** What an offer thread is about, in the inbox (plan decision 8). */
export function offerAbout(role: "buyer" | "seller", requestTitle: string): string {
  return role === "buyer" ? `Your request: ${requestTitle}` : `Request: ${requestTitle}`;
}

const STATES: Readonly<Record<RequestState, string>> = { open: "Open", closed: "Closed", hidden: "Hidden by the Hub" };

export function requestStateLabel(state: RequestState): string {
  return STATES[state];
}
```

Create `lib/following/rules.ts`:

```ts
// Following shops (community actions spec 2.15 to 2.19; plan decisions 7, 15 to 17 and 26): the cap, Saved's tabs,
// the status lines' keys and words, the new-listing notification's sentences and the dashboard's line. Plain values
// and functions. The words are samples for Lama to change.

export const FOLLOW_LIMIT = 200;

export type SavedTab = "listings" | "shops";

/** "?tab=shops" opens Shops; anything else is Listings (plan decision 17). */
export function parseSavedTab(raw: string | string[] | undefined): SavedTab {
  return (Array.isArray(raw) ? raw[0] : raw) === "shops" ? "shops" : "listings";
}

export function savedTabPath(tab: SavedTab): string {
  return tab === "shops" ? "/saved?tab=shops" : "/saved";
}

/** The storefront's status line after Follow or Unfollow, and Saved's after Unfollow (plan decision 7). */
export const followNoteKey = (slug: string) => `follow:${slug}`;
export const SAVED_SHOPS_FORM = "saved-shops";

/** Beside Follow on the band, after an unfollow: short, so it fits the row (plan decision 16). */
export const UNFOLLOWED_SHORT = "Unfollowed.";

export function followNoticeText(code: string | null | undefined, shop: string): string | null {
  switch (code) {
    case "followed":
      return `You follow ${shop}.`;
    case "unfollowed":
      return `You've unfollowed ${shop}.`;
    case "follow-limit":
      return `You follow ${FOLLOW_LIMIT} shops. Unfollow one first.`;
    default:
      return null;
  }
}

/** A followed shop's first new listing of the day (spec 2.19), linking to the listing. */
export function newListingText(shop: string, title: string): string {
  return `${shop} listed ${title}`;
}

/** The same notification once the shop lists more that day, linking to the shop. */
export function newListingsText(shop: string, count: number): string {
  return `${shop} listed ${count} new things`;
}

/** The dashboard's line (spec 2.18): how many follow, never who. */
export function followersLine(count: number): string {
  if (count === 0) return "No one follows your shop yet";
  return count === 1 ? "1 person follows your shop" : `${count} people follow your shop`;
}
```

- [ ] **Step 6: Run them to make sure they pass**

Run: `pnpm test lib/looking-for lib/following`
Expected: PASS (29 tests).

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 29 more unit tests than after Task 1.

- [ ] **Step 8: Hand over for commit**

Files: `lib/looking-for/rules.ts`, `lib/looking-for/rules.test.ts`, `lib/looking-for/errors.ts`, `lib/looking-for/errors.test.ts`, `lib/looking-for/paths.ts`, `lib/looking-for/paths.test.ts`, `lib/looking-for/words.ts`, `lib/looking-for/words.test.ts`, `lib/following/rules.ts`, `lib/following/rules.test.ts`.
Message: `feat: Looking For's and following's rules: the request form's checks with the contact-details refusal, the limits, addresses, error words, status lines and sentences, Saved's tabs and the followers line (community actions spec 2.3 to 2.5, 2.9 and 2.15 to 2.19)`

---

### Task 3: Requests in the store, tagged

Requests move into the store as F moved listings (spec 2.1, plan decision 1): `lib/data/requests.ts` reads and writes them, the four cached functions in `lib/data/index.ts` read through it, tagged `requests`, and a write expires the tag. The offers count is the offer threads plus the sample's number (spec 2.11; no offer threads exist until Task 4, but the count already reads them). The Hub's hide (spec 2.14) and what deleting an account does are here too; their actions come later.

**Files:**
- Modify: `lib/data/tags.ts`
- Modify: `lib/data/notifications.ts`, `lib/data/notifications.test.ts`
- Create: `lib/data/requests.ts`, `lib/data/requests.test.ts`
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`
- Modify: the tests that read requests through the data layer (Step 7's `grep`)

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` and `updateTag.md`: `cacheTag` marks what a `"use cache"` function returned; `updateTag` (Server Actions only) expires it at once, and every prerendered page that read it, so the next request reads the store again (F's reading, "Where things stand").

- [ ] **Step 2: Write the tests**

In `lib/data/notifications.test.ts`, add `deleteNotificationsAbout` to the import from `./notifications`, and add at the end of the file:

```ts

describe("notifications about things that have gone (community actions plan decisions 6 and 21)", () => {
  it("deletes everyone's of one kind about those things, and nothing else", async () => {
    const at = new Date("2026-10-14T08:42:00.000Z");
    await notify({ accountId: "acc-student", kind: "request-update", subjectId: "r-a", text: "A", href: "/", now: at });
    await notify({ accountId: "acc-mentor", kind: "request-update", subjectId: "r-a", text: "B", href: "/", now: at });
    await notify({ accountId: "acc-student", kind: "request-update", subjectId: "r-b", text: "C", href: "/", now: at });
    await notify({ accountId: "acc-student", kind: "offer", subjectId: "r-a", text: "D", href: "/", now: at });
    await deleteNotificationsAbout("request-update", new Set(["r-a"]));
    expect((await getNotifications("acc-student", 50)).map((item) => item.text)).toEqual(
      expect.arrayContaining(["C", "D"]),
    );
    expect((await getNotifications("acc-student", 50)).map((item) => item.text)).not.toContain("A");
    expect((await getNotifications("acc-mentor", 50)).map((item) => item.text)).not.toContain("B");
  });
});
```

(Add `notify` and `getNotifications` to the import too if the file doesn't import them.)

Create `lib/data/requests.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { RequestFields } from "@/lib/looking-for/rules";
import { getNotifications, notify } from "./notifications";
import {
  countOpenRequests,
  countRequestsSince,
  createRequest,
  deleteRequest,
  exportRequests,
  forgetRequestsOf,
  getOwnRequest,
  hideRequest,
  listedRequests,
  listOwnRequests,
  publicRequest,
  publicRequestIds,
  setRequestOpen,
  updateRequest,
} from "./requests";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

const FIELDS: RequestFields = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};

const post = (askerId = "acc-student", now = NOW, fields: RequestFields = FIELDS) =>
  createRequest({ askerId, fields, now });

beforeEach(() => {
  resetSampleStore();
});

describe("reading requests (community actions plan decision 1)", () => {
  it("gives the samples back as part B made them, offers included", () => {
    expect(publicRequest("r-001")).toMatchObject({
      id: "r-001",
      title: "Accounting 1 tutor this week",
      offers: 2,
      status: "open",
    });
    expect(listedRequests()).toHaveLength(14);
    expect(publicRequest("r-015")?.status).toBe("closed");
    expect(publicRequestIds()).toHaveLength(16);
  });

  it("counts offer threads on top of the sample's number (spec 2.11)", () => {
    const { conversations } = sampleStore();
    const offer = { ...structuredClone(conversations.get("conv-s1")!), id: "conv-offer", requestId: "r-001" };
    conversations.set(offer.id, offer);
    expect(publicRequest("r-001")?.offers).toBe(3);
  });

  it("leaves a hidden request out of every list, and gives it no page", async () => {
    await hideRequest("r-001", "Not allowed on Vossie.", NOW);
    expect(publicRequest("r-001")).toBeNull();
    expect(listedRequests().map((request) => request.id)).not.toContain("r-001");
    expect(publicRequestIds()).not.toContain("r-001");
  });
});

describe("the asker's own requests (spec 2.3, 2.6 and 2.13)", () => {
  it("posts an open request with a new id and no sample offers, on the board straight away", async () => {
    const posted = await post();
    expect(posted.id).toMatch(/^r-[0-9a-f-]{36}$/);
    expect(posted).toMatchObject({ ...FIELDS, offers: 0, status: "open", createdAt: NOW.toISOString() });
    expect(listedRequests().map((request) => request.id)).toContain(posted.id);
    expect(sampleStore().requests.get(posted.id)?.askerId).toBe("acc-student");
  });

  it("is the asker's alone: anyone else gets nothing and changes nothing", async () => {
    const { id } = await post();
    expect(await getOwnRequest("acc-student", id)).toMatchObject({ state: "open", hiddenReason: null });
    expect(await getOwnRequest("acc-mentor", id)).toBeNull();
    expect(await getOwnRequest("acc-student", "r-001")).toBeNull();
    expect(await updateRequest("acc-mentor", id, { ...FIELDS, title: "Mine now" }, NOW)).toBeNull();
    expect(await setRequestOpen("acc-mentor", id, false, NOW)).toBeNull();
    expect(await deleteRequest("acc-mentor", id)).toBe(false);
    expect(publicRequest(id)?.title).toBe("Desk lamp for res");
  });

  it("edits only while open, and closes and reopens (spec 2.6)", async () => {
    const { id } = await post();
    expect(await updateRequest("acc-student", id, { ...FIELDS, title: "Clip-on desk lamp" }, later(5))).toMatchObject({
      title: "Clip-on desk lamp",
    });
    expect(await setRequestOpen("acc-student", id, false, later(10))).toMatchObject({ status: "closed" });
    expect(sampleStore().requests.get(id)?.closedAt).toBe(later(10).toISOString());
    expect(listedRequests().map((request) => request.id)).not.toContain(id);
    expect(publicRequest(id)?.status).toBe("closed");
    expect(await setRequestOpen("acc-student", id, false, later(11))).toBeNull();
    expect(await updateRequest("acc-student", id, FIELDS, later(12))).toBeNull();
    expect(await setRequestOpen("acc-student", id, true, later(13))).toMatchObject({ status: "open" });
    expect(sampleStore().requests.get(id)?.closedAt).toBeNull();
  });

  it("deletes it: its page goes, and so does the Hub's notification about it", async () => {
    const { id } = await post();
    await notify({ accountId: "acc-student", kind: "request-update", subjectId: id, text: "Hid it.", href: "/", now: NOW });
    expect(await deleteRequest("acc-student", id)).toBe(true);
    expect(publicRequest(id)).toBeNull();
    expect((await getNotifications("acc-student", 50)).map((item) => item.text)).not.toContain("Hid it.");
  });

  it("lists Your requests: open, then closed, then hidden, each newest first (plan decision 18)", async () => {
    const first = await post("acc-student", later(1));
    const second = await post("acc-student", later(2));
    const third = await post("acc-student", later(3));
    const fourth = await post("acc-student", later(4));
    await setRequestOpen("acc-student", first.id, false, later(5));
    await hideRequest(second.id, "Spam.", later(6));
    const own = await listOwnRequests("acc-student");
    expect(own.map((item) => [item.request.id, item.state])).toEqual([
      [fourth.id, "open"],
      [third.id, "open"],
      [first.id, "closed"],
      [second.id, "hidden"],
    ]);
    expect(own[3].hiddenReason).toBe("Spam.");
  });

  it("counts open ones, and the last 24 hours' posts, for the limits (plan decision 4)", async () => {
    const old = await post("acc-student", new Date("2026-10-13T08:00:00.000Z"));
    await post("acc-student", later(1));
    const closed = await post("acc-student", later(2));
    await setRequestOpen("acc-student", closed.id, false, later(3));
    expect(await countOpenRequests("acc-student")).toBe(2);
    expect(await countRequestsSince("acc-student", new Date(later(3).getTime() - 24 * 60 * 60 * 1000))).toBe(2);
    await hideRequest(old.id, "Spam.", later(4));
    expect(await countOpenRequests("acc-student")).toBe(1);
    expect(await countOpenRequests("acc-mentor")).toBe(0);
  });
});

describe("the Hub hiding a request (spec 2.14)", () => {
  it("hides it once, with its reason, and says who asked; the asker can delete it, not close it", async () => {
    const { id } = await post();
    expect(await hideRequest(id, "Selling exam answers.", later(1))).toEqual({
      id,
      title: "Desk lamp for res",
      askerId: "acc-student",
    });
    expect(await hideRequest(id, "Again.", later(2))).toBeNull();
    expect(await hideRequest("r-nope", "No.", later(2))).toBeNull();
    expect(await setRequestOpen("acc-student", id, false, later(3))).toBeNull();
    expect(await getOwnRequest("acc-student", id)).toMatchObject({ state: "hidden", hiddenReason: "Selling exam answers." });
    expect(await deleteRequest("acc-student", id)).toBe(true);
  });

  it("hides a sample request, which has no asker", async () => {
    expect(await hideRequest("r-002", "Not allowed.", NOW)).toEqual({
      id: "r-002",
      title: "Graphic calculator to borrow for exams",
      askerId: null,
    });
  });
});

describe("deleting an account, and its data export (spec 2.23, plan decision 21)", () => {
  it("removes only that account's requests", async () => {
    await post("acc-student");
    await post("acc-mentor");
    await forgetRequestsOf("acc-student");
    expect(await listOwnRequests("acc-student")).toEqual([]);
    expect(await listOwnRequests("acc-mentor")).toHaveLength(1);
    expect(sampleStore().requests.size).toBe(17);
  });

  it("exports the account's requests by name, with no ids", async () => {
    const { id } = await post("acc-student", NOW, { ...FIELDS, neededBy: "2026-10-20" });
    await setRequestOpen("acc-student", id, false, later(1));
    expect(await exportRequests("acc-student")).toEqual([
      {
        title: "Desk lamp for res",
        category: "Res & living",
        campus: "Midrand",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: 150,
        swapWelcome: false,
        neededBy: "2026-10-20",
        state: "closed",
        hubReason: null,
        postedAt: NOW.toISOString(),
        closedAt: later(1).toISOString(),
        offers: 0,
      },
    ]);
    expect(await exportRequests("acc-mentor")).toEqual([]);
  });
});
```

In `lib/data/index.test.ts`, add `createRequest` and `hideRequest` from `./requests` to the imports (in alphabetical order among the `./…` imports), and add this test at the end of the "Looking For data (community spec 4.3)" `describe`:

```ts

  it("reads requests from the store: a new one is listed, a hidden one isn't (community actions plan decision 1)", async () => {
    const fields = {
      title: "Desk lamp for res",
      categorySlug: "res-living",
      campusSlug: "mbombela",
      details: "A lamp that clips onto a desk, by the weekend.",
      budgetZar: null,
      swapWelcome: true,
      neededBy: null,
    };
    const posted = await createRequest({ askerId: "acc-student", fields, now: new Date("2026-10-14T08:42:00.000Z") });
    expect(ids(await getRequests({ campus: "mbombela", limit: 3 }))).toEqual([posted.id, "r-001", "r-002"]);
    expect(ids(await getOpenRequests({ category: "res-living" }))).toContain(posted.id);
    expect((await getRequest(posted.id))?.title).toBe("Desk lamp for res");
    await hideRequest("r-001", "Not allowed.", new Date("2026-10-14T09:00:00.000Z"));
    expect(await getRequest("r-001")).toBeNull();
    expect(await getRequestIds()).not.toContain("r-001");
  });
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/data/requests.test.ts lib/data/notifications.test.ts lib/data/index.test.ts`
Expected: FAIL: `./requests` doesn't exist, and there's no `deleteNotificationsAbout`.

- [ ] **Step 4: The tag**

In `lib/data/tags.ts` (F Task 4, G Task 4), add after `SELLERS_TAG` (keep G's tags where they are):

```ts
export const REQUESTS_TAG = "requests";
```

and append:

```ts

/** For a cached function that returns requests (community actions plan decision 1). Offer counts are in them too. */
export function tagRequests(): void {
  cacheTag(REQUESTS_TAG);
}

/** After a request, or its offers, change. Server Actions only. */
export function requestsChanged(): void {
  updateTag(REQUESTS_TAG);
}
```

- [ ] **Step 5: Notifications about things that have gone**

In `lib/data/notifications.ts`, append:

```ts

/**
 * Everyone's notifications of one kind about things that have gone (community actions plan decisions 6 and 21): a
 * deleted request's update, or the new listings of a shop that has gone. They would only lead to a page that 404s.
 */
export async function deleteNotificationsAbout(kind: NotificationKind, subjectIds: ReadonlySet<string>): Promise<void> {
  const { notifications } = sampleStore();
  for (const [id, row] of notifications) {
    if (row.kind === kind && subjectIds.has(row.subjectId)) notifications.delete(id);
  }
}
```

- [ ] **Step 6: Write the requests**

Create `lib/data/requests.ts`:

```ts
import { randomUUID } from "node:crypto";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import type { RequestFields } from "@/lib/looking-for/rules";
import type { LookingForRequest, OwnRequest, RequestState } from "@/lib/types";
import { deleteNotificationsAbout } from "./notifications";
import type { RequestRow } from "./rows";
import { sampleStore } from "./store";

// Looking For requests in the sample store (community actions spec 2.1, 2.6, 2.11, 2.14 and 2.23; plan decisions 1,
// 4, 6, 10 and 21). Plain functions over the store: lib/data/index.ts wraps the public reads in "use cache", tagged
// "requests"; Server Actions call the writes, then requestsChanged(). The asker is never part of what buyers see.
// Times come from the caller; only Server Actions call createRequest, which makes ids.

/** A request's offers: its offer threads (spec 2.7), whatever state they're in, a shop that has left included. */
function offerThreadCount(requestId: string): number {
  let count = 0;
  for (const row of sampleStore().conversations.values()) {
    if (row.requestId === requestId) count += 1;
  }
  return count;
}

/** A row as part B's LookingForRequest. The offers count is the offer threads plus the sample's number (spec 2.11). */
function toRequest(row: RequestRow): LookingForRequest {
  return {
    id: row.id,
    title: row.title,
    campusSlug: row.campusSlug,
    offers: row.seedOffers + offerThreadCount(row.id),
    details: row.details,
    categorySlug: row.categorySlug,
    budgetZar: row.budgetZar,
    swapWelcome: row.swapWelcome,
    neededBy: row.neededBy,
    createdAt: row.createdAt,
    status: row.status,
  };
}

const notHidden = (row: RequestRow) => row.hiddenAt === null;

function stateOf(row: RequestRow): RequestState {
  return row.hiddenAt !== null ? "hidden" : row.status;
}

function toOwn(row: RequestRow): OwnRequest {
  return { request: toRequest(row), state: stateOf(row), hiddenReason: row.hiddenReason };
}

/** The board's and the homepage's: open and not hidden, in the store's order (plan decision 1). */
export function listedRequests(): LookingForRequest[] {
  return [...sampleStore().requests.values()].filter((row) => row.status === "open" && notHidden(row)).map(toRequest);
}

/** A request's page: anything not hidden, open or closed (spec 2.14). */
export function publicRequest(id: string): LookingForRequest | null {
  const row = sampleStore().requests.get(id);
  return row && notHidden(row) ? toRequest(row) : null;
}

/** Every request with a page, for prerendering and the sitemap. */
export function publicRequestIds(): string[] {
  return [...sampleStore().requests.values()].filter(notHidden).map((row) => row.id);
}

/** The asker's own request, or null when it isn't theirs or doesn't exist (their pages then answer 404). */
export async function getOwnRequest(askerId: string, id: string): Promise<OwnRequest | null> {
  const row = sampleStore().requests.get(id);
  return row && row.askerId === askerId ? toOwn(row) : null;
}

const ORDER: Readonly<Record<RequestState, number>> = { open: 0, closed: 1, hidden: 2 };

/** Your requests (spec 2.13, plan decision 18): open, then closed, then hidden, each newest first. */
export async function listOwnRequests(askerId: string): Promise<OwnRequest[]> {
  return [...sampleStore().requests.values()]
    .filter((row) => row.askerId === askerId)
    .sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || b.createdAt.localeCompare(a.createdAt))
    .map(toOwn);
}

/** How many of the account's requests are open (not hidden), for the limit of 5 (spec 2.5). */
export async function countOpenRequests(askerId: string): Promise<number> {
  return [...sampleStore().requests.values()].filter((row) => row.askerId === askerId && stateOf(row) === "open")
    .length;
}

/** How many of the account's requests made since `since` are still in the store (plan decision 4). */
export async function countRequestsSince(askerId: string, since: Date): Promise<number> {
  return [...sampleStore().requests.values()].filter(
    (row) => row.askerId === askerId && Date.parse(row.createdAt) > since.getTime(),
  ).length;
}

/** A new, open request (spec 2.3). Server Actions only: it makes ids. */
export async function createRequest({
  askerId,
  fields,
  now,
}: {
  askerId: string;
  fields: RequestFields;
  now: Date;
}): Promise<LookingForRequest> {
  const at = now.toISOString();
  const row: RequestRow = {
    id: `r-${randomUUID()}`,
    askerId,
    ...fields,
    status: "open",
    createdAt: at,
    updatedAt: at,
    closedAt: null,
    seedOffers: 0,
    hiddenAt: null,
    hiddenReason: null,
  };
  sampleStore().requests.set(row.id, row);
  return toRequest(row);
}

/** The asker's row, when it's in `state` (spec 2.6, plan decision 6). */
function ownRow(askerId: string, id: string, state: RequestState): RequestRow | null {
  const row = sampleStore().requests.get(id);
  return row && row.askerId === askerId && stateOf(row) === state ? row : null;
}

/** Edit (spec 2.6): only while it's open. Null when it isn't the asker's open request. */
export async function updateRequest(
  askerId: string,
  id: string,
  fields: RequestFields,
  now: Date,
): Promise<LookingForRequest | null> {
  const row = ownRow(askerId, id, "open");
  if (!row) return null;
  Object.assign(row, fields, { updatedAt: now.toISOString() });
  return toRequest(row);
}

/** Close (`open` false) or Reopen (`open` true) (spec 2.6). Null when there was nothing to do. */
export async function setRequestOpen(
  askerId: string,
  id: string,
  open: boolean,
  now: Date,
): Promise<LookingForRequest | null> {
  const row = ownRow(askerId, id, open ? "closed" : "open");
  if (!row) return null;
  row.status = open ? "open" : "closed";
  row.closedAt = open ? null : now.toISOString();
  row.updatedAt = now.toISOString();
  return toRequest(row);
}

/**
 * Delete (spec 2.6), in any state: the request goes, so its page 404s, and so does the Hub's notification about it.
 * Its offer threads stay, with its title (requestTitle) and "This request was removed." False when it isn't the asker's.
 */
export async function deleteRequest(askerId: string, id: string): Promise<boolean> {
  const { requests } = sampleStore();
  const row = requests.get(id);
  if (!row || row.askerId !== askerId) return false;
  requests.delete(id);
  await deleteNotificationsAbout("request-update", new Set([id]));
  return true;
}

/** What hiding a request tells the action: its title for the log, and the asker to tell (null for a sample). */
export type HiddenRequest = { id: string; title: string; askerId: string | null };

/** The Hub's Hide the request (spec 2.14): it leaves every list and its page 404s. Null when it's gone or hidden already. */
export async function hideRequest(id: string, reason: string, now: Date): Promise<HiddenRequest | null> {
  const row = sampleStore().requests.get(id);
  if (!row || row.hiddenAt !== null) return null;
  row.hiddenAt = now.toISOString();
  row.hiddenReason = reason;
  row.updatedAt = now.toISOString();
  return { id: row.id, title: row.title, askerId: row.askerId };
}

/** Deleting an account (spec 2.23): its requests go. Their offer threads follow messaging's rules. */
export async function forgetRequestsOf(accountId: string): Promise<void> {
  const { requests } = sampleStore();
  for (const [id, row] of requests) {
    if (row.askerId === accountId) requests.delete(id);
  }
}

/** A request in the account's data export (plan decision 21). No ids. */
export type RequestExport = {
  title: string;
  category: string;
  campus: string;
  details: string;
  budgetZar: number | null;
  swapWelcome: boolean;
  neededBy: string | null;
  state: RequestState;
  /** The Hub's reason, when it hid it. */
  hubReason: string | null;
  postedAt: string;
  closedAt: string | null;
  offers: number;
};

const categoryName = (slug: string) => categories.find((category) => category.slug === slug)?.name ?? slug;
const campusName = (slug: string) => campuses.find((campus) => campus.slug === slug)?.name ?? slug;

/** The account's requests for its data export, newest first. */
export async function exportRequests(accountId: string): Promise<RequestExport[]> {
  return [...sampleStore().requests.values()]
    .filter((row) => row.askerId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((row) => ({
      title: row.title,
      category: categoryName(row.categorySlug),
      campus: campusName(row.campusSlug),
      details: row.details,
      budgetZar: row.budgetZar,
      swapWelcome: row.swapWelcome,
      neededBy: row.neededBy,
      state: stateOf(row),
      hubReason: row.hiddenReason,
      postedAt: row.createdAt,
      closedAt: row.closedAt,
      offers: row.seedOffers + offerThreadCount(row.id),
    }));
}
```

- [ ] **Step 7: The data layer reads them**

In `lib/data/index.ts`:
1. Delete `import { requests } from "@/data/fixtures/requests";`. Add `import { listedRequests, publicRequest, publicRequestIds } from "./requests";` among the `./…` imports, and add `tagRequests` to the `./tags` import, in alphabetical order.
2. Delete the `openRequests` function and its comment (`/** Open requests only: closed ones never appear in lists (community spec 4.3). */`).
3. Replace these four functions' bodies as shown (each keeps its comment, except where the comment is given; only the lines inside change):

```ts
export async function getRequests({ campus, limit }: CampusQuery): Promise<readonly LookingForRequest[]> {
  "use cache";
  tagRequests();
  return campusFirst(listedRequests().sort(newestFirst), campus, limit);
}
```

```ts
export async function getOpenRequests({ category }: { category: string | null }): Promise<readonly LookingForRequest[]> {
  "use cache";
  tagRequests();
  return listedRequests()
    .filter((request) => category === null || request.categorySlug === category)
    .sort(newestFirst);
}
```

```ts
/** A request's page (community spec 4.2), open or closed; a hidden one has none (community actions spec 2.14). */
export async function getRequest(id: string): Promise<LookingForRequest | null> {
  "use cache";
  tagRequests();
  return publicRequest(id);
}
```

```ts
/** Every request with a page, so each is prerendered (community spec 3); a new one renders on its first request. */
export async function getRequestIds(): Promise<readonly string[]> {
  "use cache";
  tagRequests();
  return publicRequestIds();
}
```

4. In the file's opening comment (F's wording "Listings and sellers come from the sample store, through lib/data/catalog.ts"), add after that sentence: "Requests come from it too, through lib/data/requests.ts, tagged `requests` (community actions plan decision 1)."

Then find the other tests that read requests through the data layer: `grep -rl -e "getRequests" -e "getOpenRequests" -e "getRequestIds" -e "getRequest(" app components lib | grep "\.test\."`. In each one that calls a real request function (not only a `vi.mock` stand-in) and has no `resetSampleStore()` in a `beforeEach`, add `import { resetSampleStore } from "@/lib/data/store";` (in alphabetical order among the `@/…` imports), add `beforeEach` to its `vitest` import, and add straight after the imports and `vi.mock(…)` calls:

```ts

// Requests come from the sample store (community actions plan decision 1). A fresh one for each test.
beforeEach(() => {
  resetSampleStore();
});
```

When this plan was written, those were `app/sitemap.test.ts`, `components/home/LookingForRequests.test.tsx`, `components/looking-for/RequestBoard.test.tsx`, `components/looking-for/RequestRow.test.tsx`, `components/looking-for/RequestView.test.tsx` and `components/looking-for/RelatedListings.test.tsx`.

- [ ] **Step 8: Run them to make sure they pass**

Run: `pnpm test lib/data components/home components/looking-for app/sitemap.test.ts`
Expected: PASS, part B's request tests unchanged (the store gives back exactly the fixtures' requests).

- [ ] **Step 9: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 15 more unit tests than after Task 2.

- [ ] **Step 10: Hand over for commit**

Files: `lib/data/tags.ts`, `lib/data/notifications.ts`, `lib/data/notifications.test.ts`, `lib/data/requests.ts`, `lib/data/requests.test.ts`, `lib/data/index.ts`, `lib/data/index.test.ts`, and each test file Step 7 changed.
Message: `feat: Looking For requests move into the sample store, tagged "requests": the board, the homepage, request pages and the sitemap read them; posting, editing, closing, reopening, deleting and hiding them; offers counted from offer threads (community actions spec 2.1, 2.6, 2.11 and 2.14)`

---

### Task 4: Offers are E conversations

An offer is the first message of an E conversation that the shop starts (spec 2.7 to 2.12; plan decisions 8 to 11): `startOffer` in E's `lib/data/messages.ts`, the status `offered` until the asker writes, the shop waiting for that reply, the asker unnamed to the shop until then, E's lookup skipping offer threads, the thread and inbox knowing their request, and F's counting leaving them out of enquiries. `lib/data/offers.ts` reads them for the asker's panel and the limits.

**Files:**
- Modify: `lib/types.ts`
- Modify: `tests/helpers/fakes.ts`
- Create: `lib/data/offers.ts`, `lib/data/offers.test.ts`
- Modify: `lib/data/messages.ts`, `lib/data/messages.test.ts`
- Modify: `lib/data/shop-stats.ts`, `lib/data/shop-stats.test.ts`

- [ ] **Step 1: The thread and the inbox know their request**

In `lib/types.ts`:
1. In E's `ConversationSummary`, after `listingTitle: string | null;`, add:

```ts
  /** The request an offer answers (community actions spec 2.7), or null for any other conversation. */
  requestTitle: string | null;
```

2. In E's `Thread`, after `listing: Listing | null;`, add:

```ts
  /**
   * The request an offer answers, or null for any other conversation (community actions spec 2.7). `live` is false
   * once its page has gone (deleted or hidden), and the thread then says so (plan decision 8).
   */
  request: { id: string; title: string; live: boolean } | null;
```

In `tests/helpers/fakes.ts`, in E's `makeThread`'s returned object add `request: null,` straight after its `listing: …` line, and in E's `makeSummary`'s returned object add `requestTitle: null,` straight after its `listingTitle: …` line.

Run: `pnpm typecheck`
Expected: FAIL only in `lib/data/messages.ts` (its `getInbox` and `getThread` don't give the new fields yet). If anything else that builds a `Thread` or a `ConversationSummary` fails, add `request: null` or `requestTitle: null` there the same way and say so in the hand-over.

- [ ] **Step 2: Write the offers' tests**

Create `lib/data/offers.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { forgetAccountInMessaging, startOffer, type NewOffer } from "./messages";
import { countOffersSince, findOffer, offersForRequest } from "./offers";
import { resetSampleStore } from "./store";

const at = (hour: number) => new Date(`2026-10-14T${String(hour).padStart(2, "0")}:00:00.000Z`);

const offer = (overrides: Partial<NewOffer> = {}) =>
  startOffer({
    askerId: "acc-student",
    request: { id: "r-001", title: "Accounting 1 tutor this week" },
    sellerSlug: "tech-corner",
    listing: null,
    body: "I passed Accounting 1 with 78%.\nEvenings work for me.",
    now: at(8),
    ...overrides,
  });

beforeEach(() => {
  resetSampleStore();
});

describe("offers on a request (community actions spec 2.9 and 2.13)", () => {
  it("finds a shop's offer on a request, while the shop is there to answer it", async () => {
    const id = await offer();
    expect(await findOffer("r-001", "tech-corner")).toBe(id);
    expect(await findOffer("r-001", "code-coach")).toBeNull();
    expect(await findOffer("r-002", "tech-corner")).toBeNull();
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    expect(await findOffer("r-001", "tech-corner")).toBeNull();
  });

  it("lists them for the asker, newest first, with the shop, the offer's first line and when", async () => {
    const first = await offer({ now: at(8) });
    const second = await offer({ sellerSlug: "code-coach", body: "Two past papers, R250.", now: at(9) });
    expect(await offersForRequest("r-001")).toEqual([
      { conversationId: second, shopName: "Code coach", preview: "Two past papers, R250.", offeredAt: at(9).toISOString() },
      {
        conversationId: first,
        shopName: "Tech corner",
        preview: "I passed Accounting 1 with 78%.",
        offeredAt: at(8).toISOString(),
      },
    ]);
    expect(await offersForRequest("r-002")).toEqual([]);
  });

  it("counts a shop's offers since a time, for the daily limit (plan decision 4)", async () => {
    await offer({ request: { id: "r-001", title: "Accounting 1 tutor this week" }, now: at(6) });
    await offer({ request: { id: "r-003", title: "Birthday cake for Friday" }, now: at(9) });
    expect(await countOffersSince("tech-corner", at(7))).toBe(1);
    expect(await countOffersSince("tech-corner", at(5))).toBe(2);
    expect(await countOffersSince("code-coach", at(5))).toBe(0);
  });
});
```

(`code-coach` is a sample shop with no owner; its name in `data/fixtures/sellers.ts` is "Code coach". If the fixture spells it differently, use the fixture's name.)

In `lib/data/messages.test.ts`, add to the imports (in alphabetical order, merging with what's there): `startOffer` and `type NewOffer` from `./messages`, `getNotifications` from `./notifications`, and `sampleStore` from `./store`. Then add at the end of the file:

```ts

describe("offers on Looking For requests (community actions spec 2.7 to 2.12)", () => {
  const OFFER_NOW = new Date("2026-10-14T08:42:00.000Z");
  const offer = (overrides: Partial<NewOffer> = {}) =>
    startOffer({
      askerId: "acc-student",
      request: { id: "r-001", title: "Accounting 1 tutor this week" },
      sellerSlug: "tech-corner",
      listing: null,
      body: "I passed Accounting 1 with 78%. Evenings work.",
      now: OFFER_NOW,
      ...overrides,
    });
  const messagesIn = (id: string) => [...sampleStore().messages.values()].filter((row) => row.conversationId === id);

  it("starts an Offered thread holding the shop's message, and tells the asker", async () => {
    const id = await offer();
    expect(sampleStore().conversations.get(id)).toMatchObject({
      status: "offered",
      buyerId: "acc-student",
      sellerSlug: "tech-corner",
      listingId: null,
      requestId: "r-001",
      requestTitle: "Accounting 1 tutor this week",
    });
    const thread = await getThread(id, "acc-student", OFFER_NOW);
    expect(thread).toMatchObject({
      role: "buyer",
      otherName: "Tech corner",
      status: "offered",
      request: { id: "r-001", title: "Accounting 1 tutor this week", live: true },
    });
    expect(thread?.messages).toMatchObject([
      { fromViewer: false, author: "Tech corner", body: "I passed Accounting 1 with 78%. Evenings work." },
    ]);
    expect((await getNotifications("acc-student", 1))[0]).toMatchObject({
      kind: "offer",
      text: "Tech corner offered to help with Accounting 1 tutor this week",
      href: `/messages/${id}`,
    });
  });

  it("makes one per shop per request: a second offer changes nothing", async () => {
    const id = await offer();
    expect(await offer({ body: "Me again." })).toBe(id);
    expect(messagesIn(id)).toHaveLength(1);
  });

  it("can point to one of the shop's listings, shown as the thread's listing", async () => {
    const id = await offer({ listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" } });
    expect((await getThread(id, "acc-student", OFFER_NOW))?.listing?.id).toBe("l-001");
  });

  it("keeps the asker unnamed to the shop until they write, then uses their first name (spec 2.10)", async () => {
    const id = await offer();
    expect((await getThread(id, "acc-seller", OFFER_NOW))?.otherName).toBe("The student who asked");
    expect((await getInbox("acc-seller", "selling", OFFER_NOW)).find((row) => row.id === id)).toMatchObject({
      otherName: "The student who asked",
      requestTitle: "Accounting 1 tutor this week",
      status: "offered",
    });
    expect(await sendMessage({ conversationId: id, accountId: "acc-student", body: "Yes please!", now: OFFER_NOW })).toBe(
      "sent",
    );
    expect((await getThread(id, "acc-seller", OFFER_NOW))?.otherName).toBe("Thandi");
  });

  it("makes the shop wait for a reply, which moves Offered to Replied; only then can it be marked completed", async () => {
    const id = await offer();
    const shop = { conversationId: id, accountId: "acc-seller", now: OFFER_NOW };
    expect(await sendMessage({ ...shop, body: "Still keen?" })).toBe("waiting");
    expect(messagesIn(id)).toHaveLength(1);
    expect(await markCompleted(shop)).toBe("not-allowed");
    await sendMessage({ conversationId: id, accountId: "acc-student", body: "Yes, Thursday.", now: OFFER_NOW });
    expect(sampleStore().conversations.get(id)?.status).toBe("replied");
    expect((await getNotifications("acc-seller", 1))[0].text).toBe("Thandi replied about Accounting 1 tutor this week");
    expect(await sendMessage({ ...shop, body: "Great, 18:00 at the library." })).toBe("sent");
    expect(await markCompleted(shop)).toBe("done");
    expect((await getNotifications("acc-student", 1))[0].text).toBe(
      "Tech corner marked Accounting 1 tutor this week as done. Did the sale happen?",
    );
  });

  it("is never found as an enquiry or a shop question (spec 2.9)", async () => {
    await offer({ askerId: "acc-mentor", listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" } });
    expect(await findConversation("acc-mentor", { kind: "listing", listingId: "l-001" })).toBeNull();
    expect(await findConversation("acc-mentor", { kind: "shop", sellerSlug: "tech-corner" })).toBeNull();
  });

  it("says when the request has gone, keeping its title", async () => {
    const id = await offer({ askerId: "acc-mentor" });
    sampleStore().requests.delete("r-001");
    expect((await getThread(id, "acc-mentor", OFFER_NOW))?.request).toEqual({
      id: "r-001",
      title: "Accounting 1 tutor this week",
      live: false,
    });
  });

  it("names the request in both sides' data exports, and the asker not at all", async () => {
    await offer();
    expect(
      (await exportConversations("acc-seller", OFFER_NOW)).find((row) => row.about === "Request: Accounting 1 tutor this week"),
    ).toMatchObject({ with: "The student who asked", status: "offered" });
    expect(
      (await exportConversations("acc-student", OFFER_NOW)).find(
        (row) => row.about === "Your request: Accounting 1 tutor this week",
      ),
    ).toMatchObject({ with: "Tech corner" });
  });
});
```

(The file already imports `findConversation`, `getInbox`, `getThread`, `sendMessage`, `markCompleted` and `exportConversations` for E's tests; add any it doesn't.)

In `lib/data/shop-stats.test.ts`, add `sampleStore` to the import from `./store` if it isn't there, and add at the end of the file:

```ts

describe("offers and the shop's numbers (community actions spec 2.12)", () => {
  it("leaves offer threads out of enquiries and the reply rate, and counts their confirmed sales", async () => {
    const now = new Date("2026-10-14T08:42:00.000Z");
    const before = await shopStats("tech-corner", now);
    const at = "2026-10-13T08:00:00.000Z";
    sampleStore().conversations.set("conv-offer-test", {
      id: "conv-offer-test",
      listingId: "l-001",
      listingTitle: "Casio fx-991ZA Plus calculator",
      sellerSlug: "tech-corner",
      buyerId: "acc-student",
      sellerGone: false,
      status: "confirmed",
      createdAt: at,
      lastMessageAt: at,
      firstReplyAt: at,
      completedAt: at,
      confirmedAt: "2026-10-13T12:00:00.000Z",
      confirmedBy: "buyer",
      requestId: "r-001",
      requestTitle: "Accounting 1 tutor this week",
    });
    const after = await shopStats("tech-corner", now);
    expect(after.week).toEqual({ ...before.week, salesConfirmed: before.week.salesConfirmed + 1 });
    expect(after.record).toEqual({ ...before.record, salesConfirmed: before.record.salesConfirmed + 1 });
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/data/offers.test.ts lib/data/messages.test.ts lib/data/shop-stats.test.ts`
Expected: FAIL: `./offers` and `startOffer` don't exist, and the offer thread counts as an enquiry.

- [ ] **Step 4: Write the offers' reads**

Create `lib/data/offers.ts`:

```ts
import { firstLine } from "@/lib/messaging/rules";
import type { OfferSummary } from "@/lib/types";
import type { ConversationRow } from "./rows";
import { sampleStore } from "./store";

// Offers on Looking For requests, read from E's conversations (community actions spec 2.7, 2.9 and 2.13; plan
// decisions 4, 10 and 12). Read-only: startOffer in lib/data/messages.ts makes them. Times come from the caller.

const CLOSED_SHOP = "A closed shop";

function offersOn(requestId: string): ConversationRow[] {
  return [...sampleStore().conversations.values()].filter((row) => row.requestId === requestId);
}

/** The shop's offer on this request, while the shop is there to answer it (spec 2.9: one per shop per request). */
export async function findOffer(requestId: string, sellerSlug: string): Promise<string | null> {
  return offersOn(requestId).find((row) => row.sellerSlug === sellerSlug && !row.sellerGone)?.id ?? null;
}

/** The asker's view of a request's offers (spec 2.13): newest first, the shop, the offer's first line and when. */
export async function offersForRequest(requestId: string): Promise<OfferSummary[]> {
  const { messages, sellers } = sampleStore();
  return offersOn(requestId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((row) => {
      const first = [...messages.values()]
        .filter((message) => message.conversationId === row.id && message.from === "seller")
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt))[0];
      const shop = row.sellerGone ? undefined : sellers.get(row.sellerSlug);
      return {
        conversationId: row.id,
        shopName: shop?.name ?? CLOSED_SHOP,
        preview: first ? firstLine(first.body) : "",
        offeredAt: row.createdAt,
      };
    });
}

/** How many offers the shop has made since `since` that are still in the store, for its daily limit (plan decision 4). */
export async function countOffersSince(sellerSlug: string, since: Date): Promise<number> {
  return [...sampleStore().conversations.values()].filter(
    (row) => row.requestId && row.sellerSlug === sellerSlug && Date.parse(row.createdAt) > since.getTime(),
  ).length;
}
```

- [ ] **Step 5: Teach E's conversations about offers**

In `lib/data/messages.ts` (E Tasks 4 and 5, with E's amendments; edit by meaning where the lines have moved):

1. Add these imports, in alphabetical order among the others:

```ts
import { offerAbout, offerNoteText, UNNAMED_ASKER } from "@/lib/looking-for/words";
```

and add `getRequest` to the `./index` import, and `import { findOffer } from "./offers";` among the `./…` imports.

2. In `otherName`, replace its last line `return buyerName(row);` with:

```ts
  // The asker stays unnamed to the shop until they write in the offer's thread (community actions spec 2.10).
  if (row.requestId && row.buyerId && !messagesOf(row.id).some((message) => message.from === "buyer")) {
    return UNNAMED_ASKER;
  }
  return buyerName(row);
```

3. In `tellOtherSide`, change `listingTitle: row.listingTitle` to `listingTitle: row.requestTitle ?? row.listingTitle` (an offer thread is named by its request, plan decision 14). In `markCompleted`, change `saleNoteText({ shop: …, listingTitle: row.listingTitle })` the same way: `listingTitle: row.requestTitle ?? row.listingTitle`.

4. In `findRow`, change `if (row.buyerId !== buyerId || row.sellerGone) continue;` to:

```ts
    // An offer thread is never an enquiry or a shop question (community actions spec 2.9).
    if (row.buyerId !== buyerId || row.sellerGone || row.requestId) continue;
```

5. Straight after the `startConversation` function, add:

```ts

export type NewOffer = {
  /** The request's asker, on the conversation's buyer side. */
  askerId: string;
  request: { id: string; title: string };
  sellerSlug: string;
  /** One of the shop's listings the offer points to, or null (community actions spec 2.9). */
  listing: { id: string; title: string } | null;
  body: string;
  now: Date;
};

/**
 * A shop's offer on a request (community actions spec 2.7 and 2.9): a conversation with the asker on the buyer's side,
 * Offered, holding the shop's message, and an "offer" notification for the asker. One per shop per request: when the
 * shop has offered already, nothing changes and that thread's id comes back. Server Actions only: it makes ids.
 */
export async function startOffer(input: NewOffer): Promise<string> {
  const existing = await findOffer(input.request.id, input.sellerSlug);
  if (existing) return existing;
  const at = input.now.toISOString();
  const row: ConversationRow = {
    id: `conv-${randomUUID()}`,
    listingId: input.listing?.id ?? null,
    listingTitle: input.listing?.title ?? null,
    sellerSlug: input.sellerSlug,
    buyerId: input.askerId,
    sellerGone: false,
    status: "offered",
    createdAt: at,
    lastMessageAt: at,
    firstReplyAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    requestId: input.request.id,
    requestTitle: input.request.title,
  };
  sampleStore().conversations.set(row.id, row);
  addMessage(row, "seller", input.body, null, input.now);
  await notify({
    accountId: input.askerId,
    kind: "offer",
    subjectId: row.id,
    text: offerNoteText((await shopOf(input.sellerSlug)).name, input.request.title),
    href: threadPath(row.id),
    now: input.now,
  });
  return row.id;
}
```

6. Change `export type SendResult = "sent" | "not-found" | "closed";` to `export type SendResult = "sent" | "not-found" | "closed" | "waiting";`, add to `sendMessage`'s comment: `"waiting" when a shop that offered writes again before the asker has replied (community actions spec 2.9).`, and in `sendMessage`, straight after the line `if (!otherSideThere(row, side)) return "closed";`, add:

```ts
  if (side === "seller" && row.status === "offered") return "waiting";
```

and straight after its `addMessage(row, side, body, null, now);` line, add:

```ts
  // The asker's reply turns an offer into a conversation like any other (community actions spec 2.12).
  if (side === "buyer" && row.status === "offered") row.status = "replied";
```

7. In `getInbox`'s returned object, after `listingTitle: row.listingTitle,`, add `requestTitle: row.requestTitle ?? null,`.

8. In `getThread`, replace the `Promise.all([…])` that reads the listing and the shop with one that also reads the request:

```ts
  const [detail, shop, request] = await Promise.all([
    row.listingId ? getListingDetail(row.listingId) : Promise.resolve(null),
    shopOf(row.sellerSlug),
    row.requestId ? getRequest(row.requestId) : Promise.resolve(null),
  ]);
```

and in its returned object, after `listing: detail ? { ...detail.listing } : null,`, add:

```ts
    request: row.requestId ? { id: row.requestId, title: row.requestTitle ?? "", live: request !== null } : null,
```

9. In `ConversationExport`, change the comment on `about` to `/** The listing's title, "Your request: …" or "Request: …" for an offer, or null for a question about the shop. */`, and in `exportConversations` change `about: row.listingTitle,` to:

```ts
        about: row.requestTitle ? offerAbout(side, row.requestTitle) : row.listingTitle,
```

- [ ] **Step 6: Leave offers out of enquiries**

In `lib/data/shop-stats.ts` (F Task 5), in `counts`, change the first line's filter from `row.listingId !== null && Date.parse(row.createdAt) >= enquiriesSince` to:

```ts
  // An offer thread isn't an enquiry: the shop wrote first (community actions spec 2.12). Its sale still counts.
  const enquiries = rows.filter(
    (row) => row.listingId !== null && !row.requestId && Date.parse(row.createdAt) >= enquiriesSince,
  );
```

This one change also covers G's badges (`recalculateBadges` reads `shopStats`) and the mentor numbers (`recentCounts` calls `counts`).

- [ ] **Step 7: Run them to make sure they pass**

Run: `pnpm test lib/data/offers.test.ts lib/data/messages.test.ts lib/data/shop-stats.test.ts`
Expected: PASS, E's and F's existing tests unchanged.

- [ ] **Step 8: Run every check**

Run, one after another: `pnpm typecheck`, `pnpm test`, `pnpm lint`.
Expected: all pass; 12 more unit tests than after Task 3.

- [ ] **Step 9: Hand over for commit**

Files: `lib/types.ts`, `tests/helpers/fakes.ts`, `lib/data/offers.ts`, `lib/data/offers.test.ts`, `lib/data/messages.ts`, `lib/data/messages.test.ts`, `lib/data/shop-stats.ts`, `lib/data/shop-stats.test.ts`, and any file Step 1's type check sent you to.
Message: `feat: offers are conversations the shop starts: Offered until the asker replies, one per shop per request, the asker unnamed until they write, the shop waiting for a reply, kept out of enquiries and the reply rate (community actions spec 2.7 to 2.12)`

---

### Task 5: Follows in the store, and the new-listing notification

Following shops (spec 2.15, 2.17 to 2.19; plan decisions 15 and 21): `lib/data/follows.ts` follows and unfollows (200 at most, never your own shop), lists the shops you follow for Saved, counts a shop's followers for its dashboard, tells followers about a new listing, and forgets an account's follows. E's notifications gain `notifyNewListing`, one per shop per follower per SAST day. F's `moveShop` moves a shop's follows with its link.

**Files:**
- Create: `lib/data/follows.ts`, `lib/data/follows.test.ts`
- Modify: `lib/data/notifications.ts`, `lib/data/notifications.test.ts`
- Modify: `lib/data/shops.ts`, `lib/data/shops.test.ts`

- [ ] **Step 1: Write the tests**

In `lib/data/notifications.test.ts`, add `notifyNewListing` and `markNotificationsRead` to the import from `./notifications` (if they aren't there), and add at the end of the file:

```ts

describe("a followed shop's new listings (community actions spec 2.19, plan decision 15)", () => {
  const SHOP = { accountId: "acc-mentor", sellerSlug: "tech-corner", shopName: "Tech corner" };
  // 10:00 and 18:00 on Wednesday 14 October in SAST, then 00:01 on Thursday.
  const morning = new Date("2026-10-14T08:00:00.000Z");
  const evening = new Date("2026-10-14T16:00:00.000Z");
  const nextDay = new Date("2026-10-14T22:01:00.000Z");
  const newListings = async () =>
    (await getNotifications("acc-mentor", 50)).filter((item) => item.kind === "new-listing");

  it("names the first new listing of the day, linking to it", async () => {
    await notifyNewListing({ ...SHOP, listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" }, now: morning });
    expect(await newListings()).toMatchObject([
      { text: "Tech corner listed Casio fx-991ZA Plus calculator", href: "/listings/l-001", isNew: true },
    ]);
  });

  it("updates it while it's unread, linking to the shop and moving it to the top", async () => {
    await notifyNewListing({ ...SHOP, listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" }, now: morning });
    await notifyNewListing({ ...SHOP, listing: { id: "l-007", title: "Gaming headset, barely used" }, now: evening });
    await notifyNewListing({ ...SHOP, listing: { id: "l-016", title: "Desk lamp" }, now: evening });
    expect(await newListings()).toMatchObject([
      { text: "Tech corner listed 3 new things", href: "/sellers/tech-corner", createdAt: evening.toISOString() },
    ]);
  });

  it("makes no more that day once it's read, and a new one the next SAST day", async () => {
    await notifyNewListing({ ...SHOP, listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" }, now: morning });
    await markNotificationsRead("acc-mentor", morning);
    await notifyNewListing({ ...SHOP, listing: { id: "l-007", title: "Gaming headset, barely used" }, now: evening });
    expect(await newListings()).toHaveLength(1);
    await notifyNewListing({ ...SHOP, listing: { id: "l-016", title: "Desk lamp" }, now: nextDay });
    expect((await newListings()).map((item) => item.text)).toEqual([
      "Tech corner listed Desk lamp",
      "Tech corner listed Casio fx-991ZA Plus calculator",
    ]);
  });
});
```

Create `lib/data/follows.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { listedListings } from "./catalog";
import {
  addFollow,
  countFollowers,
  exportFollowing,
  forgetFollowsOf,
  isFollowing,
  listFollowedShops,
  notifyFollowers,
  removeFollow,
} from "./follows";
import { getNotifications, notifyNewListing } from "./notifications";
import { resetSampleStore, sampleStore } from "./store";

const at = (hour: number) => new Date(`2026-10-14T${String(hour).padStart(2, "0")}:00:00.000Z`);

beforeEach(() => {
  resetSampleStore();
});

describe("following a shop (community actions spec 2.15)", () => {
  it("follows and unfollows a shop with a storefront", async () => {
    expect(await addFollow("acc-student", "tech-corner", at(8))).toBe("followed");
    expect(await isFollowing("acc-student", "tech-corner")).toBe(true);
    expect(await addFollow("acc-student", "tech-corner", at(9))).toBe("already");
    expect(sampleStore().follows.size).toBe(1);
    expect(await removeFollow("acc-student", "tech-corner")).toBe(true);
    expect(await removeFollow("acc-student", "tech-corner")).toBe(false);
    expect(await isFollowing("acc-student", "tech-corner")).toBe(false);
  });

  it("refuses the account's own shop, a shop with no storefront, and a 201st", async () => {
    expect(await addFollow("acc-seller", "tech-corner", at(8))).toBe("own");
    expect(await addFollow("acc-student", "crochet-corner", at(8))).toBe("not-found");
    expect(await addFollow("acc-student", "nope", at(8))).toBe("not-found");
    for (let n = 0; n < 200; n += 1) {
      sampleStore().follows.set(`follow-${n}`, {
        id: `follow-${n}`,
        accountId: "acc-student",
        sellerSlug: `shop-${n}`,
        createdAt: at(7).toISOString(),
      });
    }
    expect(await addFollow("acc-student", "tech-corner", at(8))).toBe("limit");
  });
});

describe("the shops you follow, and your followers (spec 2.17 and 2.18)", () => {
  it("lists them newest first, with their photo, campus, whether they're paused and how many are listed", async () => {
    await addFollow("acc-student", "code-coach", at(8));
    await addFollow("acc-student", "tech-corner", at(9));
    const codeCoachListed = listedListings().filter((listing) => listing.sellerSlug === "code-coach").length;
    expect(await listFollowedShops("acc-student")).toMatchObject([
      { slug: "tech-corner", name: "Tech corner", campusSlug: "midrand", paused: false, listed: 2 },
      { slug: "code-coach", name: "Code coach", campusSlug: "pretoria", paused: false, listed: codeCoachListed },
    ]);
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect((await listFollowedShops("acc-student"))[0]).toMatchObject({ slug: "tech-corner", paused: true, listed: 0 });
  });

  it("counts a shop's followers, never saying who", async () => {
    await addFollow("acc-student", "tech-corner", at(8));
    await addFollow("acc-mentor", "tech-corner", at(9));
    await addFollow("acc-mentor", "code-coach", at(9));
    expect(await countFollowers("tech-corner")).toBe(2);
    expect(await countFollowers("lash-lounge")).toBe(0);
  });

  it("tells each follower about a new listing, and says how many it told (spec 2.19)", async () => {
    await addFollow("acc-student", "tech-corner", at(8));
    await addFollow("acc-mentor", "tech-corner", at(8));
    const told = await notifyFollowers({
      sellerSlug: "tech-corner",
      shopName: "Tech corner",
      listing: { id: "l-new", title: "USB-C charger" },
      now: at(10),
    });
    expect(told).toBe(2);
    expect((await getNotifications("acc-mentor", 1))[0]).toMatchObject({
      kind: "new-listing",
      text: "Tech corner listed USB-C charger",
    });
    expect((await getNotifications("acc-seller", 50)).some((item) => item.kind === "new-listing")).toBe(false);
  });
});

describe("deleting an account, and its data export (spec 2.23, plan decision 21)", () => {
  it("forgets its follows, its shop's followers and their notes about its shop", async () => {
    await addFollow("acc-seller", "code-coach", at(8));
    await addFollow("acc-student", "tech-corner", at(8));
    await addFollow("acc-student", "code-coach", at(8));
    await notifyNewListing({
      accountId: "acc-student",
      sellerSlug: "tech-corner",
      shopName: "Tech corner",
      listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" },
      now: at(9),
    });
    await forgetFollowsOf("acc-seller");
    expect([...sampleStore().follows.values()].map((row) => [row.accountId, row.sellerSlug])).toEqual([
      ["acc-student", "code-coach"],
    ]);
    expect((await getNotifications("acc-student", 50)).some((item) => item.kind === "new-listing")).toBe(false);
  });

  it("exports the shops' names, newest first, with no ids", async () => {
    await addFollow("acc-student", "code-coach", at(8));
    await addFollow("acc-student", "tech-corner", at(9));
    expect(await exportFollowing("acc-student")).toEqual(["Tech corner", "Code coach"]);
    expect(await exportFollowing("acc-mentor")).toEqual([]);
  });
});
```

In `lib/data/shops.test.ts` (F Task 5), add `import { addFollow, isFollowing } from "./follows";` and `import { getNotifications, notifyNewListing } from "./notifications";` among the `./…` imports (alphabetical order), and add at the end of the file:

```ts

describe("a changed link keeps the shop's followers (community actions spec 2.15)", () => {
  it("moves its follows, and its followers' new-listing notifications, with it", async () => {
    const now = new Date("2026-10-14T08:42:00.000Z");
    await addFollow("acc-student", "tech-corner", now);
    const shop = { accountId: "acc-student", sellerSlug: "tech-corner", shopName: "Tech corner", now };
    await notifyNewListing({ ...shop, listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" } });
    await notifyNewListing({ ...shop, listing: { id: "l-007", title: "Gaming headset, barely used" } });
    expect(await changeShopSlug("acc-seller", "tech-corner-mdr", now)).toBe("changed");
    expect(await isFollowing("acc-student", "tech-corner-mdr")).toBe(true);
    expect(await isFollowing("acc-student", "tech-corner")).toBe(false);
    expect((await getNotifications("acc-student", 1))[0]).toMatchObject({
      kind: "new-listing",
      href: "/sellers/tech-corner-mdr",
    });
  });
});
```

(`changeShopSlug` is already imported there for F's tests; add it if not.)

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test lib/data/follows.test.ts lib/data/notifications.test.ts lib/data/shops.test.ts`
Expected: FAIL: `./follows` and `notifyNewListing` don't exist, and `moveShop` leaves follows behind.

- [ ] **Step 3: The new-listing notification**

In `lib/data/notifications.ts`, add these imports, in alphabetical order among the others:

```ts
import { newListingsText, newListingText } from "@/lib/following/rules";
import { sastDate } from "@/lib/time";
```

and append:

```ts

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
  const today = sastDate(now);
  for (const row of sampleStore().notifications.values()) {
    if (row.accountId !== accountId || row.kind !== "new-listing" || row.subjectId !== sellerSlug) continue;
    if (sastDate(new Date(row.createdAt)) !== today) continue;
    if (row.readAt !== null) return;
    const count = (row.count ?? 1) + 1;
    row.count = count;
    row.text = newListingsText(shopName, count);
    row.href = `/sellers/${sellerSlug}`;
    row.createdAt = now.toISOString();
    return;
  }
  add({
    accountId,
    kind: "new-listing",
    subjectId: sellerSlug,
    text: newListingText(shopName, listing.title),
    href: `/listings/${listing.id}`,
    now,
  });
}
```

- [ ] **Step 4: Write the follows**

Create `lib/data/follows.ts`:

```ts
import { randomUUID } from "node:crypto";
import { FOLLOW_LIMIT } from "@/lib/following/rules";
import type { FollowedShop } from "@/lib/types";
import { listedListings, shopStatus, storefrontRow, toSeller } from "./catalog";
import { deleteNotificationsAbout, notifyNewListing } from "./notifications";
import type { FollowRow } from "./rows";
import { sampleStore } from "./store";

// Following shops (community actions spec 2.15 to 2.19 and 2.23; plan decisions 15, 17 and 21). A follow is the
// account, the shop's slug and when; F's moveShop keeps the slug up to date. A shop only ever sees how many follow it.
// Times come from the caller; only Server Actions call addFollow, which makes ids.

export type FollowResult = "followed" | "already" | "own" | "limit" | "not-found";

/** The account's follows, newest first. */
function followsBy(accountId: string): FollowRow[] {
  return [...sampleStore().follows.values()]
    .filter((row) => row.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function followsOf(sellerSlug: string): FollowRow[] {
  return [...sampleStore().follows.values()].filter((row) => row.sellerSlug === sellerSlug);
}

/** Follow (spec 2.15): a shop with a storefront, never the account's own, at most 200. */
export async function addFollow(accountId: string, sellerSlug: string, now: Date): Promise<FollowResult> {
  const shop = storefrontRow(sellerSlug);
  if (!shop) return "not-found";
  if (shop.ownerId === accountId) return "own";
  const mine = followsBy(accountId);
  if (mine.some((row) => row.sellerSlug === sellerSlug)) return "already";
  if (mine.length >= FOLLOW_LIMIT) return "limit";
  const id = `follow-${randomUUID()}`;
  sampleStore().follows.set(id, { id, accountId, sellerSlug, createdAt: now.toISOString() });
  return "followed";
}

/** Unfollow: true when there was a follow to remove. */
export async function removeFollow(accountId: string, sellerSlug: string): Promise<boolean> {
  const { follows } = sampleStore();
  for (const [id, row] of follows) {
    if (row.accountId === accountId && row.sellerSlug === sellerSlug) {
      follows.delete(id);
      return true;
    }
  }
  return false;
}

export async function isFollowing(accountId: string, sellerSlug: string): Promise<boolean> {
  return followsBy(accountId).some((row) => row.sellerSlug === sellerSlug);
}

/**
 * Saved's Shops tab (spec 2.17): the shops the account follows that have a storefront, newest follow first, each with
 * its photo (or its category's picture), campus, whether it's paused, and how many listings buyers can see now.
 */
export async function listFollowedShops(accountId: string): Promise<FollowedShop[]> {
  const listed = new Map<string, number>();
  for (const listing of listedListings()) listed.set(listing.sellerSlug, (listed.get(listing.sellerSlug) ?? 0) + 1);
  return followsBy(accountId).flatMap((follow) => {
    const row = storefrontRow(follow.sellerSlug);
    if (!row) return [];
    const seller = toSeller(row);
    return [
      {
        slug: seller.slug,
        name: seller.name,
        campusSlug: seller.campusSlug,
        image: { ...seller.image },
        paused: shopStatus(row) === "paused",
        listed: listed.get(seller.slug) ?? 0,
      },
    ];
  });
}

/** How many follow the shop: its dashboard's number (spec 2.18). Never who. */
export async function countFollowers(sellerSlug: string): Promise<number> {
  return followsOf(sellerSlug).length;
}

/**
 * Tells the shop's followers about a listing it has just published (spec 2.19), through notifyNewListing's one-a-day
 * rule. How many followers it told.
 */
export async function notifyFollowers({
  sellerSlug,
  shopName,
  listing,
  now,
}: {
  sellerSlug: string;
  shopName: string;
  listing: { id: string; title: string };
  now: Date;
}): Promise<number> {
  const followers = followsOf(sellerSlug);
  for (const follow of followers) {
    await notifyNewListing({ accountId: follow.accountId, sellerSlug, shopName, listing, now });
  }
  return followers.length;
}

/**
 * Deleting an account (spec 2.23, plan decision 21): its follows, the follows of every shop it owns, and those shops'
 * followers' new-listing notifications. Call it before F's forgetShopOf, while the shops still name their owner.
 */
export async function forgetFollowsOf(accountId: string): Promise<void> {
  const store = sampleStore();
  const shops = new Set([...store.sellers.values()].filter((row) => row.ownerId === accountId).map((row) => row.slug));
  for (const [id, row] of store.follows) {
    if (row.accountId === accountId || shops.has(row.sellerSlug)) store.follows.delete(id);
  }
  await deleteNotificationsAbout("new-listing", shops);
}

/** The shops the account follows, by name, newest first, for its data export (plan decision 21). No ids. */
export async function exportFollowing(accountId: string): Promise<string[]> {
  const { sellers } = sampleStore();
  return followsBy(accountId).flatMap((row) => {
    const name = sellers.get(row.sellerSlug)?.name;
    return name ? [name] : [];
  });
}
```

- [ ] **Step 5: A changed link takes its follows along**

In `lib/data/shops.ts` (F Task 5), in `moveShop`, straight after the loop that moves E's reports (`for (const report of store.reports.values()) { … }`), add:

```ts
  // Follows, and followers' new-listing notifications, name the shop by its link too (community actions spec 2.15).
  for (const follow of store.follows.values()) {
    if (follow.sellerSlug === from) follow.sellerSlug = to;
  }
  for (const note of store.notifications.values()) {
    if (note.kind !== "new-listing" || note.subjectId !== from) continue;
    note.subjectId = to;
    if (note.href === `/sellers/${from}`) note.href = `/sellers/${to}`;
  }
```

and add to its comment: "Follows and new-listing notifications go with it (community actions plan decision 15)."

- [ ] **Step 6: Run them to make sure they pass**

Run: `pnpm test lib/data/follows.test.ts lib/data/notifications.test.ts lib/data/shops.test.ts`
Expected: PASS.

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 11 more unit tests than after Task 4.

- [ ] **Step 8: Hand over for commit**

Files: `lib/data/follows.ts`, `lib/data/follows.test.ts`, `lib/data/notifications.ts`, `lib/data/notifications.test.ts`, `lib/data/shops.ts`, `lib/data/shops.test.ts`.
Message: `feat: follows in the sample store: follow and unfollow (200 at most, never your own shop), the shops you follow, a shop's follower count, one new-listing notification per shop per day, and a changed link taking its follows along (community actions spec 2.15 to 2.19)`

---

### Task 6: What deleting an account removes, and what the export gains

POPIA (spec 2.23, plan decision 21): deleting an account removes its requests, its follows, the follows of its shop and those followers' new-listing notifications, before F removes the shop; its offer threads follow E's rules. "Download your data" gains the account's requests and the names of the shops it follows.

**Files:**
- Modify: `lib/data/accounts.ts`, `lib/data/accounts.test.ts`

- [ ] **Step 1: Change the tests first**

In `lib/data/accounts.test.ts` (D Task 3, with E's, F's and G's changes):
1. Add, among the `./…` imports in alphabetical order: `import { addFollow } from "./follows";`, `import { getThread, startOffer } from "./messages";` (merge with an existing `./messages` import) and `import { createRequest } from "./requests";`. Add `sampleStore` to the `./store` import if it isn't there.
2. In the data export test that checks `Object.keys(data!)` (E's list with F's and G's keys), add `"requests"` and `"following"` at the end of the expected keys, after G's `"slotRequests"`.
3. Add at the end of the file:

```ts

describe("community actions in the export and in deletion (community actions spec 2.23, plan decision 21)", () => {
  const NOW = new Date("2026-10-14T08:42:00.000Z");
  const FIELDS = {
    title: "Desk lamp for res",
    categorySlug: "res-living",
    campusSlug: "midrand",
    details: "A lamp that clips onto a desk, by the weekend.",
    budgetZar: 150,
    swapWelcome: false,
    neededBy: null,
  };

  it("exports the account's requests and the names of the shops it follows, with no ids", async () => {
    const posted = await createRequest({ askerId: "acc-student", fields: FIELDS, now: NOW });
    await addFollow("acc-student", "tech-corner", NOW);
    const data = await exportAccountData("acc-student", NOW);
    expect(data?.requests).toMatchObject([{ title: "Desk lamp for res", category: "Res & living", state: "open" }]);
    expect(data?.following).toEqual(["Tech corner"]);
    expect(JSON.stringify(data)).not.toContain(posted.id);
  });

  it("deletes the account's requests and follows, and the follows of its shop", async () => {
    const posted = await createRequest({ askerId: "acc-seller", fields: FIELDS, now: NOW });
    await addFollow("acc-seller", "code-coach", NOW);
    await addFollow("acc-student", "tech-corner", NOW);
    await addFollow("acc-student", "code-coach", NOW);
    await deleteAccountData("acc-seller");
    expect(sampleStore().requests.has(posted.id)).toBe(false);
    expect([...sampleStore().follows.values()].map((row) => [row.accountId, row.sellerSlug])).toEqual([
      ["acc-student", "code-coach"],
    ]);
  });

  it("leaves an offer thread with the shop when the asker goes, with no one to reply to", async () => {
    const id = await startOffer({
      askerId: "acc-student",
      request: { id: "r-001", title: "Accounting 1 tutor this week" },
      sellerSlug: "tech-corner",
      listing: null,
      body: "I passed Accounting 1 and can help this week.",
      now: NOW,
    });
    await deleteAccountData("acc-student");
    expect(await getThread(id, "acc-seller", NOW)).toMatchObject({ otherName: "Deleted account", otherPresent: false });
  });
});
```

Run: `pnpm test lib/data/accounts.test.ts`
Expected: FAIL: the export has no `requests` or `following`, and the requests and follows stay.

- [ ] **Step 2: Teach the account functions**

In `lib/data/accounts.ts`:
1. Add, among the `./…` imports in alphabetical order:

```ts
import { exportFollowing, forgetFollowsOf } from "./follows";
import { exportRequests, forgetRequestsOf, type RequestExport } from "./requests";
```

2. In the `AccountExport` type, add after G's `slotRequests: …;`:

```ts
  /** The Looking For requests the account posted, by name, with no ids (community actions plan decision 21). */
  requests: RequestExport[];
  /** The names of the shops it follows, newest first. A shop never sees who follows it. */
  following: string[];
```

and add to the type's comment: "Community actions add requests and follows."
3. In `exportAccountData`, add straight before the `return {`:

```ts
  const [requests, following] = await Promise.all([exportRequests(accountId), exportFollowing(accountId)]);
```

and add these as the last properties of the returned object, after G's `slotRequests: hub.slotRequests,`:

```ts
    requests,
    following,
```

4. In `deleteAccountData`, straight after E's line `await deleteReportsBy(accountId);`, add:

```ts
  // Then its requests and follows, and its shop's followers, while the shop still names its owner (community actions
  // plan decision 21). Its offer threads have just followed messaging's rules.
  await forgetRequestsOf(accountId);
  await forgetFollowsOf(accountId);
```

and add to its comment: "community actions' requests and follows go before selling's shop."

Run: `pnpm test lib/data/accounts.test.ts`
Expected: PASS.

- [ ] **Step 3: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 3 more unit tests than after Task 5.

- [ ] **Step 4: Hand over for commit**

Files: `lib/data/accounts.ts`, `lib/data/accounts.test.ts`.
Message: `feat: deleting an account removes its requests, its follows and its shop's followers; the data export gains requests and the shops followed (community actions spec 2.23)`

---

### Task 7: The request Server Actions

Post request, Save changes, Close, Reopen and Delete request (spec 2.2 to 2.6; plan decisions 4, 6 and 7), each a plain form's action: identity from the session, the checks on the server, errors and typed values in D's form state, a status line left for the page it lands on, `requestsChanged()` after a write, and F's `done()`. D's account deletion expires the `requests` tag too. The pages that post to these come in Tasks 11, 12 and 15.

**Files:**
- Create: `lib/looking-for/form-state.ts`, `lib/looking-for/form-state.test.ts`
- Create: `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts`
- Modify: `lib/auth/actions.ts`, `lib/auth/account-actions.test.ts`

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` ("Security"), `03-api-reference/04-functions/refresh.md`, `redirect.md` and `03-api-reference/01-directives/use-server.md`. Note: every action is a public endpoint, so check every field and take identity only from the session; `updateTag` and `refresh()` come before `redirect()`, which throws, never inside a `try`; a `"use server"` file may export only async functions.

- [ ] **Step 2: Write the tests**

Create `lib/looking-for/form-state.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeFormState } from "@/lib/auth/form-state";
import { resetSampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { takeNote } from "./form-state";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

describe("status lines (community actions plan decision 7)", () => {
  it("gives a page its status line once, then nothing", async () => {
    await signedInAs(request, "acc-student");
    await writeFormState("request-note:r-1", { errors: [], values: { shop: "Tech corner" }, notice: "posted" }, STAFF_NOW);
    expect(await takeNote("request-note:r-1")).toMatchObject({ notice: "posted", values: { shop: "Tech corner" } });
    expect(await takeNote("request-note:r-1")).toBeNull();
  });

  it("has nothing to give a signed-out visitor", async () => {
    expect(await takeNote("request-note:r-1")).toBeNull();
  });
});
```

Create `lib/looking-for/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import type { RequestFields } from "@/lib/looking-for/rules";
import { createRequest, getOwnRequest } from "@/lib/data/requests";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { closeMyRequest, deleteMyRequest, reopenMyRequest, saveMyRequest } from "./actions";
import { requestFormKey, requestNoteKey, YOUR_REQUESTS_FORM } from "./paths";

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

/** The request form as the browser posts it (spec 2.3). */
const FORM = {
  title: "Desk lamp for res",
  category: "res-living",
  campus: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budget: "R150",
  neededBy: "2026-10-20",
};

const FIELDS: RequestFields = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};

const posted = (askerId = "acc-student") => createRequest({ askerId, fields: FIELDS, now: STAFF_NOW });

describe("Post request (community actions spec 2.3 to 2.5)", () => {
  it("posts it, expires the board, and opens its page with a status line", async () => {
    await asStudent();
    const redirect = await redirectSignalOf(() => saveMyRequest(form({ ...FORM, swap: "yes" })));
    expect(redirect.url).toMatch(/^\/looking-for\/r-[0-9a-f-]{36}$/);
    expect([redirect.type, request.refreshed, request.updatedTags]).toEqual(["replace", true, ["requests"]]);
    const id = redirect.url.split("/").at(-1)!;
    expect(await getOwnRequest("acc-student", id)).toMatchObject({
      state: "open",
      request: { title: "Desk lamp for res", budgetZar: 150, swapWelcome: true, neededBy: "2026-10-20" },
    });
    expect(await readFormState(requestNoteKey(id))).toMatchObject({ notice: "posted" });
  });

  it("keeps what was typed and says what's wrong, storing nothing", async () => {
    await asStudent();
    const redirect = await redirectSignalOf(() =>
      saveMyRequest(form({ ...FORM, title: "Lamp", details: "Call 0821234567 about my lamp please." })),
    );
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/looking-for/new", "replace", false]);
    expect(await readFormState(requestFormKey(null))).toMatchObject({
      errors: ["title-length", "details-contact"],
      values: { title: "Lamp", details: "Call 0821234567 about my lamp please.", budget: "R150", swap: "" },
    });
    expect(sampleStore().requests.size).toBe(16);
  });

  it("stops at 5 open requests, then at 5 posted in a day (spec 2.5, plan decision 4)", async () => {
    await asStudent();
    for (let n = 0; n < 5; n += 1) await posted();
    expect(await redirectOf(() => saveMyRequest(form(FORM)))).toBe("/looking-for/new");
    expect((await readFormState(requestFormKey(null)))?.errors).toEqual(["open-limit"]);
    for (const row of sampleStore().requests.values()) {
      if (row.askerId === "acc-student") row.status = "closed";
    }
    await redirectOf(() => saveMyRequest(form(FORM)));
    expect((await readFormState(requestFormKey(null)))?.errors).toEqual(["daily-limit"]);
  });

  it("sends a signed-out visitor to sign in, storing nothing", async () => {
    expect(await redirectOf(() => saveMyRequest(form(FORM)))).toBe("/login?next=%2Flooking-for%2Fnew");
    expect(sampleStore().requests.size).toBe(16);
  });
});

describe("Save changes (spec 2.6, plan decision 6)", () => {
  it("edits the asker's open request and says so on its page", async () => {
    await asStudent();
    const { id } = await posted();
    expect(await redirectOf(() => saveMyRequest(form({ ...FORM, request: id, title: "Clip-on desk lamp" })))).toBe(
      `/looking-for/${id}`,
    );
    expect((await getOwnRequest("acc-student", id))?.request.title).toBe("Clip-on desk lamp");
    expect(await readFormState(requestNoteKey(id))).toMatchObject({ notice: "saved" });
  });

  it("never edits someone else's request, a sample, or a closed one", async () => {
    await asStudent();
    const theirs = await posted("acc-mentor");
    expect(await redirectOf(() => saveMyRequest(form({ ...FORM, request: theirs.id, title: "Mine now" })))).toBe(
      "/account/requests",
    );
    expect(await redirectOf(() => saveMyRequest(form({ ...FORM, request: "r-001" })))).toBe("/account/requests");
    const mine = await posted();
    sampleStore().requests.get(mine.id)!.status = "closed";
    expect(await redirectOf(() => saveMyRequest(form({ ...FORM, request: mine.id, title: "Changed" })))).toBe(
      `/looking-for/${mine.id}/edit`,
    );
    expect((await getOwnRequest("acc-mentor", theirs.id))?.request.title).toBe("Desk lamp for res");
    expect((await getOwnRequest("acc-student", mine.id))?.request.title).toBe("Desk lamp for res");
  });
});

describe("Close, Reopen and Delete (spec 2.6, plan decisions 6 and 7)", () => {
  it("closes from the request's page and reopens from Your requests, with a status line where it lands", async () => {
    await asStudent();
    const { id } = await posted();
    expect(await redirectOf(() => closeMyRequest(form({ request: id })))).toBe(`/looking-for/${id}`);
    expect((await getOwnRequest("acc-student", id))?.state).toBe("closed");
    expect(await readFormState(requestNoteKey(id))).toMatchObject({ notice: "closed" });
    expect(request.updatedTags).toEqual(["requests"]);
    expect(await redirectOf(() => reopenMyRequest(form({ request: id, from: "list" })))).toBe("/account/requests");
    expect((await getOwnRequest("acc-student", id))?.state).toBe("open");
    expect(await readFormState(YOUR_REQUESTS_FORM)).toMatchObject({ notice: "reopened" });
  });

  it("won't reopen a sixth open request", async () => {
    await asStudent();
    const closed = await posted();
    sampleStore().requests.get(closed.id)!.status = "closed";
    for (let n = 0; n < 5; n += 1) await posted();
    await redirectOf(() => reopenMyRequest(form({ request: closed.id })));
    expect((await getOwnRequest("acc-student", closed.id))?.state).toBe("closed");
    expect(await readFormState(requestNoteKey(closed.id))).toMatchObject({ notice: "reopen-limit" });
  });

  it("changes nothing on someone else's request, and says nothing", async () => {
    await asStudent();
    const theirs = await posted("acc-mentor");
    await redirectOf(() => closeMyRequest(form({ request: theirs.id })));
    expect((await getOwnRequest("acc-mentor", theirs.id))?.state).toBe("open");
    expect(await readFormState(requestNoteKey(theirs.id))).toBeNull();
    expect(request.updatedTags).toEqual([]);
  });

  it("deletes from the confirm page, landing on Your requests; never someone else's", async () => {
    await asStudent();
    const { id } = await posted();
    expect(await redirectOf(() => deleteMyRequest(form({ request: id })))).toBe("/account/requests");
    expect(sampleStore().requests.has(id)).toBe(false);
    expect(await readFormState(YOUR_REQUESTS_FORM)).toMatchObject({ notice: "deleted" });
    const theirs = await posted("acc-mentor");
    await redirectOf(() => deleteMyRequest(form({ request: theirs.id })));
    expect(sampleStore().requests.has(theirs.id)).toBe(true);
  });
});
```

In `lib/auth/account-actions.test.ts` (D Task 6):
1. If the file has no `vi.mock("next/cache", …)`, add after its `vi.mock("next/server", …)` line:

```ts
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
```

2. Add this test at the end of the "deleting the account (accounts spec 2.13)" `describe`:

```ts

  it("expires the board, whose requests and offers counts may have changed (community actions plan decision 10)", async () => {
    await signedInAs("acc-student");
    await redirectOf(() => deleteAccount(form({ confirm: "yes" })));
    expect(request.updatedTags).toContain("requests");
  });
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/looking-for/form-state.test.ts lib/looking-for/actions.test.ts lib/auth/account-actions.test.ts`
Expected: FAIL: `./form-state` and `./actions` don't exist, and deleting an account doesn't expire `requests`.

- [ ] **Step 4: Write the status lines**

Create `lib/looking-for/form-state.ts`:

```ts
import { readFormState } from "@/lib/auth/form-state";
import type { FormStateRow } from "@/lib/data/rows";
import { clearOwnFormState } from "@/lib/messaging/form-state";

// Community actions' status lines (plan decision 7), kept in D's form state like E's "Sent." note.

/**
 * A status line an action left for this page: read and cleared in one go, so it shows once. Null when there's none,
 * or when signed out. Request-time: call it inside <Suspense>.
 */
export async function takeNote(form: string): Promise<FormStateRow | null> {
  const state = await readFormState(form);
  if (!state) return null;
  await clearOwnFormState(form);
  return state;
}
```

- [ ] **Step 5: Write the actions**

Create `lib/looking-for/actions.ts`:

```ts
"use server";

import { redirect, RedirectType } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses, getCategories } from "@/lib/data";
import {
  countOpenRequests,
  countRequestsSince,
  createRequest,
  deleteRequest,
  getOwnRequest,
  setRequestOpen,
  updateRequest,
} from "@/lib/data/requests";
import { requestsChanged } from "@/lib/data/tags";
import { clearOwnFormState } from "@/lib/messaging/form-state";
import { isId } from "@/lib/messaging/paths";
import { DAY_MS, keepTyped } from "@/lib/messaging/rules";
import { done, field } from "@/lib/selling/action-helpers";
import { sastDate } from "@/lib/time";
import {
  deleteRequestPath,
  editRequestPath,
  NEW_REQUEST_PATH,
  requestFormKey,
  requestNoteKey,
  requestPath,
  YOUR_REQUESTS_FORM,
  YOUR_REQUESTS_PATH,
} from "./paths";
import { checkRequest, OPEN_REQUESTS_MAX, REQUESTS_PER_DAY, type RequestError, type RequestInput } from "./rules";

// The Server Actions behind Looking For's forms (community actions spec 2.2 to 2.6 and 2.9). Each is a plain form's
// action, so it works before the app's JavaScript arrives. It checks its own input, takes identity only from the
// session, keeps errors and typed values in D's form state (never the URL), and ends with a redirect that replaces the
// form in history. A write expires the "requests" tag, leaves a status line for the page it lands on (plan decision
// 7), and ends with F's done(), whose refresh() makes the browser drop its kept pages.

// --- Shared helpers -------------------------------------------------------------------------------------------------

/** An id from a hidden field, when it's one this site could have made. */
function idFrom(formData: FormData, name: string): string | null {
  const value = field(formData, name);
  return isId(value) ? value : null;
}

/** Back to the form after a post that changed nothing (E's back): no refresh. */
function back(path: string): never {
  redirect(path, RedirectType.replace);
}

/** A status line for the page the action lands on (plan decision 7). */
async function leaveNote(form: string, notice: string, now: Date): Promise<void> {
  await writeFormState(form, { errors: [], values: {}, notice }, now);
}

// --- The request form (spec 2.3 to 2.5) -----------------------------------------------------------------------------

function requestInput(formData: FormData): RequestInput {
  return {
    title: field(formData, "title"),
    categorySlug: field(formData, "category"),
    campusSlug: field(formData, "campus"),
    details: field(formData, "details"),
    budget: field(formData, "budget"),
    swap: field(formData, "swap") === "yes",
    neededBy: field(formData, "neededBy"),
  };
}

/** What was typed, for the form to show again after a failed post (E's keepTyped caps the long fields). */
function typedValues(input: RequestInput): Record<string, string> {
  return {
    title: keepTyped(input.title),
    category: input.categorySlug,
    campus: input.campusSlug,
    details: keepTyped(input.details),
    budget: keepTyped(input.budget),
    swap: input.swap ? "yes" : "",
    neededBy: keepTyped(input.neededBy),
  };
}

/**
 * Post request and Save changes (spec 2.3 to 2.6): the fields checked on the server, contact details refused, and for
 * a new request the open and daily limits (plan decision 4). The request's page then says what happened. Only the
 * asker's open request can be edited (plan decision 6).
 */
export async function saveMyRequest(formData: FormData): Promise<void> {
  const editing = idFrom(formData, "request");
  const path = editing ? editRequestPath(editing) : NEW_REQUEST_PATH;
  const account = await requireAccount(path);
  const now = new Date();
  if (editing) {
    const own = await getOwnRequest(account.id, editing);
    if (!own) redirect(YOUR_REQUESTS_PATH);
    // The edit page says why a closed or hidden request can't be changed.
    if (own.state !== "open") back(path);
  }
  const form = requestFormKey(editing);
  const [categories, campuses] = await Promise.all([getCategories(), getCampuses()]);
  const input = requestInput(formData);
  const check = checkRequest(input, {
    categorySlugs: categories.map((category) => category.slug),
    campusSlugs: campuses.map((campus) => campus.slug),
    today: sastDate(now),
  });
  const errors: RequestError[] = [...check.errors];
  if (!editing && errors.length === 0) {
    if ((await countOpenRequests(account.id)) >= OPEN_REQUESTS_MAX) errors.push("open-limit");
    else if ((await countRequestsSince(account.id, new Date(now.getTime() - DAY_MS))) >= REQUESTS_PER_DAY) {
      errors.push("daily-limit");
    }
  }
  if (errors.length > 0 || !check.value) {
    await writeFormState(form, { errors, values: typedValues(input), notice: null }, now);
    back(path);
  }
  const saved = editing
    ? await updateRequest(account.id, editing, check.value, now)
    : await createRequest({ askerId: account.id, fields: check.value, now });
  if (!saved) redirect(YOUR_REQUESTS_PATH);
  await clearOwnFormState(form);
  await leaveNote(requestNoteKey(saved.id), editing ? "saved" : "posted", now);
  requestsChanged();
  done(requestPath(saved.id));
}

// --- Close, Reopen and Delete (spec 2.6) ------------------------------------------------------------------------------

/**
 * Close or Reopen, from the request's page or from Your requests (`from=list`), landing back where it came from with a
 * status line (plan decisions 6 and 7). Reopening counts towards the 5 open (spec 2.6). A press that changes nothing
 * (someone else's request, a hidden one, a second press) says nothing.
 */
async function changeOpen(formData: FormData, open: boolean): Promise<void> {
  const id = idFrom(formData, "request");
  const landing = id && field(formData, "from") !== "list" ? requestPath(id) : YOUR_REQUESTS_PATH;
  const account = await requireAccount(landing);
  if (!id) done(YOUR_REQUESTS_PATH);
  const now = new Date();
  const note = landing === YOUR_REQUESTS_PATH ? YOUR_REQUESTS_FORM : requestNoteKey(id);
  if (open && (await getOwnRequest(account.id, id))?.state === "closed") {
    if ((await countOpenRequests(account.id)) >= OPEN_REQUESTS_MAX) {
      await leaveNote(note, "reopen-limit", now);
      done(landing);
    }
  }
  if (await setRequestOpen(account.id, id, open, now)) {
    requestsChanged();
    await leaveNote(note, open ? "reopened" : "closed", now);
  }
  done(landing);
}

/** Close: "Found it? Close it so shops stop offering." */
export async function closeMyRequest(formData: FormData): Promise<void> {
  await changeOpen(formData, false);
}

export async function reopenMyRequest(formData: FormData): Promise<void> {
  await changeOpen(formData, true);
}

/** Delete request, from its confirm page (spec 2.6): it goes, its page 404s, and Your requests says so. */
export async function deleteMyRequest(formData: FormData): Promise<void> {
  const id = idFrom(formData, "request");
  const account = await requireAccount(id ? deleteRequestPath(id) : YOUR_REQUESTS_PATH);
  if (id && (await deleteRequest(account.id, id))) {
    requestsChanged();
    await leaveNote(YOUR_REQUESTS_FORM, "deleted", new Date());
  }
  done(YOUR_REQUESTS_PATH);
}
```

In `lib/auth/actions.ts` (D Task 6, with F's and G's lines), in `deleteAccount`, straight after G's `hubChanged();` line, add:

```ts
  // Its requests have gone, and offers counts may have changed (community actions plan decision 10).
  requestsChanged();
```

and add `requestsChanged` to the `@/lib/data/tags` import (F added it with `sellersChanged`; alphabetical order).

- [ ] **Step 6: Run them to make sure they pass**

Run: `pnpm test lib/looking-for lib/auth`
Expected: PASS.

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 13 more unit tests than after Task 6.

- [ ] **Step 8: Hand over for commit**

Files: `lib/looking-for/form-state.ts`, `lib/looking-for/form-state.test.ts`, `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts`, `lib/auth/actions.ts`, `lib/auth/account-actions.test.ts`.
Message: `feat: the request Server Actions: Post request with the contact-details refusal and the limits, Save changes, Close, Reopen and Delete, each with a status line where it lands; deleting an account expires the board (community actions spec 2.2 to 2.6)`

---

### Task 8: The offer Server Action

**Send offer** (spec 2.7 to 2.9; plan decisions 10, 12 and 13): who can offer and why not (`lib/looking-for/subjects.ts`, shared with the composer page in Task 13), E's message check and scam check on the offer, one offer per shop per request, 20 a shop a day, and the thread with "Sent." after. A sample request has no asker, so it can't take offers (spec 2.11); the composer says so.

**Files:**
- Modify: `lib/data/requests.ts`, `lib/data/requests.test.ts`
- Create: `lib/looking-for/subjects.ts`, `lib/looking-for/subjects.test.ts`
- Modify: `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts`

- [ ] **Step 1: Write the tests**

In `lib/data/requests.test.ts`, add `requestAskerId` to the import from `./requests`, and add at the end of the file:

```ts

describe("who asked (community actions spec 2.7 and 2.11)", () => {
  it("is the account that posted it; no one for a sample request or one that's gone", async () => {
    const { id } = await post();
    expect(await requestAskerId(id)).toBe("acc-student");
    expect(await requestAskerId("r-001")).toBeNull();
    expect(await requestAskerId("r-nope")).toBeNull();
  });
});
```

Create `lib/looking-for/subjects.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { startOffer } from "@/lib/data/messages";
import { createRequest, hideRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import type { Account } from "@/lib/types";
import type { RequestFields } from "./rules";
import { offerStatus, offerSubject } from "./subjects";

const NOW = new Date("2026-10-14T08:42:00.000Z");

const FIELDS: RequestFields = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};

const viewer = (id: string, seller: Account["seller"]) => ({ id, seller });
const TECH_CORNER = viewer("acc-seller", { status: "approved", sellerSlug: "tech-corner" });

const postedSubject = async () => {
  const posted = await createRequest({ askerId: "acc-student", fields: FIELDS, now: NOW });
  return (await offerSubject(posted.id))!;
};

beforeEach(() => {
  resetSampleStore();
});

describe("who can offer (community actions spec 2.8, plan decisions 12 and 13)", () => {
  it("lets an approved shop offer on someone's open request, with its listed listings to point to", async () => {
    const subject = await postedSubject();
    expect(subject.campusName).toBe("Midrand");
    const status = await offerStatus(subject, TECH_CORNER);
    expect(status).toMatchObject({ kind: "open", askerId: "acc-student", shopSlug: "tech-corner" });
    expect(status.kind === "open" ? status.listings.map((listing) => listing.id).sort() : []).toEqual(["l-001", "l-007"]);
  });

  it("says why anyone else can't: the asker, no shop, a shop waiting for approval, a paused shop", async () => {
    const subject = await postedSubject();
    expect(await offerStatus(subject, viewer("acc-student", null))).toEqual({ kind: "own" });
    expect(await offerStatus(subject, viewer("acc-mentor", null))).toEqual({ kind: "no-shop" });
    expect(await offerStatus(subject, viewer("acc-pending", { status: "pending", sellerSlug: null }))).toEqual({
      kind: "pending",
    });
    expect(await offerStatus(subject, viewer("acc-seller", { status: "paused", sellerSlug: "tech-corner" }))).toEqual({
      kind: "paused",
    });
  });

  it("says when the shop has offered already, the request is closed, or it's a sample", async () => {
    const subject = await postedSubject();
    const conversationId = await startOffer({
      askerId: "acc-student",
      request: { id: subject.request.id, title: subject.request.title },
      sellerSlug: "tech-corner",
      listing: null,
      body: "I can help.",
      now: NOW,
    });
    expect(await offerStatus(subject, TECH_CORNER)).toEqual({ kind: "offered", conversationId });
    expect(await offerStatus((await offerSubject("r-015"))!, TECH_CORNER)).toEqual({ kind: "closed" });
    expect(await offerStatus((await offerSubject("r-002"))!, TECH_CORNER)).toEqual({ kind: "sample" });
  });

  it("has no subject for a hidden or unknown request: the composer is the 404", async () => {
    await hideRequest("r-001", "Not allowed.", NOW);
    expect(await offerSubject("r-001")).toBeNull();
    expect(await offerSubject("r-nope")).toBeNull();
  });
});
```

In `lib/looking-for/actions.test.ts`:
1. Add to the imports, in alphabetical order (merging with what's there): `import { startOffer } from "@/lib/data/messages";`, `import { sentNoteKey } from "@/lib/messaging/paths";`, `sendOffer` from `./actions`, and `offerFormKey` from `./paths`.
2. Add at the end of the file:

```ts

describe("Send offer (community actions spec 2.7 to 2.9)", () => {
  const asSeller = () => signedInAs(request, "acc-seller");

  it("starts the thread, expires the board, and opens the thread with Sent.", async () => {
    const { id } = await posted();
    await asSeller();
    const redirect = await redirectSignalOf(() =>
      sendOffer(form({ request: id, body: "I have a clip-on lamp, R120.", listing: "l-001" })),
    );
    expect(redirect.url).toMatch(/^\/messages\/conv-[0-9a-f-]{36}$/);
    expect([redirect.type, request.refreshed, request.updatedTags]).toEqual(["replace", true, ["requests"]]);
    const conversationId = redirect.url.split("/").at(-1)!;
    expect(sampleStore().conversations.get(conversationId)).toMatchObject({
      status: "offered",
      buyerId: "acc-student",
      sellerSlug: "tech-corner",
      requestId: id,
      listingId: "l-001",
    });
    expect(await readFormState(sentNoteKey(conversationId))).toMatchObject({ notice: "sent" });
    expect(await readFormState(offerFormKey(id))).toBeNull();
    expect((await getOwnRequest("acc-student", id))?.request.offers).toBe(1);
  });

  it("ignores a listing that isn't one of the shop's listed ones (plan decision 13)", async () => {
    const { id } = await posted();
    await asSeller();
    const url = await redirectOf(() => sendOffer(form({ request: id, body: "I can help.", listing: "l-004" })));
    expect(sampleStore().conversations.get(url.split("/").at(-1)!)?.listingId).toBeNull();
  });

  it("keeps the message and says what's wrong, or asks to check scam words before sending anyway", async () => {
    const { id } = await posted();
    await asSeller();
    expect(await redirectOf(() => sendOffer(form({ request: id, body: " " })))).toBe(`/looking-for/${id}/offer`);
    expect(await readFormState(offerFormKey(id))).toMatchObject({ errors: ["message-missing"] });
    const scam = "Pay a deposit first and I'll bring it.";
    await redirectOf(() => sendOffer(form({ request: id, body: scam })));
    expect(await readFormState(offerFormKey(id))).toMatchObject({ notice: "check", values: { body: scam } });
    expect(sampleStore().conversations.size).toBe(2);
    await redirectOf(() => sendOffer(form({ request: id, body: scam, anyway: "yes" })));
    expect(sampleStore().conversations.size).toBe(3);
  });

  it("stops at 20 offers a shop in a day", async () => {
    const { id } = await posted();
    for (let n = 0; n < 20; n += 1) {
      const other = await posted("acc-mentor");
      await startOffer({
        askerId: "acc-mentor",
        request: { id: other.id, title: other.title },
        sellerSlug: "tech-corner",
        listing: null,
        body: "I can help.",
        now: STAFF_NOW,
      });
    }
    await asSeller();
    await redirectOf(() => sendOffer(form({ request: id, body: "I can help." })));
    expect((await readFormState(offerFormKey(id)))?.errors).toEqual(["offer-rate"]);
  });

  it("sends anyone who can't offer back to the composer, which says why, storing nothing", async () => {
    const { id } = await posted();
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(() => sendOffer(form({ request: id, body: "I can help." })))).toBe(`/looking-for/${id}/offer`);
    await asStudent();
    expect(await redirectOf(() => sendOffer(form({ request: id, body: "Me!" })))).toBe(`/looking-for/${id}/offer`);
    expect(sampleStore().conversations.size).toBe(2);
    expect(await redirectOf(() => sendOffer(form({ request: "Not an id!", body: "x" })))).toBe("/looking-for");
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test lib/data/requests.test.ts lib/looking-for`
Expected: FAIL: there's no `requestAskerId`, `./subjects` or `sendOffer`.

- [ ] **Step 3: Who asked**

In `lib/data/requests.ts`, add after `getOwnRequest`:

```ts

/** Who asked, for an offer's thread (spec 2.7): null for a sample request, which can't take offers, or one that's gone. */
export async function requestAskerId(id: string): Promise<string | null> {
  return sampleStore().requests.get(id)?.askerId ?? null;
}
```

- [ ] **Step 4: Who can offer**

Create `lib/looking-for/subjects.ts`:

```ts
import { getCampuses, getRequest, getSellerListings } from "@/lib/data";
import { findOffer } from "@/lib/data/offers";
import { requestAskerId } from "@/lib/data/requests";
import type { Account, LookingForRequest } from "@/lib/types";

// What an offer is about and whether the visitor can make it (community actions spec 2.8, 2.9 and 2.11; plan
// decisions 12 and 13), looked up once for the composer page and again by sendOffer, which never trusts the form.

export type OfferSubject = { request: LookingForRequest; campusName: string };

/** A request with a page (open or closed, not hidden) and its campus's name; null otherwise (the composer is the 404). */
export async function offerSubject(id: string): Promise<OfferSubject | null> {
  const [request, campuses] = await Promise.all([getRequest(id), getCampuses()]);
  if (!request) return null;
  return { request, campusName: campuses.find((campus) => campus.slug === request.campusSlug)?.name ?? "" };
}

/** Whether this account can offer, with what it needs to; otherwise why not (plan decision 12). */
export type OfferStatus =
  | { kind: "open"; askerId: string; shopSlug: string; listings: { id: string; title: string }[] }
  | { kind: "own" }
  | { kind: "no-shop" }
  | { kind: "pending" }
  | { kind: "paused" }
  | { kind: "offered"; conversationId: string }
  | { kind: "closed" }
  | { kind: "sample" };

/**
 * Only shops offer (spec 2.8): an approved shop with a storefront, not paused. One offer per shop per request, so an
 * offer already made is "offered" (spec 2.9); then a closed request, and a sample one, which has no one to answer.
 */
export async function offerStatus(subject: OfferSubject, account: Pick<Account, "id" | "seller">): Promise<OfferStatus> {
  const { request } = subject;
  const askerId = await requestAskerId(request.id);
  if (askerId === account.id) return { kind: "own" };
  const seller = account.seller;
  if (!seller) return { kind: "no-shop" };
  if (seller.status === "pending" || !seller.sellerSlug) return { kind: "pending" };
  if (seller.status === "paused") return { kind: "paused" };
  const existing = await findOffer(request.id, seller.sellerSlug);
  if (existing) return { kind: "offered", conversationId: existing };
  if (request.status !== "open") return { kind: "closed" };
  if (!askerId) return { kind: "sample" };
  const listings = await getSellerListings(seller.sellerSlug);
  return {
    kind: "open",
    askerId,
    shopSlug: seller.sellerSlug,
    listings: listings.map((listing) => ({ id: listing.id, title: listing.title })),
  };
}
```

- [ ] **Step 5: Send offer**

In `lib/looking-for/actions.ts`:
1. Add to the imports, in alphabetical order (merging with what's there): `import { startOffer } from "@/lib/data/messages";`, `import { countOffersSince } from "@/lib/data/offers";`, `import { sentNoteKey, threadPath } from "@/lib/messaging/paths";` (merge with the `isId` import), `checkMessage` from `@/lib/messaging/rules`, `import { scamWarnings } from "@/lib/messaging/scam-check";`, `offerFormKey` and `offerPath` from `./paths`, `OFFERS_PER_DAY` from `./rules`, and `import { offerStatus, offerSubject } from "./subjects";`.
2. Append:

```ts

// --- Offers (spec 2.7 to 2.9) -------------------------------------------------------------------------------------

/**
 * Send offer, from the composer (spec 2.9): only when the composer would show its form (plan decision 12); the message
 * checked with E's rules, then E's scam words unless Send anyway was pressed; a listing only if it's one of the shop's
 * listed ones (plan decision 13); at most 20 a shop in 24 hours. The thread then says "Sent." once (E's note).
 */
export async function sendOffer(formData: FormData): Promise<void> {
  const id = idFrom(formData, "request");
  if (!id) redirect("/looking-for");
  const path = offerPath(id);
  const account = await requireAccount(path);
  const subject = await offerSubject(id);
  if (!subject) redirect("/looking-for");
  const status = await offerStatus(subject, account);
  // The composer says why anyone else can't offer; a post that arrives anyway just goes back to it.
  if (status.kind !== "open") back(path);
  const now = new Date();
  const form = offerFormKey(id);
  const message = checkMessage(field(formData, "body"));
  const pointed = status.listings.find((listing) => listing.id === field(formData, "listing")) ?? null;
  const values = { body: keepTyped(message.value), listing: pointed?.id ?? "" };
  if (message.error) {
    await writeFormState(form, { errors: [message.error], values, notice: null }, now);
    back(path);
  }
  const warnings = field(formData, "anyway") === "yes" ? [] : scamWarnings(message.value);
  if (warnings.length > 0) {
    await writeFormState(form, { errors: [], values: { ...values, warnings: warnings.join(",") }, notice: "check" }, now);
    back(path);
  }
  if ((await countOffersSince(status.shopSlug, new Date(now.getTime() - DAY_MS))) >= OFFERS_PER_DAY) {
    await writeFormState(form, { errors: ["offer-rate"], values, notice: null }, now);
    back(path);
  }
  const conversationId = await startOffer({
    askerId: status.askerId,
    request: { id, title: subject.request.title },
    sellerSlug: status.shopSlug,
    listing: pointed,
    body: message.value,
    now,
  });
  await clearOwnFormState(form);
  await writeFormState(sentNoteKey(conversationId), { errors: [], values: {}, notice: "sent" }, now);
  requestsChanged();
  done(threadPath(conversationId));
}
```

- [ ] **Step 6: Run them to make sure they pass**

Run: `pnpm test lib/data/requests.test.ts lib/looking-for`
Expected: PASS.

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 10 more unit tests than after Task 7.

- [ ] **Step 8: Hand over for commit**

Files: `lib/data/requests.ts`, `lib/data/requests.test.ts`, `lib/looking-for/subjects.ts`, `lib/looking-for/subjects.test.ts`, `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts`.
Message: `feat: Send offer: only approved shops, one per shop per request, E's message and scam checks, a listing to point to, 20 a shop a day, and the thread with Sent. after (community actions spec 2.7 to 2.9)`

---

### Task 9: The follow Server Actions, and telling followers about a new listing

**Follow** and **Unfollow** (spec 2.15 to 2.17; plan decisions 7 and 16), from the storefront's band or from Saved's Shops tab, each landing back where it came from with a status line; and F's listing form telling the shop's followers when a listing is published for the first time (spec 2.19, plan decision 15). The band and the tab come in Tasks 17 and 18.

**Files:**
- Create: `lib/following/actions.ts`, `lib/following/actions.test.ts`
- Modify: `lib/selling/listing-actions.ts`, `lib/selling/listing-actions.test.ts`

- [ ] **Step 1: Write the tests**

Create `lib/following/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { addFollow, isFollowing } from "@/lib/data/follows";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { followShop, unfollowShop } from "./actions";
import { followNoteKey, SAVED_SHOPS_FORM } from "./rules";

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

describe("Follow and Unfollow (community actions spec 2.16 and 2.17)", () => {
  it("follows from the band, landing back on the storefront with a status line", async () => {
    await signedInAs(request, "acc-student");
    const redirect = await redirectSignalOf(() => followShop(form({ shop: "tech-corner" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/sellers/tech-corner", "replace", true]);
    expect(await isFollowing("acc-student", "tech-corner")).toBe(true);
    expect(await readFormState(followNoteKey("tech-corner"))).toMatchObject({
      notice: "followed",
      values: { shop: "Tech corner" },
    });
  });

  it("unfollows from Saved, landing back on its Shops tab with a status line", async () => {
    await signedInAs(request, "acc-student");
    await addFollow("acc-student", "tech-corner", STAFF_NOW);
    expect(await redirectOf(() => unfollowShop(form({ shop: "tech-corner", from: "saved" })))).toBe("/saved?tab=shops");
    expect(await isFollowing("acc-student", "tech-corner")).toBe(false);
    expect(await readFormState(SAVED_SHOPS_FORM)).toMatchObject({
      notice: "unfollowed",
      values: { shop: "Tech corner" },
    });
  });

  it("quietly refuses the owner's own shop, and says when 200 is reached", async () => {
    await signedInAs(request, "acc-seller");
    await redirectOf(() => followShop(form({ shop: "tech-corner" })));
    expect(await isFollowing("acc-seller", "tech-corner")).toBe(false);
    expect(await readFormState(followNoteKey("tech-corner"))).toBeNull();
    for (let n = 0; n < 200; n += 1) {
      sampleStore().follows.set(`follow-${n}`, {
        id: `follow-${n}`,
        accountId: "acc-student",
        sellerSlug: `shop-${n}`,
        createdAt: STAFF_NOW.toISOString(),
      });
    }
    await signedInAs(request, "acc-student");
    await redirectOf(() => followShop(form({ shop: "code-coach" })));
    expect(await isFollowing("acc-student", "code-coach")).toBe(false);
    expect(await readFormState(followNoteKey("code-coach"))).toMatchObject({ notice: "follow-limit" });
  });

  it("sends a signed-out visitor to sign in, coming back to the shop; a made-up slug goes home", async () => {
    expect(await redirectOf(() => followShop(form({ shop: "tech-corner" })))).toBe("/login?next=%2Fsellers%2Ftech-corner");
    expect(await redirectOf(() => followShop(form({ shop: "Not a slug!" })))).toBe("/");
    expect(sampleStore().follows.size).toBe(0);
  });
});
```

In `lib/selling/listing-actions.test.ts` (F Task 8), add among the `@/lib/data/…` imports, in alphabetical order, `import { addFollow } from "@/lib/data/follows";` and `import { getNotifications } from "@/lib/data/notifications";`, and add at the end of the file (it uses the file's own `signedInAs`, `fanForm` and `fan`):

```ts

describe("telling followers (community actions spec 2.19, plan decision 15)", () => {
  const notes = async () =>
    (await getNotifications("acc-student", 50)).filter((item) => item.kind === "new-listing");

  it("tells followers about a first publish, and not about an edit", async () => {
    await addFollow("acc-student", "tech-corner", NOW);
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm()));
    expect(await notes()).toMatchObject([{ text: "Tech corner listed Desk fan" }]);
    const row = (await fan())!;
    await redirectOf(() => saveListingForm(fanForm({ listing: row.id, title: "Desk fan, quiet" })));
    expect(await notes()).toMatchObject([{ text: "Tech corner listed Desk fan" }]);
  });

  it("tells them when a draft is published, not when it's saved as one", async () => {
    await addFollow("acc-student", "tech-corner", NOW);
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm({ intent: "draft" })));
    expect(await notes()).toEqual([]);
    const row = (await fan())!;
    await redirectOf(() => saveListingForm(fanForm({ listing: row.id })));
    expect(await notes()).toHaveLength(1);
  });

  it("stays quiet while the shop is paused", async () => {
    await addFollow("acc-student", "tech-corner", NOW);
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    await signedInAs("acc-seller");
    await redirectOf(() => saveListingForm(fanForm()));
    expect(await notes()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test lib/following lib/selling/listing-actions.test.ts`
Expected: FAIL: `./actions` doesn't exist, and publishing tells no one.

- [ ] **Step 3: Write the follow actions**

Create `lib/following/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { storefrontRow } from "@/lib/data/catalog";
import { addFollow, removeFollow } from "@/lib/data/follows";
import { isId } from "@/lib/messaging/paths";
import { done, field } from "@/lib/selling/action-helpers";
import { followNoteKey, SAVED_SHOPS_FORM, savedTabPath } from "./rules";

// Follow and Unfollow (community actions spec 2.15 to 2.17; plan decisions 7 and 16): plain forms on the storefront's
// band and Saved's Shops tab, so they work before the app's JavaScript arrives. Identity comes only from the session;
// each lands back where it came from, with a status line there, and ends with F's done(), whose refresh() drops the
// browser's kept pages. Nothing buyers see changes (the storefront shows no count), so no tag is expired.

/** Where the button was: Saved's Shops tab (`from=saved`) or the shop's own storefront. */
function landingFor(formData: FormData, slug: string): { path: string; note: string } {
  return field(formData, "from") === "saved"
    ? { path: savedTabPath("shops"), note: SAVED_SHOPS_FORM }
    : { path: `/sellers/${slug}`, note: followNoteKey(slug) };
}

/** The shop's name for the status line, or "the shop" once it has gone. */
const shopName = (slug: string) => storefrontRow(slug)?.name ?? "the shop";

/** Follow (spec 2.16): says so, or that 200 is the most; the owner's own shop and a second press say nothing. */
export async function followShop(formData: FormData): Promise<void> {
  const slug = field(formData, "shop");
  if (!isId(slug)) redirect("/");
  const { path, note } = landingFor(formData, slug);
  const account = await requireAccount(path);
  const now = new Date();
  const result = await addFollow(account.id, slug, now);
  if (result === "followed" || result === "limit") {
    const notice = result === "followed" ? "followed" : "follow-limit";
    await writeFormState(note, { errors: [], values: { shop: shopName(slug) }, notice }, now);
  }
  done(path);
}

/** Unfollow (spec 2.16 and 2.17), from the band or Saved's Shops tab. */
export async function unfollowShop(formData: FormData): Promise<void> {
  const slug = field(formData, "shop");
  if (!isId(slug)) redirect("/");
  const { path, note } = landingFor(formData, slug);
  const account = await requireAccount(path);
  if (await removeFollow(account.id, slug)) {
    await writeFormState(note, { errors: [], values: { shop: shopName(slug) }, notice: "unfollowed" }, new Date());
  }
  done(path);
}
```

- [ ] **Step 4: Publishing tells the shop's followers**

In `lib/selling/listing-actions.ts` (F Task 8, with G's changes):
1. Add `import { notifyFollowers } from "@/lib/data/follows";` among the `@/lib/data/…` imports, in alphabetical order.
2. In `saveListingForm`, straight after the `listingsChanged();` line, add:

```ts
  // A first publish (a new listing, or a draft published) by an open shop tells its followers, once a day
  // (community actions plan decision 15). Edits, relists and a shop resuming don't.
  const firstPublish = saved.state !== "draft" && (!existing || existing.state === "draft");
  if (firstPublish && owner.status === "approved" && !saved.hiddenAt) {
    await notifyFollowers({
      sellerSlug: owner.shop.slug,
      shopName: owner.shop.name,
      listing: { id: saved.id, title: saved.title },
      now,
    });
  }
```

- [ ] **Step 5: Run them to make sure they pass**

Run: `pnpm test lib/following lib/selling/listing-actions.test.ts`
Expected: PASS, F's existing tests unchanged.

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 7 more unit tests than after Task 8.

- [ ] **Step 7: Hand over for commit**

Files: `lib/following/actions.ts`, `lib/following/actions.test.ts`, `lib/selling/listing-actions.ts`, `lib/selling/listing-actions.test.ts`.
Message: `feat: Follow and Unfollow from the storefront and Saved, with status lines, and a first publish telling the shop's followers, once a day (community actions spec 2.15 to 2.17 and 2.19)`

---

### Task 10: The Hub hides a reported request

G's reports queue learns **Hide the request** (spec 2.14, plan decision 20): a report about a request that's there and not hidden can be hidden from G's confirm page (`/admin/reports/[id]/hide`), which asks for the reason; every open report on it closes, each reporter hears the Hub acted, the log says "Hid a request", the asker gets a `request-update` notification linking to Your requests, and the board is expired. G decision 5's "a report about a request can only be dismissed" no longer holds.

**Files:**
- Modify: `lib/data/staff-reports.ts`, `lib/data/staff-reports.test.ts`
- Modify: `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`
- Modify: `lib/staff/notices.ts`
- Modify: `components/staff/ReportConfirm.tsx`, `components/staff/ReportConfirm.test.tsx`
- Modify: `components/staff/AdminReport.tsx`, `components/staff/AdminReport.test.tsx`
- Modify: `app/admin/reports/[id]/hide/page.tsx`

- [ ] **Step 1: Change the tests first**

In `lib/data/staff-reports.test.ts` (G Task 5), in "says what the Hub can do: …", change `expect(request.can).toEqual({ hide: false, pause: false });` to `expect(request.can).toEqual({ hide: true, pause: false });`, change the test's name to "says what the Hub can do: hide a listing or a request that's there, pause an owned open shop, only dismiss the rest", and add at the end of the file:

```ts

describe("reports about a request (community actions spec 2.14, plan decision 20)", () => {
  it("can hide a request that's there and not hidden yet; one that has gone can only be dismissed", async () => {
    const id = await report("acc-student", { kind: "request", id: "r-002" }, 8);
    expect((await getReport(id))!).toMatchObject({ exists: true, can: { hide: true, pause: false }, shop: null });
    sampleStore().requests.get("r-002")!.hiddenAt = NOW.toISOString();
    expect((await getReport(id))!.can).toEqual({ hide: false, pause: false });
    sampleStore().requests.delete("r-002");
    expect((await getReport(id))!).toMatchObject({ exists: false, can: { hide: false, pause: false } });
  });
});
```

(It uses the file's own `report` helper and `NOW`; add `sampleStore` to its `./store` import if it isn't there.)

In `lib/staff/admin-actions.test.ts` (G Task 10):
1. Add to the imports, in alphabetical order: `import { createRequest } from "@/lib/data/requests";` and `hideReportedRequest` from `./admin-actions`.
2. Add at the end of the file (it uses the file's own `asAdmin`, `notice`, `lastAudit`, `newest` and `report`):

```ts

describe("hiding a reported request (community actions spec 2.14, plan decision 20)", () => {
  const postedRequest = () =>
    createRequest({
      askerId: "acc-student",
      fields: {
        title: "Exam answers wanted",
        categorySlug: "textbooks-notes",
        campusSlug: "midrand",
        details: "Looking for the answers to Friday's exam paper.",
        budgetZar: null,
        swapWelcome: false,
        neededBy: null,
      },
      now: STAFF_NOW,
    });

  it("hides it: every open report closes, the asker and the reporters are told, it's logged, the board expires", async () => {
    const posted = await postedRequest();
    const first = await report("acc-mentor", { kind: "request", id: posted.id }, posted.title);
    const second = await report("acc-seller", { kind: "request", id: posted.id }, posted.title);
    await asAdmin();
    expect(
      await redirectOf(() => hideReportedRequest(form({ report: first, reason: "Selling exam answers isn't allowed." }))),
    ).toBe("/admin/reports");
    expect(sampleStore().requests.get(posted.id)).toMatchObject({ hiddenReason: "Selling exam answers isn't allowed." });
    expect([sampleStore().reports.get(first)?.outcome, sampleStore().reports.get(second)?.outcome]).toEqual([
      "hidden",
      "hidden",
    ]);
    expect(await lastAudit()).toMatchObject({
      staffName: "Pieter",
      action: "request-hidden",
      targetKind: "request",
      targetName: "Exam answers wanted",
      detail: "Selling exam answers isn't allowed.",
    });
    expect(await newest("acc-student")).toMatchObject({
      kind: "request-update",
      text: "The Hub hid your request Exam answers wanted. See why in Your requests.",
      href: "/account/requests",
    });
    expect((await newest("acc-mentor")).text).toBe("Thanks, we've acted on your report about Exam answers wanted.");
    expect(request.updatedTags).toEqual(["requests"]);
    expect(await notice()).toBe("request-hidden");
  });

  it("asks for the reason first, and changes nothing on a second press or for a listing's report", async () => {
    const posted = await postedRequest();
    const id = await report("acc-mentor", { kind: "request", id: posted.id }, posted.title);
    await asAdmin();
    expect(await redirectOf(() => hideReportedRequest(form({ report: id, reason: "" })))).toBe(
      `/admin/reports/${id}/hide`,
    );
    expect(sampleStore().requests.get(posted.id)?.hiddenAt).toBeNull();
    await redirectOf(() => hideReportedRequest(form({ report: id, reason: "Not allowed." })));
    await redirectOf(() => hideReportedRequest(form({ report: id, reason: "Again." })));
    expect(await notice()).toBe("nothing");
    expect(sampleStore().auditLog.size).toBe(1);
    const aboutListing = await report("acc-mentor", { kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    await redirectOf(() => hideReportedRequest(form({ report: aboutListing, reason: "No." })));
    expect(sampleStore().listings.get("l-004")?.hiddenAt ?? null).toBeNull();
  });

  it("gives anyone but an admin the 404, changing nothing", async () => {
    const posted = await postedRequest();
    const id = await report("acc-mentor", { kind: "request", id: posted.id }, posted.title);
    await signedInAs(request, "acc-mentor");
    await expect(hideReportedRequest(form({ report: id, reason: "No." }))).rejects.toThrow("notFound");
    expect(sampleStore().requests.get(posted.id)?.hiddenAt).toBeNull();
  });
});
```

In `components/staff/ReportConfirm.test.tsx` (G Task 12):
1. Change the `vi.mock("@/lib/staff/admin-actions", …)` line to:

```tsx
vi.mock("@/lib/staff/admin-actions", () => ({
  hideReportedListing: async () => {},
  hideReportedRequest: async () => {},
  pauseReportedShop: async () => {},
}));
```

2. Add this test at the end of its `describe`:

```tsx

  it("asks before hiding a request, saying what students, the asker and the reporters see (community actions plan decision 20)", async () => {
    const report = await view({ kind: "request", id: "r-002" }, "Graphic calculator to borrow for exams");
    render(<ReportConfirm kind="hide" report={report} reason="" errors={[]} />);
    expect(
      screen.getByText("Hide Graphic calculator to borrow for exams? Students stop seeing it straight away."),
    ).toBeInTheDocument();
    expect(screen.getByText(/sees your reason in Your requests/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide Graphic calculator to borrow for exams" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", `/admin/reports/${report.id}`);
  });
```

In `components/staff/AdminReport.test.tsx` (G Task 12), replace the test "offers only Dismiss for a report about a request, and says why" with:

```tsx
  it("offers Hide for a report about a request, and Dismiss (community actions plan decision 20)", async () => {
    const id = await reportOn({ kind: "request", id: "r-001" }, "Looking for a lab coat");
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    expect(screen.getByRole("link", { name: "Hide Looking for a lab coat" })).toHaveAttribute(
      "href",
      `/admin/reports/${id}/hide`,
    );
    expect(screen.queryByRole("link", { name: /^Pause / })).toBeNull();
    expect(screen.queryByText(/can only be dismissed/)).toBeNull();
    expect(screen.getByRole("button", { name: "Dismiss the report about Looking for a lab coat" })).toBeInTheDocument();
  });
```

Run: `pnpm test lib/data/staff-reports.test.ts lib/staff/admin-actions.test.ts components/staff`
Expected: FAIL: a request's report can't be hidden, and there's no `hideReportedRequest`.

- [ ] **Step 2: What the queue allows**

In `lib/data/staff-reports.ts` (G Task 5), in `toView`:
1. Straight after the `const listing = …` line, add:

```ts
  const requestRow = row.targetKind === "request" ? store.requests.get(row.targetId) : undefined;
```

2. Replace the `const exists = …;` line with:

```ts
  const exists =
    row.targetKind === "request" ? Boolean(requestRow) : row.targetKind === "listing" ? Boolean(listing) : Boolean(shopRow);
```

3. In the returned `can`, replace `hide: open && Boolean(listing) && !listing?.hiddenAt,` with:

```ts
      // A listing or a request that's still there and not hidden yet (community actions plan decision 20).
      hide: open && ((Boolean(listing) && !listing?.hiddenAt) || (Boolean(requestRow) && !requestRow?.hiddenAt)),
```

4. In the file's opening comment, replace "A report about something that has gone, or about a Looking For request, can only be dismissed." with "A report about something that has gone can only be dismissed; a request can be hidden too (community actions plan decision 20)." In `ReportView`, change the comment on `exists` to `/** Whether the reported listing, shop or request is still there. */`.

- [ ] **Step 3: The action**

In `lib/staff/admin-actions.ts` (G Task 10):
1. Add to the imports, in alphabetical order (merging with what's there): `import { hideRequest } from "@/lib/data/requests";`, `requestsChanged` in the `@/lib/data/tags` import, `import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";` and `import { requestHiddenText } from "@/lib/looking-for/words";`.
2. In `hideReportedListing`, change `if (!id || !view?.can.hide) return nothingChanged(ADMIN_REPORTS_PATH, now);` to:

```ts
  if (!id || !view?.can.hide || view.target.kind !== "listing") return nothingChanged(ADMIN_REPORTS_PATH, now);
```

3. Straight after the whole `hideReportedListing` function, add:

```ts

/**
 * Hide the request, from the same confirm page (community actions spec 2.14, plan decision 20): it leaves the board,
 * the homepage and the sitemap, and its page 404s; every open report on it closes; its asker hears the Hub hid it and
 * sees why in Your requests; each reporter hears the Hub acted.
 */
export async function hideReportedRequest(formData: FormData): Promise<void> {
  const id = idFrom(formData, "report");
  const staff = await requireStaff("admin", id ? hideReportedPath(id) : ADMIN_REPORTS_PATH);
  const now = new Date();
  const view = id ? await getReport(id) : null;
  if (!id || !view?.can.hide || view.target.kind !== "request") return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reason = checkReason(field(formData, "reason"));
  if (reason.error) return backWithReason(hideForm(id), reason.error, reason.value, hideReportedPath(id), now);
  const hidden = await hideRequest(view.target.id, reason.value, now);
  if (!hidden) return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reports = await closeReportsOn(view.target, "hidden", reason.value, staff.id, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "request-hidden",
    target: { kind: "request", id: hidden.id, name: hidden.title },
    detail: reason.value,
    subjectId: hidden.askerId,
    now,
  });
  if (hidden.askerId) {
    await notify({
      accountId: hidden.askerId,
      kind: "request-update",
      subjectId: hidden.id,
      text: requestHiddenText(hidden.title),
      href: YOUR_REQUESTS_PATH,
      now,
    });
  }
  for (const closed of reports) await tellReporter(closed, "acted", now);
  requestsChanged();
  await clearStaffForm(hideForm(id));
  await leaveNotice("request-hidden", now);
  done(ADMIN_REPORTS_PATH);
}
```

In `lib/staff/notices.ts` (G Task 2), add straight after the `["hidden", …]` entry:

```ts
  ["request-hidden", "Hidden. The asker and everyone who reported it have been told."],
```

- [ ] **Step 4: The pages**

In `components/staff/ReportConfirm.tsx` (G Task 12):
1. Add `hideReportedRequest` to the `@/lib/staff/admin-actions` import.
2. Straight before the `if (kind === "hide" && report.can.hide) {` branch, add:

```tsx
  if (kind === "hide" && report.can.hide && report.target.kind === "request") {
    return (
      <ConfirmAction
        id={`hide-${report.id}`}
        lead={`Hide ${report.targetTitle}? Students stop seeing it straight away.`}
        consequences={[
          "It leaves the board and the homepage, and its page says it can't be found. Shops can't offer on it.",
          "Every open report about it closes, and each reporter hears that the Hub acted.",
          "Its asker gets a notification and sees your reason in Your requests. They can delete it, but not edit or reopen it.",
          "It can't be shown again from here yet.",
        ]}
        action={hideReportedRequest}
        hidden={{ report: report.id }}
        reasonHint="The asker sees it."
        reason={reason}
        errors={errors}
        confirmLabel={`Hide ${report.targetTitle}`}
        keepHref={back}
      />
    );
  }
```

3. In the last paragraph, change `"This listing can't be hidden from this report: it's closed, hidden already, or gone."` to `"It can't be hidden from this report: it's closed, hidden already, or gone."`, and in the component's comment change "(closed, about a request, gone)" to "(closed, hidden already, gone)" and add "A request's report hides the request (community actions plan decision 20)."

In `components/staff/AdminReport.tsx` (G Task 12), change the paragraph's words "This report is about a Looking For request, something that has gone, or a shop the Hub can&apos;t pause, so it can only be dismissed." to "This report is about something that has gone, or a shop the Hub can&apos;t pause, so it can only be dismissed." (The Hide link already shows for any report whose `can.hide` is true.)

In `app/admin/reports/[id]/hide/page.tsx` (G Task 12), change `staffMetadata("admin", "Hide a listing")` to `staffMetadata("admin", "Hide a listing or request")`, and its page comment's "Hide the listing's confirm page" to "Hide the listing's or request's confirm page".

- [ ] **Step 5: Run them to make sure they pass**

Run: `pnpm test lib/data/staff-reports.test.ts lib/staff components/staff`
Expected: PASS, G's other tests unchanged ("can only dismiss a report about a request" in `admin-actions.test.ts` still passes: `hideReportedListing` refuses it).

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 5 more unit tests than after Task 9.

- [ ] **Step 7: Look at it**

On a production build (`pnpm build`, then `pnpm start --port 3201`): sign in as "Student, Midrand", open `/report?request=r-002`, pick a reason and send. Sign in as "Admin" in another browser, open `/admin/reports`, the newest report, then **Hide Graphic calculator to borrow for exams**: the confirm page lists what will happen and asks for the reason; leave it empty and press the button (the summary asks for it); give one and press it: the queue says "Hidden. The asker and everyone who reported it have been told.", and `/looking-for/r-002` is the 404. Stop the server.

- [ ] **Step 8: Hand over for commit**

Files: `lib/data/staff-reports.ts`, `lib/data/staff-reports.test.ts`, `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`, `lib/staff/notices.ts`, `components/staff/ReportConfirm.tsx`, `components/staff/ReportConfirm.test.tsx`, `components/staff/AdminReport.tsx`, `components/staff/AdminReport.test.tsx`, `app/admin/reports/[id]/hide/page.tsx`.
Message: `feat: the Hub hides a reported request from its confirm page: every open report closes, the asker and reporters are told, it's logged, and the board drops it (community actions spec 2.14)`

---

### Task 11: The request form: `/looking-for/new` and `/looking-for/[id]/edit`

The request form (spec 2.3 and section 4; plan decisions 2, 5, 6 and 24): what you need, the category, the campus (starting on the account's), the details, the budget, "A swap is welcome" and needed by, with each limit as text and each error linked to its field. **Post request** on the new page, **Save changes** on the edit page; a closed or hidden request's edit page says why it can't be changed. Both pages need the session, so they render per request inside `<Suspense>`.

**Files:**
- Create: `components/looking-for/RequestFormView.tsx`, `components/looking-for/RequestFormView.test.tsx`
- Create: `components/looking-for/RequestForm.tsx`, `components/looking-for/RequestForm.test.tsx`
- Create: `components/looking-for/RequestFormSkeleton.tsx`
- Create: `app/looking-for/new/page.tsx`, `app/looking-for/[id]/edit/page.tsx`
- Modify: `components/forms/summary-ids.test.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` (the session behind `<Suspense>`), `03-api-reference/04-functions/connection.md`, `03-api-reference/04-functions/not-found.md` ("Calling notFound() after streaming has started") and `03-api-reference/03-file-conventions/dynamic-routes.md` ("With Cache Components"). `/looking-for/new` is a static segment, so it wins over `/looking-for/[id]`.

- [ ] **Step 2: Write the view's tests**

Create `components/looking-for/RequestFormView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { RequestLocked, RequestFormView, requestForm, startValues } from "./RequestFormView";

vi.mock("@/lib/looking-for/actions", () => ({ saveMyRequest: async () => {}, reopenMyRequest: async () => {} }));

const EMPTY = startValues(null, "midrand");
const TODAY = "2026-10-14";

describe("the request form (community actions spec 2.3 and section 4)", () => {
  it("labels every field, with its limits as text, and starts on the account's campus", () => {
    render(<RequestFormView requestId={null} form={{ values: EMPTY, errors: [] }} campuses={campuses} categories={categories} today={TODAY} />);
    expect(screen.getByRole("heading", { level: 1, name: "Ask for what you need" })).toBeInTheDocument();
    expect(screen.getByLabelText("What you need")).toHaveAccessibleDescription(
      'Between 5 and 70 characters, like "Accounting 1 tutor this week".',
    );
    expect(screen.getByLabelText("Category")).toHaveValue("");
    expect(screen.getByLabelText("Campus")).toHaveValue("midrand");
    expect(screen.getByLabelText("Details")).toHaveAccessibleDescription(
      "Say what you need and when. Shops will message you on Vossie. Between 20 and 600 characters.",
    );
    expect(screen.getByLabelText("Budget in rand (optional)")).toHaveAccessibleDescription(
      "Whole rand, like 300. Leave it empty for Open to offers.",
    );
    expect(screen.getByLabelText("A swap is welcome")).not.toBeChecked();
    const date = screen.getByLabelText("Needed by (optional)");
    expect(date).toHaveAttribute("type", "date");
    expect(date).toHaveAttribute("min", "2026-10-14");
    expect(date).toHaveAttribute("max", "2027-01-12");
    expect(screen.getByRole("button", { name: "Post request" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Back to Looking For" })).toHaveAttribute("href", "/looking-for");
    expect(document.querySelector('input[name="request"]')).toBeNull();
  });

  it("fills an edit with the request, and posts its id", () => {
    const values = startValues(
      {
        id: "r-abc",
        title: "Desk lamp for res",
        campusSlug: "pretoria",
        offers: 0,
        details: "A lamp that clips onto a desk.\nBy the weekend.",
        categorySlug: "res-living",
        budgetZar: 150,
        swapWelcome: true,
        neededBy: "2026-10-20",
        createdAt: "2026-10-14T08:42:00.000Z",
        status: "open",
      },
      "midrand",
    );
    render(<RequestFormView requestId="r-abc" form={{ values, errors: [] }} campuses={campuses} categories={categories} today={TODAY} />);
    expect(screen.getByRole("heading", { level: 1, name: "Edit your request" })).toBeInTheDocument();
    expect(screen.getByLabelText("What you need")).toHaveValue("Desk lamp for res");
    expect(screen.getByLabelText("Category")).toHaveValue("res-living");
    expect(screen.getByLabelText("Campus")).toHaveValue("pretoria");
    expect(screen.getByLabelText("Details")).toHaveValue("A lamp that clips onto a desk.\nBy the weekend.");
    expect(screen.getByLabelText("Budget in rand (optional)")).toHaveValue("150");
    expect(screen.getByLabelText("A swap is welcome")).toBeChecked();
    expect(screen.getByLabelText("Needed by (optional)")).toHaveValue("2026-10-20");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(document.querySelector('input[name="request"]')).toHaveValue("r-abc");
    expect(screen.getByLabelText("What you need")).toHaveAttribute("id", "request-r-abc-title");
  });

  it("shows what was typed and what's wrong after a failed post, each error linked to its field", () => {
    const form = requestForm(
      {
        key: "s:request:new",
        sessionKey: "s",
        form: "request:new",
        errors: ["title-contact", "budget-invalid"],
        values: { title: "Call 0821234567", category: "tech", campus: "midrand", details: "", budget: "lots", swap: "yes", neededBy: "" },
        notice: null,
        expiresAt: "2026-10-14T08:52:00.000Z",
      },
      EMPTY,
      "request-new",
    );
    render(<RequestFormView requestId={null} form={form} campuses={campuses} categories={categories} today={TODAY} />);
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(summary).toHaveAttribute("id", "request-new-summary");
    expect(within(summary).getByRole("link", { name: /Take out the phone number or email/ })).toHaveAttribute(
      "href",
      "#request-new-title",
    );
    expect(screen.getByLabelText("What you need")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("What you need")).toHaveValue("Call 0821234567");
    expect(screen.getByLabelText("Budget in rand (optional)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("A swap is welcome")).toBeChecked();
    expect(screen.getByLabelText("Category")).toHaveValue("tech");
  });

  it("starts from the request, not old form state, when the last post went through", () => {
    expect(requestForm(null, EMPTY, "request-new")).toEqual({ values: EMPTY, errors: [] });
  });

  it("says why a closed or hidden request can't be changed", () => {
    const { unmount } = render(<RequestLocked requestId="r-abc" title="Desk lamp for res" state="closed" />);
    expect(screen.getByText("This request is closed. Reopen it to change it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen Desk lamp for res" })).toHaveAttribute("type", "submit");
    unmount();
    render(<RequestLocked requestId="r-abc" title="Desk lamp for res" state="hidden" />);
    expect(screen.getByText(/The Hub hid this request, so it can't be changed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your requests" })).toHaveAttribute("href", "/account/requests");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

Create `components/looking-for/RequestForm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest, hideRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { RequestForm } from "./RequestForm";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string; campusSlug: string } }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async (next: string) => {
    if (!viewer.account) throw new Error(`sign in, then ${next}`);
    return viewer.account;
  },
}));
vi.mock("@/lib/auth/form-state", () => ({ readFormState: async () => null }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/looking-for/actions", () => ({ saveMyRequest: async () => {}, reopenMyRequest: async () => {} }));

const NOW = new Date("2026-10-14T08:42:00.000Z");
const FIELDS = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "pretoria",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};

beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  viewer.account = null;
});

describe("the request form for this visitor (community actions spec 2.3 and 2.6)", () => {
  it("starts a new request on the account's campus, with today's date limits in SAST", async () => {
    viewer.account = { id: "acc-student", campusSlug: "midrand" };
    render(await RequestForm({ requestId: null }));
    expect(screen.getByLabelText("Campus")).toHaveValue("midrand");
    expect(screen.getByLabelText("Needed by (optional)")).toHaveAttribute("min", "2026-10-14");
  });

  it("fills an edit with the asker's own request", async () => {
    viewer.account = { id: "acc-student", campusSlug: "midrand" };
    const { id } = await createRequest({ askerId: "acc-student", fields: FIELDS, now: NOW });
    render(await RequestForm({ requestId: id }));
    expect(screen.getByLabelText("What you need")).toHaveValue("Desk lamp for res");
    expect(screen.getByLabelText("Campus")).toHaveValue("pretoria");
  });

  it("is the 404 for someone else's request, a sample or an unknown id", async () => {
    const { id } = await createRequest({ askerId: "acc-student", fields: FIELDS, now: NOW });
    viewer.account = { id: "acc-mentor", campusSlug: "midrand" };
    await expect(RequestForm({ requestId: id })).rejects.toThrow("notFound");
    await expect(RequestForm({ requestId: "r-001" })).rejects.toThrow("notFound");
    await expect(RequestForm({ requestId: "nope" })).rejects.toThrow("notFound");
  });

  it("says why a hidden request can't be changed", async () => {
    viewer.account = { id: "acc-student", campusSlug: "midrand" };
    const { id } = await createRequest({ askerId: "acc-student", fields: FIELDS, now: NOW });
    await hideRequest(id, "Not allowed.", NOW);
    render(await RequestForm({ requestId: id }));
    expect(screen.getByText(/The Hub hid this request/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("sends a signed-out visitor to sign in, coming back to the form", async () => {
    await expect(RequestForm({ requestId: null })).rejects.toThrow("sign in, then /looking-for/new");
  });
});
```

In `components/forms/summary-ids.test.tsx`:
1. Add, among the imports in alphabetical order: `import { categories } from "@/data/fixtures/categories";` and `import { RequestFormView, startValues } from "@/components/looking-for/RequestFormView";`.
2. After the last `vi.mock(…)` call, add:

```tsx
vi.mock("@/lib/looking-for/actions", () => ({
  closeMyRequest: async () => {},
  deleteMyRequest: async () => {},
  reopenMyRequest: async () => {},
  saveMyRequest: async () => {},
  sendOffer: async () => {},
}));
```

3. Inside the rendered fragment, after the last form, add:

```tsx
        <RequestFormView
          requestId={null}
          form={{ values: startValues(null, "midrand"), errors: oops }}
          campuses={campuses}
          categories={categories}
          today="2026-10-14"
        />
        <RequestFormView
          requestId="r-001"
          form={{ values: startValues(null, "midrand"), errors: oops }}
          campuses={campuses}
          categories={categories}
          today="2026-10-14"
        />
```

4. Add 2 to the number in `expect(summaries).toHaveLength(…)`, and add `"request-new-summary"` and `"request-r-001-summary"` at the end of the expected list of summary ids.

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test components/looking-for/RequestFormView.test.tsx components/looking-for/RequestForm.test.tsx components/forms/summary-ids.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 4: Write the view**

Create `components/looking-for/RequestFormView.tsx`:

```tsx
import Link from "next/link";
import { CampusSelect } from "@/components/forms/CampusSelect";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { ArrowLeftIcon } from "@/components/icons";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { reopenMyRequest, saveMyRequest } from "@/lib/looking-for/actions";
import { requestErrors, requestFieldIds } from "@/lib/looking-for/errors";
import { requestFieldPrefix, requestPath, YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { addDays, DETAILS_MAX, DETAILS_MIN, NEEDED_BY_DAYS, TITLE_MAX, TITLE_MIN } from "@/lib/looking-for/rules";
import type { Campus, Category, LookingForRequest } from "@/lib/types";

/** What the request form shows in its fields (community actions spec 2.3). */
export type RequestFormValues = {
  title: string;
  category: string;
  campus: string;
  details: string;
  budget: string;
  swap: boolean;
  neededBy: string;
};

export type RequestFormState = { values: RequestFormValues; errors: FormError[] };

/** A new request starts on the account's campus (spec 2.3); an edit starts from the request. */
export function startValues(request: LookingForRequest | null, campusSlug: string): RequestFormValues {
  if (!request) return { title: "", category: "", campus: campusSlug, details: "", budget: "", swap: false, neededBy: "" };
  return {
    title: request.title,
    category: request.categorySlug,
    campus: request.campusSlug,
    details: request.details,
    budget: request.budgetZar === null ? "" : String(request.budgetZar),
    swap: request.swapWelcome,
    neededBy: request.neededBy ?? "",
  };
}

/** After a failed post, what was typed and what's wrong (D decision 3); otherwise `start`. */
export function requestForm(state: FormStateRow | null, start: RequestFormValues, prefix: string): RequestFormState {
  if (!state || state.errors.length === 0) return { values: start, errors: [] };
  const typed = state.values;
  return {
    values: {
      title: typed.title ?? "",
      category: typed.category ?? "",
      campus: typed.campus ?? "",
      details: typed.details ?? "",
      budget: typed.budget ?? "",
      swap: typed.swap === "yes",
      neededBy: typed.neededBy ?? "",
    },
    errors: requestErrors(state.errors, requestFieldIds(prefix)),
  };
}

type RequestFormViewProps = {
  /** The request being edited, or null for a new one. */
  requestId: string | null;
  form: RequestFormState;
  campuses: readonly Pick<Campus, "slug" | "name">[];
  categories: readonly Pick<Category, "slug" | "name">[];
  /** Today in SAST (read after `await connection()`), for the date's first and last days (spec 2.3). */
  today: string;
};

/**
 * The request form (community actions spec 2.3 and section 4): every field labelled, its limits as text, each error
 * linked to its field. A plain form posting to saveMyRequest, so it works before the app's JavaScript arrives. Its
 * ids start with "request-new" or "request-<id>", so a kept page never repeats one (plan decision 2).
 */
export function RequestFormView({ requestId, form, campuses, categories, today }: RequestFormViewProps) {
  const prefix = requestFieldPrefix(requestId);
  const ids = requestFieldIds(prefix);
  const { values, errors } = form;
  const hint = (fieldId: string) => `${fieldId}-hint`;
  const errorId = (fieldId: string) => `${fieldId}-error`;
  const problem = (fieldId: string) => errorFor(errors, fieldId);
  const describe = (fieldId: string, withHint = true) =>
    describedBy(withHint && hint(fieldId), problem(fieldId) && errorId(fieldId));
  const invalid = (fieldId: string) => (problem(fieldId) ? true : undefined);
  const back = requestId
    ? { href: requestPath(requestId), label: "Back to the request" }
    : { href: "/looking-for", label: "Back to Looking For" };
  return (
    <div className="request-form-column">
      <Link href={back.href} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        {back.label}
      </Link>
      <h1 className="request-form-title">{requestId ? "Edit your request" : "Ask for what you need"}</h1>
      {!requestId && (
        <p className="request-form-lede">
          Shops on Vossie see it and offer to help. It never shows your name, only &quot;Asked by a student at&quot; your
          campus.
        </p>
      )}
      <ErrorSummary id={`${prefix}-summary`} errors={errors} />
      <form action={saveMyRequest} noValidate className="form-stack">
        {requestId && <input type="hidden" name="request" value={requestId} />}
        <div className="form-field">
          <label htmlFor={ids.title} className="form-label">
            What you need
          </label>
          <p id={hint(ids.title)} className="form-hint">
            {`Between ${TITLE_MIN} and ${TITLE_MAX} characters, like "Accounting 1 tutor this week".`}
          </p>
          <FieldError id={errorId(ids.title)} message={problem(ids.title)} />
          <input
            id={ids.title}
            name="title"
            type="text"
            required
            defaultValue={values.title}
            aria-invalid={invalid(ids.title)}
            aria-describedby={describe(ids.title)}
            className="form-input"
          />
        </div>
        <div className="form-field">
          <label htmlFor={ids.category} className="form-label">
            Category
          </label>
          <FieldError id={errorId(ids.category)} message={problem(ids.category)} />
          <select
            id={ids.category}
            name="category"
            required
            defaultValue={values.category}
            aria-invalid={invalid(ids.category)}
            aria-describedby={describe(ids.category, false)}
            className="form-input form-select"
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={ids.campus} className="form-label">
            Campus
          </label>
          <p id={hint(ids.campus)} className="form-hint">
            Shops see requests from their own campus first.
          </p>
          <FieldError id={errorId(ids.campus)} message={problem(ids.campus)} />
          <CampusSelect
            id={ids.campus}
            defaultValue={values.campus}
            campuses={campuses}
            invalid={Boolean(problem(ids.campus))}
            describedBy={describe(ids.campus)}
          />
        </div>
        <div className="form-field">
          <label htmlFor={ids.details} className="form-label">
            Details
          </label>
          <p id={hint(ids.details)} className="form-hint">
            {`Say what you need and when. Shops will message you on Vossie. Between ${DETAILS_MIN} and ${DETAILS_MAX} characters.`}
          </p>
          <FieldError id={errorId(ids.details)} message={problem(ids.details)} />
          <textarea
            id={ids.details}
            name="details"
            rows={6}
            required
            defaultValue={values.details}
            aria-invalid={invalid(ids.details)}
            aria-describedby={describe(ids.details)}
            className="form-input request-form-textarea"
          />
        </div>
        <div className="form-field">
          <label htmlFor={ids.budget} className="form-label">
            Budget in rand (optional)
          </label>
          <p id={hint(ids.budget)} className="form-hint">
            Whole rand, like 300. Leave it empty for Open to offers.
          </p>
          <FieldError id={errorId(ids.budget)} message={problem(ids.budget)} />
          <input
            id={ids.budget}
            name="budget"
            type="text"
            inputMode="numeric"
            defaultValue={values.budget}
            aria-invalid={invalid(ids.budget)}
            aria-describedby={describe(ids.budget)}
            className="form-input request-form-short"
          />
        </div>
        <div className="form-check">
          <input
            id={ids.swap}
            name="swap"
            type="checkbox"
            value="yes"
            defaultChecked={values.swap}
            className="form-checkbox"
          />
          <label htmlFor={ids.swap}>A swap is welcome</label>
        </div>
        <div className="form-field">
          <label htmlFor={ids.neededBy} className="form-label">
            Needed by (optional)
          </label>
          <p id={hint(ids.neededBy)} className="form-hint">
            {`Today or within ${NEEDED_BY_DAYS} days, as year, month and day, like ${addDays(today, 7)}.`}
          </p>
          <FieldError id={errorId(ids.neededBy)} message={problem(ids.neededBy)} />
          <input
            id={ids.neededBy}
            name="neededBy"
            type="date"
            min={today}
            max={addDays(today, NEEDED_BY_DAYS)}
            defaultValue={values.neededBy}
            aria-invalid={invalid(ids.neededBy)}
            aria-describedby={describe(ids.neededBy)}
            className="form-input request-form-short"
          />
        </div>
        <button type="submit" className="btn btn-primary form-submit">
          {requestId ? "Save changes" : "Post request"}
        </button>
      </form>
    </div>
  );
}

type RequestLockedProps = { requestId: string; title: string; state: "closed" | "hidden" };

/** A closed or hidden request's edit page: why it can't be changed, and what can be done (plan decision 6). */
export function RequestLocked({ requestId, title, state }: RequestLockedProps) {
  const back =
    state === "closed"
      ? { href: requestPath(requestId), label: "Back to the request" }
      : { href: YOUR_REQUESTS_PATH, label: "Back to Your requests" };
  return (
    <div className="request-form-column">
      <Link href={back.href} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        {back.label}
      </Link>
      <h1 className="request-form-title">Edit your request</h1>
      {state === "closed" ? (
        <div className="request-form-note">
          <p className="form-notice">This request is closed. Reopen it to change it.</p>
          <form action={reopenMyRequest}>
            <input type="hidden" name="request" value={requestId} />
            <button type="submit" className="btn btn-outline text-navy">
              Reopen <span className="sr-only">{title}</span>
            </button>
          </form>
        </div>
      ) : (
        <p className="form-notice">
          The Hub hid this request, so it can&apos;t be changed. You can still delete it from{" "}
          <Link href={YOUR_REQUESTS_PATH} prefetch={false}>
            Your requests
          </Link>
          .
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write the session's part, the skeleton and the pages**

Create `components/looking-for/RequestForm.tsx`:

```tsx
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses, getCategories } from "@/lib/data";
import { getOwnRequest } from "@/lib/data/requests";
import { editRequestPath, NEW_REQUEST_PATH, requestFieldPrefix, requestFormKey } from "@/lib/looking-for/paths";
import { sastDate } from "@/lib/time";
import { RequestFormView, RequestLocked, requestForm, startValues } from "./RequestFormView";

/**
 * The request form for this request's visitor (community actions spec 2.3 and 2.6). Request-time: each page puts it
 * inside <Suspense>. Signed out: sign in, then come back. An edit is the asker's own request, or the 404; a closed or
 * hidden one says why it can't be changed (plan decision 6).
 */
export async function RequestForm({ requestId }: { requestId: string | null }) {
  const account = await requireAccount(requestId ? editRequestPath(requestId) : NEW_REQUEST_PATH);
  const own = requestId ? await getOwnRequest(account.id, requestId) : null;
  if (requestId && !own) notFound();
  if (own && own.state !== "open") {
    return <RequestLocked requestId={own.request.id} title={own.request.title} state={own.state} />;
  }
  // The date's first and last days read the clock (decision 26).
  await connection();
  const today = sastDate(new Date());
  const [state, campuses, categories] = await Promise.all([
    readFormState(requestFormKey(requestId)),
    getCampuses(),
    getCategories(),
  ]);
  const form = requestForm(state, startValues(own?.request ?? null, account.campusSlug), requestFieldPrefix(requestId));
  return <RequestFormView requestId={requestId} form={form} campuses={campuses} categories={categories} today={today} />;
}
```

Create `components/looking-for/RequestFormSkeleton.tsx`:

```tsx
/** The request form's room while it streams in: the back link, the heading and four fields. Wordless. */
export function RequestFormSkeleton() {
  return (
    <div className="request-form-column" aria-hidden="true">
      <span className="skeleton request-form-skeleton-crumb" />
      <span className="skeleton request-form-skeleton-title" />
      <span className="skeleton request-form-skeleton-field" />
      <span className="skeleton request-form-skeleton-field" />
      <span className="skeleton request-form-skeleton-field" />
      <span className="skeleton request-form-skeleton-field" />
    </div>
  );
}
```

Create `app/looking-for/new/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestForm } from "@/components/looking-for/RequestForm";
import { RequestFormSkeleton } from "@/components/looking-for/RequestFormSkeleton";

/** One person's form, so search engines leave it out (plan decision 23). */
export const metadata: Metadata = { title: "Post a request", robots: { index: false } };

/** Post a request (community actions spec 2.3). It needs the session, so it renders per request inside <Suspense>. */
export default function NewRequestPage() {
  return (
    <div className="page request-form-page">
      <Suspense fallback={<RequestFormSkeleton />}>
        <RequestForm requestId={null} />
      </Suspense>
    </div>
  );
}
```

Create `app/looking-for/[id]/edit/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestForm } from "@/components/looking-for/RequestForm";
import { RequestFormSkeleton } from "@/components/looking-for/RequestFormSkeleton";

/** One person's form, so search engines leave it out (plan decision 23). */
export const metadata: Metadata = { title: "Edit your request", robots: { index: false } };

/**
 * One sample id, so the build checks the page keeps its request-time parts inside <Suspense> (plan decision 24). The
 * sample has no asker, so it's the 404 for everyone; every other id renders on its first request.
 */
export function generateStaticParams() {
  return [{ id: "r-001" }];
}

/** Edit your request (community actions spec 2.6). Everything needs the session, so it renders inside <Suspense>. */
export default function EditRequestPage({ params }: PageProps<"/looking-for/[id]/edit">) {
  return (
    <div className="page request-form-page">
      <Suspense fallback={<RequestFormSkeleton />}>
        <EditForVisitor params={params} />
      </Suspense>
    </div>
  );
}

async function EditForVisitor({ params }: Pick<PageProps<"/looking-for/[id]/edit">, "params">) {
  const { id } = await params;
  return <RequestForm requestId={id} />;
}
```

Run: `pnpm test components/looking-for/RequestFormView.test.tsx components/looking-for/RequestForm.test.tsx components/forms/summary-ids.test.tsx`
Expected: PASS.

- [ ] **Step 6: Style it**

Check the names are free (`grep -n "\.request-form" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Community actions: the request form (community actions plan, Task 11, spec 2.3) --- */
@layer components {
  /* .page and .request-form-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .request-form-page {
    padding: 24px 16px 64px;
  }

  .request-form-column {
    display: grid;
    gap: 20px;
    max-width: 40rem;
  }

  .request-form-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
  }

  .request-form-lede {
    max-width: 60ch;
    color: var(--color-muted);
  }

  .request-form-textarea {
    min-height: 9rem;
    resize: vertical;
  }

  /* A budget and a date need little room. */
  .request-form-short {
    max-width: 14rem;
  }

  .request-form-note {
    display: grid;
    justify-items: start;
    gap: 12px;
  }

  .request-form-skeleton-crumb {
    width: 10rem;
    height: 44px;
  }

  .request-form-skeleton-title {
    width: 16rem;
    height: 2.5rem;
  }

  .request-form-skeleton-field {
    height: 5.5rem;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .request-form-page {
      padding-inline: 40px;
    }
  }
}
```

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 10 more unit tests than after Task 10 (the summary test's count changes but it stays one test). The build lists `/looking-for/new` and `/looking-for/[id]/edit` as partly prerendered, with no error about uncached data outside `<Suspense>`.

- [ ] **Step 8: Look at it**

Start the build (`pnpm start --port 3201`). Signed out, `/looking-for/new` goes to sign-in and back. Signed in as "Student, Midrand", at 390 × 844, 768 × 1024 and 1280 × 800: "ASK FOR WHAT YOU NEED", every field with its hint, the campus on Midrand, the date picker limited to the next 90 days. Press **Post request** empty: the summary lists each problem and each link jumps to its field. Fill it in with "Call 0821234567" in the details: the contact message. Fix it and post: the request's page opens (its asker's panel comes in Task 15). Open `/looking-for/<id>/edit`: the form is filled in; **Save changes** returns to the page. Stop the server.

- [ ] **Step 9: Hand over for commit**

Files: `components/looking-for/RequestFormView.tsx`, `components/looking-for/RequestFormView.test.tsx`, `components/looking-for/RequestForm.tsx`, `components/looking-for/RequestForm.test.tsx`, `components/looking-for/RequestFormSkeleton.tsx`, `app/looking-for/new/page.tsx`, `app/looking-for/[id]/edit/page.tsx`, `components/forms/summary-ids.test.tsx`, `app/globals.css`.
Message: `feat: the request form: Post a request and Edit your request, every field labelled with its limits, errors linked to their fields, a closed or hidden request saying why it can't change (community actions spec 2.3 and 2.6)`

---

### Task 12: Delete request and Your requests

The delete confirm page (`/looking-for/[id]/delete`, spec 2.6) with **Delete request** and **Keep it**, and **Your requests** (`/account/requests`, spec 2.13, plan decision 18): open, then closed, then hidden, each newest first, with its state, offers, date, the Hub's reason for a hidden one, and the actions its state allows. The actions are one component, `RequestActions`, which the request page's asker panel reuses in Task 15.

**Files:**
- Create: `components/looking-for/RequestActions.tsx`
- Create: `components/looking-for/YourRequestsView.tsx`, `components/looking-for/YourRequestsView.test.tsx`
- Create: `components/looking-for/YourRequests.tsx`, `components/looking-for/YourRequests.test.tsx`
- Create: `components/looking-for/DeleteRequestView.tsx`, `components/looking-for/DeleteRequest.tsx`, `components/looking-for/DeleteRequest.test.tsx`
- Create: `app/account/requests/page.tsx`, `app/looking-for/[id]/delete/page.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Write the tests**

Create `components/looking-for/YourRequestsView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OwnRequest } from "@/lib/types";
import { YourRequestsView } from "./YourRequestsView";

vi.mock("@/lib/looking-for/actions", () => ({ closeMyRequest: async () => {}, reopenMyRequest: async () => {} }));

const own = (id: string, title: string, state: OwnRequest["state"], hiddenReason: string | null = null): OwnRequest => ({
  request: {
    id,
    title,
    campusSlug: "midrand",
    offers: state === "open" ? 2 : 0,
    details: "Some details that are long enough.",
    categorySlug: "res-living",
    budgetZar: null,
    swapWelcome: false,
    neededBy: null,
    createdAt: "2026-10-13T07:30:00.000Z",
    status: state === "closed" ? "closed" : "open",
  },
  state,
  hiddenReason,
});

const ITEMS = [
  own("r-a", "Desk lamp for res", "open"),
  own("r-b", "Kettle for res", "closed"),
  own("r-c", "Exam answers", "hidden", "Selling exam answers isn't allowed."),
];

describe("Your requests (community actions spec 2.13, plan decision 18)", () => {
  it("lists each request with its state, offers and date, and the actions its state allows", () => {
    render(<YourRequestsView items={ITEMS} notice={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Your requests" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute("href", "/looking-for/new");
    const [open, closed, hidden] = screen.getAllByRole("listitem");
    expect(within(open).getByRole("link", { name: "Desk lamp for res" })).toHaveAttribute("href", "/looking-for/r-a");
    expect(open).toHaveTextContent("Open · 2 offers · Posted 13 Oct");
    expect(within(open).getByRole("link", { name: "Edit Desk lamp for res" })).toHaveAttribute(
      "href",
      "/looking-for/r-a/edit",
    );
    expect(within(open).getByRole("button", { name: "Close Desk lamp for res" })).toHaveAttribute("type", "submit");
    expect(within(open).getByRole("link", { name: "Delete Desk lamp for res" })).toHaveAttribute(
      "href",
      "/looking-for/r-a/delete",
    );
    expect(within(closed).getByRole("button", { name: "Reopen Kettle for res" })).toBeInTheDocument();
    expect(within(closed).queryByRole("link", { name: /^Edit/ })).toBeNull();
    expect(within(hidden).queryByRole("link", { name: "Exam answers" })).toBeNull();
    expect(hidden).toHaveTextContent("Hidden by the Hub");
    expect(hidden).toHaveTextContent("The Hub's reason: Selling exam answers isn't allowed.");
    expect(within(hidden).queryByRole("button")).toBeNull();
    expect(within(hidden).getByRole("link", { name: "Delete Exam answers" })).toBeInTheDocument();
  });

  it("posts Close and Reopen from the list, so they land back here", () => {
    render(<YourRequestsView items={ITEMS} notice={null} />);
    for (const input of document.querySelectorAll('input[name="from"]')) expect(input).toHaveValue("list");
    expect(document.querySelectorAll('input[name="from"]')).toHaveLength(2);
  });

  it("says what the last action did, and invites a first request when there's none", () => {
    const { unmount } = render(<YourRequestsView items={ITEMS} notice="Request deleted." />);
    expect(screen.getByRole("status")).toHaveTextContent("Request deleted.");
    unmount();
    render(<YourRequestsView items={[]} notice={null} />);
    expect(screen.getByText("You haven't asked for anything yet.")).toBeInTheDocument();
  });
});
```

Create `components/looking-for/YourRequests.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { YourRequests } from "./YourRequests";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));
const note = vi.hoisted(() => ({ notice: null as string | null }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async (next: string) => {
    if (!viewer.account) throw new Error(`sign in, then ${next}`);
    return viewer.account;
  },
}));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async () => (note.notice ? { notice: note.notice, values: {} } : null),
}));
vi.mock("@/lib/looking-for/actions", () => ({ closeMyRequest: async () => {}, reopenMyRequest: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
  note.notice = null;
});

describe("Your requests for this visitor (community actions spec 2.13)", () => {
  it("lists only the visitor's own requests, with the last action's status line", async () => {
    await createRequest({
      askerId: "acc-student",
      fields: {
        title: "Desk lamp for res",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: null,
        swapWelcome: false,
        neededBy: null,
      },
      now: new Date("2026-10-14T08:42:00.000Z"),
    });
    viewer.account = { id: "acc-student" };
    note.notice = "posted";
    render(await YourRequests());
    expect(screen.getByRole("link", { name: "Desk lamp for res" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your request is up.");
    expect(screen.queryByText("Accounting 1 tutor this week")).toBeNull();
  });

  it("sends a signed-out visitor to sign in, coming back here", async () => {
    await expect(YourRequests()).rejects.toThrow("sign in, then /account/requests");
  });
});
```

Create `components/looking-for/DeleteRequest.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest, hideRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { DeleteRequest } from "./DeleteRequest";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async (next: string) => {
    if (!viewer.account) throw new Error(`sign in, then ${next}`);
    return viewer.account;
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/looking-for/actions", () => ({ deleteMyRequest: async () => {} }));

const NOW = new Date("2026-10-14T08:42:00.000Z");
const post = () =>
  createRequest({
    askerId: "acc-student",
    fields: {
      title: "Desk lamp for res",
      categorySlug: "res-living",
      campusSlug: "midrand",
      details: "A lamp that clips onto a desk, by the weekend.",
      budgetZar: null,
      swapWelcome: false,
      neededBy: null,
    },
    now: NOW,
  });

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
});

describe("Delete request's confirm page (community actions spec 2.6 and section 4)", () => {
  it("repeats what will happen, with Delete request and Keep it", async () => {
    const { id } = await post();
    viewer.account = { id: "acc-student" };
    render(await DeleteRequest({ requestId: id }));
    expect(screen.getByRole("heading", { level: 1, name: "Delete your request" })).toBeInTheDocument();
    expect(screen.getByText("Delete Desk lamp for res? This can't be undone.")).toBeInTheDocument();
    expect(screen.getByText(/marked "This request was removed"/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete request" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="request"]')).toHaveValue(id);
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", `/looking-for/${id}`);
  });

  it("keeps a hidden request's way back on Your requests, since its page is gone", async () => {
    const { id } = await post();
    await hideRequest(id, "Not allowed.", NOW);
    viewer.account = { id: "acc-student" };
    render(await DeleteRequest({ requestId: id }));
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/account/requests");
  });

  it("is the 404 for anyone but the asker", async () => {
    const { id } = await post();
    viewer.account = { id: "acc-mentor" };
    await expect(DeleteRequest({ requestId: id })).rejects.toThrow("notFound");
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/looking-for/YourRequestsView.test.tsx components/looking-for/YourRequests.test.tsx components/looking-for/DeleteRequest.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 3: Write the actions' buttons**

Create `components/looking-for/RequestActions.tsx`:

```tsx
import Link from "next/link";
import { closeMyRequest, reopenMyRequest } from "@/lib/looking-for/actions";
import { deleteRequestPath, editRequestPath } from "@/lib/looking-for/paths";
import type { OwnRequest } from "@/lib/types";

/**
 * What the asker can do with a request (community actions spec 2.6, plan decision 6): Edit while it's open, Close or
 * Reopen (a form button each, posting where it came from), and Delete, through its confirm page. A hidden request can
 * only be deleted. Each names its request in visually hidden text (spec section 4).
 */
export function RequestActions({ own, from }: { own: OwnRequest; from: "page" | "list" }) {
  const { request, state } = own;
  const fields = (
    <>
      <input type="hidden" name="request" value={request.id} />
      {from === "list" && <input type="hidden" name="from" value="list" />}
    </>
  );
  return (
    <div className="requests-actions">
      {state === "open" && (
        <Link href={editRequestPath(request.id)} prefetch={false} className="btn btn-outline text-navy">
          Edit <span className="sr-only">{request.title}</span>
        </Link>
      )}
      {state === "open" && (
        <form action={closeMyRequest}>
          {fields}
          <button type="submit" className="btn btn-outline text-navy">
            Close <span className="sr-only">{request.title}</span>
          </button>
        </form>
      )}
      {state === "closed" && (
        <form action={reopenMyRequest}>
          {fields}
          <button type="submit" className="btn btn-outline text-navy">
            Reopen <span className="sr-only">{request.title}</span>
          </button>
        </form>
      )}
      <Link href={deleteRequestPath(request.id)} prefetch={false} className="btn btn-outline text-danger">
        Delete <span className="sr-only">{request.title}</span>
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Write Your requests**

Create `components/looking-for/YourRequestsView.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { offersLabel } from "@/lib/format";
import { NEW_REQUEST_PATH, requestPath } from "@/lib/looking-for/paths";
import { requestStateLabel } from "@/lib/looking-for/words";
import { shortSastDate } from "@/lib/time";
import type { OwnRequest } from "@/lib/types";
import { RequestActions } from "./RequestActions";

type YourRequestsViewProps = {
  /** Open, then closed, then hidden, each newest first (plan decision 18). */
  items: readonly OwnRequest[];
  /** The last action's words, once (plan decision 7). */
  notice: string | null;
};

/**
 * Your requests (community actions spec 2.13): every request the account has posted, with where it stands, its
 * offers and when, the Hub's reason for a hidden one, and what can be done with it. Post a request at the top.
 */
export function YourRequestsView({ items, notice }: YourRequestsViewProps) {
  return (
    <div className="requests-column">
      <Link href="/account" prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        Back to your account
      </Link>
      <div className="requests-head">
        <h1 className="requests-title">Your requests</h1>
        <Link href={NEW_REQUEST_PATH} prefetch={false} className="btn btn-primary">
          Post a request
        </Link>
      </div>
      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}
      <section aria-labelledby="requests-list-title">
        <h2 id="requests-list-title" className="sr-only">
          Your requests, open first
        </h2>
        {items.length === 0 ? (
          <p className="requests-empty">You haven&apos;t asked for anything yet.</p>
        ) : (
          <ul className="requests-list">
            {items.map((own) => {
              const { request, state } = own;
              return (
                <li key={request.id} className="requests-item">
                  <h3 className="requests-item-title">
                    {state === "hidden" ? (
                      request.title
                    ) : (
                      <Link href={requestPath(request.id)} prefetch={false}>
                        {request.title}
                      </Link>
                    )}
                  </h3>
                  <p className="requests-item-meta">
                    <span className="requests-state" data-state={state}>
                      {requestStateLabel(state)}
                    </span>
                    {` · ${offersLabel(request.offers)} · Posted `}
                    <time dateTime={request.createdAt}>{shortSastDate(request.createdAt)}</time>
                  </p>
                  {state === "hidden" && (
                    <p className="requests-reason">The Hub&apos;s reason: {own.hiddenReason ?? "none given"}</p>
                  )}
                  <RequestActions own={own} from="list" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
```

Create `components/looking-for/YourRequests.tsx`:

```tsx
import { requireAccount } from "@/lib/auth/session";
import { listOwnRequests } from "@/lib/data/requests";
import { takeNote } from "@/lib/looking-for/form-state";
import { YOUR_REQUESTS_FORM, YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { requestNoticeText } from "@/lib/looking-for/words";
import { YourRequestsView } from "./YourRequestsView";

/** Your requests for this request's visitor (community actions spec 2.13). Request-time: inside <Suspense>. */
export async function YourRequests() {
  const account = await requireAccount(YOUR_REQUESTS_PATH);
  const [items, note] = await Promise.all([listOwnRequests(account.id), takeNote(YOUR_REQUESTS_FORM)]);
  return <YourRequestsView items={items} notice={requestNoticeText(note?.notice)} />;
}

/** The list's room while it streams in. Wordless. */
export function YourRequestsSkeleton() {
  return (
    <div className="requests-column" aria-hidden="true">
      <span className="skeleton request-form-skeleton-crumb" />
      <span className="skeleton request-form-skeleton-title" />
      <span className="skeleton requests-skeleton-item" />
      <span className="skeleton requests-skeleton-item" />
    </div>
  );
}
```

- [ ] **Step 5: Write the confirm page's parts**

Create `components/looking-for/DeleteRequestView.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { deleteMyRequest } from "@/lib/looking-for/actions";
import { requestPath, YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import type { OwnRequest } from "@/lib/types";

/**
 * Delete request's confirm page (community actions spec 2.6 and section 4): what will happen, Delete request, and Keep
 * it back to the request, or to Your requests for a hidden one, whose page is gone.
 */
export function DeleteRequestView({ own }: { own: OwnRequest }) {
  const { request } = own;
  const keep = own.state === "hidden" ? YOUR_REQUESTS_PATH : requestPath(request.id);
  return (
    <div className="request-form-column">
      <Link href={keep} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        {own.state === "hidden" ? "Back to Your requests" : "Back to the request"}
      </Link>
      <h1 className="request-form-title">Delete your request</h1>
      <p className="requests-lead">{`Delete ${request.title}? This can't be undone.`}</p>
      <ul className="requests-consequences">
        <li>Its page goes, and shops can&apos;t offer on it.</li>
        <li>Conversations with shops that offered stay in your messages, marked &quot;This request was removed&quot;.</li>
      </ul>
      <div className="requests-confirm">
        <form action={deleteMyRequest}>
          <input type="hidden" name="request" value={request.id} />
          <button type="submit" className="btn btn-danger">
            Delete request
          </button>
        </form>
        <Link href={keep} prefetch={false} className="btn btn-outline text-navy">
          Keep it
        </Link>
      </div>
    </div>
  );
}
```

Create `components/looking-for/DeleteRequest.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/session";
import { getOwnRequest } from "@/lib/data/requests";
import { deleteRequestPath } from "@/lib/looking-for/paths";
import { DeleteRequestView } from "./DeleteRequestView";

/** The confirm page for this visitor (community actions spec 2.6): the asker's own request, or the 404. Inside <Suspense>. */
export async function DeleteRequest({ requestId }: { requestId: string }) {
  const account = await requireAccount(deleteRequestPath(requestId));
  const own = await getOwnRequest(account.id, requestId);
  if (!own) notFound();
  return <DeleteRequestView own={own} />;
}
```

- [ ] **Step 6: Write the pages**

Create `app/account/requests/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { YourRequests, YourRequestsSkeleton } from "@/components/looking-for/YourRequests";

/** One person's list, so search engines leave it out (`/account` is in robots.txt too). */
export const metadata: Metadata = { title: "Your requests", robots: { index: false } };

/** Your requests (community actions spec 2.13). It needs the session, so it renders per request inside <Suspense>. */
export default function YourRequestsPage() {
  return (
    <div className="page requests-page">
      <Suspense fallback={<YourRequestsSkeleton />}>
        <YourRequests />
      </Suspense>
    </div>
  );
}
```

Create `app/looking-for/[id]/delete/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteRequest } from "@/components/looking-for/DeleteRequest";
import { RequestFormSkeleton } from "@/components/looking-for/RequestFormSkeleton";

/** One person's page, so search engines leave it out (plan decision 23). */
export const metadata: Metadata = { title: "Delete your request", robots: { index: false } };

/** One sample id (plan decision 24): the sample has no asker, so it's the 404; other ids render on first request. */
export function generateStaticParams() {
  return [{ id: "r-001" }];
}

/** Delete request's confirm page (community actions spec 2.6). It needs the session, so it renders inside <Suspense>. */
export default function DeleteRequestPage({ params }: PageProps<"/looking-for/[id]/delete">) {
  return (
    <div className="page request-form-page">
      <Suspense fallback={<RequestFormSkeleton />}>
        <DeleteForVisitor params={params} />
      </Suspense>
    </div>
  );
}

async function DeleteForVisitor({ params }: Pick<PageProps<"/looking-for/[id]/delete">, "params">) {
  const { id } = await params;
  return <DeleteRequest requestId={id} />;
}
```

Run: `pnpm test components/looking-for/YourRequestsView.test.tsx components/looking-for/YourRequests.test.tsx components/looking-for/DeleteRequest.test.tsx`
Expected: PASS.

- [ ] **Step 7: Style it**

Check the names are free (`grep -n "\.requests-" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Community actions: Your requests and Delete request (community actions plan, Task 12, spec 2.6 and 2.13) --- */
@layer components {
  /* .page and .requests-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .requests-page {
    padding: 24px 16px 64px;
  }

  .requests-column {
    display: grid;
    gap: 20px;
    max-width: 48rem;
  }

  .requests-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .requests-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
  }

  .requests-list {
    display: grid;
    gap: 12px;
  }

  .requests-item {
    display: grid;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
  }

  /* Links on white are sky-dark. */
  .requests-item-title {
    color: var(--color-navy);
    font-size: 17px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .requests-item-title a {
    color: var(--color-sky-dark);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .requests-item-meta {
    color: var(--color-muted);
    font-size: 14px;
  }

  .requests-state {
    color: var(--color-navy);
    font-weight: 600;
  }

  .requests-reason {
    padding: 10px 12px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
    color: var(--color-ink);
    font-size: 14px;
  }

  .requests-actions,
  .requests-confirm {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .requests-empty {
    padding: 24px 20px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  .requests-lead {
    color: var(--color-navy);
    font-weight: 600;
  }

  .requests-consequences {
    display: grid;
    gap: 6px;
    padding-left: 1.25rem;
    list-style: disc;
  }

  .requests-skeleton-item {
    height: 8rem;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .requests-page {
      padding-inline: 40px;
    }
  }
}
```

- [ ] **Step 8: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 8 more unit tests than after Task 11. The build lists `/account/requests` and `/looking-for/[id]/delete` as partly prerendered, with no error about uncached data outside `<Suspense>`.

- [ ] **Step 9: Look at it**

Start the build (`pnpm start --port 3201`). Sign in as "Student, Midrand", post two requests from `/looking-for/new`, close one from its page (the button comes in Task 15; for now use `/account/requests`), at 390 × 844 and 1280 × 800: Your requests lists the open one first, each with "Open · No offers yet · Posted …" or "Closed …", and the buttons wrap on phones. Delete one: the confirm page lists what happens; **Keep it** goes back; **Delete request** lands on Your requests with "Request deleted.", and the request's page is the 404. Stop the server.

- [ ] **Step 10: Hand over for commit**

Files: `components/looking-for/RequestActions.tsx`, `components/looking-for/YourRequestsView.tsx`, `components/looking-for/YourRequestsView.test.tsx`, `components/looking-for/YourRequests.tsx`, `components/looking-for/YourRequests.test.tsx`, `components/looking-for/DeleteRequestView.tsx`, `components/looking-for/DeleteRequest.tsx`, `components/looking-for/DeleteRequest.test.tsx`, `app/account/requests/page.tsx`, `app/looking-for/[id]/delete/page.tsx`, `app/globals.css`.
Message: `feat: Your requests (open, closed and hidden, with offers, the Hub's reason and each one's actions) and Delete request's confirm page (community actions spec 2.6 and 2.13)`

---

### Task 13: The offer composer: `/looking-for/[id]/offer`

**Offer to help** opens a page like E's composer (spec 2.8 and 2.9; plan decisions 12 and 13): the request's summary (title, campus, budget, needed by), the h1 "Offer to help", the offer (up to 1,000 characters, a static hint), an optional "Point to one of your listings" select, E's three tips beside it and E's scam check on Send offer; or, for anyone who can't offer, why not. It reuses E's composer layout and parts. E's `SafetyTips` takes an id, so this page's tips never repeat the listing composer's ids.

**Files:**
- Modify: `components/messages/SafetyTips.tsx`
- Create: `components/looking-for/OfferView.tsx`, `components/looking-for/OfferView.test.tsx`
- Create: `components/looking-for/Offer.tsx`, `components/looking-for/Offer.test.tsx`
- Create: `app/looking-for/[id]/offer/page.tsx`
- Modify: `components/forms/summary-ids.test.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Write the tests**

Create `components/looking-for/OfferView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { requests } from "@/data/fixtures/requests";
import type { OfferStatus } from "@/lib/looking-for/subjects";
import { OfferView, offerForm } from "./OfferView";

vi.mock("@/lib/looking-for/actions", () => ({ sendOffer: async () => {} }));

const SUBJECT = { request: requests[0], campusName: "Midrand" };
const OPEN: OfferStatus = {
  kind: "open",
  askerId: "acc-student",
  shopSlug: "tech-corner",
  listings: [{ id: "l-001", title: "Casio fx-991ZA Plus calculator" }],
};
const EMPTY = offerForm(null, "offer-r-001");

describe("the offer composer (community actions spec 2.9)", () => {
  it("shows the request, Offer to help, the offer field, the listings to point to, and E's tips", () => {
    render(<OfferView subject={SUBJECT} status={OPEN} form={EMPTY} />);
    expect(screen.getByRole("heading", { level: 1, name: "Offer to help" })).toBeInTheDocument();
    expect(screen.getByText("Accounting 1 tutor this week")).toBeInTheDocument();
    expect(screen.getByText("Budget R300")).toBeInTheDocument();
    expect(screen.getByText(/Needed by/)).toHaveTextContent("Needed by 16 Oct");
    expect(screen.getByLabelText("Your offer")).toHaveAccessibleDescription(
      "Up to 1,000 characters. Say how you can help, what it costs and when.",
    );
    const select = screen.getByLabelText("Point to one of your listings (optional)");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "None",
      "Casio fx-991ZA Plus calculator",
    ]);
    expect(screen.getByRole("button", { name: "Send offer" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="request"]')).toHaveValue("r-001");
    expect(screen.getByRole("region", { name: "Stay safe" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the request" })).toHaveAttribute("href", "/looking-for/r-001");
  });

  it("leaves the select out when the shop has nothing listed", () => {
    render(<OfferView subject={SUBJECT} status={{ ...OPEN, listings: [] }} form={EMPTY} />);
    expect(screen.queryByLabelText("Point to one of your listings (optional)")).toBeNull();
  });

  it("says why anyone else can't offer, with the way on (plan decision 12)", () => {
    const cases: Array<[OfferStatus, string, string | null]> = [
      [{ kind: "no-shop" }, "Offers come from shops on Vossie, so the Hub has checked who's offering.", "Start selling"],
      [{ kind: "pending" }, "Your shop can make offers once the Hub approves it.", "Go to your shop"],
      [{ kind: "paused" }, "Your shop is paused, so it can't make offers right now.", "Go to your shop"],
      [{ kind: "own" }, "This is your request, so you can't offer on it.", null],
      [{ kind: "closed" }, "This request is closed, so it isn't taking offers.", null],
      [{ kind: "sample" }, "This is one of Vossie's sample requests, so it can't take offers.", null],
      [{ kind: "offered", conversationId: "conv-abc" }, "You've offered already.", "Open the conversation"],
    ];
    for (const [status, sentence, link] of cases) {
      const { unmount } = render(<OfferView subject={SUBJECT} status={status} form={EMPTY} />);
      expect(screen.getByText(sentence)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Send offer" })).toBeNull();
      if (link) expect(screen.getByRole("link", { name: link })).toBeInTheDocument();
      unmount();
    }
    render(<OfferView subject={SUBJECT} status={{ kind: "offered", conversationId: "conv-abc" }} form={EMPTY} />);
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute("href", "/messages/conv-abc");
  });

  it("keeps the typed offer and says what's wrong, or asks to check scam words, with Send anyway", () => {
    const state = (errors: string[], notice: string | null, values: Record<string, string>) => ({
      key: "s:offer:r-001",
      sessionKey: "s",
      form: "offer:r-001",
      errors,
      values,
      notice,
      expiresAt: "2026-10-14T08:52:00.000Z",
    });
    const { unmount } = render(
      <OfferView subject={SUBJECT} status={OPEN} form={offerForm(state(["offer-rate"], null, { body: "Hi", listing: "l-001" }), "offer-r-001")} />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveAttribute("id", "offer-r-001-summary");
    expect(screen.getByLabelText("Your offer")).toHaveValue("Hi");
    expect(screen.getByLabelText("Point to one of your listings (optional)")).toHaveValue("l-001");
    unmount();
    render(
      <OfferView
        subject={SUBJECT}
        status={OPEN}
        form={offerForm(state([], "check", { body: "Pay a deposit first.", listing: "", warnings: "deposit" }), "offer-r-001")}
      />,
    );
    expect(screen.getByRole("alert", { name: "Check this before you send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send anyway" })).toHaveAttribute("value", "yes");
  });
});
```

Create `components/looking-for/Offer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest, hideRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import type { Account } from "@/lib/types";
import { Offer } from "./Offer";

const viewer = vi.hoisted(() => ({ account: null as null | Pick<Account, "id" | "seller"> }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async (next: string) => {
    if (!viewer.account) throw new Error(`sign in, then ${next}`);
    return viewer.account;
  },
}));
vi.mock("@/lib/auth/form-state", () => ({ readFormState: async () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/looking-for/actions", () => ({ sendOffer: async () => {} }));

const NOW = new Date("2026-10-14T08:42:00.000Z");
const post = () =>
  createRequest({
    askerId: "acc-student",
    fields: {
      title: "Desk lamp for res",
      categorySlug: "res-living",
      campusSlug: "midrand",
      details: "A lamp that clips onto a desk, by the weekend.",
      budgetZar: null,
      swapWelcome: false,
      neededBy: null,
    },
    now: NOW,
  });

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
});

describe("the offer composer for this visitor (community actions spec 2.8 and 2.9)", () => {
  it("gives an approved shop the form", async () => {
    const { id } = await post();
    viewer.account = { id: "acc-seller", seller: { status: "approved", sellerSlug: "tech-corner" } };
    render(await Offer({ requestId: id }));
    expect(screen.getByRole("button", { name: "Send offer" })).toBeInTheDocument();
  });

  it("tells a student without a shop where offers come from", async () => {
    const { id } = await post();
    viewer.account = { id: "acc-mentor", seller: null };
    render(await Offer({ requestId: id }));
    expect(screen.getByRole("link", { name: "Start selling" })).toHaveAttribute("href", "/sell");
  });

  it("is the 404 for a hidden or unknown request, even signed out", async () => {
    await hideRequest("r-001", "Not allowed.", NOW);
    await expect(Offer({ requestId: "r-001" })).rejects.toThrow("notFound");
    await expect(Offer({ requestId: "nope" })).rejects.toThrow("notFound");
  });

  it("sends a signed-out visitor to sign in, coming back to the composer", async () => {
    const { id } = await post();
    await expect(Offer({ requestId: id })).rejects.toThrow(`sign in, then /looking-for/${id}/offer`);
  });
});
```

In `components/forms/summary-ids.test.tsx`:
1. Add, among the imports in alphabetical order: `import { requests } from "@/data/fixtures/requests";` and `import { OfferView } from "@/components/looking-for/OfferView";`.
2. Inside the rendered fragment, after Task 11's two request forms, add:

```tsx
        <OfferView
          subject={{ request: requests[0], campusName: "Midrand" }}
          status={{ kind: "open", askerId: "acc-student", shopSlug: "tech-corner", listings: [] }}
          form={{ body: "", listing: "", errors: oops, warnings: [] }}
        />
```

3. Add 1 to the number in `expect(summaries).toHaveLength(…)`, and add `"offer-r-001-summary"` at the end of the expected list of summary ids.

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/looking-for/OfferView.test.tsx components/looking-for/Offer.test.tsx components/forms/summary-ids.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 3: E's tips take an id**

In `components/messages/SafetyTips.tsx` (E Task 8), replace the function's first lines so it reads:

```tsx
/**
 * The three tips always beside the composer (messaging spec 2.3), and the way to the safety page. `id` names its
 * heading ("<id>-title"): each composer passes its own, so a kept page never repeats it (community actions plan
 * decision 2).
 */
export function SafetyTips({ id = "composer-tips" }: { id?: string }) {
  const titleId = `${id}-title`;
  return (
    <section aria-labelledby={titleId} className="msg-tips">
      <h2 id={titleId} className="msg-tips-title">
```

(the rest of the component stays as it is). E's composer calls `<SafetyTips />`, so its ids don't change.

- [ ] **Step 4: Write the composer**

Create `components/looking-for/OfferView.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { ArrowLeftIcon } from "@/components/icons";
import { MessageField } from "@/components/messages/MessageField";
import { SafetyTips } from "@/components/messages/SafetyTips";
import { ScamCheck } from "@/components/messages/ScamCheck";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { budgetLabel, dayMonth } from "@/lib/format";
import { sendOffer } from "@/lib/looking-for/actions";
import { offerErrors, offerFieldIds } from "@/lib/looking-for/errors";
import { offerFieldPrefix, requestPath } from "@/lib/looking-for/paths";
import type { OfferStatus, OfferSubject } from "@/lib/looking-for/subjects";
import { threadPath } from "@/lib/messaging/paths";
import { parseWarnings, type ScamWarning } from "@/lib/messaging/scam-check";
import type { LookingForRequest } from "@/lib/types";

/** The composer's fields after a post (D decision 3): what was typed, what's wrong, and the scam check's warnings. */
export type OfferForm = { body: string; listing: string; errors: FormError[]; warnings: ScamWarning[] };

export function offerForm(state: FormStateRow | null, prefix: string): OfferForm {
  if (!state) return { body: "", listing: "", errors: [], warnings: [] };
  return {
    body: state.values.body ?? "",
    listing: state.values.listing ?? "",
    errors: offerErrors(state.errors, offerFieldIds(prefix)),
    warnings: state.notice === "check" ? parseWarnings(state.values.warnings) : [],
  };
}

/** A note instead of the form, with the way on when there is one (plan decision 12). */
function Note({ sentence, link }: { sentence: string; link?: { href: string; label: string; primary?: boolean } }) {
  return (
    <div className="offer-note">
      <p className="form-notice">{sentence}</p>
      {link && (
        <Link href={link.href} prefetch={false} className={link.primary ? "btn btn-primary" : "btn btn-outline text-navy"}>
          {link.label}
        </Link>
      )}
    </div>
  );
}

/** What the offer answers (spec 2.9): the title, campus, budget and needed by. The asker isn't named. */
function RequestSummary({ request, campusName }: { request: LookingForRequest; campusName: string }) {
  return (
    <div className="offer-summary">
      <p className="offer-summary-eyebrow">Looking For</p>
      <p className="offer-summary-title">{request.title}</p>
      <ul className="fact-pills">
        <li>{campusName}</li>
        <li>{budgetLabel(request)}</li>
        {request.neededBy && (
          <li>
            Needed by <time dateTime={request.neededBy}>{dayMonth(request.neededBy)}</time>
          </li>
        )}
      </ul>
    </div>
  );
}

type OfferViewProps = { subject: OfferSubject; status: OfferStatus; form: OfferForm };

/**
 * The offer composer (community actions spec 2.9): the request, "Offer to help", the form or why there's none, and
 * E's three tips. Laid out like E's composer, with its classes. Its ids start "offer-<id>" (plan decision 2).
 */
export function OfferView({ subject, status, form }: OfferViewProps) {
  const { request, campusName } = subject;
  let main: ReactNode;
  switch (status.kind) {
    case "open":
      main = <OfferFormView request={request} listings={status.listings} form={form} />;
      break;
    case "no-shop":
      main = (
        <Note
          sentence="Offers come from shops on Vossie, so the Hub has checked who's offering."
          link={{ href: "/sell", label: "Start selling", primary: true }}
        />
      );
      break;
    case "pending":
      main = (
        <Note sentence="Your shop can make offers once the Hub approves it." link={{ href: "/sell", label: "Go to your shop" }} />
      );
      break;
    case "paused":
      main = (
        <Note sentence="Your shop is paused, so it can't make offers right now." link={{ href: "/sell", label: "Go to your shop" }} />
      );
      break;
    case "own":
      main = <Note sentence="This is your request, so you can't offer on it." />;
      break;
    case "closed":
      main = <Note sentence="This request is closed, so it isn't taking offers." />;
      break;
    case "sample":
      main = <Note sentence="This is one of Vossie's sample requests, so it can't take offers." />;
      break;
    case "offered":
      main = (
        <Note
          sentence="You've offered already."
          link={{ href: threadPath(status.conversationId), label: "Open the conversation", primary: true }}
        />
      );
      break;
  }
  return (
    <>
      <Link href={requestPath(request.id)} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        Back to the request
      </Link>
      <h1 className="composer-title">Offer to help</h1>
      <div className="composer-layout">
        <div className="composer-main">
          <RequestSummary request={request} campusName={campusName} />
          {main}
        </div>
        <SafetyTips id={`${offerFieldPrefix(request.id)}-tips`} />
      </div>
    </>
  );
}

type OfferFormViewProps = {
  request: LookingForRequest;
  listings: readonly { id: string; title: string }[];
  form: OfferForm;
};

/** The form itself: the offer, a listing to point to when the shop has any (plan decision 13), the check, Send offer. */
function OfferFormView({ request, listings, form }: OfferFormViewProps) {
  const prefix = offerFieldPrefix(request.id);
  const ids = offerFieldIds(prefix);
  const listingHint = `${ids.listing}-hint`;
  return (
    <>
      <ErrorSummary id={`${prefix}-summary`} errors={form.errors} />
      <form action={sendOffer} noValidate className="form-stack composer-form">
        <input type="hidden" name="request" value={request.id} />
        <MessageField
          id={ids.body}
          name="body"
          label="Your offer"
          hint="Up to 1,000 characters. Say how you can help, what it costs and when."
          defaultValue={form.body}
          error={errorFor(form.errors, ids.body)}
          rows={6}
          required
        />
        {listings.length > 0 && (
          <div className="form-field">
            <label htmlFor={ids.listing} className="form-label">
              Point to one of your listings (optional)
            </label>
            <p id={listingHint} className="form-hint">
              The student sees it in your conversation.
            </p>
            <select
              id={ids.listing}
              name="listing"
              defaultValue={form.listing}
              aria-describedby={listingHint}
              className="form-input form-select"
            >
              <option value="">None</option>
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn btn-primary form-submit">
          Send offer
        </button>
        <ScamCheck warnings={form.warnings} idPrefix={prefix} />
      </form>
    </>
  );
}
```

Create `components/looking-for/Offer.tsx`:

```tsx
import { notFound } from "next/navigation";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { offerFieldPrefix, offerFormKey, offerPath } from "@/lib/looking-for/paths";
import { offerStatus, offerSubject } from "@/lib/looking-for/subjects";
import { OfferView, offerForm } from "./OfferView";

/**
 * The offer composer for this request's visitor (community actions spec 2.9). Request-time: the page puts it inside
 * <Suspense>. A hidden or unknown request is the 404, signed in or not; a signed-out visitor goes to sign-in and back.
 */
export async function Offer({ requestId }: { requestId: string }) {
  const subject = await offerSubject(requestId);
  if (!subject) notFound();
  const account = await requireAccount(offerPath(requestId));
  const [status, state] = await Promise.all([offerStatus(subject, account), readFormState(offerFormKey(requestId))]);
  return <OfferView subject={subject} status={status} form={offerForm(state, offerFieldPrefix(requestId))} />;
}
```

Create `app/looking-for/[id]/offer/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Offer } from "@/components/looking-for/Offer";
import { ComposerSkeleton } from "@/components/messages/ComposerSkeleton";

/** One shop's form, so search engines leave it out (plan decision 23). */
export const metadata: Metadata = { title: "Offer to help", robots: { index: false } };

/** One sample id, so the build checks the page keeps its request-time parts inside <Suspense> (plan decision 24). */
export function generateStaticParams() {
  return [{ id: "r-001" }];
}

/** The offer composer (community actions spec 2.9), laid out like E's. It renders per request inside <Suspense>. */
export default function OfferPage({ params }: PageProps<"/looking-for/[id]/offer">) {
  return (
    <div className="page composer-page">
      <Suspense fallback={<ComposerSkeleton />}>
        <OfferForVisitor params={params} />
      </Suspense>
    </div>
  );
}

async function OfferForVisitor({ params }: Pick<PageProps<"/looking-for/[id]/offer">, "params">) {
  const { id } = await params;
  return <Offer requestId={id} />;
}
```

Run: `pnpm test components/looking-for/OfferView.test.tsx components/looking-for/Offer.test.tsx components/forms/summary-ids.test.tsx components/messages`
Expected: PASS, E's composer tests unchanged.

- [ ] **Step 5: Style it**

Check the names are free (`grep -n "\.offer-" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Community actions: the offer composer (community actions plan, Task 13, spec 2.9) --- */
@layer components {
  /* The request an offer answers, in the place E's composer shows the listing. Navy on the grey panel. */
  .offer-summary {
    display: grid;
    gap: 8px;
    padding: 16px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  .offer-summary-eyebrow {
    color: var(--color-navy);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .offer-summary-title {
    color: var(--color-navy);
    font-size: 18px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .offer-note {
    display: grid;
    justify-items: start;
    gap: 12px;
  }
}
```

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 8 more unit tests than after Task 12. The build lists `/looking-for/[id]/offer` as partly prerendered.

- [ ] **Step 7: Look at it**

Start the build (`pnpm start --port 3201`). As "Student, Midrand", post a request. In another browser, as "Seller, Tech corner", open `/looking-for/<id>/offer` at 390 × 844 and 1280 × 800: the request's card with its pills, "OFFER TO HELP", the offer field, the listing select with Tech corner's two listings, and the tips beside (below on phones). Send "Pay a deposit first": "Check this before you send", then **Send anyway**: the thread opens with "Sent." (its offer wording comes in Task 14). Open the composer again: "You've offered already." with **Open the conversation**. As "Mentor": the shops sentence and **Start selling**. Stop the server.

- [ ] **Step 8: Hand over for commit**

Files: `components/messages/SafetyTips.tsx`, `components/looking-for/OfferView.tsx`, `components/looking-for/OfferView.test.tsx`, `components/looking-for/Offer.tsx`, `components/looking-for/Offer.test.tsx`, `app/looking-for/[id]/offer/page.tsx`, `components/forms/summary-ids.test.tsx`, `app/globals.css`.
Message: `feat: the offer composer: the request, Offer to help, a listing to point to, E's tips and scam check, and why anyone else can't offer (community actions spec 2.8 and 2.9)`

---

### Task 14: Offer threads in E's inbox and thread

E's pages learn offer threads (spec 2.7, 2.9 and 2.10; plan decision 8): the inbox names them "Your request: …" for the asker and "Request: …" for the shop; the thread's card is the request (linked while its page is up, "This request was removed." once it isn't) with any listing the shop pointed to under it; the pill says "Offered"; the shop's reply form waits for the asker ("You can write again when they reply."); and "Sent." after Send offer is worded for the shop. E's pages weren't built when this plan was written: edit them by meaning ("Recheck" item 9).

**Files:**
- Create: `components/messages/OfferAbout.tsx`
- Modify: `components/messages/ThreadView.tsx`, `components/messages/ThreadView.test.tsx`
- Modify: `components/messages/InboxView.tsx`, `components/messages/InboxView.test.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Write the tests**

In `components/messages/ThreadView.test.tsx` (E Task 10), add `makeListing` to the import from `@/tests/helpers/fakes` if it isn't there, and add at the end of the file:

```tsx

describe("offer threads (community actions spec 2.7 to 2.10, plan decision 8)", () => {
  const OFFER_NOW = new Date("2026-10-14T12:00:00.000Z");
  const offer = makeThread({
    status: "offered",
    request: { id: "r-abc", title: "Desk lamp for res", live: true },
    listing: null,
    listingTitle: null,
    messages: [
      {
        id: "msg-1",
        fromViewer: false,
        author: "Tech corner",
        body: "I have a clip-on lamp, R120.",
        swapOffer: null,
        sentAt: "2026-10-14T10:00:00.000Z",
      },
    ],
  });

  it("names the request, linked to its page, with the Offered pill; the asker can reply", () => {
    render(<ThreadView thread={offer} now={OFFER_NOW} reply={replyForm(null)} sent={false} campusName="Midrand" />);
    expect(screen.getByText(/^Your request:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Desk lamp for res" })).toHaveAttribute("href", "/looking-for/r-abc");
    expect(screen.getByText("Offered")).toHaveClass("status-pill");
    expect(screen.getByLabelText("Your reply")).toBeInTheDocument();
  });

  it("makes the shop wait for the asker's reply, and says Sent. in the shop's words", () => {
    render(
      <ThreadView
        thread={{ ...offer, role: "seller", otherName: "The student who asked" }}
        now={OFFER_NOW}
        reply={replyForm(null)}
        sent
        campusName="Midrand"
      />,
    );
    expect(screen.getByText(/^Request:/)).toBeInTheDocument();
    expect(screen.getByText("You can write again when they reply.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your reply")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Sent. The student who asked gets a notification.");
    expect(screen.queryByRole("button", { name: "Mark as completed" })).toBeNull();
  });

  it("says when the request has gone, and shows the listing the shop pointed to", () => {
    render(
      <ThreadView
        thread={{
          ...offer,
          request: { id: "r-abc", title: "Desk lamp for res", live: false },
          listing: makeListing({ id: "l-test", title: "Clip-on lamp" }),
          listingTitle: "Clip-on lamp",
        }}
        now={OFFER_NOW}
        reply={replyForm(null)}
        sent={false}
        campusName="Midrand"
      />,
    );
    expect(screen.queryByRole("link", { name: "Desk lamp for res" })).toBeNull();
    expect(screen.getByText("This request was removed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clip-on lamp" })).toHaveAttribute("href", "/listings/l-test");
  });
});
```

In `components/messages/InboxView.test.tsx` (E Task 9), add `makeSummary` to the import from `@/tests/helpers/fakes` if it isn't there, and add at the end of the file:

```tsx

describe("offer threads in the inbox (community actions plan decisions 8 and 9)", () => {
  it("names them by their request: Request for the shop, Your request for the asker", () => {
    const now = new Date("2026-10-14T12:00:00.000Z");
    const { unmount } = render(
      <InboxView
        tab="selling"
        hasShop
        conversations={[
          makeSummary({
            role: "seller",
            otherName: "The student who asked",
            requestTitle: "Desk lamp for res",
            listingTitle: null,
            status: "offered",
          }),
        ]}
        now={now}
      />,
    );
    expect(screen.getByRole("link", { name: /Request: Desk lamp for res/ })).toHaveTextContent("The student who asked");
    unmount();
    render(
      <InboxView
        tab="buying"
        hasShop={false}
        conversations={[makeSummary({ role: "buyer", otherName: "Tech corner", requestTitle: "Desk lamp for res" })]}
        now={now}
      />,
    );
    expect(screen.getByRole("link", { name: /Your request: Desk lamp for res/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/messages/ThreadView.test.tsx components/messages/InboxView.test.tsx`
Expected: FAIL: the thread shows the shop's card and the reply form, and the inbox says "A question for the shop".

- [ ] **Step 3: The offer's card**

Create `components/messages/OfferAbout.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { requestPath } from "@/lib/looking-for/paths";
import { REQUEST_REMOVED_NOTE } from "@/lib/looking-for/words";
import type { Thread } from "@/lib/types";
import { MessageSummary } from "./MessageSummary";

type OfferAboutProps = {
  thread: Thread;
  request: NonNullable<Thread["request"]>;
  campusName: string;
  /** The thread's status pill. */
  children?: ReactNode;
};

/**
 * What an offer thread is about (community actions plan decision 8), where E's thread shows the listing: the request,
 * linked while its page is up, "This request was removed." once it isn't, and under it the listing the shop pointed
 * to, if any, as E's summary.
 */
export function OfferAbout({ thread, request, campusName, children }: OfferAboutProps) {
  return (
    <div className="offer-thread">
      <div className="offer-thread-head">
        <p className="offer-thread-about">
          {thread.role === "buyer" ? "Your request: " : "Request: "}
          {request.live ? (
            <Link href={requestPath(request.id)} prefetch={false}>
              {request.title}
            </Link>
          ) : (
            request.title
          )}
        </p>
        {children}
      </div>
      {!request.live && <p className="offer-thread-gone">{REQUEST_REMOVED_NOTE}</p>}
      {(thread.listing || thread.listingTitle) && (
        <MessageSummary
          listing={thread.listing}
          listingTitle={thread.listingTitle}
          shop={thread.shop}
          campusName={campusName}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: The thread and the inbox**

In `components/messages/ThreadView.tsx` (E Task 10):
1. Add these imports, in alphabetical order among the others: `import { OFFER_SENT_NOTE, SHOP_WAITS_NOTE } from "@/lib/looking-for/words";` and `import { OfferAbout } from "./OfferAbout";`.
2. In `ThreadView`, add as its first line:

```tsx
  // The shop that offered waits for the asker's reply before writing again (community actions spec 2.9).
  const waiting = thread.request !== null && thread.role === "seller" && thread.status === "offered";
```

3. Replace the `<MessageSummary …>` element that holds `<StatusPill status={thread.status} />` with:

```tsx
      {thread.request ? (
        <OfferAbout thread={thread} request={thread.request} campusName={campusName}>
          <StatusPill status={thread.status} />
        </OfferAbout>
      ) : (
        <MessageSummary
          listing={thread.listing}
          listingTitle={thread.listingTitle}
          shop={thread.shop}
          campusName={campusName}
        >
          <StatusPill status={thread.status} />
        </MessageSummary>
      )}
```

(keep E's props exactly as the built file has them in the second branch).
4. In the `{sent && (…)}` note, replace its words `Sent. Sellers usually reply within a day.` with:

```tsx
          {thread.request && thread.role === "seller" ? OFFER_SENT_NOTE : "Sent. Sellers usually reply within a day."}
```

5. Replace the `{thread.otherPresent ? (<ReplyFormView … />) : (<p className="form-notice">The other person has left Vossie, so you can&apos;t reply.</p>)}` block with:

```tsx
      {thread.otherPresent && waiting && <p className="form-notice">{SHOP_WAITS_NOTE}</p>}
      {thread.otherPresent && !waiting && <ReplyFormView thread={thread} reply={reply} />}
      {!thread.otherPresent && (
        <p className="form-notice">The other person has left Vossie, so you can&apos;t reply.</p>
      )}
```

6. Add to `ThreadView`'s comment: "An offer thread shows its request, and the shop waits for the asker's reply (community actions plan decision 8)."

In `components/messages/InboxView.tsx` (E Task 9):
1. Add `import { offerAbout } from "@/lib/looking-for/words";` among the `@/lib/…` imports, in alphabetical order.
2. In `InboxRow`, add `requestTitle` and `role` to the names taken from `conversation`, and replace `{listingTitle ?? "A question for the shop"}` with:

```tsx
{requestTitle ? offerAbout(role, requestTitle) : (listingTitle ?? "A question for the shop")}
```

`SaleActions` needs no change: it shows nothing for "offered", and Mark as completed needs "replied" (spec 2.12).

- [ ] **Step 5: Style it**

Append to the end of `app/globals.css`:

```css

/* --- Community actions: an offer thread's card (community actions plan, Task 14, spec 2.7) --- */
@layer components {
  .offer-thread {
    display: grid;
    gap: 10px;
  }

  .offer-thread-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 16px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  /* Navy on the grey panel: sky-dark is 4.25:1 there. */
  .offer-thread-about {
    color: var(--color-navy);
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .offer-thread-about a {
    color: var(--color-navy);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .offer-thread-gone {
    color: var(--color-muted);
    font-size: 14px;
  }
}
```

- [ ] **Step 6: Run them to make sure they pass**

Run: `pnpm test components/messages`
Expected: PASS, E's thread and inbox tests unchanged.

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 4 more unit tests than after Task 13.

- [ ] **Step 8: Look at it**

On a production build (`pnpm build`, then `pnpm start --port 3201`), at 390 × 844 and 1280 × 800: as "Student, Midrand", post a request; as "Seller, Tech corner" in another browser, offer on it pointing to the calculator. The shop's thread: "Messages with The student who asked", "Request: …" with the Offered pill, the calculator's card under it, "Sent. The student who asked gets a notification.", and "You can write again when they reply." where the reply form was. The student's `/notifications`: "Tech corner offered to help with …"; their thread: "Your request: …" and the reply form. Reply, then reload the shop's thread: the student's first name, Replied, the reply form and **Mark as completed**. Stop the server.

- [ ] **Step 9: Hand over for commit**

Files: `components/messages/OfferAbout.tsx`, `components/messages/ThreadView.tsx`, `components/messages/ThreadView.test.tsx`, `components/messages/InboxView.tsx`, `components/messages/InboxView.test.tsx`, `app/globals.css`.
Message: `feat: offer threads in the inbox and thread: named by their request, Offered until the asker replies, the shop waiting for that reply, and the request's page or its removal (community actions spec 2.7 to 2.10)`

---

### Task 15: The request page: the asker's panel and Offer to help

On a request's page (spec 2.13, section 3; plan decisions 19 and 22), the offers panel reads the session in its own `<Suspense>`, with the public panel as the fallback, so the page keeps its prerendered shell. The asker sees "Your request", the count, each offer (the shop, its first line and the time in SAST, linking to the thread), the status line after an action, and Edit, Close or Reopen, and Delete. Everyone else sees the count and **Offer to help**, which now opens the composer (through sign-in when signed out). The sign-in page's back link learns the new pages. The request page is a shared page, so this task ends by measuring.

**Files:**
- Create: `components/looking-for/OffersPanel.tsx`, `components/looking-for/OffersPanel.test.tsx`
- Create: `components/looking-for/ViewerOffers.tsx`, `components/looking-for/ViewerOffers.test.tsx`
- Create: `tests/helpers/viewer-offers.tsx`
- Modify: `components/looking-for/RequestView.tsx`, `components/looking-for/RequestView.test.tsx`
- Modify: `lib/messaging/paths.ts`, `lib/messaging/paths.test.ts`
- Modify: `tests/e2e/community.spec.ts`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Write the tests**

Create `components/looking-for/OffersPanel.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { requests } from "@/data/fixtures/requests";
import type { OwnRequest } from "@/lib/types";
import { AskerOffers, OffersPanel, PublicOffers } from "./OffersPanel";

// The session's part never arrives here, so what renders is the static shell's fallback (plan decision 19).
vi.mock("./ViewerOffers", async () => {
  const { use } = await import("react");
  const never = new Promise<never>(() => {});
  return { ViewerOffers: () => use(never) };
});
vi.mock("@/lib/looking-for/actions", () => ({ closeMyRequest: async () => {}, reopenMyRequest: async () => {} }));

const OPEN = requests[0];
const CLOSED = requests.find((request) => request.status === "closed")!;

const own = (state: OwnRequest["state"]): OwnRequest => ({
  request: { ...OPEN, id: "r-abc", title: "Desk lamp for res", offers: 1, status: state === "closed" ? "closed" : "open" },
  state,
  hiddenReason: null,
});

describe("the public offers panel (community spec 4.2, community actions spec section 3)", () => {
  it("is in the static shell, signed out: the count, and Offer to help through sign-in to the composer", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<OffersPanel request={OPEN} />);
    const shell = within(container);
    expect(shell.getByText("2 offers so far")).toBeInTheDocument();
    expect(shell.getByRole("link", { name: "Offer to help" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fr-001%2Foffer",
    );
  });

  it("goes straight to the composer when signed in, and says when the request is closed", () => {
    const { unmount } = render(<PublicOffers request={OPEN} signedIn />);
    expect(screen.getByRole("link", { name: "Offer to help" })).toHaveAttribute("href", "/looking-for/r-001/offer");
    unmount();
    render(<PublicOffers request={CLOSED} signedIn />);
    expect(screen.getByText("This request is closed")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Offer to help" })).toBeNull();
  });
});

describe("the asker's panel (community actions spec 2.13, plan decision 19)", () => {
  it("shows Your request, the count, each offer linking to its thread, the status line and the actions", () => {
    const offers = [
      {
        conversationId: "conv-abc",
        shopName: "Tech corner",
        preview: "I have a clip-on lamp, R120.",
        offeredAt: "2026-10-14T08:00:00.000Z",
      },
    ];
    render(<AskerOffers own={own("open")} offers={offers} notice="Your request is up." />);
    expect(screen.getByText("Your request")).toBeInTheDocument();
    expect(screen.getByText("1 offer")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your request is up.");
    const offer = screen.getByRole("link", { name: /Tech corner/ });
    expect(offer).toHaveAttribute("href", "/messages/conv-abc");
    expect(offer).toHaveTextContent("Wed 14 Oct · 10:00");
    expect(offer).toHaveTextContent("I have a clip-on lamp, R120.");
    expect(screen.getByText("Found it? Close it so shops stop offering.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Desk lamp for res" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Desk lamp for res" })).toHaveAttribute(
      "href",
      "/looking-for/r-abc/edit",
    );
    expect(document.querySelector('input[name="from"]')).toBeNull();
    expect(screen.queryByRole("link", { name: "Offer to help" })).toBeNull();
  });

  it("offers Reopen on a closed request, and says when there are no offers yet", () => {
    render(<AskerOffers own={{ ...own("closed"), request: { ...own("closed").request, offers: 0 } }} offers={[]} notice={null} />);
    expect(screen.getByText("No offers yet")).toBeInTheDocument();
    expect(screen.getByText("This request is closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen Desk lamp for res" })).toBeInTheDocument();
    expect(screen.queryByText(/Found it\?/)).toBeNull();
  });
});
```

Create `components/looking-for/ViewerOffers.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startOffer } from "@/lib/data/messages";
import { createRequest, publicRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { ViewerOffers } from "./ViewerOffers";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));
const note = vi.hoisted(() => ({ notice: null as string | null }));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async () => (note.notice ? { notice: note.notice, values: {} } : null),
}));
vi.mock("@/lib/looking-for/actions", () => ({ closeMyRequest: async () => {}, reopenMyRequest: async () => {} }));

const NOW = new Date("2026-10-14T08:00:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
  note.notice = null;
});

async function posted() {
  const { id } = await createRequest({
    askerId: "acc-student",
    fields: {
      title: "Desk lamp for res",
      categorySlug: "res-living",
      campusSlug: "midrand",
      details: "A lamp that clips onto a desk, by the weekend.",
      budgetZar: null,
      swapWelcome: false,
      neededBy: null,
    },
    now: NOW,
  });
  await startOffer({
    askerId: "acc-student",
    request: { id, title: "Desk lamp for res" },
    sellerSlug: "tech-corner",
    listing: null,
    body: "I have a clip-on lamp, R120.",
    now: NOW,
  });
  return publicRequest(id)!;
}

describe("the offers panel, once the session is read (community actions spec 2.13)", () => {
  it("gives the asker their panel, with the offer and the status line", async () => {
    const request = await posted();
    viewer.account = { id: "acc-student" };
    note.notice = "posted";
    render(await ViewerOffers({ request }));
    expect(screen.getByText("Your request")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tech corner/ })).toHaveTextContent("I have a clip-on lamp, R120.");
    expect(screen.getByRole("status")).toHaveTextContent("Your request is up.");
  });

  it("gives anyone else signed in Offer to help, straight to the composer", async () => {
    const request = await posted();
    viewer.account = { id: "acc-seller" };
    render(await ViewerOffers({ request }));
    expect(screen.getByRole("link", { name: "Offer to help" })).toHaveAttribute("href", `/looking-for/${request.id}/offer`);
    expect(screen.queryByText("Your request")).toBeNull();
  });

  it("gives a signed-out visitor Offer to help through sign-in", async () => {
    const request = await posted();
    render(await ViewerOffers({ request }));
    expect(screen.getByRole("link", { name: "Offer to help" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(`/looking-for/${request.id}/offer`)}`,
    );
  });
});
```

In `components/looking-for/RequestView.test.tsx` (part B, E Task 7):
1. After the `vi.mock("@/components/messages/ViewerLinks", …)` line, add:

```tsx

// The offers panel's session part is an async Server Component; here it's the signed-out panel (community actions plan, Task 15).
vi.mock("@/components/looking-for/ViewerOffers", async () => (await import("@/tests/helpers/viewer-offers")).signedOutViewerOffers);
```

2. In "counts the offers so far and offers to help, through the sign-in page", change the expected href `"/login?next=%2Flooking-for%2Fr-001",` to `"/login?next=%2Flooking-for%2Fr-001%2Foffer",`, and add " to the composer" at the end of the test's name.

Find any other test that renders `RequestView`: `grep -rln "RequestView" components app --include="*.test.tsx"`. Add the same `vi.mock` line to each.

In `lib/messaging/paths.test.ts` (E Task 2, G Task 15), add this test to the `describe` that tests `backPathFor`:

```ts

  it("goes back from Looking For's new pages (community actions plan decision 22)", () => {
    expect(backPathFor("/looking-for/new")).toBe("/looking-for");
    expect(backPathFor("/looking-for/r-001/offer")).toBe("/looking-for/r-001");
    expect(backPathFor("/looking-for/r-001/edit")).toBe("/looking-for/r-001");
    expect(backPathFor("/looking-for/r-001/delete")).toBe("/looking-for/r-001");
    expect(backPathFor("/account/requests")).toBeNull();
    expect(backPathFor("/looking-for/r-001")).toBe("/looking-for/r-001");
  });
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/looking-for lib/messaging/paths.test.ts`
Expected: FAIL: the panels and the helper don't exist, and the back links don't know the new pages.

- [ ] **Step 3: Write the panels**

Create `components/looking-for/OffersPanel.tsx`:

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { offersLabel, offersSoFarLabel } from "@/lib/format";
import { offerPath } from "@/lib/looking-for/paths";
import { threadPath } from "@/lib/messaging/paths";
import { signInHref } from "@/lib/next-path";
import { sastDateTime } from "@/lib/time";
import type { LookingForRequest, OfferSummary, OwnRequest } from "@/lib/types";
import { RequestActions } from "./RequestActions";
import { ViewerOffers } from "./ViewerOffers";

/**
 * Everyone's view of the offers (community spec 4.2): the count and Offer to help, which opens the composer, through
 * sign-in when signed out (community actions spec section 3); or "This request is closed". The static shell has the
 * signed-out version, so the session's version has the same size and nothing moves.
 */
export function PublicOffers({ request, signedIn }: { request: LookingForRequest; signedIn: boolean }) {
  if (request.status !== "open") return <p className="request-offers-count">This request is closed</p>;
  const composer = offerPath(request.id);
  return (
    <>
      <p className="request-offers-count">{offersSoFarLabel(request.offers)}</p>
      <Link href={signedIn ? composer : signInHref(composer)} prefetch={false} className="btn btn-primary request-offer">
        Offer to help
      </Link>
    </>
  );
}

type AskerOffersProps = {
  own: OwnRequest;
  /** Newest first. */
  offers: readonly OfferSummary[];
  /** The last action's words, once (plan decision 7). */
  notice: string | null;
};

/**
 * The asker's view (community actions spec 2.13, plan decision 19): "Your request", the count, each offer (the shop,
 * the time in SAST and the offer's first line, linking to the thread), and what they can do with it.
 */
export function AskerOffers({ own, offers, notice }: AskerOffersProps) {
  const { request, state } = own;
  return (
    <>
      <p className="request-offers-eyebrow">Your request</p>
      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}
      <p className="request-offers-count">{offersLabel(request.offers)}</p>
      {state === "closed" && <p className="request-offers-state">This request is closed</p>}
      {offers.length > 0 && (
        <ul className="request-offers-list">
          {offers.map((offer) => (
            <li key={offer.conversationId}>
              <Link href={threadPath(offer.conversationId)} prefetch={false} className="request-offers-row">
                <span className="request-offers-shop">{offer.shopName}</span>{" "}
                <time dateTime={offer.offeredAt} className="request-offers-time">
                  {sastDateTime(offer.offeredAt)}
                </time>{" "}
                <span className="request-offers-preview">{offer.preview}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {state === "open" && <p className="form-hint">Found it? Close it so shops stop offering.</p>}
      <RequestActions own={own} from="page" />
    </>
  );
}

/**
 * The request page's offers (community actions spec 2.13 and section 3): the session's part in its own <Suspense>,
 * with the signed-out public panel as the fallback, so the page keeps its prerendered shell. Server Components and
 * Links with no prefetch: no client bytes.
 */
export function OffersPanel({ request }: { request: LookingForRequest }) {
  return (
    <Suspense fallback={<PublicOffers request={request} signedIn={false} />}>
      <ViewerOffers request={request} />
    </Suspense>
  );
}
```

Create `components/looking-for/ViewerOffers.tsx`:

```tsx
import { getViewer } from "@/lib/auth/session";
import { offersForRequest } from "@/lib/data/offers";
import { getOwnRequest } from "@/lib/data/requests";
import { takeNote } from "@/lib/looking-for/form-state";
import { requestNoteKey } from "@/lib/looking-for/paths";
import { requestNoticeText } from "@/lib/looking-for/words";
import type { LookingForRequest } from "@/lib/types";
import { AskerOffers, PublicOffers } from "./OffersPanel";

/**
 * The offers panel once the session is read (community actions plan decision 19): the asker's panel for the asker,
 * the public one for everyone else. An async Server Component: OffersPanel puts it inside <Suspense>. A failed
 * session read gives the signed-out panel, which still works.
 */
export async function ViewerOffers({ request }: { request: LookingForRequest }) {
  const account = await getViewer().catch(() => null);
  if (!account) return <PublicOffers request={request} signedIn={false} />;
  const own = await getOwnRequest(account.id, request.id);
  if (!own) return <PublicOffers request={request} signedIn />;
  const [offers, note] = await Promise.all([offersForRequest(request.id), takeNote(requestNoteKey(request.id))]);
  return <AskerOffers own={own} offers={offers} notice={requestNoticeText(note?.notice)} />;
}
```

`OffersPanel.tsx` and `ViewerOffers.tsx` import each other; that's fine for components (each import is used only inside a function).

Create `tests/helpers/viewer-offers.tsx`:

```tsx
import { PublicOffers } from "@/components/looking-for/OffersPanel";
import type { LookingForRequest } from "@/lib/types";

/**
 * Stands in for components/looking-for/ViewerOffers.tsx in component tests (community actions plan, Task 15). The real
 * one is an async Server Component, which jsdom can't render inside a tree; this renders the signed-out panel. In a
 * test file:
 *
 *   vi.mock("@/components/looking-for/ViewerOffers", async () => (await import("@/tests/helpers/viewer-offers")).signedOutViewerOffers);
 */
export const signedOutViewerOffers = {
  ViewerOffers: ({ request }: { request: LookingForRequest }) => <PublicOffers request={request} signedIn={false} />,
};
```

- [ ] **Step 4: The request page uses them**

In `components/looking-for/RequestView.tsx` (part B, E Task 7):
1. Add `import { OffersPanel } from "./OffersPanel";` below the `./RelatedListings` import.
2. Replace everything inside the `request-offers` section after its `<h2 …>Offers</h2>` (the `{request.status === "open" ? (…) : (…)}` block) with:

```tsx
          <OffersPanel request={request} />
```

3. If `signIn` (E's `const signIn = signInHref(…)`) and the `signInHref` import are now unused, delete them; `Link` stays (the breadcrumb uses it).
4. Add to `RequestView`'s comment: "The offers panel follows the session: the asker manages their request there (community actions plan decision 19)."

- [ ] **Step 5: The sign-in page's back link**

In `lib/messaging/paths.ts` (E Task 2, G Task 15):
1. After G's `HUB_BOOK` line, add:

```ts
// Looking For's pages that need an account (community actions plan decision 22).
const NEW_REQUEST = "/looking-for/new";
const REQUEST_ACTION = /^\/looking-for\/([a-z0-9][a-z0-9-]*)\/(offer|edit|delete)$/;
```

2. In `backPathFor`, straight after G's `if (booking) return …;` line, add:

```ts
  if (path === NEW_REQUEST) return "/looking-for";
  const requestAction = REQUEST_ACTION.exec(path);
  if (requestAction) return `/looking-for/${requestAction[1]}`;
```

3. In `backPathFor`'s comment, add "; the board for the request form, and the request for its offer, edit and delete pages (community actions plan decision 22)".

- [ ] **Step 6: The end-to-end checks of Offer to help**

In `tests/e2e/community.spec.ts` (part B):
1. In "shows the facts, the asker's words and the offers, naming no one", change the expected Offer to help href `"/login?next=%2Flooking-for%2Fr-001",` to `"/login?next=%2Flooking-for%2Fr-001%2Foffer",`.
2. In "Offer to help goes through the sign-in page and back", change `/\/login\?next=%2Flooking-for%2Fr-001$/` to `/\/login\?next=%2Flooking-for%2Fr-001%2Foffer$/`, and rename the test "Offer to help goes through the sign-in page to the composer, and back". The back link still leads to `/looking-for/r-001` (Step 5); if the built sign-in page names it other than "Go back", use its name.

- [ ] **Step 7: Style it**

Append to the end of `app/globals.css`:

```css

/* --- Community actions: the asker's offers panel (community actions plan, Task 15, spec 2.13) --- */
@layer components {
  .request-offers-eyebrow {
    color: var(--color-navy);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .request-offers-state {
    color: var(--color-navy);
    font-weight: 600;
  }

  .request-offers-list {
    display: grid;
    gap: 8px;
    width: 100%;
  }

  /* White cards on the grey panel, each a 44px+ link to its thread. */
  .request-offers-row {
    display: grid;
    gap: 2px;
    min-height: 44px;
    padding: 10px 12px;
    border-radius: var(--radius-card);
    background: var(--color-white);
    color: var(--color-ink);
  }

  .request-offers-shop {
    color: var(--color-navy);
    font-weight: 600;
  }

  .request-offers-time {
    color: var(--color-muted);
    font-size: 13px;
  }

  .request-offers-preview {
    overflow-wrap: anywhere;
  }
}
```

`.request-offers` (part B) is a grid with `justify-items: start`, so `RequestActions`' wrapping row sits under the list; `.requests-actions` (Task 12) styles it.

- [ ] **Step 8: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 8 more unit tests than after Task 14.

- [ ] **Step 9: Measure the JavaScript**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Write every page's `scriptBrotli` into the ledger's "Task 15" row. **Every figure must equal the row before it to the byte** (spec 5): the panel is Server Components and a `Link`, which the page already loads. If any page moved, stop and find out why (look over this task's changes, then compare the request page's script files with the last run's) before going on. If any page is past the stop line, stop and report (the stop rule).

- [ ] **Step 10: Look at it**

Start the build (`pnpm start --port 3201`). Signed out, `/looking-for/r-001` at 390 × 844 and 1280 × 800 looks as before, and **Offer to help** goes to `/login?next=%2Flooking-for%2Fr-001%2Foffer`, whose back link returns to the request. Sign in as "Student, Midrand", post a request: its page says "YOUR REQUEST", "Your request is up.", "No offers yet", the hint, and Edit, Close and Delete; reload: the status line has gone. As "Seller, Tech corner" in another browser, offer on it; reload the student's page: "1 offer" and Tech corner's offer with its time, linking to the thread. **Close** it: "Request closed." and **Reopen**. Stop the server.

- [ ] **Step 11: Hand over for commit**

Files: `components/looking-for/OffersPanel.tsx`, `components/looking-for/OffersPanel.test.tsx`, `components/looking-for/ViewerOffers.tsx`, `components/looking-for/ViewerOffers.test.tsx`, `tests/helpers/viewer-offers.tsx`, `components/looking-for/RequestView.tsx`, `components/looking-for/RequestView.test.tsx`, any other test Step 1's `grep` found, `lib/messaging/paths.ts`, `lib/messaging/paths.test.ts`, `tests/e2e/community.spec.ts`, `app/globals.css`.
Message: `feat: the request page's offers panel follows the session: the asker sees their offers, a status line and Edit, Close, Reopen and Delete; Offer to help opens the composer (community actions spec 2.13). JS: / <n> B, listing <n> B, request <n> B, unchanged`

---

### Task 16: Post a request on the board and the homepage

**Post a request** on the board (its head and its empty state) and on the homepage's band goes to `/looking-for/new` (spec section 3), which sends a signed-out visitor to sign in and back. Each link has `prefetch={false}` (decision 53): the form's page reads the session. The homepage is prefetched from every page's header, so this task ends by measuring.

**Files:**
- Modify: `app/looking-for/page.tsx`
- Modify: `components/looking-for/RequestBoard.tsx`, `components/looking-for/RequestBoard.test.tsx`
- Modify: `components/home/LookingFor.tsx`, `components/home/LookingFor.test.tsx`
- Modify: `tests/e2e/community.spec.ts`

- [ ] **Step 1: Change the tests first**

In `components/looking-for/RequestBoard.test.tsx` (part B), change the empty state's expected Post a request href `"/login?next=%2Flooking-for"` to `"/looking-for/new"`.

In `components/home/LookingFor.test.tsx` (part B), change `expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute("href", "/looking-for");` to `expect(screen.getByRole("link", { name: "Post a request" })).toHaveAttribute("href", "/looking-for/new");`.

Run: `pnpm test components/looking-for/RequestBoard.test.tsx components/home/LookingFor.test.tsx`
Expected: FAIL: the links still go to sign-in and to the board.

- [ ] **Step 2: Change the links**

In `app/looking-for/page.tsx` (part B):
1. Replace `import { signInHref } from "@/lib/next-path";` with `import { NEW_REQUEST_PATH } from "@/lib/looking-for/paths";` (keep the imports in alphabetical order).
2. Change the board head's `<Link href={signInHref("/looking-for")} prefetch={false} className="btn btn-primary board-post">` to `<Link href={NEW_REQUEST_PATH} prefetch={false} className="btn btn-primary board-post">`.
3. In the page's comment, replace "Posting needs an account, so Post a request goes to the sign-in page and comes back to the board (community spec decision 1, plan decision 19)." with "Post a request opens the request form, which sends a signed-out visitor to sign in and back (community actions spec section 3)."

In `components/looking-for/RequestBoard.tsx` (part B):
1. Replace `import { signInHref } from "@/lib/next-path";` with `import { NEW_REQUEST_PATH } from "@/lib/looking-for/paths";`, in alphabetical order among the `@/lib/…` imports.
2. In the empty state, change `<Link href={signInHref("/looking-for")} prefetch={false} className="btn btn-primary">` to `<Link href={NEW_REQUEST_PATH} prefetch={false} className="btn btn-primary">`.

In `components/home/LookingFor.tsx` (part B):
1. Add `import { NEW_REQUEST_PATH } from "@/lib/looking-for/paths";` below the `react` import.
2. Change `<Link href="/looking-for" className="btn btn-primary looking-for-action">` to:

```tsx
        {/* No prefetch: the form reads the session, and the homepage is prefetched from every page (decision 53). */}
        <Link href={NEW_REQUEST_PATH} prefetch={false} className="btn btn-primary looking-for-action">
```

(keep the existing comment above it about the tab order).

Run: `pnpm test components/looking-for/RequestBoard.test.tsx components/home/LookingFor.test.tsx`
Expected: PASS.

- [ ] **Step 3: The end-to-end checks of Post a request**

In `tests/e2e/community.spec.ts` (part B):
1. In "a category with nothing open invites the first request", change the expected href `"/login?next=%2Flooking-for",` to `"/looking-for/new",`.
2. In "Post a request goes through the sign-in page and back", change `/\/login\?next=%2Flooking-for$/` to `/\/login\?next=%2Flooking-for%2Fnew$/`. The back link still returns to `/looking-for` (Task 15's `backPathFor`). Rename it "Post a request opens the form, through the sign-in page, and back".

- [ ] **Step 4: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; the same number of unit tests as after Task 15.

- [ ] **Step 5: Measure the JavaScript**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Write every page's `scriptBrotli` into the ledger's "Task 16" row. **Every figure must equal Task 15's to the byte** (spec 5): only a link's address and its prefetch changed. If any page moved, stop and find out why before going on. If any page is past the stop line, stop and report.

- [ ] **Step 6: Look at it**

Start the build (`pnpm start --port 3201`). Signed out, **Post a request** on `/looking-for`, on `/looking-for?cat=tickets-events` and on the homepage's band each go to sign-in with `next=%2Flooking-for%2Fnew`; sign in as "Student, Midrand": the form opens. Stop the server.

- [ ] **Step 7: Hand over for commit**

Files: `app/looking-for/page.tsx`, `components/looking-for/RequestBoard.tsx`, `components/looking-for/RequestBoard.test.tsx`, `components/home/LookingFor.tsx`, `components/home/LookingFor.test.tsx`, `tests/e2e/community.spec.ts`.
Message: `feat: Post a request opens the request form, from the board, its empty state and the homepage, with no prefetch (community actions spec section 3). JS: / <n> B, listing <n> B, board <n> B, unchanged`

---

### Task 17: Follow on the storefront's band

**Follow** in the storefront's band (spec 2.16 and section 4; plan decisions 7 and 16): a row of its own under Message seller and Share, read from the session in its own `<Suspense>`. The static shell and a signed-out visitor get a **Follow** link to sign-in that comes back to the shop; signed in, **Follow**, or "You follow this shop" and **Unfollow**; the owner gets nothing there (F's Edit shop is in the Message slot). Follow is a sky pill with navy text, Unfollow a white outline, small text white. The storefront is a shared page, so this task ends by measuring.

**Files:**
- Create: `components/seller/FollowControl.tsx`, `components/seller/FollowControl.test.tsx`
- Create: `components/seller/ViewerFollow.tsx`, `components/seller/ViewerFollow.test.tsx`
- Create: `tests/helpers/viewer-follow.tsx`
- Modify: `components/seller/SellerHero.tsx`, `components/seller/SellerHero.test.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Write the tests**

Create `components/seller/FollowControl.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FollowButtons, FollowControl } from "./FollowControl";

// The session's part never arrives here, so what renders is the static shell's fallback (plan decision 16).
vi.mock("./ViewerFollow", async () => {
  const { use } = await import("react");
  const never = new Promise<never>(() => {});
  return { ViewerFollow: () => use(never) };
});
vi.mock("@/lib/following/actions", () => ({ followShop: async () => {}, unfollowShop: async () => {} }));

describe("Follow on the storefront's band (community actions spec 2.16)", () => {
  it("is a Follow link through sign-in, back to the shop, in the static shell", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<FollowControl slug="tech-corner" name="Tech corner" />);
    const link = within(container).getByRole("link", { name: "Follow Tech corner" });
    expect(link).toHaveAttribute("href", "/login?next=%2Fsellers%2Ftech-corner");
    expect(link).toHaveClass("btn-sky");
    expect(container.querySelector(".seller-follow")).not.toBeNull();
  });

  it("is a Follow button when signed in, naming the shop", () => {
    render(<FollowButtons slug="tech-corner" name="Tech corner" following={false} notice={null} />);
    expect(screen.getByRole("button", { name: "Follow Tech corner" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="shop"]')).toHaveValue("tech-corner");
    expect(document.querySelector('input[name="from"]')).toBeNull();
  });

  it("says you follow the shop, with Unfollow, and no pressed state (the words say what it does)", () => {
    render(<FollowButtons slug="tech-corner" name="Tech corner" following notice={null} />);
    expect(screen.getByText("You follow this shop")).toBeInTheDocument();
    const unfollow = screen.getByRole("button", { name: "Unfollow Tech corner" });
    expect(unfollow).not.toHaveAttribute("aria-pressed");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says what the last press did, once (plan decision 7)", () => {
    const { unmount } = render(<FollowButtons slug="tech-corner" name="Tech corner" following notice="followed" />);
    expect(screen.getByRole("status")).toHaveTextContent("You follow Tech corner.");
    unmount();
    const again = render(<FollowButtons slug="tech-corner" name="Tech corner" following={false} notice="unfollowed" />);
    expect(screen.getByRole("status")).toHaveTextContent("Unfollowed.");
    again.unmount();
    render(<FollowButtons slug="tech-corner" name="Tech corner" following={false} notice="follow-limit" />);
    expect(screen.getByRole("status")).toHaveTextContent("You follow 200 shops. Unfollow one first.");
  });
});
```

Create `components/seller/ViewerFollow.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addFollow } from "@/lib/data/follows";
import { resetSampleStore } from "@/lib/data/store";
import type { Account } from "@/lib/types";
import { ViewerFollow } from "./ViewerFollow";

const viewer = vi.hoisted(() => ({ account: null as null | Pick<Account, "id" | "seller"> }));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/looking-for/form-state", () => ({ takeNote: async () => null }));
vi.mock("@/lib/following/actions", () => ({ followShop: async () => {}, unfollowShop: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
});

describe("Follow, once the session is read (community actions spec 2.16)", () => {
  it("is the sign-in link when signed out", async () => {
    render(await ViewerFollow({ slug: "tech-corner", name: "Tech corner" }));
    expect(screen.getByRole("link", { name: "Follow Tech corner" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsellers%2Ftech-corner",
    );
  });

  it("is Follow, or Unfollow once the visitor follows the shop", async () => {
    viewer.account = { id: "acc-student", seller: null };
    const { unmount } = render(await ViewerFollow({ slug: "tech-corner", name: "Tech corner" }));
    expect(screen.getByRole("button", { name: "Follow Tech corner" })).toBeInTheDocument();
    unmount();
    await addFollow("acc-student", "tech-corner", new Date("2026-10-14T08:42:00.000Z"));
    render(await ViewerFollow({ slug: "tech-corner", name: "Tech corner" }));
    expect(screen.getByRole("button", { name: "Unfollow Tech corner" })).toBeInTheDocument();
  });

  it("is nothing for the shop's owner, who has Edit shop in the band", async () => {
    viewer.account = { id: "acc-seller", seller: { status: "approved", sellerSlug: "tech-corner" } };
    expect(await ViewerFollow({ slug: "tech-corner", name: "Tech corner" })).toBeNull();
  });
});
```

In `components/seller/SellerHero.test.tsx` (shopping plan, E Task 7, F Task 14), add straight after its last `vi.mock(…)` line:

```tsx

// Follow's session part is an async Server Component; here it's the signed-out link (community actions plan, Task 17).
vi.mock("@/components/seller/ViewerFollow", async () => (await import("@/tests/helpers/viewer-follow")).signedOutViewerFollow);
```

and add at the end of its `describe`:

```tsx

  it("has Follow in a row of its own, through sign-in when signed out (community actions spec 2.16)", () => {
    render(<SellerHero seller={makeSeller({ slug: "tech-corner", name: "Tech corner" })} campusName="Midrand" />);
    expect(screen.getByRole("link", { name: "Follow Tech corner" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsellers%2Ftech-corner",
    );
  });
```

(`makeSeller` comes from `@/tests/helpers/fakes`; add it to the imports if the file builds its seller another way, and use that way instead.) Find every other test that renders `SellerHero` or `SellerView`: `grep -rln "SellerHero\|SellerView" components app --include="*.test.tsx"`, and add the same `vi.mock` line to each.

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/seller`
Expected: FAIL: the components and the helper don't exist, and the band has no Follow.

- [ ] **Step 3: Write Follow**

Create `components/seller/FollowControl.tsx`:

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { followShop, unfollowShop } from "@/lib/following/actions";
import { followNoticeText, UNFOLLOWED_SHORT } from "@/lib/following/rules";
import { signInHref } from "@/lib/next-path";
import { ViewerFollow } from "./ViewerFollow";

type FollowProps = { slug: string; name: string };

/** Follow for a signed-out visitor, and the static shell: sign in, then back to the shop (spec 2.16). */
export function FollowSignedOut({ slug, name }: FollowProps) {
  return (
    <Link href={signInHref(`/sellers/${slug}`)} prefetch={false} className="btn btn-sky seller-follow-btn">
      Follow <span className="sr-only">{name}</span>
    </Link>
  );
}

type FollowButtonsProps = FollowProps & {
  following: boolean;
  /** The last press's code, once (plan decision 7): "followed", "unfollowed" or "follow-limit". */
  notice: string | null;
};

/**
 * Follow, or "You follow this shop" and Unfollow (spec 2.16): one form button each, so they work before the app's
 * JavaScript arrives. The words say what the button does, so it has no pressed state.
 */
export function FollowButtons({ slug, name, following, notice }: FollowButtonsProps) {
  if (following) {
    const followed = notice === "followed";
    return (
      <>
        <p className="seller-follow-note" role={followed ? "status" : undefined}>
          {followed ? followNoticeText("followed", name) : "You follow this shop"}
        </p>
        <form action={unfollowShop}>
          <input type="hidden" name="shop" value={slug} />
          <button type="submit" className="btn seller-unfollow">
            Unfollow <span className="sr-only">{name}</span>
          </button>
        </form>
      </>
    );
  }
  return (
    <>
      <form action={followShop}>
        <input type="hidden" name="shop" value={slug} />
        <button type="submit" className="btn btn-sky seller-follow-btn">
          Follow <span className="sr-only">{name}</span>
        </button>
      </form>
      {notice === "unfollowed" && (
        <p role="status" className="seller-follow-note">
          {UNFOLLOWED_SHORT}
        </p>
      )}
      {notice === "follow-limit" && (
        <p role="status" className="seller-follow-note">
          {followNoticeText("follow-limit", name)}
        </p>
      )}
    </>
  );
}

/**
 * Follow in the storefront's band (community actions spec 2.16, plan decision 16): a box that's always there, 44px
 * high, holding the session's part in its own <Suspense> with the signed-out link as the fallback, so the storefront
 * keeps its prerendered shell and nothing moves when it streams in. No client bytes.
 */
export function FollowControl({ slug, name }: FollowProps) {
  return (
    <div className="seller-follow">
      <Suspense fallback={<FollowSignedOut slug={slug} name={name} />}>
        <ViewerFollow slug={slug} name={name} />
      </Suspense>
    </div>
  );
}
```

Create `components/seller/ViewerFollow.tsx`:

```tsx
import { getViewer } from "@/lib/auth/session";
import { isFollowing } from "@/lib/data/follows";
import { followNoteKey } from "@/lib/following/rules";
import { takeNote } from "@/lib/looking-for/form-state";
import { shopSlugOf } from "@/lib/messaging/subjects";
import { FollowButtons, FollowSignedOut } from "./FollowControl";

/**
 * Follow once the session is read (community actions spec 2.16): the sign-in link when signed out, nothing for the
 * shop's owner (F's Edit shop is in the band), otherwise Follow or Unfollow with the last press's status line. An
 * async Server Component: FollowControl puts it inside <Suspense>. A failed session read gives the signed-out link.
 */
export async function ViewerFollow({ slug, name }: { slug: string; name: string }) {
  const account = await getViewer().catch(() => null);
  if (!account) return <FollowSignedOut slug={slug} name={name} />;
  if (shopSlugOf(account) === slug) return null;
  const [following, note] = await Promise.all([isFollowing(account.id, slug), takeNote(followNoteKey(slug))]);
  return <FollowButtons slug={slug} name={name} following={following} notice={note?.notice ?? null} />;
}
```

Create `tests/helpers/viewer-follow.tsx`:

```tsx
import { FollowSignedOut } from "@/components/seller/FollowControl";

/**
 * Stands in for components/seller/ViewerFollow.tsx in component tests (community actions plan, Task 17): the real one
 * is an async Server Component, which jsdom can't render inside a tree. In a test file:
 *
 *   vi.mock("@/components/seller/ViewerFollow", async () => (await import("@/tests/helpers/viewer-follow")).signedOutViewerFollow);
 */
export const signedOutViewerFollow = {
  ViewerFollow: ({ slug, name }: { slug: string; name: string }) => <FollowSignedOut slug={slug} name={name} />,
};
```

- [ ] **Step 4: Put it in the band**

In `components/seller/SellerHero.tsx`:
1. Add `import { FollowControl } from "./FollowControl";` after the `@/…` imports.
2. Inside the `seller-hero-actions` div, after the `<ShareButton … />` element, add:

```tsx
        <FollowControl slug={seller.slug} name={seller.name} />
```

3. Add to the component's comment: "Follow has its own row under them (community actions spec 2.16)."

- [ ] **Step 5: Style it**

Check the names are free (`grep -n "\.seller-follow\|\.seller-unfollow" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Community actions: Follow on the storefront's band (community actions plan, Task 17, spec 2.16) --- */
@layer components {
  /* The actions wrap, so Follow has a row of its own at every size (plan decision 16). */
  .seller-hero-actions {
    flex-wrap: wrap;
  }

  /* Always there and at least 44px high, whatever the session says, so nothing below moves when it streams in. */
  .seller-follow {
    display: flex;
    flex: 1 0 100%;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    min-height: 44px;
  }

  /* Navy on solid sky (4.97:1), as Message seller. */
  .seller-follow-btn {
    min-height: 44px;
    padding-inline: 28px;
  }

  /* A white outline with white text on the stars (spec section 4). */
  .seller-unfollow {
    min-height: 44px;
    border: 1.5px solid var(--color-white);
    color: var(--color-white);
  }

  /* Small text on the stars is white (CLAUDE.md). */
  .seller-follow-note {
    color: var(--color-white);
    font-size: 14px;
    font-weight: 600;
  }

  /* From the tablet step the actions keep one width, so the row's words never widen the band (plan decision 16). */
  @media (min-width: 48rem) and (min-height: 30rem) {
    .seller-hero-actions {
      width: 18rem;
    }
  }
}
```

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 8 more unit tests than after Task 16.

- [ ] **Step 7: Measure the JavaScript**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Write every page's `scriptBrotli` into the ledger's "Task 17" row. **Every figure must equal Task 16's to the byte** (spec 5): Follow is Server Components, a `Link` and two forms posting to Server Actions, which the storefront already loads. If any page moved, stop and find out why before going on. If any page is past the stop line, stop and report.

- [ ] **Step 8: Look at it**

Start the build (`pnpm start --port 3201`) at 360 × 780, 390 × 844, 768 × 1024 and 1280 × 800. Signed out, `/sellers/tech-corner`: Message seller and Share, then a sky **Follow** pill on its own row, white-on-stars nothing else. Sign in as "Student, Midrand" and press **Follow**: "You follow Tech corner." and a white **Unfollow** in the same row, at the same height. Reload: "You follow this shop". **Unfollow**: Follow and "Unfollowed.". Nothing in the band moves while the page loads (watch it with the network throttled). As "Seller, Tech corner": Edit shop and Share, and an empty row. Stop the server.

- [ ] **Step 9: Hand over for commit**

Files: `components/seller/FollowControl.tsx`, `components/seller/FollowControl.test.tsx`, `components/seller/ViewerFollow.tsx`, `components/seller/ViewerFollow.test.tsx`, `tests/helpers/viewer-follow.tsx`, `components/seller/SellerHero.tsx`, `components/seller/SellerHero.test.tsx`, any other test Step 1's `grep` found, `app/globals.css`.
Message: `feat: Follow on the storefront's band, from the session in its own Suspense: a sign-in link, Follow, or You follow this shop and Unfollow, nothing for the owner (community actions spec 2.16). JS: storefront <n> B, listing <n> B, unchanged`

---

### Task 18: Saved's Shops tab

Shops you follow live on Saved (spec 2.17; plan decision 17): two tabs as links, **Listings** (`/saved`, as now, with its device note) and **Shops** (`/saved?tab=shops`, "Kept with your account."): newest follow first, as the Hub's small seller cards (round photo, name, campus, "Paused" when it is), each with how many it has listed and **Unfollow {shop}**; signed out, a sentence and a sign-in link back to the tab. The tab comes from `searchParams`, so the tabs, the note and the list stream in together behind one skeleton. Saved is a shared page, so this task ends by measuring.

**Files:**
- Create: `components/saved/SavedTabs.tsx`, `components/saved/SavedTabs.test.tsx`
- Create: `components/saved/FollowedShopsView.tsx`, `components/saved/FollowedShopsView.test.tsx`
- Create: `components/saved/FollowedShops.tsx`, `components/saved/FollowedShops.test.tsx`
- Modify: `components/saved/SavedSkeleton.tsx`
- Modify: `app/saved/page.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Write the tests**

Create `components/saved/SavedTabs.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SavedTabs } from "./SavedTabs";

// The lists are async and tested on their own; here they stand in.
vi.mock("./SavedList", () => ({ SavedList: () => <p>The saved listings</p> }));
vi.mock("./FollowedShops", () => ({ FollowedShops: () => <p>The shops you follow</p> }));

const tabs = async (params: Record<string, string>) => render(await SavedTabs({ searchParams: Promise.resolve(params) }));

describe("Saved's tabs (community actions spec 2.17, plan decision 17)", () => {
  it("opens on Listings, with the device note", async () => {
    await tabs({});
    const nav = screen.getByRole("navigation", { name: "What's saved" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Listings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Listings" })).toHaveAttribute("href", "/saved");
    expect(screen.getByRole("link", { name: "Shops" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText(/^Saved on this device\./)).toBeInTheDocument();
    expect(screen.getByText("The saved listings")).toBeInTheDocument();
  });

  it("opens Shops for ?tab=shops, kept with the account", async () => {
    await tabs({ tab: "shops" });
    expect(screen.getByRole("link", { name: "Shops" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Shops" })).toHaveAttribute("href", "/saved?tab=shops");
    expect(screen.getByText("Kept with your account.")).toBeInTheDocument();
    expect(screen.queryByText(/Saved on this device/)).toBeNull();
    expect(screen.getByText("The shops you follow")).toBeInTheDocument();
  });
});
```

Create `components/saved/FollowedShopsView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FollowedShop } from "@/lib/types";
import { FollowedShopsView } from "./FollowedShopsView";

vi.mock("@/lib/following/actions", () => ({ unfollowShop: async () => {} }));

const NAMES = new Map([
  ["midrand", "Midrand"],
  ["pretoria", "Pretoria"],
]);

const shop = (overrides: Partial<FollowedShop>): FollowedShop => ({
  slug: "tech-corner",
  name: "Tech corner",
  campusSlug: "midrand",
  image: { src: "/placeholders/seller/tech-corner.svg", alt: "The tech corner at work" },
  paused: false,
  listed: 2,
  ...overrides,
});

describe("the shops you follow (community actions spec 2.17)", () => {
  it("shows each as the Hub's small card, with what it has listed and Unfollow", () => {
    render(
      <FollowedShopsView
        shops={[shop({}), shop({ slug: "code-coach", name: "Code coach", campusSlug: "pretoria", paused: true, listed: 0 })]}
        campusNames={NAMES}
        notice={null}
      />,
    );
    expect(screen.getByText("2 shops")).toBeInTheDocument();
    const [tech, coach] = screen.getAllByRole("listitem");
    expect(within(tech).getByRole("link")).toHaveAttribute("href", "/sellers/tech-corner");
    expect(within(tech).getByRole("link")).toHaveTextContent("Tech corner Midrand 2 listings");
    expect(within(coach).getByRole("link")).toHaveTextContent("Code coach Pretoria Paused Nothing listed right now");
    expect(within(tech).getByRole("button", { name: "Unfollow Tech corner" })).toHaveAttribute("type", "submit");
    expect(tech.querySelector('input[name="from"]')).toHaveValue("saved");
  });

  it("says what the last unfollow did", () => {
    render(<FollowedShopsView shops={[]} campusNames={NAMES} notice="You've unfollowed Tech corner." />);
    expect(screen.getByRole("status")).toHaveTextContent("You've unfollowed Tech corner.");
  });

  it("says how to follow one when there are none", () => {
    render(<FollowedShopsView shops={[]} campusNames={NAMES} notice={null} />);
    expect(screen.getByText("Follow a shop from its page and it shows here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
  });

  it("asks a signed-out visitor to sign in, coming back to the tab", () => {
    render(<FollowedShopsView shops={null} campusNames={NAMES} notice={null} />);
    expect(screen.getByText("Sign in to follow shops. They'll show here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fsaved%3Ftab%3Dshops");
  });
});
```

Create `components/saved/FollowedShops.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addFollow } from "@/lib/data/follows";
import { resetSampleStore } from "@/lib/data/store";
import { FollowedShops } from "./FollowedShops";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));
const note = vi.hoisted(() => ({ notice: null as string | null }));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async () => (note.notice ? { notice: note.notice, values: { shop: "Code coach" } } : null),
}));
vi.mock("@/lib/following/actions", () => ({ unfollowShop: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
  note.notice = null;
});

describe("the shops you follow, for this visitor (community actions spec 2.17)", () => {
  it("lists the visitor's follows, with the last unfollow's status line", async () => {
    await addFollow("acc-student", "tech-corner", new Date("2026-10-14T08:42:00.000Z"));
    viewer.account = { id: "acc-student" };
    note.notice = "unfollowed";
    render(await FollowedShops());
    expect(screen.getByRole("button", { name: "Unfollow Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("You've unfollowed Code coach.");
  });

  it("asks a signed-out visitor to sign in", async () => {
    render(await FollowedShops());
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/saved`
Expected: FAIL, because the three components don't exist.

- [ ] **Step 3: Write the Shops tab**

Create `components/saved/FollowedShopsView.tsx`:

```tsx
import Link from "next/link";
import { Photo } from "@/components/listings/Photo";
import { listingsLabel } from "@/lib/format";
import { unfollowShop } from "@/lib/following/actions";
import { savedTabPath } from "@/lib/following/rules";
import { signInHref } from "@/lib/next-path";
import type { FollowedShop } from "@/lib/types";

type FollowedShopsViewProps = {
  /** Newest follow first; null when signed out. */
  shops: readonly FollowedShop[] | null;
  campusNames: ReadonlyMap<string, string>;
  /** The last unfollow's words, once (plan decision 7). */
  notice: string | null;
};

/**
 * Saved's Shops tab (community actions spec 2.17, plan decision 17): the Hub's small seller cards (round photo, name,
 * campus, "Paused"), how many each has listed, and Unfollow, which comes back here. No prefetch on the storefronts:
 * their chunk carries Share and the hearts (decision 53).
 */
export function FollowedShopsView({ shops, campusNames, notice }: FollowedShopsViewProps) {
  if (shops === null) {
    return (
      <section aria-labelledby="saved-shops-title" className="saved-empty">
        <h2 id="saved-shops-title" className="saved-empty-title">
          Shops you follow
        </h2>
        <p>Sign in to follow shops. They&apos;ll show here.</p>
        <Link href={signInHref(savedTabPath("shops"))} prefetch={false} className="btn btn-primary">
          Sign in
        </Link>
      </section>
    );
  }
  return (
    <section aria-labelledby="saved-shops-title">
      <h2 id="saved-shops-title" className="sr-only">
        Shops you follow
      </h2>
      {notice && (
        <p role="status" className="form-notice saved-shops-notice">
          {notice}
        </p>
      )}
      {shops.length === 0 ? (
        <div className="saved-empty">
          <p className="saved-empty-title">No shops yet</p>
          <p>Follow a shop from its page and it shows here.</p>
          <Link href="/browse" prefetch={false} className="btn btn-primary">
            Browse
          </Link>
        </div>
      ) : (
        <>
          <p className="saved-count">{shops.length === 1 ? "1 shop" : `${shops.length} shops`}</p>
          <ul className="saved-shops">
            {shops.map((shop) => (
              <li key={shop.slug} className="saved-shop">
                <Link href={`/sellers/${shop.slug}`} prefetch={false} className="hub-seller">
                  <Photo
                    image={{ src: shop.image.src, alt: "" }}
                    ratio="1 / 1"
                    sizes="56px"
                    className="hub-seller-photo"
                  />
                  <span className="hub-seller-name">{shop.name}</span>{" "}
                  <span className="hub-seller-campus">{campusNames.get(shop.campusSlug)}</span>{" "}
                  {shop.paused && <span className="saved-shop-paused">Paused</span>}{" "}
                  <span className="saved-shop-listed">
                    {shop.listed === 0 ? "Nothing listed right now" : listingsLabel(shop.listed)}
                  </span>
                </Link>
                <form action={unfollowShop}>
                  <input type="hidden" name="shop" value={shop.slug} />
                  <input type="hidden" name="from" value="saved" />
                  <button type="submit" className="btn btn-outline text-navy saved-shop-unfollow">
                    Unfollow <span className="sr-only">{shop.name}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
```

Create `components/saved/FollowedShops.tsx`:

```tsx
import { getViewer } from "@/lib/auth/session";
import { getCampuses } from "@/lib/data";
import { listFollowedShops } from "@/lib/data/follows";
import { followNoticeText, SAVED_SHOPS_FORM } from "@/lib/following/rules";
import { takeNote } from "@/lib/looking-for/form-state";
import { FollowedShopsView } from "./FollowedShopsView";

/** The Shops tab for this request's visitor (community actions spec 2.17). Request-time: inside Saved's <Suspense>. */
export async function FollowedShops() {
  const account = await getViewer().catch(() => null);
  if (!account) return <FollowedShopsView shops={null} campusNames={new Map()} notice={null} />;
  const [shops, note, campuses] = await Promise.all([
    listFollowedShops(account.id),
    takeNote(SAVED_SHOPS_FORM),
    getCampuses(),
  ]);
  return (
    <FollowedShopsView
      shops={shops}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      notice={followNoticeText(note?.notice, note?.values.shop ?? "the shop")}
    />
  );
}
```

Create `components/saved/SavedTabs.tsx`:

```tsx
import { LinkTabs } from "@/components/ui/LinkTabs";
import { parseSavedTab, savedTabPath } from "@/lib/following/rules";
import { FollowedShops } from "./FollowedShops";
import { SavedList } from "./SavedList";

type SavedTabsProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Saved's two tabs (community actions spec 2.17, plan decision 17): links, the open one marked aria-current, then the
 * tab's note and its list. It reads `?tab=`, so Saved's page puts it inside <Suspense>. The device note belongs to
 * Listings; Shops are kept with the account.
 */
export async function SavedTabs({ searchParams }: SavedTabsProps) {
  const tab = parseSavedTab((await searchParams).tab);
  return (
    <>
      <LinkTabs
        label="What's saved"
        look="tabs"
        current={tab}
        tabs={[
          { key: "listings", label: "Listings", href: savedTabPath("listings") },
          { key: "shops", label: "Shops", href: savedTabPath("shops") },
        ]}
      />
      {tab === "listings" ? (
        <>
          <p className="saved-note">
            Saved on this device. Once Vossie is live, your saves will follow your account to any device.
          </p>
          <SavedList />
        </>
      ) : (
        <>
          <p className="saved-note">Kept with your account.</p>
          <FollowedShops />
        </>
      )}
    </>
  );
}
```

(If the built page's device note says something else by now, move its words as they are.)

- [ ] **Step 4: The page and its skeleton**

Replace `app/saved/page.tsx`'s default export and its comment (keep `metadata` as it is) with:

```tsx
/**
 * Saved (shopping spec 5; community actions spec 2.17). The heading is prerendered; the tabs read `?tab=`, and the
 * lists read the saved cookie or the session, so they stream in together behind a skeleton (plan decision 17).
 */
export default function SavedPage({ searchParams }: PageProps<"/saved">) {
  return (
    <div className="page saved-page">
      <h1 className="saved-title">Saved</h1>
      <Suspense fallback={<SavedSkeleton />}>
        <SavedTabs searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
```

and replace `import { SavedList } from "@/components/saved/SavedList";` with `import { SavedTabs } from "@/components/saved/SavedTabs";`.

In `components/saved/SavedSkeleton.tsx`, add straight after the opening `<div aria-hidden="true">`:

```tsx
      <span className="skeleton saved-skeleton-tabs" />
      <span className="skeleton saved-skeleton-note" />
```

and change its comment to "Saved's shape while it streams in (shopping spec 5.4, community actions plan decision 17): the tabs, the note, the count line and 8 card shapes, so nothing jumps."

- [ ] **Step 5: Style it**

Check the names are free (`grep -n "\.saved-shop\|\.saved-skeleton-tabs\|\.saved-skeleton-note" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Community actions: Saved's tabs and the shops you follow (community actions plan, Task 18, spec 2.17) --- */
@layer components {
  /* As tall as the tabs (44px links, 4px of top padding and the 1px line) and the note, so nothing jumps. */
  .saved-skeleton-tabs {
    display: block;
    height: 49px;
    margin-top: 22px;
  }

  .saved-skeleton-note {
    display: block;
    width: min(100%, 30rem);
    height: 2.6em;
    margin-top: 10px;
  }

  .saved-shops-notice {
    margin-top: 20px;
  }

  /* One wrapping row of the Hub's small cards (community spec 5.1), each with Unfollow under it. */
  .saved-shops {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 12px;
    margin-top: 16px;
  }

  .saved-shop {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 8px;
  }

  .saved-shop-paused {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--color-pale);
    color: var(--color-navy);
    font-size: 12px;
    font-weight: 600;
  }

  .saved-shop-listed {
    color: var(--color-ink);
    font-size: 12px;
  }

  .saved-shop-unfollow {
    min-height: 44px;
  }
}
```

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 8 more unit tests than after Task 17. Part B's and the shopping pages' Saved tests (`SavedList.test.tsx`) are unchanged.

- [ ] **Step 7: Measure the JavaScript**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Write every page's `scriptBrotli` into the ledger's "Task 18" row. **Every figure must equal Task 17's to the byte** (spec 5): the tabs are `LinkTabs` (Server Components and `Link`s), and the Shops tab's cards, form and `Photo` are on the same route Saved already loads. If any page moved, stop and find out why before going on. If any page is past the stop line, stop and report.

- [ ] **Step 8: Look at it**

Start the build (`pnpm start --port 3201`) at 390 × 844, 768 × 1024 and 1280 × 800. `/saved`: "SAVED", the Listings and Shops tabs (Listings underlined), the device note, the listings. **Shops** signed out: the sentence and **Sign in**, which comes back to the tab. Signed in as "Student, Midrand", follow Tech corner from its storefront, then `/saved?tab=shops`: "Kept with your account.", "1 shop", Tech corner's card with "2 listings" and **Unfollow**; press it: "You've unfollowed Tech corner." and "No shops yet". Watch both tabs load with the network throttled: nothing jumps when the content replaces the skeleton. Stop the server.

- [ ] **Step 9: Hand over for commit**

Files: `components/saved/SavedTabs.tsx`, `components/saved/SavedTabs.test.tsx`, `components/saved/FollowedShopsView.tsx`, `components/saved/FollowedShopsView.test.tsx`, `components/saved/FollowedShops.tsx`, `components/saved/FollowedShops.test.tsx`, `components/saved/SavedSkeleton.tsx`, `app/saved/page.tsx`, `app/globals.css`.
Message: `feat: Saved's tabs: Listings as before, and Shops with the shops you follow, each with its listings count and Unfollow (community actions spec 2.17). JS: Saved <n> B, listing <n> B, unchanged`

---

### Task 19: The account page, the dashboard's followers, privacy and robots

The rest of the existing pages (spec 2.13, 2.18 and 2.23; plan decisions 21 and 23): the account page gains a **Your requests** row; the shop's dashboard says how many follow it ("12 people follow your shop"), never who; the privacy policy's "Your account" section adds requests and follows, and says what deleting removes; privacy settings say what the download holds and what deleting removes; `robots.txt` keeps crawlers off the new pages. (The `vossie_offline` cache joins the policy with the worker, in Task 21, so it can be dropped with it.) `/sell` is prefetched from every page's header, so this task ends by measuring.

**Files:**
- Modify: `components/account/AccountView.tsx`, `components/account/AccountView.test.tsx`
- Modify: `components/sell/Dashboard.tsx`, `components/sell/Dashboard.test.tsx`, `components/sell/SellHome.tsx`
- Modify: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`
- Modify: `components/account/PrivacySettingsView.tsx`, `components/account/PrivacySettingsView.test.tsx`
- Modify: `app/robots.ts`, `app/robots.test.ts`

- [ ] **Step 1: Change the tests first**

In `components/account/AccountView.test.tsx` (D Task 10, E Task 13, F Task 14, G Task 18), add at the end of its main `describe`:

```tsx

  it("links to Your requests, with no prefetch (community actions spec 2.13)", () => {
    renderAccount();
    const rows = screen.getByRole("navigation", { name: "Your account's pages" });
    expect(within(rows).getByRole("link", { name: "Your requests" })).toHaveAttribute("href", "/account/requests");
  });
```

(`renderAccount` is the file's own helper; if a later stage renamed it, use the file's way of rendering the page.)

In `components/sell/Dashboard.test.tsx` (F Task 9, G Task 18), add at the end of its `describe` (it uses the file's own `shop` and `stats`):

```tsx

  it("says how many follow the shop, never who (community actions spec 2.18)", () => {
    const { unmount } = render(
      <Dashboard shop={shop} paused={false} stats={stats} badgeLine="" notice={null} followers={12} />,
    );
    expect(screen.getByText("12 people follow your shop")).toBeInTheDocument();
    unmount();
    render(<Dashboard shop={shop} paused={false} stats={stats} badgeLine="" notice={null} />);
    expect(screen.getByText("No one follows your shop yet")).toBeInTheDocument();
  });
```

In `app/privacy/page.test.tsx`, add after the last test:

```tsx

  it("says what Looking For and following keep, and that deleting your account removes them (community actions spec 2.23)", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(within(account).getByText(/never with your name/)).toBeInTheDocument();
    expect(within(account).getByText(/a shop sees only how many people follow it, never who/)).toBeInTheDocument();
    const keep = screen.getByRole("region", { name: "How long we keep it" });
    expect(within(keep).getByText(/your Looking For requests, the shops you follow/)).toBeInTheDocument();
  });
```

In `components/account/PrivacySettingsView.test.tsx`, add at the end of its `describe` (pass the same props the file's other renders pass by now; when this plan was written E had added `reports={[]}`):

```tsx

  it("says the download and the deletion take in requests and follows (community actions spec 2.23)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    expect(screen.getByText(/your Looking For requests and the shops you follow/)).toBeInTheDocument();
    expect(screen.getByText(/your requests and follows go too/)).toBeInTheDocument();
  });
```

In `app/robots.test.ts`, add at the end of its `describe`:

```ts

  it("keeps crawlers off Looking For's forms and the offline page, and not off requests (community actions plan decision 23)", () => {
    for (const path of ["/looking-for/new", "/looking-for/r-001/offer", "/looking-for/r-001/edit", "/looking-for/r-001/delete", "/offline"]) {
      expect(blocked(path), path).toBe(true);
    }
    expect(blocked("/looking-for/r-001")).toBe(false);
    expect(blocked("/looking-for")).toBe(false);
  });
```

(`blocked` is the helper E and G use in this file to test a path against the rules; if it's named differently, use its name.)

Run: `pnpm test components/account components/sell/Dashboard.test.tsx app/privacy app/robots.test.ts`
Expected: FAIL: no Your requests row, no followers line, no words about requests or follows, and the new pages aren't disallowed.

- [ ] **Step 2: The account page's row**

In `components/account/AccountView.tsx`:
1. Add `import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";` among the `@/lib/…` imports, in alphabetical order.
2. In the `account-rows` list, straight after the `<li>` holding the Saved link, add:

```tsx
          <li>
            {/* No prefetch: the page reads the session (community actions spec 2.13). */}
            <Link href={YOUR_REQUESTS_PATH} prefetch={false} className="account-row">
              Your requests
              <ChevronRightIcon />
            </Link>
          </li>
```

- [ ] **Step 3: The dashboard's followers**

In `components/sell/Dashboard.tsx`:
1. Add `import { followersLine } from "@/lib/following/rules";` among the `@/lib/…` imports, in alphabetical order.
2. In `DashboardProps`, after G's `hubPause?: string | null;`, add:

```tsx
  /** How many follow the shop (community actions spec 2.18): the shop sees the number, never who. */
  followers?: number;
```

3. Add `followers = 0` to the function's destructured parameters, after G's `hubPause = null`.
4. Straight after the `sell-status` paragraph (inside the `sell-head` header), add:

```tsx
        <p className="sell-followers">{followersLine(followers)}</p>
```

In `components/sell/SellHome.tsx` (F Task 9, G Task 18):
1. Add `import { countFollowers } from "@/lib/data/follows";` among the `@/lib/data/…` imports, in alphabetical order.
2. In the `Promise.all` that reads `shopStats(…)` and the dashboard's form state, add `countFollowers(own.shop.slug)` as a third item, naming it `followers` in the destructuring (`const [stats, state, followers] = await Promise.all([…, countFollowers(own.shop.slug)]);`).
3. Add the prop `followers={followers}` to the returned `<Dashboard … />`.

Append to the end of `app/globals.css`:

```css

/* --- Community actions: the dashboard's followers (community actions plan, Task 19, spec 2.18) --- */
@layer components {
  .sell-followers {
    margin-top: 6px;
    color: var(--color-muted);
    font-size: 14px;
  }
}
```

- [ ] **Step 4: The words**

In `app/privacy/page.tsx` (edit by meaning: E, F and G changed these lists):
1. In the `privacy-sign-in` section's list, straight after G's bullet that starts `<strong>Your RSVPs and slot requests.</strong>` (G Task 19; or straight after E's bullet that starts `<strong>Your messages, swap offers and reports.</strong>` if G's isn't there), add:

```tsx
          <li>
            <strong>Your Looking For requests.</strong> What you ask for, shown to everyone as &quot;Asked by a student
            at&quot; your campus, never with your name. Vossie keeps which account asked, so only you can change or
            delete it. Allowed under POPIA section 11: needed to run the service you ask for.
          </li>
          <li>
            <strong>The shops you follow.</strong> So Saved can list them and tell you when they list something new; a
            shop sees only how many people follow it, never who. Allowed under POPIA section 11: needed to run the
            service you ask for.
          </li>
```

2. In the `privacy-keep` list, in the bullet that says what deleting your account removes, add "your Looking For requests, the shops you follow," to its list of what goes, straight before the messages (or, if the sentence is built differently by now, at the end of what goes straight away).

In `components/account/PrivacySettingsView.tsx` (edit by meaning: E, F and G changed these sentences):
1. In "Download your data"'s sentence, add "your Looking For requests and the shops you follow" to the list of what the file holds, before its last item.
2. In the list of what deleting does, add this bullet before its last one:

```tsx
            <li>your requests and follows go too, so the shops you followed count one fewer;</li>
```

In `app/robots.ts`, add to the end of the `DISALLOWED` list (after G's `"/hub/*/book"`):

```ts
  // Looking For's forms belong to one person, and the offline page is the worker's (community actions plan decision 23).
  "/looking-for/new",
  "/looking-for/*/offer",
  "/looking-for/*/edit",
  "/looking-for/*/delete",
  "/offline",
```

(If `DISALLOWED` is written on one line, put the new paths at its end in the same style, with the comment above the constant.)

Run: `pnpm test components/account components/sell app/privacy app/robots.test.ts`
Expected: PASS.

- [ ] **Step 5: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 5 more unit tests than after Task 18.

- [ ] **Step 6: Measure the JavaScript**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Write every page's `scriptBrotli` into the ledger's "Task 19" row. **Every figure must equal Task 18's to the byte** (spec 5): the dashboard and the account page are Server Components. If any page moved, stop and find out why before going on. If any page is past the stop line, stop and report.

- [ ] **Step 7: Hand over for commit**

Files: `components/account/AccountView.tsx`, `components/account/AccountView.test.tsx`, `components/sell/Dashboard.tsx`, `components/sell/Dashboard.test.tsx`, `components/sell/SellHome.tsx`, `app/privacy/page.tsx`, `app/privacy/page.test.tsx`, `components/account/PrivacySettingsView.tsx`, `components/account/PrivacySettingsView.test.tsx`, `app/robots.ts`, `app/robots.test.ts`, `app/globals.css`.
Message: `feat: Your requests on the account page, the dashboard's follower count, the privacy policy and settings on requests and follows, and robots.txt for the new pages (community actions spec 2.13, 2.18 and 2.23). JS: / <n> B, listing <n> B, unchanged`

---

### Task 20: The offline page

`/offline` (spec 2.20 and section 4; plan decision 25): one self-contained HTML document from a route handler, with inline styles, no scripts, no images and no outside files, under 4 KB: "Vossie" set as text, an h1 "You're offline", the spec's sentence and **Try again** (a link to the same address), in the system fonts the brand faces fall back to, navy on white, `lang="en-ZA"`, `noindex` in a header. A Next page would need the site's hashed script and style files, which an offline browser doesn't have. Nothing shows it yet: the worker comes in Task 21.

**Files:**
- Create: `lib/offline.ts`, `lib/offline.test.ts`
- Create: `app/offline/route.ts`, `app/offline/route.test.ts`

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `01-getting-started/15-route-handlers.md` ("With Cache Components"): a GET handler that reads no request data is prerendered at build, and its response, headers included, is served as it was built.

- [ ] **Step 2: Write the tests**

Create `lib/offline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { STATIC_PATHS } from "./sitemap";
import { OFFLINE_PAGE, OFFLINE_PATH } from "./offline";

const page = () => new DOMParser().parseFromString(OFFLINE_PAGE, "text/html");

describe("the offline page (community actions spec 2.20)", () => {
  it("is a whole document in South African English, kept out of search", () => {
    expect(OFFLINE_PAGE.startsWith("<!doctype html>")).toBe(true);
    expect(OFFLINE_PAGE).toContain('<html lang="en-ZA">');
    expect(OFFLINE_PAGE).toContain('<meta name="robots" content="noindex">');
    expect(OFFLINE_PATH).toBe("/offline");
    expect(STATIC_PATHS).not.toContain("/offline");
  });

  it("says you're offline, what to check, and Try again, a link to the same address", () => {
    const doc = page();
    expect([...doc.querySelectorAll("h1")].map((heading) => heading.textContent)).toEqual(["You're offline"]);
    expect(doc.body.textContent).toContain("Vossie needs a connection to show listings and messages. Check your data or Wi-Fi.");
    expect(doc.querySelector(".brand")?.textContent).toBe("Vossie");
    const tryAgain = doc.querySelector("a");
    expect(tryAgain?.textContent).toBe("Try again");
    expect(tryAgain?.getAttribute("href")).toBe("");
  });

  it("needs nothing else: no script, no image, no outside file, under 4 KB", () => {
    expect(OFFLINE_PAGE).not.toMatch(/<script|<img|<link|<svg|src=|url\(|@import/i);
    expect(new TextEncoder().encode(OFFLINE_PAGE).length).toBeLessThan(4096);
  });

  it("sets the brand faces' fallbacks once, as --vos-font-*, and uses navy on white", () => {
    expect(OFFLINE_PAGE).toContain('--vos-font-display:"Arial Narrow",sans-serif');
    expect(OFFLINE_PAGE).toContain("--vos-font-text:ui-sans-serif,system-ui,sans-serif");
    expect(OFFLINE_PAGE).toContain("#15305d");
    expect(OFFLINE_PAGE).toContain("background:#fff");
    expect(OFFLINE_PAGE).toContain("min-height:44px");
  });
});
```

Create `app/offline/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { OFFLINE_PAGE } from "@/lib/offline";
import { GET } from "./route";

describe("/offline (community actions spec 2.20)", () => {
  it("answers with the page as HTML, and tells search engines to leave it out", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await response.text()).toBe(OFFLINE_PAGE);
  });
});
```

Run: `pnpm test lib/offline.test.ts app/offline/route.test.ts`
Expected: FAIL, because `lib/offline.ts` and the route don't exist.

- [ ] **Step 3: Write the page**

Create `lib/offline.ts`:

```ts
// The offline page (community actions spec 2.20, plan decision 25): one self-contained HTML document, with inline
// styles, no scripts, no images and no outside files, under 4 KB, so it works when the site's hashed files can't be
// fetched. "Vossie" is text (the crest PNG is 35 KB), in the system fonts the brand faces fall back to (app/fonts.ts),
// set once as --vos-font-*. Try again is a link to the same address: the worker shows this page in place of the one
// asked for, so "" is that page. The words beyond the spec's are samples for Lama to change.

export const OFFLINE_PATH = "/offline";

export const OFFLINE_PAGE = `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#15305d">
<title>You're offline · Vossie</title>
<style>
:root{--vos-font-display:"Arial Narrow",sans-serif;--vos-font-text:ui-sans-serif,system-ui,sans-serif;--navy:#15305d;--ink:#373f41}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:#fff;color:var(--ink);font-family:var(--vos-font-text);line-height:1.5}
main{max-width:30rem}
.brand{margin:0 0 24px;color:var(--navy);font-family:var(--vos-font-display);font-size:28px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
h1{margin:0;color:var(--navy);font-family:var(--vos-font-display);font-size:40px;line-height:1;text-transform:uppercase}
p{margin:16px 0 0;font-size:17px}
a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:24px;padding:0 28px;border-radius:999px;background:var(--navy);color:#fff;font-weight:600;text-decoration:none}
a:focus-visible{outline:2.5px solid var(--navy);outline-offset:3px}
</style>
</head>
<body>
<main>
<p class="brand">Vossie</p>
<h1>You're offline</h1>
<p>Vossie needs a connection to show listings and messages. Check your data or Wi-Fi.</p>
<a href="">Try again</a>
</main>
</body>
</html>`;
```

Create `app/offline/route.ts`:

```ts
import { OFFLINE_PAGE } from "@/lib/offline";

/**
 * The offline page (community actions spec 2.20): a whole document from a route handler, so it needs none of the
 * site's script and style files. It reads no request data, so the build prerenders it. Search engines leave it out
 * (the header here, and robots.txt).
 */
export function GET(): Response {
  return new Response(OFFLINE_PAGE, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}
```

Run: `pnpm test lib/offline.test.ts app/offline/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 4: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 5 more unit tests than after Task 19. The build lists `/offline` as a static route.

- [ ] **Step 5: Look at it**

Start the build (`pnpm start --port 3201`) and open `/offline` at 360 × 780 and 1280 × 800: "VOSSIE", "YOU'RE OFFLINE" and the sentence in navy and grey on white, centred, and a navy **Try again** pill; Tab reaches it with a visible ring; the response has `X-Robots-Tag: noindex` (the browser's network panel). Stop the server.

- [ ] **Step 6: Hand over for commit**

Files: `lib/offline.ts`, `lib/offline.test.ts`, `app/offline/route.ts`, `app/offline/route.test.ts`.
Message: `feat: the offline page, a self-contained document from a route handler: no scripts, images or outside files, under 4 KB, noindex (community actions spec 2.20)`

---

### Task 21: The service worker and its registration (accepted by Lama, 2026-10-14; cut if it costs)

A small service worker shows `/offline` when a page load fails (spec 2.21 and 2.22; plan decision 25): it keeps one thing, the offline page, in a cache named `vossie_offline`; it answers only GET page loads on this site whose network request fails, with navigation preload so pages aren't slowed; it never touches posts, data fetches or other sites, and never stores a page. `/sw.js` is a route handler sent with `Cache-Control: no-cache`; `WORKER_ON = false` is the kill switch. One statement joins the inline boot script, in production builds only, after the page's `load`.

**Lama accepted the registration on 2026-10-14** (approval 5). **The cut rule:** if the statement costs 100 B or more brotli-compressed in a page's HTML, or moves any page's `scriptBrotli`, stop at that step and report the figures. Don't undo anything yourself: this task's files stay uncommitted, the controller asks Lama what to do with them (the safety rules), and Task 24 puts `/offline` back on the go-live checklist. This task is last before the end-to-end tests, and its offline test is in its own file, so it can be dropped cleanly.

**Files:**
- Modify: `lib/offline.ts`, `lib/offline.test.ts`
- Create: `app/sw.js/route.ts`, `app/sw.js/route.test.ts`
- Modify: `lib/boot-script.ts`, `lib/boot-script.test.ts`
- Modify: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`
- Modify: `playwright.config.ts`
- Create: `tests/e2e/offline.spec.ts`
- Modify: `tests/e2e/performance.spec.ts`

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md` and `01-getting-started/15-route-handlers.md` ("With Cache Components"): awaiting `connection()` makes a GET handler run per request, so the `Cache-Control` it sets is the one sent. A folder named `sw.js` under `app/` serves `/sw.js`, the site's root, so the worker's scope is the whole site with no extra header. Read the `serviceWorkers` option in Playwright's test options (`node_modules/playwright/types/test.d.ts`): `"block"` stops pages registering workers.

- [ ] **Step 2: Write the worker's tests**

In `lib/offline.test.ts`, change the import from `./offline` to `import { OFFLINE_CACHE, OFFLINE_PAGE, OFFLINE_PATH, workerSource } from "./offline";`, add `vi` to the `vitest` import, and add at the end of the file:

```ts

type Listener = (event: Record<string, unknown>) => void;

/** Runs a worker's source against stand-ins for the browser's worker globals, and gives back what it touched. */
function runWorker(source: string, network: "online" | "offline" = "online") {
  const listeners = new Map<string, Listener>();
  const cache = { add: vi.fn<(request: unknown) => Promise<void>>(async () => undefined) };
  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async () => "the offline page"),
    delete: vi.fn(async () => true),
  };
  const self = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
    registration: { navigationPreload: { enable: vi.fn(async () => undefined) }, unregister: vi.fn(async () => true) },
  };
  const fetch = vi.fn(async () => {
    if (network === "offline") throw new TypeError("Failed to fetch");
    return "the page from the network";
  });
  class FakeRequest {
    constructor(
      readonly url: string,
      readonly init?: unknown,
    ) {}
  }
  const Response = { error: () => "a network error" };
  new Function("self", "caches", "location", "fetch", "Request", "Response", source)(
    self,
    caches,
    { origin: "https://vossie.test" },
    fetch,
    FakeRequest,
    Response,
  );
  return { listeners, cache, caches, self, fetch };
}

/** A fetch event, and what the worker answered with (undefined when it let the browser carry on). */
async function fetchEvent(
  listeners: Map<string, Listener>,
  request: { method: string; mode: string; url: string },
  preloadResponse: unknown = undefined,
) {
  let answer: Promise<unknown> | undefined;
  listeners.get("fetch")!({ request, preloadResponse: Promise.resolve(preloadResponse), respondWith: (value: Promise<unknown>) => (answer = value) });
  return answer === undefined ? undefined : await answer;
}

const PAGE_LOAD = { method: "GET", mode: "navigate", url: "https://vossie.test/browse" };

describe("the service worker (community actions spec 2.21, plan decision 25)", () => {
  it("keeps only the offline page, fetched fresh, in vossie_offline when it installs", async () => {
    const { listeners, caches, cache, self } = runWorker(workerSource(true));
    let done: Promise<unknown> = Promise.resolve();
    listeners.get("install")!({ waitUntil: (value: Promise<unknown>) => (done = value) });
    await done;
    expect(OFFLINE_CACHE).toBe("vossie_offline");
    expect(caches.open).toHaveBeenCalledWith("vossie_offline");
    expect(cache.add).toHaveBeenCalledTimes(1);
    expect(cache.add.mock.calls[0][0]).toMatchObject({ url: OFFLINE_PATH, init: { cache: "reload" } });
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it("turns on navigation preload when it starts", async () => {
    const { listeners, self } = runWorker(workerSource(true));
    let done: Promise<unknown> = Promise.resolve();
    listeners.get("activate")!({ waitUntil: (value: Promise<unknown>) => (done = value) });
    await done;
    expect(self.registration.navigationPreload.enable).toHaveBeenCalled();
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it("lets a page load through, using the preloaded response when there is one", async () => {
    const online = runWorker(workerSource(true));
    expect(await fetchEvent(online.listeners, PAGE_LOAD, "the preloaded page")).toBe("the preloaded page");
    expect(online.fetch).not.toHaveBeenCalled();
    expect(await fetchEvent(online.listeners, PAGE_LOAD)).toBe("the page from the network");
  });

  it("shows the offline page when a page load fails, and stores nothing", async () => {
    const offline = runWorker(workerSource(true), "offline");
    expect(await fetchEvent(offline.listeners, PAGE_LOAD)).toBe("the offline page");
    expect(offline.caches.match).toHaveBeenCalledWith(OFFLINE_PATH, { cacheName: "vossie_offline" });
    expect(offline.cache.add).not.toHaveBeenCalled();
  });

  it("never touches posts, data fetches or other sites", async () => {
    const { listeners } = runWorker(workerSource(true), "offline");
    expect(await fetchEvent(listeners, { ...PAGE_LOAD, method: "POST" })).toBeUndefined();
    expect(await fetchEvent(listeners, { ...PAGE_LOAD, mode: "cors" })).toBeUndefined();
    expect(await fetchEvent(listeners, { ...PAGE_LOAD, url: "https://example.com/" })).toBeUndefined();
  });

  it("is small, and never writes a response to a cache", () => {
    expect(new TextEncoder().encode(workerSource(true)).length).toBeLessThan(1024);
    expect(workerSource(true)).not.toMatch(/\.put\(/);
  });

  it("switched off, removes its cache and itself, and answers nothing", async () => {
    const { listeners, caches, self } = runWorker(workerSource(false));
    let done: Promise<unknown> = Promise.resolve();
    listeners.get("activate")!({ waitUntil: (value: Promise<unknown>) => (done = value) });
    await done;
    expect(caches.delete).toHaveBeenCalledWith("vossie_offline");
    expect(self.registration.unregister).toHaveBeenCalled();
    expect(listeners.has("fetch")).toBe(false);
  });
});
```

Create `app/sw.js/route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { workerSource } from "@/lib/offline";
import { GET } from "./route";

vi.mock("next/server", () => ({ connection: async () => undefined }));

describe("/sw.js (community actions spec 2.21)", () => {
  it("sends the worker as JavaScript with no-cache, so a fix arrives on the next visit", async () => {
    const response = await GET();
    expect(response.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(await response.text()).toBe(workerSource());
  });
});
```

In `lib/boot-script.test.ts`:
1. Add `import { brotliCompressSync, constants } from "node:zlib";` at the top, and change the import from `./boot-script` to `import { BOOT_SCRIPT, bootScript, INSTALL_PROMPT_EVENT, WORKER_REGISTRATION } from "./boot-script";`.
2. Add at the end of the file:

```ts

const brotli = (text: string) =>
  brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;

describe("the service worker's registration (community actions spec 2.22)", () => {
  it("registers /sw.js once the page has loaded, and does nothing where workers don't exist", () => {
    const register = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } });
    new Function(bootScript(true))();
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledWith("/sw.js");
    Reflect.deleteProperty(navigator, "serviceWorker");
    expect(() => new Function(bootScript(true))()).not.toThrow();
  });

  it("is only in production builds, and the rest of the script is unchanged", () => {
    expect(bootScript(false)).not.toContain("serviceWorker");
    expect(bootScript(true)).toBe(bootScript(false).replace(/\}\)\(\);$/, `${WORKER_REGISTRATION}})();`));
    expect(BOOT_SCRIPT).toBe(bootScript(false));
    expect(WORKER_REGISTRATION.length).toBeLessThanOrEqual(140);
  });

  it("costs under 100 B brotli-compressed in the script itself (the cut rule)", () => {
    expect(brotli(bootScript(true)) - brotli(bootScript(false))).toBeLessThan(100);
  });
});
```

(Vitest runs with `NODE_ENV` set to `test`, so `BOOT_SCRIPT` there has no registration.)

In `app/privacy/page.test.tsx`:
1. Add `import { OFFLINE_CACHE } from "@/lib/offline";` among the `@/lib/…` imports, in alphabetical order.
2. In "lists the two cookies and the three browser-only stores by their real names (spec 2.2)", change the h3 name `"Three things kept only in your browser"` to `"Four things kept only in your browser"`, change the expected list `[RECENTLY_VIEWED_KEY, RECENT_KEY, LOW_DATA_KEY]` to `[RECENTLY_VIEWED_KEY, RECENT_KEY, LOW_DATA_KEY, OFFLINE_CACHE]`, and change "the three browser-only stores" to "the four browser-only stores" in its name.

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/offline.test.ts app/sw.js/route.test.ts lib/boot-script.test.ts app/privacy/page.test.tsx`
Expected: FAIL: there's no worker, no `/sw.js`, no registration, and the policy doesn't name `vossie_offline`.

- [ ] **Step 4: Write the worker and its route**

In `lib/offline.ts`, add to the opening comment: "The service worker's source is here too (spec 2.21): it keeps the offline page and nothing else.", and append:

```ts

/** The worker's one cache (spec 2.21). The privacy policy names it. */
export const OFFLINE_CACHE = "vossie_offline";

/** The kill switch (plan decision 25): false makes /sw.js a worker that deletes its cache and unregisters itself. */
export const WORKER_ON = true;

/**
 * Change it whenever the worker or the offline page changes: browsers compare /sw.js byte for byte on each visit, and
 * a changed worker installs again and fetches the offline page afresh.
 */
export const WORKER_VERSION = "2026-10-14.1";

/**
 * The service worker's source (spec 2.21, plan decision 25). Installed, it fetches the offline page fresh into
 * vossie_offline; started, it turns on navigation preload. It answers only GET page loads on this site: the preloaded
 * response, or the network's, or, when that fails, the offline page. It never touches posts, data fetches or other
 * sites, and never stores a page, so nothing personal stays on a shared phone (POPIA). Under 1 KB.
 */
export function workerSource(on: boolean = WORKER_ON): string {
  const cache = JSON.stringify(OFFLINE_CACHE);
  if (!on) {
    return `// Vossie's service worker, switched off (${WORKER_VERSION}): it removes its cache and itself.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(caches.delete(${cache}).then(()=>self.registration.unregister())));
`;
  }
  return `// Vossie's service worker (${WORKER_VERSION}): it keeps the offline page, and shows it when a page load fails.
const C=${cache},P=${JSON.stringify(OFFLINE_PATH)};
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.add(new Request(P,{cache:"reload"}))).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(Promise.resolve(self.registration.navigationPreload&&self.registration.navigationPreload.enable()).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET"||r.mode!=="navigate"||new URL(r.url).origin!==location.origin)return;e.respondWith((async()=>{try{return(await e.preloadResponse)||(await fetch(r))}catch{return(await caches.match(P,{cacheName:C}))||Response.error()}})())});
`;
}
```

Create `app/sw.js/route.ts`:

```ts
import { connection } from "next/server";
import { workerSource } from "@/lib/offline";

/**
 * The service worker (community actions spec 2.21): its source, sent per request (connection()) so the header here is
 * exactly what goes out, with no-cache so a fix arrives on the next visit. WORKER_ON in lib/offline.ts is the kill
 * switch. Served from the site's root, so its scope is the whole site.
 */
export async function GET(): Promise<Response> {
  await connection();
  return new Response(workerSource(), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
```

- [ ] **Step 5: The registration**

In `lib/boot-script.ts`:
1. Take the text between `(function(){` and `})();` in `BOOT_SCRIPT` into a private constant, `const BOOT_BODY = \`…\`;` (a template literal, exactly as it is now, with its `${JSON.stringify(…)}` parts), and add above it:

```ts
/**
 * Registers the service worker once the page has loaded, so it never competes with the page (community actions spec
 * 2.22). 131 characters in every page's HTML; the cut rule is 100 B compressed (plan decision 25). A failed
 * registration (a blocked or private browser) is caught, so it never shows as an error.
 */
export const WORKER_REGISTRATION = `if("serviceWorker"in navigator)addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})});`;
```

2. Replace the `export const BOOT_SCRIPT = …;` line with:

```ts
/** The boot script, with the worker's registration at its end when `withWorker` (community actions spec 2.22). */
export function bootScript(withWorker: boolean): string {
  return `(function(){${BOOT_BODY}${withWorker ? WORKER_REGISTRATION : ""}})();`;
}

/** What the layout puts in <head>. Production builds register the worker; development doesn't (stale pages there). */
export const BOOT_SCRIPT = bootScript(process.env.NODE_ENV === "production");
```

3. Add to the file's opening comment's list: "- registers the service worker after load, in production builds (community actions spec 2.22)."

`app/layout.tsx` doesn't change: it still renders `BOOT_SCRIPT`.

In `app/privacy/page.tsx`, in the `privacy-today` section:
1. Change `<h3>Three things kept only in your browser</h3>` to `<h3>Four things kept only in your browser</h3>`.
2. Add this item at the end of that list, after the `vossie_low_data` item:

```tsx
          <li>
            <code>vossie_offline</code>: a copy of Vossie&apos;s offline page, kept by Vossie&apos;s service worker so
            an installed Vossie can say you&apos;re offline instead of showing an error. It holds nothing about you and
            no page you looked at.
          </li>
```

3. In the `privacy-keep` list, change "Your browser keeps the other three things until you clear them." to "Your browser keeps the other four things until you clear them." (edit by meaning if the sentence has changed).

Run: `pnpm test lib/offline.test.ts app/sw.js/route.test.ts lib/boot-script.test.ts app/privacy/page.test.tsx`
Expected: PASS. **If "costs under 100 B" fails, stop here** (the cut rule): report the figure to the controller.

- [ ] **Step 6: Block workers in every other test, and test the offline path**

In `playwright.config.ts`, add to the top-level `use` object, after `timezoneId: "Africa/Johannesburg",`:

```ts
    // Production builds register Vossie's service worker (community actions spec 2.22). Only tests/e2e/offline.spec.ts
    // lets it run; everywhere else a worker would keep the offline page and change what a dropped request shows.
    serviceWorkers: "block",
```

Create `tests/e2e/offline.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

// The one test that lets Vossie's service worker run (community actions spec section 6). Each test has its own browser
// context, so the worker never reaches another test. Chromium only, as every project is.
test.use({ serviceWorkers: "allow" });

test.describe("offline (community actions spec 2.20 to 2.22)", () => {
  test("the worker installs; an offline page load shows Vossie's offline page; Try again works once back online", async ({
    page,
    context,
  }) => {
    test.skip(test.info().project.name !== "phone-390", "Checked once, at 390px");
    await page.goto("/listings/l-001");
    // It registers after load, and keeps the offline page when it installs.
    await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active !== null);
    await expect
      .poll(() => page.evaluate(async () => Boolean(await caches.match("/offline", { cacheName: "vossie_offline" }))))
      .toBe(true);

    await context.setOffline(true);
    await page.goto("/browse");
    await expect(page.getByRole("heading", { level: 1, name: "You're offline" })).toBeVisible();
    await expect(page).toHaveURL(/\/browse$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-ZA");

    await context.setOffline(false);
    await page.getByRole("link", { name: "Try again" }).click();
    await expect(page).toHaveURL(/\/browse$/);
    await expect(page.getByRole("heading", { level: 1, name: "You're offline" })).toHaveCount(0);
    await expect(page.locator("main").getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("/sw.js is sent with no-cache, and /offline is noindex", async ({ request }) => {
    test.skip(test.info().project.name !== "phone-390", "Checked once, at 390px");
    const worker = await request.get("/sw.js");
    expect(worker.headers()["cache-control"]).toContain("no-cache");
    expect(worker.headers()["content-type"]).toContain("javascript");
    expect(await worker.text()).toContain("vossie_offline");
    const offline = await request.get("/offline");
    expect(offline.headers()["x-robots-tag"]).toBe("noindex");
  });
});
```

In `tests/e2e/performance.spec.ts`, add `import { WORKER_REGISTRATION } from "../../lib/boot-script";` below the `@playwright/test` import, and add at the end of the file:

```ts

/** The registration wherever the HTML holds it: in <head> as it is, and with its quotes escaped in the RSC payload. */
const registrationAnywhere = new RegExp(
  WORKER_REGISTRATION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/"/g, '\\\\*"'),
  "g",
);

test("the worker's registration costs under 100 B in a page's HTML (community actions spec 2.22, the cut rule)", async ({
  request,
}) => {
  test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
  const brotli = (text: string) =>
    brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
  for (const path of ["/", "/listings/l-001", "/looking-for/r-001"]) {
    const html = await (await request.get(path)).text();
    expect(html.match(registrationAnywhere)?.length ?? 0, path).toBeGreaterThanOrEqual(1);
    const cost = brotli(html) - brotli(html.replace(registrationAnywhere, ""));
    console.log(`worker registration in ${path}'s HTML: ${cost} B brotli`);
    expect(cost, path).toBeLessThan(100);
  }
});
```

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 11 more unit tests than after Task 20.

- [ ] **Step 8: Measure, and apply the cut rule**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Write every page's `scriptBrotli` into the ledger's "Task 21" row, and the registration's HTML cost (the largest of the three printed) into the ledger's line under the table. **Every `scriptBrotli` must equal Task 19's to the byte** (the statement is HTML, not a script file), and the cost must be under 100 B. If either fails, stop: this is the cut rule. Report the figures to the controller and change nothing else.

Then run: `pnpm e2e tests/e2e/offline.spec.ts`
Expected: PASS in phone-390, skipped in the other projects.

- [ ] **Step 9: Look at it**

Start the build (`pnpm start --port 3201`) in Chrome at 390 × 844. Open `/`, wait a moment, and check the browser's Application panel: the worker for `/sw.js` is activated, and Cache Storage has `vossie_offline` holding only `/offline`. Go offline (the network panel's throttle) and open `/hub`: Vossie's offline page, with the address still `/hub`. Back online, **Try again** loads the Hub. Then set `WORKER_ON` to `false`, rebuild, and reload twice: the worker has gone and so has the cache; set it back to `true`. Stop the server.

- [ ] **Step 10: Hand over for commit**

Files: `lib/offline.ts`, `lib/offline.test.ts`, `app/sw.js/route.ts`, `app/sw.js/route.test.ts`, `lib/boot-script.ts`, `lib/boot-script.test.ts`, `app/privacy/page.tsx`, `app/privacy/page.test.tsx`, `playwright.config.ts`, `tests/e2e/offline.spec.ts`, `tests/e2e/performance.spec.ts`.
Message: `feat: a small service worker shows the offline page when a page load fails (one cache, vossie_offline; GET page loads only; navigation preload; a kill switch), registered from the boot script after load in production (community actions spec 2.21 and 2.22; accepted by Lama, 2026-10-14). JS unchanged; registration <n> B in the HTML`

---

### Task 22: End-to-end tests for community actions

Every flow in spec 6's end-to-end list, with plan decision 27's split: the device projects check what changes nothing anyone else counts (the contact-details refusal, the composer for a student without a shop, Saved's signed-out Shops tab, the sign-in links and back links, and that the new pages need an account); a new project, `community-writes`, runs after every other one for the writes buyers see (posting, offers, hiding, publishing). Each test makes its own students and requests, found by a word no other test uses; the shop is the sample "Seller, Tech corner", acting only on the test's own request and listings. The offline test is Task 21's.

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/helpers/community.ts`
- Create: `tests/e2e/community-actions.spec.ts`, `tests/e2e/community-writes.spec.ts`
- Modify: `tests/e2e/routes.spec.ts`

- [ ] **Step 1: A project that runs last of all**

In `playwright.config.ts` (F Task 16, G Task 20, Task 21):
1. After G's `const STAFF_WRITES = …;` line, add:

```ts
// The tests that post requests, offer, hide requests or publish listings run after every other test, so the board's,
// the homepage's and browse's counts never move under another test (community actions plan decision 27).
const COMMUNITY_WRITES = /community-writes\.spec\.ts$/;
```

2. On each of the five device projects, replace `testIgnore: [SELLING_WRITES, STAFF_WRITES]` with `testIgnore: [SELLING_WRITES, STAFF_WRITES, COMMUNITY_WRITES]`.
3. After G's `staff-writes` project, add:

```ts
    // After everything else (community actions plan decision 27). Run it alone with --project=community-writes --no-deps.
    {
      name: "community-writes",
      use: phone(390, 844),
      testMatch: COMMUNITY_WRITES,
      dependencies: [...DEVICE_PROJECTS, "selling-writes", "staff-writes"],
    },
```

Run: `pnpm exec playwright test --list --project=community-writes`
Expected: it lists nothing yet, and no error (the file comes in Step 4).

- [ ] **Step 2: Write the helpers**

Create `tests/e2e/helpers/community.ts` (Playwright only runs `*.spec.ts`, so this file is never run on its own):

```ts
import { expect, type Page } from "@playwright/test";
import { button, field, main } from "./messaging";

// Shared by the community actions tests (community actions plan, Task 22). Every test shares one server and one
// sample store, so each posts its own requests, named with a word no other test uses (plan decision 27).

export const REQUEST_DETAILS = "A clip-on lamp for my desk at res, by the weekend please.";

/**
 * Posts a request from /looking-for/new as the signed-in student, in Res & living, and gives back its id. It ends on
 * the request's page.
 */
export async function postRequest(
  page: Page,
  title: string,
  { campus = "Midrand", details = REQUEST_DETAILS }: { campus?: string; details?: string } = {},
): Promise<string> {
  await page.goto("/looking-for/new");
  await field(page, "What you need").fill(title);
  await field(page, "Category").selectOption({ label: "Res & living" });
  await field(page, "Campus").selectOption({ label: campus });
  await field(page, "Details").fill(details);
  await button(page, "Post request").click();
  await expect(page).toHaveURL(/\/looking-for\/r-[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** The offers panel on the request page that's showing. */
export const offersPanel = (page: Page) => main(page).getByRole("region", { name: "Offers" });

/** The status line on the page that's showing (plan decision 7). */
export const statusLine = (page: Page) => main(page).getByRole("status");
```

- [ ] **Step 3: Write the tests that change nothing anyone counts**

Create `tests/e2e/community-actions.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { button, field, main, newBuyer, onlyAt, signInAsSample, signUp } from "./helpers/messaging";
import { uniqueWord } from "./helpers/selling";

const BOTH = ["phone-390", "desktop-1440"];

test.describe("community actions (community actions spec section 6)", () => {
  test("the request form refuses contact details and keeps what was typed (spec 2.4)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/looking-for/new");
    const title = `Lamp ${uniqueWord()}`.slice(0, 60);
    await field(page, "What you need").fill(title);
    await field(page, "Category").selectOption({ label: "Res & living" });
    await field(page, "Details").fill("Call me on 082 123 4567 about a desk lamp.");
    await button(page, "Post request").click();
    const summary = page.getByRole("alert", { name: "There's a problem" });
    await expect(summary).toContainText("Take out the phone number or email. Shops will message you on Vossie.");
    await expect(page).toHaveURL(/\/looking-for\/new$/);
    await expect(field(page, "What you need")).toHaveValue(title);
    await expect(field(page, "Details")).toHaveAttribute("aria-invalid", "true");
    await summary.getByRole("link").first().click();
    await expect(field(page, "Details")).toBeFocused();
  });

  test("a student without a shop is told where offers come from (spec 2.8)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/looking-for/r-002/offer");
    await expect(main(page).getByRole("heading", { level: 1, name: "Offer to help" })).toBeVisible();
    await expect(main(page).getByText("Offers come from shops on Vossie, so the Hub has checked who's offering.")).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Start selling" })).toHaveAttribute("href", "/sell");
    await expect(button(page, "Send offer")).toHaveCount(0);
  });

  test("Saved's Shops tab asks a signed-out visitor to sign in, and comes back to it (spec 2.17)", async ({ page }) => {
    onlyAt(...BOTH);
    await page.goto("/saved?tab=shops");
    const tabs = page.getByRole("navigation", { name: "What's saved" });
    await expect(tabs.getByRole("link", { name: "Shops" })).toHaveAttribute("aria-current", "page");
    await expect(main(page).getByText("Sign in to follow shops. They'll show here.")).toBeVisible();
    await expect(main(page).getByText("Kept with your account.")).toBeVisible();
    await signInAsSample(page, "Student, Midrand", "/saved?tab=shops");
    await expect(main(page).getByText("Sign in to follow shops. They'll show here.")).toHaveCount(0);
    await tabs.getByRole("link", { name: "Listings" }).click();
    await expect(page).toHaveURL(/\/saved$/);
    await expect(main(page).getByText(/^Saved on this device\./)).toBeVisible();
  });

  test("Follow on a storefront goes through sign-in and back when signed out (spec 2.16)", async ({ page }) => {
    onlyAt(...BOTH);
    await page.goto("/sellers/tech-corner");
    const follow = page.getByRole("link", { name: "Follow Tech corner" });
    await expect(follow).toHaveAttribute("href", "/login?next=%2Fsellers%2Ftech-corner");
    await follow.click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsellers%2Ftech-corner$/);
  });

  test("the sign-in page's back link leads back from the new pages (plan decision 22)", async ({ page }) => {
    onlyAt(...BOTH);
    await page.goto("/looking-for/r-001");
    await page.getByRole("link", { name: "Offer to help" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fr-001%2Foffer$/);
    await page.getByRole("link", { name: "Go back" }).click();
    await expect(page).toHaveURL(/\/looking-for\/r-001$/);
  });
});
```

(If the built sign-in page names its back link other than "Go back" for these pages, use its name.)

In `tests/e2e/routes.spec.ts`, add inside `test.describe("routes", …)`:

```ts

  test("Looking For's new pages need an account, and come back after sign-in (community actions spec section 3)", async ({
    page,
  }) => {
    for (const path of [
      "/looking-for/new",
      "/looking-for/r-002/offer",
      "/looking-for/r-002/edit",
      "/looking-for/r-002/delete",
      "/account/requests",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL((url) => `${url.pathname}${url.search}` === `/login?next=${encodeURIComponent(path)}`);
    }
  });

  test("an unknown or hidden request's composer is the 404, signed in or not", async ({ page }) => {
    await page.goto("/looking-for/r-nope/offer");
    await expect(page.getByRole("heading", { level: 1, name: "We couldn't find that page" })).toBeVisible();
  });
```

- [ ] **Step 4: Write the tests that write what buyers see**

Create `tests/e2e/community-writes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { offersPanel, postRequest, statusLine } from "./helpers/community";
import { button, field, main, newBuyer, reply, sellerPage, signUp, statusPill } from "./helpers/messaging";
import { notFoundHeading, publishListing, uniqueWord } from "./helpers/selling";
import { signedInPage } from "./helpers/staff";

// Runs in the community-writes project, after every other test (community actions plan decision 27): new requests
// change the board's and the homepage's counts, and new listings change browse's.

test.describe("community actions that buyers see (community actions spec section 6)", () => {
  test("a student posts a request, finds it on the board and the homepage, edits, closes, reopens and deletes it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signUp(page, newBuyer());
    const title = `Desk lamp ${uniqueWord()}`.slice(0, 60);
    const id = await postRequest(page, title, { campus: "Mbombela" });
    await expect(statusLine(page)).toHaveText("Your request is up.");
    await expect(offersPanel(page)).toContainText("Your request");
    await expect(offersPanel(page)).toContainText("No offers yet");

    await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
    await page.goto("/looking-for");
    await expect(
      page.getByRole("region", { name: "At Mbombela" }).getByRole("heading", { level: 3, name: title }),
    ).toBeVisible();
    await page.goto("/");
    await expect(page.locator("#looking-for").getByRole("link", { name: new RegExp(title) })).toBeVisible();

    await page.goto(`/looking-for/${id}`);
    await main(page).getByRole("link", { name: `Edit ${title}` }).click();
    await expect(field(page, "What you need")).toHaveValue(title);
    const edited = `${title} clip`;
    await field(page, "What you need").fill(edited);
    await button(page, "Save changes").click();
    await expect(page).toHaveURL(new RegExp(`/looking-for/${id}$`));
    await expect(main(page).getByRole("heading", { level: 1 })).toHaveText(edited);
    await expect(statusLine(page)).toHaveText("Your changes are saved.");

    await button(page, `Close ${edited}`).click();
    await expect(statusLine(page)).toHaveText("Request closed.");
    await page.goto("/looking-for");
    await expect(page.getByRole("heading", { level: 3, name: edited })).toHaveCount(0);

    await page.goto("/account/requests");
    await button(page, `Reopen ${edited}`).click();
    await expect(statusLine(page)).toHaveText("Request reopened.");
    await main(page).getByRole("link", { name: `Delete ${edited}` }).click();
    await expect(main(page).getByText(`Delete ${edited}? This can't be undone.`)).toBeVisible();
    await button(page, "Delete request").click();
    await expect(page).toHaveURL(/\/account\/requests$/);
    await expect(statusLine(page)).toHaveText("Request deleted.");
    await page.goto(`/looking-for/${id}`);
    await expect(notFoundHeading(page)).toBeVisible();
  });

  test("posting works with the app's JavaScript blocked (spec 2.2)", async ({ page }) => {
    await signUp(page, newBuyer());
    await page.route(/\/_next\/static\/.+\.js$/, (route) => route.abort());
    const title = `Kettle ${uniqueWord()}`.slice(0, 60);
    await postRequest(page, title);
    await expect(main(page).getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(statusLine(page)).toHaveText("Your request is up.");
  });

  test("a shop offers: the asker is told and unnamed until they reply; the sale is marked and confirmed", async ({
    page,
    browser,
    baseURL,
  }) => {
    const student = newBuyer();
    await signUp(page, student);
    const title = `Calculator ${uniqueWord()}`.slice(0, 60);
    const id = await postRequest(page, title);

    const shop = await sellerPage(browser, baseURL!);
    await shop.goto(`/looking-for/${id}`);
    await offersPanel(shop).getByRole("link", { name: "Offer to help" }).click();
    await expect(shop).toHaveURL(new RegExp(`/looking-for/${id}/offer$`));
    await field(shop, "Your offer").fill("I have a Casio fx-991ZA for R250, at the library.");
    await field(shop, "Point to one of your listings (optional)").selectOption({ label: "Casio fx-991ZA Plus calculator" });
    await button(shop, "Send offer").click();
    await expect(shop).toHaveURL(/\/messages\/conv-[0-9a-f-]{36}$/);
    const conversation = shop.url().split("/").at(-1)!;
    await expect(statusLine(shop)).toHaveText("Sent. The student who asked gets a notification.");
    await expect(main(shop).getByRole("heading", { level: 1 })).toHaveText("Messages with The student who asked");
    await expect(main(shop).getByText("You can write again when they reply.")).toBeVisible();
    await expect(statusPill(shop, "Offered")).toBeVisible();

    await page.goto("/notifications");
    await expect(
      main(page).getByRole("link", { name: new RegExp(`Tech corner offered to help with ${title}`) }),
    ).toBeVisible();
    await page.goto(`/looking-for/${id}`);
    await expect(offersPanel(page).getByText("1 offer", { exact: true })).toBeVisible();
    await offersPanel(page).getByRole("link", { name: /Tech corner/ }).click();
    await expect(page).toHaveURL(new RegExp(`/messages/${conversation}$`));
    await reply(page, "Yes please, Thursday at 13:00?");

    await shop.reload();
    await expect(main(shop).getByRole("heading", { level: 1 })).toHaveText(`Messages with ${student.firstName}`);
    await reply(shop, "See you then.");
    await button(shop, "Mark as completed").click();
    await expect(statusPill(shop, "Done")).toBeVisible();
    await shop.context().close();

    await page.reload();
    await main(page)
      .getByRole("region", { name: "Did the sale happen?" })
      .getByRole("button", { name: "Confirm the sale" })
      .click();
    await expect(statusPill(page, "Confirmed")).toBeVisible();
  });

  test("a reported request is hidden by the Hub: it leaves the board and its page, and the asker is told", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUp(page, newBuyer());
    const title = `Exam answers ${uniqueWord()}`.slice(0, 60);
    const id = await postRequest(page, title);

    const reporting = await browser.newContext({ baseURL });
    const reporter = await reporting.newPage();
    await signUp(reporter, newBuyer());
    await reporter.goto(`/looking-for/${id}`);
    await reporter.getByRole("link", { name: "Report this request" }).click();
    await reporter.getByRole("radio", { name: "Prohibited item" }).check();
    await button(reporter, "Send report").click();
    await expect(reporter).toHaveURL(/\/report\/sent/);
    await reporting.close();

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
    await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
    await main(admin).getByRole("link", { name: `Hide ${title}` }).click();
    await field(admin, "Reason").fill("Selling exam answers isn't allowed.");
    await button(admin, `Hide ${title}`).click();
    await expect(main(admin).getByRole("status")).toHaveText(
      "Hidden. The asker and everyone who reported it have been told.",
    );
    await admin.context().close();

    await page.goto("/looking-for");
    await expect(page.getByRole("heading", { level: 3, name: title })).toHaveCount(0);
    await page.goto(`/looking-for/${id}`);
    await expect(notFoundHeading(page)).toBeVisible();
    await page.goto("/notifications");
    await main(page).getByRole("link", { name: new RegExp(`The Hub hid your request ${title}`) }).click();
    await expect(page).toHaveURL(/\/account\/requests$/);
    const row = main(page).getByRole("listitem").filter({ hasText: title });
    await expect(row).toContainText("Hidden by the Hub");
    await expect(row).toContainText("The Hub's reason: Selling exam answers isn't allowed.");
  });

  test("a student follows a shop, finds it on Saved, hears once about two new listings, and unfollows", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signUp(page, newBuyer());
    await page.goto("/sellers/tech-corner");
    await page.getByRole("button", { name: "Follow Tech corner" }).click();
    await expect(main(page).getByRole("status")).toHaveText("You follow Tech corner.");
    await page.goto("/saved?tab=shops");
    await expect(main(page).getByRole("link", { name: /Tech corner/ })).toHaveAttribute("href", "/sellers/tech-corner");

    const shop = await sellerPage(browser, baseURL!);
    const word = uniqueWord();
    await publishListing(shop, `Desk fan ${word}`.slice(0, 60));
    await publishListing(shop, `Desk lamp ${word}`.slice(0, 60));
    await shop.context().close();

    await page.goto("/notifications");
    const notes = main(page).getByRole("link", { name: /Tech corner listed/ });
    await expect(notes).toHaveCount(1);
    await expect(notes).toContainText("Tech corner listed 2 new things");
    await notes.click();
    await expect(page).toHaveURL(/\/sellers\/tech-corner$/);

    await page.goto("/saved?tab=shops");
    await button(page, "Unfollow Tech corner").click();
    await expect(statusLine(page)).toHaveText("You've unfollowed Tech corner.");
    await expect(main(page).getByText("No shops yet")).toBeVisible();
  });
});
```

- [ ] **Step 5: Run them**

Run, one after another:
- `pnpm e2e tests/e2e/community-actions.spec.ts tests/e2e/routes.spec.ts`
- `pnpm e2e --project=community-writes --no-deps tests/e2e/community-writes.spec.ts`

Expected: PASS. Then run the whole suite once: `pnpm e2e`. Expected: all pass, the `community-writes` project last. Record the counts for Task 24.

If a write test sees the board or homepage late, the action didn't expire its tag: check its `requestsChanged()` before `done()`. If the follow test counts a third new listing, another test published for Tech corner the same day while it ran: no other test in `community-writes` may publish for Tech corner.

- [ ] **Step 6: Hand over for commit**

Files: `playwright.config.ts`, `tests/e2e/helpers/community.ts`, `tests/e2e/community-actions.spec.ts`, `tests/e2e/community-writes.spec.ts`, `tests/e2e/routes.spec.ts`.
Message: `test: end to end for community actions: posting, editing, closing, reopening and deleting a request, the contact-details refusal, an offer through to a confirmed sale, hiding a reported request, following a shop and its new listings, in a project that runs last (community actions spec section 6)`

---

### Task 23: Accessibility, layout shift and size

axe on every new page and state, layout shift on the new and changed pages, and the JS budget for the new pages, signed in (spec sections 4 to 6). Checks that only read run in the device projects; the ones that need a posted request or an offer run in the `community-writes` project, in their own file, so they don't move another test's counts.

**Files:**
- Modify: `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`, `tests/e2e/performance.spec.ts`
- Modify: `playwright.config.ts`
- Create: `tests/e2e/community-checks.spec.ts`

- [ ] **Step 1: axe on the pages that need nothing written**

Add to the end of `tests/e2e/a11y.spec.ts` (it has `seriousIssues(page)` and its own `signInAsSample(page, label)`, D Task 14):

```ts

test("the request form, after a post that went wrong (community actions spec 2.3)", async ({ page }) => {
  await signInAsSample(page);
  await page.goto("/looking-for/new");
  await page.locator("main").getByRole("button", { name: "Post request", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the offer composer for a student without a shop (community actions spec 2.8)", async ({ page }) => {
  await signInAsSample(page);
  await page.goto("/looking-for/r-002/offer");
  await expect(page.getByText("Offers come from shops on Vossie", { exact: false })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("Your requests, with none yet (community actions spec 2.13)", async ({ page }) => {
  await signInAsSample(page);
  await page.goto("/account/requests");
  await expect(page.getByRole("heading", { level: 1, name: "Your requests" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("Saved's Shops tab, signed out and signed in (community actions spec 2.17)", async ({ page }) => {
  await page.goto("/saved?tab=shops");
  await expect(page.getByText("Sign in to follow shops.", { exact: false })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await signInAsSample(page);
  await page.goto("/saved?tab=shops");
  await expect(page.getByText("Kept with your account.")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a storefront's Follow, signed in (community actions spec 2.16)", async ({ page }) => {
  await signInAsSample(page);
  await page.goto("/sellers/tech-corner");
  await expect(page.getByRole("button", { name: /^(Follow|Unfollow) Tech corner$/ })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the offline page (community actions spec 2.20)", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { level: 1, name: "You're offline" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});
```

(The sample student only reads here, so no other test's counts move. If Task 21 was cut, leave out the offline page's test.)

- [ ] **Step 2: Layout shift**

In `tests/e2e/cls.spec.ts`, add these rows at the end of `PAGES` (after the rows D to G added):

```ts
  ["Saved page, Shops tab", "/saved?tab=shops"],
  ["Saved page, Shops tab (signed in)", "/saved?tab=shops", undefined, true],
  ["storefront (signed in)", "/sellers/tech-corner", undefined, true],
  ["request form", "/looking-for/new", undefined, true],
  ["Your requests", "/account/requests", undefined, true],
  ["offer composer (no shop)", "/looking-for/r-002/offer", undefined, true],
  ["offline page", "/offline"],
```

(Leave out the offline page's row if Task 21 was cut: the page is still there, but nothing shows it.) The request page and the storefront, signed out, are rows already; they must still pass with the session's parts streaming in (plan decisions 16 and 19).

- [ ] **Step 3: The new pages' JavaScript, signed in**

In `tests/e2e/performance.spec.ts`:
1. Add this row at the end of `PAGES`: `["Saved page, Shops tab", "/saved?tab=shops"],`.
2. Add at the end of the file (if D, E, F or G already made a helper for the signed-in measure, use it with these paths instead of repeating the steps):

```ts

// Community actions' new pages carry only the shell (community actions spec 5), measured signed in as the sample
// student. The offer composer's form needs a posted request; tests/e2e/community-checks.spec.ts measures it.
const SIGNED_IN_PAGES: ReadonlyArray<[name: string, path: string]> = [
  ["request form", "/looking-for/new"],
  ["Your requests", "/account/requests"],
  ["offer composer (no shop)", "/looking-for/r-002/offer"],
  ["Saved page, Shops tab (signed in)", "/saved?tab=shops"],
];

for (const [name, path] of SIGNED_IN_PAGES) {
  test(`a first visit to the ${name}, signed in, stays inside the JavaScript budget`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
    // Sign in in a separate browser context, and copy only the session cookie across, so nothing here is cached yet.
    const other = await browser.newContext();
    const signingIn = await other.newPage();
    await signingIn.goto(`${baseURL}/login`);
    await signingIn.locator("main").getByRole("button", { name: "Student, Midrand", exact: true }).click();
    await signingIn.waitForURL(/\/account$/);
    await context.addCookies((await other.cookies()).filter((cookie) => cookie.name === "vossie_session"));
    await other.close();

    let scriptBrotli = 0;
    const pending: Array<Promise<void>> = [];
    page.on("response", (response) => {
      if (response.request().resourceType() !== "script") return;
      pending.push(
        response.body().then((body) => {
          scriptBrotli += brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
        }),
      );
    });
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("main h1").filter({ visible: true })).toBeVisible();
    await Promise.all(pending);
    console.log(`${name} (signed in): ${JSON.stringify({ scriptBrotli })}`);
    expect(scriptBrotli, "JavaScript, brotli as a host serves it").toBeLessThanOrEqual(150 * 1024);
  });
}
```

- [ ] **Step 4: The checks that need a posted request**

In `playwright.config.ts`, change Task 22's `const COMMUNITY_WRITES = /community-writes\.spec\.ts$/;` to:

```ts
const COMMUNITY_WRITES = /community-(writes|checks)\.spec\.ts$/;
```

and add "and their checks" to its comment.

Create `tests/e2e/community-checks.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { brotliCompressSync, constants } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { offersPanel, postRequest } from "./helpers/community";
import { button, field, main, newBuyer, sellerPage, signUp } from "./helpers/messaging";
import { uniqueWord } from "./helpers/selling";

// Runs in the community-writes project (community actions plan decision 27): axe and the JS budget on the pages that
// need a posted request or an offer.

test.use({ reducedMotion: "reduce" });

async function seriousIssues(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target.join(" ")) }));
}

test("the asker's pages: the request with its panel, the edit form, Delete request and Your requests", async ({ page }) => {
  await signUp(page, newBuyer());
  const title = `Axe lamp ${uniqueWord()}`.slice(0, 60);
  const id = await postRequest(page, title);
  await expect(offersPanel(page)).toContainText("Your request");
  expect(await seriousIssues(page)).toEqual([]);
  await page.goto(`/looking-for/${id}/edit`);
  await expect(field(page, "What you need")).toHaveValue(title);
  expect(await seriousIssues(page)).toEqual([]);
  await page.goto(`/looking-for/${id}/delete`);
  await expect(button(page, "Delete request")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await page.goto("/account/requests");
  await expect(main(page).getByRole("link", { name: title })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the shop's side: the offer composer, the scam check, and the thread waiting for a reply", async ({
  page,
  browser,
  baseURL,
}) => {
  await signUp(page, newBuyer());
  const id = await postRequest(page, `Axe calculator ${uniqueWord()}`.slice(0, 60));
  const shop = await sellerPage(browser, baseURL!);

  let scriptBrotli = 0;
  const pending: Array<Promise<void>> = [];
  shop.on("response", (response) => {
    if (response.request().resourceType() !== "script") return;
    pending.push(
      response.body().then((body) => {
        scriptBrotli += brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
      }),
    );
  });
  await shop.goto(`/looking-for/${id}/offer`, { waitUntil: "networkidle" });
  await Promise.all(pending);
  // Not a first visit (signing in loaded the shell), so this is the composer's own share; it must add no client code.
  console.log(`offer composer (signed in, after sign-in): ${JSON.stringify({ scriptBrotli })}`);
  expect(await seriousIssues(shop)).toEqual([]);

  await field(shop, "Your offer").fill("Pay a deposit first and I'll bring it.");
  await button(shop, "Send offer").click();
  await expect(shop.getByRole("alert", { name: "Check this before you send" })).toBeVisible();
  expect(await seriousIssues(shop)).toEqual([]);

  await button(shop, "Send anyway").click();
  await expect(main(shop).getByText("You can write again when they reply.")).toBeVisible();
  expect(await seriousIssues(shop)).toEqual([]);
  await shop.goto("/messages?tab=selling");
  expect(await seriousIssues(shop)).toEqual([]);
  await shop.context().close();
});
```

- [ ] **Step 5: Run them**

Run, one after another:
- `pnpm e2e tests/e2e/a11y.spec.ts tests/e2e/cls.spec.ts tests/e2e/performance.spec.ts`
- `pnpm e2e --project=community-writes --no-deps tests/e2e/community-checks.spec.ts`

Expected: PASS: no serious or critical axe issues; every layout shift 0.05 or less at 390 and 1440; every page inside the budget. Write the new pages' signed-in figures into the ledger's line under the table. Every existing page's `scriptBrotli` must still equal the ledger's last row (spec 5). If an axe check fails, fix the page (contrast, names, ids), not the test. If the storefront's or Saved's shift fails, check that `.seller-follow` keeps its 44px with the session's part and that `SavedSkeleton`'s tabs and note match the real ones' heights.

- [ ] **Step 6: Hand over for commit**

Files: `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`, `tests/e2e/performance.spec.ts`, `playwright.config.ts`, `tests/e2e/community-checks.spec.ts`.
Message: `test: axe, layout shift and the JS budget for community actions' pages and states (community actions spec sections 4 to 6). JS: request form <n> B, Your requests <n> B, offer composer <n> B, Saved Shops <n> B`

---

### Task 24: Review screenshots, docs and final checks

**Files:**
- Modify: `tests/e2e/screenshots.spec.ts`
- Create: `docs/progress/community-actions/*.png`
- Modify: `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, the spec (`docs/superpowers/specs/2026-10-14-community-actions-design.md`)
- Modify: this plan (the ledger and a "Changes made during the build" section)

- [ ] **Step 1: Check the docs are free to edit**

Run `git status --short` on its own. Expected: only ` M .claude/launch.json` and nothing of this stage's left uncommitted. If another stage's work has the docs open (changed and uncommitted), stop and ask the controller before editing them. Read each doc's current text before editing it, and edit by meaning where this step's quoted lines have moved.

- [ ] **Step 2: Add the review screenshots**

In `tests/e2e/screenshots.spec.ts`, add below the `@playwright/test` import (skip any the file already imports):

```ts
import { postRequest } from "./helpers/community";
import { button, field, main, newBuyer, sellerPage, signUp } from "./helpers/messaging";
```

and add to the end of the file:

```ts

test("community actions review screenshots", async ({ page, browser, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/community-actions/${project}-${name}.png`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page, newBuyer());

  await page.goto("/looking-for/new");
  await button(page, "Post request").click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  await page.screenshot({ path: file("01-request-form-errors"), fullPage: true });

  const id = await postRequest(page, `Desk lamp for res, ${Date.now().toString(36)}`);
  await page.screenshot({ path: file("02-request-asker"), fullPage: true });

  const shop = await sellerPage(browser, baseURL!);
  await shop.setViewportSize(page.viewportSize()!);
  await shop.emulateMedia({ reducedMotion: "reduce" });
  await shop.goto(`/looking-for/${id}/offer`);
  await shop.screenshot({ path: file("03-offer-composer"), fullPage: true });
  await field(shop, "Your offer").fill("I have a clip-on lamp, R120. I can bring it to the library at lunch.");
  await button(shop, "Send offer").click();
  await expect(main(shop).getByText("You can write again when they reply.")).toBeVisible();
  await shop.screenshot({ path: file("04-offer-thread-shop"), fullPage: true });
  await shop.context().close();

  await page.reload();
  await page.screenshot({ path: file("05-request-with-offer"), fullPage: true });
  await page.goto("/account/requests");
  await page.screenshot({ path: file("06-your-requests"), fullPage: true });
  await page.goto(`/looking-for/${id}/delete`);
  await page.screenshot({ path: file("07-delete-request"), fullPage: true });

  await page.goto("/sellers/tech-corner");
  await page.getByRole("button", { name: "Follow Tech corner" }).click();
  await expect(main(page).getByRole("status")).toHaveText("You follow Tech corner.");
  await page.screenshot({ path: file("08-storefront-following") });
  await page.goto("/saved?tab=shops");
  await page.screenshot({ path: file("09-saved-shops"), fullPage: true });
  await page.goto("/looking-for/r-002/offer");
  await page.screenshot({ path: file("10-offer-no-shop"), fullPage: true });
  await page.goto("/offline");
  await page.screenshot({ path: file("11-offline") });
});
```

(Leave out the last two lines if Task 21 was cut.)

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "community actions review screenshots"`
Expected: 22 PNGs in `docs/progress/community-actions/` (20 if the offline page was cut). Open a few and check they show what their names say.

- [ ] **Step 3: Bring the spec in line with the build**

In `docs/superpowers/specs/2026-10-14-community-actions-design.md`, set the status to "Built (2026-10-<day>), in sample mode." and add a section at the end, "## 8. Changes on plan review and build", listing where the plan and the build refined the spec (they win over the decisions above):
- ids per page: `request-new-…` and `request-<id>-…` on the request form, `offer-<id>-…` on the composer (plan decision 2), instead of one `request-form-summary` and `offer-summary`;
- the contact-details patterns and the ISBN rule (plan decision 3), and "a day" meaning the last 24 hours (plan decision 4);
- sample requests can't take offers, and the composer says so (plan decision 12);
- the offer thread's words: "Your request:" and "Request:", "Sent. The student who asked gets a notification." (plan decision 8);
- the new-listing notification only for an open shop's first publish (plan decision 15);
- Follow's own row in the band, nothing for the owner (plan decision 16), and Saved's skeleton covering the tabs (plan decision 17);
- the registration statement as built, with its measured cost (plan decision 25), or, if Task 21 was cut, that the worker was cut by the rule and `/offline` waits on the checklist;
- anything else from this plan's "Changes made during the build".

- [ ] **Step 4: Log the decisions**

In `docs/reference/LANDING-DECISIONS.md`, add a row after the last, numbered one more than it, in the log's style:

```markdown
| N | 2026-10-<day> | Community actions plan decisions that change the spec (community actions spec decisions 2, 4, 9, 13, 16 to 19 and 22) | **Form ids are per page; contact details are refused by pattern, ISBNs pass; sample requests can't take offers; an offer thread is named by its request and the shop waits for the asker's reply; new-listing notifications come only from an open shop's first publish; Follow has its own row in the band; the service worker's registration (accepted by Lama, 2026-10-14) costs <n> B in a page's HTML** | Plan decisions 2, 3, 8, 12, 15, 16 and 25 in `2026-10-14-community-actions.md`. The spec now says so. No page's JavaScript changed. G decision 5's "a report about a request can only be dismissed" is replaced by Hide the request. <Lama, at plan review, or: Claude, under Lama's standing goal> |
```

Name in it any other plan decision Lama changed or kept on purpose, any JS figure Lama accepted under the stop rule, and, if Task 21 was cut, say so and why.

- [ ] **Step 5: Update the go-live checklist**

In `docs/reference/GO-LIVE.md` (edit by meaning; earlier stages changed it):
- Section 1: "Looking For board" and "A single Looking For request": **Built** (posting, the asker's panel and offers: stage H, in sample mode). "Offline page": **Built** (a self-contained page and a navigation-only worker, registered from the boot script), or, if Task 21 was cut, **Page built; the worker was cut by the JS rule** and the item stays open.
- Section 2: "Saved listings, and followed sellers once accounts exist": **Built** (Saved's Shops tab). "Post, edit, close, reopen and delete a Looking For request" and "Offer to help with a request (shops only)": **Built (sample mode)**. Add a row: `| Your requests | /account/requests | Built (sample mode) |`.
- Section 5 (staff tools): add to the reports row "and Hide the request (stage H)".
- Section 6, Backend: keep the scheduled-jobs line's "closing old Looking For requests (stage H leaves them open)". Add `- [ ] Supabase behind \`lib/data/requests.ts\`, \`offers.ts\` and \`follows.ts\`; the \`requests\` cache tag stays.`
- Section 6, Content: keep "Real Looking For requests… with their `seedOffers`".
- Section 6, Production: keep "The offline worker's kill switch… tried on a real phone before launch" (if Task 21 was cut, change it to `- [ ] The offline page's worker (cut in stage H by the JS rule): find a way to register it that costs less, or drop /offline.`).
- Section 7: in "Who can sell?", keep "who can make offers on Looking For requests (stage H: approved shops only)".
- Section 8: mark stage H done in sample mode, in the style of the earlier stages.
- The "Totals" line: add the screens this stage built (the request form and its edit, Delete request, Your requests, the offer composer, Saved's Shops tab, the offline page).

- [ ] **Step 6: Update CLAUDE.md**

In `CLAUDE.md`:
- Under "Code rules", after the line that starts `- Who's signed in comes only from`, add:
  `- Looking For requests live in the sample store and are read through \`lib/data/requests.ts\`, tagged \`requests\`: every write calls \`requestsChanged()\` before \`done()\`. An offer is an E conversation with \`requestId\` set; F's counting leaves offer threads out of enquiries.`
- Under "Code rules", after the boot-script or motion lines (wherever the build mentions the boot script; otherwise at the end of the list), add:
  `- The inline boot script registers \`/sw.js\` after load in production builds. The worker (\`lib/offline.ts\`) keeps only the offline page in \`vossie_offline\` and answers only failed GET page loads; change \`WORKER_VERSION\` whenever it or the offline page changes, and \`WORKER_ON = false\` is its kill switch. End-to-end tests block service workers, except \`tests/e2e/offline.spec.ts\`.` (Leave this out if Task 21 was cut.)
- Under "Privacy (POPIA)", after the line about Looking For requests never naming the asker, add: `- A shop sees only how many follow it, never who. Deleting an account removes its requests, its follows and its shop's followers.`

- [ ] **Step 7: Update the progress log**

In `docs/PROGRESS.md`, add a section before "Next", in the style of the earlier ones:

```markdown
## 2026-10-<day>: Community actions built, in sample mode (stage H)
- **Looking For requests in the store** (`lib/data/requests.ts`): the board, the homepage, request pages and the sitemap read them, tagged `requests`; the 16 samples are the seed. A signed-in student posts (`/looking-for/new`: no contact details, 5 open and 5 a day), edits, closes, reopens and deletes (`/looking-for/[id]/edit`, `/delete`) their requests, and sees them in **Your requests** (`/account/requests`). Every form works without the app's JavaScript.
- **Offers** (`/looking-for/[id]/offer`): approved shops only; an offer is an E conversation, Offered until the asker replies, the asker unnamed to the shop until then, one per shop per request, 20 a shop a day, out of the reply rate. The asker sees each offer on their request's page and gets a notification. The Hub can hide a reported request from its queue.
- **Following shops:** Follow in the storefront's band, Saved's Shops tab, the dashboard's follower count (never who), and one notification a day when a followed shop lists something new.
- **Offline:** `/offline`, a self-contained page, and a small service worker that shows it when a page load fails, registered from the boot script (accepted by Lama, 2026-10-14; <n> B in a page's HTML). <Or: the worker was cut by the JS rule; `/offline` waits on the checklist.>
- **Privacy:** the policy names `vossie_offline` and says what requests and follows keep; deleting an account removes them; the data export gains them.
- **Where the build differed from the plan** is in the plan's "Changes made during the build".
- **Plan decisions Lama may want to revisit:** <list any that came up in review, or "none">.
- **Checks:**
  - lint and types are clean;
  - <n> unit tests pass;
  - end to end, <n> pass, <n> are skipped by design and none fail (the `community-writes` project last);
  - axe finds no serious or critical issues.
- **First visit at 390px, JS brotli:** homepage <n> B, browse <n> B, listing <n> B, storefront <n> B, Saved <n> B, board <n> B, request <n> B, all unchanged (stop line <n> B, limit 153,600 B). New pages, signed in: request form <n> B, Your requests <n> B, offer composer <n> B, Saved's Shops tab <n> B.
- **Layout shift** (fonts held back, at 390 and 1440px): <a table of the new and changed pages>.
- Review screenshots: `docs/progress/community-actions/`.
```

Fill in the numbers from your runs. Then make "Next" say:

```markdown
## Next
- Lama reviews the screenshots in `docs/progress/community-actions/`. To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "community actions review screenshots"`.
- Then the go-live checklist's backend work (`docs/reference/GO-LIVE.md`, section 6): Supabase and an email service in place of the sample store.
```

- [ ] **Step 8: Fill in this plan**

Fill in the JS ledger (the worker's line says "accepted by Lama, 2026-10-14" and its measured cost, or that it was cut), and add a "Changes made during the build" section after it, listing every place the build differed from the tasks as written, with the commit that made each change.

- [ ] **Step 9: Final checks**

Run, one after another: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`.
Expected: all pass. Record the unit and e2e counts in `docs/PROGRESS.md`.

Then run `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` once more and write the "Final (Task 24)" row of the ledger.

- [ ] **Step 10: Hand over for commit**

Files: `tests/e2e/screenshots.spec.ts`, `docs/progress/community-actions/`, `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/superpowers/specs/2026-10-14-community-actions-design.md`, this plan.
Message: `docs: community actions review screenshots, progress, checklist, decisions, CLAUDE.md and the spec brought in line (stage H). JS: / <n> B, browse <n> B, listing <n> B, storefront <n> B, Saved <n> B, request <n> B, unchanged`
