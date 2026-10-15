import { expect, test } from "@playwright/test";
import {
  accountIcon,
  bubble,
  button,
  field,
  main,
  newBuyer,
  onlyAt,
  reply,
  sellerPage,
  sendFirstMessage,
  signInAsSample,
  signUp,
  signUpHere,
  statusPill,
} from "./helpers/messaging";

const BOTH = ["phone-390", "desktop-1440"];

test.describe("messaging a seller (messaging spec 3.1 to 3.3)", () => {
  test("a buyer messages from the listing, through sign-in, and the seller replies", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    const buyer = newBuyer();
    await page.goto("/listings/l-001");
    await page.getByRole("link", { name: "Message seller" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001%2Fmessage$/);
    await signUpHere(page, buyer);
    // Sign-in goes on to the composer (spec 2.1).
    await expect(page).toHaveURL(/\/listings\/l-001\/message$/);
    await expect(main(page).getByRole("heading", { level: 1, name: "Message Tech corner" })).toBeVisible();
    await field(page, "Your message").fill("Hi! Is the calculator still available?");
    await button(page, "Send").click();
    await expect(page).toHaveURL(/\/messages\/conv-/);
    const id = page.url().split("/").at(-1)!;
    await expect(main(page).getByRole("status")).toHaveText("Sent. Sellers usually reply within a day.");
    await expect(statusPill(page, "Asked")).toBeVisible();

    const seller = await sellerPage(browser, baseURL!);
    await seller.goto("/messages?tab=selling");
    const row = main(seller).getByRole("link").filter({ hasText: buyer.firstName });
    await expect(row).toContainText("Casio fx-991ZA Plus calculator");
    await expect(row).toContainText("Unread,");
    await row.click();
    await expect(seller).toHaveURL(new RegExp(`/messages/${id}$`));
    await expect(main(seller).getByRole("heading", { level: 1, name: `Messages with ${buyer.firstName}` })).toBeVisible();
    await reply(seller, "Yes, it is. Library entrance at 13:00?");
    await expect(bubble(seller, "Library entrance at 13:00?")).toContainText("You");
    await expect(statusPill(seller, "Replied")).toBeVisible();
    // A new form after each message, so the box is empty (plan decision 20).
    await expect(field(seller, "Your reply")).toHaveValue("");
    await seller.context().close();

    // The buyer's Refresh is a full page load (plan decision 19). "Sent." showed once (plan decision 7).
    await main(page).getByRole("link", { name: "Refresh" }).click();
    await expect(bubble(page, "Library entrance at 13:00?")).toContainText("Tech corner");
    await expect(statusPill(page, "Replied")).toBeVisible();
    await expect(main(page).getByRole("status")).toHaveCount(0);
  });

  test("the seller marks the sale completed, and the buyer confirms it (spec 2.5)", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const id = await sendFirstMessage(page, "l-001", "Hi! Still available?");
    const seller = await sellerPage(browser, baseURL!);
    await seller.goto(`/messages/${id}`);
    // Not before a reply (spec 3.3).
    await expect(button(seller, "Mark as completed")).toHaveCount(0);
    await reply(seller, "Yes.");
    await button(seller, "Mark as completed").click();
    await expect(statusPill(seller, "Done")).toBeVisible();
    await expect(main(seller).getByText(/^You marked this as completed on /)).toBeVisible();
    await seller.context().close();

    await page.reload();
    const ask = main(page).getByRole("region", { name: "Did the sale happen?" });
    await expect(ask).toContainText("Tech corner marked this as completed on");
    await ask.getByRole("button", { name: "Confirm the sale" }).click();
    await expect(statusPill(page, "Confirmed")).toBeVisible();
    await expect(main(page).getByText(/^Sale confirmed on /)).toBeVisible();
  });

  test("It didn't happen reopens the sale, and the seller can mark it again (spec 2.5)", async ({
    page,
    browser,
    baseURL,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const id = await sendFirstMessage(page, "l-001", "Hi!");
    const seller = await sellerPage(browser, baseURL!);
    await seller.goto(`/messages/${id}`);
    await reply(seller, "Yes.");
    await button(seller, "Mark as completed").click();
    await expect(statusPill(seller, "Done")).toBeVisible();

    await page.reload();
    await main(page).getByRole("button", { name: "It didn't happen" }).click();
    await expect(statusPill(page, "Replied")).toBeVisible();
    await expect(main(page).getByRole("region", { name: "Did the sale happen?" })).toHaveCount(0);

    await seller.reload();
    await expect(button(seller, "Mark as completed")).toBeVisible();
    await seller.context().close();
  });

  test("a listing that takes swaps offers a swap, and the thread shows it as an offer (spec 2.4)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/listings/l-001/message");
    await expect(field(page, "Your message")).toBeVisible();
    await expect(field(page, "Offer a swap (optional)")).toHaveCount(0);
    await sendFirstMessage(page, "l-007", "Would you swap?", "A Bluetooth speaker, barely used");
    await expect(main(page).getByText("Swap offer:").locator("xpath=..")).toHaveText(
      "Swap offer: A Bluetooth speaker, barely used",
    );
  });

  test("the scam check warns before sending, keeping the message, and Send anyway sends it (spec 2.3)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/listings/l-001/message");
    await expect(main(page).getByRole("region", { name: "Stay safe" }).getByRole("listitem")).toHaveCount(3);
    await field(page, "Your message").fill("Can I pay a deposit first to hold it?");
    await button(page, "Send").click();
    const check = main(page).getByRole("alert", { name: "Check this before you send" });
    await expect(check).toContainText("Don't pay a deposit");
    await expect(page).toHaveURL(/\/listings\/l-001\/message$/);
    await expect(field(page, "Your message")).toHaveValue("Can I pay a deposit first to hold it?");
    await check.getByRole("button", { name: "Send anyway" }).click();
    await expect(page).toHaveURL(/\/messages\/conv-/);
    await expect(bubble(page, "Can I pay a deposit first to hold it?")).toBeVisible();
  });

  test("the composer says what's wrong and keeps what was typed (spec 3.1)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/listings/l-001/message");
    await button(page, "Send").click();
    const summary = main(page).getByRole("alert", { name: "There's a problem" });
    await expect(summary.getByRole("link")).toHaveText(["Write a message first."]);
    const long = "a".repeat(1001);
    await field(page, "Your message").fill(long);
    await button(page, "Send").click();
    await expect(summary.getByRole("link")).toHaveText(["Keep it under 1,000 characters."]);
    await expect(field(page, "Your message")).toHaveValue(long);
  });

  test("Back after sending goes to the listing, whose Message seller now opens the thread (plan decisions 5, 6)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/listings/l-001");
    const message = page.getByRole("link", { name: "Message seller" });
    // The signed-in link streams in; wait for it rather than the static shell's sign-in link.
    await expect(message).toHaveAttribute("href", "/listings/l-001/message");
    await message.click();
    await field(page, "Your message").fill("Hi!");
    await button(page, "Send").click();
    await expect(page).toHaveURL(/\/messages\/conv-/);
    const thread = new URL(page.url()).pathname;
    // The send replaced the composer in history (plan decision 6).
    await page.goBack();
    await expect(page).toHaveURL(/\/listings\/l-001$/);
    await expect(message).toHaveAttribute("href", thread);
    await page.goto("/listings/l-001/message");
    await expect(main(page).getByText("You've already messaged Tech corner about this.")).toBeVisible();
    await main(page).getByRole("link", { name: "Open the conversation" }).click();
    await expect(page).toHaveURL(new RegExp(`${thread}$`));
  });

  test("the storefront's Message seller asks the shop a question (plan decision 2)", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/sellers/tech-corner");
    const message = page.getByRole("link", { name: "Message seller" });
    await expect(message).toHaveAttribute("href", "/sellers/tech-corner/message");
    await message.click();
    await expect(main(page).getByText("A question for the shop · Midrand")).toBeVisible();
    await expect(field(page, "Offer a swap (optional)")).toHaveCount(0);
    await field(page, "Your message").fill("Do you fix cracked screens?");
    await button(page, "Send").click();
    await expect(page).toHaveURL(/\/messages\/conv-/);
    await expect(main(page).getByRole("link", { name: "Tech corner" })).toHaveAttribute("href", "/sellers/tech-corner");
  });

  test("a seller can't message their own listing, and a sold listing can't be messaged (spec 3.1)", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Seller, Tech corner", "/listings/l-001/message");
    await expect(main(page).getByText("This is your listing, so you can't message yourself.")).toBeVisible();
    await page.goto("/listings/l-026/message");
    await expect(main(page).getByText("This listing isn't available right now, so it can't be messaged.")).toBeVisible();
    await expect(main(page).getByRole("link", { name: "See similar items" })).toHaveAttribute("href", "/browse?cat=tech");
  });

  test("only the buyer and the seller can open a thread (spec 3.3)", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const id = await sendFirstMessage(page, "l-001", "Hi!");
    const other = await browser.newContext({ baseURL });
    const stranger = await other.newPage();
    await signUp(stranger, newBuyer());
    await stranger.goto(`/messages/${id}`);
    await expect(stranger.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await other.close();
  });

  test("the inbox has Buying and Selling only for an account with a shop (spec 2.10)", async ({
    page,
    browser,
    baseURL,
  }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await page.goto("/messages");
    await expect(main(page).getByText("No messages yet. Find something you like and message the seller.")).toBeVisible();
    await expect(main(page).getByRole("navigation", { name: "Buying and selling" })).toHaveCount(0);
    const seller = await sellerPage(browser, baseURL!);
    await seller.goto("/messages");
    const tabs = main(seller).getByRole("navigation", { name: "Buying and selling" });
    await tabs.getByRole("link", { name: "Selling" }).click();
    await expect(seller).toHaveURL(/\/messages\?tab=selling$/);
    await expect(tabs.getByRole("link", { name: "Selling" })).toHaveAttribute("aria-current", "page");
    await expect(main(seller).getByRole("link").filter({ hasText: "Thandi" }).first()).toBeVisible();
    await seller.context().close();
  });

  test("switching the inbox's tabs leaves no id twice in the page, kept copies included (amendment 1)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    // Reading the sample seller's inbox changes nothing (plan decision 16).
    await signInAsSample(page, "Seller, Tech corner", "/messages");
    const tabs = main(page).getByRole("navigation", { name: "Buying and selling" }).filter({ visible: true });
    for (const [name, url] of [
      ["Selling", /\/messages\?tab=selling$/],
      ["Buying", /\/messages$/],
    ] as const) {
      await tabs.getByRole("link", { name }).click();
      await expect(page).toHaveURL(url);
      await expect(tabs.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
      // Next keeps earlier pages hidden in the DOM, so a repeated id would point a label at the wrong copy.
      const repeated = await page.evaluate(() => {
        const ids = Array.from(document.querySelectorAll("[id]"), (element) => element.id);
        return ids.filter((id, index) => ids.indexOf(id) !== index);
      });
      expect(repeated).toEqual([]);
      await expect(main(page).getByRole("region", { name })).toBeVisible();
    }
  });
});

test("a report goes through sign-in to the form, then a thank-you; one per listing (spec 2.8 and 3.4)", async ({
  page,
}) => {
  onlyAt(...BOTH);
  await page.goto("/listings/l-001");
  await page.getByRole("link", { name: "Report this listing" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Freport%3Flisting%3Dl-001$/);
  await expect(main(page).getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/listings/l-001");
  await signUpHere(page, newBuyer());
  await expect(page).toHaveURL(/\/report\?listing=l-001$/);
  await expect(main(page).getByRole("heading", { level: 1, name: "Report this listing" })).toBeVisible();
  await button(page, "Send report").click();
  await expect(main(page).getByRole("alert", { name: "There's a problem" })).toContainText("Choose a reason.");
  await main(page).getByRole("radio", { name: "Misleading listing" }).check();
  await field(page, "Tell us more (optional)").fill("The photo isn't the same model.");
  await button(page, "Send report").click();
  await expect(page).toHaveURL(/\/report\/sent\?listing=l-001$/);
  await expect(main(page).getByText(/^Thanks\. The Hub reviews reports within two working days\./)).toBeVisible();

  // Signed in, Report goes straight to the form, and the thank-you replaces it in history (plan decision 6).
  await page.goto("/listings/l-002");
  const report = page.getByRole("link", { name: "Report this listing" });
  await expect(report).toHaveAttribute("href", "/report?listing=l-002");
  await report.click();
  await main(page).getByRole("radio", { name: "Spam" }).check();
  await button(page, "Send report").click();
  await expect(page).toHaveURL(/\/report\/sent\?listing=l-002$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/listings\/l-002$/);

  await page.goto("/report?listing=l-001");
  await expect(main(page).getByText(/^You've reported this listing already\./)).toBeVisible();
  await page.goto("/account/privacy");
  const reports = main(page).getByRole("region", { name: "Reports you've made" });
  await expect(reports.getByRole("listitem")).toHaveCount(2);
  await expect(reports).toContainText("Casio fx-991ZA Plus calculator");
});

test("the header counts new notifications, and the notifications page lists them (spec 2.9, 3.5 and 3.6)", async ({
  page,
  browser,
  baseURL,
}) => {
  onlyAt(...BOTH);
  await signUp(page, newBuyer());
  const id = await sendFirstMessage(page, "l-001", "Hi! Is it still available?");
  await page.goto("/");
  await expect(accountIcon(page)).toHaveAccessibleName("Your account");
  await expect(accountIcon(page)).not.toHaveAttribute("aria-describedby");

  const seller = await sellerPage(browser, baseURL!);
  await seller.goto(`/messages/${id}`);
  await reply(seller, "Yes, it is.");
  await seller.context().close();

  // The header is drawn again on a full page load (plan decision 11).
  await page.goto("/");
  await expect(accountIcon(page)).toHaveAccessibleName("Your account");
  await expect(accountIcon(page)).toHaveAccessibleDescription("1 new notification");
  await expect(page.getByText("1 new message", { exact: true })).toBeVisible();
  await page.goto("/account");
  await expect(main(page).getByRole("link", { name: /^Messages\s*,\s*1 unread$/ })).toBeVisible();
  await main(page).getByRole("link", { name: /^Notifications\s*,\s*1 new$/ }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  const note = main(page).getByRole("link").filter({ hasText: "Tech corner replied about Casio fx-991ZA Plus calculator" });
  await expect(note).toContainText("New");
  await note.click();
  await expect(page).toHaveURL(new RegExp(`/messages/${id}$`));
  await page.goto("/");
  await expect(accountIcon(page)).not.toHaveAttribute("aria-describedby");
  await expect(page.getByText("1 new message", { exact: true })).toHaveCount(0);
});

test.describe("kept pages stay right (plan decision 6)", () => {
  test("a link back to the inbox shows the other person's new reply", async ({ page, browser, baseURL }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const id = await sendFirstMessage(page, "l-001", "Hi!");
    await main(page).getByRole("link", { name: "Back to messages" }).click();
    await expect(page).toHaveURL(/\/messages$/);
    const row = main(page).getByRole("link").filter({ hasText: "Casio fx-991ZA Plus calculator" });
    await expect(row).not.toContainText("Unread,");
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/messages/${id}$`));

    const seller = await sellerPage(browser, baseURL!);
    await seller.goto(`/messages/${id}`);
    await reply(seller, "Yes, it is.");
    await seller.context().close();

    // A link asks the server again for the kept inbox (Next's staleTimes.dynamic is 0). If this fails, Next showed the
    // kept copy: stop and report it with the trace (plan decision 6); don't change the test to a full page load.
    await main(page).getByRole("link", { name: "Back to messages" }).click();
    await expect(row).toContainText("Unread,");
    await expect(row).toContainText("Yes, it is.");
  });

  test("Back to the inbox after your own reply shows it: the reply dropped the kept copy", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    const id = await sendFirstMessage(page, "l-001", "Hi!");
    await page.goto("/messages");
    const row = main(page).getByRole("link").filter({ hasText: "Casio fx-991ZA Plus calculator" });
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/messages/${id}$`));
    await reply(page, "Also, does it come with the cover?");
    await expect(bubble(page, "does it come with the cover")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(row).toContainText("You: Also, does it come with the cover?");
  });
});

test.describe("without the app's JavaScript (spec 7)", () => {
  test.beforeEach(async ({ page }) => {
    // The app's bundle never arrives. React's small inline script still puts streamed content in place.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
  });

  test("a first message with a swap, a reply past the scam check, and a report all work", async ({ page }) => {
    onlyAt(...BOTH);
    await signUp(page, newBuyer());
    await sendFirstMessage(page, "l-007", "Would you swap?", "A Bluetooth speaker");
    await expect(main(page).getByRole("status")).toHaveText("Sent. Sellers usually reply within a day.");
    await expect(main(page).getByText("Swap offer:")).toBeVisible();
    await reply(page, "Can I pay a deposit?");
    // A post is a full page load without the app's JavaScript, so the browser focuses the check (plan decision 9).
    const check = main(page).locator(".msg-check");
    await expect(check).toBeFocused();
    await check.getByRole("button", { name: "Send anyway" }).click();
    await expect(bubble(page, "Can I pay a deposit?")).toBeVisible();
    await page.goto("/report?seller=tech-corner");
    await main(page).getByRole("radio", { name: "Spam" }).check();
    await button(page, "Send report").click();
    await expect(page).toHaveURL(/\/report\/sent\?seller=tech-corner$/);
  });
});

test("messaging pages stay out of search engines", async ({ page }) => {
  onlyAt("desktop-1440");
  await signUp(page, newBuyer());
  for (const [path, title] of [
    ["/messages", "Messages · Vossie"],
    ["/notifications", "Notifications · Vossie"],
    ["/listings/l-002/message", "Message Book swap · Vossie"],
    ["/report?listing=l-002", "Report · Vossie"],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  }
});
