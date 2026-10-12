import { expect, test } from "@playwright/test";

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
