import { expect, test, type Request } from "@playwright/test";

test.skip(!process.env.SCREENSHOTS, "Run with SCREENSHOTS=1 to refresh the review screenshots");

test("shell review screenshots", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/part-1/${project}-${name}.png`;
  const shot = (name: string) => page.screenshot({ path: file(name) });
  const menu = page.getByRole("dialog", { name: "Menu" });
  const search = page.getByRole("dialog", { name: "Search Vossie" });
  const picker = page.getByRole("dialog", { name: "Choose your campus" });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await shot("01-top");

  await page.evaluate(() => window.scrollTo(0, 700));
  await page.getByRole("button", { name: "Show navigation" }).waitFor();
  await shot("02-crest-only");

  await page.getByRole("button", { name: "Show navigation" }).click();
  await shot("03-revealed");

  // Each overlay is waited for before its shot, and waited out after Escape before the next step.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(menu).toBeVisible();
  await shot("04-menu");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(search).toBeVisible();
  await shot("05-search");
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();

  if (project === "desktop-1440") {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: /^Shopping at/ }).click();
  } else {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: /^Shopping at/ }).click();
    await expect(menu).toBeHidden();
  }
  await expect(picker).toBeVisible();
  await shot("06-campus-picker");
  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();

  // The whole footer, with the sticky header hidden so it can't sit over the top of it. The fonts are in first, so
  // the wordmark is fitted.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.getByRole("contentinfo").screenshot({
    path: file("07-footer"),
    style: ".site-header { visibility: hidden !important; }",
  });
});

test("homepage review screenshots", async ({ page, context, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/part-2/${project}-${name}.png`;

  // The shots wait for photos, not for "networkidle": from the second visit in a browser context, Playwright counts
  // Next's cached link prefetches as never finished, so the page never goes quiet. Only photo requests are tracked.
  const photosInFlight = new Set<Request>();
  page.on("request", (request) => {
    if (request.resourceType() === "image") photosInFlight.add(request);
  });
  page.on("requestfinished", (request) => photosInFlight.delete(request));
  page.on("requestfailed", (request) => photosInFlight.delete(request));

  /** Scroll the whole page so every lazy photo loads, then come back to the top for a full-page shot. */
  async function wholePage(name: string) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.scrollTo(0, 0);
      await document.fonts.ready;
    });
    await expect.poll(() => photosInFlight.size).toBe(0);
    await expect(page.locator(".site-header")).toHaveAttribute("data-mode", "expanded");
    await page.screenshot({ path: file(name), fullPage: true });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.screenshot({ path: file("01-first-screen") });
  await wholePage("02-whole-page");

  await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
  await page.goto("/");
  await wholePage("03-whole-page-midrand");
});
