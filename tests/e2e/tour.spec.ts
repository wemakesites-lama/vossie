import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { onlyAt, signInAsSample } from "./helpers/messaging";
import { expectStill, recordShifts } from "./helpers/shifts";

// The guided tour (guided tour spec 9). Read-only: it writes nothing to the store, so it runs in the device projects
// and isn't in playwright.config.ts's WRITES. Only the built-in page is used, which already blocks service workers.

const tour = (page: Page) => page.getByRole("dialog", { name: /^Step \d+ of \d+/ });

async function openTour(page: Page) {
  // The menu offers a tour only once the page's content has streamed in.
  await expect(page.locator("[data-tour-page]:visible").first()).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Show me around this page" }).click();
  await expect(tour(page)).toBeVisible();
}

/** Every step's title, pressing Next to the end and then Done. */
async function stepTitles(page: Page): Promise<string[]> {
  await openTour(page);
  const titles: string[] = [];
  for (;;) {
    const heading = (await tour(page).getByRole("heading").textContent()) ?? "";
    titles.push(heading.replace(/^Step \d+ of \d+\s*/, "").trim());
    const done = tour(page).getByRole("button", { name: "Done" });
    if (await done.isVisible()) {
      await done.click();
      break;
    }
    await tour(page).getByRole("button", { name: "Next" }).click();
  }
  await expect(tour(page)).toBeHidden();
  return titles;
}

test("Home's tour walks the navigation and ends on Done", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/");
  const titles = await stepTitles(page);
  expect(titles.slice(0, 3)).toEqual(["Search", "Your campus", "Shop"]);
  expect(titles).toContain("Saved");
  expect(titles.at(-1)).toBe("The menu");
});

test("Escape closes the tour and gives focus back to the menu button", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse");
  await openTour(page);
  await page.keyboard.press("Escape");
  await expect(tour(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
});

test("the open tour has no serious accessibility issues", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/");
  await openTour(page);
  expect(await seriousIssues(page)).toEqual([]);
});

test("Home's tour fits the bar: a student's Sell, a seller's My shop and Messages", async ({ page }) => {
  onlyAt("phone-390");
  await page.goto("/");
  const student = await stepTitles(page);
  expect(student).toContain("Sell");
  expect(student).not.toContain("My shop");

  await signInAsSample(page, "Seller, Tech corner", "/");
  const seller = await stepTitles(page);
  expect(seller).toContain("My shop");
  expect(seller).toContain("Messages");
  expect(seller).not.toContain("Sell");
});

const invitation = (page: Page) => page.getByRole("complementary", { name: "Tour invitation" });

test("the invitation waits in the corner of the first toured page, and closing it hides it everywhere", async ({
  page,
}) => {
  onlyAt("phone-390", "desktop-1440");
  // A listing, not Home: many students arrive on a shared link.
  await page.goto("/listings/l-001");
  await expect(invitation(page)).toBeVisible();
  const box = (await invitation(page).boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x + box.width, "in the right-hand corner").toBeGreaterThan(viewport.width - 40);
  expect(box.y, "in the bottom half").toBeGreaterThan(viewport.height / 2);

  await invitation(page).getByRole("button", { name: "Close the invitation" }).click();
  await expect(invitation(page)).toBeHidden();

  await recordShifts(page);
  await expectStill(page, "homepage after closing the invitation", "/");
  await expect(invitation(page)).toBeHidden();
});

test("the invitation's Take the tour starts the page's tour", async ({ page }) => {
  onlyAt("phone-390");
  await page.goto("/");
  await invitation(page).getByRole("button", { name: "Take the tour" }).click();
  await expect(tour(page)).toBeVisible();
  await expect(tour(page).getByRole("heading")).toContainText("Search");
  await page.keyboard.press("Escape");
  await expect(invitation(page), "answered once taken").toBeHidden();
});

test("Shop, a listing, Sell and You each have a tour", async ({ page }) => {
  onlyAt("phone-390");
  for (const path of ["/browse", "/listings/l-001"]) {
    await page.goto(path);
    await openTour(page);
    await page.keyboard.press("Escape");
  }
  await signInAsSample(page, "Seller, Tech corner", "/sell");
  for (const path of ["/sell", "/account"]) {
    await page.goto(path);
    await openTour(page);
    await page.keyboard.press("Escape");
  }
});

test("the menu offers no tour on a page without one", async ({ page }) => {
  onlyAt("phone-390");
  await page.goto("/how-it-works");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show me around this page" })).toHaveCount(0);
});

test("Looking For, Launchpad, Messages, the listing form, Today and Mentoring each have a tour", async ({ page }) => {
  onlyAt("phone-390");
  async function hasTour(path: string) {
    await page.goto(path);
    await openTour(page);
    await page.keyboard.press("Escape");
    await expect(tour(page)).toBeHidden();
  }
  await hasTour("/looking-for");
  await hasTour("/hub");
  await signInAsSample(page, "Seller, Tech corner", "/messages");
  await hasTour("/messages");
  await hasTour("/sell/listings/new");
  // Signed in, the sign-in page has no sample buttons: drop the session before the next account.
  await page.context().clearCookies();
  await signInAsSample(page, "Admin", "/admin");
  await hasTour("/admin");
  await page.context().clearCookies();
  await signInAsSample(page, "Mentor", "/mentor");
  await hasTour("/mentor");
});
