# Brigade Overland home page: reference for the Vossie landing page

- **Source.** https://brigadeoverland.com/ observed 2026-10-08 at 1440x900 and 390x844 in an isolated browser.
- **What's borrowed.** Used for structure, rhythm and interaction patterns only. No Brigade copy, photography, logo or code is reused.
- **Status.** The "Vossie translation" column is a starting point for the brainstorm, not an agreed design.

## Page anatomy, top to bottom

The whole page is about 3,500px tall on desktop: a short page with very few section types.

| # | Block | What Brigade does | Possible Vossie translation |
|---|---|---|---|
| 1 | Announcement bar | Inset dark bar with rounded bottom corners. Small sand tag ("Free shipping") + one uppercase line + chevron, linking to info. Wraps to 2 lines on mobile | A tag + one line, e.g. a launch, safety or "free to list" message |
| 2 | Quick-link row | Six centred condensed links with hairline dividers (brands, Shipping, Returns). Desktop only | Top-level destinations: Shop, Sell, Campuses, Hub, How it works, Safety |
| 3 | Header | Sticky, ~82px. Left: hamburger + "MENU". Centre: badge logo hanging into the hero. Right: search (binoculars icon), account, "CART (0)". Mobile: menu + search left, badge centre, account + cart right, icons only | Menu, Eduvos crest badge, search, account, Saved or Inbox (Vossie has no cart), plus a campus control |
| 4 | Hero slider | Container with 15px radius. Desktop split ~37/63: left a solid colour panel (forest `#323C32`) with a faint contour-line texture holding an eyebrow, a 66px condensed uppercase headline, an 18px body line and a charcoal pill CTA; right a full-bleed photo. 3 slides keep the same eyebrow and headline frame and change one word. Floating control bottom-right: 3 photo thumbnails as slide buttons + play/pause. Mobile: photo on top, panel below | Navy panel with a crest-derived texture; a repeated headline frame with one changing word; real student photography |
| 5 | Category tiles | 6 square photo tiles (~205px). Label top-left in condensed caps over the photo. Round arrow button bottom-right, sitting in a concave cut-out corner of the tile. Mobile: swipe row, 2 tiles visible, progress bar underneath | School-marketplace categories |
| 6 | Collection spotlight | Rounded beige panel (`#E7E6DD`). Left: a fanned stack of photos. Right: 4 collections, each a small red eyebrow + big condensed title + arrow, separated by hairlines; inactive titles grey. Hovering a title deals its photo onto the stack. Mobile: rows of thumbnail + eyebrow + title + arrow | Curated student collections, or the campus picker |
| 7 | Shop by brand | Red eyebrow, brand names in big condensed type split left and right around one square photo; hovering a name swaps the photo | A natural fit for **Shop by campus**: campus names around one campus photo that swaps on hover or tap |
| 8 | About banner | Full-width photo with dark overlay, "About us" label, big headline, short paragraph, outline pill button | The Incubation Hub story, how Vossie works, trust and safety |
| 9 | Footer | Charcoal with the contour texture, small badge, newsletter email field, About and Help columns, socials, copyright | Crest, sign-up for campus updates, Help, Safety, Privacy (POPIA), Hub |

## Design tokens observed

| Token | Value |
|---|---|
| Display font | Special Gothic Condensed One (free, Google Fonts), always uppercase. Hero 66px/66px, section titles ~40px, links and eyebrows 18-20px |
| Body font | Geist (free, by Vercel). 16px body, 18px/27px hero text, 12px button labels with 1.2px letter-spacing |
| Colours | Charcoal `#1A1A1A` (text, buttons), beige panel `#E7E6DD`, forest `#323C32` (hero panel), slate `#2D4650` (menu drawer), sand `#BEB69E` (tag), red `#B43C32` (eyebrows, logo) |
| Shapes | 15px radius on hero, panels and tiles; fully rounded 50px pill buttons; circular icon buttons; hairline dividers |
| Motion | 0.2s `cubic-bezier(0.4, 0, 0.2, 1)` on hover and colour changes; Flickity slider with autoplay and a pause button; photo-stack swap on hover |
| Texture | One brand texture (topographic contour lines, low contrast) reused on the hero panel, menu drawer and footer |
| Restraint | About 6 colours, one display face, one body face, few section types, lots of whitespace |

## The hanging badge (the "indent")

- The logo is an SVG (about 115x90px on desktop) centred in the sticky header.
- Directly behind it sits a duplicate of the badge shape filled with the page colour, shifted about 15px down. That backing shape overlaps the top edge of the hero, so the header appears to bleed into the hero as a pointed tab.
- It stays in place while the page scrolls, so the badge keeps hanging over whatever passes underneath.
- **Eduvos fit.** The Eduvos crest is already a shield with a pointed base and its own chevrons, so the backing shape can follow the crest's silhouette. The ring at the top of the crest can read as the crest hanging from the header like a tag.

## Menu, search and cart

- **Menu:** full-screen slate panel with the contour texture, big condensed links, an arrow on items that drill into a sub-list, X to close. Its menu button has no accessible name; Vossie should label it.
- **Search:** overlay with a search field, quick links and category image links.
- **Cart:** slide-out drawer with suggestions. Vossie has no cart, so this slot becomes Saved or Inbox.

## Eduvos crest (supplied by Lama, 2026-10-08)

- Navy shield with a ring on top, three four-point stars in the upper field, a horizontal band, and two nested chevrons in the base.
- Motifs available for a Vossie texture: the four-point star and the chevron.
- Verified Eduvos colours: navy `#15305D`, sky blue `#29ABE2` (see FUNCTION-MAP.md section 11 for contrast rules). Eduvos's own typefaces are Cocogoose Pro and Larken (both licensed).

## Keep and change

| Keep from Brigade | Change for Vossie |
|---|---|
| Restraint: one display face, one body face, few colours, few section types | Eduvos navy and sky instead of forest, beige and red |
| Hanging badge in a sticky header | The Eduvos crest as the badge |
| Rounded panels, pill buttons, hairline dividers | A crest-derived texture (stars or chevrons) instead of contour lines |
| Hero slider with thumbnails and a pause button | Student photography; one changing word in a fixed headline frame |
| Photo tiles with a cut-out corner arrow | School-marketplace categories |
| Hover-to-preview lists ("Shop by brand", collections) | "Shop by campus" built on the same pattern, plus a persistent campus control |
| Full-screen menu with drill-down | Labelled menu button; Saved or Inbox instead of Cart |
| Short home page | Lighter image weights for South African mobile data |
