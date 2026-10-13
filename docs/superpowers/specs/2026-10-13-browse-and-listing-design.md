# Vossie browse and listing pages: design spec

- **Date:** 2026-10-13
- **Status:** Draft for Lama Nkuna's review
- **Scope:** the browse page (`/browse`: search, categories, filters, sort, paging) and the listing page (`/listings/[id]`), on sample data, plus the data changes and link changes they need. It follows the homepage stage (spec `2026-10-08-homepage-design.md`, Parts 1 and 2).

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-08-homepage-design.md` | The homepage spec. Its tokens, breakpoints, motion, accessibility and budget rules apply here unchanged |
| `docs/reference/GO-LIVE.md` | Every page and view the marketplace needs before launch, and where this stage sits |
| `docs/reference/FUNCTION-MAP.md` | The old demo's functions. Browse is B8 to B14, the listing page C1 to C11, defects D12 and D17 |
| `docs/reference/LANDING-DECISIONS.md` | The decisions log. This brainstorm's decisions are rows 35 to 45 |
| `.superpowers/brainstorm/` (untracked) | The brainstorm screens: `browse-layout.html` (option C chosen) and `listing-layout.html` (option A chosen) |

---

## 1. Goal

Let students find things and look at them properly. Browse turns every homepage link, search and category into a page of results. The listing page shows one thing well enough to decide to message the seller.

Like the homepage, this stage runs on realistic sample data behind `lib/data`, so the move to Supabase changes only that folder. Messaging, reporting and sign-in come in later stages; their buttons already exist and lead to the sign-in placeholder.

## 2. Decisions this spec builds on

1. **UI first, on sample data.** Browse fully works on sample data (search, filters, sort, paging). The listing page is complete apart from actions that need an account.
2. **Cross-campus buying.** Every campus is browsable. Physical items say where they're collected, with a note when that isn't the viewer's campus. No couriers or payments. Delivery between campuses may come later.
3. **Browse layout: C, category-led.** A big display title, the categories as a row of tabs, the other filters behind one Filters button.
4. **Listing layout: A, gallery and action dock.** Photos as the hero; a dock fixed at the bottom on phones; a column that stays in view on desktop.
5. **Server-rendered from the URL.** The link is the whole state. Filters, tabs, sort and search are links or plain GET forms. Near-zero page JavaScript: everything works without the app's JavaScript, before it arrives or if it never does. (React's small inline script, which places streamed content, is still needed. Both pages stream their body, so with JavaScript switched off entirely they stay blank.)
6. **Campus default.** With no campus in the link, browse shows the viewer's chosen campus as a removable chip. A campus in the link always wins. With no campus chosen, browse shows every campus.
7. **Filters and Sort open with `<details>`,** not the Popover API. Popovers need Safari 17, and iPhone 8s and Xs (common second-hand) stop at iOS 16.
8. **"Free" sits in the Price group,** written as `price=free`, `price=under-100` and so on. The homepage's `max=` links stay valid as an alias.
9. **Desktop photos are stacked,** not a main photo with thumbnails, because switching thumbnails needs JavaScript.
10. **Message seller and Report link to the sign-in page** (`/login?next=…`), not a sheet. That's no JavaScript, and it's the flow they'll use once accounts exist.
11. **Free and swap items become ordinary listings,** so browse, the listing page and the homepage share one model.

---

## 3. Routes and the URL

### 3.1 Routes

| Route | This stage |
|---|---|
| `/browse` | The only results page (section 4) |
| `/listings/[id]` | The listing page (section 5). Every listing is prerendered, including paused and sold ones. Unknown ids get the 404 |
| `/categories/[slug]` | A temporary redirect to `/browse?cat=[slug]`. The placeholder page is removed |
| `/c/[campus]` | A temporary redirect to `/browse?campus=[campus]`. The placeholder page is removed |
| `/login` | Still a placeholder, now reading `next` (section 5.9) |

The redirects live in `next.config.ts` (`permanent: false`), so either route can get its own page later, such as a campus home.

### 3.2 Browse parameters

| Param | Values | Meaning |
|---|---|---|
| `q` | text, up to 100 characters | Search (section 4.8) |
| `cat` | a category slug | The chosen tab |
| `campus` | a campus slug, or `all` | Which campus. Missing means the viewer's chosen campus (decision 6) |
| `price` | `free`, `under-50`, `under-100`, `under-250`, `under-500` | Price filter (section 4.9) |
| `max` | `50`, `100`, `250`, `500` | Alias: `max=50` reads as `price=under-50`. Ignored when `price` is also present |
| `pay` | `cash`, `swap` | Paid with (section 4.9) |
| `deals` | `free-and-swaps` | The homepage's Free & swaps "See all". Shown as a chip only, never in the Filters panel |
| `sort` | `match`, `new`, `price-low`, `price-high` | Default `match` with a search, `new` without. `match` without a search reads as `new` |
| `n` | 24, 48, 72 … 240 | How many results to show. Other whole numbers round up to the next 24 and are capped at 240. Zero, negative numbers and anything that isn't a whole number are ignored |

**Parsing rules:**
- Unknown values, empty values (a GET form sends `price=` for "Any") and repeated parameters are ignored; for a repeated parameter the first value counts. A mangled link still shows results, never an error.
- `q` is trimmed and cut to 100 characters, and blank means no search.
- The campus comes from the link when it's a known slug or `all`; otherwise from the viewer's campus cookie (through `getViewerContext()`); otherwise `all`. The parsed query records whether the campus came from the link.

### 3.3 Building links

`browseHref(query, changes)` builds every tab, chip, sort, Show more and "Clear" link:
- Parameters always appear in the order `q`, `cat`, `campus`, `price`, `pay`, `deals`, `sort`, `n`.
- Defaults are dropped: the default sort, `n=24`, and the campus when it didn't come from the link (so a link never pins a campus the viewer didn't ask for).
- Any change other than Show more drops `n`, so results start again from the top.

---

## 4. The browse page

### 4.1 Order

**Phones, top to bottom:**
1. **Search field,** filled in with the current search (section 4.2).
2. **Eyebrow and h1** in the display face:

   | State | Eyebrow | h1 | Tab title |
   |---|---|---|---|
   | No search, no category | Shop | Everything | Browse · Vossie |
   | Category | Shop | Tech | Tech · Vossie |
   | Search | Search | "calculator" | "calculator" · Vossie |
   | Search in a category | Search in Tech | "calculator" | "calculator" · Vossie |

   The h1 uses curly quotes around a search term.
3. **Category tabs** (section 4.3).
4. **Toolbar:** Filters and Sort side by side, with the count on the line beneath. From the tablet step the count sits at the right of the same row.
5. **Filters panel or Sort menu** when open, between the toolbar and the chips.
6. **Active filter chips** (section 4.5).
7. **Results grid** and **Show more** (section 4.6), or the **empty state** (section 4.7).

**Desktop:** the search field sits to the right of the eyebrow and h1, on the same row. Everything else keeps the phone order.

The tabs, toolbar and chips stay on screen in the empty state, so the viewer can change course.

### 4.2 Search field

- A plain GET form to `/browse` with `role="search"`: an `input type="search" name="q"` labelled "Search Vossie" (visually hidden label) and a submit button with the search icon and the accessible name "Search".
- Hidden inputs carry `cat`, `price`, `pay`, `deals`, and `campus` when it came from the link. A new search keeps the filters and drops the sort and `n`.
- Touch target 44px; the field uses the header search's pill styling.

### 4.3 Category tabs

- `<nav aria-label="Categories">` with a list of links: "All", then the ten categories in their fixture order.
- Each link is `browseHref` with that category (or none, for All), keeping the search and filters.
- The chosen tab has `aria-current="page"`, bold navy text and a 3px navy underline. Sky isn't used: as a state indicator it would be 2.6:1 on white (WCAG 1.4.11).
- Other tabs use the muted colour (`#5B6577`). Idle-text grey is too faint for small text.
- One row that scrolls sideways when it doesn't fit, with no visible scrollbar. Where the browser supports CSS `scroll-initial-target`, the row starts scrolled to the chosen tab; elsewhere it starts at All, and the h1 already says where you are.
- Each tab is at least 44px tall.

### 4.4 Toolbar, Filters panel and Sort menu

**Filters** is a `<details>` whose `<summary>` reads "Filters", plus "(2)" when filters are active. Its accessible name is "Filters, 2 active" (or "Filters" when none). The count covers campus (when it isn't `all`), price, pay and deals.

Its panel holds a GET form to `/browse`:

| Group | Control | Options |
|---|---|---|
| Campus | `<select name="campus">` with a visible label | Every campus (`all`), then the 13 campuses in fixture order. The current campus is selected |
| Price | radio group `name="price"` in a `<fieldset>` with a legend | Any (empty value), Free, Under R50, Under R100, Under R250, Under R500 |
| Paid with | radio group `name="pay"` in a `<fieldset>` with a legend | Any (empty value), Cash, Swaps |

- Hidden inputs carry `q`, `cat`, `deals` and `sort`.
- Buttons: **Show results** (navy, submits) and **Clear** (a link to the "Clear all" target in section 4.5).
- There's no live result count; that would need JavaScript.
- Phones: the panel spans the content width under the toolbar, groups stacked. From the tablet step: the three groups sit side by side.

**Sort** is a `<details>` whose summary reads "Sort: Newest" (accessible name the same). Its menu is a list of links, so one tap applies:
- Best match (only when there's a search), Newest, Price: low to high, Price: high to low.
- The current one has `aria-current="true"` and a tick icon from `components/icons.tsx`.

Both `<details>` share a `name`, so opening one closes the other where the browser supports it. Opening either pushes the content below it down; nothing floats over the results.

### 4.5 Active filter chips

- One chip per active filter, in this order: campus (only when it isn't `all`), price, pay, deals. Labels: "Midrand", "Free", "Under R100", "Cash", "Swaps", "Free & swaps".
- Each chip is a link that removes that one filter. Removing the campus chip links to `campus=all`. Each has the accessible name "Remove filter: Midrand".
- **Clear all** appears with two or more chips. It removes price, pay and deals, sets `campus=all`, and keeps the search, category and sort.
- Chips are pale (`#E1F0F7`) pills with navy text and a close icon from `components/icons.tsx`, at least 44px tall, wrapping onto more lines as needed.

### 4.6 Results, count and Show more

- **Count** (muted, small): "1 listing", "29 listings", or "Showing 24 of 29" when there are more than shown.
- **Grid:** a visually hidden h2 "Results", then a `<ul>` of `ListingCard`s (their h3s sit under it). 2 columns on phones, 3 from the tablet step, 5 from the desktop step. Each `<li>` has `id="r-1"`, `id="r-2"` and so on.
- **Cards** are the homepage's `ListingCard` unchanged in layout: photo, Save heart, title, price, campus, badge.
- **Show more** appears when there are more results. It's a link to `browseHref(query, { shown: shown + 24 })` with `#r-{shown + 1}`, so the page lands on the first new card, and keyboard users continue from there. The server renders every card up to the new number.

### 4.7 Empty state

Shown when nothing matches, in place of the grid:
- Heading "Nothing here yet", then the lines that apply:
  - With a search: "Check the spelling, or try a shorter word."
  - When the campus isn't `all` and other campuses have matches: a link "6 more at other campuses" (or "1 more at another campus") to the same query with `campus=all`.
  - When price, pay or deals is active: a link "Clear filters" (removes those three, keeps the campus).
  - Always: "Can't find it? Ask for it on Looking For", linking to `/looking-for`.

### 4.8 Search rules

- **Text searched:** the listing's title, description, category name and seller name. Seller names fix the old demo's defect D17.
- **Normalising:** lowercase; accents removed; split on anything that isn't a letter or digit.
- **Ignored query words:** single letters, and these stop words: a, an, and, for, in, of, on, or, the, to, with. Digits are kept. If nothing is left, the search matches everything (the h1 still shows the term).
- **Matching:** every remaining query word must match (AND). A query word matches a word in the text when:
  - the text word starts with it ("calc" finds "calculator"), or
  - the query word has 5 or more letters and is one edit away from the text word: one letter added, removed, changed, or two neighbouring letters swapped ("calculater" finds "calculator").
- **Best match score:** for each query word, 3 if it matches in the title, else 2 in the category or seller name, else 1 in the description. Highest total first; ties go to the newest.

### 4.9 Filter and sort rules

- Browse shows only listings whose availability is `available`.
- **Prices:** a free listing has `priceZar` 0. A swap-only listing has no price (`null`). A "From" price counts at its from amount.
- **`price=free`:** `priceZar` is 0.
- **`price=under-N`:** `priceZar` is N or less, so free listings are included. Swap-only listings are left out.
- **`pay=cash`:** pay mode `cash` or `both` (free listings count as cash). **`pay=swap`:** pay mode `swap` or `both`.
- **`deals=free-and-swaps`:** free, or pay mode `swap` or `both`.
- Filters combine with AND, together with the category, campus and search.
- **Sorts:**
  - `new`: newest first.
  - `price-low`: lowest price first (free at the top), swap-only listings last, ties newest first.
  - `price-high`: highest price first, swap-only listings last, ties newest first.
  - `match`: section 4.8.

### 4.10 Metadata

- The tab title follows section 4.1's table.
- Pages with a search are `noindex`. Category pages are indexed.
- `generateMetadata` reads `searchParams`; check how Cache Components treats that in `node_modules/next/dist/docs/` before building. If it can't, the title stays "Browse".

---

## 5. The listing page

### 5.1 Order on phones

1. **Breadcrumb:** `<nav aria-label="Breadcrumb">` with "Browse" (`/browse`) and the category (`/browse?cat=…`).
2. **Photos** at full width, square like the cards (section 5.6).
3. **Availability banner** when paused or sold (section 5.5).
4. **Title** (h1) and **price**, both in the display face. Price wording (section 5.3).
5. **Swap callout** when the pay mode is `swap` or `both`: "Happy to swap for: a textbook or airtime" (the listing's `swapFor`).
6. **Actions:** Message seller, Save, Share (section 5.4). On phones they display in the dock, but this is their place in the page's reading and focus order.
7. **Collect box** (section 5.3), with the campus note when it applies.
8. **Seller card:** photo, name, Verified tick when verified, trust badge, campus, and "See their shop" linking to `/sellers/[slug]` (still a placeholder).
9. **Description** under an h2 "About this", with the seller's line breaks kept.
10. **Facts** as a description list:
    - Category (linking to `/browse?cat=…`).
    - Condition: New, Like new, Good or Fair. Items only.
    - Campus.
    - Listed: "12 October 2026", formatted in `Africa/Johannesburg` from `createdAt`. A date, not "2 hours ago", so the page needs no clock and stays prerendered.
11. **Safety note:** "Meet at the pickup point, check it before you pay, and never pay a deposit." with a link to `/safety`.
12. **More from this seller** (section 5.7).
13. **"Report this listing":** a small sky-dark link to `/login?next=/listings/[id]`.

### 5.2 Desktop

- Two columns from the desktop step: photos on the left (about 60%), and on the right a column with the title, price, swap callout, actions, collect box and seller card.
- The right column is `position: sticky`, its top offset clearing the pinned crest, so it stays in view while the photos scroll.
- The breadcrumb sits above both columns. The description, facts, safety note, more-from and the report link follow below, full width.
- The tablet step uses the phone order with a wider photo strip and the actions back in the page (no dock).

### 5.3 Wording

**Price** (`priceLabel` in `lib/format.ts`, also used by the cards):

| Listing | Shows |
|---|---|
| R250, cash | R250 |
| From R400, cash | From R400 |
| R0 | Free |
| No price, swap only | Swap |
| R450, cash or swap | R450 or swap |
| From R400, cash or swap | From R400 or swap |

Free and "or swap" are new. The homepage cards change with them: the gaming headset and rugby jersey gain "or swap".

**Collect box,** by the listing's `handover`:

| Handover | Heading | Line |
|---|---|---|
| `pickup` | Collect at Midrand · Library entrance | See it before you pay, and pay when you collect. |
| `on-campus` | On campus at Midrand | Agree a time and place when you message. |
| `on-campus-or-online` | On campus at Midrand, or online | Agree how when you message. |
| `online` | Online | Done online, from anywhere. |

**Campus note** (`CampusNote`): for `pickup` and `on-campus` listings only, when the viewer has chosen a campus and it isn't the listing's campus:
> Midrand isn't your chosen campus (Pretoria), so you'd go there for this. Delivery between campuses isn't available yet.

It reads the campus cookie through `getViewerContext()` inside `<Suspense fallback={null}>`, as the homepage's campus-aware sections do. It's the only part of the page rendered per request.

### 5.4 Actions and the phone dock

- **Message seller:** a navy pill link to `/login?next=/listings/[id]` (encoded), `prefetch={false}`.
- **Save:** the existing `SaveHeart`.
- **Share:** a new client button, `ShareButton` (section 5.8).
- **One set of actions.** Below the tablet step, CSS fixes the actions group to the bottom of the screen as the dock: white, a hairline top border, Message filling the width beside the Save and Share icon buttons, every target at least 44px, padded for the iPhone home bar (`env(safe-area-inset-bottom)`). From the tablet step the same group sits in the page.
- While the dock shows, the page has `scroll-padding-bottom` equal to the dock's height, and bottom padding so the dock never covers the footer or a focused element (WCAG 2.4.11).

### 5.5 Paused and sold

- A banner under the photos: "Sold" or "Not taking orders right now", navy on pale.
- Message seller is replaced by an outline link, "See similar items", to `/browse?cat=…`. Save and Share stay.
- These pages stay up, so shared links never dead-end. They're left out of browse, Just listed and Free & swaps.

### 5.6 Photos

- **Cover:** the listing's `image`. **More photos:** `morePhotos`, 0 to 5.
- **Phones:** a horizontal strip with CSS scroll-snap, one photo per view, the next photo's edge peeking in. A label "3 photos" sits on the strip when there's more than one. The strip is a labelled region ("Photos") with `tabindex="0"`, so it can be scrolled from the keyboard.
- **Desktop:** the cover at the left column's full width, the others two to a row beneath it.
- **Alt text** is the seller's description of each photo, followed by "Photo 2 of 3" when there's more than one.
- **Loading:** the cover loads first with high priority (it's the page's largest image); the rest load lazily.
- **Data saver** (`html[data-low-data]`): only the cover loads. The other photos wait behind a `<details>` "Show 2 more photos". The normal and data saver versions are both in the HTML and CSS shows one of them; lazy images that aren't displayed are never fetched.

### 5.7 More from

- Heading "More from Tech corner", with up to 4 of the seller's other available listings, newest first.
- If the seller has no others: "More in Tech", with up to 4 other available listings from the same category: those at the listing's campus first, then the rest, each group newest first.
- If neither has anything, the section isn't shown.
- Uses `ListingCard` in a grid of 2 columns, 4 from the desktop step.

### 5.8 Sharing

- **ShareButton** (`"use client"`):
  1. Where `navigator.share` exists, it opens the share sheet with the title and URL. Cancelling does nothing.
  2. Otherwise it copies the URL and shows the toast "Link copied".
  3. If copying fails too: "Couldn't share. Copy the link from your address bar."
- **Share card:** `app/listings/[id]/opengraph-image.tsx` builds a 1200×630 image per listing when the site is built: a navy panel with the white crest, the title in the display face, the price in large sky text, and the campus. Its alt text is "{title}, {price}, at {campus} on Vossie". Check `next/og` in the Next docs first, including which font file formats it accepts.
- **Metadata:** the page title is the listing title. The Open Graph title is "{title} · {price}", and the description is the first 150 characters of the description.

### 5.9 The sign-in placeholder

`/login` keeps its "coming soon" page and adds:
- The line "Signing in arrives in the next stage. Then you'll be able to message sellers, report listings and keep your saved items on every device."
- When `next` is a path on this site (starts with a single `/`, not `//` or `/\`), a link back to it: "Back to the listing" for `/listings/…`, otherwise "Go back". Anything else is ignored, so the link can't send people to another site.
- `next` is read inside `<Suspense>`.

---

## 6. Data

### 6.1 Types (`lib/types.ts`)

```ts
export type ListingKind = "item" | "service";
export type Condition = "new" | "like-new" | "good" | "fair";
export type Handover = "pickup" | "on-campus" | "on-campus-or-online" | "online";
export type Availability = "available" | "paused" | "sold";

export type Listing = {
  // Existing fields stay: id, title, priceZar, priceIsFrom, payMode, campusSlug, image (the cover), badge, createdAt.
  kind: ListingKind;
  categorySlug: string;
  sellerSlug: string;
  morePhotos: readonly ImageRef[]; // 0 to 5, after the cover
  description: string;
  condition: Condition | null; // null for services
  handover: Handover;
  pickupPointId: string | null; // set only when handover is "pickup"
  swapFor: string | null; // set only when payMode is "swap" or "both"
  availability: Availability;
};

export type PickupPoint = { id: string; campusSlug: string; name: string };

/** Everything the listing page needs, looked up once. */
export type ListingDetail = {
  listing: Listing;
  seller: Seller;
  category: Category;
  campus: Campus;
  pickupPoint: PickupPoint | null;
};

export type PriceFilter = "free" | "under-50" | "under-100" | "under-250" | "under-500";
export type BrowseSort = "match" | "new" | "price-low" | "price-high";

export type BrowseQuery = {
  q: string | null;
  category: string | null;
  campus: CampusChoice;
  campusFromLink: boolean;
  price: PriceFilter | null;
  pay: "cash" | "swap" | null;
  deals: "free-and-swaps" | null;
  sort: BrowseSort;
  shown: number;
};
```

- **Free:** `priceZar` 0, pay mode `cash`. **Swap only:** `priceZar` null, pay mode `swap`.
- `ListingSummary` is removed; `getListing` callers move to `getListingDetail`.
- `FreeSwapItem` stays as the homepage section's view shape, but its fixture goes.

### 6.2 Fixtures (`data/fixtures/`)

- **`listings.ts`:** every listing gains the new fields. The seven `fs-` items join it as ordinary listings with their ids unchanged, and `createdAt` values that keep the homepage's Free & swaps order as it is now. `free-swaps.ts` is removed.
- **Coverage for testing:** at least three listings with 2 or 3 photos (labelled placeholders at the card ratio); one paused and one sold listing (neither in the homepage's first eight Just listed); items and services at several campuses; every handover kind; Mbombela still empty.
- **`pickup-points.ts`** (new): one or two generic points per physical campus ("Library entrance", "Main reception", "Student centre"). Eduvos Online has none.
- **`sellers.ts`:** grows from 10 to about 20 so every listing has a seller, still with generic names ("Tech corner", "Book swap", "Res deals"). Featured stays verified sellers only.
- **Checks** (`fixtures.test.ts`), for every listing:
  - its seller and category exist, and the seller is on the listing's campus;
  - `priceZar` is null exactly when the pay mode is `swap`;
  - `swapFor` is set exactly when the pay mode is `swap` or `both`;
  - `pickupPointId` is set exactly when the handover is `pickup`, and the point is on the listing's campus;
  - `condition` is null exactly when the kind is `service`;
  - listings at Eduvos Online use the `online` handover;
  - at most 5 more photos.

### 6.3 Data functions (`lib/data/index.ts`)

| Function | Returns |
|---|---|
| `searchListings(query)` | `{ items, elsewhere }`. `query` is a `BrowseQuery` without `shown` and `campusFromLink`. `items` is every match, filtered and sorted (section 4.9). `elsewhere` counts matches at other campuses when the campus isn't `all`, otherwise 0. The caller slices `items` to `shown`, so Show more reuses the cached result |
| `getListingDetail(id)` | A `ListingDetail`, or `null` for an unknown id. Paused and sold listings are returned |
| `getListingIds()` | Every listing id, for `generateStaticParams` |
| `getMoreFrom(listing, limit)` | `{ from: "seller" \| "category", items }` (section 5.7) |
| `getPickupPoints()` | Every pickup point |

- `getJustListed` and `getFreeAndSwaps` show available listings only. `getFreeAndSwaps` picks free or swap-only listings out of the listings and maps them to `FreeSwapItem`, so the homepage section doesn't change.
- Every function keeps `"use cache"` with plain arguments, as now.

### 6.4 Browse logic (`lib/browse/`)

Plain functions, each with unit tests next to it:

| File | Does |
|---|---|
| `query.ts` | `parseBrowseParams(params, viewerCampus, known)` turns search params into a `BrowseQuery` (section 3.2). `known` holds the campus and category slugs |
| `href.ts` | `browseHref(query, changes)` (section 3.3) |
| `filters.ts` | `activeFilters(query, names)` lists the chips with their labels and remove links; `clearAllHref(query)` and `clearFiltersHref(query)` |
| `search.ts` | Normalising, query words, matching and the Best match score (section 4.8) |
| `results.ts` | Filtering and sorting (section 4.9), used by `searchListings` |

### 6.5 Later, on Supabase

The filters become a SQL `where`, search becomes Postgres full-text search with trigram matching for typos, and photos and pickup points get their own tables (`listing_images`, `pickup_points`), as in the old demo's data model.

---

## 7. Components and rendering

### 7.1 Browse

```
app/browse/page.tsx          <Suspense fallback={<BrowseSkeleton />}> around BrowseView
components/browse/
  BrowseView.tsx             reads searchParams and the viewer's campus, parses, searches, lays out
  BrowseHeader.tsx           eyebrow, h1, search form
  CategoryTabs.tsx
  BrowseToolbar.tsx          Filters and Sort summaries, the count
  FiltersPanel.tsx
  SortMenu.tsx
  ActiveFilters.tsx
  ResultsGrid.tsx            hidden h2, the list, Show more
  BrowseEmpty.tsx
  BrowseSkeleton.tsx         same size as the real page: title, tabs, toolbar, 8 card skeletons
```

All Server Components. Browse adds no client code.

### 7.2 Listing

```
app/listings/[id]/page.tsx              prerendered per listing; params awaited inside <Suspense>, as now
app/listings/[id]/opengraph-image.tsx   the share card
components/listing/
  ListingView.tsx       lays the page out
  Gallery.tsx
  ListingPanel.tsx      title, price, swap callout, actions, collect box, seller card
  ListingActions.tsx    Message link, SaveHeart, ShareButton; the dock styling
  ShareButton.tsx       "use client"
  CollectBox.tsx
  CampusNote.tsx        reads the viewer inside <Suspense fallback={null}>
  AvailabilityBanner.tsx
  SellerCard.tsx
  ListingFacts.tsx
  SafetyNote.tsx
  MoreFrom.tsx
```

`RecordRecentlyViewed` stays.

### 7.3 Shared pieces and link changes

- **Moved:** `ListingCard`, `Photo` and `SaveHeart` move from `components/home/` to `components/listings/` (with their tests), since three pages use them. Imports are updated; nothing else changes.
- **Links that skip the redirects:**
  - Homepage category tiles, the menu's categories, the footer's categories and the search overlay's categories link to `/browse?cat=…`.
  - The menu's and footer's campus lists link to `/browse?campus=…`.
  - The menu's "All campuses" links to `/browse?campus=all`. "Everything" stays `/browse`.
  - The footer's "Shop your campus" links to `/browse`, which now defaults to the chosen campus.
  - Category and campus links in the menu become plain links rather than `NavLink`, because `NavLink` matches on the path and would mark every `/browse?…` link as current.
- **Removed** (with Lama's go-ahead at build time): `app/categories/[slug]/page.tsx` and `app/c/[campus]/page.tsx`.

### 7.4 Next.js docs to read before building

In `node_modules/next/dist/docs/`: `generateMetadata` with `searchParams` under Cache Components; `redirects` in `next.config.ts`; `opengraph-image` and `next/og`; `searchParams` in pages. Check browser support for CSS `scroll-initial-target` and the `name` attribute on `<details>`.

---

## 8. Loading, empty and error states

| Situation | What shows |
|---|---|
| Browse loading | `BrowseSkeleton`, the same size as the page |
| Browse search fails | "We couldn't load listings just now." with a "Try again" link to the same URL. No JavaScript, like the homepage's section errors |
| Nothing matches | Section 4.7 |
| Bad link parameters | Ignored (section 3.2) |
| Unknown listing | The branded 404 |
| More from fails | The homepage's section error in its place; the rest of the page is unaffected |
| Campus lookup fails | Falls back to every campus, as now; the campus note doesn't show |
| Share fails | The toasts in section 5.8 |

The site-wide `error.tsx` belongs to the next stage (`GO-LIVE.md`, section 1).

---

## 9. Accessibility (WCAG 2.2 AA)

Everything in the homepage spec's section 10 applies. In addition:
- One h1 per page. Browse has a hidden "Results" h2 above the cards' h3s; the listing page's sections use h2s.
- Category tabs are a `nav` with `aria-current="page"`; the breadcrumb is a `nav` labelled "Breadcrumb".
- Filters and Sort are native `<details>`, so the keyboard and screen readers already know how to use them. Their summaries have full names ("Filters, 2 active", "Sort: Newest"). Form groups are fieldsets with legends; the campus select has a visible label.
- Chips are links named "Remove filter: Midrand".
- Show more lands on the first new card.
- The phone photo strip is a focusable, labelled region; each photo has alt text with its position.
- The dock never hides the focused element (2.4.11), through `scroll-padding-bottom`.
- Touch targets are at least 44px, colours stay within the brand tokens, and there's no new motion.
- Every flow works without the app's JavaScript bundle. (React's inline script is still needed to place the streamed body.)

---

## 10. Performance budget

The homepage budget (homepage spec section 11) applies to each page's first visit:
- **JavaScript:** 150 KB or less, brotli at quality 5. Browse adds nothing beyond the shell and the Save hearts, apart from `ScrollToResult` (a small client effect, rendered after Show more only). The listing page adds `ShareButton`, a few hundred bytes.
- **Fonts:** 60 KB or less (unchanged).
- **Total before below-the-fold photos:** 350 KB or less.
- **Layout shift:** 0.05 or less.
- **Prefetch:** card links don't prefetch (decision 28). The Message and Report links don't prefetch.

---

## 11. Testing

**Unit (Vitest, next to the code):**
- `parseBrowseParams`: every parameter, the `max` alias, unknown, empty and repeated values, `n` rounding and capping, the campus fallback and `campusFromLink`.
- `browseHref`: parameter order, dropped defaults, the campus only when it came from the link, `n` dropped on any change but Show more.
- `activeFilters`, `clearAllHref`, `clearFiltersHref`.
- Search: AND matching, prefixes, one-edit tolerance at 5+ letters only, accents, stop words, seller and category names, the score and its tie-break.
- Filtering and sorting: every rule in section 4.9, including free first in `price-low`, swap-only last in both price sorts, swap-only left out of price filters, and paused and sold hidden.
- Data: `searchListings` (items and `elsewhere`), `getListingDetail`, `getMoreFrom` and its fallback, `getFreeAndSwaps` returning the same items in the same order as before.
- Fixture checks (section 6.2).
- Components: tabs (`aria-current`), toolbar labels, chips, the empty state's variants, `priceLabel`'s new wording, the collect box and campus note, the availability banner, `ShareButton`'s three paths, and the login placeholder's `next` check.

**End to end (Playwright at 360, 390, 768, 1024 and 1440):**
- Every homepage, menu, footer and search link that goes to browse lands on the right results: budget chips, both "See all" links, categories, campuses, a search.
- Filtering, sorting, Show more (lands on card 25) and Clear all.
- The browse flow again with the app's JavaScript bundle blocked.
- The campus default: a chosen campus shows its chip; removing it shows every campus; a campus in the link wins.
- The two redirects.
- The listing page: the dock on phones, the column that stays in view on desktop, the sold banner, the 404 for an unknown id, and a keyboard walk.
- axe on browse (default, filtered, empty) and a listing (available and sold): no serious or critical issues.
- Layout shift on both pages.
- Each page's JavaScript budget.

**Review screenshots** in `docs/progress/browse-listing/`, at 390 and 1440, for Lama.

---

## 12. Not in this stage

- Sign-in, messages, the report form, the WhatsApp handoff, following sellers.
- The seller storefront and Saved pages (their links work but stay placeholders).
- Posting to Looking For.
- Delivery between campuses.
- A live result count in Filters, a custom price range, saved searches and alerts.
- Supabase and real photos.
- The site-wide error page and offline page.

## 13. How we'll know it's done

- `pnpm lint` and `pnpm typecheck` are clean.
- `pnpm test` and `pnpm e2e` pass, with axe finding no serious or critical issues.
- Both pages meet section 10's budget.
- Lama has reviewed the screenshots.
- `docs/PROGRESS.md`, `docs/reference/LANDING-DECISIONS.md` and `docs/reference/GO-LIVE.md` are updated.
