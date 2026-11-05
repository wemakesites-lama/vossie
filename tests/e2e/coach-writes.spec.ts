import { expect, test } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { main, sellerPage } from "./helpers/messaging";
import { POST_LANDS, publishListing, uniqueWord } from "./helpers/selling";
import { expectStill, recordShifts } from "./helpers/shifts";
import { applyToSell, newShopName, reviewShop, signedInPage, staffNotice } from "./helpers/staff";

// Shop coach without the model (AI stage I1, spec 2 and 3): a new shop's first week in fixed wording on /sell and the
// Launchpad, a done check, a tick when the week has a tip, and nothing for anyone else. Runs last, in the coach-writes
// project, with a shop of its own. Every browser.newContext( here says serviceWorkers: "block" (CLAUDE.md).

test("a new shop's week: fixed wording on /sell and the Launchpad, a done check and a tick", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const shopName = newShopName();
  await applyToSell(page, shopName);
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
  await reviewShop(admin, shopName);
  await admin.getByRole("button", { name: `Approve ${shopName}` }).click();
  await expect(staffNotice(admin)).toContainText("Approved.", POST_LANDS);
  await admin.context().close();

  // The first read makes the week (planning decision 11): no listings and no shop photo yet.
  await page.goto("/sell");
  const week = main(page).getByRole("region", { name: "This week" });
  await expect(week.getByRole("link", { name: "List 3 more things" })).toHaveAttribute("href", "/sell/listings/new");
  await expect(week.getByRole("link", { name: /^Add a photo/ })).toHaveAttribute("href", "/sell/profile");
  expect(await week.getByRole("listitem").count()).toBeLessThanOrEqual(3);
  await expect(week).toContainText("0 of");
  expect(await seriousIssues(page), "/sell with its week").toEqual([]);

  // Three listings: the app sees list-more done.
  for (const n of [1, 2, 3]) await publishListing(page, `Desk lamp ${n} ${uniqueWord()}`);
  await page.goto("/sell");
  await expect(
    week.getByRole("listitem").filter({ has: page.getByRole("link", { name: "List 3 more things" }) }),
  ).toContainText("Done");

  // The Launchpad: the same week above Coming up.
  await page.goto("/hub");
  const card = main(page).getByRole("region", { name: "Your week" });
  await expect(card).toBeVisible();
  const comingUp = main(page).getByRole("heading", { name: "Coming up", level: 2 });
  expect((await card.boundingBox())!.y).toBeLessThan((await comingUp.boundingBox())!.y);
  expect(await seriousIssues(page), "/hub with the Coach card").toEqual([]);

  // If the week has a tip (the sample posts decide: a tip only joins when no post is coming up), Mark done ticks it
  // and lands back on the Launchpad.
  const tick = card.getByRole("button", { name: /^Mark done: / });
  if ((await tick.count()) > 0) {
    await tick.first().click();
    await expect(page).toHaveURL(/\/hub$/);
    await expect(card.getByRole("button", { name: /^Mark done: / })).toHaveCount(0);
    await expect(card).toContainText("Done");
  }

  // Nobody else sees a card.
  const visitor = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const other = await visitor.newPage();
  await other.goto("/hub");
  await expect(main(other).getByRole("heading", { name: "Coming up", level: 2 })).toBeVisible();
  await expect(main(other).getByRole("region", { name: "Your week" })).toHaveCount(0);
  await visitor.close();
});

test("the Launchpad doesn't move for a signed-in seller (planning decision 15)", async ({ browser, baseURL }) => {
  // Tech corner's owner has a week (made on first read, here or by the device projects).
  const seller = await sellerPage(browser, baseURL!);
  await seller.goto("/sell");
  await expect(main(seller).getByRole("region", { name: "This week" })).toBeVisible();
  await recordShifts(seller);
  await expectStill(seller, "the Launchpad with the Coach card", "/hub");
  await expect(main(seller).getByRole("region", { name: "Your week" })).toBeVisible();
  await seller.context().close();
});
