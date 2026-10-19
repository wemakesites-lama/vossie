import { expect, test } from "@playwright/test";
import { button, field, main, newBuyer, signUp, signUpHere } from "./helpers/messaging";
import {
  browseFor,
  cardsFor,
  fillListing,
  idOfEditLink,
  notFoundHeading,
  POST_LANDS,
  publishListing,
  uniqueWord,
} from "./helpers/selling";
import { aMonthFromNow, applyToSell, newShopName, reviewShop, signedInPage, staffNotice } from "./helpers/staff";

// These run in the staff-writes project, after every other test, selling's writes included (staff tools plan decision
// 21): what they change shows on pages other tests count. Each acts only on what it makes: its own students, shops,
// listings, reports and posts, found by a word no other test uses. The exceptions are a pin on a campus no other test
// checks, and a pickup point of its own that Tech corner's seller adds to the shop.

test("an admin verifies a new shop: Verified on its storefront and in the Hub's Verified sellers (spec 2.3)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const shopName = newShopName();
  await applyToSell(page, shopName);
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
  const slug = await reviewShop(admin, shopName);
  await button(admin, `Approve ${shopName}`).click();
  await expect(staffNotice(admin)).toContainText("Approved.", POST_LANDS);
  // An approved shop isn't Verified until the Hub says so (spec 2.3).
  await admin.goto(`/sellers/${slug}`);
  await expect(admin.getByRole("heading", { level: 1, name: shopName })).toBeVisible();
  await expect(admin.locator(".seller-stamps li").filter({ visible: true }).filter({ hasText: "Verified" })).toHaveCount(0);
  await reviewShop(admin, shopName);
  await button(admin, `Verify ${shopName}`).click();
  await expect(staffNotice(admin)).toHaveText("Verified. The tick shows on the shop and its listings.", POST_LANDS);

  await admin.goto(`/sellers/${slug}`);
  await expect(admin.locator(".seller-stamps li").filter({ visible: true }).filter({ hasText: "Verified" })).toHaveCount(1);
  await admin.goto("/hub");
  await expect(
    admin.getByRole("region", { name: "Verified by the Hub" }).getByRole("link", { name: new RegExp(shopName) }),
  ).toBeVisible();

  // The owner is told, and the audit log has it.
  await page.goto("/notifications");
  await expect(main(page).getByText(`${shopName} is now Verified by the Hub.`).filter({ visible: true })).toBeVisible();
  await admin.goto("/admin/audit?kind=shops");
  await expect(main(admin).getByRole("row").filter({ hasText: shopName }).filter({ hasText: "Verified a shop" })).toBeVisible();

  // Taking it away puts everything back.
  await reviewShop(admin, shopName);
  await button(admin, `Remove Verified from ${shopName}`).click();
  await expect(staffNotice(admin)).toHaveText("Verified is off. The tick has gone from the shop and its listings.", POST_LANDS);
  await admin.context().close();
});

test("an admin hides a reported listing: gone from browse and its page, marked for its seller, the reporter told (spec 2.3)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const word = uniqueWord();
  const title = `Desk lamp ${word}`;
  const seller = await signedInPage(browser, baseURL!, "Seller, Tech corner", "/sell");
  const id = await publishListing(seller, title);
  await page.goto(browseFor(word));
  await expect(cardsFor(page, word)).toHaveCount(1);

  await signUp(page, newBuyer());
  await page.goto(`/report?listing=${id}`);
  await main(page).getByRole("radio", { name: "Prohibited item" }).check();
  await button(page, "Send report").click();
  await expect(page).toHaveURL(new RegExp(`/report/sent\\?listing=${id}$`), POST_LANDS);

  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).click();
  await main(admin).getByRole("link", { name: `Hide ${title}` }).click();
  // A reason is required.
  await button(admin, `Hide ${title}`).click();
  await expect(main(admin).getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
  await field(admin, "Reason").fill("Lamps with bare wiring aren't allowed.");
  await button(admin, `Hide ${title}`).click();
  await expect(staffNotice(admin)).toHaveText("Hidden. Its seller and everyone who reported it have been told.", POST_LANDS);
  await admin.context().close();

  // Gone from browse (the empty page has drawn first), its own page, and the seller's storefront.
  await page.goto(browseFor(word));
  await expect(page.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeVisible();
  await expect(cardsFor(page, word)).toHaveCount(0);
  await page.goto(`/listings/${id}`);
  await expect(notFoundHeading(page)).toBeVisible();
  await page.goto("/notifications");
  await expect(main(page).getByText(`Thanks, we've acted on your report about ${title}.`).filter({ visible: true })).toBeVisible();

  // The seller still has it, marked, with the Hub's reason, and was told.
  await seller.goto("/sell/listings");
  await expect(main(seller).getByRole("listitem").filter({ hasText: title })).toContainText(
    "Hidden by the Hub: Lamps with bare wiring aren't allowed.",
  );
  await seller.goto("/notifications");
  await expect(main(seller).getByText(`The Hub hid ${title}. See why in My listings.`).filter({ visible: true })).toBeVisible();
  await seller.context().close();
});

test("an admin pauses the shop behind a report: its owner sees why with no Resume, and every reporter is told (spec 2.3)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const shopName = newShopName();
  const ownerContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const owner = await ownerContext.newPage();
  await applyToSell(owner, shopName);
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
  const slug = await reviewShop(admin, shopName);
  await button(admin, `Approve ${shopName}`).click();
  await expect(staffNotice(admin)).toContainText("Approved.", POST_LANDS);

  // Two students report the shop. Pausing it closes both reports (amendment 14.1).
  const first = newBuyer();
  await signUp(page, first);
  await page.goto(`/report?seller=${slug}`);
  await main(page).getByRole("radio", { name: "Scam or fraud" }).check();
  await button(page, "Send report").click();
  await expect(page).toHaveURL(/\/report\/sent/, POST_LANDS);
  const secondContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const second = await secondContext.newPage();
  await signUp(second, newBuyer());
  await second.goto(`/report?seller=${slug}`);
  await main(second).getByRole("radio", { name: "Harassment" }).check();
  await button(second, "Send report").click();
  await expect(second).toHaveURL(/\/report\/sent/, POST_LANDS);

  await admin.goto("/admin/reports");
  const row = main(admin).getByRole("row").filter({ hasText: first.firstName });
  await row.getByRole("link", { name: `Review the report about ${shopName}` }).click();
  await main(admin).getByRole("link", { name: `Pause ${shopName}` }).click();
  await field(admin, "Reason").fill("Asked buyers for a deposit.");
  await button(admin, `Pause ${shopName}`).click();
  await expect(staffNotice(admin)).toHaveText("Paused. The seller and everyone who reported it have been told.", POST_LANDS);
  // Both reports are closed, as "Shop paused".
  const closed = main(admin).getByRole("table", { name: "Closed recently" }).getByRole("row").filter({ hasText: shopName });
  await expect(closed).toHaveCount(2);
  await expect(closed.first()).toContainText("Shop paused");
  await admin.context().close();

  // The owner sees why and has no way to resume; buyers get the 404 where the shop was.
  await owner.goto("/sell");
  await expect(main(owner).getByText("Paused by the Hub: buyers can't see your listings").filter({ visible: true })).toBeVisible();
  await expect(main(owner).getByText("Asked buyers for a deposit.").filter({ visible: true })).toBeVisible();
  await expect(button(owner, "Resume my shop")).toHaveCount(0);
  await expect(button(owner, "Pause my shop")).toHaveCount(0);
  await ownerContext.close();
  await page.goto(`/sellers/${slug}`);
  await expect(notFoundHeading(page)).toBeVisible();

  // Each reporter hears that the Hub acted, and neither is told "didn't find a problem".
  for (const reporter of [page, second]) {
    await reporter.goto("/notifications");
    await expect(
      main(reporter).getByText(`Thanks, we've acted on your report about ${shopName}.`).filter({ visible: true }),
    ).toBeVisible();
    await expect(main(reporter).getByText(/didn't find a problem/)).toHaveCount(0);
  }
  await secondContext.close();
});

test("an admin pins a Verified seller to a campus for today, and that campus's homepage features them first (spec 2.8)", async ({
  page,
  browser,
  baseURL,
}) => {
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/featured");
  const row = main(admin)
    .getByRole("table", { name: "Featured today, by campus" })
    .getByRole("row")
    .filter({ hasText: "East London" });
  // Pin a Verified seller the day's draw didn't pick for East London, so the pin is what puts them in the row. The
  // row holds four of the nine, so one of these is always left.
  await expect(row).toBeVisible();
  const drawn = (await row.textContent()) ?? "";
  const candidates = [
    { name: "Nail bar", slug: "nail-bar" },
    { name: "Phone fix", slug: "phone-fix" },
    { name: "Study notes", slug: "study-notes" },
    { name: "Code coach", slug: "code-coach" },
    { name: "Thrift rack", slug: "thrift-rack" },
  ];
  const pinned = candidates.find((seller) => !drawn.includes(seller.name))!;
  // A server that has seen earlier pins for today puts them first, in the order they were made; a fresh one has none.
  const pinsBefore = (drawn.match(/\(pinned\)/g) ?? []).length;
  await field(admin, "Seller").selectOption({ label: pinned.name });
  await field(admin, "Campus").selectOption({ label: "East London" });
  await button(admin, "Pin the seller").click();
  await expect(staffNotice(admin)).toHaveText("Pinned. They take one of the four places that day.", POST_LANDS);
  await expect(row).toContainText(`${pinned.name} (pinned)`);
  await admin.context().close();

  // Visitors who chose East London see the pinned seller first (after any pinned before).
  await page.context().addCookies([{ name: "vossie_campus", value: "east-london", url: baseURL! }]);
  await page.goto("/");
  await expect(page.locator("#featured").getByRole("article").nth(pinsBefore).getByRole("link")).toHaveAttribute(
    "href",
    `/sellers/${pinned.slug}`,
  );
});

test("an admin retires a pickup point: a listing on it says it's no longer used, and the forms stop offering it (spec 2.3)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const word = uniqueWord();
  const point = `Gate ${word}`;
  const title = `Heater ${word}`;

  // The Hub adds a point at Midrand. Tech corner's seller adds it to the shop and lists something to collect there.
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/pickup-points");
  await field(admin, "New pickup point at Midrand").fill(point);
  await button(admin, "Add to Midrand").click();
  await expect(staffNotice(admin)).toHaveText("Pickup point added.", POST_LANDS);

  const seller = await signedInPage(browser, baseURL!, "Seller, Tech corner", "/sell/profile");
  await main(seller).getByRole("checkbox", { name: point }).check();
  await button(seller, "Save changes").click();
  await expect(main(seller).getByRole("status")).toHaveText("Your shop is saved.", POST_LANDS);
  await seller.goto("/sell/listings/new");
  await fillListing(seller, title);
  await field(seller, "Pickup point").selectOption({ label: point });
  await button(seller, "Save and publish").click();
  await expect(seller).toHaveURL(/\/sell\/listings$/, POST_LANDS);
  const id = await idOfEditLink(seller, title);

  const collect = (suffix: string) =>
    page.getByText(`Collect at Midrand · ${point}${suffix}`, { exact: true }).filter({ visible: true });
  await page.goto(`/listings/${id}`);
  await expect(collect("")).toBeVisible();

  // Retired: the listing keeps the point and says so. The first visit afterwards can still show the cached words for
  // one request (amendment 13.10), so reload until the new ones show (amendment 15.8).
  await button(admin, `Retire ${point} at Midrand`).click();
  await expect(staffNotice(admin)).toHaveText("Retired. Listings that use it keep it, marked no longer used.", POST_LANDS);
  await expect(async () => {
    await page.reload();
    await expect(collect(" (no longer used)")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  // The seller's forms don't offer it any more (Library entrance is still there, so the page has drawn).
  await seller.goto("/sell/profile");
  await expect(main(seller).getByRole("checkbox", { name: "Library entrance" })).toBeVisible();
  await expect(main(seller).getByRole("checkbox", { name: point })).toHaveCount(0);

  // Use it again: the words go back.
  await admin.goto("/admin/pickup-points");
  await button(admin, `Use ${point} at Midrand again`).click();
  await expect(staffNotice(admin)).toHaveText("It's in use again.", POST_LANDS);
  await expect(async () => {
    await page.reload();
    await expect(collect("")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await admin.context().close();
  await seller.context().close();
});

test("a mentor publishes an event and office hours; a student RSVPs and asks for a slot; the mentor accepts (spec 2.4 and 2.5)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const word = uniqueWord();
  const day = aMonthFromNow();
  const mentor = await signedInPage(browser, baseURL!, "Mentor", "/hub/manage");

  // An event for every campus, with two places, checked in Preview first (plan decision 12).
  await main(mentor).getByRole("link", { name: "Write a post" }).click();
  await main(mentor).getByRole("radio", { name: "Event" }).check();
  await field(mentor, "Title").fill(`Market ${word}`);
  await field(mentor, "Date").fill(day);
  await field(mentor, "Start time").fill("18:00");
  await field(mentor, "Place").fill("The Hub, Block C");
  await field(mentor, "Places (events only)").fill("2");
  await field(mentor, "Summary").fill("Sell what you make.");
  await field(mentor, "The post").fill("## Bring\n- A table");
  await button(mentor, "Preview").click();
  await expect(main(mentor).getByRole("region", { name: "Preview" }).getByRole("heading", { name: "Bring" })).toBeVisible(
    POST_LANDS,
  );
  await expect(field(mentor, "Title")).toHaveValue(`Market ${word}`);
  await button(mentor, "Save the post").click();
  await expect(mentor).toHaveURL(/\/hub\/manage$/, POST_LANDS);
  await expect(staffNotice(mentor)).toHaveText("Published. It's on the Hub's feed.");

  // Office hours at Midrand.
  await main(mentor).getByRole("link", { name: "Write a post" }).click();
  await main(mentor).getByRole("radio", { name: "Office hours" }).check();
  await field(mentor, "Title").fill(`Office hours ${word}`);
  await field(mentor, "Campus").selectOption({ label: "Midrand" });
  await field(mentor, "Date").fill(day);
  await field(mentor, "Start time").fill("13:00");
  await field(mentor, "Place").fill("The Hub, Block C");
  await field(mentor, "Summary").fill("Bring your prices.");
  await field(mentor, "The post").fill("Twenty minutes each.");
  await button(mentor, "Save the post").click();
  await expect(staffNotice(mentor)).toHaveText("Published. It's on the Hub's feed.", POST_LANDS);

  // The event is on the feed; RSVP goes through sign-in and back, then counts.
  await page.goto("/hub?type=events");
  await page.getByRole("link", { name: `Market ${word}` }).click();
  await page.getByRole("link", { name: "RSVP" }).click();
  const buyer = newBuyer();
  await signUpHere(page, buyer);
  await expect(page).toHaveURL(/\/hub\/h-[0-9a-f-]{36}$/, POST_LANDS);
  await button(page, "RSVP").click();
  await expect(main(page).getByText("You're going", { exact: true }).filter({ visible: true })).toBeVisible(POST_LANDS);
  // The feed it came from is kept hidden behind this page, with the same count on its card.
  await expect(main(page).getByText("1 going · 2 places").filter({ visible: true })).toBeVisible();

  // Office hours: Request a slot opens its page.
  await page.goto("/hub?type=office-hours");
  await page.getByRole("link", { name: `Office hours ${word}` }).click();
  await page.getByRole("link", { name: "Request a slot" }).click();
  await expect(page).toHaveURL(/\/hub\/h-[0-9a-f-]{36}\/book$/);
  await field(page, "What you'd like help with").fill(`Pricing my cakes ${word}`);
  await button(page, "Send request").click();
  await expect(main(page).getByRole("status")).toHaveText(
    "Request sent. A mentor will answer in your notifications.",
    POST_LANDS,
  );
  await expect(main(page).getByRole("region", { name: "Your request" })).toContainText("Waiting for a mentor.");

  // The mentor accepts, and the student hears.
  await mentor.goto("/hub/manage");
  await button(mentor, `Accept ${buyer.firstName}'s request for Office hours ${word}`).click();
  await expect(staffNotice(mentor)).toHaveText("Accepted. The student has been told.", POST_LANDS);
  await mentor.context().close();
  await page.goto("/notifications");
  await expect(
    main(page).getByText(`A mentor accepted your slot request for Office hours ${word}.`).filter({ visible: true }),
  ).toBeVisible();
});
