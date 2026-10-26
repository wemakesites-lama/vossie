import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { onlyAt, settled, signInAsSample } from "./helpers/messaging";
import { recordShifts, type Shift } from "./helpers/shifts";

// Role bars (spec 3, decision 92): each sample account's main bar on a phone. Reads only, so it runs with the device
// projects; checked at 390, where the bar shows.

const BARS = [
  { label: "Student, Midrand", tabs: ["Sell", "Saved"], heart: false },
  { label: "Seller, Tech corner", tabs: ["My shop", "Messages"], heart: true },
  { label: "Seller waiting for approval", tabs: ["My shop", "Messages"], heart: true },
  { label: "Mentor", tabs: ["Mentoring", "Messages"], heart: true },
  { label: "Admin", tabs: ["Today", "Messages"], heart: true },
] as const;

const tabNames = (page: Page) => page.locator("nav.tabbar .tab-label").allInnerTexts();

test.describe("role bars", () => {
  test.beforeEach(() => onlyAt("phone-390"));

  test("signed out, the bar is Home, Shop, Sell, Saved and You", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    expect(await tabNames(page)).toEqual(["Home", "Shop", "Sell", "Saved", "You"]);
  });

  for (const bar of BARS) {
    test(`${bar.label}: ${bar.tabs.join(" and ")}, with no serious axe issues`, async ({ page }) => {
      await signInAsSample(page, bar.label, "/");
      await expect.poll(() => tabNames(page)).toEqual(["Home", "Shop", ...bar.tabs, "You"]);
      const heart = page.getByRole("banner").getByRole("link", { name: /^Saved/ });
      await (bar.heart ? expect(heart).toBeVisible() : expect(heart).toBeHidden());
      expect(await seriousIssues(page)).toEqual([]);
    });
  }

  for (const label of ["Seller, Tech corner", "Admin"]) {
    test(`${label}: the slots swap in without moving anything`, async ({ page }) => {
      await signInAsSample(page, label, "/");
      await recordShifts(page);
      // Not expectStill: a signed-in home keeps router prefetches (/sell, /browse) in flight, so "networkidle" never comes.
      await page.goto("/", { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await expect.poll(() => tabNames(page)).toHaveLength(5);
      await page.waitForTimeout(1500);
      const shifts = await page.evaluate(() => (window as unknown as { __shifts: Shift[] }).__shifts);
      const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
      console.log(`${label}'s home layout shift: ${total.toFixed(4)} ${JSON.stringify(shifts)}`);
      expect(total, "summed layout shift").toBeLessThanOrEqual(0.05);
    });
  }
});
