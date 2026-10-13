# Vossie go-live checklist

Every page and view the marketplace needs before it can go live, plus the work that isn't a screen. Drawn from the app's routes, the old demo's function map (`FUNCTION-MAP.md`) and the homepage spec's "Not in this stage" list.

Written 2026-10-12, after the homepage (Parts 1 and 2). Update the status column as each stage lands.

**Status key**
- **Built:** done.
- **Designing:** in the current brainstorm (browse and listing pages).
- **Placeholder:** the route exists and shows "coming soon".
- **Missing:** no route or view yet.

## 1. Public pages (no sign-in)

| Screen or view | Route | Status |
|---|---|---|
| Home | `/` | Built |
| Browse and search: results, Filters panel, Sort, active-filter chips, Show more, empty state | `/browse` | Designing |
| Category and campus links | `/categories/[slug]`, `/c/[campus]` | Placeholder; become redirects into browse |
| Listing: gallery, phone dock, collect box, seller card, more from the seller, sold and reserved states, Share | `/listings/[id]` | Designing |
| Seller storefront: header, badges, about, their listings, contact, report | `/sellers/[slug]` | Placeholder |
| Collection: a curated list, e.g. "Res essentials" | `/collections/[slug]` | Placeholder |
| Looking For board | `/looking-for` | Placeholder |
| A single Looking For request | `/looking-for/[id]` | Missing |
| Hub feed: tips, events, office hours | `/hub` | Placeholder |
| Hub post, with RSVP and book-a-slot | `/hub/[id]` | Missing |
| How it works, Safety, Privacy policy | `/how-it-works`, `/safety`, `/privacy` | Placeholder |
| How trust badges work, how Featured is picked, seller guidelines, terms of use | none yet | Missing |
| Error page (when something breaks) | `error.tsx` | Missing |
| Not found | 404 | Built |
| Offline page | `/offline` | Missing; can follow launch |

## 2. Sign-in and account

| Screen or view | Route | Status |
|---|---|---|
| Sign in, step 1: Eduvos email and POPIA consent | `/login` | Placeholder |
| Sign in, step 2: the code, with wrong-code, expired-code and non-Eduvos-email errors | `/login` | Missing |
| First sign-in: your name and campus | none yet | Missing |
| "Sign in to do that" sheet, which returns you to what you were doing | sheet | Missing |
| Account summary and sign out | `/account` | Placeholder |
| Privacy settings: consent record, download my data, reports I've made, delete my account (required by POPIA) | `/account/privacy` | Missing |
| Saved listings, and followed sellers once accounts exist | `/saved` | Placeholder |
| Header: "Sign in" when signed out, and an inbox icon with an unread count | shell | Missing |

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
| Admin: seller approvals, reports queue, hide a listing or pause an account, Verified badge, Featured pins, pickup points, audit log | `/admin/*` | Missing |
| Hub post editor and the office-hours queue | `/hub/new`, `/hub/manage` | Missing |
| Mentor dashboard, seller detail, notes, check-ins, CSV export | `/mentor/*` | Missing; can follow launch |

**Totals:** about 45 screens and views. 2 are built, 2 are being designed, and 41 are placeholders or missing. Most of the missing ones are the signed-in half of the product.

## 6. Work that isn't a screen

### Backend
- [ ] Supabase project: schema, access rules, photo storage, seed data (campuses, categories, real pickup points).
- [ ] Replace the sample fixtures with real queries behind `lib/data`, which is already shaped for this.
- [ ] A proper email sending service for sign-in codes. Supabase's built-in email is heavily rate-limited.
- [ ] Scheduled jobs: the nightly Featured draw, recalculating trust badges, and confirming sales automatically after 7 days.

### POPIA and legal (Eduvos signs these off)
- [ ] Final privacy policy, with a named Information Officer.
- [ ] Terms of use and seller guidelines.
- [ ] How consent is recorded.
- [ ] The data export and deletion flows.
- [ ] Where the data is hosted. The old demo ran in Ireland; sending data abroad needs adequate safeguards (section 72).

### Content
- [ ] Real photos.
- [ ] Eduvos fonts and the licence.
- [ ] The official crest SVG.
- [ ] Real pickup points for each campus.
- [ ] Real Hub events.
- [ ] Remove every sample listing and the development sign-in switch.

### Production
- [ ] A domain and hosting.
- [ ] Security headers.
- [ ] robots.txt and a sitemap.
- [ ] Share images for WhatsApp.
- [ ] Error monitoring.
- [ ] Backups.
- [ ] A decision on analytics: none, or a privacy-friendly one.

### Quality
- [ ] End-to-end, accessibility and per-page speed tests for every new flow.
- [ ] LCP checked again with real photos (decision 34).
- [ ] A test on a cheap Android phone.

### Launch
- [ ] A support contact.
- [ ] Enough sellers listed before day one, so it doesn't open empty.
- [ ] Possibly a pilot on one campus.

## 7. Decisions for Lama and Eduvos

- [ ] **Who can sell?** Any signed-in student, or only sellers the Hub has approved? An approval queue suits a hustle selling braids but is heavy for one textbook. This choice shapes onboarding and the admin tools.
- [ ] **Which email proves someone is a student?** The demo's `@vossie.net` was a stand-in.
- [ ] **Who moderates reports and approvals,** and how fast do they respond?
- [ ] **In-app messages, a WhatsApp handoff, or both?** And do new messages send an email?
- [ ] **Do Looking For and the Hub go live on day one?** If not, their homepage sections are hidden.
- [ ] **All 13 campuses at once, or a pilot campus first?**

## 8. Suggested order

1. **Now:** browse and listing pages.
2. **The other public pages:** storefront, Saved, collections, the Looking For board and Hub to read, info and legal pages, and the error page.
3. **Supabase, sign-in, and account and privacy.**
4. **Selling:** onboarding, listing form and dashboard, plus the minimum admin (approvals and moderation).
5. **Messaging:** composer, inbox, conversations, reports and notifications.
6. **Launch readiness:** legal sign-off, domain, monitoring, content, and the pilot.

**After launch:** mentor tools, Hub posting, follows, saved-search alerts, and delivery between campuses.
