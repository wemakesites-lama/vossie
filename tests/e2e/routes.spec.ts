import { expect, test } from "@playwright/test";

const PLACEHOLDERS: Array<[path: string, title: string]> = [
  ["/browse", "Browse"],
  ["/sell", "Start selling"],
  ["/hub", "The Incubation Hub"],
  ["/how-it-works", "How Vossie works"],
  ["/safety", "Safety"],
  ["/privacy", "Privacy (POPIA)"],
  ["/looking-for", "Looking For"],
  ["/login", "Sign in"],
  ["/account", "Your account"],
  ["/saved", "Saved"],
  ["/c/midrand", "Midrand"],
  ["/c/online", "Eduvos Online"],
  ["/categories/tech", "Tech"],
  ["/categories/textbooks-notes", "Textbooks & notes"],
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
      await expect(page.getByText("Coming in the next stage")).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeAttached();
    });
  }

  test("unknown campus and category slugs show the 404 page", async ({ page }) => {
    onlyAtPhoneAndDesktop();
    await page.goto("/c/atlantis");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await page.goto("/categories/spaceships");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
  });

  test("a made-up path is a real 404", async ({ page }) => {
    onlyAtPhoneAndDesktop();
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
  });
});
