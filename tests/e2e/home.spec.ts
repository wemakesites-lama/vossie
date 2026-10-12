import { expect, test, type Page } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

/** Cards Just listed shows at each size (plan decision 11). */
const VISIBLE_CARDS: Record<string, number> = {
  "phone-360": 4,
  "phone-390": 4,
  "tablet-768": 9,
  "laptop-1024": 10,
  "desktop-1440": 10,
};

test("the homepage has one H1 and the sections in the approved order", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  // Text content, so the screen-reader-only headings count too.
  expect(await page.locator("main h2").allTextContents()).toEqual([
    "Why you can trust Vossie",
    "Shop by category",
    "Collections from the Incubation Hub",
    "Shop by campus",
    "New on all campuses",
    "Safe, simple, on campus",
    "Hustles on every campus",
    "Can’t find it? Ask for it.",
    "Pass it on",
    "Built for student hustles, backed by the Hub",
  ]);
});

test.describe("hero (spec 7.3)", () => {
  test("turns every seven seconds, and Pause stops it", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.clock.install();
    await page.goto("/");
    // "Pause slides" only appears once the page has hydrated and autoplay is allowed.
    const pause = page.getByRole("button", { name: "Pause slides" });
    await expect(pause).toBeVisible();
    const word = page.locator(".hero-word[data-active]");
    await expect(word).toHaveText("textbooks");
    await page.clock.runFor(7_000);
    await expect(word).toHaveText("tech");
    await pause.click();
    await page.clock.runFor(21_000);
    await expect(word).toHaveText("tech");
  });

  test("never turns by itself with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await page.goto("/");
    await page.clock.runFor(21_000);
    await expect(page.locator(".hero-word[data-active]")).toHaveText("textbooks");
    await expect(page.getByRole("button", { name: "Play slides" })).toBeVisible();
  });

  test("a thumbnail shows its slide", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await page.getByRole("button", { name: "Show slide 3 of 3: services" }).click();
    await expect(page.getByRole("link", { name: "Shop services" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play slides" })).toBeVisible();
  });

  // Part 1 handoff, "Scroll after navigation": a client navigation that starts near the top could leave the new
  // page's top under the sticky header.
  test("a hero link opens its page with the heading clear of the header", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 80));
    await page.getByRole("link", { name: "Shop textbooks" }).click();
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Textbooks & notes");
    const headingBox = await heading.boundingBox();
    const barBox = await page.locator(".hdr-bar").boundingBox();
    expect(headingBox!.y).toBeGreaterThanOrEqual(barBox!.y + barBox!.height);
  });
});

test.describe("data saver (plan decision 8)", () => {
  async function scrollToTheEnd(page: Page) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState("networkidle");
  }

  test("loads only the hero photo on show, and no Hub banner photo", async ({ page }) => {
    onlyAt("phone-390");
    await page.addInitScript(() => localStorage.setItem("vossie_low_data", "1"));
    const requested: string[] = [];
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator(".hero-photo img")).toHaveCount(1);
    await scrollToTheEnd(page);
    // Absence can't be polled for, and "networkidle" returns at once because the page was idle before the scroll. So
    // give a lazy request two seconds to show up, as the privacy test does for search terms.
    await page
      .waitForRequest((request) => new URL(request.url()).pathname === "/placeholders/hub/banner.svg", { timeout: 2000 })
      .catch(() => undefined);
    expect(requested).not.toContain("/placeholders/hub/banner.svg");
  });

  test("without it, the Hub banner photo loads as it comes near", async ({ page }) => {
    onlyAt("phone-390");
    const requested: string[] = [];
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    await page.goto("/", { waitUntil: "networkidle" });
    await scrollToTheEnd(page);
    // Poll: the image is natively lazy, so the browser requests it a moment after the scroll, and "networkidle" returns
    // at once because the page was idle before the scroll.
    await expect.poll(() => requested).toContain("/placeholders/hub/banner.svg");
  });
});

test.describe("carousels (spec 7.5 and section 10)", () => {
  test("the arrows page through the categories on desktop", async ({ page }) => {
    onlyAt("laptop-1024", "desktop-1440");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const row = page.getByRole("region", { name: "Categories" });
    const previous = row.getByRole("button", { name: "Previous categories" });
    await expect(previous).toHaveAttribute("aria-disabled", "true");
    await row.getByRole("button", { name: "Next categories" }).click();
    await expect.poll(() => row.locator(".carousel-track").evaluate((track) => track.scrollLeft)).toBeGreaterThan(0);
    await expect(previous).toHaveAttribute("aria-disabled", "false");
  });

  test("the keyboard reaches every tile, and the row follows focus", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    const row = page.getByRole("region", { name: "Categories" });
    await row.getByRole("link", { name: "Textbooks & notes" }).focus();
    for (let i = 0; i < 9; i++) await page.keyboard.press("Tab");
    const last = row.getByRole("link", { name: "Stationery" });
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
  });

  // Spec section 5. The browser does this for a scrolling row: no script is involved.
  test("arrow keys scroll the row while a tile has focus", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const row = page.getByRole("region", { name: "Categories" });
    await row.getByRole("link", { name: "Textbooks & notes" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => row.locator(".carousel-track").evaluate((track) => track.scrollLeft)).toBeGreaterThan(0);
  });
});

test.describe("choosing a campus (spec 7.7 and 7.8)", () => {
  test("Shop by campus applies the choice and moves focus to Just listed", async ({ page }) => {
    await page.goto("/");
    // Chromium reads the hidden comma as a block, so the name is "Midrand , 214 live listings": match the space loosely.
    await page
      .getByRole("region", { name: "Shop by campus" })
      .getByRole("button", { name: /^Midrand\s*,\s*214 live listings$/ })
      .click();
    const heading = page.locator("#just-listed-title");
    await expect(heading).toHaveText("New at Midrand");
    await expect(heading).toBeFocused();
    // The visible pill: the text also sits in a screen-reader-only live region, so getByText would match two elements.
    await expect(page.locator(".toast")).toHaveText("Showing Midrand first");
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === "vossie_campus")?.value).toBe("midrand");
  });

  test("an empty campus offers every campus, and the switch flips the grid", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
    await page.goto("/");
    const section = page.locator("#just-listed");
    const heading = section.getByRole("heading", { level: 2 });
    await expect(heading).toHaveText("New at Mbombela");
    await expect(section.getByText("Nothing new at Mbombela yet")).toBeVisible();

    await section.getByRole("button", { name: "Show all campuses" }).click();
    await expect(heading).toHaveText("New on all campuses");
    await expect(section.getByRole("button", { name: "All campuses", pressed: true })).toBeVisible();
    await expect(section.getByRole("article")).toHaveCount(VISIBLE_CARDS[project()]);

    await section.getByRole("button", { name: "Mbombela", pressed: false }).click();
    await expect(heading).toHaveText("New at Mbombela");
  });
});

test("a heart saves on this device, and the header counts it (spec 7.8)", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/");
  const heart = page.locator("#just-listed").getByRole("button", { name: /^Save / }).first();
  // The visible pill: the text also sits in a screen-reader-only live region, so getByText would match two elements.
  const toast = page.locator(".toast");
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText("Saved on this device");
  await expect(page.locator('.site-header a[aria-label="Saved, 1 item"]').first()).toBeAttached();
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  await expect(toast).toHaveText("Removed from saved");
});

test.describe("the strip under the hero (spec 7.4)", () => {
  test("a first visit sees the trust strip", async ({ page }) => {
    await page.goto("/");
    const strip = page.getByRole("region", { name: "Why you can trust Vossie" });
    await expect(strip.getByRole("link", { name: "How trust works" })).toBeVisible();
  });

  test("a returning visitor picks up where they left off", async ({ page }) => {
    await page.goto("/listings/l-001");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("vossie_recently_viewed"))).not.toBeNull();
    await page.goto("/");
    const strip = page.getByRole("region", { name: "Pick up where you left off" });
    await expect(strip.getByRole("link", { name: "Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "href",
      "/listings/l-001",
    );
  });
});
