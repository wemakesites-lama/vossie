import { expect, test } from "@playwright/test";

test("the homepage responds", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", /en/);
});
