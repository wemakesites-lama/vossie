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
