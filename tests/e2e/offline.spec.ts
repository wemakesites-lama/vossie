import { expect, test } from "@playwright/test";

// The one test that lets Vossie's service worker run (community actions spec section 6). Each test has its own browser
// context, so the worker never reaches another test. Chromium only, as every project is.
test.use({ serviceWorkers: "allow" });

test.describe("offline (community actions spec 2.20 to 2.22)", () => {
  test("the worker installs; an offline page load shows Vossie's offline page; Try again works once back online", async ({
    page,
    context,
  }) => {
    test.skip(test.info().project.name !== "phone-390", "Checked once, at 390px");
    await page.goto("/listings/l-001");
    // It registers after load, and keeps the offline page when it installs.
    await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active !== null);
    await expect
      .poll(() => page.evaluate(async () => Boolean(await caches.match("/offline", { cacheName: "vossie_offline" }))))
      .toBe(true);

    await context.setOffline(true);
    await page.goto("/browse");
    await expect(page.getByRole("heading", { level: 1, name: "You're offline" })).toBeVisible();
    await expect(page).toHaveURL(/\/browse$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-ZA");

    await context.setOffline(false);
    await page.getByRole("link", { name: "Try again" }).click();
    await expect(page).toHaveURL(/\/browse$/);
    await expect(page.getByRole("heading", { level: 1, name: "You're offline" })).toHaveCount(0);
    await expect(page.locator("main").getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("/sw.js is sent with no-cache, and /offline is noindex", async ({ request }) => {
    test.skip(test.info().project.name !== "phone-390", "Checked once, at 390px");
    const worker = await request.get("/sw.js");
    expect(worker.headers()["cache-control"]).toContain("no-cache");
    expect(worker.headers()["content-type"]).toContain("javascript");
    expect(await worker.text()).toContain("vossie_offline");
    const offline = await request.get("/offline");
    expect(offline.headers()["x-robots-tag"]).toBe("noindex");
  });
});
