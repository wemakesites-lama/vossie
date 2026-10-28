# Phone footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Below the `wide:` step the footer keeps only what a phone can't reach elsewhere (sign-up, install, six info links, lockup, wordmark), at most 600px tall at 375 x 812.

**Architecture:** One footer for every size, no duplicated controls. The giant links and the link-group columns are hidden below `wide:`; the `<details>` accordions are deleted. The legal row's `<p>` becomes a six-link `<ul>`: a two-column list on phones, and from `wide:` the same three links in a dotted row as today (the three phone-only items are `wide:hidden`). CSS only; no client code changes.

**Tech Stack:** Next.js 16.4 Server Component (`SiteFooter`), Tailwind 4 `wide:` variant, plain CSS in `app/globals.css` (`@layer components`), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-phone-footer-design.md` (committed in `d27811f`; the list order and two markup notes were amended while planning and go in with this plan's commit).

**House rules for whoever runs this:**
- pnpm only. Never `git add -A`: stage named files. One git command at a time.
- Implementers leave work uncommitted; the controller checks and commits, with Lama's go-ahead (memory: controller commits).
- `docs/PROGRESS.md` already has Lama's own uncommitted edits. Back it up first, add only your lines, and stage only your hunk with `git apply --cached` (memory: shared file edits). Never stage `.claude/launch.json` or `docs/pitch/`.
- Stop only servers you started, by PID or port.

---

## File map

| File | Change |
|---|---|
| `components/footer/SiteFooter.tsx` | Giants `hidden wide:grid`; accordions gone; group wrapper `hidden wide:block`; legal `<p>` becomes a six-item `<ul>` before the lockup |
| `components/footer/SiteFooter.test.tsx` | Legal-row and two-columns tests rewritten; new no-accordion test |
| `app/globals.css` | Remove accordion rules; phone grid padding; legal list grid on phones, dotted row and lockup order from `wide:` |
| `tests/e2e/shell.spec.ts` | Accordion test replaced by a height and contents test; one-copy test rewritten; arrows test skips phones |
| `tests/e2e/info.spec.ts` | The four footer links are tapped directly on phones |
| `tests/e2e/role-views.spec.ts` | Coming back from Selling: phones check `.footer-updates`, wider checks `.footer-giants` |
| `docs/superpowers/specs/2026-10-08-homepage-design.md` | 6.6's **Phone** list points to the new spec |
| `docs/reference/LANDING-DECISIONS.md` | Row 94 |
| `docs/PROGRESS.md` | Session entry |

---

### Task 1: Footer markup (unit tests first)

**Files:**
- Modify: `components/footer/SiteFooter.tsx`
- Test: `components/footer/SiteFooter.test.tsx`

- [ ] **Step 1: Rewrite the two affected unit tests and add the new one**

In `components/footer/SiteFooter.test.tsx`, replace the test `"keeps privacy, terms and safety in the legal row, which a phone shows even with the groups folded"` with:

```tsx
  it("ends with the info list: six links on phones, the three legal ones from the wide step", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    const list = container.querySelector<HTMLElement>("ul.footer-legal-links")!;
    expect(within(list).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "How it works",
      "How trust works",
      "Seller guidelines",
      "Privacy (POPIA)",
      "Terms of use",
      "Safety",
    ]);
    // The Help and Sell columns hold the first three from the wide step, so the list hides them there.
    const phoneOnly = [...list.querySelectorAll("li")].map((item) => item.classList.contains("wide:hidden"));
    expect(phoneOnly).toEqual([true, true, true, false, false, false]);
  });

  it("puts the info list before the lockup, so phones read the links first", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    const legal = container.querySelector<HTMLElement>(".footer-legal")!;
    expect([...legal.children].map((child) => child.className)).toEqual(["footer-legal-links", "footer-lock"]);
  });
```

Replace the test `"sets the campuses in two columns on desktop, but not in the phone's accordion (decision 17)"` with:

```tsx
  it("sets the campuses in two columns, once (decision 17)", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    const columns = container.querySelectorAll<HTMLElement>(".footer-links-columns");
    expect(columns).toHaveLength(1);
    expect(within(columns[0]).getAllByRole("link")).toHaveLength(campuses.length);
  });

  it("has no accordions, and hides the giant links and the link columns below the wide step (phone footer spec 3.1)", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector(".footer-giants")).toHaveClass("hidden", "wide:grid");
    const groups = container.querySelectorAll(".footer-group");
    expect(groups).toHaveLength(4);
    for (const group of groups) expect(group).toHaveClass("hidden", "wide:block");
  });
```

Also change the comment above `hrefsOf` from `Each group is drawn twice (the accordion and the column).` to `The legal list repeats some of the columns' links.`

- [ ] **Step 2: Run the footer tests and see them fail**

Run: `pnpm vitest run components/footer/SiteFooter.test.tsx`
Expected: FAIL on the four new or rewritten tests (no `ul.footer-legal-links`, a `details` exists, `.footer-giants` lacks `hidden`).

- [ ] **Step 3: Change the markup**

In `components/footer/SiteFooter.tsx`:

1. Imports: `ChevronDownIcon` is no longer used.

```tsx
import { ArrowUpRightIcon } from "@/components/icons";
```

2. Under `LINK_GROUPS`, add the info list's links:

```tsx
/** The info list at the foot (phone footer spec 3): all six on phones; from the wide step the columns hold the first
    three, so only the legal three show, in the order the legal row always had. */
const INFO_LINKS: readonly (FooterLink & { phoneOnly?: true })[] = [
  { href: "/how-it-works", label: "How it works", phoneOnly: true },
  { href: "/trust", label: "How trust works", phoneOnly: true },
  { href: "/seller-guidelines", label: "Seller guidelines", phoneOnly: true },
  { href: "/privacy", label: "Privacy (POPIA)" },
  { href: "/terms", label: "Terms of use" },
  { href: "/safety", label: "Safety" },
];
```

3. Update the doc comment on `SiteFooter` to `/** The bold footer (spec section 6.6); on phones the slim one (phone footer spec 3). */`.

4. The giants' wrapper:

```tsx
        {/* Phones have Shop and Sell in the tab bar (phone footer spec 3). */}
        <div className="footer-giants hidden wide:grid">
```

5. Replace the `groups.map(...)` block with:

```tsx
          {/* Phones reach every one of these links through the tab bar, the menu or the header (phone footer spec 2). */}
          {groups.map((group) => (
            <div key={group.title} className="footer-group hidden wide:block">
              <h3 className="footer-heading">{group.title}</h3>
              <FooterLinks links={group.links} columns={group.columns} />
            </div>
          ))}
```

6. Replace the whole `<div className="footer-legal">…</div>` with:

```tsx
        <div className="footer-legal">
          <ul className="footer-legal-links">
            {INFO_LINKS.map((link) => (
              <li key={link.href} className={link.phoneOnly ? "footer-phone-only wide:hidden" : undefined}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
          <div className="footer-lock">
            <Pennant size="small" />
            <p>An Eduvos Incubation Hub project</p>
          </div>
        </div>
```

Not `cx` here: it returns `""` for nothing, which would write `class=""` on the three legal items. `cx` stays imported; `FooterLinks` still uses it.

- [ ] **Step 4: Run the footer tests and see them pass**

Run: `pnpm vitest run components/footer`
Expected: PASS, every test in the folder.

- [ ] **Step 5: Hand back to the controller** (no commit; the controller commits after Task 3).

---

### Task 2: Footer CSS

**Files:**
- Modify: `app/globals.css` (footer block, `/* --- Footer (Task 17, spec section 6.6) */`, about lines 1679 to 2010)

- [ ] **Step 1: Delete the accordion rules**

Remove these rules entirely (they style markup that no longer exists): `.footer-accordion`, `.footer-group:last-child .footer-accordion`, `.footer-summary`, `.footer-summary::-webkit-details-marker`, `.footer-summary-icon`, `.footer-accordion[open] .footer-summary-icon`, `.footer-accordion .footer-links`.

Check nothing else uses them:

Run: `grep -rn "footer-accordion\|footer-summary" app components lib tests`
Expected: no output.

- [ ] **Step 2: Phone grid padding**

In `.footer-grid`, replace

```css
    /* No padding below on phones: the legal row's own hairline is the one that closes the accordions. */
    padding-block: 32px 0;
```

with

```css
    /* Phones have no giant links above, so nothing to clear (phone footer spec 3.1); the wide step sets 48px. */
    padding-block: 0;
```

- [ ] **Step 3: The info list on phones**

Replace the rule `.footer-legal-links a { … }` and its comment with:

```css
  /* Phones: the info list, two columns of 44px rows across the footer (phone footer spec 3). */
  .footer-legal-links {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 16px;
    align-self: stretch;
  }

  /* Standalone targets (the privacy notice link in the consent sentence is inline in text, so it is exempt): 44px
     tall and wide, as spec section 5 asks. */
  .footer-legal-links a {
    display: inline-flex;
    align-items: center;
    min-width: 44px;
    min-height: 44px;
  }
```

- [ ] **Step 4: The legal row from the wide step**

In the `@media (min-width: 48rem) and (min-height: 30rem)` block of the footer section, after the `.footer-legal` rule, add:

```css
    /* The three legal links in a row, as before. The lockup comes after the list in the page (phones read the links
       first); here it goes back to the left. It holds no link, so focus order is unaffected. */
    .footer-legal-links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      align-self: auto;
    }

    .footer-lock {
      order: -1;
    }

    /* The dots between visible links: the phone-only items are hidden here, so the first legal link gets none. */
    .footer-legal-links li:not(.footer-phone-only) ~ li::before {
      content: "·";
      padding-inline: 0.3em;
    }

    .footer-legal-links li {
      display: flex;
      align-items: center;
    }
```

- [ ] **Step 5: Look at it**

Start the preview (`vossie-dev` in `.claude/launch.json`, port 3100) and open `/how-it-works`.
- At 375 x 812: no giant links, sign-up, install (only with an iPhone user agent or an install prompt), six links in two columns, lockup, wordmark. Measure: `document.querySelector('.site-footer').getBoundingClientRect().height` must be at most 600 (it may be shorter without the install button).
- At 1440 x 900: the footer looks as before: giants, five columns, lockup left, "Privacy (POPIA) · Terms of use · Safety" right.
- At 768 x 1024: the tablet footer as before.
- Sign in as the sample seller and open `/sell` at 375: the footer shows the six links and the lockup only.

If the phone footer is over 600px, stop and report the measured parts; don't tune spacing beyond this plan without Lama.

- [ ] **Step 6: Hand back to the controller.**

---

### Task 3: End-to-end tests

**Files:**
- Modify: `tests/e2e/shell.spec.ts`, `tests/e2e/info.spec.ts`, `tests/e2e/role-views.spec.ts`

- [ ] **Step 1: shell.spec.ts, the giant arrows**

In `test("the giant links' arrows sit at the right edge of their links", …)`, make the first line:

```ts
    test.skip(!isTabletOrWider(page), "Phones have no giant links (phone footer spec 3)");
```

- [ ] **Step 2: shell.spec.ts, the phone footer's height and contents**

Inside `test.describe("install pill on an iPhone", …)` (so the install button shows, as the spec's target assumes), after the 320px test, add:

```ts
    test("the phone footer holds the sign-up, the info list and the wordmark in at most 600px (phone footer spec 3)", async ({
      page,
    }) => {
      test.skip(isTabletOrWider(page), "Phones only");
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/");
      const footer = page.getByRole("contentinfo");
      await footer.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await expect(footer.locator(".footer-install")).toBeVisible();
      await expect(footer.locator(".footer-giants")).toBeHidden();
      await expect(footer.getByRole("textbox", { name: "Email address" })).toBeVisible();
      for (const name of ["How it works", "How trust works", "Seller guidelines", "Privacy (POPIA)", "Terms of use", "Safety"]) {
        await expect(footer.getByRole("link", { name, exact: true })).toBeVisible();
      }
      const height = await footer.evaluate((element) => element.getBoundingClientRect().height);
      expect(height).toBeLessThanOrEqual(600);
    });
```

- [ ] **Step 3: shell.spec.ts, remove the accordion test and rewrite the one-copy test**

Delete `test("link groups open as accordions on phones", …)`.

Replace `test("assistive technology meets one copy of each footer list", …)` with:

```ts
  test("assistive technology meets one copy of each footer link that has one home", async ({ page }) => {
    // The info list and the columns share How it works, How trust works and Seller guidelines; CSS must show exactly
    // one copy at every size. Phones have no campus list in the footer (the menu holds it).
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    for (const name of ["How it works", "How trust works", "Seller guidelines"]) {
      await expect(footer.getByRole("link", { name, exact: true })).toHaveCount(1);
    }
    await expect(footer.getByRole("link", { name: "Eduvos Online", exact: true })).toHaveCount(isTabletOrWider(page) ? 1 : 0);
  });
```

`getByRole` leaves out `display: none` elements, which is what this counts.

- [ ] **Step 4: info.spec.ts, tap the links directly**

Replace the `LINKS` array and its loop in `test.describe("the footer reaches the info and legal pages (spec 2.11)", …)` with:

```ts
  const LINKS: ReadonlyArray<[name: string, href: string]> = [
    ["Seller guidelines", "/seller-guidelines"],
    ["How trust works", "/trust"],
    ["Terms of use", "/terms"],
    ["Privacy (POPIA)", "/privacy"],
  ];

  for (const [name, href] of LINKS) {
    test(`${name} opens ${href}`, async ({ page }) => {
      onlyAt("phone-390", "desktop-1440");
      await page.goto("/");
      // One visible copy at every size: the info list on phones, the columns from the wide step.
      await page.getByRole("contentinfo").getByRole("link", { name, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
    });
  }
```

Keep the `width` helper: another test in the file still uses it.

- [ ] **Step 5: role-views.spec.ts, coming back from Selling**

In `test("the seller's bar replaces the main bar with the slim footer, and CampusCart brings both back", …)`, replace the last line

```ts
    await expect(page.locator(".footer-giants")).toBeVisible();
```

with

```ts
    // The footer's marketing blocks are back: phones have no giant links (phone footer spec 3), so check the sign-up.
    await expect(page.locator(phone() ? ".footer-updates" : ".footer-giants")).toBeVisible();
```

The earlier `.footer-giants` toBeHidden check stays: it holds on every size.

- [ ] **Step 6: Run the changed specs**

Run: `pnpm e2e tests/e2e/shell.spec.ts tests/e2e/info.spec.ts tests/e2e/role-views.spec.ts tests/e2e/a11y.spec.ts --project=phone-360 --project=phone-390 --project=tablet-768 --project=desktop-1440`
Expected: all pass (skips by design). `a11y.spec.ts` is the axe run; it changes nothing but checks the new list.

If the run fails on something these files don't touch, note it and compare with `main` before changing anything.

- [ ] **Step 7: Controller checks and commits (with Lama's go-ahead)**

```bash
git status --short
```

```bash
git add components/footer/SiteFooter.tsx components/footer/SiteFooter.test.tsx app/globals.css tests/e2e/shell.spec.ts tests/e2e/info.spec.ts tests/e2e/role-views.spec.ts
```

```bash
git commit -m "feat(footer): the slim phone footer (phone footer spec, decision 94). Below the wide: step the footer drops the giant links and the four accordions, whose every link is in the tab bar, the menu or the header, and keeps the sign-up, the install button, six info links in two columns, the lockup and the wordmark. From the wide step it looks as before. No client code changes. <measured height> at 375 x 812 (910px before)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Replace `<measured height>` with the figure from Task 2 Step 5 or the e2e run.

---

### Task 4: Full checks

- [ ] **Step 1: Lint, types, unit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: clean, all unit tests pass.

- [ ] **Step 2: First-visit sizes unchanged**

Run: `pnpm e2e tests/e2e/performance.spec.ts --project=phone-390`
Expected: pass. JavaScript should be byte-identical (only a Server Component changed); the HTML is smaller.

- [ ] **Step 3: Phone screenshot for Lama**

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts --project=phone-390`
Expected: `07-footer` is the new phone footer. Show it to Lama with the measured height.

---

### Task 5: Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-10-08-homepage-design.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`
- Modify: `docs/superpowers/specs/2026-10-28-phone-footer-design.md` (status line)

- [ ] **Step 1: Homepage spec 6.6**

Replace the **Phone:** list under 6.6 (the three bullets: giant links stack, accordions, wordmark fills) with:

```markdown
**Phone:** the slim footer (decision 94, `2026-10-28-phone-footer-design.md`): the sign-up and install button, six info links in two columns, the lockup and the wordmark. No giant links, no accordions.
```

- [ ] **Step 2: Decision 94**

Append to the table in `docs/reference/LANDING-DECISIONS.md`:

```markdown
| 94 | 2026-10-28 | The footer on phones (`2026-10-28-phone-footer-design.md`) | **Option A, the slim footer. Below the `wide:` step: the campus updates sign-up and install button, six info links in two columns (How it works, How trust works, Seller guidelines, Privacy, Terms, Safety), the lockup and the wordmark. The giant links and the Shop, Sell, Help and Campuses accordions go. Tablet and desktop unchanged** | The phone footer was 910px at 375 x 812 and almost every link repeated the tab bar, the menu or the header; no link needed a new home. Kept out: the brand line (decision 71, waiting on Eduvos marketing) and putting install first (it would change desktop's order or split visual and focus order). Options B (sign-up and help into the menu) and C (one "All links" accordion) were turned down. Lama |
```

- [ ] **Step 3: Spec status**

In `docs/superpowers/specs/2026-10-28-phone-footer-design.md`, change `Status: draft for Lama's review (would be decision 94).` to `Status: built (decision 94).` and add the measured height to section 3's **Height target** line.

- [ ] **Step 4: PROGRESS.md, your lines only**

```bash
cp docs/PROGRESS.md /private/tmp/claude-501/PROGRESS.md.bak
```

Add a `## 2026-10-28: the slim phone footer` entry at the end: what changed, the measured height, the test counts from Task 4, and that the brand line still waits on decision 71. Then stage only that hunk: write it with `git diff docs/PROGRESS.md > /private/tmp/claude-501/progress.patch`, delete Lama's own hunks from the patch file, and `git apply --cached /private/tmp/claude-501/progress.patch`. Check with `git diff --cached docs/PROGRESS.md` that only your entry is staged.

- [ ] **Step 5: Controller commits the docs (with Lama's go-ahead)**

```bash
git add docs/superpowers/specs/2026-10-08-homepage-design.md docs/reference/LANDING-DECISIONS.md docs/superpowers/specs/2026-10-28-phone-footer-design.md
```

```bash
git commit -m "docs: decision 94, the slim phone footer, built; homepage spec 6.6 and progress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
