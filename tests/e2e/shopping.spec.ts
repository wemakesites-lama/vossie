import { expect, test, type Page } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

/** The cards on the page that's showing. Next keeps the last few pages hidden in the DOM for Back, cards and all. */
const cards = (page: Page) => page.locator("main article").filter({ visible: true });

/** One card, found by its title. */
const card = (page: Page, title: string) => cards(page).filter({ hasText: title });

test.describe("the seller storefront (spec 4)", () => {
  test("shows the band, About and the seller's listings", async ({ page }) => {
    await page.goto("/sellers/tech-corner");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech corner");
    await expect(page.getByText("Calculators, headsets and chargers, tested before you buy.")).toBeVisible();
    // Tech corner's badge is worked out from its conversations, which other tests add to (staff tools approval 7).
    await expect(page.locator(".seller-stamps li")).toHaveText(["Midrand", "Tech", /^(New seller|Responsive|Trusted)$/]);
    await expect(page.getByRole("heading", { level: 2, name: "About" })).toBeVisible();
    await expect(page.getByText("Selling since March 2026")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "2 listings" })).toBeVisible();
    await expect(cards(page).getByRole("link")).toHaveText([
      "Casio fx-991ZA Plus calculator",
      "Gaming headset, barely used",
    ]);
    await expect(page).toHaveTitle("Tech corner · Vossie");
  });

  test("puts About beside the listings, 4 across, on desktop", async ({ page }) => {
    onlyAt("laptop-1024", "desktop-1440");
    await page.goto("/sellers/tech-corner");
    const about = (await page.getByRole("region", { name: "About" }).boundingBox())!;
    const listings = (await page.getByRole("region", { name: "2 listings" }).boundingBox())!;
    expect(about.x + about.width).toBeLessThanOrEqual(listings.x);
    const columns = await page
      .locator(".card-grid")
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(4);
  });

  test("stamps a verified seller", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/sellers/hair-studio");
    await expect(page.locator(".seller-stamps li")).toHaveText(["Midrand", "Hair & beauty", "Verified", "Trusted"]);
  });

  test("Message goes through the sign-in page and back", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/sellers/tech-corner");
    await page.getByRole("link", { name: "Message seller" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsellers%2Ftech-corner%2Fmessage$/);
    await page.getByRole("link", { name: "Go back" }).click();
    await expect(page).toHaveURL(/\/sellers\/tech-corner$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech corner");
  });

  test("says when a seller has nothing listed, and points to their category", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/sellers/lash-lounge");
    await expect(page.getByRole("heading", { level: 2, name: "Listings" })).toBeVisible();
    await expect(page.getByText("Nothing listed right now")).toBeVisible();
    await page.getByRole("link", { name: "More in Hair & beauty" }).click();
    await expect(page).toHaveURL(/\/browse\?cat=hair-beauty$/);
  });

  test("each seller has a share card for link previews", async ({ page, request, baseURL }) => {
    onlyAt("desktop-1440");
    await page.goto("/sellers/tech-corner");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Tech corner · Midrand on Vossie");
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      "content",
      "Tech corner, Tech at Midrand on Vossie",
    );
    // As on the listing page: metadataBase makes the card's address absolute, so there is one og:image, and its
    // address names the site's own origin. Fetch its path from the test server.
    await page.waitForLoadState("networkidle");
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    const cardUrl = new URL((await page.locator('meta[property="og:image"]').getAttribute("content"))!);
    const response = await request.get(new URL(`${cardUrl.pathname}${cardUrl.search}`, baseURL).toString());
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    // An unknown seller has no card.
    const missing = await request.get(new URL(cardUrl.pathname.replace("tech-corner", "nope"), baseURL).toString());
    expect(missing.status()).toBe(404);
  });
});

test.describe("Saved (spec 5)", () => {
  test("a listing saved on its page shows up on Saved, even when Saved was open before", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    // Open Saved first, so Next keeps it hidden for Back: coming back to it by a link must still show the new save.
    await page.goto("/saved");
    await expect(page.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeVisible();
    await page.getByRole("link", { name: "Start browsing" }).click();
    await expect(page).toHaveURL(/\/browse$/);
    await page.getByRole("link", { name: "Casio fx-991ZA Plus calculator" }).click();
    await expect(page).toHaveURL(/\/listings\/l-001$/);

    await page.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" }).click();
    // The header's link from the tablet step, the tab bar's Saved tab on phones (spec section 6.2). On a phone the
    // listing's dock stands in for the tab bar, so Back to browse first.
    if (project() === "phone-390") {
      await page.goBack();
      await expect(page).toHaveURL(/\/browse$/);
    }
    const savedLink = page.locator(".site-header, .tabbar").getByRole("link", { name: /^Saved(, 1 item)?$/ });
    await expect(savedLink).toBeVisible();
    // The header's link says the count in its name, the tab in its description.
    if (project() === "phone-390") await expect(savedLink).toHaveAccessibleDescription("1 item");
    else await expect(savedLink).toHaveAccessibleName("Saved, 1 item");
    await savedLink.click();

    await expect(page).toHaveURL(/\/saved$/);
    await expect(page.getByText("1 saved", { exact: true })).toBeVisible();
    await expect(cards(page).getByRole("link")).toHaveText(["Casio fx-991ZA Plus calculator"]);
    await expect(cards(page).getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("removing a listing greys its card until the next visit", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_saved", value: "l-001.l-007", url: baseURL! }]);
    await page.goto("/saved");
    await expect(page.getByText("2 saved", { exact: true })).toBeVisible();
    const calculator = card(page, "Casio fx-991ZA Plus calculator");
    const heart = calculator.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" });
    const removed = calculator.getByText("Removed", { exact: true });
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await expect(removed).toBeHidden();

    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".toast")).toHaveText("Removed from saved");
    await expect(removed).toBeVisible();
    await expect(calculator.locator(".listing-photo")).toHaveCSS("filter", "grayscale(1)");
    // Only the photo fades. Opacity isn't inherited, so the card itself is what shows whether the whole card faded.
    await expect(calculator).toHaveCSS("opacity", "1");

    // Another tap saves it back.
    await heart.click();
    await expect(removed).toBeHidden();

    await heart.click();
    await page.reload();
    await expect(page.getByText("1 saved", { exact: true })).toBeVisible();
    await expect(cards(page)).toHaveCount(1);
    await expect(card(page, "Casio fx-991ZA Plus calculator")).toHaveCount(0);
  });

  test("keeps sold and paused listings, tagged, and drops ones that no longer exist", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_saved", value: "l-026.gone.l-016", url: baseURL! }]);
    await page.goto("/saved");
    await expect(page.getByText("2 saved", { exact: true })).toBeVisible();
    await expect(card(page, "Sharp scientific calculator").getByText("Sold", { exact: true })).toBeVisible();
    await expect(card(page, "Lash extensions, classic set").getByText("Not taking orders")).toBeVisible();
  });

  test("forgets saved ids whose listings no longer exist, so the header stops counting them", async ({
    page,
    context,
    baseURL,
  }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_saved", value: "gone-1.gone-2", url: baseURL! }]);
    await page.goto("/saved");
    await expect(page.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeVisible();
    // The header first counts both ids, then Saved forgets them and the count goes.
    const header = page.locator(".site-header, .tabbar");
    await expect(header.getByRole("link", { name: "Saved", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: /^Saved, / })).toHaveCount(0);
    // The cookie itself is gone, not just hidden.
    await expect
      .poll(async () => (await context.cookies()).some((cookie) => cookie.name === "vossie_saved"))
      .toBe(false);
  });

  test("with nothing saved, says so and points to browse", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/saved");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saved");
    await expect(page.getByText("Saved on this device. Once Vossie is live")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeVisible();
    await page.getByRole("link", { name: "Start browsing" }).click();
    await expect(page).toHaveURL(/\/browse$/);
  });

  test("the hearts start pressed before the app's JavaScript arrives (spec 5.3)", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    // The app's bundle never arrives. React's small inline script still puts the streamed list in place.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await context.addCookies([{ name: "vossie_saved", value: "l-001", url: baseURL! }]);
    await page.goto("/saved");
    const calculator = card(page, "Casio fx-991ZA Plus calculator");
    await expect(calculator.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(calculator.getByText("Removed", { exact: true })).toBeHidden();
  });

  test("stays out of search engines", async ({ page }) => {
    onlyAt("desktop-1440");
    await page.goto("/saved");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(page).toHaveTitle("Saved · Vossie");
  });
});

test.describe("collection pages (spec 7.2)", () => {
  test("Res setup under R500 shows res listings at R500 or less, from every campus", async ({ page }) => {
    await page.goto("/collections/moving-in");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Res setup under R500");
    await expect(page.getByText("Make your room a home without breaking the bank.")).toBeVisible();
    await expect(page.getByText("Curated by the Incubation Hub")).toBeVisible();
    await expect(page.getByText("5 listings", { exact: true })).toBeVisible();
    const hrefs = await cards(page)
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual(["/listings/l-014", "/listings/l-006", "/listings/l-027", "/listings/fs-003", "/listings/fs-005"]);
    await expect(page).toHaveTitle("Res setup under R500 · Vossie");
  });

  test("runs the photo edge to edge on phones, and beside the text from the tablet step", async ({ page }) => {
    await page.goto("/collections/moving-in");
    const photo = (await page.locator(".collection-photo").boundingBox())!;
    if (project().startsWith("phone-")) {
      expect(photo.x).toBe(0);
      expect(Math.round(photo.width)).toBe(page.viewportSize()!.width);
    } else {
      const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(photo.x + photo.width).toBeLessThanOrEqual(title.x);
    }
  });

  test("links on to browse, keeping the price cap", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/collections/moving-in");
    await page.getByRole("link", { name: "More in Res & living under R500" }).click();
    await expect(page).toHaveURL(/\/browse\?cat=res-living&max=500$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Res & living");
  });

  test("offers the Hub's other collections", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/collections/moving-in");
    const more = page.getByRole("region", { name: "More from the Hub" });
    await expect(more.getByRole("link")).toHaveText([
      /Back-to-campus essentials/,
      /Notes, tutors & cram snacks/,
      /Book a student/,
    ]);
    await more.getByRole("link", { name: /Book a student/ }).click();
    await expect(page).toHaveURL(/\/collections\/skills-for-hire$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Book a student");
  });

  test("the homepage's collections open their pages", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await page.locator(".collections").getByRole("link", { name: /Res setup under R500/ }).click();
    await expect(page).toHaveURL(/\/collections\/moving-in$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Res setup under R500");
  });
});
