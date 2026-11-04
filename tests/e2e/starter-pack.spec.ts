import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { button, field, main, onlyAt, settled } from "./helpers/messaging";

// Starter pack (AI round two spec section 6; AI stage H plan Task 8). The e2e server has VOSSIE_AI_STARTER_PACK on,
// answered by the fake (fakeStarter: a campus and budget from the sentence, four fixed items), so at Midrand with R1,000
// the pack is the Casio (R250), the desk lamp found by its name (R180), the bar fridge over what's left and a kettle
// with no match. A device spec: it only reads (planning decision 14). Its sentences go to /browse/starter, never to
// Browse's search, so the words search's "no other e2e search may be a sentence" still holds.

test.use({ reducedMotion: "reduce" });

const SENTENCE = "Starting at Midrand, need stuff for res under R1000";
const packPage = (sentence: string) => `/browse/starter?q=${encodeURIComponent(sentence)}`;
const lines = (page: Page) => main(page).locator(".starter-line");

test("a sentence becomes a pack of real listings within the budget (spec 6)", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto(packPage(SENTENCE));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Get a starter pack");
  await expect(field(page, "What do you need?")).toHaveValue(SENTENCE);
  await expect(page.getByRole("heading", { level: 2, name: "Your starter pack" })).toBeVisible();
  await expect(main(page).getByText("At Midrand · Budget R1,000")).toBeVisible();
  await expect(lines(page)).toHaveCount(4);

  await expect(lines(page).nth(0)).toContainText("Casio fx-991ZA Plus calculator");
  await expect(lines(page).nth(0).getByRole("link", { name: "See more: Calculator" })).toHaveAttribute(
    "href",
    "/browse?q=casio+calculator&cat=tech&campus=midrand&sort=price-low&exact=1",
  );
  // Found by its name alone (planning decision 4).
  await expect(lines(page).nth(1)).toContainText("Desk lamp with a USB port");
  await expect(lines(page).nth(1).getByRole("link", { name: "See more: Lamp" })).toHaveAttribute(
    "href",
    "/browse?q=lamp&cat=res-living&campus=midrand&sort=price-low&exact=1",
  );
  await expect(lines(page).nth(2)).toContainText("Nothing within what's left of your budget.");
  await expect(lines(page).nth(3).getByRole("link", { name: "Ask for it on Looking For: Kettle" })).toHaveAttribute(
    "href",
    "/looking-for/new?title=Kettle",
  );
  await expect(main(page).getByText("Total R430 of your R1,000 budget, R570 left")).toBeVisible();

  // See more lands on Browse searching exactly, with no "Showing" line.
  await lines(page).nth(0).getByRole("link", { name: "See more: Calculator" }).click();
  await expect(page).toHaveURL(/\/browse\?q=casio\+calculator&cat=tech&campus=midrand&sort=price-low&exact=1$/);
  await expect(main(page).getByRole("link", { name: /Casio fx-991ZA Plus calculator/ }).first()).toBeVisible();
  await expect(main(page).locator(".browse-words")).toHaveCount(0);
});

test("the form makes a pack at the visitor's campus when the sentence names none (planning decision 8)", async ({
  page,
  context,
  baseURL,
}) => {
  onlyAt("phone-390", "desktop-1440");
  await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
  await page.goto("/browse/starter");
  await settled(page);
  await field(page, "What do you need?").fill("Stuff for my first year in res");
  await button(page, "Make my pack").click();
  await expect(page).toHaveURL(/\/browse\/starter\?q=Stuff\+for\+my\+first\+year\+in\+res$/);
  await expect(main(page).getByText("At Midrand · No budget given")).toBeVisible();
  await expect(main(page).getByText("Total R1,630")).toBeVisible();
});

test("a failed read says so and offers Browse with the sentence (planning decision 9)", async ({ page }) => {
  await page.goto(packPage("Need a kettle and a lamp [no pack]"));
  await expect(page.getByRole("heading", { level: 2, name: "We couldn't make a pack" })).toBeVisible();
  await expect(field(page, "What do you need?")).toHaveValue("Need a kettle and a lamp [no pack]");
  await expect(main(page).getByRole("link", { name: /^Search Shop for/ })).toHaveAttribute(
    "href",
    `/browse?q=${new URLSearchParams({ q: "Need a kettle and a lamp [no pack]" }).toString().slice(2)}`,
  );
});

test("Browse's empty state, the Looking For board and the home page link to it (spec 6; no prefetch is checked in the unit tests)", async ({ page }) => {
  for (const [path, name] of [
    ["/browse?q=zebra", "Get a starter pack"],
    ["/looking-for", "Get a starter pack"],
    ["/", "New on campus? Get a starter pack"],
  ] as const) {
    await page.goto(path);
    const link = main(page).getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", "/browse/starter");
  }
});

test("the empty form and a pack pass axe (spec 8)", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse/starter");
  await settled(page);
  expect(await seriousIssues(page)).toEqual([]);
  await page.goto(packPage(SENTENCE));
  await expect(lines(page)).toHaveCount(4);
  expect(await seriousIssues(page)).toEqual([]);
});
