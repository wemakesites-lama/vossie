import { expect, type Browser, type Page } from "@playwright/test";
import { pngBytes } from "../../helpers/image-bytes";
import { button, field, main, project, signInAsSample } from "./messaging";

// Shared by the selling tests (selling plan, Task 16). Every test shares one server and one sample store, so each
// names what it makes with a word no other test uses (plan decision 25).

/** A word no other test uses, for a shop's, a student's or a listing's name. */
export function uniqueWord(): string {
  return `${project()}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.replace(/[^a-z0-9]/g, "");
}

/** A new student who'll apply to sell. */
export function newSeller(): { email: string; firstName: string } {
  const word = uniqueWord();
  return { email: `sell-${word}@eduvos.com`, firstName: `Zola ${word.slice(-6)}` };
}

/** A real PNG whose metadata holds a stand-in location (tests/helpers/image-bytes.ts), as a file to pick. */
export function photoWithLocation(name = "photo.png") {
  return { name, mimeType: "image/png", buffer: Buffer.from(pngBytes({ width: 64, height: 48, exif: true, text: true })) };
}

/** Fills the listing form that's showing with a R150 item in good condition, kept for pickup at the first point. */
export async function fillListing(page: Page, title: string) {
  await field(page, "Title").fill(title);
  await field(page, "Category").selectOption({ label: "Res & living" });
  await field(page, "Condition (items only)").selectOption({ label: "Good" });
  await field(page, "Price in rand").fill("150");
  await field(page, "Description").fill("Quiet and strong.\nCollect it at the library.");
}

/** The id in a My listings row's Edit link. */
export async function idFromEditLink(page: Page, title: string): Promise<string> {
  const pattern = /\/sell\/listings\/(l-[0-9a-f-]{36})\/edit$/;
  const href = await main(page).getByRole("link", { name: `Edit ${title}`, exact: true }).getAttribute("href");
  expect(href).toMatch(pattern);
  return pattern.exec(href!)![1];
}

/**
 * Publishes a new listing as the signed-in seller, with these photos, and gives back its id. With the app's
 * JavaScript, it waits for the photo field to have the photos ready first (plan decision 10). It ends on My listings,
 * where the action's redirect leads (amendment 16).
 */
export async function publishListing(
  page: Page,
  title: string,
  { photos = [] as ReturnType<typeof photoWithLocation>[], js = true } = {},
): Promise<string> {
  await page.goto("/sell/listings/new");
  await fillListing(page, title);
  if (photos.length > 0) {
    await field(page, "Add photos").setInputFiles(photos);
    if (js) await expect(main(page).getByText("Photo 1 (the cover)").filter({ visible: true })).toBeVisible();
  }
  await button(page, "Save and publish").click();
  await expect(page).toHaveURL(/\/sell\/listings$/);
  return idFromEditLink(page, title);
}

/**
 * A page a buyer opens right after a write (selling plan amendment 16). Next 16.4 can serve one response from before
 * `updateTag` straight after it, so the page is loaded again until `check` passes, never loaded and read once. Keep
 * the checks' own timeouts short (`{ timeout: 2_000 }`), so a stale copy is reloaded soon.
 */
export async function expectAfterWrite(page: Page, path: string, check: () => Promise<unknown>) {
  await expect(async () => {
    await page.goto(path);
    await check();
  }).toPass({ timeout: 20_000 });
}

/** The listing cards on the page that's showing with this title. */
export const cardsFor = (page: Page, title: string) =>
  page.getByRole("article").filter({ hasText: title }).filter({ visible: true });

/** The 404 page's heading. */
export const notFoundHeading = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "We couldn't find that page" });

/**
 * What a writes test made as the sample seller: the listing's id once the test knows it, and every title it has had,
 * to find it by when the test failed before reading the id.
 */
export type Made = { id: string | null; titles: string[] };

/**
 * Deletes a writes test's own listing as the sample seller, in a browser context of its own (the test's page may
 * have the app's JavaScript blocked or be mid-flow). Run after every writes test, passed or failed, so no listing
 * outlives it on a reused server or a retry (E2E_REUSE_SERVER=1, CI). A listing already gone is fine.
 */
export async function deleteMade(browser: Browser, baseURL: string, made: Made) {
  if (!made.id && made.titles.length === 0) return;
  const page = await (await browser.newContext({ baseURL })).newPage();
  try {
    await signInAsSample(page, "Seller, Tech corner", "/sell/listings");
    let id = made.id;
    for (const tab of ["", "?tab=paused", "?tab=sold", "?tab=drafts"]) {
      if (id) break;
      await page.goto(`/sell/listings${tab}`);
      await expect(main(page).getByRole("navigation", { name: "Listings by state" }).first()).toBeVisible();
      for (const title of made.titles) {
        if ((await main(page).getByRole("link", { name: `Edit ${title}`, exact: true }).count()) > 0) {
          id = await idFromEditLink(page, title);
          break;
        }
      }
    }
    if (!id) return;
    await page.goto(`/sell/listings/${id}/delete`);
    const remove = button(page, "Delete listing");
    await expect(remove.or(notFoundHeading(page))).toBeVisible();
    if (await notFoundHeading(page).isVisible()) return;
    await remove.click();
    await expect(main(page).getByRole("status").filter({ visible: true })).toHaveText("Deleted.");
  } finally {
    await page.context().close();
  }
}
