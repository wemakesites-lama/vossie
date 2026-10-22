import { expect, test } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { button, main, newBuyer, reply, sendFirstMessage, signUp } from "./helpers/messaging";
import { POST_LANDS, publishListing, uniqueWord } from "./helpers/selling";
import { applyToSell, newShopName, reviewShop, signedInPage, staffNotice } from "./helpers/staff";

// Role views N2's end to end that write (role views spec 7.1 and 9): a new shop's home from its checklist to All clear,
// a buyer waiting with its row and the seller bar's badge, a sale marked as sold from its thread, and a paused listing's
// row. It runs last, in the role-views-writes project, with a shop, a buyer and listings of its own; the sample shops
// are only read. Every browser.newContext( here says serviceWorkers: "block" (CLAUDE.md).

test("a new shop's home: the checklist, a buyer waiting, a sale marked as sold from its thread, then All clear", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const shopName = newShopName();
  await applyToSell(page, shopName);
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
  await reviewShop(admin, shopName);
  await button(admin, `Approve ${shopName}`).click();
  await expect(staffNotice(admin)).toContainText("Approved.", POST_LANDS);
  await admin.context().close();

  // The new shop's home (spec 7.1, New shop): no photo yet; about and a pickup point from the wizard.
  await page.goto("/sell");
  const checklist = main(page).getByRole("region", { name: "Get your shop going" });
  await expect(checklist).toContainText("2 of 5 done");
  await expect(main(page).getByRole("region", { name: "In the last 7 days" })).toHaveCount(0);
  await expect(main(page).getByText("All clear")).toBeVisible();
  expect(await seriousIssues(page), "the checklist").toEqual([]);

  // The skeleton is shorter than this, the shortest state (spec 9; plan decision 15). Its markup is SellSkeleton's.
  const home = main(page).locator(".sell-home").filter({ visible: true });
  const shortest = await home.evaluate((element) => element.getBoundingClientRect().height);
  const skeleton = await page.evaluate(() => {
    const box = document.createElement("div");
    box.className = "sell-column sell-home";
    box.innerHTML = '<span class="skeleton sell-skeleton-head"></span><span class="skeleton sell-skeleton-body"></span>';
    document.querySelector("main .sell-page")!.append(box);
    const height = box.getBoundingClientRect().height;
    box.remove();
    return height;
  });
  expect(skeleton, "SellSkeleton against a new shop's home").toBeLessThan(shortest);

  // The first listing ticks its step.
  const title = `Desk lamp ${uniqueWord()}`;
  const listingId = await publishListing(page, title);
  await page.goto("/sell");
  await expect(checklist).toContainText("3 of 5 done");

  // A buyer asks: the first row says so, the seller bar's Messages carries the same number, and the row opens Selling.
  const buyerContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const buyer = await buyerContext.newPage();
  await signUp(buyer, newBuyer());
  const threadId = await sendFirstMessage(buyer, listingId, "Is the lamp still available? I can collect today.");
  await page.goto("/sell");
  const waiting = main(page).getByRole("list", { name: "Needs you" }).getByRole("link", { name: /Buyer waiting for a reply/ });
  await expect(waiting).toHaveAccessibleName(new RegExp(`^1\\s*Buyer waiting for a reply\\s*Oldest: ${title}`));
  await expect(
    page.getByRole("navigation", { name: "Selling" }).getByRole("link", { name: "Messages" }),
  ).toHaveAccessibleDescription(/1\s+buyer waiting for a reply/);
  await waiting.click();
  await expect(page).toHaveURL(/\/messages\?tab=selling$/);
  await expect(main(page).getByRole("link", { name: "Selling" })).toHaveAttribute("aria-current", "page");

  // The seller replies and marks it completed; the thread then offers Mark {title} as sold.
  await page.goto(`/messages/${threadId}`);
  await reply(page, "Yes, it's here.");
  await expect(main(page).getByText("Yes, it's here.").filter({ visible: true })).toBeVisible(POST_LANDS);
  await button(page, "Mark as completed").click();
  const markSold = button(page, `Mark ${title} as sold`);
  await expect(markSold).toBeVisible(POST_LANDS);

  // Published and replied: the numbers replace the checklist, and the sale's row opens this thread.
  await page.goto("/sell");
  await expect(main(page).getByRole("region", { name: "Get your shop going" })).toHaveCount(0);
  await expect(main(page).getByRole("region", { name: "In the last 7 days" })).toBeVisible();
  await main(page).getByRole("list", { name: "Needs you" }).getByRole("link", { name: /Sale to mark as sold/ }).click();
  await expect(page).toHaveURL(new RegExp(`/messages/${threadId}$`));
  await markSold.click();
  await expect(
    main(page).getByRole("status").filter({ hasText: "Marked as sold. Its page stays up and says Sold." }),
  ).toBeVisible(POST_LANDS);
  await expect(markSold).toHaveCount(0);
  expect(await seriousIssues(page), "the thread after Mark as sold").toEqual([]);

  // Nothing waits now, and the listing is on Sold.
  await page.goto("/sell");
  await expect(main(page).getByText("All clear")).toBeVisible();
  await page.goto("/sell/listings?tab=sold");
  await expect(main(page).getByRole("link", { name: `Edit ${title}`, exact: true })).toBeVisible();

  // A paused listing has its own row, which opens the Paused tab.
  const second = `Kettle ${uniqueWord()}`;
  await publishListing(page, second);
  await button(page, `Pause ${second}`).click();
  await expect(main(page).getByRole("status")).toContainText("Paused.", POST_LANDS);
  await page.goto("/sell");
  await main(page).getByRole("list", { name: "Needs you" }).getByRole("link", { name: /Paused listing/ }).click();
  await expect(page).toHaveURL(/\/sell\/listings\?tab=paused$/);
  await expect(main(page).getByRole("link", { name: `Edit ${second}`, exact: true })).toBeVisible();
  await buyerContext.close();
});
