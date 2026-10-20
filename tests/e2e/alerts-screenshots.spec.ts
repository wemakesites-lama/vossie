import { expect, test } from "@playwright/test";
import { pressSave } from "./helpers/alerts";
import { button, newBuyer, sellerPage, signUp } from "./helpers/messaging";
import { publishListing } from "./helpers/selling";

// Review screenshots for saved-search alerts (search alerts plan, Task 10). Kept apart from screenshots.spec.ts, and
// named so the alerts-writes project's testMatch (/alerts-writes\.spec\.ts$/) doesn't pick it up: it runs in the
// device projects, and only with SCREENSHOTS=1.
test.skip(!process.env.SCREENSHOTS, "Run with SCREENSHOTS=1 to refresh the review screenshots");

test("search alerts review screenshots", async ({ page, browser, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/search-alerts/${project}-${name}.png`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  // The project's width is in the word: both projects run at once, and a shared word would match the other's listings.
  const word = `lamp${project.replace(/\D/g, "")}x${Date.now().toString(36)}`;
  const results = `/browse?q=${word}&campus=midrand`;
  const label = `“${word}” at Midrand`;

  await page.goto(results);
  await expect(page.locator("main .save-search").filter({ visible: true })).toBeVisible();
  await page.screenshot({ path: file("01-browse-save-signed-out"), fullPage: true });

  await signUp(page, newBuyer());
  await page.goto(results);
  await expect(button(page, "Save this search")).toBeVisible();
  await page.screenshot({ path: file("02-browse-save-button"), fullPage: true });
  await pressSave(page);
  await page.screenshot({ path: file("03-browse-search-saved"), fullPage: true });

  await page.goto("/browse?cat=tech&campus=all&price=under-500");
  await pressSave(page);
  await page.goto("/saved?tab=searches");
  await expect(button(page, `Pause alerts for ${label}`)).toBeVisible();
  await page.screenshot({ path: file("04-saved-searches"), fullPage: true });
  await button(page, `Pause alerts for ${label}`).click();
  await expect(page.locator("main").getByRole("status")).toHaveText(`Alerts paused for ${label}.`);
  await page.screenshot({ path: file("05-saved-searches-paused"), fullPage: true });
  await button(page, `Resume alerts for ${label}`).click();
  await expect(page.locator("main").getByRole("status")).toHaveText(`Alerts on for ${label}.`);

  const shop = await sellerPage(browser, baseURL!);
  await publishListing(shop, `Desk lamp ${word}`);
  await publishListing(shop, `Desk fan ${word}`);
  await shop.context().close();
  await page.goto("/notifications");
  await expect(page.locator("main").getByText(`2 new listings match your search ${label}`).filter({ visible: true })).toBeVisible();
  await page.screenshot({ path: file("06-notification"), fullPage: true });
});
