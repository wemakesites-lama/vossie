# Vossie shopping pages: design spec

- **Date:** 2026-10-13
- **Status:** Built (2026-10-14). Sections 4.1, 5.2, 5.5, 7.1, 7.2 and 10 mark where the build differs from the draft
- **Scope:** the seller storefront (`/sellers/[slug]`), Saved (`/saved`) and collection pages (`/collections/[slug]`), on sample data, plus the data and shared-component changes they need. This is part A of the "other public pages" stage on the go-live checklist; part B (Looking For and the Hub) and part C (info, legal and system pages) follow with their own specs.

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-08-homepage-design.md` | The homepage spec. Its tokens, breakpoints, motion, accessibility and budget rules apply here |
| `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md` | The browse and listing spec. These pages reuse its cards, data layer and patterns |
| `docs/reference/GO-LIVE.md` | Every page the marketplace needs before launch |
| `docs/reference/FUNCTION-MAP.md` | The old demo's functions: storefront is D1 to D5, Saved is E1 to E3 |
| `docs/reference/LANDING-DECISIONS.md` | The decisions log. This brainstorm's decisions are rows 48 to 51 |
| `.superpowers/brainstorm/` (untracked) | The brainstorm screens: `storefront-layout.html` (option A chosen) |

---

## 1. Goal

Finish the shopping journey: from a listing to its seller's storefront, from any card to Saved and back, and from the homepage's Hub collections to a page of matching listings. Sample data, no sign-in; actions that need an account lead to the sign-in placeholder, as on the listing page.

## 2. Decisions this spec builds on

1. **Three parts.** The other public pages are split into shopping (this spec), community (Looking For and the Hub) and info, legal and system pages, each with its own spec, plan and build.
2. **Saved mirrors the IDs in a cookie.** The saved list moves from local storage to a first-party cookie, so the server builds the Saved page with live data and no new JavaScript. Nothing is stored on a server.
3. **Collections are rules,** like a saved browse: a set of categories and an optional price cap. They fill themselves as listings come and go.
4. **Storefront layout: A, the poster header.** The seller's name set big on a navy, star-textured band, with stamps for campus, category and Verified.

---

## 3. Routes and rendering

| Route | Rendering |
|---|---|
| `/sellers/[slug]` | Prerendered for every seller, `params` awaited inside `<Suspense>`, as now. Unknown slugs get the 404 |
| `/sellers/[slug]/opengraph-image` | One share card per seller, like the listings'. An unknown seller has no card (404) |
| `/collections/[slug]` | Prerendered for every collection. Unknown slugs get the 404 |
| `/saved` | The heading and device note are prerendered; the list renders per request inside `<Suspense>` (it reads the saved cookie) |

All three pages are Server Components. The client code they use is the Save hearts and the storefront's Share button (both already existed), and on Saved a small `RefreshWhenStale` effect (section 5.5, added in the build).

---

## 4. The seller storefront

### 4.1 Order on phones

1. **The poster band.** A navy panel with the star texture (`surface-navy texture-stars`), like the homepage hero.
   - The seller's photo, round, 64px on phones and 96px from the desktop step.
   - The seller's name as the h1, in the display face, large and white.
   - The tagline, in white.
   - Stamps for the campus and the category: small white-outlined pills with white text.
   - **Verified,** when the seller is verified: a solid sky pill with navy text and a tick icon.
   - **The trust badge,** when there is one: a white pill with navy text, the same shape, size and lettering as on the listing page's seller card. (That card's pill is navy and would vanish on the navy band.)
   - **Message seller:** a solid sky pill with navy text, linking to `signInHref("/sellers/<slug>")`, with no prefetch.
   - **Share:** the existing `ShareButton`, with white outline styling on navy.
   - Small text on the stars stays white; sky is used only for the pills and icons (CLAUDE.md).
2. **About:** an h2 "About", the seller's `about` text with line breaks kept, and "Selling since March 2026", from `since`.
3. **Their listings:** an h2 with the count ("2 listings", "1 listing"), then the seller's available listings in a `ListingGrid` (section 7.1), newest first.
   - If they have none: "Nothing listed right now", and a link to browse the seller's main category, `/browse?cat=<seller.categorySlug>` (section 6.1).
4. **"Report this seller":** a small sky-dark link to `signInHref("/sellers/<slug>")`, at the bottom.

### 4.2 Desktop and tablet

- **Desktop:** the band spans the page column. Photo, name and stamps on the left; Message and Share on the right. Below it, two columns: About on the left (about a quarter), and the listings on the right in 4 columns.
- **Tablet:** the phone order, with the listings 3 across.

### 4.3 Metadata and the share card

- **The tab title** is the seller's name. The description is the tagline.
- **Open Graph title:** "{name} · {campus} on Vossie".
- **The share card** (`app/sellers/[slug]/opengraph-image.tsx`) is 1200 × 630, built like the listing card:
  - navy, with the white crest;
  - "VOSSIE · {CAMPUS}", the name, and the tagline in white;
  - it uses `next/og`'s built-in font;
  - alt text: "{name}, {category} at {campus} on Vossie";
  - `generateImageMetadata` returns `[]` for an unknown seller.

  The share card's runtime is already in every page, so this adds no client code.

---

## 5. Saved

### 5.1 The saved cookie

- **Name, format and limit:** the cookie is `vossie_saved`. It holds listing IDs, newest first, joined with `.`. It keeps at most 100; saving another drops the oldest.
- **Attributes:** `Path=/`, `SameSite=Lax`, `Max-Age` one year, and `Secure` on HTTPS, like the campus cookie.
- **Bad values are ignored:** an ID must match `^[a-z0-9-]{1,40}$`, and duplicates are dropped.
- **One store.** `lib/saved.ts` reads and writes the cookie instead of local storage, with the same exported functions, so the Save hearts, `useIsSaved` and the header's saved count don't change.
- **No migration.** The site isn't live, so no one has saves to move across.
- **Reading it on the server:** `getSavedIds()` in `lib/data/saved.ts`, request-time only and called inside `<Suspense>`, parses the cookie with the same rules.
- **Privacy:** the IDs of public listings travel with each request, as the campus choice does. Nothing is stored on a server. `CLAUDE.md`'s privacy line is updated to say saved items live in a browser cookie.

### 5.2 The page

1. **Heading:** an h1 "Saved", then the device note in small muted text: "Saved on this device. When sign-in arrives, your saves will follow you to any device." The count line ("3 saved") streams in with the list, just above the cards, because it needs the cookie while the note stays prerendered. With nothing saved there is no count line; the empty state says it.
2. **The list:** the saved listings in a `ListingGrid`, 2, 3 and 5 across, in saved order.
   - Paused and sold listings stay in the list, with a "Not taking orders" or "Sold" tag on the card (section 7.1).
   - IDs that no longer exist are dropped.
3. **Empty state:** "Nothing saved yet. Tap the heart on any listing to keep it here," with a **Start browsing** button to `/browse`.

### 5.3 Removing

- Tapping a heart on the Saved page unsaves the listing, and the usual "Removed from saved" toast appears.
- The card stays where it is, with its photo turned grey and a "Removed" tag on the photo. The card's text keeps full contrast.
- Tapping the heart again saves it back.
- This is CSS only: the card's `.listing-card:has(.save-heart[aria-pressed="false"])`.
- The card is gone the next time the page loads.

**The Saved page's hearts start pressed.** A Save heart reads the saved list in the browser, and on the server it shows "not saved". On the Saved page that would make every card look removed until the page's JavaScript runs, and for good without it. So the Saved page tells its cards they're saved:
- `ListingCard` takes an optional `saved` prop and passes it to `SaveHeart`, and `useIsSaved` takes it as the server value.
- Everywhere else the server value stays "not saved", as now.

### 5.4 Other details

- **Search engines:** the page is `noindex`.
- **Loading:** while the list streams in, a skeleton of 8 card shapes holds its place.
- **Errors:** if the listings fail to load: "We couldn't load your saved listings just now," with a "Try again" link to `/saved`.

### 5.5 Refreshing a kept copy (added in the build)

Next keeps the last few pages and shows one again, on a link or Back, without asking the server. So a visitor who opens Saved, saves something elsewhere and comes back by a link would see the old list. The page therefore includes `RefreshWhenStale` (`components/saved/RefreshWhenStale.tsx`), a small client effect. Each time the page is shown, it compares the saved cookie with the ids the server built the list from, and calls `router.refresh()` when they differ. It adds 105 B of JavaScript, on Saved only.

---

## 6. Data

### 6.1 Types and fixtures

**Seller** gains:

| Field | Values |
|---|---|
| `about` | Two or three sentences in the seller's voice. Line breaks are kept |
| `since` | `YYYY-MM`, the month they started selling. Shown as "Selling since March 2026" |
| `badge` | `TrustBadge` or null. The seller's trust badge, which is the source of truth |
| `categorySlug` | The seller's main category, for the storefront's empty-state link. The existing `category` display string stays |

The trust badge moves to the seller:
- Every listing's `badge` must equal its seller's `badge`, and a fixture test checks this.
- With Supabase, the listing will read it from its seller.
- Some homepage cards' badges may change as the sample data is made consistent.

**Collection** gains:

| Field | Values |
|---|---|
| `intro` | One sentence |
| `rule` | `{ categories: readonly string[]; maxPrice?: number }` |

The four rules and intros are sample content for the Hub to reword:

| Collection | Categories | Price cap | Intro |
|---|---|---|---|
| Back-to-campus essentials | Textbooks & notes, Stationery, Tech | none | Books, stationery and tech to start the semester ready. |
| Notes, tutors & cram snacks | Textbooks & notes, Tutoring, Food | none | Everything for exam season, from summaries to snacks. |
| Res setup under R500 | Res & living | R500 | Make your room a home without breaking the bank. |
| Book a student | Services, Tutoring, Hair & beauty | none | Skills for hire from students on every campus. |

**Fixture checks:**
- every seller has an `about` and a valid `since`, and a `categorySlug` that exists;
- every collection's categories exist;
- every listing's badge matches its seller's.

### 6.2 Data functions (`lib/data/index.ts`)

| Function | Returns |
|---|---|
| `getSellerListings(slug)` | The seller's available listings, newest first |
| `getCollection(slug)` | The collection, or `null` |
| `getCollectionListings(slug)` | Available listings matching the rule, newest first, every campus, at most 48. A listing matches when its category is in the rule and, if there's a cap, its price is the cap or less (swap-only listings don't match a capped rule; free ones do) |
| `getListingsByIds(ids)` | The listings for those IDs, in the given order, paused and sold included, unknown IDs dropped |

All use `"use cache"` with plain arguments. `getSeller` and `getSellerSlugs` stay.

---

## 7. Shared pieces

### 7.1 Changes

- **`ListingGrid`** (`components/listings/ListingGrid.tsx`): a `<ul>` of `ListingCard`s with a `columns` setting.
  - `"five"` gives 2, 3 and 5 across: Saved and collections.
  - `"four"` gives 2, 3 and 4 across: the storefront and the listing page's More from, which moves onto it (its tablet step goes from 2 to 3 across).
  - Browse keeps its own `ResultsGrid`, because of the numbered cards and Show more.
- **`ListingCard`** shows a small tag on the photo when the listing isn't available: "Sold" or "Not taking orders". It's navy on pale, like the listing page's banner. Only Saved shows such listings.
- **`ListingCard`** also takes the optional `saved` prop (section 5.3); `ListingGrid` passes it on.
- **`ShareButton`** takes a `className`, so the storefront can give it a white outline on the navy band.
- **`lib/saved.ts`** switches to the cookie (section 5.1).
- **Two links no longer prefetch (changed in the build).**
  - The listing page's "See their shop" link has `prefetch={false}`. It had prefetched the storefront, whose route chunk repeats Share and Save, and that added 760 B to the listing page's first-visit JavaScript (decision 53).
  - The header's Saved link has `prefetch={false}` too. Once Saved had cards, its prefetch added 476 B to every page.

### 7.2 The collection page

1. **Header.**
   - **From the tablet step up:** the collection photo sits beside the text, on the left, about two-fifths of the width, at its usual 4:5. On the right: the eyebrow, the h1 title, the intro, "Curated by the Incubation Hub", and the count ("12 listings").
   - **Phones:** the photo runs edge to edge at 4:3, with the text below. Landscape phones keep that layout but crop the photo to 4:1 (a strip about 211px tall at 844px wide), so the title and the first listings share the first screen.
2. **The listings** in a `ListingGrid` (`"five"`), newest first, every campus, at most 48. Each card shows its campus.
3. **"More in browse":** one link per category in the rule, keeping the price cap. For example, "More in Res & living under R500" goes to `/browse?cat=res-living&max=500`.
4. **"More from the Hub":** the other collections as linked rows with a 64px thumbnail, the eyebrow and the title.
5. **Empty state:** "Nothing here right now", followed by the browse links.

The page's tab title is the collection title, and its description is the intro.

---

## 8. Loading, empty and error states

| Situation | What shows |
|---|---|
| A seller with no available listings | "Nothing listed right now", and a link to browse their category |
| A storefront's or collection's listings fail to load | `SectionError` with `path`, so "Try again" returns to that page |
| Saved loading | A skeleton of 8 card shapes |
| Saved failing | "We couldn't load your saved listings just now," with a "Try again" link to `/saved` |
| Nothing saved, or no saved ID still exists | The Saved empty state |
| A collection with no matches | "Nothing here right now", and the browse links |
| An unknown seller or collection | The branded 404 |

---

## 9. Accessibility (WCAG 2.2 AA)

The homepage spec's section 10 applies, with these additions:
- **Headings:** one h1 per page (the seller's name, "Saved", the collection title), with h2 sections.
- **The storefront band:** small text is white on the stars, and the sky pills carry navy text. The photo's alt text comes from the data.
- **Saved's removed state:** the heart's `aria-pressed` says it, and the "Removed" tag sits on the photo. The card's text keeps full contrast.
- **Targets:** all at least 44px, including "Report this seller", the browse links and "More from the Hub" rows.
- **Data saver:** card photos stay hidden by the existing rule. The band's photo is small and stays.

---

## 10. Performance budget

- Every page stays under 153,600 B of first-visit JavaScript (brotli quality 5, 390px).
- **Saved and collections** add no client code beyond the shell and the Save hearts, except Saved's small `RefreshWhenStale` effect (105 B, section 5.5).
- **The storefront** adds the existing Share button.
- **The hearts' `saved` prop** adds a few bytes to the Save heart, on every page with cards, including the listing page.
- If any page goes more than 100 B past the listing page's accepted 152,078 B (so past 152,178 B), the build stops and reports.
  - **As built:** the saved cookie store, which is in every page's shell, put the listing page 27 B past that line (152,205 B). Lama accepted it and moved this stage's stop line to 152,305 B (decision 52).
  - The final figures are in `docs/PROGRESS.md`, and every page is under the 153,600 B limit.
- Layout shift stays at 0.05 or less on each page.

---

## 11. Testing

**Unit (Vitest):**
- **Data:** the saved cookie store (parse, save, unsave, the 100 limit, bad values) and `getSavedIds`; `getSellerListings`, `getCollection`, `getCollectionListings` (each rule, the price cap, swap-only and free) and `getListingsByIds` (order, states, unknown IDs).
- **Fixtures:** the checks in section 6.1.
- **Components:** the band (stamps, Verified, the badge, actions), About and "Selling since", the empty states, `ListingGrid`'s columns, the card's state tag, the collection header and its browse links.

**End to end (Playwright, the five sizes):**
- **Storefront:** the band and listings; Message goes to sign-in and back; the share card's tags and a 200 PNG; a 404 for an unknown seller.
- **Saved:**
  - save a listing on its page, then find it on Saved;
  - remove it, and see the "Removed" state;
  - a sold listing shows its tag;
  - the empty state;
  - the header count still follows.
- **Collections:** the right listings for "Res setup under R500"; the browse links; "More from the Hub"; a 404 for an unknown slug.
- **Checks:** axe on each page (and Saved empty), the JS budget and layout shift for each page, and review screenshots in `docs/progress/shopping/`.

---

## 12. Not in this part

- Following sellers, and a "Sellers you follow" tab on Saved.
- The Hub pinning, editing or ordering collections.
- Sellers editing their own storefront.
- Reviews.
- Looking For, the Hub, and the info, legal and system pages (parts B and C).

## 13. How we'll know it's done

- `pnpm lint` and `pnpm typecheck` are clean, and `pnpm test` and `pnpm e2e` pass, with no serious or critical axe issues.
- Every page is within section 10's budget.
- Lama has reviewed the screenshots.
- `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md` and `CLAUDE.md`'s privacy line are updated.
