import { brotliCompressSync, constants } from "node:zlib";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { button, field, main, newBuyer, signInAsSample, signUp } from "./helpers/messaging";
import { POST_LANDS } from "./helpers/selling";
import { signedInPage } from "./helpers/staff";

// Accessibility, layout shift and size for the staff tools (staff tools plan, Task 21; spec 4 and 5). Staff pages are
// checked signed in as the sample Admin, who can open every one of them. Nothing here writes to the store that other
// tests count: the only writes are a new student's report, and form state that lives in the checking session.

test.use({ reducedMotion: "reduce" });

const BOTH = ["phone-390", "desktop-1440"];
const onlyAtBoth = () => test.skip(!BOTH.includes(test.info().project.name), "Checked at 390 and 1440");

/**
 * Axe on the page once it has drawn. A staff page's title comes from its request-time parts (plan decision 1: it
 * reads the session), so it can arrive a moment after the heading; the page isn't whole, and axe's document-title rule
 * would fire, until it has. A title that never arrives still fails here.
 */
async function expectNoSeriousIssues(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  expect(await seriousIssues(page)).toEqual([]);
}

/** Signs `context` in through another browser, copying only the session cookie across, so nothing is cached yet. */
async function copySession(browser: Browser, context: BrowserContext, baseURL: string, label: string) {
  const other = await browser.newContext({ baseURL, serviceWorkers: "block" });
  await signInAsSample(await other.newPage(), label, "/account");
  await context.addCookies((await other.cookies()).filter((cookie) => cookie.name === "vossie_session"));
  await other.close();
}

const STAFF_PAGES: ReadonlyArray<[path: string, heading: string]> = [
  ["/admin", "Overview"],
  ["/admin/sellers", "Sellers"],
  ["/admin/sellers/crochet-corner", "Crochet corner"],
  ["/admin/sellers/crochet-corner/decline", "Decline Crochet corner"],
  ["/admin/sellers/tech-corner", "Tech corner"],
  ["/admin/sellers/tech-corner/pause", "Pause Tech corner"],
  ["/admin/reports", "Reports"],
  ["/admin/featured", "Featured"],
  ["/admin/pickup-points", "Pickup points"],
  ["/admin/audit", "Audit log"],
  ["/admin/audit?kind=shops", "Audit log"],
  ["/hub/manage", "Hub posts"],
  ["/hub/new", "Write a post"],
  // A past post can still be edited (amendment 12.5), so this page doesn't depend on the date the tests run.
  ["/hub/h-002/edit", "Edit Office hours: pricing your hustle"],
  ["/mentor", "Mentor dashboard"],
  ["/mentor/tech-corner", "Tech corner"],
];

test.describe("the staff tools have no serious or critical axe issues (staff tools spec 4)", () => {
  for (const [path, heading] of STAFF_PAGES) {
    test(`${path}, signed in as the admin`, async ({ page }) => {
      onlyAtBoth();
      await signInAsSample(page, "Admin", path);
      await expect(main(page).getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoSeriousIssues(page);
    });
  }

  test("a report's page and its Hide confirm page, with the confirm page's error", async ({ page, browser, baseURL }) => {
    onlyAtBoth();
    test.setTimeout(90_000);
    const buyer = newBuyer();
    await signUp(page, buyer);
    await page.goto("/report?listing=l-004");
    await main(page).getByRole("radio", { name: "Spam" }).check();
    await button(page, "Send report").click();
    await expect(page).toHaveURL(/\/report\/sent\?listing=l-004$/, POST_LANDS);

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
    await main(admin).getByRole("row").filter({ hasText: buyer.firstName }).getByRole("link").click();
    await expect(main(admin).getByRole("heading", { level: 2, name: "The report" })).toBeVisible();
    await expectNoSeriousIssues(admin);
    await main(admin).getByRole("link", { name: /^Hide / }).click();
    await expect(field(admin, "Reason")).toBeVisible();
    await expectNoSeriousIssues(admin);
    // Pressing Hide with no reason shows the error summary and the field's error: no listing is hidden.
    await main(admin).getByRole("button", { name: /^Hide / }).click();
    await expect(main(admin).getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
    await expectNoSeriousIssues(admin);
    await admin.context().close();
  });

  test("the post editor with its errors, and with a Preview", async ({ page }) => {
    onlyAtBoth();
    test.setTimeout(60_000);
    await signInAsSample(page, "Admin", "/hub/new");
    await expect(main(page).getByRole("heading", { level: 1, name: "Write a post" })).toBeVisible();
    // Nothing typed: Save lists what's missing and writes no post.
    await button(page, "Save the post").click();
    await expect(main(page).getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
    await expectNoSeriousIssues(page);
    // Preview draws the body above the form.
    await field(page, "The post").fill("## Bring\n- A table\n\nSee [the Hub](/hub).");
    await button(page, "Preview").click();
    await expect(main(page).getByRole("region", { name: "Preview" })).toBeVisible(POST_LANDS);
    await expectNoSeriousIssues(page);
  });

  // h-007 is the sample office hours with a request waiting (Thandi's), upcoming until 19 November 2026. After that the
  // page says the office hours have passed in both states, and axe checks that instead; the heading stays.
  test("the slot request page, with a request waiting and with the form", async ({ page, browser, baseURL }) => {
    onlyAtBoth();
    test.setTimeout(60_000);
    await signInAsSample(page, "Student, Midrand", "/hub/h-007/book");
    await expect(main(page).getByRole("heading", { level: 1, name: "Request a slot" })).toBeVisible();
    await expectNoSeriousIssues(page);
    // Another account has no request there, so it gets the form (while the office hours are upcoming).
    const other = await signedInPage(browser, baseURL!, "Seller, Tech corner", "/hub/h-007/book");
    await expect(main(other).getByRole("heading", { level: 1, name: "Request a slot" })).toBeVisible();
    await expectNoSeriousIssues(other);
    // And with the form's own error: nothing typed. Past the 19th of November there's no form to press.
    const send = button(other, "Send request");
    if ((await send.count()) > 0) {
      await send.click();
      await expect(main(other).getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
      await expectNoSeriousIssues(other);
    }
    await other.context().close();
  });
});

const SHIFT_PAGES: ReadonlyArray<[name: string, path: string, label: string]> = [
  ["slot request page (a request waiting)", "/hub/h-007/book", "Student, Midrand"],
  ["slot request page (the form)", "/hub/h-007/book", "Seller, Tech corner"],
  ["admin console's Overview", "/admin", "Admin"],
  ["mentor dashboard", "/mentor", "Mentor"],
];

for (const [name, path, label] of SHIFT_PAGES) {
  test(`the ${name} holds still while fonts and content arrive (CLS 0.05 or less, homepage spec 11)`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    onlyAtBoth();
    await copySession(browser, context, baseURL!, label);
    // Hold the fonts back, so they swap in after first paint: the worst case for shifts.
    await page.route(/\.woff2$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await page.addInitScript(() => {
      type LayoutShift = PerformanceEntry & { value: number; hadRecentInput: boolean };
      const shifts: number[] = [];
      (window as unknown as { __shifts: number[] }).__shifts = shifts;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LayoutShift[]) if (!entry.hadRecentInput) shifts.push(entry.value);
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    // Two frames, so a last shift is recorded.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const total = await page.evaluate(() =>
      (window as unknown as { __shifts: number[] }).__shifts.reduce((sum, value) => sum + value, 0),
    );
    console.log(`${name} layout shift (${test.info().project.name}): ${total.toFixed(4)}`);
    expect(total, "cumulative layout shift").toBeLessThanOrEqual(0.05);
  });
}

const SIZE_PAGES: ReadonlyArray<[name: string, path: string]> = [
  ["Overview", "/admin"],
  ["Sellers", "/admin/sellers"],
  ["Hub tools", "/hub/manage"],
  ["Mentor dashboard", "/mentor"],
];

for (const [name, path] of SIZE_PAGES) {
  test(`a first visit to the staff ${name} page, signed in, stays under the JavaScript limit (spec 5)`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
    await copySession(browser, context, baseURL!, "Admin");
    let scriptBrotli = 0;
    const pending: Array<Promise<void>> = [];
    page.on("response", (response) => {
      if (response.request().resourceType() !== "script") return;
      pending.push(
        response.body().then((body) => {
          scriptBrotli += brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
        }),
      );
    });
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
    await Promise.all(pending);
    console.log(`staff ${name} (signed in): ${JSON.stringify({ scriptBrotli })}`);
    expect(scriptBrotli, "JavaScript, brotli as a host serves it").toBeLessThanOrEqual(150 * 1024);
  });
}
