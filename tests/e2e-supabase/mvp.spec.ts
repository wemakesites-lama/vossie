import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { fillRequest, statusLine } from "../e2e/helpers/community";
import { button, field, main, settled, statusPill } from "../e2e/helpers/messaging";
import { browseFor, cardsFor, fillListing, notFoundHeading, photoWithLocation, POST_LANDS, uniqueWord } from "../e2e/helpers/selling";
import { aMonthFromNow, staffNotice } from "../e2e/helpers/staff";
import { giveRole, hideListingByReport } from "../e2e/helpers/staff-accounts";
import { authUserId, latestCode, newAddress, removeE2eAccounts, resetNetworkCounts, sql } from "./helpers/local";

// The MVP cut for Task 23 (C4/C5 plan, "The MVP cut for Task 23"): twelve flows on the local stack, after
// `supabase db reset`, with `pnpm e2e:supabase`. Flows 2 to 11 run in order, sharing three fresh people per project
// (a seller, a buyer and the first admin, made by private.make_first_admin), each signed in once: local Auth allows 30
// codes and 30 checks per 5 minutes. Flows 1 and 12 stand alone. A failure is a bug in its module, fixed there with a
// contract or unit test first, never by changing an assertion here.

/** The project's device, for a browser of the serial block's own (the `page` fixture lasts one test). */
function deviceOf(info: TestInfo) {
  const use = info.project.use;
  return {
    baseURL: use.baseURL,
    locale: use.locale,
    timezoneId: use.timezoneId,
    viewport: use.viewport,
    screen: use.screen,
    deviceScaleFactor: use.deviceScaleFactor,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    userAgent: use.userAgent,
    serviceWorkers: "block" as const,
  };
}

/** A whole first sign-in by code (Mailpit) for a new address, ending on `next` (or /account). */
async function signUp(page: Page, email: string, firstName: string, next?: string) {
  // Every sign-in posts from this machine, one network: a fresh per-network count for each (phase B review fix 2).
  resetNetworkCounts();
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await field(page, "Your Eduvos email address").fill(email);
  await field(page, "I agree to the privacy policy").check();
  const asked = new Date();
  await button(page, "Send code").click();
  await field(page, "6-digit code").fill(await latestCode(email, asked));
  await button(page, "Sign in").click();
  await field(page, "Your first name").fill(firstName);
  await field(page, "Your campus").selectOption({ label: "Midrand" });
  await button(page, "Continue").click();
  await page.waitForURL((url) => url.pathname === (next ?? "/account"), POST_LANDS);
  await settled(page);
}

/** The id of the listing with this title, from its Edit link on My listings (Supabase's ids are short random text). */
async function listingIdOf(page: Page, title: string): Promise<string> {
  const edit = main(page).getByRole("link", { name: `Edit ${title}`, exact: true });
  await expect(edit).toBeVisible();
  return /^\/sell\/listings\/([a-z0-9-]+)\/edit$/.exec((await edit.getAttribute("href")) ?? "")![1];
}

/** Publishes a listing as the signed-in seller, with any photos, and gives back its id. */
async function publishListing(page: Page, title: string, photos: ReturnType<typeof photoWithLocation>[] = []) {
  await page.goto("/sell/listings/new");
  await fillListing(page, title);
  if (photos.length > 0) {
    await field(page, "Add photos").setInputFiles(photos);
    await expect(main(page).getByText(/^Your photos? (is|are) ready\.$/).filter({ visible: true })).toBeVisible();
  }
  await button(page, "Save and publish").click();
  await expect(page).toHaveURL(/\/sell\/listings$/, POST_LANDS);
  return listingIdOf(page, title);
}

/** Posts a Looking For request at Midrand as the signed-in student and gives back its id (short random text here). */
async function postRequest(page: Page, title: string): Promise<string> {
  await page.goto("/looking-for/new");
  await fillRequest(page, title);
  await button(page, "Post request").click();
  await expect(page).toHaveURL(/\/looking-for\/(?!new$)[a-z0-9-]+$/, POST_LANDS);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** A line on /notifications. */
const note = (page: Page, text: string | RegExp) => main(page).getByText(text).filter({ visible: true });

// Every test posts from this machine, one network (phase B review fix 2).
test.beforeEach(() => resetNetworkCounts());
test.afterAll(() => removeE2eAccounts(test.info().project.name));

test("flow 1: a signed-out visitor reads the homepage, browse, a listing, a storefront, Looking For and the Hub", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/CampusCart/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto(browseFor("Casio"));
  await expect(cardsFor(page, "Casio fx-991ZA Plus calculator")).toHaveCount(1);

  await page.goto("/listings/l-001");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Casio fx-991ZA Plus calculator");
  await expect(page.getByRole("link", { name: "Message seller" })).toBeVisible();

  await page.goto("/sellers/tech-corner");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tech corner");
  await expect(page.getByRole("heading", { level: 2, name: "2 listings" })).toBeVisible();
  await expect(page).toHaveTitle("Tech corner · CampusCart");

  await page.goto("/looking-for");
  await expect(page.getByRole("heading", { level: 1, name: "Looking For" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Accounting 1 tutor this week" })).toBeVisible();
  await page.goto("/looking-for/r-001");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accounting 1 tutor this week");

  await page.goto("/hub/h-001");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pitch night");
});

test.describe("flows 2 to 11, in order: a seller, a buyer and the first admin", () => {
  test.describe.configure({ mode: "serial" });

  let contexts: BrowserContext[] = [];
  let seller: Page;
  let buyer: Page;
  let admin: Page;
  const people = { seller: { email: "", firstName: "" }, buyer: { email: "", firstName: "" }, admin: { email: "", firstName: "" } };
  const made = { shopName: "", slug: "", listingId: "", listingTitle: "", requestId: "", requestTitle: "", eventTitle: "" };

  async function newPage(browser: Browser, info: TestInfo): Promise<Page> {
    const context = await browser.newContext(deviceOf(info));
    contexts.push(context);
    return context.newPage();
  }

  test.beforeAll(async ({ browser }, info) => {
    const word = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.replace(/[^a-z]/g, "").slice(-6);
    people.seller = { email: newAddress(info.project.name), firstName: `Zola ${word()}` };
    people.buyer = { email: newAddress(info.project.name), firstName: `Ayanda ${word()}` };
    people.admin = { email: newAddress(info.project.name), firstName: `Thandi ${word()}` };
    seller = await newPage(browser, info);
    buyer = await newPage(browser, info);
    admin = await newPage(browser, info);
  });

  test.afterAll(async () => {
    await Promise.all(contexts.map((context) => context.close().catch(() => {})));
    contexts = [];
  });

  test("flow 2: the first admin is made by make_first_admin; a student applies to sell, is approved and publishes a listing with a photo", async ({
    request,
  }) => {
    test.setTimeout(180_000);
    // The first admin: a fresh account, made admin outside the app (GO-LIVE; phase B runbook B11). It refuses while
    // any admin exists, so the seed's admins step aside for the call and get their role straight back.
    await signUp(admin, people.admin.email, people.admin.firstName);
    expect(sql(`select private.make_first_admin(:'email')`, { email: people.admin.email })).toEqual(["admin-exists"]);
    const others = sql(
      `with stepped as (update public.profiles set roles = array_remove(roles, 'admin') where 'admin' = any (roles) returning id)
       select id from stepped`,
    );
    try {
      expect(sql(`select private.make_first_admin(:'email')`, { email: people.admin.email.toUpperCase() })).toEqual(["made"]);
    } finally {
      sql(`update public.profiles set roles = array_append(roles, 'admin') where id::text = any (string_to_array(:'ids', ','))`, {
        ids: others.join(","),
      });
      expect(sql(`select count(*) from public.profiles where 'admin' = any (roles)`)).toEqual([String(others.length + 1)]);
    }
    await admin.goto("/account");
    await expect(main(admin).getByRole("link", { name: /Hub console/ }).first()).toBeVisible();
    await admin.goto("/admin/audit?kind=staff");
    await expect(
      main(admin).getByRole("row").filter({ hasText: "Set up outside CampusCart" }).filter({ hasText: people.admin.firstName }),
    ).toHaveCount(1);

    // A student applies to sell, through the five steps.
    made.shopName = `Bakes ${uniqueWord()}`.slice(0, 60);
    await signUp(seller, people.seller.email, people.seller.firstName, "/sell/onboarding");
    await field(seller, "Shop name").fill(made.shopName);
    await field(seller, "Main category").selectOption({ label: "Food" });
    await button(seller, "Continue").click();
    await expect(seller).toHaveURL(/step=2$/, POST_LANDS);
    await field(seller, "About your shop").fill("I bake between lectures.");
    await button(seller, "Continue").click();
    await expect(seller).toHaveURL(/step=3$/, POST_LANDS);
    await button(seller, "Continue").click();
    await expect(seller).toHaveURL(/step=4$/, POST_LANDS);
    await main(seller).getByRole("checkbox", { name: "Library entrance" }).check();
    await button(seller, "Continue").click();
    await expect(seller).toHaveURL(/step=5$/, POST_LANDS);
    await main(seller).getByRole("checkbox", { name: "I've read the seller guidelines" }).check();
    await button(seller, "Send for approval").click();
    await expect(seller).toHaveURL(/\/sell$/, POST_LANDS);

    // The admin approves it.
    await admin.goto("/admin/sellers");
    await main(admin).getByRole("link", { name: `Review ${made.shopName}` }).click();
    await expect(main(admin).getByRole("heading", { level: 1, name: made.shopName })).toBeVisible();
    made.slug = new URL(admin.url()).pathname.split("/").pop()!;
    await button(admin, `Approve ${made.shopName}`).click();
    await expect(staffNotice(admin)).toContainText("Approved.", POST_LANDS);

    // The seller publishes a listing with a photo; buyers find it with its photo, served without its hidden data.
    made.listingTitle = `Rusks ${uniqueWord()}`;
    made.listingId = await publishListing(seller, made.listingTitle, [photoWithLocation("rusks.png")]);
    await expect(main(seller).getByRole("status")).toContainText("Published. Buyers can find it now.");
    await buyer.goto(browseFor(made.listingTitle.split(" ")[1]));
    await expect(cardsFor(buyer, made.listingTitle)).toHaveCount(1);
    await buyer.goto(`/listings/${made.listingId}`);
    await expect(buyer.getByRole("heading", { level: 1 })).toHaveText(made.listingTitle);
    const cover = buyer.locator(".gallery img").first();
    await expect(cover).toHaveAttribute("alt", made.listingTitle);
    await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const src = decodeURIComponent(/url=([^&]+)/.exec((await cover.getAttribute("src")) ?? "")![1]);
    const photo = await request.get(src);
    expect(photo.status()).toBe(200);
    expect(photo.headers()["content-type"]).toBe("image/webp");
    expect((await photo.body()).toString("latin1")).not.toContain("GPS");
    await buyer.goto(`/sellers/${made.slug}`);
    await expect(buyer.getByRole("heading", { level: 1 })).toHaveText(made.shopName);
    await expect(cardsFor(buyer, made.listingTitle)).toHaveCount(1);
  });

  test("flow 3: a buyer messages the seller from the listing, and the seller replies", async () => {
    test.setTimeout(120_000);
    await signUp(buyer, people.buyer.email, people.buyer.firstName);
    await buyer.goto(`/listings/${made.listingId}/message`);
    await expect(main(buyer).getByRole("heading", { level: 1, name: `Message ${made.shopName}` })).toBeVisible();
    await field(buyer, "Your message").fill("Hi! Are the rusks still available?");
    await button(buyer, "Send").click();
    await expect(buyer).toHaveURL(/\/messages\/[a-z0-9-]+$/, POST_LANDS);
    const thread = new URL(buyer.url()).pathname;
    await expect(main(buyer).getByRole("status")).toHaveText("Sent. Sellers usually reply within a day.");
    await expect(statusPill(buyer, "Asked")).toBeVisible();

    await seller.goto("/messages?tab=selling");
    const row = main(seller).getByRole("link").filter({ hasText: people.buyer.firstName });
    await expect(row).toContainText(made.listingTitle);
    await expect(row).toContainText("Unread,");
    await row.click();
    await expect(seller).toHaveURL(new RegExp(`${thread}$`));
    await expect(main(seller).getByRole("heading", { level: 1, name: `Messages with ${people.buyer.firstName}` })).toBeVisible();
    await field(seller, "Your reply").fill("Yes, they are. Library entrance at 13:00?");
    await button(seller, "Send").click();
    await expect(main(seller).getByRole("listitem").filter({ hasText: "Library entrance at 13:00?" })).toContainText("You");
    await expect(statusPill(seller, "Replied")).toBeVisible();

    await buyer.goto(thread);
    await expect(main(buyer).getByRole("listitem").filter({ hasText: "Library entrance at 13:00?" })).toContainText(made.shopName);
    await expect(statusPill(buyer, "Replied")).toBeVisible();
  });

  test("flow 4: the buyer reports the listing, the admin hides it, then shows it again", async () => {
    test.setTimeout(150_000);
    await hideListingByReport(buyer, admin, made.listingId, made.listingTitle);
    await buyer.goto(`/listings/${made.listingId}`);
    await expect(notFoundHeading(buyer)).toBeVisible();
    await buyer.goto("/notifications");
    await expect(note(buyer, `Thanks, we've acted on your report about ${made.listingTitle}.`)).toBeVisible();
    await seller.goto("/sell/listings");
    await expect(main(seller).getByRole("listitem").filter({ hasText: made.listingTitle })).toContainText(
      "Hidden by the Hub: Hidden while the Hub checks it.",
    );

    await admin.goto("/admin/hidden");
    const row = main(admin).getByRole("row").filter({ hasText: made.listingTitle });
    await expect(row).toContainText(made.shopName);
    await row.getByRole("link", { name: `Show again: ${made.listingTitle}`, exact: true }).click();
    await expect(main(admin).getByRole("heading", { level: 1, name: `Show ${made.listingTitle} again` })).toBeVisible();
    await button(admin, `Show ${made.listingTitle} again`).click();
    await expect(staffNotice(admin)).toHaveText("Showing again. Its seller has been told.", POST_LANDS);
    await expect(main(admin).getByRole("row").filter({ hasText: made.listingTitle })).toHaveCount(0);

    await buyer.goto(`/listings/${made.listingId}`);
    await expect(buyer.getByRole("heading", { level: 1 })).toHaveText(made.listingTitle);
    await seller.goto("/notifications");
    await expect(note(seller, `The Hub is showing ${made.listingTitle} again. It's back in My listings.`)).toBeVisible();
  });

  test("flow 5: the buyer posts a Looking For request, and the seller's shop offers to help", async () => {
    test.setTimeout(120_000);
    made.requestTitle = `Cake stand ${uniqueWord()}`;
    made.requestId = await postRequest(buyer, made.requestTitle);
    await expect(buyer.getByRole("heading", { level: 1 })).toHaveText(made.requestTitle);
    await buyer.goto("/looking-for");
    await expect(buyer.getByRole("heading", { level: 3, name: made.requestTitle })).toBeVisible();

    await seller.goto(`/looking-for/${made.requestId}`);
    const offer = main(seller).getByRole("region", { name: "Offers" }).getByRole("link", { name: "Offer to help" });
    await expect(offer).toHaveAttribute("href", `/looking-for/${made.requestId}/offer`);
    await offer.click();
    await field(seller, "Your offer").fill("I have a cake stand you can borrow, at the library.");
    await button(seller, "Send offer").click();
    await expect(seller).toHaveURL(/\/messages\/[a-z0-9-]+$/, POST_LANDS);
    await expect(statusLine(seller)).toHaveText("Sent. The student who asked gets a notification.", POST_LANDS);
    await expect(main(seller).getByRole("heading", { level: 1 })).toHaveText("Messages with The student who asked");

    await buyer.goto("/notifications");
    await expect(
      main(buyer).getByRole("link", { name: new RegExp(`${made.shopName} offered to help with ${made.requestTitle}`) }),
    ).toBeVisible();
    await buyer.goto(`/looking-for/${made.requestId}`);
    await expect(main(buyer).getByRole("region", { name: "Offers" }).getByText("1 offer", { exact: true })).toBeVisible();
  });

  test("flow 6: the buyer follows the shop and saves a search; a new listing tells them both ways", async () => {
    test.setTimeout(120_000);
    await buyer.goto(`/sellers/${made.slug}`);
    await buyer.getByRole("button", { name: `Follow ${made.shopName}`, exact: true }).click();
    await expect(statusLine(buyer)).toHaveText(`You follow ${made.shopName}.`, POST_LANDS);
    await buyer.goto("/saved?tab=shops");
    await expect(main(buyer).getByRole("link", { name: new RegExp(made.shopName) })).toHaveAttribute("href", `/sellers/${made.slug}`);
    await seller.goto("/sell");
    // The seller home words the count as "1 follower" (role views N2, followerCountLabel).
    await expect(main(seller).locator(".sell-home-followers")).toHaveText("1 follower");

    const word = uniqueWord();
    await buyer.goto(`/browse?q=${word}&campus=midrand`);
    const save = main(buyer).locator(".save-search").filter({ visible: true });
    await save.getByRole("button", { name: "Save this search" }).click();
    await expect(save.getByRole("status")).toHaveText("Search saved.", POST_LANDS);

    const title = `Tea towel ${word}`;
    const id = await publishListing(seller, title);
    await buyer.goto("/notifications");
    await expect(main(buyer).getByRole("link", { name: `${made.shopName} listed ${title}` })).toBeVisible();
    const match = main(buyer).getByRole("link", { name: new RegExp(`match(es)? your search “${word}”`) });
    await expect(match).toHaveCount(1);
    await expect(match).toContainText(`${title} matches your search “${word}” at Midrand`);
    await match.click();
    await expect(buyer).toHaveURL(new RegExp(`/listings/${id}$`));
  });

  test("flow 7: the admin publishes a Hub event, the buyer RSVPs, and the RSVP is in their data download", async () => {
    test.setTimeout(150_000);
    made.eventTitle = `Market ${uniqueWord()}`;
    await admin.goto("/hub/manage");
    await main(admin).getByRole("link", { name: "Write a post" }).click();
    await main(admin).getByRole("radio", { name: "Event" }).check();
    await field(admin, "Title").fill(made.eventTitle);
    await field(admin, "Date").fill(aMonthFromNow());
    await field(admin, "Start time").fill("18:00");
    await field(admin, "Place").fill("The Hub, Block C");
    await field(admin, "Places (events only)").fill("2");
    await field(admin, "Summary").fill("Sell what you make.");
    await field(admin, "The post").fill("## Bring\n- A table");
    await button(admin, "Save the post").click();
    await expect(admin).toHaveURL(/\/hub\/manage$/, POST_LANDS);
    await expect(staffNotice(admin)).toHaveText("Published. It's on the Hub's feed.");

    await buyer.goto("/hub?type=events");
    await buyer.getByRole("link", { name: made.eventTitle }).click();
    await expect(buyer).toHaveURL(/\/hub\/[a-z0-9-]+$/);
    await button(buyer, "RSVP").click();
    await expect(main(buyer).getByText("You're going", { exact: true }).filter({ visible: true })).toBeVisible(POST_LANDS);
    await expect(main(buyer).getByText("1 going · 2 places").filter({ visible: true }).first()).toBeVisible();

    await buyer.goto("/account/privacy");
    const [download] = await Promise.all([
      buyer.waitForEvent("download"),
      main(buyer).getByRole("link", { name: "Download your data" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("campuscart-data.json");
    const data = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(data.hubRsvps).toEqual([{ event: made.eventTitle, at: expect.any(String) }]);
    expect(data.requests.map((row: { title: string }) => row.title)).toEqual([made.requestTitle]);
    expect(data.following).toHaveLength(1);
    expect(data.savedSearches).toHaveLength(1);
  });

  test("flow 8: the admin gives the seller the mentor role by email and takes it away; staff pages are the 404 without it", async () => {
    test.setTimeout(150_000);
    await buyer.goto("/admin");
    await expect(notFoundHeading(buyer)).toBeVisible();
    await expect(buyer).toHaveTitle(/Page not found/);

    await giveRole(admin, people.seller.email.toUpperCase(), "Mentor");
    const row = main(admin).getByRole("row").filter({ hasText: people.seller.email });
    await expect(row).toContainText("Mentor");
    await seller.goto("/notifications");
    await expect(
      note(seller, "You're a CampusCart mentor now. The Hub's tools and the mentor dashboard are on your account page."),
    ).toBeVisible();
    await seller.goto("/mentor");
    await expect(main(seller).getByRole("heading", { level: 1, name: "Mentor dashboard" })).toBeVisible();

    await row.getByRole("link", { name: `Remove mentor role for ${people.seller.firstName}` }).click();
    await expect(
      main(admin).getByRole("heading", { level: 1, name: `Remove ${people.seller.firstName}'s mentor role` }),
    ).toBeVisible();
    await button(admin, `Remove ${people.seller.firstName}'s mentor role`).click();
    await expect(staffNotice(admin)).toHaveText("Role removed. They've been told.", POST_LANDS);
    await seller.goto("/mentor");
    await expect(notFoundHeading(seller)).toBeVisible();
    await admin.goto("/admin/audit?kind=staff");
    const logged = main(admin).getByRole("row").filter({ hasText: people.seller.firstName });
    await expect(logged.filter({ hasText: "Gave a staff role" })).toHaveCount(1);
    await expect(logged.filter({ hasText: "Removed a staff role" })).toHaveCount(1);
  });

  test("flow 9: a second admin who owns a shop sees why in place of its controls", async () => {
    test.setTimeout(150_000);
    await giveRole(admin, people.seller.email, "Admin");
    try {
      await seller.goto(`/admin/sellers/${made.slug}`);
      await expect(main(seller).getByRole("region", { name: "What you can do" })).toContainText(
        "This is your own shop, so another admin must make the Hub's decisions about it: approving, verifying, pausing, pinning and choosing its mentor.",
      );
      await expect(main(seller).getByRole("button", { name: new RegExp(`^(Verify|Remove Verified from) ${made.shopName}$`) })).toHaveCount(0);
      await expect(main(seller).getByRole("link", { name: `Pause ${made.shopName}` })).toHaveCount(0);
      // The other admin still has every control.
      await admin.goto(`/admin/sellers/${made.slug}`);
      await expect(main(admin).getByRole("button", { name: `Verify ${made.shopName}` })).toBeVisible();
      await expect(main(admin).getByRole("link", { name: `Pause ${made.shopName}` })).toBeVisible();
    } finally {
      await admin.goto("/admin/staff");
      await main(admin)
        .getByRole("row")
        .filter({ hasText: people.seller.email })
        .getByRole("link", { name: `Remove admin role for ${people.seller.firstName}` })
        .click();
      await button(admin, `Remove ${people.seller.firstName}'s admin role`).click();
      await expect(staffNotice(admin)).toHaveText("Role removed. They've been told.", POST_LANDS);
    }
    await seller.goto(`/admin/sellers/${made.slug}`);
    await expect(notFoundHeading(seller)).toBeVisible();
  });

  test("flow 10: the numbers show last week's one report only through protectCounts", async () => {
    test.setTimeout(90_000);
    // The report from flow 4, moved into last week (Wednesday, SAST): the page counts only complete weeks.
    const moved = sql(
      `with moved as (
         update public.reports r set created_at =
           ((date_trunc('week', now() at time zone 'Africa/Johannesburg') - interval '5 days') at time zone 'Africa/Johannesburg')
         where r.reporter_id = (select id from auth.users where email = :'email') and r.target_id = :'listing'
         returning r.id)
       select id from moved`,
      { email: people.buyer.email, listing: made.listingId },
    );
    expect(moved).toHaveLength(1);
    await admin.goto("/admin/numbers");
    await expect(main(admin).getByRole("heading", { level: 1, name: "Last week" })).toBeVisible();
    const all = main(admin).getByRole("table", { name: "All campuses, by week" });
    // Last week, the week before, the change and since the start (each cell starts with its column's name for phones):
    // one report is "Under 5", so no change and no tens.
    await expect(all.getByRole("row").filter({ has: admin.getByRole("rowheader", { name: "Reports made" }) }).getByRole("cell")).toHaveText([
      /Under 5$/,
      /\)0$/,
      /—$/,
      /Hidden$/,
    ]);
    const byCampus = main(admin).getByRole("table", { name: /^By campus, last week \(/ });
    const headers = await byCampus.getByRole("columnheader").allTextContents();
    const column = headers.indexOf("Reports made");
    expect(column).toBeGreaterThan(0);
    const midrand = byCampus.getByRole("row").filter({ has: admin.getByRole("rowheader", { name: "Midrand" }) });
    await expect(midrand.getByRole("cell").nth(column - 1)).toHaveText(/Hidden$/);

    await buyer.goto("/admin/numbers");
    await expect(notFoundHeading(buyer)).toBeVisible();
  });

  test("flow 11: the buyer deletes their account: the Auth user, their request and their follow go", async ({ baseURL }) => {
    test.setTimeout(120_000);
    expect(authUserId(people.buyer.email)).not.toBeNull();
    await buyer.goto("/account/privacy");
    await field(buyer, "I understand this can't be undone").check();
    await button(buyer, "Delete my account").click();
    await expect(buyer).toHaveURL(`${baseURL}/`, POST_LANDS);
    await expect(buyer.locator(".toast")).toHaveText("Your account has been deleted");
    expect(authUserId(people.buyer.email)).toBeNull();

    await seller.goto(`/looking-for/${made.requestId}`);
    await expect(notFoundHeading(seller)).toBeVisible();
    await seller.goto("/sell");
    await expect(main(seller).locator(".sell-home-followers")).toHaveText("No followers yet");
    // The seller keeps their side of the conversation; the buyer's name is gone from it.
    await seller.goto("/messages?tab=selling");
    await expect(main(seller).getByRole("link").filter({ hasText: people.buyer.firstName })).toHaveCount(0);
  });
});

test("flow 12: both crons answer 401 without CRON_SECRET and 200 with it", async ({ request }) => {
  const secret = process.env.VOSSIE_E2E_CRON_SECRET;
  expect(secret, "playwright.supabase.config.ts sets it").toBeTruthy();
  for (const path of ["/api/cron/photos", "/api/cron/badges"]) {
    expect((await request.get(path)).status(), `${path} with no header`).toBe(401);
    expect((await request.get(path, { headers: { Authorization: `Bearer ${secret}x` } })).status(), `${path} with a wrong secret`).toBe(401);
    const answered = await request.get(path, { headers: { Authorization: `Bearer ${secret}` } });
    expect(answered.status(), `${path} with the secret`).toBe(200);
    expect(answered.headers()["cache-control"]).toBe("no-store");
    expect(await answered.json()).toBeInstanceOf(Object);
  }
});
