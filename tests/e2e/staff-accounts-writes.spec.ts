import { expect, test } from "@playwright/test";
import { postRequest } from "./helpers/community";
import { button, field, main, newBuyer, signInAsSample, signUp } from "./helpers/messaging";
import { browseFor, cardsFor, notFoundHeading, POST_LANDS, publishListing, uniqueWord } from "./helpers/selling";
import { signedInPage, staffNotice } from "./helpers/staff";
import {
  copySession,
  giveRole,
  hideListingByReport,
  hideRequestByReport,
  STAFF_404_IS_REAL,
} from "./helpers/staff-accounts";

// Stage J's end to end (plan Task 13a; spec section 9). These run last, in the staff-accounts-writes project, because
// they give roles and hide and show listings and requests other tests could see. Role tests use fresh accounts and never
// change the sample staff; hide and show use a fresh listing and a fresh request (plan decision 21).

test("an admin gives a fresh account the mentor role by email, and takes it away through its confirm page (spec 2.3 to 2.7)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const student = newBuyer();
  await signUp(page, student);

  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/staff");
  await expect(main(admin).getByRole("heading", { level: 1, name: "Staff accounts" })).toBeVisible();
  await expect(admin).toHaveTitle("Staff accounts · CampusCart");
  // The email's case doesn't matter: it's matched exactly once normalised (spec decision 3).
  await giveRole(admin, student.email.toUpperCase(), "Mentor");
  const row = main(admin).getByRole("row").filter({ hasText: student.email });
  await expect(row).toContainText("Mentor");

  // The person is told, and their tools are on their account page at their next page load.
  await page.goto("/notifications");
  await expect(
    main(page)
      .getByText("You're a CampusCart mentor now. The Hub's tools and the mentor dashboard are on your account page.")
      .filter({ visible: true }),
  ).toBeVisible();
  await page.goto("/account");
  await expect(main(page).getByRole("link", { name: "Mentor dashboard" })).toBeVisible();
  await expect(main(page).getByRole("link", { name: "Hub posts and office hours" })).toBeVisible();
  await page.goto("/mentor");
  await expect(main(page).getByRole("heading", { level: 1, name: "Mentor dashboard" })).toBeVisible();

  // Remove it through the confirm page. The link reads "Remove mentor role" and is named for the person (amendment 12).
  await row.getByRole("link", { name: `Remove mentor role for ${student.firstName}` }).click();
  await expect(
    main(admin).getByRole("heading", { level: 1, name: `Remove ${student.firstName}'s mentor role` }),
  ).toBeVisible();
  await expect(main(admin)).toContainText(`${student.firstName} mentors no shops.`);
  await expect(field(admin, "Reason")).toHaveCount(0);
  await button(admin, `Remove ${student.firstName}'s mentor role`).click();
  await expect(staffNotice(admin)).toHaveText("Role removed. They've been told.", POST_LANDS);
  await expect(main(admin).getByRole("row").filter({ hasText: student.email })).toHaveCount(0);

  // The log has both, under Staff accounts.
  await admin.goto("/admin/audit?kind=staff");
  const logged = main(admin).getByRole("row").filter({ hasText: student.firstName });
  await expect(logged.filter({ hasText: "Gave a staff role" })).toHaveCount(1);
  await expect(logged.filter({ hasText: "Removed a staff role" })).toHaveCount(1);
  await admin.context().close();

  await page.goto("/notifications");
  await expect(
    main(page)
      .getByText("Your mentor role on CampusCart has ended. Thank you for helping student sellers.")
      .filter({ visible: true }),
  ).toBeVisible();
  if (STAFF_404_IS_REAL) expect((await page.request.get("/mentor", { maxRedirects: 0 })).status()).toBe(404);
  await page.goto("/mentor");
  await expect(notFoundHeading(page)).toBeVisible();
});

test("the admin's own row has no Remove admin role, and an unknown email keeps what was typed, the summary focused (spec 2.3, 2.5 and 7)", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  // Without the app's JavaScript: a page load is what focuses the error summary (plan decision 21). The bundle never
  // arrives; React's small inline script still puts streamed content in place, as in accounts.spec.ts.
  const context = await browser.newContext({ baseURL, serviceWorkers: "block" });
  await context.route("**/_next/static/**/*.js", (route) => route.abort());
  await copySession(browser, context, baseURL!, "Admin");
  const admin = await context.newPage();
  await admin.goto("/admin/staff");
  const own = main(admin).getByRole("row").filter({ hasText: "admin@eduvos.com" });
  await expect(own).toContainText("This is you.");
  await expect(own.getByRole("link", { name: /^Remove admin role/ })).toHaveCount(0);

  const unknown = `nobody-${uniqueWord()}@eduvos.com`;
  await field(admin, "Eduvos email").fill(unknown);
  await main(admin).getByRole("radio", { name: "Admin", exact: true }).check();
  await button(admin, "Give role").click();
  const summary = main(admin).getByRole("alert", { name: "There's a problem" });
  await expect(summary).toContainText(
    "No CampusCart account uses that email. Ask them to sign in once, then try again.",
    POST_LANDS,
  );
  await expect(summary).toBeFocused();
  await expect(field(admin, "Eduvos email")).toHaveValue(unknown);
  await expect(main(admin).getByRole("radio", { name: "Admin", exact: true })).toBeChecked();
  // The address isn't in the link.
  expect(admin.url()).not.toContain("nobody");
  await context.close();
});

// The listing stays published: harmless with a fresh server per run; with E2E_REUSE_SERVER=1, Tech corner's and
// browse's counts drift, as after selling-writes and alerts-writes. There is no delete flow. No other project's counts
// are affected: this project runs last, and the listing is a fresh uniqueWord() one (plan amendment 11).
test("a hidden listing is shown again from /admin/hidden: back in browse and on its page, its seller told, its report still closed (spec 2.14)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const word = uniqueWord();
  const title = `Desk fan ${word}`;
  const seller = await signedInPage(browser, baseURL!, "Seller, Tech corner", "/sell");
  const id = await publishListing(seller, title);
  await signUp(page, newBuyer());
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
  await hideListingByReport(page, admin, id, title);
  await page.goto(browseFor(word));
  await expect(page.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeVisible();

  // Today's Waiting list has a Hidden row, which opens the list; the list has it.
  await admin.goto("/admin");
  await main(admin).getByRole("list", { name: "Waiting" }).getByRole("link", { name: /Hidden by the Hub/ }).click();
  await expect(admin).toHaveURL(/\/admin\/hidden$/);
  const row = main(admin).getByRole("row").filter({ hasText: title });
  await expect(row).toContainText("Tech corner");
  await expect(row).toContainText("Hidden while the Hub checks it.");
  // The link reads "Show again" and is named for the listing by its aria-label (amendment 12).
  await row.getByRole("link", { name: `Show again: ${title}`, exact: true }).click();
  await expect(main(admin).getByRole("heading", { level: 1, name: `Show ${title} again` })).toBeVisible();
  await expect(main(admin)).toContainText("To hide it again, someone has to report it.");
  await button(admin, `Show ${title} again`).click();
  await expect(staffNotice(admin)).toHaveText("Showing again. Its seller has been told.", POST_LANDS);
  await expect(main(admin).getByRole("row").filter({ hasText: title })).toHaveCount(0);

  // Back for buyers: browse (its counts read again) and its own page.
  await page.goto(browseFor(word));
  await expect(cardsFor(page, word)).toHaveCount(1);
  await page.goto(`/listings/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // The seller is told; the report still reads closed, as hidden.
  await seller.goto("/notifications");
  await expect(
    main(seller).getByText(`The Hub is showing ${title} again. It's back in My listings.`).filter({ visible: true }),
  ).toBeVisible();
  await admin.goto("/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
  await expect(main(admin)).toContainText(/Listing hidden on .+ by Pieter\./);
  await admin.context().close();
  await seller.context().close();
});

test("a hidden Looking For request is shown again from its report's page: back on the board, its asker told (spec 2.14)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  await signUp(page, newBuyer());
  const title = `Lab coat ${uniqueWord()}`;
  const id = await postRequest(page, title);
  const reporting = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const reporter = await reporting.newPage();
  await signUp(reporter, newBuyer());
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
  await hideRequestByReport(reporter, admin, id, title);
  await page.goto(`/looking-for/${id}`);
  await expect(notFoundHeading(page)).toBeVisible();

  // The closed report's page offers Show it again beside the hidden line (plan decision 18).
  await admin.goto("/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
  await expect(main(admin)).toContainText("Students can't see this request: the Hub has hidden it.");
  await main(admin).getByRole("link", { name: "Show it again" }).click();
  await expect(admin).toHaveURL(new RegExp(`/admin/hidden/requests/${id}$`));
  await button(admin, `Show ${title} again`).click();
  await expect(staffNotice(admin)).toHaveText("Showing again. The asker has been told.", POST_LANDS);
  await admin.context().close();
  await reporting.close();

  // Back on its page and the board (newest first, so near the top), and the asker is told.
  await page.goto(`/looking-for/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await page.goto("/looking-for");
  await expect(page.getByRole("heading", { level: 3, name: title })).toBeVisible();
  await page.goto("/notifications");
  await expect(
    main(page).getByText(`The Hub is showing your request ${title} again.`).filter({ visible: true }),
  ).toBeVisible();
});

test("the numbers: both tables, a campus view and the key, and the 404 page for a student (spec 2.9 to 2.13)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/numbers");
  await expect(main(admin).getByRole("heading", { level: 1, name: "Last week" })).toBeVisible();
  await expect(admin).toHaveTitle("Last week · CampusCart");
  await expect(main(admin).getByRole("table", { name: "All campuses, by week" })).toBeVisible();
  await expect(main(admin).getByRole("table", { name: /^By campus, last week \(/ })).toBeVisible();
  await expect(main(admin).getByText(/^Hidden: not shown by campus/).first()).toBeVisible();
  await main(admin).getByRole("link", { name: "Midrand", exact: true }).click();
  await expect(admin).toHaveURL(/\/admin\/numbers\?campus=midrand$/);
  await expect(main(admin).getByRole("table", { name: "Midrand, by week" })).toBeVisible();
  await main(admin).getByRole("link", { name: "All campuses", exact: true }).click();
  await expect(main(admin).getByRole("table", { name: "All campuses, by week" })).toBeVisible();
  await admin.context().close();

  await signInAsSample(page, "Student, Midrand", "/account");
  if (STAFF_404_IS_REAL) expect((await page.request.get("/admin/numbers", { maxRedirects: 0 })).status()).toBe(404);
  await page.goto("/admin/numbers");
  await expect(notFoundHeading(page)).toBeVisible();
});
