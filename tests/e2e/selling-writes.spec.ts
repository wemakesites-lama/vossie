import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { containsText, GPS } from "../helpers/image-bytes";
import { seriousIssues } from "./helpers/axe";
import { button, field, main, signInAsSample } from "./helpers/messaging";
import {
  browseFor,
  cardsFor,
  fillListing,
  idOfEditLink,
  notFoundHeading,
  photoWithLocation,
  POST_LANDS,
  publishListing,
  uniqueWord,
} from "./helpers/selling";

// These run in the selling-writes project, after the five device projects (selling plan decision 25). Each uses the
// sample seller and touches only its own new listing, found by a word in its title that no other test uses.

const photoAddresses = (page: Page) =>
  page
    .locator('main input[name="photo"]')
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

/**
 * What /photos/… sends (amendments 8.10, 9.4 and 9.8): its real type, no sniffing, and an hour in any cache (fix 2 of
 * the review after C2 and C3).
 */
function expectServedPhoto(photo: APIResponse, type: string) {
  expect(photo.status()).toBe(200);
  expect(photo.headers()["content-type"]).toBe(type);
  expect(photo.headers()["x-content-type-options"]).toBe("nosniff");
  expect(photo.headers()["cache-control"]).toBe("public, max-age=3600");
}

test("a new listing with a photo shows in browse, on its page and on the storefront straight away", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const word = uniqueWord();
  const title = `Desk fan ${word}`;
  await signInAsSample(page, "Seller, Tech corner", "/sell");
  const id = await publishListing(page, title, { photos: [photoWithLocation("fan.png")] });
  await expect(main(page).getByRole("status")).toContainText("Published. Buyers can find it now.");

  await page.goto(browseFor(word));
  await expect(cardsFor(page, word)).toHaveCount(1);

  await page.goto(`/listings/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  // With no description of its own, the photo is described by the title (spec 2.5).
  const cover = page.locator(".gallery img").first();
  await expect(cover).toHaveAttribute("alt", title);
  await expect(cover).toHaveAttribute("src", /\/_next\/image\?url=%2Fphotos%2Fph-/);
  await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  // The address behind it is a real photo, served with the right headers. The browser re-encoded it as WebP, which
  // left its hidden data behind (spec 2.3).
  const src = decodeURIComponent(/url=([^&]+)/.exec((await cover.getAttribute("src")) ?? "")![1]);
  const photo = await request.get(src);
  expectServedPhoto(photo, "image/webp");
  expect(containsText(await photo.body(), GPS)).toBe(false);

  await page.goto("/sellers/tech-corner");
  await expect(cardsFor(page, word)).toHaveCount(1);
});

test("edit, pause, resume, mark sold and delete, each seen by a buyer", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  const word = uniqueWord();
  const title = `Kettle ${word}`;
  const renamed = `${title} white`;
  await signInAsSample(page, "Seller, Tech corner", "/sell");
  const id = await publishListing(page, title);
  const buyer = await (await browser.newContext({ baseURL, serviceWorkers: "block" })).newPage();

  await page.goto(`/sell/listings/${id}/edit`);
  await field(page, "Title").fill(renamed);
  await button(page, "Save and publish").click();
  await expect(main(page).getByRole("status")).toContainText("Your changes are saved.", POST_LANDS);
  await buyer.goto(`/listings/${id}`);
  await expect(buyer.getByRole("heading", { level: 1 })).toHaveText(renamed);

  await main(page).getByRole("button", { name: `Pause ${renamed}` }).click();
  await expect(main(page).getByRole("status")).toContainText("Paused.", POST_LANDS);
  await buyer.goto(`/listings/${id}`);
  await expect(buyer.getByText("Not taking orders right now").filter({ visible: true })).toBeVisible();
  await buyer.goto(browseFor(word));
  await expect(cardsFor(buyer, word)).toHaveCount(0);

  await page.goto("/sell/listings?tab=paused");
  await main(page).getByRole("button", { name: `Resume ${renamed}` }).click();
  await expect(main(page).getByRole("status")).toContainText("It's available again.", POST_LANDS);
  await buyer.goto(browseFor(word));
  await expect(cardsFor(buyer, word)).toHaveCount(1);

  await page.goto("/sell/listings");
  await main(page).getByRole("button", { name: `Mark sold ${renamed}` }).click();
  await expect(main(page).getByRole("status")).toContainText("Marked as sold.", POST_LANDS);
  await buyer.goto(`/listings/${id}`);
  await expect(buyer.getByText("Sold", { exact: true }).filter({ visible: true })).toBeVisible();

  await page.goto("/sell/listings?tab=sold");
  await main(page).getByRole("link", { name: `Delete ${renamed}` }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Delete this listing?");
  await button(page, "Delete listing").click();
  await expect(main(page).getByRole("status")).toHaveText("Deleted.", POST_LANDS);
  await buyer.goto(`/listings/${id}`);
  await expect(notFoundHeading(buyer)).toBeVisible();
  await buyer.context().close();
});

test("without the app's JavaScript, photos upload, move in a round trip, and lose their hidden data", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  const title = `Desk lamp ${uniqueWord()}`;
  await signInAsSample(page, "Seller, Tech corner", "/sell/listings/new");
  await fillListing(page, title);
  await field(page, "Add photos").setInputFiles([photoWithLocation("front.png"), photoWithLocation("back.png")]);
  await button(page, "Save as draft").click();
  await expect(page).toHaveURL(/\/sell\/listings\?tab=drafts$/, POST_LANDS);

  await main(page).getByRole("link", { name: `Edit ${title}`, exact: true }).click();
  // The form streams in: wait for it before reading its photos.
  await expect(field(page, "Title")).toHaveValue(title);
  const before = await photoAddresses(page);
  expect(before).toHaveLength(2);
  await field(page, "Description").fill("Typed before the move.");
  await main(page).getByRole("button", { name: "Make cover (photo 2)" }).click();
  // Back to the photos' legend, above the list (amendment 11.4).
  await expect(page).toHaveURL(/\/edit#edit-l-[0-9a-f-]{36}-photos-title$/, POST_LANDS);
  await expect(field(page, "Description")).toHaveValue("Typed before the move.");
  expect(await photoAddresses(page)).toEqual([before[1], before[0]]);

  await button(page, "Save and publish").click();
  // A redirect with no fragment of its own keeps the one the form was sent from (RFC 9110, 10.2.2), so the photos'
  // legend's id may still be in the address.
  await expect(page).toHaveURL(/\/sell\/listings(#.*)?$/, POST_LANDS);
  // Nothing in the browser re-encoded them: they're PNGs, stripped by the server (spec 2.3).
  for (const src of before) {
    const photo = await request.get(src);
    expectServedPhoto(photo, "image/png");
    expect(containsText(await photo.body(), GPS)).toBe(false);
  }
});

test("a new listing is made once, however many times its form is sent (amendment 14)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  const word = uniqueWord();
  const title = `Desk plant ${word}`;
  await signInAsSample(page, "Seller, Tech corner", "/sell/listings/new");
  await fillListing(page, title);
  await field(page, "Add photos").setInputFiles(photoWithLocation("plant.png"));
  const sent = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/sell/listings/new"),
  );
  await button(page, "Save and publish").click();
  const first = await sent;
  await expect(page).toHaveURL(/\/sell\/listings$/, POST_LANDS);
  await expect(main(page).getByRole("status")).toContainText("Published. Buyers can find it now.");

  // The same post sent twice more, together, as a double-pressed button or a browser's retry would: the form's own
  // headers and body, so the same one-time token. Each goes where the first went and makes nothing.
  const headers = await first.allHeaders();
  const body = first.postDataBuffer()!;
  const replay = (data: Buffer) =>
    page.context().request.post(first.url(), {
      headers: { "content-type": headers["content-type"], origin: headers.origin, referer: headers.referer },
      data,
    });
  for (const again of await Promise.all([replay(body), replay(body)])) {
    expect(again.ok()).toBe(true);
    expect(new URL(again.url()).pathname).toBe("/sell/listings");
  }
  // A control, so that result means something: the same post with a made-up token goes back to the form instead
  // (the token is refused, with what was typed kept), and still makes nothing.
  const token = /name="once"\r\n\r\n([^\r]+)\r\n/.exec(body.toString("latin1"))![1];
  const forged = Buffer.from(body.toString("latin1").replace(token, "x".repeat(token.length)), "latin1");
  const refused = await replay(forged);
  expect(refused.ok()).toBe(true);
  expect(new URL(refused.url()).pathname).toBe("/sell/listings/new");

  await page.goto("/sell/listings");
  await expect(main(page).getByRole("link", { name: `Edit ${title}`, exact: true })).toHaveCount(1);
  const buyer = await (await browser.newContext({ baseURL, serviceWorkers: "block" })).newPage();
  await buyer.goto(browseFor(word));
  await expect(cardsFor(buyer, word)).toHaveCount(1);
  await buyer.context().close();
});

test("Back after publishing shows the storefront with the new listing, not a kept copy", async ({ page }) => {
  test.setTimeout(90_000);
  const word = uniqueWord();
  const title = `Desk clock ${word}`;
  await signInAsSample(page, "Seller, Tech corner", "/sellers/tech-corner");
  // Client-side navigations from here, so Next keeps the storefront for Back (messaging plan decision 6). A marker on
  // the window proves it: a full page load anywhere would lose it, and the test would then prove nothing.
  await page.evaluate(() => ((window as unknown as { kept: boolean }).kept = true));
  await page.getByRole("link", { name: "Edit shop" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/sell\/profile$/);
  await main(page).getByRole("link", { name: "Your shop" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/sell$/);
  await main(page).getByRole("link", { name: "New listing" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/sell\/listings\/new$/);
  await fillListing(page, title);
  await button(page, "Save and publish").click();
  await expect(page).toHaveURL(/\/sell\/listings$/, POST_LANDS);
  // The save replaced the form in history, so Back goes to the dashboard, then Edit shop, then the storefront.
  await page.goBack();
  await expect(page).toHaveURL(/\/sell$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/sell\/profile$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/sellers\/tech-corner$/);
  await expect(cardsFor(page, word)).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);
});

test("axe finds nothing serious on My listings in every state, with its notices, or on the forms for a paused, sold and draft listing (Task 17)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const word = uniqueWord();
  const title = `Lamp ${word}`;
  const draft = `Lamp draft ${word}`;
  await signInAsSample(page, "Seller, Tech corner", "/sell");
  const id = await publishListing(page, title);

  // Available, with the notice the save left.
  await expect(main(page).getByRole("status")).toContainText("Published.");
  expect(await seriousIssues(page), "available, with a notice").toEqual([]);

  // Paused: its row and its form, which says Save changes and keeps the state.
  await main(page).getByRole("button", { name: `Pause ${title}` }).click();
  await expect(main(page).getByRole("status")).toContainText("Paused.", POST_LANDS);
  expect(await seriousIssues(page), "after Pause, with a notice").toEqual([]);
  await page.goto("/sell/listings?tab=paused");
  await expect(main(page).getByRole("button", { name: `Resume ${title}` })).toBeVisible();
  expect(await seriousIssues(page), "the paused tab").toEqual([]);
  await page.goto(`/sell/listings/${id}/edit`);
  await expect(button(page, "Save changes")).toBeVisible();
  expect(await seriousIssues(page), "the form for a paused listing").toEqual([]);

  // Sold: its row, with Relist, and its form.
  await page.goto("/sell/listings?tab=paused");
  await main(page).getByRole("button", { name: `Mark sold ${title}` }).click();
  await expect(main(page).getByRole("status")).toContainText("Marked as sold.", POST_LANDS);
  await page.goto("/sell/listings?tab=sold");
  await expect(main(page).getByRole("button", { name: `Relist ${title}` })).toBeVisible();
  expect(await seriousIssues(page), "the sold tab").toEqual([]);
  await page.goto(`/sell/listings/${id}/edit`);
  await expect(button(page, "Save changes")).toBeVisible();
  expect(await seriousIssues(page), "the form for a sold listing").toEqual([]);

  // A draft: its row, and its form, which offers Save and publish and Save as draft.
  await page.goto("/sell/listings/new");
  await fillListing(page, draft);
  await button(page, "Save as draft").click();
  await expect(page).toHaveURL(/\/sell\/listings\?tab=drafts$/, POST_LANDS);
  await expect(main(page).getByRole("status")).toBeVisible();
  // The redirect to another page crossfades (calm navigation, decision 90), and the tab title follows a moment after
  // the page shows; axe needs it.
  await expect(page).toHaveTitle(/Your listings/);
  expect(await seriousIssues(page), "the drafts tab, with a notice").toEqual([]);
  const draftId = await idOfEditLink(page, draft);
  await page.goto(`/sell/listings/${draftId}/edit`);
  await expect(button(page, "Save and publish")).toBeVisible();
  expect(await seriousIssues(page), "the form for a draft").toEqual([]);

  // Both made here go again, so nothing is left in the sample seller's shop.
  for (const gone of [id, draftId]) {
    await page.goto(`/sell/listings/${gone}/delete`);
    await button(page, "Delete listing").click();
    await expect(main(page).getByRole("status")).toHaveText("Deleted.", POST_LANDS);
  }
});
