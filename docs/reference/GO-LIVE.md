# Vossie go-live checklist

Every page and view the marketplace needs before it can go live, plus the work that isn't a screen. Drawn from the app's routes, the old demo's function map (`FUNCTION-MAP.md`) and the homepage spec's "Not in this stage" list.

Written 2026-10-12, after the homepage (Parts 1 and 2). Updated 2026-10-13, after the browse and listing pages, and 2026-10-14, after the shopping pages (storefront, Saved and collections), after the info, legal and system pages (part C) after Looking For and the Hub (part B), and after sign-in and accounts, in sample mode (stage D). Update the status column as each stage lands.

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
| Looking For board | `/looking-for` | Built to read; posting a request: stage H (designed) |
| A single Looking For request | `/looking-for/[id]` | Built to read; offers: stage H (designed) |
| Hub feed: tips, events, office hours | `/hub` | Built |
| Hub post, with RSVP and book-a-slot | `/hub/[id]` | Built (RSVP and booking wait for accounts) |
| How it works, Safety | `/how-it-works`, `/safety` | Built |
| Privacy policy | `/privacy` | Built as a draft; Eduvos signs off the wording |
| How trust works (the badges, and how Featured is picked) | `/trust` | Built |
| Terms of use, seller guidelines | `/terms`, `/seller-guidelines` | Built as drafts; Eduvos signs off the wording |
| Error page (when something breaks) | `error.tsx` | Next's default for now (the branded page was dropped under the stop rule, decision 62) |
| Not found | 404 | Built |
| Offline page | `/offline` | Designed (stage H): a self-contained page and a navigation-only worker |

## 2. Sign-in and account

| Screen or view | Route | Status |
|---|---|---|
| Sign in, step 1: Eduvos email and POPIA consent | `/login` | **Built (sample mode: the code shows on screen)** |
| Sign in, step 2: the code, with wrong-code, expired-code and non-Eduvos-email errors | `/login` | **Built (sample mode: the code shows on screen)** |
| First sign-in: your name and campus | `/login`, step 3 | **Built** |
| "Sign in to do that" sheet, which returns you to what you were doing | links | **Built as links** to `/login?next=…` (decision 44); signed-in visitors see a note with the way back |
| Account summary and sign out | `/account` | **Built** |
| Privacy settings: consent record, download my data, reports I've made, delete my account (required by POPIA) | `/account/privacy` | **Built** (the list of reports you've made waits for stage E) |
| Saved listings, and followed sellers once accounts exist | `/saved` | Built (followed sellers: stage H, on Saved's Shops tab) |
| Header: "Sign in" when signed out, and an inbox icon with an unread count | shell | **Built** (the unread count waits for stage E) |
| Post, edit, close, reopen and delete a Looking For request | `/looking-for/new`, `/looking-for/[id]/edit`, `/looking-for/[id]/delete` | Designed (stage H) |
| Your requests | `/account/requests` | Designed (stage H) |
| Offer to help with a request (shops only) | `/looking-for/[id]/offer` | Designed (stage H) |
| Saved searches: save from browse, pause and delete on Saved, a notification when a new listing matches | `/browse`, `/saved?tab=searches` | Designed (stage I) |

## 3. Messaging

| Screen or view | Route | Status |
|---|---|---|
| Message composer, with live scam tips | sheet | Missing |
| Propose a swap (inside the composer) | sheet | Missing |
| Inbox | `/messages` | Missing |
| Conversation thread, with its status (Asked, Replied, Done, Confirmed), "mark completed" and "confirm the sale" | `/messages/[id]` | Missing |
| Notifications panel | sheet | Missing |
| Report a listing or a profile (7 reasons, then a thank-you) | sheet | Missing |
| WhatsApp handoff | `/go/whatsapp/[slug]` | Missing; decide whether to keep it |

## 4. Selling

| Screen or view | Route | Status |
|---|---|---|
| "Sell on Vossie" pitch, for people who aren't selling yet | `/sell` | Placeholder |
| Become-a-seller steps: basics, about, contact, campus and pickup points, review | `/sell/onboarding` | Missing |
| Waiting-for-approval state | `/sell` | Missing |
| Seller dashboard: status, today's numbers, stats | `/sell` | Missing |
| My listings: available, paused or sold; edit; delete with a confirm step | `/sell/listings` | Missing |
| Create and edit a listing: photos (compressed, location removed, alt text), price, swap terms, pickup point | `/sell/listings/new`, `/sell/listings/[id]/edit` | Missing |
| Edit seller profile | `/sell/profile` | Missing |

## 5. Staff tools

| Screen or view | Route | Status |
|---|---|---|
| Admin: seller approvals, reports queue, hide a listing or pause an account, Verified badge, Featured pins, pickup points, audit log; hide a request (stage H) | `/admin/*` | Missing |
| Hub post editor and the office-hours queue | `/hub/new`, `/hub/manage` | Missing |
| Mentor dashboard, seller detail, notes, check-ins, CSV export | `/mentor/*` | Missing; can follow launch |

**Totals:** about 45 screens and views. 21 are built (home, browse, the listing page, the category and campus redirects, the 404, the seller storefront, Saved, the collection page, How it works, Safety, How trust works, the privacy policy, terms of use and seller guidelines as drafts, Looking For's board and request pages and the Hub's feed and post pages, which read today and send acting to sign-in, and, in sample mode, sign-in, your account and privacy settings), and 24 are placeholders or missing. Most of the missing ones are the signed-in half of the product.

## 6. Work that isn't a screen

### Backend
- [ ] Supabase project: schema, access rules, photo storage, seed data (campuses, categories, real pickup points).
- [ ] Replace the sample fixtures with real queries behind `lib/data`, which is already shaped for this.
- [ ] A proper email sending service for sign-in codes. Supabase's built-in email is heavily rate-limited.
- [ ] The email service replaces sample mode's outbox (`saveSampleEmail` in `sendCode`, `lib/auth/actions.ts`), and the sign-in page stops showing the code.
- [ ] Saved-search matching runs inside the publish Server Action (stage I). On the real backend, run it as a database query or from a queue, so publishing doesn't wait.
- [ ] Supabase Auth or the real database behind `lib/data/accounts.ts`, `sessions.ts`, `sign-in.ts` and `form-states.ts`; then set `VOSSIE_SAMPLE_MODE=0`, which removes the sample accounts' buttons.
- [ ] Sign-in rate limits on the real backend: per IP address as well as per email.
- [ ] **Keyed hashes for codes.** Sign-in codes and tokens are stored as plain SHA-256 hashes (a code is salted with its attempt's key, which sits in the same row). A 6-digit code has only a million values, so a leaked store gives the codes away. The real backend hashes them with a server secret (HMAC).
- [ ] **Counting tries.** The real backend counts a wrong try (atomically) before it compares the code, so guesses sent in parallel can't get past 5 tries. The same goes for the 5 codes an hour: `recordWrongTry` and `reserveCodeSend` in `lib/data/sign-in.ts` say what each needs (a single `UPDATE … RETURNING`, and a single upsert or a per-email lock).
- [ ] **The store's scope.** The sample store lives in one server process. Running more than one instance, or serverless functions, needs the real database first.
- [ ] Scheduled jobs: the nightly Featured draw, recalculating trust badges, confirming sales automatically after 7 days, and closing old Looking For requests (stage H leaves them open).

### POPIA and legal (Eduvos signs these off)
- [ ] Final privacy policy, with a named Information Officer. A draft is live at `/privacy`; Eduvos's legal team reviews it.
- [ ] Terms of use and seller guidelines. Drafts are live at `/terms` and `/seller-guidelines`; Eduvos's legal team reviews them.
- [ ] **Claims in the drafts for Eduvos's lawyers to confirm** (plan decision 17 in `2026-10-14-info-and-system-pages.md`, and the review that followed):
  - Eduvos is the responsible party for the personal information Vossie collects.
  - Under-18s need a parent's or guardian's consent to use Vossie.
  - Vossie sells no personal information and shares none for advertising.
  - Each POPIA section 11 ground the privacy page gives for what accounts will collect: needed to run the account, consent, or Eduvos's legitimate interest (safety, supporting student businesses, running Vossie fairly).
  - Deleting an account removes its data straight away, and the other retention promises under "How long we keep it".
  - Hosting and section 72: the page says section 72 "generally allows" data stored abroad where the country, the company or an agreement protects it, and that Eduvos will say where it lives before launch.
  - A contact address for privacy requests, and the Information Officer's name: both are still to be named.
- [ ] How consent is recorded.
- [ ] The data export and deletion flows.
- [ ] Where the data is hosted. The old demo ran in Ireland; sending data abroad needs adequate safeguards (section 72).
- [ ] The privacy policy's "Vossie is still a preview" sentence comes out once accounts move to the real backend.

### Content
- [ ] Real photos.
- [ ] Eduvos fonts and the licence.
- [ ] The official crest SVG.
- [ ] Real pickup points for each campus.
- [ ] Real Hub events, tips and story. The 18 posts and the Hub's two paragraphs are sample wording.
- [ ] Real Looking For requests. The 16 requests (and the offers counts on them) are samples to remove, with their `seedOffers` (stage H).
- [ ] Info pages say what's true today; update them as stages land (How it works' "What can I do on Vossie today?", the trust page's sample notes, the privacy page's "Your account" section).
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
- [ ] Decide whether the sitemap should keep listing closed requests and past Hub posts. It lists every one today (a reviewer noted it); a closed request or a past event may be better out of it.
- [x] Share images for WhatsApp: a default card (`app/opengraph-image.tsx`) for every page, and listings and sellers have their own (2026-10-14). All use `next/og`'s built-in font until Eduvos's font files arrive.
- [x] `metadataBase` comes from `NEXT_PUBLIC_SITE_URL` (`lib/site-url.ts`), so share cards, `robots.txt` and the sitemap all follow it (2026-10-14).
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the live domain in the host's build environment (see `.env.example`). Until it is set, share cards, `robots.txt` and the sitemap name `http://localhost:3000`, and a production build warns.
- [ ] Error monitoring.
- [ ] Backups.
- [ ] A decision on analytics: none, or a privacy-friendly one.

### Quality
- [ ] End-to-end, accessibility and per-page speed tests for every new flow.
- [ ] LCP checked again with real photos (decision 34).
- [ ] Try Turbopack's `requestCost` chunking option, which saved about 1.1 KB on every page in a trial (decision 53).
- [ ] A test on a cheap Android phone.
- [ ] The offline worker's kill switch (stage H): a version that removes itself and its cache, tried on a real phone before launch.

### Launch
- [ ] A support contact, and a privacy contact address. `/privacy` says one will be added; `/terms` and `/seller-guidelines` tell people to "contact the Hub" without saying how.
- [ ] Enough sellers listed before day one, so it doesn't open empty.
- [ ] Possibly a pilot on one campus.
- [ ] Unset `VOSSIE_NOINDEX` on the live deployment and rebuild, so search engines can find Vossie (decision 68).

## 7. Decisions for Lama and Eduvos

- [ ] **Who can sell?** Any signed-in student, or only sellers the Hub has approved? An approval queue suits a hustle selling braids but is heavy for one textbook. This choice shapes onboarding and the admin tools, and who can make offers on Looking For requests (stage H: approved shops only).
- [ ] **Which email proves someone is a student?** The demo's `@vossie.net` was a stand-in.
- [ ] **Plus addresses.** `thandi+1@eduvos.com` counts as a new address, which gets round the per-email code limit and allows several accounts per student. Decide with Eduvos whether to treat plus addresses as the same person, or reject them, once its mail system is known.
- [ ] **Who moderates reports and approvals,** and how fast do they respond?
- [ ] **In-app messages, a WhatsApp handoff, or both?** And do new messages, or saved-search alerts (stage I), send an email?
- [ ] **Do Looking For and the Hub go live on day one?** If not, their homepage sections are hidden.
- [ ] **All 13 campuses at once, or a pilot campus first?**

## 8. Suggested order

1. **Done (2026-10-13):** browse and listing pages.
2. **Done (2026-10-14): the other public pages.** The storefront, Saved, collections, the info, legal and system pages, and Looking For and the Hub (to read) are done. The branded error page was dropped under the JS stop rule, so Next's default shows. Next is item 3, starting with stage D (sign-in and accounts): it turns every "sign in to do that" link on these pages into the real flow.
3. **Done in sample mode (2026-10-14): sign-in, account and privacy.** Supabase and an email service replace the sample store at go-live.
4. **Selling:** onboarding, listing form and dashboard, plus the minimum admin (approvals and moderation).
5. **Messaging:** composer, inbox, conversations, reports and notifications.
   - Stage E builds messaging, then stage F selling. Stage G adds the staff tools: admin, the Hub's posting tools and the mentors' dashboard. Stage H adds community actions: posting Looking For requests, offers, following shops and the offline page. Stage I adds saved-search alerts.
6. **Launch readiness:** legal sign-off, domain, monitoring, content, and the pilot.

**After launch:** delivery between campuses.
