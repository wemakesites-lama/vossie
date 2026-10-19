import { expect, type Browser, type Page } from "@playwright/test";
import { button, field, main, signInAsSample, signUpHere } from "./messaging";
import { POST_LANDS, uniqueWord } from "./selling";

// Shared by the staff tools' tests (staff tools plan, Task 20). Every test shares one server and one sample store, so
// each makes its own students, shops, listings, reports and posts, named with a word no other test uses (plan
// decision 21). Staff are the sample "Admin" (Pieter) and "Mentor" (Naledi), each in a browser of their own.

/** A browser of its own, signed in as a sample account, landing on `next`. Close its context at the end of the test. */
export async function signedInPage(browser: Browser, baseURL: string, label: string, next: string): Promise<Page> {
  const context = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const page = await context.newPage();
  await signInAsSample(page, label, next);
  return page;
}

/** A shop name no other test uses, at most 60 characters. */
export function newShopName(): string {
  return `Bakes ${uniqueWord()}`.slice(0, 60);
}

/**
 * A new student signs up at Midrand and applies to sell with this shop name, through the five steps with no photo
 * (selling spec 2.6). It ends on /sell, waiting for the Hub. Gives back the student's first name.
 */
export async function applyToSell(page: Page, shopName: string): Promise<string> {
  const word = uniqueWord();
  const firstName = `Zola ${word.slice(-6)}`;
  await page.goto("/login?next=%2Fsell%2Fonboarding");
  await signUpHere(page, { email: `staff-${word}@eduvos.com`, firstName });
  await expect(page).toHaveURL(/\/sell\/onboarding$/, POST_LANDS);
  await field(page, "Shop name").fill(shopName);
  await field(page, "Main category").selectOption({ label: "Food" });
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=2$/, POST_LANDS);
  await field(page, "About your shop").fill("I bake between lectures.");
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=3$/, POST_LANDS);
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=4$/, POST_LANDS);
  await main(page).getByRole("checkbox", { name: "Library entrance" }).check();
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=5$/, POST_LANDS);
  await main(page).getByRole("checkbox", { name: "I've read the seller guidelines" }).check();
  await button(page, "Send for approval").click();
  await expect(page).toHaveURL(/\/sell$/, POST_LANDS);
  return firstName;
}

/** As an admin, opens a shop's review page from the Sellers list, and gives back its link (its slug). */
export async function reviewShop(admin: Page, shopName: string): Promise<string> {
  await admin.goto("/admin/sellers");
  await main(admin).getByRole("link", { name: `Review ${shopName}` }).click();
  await expect(main(admin).getByRole("heading", { level: 1, name: shopName })).toBeVisible();
  return new URL(admin.url()).pathname.split("/").pop()!;
}

/** The last action's notice on a staff page (spec 4). */
export const staffNotice = (page: Page) => main(page).getByRole("status");

/** A date a month from now, YYYY-MM-DD: always upcoming, whatever day the tests run. */
export function aMonthFromNow(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
