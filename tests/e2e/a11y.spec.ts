import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

async function seriousIssues(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
}

test("the homepage", async ({ page }) => {
  await page.goto("/");
  expect(await seriousIssues(page)).toEqual([]);
});

test("the homepage scrolled to crest only", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect(page.getByRole("button", { name: "Show navigation" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Search Vossie" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the campus picker", async ({ page }) => {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await page.getByRole("button", { name: /^Shopping at/ }).click();
  } else {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /^Shopping at/ }).click();
  }
  await expect(page.getByRole("dialog", { name: "Choose your campus" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a placeholder page", async ({ page }) => {
  await page.goto("/privacy");
  expect(await seriousIssues(page)).toEqual([]);
});

test("the homepage with a campus that has nothing new", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
  await page.goto("/");
  await expect(page.getByText("Nothing new at Mbombela yet")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the homepage with a campus chosen (the Just listed switch)", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
  await page.goto("/");
  await expect(page.locator("#just-listed").getByRole("group", { name: "Show new listings from" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the homepage for a returning visitor", async ({ page }) => {
  await page.goto("/listings/l-001");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("vossie_recently_viewed"))).not.toBeNull();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Pick up where you left off" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a listing page", async ({ page }) => {
  await page.goto("/listings/l-001");
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.locator("main article").first()).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse with Filters open", async ({ page }) => {
  await page.goto("/browse?cat=tech&price=under-500");
  await page.locator("details.tool-filters > summary").click();
  await expect(page.getByRole("button", { name: "Show results" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse with Sort open", async ({ page }) => {
  await page.goto("/browse?q=calculator");
  await page.locator("details.tool-sort > summary").click();
  await expect(page.getByRole("link", { name: "Best match" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse with nothing found", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
  await page.goto("/browse");
  await expect(page.getByText("Nothing here yet")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a sold listing", async ({ page }) => {
  await page.goto("/listings/l-026");
  expect(await seriousIssues(page)).toEqual([]);
});

test("a listing with several photos and a campus note", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "pretoria", url: baseURL! }]);
  await page.goto("/listings/l-021");
  await expect(page.getByRole("region", { name: "Photos" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a storefront", async ({ page }) => {
  await page.goto("/sellers/tech-corner");
  await expect(page.getByRole("heading", { level: 2, name: "2 listings" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a verified storefront", async ({ page }) => {
  await page.goto("/sellers/hair-studio");
  await expect(page.locator(".seller-verified")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a storefront with nothing listed", async ({ page }) => {
  await page.goto("/sellers/lash-lounge");
  await expect(page.getByText("Nothing listed right now")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("Saved, with sold and paused listings and one removed", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_saved", value: "l-001.l-026.l-016", url: baseURL! }]);
  await page.goto("/saved");
  const heart = page.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" });
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  expect(await seriousIssues(page)).toEqual([]);
});

test("Saved with nothing saved", async ({ page }) => {
  await page.goto("/saved");
  await expect(page.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a collection", async ({ page }) => {
  await page.goto("/collections/moving-in");
  await expect(page.getByText("5 listings", { exact: true })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});
