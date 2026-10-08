# Vossie Market Place - Live Inventory

Audit of https://vossie-market-place.vercel.app/ on 2026-10-02 (SAST), re-run on 2026-10-05 after the deployment was made public. The logged-in pass used Claude in Chrome.
Prepared for redesign planning. Plain inventory of what exists today, with evidence.

---

## Audit method and limits (read first)

- **Public access.** On 2026-10-02 the site was behind Vercel Deployment Protection (every path redirected to Vercel's login). On 2026-10-05 it is public: `/` returns 200 to an anonymous request.
- **Logged-in pass (Chrome).** The Chrome profile was already signed in to the app as a demo staff account: role **Mentor**, seller status "Not a seller yet". The account email is in screenshot 02 and is not repeated here. All logged-in observations come from that session. I did not sign out, because that would have ended a session I could not restore. On 2026-10-05 I re-checked it for changes.
- **Logged-out pass (2026-10-05).** Two methods, both outside your Chrome session so it stayed untouched:
  - Plain HTTP requests from the terminal for every route: status, redirect target, title, H1, visible text and form fields.
  - The Claude desktop app's built-in browser (isolated, no cookies) for rendering, interactions, console and network, at 1440x900 and a true 390x844 mobile emulation with touch.
- **No test account created.** I'm not able to create accounts on non-local sites, and that limit holds even with your permission. Sign-in is an email one-time code, and requesting a code would create a Supabase user. So I typed a fake address to check field validation but never submitted the form.
- **Demo one-click logins were not used.** The public sign-in page offers them for six accounts, including Admin. Using one would mean signing in as someone else, so I didn't. That's why the seller dashboard and admin console are still unobserved.
- **Audit side effect.** The app counts one listing view per visitor per day, so this audit's visits slightly inflated demo listing view counts.
- **Nothing was submitted.** No message sent, report filed, RSVP changed, post published, seller wizard step saved, CSV downloaded or WhatsApp link followed. The seller wizard autosaves each step, so I stopped at step 1. Pressing Next with empty fields only triggered validation.
- **Preference toggles.** Dark mode and Data saver were switched on, inspected, and switched back to light / off. If the theme preference was "system" before, it is now stored as "light" (`vossie_theme` cookie).
- **Viewports.**
  - Logged in: "Desktop" means a 1440x900 Chrome window, which gives a 1384x797 viewport. Chrome would not shrink below a 570px viewport, so the logged-in 390x844 view was rendered in a temporary same-origin iframe inside the tab. Media queries respond correctly; touch was not emulated. The iframe was removed afterwards.
  - Logged out: the built-in browser emulated 390x844 directly, with touch.
- **Screenshots.** 48 screenshots are in `./screens/`. File names are referenced in brackets, for example [05]. Files 44-48 are from 2026-10-05.

---

## Summary

- **Public since 2026-10-05, with demo logins exposed.** The public sign-in page shows a "Demo accounts" panel ("For rehearsals only. Not available in production.") with one-click entries for 4 student/seller accounts plus **Admin** and **Mentor** staff accounts. It's driven by a server flag and a `demoLogin` server action, so anyone may be able to sign in as Admin. Not tested, but treat it as the top launch blocker.
- **Enquiry-based classifieds, not a cart marketplace.** Buyers contact sellers via in-app messaging or a tracked WhatsApp handoff, then pay cash or swap at campus pickup points. There is no cart, checkout, order or payment code anywhere (`/cart`, `/checkout`, `/orders` all 404; no payment scripts).
- **Buyer discovery works well.** Home has campus scoping, featured rotation, a New this week carousel and 10 categories. Browse has typo-tolerant search, 5 filters, 3 sorts, removable filter chips and Load more. Listing and seller pages are complete.
- **Trust uses computed badges, not star ratings.** Badges are New seller, Responsive, Trusted and Top Hustler, plus a Hub-granted Verified badge. Reporting (7 reasons), seller guidelines, safety copy and POPIA self-service (data export, account deletion) all exist. Sign-in is a passwordless email code. Copy limits it to student-number `@vossie.net` and staff `@eduvos.com` addresses, but the field accepts any domain client-side (server enforcement unverified).
- **The seller side is mostly unobservable with this account.** A 5-step onboarding wizard with good validation exists. Seller dashboard, listing creation and enquiry management all redirect non-sellers to onboarding.
- **Strong Mentor/Hub tooling.** A mentor dashboard shows per-seller KPIs and "needs support" flags, with private notes, check-ins and CSV export. The Hub Growth corner has tips, events with RSVP, office-hours booking, and post create/manage.
- **Admin console exists but is unseen.** Logged out, `/admin` redirects to sign-in (it's a real protected route); for the Mentor role it returns 404, so it's admin-only. Copy refers to Hub approval, verification, staff pinning and an admin audit log.
- **Seeded content, now decaying.** There are 9 demo sellers and 29 live listings. Every listing image and avatar is a generated typographic gradient card, not a photo. One seller with no image renders blank grey boxes. Between 2 and 5 October the nightly badge job dropped Amahle Events & Decor from Trusted to New seller.
- **Stubs and test leakage are visible to users.** "Looking For" is a stub ("Coming in Phase 6") but sits in the main nav and is the empty-state call to action. Notifications show `[automated test]` items and duplicates. Copy bugs include "Yesterday ago" and "01 Oct ago", and the privacy policy is labelled "Draft for the Hack Jam".
- **Coherent design system with sound accessibility basics.** Navy/sand/royal on Tailwind v4 tokens, Playfair Display + Inter, dark mode, Data saver mode, PWA. Mobile layout holds at 390px with a bottom tab bar. Main gaps: no "Sign in" entry point for logged-out visitors, no active nav state, listing call-to-action below the fold, weak focus ring on navy, no Open Graph tags.

---

## Stack inferred (with evidence)

| Layer | Inference | Evidence |
|---|---|---|
| Framework | Next.js App Router, production build via Turbopack (Next 15.5+ / 16) | `/_next/static/immutable/chunks/turbopack-*.js`; RSC prefetches `?_rsc=`; `next-size-adjust` meta; next/font class `playfair_display_<hash>-module` on `<html>`; next/image optimizer `/_next/image?url=…&w=750&q=75`; `X-Powered-By` header present |
| UI library | React (JSX runtime), client components with `useState` / `useTransition` | Inspected onboarding chunk: `(0,a.jsx)`, `useTransition` (suggests server actions for mutations) |
| Styling | Tailwind CSS v4 compiled with Lightning CSS | `@theme` block on `:root, :host`; `--spacing: .25rem`; hex palette vars (`--color-red-50` etc.); `--lightningcss-light/dark` vars |
| Backend / DB | Supabase (Postgres + PostgREST + Auth + Storage), project ref `vxqgcaznbwhwgvauupby` | `https://vxqgcaznbwhwgvauupby.supabase.co/auth/v1/user`; `rest/v1/profiles?select=onboarding_seen&id=eq.<uuid>` called from the browser; public buckets `storage/v1/object/public/avatars/<user>/profile.webp` and `listing-images/<user>/<listing>/1.webp` |
| Auth storage | Cookie-based Supabase session (the @supabase/ssr pattern) | `localStorage` is empty; Supabase auth cookies present (names and values not inspected) |
| Auth method | Supabase Auth passwordless email one-time code (`signInWithOtp`); two-step UI (email + POPIA consent, then "Sign-in code" with `autocomplete="one-time-code"` and "Use a different email") | `/login` HTML and login JS chunk; Supabase JS default creates the user on first OTP request |
| Demo login | `demoLogin` server action behind a server-supplied `demoEnabled` flag, currently true in production | Login chunk: `callServer … "demoLogin"`; the panel renders on the public `/login` |
| Route protection | Middleware/server redirects to `/login?next=<path>` (307) for account, seller, mentor, admin and WhatsApp-handoff routes. `/sell/listings` and `/sell/listings/new` instead stream a 200 page with an in-body `NEXT_REDIRECT` and a 1-second meta refresh | Plain HTTP crawl, 2026-10-05 |
| DB region | Ireland (EU) | Privacy policy: "Supabase … hosted in Ireland, EU", citing POPIA s72 for cross-border transfer |
| Hosting | Vercel; edge PoP Cape Town (`cpt1`), serverless functions in Dublin (`dub1`) | `x-vercel-id` region chain `cpt1 > dub1`; `x-vercel-cache: MISS` on SSR pages |
| Access control | Vercel Deployment Protection was on until at least 2026-10-02; off by 2026-10-05 | On 2026-10-02 plain HTTP to any path returned 302 to `vercel.com/sso-api?url=…`; on 2026-10-05 `/` returns 200 |
| Search | Typo-tolerant ranking, probably Postgres full-text + trigram | `q=brads` returns the braids listings; a "Best match" sort appears only when a query is present |
| Scheduled jobs | Nightly featured-slot fill at 02:05 SAST; nightly badge recalculation | Copy on `/how-featured-works` and `/how-trust-works` (scheduler not visible: Vercel Cron or pg_cron) |
| Redirect / tracking routes | `/go/whatsapp/<seller-slug>?listing=<id>` (WhatsApp handoff, keeps the number out of the HTML); `/mentor/export` (CSV) | Link hrefs on listing and mentor pages |
| API routes | None called during the crawl | 0 requests matching `/api/`; the service worker explicitly bypasses `/api/`, so some exist |
| PWA | Web manifest + service worker + offline page | `manifest.webmanifest` (name "Vossie Market Place", short_name "Vossie", `display: standalone`, icons 192, 512, 512 maskable); `/sw.js` cache `vossie-shell-v1` precaching `/`, `/offline`, icon, logo, network-first navigation; `/offline` returns 200 |
| Payments | None | No Paystack, Yoco, PayFast, Stripe or Ozow scripts or requests |
| Analytics | None | No GA, Vercel Analytics, PostHog or Plausible requests. Privacy policy: "no advertising trackers"; listing views counted with an anonymous per-visitor daily cookie |
| Fonts | Self-hosted via next/font: Playfair Display (display), Inter (body) | Two woff2 files under `/_next/static/immutable/media/`; no Google Fonts CDN calls |
| Images | Supabase Storage (WebP) served through the Next image optimizer | See above. Data saver halves the images on home (20 to 10) |
| Icons | Hand-authored inline SVG (24x24 viewBox, single path, `aria-hidden="true"`); no icon library signature; emoji used as icons in places | DOM inspection: 32 SVGs on home, none with lucide/heroicons classes; emoji on category tiles, `/sell` bullets and the Data saver pill |
| Preference cookies | `vossie_theme`, `vossie_lowdata` | `document.cookie` names (auth cookies excluded) |
| Security headers | HSTS present. CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy and X-Content-Type-Options absent | Response headers on `/browse`; the app can be framed (confirmed by the 390px iframe test) |

---

## Route Map

"Logged out" is verified (2026-10-05 plain HTTP crawl plus the built-in browser). "Role needed" is what the signed-in Mentor session showed. Times are server response times from South Africa, uncached.

| Path | Logged out | Role needed | Purpose | Status |
|---|---|---|---|---|
| `/` | 200 (1.4s) | Public | Home: hero, search, campus chips, Featured Hustles, New this week, categories, Looking For band | WORKING |
| `/?campus=durban` / `midrand` | 200 | Public | Campus-scoped home: featured and new listings filtered to campus | WORKING |
| `/browse` | 200 (1.2s) | Public | Search + filters (`q, sort, category, campus, kind, mode, min, max, avail, n`) | WORKING |
| `/l/[uuid]` | 200 (1.3s) | Public (actions need sign-in) | Listing detail. Logged out: Save and Message redirect to `/login?next=…` (Message adds `?compose=1` to reopen the composer) | WORKING |
| `/s/[slug]` | 200 (1.0s) | Public (Follow / Message need sign-in) | Seller public profile | WORKING |
| `/go/whatsapp/[slug]?listing=` | 307 to `/login` | Signed in | Server redirect to WhatsApp with tracking; the seller's number is never exposed to anonymous visitors | WORKING (gate verified; not followed when signed in) |
| `/login` | 200 | Public | Email one-time-code sign-in + **Demo accounts panel** (see Safety) | WORKING (form not submitted) |
| `/messages` | 307 to `/login?next=` | Signed in | Inbox ("Your enquiries with buyers and sellers") | PARTIAL: only the empty state seen; thread view not observed |
| `/saved` | 307 to `/login?next=` | Signed in | Saved listings / followed sellers (two tabs) | WORKING |
| `/looking-for` | 200 | Public | "Post what you need…" | STUB ("Coming in Phase 6.") |
| `/account` | 307 to `/login?next=` | Signed in | Email, role, seller status, links, Sign out | WORKING |
| `/settings/privacy` | 307 to `/login?next=` | Signed in | Consent record, Download my data (JSON), Reports I've made, Delete my account (type DELETE) | WORKING (actions not exercised) |
| `/sell` | 307 to `/login?next=` | Signed in | Seller landing for non-sellers (page title says "Seller dashboard") | WORKING for non-seller; dashboard not seen |
| `/sell/onboarding` | 307 to `/login?next=` | Signed in | 5-step seller wizard | PARTIAL: step 1 observed, steps 2-5 inferred from bundle |
| `/sell/listings` ("My listings"), `/sell/listings/new` ("New listing") | 200 with streamed redirect + 1s meta refresh to `/login` | Seller | Listing management / create listing | Not observable (non-sellers redirected to onboarding) |
| `/sell/enquiries` ("Enquiries") | 307 to `/login?next=` | Seller | Enquiry management | Not observable (redirects non-sellers to `/sell`) |
| `/mentor` | 307 to `/login?next=` | Mentor | Assigned-seller dashboard | WORKING |
| `/mentor/[uuid]` | 307 to `/login?next=` | Mentor | Seller KPIs, recent listings, private notes, check-ins | WORKING |
| `/mentor/export` | 307 to `/login?next=` | Mentor | CSV export | Present, not downloaded |
| `/admin` | **307 to `/login?next=`** | Admin (404 for Mentor) | Admin console: exists, contents unseen | NOT OBSERVED |
| `/growth` | 200 | Public (Manage / New post hidden logged out) | Hub Growth corner: tips, events, office hours; type and campus filters | WORKING |
| `/growth/[uuid]` | 200 | Public (RSVP shows "Sign in to RSVP") | Post detail; event RSVP, office-hours booking, Edit post for owner | WORKING |
| `/growth/new` | 307 to `/login?next=` | Mentor | Create Hub post | WORKING (not submitted) |
| `/growth/manage` | 307 to `/login?next=` | Mentor | Office-hours request queue + my posts | WORKING |
| `/how-featured-works` | 200 | Public | Featured rotation rules (7 sections) | WORKING (static) |
| `/how-trust-works` | 200 | Public | Badge rules, response rate, confirmed sales, reply times | WORKING (static) |
| `/seller-guidelines` | 200 | Public | 7 seller rules | WORKING (static) |
| `/privacy` | 200 | Public | POPIA privacy policy, marked "Draft for the Hack Jam" | WORKING (draft content) |
| `/offline` | 200 | Public | PWA offline fallback ("You're offline") | Present |
| `/signup`, `/register`, `/sign-in`, `/auth/login`, `/auth/callback`, `/onboarding`, `/welcome` | 404 | n/a | Sign-up and sign-in are one page (`/login`) | 404 |
| `/sellers`, `/products`, `/services`, `/categories`, `/search`, `/listings`, `/seller` | 404 | n/a | Discovery lives under `/browse`, `/s/`, `/l/` | 404 |
| `/cart`, `/checkout`, `/orders` | 404 | n/a | No commerce flow by design | 404 |
| `/dashboard`, `/seller/dashboard`, `/profile` | 404 | n/a | Equivalents: `/sell`, `/account` | 404 |
| `/admin/sellers`, `/admin/reports`, `/hub`, `/staff`, `/moderation`, `/approvals`, `/reports`, `/verify` | not all re-checked | n/a | Guesses at admin sub-pages | 404 for the Mentor role |
| `/about`, `/contact`, `/terms`, `/notifications` | 404 | n/a | No about, contact or terms pages | 404 |
| `/robots.txt`, `/sitemap.xml` | 404 | n/a | Missing crawler files (now that the site is public) | 404 |

The 404 page is branded ("We couldn't find that page", Back to home) [29], but its `<title>` is just "Vossie Market Place".

---

## Features by role

Status key: WORKING (seen working), PARTIAL (partly seen or partly built), PRESENT (control exists, deliberately not exercised), MOCKED (seeded or placeholder content), STUB (placeholder page), NOT OBSERVED (exists per code or copy but not visible to this role), ABSENT (no trace).

### Buyer

| Feature | Status | Notes |
|---|---|---|
| Anonymous browsing (home, browse, listing, seller, Hub Growth, info pages) | WORKING | Verified logged out; no Supabase calls from the browser when signed out |
| Sign up / sign in (one flow) | WORKING (not submitted) | `/login`: "Eduvos email" field (hint "Student number @vossie.net, or your @eduvos.com staff email"), required POPIA consent checkbox, "Email me a sign-in code" (disabled until consent, with no explanation), then a code-entry step. No password, no social login. Field accepts any domain client-side [44] [47] |
| Sign-in entry point when logged out | ABSENT | Header shows the same items as signed in, minus the bell; "Account", "Messages" and "Saved" silently redirect to `/login`. There's no "Sign in" button and no notice on the login page explaining why the visitor was redirected |
| Return-to-intent after sign-in | WORKING | `?next=` preserved; Message adds `compose=1` so the composer reopens |
| Home sections (hero search, Featured Hustles 2x4 grid, New this week carousel, 10 category tiles, Looking For band) | WORKING | [01] [03] [04] [48] |
| Campus scoping (All / Durban / Midrand) on home and browse | WORKING | `?campus=` link chips with `aria-current` on the active chip |
| Search | WORKING | Typo-tolerant; "Results for '…'" heading; Best match sort; designed empty state [06] [07] |
| Filters: Category (10), Campus (2), Type (Products / Services / both), Payment (cash / swaps / both), Price min-max (rand), Available only | WORKING | GET form; needs "Show results" (no auto-apply); removable chips [08] |
| Sort: Newest, Price low-high, high-low | WORKING | Link chips |
| Pagination | WORKING | "Load more" link (`?n=2`), 24 then 29 of 29, scroll position kept |
| Listing detail: price ("R120", "From R450", "From R800 or swap"), type, category, campus, pickup point or delivery mode, description, hashtag links, swap callout, seller card, More from seller | WORKING | Single image only, no gallery [09] [14] |
| Save listing (heart) | PRESENT | Not clicked (would write data) |
| Follow seller | PRESENT | Demo account follows 1 seller (shows on Saved > Sellers) |
| Message seller in-app | PRESENT | Modal: prefilled "Hi! Is <title> still available?", 1000-char counter, safety tip, Send message [10] |
| Chat on WhatsApp | PRESENT | Only when the seller set a number (absent for Aisha's Bakes). Requires sign-in (`/go/whatsapp/…` returns 307 to `/login` when logged out) |
| Message / Save / Follow when logged out | WORKING (no feedback) | Redirects to sign-in after about 1s for Save. On one Message attempt nothing visible happened for over 5s; there's no pending or loading state on these buttons |
| Share listing | PRESENT | Not tested (may open the OS share sheet) |
| Report listing / profile | PRESENT | 7 radio reasons + optional 500-char detail [11] |
| Messages inbox | PARTIAL | Empty state only for this account [15]; thread UI, photo messages and "confirm sale" prompt not observed |
| Notifications (bell dropdown, unread count, Mark all read) | WORKING | 8 unread, including `[automated test]` and duplicate entries [18] |
| Looking For (post a request) | STUB | In top nav and in the browse empty state, but the page says "Coming in Phase 6." [17] |
| Hub Growth: event RSVP, office-hours booking | WORKING | "You're going (tap to cancel)", "2 going of 80 places" [25] |
| Privacy self-service | PRESENT | JSON export, delete account, consent record [28] |
| Dark mode, Data saver | WORKING | [30] [31] |
| Cart / checkout / payments / order history | ABSENT | By design: cash or swap at pickup |
| Star ratings / written reviews | ABSENT | By design: badges instead |

### Seller

| Feature | Status | Notes |
|---|---|---|
| Sell landing (4 benefits + Become a seller) | WORKING | Emoji bullets [19] |
| Onboarding wizard: 1 Business basics (Business name max 60, Category, Tagline max 80), 2 About you (About your hustle), 3 How buyers reach you (WhatsApp number), 4 Campus and pickup points, 5 Review and submit (agree to seller guidelines) | PARTIAL | Step 1 seen; steps 2-5 from the JS bundle. Autosaves each step. Inline errors with `aria-invalid` and `aria-describedby` ("Enter your business name (at least 2 characters)", "Choose a category") [20] [21]. A Back button shows on step 1 |
| Profile photo upload | NOT OBSERVED | Privacy policy lists "profile photo"; no upload field in the labels found |
| Profile edit (incl. profile link / slug changeable once) | NOT OBSERVED | `SellerEditForm` in bundle |
| Seller approval by Incubation Hub | NOT OBSERVED | Per `/how-featured-works` copy. Possible gate bug to verify: the demo panel labels one account "Aisha (seller waiting for approval)", yet "Aisha's Bakes" is publicly listed, appears in Featured Hustles and has a live listing. If they're the same account, unapproved sellers are visible and featurable |
| Seller dashboard, listing CRUD, listing images, availability (paused / sold out / hidden) | NOT OBSERVED | Routes exist; redirect non-sellers |
| Enquiry management, mark completed, sale or swap happened | NOT OBSERVED | Described on `/how-trust-works` |
| Public profile: avatar, tagline, Verified badge, category, campus, member since, trust badge, reply time, Follow, Message, WhatsApp, Report, About, Listings | WORKING | [12] [13] [40] |
| Computed trust badges (New seller / Responsive / Trusted / Top Hustler) | WORKING (display) | Rules on `/how-trust-works` [27] |
| Featured rotation (4 slots per campus per day, no repeats within 7 days, quieter shops boosted, staff can pin) | WORKING (display) | Rules on `/how-featured-works` |
| Seller-facing analytics | NOT OBSERVED | Mentors see views, enquiries and WhatsApp handoffs per seller |

### Admin / Mentor (staff)

| Feature | Status | Notes |
|---|---|---|
| Mentor view: 9 assigned sellers with Enquiries (30d) + WhatsApp, Response rate, Confirmed sales, Listing views (30d), last active, badge, "may need support" flags | WORKING | "1 of 9 sellers may need support" [22] [41] |
| Mentor seller detail: 7 KPI tiles, support alert, recent listings with status, Private notes (mentor + admins), Check-ins log | WORKING | Forms not submitted [23] |
| Export CSV | PRESENT | Not downloaded |
| Hub Growth: New post (Type: Tip or article / Incubation Hub event / Mentor office hours; Title (required); Body with markdown subset, 4000 chars; Campus; Cover image upload; Published checkbox) | WORKING | Raw markdown hint shown to users [26] |
| Hub Growth manage: office-hours request queue, my posts | WORKING | Shows "Office-hours requests (0)" while the bell shows 8 office-hours request notifications |
| Admin console: seller approval, verification grants, report moderation, featured pinning, audit log | NOT OBSERVED | `/admin` exists (307 to sign-in when logged out, 404 for Mentor). The public sign-in page offers a one-click "Admin (staff)" demo login, which I did not use |
| Demo account switcher on production sign-in | PRESENT (critical risk) | Six one-click accounts: two sellers (Thandi's Kitchen, Lwazi Cuts), a new student, "Aisha (seller waiting for approval)", Admin, Mentor. Labelled "Not available in production" but rendered in production |

---

## Key flows walked

### 0. Logged-out visitor to sign-in (2026-10-05)

1. Anonymous visitor on `/`: same header as signed in, minus the bell; no "Sign in" or "Join" button anywhere above the fold.
2. Taps Messages, Saved or Account: 307 to `/login?next=<path>`. The login page has no message such as "Sign in to see your messages".
3. On a listing, taps Save: redirected to `/login?next=/l/<id>` after about 1s. Taps Message on Vossie: redirected to `/login?next=/l/<id>?compose=1` (good: the composer reopens after sign-in), but the button shows no loading state. Taps Chat on WhatsApp: the handoff route requires sign-in.
4. `/login`:
   - Step 1: "Eduvos email" (placeholder `20250123@vossie.net`), a required POPIA consent checkbox, and "Email me a sign-in code", which stays disabled until consent is ticked.
   - Typing a fake `example.com` address shows no inline error; any domain check must happen server-side.
   - **Stopped here.** Requesting a code would create a Supabase user.
   - Step 2 (from the bundle): "We sent a code to …", a "Sign-in code" field, and "Use a different email".
5. Below the form, the **Demo accounts** panel offers one-click sign-in as six accounts, including Admin. Not used.
6. Sign-up and sign-in are the same flow; there's no separate registration page. The browser checks `profiles.onboarding_seen` on every signed-in page load, which suggests a first-run onboarding screen after first sign-in (not observed).

### 1. Browse, listing detail, enquire (buyer)

1. Home, then "See all" or the Browse nav item: `/browse` lists "Showing 24 of 29 listings".
2. Search "braids": 2 results (Braids for laptop repair, Knotless braids (medium)). Seller-name matches are not returned; "Cornrows" by Zanele's Braids is missing.
3. Open listing "Party props box" (`/l/b37038be-…`): R120, Product, Events, Eduvos Durban, Pickup point "Library entrance".
4. "Message on Vossie" opens the composer modal with prefilled text. **Stopped here, not sent.**
5. "Chat on WhatsApp" points to `/go/whatsapp/amahle-events-and-decor?listing=…`. **Not followed.**
6. Where it ends: there is no "Add to cart" or "Buy". The transaction happens offline (cash or swap at a campus pickup point). From copy, the seller later marks the enquiry completed and the buyer confirms. The buyer has no page listing their enquiries or their status outside Messages.

### 2. Checkout up to payment

Not applicable. `/cart`, `/checkout` and `/orders` all return 404, no payment provider script loads, and there is no payment step in the product.

### 3. Seller registration and creating a listing

1. Account, then "Start selling": `/sell` (benefits list, "Become a seller").
2. `/sell/onboarding` shows "Step 1 of 5: Basics" with a 5-segment progress bar.
3. Pressed Next with fields empty: inline validation, red borders, error text, focus management. Validation is good.
4. **Stopped here.** "Your progress is saved automatically each step", so filling step 1 would create a seller profile on the shared demo account.
5. `/sell/listings/new` and `/sell/listings` redirect a non-seller to `/sell/onboarding`, so the listing-creation form could not be seen. No test listing was created, so there was nothing to delete.

### 4. Search and filters

1. `q=xqzzv`: "No results" plus a "No matches" card with Clear filters and "Post a Looking For request". That second button leads to a stub page.
2. `q=brads`: still returns braids listings (typo tolerance).
3. Category Tutoring + Campus Midrand, then Show results: 4 listings (all Naledi Notes), active chips "Tutoring x" and "Eduvos Midrand x".
4. URL carries empty params and a duplicated `avail=1&avail=0` (hidden input plus checkbox), which is cosmetic.
5. Load more: 29 of 29.

### 5. Contact seller / messaging

- In-app composer modal works up to Send (not sent).
- The inbox for this account is empty, so thread layout, read states, photo sending and the buyer confirm-sale prompt were not observable.
- Mentor copy states mentors cannot read message content.

### 6. Safety and reporting

- The Report listing modal opens with 7 reasons; not submitted.
- The profile page has Report this profile.
- `/settings/privacy` lists "Reports I've made: You haven't reported anything."

### 7. Mentor / Hub

- Mentor list, then seller detail with notes and check-in forms (not submitted).
- Growth list, then the event (already RSVP'd) and office hours (booking textarea + Request a slot, not submitted).
- New post form and Manage were viewed.

---

## Design system observed

### Colour tokens (Tailwind v4 `@theme`, plus app variables)

| Token | Light | Dark (`:root[data-theme="dark"]`) | Use |
|---|---|---|---|
| `--color-navy` | `#16305e` | unchanged | Hero bands, primary dark buttons, headings, footer |
| `--color-royal` | `#2352c4` | unchanged | Links, focus ring, wordmark "Market Place", Responsive badge, notification count |
| `--color-sand` | `#cfae7e` | unchanged | Primary CTAs (Search, Start selling), active chips, Featured tag, card borders, Verified pill |
| `--color-mist` | `#f3f4f7` | `#1a2742` | Panels, category tiles, empty states, image placeholder |
| `--color-ink` | `#1b2233` | `#e8eef9` | Body text |
| `--color-muted` | `#4a5468` | `#a8b4cc` | Secondary text |
| `--background` / `--foreground` | `#fff` / `#1b2233` | `#0b1322` / `#e8eef9` | Page |
| `theme-color` meta | `#16305e` | `#0b1322` | Browser chrome |

Radius scale: sm .25rem, md .375rem, lg .5rem, xl .75rem, 2xl 1rem. Spacing base `--spacing: .25rem` (Tailwind default). Containers use Tailwind defaults (`--container-md` to `6xl`).

**Contrast (WCAG):**

- Navy on sand: 6.18:1
- Sand on navy: 6.18:1
- White on navy: 12.97:1
- Ink on white: 15.87:1
- Muted on white: 7.61:1
- Muted on mist: 6.92:1
- Royal on white: 6.83:1
- Dark mode muted on bg: 8.90:1
- **Royal focus ring on navy: 1.90:1** (fails 3:1 non-text contrast)
- **White on sand: 2.10:1** (do not use)

### Typography

- Body: Inter (next/font), 16px / 24px, colour ink.
- Display: Playfair Display 700 for all headings and card titles.
  - H1 (home hero): 48px / 48px, white on navy.
  - H2: 24px, navy.
  - H3 (cards): 18px.
- Wordmark: "Vossie" in ink + "Market Place" in royal, both Playfair, with a thin divider and the Eduvos crest logo.

### Components

- **Primary button (sand).** Background `#cfae7e`, text navy, radius 8px, height 44px (Search) or 48px (Start selling), padding 0 20px, 16px/600.
- **Secondary dark button.** Navy fill, white text, same radius (Message on Vossie, Show results, Next, Send message).
- **Outline button.** White fill, 2px navy border (Share, Clear, Back, Export CSV, Manage).
- **Chips.** Pill (fully rounded), 44px tall, 14px text.
  - On navy: transparent fill with a 1px white/50% border; active chip is sand fill with navy text.
  - On white (sort chips): navy fill when active, outlined otherwise.
- **Inputs.** 44px tall, radius 8px, 16px text (prevents iOS zoom), white background, grey border; error state has a red border plus red helper text.
- **Seller card (Featured).** 2px sand border, radius 12px, no shadow. Top block (~170px) is the seller's generated gradient image with a white Playfair name and a small sand "Featured" tag. Body: name + check, tagline, "Category · Campus".
- **Listing card.** Square generated image, white circular heart button top-right, title, bold price, seller name with Verified check, a trust pill, reply-time line, campus line. Radius ~12px, no shadow, thin border.
- **Trust pills.**
  - Trusted: navy pill with shield icon.
  - Responsive: royal pill.
  - New seller: light pill with navy outline.
  - Top Hustler: label seen on Thandi's Kitchen; style not captured.
  - Verified: sand pill with check, on profile hero.
- **Header.** Sticky, 61px, white, bottom border.
  - Desktop: wordmark + Eduvos logo left; text links Home, Browse, Messages, Saved, Looking For, Account; bell with royal count badge; moon icon; "Data saver Off" pill with emoji.
- **Footer.** Navy band: wordmark + tagline left, Eduvos logo in a white rounded box right, underlined links (Hub Growth, How trust works, Privacy).
- **Modals.** White, radius ~16px, Playfair title, close "x", dimmed navy overlay. Mobile filter panel is a bottom sheet with `aria-modal`.
- **Empty states.** Dashed-border mist panel, Playfair heading, one line of muted text, sand button [07] [15] [16].
- **Mobile bottom tab bar.** 5 items (Home, Browse, Messages, Saved, Account), solid navy icons with labels, white background, top border.

### Layout

- Main container max-width 1152px (`max-w-6xl`), centred.
- Hero copy constrained to 576-672px, which leaves the right half of the desktop hero empty [01].
- Featured: 4-column grid on desktop; horizontal scroll on mobile.
- New this week: a horizontal row on all sizes with no arrows, scroll hint or fade, cut off at the container edge.
- Categories: 5x2 grid of mist tiles with emoji + label on desktop; 2 columns on mobile.

### Imagery

- No photography anywhere. All listing images and most avatars are generated "typographic cards": a diagonal gradient per seller (purple-navy, magenta-navy, teal-navy, maroon-navy, royal), a short sand rule, the title in white Playfair, and the seller name in small sand text.
- Sellers without uploads show a flat mist block (Aisha's Bakes) or a sand square with a navy initial [13].
- Growth posts use a navy block with the post type ("Office hours", "Event", "Tip") in large sand Playfair [24].

### Iconography

- Custom inline SVGs (24x24, single path, filled or 2px stroke), all `aria-hidden`.
- Emoji used as icons: category tiles (pot, haircut, books, palette, laptop, dress, tools, arrows, party popper, sparkles), sell benefits, Data saver satellite.

### Modes

- **Dark mode.** Full token swap; navy hero stays; cards go to `#0b1322` / `#1a2742`. Persisted in the `vossie_theme` cookie; `<html data-theme>` and `data-theme-choice` [30].
- **Data saver.** `<html data-lowdata="true">`; drops about half the images and disables animations; persisted in the `vossie_lowdata` cookie [31].

### Head and PWA

- Present: `<html lang="en">`, viewport meta, two `theme-color` metas (light/dark), description, application-name, `mobile-web-app-capable`, `apple-mobile-web-app-title` "Vossie", manifest link, `favicon.ico` 256x256.
- Missing: Open Graph / Twitter tags, `apple-touch-icon` link.
- Service worker registered.

### Copy voice

Friendly, South African student register ("kota", "res", "hustle", "in rand"), short sentences.

---

## Mobile vs desktop issues

Checked at 390x844 (iframe-emulated) and 1384x797. Pages checked on mobile: home, browse (+ filter sheet), listing, seller profile, messages, saved, account, sell onboarding, mentor, mentor detail, growth, growth new, growth manage, privacy settings, trust, featured, privacy, guidelines, looking-for.

**What holds up:**

- No horizontal overflow on any route at 390px.
- Most tap targets are 44px or more.
- Filters collapse into a modal bottom sheet with focus moved inside.
- The bottom tab bar replaces the top nav.

**Issues:**

1. **Listing CTAs below the fold on mobile.** The image, title, price, swap callout and metadata push "Message on Vossie" and "Chat on WhatsApp" down to 866px on an 844px screen (true mobile emulation, logged out), and the bottom tab bar covers a further ~60px [38] [39]. There is no sticky action bar.
   - Related: the **mobile sign-in page is dominated by the demo panel.** Its account buttons wrap to 2-3 lines at 390px, with the label in a narrow left column and the email on the right. The panel is taller than the real sign-in form [47].
2. **No active state in navigation**, top or bottom. No `aria-current`, and every item has the same colour on every page.
3. **Mobile nav drops Looking For and has no Hub Growth entry.** Hub Growth is reachable only via the footer or Account; the footer sits under the bottom bar.
4. **Card text truncation at 390px.** Seller name plus Verified ("Amahle Events & De…"), swap text ("Swap for: Photography or D…") and reply time ("Usually replies within a…"). Mentor detail listing titles are also truncated.
5. **Sort chips wrap to two lines** on mobile browse (3 chips) [36]; the results grid starts low.
6. **Horizontal carousels have no scroll affordance** on either size (no arrows, dots or edge fade). On desktop the New this week row is clipped at the container edge [03].
7. **Desktop hero is half empty.** Content sits in the left ~600px, with no imagery on the right [01].
8. **Desktop listing page:** the seller card and "More from" sit far below, leaving a tall empty column under the image [09].
9. **Small inline links (20px tall) on mobile:** "public profile" (mentor detail), "seller guidelines" (trust page), "Settings > Privacy" and the Information Regulator link (privacy page).
10. **Mobile header hides the Eduvos logo** and shrinks Data saver to an icon-only circle whose meaning isn't obvious (it has an accessible label).
11. **At 570px (tablet-ish) and 390px**, Featured cards show a single card plus a sliver of the next. Fine as a carousel cue, but the first card is often Aisha's Bakes with a blank grey image [33].

---

## Console / network findings

- **Console.**
  - Logged in (Chrome, 2026-10-02): 0 errors and 0 warnings across about 30 page loads.
  - Logged out (built-in browser, 2026-10-05): 0 errors, but **2 warnings on every page load**. Both self-hosted woff2 fonts are "preloaded using link preload but not used within a few seconds", which means wasted or duplicated font bytes on first paint.
- **4 intermittent HTTP 503s during normal use** (everything else returned 200, apart from the expected 404s):
  - `/manifest.webmanifest`: 1 (later 200)
  - `/saved?_rsc=…` prefetch: 1
  - Supabase `auth/v1/user`: 1
  - Supabase `rest/v1/profiles?select=onboarding_seen…`: 1

  All coincided with bursts of navigation or prefetch, which suggests rate limiting or cold starts. Worth monitoring.
- **Duplicate client-side auth work.** Every navigation fires `GET auth/v1/user` plus `GET rest/v1/profiles?select=onboarding_seen&id=eq.<user-uuid>` from the browser. That was about 55 pairs during the crawl, on top of server-side rendering. It costs data and latency on mobile.
- **Aggressive prefetch.** Each page load prefetches RSC payloads for every nav link and visible card link (`/browse`, `/messages`, `/saved`, `/looking-for`, `/account`, `/sell`, `/how-featured-works`, `/s/...`). That is useful on wifi but expensive on prepaid mobile data.
- **Server timing (uncached, Cape Town edge to Dublin function).**
  - `/browse`: 1.5s
  - `/l/[id]`: 1.1s
  - `/s/[slug]`: 1.1s
  - `/mentor`: 1.0s
  - `/growth`: 0.8s
  - `x-vercel-cache: MISS` everywhere, so no ISR or static caching on public pages.
- **Payload sizes.**
  - HTML documents including inline RSC data: `/browse` 189KB, `/` 149KB, `/l/[id]` 67KB, `/s/[slug]` 53KB, `/mentor` 57KB, `/growth` 36KB.
  - JS: 11 chunks, about 743KB decoded. CSS: 1 file, 44KB. Fonts: 2 woff2 files.
- **First-visit data cost (logged out, compressed, 2026-10-05).**
  - Home HTML: 13KB (brotli). Browse: 14KB. Listing: 10KB. Login: 6KB.
  - Home static assets (15 JS/CSS/font files): 354KB.
  - Images: roughly 150-250KB more depending on screen width.
  - A first home-page visit costs about 0.5-0.6MB.
- **Oversized logo.** The Eduvos header logo is requested as `/_next/image?url=/brand/eduvos-logo.png&w=3840` (54KB WebP) but displays at about 76px wide. A w=256 variant is 9KB, so about 45KB is wasted per first visit. The likely cause is a missing `sizes` prop or an oversized `width` on next/image.
- **Slow image arrival.** On a cold image-optimizer cache, 16 of 18 home images took about 8s to arrive in Chrome. There's no blur or skeleton placeholder, so cards sit as flat grey blocks meanwhile [48].
- **Images.** Served via `/_next/image` at w=750-828 (cards) and w=640/256 (detail/avatar), q=75, WebP source. About 18-20 images on home; `srcset` lists 171 width variants.
- **Logged-out network.** No Supabase calls from the browser when signed out. The repeated `auth/v1/user` and `profiles` calls only happen for signed-in users.
- **Third parties.** None from the app. The only other requests came from your Chrome extensions (Adobe Acrobat, Google Tag Assistant). The red Acrobat button in some screenshots is the extension, not the app.
- **Not found.** robots.txt, sitemap.xml, Open Graph meta, `apple-touch-icon`.
- **Security headers.** No CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy or X-Content-Type-Options. `X-Powered-By` is exposed. HSTS is present.
- **Data residency.** Supabase is in Ireland and Vercel functions run in Dublin. They are co-located with each other but not in South Africa. The draft privacy policy covers this under POPIA s72.

### Data authenticity

| Item | Assessment |
|---|---|
| Sellers | Seeded demo set of 9: Aisha's Bakes, Zanele's Braids, Sipho Sneaker Spot, Naledi Notes, Lwazi Cuts, CodeCraft Fixers, Pixel & Pen Studio, Amahle Events & Decor, Thandi's Kitchen. Realistic SA copy |
| Listings | 29 available, realistic titles and rand prices ("Kota", "Haircut for data or airtime", "Braids for laptop repair" swap) |
| Images | Generated placeholders, one consistent gradient per seller; no real photos |
| Metrics | Plausible but seeded (e.g. Amahle: 6 enquiries, 86% response, 5 confirmed sales) |
| Dates | "Member since August/October 2026"; growth events stamped "18:33", consistent with seed-relative timestamps. The office-hours body says "Every Thursday 14:00 to 16:00" but is dated "Sun, 04 October at 18:33" |
| Test leakage | Notifications include `"[automated test] Office hours"` and repeated identical requests, so end-to-end tests appear to write to the production database |
| Copy bugs | "active Yesterday ago", "updated Yesterday ago" (2026-10-02) and "active 01 Oct ago" (2026-10-05) in mentor views: "ago" is appended to any formatted date. `/sell` page title "Seller dashboard" while the H1 reads "Sell on Vossie" |
| Data drift (2 to 5 Oct) | Amahle Events & Decor: response rate 86% to 75%, badge Trusted to New seller, listing views 5 to 7. Lwazi Cuts and Aisha's Bakes show New seller; Naledi Notes and Pixel & Pen show Responsive. Seed data is not refreshed, so demo badges and KPIs will keep degrading |
| Featured rotation | Featured order changed between visits (2026-10-05: Pixel & Pen, Zanele's, Aisha's, Amahle, Thandi's Kitchen, Lwazi, CodeCraft…), consistent with the nightly job |
| Demo identities on a public page | `/login` lists six demo email addresses in plain text (student-number style `@vossie.net`, staff `@eduvos.com`) |
| Internal language in UI | "Coming in Phase 6." (Looking For); "Draft for the Hack Jam. Eduvos should have this reviewed…" (Privacy) |

---

## Gaps vs brief

| Brief area | What exists | Gaps / risks |
|---|---|---|
| Seller registration and profiles | 5-step wizard with autosave and good validation; rich public profile (badges, verified, member since, reply time, about, listings); one-time slug change; Hub approval implied | Wizard steps 2-5, profile photo upload, profile edit and seller dashboard not observable; no visible approval status for an applicant; an applicant's "pending" state is unknown |
| Product AND service listings | Both: Type = Product / Service; services show "From R…" and Delivery "On campus or online"; products show Pickup point; swap terms supported | One image per listing; no real photos in the data; no service duration, availability or booking slots; no quantity or stock; listing creation form not observable |
| Discovery (search, categories, filters, campus scoping) | Typo-tolerant search; 10 categories; 5 filters + 3 sorts; campus chips on home and filter on browse; nightly fair featured rotation; New this week; hashtag links; seller "More from" | No seller directory; no category landing pages (category is a filter only); search ignores seller names; filters need a manual apply; no saved searches or alerts; carousels lack affordance |
| Buyer-seller interaction | In-app messaging (modal, prefill, safety tip), WhatsApp handoff with tracking, follow seller, save listing, share | Thread UI unverified; Looking For (reverse marketplace) is a stub but promoted in 3 places; no quotes, offers or booking for services |
| Orders or enquiries management | Backend enquiry lifecycle (response windows, mark completed, buyer confirm with 7-day auto-confirm) drives badges and mentor KPIs | No buyer-facing "My enquiries" status; seller enquiry UI gated and unseen; no cart, orders or payments by design (needs to be an explicit product decision in the redesign brief) |
| Safety and trust: Eduvos-only sign-up | Passwordless email-code sign-in. Copy: "Student number @vossie.net, or your @eduvos.com staff email". Privacy policy: Eduvos email "to keep Vossie limited to the Eduvos community" | Field accepts any domain client-side; server-side enforcement unverified (testing it would create an account). `@vossie.net` appears to be a project-owned student domain rather than Eduvos's own student email, so it's unclear how a real student proves enrolment. **One-click demo logins (incl. Admin) on the public sign-in page bypass all of this** |
| Safety and trust: verification | "Verified Incubation Hub member" badge granted by the Hub | No visible admin UI for granting it |
| Safety and trust: moderation | Report listing / profile (7 reasons), seller guidelines with a moderation process section, admin audit log mentioned, `/admin` route exists | Admin console not observed; no "block user" seen; possible approval-gate gap (a seller labelled "waiting for approval" may be publicly listed and featured) |
| Safety and trust: ratings | Deliberately replaced by computed badges with transparent rules | No qualitative feedback; buyers can't see why a seller is Trusted beyond the badge page |
| Accessibility | Skip link, landmarks (header, 3 navs, main, footer), single H1, labelled inputs (0 unlabeled on home), `aria-invalid` + `aria-describedby` errors, focus-visible 3px ring with offset, `prefers-reduced-motion` rule, 44px targets, 16px inputs, aria-hidden decorative SVGs, alt text on listing images, dark mode, Data saver | Focus ring 1.9:1 on navy; sign-in submit disabled until consent with no explanation (disabled buttons can't be focused or explain themselves); no loading feedback on Save / Message redirects; no `aria-current` in navs; notifications dropdown has no dialog/menu role; emoji used as meaningful icons; carousels lack controls; Share button behaviour untested; seller avatar image on listing page has empty alt (acceptable if decorative) |
| Multi-campus | Campus field on sellers, listings, growth posts; campus chips and filter; featured slots per campus; per-campus pickup points | Only Durban and Midrand exist; whether the campus list is data-driven or hard-coded is unknown; no "my campus" default remembered across pages (home uses query param) |

---

## Top 10 Recommendations

1. Remove the Demo accounts panel from production now: turn off the `demoEnabled` flag and the `demoLogin` server action, then check the admin audit log for any use since the site went public. Effort S
2. Enforce Eduvos-only sign-up on the server (domain allow-list, decide how real students prove enrolment versus `@vossie.net`) and add OTP rate limiting or a captcha. Effort M
3. Replace generated text-card images with real photo upload (cropping, compression, minimum 1 photo) plus a designed fallback and blur placeholders, ending the grey boxes. Effort M
4. Purge test and seed leakage: `[automated test]` and duplicate notifications, the "… ago" date bug, "Coming in Phase 6", "Draft for the Hack Jam"; point e2e tests at a separate database; freeze or refresh demo data so badges stop decaying. Effort S
5. Fix the logged-out journey: a visible "Sign in" button in the header, a reason-aware sign-in page ("Sign in to message Amahle"), loading states on Save / Message, and an explained consent requirement instead of a silently disabled button. Effort S
6. Hide "Looking For" from the top nav, home band and browse empty state until it ships, or build it as the reverse-marketplace feature. Effort S to hide / L to build
7. Add a sticky bottom action bar (Message, WhatsApp, Save) on mobile listing and seller pages; the Message button currently starts below the fold. Effort S
8. Give buyers a "My enquiries" view with status and the confirm-sale prompt. Get controlled, non-demo seller and admin access so the seller dashboard, listing creation, enquiries, approval gate and admin console can be audited and redesigned. Effort M
9. Cut data and latency for SA mobile users: fix the 3840px logo request (about 45KB saved), resolve the unused font preloads, add ISR or caching for public pages, drop per-navigation client auth calls when signed in, and limit prefetch. Effort M
10. Navigation, accessibility and launch hygiene: `aria-current` active states, Hub Growth in mobile nav, focus ring that passes on navy, carousel controls, SVG icons instead of emoji, Open Graph tags for WhatsApp previews, robots.txt, sitemap, and security headers (CSP, frame-ancestors, Referrer-Policy, no `X-Powered-By`). Effort S

---

## Screen notes (for readers without the images)

- **[01] Home, desktop.**
  - Header: white sticky bar with the wordmark and crest on the left, six text links, then bell (royal count bubble), moon icon and a rounded "Data saver Off" pill.
  - Hero: full-width navy band about 400px tall. Small sand pill "Eduvos Incubation Hub", a two-line white Playfair headline "Student hustles. Campus customers.", one line of white body text, then a white search field with a sand "Search" button. Below that, a sand "Start selling" button and campus chips (sand "All", outlined "Durban" / "Midrand").
  - The right 55% of the hero is empty navy.
- **[03] Home, mid page.**
  - "Featured Hustles" heading with a "How we pick" link on the right.
  - 2x4 grid of sand-bordered cards: gradient top halves with the business name in white serif, white bottom halves with name, tagline and meta.
  - "New this week": a row of square gradient listing cards with white circular heart buttons, clipped at the right edge.
- **[04] Home, bottom.**
  - Listing card footers with navy "Trusted" pills.
  - "Shop by category": 10 light-grey rounded tiles with emoji.
  - A full-width sand band "Can't find it? Ask for it." with a navy "Looking For (coming soon)" button.
  - Navy footer.
- **[05] Browse, desktop.**
  - "Browse hustles" title, full-width search with a navy Search button.
  - Left 260px filter column: five stacked selects, two price inputs, "Available only" checkbox, navy "Show results" and outlined "Clear".
  - Right: sort chips, "Showing 24 of 29 listings", and a 4-column card grid. The first card has a blank grey image.
- **[09] Listing, desktop.**
  - Breadcrumb "Browse / Events".
  - Left: a 480px square gradient image with the title in large white serif.
  - Right: serif title, heart button, large price, a 4-row key/value table (Type, Category, Campus, Pickup point), description, grey hashtag chips, two navy buttons ("Message on Vossie", "Chat on WhatsApp"), outlined "Share", small "Report this listing" link, then a navy seller card with avatar, Verified line, Trusted pill and "Following" button.
- **[10] / [11] Modals.**
  - Message: centred white card, serif title "Message Amahle Events & Decor", textarea with prefilled text, counter, safety sentence, full-width navy "Send message".
  - Report: tall scrolling card with seven bordered radio rows (bold label + grey hint each), an optional textarea and "Send report".
- **[12] Seller profile.**
  - Navy hero with a rounded-square avatar, serif business name, tagline, a row of pills (sand Verified, Category, Campus, Member since), a Trusted pill + "How trust works" link, reply time, and a sand "Following" button.
  - Below on white: Message and WhatsApp buttons, Report link, "About" paragraph, "Listings" 3-column grid.
- **[18] Notifications.**
  - White dropdown under the bell, about 380px wide: "Notifications" title, "Mark all read" link, then light-blue unread rows, each with a bold title, a timestamp ("Yesterday") on the right and a 2-line body.
- **[20] / [21] Seller onboarding.**
  - Narrow 544px column: serif title, subtitle, "Step 1 of 5: Basics" and a 5-segment progress bar (first segment royal).
  - Labelled fields with grey hints and a character counter; outlined Back and navy Next.
  - Error state: red borders and dark-red helper text.
- **[22] Mentor view.**
  - Serif title, subtitle, outlined "Export CSV" on the right, and a grey summary bar "1 of 9 sellers may need support".
  - Stacked white seller cards, each with a 4-column metric grid, a status pill on the right and an optional sand flag pill ("No enquiries in 14 days").
- **[23] Mentor seller detail.**
  - Amber left-bordered "May need support" alert, a 4+3 grid of grey KPI tiles with large serif numbers, then a "Recent listings" bordered list with status on the right, plus Private notes and Check-ins forms.
- **[24] Hub Growth.**
  - Title, outlined "Manage", sand "+ New post", type chips and campus chips.
  - 3-column cards whose top halves are navy blocks with the type word in large sand serif.
- **[28] Privacy settings.**
  - Stacked cards: consent (grey), Download my data (white + navy button), Reports I've made, and a red-bordered "Delete my account" card with a DELETE confirmation input.
- **[44] [47] Sign in (logged out).**
  - Desktop: a centred ~460px column under the standard header. Serif "Sign in to Vossie", grey subline "No passwords. We email you a one-time code.", a bold "Eduvos email" label, a grey hint line, and a white input with placeholder `20250123@vossie.net`. Then a checkbox with consent text and an underlined royal "privacy policy" link, and a full-width slate-grey (disabled) "Email me a sign-in code" button.
  - Below the form: a sand-tinted, sand-bordered card "Demo accounts" with six stacked outlined navy buttons, each with a bold role label on the left and the email in small text on the right.
  - Mobile: the same stack at full width, with the demo card running below the fold behind the bottom tab bar.
  - In OS dark mode the page renders with the dark tokens by default (the theme follows the system until the user picks one) [45].
- **[33]-[41] Mobile (390px).**
  - Header: wordmark only, bell, moon, round Data saver icon.
  - The hero stacks; "Start selling" becomes full width.
  - Featured and New this week become swipe rows showing about 1.3 cards.
  - Categories: 2 columns.
  - Browse: "Filters" outline button opens a bottom sheet; 2-column card grid.
  - Listing: full-width image, then details, with CTAs well below the fold.
  - A white bottom tab bar with 5 icon+label items is fixed at the bottom.
