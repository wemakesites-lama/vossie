import { expect, test } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

test("shows the photos, price, collect box, seller and more from them", async ({ page }) => {
  await page.goto("/listings/l-001");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Casio fx-991ZA Plus calculator");
  await expect(page.locator(".listing-page-price")).toHaveText("R250");
  await expect(page.getByRole("region", { name: "Photos" }).getByRole("img")).toHaveCount(3);
  await expect(page.getByText("Collect at Midrand · Library entrance")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Tech corner", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "More from Tech corner" })).toBeAttached();
  await expect(page).toHaveTitle("Casio fx-991ZA Plus calculator · Vossie");
});

test("docks Message, Save and Share at the bottom on phones, covering nothing", async ({ page }) => {
  onlyAt("phone-360", "phone-390");
  await page.goto("/listings/l-001");
  const dock = page.locator(".listing-actions");
  await expect(dock).toHaveCSS("position", "fixed");
  const box = (await dock.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);

  // Scrolled to the very end, the footer still finishes above the dock.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const footerBottom = await page.getByRole("contentinfo").evaluate((footer) => footer.getBoundingClientRect().bottom);
  expect(footerBottom).toBeLessThanOrEqual(box.y + 1);
});

test("the dock's room under the footer doesn't follow you to the next page", async ({ page }) => {
  onlyAt("phone-390");
  await page.goto("/listings/l-001");
  await expect(page.locator("body")).not.toHaveCSS("padding-bottom", "0px");
  // Next keeps the listing page hidden in the page for Back, with its dock inside it.
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Browse", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Everything");
  await expect(page.locator("body")).toHaveCSS("padding-bottom", "0px");
});

test("a keyboard walk goes breadcrumb, photos, then the actions, in reading order", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/listings/l-001");
  await page.locator("#main").focus();
  const names: string[] = [];
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("Tab");
    names.push(
      await page.evaluate(() => {
        const focused = document.activeElement as HTMLElement | null;
        return focused?.getAttribute("aria-label") ?? focused?.textContent?.trim() ?? "";
      }),
    );
  }
  expect(names).toEqual([
    "Browse",
    "Tech",
    "Photos",
    "Message seller",
    "Save Casio fx-991ZA Plus calculator",
    "Share",
  ]);
});

test("keeps the column with the actions in view on desktop", async ({ page }) => {
  onlyAt("laptop-1024", "desktop-1440");
  await page.goto("/listings/l-001");
  await expect(page.locator(".listing-actions")).toHaveCSS("position", "static");
  await expect(page.locator(".listing-panel")).toHaveCSS("position", "sticky");
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(page.getByRole("link", { name: "Message seller" })).toBeInViewport();
});

test("messaging goes through the sign-in page and back", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/listings/l-001");
  await page.getByRole("link", { name: "Message seller" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001$/);
  await expect(page.getByText("Signing in arrives in the next stage.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Back to the listing" }).click();
  await expect(page).toHaveURL(/\/listings\/l-001$/);
});

test("the sign-in page never links back to another site", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/login?next=//evil.example");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await expect(page.getByRole("link", { name: /^(Back to the listing|Go back)$/ })).toHaveCount(0);
});

test("sold and paused listings say so and offer similar items", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/listings/l-026");
  await expect(page.getByText("Sold", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "See similar items" })).toHaveAttribute("href", "/browse?cat=tech");
  await expect(page.getByRole("link", { name: "Message seller" })).toHaveCount(0);
  await page.goto("/listings/l-016");
  await expect(page.getByText("Not taking orders right now")).toBeVisible();
});

test("shows swap terms and the cash-or-swap price", async ({ page }) => {
  onlyAt("phone-390", "desktop-1440");
  await page.goto("/listings/l-007");
  await expect(page.locator(".listing-page-price")).toHaveText("R450 or swap");
  await expect(page.getByText("a mechanical keyboard or a Bluetooth speaker", { exact: false })).toBeVisible();
});

test("notes when a pickup isn't at your campus", async ({ page, context, baseURL }) => {
  onlyAt("phone-390", "desktop-1440");
  await context.addCookies([{ name: "vossie_campus", value: "pretoria", url: baseURL! }]);
  await page.goto("/listings/l-001");
  await expect(page.getByText("Midrand isn't your chosen campus (Pretoria)", { exact: false })).toBeVisible();
  await page.goto("/listings/l-030");
  await expect(page.getByText("isn't your chosen campus", { exact: false })).toHaveCount(0);
});

test("with data saver on, only the cover photo loads", async ({ page }) => {
  onlyAt("phone-390");
  const extraPhotos: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/placeholders/photo/")) extraPhotos.push(request.url());
  });
  await page.addInitScript(() => localStorage.setItem("vossie_low_data", "1"));
  await page.goto("/listings/l-001", { waitUntil: "networkidle" });
  const more = page.locator("details.gallery-saver > summary");
  await expect(more).toHaveText("Show 2 more photos");
  expect(extraPhotos).toEqual([]);
  await more.click();
  await expect.poll(() => extraPhotos.length).toBeGreaterThan(0);
});

test("Share copies the link where there's no share sheet", async ({ page, context }) => {
  onlyAt("desktop-1440");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  await page.goto("/listings/l-001");
  await page.getByRole("button", { name: "Share" }).click();
  // The footer sign-up has an (empty) status element too, so pick the one that says it.
  await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toHaveText("Link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/listings\/l-001$/);
});

test("each listing has a share card for link previews", async ({ page, request, baseURL }) => {
  onlyAt("desktop-1440");
  await page.goto("/listings/l-001");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Casio fx-991ZA Plus calculator · R250",
  );
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    "Casio fx-991ZA Plus calculator, R250, at Midrand on Vossie",
  );
  // metadataBase comes from NEXT_PUBLIC_SITE_URL (http://localhost:3000 when it isn't set), so the card's address is
  // absolute, and in this test it names another port: fetch its path from the test server. There is one og:image, in
  // the server's HTML and after hydration alike (before metadataBase the browser added a second one).
  await page.waitForLoadState("networkidle");
  const images = page.locator('meta[property="og:image"]');
  await expect(images).toHaveCount(1);
  const content = (await images.getAttribute("content"))!;
  expect(content).toMatch(/^https?:\/\//);
  const card = new URL(content);
  const response = await request.get(new URL(`${card.pathname}${card.search}`, baseURL).toString());
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});
