import { brotliCompressSync, constants } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { postRequest } from "./helpers/community";
import { button, main, newBuyer, signInAsSample, signUp } from "./helpers/messaging";
import { POST_LANDS, uniqueWord } from "./helpers/selling";
import { expectStill, holdFonts, recordShifts } from "./helpers/shifts";
import { signedInPage, staffNotice } from "./helpers/staff";
import { copySession, DESKTOP, giveRole, hideRequestByReport, PHONE } from "./helpers/staff-accounts";

// Accessibility, layout shift and size for stage J's staff pages (plan Task 13b; spec sections 7 and 8). They run in the
// staff-accounts-writes project, signed in as the sample admin. The only writes are a fresh account's role (given and
// taken away again) and a fresh request (hidden and shown again).

test.use({ reducedMotion: "reduce" });

const SIZES = [
  ["390", PHONE],
  ["1440", DESKTOP],
] as const;

/** A short phone, where a page shorter than the staff skeleton shows its shift most. */
const SHORT_PHONE = {
  ...PHONE,
  viewport: { width: 375, height: 667 },
  screen: { width: 375, height: 667 },
};

/**
 * Axe on the page once it has drawn. A staff page's title comes from its request-time parts (plan decision 1: it reads
 * the session), so it can arrive a moment after the heading; the page isn't whole, and axe's document-title rule would
 * fire, until it has. A title that never arrives still fails here.
 */
async function expectNoSeriousIssues(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  expect(await seriousIssues(page)).toEqual([]);
}

const PAGES: ReadonlyArray<[path: string, heading: string]> = [
  ["/admin/staff", "Staff accounts"],
  ["/admin/staff/acc-mentor/remove-mentor", "Remove Naledi's mentor role"],
  // The admin's own role: the page refuses and has no button (spec decision 5).
  ["/admin/staff/acc-admin/remove-admin", "Your admin role"],
  ["/admin/numbers", "Numbers"],
  ["/admin/numbers?campus=midrand", "Numbers"],
  ["/admin/hidden", "Hidden listings and requests"],
];

test.describe("stage J's staff pages have no serious or critical axe issues (spec section 7)", () => {
  for (const [path, heading] of PAGES) {
    for (const [size, device] of SIZES) {
      test(`${path} at ${size}px, signed in as the admin`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({ ...device, baseURL, serviceWorkers: "block" });
        const page = await context.newPage();
        await signInAsSample(page, "Admin", path);
        await expect(main(page).getByRole("heading", { level: 1, name: heading })).toBeVisible();
        await expectNoSeriousIssues(page);
        await context.close();
      });
    }
  }

  test("/admin/staff with Give role's errors", async ({ page }) => {
    await signInAsSample(page, "Admin", "/admin/staff");
    await button(page, "Give role").click();
    await expect(main(page).getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
    await expectNoSeriousIssues(page);
  });

  test("a remove-admin confirm page with its button, for a fresh second admin, given and taken away again", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const student = newBuyer();
    await signUp(page, student);
    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/staff");
    await giveRole(admin, student.email, "Admin");
    await main(admin)
      .getByRole("row")
      .filter({ hasText: student.email })
      .getByRole("link", { name: `Remove admin role for ${student.firstName}` })
      .click();
    await expect(button(admin, `Remove ${student.firstName}'s admin role`)).toBeVisible();
    await expectNoSeriousIssues(admin);
    await button(admin, `Remove ${student.firstName}'s admin role`).click();
    await expect(staffNotice(admin)).toHaveText("Role removed. They've been told.", POST_LANDS);
    await admin.context().close();
  });

  test("/admin/hidden with rows, and a request's Show again page", async ({ page, browser, baseURL }) => {
    test.setTimeout(120_000);
    await signUp(page, newBuyer());
    const title = `Kettle ${uniqueWord()}`;
    const id = await postRequest(page, title);
    const reporting = await browser.newContext({ baseURL, serviceWorkers: "block" });
    const reporter = await reporting.newPage();
    await signUp(reporter, newBuyer());
    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
    await hideRequestByReport(reporter, admin, id, title);
    await admin.goto("/admin/hidden");
    await expect(main(admin).getByRole("row").filter({ hasText: title })).toBeVisible();
    await expectNoSeriousIssues(admin);
    await admin.goto(`/admin/hidden/requests/${id}`);
    await expect(button(admin, `Show ${title} again`)).toBeVisible();
    await expectNoSeriousIssues(admin);
    // Leave it as it was.
    await button(admin, `Show ${title} again`).click();
    await expect(staffNotice(admin)).toHaveText("Showing again. The asker has been told.", POST_LANDS);
    await admin.context().close();
    await reporting.close();
  });
});

const SHIFT_PAGES: ReadonlyArray<[name: string, path: string]> = [
  ["Staff accounts", "/admin/staff"],
  ["Numbers", "/admin/numbers"],
];

for (const [name, path] of SHIFT_PAGES) {
  for (const [size, device] of SIZES) {
    test(`the ${name} page holds still at ${size}px while fonts and content arrive (CLS 0.05 or less, homepage spec 11)`, async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({ ...device, baseURL, serviceWorkers: "block" });
      await copySession(browser, context, baseURL!, "Admin");
      const page = await context.newPage();
      await holdFonts(page);
      await recordShifts(page);
      await expectStill(page, `${name} (${size}px)`, path);
      await context.close();
    });
  }
}

// Pages much shorter than the staff skeleton, on a short phone, where the footer would jump into view if the page
// shrank the layout when it replaced the skeleton (review of Task 13; CLAUDE.md's dynamic-routes rule).
test("the own-admin refusal holds still on a short phone, 375 by 667 (CLS 0.05 or less)", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ ...SHORT_PHONE, baseURL, serviceWorkers: "block" });
  await copySession(browser, context, baseURL!, "Admin");
  const page = await context.newPage();
  await holdFonts(page);
  await recordShifts(page);
  await expectStill(page, "Your admin role (375x667)", "/admin/staff/acc-admin/remove-admin");
  await context.close();
});

test("a Show again confirm page holds still on a short phone, 375 by 667 (CLS 0.05 or less)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  await signUp(page, newBuyer());
  const title = `Kettle ${uniqueWord()}`;
  const id = await postRequest(page, title);
  const reporting = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const reporter = await reporting.newPage();
  await signUp(reporter, newBuyer());
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
  await hideRequestByReport(reporter, admin, id, title);

  const context = await browser.newContext({ ...SHORT_PHONE, baseURL, serviceWorkers: "block" });
  await copySession(browser, context, baseURL!, "Admin");
  const short = await context.newPage();
  await holdFonts(short);
  await recordShifts(short);
  await expectStill(short, "Show again confirm (375x667)", `/admin/hidden/requests/${id}`);
  await expect(button(short, `Show ${title} again`)).toBeVisible();
  await context.close();

  // Leave it as it was.
  await admin.goto(`/admin/hidden/requests/${id}`);
  await button(admin, `Show ${title} again`).click();
  await expect(staffNotice(admin)).toHaveText("Showing again. The asker has been told.", POST_LANDS);
  await admin.context().close();
  await reporting.close();
});

const SIZE_PAGES: ReadonlyArray<[name: string, path: string]> = [
  ["Overview", "/admin"],
  ["Staff accounts", "/admin/staff"],
  ["Numbers", "/admin/numbers"],
  ["Hidden", "/admin/hidden"],
];

for (const [name, path] of SIZE_PAGES) {
  test(`a first visit to the staff ${name} page at 390px, signed in, loads no new JavaScript (spec section 8)`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ ...PHONE, baseURL, serviceWorkers: "block" });
    await copySession(browser, context, baseURL!, "Admin");
    const page = await context.newPage();
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
    await context.close();
  });
}
