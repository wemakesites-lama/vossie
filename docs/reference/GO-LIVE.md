# CampusCart go-live checklist

Every page and view the marketplace needs before it can go live, plus the work that isn't a screen. Drawn from the app's routes, the old demo's function map (`FUNCTION-MAP.md`) and the homepage spec's "Not in this stage" list.

Written 2026-10-12, after the homepage (Parts 1 and 2). Updated 2026-10-13, after the browse and listing pages, and 2026-10-14, after the shopping pages (storefront, Saved and collections), after the info, legal and system pages (part C) after Looking For and the Hub (part B), after sign-in and accounts, in sample mode (stage D), after messaging, reports and notifications, in sample mode (stage E), after selling, in sample mode (stage F), after the staff tools, in sample mode (stage G), after community actions, in sample mode (stage H), and after saved-search alerts, in sample mode (stage I), and after staff accounts, the admin's numbers and Show again, in sample mode (stage J), and after hardening (sign-in, sign-out and account deletion as full page loads, message limits, keyed hashes, info pages; stage K), and after housekeeping (an admin's own shop, requests that close themselves, the sitemap; stage L), and after the follow-ups (your own shop's mentor, Featured's resting order, the request reminder; stage M). Update the status column as each stage lands.

**Status key**
- **Built:** done.
- **Designing:** in the current brainstorm (browse and listing pages).
- **Placeholder:** the route exists and shows "coming soon".
- **Missing:** no route or view yet.

## 1. Public pages (no sign-in)

| Screen or view | Route | Status |
|---|---|---|
| Home | `/` | Built |
| Browse and search: results, Filters panel, Sort, active-filter chips, Show more, empty state | `/browse` | Built |
| Category and campus links | `/categories/[slug]`, `/c/[campus]` | Built (redirects into browse) |
| Listing: gallery, phone dock, collect box, seller card, more from the seller, paused and sold states, Share | `/listings/[id]` | Built |
| Seller storefront: header, badges, about, their listings, contact, report | `/sellers/[slug]` | Built |
| Collection: a curated list, e.g. "Res essentials" | `/collections/[slug]` | Built |
| Looking For board | `/looking-for` | **Built (sample mode)**: Post a request goes through sign-in to the form, or straight to it when signed in (stage H) |
| A single Looking For request | `/looking-for/[id]` | **Built (sample mode)**: the asker's panel with their offers, Offer to help for shops, Report (stage H) |
| Hub feed: tips, events, office hours | `/hub` | Built |
| Hub post, with RSVP and book-a-slot | `/hub/[id]`, `/hub/[id]/book` | **Built (sample mode)**: RSVP and slot requests for signed-in students; signed out, through sign-in |
| How it works, Safety | `/how-it-works`, `/safety` | Built |
| Privacy policy | `/privacy` | Built as a draft; Eduvos signs off the wording |
| How trust works (the badges, and how Featured is picked) | `/trust` | **Built**: Verified is the Hub's badge, separate from approval; badges and Featured's draw are worked out (sample mode) |
| Terms of use, seller guidelines | `/terms`, `/seller-guidelines` | Built as drafts; Eduvos signs off the wording |
| Error page (when something breaks) | `error.tsx` | Next's default for now (the branded page was dropped under the stop rule, decision 62) |
| Not found | 404 | Built |
| Offline page | `/offline` | **Built** (stage H): a self-contained page and a navigation-only worker, registered from the boot script after load, in production builds |

## 2. Sign-in and account

| Screen or view | Route | Status |
|---|---|---|
| Sign in, step 1: Eduvos email and POPIA consent | `/login` | **Built (sample mode: the code shows on screen)** |
| Sign in, step 2: the code, with wrong-code, expired-code and non-Eduvos-email errors | `/login` | **Built (sample mode: the code shows on screen)** |
| First sign-in: your name and campus | `/login`, step 3 | **Built** |
| "Sign in to do that" sheet, which returns you to what you were doing | links | **Built as links** to `/login?next=…` (decision 44); signed-in visitors see a note with the way back |
| Account summary and sign out | `/account` | **Built** |
| Privacy settings: consent record, download my data, reports I've made, delete my account (required by POPIA) | `/account/privacy` | **Built** (with the list of reports you've made) |
| Saved listings, and followed sellers once accounts exist | `/saved` | **Built** (followed sellers on Saved's Shops tab: stage H, sample mode) |
| Header: "Sign in" when signed out, and an inbox icon with an unread count | shell | **Built** (a red badge for new notifications on the account icon, not an inbox icon: messaging plan decision 10) |
| Post, edit, close, reopen and delete a Looking For request | `/looking-for/new`, `/looking-for/[id]/edit`, `/looking-for/[id]/delete` | **Built (sample mode)** |
| Your requests | `/account/requests` | **Built (sample mode)** |
| Offer to help with a request (shops only) | `/looking-for/[id]/offer` | **Built (sample mode)** |
| Saved searches: save from browse, pause and delete on Saved, a notification when a new listing matches | `/browse`, `/saved?tab=searches` | **Built (sample mode)** (stage I): Save this search on browse, and Saved's Searches tab with pause, resume and delete |

## 3. Messaging

| Screen or view | Route | Status |
|---|---|---|
| Message composer, with live scam tips | `/listings/[id]/message`, `/sellers/[slug]/message` | **Built (sample mode)** as a page; the scam check runs on the server when you send |
| Propose a swap (inside the composer) | composer | **Built (sample mode)**: a text offer; offering one of your own listings waits for stage F |
| Inbox | `/messages` | **Built (sample mode)** |
| Conversation thread, with its status (Asked, Replied, Done, Confirmed), "mark completed" and "confirm the sale" | `/messages/[id]` | **Built (sample mode)** |
| Notifications panel | `/notifications` | **Built (sample mode)** as a page |
| Report a listing or a profile (7 reasons, then a thank-you) | `/report`, `/report/sent` | **Built (sample mode)**, requests too |
| WhatsApp handoff | `/go/whatsapp/[slug]` | **Cut** (decision 57): in-app messages only |

## 4. Selling

| Screen or view | Route | Status |
|---|---|---|
| "Sell on CampusCart" pitch, for people who aren't selling yet | `/sell` | **Built (sample mode)** |
| Become-a-seller steps: basics, about, photo, campus and pickup points, review | `/sell/onboarding` | **Built (sample mode)**: no contact step (decision 57) |
| Waiting-for-approval state | `/sell` | **Built (sample mode)**: the shop can prepare drafts; the Hub approves or declines it (stage G), and a declined shop sees the reason and can send it again |
| Seller dashboard: status, the last 7 days' numbers, the badge's next step | `/sell` | **Built (sample mode)**: enquiries, replies within 48 hours and confirmed sales; no view counts |
| My listings: available, paused, sold or drafts; edit; delete with a confirm step | `/sell/listings` | **Built (sample mode)**, with drafts |
| Create and edit a listing: photos (compressed, location removed, alt text), price, swap terms, pickup point | `/sell/listings/new`, `/sell/listings/[id]/edit` | **Built (sample mode)** |
| Edit seller profile | `/sell/profile` | **Built (sample mode)**, with the shop's link changeable once |

## 5. Staff tools

| Screen or view | Route | Status |
|---|---|---|
| Admin: seller approvals, reports queue, hide a listing or hide a request (stage H) or pause an account, Verified badge, Featured pins, pickup points, audit log | `/admin/*` | **Built in sample mode**, with Hide the request (stage H) |
| Admin: staff accounts, weekly numbers, hidden listings and requests with Show again (stage J) | /admin/staff, /admin/numbers, /admin/hidden | **Built in sample mode** |
| Hub post editor and the office-hours queue | `/hub/new`, `/hub/[id]/edit`, `/hub/manage` | **Built in sample mode** |
| Mentor dashboard, seller detail, notes, check-ins, CSV export | `/mentor/*` | **Built in sample mode** |

**Totals:** about 46 screens and views, one of them (the WhatsApp handoff) cut. 43 are built (home, browse, the listing page, the category and campus redirects, the 404, the seller storefront, Saved, the collection page, How it works, Safety, How trust works, the privacy policy, terms of use and seller guidelines as drafts, Looking For's board and request pages and the Hub's feed and post pages, the offline page, and, in sample mode, sign-in, your account and privacy settings, messaging (the composer, inbox, thread, notifications and report pages), selling (the pitch, the application steps and waiting page, the dashboard, My listings, the listing form and Edit shop), the staff tools (the admin console, the Hub's post editor and office-hours queue, and the mentor dashboard), community actions (the request form and its edit page, Delete request, Your requests, the offer composer, and Saved's Shops tab) saved-search alerts (Save this search on browse, and Saved's Searches tab) and the admin's staff accounts, weekly numbers and Show again (stage J)), and 2 are placeholders or missing.

## 6. Work that isn't a screen

### Backend
- [x] Supabase project: schema, access rules, photo storage, seed data (campuses, categories, real pickup points). Built on Supabase (phases B and C, 2026-10-21).
- [x] Replace the sample fixtures with real queries behind `lib/data`, which is already shaped for this. Built on Supabase (phases B and C, 2026-10-21).
- [ ] A proper email sending service for sign-in codes. Supabase's built-in email is heavily rate-limited.
- [x] The email service replaces sample mode's outbox (`saveSampleEmail` in `sendCode`, `lib/auth/actions.ts`), and the sign-in page stops showing the code. Built on Supabase (phases B and C, 2026-10-21).
- [ ] Saved-search matching runs inside the publish Server Action (stage I). On the real backend, run it as a database query or from a queue, so publishing doesn't wait.
- [x] Supabase behind `lib/data/saved-searches.ts`. The match keeps browse's rules: `listingMatches` becomes the query's WHERE, or the queue worker calls it. Built on Supabase (phases B and C, 2026-10-21).
- [ ] Save this search writes one form-state row per signed-in browse view that offers Save, kept for an hour; the real backend should keep these cheaply or issue the token on demand (search alerts plan decision 21).
- [x] Supabase Auth or the real database behind `lib/data/accounts.ts`, `sessions.ts`, `sign-in.ts` and `form-states.ts`; then set `VOSSIE_SAMPLE_MODE=0`, which removes the sample accounts' buttons. Built on Supabase (phases B and C, 2026-10-21).
- [x] Sign-in rate limits on the real backend: per IP address as well as per email. Built in phase B: the app counts 5 codes an hour per address in the database (`reserve_code_send`) and 15 an hour per network (`reserve_ip_code_send`, under the IP address's keyed hash, `ip:` purpose; phase B review fix 2), and Supabase Auth's own per-address limits count each student, since the sign-in client and the proxy send the student's address (Vercel's `x-real-ip`) in `Sb-Forwarded-For` with the secret key. The live project allows 60 sign-ins and 60 code checks per 5 minutes per address (a campus's Wi-Fi puts many students behind one), set by `config push` from `[remotes.staging.auth.rate_limit]`; Authentication → Rate Limits → IP address forwarding must be on (runbook B5).
- [x] **Keyed hashes for codes.** Sign-in codes and tokens are stored as plain SHA-256 hashes (a code is salted with its attempt's key, which sits in the same row). A 6-digit code has only a million values, so a leaked store gives the codes away. The real backend hashes them with a server secret (HMAC). Built in stage K: HMAC-SHA-256 under `VOSSIE_AUTH_HMAC_KEY`.
- [ ] **Gate:** unset `VOSSIE_DEMO_SIGN_IN` in Vercel before the first real student signs in. While it's `1`, the sign-in page's five demo buttons put anyone straight into the seed accounts, the Admin included (Lama, 2026-10-22, for demos while no students are onboarded). Then run the guarded clear-out of the sample data: it removes the five demo accounts (`supabase/ops/add-demo-accounts.sql` added them to the live project), the sample Launchpad posts (`supabase/ops/add-demo-hub-posts.sql`), the demo activity and its three buyer accounts (`supabase/ops/add-demo-activity.sql`) and `vossie.test` from the allowed domains, which that file allowed so the access token hook would issue their sessions.
- [ ] Set `VOSSIE_AUTH_HMAC_KEY` (32+ characters) in every deployed environment before any real account signs in, then sign in once on that environment: a key shorter than 32 characters turns every signed-in page and sign-in post into a 500. The Vercel preview runs on the development key, with its warning, until then (Lama, 2026-10-20). Changing the key signs everyone out.
- [x] Phase B: `authKey()` refuses the development key, and `isSampleAccount()` is false, whenever `VOSSIE_BACKEND=supabase`, whatever `VOSSIE_SAMPLE_MODE` says (`signInMode()`, phase B Task 1). If Postgres ever computes these HMACs, it uses the same `token:`/`code:` purpose prefixes (a pgTAP test finds no `hmac(` in any function today).
- [x] Supabase Auth stores a sign-in code as an unkeyed SHA-224 of the address and the code (`GenerateTokenHash`, supabase/auth `internal/crypto/crypto.go`), in `auth.one_time_tokens`, for its 10 minutes. A leaked database could reveal a live code by trying the million values; the 10-minute life and the database's own protection are what guard it. Accepted (phase B). On Supabase, `getSessionKey` is the verified session's id.
- [ ] Sign-in email: Resend from `wemakesites.co.za` for the submission (free plan, 100 emails a day; Authentication → Rate Limits → emails sent per hour set to 30 in the dashboard, since `config push` doesn't send it); move to Eduvos's own domain with SPF, DKIM and DMARC, and a paid plan if needed, once Eduvos is on board (spec open decision 1). The privacy page's sender line changes with it.
- [ ] On Pro: turn on Auth's inactivity timeout (30 days) and retire `sweep_idle_sessions`.
- [ ] If sign-in emails are abused, add Cloudflare Turnstile through Supabase's captcha (adds client JS on `/login` only). The app's 15 codes an hour per network (phase B review fix 2) and 5 per address come first.
- [ ] The 5-try limit on a code relies on the publishable key never being used from a browser: the app counts every try (`record_wrong_try`) before it calls Supabase, and only the server holds the keys, so nobody calls Auth's `/verify` directly. Keep the client-chunk check in every build's checks (`grep -l "supabase" .next/static/chunks/*.js` prints nothing), and never expose a key as `NEXT_PUBLIC_`.
- [ ] Open point (phase B): with `proxy.ts` present, the sample `accounts.spec.ts` test "Back to the account page after signing out" clicked the Saved link before it hydrated about half the time at 390 and 1440 (never without the file). The test now waits for hydration; why the proxy's presence shifts the timing wasn't found. Look again if other sample tests turn flaky on Supabase builds.
- [x] Two requests renewing one session at the same moment (phase B's open point): both renew and both new sessions renew again, on the local stack (`lib/supabase/renewal.db.test.ts`, 2026-10-22). It rests on Supabase's refresh token reuse interval, 10 seconds (`supabase/config.toml`, and Supabase's default): keep it at 10 on the live project (Authentication → Sessions). A request carrying a token used more than 10 seconds earlier would still end the session.
- [ ] Back up the live project: the Free plan has no backups (phase B open question 1).
- [ ] **Gate:** Auth's database audit log (`auth.audit_log_entries`, the address and IP of each sign-in and refresh, which deleting an account leaves behind): turn off "write Auth audit logs to the database" on the live project before the switch (runbook B5, a hard gate since the phase B review, fix 1). The nightly job `sweep_auth_audit_log` (01:10 UTC) is the backstop: it keeps 30 days and removes the entries of an Auth user who no longer exists, so a deleted account's address is gone within a day; the privacy page says so.
- [x] **Counting tries.** Built in phase B (decision 2): every code try is counted atomically (`record_wrong_try`) before Supabase checks it, a lockout is final for its attempt, and the 5 codes an hour are reserved in one upsert (`reserve_code_send`). The real backend counts a wrong try (atomically) before it compares the code, so guesses sent in parallel can't get past 5 tries. The same goes for the 5 codes an hour: `recordWrongTry` and `reserveCodeSend` in `lib/data/sign-in.ts` say what each needs (a single `UPDATE … RETURNING`, and a single upsert or a per-email lock).
- [x] **The store's scope.** The sample store lives in one server process. Running more than one instance, or serverless functions, needs the real database first. Built on Supabase (phases B and C, 2026-10-21).
- [x] Scheduled jobs: recalculating trust badges nightly (Overview does it on demand today), confirming sales automatically after 7 days (it's settled when a conversation is read today, stage E), reminding askers 2 days before a request closes itself, then closing it and telling them (stages L and M settle both when something looks; the job runs the same rules nightly at 00:05 SAST, reminding where `reminder_day <= today < closing_day` and `reminded_for` isn't the closing day, so a missed night catches up), and the numbers' weekly roll-up (stage J). Featured's draw needs no job: each campus's row is recorded on its first view of the day. Built on Supabase (phases B and C, 2026-10-21).
- [x] Supabase: `reports.target_owner_id` (on delete set null), set when a report is made, and the report functions' own-target check falling back to it when the target has gone (stage L review, `1f55ee5`). Built on Supabase (phases B and C, 2026-10-21).
- [ ] On a long-running server, a few end-to-end write tests saw a stale page after a write (stage K once, stage L five on one run); all pass on a fresh server. Check `updateTag`/`revalidateTag` expiry under load on the real backend's cache before launch.
- [x] Supabase: `requests.closed_by` (`asker`, `auto`), `requests.reminded_for` (date), set in the job's transaction (stage M), and the closing day as a generated column or a view, so the board's query and the nightly job use one rule (stage L spec decision 10). The functions need the same matching rules: `set_request_open` clears a needed_by that has passed and sets `closed_by`; `start_offer` refuses on or after the closing day; `save_request`'s 5-open count leaves out due requests (stage L spec decisions 13 and 14). The job closes a request, tells its asker once and never touches the samples or a hidden request, as `settleRequests` does. Built on Supabase (phases B and C, 2026-10-21).
- [x] Supabase tables for conversations, messages, reports and notifications replace the sample store's (`lib/data/messages.ts`, `notifications.ts`, `reports.ts`). Built on Supabase (phases B and C, 2026-10-21).
- [ ] Live updates and the header's count without a page load (Supabase Realtime), if wanted: messaging spec 2.6 left them out.
- [ ] A scheduled job for the 7-day auto-confirm (it's checked on read today) and for deleting old messages, reports and notifications once Eduvos sets how long they're kept.
- [x] A limit on messages per account (reports have one: 10 in 24 hours). Built in stage K: 40 new conversations a day and 120 messages an hour (Lama, 2026-10-20); the numbers can be raised.
- [x] The message limits counted in the database: `start_conversation` and `send_message` count with the write, under an advisory lock on the sender, because the sample store counts with awaits before the write and forms sent at the same moment can pass the limits; `messages.sender_id` with an index on `(sender_id, sent_at)`; a partial index on `conversations (buyer_id, created_at) where request_id is null` (stage K spec decision 11). Built on Supabase (phases B and C, 2026-10-21).
- [ ] Supabase tables for shops, listings and onboarding drafts, and Supabase Storage for photos, replace the sample store's (`lib/data/shops.ts`, `own-listings.ts`, `photos.ts`, `catalog.ts`); `/photos/[id]` goes. Storage's own resizing (or a cache handler that can purge) replaces next/image's, with a purge when a photo is deleted (selling plan decision 12).
- [ ] Photos uploaded straight to storage from the browser (signed upload links), not through a Server Action: many hosts cap a request body far below the 32 MB set in `next.config.ts` (Vercel's functions take 4.5 MB). The no-JavaScript path then needs its own answer.
- [ ] Storage quotas per account (sample mode keeps only each account's newest 12 waiting photos), and a look at photos of people (consent, CLAUDE.md).
- [x] Stage G: approving, declining and staff-pausing shops (with a reason the seller sees), Verified, hiding listings, and the Featured rules (approved, something listed, a week's break as a preference). Built in sample mode (2026-10-19); the three items below move it to the real database.
- [ ] A true 404 status for staff pages: a proxy checks the session's role before rendering, once sessions live in the real database (staff tools plan decision 1).
- [x] Supabase tables for the audit log (insert-only: no update or delete grant for anyone), Featured pins and draws, pickup points, mentors' notes, Hub posts, RSVPs and slot requests replace the sample store's. Built on Supabase (phases B and C, 2026-10-21).
- [x] Hub covers move to Supabase Storage with the other photos. Built on Supabase (phases B and C, 2026-10-21).
- [x] Stage J: staff accounts (roles given by exact email and removed on a confirm page), the admin's weekly numbers with the small-number rule, and Show again for hidden listings and requests. Built in sample mode (2026-10-20); the items below move it to the real database. Task 1's spike failed, so the 404 status item above stays open.
- [x] The admin's numbers as a SQL view, `admin_weekly_counts(week_start, campus_slug, measure, count)`, grouping each table by `date_trunc('week', created_at at time zone 'Africa/Johannesburg')`, read through an admin-only RPC; then a weekly roll-up into `weekly_campus_counts` at 00:15 SAST each Monday, once the view is slow or retention starts deleting old rows (stage J spec section 8). The small-number rule stays in the app. Built on Supabase (phases B and C, 2026-10-21).
- [x] The last-admin rule in the database: a transaction, or a trigger that refuses removing the last `admin` (stage J spec decision 5). Built on Supabase (phases B and C, 2026-10-21).
- [x] A way to give the first admin role outside the app: a seed or a one-off script, never a page (stage J spec decision 8). Built in phase B: `private.make_first_admin(email)`, run once by hand in the SQL editor (runbook B11); it refuses when an admin exists.
- [x] **Re-check the actor's role inside the transaction** for every staff action, and that the target isn't the actor's own shop, listing or request (stage L: the sample store refuses it in the action; the database should too, in the same transaction, for approve, decline, verify, pause, resume, mentor, the four report actions, pin, unpin and both Show agains), and that removing a mentor role doesn't take the acting admin's own shop's mentor (stage M, for the role-removal function). A just-demoted admin can finish one action that was already in flight, because the page checked the role before the write (stage J). Built on Supabase (phases B and C, 2026-10-21).
- [x] Stage H: posting, editing, closing, reopening and deleting Looking For requests, offers from approved shops, Hide the request, following shops, and the offline page and worker. Built in sample mode (2026-10-19); the items below move it to the real database.
- [x] Supabase behind `lib/data/requests.ts`, `offers.ts` and `follows.ts`; the `requests` cache tag stays. Built on Supabase (phases B and C, 2026-10-21).
- [x] **A unique index on the conversation's request and shop,** where the request is set. Sample mode keeps one offer per shop per request by finding and inserting with no `await` between, which two requests at the same moment can't get past in one process; a database needs the index (community actions plan amendment 7). Built on Supabase (phases B and C, 2026-10-21).
- [x] **The request limits counted in the database.** The 5 open requests, 5 new a day and 20 offers a shop a day are counted with awaits before the write, so forms sent at the same moment can pass them. The real backend counts them with the write, in the same statement or behind a lock (community actions plan amendment 17.8). Built on Supabase (phases B and C, 2026-10-21).

### POPIA and legal (Eduvos signs these off)
- [ ] Final privacy policy, with a named Information Officer. A draft is live at `/privacy`; Eduvos's legal team reviews it.
- [ ] Terms of use and seller guidelines. Drafts are live at `/terms` and `/seller-guidelines`; Eduvos's legal team reviews them.
- [ ] **Claims in the drafts for Eduvos's lawyers to confirm** (plan decision 17 in `2026-10-14-info-and-system-pages.md`, and the review that followed):
  - Eduvos is the responsible party for the personal information CampusCart collects.
  - Under-18s need a parent's or guardian's consent to use CampusCart.
  - CampusCart sells no personal information and shares none for advertising.
  - Each POPIA section 11 ground the privacy page gives for what accounts will collect: needed to run the account, consent, or Eduvos's legitimate interest (safety, supporting student businesses, running CampusCart fairly).
  - Deleting an account removes its data straight away, and the other retention promises under "How long we keep it".
  - Hosting and section 72: the page says section 72 "generally allows" data stored abroad where the country, the company or an agreement protects it, and that Eduvos will say where it lives before launch.
  - A contact address for privacy requests, and the Information Officer's name: both are still to be named.
- [ ] How consent is recorded.
- [ ] The data export and deletion flows.
- [ ] Eduvos sets how long messages, reports and notifications are kept; the privacy policy says so (messaging plan decision 27). In sample mode they last until the server restarts.
- [ ] Where the data is hosted. The old demo ran in Ireland; sending data abroad needs adequate safeguards (section 72).
- [ ] The privacy policy's "CampusCart is still a preview" sentence comes out once accounts move to the real backend.
- [ ] Whether POPIA's right of access puts mentors' notes in the seller's data download; today the Information Officer is asked for them (staff tools plan decision 16).
- [ ] How long the staff audit log, RSVPs and slot requests are kept.

### Content
- [ ] Real photos.
- [ ] Eduvos fonts and the licence.
- [ ] The official crest SVG.
- [ ] Real pickup points for each campus.
- [ ] The Hub's real posts and office hours, and give the real staff their roles in `/admin/staff` (stage J).
- [ ] Real Hub events, tips and story. The 18 posts and the Hub's two paragraphs are sample wording.
- [ ] Real Looking For requests. The 16 requests (and the offers counts on them) are samples to remove, with their `seedOffers` (stage H).
- [ ] Info pages say what's true today; update them as stages land (How it works' "What can I do on CampusCart today?", the trust page's sample notes, the privacy page's "Your account" section). Brought up to date after stages H to J in stage K; keep updating them as stages land. The trust page's "When something is reported" is sample wording Lama kept for now.
- [ ] Remove every sample listing and the sample accounts (sample mode off). The development sign-in switch went in stage D.

### Production
- [ ] A domain and hosting.
- [ ] A stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` when more than one server instance runs (Server Actions).
- [ ] **The `Secure` flag.** The cookies' `Secure` flag follows `x-forwarded-proto` (`isHttps` in `lib/auth/cookies.ts`). On the real host, make sure only its own proxy sets that header, or always set `Secure` in production.
- [x] Security headers: `nosniff`, referrer policy, `X-Frame-Options`, `Permissions-Policy` and HSTS, without a CSP (2026-10-14).
- [ ] A Content Security Policy (it needs per-request nonces, which make pages dynamic).
- [ ] HSTS: add `includeSubDomains` and preload once the domain is settled.
- [ ] Decide how to keep the campus choice and saves past Safari's 7-day limit on cookies written by the page (decision 58).
- [x] robots.txt and a sitemap (2026-10-14). Looking For requests and Hub posts joined the sitemap when part B built them.
- [x] Decide whether the sitemap should keep listing closed requests and past Hub posts. It lists every one today (a reviewer noted it); a closed request or a past event may be better out of it. Decided in stage L: it lists open requests, tips, and events and office hours from today on, and is rendered per fetch (dynamic, so the real backend's query should filter by the SAST date too); the other pages keep their addresses.
- [x] Share images for WhatsApp: a default card (`app/opengraph-image.tsx`) for every page, and listings and sellers have their own (2026-10-14). All use `next/og`'s built-in font until Eduvos's font files arrive.
- [x] `metadataBase` comes from `NEXT_PUBLIC_SITE_URL` (`lib/site-url.ts`), so share cards, `robots.txt` and the sitemap all follow it (2026-10-14).
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the live domain in the host's build environment (see `.env.example`). Until it is set, share cards, `robots.txt` and the sitemap name `http://localhost:3000`, and a production build warns.
- [ ] Error monitoring.
- [ ] Backups.
- [ ] A decision on analytics: none, or a privacy-friendly one.
- [x] Sign-out and account deletion end with a full page load (`/logout` and `/account/privacy/delete`, stage K), so a shared computer keeps no hidden signed-in pages. See the iOS Safari back/forward-cache check under Quality.

### Quality
- [ ] End-to-end, accessibility and per-page speed tests for every new flow.
- [ ] LCP checked again with real photos (decision 34).
- [ ] Try Turbopack's `requestCost` chunking option, which saved about 1.1 KB on every page in a trial (decision 53).
- [ ] A test on a cheap Android phone.
- [ ] Decide whether a browser with JavaScript off needs the forms. "Works without JavaScript" means without the app's bundle: React's small inline script still places streamed parts, so with JavaScript off the composer, the thread's forms and the report form stay on their skeletons (messaging plan amendment 4).
- [ ] The offline worker's kill switch (stage H): a version that removes itself and its cache, tried on a real phone before launch. `WORKER_ON = false` in `lib/offline.ts` serves it and stops the pages registering the worker, but it reaches a phone that already has the worker only through the browser's own update check, which can take up to about a day (a plain reload doesn't trigger it). Plan for that delay when deciding whether to switch it off (community actions plan amendment 21.3).
- [x] **Stage D's sign-in replay of a gated page's redirect.** After a client navigation to a page that redirected to sign-in, signing in repeats that redirect (the browser kept it from the first visit), so the visitor is stranded on sign-in and the page never opens. Post a request, Offer to help and Follow work round it (links that follow the session), but a link straight at any other gated page still has it, so CLAUDE.md says never to link a signed-out visitor at one. A `refresh()` in `afterSignIn` didn't clear it; the fix belongs in the sign-in flow (community actions plan amendment 18). Fixed in stage K: the posts that start a session go to Route Handlers that answer 303, so sign-in ends with a full page load (the spike confirmed the replay first).
- [ ] **Back/forward cache after sign-out and account deletion, on iOS Safari.** Playwright turns the cache off, so no test sees it. By hand: open `/`, sign in, open `/account`, sign out, press Back twice, and confirm no signed-in header or email comes back; repeat after deleting a test account. Checked on desktop Chromium only (2026-10-20). If it leaks, the options are `Clear-Site-Data: "cache"` on the 303 or a `pageshow` reload in the boot script (stage K plan amendment 4).

### Launch
- [ ] A support contact, and a privacy contact address. `/privacy` says one will be added; `/terms` and `/seller-guidelines` tell people to "contact the Hub" without saying how.
- [ ] Enough sellers listed before day one, so it doesn't open empty.
- [ ] Possibly a pilot on one campus.
- [ ] Remove the sample accounts' exemption from the message limits with sample mode (it goes by itself, since `isSampleAccount` needs sample mode; listed so nobody keeps it on purpose).
- [ ] Unset `VOSSIE_NOINDEX` on the live deployment and rebuild, so search engines can find CampusCart (decision 68).
- [ ] **The rename's second pass (decision 83),** after `backend/phases-b-c` merges: the `vossie_` cookies and storage keys, the `VOSSIE_` settings (renamed in Vercel at the same moment, or the preview loses `NOINDEX` and its sign-in key), code identifiers and comments. The visible part is done on the merge: `20261024120000_campuscart_name.sql` (the staff role notifications and the first admin's audit line), the regenerated seed, and the code email's subject and template in `supabase/config.toml` and `supabase/templates/`.
- [ ] On the live project, by hand in the dashboard (decision 83): Authentication → Emails → Templates, both templates' subject "Your CampusCart sign-in code" and body from `supabase/templates/sign-in-code.html`; SMTP Settings, sender name `CampusCart` (phase B runbook A4, A5).

### Photo-to-listing (after the submission)
Built 2026-10-27 and off for the submission (spec `docs/superpowers/specs/2026-10-24-photo-to-listing-design.md`, section 9). Haiku first since stage A of the AI features (spec `docs/superpowers/specs/2026-11-03-ai-features-design.md`, decision 96). Switch it on only when every line here is done.
- [x] Push `20261027120000_photo_fills.sql` with the other migrations (dry run first). Pushed to Vossie Market on 2026-10-27, on Lama's go-ahead, after a dry run, together with the role views' two (`20261025120000_role_views_seller.sql`, `20261025120100_mentor_caseload.sql`), which hadn't been pushed. The remote is up to date (41 migrations).
- [x] **The hand check of Groq's strict `json_schema` with an image** (spec decision 9), done 2026-10-27 with Lama's Groq key: strict works with an image and no reasoning, so `VOSSIE_GROQ_FORMAT` stays unset. The outcome is in the spec's section 13. The very first press got a 429 that didn't repeat: watch the `rate-limited` count.
- [ ] **The photo test** (AI features spec section 8), with Lama's keys: about 30 photos, `VOSSIE_PHOTO_TEST=… pnpm vitest run --config vitest.hand.config.mts`. Set `VOSSIE_HAIKU_EFFORT` from it and note the outcome in the AI features spec's section 12.
- [ ] Lama: create the Anthropic key in the Anthropic console, and set a monthly spend limit there. Check Anthropic's commercial terms still say API inputs are deleted within 30 days and never used for training: the privacy line says both.
- [ ] Lama: create the Groq key.
- [ ] Lama: turn on Zero Data Retention in Groq's Data Controls.
- [ ] Lama: read Groq's Services Agreement (training, consumer use, liability) and note the answer here.
- [ ] Set `VOSSIE_LISTING_AI=1`, `VOSSIE_AI_PROVIDERS=anthropic,groq`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY` and `VOSSIE_HAIKU_EFFORT` in Vercel (and `VOSSIE_GROQ_FORMAT=json_object` if the hand check needed it), remove `VOSSIE_LISTING_AI_PROVIDERS` if it's there, then redeploy: the privacy page's line is drawn at build.
- [ ] Check Groq's deprecations page before switching on, then monthly.
- [ ] After two weeks, read the `[vossie] photo-to-listing:` log lines' counts by provider (`rate-limited`, `bad-output`, `low-confidence`, `refusal`).
- [ ] Photo tips (stage F) ride on this switch: read the hand test's Tip column (round two spec section 10) before switching on.

### The listing check (after the submission)
Built 2026-11-04 (AI features spec section 3, stage B; plan `docs/superpowers/plans/2026-11-04-ai-stage-b-listing-check.md`) and off. Haiku only, with photo-to-listing's Anthropic key.
- [x] On the local stack: `pnpm db:types` (byte-identical to the hand edits), `supabase test db` (2,615 passed) and `pnpm test:db` (357 passed), 2026-11-04.
- [ ] Push `20261104120000_listing_check.sql` to Vossie Market: a dry run first, then Lama's go-ahead.
- [ ] Set `VOSSIE_AI_LISTING_CHECK=1` in Vercel, then redeploy: the privacy page's line is drawn at build.
- [ ] After two weeks, read the `[vossie] listing-check:` log lines, and how many of the Reports queue's "The listing check" reports were dismissed: many dismissals mean the instruction stops honest listings.
- [ ] Decide whether the check needs a daily cap per account, as photo-to-listing has (`reservePhotoFill`): a stopped publish saves nothing, so each press of Save and publish is another Haiku call. The console's monthly spend limit is the only cap now.
- [ ] The Hub's "Hidden" notice says everyone who reported a listing has been told, even when the only report was the listing check's (which tells no one). Dismiss has its own "Dismissed." notice; hide could get the same.

### Report read (AI stage C, after the submission)
Built 2026-11-05 (AI features spec section 4, stage C; plan `docs/superpowers/plans/2026-11-05-ai-stage-c-report-read.md`) and off. Haiku only, with photo-to-listing's Anthropic key.
- [x] On the local stack: `supabase test db` (2,632 passed, `63_report_read`'s 17 included) and `pnpm test:db` (360 passed), 2026-11-04/05.
- [ ] The Anthropic key (`ANTHROPIC_API_KEY`) is set in Vercel (the same key as photo-to-listing and the listing check).
- [ ] Apply `20261105120000_report_read.sql` to Vossie Market (by Lama): a dry run first, then Lama's go-ahead.
- [ ] Set `VOSSIE_AI_REPORT_READ=1` in Vercel, then redeploy: the privacy page's report read line is drawn at build, so check it's live.
- [ ] File one real report on a test listing and check its "First read (may be wrong)" box on `/admin/reports/[id]` in the console.

### Snap to search (after the submission)
Built 2026-11-04 (AI features spec section 5, stage D; plan `docs/superpowers/plans/2026-11-05-ai-stage-d-photo-search.md`) and off. Haiku first, Groq behind it, with photo-to-listing's keys.
- [x] On the local stack: `pnpm db:types` (byte-identical to the hand edit), `supabase test db` (2,628 passed, 47 files) and `pnpm test:db` (357 passed), 2026-11-04.
- [ ] The photo test's photos (spec section 8) tried on Snap to search with the real keys: the words, the category, time taken, and that the person photo says "Couldn't tell". This is the first real check of `photoSearchSchema` against Haiku's structured outputs and Groq's strict mode.
- [ ] Push `20261105130000_photo_search.sql` to Vossie Market: a dry run first, then Lama's go-ahead.
- [ ] Set `VOSSIE_AI_PHOTO_SEARCH=1` in Vercel, then redeploy: the switch is read at build (the page, the overlay's link and the privacy line).
- [ ] After two weeks, read the `[vossie] photo-search:` log lines' counts by provider and kind (`person`, `low-confidence`, `bad-output`), and decide whether 30 searches a day is right.

### Search in your own words (after the submission)
Built 2026-11-05 (AI features spec section 6, stage E; plan `docs/superpowers/plans/2026-11-05-ai-stage-e-words-search.md`) and off. Haiku only, with photo-to-listing's Anthropic key. Open to everyone, so the site-wide cap (2,000 new parses a SAST day, `WORDS_SEARCH_DAILY_CAP` in `lib/browse/words.ts`) and the console's spend limit are the only brakes.
- [ ] Push `20261105140000_words_search.sql` to Vossie Market: a dry run first, then Lama's go-ahead.
- [ ] A hand check with the real key: ten sentences students would type ("cheap kettle at Midrand", "FAC1501 textbook under R200", "free stuff Pretoria", "laptop charger hp under 300") and the line each gives. Note the outcome in the AI features spec's section 12.
- [ ] Set `VOSSIE_AI_WORDS_SEARCH=1` in Vercel, then redeploy: the privacy page's line is drawn at build.
- [ ] After two weeks, read the `[vossie] words-search:` log lines and how often the cap was reached (the `private.words_search_parses` rows): raise or lower the cap.
- [ ] Know that the cap can run out: a Haiku outage (a failed call still counts) or anyone sending 2,000 different sentences in a day turns the words search off silently until SAST midnight, and Browse searches the words exactly. A dead feature with a full `words_search_parses` row for today is the cap, not a bug.
- [ ] The parse cache is per server instance (Next's in-memory cache handler), so on Vercel a repeated search can cost a new parse on a cold instance. Fine at launch traffic; a shared cache handler would fix it if the cap is reached.

### Starter pack (AI stage H, after the submission)
Built 2026-11-04 (AI round two spec section 6; plan `docs/superpowers/plans/2026-11-04-ai-stage-h-starter-pack.md`) and off. Haiku only, with the words search's Anthropic key. No migration: it shares the words search's site-wide cap (2,000 new reads a SAST day, `WORDS_SEARCH_DAILY_CAP`), which stage G's request reading uses too.
- [ ] The hand check with the real key (plan Task 9) passed, its outcome in the spec's section 10.
- [ ] Set `VOSSIE_AI_STARTER_PACK=1` in Vercel, then redeploy: the privacy line and the three links in are drawn at build.
- [ ] Check it on vossie-pi: a sentence naming a campus with listings, its pack and a See more; the links on Browse's empty state, the Looking For board and the home page.
- [ ] After two weeks, read the `[vossie] starter-pack:` log lines and the cap's daily rows (`private.words_search_parses`): three features now share it.

### Someone's looking for this (AI stage G, after the submission)
Built 2026-11-04 (AI round two spec section 5, stage G; plan `docs/superpowers/plans/2026-11-04-ai-stage-g-looking-match.md`) and off. Haiku only, with photo-to-listing's Anthropic key. Each post or worded edit takes one of the words search's 2,000 daily parses on a cache miss.
- [ ] Push `20261106120000_looking_match.sql` to Vossie Market: a dry run first, then Lama's go-ahead.
- [ ] The hand test (plan Task 10) passed with the workspace key, and its summary is in the spec's section 10.
- [ ] Set `VOSSIE_AI_LOOKING_MATCH=1` in Vercel, then redeploy: the privacy page's line is drawn at build.
- [ ] Run the backfill once: `curl -H "Authorization: Bearer $CRON_SECRET" https://vossie-pi.vercel.app/api/cron/request-matches` until it answers `"more":false`. `"capped":true` means the day's parses are used up: carry on after SAST midnight.
- [ ] Check it on vossie-pi: a student posts a request; another account's shop at that campus publishes a matching listing and sees the line; "Make an offer" opens the composer; the asker has no notification until the offer.
- [ ] After two weeks, read the `[vossie] looking-match:` and `words-search:` log lines.

### Shop coach, without the model (AI stage I1, after the submission)
Built 2026-11-05 (AI round two spec sections 2 to 4; plan `docs/superpowers/plans/2026-11-04-ai-stage-i1-shop-coach-core.md`) and off. It needs stage G live for `answer-request` (without G it simply has none).
- [ ] Push `20261107120000_shop_coach.sql` to Vossie Market (a dry run first, then Lama's go-ahead) before this code is deployed, not only before the switch: the data download reads `own_coach_weeks` whatever the switch says.
- [ ] Either wait for I2, or set `VOSSIE_AI_SHOP_COACH=1` alone for fixed wording (weeks made on a seller's first visit from Monday 06:00 SAST). Then redeploy.
- [ ] On vossie-pi: an approved seller sees "This week" on `/sell` and "Your week" on `/hub`; a tip's Mark done ticks; a signed-out visitor's `/hub` is unchanged.

## 7. Decisions for Lama and Eduvos

- [ ] **Report the kept-redirect behaviour to Next.js, if necessary** (Lama, 2026-10-20). `tests/e2e/sign-in-return.spec.ts` with `SIGN_IN_SPIKE=1` is the reproduction.
- [ ] **Who can sell?** Sellers the Hub approves (selling spec 2.7), built that way; a lighter path for one-off sales is still open. An approval queue suits a hustle selling braids but is heavy for one textbook. The choice also shapes the admin tools, and who can make offers on Looking For requests (stage H: approved shops only).
- [ ] **Which email proves someone is a student?** The demo's `@vossie.net` was a stand-in.
- [ ] **Plus addresses.** `thandi+1@eduvos.com` counts as a new address, which gets round the per-email code limit and allows several accounts per student. Decide with Eduvos whether to treat plus addresses as the same person, or reject them, once its mail system is known.
- [ ] **Who moderates reports and approvals,** and how fast do they respond?
- [x] **Showing a hidden listing again.** Built in stage J: `/admin/hidden`, with a confirm page; hiding it again needs a new report.
- [x] **Should an admin be able to act on their own shop?** Approve, verify or pin it. No: refused in the action, the controls replaced by a line, and nobody reads mentors' notes about themselves (stage L). Reports an admin made about someone else's shop are theirs to act on (stage L spec section 10, question 3). Decided by Claude under decision 54; Lama may revisit.
- [x] **Featured with few Verified sellers.** The week's break is a preference, not a rule: with nine Verified sellers for four places, a seller who has just been featured comes after everyone else rather than leaving the row short (staff tools spec section 8). Once more sellers are Verified the break holds in full. Assessed in stage L: a strict break would leave rows short three days in seven; a least-recently-featured order for resting sellers is offered (stage L spec decision 20). Decided in stage M: the break stays a preference; resting sellers come back least recently featured first, the campus's own still first. The draw function on the real backend takes the same map of last days from `featured_draws`. Decided by Claude under decision 54; Lama may revisit.
- [ ] **Email to staff** when an application, a report or a slot request waits (staff tools spec 7).
- [ ] **Do new messages, or saved-search alerts (stage I), send an email?** Messages are in-app only (decision 57); email notifications are still to decide.
- [ ] **How long are messages, reports and notifications kept?** Eduvos's call (messaging plan decision 27). The privacy policy says the periods will be set before launch; today everything lasts until the server restarts.
- [ ] **Do Looking For and the Hub go live on day one?** If not, their homepage sections are hidden.
- [ ] **All 13 campuses at once, or a pilot campus first?**

## 8. Suggested order

1. **Done (2026-10-13):** browse and listing pages.
2. **Done (2026-10-14): the other public pages.** The storefront, Saved, collections, the info, legal and system pages, and Looking For and the Hub (to read) are done. The branded error page was dropped under the JS stop rule, so Next's default shows. Next is item 3, starting with stage D (sign-in and accounts): it turns every "sign in to do that" link on these pages into the real flow.
3. **Done in sample mode (2026-10-14): sign-in, account and privacy.** Supabase and an email service replace the sample store at go-live.
4. **Done in sample mode (2026-10-15): onboarding, the listing form and the dashboard.** The staff tools that approve shops are stage G's (item 5).
5. **Done in sample mode (2026-10-19): the staff tools (stage G).**
6. **Done in sample mode (2026-10-19): community actions (stage H).** Posting Looking For requests, offers, following shops and the offline page.
   - **Done in sample mode (2026-10-20): saved-search alerts (stage I).** Save this search on browse, Saved's Searches tab, and a notification when a new listing matches. No email.
   - **Done in sample mode (2026-10-20): staff accounts, the admin's numbers and Show again (stage J).** Roles given by exact email, weekly counts per campus under a small-number rule, and hidden listings and requests shown again. Staff pages still answer 200 with the 404 view (the 404 status item stays).
   - **Done in sample mode (2026-10-20): hardening (stage K).** Sign-in, sign-out and account deletion end with a full page load, 40 new conversations a day and 120 messages an hour, HMAC-keyed codes and tokens, and the info pages brought up to date.
   - **Done in sample mode (2026-10-21): housekeeping (stage L).** No admin decides about their own shop, its listings or their own request; old Looking For requests close themselves and their askers are told; the sitemap lists only open requests and Hub posts that haven't passed.
   - **Done in sample mode (2026-10-21): follow-ups (stage M).** An admin can't remove the mentor role from whoever mentors their own shop; Featured brings back the sellers featured longest ago first; an asker is reminded once, 2 days before a request closes itself.
7. **Done in sample mode (2026-10-14): messaging, reports and notifications.** Supabase replaces the sample store at go-live.
   - Stage E builds messaging, then stage F selling. Stage G adds the staff tools: admin, the Hub's posting tools and the mentors' dashboard. Stage H adds community actions: posting Looking For requests, offers, following shops and the offline page. Stage I adds saved-search alerts. Stage J adds staff accounts, the admin's numbers and Show again. Stage K adds hardening: sign-in, sign-out and account deletion as full page loads, message limits, keyed hashes and brought-up-to-date info pages. Stage L adds housekeeping: the own-shop guard, requests that close themselves, and a sitemap of what's current. Stage M adds three follow-ups: your own shop's mentor, Featured's resting order and the request reminder.
8. **Launch readiness:** legal sign-off, domain, monitoring, content, and the pilot.

**After launch:** delivery between campuses, saved-search email alerts or a digest (once there's an email service and a consent choice), and alerts on price drops (search alerts spec 7).
