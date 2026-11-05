# Guided tour: "Show me around this page": design

Date: 2026-11-05 · Status: phases 1 and 2 built (decision 99; phase 1 `e7f00e8`, `7a3314c`, `007a21b`; phase 2 in section 13).

## 1. What Lama asked for

A guided tour that walks people through the app and its features, started by a button they press, planned for the different screens, done the easiest and best way.

Lama's answers (2026-11-05):

| Question | Answer |
|---|---|
| How does the tour work across screens? | **A tour per screen.** It never changes page mid-tour. Home's tour covers the tabs or header and what each section is for. Turned down: one tour that travels from page to page (it breaks on sign-in, slow streams and role differences), and a static walkthrough page (it doesn't point at the real screen). |
| Where is the button? | **The menu, plus a Home nudge.** "Show me around this page" in the menu on every screen with a tour, and one dismissible "New here? Take the tour" line on Home. Turned down: a button beside every page heading, a `?` icon in the header. |
| What draws it? | **Our own small engine**, about 2 to 3 KB brotli, loaded only on the first tap. Turned down: driver.js (about 5 to 6 KB, CSS to override for three themes, its card isn't a real dialog), React Joyride and Shepherd (25 to 40 KB). |
| Behaviour and screens (section 3 and 4) | Approved as drafted. |
| How it's built (sections 5 to 9) | Approved as drafted. |

## 2. Constraints that shaped it

- **JS budget.** The listing forms are 152,753 B brotli, 847 B under 150 KB (decision 98). The tour may add only a launcher to every page; the engine and its words load on tap, as the menu's Theme and Data saver do (decision 95).
- **Roles.** The phone bar fits the account (decision 92): a seller has My shop and Messages where a student has Sell and Saved. One tour has to fit them all.
- **Phone and wide.** Phones point at the tab bar; from the `wide:` step the targets are the header's quick links and the section sidebars.
- **Static shells.** Home and most pages have a static shell. Whether the nudge shows can't come from a cookie or a server read.
- **WCAG 2.2 AA**, 44px targets, no hover-only features, motion only through `transform` and `opacity`, still under reduced motion and data saver.

## 3. What people see

### 3.1 Starting a tour

- **The menu.** A row, "Show me around this page" (route icon from `components/icons.tsx`), between Looking For and the settings. It shows only when the page on screen has a tour with at least one step it can show (section 6.2). Pressing it closes the menu, then opens the tour, as Change campus closes the menu before the campus picker. When the tour closes, focus goes back to whatever opened the menu.
- **The Home nudge.** One line on Home, under the context strip: "New here? Take the tour" (a button) and "Not now" (a button). It's in Home's static HTML for everyone; the boot script hides it before first paint for anyone who has finished the Home tour or pressed Not now (section 8). Take the tour opens the Home tour. Not now hides the line at once and remembers.

### 3.2 A step

- The page dims and one part stays lit, outlined in the `action` colour.
- A card shows the step's heading ("Step 2 of 5" above the title, both inside the heading), one or two sentences, and Back, Next (Done on the last step) and Close (an icon button, "Close the tour"). Back is left out on the first step, not disabled.
- **Phones (below `wide:`):** the card spans the screen's width less 16px each side and sits at the bottom, above the tab bar, or at the top when the lit part is in the lower half of the screen (the tab bar included).
- **From the `wide:` step:** the card (max 22rem) sits below the lit part, or above it when there's no room below, aligned to its start edge and kept 16px inside the viewport.

### 3.3 Fitting the person

Each step names the part it points at. A step whose part isn't on screen when the tour starts is skipped: a seller's My shop vs a student's Sell, the phone tab vs the header link, a card that failed (`SectionError`) or a feature whose switch is off. One tour fits every role and screen size with no separate versions. "Step N of M" counts only the steps that will show.

### 3.4 Ending

Escape, Close, or Done ends the tour; focus returns to the trigger (the menu's opener, or the nudge's button, which is gone after a finished Home tour, so focus goes to the page's `<main>`). The page can't be used while a tour is open: the modal dialog makes it inert, so a tap can't pull someone away halfway. Browser Back closes the tour.

### 3.5 Remembering

One browser-storage key, `vossie_tour_seen` (`"1"`), in `localStorage`, set when the Home tour reaches Done or the nudge's Not now is pressed. Closing the Home tour early doesn't set it. It is named on the privacy page; nothing goes to the server. Other screens' tours remember nothing.

## 4. The tours

3 to 5 steps each (Home up to 7). Words are drafts for Lama to edit; each body is at most 140 characters. `phone` / `wide` targets: the first one on screen wins.

### 4.1 Phase 1

**Home** (`home`, everyone)

| # | Target | Title | Body |
|---|---|---|---|
| 1 | `search` | Search | Look for anything on campus: textbooks, tech, services. Type a few words or a whole sentence. |
| 2 | `campus` | Your campus | We show your campus first. Change it any time. |
| 3 | `tab-shop` / `hdr-shop` | Shop | Every listing, by category, with filters for price and campus. |
| 4 | `tab-sell` / `hdr-sell` | Sell | Got something to sell? Open a shop and list it in a few minutes. |
| 4 | `tab-myshop` | My shop | Your listings, messages from buyers and this week's next steps. |
| 4 | `tab-mentoring` | Mentoring | The shops you mentor and who needs a check-in. |
| 4 | `tab-today` | Today | What's waiting for the Hub: shops, reports and bookings. |
| 5 | `tab-saved` / `hdr-saved` | Saved | Tap the heart on any listing and it lands here, so you can come back to it. |
| 5 | `tab-messages` | Messages | Talk to buyers and sellers. Meet on campus, in a public place. |
| 6 | `tab-you` / `hdr-account` | You | Notifications, your requests and your details, all in one place. |
| 7 | `menu` | The menu | Categories, Launchpad, Looking For, and your theme and data saver. |

The rows numbered 4 and 5 are alternatives: only the tab the bar is showing has a target on screen, so one of each shows (`barFor` decides). Home is the one tour allowed more than 5 steps, because it covers the whole navigation: 7 at most (search, campus, Shop, the role's main tab, slot four, You, the menu), fewer when a target isn't on screen. At the wide step there's no My shop, Mentoring, Today or Messages target in the header, so a seller or staff member sees Sell's header link only if the header shows it, and otherwise skips steps 4 and 5.

**Shop / Browse** (`browse`)

| # | Target | Title | Body |
|---|---|---|---|
| 1 | `browse-categories` | Categories | Jump to one kind of thing. All shows everything. |
| 2 | `browse-filters` | Filters | Narrow by price, campus and condition. |
| 3 | `browse-sort` | Sort | Newest first, or cheapest first. |
| 4 | `browse-save-search` | Save this search | We'll tell you when something new matches, once a day at most. |
| 5 | `browse-photo` | Search with a photo | Take a photo of something and we'll find ones like it. |

**A listing** (`listing`)

| # | Target | Title | Body |
|---|---|---|---|
| 1 | `listing-gallery` | Photos | Swipe through the seller's photos. |
| 2 | `listing-seller` | The seller | Every seller is a student business. Verified means the Hub has checked them. |
| 3 | `listing-message` | Message the seller | Ask a question or arrange to meet. Keep chats on CampusCart. |
| 4 | `listing-save` | Save | Keep it for later in Saved. |
| 5 | `listing-report` | Report | Something wrong with this listing? Tell the Hub. |

**Sell, for an approved seller** (`sell`)

| # | Target | Title | Body |
|---|---|---|---|
| 1 | `sell-needs-you` | Needs you | Buyers waiting for a reply and sales to mark sold. |
| 2 | `sell-coach` | This week | Up to three small steps to help your shop this week. |
| 3 | `sell-add` | Add a listing | Photos first. We can fill in the details from your photo. |
| 4 | `sell-bar` | Your shop's sections | Listings, messages and your shop's profile. |

The visitor's `/sell` (the pitch) and a waiting or declined shop get no `data-tour-page`, so the menu row doesn't show there.

**You** (`you`)

| # | Target | Title | Body |
|---|---|---|---|
| 1 | `you-for-you` | For you | New messages, offers and notifications, newest first. |
| 2 | `you-stuff` | Your stuff | Your saved listings, requests and saved searches. |
| 3 | `you-details` | Your details | Your name and campus. |
| 4 | `you-privacy` | Privacy | Download your data or delete your account. |

### 4.2 Phase 2

Looking For (`looking-for`: what it is, Post a request, how offers work), Launchpad (`hub`: Coming up, Book office hours, Tips, Verified shops), Messages (`messages`: your conversations, offers, the safety line), the listing form (`listing-form`: Photos, Fill in from my photo, the publish check), the admin's Today (`admin-today`: the queue, the numbers, the console's sections) and Mentoring (`mentor`: the caseload, flags, Export). Their words are written in phase 2's plan, against the screens as they are then.

## 5. The pieces

| Piece | Where | Runs | Job |
|---|---|---|---|
| Tour words | `lib/tour/tours.ts` | engine chunk only | `TOURS: Record<TourId, readonly TourStep[]>`, where `TourStep = { target: TourTarget \| readonly TourTarget[]; title: string; body: string }`. Plain data. |
| Names | `lib/tour/targets.ts` | types, plus one tiny helper | `TourId` and `TourTarget` unions, and `tourAttrs(target)` returning `{ "data-tour": target }` (typo-proof in JSX, a few bytes). |
| Step resolving | `lib/tour/resolve.ts` | engine and menu | `resolveSteps(steps, find)`: keeps each step whose first target `find` returns, with that element. `findTourPage(doc)`: the visible `[data-tour-page]` element (section 6.1). |
| Card placing | `lib/tour/place.ts` | engine | `placeCard(target, viewport, card, wide)`, a pure function returning `{ x, y, side }`. |
| Page markup | pages, `SiteHeader`, `TabBar`, section bars | server | `data-tour-page="<id>"` on each toured page's outer element, `data-tour="<target>"` on each part. No client code. |
| `TourHost` | root layout, beside the other overlays | every page, about 200 B | Listens for `openOverlay("tour", trigger)` and lazy-loads `Tour` (`lazy(() => import(...))`) on first open, then mounts it with the trigger. |
| Engine | `components/tour/Tour.tsx` | on first open | The dialog, the lit window, the card and the step state (section 7). |
| Menu row | `components/menu/MenuDrawer.tsx` | already client | On open, `resolveSteps` is run for the visible page with a list of each tour's targets kept in the menu chunk. The row shows when it returns at least one step. |
| Nudge | `components/home/TourNudge.tsx` | Home | Server markup with one small client island, `TourNudgeButtons`, for its two buttons. |

`OverlayName` in `lib/overlays.ts` gains `"tour"`.

**The menu's target lists.** The menu can't import `lib/tour/tours.ts` (its words would join every page's first load). `lib/tour/targets.ts` exports `TOUR_TARGETS: Record<TourId, readonly (TourTarget | readonly TourTarget[])[]>`, the targets alone, and a unit test checks it matches `TOURS` exactly. At ten tours of about five targets each it is a few hundred bytes; if the build shows it costs more than 300 B brotli, the menu instead shows the row whenever a visible `[data-tour-page]` exists and the engine says "Nothing to show here right now" in the card when no step resolves.

## 6. Finding the page and its parts

### 6.1 Which page

Next keeps pages you've left in the DOM, hidden. `findTourPage` takes the first `[data-tour-page]` element whose `checkVisibility()` is true. A step's target is searched inside that element, then in the shared chrome (`.site-header`, the tab bar, the section shell). Only elements with `checkVisibility()` true and a non-zero box count, so the phone tab bar is skipped on wide screens and the header's quick links on phones.

On Home at the wide step, Shop, Sell and Saved are header quick links (`hdr-*`) and You is the account icon.

### 6.2 Missing parts

`resolveSteps` runs once when the tour opens. Steps without a target on screen are dropped, and "of M" counts what's left. Zero steps: the menu row didn't show, so this only happens if the page changed between the menu opening and the tap; the card then says "Nothing to show here right now" with Close.

### 6.3 Scrolling, resizing, rotating

- On each step the engine calls `target.scrollIntoView({ block: "center", behavior })`: `"smooth"`, or `"instant"` under reduced motion and data saver.
- The header hides on scroll (`useHeaderMode`). When a step's target is in the header, the engine dispatches `NAV_PENDING_EVENT` (`components/ui/NavPending.tsx`), which already asks the header back.
- The engine measures the target with `getBoundingClientRect()` on each step, and again (one `requestAnimationFrame` per burst) on `resize`, `scroll` (passive) and a `ResizeObserver` on the target.
- If the current target stops being visible (a rotation past the `wide:` step), the engine runs `resolveSteps` again from that step and moves to the first one it can show, or closes when none is left.

### 6.4 Leaving

The engine listens for `popstate` while open and closes the tour. Links can't be tapped (the page is inert), so no other navigation happens.

## 7. The engine

### 7.1 Structure

```
<dialog class="tour" aria-labelledby="tour-title" aria-describedby="tour-body">   ← showModal(): focus trap, Escape
  <div class="tour-window" style="translate: Xpx Ypx; width; height" />          ← the lit window
  <section class="tour-card" style="translate: ...">
    <h2 id="tour-title" tabindex="-1"><span>Step 2 of 5</span> Saved</h2>
    <p id="tour-body">…</p>
    <button>Back</button> <button>Next</button> <button aria-label="Close the tour">×</button>
  </section>
</dialog>
```

- The dialog fills the viewport, has a transparent `::backdrop`, and `cancel` (Escape) closes the tour through the same path as Close.
- `.tour-window` is positioned with `translate` and sized with `width`/`height` (never animated). Its `box-shadow: 0 0 0 100vmax var(--tour-scrim)` dims everything around it, and `outline: 2px solid var(--action)` with a 4px offset draws the ring. It covers the target with 6px of padding and the target's own border radius plus 6px.
- Focus moves to the heading on each step, so screen readers read "Step 2 of 5, Saved" and then the body. The body text says what the part is, so the tour works without seeing the window.
- The engine owns its open and close (it renders on first open, so it can't use `useOverlayDialog`, whose dialog must exist from the first commit). It follows the same contract: `showModal()` on mount, focus back to the trigger on close.

### 7.2 Look

- The card: `bg-white`, `text-navy` heading, `text` body, `rounded-2xl`, 16px padding, Next and Done as solid `action` / `on-action` buttons, Back and Close as quiet buttons, all at least 44px tall. Fonts only through `font-display` and `font-text`.
- A new token, `--tour-scrim`, in each theme's token block: Light `rgb(21 48 93 / 0.62)` (navy), Dark `rgb(5 14 30 / 0.7)`, Night `rgb(0 0 0 / 0.72)`. It is a dim, not a surface words sit on; `lib/theme-contrast.test.ts` gains a check that `action` (the ring) stands at least 3:1 against the scrim over `white` in all three themes.
- No `#fff`, `white` or `navy` literals in the CSS (decision 95's token rule).

### 7.3 Motion

- The window jumps to each new target: it's sized with `width`/`height`, and only `transform` and `opacity` may animate.
- The card fades in and rises 8px on each step (`opacity`, `translate`, 160 ms, the site's ease-out), and the dialog fades in on open.
- Under reduced motion and `html[data-low-data]`, nothing moves: the card simply appears.

### 7.4 Bytes

`TourHost` and the nudge's island on Home are the only new code in first loads. The engine, `lib/tour/tours.ts`, `resolve.ts` and `place.ts` are in the lazy chunk. After `pnpm build`, a grep for a step's words (for example `"lands here, so you can come back"`) in `.next/static/chunks/*.js` matches only the tour's chunk, and each page's first-load bytes are recorded in the decisions log line.

## 8. The Home nudge and the boot script

- `lib/boot-script.ts` gains one read: `localStorage.getItem("vossie_tour_seen") === "1"` sets `<html data-toured>`, inside a `try` like the theme's. The key and attribute names live in `lib/tour/seen.ts`, which the boot script and `TourNudgeButtons` both import (it holds strings only, so client code never imports the boot script; `lib/install-event.ts` is the model).
- CSS: `html[data-toured] .tour-nudge { display: none; }`. The line takes no space for someone who has seen it, from first paint, so nothing shifts.
- **Not now** writes the key (in a `try`) and sets `data-toured` on `<html>`, so the line disappears at once.
- **Finishing the Home tour** does the same at Done. Closing early doesn't.
- The service worker is untouched (`WORKER_VERSION` doesn't change).

## 9. Testing

Only tests that guard a real risk (Lama's efficient testing).

**Unit (Vitest, next to the code)**
- `resolveSteps`: the first visible target wins; a step with no target on screen is dropped; hidden kept pages are ignored.
- `placeCard`: phone bottom and top, wide below and above, kept 16px inside the viewport at 320px wide.
- `lib/tour/tours.test.ts`, reading the folders: every target in `TOURS` appears as `data-tour="…"` or `tourAttrs("…")` in `app/` or `components/`; every `data-tour-page` value has a tour; `TOUR_TARGETS` matches `TOURS`; every body is 140 characters or fewer.
- `app/privacy/page.test.tsx` already fails until the privacy page names `vossie_tour_seen`.
- `lib/theme-contrast.test.ts`: the ring against the scrim, in all three themes.

**End to end (`tests/e2e/tour.spec.ts`, read-only, device projects)**
- Home at phone-390 and desktop: open the menu, press Show me around this page, Next through to Done; Escape on a second run returns focus to the menu button.
- axe on the open card (phone and desktop).
- Signed in as the sample seller, step 4 is My shop; signed out, it's Sell.
- The nudge: Not now hides it; after a reload it is still hidden and the layout shift is 0.
- Shop, a listing, Sell and You: each one's tour opens and shows at least its first step (one test, phone-390).

`tour.spec.ts` writes nothing to the store, so it stays in the device projects, not in `WRITES`. Every `browser.newContext(` in it says `serviceWorkers: "block"`.

## 10. Build order

**Phase 1**
1. `lib/tour/` (names, resolving, placing, the words for Home, Shop, a listing, Sell and You) with their unit tests.
2. The engine and `TourHost`, the `"tour"` overlay name, `--tour-scrim` in the three themes.
3. The page markup: `data-tour-page` and `data-tour` on the five pages, the header, the tab bar and the Sell bar.
4. The menu row, the Home nudge, the boot script read, the privacy page line.
5. `tour.spec.ts`, the build, the bytes, decision 99 in `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`.

**Phase 2**: the remaining six tours (section 4.2), markup and words only, plus one line each in the end-to-end tour test.

## 11. Out of scope

- A tour that changes page, or a "next screen" button at the end of one.
- Tours starting by themselves. Only the Home nudge invites, and only until it's seen.
- Counting who takes the tour. There are no analytics, and none are added.
- Interactive steps ("now tap Save"): the page is inert while a tour is open.

## 12. Changes from reading the code (planning, 2026-11-05)

The plan (`docs/superpowers/plans/2026-11-05-guided-tour.md`) builds to this section where it differs from the sections above.

1. **The menu row** sits at the top of the menu's settings area (`.menu-bottom`), sized like Data saver, with no icon. Among the menu's main links it would be set in their big display type, and no route icon exists.
2. **The menu's check** is section 5's fallback: the row shows when a visible `[data-tour-page]` exists. `TOUR_TARGETS` and `tourAttrs` are dropped; markup writes `data-tour="…"` (or a typed `tour` prop) directly. Every toured page always has its first part on screen, so "Nothing to show here right now" stays a safety net.
3. **Browse:** no "Search with a photo" step. Browse shows that link only in its empty state, and the search overlay isn't part of the page. Sort's words follow its real choices (best match, newest, price).
4. **A listing:** Message seller, Save and Share are one step (`listing-actions`), the one dock phones show. Four steps: photos, the seller, the actions, Report.
5. **Sell:** "New listing" lights the New listing and Messages buttons (`sell-add`), and its words don't mention filling in from a photo, which is off until go-live. A "Your listings" step (`sell-listings`) joins.
6. **You:** Your details and Privacy are one step, the Settings card (`you-settings`). Three steps.
7. **Home:** the phone's Sell tab and the header's Sell link share one step with neutral words, because a seller's wide header still shows Sell. The campus step lights the phone hero's campus chip (`hero-campus`) or the header's campus pill (`hdr-campus`).
8. **The ring** has its own token, `--color-tour-ring` (Light white, Dark sky, Night soft sky), not `action`: Light's navy action on the navy dim is under 3:1. The scrim is one alpha, 70%, in all three themes. The ring stands at 5.2:1 (Light), 7.1:1 (Dark) and 7.8:1 (Night) against the dim. The window's corners are a fixed 12px.
9. **Motion and the ring's offset** (stage B review): the ring sits 2px off the window, not 4px (the window's own 6px padding already clears the part). The card rises over the site's `--motion-enter` (220 ms) with `ease-out`, and the dialog has no fade of its own: the card's rise is the opening, so the dim simply appears with it.
10. **Engine details from the stage B review:** the dialog opens in a layout effect before the first step is placed, so the card is measured on screen. A step in the header asks the header back and skips scrolling (the header is sticky), and the window is placed again when the header's slide ends. Closing focuses the trigger after asking a hidden header back, falling back to `<main>`. A re-check after a part leaves the screen starts from the current step. If the tour's code can't load, the tour closes quietly.

## 13. Phase 2 tours (2026-11-05)

Plan `docs/superpowers/plans/2026-11-05-guided-tour-phase-2.md`. Words in `lib/tour/tours.ts`.

- **Looking For** (`looking-for`): Post a request, Categories, Open requests (the first board section shown, your campus's when you've chosen one).
- **Launchpad** (`hub`): Get started (Book office hours and Start selling), Your week (an approved shop, with Shop coach on), Coming up, Tips, Verified shops.
- **Messages** (`messages`, on both `/messages` and `/sell/messages`, through `InboxView`): Your conversations, Buying and selling (only with a shop), Refresh.
- **The new-listing form** (`listing-form`; the edit form has none): Photos, Fill in from my photo (only while photo-to-listing is on), Price, Publish or save.
- **Today** (`admin-today`): Waiting, Last week, Listings by campus, The console (the section bar).
- **Mentoring** (`mentor`): Your shops, Enquiries, Mentoring's section bar (where Export is).

Changes from section 4.2: Messages has no safety step (the safety tips are on the composer, not the inbox); Today's and Mentoring's last step lights their section bar (`staff-bar`, one target for both). The menu now checks for a visible `[data-tour-page]` inline rather than importing `lib/tour/resolve.ts`, so the tour ids stay out of every page's first load (`markup.test.ts` keeps every page id a real tour); that saved 268 B on every page.

## 14. Visual check (2026-11-05)

Seen in the dev server at 360 (Light, Dark, Night), 768 and 1440 (Light), and on Launchpad. Four changes:

1. **The card in the dark themes** steps up to the `panel` colour (the page's own colour was nearly the dim's, so its edge vanished), and has a `line` hairline in every theme.
2. **Tablet** has no tab bar and no quick links, so Home's Shop and Sell steps skip themselves there; the menu step names them ("Shop by category, Sell, Launchpad, Looking For…").
3. **A page still streaming in** (its `.skeleton` or `.page-fallback` showing in `<main>`) makes the engine wait for its parts, up to 4 seconds, before reading the steps: Launchpad opened mid-load had found 2 of its 4.
4. **A part taller than most of the screen** scrolls to its top, not its middle, and on phones the card stays at the bottom for a part taller than half the screen, so its heading shows.

## 15. Making the tour findable (2026-11-05)

Lama ran the dev build and couldn't find the tour: the menu row sat under the menu's big links, and Home's "New here?" row was below the first screen on phones. Lama chose:

1. **The menu's way in is the first thing in the menu:** "Show me around this page" as a solid sky pill (navy words) with an info icon, under Close and the campus, above Shop.
2. **A one-time invitation in the corner** replaces Home's row: "New here?" with Take the tour and a close button, bottom right, on the first toured page a visitor sees (a listing from a shared link as much as Home). On phones it sits above the one bar at the bottom (the tab bar, a section's bar or a listing's dock); from the tablet step 24px from the corner. Every toured page renders it inside its `data-tour-page` element, so it goes with its page and never shows where there's no tour. Either button answers it for good (`vossie_tour_seen`, hidden before first paint by the boot script); so does finishing any tour. It is plain server markup: `TourHost` answers its buttons with one document listener, because a client component on eleven pages put about 700 B on every page.
3. **No pop-up on idling or "stuck":** a page can't tell stuck from reading, an interruption mid-read is nagging, and watching for idleness would cost code on every page.
