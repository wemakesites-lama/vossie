import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { onlyAt, signInAsSample } from "./helpers/messaging";

// Dark and Night themes spec 5: axe in each dark theme, the menu's choice and a reload, no light frame at first paint,
// and Match my phone following the phone.

test.use({ reducedMotion: "reduce" });

/** Each theme's page surface, `--color-white`, as the body paints it. */
const SURFACE = { light: "rgb(255, 255, 255)", dark: "rgb(13, 28, 56)", night: "rgb(7, 9, 13)" };

const saveTheme = (page: Page, theme: string) =>
  page.addInitScript((t) => localStorage.setItem("vossie_theme", t), theme);

const surface = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const PAGES = ["/", "/listings/l-004", "/browse", "/sellers/tech-corner", "/looking-for", "/hub", "/login"];
const SIGNED_IN: [account: string, path: string][] = [
  ["Student, Midrand", "/account"],
  ["Seller, Tech corner", "/sell"],
  ["Admin", "/admin"],
];

for (const theme of ["dark", "night"] as const) {
  test.describe(`in ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      onlyAt("phone-390", "desktop-1440");
      await saveTheme(page, theme);
    });

    for (const path of PAGES) {
      test(`${path} has no serious axe issues`, async ({ page }) => {
        await page.goto(path);
        expect(await surface(page)).toBe(SURFACE[theme]);
        expect(await seriousIssues(page)).toEqual([]);
      });
    }

    for (const [account, path] of SIGNED_IN) {
      test(`${path} as ${account} has no serious axe issues`, async ({ page }) => {
        await signInAsSample(page, account, path);
        expect(await seriousIssues(page)).toEqual([]);
      });
    }

    test("the open menu has no serious axe issues", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(page.getByRole("radio", { name: theme === "dark" ? "Dark" : "Night" })).toBeChecked();
      expect(await seriousIssues(page)).toEqual([]);
    });
  });
}

test("a theme chosen in the menu applies at once and survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const theme = page.getByRole("dialog", { name: "Menu" }).getByRole("group", { name: "Theme" });
  await expect(theme.getByRole("radio", { name: "Match my phone" })).toBeChecked();
  await theme.getByText("Night", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  expect(await surface(page)).toBe(SURFACE.night);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#0c1018");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(theme.getByRole("radio", { name: "Night" })).toBeChecked();

  await theme.getByText("Match my phone", { exact: true }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await expect(page.locator("#night-bar")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("vossie_theme"))).toBeNull();
});

test("a saved theme is on before the first paint, with no light frame", async ({ page }) => {
  await saveTheme(page, "night");
  // Read the moment the document is parsed, before any script of React's has run: only the inline boot script has.
  const atParse = page.waitForEvent("domcontentloaded").then(() => surface(page));
  await page.goto("/", { waitUntil: "commit" });
  expect(await atParse).toBe(SURFACE.night);
});

test.describe("with the phone in dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("Match my phone follows it with nothing stored", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    expect(await surface(page)).toBe(SURFACE.dark);
  });

  test("a chosen Light wins over the phone", async ({ page }) => {
    await saveTheme(page, "light");
    await page.goto("/");
    expect(await surface(page)).toBe(SURFACE.light);
  });
});
