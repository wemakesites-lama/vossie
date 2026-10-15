import { expect, test, type Page } from "@playwright/test";
import { containsText, GPS } from "../helpers/image-bytes";
import { button, field, main, signInAsSample } from "./helpers/messaging";
import {
  cardsFor,
  deleteMade,
  expectAfterWrite,
  fillListing,
  idFromEditLink,
  type Made,
  notFoundHeading,
  photoWithLocation,
  publishListing,
  uniqueWord,
} from "./helpers/selling";

// These run in the selling-writes project, after the five device projects (selling plan decision 25). Each uses the
// sample seller and touches only its own new listing, found by a title no other test uses, and deletes it afterwards,
// passed or failed, so a reused server or a retry starts from the sample counts. None pauses Tech corner or changes
// its link: unit tests cover both. A buyer's page right after a write is loaded until it shows the change (amendment
// 16); the seller's pages are reached through the action's redirect.

const QUICK = { timeout: 2_000 };
const browseFor = (title: string) => `/browse?q=${encodeURIComponent(title)}&campus=all`;
const photoAddresses = (page: Page) =>
  page.locator('main input[name="photo"]').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
/** My listings' tab links. */
const tab = (page: Page, label: string) =>
  main(page).getByRole("navigation", { name: "Listings by state" }).filter({ visible: true }).getByRole("link", {
    name: new RegExp(`^${label} \\(\\d+\\)$`),
  });

/** This test's listing, deleted after it whatever happened (deleteMade). */
let made: Made = { id: null, titles: [] };
test.beforeEach(() => {
  made = { id: null, titles: [] };
});
test.afterEach(async ({ browser, baseURL }) => {
  await deleteMade(browser, baseURL!, made);
});

test("a new listing with a photo shows in browse, on its page and on the storefront straight away", async ({
  page,
  request,
}) => {
  test.slow();
  const title = `Desk fan ${uniqueWord()}`;
  made.titles.push(title);
  await signInAsSample(page, "Seller, Tech corner", "/sell");
  const id = await publishListing(page, title, { photos: [photoWithLocation("fan.png")] });
  made.id = id;
  await expect(main(page).getByRole("status").filter({ visible: true })).toContainText(
    "Published. Buyers can find it now.",
  );

  await expectAfterWrite(page, browseFor(title), () => expect(cardsFor(page, title)).toHaveCount(1, QUICK));

  await expectAfterWrite(page, `/listings/${id}`, () =>
    expect(page.getByRole("heading", { level: 1 })).toHaveText(title, QUICK),
  );
  // One photo: the gallery is no region (it scrolls only with more), and an empty description means the title.
  const cover = main(page).getByRole("img", { name: title, exact: true }).first();
  await expect(cover).toHaveAttribute("src", /\/_next\/image\?url=%2Fphotos%2Fph-/);
  await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  // The browser re-encoded it as WebP, which left its hidden data behind (spec 2.3).
  const src = decodeURIComponent(/url=([^&]+)/.exec((await cover.getAttribute("src")) ?? "")![1]);
  const photo = await request.get(src);
  expect(photo.headers()["content-type"]).toBe("image/webp");
  expect(containsText(await photo.body(), GPS)).toBe(false);

  await expectAfterWrite(page, "/sellers/tech-corner", () => expect(cardsFor(page, title)).toHaveCount(1, QUICK));
});

test("edit, pause, resume, mark sold, relist and delete, each seen by a buyer", async ({ page, browser, baseURL }) => {
  test.slow();
  const title = `Kettle ${uniqueWord()}`;
  const renamed = `${title} white`;
  made.titles.push(title, renamed);
  await signInAsSample(page, "Seller, Tech corner", "/sell");
  const id = await publishListing(page, title);
  made.id = id;
  const buyer = await (await browser.newContext({ baseURL })).newPage();

  await main(page).getByRole("link", { name: `Edit ${title}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/sell/listings/${id}/edit$`));
  await field(page, "Title").fill(renamed);
  await button(page, "Save and publish").click();
  await expect(page).toHaveURL(/\/sell\/listings$/);
  await expect(main(page).getByRole("status").filter({ visible: true })).toContainText("Your changes are saved.");
  await expectAfterWrite(buyer, `/listings/${id}`, () =>
    expect(buyer.getByRole("heading", { level: 1 })).toHaveText(renamed, QUICK),
  );

  await main(page).getByRole("button", { name: `Pause ${renamed}` }).click();
  await expect(main(page).getByRole("status").filter({ visible: true })).toContainText("Paused.");
  await expectAfterWrite(buyer, `/listings/${id}`, async () => {
    await expect(buyer.getByText("Not taking orders right now").filter({ visible: true })).toBeVisible(QUICK);
    await expect(buyer.getByRole("link", { name: "Message seller" })).toHaveCount(0, QUICK);
  });
  await expectAfterWrite(buyer, browseFor(renamed), async () => {
    await expect(buyer.getByRole("heading", { level: 1 })).toBeVisible(QUICK);
    await expect(cardsFor(buyer, renamed)).toHaveCount(0, QUICK);
  });

  await tab(page, "Paused").click();
  await expect(page).toHaveURL(/\/sell\/listings\?tab=paused$/);
  await main(page).getByRole("button", { name: `Resume ${renamed}` }).click();
  await expect(main(page).getByRole("status").filter({ visible: true })).toContainText("It's available again.");
  await expectAfterWrite(buyer, browseFor(renamed), () => expect(cardsFor(buyer, renamed)).toHaveCount(1, QUICK));

  await tab(page, "Available").click();
  await expect(page).toHaveURL(/\/sell\/listings$/);
  await main(page).getByRole("button", { name: `Mark sold ${renamed}` }).click();
  await expect(main(page).getByRole("status").filter({ visible: true })).toContainText("Marked as sold.");
  await expectAfterWrite(buyer, `/listings/${id}`, () =>
    expect(buyer.locator("main .availability-banner").filter({ visible: true })).toHaveText("Sold", QUICK),
  );
  await expectAfterWrite(buyer, browseFor(renamed), async () => {
    await expect(buyer.getByRole("heading", { level: 1 })).toBeVisible(QUICK);
    await expect(cardsFor(buyer, renamed)).toHaveCount(0, QUICK);
  });

  await tab(page, "Sold").click();
  await expect(page).toHaveURL(/\/sell\/listings\?tab=sold$/);
  await main(page).getByRole("button", { name: `Relist ${renamed}` }).click();
  await expect(main(page).getByRole("status").filter({ visible: true })).toContainText("It's available again.");
  await expectAfterWrite(buyer, browseFor(renamed), () => expect(cardsFor(buyer, renamed)).toHaveCount(1, QUICK));

  await tab(page, "Available").click();
  await expect(page).toHaveURL(/\/sell\/listings$/);
  await main(page).getByRole("link", { name: `Delete ${renamed}` }).click();
  await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText("Delete this listing?");
  await button(page, "Delete listing").click();
  await expect(page).toHaveURL(/\/sell\/listings$/);
  await expect(main(page).getByRole("status").filter({ visible: true })).toHaveText("Deleted.");
  made = { id: null, titles: [] };
  await expectAfterWrite(buyer, `/listings/${id}`, () => expect(notFoundHeading(buyer)).toBeVisible(QUICK));
  await buyer.context().close();
});

test("without the app's JavaScript, photos upload, move in a round trip, and lose their hidden data", async ({
  page,
  request,
}) => {
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  const title = `Desk lamp ${uniqueWord()}`;
  made.titles.push(title);
  await signInAsSample(page, "Seller, Tech corner", "/sell/listings/new");
  await fillListing(page, title);
  await field(page, "Add photos").setInputFiles([photoWithLocation("front.png"), photoWithLocation("back.png")]);
  await button(page, "Save as draft").click();
  await expect(page).toHaveURL(/\/sell\/listings\?tab=drafts$/);

  const id = await idFromEditLink(page, title);
  made.id = id;
  await main(page).getByRole("link", { name: `Edit ${title}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/sell/listings/${id}/edit$`));
  // The form streams in after the address changes, so the photos are read once they're there.
  await expect.poll(() => photoAddresses(page)).toHaveLength(2);
  const before = await photoAddresses(page);
  await field(page, "Description").fill("Typed before the move.");
  await main(page).getByRole("button", { name: "Make cover (photo 2)" }).click();
  await expect(page).toHaveURL(new RegExp(`/sell/listings/${id}/edit#edit-${id}-photos$`));
  await expect.poll(() => photoAddresses(page)).toEqual([before[1], before[0]]);
  await expect(field(page, "Description")).toHaveValue("Typed before the move.");

  await button(page, "Save and publish").click();
  // A redirect with no fragment keeps the request's (HTTP's rule), so the browser carries the move's #…-photos along.
  await expect(page).toHaveURL(/\/sell\/listings(#edit-l-[0-9a-f-]{36}-photos)?$/);
  await expect(main(page).getByRole("status")).toContainText("Published. Buyers can find it now.");
  // Nothing in the browser re-encoded them: they're PNGs, stripped by the server (spec 2.3).
  for (const src of before) {
    expect(src).toMatch(/^\/photos\/ph-/);
    const photo = await request.get(src);
    expect(photo.headers()["content-type"]).toBe("image/png");
    expect(containsText(await photo.body(), GPS)).toBe(false);
  }
});

test("Back after publishing shows the storefront with the new listing, not a kept copy", async ({ page }) => {
  const title = `Desk clock ${uniqueWord()}`;
  made.titles.push(title);
  await signInAsSample(page, "Seller, Tech corner", "/sellers/tech-corner");
  // Client-side navigations from here, so Next keeps the storefront for Back (messaging plan decision 6).
  await page.getByRole("link", { name: "Edit shop" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/sell\/profile$/);
  await main(page).getByRole("link", { name: "Your shop", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/sell$/);
  await main(page).getByRole("link", { name: "New listing", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/sell\/listings\/new$/);
  await fillListing(page, title);
  await button(page, "Save and publish").click();
  await expect(page).toHaveURL(/\/sell\/listings$/);
  made.id = await idFromEditLink(page, title);
  await page.goBack();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/sellers\/tech-corner$/);
  await expect(cardsFor(page, title)).toHaveCount(1);
});
