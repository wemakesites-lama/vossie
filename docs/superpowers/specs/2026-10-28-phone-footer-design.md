# Phone footer: a slim footer that only holds what phones can't reach elsewhere: design

Date: 2026-10-28 · Status: built (decision 94, `2a5ffd8`).

## 1. What Lama asked for

On phones the footer isn't needed the way it is on desktop. Change its look, mobile first, and plan where its links go.

Lama's answer (2026-10-28): **option A, the slim footer**, over moving the sign-up and help links into the menu (B) or tightening today's footer (C).

## 2. What's wrong today

At 375 x 812 the footer is 910px tall, more than a screen. Measured on `/how-it-works`:

| Part | Height |
|---|---|
| Two giant links | 129px |
| Sign-up and the four accordions | 511px |
| Wordmark | 56px |
| Whole footer | 910px |

Almost every link repeats one a phone already has on screen or one tap away:

| Footer link on phones | Where a phone already has it |
|---|---|
| Shop your campus, Start selling | The tab bar's Shop and the student bar's Sell (a seller's My shop, `barFor`) |
| Browse everything, Textbooks & notes, Tech, Services | Shop tab; the menu's Shop list holds every category |
| Looking For | The menu, and the header's quick links |
| Saved | Students' Saved tab; sellers' and staff's header heart (`PhoneSaved`) |
| List an item | Sell tab or My shop |
| How selling works | Same page as How it works (`/how-it-works`) |
| Launchpad | The menu |
| How it works, Safety | The menu |
| Your account | You tab |
| The 13 campuses | The menu's campus list |

Only these have no other home on a phone: **How trust works, Seller guidelines, Privacy (POPIA), Terms of use**, the **campus updates sign-up** and **Add CampusCart to your home screen**.

So no link needs to move. The phone footer drops the repeats and keeps the rest.

## 3. The phone footer

"Phone" is below the `wide:` step (48rem wide and 30rem tall), so landscape phones get it too. From the `wide:` step up, nothing changes.

Top to bottom:

1. **Campus updates.** The heading, its one-line intro, the email field, the consent line and Add CampusCart to your home screen, as today. The intro stays: it says what the email is for (POPIA section 13, purpose).
2. **Info links.** One list, two columns, no heading and no accordion, each link a 44px row:
   - How it works
   - How trust works
   - Seller guidelines
   - Privacy (POPIA)
   - Terms of use
   - Safety

   The last three keep the legal row's order, so desktop doesn't change.
3. **The lockup.** The pennant and "An Eduvos Incubation Hub project".
4. **The CAMPUSCART wordmark**, filling the width as today. It keeps the footer bold for the cost of 56px.

Gone on phones: the two giant links and the Shop, Sell, Help and Campuses accordions.

**Height:** 654px at 375 x 812 with the install button showing (it adds 60px), 594px without it, against 910px before. The draft's target was 600px. Lama accepted 654px over trimming the top padding, the wordmark's gap, the legal row's padding and the install gap (2026-10-28). The e2e test's limit is 660px.

### 3.1 How the markup gets there

- **One copy of each control.** The sign-up and the install button are client components with fixed ids (`footer-updates-title`, `install-help-title`), so they render once at every size. Nothing is drawn twice for phones.
- **Giants:** hidden below `wide:` (`hidden wide:grid`). The grid's 32px top padding, which spaced it from the giants' hairline, goes on phones.
- **Link groups:** the `<details>` accordions are removed, and each group's wrapper becomes `hidden wide:block`, so phones get no empty grid rows. Tablet and desktop draw the columns as now.
- **The legal row becomes the phone's info list.** Today it is a `<p>` with Privacy, Terms and Safety joined by " · ". It becomes a `<ul>` of the six links:
  - Below `wide:`: a two-column grid of 44px rows.
  - From `wide:`: How it works, How trust works and Seller guidelines are hidden (the Help and Sell columns hold them), and the other three sit in a row with the dots drawn by CSS (`li + li::before`), so desktop looks as it does now.
  - The list moves before the lockup in the DOM, so phones show the links first in reading order. From `wide:` the lockup keeps its place on the left through flex `order`. The lockup holds no link or control, so focus order matches what is seen at every size.
- **Section pages** (`/sell`, `/admin`, `/mentor`) already hide `.footer-giants`, `.footer-grid` and `.footer-wordmark`. Unchanged: they keep the lockup and now the six info links on phones, three from `wide:`.
- **No new client code**, so no page's JavaScript changes. The HTML loses the four accordions (13 campus links and about 20 others), so every page's HTML gets slightly smaller.

### 3.2 Not in this change

- **The brand line** "Your campus, open for business." The option A drawing showed it on top. Decision 71 puts it above the giant links after Eduvos marketing signs it off, and it isn't built anywhere yet. When it is, it goes first in the phone footer too.
- **Install first.** The drawing put Add to home screen above the sign-up. Moving it would change desktop's order too (spec 6.6 puts it under the sign-up), and reordering with CSS on phones alone would split visual and focus order (WCAG 1.3.2, 2.4.3). It stays under the sign-up.

## 4. Accessibility

- The footer stays the `contentinfo` landmark with the hidden "Site links" heading.
- The info list is a list (`<ul>`), so a screen reader announces six links.
- Every link and button is at least 44px tall and wide.
- Text on the star texture stays white (decision 14).
- Assistive technology meets one copy of each list: the phone list and the desktop columns are each hidden with `display: none` at the other size.

## 5. Tests that change

Unit (`components/footer/SiteFooter.test.tsx`):
- "keeps privacy, terms and safety in the legal row" becomes: the info list holds the six links in order.
- "sets the campuses in two columns on desktop, but not in the phone's accordion" becomes: one campus list, in two columns.
- New: no `<details>` in the footer.

End-to-end:
- `tests/e2e/shell.spec.ts`: the phone accordion test ("Shop" summary) and "assistive technology meets one copy of each footer list" are rewritten for the info list. New: at 375 x 812 the footer is at most 600px, and the giant links are hidden.
- `tests/e2e/info.spec.ts` "the footer reaches the info and legal pages": on phones it taps the info list instead of opening an accordion. Seller guidelines and How trust works stay reachable at every size.
- `tests/e2e/role-views.spec.ts` "CampusCart brings both back": `.footer-giants` is visible again only from the `wide:` step; on phones it checks `.footer-updates` instead.
- `tests/e2e/screenshots.spec.ts` "07-footer" is retaken at phone size.
- axe on the home page at phone size, and the existing layout-shift checks, run unchanged.

## 6. Docs that change

- Homepage spec 6.6's **Phone** list: replaced by section 3 of this spec.
- `docs/reference/LANDING-DECISIONS.md`: row 94.
- `docs/PROGRESS.md`: the session entry.
