import { expect, test } from "@playwright/test";

test("data saver chosen on an earlier visit applies before the page paints", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vossie_low_data", "1"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-low-data", "");
});

test("the browser's Save-Data setting turns data saver on when nothing is saved", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-low-data", "");
});

test("data saver is off by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-low-data");
});
