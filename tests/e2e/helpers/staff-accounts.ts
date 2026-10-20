import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { button, field, main, signInAsSample } from "./messaging";
import { POST_LANDS } from "./selling";
import { staffNotice } from "./staff";

// Shared by stage J's end-to-end tests (stage J plan, Task 13). Every test shares one server and one sample store;
// these run last, in the staff-accounts-writes project, and each acts only on accounts, listings and requests it makes.

/**
 * Whether staff pages answer a real 404 and 307 (stage J plan decision 1). Task 1's spike failed, so staff pages keep
 * stage G's pattern, where the 404 page and the sign-in redirect stream in with status 200: false, and the status
 * checks skip.
 */
export const STAFF_404_IS_REAL = false;

/** Every admin console page, with ids that match nothing where a page needs one: the role is checked first. */
export const ADMIN_PAGES: readonly string[] = [
  "/admin",
  "/admin/sellers",
  "/admin/sellers/tech-corner",
  "/admin/sellers/crochet-corner/decline",
  "/admin/sellers/tech-corner/pause",
  "/admin/reports",
  "/admin/reports/rep-sample",
  "/admin/reports/rep-sample/hide",
  "/admin/reports/rep-sample/pause",
  "/admin/featured",
  "/admin/pickup-points",
  "/admin/audit",
  "/admin/numbers",
  "/admin/staff",
  "/admin/staff/acc-mentor/remove-mentor",
  "/admin/staff/acc-admin/remove-admin",
  "/admin/hidden",
  "/admin/hidden/listings/l-001",
  "/admin/hidden/requests/r-001",
];

/** The Hub's tools and the mentor dashboard. */
export const HUB_AND_MENTOR_PAGES: readonly string[] = [
  "/hub/manage",
  "/hub/new",
  "/hub/h-003/edit",
  "/mentor",
  "/mentor/tech-corner",
];

/** A phone, as the device projects' phone-390 is. */
export const PHONE = {
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

/** A desktop, as desktop-1440 is. */
export const DESKTOP = { viewport: { width: 1440, height: 900 } };

/** Signs `context` in through another browser, copying only the session cookie across, so nothing is cached yet. */
export async function copySession(
  browser: Browser,
  context: BrowserContext,
  baseURL: string,
  label: string,
): Promise<void> {
  const other = await browser.newContext({ baseURL, serviceWorkers: "block" });
  await signInAsSample(await other.newPage(), label, "/account");
  await context.addCookies((await other.cookies()).filter((cookie) => cookie.name === "vossie_session"));
  await other.close();
}

/** As `admin`, gives the account with this email a role on /admin/staff, and waits for the notice. */
export async function giveRole(admin: Page, email: string, role: "Mentor" | "Admin"): Promise<void> {
  await admin.goto("/admin/staff");
  await field(admin, "Eduvos email").fill(email);
  await main(admin).getByRole("radio", { name: role, exact: true }).check();
  await button(admin, "Give role").click();
  await expect(staffNotice(admin)).toHaveText(
    "Role given. They've been told, and their tools are on their account page.",
    POST_LANDS,
  );
}

/** As `reporter`, reports a listing; then, as `admin`, hides it from the report's confirm page. */
export async function hideListingByReport(reporter: Page, admin: Page, id: string, title: string): Promise<void> {
  await reporter.goto(`/report?listing=${id}`);
  await main(reporter).getByRole("radio", { name: "Prohibited item" }).check();
  await button(reporter, "Send report").click();
  await expect(reporter).toHaveURL(new RegExp(`/report/sent\\?listing=${id}$`), POST_LANDS);
  await admin.goto("/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
  await main(admin).getByRole("link", { name: `Hide ${title}` }).click();
  await field(admin, "Reason").fill("Hidden while the Hub checks it.");
  await button(admin, `Hide ${title}`).click();
  await expect(staffNotice(admin)).toHaveText(
    "Hidden. Its seller and everyone who reported it have been told.",
    POST_LANDS,
  );
}

/** As `reporter`, reports a Looking For request; then, as `admin`, hides it from the report's confirm page. */
export async function hideRequestByReport(reporter: Page, admin: Page, id: string, title: string): Promise<void> {
  await reporter.goto(`/report?request=${id}`);
  await main(reporter).getByRole("radio", { name: "Prohibited item" }).check();
  await button(reporter, "Send report").click();
  await expect(reporter).toHaveURL(/\/report\/sent/, POST_LANDS);
  await admin.goto("/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
  await main(admin).getByRole("link", { name: `Hide ${title}` }).click();
  await field(admin, "Reason").fill("Hidden while the Hub checks it.");
  await button(admin, `Hide ${title}`).click();
  await expect(staffNotice(admin)).toHaveText(
    "Hidden. The asker and everyone who reported it have been told.",
    POST_LANDS,
  );
}
