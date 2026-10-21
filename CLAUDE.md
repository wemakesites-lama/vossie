# Vossie: project notes

@AGENTS.md

Vossie is the student marketplace for every Eduvos campus. Lama Nkuna is the UI/UX designer and developer.

## Source of truth
- Homepage spec: `docs/superpowers/specs/2026-10-08-homepage-design.md`
- Decisions log: `docs/reference/LANDING-DECISIONS.md`
- Build plans: `docs/superpowers/plans/`
- Progress log: `docs/PROGRESS.md` (update at the end of every session)
- Old demo audit and function map: `docs/reference/`
- `vossie-audit/` is a local, untracked copy of the audit, kept out of git at Lama's request. Never add it to git, move it or delete it.
- `.superpowers/` holds untracked brainstorm session files. Leave it alone.
- Accessibility target: WCAG 2.2 AA (spec section 10). Performance budget for a first visit: 150 KB compressed JS, 60 KB fonts, 350 KB before below-the-fold photos (spec section 11).

## Stack
- Next.js 16.4 App Router with Cache Components, React 19.3, TypeScript, Tailwind CSS 4.3 through PostCSS (`@tailwindcss/postcss`, pinned to the same version as `tailwindcss`: bump the two together)
- pnpm 10 only (never npm or yarn)
- Vitest 5 + Testing Library (unit, next to the code), Playwright + axe (`tests/e2e/`)
- Next.js docs for the installed version are in `node_modules/next/dist/docs/`. Read them before using a Next API.

## Commands
- `pnpm dev --port 3100` (or preview `vossie-dev`)
- `pnpm test` · `pnpm e2e` · `pnpm lint` · `pnpm typecheck` · `pnpm build`

## Brand (Eduvos)
- Navy `#15305D`, sky `#29ABE2`, sky-dark `#1E7BA8`, panel `#F3F3F3`, pale `#E1F0F7`, ink `#373F41` (the spec's `text` token), muted `#5B6577`, idle `#B9C0CC`, idle-text `#7E879A` (inactive large text).
- Sky never carries text, icons or thin borders on white. Navy on sky and sky on navy are fine. Links on white use sky-dark.
- **On the star texture** (`texture-stars`):
  - Small text is white.
  - Sky is only for large text (24px+, or 18.66px+ bold), icons and arrows, solid sky pills, and the wordmark.
  - The reason: a star behind a letter drops small sky text to about 4.0:1.
- Fonts only through `font-display`, `font-text` and `font-accent` (or `var(--vos-font-*)` in CSS). Never a font name in a component.
- The crest comes only from `assets/brand/` until Eduvos sends the official SVG.
- Icons only from `components/icons.tsx`. No emoji as icons.

## Code rules
- Server Components by default. `"use client"` only where there is interaction.
- Device preferences (campus cookie `vossie_campus`, saved cookie `vossie_saved`, recent searches, data saver) go through the stores in `lib/` and `useSyncExternalStore`.
- Never read `cookies()`, `headers()` or `searchParams` outside `<Suspense>`.
- `generateMetadata` may read the session or `searchParams` when the page's own content is request-time inside `<Suspense>`: Next streams the metadata (staff pages and `/browse` do this).
- Who's signed in comes only from `getViewer()` or `requireAccount()` (`lib/auth/session.ts`), inside `<Suspense>`. Forms are plain `<form action={serverAction}>`, except the posts that start or end a session and account deletion, which post to Route Handlers that answer 303 (stage K): the action checks its input, takes identity from the session, keeps errors in the store (never the URL) and ends with `redirect()`. Only `lib/data` touches the sample store.
- Looking For requests live in the sample store and are read through `lib/data/requests.ts`, tagged `requests`: every write calls `requestsChanged()` before `done()`. An offer is an E conversation with `requestId` set; F's counting leaves offer threads out of enquiries. A form that makes a new request carries a one-time token (`lib/staff/once.ts`).
- Looking For requests close themselves (`closingDay` in `lib/looking-for/rules.ts`: 3 days after the needed-by date, else 30 days after the last change; the samples never). The list readers take `today` and apply `requestOpenOn` inside `"use cache"`. `settleRequests(now)` stores the close and tells the asker, and, from 2 days before the closing day, sends one reminder (`reminderDue`, marked by `remindedFor` with the closing day, so a moved closing day allows a new one; it still returns only the count closed, so a reminder expires no tag), only from request-time code (after `connection()`, or first thing in a Server Action, which then calls `requestsChanged()`), never inside `"use cache"`. The asker's reads (`getOwnRequest`, `listOwnRequests`, `countOpenRequests`) take `now` and settle first; the data download settles first too.
- Saved searches live in the sample store and are read through `lib/data/saved-searches.ts`. They match listings only through browse's `listingMatches` (`lib/browse/results.ts`): never copy browse's search rules. Matching runs in `saveListingForm` on a first publish, after `notifyFollowers` and under its condition. A notification that comes at most once a day goes through `notifyOncePerDay` in `lib/data/notifications.ts`.
- Messaging's Server Actions end every write with `done()` (`refresh()`, then a `replace` redirect; `lib/messaging/actions.ts`), so the browser drops its kept pages. Message text is React text, never HTML, and links in it aren't made clickable.
- Signing in, signing out and deleting an account end in a full page load: they post to Route Handlers (`/login/code`, `/login/profile`, `/login/sample`, `/logout`, `/account/privacy/delete`) that call `isSameOrigin` (`lib/auth/same-origin.ts`) before they read anything and answer `seeOther()` (a 303), so the browser keeps no signed-in page. `updateTag` can't run in a Route Handler: they use the `…ChangedNow()` helpers (`sellersChangedNow`, `hubChangedNow`, `requestsChangedNow`), which expire the tag with `revalidateTag(tag, { expire: 0 })`.
- The composer, a reply and the offer composer check `messageLimitErrors` (`lib/messaging/limits.ts`) after the fields and before the scam words: 40 new conversations in any 24 hours, offers left out, and 120 messages in any hour. The five sample accounts are exempt only in sample mode (`isSampleAccount`, `lib/auth/sample-accounts.ts`).
- Sign-in codes, session tokens and sign-in attempt tokens are hashed only through `lib/auth/secrets.ts` (HMAC-SHA-256 under `VOSSIE_AUTH_HMAC_KEY`, read on first use, never at module scope or during a build). Never `createHash` in `lib/auth` (a test checks).
- Listings and sellers come from the sample store through `lib/data/catalog.ts`; every cached reader is tagged (`lib/data/tags.ts`), and a selling write calls `listingsChanged()` or `sellersChanged()` before `done()` (`lib/selling/action-helpers.ts`). Fixtures stay the seed: `data/fixtures/shops.ts` turns them into rows.
- The listing form's `PhotoField` is the only selling client component, and only its two routes load it: links to `/sell/…` pages never prefetch, and `/sell` itself has no client component (the header prefetches it on every page). The selling pages' main column (`.sell-page`) is at least a screen tall less the header, so the footer stays below the first screen while a page streams in.
- End-to-end tests that publish, change or delete listings go in `tests/e2e/selling-writes.spec.ts`, which runs after every other test.
- Staff pages (`/admin`, `/hub/manage`, `/hub/new`, `/hub/[id]/edit`, `/mentor`) render a wordless `StaffSkeleton` in their static shell and everything else inside `<Suspense>` after `requireStaff(area, nextPath)` (`lib/staff/access.ts`): sign-in when signed out, the 404 for anyone without the role (shown from inside the page, so status 200 and `noindex`). Their tab title comes from `staffMetadata()`. No public page links to them, and links into them never prefetch.
- Every staff action is a Server Action in `lib/staff/*-actions.ts`: `requireStaff()` first, one `recordAudit()` only when something changed (the audit log has no update or delete), the notifications the spec names, the right tag expired, then `done()`. A form that makes something new (a Hub post, a note, a check-in) carries a one-time token (`lib/staff/once.ts`), so a second press makes nothing.
- No admin makes a Hub decision about their own shop, its listings or their own Looking For request. The gate is in the action, after `requireStaff()` and the id checks and before anything is read or written (`isOwnShop`, `isOwnListing`, `isOwnRequest` in `lib/data/staff-shops.ts`; `ownsTarget` in `lib/staff/own.ts`); a refusal writes, logs and settles nothing and leaves the `own-shop` or `own-request` notice. Removing the mentor role of whoever mentors the acting admin's own shop is refused in `removeRole` itself (`"own-shop-mentor"`, read with `ownShopMentorId`), before any write; `removeStaffRole` leaves the `own-shop-mentor` notice on `/admin/staff` (stage M). The views show one line in place of the controls, never a disabled one.
- Staff roles are given only by exact email (`giveRole` in `lib/data/staff-accounts.ts`), never through a search, a suggestion or a list of students. An admin never removes their own admin role, and `removeRole` refuses to remove the last admin. Nothing cached reads roles: `getViewer()` reads them on every request.
- The admin's numbers (`/admin/numbers`) show private counts (enquiries, reports, follows) only through `protectCounts` (`lib/staff/numbers.ts`): a private week's campuses all "Hidden" when any campus (or a gone one) has 1 to 4, totals exact or "Under 5", Since the start in tens and by campus only when both weeks are. They never name, link or id anything counted, and never count saved searches.
- Show again (`/admin/hidden`, `showListing` and `showRequest`) clears a hide through a confirm page, with one audit entry and its seller or asker told; the reports stay closed, and hiding it again needs a new report.
- The four short confirm pages (a role's removal, the admin's own-role refusal, and the two Show again pages) use `<StaffSkeleton short />`, a skeleton with no body block, so a short phone isn't shifted when they arrive (0.0892 to 0.0437 at 375x667).
- A shop's link can never be a word a fixed route uses beside `[slug]` (`RESERVED_SLUGS` in `lib/selling/rules.ts`: `/mentor/export` is the CSV); add the word there when a new fixed folder joins `app/sellers`, `app/admin/sellers` or `app/mentor` (a test reads the folders).
- End-to-end tests whose staff actions buyers can see go in `tests/e2e/staff-writes.spec.ts`, which runs after every other test, selling's included.
- End-to-end tests that post requests, offer, hide requests, follow shops or publish listings go in `tests/e2e/community-writes.spec.ts`, and their axe, layout-shift and size checks in `tests/e2e/community-checks.spec.ts`: both run last, in the `community-writes` project, after `staff-writes`.
- End-to-end tests that save searches and publish matching listings go in `tests/e2e/alerts-writes.spec.ts`, and their axe checks in `tests/e2e/alerts-checks.spec.ts`: the writes run last, in the `alerts-writes` project, after `community-writes`.
- End-to-end tests that give or take away staff roles, hide and show listings or requests again, or read the admin's numbers go in `tests/e2e/staff-accounts-writes.spec.ts`, with their checks in `staff-accounts-checks.spec.ts` and screenshots in `staff-accounts-screenshots.spec.ts` (only with `SCREENSHOTS=1`): all three run last, in the `staff-accounts-writes` project, after `alerts-writes`. Fresh accounts only: never change the sample staff's roles.
- End-to-end tests that write messages at volume (the message limits) go in `tests/e2e/hardening-writes.spec.ts`, which runs last, in the `hardening-writes` project, after `staff-accounts-writes`. Sign-in's and sign-out's full page loads are checked in `tests/e2e/sign-in-return.spec.ts` (device projects).
- Stage L's end-to-end tests (an admin's own shop, the closing dates, the sitemap) and stage M's (your own shop's mentor) go in `tests/e2e/housekeeping-writes.spec.ts`, whose tests run one at a time (`mode: "default"`: two give Sipho the Admin role) and which runs last, in the `housekeeping-writes` project, after `hardening-writes`. The sitemap lists only what's current (open requests, tips, events and office hours from today on) and is dynamic (`ƒ /sitemap.xml`: it reads `sastToday()` after `connection()`).
- The inline boot script registers `/sw.js` after load in production builds, while `WORKER_ON` is set. The worker (`lib/offline.ts`) keeps only the offline page in `vossie_offline` and answers only failed GET page loads. Change `WORKER_VERSION` whenever the worker's code changes (editing the offline page changes the worker by itself, through its hash). `WORKER_ON = false` is the kill switch: it stops the registration and serves a worker that removes itself, but it reaches a phone that already has the worker only through the browser's own update check, which can take up to about a day.
- End-to-end tests block service workers: `serviceWorkers: "block"` in `playwright.config.ts` reaches only the built-in `page` and `context`, so every `browser.newContext(` in `tests/e2e` says it too (`grep -rn "newContext(" tests/e2e | grep -v serviceWorkers` prints nothing). Only `tests/e2e/offline.spec.ts` allows the worker.
- Client code never imports `lib/boot-script.ts` or `lib/offline.ts`: the boot script imports the worker's source, and importing it from the footer's install button cost 527 B on every page (it tipped decision 63's chunk merge) and carried dead code. The install event's name lives in `lib/install-event.ts`, and a guard test (`lib/install-event.test.ts`) checks it. After `pnpm build`, `grep -l "serviceWorker.register" .next/static/chunks/*.js` must print nothing.
- No `Date.now()`, `new Date()` or `Math.random()` while prerendering.
- Client hooks that suspend while Next builds App Shells (`usePathname()`, `useParams()`) are read only inside `<Suspense>` in shared layout code (see `components/ui/NavLink.tsx`).
- Dynamic routes:
  - `generateStaticParams` returns at least one value.
  - `params` is awaited inside `<Suspense>`, whose fallback is `<PageFallback />` (a screen tall), never `null`. On any page after the first, the browser paints before React shows the content (at least 300 ms after first paint once a page passes 12.8 KB), so an empty fallback lets the footer jump into view on a slow network. A skeleton must not be taller than the page's shortest state either.
  - Unknown values call `notFound()`.
  - Never export `dynamicParams`; it fails the build with Cache Components.
- The React Compiler lint rules are on: no `setState` directly in an effect body, no `ref.current` during render.
- Breakpoints:
  - The phone-to-tablet switch is the custom `wide:` variant: Tailwind's `md` width (48rem) plus a 30rem minimum height, so landscape phones keep the phone layout (spec section 5).
  - Write `wide:` in class names and `@media (min-width: 48rem) and (min-height: 30rem)` in CSS, never `md:`.
  - The desktop step is the custom `desk:` variant (64rem, same height guard). Use it instead of `lg:`: Tailwind emits its built-in `lg:` rules before custom variants, so a `wide:` value would beat an `lg:` value on desktop. In component CSS, write the desktop step as `@media (min-width: 64rem) and (min-height: 30rem)`.
- Motion: animate only `transform` and `opacity` (the CSS `translate`, `scale` and `rotate` properties count as transform). Respect `prefers-reduced-motion` and data saver (`html[data-low-data]`).
- Touch targets are at least 44px. No hover-only features.
- The site's address comes only from `siteUrl()` (`lib/site-url.ts`), which reads `NEXT_PUBLIC_SITE_URL`. `metadataBase`, `robots.txt` and the sitemap use it. Never write a domain in code.
- Links that would prefetch a route with client components cost that route's chunk on every page they appear on. Use `prefetch={false}` unless there's a reason (decision 53). The header's home link prefetches `/`, so client code used only on the homepage costs bytes on every page.
- Prefer `signInHref(next)` or a session-following link (a `<Suspense>` whose fallback is the sign-in link and whose server child streams in the real one) for signed-out visitors: it saves a bounce. A direct link is no longer a trap: sign-in ends with a full page load (stage K).

## Privacy (POPIA)
- Collect the minimum. Sample mode keeps accounts, sessions, consent, sign-ins, messages, reports, notifications, shops, listings, photos, RSVPs, slot requests, Hub posts, mentors' notes, the staff log, Looking For requests, follows and saved searches in the server's memory only, wiped on restart; the campus choice and saved listings are first-party cookies, and recent searches stay in the browser.
- Looking For requests never name the asker: they say "Asked by a student at {campus}". Sellers are businesses and show their names (community spec decision 2).
- A shop sees only how many follow it, never who. Deleting an account removes its requests, its follows and its shop's followers.
- Saved searches are seen only by their owner and used only for their alerts. They are in the data download by name, and deleting one removes its notifications; deleting an account removes them all.
- The footer sign-up shows a confirmation only. It sends and stores nothing until there is a real, consented mailing list.
- Every cookie and browser-storage key is named `vossie_…`, and the privacy page must name each one: a test (`app/privacy/page.test.tsx`) finds them in the code and fails until it does.
- Mentors' notes are about a shop's owner, seen by mentors and admins only, never by the seller (an admin who sells included: `mentoredShops` leaves out the viewer's own shop), and not in the data download; deleting an account deletes notes about it and strips it from the audit log, which keeps its entries.
- Photos of people need their consent.
- Photos lose their hidden data (location included) before they're stored: the browser re-encodes them, and the server strips them anyway (`lib/photos/strip-metadata.ts`).

## Time
- SAST (UTC+2, no daylight saving). Store UTC, render in `Africa/Johannesburg`. Never rely on the server's timezone.

## Safety rules (from `~/.claude/CLAUDE.md`, highest priority)
- Verify before acting (`ls`, `git status`), as a separate tool call from the action.
- No `git init`, commits or pushes without Lama's go-ahead. Destructive git commands need confirmation every time. Never touch `.git/` internals. One git command at a time.
- `rm` only what Lama named. Never kill installs or builds mid-flight.
