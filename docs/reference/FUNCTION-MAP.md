# Vossie Market Place - Function Map and Rebuild Blueprint

Companion to `LIVE-INVENTORY.md`. That file records what the live build looks like and what is wrong with it. This file lists **everything the product does**, so it can be rebuilt with a more creative, Awwwards-level design without losing any behaviour.

Source build: https://vossie-market-place.vercel.app (non-production rehearsal environment), mapped 2026-10-02 to 2026-10-06.

## How to read this

Every function carries an evidence tag:

| Tag | Meaning |
|---|---|
| **SEEN** | Observed working in the browser (logged out, or as the demo Mentor) |
| **CODE** | Read from the JavaScript the site serves publicly (labels, copy, limits, server action names), or from the site's own rules pages. The screen itself was not opened |
| **INFERRED** | Implied by copy, data or naming; needs confirming with the team or the source code |

**Coverage gap.** The seller dashboard, seller enquiries, message threads and the admin console were not opened. Signing in with the demo accounts was blocked by the safety system on this machine. Those sections are built from CODE and INFERRED evidence. The fastest way to close the gap is the source repo, or screenshots taken by someone signed in as Seller and Admin.

---

## 1. Product in one paragraph

Vossie is an **enquiry-based campus marketplace** for Eduvos students, run by the Eduvos Incubation Hub.

- **Selling.** Students list **products or services** priced in rand, and can accept **cash, swaps, or both**.
- **Buying.** Buyers discover listings by campus, category and search, then **message the seller in-app** or **hand off to WhatsApp**. Payment and handover happen offline at **approved campus pickup points**. There is no cart, checkout or online payment.
- **Trust.** Trust comes from **system-computed badges** based on response rate and buyer-confirmed sales (not star ratings), plus a **Verified** badge granted by the Hub.
- **Support.** Mentors track assigned sellers' health. The Hub publishes tips, events and office hours.
- **Platform.** POPIA self-service, a low-data mode and a PWA shell are built in.

---

## 2. Roles and permissions

| Capability | Visitor (logged out) | Student (signed in) | Seller (pending) | Seller (approved) | Mentor | Admin |
|---|---|---|---|---|---|---|
| Browse home, search, filter, listing and seller pages, Hub Growth, info pages | Yes (SEEN) | Yes | Yes | Yes | Yes | Yes |
| Save listings, follow sellers | Redirect to sign-in (SEEN) | Yes (SEEN) | Yes | Yes | Yes (SEEN) | Yes |
| Message seller, propose swap | Redirect to sign-in, then reopens composer (SEEN) | Yes (SEEN, not sent) | Yes | Yes | Yes | Yes |
| WhatsApp handoff | Redirect to sign-in (SEEN) | Yes | Yes | Yes | Yes | Yes |
| Report listing or profile | INFERRED: sign-in needed | Yes (SEEN, not sent) | Yes | Yes | Yes | Yes |
| RSVP event, request office-hours slot | "Sign in to RSVP" (SEEN) | Yes | Yes | Yes | Yes (SEEN) | Yes |
| Notifications bell (realtime) | No | Yes | Yes | Yes | Yes (SEEN) | Yes |
| Privacy settings (export, delete) | No | Yes (SEEN as Mentor) | Yes | Yes | Yes | Yes |
| Become a seller (onboarding wizard) | No | Yes (SEEN step 1) | n/a | n/a | Yes (SEEN) | INFERRED |
| Seller dashboard, my listings, create/edit listing, enquiries | No | No (redirect to onboarding) (SEEN) | Partial: dashboard shows "waiting for approval" (CODE) | Yes (CODE) | No | INFERRED |
| Listings visible to buyers | n/a | n/a | Should be No per rules; see defect D3 | Yes | n/a | n/a |
| Mentor view, seller detail, notes, check-ins, CSV | No | No | No | No | Yes (SEEN) | INFERRED: yes |
| Create / manage Hub posts, see office-hours queue | No | No | No | No | Yes (SEEN) | INFERRED: yes |
| Admin console (`/admin`) | Redirect to sign-in (SEEN) | INFERRED: 404 | INFERRED: 404 | INFERRED: 404 | 404 (SEEN) | Yes (INFERRED contents) |
| Approve sellers, grant Verified, moderate reports, hide listings, pause accounts, pin featured slots, approve pickup points, audit log | No | No | No | No | No | INFERRED from copy |

---

## 3. Sitemap (current routes)

```
/                         Home (public)
/browse                   Search + filters + sort + load more (public)
/l/[listingId]            Listing detail (public; actions need sign-in)
/s/[sellerSlug]           Seller storefront (public)
/go/whatsapp/[slug]       WhatsApp handoff redirect (signed in)
/login                    Email one-time-code sign-in (+ demo switcher)
/messages                 Inbox (signed in)
/messages/[id]            Thread (INFERRED route; not seen)
/saved                    Saved listings | Followed sellers (signed in)
/looking-for              STUB: "Coming in Phase 6"
/account                  Account summary (signed in)
/settings/privacy         POPIA: consent, export, reports, delete (signed in)
/sell                     Non-seller: pitch page. Seller: dashboard (CODE)
/sell/onboarding          5-step seller wizard
/sell/listings            My listings (seller)
/sell/listings/new        Create listing (seller)
/sell/listings/[id]/edit  Edit listing (INFERRED route; form has "Save changes")
/sell/enquiries           Seller enquiries (seller)
/mentor                   Mentor dashboard
/mentor/[sellerId]        Mentor seller detail
/mentor/export            CSV download
/growth                   Hub Growth corner (public)
/growth/[postId]          Post detail (public; RSVP/booking need sign-in)
/growth/new               Create post (mentor/admin)
/growth/manage            Manage posts + office-hours queue (mentor/admin)
/admin                    Admin console (admin only; contents unseen)
/how-trust-works          Badge rules (public)
/how-featured-works       Featured algorithm (public)
/seller-guidelines        Seller rules (public)
/privacy                  POPIA privacy policy (public, draft)
/offline                  PWA offline fallback
404                       Branded not-found page
```

---

## 4. Global shell

| # | Function | Details | Evidence |
|---|---|---|---|
| G1 | Header (desktop) | Wordmark + Eduvos logo; links Home, Browse, Messages, Saved, Looking For, Account; notifications bell (signed in only); theme toggle; Data saver pill | SEEN |
| G2 | Bottom tab bar (mobile) | Home, Browse, Messages, Saved, Account (icons + labels). Looking For and Hub Growth absent | SEEN |
| G3 | Unread messages badge | Live count via Supabase realtime channel `msgbadge-*`; hidden at 0 | CODE |
| G4 | Notifications dropdown | Bell with unread count (`aria-label` "Notifications, N unread"). Opens a panel with the latest 20, unread highlighted, relative times. Click marks one read (`read_at`); "Mark all read". Live updates via realtime channel `notif-*`. Closes on Esc and on outside click | SEEN + CODE |
| G5 | Theme | 3 options: "Match my device" (follows OS, default), "Always light", "Dark mode". Cookie `vossie_theme`; `<html data-theme>` | SEEN + CODE |
| G6 | Low-data mode | "Smaller photos, a simple list, no animations, and photos below the fold load only when you tap." Server action `setLowData`, cookie `vossie_lowdata`. Images use quality 35 and "Load photo: <alt>" tap-to-load buttons | SEEN + CODE |
| G7 | Welcome tour | First sign-in (`profiles.onboarding_seen` false): 4-slide modal ("Welcome to Vossie", "Browse local", "Enquire safely", "Start selling"), dots, Skip / Next / "Let's go", Esc closes; sets `onboarding_seen` | CODE |
| G8 | Footer | Wordmark, tagline, Eduvos logo, links: Hub Growth, How trust works, Privacy | SEEN |
| G9 | PWA | Manifest (standalone, maskable icon), service worker (app-shell cache, network-first navigation, `/offline` fallback), theme-color light/dark | SEEN |
| G10 | Skip link, focus ring, reduced motion | "Skip to content"; 3px royal focus ring; tours respect `prefers-reduced-motion` | SEEN + CODE |
| G11 | 404 | "We couldn't find that page. The link may be old, or the seller or listing may no longer be available." + Back to home | SEEN |
| G12 | Offline page | "You're offline" | SEEN (exists) |
| G13 | Time and locale | All times in Africa/Johannesburg, `en-ZA`; short times "now / 5m / 3h / Yesterday / 12 Oct" | CODE |

---

## 5. Functions by area

### A. Identity and access

| # | Function | Details | Evidence |
|---|---|---|---|
| A1 | Sign in / sign up (single flow) | Step 1: "Eduvos email" (hint "Student number @vossie.net, or your @eduvos.com staff email", placeholder `20250123@vossie.net`) + required POPIA consent checkbox linking the privacy policy, then "Email me a sign-in code" (`sendCode`). Step 2: "We sent a code to …", "Sign-in code" field (`autocomplete=one-time-code`), "Use a different email" (`verifyCode`). No passwords, no social login | SEEN + CODE |
| A2 | Eduvos-only restriction | Promised in copy and policy; no client-side domain check; server rule unverified | INFERRED |
| A3 | Return to intent | `?next=` on every gated redirect; Message adds `compose=1` so the composer reopens after sign-in | SEEN |
| A4 | Route protection | 307 to `/login?next=` for account, seller, mentor, admin and handoff routes | SEEN |
| A5 | Demo account switcher | One-click `demoLogin` for 6 seeded personas (2 sellers, new student, pending seller, Admin, Mentor), shown when a server flag is on. Rehearsal tool | SEEN + CODE |
| A6 | Consent record | Timestamp + policy version stored; shown on privacy settings ("accepted … on 29 September 2026 at 21:13. Current policy is version 2026-10") | SEEN |
| A7 | Sign out | Button on Account | SEEN (not clicked) |
| A8 | Account summary | Signed in as, Role, Seller status; links: Start selling, Mentor view (role-based), Hub Growth corner, Privacy settings | SEEN |

### B. Discovery

| # | Function | Details | Evidence |
|---|---|---|---|
| B1 | Home hero search | "Try braids, logo, kota…" submits to `/browse?q=` | SEEN |
| B2 | Campus scoping | Chips All / Durban / Midrand (`?campus=`), with `aria-current` on the active chip; filters Featured and New this week | SEEN |
| B3 | Featured Hustles | 4 slots per campus per day (8 on "All"), seller cards with cover, name, Verified tick, tagline, "Category · Campus"; "How we pick" link | SEEN |
| B4 | Featured algorithm | Nightly at 02:05 SAST. Eligible = approved seller with ≥1 available listing. Excluded if featured in last 7 days. Weighted lottery by 14-day listing views (0 views = 1.0, 10 = 0.5, 30 = 0.25). Weight doubled for 14 days after approval. Staff can pin slots (reduces drawn slots). Daily line-up stored | CODE (rules page) |
| B5 | New this week | Horizontal row of the newest listing cards; "See all" goes to `/browse` | SEEN |
| B6 | Shop by category | 10 categories: Food, Beauty, Tutoring, Design, Tech, Fashion, Construction, Trading, Events, Other; tiles link to `/browse?category=` | SEEN |
| B7 | Looking For teaser | Band "Can't find it? Ask for it." with a "Looking For (coming soon)" button | SEEN |
| B8 | Search | Typo-tolerant ("brads" finds braids); matches listing text, not seller names; "Results for '…'" heading; Best match sort appears with a query | SEEN |
| B9 | Filters | Category, Campus, Type (Products and services / Products / Services), Payment (Any / Accepts cash / Accepts swaps / Cash or swap), Price min-max (rand), Available only (default on). Desktop: left rail. Mobile: "Filters" bottom sheet (`aria-modal`). Applied with "Show results"; "Clear" | SEEN |
| B10 | Active filter chips | Removable chips ("Tutoring ×") | SEEN |
| B11 | Sort | Newest, Price low to high, Price high to low (+ Best match with a query) | SEEN |
| B12 | Result count + pagination | "Showing 24 of 29 listings"; "Load more" link (`?n=2`), keeps scroll | SEEN |
| B13 | Empty results | "No matches. Try another category or fewer filters, or tell campus sellers what you need with a Looking For request." + Clear filters + Post a Looking For request | SEEN |
| B14 | Listing card | Cover image (or "No photo yet"), Save heart, title, price ("R120", "From R450", "From R800 or swap", "Swap"), swap terms, seller name + Verified, trust badge pill, reply-time band, campus | SEEN |
| B15 | Seller card (featured) | Cover/avatar, Featured tag, name, Verified, tagline, category and campus | SEEN |

### C. Listing detail (`/l/[id]`)

| # | Function | Details | Evidence |
|---|---|---|---|
| C1 | Breadcrumb | Browse / Category | SEEN |
| C2 | Photo gallery | Cover + more photos, "Previous photo" / "Next photo" / "Show N", "No photo yet" fallback, alt text from seller | CODE (seed data has 1 photo) |
| C3 | Core info | Title, price (incl. "From"), swap callout "Happy to swap for: …", facts table: Type, Category, Campus, Pickup point (products) or Delivery "On campus or online" (services) | SEEN |
| C4 | Description + tags | Free text (line breaks kept); up to 5 tag links | SEEN |
| C5 | Save | Heart toggle (`toggleSave`); optimistic, rolls back on failure with "Couldn't update. Try again." | SEEN + CODE |
| C6 | Message on Vossie | Modal composer (see F1) | SEEN |
| C7 | Chat on WhatsApp | Only if the seller added a number; via `/go/whatsapp/[slug]?listing=` (counts handoffs, hides the number) | SEEN |
| C8 | Share | Native share sheet; fallback copies the link ("Link copied"); error "Couldn't share. Copy the link from your address bar." | CODE |
| C9 | Report this listing | Modal: 7 reasons (Scam or fraud; Prohibited item; Offensive content; Harassment; Fake profile; Wrong category or spam; Something else), optional detail (500), "Send report", then "Thanks for telling us" (`submitReport`, targetType listing/profile) | SEEN + CODE |
| C10 | Seller card | Avatar, name, Verified line, trust badge, reply-time band, tagline, Follow toggle | SEEN |
| C11 | More from seller | Up to 3 more listing cards | SEEN |

### D. Seller storefront (`/s/[slug]`)

| # | Function | Details | Evidence |
|---|---|---|---|
| D1 | Header | Avatar (photo or initial), business name, tagline, pills: Verified Incubation Hub member, Category, Campus, "Member since <Month Year>"; trust badge + "How trust works"; reply-time band; Follow | SEEN |
| D2 | Contact | Message on Vossie (default text "Hi! Are you taking orders at the moment?"), Chat on WhatsApp (if set) | SEEN + CODE |
| D3 | Report this profile | Same report modal, targetType profile | SEEN |
| D4 | About | Seller bio | SEEN |
| D5 | Listings | Grid of the seller's listings | SEEN |

### E. Saved and following

| # | Function | Details | Evidence |
|---|---|---|---|
| E1 | Saved page | Tabs: "Listings (n)" and "Sellers (n)"; empty state "Nothing saved yet. Tap the heart on any listing to keep it here for later." + Browse hustles | SEEN |
| E2 | Follow seller | `toggleFollow`, optimistic; followed sellers listed under Saved > Sellers | SEEN + CODE |
| E3 | Follower notifications | Probably notify followers of new listings | INFERRED |

### F. Messaging and enquiries

| # | Function | Details | Evidence |
|---|---|---|---|
| F1 | Composer modal | Title "Message <seller>"; prefilled "Hi! Is <listing> still available?"; 1000-char limit with counter; safety line "Meet at a campus pickup point and never pay a deposit before you have seen the item."; "Send message" (`startConversation`); reuses an existing conversation if one exists | SEEN + CODE |
| F2 | Propose a swap | If the listing accepts swaps: "Propose a swap". Pick "Offer one of my listings" (select from own listings) or "Or type an offer" (200 chars, e.g. "A logo for your poster, or R50 airtime"); "Remove swap offer" | CODE |
| F3 | Live scam tips | As you type, `detectRisk` shows a status tip. Payment words: "Safety tip: never pay a deposit or send money before you have met and seen the item or service. Pay on collection at a campus pickup point." Bank words: "Safety tip: be careful sharing bank details, card numbers or one-time PINs in chat. Vossie will never ask for them." | CODE |
| F4 | Inbox | `/messages` "Your enquiries with buyers and sellers"; empty state "No messages yet. When you message a seller, or a buyer messages you, the conversation shows up here." + Browse hustles | SEEN |
| F5 | Thread | Day separators, 24h times, links auto-linked, photos in messages (per privacy policy), read state; mentors can never read content | CODE + INFERRED |
| F6 | Enquiry lifecycle | Each conversation about a listing is an enquiry. 48-hour reply window counts toward response rate. Seller marks it **completed** and says whether the sale or swap happened; buyer gets a **one-tap confirm** prompt; **auto-confirms after 7 days**; buyer can say it didn't happen | CODE (rules page + `AUTO_CONFIRM_DAYS = 7`) |
| F7 | WhatsApp handoff | Counted separately ("+ 2 WhatsApp"), excluded from response rate | SEEN |
| F8 | Reply-time band | First-reply time over 30 days, shown after ≥3 enquiries: "Usually replies within an hour / a few hours / a day", "Replies slowly" | CODE (rules page) |

### G. Selling

| # | Function | Details | Evidence |
|---|---|---|---|
| G-1 | Sell pitch page (non-seller) | "Sell on Vossie. Turn your hustle into a campus-wide business." 4 benefits + "Become a seller" | SEEN |
| G-2 | Onboarding wizard | "Become a seller. Five quick steps. It takes about 3 minutes." Progress "Step n of 5", autosaves each step, Back / Next | SEEN step 1 + CODE |
| G-2.1 | Step 1 Business basics | Business name (2-60, "Must be unique on your campus"), Category (required), Tagline (optional, 80) | SEEN |
| G-2.2 | Step 2 About you | "About your hustle" (bio); profile photo likely here | CODE + INFERRED |
| G-2.3 | Step 3 How buyers reach you | WhatsApp number (optional; enables WhatsApp button) | CODE |
| G-2.4 | Step 4 Campus and pickup points | Campus + choose approved pickup points | CODE |
| G-2.5 | Step 5 Review and submit | Summary + "I agree to the seller guidelines" (link opens in new tab), then submit for approval | CODE |
| G-3 | Approval | Status "waiting for approval" until the Hub approves; approval grants listing visibility and featured eligibility; Verified badge granted separately | CODE + INFERRED |
| G-4 | Seller dashboard (`/sell`) | Sections tagged for the tour: **status** (pending or live), **listings**, **public profile** ("Keep your photo, bio and pickup points fresh") | CODE |
| G-5 | Seller dashboard tour | 3 steps ("1. Your status", "2. Your listings", "3. Your public profile"), highlights each section, Skip / Next / "Let's go", sets `seller_tour_seen` | CODE |
| G-6 | My listings (`/sell/listings`) | Per listing: Availability select (Available / Sold out / Paused) via `setAvailability`; Edit; Delete with confirm "Delete this listing? Buyers will no longer see it." Yes, delete / Keep (`deleteListing`) | CODE |
| G-7 | Listing form (create / edit) | See G-7 field list below. "Publish listing" (new) / "Save changes" (edit) / Cancel; "Saving…"; "Please fix the highlighted fields." (`saveListing`) | CODE |
| G-8 | Seller enquiries (`/sell/enquiries`) | List of enquiries with status; mark completed and record outcome (feeds F6) | INFERRED |
| G-9 | Edit seller profile | Same fields as onboarding + "Your profile link" (slug, changeable once: "You've already changed your link once.") | CODE |
| G-10 | Seller stats | Mentors see views, enquiries, WhatsApp handoffs and confirmed sales per seller; unknown whether sellers see their own | INFERRED |

**G-7 listing form fields**

| Field | Rules |
|---|---|
| What are you listing? | Product or Service |
| Title | ≤70 characters; placeholder e.g. "Chicken kota with atchar" |
| Description | "What's included, sizes, how long it takes. Line breaks are kept." |
| Category | One of 10, required |
| How do you want to be paid? | Cash, Swap, or Cash or swap |
| Price (rand) | Numeric. Services can tick a "From" price |
| What I'd swap for | ≤200 characters, e.g. "a logo design, 1GB data, laptop help". Shown when swaps are accepted |
| Pickup point | "Handover pickup point" (products) or "Pickup point (optional)" (services). Chosen from approved campus pickup points |
| Delivery (services) | "Delivered on campus or online" |
| Photos | "The first photo is your cover. Drag to reorder, or use the arrow buttons. We shrink photos and strip location data automatically." Per photo: "Describe this photo" (alt text), Remove, reorder. JPG / PNG / WebP up to 25MB, compressed in the browser to WebP. Errors: "Use a JPG, PNG or WebP photo", "That file is over 25 MB", "This image is too large to compress. Try a smaller photo.", "Upload failed. Check your connection." |
| Tags | Up to 5, 2-30 characters each, Enter to add, suggestions dropdown, "Up to 5 words that help buyers find you, e.g. braids, lunch, logo." |
| Availability | Available, Sold out, "Paused (not taking orders for now)" |

### H. Trust and safety

| # | Function | Details | Evidence |
|---|---|---|---|
| H1 | Trust badges | Highest fully-met badge shown, recalculated on every enquiry change and nightly, can go down. Rules: see section 6 | SEEN + CODE |
| H2 | Verified Incubation Hub member | Granted by the Hub team; required for Top Hustler | SEEN + CODE |
| H3 | How trust works page | Badges, what counts, reply times, disclaimer | SEEN |
| H4 | Seller guidelines page | 7 rules (honesty, safety, legal, respect, fair rand pricing, POPIA, moderation and appeals) | SEEN |
| H5 | Reports | Listing and profile reports (C9, D3); "Reports I've made" on privacy settings | SEEN |
| H6 | Moderation | Hub can hide listings or pause accounts; appeal by contacting the team | CODE (guidelines) + INFERRED UI |
| H7 | Safety copy in context | Composer safety line, risk tips, welcome tour "Enquire safely", pickup points | SEEN + CODE |
| H8 | Pickup points | Approved per campus; sellers choose from them; shown on listings | SEEN + CODE |

### I. Notifications

| # | Function | Details | Evidence |
|---|---|---|---|
| I1 | In-app notifications | Title, body, time, read state; realtime; mark read / mark all read | SEEN + CODE |
| I2 | Seen types | "New office-hours request" (to mentors) | SEEN |
| I3 | Likely types | New message, enquiry reply, sale-confirm prompt, seller approved/rejected, listing hidden, report outcome, RSVP reminders, followed seller's new listing | INFERRED |
| I4 | Email | Only the sign-in code is confirmed by email; no notification emails confirmed | INFERRED |

### J. Hub Growth corner

| # | Function | Details | Evidence |
|---|---|---|---|
| J1 | Feed | `/growth`: type filter (All, Tips, Events, Office hours), campus filter (All, Durban, Midrand), cards with type cover, title, date and time, place, campus, "2 going · 80 places" | SEEN |
| J2 | Tip post | Title + markdown body | SEEN |
| J3 | Event post | Date, place, capacity, RSVP toggle "You're going ✓ (tap to cancel)"; logged out: "Sign in to RSVP" | SEEN |
| J4 | Office hours post | Description + "Book a slot: What would you like help with? (and a time that suits you)" + "Request a slot"; requests notify the mentor | SEEN |
| J5 | Create post (`/growth/new`) | Type (Tip or article / Incubation Hub event / Mentor office hours), Title (required), Body (markdown subset: `## Heading`, `**bold**`, `*italic*`, bullets, numbers, links; 4000 chars), Campus, Cover image (optional, compressed), Published checkbox (untick for draft), Publish | SEEN |
| J6 | Manage (`/growth/manage`) | "Office-hours requests (n)" queue (accept or decline INFERRED) + "Your posts" list; Edit post on own posts | SEEN |

### K. Mentor tools

| # | Function | Details | Evidence |
|---|---|---|---|
| K1 | Mentor dashboard | "Your assigned sellers. Read-only: you see activity numbers, never message content." Summary "1 of 9 sellers may need support". Per seller: name, Verified, campus, last active, badge, Enquiries (30d) + WhatsApp, Response rate, Confirmed sales, Listing views (30d), flags (e.g. "No enquiries in 14 days") | SEEN |
| K2 | Export CSV | `/mentor/export` | SEEN (not downloaded) |
| K3 | Seller detail | "May need support" alert with reasons; tiles: In-app enquiries (30d), WhatsApp handoffs (30d), Response rate, Reply time, Confirmed sales, Listing views (30d), Last active; recent listings with status and updated time; link to public profile | SEEN |
| K4 | Private notes | "Only you (and admins) can see these. The seller cannot." Add note | SEEN |
| K5 | Check-ins | "Log each time you catch up with this seller." Log a check-in | SEEN |
| K6 | Assignment | Mentors see only assigned sellers; assignment is presumably managed by admin | INFERRED |

### L. Admin console (`/admin`, contents unseen)

Everything below is INFERRED from public copy (featured rules, guidelines, privacy policy, mentor notes, login personas):

- Seller applications queue: approve or reject; this is the "seller waiting for approval" state.
- Grant or revoke the Verified badge.
- Reports queue: review, hide listing, pause account, resolve, appeal handling.
- Featured slots: view daily line-ups, pin a slot.
- Pickup points: create or approve per campus.
- Mentor assignment to sellers.
- Admin audit log ("Reports and the admin audit log are kept for safety and accountability").
- Possibly: campuses and categories management, Hub post management, user lookup.

### M. Privacy and POPIA

| # | Function | Details | Evidence |
|---|---|---|---|
| M1 | Privacy policy | Plain-language POPIA policy (who we are, what we collect and why, who can see it, retention, rights, Information Officer contact). Currently marked as a Hack Jam draft | SEEN |
| M2 | Consent | Captured at sign-in; record and policy version shown | SEEN |
| M3 | Download my data | JSON: profile, seller details and listings, messages sent, enquiries, reports, saved and followed | SEEN (not run) |
| M4 | Reports I've made | List of own reports | SEEN |
| M5 | Delete my account | Type DELETE to confirm. Name, email, photos and WhatsApp removed immediately; seller profile and listings hidden; saved items cleared; sent messages remain as "Deleted user"; sign-in removed after 30 days | SEEN (not run) |
| M6 | Photo privacy | Location data stripped from uploaded photos | CODE |
| M7 | Anonymous view counting | One listing view per visitor per day via an anonymous random cookie; no ad trackers | SEEN (policy) |

### N. Looking For (planned)

| # | Function | Details | Evidence |
|---|---|---|---|
| N1 | Request board | "Post what you need and let campus hustlers respond." Currently a stub ("Coming in Phase 6") but linked from nav, home and browse empty state | SEEN |

---

## 6. Business rules reference

| Rule | Value |
|---|---|
| Badge: New seller | Default |
| Badge: Responsive | ≥3 enquiries in 90 days and ≥80% replied within 48h |
| Badge: Trusted | ≥3 enquiries in 90 days, ≥85% replied within 48h, ≥5 buyer-confirmed sales/swaps, account ≥30 days |
| Badge: Top Hustler | ≥3 enquiries in 90 days, ≥90% replied within 48h, ≥15 confirmed sales/swaps, account ≥90 days, Verified |
| Response window | 48 hours; open windows don't count against the seller; WhatsApp leads excluded |
| Sale confirmation | Seller marks completed, buyer confirms; auto-confirm after 7 days; "didn't happen" doesn't count |
| Reply-time band | First-reply time over 30 days; shown after ≥3 enquiries; 4 bands |
| Featured | 4 slots per campus per day at 02:05 SAST; approved + ≥1 available listing; 7-day cooldown; view-weighted lottery (0 views = 1.0, 10 = 0.5, 30 = 0.25); 2x weight for 14 days after approval; staff pins |
| Mentor flag | "No enquiries in 14 days" (others likely) |
| Message length | 1000 characters |
| Swap offer text | 200 characters |
| Report detail | 500 characters |
| Hub post body | 4000 characters, markdown subset |
| Business name | 2-60 characters, unique per campus |
| Tagline | ≤80 characters |
| Listing title | ≤70 characters |
| Tags | ≤5, 2-30 characters each |
| Photos | JPG / PNG / WebP ≤25MB, compressed to WebP, location data stripped, first is cover |
| Profile link (slug) | Can be changed once |
| Account deletion | Personal data immediately; sign-in after 30 days |
| Campuses | Eduvos Durban, Eduvos Midrand |
| Categories | Food, Beauty, Tutoring, Design, Tech, Fashion, Construction, Trading, Events, Other |
| Payment modes | Cash, Swap, Cash or swap |
| Availability | Available, Paused, Sold out |

---

## 7. Inferred data model

Entity names are guesses where marked. Fields seen in code or URLs are listed.

| Entity | Key fields |
|---|---|
| `profiles` | id, email, name, role (student / mentor / admin), campus, consent_at, consent_version, onboarding_seen (CODE), seller_tour_seen (CODE), last_active_at |
| `sellers` | profile_id, business_name, slug (+ changed_once), category_id, tagline, bio, avatar_path (`avatars/<user>/profile.webp`), whatsapp_number, campus_id, status (pending / approved / paused), verified, badge, reply_band, member_since, approved_at |
| `campuses` | id, name |
| `pickup_points` | id, campus_id, name (e.g. "Library entrance"), approved |
| `seller_pickup_points` | seller_id, pickup_point_id |
| `categories` | id, name, emoji |
| `listings` | id, seller_id, kind (product / service), title, description, category_id, price_zar (CODE `priceZar`), price_is_from (CODE `priceIsFrom`), pay_mode (cash / swap / both), swap_for (CODE `swapFor`), pickup_point_id (CODE `pickupPointId`), delivery (services), tags[], availability (available / paused / sold_out), hidden_by_admin, created_at, updated_at |
| `listing_images` | listing_id, path (`listing-images/<user>/<listing>/<n>.webp`), alt, position |
| `listing_views` | listing_id, anon_visitor_id, day |
| `saved_listings` | profile_id, listing_id |
| `follows` | follower_id, seller_id |
| `conversations` (enquiries) | id, buyer_id, seller_id, listing_id, swap_offer_listing_id, swap_offer_text, status (open / replied / completed), outcome (sold / swapped / not), buyer_confirmation (confirmed / denied / auto), first_reply_at, completed_at |
| `messages` | conversation_id, sender_id, body (≤1000), photo_path, created_at, read_at |
| `whatsapp_handoffs` | seller_id, listing_id, profile_id, created_at |
| `notifications` | user_id (CODE), title, body, link, read_at (CODE), created_at |
| `reports` | reporter_id, target_type (listing / profile; CODE `targetType`), target_id, reason (7-value enum), note, status, resolved_by |
| `featured_slots` | campus_id, date, seller_id, pinned, pinned_by |
| `growth_posts` | type (tip / event / office_hours), title, body_md, campus_id (nullable = all), cover_path, published, starts_at, location, capacity, author_id |
| `rsvps` | post_id, profile_id |
| `office_hour_requests` | post_id, requester_id, message, status |
| `mentor_assignments` | mentor_id, seller_id |
| `mentor_notes` | mentor_id, seller_id, body |
| `mentor_checkins` | mentor_id, seller_id, note, created_at |
| `audit_log` | actor_id, action, target, created_at |
| `looking_for_requests` (planned) | requester_id, title, category, campus, budget, status |

---

## 8. Server actions and integrations

| Kind | Items |
|---|---|
| Next.js server actions (CODE) | `sendCode`, `verifyCode`, `demoLogin`, `toggleSave`, `toggleFollow`, `startConversation`, `submitReport`, `saveListing`, `setAvailability`, `deleteListing`, `setLowData` |
| Other actions (INFERRED, names unknown) | Onboarding step save and submit, seller profile edit, send message, mark enquiry completed, confirm or deny sale, RSVP toggle, request office-hours slot, create/edit post, add note, log check-in, mark notifications read (done client-side via Supabase), export data, delete account, admin actions |
| Supabase | Auth (email OTP), Postgres via PostgREST (some direct client queries: `profiles`, `notifications`, unread count), Realtime (notifications, message badge), Storage (`avatars`, `listing-images`, Hub covers), region Ireland |
| Scheduled jobs | Nightly featured draw (02:05 SAST); nightly badge recalculation; 7-day auto-confirm; possibly enquiry-window processing |
| Redirect routes | `/go/whatsapp/[slug]?listing=` (handoff counter); `/mentor/export` (CSV) |
| Browser | Service worker, Web Share API with clipboard fallback, client-side image compression (large library chunk, about 385KB, loaded only on the listing form) |
| Not present | Payments, analytics, email marketing, push notifications, maps |

---

## 9. Defects and debts to fix in the rebuild

| # | Issue |
|---|---|
| D1 | Demo account switcher reachable on a public URL (fine for rehearsal; must be hard-disabled outside rehearsal environments) |
| D2 | Eduvos-only sign-up not enforced client-side; confirm server rule; decide on the `@vossie.net` student-domain approach |
| D3 | Possible approval-gate gap: a seller labelled "waiting for approval" appears publicly and in Featured |
| D4 | Relative-time bug: "Yesterday ago", "01 Oct ago" (mentor views append "ago" to `shortTime` / `dayLabel` output) |
| D5 | Test data in shared DB: `[automated test]` notifications, duplicate notifications |
| D6 | Demo data decays (badges and KPIs drop as seeded enquiries age); no reseed |
| D7 | Office-hours request count mismatch (bell shows 8 requests, manage queue shows 0) |
| D8 | Office-hours post content vs date mismatch ("Every Thursday 14:00-16:00" dated Sunday 18:33) |
| D9 | "Looking For" stub linked from three places |
| D10 | No "Sign in" entry point logged out; gated redirects give no reason; Save / Message have no loading feedback |
| D11 | Sign-in submit silently disabled until consent |
| D12 | Listing CTAs below the fold on mobile; no sticky action bar |
| D13 | No active nav state; Hub Growth missing from mobile nav |
| D14 | Header logo fetched at 3840px (54KB instead of 9KB); font preloads unused; uncached SSR (~1-1.5s TTFB); per-navigation client auth calls when signed in |
| D15 | No Open Graph, robots.txt, sitemap; missing security headers |
| D16 | Focus ring fails contrast on navy; emoji used as icons; carousels without controls |
| D17 | Search ignores seller names |
| D18 | `/sell/listings*` redirect via streamed 200 + meta refresh instead of a proper 307 |
| D19 | Page title "Seller dashboard" on the non-seller pitch page |

---

## 10. Rebuild scope: keep, rethink, add, cut

### Keep (product logic is strong, carry over 1:1)

- Enquiry-based model with cash / swap / both, pickup points and no online payments.
- Swap proposals, including offering one of your own listings.
- Computed trust badges, reply-time bands, buyer-confirmed sales with 7-day auto-confirm.
- The fair featured lottery and its public explanation.
- Live scam tips in the composer, safety copy, report flow.
- Mentor dashboard, flags, notes, check-ins; Hub Growth with RSVP and office hours.
- POPIA self-service; photo location stripping; anonymous view counting.
- Low-data mode, PWA, theme choice, SAST time handling, accessibility basics.

### Rethink

- **Navigation and IA:** Discover (home), Search, Sell (dashboard or "become a seller"), Inbox, Me. Move Hub Growth into Discover as a "Campus" or "Hub" tab.
- **Logged-out journey:** a clear "Sign in" in the header, plus inline sign-in sheets instead of hard redirects (keep `next` and `compose`).
- **Seller onboarding:** one question per screen with a live storefront preview building as they type.
- **Listing detail:** full-bleed gallery + sticky action dock on mobile.
- **Images:** real photos first; designed fallbacks per category instead of grey boxes and generated text cards.
- **Messages:** make the enquiry status visible (Open, Replied, Completed, Confirmed) for both buyer and seller.

### Add

- Buyer "My enquiries" status view and sale-confirm prompt surface.
- Seller-facing stats (views, enquiries, response rate, confirmed sales), mirroring what mentors see.
- Looking For (reverse marketplace), once the core is solid.
- Saved-search or new-listing alerts by category and campus.
- Seller search by name; category landing pages.
- Open Graph cards for WhatsApp sharing (the main growth loop in SA).

### Cut or hide

- Demo switcher outside rehearsals.
- "Coming in Phase 6" and other internal language in the UI.
- Emoji as UI icons (keep emoji only as playful content, not controls).

---

## 11. Creative direction: Awwwards energy on a South African data budget

> **Update 2026-10-06: brand facts take priority.** The direction below is being revised to use the real Eduvos brand. The palette and fonts in 11.1-11.3 (signwriter yellow and red, Bricolage and Figtree) are superseded until the revision is agreed. Verified Eduvos brand facts (from the logo file the demo ships and eduvos.com):
>
> - **Colours.** Eduvos navy `#15305D` (about 91% of the logo) and Eduvos sky blue `#29ABE2` (the logo tagline). eduvos.com also uses `#28A4DA` (sky hover), `#1E7BA8` (darker sky), `#E1F0F7` (pale sky tint), `#373F41` (body text) and `#F3F3F3` (light grey).
> - **Off-brand in the demo.** Sand `#CFAE7E` and royal `#2352C4` do not appear in the Eduvos logo or on eduvos.com.
> - **Contrast rules.**
>   - Sky on white is 2.6:1: never use it for text, icons or thin borders on white.
>   - Navy on sky is 5.0:1 and sky on navy is 5.0:1: both pass for normal text.
>   - For links on white use `#1E7BA8` (4.7:1).
>   - White on navy is 13:1.
> - **Typefaces.** eduvos.com uses Cocogoose Pro (variable geometric sans) and Larken (serif, used bold and medium italic). Both are commercial fonts; web use for Vossie depends on Eduvos's licence.
> - **Campuses.** 12 physical campuses plus Eduvos Online: Bedfordview, Bloemfontein, Cape Town (Mowbray), Cape Town (Tyger Valley), Durban (Umhlanga), East London, Mbombela (Nelspruit), Midrand, Nelson Mandela Bay (Gqeberha), Potchefstroom, Pretoria, Vanderbijlpark. The demo has only Durban and Midrand.

Awwwards-level sites win on **concept, typography, motion and craft**, not on heavy 3D. Vossie's users are students on prepaid data and budget Android phones, so the direction below gets the "wow" from type, layout, colour and CSS-native motion. WebGL and video stay out of the core experience.

### 11.1 Concept: "Hand-painted Hustle"

- **Source material.** The visual language of South African **signwriters**: hand-painted barbershop boards, spaza and kota-shop menus, taxi-rank signs. Big confident letters, prices painted huge, hard drop shadows, yellow and red on blue and white.
- **Second ingredient.** **Shweshwe**, the indigo printed cotton with fine geometric patterns. Its indigo sits right next to Eduvos navy, so the brand colour becomes a cultural reference rather than a corporate default.
- **Execution.** Built with contemporary editorial craft so it reads as premium and intentional, never as pastiche. Every seller is a storefront sign, every listing a price board, every Hub event a gig poster.
- **Why it fits.** It is unmistakably local, it celebrates informal entrepreneurship (the whole point of Vossie), and it gets its "wow" from type and colour, which cost almost nothing to download.

### 11.2 Design principles

1. **Type is the hero.** Oversized, expressive display type does the work 3D would do elsewhere.
2. **Real faces, real hustles.** Student photography with a consistent duotone or grain treatment; no stock imagery.
3. **Motion with meaning.** Every animation explains a change (filtering, saving, moving between card and detail). Nothing loops just to look busy.
4. **Light by default.** Every effect must be CSS-native or under 10KB of JS, and must switch off in low-data mode and under `prefers-reduced-motion`.
5. **Local voice.** Copy keeps the "kota, res, hustle, in rand" register; microcopy is part of the personality.
6. **Trust is visible.** Badges, Verified stamps and safety cues are designed objects, not small grey pills.

### 11.3 Visual language

| Element | Direction |
|---|---|
| Palette | **Shweshwe indigo** = Eduvos navy `#16305E` (brand, ink, hero bands). **Chalk** `#F3F5FA`, a white with an indigo bias (not cream), for pages. **Signwriter yellow** `#FFC629` for primary actions, prices and highlights (indigo text on yellow 8.3:1). Yellow against chalk is only 1.4:1, so on light pages a yellow button always carries indigo text plus an indigo outline or hard shadow, and yellow is never used as text on chalk. **Brass** = Eduvos sand `#CFAE7E` for Verified seals and premium details. **Signwriter red** `#C8102E` used sparingly for "New" and live states. Dark mode = "after dark": indigo night `#0B1630` with chalk text and yellow accents. Verify against Eduvos brand guidelines before locking |
| Typography | **Bricolage Grotesque** (variable: weight, width, optical size) for display. Its condensed width cut doubles as the signwriter price face ("R45" painted big). **Figtree** for UI and body. Both open-source on Google Fonts; self-host and subset to Latin as variable woff2, ≤60KB total. Drop Playfair Display. Use the variable axes for motion (weight and width shifting on scroll and hover) instead of extra assets |
| Scale | Hero headlines 12-18vw on mobile, tight leading, words that break and wrap deliberately. Prices set huge in the condensed cut with a hard 3-4px yellow or indigo offset shadow, the signwriter signature |
| Grid | 12-column editorial grid on desktop with deliberate grid-breaking: overlapping cards, slightly rotated stickers, oversized numbers. 4-column on mobile with full-bleed moments |
| Texture | Shweshwe-style geometric line pattern generated in CSS (repeating gradients, zero image bytes) at low opacity on indigo bands; hard offset shadows instead of soft blurs; halftone-dot fallbacks for missing photos (CSS only) |
| Imagery | Real photos with a consistent treatment: duotone navy/sand via CSS `mix-blend-mode` or pre-processed at upload; generous cropping; category-coloured frames |
| Iconography | One custom line-icon set (24px grid, 1.75 stroke) drawn for Vossie: kota, scissors, book, laptop, palette, swap arrows. SVG sprite, ≤8KB |
| Badges | Rubber-stamp / sticker style: Verified as a circular embossed seal, trust badges as die-cut stickers with tiny rotation; earned badges animate in once |
| Cards | Poster cards with a "price tag" corner, category colour band, and a hover/tap state that lifts and reveals swap terms |

### 11.4 Motion system

| Moment | Technique | Fallback |
|---|---|---|
| Page and route changes | View Transitions API: listing card image morphs into the detail hero; seller avatar morphs into the storefront header | Instant swap |
| Scroll reveals | CSS scroll-driven animations (`animation-timeline: view()`): headlines slide and shift weight, cards stagger in | Static |
| Hero | Kinetic headline: "Student hustles." stays, the second line cycles through real categories from the database ("Kotas.", "Braids.", "Logos.", "Tutoring.") with a variable-font weight sweep | Static first word |
| Live ticker | A marquee of "just listed" items across the top of Discover (CSS-only, paused on hover and focus, `aria-hidden` with an accessible list behind it) | Hidden in low-data |
| Save | Heart pops with a small sticker burst (CSS keyframes) and the Saved tab count ticks | Simple fill |
| Filters | Results re-flow with FLIP-style transitions; active filter chips drop in like stickers | Instant |
| Badges | First view of a Top Hustler stamp "thunks" onto the card | Static |
| Desktop only | Magnetic buttons and a custom cursor that becomes a price tag over listings, behind `(hover: hover) and (pointer: fine)` | Normal cursor |

Motion is disabled entirely when low-data mode is on or `prefers-reduced-motion` is set; the existing low-data toggle stays.

### 11.5 Signature screens

| Screen | Idea |
|---|---|
| **Discover (home)** | Kinetic signwriter headline on an indigo Shweshwe band; campus switch as a large segmented toggle ("Durban / Midrand / All campuses"); "Today's Featured" as a numbered magazine spread (01-04) with large portraits; "Just listed" ticker; categories as a sticker wall; Hub events as torn-poster cards |
| **Search / Browse** | Sticky search pill that expands into a full-screen sheet with recent and trending searches; results in an asymmetric poster grid; filters as a thumb-friendly bottom sheet with live result count ("Show 12 hustles") |
| **Listing** | Full-bleed photo hero with swipeable gallery; huge price; swap terms as a "trade card"; sticky bottom dock: Message, WhatsApp, Save; seller strip with stamps; safety note designed as a friendly sticker |
| **Seller storefront** | Poster-style header: big business name set across the full width, campus and category as stamps, badge seal, reply-time "speedometer", then the product grid; feels like the seller's own mini brand site |
| **Inbox and thread** | Clean chat with enquiry status as a progress pill (Asked, Replied, Done, Confirmed); scam tips appear as inline yellow sticky notes; swap offers render as trade cards |
| **Become a seller** | Conversational, one question per screen, big type, and a live storefront preview card on the side (desktop) or on a swipe-up sheet (mobile) that fills in as they answer. Ends with a celebratory "You're in the queue" poster |
| **Seller dashboard** | "Today" summary (new enquiries, views, confirmed sales), listing manager with quick availability toggles, approval status as a progress track |
| **Hub Growth** | Event and office-hours posts as gig posters (date set huge), RSVP as a ticket stub that tears on confirm |
| **How trust works** | The four badges as a collectible sticker sheet with the rules on the back (flip cards) |
| **Empty states, 404, offline** | Illustrated campus moments with local humour (e.g. 404: "This hustle packed up early.") |

### 11.6 Technical approach

- **Stack.** Keep Next.js App Router + Supabase + Vercel; Tailwind v4 tokens redesigned (paper, ink, brass, signal; type scale in `clamp()`).
- **Motion stack.** CSS first. No GSAP or Framer Motion in the core bundle; if one is needed for a single hero moment, lazy-load it on desktop only.
- **Images.** Next Image with correct `sizes`, AVIF + WebP, blur placeholders generated at upload, duotone treatment at upload (keeps runtime light).
- **Fonts.** 2 variable fonts max, subset, `font-display: swap`, preload only what the first view uses.
- **Static where possible.** Cache public pages (ISR or `revalidate`) for home, browse, listing and storefront; stream personalised bits.

### 11.7 Performance and access budget

| Budget | Target on a mid-range Android over 3G/4G in SA |
|---|---|
| JS on first load | ≤150KB compressed (current home: 354KB static assets) |
| Fonts | ≤60KB |
| First visit total (home) | ≤350KB (current: about 0.5-0.6MB) |
| LCP | ≤2.5s |
| CLS | ≤0.05 |
| Interaction latency (INP) | ≤200ms |
| Accessibility | WCAG 2.2 AA: focus visible on every surface, 44px targets, `aria-current` nav, captions or labels for all motion, full keyboard support for galleries and sheets |

### 11.8 Inspiration categories to study

On Awwwards, look at Sites of the Day in the **Editorial**, **Fashion**, **Food & Drink** and **E-commerce** categories, and filter for strong typography and scroll-driven storytelling. Study:

- How independent magazines handle oversized type and grid-breaking.
- How streetwear drops handle product cards and "just dropped" tickers.
- How festival sites design posters and tickets.

Then hold every idea against the budget above.

---

## 12. Open questions for the team

1. Is `@vossie.net` the intended student identity, or should sign-in verify real Eduvos student emails?
2. What does the admin console contain today, and who are the admins (Hub staff only)?
3. Should sellers see their own stats, or only mentors?
4. Which campuses launch first, and is the campus list data-driven?
5. Is "Looking For" in scope for the rebuild's first release?
6. Are there Eduvos brand guidelines (colour, logo usage) the creative direction must follow?
7. Will notifications ever go out by email, WhatsApp or push?
8. Who moderates reports, and what's the target response time?
