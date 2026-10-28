# Vossie homepage: design spec

- **Date:** 2026-10-08
- **Status:** Revision 2, updated with Lama Nkuna's review answers (header behaviour, fonts, categories, crest, photos, pnpm)
- **Scope:** the new Vossie homepage plus the global shell (announcement bar, header, menu, campus picker, search overlay, footer) and the design tokens and components the homepage needs.

## Related documents (all in `docs/reference/`)

| File | What it is |
|---|---|
| `LANDING-DECISIONS.md` | Every decision made in the brainstorm, with dates |
| `FUNCTION-MAP.md` | Every function of the existing demo (108), business rules, inferred data model, Eduvos brand facts |
| `LIVE-INVENTORY.md` | Audit of the live demo, its defects and a screenshot set (`old-demo-screens/`) |
| `BRIGADE-REFERENCE.md` | How brigadeoverland.com's homepage works (the layout reference) |
| `mockups/` | The approved brainstorm screens, with `home-v2.html` as the approved structure. These are fragments made for the brainstorm viewer, so they don't open standalone |
| `brand/` | Crest artwork (cleaned from a screenshot; replace with Eduvos's official SVG) |

---

## 1. Goal

Build a homepage for Vossie, the Eduvos student marketplace. It should feel as clean and confident as Brigade Overland's homepage, use the Eduvos brand correctly, and work best on the phones most Eduvos students use.

This stage delivers the homepage and shell on realistic sample data. Other pages get simple placeholder routes so every link works.

## 2. Decisions this spec builds on

1. **Header badge:** a white Eduvos crest inside a navy pennant, hanging from the header into the hero (Brigade-style indent).
2. **Campus choice:** campus first, never locked. Picking a campus puts it first everywhere; "All campuses" is always one tap away.
3. **Structure:** the 14-section page in `mockups/home-v2.html`, including all eight extras.
4. **Layout rule:** no two neighbouring sections may share a layout.
5. **Footer:** bold.
6. **Header behaviour:** scrolling down hides the whole header, crest included; scrolling back up brings all of it back. Phones also get a tab bar (Home, Shop, Sell, Saved, Account) that is always on screen (section 6.2; Lama, 2026-10-20, replacing the pinned crest).
7. **Priority:** works at every screen size, with mobile usability first.
8. **Codebase:** a new repo at `~/Projects/Vossie`, same stack as the demo, with sample data behind a data layer that can switch to Supabase later. Package manager: pnpm.
9. **Fonts:** try Eduvos's own fonts (Cocogoose Pro and Larken) once Eduvos supplies the files; until then use the mockup fonts, and compare the two before choosing (section 4).
10. **Categories:** the ten in section 7.5, open to change later.
11. **Crest:** Eduvos has approved the crest inside the pennant. The current cleaned artwork is used until the official SVG arrives.
12. **Photos:** Lama supplies them after the homepage is built. The build uses placeholders at the final sizes.

---

## 3. Stack and project setup

| Area | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript, React Server Components by default. Client components only where there is interaction (header, carousels, sliders, toggles, sheets) |
| Styling | Tailwind CSS v4 with the brand tokens in section 4 as the theme |
| Versions | Latest stable releases, checked against current docs at setup time |
| Package manager | pnpm (10.30.1 is installed; Node v26.10) |
| Fonts | Two swappable font sets behind CSS variables (see section 4). Interim: Special Gothic Condensed One + Geist through `next/font/google`. Target: Eduvos's Cocogoose Pro + Larken through `next/font/local` once Eduvos supplies the files |
| Icons | One small set of inline SVG components (24px grid, 1.8px stroke). No icon library, no emoji as icons |
| Images | `next/image` with correct `sizes`, AVIF/WebP, blur placeholders, fixed aspect ratios. Placeholder art until real photos arrive (section 12) |
| Motion | CSS transitions and keyframes plus small React hooks. No animation library in the homepage bundle |
| Data | A typed data layer (`lib/data/`) reading sample fixtures (`data/fixtures/`) shaped like the future Supabase tables. Swapping to Supabase changes only the data layer |
| Testing | Vitest + React Testing Library for component behaviour; Playwright for responsive, keyboard and reduced-motion checks; axe for accessibility |
| Hosting | Vercel later; nothing in this stage depends on it |
| Project memory | A project `CLAUDE.md` recording the stack, brand rules, POPIA notes and the git safety rules |
| Version control | Created only when Lama asks. No `git init` or commits without Lama's go-ahead |

---

## 4. Brand and design tokens

### Colour

| Token | Value | Use |
|---|---|---|
| `navy` | `#15305D` | Eduvos navy. Brand surfaces, headings, primary buttons, footer |
| `sky` | `#29ABE2` | Eduvos sky blue. Fills behind navy text, highlights, accents on navy |
| `sky-dark` | `#1E7BA8` | Links and eyebrows on white |
| `white` | `#FFFFFF` | Page background |
| `panel` | `#F3F3F3` | Grey panels (collections, buying card) |
| `pale` | `#E1F0F7` | Pale sky panels (free and swaps) |
| `text` | `#373F41` | Long body copy |
| `muted` | `#5B6577` | Secondary text |
| `line` | `rgba(21,48,93,.14)` | Hairlines and borders |
| `idle` | `#B9C0CC` | Decorative only (the sheet handle) |
| `idle-text` | `#7E879A` | Inactive large display text (campus names, collection titles); 3.6:1 on white |

**Contrast rules (WCAG AA):**

- Sky never carries text, icons or thin borders on white (2.6:1).
- Navy on sky and sky on navy are fine for any text size (5.0:1).
- Links on white use `sky-dark` (4.7:1). White on navy is 13:1.
- `idle-text` grey is only for large display text that has a navy active state next to it, never for information on its own.

### Typography

| Style | Font | Phone (360-430px) | Desktop (1280px+) |
|---|---|---|---|
| Hero headline | Special Gothic Condensed One, uppercase | 44px, line-height 0.96 | 64px, line-height 0.97 |
| Section heading | same | 34px | 46px |
| Eyebrow | same, 1px letter-spacing | 15px | 18px |
| Large list text (campus names, collections) | same | 24px | 40px |
| Body | Geist | 15px, line-height 1.55 | 16px, line-height 1.6 |
| Small and meta | Geist | 12-13px | 12-13px |
| Button label | Geist 600, uppercase, 1.3px letter-spacing | 11px | 11.5px |

Sizes between phone and desktop scale smoothly with `clamp()`. Body text is never under 12px, and form inputs are at least 16px so iPhones don't zoom on focus.

### Font sets (interim now, Eduvos's own to try)

Every component uses three font variables, never a font name: `--font-display` (headlines, eyebrows, prices, big lists), `--font-text` (body and UI) and `--font-accent` (optional italic accents).

| Variable | Interim set (from the approved mockups) | Eduvos set (to try once the files arrive) |
|---|---|---|
| `--font-display` | Special Gothic Condensed One | Cocogoose Pro (variable), bold weights, or Larken Bold/Black. Both get tried on the hero and section headings |
| `--font-text` | Geist | Cocogoose Pro (variable), regular weights |
| `--font-accent` | Geist italic | Larken Medium Italic |

- **Files to request from Eduvos marketing** (the names eduvos.com serves), each as `.woff2`, with written confirmation that the licence covers Vossie's domain:
  - `cocogoose-pro`
  - `LarkenBlack`, `LarkenBold`, `LarkenMedium`, `LarkenMediumItalic`
- **Comparing.** A development-only switch flips the whole page between the two sets, so Lama can compare them on real screens before choosing.
- **Width risk.** Cocogoose Pro is far wider than the condensed interim face, so the same headline takes more room. Layouts must never depend on a narrow font: no fixed-width text boxes, headlines wrap freely, and sizes are set per font set. The hero and Shop by campus are re-checked at every test width after the switch.
- **Loading.** Only the weights actually used are loaded, as Latin subsets; the 60KB font budget in section 11 still applies.

### Shape, space and texture

- **Radii:** 16px for hero and large panels, 14px for cards and tiles, 12px for strips, 999px for pills and buttons.
- **Spacing:** 4px base. Sections are 72-92px apart on desktop and 52-56px on phones. Page gutters are 24-40px on desktop and 10-16px on phones. Content max width is 1200px.
- **Borders:** 1.5px. Mostly flat, with no drop shadows except the soft shadow under the pinned crest-only pennant.
- **Texture:** a four-point-star pattern taken from the crest, as an inline SVG, used only on navy surfaces at 13% sky.
  - Small text on the texture is white.
  - Sky is used there only for large text (24px+, or 18.66px+ bold), icons and arrows, solid sky pills, and the decorative wordmark.
  - The reason: small sky text drops to about 4.0:1 where a star sits behind a letter (decision 14, 2026-10-12).
- **Pennant:** flat top, straight sides, V-shaped base (`polygon(0 0,100% 0,100% 72%,50% 100%,0 72%)`) with a white edge 7px wide and 14px deeper underneath.

---

## 5. Responsive strategy (mobile first)

- **Design order.** Every section is designed at 360px first, then widened.
- **Test widths:** 360, 390 and 430 (phones), 768 (tablet), 1024 (small laptop), 1280 and 1440 (desktop).
- **Breakpoints:** two steps, each with a height guard so a phone held sideways keeps the phone layout.
  - **Tablet step, `wide:`:** at least 768px (48rem) wide and 480px (30rem) tall. Phone layouts run below it. Split and grid layouts start at it.
  - **Desktop step, `desk:`:** at least 1024px (64rem) wide and 480px tall. Full desktop compositions start here.
  - In component CSS these are `@media (min-width: 48rem) and (min-height: 30rem)` and `@media (min-width: 64rem) and (min-height: 30rem)`. Tailwind's `md:` and `lg:` aren't used.
- **Touch.** Every tappable target is at least 44x44px with 8px between targets. Primary actions sit in the lower two-thirds of the phone screen where thumbs reach.
  - Rows in a list divided by hairlines, such as the menu's sub-lists and the campus picker, may touch. Each row is still at least 44px tall.
- **No hover-only features.** Hover effects are extras, enabled only under `(hover: hover) and (pointer: fine)`. Everything works by tap and keyboard.
- **Swipe rows.** Horizontal rows use native CSS scroll-snap, show a peek of the next card, and have a progress bar. Desktop adds arrow buttons; keyboard arrows work when the row has focus.
- **Phone extras.** Respects the iPhone notch and home bar (safe-area insets). Landscape phones use the phone layout. Tablets get the split hero.
- **Low-data mode** (kept from the demo). Turns off autoplay and animation, lowers image quality, and loads photos below the fold only when tapped.

---

## 6. Global shell

### 6.1 Announcement bar
- **Desktop.** Navy bar inset from the edges with rounded bottom corners. A sky tag plus one line, e.g. "New · Live on all 12 Eduvos campuses · Free to list".
- **Rotation.** Up to 3 messages, cross-fading every 6 seconds, pausing on hover or focus.
- **Phone.** Wraps to at most two lines. Full-width tap target.

### 6.2 Header (hides on the way down, comes back whole on the way up) and the phone tab bar

Revised 2026-10-20 (decision 75). Until then the crest stayed pinned on screen and a tap on it brought the header back.

**Contents:**
- **Desktop and tablet:**
  - Left: a labelled Menu button and the campus pill (current campus, opens the campus picker).
  - Centre: the pennant (a link to the homepage, accessible name "Vossie home").
  - Right: Search, Account, and Saved with its count.
  - Above the header from the desktop step (`desk:`) up: a quick-link row (Shop, Sell, Campuses, Hub, How it works, Safety).
- **Phone:**
  - Left: Menu. Centre: the pennant. Right: Search. Account and Saved are in the tab bar.
  - The campus chip lives at the top of the hero panel and in the menu.

**States:**

| State | When | What it looks like |
|---|---|---|
| Expanded | Page is near the top (scrolled less than 120px) | The full header: announcement bar, quick-link row on large screens, the header bar with all its items (78px desktop, 64px phone), and the pennant at full size hanging into the hero with its white edge: about 28px of navy on desktop, about 15px on phones (25px with the white edge) |
| Hidden | Scrolled down past 120px | The quick links, the bar, its items and the pennant slide up out of sight together, as one sheet (220ms, accelerating). The announcement bar scrolls away with the page. Nothing of the header is left on screen |
| Shown | Hidden, then scrolled back up 40px | The same sheet slides back down (320ms, decelerating) at the current scroll position. The bar is compact (56px phones, 64px larger screens), and the pennant hangs below it with a soft shadow so it reads over any content. It takes that look while out of sight, so the slide is the only movement. The page does not move |

**Moving between states:**
- **Scrolling down** past 120px from Expanded goes to Hidden.
- **Scrolling up** 40px from the lowest point since hiding goes to Shown. Less is a wobble and does nothing.
- **From Shown,** scrolling down 80px from the highest point since showing returns to Hidden.
- **Scrolling back** above 120px always returns to Expanded.
- **iOS's bounce** past the bottom of the page is not scrolling up: positions are kept inside the page.
- **The pennant** is always the home link (on the homepage it scrolls to the top).

**Rules:**
- **Accessibility:**
  - While hidden, the quick links and the bar (pennant included) are `inert`, so keyboard and screen-reader users can't land on invisible controls.
  - In their place, a "Show navigation" button (`aria-expanded="false"`) is unseen until focused, like the skip link, then shows as a navy pill at the top centre. It shows the header without moving the page and moves focus to Menu.
- **Reduced motion:** with reduced motion or low-data mode on, every change is instant (no slide or fade).
- **Focus:** hiding never moves focus out of a control someone is using; the header stays while keyboard focus is in it.

**Phone tab bar** (below the tablet step, landscape phones included):
- **Tabs:** Home (`/`), Shop (`/browse`), Sell (`/sell`), Saved (with its count) and Account (`/account`, or sign-in when signed out, with the red new-notifications badge). Each is an icon with a visible label, 56px tall and a fifth of the width.
- **Always on screen,** fixed to the bottom, clear of the iPhone home bar. It does not hide with the header.
- **Current tab:** navy with a pale pill behind its icon (`aria-current`). Shop, Sell and Account also mark the pages under them.
- **Sell** is a solid sky pill with a navy plus, and navy with a white plus on its own pages.
- **Room:** the page keeps room under the footer and under anything focused, and toasts sit above the bar.
- **Gives way:** to a listing's dock (a listing's own actions first, and two bars would cover too much of a small screen), and while someone types in a text field, so it never rides on the on-screen keyboard.
- **Cost:** rendered on the server; the only client code is the current-tab check (shared with the header) and Saved's count. Only Home and Sell prefetch, as the header already does.

### 6.3 Menu
- **Panel.** Full-screen navy panel with the star texture and big condensed links: Shop, Sell, Campuses, Hub, How it works, Safety, Account. Arrows drill into Categories and Campuses.
- **Campus switch** at the top of the menu. Tapping it closes the menu and opens the campus picker, so after choosing, the visitor is back on the page and the confirmation is seen and announced (Lama, 2026-10-12).
- **Behaviour.** Opens with a 300ms slide and fade. Focus is trapped inside while open; Esc and the close button dismiss it, and focus returns to the Menu button.

### 6.4 Campus picker
- **Form.** A popover under the campus pill on desktop; a bottom sheet with a drag handle on phones.
- **Contents.** "All campuses" pinned first, a "Find your campus" search box, the 12 campuses with their province, and Eduvos Online. The current choice has a tick.
- **Choosing a campus:**
  - Saves it in a cookie (`vossie_campus`; saved to the profile once accounts exist).
  - Updates the campus-aware sections (Just listed, Featured, Shop by campus highlight, hero chip, header pill).
  - Shows a short confirmation: "Showing Midrand first".
- **Default.** First-time visitors default to All campuses.

### 6.5 Search overlay
- **Form.** Full-screen overlay with the input focused.
- **Contents.** Recent searches (stored on the device), trending searches on the current campus (sample data), and category shortcuts.
- **Submit.** Goes to `/browse?q=` (a placeholder route in this stage).

### 6.6 Footer (bold)

**Desktop, top to bottom:**
1. Two giant links side by side, "Shop your campus" and "Start selling", in the display face with sky arrows.
2. Five columns:
   - Campus updates sign-up (email field; the confirmation is shown on screen only, nothing is stored in this stage; POPIA consent line) with "Add Vossie to your home screen" underneath.
   - Shop links.
   - Sell links.
   - Help links, including Privacy (POPIA).
   - All 12 campuses plus Eduvos Online.
3. The legal row with the small pennant lockup: "An Eduvos Incubation Hub project".
4. A full-width VOSSIE wordmark sized to fill the footer width exactly, cropped slightly at the bottom.

**Phone:** the slim footer (decision 94, `2026-10-28-phone-footer-design.md`): the sign-up and install button, six info links in two columns, the lockup and the wordmark. No giant links, no accordions.

**Add to home screen:**
- Uses the browser's install prompt where supported.
- On iPhones, opens a short sheet explaining Share → Add to Home Screen.

---

## 7. Homepage sections

Each section lists layout, behaviour, states and data. Numbers match the approved mockup.

### 7.1 Announcement bar and 7.2 Header
See 6.1 and 6.2.

### 7.3 Hero slider

**Content.** Three slides with a fixed headline frame and one changing word:

| Slide | Headline | Body | Primary CTA |
|---|---|---|---|
| 1 | "Buy & sell **textbooks** on campus" | "Set books and notes from students who aced the module, handed over at a campus pickup point." | "Shop textbooks" |
| 2 | "Buy & sell **tech** on campus" | "Laptops, calculators and chargers from students on your campus, checked when you meet." | "Shop tech" |
| 3 | "Buy & sell **services** on campus" | "Braids, tutoring, logos and repairs from students who do it well." | "Shop services" |

- The changing word is sky blue. Every slide also has a secondary "Start selling" button.

**Layout:**
- **Desktop and tablet:** navy textured panel on the left (38%), photo on the right.
- **Phone:** photo on top (4:3), then the panel, with the campus chip as its first element.

**Motion:**
- The photo cross-fades (500ms) while the word slides up (350ms).
- Autoplay every 7 seconds.
- Autoplay pauses on hover, on focus, when the tab is hidden, and once someone interacts. It is off for reduced motion and low-data mode.

**Controls:**
- Three photo thumbnails act as slide buttons, plus a Pause/Play button (needed for accessibility), bottom-right of the photo.
- Swipe works on touch.

**Loading.** The first slide's photo loads with priority; the others load lazily after the page settles.

### 7.4 Context strip (under the hero)
Changes with the visitor:

| Visitor | Shows |
|---|---|
| First visit | Trust strip: Verified Incubation Hub sellers · Approved campus pickup points · Never pay before you see it · "How trust works" |
| Returning, signed out | "Pick up where you left off": up to 6 recently viewed items (stored on the device) |
| Signed in | Activity: new messages, sales waiting for confirmation, saved items back, plus recently viewed and "Open inbox" |

- **Phone:** trust items become a swipe row of chips; the activity card stacks.
- **This stage:** shows the first-visit and returning states for real. The signed-in state uses sample data behind a development switch (no accounts yet).

### 7.5 Shop by category + budget (the first carousel)
- **Categories (confirmed, may change later, so they live in data, not code):** Textbooks & notes, Tech, Res & living, Fashion & thrift, Food, Hair & beauty, Tutoring, Services, Tickets & events, Stationery.
- **Tiles:**
  - Square photo tiles with the label top-left and a round arrow in a cut-out bottom-right corner.
  - Swipe row on all sizes: about 2.3 tiles visible on phones, 4 on tablets, 6.5 on desktop.
  - Arrows on desktop, progress bar underneath.
- **Budget row** under the tiles: Under R50, Under R100, Under R250, Free, Swaps. These link to browse filters.

### 7.6 Collections
- **Layout:**
  - Desktop and tablet: a grey panel with a fanned photo stack on the left and four Hub-curated collections on the right (small sky-dark eyebrow + large title).
  - The active title is navy and the rest are idle grey.
  - Hovering or focusing a title deals its photo onto the stack (350ms).
- **Phone:** rows with a 64px thumbnail, eyebrow, title and arrow.
- **Sample collections:**
  - Start of semester / Back-to-campus essentials
  - Exam season / Notes, tutors & cram snacks
  - Moving in / Res setup under R500
  - Skills for hire / Book a student

### 7.7 Shop by campus
- **Desktop and tablet (Brigade's "Shop by brand" pattern):**
  - Centred eyebrow. Six campus names right-aligned on the left of one square campus photo, six left-aligned on the right.
  - Each name has a small live-listing count. The current campus is navy with a sky underline; the others are idle grey.
  - The highlight cycles every 4 seconds with a photo cross-fade. It pauses on hover or focus, stops after any interaction, and is off for reduced motion and low-data mode.
  - "All campuses" and "Eduvos Online" buttons sit underneath.
- **Phone:** the swipeable campus card carousel. "All campuses" comes first (textured navy card), then a photo card per campus with its live count. The selected campus has a sky ring.
- **Choosing a campus** does the same as the campus picker (6.4) and scrolls to Just listed.

### 7.8 Just listed
- **Header:** "Just listed" eyebrow and "New at {campus}" heading (or "New on all campuses").
- **Switch:** a segmented control, [{Campus} | All campuses].
- **Links:** "See all" goes to browse.
- **Grid:** 2 columns on phones, 3 on tablets, 5 on desktop. Up to 10 items, 4 on phones.
- **Card:**
  - Square photo with a Save heart.
  - Title, clamped to 2 lines.
  - Price in the display face ("R250", "From R400", "Swap").
  - The shop's name on one line, then the campus, and the trust badge (decision 89).
- **Switching campus or scope** shows matching skeleton cards until the data arrives.
- **Empty:** "Nothing new at {campus} yet", with a button that switches to All campuses.
- **Save:**
  - Updates instantly and rolls back with "Couldn't update. Try again." if it fails.
  - In this stage, with no accounts, it remembers saves on the device. A quiet note says saves will sync once sign-in exists.

### 7.9 How it works
- **Layout:** two cards. Buying is a grey card, Selling a navy textured card. Each has three numbered steps and a button.
- **Safety row underneath:** Verified sellers · Approved pickup points · Never pay before you see it.
- **Phone:** the cards stack.

### 7.10 Featured today
- **Content:** the demo's fair daily seller draw. Four seller cards with photo, Featured tag, business name, tagline, Verified seal, category and campus.
- **Link:** "How we pick".
- **Layout:** desktop grid of 4; swipe row on phones and tablets.
- **Empty:** the section hides if there are no featured sellers.

### 7.11 Looking For band
- **Layout:** full-width sky band with navy text.
  - Left: "Can't find it? Ask for it." with "Post a request".
  - Right: three open requests from the campus, with the number of offers each has.
- **Phone:** stacks, showing two requests.
- **This stage:** the button goes to a placeholder page.

### 7.12 Free & swaps
- **Layout:** pale sky panel with a swipe row of item cards stamped FREE (navy) or SWAP (sky-dark).
- **Header:** "Pass it on" with "See all".
- **Empty:** the section hides.

### 7.13 Hub banner + What's on
- **Banner:** full-width photo with a navy gradient overlay, and rounded top corners that sit on the footer.
  - Left: "The Eduvos Incubation Hub", "Built for student hustles, backed by the Hub", a short paragraph and "Our story".
  - Right: a white "What's on" card with the next three events (date block, title, campus, RSVP or Book).
- **Phone:** the photo and text stack, with the events card underneath.
- **Empty:** with no events, the card says "No events this week" and links to the Hub.

### 7.14 Footer
See 6.6.

---

## 8. Motion system

| Token | Value |
|---|---|
| `--dur-fast` | 150ms (button presses, hovers) |
| `--dur-base` | 250ms (toggles, fades, image fade-in) |
| `--dur-slow` | 400ms (sheets, slide changes). The menu opens in 300ms (section 6.3). |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` (pennant pop, save heart) |

**Rules:**
- **Smooth.** Animate only `transform` and `opacity`.
- **One moment at a time.** Nothing loops for decoration.
- **Content first.** Content is fully visible even if an animation never runs. Scroll reveals (a 16px rise and fade) are an enhancement that only applies where supported.
- **Off switches.** All motion is off under `prefers-reduced-motion` and in low-data mode.
- **Autoplay pauses** for hover, focus, hidden tab and interaction.
- **Not in this stage.** View Transitions between pages are left for when the other pages exist.

**Signature moments:**
- Header hiding (220ms, accelerating) and coming back on the way up (320ms, decelerating), as one sheet.
- Pennant pop (420ms spring).
- Hero word change.
- Collections photo deal.
- Campus highlight cycle.
- Save heart pop.

---

## 9. Loading, empty and error states

- **Rendering.** The page renders on the server. Data sections stream in behind skeletons with the exact final dimensions, so nothing jumps (layout shift budget 0.05).
- **Skeletons** exist for the listing card, seller card, campus count, request row and event row.
- **Photos** sit in fixed-ratio boxes over a pale preview, so nothing moves while they load. There's no blur-up or fade-in: either would need JavaScript on every image (Part 2 plan decision 8).
- **Buttons** that do something show a pending state ("Saving…") and confirm with a short toast.
- **Errors.** Each data section has its own error state with a "Try again" button; one failing section never blanks the page.
- **Empty states** as listed per section above.

---

## 10. Accessibility (WCAG 2.2 AA)

- **Page structure:** landmarks (header, nav, main, footer) and a "Skip to content" link. One H1 (the hero headline), then one H2 per section.
- **Labels:** every icon button has an accessible name (Brigade's menu button doesn't; ours does). `aria-current` marks the current page and campus.
- **Focus:** visible on every surface. A sky ring with a navy halo on navy areas, navy ring on white.
- **Carousels:** labelled regions with previous/next buttons and keyboard support. The hero has the required pause control.
- **Motion:** reduced motion fully respected.
- **Touch:** targets at least 44px.
- **Images:** alt text comes from the data; textures and decorative shapes are hidden from screen readers.
- **Overlays:** the menu, campus sheet and search overlay trap focus while open and return it when closed.

---

## 11. Performance budget

Measured on a mid-range Android over 4G, matching the audit findings (the demo's homepage cost about 0.55MB with 354KB of JS, CSS and fonts).

| Measure | Target |
|---|---|
| JavaScript on first load | 150KB or less, brotli-compressed as a host serves it (quality 5; decision 13) |
| Fonts | 60KB or less (two Latin-subset files) |
| Whole homepage, first visit | 350KB or less before below-the-fold photos |
| Largest Contentful Paint | 2.5s or less |
| Cumulative Layout Shift | 0.05 or less |
| Interaction to Next Paint | 200ms or less |
| Lighthouse (mobile) | Performance 90+, Accessibility 95+ |

**How:**
- The crest is an SVG (a few KB, not a 54KB PNG). Every image has correct `sizes`.
- The homepage is statically generated with periodic refresh once live data exists.
- Only interactive pieces ship JavaScript.

---

## 12. Photos and assets needed from Lama

- **When.** Lama supplies the photos after the homepage is built.
- **Until then.** The build uses clearly labelled placeholder art at the right ratios, so swapping them in later changes no layout. Each image slot reads its file from data, so swapping a photo is a file drop plus one line.
- **Crest.** Eduvos has approved the crest inside the pennant. The current cleaned artwork (`docs/reference/brand/`) is used until the official SVG arrives.
- **Fonts.** See section 4 for the files to request from Eduvos.

| Asset | How many | Ratio and minimum size | Notes |
|---|---|---|---|
| Hero photos | 3 | 4:3 and 16:10, 2000px wide | Textbooks, tech, services. Real Eduvos students, natural light |
| Campus photos | 13 | 1:1, 1200px | Each of the 12 campuses plus something representing Eduvos Online |
| Category photos | 10 | 1:1, 800px | One per category in 7.5 |
| Collection photos | 4 | 4:5, 1200px | Back to campus, exam season, res setup, skills for hire |
| Hub banner | 1 | 21:9, 2400px wide | Incubation Hub people or an event |
| Featured seller portraits | 4 (samples) | 4:3, 1000px | Real sellers will upload their own later |
| Eduvos crest | 1 set | SVG | Official navy and white versions (pennant use already approved) |
| Eduvos fonts | 5 files | `.woff2` | `cocogoose-pro`, `LarkenBlack`, `LarkenBold`, `LarkenMedium`, `LarkenMediumItalic`, with licence confirmation for Vossie |

All photos of people need the people's consent (POPIA).

---

## 13. Data (sample now, Supabase later)

Types live in `lib/types.ts`. The homepage only calls these functions, which read fixtures in this stage:

| Function | Returns |
|---|---|
| `getCampuses()` | Campus: `slug`, `name`, `region`, `liveListings`, `image` |
| `getCategories()` | Category: `slug`, `name`, `image` |
| `getCollections()` | Collection: `slug`, `eyebrow`, `title`, `image` |
| `getJustListed({ campus, limit })` | Listing: `id`, `title`, `priceZar`, `priceIsFrom`, `payMode` (cash, swap, both), `campusSlug`, `image`, `badge`, `createdAt` |
| `getFeatured({ campus })` | Seller: `slug`, `name`, `tagline`, `category`, `campusSlug`, `verified`, `image` |
| `getRequests({ campus })` | LookingForRequest: `id`, `title`, `campusSlug`, `offers` |
| `getFreeAndSwaps({ campus })` | FreeSwapItem: `id`, `kind` (free, swap), `title`, `campusSlug`, `image` |
| `getHubEvents({ campus })` | HubEvent: `id`, `date`, `title`, `campusSlug` or all, `action` (rsvp, book) |
| `getViewerContext()` | Viewer: chosen `campus`, `signedIn`, sample `activity` |
| `getAnnouncements()` | Announcement: `id`, `tag`, `text`, `href` (the announcement bar, 6.1; added in the build plan) |
| `getTrendingSearches()` | Trending terms keyed by campus slug, plus `all` (the search overlay, 6.5; added in the build plan) |

- **Fixture realism.** Fixtures cover all 12 campuses plus Online, so campus switching and empty states can be tested. At least one campus has no new listings.
- **Content.** Names are generic ("Hair studio", "Maths tutor"), not the demo's sellers.

---

## 14. Routes in this stage

- `/`: the full homepage.
- **Placeholders** that render inside the shell with a short "Coming in the next stage" message, so every link works:
  - `/browse`, `/sell`, `/hub`, `/how-it-works`, `/safety`, `/privacy`, `/looking-for`, `/login`, `/account`, `/saved`
  - `/c/[campus]`, `/categories/[slug]`, `/collections/[slug]`

---

## 15. How we'll know it works

**Automated tests:**
- Header states:
  - Hidden after 120px: nothing of the header is visible, and it is inert.
  - 40px back up shows everything without moving the page; a smaller wobble doesn't.
  - Another 80px down hides it again.
  - Back at the top: expanded.
  - Hidden, the keyboard's "Show navigation" button shows it and focuses Menu.
- Tab bar: five tabs in order, the current one marked, Saved's count and Account's badge.
- Hero autoplay and pause rules.
- Carousel buttons and keyboard.
- Campus choice saved and applied.
- Just listed scope switch, including the empty state.
- Footer wordmark fitting.

**Playwright, at 360, 390, 768, 1024 and 1440px:**
- No sideways scrolling at any width.
- After scrolling down, the header is gone at every width; scrolling up brings it back without moving the page.
- On phones the tab bar stays on screen and never covers the footer.
- Every interactive element is reachable by keyboard.
- With reduced motion on, nothing autoplays.
- axe finds no serious or critical issues.

**Visual review:**
- Screenshots at each width, checked against `mockups/home-v2.html` before calling the stage done.

**Lighthouse** mobile scores meet section 11.

---

## 16. Not in this stage

- Every other page: browse, listing, storefront, sign-in, selling, inbox, Hub, admin.
- Real accounts and Supabase data.
- Real photos (until supplied).
- Analytics.
- Push notifications.
- Page-to-page transitions.

---

## 17. Review answers (2026-10-08) and what's still outstanding

| # | Question | Answer |
|---|---|---|
| 1 | Pennant behaviour | After scrolling, only the crest stays; tapping it pops the whole header back out (section 6.2). Replaced 2026-10-20 (decision 75): the whole header hides and comes back on scrolling up, with a tab bar on phones |
| 2 | Fonts | Try Eduvos's own (Cocogoose Pro, Larken); interim mockup fonts until the files arrive (section 4) |
| 3 | Categories | Keep the ten in 7.5 for now |
| 4 | Crest | Approved inside the pennant; use the current artwork until the official SVG arrives |
| 5 | Photos | Lama supplies them after the homepage is built |
| 6 | Package manager | pnpm |

**Still outstanding (none of these block the build):**
- Eduvos's font files and licence confirmation.
- The official crest SVG.
- The photos.
