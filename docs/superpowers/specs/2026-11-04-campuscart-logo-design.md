# CampusCart logo: the crest's stars in a cart: design

Date: 2026-11-04 · Status: built (decision 98).

## 1. What Lama asked for

A CampusCart logo that keeps Eduvos's identity while looking like a campus "cart". The first idea was the Eduvos crest inside a shopping cart.

What the brainstorm settled (2026-11-04, all Lama's choices):

- **Where it goes:** the app icon and favicon, and the header pennant. Not the footer lockup, the share cards or print.
- **Direction C, the stars ride in the cart,** over A (the whole crest sitting in the basket) and B (the crest as the basket, with a handle and wheels added). A and B changed or re-framed Eduvos's mark, and both blurred at 16 px.
- **C1, the line cart,** over C2 (a solid navy basket) and C3 (a solid basket shaped like the crest's panel).
- **C1b, the crest rim,** over C1a (just bolder lines) and C1c (the big star rising out of the basket). The basket's top edge is the crest's top edge, so the mark reads as Eduvos without using the crest.

## 2. The mark

A line-drawn shopping cart in one colour, with three four-point stars in the basket.

- **The rim is the crest's top edge.** The crest's upper panel has a raised corner at each end and a dip in the middle where its two halves meet. In the mark:
  - the handle's grip is the raised left corner;
  - the basket's right end rises into the right corner;
  - the rim dips once in the middle.
- **The stars are the crest's three stars:** a big one in the middle and a small one either side, in the same order as on the crest.
- **The wheels are two rings,** echoing the ring at the top of the crest.
- **Round caps and joins on every line.** No gradients, no outlines, no shadows.

### 2.1 Two drawings

| Drawing | Used at | Line weight (in a 200 × 175 grid) | Stars |
|---|---|---|---|
| Full mark | 48 px and larger: the pennant, the loader, the favicon's 48, the 180, 192 and 512 icons | 11 (wheels 10) | Three |
| Small cut | 32 px and smaller: `icon.png` (64 × 64, which browsers show at 32 or 16), the favicon's 16 and 32 | 17 (wheels 14) | One, the big star |

The small cut also deepens the rim: the right corner rises higher and the middle dip goes lower, so the crest's edge survives at 16 px.

### 2.2 Starting geometry

The approved sketch was drawn in a 200 × 175 grid with these paths. The build redraws them by hand into clean SVG files and may move points by a unit or two for balance, but not change the shape.

```
Handle and base (stroke): M10 24H32L58 124H174
Rim and basket (stroke):  M38 46H104Q117 46 117 56Q117 46 130 46H170Q182 46 182 32H192L177 106H54
Small cut's rim:          M38 46H101Q117 46 117 60Q117 46 133 46H166Q182 46 182 28H191L177 106H54 (built with 191, not the sketch's 192, so its heavier join stays inside the grid)
Wheels (stroke):          circles r 11 at (84, 150) and (156, 150)
Stars (fill, concave four-point): small at (88, 79) size 11 and (148, 79) size 11; big at (118, 81) size 19
Small cut's star:         (118, 79) size 20
```

A four-point star of size `s` at `(x, y)`: `M x y-s Q x y x+s y Q x y x y+s Q x y x-s y Q x y x y-s Z`.

### 2.3 Colour

| Where | Mark | Big star | Small stars |
|---|---|---|---|
| On white (light surfaces) | Navy | Navy | Navy |
| On a band (the pennant, the icons) | `on-band` | Sky | `on-band` |
| Night's pennant | `on-band` (`#ECE7DF`) | Night's sky (`#4FA9D1`) | `on-band` |

Sky never sits on white (CLAUDE.md's brand rule), so on white all three stars are navy. Sky on navy is allowed, and it's a graphical object, so WCAG 1.4.11 asks 3:1. Sky on navy is about 5:1 (decision 14 measured 4.97:1). The Night pair joins `lib/theme-contrast.test.ts`'s list if it isn't there.

## 3. Where it goes

### 3.1 The header pennant

The cart replaces the crest inside the navy pennant (`components/brand/Pennant.tsx`, size `"header"`). The pennant's shape, white edge, shadow and sizes don't change.

- **Size.** The mark is wider than the crest, so it's sized by width: about 50 px wide on phones (inside the 64 px pennant) and 68 px from the `wide:` step (inside 86 px). That's about 44 and 60 px tall, the crest's heights today. The 3× check in the sketch shows the clearance at the sides is enough.
- **Centred on its weight, not its box** (Lama, 2026-11-05: it looked off-centre). The handle reaches out left, so the box's centre (x 101) sits left of the ink's (x 112), and a box-centred cart looks pushed right. `CartMark`'s viewBox is moved so x 112 is its middle (`MARK_CENTRE_X`), and the icons centre on it too, keeping the handle at least 6% of the size from the edge.
- **From a server slot.** `SiteHeader` is a client component, so it takes the pennant as a `pennant` prop that the layout fills, like `account` and `phoneSaved`. That way the mark is HTML, not JavaScript.
- **Inline SVG, coloured by tokens.** The mark is a Server Component that renders an inline `<svg>` using `currentColor` for the lines and the small stars, and `var(--color-sky)` for the big star. Each theme then colours it with no image swap. Night no longer needs the crest's `brightness(0.88)` filter, because Night's own `on-band` and sky tokens already dim it.
- **It keeps the breathing.** It keeps `pennant-crest motion-own` (or a renamed class with the same rules), so `NavPending`'s 150 ms breathing and the reduced-motion and data-saver dimming work as before (decision 90). Only `opacity` and `transform` animate.
- **Decorative.** The mark is `aria-hidden`, as the crest is. The link around it keeps its accessible name.
- **Forced colours.** `forced-color-adjust: none` stays on the pennant, so the mark keeps its colours in Windows high contrast.

### 3.2 The loading screen

`CrestLoader` (`components/brand/CrestLoader.tsx`, only in `PageFallback`) shows the navy cart in place of the navy crest, at the crest's height (56 px, so about 64 px wide), with the same 1 s delay and breathing. It should match the header's mark (Claude's recommendation, in the approved design). The component keeps its name until the second internal-names pass.

### 3.3 App icon and favicon

| File | Size | Drawing | Notes |
|---|---|---|---|
| `app/favicon.ico` | 16, 32, 48 | Small cut at 16 and 32, full mark at 48 | Navy tile with rounded corners (18%, as before), white cart, sky star |
| `app/icon.png` | 64 | Small cut | Shown at 32 or 16; rounded corners like the favicon |
| `app/apple-icon.png` | 180 | Full mark | Full-bleed navy; iOS rounds the corners |
| `public/icons/icon-192.png` | 192 | Full mark | |
| `public/icons/icon-512.png` | 512 | Full mark | |
| `public/icons/icon-maskable-512.png` | 512 | Full mark | The whole mark inside the 80% safe circle (radius 205 of 256) |

The file names and `app/manifest.ts` don't change, so nothing else needs editing. A script kept in the repo (`pnpm icons`) makes the icons from the mark's geometry module, so they can be made again when the mark changes.

### 3.4 What keeps the crest

- The footer lockup (`Pennant` size `"small"`: the white pennant with the navy crest).
- The share cards (`app/opengraph-image.tsx` and the listing and seller cards).
- `assets/brand/crest-navy.png` and `crest-white.png` stay, for these.

So the Eduvos crest is still on every page (in the footer) and on every shared link.

## 4. Files

- New: `lib/brand/cart-mark.ts`, the only drawing of the mark (both cuts), which the component and the script both read.
- New: `components/brand/CartMark.tsx`, the Server Component for the inline mark, used by `Pennant` and `CrestLoader`.
- New: `scripts/make-icons.ts` (`pnpm icons`), with `lib/brand/icons.ts` (which files, what sizes) and `lib/brand/ico.ts` (the favicon file). It uses the sharp that comes with Next, so no new dependency. It replaces `scripts/make-icons.py`, which drew the old crest icons and was deleted (Lama, 2026-11-05).
- Generated: four masters in `assets/brand/`, `campuscart-mark-navy.svg` and `-white.svg` (full) and `campuscart-mark-small-navy.svg` and `-small-white.svg`. Navy is for white surfaces with all stars navy; white has the sky star, for navy surfaces.
- Changed: `Pennant.tsx` (header size only), `SiteHeader.tsx` (the `pennant` slot), `app/layout.tsx`, `CrestLoader.tsx`, `app/globals.css` (the pennant and loader mark sizes, Night's filter dropped for the mark), `lib/theme-contrast.test.ts`, the six icon files.
- Decision 98 in `docs/reference/LANDING-DECISIONS.md`; `docs/PROGRESS.md`.

## 5. Checks

- **Bytes.** The inline SVG adds about 1 KB of HTML per page and no JavaScript. Every page stays inside the 150 KB first-visit JS budget. Because it's no longer a `next/image` request, the header crest's image request disappears.
- **Looks.** Screenshots of the pennant at 375 and 1440 in Light, Dark and Night, shown at rest and pinned. The icons are viewed at their real sizes.
- **Tests.** Existing tests that name the crest in the header or the loader are updated to the mark. `lib/theme-contrast.test.ts` includes the pairs in 2.3. The axe and layout-shift checks on the home page and one listing still pass. There are no new e2e specs: the mark is static.

## 6. Before it goes live

- **Tell Eduvos.** Decision 10 approved the crest inside the pennant. This replaces it there with a CampusCart mark that borrows the crest's edge and stars without altering the crest. Add it to the GO-LIVE checklist beside the official crest SVG.
- **Don't trademark it or print it** until Eduvos has seen it (the submission comes first, as with the rest of the brand).

## 7. Not in this work

- A wordmark or a mark-and-name lockup. The footer keeps the CAMPUSCART wordmark and the crest lockup.
- Renaming `CrestLoader`, `pennant-crest` or other internal names (the second pass, decision 83).
- Pitch, print and social versions.
