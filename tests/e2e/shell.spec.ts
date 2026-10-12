import { expect, test, type Page } from "@playwright/test";

const isTabletOrWider = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;

async function openCampusPicker(page: Page) {
  if (isTabletOrWider(page)) {
    await page.getByRole("button", { name: /^Shopping at/ }).click();
  } else {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /^Shopping at/ }).click();
  }
  return page.getByRole("dialog", { name: "Choose your campus" });
}

test.describe("header", () => {
  test("hides to the crest, pops back without moving the page, and hides again 160px later", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await expect(menu).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 700));
    await expect(menu).toBeHidden();
    const pennant = page.getByRole("button", { name: "Show navigation" });
    await expect(pennant).toBeVisible();
    await expect.poll(async () => (await pennant.boundingBox())?.y ?? 99).toBeLessThanOrEqual(1);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    // A real tap on touch screens (the spec says "tap"), a click elsewhere.
    if (test.info().project.use.hasTouch) await pennant.tap();
    else await pennant.click();
    await expect(menu).toBeVisible();
    await expect(page.getByRole("link", { name: "Vossie home" })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

    await page.evaluate(() => window.scrollBy(0, 200));
    await expect(menu).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(menu).toBeVisible();
  });

  test.describe("on a landscape phone", () => {
    test.use({ viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

    test("keeps the phone layout (the wide: variant needs 30rem of height)", async ({ page }) => {
      test.skip(test.info().project.name !== "phone-390", "Checked once, in the phone project");
      await page.goto("/");
      const pill = page.locator(".site-header .campus-pill");
      await expect(pill).toHaveCount(1);
      await expect(pill).toBeHidden();
      await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
    });
  });

  test("the home pennant scrolls back to the top on the homepage", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 80));
    await page.getByRole("link", { name: "Vossie home" }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("never hides while a header control has keyboard focus", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    for (let i = 0; i < 20 && !(await menu.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(menu).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(page.locator(".site-header")).toHaveAttribute("data-mode", "expanded");
    await expect(menu).toBeFocused();
  });
});

test.describe("menu", () => {
  test("traps focus, closes on Escape and gives focus back", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Menu", exact: true });
    await menuButton.click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const escaped = await page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(active && active !== document.body && !active.closest("dialog[open]"));
      });
      expect(escaped).toBe(false);
    }
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test("closes when a link is followed", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await menu.getByRole("link", { name: "Sell" }).click();
    await expect(page).toHaveURL(/\/sell$/);
    await expect(menu).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start selling");
  });
});

test.describe("campus picker", () => {
  test("saves the choice, confirms it, and remembers it after a reload", async ({ page, context }) => {
    await page.goto("/");
    const picker = await openCampusPicker(page);
    await expect(picker).toBeVisible();
    await picker.getByRole("searchbox", { name: "Find your campus" }).fill("mid");
    await picker.getByRole("button", { name: "Midrand, Gauteng" }).click();
    await expect(picker).toBeHidden();
    await expect(page.locator(".toast")).toHaveText("Showing Midrand first");
    // The visible toast is a manual popover in the top layer, so it would also show above an open dialog.
    expect(await page.locator(".toast-pop").evaluate((element) => element.matches(":popover-open"))).toBe(true);

    const cookie = (await context.cookies()).find((c) => c.name === "vossie_campus");
    expect(cookie?.value).toBe("midrand");

    await page.reload();
    if (isTabletOrWider(page)) {
      await expect(page.getByRole("button", { name: "Shopping at Midrand" })).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /^Shopping at Midrand/ }),
      ).toBeVisible();
    }
  });
});

test.describe("search", () => {
  test("submits to browse and remembers the search", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Search Vossie" });
    const box = dialog.getByRole("searchbox", { name: "Search Vossie" });
    await expect(box).toBeFocused();
    // An empty search goes nowhere and keeps the overlay open. The unit tests can't show this, because their
    // next/form mock always prevents the default.
    await box.press("Enter");
    await expect(page).toHaveURL(/\/$/);
    await expect(dialog).toBeVisible();
    await box.fill("calculator");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/browse\?q=calculator$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Browse");

    await page.getByRole("button", { name: "Search", exact: true }).click();
    // Look in the Recent section for the exact name: the trending lists also hold "Scientific calculator" (and
    // Pretoria's "Calculator"), which a substring match on "calculator" would catch too.
    const recent = dialog.getByRole("region", { name: "Recent", exact: true });
    await expect(recent.getByRole("link", { name: "calculator", exact: true })).toBeVisible();
  });
});

test.describe("announcement bar", () => {
  test("moves on every six seconds", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    // The timer starts at hydration, which is when the button flips from Play to Pause.
    await expect(page.getByRole("button", { name: "Pause announcements" })).toBeVisible();
    const active = page.locator(".announce-item[data-active]");
    await expect(active).toContainText("Live on all 12");
    await page.clock.fastForward(6500);
    await expect(active).toContainText("pickup point");
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("stays still and offers Play", async ({ page }) => {
      await page.clock.install();
      await page.goto("/");
      await page.clock.fastForward(13_000);
      await expect(page.locator(".announce-item[data-active]")).toContainText("Live on all 12");
      await expect(page.getByRole("button", { name: "Play announcements" })).toBeVisible();
    });
  });
});

test.describe("footer", () => {
  test("the VOSSIE wordmark fills the footer width", async ({ page }) => {
    await page.goto("/");
    const wordmark = page.locator(".footer-wordmark-text");
    await wordmark.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        wordmark.evaluate((element) => {
          const parent = element.parentElement!;
          const style = getComputedStyle(parent);
          const target = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
          return Math.abs(element.getBoundingClientRect().width - target);
        }),
      )
      .toBeLessThanOrEqual(2);
  });

  test("link groups open as accordions on phones", async ({ page }) => {
    test.skip(isTabletOrWider(page), "Phones only");
    await page.goto("/");
    const shop = page.locator("summary.footer-summary", { hasText: /^Shop$/ });
    await shop.scrollIntoViewIfNeeded();
    await shop.click();
    await expect(page.getByRole("link", { name: "Browse everything" })).toBeVisible();
  });

  test("assistive technology meets one copy of each footer list", async ({ page }) => {
    // The phone accordions and the wider columns hold the same links; CSS must hide exactly one of them.
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    const online = footer.getByRole("link", { name: "Eduvos Online", exact: true });
    if (isTabletOrWider(page)) {
      await expect(online).toHaveCount(1);
    } else {
      await expect(online).toHaveCount(0);
      await footer.locator("summary.footer-summary", { hasText: /^Campuses$/ }).click();
      await expect(online).toHaveCount(1);
    }
  });
});
