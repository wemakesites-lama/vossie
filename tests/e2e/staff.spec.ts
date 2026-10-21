import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { button, field, main, newBuyer, onlyAt, signInAsSample, signUp } from "./helpers/messaging";
import { notFoundHeading, POST_LANDS, uniqueWord } from "./helpers/selling";
import { applyToSell, newShopName, reviewShop, signedInPage, staffNotice } from "./helpers/staff";
import { ADMIN_PAGES, HUB_AND_MENTOR_PAGES, STAFF_404_IS_REAL } from "./helpers/staff-accounts";

// Staff tests that write nothing buyers can see (staff tools plan Task 20, decision 21): the 404s, approving and
// declining a new student's shop, dismissing a report, and a mentor's note with the CSV. What buyers see changes in
// staff-writes.spec.ts, which runs after every other test. Each test acts only on what it makes.

const BOTH = ["phone-390", "desktop-1440"];

test.describe("staff pages (staff tools spec 2.1, plan decision 1)", () => {
  test("answer 404 to a student, titled Page not found, and never advertise themselves", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Student, Midrand", "/account");
    for (const path of [
      "/admin",
      "/admin/sellers",
      "/admin/sellers/tech-corner",
      "/admin/reports",
      "/admin/featured",
      "/admin/pickup-points",
      "/admin/audit",
      "/admin/numbers",
      "/admin/staff",
      "/admin/staff/acc-mentor/remove-mentor",
      "/admin/hidden",
      "/admin/hidden/listings/l-001",
      "/hub/manage",
      "/hub/new",
      "/hub/h-003/edit",
      "/mentor",
      "/mentor/tech-corner",
    ]) {
      await page.goto(path);
      await expect(notFoundHeading(page), path).toBeVisible();
      await expect(page, path).toHaveTitle("Page not found · CampusCart");
      // Next adds its own noindex to every 404 page, beside the page's: every one says so.
      await expect(page.locator('meta[name="robots"]').first(), path).toHaveAttribute("content", /noindex/);
      await expect(page.locator('meta[name="robots"]:not([content*="noindex"])'), path).toHaveCount(0);
      // Nothing of the page's own shows: no staff navigation, no staff tables.
      await expect(page.getByRole("navigation", { name: "Staff tools" }), path).toHaveCount(0);
    }
    // The CSV is a real 404 too: a route handler answers before anything is sent.
    expect((await page.request.get("/mentor/export", { maxRedirects: 0 })).status()).toBe(404);
  });

  test("answer 404 to a mentor on the admin console, but open the Hub's tools and the dashboard to them", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Mentor", "/account");
    for (const path of ["/admin", "/admin/sellers", "/admin/audit"]) {
      await page.goto(path);
      await expect(notFoundHeading(page), path).toBeVisible();
      await expect(page, path).toHaveTitle("Page not found · CampusCart");
    }
    // A mentor does have the Hub's tools and the dashboard.
    await page.goto("/hub/manage");
    await expect(main(page).getByRole("heading", { level: 1, name: "Hub posts" })).toBeVisible();
    await expect(page).toHaveTitle("Hub posts and office hours · CampusCart");
    await page.goto("/mentor");
    await expect(main(page).getByRole("heading", { level: 1, name: "Mentor dashboard" })).toBeVisible();
    await expect(page).toHaveTitle("Mentor dashboard · CampusCart");
  });
});

test.describe("sellers (staff tools spec 2.3, plan decision 2)", () => {
  test("an admin approves a new student's shop, and the student sees their dashboard and a notification", async ({
    page,
    browser,
    baseURL,
  }) => {
    onlyAt(...BOTH);
    test.setTimeout(90_000);
    const shopName = newShopName();
    await applyToSell(page, shopName);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Hub is checking your shop");

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin");
    await expect(main(admin).getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(admin).toHaveTitle("Admin console · CampusCart");
    await reviewShop(admin, shopName);
    await button(admin, `Approve ${shopName}`).click();
    await expect(staffNotice(admin)).toHaveText("Approved. The shop is live, and its owner has been told.", POST_LANDS);
    // The audit log has the action, filed under Shops.
    await admin.goto("/admin/audit?kind=shops");
    await expect(main(admin).getByRole("row").filter({ hasText: shopName })).toContainText("Approved a shop");
    await admin.context().close();

    await page.goto("/sell");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(shopName);
    await expect(main(page).getByText("Your shop is live").filter({ visible: true })).toBeVisible();
    await page.goto("/notifications");
    await expect(
      main(page).getByText(`The Hub approved ${shopName}. You can publish your listings now.`).filter({ visible: true }),
    ).toBeVisible();
  });

  test("an admin declines with a reason; the student sees it and sends the shop again", async ({
    page,
    browser,
    baseURL,
  }) => {
    onlyAt(...BOTH);
    test.setTimeout(90_000);
    const shopName = newShopName();
    await applyToSell(page, shopName);

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
    await reviewShop(admin, shopName);
    await main(admin).getByRole("link", { name: `Decline ${shopName}` }).click();
    await expect(admin).toHaveURL(/\/admin\/sellers\/[a-z0-9-]+\/decline$/);
    // A reason is required.
    await button(admin, `Decline ${shopName}`).click();
    await expect(main(admin).getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
    await field(admin, "Reason").fill("Add a photo of what you bake.");
    await button(admin, `Decline ${shopName}`).click();
    await expect(staffNotice(admin)).toHaveText("Declined. The seller has been told why, and can send it again.", POST_LANDS);
    await admin.context().close();

    await page.goto("/sell");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Hub didn't approve your shop yet");
    await expect(main(page).getByText("Add a photo of what you bake.").filter({ visible: true })).toBeVisible();
    await button(page, "Send for approval again").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Hub is checking your shop", POST_LANDS);
  });
});

test.describe("reports (staff tools spec 2.3, plan decision 5)", () => {
  test("an admin dismisses a report with a note, and the reporter sees the outcome", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    test.setTimeout(90_000);
    const buyer = newBuyer();
    await signUp(page, buyer);
    await page.goto("/report?listing=l-004");
    await main(page).getByRole("radio", { name: "Misleading listing" }).check();
    await field(page, "Tell us more (optional)").fill(`It looks different ${uniqueWord()}`);
    await button(page, "Send report").click();
    await expect(page).toHaveURL(/\/report\/sent\?listing=l-004$/, POST_LANDS);

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
    const row = main(admin).getByRole("row").filter({ hasText: buyer.firstName });
    await row.getByRole("link", { name: /^Review the report about/ }).click();
    // The reporter's first name is all the page says about them (spec 3).
    await expect(main(admin).getByText(buyer.firstName, { exact: true }).filter({ visible: true })).toBeVisible();
    // A note is required.
    await main(admin).getByRole("button", { name: /^Dismiss the report about/ }).click();
    await expect(main(admin).getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
    await field(admin, "Note").fill("Checked the photos: it's the same item.");
    await main(admin).getByRole("button", { name: /^Dismiss the report about/ }).click();
    await expect(admin).toHaveURL(/\/admin\/reports$/, POST_LANDS);
    await expect(staffNotice(admin)).toHaveText("Dismissed. The reporter has been told.");
    await admin.context().close();

    await page.goto("/notifications");
    await expect(
      main(page)
        .getByText(/^We looked at your report about .+ and didn't find a problem\.$/)
        .filter({ visible: true }),
    ).toBeVisible();
  });
});

test.describe("mentoring (staff tools spec 2.6, plan decisions 15 to 17)", () => {
  test("a mentor downloads the dashboard as a CSV, and adds a note to a shop they mentor", async ({ page }) => {
    onlyAt(...BOTH);
    test.setTimeout(90_000);
    await signInAsSample(page, "Mentor", "/mentor");
    const table = main(page).getByRole("table", { name: "Your sellers, A to Z" });
    await expect(table.getByRole("link", { name: "Tech corner" })).toBeVisible();

    const downloading = page.waitForEvent("download");
    await main(page).getByRole("link", { name: "Download CSV" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^campuscart-mentoring-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = await readFile(await download.path(), "utf8");
    // A byte-order mark first, so Excel reads it as UTF-8 (amendment 12.2); every text cell quoted (amendment 12.1).
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      [
        "Shop",
        "Campus",
        "Mentor",
        "Badge",
        "Status",
        "Enquiries (14 days)",
        "Due for a reply",
        "Replied within 48 hours",
        "Sales confirmed (14 days)",
        "Flags",
      ]
        .map((name) => `"${name}"`)
        .join(","),
    );
    // Other tests message Tech corner at the same time, so only the row's start is checked.
    expect(lines.some((line) => line.startsWith('"Tech corner","Midrand","Naledi",'))).toBe(true);
    // No messages, no emails: only the table's columns.
    expect(csv).not.toMatch(/@eduvos\.com/);

    await table.getByRole("link", { name: "Tech corner" }).click();
    await expect(main(page).getByRole("heading", { level: 1, name: "Tech corner" })).toBeVisible();
    const word = uniqueWord();
    await field(page, "Note").fill(`Talked about photos ${word}.`);
    await button(page, "Add a note about Tech corner").click();
    await expect(staffNotice(page)).toHaveText("Note saved.", POST_LANDS);
    const notes = main(page).getByRole("region", { name: "Notes and check-ins" });
    await expect(notes.getByRole("listitem").filter({ hasText: word })).toContainText("Naledi");
  });
});

test.describe("staff pages' status (stage J spec decision 15)", () => {
  test.skip(!STAFF_404_IS_REAL, "Stage J's spike kept stage G's pattern: the 404 page streams in with status 200");

  test("answer a real 404 to a student on every staff page", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Student, Midrand", "/account");
    for (const path of [...ADMIN_PAGES, ...HUB_AND_MENTOR_PAGES]) {
      expect((await page.request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
    }
  });

  test("answer a real 404 to a mentor on the admin console, and 200 on the Hub's tools and the dashboard", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Mentor", "/account");
    for (const path of ADMIN_PAGES) {
      expect((await page.request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
    }
    for (const path of ["/hub/manage", "/mentor"]) {
      expect((await page.request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
    }
  });

  test("send a signed-out visitor to sign in with a real 307, coming back to the page afterwards", async ({ request }) => {
    onlyAt(...BOTH);
    for (const path of [...ADMIN_PAGES, ...HUB_AND_MENTOR_PAGES]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      const location = new URL(response.headers().location ?? "", "http://localhost");
      expect(`${location.pathname}${location.search}`, path).toBe(`/login?next=${encodeURIComponent(path)}`);
    }
  });
});
