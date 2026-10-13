# Vossie community pages: design spec

- **Date:** 2026-10-14
- **Status:** Approved under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision below is Claude's recommendation, logged in the decisions log.
- **Scope:** Looking For (`/looking-for`, `/looking-for/[id]`) and the Incubation Hub (`/hub`, `/hub/[id]`), on sample data. This is part B of the "other public pages" stage (decision 48). Part A (storefront, Saved, collections) is `2026-10-13-shopping-pages-design.md`; part C (info, legal and system pages) follows.

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-08-homepage-design.md` | The homepage spec. Its tokens, breakpoints, motion, accessibility and budget rules apply here. Sections 7.11 (Looking For) and 7.13 (What's on, the Hub banner) are the homepage's halves of these pages |
| `docs/superpowers/specs/2026-10-13-shopping-pages-design.md` | Part A. `ListingGrid`, the sign-in links and the page patterns are reused |
| `docs/reference/FUNCTION-MAP.md` | The old demo: the Hub is J1 to J6, Looking For is N1, business rules in section 6 |
| `docs/reference/GO-LIVE.md` | Every page the marketplace needs |

---

## 1. Goal

Make the two community features real to read: students can browse open requests and see what each asks for, and anyone can read the Hub's tips, events and office hours. Posting a request, offering to help, RSVPing and booking a slot need an account, so they lead to the sign-in placeholder, as Message does on a listing.

## 2. Decisions this spec makes

1. **Reading is public, acting needs sign-in.** "Post a request", "Offer to help", "RSVP" and "Request a slot" go to `signInHref(<this page>)`, with no prefetch. The sign-in page's back link already reads "Go back" for these paths.
2. **No names on requests.** A request says "Asked by a student at Midrand", never a name (POPIA: collect and show the minimum). Sellers are businesses and show their names; buyers asking for help are private people.
3. **The board opens on the viewer's campus first, then every other campus,** as the homepage's request list does. There's no campus filter of its own: requests are few, and a student at Pretoria can still help someone online. A category filter (links, `?cat=`) narrows the board.
4. **Requests link to listings that already exist.** A request page shows up to 4 available listings in the same category, the request's campus first, as "Already on Vossie", so a student can find the thing without waiting for offers.
5. **The Hub is one feed of posts.** Tips, events and office hours are one `HubPost` type with a `kind`. The homepage's What's on reads its events from the same posts, so there's one source of truth.
6. **Past events and office hours drop off the feed,** as they do on the homepage. A past event's own page still opens and says "This event has passed".
7. **The Hub feed shows every campus,** each card labelled with its campus, soonest event first. Events are rare enough that filtering by campus would leave most campuses empty. The type filter (links, `?type=`) narrows it.
8. **The Hub page leads with the Hub's story and its Verified sellers.** The placeholder promised them, and the homepage's Hub banner links here with "Our story". The Verified sellers row links to storefronts.
9. **Tip bodies use a small markdown subset** (the old demo's J5): paragraphs, `## ` headings, `- ` bullets, `1. ` numbers, `**bold**`, `*italic*` and `[links](/path)`. They're rendered on the server into React elements, never as raw HTML, and links may only point inside the site.
10. **No new client code.** Both pages are Server Components and links; the type and category filters are links, as browse's tabs are.

---

## 3. Routes and rendering

| Route | Rendering |
|---|---|
| `/looking-for` | The heading is prerendered. The board renders per request inside `<Suspense>`: it reads the campus cookie and `?cat=` |
| `/looking-for/[id]` | Prerendered for every request, `params` awaited inside `<Suspense>`. Unknown ids get the 404 |
| `/hub` | The story and Verified sellers are prerendered. The feed renders per request inside `<Suspense>`: it reads `?type=` and the date (after `await connection()`, as What's on does) |
| `/hub/[id]` | Prerendered for every post. Whether an event has passed is a small request-time part inside its own `<Suspense>` |

---

## 4. Looking For

### 4.1 The board (`/looking-for`)

1. **Heading:** an h1 "Looking For", the lede "Post what you need, and students who can help will offer.", and a **Post a request** button (navy pill) to sign-in.
2. **Category chips:** "All" and the ten categories, as links (`/looking-for?cat=tech`), in a row that scrolls sideways on phones, like browse's tabs. The current one is marked with `aria-current="page"`. Links don't prefetch.
3. **The requests,** open ones only:
   - first "At {campus}" (the viewer's campus), then "Other campuses", each an h2 with a list under it. With "All campuses" chosen (or no choice), one list headed "Open requests".
   - Each row is a link to the request page with: the title (h3), the campus, the category, the budget ("Budget R300", "Budget R300 or a swap", "Open to offers"), the posted date ("Posted 12 Oct", SAST) and the offers count ("2 offers").
4. **Empty states:**
   - no open requests at all, or none in the category: "No requests here yet. Be the first to ask." with Post a request;
   - none at the viewer's campus but some elsewhere: the "At {campus}" list is replaced by "Nothing at {campus} yet." and "Other campuses" follows.
5. **Error:** "We couldn't load requests just now." with a Try again link back to the same address.

### 4.2 A request (`/looking-for/[id]`)

1. **Breadcrumb:** Looking For › {category}.
2. **h1** the title, then a facts list: campus, category, budget, "Needed by 24 Oct" (when set), "Posted 12 Oct", and "Asked by a student at {campus}" (decision 2).
3. **The details** in the asker's words, line breaks kept.
4. **Offers:** "2 offers so far" (or "No offers yet. Be the first."), and an **Offer to help** button (navy pill) to sign-in. A closed request shows "This request is closed" instead, and no button.
5. **Already on Vossie:** an h2 and up to 4 available listings in the request's category, its campus first, in a `ListingGrid` (`"four"`), then "See all in {category}" to `/browse?cat=…`. Hidden when there are none.
6. **Report this request:** a small sky-dark link to sign-in, at the bottom.
7. **Metadata:** the tab title is the request's title; the description is the start of its details. It is indexed (it's public, has no names, and helps sellers find work).

### 4.3 Data

`LookingForRequest` gains:

| Field | Values |
|---|---|
| `details` | Two or three sentences. Line breaks kept |
| `categorySlug` | A known category |
| `budgetZar` | Rand, or `null` for "open to offers" |
| `swapWelcome` | Whether a swap is welcome |
| `neededBy` | `YYYY-MM-DD` (SAST) or `null` |
| `createdAt` | ISO 8601 UTC |
| `status` | `"open"` or `"closed"` |

- About 16 sample requests: every campus but Mbombela has at least one open request (Mbombela tests the empty state), at least one is closed, one has no budget and one welcomes a swap.
- The existing 7 keep their ids, titles, campuses and offers, so the homepage doesn't change.
- **Functions** (`lib/data`): `getRequests` stays as the homepage uses it (open only, campus first); new `getOpenRequests({ category })` (open, newest first), `getRequest(id)`, `getRequestIds()` and `getRelatedListings({ categorySlug, campusSlug, limit })` (available, same category, that campus first, newest first).
- **The homepage:** each request row links to its own page instead of `/looking-for`.

---

## 5. The Incubation Hub

### 5.1 The Hub page (`/hub`)

1. **The story:** the Hub banner's photo (decorative), an h1 "The Incubation Hub", and two short paragraphs: the Eduvos Incubation Hub supports student businesses with mentors, events and office hours, and runs Vossie; it checks sellers and gives them the Verified badge. Sample wording for the Hub to change.
2. **Verified by the Hub:** an h2 and the verified sellers as a row of small cards (round photo, name, campus) linking to their storefronts. It scrolls sideways on phones and wraps on desktop.
3. **The feed:**
   - an h2 "What's on and what's new";
   - type tabs as links: All, Events, Office hours, Tips (`?type=events`, `office-hours`, `tips`), the current one marked;
   - **events and office hours** first, upcoming only (`startsAt` on or after today in SAST), soonest first;
   - then **tips**, newest first.
   - Each card links to the post: the kind as an eyebrow ("Event", "Office hours", "Tip"), the title (h3), and for events and office hours the date and time in SAST ("Wed 14 Oct · 18:00"), the place and the campus ("All campuses" or the name); for events, "12 going · 80 places". Tips show their date and a one-line summary.
   - **Empty states:** "Nothing planned right now. Check back soon." for events and office hours; "No tips yet." for tips.
   - **Error:** "We couldn't load the Hub's posts just now." with a Try again link.

### 5.2 A post (`/hub/[id]`)

1. **Breadcrumb:** The Hub › {kind}.
2. **The cover photo** (decorative), then the kind as an eyebrow, the h1 title.
3. **Events and office hours:** a facts list (date and time in SAST, place, campus, and for events "12 going · 80 places"), then the body. Then:
   - an event: **RSVP** (navy pill) to sign-in;
   - office hours: **Request a slot** (navy pill) to sign-in, with "Tell the mentor what you'd like help with when you sign in." under it;
   - when it has passed (request-time, decision 6): "This event has passed" (or "These office hours have passed") instead of the button.
4. **Tips:** the posted date and the body.
5. **More from the Hub:** up to 3 other upcoming events and office hours, as the feed's cards.
6. **Metadata:** the title, and the start of the body as the description.

### 5.3 Data

`HubPost`:

| Field | Values |
|---|---|
| `id` | `h-001`… |
| `kind` | `"event"`, `"office-hours"` or `"tip"` |
| `title` | Up to 70 characters |
| `campusSlug` | A campus slug, or `"all"` |
| `publishedAt` | ISO 8601 UTC |
| `startsAt` | ISO 8601 UTC for events and office hours; `null` for tips |
| `place` | "The Hub, Block C" and the like; `null` for tips |
| `capacity`, `going` | Numbers for events; `null` otherwise |
| `summary` | One sentence, for cards and link previews |
| `body` | The markdown subset (decision 9), up to 4,000 characters |
| `image` | The cover, `/placeholders/hub/<id>.svg` or a shared placeholder |

- The 10 existing events become posts with the same titles, campuses and dates (at 18:00 SAST for events, 13:00 for office hours), and at least 5 tips are added.
- `HubEvent` and `getHubEvents` stay for the homepage, now derived from the posts (date in SAST, `action` from the kind). What's on's RSVP and Book links go to each post's page.
- **Functions:** `getHubPosts({ kind, from })` (upcoming events and office hours from `from`, soonest first, or tips newest first), `getHubPost(id)`, `getHubPostIds()`, `getVerifiedSellers()`.
- **Formatting:** a `sastDateTime(iso)` helper gives "Wed 14 Oct · 18:00" in Africa/Johannesburg, and reads no clock.

---

## 6. Accessibility (WCAG 2.2 AA)

The homepage spec's section 10 applies, with:
- one h1 per page; h2 sections; h3 cards;
- `aria-current="page"` on the current chip or tab;
- every link and button at least 44px tall, including the chips, tabs, request rows and the Verified sellers' cards;
- the markdown renderer's links are underlined and sky-dark on white;
- dates are `<time dateTime>`.

## 7. Performance

- No new client code: each page's first-visit JavaScript is the shell plus, on a request page, the Save hearts of "Already on Vossie".
- Every page stays under the stage's stop line (152,305 B, or the line Lama last accepted) and the 153,600 B limit; layout shift 0.05 or less.

## 8. Testing

- **Unit:** the new data functions; the fixture checks (known campuses and categories, dates, the homepage's 7 requests unchanged, the derived `HubEvent`s match the old fixture); the markdown renderer (each form, unsafe links dropped, no raw HTML); `sastDateTime`; the components (rows, facts, empty and error states, the tabs' `aria-current`).
- **End to end (the five sizes):** the board with a campus chosen and without, a category filter, a request page and its sign-in, a closed request, the Hub feed and its tabs, an event page and RSVP's sign-in, a tip with its markdown, the homepage's request and event links, and 404s for unknown ids.
- **Checks:** axe on each page and empty state, the JS budget and layout shift for each page, and review screenshots in `docs/progress/community/`.

## 9. Not in this part

- Posting a request, making an offer, RSVPing, booking a slot (they need accounts).
- Hub post editing and the office-hours queue (staff tools).
- Share cards for requests and posts (part C adds share images for the remaining pages).
