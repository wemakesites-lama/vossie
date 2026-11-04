import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { onlyAt } from "./helpers/messaging";

// Search in your own words (AI features spec 6; AI stage E plan Task 7). The e2e server has VOSSIE_AI_WORDS_SEARCH on,
// answered by the fake (fakeWords: a price, a campus, the rest as the words), so a sentence reads into filters and a
// short search is searched exactly as before.

const SENTENCE = "calculator under R300 at Midrand";
const LINE = "Showing calculator under R500 at Midrand.";

const cards = (page: Page) => page.locator("main article");
const line = (page: Page) => page.locator("main .browse-words");
const sort = (page: Page) => page.locator("details.tool-sort");

test("a sentence reads into filters, says so, and the exact words are one link away", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto(`/browse?q=${encodeURIComponent(SENTENCE)}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("“calculator”");
  await expect(line(page)).toContainText(LINE);
  // The Casio (l-001) is R250 at Midrand: under R500, the step above R300 (plan decision 1).
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Casio fx-991ZA Plus calculator");
  await expect(page.getByRole("link", { name: "Remove filter: Under R500" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Remove filter: Midrand" })).toBeVisible();

  await page.getByRole("link", { name: "Search for exactly what I typed" }).click();
  await expect(page).toHaveURL(/[?&]exact=1(&|$)/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`“${SENTENCE}”`);
  await expect(line(page)).toHaveCount(0);
});

test("a parsed search's links stay exact, so the words aren't read again", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto(`/browse?q=${encodeURIComponent(SENTENCE)}`);
  await expect(line(page)).toContainText(LINE);
  await sort(page).locator("summary").click();
  await sort(page).getByRole("link", { name: "Price: low to high" }).click();
  await expect(page).toHaveURL(/\/browse\?q=calculator&campus=midrand&price=under-500&sort=price-low&exact=1$/);
  await expect(cards(page).first()).toContainText("Casio fx-991ZA Plus calculator");
  await expect(line(page)).toHaveCount(0);
});

test("a short search is searched exactly, as before", async ({ page }) => {
  await page.goto("/browse?q=calculator");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("“calculator”");
  await expect(cards(page)).toHaveCount(2);
  await expect(line(page)).toHaveCount(0);
});

test("the line passes axe", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto(`/browse?q=${encodeURIComponent(SENTENCE)}`);
  await expect(line(page)).toContainText(LINE);
  expect(await seriousIssues(page)).toEqual([]);
});
