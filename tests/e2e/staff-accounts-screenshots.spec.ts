import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { postRequest } from "./helpers/community";
import { button, main, newBuyer, signInAsSample, signUp } from "./helpers/messaging";
import { POST_LANDS, uniqueWord } from "./helpers/selling";
import { signedInPage } from "./helpers/staff";
import { DESKTOP, hideRequestByReport, PHONE } from "./helpers/staff-accounts";

// Review screenshots for stage J (plan Task 14), at 390 and 1440px, into docs/progress/staff-accounts/. The file name
// matches the staff-accounts-writes project's testMatch, so it runs there, last, and only with SCREENSHOTS=1. It hides
// one fresh request of its own for the hidden list and its Show again page. Both sizes run in this one test, one after
// the other, and the request's title carries uniqueWord(), so nothing it makes matches another test's words.
test.skip(!process.env.SCREENSHOTS, "Run with SCREENSHOTS=1 to refresh the review screenshots");

const OUT = "docs/progress/staff-accounts";
const SIZES = [
  ["390", PHONE],
  ["1440", DESKTOP],
] as const;

test("review screenshots of staff accounts, the numbers and the hidden list (stage J spec section 9)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  await mkdir(OUT, { recursive: true });
  await signUp(page, newBuyer());
  const title = `Lab coat ${uniqueWord()}`;
  const id = await postRequest(page, title);
  const reporting = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const reporter = await reporting.newPage();
  await signUp(reporter, newBuyer());
  const hider = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
  await hideRequestByReport(reporter, hider, id, title);
  await hider.context().close();
  await reporting.close();

  // [file name, path, the page's H1, something only the real content has (so no skeleton is captured)]
  const shots: ReadonlyArray<[name: string, path: string, heading: string, content: RegExp | string]> = [
    ["overview", "/admin", "Overview", "Hidden by the Hub"],
    ["staff", "/admin/staff", "Staff", "Give a staff role"],
    ["remove-mentor", "/admin/staff/acc-mentor/remove-mentor", "Remove Naledi's mentor role", "Remove Naledi's mentor role"],
    ["remove-own-admin", "/admin/staff/acc-admin/remove-admin", "Your admin role", "Back to staff accounts"],
    ["numbers", "/admin/numbers", "Numbers", "All campuses, by week"],
    ["numbers-midrand", "/admin/numbers?campus=midrand", "Numbers", "Midrand, by week"],
    ["hidden", "/admin/hidden", "Hidden listings and requests", title],
    ["show-request-again", `/admin/hidden/requests/${id}`, `Show ${title} again`, `Show ${title} again`],
  ];
  for (const [size, device] of SIZES) {
    const context = await browser.newContext({ ...device, baseURL, serviceWorkers: "block" });
    const admin = await context.newPage();
    await signInAsSample(admin, "Admin", "/admin");
    for (const [name, path, heading, content] of shots) {
      await admin.goto(path);
      await expect(main(admin).getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(main(admin).getByText(content).first()).toBeVisible();
      await expect(admin.locator(".skeleton")).toHaveCount(0);
      await admin.evaluate(() => window.scrollTo(0, 0));
      await admin.screenshot({ path: `${OUT}/${name}-${size}.png`, fullPage: true });
    }
    // Give role with nothing typed: the summary and both fields' errors.
    await admin.goto("/admin/staff");
    await button(admin, "Give role").click();
    await expect(main(admin).getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
    await expect(admin.locator(".skeleton")).toHaveCount(0);
    await admin.evaluate(() => window.scrollTo(0, 0));
    await admin.screenshot({ path: `${OUT}/staff-errors-${size}.png`, fullPage: true });
    await context.close();
  }
});
