# Dark and Night themes: design

Date: 2026-10-28 · Status: approved by Lama, 2026-10-28; built 2026-10-28 to 29 (decision 95).

## 1. What Lama asked for

"Let's build a dark and night theme."

Lama's answers (2026-10-28):
- **Two dark themes**, not one:
  - **Dark** is brand-forward: Eduvos navy surfaces with the star texture.
  - **Night** is near-black, dimmer and warmer, for reading in bed and saving an OLED phone's battery.
- **The phone's setting, plus a switch.** By default CampusCart follows the phone's light or dark setting. A student can choose Light, Dark, Night or Match my phone.

## 2. Where things stand

- **Colours are almost all tokens.** `app/globals.css` (11,459 lines) reads `var(--color-*)` 730 times and has 55 hard-coded colours. Components use 64 colour utilities (53 of them `text-navy`). The Open Graph images are the only `.tsx` files with hex colours, and they stay as they are.
- **Two tokens have two jobs each.** Recolouring them alone would break pages:

  | Token | Job 1 | Job 2 |
  |---|---|---|
  | `--color-navy` | Headings and text on white (183 `color:` uses) | The navy band: header, hero, footer, the star panels (28 `background:` uses) |
  | `--color-white` | The page and card surface (38 `background:` uses) | Text and icons on the navy band (46 `color:` uses) |

  In a dark theme, job 1 inverts and job 2 doesn't, so the two jobs need two tokens each (section 4.1).
- **Data saver is the model to copy.** `lib/low-data.ts` keeps the choice in `localStorage` (`vossie_low_data`), and the inline boot script (`lib/boot-script.ts`) sets `data-low-data` on `<html>` before first paint. The menu's switch reads it through `useSyncExternalStore`.

## 3. Decisions

### 3.1 The choice lives in storage, not a cookie

I first suggested a `vossie_theme` cookie. That was wrong for this app:
- The root layout would have to read `cookies()`, which makes every page request-time.
- That would break the static shells Cache Components gives us, and the project rule ("never read `cookies()` … outside `<Suspense>`").

So the theme copies data saver:
- The choice is stored in `localStorage` as `vossie_theme`.
- The boot script sets `data-theme` on `<html>` before first paint, so a student who picked Dark never sees a white flash.
- With no saved choice (Match my phone), the boot script sets nothing and CSS follows the phone (3.2).

| Stored `vossie_theme` | `<html>` gets | What shows |
|---|---|---|
| nothing (Match my phone) | no attribute | Light, or Dark when the phone is in dark mode |
| `light` | `data-theme="light"` | Light |
| `dark` | `data-theme="dark"` | Dark |
| `night` | `data-theme="night"` | Night |

Match my phone gives **Dark**, not Night. Night is a deliberate choice.

The privacy page must name `vossie_theme` (`app/privacy/page.test.tsx` fails until it does). It's a device preference, not personal data, like data saver.

### 3.2 Following the phone needs no JavaScript

- `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { …Dark tokens… } }` sits beside `:root[data-theme="dark"]`. When the phone switches mode, the page follows instantly with no script listening.
- It also works with JavaScript off and before hydration.
- The cost is one repeated token block in the stylesheet, a few hundred bytes compressed. It adds nothing to JavaScript.

### 3.3 The switch

- **Where:** the menu (`MenuDrawer`), beside Data saver. The menu is already a client component, so the switch adds only its own few hundred bytes and no new chunk.
- **How:** "Theme" as a labelled radio group: Match my phone · Light · Dark · Night. Each option is at least 44px tall, works with the keyboard and isn't only a colour swatch.
- **Store:** `lib/theme.ts` (`getTheme`, `setTheme`, `subscribeTheme`) and a `useTheme` hook, following `lib/low-data.ts`.
- **No colour fade on change:** only `transform` and `opacity` animate. The new theme simply appears.

Step 5 (the switch, done 2026-10-29):
- **Its own chunk after all.** Section 5's plan won over the first line of 3.3: `components/menu/MenuSettings.tsx` (Theme, from `ThemeChoice.tsx`, and Data saver) loads through React's `lazy` when the menu first opens (`MenuDrawer` sets `opened` in its open callback). Before that, `.menu-settings-placeholder` holds their height (exact at 390 and 1440; at 360 Data saver's note wraps and the loaded block is 18px taller, at the menu's very end, so nothing moves).
- **Why Data saver moved too:** with only Theme lazy, the loading itself cost every page about 155 B and the listing forms went 108 B over (153,708 of 153,600). Moving Data saver's switch into the same chunk paid for it: the forms are 153,559 B (41 B of room, 47 before), the pages that load no selling code 151,518 B. `performance.spec.ts` at phone-390: 46 passed.
- **Native radios** in a `<fieldset>` with the legend "Theme". The input is visually hidden, the label is the pill, and arrow keys move between options. The chosen option is a solid sky pill with navy words and the others are outlines, so it isn't colour alone. The focus ring goes on the pill (`:has(:focus-visible)`).
- **Layout:** two by two on phones, above Data saver. From the tablet step, the four sit in a row beside Data saver.
- **The tablet menu's arithmetic:** the big type's reserved height goes from 316px to 341px (324 to 349 signed in), so Theme adds no scrolling at 768 x 657. Signed out, the menu already scrolled about 45px there before this work, because the 7-row rule doesn't count Sign in; it now scrolls 43px. Left as it was.
- **Checks:** unit test in `MenuDrawer.test.tsx` (nothing loaded until open, the four options in order, Night applies and is stored, Match my phone clears both). In the browser: the chunk loads on first open, the choice is 128px like its placeholder, arrow keys move from Light to Dark to Night, Night and its bar survive a reload, and phone dark mode shows Match my phone chosen. axe on the open menu at 390, 768 and 1440 in Light, Dark and Night: no violations.

### 3.4 The browser bar colour

- Today `viewport.themeColor` is navy `#15305D`.
- It stays as it is: Light's and Dark's band are both navy, so a list keyed by media would hold the same colour twice.
- Night is the only theme with a different bar.
  - The boot script and `setTheme` put a `<meta id="night-bar" name="theme-color" content="#0c1018">` first in `<head>`. The browser uses the first one that matches.
  - Any other choice removes it.
  - React 19 leaves an extra tag in `<head>` alone when it hydrates. Checked on the dev server: no warnings.

Step 2 (done 2026-10-28):
- `lib/theme.ts` and `hooks/useTheme.ts`.
- The boot script's theme lines: 64 B more compressed HTML per page, 105 B for the script on its own, no JavaScript.
- `vossie_theme` on the privacy page, which now lists five browser-only stores.

## 4. Colours

### 4.1 Tokens with one job each

The existing utility names stay, so the 64 class names in components mostly don't change. Two pairs of tokens are added. The build found that navy fills are of two kinds: brand surfaces, which stay navy in Dark, and solid controls, which would vanish on a navy page. So each kind got its own pair:

| New token | Light | Takes over |
|---|---|---|
| `--color-band` | navy `#15305D` | Brand surfaces: `surface-navy` (the menu), the hero, campus cards, the Hub banner, the photo-start panel, the pennant, listing badges, the seller seal, the toast, the campus card's tick, data saver's category tiles |
| `--color-on-band` | white | Text, outlines and rings on the band or on a photo |
| `--color-action` | navy `#15305D` | Solid controls and chosen states: the primary button, the skip link, chosen campus pills, the header's show button, the current Sell tab's icon, scope switch, open tool, current link chip and inbox tab, a confirmed status pill, your own message, an urgent needs count |
| `--color-on-action` | white | The words on an action |

Chart marks (`.bar-fill`, `.ratio-target`, `.split-bar`, the sparkline) and the carousel thumb stay on `--color-navy`, so they follow the heading colour (4.3).

The edits (step 1, done 2026-10-28):
- 75 lines in `globals.css`: 11 band fills, 13 action fills, 38 on-band and 13 on-action.
- The three white text lines inside the footer block wait until the phone footer session commits.
- Two components (`HeroRotator`, `MenuDrawer`) move from `text-white` to `text-on-band`.
- Checked on the dev server: every new token resolves to today's navy or white, and the hero, menu, primary button and campus cards compute the same colours as before.

In Dark, `action` becomes sky with navy words, as the preview showed. In Night it becomes a lifted grey with warm white words.

After that, every token has one job:
- `--color-navy` means heading text.
- `--color-white` means the surface.
- Each dark theme just redefines the tokens.

### 4.2 The palettes (candidates, tuned during the build)

Contrast was checked on every pairing a page uses. A unit test (`lib/theme-contrast.test.ts`) keeps it that way: text 4.5:1, large text and borders 3:1.

| Token | Light | Dark | Night |
|---|---|---|---|
| `white` (surface) | `#FFFFFF` | `#0D1C38` deep navy | `#07090D` near-black |
| `panel` | `#F3F3F3` | `#15305D` navy | `#11151C` |
| `pale` | `#E1F0F7` | `#163A66` | `#16202C` |
| `band` | `#15305D` | `#15305D`, stars on | `#0C1018`, stars off |
| `action` / `on-action` | navy / white | sky `#29ABE2` / navy | soft sky `#4FA9D1` / navy (a lifted grey was 1.4:1 against the page) |
| `navy` (headings) | `#15305D` | `#FFFFFF` | `#ECE7DF` warm white |
| `ink` (body) | `#373F41` | `#DFE5EE` | `#CFC9BF` warm grey |
| `muted` | `#5B6577` | `#A9B4C6` | `#9A958D` |
| `sky-dark` (links) | `#1E7BA8` | `#45B7E8`, a lighter sky: plain sky was 4.38 on pale | `#6FB6D6` soft sky |
| `field` (input borders) | `#7E8DA6` | `#7088AD` | `#6B727E` |
| `danger` / `success` / `warning` | as today | `#FF8A80` / `#5FD08F` / `#F2B84B` | `#F0857A` / `#6CC08F` / `#E0B062` |

The status tints (`*-tint`) become dark versions of their colour, checked the same way.

Measured on the candidates (body text on each surface):
- **Dark:** ink 13.4 on surface, 10.3 on panel. Links 7.4 on surface, 5.7 on panel, 5.0 on pale.
- **Night:** ink 12.1 on surface. Links 8.9 on surface.

Step 3 (Dark, done 2026-10-28):
- **One `dark` variant.** `@custom-variant dark` in `globals.css` replaces Tailwind's own `dark:`. It matches a chosen Dark or Night, or the phone in dark mode with nothing chosen. A rule writes `@variant dark { … }` once, never twice. A `night` variant comes after it, for step 4.
- **The Dark tokens** sit in one `:root { @variant dark { … } }` block, with `color-scheme: dark`, so form controls and scrollbars follow.
- **Two fixed colours, the same in every theme:**
  - `--color-on-sky` (navy) is for words on a sky fill. Ten rules used `--color-navy` there, which turns white in Dark (2.6:1 on sky).
  - `--color-alert` (deep red) is for the two badges that carry white numbers. Dark's `danger` is a light red, which white can't sit on.
- **White fills on the band.** The menu switch's thumb, the footer's mini pennant and the campus card's progress bar sit on the band, so they take `on-band`. The header pennant's edge and the category tile's cut-out follow the surface on purpose.
- **Hard-coded colours.**
  - The collections fan's two placeholder cards get navy tones under `@variant dark`.
  - The field shimmer's colour is a variable, `--field-shimmer`, since a variant can't attach after `::after`.
- **The home page's Looking For** (a sky panel) has its eyebrow on `SectionHeader`'s new `"sky"` tone, its title on `on-sky`, and its request cards in the surface's own words.
- **Checks:**
  - axe's colour-contrast and link rules on 27 pages, signed out and signed in as each sample role, at 390 and 1440, in Dark and in Light. 5 issues at first, all the Looking For section; 0 after.
  - Screenshots of the listing, the menu, browse, the seller page, the new-listing form, `/sell`, Messages, the admin's Today and Last week, and the console sidebar at 1440.
  - `lib/theme-contrast.test.ts` checks the token pairs in Light and Dark. It holds Light to its own brand rules: sky-dark only on white, field borders on white and grey.

Step 4 (Night, done 2026-10-28):
- **The Night tokens** sit in a `:root { @variant night { … } }` block after Dark's. Dark's variant matches Night too, so Night starts from Dark and changes what differs.
- **Sky becomes a soft sky** (`#4FA9D1`) for fills, and action uses it with navy words. This changes the approved "lifted grey", which stood only 1.4:1 from the page. The soft sky passes 7.5:1 against the page, and its navy words 4.9:1.
- **The rest of the approved choices:**
  - No star texture (`texture-stars` sets `background-image: none` under `@variant night`).
  - Photos at `brightness(0.9)` (`.photo-img`).
  - The crest at `brightness(0.88)`: next to the warm words, the pure white crest was too bright. It's a filter, because the crest's breathing uses opacity.
- **Focus halos on the band** read `--color-band`, not `--color-navy`. That was 8 lines, and Light is unchanged. In the dark themes the navy token is white, which would have put a white halo round focus on the band.
- **Checks:**
  - axe's colour-contrast and link rules on the same 27 pages at 390 and 1440: 0 issues in Night.
  - Screenshots of the seller page, the menu and the admin's Today.
  - In the browser, the crest filter and the missing stars appear only in Night.
  - The contrast test covers Night, and checks that each theme reads its own block.

### 4.3 Brand rules in the dark

| Rule today | In Dark and Night |
|---|---|
| Sky never carries text on white | Sky may carry text on the dark surfaces, where it passes 4.5:1. `sky-dark` maps to sky in Dark. |
| Links on white use sky-dark | Links use `--color-sky-dark`, which each theme sets (table above) |
| On the star texture, small text is white | Unchanged in Dark. Night has no star texture. |
| Chart marks are navy or sky-dark, never sky | Chart marks use `--color-navy` and `--color-sky-dark`, so they follow the theme. The rule becomes "the heading and link tokens, never `--color-sky`". |
| The crest comes from `assets/brand/` | Unchanged. The crest sits on the band, which stays dark navy in Dark. In Night it needs a check: if it's too bright, it dims to 85% opacity. |

### 4.4 What stays as it is

- **Photos:** never recoloured or inverted. Their dark overlays (`rgb(9 20 42 / …)`) already suit both themes. Night dims photos slightly (`filter: brightness(0.9)`), a still style and not an animation.
- **Fixed colours:** the Open Graph images, the sign-in email and the manifest's colours.
- **The offline page** (`lib/offline.ts`) gets a small `prefers-color-scheme: dark` block. Its hash changes, so the worker updates itself.
- **Shadows** (`rgb(21 48 93 / …)`) become a `--shadow-card` per theme. On dark surfaces a hairline `--color-line` border does the work a shadow can't.

## 5. Testing

- **Unit:**
  - `lib/theme.ts` and the boot script: each stored value and blocked storage.
  - The contrast test.
  - The privacy test (it already looks for `vossie_` names).
- **End-to-end** (`tests/e2e/theme.spec.ts`):
  - axe on a sampled set in Dark and in Night: home, browse, a listing, a thread, `/sell`, the listing form, You, `/admin`.
  - The switch works and survives a reload.
  - A first paint in a saved theme shows no light frame: the screenshot at `domcontentloaded` has a dark background.
  - Match my phone follows `colorScheme: "dark"`.
- **Budget:** the stylesheet grows, and JavaScript grows only by the switch. Bytes are recorded per page as usual.
  - **Risk:** the listing forms are only 47 B under 150 KB (153,553 of 153,600 B). The menu is on every page, so the switch would likely push them over.
  - **Plan:** the switch's radio group loads by dynamic import when the menu opens. Only the boot script's few lines, which are inline HTML and not JavaScript chunks, reach every page.
- **Screenshots:** every page at 390 and 1440 in Dark and Night, for Lama to look over before it ships.

## 6. Build order

1. **Split the tokens** (4.1). Light must look identical: compare screenshots against `main`.
2. Theme store, boot script, privacy page, `themeColor`.
3. Dark tokens and the media block. Then go page by page, fixing hard-coded colours.
4. Night tokens: no star texture, dimmed photos, the crest check.
5. The menu switch.
6. Tests, screenshots, bytes. Update the decisions log, `CLAUDE.md`'s brand section and `PROGRESS.md`.

Step 1 touches about 74 lines across `globals.css`. The phone footer session (decision 94) may be editing the footer's styles there, so step 1 waits for a quiet window or stages only its own lines.

Step 6 (checks and docs, done 2026-10-29):
- **`tests/e2e/theme.spec.ts`:** axe (serious and critical, WCAG 2.2 AA) on 7 signed-out pages, `/account`, `/sell` and `/admin` as their sample accounts, and the open menu, in Dark and in Night at 390 and 1440, each also checking the page's surface colour. At every device size: a choice in the menu applies at once, survives a reload with Night's bar, and Match my phone clears it; a saved Night is on when the document is parsed (no light frame); Match my phone follows `colorScheme: "dark"` with nothing stored; a chosen Light wins over the phone.
- **The offline page** follows the phone's dark mode in Dark's colours (one `@media` line in `lib/offline.ts`). It has no script, so it can't read a chosen theme. Its hash changes the worker, so `WORKER_VERSION` stays.
- **Screenshots** for Lama in `docs/progress/themes/`: 16 pages and the menu, in Dark and Night, at 390 and 1440 (64), taken from the dev server (the round badge bottom left is Next's dev indicator).

## 7. Lama's answers (2026-10-28)

Approved, with the proposals:
1. **Night's warmth:** warm white text (`#ECE7DF`).
2. **Night's crest:** checked in the build, and dimmed to 85% only if it's too bright.
3. **Where the switch lives:** the menu only.
