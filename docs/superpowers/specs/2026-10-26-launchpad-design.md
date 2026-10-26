# Launchpad: the Hub page, renamed and made clear: design

Date: 2026-10-26 · Status: built (decision 93), 2026-10-26. Section 10 lists what the build changed. It replaces section 5.1 of `2026-10-14-community-pages-design.md` and renames the page.

## 1. What Lama asked for

1. The Hub page's purpose isn't clear, and its square blocks make it confusing.
2. Rename it from "The Incubation Hub". Lama chose **Launchpad** (2026-10-26).
3. Spec and plan before building.

## 2. What's wrong today

`/hub` stacks three unrelated things, all drawn as the same bordered box:

1. **An about block** (`HubStory`): the organisation's name as the h1, two paragraphs, and a banner photo that takes half the first screen. Until the Hub sends a photo, that is an empty gradient.
2. **Verified by the Hub** (`VerifiedSellers`): every verified shop as a square tile with a 56px round photo, the name and the campus. With no Verified mark and nothing about what the shop sells, the tiles read as category buttons. A two-line campus ("Cape Town Tyger Valley") makes one tile taller than the rest.
3. **What's on and what's new** (`HubFeed`): events, office hours and tips mixed in one three-column grid of boxed cards. This is the only part that changes week to week, and it starts below the fold.

The page is about an organisation when it should be about what a student can do there. Who it serves:

- **Student sellers, and students thinking of selling (the main reader):** mentors, office hours, pitch nights, workshops and tips.
- **Buyers:** one fact. Verified shops have been met and checked.

## 3. The name

**Launchpad is the place. The Eduvos Incubation Hub is the team that runs it.** The Hub is a real body that checks, verifies, pauses and hides. That wording stays, so nothing says "Launchpad paused your shop".

| Changes to Launchpad | Stays the Hub / Incubation Hub |
|---|---|
| The page's h1, tab title and description | "Verified by the Hub" (listing seller card, notifications, the trust page) |
| Header quick link and menu: "Hub" becomes "Launchpad" | Paused, hidden or approved "by the Hub" (sell pages, You, staff pages) |
| Footer link: "Incubation Hub" becomes "Launchpad" | Terms, privacy, safety, how it works, seller guidelines, trust |
| Trail label for `/hub` ("Launchpad › Event" on a post) | The footer's "An Eduvos Incubation Hub project" |
| A post page's "More from the Hub" becomes "More from Launchpad" (`UpcomingPosts`) | Collections' "Curated by the Incubation Hub" and "More from the Hub" (`MoreFromHub`, about collections) |
| Home's Hub banner button: "Our story" becomes "Visit Launchpad" | The banner's label and title ("backed by the Hub") |
| Staff notice `post-published`: "It's on Launchpad." | The staff console's names ("Hub console", "Hub tools", "Posts and office hours") |

**Not renamed in this pass (internal, like `vossie_`):** the `/hub` and `/hub/[id]` addresses, `/hub/manage`, the `hub-*` CSS classes, `components/hub/`, `lib/hub*`, `HubPost` and the database's names. Moving the public address to `/launchpad` (with a permanent redirect from `/hub`) is open question 1.

## 4. The page (`/hub`)

One column, `max-width` about 48rem for reading, left-aligned in the page's content edge. From `desk:`, the shops list may use the full width (4.4). No banner photo on this page. Home's banner keeps its photo.

### 4.1 The intro (static shell)

- On a pale (`#E1F0F7`) panel with a 16px radius, no border:
  - eyebrow "For student businesses" (muted);
  - h1 **Launchpad** (navy, `font-display`);
  - lede, one sentence: "Free help to start and grow your business on campus: mentors, office hours, pitch nights and workshops." (Sample wording for the Hub to change, as before.)
  - two actions in a row (wrapping on narrow phones), each at least 44px tall:
    - **Book office hours**, navy pill, to `/hub?type=office-hours#hub-coming-up`;
    - **Start selling**, outline pill, to `/sell` (default prefetch: `/sell` has no client component, and the header prefetches it on every page anyway).
- The panel replaces `HubStory` and `getHubBanner()` on this page. Nothing loads before the h1, so the h1 is the LCP.

### 4.2 Coming up (streamed)

- h2 **Coming up**, id `hub-coming-up`.
- Type tabs as links, as today: All, Events, Office hours (`?type=events#hub-coming-up`, `office-hours`). **Tips leaves the tabs** (4.3). An old `?type=tips` link reads as All (the existing `readHubFeedType` fallback for an unknown value), and its section is still on the page.
- Upcoming events and office hours, soonest first (unchanged rules: `startsAt` on or after today in SAST).
- **Each post is a row, not a box:**
  - a date block on the left: day number and short month ("28 / OCT"), navy on panel grey, `aria-hidden="true"`;
  - then the kind as an eyebrow ("Event", "Office hours");
  - the title (h3) as the link, covering the row;
  - one line, "Wed 28 Oct · 18:00 · The Hub, Block C · Midrand". The `<time>` element carries the full date, so the hidden date block is never the only copy;
  - for events, "46 going · 120 places".
  - Rows are separated by a 1px rule (`var(--color-line)`), with no card border or shadow. Touch target: the whole row.
- Empty: "Nothing planned right now. Check back soon." Error: "We couldn't load what's coming up just now." with Try again.
- Skeleton: the tabs and three row outlines (`HubFeedSkeleton`, reshaped). It must not be taller than the shortest state, the empty one (CLAUDE.md, dynamic routes).

### 4.3 Tips (streamed, in the same boundary as Coming up)

- h2 **Tips**, id `hub-tips`.
- Newest first, every tip (the sample has few; a cap is open question 2).
- **Each tip is a row:** the title (h3) as the link, the posted date, and the one-line summary. No date block, no eyebrow (the heading says what they are).
- Empty: "No tips yet." The error is shared with Coming up: one reader, one message.
- Both lists stream in one `Reveal` boundary because they come from one `getHubPosts` read.

### 4.4 Verified shops (static shell, after the streamed lists)

- h2 **Verified shops**, then one line: "The Hub has met every one of these shops and checked who runs it." with a link "How Verified works" to `/trust` (sky-dark).
- A list of rows, A to Z (unchanged order): a 40px round photo, the name (navy, semibold) as the link to `/sellers/[slug]` (`CARD`, no prefetch), then "{category} · {campus}" (muted, one line, ellipsis), and the check icon with "Verified" (from `components/icons.tsx`).
- One column on phones, two from `wide:`, three from `desk:`. Rows separated by a 1px rule, no boxes. No sideways scrolling.
- Hidden when there are none. If the read failed, `SectionError` as today.
- Data saver: the photos don't load (`.hub-sellers` already sits in the data saver rule; keep the class).

### 4.5 The credit (static shell)

- One muted line at the bottom: "Launchpad is run by the Eduvos Incubation Hub, the team behind CampusCart."

### 4.6 Order and why

Intro, Coming up, Tips, Verified shops, credit. What changes and what a seller acts on comes first. The shops are reference, so they come last.

**Layout shift:** Verified shops sits below a streamed boundary, so the boundary's height change moves it. It starts below the first screen at 360 to 1440 (the intro plus the skeleton fill it), so the shift is outside the viewport and counts zero. `tests/e2e/cls` checks `/hub` at 360, 390 and 1440. If a short screen catches it, the fallback is to move the shops above the stream (decision for the build, recorded in section 8).

## 5. Metadata

- Title: "Launchpad". Description: "Free help for Eduvos student businesses: mentors, office hours, events and tips, and the shops the Incubation Hub has verified."
- `?type=` views keep the one title and stay indexed (plan decision 14 of community pages).

## 6. Accessibility (WCAG 2.2 AA)

- One h1, h2 per section, h3 per post and tip.
- The tabs keep `LinkTabs` (`aria-current="page"` on the current one).
- The date block is decorative (`aria-hidden`); the row's `<time>` is the date.
- Every link is at least 44px tall; focus shows on the row through the link's `::after` (the current `hub-card-link` pattern).
- Contrast: navy and ink on pale and white; sky only as a solid pill fill or icon, never text.
- axe on `/hub`, `/hub?type=events` and a post page, at 390 and 1440.

## 7. Performance

- Server Components only. No client JS change is expected: `HubStory`, `VerifiedSellers` and `HubFeed` are already server-only.
- One photo fewer on the first screen (the banner), and seller photos drop from 56px to 40px.
- The page's bytes are recorded in progress (decision 81's habit).

## 8. Open questions for Lama

1. **The address.** Keep `/hub` (recommended for now: staff pages, the sitemap, the trail map and tests all use it), or move the public pages to `/launchpad` with a 308 from `/hub` and `/hub/[id]` in a second pass?
2. **Tips cap.** Show every tip (recommended while there are few), or the newest 5 with "All tips"?
3. **Header width.** "Launchpad" is six letters longer than "Hub" in the header's seven quick links (Shop, Sell, Campuses, Hub, Looking For, How it works, Safety). The build checks they still fit on one line at 1024 and 1440. If they don't, Lama picks which link moves to the menu only.

## 9. Not in this part

- The staff console's names.
- Home's Hub banner layout (only its button text changes).
- A seller directory page of its own.

## 10. What the build changed

- **Lama's answers (spec 8):** keep `/hub`; show every tip. The header's seven quick links fit on one line at 1024 and 1440 (measured), so nothing moved.
- **A trail above the intro.** Another session's change to wayfinding (decision 91, amended) made `/hub` a page under Home, so it leads with "‹ Home" (the whole trail from the tablet step) above the intro. The page keeps that line.
- **Tips' breadcrumb.** A tip's page links its "Tips" crumb to `/hub#hub-tips` (`hubFeedHref("tips")`), since Tips is no longer a tab. `HUB_FEED_TABS` holds the three tabs; `HUB_FEED_TYPES` still names the four groups for the crumbs.
- **One stream.** Coming up and Tips, with their h2s, render inside the page's one `Reveal`. Its skeleton is the heading's line, the tab row and two rows (not three), which keeps it shorter than the empty state.
- **The error** says "We couldn't load what's coming up just now." and covers both lists.
- **Kept:** `HubPostCard` and the `hub-card` and `hub-feed-list` rules, for a post page's "More from Launchpad".
- **Deleted:** `HubStory`, `VerifiedSellers` and their tests. `getHubBanner()` is still read by Home's banner.
