import { expect, test } from "@playwright/test";

/** Routes don't change with width, so one phone and one desktop size are enough. */
function onlyAtPhoneAndDesktop() {
  test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Covered at 390 and 1440");
}

test.describe("routes", () => {
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

  test("account pages send a signed-out visitor to sign in, coming back afterwards (accounts spec 2.10)", async ({
    page,
  }) => {
    onlyAtPhoneAndDesktop();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
    await page.goto("/account/privacy");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fprivacy$/);
  });

  test("messaging pages send a signed-out visitor to sign in, coming back afterwards (messaging spec 3)", async ({
    page,
  }) => {
    onlyAtPhoneAndDesktop();
    for (const [path, next] of [
      ["/messages", "%2Fmessages"],
      ["/messages?tab=selling", "%2Fmessages%3Ftab%3Dselling"],
      ["/messages/conv-s1", "%2Fmessages%2Fconv-s1"],
      ["/notifications", "%2Fnotifications"],
      ["/listings/l-001/message", "%2Flistings%2Fl-001%2Fmessage"],
      ["/sellers/tech-corner/message", "%2Fsellers%2Ftech-corner%2Fmessage"],
      ["/report?listing=l-001", "%2Freport%3Flisting%3Dl-001"],
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${next}$`));
    }
    // Something that doesn't exist is the 404 before any sign-in.
    for (const path of ["/listings/nope/message", "/sellers/nope/message", "/report?listing=nope", "/report"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    }
  });

  test("the selling pages send a signed-out visitor to sign in, and back again (selling spec section 3)", async ({
    page,
    baseURL,
  }) => {
    onlyAtPhoneAndDesktop();
    for (const path of [
      "/sell/onboarding?step=2",
      "/sell/listings",
      "/sell/listings/new",
      "/sell/listings/l-001/edit",
      "/sell/listings/l-001/delete",
      "/sell/profile",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(`${baseURL}/login?next=${encodeURIComponent(path)}`);
    }
  });
});
