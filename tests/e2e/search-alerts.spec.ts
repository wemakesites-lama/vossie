import { expect, test } from "@playwright/test";
import { pathOf, pressSave, saveRow, searchAt } from "./helpers/alerts";
import { button, main, newBuyer, onlyAt, signUp, signUpHere } from "./helpers/messaging";
import { POST_LANDS, uniqueWord } from "./helpers/selling";

const BOTH = ["phone-390", "desktop-1440"];

test.describe("saved searches (search alerts spec section 6)", () => {
  test("signed out, Save this search goes through sign-in and back to the same link, then saves (spec 2.6)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    const word = uniqueWord();
    await page.goto(searchAt(word));
    await expect(saveRow(page)).toContainText("Hear when something new matches.");
    await saveRow(page).getByRole("link", { name: "Save this search" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === searchAt(word));
    await signUpHere(page, newBuyer());
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === searchAt(word), POST_LANDS);
    await pressSave(page);
    await page.reload();
    await expect(saveRow(page)).toContainText("You've saved this search.");
    await expect(saveRow(page).getByRole("link", { name: "Manage saved searches" })).toHaveAttribute(
      "href",
      "/saved?tab=searches",
    );
  });

  test("Save this search works with the app's JavaScript blocked (spec section 4)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.route(/\/_next\/static\/.+\.js$/, (route) => route.abort());
    const word = uniqueWord();
    await page.goto(searchAt(word));
    await pressSave(page);
    expect(pathOf(page)).toBe(searchAt(word));
  });

  test("Saved's Searches tab: the label's link, pause, resume, and delete with its status line (spec 2.7 and 2.8)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const word = uniqueWord();
    const results = `/browse?q=${word}&cat=tech&campus=midrand&price=under-100`;
    const label = `“${word}” in Tech at Midrand, under R100`;
    await page.goto(results);
    await pressSave(page);

    await page.goto("/saved?tab=searches");
    const tabs = page.getByRole("navigation", { name: "What's saved" }).filter({ visible: true });
    await expect(tabs.getByRole("link", { name: "Searches" })).toHaveAttribute("aria-current", "page");
    await expect(
      main(page).getByText("Kept with your account. Each search sends at most one notification a day."),
    ).toBeVisible();
    const row = main(page).getByRole("listitem").filter({ hasText: label });
    await expect(row).toContainText("Alerts on");
    await row.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === results);

    const status = () => main(page).getByRole("status").filter({ visible: true });
    await page.goto("/saved?tab=searches");
    await button(page, `Pause alerts for ${label}`).click();
    await expect(status()).toHaveText(`Alerts paused for ${label}.`, POST_LANDS);
    await expect(row).toContainText("Paused");
    await button(page, `Resume alerts for ${label}`).click();
    await expect(status()).toHaveText(`Alerts on for ${label}.`, POST_LANDS);
    await expect(row).toContainText("Alerts on");
    await button(page, `Delete saved search ${label}`).click();
    await expect(status()).toHaveText(`Deleted ${label}.`, POST_LANDS);
    await expect(main(page).getByText("No saved searches yet")).toBeVisible();

    await status().getByRole("link", { name: label }).click();
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === results);
    await expect(saveRow(page).getByRole("button", { name: "Save this search" })).toBeVisible();
  });

  test("Saved's Searches tab asks a signed-out visitor to sign in, coming back to it (spec 2.7)", async ({ page }) => {
    onlyAt(...BOTH);
    await page.goto("/saved?tab=searches");
    await expect(main(page).getByText("Sign in to save searches. They'll show here.")).toBeVisible();
    await main(page).getByRole("link", { name: "Sign in", exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsaved%3Ftab%3Dsearches$/);
  });

  test("plain browse and a campus alone have no Save row (spec 2.4)", async ({ page }) => {
    onlyAt(...BOTH);
    await page.goto("/browse");
    await expect(main(page).getByRole("heading", { level: 1 }).filter({ visible: true })).toBeVisible();
    await expect(saveRow(page)).toHaveCount(0);
    await page.goto("/browse?campus=midrand");
    await expect(main(page).getByRole("heading", { level: 1 }).filter({ visible: true })).toBeVisible();
    await expect(saveRow(page)).toHaveCount(0);
  });
});
