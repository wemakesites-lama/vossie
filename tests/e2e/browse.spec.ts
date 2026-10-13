import { expect, test, type Page } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

const cards = (page: Page) => page.locator("main article");
const filters = (page: Page) => page.locator("details.tool-filters");
const sort = (page: Page) => page.locator("details.tool-sort");

test("a first visit shows every campus, 24 at a time", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Everything");
  await expect(page.getByText("Showing 24 of 36")).toBeVisible();
  await expect(cards(page)).toHaveCount(24);
  await expect(page).toHaveTitle("Browse · Vossie");
});

test("Show more lands on the 25th card", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse");
  await page.getByRole("link", { name: "Show more" }).click();
  await expect(page).toHaveURL(/\/browse\?n=48#r-25$/);
  await expect(cards(page)).toHaveCount(36);
  await expect(page.locator("#r-25")).toBeInViewport();
  await expect(page.getByText("36 listings")).toBeVisible();
});

test.describe("the campus (decision 40)", () => {
  test("starts on the chosen campus, and the chip widens it to every campus", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
    await page.goto("/browse");
    await expect(cards(page)).toHaveCount(14);
    await page.getByRole("link", { name: "Remove filter: Midrand" }).click();
    await expect(page).toHaveURL(/\/browse\?campus=all$/);
    await expect(page.getByText("Showing 24 of 36")).toBeVisible();
  });

  test("a campus in the link wins over the chosen one", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
    await page.goto("/browse?campus=pretoria");
    await expect(page.getByRole("link", { name: "Remove filter: Pretoria" })).toBeVisible();
    await expect(cards(page)).toHaveCount(5);
  });

  test("a campus with nothing points to the others", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
    await page.goto("/browse");
    await expect(page.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeVisible();
    await page.getByRole("link", { name: "36 more at other campuses" }).click();
    await expect(page).toHaveURL(/\/browse\?campus=all$/);
    await expect(cards(page)).toHaveCount(24);
  });
});

test("the category tabs change the title and the results", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse");
  await page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: "Tech" }).click();
  await expect(page).toHaveURL(/\/browse\?cat=tech$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech");
  await expect(cards(page)).toHaveCount(5);
  await expect(page).toHaveTitle("Tech · Vossie");
});

test("Filters narrows the results and shows a chip", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse");
  await filters(page).locator("summary").click();
  await page.getByRole("radio", { name: "Under R100" }).check();
  await page.getByRole("button", { name: "Show results" }).click();
  await expect(page).toHaveURL(/price=under-100/);
  await expect(cards(page)).toHaveCount(7);
  await expect(page.getByRole("link", { name: "Remove filter: Under R100" })).toBeVisible();
  await expect(filters(page).locator("summary")).toHaveAttribute("aria-label", "Filters, 1 active");
  await expect(filters(page)).not.toHaveAttribute("open");
});

test("Sort reorders by price, offers Best match only with a search, and closes after choosing", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse?cat=tech");
  await sort(page).locator("summary").click();
  await expect(sort(page).getByRole("link", { name: "Best match" })).toHaveCount(0);
  await sort(page).getByRole("link", { name: "Price: low to high" }).click();
  await expect(page).toHaveURL(/\/browse\?cat=tech&sort=price-low$/);
  await expect(cards(page).first()).toContainText("HP laptop charger");
  await expect(sort(page)).not.toHaveAttribute("open");
});

test("search forgives a typo, finds seller names, and stays out of search engines", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/browse?q=brads");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("“brads”");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Box braids");
  await expect(page).toHaveTitle("“brads” · Vossie");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const box = page.getByRole("search").getByRole("searchbox", { name: "Search Vossie" });
  await box.fill("bakery");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/browse\?q=bakery$/);
  await expect(cards(page).first()).toContainText("Cupcake box");
});

test("homepage links land on the right results", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  const cases: ReadonlyArray<[path: string, count: number, chip: string | null]> = [
    ["/browse?max=50", 4, "Under R50"],
    ["/browse?price=free", 4, "Free"],
    ["/browse?pay=swap", 6, "Swaps"],
    ["/browse?deals=free-and-swaps", 10, "Free & swaps"],
    ["/browse?cat=tech", 5, null],
  ];
  for (const [path, count, chip] of cases) {
    await page.goto(path);
    await expect(cards(page), path).toHaveCount(count);
    if (chip) await expect(page.getByRole("link", { name: `Remove filter: ${chip}` }), path).toBeVisible();
  }
});

test("the homepage's budget chips and category tiles open browse", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/");
  await page.getByRole("list", { name: "Shop by budget" }).getByRole("link", { name: "Under R50" }).click();
  await expect(page).toHaveURL(/\/browse\?max=50$/);
  // Leaving the homepage by a client navigation keeps it in <main>, hidden, so count only the cards you can see.
  await expect(cards(page).filter({ visible: true })).toHaveCount(4);
  await page.goto("/");
  await page.getByRole("region", { name: "Categories" }).getByRole("link", { name: "Tech" }).click();
  await expect(page).toHaveURL(/\/browse\?cat=tech$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech");
});

test.describe("without the app's JavaScript (plan decision 18)", () => {
  test.beforeEach(async ({ page }) => {
    // The app's bundle never arrives. React's small inline script still puts the streamed results in place.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
  });

  test("tabs, Filters, Sort and Show more all still work", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/browse");
    await expect(cards(page)).toHaveCount(24);

    await page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: "Res & living" }).click();
    await expect(page).toHaveURL(/\/browse\?cat=res-living$/);

    await filters(page).locator("summary").click();
    await page.getByRole("radio", { name: "Free", exact: true }).check();
    await page.getByRole("button", { name: "Show results" }).click();
    await expect(page).toHaveURL(/price=free/);
    await expect(cards(page)).toHaveCount(2);

    await sort(page).locator("summary").click();
    await sort(page).getByRole("link", { name: "Price: high to low" }).click();
    await expect(page).toHaveURL(/sort=price-high/);
    await expect(cards(page)).toHaveCount(2);

    await page.goto("/browse");
    await page.getByRole("link", { name: "Show more" }).click();
    await expect(cards(page)).toHaveCount(36);
  });
});
