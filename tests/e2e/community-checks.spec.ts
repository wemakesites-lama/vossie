import { brotliCompressSync, constants } from "node:zlib";
import { expect, test, type Browser, type BrowserContextOptions, type Cookie, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { offersPanel, postRequest, statusLine } from "./helpers/community";
import { button, field, main, newBuyer, reply, sellerPage, signUp } from "./helpers/messaging";
import { POST_LANDS, uniqueWord } from "./helpers/selling";
import { expectStill, holdFonts, recordShifts, throttle } from "./helpers/shifts";
import { signedInPage, staffNotice } from "./helpers/staff";

// Accessibility, layout shift and size for the pages and states that need a posted request or an offer (community
// actions plan, Task 23; spec sections 4 to 6, plan amendment 13). They run in the community-writes project, after every
// other test (plan decision 27): each posts requests of its own, found by a word no other test uses, and signs up
// students of its own. The shop is the sample "Seller, Tech corner", acting only on the test's own request. Nothing
// here publishes a listing, so no follower's new-listing count (community-writes.spec.ts counts its own) moves.

test.use({ reducedMotion: "reduce" });

/**
 * axe once the page's title is in: a streamed page's <title> can arrive a moment after its heading, and axe's
 * document-title rule would fire on a page that isn't whole. A title that never arrives still fails here.
 */
async function expectAccessible(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  expect(await seriousIssues(page)).toEqual([]);
}

/** A title no other test uses. */
const newTitle = (what: string) => `${what} ${uniqueWord()}`.slice(0, 60);

const problem = (page: Page) => main(page).getByRole("alert", { name: "There's a problem" });

test.describe("axe on the asker's pages", () => {
  test("the request with its panel, the edit form with an error, Delete request and Your requests, open and closed", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await signUp(page, newBuyer());
    const title = newTitle("Axe lamp");
    const id = await postRequest(page, title);
    await expect(offersPanel(page)).toContainText("Your request");
    await expect(statusLine(page)).toHaveText("Your request is up.", POST_LANDS);
    await expectAccessible(page);

    await page.goto(`/looking-for/${id}/edit`);
    await expect(field(page, "What you need")).toHaveValue(title);
    await expectAccessible(page);
    await field(page, "What you need").fill("");
    await button(page, "Save changes").click();
    await expect(problem(page)).toBeVisible(POST_LANDS);
    await expectAccessible(page);

    await page.goto(`/looking-for/${id}/delete`);
    await expect(button(page, "Delete request")).toBeVisible();
    await expectAccessible(page);

    await page.goto("/account/requests");
    await expect(main(page).getByRole("link", { name: title, exact: true })).toBeVisible();
    await expectAccessible(page);

    // Closed: the request page's status line, the edit page that says so, and Your requests with it among the closed.
    await page.goto(`/looking-for/${id}`);
    await button(page, `Close ${title}`).click();
    await expect(statusLine(page)).toHaveText("Request closed.", POST_LANDS);
    await expectAccessible(page);
    await page.goto(`/looking-for/${id}/edit`);
    await expect(main(page).getByText("This request is closed. Reopen it to change it.").filter({ visible: true })).toBeVisible();
    await expectAccessible(page);
    await page.goto("/account/requests");
    await expect(main(page).getByRole("listitem").filter({ hasText: title })).toContainText("Closed");
    await expectAccessible(page);
  });

  test("the request form, after a refusal that kept what was typed", async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page, newBuyer());
    await page.goto("/looking-for/new");
    await field(page, "What you need").fill(newTitle("Axe mail sipho@gmail.com"));
    await field(page, "Category").selectOption({ label: "Res & living" });
    await button(page, "Post request").click();
    await expect(problem(page)).toBeVisible(POST_LANDS);
    await expectAccessible(page);
  });
});

test.describe("axe on an offer's pages", () => {
  test("the composer and its scam check, the thread waiting for a reply, the inbox, and the asker's side", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const asker = newBuyer();
    await signUp(page, asker);
    const title = newTitle("Axe calculator");
    const id = await postRequest(page, title);

    const shop = await sellerPage(browser, baseURL!);
    await shop.goto(`/looking-for/${id}/offer`);
    await expect(field(shop, "Your offer")).toBeVisible();
    await expectAccessible(shop);

    await field(shop, "Your offer").fill("Pay a deposit first and I'll bring it.");
    await button(shop, "Send offer").click();
    await expect(shop.getByRole("alert", { name: "Check this before you send" })).toBeVisible(POST_LANDS);
    await expectAccessible(shop);

    await button(shop, "Send anyway").click();
    await expect(shop).toHaveURL(/\/messages\/conv-[0-9a-f-]{36}$/, POST_LANDS);
    const conversation = shop.url().split("/").at(-1)!;
    await expect(main(shop).getByText("You can write again when they reply.").filter({ visible: true })).toBeVisible();
    await expectAccessible(shop);

    // The composer once the offer is made, and the shop's inbox row for it.
    await shop.goto(`/looking-for/${id}/offer`);
    await expect(main(shop).getByText("You've offered already.").filter({ visible: true })).toBeVisible();
    await expectAccessible(shop);
    await shop.goto("/messages?tab=selling");
    await expect(main(shop).getByRole("link").filter({ hasText: title })).toContainText("The student who asked");
    await expectAccessible(shop);

    // The asker: the panel with the offer, the notification, the inbox row, the thread, and the thread after a reply.
    await page.goto(`/looking-for/${id}`);
    await expect(offersPanel(page).getByText("1 offer", { exact: true })).toBeVisible();
    await expectAccessible(page);
    await page.goto("/notifications");
    await expect(
      main(page).getByRole("link", { name: new RegExp(`Tech corner offered to help with ${title}`) }),
    ).toBeVisible();
    await expectAccessible(page);
    await page.goto("/messages");
    await expect(main(page).getByRole("link").filter({ hasText: title })).toContainText(`Your request: ${title}`);
    await expectAccessible(page);
    await page.goto(`/messages/${conversation}`);
    await expect(main(page).getByRole("heading", { level: 1 })).toHaveText("Messages with Tech corner");
    await expectAccessible(page);
    await reply(page, "Yes please, Thursday at 13:00?");
    await expect(main(page).getByRole("listitem").filter({ hasText: "Thursday at 13:00" })).toBeVisible();
    await expectAccessible(page);

    await shop.goto(`/messages/${conversation}`);
    await expect(main(shop).getByRole("heading", { level: 1 })).toHaveText(`Messages with ${asker.firstName}`);
    await expectAccessible(shop);
    await shop.context().close();
  });
});

test.describe("axe on the Hub's side of a request", () => {
  test("the report, the Hub's page for it, Hide the request with its error, and the asker's hidden request", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    await signUp(page, newBuyer());
    const title = newTitle("Axe exam answers");
    const id = await postRequest(page, title);

    const reporting = await browser.newContext({ baseURL, serviceWorkers: "block", reducedMotion: "reduce" });
    const reporter = await reporting.newPage();
    await signUp(reporter, newBuyer());
    await reporter.goto(`/report?request=${id}`);
    await main(reporter).getByRole("radio", { name: "Prohibited item" }).check();
    await expectAccessible(reporter);
    await button(reporter, "Send report").click();
    await expect(reporter).toHaveURL(/\/report\/sent/, POST_LANDS);
    await reporting.close();

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
    await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
    await expect(main(admin).getByRole("heading", { level: 2, name: "The report" })).toBeVisible();
    await expectAccessible(admin);
    await main(admin).getByRole("link", { name: `Hide ${title}` }).click();
    await expect(field(admin, "Reason")).toBeVisible();
    await expectAccessible(admin);
    await button(admin, `Hide ${title}`).click();
    await expect(problem(admin)).toBeVisible(POST_LANDS);
    await expectAccessible(admin);
    await field(admin, "Reason").fill("Selling exam answers isn't allowed.");
    await button(admin, `Hide ${title}`).click();
    await expect(staffNotice(admin)).toHaveText(
      "Hidden. The asker and everyone who reported it have been told.",
      POST_LANDS,
    );
    await expectAccessible(admin);
    // The report, now that the request is hidden, says students can't see it.
    await main(admin)
      .getByRole("table", { name: "Closed recently" })
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("link")
      .first()
      .click();
    await expect(main(admin).getByText("Students can't see this request: the Hub has hidden it.").filter({ visible: true })).toBeVisible();
    await expectAccessible(admin);
    await admin.context().close();

    // The asker: the notification, Your requests with the hidden one and its reason, and its edit and delete pages.
    await page.goto("/notifications");
    await expect(
      main(page).getByRole("link", { name: new RegExp(`The Hub hid your request ${title}`) }),
    ).toBeVisible();
    await expectAccessible(page);
    await page.goto("/account/requests");
    await expect(main(page).getByRole("listitem").filter({ hasText: title })).toContainText("Hidden by the Hub");
    await expectAccessible(page);
    await page.goto(`/looking-for/${id}/edit`);
    await expect(main(page).getByText("The Hub hid this request, so it can't be changed.", { exact: false }).filter({ visible: true })).toBeVisible();
    await expectAccessible(page);
    await page.goto(`/looking-for/${id}/delete`);
    await expect(button(page, "Delete request")).toBeVisible();
    await expectAccessible(page);
  });
});

test.describe("axe on following", () => {
  test("the storefront after Follow, Saved's Shops with a card, and after Unfollow", async ({ page }) => {
    test.setTimeout(120_000);
    await signUp(page, newBuyer());
    await page.goto("/sellers/tech-corner");
    // Exact names: "Follow Tech corner" is also a part of "Unfollow Tech corner" (plan amendment 20.1).
    await page.getByRole("button", { name: "Follow Tech corner", exact: true }).click();
    await expect(statusLine(page)).toHaveText("You follow Tech corner.", POST_LANDS);
    await expect(page.getByRole("button", { name: "Unfollow Tech corner", exact: true })).toBeVisible();
    await expectAccessible(page);

    await page.goto("/saved?tab=shops");
    await expect(main(page).getByRole("link", { name: /Tech corner/ })).toHaveAttribute("href", "/sellers/tech-corner");
    await expectAccessible(page);

    await button(page, "Unfollow Tech corner").click();
    await expect(statusLine(page)).toHaveText("You've unfollowed Tech corner.", POST_LANDS);
    await expect(main(page).getByText("No shops yet").filter({ visible: true })).toBeVisible();
    await expectAccessible(page);
  });
});

// --- Layout shift ---------------------------------------------------------------------------------------------------
// The pages that need a request of the account's own, measured as cls.spec.ts measures the rest: at 390 and 1440, with
// the fonts held back, and on a slow network (350 ms, 400 kbps) with the shared files cached, as on any page after
// the first. The project here is a phone, so each page opens in a browser context of its own at the size measured,
// signed in by copying the session cookie across (amendment 4: every hand-made context blocks the worker).

type Size = { name: string; options: BrowserContextOptions };

const SIZES: readonly Size[] = [
  {
    name: "390",
    options: {
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  },
  {
    name: "1440",
    options: {
      viewport: { width: 1440, height: 900 },
      screen: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
  },
];

/** The session cookie of the account the page is signed in as. */
async function sessionOf(page: Page): Promise<Cookie[]> {
  return (await page.context().cookies()).filter((cookie) => cookie.name === "vossie_session");
}

// Like cls.spec.ts's pages: the locale and time zone of the project, and motion on (this file's `reducedMotion` is for axe).
const AS_CLS_SPEC = { locale: "en-ZA", timezoneId: "Africa/Johannesburg", reducedMotion: "no-preference" } as const;

/** A browser context at this size, signed in with `session`. Close it when done. */
async function signedInAt(browser: Browser, baseURL: string, size: Size, session: Cookie[]) {
  const context = await browser.newContext({ baseURL, serviceWorkers: "block", ...AS_CLS_SPEC, ...size.options });
  await context.addCookies(session);
  return context;
}

/** One page's layout shift at this size, on the fast network with the fonts held back, or on the slow one. */
async function expectPageStill(
  browser: Browser,
  baseURL: string,
  size: Size,
  session: Cookie[],
  [name, path]: readonly [name: string, path: string],
  slow: boolean,
) {
  const context = await signedInAt(browser, baseURL, size, session);
  const page = await context.newPage();
  if (slow) {
    // Another page first, so the stylesheet, fonts and scripts are cached, and the page below paints as it arrives.
    await page.goto("/account", { waitUntil: "networkidle" });
    await throttle(context, page);
  } else {
    await holdFonts(page);
  }
  await recordShifts(page);
  await expectStill(page, `${name} (${size.name}${slow ? ", slow network" : ""})`, path);
  await context.close();
}

for (const size of SIZES) {
  test(`the asker's own pages hold still at ${size.name} (CLS 0.05 or less, spec 11)`, async ({ page, browser, baseURL }) => {
    test.setTimeout(300_000);
    await signUp(page, newBuyer());
    const id = await postRequest(page, newTitle("Shift lamp"));
    const session = await sessionOf(page);
    const pages = [
      ["request page (the asker's panel)", `/looking-for/${id}`],
      ["edit request page", `/looking-for/${id}/edit`],
      ["delete request page", `/looking-for/${id}/delete`],
      ["Your requests (one request)", "/account/requests"],
    ] as const;
    for (const slow of [false, true]) {
      for (const row of pages) await expectPageStill(browser, baseURL!, size, session, row, slow);
    }
  });

  test(`an offer's pages hold still at ${size.name} (CLS 0.05 or less, spec 11)`, async ({ page, browser, baseURL }) => {
    test.setTimeout(300_000);
    await signUp(page, newBuyer());
    const id = await postRequest(page, newTitle("Shift calculator"));
    const asker = await sessionOf(page);

    const shop = await sellerPage(browser, baseURL!);
    const shopSession = await sessionOf(shop);
    // The composer's form, before the offer. The shop's own session is read with the form showing, then it offers.
    await expectPageStill(browser, baseURL!, size, shopSession, ["offer composer (the form)", `/looking-for/${id}/offer`], false);
    await expectPageStill(browser, baseURL!, size, shopSession, ["offer composer (the form)", `/looking-for/${id}/offer`], true);

    await shop.goto(`/looking-for/${id}/offer`);
    await field(shop, "Your offer").fill("I have a Casio fx-991ZA for R250, at the library.");
    await field(shop, "Point to one of your listings (optional)").selectOption({ label: "Casio fx-991ZA Plus calculator" });
    await button(shop, "Send offer").click();
    await expect(shop).toHaveURL(/\/messages\/conv-[0-9a-f-]{36}$/, POST_LANDS);
    const conversation = shop.url().split("/").at(-1)!;
    await shop.context().close();

    for (const slow of [false, true]) {
      for (const [who, session, rows] of [
        [
          "the shop",
          shopSession,
          [
            ["offer thread (the shop's side)", `/messages/${conversation}`],
            ["offer composer (already offered)", `/looking-for/${id}/offer`],
            ["inbox (an offer, the shop's side)", "/messages?tab=selling"],
          ],
        ],
        [
          "the asker",
          asker,
          [
            ["request page (the asker's panel with an offer)", `/looking-for/${id}`],
            ["offer thread (the asker's side)", `/messages/${conversation}`],
            ["inbox (an offer, the asker's side)", "/messages"],
            ["notifications (an offer)", "/notifications"],
          ],
        ],
      ] as const) {
        for (const row of rows) await expectPageStill(browser, baseURL!, size, session, [`${row[0]}, ${who}`, row[1]], slow);
      }
    }
  });
}

// --- Size -----------------------------------------------------------------------------------------------------------
// A first visit, with only the session cookie copied in, so nothing is cached yet (the signed-in rows in
// performance.spec.ts do the same for the pages that need no request of the account's own).

test("the pages that need a request of the account's own stay inside the JavaScript budget on a first visit (spec 5)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  await signUp(page, newBuyer());
  const id = await postRequest(page, newTitle("Size lamp"));
  const asker = await sessionOf(page);

  const shop = await sellerPage(browser, baseURL!);
  const shopSession = await sessionOf(shop);
  await shop.goto(`/looking-for/${id}/offer`);
  await field(shop, "Your offer").fill("I have a lamp for R120, at the library.");
  await button(shop, "Send offer").click();
  await expect(shop).toHaveURL(/\/messages\/conv-[0-9a-f-]{36}$/, POST_LANDS);
  const conversation = shop.url().split("/").at(-1)!;
  await shop.context().close();

  // The composer's form is measured before the offer, so a second request stands in for it.
  const open = await postRequest(page, newTitle("Size kettle"));

  const rows = [
    ["request page (the asker's panel)", asker, `/looking-for/${id}`],
    ["edit request page", asker, `/looking-for/${id}/edit`],
    ["delete request page", asker, `/looking-for/${id}/delete`],
    ["Your requests (two requests)", asker, "/account/requests"],
    ["offer thread (the asker's side)", asker, `/messages/${conversation}`],
    ["offer composer (the form)", shopSession, `/looking-for/${open}/offer`],
    ["offer thread (the shop's side)", shopSession, `/messages/${conversation}`],
  ] as const;
  for (const [name, session, path] of rows) {
    const context = await signedInAt(browser, baseURL!, SIZES[0], session);
    const visit = await context.newPage();
    let scriptBrotli = 0;
    const pending: Array<Promise<void>> = [];
    visit.on("response", (response) => {
      if (response.request().resourceType() !== "script") return;
      pending.push(
        response.body().then((body) => {
          scriptBrotli += brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
        }),
      );
    });
    await visit.goto(path, { waitUntil: "networkidle" });
    // A session that didn't carry over would be sent to sign-in, which has an h1 too: check we're on the page itself.
    await expect(visit).toHaveURL(new RegExp(`${path.replace(/[?]/g, "\\$&")}$`));
    await expect(main(visit).getByRole("heading", { level: 1 })).toBeVisible();
    await Promise.all(pending);
    console.log(`${name} (signed in): ${JSON.stringify({ scriptBrotli })}`);
    expect(scriptBrotli, `${name}: JavaScript, brotli as a host serves it`).toBeLessThanOrEqual(150 * 1024);
    await context.close();
  }
});
