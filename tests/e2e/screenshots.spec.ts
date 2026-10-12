import { test } from "@playwright/test";

test.skip(!process.env.SCREENSHOTS, "Run with SCREENSHOTS=1 to refresh the review screenshots");

test("shell review screenshots", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const shot = (name: string) => page.screenshot({ path: `docs/progress/part-1/${project}-${name}.png` });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await shot("01-top");

  await page.evaluate(() => window.scrollTo(0, 700));
  await page.getByRole("button", { name: "Show navigation" }).waitFor();
  await shot("02-crest-only");

  await page.getByRole("button", { name: "Show navigation" }).click();
  await shot("03-revealed");

  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await shot("04-menu");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Search", exact: true }).click();
  await shot("05-search");
  await page.keyboard.press("Escape");

  if (project === "desktop-1440") {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: /^Shopping at/ }).click();
  } else {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /^Shopping at/ }).click();
  }
  await shot("06-campus-picker");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await page.locator(".footer-wordmark").scrollIntoViewIfNeeded();
  await shot("07-footer");
});
