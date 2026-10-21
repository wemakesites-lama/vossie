import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { fillRequest, NEW_REQUEST_URL, offersPanel } from "./helpers/community";
import { button, field, main, newBuyer, signUp } from "./helpers/messaging";
import { notFoundHeading, POST_LANDS, uniqueWord } from "./helpers/selling";
import { signedInPage, staffNotice } from "./helpers/staff";
import { copySession, giveRole } from "./helpers/staff-accounts";

// Stage L's end to end (spec sections 3 to 5; plan decision 26). They run last, in the housekeeping-writes project:
// the first gives the sample seller (Sipho, Tech corner's owner) the Admin role for its length and takes it away in a
// finally; the second posts requests as a fresh account. A built server's clock can't be moved, so the closing itself
// is unit-tested; here, the dates the asker is shown.

const OWN_SHOP_LINE =
  "This is your own shop, so another admin must make the Hub's decisions about it: approving, verifying, pausing, pinning and choosing its mentor.";
const VERIFY = /^(Verify|Remove Verified from) Tech corner$/;

/** Pieter takes Sipho's Admin role away again, so a rerun on the same server starts clean. */
async function removeSiphosAdminRole(pieter: Page) {
  await pieter.goto("/admin/staff");
  // The table streams in after the page loads: count only once it is there, or a left-over role is missed.
  await expect(main(pieter).getByRole("table", { name: /^Staff accounts/ })).toBeVisible(POST_LANDS);
  const remove = main(pieter)
    .getByRole("row")
    .filter({ hasText: "seller@eduvos.com" })
    .getByRole("link", { name: "Remove admin role for Sipho" });
  if ((await remove.count()) === 0) return;
  await remove.click();
  await button(pieter, "Remove Sipho's admin role").click();
  await expect(staffNotice(pieter)).toHaveText("Role removed. They've been told.", POST_LANDS);
  await expect(remove).toHaveCount(0);
}

test("an admin who owns a shop sees why in place of its controls, and a forged post changes nothing (spec section 3)", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const pieter = await signedInPage(browser, baseURL!, "Admin", "/admin/staff");
  let plain: BrowserContext | null = null;
  try {
    // An interrupted earlier run on the same server may have left Sipho an admin: start clean.
    await removeSiphosAdminRole(pieter);
    await giveRole(pieter, "seller@eduvos.com", "Admin");
    // The verify form as another admin's page draws it without the app's JavaScript: its fields, the Server Action's
    // own among them, are what a forged post or an old tab would send (plan decision 26).
    plain = await browser.newContext({ baseURL, serviceWorkers: "block" });
    await plain.route("**/_next/static/**/*.js", (route) => route.abort());
    await copySession(browser, plain, baseURL!, "Admin");
    const pieterPlain = await plain.newPage();
    await pieterPlain.goto("/admin/sellers/tech-corner");
    const verifyForm = main(pieterPlain)
      .locator("form")
      .filter({ has: pieterPlain.getByRole("button", { name: VERIFY }) });
    const fields = await verifyForm.evaluate((form) =>
      Object.fromEntries([...new FormData(form as HTMLFormElement)].map(([name, value]) => [name, String(value)])),
    );
    expect(fields.shop).toBe("tech-corner");
    const standing = (await main(pieterPlain).locator(".staff-standing").first().textContent()) ?? "";

    // Sipho, now an admin, on his own shop's review page.
    const sipho = await signedInPage(browser, baseURL!, "Seller, Tech corner", "/admin/sellers/tech-corner");
    await expect(main(sipho).getByRole("region", { name: "What you can do" })).toContainText(OWN_SHOP_LINE);
    await expect(main(sipho).getByRole("button", { name: VERIFY })).toHaveCount(0);
    await expect(main(sipho).getByRole("link", { name: "Pause Tech corner" })).toHaveCount(0);
    const mentor = main(sipho).getByRole("region", { name: "Mentor" });
    await expect(mentor.getByRole("combobox")).toHaveCount(0);
    await expect(mentor).toContainText("Tech corner");
    // Pieter is an admin too, so Sipho isn't the only one.
    await expect(main(sipho).getByText(/You're the only admin/)).toHaveCount(0);
    // axe on Sipho's view, at 1440 and at 390 (spec section 3, Tests).
    expect(await seriousIssues(sipho)).toEqual([]);
    await sipho.setViewportSize({ width: 390, height: 844 });
    await sipho.reload();
    await expect(main(sipho).getByRole("region", { name: "What you can do" })).toContainText(OWN_SHOP_LINE);
    expect(await seriousIssues(sipho)).toEqual([]);
    await sipho.setViewportSize({ width: 1440, height: 900 });

    // A forged verify: the form's own fields, sent with Sipho's session. It lands with the notice and changes nothing.
    const posted = await sipho.request.post("/admin/sellers/tech-corner", {
      multipart: fields,
      headers: { Origin: new URL(baseURL!).origin },
      maxRedirects: 0,
    });
    expect(posted.status(), "the Server Action ends with a redirect").toBeGreaterThanOrEqual(300);
    expect(posted.status()).toBeLessThan(400);
    await sipho.goto("/admin/sellers/tech-corner");
    await expect(staffNotice(sipho)).toHaveText("Nothing changed. It's your own shop, so another admin must do this.");
    await pieterPlain.reload();
    await expect(main(pieterPlain).locator(".staff-standing").first()).toHaveText(standing);

    // Nobody reads the mentors' notes about themselves: the shop's mentor page is the 404 for Sipho (spec 2.5).
    await sipho.goto("/mentor/tech-corner");
    await expect(notFoundHeading(sipho)).toBeVisible();
    await sipho.context().close();

    // Pieter, who doesn't own it, still has every control.
    await pieter.goto("/admin/sellers/tech-corner");
    await expect(main(pieter).getByRole("button", { name: VERIFY })).toBeVisible();
    await expect(main(pieter).getByRole("link", { name: "Pause Tech corner" })).toBeVisible();
    await expect(main(pieter).getByRole("region", { name: "Mentor" }).getByRole("combobox")).toBeVisible();
  } finally {
    await plain?.close().catch(() => {});
    await removeSiphosAdminRole(pieter).finally(() => pieter.context().close());
  }
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Today's date in South Africa, YYYY-MM-DD, as the server works it out. A run across SAST midnight may fail: rerun. */
const sastToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
const plusDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
/** "13 Nov", as the site writes a date. */
const dayMonth = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

test("Your requests says when each request will close itself: 3 days after its needed-by date, or 30 days on (spec section 4)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUp(page, newBuyer());
  const today = sastToday();
  const word = uniqueWord();
  const dated = `Desk lamp ${word}`;
  const undated = `Kettle ${word}`;

  await page.goto("/looking-for/new");
  await fillRequest(page, dated);
  await field(page, "Needed by (optional)").fill(plusDays(today, 7));
  await button(page, "Post request").click();
  await expect(page).toHaveURL(NEW_REQUEST_URL, POST_LANDS);
  await expect(offersPanel(page)).toContainText(`Closes automatically on ${dayMonth(plusDays(today, 11))}.`);

  await page.goto("/looking-for/new");
  await fillRequest(page, undated);
  await button(page, "Post request").click();
  await expect(page).toHaveURL(NEW_REQUEST_URL, POST_LANDS);
  await expect(offersPanel(page)).toContainText(`Closes automatically on ${dayMonth(plusDays(today, 30))}.`);

  await page.goto("/account/requests");
  const item = (title: string) => main(page).getByRole("listitem").filter({ hasText: title });
  await expect(item(dated)).toContainText(`Closes automatically on ${dayMonth(plusDays(today, 11))}.`);
  await expect(item(undated)).toContainText(`Closes automatically on ${dayMonth(plusDays(today, 30))}.`);

  // The sample requests never close themselves: the board still shows the first, needed by 16 October 2026.
  await page.goto("/looking-for");
  await expect(main(page).getByText("Accounting 1 tutor this week", { exact: true }).first()).toBeVisible();
});

test("the sitemap offers only open requests, tips, and events from today on, and the rest keep their pages (spec section 5)", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const paths = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  // The Hub open day of 16 September 2026 has passed; the two sample requests seeded as closed are closed.
  for (const path of ["/hub/h-011", "/looking-for/r-015", "/looking-for/r-016"]) expect(paths, path).not.toContain(path);
  // A tip doesn't date; a sample request never closes itself.
  for (const path of ["/hub/h-013", "/looking-for/r-001"]) expect(paths, path).toContain(path);
  // Their pages still answer.
  expect((await request.get("/looking-for/r-015")).status()).toBe(200);
  expect((await request.get("/hub/h-011")).status()).toBe(200);
});
