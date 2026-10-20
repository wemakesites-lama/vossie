import { expect, test } from "@playwright/test";
import { pressSave, saveRow, searchAt } from "./helpers/alerts";
import { seriousIssues } from "./helpers/axe";
import { button, main, newBuyer, onlyAt, signInAsSample, signUp } from "./helpers/messaging";
import { uniqueWord } from "./helpers/selling";

// axe on Save this search's states and Saved's Searches tab (search alerts spec section 4; plan Task 9). These live
// apart from a11y.spec.ts, which another stage had open. The states that need a saved search sign up a student of
// their own, which nothing else counts, so they run in the device projects (plan decision 19), at 390 and 1440.

test.use({ reducedMotion: "reduce" });

test("browse with a search, signed out: the Save this search row (search alerts spec section 4)", async ({ page }) => {
  await page.goto("/browse?q=calculator&campus=midrand");
  await expect(main(page).getByRole("link", { name: "Save this search" }).filter({ visible: true })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("Saved's Searches tab, signed out and with none yet (search alerts spec 2.7)", async ({ page }) => {
  await page.goto("/saved?tab=searches");
  await expect(page.getByText("Sign in to save searches.", { exact: false })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await signInAsSample(page, "Student, Midrand");
  await page.goto("/saved?tab=searches");
  await expect(page.getByText("No saved searches yet")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("Save this search's states, then the Searches tab with a row and its status line", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await signUp(page, newBuyer());
  const word = uniqueWord();
  const label = `“${word}” at Midrand`;
  await page.goto(searchAt(word));
  await expect(saveRow(page).getByRole("button", { name: "Save this search" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await pressSave(page);
  expect(await seriousIssues(page)).toEqual([]);
  await page.reload();
  await expect(saveRow(page)).toContainText("You've saved this search.");
  expect(await seriousIssues(page)).toEqual([]);

  await page.goto("/saved?tab=searches");
  await expect(main(page).getByRole("link", { name: label })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await button(page, `Pause alerts for ${label}`).click();
  await expect(main(page).getByRole("status")).toHaveText(`Alerts paused for ${label}.`);
  expect(await seriousIssues(page)).toEqual([]);
  await button(page, `Delete saved search ${label}`).click();
  await expect(main(page).getByRole("status")).toHaveText(`Deleted ${label}.`);
  expect(await seriousIssues(page)).toEqual([]);
});

test("a save refused in another tab says why in the row, as an alert (search alerts spec 2.6)", async ({
  page,
  context,
}) => {
  onlyAt("phone-390", "desktop-1440");
  await signUp(page, newBuyer());
  const word = uniqueWord();
  const other = await context.newPage();
  await page.goto(searchAt(word));
  await other.goto(searchAt(word));
  await pressSave(page);
  await saveRow(other).getByRole("button", { name: "Save this search" }).click();
  await expect(saveRow(other).getByRole("alert")).toHaveText("You've saved this search already.");
  await expect(saveRow(other).getByRole("link", { name: "Manage saved searches" })).toBeVisible();
  expect(await seriousIssues(other)).toEqual([]);
});
