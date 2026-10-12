import { expect, test } from "@playwright/test";

// Scroll reveals (spec 8) are CSS scroll-driven animations. Chromium runs them, so they are checked here.
test.describe("scroll reveals (spec 8)", () => {
  test.beforeEach(() => {
    test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Checked at 390 and 1440");
  });

  test("a section below the fold waits to rise in", async ({ page }) => {
    await page.goto("/");
    const opacity = await page.locator("#featured").evaluate((element) => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBeLessThan(1);
  });

  test("a section is fully shown once it's on screen", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#featured");
    await section.evaluate((element) => element.scrollIntoView({ block: "start" }));
    await expect.poll(() => section.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  });

  test("nothing reveals with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(await page.locator("#featured").evaluate((element) => element.getAnimations().length)).toBe(0);
  });

  test("nothing reveals with data saver on", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vossie_low_data", "1"));
    await page.goto("/");
    expect(await page.locator("#featured").evaluate((element) => element.getAnimations().length)).toBe(0);
  });
});
