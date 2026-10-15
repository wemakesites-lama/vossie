import { expect, type Page } from "@playwright/test";
import { pngBytes } from "../../helpers/image-bytes";
import { button, field, main, project } from "./messaging";

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
  const bytes = pngBytes({ width: 64, height: 48, exif: true, text: true });
  return { name, mimeType: "image/png", buffer: Buffer.from(bytes) };
}

/**
 * Fills the listing form that's showing with a R150 item in good condition. A new listing's form already says "An
 * item", "Cash" and a pickup at the shop's first point, so nothing else needs choosing.
 */
export async function fillListing(page: Page, title: string) {
  await field(page, "Title").fill(title);
  await field(page, "Category").selectOption({ label: "Res & living" });
  await field(page, "Condition (items only)").selectOption({ label: "Good" });
  await field(page, "Price in rand").fill("150");
  await field(page, "Description").fill("Quiet and strong.\nCollect it at the library.");
}

/** A save is a post to the one shared server, which a busy run slows, so the wait for it to land is longer. */
export const POST_LANDS = { timeout: 20_000 };

/**
 * Publishes a new listing as the signed-in seller, with these photos, and gives back its id. With photos, it waits for
 * the photo field to say they're ready first, so the browser has shrunk them (plan decision 10) and the save doesn't
 * race its 15-second hold (amendment 11.1).
 */
export async function publishListing(
  page: Page,
  title: string,
  { photos = [] as ReturnType<typeof photoWithLocation>[] } = {},
): Promise<string> {
  await page.goto("/sell/listings/new");
  await fillListing(page, title);
  if (photos.length > 0) {
    await field(page, "Add photos").setInputFiles(photos);
    await expect(main(page).getByText(/^Your photos? (is|are) ready\.$/).filter({ visible: true })).toBeVisible();
  }
  await button(page, "Save and publish").click();
  await expect(page).toHaveURL(/\/sell\/listings$/, POST_LANDS);
  return idOfEditLink(page, title);
}

/** The id of the listing with this title, from its Edit link on the My listings page that's showing. */
export async function idOfEditLink(page: Page, title: string): Promise<string> {
  const edit = main(page).getByRole("link", { name: `Edit ${title}`, exact: true });
  await expect(edit).toBeVisible();
  const href = await edit.getAttribute("href");
  return /^\/sell\/listings\/(l-[0-9a-f-]{36})\/edit$/.exec(href ?? "")![1];
}

/** Browse, searching for a word in a listing's title, at every campus. */
export const browseFor = (word: string) => `/browse?q=${encodeURIComponent(word)}&campus=all`;

/** The listing cards on the page that's showing with this word in their title. */
export const cardsFor = (page: Page, word: string) =>
  page.locator("main article").filter({ visible: true }).filter({ hasText: word });

/** The 404 page's heading. */
export const notFoundHeading = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "We couldn't find that page" });
