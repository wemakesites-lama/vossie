import { expect, test } from "@playwright/test";
import {
  fillRequest,
  NEW_REQUEST_URL,
  offersPanel,
  postRequest,
  requestIdOf,
  statusLine,
} from "./helpers/community";
import { button, field, main, newBuyer, reply, sellerPage, signUp, statusPill } from "./helpers/messaging";
import { notFoundHeading, POST_LANDS, publishListing, uniqueWord } from "./helpers/selling";
import { signedInPage, staffNotice } from "./helpers/staff";

// These run in the community-writes project, after every other test (community actions plan decision 27): new
// requests change the board's and the homepage's counts, and new listings change browse's. Each signs up students of
// its own and finds its requests and listings by a word no other test uses. The shop is the sample "Seller, Tech
// corner", acting only on the test's own request and listings, and only the follow test publishes for it.

test.describe("community actions that buyers see (community actions spec section 6)", () => {
  test("a student posts a request, finds it on the board and the homepage, edits, closes, reopens and deletes it", async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, newBuyer());
    const title = `Desk lamp ${uniqueWord()}`;
    const id = await postRequest(page, title, { campus: "Mbombela" });
    await expect(statusLine(page)).toHaveText("Your request is up.", POST_LANDS);
    await expect(main(page).getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(offersPanel(page)).toContainText("Your request");
    await expect(offersPanel(page)).toContainText("No offers yet");

    // The board, at the campus it was posted for, and the homepage's band, which puts the visitor's campus first.
    await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
    await page.goto("/looking-for");
    await expect(
      page.getByRole("region", { name: "At Mbombela" }).getByRole("heading", { level: 3, name: title }),
    ).toBeVisible();
    await page.goto("/");
    await expect(page.locator("#looking-for").getByRole("link", { name: new RegExp(title) })).toBeVisible();

    await page.goto(`/looking-for/${id}`);
    await main(page).getByRole("link", { name: `Edit ${title}`, exact: true }).click();
    await expect(field(page, "What you need")).toHaveValue(title);
    const edited = `${title} clip`;
    await field(page, "What you need").fill(edited);
    await button(page, "Save changes").click();
    await expect(page).toHaveURL(new RegExp(`/looking-for/${id}$`), POST_LANDS);
    await expect(main(page).getByRole("heading", { level: 1 })).toHaveText(edited);
    await expect(statusLine(page)).toHaveText("Your changes are saved.", POST_LANDS);

    // Closed, it leaves the board. The board has drawn when its rows are there: only then is "gone" a fact.
    await button(page, `Close ${edited}`).click();
    await expect(statusLine(page)).toHaveText("Request closed.", POST_LANDS);
    await page.goto("/looking-for");
    await expect(page.locator(".board-row").filter({ visible: true }).first()).toBeVisible();
    expect(await page.getByRole("heading", { level: 3, name: edited }).count()).toBe(0);

    await page.goto("/account/requests");
    await expect(main(page).getByRole("listitem").filter({ hasText: edited })).toContainText("Closed");
    await button(page, `Reopen ${edited}`).click();
    await expect(statusLine(page)).toHaveText("Request reopened.", POST_LANDS);
    await expect(main(page).getByRole("listitem").filter({ hasText: edited })).toContainText("Open");

    await main(page).getByRole("link", { name: `Delete ${edited}`, exact: true }).click();
    await expect(main(page).getByText(`Delete ${edited}? This can't be undone.`).filter({ visible: true })).toBeVisible();
    await button(page, "Delete request").click();
    await expect(page).toHaveURL(/\/account\/requests$/, POST_LANDS);
    await expect(statusLine(page)).toHaveText("Request deleted.", POST_LANDS);
    await expect(main(page).getByText("You haven't asked for anything yet.").filter({ visible: true })).toBeVisible();
    await page.goto(`/looking-for/${id}`);
    await expect(notFoundHeading(page)).toBeVisible();
  });

  test("posting works with the app's JavaScript blocked (spec 2.2)", async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page, newBuyer());
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    const title = `Kettle ${uniqueWord()}`;
    await postRequest(page, title);
    await expect(main(page).getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(statusLine(page)).toHaveText("Your request is up.", POST_LANDS);
  });

  test("a new request is made once, however many times its form is sent (plan amendment 3)", async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page, newBuyer());
    // The app's bundle blocked, so pressing the button is a real form post the test can see and send again.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    const title = `Fan ${uniqueWord()}`;
    await page.goto("/looking-for/new");
    await fillRequest(page, title);
    const sent = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith("/looking-for/new"),
    );
    await button(page, "Post request").click();
    const first = await sent;
    await expect(page).toHaveURL(NEW_REQUEST_URL, POST_LANDS);
    const id = requestIdOf(page);

    // The same post sent twice more, together, as a double-pressed button or a browser's retry would: the form's own
    // headers and body, so the same one-time token. Each lands on the first request's page and makes nothing.
    const headers = await first.allHeaders();
    const body = first.postDataBuffer()!;
    const replay = (data: Buffer) =>
      page.context().request.post(first.url(), {
        headers: { "content-type": headers["content-type"], origin: headers.origin, referer: headers.referer },
        data,
      });
    for (const again of await Promise.all([replay(body), replay(body)])) {
      expect(again.ok()).toBe(true);
      expect(new URL(again.url()).pathname).toBe(`/looking-for/${id}`);
    }
    // A control, so that result means something: the same post with a made-up token goes back to the form instead
    // (the token is refused, with what was typed kept), and still makes nothing.
    const token = /name="once"\r\n\r\n([^\r]+)\r\n/.exec(body.toString("latin1"))![1];
    const forged = Buffer.from(body.toString("latin1").replace(token, "x".repeat(token.length)), "latin1");
    const refused = await replay(forged);
    expect(refused.ok()).toBe(true);
    expect(new URL(refused.url()).pathname).toBe("/looking-for/new");

    await page.goto("/account/requests");
    await expect(main(page).getByRole("listitem").filter({ hasText: title })).toHaveCount(1);
  });

  test("a shop offers: the asker is told and unnamed until they reply; the sale is marked and confirmed", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const student = newBuyer();
    await signUp(page, student);
    const title = `Calculator ${uniqueWord()}`;
    const id = await postRequest(page, title);

    const shop = await sellerPage(browser, baseURL!);
    await shop.goto(`/looking-for/${id}`);
    // The session's link streams in after the signed-out one: wait for the composer's address before pressing it.
    const offer = offersPanel(shop).getByRole("link", { name: "Offer to help" });
    await expect(offer).toHaveAttribute("href", `/looking-for/${id}/offer`);
    await offer.click();
    await expect(shop).toHaveURL(new RegExp(`/looking-for/${id}/offer$`));
    await field(shop, "Your offer").fill("I have a Casio fx-991ZA for R250, at the library.");
    await field(shop, "Point to one of your listings (optional)").selectOption({
      label: "Casio fx-991ZA Plus calculator",
    });
    await button(shop, "Send offer").click();
    await expect(shop).toHaveURL(/\/messages\/conv-[0-9a-f-]{36}$/, POST_LANDS);
    const conversation = shop.url().split("/").at(-1)!;
    await expect(statusLine(shop)).toHaveText("Sent. The student who asked gets a notification.", POST_LANDS);
    await expect(main(shop).getByRole("heading", { level: 1 })).toHaveText("Messages with The student who asked");
    await expect(main(shop).getByText("You can write again when they reply.").filter({ visible: true })).toBeVisible();
    await expect(statusPill(shop, "Offered")).toBeVisible();
    // The shop sees the request and the listing it pointed to.
    await expect(main(shop).getByRole("link", { name: title, exact: true })).toHaveAttribute("href", `/looking-for/${id}`);
    await expect(main(shop).getByText("Casio fx-991ZA Plus calculator").filter({ visible: true }).first()).toBeVisible();

    // The shop's inbox names the request, and still not the student.
    await shop.goto("/messages?tab=selling");
    const shopRow = main(shop).getByRole("link").filter({ hasText: title });
    await expect(shopRow).toContainText(`Request: ${title}`);
    await expect(shopRow).toContainText("The student who asked");
    expect(await shopRow.textContent()).not.toContain(student.firstName);

    // The asker is told, and the count and the offer show on the request's page.
    await page.goto("/notifications");
    await expect(
      main(page).getByRole("link", { name: new RegExp(`Tech corner offered to help with ${title}`) }),
    ).toBeVisible();
    await page.goto("/messages");
    await expect(main(page).getByRole("link").filter({ hasText: title })).toContainText(`Your request: ${title}`);
    await page.goto(`/looking-for/${id}`);
    await expect(offersPanel(page).getByText("1 offer", { exact: true })).toBeVisible();
    await offersPanel(page).getByRole("link", { name: /Tech corner/ }).click();
    await expect(page).toHaveURL(new RegExp(`/messages/${conversation}$`));
    await expect(main(page).getByRole("heading", { level: 1 })).toHaveText("Messages with Tech corner");
    await reply(page, "Yes please, Thursday at 13:00?");
    await expect(main(page).getByRole("listitem").filter({ hasText: "Thursday at 13:00" })).toBeVisible();

    // The shop now knows the student by first name, and can write again.
    await shop.goto(`/messages/${conversation}`);
    await expect(main(shop).getByRole("heading", { level: 1 })).toHaveText(`Messages with ${student.firstName}`);
    await expect(statusPill(shop, "Replied")).toBeVisible();
    await reply(shop, "See you then.");
    await expect(main(shop).getByRole("listitem").filter({ hasText: "See you then." })).toBeVisible();
    await button(shop, "Mark as completed").click();
    await expect(statusPill(shop, "Done")).toBeVisible();
    await shop.context().close();

    await page.reload();
    await main(page)
      .getByRole("region", { name: "Did the sale happen?" })
      .getByRole("button", { name: "Confirm the sale" })
      .click();
    await expect(statusPill(page, "Confirmed")).toBeVisible();
  });

  test("a reported request is hidden by the Hub: it leaves the board and its page, and the asker is told", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, newBuyer());
    const title = `Exam answers ${uniqueWord()}`;
    const id = await postRequest(page, title);

    const reporting = await browser.newContext({ baseURL, serviceWorkers: "block" });
    const reporter = await reporting.newPage();
    await signUp(reporter, newBuyer());
    await reporter.goto(`/looking-for/${id}`);
    const report = main(reporter).getByRole("link", { name: "Report this request" });
    await expect(report).toHaveAttribute("href", `/report?request=${id}`);
    await report.click();
    await main(reporter).getByRole("radio", { name: "Prohibited item" }).check();
    await button(reporter, "Send report").click();
    await expect(reporter).toHaveURL(/\/report\/sent/, POST_LANDS);

    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
    await main(admin).getByRole("link", { name: `Review the report about ${title}` }).first().click();
    await main(admin).getByRole("link", { name: `Hide ${title}` }).click();
    // A reason is required, and the asker is the one who reads it.
    await button(admin, `Hide ${title}`).click();
    await expect(main(admin).getByRole("alert", { name: "There's a problem" })).toContainText(
      "Give a reason. The asker sees it.",
      POST_LANDS,
    );
    await field(admin, "Reason").fill("Selling exam answers isn't allowed.");
    await button(admin, `Hide ${title}`).click();
    await expect(staffNotice(admin)).toHaveText(
      "Hidden. The asker and everyone who reported it have been told.",
      POST_LANDS,
    );
    await admin.context().close();

    // Gone from the board (once its rows have drawn), from its own page and from the composer.
    await page.goto("/looking-for");
    await expect(page.locator(".board-row").filter({ visible: true }).first()).toBeVisible();
    expect(await page.getByRole("heading", { level: 3, name: title }).count()).toBe(0);
    await page.goto(`/looking-for/${id}`);
    await expect(notFoundHeading(page)).toBeVisible();
    await page.goto(`/looking-for/${id}/offer`);
    await expect(notFoundHeading(page)).toBeVisible();

    // The asker is told and sees why; the reporter hears the Hub acted.
    await page.goto("/notifications");
    await main(page).getByRole("link", { name: new RegExp(`The Hub hid your request ${title}`) }).click();
    await expect(page).toHaveURL(/\/account\/requests$/);
    const row = main(page).getByRole("listitem").filter({ hasText: title });
    await expect(row).toContainText("Hidden by the Hub");
    await expect(row).toContainText("The Hub's reason: Selling exam answers isn't allowed.");
    // A hidden request can be deleted, not edited, closed or reopened.
    await expect(row.getByRole("link", { name: `Delete ${title}`, exact: true })).toBeVisible();
    expect(await row.getByRole("link", { name: `Edit ${title}`, exact: true }).count()).toBe(0);
    expect(await row.getByRole("button").count()).toBe(0);
    await reporter.goto("/notifications");
    await expect(
      main(reporter).getByText(`Thanks, we've acted on your report about ${title}.`).filter({ visible: true }),
    ).toBeVisible();
    await reporting.close();
  });

  test("a student follows a shop, finds it on Saved, hears once about two new listings, and unfollows", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, newBuyer());
    await page.goto("/sellers/tech-corner");
    // Exact names: "Follow Tech corner" is also a part of "Unfollow Tech corner" (plan amendment 20.1).
    await page.getByRole("button", { name: "Follow Tech corner", exact: true }).click();
    await expect(statusLine(page)).toHaveText("You follow Tech corner.", POST_LANDS);
    await expect(page.getByRole("button", { name: "Unfollow Tech corner", exact: true })).toBeVisible();
    await page.goto("/saved?tab=shops");
    await expect(main(page).getByRole("link", { name: /Tech corner/ })).toHaveAttribute("href", "/sellers/tech-corner");

    const shop = await sellerPage(browser, baseURL!);
    const word = uniqueWord();
    await publishListing(shop, `Desk fan ${word}`);
    await publishListing(shop, `Desk lamp ${word}`);
    await shop.context().close();

    // One notification, however many listings: the second updated the first.
    await page.goto("/notifications");
    const notes = main(page).getByRole("link", { name: /Tech corner listed/ });
    await expect(notes).toHaveCount(1);
    await expect(notes).toContainText("Tech corner listed 2 new things");
    await notes.click();
    await expect(page).toHaveURL(/\/sellers\/tech-corner$/);

    await page.goto("/saved?tab=shops");
    await button(page, "Unfollow Tech corner").click();
    await expect(statusLine(page)).toHaveText("You've unfollowed Tech corner.", POST_LANDS);
    await expect(main(page).getByText("No shops yet").filter({ visible: true })).toBeVisible();
  });
});
