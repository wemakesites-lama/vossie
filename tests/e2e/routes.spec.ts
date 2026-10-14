import { expect, test } from "@playwright/test";

const PLACEHOLDERS: Array<[path: string, title: string]> = [
  ["/sell", "Start selling"],
  ["/login", "Sign in"],
  ["/account", "Your account"],
];

/** Routes don't change with width, so one phone and one desktop size are enough. */
function onlyAtPhoneAndDesktop() {
  test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Covered at 390 and 1440");
}

test.describe("placeholder routes", () => {
  for (const [path, title] of PLACEHOLDERS) {
    test(`${path} renders inside the shell`, async ({ page }) => {
      onlyAtPhoneAndDesktop();
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page).toHaveTitle(`${title} · Vossie`);
      await expect(page.getByText("Coming in the next stage")).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeAttached();
    });
  }

  test("unknown listing, collection, seller, request and Hub post links show the 404 page", async ({ page }) => {
    onlyAtPhoneAndDesktop();
    await page.goto("/listings/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await expect(page).toHaveTitle("Page not found · Vossie");
    await page.goto("/collections/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await expect(page).toHaveTitle("Page not found · Vossie");
    await page.goto("/sellers/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await expect(page).toHaveTitle("Page not found · Vossie");
    await page.goto("/looking-for/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await expect(page).toHaveTitle("Page not found · Vossie");
    await page.goto("/hub/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await expect(page).toHaveTitle("Page not found · Vossie");
  });

  test("old category and campus links open browse (spec 3.1)", async ({ page }) => {
    onlyAtPhoneAndDesktop();
    await page.goto("/categories/tech");
    await expect(page).toHaveURL(/\/browse\?cat=tech$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech");
    await page.goto("/c/midrand");
    await expect(page).toHaveURL(/\/browse\?campus=midrand$/);
    await expect(page.getByRole("link", { name: "Remove filter: Midrand" })).toBeVisible();
    // An unknown campus is ignored, so the link still shows results.
    await page.goto("/c/atlantis");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Everything");
  });

  test("a made-up path is a real 404", async ({ page }) => {
    onlyAtPhoneAndDesktop();
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await expect(page).toHaveTitle("Page not found · Vossie");
  });
});
