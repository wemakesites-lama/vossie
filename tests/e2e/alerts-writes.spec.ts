import { expect, test } from "@playwright/test";
import { matchNotes, pathOf, pressSave, searchAt } from "./helpers/alerts";
import { button, field, main, newBuyer, sellerPage, signUp } from "./helpers/messaging";
import { POST_LANDS, publishListing, uniqueWord } from "./helpers/selling";

// Runs in the alerts-writes project, after every other test (search alerts plan decision 19): publishing changes
// browse's counts, and Tech corner's new listings would otherwise land in community-writes' follow test.

test.describe("saved-search alerts (search alerts spec section 6)", () => {
  test("a match is named and opened; two more later make the same line unread again, linking to them newest first", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, newBuyer());
    const word = uniqueWord();
    await page.goto(searchAt(word));
    await pressSave(page);

    const shop = await sellerPage(browser, baseURL!);
    const first = `Desk fan ${word}`;
    const firstId = await publishListing(shop, first);

    await page.goto("/notifications");
    const note = matchNotes(page, word);
    await expect(note).toHaveCount(1);
    await expect(note).toContainText(`${first} matches your search “${word}” at Midrand`);
    await note.click();
    await expect(page).toHaveURL(new RegExp(`/listings/${firstId}$`));

    // Opening /notifications marked it read; the next two make it unread again, counting only them (spec 2.12).
    const second = `Desk lamp ${word}`;
    const third = `Desk clock ${word}`;
    await publishListing(shop, second);
    await publishListing(shop, third);
    await shop.context().close();

    await page.goto("/notifications");
    await expect(note).toHaveCount(1);
    await expect(note).toContainText("New");
    await expect(note).toContainText(`2 new listings match your search “${word}” at Midrand`);
    await note.click();
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === `/browse?q=${word}&campus=midrand&sort=new`);
    const cards = page.locator("main article").filter({ visible: true });
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText(third);
    await expect(cards.nth(1)).toContainText(second);
  });

  test("an edit that makes a listing match, and a relist, send no alert (spec 2.10)", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const word = uniqueWord();
    const shop = await sellerPage(browser, baseURL!);
    const kettleId = await publishListing(shop, `Kettle ${uniqueWord()}`);
    const lamp = `Desk lamp ${word}`;
    await publishListing(shop, lamp);

    await signUp(page, newBuyer());
    await page.goto(searchAt(word));
    await pressSave(page);
    expect(pathOf(page)).toBe(searchAt(word));

    // The kettle is renamed to match; the lamp, which matches already, is marked sold and relisted.
    await shop.goto(`/sell/listings/${kettleId}/edit`);
    await field(shop, "Title").fill(`Kettle ${word}`);
    await button(shop, "Save and publish").click();
    await expect(main(shop).getByRole("status")).toContainText("Your changes are saved.", POST_LANDS);
    await shop.goto("/sell/listings");
    await main(shop).getByRole("button", { name: `Mark sold ${lamp}` }).click();
    await expect(main(shop).getByRole("status")).toContainText("Marked as sold.", POST_LANDS);
    await shop.goto("/sell/listings?tab=sold");
    await main(shop).getByRole("button", { name: `Relist ${lamp}` }).click();
    await expect(main(shop).getByRole("status")).toContainText("It's available again.", POST_LANDS);
    await shop.goto("/sell/listings");
    await expect(main(shop).getByRole("link", { name: `Edit ${lamp}`, exact: true })).toBeVisible();
    await shop.context().close();

    await page.goto("/notifications");
    await expect(main(page).getByRole("heading", { level: 1 }).filter({ visible: true })).toBeVisible();
    await expect(matchNotes(page, word)).toHaveCount(0);
  });
});
