import { expect, test } from "@playwright/test";
import { button, field, main, onlyAt, project, signInAsSample, signUpHere } from "./helpers/messaging";
import { fillListing, idFromEditLink, newSeller, notFoundHeading, photoWithLocation, uniqueWord } from "./helpers/selling";

// The selling tests that write nothing buyers see (selling plan decision 25): a new student's application, its draft
// and its shop, the sample sellers' pages and the owner's view. They run in the device projects; the tests that
// publish, change or delete listings are in selling-writes.spec.ts, which runs after every other test.

const BOTH = ["phone-390", "desktop-1440"];

test.describe("selling (selling spec section 3)", () => {
  test("/sell pitches to a visitor, and Start selling goes through sign-in to the wizard", async ({ page }) => {
    onlyAt(...BOTH);
    await page.goto("/sell");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turn your hustle into a campus-wide business");
    await expect(page).toHaveTitle("Sell · Vossie");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await main(page).getByRole("link", { name: "Start selling" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsell%2Fonboarding$/);
  });

  test("a student applies in five steps, waits for the Hub, edits the shop and prepares a draft", async ({
    page,
    browser,
    baseURL,
  }) => {
    onlyAt(...BOTH);
    // At 1440 the app's JavaScript never arrives: every step is a plain form (spec 2.2).
    if (project() === "desktop-1440") await page.route("**/_next/static/**/*.js", (route) => route.abort());
    const seller = newSeller();
    const shopName = `Bakes ${uniqueWord()}`.slice(0, 60);
    await page.goto("/login?next=%2Fsell%2Fonboarding");
    await signUpHere(page, seller);
    await expect(page).toHaveURL(/\/sell\/onboarding$/);

    await expect(main(page).getByText("Step 1 of 5: Basics")).toBeVisible();
    await expect(page).toHaveTitle("Step 1 of 5: Basics · Set up your shop · Vossie");
    await field(page, "Shop name").fill("T");
    await button(page, "Continue").click();
    await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
    await field(page, "Shop name").fill(shopName);
    await field(page, "Main category").selectOption({ label: "Food" });
    await button(page, "Continue").click();
    await expect(page).toHaveURL(/step=2$/);
    await expect(page).toHaveTitle("Step 2 of 5: About · Set up your shop · Vossie");
    await field(page, "About your shop").fill("I bake between lectures.\nMuffins on Mondays.");
    await button(page, "Continue").click();
    await expect(page).toHaveURL(/step=3$/);
    await field(page, "Shop photo (optional)").setInputFiles(photoWithLocation("shop.png"));
    await button(page, "Continue").click();
    await expect(page).toHaveURL(/step=4$/);
    await main(page).getByRole("checkbox", { name: "Library entrance" }).check();
    await button(page, "Continue").click();
    await expect(page).toHaveURL(/step=5$/);
    await expect(main(page).getByRole("region", { name: "Your answers" })).toContainText(shopName);
    await main(page).getByRole("checkbox", { name: "I've read the seller guidelines" }).check();
    await button(page, "Send for approval").click();

    await expect(page).toHaveURL(/\/sell$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Hub is checking your shop");

    // Edit shop while waiting: the link isn't set yet.
    await page.goto("/sell/profile");
    await expect(main(page).getByText("Your shop's link is set when the Hub approves it.")).toBeVisible();
    await field(page, "Tagline (optional)").fill("Muffins on Mondays.");
    await button(page, "Save changes").click();
    await expect(main(page).getByRole("status").filter({ visible: true })).toHaveText("Your shop is saved.");

    // A draft, while waiting (spec 2.7): drafts only, and buyers can't see it.
    const title = `Muffin box ${uniqueWord()}`;
    await page.goto("/sell/listings/new");
    await expect(main(page).getByText(/Your shop is waiting for the Hub/).filter({ visible: true })).toBeVisible();
    await expect(button(page, "Save and publish")).toHaveCount(0);
    await fillListing(page, title);
    await button(page, "Save as draft").click();
    await expect(page).toHaveURL(/\/sell\/listings\?tab=drafts$/);
    const id = await idFromEditLink(page, title);
    const buyer = await (await browser.newContext({ baseURL })).newPage();
    await buyer.goto(`/listings/${id}`);
    await expect(notFoundHeading(buyer)).toBeVisible();
    await buyer.context().close();
  });

  test("the sample seller waiting for approval sees the waiting page", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Seller waiting for approval", "/sell");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Hub is checking your shop");
    await expect(main(page).getByRole("link", { name: "Your drafts" })).toHaveAttribute("href", "/sell/listings?tab=drafts");
  });

  test("the sample seller's dashboard has the week's numbers, the badge and the shop's pages", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Seller, Tech corner", "/sell");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech corner");
    await expect(main(page).getByText("Your shop is live")).toBeVisible();
    // Other tests message Tech corner at the same time, so the numbers themselves aren't checked.
    await expect(main(page).getByRole("region", { name: "In the last 7 days" })).toBeVisible();
    await expect(main(page).getByRole("region", { name: "Your badge" })).toContainText("Responsive");
    await main(page).getByRole("link", { name: "My listings", exact: true }).click();
    await expect(page).toHaveURL(/\/sell\/listings$/);
    await expect(main(page).getByRole("link", { name: "Edit Casio fx-991ZA Plus calculator" })).toBeVisible();
  });

  test("the owner sees Edit listing and Edit shop; everyone else sees Message seller (spec 2.12)", async ({
    page,
    browser,
    baseURL,
  }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Seller, Tech corner", "/listings/l-001");
    await expect(page.getByRole("link", { name: "Edit listing" }).filter({ visible: true })).toHaveAttribute(
      "href",
      "/sell/listings/l-001/edit",
    );
    await expect(page.getByRole("link", { name: "Message seller" }).filter({ visible: true })).toHaveCount(0);
    await page.goto("/sellers/tech-corner");
    await expect(page.getByRole("link", { name: "Edit shop" }).filter({ visible: true })).toHaveAttribute(
      "href",
      "/sell/profile",
    );
    const visitor = await (await browser.newContext({ baseURL })).newPage();
    await visitor.goto("/listings/l-001");
    await expect(visitor.getByRole("link", { name: "Message seller" }).filter({ visible: true })).toBeVisible();
    await expect(visitor.getByRole("link", { name: "Edit listing" })).toHaveCount(0);
    await visitor.context().close();
  });

  test("another shop's listing has no form for this seller", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Seller, Tech corner", "/sell/listings/l-004/edit");
    await expect(notFoundHeading(page)).toBeVisible();
  });
});
