import { expect, test } from "@playwright/test";
import { button, field, main, newBuyer, onlyAt, signUp } from "./helpers/messaging";
import { POST_LANDS } from "./helpers/selling";

// Deleting an account ends with a full page load, as signing out does (stage K decision 54; Lama, 2026-10-20). It
// runs at 390 and 1440px with a fresh account, and writes only that account.

test.describe("deleting an account leaves nothing signed in behind (stage K decision 54)", () => {
  test.beforeEach(() => onlyAt("phone-390", "desktop-1440"));

  test("the account's email isn't in the document after deleting it, even in a hidden kept page", async ({
    page,
    baseURL,
  }) => {
    const buyer = newBuyer();
    await signUp(page, buyer);
    await expect(main(page).getByText(buyer.email).filter({ visible: true })).toBeVisible();
    // A client navigation away: Next keeps /account hidden in the document (spec 2.1).
    await main(page).getByRole("link", { name: "Privacy settings" }).click();
    await expect(page).toHaveURL(/\/account\/privacy$/);
    expect(await page.content(), "the kept /account is still in the document before deleting").toContain(buyer.email);
    await field(page, "I understand this can't be undone").check();
    await button(page, "Delete my account").click();
    await expect(page).toHaveURL(`${baseURL}/`, POST_LANDS);
    await expect(page.locator(".toast")).toHaveText("Your account has been deleted");
    expect(await page.content()).not.toContain(buyer.email);
  });

  test("a deletion posted from another site is refused, and a link deletes nothing", async ({ page }) => {
    const buyer = newBuyer();
    await signUp(page, buyer);
    const response = await page.request.post("/account/privacy/delete", {
      headers: { Origin: "https://evil.example" },
      form: { confirm: "yes" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    const away = await page.request.get("/account/privacy/delete", { maxRedirects: 0 });
    expect([away.status(), away.headers()["location"]]).toEqual([303, "/account/privacy"]);
    await page.goto("/account");
    await expect(main(page).getByText(buyer.email).filter({ visible: true })).toBeVisible();
  });
});
