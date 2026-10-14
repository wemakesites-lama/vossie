# Vossie Messaging, Reports and Notifications (Sample Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build stage E as the spec `docs/superpowers/specs/2026-10-14-messaging-design.md` describes: a signed-in student messages a seller about a listing or their shop (with a swap offer when the listing takes swaps), the two keep the conversation going, the seller marks the sale completed and the buyer confirms it; anyone signed in can report a listing, a seller or a request; and signed-in students see what needs their attention in `/notifications`, on the header's account icon, on the account page and in the homepage's strip. Everything runs on stage D's sample store, works without the app's JavaScript, and adds no client code. Tested at five screen sizes and within the JS budget.

**Architecture:**
- **Four new tables in D's sample store:** `conversations`, `messages`, `reports` and `notifications` (`lib/data/rows.ts`, `lib/data/store.ts`), seeded with two sample conversations for the sample student and Tech corner. Only `lib/data/messages.ts`, `notifications.ts` and `reports.ts` touch them, through async functions shaped like the Supabase calls that replace them, taking `now` from their caller.
- **A conversation belongs to a shop, not to an account.** It holds the shop's slug; whoever owns that shop (D's `sellerProfiles`) answers. Stage F's shops and stage G's approvals then need no change here.
- **Pages, not sheets.** The composer (`/listings/[id]/message`, `/sellers/[slug]/message`), the inbox (`/messages`), a thread (`/messages/[id]`), the report form (`/report`) and its thank-you (`/report/sent`), and `/notifications` are Server Components. Their request-time parts sit inside `<Suspense>` behind a prerendered frame.
- **Plain forms, Server Actions, redirects** (D's pattern). Every form posts to a Server Action in `lib/messaging/actions.ts`, which checks its input on the server, takes identity only from the session, keeps errors and the scam warning in D's form-state table (never the URL), and ends with `refresh()` and `redirect()`. `refresh()` is what makes the browser drop its kept copies of earlier pages (plan decision 6, checked in Next's source).
- **Links that follow the session cost nothing on the client.** The listing page's, storefront's and request page's Message and Report links render the signed-out link in the static shell, and a small Server Component streams the signed-in one in, inside `<Suspense>` (plan decision 3). The header's count is a badge drawn by D's server slot (plan decision 10).

**Tech Stack:** As stage D leaves it:
- Next.js 16.4.0 with Cache Components and Partial Prefetching, React 19.3, TypeScript 5;
- Tailwind CSS 4.3 through PostCSS;
- pnpm 10.30;
- Vitest 5 with Testing Library and jsdom 30;
- Playwright 1.64 with axe-core.

**Sources:**
- **Spec:** `docs/superpowers/specs/2026-10-14-messaging-design.md`. "Spec 2.5" in this plan means that spec's section 2, decision 5; "spec 3.1" means its section 3.1.
- **Stage D, which this builds on:** the plan `docs/superpowers/plans/2026-10-14-accounts.md` ("D's plan", "D Task 4", "D decision 3") and its spec `2026-10-14-accounts-design.md` ("accounts spec").
- **The specs that build on this one** (their needs shaped the tables): `2026-10-14-selling-design.md` (stage F: shops own listings; the dashboard counts enquiries, replies within 48 hours and confirmed sales; a deleted listing's conversations keep a note) and `2026-10-14-staff-tools-design.md` (stage G: the reports queue, notifications for report outcomes and shop approval, trust badges from first replies and confirmed sales).
- **Earlier specs** (tokens, breakpoints, motion, accessibility, budgets; the sign-in links): `2026-10-08-homepage-design.md`, `2026-10-13-browse-and-listing-design.md` (5.4 and 5.9) and `2026-10-14-community-pages-design.md` (the request page).
- **The old demo:** `docs/reference/FUNCTION-MAP.md`, sections F (messaging), H (trust and safety), I (notifications) and 6 (the limits and the 7-day auto-confirm).
- **Decisions:** `docs/reference/LANDING-DECISIONS.md`, rows 54 to 57 (57 cut the WhatsApp handoff).
- **Previous plans, for conventions and pitfalls:** D's plan, `2026-10-13-shopping-pages.md` ("Changes made during the build", especially `RefreshWhenStale` and the prefetch findings) and `2026-10-14-community-pages.md` (its amendments).

---

## Before you start

**This plan starts after stage D.** When it was written (2026-10-14), part B (Looking For and the Hub) was being built in the working tree and stage D had a plan (`4731c67`) and no code. Start only once D's Task 15 (its docs) is committed. Then work through "Recheck before starting" below before Task 1: this plan is written against D's planned file names and APIs, and the build may have changed some.

**Approvals Lama gives in chat before execution starts:**
1. **Git.** Implementers leave their work uncommitted. The controller checks each task and commits it (Lama's standing choice). `vossie-audit/` and `.superpowers/` stay out of git and untouched. `.claude/launch.json` has a change made outside this work: never stage it.
2. **Execution.** Subagent-driven, with one combined reviewer per build step (plan check first, then code quality), time-boxed. This is Lama's standing preference.
3. **Files this plan removes or moves:** none. No task runs `rm`. If something looks unused, leave it and list it in the hand-over for Lama.
4. **No new environment variables, cookies or browser-storage keys.** Messaging uses D's session and form state, so the privacy page's `vossie_…` guard has nothing new to name (plan decision 7).
5. **Sample wording.** The scam tips, the notification sentences, the empty states, the sale lines and the report reasons' help text are for Lama to change. Plan decision 26 lists where they live.

No installs are needed.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time. Never run destructive git commands, never amend, rebase or reset, never touch `.git/` internals, and never `rm` anything.
- Never kill an install or build that is still running.
- Port 3100 is Lama's dev server. Don't touch it. The e2e tests use 3200; the "looking at it" checks use 3201.
- Before you edit a shared file (`app/globals.css`, `app/layout.tsx`, `app/login/page.tsx`, `app/privacy/page.tsx`, `tests/e2e/*.spec.ts`, `docs/*`, and every file stage D created), read its current text and edit by the exact lines that are there now. Never paste back a whole list or file from an older copy. Where this plan quotes a line from D's plan and the built file says it differently, edit by meaning and note it in the hand-over.

## Recheck before starting

Stage D wasn't built when this plan was written. Before Task 1, check each item against the code, one command or file at a time, and write what you find in the ledger's "Start" row or a message to the controller. If something differs in a way a task's quoted code depends on, stop and report rather than guess.

1. **Git.** `git log --oneline -5` shows D's docs commit (Task 15) at the top, after part B's; `git status --short` shows only ` M .claude/launch.json`.
2. **The stop line and the figures.** Read `docs/PROGRESS.md` and the decisions log for the newest accepted JS figures and stop line (152,305 B when this plan was written). Decision 63 (`580d1e6`) took 528 B off every page (listing 151,710 B before D); D's header and menu slots then move every page a little. Use D's final figures and the newest stop line in the ledger. Plan for little room on the listing page whatever the figures say: decision 63's saving is a threshold effect that new code can undo.
3. **The store** (D Task 1). `lib/data/store.ts`: `SampleStore` with `accounts`, `sellerProfiles`, `consents`, `sessions`, `signInAttempts`, `codeSends`, `sampleEmails` and `formStates`; `STORE_VERSION`; `sampleStore()`, `resetSampleStore()` and a private `seedStore()`. `lib/data/rows.ts` has `AccountRow`, `SellerProfileRow` (`accountId`, `status`, `sellerSlug`, `appliedAt`) and `FormStateRow` (`key`, `sessionKey`, `form`, `errors`, `values`, `notice`, `expiresAt`). `lib/data/store.test.ts` has "is seeded with the sample accounts, their consents and their shops, and nothing else". Note the `STORE_VERSION` value: Task 1 adds one to it.
4. **The sample accounts** (D Task 1). `data/fixtures/accounts.ts`: `acc-student` (Thandi, Midrand), `acc-seller` (Sipho, approved, `tech-corner`), `acc-pending`, `acc-mentor`, `acc-admin`; the sign-in buttons "Student, Midrand" and "Seller, Tech corner".
5. **Accounts data** (D Task 3). `lib/data/accounts.ts` exports `getAccount`, `getAccountActivity(accountId)`, `exportAccountData(accountId, now)` with its `AccountExport` type, and `deleteAccountData(accountId)`; `lib/data/form-states.ts` exports `getFormState`, `saveFormState` and `clearFormState(sessionKey, form)`. `lib/data/accounts.test.ts` has "has no activity for the context strip yet…" and the export test for `acc-seller` that compares the whole object with `toEqual`. Task 5 changes both tests.
6. **The session** (D Task 4). `lib/auth/session.ts` exports `getViewer()` (React `cache`, returns `Account | null`, awaits `connection()` before its clock read), `getSessionKey()` and `requireAccount(nextPath)`. `lib/types.ts` has `Account` with `seller: { status, sellerSlug } | null`. `lib/data/viewer.ts` calls `getAccountActivity(account.id)` inside `getViewerContext`.
7. **The test helper** (D Task 4). `tests/helpers/next-request.ts` exports `FakeRequest` (`cookies`, `sent`, `proto`), `resetRequest`, `nextHeaders`, `nextNavigation`, `nextServer`, `redirectOf` and `redirectSignalOf`. Task 6 adds `nextCache` and an optional `refreshed` field.
8. **Form state and errors** (D Tasks 2, 6 and 7). `lib/auth/form-state.ts` exports `readFormState(form)` and `writeFormState(form, state, now)`; `lib/auth/config.ts` has `FORM_STATE_TTL_MS`; `lib/auth/messages.ts` exports the `FormError` type and `errorFor`; `components/forms/ErrorSummary.tsx` and `FieldError.tsx` (with `describedBy`) exist; the CSS classes `.form-stack`, `.form-field`, `.form-label`, `.form-hint`, `.form-input`, `.form-error`, `.form-summary`, `.form-notice`, `.form-submit`, `.form-check`, `.form-checkbox`, `.link-button` and `.btn-danger` exist.
9. **The header slot** (D Task 8). `components/header/AccountLink.tsx` exports `AccountLink({ signedIn })` and `HeaderAccount()`, with `aria-label` "Sign in" or "Your account", `prefetch={false}`, `className="hdr-item icon-btn"` and `style={{ "--i": 3 }}`. `app/layout.tsx` passes `<Suspense fallback={<AccountLink signedIn={false} />}><HeaderAccount /></Suspense>` as `SiteHeader`'s `account`. Task 13 changes `AccountLink`.
10. **The account pages** (D Tasks 10 and 11). `components/account/AccountView.tsx` takes `{ account, campuses, details }` and has the `account-rows` nav with Saved, the Selling row and Privacy settings; `app/account/page.tsx` has `AccountContent`. `components/account/PrivacySettingsView.tsx` takes `{ consent, deleteErrors }` and says "Once messaging and selling open, it will hold your messages, reports and listings too." and "once messaging and selling open, your messages, shop and listings go too."; `app/account/privacy/page.tsx` has `PrivacySettings`. Tasks 13 and 14 change them.
11. **The sign-in page** (D Task 7). `app/login/page.tsx`'s `SignInForVisitor` reads `next` with `safeNextPath` and shows a back link: `next.startsWith("/listings/") ? "Back to the listing" : "Go back"`. Task 7 changes it.
12. **The privacy policy** (part C, D Tasks 4 and 12). `app/privacy/page.tsx`: the `privacy-today` paragraph that starts "Vossie is still a preview."; the `privacy-sign-in` section titled "Your account" with the bullet "Your messages, swap offers and reports."; the `privacy-keep` bullets "How long messages and reports are kept will be set before messaging opens…" and "Deleting your account removes your account, your sign-in sessions and your record of consent straight away…". Task 14 edits them.
13. **How it works** (D Task 12). `app/how-it-works/page.tsx`'s answer to "What can I do on Vossie today?" now reads "…and sign in with your Eduvos email. Messaging and selling arrive in the next stages, so this page describes how they will work." Task 14 edits it.
14. **D's end-to-end tests** (D Task 13). `tests/e2e/accounts.spec.ts` has "a first sign-in from a listing asks for a name and campus, then comes back to the listing", "Back to the sign-in page after signing in shows you're signed in" and "a signed-in visitor who follows a sign-in link is told so, with the way back". All three click a Message link and expect the old target; Task 7 changes them. `tests/e2e/listing.spec.ts` ("messaging goes through the sign-in page and back") and `tests/e2e/shopping.spec.ts` ("Message goes through the sign-in page and back") check the signed-out links; Task 7 changes them.
15. **Part B's request page.** `app/looking-for/[id]/page.tsx` and `components/looking-for/RequestView.tsx` exist, with "Report this request" linking to `signInHref(\`/looking-for/${request.id}\`)` and a `RequestView.test.tsx` that checks it; `lib/data/index.ts` exports `getRequest(id)` returning a `LookingForRequest` with `title`. **If part B isn't built**, skip the request page in Task 7 and the `request` reports in Tasks 2, 6 and 11 (they're marked), and tell the controller.
16. **Time helpers.** `lib/time.ts` exports `sastDate`, `longSastDate`, part B's `shortSastDate(iso)` ("13 Oct") and D's `sastClock(iso)` ("10:42"). Task 2 appends after whatever is there and uses both.
17. **The size, axe, layout shift and screenshot tests** (D Task 14). `tests/e2e/performance.spec.ts` has D's signed-in test for `/account`; `tests/e2e/cls.spec.ts`'s `PAGES` takes a fourth value, `signedIn?: boolean`, that signs in as "Student, Midrand"; `tests/e2e/a11y.spec.ts` has D's `signInAsSample` helper. Task 16 changes the first two.
18. **Icons.** `components/icons.tsx` and its test's list of names (part B may have added some). Task 12 adds `MessageIcon` in alphabetical order.
19. **The context strip.** `components/home/ContextStripView.tsx`'s signed-in strip ends with `<Link href="/account" className="context-link">Open inbox</Link>`. Task 13 changes it.
20. **Robots.** `app/robots.ts`'s `DISALLOWED` is `["/saved", "/login", "/account", "/sell$", "/sell/"]`. Task 14 adds to it.

## Where things stand (checked against the code on 2026-10-14)

| Area | Fact |
|---|---|
| Repo | `main` at `3116b44` (part B's plan amendments). Part B is being built in the working tree; stage D has a committed plan and no code. `.claude/launch.json` is modified outside this work |
| JS | After decision 63 (`580d1e6`, Turbopack's `requestCost` merges the two small layout chunks), first visit at 390px, brotli quality 5: `/` 150,554 B, browse 151,301 B, listing 151,710 B, storefront 151,314 B. Stop line 152,305 B (decision 52). Limit 153,600 B. Before decision 63 the listing page was 152,238 B and expected at about 152,240 B after D, with about 65 B of room; the saving is a threshold effect that later code can undo (decision 63), so take D's final figures as the start and keep measuring |
| Listing page | `ListingActions` (a Server Component holding the client `SaveHeart` and `ShareButton`): an available listing's Message seller is `<Link href={signInHref(\`/listings/${id}\`)} prefetch={false} className="btn btn-primary listing-message">`; a paused or sold one shows "See similar items". `ListingView`'s footer has "Report this listing" to the same sign-in link. Below the tablet step `.listing-actions` is the fixed dock. The page is prerendered from `generateStaticParams` |
| Storefront | `SellerHero`'s "Message seller" (`btn btn-sky seller-message`) and `SellerView`'s "Report this seller" both link to `signInHref(\`/sellers/${slug}\`)` with `prefetch={false}`. Prerendered |
| Request page (part B) | `RequestView`'s "Report this request" links to `signInHref(\`/looking-for/${id}\`)`. Prerendered |
| Context strip | `ContextStripView` (client, homepage only): signed in with activity, "Welcome back", one line each for new messages, sales to confirm and saved items back, then "Open inbox" to `/account` (default prefetch) |
| Header (after D) | `SiteHeader` (client, every page) renders D's `account` slot, `AccountLink` from the server. The end group is `[search (tablet up)] [account] [Saved]`, `justify-content: flex-end`, in a `1fr auto 1fr` grid around a 64px pennant: at 360px each side has 140px, and two 44px icons and an 8px gap take 96px. `.hdr-badge` (absolute, sky, navy text) is the Saved count's |
| Store (after D) | One `SampleStore` on `globalThis`, a `Map` per table, rows in `lib/data/rows.ts`, seeded from fixtures that only `import type`. Adding a table: a row type, a field, its seed, a `STORE_VERSION` bump, a domain module, and lines in `deleteAccountData`/`exportAccountData` for personal data (D's "Store design") |
| Form state (after D) | `formStates`, keyed by session and form, 10 minutes: errors, typed values and a notice. Forms post, the action writes the state and redirects back with `RedirectType.replace`, the page reads it inside `<Suspense>` (D decisions 3 and 13) |
| Kept pages (Next 16.4 source, read for this plan) | See plan decision 6. In short: an action that calls `refresh()` or writes a cookie makes the client drop its kept pages; Back otherwise shows a kept page however old it is; a link asks the server again for dynamic parts (`staleTimes.dynamic` is 0), but the shopping build saw a kept Saved list come back by a link, so Task 15 checks it; the root layout (and so the header's count) re-renders only on a full load or an action's response |
| Sample shops | Only Tech corner has an owner account (`acc-seller`). Its listings: `l-001` (Casio fx-991ZA Plus calculator, R250, cash) and `l-007` (Gaming headset, barely used, R450 or swap, swaps for "a mechanical keyboard or a Bluetooth speaker"). `l-016` is paused and `l-026` sold. `l-002` (Book swap) has no owner |
| Time | `lib/time.ts`: `sastDate`, `sastToday`, `longSastDate`; part B adds `shortSastDate` and `sastDateTime`; D adds `sastMonthYear` and `sastClock`. Clock reads come after `await connection()` (decision 26) |
| Privacy guard | `app/privacy/page.test.tsx` fails when a `"vossie_…"` name in the code isn't on the privacy page. This plan adds none |
| e2e | One `next start` on 3200, five projects, fully parallel, one sample store for the whole run. Next keeps the last 3 pages hidden in the DOM (`<Activity>`, inline `display: none`): CSS locators count them, `getByRole` doesn't. Activity also keeps form fields' typed values |
| Icons | 21 in `components/icons.tsx` (part B may add some). No chat or bell icon |

## Plan decisions (made while planning)

Lama can veto any of these at plan review. In this plan, "plan decision N" means this list; "spec 2.N" means the spec's decisions; "D decision N" means D's plan's list; "decision N" on its own means a row in the decisions log.

1. **A conversation belongs to a shop, not to an account.** It holds the shop's slug, and whoever owns that shop in D's `sellerProfiles` answers it, looked up on every read. Stage F's shops and stage G's approvals then need nothing here. In sample mode only Tech corner has an owner; a message to any other shop is stored and waits, unread, until F or G gives that shop an owner. The buyer sees no difference.
2. **The storefront's Message asks the shop a question** (spec 3.6 says the storefront's Message works "likewise", but a storefront isn't a listing). It opens `/sellers/[slug]/message`, and the conversation has no listing: one per buyer and shop, as spec 2.2 has one per buyer and listing. The thread shows the shop where a listing would be, there's no swap field, and the sale status works the same. For stage G: the trust page calls an enquiry "a buyer's first message to a seller about a listing", so G decides whether a shop question counts.
3. **Links that follow the session** (spec 3.6). On the listing page, the storefront and the request page, Message seller and Report are each a `<Suspense>` whose fallback is the signed-out link, so the static shell has it, and whose child, a small Server Component, reads the session and streams the right link in:
   - signed out: `/login?next=` the composer (spec 2.1), or `/login?next=` the report form, so signing in lands on the form;
   - signed in: Message goes to the existing thread when there is one, otherwise the composer; Report goes to `/report?listing=…` (or `seller=`, `request=`).

   Both are Server Components rendering `Link`, which every page already loads, with `prefetch={false}`: no client bytes. Tasks 7 and 13 measure it.
4. **The sign-in page's back link goes to the page behind `next`** (`backPathFor`). With `next` set to a composer or a report form, D's "Back to the listing" would otherwise lead to a page that needs sign-in, and so back to sign-in. A composer's or report's `next` goes back to the listing, shop or request; `next` paths that need an account (`/account…`, `/messages…`, `/notifications`) get no back link. Sign-in still follows `next` itself.
5. **Messaging the same listing again** (spec 2.2). The signed-in Message link goes straight to the thread. A composer opened anyway says "You've already messaged {shop} about this." with **Open the conversation**, rather than redirecting: a redirect would trap Back between the composer and the thread. A first message posted anyway (two tabs) is added to the existing thread.
6. **Every action that writes ends with `refresh()`, then `redirect(…, RedirectType.replace)`.** Read in Next 16.4's source for this plan:
   - `refresh()` (`next/cache`; `server/web/spec-extension/revalidate.js`) marks the action as having revalidated dynamic data, and `addRevalidationHeader` (`server/app-render/action-handler.js`) runs in a `finally`, so the `x-action-revalidated` header goes out even when the action ends in `redirect()`.
   - On the client, `server-action-reducer.js` then calls `invalidateBfCache()` and navigates with `FreshnessPolicy.RefreshAll`: every kept page's data is dropped, so neither Back nor a link shows a copy from before the write. An action that neither writes a cookie nor revalidates leaves kept pages alone, and messaging's actions write no cookie.
   - The redirect's page is rendered by a separate internal request with the router state removed (`createRedirectRenderResult`), so it's drawn from the root, the header's count included, after the write.
   - Back and forward read a kept page with no age check (`segment-cache/bfcache.js` passes -1); only an invalidation drops it. A link checks its age against `staleTimes.dynamic`, which is 0 here (`render-tree.js`), so a link asks the server again. The shopping build nevertheless saw a kept Saved list come back by a link (`RefreshWhenStale`), so Task 15 tests the link path; if it fails, stop and report.
   - A full prefetch can reuse a kept page's data for 5 minutes (`attemptToFulfillDynamicSegmentFromBFCache`), which is one more reason every messaging link is `prefetch={false}`.

   So: your own posts keep every kept page right; the other person's reach you on a link, a full load or **Refresh** (plan decision 19). The redirects replace (D decision 19 pushed its final ones), so Back from a thread goes to the listing, not to a form you've just sent.
7. **No new cookies, and no flash cookie for "Sent."** Spec 3.1 asked for "Sent. Sellers usually reply within a day." from a flash cookie read on the server. A cookie can't be deleted during a render, so it would show on every load for its minute, and the homepage's `FlashToast` (D decision 12) would toast it there too. Instead the composer's action leaves the notice in D's form state under `sent:{id}`, and the thread takes it (reads and clears it) as it renders: shown once, no client code, and nothing new for the privacy page's guard.
8. **No live character count.** Spec 3.1's "a count under it" needs client code, which spec 6 rules out. The hint says "Up to 1,000 characters." (swap offers 200, report detail 500). The fields have no `maxlength`, so a long paste isn't cut short without a word: the server says "Keep it under 1,000 characters." and keeps the text for editing. Characters are counted as code points; typed text kept in form state is capped at 4,000 characters.
9. **The scam check runs on every message** (spec 2.3), the first one with its swap offer, and replies too: scams often come in a reply. Five kinds: paying in advance, bank details, a deposit, a courier and a code. A match shows "Check this before you send" with each matching tip and **Send anyway**, a second submit button (`name="anyway" value="yes"`); pressing Send again checks again. The box is a `role="alert"`, focused on a page load like D's error summary (D decision 11).
10. **The header's count is a red badge on the account icon,** not a bell (spec 2.9 says "a count on the header", not where). A third 44px icon doesn't fit the phone header at 360px: each side of the pennant has 140px, and three icons with two 8px gaps need 148px. The badge sits inside the icon's box, so nothing moves when it streams in; the link keeps its name, "Your account" (D's tests), and gains the description "2 new notifications" (`aria-describedby`). Red (`--color-danger`, white text, 6.6:1) tells it apart from Saved's sky count. The account page lists Messages and Notifications first. Lama may prefer a bell from the tablet step up.
11. **The header's count is as fresh as the last full page load or post.** Next re-renders the root layout only then: a client navigation re-renders below the layout the two pages share (`02-guides/instant-navigation.md`). On a page that marks things read (a thread, `/notifications`), the header is drawn first, so it still shows the count from before. Spec 2.6 rules out live updates, so this is the trade-off; Task 15 checks the count after a full load.
12. **One unread notification per conversation per person.** A new message updates the unread one's sentence and time instead of adding another, so a busy thread doesn't flood the list. Opening the thread marks its notifications read; opening `/notifications` marks them all read (spec 2.9). The page shows the newest 50.
13. **Notifications keep their sentence and link,** fixed when made (spec 3.5's "Tech corner replied about Casio fx-991ZA Plus calculator"), and a kind for the icon. The kinds are the spec's four: `message`, `sale-to-confirm`, `report-handled` and `shop-approved`. This stage makes the first two; stage G makes the others and needs nothing new on the page.
14. **Deleting an account** (accounts spec 2.13, POPIA) removes its messages, its notifications and its reports at once. A conversation it was part of stays for the other person, with only that person's own messages, the deleted side shown as "Deleted account", and no reply form; a conversation with neither side left goes. Notifications about those conversations go too, since they name the deleted person. The conversation's times (asked, first reply, confirmed) stay with the seller's side for the trust badges.
15. **The data export** (accounts spec 3.3) gains `conversations` (the other side's name, what it was about, the status, and every message from both sides marked "you" or "them"), `reports` and `notifications`. No ids, as D's export.
16. **Two sample conversations** in the store's seed, both Thandi's (the sample student) with Tech corner (the sample seller): one about the headset, with a swap offer and Sipho's reply still unread; one about the calculator, which Sipho marked done and Thandi hasn't confirmed. Thandi starts with 1 new message, 2 new notifications and 1 sale to confirm, so her badge, strip, inbox and notifications have something to show. Sipho's Selling tab has both. Tests only read them (D decision 22): the sample seller's reads change nothing, because Thandi's messages are already read, and the two axe checks that open a thread or `/notifications` as Thandi only mark her sample notifications read, which no test counts. The seeds have fixed dates, so the calculator sale confirms itself on 20 October 2026: any test that needs a sale to confirm makes its own conversation.
17. **Reports.** One per account per target while it's open: a repeat goes straight to the thank-you and stores nothing. At most 10 a day per account: "You've sent 10 reports today. Try again tomorrow." The thank-you is its own page, `/report/sent?listing=…`, so reloading it doesn't bring back the form. A report keeps the target's title for stage G's queue, in case the target has gone by then.
18. **Privacy settings gain "Reports you've made"** (GO-LIVE section 2; FUNCTION-MAP H5): what, why, when, and whether it's open.
19. **Refresh is a plain `<a>`,** a full page load, by the thread's header (spec 2.6) and on the inbox: the one way to be sure a kept page asks the server again, with no client code.
20. **The reply form starts empty after a send.** Activity keeps a textarea's typed text when the same page is drawn again, so the form's `key` is the number of messages: a new message gives a new form.
21. **A thread whose other side has left** says "The other person has left Vossie, so you can't reply." instead of the reply form, and the seller sees no Mark as completed.
22. **The inbox's tabs are links** (spec 2.10) with `aria-current="page"` on the open one. Selling shows when the account has a shop with a storefront (approved or paused; a shop waiting for approval has none). `?tab=selling` without one shows Buying.
23. **End to end, each test makes its own buyer and conversation.** Every test shares one server and one store, so a test signs up a fresh buyer (a new email and a first name like "Buyer k3x9qa"), and the seller is the sample "Seller, Tech corner" in a second browser context, who only replies to, and marks completed, the test's own conversation, found in Selling by the buyer's name. No test checks the sample seller's counts, which every test running alongside changes. There's no test-only route to make a seller: stage F isn't built, and such a route would ship in production.
24. **Robots and search engines.** `/messages`, `/notifications`, `/report`, `/listings/*/message` and `/sellers/*/message` join `robots.txt`'s `DISALLOWED`, and every new page is `noindex`, like D's account pages.
25. **The new dynamic routes export `generateStaticParams` with one sample** (CLAUDE.md), so the build checks that their request-time parts sit inside `<Suspense>`; every other id renders the shell on first request. `/messages/[id]`'s sample, `conv-sample`, matches no conversation.
26. **Wording the spec doesn't give** (Lama may change it):
    - the three tips beside the composer and the five scam tips (`lib/messaging/scam-check.ts`);
    - the notification sentences (`lib/messaging/notification-text.ts`): "{Name} asked about {title}", "{Name} replied about {title}", "{Name} asked your shop a question", "{Name} replied", "{Shop} marked {title} as done. Did the sale happen?";
    - the errors "Keep your swap offer under 200 characters.", "Choose a reason.", "Keep it under 500 characters." and the report limit (`lib/messaging/errors.ts`);
    - the composer's notes: "This is your listing, so you can't message yourself.", "This listing isn't available right now, so it can't be messaged.", "You've already messaged {shop} about this.";
    - the sale lines on the thread, the inbox's Selling empty state ("No enquiries yet. When a buyer messages your shop, it shows up here."), "Report sent" as the thank-you's heading (its sentence is the spec's), the reasons' legend "Why are you reporting it?", the detail's hint, and "You've reported this {kind} already.";
    - the privacy policy's and privacy settings' new sentences (Task 14).
27. **How long messages are kept is Eduvos's call.** Part C's policy promised a period "before messaging opens". The preview keeps everything in the server's memory, wiped when it restarts, and the policy says so, and that Eduvos sets the periods before launch (a go-live item).
28. **Times, in SAST** (spec 3.2): the inbox shows "14:05" today, "Mon" in the six days before, "12 Oct" earlier this year and "12 Oct 2025" before that; a message shows "14:05" today, otherwise "12 Oct, 14:05".
29. **Message text** (spec 2.12): `\r\n` becomes `\n`; control characters other than line breaks and tabs are dropped; the ends are trimmed. It renders as React text with `white-space: pre-wrap`, so line breaks stay and nothing is HTML; links aren't made clickable.
30. **The sale rules** (spec 2.5), all in `lib/data/messages.ts`:

    | From | Who | To |
    |---|---|---|
    | Asked | the seller replies | Replied, and the first reply's time is kept |
    | Replied | the seller presses Mark as completed | Done, with its time; the buyer gets a "sale to confirm" notification |
    | Done | the buyer presses Confirm the sale | Confirmed, by the buyer |
    | Done | the buyer presses It didn't happen | Replied; the completion is forgotten and doesn't count |
    | Done | 7 days pass | Confirmed, automatically, dated 7 days after Done |

    The 7 days are checked whenever the conversation is read: the inbox, the thread and the counts. Anything else (a seller confirming, a buyer marking completed, a second Mark as completed) changes nothing.

## Amendments on review

The controller adds amendments here; they override the tasks below wherever they differ.

1. **Error summaries need their own id** (D's review, `17dd972`). `ErrorSummary` takes a required `id` prop, and its heading's id is `${id}-title`, because Next keeps earlier pages in the DOM and ids must be unique across them. Every form this plan adds passes its own: the composer `composer-summary`, the thread's reply `thread-reply-summary`, the report form `report-summary` (and any other form, `<page>-<form>-summary`). Each task that adds one also adds that form to `components/forms/summary-ids.test.tsx`, which renders every form at once and checks no id repeats.
2. **The request page's report link** (recheck item 15). `RequestView` keeps `signInHref(…)` in a local `const signIn` used by both its links; Task 7 edits by meaning.
3. **The review of Tasks 1 to 5** (Claude, under decision 54). The built code matched the plan; these change the plan's own code, in one fix commit after Task 7:
   1. **A sale nobody can dispute doesn't count.** `markCompleted` refuses (`"not-allowed"`) when the buyer has left. Deleting a buyer whose sale is Done puts it back to Replied and forgets the completion, so it never confirms itself.
   2. **The scam check catches more ways to say it.** Paying in advance also matches "before" (with first, upfront, in advance), "transfer", "cash send" and "eWallet" on its own; bank details also match "bank account" and "bank acc". "I'll pay cash when I see it." still passes.
   3. **Plan decision 12 is about messages.** It allows one unread *message* notification per conversation per person; a sale to confirm is its own notification. When the sale is confirmed (by the buyer or by itself) or rejected, its sale-to-confirm notification is marked read.
   4. **"Asked" until someone replies.** A buyer's second message before any reply notifies the seller as "{Name} asked about {title}", not "replied".
   5. **`cleanText` drops invisible and direction-changing characters:** U+202A–U+202E, U+2066–U+2069, U+200B, U+200E, U+200F, U+2060 and U+FEFF. It keeps U+200D (emoji need it). A message of only those counts as empty.
   6. **Comments say what's counted:** code points (plan decision 8), so an emoji family counts as several.
   7. **The report limit says what it counts:** "You've sent 10 reports in the last 24 hours. Try again later."
   8. **Deletion clears `readAt`** on the other side's remaining messages: it was when the deleted person read them. A conversation a deletion leaves empty still goes; its shop couldn't reply to it anyway.
   9. **The deleted side** (spec 9.8, amended to match): names show as "Deleted account", and the thread's note says "This person has left Vossie, so you can't reply." Tasks 9 and 10 use these words, in place of plan decision 21's "The other person has left Vossie…".
   10. **The export runs the auto-confirm first,** so it never says "done" for a sale that has confirmed itself.
   11. **The account export test is strict again:** apart from the three new keys, the rest is compared with `toEqual`.
4. **What "works without JavaScript" means** (found in Task 8). Next reveals streamed `<Suspense>` content with a small inline script. With JavaScript turned off in the browser, the request-time parts (the composer's form included) stay on their skeletons. The plan's promise holds for the case it was made for: the app's bundle failing or blocked, which the e2e tests check. Task 17 adds this to `docs/PROGRESS.md`'s open points, and to the go-live checklist's quality items ("decide whether a browser with JavaScript off needs the forms").
5. **Field ids are unique per item, not just per page type** (found in Task 10). Next keeps the last pages hidden in the DOM, and two of the same page type (two threads, or composers for two listings) can be there at once. A `<label for>` and an error summary's `#field` link go to the *first* element with that id, which may be on the hidden page. So the composer's and the thread's field ids, and the ids their hints and errors join through `aria-describedby`, end with the item they belong to: `composer-message-l-001`, `composer-swap-l-001`, `composer-message-tech-corner` (a shop question), `thread-reply-conv-s1`, and so on. Section headings' ids may stay per page type, since a hidden copy's heading has the same words. Task 11's report form, which also repeats per target, follows the same rule (`report-reason-listing-l-001`). A test renders two of each page's views side by side and checks that every `for`, `href="#…"` and `aria-describedby` points to an element in its own view.
6. **The review of Tasks 6 to 11** (Claude, under decision 54). One fix commit after Task 13:
   1. **A report form starts empty for each target.** `/report?listing=A` and `/report?seller=B` are one page to Next's router, so the kept form would carry A's reason and detail into B's. The form's `key` names its target (as plan decision 20 keys the reply form), and a test renders the form for A, picks a reason and types a detail, rerenders for B, and expects nothing picked and an empty detail. Task 15 adds an end-to-end check: report one listing, then another in the same page session.
   2. **A sale nobody can dispute doesn't count, from either side.** When a seller's account is deleted while a sale is Done, it goes back to Replied with its completion forgotten, as for a buyer (amendment 3.1). The buyer sees no sale buttons when the seller has left, and `confirmSale` and `rejectSale` refuse when the seller has gone.
   3. **Every link this plan adds has `prefetch={false}`,** calls to action included: the composer's See similar items, the inbox's Browse and the report thank-you's homepage link.
   4. **The composer offers the conversation first.** A buyer who already has a conversation about a listing that has since been paused or sold sees "You've already messaged {shop} about this." with **Open the conversation**, not "isn't available".
   5. **Small fixes:** the report action's comment says "in 24 hours"; the report reason's error id comes from `reportFields()` with the others; `LinkProps` is declared once and imported.

## Store design

The four tables, how they fit D's store, and what stages F and G add:

- **`conversations`** (by id): the listing (or none, plan decision 2), the listing's title when it started, the shop's slug, the buyer (or null once deleted), whether the seller has left, the status, and the times: started, last message, first reply, completed, confirmed (with "buyer" or "auto"). Stage F's dashboard counts enquiries, replies within 48 hours and confirmed sales from these; its deleted listings leave the title behind (selling spec 9). Stage G's badges and mentor flags read the same times.
- **`messages`** (by id): the conversation, which side sent it (`buyer` or `seller`), the body, the swap offer (first message only), when it was sent and when the other side read it.
- **`reports`** (by id): the reporter, the target (`listing`, `seller` or `request`, and its id), the target's title then, the reason, the detail, `open` or `closed`, and when. Stage G adds what was done, by whom and when.
- **`notifications`** (by id): the account, the kind, the subject's id (a conversation, a report, a shop), the sentence, the link, when, and when read. Stage G adds rows of its own kinds.
- **Seeds:** `data/fixtures/messages.ts` (types only, like every fixture), copied by `seedStore()`. `STORE_VERSION` goes up by one.
- **Only three modules touch them:** `lib/data/notifications.ts`, `lib/data/messages.ts` (which imports notifications) and `lib/data/reports.ts`. `lib/data/accounts.ts` imports from them for the context strip, the export and deletion; none of them imports `accounts.ts`, so there's no import cycle. They read `accounts` and `sellerProfiles` straight from the store for names and owners.

## The JS ledger

- **Limit:** 153,600 B (brotli, quality 5) on a first visit at 390px, for each page.
- **Stop rule (spec 6):** if any page passes **the stop line Lama last accepted (152,305 B when this plan was written; use the newer figure from "Recheck" item 2 if there is one)**, stop after that task and report the figures. Don't cut features to fit; that's Lama's decision.
- **Where bytes move:**
  - Tasks 1 to 6 add no client code.
  - **Task 7 changes the listing page, the storefront and the request page** (Server Components only: a `<Suspense>` and a `Link` each for Message and Report). Expect no change beyond a few bytes; treat the listing page as having little room ("Recheck" item 2). Task 7 measures right after.
  - Tasks 8 to 12 add pages with no client code beyond the shell.
  - **Task 13 changes D's header slot** (`AccountLink`, a Server Component: a badge `<span>`) **and the homepage's `ContextStripView`** (a client component: a new `href` and `prefetch={false}`). Expect the homepage to move by a few bytes and nothing else. Task 13 measures every page right after.
- **Recording.** `tests/e2e/performance.spec.ts` prints each page's `scriptBrotli`. Tasks 7, 13 and 17 run it at 390px and put the figures in their commit messages; Task 16 adds the messaging pages, measured signed in.

**As built** (fill in during the build):

| Point | `/` | `/browse` | Listing | Storefront | Request | Inbox | Thread | Composer |
|---|---|---|---|---|---|---|---|---|
| Start (D's final figures, measured again at `f7e1bee`) | 150,614 | 151,361 | 151,770 | 151,374 | 151,090 | n/a | n/a | n/a |
| Task 7, the session links | 150,614 | 151,361 | 151,770 | 151,374 | 151,090 | n/a | n/a | n/a |
| Task 13, the header's badge and the strip | 150,613 | 151,360 | 151,769 | 151,373 | 151,089 | n/a | n/a | n/a |
| **Final (Task 17)** | | | | | | | | |

The stop line used: 152,305 B (decision 52). Unit tests at the start: 978 (153 files). End to end at the start: 734 pass, 541 skipped (D's final run, `docs/PROGRESS.md`). The storefront's and request page's start figures weren't in PROGRESS; they were measured at `f7e1bee` with `performance.spec.ts` (sign-in 150,614 B and account 150,614 B match D's). The highest page is the listing page, 535 B under the stop line.

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there.
- **Code style.** TypeScript, double quotes, semicolons, 2-space indent, lines up to about 120 characters, and comments in plain English. There's no formatter: match the file you're in.
- **Server or client.** Server Components unless a file starts with `"use client"`. This plan adds **no** client component and changes one: `ContextStripView`'s link (Task 13). Plain `lib/` modules have no directive. `lib/messaging/actions.ts` starts with `"use server"`: everything it exports must be an async function (types are fine; constants are not).
- **Next APIs.** Before using a Next API this plan names, read its page in `node_modules/next/dist/docs/01-app/` (AGENTS.md). This plan uses:
  - Server Actions in forms, `refresh()` and `redirect()`/`RedirectType`: `02-guides/server-actions.md`, `02-guides/forms.md`, `03-api-reference/04-functions/refresh.md`, `redirect.md`, `03-api-reference/01-directives/use-server.md`;
  - `connection()`: `03-api-reference/04-functions/connection.md`;
  - `notFound()`: `03-api-reference/04-functions/not-found.md` ("Calling notFound() after streaming has started");
  - dynamic routes and `generateStaticParams` with Cache Components: `03-api-reference/03-file-conventions/dynamic-routes.md` ("With Cache Components"), `03-api-reference/04-functions/generate-static-params.md`;
  - the session behind `<Suspense>`: `02-guides/authentication-with-cache-components.md`;
  - kept pages: `02-guides/preserving-ui-state.md`.

  The first task that uses one says so in its first step.
- **Breakpoints.**
  - `wide:` is tablet and up; `desk:` is desktop. Never use `md:`, `lg:` or `sm:`.
  - In CSS, write `@media (min-width: 48rem) and (min-height: 30rem)` and `@media (min-width: 64rem) and (min-height: 30rem)`. Landscape phones are `@media (orientation: landscape) and (max-height: 29.99rem)`.
- **Page padding.** `.page` and the page's own class (`.composer-page`, `.inbox-page`, `.thread-page`, `.report-page`, `.notes-page`) sit on one element, so the page class's padding *replaces* `.page`'s gutter. Write the whole content edge: 16px on phones, 40px from the tablet step.
- **Effects.** None in this plan.
- **Headings.** One H1 per page. Sections are `<section aria-labelledby="…">` with one H2, visible or `sr-only`. Ids are unique across pages (`composer-…`, `inbox-…`, `thread-…`, `report-…`, `notes-…`), because Next keeps earlier pages hidden in the DOM.
- **Request-time parts.** Anything that reads cookies, headers, `params`, `searchParams` or the clock sits inside `<Suspense>`. Clock reads come after `await connection()` (decision 26). No `Date.now()`, `new Date()`, `Math.random()` or `crypto.random*` while prerendering: new ids are made only in Server Actions. There's no `try`/`catch` round JSX: the React Compiler lint rejects it.
- **Data functions** take `now` from their caller, never read the clock, and hand out copies (D's "Store design").
- **Server Actions.** Read every field with `text(formData, name)` (a missing field or a file is `""`). Never take identity from a field: the account comes from `requireAccount()`. Check every id from a field against its pattern and the store. Call `redirect()` outside any `try`. Every write ends with `done(path)` (`refresh()`, then a `replace` redirect, plan decision 6).
- **Forms.** Plain `<form action={serverAction} noValidate>`: `noValidate` so the server's messages show rather than the browser's bubbles; fields keep `required` where they're required, so it's announced. Every field has a `<label>` (a `<legend>` for the reasons); hints and errors join `aria-describedby`; an invalid field has `aria-invalid="true"`. Errors use D's `ErrorSummary` and `FieldError`.
- **User text.** Message bodies, swap offers, report details, names and titles are React text, never `dangerouslySetInnerHTML`, and links in them aren't made clickable (spec 2.12).
- **Async components in tests.** jsdom can't render an async component inside a tree. Render `await Thing(props)` directly, or stand the async part in with `vi.mock`. Components that contain the session links mock `@/components/messages/ViewerLinks` with `tests/helpers/viewer-links.tsx` (Task 7).
- **Server code in tests.** Use D's `tests/helpers/next-request.ts` for `next/headers`, `next/navigation`, `next/server` and, from Task 6, `next/cache`; call `resetSampleStore()` and `resetRequest(request)` in `beforeEach`. Fake only the date: `vi.useFakeTimers({ toFake: ["Date"] })`, then `vi.setSystemTime(…)`.
- **JSX text.** The `react/no-unescaped-entities` rule is on: write `&apos;` for an apostrophe inside JSX text (a string in an attribute, a prop or `{"…"}` is fine). JSX drops the space at a line break next to a tag, so end a text line with `{" "}` when the next line starts with a tag.
- **Links.** Pages on this site use `Link` from `next/link`, with `prefetch={false}` on every link this plan adds (CLAUDE.md, decision 53, plan decision 6). A plain `<a href>` is for Refresh (plan decision 19), a `#` jump and other websites. `@next/next/no-html-link-for-pages` doesn't fire in this repo: add no `eslint-disable` comment.
- **Accessible names.** Name computation trims each element's own text, so put spaces outside `sr-only` spans. Icons from `components/icons.tsx` are `aria-hidden`.
- **Contrast.**
  - Sky never carries text, icons or thin borders on white. Links on white are sky-dark; on panel and pale they're navy.
  - Your own message bubbles are navy with white text; theirs are panel with ink text (spec 3.3).
  - Danger red is 6.6:1 on white, and white on it is 6.6:1.
- **Motion.** Animate only `transform`/`opacity`. Hover effects only under `(hover: hover) and (pointer: fine)`. This plan adds no animation.
- **Tap targets.** At least 44 × 44px, with 8px between targets. Links inside a paragraph are exempt (WCAG 2.5.8).
- **Class names.** New classes start with `composer-`, `inbox-`, `thread-`, `report-`, `notes-`, `msg-`, `status-pill` or `hdr-badge-alert`. Before adding one, check it isn't taken: `grep -n "\.<name>\b" app/globals.css`.
- **CSS placement.**
  - New CSS goes at the end of `app/globals.css`, inside `@layer components`, under a banner: `/* --- Messaging: <name> (messaging plan, Task N, spec x) --- */`.
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
  listings/[id]/message/page.tsx               + the composer for a listing (Task 8)
  sellers/[slug]/message/page.tsx              + the composer for a question to a shop (Task 8)
  messages/page.tsx                            + the inbox (Task 9)
  messages/[id]/page.tsx                       + a thread (Task 10)
  report/page.tsx  report/sent/page.tsx        + report and its thank-you (Task 11)
  notifications/page.tsx                       + (Task 12)
  login/page.tsx                               ~ the back link (Task 7)
  account/page.tsx                             ~ the counts for the Messages and Notifications rows (Task 13)
  account/privacy/page.tsx                     ~ reports you've made (Task 14)
  privacy/page.tsx  page.test.tsx              ~ messages, reports, notifications (Task 14)
  how-it-works/page.tsx  safety/page.tsx       ~ one sentence each (Task 14)
  robots.ts  robots.test.ts                    ~ (Task 14)
  globals.css                                  ~ messaging banners (Tasks 8 to 14)
components/
  icons.tsx  icons.test.tsx                    ~ MessageIcon (Task 12)
  messages/SessionLinks.tsx  ViewerLinks.tsx  (+ tests)                                 + (Task 7)
  messages/MessageSummary.tsx  SafetyTips.tsx  ScamCheck.tsx  MessageField.tsx  parts.test.tsx   + (Task 8)
  messages/ComposerView.tsx  Composer.tsx  ComposerSkeleton.tsx  (+ tests)              + (Task 8)
  messages/StatusPill.tsx  InboxView.tsx  Inbox.tsx  InboxSkeleton.tsx  (+ tests)       + (Task 9)
  messages/SaleActions.tsx  ThreadView.tsx  OpenThread.tsx  ThreadSkeleton.tsx  (+ tests)   + (Task 10)
  messages/ReportView.tsx  Report.tsx  ReportSentBack.tsx  ReportSkeleton.tsx  (+ tests)    + (Task 11)
  messages/NotificationsView.tsx  Notifications.tsx  (+ tests)                          + (Task 12)
  listing/ListingActions.tsx  ListingView.tsx  (+ tests)       ~ the session's links (Task 7)
  seller/SellerHero.tsx  SellerView.tsx  (+ tests)             ~ the session's links (Task 7)
  looking-for/RequestView.tsx  RequestView.test.tsx            ~ the report link (Task 7)
  header/AccountLink.tsx  AccountLink.test.tsx                 ~ the badge (Task 13)
  account/AccountView.tsx  AccountView.test.tsx                ~ Messages and Notifications rows (Task 13)
  account/PrivacySettingsView.tsx  PrivacySettingsView.test.tsx ~ words, reports you've made (Task 14)
  home/ContextStripView.tsx  ContextStrip.test.tsx             ~ Open inbox (Task 13)
lib/
  types.ts                                     ~ messaging types (Task 1)
  time.ts  time.test.ts                        ~ inboxTime, messageTime (Task 2)
  messaging/rules.ts  scam-check.ts  paths.ts  errors.ts  notification-text.ts  (+ tests)  + (Task 2)
  messaging/subjects.ts  form-state.ts  actions.ts  (+ tests)                            + (Task 6)
  messaging/links.ts  links.test.ts            + (Task 7)
  data/rows.ts  store.ts  store.test.ts        ~ four tables (Task 1)
  data/notifications.ts  notifications.test.ts + (Task 3)
  data/messages.ts  messages.test.ts           + (Task 4)
  data/reports.ts  reports.test.ts             + (Task 5)
  data/accounts.ts  accounts.test.ts           ~ activity, export, deletion (Task 5)
  data/viewer.ts                               ~ the activity's clock (Task 5)
data/fixtures/
  messages.ts  messages.test.ts                + (Task 1)
tests/helpers/next-request.ts                  ~ nextCache (Task 6)
tests/helpers/viewer-links.tsx                 + (Task 7)
tests/helpers/fakes.ts                         ~ makeSummary, makeThread (Tasks 9 and 10)
tests/e2e/
  listing.spec.ts  shopping.spec.ts  accounts.spec.ts   ~ the new link targets (Task 7)
  helpers/messaging.ts  messaging.spec.ts      + (Task 15)
  routes.spec.ts                               ~ the new pages need sign-in (Task 15)
  a11y.spec.ts  cls.spec.ts  performance.spec.ts        ~ (Task 16)
  screenshots.spec.ts                          ~ (Task 17)
docs/PROGRESS.md  docs/progress/messaging/  docs/reference/GO-LIVE.md  docs/reference/LANDING-DECISIONS.md
CLAUDE.md  the spec  this plan                 ~ / + (Task 17)
```

Each `*.test.ts(x)` sits next to the file it tests.

## Where each spec decision is built

| Spec | Built in |
|---|---|
| 2.1 The composer is a page | Tasks 6 and 8; the listing's link in Task 7 |
| 2.2 One conversation per buyer and listing | Task 4 (`startConversation`), Tasks 7 and 8 (plan decision 5) |
| 2.3 Scam tips and the server's check | Task 2 (the words), Task 6 (the check), Task 8 (tips and warning), Task 10 (replies) |
| 2.4 Swap offers in the first message | Tasks 4, 6, 8 and 10 |
| 2.5 Sale status, auto-confirm, It didn't happen | Task 4 (plan decision 30), Task 6, Task 10 |
| 2.6 No live updates, a Refresh link | Task 6 (plan decision 6), Tasks 9 and 10 (plan decision 19), Task 15 |
| 2.7 No WhatsApp handoff | Task 17 (the checklist row closes) |
| 2.8 Reports are pages, need sign-in | Tasks 5, 6, 7 and 11 |
| 2.9 Notifications and the header's count | Tasks 3, 12 and 13 (plan decisions 10 to 13) |
| 2.10 The inbox's tabs | Task 9 |
| 2.11 Names | Task 4 (who sees what), Tasks 9 and 10 |
| 2.12 Plain text | Task 2 (`cleanText`), Tasks 8 and 10 |
| 3.1 The composer | Task 8 |
| 3.2 The inbox | Task 9 |
| 3.3 A thread | Task 10 |
| 3.4 Report | Task 11 |
| 3.5 Notifications | Task 12 |
| 3.6 Changes to existing pages | Task 7 (listing, storefront, request page), Task 13 (account page, strip) |
| 4 Data | Tasks 1 to 5 |
| 5 Accessibility | Tasks 8 to 12; axe in Task 16 |
| 6 Performance | Tasks 7, 13 and 16 |
| 7 Testing | Unit tests in every task; end to end in Task 15; axe, size, layout shift and screenshots in Tasks 16 and 17 |
| 8 Not in this stage | Task 17 (the checklist) |

---

### Task 1: Messaging types, the sample conversations and the store's tables

The shapes the rest of the plan uses, two sample conversations (plan decision 16), and the four tables in D's store (spec section 4, "Store design"). Nothing uses them yet.

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/data/rows.ts`
- Create: `data/fixtures/messages.ts`, `data/fixtures/messages.test.ts`
- Modify: `lib/data/store.ts`, `lib/data/store.test.ts`

- [ ] **Step 1: Record where things start**

Work through "Recheck before starting" first. Then run, one after another: `git status --short`, `pnpm test`, `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`.
Expected: `git status` shows only ` M .claude/launch.json`. Note the unit test count and the `scriptBrotli` figures for the homepage, browse, the listing page, the storefront and (if part B is built) the request page, and write them, the e2e counts from `docs/PROGRESS.md` and the stop line you'll use into the ledger's "Start" row. If a page is already past the stop line, stop here and report.

- [ ] **Step 2: Add the messaging types**

Append to the end of `lib/types.ts`:

```ts

// --- Messaging (messaging plan, Task 1) -------------------------------------------------------------------------

/** Where a conversation stands (messaging spec 2.5): asked, the seller replied, marked done, the sale confirmed. */
export type ConversationStatus = "asked" | "replied" | "done" | "confirmed";

/** The inbox's two tabs (messaging spec 2.10). */
export type InboxTab = "buying" | "selling";

/** Why something was reported (messaging spec 2.8). */
export type ReportReason = "scam" | "prohibited" | "misleading" | "offensive" | "harassment" | "spam" | "other";

/** What can be reported: a listing (by id), a seller (by slug) or a request (by id) (messaging spec 2.8). */
export type ReportTarget = { kind: "listing" | "seller" | "request"; id: string };

/** What a notification is about (messaging spec 2.9). This stage makes the first two; stage G makes the others. */
export type NotificationKind = "message" | "sale-to-confirm" | "report-handled" | "shop-approved";

/** The shop a conversation is with, as a thread shows it. `image` and `campusSlug` are null once the shop has gone. */
export type ConversationShop = {
  slug: string;
  name: string;
  image: ImageRef | null;
  campusSlug: string | null;
};

/** A row in the inbox (messaging spec 3.2), from the viewer's side. */
export type ConversationSummary = {
  id: string;
  role: "buyer" | "seller";
  /** The shop's name to the buyer, the buyer's first name to the seller (spec 2.11), or "Deleted account". */
  otherName: string;
  /** The listing's title, or null for a question about the shop (messaging plan decision 2). */
  listingTitle: string | null;
  /** The listing's photo, or the shop's for a question about the shop. Null once the listing has gone. */
  image: ImageRef | null;
  /** The last message's first line. */
  preview: string;
  lastFromViewer: boolean;
  /** ISO 8601 in UTC. */
  lastMessageAt: string;
  status: ConversationStatus;
  /** The other side has written something the viewer hasn't opened. */
  unread: boolean;
};

/** One message in a thread (messaging spec 3.3). */
export type ThreadMessage = {
  id: string;
  fromViewer: boolean;
  /** "You", or the other side's name (messaging spec section 5). */
  author: string;
  body: string;
  swapOffer: string | null;
  sentAt: string;
};

/** A thread, from the viewer's side (messaging spec 3.3). */
export type Thread = {
  id: string;
  role: "buyer" | "seller";
  otherName: string;
  /** False once the other side has deleted their account (messaging plan decision 21). */
  otherPresent: boolean;
  shop: ConversationShop;
  /** The listing's title when the conversation started, or null for a question about the shop. */
  listingTitle: string | null;
  /** The listing as it is now: null for a question about the shop, or once the listing has gone (stage F). */
  listing: Listing | null;
  status: ConversationStatus;
  completedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: "buyer" | "auto" | null;
  /** Oldest first. */
  messages: ThreadMessage[];
};

/** A notification as `/notifications` shows it (messaging spec 3.5). */
export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  text: string;
  href: string;
  createdAt: string;
  /** Not read before this visit. */
  isNew: boolean;
};

/** One of the account's reports, for privacy settings (messaging plan decision 18). */
export type ReportSummary = {
  kind: ReportTarget["kind"];
  title: string;
  reason: ReportReason;
  createdAt: string;
  open: boolean;
};

/** What needs the account's attention (messaging spec 4, `unreadCounts`). */
export type UnreadCounts = {
  /** New notifications: the header's badge and the account page. */
  notifications: number;
  /** Conversations with a message the account hasn't opened: the account page's Messages row. */
  conversations: number;
  /** Messages the account hasn't opened: the homepage's strip. */
  messages: number;
  /** Sales a seller marked done that the account, as the buyer, hasn't confirmed: the strip. */
  salesToConfirm: number;
};
```

- [ ] **Step 3: Add the row types**

In `lib/data/rows.ts`, replace `import type { SellerStatus, StaffRole } from "@/lib/types";` with:

```ts
import type {
  ConversationStatus,
  NotificationKind,
  ReportReason,
  ReportTarget,
  SellerStatus,
  StaffRole,
} from "@/lib/types";
```

Then append to the end of the file:

```ts

// --- Messaging (messaging plan, Task 1; "Store design") ------------------------------------------------------------

/** A conversation between a buyer and a shop (messaging spec 2.2 and 4; plan decisions 1 and 2). */
export type ConversationRow = {
  id: string;
  /** The listing it's about, or null for a question about the shop. */
  listingId: string | null;
  /** The listing's title when it started, kept for when the listing has gone (selling spec 9). Null for a question. */
  listingTitle: string | null;
  /** The shop. Whoever owns it (sellerProfiles) answers for it. */
  sellerSlug: string;
  /** The buyer's account, or null once they've deleted it (plan decision 14). */
  buyerId: string | null;
  /** True once the shop's owner has deleted their account: no one answers for the shop here any more. */
  sellerGone: boolean;
  status: ConversationStatus;
  createdAt: string;
  lastMessageAt: string;
  /** The seller's first reply, for the 48-hour response rate (trust page, stage G). */
  firstReplyAt: string | null;
  /** When the seller marked it completed. Cleared when the buyer says it didn't happen. */
  completedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: "buyer" | "auto" | null;
};

/** One message (messaging spec 4). */
export type MessageRow = {
  id: string;
  conversationId: string;
  /** Which side sent it. */
  from: "buyer" | "seller";
  /** Plain text, line breaks kept (spec 2.12). */
  body: string;
  /** A swap offer, sent with a buyer's first message (spec 2.4). */
  swapOffer: string | null;
  sentAt: string;
  /** When the other side opened the thread after it arrived. */
  readAt: string | null;
};

/** A report, for stage G's queue (messaging spec 3.4). */
export type ReportRow = {
  id: string;
  reporterId: string;
  targetKind: ReportTarget["kind"];
  /** A listing's id, a seller's slug or a request's id. */
  targetId: string;
  /** What the target was called when it was reported, in case it has gone by the time the Hub looks. */
  targetTitle: string;
  reason: ReportReason;
  /** Up to 500 characters; "" when none was given. */
  detail: string;
  /** Stage G closes it and records what was done. */
  status: "open" | "closed";
  createdAt: string;
};

/** A notification (messaging spec 2.9 and 3.5; plan decisions 12 and 13). */
export type NotificationRow = {
  id: string;
  accountId: string;
  kind: NotificationKind;
  /** What it's about: a conversation's id for messages and sales, a report's id, a shop's slug. */
  subjectId: string;
  /** The sentence, fixed when it was made. */
  text: string;
  /** Where it leads. */
  href: string;
  createdAt: string;
  readAt: string | null;
};
```

- [ ] **Step 4: Write the sample conversations' test**

Create `data/fixtures/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sampleAccounts } from "./accounts";
import { listings } from "./listings";
import { sampleConversations, sampleMessages, sampleNotifications } from "./messages";

const listingsById = new Map(listings.map((listing) => [listing.id, listing]));
const accountIds = new Set(sampleAccounts.map(({ account }) => account.id));
const owners = new Map(
  sampleAccounts.flatMap(({ seller }) => (seller?.sellerSlug ? [[seller.sellerSlug, seller.accountId] as const] : [])),
);
const unique = (ids: readonly string[]) => new Set(ids).size === ids.length;

describe("sample conversations (messaging plan decision 16)", () => {
  it("has unique ids in every table", () => {
    expect(unique(sampleConversations.map((row) => row.id))).toBe(true);
    expect(unique(sampleMessages.map((row) => row.id))).toBe(true);
    expect(unique(sampleNotifications.map((row) => row.id))).toBe(true);
  });

  it("puts a sample buyer and an owned shop on a real listing, keeping its title", () => {
    for (const conversation of sampleConversations) {
      const listing = listingsById.get(conversation.listingId ?? "");
      expect(listing, conversation.id).toBeDefined();
      expect(conversation.listingTitle, conversation.id).toBe(listing!.title);
      expect(conversation.sellerSlug, conversation.id).toBe(listing!.sellerSlug);
      expect(accountIds.has(conversation.buyerId ?? ""), conversation.id).toBe(true);
      expect(owners.has(conversation.sellerSlug), conversation.id).toBe(true);
      expect(owners.get(conversation.sellerSlug), conversation.id).not.toBe(conversation.buyerId);
    }
  });

  it("starts each conversation with the buyer's message and keeps its times in step with its messages", () => {
    for (const conversation of sampleConversations) {
      const messages = sampleMessages
        .filter((message) => message.conversationId === conversation.id)
        .sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
      expect(messages[0].from, conversation.id).toBe("buyer");
      expect(conversation.createdAt, conversation.id).toBe(messages[0].sentAt);
      expect(conversation.lastMessageAt, conversation.id).toBe(messages.at(-1)!.sentAt);
      expect(conversation.firstReplyAt, conversation.id).toBe(messages.find((message) => message.from === "seller")?.sentAt);
      expect(messages.slice(1).every((message) => message.swapOffer === null), conversation.id).toBe(true);
    }
    expect(sampleMessages.every((message) => sampleConversations.some((row) => row.id === message.conversationId))).toBe(
      true,
    );
  });

  it("only offers a swap on a listing that takes swaps (spec 2.4)", () => {
    for (const message of sampleMessages.filter((row) => row.swapOffer !== null)) {
      const conversation = sampleConversations.find((row) => row.id === message.conversationId)!;
      expect(listingsById.get(conversation.listingId!)?.payMode, message.id).not.toBe("cash");
    }
  });

  it("points each notification at a conversation its account is part of", () => {
    for (const note of sampleNotifications) {
      const conversation = sampleConversations.find((row) => row.id === note.subjectId);
      expect(conversation, note.id).toBeDefined();
      expect([conversation!.buyerId, owners.get(conversation!.sellerSlug)], note.id).toContain(note.accountId);
      expect(note.href, note.id).toBe(`/messages/${note.subjectId}`);
    }
  });

  it("gives Thandi a new reply, two new notifications and a sale to confirm", () => {
    const thandis = sampleConversations.filter((row) => row.buyerId === "acc-student").map((row) => row.id);
    const unreadReplies = sampleMessages.filter(
      (row) => thandis.includes(row.conversationId) && row.from === "seller" && row.readAt === null,
    );
    expect(unreadReplies).toHaveLength(1);
    expect(sampleNotifications.filter((row) => row.accountId === "acc-student" && row.readAt === null)).toHaveLength(2);
    expect(sampleConversations.filter((row) => row.buyerId === "acc-student" && row.status === "done")).toHaveLength(1);
    // Sipho has read everything, so tests that open these as the sample seller change nothing.
    expect(sampleMessages.filter((row) => row.from === "buyer" && row.readAt === null)).toEqual([]);
    expect(sampleNotifications.filter((row) => row.accountId === "acc-seller" && row.readAt === null)).toEqual([]);
  });
});
```

- [ ] **Step 5: Run it to make sure it fails**

Run: `pnpm test data/fixtures/messages.test.ts`
Expected: FAIL, because `./messages` doesn't exist.

- [ ] **Step 6: Write the sample conversations**

Create `data/fixtures/messages.ts`:

```ts
import type { ConversationRow, MessageRow, NotificationRow } from "@/lib/data/rows";

// Two sample conversations (messaging plan decision 16): Thandi (acc-student) with Tech corner, whose owner is Sipho
// (acc-seller). One is about the headset, with a swap offer and Sipho's reply still unread; in the other Sipho marked
// the calculator sale done and Thandi hasn't confirmed it. Fixtures import nothing at run time. The words are samples
// for Lama to change; the notifications' sentences must match lib/messaging/notification-text.ts (its test checks).

export const sampleConversations: readonly ConversationRow[] = [
  {
    id: "conv-s1",
    listingId: "l-007",
    listingTitle: "Gaming headset, barely used",
    sellerSlug: "tech-corner",
    buyerId: "acc-student",
    sellerGone: false,
    status: "replied",
    createdAt: "2026-10-13T08:12:00.000Z",
    lastMessageAt: "2026-10-13T09:05:00.000Z",
    firstReplyAt: "2026-10-13T09:05:00.000Z",
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
  },
  {
    id: "conv-s2",
    listingId: "l-001",
    listingTitle: "Casio fx-991ZA Plus calculator",
    sellerSlug: "tech-corner",
    buyerId: "acc-student",
    sellerGone: false,
    status: "done",
    createdAt: "2026-10-12T10:20:00.000Z",
    lastMessageAt: "2026-10-12T16:30:00.000Z",
    firstReplyAt: "2026-10-12T10:48:00.000Z",
    completedAt: "2026-10-13T15:00:00.000Z",
    confirmedAt: null,
    confirmedBy: null,
  },
];

export const sampleMessages: readonly MessageRow[] = [
  {
    id: "msg-s1",
    conversationId: "conv-s1",
    from: "buyer",
    body: "Hi! Is the headset still available? I'd like to swap for it if you're open to that.",
    swapOffer: "A JBL Go 3 Bluetooth speaker, about a year old",
    sentAt: "2026-10-13T08:12:00.000Z",
    readAt: "2026-10-13T09:01:00.000Z",
  },
  {
    id: "msg-s2",
    conversationId: "conv-s1",
    from: "seller",
    body: "Hi Thandi, it is. Can I see the speaker first?\nI'm at the library entrance after 12:00 most days.",
    swapOffer: null,
    sentAt: "2026-10-13T09:05:00.000Z",
    readAt: null,
  },
  {
    id: "msg-s3",
    conversationId: "conv-s2",
    from: "buyer",
    body: "Hi! Is the calculator still available? I need it for my stats test on Friday.",
    swapOffer: null,
    sentAt: "2026-10-12T10:20:00.000Z",
    readAt: "2026-10-12T10:45:00.000Z",
  },
  {
    id: "msg-s4",
    conversationId: "conv-s2",
    from: "seller",
    body: "Yes, it is. I can meet you at the library entrance at 13:00 tomorrow.",
    swapOffer: null,
    sentAt: "2026-10-12T10:48:00.000Z",
    readAt: "2026-10-12T11:00:00.000Z",
  },
  {
    id: "msg-s5",
    conversationId: "conv-s2",
    from: "buyer",
    body: "Perfect, see you there.",
    swapOffer: null,
    sentAt: "2026-10-12T16:30:00.000Z",
    readAt: "2026-10-12T17:10:00.000Z",
  },
];

export const sampleNotifications: readonly NotificationRow[] = [
  {
    id: "note-s1",
    accountId: "acc-student",
    kind: "message",
    subjectId: "conv-s1",
    text: "Tech corner replied about Gaming headset, barely used",
    href: "/messages/conv-s1",
    createdAt: "2026-10-13T09:05:00.000Z",
    readAt: null,
  },
  {
    id: "note-s2",
    accountId: "acc-student",
    kind: "sale-to-confirm",
    subjectId: "conv-s2",
    text: "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
    href: "/messages/conv-s2",
    createdAt: "2026-10-13T15:00:00.000Z",
    readAt: null,
  },
  {
    id: "note-s3",
    accountId: "acc-seller",
    kind: "message",
    subjectId: "conv-s1",
    text: "Thandi asked about Gaming headset, barely used",
    href: "/messages/conv-s1",
    createdAt: "2026-10-13T08:12:00.000Z",
    readAt: "2026-10-13T09:01:00.000Z",
  },
  {
    id: "note-s4",
    accountId: "acc-seller",
    kind: "message",
    subjectId: "conv-s2",
    text: "Thandi replied about Casio fx-991ZA Plus calculator",
    href: "/messages/conv-s2",
    createdAt: "2026-10-12T16:30:00.000Z",
    readAt: "2026-10-12T17:10:00.000Z",
  },
];
```

Run: `pnpm test data/fixtures/messages.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Add the store's test**

In `lib/data/store.test.ts`:
1. Add `import { sampleConversations } from "@/data/fixtures/messages";` below `import { sampleAccounts } from "@/data/fixtures/accounts";`.
2. In "is seeded with the sample accounts, their consents and their shops, and nothing else", add these lines straight after `expect(store.formStates.size).toBe(0);`, and rename the test "is seeded with the sample accounts, their consents, their shops and the sample conversations, and nothing else":

```ts
    expect([...store.conversations.keys()]).toEqual(["conv-s1", "conv-s2"]);
    expect(store.messages.size).toBe(5);
    expect(store.notifications.size).toBe(4);
    expect(store.reports.size).toBe(0);
```

3. Add this test after "copies the fixtures, so a write never changes them":

```ts

  it("copies the sample conversations too (messaging plan, Task 1)", () => {
    sampleStore().conversations.get("conv-s1")!.status = "confirmed";
    sampleStore().messages.get("msg-s2")!.readAt = "2026-10-14T08:00:00.000Z";
    expect(sampleConversations[0].status).toBe("replied");
    expect(resetAndRead().messages.get("msg-s2")?.readAt).toBeNull();
  });
```

and below the `describe`, add the helper it uses:

```ts

function resetAndRead() {
  resetSampleStore();
  return sampleStore();
}
```

- [ ] **Step 8: Run it to make sure it fails**

Run: `pnpm test lib/data/store.test.ts`
Expected: FAIL: the store has no `conversations`, `messages`, `notifications` or `reports`.

- [ ] **Step 9: Add the tables**

In `lib/data/store.ts`:
1. Below `import { sampleAccounts, sampleConsents } from "@/data/fixtures/accounts";`, add `import { sampleConversations, sampleMessages, sampleNotifications } from "@/data/fixtures/messages";`.
2. In the `import type { … } from "./rows";` list, add `ConversationRow`, `MessageRow`, `NotificationRow` and `ReportRow`, keeping the names in alphabetical order.
3. In the `SampleStore` type, after the `formStates` field, add:

```ts
  /** By id: a buyer's conversation with a shop (messaging spec section 4). */
  conversations: Map<string, ConversationRow>;
  /** By id. */
  messages: Map<string, MessageRow>;
  /** By id: reports, for stage G's queue. */
  reports: Map<string, ReportRow>;
  /** By id. */
  notifications: Map<string, NotificationRow>;
```

4. Add one to `STORE_VERSION` (from 1 to 2 if D left it at 1), so `next dev` reseeds a store made before the new tables.
5. In `seedStore()`, after `formStates: new Map(),`, add:

```ts
    // Copies, like the accounts above (messaging plan decision 16).
    conversations: new Map(structuredClone(sampleConversations).map((row) => [row.id, row])),
    messages: new Map(structuredClone(sampleMessages).map((row) => [row.id, row])),
    reports: new Map(),
    notifications: new Map(structuredClone(sampleNotifications).map((row) => [row.id, row])),
```

6. In the comment above `SampleStore`, after "a row type in rows.ts, a field here, its seed in seedStore(), and a bump of STORE_VERSION.", nothing changes: the four tables followed it.

Run: `pnpm test lib/data/store.test.ts data/fixtures`
Expected: PASS.

- [ ] **Step 10: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 7 more unit tests than at the start (6 in the fixture's test, 1 in the store's).

- [ ] **Step 11: Hand over for commit**

Files: `lib/types.ts`, `lib/data/rows.ts`, `data/fixtures/messages.ts`, `data/fixtures/messages.test.ts`, `lib/data/store.ts`, `lib/data/store.test.ts`.
Message: `feat: messaging types, two sample conversations, and conversations, messages, reports and notifications in the sample store (messaging spec 4)`

---

### Task 2: Messaging rules: limits, clean text, the scam check, addresses, error words, sentences and times

The pure rules the data functions, actions and pages share (spec 2.3, 2.5, 2.8, 2.12, 3.2; plan decisions 4, 8, 9, 26, 28 and 29). No Next APIs and no clock reads.

**Files:**
- Create: `lib/messaging/rules.ts`, `lib/messaging/rules.test.ts`
- Create: `lib/messaging/scam-check.ts`, `lib/messaging/scam-check.test.ts`
- Create: `lib/messaging/paths.ts`, `lib/messaging/paths.test.ts`
- Create: `lib/messaging/errors.ts`, `lib/messaging/errors.test.ts`
- Create: `lib/messaging/notification-text.ts`, `lib/messaging/notification-text.test.ts`
- Modify: `lib/time.ts`, `lib/time.test.ts`

- [ ] **Step 1: Write the rules' test**

Create `lib/messaging/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  autoConfirmAt,
  characterCount,
  checkMessage,
  checkReportDetail,
  checkSwapOffer,
  cleanText,
  firstLine,
  keepTyped,
  parseReason,
  REPORT_REASONS,
  statusLabel,
} from "./rules";

describe("clean text (messaging spec 2.12, plan decision 29)", () => {
  it("keeps line breaks and tabs, makes every line break \\n, drops other control characters and trims", () => {
    expect(cleanText("  Hi!\r\nStill there?\rYes\u0000\u0007 \tok \n\n")).toBe("Hi!\nStill there?\nYes \tok");
  });

  it("leaves markup as the characters it is, for the page to show as text", () => {
    expect(cleanText("<b>hi</b> javascript:alert(1)")).toBe("<b>hi</b> javascript:alert(1)");
  });

  it("counts each letter or emoji once, where a string's length counts an emoji twice", () => {
    expect(characterCount("Hi 👍")).toBe(4);
    expect("Hi 👍".length).toBe(5);
  });
});

describe("messages, swap offers and report detail (FUNCTION-MAP section 6)", () => {
  it("asks for a message, and takes up to 1,000 characters", () => {
    expect(checkMessage(" \n ")).toEqual({ value: "", error: "message-missing" });
    expect(checkMessage("a".repeat(1000)).error).toBeNull();
    expect(checkMessage("a".repeat(1001))).toEqual({ value: "a".repeat(1001), error: "message-length" });
    expect(checkMessage(` ${"😀".repeat(1000)} `).error).toBeNull();
  });

  it("takes an optional swap offer of up to 200 characters", () => {
    expect(checkSwapOffer("   ")).toEqual({ value: "", error: null });
    expect(checkSwapOffer("b".repeat(200)).error).toBeNull();
    expect(checkSwapOffer("b".repeat(201)).error).toBe("swap-length");
  });

  it("takes an optional report detail of up to 500 characters", () => {
    expect(checkReportDetail("").error).toBeNull();
    expect(checkReportDetail("c".repeat(500)).error).toBeNull();
    expect(checkReportDetail("c".repeat(501)).error).toBe("detail-length");
  });

  it("keeps at most 4,000 typed characters for a form to show again (plan decision 8)", () => {
    expect(characterCount(keepTyped("d".repeat(5000)))).toBe(4000);
    expect(keepTyped("short")).toBe("short");
  });
});

describe("previews and statuses (messaging spec 2.5 and 3.2)", () => {
  it("previews a message by its first line, cut at 80 characters", () => {
    expect(firstLine("Is it still available?\nI can collect today.")).toBe("Is it still available?");
    expect(firstLine(`${"x".repeat(100)}\nmore`)).toBe(`${"x".repeat(79)}…`);
  });

  it("names each status in words", () => {
    expect((["asked", "replied", "done", "confirmed"] as const).map((status) => statusLabel(status))).toEqual([
      "Asked",
      "Replied",
      "Done",
      "Confirmed",
    ]);
  });

  it("confirms a sale itself 7 days after it was marked done", () => {
    expect(autoConfirmAt("2026-10-13T15:00:00.000Z")).toBe("2026-10-20T15:00:00.000Z");
  });
});

describe("report reasons (messaging spec 2.8)", () => {
  it("has the seven reasons, in order, and reads back only those", () => {
    expect(REPORT_REASONS.map((reason) => reason.label)).toEqual([
      "Scam or fraud",
      "Prohibited item",
      "Misleading listing",
      "Offensive content",
      "Harassment",
      "Spam",
      "Something else",
    ]);
    expect(parseReason("scam")).toBe("scam");
    for (const raw of ["", "Scam", "toString", "fake-profile"]) expect(parseReason(raw), raw).toBeNull();
  });
});
```

- [ ] **Step 2: Write the scam check's test**

Create `lib/messaging/scam-check.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseWarnings, SAFETY_TIPS, SCAM_TIPS, scamWarnings } from "./scam-check";

describe("the scam check (messaging spec 2.3, plan decision 9)", () => {
  it("lets ordinary messages through", () => {
    for (const text of [
      "Hi! Is this still available?",
      "Could we meet at the library entrance tomorrow at 13:00?",
      "I'll pay cash when I see it.",
      "Does the calculator decode fractions? What's the pinout on the headset jack?",
    ]) {
      expect(scamWarnings(text), text).toEqual([]);
    }
  });

  it("spots paying in advance", () => {
    expect(scamWarnings("Can you pay first and I'll bring it?")).toEqual(["advance"]);
    expect(scamWarnings("Please EFT upfront")).toEqual(["advance"]);
    expect(scamWarnings("Send the money in advance")).toEqual(["advance"]);
  });

  it("spots a deposit or a booking fee", () => {
    expect(scamWarnings("A deposit holds it for you")).toEqual(["deposit"]);
    expect(scamWarnings("There's a R50 booking fee")).toEqual(["deposit"]);
  });

  it("spots bank details", () => {
    expect(scamWarnings("Send me your banking details")).toEqual(["bank"]);
    expect(scamWarnings("What's your account number and branch code?")).toEqual(["bank"]);
  });

  it("spots a courier", () => {
    expect(scamWarnings("I can send it with Paxi")).toEqual(["courier"]);
    expect(scamWarnings("Courier is R99")).toEqual(["courier"]);
  });

  it("spots a code sent to a phone", () => {
    expect(scamWarnings("Send me the code you just got")).toEqual(["code"]);
    expect(scamWarnings("What's the OTP?")).toEqual(["code"]);
  });

  it("gives every kind that applies, in the tips' order, whatever the case", () => {
    expect(scamWarnings("PAY A DEPOSIT FIRST, then share the OTP")).toEqual(["advance", "deposit", "code"]);
  });

  it("reads warnings back from form state, dropping anything else", () => {
    expect(parseWarnings("code,deposit")).toEqual(["deposit", "code"]);
    expect(parseWarnings("nonsense,,toString")).toEqual([]);
    expect(parseWarnings(undefined)).toEqual([]);
  });

  it("always has three tips beside the composer, and one tip per warning", () => {
    expect(SAFETY_TIPS).toHaveLength(3);
    expect([...SCAM_TIPS.keys()]).toEqual(["advance", "deposit", "bank", "courier", "code"]);
  });
});
```

- [ ] **Step 3: Write the addresses' test**

Create `lib/messaging/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  backPathFor,
  composerFormKey,
  composerPath,
  inboxPath,
  isId,
  parseInboxTab,
  parseReportTarget,
  replyFormKey,
  reportFormKey,
  reportPath,
  reportSentPath,
  sentNoteKey,
  targetPath,
  threadPath,
} from "./paths";

describe("messaging addresses (messaging spec 2.1, 2.8 and 3)", () => {
  it("builds the composer's, a thread's and the inbox's addresses", () => {
    expect(composerPath({ kind: "listing", listingId: "l-001" })).toBe("/listings/l-001/message");
    expect(composerPath({ kind: "shop", sellerSlug: "tech-corner" })).toBe("/sellers/tech-corner/message");
    expect(threadPath("conv-s1")).toBe("/messages/conv-s1");
    expect(inboxPath("buying")).toBe("/messages");
    expect(inboxPath("selling")).toBe("/messages?tab=selling");
  });

  it("reads the inbox's tab, Buying unless it says selling (spec 2.10)", () => {
    expect(parseInboxTab("selling")).toBe("selling");
    expect(parseInboxTab(["selling", "buying"])).toBe("selling");
    for (const raw of [undefined, "", "Selling", "sold"]) expect(parseInboxTab(raw), String(raw)).toBe("buying");
  });

  it("builds the report form's, the thank-you's and the target's addresses", () => {
    const target = { kind: "request", id: "r-001" } as const;
    expect(reportPath(target)).toBe("/report?request=r-001");
    expect(reportSentPath(target)).toBe("/report/sent?request=r-001");
    expect(targetPath({ kind: "listing", id: "l-001" })).toBe("/listings/l-001");
    expect(targetPath({ kind: "seller", id: "tech-corner" })).toBe("/sellers/tech-corner");
    expect(targetPath(target)).toBe("/looking-for/r-001");
  });

  it("reads one report target from the address", () => {
    expect(parseReportTarget({ listing: "l-001" })).toEqual({ kind: "listing", id: "l-001" });
    expect(parseReportTarget({ seller: ["tech-corner"] })).toEqual({ kind: "seller", id: "tech-corner" });
  });

  it("refuses no target, two targets and ids this site never makes", () => {
    for (const params of [
      {},
      { listing: "l-001", seller: "tech-corner" },
      { listing: "" },
      { listing: "../admin" },
      { listing: "L-001" },
      { request: "r 001" },
      { listing: `l-${"1".repeat(90)}` },
    ]) {
      expect(parseReportTarget(params), JSON.stringify(params)).toBeNull();
    }
    expect(isId("conv-0b6c1f1e-7c43-4d8f-9a55-3f3a0b0c0d0e")).toBe(true);
    expect(isId("conv-s1/../x")).toBe(false);
  });

  it("sends the sign-in page's back link to the page behind a composer or a report (plan decision 4)", () => {
    expect(backPathFor("/listings/l-001/message")).toBe("/listings/l-001");
    expect(backPathFor("/sellers/tech-corner/message")).toBe("/sellers/tech-corner");
    expect(backPathFor("/report?listing=l-001")).toBe("/listings/l-001");
    expect(backPathFor("/report?seller=tech-corner")).toBe("/sellers/tech-corner");
    expect(backPathFor("/report?request=r-001")).toBe("/looking-for/r-001");
    expect(backPathFor("/report?listing=../x")).toBeNull();
  });

  it("gives no back link for pages that need an account, and keeps every other path", () => {
    for (const next of ["/account", "/account/privacy", "/messages", "/messages/conv-s1", "/notifications"]) {
      expect(backPathFor(next), next).toBeNull();
    }
    expect(backPathFor("/listings/l-001")).toBe("/listings/l-001");
    expect(backPathFor("/browse?cat=tech")).toBe("/browse?cat=tech");
    expect(backPathFor("/messages-old")).toBe("/messages-old");
  });

  it("keys each form's state by what it's about, so two drafts never mix (D decision 3)", () => {
    const keys = [
      composerFormKey({ kind: "listing", listingId: "l-001" }),
      composerFormKey({ kind: "shop", sellerSlug: "l-001" }),
      replyFormKey("conv-s1"),
      sentNoteKey("conv-s1"),
      reportFormKey({ kind: "listing", id: "l-001" }),
      reportFormKey({ kind: "seller", id: "l-001" }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 4: Write the error words' test**

Create `lib/messaging/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COMPOSER_FIELDS, messagingErrors, REPORT_FIELDS } from "./errors";

describe("messaging's error words (messaging spec 3.1 and 3.4, plan decision 26)", () => {
  it("words each error and links it to its field", () => {
    expect(messagingErrors(["message-missing", "swap-length"], COMPOSER_FIELDS)).toEqual([
      { message: "Write a message first.", fieldId: "composer-body" },
      { message: "Keep your swap offer under 200 characters.", fieldId: "composer-swap" },
    ]);
    expect(messagingErrors(["message-length"], COMPOSER_FIELDS)[0].message).toBe("Keep it under 1,000 characters.");
    expect(messagingErrors(["reason-missing", "detail-length"], REPORT_FIELDS)).toEqual([
      { message: "Choose a reason.", fieldId: "report-reason-scam" },
      { message: "Keep it under 500 characters.", fieldId: "report-detail" },
    ]);
  });

  it("leaves the report limit unlinked, and drops codes it doesn't know", () => {
    expect(messagingErrors(["report-rate", "nonsense", "toString"], REPORT_FIELDS)).toEqual([
      { message: "You've sent 10 reports today. Try again tomorrow.", fieldId: null },
    ]);
  });
});
```

- [ ] **Step 5: Write the sentences' test**

Create `lib/messaging/notification-text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sampleConversations, sampleNotifications } from "@/data/fixtures/messages";
import { messageNoteText, saleNoteText } from "./notification-text";

describe("notification sentences (messaging spec 3.5, plan decisions 13 and 26)", () => {
  it("says who wrote, and about what", () => {
    const title = "Casio fx-991ZA Plus calculator";
    expect(messageNoteText({ sender: "Ayanda", listingTitle: title, first: true })).toBe(
      "Ayanda asked about Casio fx-991ZA Plus calculator",
    );
    expect(messageNoteText({ sender: "Tech corner", listingTitle: title, first: false })).toBe(
      "Tech corner replied about Casio fx-991ZA Plus calculator",
    );
    expect(messageNoteText({ sender: "Ayanda", listingTitle: null, first: true })).toBe("Ayanda asked your shop a question");
    expect(messageNoteText({ sender: "Tech corner", listingTitle: null, first: false })).toBe("Tech corner replied");
  });

  it("asks the buyer about a sale marked done", () => {
    expect(saleNoteText({ shop: "Tech corner", listingTitle: "Casio fx-991ZA Plus calculator" })).toBe(
      "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
    );
    expect(saleNoteText({ shop: "Tech corner", listingTitle: null })).toBe(
      "Tech corner marked your enquiry as done. Did the sale happen?",
    );
  });

  it("wrote the sample notifications' sentences (messaging plan, Task 1)", () => {
    const titles = new Map(sampleConversations.map((row) => [row.id, row.listingTitle]));
    const expected: Record<string, string> = {
      "note-s1": messageNoteText({ sender: "Tech corner", listingTitle: titles.get("conv-s1")!, first: false }),
      "note-s2": saleNoteText({ shop: "Tech corner", listingTitle: titles.get("conv-s2")! }),
      "note-s3": messageNoteText({ sender: "Thandi", listingTitle: titles.get("conv-s1")!, first: true }),
      "note-s4": messageNoteText({ sender: "Thandi", listingTitle: titles.get("conv-s2")!, first: false }),
    };
    for (const note of sampleNotifications) expect(note.text, note.id).toBe(expected[note.id]);
  });
});
```

- [ ] **Step 6: Add the times' tests**

In `lib/time.test.ts`, add `inboxTime` and `messageTime` to the import from `./time` (keeping the names in alphabetical order), then add at the end of the file:

```ts

describe("inboxTime (messaging spec 3.2, plan decision 28)", () => {
  // Wednesday 14 October 2026, 15:00 in South Africa.
  const now = new Date("2026-10-14T13:00:00Z");

  it("gives the time today, the weekday this past week, then the date", () => {
    expect(inboxTime("2026-10-14T12:05:00Z", now)).toBe("14:05");
    expect(inboxTime("2026-10-12T08:00:00Z", now)).toBe("Mon");
    expect(inboxTime("2026-10-08T08:00:00Z", now)).toBe("Thu");
    expect(inboxTime("2026-10-07T08:00:00Z", now)).toBe("7 Oct");
    expect(inboxTime("2025-12-30T08:00:00Z", now)).toBe("30 Dec 2025");
  });

  it("counts days in South Africa, so 22:30 UTC the night before is already today", () => {
    expect(inboxTime("2026-10-13T22:30:00Z", now)).toBe("00:30");
    expect(inboxTime("2026-10-13T21:59:00Z", now)).toBe("Tue");
  });
});

describe("messageTime (messaging spec 3.3)", () => {
  it("gives the time today, and the date and time otherwise", () => {
    const now = new Date("2026-10-14T13:00:00Z");
    expect(messageTime("2026-10-14T06:42:00Z", now)).toBe("08:42");
    expect(messageTime("2026-10-12T08:00:00Z", now)).toBe("12 Oct, 10:00");
    expect(messageTime("2025-12-30T08:00:00Z", now)).toBe("30 Dec 2025, 10:00");
  });
});
```

- [ ] **Step 7: Run them to make sure they fail**

Run: `pnpm test lib/messaging lib/time.test.ts`
Expected: FAIL. The `lib/messaging` modules don't exist, and `lib/time.ts` has no `inboxTime` or `messageTime`.

- [ ] **Step 8: Write the rules**

Create `lib/messaging/rules.ts`:

```ts
import type { ConversationStatus, ReportReason } from "@/lib/types";

// Messaging's limits and text rules (messaging spec 2 and FUNCTION-MAP section 6). Plain values and functions: safe
// anywhere on the server and in tests.

/** A message, a swap offer and a report's detail, in characters (code points). */
export const MESSAGE_MAX = 1000;
export const SWAP_OFFER_MAX = 200;
export const REPORT_DETAIL_MAX = 500;
/** Typed text kept in form state after a failed post is cut at this many characters (plan decision 8). */
export const KEEP_MAX = 4000;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** A sale confirms itself 7 days after the seller marks it done (spec 2.5). */
export const AUTO_CONFIRM_MS = 7 * DAY_MS;
/** Reports an account can send in 24 hours (plan decision 17). */
export const REPORTS_PER_DAY = 10;
/** How many notifications /notifications shows (plan decision 12). */
export const NOTIFICATIONS_SHOWN = 50;

/** How many characters a text has, counting each letter or emoji once, as the limits mean them. */
export function characterCount(text: string): number {
  return [...text].length;
}

/**
 * User text as it's stored (spec 2.12, plan decision 29): every line break becomes "\n", control characters other than
 * line breaks and tabs go, and the ends are trimmed. Pages render it as text, never as HTML.
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[^\P{Cc}\n\t]/gu, "")
    .trim();
}

/** At most `max` characters, cut with "…". Never splits an emoji. */
export function truncate(text: string, max: number): string {
  const characters = [...text];
  return characters.length <= max ? text : `${characters.slice(0, max - 1).join("").trimEnd()}…`;
}

/** A message's first line, at most 80 characters, for the inbox (spec 3.2). */
export function firstLine(text: string, max = 80): string {
  return truncate(text.split("\n")[0].trim(), max);
}

export type TextCheck<E extends string> = { value: string; error: E | null };

/** A message (spec 3.1): something, and at most 1,000 characters. */
export function checkMessage(raw: string): TextCheck<"message-missing" | "message-length"> {
  const value = cleanText(raw);
  if (value === "") return { value, error: "message-missing" };
  return { value, error: characterCount(value) > MESSAGE_MAX ? "message-length" : null };
}

/** An optional swap offer (spec 2.4), at most 200 characters. "" is no offer. */
export function checkSwapOffer(raw: string): TextCheck<"swap-length"> {
  const value = cleanText(raw);
  return { value, error: characterCount(value) > SWAP_OFFER_MAX ? "swap-length" : null };
}

/** A report's optional detail (spec 2.8), at most 500 characters. */
export function checkReportDetail(raw: string): TextCheck<"detail-length"> {
  const value = cleanText(raw);
  return { value, error: characterCount(value) > REPORT_DETAIL_MAX ? "detail-length" : null };
}

/** Typed text kept for a form to show again after a failed post (plan decision 8). */
export function keepTyped(text: string): string {
  return [...text].slice(0, KEEP_MAX).join("");
}

const STATUS_LABELS: Readonly<Record<ConversationStatus, string>> = {
  asked: "Asked",
  replied: "Replied",
  done: "Done",
  confirmed: "Confirmed",
};

/** The status pill's words (spec 2.5). */
export function statusLabel(status: ConversationStatus): string {
  return STATUS_LABELS[status];
}

/** When a sale marked done at `completedAt` confirms itself (spec 2.5, plan decision 30). */
export function autoConfirmAt(completedAt: string): string {
  return new Date(Date.parse(completedAt) + AUTO_CONFIRM_MS).toISOString();
}

/** The seven reasons, in the form's order (spec 2.8). */
export const REPORT_REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: "scam", label: "Scam or fraud" },
  { value: "prohibited", label: "Prohibited item" },
  { value: "misleading", label: "Misleading listing" },
  { value: "offensive", label: "Offensive content" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
];

/** A posted reason, when it's one of the seven. */
export function parseReason(raw: string): ReportReason | null {
  return REPORT_REASONS.find((reason) => reason.value === raw)?.value ?? null;
}

/** A reason in words. */
export function reasonLabel(reason: ReportReason): string {
  return REPORT_REASONS.find((item) => item.value === reason)?.label ?? reason;
}
```

- [ ] **Step 9: Write the scam check**

Create `lib/messaging/scam-check.ts`:

```ts
// The tips beside the composer and the server's scam check (messaging spec 2.3, plan decision 9). They follow the
// safety page's "Signs of a scam". The words are samples for Lama to change (plan decision 26).

export type ScamWarning = "advance" | "deposit" | "bank" | "courier" | "code";

/** The three tips always shown beside the composer (spec 2.3). */
export const SAFETY_TIPS: readonly string[] = [
  "Meet on campus, at a pickup point, in daylight.",
  "See it before you pay. Never pay a deposit.",
  "Never share bank details or a code sent to your phone.",
];

/** The tip for each warning, in the order they're shown. */
export const SCAM_TIPS: ReadonlyMap<ScamWarning, string> = new Map([
  ["advance", "Never pay before you've seen the item or had the service. Pay when you meet."],
  ["deposit", "Don't pay a deposit or a booking fee to hold something. A real seller can wait until you meet."],
  ["bank", "Don't share bank details, card numbers or PINs in messages. Vossie will never ask for them."],
  ["courier", "Vossie is for meeting on campus. A courier means paying before you've seen it."],
  ["code", "Never share a code sent to your phone. Anyone who asks for one is trying to get into your accounts."],
]);

// What each warning looks for, in lower case. Words match whole (\b), so "decode" isn't "code" and "pinout" isn't
// "pin". A false alarm costs one tap on Send anyway; a missed scam costs more.
const PATTERNS: ReadonlyArray<readonly [ScamWarning, RegExp]> = [
  [
    "advance",
    /\b(pay|paying|payment|send (the )?money|e-?wallet|eft)\b[^.!?\n]{0,40}\b(first|upfront|up front|in advance)\b|\b(upfront|up-front|prepay|pre-pay)\b/,
  ],
  ["deposit", /\b(deposits?|booking fees?|holding fees?)\b/],
  ["bank", /\b(bank(ing)? details|account number|acc(ount)? (no|num)|branch code|card number|cvv|pin)\b/],
  ["courier", /\b(courier|paxi|pudo|postnet|delivery fee|shipping)\b/],
  ["code", /\b(otp|one[- ]time (pin|password|code)|verification code|(send|share|give|forward) (me )?(the|your|that) code)\b/],
];

/** The warnings a message needs, in SCAM_TIPS's order (spec 2.3). Most messages need none. */
export function scamWarnings(text: string): ScamWarning[] {
  const lower = text.toLowerCase();
  const found = new Set(PATTERNS.filter(([, pattern]) => pattern.test(lower)).map(([kind]) => kind));
  return [...SCAM_TIPS.keys()].filter((kind) => found.has(kind));
}

/** Warnings kept in form state as "advance,code", read back. Anything else is dropped. */
export function parseWarnings(value: string | undefined): ScamWarning[] {
  const kinds = new Set((value ?? "").split(","));
  return [...SCAM_TIPS.keys()].filter((kind) => kinds.has(kind));
}
```

- [ ] **Step 10: Write the addresses**

Create `lib/messaging/paths.ts`:

```ts
import type { InboxTab, ReportTarget } from "@/lib/types";

// Messaging's addresses (messaging spec 2.1, 2.8 and section 3), the sign-in page's back link (plan decision 4), and
// the keys its forms keep their state under (D decision 3).

/** Who a first message goes to: a listing's seller (spec 2.1), or a shop, with a question (plan decision 2). */
export type MessageTarget = { kind: "listing"; listingId: string } | { kind: "shop"; sellerSlug: string };

/** Ids and slugs as this site makes them: lower case letters, digits and hyphens. Anything else from a form is refused. */
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function isId(value: string): boolean {
  return ID.test(value);
}

export function composerPath(target: MessageTarget): string {
  return target.kind === "listing" ? `/listings/${target.listingId}/message` : `/sellers/${target.sellerSlug}/message`;
}

export function threadPath(conversationId: string): string {
  return `/messages/${conversationId}`;
}

export function inboxPath(tab: InboxTab): string {
  return tab === "selling" ? "/messages?tab=selling" : "/messages";
}

/** "?tab=selling" opens Selling; anything else is Buying (spec 2.10). */
export function parseInboxTab(raw: string | string[] | undefined): InboxTab {
  return (Array.isArray(raw) ? raw[0] : raw) === "selling" ? "selling" : "buying";
}

const REPORT_KINDS: ReadonlyArray<ReportTarget["kind"]> = ["listing", "seller", "request"];

/** The report form (spec 2.8): "/report?listing=l-001". */
export function reportPath(target: ReportTarget): string {
  return `/report?${target.kind}=${target.id}`;
}

/** The report's thank-you (plan decision 17). */
export function reportSentPath(target: ReportTarget): string {
  return `/report/sent?${target.kind}=${target.id}`;
}

/** The public page a reported thing lives on. */
export function targetPath(target: ReportTarget): string {
  if (target.kind === "listing") return `/listings/${target.id}`;
  if (target.kind === "seller") return `/sellers/${target.id}`;
  return `/looking-for/${target.id}`;
}

/** The report's target from an address's search params: exactly one of listing, seller or request, with a good id. */
export function parseReportTarget(params: Readonly<Record<string, string | string[] | undefined>>): ReportTarget | null {
  const found = REPORT_KINDS.flatMap((kind) => {
    const raw = params[kind];
    const id = Array.isArray(raw) ? raw[0] : raw;
    return id === undefined ? [] : [{ kind, id }];
  });
  return found.length === 1 && isId(found[0].id) ? found[0] : null;
}

const ACCOUNT_ONLY = ["/account", "/messages", "/notifications"];
const COMPOSER = /^\/(listings|sellers)\/([a-z0-9][a-z0-9-]*)\/message$/;

/**
 * Where the sign-in page's back link goes for `next` (plan decision 4): the listing, shop or request behind a composer
 * or a report form; nowhere for pages that need an account, since going back would only come back to sign-in; and
 * `next` itself otherwise. `next` has already been through safeNextPath.
 */
export function backPathFor(next: string): string | null {
  const url = new URL(next, "https://vossie.invalid");
  const path = url.pathname;
  if (ACCOUNT_ONLY.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return null;
  const composer = COMPOSER.exec(path);
  if (composer) return `/${composer[1]}/${composer[2]}`;
  if (path === "/report" || path === "/report/sent") {
    const target = parseReportTarget(Object.fromEntries(url.searchParams));
    return target ? targetPath(target) : null;
  }
  return next;
}

// Form-state keys (D decision 3): one per form and thing, so two drafts never mix.

export function composerFormKey(target: MessageTarget): string {
  return target.kind === "listing" ? `composer:listing:${target.listingId}` : `composer:shop:${target.sellerSlug}`;
}

export function replyFormKey(conversationId: string): string {
  return `reply:${conversationId}`;
}

/** Where the composer leaves "Sent." for the thread to take, once (plan decision 7). */
export function sentNoteKey(conversationId: string): string {
  return `sent:${conversationId}`;
}

export function reportFormKey(target: ReportTarget): string {
  return `report:${target.kind}:${target.id}`;
}
```

- [ ] **Step 11: Write the error words**

Create `lib/messaging/errors.ts`:

```ts
import type { FormError } from "@/lib/auth/messages";
import { REPORTS_PER_DAY } from "./rules";

// Messaging's error words (spec 3.1 and 3.4; plan decision 26 for the ones the spec doesn't give), each linked to its
// field, in the shape D's ErrorSummary and errorFor take.

/** The composer's fields' ids. */
export const COMPOSER_FIELDS = { body: "composer-body", swapOffer: "composer-swap" } as const;
/** The thread's reply field's id. */
export const REPLY_FIELDS = { body: "thread-reply" } as const;
/** The report form's fields' ids. The reason links to the first radio button. */
export const REPORT_FIELDS = { reason: "report-reason-scam", detail: "report-detail" } as const;

// A Map, so a stray code such as "toString" finds nothing. "report-rate" belongs to no field.
const MESSAGES: ReadonlyMap<string, { message: string; field: string }> = new Map([
  ["message-missing", { message: "Write a message first.", field: "body" }],
  ["message-length", { message: "Keep it under 1,000 characters.", field: "body" }],
  ["swap-length", { message: "Keep your swap offer under 200 characters.", field: "swapOffer" }],
  ["reason-missing", { message: "Choose a reason.", field: "reason" }],
  ["detail-length", { message: "Keep it under 500 characters.", field: "detail" }],
  ["report-rate", { message: `You've sent ${REPORTS_PER_DAY} reports today. Try again tomorrow.`, field: "none" }],
]);

/** The words for a form's error codes, in order, each linked to its field's id when the form has that field. */
export function messagingErrors(codes: readonly string[], fieldIds: Readonly<Record<string, string>>): FormError[] {
  return codes.flatMap((code) => {
    const known = MESSAGES.get(code);
    if (!known) return [];
    return [{ message: known.message, fieldId: Object.hasOwn(fieldIds, known.field) ? fieldIds[known.field] : null }];
  });
}
```

- [ ] **Step 12: Write the sentences**

Create `lib/messaging/notification-text.ts`:

```ts
// The notifications' sentences (messaging spec 3.5, plan decisions 13 and 26), fixed when a notification is made.
// Plain functions; the sample notifications in data/fixtures/messages.ts use the same words (their test checks).

/** "Ayanda asked about {title}" for a first message, "Tech corner replied about {title}" after that. */
export function messageNoteText({
  sender,
  listingTitle,
  first,
}: {
  sender: string;
  listingTitle: string | null;
  first: boolean;
}): string {
  if (listingTitle) return `${sender} ${first ? "asked" : "replied"} about ${listingTitle}`;
  return first ? `${sender} asked your shop a question` : `${sender} replied`;
}

/** The buyer's prompt when the seller marks the sale done (spec 2.9's "a sale to confirm"). */
export function saleNoteText({ shop, listingTitle }: { shop: string; listingTitle: string | null }): string {
  return `${shop} marked ${listingTitle ?? "your enquiry"} as done. Did the sale happen?`;
}
```

- [ ] **Step 13: Add the times**

Append to `lib/time.ts` (after part B's and D's helpers; it uses `sastDate`, part B's `shortSastDate` and D's `sastClock`, all in this file):

```ts

// --- Messaging (messaging plan, Task 2, plan decision 28) ---------------------------------------------------------

// en-GB writes the short weekday as "Mon".
const SAST_WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short" });

/** Whole days from one South African date (YYYY-MM-DD) to a later one. */
function daysBetween(earlier: string, later: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

/** "12 Oct", or "12 Oct 2025" when it isn't `now`'s year, in South Africa. */
function dateForMessages(iso: string, now: Date): string {
  const year = sastDate(new Date(iso)).slice(0, 4);
  return year === sastDate(now).slice(0, 4) ? shortSastDate(iso) : `${shortSastDate(iso)} ${year}`;
}

/**
 * When a conversation last moved, for the inbox (messaging spec 3.2): "14:05" today, "Mon" in the six days before,
 * "12 Oct" earlier this year and "12 Oct 2025" before that, in South Africa. `now` comes from the caller, which reads
 * the clock only after `await connection()`.
 */
export function inboxTime(iso: string, now: Date): string {
  const days = daysBetween(sastDate(new Date(iso)), sastDate(now));
  if (days <= 0) return sastClock(iso);
  if (days < 7) return SAST_WEEKDAY.format(new Date(iso));
  return dateForMessages(iso, now);
}

/** When a message was sent, in a thread (messaging spec 3.3): "14:05" today, otherwise "12 Oct, 14:05". */
export function messageTime(iso: string, now: Date): string {
  if (sastDate(new Date(iso)) === sastDate(now)) return sastClock(iso);
  return `${dateForMessages(iso, now)}, ${sastClock(iso)}`;
}
```

If part B or D gave these helpers other names, use theirs and say so in the hand-over.

- [ ] **Step 14: Run them to make sure they pass**

Run: `pnpm test lib/messaging lib/time.test.ts`
Expected: PASS.

- [ ] **Step 15: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 36 more unit tests than after Task 1 (rules 11, scam check 9, addresses 8, errors 2, sentences 3, times 3).

- [ ] **Step 16: Hand over for commit**

Files: `lib/messaging/rules.ts`, `lib/messaging/rules.test.ts`, `lib/messaging/scam-check.ts`, `lib/messaging/scam-check.test.ts`, `lib/messaging/paths.ts`, `lib/messaging/paths.test.ts`, `lib/messaging/errors.ts`, `lib/messaging/errors.test.ts`, `lib/messaging/notification-text.ts`, `lib/messaging/notification-text.test.ts`, `lib/time.ts`, `lib/time.test.ts`.
Message: `feat: messaging rules: limits, clean text, the scam check, addresses, error words, notification sentences and inbox times (messaging spec 2.3, 2.5, 2.12 and 3.2)`

---

### Task 3: Notifications data

The notifications table's functions (spec 2.9, 3.5 and section 4; plan decisions 12 to 15), shaped like the Supabase calls that replace them. They take `now` from their caller and hand out copies.

**Files:**
- Create: `lib/data/notifications.ts`, `lib/data/notifications.test.ts`

- [ ] **Step 1: Write the test**

Create `lib/data/notifications.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  countNewNotifications,
  deleteNotifications,
  exportNotifications,
  getNotifications,
  markConversationNotificationsRead,
  markNotificationsRead,
  notify,
  notifyAboutMessage,
} from "./notifications";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("reading notifications (messaging spec 3.5)", () => {
  it("lists an account's notifications, newest first, saying which are new, and no one else's", async () => {
    expect(await getNotifications("acc-student", 50)).toEqual([
      {
        id: "note-s2",
        kind: "sale-to-confirm",
        text: "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
        href: "/messages/conv-s2",
        createdAt: "2026-10-13T15:00:00.000Z",
        isNew: true,
      },
      {
        id: "note-s1",
        kind: "message",
        text: "Tech corner replied about Gaming headset, barely used",
        href: "/messages/conv-s1",
        createdAt: "2026-10-13T09:05:00.000Z",
        isNew: true,
      },
    ]);
    expect((await getNotifications("acc-seller", 50)).map((item) => item.isNew)).toEqual([false, false]);
    expect(await getNotifications("acc-mentor", 50)).toEqual([]);
  });

  it("shows at most the number asked for (plan decision 12)", async () => {
    expect((await getNotifications("acc-student", 1)).map((item) => item.id)).toEqual(["note-s2"]);
  });

  it("counts the new ones, for the header's badge (spec 2.9)", async () => {
    expect(await countNewNotifications("acc-student")).toBe(2);
    expect(await countNewNotifications("acc-seller")).toBe(0);
    expect(await countNewNotifications("acc-nope")).toBe(0);
  });

  it("hands out copies", async () => {
    const [first] = await getNotifications("acc-student", 50);
    first.text = "Changed";
    expect(sampleStore().notifications.get("note-s2")?.text).toMatch(/^Tech corner marked/);
  });
});

describe("making notifications (plan decisions 12 and 13)", () => {
  it("updates the conversation's unread message notification instead of adding another", async () => {
    await notifyAboutMessage({
      accountId: "acc-student",
      conversationId: "conv-s1",
      text: "Tech corner replied about Gaming headset, barely used",
      href: "/messages/conv-s1",
      now: NOW,
    });
    expect(await countNewNotifications("acc-student")).toBe(2);
    expect(sampleStore().notifications.get("note-s1")?.createdAt).toBe(NOW.toISOString());
    expect((await getNotifications("acc-student", 50))[0].id).toBe("note-s1");
  });

  it("adds a new one once the last has been read", async () => {
    await notifyAboutMessage({
      accountId: "acc-seller",
      conversationId: "conv-s1",
      text: "Thandi replied about Gaming headset, barely used",
      href: "/messages/conv-s1",
      now: NOW,
    });
    const [newest] = await getNotifications("acc-seller", 50);
    expect(newest).toMatchObject({ kind: "message", text: "Thandi replied about Gaming headset, barely used", isNew: true });
    expect(newest.id).toMatch(/^note-[0-9a-f-]{36}$/);
    expect(sampleStore().notifications.size).toBe(5);
  });

  it("adds a notification of any kind with its own link", async () => {
    await notify({
      accountId: "acc-mentor",
      kind: "sale-to-confirm",
      subjectId: "conv-x",
      text: "A sentence",
      href: "/messages/conv-x",
      now: NOW,
    });
    expect(await getNotifications("acc-mentor", 50)).toMatchObject([
      { kind: "sale-to-confirm", text: "A sentence", href: "/messages/conv-x", createdAt: NOW.toISOString(), isNew: true },
    ]);
  });
});

describe("marking notifications read (messaging spec 2.9)", () => {
  it("marks every one of the account's read when /notifications opens, and no one else's", async () => {
    await notify({ accountId: "acc-seller", kind: "message", subjectId: "conv-x", text: "x", href: "/messages/conv-x", now: NOW });
    await markNotificationsRead("acc-student", NOW);
    expect(await countNewNotifications("acc-student")).toBe(0);
    expect(sampleStore().notifications.get("note-s1")?.readAt).toBe(NOW.toISOString());
    expect(await countNewNotifications("acc-seller")).toBe(1);
  });

  it("marks one conversation's read when its thread opens", async () => {
    await markConversationNotificationsRead("acc-student", "conv-s1", NOW);
    expect((await getNotifications("acc-student", 50)).map((item) => [item.id, item.isNew])).toEqual([
      ["note-s2", true],
      ["note-s1", false],
    ]);
  });
});

describe("deleting and exporting (plan decisions 14 and 15)", () => {
  it("deletes an account's notifications, and everyone's about the conversations it was in", async () => {
    await notify({ accountId: "acc-mentor", kind: "message", subjectId: "conv-x", text: "x", href: "/messages/conv-x", now: NOW });
    await deleteNotifications({ accountId: "acc-student", subjectIds: new Set(["conv-s1", "conv-s2"]) });
    expect([...sampleStore().notifications.values()].map((row) => row.subjectId)).toEqual(["conv-x"]);
  });

  it("exports the account's notifications as sentences and times, newest first, with no ids", async () => {
    const data = await exportNotifications("acc-student");
    expect(data).toEqual([
      {
        text: "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
        at: "2026-10-13T15:00:00.000Z",
        read: false,
      },
      { text: "Tech corner replied about Gaming headset, barely used", at: "2026-10-13T09:05:00.000Z", read: false },
    ]);
    expect(JSON.stringify(data)).not.toMatch(/note-|acc-|conv-/);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm test lib/data/notifications.test.ts`
Expected: FAIL, because `./notifications` doesn't exist.

- [ ] **Step 3: Write the notifications**

Create `lib/data/notifications.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { NotificationItem, NotificationKind } from "@/lib/types";
import type { NotificationRow } from "./rows";
import { sampleStore } from "./store";

// Notifications (messaging spec 2.9 and 3.5; plan decisions 12 and 13): one row per thing that needs an account's
// attention, its sentence and link fixed when it's made. Server Actions make them (only they make ids); pages read
// them and mark them read. Times come from the caller.

type NewNotification = {
  accountId: string;
  kind: NotificationKind;
  subjectId: string;
  text: string;
  href: string;
  now: Date;
};

function add({ accountId, kind, subjectId, text, href, now }: NewNotification): void {
  const id = `note-${randomUUID()}`;
  sampleStore().notifications.set(id, {
    id,
    accountId,
    kind,
    subjectId,
    text,
    href,
    createdAt: now.toISOString(),
    readAt: null,
  });
}

/** A notification of any kind: a sale to confirm here; report outcomes and shop approvals in stage G. */
export async function notify(notification: NewNotification): Promise<void> {
  add(notification);
}

/**
 * Tells `accountId` about a message in a conversation (plan decision 12). While the last such notification is
 * unread, it's brought up to date (its sentence and time) rather than a second one added, so a busy thread doesn't
 * flood the list.
 */
export async function notifyAboutMessage({
  accountId,
  conversationId,
  text,
  href,
  now,
}: {
  accountId: string;
  conversationId: string;
  text: string;
  href: string;
  now: Date;
}): Promise<void> {
  for (const row of sampleStore().notifications.values()) {
    if (row.accountId !== accountId || row.kind !== "message" || row.subjectId !== conversationId) continue;
    if (row.readAt !== null) continue;
    row.text = text;
    row.createdAt = now.toISOString();
    return;
  }
  add({ accountId, kind: "message", subjectId: conversationId, text, href, now });
}

function ofAccount(accountId: string): NotificationRow[] {
  return [...sampleStore().notifications.values()]
    .filter((row) => row.accountId === accountId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** The account's newest `limit` notifications, newest first, saying which were new (spec 3.5). Copies. */
export async function getNotifications(accountId: string, limit: number): Promise<NotificationItem[]> {
  return ofAccount(accountId)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      text: row.text,
      href: row.href,
      createdAt: row.createdAt,
      isNew: row.readAt === null,
    }));
}

/** How many of the account's notifications are new: the header's badge (spec 2.9). */
export async function countNewNotifications(accountId: string): Promise<number> {
  return ofAccount(accountId).filter((row) => row.readAt === null).length;
}

/** Opening /notifications marks them all read (spec 2.9). */
export async function markNotificationsRead(accountId: string, now: Date): Promise<void> {
  for (const row of sampleStore().notifications.values()) {
    if (row.accountId === accountId && row.readAt === null) row.readAt = now.toISOString();
  }
}

/** Opening a thread marks its notifications read (plan decision 12). */
export async function markConversationNotificationsRead(
  accountId: string,
  conversationId: string,
  now: Date,
): Promise<void> {
  for (const row of sampleStore().notifications.values()) {
    if (row.accountId === accountId && row.subjectId === conversationId && row.readAt === null) {
      row.readAt = now.toISOString();
    }
  }
}

/**
 * Deleting an account (plan decision 14): its own notifications, and everyone's about `subjectIds` (the conversations
 * it was in), which name it.
 */
export async function deleteNotifications({
  accountId,
  subjectIds,
}: {
  accountId: string;
  subjectIds: ReadonlySet<string>;
}): Promise<void> {
  const { notifications } = sampleStore();
  for (const [id, row] of notifications) {
    if (row.accountId === accountId || subjectIds.has(row.subjectId)) notifications.delete(id);
  }
}

/** An account's notifications in its data export (plan decision 15): no ids. */
export type NotificationExport = { text: string; at: string; read: boolean };

export async function exportNotifications(accountId: string): Promise<NotificationExport[]> {
  return ofAccount(accountId).map((row) => ({ text: row.text, at: row.createdAt, read: row.readAt !== null }));
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `pnpm test lib/data/notifications.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 11 more unit tests than after Task 2.

- [ ] **Step 6: Hand over for commit**

Files: `lib/data/notifications.ts`, `lib/data/notifications.test.ts`.
Message: `feat: notifications in the sample store: one per conversation while unread, counts, marking read, deletion and export (messaging spec 2.9 and 3.5)`

---

### Task 4: Conversations and messages data

Everything that reads or writes conversations and messages (spec 2.1 to 2.5, 2.11, 3.2, 3.3 and section 4; plan decisions 1, 2, 5, 12, 14, 15 and 30), as async functions shaped like the Supabase calls that replace them. They take `now` from their caller, hand out copies, and only Server Actions call the ones that make ids. The thread's and inbox's reads also settle the 7-day auto-confirm (spec 2.5).

**Files:**
- Create: `lib/data/messages.ts`, `lib/data/messages.test.ts`

- [ ] **Step 1: Write the test**

Create `lib/data/messages.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createAccount } from "./accounts";
import {
  confirmSale,
  exportConversations,
  findConversation,
  forgetAccountInMessaging,
  getInbox,
  getThread,
  markCompleted,
  markThreadRead,
  rejectSale,
  sendMessage,
  startConversation,
  unreadCounts,
} from "./messages";
import { getNotifications } from "./notifications";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const CALCULATOR = { id: "l-001", title: "Casio fx-991ZA Plus calculator" };

beforeEach(() => {
  resetSampleStore();
});

/** A new buyer, as a first sign-in makes one (D Task 3). */
async function newBuyer(firstName = "Ayanda") {
  return createAccount({ email: `${firstName.toLowerCase()}@eduvos.com`, firstName, campusSlug: "pretoria", now: NOW });
}

/** Ayanda asks Tech corner about the calculator. */
async function ayandaAsks(body = "Hi! Is it still available?") {
  const buyer = await newBuyer();
  const { conversationId } = await startConversation({
    buyerId: buyer.id,
    listing: CALCULATOR,
    sellerSlug: "tech-corner",
    body,
    swapOffer: null,
    now: NOW,
  });
  return { buyer, conversationId };
}

describe("starting a conversation (messaging spec 2.1, 2.2 and 2.4)", () => {
  it("makes an Asked conversation with the message and its swap offer, and tells the shop's owner", async () => {
    const buyer = await newBuyer();
    const result = await startConversation({
      buyerId: buyer.id,
      listing: { id: "l-007", title: "Gaming headset, barely used" },
      sellerSlug: "tech-corner",
      body: "Would you swap?",
      swapOffer: "A mechanical keyboard",
      now: NOW,
    });
    expect(result.created).toBe(true);
    expect(result.conversationId).toMatch(/^conv-[0-9a-f-]{36}$/);
    expect(sampleStore().conversations.get(result.conversationId)).toMatchObject({
      listingId: "l-007",
      listingTitle: "Gaming headset, barely used",
      sellerSlug: "tech-corner",
      buyerId: buyer.id,
      status: "asked",
      createdAt: NOW.toISOString(),
      lastMessageAt: NOW.toISOString(),
      firstReplyAt: null,
    });
    const thread = await getThread(result.conversationId, buyer.id, NOW);
    expect(thread?.messages).toMatchObject([{ fromViewer: true, body: "Would you swap?", swapOffer: "A mechanical keyboard" }]);
    expect((await getNotifications("acc-seller", 50))[0]).toMatchObject({
      kind: "message",
      text: "Ayanda asked about Gaming headset, barely used",
      href: `/messages/${result.conversationId}`,
      isNew: true,
    });
  });

  it("adds a second first message to the same listing's conversation (plan decision 5)", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    const again = await startConversation({
      buyerId: buyer.id,
      listing: CALCULATOR,
      sellerSlug: "tech-corner",
      body: "Hello?",
      swapOffer: null,
      now: later(5),
    });
    expect(again).toEqual({ conversationId, created: false });
    expect((await getThread(conversationId, buyer.id, NOW))?.messages.map((message) => message.body)).toEqual([
      "Hi! Is it still available?",
      "Hello?",
    ]);
    const other = await startConversation({
      buyerId: buyer.id,
      listing: { id: "l-007", title: "Gaming headset, barely used" },
      sellerSlug: "tech-corner",
      body: "And this?",
      swapOffer: null,
      now: NOW,
    });
    expect(other.created).toBe(true);
  });

  it("keeps one question-to-the-shop conversation per buyer and shop, apart from its listings (plan decision 2)", async () => {
    const buyer = await newBuyer();
    const question = { buyerId: buyer.id, listing: null, sellerSlug: "tech-corner", swapOffer: null, now: NOW };
    const first = await startConversation({ ...question, body: "Do you fix screens?" });
    const second = await startConversation({ ...question, body: "Or batteries?" });
    expect(second).toEqual({ conversationId: first.conversationId, created: false });
    expect(await findConversation(buyer.id, { kind: "shop", sellerSlug: "tech-corner" })).toBe(first.conversationId);
    expect(await findConversation(buyer.id, { kind: "listing", listingId: "l-001" })).toBeNull();
    expect((await getNotifications("acc-seller", 50))[0].text).toBe("Ayanda replied");
  });

  it("stores a message to a shop with no owner yet, and tells no one (plan decision 1)", async () => {
    const buyer = await newBuyer();
    const before = sampleStore().notifications.size;
    const { conversationId } = await startConversation({
      buyerId: buyer.id,
      listing: { id: "l-002", title: "Intro to Financial Accounting, 4th edition" },
      sellerSlug: "book-swap",
      body: "Is it the 4th edition?",
      swapOffer: null,
      now: NOW,
    });
    expect(sampleStore().conversations.has(conversationId)).toBe(true);
    expect(sampleStore().notifications.size).toBe(before);
  });
});

describe("replies and the sale's status (messaging spec 2.5, plan decision 30)", () => {
  it("moves Asked to Replied on the seller's first reply, keeps its time, and tells the buyer", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    expect(await sendMessage({ conversationId, accountId: buyer.id, body: "Anyone there?", now: later(1) })).toBe("sent");
    expect(sampleStore().conversations.get(conversationId)?.status).toBe("asked");
    expect(await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(30) })).toBe("sent");
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Still here.", now: later(40) });
    expect(sampleStore().conversations.get(conversationId)).toMatchObject({
      status: "replied",
      firstReplyAt: later(30).toISOString(),
      lastMessageAt: later(40).toISOString(),
    });
    expect(await getNotifications(buyer.id, 50)).toMatchObject([
      { text: "Tech corner replied about Casio fx-991ZA Plus calculator", isNew: true, createdAt: later(40).toISOString() },
    ]);
  });

  it("lets only the buyer and the shop's owner write, and no one write to a side that has left", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    expect(await sendMessage({ conversationId, accountId: "acc-mentor", body: "Hi", now: NOW })).toBe("not-found");
    expect(await sendMessage({ conversationId: "conv-nope", accountId: buyer.id, body: "Hi", now: NOW })).toBe("not-found");
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(1) });
    await forgetAccountInMessaging(buyer.id, null);
    expect(await sendMessage({ conversationId, accountId: "acc-seller", body: "Hi", now: later(2) })).toBe("closed");
  });

  it("lets only the seller mark it completed, once there's been a reply, and asks the buyer to confirm", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    expect(await markCompleted({ conversationId, accountId: "acc-seller", now: later(1) })).toBe("not-allowed");
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes.", now: later(2) });
    expect(await markCompleted({ conversationId, accountId: buyer.id, now: later(3) })).toBe("not-allowed");
    expect(await markCompleted({ conversationId, accountId: "acc-seller", now: later(4) })).toBe("done");
    expect(await markCompleted({ conversationId, accountId: "acc-seller", now: later(5) })).toBe("not-allowed");
    expect(sampleStore().conversations.get(conversationId)).toMatchObject({
      status: "done",
      completedAt: later(4).toISOString(),
    });
    expect((await getNotifications(buyer.id, 50))[0]).toMatchObject({
      kind: "sale-to-confirm",
      text: "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
    });
  });

  it("lets only the buyer confirm a sale marked done", async () => {
    expect(await confirmSale({ conversationId: "conv-s2", accountId: "acc-seller", now: NOW })).toBe("not-allowed");
    expect(await confirmSale({ conversationId: "conv-s1", accountId: "acc-student", now: NOW })).toBe("not-allowed");
    expect(await confirmSale({ conversationId: "conv-s2", accountId: "acc-student", now: NOW })).toBe("done");
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({
      status: "confirmed",
      confirmedAt: NOW.toISOString(),
      confirmedBy: "buyer",
    });
  });

  it("reopens it as Replied when the buyer says it didn't happen, and it can be marked again", async () => {
    expect(await rejectSale({ conversationId: "conv-s2", accountId: "acc-student", now: NOW })).toBe("done");
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({ status: "replied", completedAt: null });
    expect(await rejectSale({ conversationId: "conv-s2", accountId: "acc-student", now: NOW })).toBe("not-allowed");
    expect(await markCompleted({ conversationId: "conv-s2", accountId: "acc-seller", now: later(1) })).toBe("done");
  });

  it("confirms a sale itself 7 days after it was marked done, when it's next read", async () => {
    const due = new Date("2026-10-20T15:00:00.000Z");
    await getThread("conv-s2", "acc-student", new Date(due.getTime() - 60_000));
    expect(sampleStore().conversations.get("conv-s2")?.status).toBe("done");
    expect((await getInbox("acc-student", "buying", due)).find((row) => row.id === "conv-s2")?.status).toBe("confirmed");
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({
      confirmedAt: due.toISOString(),
      confirmedBy: "auto",
    });
    expect(await confirmSale({ conversationId: "conv-s2", accountId: "acc-student", now: due })).toBe("not-allowed");
  });
});

describe("the inbox (messaging spec 2.10, 2.11 and 3.2)", () => {
  it("lists the buyer's conversations, newest first, with the shop's name, the listing and what's new", async () => {
    expect(await getInbox("acc-student", "buying", NOW)).toEqual([
      {
        id: "conv-s1",
        role: "buyer",
        otherName: "Tech corner",
        listingTitle: "Gaming headset, barely used",
        image: { src: "/placeholders/listing/tech.svg", alt: "Gaming headset, barely used" },
        preview: "Hi Thandi, it is. Can I see the speaker first?",
        lastFromViewer: false,
        lastMessageAt: "2026-10-13T09:05:00.000Z",
        status: "replied",
        unread: true,
      },
      {
        id: "conv-s2",
        role: "buyer",
        otherName: "Tech corner",
        listingTitle: "Casio fx-991ZA Plus calculator",
        image: { src: "/placeholders/listing/tech.svg", alt: "Casio fx-991ZA Plus calculator" },
        preview: "Perfect, see you there.",
        lastFromViewer: true,
        lastMessageAt: "2026-10-12T16:30:00.000Z",
        status: "done",
        unread: false,
      },
    ]);
    expect(await getInbox("acc-student", "selling", NOW)).toEqual([]);
  });

  it("shows the seller the buyer's first name, never their email (spec 2.11)", async () => {
    const selling = await getInbox("acc-seller", "selling", NOW);
    expect(selling.map((row) => [row.id, row.otherName, row.unread])).toEqual([
      ["conv-s1", "Thandi", false],
      ["conv-s2", "Thandi", false],
    ]);
    expect(JSON.stringify(selling)).not.toContain("@");
    expect(await getInbox("acc-seller", "buying", NOW)).toEqual([]);
  });

  it("shows a question to the shop with the shop's photo and no listing (plan decision 2)", async () => {
    const buyer = await newBuyer();
    await startConversation({
      buyerId: buyer.id,
      listing: null,
      sellerSlug: "tech-corner",
      body: "Do you fix screens?",
      swapOffer: null,
      now: NOW,
    });
    const [row] = await getInbox(buyer.id, "buying", NOW);
    expect(row).toMatchObject({ listingTitle: null, preview: "Do you fix screens?", lastFromViewer: true });
    expect(row.image?.src).toBe("/placeholders/seller/tech-corner.svg");
  });
});

describe("a thread (messaging spec 3.3 and section 5)", () => {
  it("gives the messages oldest first, each with who wrote it, and the listing and shop", async () => {
    const thread = (await getThread("conv-s1", "acc-student", NOW))!;
    expect(thread).toMatchObject({
      id: "conv-s1",
      role: "buyer",
      otherName: "Tech corner",
      otherPresent: true,
      shop: { slug: "tech-corner", name: "Tech corner", campusSlug: "midrand" },
      listingTitle: "Gaming headset, barely used",
      listing: { id: "l-007", payMode: "both" },
      status: "replied",
    });
    expect(thread.messages.map((message) => [message.author, message.fromViewer, message.swapOffer])).toEqual([
      ["You", true, "A JBL Go 3 Bluetooth speaker, about a year old"],
      ["Tech corner", false, null],
    ]);
    expect((await getThread("conv-s1", "acc-seller", NOW))?.messages.map((message) => message.author)).toEqual([
      "Thandi",
      "You",
    ]);
  });

  it("is only for the buyer and the shop's owner: anyone else, or an unknown id, gets nothing (spec 3.3)", async () => {
    expect(await getThread("conv-s1", "acc-mentor", NOW)).toBeNull();
    expect(await getThread("conv-s1", "acc-pending", NOW)).toBeNull();
    expect(await getThread("conv-nope", "acc-student", NOW)).toBeNull();
  });

  it("marks the other side's messages and the thread's notifications read when it's opened", async () => {
    await markThreadRead("conv-s1", "acc-student", NOW);
    expect(sampleStore().messages.get("msg-s2")?.readAt).toBe(NOW.toISOString());
    expect(sampleStore().messages.get("msg-s1")?.readAt).toBe("2026-10-13T09:01:00.000Z");
    expect(sampleStore().notifications.get("note-s1")?.readAt).toBe(NOW.toISOString());
    expect(sampleStore().notifications.get("note-s2")?.readAt).toBeNull();
    await markThreadRead("conv-s1", "acc-mentor", NOW);
  });
});

describe("what needs attention (messaging spec section 4)", () => {
  it("counts new notifications, unread conversations and messages, and sales to confirm", async () => {
    expect(await unreadCounts("acc-student", NOW)).toEqual({
      notifications: 2,
      conversations: 1,
      messages: 1,
      salesToConfirm: 1,
    });
    expect(await unreadCounts("acc-seller", NOW)).toEqual({
      notifications: 0,
      conversations: 0,
      messages: 0,
      salesToConfirm: 0,
    });
    await markThreadRead("conv-s1", "acc-student", NOW);
    expect(await unreadCounts("acc-student", NOW)).toMatchObject({ notifications: 1, conversations: 0, messages: 0 });
  });
});

describe("deleting an account (plan decision 14)", () => {
  it("removes a buyer's messages and keeps the seller's side, which no one can reply to", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(1) });
    await forgetAccountInMessaging(buyer.id, null);
    const thread = (await getThread(conversationId, "acc-seller", NOW))!;
    expect(thread).toMatchObject({ otherName: "Deleted account", otherPresent: false });
    expect(thread.messages.map((message) => message.body)).toEqual(["Yes, it is."]);
    expect(sampleStore().conversations.get(conversationId)).toMatchObject({ buyerId: null, firstReplyAt: later(1).toISOString() });
    expect([...sampleStore().notifications.values()].some((row) => row.subjectId === conversationId)).toBe(false);
  });

  it("removes a seller's messages and keeps the buyer's side", async () => {
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    const thread = (await getThread("conv-s1", "acc-student", NOW))!;
    expect(thread).toMatchObject({ otherName: "Deleted account", otherPresent: false });
    expect(thread.messages.map((message) => message.author)).toEqual(["You"]);
    expect(await getNotifications("acc-student", 50)).toEqual([]);
  });

  it("removes a conversation once neither side is left, or nothing is left in it", async () => {
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    await forgetAccountInMessaging("acc-student", null);
    expect(sampleStore().conversations.size).toBe(0);
    expect(sampleStore().messages.size).toBe(0);
    const buyer = await newBuyer();
    await startConversation({
      buyerId: buyer.id,
      listing: { id: "l-002", title: "Intro to Financial Accounting, 4th edition" },
      sellerSlug: "book-swap",
      body: "Hello",
      swapOffer: null,
      now: NOW,
    });
    await forgetAccountInMessaging(buyer.id, null);
    expect(sampleStore().conversations.size).toBe(0);
  });
});

describe("the data export (plan decision 15)", () => {
  it("gives each conversation with who, about what, its status and both sides' messages, oldest first, with no ids", async () => {
    const data = await exportConversations("acc-student");
    expect(data.map((row) => [row.with, row.about, row.status])).toEqual([
      ["Tech corner", "Casio fx-991ZA Plus calculator", "done"],
      ["Tech corner", "Gaming headset, barely used", "replied"],
    ]);
    expect(data[1].messages).toEqual([
      {
        from: "you",
        text: "Hi! Is the headset still available? I'd like to swap for it if you're open to that.",
        swapOffer: "A JBL Go 3 Bluetooth speaker, about a year old",
        sentAt: "2026-10-13T08:12:00.000Z",
      },
      {
        from: "them",
        text: "Hi Thandi, it is. Can I see the speaker first?\nI'm at the library entrance after 12:00 most days.",
        swapOffer: null,
        sentAt: "2026-10-13T09:05:00.000Z",
      },
    ]);
    expect(JSON.stringify(data)).not.toMatch(/conv-|msg-|acc-/);
    expect(await exportConversations("acc-mentor")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm test lib/data/messages.test.ts`
Expected: FAIL, because `./messages` doesn't exist.

- [ ] **Step 3: Write the conversations and messages**

Create `lib/data/messages.ts`:

```ts
import { randomUUID } from "node:crypto";
import { messageNoteText, saleNoteText } from "@/lib/messaging/notification-text";
import { threadPath, type MessageTarget } from "@/lib/messaging/paths";
import { autoConfirmAt, firstLine } from "@/lib/messaging/rules";
import type {
  ConversationShop,
  ConversationStatus,
  ConversationSummary,
  ImageRef,
  InboxTab,
  Thread,
  UnreadCounts,
} from "@/lib/types";
import { getListingDetail, getListingsByIds, getSeller } from "./index";
import {
  countNewNotifications,
  deleteNotifications,
  markConversationNotificationsRead,
  notify,
  notifyAboutMessage,
} from "./notifications";
import type { ConversationRow, MessageRow } from "./rows";
import { sampleStore } from "./store";

// Conversations and messages (messaging spec section 4), shaped like the Supabase calls that will replace them. A
// conversation belongs to a shop: whoever owns the shop now answers (plan decision 1). Reads settle the 7-day
// auto-confirm (spec 2.5). Times come from the caller; only Server Actions call the functions that make ids.

type Side = "buyer" | "seller";

/** What a side that has deleted its account is called (plan decision 14). */
const DELETED = "Deleted account";
/** What a shop that no longer exists is called. */
const CLOSED_SHOP = "A closed shop";

/** The account that owns the shop now, or null (plan decision 1). */
function shopOwnerId(sellerSlug: string): string | null {
  for (const row of sampleStore().sellerProfiles.values()) {
    if (row.sellerSlug === sellerSlug) return row.accountId;
  }
  return null;
}

/** The account's side of a conversation, or null when it isn't theirs (spec 3.3: only the buyer and the seller). */
function sideOf(row: ConversationRow, accountId: string): Side | null {
  if (row.buyerId === accountId) return "buyer";
  if (!row.sellerGone && shopOwnerId(row.sellerSlug) === accountId) return "seller";
  return null;
}

/** Whether there's anyone on the other side to read a reply (plan decision 21). */
function otherSideThere(row: ConversationRow, side: Side): boolean {
  return side === "buyer" ? !row.sellerGone : row.buyerId !== null;
}

function messagesOf(conversationId: string): MessageRow[] {
  return [...sampleStore().messages.values()]
    .filter((row) => row.conversationId === conversationId)
    .sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
}

/** A sale marked done confirms itself 7 days later (spec 2.5). There's no job runner, so every read checks. */
function settle(row: ConversationRow, now: Date): void {
  if (row.status !== "done" || !row.completedAt) return;
  const due = autoConfirmAt(row.completedAt);
  if (Date.parse(due) > now.getTime()) return;
  row.status = "confirmed";
  row.confirmedAt = due;
  row.confirmedBy = "auto";
}

/** The buyer as the seller sees them: their first name (spec 2.11), never their email. */
function buyerName(row: ConversationRow): string {
  const buyer = row.buyerId ? sampleStore().accounts.get(row.buyerId) : undefined;
  return buyer?.firstName ?? DELETED;
}

async function shopOf(sellerSlug: string): Promise<ConversationShop> {
  const seller = await getSeller(sellerSlug);
  if (!seller) return { slug: sellerSlug, name: CLOSED_SHOP, image: null, campusSlug: null };
  return { slug: seller.slug, name: seller.name, image: seller.image, campusSlug: seller.campusSlug };
}

/** The other side's name, as `side` sees it (spec 2.11). */
function otherName(row: ConversationRow, side: Side, shopName: string): string {
  if (side === "buyer") return row.sellerGone ? DELETED : shopName;
  return buyerName(row);
}

function addMessage(row: ConversationRow, from: Side, body: string, swapOffer: string | null, now: Date): void {
  const id = `msg-${randomUUID()}`;
  sampleStore().messages.set(id, {
    id,
    conversationId: row.id,
    from,
    body,
    swapOffer,
    sentAt: now.toISOString(),
    readAt: null,
  });
  row.lastMessageAt = now.toISOString();
}

/** Tells the other side about a message (plan decision 12). A shop with no owner yet has no one to tell. */
async function tellOtherSide(row: ConversationRow, from: Side, first: boolean, now: Date): Promise<void> {
  const to = from === "buyer" ? (row.sellerGone ? null : shopOwnerId(row.sellerSlug)) : row.buyerId;
  if (!to) return;
  const sender = from === "buyer" ? buyerName(row) : (await shopOf(row.sellerSlug)).name;
  await notifyAboutMessage({
    accountId: to,
    conversationId: row.id,
    text: messageNoteText({ sender, listingTitle: row.listingTitle, first }),
    href: threadPath(row.id),
    now,
  });
}

function findRow(buyerId: string, target: MessageTarget): ConversationRow | null {
  for (const row of sampleStore().conversations.values()) {
    if (row.buyerId !== buyerId || row.sellerGone) continue;
    if (target.kind === "listing" && row.listingId === target.listingId) return row;
    if (target.kind === "shop" && row.listingId === null && row.sellerSlug === target.sellerSlug) return row;
  }
  return null;
}

/** The buyer's conversation about this listing, or with this shop's questions, if there is one (spec 2.2). */
export async function findConversation(buyerId: string, target: MessageTarget): Promise<string | null> {
  return findRow(buyerId, target)?.id ?? null;
}

export type NewConversation = {
  buyerId: string;
  /** The listing, or null for a question about the shop (plan decision 2). */
  listing: { id: string; title: string } | null;
  sellerSlug: string;
  body: string;
  swapOffer: string | null;
  now: Date;
};

/**
 * A buyer's first message (spec 2.1, 2.2 and 2.4): a new conversation, Asked, holding the message and its swap offer,
 * and a notification for the shop's owner. When the buyer already has one about the listing (or with the shop's
 * questions), the message joins it instead (plan decision 5). Server Actions only: it makes ids.
 */
export async function startConversation(input: NewConversation): Promise<{ conversationId: string; created: boolean }> {
  const target: MessageTarget = input.listing
    ? { kind: "listing", listingId: input.listing.id }
    : { kind: "shop", sellerSlug: input.sellerSlug };
  const existing = findRow(input.buyerId, target);
  if (existing) {
    addMessage(existing, "buyer", input.body, input.swapOffer, input.now);
    await tellOtherSide(existing, "buyer", false, input.now);
    return { conversationId: existing.id, created: false };
  }
  const at = input.now.toISOString();
  const row: ConversationRow = {
    id: `conv-${randomUUID()}`,
    listingId: input.listing?.id ?? null,
    listingTitle: input.listing?.title ?? null,
    sellerSlug: input.sellerSlug,
    buyerId: input.buyerId,
    sellerGone: false,
    status: "asked",
    createdAt: at,
    lastMessageAt: at,
    firstReplyAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
  };
  sampleStore().conversations.set(row.id, row);
  addMessage(row, "buyer", input.body, input.swapOffer, input.now);
  await tellOtherSide(row, "buyer", true, input.now);
  return { conversationId: row.id, created: true };
}

export type SendResult = "sent" | "not-found" | "closed";

/**
 * A message in a thread (spec 3.3). The seller's first reply moves Asked to Replied and its time is kept for the trust
 * badges (plan decision 30); the other side is told. "not-found" when the conversation isn't the account's, "closed"
 * when the other side has left (plan decision 21). Server Actions only: it makes ids.
 */
export async function sendMessage({
  conversationId,
  accountId,
  body,
  now,
}: {
  conversationId: string;
  accountId: string;
  body: string;
  now: Date;
}): Promise<SendResult> {
  const row = sampleStore().conversations.get(conversationId);
  const side = row ? sideOf(row, accountId) : null;
  if (!row || !side) return "not-found";
  if (!otherSideThere(row, side)) return "closed";
  settle(row, now);
  addMessage(row, side, body, null, now);
  if (side === "seller") {
    if (row.status === "asked") row.status = "replied";
    row.firstReplyAt ??= now.toISOString();
  }
  await tellOtherSide(row, side, false, now);
  return "sent";
}

export type SaleResult = "done" | "not-allowed";

type SaleChange = { conversationId: string; accountId: string; now: Date };

/** The conversation, settled, when `accountId` is on `side` of it and it's `status`; otherwise null (plan decision 30). */
function saleRow({ conversationId, accountId, now }: SaleChange, side: Side, status: ConversationStatus) {
  const row = sampleStore().conversations.get(conversationId);
  if (!row || sideOf(row, accountId) !== side) return null;
  settle(row, now);
  return row.status === status ? row : null;
}

/** The seller's Mark as completed (spec 2.5): Replied becomes Done, and the buyer is asked to confirm. */
export async function markCompleted(change: SaleChange): Promise<SaleResult> {
  const row = saleRow(change, "seller", "replied");
  if (!row) return "not-allowed";
  row.status = "done";
  row.completedAt = change.now.toISOString();
  if (row.buyerId) {
    await notify({
      accountId: row.buyerId,
      kind: "sale-to-confirm",
      subjectId: row.id,
      text: saleNoteText({ shop: (await shopOf(row.sellerSlug)).name, listingTitle: row.listingTitle }),
      href: threadPath(row.id),
      now: change.now,
    });
  }
  return "done";
}

/** The buyer's Confirm the sale (spec 2.5): Done becomes Confirmed. */
export async function confirmSale(change: SaleChange): Promise<SaleResult> {
  const row = saleRow(change, "buyer", "done");
  if (!row) return "not-allowed";
  row.status = "confirmed";
  row.confirmedAt = change.now.toISOString();
  row.confirmedBy = "buyer";
  return "done";
}

/** The buyer's It didn't happen (spec 2.5): back to Replied, and the completion doesn't count. */
export async function rejectSale(change: SaleChange): Promise<SaleResult> {
  const row = saleRow(change, "buyer", "done");
  if (!row) return "not-allowed";
  row.status = "replied";
  row.completedAt = null;
  return "done";
}

const unique = (values: readonly string[]) => [...new Set(values)];

/**
 * The inbox (spec 3.2 and 2.10): the account's conversations on one side, newest activity first, each with the other
 * side's name, what it's about, the last message's first line, the status and whether something is unread.
 */
export async function getInbox(accountId: string, tab: InboxTab, now: Date): Promise<ConversationSummary[]> {
  const side: Side = tab === "buying" ? "buyer" : "seller";
  const rows = [...sampleStore().conversations.values()]
    .filter((row) => sideOf(row, accountId) === side)
    .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  for (const row of rows) settle(row, now);
  const listingIds = unique(rows.flatMap((row) => (row.listingId ? [row.listingId] : [])));
  const [listings, shops] = await Promise.all([
    getListingsByIds(listingIds),
    Promise.all(unique(rows.map((row) => row.sellerSlug)).map(shopOf)),
  ]);
  const images = new Map(listings.map((listing) => [listing.id, listing.image]));
  const shopsBySlug = new Map(shops.map((shop) => [shop.slug, shop]));
  return rows.map((row) => {
    const shop = shopsBySlug.get(row.sellerSlug)!;
    const messages = messagesOf(row.id);
    const last = messages.at(-1);
    const image: ImageRef | null = row.listingId ? (images.get(row.listingId) ?? null) : shop.image;
    return {
      id: row.id,
      role: side,
      otherName: otherName(row, side, shop.name),
      listingTitle: row.listingTitle,
      image: image ? { ...image } : null,
      preview: last ? firstLine(last.body) : "",
      lastFromViewer: last?.from === side,
      lastMessageAt: row.lastMessageAt,
      status: row.status,
      unread: messages.some((message) => message.from !== side && message.readAt === null),
    };
  });
}

/** A thread (spec 3.3), or null when it isn't the account's or doesn't exist: the page then answers 404. */
export async function getThread(id: string, accountId: string, now: Date): Promise<Thread | null> {
  const row = sampleStore().conversations.get(id);
  const side = row ? sideOf(row, accountId) : null;
  if (!row || !side) return null;
  settle(row, now);
  const [detail, shop] = await Promise.all([
    row.listingId ? getListingDetail(row.listingId) : Promise.resolve(null),
    shopOf(row.sellerSlug),
  ]);
  const other = otherName(row, side, shop.name);
  return {
    id: row.id,
    role: side,
    otherName: other,
    otherPresent: otherSideThere(row, side),
    shop,
    listingTitle: row.listingTitle,
    listing: detail ? { ...detail.listing } : null,
    status: row.status,
    completedAt: row.completedAt,
    confirmedAt: row.confirmedAt,
    confirmedBy: row.confirmedBy,
    messages: messagesOf(row.id).map((message) => ({
      id: message.id,
      fromViewer: message.from === side,
      author: message.from === side ? "You" : other,
      body: message.body,
      swapOffer: message.swapOffer,
      sentAt: message.sentAt,
    })),
  };
}

/** Opening a thread marks the other side's messages and its notifications read (spec 3.3). */
export async function markThreadRead(id: string, accountId: string, now: Date): Promise<void> {
  const row = sampleStore().conversations.get(id);
  const side = row ? sideOf(row, accountId) : null;
  if (!row || !side) return;
  for (const message of sampleStore().messages.values()) {
    if (message.conversationId === id && message.from !== side && message.readAt === null) {
      message.readAt = now.toISOString();
    }
  }
  await markConversationNotificationsRead(accountId, id, now);
}

/** What needs the account's attention (spec section 4): the header, the account page and the strip use it. */
export async function unreadCounts(accountId: string, now: Date): Promise<UnreadCounts> {
  let conversations = 0;
  let messages = 0;
  let salesToConfirm = 0;
  for (const row of sampleStore().conversations.values()) {
    const side = sideOf(row, accountId);
    if (!side) continue;
    settle(row, now);
    const unread = messagesOf(row.id).filter((message) => message.from !== side && message.readAt === null).length;
    messages += unread;
    if (unread > 0) conversations += 1;
    if (side === "buyer" && row.status === "done") salesToConfirm += 1;
  }
  return { notifications: await countNewNotifications(accountId), conversations, messages, salesToConfirm };
}

/**
 * Deleting an account (plan decision 14). Its messages go. Each conversation it was in stays for the other side, with
 * that side's own messages, unless the other side has gone too or nothing is left in it, when it goes. The
 * conversation's times stay, for the trust badges. Notifications about those conversations go, since they name the
 * account. `shopSlug` is the account's storefront, if it has one.
 */
export async function forgetAccountInMessaging(accountId: string, shopSlug: string | null): Promise<void> {
  const { conversations, messages } = sampleStore();
  const touched = new Set<string>();
  for (const row of conversations.values()) {
    const side: Side | null =
      row.buyerId === accountId ? "buyer" : shopSlug && !row.sellerGone && row.sellerSlug === shopSlug ? "seller" : null;
    if (!side) continue;
    touched.add(row.id);
    for (const [id, message] of messages) {
      if (message.conversationId === row.id && message.from === side) messages.delete(id);
    }
    if (side === "buyer") row.buyerId = null;
    else row.sellerGone = true;
  }
  for (const id of touched) {
    const row = conversations.get(id)!;
    const empty = !messagesOf(id).length;
    if (!(row.buyerId === null && row.sellerGone) && !empty) continue;
    conversations.delete(id);
    for (const [messageId, message] of messages) {
      if (message.conversationId === id) messages.delete(messageId);
    }
  }
  await deleteNotifications({ accountId, subjectIds: touched });
}

/** A conversation in the account's data export (plan decision 15). No ids. */
export type ConversationExport = {
  with: string;
  /** The listing's title, or null for a question about the shop. */
  about: string | null;
  status: ConversationStatus;
  startedAt: string;
  messages: { from: "you" | "them"; text: string; swapOffer: string | null; sentAt: string }[];
};

export async function exportConversations(accountId: string): Promise<ConversationExport[]> {
  const rows = [...sampleStore().conversations.values()]
    .filter((row) => sideOf(row, accountId) !== null)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return Promise.all(
    rows.map(async (row) => {
      const side = sideOf(row, accountId)!;
      return {
        with: otherName(row, side, (await shopOf(row.sellerSlug)).name),
        about: row.listingTitle,
        status: row.status,
        startedAt: row.createdAt,
        messages: messagesOf(row.id).map((message) => ({
          from: message.from === side ? ("you" as const) : ("them" as const),
          text: message.body,
          swapOffer: message.swapOffer,
          sentAt: message.sentAt,
        })),
      };
    }),
  );
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `pnpm test lib/data/messages.test.ts`
Expected: PASS (21 tests).

- [ ] **Step 5: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 21 more unit tests than after Task 3.

- [ ] **Step 6: Hand over for commit**

Files: `lib/data/messages.ts`, `lib/data/messages.test.ts`.
Message: `feat: conversations and messages in the sample store: start, reply, the sale's status and auto-confirm, the inbox, threads, counts, deletion and export (messaging spec 2.2 to 2.5 and 4)`

---

### Task 5: Reports data, and the account's activity, export and deletion

The reports table's functions (spec 2.8, 3.4; plan decisions 17 and 18), then stage D's account functions learn about messaging: the context strip's numbers come from the store (spec 3.6), the data export gains conversations, reports and notifications (plan decision 15), and deleting an account removes them (plan decision 14).

**Files:**
- Create: `lib/data/reports.ts`, `lib/data/reports.test.ts`
- Modify: `lib/data/accounts.ts`, `lib/data/accounts.test.ts`
- Modify: `lib/data/viewer.ts`

- [ ] **Step 1: Write the reports' test**

Create `lib/data/reports.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  countReportsSince,
  createReport,
  deleteReportsBy,
  exportReports,
  hasOpenReport,
  listReportsBy,
} from "./reports";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const LISTING = { kind: "listing", id: "l-001" } as const;
const SELLER = { kind: "seller", id: "tech-corner" } as const;

beforeEach(() => {
  resetSampleStore();
});

async function report(reporterId: string, target: typeof LISTING | typeof SELLER, at = NOW) {
  return createReport({
    reporterId,
    target,
    targetTitle: target.kind === "listing" ? "Casio fx-991ZA Plus calculator" : "Tech corner",
    reason: "scam",
    detail: "Asked for a deposit.",
    now: at,
  });
}

describe("reports (messaging spec 2.8 and 3.4)", () => {
  it("stores an open report with the reporter, the target and its title, the reason, the detail and the time", async () => {
    const id = await report("acc-student", LISTING);
    expect(id).toMatch(/^rep-[0-9a-f-]{36}$/);
    expect(sampleStore().reports.get(id)).toEqual({
      id,
      reporterId: "acc-student",
      targetKind: "listing",
      targetId: "l-001",
      targetTitle: "Casio fx-991ZA Plus calculator",
      reason: "scam",
      detail: "Asked for a deposit.",
      status: "open",
      createdAt: NOW.toISOString(),
    });
  });

  it("knows when the account has an open report on the same target (plan decision 17)", async () => {
    const id = await report("acc-student", LISTING);
    expect(await hasOpenReport("acc-student", LISTING)).toBe(true);
    expect(await hasOpenReport("acc-student", SELLER)).toBe(false);
    expect(await hasOpenReport("acc-mentor", LISTING)).toBe(false);
    sampleStore().reports.get(id)!.status = "closed";
    expect(await hasOpenReport("acc-student", LISTING)).toBe(false);
  });

  it("counts an account's reports since a time, for the daily limit", async () => {
    await report("acc-student", LISTING, new Date("2026-10-13T08:00:00.000Z"));
    await report("acc-student", SELLER, new Date("2026-10-14T08:00:00.000Z"));
    await report("acc-mentor", SELLER);
    expect(await countReportsSince("acc-student", new Date("2026-10-13T08:42:00.000Z"))).toBe(1);
  });

  it("lists an account's own reports, newest first, for privacy settings (plan decision 18)", async () => {
    await report("acc-student", LISTING, new Date("2026-10-13T08:00:00.000Z"));
    await report("acc-student", SELLER);
    await report("acc-mentor", LISTING);
    expect(await listReportsBy("acc-student")).toEqual([
      { kind: "seller", title: "Tech corner", reason: "scam", createdAt: NOW.toISOString(), open: true },
      {
        kind: "listing",
        title: "Casio fx-991ZA Plus calculator",
        reason: "scam",
        createdAt: "2026-10-13T08:00:00.000Z",
        open: true,
      },
    ]);
  });

  it("deletes one account's reports and no one else's (plan decision 14)", async () => {
    await report("acc-student", LISTING);
    await report("acc-mentor", LISTING);
    await deleteReportsBy("acc-student");
    expect([...sampleStore().reports.values()].map((row) => row.reporterId)).toEqual(["acc-mentor"]);
  });

  it("exports an account's reports in words, with no ids (plan decision 15)", async () => {
    await report("acc-student", LISTING);
    const data = await exportReports("acc-student");
    expect(data).toEqual([
      {
        about: "Casio fx-991ZA Plus calculator",
        kind: "listing",
        reason: "Scam or fraud",
        detail: "Asked for a deposit.",
        at: NOW.toISOString(),
        status: "open",
      },
    ]);
    expect(JSON.stringify(data)).not.toMatch(/rep-|acc-/);
  });
});
```

- [ ] **Step 2: Change the account functions' tests**

In `lib/data/accounts.test.ts`:

1. Add `import { createReport } from "./reports";` below `import { saveFormState } from "./form-states";`.
2. Replace the test "has no activity for the context strip yet: zeros until messaging and selling (spec 2.9)" (the whole `it(…)`) with:

```ts
  it("counts new messages and sales to confirm for the context strip (spec 2.9, messaging spec 3.6)", async () => {
    expect(await getAccountActivity("acc-student", NOW)).toEqual({ newMessages: 1, salesToConfirm: 1, savedItemsBack: 0 });
    expect(await getAccountActivity("acc-mentor", NOW)).toEqual({ newMessages: 0, salesToConfirm: 0, savedItemsBack: 0 });
    expect(await getAccountActivity("acc-nope", NOW)).toBeNull();
  });
```

3. In "holds the account, its consent, and when its sessions started and end, with no ids", change `expect(data).toEqual({` to `expect(data).toMatchObject({`, and add these lines straight after that `toMatchObject` call's closing `});`:

```ts
    // Messaging adds three keys (messaging plan decision 15): the sample seller has two conversations with Thandi.
    expect(Object.keys(data!)).toEqual([
      "exportedAt",
      "account",
      "consents",
      "sessions",
      "conversations",
      "reports",
      "notifications",
    ]);
    expect(data!.conversations.map((row) => [row.with, row.about])).toEqual([
      ["Thandi", "Casio fx-991ZA Plus calculator"],
      ["Thandi", "Gaming headset, barely used"],
    ]);
    expect(data!.reports).toEqual([]);
    expect(data!.notifications).toHaveLength(2);
```

4. Add this test at the end of the `describe("deleting an account (accounts spec 2.13)", …)` block:

```ts

  it("removes the account's messages, reports and notifications, and keeps the other side's (messaging plan decision 14)", async () => {
    await createReport({
      reporterId: "acc-student",
      target: { kind: "listing", id: "l-001" },
      targetTitle: "Casio fx-991ZA Plus calculator",
      reason: "scam",
      detail: "",
      now: NOW,
    });
    await deleteAccountData("acc-student");
    const store = sampleStore();
    expect([...store.messages.keys()].sort()).toEqual(["msg-s2", "msg-s4"]);
    expect([...store.conversations.values()].map((row) => [row.id, row.buyerId, row.sellerGone])).toEqual([
      ["conv-s1", null, false],
      ["conv-s2", null, false],
    ]);
    expect(store.reports.size).toBe(0);
    expect(store.notifications.size).toBe(0);
  });
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/data/reports.test.ts lib/data/accounts.test.ts`
Expected: FAIL. `./reports` doesn't exist, `getAccountActivity` still gives zeros, the export has no messaging keys, and deletion leaves Thandi's messages.

- [ ] **Step 4: Write the reports**

Create `lib/data/reports.ts`:

```ts
import { randomUUID } from "node:crypto";
import { reasonLabel } from "@/lib/messaging/rules";
import type { ReportReason, ReportSummary, ReportTarget } from "@/lib/types";
import type { ReportRow } from "./rows";
import { sampleStore } from "./store";

// Reports (messaging spec 2.8 and 3.4), for stage G's queue. A Server Action makes them (only it makes ids); stage G
// closes them. Times come from the caller.

/** A new, open report (spec 3.4). Its id, for stage G. */
export async function createReport({
  reporterId,
  target,
  targetTitle,
  reason,
  detail,
  now,
}: {
  reporterId: string;
  target: ReportTarget;
  targetTitle: string;
  reason: ReportReason;
  detail: string;
  now: Date;
}): Promise<string> {
  const id = `rep-${randomUUID()}`;
  sampleStore().reports.set(id, {
    id,
    reporterId,
    targetKind: target.kind,
    targetId: target.id,
    targetTitle,
    reason,
    detail,
    status: "open",
    createdAt: now.toISOString(),
  });
  return id;
}

function byReporter(reporterId: string): ReportRow[] {
  return [...sampleStore().reports.values()]
    .filter((row) => row.reporterId === reporterId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Whether the account already has an open report on this target (plan decision 17). */
export async function hasOpenReport(reporterId: string, target: ReportTarget): Promise<boolean> {
  return byReporter(reporterId).some(
    (row) => row.status === "open" && row.targetKind === target.kind && row.targetId === target.id,
  );
}

/** How many reports the account has sent since `since`, for the daily limit (plan decision 17). */
export async function countReportsSince(reporterId: string, since: Date): Promise<number> {
  return byReporter(reporterId).filter((row) => Date.parse(row.createdAt) > since.getTime()).length;
}

/** The account's own reports, newest first, for privacy settings (plan decision 18). */
export async function listReportsBy(reporterId: string): Promise<ReportSummary[]> {
  return byReporter(reporterId).map((row) => ({
    kind: row.targetKind,
    title: row.targetTitle,
    reason: row.reason,
    createdAt: row.createdAt,
    open: row.status === "open",
  }));
}

/** Deleting an account removes its reports (plan decision 14). */
export async function deleteReportsBy(reporterId: string): Promise<void> {
  const { reports } = sampleStore();
  for (const [id, row] of reports) {
    if (row.reporterId === reporterId) reports.delete(id);
  }
}

/** A report in the account's data export (plan decision 15). No ids. */
export type ReportExport = {
  about: string;
  kind: ReportTarget["kind"];
  reason: string;
  detail: string;
  at: string;
  status: "open" | "closed";
};

export async function exportReports(reporterId: string): Promise<ReportExport[]> {
  return byReporter(reporterId).map((row) => ({
    about: row.targetTitle,
    kind: row.targetKind,
    reason: reasonLabel(row.reason),
    detail: row.detail,
    at: row.createdAt,
    status: row.status,
  }));
}
```

- [ ] **Step 5: Teach the account functions about messaging**

In `lib/data/accounts.ts`:

1. Below `import { listSessions } from "./sessions";`, add:

```ts
import { exportConversations, forgetAccountInMessaging, unreadCounts, type ConversationExport } from "./messages";
import { exportNotifications, type NotificationExport } from "./notifications";
import { deleteReportsBy, exportReports, type ReportExport } from "./reports";
```

2. Replace `getAccountActivity` and its comment with:

```ts
/**
 * The numbers for the context strip (spec 2.9 and 3.4), or null when the account has gone: its unread messages and
 * the sales it has to confirm, from stage E's store (messaging spec 3.6). Saves stay on the device (spec 2.12), so
 * none "come back" through the account. `now` settles the 7-day auto-confirm (messaging spec 2.5).
 */
export async function getAccountActivity(accountId: string, now: Date): Promise<ViewerActivity | null> {
  if (!sampleStore().accounts.has(accountId)) return null;
  const counts = await unreadCounts(accountId, now);
  return { newMessages: counts.messages, salesToConfirm: counts.salesToConfirm, savedItemsBack: 0 };
}
```

3. In the `AccountExport` type, replace its comment's "Later stages add `messages`, `reports` and `listings`." with "Messaging adds conversations, reports and notifications (messaging plan decision 15); selling adds listings.", and add after the `sessions` field:

```ts
  /** Every conversation, with both sides' messages marked "you" or "them". */
  conversations: ConversationExport[];
  reports: ReportExport[];
  notifications: NotificationExport[];
```

4. In `exportAccountData`, replace `  return {` (the function's last statement's first line) with:

```ts
  const [conversations, reports, notifications] = await Promise.all([
    exportConversations(accountId),
    exportReports(accountId),
    exportNotifications(accountId),
  ]);
  return {
```

and add `conversations, reports, notifications,` as the last properties of the returned object, after `sessions,`:

```ts
    sessions,
    conversations,
    reports,
    notifications,
  };
```

5. In `deleteAccountData`, straight after `if (!account) return;`, add:

```ts
  // Messaging first, while the account's storefront is still known: its messages, reports and notifications go, and
  // the other side keeps its own side of each conversation (messaging plan decision 14).
  await forgetAccountInMessaging(accountId, store.sellerProfiles.get(accountId)?.sellerSlug ?? null);
  await deleteReportsBy(accountId);
```

and in its comment, replace "Later stages add their tables here (messages, listings, reports)." with "Messaging's tables go first (messaging plan decision 14); selling adds listings."

- [ ] **Step 6: The viewer passes the time**

In `lib/data/viewer.ts`, replace

```ts
  const activity = await getAccountActivity(account.id).catch(() => null);
```

with

```ts
  // getViewer awaited connection() before it found the account, so the clock can be read here (decision 26).
  const activity = await getAccountActivity(account.id, new Date()).catch(() => null);
```

(`lib/data/viewer.test.ts` mocks `getAccountActivity` and ignores its arguments, so it doesn't change.)

- [ ] **Step 7: Run them to make sure they pass**

Run: `pnpm test lib/data`
Expected: PASS.

- [ ] **Step 8: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 7 more unit tests than after Task 4 (6 for reports, 1 for deletion; the activity test was replaced, the export test changed). If typecheck finds another caller of `getAccountActivity`, pass it the time it already has, after its `await connection()`, and list it in the hand-over.

- [ ] **Step 9: Hand over for commit**

Files: `lib/data/reports.ts`, `lib/data/reports.test.ts`, `lib/data/accounts.ts`, `lib/data/accounts.test.ts`, `lib/data/viewer.ts`.
Message: `feat: reports in the sample store; the context strip's numbers, the data export and account deletion take in messages, reports and notifications (messaging spec 2.8 and 3.6)`

---

### Task 6: The messaging Server Actions

Every messaging form's action (spec 2.1 to 2.5, 2.8, 3.1, 3.3, 3.4; plan decisions 5 to 9 and 17): the composer's Send, a reply, the three sale buttons and Send report. Each checks its input on the server, takes identity only from the session, keeps errors and the scam warning in D's form state, and ends with `done()` (`refresh()`, then a `replace` redirect) when it writes. The pages that post to them come in Tasks 8 to 11.

**Files:**
- Modify: `tests/helpers/next-request.ts`
- Create: `lib/messaging/subjects.ts`, `lib/messaging/subjects.test.ts`
- Create: `lib/messaging/form-state.ts`, `lib/messaging/form-state.test.ts`
- Create: `lib/messaging/actions.ts`, `lib/messaging/actions.test.ts`

- [ ] **Step 1: Read the docs**

Read `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` ("A single response carries data and UI", "Security", "Choosing a cache update"), `03-api-reference/04-functions/refresh.md` and `redirect.md`. Note:
- `refresh()` can only be called in a Server Action, and it makes the action's response re-render the page; it doesn't throw, so call it before `redirect()`;
- `redirect()` throws: never call it inside a `try`; it defaults to `push` in Server Actions, and this plan passes `RedirectType.replace` (plan decision 6);
- every action is a public endpoint: check every field, and read identity only from the session.

- [ ] **Step 2: Let the test helper stand in for `next/cache`**

In `tests/helpers/next-request.ts` (D Task 4):
1. In the usage comment at the top, after the line `vi.mock("next/server", …)`, add ` *   vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));`.
2. In the `FakeRequest` type, after `proto: string;`, add:

```ts
  /** Set when a Server Action called refresh() from next/cache (messaging plan decision 6). */
  refreshed?: boolean;
```

3. In `resetRequest`, after `request.proto = "http";`, add `  request.refreshed = false;`.
4. Append to the end of the file:

```ts

/** Stands in for next/cache: refresh() just notes that it was called (messaging plan, Task 6). */
export function nextCache(request: FakeRequest) {
  return {
    refresh: () => {
      request.refreshed = true;
    },
  };
}
```

D's tests don't change: `refreshed` is optional.

- [ ] **Step 3: Write the subjects' test**

Create `lib/messaging/subjects.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { composerSubject, reportSubject, shopSlugOf } from "./subjects";

describe("what a first message is about (messaging spec 3.1, plan decision 2)", () => {
  it("knows a listing's seller, campus, whether it takes swaps and whether it's open", async () => {
    expect(await composerSubject({ kind: "listing", listingId: "l-007" })).toMatchObject({
      listing: { id: "l-007", title: "Gaming headset, barely used" },
      seller: { slug: "tech-corner", name: "Tech corner" },
      campusName: "Midrand",
      swaps: true,
      open: true,
    });
    expect(await composerSubject({ kind: "listing", listingId: "l-001" })).toMatchObject({ swaps: false, open: true });
    expect(await composerSubject({ kind: "listing", listingId: "l-026" })).toMatchObject({ open: false });
    expect(await composerSubject({ kind: "listing", listingId: "l-016" })).toMatchObject({ open: false });
    expect(await composerSubject({ kind: "listing", listingId: "l-nope" })).toBeNull();
  });

  it("knows a shop, for a question with no listing and no swap", async () => {
    expect(await composerSubject({ kind: "shop", sellerSlug: "tech-corner" })).toMatchObject({
      listing: null,
      seller: { slug: "tech-corner" },
      campusName: "Midrand",
      swaps: false,
      open: true,
    });
    expect(await composerSubject({ kind: "shop", sellerSlug: "nope" })).toBeNull();
  });

  it("knows the account's own storefront, when it has one", () => {
    expect(shopSlugOf({ seller: { status: "approved", sellerSlug: "tech-corner" } })).toBe("tech-corner");
    expect(shopSlugOf({ seller: { status: "pending", sellerSlug: null } })).toBeNull();
    expect(shopSlugOf({ seller: null })).toBeNull();
  });
});

describe("what a report is about (messaging spec 3.4)", () => {
  it("names the listing, seller or request, with the way back to it", async () => {
    expect(await reportSubject({ kind: "listing", id: "l-001" })).toEqual({
      title: "Casio fx-991ZA Plus calculator",
      href: "/listings/l-001",
      backLabel: "Back to the listing",
    });
    expect(await reportSubject({ kind: "seller", id: "tech-corner" })).toEqual({
      title: "Tech corner",
      href: "/sellers/tech-corner",
      backLabel: "Back to the shop",
    });
    // Part B's request page ("Recheck" item 15).
    expect(await reportSubject({ kind: "request", id: "r-001" })).toEqual({
      title: "Accounting 1 tutor this week",
      href: "/looking-for/r-001",
      backLabel: "Back to the request",
    });
    expect(await reportSubject({ kind: "listing", id: "l-nope" })).toBeNull();
  });
});
```

- [ ] **Step 4: Write the form state's test**

Create `lib/messaging/form-state.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState, writeFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { clearOwnFormState, takeSentNote } from "./form-state";
import { sentNoteKey } from "./paths";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(async () => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await createSession({
    key: hashToken("token-1"),
    accountId: "acc-student",
    createdAt: NOW,
    expiresAt: new Date("2026-11-13T08:42:00.000Z"),
  });
  request.cookies.set(SESSION_COOKIE, "token-1");
});

describe("messaging's form state (D decision 3, plan decision 7)", () => {
  it("says \"Sent.\" once: the thread takes the note as it reads it", async () => {
    await writeFormState(sentNoteKey("conv-s1"), { errors: [], values: {}, notice: "sent" }, NOW);
    expect(await takeSentNote("conv-s1")).toBe(true);
    expect(await takeSentNote("conv-s1")).toBe(false);
    expect(await takeSentNote("conv-s2")).toBe(false);
  });

  it("clears one form's state for this browser's session, and does nothing signed out", async () => {
    await writeFormState("reply:conv-s1", { errors: ["message-missing"], values: {}, notice: null }, NOW);
    await clearOwnFormState("reply:conv-s1");
    expect(await readFormState("reply:conv-s1")).toBeNull();
    resetRequest(request);
    await clearOwnFormState("reply:conv-s1");
  });
});
```

- [ ] **Step 5: Write the actions' test**

Create `lib/messaging/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { findConversation, getThread } from "@/lib/data/messages";
import { createReport } from "@/lib/data/reports";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { confirmTheSale, markAsCompleted, saleDidntHappen, sendFirstMessage, sendReply, sendReport } from "./actions";
import { composerFormKey, replyFormKey, reportFormKey, sentNoteKey } from "./paths";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

/** A form's fields, as the browser posts them. */
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

/** A browser signed in as `accountId`: a stored session and its token in the cookie. */
async function signedInAs(accountId: string) {
  const token = `token-${accountId}`;
  await createSession({
    key: hashToken(token),
    accountId,
    createdAt: NOW,
    expiresAt: new Date("2026-11-13T08:42:00.000Z"),
  });
  request.cookies.set(SESSION_COOKIE, token);
}

/** The conversation id at the end of a thread's address. */
const idOf = (url: string) => url.split("/").at(-1)!;

describe("the composer's Send (messaging spec 3.1)", () => {
  it("starts the conversation, leaves \"Sent.\" for the thread, and replaces the form with the thread", async () => {
    await signedInAs("acc-mentor");
    const redirect = await redirectSignalOf(() =>
      sendFirstMessage(form({ listing: "l-001", body: "  Hi! Is it still available?  " })),
    );
    expect(redirect.url).toMatch(/^\/messages\/conv-[0-9a-f-]{36}$/);
    expect(redirect.type).toBe("replace");
    expect(request.refreshed).toBe(true);
    const id = idOf(redirect.url);
    expect((await getThread(id, "acc-mentor", NOW))?.messages).toMatchObject([
      { body: "Hi! Is it still available?", swapOffer: null },
    ]);
    expect(await readFormState(sentNoteKey(id))).toMatchObject({ notice: "sent" });
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-001" }))).toBeNull();
  });

  it("keeps what was typed and says what's wrong, storing nothing", async () => {
    await signedInAs("acc-mentor");
    const redirect = await redirectSignalOf(() =>
      sendFirstMessage(form({ listing: "l-007", body: " ", swapOffer: "x".repeat(201) })),
    );
    expect([redirect.url, redirect.type]).toEqual(["/listings/l-007/message", "replace"]);
    expect(request.refreshed).toBe(false);
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-007" }))).toMatchObject({
      errors: ["message-missing", "swap-length"],
      values: { body: "", swapOffer: "x".repeat(201) },
      notice: null,
    });
    expect(sampleStore().conversations.size).toBe(2);
  });

  it("stops to warn about scam words, then sends when Send anyway is pressed (spec 2.3)", async () => {
    await signedInAs("acc-mentor");
    const fields = { listing: "l-001", body: "Can I pay a deposit first?" };
    expect(await redirectOf(() => sendFirstMessage(form(fields)))).toBe("/listings/l-001/message");
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-001" }))).toMatchObject({
      errors: [],
      notice: "check",
      values: { body: "Can I pay a deposit first?", warnings: "advance,deposit" },
    });
    expect(await findConversation("acc-mentor", { kind: "listing", listingId: "l-001" })).toBeNull();
    expect(await redirectOf(() => sendFirstMessage(form({ ...fields, anyway: "yes" })))).toMatch(/^\/messages\/conv-/);
  });

  it("keeps a swap offer only when the listing takes swaps (spec 2.4)", async () => {
    await signedInAs("acc-mentor");
    const cash = await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Hi", swapOffer: "My old phone" })));
    const swap = await redirectOf(() => sendFirstMessage(form({ listing: "l-007", body: "Hi", swapOffer: "My old phone" })));
    const offerIn = async (url: string) => (await getThread(idOf(url), "acc-mentor", NOW))!.messages[0].swapOffer;
    expect(await offerIn(cash)).toBeNull();
    expect(await offerIn(swap)).toBe("My old phone");
  });

  it("sends nothing to the seller's own shop or to a sold or paused listing (spec 3.1)", async () => {
    await signedInAs("acc-seller");
    expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Hi" })))).toBe("/listings/l-001/message");
    expect(await redirectOf(() => sendFirstMessage(form({ shop: "tech-corner", body: "Hi" })))).toBe(
      "/sellers/tech-corner/message",
    );
    expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-026", body: "Hi" })))).toBe("/listings/l-026/message");
    expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-016", body: "Hi" })))).toBe("/listings/l-016/message");
    expect(sampleStore().conversations.size).toBe(2);
  });

  it("sends a signed-out visitor to sign in, coming back to the composer, and a bad target to browse", async () => {
    expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Hi" })))).toBe(
      "/login?next=%2Flistings%2Fl-001%2Fmessage",
    );
    await signedInAs("acc-mentor");
    for (const fields of [{ listing: "../admin" }, { listing: "l-nope" }, { shop: "nope" }, {}]) {
      expect(await redirectOf(() => sendFirstMessage(form({ ...fields, body: "Hi" }))), JSON.stringify(fields)).toBe(
        "/browse",
      );
    }
    expect(sampleStore().conversations.size).toBe(2);
  });

  it("asks a shop a question from the storefront, with no swap (plan decision 2)", async () => {
    await signedInAs("acc-mentor");
    const url = await redirectOf(() =>
      sendFirstMessage(form({ shop: "tech-corner", body: "Do you fix screens?", swapOffer: "x" })),
    );
    const thread = (await getThread(idOf(url), "acc-mentor", NOW))!;
    expect(thread).toMatchObject({ listing: null, listingTitle: null, shop: { slug: "tech-corner" } });
    expect(thread.messages[0].swapOffer).toBeNull();
  });
});

describe("a reply (messaging spec 3.3)", () => {
  it("adds the reply, clears the form and draws the thread again (plan decision 6)", async () => {
    await signedInAs("acc-seller");
    const redirect = await redirectSignalOf(() =>
      sendReply(form({ conversation: "conv-s1", body: "Still yours if you want it." })),
    );
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/messages/conv-s1", "replace", true]);
    expect((await getThread("conv-s1", "acc-seller", NOW))?.messages.at(-1)).toMatchObject({
      author: "You",
      body: "Still yours if you want it.",
    });
    expect(await readFormState(replyFormKey("conv-s1"))).toBeNull();
  });

  it("keeps a reply that's empty, too long or has scam words, saying what's wrong (plan decision 9)", async () => {
    await signedInAs("acc-student");
    const state = () => readFormState(replyFormKey("conv-s1"));
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "" })));
    expect(await state()).toMatchObject({ errors: ["message-missing"] });
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "y".repeat(1001) })));
    expect(await state()).toMatchObject({ errors: ["message-length"], values: { body: "y".repeat(1001) } });
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "What's your account number?" })));
    expect(await state()).toMatchObject({ errors: [], notice: "check", values: { warnings: "bank" } });
    expect((await getThread("conv-s1", "acc-student", NOW))?.messages).toHaveLength(2);
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "What's your account number?", anyway: "yes" })));
    expect((await getThread("conv-s1", "acc-student", NOW))?.messages).toHaveLength(3);
  });

  it("sends a reply to someone else's conversation, or a bad id, to the inbox, storing nothing", async () => {
    await signedInAs("acc-mentor");
    expect(await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "Hi" })))).toBe("/messages");
    expect(await redirectOf(() => sendReply(form({ conversation: "conv-s1/../x", body: "Hi" })))).toBe("/messages");
    expect(sampleStore().messages.size).toBe(5);
  });
});

describe("the sale (messaging spec 2.5)", () => {
  it("marks it completed for the seller and confirms it for the buyer, drawing the thread again each time", async () => {
    await signedInAs("acc-seller");
    const redirect = await redirectSignalOf(() => markAsCompleted(form({ conversation: "conv-s1" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/messages/conv-s1", "replace", true]);
    expect(sampleStore().conversations.get("conv-s1")?.status).toBe("done");
    resetRequest(request);
    await signedInAs("acc-student");
    expect(await redirectOf(() => confirmTheSale(form({ conversation: "conv-s1" })))).toBe("/messages/conv-s1");
    expect(sampleStore().conversations.get("conv-s1")).toMatchObject({ status: "confirmed", confirmedBy: "buyer" });
  });

  it("reopens a sale the buyer says didn't happen, and ignores a press from the wrong side or a bad id", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => confirmTheSale(form({ conversation: "conv-s2" })));
    expect(sampleStore().conversations.get("conv-s2")?.status).toBe("done");
    resetRequest(request);
    await signedInAs("acc-student");
    await redirectOf(() => saleDidntHappen(form({ conversation: "conv-s2" })));
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({ status: "replied", completedAt: null });
    expect(await redirectOf(() => markAsCompleted(form({ conversation: "nope!" })))).toBe("/messages");
  });
});

describe("Send report (messaging spec 2.8 and 3.4)", () => {
  it("stores the report with the target's title, and replaces the form with the thank-you", async () => {
    await signedInAs("acc-mentor");
    const redirect = await redirectSignalOf(() =>
      sendReport(form({ kind: "listing", id: "l-001", reason: "misleading", detail: " Not the model in the photo. " })),
    );
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/report/sent?listing=l-001", "replace", true]);
    expect([...sampleStore().reports.values()]).toMatchObject([
      {
        reporterId: "acc-mentor",
        targetKind: "listing",
        targetId: "l-001",
        targetTitle: "Casio fx-991ZA Plus calculator",
        reason: "misleading",
        detail: "Not the model in the photo.",
        status: "open",
      },
    ]);
    // Part B's request page ("Recheck" item 15).
    expect(await redirectOf(() => sendReport(form({ kind: "request", id: "r-001", reason: "spam" })))).toBe(
      "/report/sent?request=r-001",
    );
  });

  it("asks for a reason and keeps the detail under 500 characters, storing nothing", async () => {
    await signedInAs("acc-mentor");
    expect(await redirectOf(() => sendReport(form({ kind: "seller", id: "tech-corner", detail: "z".repeat(501) })))).toBe(
      "/report?seller=tech-corner",
    );
    expect(await readFormState(reportFormKey({ kind: "seller", id: "tech-corner" }))).toMatchObject({
      errors: ["reason-missing", "detail-length"],
      values: { reason: "", detail: "z".repeat(501) },
    });
    expect(sampleStore().reports.size).toBe(0);
  });

  it("goes straight to the thank-you for a target the account has already reported (plan decision 17)", async () => {
    await signedInAs("acc-mentor");
    const fields = { kind: "listing", id: "l-001", reason: "spam" };
    await redirectOf(() => sendReport(form(fields)));
    expect(await redirectOf(() => sendReport(form(fields)))).toBe("/report/sent?listing=l-001");
    expect(sampleStore().reports.size).toBe(1);
  });

  it("allows 10 reports a day (plan decision 17)", async () => {
    await signedInAs("acc-mentor");
    for (let n = 0; n < 10; n++) {
      await createReport({
        reporterId: "acc-mentor",
        target: { kind: "listing", id: `l-x${n}` },
        targetTitle: "Something",
        reason: "spam",
        detail: "",
        now: new Date(NOW.getTime() - n * 60_000),
      });
    }
    await redirectOf(() => sendReport(form({ kind: "listing", id: "l-001", reason: "spam" })));
    expect(await readFormState(reportFormKey({ kind: "listing", id: "l-001" }))).toMatchObject({ errors: ["report-rate"] });
    expect(sampleStore().reports.size).toBe(10);
  });

  it("sends a signed-out visitor to sign in, coming back to the form, and an unknown target home", async () => {
    expect(await redirectOf(() => sendReport(form({ kind: "listing", id: "l-001", reason: "spam" })))).toBe(
      "/login?next=%2Freport%3Flisting%3Dl-001",
    );
    await signedInAs("acc-mentor");
    expect(await redirectOf(() => sendReport(form({ kind: "listing", id: "l-nope", reason: "spam" })))).toBe("/");
    expect(await redirectOf(() => sendReport(form({ kind: "account", id: "acc-admin", reason: "spam" })))).toBe("/");
    expect(sampleStore().reports.size).toBe(0);
  });
});
```

- [ ] **Step 6: Run them to make sure they fail**

Run: `pnpm test lib/messaging`
Expected: FAIL, because `./subjects`, `./form-state` and `./actions` don't exist.

- [ ] **Step 7: Write the subjects**

Create `lib/messaging/subjects.ts`:

```ts
import { getCampuses, getListingDetail, getRequest, getSeller } from "@/lib/data";
import type { Account, Listing, ReportTarget, Seller } from "@/lib/types";
import { targetPath, type MessageTarget } from "./paths";

// What a first message or a report is about, looked up once for the page and again by its Server Action, which never
// trusts the form for it (messaging spec 3.1 and 3.4).

/** Where a first message goes (spec 3.1, plan decision 2). */
export type ComposerSubject = {
  target: MessageTarget;
  /** The listing, for a first message about one; null for a question to the shop. */
  listing: Listing | null;
  seller: Seller;
  campusName: string;
  /** The composer offers a swap when the listing takes swaps (spec 2.4). */
  swaps: boolean;
  /** A paused or sold listing can't be messaged (spec 3.1). */
  open: boolean;
};

export async function composerSubject(target: MessageTarget): Promise<ComposerSubject | null> {
  if (target.kind === "listing") {
    const detail = await getListingDetail(target.listingId);
    if (!detail) return null;
    return {
      target,
      listing: detail.listing,
      seller: detail.seller,
      campusName: detail.campus.name,
      swaps: detail.listing.payMode !== "cash",
      open: detail.listing.availability === "available",
    };
  }
  const [seller, campuses] = await Promise.all([getSeller(target.sellerSlug), getCampuses()]);
  if (!seller) return null;
  const campusName = campuses.find((campus) => campus.slug === seller.campusSlug)?.name ?? "";
  return { target, listing: null, seller, campusName, swaps: false, open: true };
}

/** The account's storefront's slug, when it has one (an approved or paused shop; a pending one has none yet). */
export function shopSlugOf(account: Pick<Account, "seller">): string | null {
  return account.seller?.sellerSlug ?? null;
}

/** What a report is about, and the way back to it (spec 3.4). */
export type ReportSubject = { title: string; href: string; backLabel: string };

export async function reportSubject(target: ReportTarget): Promise<ReportSubject | null> {
  const href = targetPath(target);
  if (target.kind === "listing") {
    const detail = await getListingDetail(target.id);
    return detail ? { title: detail.listing.title, href, backLabel: "Back to the listing" } : null;
  }
  if (target.kind === "seller") {
    const seller = await getSeller(target.id);
    return seller ? { title: seller.name, href, backLabel: "Back to the shop" } : null;
  }
  const request = await getRequest(target.id);
  return request ? { title: request.title, href, backLabel: "Back to the request" } : null;
}
```

If part B isn't built ("Recheck" item 15), leave out the `request` branch and its test lines, return null for requests, and tell the controller.

- [ ] **Step 8: Write the form state helpers**

Create `lib/messaging/form-state.ts`:

```ts
import { readFormState } from "@/lib/auth/form-state";
import { getSessionKey } from "@/lib/auth/session";
import { clearFormState } from "@/lib/data/form-states";
import { sentNoteKey } from "./paths";

// Messaging's use of D's form state (D decision 3): forms keep their errors and typed text under the keys in paths.ts.

/** Clears this browser's state for `form` after a post that went through. Signed out, it does nothing. */
export async function clearOwnFormState(form: string): Promise<void> {
  const sessionKey = await getSessionKey();
  if (sessionKey) await clearFormState(sessionKey, form);
}

/**
 * Whether the composer has just sent this conversation's first message, so the thread says "Sent." (plan decision
 * 7). The note is read and cleared in one go, so it shows once. Request-time: call it inside <Suspense>.
 */
export async function takeSentNote(conversationId: string): Promise<boolean> {
  const state = await readFormState(sentNoteKey(conversationId));
  if (state?.notice !== "sent") return false;
  await clearOwnFormState(sentNoteKey(conversationId));
  return true;
}
```

- [ ] **Step 9: Write the actions**

Create `lib/messaging/actions.ts`:

```ts
"use server";

import { refresh } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { confirmSale, markCompleted, rejectSale, sendMessage, startConversation } from "@/lib/data/messages";
import { countReportsSince, createReport, hasOpenReport } from "@/lib/data/reports";
import type { ReportTarget } from "@/lib/types";
import { clearOwnFormState } from "./form-state";
import {
  composerFormKey,
  composerPath,
  isId,
  replyFormKey,
  reportFormKey,
  reportPath,
  reportSentPath,
  sentNoteKey,
  threadPath,
  type MessageTarget,
} from "./paths";
import { checkMessage, checkReportDetail, checkSwapOffer, DAY_MS, keepTyped, parseReason, REPORTS_PER_DAY } from "./rules";
import { scamWarnings } from "./scam-check";
import { composerSubject, reportSubject, shopSlugOf } from "./subjects";

// The Server Actions behind messaging's forms (messaging spec 2 and 3). Each is a plain form's action, so it works
// before the app's JavaScript arrives. It checks its own input, takes identity only from the session, keeps errors
// and the scam warning in form state rather than the URL (D decision 3), and ends with a redirect that replaces the
// form in history. Every write ends with done(), whose refresh() makes the browser drop its kept pages (plan
// decision 6).

// --- Shared helpers -------------------------------------------------------------------------------------------------

/** A form field as text. A missing field, or a file, is "". */
function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** An id or slug from a hidden field, when it's one this site could have made. */
function idFrom(formData: FormData, name: string): string | null {
  const value = text(formData, name);
  return isId(value) ? value : null;
}

/** Back to the form, which shows the state just saved. */
function back(path: string): never {
  redirect(path, RedirectType.replace);
}

/**
 * The end of every write (plan decision 6): refresh() tells the browser its kept pages are out of date, and the
 * redirect replaces the form in history, so Back skips a form that has been sent.
 */
function done(path: string): never {
  refresh();
  redirect(path, RedirectType.replace);
}

// --- Messages ---------------------------------------------------------------------------------------------------------

function messageTargetFrom(formData: FormData): MessageTarget | null {
  const listingId = idFrom(formData, "listing");
  if (listingId) return { kind: "listing", listingId };
  const sellerSlug = idFrom(formData, "shop");
  return sellerSlug ? { kind: "shop", sellerSlug } : null;
}

/**
 * The composer's Send (spec 3.1). The message and swap offer are checked, then the scam words unless Send anyway was
 * pressed (spec 2.3, plan decision 9). Then the conversation starts, or the message joins the buyer's existing one
 * (plan decision 5), and the thread says "Sent." once (plan decision 7).
 */
export async function sendFirstMessage(formData: FormData): Promise<void> {
  const target = messageTargetFrom(formData);
  if (!target) redirect("/browse");
  const path = composerPath(target);
  const account = await requireAccount(path);
  const subject = await composerSubject(target);
  if (!subject) redirect("/browse");
  // The page says why these can't be messaged (spec 3.1); a post that arrives anyway just goes back to it.
  if (!subject.open || subject.seller.slug === shopSlugOf(account)) back(path);
  const now = new Date();
  const form = composerFormKey(target);
  const message = checkMessage(text(formData, "body"));
  const swap = subject.swaps ? checkSwapOffer(text(formData, "swapOffer")) : { value: "", error: null };
  const values = { body: keepTyped(message.value), swapOffer: keepTyped(swap.value) };
  const errors = [message.error, swap.error].filter((error) => error !== null);
  if (errors.length > 0) {
    await writeFormState(form, { errors, values, notice: null }, now);
    back(path);
  }
  const warnings = text(formData, "anyway") === "yes" ? [] : scamWarnings(`${message.value}\n${swap.value}`);
  if (warnings.length > 0) {
    await writeFormState(form, { errors: [], values: { ...values, warnings: warnings.join(",") }, notice: "check" }, now);
    back(path);
  }
  const { conversationId } = await startConversation({
    buyerId: account.id,
    listing: subject.listing ? { id: subject.listing.id, title: subject.listing.title } : null,
    sellerSlug: subject.seller.slug,
    body: message.value,
    swapOffer: swap.value || null,
    now,
  });
  await clearOwnFormState(form);
  await writeFormState(sentNoteKey(conversationId), { errors: [], values: {}, notice: "sent" }, now);
  done(threadPath(conversationId));
}

/** A reply in a thread (spec 3.3), checked like a first message (plan decision 9). */
export async function sendReply(formData: FormData): Promise<void> {
  const id = idFrom(formData, "conversation");
  if (!id) redirect("/messages");
  const path = threadPath(id);
  const account = await requireAccount(path);
  const now = new Date();
  const form = replyFormKey(id);
  const message = checkMessage(text(formData, "body"));
  const body = keepTyped(message.value);
  if (message.error) {
    await writeFormState(form, { errors: [message.error], values: { body }, notice: null }, now);
    back(path);
  }
  const warnings = text(formData, "anyway") === "yes" ? [] : scamWarnings(message.value);
  if (warnings.length > 0) {
    await writeFormState(form, { errors: [], values: { body, warnings: warnings.join(",") }, notice: "check" }, now);
    back(path);
  }
  const result = await sendMessage({ conversationId: id, accountId: account.id, body: message.value, now });
  if (result === "not-found") back("/messages");
  await clearOwnFormState(form);
  // "closed" sends nothing: the thread says the other side has left (plan decision 21).
  done(path);
}

// --- The sale (spec 2.5) ------------------------------------------------------------------------------------------------

type SaleChange = (change: { conversationId: string; accountId: string; now: Date }) => Promise<unknown>;

/** One of the sale's buttons. A press the rules don't allow (plan decision 30) changes nothing. */
async function changeSale(formData: FormData, change: SaleChange): Promise<void> {
  const id = idFrom(formData, "conversation");
  if (!id) redirect("/messages");
  const account = await requireAccount(threadPath(id));
  await change({ conversationId: id, accountId: account.id, now: new Date() });
  done(threadPath(id));
}

/** The seller's Mark as completed. */
export async function markAsCompleted(formData: FormData): Promise<void> {
  await changeSale(formData, markCompleted);
}

/** The buyer's Confirm the sale. */
export async function confirmTheSale(formData: FormData): Promise<void> {
  await changeSale(formData, confirmSale);
}

/** The buyer's It didn't happen. */
export async function saleDidntHappen(formData: FormData): Promise<void> {
  await changeSale(formData, rejectSale);
}

// --- Reports (spec 2.8 and 3.4) ---------------------------------------------------------------------------------------

function reportTargetFrom(formData: FormData): ReportTarget | null {
  const kind = text(formData, "kind");
  const id = idFrom(formData, "id");
  if (!id || (kind !== "listing" && kind !== "seller" && kind !== "request")) return null;
  return { kind, id };
}

/**
 * Send report (spec 3.4): one of the seven reasons and an optional detail, at most 10 a day. A second report on a
 * target the account has already reported, while that report is open, goes straight to the thank-you and stores
 * nothing (plan decision 17).
 */
export async function sendReport(formData: FormData): Promise<void> {
  const target = reportTargetFrom(formData);
  if (!target) redirect("/");
  const path = reportPath(target);
  const account = await requireAccount(path);
  const subject = await reportSubject(target);
  if (!subject) redirect("/");
  if (await hasOpenReport(account.id, target)) done(reportSentPath(target));
  const now = new Date();
  const form = reportFormKey(target);
  const reason = parseReason(text(formData, "reason"));
  const detail = checkReportDetail(text(formData, "detail"));
  const errors: string[] = [];
  if (!reason) errors.push("reason-missing");
  if (detail.error) errors.push(detail.error);
  const since = new Date(now.getTime() - DAY_MS);
  if (errors.length === 0 && (await countReportsSince(account.id, since)) >= REPORTS_PER_DAY) errors.push("report-rate");
  if (errors.length > 0 || !reason) {
    const values = { reason: reason ?? "", detail: keepTyped(detail.value) };
    await writeFormState(form, { errors, values, notice: null }, now);
    back(path);
  }
  await createReport({ reporterId: account.id, target, targetTitle: subject.title, reason, detail: detail.value, now });
  await clearOwnFormState(form);
  done(reportSentPath(target));
}
```

- [ ] **Step 10: Run them to make sure they pass**

Run: `pnpm test lib/messaging`
Expected: PASS. If typecheck later says a value is possibly null after `back(…)`, `done(…)` or `redirect(…)`, check that `back` and `done` are function declarations with an explicit `: never` return type: that's what lets TypeScript narrow after the call (D Task 5's note). If it says `errors` isn't a `string[]` in `sendFirstMessage`, give the filter a type guard: `.filter((error): error is NonNullable<typeof error> => error !== null)`.

- [ ] **Step 11: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
Expected: all pass; 23 more unit tests than after Task 5 (actions 17, subjects 4, form state 2).

- [ ] **Step 12: Hand over for commit**

Files: `tests/helpers/next-request.ts`, `lib/messaging/subjects.ts`, `lib/messaging/subjects.test.ts`, `lib/messaging/form-state.ts`, `lib/messaging/form-state.test.ts`, `lib/messaging/actions.ts`, `lib/messaging/actions.test.ts`.
Message: `feat: messaging Server Actions: the composer's Send with the scam check, replies, the sale's three buttons and Send report, each ending with refresh() and a replace redirect (messaging spec 2.1 to 2.5 and 2.8)`

---

### Task 7: Message and Report links that follow the session

The listing page's, storefront's and request page's Message seller and Report links (spec 2.1, 2.2, 2.8 and 3.6; plan decisions 3 to 5), and the sign-in page's back link. Each link is a `<Suspense>`: the static shell has the signed-out link, and a small Server Component streams in the right one for the session. No client code: the listing page is the page with the least room, so this task ends by measuring.

**Files:**
- Create: `lib/messaging/links.ts`, `lib/messaging/links.test.ts`
- Create: `components/messages/SessionLinks.tsx`, `components/messages/SessionLinks.test.tsx`
- Create: `components/messages/ViewerLinks.tsx`, `components/messages/ViewerLinks.test.tsx`
- Create: `tests/helpers/viewer-links.tsx`
- Modify: `components/listing/ListingActions.tsx`, `ListingActions.test.tsx`, `ListingView.tsx`, `ListingView.test.tsx`
- Modify: `components/seller/SellerHero.tsx`, `SellerHero.test.tsx`, `SellerView.tsx`, `SellerView.test.tsx`
- Modify: `components/looking-for/RequestView.tsx`, `RequestView.test.tsx` (part B; "Recheck" item 15)
- Modify: `app/login/page.tsx`
- Modify: `tests/e2e/listing.spec.ts`, `tests/e2e/shopping.spec.ts`, `tests/e2e/accounts.spec.ts`

- [ ] **Step 1: Read the docs**

Read Steps 1 and 2 of `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` again: a session read is request-time, so it sits behind `<Suspense>`, and anything outside the boundary stays in the static shell. The listing page, storefront and request page are prerendered from `generateStaticParams`; after this task each has two small request-time holes, like the header's account slot (D decision 1).

- [ ] **Step 2: Write the links' test**

Create `lib/messaging/links.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { messageHrefFor, reportHrefFor } from "./links";

const viewer = vi.hoisted(() => ({ account: null as { id: string } | null }));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
});

describe("where Message seller goes (messaging spec 2.1, 2.2 and 3.6; plan decisions 3 and 5)", () => {
  it("goes through sign-in to the composer when signed out", async () => {
    expect(await messageHrefFor({ kind: "listing", listingId: "l-001" })).toBe("/login?next=%2Flistings%2Fl-001%2Fmessage");
    expect(await messageHrefFor({ kind: "shop", sellerSlug: "tech-corner" })).toBe(
      "/login?next=%2Fsellers%2Ftech-corner%2Fmessage",
    );
  });

  it("goes to the visitor's thread about the listing when there is one, otherwise the composer", async () => {
    viewer.account = { id: "acc-student" };
    expect(await messageHrefFor({ kind: "listing", listingId: "l-001" })).toBe("/messages/conv-s2");
    expect(await messageHrefFor({ kind: "shop", sellerSlug: "tech-corner" })).toBe("/sellers/tech-corner/message");
    viewer.account = { id: "acc-mentor" };
    expect(await messageHrefFor({ kind: "listing", listingId: "l-001" })).toBe("/listings/l-001/message");
  });
});

describe("where Report goes (messaging spec 2.8 and 3.6)", () => {
  it("goes through sign-in to the form when signed out, and straight to it when signed in", async () => {
    const target = { kind: "listing", id: "l-001" } as const;
    expect(await reportHrefFor(target)).toBe("/login?next=%2Freport%3Flisting%3Dl-001");
    viewer.account = { id: "acc-mentor" };
    expect(await reportHrefFor(target)).toBe("/report?listing=l-001");
  });
});
```

- [ ] **Step 3: Write the links' components' tests**

Create `components/messages/SessionLinks.test.tsx`:

```tsx
import { within } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MessageSellerLink, ReportLink } from "./SessionLinks";

// The session's part never arrives here, so what renders is the static shell's fallback (plan decision 3).
vi.mock("./ViewerLinks", async () => {
  const { use } = await import("react");
  const never = new Promise<never>(() => {});
  const Streaming = () => use(never);
  return { ViewerMessageLink: Streaming, ViewerReportLink: Streaming };
});

/** Server-renders `element`, as the static shell is, and gives back its HTML in a container to query. */
function shell(element: ReactElement) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  return within(container);
}

describe("the session's links in the static shell (messaging spec 3.6, plan decision 3)", () => {
  it("has Message seller go through sign-in to the composer", () => {
    const page = shell(
      <MessageSellerLink target={{ kind: "listing", listingId: "l-001" }} className="btn btn-primary listing-message">
        Message seller
      </MessageSellerLink>,
    );
    const link = page.getByRole("link", { name: "Message seller" });
    expect(link).toHaveAttribute("href", "/login?next=%2Flistings%2Fl-001%2Fmessage");
    expect(link).toHaveClass("listing-message");
  });

  it("has Report go through sign-in to the report form", () => {
    const page = shell(<ReportLink target={{ kind: "seller", id: "tech-corner" }}>Report this seller</ReportLink>);
    expect(page.getByRole("link", { name: "Report this seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Freport%3Fseller%3Dtech-corner",
    );
  });
});
```

Create `components/messages/ViewerLinks.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewerMessageLink, ViewerReportLink } from "./ViewerLinks";

const links = vi.hoisted(() => ({ failing: false }));

vi.mock("@/lib/messaging/links", () => ({
  messageHrefFor: async () => {
    if (links.failing) throw new Error("The session store didn't answer");
    return "/messages/conv-s2";
  },
  reportHrefFor: async () => {
    if (links.failing) throw new Error("The session store didn't answer");
    return "/report?listing=l-001";
  },
}));

afterEach(() => {
  links.failing = false;
});

describe("the session's links, once the session is read (messaging spec 3.6)", () => {
  it("sends Message seller where the session says, keeping its look", async () => {
    render(
      await ViewerMessageLink({
        target: { kind: "listing", listingId: "l-001" },
        className: "btn btn-primary listing-message",
        children: "Message seller",
      }),
    );
    const link = screen.getByRole("link", { name: "Message seller" });
    expect(link).toHaveAttribute("href", "/messages/conv-s2");
    expect(link).toHaveClass("btn", "btn-primary", "listing-message");
  });

  it("sends Report to the form", async () => {
    render(await ViewerReportLink({ target: { kind: "listing", id: "l-001" }, children: "Report this listing" }));
    expect(screen.getByRole("link", { name: "Report this listing" })).toHaveAttribute("href", "/report?listing=l-001");
  });

  it("falls back to the signed-out links when the lookup fails, which still work", async () => {
    links.failing = true;
    const { unmount } = render(
      await ViewerMessageLink({ target: { kind: "shop", sellerSlug: "tech-corner" }, children: "Message seller" }),
    );
    expect(screen.getByRole("link", { name: "Message seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsellers%2Ftech-corner%2Fmessage",
    );
    unmount();
    render(await ViewerReportLink({ target: { kind: "request", id: "r-001" }, children: "Report this request" }));
    expect(screen.getByRole("link", { name: "Report this request" })).toHaveAttribute(
      "href",
      "/login?next=%2Freport%3Frequest%3Dr-001",
    );
  });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test lib/messaging/links.test.ts components/messages`
Expected: FAIL, because `./links`, `./SessionLinks` and `./ViewerLinks` don't exist.

- [ ] **Step 5: Write the links**

Create `lib/messaging/links.ts`:

```ts
import { getViewer } from "@/lib/auth/session";
import { findConversation } from "@/lib/data/messages";
import { signInHref } from "@/lib/next-path";
import type { ReportTarget } from "@/lib/types";
import { composerPath, reportPath, threadPath, type MessageTarget } from "./paths";

// Where the session's links go (messaging spec 2.1, 2.2, 2.8 and 3.6; plan decisions 3 and 5). Request-time: they read
// the session, so the components that call them sit inside <Suspense>.

/** Message seller: through sign-in to the composer; signed in, the visitor's thread about it, or else the composer. */
export async function messageHrefFor(target: MessageTarget): Promise<string> {
  const composer = composerPath(target);
  const account = await getViewer();
  if (!account) return signInHref(composer);
  const existing = await findConversation(account.id, target);
  return existing ? threadPath(existing) : composer;
}

/** Report: through sign-in to the form; signed in, straight to it. */
export async function reportHrefFor(target: ReportTarget): Promise<string> {
  const path = reportPath(target);
  return (await getViewer()) ? path : signInHref(path);
}
```

Create `components/messages/ViewerLinks.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { messageHrefFor, reportHrefFor } from "@/lib/messaging/links";
import { composerPath, reportPath, type MessageTarget } from "@/lib/messaging/paths";
import { signInHref } from "@/lib/next-path";
import type { ReportTarget } from "@/lib/types";

// The session's part of Message seller and Report (messaging plan decision 3). Async Server Components: they read the
// session, so SessionLinks.tsx puts each inside <Suspense>. A failed lookup gives the signed-out link, which still
// works: the sign-in page says who's signed in.

type LinkProps<Target> = { target: Target; className?: string; children: ReactNode };

export async function ViewerMessageLink({ target, className, children }: LinkProps<MessageTarget>) {
  const href = await messageHrefFor(target).catch(() => signInHref(composerPath(target)));
  return (
    <Link href={href} prefetch={false} className={className}>
      {children}
    </Link>
  );
}

export async function ViewerReportLink({ target, className, children }: LinkProps<ReportTarget>) {
  const href = await reportHrefFor(target).catch(() => signInHref(reportPath(target)));
  return (
    <Link href={href} prefetch={false} className={className}>
      {children}
    </Link>
  );
}
```

Create `components/messages/SessionLinks.tsx`:

```tsx
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { composerPath, reportPath, type MessageTarget } from "@/lib/messaging/paths";
import { signInHref } from "@/lib/next-path";
import type { ReportTarget } from "@/lib/types";
import { ViewerMessageLink, ViewerReportLink } from "./ViewerLinks";

// Message seller and Report on the listing page, the storefront and the request page (messaging spec 3.6, plan
// decision 3). The static shell has the signed-out link (through sign-in, then on to the composer or the form, spec
// 2.1); the session's link streams in, with the same words and look, so nothing moves. Server Components and a Link,
// with no prefetch: no client bytes.

type LinkProps<Target> = { target: Target; className?: string; children: ReactNode };

export function MessageSellerLink({ target, className, children }: LinkProps<MessageTarget>) {
  const signedOut = (
    <Link href={signInHref(composerPath(target))} prefetch={false} className={className}>
      {children}
    </Link>
  );
  return (
    <Suspense fallback={signedOut}>
      <ViewerMessageLink target={target} className={className}>
        {children}
      </ViewerMessageLink>
    </Suspense>
  );
}

export function ReportLink({ target, className, children }: LinkProps<ReportTarget>) {
  const signedOut = (
    <Link href={signInHref(reportPath(target))} prefetch={false} className={className}>
      {children}
    </Link>
  );
  return (
    <Suspense fallback={signedOut}>
      <ViewerReportLink target={target} className={className}>
        {children}
      </ViewerReportLink>
    </Suspense>
  );
}
```

Create `tests/helpers/viewer-links.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { composerPath, reportPath, type MessageTarget } from "@/lib/messaging/paths";
import { signInHref } from "@/lib/next-path";
import type { ReportTarget } from "@/lib/types";

type LinkProps<Target> = { target: Target; className?: string; children: ReactNode };

/**
 * Stands in for components/messages/ViewerLinks.tsx in component tests (messaging plan, Task 7). The real links are
 * async Server Components, which jsdom can't render inside a tree; these render the signed-out links, which are what a
 * signed-out visitor gets. In a test file:
 *
 *   vi.mock("@/components/messages/ViewerLinks", async () => (await import("@/tests/helpers/viewer-links")).signedOutViewerLinks);
 */
export const signedOutViewerLinks = {
  ViewerMessageLink: ({ target, className, children }: LinkProps<MessageTarget>) => (
    <Link href={signInHref(composerPath(target))} prefetch={false} className={className}>
      {children}
    </Link>
  ),
  ViewerReportLink: ({ target, className, children }: LinkProps<ReportTarget>) => (
    <Link href={signInHref(reportPath(target))} prefetch={false} className={className}>
      {children}
    </Link>
  ),
};
```

Run: `pnpm test lib/messaging/links.test.ts components/messages`
Expected: PASS.

- [ ] **Step 6: Change the listing page's, storefront's and request page's tests first**

Find every test that renders these components: `grep -rln "ListingActions\|ListingView\|SellerHero\|SellerView\|RequestView" components app --include="*.test.tsx"`. In each file it prints, add straight after the last `vi.mock(…)` (or after the imports, if there's none):

```tsx

// The session's links are async Server Components; here they're the signed-out links (messaging plan, Task 7).
vi.mock("@/components/messages/ViewerLinks", async () => (await import("@/tests/helpers/viewer-links")).signedOutViewerLinks);
```

and add `vi` to the file's `vitest` import if it isn't there. Then change the expected links:

1. `components/listing/ListingActions.test.tsx`: in "messages the seller through sign-in, and saves and shares", replace `"/login?next=%2Flistings%2Fl-001",` with `"/login?next=%2Flistings%2Fl-001%2Fmessage",` and rename the test "messages the seller through sign-in and on to the composer, and saves and shares (messaging spec 2.1)".
2. `components/listing/ListingView.test.tsx`: in "shows the photos, more from the seller and the report link", replace `"/login?next=%2Flistings%2Fl-001",` with `"/login?next=%2Freport%3Flisting%3Dl-001",`.
3. `components/seller/SellerHero.test.tsx`: replace the Message seller link's expected `"/login?next=%2Fsellers%2Ftech-corner",` with `"/login?next=%2Fsellers%2Ftech-corner%2Fmessage",`.
4. `components/seller/SellerView.test.tsx`: replace the Report this seller link's expected `"/login?next=%2Fsellers%2Ftech-corner",` with `"/login?next=%2Freport%3Fseller%3Dtech-corner",`.
5. `components/looking-for/RequestView.test.tsx` (part B): in "shows listings already on Vossie, then a report link through the sign-in page", replace the Report this request link's expected `"/login?next=%2Flooking-for%2Fr-001",` with `"/login?next=%2Freport%3Frequest%3Dr-001",`. The Offer to help link keeps `/login?next=%2Flooking-for%2Fr-001`.

If a file quotes the old link differently, change it by meaning and say so in the hand-over.

Run: `pnpm test components/listing components/seller components/looking-for`
Expected: FAIL: the links still go to the old sign-in targets.

- [ ] **Step 7: Use the session's links**

In `components/listing/ListingActions.tsx`:
1. Replace `import { signInHref } from "@/lib/next-path";` with `import { MessageSellerLink } from "@/components/messages/SessionLinks";`, moved up so the `@/components/…` imports stay in alphabetical order.
2. Delete the line `  const signIn = signInHref(\`/listings/${listing.id}\`);`.
3. Replace

```tsx
        <Link href={signIn} prefetch={false} className="btn btn-primary listing-message">
          Message seller
        </Link>
```

with

```tsx
        <MessageSellerLink target={{ kind: "listing", listingId: listing.id }} className="btn btn-primary listing-message">
          Message seller
        </MessageSellerLink>
```

4. In the comment above `ListingActions`, replace the sentence about Message (D Task 12 made it "Message leads to the sign-in page (decision 44); stage E sends signed-in visitors to the composer instead.") with: "Message seller follows the session: the static shell's link goes through sign-in to the composer, and the signed-in one, streamed in, to the composer or the visitor's thread about this listing (messaging plan decision 3)."

In `components/listing/ListingView.tsx`:
1. Replace `import { signInHref } from "@/lib/next-path";` with `import { ReportLink } from "@/components/messages/SessionLinks";`, moved up among the `@/components/…` imports.
2. Delete the line `  const signIn = signInHref(\`/listings/${listing.id}\`);`.
3. Replace

```tsx
        <Link href={signIn} prefetch={false}>
          <FlagIcon className="size-4" />
          Report this listing
        </Link>
```

with

```tsx
        <ReportLink target={{ kind: "listing", id: listing.id }}>
          <FlagIcon className="size-4" />
          Report this listing
        </ReportLink>
```

In `components/seller/SellerHero.tsx`:
1. Replace `import { signInHref } from "@/lib/next-path";` with `import { MessageSellerLink } from "@/components/messages/SessionLinks";`, moved up among the `@/components/…` imports. If `Link` from `next/link` is now unused, remove its import.
2. Replace

```tsx
        <Link href={signInHref(`/sellers/${seller.slug}`)} prefetch={false} className="btn btn-sky seller-message">
          Message seller
        </Link>
```

with

```tsx
        <MessageSellerLink target={{ kind: "shop", sellerSlug: seller.slug }} className="btn btn-sky seller-message">
          Message seller
        </MessageSellerLink>
```

In `components/seller/SellerView.tsx`:
1. Replace `import { signInHref } from "@/lib/next-path";` with `import { ReportLink } from "@/components/messages/SessionLinks";`, moved up among the `@/components/…` imports. If `Link` is now unused, remove its import.
2. Delete the line `  const signIn = signInHref(\`/sellers/${seller.slug}\`);`.
3. Replace `<Link href={signIn} prefetch={false}>` and its closing `</Link>` around "Report this seller" with `<ReportLink target={{ kind: "seller", id: seller.slug }}>` and `</ReportLink>`.

In `components/looking-for/RequestView.tsx` (part B):
1. Add `import { ReportLink } from "@/components/messages/SessionLinks";` among the `@/components/…` imports.
2. Replace the `<Link href={signIn} prefetch={false}>` and its `</Link>` around "Report this request" with `<ReportLink target={{ kind: "request", id: request.id }}>` and `</ReportLink>`. Offer to help keeps `signIn`.

Run: `pnpm test components/listing components/seller components/looking-for components/messages`
Expected: PASS.

- [ ] **Step 8: The sign-in page's back link**

In `app/login/page.tsx` (D Task 7):
1. Add `import { backPathFor } from "@/lib/messaging/paths";` above `import { safeNextPath } from "@/lib/next-path";`.
2. In `SignInForVisitor`, replace

```tsx
      {next && (
        <p className="signin-back">
          <Link href={next}>{next.startsWith("/listings/") ? "Back to the listing" : "Go back"}</Link>
        </p>
      )}
```

with

```tsx
      {back && (
        <p className="signin-back">
          <Link href={back}>{back.startsWith("/listings/") ? "Back to the listing" : "Go back"}</Link>
        </p>
      )}
```

and add, straight after the line `  const next = safeNextPath((await searchParams).next);`:

```tsx
  // A composer's or a report form's `next` leads back to its listing, shop or request, and a page that needs an
  // account gets no back link, since it would only come back here (messaging plan decision 4).
  const back = next ? backPathFor(next) : null;
```

`SignIn` still gets `next`: signing in goes on to the composer or the form.

- [ ] **Step 9: The end-to-end tests follow the new targets**

In `tests/e2e/listing.spec.ts`, in "messaging goes through the sign-in page and back", replace

```ts
  await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001$/);
```

with

```ts
  // Through sign-in and on to the composer; the back link goes to the listing (messaging plan decisions 3 and 4).
  await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001%2Fmessage$/);
```

In `tests/e2e/shopping.spec.ts`, in "Message goes through the sign-in page and back", replace

```ts
    await expect(page).toHaveURL(/\/login\?next=%2Fsellers%2Ftech-corner$/);
```

with

```ts
    await expect(page).toHaveURL(/\/login\?next=%2Fsellers%2Ftech-corner%2Fmessage$/);
```

In `tests/e2e/accounts.spec.ts` (D Task 13):
1. In "a first sign-in from a listing asks for a name and campus, then comes back to the listing": rename it "a first sign-in from a listing's Message seller asks for a name and campus, then goes on to the composer"; replace `await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001$/);` with `await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001%2Fmessage$/);`, and the `await expect(page).toHaveURL(/\/listings\/l-001$/);` after Continue with `await expect(page).toHaveURL(/\/listings\/l-001\/message$/);`.
2. In "Back to the sign-in page after signing in shows you're signed in": replace both `/\/login\?next=%2Flistings%2Fl-001$/` with `/\/login\?next=%2Flistings%2Fl-001%2Fmessage$/`, and `await expect(page).toHaveURL(/\/listings\/l-001$/);` with `await expect(page).toHaveURL(/\/listings\/l-001\/message$/);`.
3. In "a signed-in visitor who follows a sign-in link is told so, with the way back", replace

```ts
  await page.goto("/sellers/tech-corner");
  await page.getByRole("link", { name: "Message seller" }).click();
```

with

```ts
  // A sign-in link from a page drawn before signing in. Signed in, Message seller now goes to the composer.
  await page.goto("/login?next=%2Fsellers%2Ftech-corner");
```

If a test quotes these lines differently, change it by meaning and say so in the hand-over.

- [ ] **Step 10: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 8 more unit tests than after Task 6. The build still lists `/listings/[id]`, `/sellers/[slug]` and `/looking-for/[id]` as partly prerendered, with their known ids prerendered.

- [ ] **Step 11: Look at it**

Start the build (`pnpm start --port 3201`) and check, at 390 × 844, 768 × 1024 and 1280 × 800:
- Signed out, `/listings/l-001`: Message seller in the dock (phones) and in the page (tablet up), exactly where it was; it opens `/login?next=%2Flistings%2Fl-001%2Fmessage`, whose back link says "Back to the listing" and opens `/listings/l-001`. Report this listing opens `/login?next=%2Freport%3Flisting%3Dl-001`.
- Sign in as "Student, Midrand", then `/listings/l-001`: Message seller's address is `/messages/conv-s2` (Thandi's thread about it; the page itself comes in Task 10, so it may 404 until then); on `/listings/l-007` it's `/messages/conv-s1`; on `/listings/l-002` it's `/listings/l-002/message`. Report this listing is `/report?listing=l-001`. Nothing on the page moves as they stream in.
- `/sellers/tech-corner`: Message seller is `/sellers/tech-corner/message`, Report this seller `/report?seller=tech-corner`. `/looking-for/r-001`: Report this request is `/report?request=r-001`.

Stop the server.

- [ ] **Step 12: Measure the JS (the listing page has the least room)**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/listing.spec.ts tests/e2e/shopping.spec.ts tests/e2e/accounts.spec.ts --project=phone-390`
Expected: all pass. Note every page's `scriptBrotli` in the ledger. The listing page, the storefront and the request page should be within a few bytes of the start (the change is Server Components and a `Link` they already load). **If any page is past the stop line, stop here and report the figures** (the JS ledger's stop rule).

- [ ] **Step 13: Hand over for commit**

Files: `lib/messaging/links.ts`, `lib/messaging/links.test.ts`, `components/messages/SessionLinks.tsx`, `components/messages/SessionLinks.test.tsx`, `components/messages/ViewerLinks.tsx`, `components/messages/ViewerLinks.test.tsx`, `tests/helpers/viewer-links.tsx`, `components/listing/ListingActions.tsx`, `components/listing/ListingActions.test.tsx`, `components/listing/ListingView.tsx`, `components/listing/ListingView.test.tsx`, `components/seller/SellerHero.tsx`, `components/seller/SellerHero.test.tsx`, `components/seller/SellerView.tsx`, `components/seller/SellerView.test.tsx`, `components/looking-for/RequestView.tsx`, `components/looking-for/RequestView.test.tsx`, `app/login/page.tsx`, `tests/e2e/listing.spec.ts`, `tests/e2e/shopping.spec.ts`, `tests/e2e/accounts.spec.ts`, and any other test file Step 6's `grep` found.
Message: `feat: Message seller and Report follow the session from a streamed server part, and the sign-in page's back link skips the composer (messaging spec 3.6). JS: / <n> B, browse <n> B, listing <n> B, storefront <n> B, request <n> B`

---

### Task 8: The composer pages

`/listings/[id]/message` and `/sellers/[slug]/message` (spec 2.1 to 2.4 and 3.1; plan decisions 2, 5, 8, 9 and 25): the listing or shop at the top, "Message {shop}", the message and the swap offer, the three tips beside them, and the scam check's warning after a post. The parts shared with the thread come first.

**Files:**
- Create: `components/messages/MessageSummary.tsx`, `SafetyTips.tsx`, `ScamCheck.tsx`, `MessageField.tsx`, `parts.test.tsx`
- Create: `components/messages/ComposerView.tsx`, `ComposerView.test.tsx`, `Composer.tsx`, `Composer.test.tsx`, `ComposerSkeleton.tsx`
- Create: `app/listings/[id]/message/page.tsx`, `app/sellers/[slug]/message/page.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Read the docs**

Read "With Cache Components" in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` and in `03-api-reference/04-functions/generate-static-params.md` (at least one param; `params` awaited inside `<Suspense>`), and "Calling `notFound()` after streaming has started" in `03-api-reference/04-functions/not-found.md`. `app/listings/[id]/page.tsx` is the pattern: `params` is awaited inside `<Suspense>`, an unknown id calls `notFound()`, and there's no `dynamicParams` export.

- [ ] **Step 2: Write the shared parts' test**

Create `components/messages/parts.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getListingDetail, getSeller } from "@/lib/data";
import { MessageField } from "./MessageField";
import { MessageSummary } from "./MessageSummary";
import { SafetyTips } from "./SafetyTips";
import { ScamCheck } from "./ScamCheck";

describe("MessageSummary (messaging spec 3.1 and 3.3)", () => {
  it("shows the listing's photo, title, price, seller and campus, the title linking to the listing", async () => {
    const detail = (await getListingDetail("l-001"))!;
    render(<MessageSummary listing={detail.listing} listingTitle={null} shop={detail.seller} campusName="Midrand" />);
    expect(screen.getByRole("link", { name: "Casio fx-991ZA Plus calculator" })).toHaveAttribute("href", "/listings/l-001");
    expect(screen.getByText("R250 · Tech corner · Midrand")).toBeInTheDocument();
    // The photo is decorative: the title next to it says what it is.
    expect(document.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("says when the listing has been removed, keeping its title (selling spec 9)", () => {
    render(
      <MessageSummary
        listing={null}
        listingTitle="Casio fx-991ZA Plus calculator"
        shop={{ slug: "tech-corner", name: "Tech corner", image: null }}
        campusName="Midrand"
      />,
    );
    expect(screen.getByText("Casio fx-991ZA Plus calculator")).not.toHaveAttribute("href");
    expect(screen.getByText("This listing has been removed.")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows the shop for a question to the shop (plan decision 2)", async () => {
    render(<MessageSummary listing={null} listingTitle={null} shop={(await getSeller("tech-corner"))!} campusName="Midrand" />);
    expect(screen.getByRole("link", { name: "Tech corner" })).toHaveAttribute("href", "/sellers/tech-corner");
    expect(screen.getByText("A question for the shop · Midrand")).toBeInTheDocument();
  });
});

describe("SafetyTips (messaging spec 2.3)", () => {
  it("always shows the three tips, with the way to the safety page", () => {
    render(<SafetyTips />);
    const tips = screen.getByRole("region", { name: "Stay safe" });
    expect(within(tips).getAllByRole("listitem")).toHaveLength(3);
    expect(within(tips).getByRole("link", { name: "More safety tips" })).toHaveAttribute("href", "/safety");
  });
});

describe("ScamCheck (messaging spec 2.3, plan decision 9)", () => {
  it("is nothing when nothing matched", () => {
    const { container } = render(<ScamCheck warnings={[]} idPrefix="composer" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says what to check, with each matching tip and Send anyway, and is focused on a page load", () => {
    render(<ScamCheck warnings={["deposit", "code"]} idPrefix="composer" />);
    const check = screen.getByRole("alert", { name: "Check this before you send" });
    expect(within(check).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Don't pay a deposit or a booking fee to hold something. A real seller can wait until you meet.",
      "Never share a code sent to your phone. Anyone who asks for one is trying to get into your accounts.",
    ]);
    const anyway = within(check).getByRole("button", { name: "Send anyway" });
    expect(anyway).toHaveAttribute("type", "submit");
    expect(anyway).toHaveAttribute("name", "anyway");
    expect(anyway).toHaveAttribute("value", "yes");
    expect(renderToString(<ScamCheck warnings={["bank"]} idPrefix="composer" />)).toMatch(
      /<div[^>]*role="alert"[^>]*autofocus=""/,
    );
  });
});

describe("MessageField (messaging spec 3.1 and section 5)", () => {
  it("is a labelled text area with its hint, and its error when there is one", () => {
    const { rerender } = render(
      <MessageField id="composer-body" name="body" label="Your message" hint="Up to 1,000 characters." defaultValue="" error={undefined} rows={6} required />,
    );
    const field = screen.getByLabelText("Your message");
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAttribute("name", "body");
    expect(field).not.toHaveAttribute("maxlength");
    expect(field).toHaveAccessibleDescription("Up to 1,000 characters.");
    rerender(
      <MessageField
        id="composer-body"
        name="body"
        label="Your message"
        hint="Up to 1,000 characters."
        defaultValue="Hi"
        error="Write a message first."
        rows={6}
        required
      />,
    );
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Up to 1,000 characters. Error: Write a message first.");
  });
});
```

- [ ] **Step 3: Write the composer's tests**

Create `components/messages/ComposerView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormStateRow } from "@/lib/data/rows";
import type { MessageTarget } from "@/lib/messaging/paths";
import { composerSubject } from "@/lib/messaging/subjects";
import { composerForm, ComposerView, type ComposerStatus } from "./ComposerView";

// The form only needs something to post to; the action has its own test.
vi.mock("@/lib/messaging/actions", () => ({ sendFirstMessage: async () => {} }));

const EMPTY = composerForm(null);

const state = (fields: Partial<FormStateRow>): FormStateRow => ({
  key: "s:composer:listing:l-007",
  sessionKey: "s",
  form: "composer:listing:l-007",
  errors: [],
  values: {},
  notice: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...fields,
});

async function show(target: MessageTarget, status: ComposerStatus = { kind: "open" }, form = EMPTY) {
  const subject = (await composerSubject(target))!;
  return render(<ComposerView subject={subject} status={status} form={form} />);
}

const hidden = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input) => [input.name, input.value]);

describe("the composer (messaging spec 3.1)", () => {
  it("heads the page with the shop, shows the listing, and asks for a message", async () => {
    const { container } = await show({ kind: "listing", listingId: "l-001" });
    expect(screen.getByRole("heading", { level: 1, name: "Message Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/listings/l-001");
    expect(screen.getByRole("link", { name: "Casio fx-991ZA Plus calculator" })).toBeInTheDocument();
    const message = screen.getByLabelText("Your message");
    expect(message).toHaveAccessibleDescription(/^Up to 1,000 characters\./);
    expect(screen.queryByLabelText("Offer a swap (optional)")).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "submit");
    expect(hidden(container)).toEqual([["listing", "l-001"]]);
    expect(screen.getByRole("region", { name: "Stay safe" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers a swap when the listing takes swaps, saying what the seller would swap for (spec 2.4)", async () => {
    await show({ kind: "listing", listingId: "l-007" });
    const swap = screen.getByLabelText("Offer a swap (optional)");
    expect(swap.tagName).toBe("TEXTAREA");
    expect(swap).toHaveAccessibleDescription(
      "Tech corner would swap for a mechanical keyboard or a Bluetooth speaker. Up to 200 characters.",
    );
  });

  it("keeps what was typed and shows what's wrong after a failed post", async () => {
    const form = composerForm(
      state({ errors: ["message-missing", "swap-length"], values: { body: "", swapOffer: "x".repeat(201) } }),
    );
    await show({ kind: "listing", listingId: "l-007" }, { kind: "open" }, form);
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(within(summary).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "#composer-body",
      "#composer-swap",
    ]);
    expect(screen.getByLabelText("Offer a swap (optional)")).toHaveValue("x".repeat(201));
    expect(screen.getByLabelText("Your message")).toHaveAttribute("aria-invalid", "true");
  });

  it("warns about scam words with the message kept, and offers Send anyway (spec 2.3)", async () => {
    const form = composerForm(
      state({ notice: "check", values: { body: "Can I pay a deposit first?", swapOffer: "", warnings: "advance,deposit" } }),
    );
    await show({ kind: "listing", listingId: "l-001" }, { kind: "open" }, form);
    expect(screen.getByLabelText("Your message")).toHaveValue("Can I pay a deposit first?");
    const check = screen.getByRole("alert", { name: "Check this before you send" });
    expect(within(check).getAllByRole("listitem")).toHaveLength(2);
    // Send comes before Send anyway, so Enter in a field never sends anyway.
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Send", "Send anyway"]);
  });

  it("asks a shop a question, with no swap, and goes back to the shop (plan decision 2)", async () => {
    const { container } = await show({ kind: "shop", sellerSlug: "tech-corner" });
    expect(screen.getByRole("link", { name: "Back to the shop" })).toHaveAttribute("href", "/sellers/tech-corner");
    expect(screen.getByText("A question for the shop · Midrand")).toBeInTheDocument();
    expect(screen.queryByLabelText("Offer a swap (optional)")).toBeNull();
    expect(hidden(container)).toEqual([["shop", "tech-corner"]]);
  });

  it("says why there's no form: your own listing, a listing that isn't available, a conversation already", async () => {
    const { unmount } = await show({ kind: "listing", listingId: "l-001" }, { kind: "own" });
    expect(screen.getByText("This is your listing, so you can't message yourself.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    unmount();
    const again = await show({ kind: "listing", listingId: "l-026" }, { kind: "unavailable" });
    expect(screen.getByText("This listing isn't available right now, so it can't be messaged.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See similar items" })).toHaveAttribute("href", "/browse?cat=tech");
    again.unmount();
    await show({ kind: "listing", listingId: "l-001" }, { kind: "existing", conversationId: "conv-s2" });
    expect(screen.getByText("You've already messaged Tech corner about this.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute("href", "/messages/conv-s2");
  });
});
```

Create `components/messages/Composer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { getAccount } from "@/lib/data/accounts";
import { Composer } from "./Composer";

const session = vi.hoisted(() => ({ accountId: "acc-mentor" }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async () => (await import("@/lib/data/accounts")).getAccount(session.accountId),
}));
vi.mock("@/lib/auth/form-state", () => ({ readFormState: async () => null }));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("@/lib/messaging/actions", () => ({ sendFirstMessage: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  session.accountId = "acc-mentor";
});

describe("the composer for this visitor (messaging spec 3.1, plan decision 5)", () => {
  it("shows the form to someone who hasn't messaged about the listing", async () => {
    render(await Composer({ target: { kind: "listing", listingId: "l-001" } }));
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("points to the conversation the visitor already has", async () => {
    session.accountId = "acc-student";
    render(await Composer({ target: { kind: "listing", listingId: "l-001" } }));
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute("href", "/messages/conv-s2");
  });

  it("tells a seller their own listing and shop can't be messaged", async () => {
    session.accountId = "acc-seller";
    expect((await getAccount("acc-seller"))?.seller?.sellerSlug).toBe("tech-corner");
    const { unmount } = render(await Composer({ target: { kind: "listing", listingId: "l-001" } }));
    expect(screen.getByText("This is your listing, so you can't message yourself.")).toBeInTheDocument();
    unmount();
    render(await Composer({ target: { kind: "shop", sellerSlug: "tech-corner" } }));
    expect(screen.getByText("This is your shop, so you can't message yourself.")).toBeInTheDocument();
  });

  it("is the 404 for a listing or shop that doesn't exist", async () => {
    await expect(Composer({ target: { kind: "listing", listingId: "l-nope" } })).rejects.toThrow("notFound");
    await expect(Composer({ target: { kind: "shop", sellerSlug: "nope" } })).rejects.toThrow("notFound");
  });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test components/messages/parts.test.tsx components/messages/ComposerView.test.tsx components/messages/Composer.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 5: Write the shared parts**

Create `components/messages/MessageSummary.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { Photo } from "@/components/listings/Photo";
import { priceLabel } from "@/lib/format";
import type { ImageRef, Listing } from "@/lib/types";

type MessageSummaryProps = {
  /** The listing as it is now, or null for a question to the shop or a listing that has gone. */
  listing: Listing | null;
  /** The listing's title when the conversation started, for one that has gone (selling spec 9). */
  listingTitle: string | null;
  shop: { slug: string; name: string; image: ImageRef | null };
  campusName: string;
  /** Anything to show at the end of the card, such as the thread's status pill. */
  children?: ReactNode;
};

/**
 * What a conversation is about (messaging spec 3.1 and 3.3): the listing's photo, title, price, seller and campus; a
 * removed listing's title; or the shop, for a question to it (plan decision 2). The photo is decorative: the title
 * beside it says what it is.
 */
export function MessageSummary({ listing, listingTitle, shop, campusName, children }: MessageSummaryProps) {
  const image = listing ? listing.image : listingTitle ? null : shop.image;
  let text: ReactNode;
  if (listing) {
    text = (
      <>
        <Link href={`/listings/${listing.id}`} prefetch={false} className="msg-summary-title">
          {listing.title}
        </Link>
        <p className="msg-summary-meta">{`${priceLabel(listing)} · ${shop.name} · ${campusName}`}</p>
      </>
    );
  } else if (listingTitle) {
    text = (
      <>
        <p className="msg-summary-title">{listingTitle}</p>
        <p className="msg-summary-meta">This listing has been removed.</p>
      </>
    );
  } else {
    text = (
      <>
        <Link href={`/sellers/${shop.slug}`} prefetch={false} className="msg-summary-title">
          {shop.name}
        </Link>
        <p className="msg-summary-meta">{`A question for the shop · ${campusName}`}</p>
      </>
    );
  }
  return (
    <div className="msg-summary">
      {image && <Photo image={{ src: image.src, alt: "" }} ratio="1 / 1" sizes="72px" className="msg-summary-photo" />}
      <div className="msg-summary-text">{text}</div>
      {children}
    </div>
  );
}
```

Create `components/messages/SafetyTips.tsx`:

```tsx
import Link from "next/link";
import { SAFETY_TIPS } from "@/lib/messaging/scam-check";

/** The three tips always beside the composer (messaging spec 2.3), and the way to the safety page. */
export function SafetyTips() {
  return (
    <section aria-labelledby="composer-tips-title" className="msg-tips">
      <h2 id="composer-tips-title" className="msg-tips-title">
        Stay safe
      </h2>
      <ul>
        {SAFETY_TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <Link href="/safety" prefetch={false}>
        More safety tips
      </Link>
    </section>
  );
}
```

Create `components/messages/ScamCheck.tsx`:

```tsx
import { SCAM_TIPS, type ScamWarning } from "@/lib/messaging/scam-check";

/**
 * "Check this before you send" (messaging spec 2.3, plan decision 9): the tip for each kind of scam word found, and
 * Send anyway, which posts the form again with anyway=yes. It sits inside the form, after Send, so Enter in a field
 * never sends anyway. Like D's error summary, it's an alert, and the browser focuses it on a page load (D decision 11).
 */
export function ScamCheck({ warnings, idPrefix }: { warnings: readonly ScamWarning[]; idPrefix: string }) {
  if (warnings.length === 0) return null;
  const titleId = `${idPrefix}-check-title`;
  return (
    <div role="alert" tabIndex={-1} autoFocus aria-labelledby={titleId} className="msg-check">
      <h2 id={titleId} className="msg-check-title">
        Check this before you send
      </h2>
      <ul className="msg-check-list">
        {warnings.map((kind) => (
          <li key={kind}>{SCAM_TIPS.get(kind)}</li>
        ))}
      </ul>
      <p className="msg-check-hint">Change your message and press Send, or send it as it is.</p>
      <button type="submit" name="anyway" value="yes" className="btn btn-outline text-navy">
        Send anyway
      </button>
    </div>
  );
}
```

Create `components/messages/MessageField.tsx`:

```tsx
import { describedBy, FieldError } from "@/components/forms/FieldError";

type MessageFieldProps = {
  id: string;
  name: string;
  label: string;
  hint: string;
  defaultValue: string;
  error: string | undefined;
  rows: number;
  required?: boolean;
};

/**
 * A labelled text area for a message, a swap offer or a report's detail (messaging spec 3.1, 3.3 and 3.4). No
 * maxlength, so a long paste isn't cut short without a word: the server says what's too long (plan decision 8).
 */
export function MessageField({ id, name, label, hint, defaultValue, error, rows, required }: MessageFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <p id={hintId} className="form-hint">
        {hint}
      </p>
      <FieldError id={errorId} message={error} />
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, error && errorId)}
        className="form-input msg-textarea"
      />
    </div>
  );
}
```

Run: `pnpm test components/messages/parts.test.tsx`
Expected: PASS.

- [ ] **Step 6: Write the composer**

Create `components/messages/ComposerView.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { ArrowLeftIcon } from "@/components/icons";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { sendFirstMessage } from "@/lib/messaging/actions";
import { COMPOSER_FIELDS, messagingErrors } from "@/lib/messaging/errors";
import { threadPath } from "@/lib/messaging/paths";
import { parseWarnings, type ScamWarning } from "@/lib/messaging/scam-check";
import type { ComposerSubject } from "@/lib/messaging/subjects";
import { MessageField } from "./MessageField";
import { MessageSummary } from "./MessageSummary";
import { SafetyTips } from "./SafetyTips";
import { ScamCheck } from "./ScamCheck";

/** The composer's fields after a post (D decision 3): what was typed, what's wrong, and the scam check's warnings. */
export type ComposerForm = { body: string; swapOffer: string; errors: FormError[]; warnings: ScamWarning[] };

export function composerForm(state: FormStateRow | null): ComposerForm {
  if (!state) return { body: "", swapOffer: "", errors: [], warnings: [] };
  return {
    body: state.values.body ?? "",
    swapOffer: state.values.swapOffer ?? "",
    errors: messagingErrors(state.errors, COMPOSER_FIELDS),
    warnings: state.notice === "check" ? parseWarnings(state.values.warnings) : [],
  };
}

/** Whether the visitor can write here (spec 3.1, plan decision 5). */
export type ComposerStatus =
  | { kind: "open" }
  | { kind: "own" }
  | { kind: "unavailable" }
  | { kind: "existing"; conversationId: string };

type ComposerViewProps = {
  subject: ComposerSubject;
  status: ComposerStatus;
  form: ComposerForm;
};

/** The composer (messaging spec 3.1): the listing or shop, "Message {shop}", the form or why there's none, the tips. */
export function ComposerView({ subject, status, form }: ComposerViewProps) {
  const { listing, seller, campusName } = subject;
  const back = listing
    ? { href: `/listings/${listing.id}`, label: "Back to the listing" }
    : { href: `/sellers/${seller.slug}`, label: "Back to the shop" };
  let main: ReactNode = null;
  switch (status.kind) {
    case "own":
      main = (
        <p className="form-notice">{`This is your ${listing ? "listing" : "shop"}, so you can't message yourself.`}</p>
      );
      break;
    case "unavailable":
      main = (
        <div className="composer-note">
          <p className="form-notice">This listing isn&apos;t available right now, so it can&apos;t be messaged.</p>
          {listing && (
            <Link href={`/browse?cat=${listing.categorySlug}`} className="btn btn-outline text-navy">
              See similar items
            </Link>
          )}
        </div>
      );
      break;
    case "existing":
      main = (
        <div className="composer-note">
          <p className="form-notice">
            {listing
              ? `You've already messaged ${seller.name} about this.`
              : `You already have a conversation with ${seller.name}.`}
          </p>
          <Link href={threadPath(status.conversationId)} prefetch={false} className="btn btn-primary">
            Open the conversation
          </Link>
        </div>
      );
      break;
    case "open":
      main = <ComposerForm subject={subject} form={form} />;
      break;
  }
  return (
    <>
      <Link href={back.href} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        {back.label}
      </Link>
      <h1 className="composer-title">{`Message ${seller.name}`}</h1>
      <div className="composer-layout">
        <div className="composer-main">
          <MessageSummary listing={listing} listingTitle={null} shop={seller} campusName={campusName} />
          {main}
        </div>
        <SafetyTips />
      </div>
    </>
  );
}

/** The form itself: the message, the swap offer when the listing takes swaps (spec 2.4), the check, and Send. */
function ComposerForm({ subject, form }: { subject: ComposerSubject; form: ComposerForm }) {
  const { target, listing, seller, swaps } = subject;
  const swapHint = listing?.swapFor
    ? `${seller.name} would swap for ${listing.swapFor}. Up to 200 characters.`
    : "Say what you'd swap. Up to 200 characters.";
  return (
    <>
      <ErrorSummary errors={form.errors} />
      <form action={sendFirstMessage} noValidate className="form-stack composer-form">
        {target.kind === "listing" ? (
          <input type="hidden" name="listing" value={target.listingId} />
        ) : (
          <input type="hidden" name="shop" value={target.sellerSlug} />
        )}
        <MessageField
          id={COMPOSER_FIELDS.body}
          name="body"
          label="Your message"
          hint="Up to 1,000 characters. Ask what you need to know, and say when you could meet."
          defaultValue={form.body}
          error={errorFor(form.errors, COMPOSER_FIELDS.body)}
          rows={6}
          required
        />
        {swaps && (
          <MessageField
            id={COMPOSER_FIELDS.swapOffer}
            name="swapOffer"
            label="Offer a swap (optional)"
            hint={swapHint}
            defaultValue={form.swapOffer}
            error={errorFor(form.errors, COMPOSER_FIELDS.swapOffer)}
            rows={2}
          />
        )}
        <button type="submit" className="btn btn-primary form-submit">
          Send
        </button>
        <ScamCheck warnings={form.warnings} idPrefix="composer" />
      </form>
    </>
  );
}
```

Create `components/messages/Composer.tsx`:

```tsx
import { notFound } from "next/navigation";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { findConversation } from "@/lib/data/messages";
import { composerFormKey, composerPath, type MessageTarget } from "@/lib/messaging/paths";
import { composerSubject, shopSlugOf } from "@/lib/messaging/subjects";
import { composerForm, ComposerView, type ComposerStatus } from "./ComposerView";

/**
 * The composer for this request's visitor (messaging spec 3.1). Request-time: it reads the session, so each page puts
 * it inside <Suspense>. An unknown listing or shop is the 404; a signed-out visitor goes to sign-in and back (accounts
 * spec 2.10). Its own listing or shop, a listing that isn't available, and a conversation already started each get a
 * note instead of the form (plan decision 5).
 */
export async function Composer({ target }: { target: MessageTarget }) {
  const subject = await composerSubject(target);
  if (!subject) notFound();
  const account = await requireAccount(composerPath(target));
  const [existing, state] = await Promise.all([
    findConversation(account.id, target),
    readFormState(composerFormKey(target)),
  ]);
  let status: ComposerStatus = { kind: "open" };
  if (subject.seller.slug === shopSlugOf(account)) status = { kind: "own" };
  else if (!subject.open) status = { kind: "unavailable" };
  else if (existing) status = { kind: "existing", conversationId: existing };
  return <ComposerView subject={subject} status={status} form={composerForm(state)} />;
}
```

Create `components/messages/ComposerSkeleton.tsx`:

```tsx
/** The composer's room while it streams in (messaging spec 3.1): the back link, the heading, the card and the form. */
export function ComposerSkeleton() {
  return (
    <div className="composer-skeleton" aria-hidden="true">
      <span className="skeleton composer-skeleton-crumb" />
      <span className="skeleton composer-skeleton-title" />
      <span className="skeleton composer-skeleton-summary" />
      <span className="skeleton composer-skeleton-form" />
    </div>
  );
}
```

Run: `pnpm test components/messages`
Expected: PASS.

- [ ] **Step 7: The pages**

Create `app/listings/[id]/message/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Composer } from "@/components/messages/Composer";
import { ComposerSkeleton } from "@/components/messages/ComposerSkeleton";
import { getListingIds } from "@/lib/data";
import { composerSubject } from "@/lib/messaging/subjects";

/** "Message Tech corner · Vossie"; a page for one visitor, so search engines leave it out (plan decision 24). */
export async function generateMetadata({ params }: PageProps<"/listings/[id]/message">): Promise<Metadata> {
  const { id } = await params;
  const subject = await composerSubject({ kind: "listing", listingId: id });
  return { title: subject ? `Message ${subject.seller.name}` : "Page not found", robots: { index: false } };
}

/** One sample listing, so the build checks the request-time parts sit inside <Suspense> (plan decision 25). */
export async function generateStaticParams() {
  return (await getListingIds()).slice(0, 1).map((id) => ({ id }));
}

/** The composer for a listing (messaging spec 2.1 and 3.1). Everything after the frame needs the session. */
export default function ListingComposerPage({ params }: PageProps<"/listings/[id]/message">) {
  return (
    <div className="page composer-page">
      <Suspense fallback={<ComposerSkeleton />}>
        <ListingComposer params={params} />
      </Suspense>
    </div>
  );
}

async function ListingComposer({ params }: Pick<PageProps<"/listings/[id]/message">, "params">) {
  const { id } = await params;
  return <Composer target={{ kind: "listing", listingId: id }} />;
}
```

Create `app/sellers/[slug]/message/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Composer } from "@/components/messages/Composer";
import { ComposerSkeleton } from "@/components/messages/ComposerSkeleton";
import { getSellerSlugs } from "@/lib/data";
import { composerSubject } from "@/lib/messaging/subjects";

/** "Message Tech corner · Vossie"; kept out of search engines (plan decision 24). */
export async function generateMetadata({ params }: PageProps<"/sellers/[slug]/message">): Promise<Metadata> {
  const { slug } = await params;
  const subject = await composerSubject({ kind: "shop", sellerSlug: slug });
  return { title: subject ? `Message ${subject.seller.name}` : "Page not found", robots: { index: false } };
}

/** One sample shop, so the build checks the request-time parts sit inside <Suspense> (plan decision 25). */
export async function generateStaticParams() {
  return (await getSellerSlugs()).slice(0, 1).map((slug) => ({ slug }));
}

/** A question to a shop, from its storefront (messaging spec 3.6, plan decision 2). */
export default function ShopComposerPage({ params }: PageProps<"/sellers/[slug]/message">) {
  return (
    <div className="page composer-page">
      <Suspense fallback={<ComposerSkeleton />}>
        <ShopComposer params={params} />
      </Suspense>
    </div>
  );
}

async function ShopComposer({ params }: Pick<PageProps<"/sellers/[slug]/message">, "params">) {
  const { slug } = await params;
  return <Composer target={{ kind: "shop", sellerSlug: slug }} />;
}
```

`PageProps<"/listings/[id]/message">` comes from `next typegen` (run by `pnpm typecheck`); if the editor complains before that, run `pnpm typecheck` once.

- [ ] **Step 8: The styles**

Append to the end of `app/globals.css`:

```css

/* --- Messaging: shared parts (messaging plan, Task 8, spec 2.3, 3.1 and 3.3) --- */
@layer components {
  .msg-crumb {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-weight: 600;
  }

  .msg-crumb svg {
    width: 20px;
    height: 20px;
  }

  .msg-summary {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px;
    border: 1.5px solid var(--color-line);
    border-radius: var(--radius-card);
  }

  .msg-summary-photo {
    flex: none;
    width: 72px;
    overflow: hidden;
    border-radius: 10px;
  }

  .msg-summary-text {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }

  .msg-summary-title {
    color: var(--color-navy);
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  /* Underlined, so colour isn't the only sign it's a link, and a 44px target (CLAUDE.md). */
  a.msg-summary-title {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    min-height: 44px;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .msg-summary-meta {
    color: var(--color-muted);
    font-size: 14px;
  }

  /* D's .form-input, grown to the rows it's given, and only taller by hand. */
  .msg-textarea {
    min-height: 0;
    line-height: 1.5;
    resize: vertical;
  }

  /* The tips: navy on pale is 11:1; links on pale are navy (CLAUDE.md). */
  .msg-tips {
    padding: 16px 18px;
    border-radius: var(--radius-card);
    background: var(--color-pale);
    color: var(--color-navy);
  }

  .msg-tips-title {
    font-weight: 700;
  }

  .msg-tips ul {
    display: grid;
    gap: 8px;
    margin-top: 8px;
    padding-left: 1.25rem;
    list-style: disc;
  }

  .msg-tips a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* The scam check: D's error summary's frame, in danger red (6.6:1 on white). */
  .msg-check {
    display: grid;
    gap: 10px;
    padding: 16px 18px;
    border: 2px solid var(--color-danger);
    border-radius: var(--radius-card);
    background: var(--color-white);
  }

  .msg-check-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 22px;
    line-height: 1.05;
    text-transform: uppercase;
  }

  .msg-check-list {
    display: grid;
    gap: 6px;
    padding-left: 1.25rem;
    list-style: disc;
  }

  .msg-check-hint {
    color: var(--color-muted);
    font-size: 14px;
  }

  .msg-check .btn {
    justify-self: start;
  }
}

/* --- Messaging: the composer (messaging plan, Task 8, spec 3.1) --- */
@layer components {
  /* .page and .composer-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .composer-page {
    padding: 16px 16px 64px;
  }

  .composer-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .composer-layout {
    display: grid;
    gap: 24px;
    margin-top: 20px;
  }

  .composer-main {
    display: grid;
    gap: 20px;
    min-width: 0;
  }

  .composer-note {
    display: grid;
    gap: 12px;
    justify-items: start;
  }

  .composer-skeleton {
    display: grid;
    gap: 16px;
  }

  .composer-skeleton-crumb {
    width: 10rem;
    height: 44px;
  }

  .composer-skeleton-title {
    width: 70%;
    height: var(--text-section);
  }

  .composer-skeleton-summary {
    height: 98px;
    border-radius: var(--radius-card);
  }

  .composer-skeleton-form {
    height: 24rem;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .composer-page {
      padding-inline: 40px;
    }
  }

  /* Desktop: the form on the left, the tips beside it (spec 2.3). */
  @media (min-width: 64rem) and (min-height: 30rem) {
    .composer-layout {
      grid-template-columns: minmax(0, 40rem) 18rem;
      column-gap: 48px;
      align-items: start;
    }
  }
}
```

Before adding, check the names are free: `grep -n "\.msg-\|\.composer-" app/globals.css` prints nothing.

- [ ] **Step 9: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 17 more unit tests than after Task 7 (parts 7, the composer 6, its visitor 4). The build lists `/listings/[id]/message` and `/sellers/[slug]/message` as partly prerendered, with one id each.

- [ ] **Step 10: Look at it**

Start the build (`pnpm start --port 3201`), sign in as "Student, Midrand", and check at 390 × 844, 768 × 1024 and 1280 × 800:
- `/listings/l-002/message`: "Back to the listing", "MESSAGE BOOK SWAP", the card (photo, title underlined, "R300 · Book swap · Midrand"), "Your message" with its hint, Send, and the pale "Stay safe" box with three tips: below the form on phones and tablets, to the right on desktop.
- Send with nothing typed: the red-bordered summary "THERE'S A PROBLEM" linking to the field, and "Error: Write a message first." under the label.
- Type "Can I pay a deposit first?" and Send: the message is still there, and the red "CHECK THIS BEFORE YOU SEND" box under Send lists two tips and Send anyway. Send anyway goes to `/messages/…` (the thread arrives in Task 10, so a 404 is expected until then).
- `/listings/l-007/message` (sign in as "Mentor" first, who has no conversation there): the swap field, "Tech corner would swap for a mechanical keyboard or a Bluetooth speaker. Up to 200 characters."
- `/listings/l-001/message` as Thandi: "You've already messaged Tech corner about this." and Open the conversation. `/listings/l-026/message`: not available, See similar items. As "Seller, Tech corner": `/listings/l-001/message` says it's your listing; `/sellers/tech-corner/message` says it's your shop.

Stop the server.

- [ ] **Step 11: Hand over for commit**

Files: `components/messages/MessageSummary.tsx`, `components/messages/SafetyTips.tsx`, `components/messages/ScamCheck.tsx`, `components/messages/MessageField.tsx`, `components/messages/parts.test.tsx`, `components/messages/ComposerView.tsx`, `components/messages/ComposerView.test.tsx`, `components/messages/Composer.tsx`, `components/messages/Composer.test.tsx`, `components/messages/ComposerSkeleton.tsx`, `app/listings/[id]/message/page.tsx`, `app/sellers/[slug]/message/page.tsx`, `app/globals.css`.
Message: `feat: the composer pages for a listing and for a shop question, with the swap offer, the tips and the scam check (messaging spec 2.1 to 2.4 and 3.1)`

---

### Task 9: The inbox

`/messages` (spec 2.10, 2.11 and 3.2; plan decisions 19, 22 and 28): "Messages", the Buying and Selling tabs as links, Refresh, and the account's conversations, newest first, each a link with the other side's name, what it's about, the last line, the time, the status pill and an unread mark.

**Files:**
- Modify: `tests/helpers/fakes.ts`
- Create: `components/messages/StatusPill.tsx`, `components/messages/InboxView.tsx`, `components/messages/InboxView.test.tsx`
- Create: `components/messages/Inbox.tsx`, `components/messages/Inbox.test.tsx`, `components/messages/InboxSkeleton.tsx`
- Create: `app/messages/page.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: A conversation for tests**

In `tests/helpers/fakes.ts`, add `ConversationSummary` to the `import type { … } from "@/lib/types";` line (keeping the names in alphabetical order), and append:

```ts

/** An inbox row for tests: an unread-free "Asked" question about a test listing. Override what the test is about. */
export function makeSummary(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: "conv-test",
    role: "buyer",
    otherName: "Tech corner",
    listingTitle: "Test listing",
    image: { src: "/placeholders/listing/tech.svg", alt: "Test listing" },
    preview: "Is it still available?",
    lastFromViewer: false,
    lastMessageAt: "2026-10-14T10:00:00Z",
    status: "asked",
    unread: false,
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the inbox's tests**

Create `components/messages/InboxView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeSummary } from "@/tests/helpers/fakes";
import { InboxView } from "./InboxView";
import { StatusPill } from "./StatusPill";

// Wednesday 14 October 2026, 15:00 in South Africa.
const NOW = new Date("2026-10-14T13:00:00Z");

describe("the inbox (messaging spec 3.2)", () => {
  it("has the Buying and Selling tabs only for an account with a shop, marking the open one (spec 2.10)", () => {
    const { unmount } = render(<InboxView tab="buying" hasShop={false} conversations={[]} now={NOW} />);
    expect(screen.queryByRole("navigation", { name: "Buying and selling" })).toBeNull();
    unmount();
    render(<InboxView tab="selling" hasShop conversations={[]} now={NOW} />);
    const tabs = screen.getByRole("navigation", { name: "Buying and selling" });
    const buying = within(tabs).getByRole("link", { name: "Buying" });
    const selling = within(tabs).getByRole("link", { name: "Selling" });
    expect(buying).toHaveAttribute("href", "/messages");
    expect(buying).not.toHaveAttribute("aria-current");
    expect(selling).toHaveAttribute("href", "/messages?tab=selling");
    expect(selling).toHaveAttribute("aria-current", "page");
  });

  it("lists each conversation as a link to its thread: who, what about, the last line, when, the status, unread", () => {
    render(
      <InboxView
        tab="buying"
        hasShop={false}
        now={NOW}
        conversations={[
          makeSummary({
            id: "conv-a",
            listingTitle: "Gaming headset, barely used",
            preview: "Can I see the speaker first?",
            lastMessageAt: "2026-10-14T12:05:00Z",
            status: "replied",
            unread: true,
          }),
          makeSummary({
            id: "conv-b",
            otherName: "Book swap",
            listingTitle: null,
            image: null,
            preview: "Do you have Accounting 2?",
            lastFromViewer: true,
            lastMessageAt: "2026-10-12T08:00:00Z",
          }),
        ]}
      />,
    );
    const rows = within(screen.getByRole("region", { name: "Buying" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", "/messages/conv-a");
    expect(within(rows[0]).getByText("Unread,")).toHaveClass("sr-only");
    expect(within(rows[0]).getByText("Tech corner")).toBeInTheDocument();
    expect(within(rows[0]).getByText("14:05")).toHaveAttribute("datetime", "2026-10-14T12:05:00Z");
    expect(within(rows[0]).getByText("Gaming headset, barely used")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Can I see the speaker first?")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Replied")).toHaveAttribute("data-status", "replied");
    expect(within(rows[1]).getByRole("link")).toHaveAttribute("href", "/messages/conv-b");
    expect(within(rows[1]).getByText("You: Do you have Accounting 2?")).toBeInTheDocument();
    expect(within(rows[1]).getByText("A question for the shop")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Mon")).toBeInTheDocument();
    expect(within(rows[1]).queryByText("Unread,")).toBeNull();
  });

  it("invites a buyer with no messages to browse (spec 3.2)", () => {
    render(<InboxView tab="buying" hasShop={false} conversations={[]} now={NOW} />);
    expect(screen.getByText("No messages yet. Find something you like and message the seller.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
  });

  it("tells a seller with no enquiries where they'll show up (plan decision 26)", () => {
    render(<InboxView tab="selling" hasShop conversations={[]} now={NOW} />);
    expect(screen.getByText("No enquiries yet. When a buyer messages your shop, it shows up here.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse" })).toBeNull();
  });

  it("has Refresh, a full page load of the same tab (plan decision 19)", () => {
    render(<InboxView tab="selling" hasShop conversations={[makeSummary()]} now={NOW} />);
    expect(screen.getByRole("link", { name: "Refresh" })).toHaveAttribute("href", "/messages?tab=selling");
  });
});

describe("StatusPill (messaging spec 2.5 and section 5)", () => {
  it("says the status in words", () => {
    render(
      <>
        <StatusPill status="asked" />
        <StatusPill status="replied" />
        <StatusPill status="done" />
        <StatusPill status="confirmed" />
      </>,
    );
    expect(["Asked", "Replied", "Done", "Confirmed"].map((label) => screen.getByText(label).dataset.status)).toEqual([
      "asked",
      "replied",
      "done",
      "confirmed",
    ]);
  });
});
```

Create `components/messages/Inbox.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { Inbox } from "./Inbox";

const session = vi.hoisted(() => ({ accountId: "acc-student" }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async () => (await import("@/lib/data/accounts")).getAccount(session.accountId),
}));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T08:42:00.000Z"));
});

afterEach(() => {
  session.accountId = "acc-student";
});

describe("the inbox for this visitor (messaging spec 2.10 and 3.2)", () => {
  it("shows a buyer's conversations, with no tabs when the account has no shop", async () => {
    render(await Inbox({ tab: "buying" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("navigation", { name: "Buying and selling" })).toBeNull();
  });

  it("shows Buying, not Selling, when an account without a shop asks for Selling (plan decision 22)", async () => {
    render(await Inbox({ tab: "selling" }));
    expect(screen.getByRole("region", { name: "Buying" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Refresh" })).toHaveAttribute("href", "/messages");
  });

  it("shows a seller's enquiries under Selling", async () => {
    session.accountId = "acc-seller";
    render(await Inbox({ tab: "selling" }));
    expect(screen.getByRole("link", { name: "Selling" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("Thandi")).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test components/messages/InboxView.test.tsx components/messages/Inbox.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 4: Write the inbox**

Create `components/messages/StatusPill.tsx`:

```tsx
import { statusLabel } from "@/lib/messaging/rules";
import type { ConversationStatus } from "@/lib/types";

/** A conversation's status, in words (messaging spec 2.5 and section 5); the colour only backs them up. */
export function StatusPill({ status }: { status: ConversationStatus }) {
  return (
    <span className="status-pill" data-status={status}>
      {statusLabel(status)}
    </span>
  );
}
```

Create `components/messages/InboxView.tsx`:

```tsx
import Link from "next/link";
import { Photo } from "@/components/listings/Photo";
import { inboxPath, threadPath } from "@/lib/messaging/paths";
import { inboxTime } from "@/lib/time";
import type { ConversationSummary, InboxTab } from "@/lib/types";
import { StatusPill } from "./StatusPill";

type InboxViewProps = {
  tab: InboxTab;
  /** Selling shows only for an account with a storefront (plan decision 22). */
  hasShop: boolean;
  conversations: readonly ConversationSummary[];
  /** Read after `await connection()`, for the times (plan decision 28). */
  now: Date;
};

/** The inbox (messaging spec 3.2): the tabs, Refresh, and the conversations or the empty state. */
export function InboxView({ tab, hasShop, conversations, now }: InboxViewProps) {
  const title = tab === "buying" ? "Buying" : "Selling";
  return (
    <div className="inbox-body">
      <div className="inbox-bar">
        {hasShop && (
          <nav aria-label="Buying and selling" className="inbox-tabs">
            <ul>
              <li>
                <Link
                  href={inboxPath("buying")}
                  prefetch={false}
                  aria-current={tab === "buying" ? "page" : undefined}
                  className="inbox-tab"
                >
                  Buying
                </Link>
              </li>
              <li>
                <Link
                  href={inboxPath("selling")}
                  prefetch={false}
                  aria-current={tab === "selling" ? "page" : undefined}
                  className="inbox-tab"
                >
                  Selling
                </Link>
              </li>
            </ul>
          </nav>
        )}
        {/* A full page load: the one way to be sure the server is asked again (plan decision 19). */}
        <a href={inboxPath(tab)} className="msg-refresh">
          Refresh
        </a>
      </div>
      <section aria-labelledby="inbox-list-title">
        <h2 id="inbox-list-title" className="sr-only">
          {title}
        </h2>
        {conversations.length > 0 ? (
          <ul className="inbox-list">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <InboxRow conversation={conversation} now={now} />
              </li>
            ))}
          </ul>
        ) : (
          <InboxEmpty tab={tab} />
        )}
      </section>
    </div>
  );
}

/** One conversation: a link to its thread, read as "Unread, Tech corner, 14:05, …" (spec 3.2 and section 5). */
function InboxRow({ conversation, now }: { conversation: ConversationSummary; now: Date }) {
  const { id, otherName, listingTitle, image, preview, lastFromViewer, lastMessageAt, status, unread } = conversation;
  return (
    <Link href={threadPath(id)} prefetch={false} className="inbox-row" data-unread={unread || undefined}>
      {image ? (
        <Photo image={{ src: image.src, alt: "" }} ratio="1 / 1" sizes="56px" className="inbox-photo" />
      ) : (
        <span className="inbox-photo inbox-photo-empty" aria-hidden="true" />
      )}
      <span className="inbox-text">
        <span className="inbox-top">
          {unread && <span className="sr-only">Unread,</span>} <span className="inbox-name">{otherName}</span>{" "}
          <time dateTime={lastMessageAt} className="inbox-time">
            {inboxTime(lastMessageAt, now)}
          </time>
        </span>{" "}
        <span className="inbox-about">{listingTitle ?? "A question for the shop"}</span>{" "}
        <span className="inbox-preview">{lastFromViewer ? `You: ${preview}` : preview}</span>
      </span>{" "}
      <span className="inbox-end">
        <StatusPill status={status} />
        {unread && <span className="inbox-dot" aria-hidden="true" />}
      </span>
    </Link>
  );
}

function InboxEmpty({ tab }: { tab: InboxTab }) {
  if (tab === "selling") {
    return (
      <div className="inbox-empty">
        <p>No enquiries yet. When a buyer messages your shop, it shows up here.</p>
      </div>
    );
  }
  return (
    <div className="inbox-empty">
      <p>No messages yet. Find something you like and message the seller.</p>
      <Link href="/browse" className="btn btn-primary">
        Browse
      </Link>
    </div>
  );
}
```

Create `components/messages/Inbox.tsx`:

```tsx
import { connection } from "next/server";
import { requireAccount } from "@/lib/auth/session";
import { getInbox } from "@/lib/data/messages";
import { inboxPath } from "@/lib/messaging/paths";
import { shopSlugOf } from "@/lib/messaging/subjects";
import type { InboxTab } from "@/lib/types";
import { InboxView } from "./InboxView";

/**
 * The inbox for this request's visitor (messaging spec 3.2). Request-time: the page puts it inside <Suspense>. A
 * signed-out visitor goes to sign-in and back; Selling without a shop shows Buying (plan decision 22).
 */
export async function Inbox({ tab }: { tab: InboxTab }) {
  const account = await requireAccount(inboxPath(tab));
  const hasShop = shopSlugOf(account) !== null;
  const shown: InboxTab = hasShop ? tab : "buying";
  // The times and the 7-day auto-confirm read the clock (decision 26).
  await connection();
  const now = new Date();
  const conversations = await getInbox(account.id, shown, now);
  return <InboxView tab={shown} hasShop={hasShop} conversations={conversations} now={now} />;
}
```

Create `components/messages/InboxSkeleton.tsx`:

```tsx
/** The inbox's room while it streams in (messaging spec 3.2): the tabs' bar and three rows. */
export function InboxSkeleton() {
  return (
    <div className="inbox-body inbox-skeleton" aria-hidden="true">
      <span className="skeleton inbox-skeleton-bar" />
      <span className="skeleton inbox-skeleton-row" />
      <span className="skeleton inbox-skeleton-row" />
      <span className="skeleton inbox-skeleton-row" />
    </div>
  );
}
```

Run: `pnpm test components/messages`
Expected: PASS.

- [ ] **Step 5: The page**

Create `app/messages/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Inbox } from "@/components/messages/Inbox";
import { InboxSkeleton } from "@/components/messages/InboxSkeleton";
import { parseInboxTab } from "@/lib/messaging/paths";

/** A page for one person, so search engines leave it out (plan decision 24). */
export const metadata: Metadata = { title: "Messages", robots: { index: false } };

/**
 * The inbox (messaging spec 3.2). The heading is prerendered; the tabs and conversations need the session, so they
 * render per request inside <Suspense>.
 */
export default function MessagesPage({ searchParams }: PageProps<"/messages">) {
  return (
    <div className="page inbox-page">
      <h1 className="inbox-title">Messages</h1>
      <Suspense fallback={<InboxSkeleton />}>
        <InboxForVisitor searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function InboxForVisitor({ searchParams }: Pick<PageProps<"/messages">, "searchParams">) {
  return <Inbox tab={parseInboxTab((await searchParams).tab)} />;
}
```

- [ ] **Step 6: The styles**

Check the names are free (`grep -n "\.inbox-\|\.status-pill\|\.msg-refresh" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Messaging: the status pill and Refresh (messaging plan, Task 9, spec 2.5, 2.6 and section 5) --- */
@layer components {
  /* The words carry the status; the fill backs them up. Navy on white, navy on pale and sky, white on navy. */
  .status-pill {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 0 10px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
    background: var(--color-white);
    color: var(--color-navy);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .status-pill[data-status="replied"] {
    border-color: var(--color-pale);
    background: var(--color-pale);
  }

  .status-pill[data-status="done"] {
    border-color: var(--color-sky);
    background: var(--color-sky);
  }

  .status-pill[data-status="confirmed"] {
    border-color: var(--color-navy);
    background: var(--color-navy);
    color: var(--color-white);
  }

  .msg-refresh {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

/* --- Messaging: the inbox (messaging plan, Task 9, spec 3.2) --- */
@layer components {
  /* .page and .inbox-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .inbox-page {
    padding: 24px 16px 64px;
  }

  .inbox-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
  }

  .inbox-body {
    max-width: 48rem;
  }

  .inbox-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-top: 16px;
  }

  /* Refresh stays at the end, with or without the tabs. */
  .inbox-bar .msg-refresh {
    margin-left: auto;
  }

  .inbox-tabs ul {
    display: flex;
    gap: 8px;
  }

  .inbox-tab {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 18px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
    color: var(--color-navy);
    font-weight: 600;
  }

  .inbox-tab[aria-current="page"] {
    background: var(--color-navy);
    color: var(--color-white);
  }

  .inbox-list {
    margin-top: 12px;
    border-top: 1.5px solid var(--color-line);
  }

  .inbox-list li {
    border-bottom: 1.5px solid var(--color-line);
  }

  .inbox-row {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 80px;
    padding-block: 12px;
    color: var(--color-ink);
  }

  .inbox-photo {
    width: 56px;
    overflow: hidden;
    border-radius: 10px;
  }

  .inbox-photo-empty {
    aspect-ratio: 1;
    background: var(--color-panel);
  }

  .inbox-text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .inbox-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .inbox-name,
  .inbox-about,
  .inbox-preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inbox-name {
    color: var(--color-navy);
    font-weight: 700;
  }

  .inbox-time {
    flex: none;
    color: var(--color-muted);
    font-size: 13px;
  }

  .inbox-about {
    color: var(--color-navy);
    font-size: 14px;
  }

  .inbox-preview {
    color: var(--color-muted);
    font-size: 14px;
  }

  .inbox-row[data-unread] .inbox-preview {
    color: var(--color-ink);
    font-weight: 600;
  }

  .inbox-end {
    display: grid;
    justify-items: end;
    gap: 8px;
  }

  /* The unread mark: danger red, as the header's badge (plan decision 10). The row says "Unread" in words too. */
  .inbox-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--color-danger);
  }

  @media (hover: hover) and (pointer: fine) {
    .inbox-row:hover .inbox-name {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }

  .inbox-empty {
    display: grid;
    justify-items: start;
    gap: 16px;
    margin-top: 16px;
    padding: 24px;
    border-radius: var(--radius-panel);
    background: var(--color-panel);
  }

  .inbox-skeleton {
    display: grid;
    gap: 12px;
  }

  .inbox-skeleton-bar {
    height: 44px;
    margin-top: 16px;
  }

  .inbox-skeleton-row {
    height: 80px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .inbox-page {
      padding-inline: 40px;
    }
  }
}
```

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 9 more unit tests than after Task 8 (the inbox's view 6, its visitor 3). The build lists `/messages` as partly prerendered.

- [ ] **Step 8: Look at it**

Start the build (`pnpm start --port 3201`) and check at 390 × 844, 768 × 1024 and 1280 × 800:
- Signed out, `/messages` goes to `/login?next=%2Fmessages`, and that page has no back link (plan decision 4).
- As "Student, Midrand": "MESSAGES", no tabs, Refresh on the right, two rows: Tech corner about the headset, "Hi Thandi, it is. Can I see the speaker first?", "Tue" (or the date, depending on today), the pale REPLIED pill and a red dot; then the calculator, "You: Perfect, see you there.", the sky DONE pill. Long lines end in "…" without pushing the pill off the screen at 390px.
- As "Seller, Tech corner": Buying (outlined) and Selling tabs; `/messages?tab=selling` fills Selling in navy and lists the two rows from Thandi.
- As "Mentor": the empty state with Browse.

Stop the server.

- [ ] **Step 9: Hand over for commit**

Files: `tests/helpers/fakes.ts`, `components/messages/StatusPill.tsx`, `components/messages/InboxView.tsx`, `components/messages/InboxView.test.tsx`, `components/messages/Inbox.tsx`, `components/messages/Inbox.test.tsx`, `components/messages/InboxSkeleton.tsx`, `app/messages/page.tsx`, `app/globals.css`.
Message: `feat: the inbox: Buying and Selling tabs as links, Refresh, and each conversation with its status and unread mark (messaging spec 2.10 and 3.2)`

---

### Task 10: A thread

`/messages/[id]` (spec 2.4 to 2.6, 2.12, 3.3 and section 5; plan decisions 6, 7, 9, 19 to 21, 25, 28 and 30): the other side's name and Refresh, the listing with the status pill, the messages oldest first as bubbles with who and when in words, the swap offer as a pale callout, the sale's buttons, and the reply form. Opening it marks it read; only the buyer and the seller can open it.

**Files:**
- Modify: `tests/helpers/fakes.ts`
- Create: `components/messages/SaleActions.tsx`, `components/messages/ThreadView.tsx`, `components/messages/ThreadView.test.tsx`
- Create: `components/messages/OpenThread.tsx`, `components/messages/OpenThread.test.tsx`, `components/messages/ThreadSkeleton.tsx`
- Create: `app/messages/[id]/page.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: A thread for tests**

In `tests/helpers/fakes.ts`, add `Thread` to the `import type { … } from "@/lib/types";` line (in alphabetical order), and append:

```ts

/** A thread for tests: the buyer's view of an Asked conversation with Tech corner about a test listing. */
export function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "conv-test",
    role: "buyer",
    otherName: "Tech corner",
    otherPresent: true,
    shop: {
      slug: "tech-corner",
      name: "Tech corner",
      image: { src: "/placeholders/seller/tech-corner.svg", alt: "The tech corner at work" },
      campusSlug: "midrand",
    },
    listingTitle: "Test listing",
    listing: makeListing({ id: "l-test", title: "Test listing" }),
    status: "asked",
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    messages: [
      {
        id: "msg-1",
        fromViewer: true,
        author: "You",
        body: "Is it still available?",
        swapOffer: null,
        sentAt: "2026-10-14T10:00:00Z",
      },
    ],
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the thread's tests**

Create `components/messages/ThreadView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormStateRow } from "@/lib/data/rows";
import { makeThread } from "@/tests/helpers/fakes";
import { replyForm, ThreadView } from "./ThreadView";

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/messaging/actions", () => ({
  confirmTheSale: async () => {},
  markAsCompleted: async () => {},
  saleDidntHappen: async () => {},
  sendReply: async () => {},
}));

// Wednesday 14 October 2026, 15:00 in South Africa.
const NOW = new Date("2026-10-14T13:00:00Z");
const EMPTY = replyForm(null);

function show(thread = makeThread(), { sent = false, reply = EMPTY } = {}) {
  return render(<ThreadView thread={thread} now={NOW} reply={reply} sent={sent} campusName="Midrand" />);
}

const state = (fields: Partial<FormStateRow>): FormStateRow => ({
  key: "s:reply:conv-test",
  sessionKey: "s",
  form: "reply:conv-test",
  errors: [],
  values: {},
  notice: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...fields,
});

describe("a thread (messaging spec 3.3)", () => {
  it("is headed by the other side, with the way back, Refresh, and the listing with its status", () => {
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Messages with Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to messages" })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: "Refresh" })).toHaveAttribute("href", "/messages/conv-test");
    expect(screen.getByRole("link", { name: "Test listing" })).toHaveAttribute("href", "/listings/l-test");
    expect(screen.getByText("Asked")).toHaveClass("status-pill");
  });

  it("goes back to Selling for the seller", () => {
    show(makeThread({ role: "seller", otherName: "Ayanda" }));
    expect(screen.getByRole("link", { name: "Back to messages" })).toHaveAttribute("href", "/messages?tab=selling");
    expect(screen.getByRole("heading", { level: 1, name: "Messages with Ayanda" })).toBeInTheDocument();
  });

  it("lists the messages in order, each saying who wrote it and when, in words (spec section 5)", () => {
    show(
      makeThread({
        messages: [
          {
            id: "m1",
            fromViewer: true,
            author: "You",
            body: "Would you swap?\nI can meet at the library.",
            swapOffer: "A mechanical keyboard",
            sentAt: "2026-10-12T08:00:00Z",
          },
          { id: "m2", fromViewer: false, author: "Tech corner", body: "Yes!", swapOffer: null, sentAt: "2026-10-14T12:05:00Z" },
        ],
      }),
    );
    const items = within(screen.getByRole("region", { name: "Messages" })).getAllByRole("listitem");
    expect(items.map((item) => item.dataset.from)).toEqual(["you", "them"]);
    expect(within(items[0]).getByText("You")).toBeInTheDocument();
    expect(within(items[0]).getByText("12 Oct, 10:00")).toHaveAttribute("datetime", "2026-10-12T08:00:00Z");
    expect(within(items[0]).getByText(/^Would you swap\?/).textContent).toBe("Would you swap?\nI can meet at the library.");
    expect(within(items[0]).getByText("Swap offer:").closest("p")).toHaveTextContent("Swap offer: A mechanical keyboard");
    expect(within(items[1]).getByText("Tech corner")).toBeInTheDocument();
    expect(within(items[1]).getByText("14:05")).toBeInTheDocument();
  });

  it("shows a message's text as text: no markup, and no links made from addresses (spec 2.12)", () => {
    const { container } = show(
      makeThread({
        messages: [
          {
            id: "m1",
            fromViewer: false,
            author: "Tech corner",
            body: "<b>Pay here</b> https://example.com",
            swapOffer: null,
            sentAt: "2026-10-14T12:05:00Z",
          },
        ],
      }),
    );
    expect(screen.getByText("<b>Pay here</b> https://example.com")).toBeInTheDocument();
    expect(container.querySelector(".thread-list b, .thread-list a")).toBeNull();
  });

  it("says \"Sent.\" once, after the composer (plan decision 7)", () => {
    const { unmount } = show(makeThread(), { sent: true });
    expect(screen.getByRole("status")).toHaveTextContent("Sent. Sellers usually reply within a day.");
    unmount();
    show();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("has a labelled reply form that posts the conversation's id and keeps a failed reply (section 5)", () => {
    const { container } = show(makeThread(), {
      reply: replyForm(state({ errors: ["message-missing"], values: { body: "" } })),
    });
    const reply = screen.getByRole("region", { name: "Reply" });
    expect(within(reply).getByLabelText("Your reply")).toHaveAttribute("aria-invalid", "true");
    expect(within(reply).getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(within(reply).getByRole("button", { name: "Send" })).toHaveAttribute("type", "submit");
    expect(container.querySelector<HTMLInputElement>('input[name="conversation"]')?.value).toBe("conv-test");
  });

  it("warns about scam words in a reply, with Send anyway (plan decision 9)", () => {
    show(makeThread(), {
      reply: replyForm(state({ notice: "check", values: { body: "Send your banking details", warnings: "bank" } })),
    });
    expect(screen.getByLabelText("Your reply")).toHaveValue("Send your banking details");
    expect(screen.getByRole("alert", { name: "Check this before you send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send anyway" })).toBeInTheDocument();
  });

  it("has no reply form once the other side has left (plan decision 21)", () => {
    show(makeThread({ otherName: "Deleted account", otherPresent: false }));
    expect(screen.queryByLabelText("Your reply")).toBeNull();
    expect(screen.getByText("The other person has left Vossie, so you can't reply.")).toBeInTheDocument();
  });
});

describe("the sale (messaging spec 2.5, plan decision 30)", () => {
  it("offers the seller Mark as completed once they've replied", () => {
    const { container } = show(makeThread({ role: "seller", otherName: "Ayanda", status: "replied" }));
    expect(screen.getByRole("button", { name: "Mark as completed" })).toHaveAttribute("type", "submit");
    expect(screen.getByText("When the sale or swap has happened. Ayanda is then asked to confirm it.")).toBeInTheDocument();
    expect(container.querySelectorAll('input[name="conversation"]')).toHaveLength(2);
  });

  it("asks the buyer whether a sale marked done happened, and says when it confirms itself", () => {
    show(makeThread({ status: "done", completedAt: "2026-10-13T15:00:00.000Z" }));
    const ask = screen.getByRole("region", { name: "Did the sale happen?" });
    expect(within(ask).getByText(/^Tech corner marked this as completed on 13 Oct\./)).toHaveTextContent(
      "Tech corner marked this as completed on 13 Oct. If you don't answer, it confirms itself on 20 Oct.",
    );
    expect(within(ask).getByRole("button", { name: "Confirm the sale" })).toBeInTheDocument();
    expect(within(ask).getByRole("button", { name: "It didn't happen" })).toBeInTheDocument();
  });

  it("tells the seller they're waiting for the buyer", () => {
    show(makeThread({ role: "seller", otherName: "Ayanda", status: "done", completedAt: "2026-10-13T15:00:00.000Z" }));
    expect(screen.getByText(/^You marked this as completed on 13 Oct\./)).toHaveTextContent(
      "You marked this as completed on 13 Oct. Ayanda is asked to confirm it; if they don't answer, it confirms itself on 20 Oct.",
    );
    expect(screen.queryByRole("button", { name: "Confirm the sale" })).toBeNull();
  });

  it("says when and how a sale was confirmed", () => {
    const { unmount } = show(
      makeThread({ status: "confirmed", confirmedAt: "2026-10-14T09:00:00.000Z", confirmedBy: "buyer" }),
    );
    expect(screen.getByText("Sale confirmed on 14 Oct.")).toBeInTheDocument();
    unmount();
    show(makeThread({ status: "confirmed", confirmedAt: "2026-10-20T15:00:00.000Z", confirmedBy: "auto" }));
    expect(
      screen.getByText("Sale confirmed automatically on 20 Oct, a week after it was marked completed."),
    ).toBeInTheDocument();
  });

  it("offers nothing before a reply, nor to a buyer before the sale is marked done", () => {
    const { unmount } = show(makeThread({ role: "seller", otherName: "Ayanda", status: "asked" }));
    expect(screen.queryByRole("button", { name: "Mark as completed" })).toBeNull();
    unmount();
    show(makeThread({ status: "replied" }));
    expect(screen.queryByRole("button", { name: /Mark as completed|Confirm the sale/ })).toBeNull();
  });
});
```

Create `components/messages/OpenThread.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { OpenThread } from "./OpenThread";

const session = vi.hoisted(() => ({ accountId: "acc-student", sent: false }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async () => (await import("@/lib/data/accounts")).getAccount(session.accountId),
}));
vi.mock("@/lib/auth/form-state", () => ({ readFormState: async () => null }));
vi.mock("@/lib/messaging/form-state", () => ({ takeSentNote: async () => session.sent }));
vi.mock("@/lib/messaging/actions", () => ({
  confirmTheSale: async () => {},
  markAsCompleted: async () => {},
  saleDidntHappen: async () => {},
  sendReply: async () => {},
}));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  session.accountId = "acc-student";
  session.sent = false;
});

describe("a thread for this visitor (messaging spec 3.3)", () => {
  it("shows the buyer the thread, marks it read, and says Sent. when the composer left it", async () => {
    session.sent = true;
    render(await OpenThread({ id: "conv-s1" }));
    expect(screen.getByRole("heading", { level: 1, name: "Messages with Tech corner" })).toBeInTheDocument();
    expect(screen.getByText("Midrand", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sent.");
    expect(sampleStore().messages.get("msg-s2")?.readAt).toBe(NOW.toISOString());
    expect(sampleStore().notifications.get("note-s1")?.readAt).toBe(NOW.toISOString());
  });

  it("is the 404 for anyone but the buyer and the seller, and for an id that doesn't exist (spec 3.3)", async () => {
    session.accountId = "acc-mentor";
    await expect(OpenThread({ id: "conv-s1" })).rejects.toThrow("notFound");
    session.accountId = "acc-student";
    await expect(OpenThread({ id: "conv-nope" })).rejects.toThrow("notFound");
    expect(sampleStore().messages.get("msg-s2")?.readAt).toBeNull();
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test components/messages/ThreadView.test.tsx components/messages/OpenThread.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 4: Write the thread**

Create `components/messages/SaleActions.tsx`:

```tsx
import { confirmTheSale, markAsCompleted, saleDidntHappen } from "@/lib/messaging/actions";
import { autoConfirmAt } from "@/lib/messaging/rules";
import { shortSastDate } from "@/lib/time";
import type { Thread } from "@/lib/types";

/** The conversation's id, for the sale's forms. The action checks it against the session (plan decision 30). */
function ConversationField({ id }: { id: string }) {
  return <input type="hidden" name="conversation" value={id} />;
}

/**
 * The sale (messaging spec 2.5, plan decision 30): the seller's Mark as completed once they've replied; the buyer's
 * Confirm the sale and It didn't happen once it's done; and lines saying where it stands. Every press is a plain form.
 */
export function SaleActions({ thread }: { thread: Thread }) {
  const { id, role, status, otherName, otherPresent, completedAt, confirmedAt, confirmedBy } = thread;
  if (status === "confirmed" && confirmedAt) {
    const line =
      confirmedBy === "auto"
        ? `Sale confirmed automatically on ${shortSastDate(confirmedAt)}, a week after it was marked completed.`
        : `Sale confirmed on ${shortSastDate(confirmedAt)}.`;
    return <p className="thread-sale">{line}</p>;
  }
  if (status === "done" && completedAt) {
    const marked = shortSastDate(completedAt);
    const auto = shortSastDate(autoConfirmAt(completedAt));
    if (role === "seller") {
      return (
        <p className="thread-sale">
          {`You marked this as completed on ${marked}. ${otherName} is asked to confirm it; if they don't answer, it confirms itself on ${auto}.`}
        </p>
      );
    }
    return (
      <section aria-labelledby="thread-sale-title" className="thread-sale thread-sale-ask">
        <h2 id="thread-sale-title" className="thread-sale-title">
          Did the sale happen?
        </h2>
        <p>{`${otherName} marked this as completed on ${marked}. If you don't answer, it confirms itself on ${auto}.`}</p>
        <div className="thread-sale-buttons">
          <form action={confirmTheSale}>
            <ConversationField id={id} />
            <button type="submit" className="btn btn-primary">
              Confirm the sale
            </button>
          </form>
          <form action={saleDidntHappen}>
            <ConversationField id={id} />
            <button type="submit" className="btn btn-outline text-navy">
              It didn&apos;t happen
            </button>
          </form>
        </div>
      </section>
    );
  }
  if (status === "replied" && role === "seller" && otherPresent) {
    return (
      <form action={markAsCompleted} className="thread-sale thread-sale-mark">
        <ConversationField id={id} />
        <button type="submit" className="btn btn-outline text-navy">
          Mark as completed
        </button>
        <p className="form-hint">{`When the sale or swap has happened. ${otherName} is then asked to confirm it.`}</p>
      </form>
    );
  }
  return null;
}
```

Create `components/messages/ThreadView.tsx`:

```tsx
import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { ArrowLeftIcon } from "@/components/icons";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { sendReply } from "@/lib/messaging/actions";
import { messagingErrors, REPLY_FIELDS } from "@/lib/messaging/errors";
import { inboxPath, threadPath } from "@/lib/messaging/paths";
import { parseWarnings, type ScamWarning } from "@/lib/messaging/scam-check";
import { messageTime } from "@/lib/time";
import type { Thread } from "@/lib/types";
import { MessageField } from "./MessageField";
import { MessageSummary } from "./MessageSummary";
import { SaleActions } from "./SaleActions";
import { ScamCheck } from "./ScamCheck";
import { StatusPill } from "./StatusPill";

/** The reply form after a post (D decision 3): what was typed, what's wrong, and the scam check's warnings. */
export type ReplyForm = { body: string; errors: FormError[]; warnings: ScamWarning[] };

export function replyForm(state: FormStateRow | null): ReplyForm {
  if (!state) return { body: "", errors: [], warnings: [] };
  return {
    body: state.values.body ?? "",
    errors: messagingErrors(state.errors, REPLY_FIELDS),
    warnings: state.notice === "check" ? parseWarnings(state.values.warnings) : [],
  };
}

type ThreadViewProps = {
  thread: Thread;
  /** Read after `await connection()`, for the times (plan decision 28). */
  now: Date;
  reply: ReplyForm;
  /** The composer has just sent the first message (plan decision 7). */
  sent: boolean;
  campusName: string;
};

/**
 * A thread (messaging spec 3.3): who it's with, Refresh, the listing and its status, the messages, the sale, and the
 * reply form. Each message says who wrote it and when in words, so it isn't read by colour or side alone (section 5).
 * Message text is React text: no markup, and addresses aren't made into links (spec 2.12).
 */
export function ThreadView({ thread, now, reply, sent, campusName }: ThreadViewProps) {
  return (
    <div className="thread-column">
      <Link href={inboxPath(thread.role === "seller" ? "selling" : "buying")} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        Back to messages
      </Link>
      <div className="thread-head">
        <h1 className="thread-title">
          {/* The space sits outside the sr-only span: name computation trims each element's own text. */}
          <span className="sr-only">Messages with</span> {thread.otherName}
        </h1>
        {/* A full page load: the one way to be sure the other side's new messages show (plan decision 19). */}
        <a href={threadPath(thread.id)} className="msg-refresh">
          Refresh
        </a>
      </div>
      <MessageSummary
        listing={thread.listing}
        listingTitle={thread.listingTitle}
        shop={thread.shop}
        campusName={campusName}
      >
        <StatusPill status={thread.status} />
      </MessageSummary>
      {sent && (
        <p role="status" className="form-notice">
          Sent. Sellers usually reply within a day.
        </p>
      )}
      <section aria-labelledby="thread-messages-title">
        <h2 id="thread-messages-title" className="sr-only">
          Messages
        </h2>
        <ol className="thread-list">
          {thread.messages.map((message) => (
            <li key={message.id} className="thread-message" data-from={message.fromViewer ? "you" : "them"}>
              <p className="thread-meta">
                <span className="thread-author">{message.author}</span>
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, </span>
                <time dateTime={message.sentAt}>{messageTime(message.sentAt, now)}</time>
              </p>
              <p className="thread-text">{message.body}</p>
              {message.swapOffer && (
                <p className="thread-swap">
                  <strong>Swap offer:</strong> {message.swapOffer}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
      <SaleActions thread={thread} />
      {thread.otherPresent ? (
        <ReplyFormView thread={thread} reply={reply} />
      ) : (
        <p className="form-notice">The other person has left Vossie, so you can&apos;t reply.</p>
      )}
    </div>
  );
}

function ReplyFormView({ thread, reply }: { thread: Thread; reply: ReplyForm }) {
  return (
    <section aria-labelledby="thread-reply-title" className="thread-reply">
      <h2 id="thread-reply-title" className="sr-only">
        Reply
      </h2>
      <ErrorSummary errors={reply.errors} />
      {/* A new form after each message: Activity would otherwise keep the text just sent (plan decision 20). */}
      <form key={thread.messages.length} action={sendReply} noValidate className="form-stack">
        <input type="hidden" name="conversation" value={thread.id} />
        <MessageField
          id={REPLY_FIELDS.body}
          name="body"
          label="Your reply"
          hint="Up to 1,000 characters."
          defaultValue={reply.body}
          error={errorFor(reply.errors, REPLY_FIELDS.body)}
          rows={4}
          required
        />
        <button type="submit" className="btn btn-primary form-submit">
          Send
        </button>
        <ScamCheck warnings={reply.warnings} idPrefix="thread" />
      </form>
    </section>
  );
}
```

Create `components/messages/OpenThread.tsx`:

```tsx
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses } from "@/lib/data";
import { getThread, markThreadRead } from "@/lib/data/messages";
import { takeSentNote } from "@/lib/messaging/form-state";
import { replyFormKey, threadPath } from "@/lib/messaging/paths";
import { replyForm, ThreadView } from "./ThreadView";

/**
 * A thread for this request's visitor (messaging spec 3.3). Request-time: the page puts it inside <Suspense>. A
 * signed-out visitor goes to sign-in and back; anyone but the buyer and the seller, and an id that doesn't exist, get
 * the same 404, so nothing says which conversations exist. Opening it marks it read, and takes "Sent." if the
 * composer left it (plan decision 7).
 */
export async function OpenThread({ id }: { id: string }) {
  const account = await requireAccount(threadPath(id));
  // The times, the 7-day auto-confirm and marking read all read the clock (decision 26).
  await connection();
  const now = new Date();
  const thread = await getThread(id, account.id, now);
  if (!thread) notFound();
  await markThreadRead(id, account.id, now);
  const [sent, state, campuses] = await Promise.all([takeSentNote(id), readFormState(replyFormKey(id)), getCampuses()]);
  const campusSlug = thread.listing?.campusSlug ?? thread.shop.campusSlug;
  const campusName = campuses.find((campus) => campus.slug === campusSlug)?.name ?? "";
  return <ThreadView thread={thread} now={now} reply={replyForm(state)} sent={sent} campusName={campusName} />;
}
```

Create `components/messages/ThreadSkeleton.tsx`:

```tsx
/** A thread's room while it streams in (messaging spec 3.3): the heading, the listing, three bubbles and the reply. */
export function ThreadSkeleton() {
  return (
    <div className="thread-column" aria-hidden="true">
      <span className="skeleton composer-skeleton-crumb" />
      <span className="skeleton composer-skeleton-title" />
      <span className="skeleton composer-skeleton-summary" />
      <span className="skeleton thread-skeleton-bubble" />
      <span className="skeleton thread-skeleton-bubble thread-skeleton-theirs" />
      <span className="skeleton thread-skeleton-bubble" />
      <span className="skeleton thread-skeleton-reply" />
    </div>
  );
}
```

Run: `pnpm test components/messages`
Expected: PASS.

- [ ] **Step 5: The page**

Create `app/messages/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { OpenThread } from "@/components/messages/OpenThread";
import { ThreadSkeleton } from "@/components/messages/ThreadSkeleton";

/** A conversation belongs to two people, so search engines leave it out (plan decision 24). */
export const metadata: Metadata = { title: "Messages", robots: { index: false } };

/**
 * One sample id, so the build checks the page keeps its request-time parts inside <Suspense> (plan decision 25). It
 * matches no conversation: the build stops at the session read, and a visit to it is the 404.
 */
export function generateStaticParams() {
  return [{ id: "conv-sample" }];
}

/** A thread (messaging spec 3.3). Everything needs the session, so it renders per request inside <Suspense>. */
export default function ThreadPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <div className="page thread-page">
      <Suspense fallback={<ThreadSkeleton />}>
        <ThreadForVisitor params={params} />
      </Suspense>
    </div>
  );
}

async function ThreadForVisitor({ params }: Pick<PageProps<"/messages/[id]">, "params">) {
  const { id } = await params;
  return <OpenThread id={id} />;
}
```

- [ ] **Step 6: The styles**

Check the names are free (`grep -n "\.thread-" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Messaging: a thread (messaging plan, Task 10, spec 3.3 and section 5) --- */
@layer components {
  /* .page and .thread-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .thread-page {
    padding: 16px 16px 64px;
  }

  .thread-column {
    display: grid;
    gap: 20px;
    max-width: 48rem;
  }

  .thread-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .thread-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .thread-list {
    display: grid;
    gap: 12px;
  }

  /* Yours on the right in navy, theirs on the left on panel (spec 3.3). Who and when are words above the text. */
  .thread-message {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 16px;
  }

  .thread-message[data-from="you"] {
    justify-self: end;
    border-bottom-right-radius: 4px;
    background: var(--color-navy);
    color: var(--color-white);
  }

  .thread-message[data-from="them"] {
    justify-self: start;
    border-bottom-left-radius: 4px;
    background: var(--color-panel);
    color: var(--color-ink);
  }

  .thread-meta {
    font-size: 12px;
    font-weight: 600;
  }

  /* Muted on panel is 5.4:1. On navy the meta stays white. */
  .thread-message[data-from="them"] .thread-meta {
    color: var(--color-muted);
  }

  /* Line breaks are kept (spec 2.12); a long word or address wraps instead of widening the page. */
  .thread-text {
    margin-top: 2px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  /* The swap offer: a pale callout, navy on pale, in either bubble (spec 3.3). */
  .thread-swap {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--color-pale);
    color: var(--color-navy);
    overflow-wrap: anywhere;
  }

  .thread-sale {
    display: grid;
    gap: 10px;
    justify-items: start;
    padding: 16px 18px;
    border-radius: var(--radius-card);
    background: var(--color-panel);
  }

  .thread-sale-ask {
    background: var(--color-pale);
    color: var(--color-navy);
  }

  .thread-sale-title {
    font-family: var(--vos-font-display);
    font-size: 22px;
    line-height: 1.05;
    text-transform: uppercase;
  }

  .thread-sale-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .thread-reply {
    display: grid;
    gap: 16px;
    padding-top: 20px;
    border-top: 1.5px solid var(--color-line);
  }

  .thread-skeleton-bubble {
    justify-self: end;
    width: 70%;
    height: 72px;
    border-radius: 16px;
  }

  .thread-skeleton-theirs {
    justify-self: start;
  }

  .thread-skeleton-reply {
    height: 13rem;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .thread-page {
      padding-inline: 40px;
    }

    .thread-message {
      max-width: 70%;
    }
  }
}
```

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 15 more unit tests than after Task 9 (the thread's view 13, its visitor 2). The build lists `/messages/[id]` as partly prerendered, with one sample id.

- [ ] **Step 8: Look at it**

Start the build (`pnpm start --port 3201`) and check at 390 × 844, 768 × 1024 and 1280 × 800:
- As "Student, Midrand", from `/messages` open the headset: "Back to messages", "TECH CORNER" and Refresh, the card with the pale REPLIED pill, then Thandi's navy bubble on the right ("You · 13 Oct, 10:12", the text, and the pale "Swap offer: A JBL Go 3…" callout) and Sipho's panel bubble on the left, its two lines kept. Then the reply form. Back to `/messages`: the red dot has gone (the page was loaded again by the link).
- Open the calculator: the pale "DID THE SALE HAPPEN?" box with "Tech corner marked this as completed on 13 Oct. If you don't answer, it confirms itself on 20 Oct." and the two buttons (from 20 October 2026 the sample sale has confirmed itself: "Sale confirmed automatically on 20 Oct…" instead). Press It didn't happen: the pill says REPLIED and the box goes.
- Reply "What's your bank account number?": the message stays in the field, and the red check box under Send lists the bank tip with Send anyway. Send anyway: the reply is the last navy bubble and the field is empty.
- As "Seller, Tech corner", `/messages?tab=selling`, open the calculator: Mark as completed (outlined) with its hint; press it: DONE, and "You marked this as completed on {today}…".
- As "Mentor", open `/messages/conv-s1` by its address: the 404 page.

Stop the server. (These looks change the sample store; restarting the server resets it.)

- [ ] **Step 9: Hand over for commit**

Files: `tests/helpers/fakes.ts`, `components/messages/SaleActions.tsx`, `components/messages/ThreadView.tsx`, `components/messages/ThreadView.test.tsx`, `components/messages/OpenThread.tsx`, `components/messages/OpenThread.test.tsx`, `components/messages/ThreadSkeleton.tsx`, `app/messages/[id]/page.tsx`, `app/globals.css`.
Message: `feat: a thread: messages as bubbles with who and when in words, the swap offer, the sale's buttons, Refresh and the reply form (messaging spec 2.5, 2.6 and 3.3)`

---

### Task 11: The report pages

`/report?listing=…` (or `seller=`, `request=`) and its thank-you, `/report/sent?…` (spec 2.8 and 3.4; plan decisions 17 and 26): "Report this listing", what it is, the seven reasons as radio buttons, the optional detail and Send report; then "Thanks. The Hub reviews reports within two working days. We'll let you know what happens." with the way back.

**Files:**
- Create: `components/messages/ReportView.tsx`, `components/messages/ReportView.test.tsx`
- Create: `components/messages/Report.tsx`, `components/messages/Report.test.tsx`, `components/messages/ReportSkeleton.tsx`
- Create: `components/messages/ReportSentBack.tsx`, `components/messages/ReportSentBack.test.tsx`
- Create: `app/report/page.tsx`, `app/report/sent/page.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Write the report form's tests**

Create `components/messages/ReportView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormStateRow } from "@/lib/data/rows";
import { reportForm, ReportView } from "./ReportView";

// The form only needs something to post to; the action has its own test.
vi.mock("@/lib/messaging/actions", () => ({ sendReport: async () => {} }));

const LISTING = { kind: "listing", id: "l-001" } as const;
const SUBJECT = { title: "Casio fx-991ZA Plus calculator", href: "/listings/l-001", backLabel: "Back to the listing" };

const state = (fields: Partial<FormStateRow>): FormStateRow => ({
  key: "s:report:listing:l-001",
  sessionKey: "s",
  form: "report:listing:l-001",
  errors: [],
  values: {},
  notice: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...fields,
});

describe("the report form (messaging spec 3.4)", () => {
  it("names what's reported, and asks why with seven reasons and an optional detail", () => {
    const { container } = render(<ReportView target={LISTING} subject={SUBJECT} already={false} form={reportForm(null)} />);
    expect(screen.getByRole("heading", { level: 1, name: "Report this listing" })).toBeInTheDocument();
    expect(screen.getByText("Casio fx-991ZA Plus calculator")).toHaveClass("report-subject");
    expect(screen.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/listings/l-001");
    const reasons = screen.getByRole("group", { name: "Why are you reporting it?" });
    expect(within(reasons).getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "scam",
      "prohibited",
      "misleading",
      "offensive",
      "harassment",
      "spam",
      "other",
    ]);
    expect(within(reasons).getByRole("radio", { name: "Scam or fraud" })).not.toBeChecked();
    expect(screen.getByLabelText("Tell us more (optional)")).toHaveAccessibleDescription(/^Up to 500 characters\./);
    expect(screen.getByRole("button", { name: "Send report" })).toHaveAttribute("type", "submit");
    expect(
      [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input) => [input.name, input.value]),
    ).toEqual([
      ["kind", "listing"],
      ["id", "l-001"],
    ]);
  });

  it("says what's wrong after a failed post, keeping the reason and the detail", () => {
    render(
      <ReportView
        target={LISTING}
        subject={SUBJECT}
        already={false}
        form={reportForm(state({ errors: ["detail-length"], values: { reason: "spam", detail: "z".repeat(501) } }))}
      />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveTextContent("Keep it under 500 characters.");
    expect(screen.getByRole("radio", { name: "Spam" })).toBeChecked();
    expect(screen.getByLabelText("Tell us more (optional)")).toHaveValue("z".repeat(501));
  });

  it("links a missing reason to the first reason, and marks the group", () => {
    render(
      <ReportView
        target={{ kind: "seller", id: "tech-corner" }}
        subject={{ title: "Tech corner", href: "/sellers/tech-corner", backLabel: "Back to the shop" }}
        already={false}
        form={reportForm(state({ errors: ["reason-missing", "report-rate"] }))}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Report this seller" })).toBeInTheDocument();
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(within(summary).getByRole("link", { name: "Choose a reason." })).toHaveAttribute("href", "#report-reason-scam");
    expect(within(summary).getByText("You've sent 10 reports today. Try again tomorrow.").tagName).toBe("LI");
    expect(screen.getByRole("group", { name: "Why are you reporting it?" })).toHaveAccessibleDescription(
      "Error: Choose a reason.",
    );
  });

  it("says when the visitor has reported it already, with no form (plan decision 17)", () => {
    render(<ReportView target={LISTING} subject={SUBJECT} already form={reportForm(null)} />);
    expect(
      screen.getByText("You've reported this listing already. The Hub reviews reports within two working days."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send report" })).toBeNull();
  });
});
```

Create `components/messages/Report.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReport } from "@/lib/data/reports";
import { resetSampleStore } from "@/lib/data/store";
import { Report } from "./Report";

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async () => (await import("@/lib/data/accounts")).getAccount("acc-mentor"),
}));
vi.mock("@/lib/auth/form-state", () => ({ readFormState: async () => null }));
vi.mock("@/lib/messaging/actions", () => ({ sendReport: async () => {} }));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());

beforeEach(() => {
  resetSampleStore();
});

describe("the report form for this visitor (messaging spec 3.4)", () => {
  it("shows the form, or says the visitor has reported it already", async () => {
    const target = { kind: "listing", id: "l-001" } as const;
    const { unmount } = render(await Report({ target }));
    expect(screen.getByRole("button", { name: "Send report" })).toBeInTheDocument();
    unmount();
    await createReport({
      reporterId: "acc-mentor",
      target,
      targetTitle: "Casio fx-991ZA Plus calculator",
      reason: "spam",
      detail: "",
      now: new Date("2026-10-14T08:42:00.000Z"),
    });
    render(await Report({ target }));
    expect(screen.getByText(/^You've reported this listing already\./)).toBeInTheDocument();
  });

  it("is the 404 for something that doesn't exist", async () => {
    await expect(Report({ target: { kind: "listing", id: "l-nope" } })).rejects.toThrow("notFound");
  });
});
```

Create `components/messages/ReportSentBack.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportSentBack } from "./ReportSentBack";

describe("the thank-you's way back (messaging spec 3.4)", () => {
  it("goes back to what was reported, or home when the address names nothing", async () => {
    const { unmount } = render(await ReportSentBack({ params: { listing: "l-001" } }));
    expect(screen.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/listings/l-001");
    unmount();
    render(await ReportSentBack({ params: { listing: "../x" } }));
    expect(screen.getByRole("link", { name: "Back to the homepage" })).toHaveAttribute("href", "/");
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm test components/messages/ReportView.test.tsx components/messages/Report.test.tsx components/messages/ReportSentBack.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 3: Write the report form**

Create `components/messages/ReportView.tsx`:

```tsx
import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { ArrowLeftIcon } from "@/components/icons";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { sendReport } from "@/lib/messaging/actions";
import { messagingErrors, REPORT_FIELDS } from "@/lib/messaging/errors";
import { REPORT_REASONS } from "@/lib/messaging/rules";
import type { ReportSubject } from "@/lib/messaging/subjects";
import type { ReportTarget } from "@/lib/types";
import { MessageField } from "./MessageField";

/** The report form after a post (D decision 3): the reason picked, the detail typed, and what's wrong. */
export type ReportForm = { reason: string; detail: string; errors: FormError[] };

export function reportForm(state: FormStateRow | null): ReportForm {
  if (!state) return { reason: "", detail: "", errors: [] };
  return {
    reason: state.values.reason ?? "",
    detail: state.values.detail ?? "",
    errors: messagingErrors(state.errors, REPORT_FIELDS),
  };
}

type ReportViewProps = {
  target: ReportTarget;
  subject: ReportSubject;
  /** The visitor has an open report on this already (plan decision 17). */
  already: boolean;
  form: ReportForm;
};

/** Report (messaging spec 3.4): what's reported, the seven reasons, the detail and Send report. */
export function ReportView({ target, subject, already, form }: ReportViewProps) {
  return (
    <div className="report-column">
      <Link href={subject.href} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        {subject.backLabel}
      </Link>
      <h1 className="report-title">{`Report this ${target.kind}`}</h1>
      <p className="report-subject">{subject.title}</p>
      {already ? (
        <p className="form-notice">
          {`You've reported this ${target.kind} already. The Hub reviews reports within two working days.`}
        </p>
      ) : (
        <ReportFormView target={target} form={form} />
      )}
    </div>
  );
}

function ReportFormView({ target, form }: { target: ReportTarget; form: ReportForm }) {
  const reasonError = errorFor(form.errors, REPORT_FIELDS.reason);
  return (
    <>
      <ErrorSummary errors={form.errors} />
      <form action={sendReport} noValidate className="form-stack">
        <input type="hidden" name="kind" value={target.kind} />
        <input type="hidden" name="id" value={target.id} />
        <fieldset className="report-reasons" aria-describedby={describedBy(reasonError && "report-reason-error")}>
          <legend className="form-label">Why are you reporting it?</legend>
          <FieldError id="report-reason-error" message={reasonError} />
          {REPORT_REASONS.map((reason) => (
            <div key={reason.value} className="form-check">
              <input
                id={`report-reason-${reason.value}`}
                type="radio"
                name="reason"
                value={reason.value}
                required
                defaultChecked={form.reason === reason.value}
                aria-invalid={reasonError ? true : undefined}
                className="form-checkbox"
              />
              <label htmlFor={`report-reason-${reason.value}`}>{reason.label}</label>
            </div>
          ))}
        </fieldset>
        <MessageField
          id={REPORT_FIELDS.detail}
          name="detail"
          label="Tell us more (optional)"
          hint="Up to 500 characters. What happened, and when? Leave out bank details and passwords."
          defaultValue={form.detail}
          error={errorFor(form.errors, REPORT_FIELDS.detail)}
          rows={4}
        />
        <button type="submit" className="btn btn-primary form-submit">
          Send report
        </button>
      </form>
    </>
  );
}
```

Create `components/messages/Report.tsx`:

```tsx
import { notFound } from "next/navigation";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { hasOpenReport } from "@/lib/data/reports";
import { reportFormKey, reportPath } from "@/lib/messaging/paths";
import { reportSubject } from "@/lib/messaging/subjects";
import type { ReportTarget } from "@/lib/types";
import { reportForm, ReportView } from "./ReportView";

/**
 * The report form for this request's visitor (messaging spec 2.8 and 3.4). Request-time: the page puts it inside
 * <Suspense>. Something that doesn't exist is the 404; a signed-out visitor goes to sign-in and back.
 */
export async function Report({ target }: { target: ReportTarget }) {
  const subject = await reportSubject(target);
  if (!subject) notFound();
  const account = await requireAccount(reportPath(target));
  const [already, state] = await Promise.all([hasOpenReport(account.id, target), readFormState(reportFormKey(target))]);
  return <ReportView target={target} subject={subject} already={already} form={reportForm(state)} />;
}
```

Create `components/messages/ReportSentBack.tsx`:

```tsx
import Link from "next/link";
import { parseReportTarget } from "@/lib/messaging/paths";
import { reportSubject } from "@/lib/messaging/subjects";

/** The thank-you's way back to what was reported (spec 3.4), from its address; home when that names nothing. */
export async function ReportSentBack({ params }: { params: Readonly<Record<string, string | string[] | undefined>> }) {
  const target = parseReportTarget(params);
  const subject = target ? await reportSubject(target) : null;
  if (!subject) {
    return (
      <Link href="/" className="btn btn-outline text-navy">
        Back to the homepage
      </Link>
    );
  }
  return (
    <Link href={subject.href} prefetch={false} className="btn btn-primary">
      {subject.backLabel}
    </Link>
  );
}
```

Create `components/messages/ReportSkeleton.tsx`:

```tsx
/** The report form's room while it streams in (messaging spec 3.4). */
export function ReportSkeleton() {
  return (
    <div className="report-column" aria-hidden="true">
      <span className="skeleton composer-skeleton-crumb" />
      <span className="skeleton composer-skeleton-title" />
      <span className="skeleton report-skeleton-form" />
    </div>
  );
}
```

Run: `pnpm test components/messages`
Expected: PASS.

- [ ] **Step 4: The pages**

Create `app/report/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Report } from "@/components/messages/Report";
import { ReportSkeleton } from "@/components/messages/ReportSkeleton";
import { parseReportTarget } from "@/lib/messaging/paths";

/** A form for one visitor, so search engines leave it out (plan decision 24). */
export const metadata: Metadata = { title: "Report", robots: { index: false } };

/**
 * Report a listing, a seller or a request (messaging spec 2.8 and 3.4): `/report?listing=l-001`. The address and the
 * session are read per request, inside <Suspense>; an address that names nothing reportable is the 404.
 */
export default function ReportPage({ searchParams }: PageProps<"/report">) {
  return (
    <div className="page report-page">
      <Suspense fallback={<ReportSkeleton />}>
        <ReportForVisitor searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ReportForVisitor({ searchParams }: Pick<PageProps<"/report">, "searchParams">) {
  const target = parseReportTarget(await searchParams);
  if (!target) notFound();
  return <Report target={target} />;
}
```

Create `app/report/sent/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportSentBack } from "@/components/messages/ReportSentBack";

export const metadata: Metadata = { title: "Report sent", robots: { index: false } };

/**
 * The report's thank-you (messaging spec 3.4, plan decision 17): its own page, so reloading it doesn't bring the form
 * back. The words are prerendered; the way back reads the address, so it streams in.
 */
export default function ReportSentPage({ searchParams }: PageProps<"/report/sent">) {
  return (
    <div className="page report-page">
      <div className="report-column">
        <h1 className="report-title">Report sent</h1>
        <p className="report-thanks">
          Thanks. The Hub reviews reports within two working days. We&apos;ll let you know what happens.
        </p>
        <div className="report-back">
          <Suspense fallback={null}>
            <BackFromAddress searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function BackFromAddress({ searchParams }: Pick<PageProps<"/report/sent">, "searchParams">) {
  return <ReportSentBack params={await searchParams} />;
}
```

- [ ] **Step 5: The styles**

Check the names are free (`grep -n "\.report-" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Messaging: report (messaging plan, Task 11, spec 3.4) --- */
@layer components {
  /* .page and .report-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .report-page {
    padding: 16px 16px 64px;
  }

  .report-column {
    display: grid;
    gap: 16px;
    max-width: 36rem;
  }

  .report-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
  }

  .report-subject {
    color: var(--color-navy);
    font-size: 18px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .report-reasons {
    display: grid;
    gap: 2px;
  }

  .report-reasons legend {
    margin-bottom: 6px;
  }

  /* Holds the button's height while the way back streams in, so nothing moves. */
  .report-back {
    min-height: 44px;
  }

  .report-skeleton-form {
    height: 34rem;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .report-page {
      padding-inline: 40px;
    }
  }
}
```

- [ ] **Step 6: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 7 more unit tests than after Task 10 (the form 4, its visitor 2, the way back 1). The build lists `/report` and `/report/sent` as partly prerendered.

- [ ] **Step 7: Look at it**

Start the build (`pnpm start --port 3201`) and check at 390 × 844, 768 × 1024 and 1280 × 800:
- Signed out, Report this listing on `/listings/l-001` goes to sign-in; "Student, Midrand" lands on `/report?listing=l-001`: "Back to the listing", "REPORT THIS LISTING", the calculator's name, the seven radio buttons (each with its words a 44px target), "Tell us more (optional)" and Send report.
- Send report with nothing chosen: the summary links to the first reason, and "Error: Choose a reason." sits under the question.
- Choose Misleading listing and send: `/report/sent?listing=l-001`, "REPORT SENT", the spec's sentence and Back to the listing. Back in the browser goes to the listing, not to the form. `/report?listing=l-001` again: "You've reported this listing already…".
- `/report?seller=tech-corner` ("Report this seller", Back to the shop) and `/report?request=r-001` ("Report this request"). `/report?listing=nope` and `/report` are the 404 page.

Stop the server.

- [ ] **Step 8: Hand over for commit**

Files: `components/messages/ReportView.tsx`, `components/messages/ReportView.test.tsx`, `components/messages/Report.tsx`, `components/messages/Report.test.tsx`, `components/messages/ReportSkeleton.tsx`, `components/messages/ReportSentBack.tsx`, `components/messages/ReportSentBack.test.tsx`, `app/report/page.tsx`, `app/report/sent/page.tsx`, `app/globals.css`.
Message: `feat: the report pages: seven reasons and a detail, one report per target, and a thank-you of its own (messaging spec 2.8 and 3.4)`

---

### Task 12: The notifications page

`/notifications` (spec 2.9 and 3.5; plan decisions 12, 13 and 28): "Notifications" and the newest 50, each with an icon, its sentence, the time and a link to the thing, the new ones marked; "Nothing new." when there are none. Opening the page marks them read.

**Files:**
- Modify: `components/icons.tsx`, `components/icons.test.tsx`
- Create: `components/messages/NotificationsView.tsx`, `components/messages/NotificationsView.test.tsx`
- Create: `components/messages/Notifications.tsx`, `components/messages/Notifications.test.tsx`
- Create: `app/notifications/page.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Add the message icon**

In `components/icons.test.tsx`, add `"MessageIcon",` to the list of names straight after `"MenuIcon",` (the list is sorted; keep any icons part B added).

In `components/icons.tsx`, add after `MenuIcon`:

```tsx

/** A speech bubble: a new message (messaging spec 3.5). */
export function MessageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5V16.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
    </Svg>
  );
}
```

Only Server Components use it, so it adds nothing to the client.

- [ ] **Step 2: Write the page's tests**

Create `components/messages/NotificationsView.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NotificationItem } from "@/lib/types";
import { NotificationsView } from "./NotificationsView";

// Wednesday 14 October 2026, 15:00 in South Africa.
const NOW = new Date("2026-10-14T13:00:00Z");

const item = (overrides: Partial<NotificationItem>): NotificationItem => ({
  id: "note-1",
  kind: "message",
  text: "Tech corner replied about Casio fx-991ZA Plus calculator",
  href: "/messages/conv-1",
  createdAt: "2026-10-14T12:05:00Z",
  isNew: true,
  ...overrides,
});

describe("notifications (messaging spec 3.5)", () => {
  it("lists each as a link to the thing, with its sentence, the time, and New when it's new", () => {
    render(
      <NotificationsView
        now={NOW}
        items={[
          item({}),
          item({
            id: "note-2",
            kind: "sale-to-confirm",
            text: "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
            href: "/messages/conv-2",
            createdAt: "2026-10-12T08:00:00Z",
            isNew: false,
          }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", "/messages/conv-1");
    expect(within(rows[0]).getByText("New")).toHaveClass("notes-new");
    expect(within(rows[0]).getByText("Tech corner replied about Casio fx-991ZA Plus calculator")).toBeInTheDocument();
    expect(within(rows[0]).getByText("14:05")).toHaveAttribute("datetime", "2026-10-14T12:05:00Z");
    expect(within(rows[1]).getByRole("link")).toHaveAttribute("href", "/messages/conv-2");
    expect(within(rows[1]).queryByText("New")).toBeNull();
    expect(within(rows[1]).getByText("Mon")).toBeInTheDocument();
  });

  it("gives every kind an icon, hidden from screen readers (plan decision 13)", () => {
    const { container } = render(
      <NotificationsView
        now={NOW}
        items={(["message", "sale-to-confirm", "report-handled", "shop-approved"] as const).map((kind, n) =>
          item({ id: `note-${n}`, kind, text: `Sentence ${n}` }),
        )}
      />,
    );
    const icons = container.querySelectorAll("svg.notes-icon");
    expect(icons).toHaveLength(4);
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("says \"Nothing new.\" when there are none (spec 3.5)", () => {
    render(<NotificationsView now={NOW} items={[]} />);
    expect(screen.getByText("Nothing new.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
```

Create `components/messages/Notifications.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { countNewNotifications } from "@/lib/data/notifications";
import { resetSampleStore } from "@/lib/data/store";
import { Notifications } from "./Notifications";

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async () => (await import("@/lib/data/accounts")).getAccount("acc-student"),
}));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T08:42:00.000Z"));
});

describe("notifications for this visitor (messaging spec 2.9)", () => {
  it("shows which were new on this visit, and marks them all read", async () => {
    render(await Notifications());
    expect(screen.getAllByText("New")).toHaveLength(2);
    expect(await countNewNotifications("acc-student")).toBe(0);
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test components/icons.test.tsx components/messages/NotificationsView.test.tsx components/messages/Notifications.test.tsx`
Expected: the icon tests pass once Step 1 is in; the other two FAIL, because the components don't exist.

- [ ] **Step 4: Write the page's parts**

Create `components/messages/NotificationsView.tsx`:

```tsx
import Link from "next/link";
import { CheckIcon, FlagIcon, MessageIcon, ShieldIcon } from "@/components/icons";
import { inboxTime } from "@/lib/time";
import type { NotificationItem, NotificationKind } from "@/lib/types";

/** Each kind's icon (plan decision 13). Stage G's kinds are drawn already. */
function KindIcon({ kind }: { kind: NotificationKind }) {
  switch (kind) {
    case "message":
      return <MessageIcon className="notes-icon" />;
    case "sale-to-confirm":
      return <CheckIcon className="notes-icon" />;
    case "report-handled":
      return <FlagIcon className="notes-icon" />;
    case "shop-approved":
      return <ShieldIcon className="notes-icon" />;
  }
}

/**
 * Notifications (messaging spec 3.5): newest first, each a link to the thing with its sentence and the time, the ones
 * that were new on this visit marked New in words. "Nothing new." when there are none.
 */
export function NotificationsView({ items, now }: { items: readonly NotificationItem[]; now: Date }) {
  if (items.length === 0) return <p className="notes-empty">Nothing new.</p>;
  return (
    <ul className="notes-list">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} prefetch={false} className="notes-row" data-new={item.isNew || undefined}>
            <KindIcon kind={item.kind} />
            <span className="notes-text">
              {item.isNew && <span className="notes-new">New</span>} <span>{item.text}</span>
            </span>{" "}
            <time dateTime={item.createdAt} className="notes-time">
              {inboxTime(item.createdAt, now)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

Create `components/messages/Notifications.tsx`:

```tsx
import { connection } from "next/server";
import { requireAccount } from "@/lib/auth/session";
import { getNotifications, markNotificationsRead } from "@/lib/data/notifications";
import { NOTIFICATIONS_SHOWN } from "@/lib/messaging/rules";
import { NotificationsView } from "./NotificationsView";

/**
 * Notifications for this request's visitor (messaging spec 2.9 and 3.5). Request-time: the page puts it inside
 * <Suspense>. Opening the page marks them all read, after reading them, so this visit still shows which were new. The
 * header's badge on this same page load may still count them (plan decision 11).
 */
export async function Notifications() {
  const account = await requireAccount("/notifications");
  // The times and marking read read the clock (decision 26).
  await connection();
  const now = new Date();
  const items = await getNotifications(account.id, NOTIFICATIONS_SHOWN);
  await markNotificationsRead(account.id, now);
  return <NotificationsView items={items} now={now} />;
}

/** The list's room while it streams in. */
export function NotificationsSkeleton() {
  return (
    <div className="notes-skeleton" aria-hidden="true">
      <span className="skeleton notes-skeleton-row" />
      <span className="skeleton notes-skeleton-row" />
      <span className="skeleton notes-skeleton-row" />
    </div>
  );
}
```

Run: `pnpm test components/messages components/icons.test.tsx`
Expected: PASS.

- [ ] **Step 5: The page**

Create `app/notifications/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Notifications, NotificationsSkeleton } from "@/components/messages/Notifications";

/** A page for one person, so search engines leave it out (plan decision 24). */
export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

/** Notifications (messaging spec 3.5). The heading is prerendered; the list needs the session. */
export default function NotificationsPage() {
  return (
    <div className="page notes-page">
      <h1 className="notes-title">Notifications</h1>
      <Suspense fallback={<NotificationsSkeleton />}>
        <Notifications />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 6: The styles**

Check the names are free (`grep -n "\.notes-" app/globals.css` prints nothing), then append to the end of `app/globals.css`:

```css

/* --- Messaging: notifications (messaging plan, Task 12, spec 3.5) --- */
@layer components {
  /* .page and .notes-page sit on one element, so this padding is the whole content edge: 16px, then 40px. */
  .notes-page {
    padding: 24px 16px 64px;
  }

  .notes-title {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
  }

  .notes-list,
  .notes-empty,
  .notes-skeleton {
    max-width: 48rem;
    margin-top: 20px;
  }

  .notes-list {
    border-top: 1.5px solid var(--color-line);
  }

  .notes-list li {
    border-bottom: 1.5px solid var(--color-line);
  }

  .notes-row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    min-height: 56px;
    padding-block: 14px;
    color: var(--color-ink);
  }

  .notes-icon {
    color: var(--color-navy);
  }

  .notes-text {
    overflow-wrap: anywhere;
  }

  .notes-row[data-new] .notes-text {
    color: var(--color-navy);
    font-weight: 600;
  }

  /* "New" in white on danger red (6.6:1), as the header's badge (plan decision 10). */
  .notes-new {
    display: inline-flex;
    align-items: center;
    margin-right: 6px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--color-danger);
    color: var(--color-white);
    font-size: 12px;
    font-weight: 700;
  }

  .notes-time {
    color: var(--color-muted);
    font-size: 13px;
    white-space: nowrap;
  }

  @media (hover: hover) and (pointer: fine) {
    .notes-row:hover .notes-text span:last-child {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }

  .notes-empty {
    padding: 24px;
    border-radius: var(--radius-panel);
    background: var(--color-panel);
  }

  .notes-skeleton {
    display: grid;
    gap: 12px;
  }

  .notes-skeleton-row {
    height: 56px;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .notes-page {
      padding-inline: 40px;
    }
  }
}
```

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 5 more unit tests than after Task 11 (the icons' check of each icon 1, the view 3, its visitor 1). The build lists `/notifications` as partly prerendered.

- [ ] **Step 8: Look at it**

Start the build (`pnpm start --port 3201`), sign in as "Student, Midrand" and open `/notifications`, at 390 × 844, 768 × 1024 and 1280 × 800: "NOTIFICATIONS", the check icon and the red "New" pill before "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?", then the speech bubble with "Tech corner replied about Gaming headset, barely used", each with its time on the right. Load the page again: the same two, no "New". As "Mentor": "Nothing new." Stop the server.

- [ ] **Step 9: Hand over for commit**

Files: `components/icons.tsx`, `components/icons.test.tsx`, `components/messages/NotificationsView.tsx`, `components/messages/NotificationsView.test.tsx`, `components/messages/Notifications.tsx`, `components/messages/Notifications.test.tsx`, `app/notifications/page.tsx`, `app/globals.css`.
Message: `feat: the notifications page: newest first with an icon, the sentence, the time and New, marked read on opening (messaging spec 2.9 and 3.5)`

---

### Task 13: The header's badge, the account page's rows and the homepage's strip

What needs attention shows up where the student looks (spec 2.9 and 3.6; plan decisions 10 and 11): a red badge with the number of new notifications on the header's account icon, drawn by D's server slot; Messages and Notifications rows, with their counts, first on the account page; and the homepage strip's "Open inbox" going to `/messages`. The header is in every page's shell and the strip is on the homepage, so this task ends by measuring every page.

**Files:**
- Modify: `components/header/AccountLink.tsx`, `components/header/AccountLink.test.tsx`
- Modify: `components/account/AccountView.tsx`, `components/account/AccountView.test.tsx`, `app/account/page.tsx`
- Modify: `components/home/ContextStripView.tsx`, `components/home/ContextStrip.test.tsx`
- Modify: `app/globals.css` (end of file)

- [ ] **Step 1: Change the tests first**

In `components/header/AccountLink.test.tsx` (D Task 8):
1. Below the `vi.mock("@/lib/auth/session", …)` call, add:

```tsx

const notifications = vi.hoisted(() => ({ count: 0, failing: false }));

vi.mock("@/lib/data/notifications", () => ({
  countNewNotifications: async () => {
    if (notifications.failing) throw new Error("The store didn't answer");
    return notifications.count;
  },
}));
```

2. In its `afterEach`, add `notifications.count = 0;` and `notifications.failing = false;`.
3. Add these tests at the end of the `describe`:

```tsx

  it("shows a red badge with the number of new notifications, keeping the name (messaging plan decision 10)", () => {
    render(<AccountLink signedIn unread={2} />);
    const link = screen.getByRole("link", { name: "Your account" });
    expect(link).toHaveAccessibleDescription("2 new notifications");
    expect(link.querySelector(".hdr-badge")).toHaveClass("hdr-badge-alert");
  });

  it("says one notification, caps the number at 99+, and has no badge signed out or with nothing new", () => {
    const { unmount } = render(<AccountLink signedIn unread={1} />);
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("1 new notification");
    unmount();
    const many = render(<AccountLink signedIn unread={120} />);
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("99+ new notifications");
    many.unmount();
    const none = render(<AccountLink signedIn unread={0} />);
    expect(none.container.querySelector(".hdr-badge")).toBeNull();
    none.unmount();
    render(<AccountLink signedIn={false} unread={3} />);
    expect(screen.getByRole("link", { name: "Sign in" })).not.toHaveAttribute("aria-describedby");
  });

  it("counts the session's new notifications, and shows no badge when the count fails", async () => {
    viewer.account = { id: "acc-student" };
    notifications.count = 2;
    const { unmount } = render(await HeaderAccount());
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("2 new notifications");
    unmount();
    notifications.failing = true;
    render(await HeaderAccount());
    expect(screen.getByRole("link", { name: "Your account" })).not.toHaveAttribute("aria-describedby");
  });
```

In `components/account/AccountView.test.tsx` (D Task 10):
1. Change `renderAccount` so it passes the counts, with none by default:

```tsx
function renderAccount(
  who: Account = account,
  formState: FormStateRow | null = null,
  counts = { conversations: 0, notifications: 0 },
) {
  return render(
    <AccountView account={who} campuses={campuses} details={detailsForm(who, formState)} counts={counts} />,
  );
}
```

2. In "links to Saved, selling and privacy settings, and offers Sign out", rename it "links to messages, notifications, Saved, selling and privacy settings, and offers Sign out (messaging spec 3.6)", and replace the expected rows with:

```tsx
      ["Messages", "/messages"],
      ["Notifications", "/notifications"],
      ["Saved", "/saved"],
      ["Start selling", "/sell"],
      ["Privacy settings", "/account/privacy"],
```

3. Add this test at the end of the `describe`:

```tsx

  it("says how many conversations are unread and how many notifications are new (messaging spec 3.6)", () => {
    renderAccount(account, null, { conversations: 2, notifications: 3 });
    expect(screen.getByRole("link", { name: /^Messages\s*,\s*2 unread$/ })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: /^Notifications\s*,\s*3 new$/ })).toHaveAttribute("href", "/notifications");
  });
```

In `components/home/ContextStrip.test.tsx`, replace `expect(screen.getByRole("link", { name: "Open inbox" })).toHaveAttribute("href", "/account");` with `expect(screen.getByRole("link", { name: "Open inbox" })).toHaveAttribute("href", "/messages");`.

Run: `pnpm test components/header components/account components/home/ContextStrip.test.tsx`
Expected: FAIL: no badge, no counts, no Messages or Notifications rows, and the strip still goes to `/account`.

- [ ] **Step 2: The badge**

In `components/header/AccountLink.tsx` (D Task 8):
1. Add `import { countNewNotifications } from "@/lib/data/notifications";` below `import { getViewer } from "@/lib/auth/session";`.
2. Replace the whole `AccountLink` function and its comment with:

```tsx
/**
 * The header's account icon (accounts spec 3.4): "Sign in" to /login when signed out, "Your account" to /account when
 * signed in. The layout renders it on the server and hands it to SiteHeader, so the header knows the session without
 * client code or a readable cookie (accounts plan decision 1). No prefetch, like the Saved link: the header is on
 * every page.
 *
 * Signed in, a red badge counts the new notifications (messaging spec 2.9, plan decision 10). It sits inside the
 * icon's box, so nothing moves as it streams in, and it describes the link ("2 new notifications") without changing
 * its name. Like everything in the layout, it's as fresh as the last full page load or post (plan decision 11).
 */
export function AccountLink({ signedIn, unread = 0 }: { signedIn: boolean; unread?: number }) {
  const badge = signedIn && unread > 0;
  // --i is the header's reveal stagger: fourth in its group, as before (spec section 6.2).
  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      prefetch={false}
      aria-label={signedIn ? "Your account" : "Sign in"}
      aria-describedby={badge ? "hdr-account-new" : undefined}
      className="hdr-item icon-btn relative"
      style={{ "--i": 3 } as CSSProperties}
    >
      <UserIcon />
      {badge && (
        <span id="hdr-account-new" className="hdr-badge hdr-badge-alert">
          {unread > 99 ? "99+" : unread} <span className="sr-only">{`new ${unread === 1 ? "notification" : "notifications"}`}</span>
        </span>
      )}
    </Link>
  );
}
```

3. Replace the body of `HeaderAccount` with:

```tsx
  // A failed lookup counts as signed out rather than breaking the header; a failed count shows no badge.
  const account = await getViewer().catch(() => null);
  if (!account) return <AccountLink signedIn={false} />;
  const unread = await countNewNotifications(account.id).catch(() => 0);
  return <AccountLink signedIn unread={unread} />;
```

Append to the end of `app/globals.css`:

```css

/* --- Messaging: the header's badge (messaging plan, Task 13, plan decision 10) --- */
@layer components {
  /* New notifications: white on danger red (6.6:1), apart from Saved's sky count beside it. */
  .hdr-badge-alert {
    background: var(--color-danger);
    color: var(--color-white);
  }
}
```

- [ ] **Step 3: The account page's rows**

In `components/account/AccountView.tsx` (D Task 10):
1. Add `UnreadCounts` to the `import type { … } from "@/lib/types";` line.
2. Add a `counts` prop to `AccountViewProps`:

```tsx
  /** Unread conversations and new notifications, for the first two rows (messaging spec 3.6). */
  counts: Pick<UnreadCounts, "conversations" | "notifications">;
```

and to the function's parameters: `export function AccountView({ account, campuses, details, counts }: AccountViewProps) {`.

3. In the `account-rows` list, add these two items before the Saved item:

```tsx
          <li>
            <CountRow
              href="/messages"
              label="Messages"
              detail={counts.conversations > 0 ? `${counts.conversations} unread` : null}
            />
          </li>
          <li>
            <CountRow
              href="/notifications"
              label="Notifications"
              detail={counts.notifications > 0 ? `${counts.notifications} new` : null}
            />
          </li>
```

4. Add this function after `SellingRow`:

```tsx

/** A row with a count under its name when there's something new (messaging spec 3.6), read as "Messages, 2 unread". */
function CountRow({ href, label, detail }: { href: string; label: string; detail: string | null }) {
  return (
    <Link href={href} prefetch={false} className="account-row">
      <span>
        {label}
        {detail && (
          <>
            <span className="sr-only">,</span> <span className="account-row-detail account-row-count">{detail}</span>
          </>
        )}
      </span>
      <ChevronRightIcon />
    </Link>
  );
}
```

In `app/account/page.tsx` (D Task 10):
1. Add `import { unreadCounts } from "@/lib/data/messages";` below `import { getCampuses } from "@/lib/data";`.
2. Replace `AccountContent`'s body with:

```tsx
  const account = await requireAccount("/account");
  // requireAccount awaited connection() as it found the session, so the counts may read the clock (decision 26).
  const [campuses, state, counts] = await Promise.all([
    getCampuses(),
    readFormState(DETAILS_FORM),
    unreadCounts(account.id, new Date()),
  ]);
  return <AccountView account={account} campuses={campuses} details={detailsForm(account, state)} counts={counts} />;
```

Append to the end of `app/globals.css`:

```css

/* --- Messaging: the account page's counts (messaging plan, Task 13, spec 3.6) --- */
@layer components {
  /* A count that needs attention: danger red, 6.6:1 on white. */
  .account-row-count {
    color: var(--color-danger);
    font-weight: 700;
  }
}
```

- [ ] **Step 4: The homepage strip's inbox**

In `components/home/ContextStripView.tsx`, replace

```tsx
      <Link href="/account" className="context-link">
        Open inbox
      </Link>
```

with

```tsx
      {/* No prefetch (CLAUDE.md, decision 53). The inbox is messaging's (messaging spec 3.6). */}
      <Link href="/messages" prefetch={false} className="context-link">
        Open inbox
      </Link>
```

The strip's numbers already come from the store (Task 5).

- [ ] **Step 5: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Expected: all pass; 4 more unit tests than after Task 12 (the badge 3, the counts 1).

- [ ] **Step 6: Look at it**

Start the build (`pnpm start --port 3201`) and check at 360 × 780 (the narrowest test size), 390 × 844, 768 × 1024 and 1280 × 800:
- Signed out: the header is as before.
- As "Student, Midrand", load `/`: the person icon carries a small red "2" at its top right, the same size and place as Saved's sky count; nothing in the header moves as it arrives, and nothing overflows at 360px. The strip under the hero says "Welcome back", "1 new message" and "1 sale to confirm" (no sale to confirm from 20 October 2026, when the sample sale confirms itself), and Open inbox goes to `/messages`.
- `/account`: Messages with "1 unread" in red, Notifications with "2 new", then Saved, Start selling and Privacy settings.
- Open `/notifications`, then load `/` again: the badge has gone (plan decision 11: on `/notifications` itself it may still say 2).

Stop the server.

- [ ] **Step 7: Measure the JS (the header is in every page's shell)**

Run: `pnpm e2e tests/e2e/performance.spec.ts tests/e2e/shell.spec.ts tests/e2e/responsive.spec.ts tests/e2e/home.spec.ts tests/e2e/accounts.spec.ts --project=phone-390`
Expected: all pass. Note every page's `scriptBrotli` in the ledger. `AccountLink` is a Server Component, so only the homepage should move, by a few bytes (`ContextStripView`'s link). **If any page is past the stop line, stop here and report the figures.**

Then run the shell tests at every size: `pnpm e2e tests/e2e/shell.spec.ts tests/e2e/responsive.spec.ts`.
Expected: all pass.

- [ ] **Step 8: Hand over for commit**

Files: `components/header/AccountLink.tsx`, `components/header/AccountLink.test.tsx`, `components/account/AccountView.tsx`, `components/account/AccountView.test.tsx`, `app/account/page.tsx`, `components/home/ContextStripView.tsx`, `components/home/ContextStrip.test.tsx`, `app/globals.css`.
Message: `feat: a red badge for new notifications on the header's account icon, Messages and Notifications on the account page, and the strip's inbox link (messaging spec 2.9 and 3.6). JS: / <n> B, browse <n> B, listing <n> B, storefront <n> B`

---

### Task 14: Words messaging makes untrue, reports you've made, and robots

Messaging now holds personal data, so the privacy policy names it, says how long it's kept in the preview (plan decision 27) and what deleting removes (plan decision 14); privacy settings' download and deletion say the same and list the reports you've made (plan decision 18); How it works and Safety stop saying messaging and reporting are coming; and `robots.txt` keeps crawlers off the new pages (plan decision 24). No new cookie or storage name appears, so the privacy page's `vossie_…` guard has nothing new to check (plan decision 7).

**Files:**
- Modify: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`
- Modify: `components/account/PrivacySettingsView.tsx`, `components/account/PrivacySettingsView.test.tsx`, `app/account/privacy/page.tsx`
- Modify: `app/how-it-works/page.tsx`, `app/safety/page.tsx`
- Modify: `app/robots.ts`, `app/robots.test.ts`
- Modify: `app/globals.css` (end of file)

Edit by the exact lines quoted. D's Tasks 4 and 12 changed these files; if a line reads differently now, change it by meaning and say so in the hand-over.

- [ ] **Step 1: Change the tests first**

In `app/privacy/page.test.tsx`, add this test after "sends you to your privacy settings to download your data or delete your account (accounts spec 3.3)" (D Task 12):

```tsx

  it("says what messaging keeps, for how long, and what deleting your account removes (messaging plan, Task 14)", () => {
    render(<PrivacyPage />);
    const today = screen.getByRole("region", { name: "What this site stores today" });
    expect(within(today).getByText(/your messages, your reports and your notifications in its memory only/)).toBeInTheDocument();
    const account = screen.getByRole("region", { name: "Your account" });
    expect(within(account).getByText("Your notifications.")).toBeInTheDocument();
    const keep = screen.getByRole("region", { name: "How long we keep it" });
    expect(within(keep).getByText(/Eduvos will set how long they are kept before launch/)).toBeInTheDocument();
    expect(within(keep).getByText(/your messages, your reports and your notifications straight away/)).toBeInTheDocument();
    expect(within(keep).queryByText(/before messaging opens/)).toBeNull();
  });
```

In `components/account/PrivacySettingsView.test.tsx` (D Task 11):
1. Add `reports={[]}` to every `<PrivacySettingsView … />` in the file.
2. In "says what deleting does, and asks for the box before the red button (spec 2.13)", replace `expect(within(section).getAllByRole("listitem")).toHaveLength(4);` with `expect(within(section).getAllByRole("listitem")).toHaveLength(5);`.
3. Add these tests at the end of the `describe`:

```tsx

  it("says the download holds your conversations, reports and notifications (messaging plan decision 15)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    const section = screen.getByRole("region", { name: "Download your data" });
    expect(within(section).getByText(/your conversations, your reports and your notifications/)).toBeInTheDocument();
  });

  it("lists the reports you've made, newest first, or says there are none (messaging plan decision 18)", () => {
    const { unmount } = render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    expect(
      within(screen.getByRole("region", { name: "Reports you've made" })).getByText("You haven't reported anything."),
    ).toBeInTheDocument();
    unmount();
    render(
      <PrivacySettingsView
        consent={consent}
        deleteErrors={[]}
        reports={[
          { kind: "seller", title: "Tech corner", reason: "spam", createdAt: "2026-10-14T08:42:00.000Z", open: true },
          {
            kind: "listing",
            title: "Casio fx-991ZA Plus calculator",
            reason: "misleading",
            createdAt: "2026-10-01T08:00:00.000Z",
            open: false,
          },
        ]}
      />,
    );
    const items = within(screen.getByRole("region", { name: "Reports you've made" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Tech corner Spam · 14 Oct · Open",
      "Casio fx-991ZA Plus calculator Misleading listing · 1 Oct · Closed",
    ]);
  });
```

In `app/robots.test.ts`, in "keeps crawlers off Saved, sign-in, the account pages and the selling pages", add to the list of paths:

```ts
      "/messages",
      "/messages/conv-s1",
      "/notifications",
      "/report?listing=l-001",
      "/report/sent?listing=l-001",
      "/listings/l-001/message",
      "/sellers/tech-corner/message",
```

and rename it "keeps crawlers off Saved, sign-in, the account, messaging and selling pages". The next test ("doesn't catch pages that only start with the same letters…") already checks that `/sellers/tech-corner` and `/listings/l-001` stay open.

Run: `pnpm test app/privacy app/robots.test.ts components/account`
Expected: FAIL: the policy, privacy settings and robots.txt don't say these things yet.

- [ ] **Step 2: The privacy policy**

In `app/privacy/page.tsx`:

1. In the `privacy-today` section's first paragraph (D Task 12), replace `keeps your account, your sign-ins and your consent in` with `keeps your account, your sign-ins, your consent, your messages, your reports and your notifications in`.

2. In the `privacy-sign-in` section ("Your account"), replace `including what messaging and selling will add once they open.` with `including what selling will add once it opens.`

3. In the same section, straight after the `<li>` that starts `<strong>Your messages, swap offers and reports.</strong>`, add:

```tsx
          <li>
            <strong>Your notifications.</strong> A note when someone messages you or a sale needs confirming, which
            only you see. Allowed under POPIA section 11: needed to run your account.
          </li>
```

4. In the `privacy-keep` section, replace

```tsx
        <li>
          Deleting your account removes your account, your sign-in sessions and your record of consent straight away,
          along with your shop and listings if you have them.
        </li>
        <li>How long messages and reports are kept will be set before messaging opens, and this policy will say so.</li>
```

with

```tsx
        <li>
          Deleting your account removes your account, your sign-in sessions, your record of consent, your messages,
          your reports and your notifications straight away, along with your shop and listings if you have them. The
          other person in a conversation keeps their own messages, with your name taken out.
        </li>
        <li>
          While Vossie is a preview, messages, reports and notifications live in the server&apos;s memory and go
          whenever it restarts. Eduvos will set how long they are kept before launch, and this policy will say so.
        </li>
```

5. In `metadata.description`, nothing changes ("what your account holds" already covers it).
6. Set the page's `updated` to today's date in SAST (`YYYY-MM-DD`).

- [ ] **Step 3: Privacy settings**

In `components/account/PrivacySettingsView.tsx` (D Task 11):

1. Add `import { reasonLabel } from "@/lib/messaging/rules";` and `import { shortSastDate } from "@/lib/time";` (D's file imports `longSastDate, sastClock` from `@/lib/time`: add `shortSastDate` to that import instead), and add `ReportSummary` to the `import type { … } from "@/lib/types";` line.
2. Add to `PrivacySettingsViewProps`:

```tsx
  /** The account's reports, newest first (messaging plan decision 18). */
  reports: readonly ReportSummary[];
```

and to the parameters: `export function PrivacySettingsView({ consent, deleteErrors, reports }: PrivacySettingsViewProps) {`.

3. In the Download section, replace

```tsx
        <p>
          A file of what Vossie holds about you: your account, your consent and when you signed in. Once messaging and
          selling open, it will hold your messages, reports and listings too.
        </p>
```

with

```tsx
        <p>
          A file of what Vossie holds about you: your account, your consent, when you signed in, your conversations,
          your reports and your notifications. Once selling opens, it will hold your listings too.
        </p>
```

4. Between the Download section's closing `</section>` and the Delete section, add:

```tsx

      <section aria-labelledby="account-privacy-reports-title" className="account-section">
        <h2 id="account-privacy-reports-title" className="account-section-title">
          Reports you&apos;ve made
        </h2>
        {reports.length === 0 ? (
          <p>You haven&apos;t reported anything.</p>
        ) : (
          <ul className="account-reports">
            {reports.map((report) => (
              <li key={`${report.kind}:${report.title}:${report.createdAt}`}>
                <span className="account-report-title">{report.title}</span>{" "}
                <span className="account-report-meta">
                  {`${reasonLabel(report.reason)} · ${shortSastDate(report.createdAt)} · ${report.open ? "Open" : "Closed"}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
```

5. In the Delete section's list, replace

```tsx
          <li>once messaging and selling open, your messages, shop and listings go too.</li>
```

with

```tsx
          <li>
            your messages, reports and notifications go, and the other person keeps only their own side of each
            conversation;
          </li>
          <li>once selling opens, your shop and listings go too.</li>
```

In `app/account/privacy/page.tsx` (D Task 11):
1. Add `import { listReportsBy } from "@/lib/data/reports";` below `import { getLatestConsent } from "@/lib/data/accounts";`.
2. Replace `PrivacySettings`'s last two lines with:

```tsx
  const [consent, state, reports] = await Promise.all([
    getLatestConsent(account.id),
    readFormState(DELETE_FORM),
    listReportsBy(account.id),
  ]);
  return (
    <PrivacySettingsView
      consent={consent}
      deleteErrors={formErrors(state?.errors ?? [], DELETE_FIELDS)}
      reports={reports}
    />
  );
```

Append to the end of `app/globals.css`:

```css

/* --- Messaging: reports you've made (messaging plan, Task 14, plan decision 18) --- */
@layer components {
  .account-reports {
    display: grid;
    border-top: 1.5px solid var(--color-line);
  }

  .account-reports li {
    display: grid;
    gap: 2px;
    padding-block: 12px;
    border-bottom: 1.5px solid var(--color-line);
  }

  .account-report-title {
    color: var(--color-navy);
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .account-report-meta {
    color: var(--color-muted);
    font-size: 14px;
  }
}
```

(`grep -n "\.account-report" app/globals.css` prints nothing before you add it.)

- [ ] **Step 4: How it works and Safety**

In `app/how-it-works/page.tsx`, replace (D Task 12's wording)

```tsx
          Browse every campus, save listings on your device and share them, and sign in with your Eduvos email.
          Messaging and selling arrive in the next stages, so this page describes how they will work.
```

with

```tsx
          Browse every campus, save listings on your device and share them, sign in with your Eduvos email, message
          sellers and report a problem. Selling arrives in the next stage, so this page describes how it will work.
```

In `app/safety/page.tsx`, in the `safety-reporting` section, replace

```tsx
          Reporting needs an account, so the link takes you to sign in first. A member of the Hub team reads every
```

with

```tsx
          Reporting needs an account: signed out, the link takes you to sign in first, then to the report. A member of
          the Hub team reads every
```

and let the rest of that paragraph's line ("report, and can hide a listing or pause an account.") follow as it is, rewrapping to about 120 characters.

Set both pages' `updated` to today's date in SAST. Their tests still match (How it works checks `/Browse every campus, save listings on your device and share them/`).

- [ ] **Step 5: Robots**

In `app/robots.ts`, replace

```ts
const DISALLOWED = ["/saved", "/login", "/account", "/sell$", "/sell/"];
```

with

```ts
// Messaging's pages belong to one person too (messaging plan decision 24); "*" matches any listing or shop.
const DISALLOWED = [
  "/saved",
  "/login",
  "/account",
  "/sell$",
  "/sell/",
  "/messages",
  "/notifications",
  "/report",
  "/listings/*/message",
  "/sellers/*/message",
];
```

- [ ] **Step 6: Check nothing else says messaging or reporting is coming**

Run: `grep -rn -i "messaging and selling arrive\|once messaging\|before messaging opens\|messaging opens\|messaging arrives" app components lib`
Expected: nothing. If something prints, change it the same way and list it in the hand-over.

- [ ] **Step 7: Run every check**

Run, one after another: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, then `pnpm e2e tests/e2e/info.spec.ts tests/e2e/system.spec.ts --project=phone-390`.
Expected: all pass; 3 more unit tests than after Task 13 (the policy 1, privacy settings 2).

- [ ] **Step 8: Hand over for commit**

Files: `app/privacy/page.tsx`, `app/privacy/page.test.tsx`, `components/account/PrivacySettingsView.tsx`, `components/account/PrivacySettingsView.test.tsx`, `app/account/privacy/page.tsx`, `app/how-it-works/page.tsx`, `app/safety/page.tsx`, `app/robots.ts`, `app/robots.test.ts`, `app/globals.css`.
Message: `docs: the privacy policy, privacy settings, How it works and Safety say what messaging keeps and removes; reports you've made; robots.txt keeps crawlers off messaging (messaging plan decisions 14, 18, 24 and 27)`

---

### Task 15: End-to-end tests for messaging, reports and notifications

Every flow in spec 7's list, at 390 and 1440, with two browser contexts (a buyer and a seller), including the bundle-blocked form path and the kept-page checks (plan decisions 6, 11 and 23). Each test signs up its own buyer; the seller is the sample "Seller, Tech corner", who only replies to and marks completed the test's own conversation; no test checks the seller's counts.

**Files:**
- Create: `tests/e2e/helpers/messaging.ts`
- Create: `tests/e2e/messaging.spec.ts`
- Modify: `tests/e2e/routes.spec.ts`

- [ ] **Step 1: Write the helpers**

Create `tests/e2e/helpers/messaging.ts` (Playwright only runs `*.spec.ts`, so this file is never run on its own):

```ts
import { expect, test, type Browser, type Page } from "@playwright/test";

// Shared by the messaging tests (messaging plan, Task 15). Every test shares one server and one sample store and runs
// alongside the others, so each signs up a buyer of its own; the sample seller only replies to, and marks completed,
// the test's own conversation, and no test checks the seller's counts (plan decision 23).

export const project = () => test.info().project.name;

export function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

/** A new buyer: an address and a first name no other test uses (plan decision 23). */
export function newBuyer(): { email: string; firstName: string } {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { email: `msg-${project()}-${id}@eduvos.com`, firstName: `Buyer ${id.slice(-6)}` };
}

/** The page that's showing: Next keeps earlier pages hidden in the DOM, so look only at what's visible. */
export const main = (page: Page) => page.locator("main");
export const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
export const button = (page: Page, name: string) =>
  main(page).getByRole("button", { name, exact: true }).filter({ visible: true });

/** The header's account icon (accounts spec 3.4), which carries the new notifications' badge (plan decision 10). */
export const accountIcon = (page: Page) =>
  page.locator(".site-header").getByRole("link", { name: /^(Sign in|Your account)$/ });

/** A status pill on the page that's showing. */
export const statusPill = (page: Page, label: string) =>
  main(page).locator(".status-pill").filter({ visible: true }).filter({ hasText: label });

/** D's first sign-in, from the sign-in page the browser is on, ending wherever its `next` leads. */
export async function signUpHere(page: Page, buyer: { email: string; firstName: string }) {
  await field(page, "Your Eduvos email address").fill(buyer.email);
  await field(page, "I agree to the privacy policy").check();
  await button(page, "Send code").click();
  const note = main(page).getByText(/Sample mode: your code is/).filter({ visible: true });
  await expect(note).toBeVisible();
  await field(page, "6-digit code").fill(/(\d{6})/.exec((await note.textContent()) ?? "")![1]);
  await button(page, "Sign in").click();
  await field(page, "Your first name").fill(buyer.firstName);
  await field(page, "Your campus").selectOption({ label: "Midrand" });
  await button(page, "Continue").click();
}

/** A whole first sign-in with a new buyer. It lands on /account. */
export async function signUp(page: Page, buyer: { email: string; firstName: string }) {
  await page.goto("/login");
  await signUpHere(page, buyer);
  await expect(page).toHaveURL(/\/account$/);
}

/** A sample account's button (accounts spec 2.8), landing on `next`. */
export async function signInAsSample(page: Page, label: string, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await button(page, label).click();
  await page.waitForURL((url) => `${url.pathname}${url.search}` === next);
}

/** A first message from a listing's composer. It ends on the new thread and gives back its id. */
export async function sendFirstMessage(page: Page, listingId: string, text: string, swapOffer?: string): Promise<string> {
  await page.goto(`/listings/${listingId}/message`);
  await field(page, "Your message").fill(text);
  if (swapOffer) await field(page, "Offer a swap (optional)").fill(swapOffer);
  await button(page, "Send").click();
  await expect(page).toHaveURL(/\/messages\/conv-[0-9a-f-]{36}$/);
  return page.url().split("/").at(-1)!;
}

/** A reply on the thread that's showing. */
export async function reply(page: Page, text: string) {
  await field(page, "Your reply").fill(text);
  await button(page, "Send").click();
}

/** The sample seller (Sipho, Tech corner) in a browser of their own. Close its context at the end of the test. */
export async function sellerPage(browser: Browser, baseURL: string): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signInAsSample(page, "Seller, Tech corner");
  return page;
}

/** A message on the page that's showing, by its words. */
export const bubble = (page: Page, text: string) => main(page).getByRole("listitem").filter({ hasText: text });
```

- [ ] **Step 2: Write the tests**

Create `tests/e2e/messaging.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  accountIcon,
  bubble,
  button,
  field,
  main,
  newBuyer,
  onlyAt,
  reply,
  sellerPage,
  sendFirstMessage,
  signInAsSample,
  signUp,
  signUpHere,
  statusPill,
} from "./helpers/messaging";

const BOTH = ["phone-390", "desktop-1440"];

test.describe("messaging a seller (messaging spec 3.1 to 3.3)", () => {
  test("a buyer messages from the listing, through sign-in, and the seller replies", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    const buyer = newBuyer();
    await page.goto("/listings/l-001");
    await page.getByRole("link", { name: "Message seller" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001%2Fmessage$/);
    await signUpHere(page, buyer);
    // Sign-in goes on to the composer (spec 2.1).
    await expect(page).toHaveURL(/\/listings\/l-001\/message$/);
    await expect(main(page).getByRole("heading", { level: 1, name: "Message Tech corner" })).toBeVisible();
    await field(page, "Your message").fill("Hi! Is the calculator still available?");
    await button(page, "Send").click();
    await expect(page).toHaveURL(/\/messages\/conv-/);
    const id = page.url().split("/").at(-1)!;
    await expect(main(page).getByRole("status")).toHaveText("Sent. Sellers usually reply within a day.");
    await expect(statusPill(page, "Asked")).toBeVisible();

    const seller = await sellerPage(browser, baseURL!);
    await seller.goto("/messages?tab=selling");
    const row = main(seller).getByRole("link").filter({ hasText: buyer.firstName });
    await expect(row).toContainText("Casio fx-991ZA Plus calculator");
    await expect(row).toContainText("Unread,");
    await row.click();
    await expect(seller).toHaveURL(new RegExp(`/messages/${id}$`));
    await expect(main(seller).getByRole("heading", { level: 1, name: `Messages with ${buyer.firstName}` })).toBeVisible();
    await reply(seller, "Yes, it is. Library entrance at 13:00?");
    await expect(bubble(seller, "Library entrance at 13:00?")).toContainText("You");
    await expect(statusPill(seller, "Replied")).toBeVisible();
    // A new form after each message, so the box is empty (plan decision 20).
    await expect(field(seller, "Your reply")).toHaveValue("");
    await seller.context().close();

    // The buyer's Refresh is a full page load (plan decision 19). "Sent." showed once (plan decision 7).
    await main(page).getByRole("link", { name: "Refresh" }).click();
    await expect(bubble(page, "Library entrance at 13:00?")).toContainText("Tech corner");
    await expect(statusPill(page, "Replied")).toBeVisible();
    await expect(main(page).getByRole("status")).toHaveCount(0);
  });

  test("the seller marks the sale completed, and the buyer confirms it (spec 2.5)", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const id = await sendFirstMessage(page, "l-001", "Hi! Still available?");
    const seller = await sellerPage(browser, baseURL!);
    await seller.goto(`/messages/${id}`);
    // Not before a reply (spec 3.3).
    await expect(button(seller, "Mark as completed")).toHaveCount(0);
    await reply(seller, "Yes.");
    await button(seller, "Mark as completed").click();
    await expect(statusPill(seller, "Done")).toBeVisible();
    await expect(main(seller).getByText(/^You marked this as completed on /)).toBeVisible();
    await seller.context().close();

    await page.reload();
    const ask = main(page).getByRole("region", { name: "Did the sale happen?" });
    await expect(ask).toContainText("Tech corner marked this as completed on");
    await ask.getByRole("button", { name: "Confirm the sale" }).click();
    await expect(statusPill(page, "Confirmed")).toBeVisible();
    await expect(main(page).getByText(/^Sale confirmed on /)).toBeVisible();
  });

  test("It didn't happen reopens the sale, and the seller can mark it again (spec 2.5)", async ({
    page,
    browser,
    baseURL,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const id = await sendFirstMessage(page, "l-001", "Hi!");
    const seller = await sellerPage(browser, baseURL!);
    await seller.goto(`/messages/${id}`);
    await reply(seller, "Yes.");
    await button(seller, "Mark as completed").click();
    await expect(statusPill(seller, "Done")).toBeVisible();

    await page.reload();
    await main(page).getByRole("button", { name: "It didn't happen" }).click();
    await expect(statusPill(page, "Replied")).toBeVisible();
    await expect(main(page).getByRole("region", { name: "Did the sale happen?" })).toHaveCount(0);

    await seller.reload();
    await expect(button(seller, "Mark as completed")).toBeVisible();
    await seller.context().close();
  });

  test("a listing that takes swaps offers a swap, and the thread shows it as an offer (spec 2.4)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/listings/l-001/message");
    await expect(field(page, "Your message")).toBeVisible();
    await expect(field(page, "Offer a swap (optional)")).toHaveCount(0);
    await sendFirstMessage(page, "l-007", "Would you swap?", "A Bluetooth speaker, barely used");
    await expect(main(page).getByText("Swap offer:").locator("xpath=..")).toHaveText(
      "Swap offer: A Bluetooth speaker, barely used",
    );
  });

  test("the scam check warns before sending, keeping the message, and Send anyway sends it (spec 2.3)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/listings/l-001/message");
    await expect(main(page).getByRole("region", { name: "Stay safe" }).getByRole("listitem")).toHaveCount(3);
    await field(page, "Your message").fill("Can I pay a deposit first to hold it?");
    await button(page, "Send").click();
    const check = main(page).getByRole("alert", { name: "Check this before you send" });
    await expect(check).toContainText("Don't pay a deposit");
    await expect(page).toHaveURL(/\/listings\/l-001\/message$/);
    await expect(field(page, "Your message")).toHaveValue("Can I pay a deposit first to hold it?");
    await check.getByRole("button", { name: "Send anyway" }).click();
    await expect(page).toHaveURL(/\/messages\/conv-/);
    await expect(bubble(page, "Can I pay a deposit first to hold it?")).toBeVisible();
  });

  test("the composer says what's wrong and keeps what was typed (spec 3.1)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/listings/l-001/message");
    await button(page, "Send").click();
    const summary = main(page).getByRole("alert", { name: "There's a problem" });
    await expect(summary.getByRole("link")).toHaveText(["Write a message first."]);
    const long = "a".repeat(1001);
    await field(page, "Your message").fill(long);
    await button(page, "Send").click();
    await expect(summary.getByRole("link")).toHaveText(["Keep it under 1,000 characters."]);
    await expect(field(page, "Your message")).toHaveValue(long);
  });

  test("Back after sending goes to the listing, whose Message seller now opens the thread (plan decisions 5, 6)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/listings/l-001");
    const message = page.getByRole("link", { name: "Message seller" });
    // The signed-in link streams in; wait for it rather than the static shell's sign-in link.
    await expect(message).toHaveAttribute("href", "/listings/l-001/message");
    await message.click();
    await field(page, "Your message").fill("Hi!");
    await button(page, "Send").click();
    await expect(page).toHaveURL(/\/messages\/conv-/);
    const thread = new URL(page.url()).pathname;
    // The send replaced the composer in history (plan decision 6).
    await page.goBack();
    await expect(page).toHaveURL(/\/listings\/l-001$/);
    await expect(message).toHaveAttribute("href", thread);
    await page.goto("/listings/l-001/message");
    await expect(main(page).getByText("You've already messaged Tech corner about this.")).toBeVisible();
    await main(page).getByRole("link", { name: "Open the conversation" }).click();
    await expect(page).toHaveURL(new RegExp(`${thread}$`));
  });

  test("the storefront's Message seller asks the shop a question (plan decision 2)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/sellers/tech-corner");
    const message = page.getByRole("link", { name: "Message seller" });
    await expect(message).toHaveAttribute("href", "/sellers/tech-corner/message");
    await message.click();
    await expect(main(page).getByText("A question for the shop · Midrand")).toBeVisible();
    await expect(field(page, "Offer a swap (optional)")).toHaveCount(0);
    await field(page, "Your message").fill("Do you fix cracked screens?");
    await button(page, "Send").click();
    await expect(page).toHaveURL(/\/messages\/conv-/);
    await expect(main(page).getByRole("link", { name: "Tech corner" })).toHaveAttribute("href", "/sellers/tech-corner");
  });

  test("a seller can't message their own listing, and a sold listing can't be messaged (spec 3.1)", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Seller, Tech corner", "/listings/l-001/message");
    await expect(main(page).getByText("This is your listing, so you can't message yourself.")).toBeVisible();
    await page.goto("/listings/l-026/message");
    await expect(main(page).getByText("This listing isn't available right now, so it can't be messaged.")).toBeVisible();
    await expect(main(page).getByRole("link", { name: "See similar items" })).toHaveAttribute("href", "/browse?cat=tech");
  });

  test("only the buyer and the seller can open a thread (spec 3.3)", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const id = await sendFirstMessage(page, "l-001", "Hi!");
    const other = await browser.newContext({ baseURL });
    const stranger = await other.newPage();
    await signUp(stranger, newBuyer());
    await stranger.goto(`/messages/${id}`);
    await expect(stranger.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await other.close();
  });

  test("the inbox has Buying and Selling only for an account with a shop (spec 2.10)", async ({
    page,
    browser,
    baseURL,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/messages");
    await expect(main(page).getByText("No messages yet. Find something you like and message the seller.")).toBeVisible();
    await expect(main(page).getByRole("navigation", { name: "Buying and selling" })).toHaveCount(0);
    const seller = await sellerPage(browser, baseURL!);
    await seller.goto("/messages");
    const tabs = main(seller).getByRole("navigation", { name: "Buying and selling" });
    await tabs.getByRole("link", { name: "Selling" }).click();
    await expect(seller).toHaveURL(/\/messages\?tab=selling$/);
    await expect(tabs.getByRole("link", { name: "Selling" })).toHaveAttribute("aria-current", "page");
    await expect(main(seller).getByRole("link").filter({ hasText: "Thandi" }).first()).toBeVisible();
    await seller.context().close();
  });
});

test("a report goes through sign-in to the form, then a thank-you; one per listing (spec 2.8 and 3.4)", async ({
  page,
}) => {
  onlyAt(...BOTH);
  await page.goto("/listings/l-001");
  await page.getByRole("link", { name: "Report this listing" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Freport%3Flisting%3Dl-001$/);
  await expect(main(page).getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/listings/l-001");
  await signUpHere(page, newBuyer());
  await expect(page).toHaveURL(/\/report\?listing=l-001$/);
  await expect(main(page).getByRole("heading", { level: 1, name: "Report this listing" })).toBeVisible();
  await button(page, "Send report").click();
  await expect(main(page).getByRole("alert", { name: "There's a problem" })).toContainText("Choose a reason.");
  await main(page).getByRole("radio", { name: "Misleading listing" }).check();
  await field(page, "Tell us more (optional)").fill("The photo isn't the same model.");
  await button(page, "Send report").click();
  await expect(page).toHaveURL(/\/report\/sent\?listing=l-001$/);
  await expect(main(page).getByText(/^Thanks\. The Hub reviews reports within two working days\./)).toBeVisible();

  // Signed in, Report goes straight to the form, and the thank-you replaces it in history (plan decision 6).
  await page.goto("/listings/l-002");
  const report = page.getByRole("link", { name: "Report this listing" });
  await expect(report).toHaveAttribute("href", "/report?listing=l-002");
  await report.click();
  await main(page).getByRole("radio", { name: "Spam" }).check();
  await button(page, "Send report").click();
  await expect(page).toHaveURL(/\/report\/sent\?listing=l-002$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/listings\/l-002$/);

  await page.goto("/report?listing=l-001");
  await expect(main(page).getByText(/^You've reported this listing already\./)).toBeVisible();
  await page.goto("/account/privacy");
  const reports = main(page).getByRole("region", { name: "Reports you've made" });
  await expect(reports.getByRole("listitem")).toHaveCount(2);
  await expect(reports).toContainText("Casio fx-991ZA Plus calculator");
});

test("the header counts new notifications, and the notifications page lists them (spec 2.9, 3.5 and 3.6)", async ({
  page,
  browser,
  baseURL,
}) => {
  onlyAt(...BOTH);
  await signUp(page, newBuyer());
  const id = await sendFirstMessage(page, "l-001", "Hi! Is it still available?");
  await page.goto("/");
  await expect(accountIcon(page)).toHaveAccessibleName("Your account");
  await expect(accountIcon(page)).not.toHaveAttribute("aria-describedby");

  const seller = await sellerPage(browser, baseURL!);
  await seller.goto(`/messages/${id}`);
  await reply(seller, "Yes, it is.");
  await seller.context().close();

  // The header is drawn again on a full page load (plan decision 11).
  await page.goto("/");
  await expect(accountIcon(page)).toHaveAccessibleName("Your account");
  await expect(accountIcon(page)).toHaveAccessibleDescription("1 new notification");
  await expect(page.getByText("1 new message", { exact: true })).toBeVisible();
  await page.goto("/account");
  await expect(main(page).getByRole("link", { name: /^Messages\s*,\s*1 unread$/ })).toBeVisible();
  await main(page).getByRole("link", { name: /^Notifications\s*,\s*1 new$/ }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  const note = main(page).getByRole("link").filter({ hasText: "Tech corner replied about Casio fx-991ZA Plus calculator" });
  await expect(note).toContainText("New");
  await note.click();
  await expect(page).toHaveURL(new RegExp(`/messages/${id}$`));
  await page.goto("/");
  await expect(accountIcon(page)).not.toHaveAttribute("aria-describedby");
  await expect(page.getByText("1 new message", { exact: true })).toHaveCount(0);
});

test.describe("kept pages stay right (plan decision 6)", () => {
  test("a link back to the inbox shows the other person's new reply", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const id = await sendFirstMessage(page, "l-001", "Hi!");
    await main(page).getByRole("link", { name: "Back to messages" }).click();
    await expect(page).toHaveURL(/\/messages$/);
    const row = main(page).getByRole("link").filter({ hasText: "Casio fx-991ZA Plus calculator" });
    await expect(row).not.toContainText("Unread,");
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/messages/${id}$`));

    const seller = await sellerPage(browser, baseURL!);
    await seller.goto(`/messages/${id}`);
    await reply(seller, "Yes, it is.");
    await seller.context().close();

    // A link asks the server again for the kept inbox (Next's staleTimes.dynamic is 0). If this fails, Next showed the
    // kept copy: stop and report it with the trace (plan decision 6); don't change the test to a full page load.
    await main(page).getByRole("link", { name: "Back to messages" }).click();
    await expect(row).toContainText("Unread,");
    await expect(row).toContainText("Yes, it is.");
  });

  test("Back to the inbox after your own reply shows it: the reply dropped the kept copy", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const id = await sendFirstMessage(page, "l-001", "Hi!");
    await page.goto("/messages");
    const row = main(page).getByRole("link").filter({ hasText: "Casio fx-991ZA Plus calculator" });
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/messages/${id}$`));
    await reply(page, "Also, does it come with the cover?");
    await expect(bubble(page, "does it come with the cover")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(row).toContainText("You: Also, does it come with the cover?");
  });
});

test.describe("without the app's JavaScript (spec 7)", () => {
  test.beforeEach(async ({ page }) => {
    // The app's bundle never arrives. React's small inline script still puts streamed content in place.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
  });

  test("a first message with a swap, a reply past the scam check, and a report all work", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await sendFirstMessage(page, "l-007", "Would you swap?", "A Bluetooth speaker");
    await expect(main(page).getByRole("status")).toHaveText("Sent. Sellers usually reply within a day.");
    await expect(main(page).getByText("Swap offer:")).toBeVisible();
    await reply(page, "Can I pay a deposit?");
    // A post is a full page load without the app's JavaScript, so the browser focuses the check (plan decision 9).
    const check = main(page).locator(".msg-check");
    await expect(check).toBeFocused();
    await check.getByRole("button", { name: "Send anyway" }).click();
    await expect(bubble(page, "Can I pay a deposit?")).toBeVisible();
    await page.goto("/report?seller=tech-corner");
    await main(page).getByRole("radio", { name: "Spam" }).check();
    await button(page, "Send report").click();
    await expect(page).toHaveURL(/\/report\/sent\?seller=tech-corner$/);
  });
});

test("messaging pages stay out of search engines", async ({ page }) => {
  onlyAt("desktop-1440");
  await signUp(page, newBuyer());
  for (const [path, title] of [
    ["/messages", "Messages · Vossie"],
    ["/notifications", "Notifications · Vossie"],
    ["/listings/l-002/message", "Message Book swap · Vossie"],
    ["/report?listing=l-002", "Report · Vossie"],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  }
});
```

- [ ] **Step 3: The new pages need sign-in**

In `tests/e2e/routes.spec.ts`, add this test inside the `describe`, after D's "account pages send a signed-out visitor to sign in, coming back afterwards (accounts spec 2.10)":

```ts

  test("messaging pages send a signed-out visitor to sign in, coming back afterwards (messaging spec 3)", async ({
    page,
  }) => {
    onlyAtPhoneAndDesktop();
    for (const [path, next] of [
      ["/messages", "%2Fmessages"],
      ["/messages?tab=selling", "%2Fmessages%3Ftab%3Dselling"],
      ["/messages/conv-s1", "%2Fmessages%2Fconv-s1"],
      ["/notifications", "%2Fnotifications"],
      ["/listings/l-001/message", "%2Flistings%2Fl-001%2Fmessage"],
      ["/sellers/tech-corner/message", "%2Fsellers%2Ftech-corner%2Fmessage"],
      ["/report?listing=l-001", "%2Freport%3Flisting%3Dl-001"],
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${next}$`));
    }
    // Something that doesn't exist is the 404 before any sign-in.
    for (const path of ["/listings/nope/message", "/sellers/nope/message", "/report?listing=nope", "/report"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    }
  });
```

- [ ] **Step 4: Run them**

Run: `pnpm e2e tests/e2e/messaging.spec.ts tests/e2e/routes.spec.ts`
Expected: all pass at 390 and 1440; the rest are skipped by design.

If a test fails, look at the trace before changing anything:
- **"a link back to the inbox shows the other person's new reply" fails**: Next showed its kept copy on a link. That's a real finding, not a test problem: stop and report it with the trace. The options are Lama's: the inbox's entry points as full page loads (plain `<a>`), or a small client part like Saved's `RefreshWhenStale` (spec 6 rules out client code for messaging).
- **"Back to the inbox after your own reply" fails**: the reply didn't drop the kept pages. Check that every write action ends with `done()` (`refresh()` before the redirect), and stop and report if it does.
- **The check isn't focused** with the bundle blocked: report it with the trace (as D Task 13).
- **A Message seller or Report link still goes to sign-in when signed in**: the click came before the session's link streamed in. Wait for its `href` first, as these tests do, and note it for "Changes made during the build".
- **A strict-mode error** naming two elements: make the locator exact (scope it to `main`, add `exact: true` or `.filter({ visible: true })`), and note it.

- [ ] **Step 5: Run the whole end-to-end suite**

Run: `pnpm e2e`
Expected: all pass; note the counts. D's `accounts.spec.ts` (changed in Task 7), `listing.spec.ts` and `shopping.spec.ts` included.

- [ ] **Step 6: Hand over for commit**

Files: `tests/e2e/helpers/messaging.ts`, `tests/e2e/messaging.spec.ts`, `tests/e2e/routes.spec.ts`.
Message: `test: messaging, the sale, swaps, the scam check, reports, notifications and the header's count end to end, with two browsers, the bundle blocked and kept pages checked`

---

### Task 16: Accessibility, layout shift and size

axe on every messaging page and state, layout shift on each signed in, and each page's JS measured signed in (spec 7's checks). The sample accounts are only read here (plan decision 16), with one exception noted below.

**Files:**
- Modify: `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`, `tests/e2e/performance.spec.ts`
- Possibly modify: `app/globals.css`, a component (only if a check finds a cause to fix)

- [ ] **Step 1: Run axe on each page and state**

In `tests/e2e/a11y.spec.ts`, add `import { newBuyer, reply, sellerPage, sendFirstMessage, signUp } from "./helpers/messaging";` below the `@playwright/test` import (Task 15's helpers), and add to the end of the file:

```ts

// --- Messaging (messaging plan, Task 16) --------------------------------------------------------------------------

/**
 * Signs in with a sample account's button, landing on `next`. The sample student is only read here, except that
 * opening a thread or /notifications marks the student's sample notifications read, which no test counts.
 */
async function signInTo(page: Page, label: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.locator("main").getByRole("button", { name: label, exact: true }).click();
  await page.waitForURL((url) => `${url.pathname}${url.search}` === next);
}

test("the composer, with its tips", async ({ page }) => {
  await signInTo(page, "Student, Midrand", "/listings/l-002/message");
  await expect(page.getByRole("heading", { level: 1, name: "Message Book swap" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the composer, with errors and then the scam check", async ({ page }) => {
  // Thandi has a conversation about l-007, so the mentor, who has none, sees the form. A failed post and the check
  // only write form state for this browser's session.
  await signInTo(page, "Mentor", "/listings/l-007/message");
  await page.locator("main").getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await page.getByLabel("Your message", { exact: true }).fill("Can I pay a deposit first?");
  await page.locator("main").getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Check this before you send" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the inbox, Buying and Selling", async ({ page }) => {
  await signInTo(page, "Seller, Tech corner", "/messages?tab=selling");
  await expect(page.getByRole("link", { name: "Selling" })).toHaveAttribute("aria-current", "page");
  expect(await seriousIssues(page)).toEqual([]);
  await signInTo(page, "Student, Midrand", "/messages");
  await expect(page.locator("main .inbox-row").first()).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a thread, as the seller, with Mark as completed", async ({ page }) => {
  // Sipho has read everything in the sample conversations, so opening one changes nothing.
  await signInTo(page, "Seller, Tech corner", "/messages/conv-s1");
  await expect(page.getByRole("button", { name: "Mark as completed" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a thread, as the buyer, with a sale to confirm", async ({ page, browser, baseURL }) => {
  // A conversation of the test's own: the sample one confirms itself a week after 13 October (spec 2.5).
  await signUp(page, newBuyer());
  const id = await sendFirstMessage(page, "l-001", "Hi! Is it still available?");
  const seller = await sellerPage(browser, baseURL!);
  await seller.goto(`/messages/${id}`);
  await reply(seller, "Yes, it is.");
  await seller.locator("main").getByRole("button", { name: "Mark as completed", exact: true }).click();
  await expect(seller.locator("main .status-pill").filter({ visible: true })).toHaveText("Done");
  await seller.context().close();
  await page.reload();
  await expect(page.getByRole("region", { name: "Did the sale happen?" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("report, with an error", async ({ page }) => {
  await signInTo(page, "Mentor", "/report?listing=l-002");
  await page.locator("main").getByRole("button", { name: "Send report", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the report's thank-you", async ({ page }) => {
  await page.goto("/report/sent?listing=l-001");
  await expect(page.getByRole("link", { name: "Back to the listing" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("notifications", async ({ page }) => {
  await signInTo(page, "Student, Midrand", "/notifications");
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the header with a new notification's badge, and the account page's counts", async ({ page, browser, baseURL }) => {
  // A buyer of the test's own, so the badge is certain to be there (plan decision 23).
  await signUp(page, newBuyer());
  const id = await sendFirstMessage(page, "l-001", "Hi!");
  const seller = await sellerPage(browser, baseURL!);
  await seller.goto(`/messages/${id}`);
  await reply(seller, "Yes, it is.");
  await seller.context().close();
  await page.goto("/");
  await expect(page.locator(".site-header .hdr-badge-alert")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await page.goto("/account");
  await expect(page.getByRole("link", { name: /^Notifications\s*,\s*1 new$/ })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});
```

- [ ] **Step 2: Measure layout shift on the new pages, signed in**

In `tests/e2e/cls.spec.ts` (D Task 14 made `PAGES`' fourth value `signedIn?: boolean`, signing in as "Student, Midrand"):
1. Change that fourth value to the sample account's button label: in the type, replace `signedIn?: boolean` with `signIn?: string`; in D's rows, replace `true` with `"Student, Midrand"`; in the loop, replace `signedIn` with `signIn`; and in the block that signs in, replace `{ name: "Student, Midrand", exact: true }` with `{ name: signIn, exact: true }`. Add to the comment above `PAGES`: `Messaging's pages are measured signed in too: the seller for a thread and notifications, which the seller only reads.`
2. Add these rows at the end of `PAGES`:

```ts
  ["homepage (signed in: the badge and the strip)", "/", undefined, "Student, Midrand"],
  ["composer page", "/listings/l-002/message", undefined, "Student, Midrand"],
  ["inbox page", "/messages", undefined, "Student, Midrand"],
  ["thread page", "/messages/conv-s1", undefined, "Seller, Tech corner"],
  ["report page", "/report?listing=l-002", undefined, "Student, Midrand"],
  ["notifications page", "/notifications", undefined, "Seller, Tech corner"],
```

- [ ] **Step 3: Measure each page's JS, signed in**

In `tests/e2e/performance.spec.ts`, replace D's test "a first visit to the account page, signed in, stays inside the JavaScript budget" (the whole `test(…)`) with a loop over the signed-in pages, keeping its body:

```ts

// Pages for a signed-in visitor, measured on a first visit with only the session cookie copied in, so nothing is
// cached yet (accounts plan, Task 14; messaging plan, Task 16).
const SIGNED_IN_PAGES: ReadonlyArray<[name: string, path: string, account: string]> = [
  ["account page", "/account", "Student, Midrand"],
  ["inbox page", "/messages", "Student, Midrand"],
  ["thread page", "/messages/conv-s1", "Seller, Tech corner"],
  ["composer page", "/listings/l-002/message", "Student, Midrand"],
  ["report page", "/report?listing=l-002", "Student, Midrand"],
  ["notifications page", "/notifications", "Seller, Tech corner"],
];

for (const [name, path, account] of SIGNED_IN_PAGES) {
  test(`a first visit to the ${name}, signed in, stays inside the JavaScript budget`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
    const other = await browser.newContext();
    const signingIn = await other.newPage();
    await signingIn.goto(`${baseURL}/login`);
    await signingIn.locator("main").getByRole("button", { name: account, exact: true }).click();
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
    await expect(page.locator("main h1")).toBeVisible();
    await Promise.all(pending);
    console.log(`${name} (signed in): ${JSON.stringify({ scriptBrotli })}`);
    expect(scriptBrotli, "JavaScript, brotli as a host serves it").toBeLessThanOrEqual(150 * 1024);
  });
}
```

If part B's request page has no row in `PAGES` yet, add `["request page", "/looking-for/r-001"],` after the storefront's, so Task 17's figures include it.

- [ ] **Step 4: Run them**

Run: `pnpm e2e tests/e2e/a11y.spec.ts tests/e2e/cls.spec.ts tests/e2e/performance.spec.ts`
Expected: all pass. Note each new page's layout shift at 390 and 1440, and every page's `scriptBrotli` (the messaging pages should be within a few bytes of the account page's: none adds client code), for `docs/PROGRESS.md` and the ledger. **If any page is past the stop line, stop here and report the figures.**

If axe reports a serious or critical issue, fix the cause in the component or CSS, not the test, and note it for "Changes made during the build". If a page's layout shift is over 0.05, the log names the moving nodes: most likely a skeleton isn't the height of what replaces it at that size. Measure the real part on a production build (`document.querySelector("main .composer-main").getBoundingClientRect().height`, and so on) and set the skeleton's height for that step of the layout to match, then run again.

- [ ] **Step 5: Hand over for commit**

Files: `tests/e2e/a11y.spec.ts`, `tests/e2e/cls.spec.ts`, `tests/e2e/performance.spec.ts`, and any component or CSS file a fix touched.
Message: `test: accessibility, layout shift and size for the composer, inbox, thread, report and notifications pages, signed in. JS: inbox <n> B, thread <n> B, composer <n> B`

---

### Task 17: Review screenshots, docs and final checks

**Files:**
- Modify: `tests/e2e/screenshots.spec.ts`
- Create: `docs/progress/messaging/*.png`
- Modify: `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, the spec (`docs/superpowers/specs/2026-10-14-messaging-design.md`)
- Modify: this plan (the ledger and a "Changes made during the build" section)

- [ ] **Step 1: Check the docs are free to edit**

Run `git status --short` on its own. Expected: only ` M .claude/launch.json` and nothing of this stage's left uncommitted. If another stage's work has the docs open (changed and uncommitted), stop and ask the controller before editing them. Read each doc's current text before editing it, and edit by meaning where this step's quoted lines have moved.

- [ ] **Step 2: Add the review screenshots**

In `tests/e2e/screenshots.spec.ts`, add `import { newBuyer, reply, sellerPage, sendFirstMessage, signUp } from "./helpers/messaging";` below the `@playwright/test` import, and add to the end of the file:

```ts

test("messaging review screenshots", async ({ page, browser, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/messaging/${project}-${name}.png`;
  const main = page.locator("main");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page, newBuyer());

  await page.goto("/listings/l-007/message");
  await expect(main.getByRole("region", { name: "Stay safe" })).toBeVisible();
  await page.screenshot({ path: file("01-composer"), fullPage: true });

  await page.getByLabel("Your message", { exact: true }).fill("Hi! Can I pay a deposit to hold it?");
  await page.getByLabel("Offer a swap (optional)", { exact: true }).fill("A Bluetooth speaker, barely used");
  await main.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Check this before you send" })).toBeVisible();
  await page.screenshot({ path: file("02-scam-check"), fullPage: true });

  await main.getByRole("button", { name: "Send anyway", exact: true }).click();
  await expect(main.getByRole("status")).toHaveText("Sent. Sellers usually reply within a day.");
  const id = page.url().split("/").at(-1)!;
  await page.screenshot({ path: file("03-thread-sent"), fullPage: true });

  const seller = await sellerPage(browser, baseURL!);
  await seller.emulateMedia({ reducedMotion: "reduce" });
  await seller.setViewportSize(page.viewportSize()!);
  await seller.goto("/messages?tab=selling");
  await expect(seller.locator("main .inbox-row").first()).toBeVisible();
  await seller.screenshot({ path: file("04-inbox-selling"), fullPage: true });
  await seller.goto(`/messages/${id}`);
  await reply(seller, "Hi! No deposit needed. Can I see the speaker first?\nI'm at the library entrance after 12:00.");
  await expect(seller.locator("main").getByRole("button", { name: "Mark as completed" })).toBeVisible();
  await seller.screenshot({ path: file("05-thread-seller"), fullPage: true });
  await seller.locator("main").getByRole("button", { name: "Mark as completed" }).click();
  await expect(seller.locator("main .status-pill").filter({ visible: true })).toHaveText("Done");
  await seller.context().close();

  await page.reload();
  await expect(page.getByRole("region", { name: "Did the sale happen?" })).toBeVisible();
  await page.screenshot({ path: file("06-sale-to-confirm"), fullPage: true });

  await page.goto("/");
  await expect(page.locator(".site-header .hdr-badge-alert")).toBeVisible();
  await page.screenshot({ path: file("07-header-badge") });

  await page.goto("/messages");
  await expect(main.locator(".inbox-row").first()).toBeVisible();
  await page.screenshot({ path: file("08-inbox"), fullPage: true });

  await page.goto("/account");
  await expect(main.getByRole("link", { name: /^Notifications/ })).toBeVisible();
  await page.screenshot({ path: file("09-account"), fullPage: true });

  await page.goto("/notifications");
  await expect(main.getByText("New", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: file("10-notifications"), fullPage: true });

  await page.goto("/report?listing=l-001");
  await main.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  await page.screenshot({ path: file("11-report"), fullPage: true });

  await main.getByRole("radio", { name: "Misleading listing" }).check();
  await main.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(main.getByRole("heading", { level: 1, name: "Report sent" })).toBeVisible();
  await page.screenshot({ path: file("12-report-sent") });
});
```

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "messaging review screenshots"`
Expected: 24 PNGs in `docs/progress/messaging/`. Open a few and check they show what their names say.

- [ ] **Step 3: Bring the spec in line with the build**

In `docs/superpowers/specs/2026-10-14-messaging-design.md`:
- Status: "Built (2026-10-<day>), in sample mode."
- Decision 1: the storefront's Message opens `/sellers/[slug]/message`, a question to the shop with no listing (plan decision 2); signed-out Report links go through sign-in to the report form, as Message goes to the composer (plan decision 3).
- Decision 2: a composer opened again shows "You've already messaged {shop} about this." with Open the conversation; the signed-in Message link goes straight to the thread (plan decision 5).
- Decision 3: the check runs on replies too; the warning focuses on a page load (plan decision 9).
- Decision 6: Refresh is a full page load, on the inbox too; every post drops the browser's kept pages (plan decisions 6 and 19).
- Decision 8: one report per account per target while open, and 10 a day (plan decision 17).
- Decision 9: the header's count is a red badge on the account icon, and it's as fresh as the last full page load or post (plan decisions 10 and 11); one notification per conversation while unread (plan decision 12).
- Section 3.1: the hint "Up to 1,000 characters." instead of a live count (plan decision 8); "Sent." comes from the form state, shown once, not a flash cookie (plan decision 7).
- Section 3.3: a thread whose other side has left can't be replied to (plan decision 21).
- Section 3.6: privacy settings list the reports you've made (plan decision 18); deleting an account keeps the other side's messages (plan decision 14).
- Anything else from this plan's "Changes made during the build".

- [ ] **Step 4: Log the decisions**

In `docs/reference/LANDING-DECISIONS.md`, add a row after the last, numbered one more than it, in the log's style:

```markdown
| N | 2026-10-<day> | Messaging plan decisions that change the spec | **A conversation belongs to a shop; the storefront's Message asks the shop a question; the header's count is a red badge on the account icon, fresh as of the last page load or post; every messaging post ends with refresh() so the browser drops kept pages; "Sent." comes from form state, not a cookie; no live character count; one report per target and 10 a day; deleting an account keeps the other side's messages; Eduvos sets how long messages are kept** | Plan decisions 1 to 3, 6 to 8, 10, 11, 14, 17 and 27 in `2026-10-14-messaging.md`. The spec now says so. A bell needs room the phone header doesn't have at 360px; a live count or live updates need client code, which spec 6 rules out; a flash cookie can't be deleted during a render. <Lama, at plan review, or: Claude, under decision 54> |
```

Name in it any other plan decision Lama changed or kept on purpose, and any JS figure Lama accepted under the stop rule.

- [ ] **Step 5: Update the go-live checklist**

In `docs/reference/GO-LIVE.md`:
- Section 2: "Privacy settings: consent record, download my data, reports I've made, delete my account" → **Built**. "Header: 'Sign in' when signed out, and an inbox icon with an unread count" → **Built** (a red badge for new notifications on the account icon, messaging plan decision 10).
- Section 3:
  - "Message composer, with live scam tips": route `/listings/[id]/message` and `/sellers/[slug]/message`; **Built as a page; the scam check runs on the server when you send**.
  - "Propose a swap (inside the composer)": **Built** (a text offer; offering one of your own listings waits for stage F).
  - "Inbox": **Built**. "Conversation thread, with its status…": **Built**.
  - "Notifications panel": route `/notifications`; **Built as a page**.
  - "Report a listing or a profile (7 reasons, then a thank-you)": routes `/report`, `/report/sent`; **Built**, requests too.
  - "WhatsApp handoff": **Cut** (decision 57).
- Section 6:
  - Backend: add `- [ ] Supabase tables for conversations, messages, reports and notifications replace the sample store's (\`lib/data/messages.ts\`, \`notifications.ts\`, \`reports.ts\`).`, `- [ ] Live updates and the header's count without a page load (Supabase Realtime), if wanted: spec 2.6 left them out.`, `- [ ] A scheduled job for the 7-day auto-confirm (it's checked on read today) and for deleting old messages, reports and notifications once Eduvos sets how long they're kept.` and `- [ ] A limit on messages per account (reports have one: 10 a day).`
  - POPIA and legal: add `- [ ] Eduvos sets how long messages, reports and notifications are kept; the privacy policy says so.`
- Section 7: "In-app messages, a WhatsApp handoff, or both? And do new messages send an email?" becomes `**Do new messages send an email?** In-app messages only (decision 57); email notifications are still to decide.`
- Section 8, item 5: `**Done in sample mode (2026-10-<day>): messaging, reports and notifications.** Supabase replaces the sample store at go-live.`

- [ ] **Step 6: Update CLAUDE.md**

In `CLAUDE.md`:
- Under "Code rules", after D's line that starts `- Who's signed in comes only from`, add:
  `- Messaging's Server Actions end every write with \`done()\` (\`refresh()\`, then a \`replace\` redirect; \`lib/messaging/actions.ts\`), so the browser drops its kept pages. Message text is React text, never HTML, and links in it aren't made clickable.`
- Under "Privacy (POPIA)", in D's line that starts `- Collect the minimum. Sample mode keeps accounts, sessions, consent and sign-ins in the server's memory only`, replace `accounts, sessions, consent and sign-ins` with `accounts, sessions, consent, sign-ins, messages, reports and notifications`.

- [ ] **Step 7: Update the progress log**

In `docs/PROGRESS.md`, add a section before "Next", in the style of the earlier ones:

```markdown
## 2026-10-<day>: Messaging, reports and notifications built, in sample mode (stage E)
- **Messages** (`/listings/[id]/message`, `/sellers/[slug]/message`, `/messages`, `/messages/[id]`): a signed-in student messages a seller about a listing, with a swap offer when it takes swaps, or asks a shop a question from its storefront. Three safety tips sit beside the composer, and the server checks each message for paying in advance, bank details, a deposit, a courier or a code, with Send anyway. The inbox has Buying and Selling; a thread shows who wrote what and when, the status (Asked, Replied, Done, Confirmed), Mark as completed, Confirm the sale and It didn't happen, and confirms a sale itself a week after it's marked done. Refresh reloads; there are no live updates.
- **Reports** (`/report`, `/report/sent`): seven reasons and a detail for a listing, a seller or a request, one per target and 10 a day, then a thank-you. Privacy settings list the reports you've made.
- **Notifications** (`/notifications`): new messages and sales to confirm, marked read on opening. The header's account icon carries a red count of new ones; the account page lists Messages and Notifications with their counts; the homepage strip counts new messages and sales to confirm.
- **Every form works without the app's JavaScript**, and every post makes the browser drop its kept pages (`refresh()`), so Back never shows a page from before your own change.
- **Privacy:** the policy, the export and deletion take in messages, reports and notifications; deleting an account keeps the other person's side of each conversation; how long they're kept is Eduvos's call before launch.
- **Where the build differed from the plan** is in the plan's "Changes made during the build".
- **Plan decisions Lama may want to revisit:** <list any that came up in review, or "none">.
- **Checks:**
  - lint and types are clean;
  - <n> unit tests pass;
  - end to end, <n> pass, <n> are skipped by design and none fail;
  - axe finds no serious or critical issues.
- **First visit at 390px, JS brotli:** homepage <n> B, browse <n> B, listing <n> B, storefront <n> B, request <n> B; signed in: inbox <n> B, thread <n> B, composer <n> B (stop line <n> B, limit 153,600 B).
- **Layout shift** (fonts held back, at 390 and 1440px): <a table of the composer, inbox, thread, report and notifications pages, and the signed-in homepage>.
- Review screenshots: `docs/progress/messaging/`.
```

Fill in the numbers from your runs. Then make "Next" say:

```markdown
## Next
- Lama reviews the screenshots in `docs/progress/messaging/`. To retake them, run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "messaging review screenshots"`.
- Then stage F: selling (`2026-10-14-selling-design.md`), whose dashboard counts this stage's enquiries, replies and confirmed sales.
```

- [ ] **Step 8: Fill in this plan**

Fill in the JS ledger, and add a "Changes made during the build" section after it, listing every place the build differed from the tasks as written, with the commit that made each change.

- [ ] **Step 9: Final checks**

Run, one after another: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`.
Expected: all pass. Record the unit and e2e counts in `docs/PROGRESS.md`.

- [ ] **Step 10: Hand over for commit**

Files: `tests/e2e/screenshots.spec.ts`, `docs/progress/messaging/`, `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/superpowers/specs/2026-10-14-messaging-design.md`, this plan.
Message: `docs: messaging review screenshots, progress, checklist, decisions, CLAUDE.md and the spec brought in line (stage E). JS: / <n> B, browse <n> B, listing <n> B, storefront <n> B, inbox <n> B`
