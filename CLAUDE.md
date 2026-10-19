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
- Who's signed in comes only from `getViewer()` or `requireAccount()` (`lib/auth/session.ts`), inside `<Suspense>`. Forms are plain `<form action={serverAction}>`: the action checks its input, takes identity from the session, keeps errors in the store (never the URL) and ends with `redirect()`. Only `lib/data` touches the sample store.
- Messaging's Server Actions end every write with `done()` (`refresh()`, then a `replace` redirect; `lib/messaging/actions.ts`), so the browser drops its kept pages. Message text is React text, never HTML, and links in it aren't made clickable.
- Listings and sellers come from the sample store through `lib/data/catalog.ts`; every cached reader is tagged (`lib/data/tags.ts`), and a selling write calls `listingsChanged()` or `sellersChanged()` before `done()` (`lib/selling/action-helpers.ts`). Fixtures stay the seed: `data/fixtures/shops.ts` turns them into rows.
- The listing form's `PhotoField` is the only selling client component, and only its two routes load it: links to `/sell/…` pages never prefetch, and `/sell` itself has no client component (the header prefetches it on every page). The selling pages' main column (`.sell-page`) is at least a screen tall less the header, so the footer stays below the first screen while a page streams in.
- End-to-end tests that publish, change or delete listings go in `tests/e2e/selling-writes.spec.ts`, which runs after every other test.
- Staff pages (`/admin`, `/hub/manage`, `/hub/new`, `/hub/[id]/edit`, `/mentor`) render a wordless `StaffSkeleton` in their static shell and everything else inside `<Suspense>` after `requireStaff(area, nextPath)` (`lib/staff/access.ts`): sign-in when signed out, the 404 for anyone without the role (shown from inside the page, so status 200 and `noindex`). Their tab title comes from `staffMetadata()`. No public page links to them, and links into them never prefetch.
- Every staff action is a Server Action in `lib/staff/*-actions.ts`: `requireStaff()` first, one `recordAudit()` only when something changed (the audit log has no update or delete), the notifications the spec names, the right tag expired, then `done()`. A form that makes something new (a Hub post, a note, a check-in) carries a one-time token (`lib/staff/once.ts`), so a second press makes nothing.
- A shop's link can never be a word a fixed route uses beside `[slug]` (`RESERVED_SLUGS` in `lib/selling/rules.ts`: `/mentor/export` is the CSV); add the word there when a new fixed folder joins `app/sellers`, `app/admin/sellers` or `app/mentor` (a test reads the folders).
- End-to-end tests whose staff actions buyers can see go in `tests/e2e/staff-writes.spec.ts`, which runs after every other test, selling's included.
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
- Never link a signed-out visitor straight at a page that needs sign-in. A client navigation keeps that page's redirect to sign-in and replays it after signing in, so the visitor is stranded. Link to `signInHref(next)`, or use a session-following link (a `<Suspense>` whose fallback is the sign-in link and whose server child streams in the real one), as Message, Offer to help and Post a request do (community actions plan amendment 18).

## Privacy (POPIA)
- Collect the minimum. Sample mode keeps accounts, sessions, consent, sign-ins, messages, reports, notifications, shops, listings, photos, RSVPs, slot requests, Hub posts, mentors' notes and the staff log in the server's memory only, wiped on restart; the campus choice and saved listings are first-party cookies, and recent searches stay in the browser.
- Looking For requests never name the asker: they say "Asked by a student at {campus}". Sellers are businesses and show their names (community spec decision 2).
- The footer sign-up shows a confirmation only. It sends and stores nothing until there is a real, consented mailing list.
- Every cookie and browser-storage key is named `vossie_…`, and the privacy page must name each one: a test (`app/privacy/page.test.tsx`) finds them in the code and fails until it does.
- Mentors' notes are about a shop's owner, seen by mentors and admins only, never by the seller, and not in the data download; deleting an account deletes notes about it and strips it from the audit log, which keeps its entries.
- Photos of people need their consent.
- Photos lose their hidden data (location included) before they're stored: the browser re-encodes them, and the server strips them anyway (`lib/photos/strip-metadata.ts`).

## Time
- SAST (UTC+2, no daylight saving). Store UTC, render in `Africa/Johannesburg`. Never rely on the server's timezone.

## Safety rules (from `~/.claude/CLAUDE.md`, highest priority)
- Verify before acting (`ls`, `git status`), as a separate tool call from the action.
- No `git init`, commits or pushes without Lama's go-ahead. Destructive git commands need confirmation every time. Never touch `.git/` internals. One git command at a time.
- `rm` only what Lama named. Never kill installs or builds mid-flight.
