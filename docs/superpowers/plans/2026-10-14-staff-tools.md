# Vossie Staff Tools (Sample Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build stage G as the spec `docs/superpowers/specs/2026-10-14-staff-tools-design.md` describes: an admin console that approves and declines shops, grants Verified, pauses and resumes shops, handles reports (dismiss, hide the listing, pause the account), pins Featured sellers, manages pickup points and shows an audit log of every staff action; the Hub's post editor with a server-rendered preview and its office-hours queue; real RSVP and slot requests for signed-in students; a mentor dashboard with flags, private notes, check-ins and a CSV download; trust badges and Featured worked out from the sample store. Every staff page answers 404 to everyone without the role, every staff action is a Server Action that writes an audit entry, and staff pages add no client code. Tested at five screen sizes and within the JS budget.

**Architecture:**
- **Eight new tables in the sample store** (`auditLog`, `featuredPins`, `featuredDraws`, `pickupPoints`, `mentorNotes`, `hubPosts`, `hubRsvps`, `hubBookings`), as D's "Store design" planned. Pickup points and Hub posts move from the fixtures into the store, seeded from them, so staff can change them. A few optional fields join D's, E's and F's rows (a shop's decline, a Hub pause and its mentor on the seller profile; a hidden listing; a report's outcome), so nothing D, E or F wrote has to change shape.
- **One gate for every staff page and action:** `requireStaff(area, nextPath)` (`lib/staff/access.ts`) sends a signed-out visitor to sign in and calls `notFound()` for anyone without the role. Every staff page renders inside `<Suspense>` behind a wordless skeleton, so its static shell says nothing about it, and its tab title comes from `generateMetadata`, which says "Page not found" to everyone but staff.
- **Plain forms, Server Actions, redirects** (D's, E's and F's pattern). The admin, Hub and mentor actions live in `lib/staff/*-actions.ts`; each checks the role, validates on the server, changes the store through `lib/data`, writes one audit entry (`lib/data/audit.ts`, which has no update function), notifies whoever the spec says, expires the cache tags buyers' pages read, and ends with F's `done()` (`refresh()`, then a `replace` redirect). Destructive actions go through a confirm page.
- **Calculations on demand, no scheduler.** Trust badges are worked out from E's conversations by F's counting (`lib/data/badges.ts`) when an admin opens Overview and after each reply and confirmed sale. Featured honours pins, then draws from verified, open shops with something listed, records each campus's row for the day, and keeps a week's break between draws of the same seller (`lib/data/featured.ts`).

**Tech Stack:** As stage F leaves it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5.9;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5 with Testing Library and jsdom 30;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-14-staff-tools-design.md`. "Spec 2.5" in this plan means that spec's section 2, decision 5; "spec 3" means its section 3. All nine decisions are settled, including decision 8's week-long Featured break.
- **The stages this builds on, planned and partly built when this plan was written:** stage D, `docs/superpowers/plans/2026-10-14-accounts.md` ("D's plan", "D Task 4", "D decision 3") and its spec; stage E, `docs/superpowers/plans/2026-10-14-messaging.md` ("E's plan", "E decision 2") and its spec, section 9 included; stage F, `docs/superpowers/plans/2026-10-14-selling.md` ("F's plan", "F decision 2") and its spec, section 8 included.
- **Part B (built):** Hub posts (`HubPost`, `data/fixtures/hub.ts`, `lib/hub.ts`, `components/hub/*`, `lib/markdown.ts`, which caps bodies at 8,000 characters). **Part C (built):** the trust page (`app/trust/page.tsx`), whose badge rules stage G calculates and whose Verified wording this plan fixes (selling spec 8.10). **The homepage's Featured today:** `components/home/FeaturedToday.tsx` and `lib/featured.ts`'s `drawFeatured`.
- **The old demo:** `docs/reference/FUNCTION-MAP.md`, sections J (Hub Growth corner), K (mentor tools), L (admin), 2 (roles) and 6 (badge rules, Featured, mentor flags).
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`, rows 54 to 65 and whatever D, E and F add.

---

## Before you start

**This plan starts after stage F.** When it was written (2026-10-14), stage D's build was under way (its Tasks 1 to 9 committed, up to `6e4bb91`, and Task 10 in the working tree), and stages E (`3b0a51a`) and F (`6a2fc9b`) had committed plans and no code. Start only once F's Task 18 (its docs) is committed. Then work through "Recheck before starting" below before Task 1: this plan is written against D's, E's and F's planned file names and APIs, and the builds may have changed some.

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. `.claude/launch.json` has a change made outside this work: never stage it.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed. This is Lama's standing preference.
3. **Files this plan removes or moves:** none. No task runs `rm`. If something looks unused, leave it and list it in the hand-over for Lama.
4. **No new environment variables, cookies or browser-storage keys.** Staff tools use D's session and form state, so the privacy page's `vossie_…` guard has nothing new to name. The privacy page's words about staff notes and the staff log do change (Task 19).
5. **Sample wording.** The notices, the notification sentences, the confirm pages' lines, the empty states, the flags' explanations, Naledi's sample notes and Thandi's sample slot request are for Lama to change. Plan decision 22 lists where they live.
6. **A Playwright project that runs last** (Task 20): `staff-writes`, after the five device projects and F's `selling-writes`, for the staff actions buyers can see (plan decision 21), as F's `selling-writes` does.
7. **Two end-to-end checks of Tech corner's "Responsive" badge are loosened** (Task 20): from this stage the sample seller's badge is worked out from its conversations, which other tests add to (plan decision 8).

No installs are needed.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time. Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` anything.
- Never kill an install or build that is still running.
- Port 3100 is Lama's dev server. Don't touch it. The e2e tests use 3200; the "looking at it" checks use 3201.
- Before you edit a shared file (`app/globals.css`, `lib/types.ts`, `lib/data/rows.ts`, `lib/data/store.ts`, `lib/data/index.ts`, `lib/data/accounts.ts`, `app/privacy/page.tsx`, `app/trust/page.tsx`, `playwright.config.ts`, `tests/e2e/*.spec.ts`, `docs/*`, and every file stages D, E and F created), read its current text and edit by the exact lines that are there now. Never paste back a whole list or file from an older copy. Where this plan quotes a line from D's, E's or F's plan and the built file says it differently, edit by meaning and note it in the hand-over.

## Recheck before starting

Stages D, E and F weren't built when this plan was written. Before Task 1, check each item against the code, one command or file at a time, and write what you find in the ledger's "Start" row or a message to the controller. If something differs in a way a task's quoted code depends on, stop and report rather than guess.

1. **Git.** `git log --oneline -5` shows F's docs commit (F Task 18) at the top; `git status --short` shows only ` M .claude/launch.json`.
2. **The stop line and the figures.** Read `docs/PROGRESS.md` and the decisions log for the newest accepted JS figures and stop line (152,305 B when this plan was written; the listing page was 151,752 B after D's Task 9). Use F's final figures and the newest stop line in the ledger. Plan for little room on the listing page whatever the figures say: decision 63's saving is a threshold effect that new code can undo.
3. **The store** (D Task 1, E Task 1, F Task 1). `lib/data/store.ts`: `SampleStore` with D's eight tables, E's `conversations`, `messages`, `reports`, `notifications`, and F's `sellers`, `listings`, `photos`, `onboardingDrafts`; `STORE_VERSION` (3 after F); `sampleStore()`, `resetSampleStore()` and a private `seedStore()` whose returned object lists the tables in that order. `lib/data/store.test.ts` has the "is seeded with …, and nothing else" test (F renamed it "…the sample conversations and the sample listings, and nothing else") and E's `resetAndRead()` helper. Task 1 adds one to `STORE_VERSION` and eight tables.
4. **The rows** (D, E and F Task 1). `lib/data/rows.ts` imports its types from `@/lib/types` in one `import type { … }` block and has `SellerProfileRow` (`accountId`, `status`, `sellerSlug`, `appliedAt`), `FormStateRow`, E's `ConversationRow`, `ReportRow` (`id`, `reporterId`, `targetKind`, `targetId`, `targetTitle`, `reason`, `detail`, `status`, `createdAt`) and `NotificationRow`, and F's `SellerRow` (with `ownerId`, `verified`, `badge`), `ListingRow` (with `state`, `title`, `sellerSlug`) and `PhotoRow`.
5. **Types** (D, E and F Task 1). `lib/types.ts` has `StaffRole` (`"mentor" | "admin"`), `SellerStatus` (`"pending" | "approved" | "paused"`), `Account` (`id`, `firstName`, `roles`, `seller`, `createdAt`), E's `NotificationKind` (`"message" | "sale-to-confirm" | "report-handled" | "shop-approved"`), `ReportReason` and `ReportTarget`, F's `EnquiryCounts` (`enquiries`, `due`, `repliedInTime`, `salesConfirmed`) and `ShopStats` (`week`, `record`), and part B's `HubPost`, `HubPostKind` and `PickupPoint` (`id`, `campusSlug`, `name`).
6. **The sample accounts** (D Task 1). `data/fixtures/accounts.ts`: `acc-student` (Thandi, Midrand), `acc-seller` (Sipho, approved, `tech-corner`; its seller profile `{ accountId: "acc-seller", status: "approved", sellerSlug: "tech-corner", appliedAt: "2026-03-02T09:40:00.000Z" }`), `acc-pending` (Lerato, pending, `crochet-corner` in F's `sampleSellerRows`), `acc-mentor` (Naledi, Midrand, `roles: ["mentor"]`) and `acc-admin` (Pieter, Pretoria, `roles: ["admin"]`); the sign-in buttons "Student, Midrand", "Seller, Tech corner", "Seller waiting for approval", "Mentor" and "Admin".
7. **Session and form state** (D Tasks 4 and 6). `lib/auth/session.ts` exports `getViewer()`, `getSessionKey()` and `requireAccount(nextPath)`; `lib/auth/form-state.ts` exports `readFormState(form)` and `writeFormState(form, state, now)`; `lib/data/form-states.ts` exports `clearFormState(sessionKey, form)`; `lib/auth/messages.ts` exports the `FormError` type and `errorFor`; `components/forms/ErrorSummary.tsx` and `FieldError.tsx` (with `describedBy`) and `CampusSelect.tsx` exist; the CSS classes `.form-stack`, `.form-field`, `.form-label`, `.form-hint`, `.form-input`, `.form-select`, `.form-check`, `.form-checkbox`, `.form-error`, `.form-summary`, `.form-notice`, `.form-submit`, `.link-button` and `.btn-danger` exist.
8. **The test helpers** (D Task 4, E Task 6, F Task 4). `tests/helpers/next-request.ts` exports `FakeRequest` (with E's `refreshed` and F's `updatedTags`), `resetRequest`, `nextHeaders`, `nextNavigation`, `nextServer`, `nextCache` (with `refresh`, `updateTag`, `cacheTag`, `cacheLife`), `redirectOf` and `redirectSignalOf`. `vitest.setup.ts` mocks `next/cache` with no-ops (F Task 4). `tests/helpers/fakes.ts` has F's `makeListingRow`.
9. **Accounts data** (D Task 3, E Task 5, F Task 5). `lib/data/accounts.ts`: `deleteAccountData(accountId)` runs E's `forgetAccountInMessaging` and `deleteReportsBy`, then F's `forgetShopOf`; `exportAccountData(accountId, now)` and the `AccountExport` type end with F's `shop` and `listings`; `lib/data/accounts.test.ts` has the export test for `acc-seller` that checks `Object.keys(data!)` (E's list, with F's two keys). Task 8 changes all three.
10. **Messaging** (E Tasks 2 to 6). `lib/messaging/rules.ts` exports `cleanText`, `characterCount`, `keepTyped`, `DAY_MS` and `reasonLabel`; `lib/messaging/paths.ts` exports `isId` and `backPathFor` (with its `ACCOUNT_ONLY` list); `lib/data/notifications.ts` exports `notify({ accountId, kind, subjectId, text, href, now })`; `lib/data/messages.ts` exports `sendMessage` (returning `"sent" | "not-found" | "closed"`) and `confirmSale`; `lib/messaging/actions.ts` has `sendReply` (with `const result = await sendMessage(…)`) and the private `changeSale(formData, change)` used by `confirmTheSale`; `components/messages/NotificationsView.tsx` has `KindIcon` with a `switch` over the four kinds. Tasks 15, 17 and 18 edit `paths.ts`, `actions.ts` and `NotificationsView.tsx`.
11. **Selling's data** (F Tasks 4 and 5). `lib/data/tags.ts` exports `LISTINGS_TAG`, `SELLERS_TAG`, `tagListings`, `tagSellers`, `listingsChanged` and `sellersChanged`; `lib/data/catalog.ts` exports `shopStatus`, `toSeller`, `toListing`, `liveSellerRows`, `storefrontRow`, `listedListings` and `publicListing`; `lib/data/shops.ts` exports `getShopOf`, `setShopPaused(accountId, paused)` and has the private `spotName`; `lib/data/shop-stats.ts` exports `shopStats(sellerSlug, now)` and has the private `counts(rows, enquiriesSince, salesSince, now)`; `lib/data/photos.ts` exports `storePhotos`, `usePhotos`, `deletePhotosUsedBy`, `photoIdOf` and the type `Upload`. Tasks 4 to 6 edit `tags.ts`, `catalog.ts`, `shops.ts` and `shop-stats.ts`.
12. **Selling's rules and actions** (F Tasks 3 and 7). `lib/selling/rules.ts` exports `cleanLine` and `nameKey`; `lib/selling/badges.ts` has the private `RULES` and exports `replyRate` and `badgeProgress`; `lib/selling/action-helpers.ts` exports `field`, `fileList` and `done(path)`; `lib/selling/uploads.ts` exports `readUploads(files, room)`; `lib/selling/shop-actions.ts` ("use server") exports `pauseShop` and `resumeShop`. Tasks 3 and 18 edit `badges.ts` and `shop-actions.ts`.
13. **Selling's pages** (F Tasks 9 and 11). `components/sell/SellHome.tsx` returns `<ShopWaiting shopName sentAt />` when `own.status === "pending"` and `<Dashboard shop paused stats badgeLine notice />` otherwise; `components/sell/Dashboard.tsx` has the `sell-status` line and the `sell-pause` form; `components/sell/MyListingsView.tsx` has `ListingSummary({ row })`. Task 18 edits all three.
14. **The data layer** (F Task 4). `lib/data/index.ts`: `getFeatured({ campus, day })` is `"use cache"` with `tagSellers()` and calls `drawFeatured(liveSellerRows().map(toSeller), campus, day)`; `getPickupPoints()` returns the fixture's points; `getListingDetail(id)` finds its pickup point in the fixture; the Hub's `getHubEvents`, `getHubPosts`, `getHubPost` and `getHubPostIds` read `hubPosts` from `data/fixtures/hub.ts`; `getVerifiedSellers()` reads `liveSellerRows()`. Tasks 6 and 7 change these.
15. **The account page** (D Task 10, E Task 13, F Task 14). `components/account/AccountView.tsx` has the `account-rows` nav with Saved, E's Messages and Notifications, F's Selling row and Privacy settings. Task 18 adds the staff rows.
16. **The Hub's pages** (part B). `components/hub/PostAction.tsx` renders RSVP and Request a slot as sign-in links after `await connection()`; `components/hub/PostAction.test.tsx` checks `/login?next=%2Fhub%2Fh-002`; `tests/e2e/community.spec.ts` has "upcoming office hours offer Request a slot through the sign-in page" and counts the Hub's 9 Verified sellers and 6 tips. Task 15 changes the first three.
17. **The privacy policy** (part C, D Task 12, E Task 14, F Task 15). `app/privacy/page.tsx`'s account section has the bullets starting `<strong>If you are in the Hub&apos;s programme: mentors&apos; notes.</strong>` and `<strong>A log of what Hub staff do.</strong>`, and the `privacy-keep` list says what deleting an account removes. Task 19 edits them by meaning.
18. **The trust page** (part C). `app/trust/page.tsx`'s `trust-verified` section says "means the Eduvos Incubation Hub has looked at a seller and approved their shop"; `trust-badges` says "the badges you see on sellers today are samples"; `trust-featured` says "Once accounts are live, each campus gets its own draw every day". Task 19 changes all three and `app/trust/page.test.tsx`.
19. **Robots.** `app/robots.ts`'s `DISALLOWED` names no staff page and `app/robots.test.ts` has "doesn't advertise staff pages". Task 15 adds `/hub/*/book` only.
20. **End-to-end** (E Task 15, F Task 16). `tests/e2e/helpers/messaging.ts` exports `project`, `onlyAt`, `main`, `field`, `button`, `signUpHere`, `signUp` and `signInAsSample(page, label, next)`; `tests/e2e/helpers/selling.ts` exports `uniqueWord`, `newSeller`, `fillListing`, `publishListing`, `cardsFor` and `notFoundHeading`; `playwright.config.ts` has `SELLING_WRITES`, `DEVICE_PROJECTS`, `testIgnore: SELLING_WRITES` on the five device projects and the `selling-writes` project; `tests/e2e/shopping.spec.ts` checks `.seller-stamps li` for Tech corner as `["Midrand", "Tech", "Responsive"]`; `tests/e2e/selling.spec.ts`'s dashboard test checks the "Your badge" region contains "Responsive". Task 20 edits all of these by meaning.
21. **Part B's data.** `data/fixtures/hub.ts` has 18 posts (`h-001` to `h-018`): office hours `h-002` and `h-007` at Midrand, `h-004` at Bedfordview, `h-012` (past) at Midrand. `lib/hub.ts` exports `orderHubPosts`, `toHubEvent`, `hasPassed` and `postDate`. `components/hub/Markdown.tsx` renders `source` on the server.
22. **Selling's own listings and D's deletion action** (F Tasks 5 and 7). `lib/data/own-listings.ts`'s `saveOwnListing(save)` builds a new `ListingRow` from `save.fields` and replaces the stored one, so a field it doesn't name is lost on every save; `lib/auth/actions.ts`'s `deleteAccount` has F's `if (account.seller) sellersChanged();` straight after `await deleteAccountData(account.id);`. Tasks 4 and 8 edit them.
23. **The listing page and the homepage's Featured** (part A, E Task 7, F Task 14). `components/listing/ListingView.tsx` passes `pickupPointName={pickupPoint?.name ?? null}` to `CollectBox`; `components/home/FeaturedToday.test.tsx` mocks `@/lib/data`'s `getFeatured` around the real one and doesn't reset the store. Task 17 edits both.

## Where things stand (checked against the code on 2026-10-14)

| Area | Fact |
|---|---|
| Repo | `main` at `6a2fc9b` (F's plan). Stage D's Tasks 1 to 9 are committed and Task 10 (the account page) is in the working tree (` M app/account/page.tsx`, `?? components/account/`); E and F have plans and no code. The decisions log ends at row 65. `.claude/launch.json` is modified outside this work |
| JS | First visit at 390px, brotli quality 5, after D's Task 9 (`6e4bb91`): listing 151,752 B; `/` 150,596 B (from the commit messages of `3f96aef`, `40f6451` and `6e4bb91`). Stop line 152,305 B (decision 52), limit 153,600 B. D's account slots, E's session links and F's owner links come before this plan; take F's final figures as the start |
| Staff routes today | None. `app/robots.ts` already says "Staff pages aren't listed: naming them would advertise them, and they answer 404 to everyone else (staff tools decision 1)", and its test checks it. Nothing links to `/admin`, `/mentor` or `/hub/manage` |
| Roles | D's `Account.roles` (`StaffRole[]`); the sample mentor is Naledi (`acc-mentor`, Midrand) and the sample admin Pieter (`acc-admin`, Pretoria). D's account page shows "Hub role: Mentor" or "Admin" |
| Featured | `lib/featured.ts`'s `drawFeatured(sellers, campus, day, count = 4)`: verified sellers only, sorted by slug, rotated by the day number, the campus's own first. Nothing pins, rests or checks for listings. The 9 verified sample sellers each have one available listing (4 at Midrand, 2 at Pretoria, 1 each at Bedfordview, Tyger Valley and Online). `FeaturedTodayContent` calls `getFeatured({ campus, day })` after `await connection()`; its test uses the real draw and expects four Midrand sellers for Midrand. `home.spec.ts` expects "Hustles at Midrand" after choosing Midrand |
| Trust page | Says Verified means the Hub "approved their shop" (selling spec 8.10 asks stage G to fix it), that today's badges are samples, and that Featured's daily draw, the week's break and pins work "once accounts are live" |
| Hub | 18 fixture posts read through `lib/data/index.ts` (`"use cache"`, no tags); post pages prerendered from `getHubPostIds()`; `PostAction` (request-time) links RSVP and Request a slot to sign-in. `HubPost.going` and `capacity` are numbers for events, null otherwise. Covers are `/placeholders/hub/<id>.svg`; there's also `/placeholders/hub/banner.svg` |
| Pickup points | `data/fixtures/pickup-points.ts`: two per physical campus (`pp-<campus>-library` "Library entrance", `pp-<campus>-reception` "Main reception"), none for Online. `ListingView` passes `pickupPoint?.name` to `CollectBox` |
| Next 16.4 (read for this plan) | `notFound()` inside a `<Suspense>` boundary that has started streaming keeps status 200 and renders the nearest not-found UI in place of the boundary, with `noindex` added (`03-api-reference/04-functions/not-found.md`, "Calling notFound() after streaming has started"). `generateMetadata` that reads request data defers to request time and streams when the page has other deferred parts (`generate-metadata.md`, "With Cache Components"). `revalidateTag` and `updateTag` throw during render (`server/web/spec-extension/revalidate.js`: "phase === 'render'"); they're for Server Actions and route handlers |
| e2e | One `next start` on 3200, five device projects fully parallel, then F's `selling-writes`. `community.spec.ts` counts 9 Verified sellers on `/hub` and 6 tips, and expects the first event card to link to `/hub/h-\d{3}` |
| Privacy guard | `app/privacy/page.test.tsx` fails when a `"vossie_…"` name in the code isn't on the privacy page. This plan adds none |
| CSS | No class starts with `staff-`. `.hub-post-action`, `.hub-post-cta` and `.hub-post-note` belong to part B's post action |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. In this plan, "plan decision N" means this list; "spec 2.N" means the spec's decisions; "D decision N", "E decision N" and "F decision N" mean those plans' lists; "decision N" on its own means a row in the decisions log.

1. **The 404 comes from inside the page** (spec 2.1). Every staff page is a wordless skeleton in its static shell, and everything else renders inside `<Suspense>` after `requireStaff()`: signed out, a redirect to sign-in that comes back; signed in without the role, `notFound()`. Because the page has started streaming by then, the visitor sees the site's 404 page with status 200, and Next adds `noindex` (read in Next 16.4's docs, "Where things stand"). The tab title comes from `generateMetadata`, which reads the session and says "Page not found" to everyone but staff, so neither the shell nor the title names the page. A true 404 status needs the check before rendering starts (a proxy), which can't see the in-memory store reliably; it's a go-live item once sessions live in Supabase. Server Actions and the CSV route call the same check, so a forged post gets the 404 too.
2. **A declined shop is a waiting shop with the decline recorded.** Its seller profile keeps `status: "pending"`, so it still can't sell, keeps its drafts and its link still follows its name (everything F already does for a shop that isn't approved), and gains `declinedAt` and `staffReason`. "Waiting for approval" means pending and not declined. The seller sees the reason on `/sell`, changes the shop in Edit shop (F's page) and presses **Send for approval again**, which clears the decline. `SellerStatus` doesn't change, so D's, E's and F's code needs no new case.
3. **A Hub pause is a paused profile with `pausedBy: "staff"` and the reason.** The seller sees why on `/sell` and has no Resume button; F's `setShopPaused` refuses to resume a Hub pause, and sets `pausedBy: "seller"` when the seller pauses. Hub staff can pause an approved shop or one the seller paused (it becomes theirs to resume), and resume only their own pauses. A sample shop no account owns has no profile, so it can't be paused; its page says so.
4. **A hidden listing** (spec 3, Reports) keeps its row with `hiddenReason` and `hiddenAt`. It leaves every list, its page answers 404 (F's catalog), and its seller sees "Hidden by the Hub" with the reason on My listings, where they can still edit or delete it. The spec has no way to show it again; that's listed for Lama.
5. **Reports.** Dismiss (with a note) closes that report. Hide the listing and Pause the account close every open report on the same target, and every one of those reporters is told. A report about something that has gone, or about a Looking For request, can only be dismissed. The reporter shown is their first name only (spec 3).
6. **The audit log can't be edited** (spec 2.2). `recordAudit()` is its only writer, and there's no update or delete function, page or action. An action writes its entry after its change has gone through, never for a change that didn't happen. The one exception is POPIA: deleting an account keeps the entries it made (as "Deleted account") and strips its name, id and reason from the entries about it. Who, what, the target's name then, the reason or detail, and when (UTC, shown in SAST).
7. **Two new notification kinds:** `shop-update` (declined, paused, resumed, Verified given or taken away, a listing hidden; E's shield icon) and `booking` (a slot accepted or declined, and a new request for the post's author; the clock icon). Approval uses E's `shop-approved` and report outcomes E's `report-handled`. Reasons stay out of the sentences, which link to where the reason shows (`/sell`, My listings).
8. **Badges are worked out only for shops with an owner account** (approved or paused). The 28 sample shops no account owns have no conversations in the store, so they keep their sample badges, and the trust page says so. Overview runs the calculation for every such shop as it renders, so the store is right at once; a render can't expire cache tags, so public pages show the change when their cached data next revalidates (Next's default life, 15 minutes) or the next write expires the `sellers` tag. E's reply and confirm actions run it for their shop and expire the tag themselves when the badge changed (spec 2.7: "after each confirmed sale or first reply"; running it after every reply costs nothing and changes nothing more). Tech corner, the one owned sample shop, now gets its real badge from what the run does to it, so two end-to-end checks of its "Responsive" stamp accept any badge.
9. **Featured** (spec 2.8). `getFeatured` reads and writes the store per request (no `"use cache"`): the homepage's section already renders per request after `connection()`. Eligible sellers are verified, approved (not paused) and have at least one listed listing. Pins for that campus and day come first (up to four, in the order they were made); a pin ignores the week's break. The other places come from `drawFeatured`'s rotation, own campus first. A campus's row is recorded the first time it's drawn that day (`featuredDraws`, keyed by campus and day, with "all" for visitors who haven't chosen one), so it stays the same all day and the break can be checked: a seller shown in a campus's row sits out that campus's draws for the next six days. Adding or removing a pin for today forgets today's record for that campus, so the next view draws again with the pin first. A seller who stops being eligible during the day drops out of the row; the place stays empty until tomorrow. **With nine verified sample sellers and four places, the break leaves a campus's row short after two or three days and hides it after that** (the section hides with nobody to feature, homepage spec 7.10); listed for Lama. End-to-end runs start a fresh store, so their first day is always full.
10. **Pickup points move into the store** (spec 3), seeded from the fixture. Forms (F's onboarding, Edit shop and listing form) offer only points in use; a listing on a retired point keeps it, and its page says "Library entrance (no longer used)". Retiring is undone by **Use it again**, so it isn't a destructive action and has no confirm page. A name is 2 to 60 characters and unique on its campus, compared like shop names (F's `nameKey`). Eduvos Online has no pickup points, so its row has no form.
11. **Hub posts move into the store**, seeded from the fixture with `published`, `authorId` and times. Public functions return published posts only, tagged `hub`; a draft's page answers 404. Mentors edit their own posts; admins edit any, the samples included (they have no author, except Midrand's office hours, which the seed gives to Naledi so her pages have something in them). A new post's id is `h-` and a UUID; its page renders on first request (F decision 8). A cover is stored as one of F's photos with the owner `hub`, so a staff member deleting their account doesn't take Hub content with it; with no cover, the post shows the Hub's banner art.
12. **The editor's preview** (spec 2.4) is a second submit button, **Preview**: the server keeps every typed field in D's form state (the body up to 8,000 characters, more than the 4,000 allowed, so a long body isn't cut short before it's checked) and draws the editor again with the body rendered by part B's `Markdown`, above the form. A cover picked before Preview is stored, waiting, and kept for the save.
13. **RSVP and Request a slot** (spec 2.5). On an upcoming event, a signed-in visitor gets a form button: **RSVP**, or "You're going" and **Cancel my RSVP**; the post's `going` count moves with the RSVP rows, and a full event says "This event is full." Office hours' **Request a slot** opens `/hub/[id]/book`, the short form (300 and 100 characters); signed out, it goes to sign-in with `next` set to that page. One open request per student per office hours; the page then shows where it stands. The post's author (if any) gets a `booking` notification for each new request (FUNCTION-MAP I2).
14. **The office-hours queue is shared** by every mentor and admin: requests, newest first, each with **Accept** and **Decline** buttons that name the student and the office hours. Neither removes anything and the student can ask again, so neither has a confirm page. Each answer notifies the student (spec 2.4).
15. **The mentor dashboard** (spec 2.6). A mentor sees the shops assigned to them; an admin sees every assigned shop, with its mentor's name. One mentor per shop, chosen on the admin seller page from accounts with the mentor role; only shops with an owner account can have one. The numbers cover the last 14 days, the window of the spec's first flag: enquiries, answered within 48 hours ("3 of 4", F's rule that enquiries still inside 48 hours don't count yet) and confirmed sales. Flags: "No enquiries in 14 days", "Slow replies (under 50% in 48 hours)" (only once an enquiry is due) and "Shop paused". Mentors see numbers, never messages (FUNCTION-MAP K1).
16. **Notes and check-ins are about the shop's owner** (keyed by their account, so a changed link doesn't lose them), shared with every mentor and admin who can open the shop's mentor page, never shown to the seller and not in the seller's data export (spec 2.6). The privacy policy says so and that the Hub's Information Officer can be asked for them; whether POPIA's right of access needs them in the export is a go-live question for Eduvos's lawyers. Deleting the seller's account deletes them; deleting a mentor's account keeps their notes as "Deleted account".
17. **The CSV** (`/mentor/export`) is a GET route handler with the same role check (sign-in when signed out, 404 otherwise), `Cache-Control: no-store` and `Content-Disposition: attachment`. A cell that starts with `=`, `+`, `-` or `@` gets a leading apostrophe, so a spreadsheet never runs a shop name as a formula. The link is a plain `<a download>`.
18. **Confirm pages for the destructive actions the spec names** (spec 2.9): decline a shop, hide a listing, pause a shop (from its page or from a report). Each repeats what will happen, asks for the reason (required, up to 500 characters) and has a **Keep** link back. Everything else is one form button whose name says what it does to what ("Approve Tech corner", spec 4).
19. **No prefetching into staff pages.** Staff links live only on the account page (Admin console, Hub posts and office hours, Mentor dashboard, by role) and inside staff pages, and every one has `prefetch={false}`: Overview's render runs the badge calculation, and every staff render reads the session. No public page links to a staff page, and `robots.txt` still names none.
20. **Tables stack below the tablet step** (spec 2.9) with explicit table roles (`role="table"`, `"row"`, `"columnheader"`, `"cell"`), so screen readers keep the table when CSS changes its display; on phones each cell shows its column's name in a small `aria-hidden` span (hidden from the tablet step, where the header row shows), so it isn't read twice. A span rather than CSS generated content: `content: attr() / ""` (alternative text) isn't safe to rely on through Tailwind's CSS pipeline. Every table has a caption and header cells (spec 4).
21. **End to end** (spec 6). The five device projects run the checks that only read, and the writes buyers can't see: the 404s, a mentor's note and the CSV, approving and declining a new student's shop, and dismissing a report. A seventh project, `staff-writes`, runs after the five and after F's `selling-writes` (like it, decision 25 there; after it too, since both add listings to Tech corner) for the writes buyers see: Verified on the Hub's list, hiding a listing (browse), pausing a shop from a report, a pin (the homepage's Featured), and publishing Hub posts with an RSVP and a slot request on them (the feed). Each test uses the sample Admin and Mentor accounts and acts only on its own new students, shops, listings, reports and posts, found by a word no other test uses. No test approves Lerato's sample shop or pauses Tech corner.
22. **Wording the spec doesn't give** (Lama may change it): the notices (`lib/staff/notices.ts`), the notification sentences (`lib/staff/notification-text.ts`), the confirm pages' lines and the empty states (in each view), the flags' explanations (`lib/staff/mentor.ts`), Overview's lines, the declined and Hub-paused lines on `/sell` (Task 18), Naledi's sample note and check-in and Thandi's sample slot request (`data/fixtures/staff.ts`).
23. **Races and second presses.** Each data function checks the state it expects (approve only a waiting shop, resume only a Hub pause, answer only a request that's still open…) and says when there was nothing to do. The action then writes no audit entry, sends nothing, and says "Nothing changed. It was already done."
24. **Not in this stage:** showing a hidden listing again, assigning reports to a staff member, managing staff accounts, analytics, email to staff and scheduled jobs (spec 7). The nightly badge job is a go-live item.

## Amendments on review

The controller adds amendments here; they override the tasks below wherever they differ. Added on 2026-10-15 from two reviews of this plan against stages D, E and F as built (HEAD `939659c`): a recheck of every name and API the tasks quote, and a design review. Lama's decisions are rows 73 to 77 in the decisions log; the rest are Claude's under decision 54.

**The start state and how things are built now**

1. **Start state** (recheck items 1 and 2). The tree may be clean: `.claude/launch.json` is only modified on Lama's Mac. Start figures are F's final ones: `/` 150,613; browse 151,360; listing 151,769 (the highest public page, 536 B under the 152,305 B stop line); storefront 151,373; `/sell` 150,613; Hub page and Hub post (`h-013`, a tip) 150,613; the two listing-form pages 153,086 B (decision 70). Hub event and Hub office hours aren't measured until Task 15. Add a "Listing forms" column to the ledger, starting at 153,086 B. Task 18 changes `/sell`, which every page prefetches: any rise there goes to Lama. Unit tests at the start: 1,472 (213 files). End to end: 900 pass, 707 skipped, 3 fail (the cloud container has no Arial for Geist's fallback). The decisions log ends at 77 after this review, so new rows start at 78. In the cloud container Playwright needs `PLAYWRIGHT_BROWSERS_PATH` set to an alias of the installed Chromium. "Where things stand" is out of date: read this list instead.
2. **The store** (recheck item 3). `STORE_VERSION` is 5 after F (`retiredSlugs`, `publishedAt`), so Task 1 Step 9.4 makes it 6. Put the eight new fields and seeds after `retiredSlugs` (type) and `retiredSlugs: new Set(),` (seed), and Step 7.2's lines after `expect(store.retiredSlugs.size).toBe(0);`.
3. **`lib/data/tags.test.ts` already exists** (F's review). It mocks `next/cache` with a `cacheTag` spy and checks every cached reader's tags in its `LISTINGS` and `SELLERS` tables. Don't overwrite it. Task 4 Step 2's `hubChanged`/`pickupPointsChanged` test goes in a new `lib/data/staff-tags.test.ts`. Task 6 removes `"use cache"` from `getFeatured`, so its row leaves `SELLERS`, and `getPickupPoints` joins with the `pickup-points` tag; Task 7 adds rows for `getHubEvents`, `getHubPosts`, `getHubPost` and `getHubPostIds` (tag `hub`).
4. **`setShopPaused` is edited, not replaced** (Task 4 Step 7). F's version refuses a profile with no shop row (selling amendment 11; `shops.test.ts` "refuses a seller profile with no shop behind it") and reads through `liveShopOf`. Keep both: start with `const own = liveShopOf(accountId); const profile = sampleStore().sellerProfiles.get(accountId); if (!own || !profile || profile.status !== (paused ? "approved" : "paused")) return null;`, then add the staff-pause refusal and the `pausedBy` lines.
5. **`recentCounts`** (Task 5 Step 5) filters `row.sellerSlug === sellerSlug && !row.sellerGone`, as F's `shopStats` does, so a deleted shop's conversations never count for a shop that later takes its link.
6. **The account export test** (Task 8). The built test destructures `{ conversations, reports, notifications, shop, listings, ...rest }` and compares `rest` with `toEqual`. Add G's keys to the destructuring and to the `Object.keys` list, and check them separately; don't add properties to the expected object.
7. **`usePhotos` is `claimPhotos`** (Task 14 `savePost`; selling amendment 9). `claimPhotos` returns the set it took and only takes a waiting photo, one already with that use, or the wizard's photo becoming the shop's; `storePhotos(owner, files, now, keep)` takes a `keep` set. See amendment 19 for where Hub covers wait.
8. **The Playwright projects** (Task 20 Step 1; plan decision 21; approval 6). There's no `DEVICE_PROJECTS`. F made `selling-writes` the teardown of a `setup` project, because a project with dependencies is skipped whenever any dependency fails, and the cloud container fails three layout-shift checks every run. `staff-writes` has **no dependencies**: give `selling-writes` `teardown: "staff-writes"` and check with `pnpm exec playwright test --list`, and with one device test forced to fail, that both write projects run last, `selling-writes` first. If Playwright 1.64 won't chain teardowns, widen the teardown project's `testMatch` to both files and run it serially; then neither file asserts a count the other changes. Add `STAFF_WRITES` to every device project's `testIgnore`, rewrite the config's comment (including F's `--no-deps` notes), and make every check after a write go through the action's redirect or a retrying assertion (`expectAfterWrite`, selling amendment 16). Each staff-writes test cleans up its own data even when it fails, like F's `deleteMade`.
9. **Every form with an `ErrorSummary`** (Tasks 9 to 16) joins `components/forms/summary-ids.test.tsx` (mock `@/lib/staff/*-actions` and `@/lib/hub-actions` there) and keeps "never repeats an id" passing. `clearStaffForm` may wrap E's `clearOwnFormState`.
10. **Measuring.** Task 21 adds its pages to `performance.spec.ts`'s `SIGNED_IN_PAGES` table (optional fourth value: a field label to wait for) and to `cls.spec.ts`'s rows (fourth value: the `signIn` button label), rather than new specs. No end-to-end test uses `h-002`: it starts 2026-10-15, so it has passed. Use `h-007` (19 Nov 2026) with a newly signed-up student for the slot form, and Thandi at `h-007` for "request waiting" (Task 21 lines ~13830 and ~13837).
11. **A shop's link changing** (F's go-live note). F's `moveShop` (`lib/data/shops.ts`, where it rewrites conversations and reports) also rewrites `featuredPins.sellerSlug` and `featuredDraws.sellerSlugs`, in the same block with no await. G's shop notifications use the owner's account id as `subjectId` (they link to `/sell`). The audit log keeps the old link: it's append-only, and links are never reused (selling amendment 11). `forgetAccountInStaffTools` deletes pins for the deleted owner's shop, using the profile's `sellerSlug` read before the profile goes. A declined shop is still waiting, so its link follows its name.
12. **Task 18 details.** Pass the profile's `appliedAt` to `ShopWaiting` (not `own.shop.createdAt`), so a resent shop shows its new date. Write `ShopDeclined`'s lede as one text node, as F did for the waiting page (`efb63a9`). The dashboard's "Your badge changes when the Hub next updates badges." becomes untrue once badges update after a reply or sale (Task 17): say "Your badge updates after each reply and confirmed sale." (Lama may change it).
13. **Retired pickup points on F's forms** (Task 6; plan decision 10). F's listing form, Edit shop and the wizard offer only points in use, but the server checks against the shop's stored points, so a listing on a retired point couldn't be saved as it is, and Edit shop would silently drop it. The listing form offers the listing's own retired point as "{name} (no longer used)", and the server accepts it only if unchanged (the allowed points are the shop's points in use plus the listing's current one). Edit shop and the wizard say when a saved point was retired ("Library entrance is no longer used: choose another"). Tests for each.

**Lama's decisions (decisions log rows 73 to 77)**

14. **Featured's break is soft** (row 73; replaces plan decision 9's hard break). After pins, draw from sellers who aren't resting; if places remain, fill them from resting sellers, the one shown longest ago first, then in rotation order (`drawFeatured`'s `resting` becomes a map of slug to the last day shown). Task 6's test expects 4 sellers every day while 4 or more are eligible. Task 19 changes the trust page's bullet to "A seller featured on a campus sits out that campus's draw for the next six days, unless there aren't enough other sellers to fill the row." Task 22 drops or rewords the go-live item "Featured with few Verified sellers".
15. **A Hub pause takes the shop down** (row 74; spec 2.3). A pause with `pausedBy: "staff"` takes the storefront and its listings' pages away from buyers: in `lib/data/catalog.ts`, `publicListing` and `hasStorefront` treat it as having no page (the owner still reaches their pages through F's owner links and `/sell`). While it lasts the seller can't send messages: `lib/messaging/subjects.ts` refuses a seller-side message, and the thread says "The Hub has paused this shop." A seller's own pause keeps F's behaviour. The confirm pages' lines say so. Expire both `sellers` and `listings`. Tests in Tasks 4, 17 and 20. Selling amendment 17's go-live line about page copies that outlast a restart covers hidden listings and Hub-paused shops too.
16. **Mentors' notes are the seller's to read** (row 75; POPIA section 23). A shop's mentor notes and check-ins go in its owner's data download (`exportAccountData`), and the notes page tells mentors so ("The seller can download these notes."). The author or an admin can delete a note or check-in (POPIA section 24); the audit entry records the deletion without the text. Notes stay visible only to the assigned mentor and admins (narrower than spec 2.6's "shared with other mentors": update the spec and the mapping table).
17. **A deleted staff member shows as "Former staff member"** in the audit log (row 76; replaces plan decision 6's erasure of the name). Entries are kept as the record; Eduvos sets how long the log is kept before launch (go-live list).
18. **A hidden listing can be shown again** (row 77; removes it from plan decision 24's "not in this stage"). `/admin/sellers/[slug]` gains a "Hidden listings" section (title, when, reason, and **Show it again**, through a confirm page). Showing it again is audited, notifies the seller ("The Hub has shown {title} again."), clears the hidden flag and expires `listings`. Not adopted from the review: refusing staff action on their own shop, and logging the mentors' CSV download (both stay as planned).

**Design review fixes (Claude, under decision 54)**

19. **No await between a check and its write** (add to Conventions; selling amendment 15). `addPickupPoint` and `renamePickupPoint` use a synchronous `nameTaken()` inside the module (the exported async version wraps it). Hiding a listing or pausing a shop from a report goes through one synchronous data function, `actOnReport(id, "hide" | "pause", reason, staffId, now)`, which re-checks the report is open and what it allows, acts, and closes the reports, returning the decision and the closed reports, or null. `recalculate` re-reads `store.sellers.get(slug)` after awaiting `shopStats` and writes only if it's the same row and still not pending.
20. **Every Hub pause closes the shop's open reports** (from the Sellers page or from a report): every open report whose target is the shop or one of its listings closes with outcome "paused" and the reason, and each reporter gets "Thanks, we've acted…".
21. **The audit log's `subjectId` is always the person the entry names**: for report entries, the owner of the reported listing's or shop's shop (null for a sample shop or a request); for pins, the pinned shop's owner; never the reporter. Tests: deleting a reporter leaves "report-dismissed" as it was; deleting the reported seller blanks it.
22. **Opening the admin Featured page records nothing.** Add `previewFeatured(campus, day)`, which returns the recorded row or what the draw would give, without recording; the admin page uses it, and only `getFeatured` records.
23. **Requests for past office hours** (`openBookingCount`) are "passed" once the day is over (SAST): not counted, listed after open ones with no Accept or Decline, and the student's page says so.
24. **Hub covers wait under the staff member's own account** (`storePhotos` with `keep`); on save they're claimed and given the owner "hub". `keptCover` accepts only the staff member's own waiting photo. The editor gains "Remove the cover", which deletes the old photo and shows the Hub's banner (consent can be withdrawn).
25. **The data export carries the Hub's reasons**: the export's `shop` gains `standing` and `hubReason`; each listing gains `hidden: { at, reason } | null`; plus mentor notes (amendment 16).
26. **Editing posts with RSVPs or requests**: refuse capacity below the RSVPs taken (`post-capacity-below`) and a change of kind on a post with RSVPs or open requests (`post-kind-locked`). Telling attendees about a changed date is a go-live item.
27. **Staff pages are `noindex` from the first byte**: `next.config.ts` `headers()` adds `X-Robots-Tag: noindex, nofollow` for `/admin/:path*`, `/mentor/:path*`, `/hub/manage`, `/hub/new`, `/hub/:id/edit` and `/hub/:id/book` (the metadata only streams later).
28. **The editor's Preview**: `Markdown` takes `headingLevel`; Preview renders the body's headings at level 3, starts with "Not saved yet. Press Save to keep it.", and its region has `tabIndex={-1}` so the redirect can land focus there.
29. **Smaller fixes.** The CSV also prefixes cells starting with a tab or a carriage return and adds a UTF-8 byte-order mark. The audit log page says it shows the newest 200 and pages back; its caption names the filter. Labels keep the visible words first ("Use Library entrance again <sr>at Midrand</sr>", WCAG 2.5.3). The hide confirm page shows the listing's current title with "See the listing". A press whose target has gone or changed link says "That has changed; open it again." Resuming a Hub pause that took over the seller's own pause restores the seller's pause. Tips may be for a campus or all (spec 2.4). Request reports are dismiss-only until stage H (decision 67). Every RSVP calling `hubChanged()` is a go-live note (cache churn). Tech corner will show "New seller" once badges are worked out (2 enquiries); seed a third answered conversation in Task 1 so it stays Responsive, or accept it and say so in the hand-over.
30. **The paused notice** (Task 2 `notices.ts`) says what's true after selling amendment 10 and row 74: a seller's pause — "Paused. Its listings are off every list and it takes no new messages. Its pages stay up, marked paused."; a Hub pause — "Paused by the Hub. Its pages are down for buyers and it can't send messages." The confirm pages in Tasks 11 and 12 say the same.
31. **What Task 1 built, for later tasks** (Task 1's build). `AuditAction` gains `"listing-shown"` (amendment 18), `"note-deleted"` and `"check-in-deleted"` (amendment 16): Task 2's `audit-words.ts` `ACTIONS` and its test's `EVERY_ACTION` list name them. `staffId` on `AuditRow` and `AuditEntry` is a `string`, kept after the staff member's account is deleted (amendment 17): Task 8's `staff-privacy.ts` keeps the id and replaces the stored `staffName` with "Former staff member" when the account is deleted (not `staffId: null, staffName: "Deleted account"`), so no deleted person's name stays in the log, and Task 4's `auditStaffNames` lists a former staff member under that name. Task 10's report-dismissed entry takes the reported shop's owner as `subjectId`, not `closed.reporterId` (amendment 21). No third Tech corner conversation was seeded: Tech corner shows "New seller" once badges are worked out (2 enquiries), and end-to-end checks don't assert its badge (amendment 29's second option; Claude under decision 54).
32. **What Task 2 built, for later tasks** (Task 2's build). `lib/staff/notices.ts` exports `SELLER_PAUSE_LINE` and `HUB_PAUSE_LINE` (amendment 30): Tasks 11 and 12's confirm pages import them. New notice codes: `changed` (a target gone or its link changed; Task 10), `resumed-seller-pause` (lifting a Hub pause that took over the seller's own; Task 10), `listing-shown` (Task 10, with the audit action of the same name and `listingShownText(title)` from `notification-text.ts` as a `shop-update` notification), `booking-passed` (Task 14), `note-deleted` and `check-in-deleted` (Task 16, with the audit actions of the same names). New error codes `post-capacity-below` and `post-kind-locked` (amendment 26) map to the capacity and kind fields: Task 3's `post-rules.ts` or Task 14's save emits them. `audit-words.ts` exports `FORMER_STAFF` ("Former staff member"): Task 4's `auditStaffNames`, Task 8's `staff-privacy.ts` and Task 13's log page use it. "Showed a hidden listing again" files under the `reports` kind, beside "listing-hidden".
33. **Task 2's review: words that weren't true** (Claude under decision 54). `shopDecisionText` gains `"resumed-own-pause"` ("The Hub lifted its pause on {shop}. Your own pause is back: resume the shop on your dashboard when you're ready."): Task 10's `resumeSeller` sends it, with the `resumed-seller-pause` notice, when the Hub's pause had taken over the seller's own. The `report-paused` notice is now "Paused. The seller and everyone who reported the shop or its listings have been told." (amendment 20 closes those reports), and `post-draft` is "Saved as a draft. Only you and the admins can see it." Tasks 10, 14 and 20 use these words where their quoted tests have the old ones.
34. **What Task 3 built, for later tasks** (Task 3's build). `drawFeatured`'s `resting` is a `ReadonlyMap<string, string>` (slug to the last day shown): Task 6's `featuredFor` builds it from the draws of the six days before, and its test expects 4 sellers every day while 4 or more are eligible (amendment 14). `checkPost(fields, campusSlugs, taken)` takes `taken: { kind, rsvps, openRequests } | null` (null for a new post) and emits `post-kind-locked` and `post-capacity-below`; `postLocks(fields, taken)` is exported so Task 14's `saveHubPost` runs it again with the counts at write time, with no await before the write (amendment 19). Tips may be for one campus or all: Task 14's editor drops "Tips are for every campus.", and the Hub feed shows a one-campus tip with its campus named, like events (Claude under decision 54). `mentorCsv` starts with a UTF-8 byte-order mark (`CSV_BOM`): Task 16's route test checks the first bytes with `arrayBuffer()`, and Task 20 strips it before comparing the header. Task 18 changes `badgeProgress`'s "Your badge changes when the Hub next updates badges." and its test (amendment 12).
35. **What Task 4 built, for later tasks** (Task 4's build). `staffPauseShopNow(slug, reason)` and `hideListingNow(id, reason, now)` are synchronous: Task 5's `actOnReport` uses them, and amendment 20 (every Hub pause, including Task 10's `pauseSeller`, closes the open reports on the shop and its listings and tells each reporter) is still to build. `SellerProfileRow.sellerPauseHeld` records a seller's own pause that a Hub pause took over; `staffResumeShop` returns `sellerPauseBack`, and Task 10's `resumeSeller` then sends `shopDecisionText("resumed-own-pause")` with the `resumed-seller-pause` notice. Task 10: shop notifications use `subjectId: decision.ownerId` (amendment 11), `pauseSeller`/`resumeSeller` expire both `sellers` and `listings`, the show-again action uses `showListing` (audited `listing-shown`, `listingShownText` as `shop-update`, `listingsChanged()`), and the report-dismissed entry's `subjectId` is the reported shop's owner. A Hub pause refuses a seller's replies in `lib/data/messages.ts` (`sendMessage` returns `"hub-paused"`; `ThreadView` says "The Hub has paused this shop."), not in `subjects.ts`. The audit names function is `auditStaff` (amendments 31 and 32 call it `auditStaffNames`). Task 8: the export and deletion account for `sellerPauseHeld`; a Hub-paused shop's `standing` reads `pausedBy: "staff"`. Task 11's "Hidden listings" section reads `listHiddenListings(slug)`. Task 13 adds a cursor to `listAudit` for paging (amendment 29). Task 18: a Hub-paused shop's public pages are gone for its owner too, so the dashboard and My listings don't link to them while it lasts.
36. **Task 4's review** (Claude under decision 54). A Hub-paused seller can't Mark as completed (`markCompleted` refuses, `SaleActions` hides the button): the sale-to-confirm notification would reach the buyer and could confirm a sale for the badge. `setVerified` refuses a Hub-paused shop. For Task 18: a thread's summary says a listing is "hidden" or a shop "paused" rather than "This listing has been removed.", and doesn't link to a page that now 404s (`MessageSummary`); the buyer's side of a Hub-paused shop's thread says the shop can't reply right now (wording for Lama); refresh the stale comments on `getListingDetail`, `getSeller` and `sellerFor` (hidden listings and the Hub's pause). For Task 13: two or more former staff members can't share one filter label (WCAG 2.4.4): merge them into one "Former staff member" filter. Hand-over note: in sample mode, deleting a sample account and signing in with its button again restores its shop from the fixture, undoing the Hub's pause and hides.
37. **What Task 5 built, for later tasks** (Task 5's build). `closeReportsOn` is gone. `actOnReport(id, "hide" | "pause", reason, staffId, now)` returns `{ act, decision, closed } | null` (null for a report that isn't open, a request, a sample shop's pause, a gone target, or nothing to do), and `pauseShopClosingReports(slug, reason, staffId, now)` returns `{ decision, closed } | null`; both are synchronous. `ClosedReport.ownerId` is the reported shop's owner (amendment 21). Task 10: `hideReportedListing` calls `actOnReport(id, "hide", …)`, audits with `decision.ownerId` as `subjectId`, notifies the seller, tells each reporter in `closed`, then `listingsChanged()`; `pauseReportedShop` calls `actOnReport(id, "pause", …)` and expires `sellers` and `listings`; `pauseSeller` calls `pauseShopClosingReports` and tells each reporter in `closed`; `dismissReport` audits with `closed.ownerId`. To tell "changed" from "already done", read `getReport(id)` first: missing or `!view.exists` means `changed`; a closed report whose `outcome` matches the act (hidden, paused) means `nothing` (a second press, plan decision 23); any other closed report, or an open one where `!view.can[act]`, means `changed`; `actOnReport` returning null after that means `nothing` (amendment 38). `ReportView.closedByName` is `FORMER_STAFF` once the staff member's account has gone. Badge callers (Tasks 11 and 17) call `recalculateBadges(now)` or `recalculateBadgeFor(conversationId, now)` and expire `sellers` themselves where they can (a render can't).
38. **Task 5's review** (Claude under decision 54). Amendment 37's rule for "changed" and "already done" now treats a second press on a report its own act closed as `nothing`. `ReportView.listing` is `{ id, title, public } | null`: the reported listing's current title, and whether buyers can open its page; Task 12's hide confirm page shows that title and links "See the listing" only when `public` (amendment 29). Task 10 calls only `actOnReport` and `pauseShopClosingReports` for Hub pauses and hides; the older `staffPauseShop` and `hideListing` (Task 4) and the plan's quoted calls to them and to `closeReportsOn` must not be used from actions, or reports stay open (amendment 20). For Lama, and the go-live list: a report on a listing its seller then deleted can't name or pause the shop, and a later pause doesn't close it (a report keeps no shop link); storing the shop on listing reports is a stage E follow-up. Hand-over (sample mode): restoring a sample shop brings back its fixture listing ids, so reports about the deleted copy apply to the restored one.
39. **What Task 6 built, for later tasks** (Task 6's build). `getFeatured` isn't cached (it records the day's row) and has no tag; `getPickupPoints` and `getListingDetail` carry the `pickup-points` tag. Task 13's Featured page uses `previewFeatured` only, with `featuredChoices`, `addPin` (the pin, or "not-eligible", "taken" or "full"), `removePin` and `listPins(fromDay)`; adding or removing a pin forgets that campus's row for the day; pin actions need no tag. Task 13's Pickup points page uses `listPickupPoints`, `addPickupPoint` (null for a taken name, Eduvos Online or an unknown campus), `renamePickupPoint` (`{ before }` or null), `retirePickupPoint` and `restorePickupPoint`, and its actions call `pickupPointsChanged()`. `pointsForListing(shopPointIds, currentId)` allows a listing's own point only when it has been retired (a point still in use that the shop dropped stays refused, as F built it); `retiredPoints(ids)` feeds Edit shop and the wizard. Task 17 shows "(no longer used)" on a listing page whose `pickupPoint.retired` is true. `featuredFor` tidies draw rows and pins over 7 days old. Retiring a point leaves shops' stored `pickupPointIds` until the seller's next save.
40. **Task 6's review** (Claude under decision 54). Retired points stay on existing listings (spec 2.3), so: `updateShop` leaves a pickup listing on its own retired point while the shop stays on that point's campus (Edit shop posts only points in use, so saving it, even just the tagline, used to move the listing to the shop's first point); a shop that moves campus still moves its listings as F built it. `sendForApproval` gives the new shop only the draft's points still in use on its campus. /sell's `resumeStep` counts only the campus's points in use, so a draft whose only point was retired picks up at step 4. When a campus has no points in use left, Edit shop and the wizard still name the saved points that were retired, beside "no pickup points" ("Library entrance is no longer used. Midrand has no pickup points: you'll meet buyers online."; `retiredLine(names, false)`). `removePin(id, today)` now takes today's SAST date and returns the pin, `"past"` for a pin whose day is before today (it stays, with that day's recorded row, which counts towards others' break), or null; only today's and later rows are forgotten. Task 10's `unpinSeller` calls `removePin(id, sastDate(now))` and treats `"past"` like null (`nothingChanged`): the Featured page lists only today's and later pins, so a past one comes only from a stale page. (`addPin` doesn't check the day; `pinSeller`'s `checkPinDay` keeps it to today or later.) For Task 13 (with Task 10's add and rename actions): when the name taken is a retired point's, the error says so: "A retired point has that name: use it again." (a new error, such as `point-name-retired`, in `lib/staff/errors.ts`, beside `point-name-taken`; the data module tells the two apart, for example by `isPointNameTaken` returning which kind of point has the name).
41. **What Task 7 built, for later tasks** (Task 7's build). Covers (amendment 24): `PostSave.cover` is `{ src } | "remove" | null`; `saveHubPost` hands the saver's own waiting photo to owner `"hub"` (`HUB_PHOTO_OWNER`) with use `hubCoverUse(id)` through `handOverPhotoNow` (no await), deletes the cover it replaces, and ignores any other photo; `"remove"` deletes the cover and shows the banner. Locks (amendments 19, 26, 34): `saveHubPost` repeats `postLocks` at the moment it writes and returns `PostSaved | PostLocked | null` (`{ locked }` changes nothing, cover included); `postTaken(id, now)` gives `checkPost` its counts. Only RSVPs made on Vossie count, not a sample event's starting `going`, and open requests count only while their office hours are ahead. `HubBooking.status` can read `"passed"` (never stored); `listBookings(today)` lists open, then passed (newest 30), then answered (newest 30); `openBookingCount(today)` and `latestBooking(postId, accountId, today)` take the SAST date; `answerBooking` returns `"passed"` for an open request whose day is over, null for a second press or an unknown id. Task 14: `savePost` stores covers with `storePhotos(account.id, …)`, `keptCover` checks `photoSrcsOf(account.id, null)`, it passes `cover` as above with a "Remove the cover" control, drops the plan's `usePhotos`/`deletePhotosUsedBy` calls, writes `{ locked }` codes to form state, calls `checkPost(…, await postTaken(id, now))` for edits, and `answerSlot` shows the `booking-passed` notice for `"passed"` (null is "nothing"); `HubManage`'s queue reads `listBookings(sastToday())` and gives passed rows no Accept or Decline. Task 11's Overview uses `openBookingCount(today)`. Task 15 uses `latestBooking(…, today)` and `BookSlotView` handles `"passed"`. Task 8: Hub covers belong to `"hub"`, so deleting a staff account keeps them; that account's waiting covers go with `deletePhotosOf`. `HubPostCard` names a one-campus tip's campus (amendment 34); the post page (`HubPostView`) doesn't yet, and Task 17 adds it. Go-live list: every RSVP calls `hubChanged()`, which churns the Hub's cache at scale (amendment 29).
42. **Task 7's review** (Claude under decision 54). A request is passed when its post has gone, is no longer office hours, or its day is over: `requestPassed` and `liveRequestCount` share that rule, so an admin who turns past office hours into an event (the kind lock no longer counts their passed requests) doesn't bring the old requests back as open under the event (counted by `openBookingCount`, listed open, accepted by `answerBooking`). A post's places can't go below the going its card shows: `PostTaken` gains `going` (a sample event's starting `going` plus Vossie's RSVPs) and `postLocks` compares capacity with it, so h-003 (23 going) refuses 5 places; the kind lock still counts only Vossie's RSVPs and open requests (amendment 41), and the code stays `post-capacity-below`. `removeRsvp(postId, accountId, today)` takes the SAST date and returns false once the event has passed (its own day still counts as ahead, as for `addRsvp`), so a past event's count stays. New tests: a save and an RSVP sent at once in both orders (the save first must leave the RSVP "closed"; checked against an await injected after the lock check), and Accept and Decline pressed at once answer once. For later tasks: Task 15's `cancelRsvp` calls `removeRsvp(id, account.id, sastDate(now))`, and for a past event false means nothing to do (no `hubChanged()`, no notice; the page shows no Cancel for a past event anyway, so it comes only from a stale page). Task 14's `post-capacity-below` counts the going the card shows, sample starting number included, so its words ("More people are going than that.") still hold; its test for that error uses a post's shown going. For Lama and the go-live list: moving a passed office-hours date into the future brings its old open requests back (they read open again and can be answered); telling requesters about a changed date goes with amendment 26's go-live item.

## Store design

The eight tables, the fields added to earlier rows, and who touches them:

- **`auditLog`** (by id, `aud-<uuid>`): `AuditRow`, one per staff action (plan decision 6): when, the staff member (id and first name then), the action, the target (kind, id and name then), the reason or detail, and the student it was about (for POPIA deletion). Only `lib/data/audit.ts` writes it, through `recordAudit()`, and `lib/data/staff-privacy.ts` forgets deleted accounts in it.
- **`featuredPins`** (by id, `pin-<uuid>`): a seller pinned to a campus (or "all") for a day, by whom. **`featuredDraws`** (by `${campus}:${day}`): the row as first shown that day, pins first (plan decision 9). Both only in `lib/data/featured.ts`. Draws older than a week are tidied away as new ones are made.
- **`pickupPoints`** (by id): `PickupPointRow` (id, campus, name, when retired, when made), seeded from `data/fixtures/pickup-points.ts`. New ids are `pp-` and a UUID. Only `lib/data/pickup-points.ts`.
- **`mentorNotes`** (by id, `mn-<uuid>`): a note or a check-in (with its date) about a shop's owner, by whom (plan decision 16). Only `lib/data/mentors.ts`, and the privacy module.
- **`hubPosts`** (by id): `HubPostRow`, the `HubPost` shape plus `published`, `authorId`, `createdAt` and `updatedAt`, with `publishedAt` null until first published. Seeded from `data/fixtures/hub.ts`. **`hubRsvps`** (by `${postId}:${accountId}`) and **`hubBookings`** (by id, `bk-<uuid>`). All three only in `lib/data/hub-posts.ts`, and the privacy module.
- **Fields added to earlier rows, all optional** (absent means null, so D's, E's and F's code and seeds need no change): `SellerProfileRow` gains `declinedAt`, `pausedBy`, `staffReason` and `mentorId`; `ListingRow` gains `hiddenReason` and `hiddenAt`; `ReportRow` gains `outcome`, `note`, `closedAt` and `closedBy`.
- **Seeds:** `data/fixtures/staff.ts` (types only from `lib`; it reads the hub and pickup point fixtures): the pickup points and Hub posts as rows, Naledi's two sample entries about Sipho (a note and a check-in) and Thandi's sample slot request at `h-007`. `data/fixtures/accounts.ts` gives Sipho's profile `mentorId: "acc-mentor"`, so Naledi's dashboard has a shop. `STORE_VERSION` goes up by one.
- **Who reads what:** `lib/data/staff-shops.ts` (decisions on shops and listings), `lib/data/staff-reports.ts`, `lib/data/badges.ts`, `lib/data/featured.ts`, `lib/data/pickup-points.ts`, `lib/data/hub-posts.ts` and `lib/data/mentors.ts`. `lib/data/staff-privacy.ts` holds what deleting and exporting an account do to all of them; `lib/data/accounts.ts` imports it, and it imports none of the others' callers, so there's no import cycle.

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec 5):** if any page passes **the stop line Lama last accepted (152,305 B when this plan was written; use the newer figure from "Recheck" item 2 if there is one)**, stop after that task and report the figures. Don't cut features to fit; that's Lama's decision. Staff pages aren't in the public budget, but each still stays under the limit (spec 5).
- **Where bytes move:**
  - Tasks 1 to 14 and 16 add no client code. Staff pages and their forms are Server Components posting to Server Actions, which the framework's own chunk already handles.
  - **Task 15 changes the Hub post page** (`PostAction`, a Server Component: a form for RSVP) and adds `/hub/[id]/book`. Task 15 measures the Hub pages.
  - **Task 17 changes the homepage's Featured section, E's message actions and the listing page** (Server Components and Server Actions only). The homepage is prefetched from every page's header, so Task 17 measures every page.
  - **Task 18 changes `/sell`** (prefetched from every page's header, F decision 20), **the account page and the notifications page** (Server Components only). Task 18 measures every page.
- **Recording.** `tests/e2e/performance.spec.ts` prints each page's `scriptBrotli`. Tasks 15, 17, 18 and 22 run it at 390px and put the figures in their commit messages; Task 15 adds Hub office hours to it, and Task 21 measures four staff pages, signed in, in `tests/e2e/staff-checks.spec.ts`.

**As built** (fill in during the build):

| Point | `/` | `/browse` | Listing | Storefront | Hub event | Hub office hours | `/sell` (signed out) |
|---|---|---|---|---|---|---|---|
| Start (F's final figures) | | | | | | – | |
| Task 15, RSVP and Request a slot | | | | | | | |
| Task 17, Featured, badges, retired points | | | | | | | |
| Task 18, `/sell`, the account page | | | | | | | |
| **Final (Task 22)** | | | | | | | |

Staff pages, signed in (Task 21): Overview ________ B, Sellers ________ B, Hub tools ________ B, Mentor dashboard ________ B.

The stop line used: ________ B. Unit tests at the start: ________. End to end at the start: ________ pass, ________ skipped.

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there.
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, and comments in plain English. There's no formatter: match the file you're in.
- **Server or client.** Server Components unless a file starts with `"use client"`. This plan adds **no** client component. Plain `lib/` modules have no directive. `lib/staff/admin-actions.ts`, `lib/staff/hub-actions.ts`, `lib/staff/mentor-actions.ts` and `lib/hub-actions.ts` start with `"use server"`: everything they export must be an async function (types are fine; constants are not).
- **Next APIs.** Before using a Next API this plan names, read its page in `node_modules/next/dist/docs/01-app/` (AGENTS.md). This plan uses:
  - `notFound()` after streaming has started: `03-api-reference/04-functions/not-found.md`;
  - `generateMetadata` with request data: `03-api-reference/04-functions/generate-metadata.md` ("With Cache Components");
  - Server Actions, forms, `refresh()`, `redirect()`/`RedirectType`: `02-guides/server-actions.md`, `02-guides/forms.md`, `03-api-reference/04-functions/refresh.md`, `redirect.md`, `03-api-reference/01-directives/use-server.md`;
  - `cacheTag` and `updateTag`: `03-api-reference/04-functions/cacheTag.md`, `updateTag.md`, `revalidateTag.md` (why a render can't expire a tag);
  - `connection()`: `03-api-reference/04-functions/connection.md`;
  - dynamic routes and `generateStaticParams`: `03-api-reference/03-file-conventions/dynamic-routes.md` ("With Cache Components"), `03-api-reference/04-functions/generate-static-params.md`;
  - a GET route handler: `03-api-reference/03-file-conventions/route.md`, `01-getting-started/15-route-handlers.md`;
  - the session behind `<Suspense>`: `02-guides/authentication-with-cache-components.md`;
  - kept pages: `02-guides/preserving-ui-state.md`.

  The first task that uses one says so in its first step.
- **Breakpoints.**
  - `wide:` is tablet and up; `desk:` is desktop. Never use `md:`, `lg:` or `sm:`.
  - In CSS, write `@media (min-width: 48rem) and (min-height: 30rem)` and `@media (min-width: 64rem) and (min-height: 30rem)`. Landscape phones are `@media (orientation: landscape) and (max-height: 29.99rem)`.
- **Page padding.** `.page` and the page's own class (`.staff-page`, `.hub-book-page`) sit on one element, so the page class's padding *replaces* `.page`'s gutter. Write the whole content edge: 16px on phones, 40px from the tablet step.
- **Effects.** None in this plan.
- **Headings.** One H1 per page. Sections are `<section aria-labelledby="…">` with one H2, visible or `sr-only`. Ids are unique across pages (`staff-…`, `admin-…`, `post-<id>-…`, `book-<id>-…`, `mentor-…`), because Next keeps earlier pages hidden in the DOM.
- **Request-time parts.** Anything that reads cookies, headers, `params`, `searchParams` or the clock sits inside `<Suspense>`. Clock reads come after `await connection()` (decision 26). No `Date.now()`, `new Date()`, `Math.random()` or `crypto.random*` while prerendering: new ids are made only in Server Actions. There's no `try`/`catch` round JSX: the React Compiler lint rejects it.
- **Data functions** take `now` from their caller, never read the clock, and hand out copies (D's "Store design").
- **Server Actions.** Read every field with F's `field(formData, name)` (a missing field or a file is `""`). Never take identity from a field: the staff member comes from `requireStaff()`, a student from `requireAccount()`. Check every id from a field with E's `isId` and look it up in the store. Call `redirect()` and `notFound()` outside any `try`. Every action ends with F's `done(path)` (`refresh()`, then a `replace` redirect); one that changed what buyers see calls `sellersChanged()`, `listingsChanged()`, `hubChanged()` or `pickupPointsChanged()` first, and one that changed something writes its audit entry (plan decision 6).
- **Forms.** Plain `<form action={serverAction} noValidate>`: `noValidate` so the server's messages show rather than the browser's bubbles; fields keep `required` where they're required, so it's announced. Every field has a `<label>` (a `<legend>` for radio groups); hints and errors join `aria-describedby`; an invalid field has `aria-invalid="true"`. Errors use D's `ErrorSummary` and `FieldError`.
- **User text.** Shop names, reasons, notes, report details, post titles, summaries and slot requests are React text, never `dangerouslySetInnerHTML`. Post bodies go through part B's `Markdown` component only.
- **Async components in tests.** jsdom can't render an async component inside a tree. Render `await Thing(props)` directly, or stand the async part in with `vi.mock`.
- **Server code in tests.** Use D's `tests/helpers/next-request.ts` for `next/headers`, `next/navigation`, `next/server` and `next/cache`; call `resetSampleStore()` and `resetRequest(request)` in `beforeEach`. Fake only the date: `vi.useFakeTimers({ toFake: ["Date"] })`, then `vi.setSystemTime(…)`. `tests/helpers/staff.ts` (Task 9) has `signedInAs(request, accountId)` and `form(fields)`.
- **JSX text.** The `react/no-unescaped-entities` rule is on: write `&apos;` for an apostrophe inside JSX text (a string in an attribute, a prop or `{"…"}` is fine). JSX drops the space at a line break next to a tag, so end a text line with `{" "}` when the next line starts with a tag.
- **Links.** Pages on this site use `Link` from `next/link`, with `prefetch={false}` on every link this plan adds (plan decision 19). A plain `<a href>` is for the CSV download and other websites. `@next/next/no-html-link-for-pages` doesn't fire in this repo: add no `eslint-disable` comment.
- **Accessible names.** Name computation trims each element's own text, so put spaces outside `sr-only` spans. Icons from `components/icons.tsx` are `aria-hidden`. A button or link that acts on one thing names it (spec 4): "Approve Tech corner", or "Review <span className="sr-only">Tech corner</span>" in a table row.
- **Contrast.**
  - Sky never carries text, icons or thin borders on white. Links on white are sky-dark; on panel and pale they're navy.
  - Danger red is 6.6:1 on white, and white on it is 6.6:1.
- **Motion.** Animate only `transform`/`opacity`. Hover effects only under `(hover: hover) and (pointer: fine)`. This plan adds no animation.
- **Tap targets.** At least 44 × 44px, with 8px between targets. Links inside a paragraph or a table cell's text are exempt (WCAG 2.5.8); row actions are buttons and links at 44px.
- **Class names.** New classes start with `staff-`, `hub-book-` or `hub-rsvp-`. Before adding one, check it isn't taken: `grep -n "\.<name>\b" app/globals.css`.
- **CSS placement.**
  - New CSS goes at the end of `app/globals.css`, inside `@layer components`, under a banner: `/* --- Staff tools: <name> (staff tools plan, Task N, spec x) --- */`.
  - Never put `!important` on a transition or animation property: the motion off-switches rely on it.
- **Hidden pages in tests.** In e2e tests, find things with `getByRole`/`getByLabel` and `.filter({ visible: true })`; a CSS locator also counts the kept copies.
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Handing over.** Implementers don't run `git add` or `git commit`. The last step of each task lists the files and the commit message. The controller then:
  1. runs `git status --short` on its own, and checks that only the listed files changed (and `.claude/launch.json`, which is never staged);
  2. runs `git add` with the listed files;
  3. runs `git commit` with the given message, ending with a blank line and `Co-Authored-By: <model> <noreply@anthropic.com>`.
  - One git command per tool call.
- **Looking at it.** Check visually on a production build (`pnpm build`, then `pnpm start --port 3201`) at 390 × 844, 768 × 1024 and 1280 × 800, using a throwaway Playwright script in your scratchpad. Stop the server afterwards (it's yours, not an install or build).
- **Measuring JS.** `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390` builds, starts its own server on 3200, and prints one line per page, such as `listing page: {"script":…,"scriptBrotli":…}`. Record `scriptBrotli`.

## File map (end of this plan)

New files are marked **+**, changed **~**.

```
app/
  admin/page.tsx  admin/sellers/page.tsx  admin/sellers/[slug]/page.tsx              + (Task 11)
  admin/sellers/[slug]/decline/page.tsx  admin/sellers/[slug]/pause/page.tsx        + (Task 11)
  admin/reports/page.tsx  admin/reports/[id]/page.tsx                               + (Task 12)
  admin/reports/[id]/hide/page.tsx  admin/reports/[id]/pause/page.tsx               + (Task 12)
  admin/featured/page.tsx  admin/pickup-points/page.tsx  admin/audit/page.tsx       + (Task 13)
  hub/manage/page.tsx  hub/new/page.tsx  hub/[id]/edit/page.tsx                     + (Task 14)
  hub/[id]/book/page.tsx                                                            + (Task 15)
  mentor/page.tsx  mentor/[slug]/page.tsx  mentor/export/route.ts  route.test.ts    + (Task 16)
  robots.ts  robots.test.ts                    ~ /hub/*/book (Task 15)
  trust/page.tsx  page.test.tsx                ~ Verified, badges, Featured (Task 19)
  privacy/page.tsx  page.test.tsx              ~ notes, the staff log, slot requests (Task 19)
  globals.css                                  ~ staff banners (Tasks 9 to 16, 18)
components/
  staff/StaffFrame.tsx  StaffSkeleton.tsx  StaffTable.tsx  ConfirmAction.tsx  staff-parts.test.tsx   + (Task 9)
  staff/AdminOverview.tsx  AdminSellers.tsx  AdminSeller.tsx  SellerConfirm.tsx  (+ tests)   + (Task 11)
  staff/AdminReports.tsx  AdminReport.tsx  ReportConfirm.tsx  (+ tests)             + (Task 12)
  staff/AdminFeatured.tsx  AdminPickupPoints.tsx  AdminAudit.tsx  (+ tests)         + (Task 13)
  staff/HubManage.tsx  PostEditor.tsx  (+ tests)                                    + (Task 14)
  staff/MentorDashboard.tsx  MentorShop.tsx  (+ tests)                              + (Task 16)
  hub/PostAction.tsx  PostAction.test.tsx      ~ RSVP and Request a slot (Task 15)
  hub/BookSlot.tsx  BookSlot.test.tsx          + (Task 15)
  sell/ShopDeclined.tsx  (+ test)              + (Task 18)
  sell/SellHome.tsx  Dashboard.tsx  MyListingsView.tsx  (+ tests)   ~ declined, Hub pause, hidden (Task 18)
  account/AccountView.tsx  AccountView.test.tsx                     ~ staff rows (Task 18)
  messages/NotificationsView.tsx  NotificationsView.test.tsx        ~ two kinds (Task 18)
  listing/ListingView.tsx  ListingView.test.tsx                     ~ a retired point (Task 17)
  home/FeaturedToday.test.tsx                                      ~ a fresh store, and a pin (Task 17)
lib/
  types.ts                                     ~ staff types (Task 1)
  featured.ts  featured.test.ts                ~ pins and the week's break (Task 3)
  selling/badges.ts  badges.test.ts            ~ earnedBadge (Task 3)
  selling/shop-actions.ts  shop-actions.test.ts                     ~ Send for approval again (Task 18)
  staff/roles.ts  paths.ts  rules.ts  errors.ts  notices.ts  audit-words.ts  notification-text.ts  (+ tests)   + (Task 2)
  staff/mentor.ts  post-rules.ts  (+ tests)    + (Task 3)
  staff/access.ts  access.test.ts  form-state.ts  form-state.test.ts   + (Task 9; postPrefix in Task 14)
  staff/admin-actions.ts  admin-actions.test.ts                     + (Task 10)
  staff/hub-actions.ts  hub-actions.test.ts                         + (Task 14)
  hub-actions.ts  hub-actions.test.ts                               + (Task 15)
  staff/mentor-actions.ts  mentor-actions.test.ts                   + (Task 16)
  messaging/paths.ts  paths.test.ts            ~ back links for staff and booking pages (Task 15)
  messaging/actions.ts  actions.test.ts        ~ badges after a reply or a confirmed sale (Task 17)
  data/rows.ts  store.ts  store.test.ts        ~ eight tables, four optional fields (Task 1)
  data/tags.ts  audit.ts  staff-shops.ts  (+ tests)                 ~ / + (Task 4)
  data/catalog.ts  catalog.test.ts  shops.ts  shops.test.ts         ~ hidden listings, Hub pauses (Task 4); retired points' names (Task 6)
  data/own-listings.ts  own-listings.test.ts                       ~ a hidden listing stays hidden when edited (Task 4)
  data/staff-reports.ts  badges.ts  (+ tests)  shop-stats.ts  shop-stats.test.ts   + / ~ (Task 5)
  data/featured.ts  pickup-points.ts  (+ tests)                     + (Task 6)
  data/index.ts  index.test.ts                 ~ Featured, pickup points (Task 6), Hub posts (Task 7)
  data/hub-posts.ts  hub-posts.test.ts                              + (Task 7)
  data/mentors.ts  staff-privacy.ts  (+ tests)                      + (Task 8)
  data/accounts.ts  accounts.test.ts           ~ deletion and export (Task 8)
  auth/actions.ts  account-actions.test.ts     ~ hubChanged() after deleting an account (Task 8)
data/fixtures/
  staff.ts  staff.test.ts                      + (Task 1)
  accounts.ts                                  ~ Sipho's mentor (Task 1)
tests/helpers/staff.ts                         + (Task 9)
playwright.config.ts                           ~ the staff-writes project (Task 20)
tests/e2e/
  helpers/staff.ts  staff.spec.ts  staff-writes.spec.ts             + (Task 20)
  shopping.spec.ts  selling.spec.ts  community.spec.ts  routes.spec.ts   ~ (Tasks 15 and 20)
  performance.spec.ts                          ~ a Hub event and Hub office hours (Task 15)
  staff-checks.spec.ts                         + axe, layout shift, staff pages' JS (Task 21)
  screenshots.spec.ts                          ~ (Task 22)
docs/PROGRESS.md  docs/progress/staff/  docs/reference/GO-LIVE.md  docs/reference/LANDING-DECISIONS.md
CLAUDE.md  the spec  this plan                 ~ / + (Task 22)
```

Each `*.test.ts(x)` sits next to the file it tests.

## Where each spec decision is built

| Spec | Built in |
|---|---|
| 2.1 Staff pages under `/admin`, `/hub/manage` and `/mentor`, a server role check, the 404 for others, sign-in first | Task 2 (`canUse`), Task 9 (`requireStaff`, `staffMetadata`, plan decision 1), every page in Tasks 11 to 16; end to end in Task 20 |
| 2.2 Every staff action a Server Action with an audit entry; the log can't be edited | Task 4 (`recordAudit`), Tasks 10, 14 and 16 (the actions), Task 13 (the log), plan decision 6 |
| 2.3 The admin console: Overview, Sellers, Reports, Featured, Pickup points, Audit log | Tasks 4 to 6 (data), Task 10 (actions), Tasks 11 to 13 (pages) |
| 2.4 The Hub's tools: fields, preview, the office-hours queue | Task 3 (`post-rules.ts`), Task 7 (data), Task 14 (plan decisions 11, 12 and 14) |
| 2.5 RSVP and Request a slot for signed-in visitors | Task 7 (data), Task 15 (plan decision 13) |
| 2.6 The mentor dashboard, a seller's notes and check-ins, the CSV, assignments | Task 3 (flags, CSV), Task 8 (data), Task 10 (assignment), Task 16 (plan decisions 15 to 17) |
| 2.7 Trust badges from the store, on Overview and after replies and confirmed sales | Task 3 (`earnedBadge`), Task 5 (`recalculateBadges`), Task 11 (Overview), Task 17 (E's actions), plan decision 8 |
| 2.8 Featured: pins, approved and unpaused shops with something listed, the week's break, draws recorded | Task 3 (`drawFeatured`), Task 6 (`featuredFor`, pins), Task 13 (the admin page), Task 17 (the homepage), plan decision 9 |
| 2.9 Desktop-first, stacked rows on phones, form buttons only, confirm pages | Task 9 (frame, tables, confirm), Tasks 11 to 16; plan decisions 18 and 20 |
| 3 Screens, `noindex`, per request inside `<Suspense>`, one staff frame | Tasks 9 and 11 to 16 |
| 4 Accessibility | Tasks 9 to 16; axe in Task 21 |
| 5 Performance | Tasks 15, 17, 18 and 21 (the ledger) |
| 6 Testing | Unit tests in every task; end to end in Task 20; axe, layout shift and size in Task 21 |
| 7 Not in this stage | Task 22 (the checklist), plan decision 24 |
| Selling spec 8.10: the trust page's Verified wording | Task 19 |

---

### Task 1: Staff types, the seeds and the store's eight tables

The shapes the rest of the plan uses, the fixtures as rows (pickup points and Hub posts, plan decisions 10 and 11), Naledi's two sample entries and Thandi's sample slot request, and the eight tables in the store ("Store design"). Nothing reads them yet.

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/data/rows.ts`
- Create: `data/fixtures/staff.ts`, `data/fixtures/staff.test.ts`
- Modify: `data/fixtures/accounts.ts`
- Modify: `lib/data/store.ts`, `lib/data/store.test.ts`

- [ ] **Step 1: Record where things start**

Work through "Recheck before starting" first. Then run, one after another: `git status --short`, `pnpm test`, `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`.
Expected: `git status` shows only ` M .claude/launch.json`. Note the unit test count and the `scriptBrotli` figures for the homepage, browse, the listing page, the storefront, `/sell` and the Hub post, and write them, the e2e counts from `docs/PROGRESS.md` and the stop line you'll use into the ledger's "Start" row. If a page is already past the stop line, stop here and report.

- [ ] **Step 2: Add the staff types**

In `lib/types.ts`, replace E's `NotificationKind` and its comment (`/** What a notification is about (messaging spec 2.9). This stage makes the first two; stage G makes the others. */` and the line after it) with:

```ts
/**
 * What a notification is about (messaging spec 2.9; staff tools plan decision 7). Messaging makes the first two; the
 * staff tools make the rest: a report's outcome, a shop's approval, the Hub's other decisions about a shop or a
 * listing ("shop-update"), and slot requests ("booking").
 */
export type NotificationKind =
  | "message"
  | "sale-to-confirm"
  | "report-handled"
  | "shop-approved"
  | "shop-update"
  | "booking";
```

In the `PickupPoint` type, after `name: string;`, add:

```ts
  /** True once the Hub has retired it (staff tools spec 2.3): listings keep it, marked "no longer used". */
  retired?: boolean;
```

Then append to the end of the file:

```ts

// --- Staff tools (staff tools plan, Task 1) ------------------------------------------------------------------------

/** The three staff areas (staff tools spec 2.1): the admin console, the Hub's tools and the mentor dashboard. */
export type StaffArea = "admin" | "hub" | "mentor";

/** What a staff action did (staff tools spec 2.2): one per audit entry. */
export type AuditAction =
  | "shop-approved"
  | "shop-declined"
  | "shop-verified"
  | "shop-unverified"
  | "shop-paused"
  | "shop-resumed"
  | "mentor-assigned"
  | "mentor-removed"
  | "report-dismissed"
  | "listing-hidden"
  | "featured-pinned"
  | "featured-unpinned"
  | "point-added"
  | "point-renamed"
  | "point-retired"
  | "point-restored"
  | "post-created"
  | "post-updated"
  | "booking-accepted"
  | "booking-declined"
  | "note-added"
  | "check-in-added";

/** The audit log's filter by kind (staff tools spec 2.3). Each action belongs to one (lib/staff/audit-words.ts). */
export type AuditKind = "shops" | "reports" | "featured" | "pickup-points" | "posts" | "office-hours" | "mentoring";

/** What an audit entry is about. */
export type AuditTargetKind = "shop" | "listing" | "report" | "pickup-point" | "post" | "booking";

/** One line of the audit log (staff tools spec 2.2): who, what, the target, the reason or detail, and when. */
export type AuditEntry = {
  id: string;
  /** ISO 8601 in UTC; shown in SAST. */
  at: string;
  /** The staff member's account, or null once it's deleted. */
  staffId: string | null;
  /** Their first name when they acted, or "Deleted account". */
  staffName: string;
  action: AuditAction;
  targetKind: AuditTargetKind;
  /** The target's name when it happened ("Tech corner", a listing's title), or "Deleted account" (plan decision 6). */
  targetName: string;
  /** The reason or note, or "" when there was none. */
  detail: string;
};

/** What the Hub did about a report (staff tools spec 2.3). */
export type ReportOutcome = "dismissed" | "hidden" | "paused";

/** Where a slot request stands (staff tools spec 2.4 and 2.5). */
export type BookingStatus = "open" | "accepted" | "declined";

/** A slot request, as the office-hours queue and the student's booking page show it (plan decisions 13 and 14). */
export type HubBooking = {
  id: string;
  postId: string;
  /** The office hours' title. */
  postTitle: string;
  /** When the office hours start, ISO 8601 in UTC. */
  startsAt: string | null;
  /** The student's first name, or "Deleted account". */
  studentName: string;
  /** What they'd like help with, up to 300 characters. */
  help: string;
  /** A time that suits, up to 100 characters. */
  time: string;
  status: BookingStatus;
  createdAt: string;
};

/** A mentor's flags on a shop (staff tools spec 2.6, plan decision 15). */
export type MentorFlag = "no-enquiries" | "slow-replies" | "paused";

/** A row of the mentor dashboard (staff tools spec 2.6, plan decision 15). */
export type MentoredShop = {
  slug: string;
  name: string;
  campusSlug: string;
  /** The owner's first name. */
  ownerName: string;
  /** The owner's account, which notes and check-ins are about (plan decision 16). */
  ownerId: string;
  badge: TrustBadge | null;
  status: SellerStatus;
  mentorId: string;
  mentorName: string;
  /** The last 14 days (plan decision 15). */
  counts: EnquiryCounts;
  flags: MentorFlag[];
};
```

- [ ] **Step 3: Add the row types**

In `lib/data/rows.ts`, add `AuditAction`, `AuditTargetKind`, `BookingStatus`, `HubPost` and `ReportOutcome` to the `import type { … } from "@/lib/types";` block at the top, keeping the names in alphabetical order.

In D's `SellerProfileRow`, after `appliedAt: string;`, add:

```ts
  /** When the Hub declined the application (staff tools plan decision 2). Absent or null while it hasn't. */
  declinedAt?: string | null;
  /** Who paused a paused shop (staff tools plan decision 3): a seller can only resume their own pause. */
  pausedBy?: "seller" | "staff" | null;
  /** The Hub's reason for a decline or a pause, which the seller sees. */
  staffReason?: string | null;
  /** The mentor assigned to the shop (staff tools spec 2.6). Absent or null when there's none. */
  mentorId?: string | null;
```

In F's `ListingRow`, after `updatedAt: string;`, add:

```ts
  /** Why the Hub hid it (staff tools spec 2.3, plan decision 4). Absent or null while it isn't hidden. */
  hiddenReason?: string | null;
  hiddenAt?: string | null;
```

In E's `ReportRow`, after `createdAt: string;`, add:

```ts
  /** What the Hub did (staff tools spec 2.3), once it's closed. */
  outcome?: ReportOutcome | null;
  /** The dismissal's note, or the hide's or pause's reason. */
  note?: string | null;
  closedAt?: string | null;
  /** The staff member who closed it, or null once their account is deleted. */
  closedBy?: string | null;
```

The new fields are optional, so D's, E's and F's rows and seeds need no change. Then append to the end of the file:

```ts

// --- Staff tools (staff tools plan, Task 1; "Store design") ------------------------------------------------------

/**
 * One staff action (staff tools spec 2.2, plan decision 6). Only lib/data/audit.ts adds them, and nothing changes one,
 * except deleting an account, which forgets the person in it (lib/data/staff-privacy.ts).
 */
export type AuditRow = {
  id: string;
  at: string;
  staffId: string | null;
  staffName: string;
  action: AuditAction;
  targetKind: AuditTargetKind;
  /** A shop's slug, or a listing's, report's, pickup point's, post's or slot request's id; "" once forgotten. */
  targetId: string;
  targetName: string;
  detail: string;
  /** The student it was about (a shop's owner, a reporter, a slot request's student), or null. */
  subjectId: string | null;
};

/** A seller pinned to one campus's Featured row for one day (staff tools spec 2.8). */
export type FeaturedPinRow = {
  id: string;
  sellerSlug: string;
  /** A campus slug, or "all" for visitors who haven't chosen one. */
  campusSlug: string;
  /** YYYY-MM-DD in South Africa. */
  day: string;
  /** The admin who pinned it, or null once their account is deleted. */
  pinnedBy: string | null;
  createdAt: string;
};

/** A campus's Featured row as first shown on a day (plan decision 9), keyed by `${campusSlug}:${day}`. */
export type FeaturedDrawRow = {
  key: string;
  campusSlug: string;
  day: string;
  /** In the row's order, pins first. */
  sellerSlugs: string[];
};

/** An approved place to hand things over (staff tools spec 2.3), keyed by id. */
export type PickupPointRow = {
  id: string;
  campusSlug: string;
  /** 2 to 60 characters, unique on its campus. */
  name: string;
  /** When it was retired, or null while it's in use. */
  retiredAt: string | null;
  createdAt: string;
};

/** A mentor's note or check-in about a shop's owner (staff tools spec 2.6, plan decision 16). */
export type MentorNoteRow = {
  id: string;
  /** The shop owner's account. */
  ownerId: string;
  kind: "note" | "check-in";
  /** A check-in's date, YYYY-MM-DD in South Africa; null for a note. */
  checkInOn: string | null;
  text: string;
  /** Who wrote it, or null once their account is deleted. */
  authorId: string | null;
  /** Their first name then, or "Deleted account". */
  authorName: string;
  createdAt: string;
};

/**
 * A Hub post in the store (staff tools spec 2.4, plan decision 11): part B's HubPost with its draft state and author.
 * For an event, `going` is the count before anyone said they're going on Vossie (the samples' numbers, 0 for a new
 * post); pages add the RSVPs (plan decision 13).
 */
export type HubPostRow = Omit<HubPost, "publishedAt"> & {
  /** False while it's a draft: only staff see it (staff tools spec 2.4). */
  published: boolean;
  /** When it was first published, or null while it never has been. */
  publishedAt: string | null;
  /** The staff member who wrote it, or null for a sample post or once their account is deleted. */
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A student going to an event (staff tools spec 2.5), keyed by `${postId}:${accountId}`. */
export type HubRsvpRow = {
  key: string;
  postId: string;
  accountId: string;
  createdAt: string;
};

/** A request for an office-hours slot (staff tools spec 2.5), keyed by id ("bk-" and a UUID). */
export type HubBookingRow = {
  id: string;
  postId: string;
  accountId: string;
  /** What they'd like help with, up to 300 characters. */
  help: string;
  /** A time that suits, up to 100 characters. */
  time: string;
  status: BookingStatus;
  createdAt: string;
  answeredAt: string | null;
  /** The staff member who answered, or null. */
  answeredBy: string | null;
};
```

- [ ] **Step 4: Write the seeds' test**

Create `data/fixtures/staff.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sampleAccounts } from "./accounts";
import { hubPosts } from "./hub";
import { pickupPoints } from "./pickup-points";
import { sampleHubBookings, sampleHubPostRows, sampleMentorNotes, samplePickupPointRows } from "./staff";

const accounts = new Map(sampleAccounts.map((sample) => [sample.account.id, sample]));

describe("the staff tools' seeds (staff tools plan, Task 1)", () => {
  it("turns every pickup point into a row in use, with the same id, campus and name", () => {
    expect(samplePickupPointRows.map(({ id, campusSlug, name }) => ({ id, campusSlug, name }))).toEqual(
      pickupPoints.map(({ id, campusSlug, name }) => ({ id, campusSlug, name })),
    );
    expect(samplePickupPointRows.every((row) => row.retiredAt === null)).toBe(true);
  });

  it("turns every Hub post into a published row, and gives Midrand's office hours to Naledi (plan decision 11)", () => {
    expect(sampleHubPostRows.map((row) => row.id)).toEqual(hubPosts.map((post) => post.id));
    expect(sampleHubPostRows.every((row) => row.published && row.publishedAt === row.createdAt)).toBe(true);
    const nalediPosts = sampleHubPostRows.filter((row) => row.authorId === "acc-mentor").map((row) => row.id);
    expect(nalediPosts).toEqual(["h-002", "h-007", "h-012"]);
    for (const id of nalediPosts) {
      expect(hubPosts.find((post) => post.id === id)).toMatchObject({ kind: "office-hours", campusSlug: "midrand" });
    }
    const pitchNight = sampleHubPostRows[0];
    expect(pitchNight).toMatchObject({ ...hubPosts[0], authorId: null, published: true });
  });

  it("writes Naledi's entries about the owner of the shop she mentors (plan decision 16)", () => {
    expect(sampleMentorNotes.map((row) => row.kind)).toEqual(["check-in", "note"]);
    for (const note of sampleMentorNotes) {
      const author = accounts.get(note.authorId ?? "");
      expect(author?.account.roles, note.id).toContain("mentor");
      expect(note.authorName, note.id).toBe(author?.account.firstName);
      const owner = accounts.get(note.ownerId);
      expect(owner?.seller, note.id).toMatchObject({ status: "approved", mentorId: note.authorId });
      if (note.kind === "check-in") expect(note.checkInOn, note.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      else expect(note.checkInOn, note.id).toBeNull();
    }
  });

  it("asks for a slot at Midrand's office hours as Thandi, still open", () => {
    expect(sampleHubBookings).toHaveLength(1);
    const [booking] = sampleHubBookings;
    expect(booking).toMatchObject({ postId: "h-007", accountId: "acc-student", status: "open", answeredAt: null });
    expect(hubPosts.find((post) => post.id === booking.postId)?.kind).toBe("office-hours");
    expect([...booking.help].length).toBeLessThanOrEqual(300);
    expect([...booking.time].length).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 5: Run it to make sure it fails**

Run: `pnpm test data/fixtures/staff.test.ts`
Expected: FAIL, because `./staff` doesn't exist.

- [ ] **Step 6: Write the seeds, and give Sipho's shop its mentor**

Create `data/fixtures/staff.ts`:

```ts
import type { HubBookingRow, HubPostRow, MentorNoteRow, PickupPointRow } from "@/lib/data/rows";
import { hubPosts } from "./hub";
import { pickupPoints } from "./pickup-points";

// The staff tools' seeds (staff tools plan, Task 1; "Store design"): the pickup points and the Hub's posts as rows, so
// staff can change them (plan decisions 10 and 11), Naledi's two sample entries about Sipho's shop, and Thandi's
// sample slot request. Fixtures import nothing from lib at run time; these read the other fixtures. The words are
// samples for Lama to change (plan decision 22).

/** Midrand's office hours, which the seed gives to Naledi (acc-mentor), so her pages have something in them. */
const NALEDIS_POSTS: ReadonlySet<string> = new Set(["h-002", "h-007", "h-012"]);

/** When the sample pickup points were approved: before any sample listing. */
const POINTS_SINCE = "2025-01-15T08:00:00.000Z";

export const samplePickupPointRows: readonly PickupPointRow[] = pickupPoints.map((point) => ({
  id: point.id,
  campusSlug: point.campusSlug,
  name: point.name,
  retiredAt: null,
  createdAt: POINTS_SINCE,
}));

export const sampleHubPostRows: readonly HubPostRow[] = hubPosts.map((post) => ({
  ...post,
  image: { ...post.image },
  published: true,
  authorId: NALEDIS_POSTS.has(post.id) ? "acc-mentor" : null,
  createdAt: post.publishedAt,
  updatedAt: post.publishedAt,
}));

/** Naledi's check-in and note about Sipho (acc-seller), whose shop she mentors (data/fixtures/accounts.ts). */
export const sampleMentorNotes: readonly MentorNoteRow[] = [
  {
    id: "mn-s1",
    ownerId: "acc-seller",
    kind: "check-in",
    checkInOn: "2026-10-06",
    text: "Met Sipho at the Hub. We priced his calculators against new ones, and he'll list two more by Friday.",
    authorId: "acc-mentor",
    authorName: "Naledi",
    createdAt: "2026-10-06T12:30:00.000Z",
  },
  {
    id: "mn-s2",
    ownerId: "acc-seller",
    kind: "note",
    checkInOn: null,
    text: "Replies fast. Next: photos on a plain background, and a listing for the headset's case.",
    authorId: "acc-mentor",
    authorName: "Naledi",
    createdAt: "2026-10-13T15:10:00.000Z",
  },
];

/** Thandi's request for a slot at "Office hours: your first listing" (h-007), still waiting for an answer. */
export const sampleHubBookings: readonly HubBookingRow[] = [
  {
    id: "bk-s1",
    postId: "h-007",
    accountId: "acc-student",
    help: "I want to sell my braiding on Vossie and don't know how to write the listing or what to charge.",
    time: "Any time after 13:30",
    status: "open",
    createdAt: "2026-10-13T10:15:00.000Z",
    answeredAt: null,
    answeredBy: null,
  },
];
```

In `data/fixtures/accounts.ts`, replace Sipho's seller profile line

```ts
    seller: { accountId: "acc-seller", status: "approved", sellerSlug: "tech-corner", appliedAt: "2026-03-02T09:40:00.000Z" },
```

with

```ts
    seller: {
      accountId: "acc-seller",
      status: "approved",
      sellerSlug: "tech-corner",
      appliedAt: "2026-03-02T09:40:00.000Z",
      // Naledi mentors Sipho's shop, so the mentor dashboard has a shop (staff tools plan, Task 1).
      mentorId: "acc-mentor",
    },
```

Run: `pnpm test data/fixtures`
Expected: PASS (the 4 new tests, and the accounts fixture's tests unchanged: they match the profile with `toMatchObject`).

- [ ] **Step 7: Add the store's test**

In `lib/data/store.test.ts`:
1. Add `import { sampleHubPostRows } from "@/data/fixtures/staff";` among the fixture imports, in alphabetical order.
2. In the "is seeded with …, and nothing else" test (F Task 1 renamed it), add these lines after F's `expect(store.onboardingDrafts.size).toBe(0);`, and rename the test "is seeded with the sample accounts, their consents, their shops, the sample conversations, the sample listings and the staff tools' seeds, and nothing else":

```ts
    expect(store.auditLog.size).toBe(0);
    expect(store.featuredPins.size).toBe(0);
    expect(store.featuredDraws.size).toBe(0);
    expect(store.pickupPoints.size).toBe(24);
    expect([...store.mentorNotes.keys()]).toEqual(["mn-s1", "mn-s2"]);
    expect(store.hubPosts.size).toBe(18);
    expect(store.hubRsvps.size).toBe(0);
    expect([...store.hubBookings.keys()]).toEqual(["bk-s1"]);
```

3. Add this test after F's "copies the sample shops and listings too (selling plan, Task 1)":

```ts

  it("copies the staff tools' seeds too (staff tools plan, Task 1)", () => {
    sampleStore().hubPosts.get("h-001")!.title = "Changed";
    sampleStore().pickupPoints.get("pp-midrand-library")!.retiredAt = "2026-10-14T08:00:00.000Z";
    expect(sampleHubPostRows[0].title).toBe("Pitch night");
    expect(resetAndRead().pickupPoints.get("pp-midrand-library")?.retiredAt).toBeNull();
    expect(sampleStore().hubPosts.get("h-001")?.title).toBe("Pitch night");
  });
```

(`resetAndRead()` is the helper E Task 1 added below the `describe`.)

- [ ] **Step 8: Run it to make sure it fails**

Run: `pnpm test lib/data/store.test.ts`
Expected: FAIL: the store has none of the eight tables.

- [ ] **Step 9: Add the tables**

In `lib/data/store.ts`:
1. Add `import { sampleHubBookings, sampleHubPostRows, sampleMentorNotes, samplePickupPointRows } from "@/data/fixtures/staff";` among the fixture imports, in alphabetical order.
2. In the `import type { … } from "./rows";` list, add `AuditRow`, `FeaturedDrawRow`, `FeaturedPinRow`, `HubBookingRow`, `HubPostRow`, `HubRsvpRow`, `MentorNoteRow` and `PickupPointRow`, keeping the names in alphabetical order.
3. In the `SampleStore` type, after F's `onboardingDrafts` field, add:

```ts
  /** By id: every staff action (staff tools spec 2.2). Only lib/data/audit.ts adds to it. */
  auditLog: Map<string, AuditRow>;
  /** By id: sellers pinned to a campus's Featured row for a day (staff tools spec 2.8). */
  featuredPins: Map<string, FeaturedPinRow>;
  /** By `${campusSlug}:${day}`: each campus's Featured row as first shown that day (staff tools plan decision 9). */
  featuredDraws: Map<string, FeaturedDrawRow>;
  /** By id: the approved pickup points, retired ones included (staff tools spec 2.3). */
  pickupPoints: Map<string, PickupPointRow>;
  /** By id: mentors' notes and check-ins (staff tools spec 2.6). */
  mentorNotes: Map<string, MentorNoteRow>;
  /** By id: the Hub's posts, drafts included (staff tools spec 2.4). */
  hubPosts: Map<string, HubPostRow>;
  /** By `${postId}:${accountId}`: who's going to an event (staff tools spec 2.5). */
  hubRsvps: Map<string, HubRsvpRow>;
  /** By id: office-hours slot requests (staff tools spec 2.5). */
  hubBookings: Map<string, HubBookingRow>;
```

4. Add one to `STORE_VERSION` (from 3 to 4 if F left it at 3), so `next dev` reseeds a store made before the new tables.
5. In `seedStore()`, after F's `onboardingDrafts: new Map(),` line, add:

```ts
    // The staff tools' seeds (staff tools plan, Task 1). Copies, like the rest.
    auditLog: new Map(),
    featuredPins: new Map(),
    featuredDraws: new Map(),
    pickupPoints: new Map(structuredClone(samplePickupPointRows).map((row) => [row.id, row])),
    mentorNotes: new Map(structuredClone(sampleMentorNotes).map((row) => [row.id, row])),
    hubPosts: new Map(structuredClone(sampleHubPostRows).map((row) => [row.id, row])),
    hubRsvps: new Map(),
    hubBookings: new Map(structuredClone(sampleHubBookings).map((row) => [row.id, row])),
```

Run: `pnpm test lib/data/store.test.ts data/fixtures`
Expected: PASS.

- [ ] **Step 10: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 5 more unit tests than at the start (4 in the seeds' test, 1 in the store's). Typecheck finds nothing new: E's `KindIcon` (`components/messages/NotificationsView.tsx`) draws no icon for the two new kinds until Task 18, which TypeScript allows (the repo doesn't set `noImplicitReturns`); if it does complain, add `default: return null;` to that `switch` and list it in the hand-over.

- [ ] **Step 11: Hand over for commit**

Files: `lib/types.ts`, `lib/data/rows.ts`, `data/fixtures/staff.ts`, `data/fixtures/staff.test.ts`, `data/fixtures/accounts.ts`, `lib/data/store.ts`, `lib/data/store.test.ts`.
Message: `feat: staff types; the pickup points and Hub posts as rows, Naledi's sample notes and Thandi's sample slot request; the audit log, Featured pins and draws, pickup points, mentor notes, Hub posts, RSVPs and slot requests in the sample store (staff tools spec 2 and 3)`

---

### Task 2: Staff rules and words: roles, addresses, limits, errors, notices, the log's words and the notifications' sentences

Plain modules with no store and no Next API (spec 2.1 to 2.6; plan decisions 18, 22 and 23): who may use which area, every staff address, the limits and checks, the error words, the notices after an action, the audit log's words and kinds, and the sentences staff actions send.

**Files:**
- Create: `lib/staff/roles.ts`, `lib/staff/roles.test.ts`
- Create: `lib/staff/paths.ts`, `lib/staff/paths.test.ts`
- Create: `lib/staff/rules.ts`, `lib/staff/rules.test.ts`
- Create: `lib/staff/errors.ts`, `lib/staff/errors.test.ts`
- Create: `lib/staff/notices.ts`, `lib/staff/notices.test.ts`
- Create: `lib/staff/audit-words.ts`, `lib/staff/audit-words.test.ts`
- Create: `lib/staff/notification-text.ts`, `lib/staff/notification-text.test.ts`

- [ ] **Step 1: Write the roles' and the addresses' tests**

Create `lib/staff/roles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canUse, isAdmin, staffAreasOf } from "./roles";

const student = { roles: [] as const };
const mentor = { roles: ["mentor"] as const };
const admin = { roles: ["admin"] as const };

describe("who may use the staff areas (staff tools spec 2.1)", () => {
  it("lets only an admin into the admin console", () => {
    expect(canUse(admin, "admin")).toBe(true);
    expect(canUse(mentor, "admin")).toBe(false);
    expect(canUse(student, "admin")).toBe(false);
  });

  it("lets a mentor or an admin into the Hub's tools and the mentor dashboard", () => {
    for (const area of ["hub", "mentor"] as const) {
      expect(canUse(mentor, area), area).toBe(true);
      expect(canUse(admin, area), area).toBe(true);
      expect(canUse(student, area), area).toBe(false);
    }
  });

  it("never lets a signed-out visitor in", () => {
    expect(canUse(null, "hub")).toBe(false);
  });

  it("lists an account's areas in the account page's order", () => {
    expect(staffAreasOf(admin)).toEqual(["admin", "hub", "mentor"]);
    expect(staffAreasOf(mentor)).toEqual(["hub", "mentor"]);
    expect(staffAreasOf(student)).toEqual([]);
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(mentor)).toBe(false);
  });
});
```

Create `lib/staff/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  adminReportPath,
  adminSellerPath,
  AREA_HOME,
  auditPath,
  bookSlotPath,
  declineSellerPath,
  editPostPath,
  hideReportedPath,
  mentorShopPath,
  pauseReportedPath,
  pauseSellerPath,
  STAFF_SECTIONS,
} from "./paths";

describe("the staff pages' addresses (staff tools spec section 3)", () => {
  it("puts every page under /admin, /hub or /mentor", () => {
    expect(adminSellerPath("tech-corner")).toBe("/admin/sellers/tech-corner");
    expect(declineSellerPath("tech-corner")).toBe("/admin/sellers/tech-corner/decline");
    expect(pauseSellerPath("tech-corner")).toBe("/admin/sellers/tech-corner/pause");
    expect(adminReportPath("rep-1")).toBe("/admin/reports/rep-1");
    expect(hideReportedPath("rep-1")).toBe("/admin/reports/rep-1/hide");
    expect(pauseReportedPath("rep-1")).toBe("/admin/reports/rep-1/pause");
    expect(editPostPath("h-001")).toBe("/hub/h-001/edit");
    expect(bookSlotPath("h-002")).toBe("/hub/h-002/book");
    expect(mentorShopPath("tech-corner")).toBe("/mentor/tech-corner");
  });

  it("filters the audit log by staff member and kind in the link (spec 2.3)", () => {
    expect(auditPath({ staff: null, kind: null })).toBe("/admin/audit");
    expect(auditPath({ staff: "acc-admin", kind: null })).toBe("/admin/audit?staff=acc-admin");
    expect(auditPath({ staff: "acc-admin", kind: "reports" })).toBe("/admin/audit?staff=acc-admin&kind=reports");
  });

  it("lists the frame's sections, the admin console's six first", () => {
    expect(STAFF_SECTIONS.map((section) => section.label)).toEqual([
      "Overview",
      "Sellers",
      "Reports",
      "Featured",
      "Pickup points",
      "Audit log",
      "Hub posts",
      "Mentoring",
    ]);
    expect(AREA_HOME.hub).toEqual({ href: "/hub/manage", label: "Hub posts and office hours" });
  });
});
```

- [ ] **Step 2: Write the limits' test**

Create `lib/staff/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  addDays,
  checkCheckInDay,
  checkDismissNote,
  checkHelp,
  checkMentorNote,
  checkPinDay,
  checkPointName,
  checkReason,
  checkTime,
  parseDay,
} from "./rules";

describe("the staff forms' limits (plan decisions 10, 13, 16 and 18)", () => {
  it("asks for a reason of up to 500 characters, tidied", () => {
    expect(checkReason("  Photos show someone else's work.  ")).toEqual({
      value: "Photos show someone else's work.",
      error: null,
    });
    expect(checkReason(" \n ").error).toBe("reason-missing");
    expect(checkReason("x".repeat(501)).error).toBe("reason-length");
    expect(checkReason("é".repeat(500)).error).toBeNull();
  });

  it("asks for a dismissal's note, and a mentor's note of up to 1,000 characters, keeping line breaks", () => {
    expect(checkDismissNote("").error).toBe("note-missing");
    expect(checkDismissNote("x".repeat(501)).error).toBe("note-length");
    expect(checkMentorNote("Line one\r\nLine two")).toEqual({ value: "Line one\nLine two", error: null });
    expect(checkMentorNote("").error).toBe("mentor-note-missing");
    expect(checkMentorNote("x".repeat(1001)).error).toBe("mentor-note-length");
  });

  it("names a pickup point in 2 to 60 characters on one line", () => {
    expect(checkPointName("  Student\ncentre  ")).toEqual({ value: "Student centre", error: null });
    expect(checkPointName("").error).toBe("point-name-missing");
    expect(checkPointName("A").error).toBe("point-name-length");
    expect(checkPointName("x".repeat(61)).error).toBe("point-name-length");
  });

  it("asks a slot request for help of up to 300 characters, and an optional time of up to 100", () => {
    expect(checkHelp("").error).toBe("help-missing");
    expect(checkHelp("x".repeat(301)).error).toBe("help-length");
    expect(checkTime("")).toEqual({ value: "", error: null });
    expect(checkTime("x".repeat(101)).error).toBe("time-length");
  });

  it("reads a date as YYYY-MM-DD, only when it's a real day", () => {
    expect(parseDay("2026-10-14")).toBe("2026-10-14");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("14/10/2026")).toBeNull();
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-10-14", -6)).toBe("2026-10-08");
  });

  it("pins from today to 60 days ahead (plan decision 9)", () => {
    expect(checkPinDay("2026-10-14", "2026-10-14")).toEqual({ value: "2026-10-14", error: null });
    expect(checkPinDay("", "2026-10-14").error).toBe("day-missing");
    expect(checkPinDay("2026-10-13", "2026-10-14").error).toBe("day-past");
    expect(checkPinDay("2026-12-13", "2026-10-14").error).toBeNull();
    expect(checkPinDay("2026-12-14", "2026-10-14").error).toBe("day-far");
  });

  it("dates a check-in today or earlier", () => {
    expect(checkCheckInDay("2026-10-14", "2026-10-14").error).toBeNull();
    expect(checkCheckInDay("2026-10-15", "2026-10-14").error).toBe("check-in-day-future");
    expect(checkCheckInDay("nope", "2026-10-14").error).toBe("check-in-day-missing");
  });
});
```

- [ ] **Step 3: Write the error words', notices', log words' and sentences' tests**

Create `lib/staff/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { postFieldIds, staffErrors, staffFieldIds } from "./errors";

describe("the staff forms' error words (plan decision 22)", () => {
  it("words each code and links it to its field on this form", () => {
    expect(staffErrors(["reason-missing"], staffFieldIds("decline-crochet-corner"))).toEqual([
      { message: "Give a reason. The seller sees it.", fieldId: "decline-crochet-corner-reason" },
    ]);
    expect(staffErrors(["post-title-length"], postFieldIds("new-post"))).toEqual([
      { message: "Keep the title to 70 characters.", fieldId: "new-post-title" },
    ]);
  });

  it("keeps the codes' order, and leaves out codes it doesn't know", () => {
    const errors = staffErrors(["help-missing", "toString", "time-length"], staffFieldIds("book-h-002"));
    expect(errors.map((error) => error.fieldId)).toEqual(["book-h-002-help", "book-h-002-time"]);
  });

  it("gives a radio group's error to its first radio", () => {
    expect(postFieldIds("edit-h-001").kind).toBe("edit-h-001-kind-tip");
  });
});
```

Create `lib/staff/notices.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { staffNoticeText } from "./notices";

describe("what a page says after a staff action (spec 4, plan decision 23)", () => {
  it("words a known code, and says nothing for an unknown one", () => {
    expect(staffNoticeText("approved")).toBe("Approved. The shop is live, and its owner has been told.");
    expect(staffNoticeText("nothing")).toBe("Nothing changed. It was already done.");
    expect(staffNoticeText("rsvp")).toBe("You're going. See you there.");
    expect(staffNoticeText("toString")).toBeNull();
    expect(staffNoticeText(null)).toBeNull();
  });
});
```

Create `lib/staff/audit-words.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AuditAction } from "@/lib/types";
import { AUDIT_KINDS, auditKindOf, auditLabel, parseAuditFilter } from "./audit-words";

const EVERY_ACTION: AuditAction[] = [
  "shop-approved",
  "shop-declined",
  "shop-verified",
  "shop-unverified",
  "shop-paused",
  "shop-resumed",
  "mentor-assigned",
  "mentor-removed",
  "report-dismissed",
  "listing-hidden",
  "featured-pinned",
  "featured-unpinned",
  "point-added",
  "point-renamed",
  "point-retired",
  "point-restored",
  "post-created",
  "post-updated",
  "booking-accepted",
  "booking-declined",
  "note-added",
  "check-in-added",
];

describe("the audit log's words (staff tools spec 2.2 and 2.3)", () => {
  it("words every action and files it under one of the seven kinds", () => {
    const kinds = new Set(AUDIT_KINDS.map((item) => item.kind));
    for (const action of EVERY_ACTION) {
      expect(auditLabel(action), action).toMatch(/^[A-Z]/);
      expect(kinds.has(auditKindOf(action)), action).toBe(true);
    }
    expect(auditLabel("listing-hidden")).toBe("Hid a listing");
    expect(auditKindOf("booking-accepted")).toBe("office-hours");
  });

  it("reads the filters from the link, ignoring what it doesn't know", () => {
    expect(parseAuditFilter({ staff: "acc-admin", kind: "reports" })).toEqual({ staff: "acc-admin", kind: "reports" });
    expect(parseAuditFilter({ staff: ["acc-mentor", "acc-admin"], kind: "nope" })).toEqual({
      staff: "acc-mentor",
      kind: null,
    });
    expect(parseAuditFilter({ staff: "<script>" })).toEqual({ staff: null, kind: null });
  });
});
```

Create `lib/staff/notification-text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  listingHiddenText,
  reportOutcomeText,
  shopApprovedText,
  shopDecisionText,
  slotAnswerText,
  slotRequestedText,
} from "./notification-text";

describe("the sentences staff actions send (staff tools spec 2.3 and 2.4, plan decision 7)", () => {
  it("tells a seller about their shop, without the reason (it shows where the link goes)", () => {
    expect(shopApprovedText("Crochet corner")).toBe("The Hub approved Crochet corner. You can publish your listings now.");
    expect(shopDecisionText("declined", "Crochet corner")).toBe(
      "The Hub didn't approve Crochet corner yet. See why, and send it again.",
    );
    expect(shopDecisionText("paused", "Crochet corner")).toBe("The Hub paused Crochet corner. See why on your dashboard.");
    expect(shopDecisionText("resumed", "Crochet corner")).toBe("The Hub resumed Crochet corner. Buyers can see it again.");
    expect(shopDecisionText("verified", "Crochet corner")).toBe("Crochet corner is now Verified by the Hub.");
    expect(shopDecisionText("unverified", "Crochet corner")).toBe("Crochet corner is no longer Verified by the Hub.");
    expect(listingHiddenText("Desk lamp")).toBe("The Hub hid Desk lamp. See why in My listings.");
  });

  it("thanks a reporter in the spec's words", () => {
    expect(reportOutcomeText("acted", "Desk lamp")).toBe("Thanks, we've acted on your report about Desk lamp.");
    expect(reportOutcomeText("dismissed", "Desk lamp")).toBe(
      "We looked at your report about Desk lamp and didn't find a problem.",
    );
  });

  it("answers a slot request, and tells the office hours' author about a new one", () => {
    expect(slotAnswerText("accepted", "Office hours: your first listing")).toBe(
      "A mentor accepted your slot request for Office hours: your first listing.",
    );
    expect(slotAnswerText("declined", "Office hours: your first listing")).toBe(
      "A mentor couldn't fit in your slot request for Office hours: your first listing. You can ask again.",
    );
    expect(slotRequestedText("Thandi", "Office hours: your first listing")).toBe(
      "Thandi asked for a slot at Office hours: your first listing.",
    );
  });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test lib/staff`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 5: Write the roles and the addresses**

Create `lib/staff/roles.ts`:

```ts
import type { Account, StaffArea, StaffRole } from "@/lib/types";

// Who may use each staff area (staff tools spec 2.1): an admin for /admin; a mentor or an admin for the Hub's tools
// (/hub/manage, /hub/new, /hub/[id]/edit) and the mentor dashboard (/mentor). Plain functions, safe anywhere.

const AREA_ROLES: Readonly<Record<StaffArea, readonly StaffRole[]>> = {
  admin: ["admin"],
  hub: ["mentor", "admin"],
  mentor: ["mentor", "admin"],
};

const AREAS: readonly StaffArea[] = ["admin", "hub", "mentor"];

/** Whether `account` may use `area`. A signed-out visitor (null) never may. */
export function canUse(account: Pick<Account, "roles"> | null, area: StaffArea): boolean {
  return account !== null && account.roles.some((role) => AREA_ROLES[area].includes(role));
}

/** Admins see every assigned shop and edit any post; mentors see their own (plan decisions 11 and 15). */
export function isAdmin(account: Pick<Account, "roles">): boolean {
  return account.roles.includes("admin");
}

/** The staff areas the account may use, in the order the account page lists them (plan decision 19). */
export function staffAreasOf(account: Pick<Account, "roles">): StaffArea[] {
  return AREAS.filter((area) => canUse(account, area));
}
```

Create `lib/staff/paths.ts`:

```ts
import type { AuditKind, StaffArea } from "@/lib/types";

// The staff pages' addresses (staff tools spec section 3). No public page links to them and robots.txt names none
// (spec 2.1, plan decision 19).

export const ADMIN_PATH = "/admin";
export const ADMIN_SELLERS_PATH = "/admin/sellers";
export const ADMIN_REPORTS_PATH = "/admin/reports";
export const ADMIN_FEATURED_PATH = "/admin/featured";
export const ADMIN_POINTS_PATH = "/admin/pickup-points";
export const ADMIN_AUDIT_PATH = "/admin/audit";
export const HUB_MANAGE_PATH = "/hub/manage";
export const HUB_NEW_PATH = "/hub/new";
export const MENTOR_PATH = "/mentor";
export const MENTOR_EXPORT_PATH = "/mentor/export";

export const adminSellerPath = (slug: string) => `/admin/sellers/${slug}`;
export const declineSellerPath = (slug: string) => `/admin/sellers/${slug}/decline`;
export const pauseSellerPath = (slug: string) => `/admin/sellers/${slug}/pause`;
export const adminReportPath = (id: string) => `/admin/reports/${id}`;
export const hideReportedPath = (id: string) => `/admin/reports/${id}/hide`;
export const pauseReportedPath = (id: string) => `/admin/reports/${id}/pause`;
export const editPostPath = (id: string) => `/hub/${id}/edit`;
export const bookSlotPath = (id: string) => `/hub/${id}/book`;
export const mentorShopPath = (slug: string) => `/mentor/${slug}`;

/** Each area's front page, as the account page names it (plan decision 19). */
export const AREA_HOME: Readonly<Record<StaffArea, { href: string; label: string }>> = {
  admin: { href: ADMIN_PATH, label: "Admin console" },
  hub: { href: HUB_MANAGE_PATH, label: "Hub posts and office hours" },
  mentor: { href: MENTOR_PATH, label: "Mentor dashboard" },
};

/**
 * The staff frame's row of section links (spec section 3): the admin console's six sections, then the Hub's tools and
 * the mentor dashboard. The frame shows the ones the account may use.
 */
export const STAFF_SECTIONS: ReadonlyArray<{ href: string; label: string; area: StaffArea }> = [
  { href: ADMIN_PATH, label: "Overview", area: "admin" },
  { href: ADMIN_SELLERS_PATH, label: "Sellers", area: "admin" },
  { href: ADMIN_REPORTS_PATH, label: "Reports", area: "admin" },
  { href: ADMIN_FEATURED_PATH, label: "Featured", area: "admin" },
  { href: ADMIN_POINTS_PATH, label: "Pickup points", area: "admin" },
  { href: ADMIN_AUDIT_PATH, label: "Audit log", area: "admin" },
  { href: HUB_MANAGE_PATH, label: "Hub posts", area: "hub" },
  { href: MENTOR_PATH, label: "Mentoring", area: "mentor" },
];

/** The audit log with its filters in the link (spec 2.3: by staff member and by kind, as links). */
export function auditPath(filter: { staff: string | null; kind: AuditKind | null }): string {
  const params = new URLSearchParams();
  if (filter.staff) params.set("staff", filter.staff);
  if (filter.kind) params.set("kind", filter.kind);
  const query = params.toString();
  return query ? `${ADMIN_AUDIT_PATH}?${query}` : ADMIN_AUDIT_PATH;
}
```

- [ ] **Step 6: Write the limits**

Create `lib/staff/rules.ts`:

```ts
import { characterCount, cleanText, type TextCheck } from "@/lib/messaging/rules";
import { cleanLine } from "@/lib/selling/rules";

// The staff forms' limits and checks (staff tools spec 2.3 to 2.6; plan decisions 9, 10, 13, 16 and 18). Plain values
// and functions: safe anywhere on the server and in tests. Text is tidied as messaging's and selling's is.

/** A decline's, a hide's or a pause's reason, and a dismissal's note (plan decision 18). */
export const REASON_MAX = 500;
/** A mentor's note or check-in (plan decision 16). */
export const MENTOR_NOTE_MAX = 1000;
/** A pickup point's name (plan decision 10). */
export const POINT_NAME_MIN = 2;
export const POINT_NAME_MAX = 60;
/** A slot request (staff tools spec 2.5). */
export const HELP_MAX = 300;
export const TIME_MAX = 100;
/** How far ahead a Featured pin can be (plan decision 9). */
export const PIN_DAYS_AHEAD = 60;

function required<M extends string, L extends string>(value: string, max: number, missing: M, long: L) {
  if (value === "") return { value, error: missing };
  return { value, error: characterCount(value) > max ? long : null };
}

/** A required reason, which the seller sees (plan decision 18). Line breaks are kept. */
export function checkReason(raw: string): TextCheck<"reason-missing" | "reason-length"> {
  return required(cleanText(raw), REASON_MAX, "reason-missing", "reason-length");
}

/** Dismiss's note (spec 2.3: "Dismiss (with a note)"). Only staff see it. */
export function checkDismissNote(raw: string): TextCheck<"note-missing" | "note-length"> {
  return required(cleanText(raw), REASON_MAX, "note-missing", "note-length");
}

/** A mentor's note or check-in (spec 2.6). Line breaks are kept. */
export function checkMentorNote(raw: string): TextCheck<"mentor-note-missing" | "mentor-note-length"> {
  return required(cleanText(raw), MENTOR_NOTE_MAX, "mentor-note-missing", "mentor-note-length");
}

/** A pickup point's name: one line, 2 to 60 characters. Unique on its campus: the caller checks that. */
export function checkPointName(raw: string): TextCheck<"point-name-missing" | "point-name-length"> {
  const value = cleanLine(raw);
  if (value === "") return { value, error: "point-name-missing" };
  const length = characterCount(value);
  return { value, error: length < POINT_NAME_MIN || length > POINT_NAME_MAX ? "point-name-length" : null };
}

/** What the student would like help with (spec 2.5). */
export function checkHelp(raw: string): TextCheck<"help-missing" | "help-length"> {
  return required(cleanText(raw), HELP_MAX, "help-missing", "help-length");
}

/** A time that suits (spec 2.5): optional, one line. "" means any time. */
export function checkTime(raw: string): TextCheck<"time-length"> {
  const value = cleanLine(raw);
  return { value, error: characterCount(value) > TIME_MAX ? "time-length" : null };
}

/** A date from a form as YYYY-MM-DD, when it's a real day. A date field posts this shape in every browser. */
export function parseDay(raw: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? match[0]
    : null;
}

/** `days` days after a YYYY-MM-DD date (before it when negative). No timezone: the date is already South Africa's. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

/** A pin's day (plan decision 9): today (in SAST) to 60 days ahead. */
export function checkPinDay(raw: string, today: string): TextCheck<"day-missing" | "day-past" | "day-far"> {
  const value = parseDay(raw);
  if (!value) return { value: raw.trim(), error: "day-missing" };
  if (value < today) return { value, error: "day-past" };
  return { value, error: value > addDays(today, PIN_DAYS_AHEAD) ? "day-far" : null };
}

/** A check-in's day (spec 2.6): today (in SAST) or earlier. */
export function checkCheckInDay(
  raw: string,
  today: string,
): TextCheck<"check-in-day-missing" | "check-in-day-future"> {
  const value = parseDay(raw);
  if (!value) return { value: raw.trim(), error: "check-in-day-missing" };
  return { value, error: value > today ? "check-in-day-future" : null };
}
```

- [ ] **Step 7: Write the error words and the notices**

Create `lib/staff/errors.ts`:

```ts
import type { FormError } from "@/lib/auth/messages";
import { HELP_MAX, PIN_DAYS_AHEAD, REASON_MAX, TIME_MAX } from "./rules";

// The staff forms' error words (plan decision 22: the spec gives none), each linked to its field, in the shape D's
// ErrorSummary and errorFor take. The post editor's codes start "post-" (lib/staff/post-rules.ts); its photo's codes
// are selling's (lib/selling/errors.ts).

// A Map, so a stray code such as "toString" finds nothing.
const MESSAGES: ReadonlyMap<string, { message: string; field: string }> = new Map([
  // Confirm pages and Dismiss (plan decision 18).
  ["reason-missing", { message: "Give a reason. The seller sees it.", field: "reason" }],
  ["reason-length", { message: `Keep the reason to ${REASON_MAX} characters.`, field: "reason" }],
  ["note-missing", { message: "Add a note to say what you found.", field: "note" }],
  ["note-length", { message: `Keep the note to ${REASON_MAX} characters.`, field: "note" }],
  // Mentors' notes and check-ins (plan decision 16).
  ["mentor-note-missing", { message: "Write the note first.", field: "text" }],
  ["mentor-note-length", { message: "Keep it to 1,000 characters.", field: "text" }],
  ["check-in-day-missing", { message: "Enter the check-in's date.", field: "day" }],
  ["check-in-day-future", { message: "A check-in can't be in the future.", field: "day" }],
  // Pickup points (plan decision 10).
  ["point-name-missing", { message: "Name the pickup point.", field: "name" }],
  ["point-name-length", { message: "Keep the name to 2 to 60 characters.", field: "name" }],
  ["point-name-taken", { message: "That campus already has a pickup point with that name.", field: "name" }],
  // Featured pins (plan decision 9).
  ["seller-missing", { message: "Choose a Verified seller.", field: "seller" }],
  [
    "seller-not-eligible",
    { message: "That seller can't be featured: they must be Verified, open and have something listed.", field: "seller" },
  ],
  ["campus-missing", { message: "Choose a campus, or Visitors who haven't chosen one.", field: "campus" }],
  ["day-missing", { message: "Enter a date.", field: "day" }],
  ["day-past", { message: "Choose today or a later date.", field: "day" }],
  ["day-far", { message: `Choose a date in the next ${PIN_DAYS_AHEAD} days.`, field: "day" }],
  ["pin-taken", { message: "That seller is already pinned there on that day.", field: "seller" }],
  ["pin-full", { message: "That campus already has 4 pins on that day.", field: "day" }],
  // A slot request (plan decision 13).
  ["help-missing", { message: "Say what you'd like help with.", field: "help" }],
  ["help-length", { message: `Keep it to ${HELP_MAX} characters.`, field: "help" }],
  ["time-length", { message: `Keep it to ${TIME_MAX} characters.`, field: "time" }],
  // The Hub's post editor (lib/staff/post-rules.ts), in the form's order.
  ["post-kind-missing", { message: "Choose a tip, an event or office hours.", field: "kind" }],
  ["post-title-missing", { message: "Give the post a title.", field: "title" }],
  ["post-title-length", { message: "Keep the title to 70 characters.", field: "title" }],
  ["post-campus-missing", { message: "Choose a campus, or All campuses.", field: "campus" }],
  ["post-date-missing", { message: "Enter the date.", field: "date" }],
  ["post-time-missing", { message: "Enter the start time, like 13:00.", field: "time" }],
  ["post-place-missing", { message: "Say where it happens.", field: "place" }],
  ["post-place-length", { message: "Keep the place to 80 characters.", field: "place" }],
  ["post-capacity-invalid", { message: "Enter how many places there are, from 1 to 1,000.", field: "capacity" }],
  ["post-summary-missing", { message: "Write a one-sentence summary.", field: "summary" }],
  ["post-summary-length", { message: "Keep the summary to 160 characters.", field: "summary" }],
  ["post-body-missing", { message: "Write the post.", field: "body" }],
  ["post-body-length", { message: "Keep the post to 4,000 characters.", field: "body" }],
]);

/** The words for a form's error codes, in order, each linked to its field's id when the form has that field. */
export function staffErrors(codes: readonly string[], fieldIds: Readonly<Record<string, string>>): FormError[] {
  return codes.flatMap((code) => {
    const known = MESSAGES.get(code);
    if (!known) return [];
    return [{ message: known.message, fieldId: Object.hasOwn(fieldIds, known.field) ? fieldIds[known.field] : null }];
  });
}

/**
 * A staff form's field ids, prefixed by the form and what it's about ("decline-crochet-corner", "book-h-002"), so the
 * pages Next keeps hidden for Back never repeat an id (conventions).
 */
export function staffFieldIds(prefix: string) {
  return {
    reason: `${prefix}-reason`,
    note: `${prefix}-note`,
    text: `${prefix}-text`,
    day: `${prefix}-day`,
    name: `${prefix}-name`,
    seller: `${prefix}-seller`,
    campus: `${prefix}-campus`,
    help: `${prefix}-help`,
    time: `${prefix}-time`,
  } as const;
}

/** The post editor's field ids ("new-post", or "edit-<id>"). The kind's error goes to its first radio. */
export function postFieldIds(prefix: string) {
  return {
    kind: `${prefix}-kind-tip`,
    title: `${prefix}-title`,
    campus: `${prefix}-campus`,
    date: `${prefix}-date`,
    time: `${prefix}-time`,
    place: `${prefix}-place`,
    capacity: `${prefix}-capacity`,
    summary: `${prefix}-summary`,
    body: `${prefix}-body`,
    photos: `${prefix}-cover`,
    published: `${prefix}-published`,
  } as const;
}
```

Create `lib/staff/notices.ts`:

```ts
// What a page says after a staff action, or after a student's RSVP or slot request (staff tools spec 4: "Status changes
// after a post show a status message at the top of the page"; plan decisions 22 and 23). D's form state holds a code,
// never words, so a stale or made-up code shows nothing. The words are samples for Lama to change.

const NOTICES: ReadonlyMap<string, string> = new Map([
  ["approved", "Approved. The shop is live, and its owner has been told."],
  ["declined", "Declined. The seller has been told why, and can send it again."],
  ["verified", "Verified. The tick shows on the shop and its listings."],
  ["unverified", "Verified is off. The tick has gone from the shop and its listings."],
  ["paused", "Paused. The shop and its listings are hidden from buyers, and its owner has been told why."],
  ["resumed", "Resumed. The shop and its listings are back, and its owner has been told."],
  ["mentor-assigned", "Mentor saved."],
  ["mentor-removed", "The shop has no mentor now."],
  ["dismissed", "Dismissed. The reporter has been told."],
  ["hidden", "Hidden. Its seller and everyone who reported it have been told."],
  ["report-paused", "Paused. The seller and everyone who reported it have been told."],
  ["pinned", "Pinned. They take one of the four places that day."],
  ["unpinned", "Pin removed."],
  ["point-added", "Pickup point added."],
  ["point-renamed", "Pickup point renamed."],
  ["point-retired", "Retired. Listings that use it keep it, marked no longer used."],
  ["point-restored", "It's in use again."],
  ["post-published", "Published. It's on the Hub's feed."],
  ["post-draft", "Saved as a draft. Only Hub staff can see it."],
  ["booking-accepted", "Accepted. The student has been told."],
  ["booking-declined", "Declined. The student has been told."],
  ["note-added", "Note saved."],
  ["check-in-added", "Check-in saved."],
  ["nothing", "Nothing changed. It was already done."],
  // A student's own, on a Hub post and its slot request page (plan decision 13).
  ["rsvp", "You're going. See you there."],
  ["rsvp-cancelled", "Your RSVP is cancelled."],
  ["event-full", "Sorry, this event is full."],
  ["slot-requested", "Request sent. A mentor will answer in your notifications."],
]);

export function staffNoticeText(code: string | null | undefined): string | null {
  return code ? (NOTICES.get(code) ?? null) : null;
}
```

- [ ] **Step 8: Write the log's words and the sentences**

Create `lib/staff/audit-words.ts`:

```ts
import { isId } from "@/lib/messaging/paths";
import type { AuditAction, AuditKind } from "@/lib/types";

// The audit log's words (staff tools spec 2.2) and its filter by kind (spec 2.3). Plain values and functions.

/** Each action's words in the log, and the kind it's filed under. */
const ACTIONS: Readonly<Record<AuditAction, { label: string; kind: AuditKind }>> = {
  "shop-approved": { label: "Approved a shop", kind: "shops" },
  "shop-declined": { label: "Declined a shop", kind: "shops" },
  "shop-verified": { label: "Verified a shop", kind: "shops" },
  "shop-unverified": { label: "Took Verified away", kind: "shops" },
  "shop-paused": { label: "Paused a shop", kind: "shops" },
  "shop-resumed": { label: "Resumed a shop", kind: "shops" },
  "mentor-assigned": { label: "Assigned a mentor", kind: "mentoring" },
  "mentor-removed": { label: "Removed a mentor", kind: "mentoring" },
  "report-dismissed": { label: "Dismissed a report", kind: "reports" },
  "listing-hidden": { label: "Hid a listing", kind: "reports" },
  "featured-pinned": { label: "Pinned to Featured", kind: "featured" },
  "featured-unpinned": { label: "Removed a Featured pin", kind: "featured" },
  "point-added": { label: "Added a pickup point", kind: "pickup-points" },
  "point-renamed": { label: "Renamed a pickup point", kind: "pickup-points" },
  "point-retired": { label: "Retired a pickup point", kind: "pickup-points" },
  "point-restored": { label: "Used a pickup point again", kind: "pickup-points" },
  "post-created": { label: "Wrote a Hub post", kind: "posts" },
  "post-updated": { label: "Changed a Hub post", kind: "posts" },
  "booking-accepted": { label: "Accepted a slot request", kind: "office-hours" },
  "booking-declined": { label: "Declined a slot request", kind: "office-hours" },
  "note-added": { label: "Added a mentor's note", kind: "mentoring" },
  "check-in-added": { label: "Added a check-in", kind: "mentoring" },
};

/** The log's kinds, in the filter's order. */
export const AUDIT_KINDS: ReadonlyArray<{ kind: AuditKind; label: string }> = [
  { kind: "shops", label: "Shops" },
  { kind: "reports", label: "Reports" },
  { kind: "featured", label: "Featured" },
  { kind: "pickup-points", label: "Pickup points" },
  { kind: "posts", label: "Hub posts" },
  { kind: "office-hours", label: "Office hours" },
  { kind: "mentoring", label: "Mentoring" },
];

export function auditLabel(action: AuditAction): string {
  return ACTIONS[action].label;
}

export function auditKindOf(action: AuditAction): AuditKind {
  return ACTIONS[action].kind;
}

const first = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw) ?? "";

/** The log's filters from the link (`?staff=…&kind=…`). A staff id that isn't an id, or a kind it doesn't know, is no filter. */
export function parseAuditFilter(params: Readonly<Record<string, string | string[] | undefined>>): {
  staff: string | null;
  kind: AuditKind | null;
} {
  const staff = first(params.staff);
  const kind = first(params.kind);
  return {
    staff: isId(staff) ? staff : null,
    kind: AUDIT_KINDS.find((item) => item.kind === kind)?.kind ?? null,
  };
}
```

Create `lib/staff/notification-text.ts`:

```ts
// The sentences staff actions send (staff tools spec 2.3 and 2.4; plan decisions 7 and 22), fixed when each
// notification is made. Reasons stay out of them: each links to where its reason shows (/sell, My listings). The
// words are samples for Lama to change.

/** Approval, with E's "shop-approved" kind. */
export function shopApprovedText(shop: string): string {
  return `The Hub approved ${shop}. You can publish your listings now.`;
}

/** The Hub's other decisions about a shop, with the "shop-update" kind. */
export function shopDecisionText(
  decision: "declined" | "paused" | "resumed" | "verified" | "unverified",
  shop: string,
): string {
  switch (decision) {
    case "declined":
      return `The Hub didn't approve ${shop} yet. See why, and send it again.`;
    case "paused":
      return `The Hub paused ${shop}. See why on your dashboard.`;
    case "resumed":
      return `The Hub resumed ${shop}. Buyers can see it again.`;
    case "verified":
      return `${shop} is now Verified by the Hub.`;
    case "unverified":
      return `${shop} is no longer Verified by the Hub.`;
  }
}

/** A hidden listing, with the "shop-update" kind. */
export function listingHiddenText(title: string): string {
  return `The Hub hid ${title}. See why in My listings.`;
}

/** A report's outcome for its reporter, with E's "report-handled" kind, in the spec's words (spec 2.3). */
export function reportOutcomeText(outcome: "acted" | "dismissed", title: string): string {
  return outcome === "acted"
    ? `Thanks, we've acted on your report about ${title}.`
    : `We looked at your report about ${title} and didn't find a problem.`;
}

/** A slot request's answer for the student, with the "booking" kind (spec 2.4). */
export function slotAnswerText(answer: "accepted" | "declined", postTitle: string): string {
  return answer === "accepted"
    ? `A mentor accepted your slot request for ${postTitle}.`
    : `A mentor couldn't fit in your slot request for ${postTitle}. You can ask again.`;
}

/** A new slot request, for the office hours' author (plan decision 13), with the "booking" kind. */
export function slotRequestedText(student: string, postTitle: string): string {
  return `${student} asked for a slot at ${postTitle}.`;
}
```

- [ ] **Step 9: Run them to make sure they pass**

Run: `pnpm test lib/staff`
Expected: PASS (23 tests).

- [ ] **Step 10: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 23 more unit tests than after Task 1.

- [ ] **Step 11: Hand over for commit**

Files: `lib/staff/roles.ts`, `lib/staff/roles.test.ts`, `lib/staff/paths.ts`, `lib/staff/paths.test.ts`, `lib/staff/rules.ts`, `lib/staff/rules.test.ts`, `lib/staff/errors.ts`, `lib/staff/errors.test.ts`, `lib/staff/notices.ts`, `lib/staff/notices.test.ts`, `lib/staff/audit-words.ts`, `lib/staff/audit-words.test.ts`, `lib/staff/notification-text.ts`, `lib/staff/notification-text.test.ts`.
Message: `feat: staff rules and words: who may use each area, the staff addresses, the forms' limits, error words, notices, the audit log's words and the notifications' sentences (staff tools spec 2.1 to 2.6)`

---

### Task 3: Calculations: mentor flags and the CSV, the post editor's checks, pins and the week's break, the earned badge

The pure parts of spec 2.4, 2.6, 2.7 and 2.8, with their edges tested (spec 6's "the badge calculation for each rule's edges", "Featured with pins", "the mentor flags and CSV", "the post editor's validation"). No store, no Next API.

**Files:**
- Create: `lib/staff/mentor.ts`, `lib/staff/mentor.test.ts`
- Create: `lib/staff/post-rules.ts`, `lib/staff/post-rules.test.ts`
- Modify: `lib/featured.ts`, `lib/featured.test.ts`
- Modify: `lib/selling/badges.ts`, `lib/selling/badges.test.ts`

- [ ] **Step 1: Write the mentor flags' and the CSV's test**

Create `lib/staff/mentor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { EnquiryCounts, MentoredShop } from "@/lib/types";
import { csvCell, FLAG_WORDS, mentorCsv, mentorFlags, repliesInTime } from "./mentor";

const counts = (enquiries: number, due: number, repliedInTime: number, salesConfirmed: number): EnquiryCounts => ({
  enquiries,
  due,
  repliedInTime,
  salesConfirmed,
});

describe("the mentor dashboard's flags (staff tools spec 2.6, plan decision 15)", () => {
  it("flags a shop with no enquiries in the 14 days", () => {
    expect(mentorFlags(counts(0, 0, 0, 0), "approved")).toEqual(["no-enquiries"]);
    expect(mentorFlags(counts(1, 0, 0, 0), "approved")).toEqual([]);
  });

  it("flags slow replies under 50%, only once an enquiry is due", () => {
    expect(mentorFlags(counts(4, 4, 1, 0), "approved")).toEqual(["slow-replies"]);
    expect(mentorFlags(counts(4, 4, 2, 0), "approved")).toEqual([]);
    expect(mentorFlags(counts(2, 0, 0, 0), "approved")).toEqual([]);
  });

  it("flags a paused shop, after the others", () => {
    expect(mentorFlags(counts(0, 0, 0, 0), "paused")).toEqual(["no-enquiries", "paused"]);
  });

  it("names each flag in the spec's words, with what it means", () => {
    expect(Object.values(FLAG_WORDS).map((words) => words.label)).toEqual([
      "No enquiries in 14 days",
      "Slow replies (under 50% in 48 hours)",
      "Shop paused",
    ]);
    for (const words of Object.values(FLAG_WORDS)) expect(words.explanation).toMatch(/\.$/);
  });

  it("says replies in time as the dashboard does (selling plan decision 18)", () => {
    expect(repliesInTime(counts(4, 4, 3, 0))).toBe("3 of 4");
    expect(repliesInTime(counts(2, 0, 0, 0))).toBe("None due yet");
  });
});

describe("the dashboard's CSV (staff tools spec 2.6, plan decision 17)", () => {
  it("quotes a cell with a comma, a quote or a line break, doubling its quotes", () => {
    expect(csvCell("Bakes, cakes")).toBe('"Bakes, cakes"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell("Two\nlines")).toBe('"Two\nlines"');
    expect(csvCell("Tech corner")).toBe("Tech corner");
    expect(csvCell(3)).toBe("3");
  });

  it("puts an apostrophe before text a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+27 11")).toBe("'+27 11");
    expect(csvCell("-shop")).toBe("'-shop");
    expect(csvCell("@me")).toBe("'@me");
    expect(csvCell("=1,2")).toBe("\"'=1,2\"");
  });

  it("writes the table with a header row and a line per shop, ending each line with CRLF", () => {
    const row: MentoredShop = {
      slug: "tech-corner",
      name: "Tech corner",
      campusSlug: "midrand",
      ownerName: "Sipho",
      ownerId: "acc-seller",
      badge: "responsive",
      status: "paused",
      mentorId: "acc-mentor",
      mentorName: "Naledi",
      counts: counts(4, 4, 1, 2),
      flags: ["slow-replies", "paused"],
    };
    expect(mentorCsv([row], new Map([["midrand", "Midrand"]]))).toBe(
      "Shop,Campus,Mentor,Badge,Status,Enquiries (14 days),Due for a reply,Replied within 48 hours," +
        "Sales confirmed (14 days),Flags\r\n" +
        "Tech corner,Midrand,Naledi,Responsive,Paused,4,4,1,2,Slow replies (under 50% in 48 hours); Shop paused\r\n",
    );
    expect(mentorCsv([], new Map())).toMatch(/^Shop,.*,Flags\r\n$/);
  });
});
```

- [ ] **Step 2: Write the post editor's test**

Create `lib/staff/post-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkPost, sastToUtc, utcToSastFields, type PostInput } from "./post-rules";

const CAMPUSES = ["midrand", "pretoria"];

const input = (overrides: Partial<PostInput> = {}): PostInput => ({
  kind: "event",
  title: "  Market day on the lawn ",
  campus: "pretoria",
  date: "2026-11-20",
  time: "18:00",
  place: "The lawn outside the library",
  capacity: "40",
  summary: "Bring what you sell and a table.",
  body: "## Bring\r\n- A table\n- A float",
  published: true,
  ...overrides,
});

describe("the Hub's post editor (staff tools spec 2.4)", () => {
  it("turns an event's SAST date and time into UTC, with its place and capacity", () => {
    expect(checkPost(input(), CAMPUSES)).toEqual({
      value: {
        kind: "event",
        title: "Market day on the lawn",
        campusSlug: "pretoria",
        startsAt: "2026-11-20T16:00:00.000Z",
        place: "The lawn outside the library",
        capacity: 40,
        summary: "Bring what you sell and a table.",
        body: "## Bring\n- A table\n- A float",
        published: true,
      },
      errors: [],
    });
  });

  it("keeps office hours without a capacity, and a tip for every campus with no date, place or capacity", () => {
    expect(checkPost(input({ kind: "office-hours", capacity: "" }), CAMPUSES).value).toMatchObject({
      kind: "office-hours",
      capacity: null,
      place: "The lawn outside the library",
    });
    expect(checkPost(input({ kind: "tip", campus: "", date: "", time: "", place: "", published: false }), CAMPUSES).value).toMatchObject({
      kind: "tip",
      campusSlug: "all",
      startsAt: null,
      place: null,
      capacity: null,
      published: false,
    });
  });

  it("takes All campuses for an event", () => {
    expect(checkPost(input({ campus: "all" }), CAMPUSES).value?.campusSlug).toBe("all");
  });

  it("lists every problem in the form's order, and keeps nothing", () => {
    const result = checkPost(
      input({ title: "", campus: "atlantis", date: "2026-02-30", time: "25:00", place: " ", capacity: "0", summary: "", body: "" }),
      CAMPUSES,
    );
    expect(result).toEqual({
      value: null,
      errors: [
        "post-title-missing",
        "post-campus-missing",
        "post-date-missing",
        "post-time-missing",
        "post-place-missing",
        "post-capacity-invalid",
        "post-summary-missing",
        "post-body-missing",
      ],
    });
  });

  it("limits the title to 70, the place to 80, the summary to 160 and the body to 4,000 characters", () => {
    const long = checkPost(
      input({ title: "t".repeat(71), place: "p".repeat(81), summary: "s".repeat(161), body: "b".repeat(4001) }),
      CAMPUSES,
    );
    expect(long.errors).toEqual(["post-title-length", "post-place-length", "post-summary-length", "post-body-length"]);
    const fits = checkPost(
      input({ title: "t".repeat(70), place: "p".repeat(80), summary: "s".repeat(160), body: "b".repeat(4000) }),
      CAMPUSES,
    );
    expect(fits.errors).toEqual([]);
    expect(checkPost(input({ capacity: "1001" }), CAMPUSES).errors).toEqual(["post-capacity-invalid"]);
  });

  it("asks for one of the three kinds", () => {
    expect(checkPost(input({ kind: "poll" }), CAMPUSES).errors).toEqual(["post-kind-missing"]);
  });

  it("reads SAST as UTC+2 both ways, across midnight", () => {
    expect(sastToUtc("2026-10-15", "01:00")).toBe("2026-10-14T23:00:00.000Z");
    expect(sastToUtc("2026-10-15", "1pm")).toBeNull();
    expect(utcToSastFields("2026-10-14T22:30:00.000Z")).toEqual({ date: "2026-10-15", time: "00:30" });
  });
});
```

- [ ] **Step 3: Add the draw's and the badge's tests**

In `lib/featured.test.ts`, append inside the `describe("drawFeatured (spec 7.10)", …)` block, after its last test:

```ts

  it("puts pinned sellers first, in the order they were pinned, then fills the rest from the draw (staff tools spec 2.8)", () => {
    const drawn = drawFeatured(sellers, "pretoria", "2026-10-12", 4, { pinned: ["f", "a"] });
    expect(drawn.map((s) => s.slug).slice(0, 2)).toEqual(["f", "a"]);
    expect(drawn).toHaveLength(4);
    expect(new Set(drawn.map((s) => s.slug)).size).toBe(4);
    expect(drawn.slice(2).map((s) => s.campusSlug)).toEqual(["pretoria", "pretoria"]);
  });

  it("leaves resting sellers out of the draw, but not out of their pins (the week's break)", () => {
    const rested = drawFeatured(sellers, "all", "2026-10-12", 10, { resting: new Set(["a", "c"]) });
    expect(rested.map((s) => s.slug).sort()).toEqual(["b", "d", "f"]);
    const pinned = drawFeatured(sellers, "all", "2026-10-12", 10, { pinned: ["a"], resting: new Set(["a"]) });
    expect(pinned[0].slug).toBe("a");
  });

  it("ignores a pin for a seller who can't be featured, and never shows more than the places", () => {
    expect(drawFeatured(sellers, "all", "2026-10-12", 4, { pinned: ["e", "nobody"] }).map((s) => s.slug)).not.toContain(
      "e",
    );
    expect(drawFeatured(sellers, "all", "2026-10-12", 2, { pinned: ["a", "b", "c"] }).map((s) => s.slug)).toEqual([
      "a",
      "b",
    ]);
  });
```

In `lib/selling/badges.test.ts` (F Task 3), change `import { badgeProgress, replyRate } from "./badges";` to `import { badgeProgress, earnedBadge, replyRate } from "./badges";`, and append at the end of the file (it uses the file's own `counts`, `NOW` (2026-10-14T08:00:00.000Z) and `OLD_ACCOUNT`):

```ts

describe("the badge a shop has earned (staff tools spec 2.7, the trust page's rules)", () => {
  it("is New seller until 3 enquiries in 90 days are answered at 80% within 48 hours", () => {
    expect(earnedBadge(counts(2, 2, 2, 0), OLD_ACCOUNT, NOW)).toBe("new-seller");
    expect(earnedBadge(counts(3, 0, 0, 0), OLD_ACCOUNT, NOW)).toBe("new-seller");
    expect(earnedBadge(counts(5, 5, 3, 0), OLD_ACCOUNT, NOW)).toBe("new-seller");
    expect(earnedBadge(counts(5, 5, 4, 0), OLD_ACCOUNT, NOW)).toBe("responsive");
  });

  it("is Trusted at 85%, 5 confirmed sales and a 30-day-old account, and Responsive one short of any of them", () => {
    expect(earnedBadge(counts(20, 20, 17, 5), OLD_ACCOUNT, NOW)).toBe("trusted");
    expect(earnedBadge(counts(20, 20, 16, 5), OLD_ACCOUNT, NOW)).toBe("responsive");
    expect(earnedBadge(counts(20, 20, 17, 4), OLD_ACCOUNT, NOW)).toBe("responsive");
    expect(earnedBadge(counts(20, 20, 17, 5), "2026-09-14T08:00:00.000Z", NOW)).toBe("trusted");
    expect(earnedBadge(counts(20, 20, 17, 5), "2026-09-14T08:00:01.000Z", NOW)).toBe("responsive");
  });

  it("goes down again when the record does (a badge can go down, the trust page)", () => {
    expect(earnedBadge(counts(0, 0, 0, 9), OLD_ACCOUNT, NOW)).toBe("new-seller");
  });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test lib/staff/mentor.test.ts lib/staff/post-rules.test.ts lib/featured.test.ts lib/selling/badges.test.ts`
Expected: FAIL: the two new modules don't exist, `drawFeatured` has no options, and there's no `earnedBadge`.

- [ ] **Step 5: Write the flags and the CSV**

Create `lib/staff/mentor.ts`:

```ts
import { badgeLabel } from "@/lib/format";
import { replyRate } from "@/lib/selling/badges";
import type { EnquiryCounts, MentorFlag, MentoredShop, SellerStatus } from "@/lib/types";

// The mentor dashboard's flags and its CSV (staff tools spec 2.6; plan decisions 15 and 17). Mentors see numbers,
// never messages (FUNCTION-MAP K1). Plain functions; the words are samples for Lama to change (plan decision 22).

/** The dashboard's window: the spec's first flag counts 14 days. */
export const MENTOR_WINDOW_DAYS = 14;
/** "Slow replies" is under half answered within 48 hours. */
export const SLOW_REPLY_RATE = 0.5;

/** A shop's flags, in this order (spec 2.6). Slow replies only count once an enquiry is due (selling plan decision 18). */
export function mentorFlags(counts: EnquiryCounts, status: SellerStatus): MentorFlag[] {
  const flags: MentorFlag[] = [];
  if (counts.enquiries === 0) flags.push("no-enquiries");
  const rate = replyRate(counts);
  if (rate !== null && rate < SLOW_REPLY_RATE) flags.push("slow-replies");
  if (status === "paused") flags.push("paused");
  return flags;
}

/** Each flag's name (the spec's words) and what it means, for the shop's mentor page. */
export const FLAG_WORDS: Readonly<Record<MentorFlag, { label: string; explanation: string }>> = {
  "no-enquiries": {
    label: "No enquiries in 14 days",
    explanation: "No buyer has asked about a listing in the last 14 days. New listings or better photos may help.",
  },
  "slow-replies": {
    label: "Slow replies (under 50% in 48 hours)",
    explanation: "Fewer than half of the enquiries that are due were answered within 48 hours.",
  },
  paused: {
    label: "Shop paused",
    explanation: "Buyers can't see the shop's listings until it's resumed.",
  },
};

/** "3 of 4", or "None due yet" while no enquiry has come due (selling plan decision 18). */
export function repliesInTime(counts: EnquiryCounts): string {
  return counts.due === 0 ? "None due yet" : `${counts.repliedInTime} of ${counts.due}`;
}

const STATUS_WORDS: Readonly<Record<SellerStatus, string>> = { pending: "Waiting", approved: "Open", paused: "Paused" };

/** A shop's status as the dashboard words it. */
export function statusWords(status: SellerStatus): string {
  return STATUS_WORDS[status];
}

/**
 * One CSV cell (RFC 4180). Text that starts with =, +, - or @ gets an apostrophe first, so a spreadsheet never runs a
 * shop's name as a formula (plan decision 17). A cell with a comma, a quote or a line break is quoted.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CSV_HEADER = [
  "Shop",
  "Campus",
  "Mentor",
  "Badge",
  "Status",
  "Enquiries (14 days)",
  "Due for a reply",
  "Replied within 48 hours",
  "Sales confirmed (14 days)",
  "Flags",
];

/** The dashboard's table as a CSV file (spec 2.6), one line per shop, each ending in CRLF. No messages, no emails. */
export function mentorCsv(rows: readonly MentoredShop[], campusNames: ReadonlyMap<string, string>): string {
  const lines = [
    CSV_HEADER,
    ...rows.map((row) => [
      row.name,
      campusNames.get(row.campusSlug) ?? row.campusSlug,
      row.mentorName,
      row.badge ? badgeLabel(row.badge) : "",
      statusWords(row.status),
      row.counts.enquiries,
      row.counts.due,
      row.counts.repliedInTime,
      row.counts.salesConfirmed,
      row.flags.map((flag) => FLAG_WORDS[flag].label).join("; "),
    ]),
  ];
  return lines.map((cells) => `${cells.map(csvCell).join(",")}\r\n`).join("");
}
```

- [ ] **Step 6: Write the post editor's checks**

Create `lib/staff/post-rules.ts`:

```ts
import { ALL_CAMPUSES } from "@/lib/campus";
import { MAX_MARKDOWN_LENGTH } from "@/lib/markdown";
import { characterCount, cleanText } from "@/lib/messaging/rules";
import { cleanLine } from "@/lib/selling/rules";
import { sastClock, sastDate } from "@/lib/time";
import type { HubPostKind } from "@/lib/types";
import { parseDay } from "./rules";

// The Hub's post editor (staff tools spec 2.4; plan decisions 11 and 12): its fields, their limits, and SAST dates and
// times turned into UTC (SAST is UTC+2, with no daylight saving). Plain functions.

export const POST_TITLE_MAX = 70;
export const POST_SUMMARY_MAX = 160;
export const POST_PLACE_MAX = 80;
export const POST_BODY_MAX = 4000;
export const POST_CAPACITY_MAX = 1000;
/**
 * Typed text kept in form state for the editor after a failed save or a Preview (plan decision 12): part B's parser
 * cap, 8,000, so a long body isn't cut short before it's checked.
 */
export const POST_KEEP_MAX = MAX_MARKDOWN_LENGTH;

/** The three kinds, in the editor's order, with what each needs. */
export const POST_KINDS: ReadonlyArray<{ value: HubPostKind; label: string; hint: string }> = [
  { value: "tip", label: "Tip", hint: "Advice for sellers, for every campus. No date or place." },
  { value: "event", label: "Event", hint: "A date, a place and a number of places. Students RSVP." },
  { value: "office-hours", label: "Office hours", hint: "A date and a place. Students request a slot." },
];

/** What the editor posts, as text. */
export type PostInput = {
  kind: string;
  title: string;
  campus: string;
  /** YYYY-MM-DD, SAST. */
  date: string;
  /** HH:MM, 24-hour, SAST. */
  time: string;
  place: string;
  capacity: string;
  summary: string;
  body: string;
  published: boolean;
};

/** A post's fields once checked: part B's HubPost fields, and whether it's published. */
export type PostFields = {
  kind: HubPostKind;
  title: string;
  campusSlug: string;
  startsAt: string | null;
  place: string | null;
  capacity: number | null;
  summary: string;
  body: string;
  published: boolean;
};

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A South African date and time as an ISO time in UTC, or null when either isn't one. */
export function sastToUtc(day: string, clock: string): string | null {
  const date = parseDay(day);
  const time = CLOCK.exec(clock.trim());
  if (!date || !time) return null;
  const [year, month, dayOfMonth] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, dayOfMonth, Number(time[1]) - 2, Number(time[2]))).toISOString();
}

/** A UTC time as the editor's SAST date and time fields. */
export function utcToSastFields(iso: string): { date: string; time: string } {
  return { date: sastDate(new Date(iso)), time: sastClock(iso) };
}

function limited(raw: string, clean: (text: string) => string, max: number, missing: string, long: string) {
  const value = clean(raw);
  if (value === "") return { value, error: missing };
  return { value, error: characterCount(value) > max ? long : null };
}

/**
 * The editor's fields, checked (spec 2.4): the kind; a title of up to 70 characters; a campus or All campuses (a tip is
 * always every campus's); for events and office hours a date, a start time and a place; for events, 1 to 1,000
 * places; a one-sentence summary of up to 160; and the body, the markdown subset, up to 4,000. Every problem is listed
 * in the form's order; the fields come back only when there's none.
 */
export function checkPost(input: PostInput, campusSlugs: readonly string[]): { value: PostFields | null; errors: string[] } {
  const errors: string[] = [];
  const kind = POST_KINDS.find((item) => item.value === input.kind)?.value ?? null;
  if (!kind) errors.push("post-kind-missing");

  const title = limited(input.title, cleanLine, POST_TITLE_MAX, "post-title-missing", "post-title-length");
  if (title.error) errors.push(title.error);

  const campusSlug = kind === "tip" ? ALL_CAMPUSES : input.campus;
  if (campusSlug !== ALL_CAMPUSES && !campusSlugs.includes(campusSlug)) errors.push("post-campus-missing");

  let startsAt: string | null = null;
  let place: string | null = null;
  if (kind === "event" || kind === "office-hours") {
    const day = parseDay(input.date);
    if (!day) errors.push("post-date-missing");
    if (!CLOCK.test(input.time.trim())) errors.push("post-time-missing");
    if (day) startsAt = sastToUtc(day, input.time);
    const where = limited(input.place, cleanLine, POST_PLACE_MAX, "post-place-missing", "post-place-length");
    if (where.error) errors.push(where.error);
    place = where.value;
  }

  let capacity: number | null = null;
  if (kind === "event") {
    const typed = input.capacity.trim();
    const places = /^\d{1,4}$/.test(typed) ? Number(typed) : 0;
    if (places < 1 || places > POST_CAPACITY_MAX) errors.push("post-capacity-invalid");
    else capacity = places;
  }

  const summary = limited(input.summary, cleanLine, POST_SUMMARY_MAX, "post-summary-missing", "post-summary-length");
  if (summary.error) errors.push(summary.error);
  const body = limited(input.body, cleanText, POST_BODY_MAX, "post-body-missing", "post-body-length");
  if (body.error) errors.push(body.error);

  if (errors.length > 0 || !kind) return { value: null, errors };
  return {
    value: {
      kind,
      title: title.value,
      campusSlug,
      startsAt,
      place,
      capacity,
      summary: summary.value,
      body: body.value,
      published: input.published,
    },
    errors,
  };
}
```

- [ ] **Step 7: Teach the draw about pins and the week's break**

In `lib/featured.ts`, replace `drawFeatured` and its comment with:

```ts
/** What a day's draw honours besides the rotation (staff tools spec 2.8, plan decision 9). */
export type FeaturedOptions = {
  /** Pinned sellers' slugs, in the order they were pinned. They take the first places, before the draw. */
  pinned?: readonly string[];
  /** Sellers sitting out today's draw: the week's break. A pin ignores it. */
  resting?: ReadonlySet<string>;
};

/**
 * The fair daily seller draw (spec 7.10). Verified sellers take turns: each day the order starts one place further
 * on, so nobody is favoured. The campus's own sellers come first, topped up from other campuses. Pins come before
 * the draw, and sellers resting after a recent turn sit it out (staff tools spec 2.8). Only sellers in `sellers` can
 * be pinned: the caller passes the ones who may be featured.
 */
export function drawFeatured(
  sellers: readonly Seller[],
  campus: CampusChoice,
  day: string,
  count = 4,
  { pinned = [], resting = new Set<string>() }: FeaturedOptions = {},
): Seller[] {
  const eligible = sellers.filter((seller) => seller.verified).sort((a, b) => a.slug.localeCompare(b.slug));
  const bySlug = new Map(eligible.map((seller) => [seller.slug, seller]));
  const pins = [...new Set(pinned)].flatMap((slug) => bySlug.get(slug) ?? []).slice(0, count);
  const taken = new Set(pins.map((seller) => seller.slug));
  const pool = eligible.filter((seller) => !taken.has(seller.slug) && !resting.has(seller.slug));
  const drawn =
    campus === ALL_CAMPUSES
      ? rotate(pool, day)
      : [
          ...rotate(
            pool.filter((seller) => seller.campusSlug === campus),
            day,
          ),
          ...rotate(
            pool.filter((seller) => seller.campusSlug !== campus),
            day,
          ),
        ];
  return [...pins, ...drawn].slice(0, count);
}
```

- [ ] **Step 8: Work out the earned badge**

In `lib/selling/badges.ts` (F Task 3), update the file's top comment's last sentence ("Stage G works the badges out; this only explains the next step.") to "Stage G works the badges out with earnedBadge (staff tools spec 2.7).", and add after `replyRate`:

```ts

/**
 * The badge a shop has earned (the trust page's rules; staff tools spec 2.7): Trusted, else Responsive, else New
 * seller. `record` is the last 90 days' enquiries and every confirmed sale (shopStats's `record`); `accountCreatedAt`
 * is the owner's. With no enquiry due yet the reply rate isn't known, so neither higher badge is met. A badge goes
 * down again when the record does.
 */
export function earnedBadge(record: EnquiryCounts, accountCreatedAt: string, now: Date): TrustBadge {
  const rate = replyRate(record);
  const days = Math.floor((now.getTime() - Date.parse(accountCreatedAt)) / DAY_MS);
  const meets = (rule: (typeof RULES)[keyof typeof RULES]) =>
    record.enquiries >= rule.enquiries &&
    rate !== null &&
    rate >= rule.rate &&
    record.salesConfirmed >= rule.sales &&
    days >= rule.days;
  if (meets(RULES.trusted)) return "trusted";
  if (meets(RULES.responsive)) return "responsive";
  return "new-seller";
}
```

(`TrustBadge`, `EnquiryCounts` and `DAY_MS` are already imported there; if the build's file says it differently, import them.)

- [ ] **Step 9: Run them to make sure they pass**

Run: `pnpm test lib/staff/mentor.test.ts lib/staff/post-rules.test.ts lib/featured.test.ts lib/selling/badges.test.ts`
Expected: PASS: 8 mentor tests, 7 post editor tests, 3 more draw tests (the 4 before still pass), 3 more badge tests.

- [ ] **Step 10: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 21 more unit tests than after Task 2. The homepage's tests are unchanged: `drawFeatured(…, day)` with no options draws as it did.

- [ ] **Step 11: Hand over for commit**

Files: `lib/staff/mentor.ts`, `lib/staff/mentor.test.ts`, `lib/staff/post-rules.ts`, `lib/staff/post-rules.test.ts`, `lib/featured.ts`, `lib/featured.test.ts`, `lib/selling/badges.ts`, `lib/selling/badges.test.ts`.
Message: `feat: the mentor flags and CSV, the Hub post editor's checks, pins and the week's break in the Featured draw, and the earned badge (staff tools spec 2.4, 2.6 to 2.8)`

---

### Task 4: The audit log, the Hub's decisions on shops and listings, and hidden listings in the catalog

The data under the admin console's Sellers section and its Hide (spec 2.2 and 2.3; plan decisions 2 to 6, 15 and 23): the audit log's only writer, approving, declining, Verified, the Hub's pause, mentors, hiding a listing, and the catalog and selling data learning about hidden listings and Hub pauses. Server Actions come in Task 10.

**Files:**
- Modify: `lib/data/tags.ts`; Create: `lib/data/tags.test.ts`
- Create: `lib/data/audit.ts`, `lib/data/audit.test.ts`
- Create: `lib/data/staff-shops.ts`, `lib/data/staff-shops.test.ts`
- Modify: `lib/data/catalog.ts`, `lib/data/catalog.test.ts`
- Modify: `lib/data/shops.ts`, `lib/data/shops.test.ts`
- Modify: `lib/data/own-listings.ts`, `lib/data/own-listings.test.ts`

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md` and `cacheTag.md`: `updateTag` works only in Server Actions and expires the tag at once; `cacheTag` only inside `"use cache"`. Read `revalidateTag.md`'s note on render: neither may run while a page renders (plan decision 8).

- [ ] **Step 2: Write the tests**

Create `lib/data/tags.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { hubChanged, pickupPointsChanged } from "./tags";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetRequest(request);
});

describe("the staff tools' cache tags (staff tools plan decisions 10 and 11)", () => {
  it("expires the Hub's posts and the pickup points after a staff write", () => {
    hubChanged();
    pickupPointsChanged();
    expect(request.updatedTags).toEqual(["hub", "pickup-points"]);
  });
});
```

Create `lib/data/audit.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { auditStaff, listAudit, recordAudit } from "./audit";
import { resetSampleStore, sampleStore } from "./store";

const admin = { id: "acc-admin", firstName: "Pieter" };
const mentor = { id: "acc-mentor", firstName: "Naledi" };
const at = (minute: number) => new Date(`2026-10-14T08:${String(minute).padStart(2, "0")}:00.000Z`);

beforeEach(() => {
  resetSampleStore();
});

describe("the audit log (staff tools spec 2.2, plan decision 6)", () => {
  it("records who did what to what, why and when", async () => {
    await recordAudit({
      staff: admin,
      action: "shop-declined",
      target: { kind: "shop", id: "crochet-corner", name: "Crochet corner" },
      detail: "The photo shows someone else's work.",
      subjectId: "acc-pending",
      now: at(1),
    });
    const [entry] = await listAudit({ staff: null, kind: null });
    expect(entry).toEqual({
      id: expect.stringMatching(/^aud-[0-9a-f-]{36}$/),
      at: "2026-10-14T08:01:00.000Z",
      staffId: "acc-admin",
      staffName: "Pieter",
      action: "shop-declined",
      targetKind: "shop",
      targetName: "Crochet corner",
      detail: "The photo shows someone else's work.",
    });
    expect([...sampleStore().auditLog.values()][0]).toMatchObject({ targetId: "crochet-corner", subjectId: "acc-pending" });
  });

  it("lists the newest first, and filters by staff member and by kind (spec 2.3)", async () => {
    const shop = { kind: "shop" as const, id: "tech-corner", name: "Tech corner" };
    await recordAudit({ staff: admin, action: "shop-verified", target: shop, now: at(1) });
    await recordAudit({ staff: mentor, action: "note-added", target: shop, now: at(2) });
    await recordAudit({ staff: admin, action: "report-dismissed", target: { kind: "report", id: "rep-1", name: "Desk lamp" }, now: at(3) });
    expect((await listAudit({ staff: null, kind: null })).map((entry) => entry.action)).toEqual([
      "report-dismissed",
      "note-added",
      "shop-verified",
    ]);
    expect((await listAudit({ staff: "acc-admin", kind: null })).map((entry) => entry.action)).toEqual([
      "report-dismissed",
      "shop-verified",
    ]);
    expect((await listAudit({ staff: null, kind: "mentoring" })).map((entry) => entry.action)).toEqual(["note-added"]);
    expect((await listAudit({ staff: "acc-mentor", kind: "shops" }))).toEqual([]);
    expect(await auditStaff()).toEqual([
      { id: "acc-mentor", name: "Naledi" },
      { id: "acc-admin", name: "Pieter" },
    ]);
  });

  it("can't be edited: recording is the only way in, and nothing changes or removes an entry", async () => {
    expect(Object.keys(await import("./audit")).sort()).toEqual(["auditStaff", "listAudit", "recordAudit"]);
  });
});
```

Create `lib/data/staff-shops.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { listedListings, publicListing, shopStatus } from "./catalog";
import {
  approveShop,
  declineShop,
  getShopForReview,
  hideListing,
  listMentors,
  listShopsForReview,
  resendForApproval,
  setShopMentor,
  setVerified,
  shopStanding,
  staffPauseShop,
  staffResumeShop,
} from "./staff-shops";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const LATER = new Date("2026-10-15T09:00:00.000Z");

/** A second student's shop, sent for approval at `appliedAt` (the store as F's createShop leaves it). */
function waitingShop(accountId: string, slug: string, name: string, appliedAt: string) {
  const store = sampleStore();
  store.accounts.set(accountId, {
    id: accountId,
    email: `${accountId}@eduvos.com`,
    firstName: "Zola",
    campusSlug: "midrand",
    roles: [],
    createdAt: appliedAt,
  });
  store.sellers.set(slug, {
    ...structuredClone(store.sellers.get("crochet-corner")!),
    slug,
    name,
    ownerId: accountId,
    campusSlug: "midrand",
    pickupPointIds: ["pp-midrand-library"],
    createdAt: appliedAt,
    updatedAt: appliedAt,
  });
  store.sellerProfiles.set(accountId, { accountId, status: "pending", sellerSlug: null, appliedAt });
}

beforeEach(() => {
  resetSampleStore();
});

describe("the Sellers list and a shop's review (staff tools spec 2.3)", () => {
  it("puts shops waiting for approval first, oldest first, then declined ones, then the rest by name", async () => {
    waitingShop("acc-zola", "zolas-bakes", "Zola's bakes", "2026-10-12T08:00:00.000Z");
    waitingShop("acc-ama", "ama-prints", "Ama prints", "2026-10-13T08:00:00.000Z");
    await declineShop("ama-prints", "Add a photo of your work.", NOW);
    const rows = await listShopsForReview();
    expect(rows.slice(0, 3).map((row) => [row.shop.slug, row.standing])).toEqual([
      ["crochet-corner", "waiting"],
      ["zolas-bakes", "waiting"],
      ["ama-prints", "declined"],
    ]);
    expect(rows).toHaveLength(32);
    const rest = rows.slice(3).map((row) => row.shop.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
  });

  it("reviews a shop with its owner's first name, its standing, its mentor and what it has listed", async () => {
    expect(await getShopForReview("tech-corner")).toMatchObject({
      shop: { slug: "tech-corner", name: "Tech corner" },
      owner: { id: "acc-seller", firstName: "Sipho" },
      standing: "open",
      appliedAt: "2026-03-02T09:40:00.000Z",
      mentor: { id: "acc-mentor", firstName: "Naledi" },
      listedCount: 2,
    });
    expect(await getShopForReview("hair-studio")).toMatchObject({ owner: null, standing: "open", appliedAt: null });
    expect(await getShopForReview("nope")).toBeNull();
  });
});

describe("approving and declining (staff tools spec 2.3, plan decision 2)", () => {
  it("approves a waiting shop: its storefront opens under its link", async () => {
    expect(await approveShop("crochet-corner")).toEqual({
      slug: "crochet-corner",
      name: "Crochet corner",
      ownerId: "acc-pending",
    });
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({ status: "approved", sellerSlug: "crochet-corner" });
    expect(shopStatus(sampleStore().sellers.get("crochet-corner")!)).toBe("approved");
    // A second press, or an open shop, changes nothing (plan decision 23).
    expect(await approveShop("crochet-corner")).toBeNull();
    expect(await approveShop("tech-corner")).toBeNull();
    expect(await approveShop("hair-studio")).toBeNull();
  });

  it("declines a waiting shop with its reason: it stays waiting, and can be sent again", async () => {
    expect(await declineShop("crochet-corner", "Add a photo of your work.", NOW)).toMatchObject({ ownerId: "acc-pending" });
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      status: "pending",
      sellerSlug: null,
      declinedAt: NOW.toISOString(),
      staffReason: "Add a photo of your work.",
    });
    expect(await shopStanding("acc-pending")).toEqual({
      declinedAt: NOW.toISOString(),
      pausedByHub: false,
      reason: "Add a photo of your work.",
    });
    // Declined isn't waiting: it can't be approved or declined again until it's sent again.
    expect(await declineShop("crochet-corner", "Again.", NOW)).toBeNull();
    expect(await approveShop("crochet-corner")).toBeNull();
    expect(await resendForApproval("acc-pending", LATER)).toBe(true);
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      declinedAt: null,
      staffReason: null,
      appliedAt: LATER.toISOString(),
    });
    expect(await resendForApproval("acc-pending", LATER)).toBe(false);
    expect(await approveShop("crochet-corner")).not.toBeNull();
  });
});

describe("Verified, the Hub's pause and mentors (staff tools spec 2.3 and 2.6, plan decisions 3 and 15)", () => {
  it("gives and takes Verified on a shop with a storefront, sample shops included", async () => {
    expect(await setVerified("tech-corner", true)).toEqual({ slug: "tech-corner", name: "Tech corner", ownerId: "acc-seller" });
    expect(sampleStore().sellers.get("tech-corner")?.verified).toBe(true);
    expect(await setVerified("tech-corner", true)).toBeNull();
    expect(await setVerified("hair-studio", false)).toMatchObject({ ownerId: null });
    expect(await setVerified("crochet-corner", true)).toBeNull();
  });

  it("pauses an open shop with a reason, takes over a seller's own pause, and only resumes its own", async () => {
    const profile = sampleStore().sellerProfiles.get("acc-seller")!;
    expect(await staffPauseShop("tech-corner", "Selling exam answers.")).toMatchObject({ ownerId: "acc-seller" });
    expect(profile).toMatchObject({ status: "paused", pausedBy: "staff", staffReason: "Selling exam answers." });
    expect((await shopStanding("acc-seller"))?.pausedByHub).toBe(true);
    expect(await staffPauseShop("tech-corner", "Again.")).toBeNull();
    expect(await staffResumeShop("tech-corner")).toMatchObject({ ownerId: "acc-seller" });
    expect(profile).toMatchObject({ status: "approved", pausedBy: null, staffReason: null });
    expect(await staffResumeShop("tech-corner")).toBeNull();

    Object.assign(profile, { status: "paused", pausedBy: "seller" });
    expect(await staffResumeShop("tech-corner")).toBeNull();
    expect(await staffPauseShop("tech-corner", "Reported twice.")).not.toBeNull();
    expect(profile.pausedBy).toBe("staff");
  });

  it("can't pause a waiting shop, or a sample shop no account owns", async () => {
    expect(await staffPauseShop("crochet-corner", "No.")).toBeNull();
    expect(await staffPauseShop("hair-studio", "No.")).toBeNull();
  });

  it("assigns a mentor from the accounts with the mentor role, or none", async () => {
    expect(await listMentors()).toEqual([{ id: "acc-mentor", firstName: "Naledi" }]);
    expect(await setShopMentor("tech-corner", "acc-mentor")).toBeNull();
    expect(await setShopMentor("tech-corner", null)).toMatchObject({ ownerId: "acc-seller", mentorName: null });
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect(await setShopMentor("tech-corner", "acc-student")).toBeNull();
    expect(await setShopMentor("tech-corner", "acc-mentor")).toMatchObject({ mentorName: "Naledi" });
    expect(await setShopMentor("hair-studio", "acc-mentor")).toBeNull();
    expect(await setShopMentor("crochet-corner", "acc-mentor")).toBeNull();
  });
});

describe("hiding a listing (staff tools spec 2.3, plan decision 4)", () => {
  it("keeps the row with its reason, takes it out of every list and gives it no page", async () => {
    expect(await hideListing("l-001", "Not allowed on Vossie.", NOW)).toEqual({
      id: "l-001",
      title: "Casio fx-991ZA Plus calculator",
      sellerSlug: "tech-corner",
      state: "available",
      ownerId: "acc-seller",
    });
    expect(sampleStore().listings.get("l-001")).toMatchObject({
      hiddenReason: "Not allowed on Vossie.",
      hiddenAt: NOW.toISOString(),
    });
    expect(listedListings().some((listing) => listing.id === "l-001")).toBe(false);
    expect(publicListing("l-001")).toBeNull();
    expect(await hideListing("l-001", "Again.", NOW)).toBeNull();
    expect(await hideListing("l-nope", "No.", NOW)).toBeNull();
    expect(await hideListing("l-004", "A sample shop's.", NOW)).toMatchObject({ ownerId: null });
  });
});
```

In `lib/data/catalog.test.ts` (F Task 4), append at the end of the file (add `listedListings`, `publicListing` and `publicListingIds` to the `./catalog` import, and `sampleStore` to the `./store` import, if they aren't there):

```ts

describe("hidden listings (staff tools plan decision 4)", () => {
  it("keeps a listing the Hub hid out of every list, and gives it no page", () => {
    Object.assign(sampleStore().listings.get("l-007")!, {
      hiddenAt: "2026-10-14T08:00:00.000Z",
      hiddenReason: "Not allowed on Vossie.",
    });
    expect(listedListings().some((listing) => listing.id === "l-007")).toBe(false);
    expect(publicListing("l-007")).toBeNull();
    expect(publicListingIds()).not.toContain("l-007");
  });
});
```

In `lib/data/shops.test.ts` (F Task 5), append at the end of the file (add `setShopPaused` to the `./shops` import and `sampleStore` to the `./store` import, if they aren't there):

```ts

describe("a pause the Hub made (staff tools plan decision 3)", () => {
  it("marks the seller's own pause as theirs, and won't let them resume the Hub's", async () => {
    const profile = sampleStore().sellerProfiles.get("acc-seller")!;
    expect(await setShopPaused("acc-seller", true)).toBe("paused");
    expect(profile.pausedBy).toBe("seller");
    expect(await setShopPaused("acc-seller", false)).toBe("approved");
    expect(profile.pausedBy).toBeNull();
    Object.assign(profile, { status: "paused", pausedBy: "staff", staffReason: "Selling exam answers." });
    expect(await setShopPaused("acc-seller", false)).toBeNull();
    expect(profile.status).toBe("paused");
  });
});
```

In `lib/data/own-listings.test.ts` (F Task 5), append inside its `describe`, after the last test (it uses the file's `save` helper, which saves for Tech corner):

```ts

  it("keeps a listing the Hub hid hidden when its seller saves it (staff tools plan decision 4)", async () => {
    Object.assign(sampleStore().listings.get("l-001")!, {
      hiddenAt: "2026-10-14T08:00:00.000Z",
      hiddenReason: "Not allowed on Vossie.",
    });
    expect(await save({ id: "l-001" })).toMatchObject({
      hiddenAt: "2026-10-14T08:00:00.000Z",
      hiddenReason: "Not allowed on Vossie.",
    });
    const fresh = (await save())!;
    expect("hiddenAt" in fresh).toBe(false);
  });
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/data/tags.test.ts lib/data/audit.test.ts lib/data/staff-shops.test.ts lib/data/catalog.test.ts lib/data/shops.test.ts lib/data/own-listings.test.ts`
Expected: FAIL: no `hubChanged`, no `audit.ts` or `staff-shops.ts`, the catalog lists hidden listings, the seller resumes the Hub's pause, and an edit drops the hidden fields.

- [ ] **Step 4: Add the tags**

Append to `lib/data/tags.ts` (F Task 4):

```ts

// The staff tools' tags (staff tools plan decisions 10 and 11): the Hub's posts, which staff write and RSVPs count, and
// the pickup points, which staff add, rename and retire.

export const HUB_TAG = "hub";
export const PICKUP_POINTS_TAG = "pickup-points";

/** For a cached function that returns Hub posts or events. */
export function tagHub(): void {
  cacheTag(HUB_TAG);
}

/** For a cached function that returns pickup points, or a listing with its pickup point. */
export function tagPickupPoints(): void {
  cacheTag(PICKUP_POINTS_TAG);
}

/** After a Hub post, an RSVP or a slot request changes. Server Actions only. */
export function hubChanged(): void {
  updateTag(HUB_TAG);
}

/** After a pickup point changes. Server Actions only. */
export function pickupPointsChanged(): void {
  updateTag(PICKUP_POINTS_TAG);
}
```

- [ ] **Step 5: Write the audit log**

Create `lib/data/audit.ts`:

```ts
import { randomUUID } from "node:crypto";
import { auditKindOf } from "@/lib/staff/audit-words";
import type { AuditAction, AuditEntry, AuditKind, AuditTargetKind } from "@/lib/types";
import type { AuditRow } from "./rows";
import { sampleStore } from "./store";

// The audit log (staff tools spec 2.2, plan decision 6): one entry per staff action that changed something, written
// after the change has gone through. recordAudit is its only writer, and there's no function, page or action that
// changes or removes an entry. The one exception is POPIA: deleting an account forgets the person in it
// (lib/data/staff-privacy.ts). Times come from the caller.

export type NewAuditEntry = {
  /** Who acted: their account and their first name now. */
  staff: { id: string; firstName: string };
  action: AuditAction;
  /** What it was done to, and its name now, kept in case it changes or goes. */
  target: { kind: AuditTargetKind; id: string; name: string };
  /** The reason or note, when the action asked for one. */
  detail?: string;
  /** The student it was about (a shop's owner, a reporter, a slot request's student), so their deletion can forget them. */
  subjectId?: string | null;
  now: Date;
};

export async function recordAudit(entry: NewAuditEntry): Promise<void> {
  const id = `aud-${randomUUID()}`;
  sampleStore().auditLog.set(id, {
    id,
    at: entry.now.toISOString(),
    staffId: entry.staff.id,
    staffName: entry.staff.firstName,
    action: entry.action,
    targetKind: entry.target.kind,
    targetId: entry.target.id,
    targetName: entry.target.name,
    detail: entry.detail ?? "",
    subjectId: entry.subjectId ?? null,
  });
}

function toEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    at: row.at,
    staffId: row.staffId,
    staffName: row.staffName,
    action: row.action,
    targetKind: row.targetKind,
    targetName: row.targetName,
    detail: row.detail,
  };
}

/** The log, newest first (spec 2.3), by one staff member and of one kind when asked, at most `limit` entries. */
export async function listAudit(
  filter: { staff: string | null; kind: AuditKind | null },
  limit = 200,
): Promise<AuditEntry[]> {
  // Newest added first, then by time: entries made in the same millisecond keep the order they were made in, reversed.
  return [...sampleStore().auditLog.values()]
    .reverse()
    .filter((row) => !filter.staff || row.staffId === filter.staff)
    .filter((row) => !filter.kind || auditKindOf(row.action) === filter.kind)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map(toEntry);
}

/** Every staff member in the log, by first name, for its filter links (spec 2.3). Deleted accounts aren't listed. */
export async function auditStaff(): Promise<{ id: string; name: string }[]> {
  const names = new Map<string, string>();
  for (const row of sampleStore().auditLog.values()) {
    if (row.staffId) names.set(row.staffId, row.staffName);
  }
  return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 6: Write the Hub's decisions on shops and listings**

Create `lib/data/staff-shops.ts`:

```ts
import type { ListingState } from "@/lib/types";
import { listedListings, shopStatus } from "./catalog";
import type { SellerProfileRow, SellerRow } from "./rows";
import { sampleStore } from "./store";

// The Hub's decisions about shops and listings (staff tools spec 2.3; plan decisions 2 to 4, 15 and 23): approving,
// declining, Verified, the Hub's pause, mentors, and hiding a listing. A shop's status stays on its owner's seller
// profile (selling plan decision 1). Each change checks the state it expects and gives back null when there was
// nothing to do, so the action writes no audit entry and sends nothing (plan decision 23). Times come from the caller.

/** Where a shop stands, as the Sellers list says it. A declined shop is a waiting one with the decline recorded. */
export type ShopStanding = "waiting" | "declined" | "open" | "paused";

/** A shop as the Sellers list and its review page show it (spec 2.3). */
export type ShopReview = {
  /** A copy. */
  shop: SellerRow;
  /** The owner's account and first name, or null for a sample shop no account owns (always open). */
  owner: { id: string; firstName: string } | null;
  standing: ShopStanding;
  appliedAt: string | null;
  declinedAt: string | null;
  pausedBy: "seller" | "staff" | null;
  /** The Hub's reason for a decline or its pause. */
  staffReason: string | null;
  mentor: { id: string; firstName: string } | null;
  /** How many of its listings buyers can find now. */
  listedCount: number;
};

/** What a decision changed, for the action's audit entry and notification. */
export type ShopDecision = { slug: string; name: string; ownerId: string | null };

/** A seller's own standing with the Hub, for /sell (Task 18). */
export type OwnStanding = { declinedAt: string | null; pausedByHub: boolean; reason: string | null };

function profileOf(row: SellerRow): SellerProfileRow | null {
  return row.ownerId ? (sampleStore().sellerProfiles.get(row.ownerId) ?? null) : null;
}

function personOf(accountId: string | null | undefined): { id: string; firstName: string } | null {
  const row = accountId ? sampleStore().accounts.get(accountId) : undefined;
  return row ? { id: row.id, firstName: row.firstName } : null;
}

function standingOf(row: SellerRow, profile: SellerProfileRow | null): ShopStanding {
  if (!row.ownerId) return "open";
  if (!profile || profile.status === "pending") return profile?.declinedAt ? "declined" : "waiting";
  return profile.status === "paused" ? "paused" : "open";
}

function listedCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const listing of listedListings()) counts.set(listing.sellerSlug, (counts.get(listing.sellerSlug) ?? 0) + 1);
  return counts;
}

function review(row: SellerRow, counts: ReadonlyMap<string, number>): ShopReview {
  const profile = profileOf(row);
  return {
    shop: structuredClone(row),
    owner: personOf(row.ownerId),
    standing: standingOf(row, profile),
    appliedAt: profile?.appliedAt ?? null,
    declinedAt: profile?.declinedAt ?? null,
    pausedBy: profile?.pausedBy ?? null,
    staffReason: profile?.staffReason ?? null,
    mentor: personOf(profile?.mentorId),
    listedCount: counts.get(row.slug) ?? 0,
  };
}

const RANK: Readonly<Record<ShopStanding, number>> = { waiting: 0, declined: 1, open: 2, paused: 2 };

/** Every shop (spec 2.3): waiting for approval first, oldest application first; then declined; then the rest by name. */
export async function listShopsForReview(): Promise<ShopReview[]> {
  const counts = listedCounts();
  return [...sampleStore().sellers.values()]
    .map((row) => review(row, counts))
    .sort(
      (a, b) =>
        RANK[a.standing] - RANK[b.standing] ||
        (a.standing === "waiting" ? (a.appliedAt ?? "").localeCompare(b.appliedAt ?? "") : 0) ||
        a.shop.name.localeCompare(b.shop.name),
    );
}

export async function getShopForReview(slug: string): Promise<ShopReview | null> {
  const row = sampleStore().sellers.get(slug);
  return row ? review(row, listedCounts()) : null;
}

/** How many shops are waiting for approval (not declined), for Overview. */
export async function countWaitingShops(): Promise<number> {
  return [...sampleStore().sellers.values()].filter((row) => standingOf(row, profileOf(row)) === "waiting").length;
}

function owned(slug: string): { row: SellerRow; profile: SellerProfileRow } | null {
  const row = sampleStore().sellers.get(slug);
  const profile = row ? profileOf(row) : null;
  return row && profile ? { row, profile } : null;
}

const decided = (row: SellerRow): ShopDecision => ({ slug: row.slug, name: row.name, ownerId: row.ownerId });

/** Approve (spec 2.3): a waiting shop opens, with its storefront at its link (selling plan decision 1). */
export async function approveShop(slug: string): Promise<ShopDecision | null> {
  const shop = owned(slug);
  if (!shop || shop.profile.status !== "pending" || shop.profile.declinedAt) return null;
  Object.assign(shop.profile, {
    status: "approved",
    sellerSlug: shop.row.slug,
    declinedAt: null,
    pausedBy: null,
    staffReason: null,
  });
  return decided(shop.row);
}

/** Decline (spec 2.3, plan decision 2): the shop stays waiting, with the decline and its reason recorded. */
export async function declineShop(slug: string, reason: string, now: Date): Promise<ShopDecision | null> {
  const shop = owned(slug);
  if (!shop || shop.profile.status !== "pending" || shop.profile.declinedAt) return null;
  shop.profile.declinedAt = now.toISOString();
  shop.profile.staffReason = reason;
  return decided(shop.row);
}

/** The seller's Send for approval again (plan decision 2): the decline is forgotten and the shop waits again. */
export async function resendForApproval(accountId: string, now: Date): Promise<boolean> {
  const profile = sampleStore().sellerProfiles.get(accountId);
  if (!profile || profile.status !== "pending" || !profile.declinedAt) return false;
  profile.declinedAt = null;
  profile.staffReason = null;
  profile.appliedAt = now.toISOString();
  return true;
}

/** Verify, or take Verified away (spec 2.3), on any shop with a storefront, sample shops included. */
export async function setVerified(slug: string, verified: boolean): Promise<ShopDecision | null> {
  const row = sampleStore().sellers.get(slug);
  if (!row || shopStatus(row) === "pending" || row.verified === verified) return null;
  row.verified = verified;
  return decided(row);
}

/**
 * The Hub's Pause shop (spec 2.3, plan decision 3): an open shop, or one its seller paused, which then becomes the
 * Hub's to resume. A sample shop no account owns has no profile, so it can't be paused.
 */
export async function staffPauseShop(slug: string, reason: string): Promise<ShopDecision | null> {
  const shop = owned(slug);
  if (!shop) return null;
  const { status, pausedBy } = shop.profile;
  if (!(status === "approved" || (status === "paused" && pausedBy !== "staff"))) return null;
  Object.assign(shop.profile, { status: "paused", pausedBy: "staff", staffReason: reason });
  return decided(shop.row);
}

/** The Hub's Resume (spec 2.3): only a pause the Hub made (plan decision 3). */
export async function staffResumeShop(slug: string): Promise<ShopDecision | null> {
  const shop = owned(slug);
  if (!shop || shop.profile.status !== "paused" || shop.profile.pausedBy !== "staff") return null;
  Object.assign(shop.profile, { status: "approved", pausedBy: null, staffReason: null });
  return decided(shop.row);
}

/** The accounts with the mentor role, by first name, for the seller page's choice (plan decision 15). */
export async function listMentors(): Promise<{ id: string; firstName: string }[]> {
  return [...sampleStore().accounts.values()]
    .filter((row) => row.roles.includes("mentor"))
    .map((row) => ({ id: row.id, firstName: row.firstName }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
}

/**
 * A shop's mentor (spec 2.6, plan decision 15): one of the accounts with the mentor role, or none. Only an open or
 * paused shop with an owner can have one.
 */
export async function setShopMentor(
  slug: string,
  mentorId: string | null,
): Promise<(ShopDecision & { mentorName: string | null }) | null> {
  const shop = owned(slug);
  if (!shop || shop.profile.status === "pending") return null;
  const mentor = mentorId ? sampleStore().accounts.get(mentorId) : undefined;
  if (mentorId && !mentor?.roles.includes("mentor")) return null;
  if ((shop.profile.mentorId ?? null) === mentorId) return null;
  shop.profile.mentorId = mentorId;
  return { ...decided(shop.row), mentorName: mentor?.firstName ?? null };
}

/** Hide the listing (spec 2.3, plan decision 4): its row stays, with the reason, and buyers stop seeing it. */
export async function hideListing(
  id: string,
  reason: string,
  now: Date,
): Promise<{ id: string; title: string; sellerSlug: string; state: ListingState; ownerId: string | null } | null> {
  const row = sampleStore().listings.get(id);
  if (!row || row.hiddenAt) return null;
  row.hiddenAt = now.toISOString();
  row.hiddenReason = reason;
  const ownerId = sampleStore().sellers.get(row.sellerSlug)?.ownerId ?? null;
  return { id: row.id, title: row.title, sellerSlug: row.sellerSlug, state: row.state, ownerId };
}

/** A seller's standing with the Hub (Task 18's /sell): a decline, or the Hub's pause, and its reason. */
export async function shopStanding(accountId: string): Promise<OwnStanding | null> {
  const profile = sampleStore().sellerProfiles.get(accountId);
  if (!profile) return null;
  return {
    declinedAt: profile.declinedAt ?? null,
    pausedByHub: profile.status === "paused" && profile.pausedBy === "staff",
    reason: profile.staffReason ?? null,
  };
}
```

- [ ] **Step 7: Teach the catalog, the seller's pause and the listing form about the Hub**

In `lib/data/catalog.ts` (F Task 4):
1. In the file's top comment, replace "Stage G's hidden listings and declined shops join the rules here." with "A listing the Hub hid is in no list and has no page (staff tools plan decision 4); a declined shop is a waiting one (staff tools plan decision 2), so nothing changes for it here."
2. In `listedListings`, replace the condition `shop && row.state === "available" && shopStatus(shop) === "approved"` with `shop && row.state === "available" && !row.hiddenAt && shopStatus(shop) === "approved"`.
3. In `publicListing`, replace `if (!row || !shop || row.state === "draft" || !hasStorefront(shop)) return null;` with `if (!row || !shop || row.state === "draft" || row.hiddenAt || !hasStorefront(shop)) return null;`.

In `lib/data/shops.ts` (F Task 5), replace `setShopPaused` and its comment with:

```ts
/**
 * Pause my shop and Resume (selling spec 2.8): approved to paused and back. The seller's own pause is marked as theirs;
 * a pause the Hub made is the Hub's to undo, so the seller can't resume it (staff tools plan decision 3). The new
 * status, or null when it can't change.
 */
export async function setShopPaused(accountId: string, paused: boolean): Promise<SellerStatus | null> {
  const profile = sampleStore().sellerProfiles.get(accountId);
  if (!profile || profile.status !== (paused ? "approved" : "paused")) return null;
  if (!paused && profile.pausedBy === "staff") return null;
  profile.status = paused ? "paused" : "approved";
  profile.pausedBy = paused ? "seller" : null;
  return profile.status;
}
```

In `lib/data/own-listings.ts` (F Task 5), in `saveOwnListing`, add these lines as the last properties of the `row` object, after `updatedAt: at,`:

```ts
    // A listing the Hub hid stays hidden when its seller saves it (staff tools plan decision 4). New rows get no field.
    ...(existing?.hiddenAt ? { hiddenAt: existing.hiddenAt, hiddenReason: existing.hiddenReason ?? null } : {}),
```

- [ ] **Step 8: Run them to make sure they pass**

Run: `pnpm test lib/data`
Expected: PASS: 1 tags test, 3 audit tests, 9 staff-shops tests, and 1 more each in the catalog's, the shops' and the own listings' tests.

- [ ] **Step 9: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 16 more unit tests than after Task 3.

- [ ] **Step 10: Hand over for commit**

Files: `lib/data/tags.ts`, `lib/data/tags.test.ts`, `lib/data/audit.ts`, `lib/data/audit.test.ts`, `lib/data/staff-shops.ts`, `lib/data/staff-shops.test.ts`, `lib/data/catalog.ts`, `lib/data/catalog.test.ts`, `lib/data/shops.ts`, `lib/data/shops.test.ts`, `lib/data/own-listings.ts`, `lib/data/own-listings.test.ts`.
Message: `feat: the audit log's only writer, the Hub's decisions on shops (approve, decline, Verified, pause, resume, mentor) and hidden listings; the catalog drops hidden listings and a seller can't resume the Hub's pause (staff tools spec 2.2 and 2.3)`

---

### Task 5: Reports for the Hub, badges from the store, and any window of a shop's numbers

The data behind the Reports section (spec 2.3; plan decision 5), the trust badges worked out from E's conversations (spec 2.7; plan decision 8), and the mentor dashboard's 14-day numbers (plan decision 15).

**Files:**
- Create: `lib/data/staff-reports.ts`, `lib/data/staff-reports.test.ts`
- Create: `lib/data/badges.ts`, `lib/data/badges.test.ts`
- Modify: `lib/data/shop-stats.ts`, `lib/data/shop-stats.test.ts`

- [ ] **Step 1: Write the tests**

Create `lib/data/staff-reports.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createReport } from "./reports";
import { closeReport, closeReportsOn, getReport, listReports, openReportCount } from "./staff-reports";
import { resetSampleStore, sampleStore } from "./store";

const at = (hour: number) => new Date(`2026-10-14T${String(hour).padStart(2, "0")}:00:00.000Z`);
const NOW = at(12);

function report(reporterId: string, target: { kind: "listing" | "seller" | "request"; id: string }, hour: number) {
  return createReport({
    reporterId,
    target,
    targetTitle: `Title of ${target.id}`,
    reason: "scam",
    detail: "Asked for a deposit.",
    now: at(hour),
  });
}

beforeEach(() => {
  resetSampleStore();
});

describe("the Hub's reports queue (staff tools spec 2.3, plan decision 5)", () => {
  it("lists open reports first, oldest first, then closed ones, newest closed first", async () => {
    const first = await report("acc-student", { kind: "listing", id: "l-004" }, 8);
    const second = await report("acc-mentor", { kind: "seller", id: "tech-corner" }, 9);
    const third = await report("acc-student", { kind: "request", id: "r-001" }, 10);
    await closeReport(first, "Checked with the seller.", "acc-admin", NOW);
    expect((await listReports()).map((view) => [view.id, view.open])).toEqual([
      [second, true],
      [third, true],
      [first, false],
    ]);
    expect(await openReportCount()).toBe(2);
  });

  it("names the reporter by first name only, and says who closed it", async () => {
    const id = await report("acc-student", { kind: "listing", id: "l-004" }, 8);
    await closeReport(id, "Checked with the seller.", "acc-admin", NOW);
    const view = (await getReport(id))!;
    expect(view).toMatchObject({
      reporterName: "Thandi",
      reporterId: "acc-student",
      target: { kind: "listing", id: "l-004" },
      targetTitle: "Title of l-004",
      reason: "scam",
      detail: "Asked for a deposit.",
      open: false,
      outcome: "dismissed",
      note: "Checked with the seller.",
      closedAt: NOW.toISOString(),
      closedByName: "Pieter",
    });
    expect(JSON.stringify(view)).not.toContain("@eduvos.com");
    expect(await getReport("rep-nope")).toBeNull();
  });

  it("says what the Hub can do: hide a listing that's there, pause an owned open shop, only dismiss the rest", async () => {
    const own = (await getReport(await report("acc-student", { kind: "listing", id: "l-001" }, 8)))!;
    expect(own).toMatchObject({ exists: true, can: { hide: true, pause: true }, shop: { slug: "tech-corner", name: "Tech corner" } });
    const sample = (await getReport(await report("acc-student", { kind: "listing", id: "l-004" }, 8)))!;
    expect(sample.can).toEqual({ hide: true, pause: false });
    const shop = (await getReport(await report("acc-student", { kind: "seller", id: "tech-corner" }, 8)))!;
    expect(shop.can).toEqual({ hide: false, pause: true });
    const request = (await getReport(await report("acc-student", { kind: "request", id: "r-001" }, 8)))!;
    expect(request.can).toEqual({ hide: false, pause: false });
    sampleStore().listings.delete("l-007");
    const gone = (await getReport(await report("acc-student", { kind: "listing", id: "l-007" }, 8)))!;
    expect(gone).toMatchObject({ exists: false, can: { hide: false, pause: false } });
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    sampleStore().sellerProfiles.get("acc-seller")!.pausedBy = "staff";
    expect((await getReport(own.id))!.can).toEqual({ hide: true, pause: false });
  });

  it("dismisses one report with its note, once", async () => {
    const id = await report("acc-student", { kind: "listing", id: "l-004" }, 8);
    expect(await closeReport(id, "Nothing wrong.", "acc-admin", NOW)).toEqual({
      id,
      reporterId: "acc-student",
      title: "Title of l-004",
    });
    expect(sampleStore().reports.get(id)).toMatchObject({
      status: "closed",
      outcome: "dismissed",
      note: "Nothing wrong.",
      closedAt: NOW.toISOString(),
      closedBy: "acc-admin",
    });
    expect(await closeReport(id, "Again.", "acc-admin", NOW)).toBeNull();
  });

  it("closes every open report on the same target when it's hidden or paused, and gives back each reporter", async () => {
    await report("acc-student", { kind: "listing", id: "l-001" }, 8);
    await report("acc-mentor", { kind: "listing", id: "l-001" }, 9);
    const other = await report("acc-student", { kind: "listing", id: "l-007" }, 9);
    const closed = await closeReportsOn({ kind: "listing", id: "l-001" }, "hidden", "Not allowed.", "acc-admin", NOW);
    expect(closed.map((item) => item.reporterId).sort()).toEqual(["acc-mentor", "acc-student"]);
    expect([...sampleStore().reports.values()].filter((row) => row.outcome === "hidden")).toHaveLength(2);
    expect(sampleStore().reports.get(other)?.status).toBe("open");
    expect(await closeReportsOn({ kind: "listing", id: "l-001" }, "hidden", "Again.", "acc-admin", NOW)).toEqual([]);
  });
});
```

Create `lib/data/badges.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { recalculateBadgeFor, recalculateBadges } from "./badges";
import type { ConversationRow } from "./rows";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T10:00:00.000Z");

/** A third enquiry for Tech corner, answered half an hour after it came in. */
function answeredEnquiry(): void {
  const row: ConversationRow = {
    id: "conv-t1",
    listingId: "l-001",
    listingTitle: "Casio fx-991ZA Plus calculator",
    sellerSlug: "tech-corner",
    buyerId: "acc-mentor",
    sellerGone: false,
    status: "replied",
    createdAt: "2026-10-14T07:00:00.000Z",
    lastMessageAt: "2026-10-14T07:30:00.000Z",
    firstReplyAt: "2026-10-14T07:30:00.000Z",
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
  };
  sampleStore().conversations.set(row.id, row);
}

beforeEach(() => {
  resetSampleStore();
});

describe("trust badges from the store (staff tools spec 2.7, plan decision 8)", () => {
  it("gives Tech corner the badge its conversations earn: New seller with only 2 enquiries", async () => {
    expect(await recalculateBadges(NOW)).toEqual(["tech-corner"]);
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("new-seller");
    expect(await recalculateBadges(NOW)).toEqual([]);
  });

  it("gives Responsive once a third enquiry is answered within 48 hours", async () => {
    answeredEnquiry();
    expect(await recalculateBadges(NOW)).toEqual([]);
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("responsive");
  });

  it("leaves the sample shops no account owns, and a shop waiting for approval, as they are", async () => {
    sampleStore().sellers.get("crochet-corner")!.badge = "trusted";
    await recalculateBadges(NOW);
    expect(sampleStore().sellers.get("hair-studio")?.badge).toBe("trusted");
    expect(sampleStore().sellers.get("crochet-corner")?.badge).toBe("trusted");
  });

  it("works out the badge of a conversation's shop, after a reply or a confirmed sale", async () => {
    expect(await recalculateBadgeFor("conv-s1", NOW)).toBe(true);
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("new-seller");
    expect(await recalculateBadgeFor("conv-s1", NOW)).toBe(false);
    expect(await recalculateBadgeFor("conv-nope", NOW)).toBe(false);
  });
});
```

In `lib/data/shop-stats.test.ts` (F Task 5), change `import { shopStats } from "./shop-stats";` to `import { recentCounts, shopStats } from "./shop-stats";`, and append inside its `describe`, after the last test (it uses the file's `add`, `ago` and `NOW`):

```ts

  it("counts any window, such as the mentor dashboard's 14 days (staff tools plan decision 15)", async () => {
    sampleStore().conversations.clear();
    add({ createdAt: ago(24 * 10), firstReplyAt: ago(24 * 10 - 1) });
    add({ createdAt: ago(24 * 15) });
    add({ createdAt: ago(24 * 20), status: "confirmed", confirmedAt: ago(24 * 13), confirmedBy: "buyer" });
    expect(await recentCounts("tech-corner", 14, NOW)).toEqual({
      enquiries: 1,
      due: 1,
      repliedInTime: 1,
      salesConfirmed: 1,
    });
  });
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test lib/data/staff-reports.test.ts lib/data/badges.test.ts lib/data/shop-stats.test.ts`
Expected: FAIL: the two modules don't exist, and there's no `recentCounts`.

- [ ] **Step 3: Write the reports queue**

Create `lib/data/staff-reports.ts`:

```ts
import type { ReportOutcome, ReportReason, ReportTarget } from "@/lib/types";
import type { ReportRow } from "./rows";
import { sampleStore } from "./store";

// The Hub's reports queue (staff tools spec 2.3, plan decision 5), over E's reports. A report names its reporter by
// first name only. Dismiss closes one report; hiding the listing or pausing the account closes every open report on
// the same target. A report about something that has gone, or about a Looking For request, can only be dismissed.
// Closing writes; the action notifies (Task 10). Times come from the caller.

/** A report as the queue and its page show it (spec 2.3). */
export type ReportView = {
  id: string;
  reporterId: string;
  /** The reporter's first name only (spec 2.3). */
  reporterName: string;
  target: ReportTarget;
  /** What it was called when it was reported. */
  targetTitle: string;
  reason: ReportReason;
  detail: string;
  open: boolean;
  createdAt: string;
  outcome: ReportOutcome | null;
  note: string | null;
  closedAt: string | null;
  closedByName: string | null;
  /** Whether the reported listing or shop is still there (a request always is). */
  exists: boolean;
  /** The shop a pause would pause: the listing's, or the one reported. */
  shop: { slug: string; name: string } | null;
  /** What the Hub can still do, besides Dismiss (plan decision 5). Nothing once it's closed. */
  can: { hide: boolean; pause: boolean };
};

const DELETED = "Deleted account";

const firstName = (accountId: string | null | undefined) =>
  (accountId ? sampleStore().accounts.get(accountId)?.firstName : undefined) ?? DELETED;

/** Whether the Hub can pause this shop: it has an owner, and it's open or paused by its seller (plan decision 3). */
function pausable(slug: string): boolean {
  const store = sampleStore();
  const ownerId = store.sellers.get(slug)?.ownerId;
  const profile = ownerId ? store.sellerProfiles.get(ownerId) : undefined;
  return Boolean(profile && (profile.status === "approved" || (profile.status === "paused" && profile.pausedBy !== "staff")));
}

function toView(row: ReportRow): ReportView {
  const store = sampleStore();
  const open = row.status === "open";
  const listing = row.targetKind === "listing" ? store.listings.get(row.targetId) : undefined;
  const shopSlug =
    row.targetKind === "listing" ? listing?.sellerSlug : row.targetKind === "seller" ? row.targetId : undefined;
  const shopRow = shopSlug ? store.sellers.get(shopSlug) : undefined;
  const exists = row.targetKind === "request" || (row.targetKind === "listing" ? Boolean(listing) : Boolean(shopRow));
  return {
    id: row.id,
    reporterId: row.reporterId,
    reporterName: firstName(row.reporterId),
    target: { kind: row.targetKind, id: row.targetId },
    targetTitle: row.targetTitle,
    reason: row.reason,
    detail: row.detail,
    open,
    createdAt: row.createdAt,
    outcome: row.outcome ?? null,
    note: row.note ?? null,
    closedAt: row.closedAt ?? null,
    closedByName: row.closedAt ? firstName(row.closedBy) : null,
    exists,
    shop: shopRow ? { slug: shopRow.slug, name: shopRow.name } : null,
    can: {
      hide: open && Boolean(listing) && !listing?.hiddenAt,
      pause: open && shopRow !== undefined && pausable(shopRow.slug),
    },
  };
}

/** The queue (spec 2.3): open reports first, oldest first; then the 50 most recently closed. */
export async function listReports(): Promise<ReportView[]> {
  const rows = [...sampleStore().reports.values()];
  const open = rows.filter((row) => row.status === "open").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const closed = rows
    .filter((row) => row.status === "closed")
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))
    .slice(0, 50);
  return [...open, ...closed].map(toView);
}

export async function getReport(id: string): Promise<ReportView | null> {
  const row = sampleStore().reports.get(id);
  return row ? toView(row) : null;
}

/** How many reports are open, for Overview (spec 2.3). */
export async function openReportCount(): Promise<number> {
  return [...sampleStore().reports.values()].filter((row) => row.status === "open").length;
}

function close(row: ReportRow, outcome: ReportOutcome, note: string, staffId: string, now: Date): void {
  Object.assign(row, { status: "closed", outcome, note, closedAt: now.toISOString(), closedBy: staffId });
}

/** A closed report, for its reporter's notification: the report, who sent it, and what it was about. */
export type ClosedReport = { id: string; reporterId: string; title: string };

/** Dismiss (spec 2.3): this report closes with its note. Null when it wasn't open. */
export async function closeReport(id: string, note: string, staffId: string, now: Date): Promise<ClosedReport | null> {
  const row = sampleStore().reports.get(id);
  if (!row || row.status !== "open") return null;
  close(row, "dismissed", note, staffId, now);
  return { id: row.id, reporterId: row.reporterId, title: row.targetTitle };
}

/**
 * Hide the listing or Pause the account (spec 2.3, plan decision 5): every open report on the same target closes with
 * the outcome and the reason. Each one, for its reporter's notification.
 */
export async function closeReportsOn(
  target: ReportTarget,
  outcome: "hidden" | "paused",
  note: string,
  staffId: string,
  now: Date,
): Promise<ClosedReport[]> {
  const closed: ClosedReport[] = [];
  for (const row of sampleStore().reports.values()) {
    if (row.status !== "open" || row.targetKind !== target.kind || row.targetId !== target.id) continue;
    close(row, outcome, note, staffId, now);
    closed.push({ id: row.id, reporterId: row.reporterId, title: row.targetTitle });
  }
  return closed;
}
```

- [ ] **Step 4: Write the badges**

Create `lib/data/badges.ts`:

```ts
import { earnedBadge } from "@/lib/selling/badges";
import { shopStatus } from "./catalog";
import { shopStats } from "./shop-stats";
import { sampleStore } from "./store";

// Trust badges worked out from the store (staff tools spec 2.7, plan decision 8), by the trust page's rules, from
// E's conversations by F's counting. Only shops with an owner account and a storefront (open or paused) are worked
// out: the 28 sample shops no account owns have no conversations in the store, so they keep their sample badges.
// There's no scheduler: Overview runs it for every shop, and a reply or a confirmed sale for its shop. The nightly
// job is a go-live item. Writing the badge doesn't expire the cache: the caller does that, when it can.

async function recalculate(slug: string, now: Date): Promise<boolean> {
  const store = sampleStore();
  const row = store.sellers.get(slug);
  const owner = row?.ownerId ? store.accounts.get(row.ownerId) : undefined;
  if (!row || !owner || shopStatus(row) === "pending") return false;
  const badge = earnedBadge((await shopStats(slug, now)).record, owner.createdAt, now);
  if (row.badge === badge) return false;
  row.badge = badge;
  return true;
}

/** Every owned shop's badge (Overview). The slugs whose badge changed. */
export async function recalculateBadges(now: Date): Promise<string[]> {
  const changed: string[] = [];
  for (const slug of [...sampleStore().sellers.keys()]) {
    if (await recalculate(slug, now)) changed.push(slug);
  }
  return changed;
}

/** The badge of the shop a conversation is with (after a reply or a confirmed sale). True when it changed. */
export async function recalculateBadgeFor(conversationId: string, now: Date): Promise<boolean> {
  const conversation = sampleStore().conversations.get(conversationId);
  return conversation ? recalculate(conversation.sellerSlug, now) : false;
}
```

- [ ] **Step 5: Count any window**

In `lib/data/shop-stats.ts` (F Task 5), append:

```ts

/** A shop's enquiries and sales over the last `days` days: the mentor dashboard's 14 (staff tools plan decision 15). */
export async function recentCounts(sellerSlug: string, days: number, now: Date): Promise<EnquiryCounts> {
  const rows = [...sampleStore().conversations.values()].filter((row) => row.sellerSlug === sellerSlug);
  const since = now.getTime() - days * DAY_MS;
  return counts(rows, since, since, now);
}
```

- [ ] **Step 6: Run them to make sure they pass**

Run: `pnpm test lib/data/staff-reports.test.ts lib/data/badges.test.ts lib/data/shop-stats.test.ts`
Expected: PASS (5 reports tests, 4 badge tests, and the new shop-stats test).

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 10 more unit tests than after Task 4.

- [ ] **Step 8: Hand over for commit**

Files: `lib/data/staff-reports.ts`, `lib/data/staff-reports.test.ts`, `lib/data/badges.ts`, `lib/data/badges.test.ts`, `lib/data/shop-stats.ts`, `lib/data/shop-stats.test.ts`.
Message: `feat: the Hub's reports queue (what each report allows, dismiss one, close every report on a hidden or paused target), trust badges worked out from the store, and any window of a shop's numbers (staff tools spec 2.3 and 2.7)`

---

### Task 6: Featured with pins and the week's break, and pickup points, from the store

The data behind the admin's Featured and Pickup points sections and the homepage's Featured today (spec 2.3 and 2.8; plan decisions 9 and 10), and the data layer reading them: `getFeatured` reads and writes the store per request, `getPickupPoints` gives the points in use, and a listing's page finds its point, retired or not.

**Files:**
- Create: `lib/data/featured.ts`, `lib/data/featured.test.ts`
- Create: `lib/data/pickup-points.ts`, `lib/data/pickup-points.test.ts`
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`
- Modify: `lib/data/shops.ts`

- [ ] **Step 1: Write the tests**

Create `lib/data/featured.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { addPin, featuredChoices, featuredFor, listPins, removePin } from "./featured";
import type { FeaturedPinRow } from "./rows";
import { resetSampleStore, sampleStore } from "./store";

const DAY = "2026-10-14";
const NOW = new Date("2026-10-14T08:42:00.000Z");
const pin = (sellerSlug: string, campusSlug = "pretoria", day = DAY) =>
  addPin({ sellerSlug, campusSlug, day, staffId: "acc-admin", now: NOW });

beforeEach(() => {
  resetSampleStore();
});

describe("who can be featured (staff tools spec 2.8, plan decision 9)", () => {
  it("offers Verified, open sellers with something listed, by name", async () => {
    const slugs = async () => (await featuredChoices()).map((seller) => seller.slug);
    expect(await slugs()).toHaveLength(9);
    expect((await featuredChoices()).map((seller) => seller.name)).toEqual(
      [...(await featuredChoices()).map((seller) => seller.name)].sort((a, b) => a.localeCompare(b)),
    );
    sampleStore().sellers.get("tech-corner")!.verified = true;
    expect(await slugs()).toContain("tech-corner");
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect(await slugs()).not.toContain("tech-corner");
    for (const listing of sampleStore().listings.values()) {
      if (listing.sellerSlug === "hair-studio") listing.state = "sold";
    }
    expect(await slugs()).not.toContain("hair-studio");
  });
});

describe("a campus's Featured row for the day (staff tools spec 2.8, plan decision 9)", () => {
  it("draws four, the campus's own first, and records the row", async () => {
    const row = await featuredFor("midrand", DAY);
    expect(row).toHaveLength(4);
    expect(row.every((seller) => seller.verified && seller.campusSlug === "midrand")).toBe(true);
    expect(sampleStore().featuredDraws.get("midrand:2026-10-14")?.sellerSlugs).toEqual(row.map((seller) => seller.slug));
  });

  it("keeps the row as first drawn all day, and drops a seller who stops being eligible, leaving the place empty", async () => {
    const first = await featuredFor("midrand", DAY);
    sampleStore().sellers.get("tech-corner")!.verified = true;
    expect(await featuredFor("midrand", DAY)).toEqual(first);
    sampleStore().sellers.get(first[0].slug)!.verified = false;
    expect((await featuredFor("midrand", DAY)).map((seller) => seller.slug)).toEqual(
      first.slice(1).map((seller) => seller.slug),
    );
  });

  it("rests a campus's sellers for six days after they're shown there, and not on other campuses", async () => {
    const day1 = (await featuredFor("midrand", "2026-10-14")).map((seller) => seller.slug);
    const day2 = (await featuredFor("midrand", "2026-10-15")).map((seller) => seller.slug);
    expect(day2).toHaveLength(4);
    expect(day2.some((slug) => day1.includes(slug))).toBe(false);
    // Nine sellers, four places: day 3 has the one left, then nobody until the break is over (plan decision 9).
    expect(await featuredFor("midrand", "2026-10-16")).toHaveLength(1);
    expect(await featuredFor("midrand", "2026-10-17")).toEqual([]);
    expect((await featuredFor("midrand", "2026-10-21")).map((seller) => seller.slug).sort()).toEqual([...day1].sort());
    expect(await featuredFor("pretoria", "2026-10-15")).toHaveLength(4);
  });

  it("puts pins first, even a resting seller, and draws again when a pin for the day comes or goes", async () => {
    const first = await featuredFor("pretoria", DAY);
    const added = await pin("nail-bar");
    expect(added).toMatchObject({ sellerSlug: "nail-bar", campusSlug: "pretoria", day: DAY, pinnedBy: "acc-admin" });
    expect((await featuredFor("pretoria", DAY))[0].slug).toBe("nail-bar");
    await removePin((added as FeaturedPinRow).id);
    expect(await featuredFor("pretoria", DAY)).toEqual(first);
    // Shown in Pretoria's row today, Code coach rests there tomorrow, but a pin still puts it first.
    const tomorrow = "2026-10-15";
    await pin("code-coach", "pretoria", tomorrow);
    expect((await featuredFor("pretoria", tomorrow))[0].slug).toBe("code-coach");
  });
});

describe("pins (staff tools spec 2.8)", () => {
  it("refuses a seller who can't be featured, the same seller twice, and a fifth pin", async () => {
    expect(await pin("tech-corner")).toBe("not-eligible");
    expect(await pin("nope")).toBe("not-eligible");
    for (const slug of ["hair-studio", "maths-tutor", "home-bakery", "design-studio"]) {
      expect(typeof (await pin(slug)), slug).toBe("object");
    }
    expect(await pin("hair-studio")).toBe("taken");
    expect(await pin("code-coach")).toBe("full");
    expect(typeof (await pin("code-coach", "pretoria", "2026-10-15"))).toBe("object");
  });

  it("lists today's and later pins with the seller's and the admin's names", async () => {
    await pin("nail-bar", "pretoria", "2026-10-13");
    await pin("nail-bar", "all", "2026-10-20");
    await pin("phone-fix", "pretoria", DAY);
    expect(await listPins(DAY)).toEqual([
      expect.objectContaining({ sellerName: "Phone fix", campusSlug: "pretoria", day: DAY, pinnedByName: "Pieter" }),
      expect.objectContaining({ sellerName: "Nail bar", campusSlug: "all", day: "2026-10-20" }),
    ]);
    expect(await removePin("pin-nope")).toBeNull();
  });
});
```

Create `lib/data/pickup-points.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  addPickupPoint,
  isPointNameTaken,
  listPickupPoints,
  pickupPointById,
  pickupPointName,
  pointsInUse,
  renamePickupPoint,
  restorePickupPoint,
  retirePickupPoint,
} from "./pickup-points";
import { resetSampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("pickup points (staff tools spec 2.3, plan decision 10)", () => {
  it("lists every point, and offers only those in use", async () => {
    expect(await listPickupPoints()).toHaveLength(24);
    expect(pointsInUse()).toHaveLength(24);
    expect(pointsInUse()[0]).toEqual({ id: "pp-bedfordview-library", campusSlug: "bedfordview", name: "Library entrance" });
  });

  it("adds a point with a new id, refusing a name its campus has however it's written, and any on Eduvos Online", async () => {
    const added = await addPickupPoint("midrand", "Student centre", NOW);
    expect(added).toMatchObject({ id: expect.stringMatching(/^pp-[0-9a-f-]{36}$/), campusSlug: "midrand", retiredAt: null });
    expect(pointsInUse().filter((point) => point.campusSlug === "midrand").map((point) => point.name)).toEqual([
      "Library entrance",
      "Main reception",
      "Student centre",
    ]);
    expect(await isPointNameTaken("midrand", "LIBRARY entrance!", null)).toBe(true);
    expect(await isPointNameTaken("midrand", "Library entrance", "pp-midrand-library")).toBe(false);
    expect(await isPointNameTaken("pretoria", "Student centre", null)).toBe(false);
    expect(await addPickupPoint("midrand", "library Entrance", NOW)).toBeNull();
    expect(await addPickupPoint("online", "The hall", NOW)).toBeNull();
    expect(await addPickupPoint("atlantis", "The hall", NOW)).toBeNull();
  });

  it("renames a point, keeping its id", async () => {
    expect(await renamePickupPoint("pp-midrand-library", "Library steps")).toEqual({ before: "Library entrance" });
    expect(pickupPointById("pp-midrand-library")?.name).toBe("Library steps");
    expect(await renamePickupPoint("pp-midrand-library", "Library steps")).toBeNull();
    expect(await renamePickupPoint("pp-midrand-library", "main RECEPTION")).toBeNull();
    expect(await renamePickupPoint("pp-nope", "Hall")).toBeNull();
  });

  it("retires a point, which listings keep, and uses it again", async () => {
    expect(await retirePickupPoint("pp-midrand-library", NOW)).toMatchObject({ retiredAt: NOW.toISOString() });
    expect(pointsInUse().map((point) => point.id)).not.toContain("pp-midrand-library");
    expect(pickupPointById("pp-midrand-library")).toEqual({
      id: "pp-midrand-library",
      campusSlug: "midrand",
      name: "Library entrance",
      retired: true,
    });
    expect(await retirePickupPoint("pp-midrand-library", NOW)).toBeNull();
    expect(await restorePickupPoint("pp-midrand-library")).toMatchObject({ retiredAt: null });
    expect(await restorePickupPoint("pp-midrand-library")).toBeNull();
    expect(pickupPointById("pp-midrand-library")).not.toHaveProperty("retired");
  });

  it("names any point for a listing's page and selling's export, and nothing for none", () => {
    expect(pickupPointName("pp-midrand-reception")).toBe("Main reception");
    expect(pickupPointName(null)).toBeNull();
    expect(pickupPointName("pp-nope")).toBeNull();
    expect(pickupPointById(null)).toBeNull();
  });
});
```

In `lib/data/index.test.ts` (F Task 4 added `resetSampleStore()` in a `beforeEach` and `sampleStore` to its imports), add `getFeatured` and `getPickupPoints` to the `./index` import if they aren't there, and append at the end of the file:

```ts

describe("Featured and pickup points from the store (staff tools plan decisions 9 and 10)", () => {
  it("offers only the points in use, and still names a retired point on its listing's page", async () => {
    sampleStore().pickupPoints.get("pp-midrand-library")!.retiredAt = "2026-10-14T08:00:00.000Z";
    expect((await getPickupPoints()).map((point) => point.id)).not.toContain("pp-midrand-library");
    expect((await getListingDetail("l-001"))?.pickupPoint).toEqual({
      id: "pp-midrand-library",
      campusSlug: "midrand",
      name: "Library entrance",
      retired: true,
    });
  });

  it("features today's row from the store, pins first", async () => {
    sampleStore().featuredPins.set("pin-1", {
      id: "pin-1",
      sellerSlug: "nail-bar",
      campusSlug: "midrand",
      day: "2026-10-14",
      pinnedBy: "acc-admin",
      createdAt: "2026-10-14T08:00:00.000Z",
    });
    const row = await getFeatured({ campus: "midrand", day: "2026-10-14" });
    expect(row.map((seller) => seller.slug)[0]).toBe("nail-bar");
    expect(row).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test lib/data/featured.test.ts lib/data/pickup-points.test.ts lib/data/index.test.ts`
Expected: FAIL: the two modules don't exist, and the data layer still reads the pickup point fixture and draws Featured with no pins.

- [ ] **Step 3: Write the pickup points**

Create `lib/data/pickup-points.ts`:

```ts
import { randomUUID } from "node:crypto";
import { ONLINE_CAMPUS } from "@/lib/campus";
import { nameKey } from "@/lib/selling/rules";
import type { PickupPoint } from "@/lib/types";
import type { PickupPointRow } from "./rows";
import { sampleStore } from "./store";

// The approved pickup points (staff tools spec 2.3, plan decision 10), moved from the fixture into the store so the
// Hub can add, rename and retire them. Forms offer only the points in use; a listing on a retired point keeps it,
// and its page says "(no longer used)". Retiring is undone by Use it again. Names are unique on their campus,
// compared like shop names (selling's nameKey). Eduvos Online has none. Times come from the caller.

function toPoint(row: PickupPointRow): PickupPoint {
  const point = { id: row.id, campusSlug: row.campusSlug, name: row.name };
  return row.retiredAt ? { ...point, retired: true } : point;
}

/** Every point, retired ones included, in the store's order (each campus's together), for the admin page. Copies. */
export async function listPickupPoints(): Promise<PickupPointRow[]> {
  return [...sampleStore().pickupPoints.values()].map((row) => ({ ...row }));
}

/** The points in use: what onboarding, Edit shop and the listing form offer. */
export function pointsInUse(): PickupPoint[] {
  return [...sampleStore().pickupPoints.values()].filter((row) => !row.retiredAt).map(toPoint);
}

/** Any point by id, retired or not, for a listing's page. Null for none. */
export function pickupPointById(id: string | null): PickupPoint | null {
  const row = id ? sampleStore().pickupPoints.get(id) : undefined;
  return row ? toPoint(row) : null;
}

/** A point's name, retired or not, for selling's data export. */
export function pickupPointName(id: string | null): string | null {
  return pickupPointById(id)?.name ?? null;
}

/** Whether another point on the campus has this name, however it's written. `exceptId` is the point being renamed. */
export async function isPointNameTaken(campusSlug: string, name: string, exceptId: string | null): Promise<boolean> {
  const key = nameKey(name);
  for (const row of sampleStore().pickupPoints.values()) {
    if (row.id !== exceptId && row.campusSlug === campusSlug && nameKey(row.name) === key) return true;
  }
  return false;
}

/**
 * Adds a point (spec 2.3). Null when the campus already has one by that name, or isn't a campus with points: Eduvos
 * Online has none, and a slug no campus has is refused (the action checks it against the campuses).
 */
export async function addPickupPoint(campusSlug: string, name: string, now: Date): Promise<PickupPointRow | null> {
  const store = sampleStore();
  const known = [...store.pickupPoints.values()].some((row) => row.campusSlug === campusSlug);
  if (campusSlug === ONLINE_CAMPUS || !known || (await isPointNameTaken(campusSlug, name, null))) return null;
  const row: PickupPointRow = {
    id: `pp-${randomUUID()}`,
    campusSlug,
    name,
    retiredAt: null,
    createdAt: now.toISOString(),
  };
  store.pickupPoints.set(row.id, row);
  return { ...row };
}

/** Renames a point, keeping its id, so listings that use it follow. Its old name; null when nothing changed or it's taken. */
export async function renamePickupPoint(id: string, name: string): Promise<{ before: string } | null> {
  const row = sampleStore().pickupPoints.get(id);
  if (!row || row.name === name || (await isPointNameTaken(row.campusSlug, name, id))) return null;
  const before = row.name;
  row.name = name;
  return { before };
}

/** Retire (spec 2.3): forms stop offering it; listings keep it, marked "no longer used". Null when it already was. */
export async function retirePickupPoint(id: string, now: Date): Promise<PickupPointRow | null> {
  const row = sampleStore().pickupPoints.get(id);
  if (!row || row.retiredAt) return null;
  row.retiredAt = now.toISOString();
  return { ...row };
}

/** Use it again (plan decision 10): undoes Retire. Null when it's in use already. */
export async function restorePickupPoint(id: string): Promise<PickupPointRow | null> {
  const row = sampleStore().pickupPoints.get(id);
  if (!row || !row.retiredAt) return null;
  row.retiredAt = null;
  return { ...row };
}
```

The second test expects `addPickupPoint("atlantis", …)` to be null: the `known` check refuses a campus the store has no point on. A campus whose every point was retired still counts, because retired rows stay. (A physical campus always has its two seeded points, so the action's check against the campuses and this one agree.)

- [ ] **Step 4: Write Featured**

Create `lib/data/featured.ts`:

```ts
import { randomUUID } from "node:crypto";
import { drawFeatured } from "@/lib/featured";
import { addDays } from "@/lib/staff/rules";
import type { CampusChoice, Seller } from "@/lib/types";
import { listedListings, liveSellerRows, toSeller } from "./catalog";
import type { FeaturedPinRow } from "./rows";
import { sampleStore } from "./store";

// Featured today from the store (staff tools spec 2.8, plan decision 9). Who may be featured: Verified, open (approved,
// not paused) and with at least one listed listing. Pins for the campus and day come first, in the order they were
// made, and ignore the week's break; the other places come from the fair daily draw, the campus's own first. A
// campus's row is recorded the first time it's drawn that day (by `${campus}:${day}`, "all" for visitors who haven't
// chosen one), so it stays the same all day and a seller shown there sits out that campus's next six days. Adding or
// removing a pin for a day forgets that campus's row for the day, so the next view draws again.

/** The homepage's four places (homepage spec 7.10). */
export const FEATURED_PLACES = 4;
/** A seller shown in a campus's row sits out its draws for this many days after (the trust page's week's break). */
export const REST_DAYS = 6;
/** Rows older than this are tidied away as new ones are drawn. */
const KEEP_DAYS = 7;

const drawKey = (campus: string, day: string) => `${campus}:${day}`;

function eligibleSellers(): Seller[] {
  const listed = new Set(listedListings().map((listing) => listing.sellerSlug));
  return liveSellerRows()
    .filter((row) => row.verified && listed.has(row.slug))
    .map(toSeller);
}

/** The sellers an admin may pin (spec 2.8), by name. */
export async function featuredChoices(): Promise<Seller[]> {
  return eligibleSellers().sort((a, b) => a.name.localeCompare(b.name));
}

function pinsFor(campus: string, day: string): FeaturedPinRow[] {
  return [...sampleStore().featuredPins.values()].filter((pin) => pin.campusSlug === campus && pin.day === day);
}

function tidy(day: string): void {
  const { featuredDraws, featuredPins } = sampleStore();
  const oldest = addDays(day, -KEEP_DAYS);
  for (const [key, row] of featuredDraws) {
    if (row.day < oldest) featuredDraws.delete(key);
  }
  for (const [id, pin] of featuredPins) {
    if (pin.day < oldest) featuredPins.delete(id);
  }
}

/**
 * A campus's Featured row for a SAST day (spec 2.8): the recorded row when there is one, else a new draw, recorded. A
 * seller who has stopped being eligible since drops out, and the place stays empty until tomorrow (plan decision 9).
 */
export async function featuredFor(campus: CampusChoice, day: string): Promise<Seller[]> {
  const store = sampleStore();
  const eligible = eligibleSellers();
  const key = drawKey(campus, day);
  let row = store.featuredDraws.get(key);
  if (!row) {
    const resting = new Set<string>();
    for (let back = 1; back <= REST_DAYS; back += 1) {
      for (const slug of store.featuredDraws.get(drawKey(campus, addDays(day, -back)))?.sellerSlugs ?? []) resting.add(slug);
    }
    const pinned = pinsFor(campus, day).map((pin) => pin.sellerSlug);
    const drawn = drawFeatured(eligible, campus, day, FEATURED_PLACES, { pinned, resting });
    row = { key, campusSlug: campus, day, sellerSlugs: drawn.map((seller) => seller.slug) };
    store.featuredDraws.set(key, row);
    tidy(day);
  }
  const bySlug = new Map(eligible.map((seller) => [seller.slug, seller]));
  return row.sellerSlugs.flatMap((slug) => bySlug.get(slug) ?? []);
}

/** A pin (spec 2.8), or why not: a seller who can't be featured, already pinned there that day, or 4 pins already. */
export async function addPin({
  sellerSlug,
  campusSlug,
  day,
  staffId,
  now,
}: {
  sellerSlug: string;
  campusSlug: string;
  day: string;
  staffId: string;
  now: Date;
}): Promise<FeaturedPinRow | "not-eligible" | "taken" | "full"> {
  if (!eligibleSellers().some((seller) => seller.slug === sellerSlug)) return "not-eligible";
  const pins = pinsFor(campusSlug, day);
  if (pins.some((pin) => pin.sellerSlug === sellerSlug)) return "taken";
  if (pins.length >= FEATURED_PLACES) return "full";
  const pin: FeaturedPinRow = {
    id: `pin-${randomUUID()}`,
    sellerSlug,
    campusSlug,
    day,
    pinnedBy: staffId,
    createdAt: now.toISOString(),
  };
  const store = sampleStore();
  store.featuredPins.set(pin.id, pin);
  store.featuredDraws.delete(drawKey(campusSlug, day));
  return { ...pin };
}

/** Removes a pin, and that campus's row for its day, so it's drawn again. The pin, or null when there's none. */
export async function removePin(id: string): Promise<FeaturedPinRow | null> {
  const store = sampleStore();
  const pin = store.featuredPins.get(id);
  if (!pin) return null;
  store.featuredPins.delete(id);
  store.featuredDraws.delete(drawKey(pin.campusSlug, pin.day));
  return { ...pin };
}

/** A pin as the admin's Featured page lists it. */
export type PinView = FeaturedPinRow & { sellerName: string; pinnedByName: string };

/** Pins from `fromDay` on, soonest first, then by campus, then in the order made. */
export async function listPins(fromDay: string): Promise<PinView[]> {
  const store = sampleStore();
  return [...store.featuredPins.values()]
    .filter((pin) => pin.day >= fromDay)
    .sort((a, b) => a.day.localeCompare(b.day) || a.campusSlug.localeCompare(b.campusSlug))
    .map((pin) => ({
      ...pin,
      sellerName: store.sellers.get(pin.sellerSlug)?.name ?? pin.sellerSlug,
      pinnedByName: (pin.pinnedBy ? store.accounts.get(pin.pinnedBy)?.firstName : undefined) ?? "Deleted account",
    }));
}
```

The pins' test expects "Phone fix" (pretoria, today) before "Nail bar" (all, 20 October): sorted by day first.

- [ ] **Step 5: Read them in the data layer**

In `lib/data/index.ts`:
1. Delete `import { pickupPoints } from "@/data/fixtures/pickup-points";` and `import { drawFeatured } from "@/lib/featured";` (if F's version still has them).
2. Add, among the `./…` imports in alphabetical order:

```ts
import { featuredFor } from "./featured";
import { pickupPointById, pointsInUse } from "./pickup-points";
```

and add `tagPickupPoints` to the `./tags` import.
3. Replace `getFeatured` and its comment with:

```ts
/**
 * Today's featured sellers (spec 7.10; staff tools spec 2.8). `day` is the SAST date, so the row changes at midnight in
 * South Africa. Not cached: it reads and records the day's row in the store (staff tools plan decision 9), and the
 * homepage's section renders per request already, after connection().
 */
export async function getFeatured({ campus, day }: { campus: CampusChoice; day: string }): Promise<readonly Seller[]> {
  return featuredFor(campus, day);
}
```

4. Replace `getPickupPoints` with:

```ts
/** The pickup points in use (staff tools plan decision 10): what onboarding, Edit shop and the listing form offer. */
export async function getPickupPoints(): Promise<readonly PickupPoint[]> {
  "use cache";
  tagPickupPoints();
  return pointsInUse();
}
```

5. In `getListingDetail`, add `  tagPickupPoints();` straight after its `tagListings();` line, and replace `const pickupPoint = pickupPoints.find((point) => point.id === listing.pickupPointId) ?? null;` with:

```ts
  // Retired or not: a listing keeps its point, marked "no longer used" (staff tools plan decision 10).
  const pickupPoint = pickupPointById(listing.pickupPointId);
```

6. If `toSeller` or `liveSellerRows` is now unused in `index.ts`, lint says so: keep whichever `getVerifiedSellers`, `searchListings` and `getSellerSlugs` still use, and drop the rest from the `./catalog` import.

In `lib/data/shops.ts` (F Task 5), replace `import { pickupPoints } from "@/data/fixtures/pickup-points";` with `import { pickupPointName } from "./pickup-points";` (among the `./…` imports), and replace

```ts
const spotName = (id: string | null) => pickupPoints.find((point) => point.id === id)?.name ?? null;
```

with

```ts
// Retired points keep their names in the export (staff tools plan decision 10).
const spotName = (id: string | null) => pickupPointName(id);
```

- [ ] **Step 6: Run them to make sure they pass**

Run: `pnpm test lib/data`
Expected: PASS: 7 Featured tests, 5 pickup point tests and 2 more data layer tests; F's shops and accounts tests still pass (Tech corner's export still names "Library entrance").

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 14 more unit tests than after Task 5. `components/home/FeaturedToday.test.tsx` passes unchanged: the store's first draw for Midrand is the same four Midrand sellers (Task 17 gives it a fresh store per test). If F's onboarding, Edit shop or listing form tests mock `getPickupPoints`, they don't change; if one reads the fixture straight, it still matches the store's points in use.

- [ ] **Step 8: Hand over for commit**

Files: `lib/data/featured.ts`, `lib/data/featured.test.ts`, `lib/data/pickup-points.ts`, `lib/data/pickup-points.test.ts`, `lib/data/index.ts`, `lib/data/index.test.ts`, `lib/data/shops.ts`.
Message: `feat: Featured from the store (Verified, open and listed sellers, pins first, the week's break, each day's row recorded) and pickup points in the store (add, rename, retire, use again); forms offer the points in use and listings keep a retired one (staff tools spec 2.3 and 2.8)`

---

### Task 7: Hub posts, RSVPs and slot requests from the store

The data behind the Hub's tools and the real RSVP and Request a slot (spec 2.4 and 2.5; plan decisions 11, 13 and 14): public pages read published posts only, with RSVPs counted; staff list, write and edit posts; students RSVP and ask for slots; staff answer them. Server Actions come in Tasks 14 and 15.

**Files:**
- Create: `lib/data/hub-posts.ts`, `lib/data/hub-posts.test.ts`
- Modify: `lib/data/index.ts`, `lib/data/index.test.ts`

- [ ] **Step 1: Write the tests**

Create `lib/data/hub-posts.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { PostFields } from "@/lib/staff/post-rules";
import {
  addRsvp,
  answerBooking,
  canEditPost,
  getPostRow,
  hasRsvp,
  HUB_BANNER_IMAGE,
  latestBooking,
  listBookings,
  listPostsForStaff,
  openBookingCount,
  publishedPost,
  publishedPosts,
  removeRsvp,
  requestSlot,
  saveHubPost,
} from "./hub-posts";
import { resetSampleStore, sampleStore } from "./store";

const TODAY = "2026-10-14";
const NOW = new Date("2026-10-14T08:42:00.000Z");
const LATER = new Date("2026-10-15T09:00:00.000Z");

const event: PostFields = {
  kind: "event",
  title: "Market day at the Hub",
  campusSlug: "midrand",
  startsAt: "2026-11-20T16:00:00.000Z",
  place: "The Hub, Block C",
  capacity: 30,
  summary: "Bring what you sell.",
  body: "Tables are free.",
  published: true,
};

const save = (overrides: Partial<Parameters<typeof saveHubPost>[0]> = {}) =>
  saveHubPost({ id: null, fields: event, cover: null, authorId: "acc-mentor", now: NOW, ...overrides });

const slot = (accountId: string, postId = "h-002") =>
  requestSlot({ postId, accountId, help: "Pricing my cakes.", time: "After 13:30", today: TODAY, now: NOW });

beforeEach(() => {
  resetSampleStore();
});

describe("the public pages' posts (staff tools spec 2.4, plan decisions 11 and 13)", () => {
  it("gives only published posts, as part B's shape, with RSVPs added to an event's count", async () => {
    sampleStore().hubPosts.get("h-013")!.published = false;
    expect(publishedPosts()).toHaveLength(17);
    expect(publishedPost("h-013")).toBeNull();
    expect(publishedPost("h-001")).toMatchObject({ id: "h-001", going: 12, capacity: 80 });
    expect(publishedPost("h-001")).not.toHaveProperty("authorId");
    await addRsvp("h-001", "acc-student", TODAY, NOW);
    expect(publishedPost("h-001")?.going).toBe(13);
    expect(publishedPost("h-nope")).toBeNull();
  });
});

describe("staff writing posts (staff tools spec 2.4, plan decisions 11 and 12)", () => {
  it("lists every post for staff, drafts too, newest change first, naming who wrote it", async () => {
    const draft = (await save({ fields: { ...event, published: false } }))!;
    const rows = await listPostsForStaff();
    expect(rows).toHaveLength(19);
    expect(rows[0]).toMatchObject({ id: draft.row.id, published: false, authorName: "Naledi" });
    expect(rows.find((row) => row.id === "h-002")?.authorName).toBe("Naledi");
    expect(rows.find((row) => row.id === "h-001")?.authorName).toBe("The Hub");
  });

  it("saves a new post with an h- id, the Hub's banner for a cover, and nobody going yet", async () => {
    const saved = (await save())!;
    expect(saved).toMatchObject({ created: true, publishedNow: true });
    expect(saved.row).toMatchObject({
      id: expect.stringMatching(/^h-[0-9a-f-]{36}$/),
      image: HUB_BANNER_IMAGE,
      going: 0,
      published: true,
      publishedAt: NOW.toISOString(),
      authorId: "acc-mentor",
      createdAt: NOW.toISOString(),
    });
    expect(publishedPost(saved.row.id)?.title).toBe("Market day at the Hub");
  });

  it("keeps a draft from the public until it's published, and dates it from then", async () => {
    const draft = (await save({ fields: { ...event, published: false } }))!;
    expect(draft.row.publishedAt).toBeNull();
    expect(publishedPost(draft.row.id)).toBeNull();
    const published = (await save({ id: draft.row.id, now: LATER }))!;
    expect(published).toMatchObject({ created: false, publishedNow: true, row: { publishedAt: LATER.toISOString() } });
    const edited = (await save({ id: draft.row.id, now: new Date("2026-10-16T09:00:00.000Z") }))!;
    expect(edited).toMatchObject({ publishedNow: false, row: { publishedAt: LATER.toISOString() } });
  });

  it("edits a post, keeping its cover and author unless a new cover comes, and fits `going` to its kind", async () => {
    const tip = { ...event, kind: "tip" as const, campusSlug: "all", startsAt: null, place: null, capacity: null };
    const edited = (await save({ id: "h-001", fields: tip, authorId: "acc-admin" }))!;
    expect(edited.row).toMatchObject({ kind: "tip", going: null, image: { src: "/placeholders/hub/h-001.svg" }, authorId: null });
    const cover = { src: "/photos/ph-00000000-0000-4000-8000-000000000000", alt: "" };
    expect((await save({ id: "h-001", cover }))!.row).toMatchObject({ kind: "event", going: 0, image: cover });
    expect(await save({ id: "h-nope" })).toBeNull();
    expect((await getPostRow("h-001"))?.title).toBe("Market day at the Hub");
  });

  it("lets a mentor edit their own posts, and an admin any", async () => {
    const naledis = (await getPostRow("h-002"))!;
    const hubs = (await getPostRow("h-001"))!;
    expect(canEditPost({ id: "acc-mentor", roles: ["mentor"] }, naledis)).toBe(true);
    expect(canEditPost({ id: "acc-mentor", roles: ["mentor"] }, hubs)).toBe(false);
    expect(canEditPost({ id: "acc-admin", roles: ["admin"] }, hubs)).toBe(true);
  });
});

describe("RSVP (staff tools spec 2.5, plan decision 13)", () => {
  it("adds a student once to an upcoming event, and cancels", async () => {
    expect(await addRsvp("h-001", "acc-student", TODAY, NOW)).toBe("going");
    expect(await addRsvp("h-001", "acc-student", TODAY, NOW)).toBe("already");
    expect(await hasRsvp("h-001", "acc-student")).toBe(true);
    expect(await removeRsvp("h-001", "acc-student")).toBe(true);
    expect(await removeRsvp("h-001", "acc-student")).toBe(false);
    expect(await hasRsvp("h-001", "acc-student")).toBe(false);
  });

  it("refuses a full event, a past one, a draft, and anything that isn't an event", async () => {
    sampleStore().hubPosts.get("h-003")!.going = 40;
    expect(await addRsvp("h-003", "acc-student", TODAY, NOW)).toBe("full");
    expect(await addRsvp("h-011", "acc-student", TODAY, NOW)).toBe("closed");
    expect(await addRsvp("h-002", "acc-student", TODAY, NOW)).toBe("closed");
    expect(await addRsvp("h-013", "acc-student", TODAY, NOW)).toBe("closed");
    sampleStore().hubPosts.get("h-005")!.published = false;
    expect(await addRsvp("h-005", "acc-student", TODAY, NOW)).toBe("closed");
  });
});

describe("slot requests (staff tools spec 2.4 and 2.5, plan decisions 13 and 14)", () => {
  it("takes one open request per student per office hours, and tells the caller who wrote the post", async () => {
    const made = await slot("acc-seller");
    expect(made).toMatchObject({
      authorId: "acc-mentor",
      postTitle: "Office hours: pricing your hustle",
      booking: { id: expect.stringMatching(/^bk-[0-9a-f-]{36}$/), status: "open", help: "Pricing my cakes." },
    });
    expect(await slot("acc-seller")).toBe("open-already");
    expect(await slot("acc-student", "h-007")).toBe("open-already");
    expect(await slot("acc-seller", "h-012")).toBe("closed");
    expect(await slot("acc-seller", "h-001")).toBe("closed");
  });

  it("shows the student where their latest request stands", async () => {
    expect(await latestBooking("h-007", "acc-student")).toMatchObject({
      id: "bk-s1",
      postTitle: "Office hours: your first listing",
      studentName: "Thandi",
      status: "open",
    });
    expect(await latestBooking("h-002", "acc-student")).toBeNull();
  });

  it("lists open requests first, newest first, then answered ones; an answer is given once", async () => {
    const made = (await slot("acc-seller")) as Exclude<Awaited<ReturnType<typeof slot>>, string>;
    expect((await listBookings()).map((booking) => booking.id)).toEqual([made.booking.id, "bk-s1"]);
    expect(await openBookingCount()).toBe(2);
    expect(await answerBooking("bk-s1", "accepted", "acc-mentor", LATER)).toEqual({
      accountId: "acc-student",
      postId: "h-007",
      postTitle: "Office hours: your first listing",
      studentName: "Thandi",
    });
    expect(await answerBooking("bk-s1", "declined", "acc-mentor", LATER)).toBeNull();
    expect((await listBookings()).map((booking) => [booking.id, booking.status])).toEqual([
      [made.booking.id, "open"],
      ["bk-s1", "accepted"],
    ]);
    expect(sampleStore().hubBookings.get("bk-s1")).toMatchObject({ answeredAt: LATER.toISOString(), answeredBy: "acc-mentor" });
  });

  it("lets a student ask again once their request is answered", async () => {
    await answerBooking("bk-s1", "declined", "acc-mentor", LATER);
    expect(typeof (await slot("acc-student", "h-007"))).toBe("object");
  });
});
```

In `lib/data/index.test.ts`, append at the end of the file:

```ts

describe("the Hub's posts from the store (staff tools plan decisions 11 and 13)", () => {
  it("keeps a draft off the feed, the homepage's row and its page", async () => {
    sampleStore().hubPosts.get("h-001")!.published = false;
    expect((await getHubPostIds())).not.toContain("h-001");
    expect(await getHubPost("h-001")).toBeNull();
    const feed = await getHubPosts({ kinds: ["event"], from: "2026-10-14" });
    expect(feed.map((post) => post.id)).not.toContain("h-001");
    const events = await getHubEvents({ campus: "all", limit: 20, from: "2026-10-14" });
    expect(events.map((item) => item.id)).not.toContain("h-001");
  });

  it("counts RSVPs into an event's going", async () => {
    sampleStore().hubRsvps.set("h-003:acc-student", {
      key: "h-003:acc-student",
      postId: "h-003",
      accountId: "acc-student",
      createdAt: "2026-10-14T08:00:00.000Z",
    });
    expect((await getHubPost("h-003"))?.going).toBe(24);
  });
});
```

(Add `getHubEvents`, `getHubPost`, `getHubPostIds` and `getHubPosts` to the file's `./index` import if they aren't there.)

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test lib/data/hub-posts.test.ts lib/data/index.test.ts`
Expected: FAIL: `hub-posts.ts` doesn't exist, and the data layer still reads the Hub fixture.

- [ ] **Step 3: Write the Hub's posts, RSVPs and slot requests**

Create `lib/data/hub-posts.ts`:

```ts
import { randomUUID } from "node:crypto";
import { hasPassed } from "@/lib/hub";
import { isAdmin } from "@/lib/staff/roles";
import type { PostFields } from "@/lib/staff/post-rules";
import type { Account, HubBooking, HubPost, HubPostKind, ImageRef } from "@/lib/types";
import type { HubBookingRow, HubPostRow } from "./rows";
import { sampleStore } from "./store";

// The Hub's posts (staff tools spec 2.4; plan decisions 11 to 14), moved from the fixture into the store so staff can
// write them: public pages read published posts only, as part B's HubPost, with an event's RSVPs added to its count;
// staff list, write and edit them, drafts included. RSVPs and slot requests live here too (spec 2.5). Only Server
// Actions write; pages read. Times and "today" come from the caller.

/** A post with no cover shows the Hub's banner art (plan decision 11). */
export const HUB_BANNER_IMAGE: ImageRef = { src: "/placeholders/hub/banner.svg", alt: "" };

/** What a sample post's author, or a deleted one, is called. */
const THE_HUB = "The Hub";
const DELETED = "Deleted account";

const rsvpKey = (postId: string, accountId: string) => `${postId}:${accountId}`;

function rsvpCount(postId: string): number {
  return [...sampleStore().hubRsvps.values()].filter((row) => row.postId === postId).length;
}

/** A published row as part B's HubPost: `going` is the count before Vossie's RSVPs, plus them (plan decision 13). */
function toHubPost(row: HubPostRow): HubPost {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    campusSlug: row.campusSlug,
    publishedAt: row.publishedAt ?? row.createdAt,
    startsAt: row.startsAt,
    place: row.place,
    capacity: row.capacity,
    going: row.going === null ? null : row.going + rsvpCount(row.id),
    summary: row.summary,
    body: row.body,
    image: { ...row.image },
  };
}

/** The published posts, for the feed, the homepage's What's on and post pages. A draft is staff's only (spec 2.4). */
export function publishedPosts(): HubPost[] {
  return [...sampleStore().hubPosts.values()].filter((row) => row.published).map(toHubPost);
}

/** A published post's page; null for a draft or an unknown id, which answer 404. */
export function publishedPost(id: string): HubPost | null {
  const row = sampleStore().hubPosts.get(id);
  return row?.published ? toHubPost(row) : null;
}

/** A post in the Hub's list (/hub/manage). */
export type StaffPostSummary = {
  id: string;
  kind: HubPostKind;
  title: string;
  campusSlug: string;
  startsAt: string | null;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
  authorId: string | null;
  /** The author's first name, or "The Hub" for a sample post or one whose author has left. */
  authorName: string;
};

/** Every post, drafts included, most recently changed first (spec 3, /hub/manage). */
export async function listPostsForStaff(): Promise<StaffPostSummary[]> {
  const { hubPosts, accounts } = sampleStore();
  return [...hubPosts.values()]
    .reverse()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      campusSlug: row.campusSlug,
      startsAt: row.startsAt,
      published: row.published,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      authorId: row.authorId,
      authorName: (row.authorId ? accounts.get(row.authorId)?.firstName : undefined) ?? THE_HUB,
    }));
}

/** A post's row, drafts included, for the editor. A copy. */
export async function getPostRow(id: string): Promise<HubPostRow | null> {
  const row = sampleStore().hubPosts.get(id);
  return row ? structuredClone(row) : null;
}

/** Mentors edit their own posts; admins edit any, the samples included (plan decision 11). */
export function canEditPost(account: Pick<Account, "id" | "roles">, post: Pick<HubPostRow, "authorId">): boolean {
  return isAdmin(account) || post.authorId === account.id;
}

export type PostSave = {
  /** Null for a new post. */
  id: string | null;
  fields: PostFields;
  /** A new cover (one of the Hub's stored photos), or null to keep the current one (the banner for a new post). */
  cover: ImageRef | null;
  /** Who's saving: a new post's author. An edit keeps the post's author. */
  authorId: string;
  now: Date;
};

/**
 * Saves a post (spec 2.4): a new one with an id of "h-" and a UUID, or changes to an existing one. A post is dated from
 * when it's first published. An event's count starts at 0; a post that stops being an event has none. Null when `id`
 * isn't a post. Server Actions only: it makes ids.
 */
export async function saveHubPost(
  save: PostSave,
): Promise<{ row: HubPostRow; created: boolean; publishedNow: boolean } | null> {
  const { hubPosts } = sampleStore();
  const existing = save.id ? hubPosts.get(save.id) : undefined;
  if (save.id && !existing) return null;
  const at = save.now.toISOString();
  const { published, ...fields } = save.fields;
  const publishedNow = published && !existing?.publishedAt;
  const going = fields.kind === "event" ? (existing?.going ?? 0) : null;
  const row: HubPostRow = {
    id: existing?.id ?? `h-${randomUUID()}`,
    ...fields,
    going,
    image: save.cover ? { ...save.cover } : (existing?.image ?? { ...HUB_BANNER_IMAGE }),
    published,
    publishedAt: existing?.publishedAt ?? (published ? at : null),
    authorId: existing ? existing.authorId : save.authorId,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
  };
  hubPosts.set(row.id, row);
  return { row: structuredClone(row), created: !existing, publishedNow };
}

// --- RSVP (staff tools spec 2.5, plan decision 13) -----------------------------------------------------------------

export type RsvpResult = "going" | "already" | "full" | "closed";

/** RSVP: a published event that hasn't passed (`today` is the SAST date), with a place left. */
export async function addRsvp(postId: string, accountId: string, today: string, now: Date): Promise<RsvpResult> {
  const { hubPosts, hubRsvps } = sampleStore();
  const row = hubPosts.get(postId);
  if (!row?.published || row.kind !== "event" || hasPassed(row, today)) return "closed";
  const key = rsvpKey(postId, accountId);
  if (hubRsvps.has(key)) return "already";
  if (row.capacity !== null && (row.going ?? 0) + rsvpCount(postId) >= row.capacity) return "full";
  hubRsvps.set(key, { key, postId, accountId, createdAt: now.toISOString() });
  return "going";
}

/** Cancel my RSVP. False when there was none. */
export async function removeRsvp(postId: string, accountId: string): Promise<boolean> {
  return sampleStore().hubRsvps.delete(rsvpKey(postId, accountId));
}

export async function hasRsvp(postId: string, accountId: string): Promise<boolean> {
  return sampleStore().hubRsvps.has(rsvpKey(postId, accountId));
}

// --- Slot requests (staff tools spec 2.4 and 2.5, plan decisions 13 and 14) -----------------------------------------

function toBooking(row: HubBookingRow): HubBooking {
  const { hubPosts, accounts } = sampleStore();
  const post = hubPosts.get(row.postId);
  return {
    id: row.id,
    postId: row.postId,
    postTitle: post?.title ?? "Office hours that were removed",
    startsAt: post?.startsAt ?? null,
    studentName: accounts.get(row.accountId)?.firstName ?? DELETED,
    help: row.help,
    time: row.time,
    status: row.status,
    createdAt: row.createdAt,
  };
}

/**
 * Request a slot (spec 2.5): published office hours that haven't passed. One open request per student per office
 * hours (plan decision 13). The new request, the post's author (to tell) and its title.
 */
export async function requestSlot({
  postId,
  accountId,
  help,
  time,
  today,
  now,
}: {
  postId: string;
  accountId: string;
  help: string;
  time: string;
  today: string;
  now: Date;
}): Promise<{ booking: HubBookingRow; authorId: string | null; postTitle: string } | "open-already" | "closed"> {
  const { hubPosts, hubBookings } = sampleStore();
  const post = hubPosts.get(postId);
  if (!post?.published || post.kind !== "office-hours" || hasPassed(post, today)) return "closed";
  for (const row of hubBookings.values()) {
    if (row.postId === postId && row.accountId === accountId && row.status === "open") return "open-already";
  }
  const booking: HubBookingRow = {
    id: `bk-${randomUUID()}`,
    postId,
    accountId,
    help,
    time,
    status: "open",
    createdAt: now.toISOString(),
    answeredAt: null,
    answeredBy: null,
  };
  hubBookings.set(booking.id, booking);
  return { booking: { ...booking }, authorId: post.authorId, postTitle: post.title };
}

/** The student's newest request for these office hours, for its page; null when they haven't asked. */
export async function latestBooking(postId: string, accountId: string): Promise<HubBooking | null> {
  const rows = [...sampleStore().hubBookings.values()]
    .filter((row) => row.postId === postId && row.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows.length > 0 ? toBooking(rows[0]) : null;
}

/** The office-hours queue (plan decision 14): open requests, newest first, then the 30 most recently answered. */
export async function listBookings(): Promise<HubBooking[]> {
  const rows = [...sampleStore().hubBookings.values()];
  const open = rows.filter((row) => row.status === "open").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const answered = rows
    .filter((row) => row.status !== "open")
    .sort((a, b) => (b.answeredAt ?? "").localeCompare(a.answeredAt ?? ""))
    .slice(0, 30);
  return [...open, ...answered].map(toBooking);
}

/** How many requests wait for an answer, for Overview and the Hub's list. */
export async function openBookingCount(): Promise<number> {
  return [...sampleStore().hubBookings.values()].filter((row) => row.status === "open").length;
}

/**
 * Accept or Decline (spec 2.4): an open request is answered once (plan decision 23). The student and the office
 * hours, for the notification and the audit entry; null when it wasn't open.
 */
export async function answerBooking(
  id: string,
  answer: "accepted" | "declined",
  staffId: string,
  now: Date,
): Promise<{ accountId: string; postId: string; postTitle: string; studentName: string } | null> {
  const row = sampleStore().hubBookings.get(id);
  if (!row || row.status !== "open") return null;
  Object.assign(row, { status: answer, answeredAt: now.toISOString(), answeredBy: staffId });
  const view = toBooking(row);
  return { accountId: row.accountId, postId: row.postId, postTitle: view.postTitle, studentName: view.studentName };
}
```

The draft test expects an edit to keep the post's author (`authorId: null` on `h-001` after an admin's edit): an edit never makes its editor the author.

- [ ] **Step 4: Read them in the data layer**

In `lib/data/index.ts`:
1. Replace `import { hubBanner, hubPosts } from "@/data/fixtures/hub";` with `import { hubBanner } from "@/data/fixtures/hub";`, and add, among the `./…` imports in alphabetical order, `import { publishedPost, publishedPosts } from "./hub-posts";`. Add `tagHub` to the `./tags` import.
2. In `getHubEvents`, add `  tagHub();` straight after its `"use cache";` line, and replace `hubPosts.filter((post) => post.kind !== "tip")` with `publishedPosts().filter((post) => post.kind !== "tip")`.
3. In `getHubPosts`, add `  tagHub();` straight after its `"use cache";` line, and replace `hubPosts.filter((post) => kinds.includes(post.kind))` with `publishedPosts().filter((post) => kinds.includes(post.kind))`.
4. Replace the bodies of `getHubPost` and `getHubPostIds`, keeping their comments, with:

```ts
export async function getHubPost(id: string): Promise<HubPost | null> {
  "use cache";
  tagHub();
  // A draft or an unknown id has no page (staff tools plan decision 11).
  return publishedPost(id);
}
```

```ts
export async function getHubPostIds(): Promise<readonly string[]> {
  "use cache";
  tagHub();
  return publishedPosts().map((post) => post.id);
}
```

5. Above `getHubPostIds`, change the comment to `/** Every published post's id, so each post page is prerendered (community spec 3). A new post's page renders on its first request (staff tools plan decision 11). */`.

- [ ] **Step 5: Run them to make sure they pass**

Run: `pnpm test lib/data`
Expected: PASS: 12 Hub post tests and 2 more data layer tests. Part B's feed, What's on and post page tests still pass: the store's published posts are the fixture's.

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 14 more unit tests than after Task 6.

- [ ] **Step 7: Hand over for commit**

Files: `lib/data/hub-posts.ts`, `lib/data/hub-posts.test.ts`, `lib/data/index.ts`, `lib/data/index.test.ts`.
Message: `feat: the Hub's posts in the store (published ones for the public, drafts for staff, RSVPs counted into going), RSVPs, and slot requests with one open per student and a queue for staff (staff tools spec 2.4 and 2.5)`

---

### Task 8: The mentor dashboard's data, and what deleting and exporting an account do to the staff tools

The data behind `/mentor` (spec 2.6; plan decisions 15 and 16), and POPIA's side of every staff table (plan decisions 6, 11, 13 and 16): deleting an account forgets it everywhere the staff tools keep it, and the data export gains the account's RSVPs and slot requests, but never a mentor's notes.

**Files:**
- Create: `lib/data/mentors.ts`, `lib/data/mentors.test.ts`
- Create: `lib/data/staff-privacy.ts`, `lib/data/staff-privacy.test.ts`
- Modify: `lib/data/accounts.ts`, `lib/data/accounts.test.ts`
- Modify: `lib/auth/actions.ts`, `lib/auth/account-actions.test.ts`

- [ ] **Step 1: Write the tests**

Create `lib/data/mentors.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { addNote, getMentoredShop, listNotes, mentoredShops } from "./mentors";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T10:00:00.000Z");
const naledi = { id: "acc-mentor", roles: ["mentor"] as const };
const pieter = { id: "acc-admin", roles: ["admin"] as const };
const zanele = { id: "acc-zanele", roles: ["mentor"] as const };

beforeEach(() => {
  resetSampleStore();
});

describe("the mentor dashboard (staff tools spec 2.6, plan decision 15)", () => {
  it("gives a mentor their shops with the last 14 days' numbers and flags, never messages", async () => {
    expect(await mentoredShops(naledi, NOW)).toEqual([
      {
        slug: "tech-corner",
        name: "Tech corner",
        campusSlug: "midrand",
        ownerName: "Sipho",
        ownerId: "acc-seller",
        badge: "responsive",
        status: "approved",
        mentorId: "acc-mentor",
        mentorName: "Naledi",
        counts: { enquiries: 2, due: 2, repliedInTime: 2, salesConfirmed: 0 },
        flags: [],
      },
    ]);
  });

  it("gives an admin every assigned shop, and another mentor only theirs", async () => {
    expect((await mentoredShops(pieter, NOW)).map((row) => row.slug)).toEqual(["tech-corner"]);
    expect(await mentoredShops(zanele, NOW)).toEqual([]);
  });

  it("flags a paused shop, and one with no enquiries in the 14 days", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    const later = new Date("2026-11-14T10:00:00.000Z");
    expect((await mentoredShops(naledi, later))[0].flags).toEqual(["no-enquiries", "paused"]);
  });

  it("leaves out a shop with no mentor, or one waiting for approval", async () => {
    sampleStore().sellerProfiles.get("acc-pending")!.mentorId = "acc-mentor";
    sampleStore().sellerProfiles.get("acc-seller")!.mentorId = null;
    expect(await mentoredShops(pieter, NOW)).toEqual([]);
  });

  it("opens a shop's mentor page only for its mentor or an admin", async () => {
    expect((await getMentoredShop("tech-corner", naledi, NOW))?.name).toBe("Tech corner");
    expect((await getMentoredShop("tech-corner", pieter, NOW))?.mentorName).toBe("Naledi");
    expect(await getMentoredShop("tech-corner", zanele, NOW)).toBeNull();
    expect(await getMentoredShop("hair-studio", pieter, NOW)).toBeNull();
  });
});

describe("notes and check-ins (staff tools spec 2.6, plan decision 16)", () => {
  it("lists what's been written about the owner, newest first, and adds to it", async () => {
    expect((await listNotes("acc-seller")).map((note) => [note.id, note.kind, note.authorName])).toEqual([
      ["mn-s2", "note", "Naledi"],
      ["mn-s1", "check-in", "Naledi"],
    ]);
    const id = await addNote({
      ownerId: "acc-seller",
      kind: "check-in",
      checkInOn: "2026-10-14",
      text: "Called him about photos.",
      author: { id: "acc-admin", firstName: "Pieter" },
      now: NOW,
    });
    expect(id).toMatch(/^mn-[0-9a-f-]{36}$/);
    expect((await listNotes("acc-seller"))[0]).toEqual({
      id,
      kind: "check-in",
      checkInOn: "2026-10-14",
      text: "Called him about photos.",
      authorName: "Pieter",
      createdAt: NOW.toISOString(),
    });
    expect(await listNotes("acc-student")).toEqual([]);
  });
});
```

Create `lib/data/staff-privacy.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { recordAudit } from "./audit";
import { exportStaffToolsData, forgetAccountInStaffTools } from "./staff-privacy";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("deleting an account, in the staff tools (POPIA; plan decisions 6, 11, 13 and 16)", () => {
  it("keeps every audit entry, signing the account's own as Deleted account and stripping it from those about it", async () => {
    const staff = { id: "acc-admin", firstName: "Pieter" };
    const shop = { kind: "shop" as const, id: "tech-corner", name: "Tech corner" };
    await recordAudit({ staff, action: "shop-paused", target: shop, detail: "Reported.", subjectId: "acc-seller", now: NOW });
    await recordAudit({ staff, action: "shop-verified", target: { ...shop, id: "hair-studio", name: "Hair studio" }, now: NOW });
    await forgetAccountInStaffTools("acc-seller");
    await forgetAccountInStaffTools("acc-admin");
    const rows = [...sampleStore().auditLog.values()];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      staffId: null,
      staffName: "Deleted account",
      targetId: "",
      targetName: "Deleted account",
      detail: "",
      subjectId: null,
    });
    expect(rows[1]).toMatchObject({ staffName: "Deleted account", targetName: "Hair studio" });
  });

  it("deletes the notes about a seller, and keeps a deleted mentor's notes, unsigned", async () => {
    await forgetAccountInStaffTools("acc-mentor");
    expect([...sampleStore().mentorNotes.values()].map((note) => [note.authorId, note.authorName])).toEqual([
      [null, "Deleted account"],
      [null, "Deleted account"],
    ]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect(sampleStore().hubPosts.get("h-002")?.authorId).toBeNull();
    await forgetAccountInStaffTools("acc-seller");
    expect(sampleStore().mentorNotes.size).toBe(0);
  });

  it("deletes a student's RSVPs and slot requests, and unsigns the answers, pins and reports staff left", async () => {
    const store = sampleStore();
    store.hubRsvps.set("h-001:acc-student", { key: "h-001:acc-student", postId: "h-001", accountId: "acc-student", createdAt: NOW.toISOString() });
    store.hubBookings.set("bk-2", { ...store.hubBookings.get("bk-s1")!, id: "bk-2", accountId: "acc-seller", status: "accepted", answeredBy: "acc-admin" });
    store.featuredPins.set("pin-1", { id: "pin-1", sellerSlug: "nail-bar", campusSlug: "all", day: "2026-10-14", pinnedBy: "acc-admin", createdAt: NOW.toISOString() });
    await forgetAccountInStaffTools("acc-student");
    expect(store.hubRsvps.size).toBe(0);
    expect([...store.hubBookings.keys()]).toEqual(["bk-2"]);
    await forgetAccountInStaffTools("acc-admin");
    expect(store.hubBookings.get("bk-2")?.answeredBy).toBeNull();
    expect(store.featuredPins.get("pin-1")?.pinnedBy).toBeNull();
  });
});

describe("the data export, in the staff tools (plan decision 16)", () => {
  it("holds the account's RSVPs and slot requests, with no ids, and never a mentor's notes", async () => {
    sampleStore().hubRsvps.set("h-001:acc-student", {
      key: "h-001:acc-student",
      postId: "h-001",
      accountId: "acc-student",
      createdAt: NOW.toISOString(),
    });
    expect(await exportStaffToolsData("acc-student")).toEqual({
      hubRsvps: [{ event: "Pitch night", at: NOW.toISOString() }],
      slotRequests: [
        {
          officeHours: "Office hours: your first listing",
          help: "I want to sell my braiding on Vossie and don't know how to write the listing or what to charge.",
          time: "Any time after 13:30",
          status: "open",
          at: "2026-10-13T10:15:00.000Z",
        },
      ],
    });
    expect(JSON.stringify(await exportStaffToolsData("acc-seller"))).not.toContain("Replies fast");
  });
});
```

In `lib/data/accounts.test.ts`:
1. In the data export test for `acc-seller` (E and F extended it), add after F's `listings: …` property of the expected object:

```ts
      hubRsvps: [],
      slotRequests: [],
```

(If the build's test lists `Object.keys(data!)` instead, add `"hubRsvps", "slotRequests"` at the end of that list.)

2. Add this test at the end of the "deleting an account" `describe`:

```ts

  it("forgets the account in the staff tools: notes about its shop and its slot requests go (staff tools plan, Task 8)", async () => {
    await deleteAccountData("acc-seller");
    expect(sampleStore().mentorNotes.size).toBe(0);
    await deleteAccountData("acc-student");
    expect(sampleStore().hubBookings.size).toBe(0);
  });
```

In `lib/auth/account-actions.test.ts` (D Task 6):
1. Below its `vi.mock("next/server", …)` line, add (if it isn't there already):

```ts
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
```

2. Add this test at the end of its "deleting an account" `describe` (the one with "deletes the account and everything with it, signs out, and goes home with a toast"):

```ts

  it("expires the Hub's cached posts, since the account's RSVPs went with it (staff tools plan, Task 8)", async () => {
    await signedInAs("acc-student");
    await redirectOf(() => deleteAccount(form({ confirm: "yes" })));
    expect(request.updatedTags).toContain("hub");
  });
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test lib/data/mentors.test.ts lib/data/staff-privacy.test.ts lib/data/accounts.test.ts lib/auth/account-actions.test.ts`
Expected: FAIL: the two modules don't exist, the export has no Hub fields, deletion leaves the staff tables, and nothing expires the `hub` tag.

- [ ] **Step 3: Write the mentor dashboard's data**

Create `lib/data/mentors.ts`:

```ts
import { randomUUID } from "node:crypto";
import { MENTOR_WINDOW_DAYS, mentorFlags } from "@/lib/staff/mentor";
import { isAdmin } from "@/lib/staff/roles";
import type { Account, MentoredShop } from "@/lib/types";
import type { MentorNoteRow } from "./rows";
import { recentCounts } from "./shop-stats";
import { sampleStore } from "./store";

// The mentor dashboard's data (staff tools spec 2.6; plan decisions 15 and 16). A mentor sees the shops assigned to
// them; an admin sees every assigned shop. Each has its last 14 days' numbers and its flags: numbers, never messages
// (FUNCTION-MAP K1). Notes and check-ins are about the shop's owner, shared with every mentor and admin who can open
// the shop's page, and never shown to the seller. Times come from the caller.

const DELETED = "Deleted account";

/** The shops `viewer` may follow (plan decision 15): theirs, or for an admin every assigned shop. By name. */
export async function mentoredShops(viewer: Pick<Account, "id" | "roles">, now: Date): Promise<MentoredShop[]> {
  const { sellerProfiles, sellers, accounts } = sampleStore();
  const rows: MentoredShop[] = [];
  for (const profile of sellerProfiles.values()) {
    const mentorId = profile.mentorId ?? null;
    if (!mentorId || profile.status === "pending" || !profile.sellerSlug) continue;
    if (!isAdmin(viewer) && mentorId !== viewer.id) continue;
    const shop = sellers.get(profile.sellerSlug);
    const owner = accounts.get(profile.accountId);
    if (!shop || !owner) continue;
    const counts = await recentCounts(shop.slug, MENTOR_WINDOW_DAYS, now);
    rows.push({
      slug: shop.slug,
      name: shop.name,
      campusSlug: shop.campusSlug,
      ownerName: owner.firstName,
      ownerId: owner.id,
      badge: shop.badge,
      status: profile.status,
      mentorId,
      mentorName: accounts.get(mentorId)?.firstName ?? DELETED,
      counts,
      flags: mentorFlags(counts, profile.status),
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** One shop's row, when `viewer` may open its mentor page; null otherwise, which the page answers with the 404. */
export async function getMentoredShop(
  slug: string,
  viewer: Pick<Account, "id" | "roles">,
  now: Date,
): Promise<MentoredShop | null> {
  return (await mentoredShops(viewer, now)).find((row) => row.slug === slug) ?? null;
}

/** A note or check-in as the shop's mentor page lists it. */
export type MentorNoteView = Pick<MentorNoteRow, "id" | "kind" | "checkInOn" | "text" | "authorName" | "createdAt">;

/** What's been written about a shop's owner, newest first. */
export async function listNotes(ownerId: string): Promise<MentorNoteView[]> {
  return [...sampleStore().mentorNotes.values()]
    .filter((row) => row.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ id, kind, checkInOn, text, authorName, createdAt }) => ({ id, kind, checkInOn, text, authorName, createdAt }));
}

/** A new note or check-in about a shop's owner. Its id. Server Actions only: it makes ids. */
export async function addNote({
  ownerId,
  kind,
  checkInOn,
  text,
  author,
  now,
}: {
  ownerId: string;
  kind: MentorNoteRow["kind"];
  checkInOn: string | null;
  text: string;
  author: { id: string; firstName: string };
  now: Date;
}): Promise<string> {
  const id = `mn-${randomUUID()}`;
  sampleStore().mentorNotes.set(id, {
    id,
    ownerId,
    kind,
    checkInOn: kind === "check-in" ? checkInOn : null,
    text,
    authorId: author.id,
    authorName: author.firstName,
    createdAt: now.toISOString(),
  });
  return id;
}
```

- [ ] **Step 4: Write what deleting and exporting do**

Create `lib/data/staff-privacy.ts`:

```ts
import type { BookingStatus } from "@/lib/types";
import { sampleStore } from "./store";

// What deleting an account does to the staff tools' tables, and what the account's data export holds of them (POPIA;
// staff tools plan decisions 6, 11, 13 and 16). lib/data/accounts.ts calls both. This module imports only the store,
// so nothing that imports accounts.ts is imported here, and there's no cycle.

const DELETED = "Deleted account";

/**
 * Forgets an account in the staff tools:
 * - the audit log keeps every entry (plan decision 6): the account's own say "Deleted account", and those about it
 *   lose its name, id and reason;
 * - notes and check-ins about it go; ones it wrote stay, as "Deleted account", and its shops lose it as their mentor;
 * - its RSVPs and slot requests go;
 * - its posts stay for the Hub (plan decision 11), and the answers, pins and closed reports it left stay, unsigned.
 */
export async function forgetAccountInStaffTools(accountId: string): Promise<void> {
  const store = sampleStore();
  for (const row of store.auditLog.values()) {
    if (row.staffId === accountId) Object.assign(row, { staffId: null, staffName: DELETED });
    if (row.subjectId === accountId) {
      Object.assign(row, { subjectId: null, targetId: "", targetName: DELETED, detail: "" });
    }
  }
  for (const [id, row] of store.mentorNotes) {
    if (row.ownerId === accountId) store.mentorNotes.delete(id);
    else if (row.authorId === accountId) Object.assign(row, { authorId: null, authorName: DELETED });
  }
  for (const profile of store.sellerProfiles.values()) {
    if (profile.mentorId === accountId) profile.mentorId = null;
  }
  for (const [key, row] of store.hubRsvps) {
    if (row.accountId === accountId) store.hubRsvps.delete(key);
  }
  for (const [id, row] of store.hubBookings) {
    if (row.accountId === accountId) store.hubBookings.delete(id);
    else if (row.answeredBy === accountId) row.answeredBy = null;
  }
  for (const row of store.hubPosts.values()) {
    if (row.authorId === accountId) row.authorId = null;
  }
  for (const row of store.featuredPins.values()) {
    if (row.pinnedBy === accountId) row.pinnedBy = null;
  }
  for (const row of store.reports.values()) {
    if (row.closedBy === accountId) row.closedBy = null;
  }
}

/** The staff tools' part of the data export: no ids, and no mentor's notes (spec 2.6, plan decision 16). */
export type StaffToolsExport = {
  /** Events the account said it's going to. */
  hubRsvps: { event: string; at: string }[];
  slotRequests: { officeHours: string; help: string; time: string; status: BookingStatus; at: string }[];
};

export async function exportStaffToolsData(accountId: string): Promise<StaffToolsExport> {
  const { hubRsvps, hubBookings, hubPosts } = sampleStore();
  const title = (postId: string) => hubPosts.get(postId)?.title ?? "A removed post";
  return {
    hubRsvps: [...hubRsvps.values()]
      .filter((row) => row.accountId === accountId)
      .map((row) => ({ event: title(row.postId), at: row.createdAt })),
    slotRequests: [...hubBookings.values()]
      .filter((row) => row.accountId === accountId)
      .map((row) => ({ officeHours: title(row.postId), help: row.help, time: row.time, status: row.status, at: row.createdAt })),
  };
}
```

- [ ] **Step 5: Teach the account functions and the delete action about the staff tools**

In `lib/data/accounts.ts`:
1. Below F's `./shops` import, add `import { exportStaffToolsData, forgetAccountInStaffTools, type StaffToolsExport } from "./staff-privacy";`.
2. In the `AccountExport` type, add after F's `listings: ListingExport[];`:

```ts
  /** The Hub's events the account said it's going to, and its office-hours slot requests (staff tools plan decision 16). */
  hubRsvps: StaffToolsExport["hubRsvps"];
  slotRequests: StaffToolsExport["slotRequests"];
```

3. In `exportAccountData`, add `const hub = await exportStaffToolsData(accountId);` straight before the `return {`, and add these as the last properties of the returned object, after F's `listings: selling.listings,`:

```ts
    hubRsvps: hub.hubRsvps,
    slotRequests: hub.slotRequests,
```

4. In `deleteAccountData`, straight after F's line `await forgetShopOf(accountId);`, add:

```ts
  // Then the staff tools: notes about it, its RSVPs and slot requests go; the audit log forgets it (staff tools plan, Task 8).
  await forgetAccountInStaffTools(accountId);
```

In `lib/auth/actions.ts` (D Task 6, F Task 7), in `deleteAccount`, straight after F's line `if (account.seller) sellersChanged();`, add:

```ts
  // Its RSVPs have gone, so events' counts change (staff tools plan, Task 8).
  hubChanged();
```

and add `hubChanged` to the file's `import { … } from "@/lib/data/tags";` (F added `sellersChanged` there).

- [ ] **Step 6: Run them to make sure they pass**

Run: `pnpm test lib/data lib/auth`
Expected: PASS: 6 mentor tests, 4 privacy tests, 1 more accounts test and 1 more account-actions test.

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 12 more unit tests than after Task 7.

- [ ] **Step 8: Hand over for commit**

Files: `lib/data/mentors.ts`, `lib/data/mentors.test.ts`, `lib/data/staff-privacy.ts`, `lib/data/staff-privacy.test.ts`, `lib/data/accounts.ts`, `lib/data/accounts.test.ts`, `lib/auth/actions.ts`, `lib/auth/account-actions.test.ts`.
Message: `feat: the mentor dashboard's data (assigned shops, 14 days' numbers, flags, notes and check-ins); deleting an account forgets it in the staff tools, and the export gains RSVPs and slot requests, never mentors' notes (staff tools spec 2.6, POPIA)`

---

### Task 9: The staff gate, the notices, and the frame, tables and confirm pages

What every staff page and action shares (spec 2.1, 2.9, 3 and 4; plan decisions 1, 18 and 20): `requireStaff()` and `staffMetadata()`, the form-state names and the notice a page shows once after an action, the staff frame, a wordless skeleton for the static shell, the stacking table and the confirm page's body, and a test helper. No page uses them yet.

**Files:**
- Create: `lib/staff/access.ts`, `lib/staff/access.test.ts`
- Create: `lib/staff/form-state.ts`, `lib/staff/form-state.test.ts`
- Create: `components/staff/StaffFrame.tsx`, `components/staff/StaffSkeleton.tsx`, `components/staff/StaffTable.tsx`, `components/staff/ConfirmAction.tsx`, `components/staff/staff-parts.test.tsx`
- Create: `tests/helpers/staff.ts`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Read the docs**

Read, in `node_modules/next/dist/docs/01-app/`:
- `03-api-reference/04-functions/not-found.md`, "Calling `notFound()` after streaming has started": the page keeps status 200 and shows the nearest not-found UI in place of the `<Suspense>` boundary, with `noindex` (plan decision 1). It also works in Server Functions and Route Handlers.
- `03-api-reference/04-functions/generate-metadata.md`, "With Cache Components": metadata that reads request data streams in when the page has other request-time parts, which every staff page does.
- `02-guides/authentication-with-cache-components.md`: the session is read inside `<Suspense>`.

- [ ] **Step 2: Write the test helper**

Create `tests/helpers/staff.ts`:

```ts
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import { createSession } from "@/lib/data/sessions";
import type { FakeRequest } from "./next-request";

// Shared by the staff tools' unit tests (staff tools plan, Task 9), with tests/helpers/next-request.ts.

/** When the staff tools' tests run: a Wednesday morning in October 2026, 10:42 in South Africa. */
export const STAFF_NOW = new Date("2026-10-14T08:42:00.000Z");

/** The browser signs in as `accountId`: a stored session for 30 days, and its token in the cookie. */
export async function signedInAs(request: FakeRequest, accountId: string): Promise<void> {
  const token = `token-${accountId}`;
  await createSession({
    key: hashToken(token),
    accountId,
    createdAt: STAFF_NOW,
    expiresAt: new Date(STAFF_NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
  });
  request.cookies.set(SESSION_COOKIE, token);
}

/** A form's fields as the browser posts them: a list posts its field once per value. */
export function form(fields: Readonly<Record<string, string | readonly string[] | File>>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of typeof value === "string" || value instanceof File ? [value] : value) data.append(name, item);
  }
  return data;
}
```

- [ ] **Step 3: Write the gate's and the notices' tests**

Create `lib/staff/access.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { requireStaff, staffMetadata } from "./access";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

describe("the staff gate (staff tools spec 2.1, plan decision 1)", () => {
  it("sends a signed-out visitor to sign in, coming back to the page afterwards", async () => {
    expect(await redirectOf(() => requireStaff("admin", "/admin/reports"))).toBe("/login?next=%2Fadmin%2Freports");
  });

  it("gives anyone signed in without the role the 404, not a forbidden page", async () => {
    await signedInAs(request, "acc-student");
    await expect(requireStaff("hub", "/hub/manage")).rejects.toThrow("notFound");
    await signedInAs(request, "acc-mentor");
    await expect(requireStaff("admin", "/admin")).rejects.toThrow("notFound");
  });

  it("lets staff in, as their own account", async () => {
    await signedInAs(request, "acc-mentor");
    expect((await requireStaff("mentor", "/mentor")).id).toBe("acc-mentor");
    await signedInAs(request, "acc-admin");
    expect((await requireStaff("hub", "/hub/manage")).firstName).toBe("Pieter");
  });

  it("titles the tab for staff, and \"Page not found\" for everyone else, never indexed", async () => {
    const robots = { index: false, follow: false };
    expect(await staffMetadata("admin", "Reports")).toEqual({ title: "Page not found", robots });
    await signedInAs(request, "acc-mentor");
    expect(await staffMetadata("admin", "Reports")).toEqual({ title: "Page not found", robots });
    await signedInAs(request, "acc-admin");
    expect(await staffMetadata("admin", "Reports")).toEqual({ title: "Reports", robots });
  });
});
```

Create `lib/staff/form-state.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState, writeFormState } from "@/lib/auth/form-state";
import { resetSampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { clearStaffForm, declineForm, HUB_NOTICE, leaveNotice, takeNotice } from "./form-state";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(async () => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
  await signedInAs(request, "acc-admin");
});

describe("the notice after a staff action (staff tools spec 4)", () => {
  it("is shown once, by the page the action lands on", async () => {
    await leaveNotice("approved", STAFF_NOW);
    expect(await takeNotice()).toBe("approved");
    expect(await takeNotice()).toBeNull();
  });

  it("keeps a student's Hub notice apart from staff's", async () => {
    await leaveNotice("rsvp", STAFF_NOW, HUB_NOTICE);
    expect(await takeNotice()).toBeNull();
    expect(await takeNotice(HUB_NOTICE)).toBe("rsvp");
  });
});

describe("the staff forms' state (accounts plan decision 3)", () => {
  it("keeps one form's state per thing, and clears it", async () => {
    await writeFormState(declineForm("crochet-corner"), { errors: ["reason-missing"], values: {}, notice: null }, STAFF_NOW);
    expect(await readFormState(declineForm("tech-corner"))).toBeNull();
    await clearStaffForm(declineForm("crochet-corner"));
    expect(await readFormState(declineForm("crochet-corner"))).toBeNull();
  });
});
```

- [ ] **Step 4: Write the parts' test**

Create `components/staff/staff-parts.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfirmAction } from "./ConfirmAction";
import { StaffFrame } from "./StaffFrame";
import { StaffSkeleton } from "./StaffSkeleton";
import { StaffTable } from "./StaffTable";

const noop = async () => {};

describe("the staff frame (staff tools spec section 3)", () => {
  it("has the page's heading, the sections the account may use, and the open one marked", () => {
    render(
      <StaffFrame account={{ roles: ["mentor"] }} area="Hub tools" title="Hub posts" current="/hub/manage" notice={null}>
        <p>The page</p>
      </StaffFrame>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Hub posts" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Staff tools" });
    expect(within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Hub posts", "/hub/manage"],
      ["Mentoring", "/mentor"],
    ]);
    expect(within(nav).getByRole("link", { name: "Hub posts" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("The page")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("gives an admin every section, and shows the last action's notice as a status line (spec 4)", () => {
    render(
      <StaffFrame account={{ roles: ["admin"] }} area="Admin console" title="Sellers" current="/admin/sellers" notice="Approved.">
        <p>The page</p>
      </StaffFrame>,
    );
    expect(within(screen.getByRole("navigation", { name: "Staff tools" })).getAllByRole("link")).toHaveLength(8);
    expect(screen.getByRole("status")).toHaveTextContent("Approved.");
  });

  it("is a wordless skeleton in the static shell, saying nothing about the page (plan decision 1)", () => {
    const { container } = render(<StaffSkeleton />);
    expect(container.textContent).toBe("");
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("staff tables (staff tools spec 2.9 and 4, plan decision 20)", () => {
  it("has a caption and header cells, keeps its roles, and labels each cell for phones, hidden from screen readers", () => {
    render(
      <StaffTable
        caption="Waiting for approval"
        columns={["Shop", "Campus"]}
        rows={[{ key: "tech-corner", cells: ["Tech corner", "Midrand"] }]}
        empty="Nobody is waiting."
      />,
    );
    const table = screen.getByRole("table", { name: "Waiting for approval" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Shop", "Campus"]);
    const cell = within(table).getAllByRole("cell")[1];
    expect(cell).toHaveTextContent("CampusMidrand");
    expect(within(cell).getByText("Campus")).toHaveAttribute("aria-hidden", "true");
    expect(within(table).getByRole("cell", { name: "Midrand" })).toBe(cell);
  });

  it("says so when there's nothing to list", () => {
    render(<StaffTable caption="Waiting" columns={["Shop"]} rows={[]} empty="Nobody is waiting." />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Nobody is waiting.")).toBeInTheDocument();
  });
});

describe("confirm pages (staff tools spec 2.9 and 4, plan decision 18)", () => {
  const props = {
    id: "decline-crochet-corner",
    lead: "Crochet corner won't be approved yet.",
    consequences: ["Lerato sees your reason on their selling page.", "They can change the shop and send it again."],
    action: noop,
    hidden: { shop: "crochet-corner" },
    reasonHint: "The seller sees it.",
    reason: "",
    errors: [],
    confirmLabel: "Decline Crochet corner",
    keepHref: "/admin/sellers/crochet-corner",
  };

  it("repeats what will happen, asks for the reason, and names its button; Keep it goes back", () => {
    render(<ConfirmAction {...props} />);
    expect(screen.getByText("Crochet corner won't be approved yet.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    const reason = screen.getByLabelText("Reason");
    expect(reason).toBeRequired();
    expect(reason).toHaveAccessibleDescription("The seller sees it. Up to 500 characters.");
    expect(screen.getByRole("button", { name: "Decline Crochet corner" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/sellers/crochet-corner");
    expect(document.querySelector('input[name="shop"]')).toHaveValue("crochet-corner");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows what was typed, and what's wrong, at the top and by the field", () => {
    const message = "Keep the reason to 500 characters.";
    render(
      <ConfirmAction {...props} reason={"x".repeat(501)} errors={[{ message, fieldId: "decline-crochet-corner-reason" }]} />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveTextContent(message);
    const reason = screen.getByLabelText("Reason");
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(reason).toHaveValue("x".repeat(501));
    expect(reason).toHaveAccessibleDescription(`The seller sees it. Up to 500 characters. Error: ${message}`);
  });
});
```

- [ ] **Step 5: Run them to make sure they fail**

Run: `pnpm test lib/staff/access.test.ts lib/staff/form-state.test.ts components/staff`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 6: Write the gate and the forms' names**

Create `lib/staff/access.ts`:

```ts
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { signInHref } from "@/lib/next-path";
import type { Account, StaffArea } from "@/lib/types";
import { canUse } from "./roles";

/**
 * The one gate for every staff page, Server Action and the CSV route (staff tools spec 2.1, plan decision 1): a
 * signed-out visitor goes to sign in and comes back to `nextPath`; anyone signed in without the role gets the 404,
 * not a "forbidden" page, so staff pages aren't advertised. Pages call it inside <Suspense>, after the page has
 * started streaming, so the visitor sees the site's 404 page (status 200, noindex); actions and the route call it
 * first.
 */
export async function requireStaff(area: StaffArea, nextPath: string): Promise<Account> {
  const account = await getViewer();
  if (!account) redirect(signInHref(nextPath));
  if (!canUse(account, area)) notFound();
  return account;
}

/**
 * A staff page's tab title (plan decision 1): its own for staff, "Page not found" for everyone else, so neither the
 * static shell nor the title names the page. Never indexed. It reads the session, so the title streams in with the
 * page's request-time parts.
 */
export async function staffMetadata(area: StaffArea, title: string): Promise<Metadata> {
  const account = await getViewer().catch(() => null);
  const robots = { index: false, follow: false };
  return canUse(account, area) ? { title, robots } : { title: "Page not found", robots };
}
```

Create `lib/staff/form-state.ts`:

```ts
import { readFormState, writeFormState } from "@/lib/auth/form-state";
import { getSessionKey } from "@/lib/auth/session";
import { clearFormState } from "@/lib/data/form-states";

// The staff forms' names in D's form state (accounts plan decision 3): their errors and typed values, per browser
// session, for 10 minutes. One per form and thing, so two drafts never mix. And the notice a page shows once after an
// action (spec 4: "Status changes after a post show a status message at the top of the page").

/** Staff pages' notice: one per session, taken by the page the action lands on. */
export const STAFF_NOTICE = "staff-notice";
/** A student's notice on a Hub post or its slot request page (plan decision 13), kept apart from staff's. */
export const HUB_NOTICE = "hub-notice";

export const declineForm = (slug: string) => `decline:${slug}`;
export const shopPauseForm = (slug: string) => `shop-pause:${slug}`;
export const dismissForm = (reportId: string) => `dismiss:${reportId}`;
export const hideForm = (reportId: string) => `hide:${reportId}`;
export const reportPauseForm = (reportId: string) => `report-pause:${reportId}`;
export const PIN_FORM = "featured-pin";
export const pointAddForm = (campusSlug: string) => `point-add:${campusSlug}`;
export const pointRenameForm = (id: string) => `point-rename:${id}`;
export const postForm = (id: string | null) => (id ? `post:${id}` : "post:new");
export const noteForm = (slug: string) => `mentor-note:${slug}`;
export const checkInForm = (slug: string) => `check-in:${slug}`;
export const slotForm = (postId: string) => `slot:${postId}`;

/** Forgets this browser's state for `form`. Signed out, it does nothing. */
export async function clearStaffForm(form: string): Promise<void> {
  const sessionKey = await getSessionKey();
  if (sessionKey) await clearFormState(sessionKey, form);
}

/** Leaves a notice code (lib/staff/notices.ts) for the page the action lands on. Server Actions only. */
export async function leaveNotice(code: string, now: Date, key = STAFF_NOTICE): Promise<void> {
  await writeFormState(key, { errors: [], values: {}, notice: code }, now);
}

/**
 * The notice an action left, read and cleared in one go, so it shows once (messaging plan decision 7's pattern).
 * Request-time: call it inside <Suspense>.
 */
export async function takeNotice(key = STAFF_NOTICE): Promise<string | null> {
  const state = await readFormState(key);
  if (!state?.notice) return null;
  await clearStaffForm(key);
  return state.notice;
}
```

- [ ] **Step 7: Write the frame, the skeleton, the table and the confirm page's body**

Create `components/staff/StaffFrame.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { STAFF_SECTIONS } from "@/lib/staff/paths";
import { canUse } from "@/lib/staff/roles";
import type { Account } from "@/lib/types";

type StaffFrameProps = {
  account: Pick<Account, "roles">;
  /** The eyebrow: "Admin console", "Hub tools" or "Mentoring". */
  area: string;
  title: string;
  /** The section link this page sits under, marked as the open one. */
  current: string;
  /** The last action's notice, worded (lib/staff/notices.ts), or null. */
  notice: string | null;
  children: ReactNode;
};

/**
 * The staff frame (spec section 3): a heading, a row of links to the sections the account may use, the last action's
 * notice as a status line (spec 4), and the content. Server-rendered, with no client code (spec 2.9). Its links don't
 * prefetch: every staff page reads the session, and Overview runs the badge calculation (plan decision 19).
 */
export function StaffFrame({ account, area, title, current, notice, children }: StaffFrameProps) {
  const sections = STAFF_SECTIONS.filter((section) => canUse(account, section.area));
  return (
    <div className="page staff-page">
      <header className="staff-head">
        <p className="eyebrow">{area}</p>
        <h1 className="staff-title">{title}</h1>
      </header>
      <nav aria-label="Staff tools" className="staff-nav">
        <ul>
          {sections.map((section) => (
            <li key={section.href}>
              <Link
                href={section.href}
                prefetch={false}
                aria-current={section.href === current ? "page" : undefined}
                className="staff-nav-link"
              >
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {notice && (
        <p role="status" className="form-notice staff-notice">
          {notice}
        </p>
      )}
      <div className="staff-body">{children}</div>
    </div>
  );
}
```

Create `components/staff/StaffSkeleton.tsx`:

```tsx
/**
 * A staff page's static shell (plan decision 1): shapes only, with no words, so the shell says nothing about the page
 * to someone who gets the 404 in its place. It keeps the frame's height while the page streams in.
 */
export function StaffSkeleton() {
  return (
    <div className="page staff-page" aria-hidden="true">
      <span className="skeleton staff-skeleton-eyebrow" />
      <span className="skeleton staff-skeleton-title" />
      <span className="skeleton staff-skeleton-nav" />
      <span className="skeleton staff-skeleton-body" />
    </div>
  );
}
```

Create `components/staff/StaffTable.tsx`:

```tsx
import type { ReactNode } from "react";

type StaffTableProps = {
  caption: string;
  columns: readonly string[];
  rows: ReadonlyArray<{ key: string; cells: readonly ReactNode[] }>;
  /** What to say instead of an empty table. */
  empty: string;
};

/**
 * A staff table (spec 2.9 and 4, plan decision 20): a caption and header cells. Below the tablet step each row
 * stacks into a card and each cell shows its column's name in a span screen readers skip, since the header cells
 * already name it. Explicit roles keep it a table for screen readers when CSS changes how it displays.
 */
export function StaffTable({ caption, columns, rows, empty }: StaffTableProps) {
  if (rows.length === 0) return <p className="staff-empty">{empty}</p>;
  return (
    <table role="table" className="staff-table">
      <caption className="staff-caption">{caption}</caption>
      <thead role="rowgroup">
        <tr role="row">
          {columns.map((column) => (
            <th key={column} role="columnheader" scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((row) => (
          <tr key={row.key} role="row">
            {row.cells.map((cell, index) => (
              <td key={columns[index]} role="cell">
                <span className="staff-cell-label" aria-hidden="true">
                  {columns[index]}
                </span>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Create `components/staff/ConfirmAction.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { REASON_MAX } from "@/lib/staff/rules";

type ConfirmActionProps = {
  /** The form's id prefix, unique across the pages Next keeps ("decline-crochet-corner"). */
  id: string;
  /** What will happen, in a sentence (spec 4: confirm pages repeat what will happen). */
  lead: ReactNode;
  /** What follows from it, a line each. */
  consequences: readonly string[];
  action: (formData: FormData) => Promise<void>;
  /** The hidden fields that say what it's about. */
  hidden: Readonly<Record<string, string>>;
  /** Who sees the reason. */
  reasonHint: string;
  /** What was typed before a failed post, or "". */
  reason: string;
  errors: readonly FormError[];
  /** The button names what it does to what: "Decline Crochet corner" (spec 4). */
  confirmLabel: string;
  /** Where Keep it goes back to. */
  keepHref: string;
};

/**
 * A destructive action's confirm page (spec 2.9, plan decision 18): what will happen, the reason (required, up to 500
 * characters), the button that does it, and Keep it, a link back. A plain form: it works without the app's
 * JavaScript, and the server checks everything again.
 */
export function ConfirmAction({
  id,
  lead,
  consequences,
  action,
  hidden,
  reasonHint,
  reason,
  errors,
  confirmLabel,
  keepHref,
}: ConfirmActionProps) {
  const fieldId = `${id}-reason`;
  const error = errorFor(errors, fieldId);
  return (
    <div className="staff-confirm">
      <p className="staff-confirm-lead">{lead}</p>
      {consequences.length > 0 && (
        <ul className="staff-confirm-list">
          {consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <ErrorSummary id={`${id}-summary`} errors={errors} />
      <form action={action} noValidate className="form-stack">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="form-field">
          <label htmlFor={fieldId} className="form-label">
            Reason
          </label>
          <p id={`${fieldId}-hint`} className="form-hint">
            {reasonHint} Up to {REASON_MAX} characters.
          </p>
          <FieldError id={`${fieldId}-error`} message={error} />
          <textarea
            id={fieldId}
            name="reason"
            rows={4}
            required
            defaultValue={reason}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(`${fieldId}-hint`, error && `${fieldId}-error`)}
            className="form-input staff-textarea"
          />
        </div>
        <div className="staff-actions">
          <button type="submit" className="btn btn-danger">
            {confirmLabel}
          </button>
          <Link href={keepHref} prefetch={false} className="link-button">
            Keep it
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Run them to make sure they pass**

Run: `pnpm test lib/staff/access.test.ts lib/staff/form-state.test.ts components/staff`
Expected: PASS (4 gate tests, 3 form state tests, 7 parts tests).

- [ ] **Step 9: The styles**

Check none of the new classes is taken: `grep -n "\.staff-" app/globals.css` prints nothing. Then append to the end of `app/globals.css`:

```css

/* --- Staff tools: the frame, tables and confirm pages (staff tools plan, Task 9, spec 2.9 and 3) --- */
@layer components {
  /* .page and .staff-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .staff-page {
    padding: 24px 16px 64px;
  }

  .staff-head {
    display: grid;
    gap: 6px;
  }

  .staff-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: clamp(2rem, 1.7rem + 1.2vw, 2.75rem);
    line-height: 1;
    text-transform: uppercase;
  }

  /* The sections wrap onto more lines on a phone, so nothing scrolls sideways. 44px tall, 8px apart. */
  .staff-nav ul {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 20px;
  }

  .staff-nav-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    border: 1.5px solid var(--color-field);
    border-radius: 999px;
    color: var(--color-navy);
    font-weight: 600;
  }

  /* The open section: white on navy (12.6:1). */
  .staff-nav-link[aria-current="page"] {
    border-color: var(--color-navy);
    background: var(--color-navy);
    color: var(--color-white);
  }

  @media (hover: hover) and (pointer: fine) {
    .staff-nav-link:not([aria-current="page"]):hover {
      border-color: var(--color-navy);
    }
  }

  .staff-notice {
    margin-top: 20px;
  }

  .staff-body {
    display: grid;
    gap: 36px;
    margin-top: 28px;
  }

  .staff-section {
    display: grid;
    gap: 14px;
  }

  .staff-section-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 24px;
    line-height: 1.05;
    text-transform: uppercase;
  }

  .staff-empty,
  .staff-muted {
    color: var(--color-muted);
  }

  .staff-muted {
    font-size: 14px;
  }

  /* Links in staff text are underlined, so colour isn't the only sign of them. Sky-dark on white is 4.7:1. */
  .staff-body p a:not(.btn):not(.link-button),
  .staff-table td a:not(.btn):not(.staff-row-action) {
    color: var(--color-sky-dark);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* Tables (plan decision 20). Below the tablet step each row is a card and each cell names its column. */
  .staff-table {
    width: 100%;
    border-collapse: collapse;
  }

  .staff-caption {
    margin-bottom: 10px;
    color: var(--color-navy);
    font-weight: 700;
    text-align: left;
  }

  .staff-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .staff-table tbody,
  .staff-table tr,
  .staff-table td {
    display: block;
  }

  .staff-table tr {
    padding: 12px 16px;
    border: 1.5px solid var(--color-line);
    border-radius: var(--radius-card);
  }

  .staff-table tr + tr {
    margin-top: 10px;
  }

  .staff-table td {
    padding-block: 4px;
    overflow-wrap: anywhere;
  }

  /* Muted on white is 5.9:1. */
  .staff-cell-label {
    display: block;
    color: var(--color-muted);
    font-size: 13px;
  }

  /* A row's buttons and links: 44px tall, 8px apart. */
  .staff-row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .staff-row-action {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 14px;
    border: 1.5px solid var(--color-field);
    border-radius: 999px;
    color: var(--color-navy);
    font-weight: 600;
  }

  .staff-row-action-danger {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }

  /* Confirm pages (plan decision 18). */
  .staff-confirm {
    display: grid;
    gap: 18px;
    max-width: 40rem;
  }

  .staff-confirm-lead {
    color: var(--color-ink);
    font-size: 18px;
    font-weight: 600;
  }

  .staff-confirm-list {
    display: grid;
    gap: 6px;
    padding-left: 1.25rem;
    list-style: disc;
  }

  .staff-textarea {
    min-height: 7rem;
    resize: vertical;
  }

  .staff-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 20px;
  }

  /* The static shell's shapes (plan decision 1), about the frame's height. */
  .staff-skeleton-eyebrow {
    width: 8rem;
    height: 18px;
  }

  .staff-skeleton-title {
    width: min(22rem, 80%);
    height: 44px;
    margin-top: 8px;
  }

  .staff-skeleton-nav {
    height: 44px;
    margin-top: 20px;
  }

  .staff-skeleton-body {
    height: 24rem;
    margin-top: 28px;
    border-radius: var(--radius-panel);
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .staff-page {
      padding-inline: 40px;
    }

    .staff-table thead {
      position: static;
      display: table-header-group;
      width: auto;
      height: auto;
      overflow: visible;
      clip-path: none;
      white-space: normal;
    }

    .staff-table tbody {
      display: table-row-group;
    }

    .staff-table tr {
      display: table-row;
      padding: 0;
      border: 0;
      border-radius: 0;
    }

    .staff-table tr + tr {
      margin-top: 0;
    }

    .staff-table th,
    .staff-table td {
      display: table-cell;
      padding: 12px 16px 12px 0;
      border-bottom: 1.5px solid var(--color-line);
      text-align: left;
      vertical-align: top;
    }

    .staff-table th {
      color: var(--color-muted);
      font-size: 13px;
      font-weight: 600;
    }

    .staff-cell-label {
      display: none;
    }
  }
}
```

- [ ] **Step 10: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 14 more unit tests than after Task 8.

- [ ] **Step 11: Hand over for commit**

Files: `lib/staff/access.ts`, `lib/staff/access.test.ts`, `lib/staff/form-state.ts`, `lib/staff/form-state.test.ts`, `components/staff/StaffFrame.tsx`, `components/staff/StaffSkeleton.tsx`, `components/staff/StaffTable.tsx`, `components/staff/ConfirmAction.tsx`, `components/staff/staff-parts.test.tsx`, `tests/helpers/staff.ts`, `app/globals.css`.
Message: `feat: the staff gate (sign-in first, the 404 for everyone else, a title that says nothing to them), the notice after an action, and the staff frame, wordless skeleton, stacking table and confirm page (staff tools spec 2.1, 2.9, 3 and 4)`

---

### Task 10: The admin console's Server Actions

Every admin action (spec 2.2 and 2.3; plan decisions 2 to 10, 18 and 23): Approve, Decline, Verify, the Hub's Pause and Resume, mentor assignment, Dismiss, Hide the listing and Pause the account from a report, pins, and pickup points. Each checks the role first (a forged post gets the 404), validates on the server, changes the store, writes one audit entry only when something changed, tells whoever the spec says, expires what buyers' pages read, leaves a notice and ends with F's `done()`. The pages that post to them come in Tasks 11 to 13.

**Files:**
- Create: `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md` (everything a `"use server"` file exports must be an async function), `02-guides/server-actions.md` and `03-api-reference/04-functions/refresh.md`. F's `done(path)` (`lib/selling/action-helpers.ts`) is `refresh()` and then `redirect(path, RedirectType.replace)`; its `: never` return type is what lets TypeScript narrow after it.

- [ ] **Step 2: Write the actions' test**

Create `lib/staff/admin-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { listAudit } from "@/lib/data/audit";
import { getNotifications } from "@/lib/data/notifications";
import { createReport } from "@/lib/data/reports";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { ReportTarget } from "@/lib/types";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import {
  addPoint,
  approveSeller,
  assignMentor,
  declineSeller,
  dismissReport,
  hideReportedListing,
  pauseReportedShop,
  pauseSeller,
  pinSeller,
  renamePoint,
  restorePoint,
  resumeSeller,
  retirePoint,
  unpinSeller,
  verifySeller,
} from "./admin-actions";
import { declineForm, dismissForm, PIN_FORM, pointAddForm, STAFF_NOTICE } from "./form-state";

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

const asAdmin = () => signedInAs(request, "acc-admin");
const notice = async () => (await readFormState(STAFF_NOTICE))?.notice ?? null;
const lastAudit = async () => (await listAudit({ staff: null, kind: null }))[0];
const newest = async (accountId: string) => (await getNotifications(accountId, 1))[0];

function report(reporterId: string, target: ReportTarget, targetTitle: string) {
  return createReport({ reporterId, target, targetTitle, reason: "scam", detail: "", now: STAFF_NOW });
}

describe("the gate on every admin action (staff tools spec 2.1, plan decision 1)", () => {
  it("sends a signed-out visitor to sign in, and gives anyone but an admin the 404, changing nothing", async () => {
    expect(await redirectOf(() => approveSeller(form({ shop: "crochet-corner" })))).toBe(
      "/login?next=%2Fadmin%2Fsellers%2Fcrochet-corner",
    );
    await signedInAs(request, "acc-mentor");
    await expect(approveSeller(form({ shop: "crochet-corner" }))).rejects.toThrow("notFound");
    await expect(pinSeller(form({ seller: "nail-bar", campus: "all", day: "2026-10-14" }))).rejects.toThrow("notFound");
    expect(sampleStore().sellerProfiles.get("acc-pending")?.status).toBe("pending");
    expect(sampleStore().auditLog.size).toBe(0);
  });
});

describe("sellers (staff tools spec 2.3)", () => {
  it("approves a waiting shop: one audit entry, the seller told, buyers' pages expired, and a notice", async () => {
    await asAdmin();
    const redirect = await redirectSignalOf(() => approveSeller(form({ shop: "crochet-corner" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/admin/sellers/crochet-corner", "replace", true]);
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({ status: "approved", sellerSlug: "crochet-corner" });
    expect(await lastAudit()).toMatchObject({
      staffName: "Pieter",
      action: "shop-approved",
      targetKind: "shop",
      targetName: "Crochet corner",
      detail: "",
    });
    expect(await newest("acc-pending")).toMatchObject({
      kind: "shop-approved",
      text: "The Hub approved Crochet corner. You can publish your listings now.",
      href: "/sell",
    });
    expect(request.updatedTags).toEqual(["sellers"]);
    expect(await notice()).toBe("approved");
  });

  it("says nothing changed on a second press, writing no entry and sending nothing (plan decision 23)", async () => {
    await asAdmin();
    await redirectOf(() => approveSeller(form({ shop: "crochet-corner" })));
    await redirectOf(() => approveSeller(form({ shop: "crochet-corner" })));
    expect(sampleStore().auditLog.size).toBe(1);
    expect(await getNotifications("acc-pending", 5)).toHaveLength(1);
    expect(await notice()).toBe("nothing");
    expect(await redirectOf(() => approveSeller(form({ shop: "Not a slug!" })))).toBe("/admin/sellers");
  });

  it("asks for the reason before declining, keeping what was typed and changing nothing", async () => {
    await asAdmin();
    expect(await redirectOf(() => declineSeller(form({ shop: "crochet-corner", reason: " " })))).toBe(
      "/admin/sellers/crochet-corner/decline",
    );
    expect(await readFormState(declineForm("crochet-corner"))).toMatchObject({
      errors: ["reason-missing"],
      values: { reason: "" },
    });
    expect(sampleStore().sellerProfiles.get("acc-pending")?.declinedAt ?? null).toBeNull();
    expect(sampleStore().auditLog.size).toBe(0);
  });

  it("declines with the reason, which is recorded, and tells the seller where to see it", async () => {
    await asAdmin();
    expect(
      await redirectOf(() => declineSeller(form({ shop: "crochet-corner", reason: "Add a photo of your work." }))),
    ).toBe("/admin/sellers/crochet-corner");
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      declinedAt: STAFF_NOW.toISOString(),
      staffReason: "Add a photo of your work.",
    });
    expect(await lastAudit()).toMatchObject({ action: "shop-declined", detail: "Add a photo of your work." });
    expect(await newest("acc-pending")).toMatchObject({
      kind: "shop-update",
      text: "The Hub didn't approve Crochet corner yet. See why, and send it again.",
      href: "/sell",
    });
    expect(await readFormState(declineForm("crochet-corner"))).toBeNull();
    expect(await notice()).toBe("declined");
  });

  it("gives and takes Verified, telling an owner but not a sample shop, and expires buyers' pages", async () => {
    await asAdmin();
    await redirectOf(() => verifySeller(form({ shop: "tech-corner", verified: "yes" })));
    expect(sampleStore().sellers.get("tech-corner")?.verified).toBe(true);
    expect((await newest("acc-seller")).text).toBe("Tech corner is now Verified by the Hub.");
    await redirectOf(() => verifySeller(form({ shop: "hair-studio", verified: "no" })));
    expect(sampleStore().sellers.get("hair-studio")?.verified).toBe(false);
    expect((await listAudit({ staff: null, kind: null })).map((entry) => entry.action)).toEqual([
      "shop-unverified",
      "shop-verified",
    ]);
    expect(request.updatedTags).toEqual(["sellers", "sellers"]);
    expect(await notice()).toBe("unverified");
  });

  it("pauses a shop with the reason from its confirm page, and resumes it", async () => {
    await asAdmin();
    expect(await redirectOf(() => pauseSeller(form({ shop: "tech-corner", reason: "" })))).toBe(
      "/admin/sellers/tech-corner/pause",
    );
    expect(await redirectOf(() => pauseSeller(form({ shop: "tech-corner", reason: "Selling exam answers." })))).toBe(
      "/admin/sellers/tech-corner",
    );
    expect(sampleStore().sellerProfiles.get("acc-seller")).toMatchObject({ status: "paused", pausedBy: "staff" });
    expect((await newest("acc-seller")).text).toBe("The Hub paused Tech corner. See why on your dashboard.");
    await redirectOf(() => resumeSeller(form({ shop: "tech-corner" })));
    expect(sampleStore().sellerProfiles.get("acc-seller")?.status).toBe("approved");
    expect((await newest("acc-seller")).text).toBe("The Hub resumed Tech corner. Buyers can see it again.");
    expect((await listAudit({ staff: null, kind: "shops" })).map((entry) => [entry.action, entry.detail])).toEqual([
      ["shop-resumed", ""],
      ["shop-paused", "Selling exam answers."],
    ]);
  });

  it("assigns a mentor, or none, only from the accounts with the mentor role", async () => {
    await asAdmin();
    await redirectOf(() => assignMentor(form({ shop: "tech-corner", mentor: "" })));
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    await redirectOf(() => assignMentor(form({ shop: "tech-corner", mentor: "acc-mentor" })));
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
    expect((await listAudit({ staff: null, kind: "mentoring" })).map((entry) => [entry.action, entry.detail])).toEqual([
      ["mentor-assigned", "Naledi"],
      ["mentor-removed", ""],
    ]);
    await redirectOf(() => assignMentor(form({ shop: "tech-corner", mentor: "acc-student" })));
    expect(await notice()).toBe("nothing");
  });
});

describe("reports (staff tools spec 2.3, plan decision 5)", () => {
  it("dismisses a report with a note, and tells the reporter in the spec's words", async () => {
    const id = await report("acc-student", { kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    await asAdmin();
    expect(await redirectOf(() => dismissReport(form({ report: id, note: "" })))).toBe(`/admin/reports/${id}`);
    expect((await readFormState(dismissForm(id)))?.errors).toEqual(["note-missing"]);
    expect(await redirectOf(() => dismissReport(form({ report: id, note: "Looked fine." })))).toBe("/admin/reports");
    expect(sampleStore().reports.get(id)).toMatchObject({ status: "closed", outcome: "dismissed" });
    expect(await newest("acc-student")).toMatchObject({
      kind: "report-handled",
      text: "We looked at your report about Box braids, shoulder length and didn't find a problem.",
      href: "/account/privacy",
    });
    expect(await lastAudit()).toMatchObject({ action: "report-dismissed", targetKind: "report", detail: "Looked fine." });
  });

  it("hides a reported listing: every report on it closes, and the seller and each reporter are told", async () => {
    const title = "Casio fx-991ZA Plus calculator";
    const first = await report("acc-student", { kind: "listing", id: "l-001" }, title);
    await report("acc-mentor", { kind: "listing", id: "l-001" }, title);
    await asAdmin();
    expect(await redirectOf(() => hideReportedListing(form({ report: first, reason: "" })))).toBe(
      `/admin/reports/${first}/hide`,
    );
    expect(
      await redirectOf(() => hideReportedListing(form({ report: first, reason: "Exam papers aren't allowed." }))),
    ).toBe("/admin/reports");
    expect(sampleStore().listings.get("l-001")?.hiddenReason).toBe("Exam papers aren't allowed.");
    expect([...sampleStore().reports.values()].every((row) => row.outcome === "hidden")).toBe(true);
    expect(await newest("acc-seller")).toMatchObject({
      kind: "shop-update",
      text: `The Hub hid ${title}. See why in My listings.`,
      href: "/sell/listings",
    });
    for (const reporter of ["acc-student", "acc-mentor"]) {
      expect((await newest(reporter)).text, reporter).toBe(`Thanks, we've acted on your report about ${title}.`);
    }
    expect(request.updatedTags).toEqual(["listings"]);
    expect(await lastAudit()).toMatchObject({ action: "listing-hidden", targetKind: "listing", targetName: title });
  });

  it("pauses the shop behind a report, and can only dismiss a report about a request", async () => {
    const id = await report("acc-student", { kind: "seller", id: "tech-corner" }, "Tech corner");
    await asAdmin();
    await redirectOf(() => pauseReportedShop(form({ report: id, reason: "Asked buyers for deposits." })));
    expect(sampleStore().sellerProfiles.get("acc-seller")).toMatchObject({
      status: "paused",
      pausedBy: "staff",
      staffReason: "Asked buyers for deposits.",
    });
    expect(sampleStore().reports.get(id)?.outcome).toBe("paused");
    expect((await newest("acc-student")).text).toBe("Thanks, we've acted on your report about Tech corner.");
    expect(request.updatedTags).toEqual(["sellers"]);
    const aboutRequest = await report("acc-student", { kind: "request", id: "r-001" }, "A Looking For request");
    expect(await redirectOf(() => hideReportedListing(form({ report: aboutRequest, reason: "No." })))).toBe(
      "/admin/reports",
    );
    expect(await notice()).toBe("nothing");
    expect(sampleStore().reports.get(aboutRequest)?.status).toBe("open");
  });
});

describe("Featured pins (staff tools spec 2.8)", () => {
  it("pins a seller to a campus for a day, and takes the pin away", async () => {
    await asAdmin();
    expect(await redirectOf(() => pinSeller(form({ seller: "nail-bar", campus: "pretoria", day: "2026-10-14" })))).toBe(
      "/admin/featured",
    );
    const [pin] = [...sampleStore().featuredPins.values()];
    expect(pin).toMatchObject({ sellerSlug: "nail-bar", campusSlug: "pretoria", day: "2026-10-14", pinnedBy: "acc-admin" });
    expect(await lastAudit()).toMatchObject({ action: "featured-pinned", targetName: "Nail bar", detail: "Pretoria · 2026-10-14" });
    await redirectOf(() => unpinSeller(form({ pin: pin.id })));
    expect(sampleStore().featuredPins.size).toBe(0);
    expect(await lastAudit()).toMatchObject({ action: "featured-unpinned", targetName: "Nail bar" });
    expect(await notice()).toBe("unpinned");
  });

  it("says what's wrong with a pin, keeping what was chosen", async () => {
    await asAdmin();
    await redirectOf(() => pinSeller(form({ seller: "tech-corner", campus: "atlantis", day: "2026-10-13" })));
    expect(await readFormState(PIN_FORM)).toMatchObject({
      errors: ["campus-missing", "day-past"],
      values: { seller: "tech-corner", campus: "atlantis", day: "2026-10-13" },
    });
    await redirectOf(() => pinSeller(form({ seller: "tech-corner", campus: "all", day: "2026-10-14" })));
    expect((await readFormState(PIN_FORM))?.errors).toEqual(["seller-not-eligible"]);
    expect(sampleStore().featuredPins.size).toBe(0);
    expect(sampleStore().auditLog.size).toBe(0);
  });
});

describe("pickup points (staff tools spec 2.3, plan decision 10)", () => {
  it("adds a point to a campus, refusing a name it has, and expires the forms' points", async () => {
    await asAdmin();
    expect(await redirectOf(() => addPoint(form({ campus: "midrand", name: "library ENTRANCE" })))).toBe(
      "/admin/pickup-points#points-midrand",
    );
    expect(await readFormState(pointAddForm("midrand"))).toMatchObject({
      errors: ["point-name-taken"],
      values: { name: "library ENTRANCE" },
    });
    await redirectOf(() => addPoint(form({ campus: "midrand", name: "Student centre" })));
    expect([...sampleStore().pickupPoints.values()].at(-1)).toMatchObject({ campusSlug: "midrand", name: "Student centre" });
    expect(request.updatedTags).toEqual(["pickup-points"]);
    expect(await lastAudit()).toMatchObject({ action: "point-added", targetName: "Student centre", detail: "Midrand" });
    await redirectOf(() => addPoint(form({ campus: "online", name: "The hall" })));
    expect(await notice()).toBe("nothing");
  });

  it("renames, retires and uses a point again, each in the log", async () => {
    await asAdmin();
    await redirectOf(() => renamePoint(form({ point: "pp-midrand-library", name: "Library steps" })));
    await redirectOf(() => retirePoint(form({ point: "pp-midrand-library" })));
    expect(sampleStore().pickupPoints.get("pp-midrand-library")).toMatchObject({
      name: "Library steps",
      retiredAt: STAFF_NOW.toISOString(),
    });
    expect(await redirectOf(() => restorePoint(form({ point: "pp-midrand-library" })))).toBe(
      "/admin/pickup-points#points-midrand",
    );
    expect(sampleStore().pickupPoints.get("pp-midrand-library")?.retiredAt).toBeNull();
    expect(
      (await listAudit({ staff: null, kind: "pickup-points" })).map((entry) => [entry.action, entry.detail]),
    ).toEqual([
      ["point-restored", ""],
      ["point-retired", ""],
      ["point-renamed", "Was Library entrance"],
    ]);
  });
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `pnpm test lib/staff/admin-actions.test.ts`
Expected: FAIL, because `./admin-actions` doesn't exist.

- [ ] **Step 4: Write the actions**

Create `lib/staff/admin-actions.ts`:

```ts
"use server";

import { writeFormState } from "@/lib/auth/form-state";
import { ALL_CAMPUSES, ONLINE_CAMPUS } from "@/lib/campus";
import { getCampuses, getSeller } from "@/lib/data";
import { recordAudit } from "@/lib/data/audit";
import { addPin, removePin } from "@/lib/data/featured";
import { notify } from "@/lib/data/notifications";
import {
  addPickupPoint,
  isPointNameTaken,
  pickupPointById,
  renamePickupPoint,
  restorePickupPoint,
  retirePickupPoint,
} from "@/lib/data/pickup-points";
import { closeReport, closeReportsOn, getReport, type ClosedReport } from "@/lib/data/staff-reports";
import {
  approveShop,
  declineShop,
  hideListing,
  setShopMentor,
  setVerified,
  staffPauseShop,
  staffResumeShop,
  type ShopDecision,
} from "@/lib/data/staff-shops";
import { listingsChanged, pickupPointsChanged, sellersChanged } from "@/lib/data/tags";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field } from "@/lib/selling/action-helpers";
import { myListingsPath, SELL_PATH, tabFor } from "@/lib/selling/paths";
import { sastDate } from "@/lib/time";
import type { Account } from "@/lib/types";
import { requireStaff } from "./access";
import {
  clearStaffForm,
  declineForm,
  dismissForm,
  hideForm,
  leaveNotice,
  PIN_FORM,
  pointAddForm,
  pointRenameForm,
  reportPauseForm,
  shopPauseForm,
} from "./form-state";
import { listingHiddenText, reportOutcomeText, shopApprovedText, shopDecisionText } from "./notification-text";
import {
  ADMIN_FEATURED_PATH,
  ADMIN_POINTS_PATH,
  ADMIN_REPORTS_PATH,
  ADMIN_SELLERS_PATH,
  adminReportPath,
  adminSellerPath,
  declineSellerPath,
  hideReportedPath,
  pauseReportedPath,
  pauseSellerPath,
} from "./paths";
import { checkDismissNote, checkPinDay, checkPointName, checkReason } from "./rules";

// The admin console's Server Actions (staff tools spec 2.2 and 2.3). Each is a plain form's action, so it works
// before the app's JavaScript arrives. It checks the role first (a forged post gets the 404, plan decision 1),
// validates on the server, keeps errors and typed text in D's form state, changes the store through lib/data, and
// writes one audit entry, only when something changed (plan decisions 6 and 23). Then it tells whoever the spec says,
// expires what buyers' pages read, leaves a notice, and ends with done(): refresh, then a replace redirect.

// --- Shared helpers ---------------------------------------------------------------------------------------------

/** An id or slug from a hidden field, when it's one this site could have made. */
function idFrom(formData: FormData, name: string): string | null {
  const value = field(formData, name);
  return isId(value) ? value : null;
}

const staffOf = (account: Account) => ({ id: account.id, firstName: account.firstName });

/** A change that didn't happen (plan decision 23): no audit entry, nothing sent, and the page says so. */
async function nothingChanged(path: string, now: Date): Promise<never> {
  await leaveNotice("nothing", now);
  done(path);
}

/** Tells a shop's owner about the Hub's decision (plan decision 7). A sample shop has no owner to tell. */
async function tellOwner(
  decision: ShopDecision,
  what: "declined" | "paused" | "resumed" | "verified" | "unverified",
  now: Date,
): Promise<void> {
  if (!decision.ownerId) return;
  await notify({
    accountId: decision.ownerId,
    kind: "shop-update",
    subjectId: decision.slug,
    text: shopDecisionText(what, decision.name),
    href: SELL_PATH,
    now,
  });
}

/** Tells a reporter what happened to their report (spec 2.3), on privacy settings' "Reports you've made". */
async function tellReporter(closed: ClosedReport, outcome: "acted" | "dismissed", now: Date): Promise<void> {
  await notify({
    accountId: closed.reporterId,
    kind: "report-handled",
    subjectId: closed.id,
    text: reportOutcomeText(outcome, closed.title),
    href: "/account/privacy",
    now,
  });
}

/** Keeps a confirm page's or a form's errors and typed reason, and goes back to it. */
async function backWithReason(form: string, error: string, typed: string, path: string, now: Date): Promise<never> {
  await writeFormState(form, { errors: [error], values: { reason: keepTyped(typed) }, notice: null }, now);
  done(path);
}

// --- Sellers (spec 2.3) -------------------------------------------------------------------------------------------

/** Approve: a waiting shop opens (plan decision 2), and its owner is told. */
export async function approveSeller(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const path = slug ? adminSellerPath(slug) : ADMIN_SELLERS_PATH;
  const staff = await requireStaff("admin", path);
  const now = new Date();
  const decision = slug ? await approveShop(slug) : null;
  if (!decision) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "shop-approved",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    subjectId: decision.ownerId,
    now,
  });
  if (decision.ownerId) {
    await notify({
      accountId: decision.ownerId,
      kind: "shop-approved",
      subjectId: decision.slug,
      text: shopApprovedText(decision.name),
      href: SELL_PATH,
      now,
    });
  }
  sellersChanged();
  await leaveNotice("approved", now);
  done(path);
}

/** Decline, from its confirm page (plan decisions 2 and 18): the reason is required, and the seller sees it on /sell. */
export async function declineSeller(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const staff = await requireStaff("admin", slug ? declineSellerPath(slug) : ADMIN_SELLERS_PATH);
  const now = new Date();
  if (!slug) return nothingChanged(ADMIN_SELLERS_PATH, now);
  const reason = checkReason(field(formData, "reason"));
  if (reason.error) return backWithReason(declineForm(slug), reason.error, reason.value, declineSellerPath(slug), now);
  const decision = await declineShop(slug, reason.value, now);
  if (!decision) return nothingChanged(adminSellerPath(slug), now);
  await recordAudit({
    staff: staffOf(staff),
    action: "shop-declined",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    detail: reason.value,
    subjectId: decision.ownerId,
    now,
  });
  await tellOwner(decision, "declined", now);
  await clearStaffForm(declineForm(slug));
  await leaveNotice("declined", now);
  done(adminSellerPath(slug));
}

/** Verify, or remove Verified (spec 2.3): `verified` is "yes" or "no". */
export async function verifySeller(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const path = slug ? adminSellerPath(slug) : ADMIN_SELLERS_PATH;
  const staff = await requireStaff("admin", path);
  const now = new Date();
  const verified = field(formData, "verified") === "yes";
  const decision = slug ? await setVerified(slug, verified) : null;
  if (!decision) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: verified ? "shop-verified" : "shop-unverified",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    subjectId: decision.ownerId,
    now,
  });
  await tellOwner(decision, verified ? "verified" : "unverified", now);
  sellersChanged();
  await leaveNotice(verified ? "verified" : "unverified", now);
  done(path);
}

/** The Hub's Pause shop, from its confirm page (plan decisions 3 and 18). */
export async function pauseSeller(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const staff = await requireStaff("admin", slug ? pauseSellerPath(slug) : ADMIN_SELLERS_PATH);
  const now = new Date();
  if (!slug) return nothingChanged(ADMIN_SELLERS_PATH, now);
  const reason = checkReason(field(formData, "reason"));
  if (reason.error) return backWithReason(shopPauseForm(slug), reason.error, reason.value, pauseSellerPath(slug), now);
  const decision = await staffPauseShop(slug, reason.value);
  if (!decision) return nothingChanged(adminSellerPath(slug), now);
  await recordAudit({
    staff: staffOf(staff),
    action: "shop-paused",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    detail: reason.value,
    subjectId: decision.ownerId,
    now,
  });
  await tellOwner(decision, "paused", now);
  sellersChanged();
  await clearStaffForm(shopPauseForm(slug));
  await leaveNotice("paused", now);
  done(adminSellerPath(slug));
}

/** The Hub's Resume: only its own pause (plan decision 3). Nothing is lost, so no confirm page. */
export async function resumeSeller(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const path = slug ? adminSellerPath(slug) : ADMIN_SELLERS_PATH;
  const staff = await requireStaff("admin", path);
  const now = new Date();
  const decision = slug ? await staffResumeShop(slug) : null;
  if (!decision) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "shop-resumed",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    subjectId: decision.ownerId,
    now,
  });
  await tellOwner(decision, "resumed", now);
  sellersChanged();
  await leaveNotice("resumed", now);
  done(path);
}

/** A shop's mentor (spec 2.6, plan decision 15): `mentor` is an account with the mentor role, or "" for none. */
export async function assignMentor(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const path = slug ? adminSellerPath(slug) : ADMIN_SELLERS_PATH;
  const staff = await requireStaff("admin", path);
  const now = new Date();
  const raw = field(formData, "mentor");
  const mentorId = raw === "" ? null : isId(raw) ? raw : undefined;
  const changed = slug && mentorId !== undefined ? await setShopMentor(slug, mentorId) : null;
  if (!changed) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: changed.mentorName ? "mentor-assigned" : "mentor-removed",
    target: { kind: "shop", id: changed.slug, name: changed.name },
    detail: changed.mentorName ?? "",
    subjectId: changed.ownerId,
    now,
  });
  await leaveNotice(changed.mentorName ? "mentor-assigned" : "mentor-removed", now);
  done(path);
}

// --- Reports (spec 2.3, plan decision 5) --------------------------------------------------------------------------

/** Dismiss (with a note): this report closes, and its reporter hears the Hub didn't find a problem. */
export async function dismissReport(formData: FormData): Promise<void> {
  const id = idFrom(formData, "report");
  const staff = await requireStaff("admin", id ? adminReportPath(id) : ADMIN_REPORTS_PATH);
  const now = new Date();
  if (!id) return nothingChanged(ADMIN_REPORTS_PATH, now);
  const note = checkDismissNote(field(formData, "note"));
  if (note.error) {
    await writeFormState(dismissForm(id), { errors: [note.error], values: { note: keepTyped(note.value) }, notice: null }, now);
    done(adminReportPath(id));
  }
  const closed = await closeReport(id, note.value, staff.id, now);
  if (!closed) return nothingChanged(ADMIN_REPORTS_PATH, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "report-dismissed",
    target: { kind: "report", id, name: closed.title },
    detail: note.value,
    subjectId: closed.reporterId,
    now,
  });
  await tellReporter(closed, "dismissed", now);
  await clearStaffForm(dismissForm(id));
  await leaveNotice("dismissed", now);
  done(ADMIN_REPORTS_PATH);
}

/**
 * Hide the listing, from its confirm page (plan decisions 4, 5 and 18): it leaves every list and its page, every open
 * report on it closes, its seller sees why in My listings, and each reporter hears the Hub acted.
 */
export async function hideReportedListing(formData: FormData): Promise<void> {
  const id = idFrom(formData, "report");
  const staff = await requireStaff("admin", id ? hideReportedPath(id) : ADMIN_REPORTS_PATH);
  const now = new Date();
  const view = id ? await getReport(id) : null;
  if (!id || !view?.can.hide) return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reason = checkReason(field(formData, "reason"));
  if (reason.error) return backWithReason(hideForm(id), reason.error, reason.value, hideReportedPath(id), now);
  const hidden = await hideListing(view.target.id, reason.value, now);
  if (!hidden) return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reports = await closeReportsOn(view.target, "hidden", reason.value, staff.id, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "listing-hidden",
    target: { kind: "listing", id: hidden.id, name: hidden.title },
    detail: reason.value,
    subjectId: hidden.ownerId,
    now,
  });
  if (hidden.ownerId) {
    await notify({
      accountId: hidden.ownerId,
      kind: "shop-update",
      subjectId: hidden.id,
      text: listingHiddenText(hidden.title),
      href: myListingsPath(tabFor(hidden.state)),
      now,
    });
  }
  for (const closed of reports) await tellReporter(closed, "acted", now);
  listingsChanged();
  await clearStaffForm(hideForm(id));
  await leaveNotice("hidden", now);
  done(ADMIN_REPORTS_PATH);
}

/**
 * Pause the account, from its confirm page (plan decisions 3, 5 and 18): the reported shop, or the reported listing's
 * shop, pauses as the Hub's pause; every open report on the target closes; the seller and each reporter are told.
 */
export async function pauseReportedShop(formData: FormData): Promise<void> {
  const id = idFrom(formData, "report");
  const staff = await requireStaff("admin", id ? pauseReportedPath(id) : ADMIN_REPORTS_PATH);
  const now = new Date();
  const view = id ? await getReport(id) : null;
  if (!id || !view?.can.pause || !view.shop) return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reason = checkReason(field(formData, "reason"));
  if (reason.error) return backWithReason(reportPauseForm(id), reason.error, reason.value, pauseReportedPath(id), now);
  const decision = await staffPauseShop(view.shop.slug, reason.value);
  if (!decision) return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reports = await closeReportsOn(view.target, "paused", reason.value, staff.id, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "shop-paused",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    detail: reason.value,
    subjectId: decision.ownerId,
    now,
  });
  await tellOwner(decision, "paused", now);
  for (const closed of reports) await tellReporter(closed, "acted", now);
  sellersChanged();
  await clearStaffForm(reportPauseForm(id));
  await leaveNotice("report-paused", now);
  done(ADMIN_REPORTS_PATH);
}

// --- Featured (spec 2.8, plan decision 9) -------------------------------------------------------------------------

/** "All" as the Featured page and the log call it. */
const NO_CAMPUS = "No campus chosen";

const PIN_ERRORS: Readonly<Record<"not-eligible" | "taken" | "full", string>> = {
  "not-eligible": "seller-not-eligible",
  taken: "pin-taken",
  full: "pin-full",
};

/** Pin a Verified seller to a campus (or visitors with none chosen) for a day, before the draw. */
export async function pinSeller(formData: FormData): Promise<void> {
  const staff = await requireStaff("admin", ADMIN_FEATURED_PATH);
  const now = new Date();
  const seller = idFrom(formData, "seller");
  const campus = field(formData, "campus");
  const campusName =
    campus === ALL_CAMPUSES ? NO_CAMPUS : (await getCampuses()).find((item) => item.slug === campus)?.name;
  const day = checkPinDay(field(formData, "day"), sastDate(now));
  const errors: string[] = [];
  if (!seller) errors.push("seller-missing");
  if (!campusName) errors.push("campus-missing");
  if (day.error) errors.push(day.error);
  if (seller && campusName && !day.error) {
    const pin = await addPin({ sellerSlug: seller, campusSlug: campus, day: day.value, staffId: staff.id, now });
    if (typeof pin !== "string") {
      const name = (await getSeller(pin.sellerSlug))?.name ?? pin.sellerSlug;
      await recordAudit({
        staff: staffOf(staff),
        action: "featured-pinned",
        target: { kind: "shop", id: pin.sellerSlug, name },
        detail: `${campusName} · ${pin.day}`,
        now,
      });
      await clearStaffForm(PIN_FORM);
      await leaveNotice("pinned", now);
      done(ADMIN_FEATURED_PATH);
    }
    errors.push(PIN_ERRORS[pin]);
  }
  const values = {
    seller: keepTyped(field(formData, "seller")),
    campus: keepTyped(campus),
    day: keepTyped(field(formData, "day")),
  };
  await writeFormState(PIN_FORM, { errors, values, notice: null }, now);
  done(ADMIN_FEATURED_PATH);
}

/** Remove a pin: that campus's row for the day is drawn again. */
export async function unpinSeller(formData: FormData): Promise<void> {
  const staff = await requireStaff("admin", ADMIN_FEATURED_PATH);
  const now = new Date();
  const id = idFrom(formData, "pin");
  const pin = id ? await removePin(id) : null;
  if (!pin) return nothingChanged(ADMIN_FEATURED_PATH, now);
  const campusName =
    pin.campusSlug === ALL_CAMPUSES
      ? NO_CAMPUS
      : ((await getCampuses()).find((item) => item.slug === pin.campusSlug)?.name ?? pin.campusSlug);
  await recordAudit({
    staff: staffOf(staff),
    action: "featured-unpinned",
    target: { kind: "shop", id: pin.sellerSlug, name: (await getSeller(pin.sellerSlug))?.name ?? pin.sellerSlug },
    detail: `${campusName} · ${pin.day}`,
    now,
  });
  await leaveNotice("unpinned", now);
  done(ADMIN_FEATURED_PATH);
}

// --- Pickup points (spec 2.3, plan decision 10) -------------------------------------------------------------------

/** The admin page, at a campus's points. */
const pointsPath = (campusSlug: string) => `${ADMIN_POINTS_PATH}#points-${campusSlug}`;

/** Add a point to a physical campus. Eduvos Online has none. */
export async function addPoint(formData: FormData): Promise<void> {
  const staff = await requireStaff("admin", ADMIN_POINTS_PATH);
  const now = new Date();
  const chosen = field(formData, "campus");
  const campus = (await getCampuses()).find((item) => item.slug === chosen && item.slug !== ONLINE_CAMPUS);
  if (!campus) return nothingChanged(ADMIN_POINTS_PATH, now);
  const path = pointsPath(campus.slug);
  const name = checkPointName(field(formData, "name"));
  const error = name.error ?? ((await isPointNameTaken(campus.slug, name.value, null)) ? "point-name-taken" : null);
  if (error) {
    const values = { name: keepTyped(field(formData, "name")) };
    await writeFormState(pointAddForm(campus.slug), { errors: [error], values, notice: null }, now);
    done(path);
  }
  const row = await addPickupPoint(campus.slug, name.value, now);
  if (!row) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "point-added",
    target: { kind: "pickup-point", id: row.id, name: row.name },
    detail: campus.name,
    now,
  });
  pickupPointsChanged();
  await clearStaffForm(pointAddForm(campus.slug));
  await leaveNotice("point-added", now);
  done(path);
}

/** Rename a point: listings that use it follow, as they keep its id. */
export async function renamePoint(formData: FormData): Promise<void> {
  const staff = await requireStaff("admin", ADMIN_POINTS_PATH);
  const now = new Date();
  const id = idFrom(formData, "point");
  const point = id ? pickupPointById(id) : null;
  if (!point) return nothingChanged(ADMIN_POINTS_PATH, now);
  const path = pointsPath(point.campusSlug);
  const name = checkPointName(field(formData, "name"));
  const error = name.error ?? ((await isPointNameTaken(point.campusSlug, name.value, point.id)) ? "point-name-taken" : null);
  if (error) {
    const values = { name: keepTyped(field(formData, "name")) };
    await writeFormState(pointRenameForm(point.id), { errors: [error], values, notice: null }, now);
    done(path);
  }
  const renamed = await renamePickupPoint(point.id, name.value);
  if (!renamed) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "point-renamed",
    target: { kind: "pickup-point", id: point.id, name: name.value },
    detail: `Was ${renamed.before}`,
    now,
  });
  pickupPointsChanged();
  await clearStaffForm(pointRenameForm(point.id));
  await leaveNotice("point-renamed", now);
  done(path);
}

/** Retire, or Use it again (plan decision 10): neither loses anything, so neither has a confirm page. */
async function setRetired(formData: FormData, retire: boolean): Promise<never> {
  const staff = await requireStaff("admin", ADMIN_POINTS_PATH);
  const now = new Date();
  const id = idFrom(formData, "point");
  const row = id ? await (retire ? retirePickupPoint(id, now) : restorePickupPoint(id)) : null;
  if (!row) return nothingChanged(ADMIN_POINTS_PATH, now);
  await recordAudit({
    staff: staffOf(staff),
    action: retire ? "point-retired" : "point-restored",
    target: { kind: "pickup-point", id: row.id, name: row.name },
    now,
  });
  pickupPointsChanged();
  await leaveNotice(retire ? "point-retired" : "point-restored", now);
  done(pointsPath(row.campusSlug));
}

export async function retirePoint(formData: FormData): Promise<void> {
  await setRetired(formData, true);
}

export async function restorePoint(formData: FormData): Promise<void> {
  await setRetired(formData, false);
}
```

- [ ] **Step 5: Run it to make sure it passes**

Run: `pnpm test lib/staff/admin-actions.test.ts`
Expected: PASS (15 tests). If typecheck later says a value is possibly null after `done(…)` or `return nothingChanged(…)`, check that `done` is F's `function` declaration with its explicit `: never` (it is), and that each early exit is a `return`.

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 15 more unit tests than after Task 9.

- [ ] **Step 7: Hand over for commit**

Files: `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`.
Message: `feat: the admin console's Server Actions: approve, decline, verify, pause, resume, mentors, dismiss, hide and pause from a report, Featured pins and pickup points, each audited once, telling whoever the spec says (staff tools spec 2.2 and 2.3)`

---

### Task 11: Admin pages: Overview, Sellers, a shop's review, and the decline and pause confirm pages

The admin console's first two sections (spec 2.3 and 2.7; plan decisions 1 to 3, 8, 15, 18 and 19): Overview, which counts what needs attention and works the badges out as it renders; Sellers, waiting first; a shop's review page with its onboarding answers and every action its standing allows; and the two confirm pages. Every page is a wordless skeleton in its static shell, renders inside `<Suspense>` after `requireStaff()`, and titles its tab with `staffMetadata()`.

**Files:**
- Create: `components/staff/AdminOverview.tsx`, `components/staff/AdminOverview.test.tsx`
- Create: `components/staff/AdminSellers.tsx`, `components/staff/AdminSellers.test.tsx`
- Create: `components/staff/AdminSeller.tsx`, `components/staff/AdminSeller.test.tsx`
- Create: `components/staff/SellerConfirm.tsx`, `components/staff/SellerConfirm.test.tsx`
- Create: `app/admin/page.tsx`, `app/admin/sellers/page.tsx`, `app/admin/sellers/[slug]/page.tsx`, `app/admin/sellers/[slug]/decline/page.tsx`, `app/admin/sellers/[slug]/pause/page.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` ("With Cache Components") and `03-api-reference/04-functions/generate-static-params.md`: a dynamic route returns at least one value from `generateStaticParams`, so the build checks its request-time parts sit inside `<Suspense>`; `params` is awaited inside `<Suspense>`; never export `dynamicParams`.

- [ ] **Step 2: Write the views' tests**

Create `components/staff/AdminOverview.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminOverview } from "./AdminOverview";

describe("Overview (staff tools spec 2.3)", () => {
  it("counts what needs attention, each with a link to it", () => {
    render(<AdminOverview waiting={2} openReports={1} openSlots={0} badgesChanged={1} />);
    const attention = screen.getByRole("region", { name: "Needs attention" });
    const items = within(attention).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "2Sellers waiting for approvalReview sellers",
      "1Open reportsReview reports",
      "0Slot requests waiting for an answerAnswer slot requests",
    ]);
    expect(within(items[0]).getByRole("link")).toHaveAttribute("href", "/admin/sellers");
    expect(within(items[1]).getByRole("link")).toHaveAttribute("href", "/admin/reports");
    expect(within(items[2]).getByRole("link")).toHaveAttribute("href", "/hub/manage#hub-queue");
  });

  it("says the badges were just worked out, and how many changed (spec 2.7, plan decision 8)", () => {
    const { rerender } = render(<AdminOverview waiting={0} openReports={0} openSlots={0} badgesChanged={1} />);
    expect(screen.getByRole("region", { name: "Trust badges" })).toHaveTextContent("1 shop's badge changed.");
    rerender(<AdminOverview waiting={0} openReports={0} openSlots={0} badgesChanged={0} />);
    expect(screen.getByRole("region", { name: "Trust badges" })).toHaveTextContent("None changed.");
  });
});
```

Create `components/staff/AdminSellers.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { declineShop, listShopsForReview } from "@/lib/data/staff-shops";
import { resetSampleStore } from "@/lib/data/store";
import { AdminSellers } from "./AdminSellers";

const names = new Map([
  ["midrand", "Midrand"],
  ["pretoria", "Pretoria"],
]);

beforeEach(() => {
  resetSampleStore();
});

describe("the Sellers list (staff tools spec 2.3)", () => {
  it("lists shops waiting for approval first, each with its campus, date and a Review link naming it", async () => {
    render(<AdminSellers rows={await listShopsForReview()} campusNames={names} />);
    const waiting = screen.getByRole("table", { name: "Shops waiting for approval, oldest first" });
    const [, crochet] = within(waiting).getAllByRole("row");
    expect(within(crochet).getByRole("cell", { name: "Pretoria" })).toBeInTheDocument();
    expect(within(crochet).getByRole("cell", { name: "10 Oct" })).toBeInTheDocument();
    expect(within(crochet).getByRole("cell", { name: "Waiting" })).toBeInTheDocument();
    expect(within(crochet).getByRole("link", { name: "Review Crochet corner" })).toHaveAttribute(
      "href",
      "/admin/sellers/crochet-corner",
    );
    const every = screen.getByRole("table", { name: "Open and paused shops, A to Z" });
    expect(within(every).getAllByRole("row")).toHaveLength(30);
    const tech = within(every).getByRole("link", { name: "Review Tech corner" }).closest("tr")!;
    expect(within(tech as HTMLElement).getByRole("cell", { name: "Sipho" })).toBeInTheDocument();
  });

  it("says when a shop was declined, and when nobody is waiting", async () => {
    await declineShop("crochet-corner", "Add a photo of your work.", new Date("2026-10-14T08:42:00.000Z"));
    const { unmount } = render(<AdminSellers rows={await listShopsForReview()} campusNames={names} />);
    expect(screen.getByRole("cell", { name: "Declined on 14 Oct" })).toBeInTheDocument();
    unmount();
    render(<AdminSellers rows={(await listShopsForReview()).filter((row) => row.owner === null)} campusNames={names} />);
    expect(screen.getByText("Nobody is waiting for approval.")).toBeInTheDocument();
  });
});
```

Create `components/staff/AdminSeller.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { declineShop, getShopForReview } from "@/lib/data/staff-shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { AdminSeller } from "./AdminSeller";

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/staff/admin-actions", () => ({
  approveSeller: async () => {},
  verifySeller: async () => {},
  resumeSeller: async () => {},
  assignMentor: async () => {},
}));

beforeEach(() => {
  resetSampleStore();
});

async function show(slug: string) {
  render(
    <AdminSeller
      review={(await getShopForReview(slug))!}
      campusName="Midrand"
      categoryName="Tech"
      pointNames={["Library entrance", "Main reception"]}
      mentors={[{ id: "acc-mentor", firstName: "Naledi" }]}
    />,
  );
}

describe("a shop's review page (staff tools spec 2.3)", () => {
  it("shows a waiting shop's answers, with Approve and Decline naming it, and no mentor yet", async () => {
    await show("crochet-corner");
    expect(screen.getByText("Waiting for approval since 10 October 2026.")).toBeInTheDocument();
    expect(screen.getByText("Beanies, bags and bucket hats, made by hand.")).toBeInTheDocument();
    expect(screen.getByText("Library entrance, Main reception")).toBeInTheDocument();
    expect(screen.getByText("Lerato")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Crochet corner" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('form input[name="shop"]')).toHaveValue("crochet-corner");
    expect(screen.getByRole("link", { name: "Decline Crochet corner" })).toHaveAttribute(
      "href",
      "/admin/sellers/crochet-corner/decline",
    );
    expect(screen.queryByRole("region", { name: "Mentor" })).toBeNull();
  });

  it("shows a declined shop's reason, with nothing to do until the seller sends it again", async () => {
    await declineShop("crochet-corner", "Add a photo of your work.", new Date("2026-10-14T08:42:00.000Z"));
    await show("crochet-corner");
    expect(screen.getByText(/^Declined on 14 October 2026\. The seller sees your reason:/)).toHaveTextContent(
      "Add a photo of your work.",
    );
    expect(screen.getByText("Nothing to do until the seller sends it again.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("gives an open shop Verify, Pause, its storefront and its mentor", async () => {
    await show("tech-corner");
    expect(screen.getByText("Open.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify Tech corner" })).toBeInTheDocument();
    expect(document.querySelector('input[name="verified"]')).toHaveValue("yes");
    expect(screen.getByRole("link", { name: "Pause Tech corner" })).toHaveAttribute(
      "href",
      "/admin/sellers/tech-corner/pause",
    );
    expect(screen.getByRole("link", { name: "See Tech corner's storefront" })).toHaveAttribute(
      "href",
      "/sellers/tech-corner",
    );
    expect(screen.getByRole("combobox", { name: "Mentor for Tech corner" })).toHaveValue("acc-mentor");
    expect(screen.getByRole("button", { name: "Save mentor for Tech corner" })).toBeInTheDocument();
  });

  it("shows the Hub's pause with its reason, and Resume instead of Pause", async () => {
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, {
      status: "paused",
      pausedBy: "staff",
      staffReason: "Selling exam answers.",
    });
    await show("tech-corner");
    expect(screen.getByText(/^Paused by the Hub\. The seller sees your reason:/)).toHaveTextContent(
      "Selling exam answers.",
    );
    expect(screen.getByRole("button", { name: "Resume Tech corner" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pause Tech corner" })).toBeNull();
  });

  it("says a sample shop can't be paused, offers Remove Verified, and has no mentor", async () => {
    await show("hair-studio");
    expect(screen.getByText("A sample shop no account owns can't be paused.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Verified from Hair studio" })).toBeInTheDocument();
    expect(screen.getByText("A sample shop no account owns")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Mentor" })).toBeNull();
  });
});
```

Create `components/staff/SellerConfirm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getShopForReview } from "@/lib/data/staff-shops";
import { resetSampleStore } from "@/lib/data/store";
import { SellerConfirm } from "./SellerConfirm";

vi.mock("@/lib/staff/admin-actions", () => ({ declineSeller: async () => {}, pauseSeller: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

describe("the sellers' confirm pages (staff tools spec 2.9, plan decision 18)", () => {
  it("asks before declining, saying the seller sees the reason and can send the shop again", async () => {
    render(<SellerConfirm kind="decline" review={(await getShopForReview("crochet-corner"))!} reason="" errors={[]} />);
    expect(screen.getByText("Decline Crochet corner? It won't be approved yet.")).toBeInTheDocument();
    expect(screen.getByText("Lerato sees your reason on their selling page, and gets a notification.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline Crochet corner" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/sellers/crochet-corner");
  });

  it("asks before pausing, saying buyers stop seeing it and only the Hub can resume it", async () => {
    render(<SellerConfirm kind="pause" review={(await getShopForReview("tech-corner"))!} reason="" errors={[]} />);
    expect(screen.getByText("Pause Tech corner? Buyers stop seeing it straight away.")).toBeInTheDocument();
    expect(screen.getByText(/Only the Hub can resume it\.$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause Tech corner" })).toBeInTheDocument();
  });

  it("says when there's nothing to confirm, with the way back", async () => {
    render(<SellerConfirm kind="decline" review={(await getShopForReview("tech-corner"))!} reason="" errors={[]} />);
    expect(screen.getByText(/isn't waiting for approval/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Tech corner" })).toHaveAttribute("href", "/admin/sellers/tech-corner");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test components/staff/AdminOverview.test.tsx components/staff/AdminSellers.test.tsx components/staff/AdminSeller.test.tsx components/staff/SellerConfirm.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 4: Write the views**

Create `components/staff/AdminOverview.tsx`:

```tsx
import Link from "next/link";
import { ADMIN_REPORTS_PATH, ADMIN_SELLERS_PATH, HUB_MANAGE_PATH } from "@/lib/staff/paths";

type AdminOverviewProps = {
  waiting: number;
  openReports: number;
  openSlots: number;
  /** How many shops' badges the calculation Overview just ran changed (spec 2.7, plan decision 8). */
  badgesChanged: number;
};

/**
 * Overview (spec 2.3): what needs attention, with links, and the trust badges worked out as the page rendered (spec
 * 2.7). Public pages show a changed badge when their cached data next revalidates, within 15 minutes, or at the next
 * write that expires sellers (plan decision 8). The words are samples for Lama to change.
 */
export function AdminOverview({ waiting, openReports, openSlots, badgesChanged }: AdminOverviewProps) {
  const items = [
    { id: "waiting", count: waiting, label: "Sellers waiting for approval", href: ADMIN_SELLERS_PATH, action: "Review sellers" },
    { id: "reports", count: openReports, label: "Open reports", href: ADMIN_REPORTS_PATH, action: "Review reports" },
    {
      id: "slots",
      count: openSlots,
      label: "Slot requests waiting for an answer",
      href: `${HUB_MANAGE_PATH}#hub-queue`,
      action: "Answer slot requests",
    },
  ];
  const changed =
    badgesChanged === 0
      ? "None changed."
      : `${badgesChanged} ${badgesChanged === 1 ? "shop's badge" : "shops' badges"} changed.`;
  return (
    <>
      <section aria-labelledby="admin-attention-title" className="staff-section">
        <h2 id="admin-attention-title" className="staff-section-title">
          Needs attention
        </h2>
        <ul className="staff-counts">
          {items.map((item) => (
            <li key={item.id} className="staff-count">
              <p className="staff-count-number">{item.count}</p>
              <p className="staff-count-label">{item.label}</p>
              <Link href={item.href} prefetch={false} className="staff-row-action">
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="admin-badges-title" className="staff-section">
        <h2 id="admin-badges-title" className="staff-section-title">
          Trust badges
        </h2>
        <p>
          Worked out just now from each shop&apos;s conversations, by the rules on the trust page. {changed} Buyers see a
          change within 15 minutes. Sample shops no account owns keep their sample badges.
        </p>
      </section>
    </>
  );
}
```

Create `components/staff/AdminSellers.tsx`:

```tsx
import Link from "next/link";
import type { ShopReview } from "@/lib/data/staff-shops";
import { adminSellerPath } from "@/lib/staff/paths";
import { shortSastDate } from "@/lib/time";
import { StaffTable } from "./StaffTable";

/** Where a shop stands, in a word or three (spec 2.3, plan decisions 2 and 3). */
export function standingWords(review: Pick<ShopReview, "standing" | "declinedAt" | "pausedBy">): string {
  switch (review.standing) {
    case "waiting":
      return "Waiting";
    case "declined":
      return `Declined on ${shortSastDate(review.declinedAt ?? "")}`;
    case "open":
      return "Open";
    case "paused":
      return review.pausedBy === "staff" ? "Paused by the Hub" : "Paused by the seller";
  }
}

function ReviewLink({ review }: { review: ShopReview }) {
  return (
    <Link href={adminSellerPath(review.shop.slug)} prefetch={false} className="staff-row-action">
      Review <span className="sr-only">{review.shop.name}</span>
    </Link>
  );
}

/**
 * Sellers (spec 2.3): the shops waiting for approval first (declined ones with them, until they're sent again), then
 * every open and paused shop, each with a link to its review page, which names the shop.
 */
export function AdminSellers({ rows, campusNames }: { rows: readonly ShopReview[]; campusNames: ReadonlyMap<string, string> }) {
  const waiting = rows.filter((row) => row.standing === "waiting" || row.standing === "declined");
  const others = rows.filter((row) => row.standing === "open" || row.standing === "paused");
  const campus = (row: ShopReview) => campusNames.get(row.shop.campusSlug) ?? row.shop.campusSlug;
  return (
    <>
      <section aria-labelledby="admin-waiting-title" className="staff-section">
        <h2 id="admin-waiting-title" className="staff-section-title">
          Waiting for approval
        </h2>
        <StaffTable
          caption="Shops waiting for approval, oldest first"
          columns={["Shop", "Campus", "Applied", "Status", "Review"]}
          rows={waiting.map((row) => ({
            key: row.shop.slug,
            cells: [
              row.shop.name,
              campus(row),
              row.appliedAt ? (
                <time key="applied" dateTime={row.appliedAt}>
                  {shortSastDate(row.appliedAt)}
                </time>
              ) : (
                ""
              ),
              standingWords(row),
              <ReviewLink key="review" review={row} />,
            ],
          }))}
          empty="Nobody is waiting for approval."
        />
      </section>
      <section aria-labelledby="admin-shops-title" className="staff-section">
        <h2 id="admin-shops-title" className="staff-section-title">
          Every shop
        </h2>
        <StaffTable
          caption="Open and paused shops, A to Z"
          columns={["Shop", "Campus", "Owner", "Status", "Verified", "Listed", "Review"]}
          rows={others.map((row) => ({
            key: row.shop.slug,
            cells: [
              row.shop.name,
              campus(row),
              row.owner?.firstName ?? "Sample shop",
              standingWords(row),
              row.shop.verified ? "Yes" : "No",
              String(row.listedCount),
              <ReviewLink key="review" review={row} />,
            ],
          }))}
          empty="No shops yet."
        />
      </section>
    </>
  );
}
```

Create `components/staff/AdminSeller.tsx`:

```tsx
import Link from "next/link";
import type { ShopReview } from "@/lib/data/staff-shops";
import { approveSeller, assignMentor, resumeSeller, verifySeller } from "@/lib/staff/admin-actions";
import { declineSellerPath, pauseSellerPath } from "@/lib/staff/paths";
import { longSastDate } from "@/lib/time";

type AdminSellerProps = {
  review: ShopReview;
  campusName: string;
  categoryName: string;
  /** The shop's pickup points by name, retired ones included. */
  pointNames: readonly string[];
  /** The accounts with the mentor role (plan decision 15). */
  mentors: readonly { id: string; firstName: string }[];
};

/** Where the shop stands, in a sentence; the Hub's reason is the seller's to see, so it's quoted. */
function standingLine({ standing, appliedAt, declinedAt, pausedBy, staffReason, shop }: ShopReview): string {
  switch (standing) {
    case "waiting":
      return appliedAt ? `Waiting for approval since ${longSastDate(appliedAt)}.` : "Waiting for approval.";
    case "declined":
      return `Declined on ${longSastDate(declinedAt ?? "")}. The seller sees your reason: “${staffReason ?? ""}”`;
    case "open":
      return shop.verified ? "Open, and Verified by the Hub." : "Open.";
    case "paused":
      return pausedBy === "staff"
        ? `Paused by the Hub. The seller sees your reason: “${staffReason ?? ""}”`
        : "Paused by the seller.";
  }
}

/**
 * A shop's review page (spec 2.3): its onboarding answers, where it stands, and what its standing allows. Waiting:
 * Approve, or Decline through its confirm page. Open or paused: Verify (or remove it), Pause through its confirm page
 * (or the Hub's Resume), and its mentor. Every button names the shop (spec 4).
 */
export function AdminSeller({ review, campusName, categoryName, pointNames, mentors }: AdminSellerProps) {
  const { shop, owner, standing } = review;
  const hasStorefront = standing === "open" || standing === "paused";
  const canPause = owner !== null && (standing === "open" || (standing === "paused" && review.pausedBy !== "staff"));
  const mentorField = `admin-mentor-${shop.slug}`;
  return (
    <>
      <section aria-labelledby="admin-shop-title" className="staff-section">
        <h2 id="admin-shop-title" className="staff-section-title">
          The shop
        </h2>
        <p className="staff-standing">{standingLine(review)}</p>
        <dl className="staff-facts">
          <div>
            <dt>Name</dt>
            <dd>{shop.name}</dd>
          </div>
          <div>
            <dt>Tagline</dt>
            <dd>{shop.tagline || "None"}</dd>
          </div>
          <div>
            <dt>Main category</dt>
            <dd>{categoryName}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{campusName}</dd>
          </div>
          <div>
            <dt>Pickup points</dt>
            <dd>{pointNames.length > 0 ? pointNames.join(", ") : "None: it sells online"}</dd>
          </div>
          <div>
            <dt>About</dt>
            <dd className="staff-prewrap">{shop.about}</dd>
          </div>
          <div>
            <dt>Photo</dt>
            <dd>
              {shop.image ? <a href={shop.image.src}>Open the shop&apos;s photo</a> : "None: it shows its category's picture"}
            </dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{owner ? owner.firstName : "A sample shop no account owns"}</dd>
          </div>
          <div>
            <dt>Listed now</dt>
            <dd>{review.listedCount}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="admin-shop-actions-title" className="staff-section">
        <h2 id="admin-shop-actions-title" className="staff-section-title">
          What you can do
        </h2>
        {standing === "waiting" && (
          <div className="staff-row-actions">
            <form action={approveSeller}>
              <input type="hidden" name="shop" value={shop.slug} />
              <button type="submit" className="btn btn-primary">
                Approve {shop.name}
              </button>
            </form>
            <Link href={declineSellerPath(shop.slug)} prefetch={false} className="btn btn-danger">
              Decline {shop.name}
            </Link>
          </div>
        )}
        {standing === "declined" && <p>Nothing to do until the seller sends it again.</p>}
        {hasStorefront && (
          <>
            <div className="staff-row-actions">
              <form action={verifySeller}>
                <input type="hidden" name="shop" value={shop.slug} />
                <input type="hidden" name="verified" value={shop.verified ? "no" : "yes"} />
                <button type="submit" className="btn btn-outline text-navy">
                  {shop.verified ? `Remove Verified from ${shop.name}` : `Verify ${shop.name}`}
                </button>
              </form>
              {canPause && (
                <Link href={pauseSellerPath(shop.slug)} prefetch={false} className="btn btn-danger">
                  Pause {shop.name}
                </Link>
              )}
              {standing === "paused" && review.pausedBy === "staff" && (
                <form action={resumeSeller}>
                  <input type="hidden" name="shop" value={shop.slug} />
                  <button type="submit" className="btn btn-primary">
                    Resume {shop.name}
                  </button>
                </form>
              )}
            </div>
            {!owner && <p>A sample shop no account owns can&apos;t be paused.</p>}
            <p>
              <Link href={`/sellers/${shop.slug}`} prefetch={false}>
                See {shop.name}&apos;s storefront
              </Link>
            </p>
          </>
        )}
      </section>

      {owner && hasStorefront && (
        <section aria-labelledby="admin-mentor-title" className="staff-section">
          <h2 id="admin-mentor-title" className="staff-section-title">
            Mentor
          </h2>
          <form action={assignMentor} className="form-stack staff-inline-form">
            <input type="hidden" name="shop" value={shop.slug} />
            <div className="form-field">
              <label htmlFor={mentorField} className="form-label">
                Mentor for {shop.name}
              </label>
              <select id={mentorField} name="mentor" defaultValue={review.mentor?.id ?? ""} className="form-input form-select">
                <option value="">No mentor</option>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.firstName}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-outline text-navy form-submit">
              Save mentor for {shop.name}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
```

Create `components/staff/SellerConfirm.tsx`:

```tsx
import Link from "next/link";
import type { FormError } from "@/lib/auth/messages";
import type { ShopReview } from "@/lib/data/staff-shops";
import { declineSeller, pauseSeller } from "@/lib/staff/admin-actions";
import { adminSellerPath } from "@/lib/staff/paths";
import { ConfirmAction } from "./ConfirmAction";

type SellerConfirmProps = {
  kind: "decline" | "pause";
  review: ShopReview;
  /** What was typed before a failed post. */
  reason: string;
  errors: readonly FormError[];
};

/**
 * Decline's and Pause shop's confirm pages (spec 2.9, plan decision 18): what will happen, the reason, and the button.
 * A shop that can't be declined or paused now (already done, a sample shop) gets a sentence and the way back instead.
 * The words are samples for Lama to change.
 */
export function SellerConfirm({ kind, review, reason, errors }: SellerConfirmProps) {
  const { shop, owner, standing } = review;
  const back = adminSellerPath(shop.slug);
  const who = owner?.firstName ?? "The seller";
  const allowed =
    kind === "decline"
      ? standing === "waiting"
      : owner !== null && (standing === "open" || (standing === "paused" && review.pausedBy !== "staff"));
  if (!allowed) {
    return (
      <p>
        {kind === "decline"
          ? `${shop.name} isn't waiting for approval, so there's nothing to decline.`
          : `${shop.name} can't be paused now: the Hub has paused it already, it's still waiting, or it's a sample shop.`}{" "}
        <Link href={back} prefetch={false}>
          Back to {shop.name}
        </Link>
      </p>
    );
  }
  if (kind === "decline") {
    return (
      <ConfirmAction
        id={`decline-${shop.slug}`}
        lead={`Decline ${shop.name}? It won't be approved yet.`}
        consequences={[
          `${who} sees your reason on their selling page, and gets a notification.`,
          "The shop stays waiting: they can change it and send it again.",
          "Nothing is deleted.",
        ]}
        action={declineSeller}
        hidden={{ shop: shop.slug }}
        reasonHint="The seller sees it."
        reason={reason}
        errors={errors}
        confirmLabel={`Decline ${shop.name}`}
        keepHref={back}
      />
    );
  }
  return (
    <ConfirmAction
      id={`pause-${shop.slug}`}
      lead={`Pause ${shop.name}? Buyers stop seeing it straight away.`}
      consequences={[
        "The shop and its listings leave every list. Their pages stay up, marked paused.",
        `${who} sees your reason on their dashboard and gets a notification. Only the Hub can resume it.`,
        "Nothing is deleted.",
      ]}
      action={pauseSeller}
      hidden={{ shop: shop.slug }}
      reasonHint="The seller sees it."
      reason={reason}
      errors={errors}
      confirmLabel={`Pause ${shop.name}`}
      keepHref={back}
    />
  );
}
```

The pause test's `/Only the Hub can resume it\.$/` matches the second consequence's end.

- [ ] **Step 5: Run them to make sure they pass**

Run: `pnpm test components/staff`
Expected: PASS (12 new tests, and Task 9's).

- [ ] **Step 6: Write the pages**

Create `app/admin/page.tsx`:

```tsx
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminOverview } from "@/components/staff/AdminOverview";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { recalculateBadges } from "@/lib/data/badges";
import { openBookingCount } from "@/lib/data/hub-posts";
import { openReportCount } from "@/lib/data/staff-reports";
import { countWaitingShops } from "@/lib/data/staff-shops";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_PATH } from "@/lib/staff/paths";

/** "Admin console" for admins, "Page not found" for everyone else (plan decision 1). */
export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Admin console");
}

/** Overview (staff tools spec 2.3). The static shell is a wordless skeleton; everything else needs the session. */
export default function AdminPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const account = await requireStaff("admin", ADMIN_PATH);
  // The badges read the clock (decision 26).
  await connection();
  // Overview works the badges out as it renders (spec 2.7, plan decision 8). A render can't expire cache tags.
  const changed = await recalculateBadges(new Date());
  const [waiting, openReports, openSlots, notice] = await Promise.all([
    countWaitingShops(),
    openReportCount(),
    openBookingCount(),
    takeNotice(),
  ]);
  return (
    <StaffFrame account={account} area="Admin console" title="Overview" current={ADMIN_PATH} notice={staffNoticeText(notice)}>
      <AdminOverview waiting={waiting} openReports={openReports} openSlots={openSlots} badgesChanged={changed.length} />
    </StaffFrame>
  );
}
```

Create `app/admin/sellers/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSellers } from "@/components/staff/AdminSellers";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { listShopsForReview } from "@/lib/data/staff-shops";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_SELLERS_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Sellers");
}

/** Sellers (staff tools spec 2.3): waiting for approval first. Per request, behind a wordless skeleton. */
export default function AdminSellersPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Sellers />
    </Suspense>
  );
}

async function Sellers() {
  const account = await requireStaff("admin", ADMIN_SELLERS_PATH);
  const [rows, campuses, notice] = await Promise.all([listShopsForReview(), getCampuses(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title="Sellers" current={ADMIN_SELLERS_PATH} notice={staffNoticeText(notice)}>
      <AdminSellers rows={rows} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />
    </StaffFrame>
  );
}
```

Create `app/admin/sellers/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminSeller } from "@/components/staff/AdminSeller";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses, getCategories } from "@/lib/data";
import { pickupPointName } from "@/lib/data/pickup-points";
import { getShopForReview, listMentors } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_SELLERS_PATH, adminSellerPath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Review a shop");
}

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no shop. */
export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** A shop's review page (staff tools spec 2.3). An unknown shop is the 404. */
export default function AdminSellerPage({ params }: PageProps<"/admin/sellers/[slug]">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <SellerReview params={params} />
    </Suspense>
  );
}

async function SellerReview({ params }: Pick<PageProps<"/admin/sellers/[slug]">, "params">) {
  const { slug } = await params;
  // The role first, so someone without it gets the 404 whatever the address says (plan decision 1).
  const account = await requireStaff("admin", adminSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  const [campuses, categories, mentors, notice] = await Promise.all([
    getCampuses(),
    getCategories(),
    listMentors(),
    takeNotice(),
  ]);
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title={review.shop.name}
      current={ADMIN_SELLERS_PATH}
      notice={staffNoticeText(notice)}
    >
      <AdminSeller
        review={review}
        campusName={campuses.find((campus) => campus.slug === review.shop.campusSlug)?.name ?? ""}
        categoryName={categories.find((category) => category.slug === review.shop.categorySlug)?.name ?? ""}
        pointNames={review.shop.pickupPointIds.flatMap((id) => pickupPointName(id) ?? [])}
        mentors={mentors}
      />
    </StaffFrame>
  );
}
```

Create `app/admin/sellers/[slug]/decline/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SellerConfirm } from "@/components/staff/SellerConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getShopForReview } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { declineForm } from "@/lib/staff/form-state";
import { ADMIN_SELLERS_PATH, declineSellerPath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Decline a shop");
}

export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** Decline's confirm page (staff tools spec 2.9, plan decision 18). */
export default function DeclineSellerPage({ params }: PageProps<"/admin/sellers/[slug]/decline">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Decline params={params} />
    </Suspense>
  );
}

async function Decline({ params }: Pick<PageProps<"/admin/sellers/[slug]/decline">, "params">) {
  const { slug } = await params;
  const account = await requireStaff("admin", declineSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  const state = await readFormState(declineForm(slug));
  return (
    <StaffFrame account={account} area="Admin console" title={`Decline ${review.shop.name}`} current={ADMIN_SELLERS_PATH} notice={null}>
      <SellerConfirm
        kind="decline"
        review={review}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`decline-${slug}`))}
      />
    </StaffFrame>
  );
}
```

Create `app/admin/sellers/[slug]/pause/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SellerConfirm } from "@/components/staff/SellerConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getShopForReview } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { shopPauseForm } from "@/lib/staff/form-state";
import { ADMIN_SELLERS_PATH, pauseSellerPath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Pause a shop");
}

export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** Pause shop's confirm page (staff tools spec 2.9, plan decisions 3 and 18). */
export default function PauseSellerPage({ params }: PageProps<"/admin/sellers/[slug]/pause">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Pause params={params} />
    </Suspense>
  );
}

async function Pause({ params }: Pick<PageProps<"/admin/sellers/[slug]/pause">, "params">) {
  const { slug } = await params;
  const account = await requireStaff("admin", pauseSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  const state = await readFormState(shopPauseForm(slug));
  return (
    <StaffFrame account={account} area="Admin console" title={`Pause ${review.shop.name}`} current={ADMIN_SELLERS_PATH} notice={null}>
      <SellerConfirm
        kind="pause"
        review={review}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`pause-${slug}`))}
      />
    </StaffFrame>
  );
}
```

- [ ] **Step 7: The styles**

Check none of the new classes is taken: `grep -n "\.staff-count\|\.staff-facts\|\.staff-standing\|\.staff-prewrap\|\.staff-inline-form" app/globals.css` prints nothing. Then append to the end of `app/globals.css`:

```css

/* --- Staff tools: Overview and a shop's review (staff tools plan, Task 11, spec 2.3) --- */
@layer components {
  .staff-counts {
    display: grid;
    gap: 12px;
  }

  .staff-count {
    display: grid;
    justify-items: start;
    gap: 6px;
    padding: 18px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  /* Navy on the grey panel is 11.8:1. */
  .staff-count-number {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 40px;
    line-height: 1;
  }

  .staff-count-label {
    color: var(--color-ink);
    font-weight: 600;
  }

  .staff-standing {
    color: var(--color-navy);
    font-weight: 600;
  }

  .staff-facts {
    display: grid;
    gap: 12px;
  }

  .staff-facts dt {
    color: var(--color-muted);
    font-size: 14px;
  }

  .staff-facts dd {
    overflow-wrap: anywhere;
  }

  .staff-prewrap {
    white-space: pre-wrap;
  }

  .staff-inline-form {
    max-width: 24rem;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .staff-counts {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .staff-facts {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}
```

- [ ] **Step 8: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 12 more unit tests than after Task 10. `pnpm typecheck` runs `next typegen` first, which makes `PageProps<"/admin/sellers/[slug]">` and the others.

- [ ] **Step 9: Build, and look at it**

Run: `pnpm build`
Expected: the build passes, listing `/admin`, `/admin/sellers` and the three `[slug]` routes as partly prerendered (their shells), with no "uncached data outside <Suspense>" error.

On a production build (`pnpm start --port 3201`), at 390 × 844 and 1280 × 800, in a throwaway Playwright script:
- signed in as the sample "Admin": `/admin` shows Overview with "1" sellers waiting; `/admin/sellers` lists Crochet corner first; its Review opens the review page with Approve and Decline; Decline's page asks for a reason; the tables stack into cards at 390 and are tables at 1280;
- signed in as "Student, Midrand": `/admin` shows "We couldn't find that page", and the tab says "Page not found · Vossie";
- signed out: `/admin` goes to `/login?next=%2Fadmin`.

Stop the server afterwards.

- [ ] **Step 10: Hand over for commit**

Files: `components/staff/AdminOverview.tsx`, `components/staff/AdminOverview.test.tsx`, `components/staff/AdminSellers.tsx`, `components/staff/AdminSellers.test.tsx`, `components/staff/AdminSeller.tsx`, `components/staff/AdminSeller.test.tsx`, `components/staff/SellerConfirm.tsx`, `components/staff/SellerConfirm.test.tsx`, `app/admin/page.tsx`, `app/admin/sellers/page.tsx`, `app/admin/sellers/[slug]/page.tsx`, `app/admin/sellers/[slug]/decline/page.tsx`, `app/admin/sellers/[slug]/pause/page.tsx`, `app/globals.css`.
Message: `feat: the admin console's Overview (counts and the badge calculation), Sellers (waiting first), a shop's review page with every action its standing allows, and the decline and pause confirm pages, each the 404 to anyone without the role (staff tools spec 2.1, 2.3, 2.7 and 2.9)`

---

### Task 12: Admin pages: Reports, a report, and the hide and pause confirm pages

The Reports section (spec 2.3; plan decisions 4, 5 and 18): the queue, open first; a report's page with the target, the reason, the detail and the reporter's first name, Dismiss with a note, and links to Hide the listing and Pause the account where the report allows them; and their two confirm pages.

**Files:**
- Create: `components/staff/AdminReports.tsx`, `components/staff/AdminReports.test.tsx`
- Create: `components/staff/AdminReport.tsx`, `components/staff/AdminReport.test.tsx`
- Create: `components/staff/ReportConfirm.tsx`, `components/staff/ReportConfirm.test.tsx`
- Create: `app/admin/reports/page.tsx`, `app/admin/reports/[id]/page.tsx`, `app/admin/reports/[id]/hide/page.tsx`, `app/admin/reports/[id]/pause/page.tsx`

No new styles: Task 9's and Task 11's classes cover these pages.

- [ ] **Step 1: Write the views' tests**

Create `components/staff/AdminReports.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createReport } from "@/lib/data/reports";
import { closeReport, listReports } from "@/lib/data/staff-reports";
import { resetSampleStore } from "@/lib/data/store";
import { AdminReports } from "./AdminReports";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("the reports queue (staff tools spec 2.3)", () => {
  it("lists open reports first with what, why and who by first name, then closed ones with what was done", async () => {
    const closed = await createReport({
      reporterId: "acc-mentor",
      target: { kind: "seller", id: "tech-corner" },
      targetTitle: "Tech corner",
      reason: "spam",
      detail: "",
      now: NOW,
    });
    await createReport({
      reporterId: "acc-student",
      target: { kind: "listing", id: "l-004" },
      targetTitle: "Box braids, shoulder length",
      reason: "scam",
      detail: "Asked for a deposit.",
      now: NOW,
    });
    await closeReport(closed, "Looked fine.", "acc-admin", NOW);
    render(<AdminReports reports={await listReports()} />);
    const open = screen.getByRole("table", { name: "Open reports, oldest first" });
    const [, row] = within(open).getAllByRole("row");
    expect(within(row).getByRole("cell", { name: "Listing: Box braids, shoulder length" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "Scam or fraud" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "Thandi" })).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Review the report about Box braids, shoulder length" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/admin\/reports\/rep-[0-9a-f-]{36}$/),
    );
    const done = screen.getByRole("table", { name: "Closed recently" });
    expect(within(done).getByRole("cell", { name: "Dismissed" })).toBeInTheDocument();
    expect(within(done).getByRole("cell", { name: "Pieter" })).toBeInTheDocument();
  });

  it("says when there's nothing open, or nothing closed", () => {
    render(<AdminReports reports={[]} />);
    expect(screen.getByText("No open reports.")).toBeInTheDocument();
    expect(screen.getByText("Nothing closed yet.")).toBeInTheDocument();
  });
});
```

Create `components/staff/AdminReport.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReport } from "@/lib/data/reports";
import { closeReport, getReport } from "@/lib/data/staff-reports";
import { resetSampleStore } from "@/lib/data/store";
import type { ReportTarget } from "@/lib/types";
import { AdminReport } from "./AdminReport";

vi.mock("@/lib/staff/admin-actions", () => ({ dismissReport: async () => {} }));

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

async function reportOn(target: ReportTarget, targetTitle: string) {
  const id = await createReport({
    reporterId: "acc-student",
    target,
    targetTitle,
    reason: "misleading",
    detail: "The photo isn't the item.",
    now: NOW,
  });
  return id;
}

describe("a report's page (staff tools spec 2.3, plan decision 5)", () => {
  it("shows the target, the reason, the detail and the reporter's first name, with what the Hub can do", async () => {
    const id = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    const facts = screen.getByRole("region", { name: "The report" });
    expect(within(facts).getByRole("link", { name: "Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "href",
      "/listings/l-001",
    );
    expect(within(facts).getByText("Misleading listing")).toBeInTheDocument();
    expect(within(facts).getByText("The photo isn't the item.")).toBeInTheDocument();
    expect(within(facts).getByText("Thandi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hide Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "href",
      `/admin/reports/${id}/hide`,
    );
    expect(screen.getByRole("link", { name: "Pause Tech corner" })).toHaveAttribute("href", `/admin/reports/${id}/pause`);
    expect(screen.getByLabelText("Note")).toHaveAccessibleDescription("Only Hub staff see it. Up to 500 characters.");
    expect(screen.getByRole("button", { name: "Dismiss the report about Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(document.querySelector('input[name="report"]')).toHaveValue(id);
  });

  it("offers only Dismiss for a report about a request, and says why", async () => {
    const id = await reportOn({ kind: "request", id: "r-001" }, "Looking for a lab coat");
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    expect(screen.getByText(/can only be dismissed/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Hide / })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Pause / })).toBeNull();
    expect(screen.getByRole("button", { name: "Dismiss the report about Looking for a lab coat" })).toBeInTheDocument();
  });

  it("keeps the note typed before a failed Dismiss, with what's wrong", async () => {
    const id = await reportOn({ kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    const errors = [{ message: "Add a note to say what you found.", fieldId: `dismiss-${id}-note` }];
    render(<AdminReport report={(await getReport(id))!} note="" errors={errors} />);
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toHaveAttribute("aria-invalid", "true");
  });

  it("says what was done once it's closed, with no actions left", async () => {
    const id = await reportOn({ kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    await closeReport(id, "Looked fine.", "acc-admin", NOW);
    render(<AdminReport report={(await getReport(id))!} note="" errors={[]} />);
    expect(screen.getByText("Dismissed on 14 October 2026 by Pieter.")).toBeInTheDocument();
    expect(screen.getByText("Looked fine.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

Create `components/staff/ReportConfirm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReport } from "@/lib/data/reports";
import { getReport } from "@/lib/data/staff-reports";
import { resetSampleStore } from "@/lib/data/store";
import type { ReportTarget } from "@/lib/types";
import { ReportConfirm } from "./ReportConfirm";

vi.mock("@/lib/staff/admin-actions", () => ({ hideReportedListing: async () => {}, pauseReportedShop: async () => {} }));

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

async function view(target: ReportTarget, targetTitle: string) {
  const id = await createReport({ reporterId: "acc-student", target, targetTitle, reason: "scam", detail: "", now: NOW });
  return (await getReport(id))!;
}

describe("the reports' confirm pages (staff tools spec 2.9, plan decision 18)", () => {
  it("asks before hiding a listing, saying what buyers, the seller and the reporters see", async () => {
    const report = await view({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    render(<ReportConfirm kind="hide" report={report} reason="" errors={[]} />);
    expect(screen.getByText("Hide Casio fx-991ZA Plus calculator? Buyers stop seeing it straight away.")).toBeInTheDocument();
    expect(screen.getByText(/Every open report about it closes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide Casio fx-991ZA Plus calculator" })).toBeInTheDocument();
    expect(document.querySelector('input[name="report"]')).toHaveValue(report.id);
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", `/admin/reports/${report.id}`);
  });

  it("asks before pausing the shop behind a report", async () => {
    const report = await view({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    render(<ReportConfirm kind="pause" report={report} reason="" errors={[]} />);
    expect(screen.getByText("Pause Tech corner? Buyers stop seeing it straight away.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause Tech corner" })).toBeInTheDocument();
  });

  it("says when the report doesn't allow it, with the way back", async () => {
    const report = await view({ kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    render(<ReportConfirm kind="pause" report={report} reason="" errors={[]} />);
    expect(screen.getByText(/can't be paused from this report/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the report" })).toHaveAttribute("href", `/admin/reports/${report.id}`);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/staff/AdminReports.test.tsx components/staff/AdminReport.test.tsx components/staff/ReportConfirm.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 3: Write the views**

Create `components/staff/AdminReports.tsx`:

```tsx
import Link from "next/link";
import type { ReportView } from "@/lib/data/staff-reports";
import { reasonLabel } from "@/lib/messaging/rules";
import { adminReportPath } from "@/lib/staff/paths";
import { shortSastDate } from "@/lib/time";
import type { ReportOutcome, ReportTarget } from "@/lib/types";
import { StaffTable } from "./StaffTable";

const KIND_WORDS: Readonly<Record<ReportTarget["kind"], string>> = {
  listing: "Listing",
  seller: "Shop",
  request: "Looking For request",
};

const OUTCOME_WORDS: Readonly<Record<ReportOutcome, string>> = {
  dismissed: "Dismissed",
  hidden: "Listing hidden",
  paused: "Shop paused",
};

/** "Listing", "Shop" or "Looking For request". */
export function kindWords(kind: ReportTarget["kind"]): string {
  return KIND_WORDS[kind];
}

/** "Listing: Desk lamp". */
export function reportedThing(report: Pick<ReportView, "target" | "targetTitle">): string {
  return `${kindWords(report.target.kind)}: ${report.targetTitle}`;
}

export function outcomeWords(outcome: ReportOutcome | null): string {
  return outcome ? OUTCOME_WORDS[outcome] : "Closed";
}

function ReviewLink({ report }: { report: ReportView }) {
  return (
    <Link href={adminReportPath(report.id)} prefetch={false} className="staff-row-action">
      Review <span className="sr-only">the report about {report.targetTitle}</span>
    </Link>
  );
}

/** Reports (spec 2.3): open first, oldest first, each with what, why and who sent it (first name only), then closed ones. */
export function AdminReports({ reports }: { reports: readonly ReportView[] }) {
  const open = reports.filter((report) => report.open);
  const closed = reports.filter((report) => !report.open);
  return (
    <>
      <section aria-labelledby="admin-open-reports-title" className="staff-section">
        <h2 id="admin-open-reports-title" className="staff-section-title">
          Open
        </h2>
        <StaffTable
          caption="Open reports, oldest first"
          columns={["Sent", "What", "Reason", "Reporter", "Review"]}
          rows={open.map((report) => ({
            key: report.id,
            cells: [
              <time key="sent" dateTime={report.createdAt}>
                {shortSastDate(report.createdAt)}
              </time>,
              reportedThing(report),
              reasonLabel(report.reason),
              report.reporterName,
              <ReviewLink key="review" report={report} />,
            ],
          }))}
          empty="No open reports."
        />
      </section>
      <section aria-labelledby="admin-closed-reports-title" className="staff-section">
        <h2 id="admin-closed-reports-title" className="staff-section-title">
          Closed
        </h2>
        <StaffTable
          caption="Closed recently"
          columns={["What", "Outcome", "Closed", "By", "Review"]}
          rows={closed.map((report) => ({
            key: report.id,
            cells: [
              reportedThing(report),
              outcomeWords(report.outcome),
              report.closedAt ? (
                <time key="closed" dateTime={report.closedAt}>
                  {shortSastDate(report.closedAt)}
                </time>
              ) : (
                ""
              ),
              report.closedByName ?? "",
              <ReviewLink key="review" report={report} />,
            ],
          }))}
          empty="Nothing closed yet."
        />
      </section>
    </>
  );
}
```

Create `components/staff/AdminReport.tsx`:

```tsx
import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { ReportView } from "@/lib/data/staff-reports";
import { targetPath } from "@/lib/messaging/paths";
import { reasonLabel } from "@/lib/messaging/rules";
import { dismissReport } from "@/lib/staff/admin-actions";
import { hideReportedPath, pauseReportedPath } from "@/lib/staff/paths";
import { REASON_MAX } from "@/lib/staff/rules";
import { longSastDate } from "@/lib/time";
import { kindWords, outcomeWords } from "./AdminReports";

type AdminReportProps = {
  report: ReportView;
  /** Dismiss's note as typed before a failed post. */
  note: string;
  errors: readonly FormError[];
};

/**
 * A report's page (spec 2.3, plan decision 5): what was reported (linked while it's there), the reason, the detail,
 * the reporter's first name and when. Open: Hide the listing and Pause the account through their confirm pages, where
 * the report allows them, and Dismiss with a note. Closed: what was done, by whom and when.
 */
export function AdminReport({ report, note, errors }: AdminReportProps) {
  const noteId = `dismiss-${report.id}-note`;
  const noteError = errorFor(errors, noteId);
  return (
    <>
      <section aria-labelledby="admin-report-title" className="staff-section">
        <h2 id="admin-report-title" className="staff-section-title">
          The report
        </h2>
        <dl className="staff-facts">
          <div>
            <dt>What</dt>
            <dd>
              {report.exists ? (
                <Link href={targetPath(report.target)} prefetch={false}>
                  {report.targetTitle}
                </Link>
              ) : (
                `${report.targetTitle} (gone)`
              )}
              <span className="staff-muted"> · {kindWords(report.target.kind)}</span>
            </dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{reasonLabel(report.reason)}</dd>
          </div>
          <div>
            <dt>Detail</dt>
            <dd className="staff-prewrap">{report.detail || "None given"}</dd>
          </div>
          <div>
            <dt>Reporter</dt>
            <dd>{report.reporterName}</dd>
          </div>
          <div>
            <dt>Sent</dt>
            <dd>
              <time dateTime={report.createdAt}>{longSastDate(report.createdAt)}</time>
            </dd>
          </div>
        </dl>
      </section>

      {report.open ? (
        <section aria-labelledby="admin-report-actions-title" className="staff-section">
          <h2 id="admin-report-actions-title" className="staff-section-title">
            What you can do
          </h2>
          {(report.can.hide || report.can.pause) && (
            <div className="staff-row-actions">
              {report.can.hide && (
                <Link href={hideReportedPath(report.id)} prefetch={false} className="btn btn-danger">
                  Hide {report.targetTitle}
                </Link>
              )}
              {report.can.pause && report.shop && (
                <Link href={pauseReportedPath(report.id)} prefetch={false} className="btn btn-danger">
                  Pause {report.shop.name}
                </Link>
              )}
            </div>
          )}
          {!report.can.hide && !report.can.pause && (
            <p>
              This report is about a Looking For request, something that has gone, or a shop the Hub can&apos;t pause,
              so it can only be dismissed.
            </p>
          )}
          <ErrorSummary id={`dismiss-${report.id}-summary`} errors={errors} />
          <form action={dismissReport} noValidate className="form-stack staff-inline-form">
            <input type="hidden" name="report" value={report.id} />
            <div className="form-field">
              <label htmlFor={noteId} className="form-label">
                Note
              </label>
              <p id={`${noteId}-hint`} className="form-hint">
                Only Hub staff see it. Up to {REASON_MAX} characters.
              </p>
              <FieldError id={`${noteId}-error`} message={noteError} />
              <textarea
                id={noteId}
                name="note"
                rows={3}
                required
                defaultValue={note}
                aria-invalid={noteError ? true : undefined}
                aria-describedby={describedBy(`${noteId}-hint`, noteError && `${noteId}-error`)}
                className="form-input staff-textarea"
              />
            </div>
            <button type="submit" className="btn btn-outline text-navy form-submit">
              Dismiss <span className="sr-only">the report about {report.targetTitle}</span>
            </button>
          </form>
        </section>
      ) : (
        <section aria-labelledby="admin-report-outcome-title" className="staff-section">
          <h2 id="admin-report-outcome-title" className="staff-section-title">
            What was done
          </h2>
          <p className="staff-standing">
            {outcomeWords(report.outcome)} on {longSastDate(report.closedAt ?? report.createdAt)} by{" "}
            {report.closedByName ?? "Deleted account"}.
          </p>
          {report.note && <p className="staff-prewrap">{report.note}</p>}
        </section>
      )}
    </>
  );
}
```

The closed report's sentence is one `<p>` of text: "Dismissed on 14 October 2026 by Pieter." (the test reads it whole).

Create `components/staff/ReportConfirm.tsx`:

```tsx
import Link from "next/link";
import type { FormError } from "@/lib/auth/messages";
import type { ReportView } from "@/lib/data/staff-reports";
import { hideReportedListing, pauseReportedShop } from "@/lib/staff/admin-actions";
import { adminReportPath } from "@/lib/staff/paths";
import { ConfirmAction } from "./ConfirmAction";

type ReportConfirmProps = {
  kind: "hide" | "pause";
  report: ReportView;
  reason: string;
  errors: readonly FormError[];
};

/**
 * Hide the listing's and Pause the account's confirm pages (spec 2.9; plan decisions 4, 5 and 18): what will happen,
 * the reason, and the button. When the report doesn't allow it (closed, about a request, gone), a sentence and the way
 * back. The words are samples for Lama to change.
 */
export function ReportConfirm({ kind, report, reason, errors }: ReportConfirmProps) {
  const back = adminReportPath(report.id);
  const shop = report.shop;
  if (kind === "hide" && report.can.hide) {
    return (
      <ConfirmAction
        id={`hide-${report.id}`}
        lead={`Hide ${report.targetTitle}? Buyers stop seeing it straight away.`}
        consequences={[
          "It leaves every list, and its page says it can't be found. Its seller still sees it in My listings, marked hidden, with your reason.",
          "Every open report about it closes, and each reporter hears that the Hub acted.",
          "It can't be shown again from here yet: the seller can still edit or delete it.",
        ]}
        action={hideReportedListing}
        hidden={{ report: report.id }}
        reasonHint="The seller sees it."
        reason={reason}
        errors={errors}
        confirmLabel={`Hide ${report.targetTitle}`}
        keepHref={back}
      />
    );
  }
  if (kind === "pause" && report.can.pause && shop) {
    return (
      <ConfirmAction
        id={`report-pause-${report.id}`}
        lead={`Pause ${shop.name}? Buyers stop seeing it straight away.`}
        consequences={[
          "The shop and its listings leave every list. Their pages stay up, marked paused.",
          "Every open report about what was reported closes, and each reporter hears that the Hub acted.",
          "The seller sees your reason on their dashboard and gets a notification. Only the Hub can resume it.",
        ]}
        action={pauseReportedShop}
        hidden={{ report: report.id }}
        reasonHint="The seller sees it."
        reason={reason}
        errors={errors}
        confirmLabel={`Pause ${shop.name}`}
        keepHref={back}
      />
    );
  }
  return (
    <p>
      {kind === "hide"
        ? "This listing can't be hidden from this report: it's closed, hidden already, or gone."
        : "The shop can't be paused from this report: it's closed, a sample shop, or paused by the Hub already."}{" "}
      <Link href={back} prefetch={false}>
        Back to the report
      </Link>
    </p>
  );
}
```

- [ ] **Step 4: Run them to make sure they pass**

Run: `pnpm test components/staff`
Expected: PASS (9 new tests).

- [ ] **Step 5: Write the pages**

Create `app/admin/reports/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminReports } from "@/components/staff/AdminReports";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { listReports } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_REPORTS_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Reports");
}

/** Reports (staff tools spec 2.3): open first. */
export default function AdminReportsPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Reports />
    </Suspense>
  );
}

async function Reports() {
  const account = await requireStaff("admin", ADMIN_REPORTS_PATH);
  const [reports, notice] = await Promise.all([listReports(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title="Reports" current={ADMIN_REPORTS_PATH} notice={staffNoticeText(notice)}>
      <AdminReports reports={reports} />
    </StaffFrame>
  );
}
```

Create `app/admin/reports/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminReport } from "@/components/staff/AdminReport";
import { reportedThing } from "@/components/staff/AdminReports";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getReport } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { dismissForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_REPORTS_PATH, adminReportPath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "A report");
}

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no report. */
export function generateStaticParams() {
  return [{ id: "rep-sample" }];
}

/** A report's page (staff tools spec 2.3). An unknown report is the 404. */
export default function AdminReportPage({ params }: PageProps<"/admin/reports/[id]">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Report params={params} />
    </Suspense>
  );
}

async function Report({ params }: Pick<PageProps<"/admin/reports/[id]">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", adminReportPath(id));
  const report = isId(id) ? await getReport(id) : null;
  if (!report) notFound();
  const [state, notice] = await Promise.all([readFormState(dismissForm(id)), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title={reportedThing(report)} current={ADMIN_REPORTS_PATH} notice={staffNoticeText(notice)}>
      <AdminReport
        report={report}
        note={state?.values.note ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`dismiss-${id}`))}
      />
    </StaffFrame>
  );
}
```

Create `app/admin/reports/[id]/hide/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReportConfirm } from "@/components/staff/ReportConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getReport } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { hideForm } from "@/lib/staff/form-state";
import { ADMIN_REPORTS_PATH, hideReportedPath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Hide a listing");
}

export function generateStaticParams() {
  return [{ id: "rep-sample" }];
}

/** Hide the listing's confirm page (staff tools spec 2.9, plan decisions 4 and 18). */
export default function HideReportedPage({ params }: PageProps<"/admin/reports/[id]/hide">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Hide params={params} />
    </Suspense>
  );
}

async function Hide({ params }: Pick<PageProps<"/admin/reports/[id]/hide">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", hideReportedPath(id));
  const report = isId(id) ? await getReport(id) : null;
  if (!report) notFound();
  const state = await readFormState(hideForm(id));
  return (
    <StaffFrame account={account} area="Admin console" title={`Hide ${report.targetTitle}`} current={ADMIN_REPORTS_PATH} notice={null}>
      <ReportConfirm
        kind="hide"
        report={report}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`hide-${id}`))}
      />
    </StaffFrame>
  );
}
```

Create `app/admin/reports/[id]/pause/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReportConfirm } from "@/components/staff/ReportConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getReport } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { reportPauseForm } from "@/lib/staff/form-state";
import { ADMIN_REPORTS_PATH, pauseReportedPath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Pause a shop");
}

export function generateStaticParams() {
  return [{ id: "rep-sample" }];
}

/** Pause the account's confirm page (staff tools spec 2.9, plan decisions 3, 5 and 18). */
export default function PauseReportedPage({ params }: PageProps<"/admin/reports/[id]/pause">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Pause params={params} />
    </Suspense>
  );
}

async function Pause({ params }: Pick<PageProps<"/admin/reports/[id]/pause">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", pauseReportedPath(id));
  const report = isId(id) ? await getReport(id) : null;
  if (!report) notFound();
  const state = await readFormState(reportPauseForm(id));
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title={report.shop ? `Pause ${report.shop.name}` : "Pause a shop"}
      current={ADMIN_REPORTS_PATH}
      notice={null}
    >
      <ReportConfirm
        kind="pause"
        report={report}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`report-pause-${id}`))}
      />
    </StaffFrame>
  );
}
```

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 9 more unit tests than after Task 11.

- [ ] **Step 7: Build, and look at it**

Run: `pnpm build`
Expected: the build passes, with the four report routes partly prerendered.

On a production build (`pnpm start --port 3201`), at 390 × 844 and 1280 × 800: sign in as "Student, Midrand", report `/listings/l-004` (`/report?listing=l-004`, "Scam or fraud", Send report); then, as "Admin", `/admin/reports` lists it with "Thandi"; its page shows Hide and Dismiss (the shop is a sample shop, so no Pause); Hide's page asks for a reason; Dismiss with a note goes back to the queue with "Dismissed. The reporter has been told." at the top. Stop the server afterwards. (Each server start is a fresh store.)

- [ ] **Step 8: Hand over for commit**

Files: `components/staff/AdminReports.tsx`, `components/staff/AdminReports.test.tsx`, `components/staff/AdminReport.tsx`, `components/staff/AdminReport.test.tsx`, `components/staff/ReportConfirm.tsx`, `components/staff/ReportConfirm.test.tsx`, `app/admin/reports/page.tsx`, `app/admin/reports/[id]/page.tsx`, `app/admin/reports/[id]/hide/page.tsx`, `app/admin/reports/[id]/pause/page.tsx`.
Message: `feat: the reports queue, a report's page with Dismiss and links to Hide and Pause where it allows them, and their confirm pages (staff tools spec 2.3 and 2.9)`

---

### Task 13: Admin pages: Featured, Pickup points and the Audit log

The admin console's last three sections (spec 2.2, 2.3 and 2.8; plan decisions 6, 9 and 10): today's draw for every campus with the pin form and the pins; each campus's pickup points with Rename, Retire and Use it again, and a form to add one; and the audit log, newest first, filtered by staff member and by kind as links.

**Files:**
- Create: `components/staff/AdminFeatured.tsx`, `components/staff/AdminFeatured.test.tsx`
- Create: `components/staff/AdminPickupPoints.tsx`, `components/staff/AdminPickupPoints.test.tsx`
- Create: `components/staff/AdminAudit.tsx`, `components/staff/AdminAudit.test.tsx`
- Create: `app/admin/featured/page.tsx`, `app/admin/pickup-points/page.tsx`, `app/admin/audit/page.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Write the views' tests**

Create `components/staff/AdminFeatured.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addPin, featuredChoices, featuredFor, listPins } from "@/lib/data/featured";
import { resetSampleStore } from "@/lib/data/store";
import { AdminFeatured } from "./AdminFeatured";

vi.mock("@/lib/staff/admin-actions", () => ({ pinSeller: async () => {}, unpinSeller: async () => {} }));

const TODAY = "2026-10-14";
const NOW = new Date("2026-10-14T08:42:00.000Z");
const places = [
  { slug: "all", name: "No campus chosen" },
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

beforeEach(() => {
  resetSampleStore();
});

async function show(values: Record<string, string> = {}, errors: { message: string; fieldId: string }[] = []) {
  const rows = await Promise.all(places.map(async (campus) => ({ campus, sellers: await featuredFor(campus.slug, TODAY) })));
  render(
    <AdminFeatured
      today={TODAY}
      rows={rows}
      pins={await listPins(TODAY)}
      choices={await featuredChoices()}
      places={places}
      values={values}
      errors={errors}
    />,
  );
}

describe("Featured (staff tools spec 2.3 and 2.8)", () => {
  it("shows each campus's row today, pins marked", async () => {
    await addPin({ sellerSlug: "nail-bar", campusSlug: "pretoria", day: TODAY, staffId: "acc-admin", now: NOW });
    await show();
    const table = screen.getByRole("table", { name: "Featured today, by campus" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    const pretoria = within(table).getByRole("cell", { name: "Pretoria" }).closest("tr") as HTMLElement;
    expect(within(pretoria).getAllByRole("cell")[1]).toHaveTextContent(/^FeaturedNail bar \(pinned\), /);
  });

  it("offers the pin form: the sellers who can be featured, every place and today by default", async () => {
    await show();
    const sellers = screen.getByRole("combobox", { name: "Seller" });
    expect(within(sellers).getAllByRole("option")).toHaveLength(10);
    expect(within(screen.getByRole("combobox", { name: "Campus" })).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Choose a campus",
      "No campus chosen",
      "Midrand",
      "Pretoria",
    ]);
    const day = screen.getByLabelText("Day");
    expect(day).toHaveValue(TODAY);
    expect(day).toHaveAttribute("min", TODAY);
    expect(day).toHaveAttribute("max", "2026-12-13");
    expect(screen.getByRole("button", { name: "Pin the seller" })).toHaveAttribute("type", "submit");
  });

  it("lists the pins from today on, each with a Remove button naming it", async () => {
    await addPin({ sellerSlug: "nail-bar", campusSlug: "pretoria", day: TODAY, staffId: "acc-admin", now: NOW });
    await show();
    const pins = screen.getByRole("table", { name: "Pins from today on, soonest first" });
    expect(within(pins).getByRole("cell", { name: "Pieter" })).toBeInTheDocument();
    expect(within(pins).getByRole("button", { name: "Remove the pin for Nail bar at Pretoria on 14 Oct" })).toBeInTheDocument();
  });

  it("keeps what was chosen after a failed pin, with what's wrong", async () => {
    await show({ seller: "nail-bar", campus: "pretoria", day: "2026-10-13" }, [
      { message: "Choose today or a later date.", fieldId: "pin-day" },
    ]);
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Seller" })).toHaveValue("nail-bar");
    expect(screen.getByLabelText("Day")).toHaveValue("2026-10-13");
    expect(screen.getByLabelText("Day")).toHaveAttribute("aria-invalid", "true");
  });
});
```

Create `components/staff/AdminPickupPoints.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listPickupPoints, retirePickupPoint } from "@/lib/data/pickup-points";
import { resetSampleStore } from "@/lib/data/store";
import { AdminPickupPoints } from "./AdminPickupPoints";

vi.mock("@/lib/staff/admin-actions", () => ({
  addPoint: async () => {},
  renamePoint: async () => {},
  retirePoint: async () => {},
  restorePoint: async () => {},
}));

const campuses = [
  { slug: "midrand", name: "Midrand" },
  { slug: "online", name: "Eduvos Online" },
];

beforeEach(() => {
  resetSampleStore();
});

describe("pickup points (staff tools spec 2.3, plan decision 10)", () => {
  it("lists each campus's points, each with Rename and Retire naming it, and a form to add one", async () => {
    render(<AdminPickupPoints campuses={campuses} points={await listPickupPoints()} addForms={{}} renameForms={{}} />);
    const midrand = screen.getByRole("region", { name: "Midrand" });
    expect(midrand).toHaveAttribute("id", "points-midrand");
    expect(within(midrand).getByRole("textbox", { name: "New name for Library entrance at Midrand" })).toHaveValue(
      "Library entrance",
    );
    expect(within(midrand).getByRole("button", { name: "Rename Library entrance at Midrand" })).toBeInTheDocument();
    expect(within(midrand).getByRole("button", { name: "Retire Library entrance at Midrand" })).toBeInTheDocument();
    expect(within(midrand).getByRole("textbox", { name: "New pickup point at Midrand" })).toHaveValue("");
    expect(within(midrand).getByRole("button", { name: "Add to Midrand" })).toBeInTheDocument();
  });

  it("marks a retired point, offering Use it again instead", async () => {
    await retirePickupPoint("pp-midrand-library", new Date("2026-10-14T08:42:00.000Z"));
    render(<AdminPickupPoints campuses={campuses} points={await listPickupPoints()} addForms={{}} renameForms={{}} />);
    const midrand = screen.getByRole("region", { name: "Midrand" });
    expect(within(midrand).getByText(/Retired on 14 Oct/)).toBeInTheDocument();
    expect(within(midrand).getByRole("button", { name: "Use Library entrance at Midrand again" })).toBeInTheDocument();
    expect(within(midrand).queryByRole("button", { name: "Rename Library entrance at Midrand" })).toBeNull();
  });

  it("says Eduvos Online has none, with no form", async () => {
    render(<AdminPickupPoints campuses={campuses} points={await listPickupPoints()} addForms={{}} renameForms={{}} />);
    const online = screen.getByRole("region", { name: "Eduvos Online" });
    expect(online).toHaveTextContent("Eduvos Online has no pickup points: everything there happens online.");
    expect(within(online).queryByRole("button")).toBeNull();
  });

  it("shows a failed add's name and what's wrong, at its campus", async () => {
    const message = "That campus already has a pickup point with that name.";
    render(
      <AdminPickupPoints
        campuses={campuses}
        points={await listPickupPoints()}
        addForms={{ midrand: { name: "library ENTRANCE", errors: [{ message, fieldId: "point-add-midrand-name" }] } }}
        renameForms={{}}
      />,
    );
    const midrand = screen.getByRole("region", { name: "Midrand" });
    expect(within(midrand).getByRole("alert", { name: "There's a problem" })).toHaveTextContent(message);
    const field = within(midrand).getByRole("textbox", { name: "New pickup point at Midrand" });
    expect(field).toHaveValue("library ENTRANCE");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});
```

Create `components/staff/AdminAudit.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { auditStaff, listAudit, recordAudit } from "@/lib/data/audit";
import { resetSampleStore } from "@/lib/data/store";
import { AdminAudit } from "./AdminAudit";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(async () => {
  resetSampleStore();
  await recordAudit({
    staff: { id: "acc-mentor", firstName: "Naledi" },
    action: "note-added",
    target: { kind: "shop", id: "tech-corner", name: "Tech corner" },
    now: new Date("2026-10-14T08:00:00.000Z"),
  });
  await recordAudit({
    staff: { id: "acc-admin", firstName: "Pieter" },
    action: "listing-hidden",
    target: { kind: "listing", id: "l-001", name: "Desk lamp" },
    detail: "Not allowed on Vossie.",
    now: NOW,
  });
});

describe("the audit log (staff tools spec 2.2 and 2.3, plan decision 6)", () => {
  it("lists entries newest first: when in SAST, who, what, about what, and why", async () => {
    render(<AdminAudit entries={await listAudit({ staff: null, kind: null })} staff={await auditStaff()} filter={{ staff: null, kind: null }} />);
    const table = screen.getByRole("table", { name: "The audit log, newest first" });
    const [, first, second] = within(table).getAllByRole("row");
    expect(within(first).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "WhenWed 14 Oct · 10:42",
      "WhoPieter",
      "WhatHid a listing",
      "AboutDesk lamp",
      "DetailNot allowed on Vossie.",
    ]);
    expect(within(second).getByRole("cell", { name: "Added a mentor's note" })).toBeInTheDocument();
  });

  it("filters by staff member and by kind, as links, marking the ones chosen", async () => {
    render(<AdminAudit entries={[]} staff={await auditStaff()} filter={{ staff: "acc-admin", kind: "reports" }} />);
    const filters = screen.getByRole("navigation", { name: "Filter the log" });
    expect(within(filters).getByRole("link", { name: "Everyone" })).toHaveAttribute("href", "/admin/audit?kind=reports");
    expect(within(filters).getByRole("link", { name: "Pieter" })).toHaveAttribute("aria-current", "true");
    expect(within(filters).getByRole("link", { name: "Naledi" })).toHaveAttribute(
      "href",
      "/admin/audit?staff=acc-mentor&kind=reports",
    );
    expect(within(filters).getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "true");
    expect(within(filters).getByRole("link", { name: "Every kind" })).toHaveAttribute("href", "/admin/audit?staff=acc-admin");
    expect(screen.getByText("Nothing in the log matches.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/staff/AdminFeatured.test.tsx components/staff/AdminPickupPoints.test.tsx components/staff/AdminAudit.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 3: Write the views**

Create `components/staff/AdminFeatured.tsx`:

```tsx
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { PinView } from "@/lib/data/featured";
import { dayMonth } from "@/lib/format";
import { pinSeller, unpinSeller } from "@/lib/staff/admin-actions";
import { staffFieldIds } from "@/lib/staff/errors";
import { addDays, PIN_DAYS_AHEAD } from "@/lib/staff/rules";
import type { Seller } from "@/lib/types";
import { StaffTable } from "./StaffTable";

type Place = { slug: string; name: string };

type AdminFeaturedProps = {
  /** Today's SAST date, YYYY-MM-DD. */
  today: string;
  /** Each place's row today: "No campus chosen" first, then every campus. */
  rows: ReadonlyArray<{ campus: Place; sellers: readonly Seller[] }>;
  pins: readonly PinView[];
  /** Who can be pinned: Verified, open, with something listed. */
  choices: readonly Seller[];
  places: readonly Place[];
  /** What was chosen before a failed pin. */
  values: Readonly<Record<string, string>>;
  errors: readonly FormError[];
};

const FIELDS = staffFieldIds("pin");

/**
 * Featured (spec 2.3 and 2.8, plan decision 9): each campus's row as its visitors see it today, the pin form, and the
 * pins from today on, each with Remove. The words are samples for Lama to change.
 */
export function AdminFeatured({ today, rows, pins, choices, places, values, errors }: AdminFeaturedProps) {
  const pinnedToday = new Set(pins.filter((pin) => pin.day === today).map((pin) => `${pin.campusSlug}:${pin.sellerSlug}`));
  const placeName = (slug: string) => places.find((place) => place.slug === slug)?.name ?? slug;
  const sellerError = errorFor(errors, FIELDS.seller);
  const campusError = errorFor(errors, FIELDS.campus);
  const dayError = errorFor(errors, FIELDS.day);
  return (
    <>
      <section aria-labelledby="admin-draw-title" className="staff-section">
        <h2 id="admin-draw-title" className="staff-section-title">
          Today&apos;s draw
        </h2>
        <p>
          Each campus&apos;s row as its visitors see it today, {dayMonth(today)}. Pins come first; the other places are
          the fair daily draw, and a seller shown sits out that campus for the next six days.
        </p>
        <StaffTable
          caption="Featured today, by campus"
          columns={["Campus", "Featured"]}
          rows={rows.map((row) => ({
            key: row.campus.slug,
            cells: [
              row.campus.name,
              row.sellers.length === 0
                ? "Nobody today"
                : row.sellers
                    .map((seller) =>
                      pinnedToday.has(`${row.campus.slug}:${seller.slug}`) ? `${seller.name} (pinned)` : seller.name,
                    )
                    .join(", "),
            ],
          }))}
          empty="No campuses."
        />
      </section>

      <section aria-labelledby="admin-pin-title" className="staff-section">
        <h2 id="admin-pin-title" className="staff-section-title">
          Pin a seller
        </h2>
        <p>
          A pinned seller takes one of the four places on that campus that day, before the draw. Only Verified sellers
          with an open shop and something listed can be pinned.
        </p>
        <ErrorSummary id="pin-summary" errors={errors} />
        <form action={pinSeller} noValidate className="form-stack staff-inline-form">
          <div className="form-field">
            <label htmlFor={FIELDS.seller} className="form-label">
              Seller
            </label>
            <FieldError id={`${FIELDS.seller}-error`} message={sellerError} />
            <select
              id={FIELDS.seller}
              name="seller"
              required
              defaultValue={values.seller ?? ""}
              aria-invalid={sellerError ? true : undefined}
              aria-describedby={describedBy(sellerError && `${FIELDS.seller}-error`)}
              className="form-input form-select"
            >
              <option value="">Choose a Verified seller</option>
              {choices.map((seller) => (
                <option key={seller.slug} value={seller.slug}>
                  {seller.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor={FIELDS.campus} className="form-label">
              Campus
            </label>
            <FieldError id={`${FIELDS.campus}-error`} message={campusError} />
            <select
              id={FIELDS.campus}
              name="campus"
              required
              defaultValue={values.campus ?? ""}
              aria-invalid={campusError ? true : undefined}
              aria-describedby={describedBy(campusError && `${FIELDS.campus}-error`)}
              className="form-input form-select"
            >
              <option value="">Choose a campus</option>
              {places.map((place) => (
                <option key={place.slug} value={place.slug}>
                  {place.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor={FIELDS.day} className="form-label">
              Day
            </label>
            <p id={`${FIELDS.day}-hint`} className="form-hint">
              Today, or up to {PIN_DAYS_AHEAD} days ahead.
            </p>
            <FieldError id={`${FIELDS.day}-error`} message={dayError} />
            <input
              id={FIELDS.day}
              name="day"
              type="date"
              required
              min={today}
              max={addDays(today, PIN_DAYS_AHEAD)}
              defaultValue={values.day ?? today}
              aria-invalid={dayError ? true : undefined}
              aria-describedby={describedBy(`${FIELDS.day}-hint`, dayError && `${FIELDS.day}-error`)}
              className="form-input"
            />
          </div>
          <button type="submit" className="btn btn-primary form-submit">
            Pin the seller
          </button>
        </form>
      </section>

      <section aria-labelledby="admin-pins-title" className="staff-section">
        <h2 id="admin-pins-title" className="staff-section-title">
          Pins
        </h2>
        <StaffTable
          caption="Pins from today on, soonest first"
          columns={["Day", "Campus", "Seller", "Pinned by", "Remove"]}
          rows={pins.map((pin) => ({
            key: pin.id,
            cells: [
              dayMonth(pin.day),
              placeName(pin.campusSlug),
              pin.sellerName,
              pin.pinnedByName,
              <form key="remove" action={unpinSeller}>
                <input type="hidden" name="pin" value={pin.id} />
                <button type="submit" className="staff-row-action staff-row-action-danger">
                  Remove{" "}
                  <span className="sr-only">
                    the pin for {pin.sellerName} at {placeName(pin.campusSlug)} on {dayMonth(pin.day)}
                  </span>
                </button>
              </form>,
            ],
          }))}
          empty="No pins from today on."
        />
      </section>
    </>
  );
}
```

Create `components/staff/AdminPickupPoints.tsx`:

```tsx
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { ONLINE_CAMPUS } from "@/lib/campus";
import type { PickupPointRow } from "@/lib/data/rows";
import { addPoint, renamePoint, restorePoint, retirePoint } from "@/lib/staff/admin-actions";
import { shortSastDate } from "@/lib/time";

type Place = { slug: string; name: string };
/** A form's typed name and errors after a failed post. */
export type PointForm = { name: string; errors: FormError[] };

type AdminPickupPointsProps = {
  campuses: readonly Place[];
  points: readonly PickupPointRow[];
  /** After a failed add, by campus slug. */
  addForms: Readonly<Record<string, PointForm>>;
  /** After a failed rename, by point id. */
  renameForms: Readonly<Record<string, PointForm>>;
};

function PointItem({ point, campusName, form }: { point: PickupPointRow; campusName: string; form?: PointForm }) {
  const fieldId = `point-${point.id}-name`;
  const error = form ? errorFor(form.errors, fieldId) : undefined;
  if (point.retiredAt) {
    return (
      <li className="staff-point">
        <p className="staff-point-name">
          {point.name}
          <span className="staff-muted"> · Retired on {shortSastDate(point.retiredAt)}</span>
        </p>
        <form action={restorePoint}>
          <input type="hidden" name="point" value={point.id} />
          <button type="submit" className="staff-row-action">
            Use {point.name} <span className="sr-only">at {campusName}</span> again
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className="staff-point">
      <form action={renamePoint} noValidate className="staff-rename">
        <input type="hidden" name="point" value={point.id} />
        <label htmlFor={fieldId} className="form-label">
          New name for {point.name} <span className="sr-only">at {campusName}</span>
        </label>
        <FieldError id={`${fieldId}-error`} message={error} />
        <input
          id={fieldId}
          name="name"
          type="text"
          required
          defaultValue={form?.name ?? point.name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(error && `${fieldId}-error`)}
          className="form-input"
        />
        <button type="submit" className="staff-row-action">
          Rename {point.name} <span className="sr-only">at {campusName}</span>
        </button>
      </form>
      <form action={retirePoint}>
        <input type="hidden" name="point" value={point.id} />
        <button type="submit" className="staff-row-action staff-row-action-danger">
          Retire {point.name} <span className="sr-only">at {campusName}</span>
        </button>
      </form>
    </li>
  );
}

function AddPoint({ campus, form }: { campus: Place; form?: PointForm }) {
  const fieldId = `point-add-${campus.slug}-name`;
  const error = form ? errorFor(form.errors, fieldId) : undefined;
  return (
    <form action={addPoint} noValidate className="staff-rename">
      <input type="hidden" name="campus" value={campus.slug} />
      <label htmlFor={fieldId} className="form-label">
        New pickup point at {campus.name}
      </label>
      <p id={`${fieldId}-hint`} className="form-hint">
        2 to 60 characters, and not a name {campus.name} has already.
      </p>
      <FieldError id={`${fieldId}-error`} message={error} />
      <input
        id={fieldId}
        name="name"
        type="text"
        required
        defaultValue={form?.name ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${fieldId}-hint`, error && `${fieldId}-error`)}
        className="form-input"
      />
      <button type="submit" className="btn btn-outline text-navy">
        Add to {campus.name}
      </button>
    </form>
  );
}

/**
 * Pickup points (spec 2.3, plan decision 10): each campus's approved points, in use or retired, with Rename and Retire
 * (or Use it again), and a form to add one. Retiring loses nothing, so it has no confirm page. A failed post comes
 * back to its campus (`#points-<campus>`), where its error summary is.
 */
export function AdminPickupPoints({ campuses, points, addForms, renameForms }: AdminPickupPointsProps) {
  return (
    <>
      {campuses.map((campus) => {
        const own = points.filter((point) => point.campusSlug === campus.slug);
        const errors = [
          ...(addForms[campus.slug]?.errors ?? []),
          ...own.flatMap((point) => renameForms[point.id]?.errors ?? []),
        ];
        return (
          <section
            key={campus.slug}
            id={`points-${campus.slug}`}
            aria-labelledby={`points-${campus.slug}-title`}
            className="staff-section"
          >
            <h2 id={`points-${campus.slug}-title`} className="staff-section-title">
              {campus.name}
            </h2>
            {campus.slug === ONLINE_CAMPUS ? (
              <p>Eduvos Online has no pickup points: everything there happens online.</p>
            ) : (
              <>
                <ErrorSummary id={`points-${campus.slug}-summary`} errors={errors} />
                <ul className="staff-points">
                  {own.map((point) => (
                    <PointItem key={point.id} point={point} campusName={campus.name} form={renameForms[point.id]} />
                  ))}
                </ul>
                <AddPoint campus={campus} form={addForms[campus.slug]} />
              </>
            )}
          </section>
        );
      })}
    </>
  );
}
```

Create `components/staff/AdminAudit.tsx`:

```tsx
import Link from "next/link";
import { AUDIT_KINDS, auditLabel } from "@/lib/staff/audit-words";
import { auditPath } from "@/lib/staff/paths";
import { sastDateTime } from "@/lib/time";
import type { AuditEntry, AuditKind } from "@/lib/types";
import { StaffTable } from "./StaffTable";

type AdminAuditProps = {
  entries: readonly AuditEntry[];
  /** Everyone in the log, for the filter's links. */
  staff: readonly { id: string; name: string }[];
  filter: { staff: string | null; kind: AuditKind | null };
};

function FilterLink({ href, chosen, label }: { href: string; chosen: boolean; label: string }) {
  return (
    <li>
      <Link href={href} prefetch={false} aria-current={chosen ? "true" : undefined} className="staff-nav-link">
        {label}
      </Link>
    </li>
  );
}

/**
 * The audit log (spec 2.2 and 2.3, plan decision 6): every staff action, newest first, with when (in SAST), who, what,
 * what it was about then, and the reason or note. Filtered by staff member and by kind, as links, so a filter is an
 * address. Nothing here edits an entry: there's no way to.
 */
export function AdminAudit({ entries, staff, filter }: AdminAuditProps) {
  return (
    <>
      <nav aria-label="Filter the log" className="staff-filters">
        <p id="audit-staff-label" className="staff-filter-label">
          By staff member
        </p>
        <ul aria-labelledby="audit-staff-label">
          <FilterLink href={auditPath({ staff: null, kind: filter.kind })} chosen={filter.staff === null} label="Everyone" />
          {staff.map((person) => (
            <FilterLink
              key={person.id}
              href={auditPath({ staff: person.id, kind: filter.kind })}
              chosen={filter.staff === person.id}
              label={person.name}
            />
          ))}
        </ul>
        <p id="audit-kind-label" className="staff-filter-label">
          By kind
        </p>
        <ul aria-labelledby="audit-kind-label">
          <FilterLink href={auditPath({ staff: filter.staff, kind: null })} chosen={filter.kind === null} label="Every kind" />
          {AUDIT_KINDS.map((item) => (
            <FilterLink
              key={item.kind}
              href={auditPath({ staff: filter.staff, kind: item.kind })}
              chosen={filter.kind === item.kind}
              label={item.label}
            />
          ))}
        </ul>
      </nav>
      <section aria-labelledby="admin-log-title" className="staff-section">
        <h2 id="admin-log-title" className="sr-only">
          Entries
        </h2>
        <StaffTable
          caption="The audit log, newest first"
          columns={["When", "Who", "What", "About", "Detail"]}
          rows={entries.map((entry) => ({
            key: entry.id,
            cells: [
              <time key="when" dateTime={entry.at}>
                {sastDateTime(entry.at)}
              </time>,
              entry.staffName,
              auditLabel(entry.action),
              entry.targetName,
              entry.detail || "None",
            ],
          }))}
          empty="Nothing in the log matches."
        />
      </section>
    </>
  );
}
```

- [ ] **Step 4: Run them to make sure they pass**

Run: `pnpm test components/staff`
Expected: PASS (10 new tests).

- [ ] **Step 5: Write the pages**

Create `app/admin/featured/page.tsx`:

```tsx
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminFeatured } from "@/components/staff/AdminFeatured";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses } from "@/lib/data";
import { featuredChoices, featuredFor, listPins } from "@/lib/data/featured";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { PIN_FORM, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_FEATURED_PATH } from "@/lib/staff/paths";
import { sastDate } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Featured");
}

/** Featured (staff tools spec 2.3 and 2.8). */
export default function AdminFeaturedPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Featured />
    </Suspense>
  );
}

async function Featured() {
  const account = await requireStaff("admin", ADMIN_FEATURED_PATH);
  // Today's date reads the clock (decision 26).
  await connection();
  const today = sastDate(new Date());
  const campuses = await getCampuses();
  const places = [
    { slug: ALL_CAMPUSES, name: "No campus chosen" },
    ...campuses.map((campus) => ({ slug: campus.slug, name: campus.name })),
  ];
  // Each row as visitors see it; one not drawn yet today is drawn and recorded now, as a visit would (plan decision 9).
  const rows = await Promise.all(
    places.map(async (place) => ({ campus: place, sellers: await featuredFor(place.slug, today) })),
  );
  const [pins, choices, state, notice] = await Promise.all([
    listPins(today),
    featuredChoices(),
    readFormState(PIN_FORM),
    takeNotice(),
  ]);
  return (
    <StaffFrame account={account} area="Admin console" title="Featured" current={ADMIN_FEATURED_PATH} notice={staffNoticeText(notice)}>
      <AdminFeatured
        today={today}
        rows={rows}
        pins={pins}
        choices={choices}
        places={places}
        values={state?.values ?? {}}
        errors={staffErrors(state?.errors ?? [], staffFieldIds("pin"))}
      />
    </StaffFrame>
  );
}
```

Create `app/admin/pickup-points/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPickupPoints, type PointForm } from "@/components/staff/AdminPickupPoints";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { listPickupPoints } from "@/lib/data/pickup-points";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors } from "@/lib/staff/errors";
import { pointAddForm, pointRenameForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_POINTS_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Pickup points");
}

/** Pickup points (staff tools spec 2.3, plan decision 10). */
export default function AdminPickupPointsPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <PickupPoints />
    </Suspense>
  );
}

/** A failed post's typed name and errors, keyed as the view wants them; nothing for forms with no state. */
async function formsFor(keys: readonly { key: string; form: string; fieldId: string }[]) {
  const forms: Record<string, PointForm> = {};
  for (const { key, form, fieldId } of keys) {
    const state = await readFormState(form);
    if (state) forms[key] = { name: state.values.name ?? "", errors: staffErrors(state.errors, { name: fieldId }) };
  }
  return forms;
}

async function PickupPoints() {
  const account = await requireStaff("admin", ADMIN_POINTS_PATH);
  const [campuses, points, notice] = await Promise.all([getCampuses(), listPickupPoints(), takeNotice()]);
  const addForms = await formsFor(
    campuses.map((campus) => ({ key: campus.slug, form: pointAddForm(campus.slug), fieldId: `point-add-${campus.slug}-name` })),
  );
  const renameForms = await formsFor(
    points.map((point) => ({ key: point.id, form: pointRenameForm(point.id), fieldId: `point-${point.id}-name` })),
  );
  return (
    <StaffFrame account={account} area="Admin console" title="Pickup points" current={ADMIN_POINTS_PATH} notice={staffNoticeText(notice)}>
      <AdminPickupPoints
        campuses={campuses.map((campus) => ({ slug: campus.slug, name: campus.name }))}
        points={points}
        addForms={addForms}
        renameForms={renameForms}
      />
    </StaffFrame>
  );
}
```

Create `app/admin/audit/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAudit } from "@/components/staff/AdminAudit";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { auditStaff, listAudit } from "@/lib/data/audit";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { parseAuditFilter } from "@/lib/staff/audit-words";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_AUDIT_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Audit log");
}

/** The audit log (staff tools spec 2.2 and 2.3). Its filters are in the link, read inside <Suspense>. */
export default function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}

async function Audit({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  const account = await requireStaff("admin", ADMIN_AUDIT_PATH);
  const filter = parseAuditFilter(await searchParams);
  const [entries, staff, notice] = await Promise.all([listAudit(filter), auditStaff(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title="Audit log" current={ADMIN_AUDIT_PATH} notice={staffNoticeText(notice)}>
      <AdminAudit entries={entries} staff={staff} filter={filter} />
    </StaffFrame>
  );
}
```

- [ ] **Step 6: The styles**

Check none of the new classes is taken: `grep -n "\.staff-filter\|\.staff-point\|\.staff-rename" app/globals.css` prints nothing. Then append to the end of `app/globals.css`:

```css

/* --- Staff tools: Featured, pickup points and the audit log (staff tools plan, Task 13, spec 2.3) --- */
@layer components {
  .staff-filters {
    display: grid;
    gap: 8px;
  }

  .staff-filters ul {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .staff-filter-label {
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 600;
  }

  /* A chosen filter, like the open section: white on navy. */
  .staff-nav-link[aria-current="true"] {
    border-color: var(--color-navy);
    background: var(--color-navy);
    color: var(--color-white);
  }

  .staff-points {
    display: grid;
    gap: 12px;
  }

  .staff-point {
    display: grid;
    gap: 10px;
    padding: 14px 16px;
    border: 1.5px solid var(--color-line);
    border-radius: var(--radius-card);
  }

  .staff-point-name {
    color: var(--color-navy);
    font-weight: 600;
  }

  /* A one-field form: the label, the field, then its button, wrapping on a phone. */
  .staff-rename {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px 12px;
  }

  .staff-rename .form-label,
  .staff-rename .form-hint,
  .staff-rename .form-error {
    flex-basis: 100%;
  }

  .staff-rename .form-input {
    flex: 1 1 14rem;
  }
}
```

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 10 more unit tests than after Task 12.

- [ ] **Step 8: Build, and look at it**

Run: `pnpm build`
Expected: the build passes.

On a production build (`pnpm start --port 3201`), signed in as "Admin", at 390 × 844 and 1280 × 800: `/admin/featured` shows fourteen rows, the pin form and "No pins from today on."; pin "Nail bar" to Pretoria for today, and the row marks it "(pinned)"; `/admin/pickup-points` shows every campus, retire Midrand's "Library entrance" and it offers "Use … again"; `/admin/audit` lists both actions, and its "Pickup points" filter leaves one. Stop the server afterwards.

- [ ] **Step 9: Hand over for commit**

Files: `components/staff/AdminFeatured.tsx`, `components/staff/AdminFeatured.test.tsx`, `components/staff/AdminPickupPoints.tsx`, `components/staff/AdminPickupPoints.test.tsx`, `components/staff/AdminAudit.tsx`, `components/staff/AdminAudit.test.tsx`, `app/admin/featured/page.tsx`, `app/admin/pickup-points/page.tsx`, `app/admin/audit/page.tsx`, `app/globals.css`.
Message: `feat: the admin console's Featured (today's rows, pins), Pickup points (add, rename, retire, use again) and Audit log (newest first, filtered by staff member and kind) (staff tools spec 2.2, 2.3 and 2.8)`

---

### Task 14: The Hub's tools: posts, the editor with Preview, and the office-hours queue

`/hub/manage`, `/hub/new` and `/hub/[id]/edit` (spec 2.4 and 3; plan decisions 11, 12 and 14): a mentor's own posts (an admin's: every post) with drafts, the shared office-hours queue with Accept and Decline, and the post editor with every field the spec names, a cover photo through F's photo path, Published, and a server-rendered Preview. Their Server Actions write an audit entry each.

**Files:**
- Modify: `lib/staff/form-state.ts`
- Create: `lib/staff/hub-actions.ts`, `lib/staff/hub-actions.test.ts`
- Create: `components/staff/HubManage.tsx`, `components/staff/HubManage.test.tsx`
- Create: `components/staff/PostEditor.tsx`, `components/staff/PostEditor.test.tsx`
- Create: `app/hub/manage/page.tsx`, `app/hub/new/page.tsx`, `app/hub/[id]/edit/page.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Name the editor's ids**

In `lib/staff/form-state.ts`, after the `postForm` line, add:

```ts
/** The editor's id prefix (plan decision 23's rule from selling): "new-post", or "edit-<id>" while editing that post. */
export const postPrefix = (id: string | null) => (id ? `edit-${id}` : "new-post");
```

- [ ] **Step 2: Write the actions' test**

Create `lib/staff/hub-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { listAudit } from "@/lib/data/audit";
import { publishedPost } from "@/lib/data/hub-posts";
import { getNotifications } from "@/lib/data/notifications";
import { photoSrcsOf } from "@/lib/data/photos";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { pngBytes } from "@/tests/helpers/image-bytes";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { postForm, STAFF_NOTICE } from "./form-state";
import { answerSlot, savePost } from "./hub-actions";

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

const tip = {
  post: "",
  kind: "tip",
  title: "Price by the hour",
  campus: "all",
  date: "",
  time: "",
  place: "",
  capacity: "",
  summary: "Work out what an hour of your time is worth.",
  body: "## Start with your costs\n- Materials\n- Transport",
  published: "yes",
  intent: "save",
};

const newestPost = () => [...sampleStore().hubPosts.values()].at(-1)!;
const notice = async () => (await readFormState(STAFF_NOTICE))?.notice ?? null;

describe("saving a Hub post (staff tools spec 2.4, plan decision 11)", () => {
  it("sends a signed-out visitor to sign in, and gives a student the 404", async () => {
    expect(await redirectOf(() => savePost(form(tip)))).toBe("/login?next=%2Fhub%2Fnew");
    await signedInAs(request, "acc-student");
    await expect(savePost(form(tip))).rejects.toThrow("notFound");
    expect(sampleStore().hubPosts.size).toBe(18);
  });

  it("publishes a new post: on the feed, in the log, the Hub's pages expired, and back to the list", async () => {
    await signedInAs(request, "acc-mentor");
    const redirect = await redirectSignalOf(() => savePost(form(tip)));
    expect([redirect.url, redirect.type]).toEqual(["/hub/manage", "replace"]);
    const row = newestPost();
    expect(row).toMatchObject({ title: "Price by the hour", authorId: "acc-mentor", published: true, campusSlug: "all" });
    expect(publishedPost(row.id)?.body).toBe("## Start with your costs\n- Materials\n- Transport");
    expect((await listAudit({ staff: null, kind: null }))[0]).toMatchObject({
      staffName: "Naledi",
      action: "post-created",
      targetName: "Price by the hour",
      detail: "Published",
    });
    expect(request.updatedTags).toEqual(["hub"]);
    expect(await notice()).toBe("post-published");
  });

  it("keeps an unticked Published as a draft only staff see", async () => {
    await signedInAs(request, "acc-mentor");
    await redirectOf(() => savePost(form({ ...tip, published: "" })));
    expect(publishedPost(newestPost().id)).toBeNull();
    expect(await notice()).toBe("post-draft");
  });

  it("keeps everything typed, the body up to 8,000 characters, and says what's wrong, saving nothing", async () => {
    await signedInAs(request, "acc-mentor");
    const body = "b".repeat(4500);
    expect(await redirectOf(() => savePost(form({ ...tip, kind: "event", title: "", body })))).toBe("/hub/new");
    expect(await readFormState(postForm(null))).toMatchObject({
      errors: ["post-title-missing", "post-date-missing", "post-time-missing", "post-place-missing", "post-capacity-invalid", "post-body-length"],
      values: { kind: "event", title: "", body, published: "yes" },
      notice: null,
    });
    expect(sampleStore().hubPosts.size).toBe(18);
  });

  it("previews without saving or checking, keeping every field and a cover picked before it (plan decision 12)", async () => {
    await signedInAs(request, "acc-mentor");
    const cover = new File([pngBytes()], "cover.png", { type: "image/png" });
    expect(await redirectOf(() => savePost(form({ ...tip, title: "", intent: "preview", cover })))).toBe(
      "/hub/new#new-post-preview",
    );
    const state = (await readFormState(postForm(null)))!;
    expect(state).toMatchObject({ notice: "preview", errors: [], values: { title: "", body: tip.body } });
    expect(state.values.cover).toMatch(/^\/photos\/ph-[0-9a-f-]{36}$/);
    expect(sampleStore().hubPosts.size).toBe(18);
    await redirectOf(() => savePost(form({ ...tip, keepCover: state.values.cover })));
    const row = newestPost();
    expect(row.image).toEqual({ src: state.values.cover, alt: "" });
    expect(await photoSrcsOf("hub", `post:${row.id}`)).toEqual(new Set([state.values.cover]));
  });

  it("lets a mentor edit their own post and no one else's, and an admin edit any", async () => {
    await signedInAs(request, "acc-mentor");
    const edit = { ...tip, post: "h-002", kind: "office-hours", campus: "midrand", date: "2026-10-15", time: "13:00", place: "The Hub, Block C" };
    expect(await redirectOf(() => savePost(form({ ...edit, title: "Office hours: prices" })))).toBe("/hub/manage");
    expect(sampleStore().hubPosts.get("h-002")).toMatchObject({ title: "Office hours: prices", startsAt: "2026-10-15T11:00:00.000Z" });
    expect((await listAudit({ staff: null, kind: null }))[0].action).toBe("post-updated");
    await expect(savePost(form({ ...tip, post: "h-001" }))).rejects.toThrow("notFound");
    await signedInAs(request, "acc-admin");
    await redirectOf(() => savePost(form({ ...tip, post: "h-001" })));
    expect(sampleStore().hubPosts.get("h-001")).toMatchObject({ kind: "tip", authorId: null });
  });
});

describe("the office-hours queue (staff tools spec 2.4, plan decision 14)", () => {
  it("accepts a request once: the student told, the answer in the log", async () => {
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(() => answerSlot(form({ booking: "bk-s1", answer: "accepted" })))).toBe("/hub/manage#hub-queue");
    expect(sampleStore().hubBookings.get("bk-s1")).toMatchObject({ status: "accepted", answeredBy: "acc-mentor" });
    expect((await getNotifications("acc-student", 1))[0]).toMatchObject({
      kind: "booking",
      text: "A mentor accepted your slot request for Office hours: your first listing.",
      href: "/hub/h-007/book",
    });
    expect((await listAudit({ staff: null, kind: "office-hours" }))[0]).toMatchObject({
      action: "booking-accepted",
      targetName: "Thandi: Office hours: your first listing",
    });
    expect(await notice()).toBe("booking-accepted");
    await redirectOf(() => answerSlot(form({ booking: "bk-s1", answer: "declined" })));
    expect(sampleStore().hubBookings.get("bk-s1")?.status).toBe("accepted");
    expect(await notice()).toBe("nothing");
  });

  it("declines, and refuses an answer it doesn't know", async () => {
    await signedInAs(request, "acc-admin");
    await redirectOf(() => answerSlot(form({ booking: "bk-s1", answer: "maybe" })));
    expect(sampleStore().hubBookings.get("bk-s1")?.status).toBe("open");
    await redirectOf(() => answerSlot(form({ booking: "bk-s1", answer: "declined" })));
    expect((await getNotifications("acc-student", 1))[0].text).toBe(
      "A mentor couldn't fit in your slot request for Office hours: your first listing. You can ask again.",
    );
  });
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `pnpm test lib/staff/hub-actions.test.ts`
Expected: FAIL, because `./hub-actions` doesn't exist.

- [ ] **Step 4: Write the actions**

Create `lib/staff/hub-actions.ts`:

```ts
"use server";

import { notFound } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { recordAudit } from "@/lib/data/audit";
import { answerBooking, canEditPost, getPostRow, saveHubPost } from "@/lib/data/hub-posts";
import { notify } from "@/lib/data/notifications";
import { deletePhotosUsedBy, photoSrcsOf, storePhotos, usePhotos } from "@/lib/data/photos";
import { hubChanged } from "@/lib/data/tags";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field, fileList } from "@/lib/selling/action-helpers";
import { readUploads } from "@/lib/selling/uploads";
import { requireStaff } from "./access";
import { clearStaffForm, leaveNotice, postForm, postPrefix } from "./form-state";
import { slotAnswerText } from "./notification-text";
import { bookSlotPath, editPostPath, HUB_MANAGE_PATH, HUB_NEW_PATH } from "./paths";
import { checkPost, POST_KEEP_MAX } from "./post-rules";

// The Hub's tools' Server Actions (staff tools spec 2.4; plan decisions 11, 12 and 14): saving a post, its Preview,
// and answering a slot request. Mentors and admins only; a mentor edits only their own posts, an admin any. Each
// writes one audit entry when something changed, and ends with done().

/** The owner of the Hub's cover photos (plan decision 11): not an account, so deleting a staff member's keeps them. */
const HUB_PHOTOS = "hub";
const QUEUE = `${HUB_MANAGE_PATH}#hub-queue`;

/** The fields kept for the editor after a Preview or a failed save: the body up to 8,000 characters (plan decision 12). */
function typedValues(formData: FormData, cover: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of ["kind", "title", "campus", "date", "time", "place", "capacity", "summary"]) {
    values[name] = keepTyped(field(formData, name));
  }
  values.body = [...field(formData, "body")].slice(0, POST_KEEP_MAX).join("");
  values.published = field(formData, "published") === "yes" ? "yes" : "";
  values.cover = cover;
  return values;
}

/** A cover stored on an earlier Preview: only one of the Hub's photos that's still waiting counts. */
async function keptCover(formData: FormData): Promise<string> {
  const src = field(formData, "keepCover");
  return src && (await photoSrcsOf(HUB_PHOTOS, null)).has(src) ? src : "";
}

/**
 * Save the post, or Preview it (spec 2.4, plan decision 12). A new cover is checked and stripped (selling's
 * readUploads) and stored straight away, so a Preview keeps it for the save. Preview keeps every field and shows the
 * body rendered; Save checks everything and, when it's right, writes the post, makes the cover the post's, and goes
 * back to the list.
 */
export async function savePost(formData: FormData): Promise<void> {
  const raw = field(formData, "post");
  const id = raw === "" ? null : isId(raw) ? raw : undefined;
  const path = id ? editPostPath(id) : HUB_NEW_PATH;
  const account = await requireStaff("hub", path);
  if (id === undefined) notFound();
  const existing = id ? await getPostRow(id) : null;
  // A mentor editing someone else's post gets the 404, as for a page they can't open (plan decisions 1 and 11).
  if (id && (!existing || !canEditPost(account, existing))) notFound();
  const now = new Date();
  const form = postForm(id);

  const files = fileList(formData, "cover");
  const read = files.length > 0 ? await readUploads(files.slice(0, 1), 1) : { uploads: [], errors: [] };
  const upload = read.uploads[0] ?? null;
  const cover = upload ? (await storePhotos(HUB_PHOTOS, [upload], now))[0] : await keptCover(formData);
  const values = typedValues(formData, cover);

  if (field(formData, "intent") === "preview") {
    await writeFormState(form, { errors: [...read.errors], values, notice: "preview" }, now);
    done(`${path}#${postPrefix(id)}-preview`);
  }

  const check = checkPost(
    {
      kind: field(formData, "kind"),
      title: field(formData, "title"),
      campus: field(formData, "campus"),
      date: field(formData, "date"),
      time: field(formData, "time"),
      place: field(formData, "place"),
      capacity: field(formData, "capacity"),
      summary: field(formData, "summary"),
      body: field(formData, "body"),
      published: values.published === "yes",
    },
    (await getCampuses()).map((campus) => campus.slug),
  );
  const errors = [...check.errors, ...read.errors];
  if (errors.length > 0 || !check.value) {
    await writeFormState(form, { errors, values, notice: null }, now);
    done(path);
  }

  const saved = await saveHubPost({
    id,
    fields: check.value,
    cover: cover ? { src: cover, alt: "" } : null,
    authorId: account.id,
    now,
  });
  if (!saved) notFound();
  if (cover) {
    const use = `post:${saved.row.id}`;
    await usePhotos(HUB_PHOTOS, [cover], use);
    await deletePhotosUsedBy(HUB_PHOTOS, use, new Set([cover]));
  }
  await recordAudit({
    staff: { id: account.id, firstName: account.firstName },
    action: saved.created ? "post-created" : "post-updated",
    target: { kind: "post", id: saved.row.id, name: saved.row.title },
    detail: saved.row.published ? "Published" : "Draft",
    now,
  });
  hubChanged();
  await clearStaffForm(form);
  await leaveNotice(saved.row.published ? "post-published" : "post-draft", now);
  done(HUB_MANAGE_PATH);
}

/** Accept or Decline a slot request (spec 2.4, plan decision 14): the student is told either way. */
export async function answerSlot(formData: FormData): Promise<void> {
  const staff = await requireStaff("hub", HUB_MANAGE_PATH);
  const now = new Date();
  const id = field(formData, "booking");
  const answer = field(formData, "answer");
  const answered =
    isId(id) && (answer === "accepted" || answer === "declined") ? await answerBooking(id, answer, staff.id, now) : null;
  if (!answered || (answer !== "accepted" && answer !== "declined")) {
    await leaveNotice("nothing", now);
    done(QUEUE);
  }
  await recordAudit({
    staff: { id: staff.id, firstName: staff.firstName },
    action: answer === "accepted" ? "booking-accepted" : "booking-declined",
    target: { kind: "booking", id, name: `${answered.studentName}: ${answered.postTitle}` },
    subjectId: answered.accountId,
    now,
  });
  await notify({
    accountId: answered.accountId,
    kind: "booking",
    subjectId: id,
    text: slotAnswerText(answer, answered.postTitle),
    href: bookSlotPath(answered.postId),
    now,
  });
  await leaveNotice(answer === "accepted" ? "booking-accepted" : "booking-declined", now);
  done(QUEUE);
}
```

The slot request's audit entry names the student by first name; `subjectId` lets deleting their account strip it (plan decision 6).

- [ ] **Step 5: Run it to make sure it passes**

Run: `pnpm test lib/staff/hub-actions.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Write the views' tests**

Create `components/staff/HubManage.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerBooking, listBookings, listPostsForStaff } from "@/lib/data/hub-posts";
import { resetSampleStore } from "@/lib/data/store";
import { HubManage } from "./HubManage";

vi.mock("@/lib/staff/hub-actions", () => ({ answerSlot: async () => {} }));

const names = new Map([["midrand", "Midrand"]]);

beforeEach(() => {
  resetSampleStore();
});

describe("the Hub's list and queue (staff tools spec 2.4 and 3)", () => {
  it("lists a mentor's own posts, each with Edit naming it, and Write a post", async () => {
    const posts = (await listPostsForStaff()).filter((post) => post.authorId === "acc-mentor");
    render(<HubManage posts={posts} everyPost={false} bookings={[]} campusNames={names} />);
    expect(screen.getByRole("link", { name: "Write a post" })).toHaveAttribute("href", "/hub/new");
    const table = screen.getByRole("table", { name: "Your posts, most recently changed first" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByRole("link", { name: "Edit Office hours: pricing your hustle" })).toHaveAttribute(
      "href",
      "/hub/h-002/edit",
    );
    expect(within(table).getAllByRole("cell", { name: "Published" })).toHaveLength(3);
  });

  it("lists slot requests, open first, with Accept and Decline naming the student and the office hours", async () => {
    render(<HubManage posts={[]} everyPost={true} bookings={await listBookings()} campusNames={names} />);
    const queue = screen.getByRole("region", { name: "Office-hours requests" });
    expect(queue).toHaveAttribute("id", "hub-queue");
    const accept = within(queue).getByRole("button", { name: "Accept Thandi's request for Office hours: your first listing" });
    expect(accept.closest("form")?.querySelector('input[name="answer"]')).toHaveValue("accepted");
    expect(within(queue).getByRole("button", { name: "Decline Thandi's request for Office hours: your first listing" })).toBeInTheDocument();
    expect(within(queue).getByText(/write the listing or what to charge/)).toBeInTheDocument();
    expect(screen.getByText("No posts yet.")).toBeInTheDocument();
  });

  it("shows an answered request's answer instead of its buttons", async () => {
    await answerBooking("bk-s1", "accepted", "acc-mentor", new Date("2026-10-14T08:42:00.000Z"));
    render(<HubManage posts={[]} everyPost={true} bookings={await listBookings()} campusNames={names} />);
    const queue = screen.getByRole("region", { name: "Office-hours requests" });
    expect(within(queue).getByRole("cell", { name: "Accepted" })).toBeInTheDocument();
    expect(within(queue).queryByRole("button")).toBeNull();
  });
});
```

Create `components/staff/PostEditor.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPostRow } from "@/lib/data/hub-posts";
import { resetSampleStore } from "@/lib/data/store";
import { NEW_POST_VALUES, PostEditor, postValues } from "./PostEditor";

vi.mock("@/lib/staff/hub-actions", () => ({ savePost: async () => {} }));

const campuses = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

beforeEach(() => {
  resetSampleStore();
});

describe("the post editor (staff tools spec 2.4)", () => {
  it("starts a new post as a published tip for every campus, with every field the spec names", () => {
    render(<PostEditor postId={null} values={NEW_POST_VALUES} errors={[]} preview={null} campuses={campuses} coverSrc={null} />);
    const kinds = screen.getByRole("group", { name: "Kind" });
    expect(within(kinds).getByRole("radio", { name: "Tip" })).toBeChecked();
    expect(within(kinds).getByRole("radio", { name: "Event" })).toHaveAccessibleDescription(
      "A date, a place and a number of places. Students RSVP.",
    );
    expect(screen.getByLabelText("Title")).toHaveAccessibleDescription("Up to 70 characters.");
    expect(screen.getByRole("combobox", { name: "Campus" })).toHaveValue("all");
    for (const label of ["Date", "Start time", "Place", "Places (events only)", "Summary", "The post", "Cover photo (optional)"]) {
      expect(screen.getByLabelText(label), label).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Date")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Start time")).toHaveAttribute("type", "time");
    expect(screen.getByLabelText("Cover photo (optional)")).toHaveAttribute("type", "file");
    expect(screen.getByRole("checkbox", { name: /^Published/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save the post" })).toHaveAttribute("value", "save");
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("value", "preview");
    expect(document.querySelector('input[name="post"]')).toHaveValue("");
    expect(screen.queryByRole("region", { name: "Preview" })).toBeNull();
  });

  it("fills in an existing post, its date and time in SAST", async () => {
    const values = postValues((await getPostRow("h-002"))!);
    render(<PostEditor postId="h-002" values={values} errors={[]} preview={null} campuses={campuses} coverSrc="/placeholders/hub/h-002.svg" />);
    expect(screen.getByRole("radio", { name: "Office hours" })).toBeChecked();
    expect(screen.getByLabelText("Title")).toHaveValue("Office hours: pricing your hustle");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-15");
    expect(screen.getByLabelText("Start time")).toHaveValue("13:00");
    expect(screen.getByLabelText("Place")).toHaveValue("The Hub, Block C");
    expect(document.querySelector('input[name="post"]')).toHaveValue("h-002");
    expect(screen.getByRole("link", { name: "See the cover now" })).toHaveAttribute("href", "/placeholders/hub/h-002.svg");
    expect(screen.getByLabelText("Title")).toHaveAttribute("id", "edit-h-002-title");
  });

  it("shows the body rendered above the form after Preview, and keeps a picked cover for the save", () => {
    const values = { ...NEW_POST_VALUES, body: "## Bring\n- A table", cover: "/photos/ph-00000000-0000-4000-8000-000000000000" };
    render(<PostEditor postId={null} values={values} errors={[]} preview={values.body} campuses={campuses} coverSrc={null} />);
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(preview).toHaveAttribute("id", "new-post-preview");
    expect(within(preview).getByRole("heading", { level: 2, name: "Bring" })).toBeInTheDocument();
    expect(within(preview).getByRole("listitem")).toHaveTextContent("A table");
    expect(document.querySelector('input[name="keepCover"]')).toHaveValue(values.cover);
    expect(screen.getByRole("link", { name: "see it" })).toHaveAttribute("href", values.cover);
  });

  it("says what's wrong at the top and by each field", () => {
    const errors = [
      { message: "Give the post a title.", fieldId: "new-post-title" },
      { message: "Choose a tip, an event or office hours.", fieldId: "new-post-kind-tip" },
    ];
    render(<PostEditor postId={null} values={{ ...NEW_POST_VALUES, kind: "" }} errors={errors} preview={null} campuses={campuses} coverSrc={null} />);
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("group", { name: "Kind" })).toHaveAccessibleDescription("Error: Choose a tip, an event or office hours.");
  });
});
```

- [ ] **Step 7: Run them to make sure they fail**

Run: `pnpm test components/staff/HubManage.test.tsx components/staff/PostEditor.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 8: Write the views**

Create `components/staff/HubManage.tsx`:

```tsx
import Link from "next/link";
import type { StaffPostSummary } from "@/lib/data/hub-posts";
import { hubKindLabel } from "@/lib/format";
import { hubCampusName } from "@/lib/hub";
import { answerSlot } from "@/lib/staff/hub-actions";
import { editPostPath, HUB_NEW_PATH } from "@/lib/staff/paths";
import { sastDateTime } from "@/lib/time";
import type { HubBooking } from "@/lib/types";
import { StaffTable } from "./StaffTable";

type HubManageProps = {
  /** The posts this account may edit: its own, or every post for an admin (plan decision 11). */
  posts: readonly StaffPostSummary[];
  everyPost: boolean;
  bookings: readonly HubBooking[];
  campusNames: ReadonlyMap<string, string>;
};

function AnswerButton({ booking, answer }: { booking: HubBooking; answer: "accepted" | "declined" }) {
  return (
    <form action={answerSlot}>
      <input type="hidden" name="booking" value={booking.id} />
      <input type="hidden" name="answer" value={answer} />
      <button type="submit" className={answer === "accepted" ? "staff-row-action" : "staff-row-action staff-row-action-danger"}>
        {answer === "accepted" ? "Accept" : "Decline"}{" "}
        <span className="sr-only">
          {booking.studentName}&apos;s request for {booking.postTitle}
        </span>
      </button>
    </form>
  );
}

/**
 * /hub/manage (spec 3): the posts this account may edit, drafts included, with Write a post; then the office-hours
 * queue that every mentor and admin shares (plan decision 14), open requests first, newest first, each answered with
 * Accept or Decline. Neither removes anything, so neither has a confirm page.
 */
export function HubManage({ posts, everyPost, bookings, campusNames }: HubManageProps) {
  const caption = `${everyPost ? "Every post" : "Your posts"}, most recently changed first`;
  return (
    <>
      <section aria-labelledby="hub-posts-title" className="staff-section">
        <h2 id="hub-posts-title" className="staff-section-title">
          {everyPost ? "Every post" : "Your posts"}
        </h2>
        <p>
          <Link href={HUB_NEW_PATH} prefetch={false} className="btn btn-primary">
            Write a post
          </Link>
        </p>
        <StaffTable
          caption={caption}
          columns={["Title", "Kind", "Campus", "When", "Status", "Author", "Edit"]}
          rows={posts.map((post) => ({
            key: post.id,
            cells: [
              post.title,
              hubKindLabel(post.kind),
              hubCampusName(post.campusSlug, campusNames),
              post.startsAt ? (
                <time key="when" dateTime={post.startsAt}>
                  {sastDateTime(post.startsAt)}
                </time>
              ) : (
                "No date"
              ),
              post.published ? "Published" : "Draft",
              post.authorName,
              <Link key="edit" href={editPostPath(post.id)} prefetch={false} className="staff-row-action">
                Edit <span className="sr-only">{post.title}</span>
              </Link>,
            ],
          }))}
          empty="No posts yet."
        />
      </section>
      <section id="hub-queue" aria-labelledby="hub-queue-title" className="staff-section">
        <h2 id="hub-queue-title" className="staff-section-title">
          Office-hours requests
        </h2>
        <StaffTable
          caption="Slot requests, open first, newest first"
          columns={["Office hours", "Student", "What they'd like help with", "A time that suits", "Answer"]}
          rows={bookings.map((booking) => ({
            key: booking.id,
            cells: [
              booking.startsAt ? `${booking.postTitle}, ${sastDateTime(booking.startsAt)}` : booking.postTitle,
              booking.studentName,
              <span key="help" className="staff-prewrap">
                {booking.help}
              </span>,
              booking.time || "Any time",
              booking.status === "open" ? (
                <div key="answer" className="staff-row-actions">
                  <AnswerButton booking={booking} answer="accepted" />
                  <AnswerButton booking={booking} answer="declined" />
                </div>
              ) : booking.status === "accepted" ? (
                "Accepted"
              ) : (
                "Declined"
              ),
            ],
          }))}
          empty="No slot requests yet."
        />
      </section>
    </>
  );
}
```

Create `components/staff/PostEditor.tsx`:

```tsx
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { Markdown } from "@/components/hub/Markdown";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { ALL_CAMPUSES } from "@/lib/campus";
import type { HubPostRow } from "@/lib/data/rows";
import { PHOTO_MAX_MB } from "@/lib/photos/rules";
import { postFieldIds } from "@/lib/staff/errors";
import { postPrefix } from "@/lib/staff/form-state";
import { savePost } from "@/lib/staff/hub-actions";
import { POST_KINDS, POST_SUMMARY_MAX, POST_TITLE_MAX, utcToSastFields } from "@/lib/staff/post-rules";

/** A new post's starting values: a published tip for every campus. */
export const NEW_POST_VALUES: Readonly<Record<string, string>> = { kind: "tip", campus: ALL_CAMPUSES, published: "yes" };

/** A post as the editor's values, its date and time in SAST. */
export function postValues(row: HubPostRow): Record<string, string> {
  const when = row.startsAt ? utcToSastFields(row.startsAt) : { date: "", time: "" };
  return {
    kind: row.kind,
    title: row.title,
    campus: row.campusSlug,
    date: when.date,
    time: when.time,
    place: row.place ?? "",
    capacity: row.capacity === null ? "" : String(row.capacity),
    summary: row.summary,
    body: row.body,
    published: row.published ? "yes" : "",
    cover: "",
  };
}

type FieldProps = {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value: string;
  errors: readonly FormError[];
  type?: "text" | "date" | "time";
  inputMode?: "numeric";
  required?: boolean;
};

function Field({ id, name, label, hint, value, errors, type = "text", inputMode, required = false }: FieldProps) {
  const error = errorFor(errors, id);
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint && `${id}-hint`, error && `${id}-error`)}
        className="form-input"
      />
    </div>
  );
}

type PostEditorProps = {
  /** Null for a new post. */
  postId: string | null;
  values: Readonly<Record<string, string>>;
  errors: readonly FormError[];
  /** The body as typed when Preview was pressed, rendered above the form; null otherwise. */
  preview: string | null;
  campuses: readonly { slug: string; name: string }[];
  /** The post's cover now, or null for a new post. */
  coverSrc: string | null;
};

/**
 * The Hub's post editor (spec 2.4; plan decisions 11 and 12): the kind, title, campus or all, date and start time
 * (SAST), place, places (events), summary, the body (the markdown subset), a cover photo and Published. Every field
 * shows whatever the kind, since nothing can hide them without JavaScript; hints say which apply. Preview draws the
 * body on the server, above the form; Save checks everything. A plain form, so it works without the app's JavaScript.
 */
export function PostEditor({ postId, values, errors, preview, campuses, coverSrc }: PostEditorProps) {
  const prefix = postPrefix(postId);
  const ids = postFieldIds(prefix);
  const kindError = errorFor(errors, ids.kind);
  const campusError = errorFor(errors, ids.campus);
  const bodyError = errorFor(errors, ids.body);
  const coverError = errorFor(errors, ids.photos);
  return (
    <>
      {preview !== null && (
        <section id={`${prefix}-preview`} aria-labelledby={`${prefix}-preview-title`} className="staff-section staff-preview">
          <h2 id={`${prefix}-preview-title`} className="staff-section-title">
            Preview
          </h2>
          <Markdown source={preview} className="hub-post-body" />
        </section>
      )}

      <ErrorSummary id={`${prefix}-summary`} errors={errors} />
      <form action={savePost} noValidate className="form-stack staff-editor">
        <input type="hidden" name="post" value={postId ?? ""} />

        <fieldset className="form-field" aria-describedby={describedBy(kindError && `${prefix}-kind-error`)}>
          <legend className="form-label">Kind</legend>
          <FieldError id={`${prefix}-kind-error`} message={kindError} />
          {POST_KINDS.map((kind) => {
            const radioId = `${prefix}-kind-${kind.value}`;
            return (
              <div key={kind.value} className="staff-radio">
                <div className="form-check">
                  <input
                    id={radioId}
                    type="radio"
                    name="kind"
                    value={kind.value}
                    defaultChecked={values.kind === kind.value}
                    aria-describedby={`${radioId}-hint`}
                    className="form-checkbox"
                  />
                  <label htmlFor={radioId}>{kind.label}</label>
                </div>
                <p id={`${radioId}-hint`} className="form-hint staff-radio-hint">
                  {kind.hint}
                </p>
              </div>
            );
          })}
        </fieldset>

        <Field id={ids.title} name="title" label="Title" hint={`Up to ${POST_TITLE_MAX} characters.`} value={values.title ?? ""} errors={errors} required />

        <div className="form-field">
          <label htmlFor={ids.campus} className="form-label">
            Campus
          </label>
          <p id={`${ids.campus}-hint`} className="form-hint">
            Tips are for every campus.
          </p>
          <FieldError id={`${ids.campus}-error`} message={campusError} />
          <select
            id={ids.campus}
            name="campus"
            defaultValue={values.campus ?? ALL_CAMPUSES}
            aria-invalid={campusError ? true : undefined}
            aria-describedby={describedBy(`${ids.campus}-hint`, campusError && `${ids.campus}-error`)}
            className="form-input form-select"
          >
            <option value={ALL_CAMPUSES}>All campuses</option>
            {campuses.map((campus) => (
              <option key={campus.slug} value={campus.slug}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>

        <Field id={ids.date} name="date" label="Date" hint="Events and office hours only." value={values.date ?? ""} errors={errors} type="date" />
        <Field id={ids.time} name="time" label="Start time" hint="South African time, like 13:00." value={values.time ?? ""} errors={errors} type="time" />
        <Field id={ids.place} name="place" label="Place" hint="Events and office hours only, like The Hub, Block C." value={values.place ?? ""} errors={errors} />
        <Field id={ids.capacity} name="capacity" label="Places (events only)" hint="How many can come, from 1 to 1,000." value={values.capacity ?? ""} errors={errors} inputMode="numeric" />
        <Field id={ids.summary} name="summary" label="Summary" hint={`One sentence for cards and link previews, up to ${POST_SUMMARY_MAX} characters.`} value={values.summary ?? ""} errors={errors} required />

        <div className="form-field">
          <label htmlFor={ids.body} className="form-label">
            The post
          </label>
          <p id={`${ids.body}-hint`} className="form-hint">
            Up to 4,000 characters. **Bold**, *italic*, ## headings, lists starting with - or 1., and [links](/hub)
            to pages on Vossie.
          </p>
          <FieldError id={`${ids.body}-error`} message={bodyError} />
          <textarea
            id={ids.body}
            name="body"
            rows={12}
            required
            defaultValue={values.body ?? ""}
            aria-invalid={bodyError ? true : undefined}
            aria-describedby={describedBy(`${ids.body}-hint`, bodyError && `${ids.body}-error`)}
            className="form-input staff-textarea"
          />
        </div>

        <div className="form-field">
          <label htmlFor={ids.photos} className="form-label">
            Cover photo (optional)
          </label>
          <p id={`${ids.photos}-hint`} className="form-hint">
            A JPG, PNG or WebP, up to {PHOTO_MAX_MB} MB. Without one, the post shows the Hub&apos;s banner.
          </p>
          <FieldError id={`${ids.photos}-error`} message={coverError} />
          <input
            id={ids.photos}
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-invalid={coverError ? true : undefined}
            aria-describedby={describedBy(`${ids.photos}-hint`, coverError && `${ids.photos}-error`)}
            className="form-input"
          />
          {values.cover ? (
            <p className="form-hint">
              <input type="hidden" name="keepCover" value={values.cover} />A new cover is ready (
              <a href={values.cover}>see it</a>). It&apos;s saved with the post.
            </p>
          ) : (
            coverSrc && (
              <p className="form-hint">
                <a href={coverSrc}>See the cover now</a>. Choose a photo to replace it.
              </p>
            )
          )}
        </div>

        <div className="form-check">
          <input
            id={ids.published}
            type="checkbox"
            name="published"
            value="yes"
            defaultChecked={values.published === "yes"}
            className="form-checkbox"
          />
          <label htmlFor={ids.published}>Published. Untick it to keep a draft only Hub staff can see.</label>
        </div>

        <div className="staff-actions">
          <button type="submit" name="intent" value="save" className="btn btn-primary">
            Save the post
          </button>
          <button type="submit" name="intent" value="preview" className="btn btn-outline text-navy">
            Preview
          </button>
        </div>
      </form>
    </>
  );
}
```

`PHOTO_MAX_MB` is F's (`lib/photos/rules.ts`, F Task 2); if the build named it differently, use F's constant for the 5 MB limit.

- [ ] **Step 9: Run them to make sure they pass**

Run: `pnpm test components/staff`
Expected: PASS (7 new tests).

- [ ] **Step 10: Write the pages**

Create `app/hub/manage/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { HubManage } from "@/components/staff/HubManage";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { canEditPost, listBookings, listPostsForStaff } from "@/lib/data/hub-posts";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { HUB_MANAGE_PATH } from "@/lib/staff/paths";
import { isAdmin } from "@/lib/staff/roles";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("hub", "Hub posts and office hours");
}

/** The Hub's tools (staff tools spec 3): posts and the office-hours queue. Mentors and admins only. */
export default function HubManagePage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Manage />
    </Suspense>
  );
}

async function Manage() {
  const account = await requireStaff("hub", HUB_MANAGE_PATH);
  const [posts, bookings, campuses, notice] = await Promise.all([
    listPostsForStaff(),
    listBookings(),
    getCampuses(),
    takeNotice(),
  ]);
  return (
    <StaffFrame account={account} area="Hub tools" title="Hub posts" current={HUB_MANAGE_PATH} notice={staffNoticeText(notice)}>
      <HubManage
        posts={posts.filter((post) => canEditPost(account, post))}
        everyPost={isAdmin(account)}
        bookings={bookings}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      />
    </StaffFrame>
  );
}
```

Create `app/hub/new/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { NEW_POST_VALUES, PostEditor } from "@/components/staff/PostEditor";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { sellingErrors } from "@/lib/selling/errors";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { postFieldIds, staffErrors } from "@/lib/staff/errors";
import { postForm, postPrefix } from "@/lib/staff/form-state";
import { HUB_MANAGE_PATH, HUB_NEW_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("hub", "Write a post");
}

/** A new Hub post (staff tools spec 2.4). */
export default function NewPostPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <NewPost />
    </Suspense>
  );
}

async function NewPost() {
  const account = await requireStaff("hub", HUB_NEW_PATH);
  const [campuses, state] = await Promise.all([getCampuses(), readFormState(postForm(null))]);
  const ids = postFieldIds(postPrefix(null));
  const codes = state?.errors ?? [];
  return (
    <StaffFrame account={account} area="Hub tools" title="Write a post" current={HUB_MANAGE_PATH} notice={null}>
      <PostEditor
        postId={null}
        values={state?.values ?? NEW_POST_VALUES}
        errors={[...staffErrors(codes, ids), ...sellingErrors(codes, { photos: ids.photos })]}
        preview={state?.notice === "preview" ? (state.values.body ?? "") : null}
        campuses={campuses.map((campus) => ({ slug: campus.slug, name: campus.name }))}
        coverSrc={null}
      />
    </StaffFrame>
  );
}
```

Create `app/hub/[id]/edit/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostEditor, postValues } from "@/components/staff/PostEditor";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { canEditPost, getPostRow } from "@/lib/data/hub-posts";
import { isId } from "@/lib/messaging/paths";
import { sellingErrors } from "@/lib/selling/errors";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { postFieldIds, staffErrors } from "@/lib/staff/errors";
import { postForm, postPrefix } from "@/lib/staff/form-state";
import { editPostPath, HUB_MANAGE_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("hub", "Edit a post");
}

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no post. */
export function generateStaticParams() {
  return [{ id: "h-sample" }];
}

/** Editing a post (staff tools spec 2.4): its author, or an admin. Anyone else, or an unknown post, gets the 404. */
export default function EditPostPage({ params }: PageProps<"/hub/[id]/edit">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <EditPost params={params} />
    </Suspense>
  );
}

async function EditPost({ params }: Pick<PageProps<"/hub/[id]/edit">, "params">) {
  const { id } = await params;
  const account = await requireStaff("hub", editPostPath(id));
  const row = isId(id) ? await getPostRow(id) : null;
  if (!row || !canEditPost(account, row)) notFound();
  const [campuses, state] = await Promise.all([getCampuses(), readFormState(postForm(id))]);
  const ids = postFieldIds(postPrefix(id));
  const codes = state?.errors ?? [];
  return (
    <StaffFrame account={account} area="Hub tools" title={`Edit ${row.title}`} current={HUB_MANAGE_PATH} notice={null}>
      <PostEditor
        postId={id}
        values={state?.values ?? postValues(row)}
        errors={[...staffErrors(codes, ids), ...sellingErrors(codes, { photos: ids.photos })]}
        preview={state?.notice === "preview" ? (state.values.body ?? "") : null}
        campuses={campuses.map((campus) => ({ slug: campus.slug, name: campus.name }))}
        coverSrc={row.image.src}
      />
    </StaffFrame>
  );
}
```

- [ ] **Step 11: The styles**

Check none of the new classes is taken: `grep -n "\.staff-preview\|\.staff-editor\|\.staff-radio" app/globals.css` prints nothing. Then append to the end of `app/globals.css`:

```css

/* --- Staff tools: the Hub's post editor (staff tools plan, Task 14, spec 2.4) --- */
@layer components {
  .staff-editor {
    max-width: 44rem;
  }

  .staff-radio-hint {
    margin: -6px 0 6px 36px;
  }

  /* The preview sits on the pale panel, so it reads as a sample of the post, not part of the form. */
  .staff-preview {
    max-width: 44rem;
    padding: 20px;
    border-radius: var(--radius-card);
    background: var(--color-pale);
  }
}
```

- [ ] **Step 12: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 15 more unit tests than after Task 13.

- [ ] **Step 13: Build, and look at it**

Run: `pnpm build`
Expected: the build passes. `/hub/new` and `/hub/manage` are their own routes, not `/hub/[id]` (Next matches a static segment first).

On a production build (`pnpm start --port 3201`), signed in as "Mentor", at 390 × 844 and 1280 × 800: `/hub/manage` lists Naledi's three office hours and Thandi's request with Accept and Decline; Write a post, type an event with a `## heading`, press Preview: the page comes back at the preview with the heading drawn and every field kept; Save publishes it, and `/hub` lists it. As "Student, Midrand", `/hub/manage` and `/hub/h-002/edit` show the 404. Stop the server afterwards.

- [ ] **Step 14: Hand over for commit**

Files: `lib/staff/form-state.ts`, `lib/staff/hub-actions.ts`, `lib/staff/hub-actions.test.ts`, `components/staff/HubManage.tsx`, `components/staff/HubManage.test.tsx`, `components/staff/PostEditor.tsx`, `components/staff/PostEditor.test.tsx`, `app/hub/manage/page.tsx`, `app/hub/new/page.tsx`, `app/hub/[id]/edit/page.tsx`, `app/globals.css`.
Message: `feat: the Hub's tools: a mentor's posts (an admin's: all) with drafts, the post editor with a server-rendered Preview and a cover, and the office-hours queue with Accept and Decline, each audited (staff tools spec 2.4 and 3)`

---

### Task 15: RSVP and Request a slot, for signed-in students

Spec 2.5 and plan decision 13: on an upcoming event, a signed-in visitor gets **RSVP**, then "You're going" and **Cancel my RSVP**, and the count moves; a full event says so. Office hours' **Request a slot** opens `/hub/[id]/book`, a short form (300 and 100 characters), which then shows where the request stands; the post's author is told. Signed out, both still go through sign-in, Request a slot with `next` set to the request page. This task changes the Hub post page, so it measures the Hub pages.

**Files:**
- Create: `lib/hub-actions.ts`, `lib/hub-actions.test.ts`
- Modify: `components/hub/PostAction.tsx`, `components/hub/PostAction.test.tsx`
- Create: `components/hub/BookSlot.tsx`, `components/hub/BookSlot.test.tsx`
- Create: `app/hub/[id]/book/page.tsx`
- Modify: `app/robots.ts`, `app/robots.test.ts`
- Modify: `lib/messaging/paths.ts`, `lib/messaging/paths.test.ts`
- Modify: `tests/e2e/community.spec.ts`, `tests/e2e/performance.spec.ts`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Write the actions' test**

Create `lib/hub-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { hasRsvp, publishedPost } from "@/lib/data/hub-posts";
import { getNotifications } from "@/lib/data/notifications";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { HUB_NOTICE, slotForm } from "@/lib/staff/form-state";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { cancelRsvp, rsvpToEvent, sendSlotRequest } from "./hub-actions";

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

const hubNotice = async () => (await readFormState(HUB_NOTICE))?.notice ?? null;

describe("RSVP (staff tools spec 2.5, plan decision 13)", () => {
  it("sends a signed-out visitor to sign in, coming back to the post", async () => {
    expect(await redirectOf(() => rsvpToEvent(form({ post: "h-001" })))).toBe("/login?next=%2Fhub%2Fh-001");
  });

  it("adds the student once, counts them, and says so on the post; Cancel takes it back", async () => {
    await signedInAs(request, "acc-student");
    const redirect = await redirectSignalOf(() => rsvpToEvent(form({ post: "h-001" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/hub/h-001", "replace", true]);
    expect(await hasRsvp("h-001", "acc-student")).toBe(true);
    expect(publishedPost("h-001")?.going).toBe(13);
    expect(request.updatedTags).toEqual(["hub"]);
    expect(await hubNotice()).toBe("rsvp");
    await redirectOf(() => cancelRsvp(form({ post: "h-001" })));
    expect(await hasRsvp("h-001", "acc-student")).toBe(false);
    expect(await hubNotice()).toBe("rsvp-cancelled");
  });

  it("says a full event is full, adding nobody", async () => {
    sampleStore().hubPosts.get("h-003")!.going = 40;
    await signedInAs(request, "acc-student");
    await redirectOf(() => rsvpToEvent(form({ post: "h-003" })));
    expect(await hasRsvp("h-003", "acc-student")).toBe(false);
    expect(await hubNotice()).toBe("event-full");
    expect(request.updatedTags).toEqual([]);
  });
});

describe("Request a slot (staff tools spec 2.5, plan decision 13)", () => {
  it("sends a signed-out visitor to sign in, coming back to the request page", async () => {
    expect(await redirectOf(() => sendSlotRequest(form({ post: "h-002", help: "Prices" })))).toBe(
      "/login?next=%2Fhub%2Fh-002%2Fbook",
    );
  });

  it("asks what they'd like help with, keeping what was typed", async () => {
    await signedInAs(request, "acc-seller");
    expect(await redirectOf(() => sendSlotRequest(form({ post: "h-002", help: " ", time: "t".repeat(101) })))).toBe(
      "/hub/h-002/book",
    );
    expect(await readFormState(slotForm("h-002"))).toMatchObject({
      errors: ["help-missing", "time-length"],
      values: { help: "", time: "t".repeat(101) },
    });
    expect(sampleStore().hubBookings.size).toBe(1);
  });

  it("sends the request, tells the office hours' author, and says so on the request page", async () => {
    await signedInAs(request, "acc-seller");
    expect(
      await redirectOf(() => sendSlotRequest(form({ post: "h-002", help: "Pricing my calculators.", time: "After 13:30" }))),
    ).toBe("/hub/h-002/book");
    expect([...sampleStore().hubBookings.values()].at(-1)).toMatchObject({
      postId: "h-002",
      accountId: "acc-seller",
      help: "Pricing my calculators.",
      time: "After 13:30",
      status: "open",
    });
    expect((await getNotifications("acc-mentor", 1))[0]).toMatchObject({
      kind: "booking",
      text: "Sipho asked for a slot at Office hours: pricing your hustle.",
      href: "/hub/manage#hub-queue",
    });
    expect(await hubNotice()).toBe("slot-requested");
    expect(await readFormState(slotForm("h-002"))).toBeNull();
  });

  it("takes no second open request, and none for office hours that have passed", async () => {
    await signedInAs(request, "acc-student");
    expect(await redirectOf(() => sendSlotRequest(form({ post: "h-007", help: "Again." })))).toBe("/hub/h-007/book");
    expect(await redirectOf(() => sendSlotRequest(form({ post: "h-012", help: "Too late." })))).toBe("/hub/h-012");
    expect(sampleStore().hubBookings.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm test lib/hub-actions.test.ts`
Expected: FAIL, because `./hub-actions` doesn't exist.

- [ ] **Step 3: Write the actions**

Create `lib/hub-actions.ts`:

```ts
"use server";

import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { addRsvp, removeRsvp, requestSlot } from "@/lib/data/hub-posts";
import { notify } from "@/lib/data/notifications";
import { hubChanged } from "@/lib/data/tags";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field } from "@/lib/selling/action-helpers";
import { clearStaffForm, HUB_NOTICE, leaveNotice, slotForm } from "@/lib/staff/form-state";
import { slotRequestedText } from "@/lib/staff/notification-text";
import { bookSlotPath, HUB_MANAGE_PATH } from "@/lib/staff/paths";
import { checkHelp, checkTime } from "@/lib/staff/rules";
import { sastDate } from "@/lib/time";

// A student's RSVP and slot request (staff tools spec 2.5, plan decision 13). Plain forms, so they work before the
// app's JavaScript arrives. Signed out, each goes to sign-in and comes back. Identity comes only from the session;
// errors stay in D's form state; each ends with done(): refresh, then a replace redirect.

const postPath = (id: string) => `/hub/${id}`;

function postFrom(formData: FormData): string | null {
  const id = field(formData, "post");
  return isId(id) ? id : null;
}

/** RSVP: the student is going, and the event's count moves (the Hub's cached posts are expired). */
export async function rsvpToEvent(formData: FormData): Promise<void> {
  const id = postFrom(formData);
  if (!id) done("/hub");
  const account = await requireAccount(postPath(id));
  const now = new Date();
  const result = await addRsvp(id, account.id, sastDate(now), now);
  if (result === "going") hubChanged();
  if (result === "going" || result === "full") {
    await leaveNotice(result === "going" ? "rsvp" : "event-full", now, HUB_NOTICE);
  }
  done(postPath(id));
}

/** Cancel my RSVP. */
export async function cancelRsvp(formData: FormData): Promise<void> {
  const id = postFrom(formData);
  if (!id) done("/hub");
  const account = await requireAccount(postPath(id));
  const now = new Date();
  if (await removeRsvp(id, account.id)) {
    hubChanged();
    await leaveNotice("rsvp-cancelled", now, HUB_NOTICE);
  }
  done(postPath(id));
}

/**
 * Request a slot (spec 2.5): what they'd like help with (up to 300 characters) and, if they like, a time that suits
 * (up to 100). One open request per student per office hours; the post's author is told (FUNCTION-MAP I2).
 */
export async function sendSlotRequest(formData: FormData): Promise<void> {
  const id = postFrom(formData);
  if (!id) done("/hub");
  const path = bookSlotPath(id);
  const account = await requireAccount(path);
  const now = new Date();
  const help = checkHelp(field(formData, "help"));
  const time = checkTime(field(formData, "time"));
  const errors = [help.error, time.error].filter((error): error is NonNullable<typeof error> => error !== null);
  if (errors.length > 0) {
    const values = { help: keepTyped(help.value), time: keepTyped(time.value) };
    await writeFormState(slotForm(id), { errors, values, notice: null }, now);
    done(path);
  }
  const made = await requestSlot({
    postId: id,
    accountId: account.id,
    help: help.value,
    time: time.value,
    today: sastDate(now),
    now,
  });
  // The post says the office hours have passed; the request page says where an open request stands.
  if (made === "closed") done(postPath(id));
  if (made === "open-already") done(path);
  if (made.authorId && made.authorId !== account.id) {
    await notify({
      accountId: made.authorId,
      kind: "booking",
      subjectId: made.booking.id,
      text: slotRequestedText(account.firstName, made.postTitle),
      href: `${HUB_MANAGE_PATH}#hub-queue`,
      now,
    });
  }
  await clearStaffForm(slotForm(id));
  await leaveNotice("slot-requested", now, HUB_NOTICE);
  done(path);
}
```

Run: `pnpm test lib/hub-actions.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 4: Change the post's action, and write the request page's test**

Replace `components/hub/PostAction.test.tsx` with (it keeps part B's five checks, the signed-out office hours now leading to the request page, and adds the signed-in ones):

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHubPost } from "@/lib/data";
import { addRsvp } from "@/lib/data/hub-posts";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { PostAction } from "./PostAction";

const viewer = vi.hoisted(() => ({ id: null as string | null }));

// connection() needs Next's request context, which tests don't have.
vi.mock("next/server", () => ({ connection: async () => undefined }));
// The session is the sample account named here; the store is the real sample store.
vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  return { getViewer: async () => (viewer.id ? getAccount(viewer.id) : null), getSessionKey: async () => null };
});
// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/hub-actions", () => ({ rsvpToEvent: async () => {}, cancelRsvp: async () => {} }));

beforeEach(() => {
  resetSampleStore();
  viewer.id = null;
});

/** Fake only the date: "now" is the given time. */
function now(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

async function show(id: string) {
  return render(await PostAction({ post: (await getHubPost(id))! }));
}

describe("PostAction, signed out (community spec 5.2, decision 6)", () => {
  it("offers RSVP through the sign-in page, until midnight on the event's day in SAST", async () => {
    now("2026-10-14T21:30:00Z"); // 23:30 on the day, in South Africa
    await show("h-001");
    expect(screen.getByRole("link", { name: "RSVP" })).toHaveAttribute("href", "/login?next=%2Fhub%2Fh-001");
  });

  it("says an event has passed from the next day, with no button", async () => {
    now("2026-10-14T22:30:00Z"); // 00:30 the next day, in South Africa
    await show("h-001");
    expect(screen.getByText("This event has passed")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers Request a slot through sign-in to its request page, with a note for the mentor (staff tools spec 2.5)", async () => {
    now("2026-10-12T08:00:00Z");
    await show("h-002");
    expect(screen.getByRole("link", { name: "Request a slot" })).toHaveAttribute(
      "href",
      "/login?next=%2Fhub%2Fh-002%2Fbook",
    );
    expect(screen.getByText("Tell the mentor what you'd like help with when you sign in.")).toBeInTheDocument();
  });

  it("says office hours have passed, with no button and no note", async () => {
    now("2026-10-12T08:00:00Z");
    await show("h-012");
    expect(screen.getByText("These office hours have passed")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/Tell the mentor/)).toBeNull();
  });

  it("keeps the room for the tallest state of each kind", async () => {
    now("2026-10-12T08:00:00Z");
    const { container, unmount } = await show("h-012");
    expect(container.querySelector(".hub-post-action")).toHaveAttribute("data-kind", "office-hours");
    unmount();
    const event = await show("h-001");
    expect(event.container.querySelector(".hub-post-action")).not.toHaveAttribute("data-kind");
  });
});

describe("PostAction, signed in (staff tools spec 2.5, plan decision 13)", () => {
  it("gives RSVP as a button, then You're going with Cancel my RSVP", async () => {
    now("2026-10-12T08:00:00Z");
    viewer.id = "acc-student";
    const first = await show("h-001");
    expect(screen.getByRole("button", { name: "RSVP" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="post"]')).toHaveValue("h-001");
    first.unmount();
    await addRsvp("h-001", "acc-student", "2026-10-12", new Date());
    await show("h-001");
    expect(screen.getByText("You're going")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel my RSVP" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "RSVP" })).toBeNull();
  });

  it("says a full event is full, with no button", async () => {
    now("2026-10-12T08:00:00Z");
    viewer.id = "acc-student";
    sampleStore().hubPosts.get("h-003")!.going = 40;
    await show("h-003");
    expect(screen.getByText("This event is full.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("links office hours to their request page, or says where the student's request stands", async () => {
    now("2026-10-12T08:00:00Z");
    viewer.id = "acc-seller";
    const first = await show("h-002");
    expect(screen.getByRole("link", { name: "Request a slot" })).toHaveAttribute("href", "/hub/h-002/book");
    expect(screen.getByText("Tell the mentor what you'd like help with.")).toBeInTheDocument();
    first.unmount();
    viewer.id = "acc-student";
    await show("h-007");
    expect(screen.getByText("Your request is waiting for a mentor.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See your request" })).toHaveAttribute("href", "/hub/h-007/book");
  });
});
```

Create `components/hub/BookSlot.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHubPost } from "@/lib/data";
import { latestBooking } from "@/lib/data/hub-posts";
import { resetSampleStore } from "@/lib/data/store";
import type { HubBooking } from "@/lib/types";
import { BookSlotView } from "./BookSlot";

vi.mock("@/lib/hub-actions", () => ({ sendSlotRequest: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

async function show(overrides: Partial<Parameters<typeof BookSlotView>[0]> = {}) {
  const post = (await getHubPost("h-002"))!;
  render(<BookSlotView post={post} passed={false} latest={null} values={{}} errors={[]} notice={null} {...overrides} />);
}

describe("Request a slot (staff tools spec 2.5, plan decision 13)", () => {
  it("asks what they'd like help with and a time that suits, for these office hours", async () => {
    await show();
    expect(screen.getByRole("link", { name: "Back to Office hours: pricing your hustle" })).toHaveAttribute("href", "/hub/h-002");
    expect(screen.getByRole("heading", { level: 1, name: "Request a slot" })).toBeInTheDocument();
    expect(screen.getByText(/Thu 15 Oct · 13:00/)).toBeInTheDocument();
    const help = screen.getByLabelText("What you'd like help with");
    expect(help).toBeRequired();
    expect(help).toHaveAccessibleDescription("Up to 300 characters.");
    expect(screen.getByLabelText("A time that suits (optional)")).toHaveAccessibleDescription(
      "Up to 100 characters, like After 13:30.",
    );
    expect(screen.getByRole("button", { name: "Send request" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="post"]')).toHaveValue("h-002");
  });

  it("shows where an open request stands instead of the form", async () => {
    const latest = await latestBooking("h-007", "acc-student");
    await show({ latest });
    expect(screen.getByRole("region", { name: "Your request" })).toHaveTextContent("Waiting for a mentor.");
    expect(screen.getByText(/write the listing or what to charge/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says when a mentor accepted it", async () => {
    const latest = { ...(await latestBooking("h-007", "acc-student"))!, status: "accepted" } satisfies HubBooking;
    await show({ latest });
    expect(screen.getByRole("region", { name: "Your request" })).toHaveTextContent("A mentor accepted it. See you there.");
  });

  it("offers the form again after a decline", async () => {
    const latest = { ...(await latestBooking("h-007", "acc-student"))!, status: "declined" } satisfies HubBooking;
    await show({ latest });
    expect(screen.getByText("A mentor couldn't fit in your last request. You can ask again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send request" })).toBeInTheDocument();
  });

  it("says when the office hours have passed, with no form", async () => {
    await show({ passed: true });
    expect(screen.getByText("These office hours have passed")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps what was typed and says what's wrong, and shows the last action's notice", async () => {
    await show({
      values: { help: "", time: "Mornings" },
      errors: [{ message: "Say what you'd like help with.", fieldId: "book-h-002-help" }],
      notice: "Request sent. A mentor will answer in your notifications.",
    });
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("What you'd like help with")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("A time that suits (optional)")).toHaveValue("Mornings");
    expect(screen.getByRole("status")).toHaveTextContent("Request sent.");
  });
});
```

- [ ] **Step 5: Run them to make sure they fail**

Run: `pnpm test components/hub/PostAction.test.tsx components/hub/BookSlot.test.tsx`
Expected: FAIL: the action is still a sign-in link for everyone, and `BookSlot.tsx` doesn't exist.

- [ ] **Step 6: Write the post's action and the request page**

Replace `components/hub/PostAction.tsx` with:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getViewer } from "@/lib/auth/session";
import { hasRsvp, latestBooking } from "@/lib/data/hub-posts";
import { hasPassed } from "@/lib/hub";
import { cancelRsvp, rsvpToEvent } from "@/lib/hub-actions";
import { signInHref } from "@/lib/next-path";
import { HUB_NOTICE, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { bookSlotPath } from "@/lib/staff/paths";
import { sastToday } from "@/lib/time";
import type { HubPost } from "@/lib/types";

type ActionPost = Pick<HubPost, "id" | "kind" | "startsAt" | "capacity" | "going">;

async function eventAction(post: ActionPost, accountId: string | null): Promise<ReactNode> {
  if (!accountId) {
    return (
      <Link href={signInHref(`/hub/${post.id}`)} prefetch={false} className="btn btn-primary hub-post-cta">
        RSVP
      </Link>
    );
  }
  if (await hasRsvp(post.id, accountId)) {
    return (
      <div className="hub-rsvp-going">
        <p className="hub-rsvp-badge">You&apos;re going</p>
        <form action={cancelRsvp}>
          <input type="hidden" name="post" value={post.id} />
          <button type="submit" className="link-button">
            Cancel my RSVP
          </button>
        </form>
      </div>
    );
  }
  if (post.capacity !== null && (post.going ?? 0) >= post.capacity) {
    return <p className="hub-post-passed">This event is full.</p>;
  }
  return (
    <form action={rsvpToEvent}>
      <input type="hidden" name="post" value={post.id} />
      <button type="submit" className="btn btn-primary hub-post-cta">
        RSVP
      </button>
    </form>
  );
}

async function officeHoursAction(post: ActionPost, accountId: string | null): Promise<ReactNode> {
  if (!accountId) {
    return (
      <>
        <Link href={signInHref(bookSlotPath(post.id))} prefetch={false} className="btn btn-primary hub-post-cta">
          Request a slot
        </Link>
        <p className="hub-post-note">Tell the mentor what you&apos;d like help with when you sign in.</p>
      </>
    );
  }
  const latest = await latestBooking(post.id, accountId);
  if (latest && latest.status !== "declined") {
    return (
      <>
        <p className="hub-rsvp-badge">
          {latest.status === "open" ? "Your request is waiting for a mentor." : "A mentor accepted your request."}
        </p>
        <Link href={bookSlotPath(post.id)} prefetch={false} className="link-button">
          See your request
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href={bookSlotPath(post.id)} prefetch={false} className="btn btn-primary hub-post-cta">
        Request a slot
      </Link>
      <p className="hub-post-note">Tell the mentor what you&apos;d like help with.</p>
    </>
  );
}

/**
 * RSVP for an event, or Request a slot for office hours (community spec 5.2; staff tools spec 2.5, plan decision 13).
 * Signed out, both go through the sign-in page, Request a slot coming back to its request page. Signed in, RSVP is a
 * button, then "You're going" with Cancel my RSVP, and a full event says so; office hours link to their request page,
 * or say where the student's request stands. Once the day has passed in SAST it says so instead. It reads the clock
 * and the session, so this small part renders per request; the rest of the post is prerendered.
 */
export async function PostAction({ post }: { post: ActionPost }) {
  // The clock is read only after connection() (decision 26).
  await connection();
  const passed = hasPassed(post, sastToday());
  const account = passed ? null : await getViewer().catch(() => null);
  const notice = account ? staffNoticeText(await takeNotice(HUB_NOTICE)) : null;

  let content: ReactNode;
  if (post.kind === "event") {
    content = passed ? <p className="hub-post-passed">This event has passed</p> : await eventAction(post, account?.id ?? null);
  } else if (passed) {
    content = <p className="hub-post-passed">These office hours have passed</p>;
  } else {
    content = await officeHoursAction(post, account?.id ?? null);
  }

  return (
    <div className="hub-post-action" data-kind={post.kind === "office-hours" ? "office-hours" : undefined}>
      {notice && (
        <p role="status" className="hub-post-note">
          {notice}
        </p>
      )}
      {content}
    </div>
  );
}

/** The action's room while it streams in, the same height as its tallest state, so the page doesn't move. */
export function PostActionSkeleton({ kind }: { kind: HubPost["kind"] }) {
  return (
    <div
      className="hub-post-action"
      data-kind={kind === "office-hours" ? "office-hours" : undefined}
      aria-hidden="true"
    >
      <span className="skeleton hub-post-action-skeleton" />
    </div>
  );
}
```

(`HubPostView` already passes the whole post, which has `capacity` and `going`.)

Create `components/hub/BookSlot.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { ChevronLeftIcon } from "@/components/icons";
import { readFormState } from "@/lib/auth/form-state";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { requireAccount } from "@/lib/auth/session";
import { getHubPost } from "@/lib/data";
import { latestBooking } from "@/lib/data/hub-posts";
import { hasPassed } from "@/lib/hub";
import { sendSlotRequest } from "@/lib/hub-actions";
import { isId } from "@/lib/messaging/paths";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { HUB_NOTICE, slotForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { bookSlotPath } from "@/lib/staff/paths";
import { HELP_MAX, TIME_MAX } from "@/lib/staff/rules";
import { sastDateTime, sastToday } from "@/lib/time";
import type { HubBooking, HubPost } from "@/lib/types";

type BookSlotViewProps = {
  post: Pick<HubPost, "id" | "title" | "startsAt" | "place">;
  passed: boolean;
  /** The student's newest request for these office hours, or null. */
  latest: HubBooking | null;
  values: Readonly<Record<string, string>>;
  errors: readonly FormError[];
  notice: string | null;
};

/**
 * Request a slot (spec 2.5, plan decision 13): what you'd like help with (up to 300 characters) and a time that suits
 * (up to 100, optional). With an open or accepted request, it says where it stands instead; after a decline, the form
 * comes back. The words are samples for Lama to change.
 */
export function BookSlotView({ post, passed, latest, values, errors, notice }: BookSlotViewProps) {
  const ids = staffFieldIds(`book-${post.id}`);
  const helpError = errorFor(errors, ids.help);
  const timeError = errorFor(errors, ids.time);
  const standing = latest && latest.status !== "declined" ? latest : null;
  const canAsk = !passed && !standing;
  return (
    <div className="hub-book-body">
      <Link href={`/hub/${post.id}`} prefetch={false} className="account-crumb">
        <ChevronLeftIcon />
        Back to {post.title}
      </Link>
      <h1 className="hub-book-title">Request a slot</h1>
      <p className="hub-book-post">
        {post.title}
        {post.startsAt && (
          <>
            {" · "}
            <time dateTime={post.startsAt}>{sastDateTime(post.startsAt)}</time>
          </>
        )}
        {post.place && ` · ${post.place}`}
      </p>
      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}
      {standing && (
        <section aria-labelledby={`book-${post.id}-request-title`} className="hub-book-request">
          <h2 id={`book-${post.id}-request-title`} className="hub-book-heading">
            Your request
          </h2>
          <p className="hub-book-status">
            {standing.status === "open"
              ? "Waiting for a mentor. You'll get a notification when one answers."
              : "A mentor accepted it. See you there."}
          </p>
          <dl className="hub-book-facts">
            <div>
              <dt>What you&apos;d like help with</dt>
              <dd className="staff-prewrap">{standing.help}</dd>
            </div>
            <div>
              <dt>A time that suits</dt>
              <dd>{standing.time || "Any time"}</dd>
            </div>
          </dl>
        </section>
      )}
      {latest?.status === "declined" && !passed && (
        <p>A mentor couldn&apos;t fit in your last request. You can ask again.</p>
      )}
      {passed && <p className="hub-post-passed">These office hours have passed</p>}
      {canAsk && (
        <>
          <ErrorSummary id={`book-${post.id}-summary`} errors={errors} />
          <form action={sendSlotRequest} noValidate className="form-stack">
            <input type="hidden" name="post" value={post.id} />
            <div className="form-field">
              <label htmlFor={ids.help} className="form-label">
                What you&apos;d like help with
              </label>
              <p id={`${ids.help}-hint`} className="form-hint">
                Up to {HELP_MAX} characters.
              </p>
              <FieldError id={`${ids.help}-error`} message={helpError} />
              <textarea
                id={ids.help}
                name="help"
                rows={4}
                required
                defaultValue={values.help ?? ""}
                aria-invalid={helpError ? true : undefined}
                aria-describedby={describedBy(`${ids.help}-hint`, helpError && `${ids.help}-error`)}
                className="form-input staff-textarea"
              />
            </div>
            <div className="form-field">
              <label htmlFor={ids.time} className="form-label">
                A time that suits (optional)
              </label>
              <p id={`${ids.time}-hint`} className="form-hint">
                Up to {TIME_MAX} characters, like After 13:30.
              </p>
              <FieldError id={`${ids.time}-error`} message={timeError} />
              <input
                id={ids.time}
                name="time"
                type="text"
                defaultValue={values.time ?? ""}
                aria-invalid={timeError ? true : undefined}
                aria-describedby={describedBy(`${ids.time}-hint`, timeError && `${ids.time}-error`)}
                className="form-input"
              />
            </div>
            <button type="submit" className="btn btn-primary form-submit">
              Send request
            </button>
          </form>
        </>
      )}
    </div>
  );
}

/**
 * The request page for this visitor (spec 2.5). Request-time: it reads the session (signed out, sign in and come
 * back here), the clock and the form state. Anything but published office hours is the 404.
 */
export async function BookSlot({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAccount(bookSlotPath(id));
  const post = isId(id) ? await getHubPost(id) : null;
  if (!post || post.kind !== "office-hours") notFound();
  // Whether they've passed reads the clock (decision 26).
  await connection();
  const [latest, state, notice] = await Promise.all([
    latestBooking(post.id, account.id),
    readFormState(slotForm(post.id)),
    takeNotice(HUB_NOTICE),
  ]);
  return (
    <BookSlotView
      post={post}
      passed={hasPassed(post, sastToday())}
      latest={latest}
      values={state?.values ?? {}}
      errors={staffErrors(state?.errors ?? [], staffFieldIds(`book-${post.id}`))}
      notice={staffNoticeText(notice)}
    />
  );
}

/** The request page's shape while it streams in. */
export function BookSlotSkeleton() {
  return (
    <div className="hub-book-body" aria-hidden="true">
      <span className="skeleton hub-book-skeleton-crumb" />
      <span className="skeleton hub-book-skeleton-title" />
      <span className="skeleton hub-book-skeleton-form" />
    </div>
  );
}
```

The first BookSlot test's "Thu 15 Oct · 13:00" is `sastDateTime` of h-002's start, 11:00 UTC.

Create `app/hub/[id]/book/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { BookSlot, BookSlotSkeleton } from "@/components/hub/BookSlot";

/** A page for one student's request, so search engines leave it out (robots.txt too). */
export const metadata: Metadata = { title: "Request a slot", robots: { index: false } };

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no post. */
export function generateStaticParams() {
  return [{ id: "h-sample" }];
}

/** Request a slot (staff tools spec 2.5). Everything needs the session, so it streams in behind a skeleton. */
export default function BookSlotPage({ params }: PageProps<"/hub/[id]/book">) {
  return (
    <div className="page hub-book-page">
      <Suspense fallback={<BookSlotSkeleton />}>
        <BookSlot params={params} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 7: Run them to make sure they pass**

Run: `pnpm test components/hub lib/hub-actions.test.ts`
Expected: PASS: 8 PostAction tests, 6 request page tests, and part B's other Hub tests unchanged.

- [ ] **Step 8: Keep crawlers off the request page, and give it a back link from sign-in**

In `app/robots.ts`, add `"/hub/*/book"` at the end of `DISALLOWED`, and after the comment's last sentence add: "A Hub post's slot request page (`/hub/*/book`) belongs to one student (staff tools plan, Task 15)."

In `app/robots.test.ts`, add this test after "doesn't catch pages that only start with the same letters…":

```ts

  it("keeps crawlers off a Hub post's slot request page, and not off the post (staff tools plan, Task 15)", () => {
    expect(blocked("/hub/h-002/book")).toBe(true);
    expect(blocked("/hub/h-002")).toBe(false);
  });
```

In `lib/messaging/paths.ts` (E Task 2):
1. Replace `const ACCOUNT_ONLY = ["/account", "/messages", "/notifications"];` with:

```ts
// Pages that need an account, or a staff role (staff tools plan, Task 15): going back would only come back to sign-in.
const ACCOUNT_ONLY = ["/account", "/messages", "/notifications", "/admin", "/mentor", "/hub/manage", "/hub/new"];
const HUB_EDIT = /^\/hub\/[a-z0-9][a-z0-9-]*\/edit$/;
const HUB_BOOK = /^\/hub\/([a-z0-9][a-z0-9-]*)\/book$/;
```

2. In `backPathFor`, straight after the `if (ACCOUNT_ONLY.some(…)) return null;` line, add:

```ts
  if (HUB_EDIT.test(path)) return null;
  const booking = HUB_BOOK.exec(path);
  if (booking) return `/hub/${booking[1]}`;
```

3. In `backPathFor`'s comment, after "nowhere for pages that need an account", add ", or a staff role; a slot request's post for its request page".

In `lib/messaging/paths.test.ts`, add this test to the `describe` that tests `backPathFor`:

```ts

  it("gives staff pages no back link, and a slot request page its post (staff tools plan, Task 15)", () => {
    for (const next of ["/admin", "/admin/reports/rep-1", "/mentor/tech-corner", "/hub/manage", "/hub/new", "/hub/h-002/edit"]) {
      expect(backPathFor(next), next).toBeNull();
    }
    expect(backPathFor("/hub/h-002/book")).toBe("/hub/h-002");
    expect(backPathFor("/hub/h-002")).toBe("/hub/h-002");
  });
```

Run: `pnpm test app/robots.test.ts lib/messaging/paths.test.ts`
Expected: PASS.

- [ ] **Step 9: The styles**

Check none of the new classes is taken: `grep -n "\.hub-rsvp\|\.hub-book" app/globals.css` prints nothing. Then append to the end of `app/globals.css`:

```css

/* --- Staff tools: RSVP and Request a slot (staff tools plan, Task 15, spec 2.5) --- */
@layer components {
  /* "You're going" and Cancel my RSVP share one row, the button's 48px, so the action's room still fits. */
  .hub-rsvp-going {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }

  /* Navy on pale is 10.6:1. */
  .hub-rsvp-badge {
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: 0 18px;
    border-radius: 999px;
    background: var(--color-pale);
    color: var(--color-navy);
    font-weight: 600;
  }

  /* .page and .hub-book-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .hub-book-page {
    padding: 24px 16px 64px;
  }

  .hub-book-body {
    display: grid;
    justify-items: start;
    gap: 18px;
    max-width: 40rem;
  }

  .hub-book-body > form {
    width: 100%;
  }

  .hub-book-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: clamp(2rem, 1.7rem + 1.2vw, 2.75rem);
    line-height: 1;
    text-transform: uppercase;
  }

  .hub-book-post {
    color: var(--color-ink);
    font-weight: 600;
  }

  .hub-book-request {
    display: grid;
    gap: 10px;
    width: 100%;
    padding: 18px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  .hub-book-heading {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 22px;
    line-height: 1.05;
    text-transform: uppercase;
  }

  .hub-book-status {
    color: var(--color-navy);
    font-weight: 600;
  }

  /* Muted on the grey panel is 5.4:1. */
  .hub-book-facts dt {
    color: var(--color-muted);
    font-size: 14px;
  }

  .hub-book-skeleton-crumb {
    width: 12rem;
    height: 44px;
  }

  .hub-book-skeleton-title {
    width: min(20rem, 80%);
    height: 44px;
  }

  .hub-book-skeleton-form {
    width: 100%;
    height: 22rem;
    border-radius: var(--radius-card);
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .hub-book-page {
      padding-inline: 40px;
    }
  }
}
```

- [ ] **Step 10: The end-to-end checks that change**

In `tests/e2e/community.spec.ts`, in "upcoming office hours offer Request a slot through the sign-in page", replace

```ts
    await expect(page.getByRole("link", { name: "Request a slot" })).toHaveAttribute(
      "href",
      `/login?next=%2Fhub%2F${id}`,
    );
```

with

```ts
    // Signing in comes back to the post's request page (staff tools spec 2.5).
    await expect(page.getByRole("link", { name: "Request a slot" })).toHaveAttribute(
      "href",
      `/login?next=%2Fhub%2F${id}%2Fbook`,
    );
```

In `tests/e2e/performance.spec.ts`, add two rows to `PAGES` after `["Hub post", "/hub/h-013"],`:

```ts
  ["Hub event", "/hub/h-001"],
  ["Hub office hours", "/hub/h-002"],
```

- [ ] **Step 11: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 18 more unit tests than after Task 14 (7 actions, 3 more PostAction, 6 request page, 1 robots, 1 paths; none removed).

- [ ] **Step 12: Measure the Hub pages**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS. Put the homepage, browse, listing, storefront, Hub event and Hub office hours figures in the ledger's "Task 15" row. The Hub post pages gain the two small forms' Server Action references; expect a few hundred bytes at most on the two Hub post rows and nothing elsewhere. If any page passes the stop line, stop and report.

Then run the Hub's own end-to-end tests: `pnpm e2e tests/e2e/community.spec.ts tests/e2e/cls.spec.ts -g "Hub"`
Expected: PASS: signed out, the post's action looks as it did, and its room still holds still.

- [ ] **Step 13: Look at it**

On a production build (`pnpm build`, then `pnpm start --port 3201`), at 390 × 844 and 1280 × 800, signed in as "Student, Midrand": an upcoming event's RSVP turns into "You're going" with the count one higher, and Cancel my RSVP takes it back; office hours' Request a slot opens the request page, Send request with nothing typed shows the error summary, and a sent request shows "Your request" and, on the post, "Your request is waiting for a mentor." Signed out, Request a slot goes to `/login?next=%2Fhub%2Fh-002%2Fbook` and its back link returns to the post. Stop the server afterwards. (If every sample event has passed on the day you run this, check RSVP on an event you publish as "Mentor" from `/hub/new` first.)

- [ ] **Step 14: Hand over for commit**

Files: `lib/hub-actions.ts`, `lib/hub-actions.test.ts`, `components/hub/PostAction.tsx`, `components/hub/PostAction.test.tsx`, `components/hub/BookSlot.tsx`, `components/hub/BookSlot.test.tsx`, `app/hub/[id]/book/page.tsx`, `app/robots.ts`, `app/robots.test.ts`, `lib/messaging/paths.ts`, `lib/messaging/paths.test.ts`, `tests/e2e/community.spec.ts`, `tests/e2e/performance.spec.ts`, `app/globals.css`.
Message: `feat: real RSVP and Request a slot for signed-in students (a full event says so, one open request per office hours, the author told), the request page, and its robots and sign-in back link (staff tools spec 2.5). JS: Hub event <n> B, Hub office hours <n> B`

---

### Task 16: The mentor dashboard, a shop's mentor page and the CSV

`/mentor`, `/mentor/[slug]` and `/mentor/export` (spec 2.6; plan decisions 15 to 17): a mentor's assigned shops (an admin's: every assigned shop, with its mentor) with the last 14 days' numbers and flags; a shop's page with what the flags mean, its notes and check-ins, and forms to add both; and the table as a CSV download behind the same role check.

**Files:**
- Create: `lib/staff/mentor-actions.ts`, `lib/staff/mentor-actions.test.ts`
- Create: `components/staff/MentorDashboard.tsx`, `components/staff/MentorDashboard.test.tsx`
- Create: `components/staff/MentorShop.tsx`, `components/staff/MentorShop.test.tsx`
- Create: `app/mentor/page.tsx`, `app/mentor/[slug]/page.tsx`
- Create: `app/mentor/export/route.ts`, `app/mentor/export/route.test.ts`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `01-getting-started/15-route-handlers.md`: a `GET` handler that reads the request's cookies runs per request; `redirect()` and `notFound()` work in it (`not-found.md`). A static segment (`/mentor/export`) is matched before the dynamic one (`/mentor/[slug]`).

- [ ] **Step 2: Write the actions' and the CSV route's tests**

Create `lib/staff/mentor-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { listAudit } from "@/lib/data/audit";
import { listNotes } from "@/lib/data/mentors";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { checkInForm, noteForm, STAFF_NOTICE } from "./form-state";
import { addCheckIn, addMentorNote } from "./mentor-actions";

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

describe("mentors' notes and check-ins (staff tools spec 2.6, plan decision 16)", () => {
  it("sends a signed-out visitor to sign in, and gives a student or a shop's other mentor the 404", async () => {
    expect(await redirectOf(() => addMentorNote(form({ shop: "tech-corner", text: "Hi" })))).toBe(
      "/login?next=%2Fmentor%2Ftech-corner",
    );
    await signedInAs(request, "acc-student");
    await expect(addMentorNote(form({ shop: "tech-corner", text: "Hi" }))).rejects.toThrow("notFound");
    sampleStore().accounts.set("acc-zanele", { ...sampleStore().accounts.get("acc-mentor")!, id: "acc-zanele", email: "zanele@eduvos.com" });
    await signedInAs(request, "acc-zanele");
    await expect(addMentorNote(form({ shop: "tech-corner", text: "Hi" }))).rejects.toThrow("notFound");
    expect(sampleStore().mentorNotes.size).toBe(2);
  });

  it("adds a note about the shop's owner, logged without its words, and goes back to the notes", async () => {
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(() => addMentorNote(form({ shop: "tech-corner", text: "Try a plain background." })))).toBe(
      "/mentor/tech-corner#mentor-tech-corner-notes",
    );
    expect((await listNotes("acc-seller"))[0]).toMatchObject({ kind: "note", text: "Try a plain background.", authorName: "Naledi" });
    expect((await listAudit({ staff: null, kind: null }))[0]).toMatchObject({
      action: "note-added",
      targetName: "Tech corner",
      detail: "",
    });
    expect((await readFormState(STAFF_NOTICE))?.notice).toBe("note-added");
  });

  it("keeps what was typed and says what's wrong", async () => {
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(() => addMentorNote(form({ shop: "tech-corner", text: " " })))).toBe(
      "/mentor/tech-corner#mentor-tech-corner-add-note",
    );
    expect((await readFormState(noteForm("tech-corner")))?.errors).toEqual(["mentor-note-missing"]);
    expect(sampleStore().mentorNotes.size).toBe(2);
  });

  it("adds a dated check-in, today or earlier, and an admin may too", async () => {
    await signedInAs(request, "acc-mentor");
    await redirectOf(() => addCheckIn(form({ shop: "tech-corner", day: "2026-10-15", text: "Met." })));
    expect((await readFormState(checkInForm("tech-corner")))?.errors).toEqual(["check-in-day-future"]);
    await signedInAs(request, "acc-admin");
    await redirectOf(() => addCheckIn(form({ shop: "tech-corner", day: "2026-10-14", text: "Called him." })));
    expect((await listNotes("acc-seller"))[0]).toMatchObject({ kind: "check-in", checkInOn: "2026-10-14", authorName: "Pieter" });
    expect((await listAudit({ staff: null, kind: "mentoring" }))[0]).toMatchObject({ action: "check-in-added", detail: "2026-10-14" });
  });
});
```

Create `app/mentor/export/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { GET } from "./route";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

describe("the mentor dashboard's CSV (staff tools spec 2.6, plan decision 17)", () => {
  it("downloads the dashboard's table for a mentor, never cached", async () => {
    await signedInAs(request, "acc-mentor");
    const response = await GET();
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="vossie-mentoring-2026-10-14.csv"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.text()).split("\r\n")).toEqual([
      "Shop,Campus,Mentor,Badge,Status,Enquiries (14 days),Due for a reply,Replied within 48 hours,Sales confirmed (14 days),Flags",
      "Tech corner,Midrand,Naledi,Responsive,Open,2,2,2,0,",
      "",
    ]);
  });

  it("sends a signed-out visitor to sign in for the dashboard, and gives a student the 404", async () => {
    expect(await redirectOf(() => GET())).toBe("/login?next=%2Fmentor");
    await signedInAs(request, "acc-student");
    await expect(GET()).rejects.toThrow("notFound");
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/staff/mentor-actions.test.ts app/mentor/export/route.test.ts`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 4: Write the actions and the route**

Create `lib/staff/mentor-actions.ts`:

```ts
"use server";

import { notFound } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { recordAudit } from "@/lib/data/audit";
import { addNote, getMentoredShop } from "@/lib/data/mentors";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field } from "@/lib/selling/action-helpers";
import { sastDate } from "@/lib/time";
import type { Account, MentoredShop } from "@/lib/types";
import { requireStaff } from "./access";
import { checkInForm, clearStaffForm, leaveNotice, noteForm } from "./form-state";
import { MENTOR_PATH, mentorShopPath } from "./paths";
import { checkCheckInDay, checkMentorNote } from "./rules";

// Mentors' notes and check-ins (staff tools spec 2.6, plan decision 16): about a shop's owner, by its mentor or an
// admin, never shown to the seller. The audit entry says a note was added, never what it says.

/** The signed-in staff member and the shop, when they may write about it; the 404 otherwise. */
async function mentoredFrom(formData: FormData, now: Date): Promise<{ account: Account; shop: MentoredShop }> {
  const slug = field(formData, "shop");
  const account = await requireStaff("mentor", isId(slug) ? mentorShopPath(slug) : MENTOR_PATH);
  const shop = isId(slug) ? await getMentoredShop(slug, account, now) : null;
  if (!shop) notFound();
  return { account, shop };
}

/** Add a note (spec 2.6). */
export async function addMentorNote(formData: FormData): Promise<void> {
  const now = new Date();
  const { account, shop } = await mentoredFrom(formData, now);
  const path = mentorShopPath(shop.slug);
  const text = checkMentorNote(field(formData, "text"));
  if (text.error) {
    const values = { text: keepTyped(text.value) };
    await writeFormState(noteForm(shop.slug), { errors: [text.error], values, notice: null }, now);
    done(`${path}#mentor-${shop.slug}-add-note`);
  }
  await addNote({
    ownerId: shop.ownerId,
    kind: "note",
    checkInOn: null,
    text: text.value,
    author: { id: account.id, firstName: account.firstName },
    now,
  });
  await recordAudit({
    staff: { id: account.id, firstName: account.firstName },
    action: "note-added",
    target: { kind: "shop", id: shop.slug, name: shop.name },
    subjectId: shop.ownerId,
    now,
  });
  await clearStaffForm(noteForm(shop.slug));
  await leaveNotice("note-added", now);
  done(`${path}#mentor-${shop.slug}-notes`);
}

/** Add a check-in (spec 2.6): its date, today or earlier in SAST, and what was said. */
export async function addCheckIn(formData: FormData): Promise<void> {
  const now = new Date();
  const { account, shop } = await mentoredFrom(formData, now);
  const path = mentorShopPath(shop.slug);
  const day = checkCheckInDay(field(formData, "day"), sastDate(now));
  const text = checkMentorNote(field(formData, "text"));
  const errors = [day.error, text.error].filter((error): error is NonNullable<typeof error> => error !== null);
  if (errors.length > 0) {
    const values = { day: keepTyped(field(formData, "day")), text: keepTyped(text.value) };
    await writeFormState(checkInForm(shop.slug), { errors, values, notice: null }, now);
    done(`${path}#mentor-${shop.slug}-add-check-in`);
  }
  await addNote({
    ownerId: shop.ownerId,
    kind: "check-in",
    checkInOn: day.value,
    text: text.value,
    author: { id: account.id, firstName: account.firstName },
    now,
  });
  await recordAudit({
    staff: { id: account.id, firstName: account.firstName },
    action: "check-in-added",
    target: { kind: "shop", id: shop.slug, name: shop.name },
    detail: day.value,
    subjectId: shop.ownerId,
    now,
  });
  await clearStaffForm(checkInForm(shop.slug));
  await leaveNotice("check-in-added", now);
  done(`${path}#mentor-${shop.slug}-notes`);
}
```

Create `app/mentor/export/route.ts`:

```ts
import { connection } from "next/server";
import { getCampuses } from "@/lib/data";
import { mentoredShops } from "@/lib/data/mentors";
import { requireStaff } from "@/lib/staff/access";
import { mentorCsv } from "@/lib/staff/mentor";
import { MENTOR_PATH } from "@/lib/staff/paths";
import { sastDate } from "@/lib/time";

/**
 * The mentor dashboard's table as a CSV file (staff tools spec 2.6, plan decision 17): the same role check as the
 * page (signed out, sign in and come back to the dashboard; anyone else, the 404), never cached, and a download.
 */
export async function GET(): Promise<Response> {
  const account = await requireStaff("mentor", MENTOR_PATH);
  // The 14 days and the file's date read the clock (decision 26).
  await connection();
  const now = new Date();
  const [rows, campuses] = await Promise.all([mentoredShops(account, now), getCampuses()]);
  const csv = mentorCsv(rows, new Map(campuses.map((campus) => [campus.slug, campus.name])));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vossie-mentoring-${sastDate(now)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
```

Run: `pnpm test lib/staff/mentor-actions.test.ts app/mentor/export/route.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the views' tests**

Create `components/staff/MentorDashboard.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MentoredShop } from "@/lib/types";
import { MentorDashboard } from "./MentorDashboard";

const tech: MentoredShop = {
  slug: "tech-corner",
  name: "Tech corner",
  campusSlug: "midrand",
  ownerName: "Sipho",
  ownerId: "acc-seller",
  badge: "responsive",
  status: "paused",
  mentorId: "acc-mentor",
  mentorName: "Naledi",
  counts: { enquiries: 4, due: 4, repliedInTime: 1, salesConfirmed: 2 },
  flags: ["slow-replies", "paused"],
};
const names = new Map([["midrand", "Midrand"]]);

describe("the mentor dashboard (staff tools spec 2.6, plan decision 15)", () => {
  it("lists each shop with its badge, the 14 days' numbers and its flags, linking to its page", () => {
    render(<MentorDashboard rows={[tech]} showMentor={false} campusNames={names} />);
    const table = screen.getByRole("table", { name: "Your sellers, A to Z" });
    const [, row] = within(table).getAllByRole("row");
    expect(within(row).getByRole("link", { name: "Tech corner" })).toHaveAttribute("href", "/mentor/tech-corner");
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "ShopTech corner",
      "CampusMidrand",
      "BadgeResponsive",
      "Enquiries (14 days)4",
      "Replied within 48 hours1 of 4",
      "Sales confirmed (14 days)2",
      "FlagsSlow replies (under 50% in 48 hours), Shop paused",
    ]);
    expect(within(table).queryByRole("columnheader", { name: "Mentor" })).toBeNull();
  });

  it("names each shop's mentor for an admin, and offers the CSV as a download", () => {
    render(<MentorDashboard rows={[tech]} showMentor={true} campusNames={names} />);
    expect(screen.getByRole("table", { name: "Every mentored shop, A to Z" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Mentor" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Naledi" })).toBeInTheDocument();
    const csv = screen.getByRole("link", { name: "Download CSV" });
    expect(csv).toHaveAttribute("href", "/mentor/export");
    expect(csv).toHaveAttribute("download");
  });

  it("says when no shop is assigned yet", () => {
    render(<MentorDashboard rows={[]} showMentor={false} campusNames={names} />);
    expect(screen.getByText("No shops are assigned to you yet. An admin assigns them on each shop's page.")).toBeInTheDocument();
  });
});
```

Create `components/staff/MentorShop.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMentoredShop, listNotes } from "@/lib/data/mentors";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { MentorShop } from "./MentorShop";

vi.mock("@/lib/staff/mentor-actions", () => ({ addMentorNote: async () => {}, addCheckIn: async () => {} }));

const NOW = new Date("2026-10-14T10:00:00.000Z");
const naledi = { id: "acc-mentor", roles: ["mentor"] as const };
const empty = { values: {}, errors: [] };

beforeEach(() => {
  resetSampleStore();
});

async function show(forms: { note?: typeof empty; checkIn?: typeof empty } = {}) {
  const shop = (await getMentoredShop("tech-corner", naledi, NOW))!;
  render(
    <MentorShop
      shop={shop}
      campusName="Midrand"
      notes={await listNotes(shop.ownerId)}
      noteForm={forms.note ?? empty}
      checkInForm={forms.checkIn ?? empty}
      today="2026-10-14"
    />,
  );
}

describe("a shop's mentor page (staff tools spec 2.6, plan decisions 15 and 16)", () => {
  it("shows the shop's numbers and says mentors see numbers, never messages", async () => {
    await show();
    const facts = screen.getByRole("region", { name: "This shop" });
    expect(within(facts).getByText("Sipho")).toBeInTheDocument();
    expect(within(facts).getByText("2 of 2")).toBeInTheDocument();
    expect(within(facts).getByText(/never their messages/)).toBeInTheDocument();
    expect(within(facts).getByText("No flags.")).toBeInTheDocument();
  });

  it("explains each flag", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    await show();
    expect(screen.getByText("Shop paused")).toBeInTheDocument();
    expect(screen.getByText("Buyers can't see the shop's listings until it's resumed.")).toBeInTheDocument();
  });

  it("lists the notes and check-ins, newest first, with who wrote them", async () => {
    await show();
    const notes = screen.getByRole("region", { name: "Notes and check-ins" });
    expect(notes).toHaveAttribute("id", "mentor-tech-corner-notes");
    const items = within(notes).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/^Note/);
    expect(items[0]).toHaveTextContent("Replies fast.");
    expect(items[1]).toHaveTextContent(/^Check-in on 6 October 2026/);
    expect(items[1]).toHaveTextContent("Naledi");
  });

  it("adds a note or a dated check-in, each saying who sees it, the buttons naming the shop", async () => {
    await show();
    expect(screen.getByLabelText("Note")).toHaveAccessibleDescription(
      "Only mentors and admins see it, never the seller. Up to 1,000 characters.",
    );
    expect(screen.getByRole("button", { name: "Add a note about Tech corner" })).toHaveAttribute("type", "submit");
    const day = screen.getByLabelText("Date of the check-in");
    expect(day).toHaveValue("2026-10-14");
    expect(day).toHaveAttribute("max", "2026-10-14");
    expect(screen.getByLabelText("What you talked about")).toBeRequired();
    expect(screen.getByRole("button", { name: "Add a check-in for Tech corner" })).toBeInTheDocument();
    for (const input of document.querySelectorAll('input[name="shop"]')) expect(input).toHaveValue("tech-corner");
  });

  it("keeps a failed note's words, with what's wrong", async () => {
    await show({ note: { values: { text: "" }, errors: [{ message: "Write the note first.", fieldId: "note-tech-corner-text" }] } });
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toHaveAttribute("aria-invalid", "true");
  });
});
```

- [ ] **Step 6: Run them to make sure they fail**

Run: `pnpm test components/staff/MentorDashboard.test.tsx components/staff/MentorShop.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 7: Write the views**

Create `components/staff/MentorDashboard.tsx`:

```tsx
import Link from "next/link";
import { badgeLabel } from "@/lib/format";
import { FLAG_WORDS, repliesInTime } from "@/lib/staff/mentor";
import { MENTOR_EXPORT_PATH, mentorShopPath } from "@/lib/staff/paths";
import type { MentoredShop } from "@/lib/types";
import { StaffTable } from "./StaffTable";

type MentorDashboardProps = {
  rows: readonly MentoredShop[];
  /** An admin sees every assigned shop, with its mentor (plan decision 15). */
  showMentor: boolean;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * The mentor dashboard (spec 2.6, plan decision 15): each assigned shop with its badge, the last 14 days' enquiries,
 * replies within 48 hours and confirmed sales, and its flags, linking to its page. Numbers, never messages
 * (FUNCTION-MAP K1). Download CSV is a plain link to a file (plan decision 17).
 */
export function MentorDashboard({ rows, showMentor, campusNames }: MentorDashboardProps) {
  const columns = [
    "Shop",
    "Campus",
    ...(showMentor ? ["Mentor"] : []),
    "Badge",
    "Enquiries (14 days)",
    "Replied within 48 hours",
    "Sales confirmed (14 days)",
    "Flags",
  ];
  return (
    <section aria-labelledby="mentor-shops-title" className="staff-section">
      <h2 id="mentor-shops-title" className="staff-section-title">
        {showMentor ? "Every mentored shop" : "Your sellers"}
      </h2>
      <p>
        The last 14 days, worked out from each shop&apos;s conversations. Mentors see numbers, never messages.{" "}
        <a href={MENTOR_EXPORT_PATH} download className="btn btn-outline text-navy staff-download">
          Download CSV
        </a>
      </p>
      <StaffTable
        caption={`${showMentor ? "Every mentored shop" : "Your sellers"}, A to Z`}
        columns={columns}
        rows={rows.map((row) => ({
          key: row.slug,
          cells: [
            <Link key="shop" href={mentorShopPath(row.slug)} prefetch={false}>
              {row.name}
            </Link>,
            campusNames.get(row.campusSlug) ?? row.campusSlug,
            ...(showMentor ? [row.mentorName] : []),
            row.badge ? badgeLabel(row.badge) : "None",
            String(row.counts.enquiries),
            repliesInTime(row.counts),
            String(row.counts.salesConfirmed),
            row.flags.length === 0 ? "None" : row.flags.map((flag) => FLAG_WORDS[flag].label).join(", "),
          ],
        }))}
        empty="No shops are assigned to you yet. An admin assigns them on each shop's page."
      />
    </section>
  );
}
```

Create `components/staff/MentorShop.tsx`:

```tsx
import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { MentorNoteView } from "@/lib/data/mentors";
import { badgeLabel } from "@/lib/format";
import { staffFieldIds } from "@/lib/staff/errors";
import { FLAG_WORDS, repliesInTime, statusWords } from "@/lib/staff/mentor";
import { addCheckIn, addMentorNote } from "@/lib/staff/mentor-actions";
import { longSastDate, shortSastDate } from "@/lib/time";
import type { MentoredShop } from "@/lib/types";

type FormView = { values: Readonly<Record<string, string>>; errors: readonly FormError[] };

type MentorShopProps = {
  shop: MentoredShop;
  campusName: string;
  notes: readonly MentorNoteView[];
  noteForm: FormView;
  checkInForm: FormView;
  /** Today's SAST date, the check-in's default and latest. */
  today: string;
};

/**
 * A shop's mentor page (spec 2.6; plan decisions 15 and 16): its numbers and what its flags mean, its notes and
 * check-ins, newest first, and forms to add both. Notes are about the shop's owner, shared with every mentor and
 * admin who can open this page, and never shown to the seller. The words are samples for Lama to change.
 */
export function MentorShop({ shop, campusName, notes, noteForm, checkInForm, today }: MentorShopProps) {
  const note = staffFieldIds(`note-${shop.slug}`);
  const checkIn = staffFieldIds(`check-in-${shop.slug}`);
  const noteError = errorFor(noteForm.errors, note.text);
  const dayError = errorFor(checkInForm.errors, checkIn.day);
  const checkInError = errorFor(checkInForm.errors, checkIn.text);
  return (
    <>
      <section aria-labelledby={`mentor-${shop.slug}-shop-title`} className="staff-section">
        <h2 id={`mentor-${shop.slug}-shop-title`} className="staff-section-title">
          This shop
        </h2>
        <dl className="staff-facts">
          <div>
            <dt>Owner</dt>
            <dd>{shop.ownerName}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{campusName}</dd>
          </div>
          <div>
            <dt>Mentor</dt>
            <dd>{shop.mentorName}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{statusWords(shop.status)}</dd>
          </div>
          <div>
            <dt>Badge</dt>
            <dd>{shop.badge ? badgeLabel(shop.badge) : "None"}</dd>
          </div>
          <div>
            <dt>Enquiries (14 days)</dt>
            <dd>{shop.counts.enquiries}</dd>
          </div>
          <div>
            <dt>Replied within 48 hours</dt>
            <dd>{repliesInTime(shop.counts)}</dd>
          </div>
          <div>
            <dt>Sales confirmed (14 days)</dt>
            <dd>{shop.counts.salesConfirmed}</dd>
          </div>
        </dl>
        {shop.flags.length === 0 ? (
          <p>No flags.</p>
        ) : (
          <dl className="staff-flags">
            {shop.flags.map((flag) => (
              <div key={flag}>
                <dt>{FLAG_WORDS[flag].label}</dt>
                <dd>{FLAG_WORDS[flag].explanation}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="staff-muted">
          Worked out from the shop&apos;s conversations: mentors see its numbers, never their messages.{" "}
          <Link href={`/sellers/${shop.slug}`} prefetch={false}>
            See {shop.name}&apos;s storefront
          </Link>
        </p>
      </section>

      <section id={`mentor-${shop.slug}-notes`} aria-labelledby={`mentor-${shop.slug}-notes-title`} className="staff-section">
        <h2 id={`mentor-${shop.slug}-notes-title`} className="staff-section-title">
          Notes and check-ins
        </h2>
        {notes.length === 0 ? (
          <p className="staff-empty">Nothing written yet.</p>
        ) : (
          <ul className="staff-notes">
            {notes.map((item) => (
              <li key={item.id} className="staff-note">
                <p className="staff-note-kind">
                  {item.kind === "check-in" && item.checkInOn
                    ? `Check-in on ${longSastDate(`${item.checkInOn}T10:00:00Z`)}`
                    : "Note"}
                </p>
                <p className="staff-prewrap">{item.text}</p>
                <p className="staff-muted">
                  {item.authorName}, <time dateTime={item.createdAt}>{shortSastDate(item.createdAt)}</time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id={`mentor-${shop.slug}-add-note`} aria-labelledby={`mentor-${shop.slug}-add-note-title`} className="staff-section">
        <h2 id={`mentor-${shop.slug}-add-note-title`} className="staff-section-title">
          Add a note
        </h2>
        <ErrorSummary id={`note-${shop.slug}-summary`} errors={noteForm.errors} />
        <form action={addMentorNote} noValidate className="form-stack staff-inline-form">
          <input type="hidden" name="shop" value={shop.slug} />
          <div className="form-field">
            <label htmlFor={note.text} className="form-label">
              Note
            </label>
            <p id={`${note.text}-hint`} className="form-hint">
              Only mentors and admins see it, never the seller. Up to 1,000 characters.
            </p>
            <FieldError id={`${note.text}-error`} message={noteError} />
            <textarea
              id={note.text}
              name="text"
              rows={4}
              required
              defaultValue={noteForm.values.text ?? ""}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={describedBy(`${note.text}-hint`, noteError && `${note.text}-error`)}
              className="form-input staff-textarea"
            />
          </div>
          <button type="submit" className="btn btn-primary form-submit">
            Add a note <span className="sr-only">about {shop.name}</span>
          </button>
        </form>
      </section>

      <section
        id={`mentor-${shop.slug}-add-check-in`}
        aria-labelledby={`mentor-${shop.slug}-add-check-in-title`}
        className="staff-section"
      >
        <h2 id={`mentor-${shop.slug}-add-check-in-title`} className="staff-section-title">
          Add a check-in
        </h2>
        <ErrorSummary id={`check-in-${shop.slug}-summary`} errors={checkInForm.errors} />
        <form action={addCheckIn} noValidate className="form-stack staff-inline-form">
          <input type="hidden" name="shop" value={shop.slug} />
          <div className="form-field">
            <label htmlFor={checkIn.day} className="form-label">
              Date of the check-in
            </label>
            <FieldError id={`${checkIn.day}-error`} message={dayError} />
            <input
              id={checkIn.day}
              name="day"
              type="date"
              required
              max={today}
              defaultValue={checkInForm.values.day ?? today}
              aria-invalid={dayError ? true : undefined}
              aria-describedby={describedBy(dayError && `${checkIn.day}-error`)}
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label htmlFor={checkIn.text} className="form-label">
              What you talked about
            </label>
            <p id={`${checkIn.text}-hint`} className="form-hint">
              Only mentors and admins see it, never the seller. Up to 1,000 characters.
            </p>
            <FieldError id={`${checkIn.text}-error`} message={checkInError} />
            <textarea
              id={checkIn.text}
              name="text"
              rows={4}
              required
              defaultValue={checkInForm.values.text ?? ""}
              aria-invalid={checkInError ? true : undefined}
              aria-describedby={describedBy(`${checkIn.text}-hint`, checkInError && `${checkIn.text}-error`)}
              className="form-input staff-textarea"
            />
          </div>
          <button type="submit" className="btn btn-outline text-navy form-submit">
            Add a check-in <span className="sr-only">for {shop.name}</span>
          </button>
        </form>
      </section>
    </>
  );
}
```

A check-in's date is a South African date; `longSastDate` reads it at 10:00 UTC (noon in SAST), so it stays the same day.

- [ ] **Step 8: Run them to make sure they pass**

Run: `pnpm test components/staff`
Expected: PASS (8 new tests).

- [ ] **Step 9: Write the pages**

Create `app/mentor/page.tsx`:

```tsx
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MentorDashboard } from "@/components/staff/MentorDashboard";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { mentoredShops } from "@/lib/data/mentors";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { MENTOR_PATH } from "@/lib/staff/paths";
import { isAdmin } from "@/lib/staff/roles";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("mentor", "Mentor dashboard");
}

/** The mentor dashboard (staff tools spec 2.6). Mentors and admins only. */
export default function MentorPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const account = await requireStaff("mentor", MENTOR_PATH);
  // The 14 days read the clock (decision 26).
  await connection();
  const [rows, campuses, notice] = await Promise.all([mentoredShops(account, new Date()), getCampuses(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Mentoring" title="Mentor dashboard" current={MENTOR_PATH} notice={staffNoticeText(notice)}>
      <MentorDashboard
        rows={rows}
        showMentor={isAdmin(account)}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      />
    </StaffFrame>
  );
}
```

Create `app/mentor/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MentorShop } from "@/components/staff/MentorShop";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { getMentoredShop, listNotes } from "@/lib/data/mentors";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { checkInForm, noteForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { MENTOR_PATH, mentorShopPath } from "@/lib/staff/paths";
import { sastDate } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("mentor", "A mentored shop");
}

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no shop. */
export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** A shop's mentor page (staff tools spec 2.6): its mentor or an admin; anyone else, or a shop with none, the 404. */
export default function MentorShopPage({ params }: PageProps<"/mentor/[slug]">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Shop params={params} />
    </Suspense>
  );
}

async function Shop({ params }: Pick<PageProps<"/mentor/[slug]">, "params">) {
  const { slug } = await params;
  const account = await requireStaff("mentor", mentorShopPath(slug));
  await connection();
  const now = new Date();
  const shop = isId(slug) ? await getMentoredShop(slug, account, now) : null;
  if (!shop) notFound();
  const [campuses, notes, note, checkIn, notice] = await Promise.all([
    getCampuses(),
    listNotes(shop.ownerId),
    readFormState(noteForm(shop.slug)),
    readFormState(checkInForm(shop.slug)),
    takeNotice(),
  ]);
  return (
    <StaffFrame account={account} area="Mentoring" title={shop.name} current={MENTOR_PATH} notice={staffNoticeText(notice)}>
      <MentorShop
        shop={shop}
        campusName={campuses.find((campus) => campus.slug === shop.campusSlug)?.name ?? ""}
        notes={notes}
        noteForm={{ values: note?.values ?? {}, errors: staffErrors(note?.errors ?? [], staffFieldIds(`note-${shop.slug}`)) }}
        checkInForm={{
          values: checkIn?.values ?? {},
          errors: staffErrors(checkIn?.errors ?? [], staffFieldIds(`check-in-${shop.slug}`)),
        }}
        today={sastDate(now)}
      />
    </StaffFrame>
  );
}
```

- [ ] **Step 10: The styles**

Check none of the new classes is taken: `grep -n "\.staff-flags\|\.staff-notes\|\.staff-note\b\|\.staff-note-kind\|\.staff-download" app/globals.css` prints nothing. Then append to the end of `app/globals.css`:

```css

/* --- Staff tools: the mentor dashboard (staff tools plan, Task 16, spec 2.6) --- */
@layer components {
  .staff-download {
    margin-top: 8px;
  }

  /* A flag's name in bold danger red (6.6:1 on white), and what it means under it. */
  .staff-flags {
    display: grid;
    gap: 10px;
  }

  .staff-flags dt {
    color: var(--color-danger);
    font-weight: 700;
  }

  .staff-notes {
    display: grid;
    gap: 12px;
  }

  .staff-note {
    display: grid;
    gap: 6px;
    padding: 14px 16px;
    border-left: 4px solid var(--color-navy);
    border-radius: 0 var(--radius-card) var(--radius-card) 0;
    background: var(--color-panel);
  }

  .staff-note-kind {
    color: var(--color-navy);
    font-weight: 700;
  }
}
```

- [ ] **Step 11: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 14 more unit tests than after Task 15.

- [ ] **Step 12: Build, and look at it**

Run: `pnpm build`
Expected: the build passes, `/mentor/export` listed as a dynamic route handler.

On a production build (`pnpm start --port 3201`), signed in as "Mentor", at 390 × 844 and 1280 × 800: `/mentor` lists Tech corner with "2 of 2" and no flags; Download CSV saves `vossie-mentoring-<today>.csv`, which a spreadsheet opens with one row; Tech corner's page shows Naledi's two entries, and a new note shows at the top. As "Admin", `/mentor` adds the Mentor column. As "Student, Midrand", `/mentor` and `/mentor/export` show the 404. Stop the server afterwards.

- [ ] **Step 13: Hand over for commit**

Files: `lib/staff/mentor-actions.ts`, `lib/staff/mentor-actions.test.ts`, `components/staff/MentorDashboard.tsx`, `components/staff/MentorDashboard.test.tsx`, `components/staff/MentorShop.tsx`, `components/staff/MentorShop.test.tsx`, `app/mentor/page.tsx`, `app/mentor/[slug]/page.tsx`, `app/mentor/export/route.ts`, `app/mentor/export/route.test.ts`, `app/globals.css`.
Message: `feat: the mentor dashboard (assigned shops, 14 days' numbers and flags), a shop's notes and check-ins, and the CSV download behind the same role check (staff tools spec 2.6)`

---

### Task 17: Buyers' side: Featured with pins, badges after a reply or a sale, and a retired pickup point

What buyers see change (spec 2.7, 2.8 and 2.3; plan decisions 8 to 10): the homepage's Featured today honours pins and the week's break (its data changed in Task 6; this task tests it from the homepage and measures every page, since the header prefetches `/`); E's reply and sale buttons work out their shop's badge and expire `sellers` when it changed; and a listing on a retired pickup point says "(no longer used)".

**Files:**
- Modify: `components/home/FeaturedToday.test.tsx`
- Modify: `lib/messaging/actions.ts`, `lib/messaging/actions.test.ts`
- Modify: `components/listing/ListingView.tsx`, `components/listing/ListingView.test.tsx`

- [ ] **Step 1: Write the tests**

In `components/home/FeaturedToday.test.tsx`:
1. Change `import { afterEach, describe, expect, it, vi } from "vitest";` to `import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";`, and add, below the vitest import:

```tsx
import { addPin } from "@/lib/data/featured";
import { resetSampleStore } from "@/lib/data/store";
import { sastToday } from "@/lib/time";
```

2. Straight before the `afterEach(…)` call, add:

```tsx
// Each day's row is recorded in the store (staff tools plan decision 9), so every test starts from a fresh one.
beforeEach(() => {
  resetSampleStore();
});
```

3. Add this test after "doesn't name the campus when some featured sellers come from elsewhere":

```tsx

  it("puts a seller the Hub pinned for today first (staff tools spec 2.8)", async () => {
    viewer.campus = "midrand";
    await addPin({ sellerSlug: "nail-bar", campusSlug: "midrand", day: sastToday(), staffId: "acc-admin", now: new Date() });
    render(await FeaturedTodayContent());
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(4);
    expect(within(cards[0]).getByRole("link")).toHaveAttribute("href", "/sellers/nail-bar");
    // A seller from another campus is in the row, so it doesn't claim to be Midrand's.
    expect(screen.getByRole("heading", { level: 2, name: "Hustles on every campus" })).toBeInTheDocument();
  });
```

In `lib/messaging/actions.test.ts` (E Task 6), add `import { resetSampleStore, sampleStore } from "@/lib/data/store";` if `sampleStore` isn't imported yet, and append at the end of the file (it uses the file's own `form` and `signedInAs` helpers and its `next/cache` stand-in):

```ts

describe("badges after a reply or a confirmed sale (staff tools spec 2.7, plan decision 8)", () => {
  it("works the shop's badge out after the seller replies, and expires sellers only when it changed", async () => {
    await signedInAs("acc-seller");
    // Tech corner's sample badge is Responsive; two enquiries earn New seller.
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "It's still here." })));
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("new-seller");
    expect(request.updatedTags).toEqual(["sellers"]);
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "Any time after 12:00." })));
    expect(request.updatedTags).toEqual(["sellers"]);
  });

  it("works it out after the buyer confirms a sale", async () => {
    sampleStore().sellers.get("tech-corner")!.badge = "trusted";
    await signedInAs("acc-student");
    await redirectOf(() => confirmTheSale(form({ conversation: "conv-s2" })));
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("new-seller");
    expect(request.updatedTags).toEqual(["sellers"]);
  });
});
```

(`resetSampleStore` is already used in the file's `beforeEach`; keep one import of each name.)

In `components/listing/ListingView.test.tsx`, add this test at the end of its `describe`, using the file's own setup (its `names`, and its stand-ins for E's session links):

```tsx

  it("marks a pickup point the Hub retired as no longer used (staff tools plan decision 10)", async () => {
    const detail = (await getListingDetail("l-001"))!;
    render(<ListingView detail={{ ...detail, pickupPoint: { ...detail.pickupPoint!, retired: true } }} campusNames={names} />);
    expect(screen.getByText("Collect at Midrand · Library entrance (no longer used)")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/home/FeaturedToday.test.tsx lib/messaging/actions.test.ts components/listing/ListingView.test.tsx`
Expected: the Featured test already passes (Task 6 built the pins; this test guards the homepage's use of them); the badge tests FAIL (nothing works the badge out after a reply), and the listing test FAILS (no "(no longer used)").

- [ ] **Step 3: Work the badge out after a reply or a sale**

In `lib/messaging/actions.ts` (E Task 6):
1. Add, among the `@/lib/data/…` imports in alphabetical order:

```ts
import { recalculateBadgeFor } from "@/lib/data/badges";
import { sellersChanged } from "@/lib/data/tags";
```

2. In `sendReply`, straight after the line `if (result === "not-found") back("/messages");`, add:

```ts
  // A seller's reply can change their shop's badge (staff tools spec 2.7, plan decision 8). Nothing else can expire
  // the cached sellers when it does, so this action does.
  if (result === "sent" && (await recalculateBadgeFor(id, now))) sellersChanged();
```

3. Replace `changeSale` (its comment stays) with:

```ts
async function changeSale(formData: FormData, change: SaleChange): Promise<void> {
  const id = idFrom(formData, "conversation");
  if (!id) redirect("/messages");
  const account = await requireAccount(threadPath(id));
  const now = new Date();
  await change({ conversationId: id, accountId: account.id, now });
  // A confirmed sale, or one that didn't happen, can change the shop's badge (staff tools spec 2.7, plan decision 8).
  if (await recalculateBadgeFor(id, now)) sellersChanged();
  done(threadPath(id));
}
```

The badge is worked out after every reply, not only the first: it costs nothing and changes nothing more (plan decision 8).

- [ ] **Step 4: Mark a retired point on the listing page**

In `components/listing/ListingView.tsx`, straight after the line `const { listing, seller, category, campus, pickupPoint } = detail;`, add:

```tsx
  // A listing keeps a pickup point the Hub has retired, marked so (staff tools plan decision 10).
  const pointName = pickupPoint ? `${pickupPoint.name}${pickupPoint.retired ? " (no longer used)" : ""}` : null;
```

and replace `pickupPointName={pickupPoint?.name ?? null}` with `pickupPointName={pointName}`.

- [ ] **Step 5: Run them to make sure they pass**

Run: `pnpm test components/home lib/messaging components/listing`
Expected: PASS.

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 4 more unit tests than after Task 16.

- [ ] **Step 7: Measure every page**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS, every `scriptBrotli` within a few bytes of the Task 15 row: no client code changed (Featured's draw, the actions and the listing's sentence are server code). Put the figures in the ledger's "Task 17" row. If any page passes the stop line, stop and report.

Then run the homepage's and the listing page's own end-to-end tests: `pnpm e2e tests/e2e/home.spec.ts tests/e2e/listing.spec.ts tests/e2e/messaging.spec.ts`
Expected: PASS: "Hustles at Midrand" after choosing Midrand (a fresh store's first day is the four Midrand sellers), and messaging's replies and sales as before.

- [ ] **Step 8: Hand over for commit**

Files: `components/home/FeaturedToday.test.tsx`, `lib/messaging/actions.ts`, `lib/messaging/actions.test.ts`, `components/listing/ListingView.tsx`, `components/listing/ListingView.test.tsx`.
Message: `feat: replies and sale buttons work out their shop's badge and expire sellers when it changes, the homepage's Featured is tested with a pin, and a listing on a retired pickup point says so (staff tools spec 2.3, 2.7 and 2.8). JS: / <n> B, listing <n> B`

---

### Task 18: The seller's and the account's side: a declined or Hub-paused shop, hidden listings, staff rows and two notification kinds

What the Hub's decisions look like to the people they're about (spec 2.3; plan decisions 2 to 4, 7 and 19): `/sell` shows a declined shop the Hub's reason with **Send for approval again**, and a shop the Hub paused its reason with no Resume; My listings marks a hidden listing; the account page links staff to their tools; and `/notifications` draws the two new kinds' icons. `/sell` is prefetched from every page's header, so this task measures every page.

**Files:**
- Create: `components/sell/ShopDeclined.tsx`, `components/sell/ShopDeclined.test.tsx`
- Modify: `components/sell/SellHome.tsx`, `components/sell/SellHome.test.tsx`
- Modify: `components/sell/Dashboard.tsx`, `components/sell/Dashboard.test.tsx`
- Modify: `components/sell/MyListingsView.tsx`, `components/sell/MyListingsView.test.tsx`
- Modify: `lib/selling/shop-actions.ts`, `lib/selling/shop-actions.test.ts`
- Modify: `components/account/AccountView.tsx`, `components/account/AccountView.test.tsx`
- Modify: `components/messages/NotificationsView.tsx`, `components/messages/NotificationsView.test.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Write the tests**

Create `components/sell/ShopDeclined.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShopDeclined } from "./ShopDeclined";

vi.mock("@/lib/selling/shop-actions", () => ({ sendForApprovalAgain: async () => {} }));

describe("a declined shop on /sell (staff tools plan decision 2)", () => {
  it("gives the Hub's reason, with Edit shop and Send for approval again", () => {
    render(<ShopDeclined shopName="Crochet corner" declinedAt="2026-10-14T08:42:00.000Z" reason="Add a photo of your work." />);
    expect(screen.getByRole("heading", { level: 1, name: "The Hub didn't approve your shop yet" })).toBeInTheDocument();
    expect(screen.getByText(/On 14 October 2026 the Hub looked at Crochet corner/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "What the Hub said" })).toHaveTextContent("Add a photo of your work.");
    expect(screen.getByRole("link", { name: "Edit shop" })).toHaveAttribute("href", "/sell/profile");
    expect(screen.getByRole("button", { name: "Send for approval again" })).toHaveAttribute("type", "submit");
  });
});
```

In `components/sell/SellHome.test.tsx` (F Task 9):
1. Change its `vi.mock("@/lib/selling/shop-actions", …)` line to:

```tsx
vi.mock("@/lib/selling/shop-actions", () => ({
  pauseShop: async () => {},
  resumeShop: async () => {},
  sendForApprovalAgain: async () => {},
}));
```

2. Add `import { declineShop } from "@/lib/data/staff-shops";` among its imports, and these tests at the end of its `describe`:

```tsx

  it("tells a declined seller the Hub's reason and how to send the shop again (staff tools plan decision 2)", async () => {
    await declineShop("crochet-corner", "Add a photo of your work.", new Date("2026-10-14T08:00:00.000Z"));
    viewer.id = "acc-pending";
    render(await SellHome());
    expect(screen.getByRole("heading", { level: 1, name: "The Hub didn't approve your shop yet" })).toBeInTheDocument();
    expect(screen.getByText("Add a photo of your work.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send for approval again" })).toBeInTheDocument();
  });

  it("shows a shop the Hub paused with its reason, and no Resume (staff tools plan decision 3)", async () => {
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, {
      status: "paused",
      pausedBy: "staff",
      staffReason: "Selling exam answers.",
    });
    viewer.id = "acc-seller";
    render(await SellHome());
    expect(screen.getByText("Paused by the Hub: your listings are off every list")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Why the Hub paused it" })).toHaveTextContent("Selling exam answers.");
    expect(screen.queryByRole("button", { name: "Resume my shop" })).toBeNull();
  });
```

In `components/sell/Dashboard.test.tsx` (F Task 9), add this test at the end of its `describe` (it uses the file's own `shop` and `stats`):

```tsx

  it("leaves the Pause form out when the Hub paused the shop (staff tools plan decision 3)", () => {
    render(<Dashboard shop={shop} paused stats={stats} badgeLine="" notice={null} hubPause="Selling exam answers." />);
    expect(screen.getByText("Paused by the Hub: your listings are off every list")).toBeInTheDocument();
    expect(screen.getByText(/Only the Hub can resume it/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
```

In `components/sell/MyListingsView.test.tsx` (F Task 11), add `import { makeListingRow } from "@/tests/helpers/fakes";` if it isn't imported, and add this test at the end of its first `describe`:

```tsx

  it("marks a listing the Hub hid, with the Hub's reason (staff tools plan decision 4)", () => {
    const hidden = makeListingRow({ hiddenAt: "2026-10-14T08:00:00.000Z", hiddenReason: "Exam papers aren't allowed." });
    render(<MyListingsView tab="available" rows={[hidden]} waiting={false} notice={null} noticeListing={null} />);
    expect(screen.getByText("Hidden by the Hub: Exam papers aren't allowed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Test listing" })).toBeInTheDocument();
  });
```

In `lib/selling/shop-actions.test.ts` (F Task 7), add `sendForApprovalAgain` to the `./shop-actions` import and `import { declineShop } from "@/lib/data/staff-shops";` among the imports, and append at the end of the file:

```ts

describe("Send for approval again (staff tools plan decision 2)", () => {
  it("puts a declined shop back in the Hub's queue, forgetting the decline", async () => {
    await declineShop("crochet-corner", "Add a photo of your work.", NOW);
    await signedInAs("acc-pending");
    expect(await redirectOf(() => sendForApprovalAgain())).toBe("/sell");
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      status: "pending",
      declinedAt: null,
      staffReason: null,
      appliedAt: NOW.toISOString(),
    });
  });

  it("changes nothing for a shop that wasn't declined", async () => {
    await signedInAs("acc-seller");
    expect(await redirectOf(() => sendForApprovalAgain())).toBe("/sell");
    expect(sampleStore().sellerProfiles.get("acc-seller")?.status).toBe("approved");
  });
});
```

In `components/account/AccountView.test.tsx`, add these tests at the end of its `describe` (they use the file's `renderAccount` and `account`):

```tsx

  it("links staff to the tools their roles open (staff tools plan decision 19)", () => {
    renderAccount({ ...account, roles: ["admin"] });
    const rows = screen.getByRole("navigation", { name: "Your account's pages" });
    expect(within(rows).getByRole("link", { name: "Admin console" })).toHaveAttribute("href", "/admin");
    expect(within(rows).getByRole("link", { name: "Hub posts and office hours" })).toHaveAttribute("href", "/hub/manage");
    expect(within(rows).getByRole("link", { name: "Mentor dashboard" })).toHaveAttribute("href", "/mentor");
  });

  it("gives a mentor the Hub's tools and the dashboard, and a student no staff rows", () => {
    const { unmount } = renderAccount({ ...account, roles: ["mentor"] });
    expect(screen.queryByRole("link", { name: "Admin console" })).toBeNull();
    expect(screen.getByRole("link", { name: "Mentor dashboard" })).toBeInTheDocument();
    unmount();
    renderAccount();
    expect(screen.queryByRole("link", { name: "Hub posts and office hours" })).toBeNull();
  });
```

In `components/messages/NotificationsView.test.tsx` (E Task 12), in "gives every kind an icon, hidden from screen readers (plan decision 13)", replace `(["message", "sale-to-confirm", "report-handled", "shop-approved"] as const)` with `(["message", "sale-to-confirm", "report-handled", "shop-approved", "shop-update", "booking"] as const)` and `toHaveLength(4)` with `toHaveLength(6)`.

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/sell lib/selling/shop-actions.test.ts components/account components/messages/NotificationsView.test.tsx`
Expected: FAIL: no `ShopDeclined`, no `sendForApprovalAgain`, no Hub pause on the dashboard, no hidden mark, no staff rows, and four icons, not six.

- [ ] **Step 3: Send for approval again**

In `lib/selling/shop-actions.ts` (F Task 7), add `import { resendForApproval } from "@/lib/data/staff-shops";` among the `@/lib/data/…` imports, and append:

```ts

/**
 * Send for approval again (staff tools plan decision 2): a shop the Hub declined, changed in Edit shop, waits for the
 * Hub again. Anything else changes nothing.
 */
export async function sendForApprovalAgain(): Promise<void> {
  const owner = await requireShopOwner(SELL_PATH);
  await resendForApproval(owner.account.id, new Date());
  done(SELL_PATH);
}
```

- [ ] **Step 4: The declined page, the Hub's pause and the hidden mark**

Create `components/sell/ShopDeclined.tsx`:

```tsx
import Link from "next/link";
import { PROFILE_PATH } from "@/lib/selling/paths";
import { sendForApprovalAgain } from "@/lib/selling/shop-actions";
import { longSastDate } from "@/lib/time";

type ShopDeclinedProps = {
  shopName: string;
  /** When the Hub declined it, ISO 8601 in UTC. */
  declinedAt: string;
  /** The Hub's reason, which the seller sees (staff tools plan decisions 2 and 18). */
  reason: string;
};

/**
 * A shop the Hub didn't approve yet (staff tools spec 2.3, plan decision 2): the Hub's reason, and what to do: change
 * the shop in Edit shop, then send it again. Its drafts are kept. The words are samples for Lama to change.
 */
export function ShopDeclined({ shopName, declinedAt, reason }: ShopDeclinedProps) {
  return (
    <div className="sell-column">
      <header className="sell-head">
        <p className="eyebrow">Your shop</p>
        <h1 className="sell-title">The Hub didn&apos;t approve your shop yet</h1>
        <p className="sell-lede">
          On {longSastDate(declinedAt)} the Hub looked at {shopName} and asked for a change before it opens.
        </p>
      </header>

      <section aria-labelledby="sell-declined-title" className="sell-section">
        <h2 id="sell-declined-title" className="sell-section-title">
          What the Hub said
        </h2>
        <blockquote className="staff-reason">{reason}</blockquote>
      </section>

      <section aria-labelledby="sell-again-title" className="sell-section">
        <h2 id="sell-again-title" className="sell-section-title">
          What to do next
        </h2>
        <p>Change what the Hub asked for in Edit shop, then send your shop again. Your drafts are kept.</p>
        <div className="sell-actions">
          <Link href={PROFILE_PATH} prefetch={false} className="btn btn-outline text-navy">
            Edit shop
          </Link>
          <form action={sendForApprovalAgain}>
            <button type="submit" className="btn btn-primary">
              Send for approval again
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
```

In `components/sell/SellHome.tsx` (F Task 9):
1. Add `import { shopStanding } from "@/lib/data/staff-shops";` among the `@/lib/data/…` imports, and `import { ShopDeclined } from "./ShopDeclined";` after `import { SellPitch } from "./SellPitch";`.
2. Replace

```tsx
  if (own.status === "pending") return <ShopWaiting shopName={own.shop.name} sentAt={own.shop.createdAt} />;
```

with

```tsx
  const standing = await shopStanding(account.id);
  if (own.status === "pending") {
    // A declined shop is a waiting one with the Hub's reason (staff tools plan decision 2).
    if (standing?.declinedAt) {
      return <ShopDeclined shopName={own.shop.name} declinedAt={standing.declinedAt} reason={standing.reason ?? ""} />;
    }
    return <ShopWaiting shopName={own.shop.name} sentAt={own.shop.createdAt} />;
  }
```

3. In the returned `<Dashboard … />`, add the prop `hubPause={standing?.pausedByHub ? (standing.reason ?? "") : null}`.
4. In `SellHome`'s comment, after "the waiting page while the Hub checks one (spec 2.7)", add ", or the Hub's reason once it has declined it (staff tools plan decision 2)".

In `components/sell/Dashboard.tsx` (F Task 9):
1. In `DashboardProps`, after `notice: string | null;`, add:

```tsx
  /** The Hub's reason when the Hub paused the shop (staff tools plan decision 3); the seller can't resume it. */
  hubPause?: string | null;
```

2. Change the function's parameters to `{ shop, paused, stats, badgeLine, notice, hubPause = null }`, and add `const byHub = hubPause !== null;` as its first line.
3. Replace the `sell-status` paragraph's text `{paused ? "Paused: your listings are off every list" : "Your shop is live"}` with:

```tsx
          {byHub
            ? "Paused by the Hub: your listings are off every list"
            : paused
              ? "Paused: your listings are off every list"
              : "Your shop is live"}
```

4. Straight after the `{notice && (…)}` block, add:

```tsx

      {byHub && (
        <section aria-labelledby="sell-hub-pause-title" className="sell-section">
          <h2 id="sell-hub-pause-title" className="sell-section-title">
            Why the Hub paused it
          </h2>
          <blockquote className="staff-reason">{hubPause}</blockquote>
          <p>Only the Hub can resume it. Talk to the Hub on your campus once you&apos;ve sorted it out.</p>
        </section>
      )}
```

5. Wrap the `<form action={paused ? resumeShop : pauseShop} className="sell-pause">…</form>` in `{!byHub && (…)}`, so a shop the Hub paused has no Pause or Resume form.

In `components/sell/MyListingsView.tsx` (F Task 11), in `ListingSummary`, straight after the `<p className="sell-item-meta">…</p>` paragraph, add:

```tsx
        {row.hiddenAt && (
          <p className="staff-hidden-note">Hidden by the Hub: {row.hiddenReason ?? "no reason given"}</p>
        )}
```

and add to `ListingSummary`'s comment: "A listing the Hub hid says so, with the reason (staff tools plan decision 4)."

- [ ] **Step 5: The account page's staff rows and the two icons**

In `components/account/AccountView.tsx`:
1. Add, among the `@/lib/…` imports in alphabetical order:

```tsx
import { AREA_HOME } from "@/lib/staff/paths";
import { staffAreasOf } from "@/lib/staff/roles";
```

2. In the `account-rows` list, straight after the `<li>` holding `<SellingRow … />`, add:

```tsx
          {/* Staff tools, by role, with no prefetch: every staff page reads the session (staff tools plan decision 19). */}
          {staffAreasOf(account).map((area) => (
            <li key={area}>
              <Link href={AREA_HOME[area].href} prefetch={false} className="account-row">
                {AREA_HOME[area].label}
                <ChevronRightIcon />
              </Link>
            </li>
          ))}
```

In `components/messages/NotificationsView.tsx` (E Task 12):
1. Add `ClockIcon` to the `@/components/icons` import, in alphabetical order.
2. In `KindIcon`'s `switch`, after the `case "shop-approved":` branch, add:

```tsx
    case "shop-update":
      return <ShieldIcon className="notes-icon" />;
    case "booking":
      return <ClockIcon className="notes-icon" />;
```

3. Change `KindIcon`'s comment to `/** Each kind's icon (plan decision 13; staff tools plan decision 7 adds "shop-update" and "booking"). */`.

- [ ] **Step 6: Run them to make sure they pass**

Run: `pnpm test components/sell lib/selling/shop-actions.test.ts components/account components/messages/NotificationsView.test.tsx`
Expected: PASS.

- [ ] **Step 7: The styles**

Check none of the new classes is taken: `grep -n "\.staff-reason\|\.staff-hidden-note" app/globals.css` prints nothing. Then append to the end of `app/globals.css`:

```css

/* --- Staff tools: the Hub's reasons, as sellers see them (staff tools plan, Task 18, plan decisions 2 to 4) --- */
@layer components {
  /* The Hub's own words, quoted: ink on pale is 9.0:1, with a navy rule. */
  .staff-reason {
    padding: 14px 18px;
    border-left: 4px solid var(--color-navy);
    border-radius: 0 var(--radius-card) var(--radius-card) 0;
    background: var(--color-pale);
    color: var(--color-ink);
    white-space: pre-wrap;
  }

  /* Danger red on white is 6.6:1. */
  .staff-hidden-note {
    color: var(--color-danger);
    font-size: 14px;
    font-weight: 600;
  }
}
```

- [ ] **Step 8: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 9 more unit tests than after Task 17 (1 declined page, 2 /sell, 1 dashboard, 1 My listings, 2 actions, 2 account page; the icons test changed).

- [ ] **Step 9: Measure every page**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: PASS, every `scriptBrotli` within a few bytes of the Task 17 row: `/sell` gained a Server Component and a form, the account page a few links, and nothing on the client changed. Put the figures in the ledger's "Task 18" row. If any page passes the stop line, stop and report.

Then run the selling and account pages' own end-to-end tests: `pnpm e2e tests/e2e/selling.spec.ts tests/e2e/accounts.spec.ts tests/e2e/messaging.spec.ts`
Expected: PASS.

- [ ] **Step 10: Look at it**

On a production build (`pnpm build`, then `pnpm start --port 3201`), at 390 × 844 and 1280 × 800: as "Admin", decline "Crochet corner" with a reason; as "Seller waiting for approval", `/sell` shows the reason, Edit shop and Send for approval again, which brings back "The Hub is checking your shop"; as "Admin", pause Tech corner from its review page; as "Seller, Tech corner", `/sell` says "Paused by the Hub" with the reason and no Resume, and `/notifications` lists both decisions with the shield icon; resume it as "Admin" afterwards. As "Admin" and as "Mentor", `/account` lists their tools. Stop the server afterwards.

- [ ] **Step 11: Hand over for commit**

Files: `components/sell/ShopDeclined.tsx`, `components/sell/ShopDeclined.test.tsx`, `components/sell/SellHome.tsx`, `components/sell/SellHome.test.tsx`, `components/sell/Dashboard.tsx`, `components/sell/Dashboard.test.tsx`, `components/sell/MyListingsView.tsx`, `components/sell/MyListingsView.test.tsx`, `lib/selling/shop-actions.ts`, `lib/selling/shop-actions.test.ts`, `components/account/AccountView.tsx`, `components/account/AccountView.test.tsx`, `components/messages/NotificationsView.tsx`, `components/messages/NotificationsView.test.tsx`, `app/globals.css`.
Message: `feat: a declined shop sees the Hub's reason and can send it again, a Hub pause shows its reason with no Resume, hidden listings are marked, staff get their tools on the account page, and notifications draw the two new kinds (staff tools spec 2.3, plan decisions 2 to 4, 7 and 19). JS: / <n> B, listing <n> B, /sell <n> B`

---

### Task 19: Words the staff tools make untrue: the trust page and the privacy policy

The trust page said Verified is approval (selling spec 8.10 asks this stage to fix it), that today's badges are samples, and that Featured's daily draw waits for accounts; the privacy policy describes mentors' notes and the staff log as plans. Both now say what's built (spec 2.6 to 2.8; plan decisions 6, 8, 9, 13 and 16). No new cookie or storage key, so the privacy page's `vossie_…` guard has nothing new to find.

**Files:**
- Modify: `app/trust/page.tsx`, `app/trust/page.test.tsx`
- Modify: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`

- [ ] **Step 1: Change the tests**

In `app/trust/page.test.tsx`:
1. Replace the test "explains Verified as the Hub's own check, and says it isn't a promise" with:

```tsx
  it("explains Verified as a badge the Hub gives after checking, separate from approval, and not a promise (selling spec 8.10)", () => {
    render(<TrustPage />);
    const verified = screen.getByRole("region", { name: "Verified by the Hub" });
    expect(
      within(verified).getByText(/is a badge the Eduvos Incubation Hub gives a seller after checking who they are/),
    ).toBeInTheDocument();
    expect(within(verified).getByText(/separate from approval: the Hub approves every shop before it can sell/)).toBeInTheDocument();
    expect(verified).not.toHaveTextContent("approved their shop");
    expect(within(verified).getByText(/isn't a promise that a deal will go well/)).toBeInTheDocument();
    expect(within(verified).getByRole("link", { name: "safety steps" })).toHaveAttribute("href", "/safety");
  });
```

2. Replace the test "says the badges on sellers today are samples, and that a badge can go down" with:

```tsx
  it("says badges are worked out from conversations, sample shops keep sample badges, and a badge can go down (staff tools spec 2.7)", () => {
    render(<TrustPage />);
    const badges = screen.getByRole("region", { name: "The three badges" });
    expect(within(badges).getByText(/gets its badge worked out by the rules below, from its conversations on Vossie/)).toBeInTheDocument();
    expect(within(badges).getByText(/most shops are samples with no account behind them, and they show sample badges/)).toBeInTheDocument();
    expect(badges).not.toHaveTextContent("once accounts are live");
    expect(within(badges).getByText(/a badge can go down again/)).toBeInTheDocument();
  });
```

3. In "explains how Featured today is picked", add at the end:

```tsx
    expect(within(featured).getByText(/Each campus gets its own draw every day/)).toBeInTheDocument();
    expect(featured).not.toHaveTextContent("Once accounts are live");
```

In `app/privacy/page.test.tsx`, add this test after "says nobody is sold anything, and who sees what":

```tsx

  it("says what the staff tools keep, who sees it and what deleting does (staff tools plan decisions 6, 13 and 16)", () => {
    render(<PrivacyPage />);
    const account = screen.getByRole("region", { name: "Your account" });
    expect(within(account).getByText("Your RSVPs and slot requests.")).toBeInTheDocument();
    expect(account).toHaveTextContent(/they aren't in your data download, but you can ask the Information Officer for them/);
    expect(account).toHaveTextContent(/Nobody can edit it\. If you delete your account, entries about you lose your name/);
    expect(screen.getByRole("region", { name: "How long we keep it" })).toHaveTextContent(/RSVPs and slot requests/);
    expect(screen.getByRole("region", { name: "Who it is shared with" })).toHaveTextContent(/never your messages/);
  });
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test app/trust/page.test.tsx app/privacy/page.test.tsx`
Expected: FAIL: the pages still have the old words.

- [ ] **Step 3: Change the trust page**

In `app/trust/page.tsx`:
1. In `trust-verified`, replace the first paragraph's text

```tsx
          <strong>Verified</strong> means the Eduvos Incubation Hub has looked at a seller and approved their shop. The
          Hub does this by hand, before a new seller can list anything. A Verified seller has a tick and the word
          Verified on their listings and their shop.
```

with

```tsx
          <strong>Verified</strong> is a badge the Eduvos Incubation Hub gives a seller after checking who they are and
          how they trade. It&apos;s separate from approval: the Hub approves every shop before it can sell, and only
          some approved shops are Verified. A Verified seller has a tick and the word Verified on their listings and
          their shop.
```

2. In `trust-badges`, replace the second paragraph's text

```tsx
          Vossie is still being built, so the badges you see on sellers today are samples. The rules below are how real
          badges will be worked out once accounts are live.
```

with

```tsx
          A shop with an account behind it gets its badge worked out by the rules below, from its conversations on
          Vossie, whenever the Hub reviews the marketplace and after each reply or confirmed sale. While Vossie is a
          preview, most shops are samples with no account behind them, and they show sample badges.
```

3. In `trust-featured`, replace "Once accounts are live, each campus gets its own draw every day, for up to four places:" with "Each campus gets its own draw every day, for up to four places:".

The list under it already says what the draw does (Verified, open and listed; fair; own campus first; a week's break; pins), which is what's built now.

- [ ] **Step 4: Change the privacy policy**

`app/privacy/page.tsx` has been changed by stages D, E and F since part C wrote it. Read it first, and make each change below by meaning, keeping the sentences around it.

1. In `privacy-today`, the paragraph starting "Vossie is still a preview. If you sign in, the server keeps …" lists what the server keeps in its memory. Add "your RSVPs and slot requests" as the list's last item, keeping its "and" right (for example "…your shop and listings, and your RSVPs and slot requests in its memory only…").

2. In `privacy-sign-in` ("Your account"), straight after the bullet starting `<strong>Your messages, swap offers and reports.</strong>`, add:

```tsx
          <li>
            <strong>Your RSVPs and slot requests.</strong> When you say you&apos;re going to a Hub event or ask for a
            slot at office hours, we keep that, what you&apos;d like help with and the time that suits, so the Hub can
            plan and a mentor can answer. Hub staff see your first name with a request. Allowed under POPIA section 11:
            needed to give you what you asked for.
          </li>
```

3. Replace the bullet starting `<strong>If you are in the Hub&apos;s programme: mentors&apos; notes.</strong>` (the whole `<li>`) with:

```tsx
          <li>
            <strong>If the Hub mentors your shop: mentors&apos; notes.</strong> A mentor the Hub assigns to your shop
            can keep private notes and check-ins about it. Mentors and Hub admins can see them; you can&apos;t, and
            they aren&apos;t in your data download, but you can ask the Information Officer for them. They are deleted
            with your account. Allowed under POPIA section 11: our legitimate interest in supporting student
            businesses.
          </li>
```

4. Replace the bullet starting `<strong>A log of what Hub staff do.</strong>` (the whole `<li>`) with:

```tsx
          <li>
            <strong>A log of what Hub staff do.</strong> Who approved, declined, verified, hid or paused what, when and
            why, so staff actions can be checked. Nobody can edit it. If you delete your account, entries about you
            lose your name and the reason. Allowed under POPIA section 11: our legitimate interest in running Vossie
            fairly.
          </li>
```

5. In `privacy-keep`, in the bullet starting "Deleting your account removes your account, …", add "your RSVPs and slot requests, and mentors&apos; notes about your shop" to the list of what goes straight away, and end the bullet with " The log of what Hub staff do keeps its entries, without your name."

6. In `privacy-sharing`, replace the "Hub staff" bullet (the `<li>` starting `<strong>Hub staff</strong>`) with:

```tsx
          <li>
            <strong>Hub staff</strong> can see reports, account details, RSVPs and slot requests when they need to, to
            approve sellers, run the Hub&apos;s events and keep Vossie safe. A mentor sees your shop&apos;s numbers,
            never your messages.
          </li>
```

- [ ] **Step 5: Run them to make sure they pass**

Run: `pnpm test app/trust/page.test.tsx app/privacy/page.test.tsx app/info-pages.test.tsx`
Expected: PASS, the privacy page's `vossie_…` guard included (nothing new to name). If "lists what accounts will collect…" fails, check each new bullet ends with its "Allowed under POPIA section 11" ground: the test counts them against the bullets.

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 1 more unit test than after Task 18 (two trust tests were replaced).

- [ ] **Step 7: Hand over for commit**

Files: `app/trust/page.tsx`, `app/trust/page.test.tsx`, `app/privacy/page.tsx`, `app/privacy/page.test.tsx`.
Message: `docs: the trust page says Verified is the Hub's badge, separate from approval, and that badges and Featured's draw are built; the privacy policy says what mentors' notes, the staff log, RSVPs and slot requests keep (selling spec 8.10; staff tools spec 2.6 to 2.8)`

---

### Task 20: End-to-end tests for the staff tools

Every flow in spec 6's list, with plan decision 21's split: the five device projects run the checks that only read and the writes buyers can't see (the 404s, approving and declining a new student's shop, dismissing a report, a mentor's note and the CSV); a seventh project, `staff-writes`, runs after every other (selling's writes included) for the writes buyers see (Verified, hiding a listing, pausing a shop from a report, a pin, Hub posts with an RSVP and a slot request). Each test signs in with the sample Admin and Mentor, and acts only on its own new students, shops, listings, reports and posts, found by a word no other test uses. No test approves Lerato's sample shop or pauses Tech corner. Tech corner's "Responsive" stamp is now worked out from its conversations, so the two checks of it accept any badge (approval 7).

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/helpers/staff.ts`
- Create: `tests/e2e/staff.spec.ts`, `tests/e2e/staff-writes.spec.ts`
- Modify: `tests/e2e/shopping.spec.ts`, `tests/e2e/selling.spec.ts`, `tests/e2e/routes.spec.ts`

- [ ] **Step 1: A project that runs last of all**

In `playwright.config.ts` (F Task 16):
1. After F's `const DEVICE_PROJECTS = …;` line, add:

```ts
// The staff actions buyers can see (Verified, hidden listings, pins, Hub posts) run after every other test, selling's
// writes included, so nothing another test counts moves under it (staff tools plan decision 21).
const STAFF_WRITES = /staff-writes\.spec\.ts$/;
```

2. On each of the five device projects, replace `testIgnore: SELLING_WRITES` with `testIgnore: [SELLING_WRITES, STAFF_WRITES]`.
3. After F's `selling-writes` project, add:

```ts
    // After everything else (staff tools plan decision 21). Run it alone with --project=staff-writes --no-deps.
    {
      name: "staff-writes",
      use: desktop(1440, 900),
      testMatch: STAFF_WRITES,
      dependencies: [...DEVICE_PROJECTS, "selling-writes"],
    },
```

Run: `pnpm exec playwright test --list --project=staff-writes`
Expected: it lists nothing yet, and no error (the file comes in Step 4).

- [ ] **Step 2: Write the helpers**

Create `tests/e2e/helpers/staff.ts` (Playwright only runs `*.spec.ts`, so this file is never run on its own):

```ts
import { expect, type Browser, type Page } from "@playwright/test";
import { button, field, main, signInAsSample, signUpHere } from "./messaging";
import { uniqueWord } from "./selling";

// Shared by the staff tools' tests (staff tools plan, Task 20). Every test shares one server and one sample store, so
// each makes its own students, shops, listings, reports and posts, named with a word no other test uses (plan
// decision 21). Staff are the sample "Admin" (Pieter) and "Mentor" (Naledi), each in a browser of their own.

/** A browser of its own, signed in as a sample account, landing on `next`. Close its context at the end of the test. */
export async function signedInPage(browser: Browser, baseURL: string, label: string, next: string): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signInAsSample(page, label, next);
  return page;
}

/** A shop name no other test uses, at most 60 characters. */
export function newShopName(): string {
  return `Bakes ${uniqueWord()}`.slice(0, 60);
}

/**
 * A new student signs up at Midrand and applies to sell with this shop name, through the five steps with no photo
 * (selling spec 2.6). It ends on /sell, waiting for the Hub. The student's first name, for finding their rows.
 */
export async function applyToSell(page: Page, shopName: string): Promise<string> {
  const word = uniqueWord();
  const firstName = `Zola ${word.slice(-6)}`;
  await page.goto("/login?next=%2Fsell%2Fonboarding");
  await signUpHere(page, { email: `staff-${word}@eduvos.com`, firstName });
  await expect(page).toHaveURL(/\/sell\/onboarding$/);
  await field(page, "Shop name").fill(shopName);
  await field(page, "Main category").selectOption({ label: "Food" });
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=2$/);
  await field(page, "About your shop").fill("I bake between lectures.");
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=3$/);
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=4$/);
  await main(page).getByRole("checkbox", { name: "Library entrance" }).check();
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=5$/);
  await main(page).getByRole("checkbox", { name: "I've read the seller guidelines" }).check();
  await button(page, "Send for approval").click();
  await expect(page).toHaveURL(/\/sell$/);
  return firstName;
}

/** As an admin, opens a shop's review page from the Sellers list, and gives back its link (its slug). */
export async function reviewShop(admin: Page, shopName: string): Promise<string> {
  await admin.goto("/admin/sellers");
  await main(admin).getByRole("link", { name: `Review ${shopName}` }).click();
  await expect(main(admin).getByRole("heading", { level: 1, name: shopName })).toBeVisible();
  return new URL(admin.url()).pathname.split("/").pop()!;
}

/** The last action's notice on a staff page (spec 4). */
export const staffNotice = (page: Page) => main(page).getByRole("status");

/** A date a month from now, YYYY-MM-DD: always upcoming, whatever day the tests run. */
export function aMonthFromNow(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
```

- [ ] **Step 3: Write the tests that write nothing buyers see**

Create `tests/e2e/staff.spec.ts`:

```ts
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { button, field, main, newBuyer, onlyAt, signInAsSample, signUp } from "./helpers/messaging";
import { notFoundHeading, uniqueWord } from "./helpers/selling";
import { applyToSell, newShopName, reviewShop, signedInPage, staffNotice } from "./helpers/staff";

const BOTH = ["phone-390", "desktop-1440"];

test.describe("staff pages (staff tools spec 2.1, plan decision 1)", () => {
  test("send a signed-out visitor to sign in, and answer 404 to a student, titled Page not found", async ({ page }) => {
    onlyAt(...BOTH);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    await signInAsSample(page, "Student, Midrand", "/account");
    for (const path of ["/admin", "/admin/sellers/tech-corner", "/admin/reports", "/hub/manage", "/hub/h-002/edit", "/mentor"]) {
      await page.goto(path);
      await expect(notFoundHeading(page), path).toBeVisible();
      await expect(page, path).toHaveTitle("Page not found · Vossie");
      await expect(page.locator('meta[name="robots"][content*="noindex"]'), path).not.toHaveCount(0);
    }
    expect((await page.request.get("/mentor/export", { maxRedirects: 0 })).status()).toBe(404);
  });
});

test.describe("sellers (staff tools spec 2.3, plan decision 2)", () => {
  test("an admin approves a new student's shop, and the student sees their dashboard and a notification", async ({
    page,
    browser,
    baseURL,
  }) => {
    onlyAt(...BOTH);
    const shopName = newShopName();
    await applyToSell(page, shopName);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Hub is checking your shop");

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin");
    await expect(main(admin).getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(admin).toHaveTitle("Admin console · Vossie");
    await reviewShop(admin, shopName);
    await button(admin, `Approve ${shopName}`).click();
    await expect(staffNotice(admin)).toHaveText("Approved. The shop is live, and its owner has been told.");
    await admin.goto("/admin/audit?kind=shops");
    await expect(main(admin).getByRole("row").filter({ hasText: shopName })).toContainText("Approved a shop");
    await admin.context().close();

    await page.goto("/sell");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(shopName);
    await expect(main(page).getByText("Your shop is live")).toBeVisible();
    await page.goto("/notifications");
    await expect(main(page).getByText(`The Hub approved ${shopName}. You can publish your listings now.`)).toBeVisible();
  });

  test("an admin declines with a reason; the student sees it and sends the shop again", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    const shopName = newShopName();
    await applyToSell(page, shopName);

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
    await reviewShop(admin, shopName);
    await main(admin).getByRole("link", { name: `Decline ${shopName}` }).click();
    await expect(admin).toHaveURL(/\/admin\/sellers\/[a-z0-9-]+\/decline$/);
    await button(admin, `Decline ${shopName}`).click();
    await expect(admin.getByRole("alert", { name: "There's a problem" })).toBeVisible();
    await field(admin, "Reason").fill("Add a photo of what you bake.");
    await button(admin, `Decline ${shopName}`).click();
    await expect(staffNotice(admin)).toHaveText("Declined. The seller has been told why, and can send it again.");
    await admin.context().close();

    await page.goto("/sell");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Hub didn't approve your shop yet");
    await expect(main(page).getByText("Add a photo of what you bake.")).toBeVisible();
    await button(page, "Send for approval again").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Hub is checking your shop");
  });
});

test.describe("reports (staff tools spec 2.3, plan decision 5)", () => {
  test("an admin dismisses a report with a note, and the reporter sees the outcome", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    const buyer = newBuyer();
    await signUp(page, buyer);
    await page.goto("/report?listing=l-004");
    await main(page).getByRole("radio", { name: "Misleading listing" }).check();
    await field(page, "Tell us more (optional)").fill(`It looks different ${uniqueWord()}`);
    await button(page, "Send report").click();
    await expect(page).toHaveURL(/\/report\/sent\?listing=l-004$/);

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
    const row = main(admin).getByRole("row").filter({ hasText: buyer.firstName });
    await row.getByRole("link", { name: /^Review the report about/ }).click();
    await expect(main(admin).getByText(buyer.firstName, { exact: true })).toBeVisible();
    await field(admin, "Note").fill("Checked the photos: it's the same item.");
    await main(admin).getByRole("button", { name: /^Dismiss the report about/ }).click();
    await expect(admin).toHaveURL(/\/admin\/reports$/);
    await expect(staffNotice(admin)).toHaveText("Dismissed. The reporter has been told.");
    await admin.context().close();

    await page.goto("/notifications");
    await expect(main(page).getByText(/^We looked at your report about .+ and didn't find a problem\.$/)).toBeVisible();
  });
});

test.describe("mentoring (staff tools spec 2.6, plan decisions 15 to 17)", () => {
  test("a mentor downloads the dashboard as a CSV, and adds a note to a shop they mentor", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Mentor", "/mentor");
    const table = main(page).getByRole("table", { name: "Your sellers, A to Z" });
    await expect(table.getByRole("link", { name: "Tech corner" })).toBeVisible();

    const downloading = page.waitForEvent("download");
    await main(page).getByRole("link", { name: "Download CSV" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^vossie-mentoring-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = await readFile(await download.path(), "utf8");
    expect(csv.split("\r\n")[0]).toBe(
      "Shop,Campus,Mentor,Badge,Status,Enquiries (14 days),Due for a reply,Replied within 48 hours,Sales confirmed (14 days),Flags",
    );
    // Other tests message Tech corner at the same time, so only the row's start is checked.
    expect(csv).toContain("\r\nTech corner,Midrand,Naledi,");

    await table.getByRole("link", { name: "Tech corner" }).click();
    const word = uniqueWord();
    await field(page, "Note").fill(`Talked about photos ${word}.`);
    await button(page, "Add a note about Tech corner").click();
    await expect(staffNotice(page)).toHaveText("Note saved.");
    const notes = main(page).getByRole("region", { name: "Notes and check-ins" });
    await expect(notes.getByRole("listitem").filter({ hasText: word })).toContainText("Naledi");
  });
});
```

- [ ] **Step 4: Write the tests whose writes buyers see**

Create `tests/e2e/staff-writes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { button, field, main, newBuyer, signUp, signUpHere } from "./helpers/messaging";
import { cardsFor, notFoundHeading, publishListing, uniqueWord } from "./helpers/selling";
import { aMonthFromNow, applyToSell, newShopName, reviewShop, signedInPage, staffNotice } from "./helpers/staff";

// Runs in the staff-writes project, after every other test (staff tools plan decision 21): what these change shows on
// pages other tests count. Each test acts only on what it makes, except the pin, on a campus no other test checks.

test("an admin verifies a new shop: Verified on its storefront and in the Hub's Verified sellers (spec 2.3)", async ({
  page,
  browser,
  baseURL,
}) => {
  const shopName = newShopName();
  await applyToSell(page, shopName);
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
  const slug = await reviewShop(admin, shopName);
  await button(admin, `Approve ${shopName}`).click();
  await expect(staffNotice(admin)).toContainText("Approved.");
  await button(admin, `Verify ${shopName}`).click();
  await expect(staffNotice(admin)).toHaveText("Verified. The tick shows on the shop and its listings.");
  await admin.goto(`/sellers/${slug}`);
  await expect(admin.locator(".seller-stamps li").filter({ visible: true }).filter({ hasText: "Verified" })).toHaveCount(1);
  await admin.goto("/hub");
  await expect(admin.getByRole("region", { name: "Verified by the Hub" }).getByRole("link", { name: new RegExp(shopName) })).toBeVisible();
  await admin.context().close();
});

test("an admin hides a reported listing: gone from browse and its page, marked for its seller, the reporter told (spec 2.3)", async ({
  page,
  browser,
  baseURL,
}) => {
  const title = `Desk lamp ${uniqueWord()}`;
  const seller = await signedInPage(browser, baseURL!, "Seller, Tech corner", "/sell");
  const id = await publishListing(seller, title);
  await page.goto(`/browse?q=${encodeURIComponent(title)}`);
  await expect(cardsFor(page, title)).toHaveCount(1);

  const buyer = newBuyer();
  await signUp(page, buyer);
  await page.goto(`/report?listing=${id}`);
  await main(page).getByRole("radio", { name: "Prohibited item" }).check();
  await button(page, "Send report").click();
  await expect(page).toHaveURL(new RegExp(`/report/sent\\?listing=${id}$`));

  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).click();
  await main(admin).getByRole("link", { name: `Hide ${title}` }).click();
  await field(admin, "Reason").fill("Lamps with bare wiring aren't allowed.");
  await button(admin, `Hide ${title}`).click();
  await expect(staffNotice(admin)).toHaveText("Hidden. Its seller and everyone who reported it have been told.");
  await admin.context().close();

  await page.goto(`/browse?q=${encodeURIComponent(title)}`);
  await expect(cardsFor(page, title)).toHaveCount(0);
  await page.goto(`/listings/${id}`);
  await expect(notFoundHeading(page)).toBeVisible();
  await page.goto("/notifications");
  await expect(main(page).getByText(`Thanks, we've acted on your report about ${title}.`)).toBeVisible();
  await seller.goto("/sell/listings");
  await expect(main(seller).getByText("Hidden by the Hub: Lamps with bare wiring aren't allowed.")).toBeVisible();
  await seller.context().close();
});

test("an admin pauses the shop behind a report: its owner sees why with no Resume, and the reporter is told (spec 2.3)", async ({
  page,
  browser,
  baseURL,
}) => {
  const shopName = newShopName();
  const ownerContext = await browser.newContext({ baseURL });
  const owner = await ownerContext.newPage();
  await applyToSell(owner, shopName);
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
  const slug = await reviewShop(admin, shopName);
  await button(admin, `Approve ${shopName}`).click();
  await expect(staffNotice(admin)).toContainText("Approved.");

  await signUp(page, newBuyer());
  await page.goto(`/report?seller=${slug}`);
  await main(page).getByRole("radio", { name: "Scam or fraud" }).check();
  await button(page, "Send report").click();

  await admin.goto("/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${shopName}` }).click();
  await main(admin).getByRole("link", { name: `Pause ${shopName}` }).click();
  await field(admin, "Reason").fill("Asked buyers for a deposit.");
  await button(admin, `Pause ${shopName}`).click();
  await expect(staffNotice(admin)).toHaveText("Paused. The seller and everyone who reported it have been told.");
  await admin.context().close();

  await owner.goto("/sell");
  await expect(main(owner).getByText("Paused by the Hub: your listings are off every list")).toBeVisible();
  await expect(main(owner).getByText("Asked buyers for a deposit.")).toBeVisible();
  await expect(button(owner, "Resume my shop")).toHaveCount(0);
  await ownerContext.close();
  await page.goto("/notifications");
  await expect(main(page).getByText(`Thanks, we've acted on your report about ${shopName}.`)).toBeVisible();
});

test("an admin pins a Verified seller to a campus for today, and its homepage features them first (spec 2.8)", async ({
  page,
  browser,
  baseURL,
}) => {
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/featured");
  await field(admin, "Seller").selectOption({ label: "Nail bar" });
  await field(admin, "Campus").selectOption({ label: "East London" });
  await button(admin, "Pin the seller").click();
  await expect(staffNotice(admin)).toHaveText("Pinned. They take one of the four places that day.");
  const row = main(admin).getByRole("table", { name: "Featured today, by campus" }).getByRole("row").filter({ hasText: "East London" });
  await expect(row).toContainText("Nail bar (pinned)");
  await admin.context().close();

  await page.context().addCookies([{ name: "vossie_campus", value: "east-london", url: baseURL! }]);
  await page.goto("/");
  await expect(page.locator("#featured").getByRole("article").first().getByRole("link")).toHaveAttribute(
    "href",
    "/sellers/nail-bar",
  );
});

test("a mentor publishes an event and office hours; a student RSVPs and asks for a slot; the mentor accepts (spec 2.4 and 2.5)", async ({
  page,
  browser,
  baseURL,
}) => {
  const word = uniqueWord();
  const day = aMonthFromNow();
  const mentor = await signedInPage(browser, baseURL!, "Mentor", "/hub/manage");

  // An event for every campus, with two places, checked in Preview first (plan decision 12).
  await main(mentor).getByRole("link", { name: "Write a post" }).click();
  await main(mentor).getByRole("radio", { name: "Event" }).check();
  await field(mentor, "Title").fill(`Market ${word}`);
  await field(mentor, "Date").fill(day);
  await field(mentor, "Start time").fill("18:00");
  await field(mentor, "Place").fill("The Hub, Block C");
  await field(mentor, "Places (events only)").fill("2");
  await field(mentor, "Summary").fill("Sell what you make.");
  await field(mentor, "The post").fill("## Bring\n- A table");
  await button(mentor, "Preview").click();
  await expect(main(mentor).getByRole("region", { name: "Preview" }).getByRole("heading", { name: "Bring" })).toBeVisible();
  await expect(field(mentor, "Title")).toHaveValue(`Market ${word}`);
  await button(mentor, "Save the post").click();
  await expect(mentor).toHaveURL(/\/hub\/manage$/);
  await expect(staffNotice(mentor)).toHaveText("Published. It's on the Hub's feed.");

  // Office hours at Midrand.
  await main(mentor).getByRole("link", { name: "Write a post" }).click();
  await main(mentor).getByRole("radio", { name: "Office hours" }).check();
  await field(mentor, "Title").fill(`Office hours ${word}`);
  await field(mentor, "Campus").selectOption({ label: "Midrand" });
  await field(mentor, "Date").fill(day);
  await field(mentor, "Start time").fill("13:00");
  await field(mentor, "Place").fill("The Hub, Block C");
  await field(mentor, "Summary").fill("Bring your prices.");
  await field(mentor, "The post").fill("Twenty minutes each.");
  await button(mentor, "Save the post").click();
  await expect(staffNotice(mentor)).toHaveText("Published. It's on the Hub's feed.");

  // The event is on the feed; RSVP goes through sign-in and back, then counts.
  await page.goto("/hub?type=events");
  await page.getByRole("link", { name: `Market ${word}` }).click();
  await page.getByRole("link", { name: "RSVP" }).click();
  const buyer = newBuyer();
  await signUpHere(page, buyer);
  await expect(page).toHaveURL(/\/hub\/h-[0-9a-f-]{36}$/);
  await button(page, "RSVP").click();
  await expect(main(page).getByText("You're going", { exact: true })).toBeVisible();
  await expect(main(page).getByText("1 going · 2 places")).toBeVisible();

  // Office hours: Request a slot opens its page.
  await page.goto("/hub?type=office-hours");
  await page.getByRole("link", { name: `Office hours ${word}` }).click();
  await page.getByRole("link", { name: "Request a slot" }).click();
  await expect(page).toHaveURL(/\/hub\/h-[0-9a-f-]{36}\/book$/);
  await field(page, "What you'd like help with").fill(`Pricing my cakes ${word}`);
  await button(page, "Send request").click();
  await expect(main(page).getByRole("status")).toHaveText("Request sent. A mentor will answer in your notifications.");
  await expect(main(page).getByRole("region", { name: "Your request" })).toContainText("Waiting for a mentor.");

  // The mentor accepts, and the student hears.
  await mentor.goto("/hub/manage");
  await button(mentor, `Accept ${buyer.firstName}'s request for Office hours ${word}`).click();
  await expect(staffNotice(mentor)).toHaveText("Accepted. The student has been told.");
  await mentor.context().close();
  await page.goto("/notifications");
  await expect(main(page).getByText(`A mentor accepted your slot request for Office hours ${word}.`)).toBeVisible();
});
```

- [ ] **Step 5: Tech corner's badge, and sign-in for staff pages**

In `tests/e2e/shopping.spec.ts`, replace

```ts
    await expect(page.locator(".seller-stamps li")).toHaveText(["Midrand", "Tech", "Responsive"]);
```

with

```ts
    // Tech corner's badge is worked out from its conversations, which other tests add to (staff tools approval 7).
    await expect(page.locator(".seller-stamps li")).toHaveText(["Midrand", "Tech", /^(New seller|Responsive|Trusted)$/]);
```

In `tests/e2e/selling.spec.ts` (F Task 16), in "the sample seller's dashboard has the week's numbers, the badge and the shop's pages", replace `.toContainText("Responsive");` on the "Your badge" region with `.toContainText(/New seller|Responsive|Trusted/);` and add above it the comment `// Its badge is worked out from its conversations, which other tests add to (staff tools approval 7).`

In `tests/e2e/routes.spec.ts`, add this test at the end of its `describe`:

```ts

  test("staff pages send a signed-out visitor to sign in, coming back afterwards (staff tools spec 2.1)", async ({ page }) => {
    onlyAtPhoneAndDesktop();
    for (const [path, next] of [
      ["/admin", "%2Fadmin"],
      ["/admin/sellers", "%2Fadmin%2Fsellers"],
      ["/hub/manage", "%2Fhub%2Fmanage"],
      ["/hub/new", "%2Fhub%2Fnew"],
      ["/mentor", "%2Fmentor"],
      ["/mentor/export", "%2Fmentor"],
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(new RegExp(`/login\\?next=${next}$`));
    }
  });
```

- [ ] **Step 6: Run them**

Run, one after another:
- `pnpm e2e tests/e2e/staff.spec.ts tests/e2e/routes.spec.ts tests/e2e/shopping.spec.ts tests/e2e/selling.spec.ts`
- `pnpm e2e --project=staff-writes --no-deps tests/e2e/staff-writes.spec.ts`

Expected: PASS. Then run the whole suite once: `pnpm e2e`. Expected: all pass, the staff-writes project last. Record the counts for Task 22.

If a check of the 404's title fails on a slow first render, it's waiting on the streamed `<title>` (plan decision 1): `toHaveTitle` already waits; don't add sleeps. If a staff-writes check of a buyers' page shows the change late, the action didn't expire its tag: check its `sellersChanged()`, `listingsChanged()` or `hubChanged()` before `done()`.

- [ ] **Step 7: Hand over for commit**

Files: `playwright.config.ts`, `tests/e2e/helpers/staff.ts`, `tests/e2e/staff.spec.ts`, `tests/e2e/staff-writes.spec.ts`, `tests/e2e/shopping.spec.ts`, `tests/e2e/selling.spec.ts`, `tests/e2e/routes.spec.ts`.
Message: `test: end-to-end checks for the staff tools: the 404s and sign-in, approve and decline, dismiss, a mentor's note and the CSV, and, in a project that runs last, Verified, hide, pause from a report, a pin, and Hub posts with an RSVP and a slot request (staff tools spec 6)`

---

### Task 21: Accessibility, layout shift and size for the staff tools

Spec 4 and 5's checks (plan decisions 1, 19 and 20): axe on every staff page, signed in as the sample Admin, and on the slot request page; layout shift on the request page and two staff pages; and the JavaScript of four staff pages, signed in, each under the limit. Staff pages aren't in the public budget (spec 5), so they're measured here rather than in `performance.spec.ts`.

**Files:**
- Create: `tests/e2e/staff-checks.spec.ts`

- [ ] **Step 1: Write the checks**

Create `tests/e2e/staff-checks.spec.ts`:

```ts
import { brotliCompressSync, constants } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { button, field, main, newBuyer, signInAsSample, signUp } from "./helpers/messaging";
import { signedInPage } from "./helpers/staff";

// Accessibility, layout shift and size for the staff tools (staff tools plan, Task 21; spec 4 and 5). Staff pages are
// checked signed in as the sample Admin, who can open every one of them.

test.use({ reducedMotion: "reduce" });

const BOTH = ["phone-390", "desktop-1440"];
const onlyAtBoth = () => test.skip(!BOTH.includes(test.info().project.name), "Checked at 390 and 1440");

async function seriousIssues(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
}

/** Signs `context` in through another browser, copying only the session cookie across, so nothing is cached yet. */
async function copySession(browser: Browser, context: BrowserContext, baseURL: string, label: string) {
  const other = await browser.newContext({ baseURL });
  await signInAsSample(await other.newPage(), label, "/account");
  await context.addCookies((await other.cookies()).filter((cookie) => cookie.name === "vossie_session"));
  await other.close();
}

const STAFF_PAGES: ReadonlyArray<[path: string, heading: string]> = [
  ["/admin", "Overview"],
  ["/admin/sellers", "Sellers"],
  ["/admin/sellers/crochet-corner", "Crochet corner"],
  ["/admin/sellers/crochet-corner/decline", "Decline Crochet corner"],
  ["/admin/sellers/tech-corner", "Tech corner"],
  ["/admin/sellers/tech-corner/pause", "Pause Tech corner"],
  ["/admin/reports", "Reports"],
  ["/admin/featured", "Featured"],
  ["/admin/pickup-points", "Pickup points"],
  ["/admin/audit", "Audit log"],
  ["/hub/manage", "Hub posts"],
  ["/hub/new", "Write a post"],
  ["/hub/h-002/edit", "Edit Office hours: pricing your hustle"],
  ["/mentor", "Mentor dashboard"],
  ["/mentor/tech-corner", "Tech corner"],
];

test.describe("the staff tools have no serious or critical axe issues (staff tools spec 4)", () => {
  for (const [path, heading] of STAFF_PAGES) {
    test(`${path}, signed in as the admin`, async ({ page }) => {
      onlyAtBoth();
      await signInAsSample(page, "Admin", path);
      await expect(main(page).getByRole("heading", { level: 1, name: heading })).toBeVisible();
      expect(await seriousIssues(page)).toEqual([]);
    });
  }

  test("a report's page and its Hide confirm page", async ({ page, browser, baseURL }) => {
    onlyAtBoth();
    const buyer = newBuyer();
    await signUp(page, buyer);
    await page.goto("/report?listing=l-004");
    await main(page).getByRole("radio", { name: "Spam" }).check();
    await button(page, "Send report").click();
    await expect(page).toHaveURL(/\/report\/sent\?listing=l-004$/);

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
    await main(admin).getByRole("row").filter({ hasText: buyer.firstName }).getByRole("link").click();
    await expect(main(admin).getByRole("heading", { level: 2, name: "The report" })).toBeVisible();
    expect(await seriousIssues(admin)).toEqual([]);
    await main(admin).getByRole("link", { name: /^Hide / }).click();
    await expect(field(admin, "Reason")).toBeVisible();
    expect(await seriousIssues(admin)).toEqual([]);
    await admin.context().close();
  });

  test("the slot request page, with a request waiting and with the form", async ({ page }) => {
    onlyAtBoth();
    await signInAsSample(page, "Student, Midrand", "/hub/h-007/book");
    await expect(main(page).getByRole("heading", { level: 1, name: "Request a slot" })).toBeVisible();
    expect(await seriousIssues(page)).toEqual([]);
    await page.goto("/hub/h-002/book");
    await expect(main(page).getByRole("heading", { level: 1, name: "Request a slot" })).toBeVisible();
    expect(await seriousIssues(page)).toEqual([]);
  });
});

const SHIFT_PAGES: ReadonlyArray<[name: string, path: string, label: string]> = [
  ["slot request page", "/hub/h-002/book", "Student, Midrand"],
  ["admin console's Overview", "/admin", "Admin"],
  ["mentor dashboard", "/mentor", "Mentor"],
];

for (const [name, path, label] of SHIFT_PAGES) {
  test(`the ${name} holds still while fonts and content arrive (CLS 0.05 or less, homepage spec 11)`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    onlyAtBoth();
    await copySession(browser, context, baseURL!, label);
    // Hold the fonts back, so they swap in after first paint: the worst case for shifts.
    await page.route(/\.woff2$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await page.addInitScript(() => {
      type LayoutShift = PerformanceEntry & { value: number; hadRecentInput: boolean };
      const shifts: number[] = [];
      (window as unknown as { __shifts: number[] }).__shifts = shifts;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LayoutShift[]) if (!entry.hadRecentInput) shifts.push(entry.value);
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const total = await page.evaluate(() =>
      (window as unknown as { __shifts: number[] }).__shifts.reduce((sum, value) => sum + value, 0),
    );
    console.log(`${name} layout shift: ${total.toFixed(4)}`);
    expect(total).toBeLessThanOrEqual(0.05);
  });
}

const SIZE_PAGES: ReadonlyArray<[name: string, path: string]> = [
  ["Overview", "/admin"],
  ["Sellers", "/admin/sellers"],
  ["Hub tools", "/hub/manage"],
  ["Mentor dashboard", "/mentor"],
];

for (const [name, path] of SIZE_PAGES) {
  test(`a first visit to the staff ${name} page, signed in, stays under the JavaScript limit (spec 5)`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
    await copySession(browser, context, baseURL!, "Admin");
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
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
    await Promise.all(pending);
    console.log(`staff ${name} (signed in): ${JSON.stringify({ scriptBrotli })}`);
    expect(scriptBrotli, "JavaScript, brotli as a host serves it").toBeLessThanOrEqual(150 * 1024);
  });
}
```

- [ ] **Step 2: Run them**

Run: `pnpm e2e tests/e2e/staff-checks.spec.ts`
Expected: PASS. Put the four staff pages' `scriptBrotli` figures in the ledger's "Staff pages, signed in" line, and the three layout shift figures in your notes for Task 22.

If axe reports an issue, fix the component it names and say so in the hand-over; don't loosen the check. The likely ones: a table cell with no header (every `StaffTable` column has one), a button or link with no name (every row action names its target), or contrast on the cell labels (muted on white is 5.9:1). If a staff page's layout shift is over 0.05, the skeleton is shorter or taller than the page: change `.staff-skeleton-body`'s height (Task 9) towards that page's content height at that width, keeping it one shape, and record the change; the request page's room is `.hub-book-skeleton-form`.

- [ ] **Step 3: Run every check**

Run, one after another: `pnpm lint`, `pnpm typecheck`, `pnpm test`.
Expected: all pass.

- [ ] **Step 4: Hand over for commit**

Files: `tests/e2e/staff-checks.spec.ts`, and any component or CSS a failed check made you change (name each in the hand-over).
Message: `test: axe on every staff page and the slot request page, layout shift on the request page, Overview and the mentor dashboard, and the JavaScript of four staff pages, signed in (staff tools spec 4 and 5). JS: Overview <n> B, Sellers <n> B, Hub tools <n> B, Mentor dashboard <n> B`

---

### Task 22: Review screenshots, docs and final checks

**Files:**
- Modify: `tests/e2e/screenshots.spec.ts`
- Create: `docs/progress/staff/*.png`
- Modify: `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, the spec (`docs/superpowers/specs/2026-10-14-staff-tools-design.md`)
- Modify: this plan (the ledger and a "Changes made during the build" section)

- [ ] **Step 1: Check the docs are free to edit**

Run `git status --short` on its own. Expected: only ` M .claude/launch.json` and nothing of this stage's left uncommitted. If another stage's work has the docs open (changed and uncommitted), stop and ask the controller before editing them. Read each doc's current text before editing it, and edit by meaning where this step's quoted lines have moved.

- [ ] **Step 2: Add the review screenshots**

In `tests/e2e/screenshots.spec.ts`, add `import { signInAsSample } from "./helpers/messaging";` below the `@playwright/test` import if E or F hasn't already, and add to the end of the file:

```ts

test("staff tools review screenshots", async ({ page, browser, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/staff/${project}-${name}.png`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  const main = page.locator("main");
  const shot = (name: string) => page.screenshot({ path: file(name), fullPage: true });
  const heading = (name: string) => expect(main.getByRole("heading", { level: 1, name })).toBeVisible();

  // The admin only reads, so nothing the other tests count changes.
  await signInAsSample(page, "Admin", "/admin");
  await heading("Overview");
  await shot("01-overview");
  await page.goto("/admin/sellers");
  await heading("Sellers");
  await shot("02-sellers");
  await page.goto("/admin/sellers/crochet-corner");
  await heading("Crochet corner");
  await shot("03-review-waiting");
  await page.goto("/admin/sellers/crochet-corner/decline");
  await main.getByRole("button", { name: "Decline Crochet corner", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  await shot("04-decline-errors");
  await page.goto("/admin/sellers/tech-corner");
  await heading("Tech corner");
  await shot("05-review-open");
  await page.goto("/admin/reports");
  await shot("06-reports");
  await page.goto("/admin/featured");
  await heading("Featured");
  await shot("07-featured");
  await page.goto("/admin/pickup-points");
  await shot("08-pickup-points");
  await page.goto("/admin/audit");
  await shot("09-audit-log");

  // The mentor, in a browser of their own. Preview saves nothing.
  const context = await browser.newContext({ baseURL, viewport: page.viewportSize()!, reducedMotion: "reduce" });
  const mentor = await context.newPage();
  const mentorShot = (name: string) => mentor.screenshot({ path: file(name), fullPage: true });
  await signInAsSample(mentor, "Mentor", "/hub/manage");
  await expect(mentor.getByRole("region", { name: "Office-hours requests" })).toBeVisible();
  await mentorShot("10-hub-posts");
  await mentor.goto("/hub/new");
  await mentor.getByLabel("Title", { exact: true }).fill("Market day at the Hub");
  await mentor.getByLabel("The post", { exact: true }).fill("## Bring\n- A table\n- A float\n\nStalls are **free**.");
  await mentor.locator("main").getByRole("button", { name: "Preview", exact: true }).click();
  await expect(mentor.getByRole("region", { name: "Preview" })).toBeVisible();
  await mentorShot("11-post-preview");
  await mentor.goto("/mentor");
  await expect(mentor.getByRole("table", { name: "Your sellers, A to Z" })).toBeVisible();
  await mentorShot("12-mentor-dashboard");
  await mentor.goto("/mentor/tech-corner");
  await expect(mentor.getByRole("region", { name: "Notes and check-ins" })).toBeVisible();
  await mentorShot("13-mentor-shop");
  await context.close();

  // Thandi's sample slot request, as she sees it.
  const studentContext = await browser.newContext({ baseURL, viewport: page.viewportSize()!, reducedMotion: "reduce" });
  const student = await studentContext.newPage();
  await signInAsSample(student, "Student, Midrand", "/hub/h-007/book");
  await expect(student.getByRole("region", { name: "Your request" })).toBeVisible();
  await student.screenshot({ path: file("14-slot-request"), fullPage: true });
  await studentContext.close();
});
```

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "staff tools review screenshots"`
Expected: 28 PNGs in `docs/progress/staff/`. Open a few and check they show what their names say: the tables as cards at 390 and as tables at 1440.

- [ ] **Step 3: Bring the spec in line with the build**

In `docs/superpowers/specs/2026-10-14-staff-tools-design.md`, set the status to "Built (2026-10-<day>), in sample mode." and add a section at the end, "## 8. Changes on plan review and build", listing where the plan and the build refined the spec (wins over the decisions above):
- Staff pages answer with the site's 404 page from inside the page (status 200, `noindex`), and the tab says "Page not found" to anyone but staff; a true 404 status needs a role check before rendering (a proxy) once sessions live in a real database (plan decision 1).
- A declined shop stays waiting with the decline and the reason recorded; the seller sees the reason on `/sell` and sends it again (plan decision 2). A pause the Hub makes is the Hub's to undo; sample shops no account owns can't be paused (plan decision 3).
- A hidden listing keeps its row and its seller sees why; nothing shows it again yet (plan decision 4).
- Hiding or pausing closes every open report on the same target; a report about a Looking For request, or about something gone, can only be dismissed (plan decision 5).
- The audit log gets an entry only when something changed; deleting an account keeps the entries but forgets the person in them (plan decision 6).
- Two more notification kinds: the Hub's other decisions about a shop or listing, and slot requests (plan decision 7).
- Badges are worked out only for shops with an owner account; Overview works them out as it renders, and buyers see a change within 15 minutes or at the next write (plan decision 8).
- Featured is drawn and recorded per campus per day; a seller shown there sits out that campus for six days; with nine Verified sellers a campus's row runs short after two or three days (plan decision 9).
- Pickup points and Hub posts moved into the store; retiring a point is undone by Use it again; a draft's page is the 404; a cover with none shows the Hub's banner (plan decisions 10 and 11).
- Preview is a second button that draws the body on the server above the form, keeping every field and a picked cover (plan decision 12).
- One open slot request per student per office hours; the post's author is told; the office-hours queue is shared by every mentor and admin (plan decisions 13 and 14).
- The mentor dashboard covers 14 days; one mentor per shop; notes are about the shop's owner and aren't in the seller's data download; the CSV guards against formulas (plan decisions 15 to 17).
- Confirm pages for Decline, Hide and Pause, each with a required reason; tables keep their roles when they stack (plan decisions 18 and 20).
- The end-to-end tests whose staff actions buyers see run after all others (plan decision 21).
- Anything else from this plan's "Changes made during the build".

- [ ] **Step 4: Log the decisions**

In `docs/reference/LANDING-DECISIONS.md`, add a row after the last, numbered one more than it, in the log's style:

```markdown
| N | 2026-10-<day> | Staff tools plan decisions that change the spec | **Staff pages answer with the 404 page from inside the page (status 200, noindex, "Page not found" in the tab); a declined shop stays waiting with the Hub's reason and can be sent again; the Hub's pause is the Hub's to undo; hiding or pausing closes every report on the target; badges are worked out only for shops with an owner, when Overview renders and after replies and confirmed sales; Featured records each campus's row per day and rests a seller there for six days; pickup points and Hub posts moved into the store; notes are about the shop's owner and aren't in the seller's download** | Plan decisions 1 to 3, 5, 8 to 11 and 16 in `2026-10-14-staff-tools.md`. The spec now says so. The in-memory store can't be read by a proxy, so the 404 comes from the render; D's, E's and F's code keeps its shapes; Featured's week's break needs each day's row. <Lama, at plan review, or: Claude, under decision 54> |
```

Name in it any other plan decision Lama changed or kept on purpose, and any JS figure Lama accepted under the stop rule.

- [ ] **Step 5: Update the go-live checklist**

In `docs/reference/GO-LIVE.md`:
- Section 1: "Hub post, with RSVP and book-a-slot" → **Built** (RSVP and slot requests for signed-in students; signed out, through sign-in). "How trust works" → **Built** (Verified is the Hub's badge; badges and Featured are worked out).
- Section 5 (Staff tools): the admin row → **Built in sample mode** (hiding a request is stage H's); the Hub post editor and office-hours queue → **Built in sample mode**; the mentor dashboard → **Built in sample mode**. Update the totals line after section 5 to match.
- Section 6, add under the backend items:
  - `- [ ] A true 404 status for staff pages: a proxy checks the session's role before rendering, once sessions live in the real database (staff tools plan decision 1).`
  - `- [ ] Supabase tables for the audit log (insert-only: no update or delete grant for anyone), Featured pins and draws, pickup points, mentors' notes, Hub posts, RSVPs and slot requests replace the sample store's.`
  - `- [ ] Hub covers move to Supabase Storage with the other photos.`
- Section 6, change the "Scheduled jobs" line to: `- [ ] Scheduled jobs: recalculating trust badges nightly (Overview does it on demand today), confirming sales automatically after 7 days, and closing old Looking For requests (stage H leaves them open). Featured's draw needs no job: each campus's row is recorded on its first view of the day.`
- Section 6, POPIA and legal, add:
  - `- [ ] Whether POPIA's right of access puts mentors' notes in the seller's data download; today the Information Officer is asked for them (staff tools plan decision 16).`
  - `- [ ] How long the staff audit log, RSVPs and slot requests are kept.`
- Section 6, Content, add `- [ ] The Hub's real posts and office hours, and the real staff accounts (mentors and admins); managing them in the app is not built (staff tools spec 7).`
- Section 7, add:
  - `- [ ] **Showing a hidden listing again.** Not built: the seller can edit or delete it, and only a change in the store brings it back (staff tools plan decision 4).`
  - `- [ ] **Featured with few Verified sellers.** The week's break empties a campus's row after two or three days while only nine sellers are Verified (staff tools plan decision 9). Shorten the break, or verify more sellers.`
  - `- [ ] **Email to staff** when an application, a report or a slot request waits (staff tools spec 7).`
- Section 8: after the selling item, add `**Done in sample mode (2026-10-<day>): the staff tools (stage G).** Stage H adds community actions.`

- [ ] **Step 6: Update CLAUDE.md**

In `CLAUDE.md`:
- Under "Code rules", after F's lines about selling, add:
  `- Staff pages (\`/admin\`, \`/hub/manage\`, \`/hub/new\`, \`/hub/[id]/edit\`, \`/mentor\`) render a wordless \`StaffSkeleton\` in their static shell and everything else inside \`<Suspense>\` after \`requireStaff(area, nextPath)\` (\`lib/staff/access.ts\`): sign-in when signed out, the 404 for anyone without the role. Their tab title comes from \`staffMetadata()\`. No public page links to them, and links into them never prefetch.`
  `- Every staff action is a Server Action in \`lib/staff/*-actions.ts\`: \`requireStaff()\` first, one \`recordAudit()\` only when something changed (the audit log has no update or delete), the notifications the spec names, the right tag expired, then \`done()\`.`
  `- End-to-end tests whose staff actions buyers can see go in \`tests/e2e/staff-writes.spec.ts\`, which runs after every other test.`
- Under "Privacy (POPIA)", add:
  `- Mentors' notes are about a shop's owner, seen by mentors and admins only, never by the seller, and not in the data download; deleting an account deletes notes about it and strips it from the audit log, which keeps its entries.`

- [ ] **Step 7: Update the progress log**

In `docs/PROGRESS.md`, add a section before "Next", in the style of the earlier ones:

```markdown
## 2026-10-<day>: Staff tools built, in sample mode (stage G)
- **The admin console** (`/admin`): Overview (sellers waiting, open reports, slot requests, and the trust badges worked out as it opens), Sellers (waiting first; a shop's review page with its answers, Approve, Decline with a reason, Verify, the Hub's Pause and Resume, and its mentor), Reports (Dismiss with a note, Hide the listing, Pause the account), Featured (today's row for each campus, and pins), Pickup points (add, rename, retire, use again) and the Audit log (newest first, by staff member and kind). Decline, Hide and Pause go through confirm pages.
- **The Hub's tools** (`/hub/manage`, `/hub/new`, `/hub/[id]/edit`): posts with drafts, a cover and a server-rendered Preview, and the office-hours queue with Accept and Decline.
- **RSVP and Request a slot** are real for signed-in students; `/hub/[id]/book` is the request page.
- **The mentor dashboard** (`/mentor`): assigned shops with the last 14 days' numbers and flags, each shop's notes and check-ins, and a CSV.
- **What buyers see:** Featured honours pins and a week's break; trust badges come from conversations for shops with an account; hidden listings and Hub-paused shops leave every list; a retired pickup point says "(no longer used)". Sellers see a decline's or a Hub pause's reason on `/sell`.
- **Every staff page answers 404 to anyone without the role** (from inside the page: status 200, noindex); signed out, it goes to sign-in first. Every staff action writes one audit entry.
- **Words:** the trust page says Verified is the Hub's badge, separate from approval; the privacy policy says what mentors' notes, the staff log, RSVPs and slot requests keep.
- **Where the build differed from the plan** is in the plan's "Changes made during the build".
- **Plan decisions Lama may want to revisit:** <list any that came up in review, or "none">; and the go-live checklist's section 7 items (showing a hidden listing again, Featured with few Verified sellers, email to staff).
- **Checks:**
  - lint and types are clean;
  - <n> unit tests pass;
  - end to end, <n> pass, <n> are skipped by design and none fail;
  - axe finds no serious or critical issues on every staff page and the slot request page.
- **First visit at 390px, JS brotli:** homepage <n> B, browse <n> B, listing <n> B, storefront <n> B, Hub event <n> B, Hub office hours <n> B, `/sell` <n> B (stop line <n> B, limit 153,600 B). Staff pages, signed in: Overview <n> B, Sellers <n> B, Hub tools <n> B, Mentor dashboard <n> B.
- **Layout shift** (fonts held back, at 390 and 1440px): <a table of the slot request page, Overview and the mentor dashboard>.
- Review screenshots: `docs/progress/staff/`.
```

Fill in the numbers from your runs. Then make "Next" say:

```markdown
## Next
- Lama reviews the screenshots in `docs/progress/staff/`. To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "staff tools review screenshots"`.
- Then stage H: community actions (posting Looking For requests, offers, following shops and the offline page).
```

- [ ] **Step 8: Fill in this plan**

Fill in the JS ledger (the four staff pages' line too), and add a "Changes made during the build" section after it, listing every place the build differed from the tasks as written, with the commit that made each change.

- [ ] **Step 9: Final checks**

Run, one after another: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`.
Expected: all pass; `pnpm build`'s route list shows the staff pages and `/hub/[id]/book` as partly prerendered (their shells) and `/mentor/export` as dynamic; `pnpm e2e` runs `staff-writes` last. Record the unit and e2e counts in `docs/PROGRESS.md`.

- [ ] **Step 10: Hand over for commit**

Files: `tests/e2e/screenshots.spec.ts`, `docs/progress/staff/`, `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/superpowers/specs/2026-10-14-staff-tools-design.md`, this plan.
Message: `docs: staff tools review screenshots, progress, checklist, decisions, CLAUDE.md and the spec brought in line (stage G). JS: / <n> B, listing <n> B, /sell <n> B; staff Overview <n> B`

---

## Self-review (while drafting the tasks)

Checked against the spec (every decision in section 2, sections 3 to 7, and selling spec 8.10), for placeholders, and for names and signatures across tasks. Gaps found and fixed:
- **Task numbers in the front matter.** "Before you start" and "Recheck before starting" used an older numbering; they now match the file map and "Where each spec decision is built" (Task 8 for deletion and export, 15 for RSVP and robots, 17 for E's actions, 18 for `/sell` and the account page, 19 for the trust and privacy pages, 20 for end to end).
- **A hidden listing came back on its seller's next save.** F's `saveOwnListing` builds a new row, so Task 4 now carries `hiddenAt` and `hiddenReason` over (`lib/data/own-listings.ts`, added to the file map and to "Recheck", item 22).
- **Deleting an account didn't expire the Hub's cached counts.** Task 8 adds `hubChanged()` to D's `deleteAccount` (`lib/auth/actions.ts`, file map and "Recheck", item 22).
- **A reporter's notification needs its report's id.** Task 5's `closeReport` and `closeReportsOn` return `ClosedReport` (`id`, `reporterId`, `title`).
- **`staff-writes` also waits for `selling-writes`**, since both publish listings to Tech corner (approval 6, plan decision 21).
- **Tables' phone labels** are `aria-hidden` spans rather than CSS generated content (plan decision 20 updated), and `StaffTable.tsx` and `form-state.test.ts` joined the file map.
