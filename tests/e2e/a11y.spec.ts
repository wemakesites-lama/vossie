import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { newBuyer, reply, sellerPage, sendFirstMessage, signUp, signUpHere } from "./helpers/messaging";
import { newSeller } from "./helpers/selling";

test.use({ reducedMotion: "reduce" });

test("the homepage", async ({ page }) => {
  await page.goto("/");
  expect(await seriousIssues(page)).toEqual([]);
});

test("the homepage scrolled to crest only", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect(page.getByRole("button", { name: "Show navigation" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Search Vossie" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the campus picker", async ({ page }) => {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await page.getByRole("button", { name: /^Shopping at/ }).click();
  } else {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /^Shopping at/ }).click();
  }
  await expect(page.getByRole("dialog", { name: "Choose your campus" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a placeholder page", async ({ page }) => {
  await page.goto("/sell");
  expect(await seriousIssues(page)).toEqual([]);
});

test("the homepage with a campus that has nothing new", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
  await page.goto("/");
  await expect(page.getByText("Nothing new at Mbombela yet")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the homepage with a campus chosen (the Just listed switch)", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
  await page.goto("/");
  await expect(page.locator("#just-listed").getByRole("group", { name: "Show new listings from" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the homepage for a returning visitor", async ({ page }) => {
  await page.goto("/listings/l-001");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("vossie_recently_viewed"))).not.toBeNull();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Pick up where you left off" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a listing page", async ({ page }) => {
  await page.goto("/listings/l-001");
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.locator("main article").first()).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse with Filters open", async ({ page }) => {
  await page.goto("/browse?cat=tech&price=under-500");
  await page.locator("details.tool-filters > summary").click();
  await expect(page.getByRole("button", { name: "Show results" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse with Sort open", async ({ page }) => {
  await page.goto("/browse?q=calculator");
  await page.locator("details.tool-sort > summary").click();
  await expect(page.getByRole("link", { name: "Best match" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("browse with nothing found", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
  await page.goto("/browse");
  await expect(page.getByText("Nothing here yet")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a sold listing", async ({ page }) => {
  await page.goto("/listings/l-026");
  expect(await seriousIssues(page)).toEqual([]);
});

test("a listing with several photos and a campus note", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "pretoria", url: baseURL! }]);
  await page.goto("/listings/l-021");
  await expect(page.getByRole("region", { name: "Photos" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a storefront", async ({ page }) => {
  await page.goto("/sellers/tech-corner");
  await expect(page.getByRole("heading", { level: 2, name: "2 listings" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a verified storefront", async ({ page }) => {
  await page.goto("/sellers/hair-studio");
  await expect(page.locator(".seller-verified")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a storefront with nothing listed", async ({ page }) => {
  await page.goto("/sellers/lash-lounge");
  await expect(page.getByText("Nothing listed right now")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("Saved, with sold and paused listings and one removed", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_saved", value: "l-001.l-026.l-016", url: baseURL! }]);
  await page.goto("/saved");
  const heart = page.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" });
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  expect(await seriousIssues(page)).toEqual([]);
});

test("Saved with nothing saved", async ({ page }) => {
  await page.goto("/saved");
  await expect(page.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a collection", async ({ page }) => {
  await page.goto("/collections/moving-in");
  await expect(page.getByText("5 listings", { exact: true })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

for (const path of ["/how-it-works", "/safety", "/trust", "/privacy", "/terms", "/seller-guidelines"]) {
  test(`the info page ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await seriousIssues(page)).toEqual([]);
  });
}

// The 404 page. The branded error page was dropped under the JS stop rule (info and system spec 2.6), so this row checks
// the 404 page on its own account.
test("the 404 page", async ({ page }) => {
  const response = await page.goto("/there-is-no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
  expect(await seriousIssues(page)).toEqual([]);
});

test("the Looking For board", async ({ page }) => {
  await page.goto("/looking-for");
  await expect(page.getByRole("region", { name: "Open requests" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the Looking For board at a campus with no requests", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
  await page.goto("/looking-for");
  await expect(page.getByText("Nothing at Mbombela yet.")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the Looking For board with nothing in a category", async ({ page }) => {
  await page.goto("/looking-for?cat=tickets-events");
  await expect(page.getByText("No requests here yet. Be the first to ask.")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a request", async ({ page }) => {
  await page.goto("/looking-for/r-001");
  await expect(page.getByRole("region", { name: "Already on Vossie" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a closed request", async ({ page }) => {
  await page.goto("/looking-for/r-015");
  await expect(page.getByText("This request is closed")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the Hub", async ({ page }) => {
  await page.goto("/hub");
  await expect(page.getByRole("list", { name: "Tips" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the Hub's office hours tab", async ({ page }) => {
  await page.goto("/hub?type=office-hours");
  await expect(page.getByRole("navigation", { name: "Post types" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a Hub event", async ({ page }) => {
  await page.goto("/hub/h-001");
  await expect(page.locator(".hub-post-action").getByText(/RSVP|This event has passed/)).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a past Hub event", async ({ page }) => {
  await page.goto("/hub/h-011");
  await expect(page.getByText("This event has passed")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a Hub tip", async ({ page }) => {
  await page.goto("/hub/h-013");
  await expect(page.locator(".hub-post-body").getByRole("heading", { level: 2 }).first()).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

// --- Sign-in and accounts (accounts plan, Task 14) ---------------------------------------------------------------

/** A new address for each test: every test shares one server and one sample store. */
const newEmail = () =>
  `a11y-${test.info().project.name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@eduvos.com`;

/** Signs in with a sample account's button (accounts spec 2.8). It lands on /account. */
async function signInAsSample(page: Page, label = "Student, Midrand") {
  await page.goto("/login");
  await page.locator("main").getByRole("button", { name: label, exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}

/** Step 1 with a new address, ending on step 2. */
async function toStep2(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Your Eduvos email address", { exact: true }).fill(newEmail());
  await page.getByLabel("I agree to the privacy policy", { exact: true }).check();
  await page.locator("main").getByRole("button", { name: "Send code", exact: true }).click();
  await expect(page.getByLabel("6-digit code", { exact: true })).toBeVisible();
}

test("sign in, step 1, with the sample accounts", async ({ page }) => {
  await page.goto("/login?next=%2Flistings%2Fl-001");
  await expect(page.getByRole("heading", { level: 2, name: "Sign in as a sample account" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("sign in, step 1, with errors", async ({ page }) => {
  await page.goto("/login");
  await page.locator("main").getByRole("button", { name: "Send code", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("sign in, step 2, with the sample code and a wrong code", async ({ page }) => {
  await toStep2(page);
  const code = (await page.locator("main .signin-sample-code strong").textContent()) ?? "";
  await page.getByLabel("6-digit code", { exact: true }).fill(code === "111111" ? "222222" : "111111");
  await page.locator("main").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("sign in, step 3", async ({ page }) => {
  await toStep2(page);
  const code = (await page.locator("main .signin-sample-code strong").textContent()) ?? "";
  await page.getByLabel("6-digit code", { exact: true }).fill(code);
  await page.locator("main").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Your first name", { exact: true })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the sign-in page when signed in already", async ({ page }) => {
  await signInAsSample(page);
  await page.goto("/login?next=%2Fsellers%2Ftech-corner");
  await expect(page.getByText(/You're signed in as/)).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("your account, after a save that went wrong", async ({ page }) => {
  await signInAsSample(page);
  await page.getByLabel("Your first name", { exact: true }).fill("T");
  await page.locator("main").getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("privacy settings, with the box missed", async ({ page }) => {
  await signInAsSample(page);
  await page.goto("/account/privacy");
  await page.locator("main").getByRole("button", { name: "Delete my account", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the menu, signed in", async ({ page }) => {
  await signInAsSample(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

// --- Messaging (messaging plan, Task 16) --------------------------------------------------------------------------

/**
 * Signs in with a sample account's button, landing on `next`. The sample student is only read here, except that
 * opening a thread or /notifications marks the student's sample notifications read, which no test counts.
 */
async function signInTo(page: Page, label: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.locator("main").getByRole("button", { name: label, exact: true }).click();
  await page.waitForURL((url) => `${url.pathname}${url.search}` === next);
}

/**
 * The composer's title comes from generateMetadata, which Next puts in a moment after the page itself on a client
 * navigation (watched after the sign-in's redirect, every time): for a tick the document has the new heading and no
 * <title>, and axe's document-title rule caught it once. The settled page has one, so wait for it before checking.
 */
const titled = (page: Page) => expect(page).toHaveTitle(/\S/);

test("the composer, with its tips", async ({ page }) => {
  await signInTo(page, "Student, Midrand", "/listings/l-002/message");
  await expect(page.getByRole("heading", { level: 1, name: "Message Book swap" })).toBeVisible();
  await titled(page);
  expect(await seriousIssues(page)).toEqual([]);
});

test("the composer, with errors and then the scam check", async ({ page }) => {
  // Thandi has a conversation about l-007, so the mentor, who has none, sees the form. A failed post and the check
  // only write form state for this browser's session.
  await signInTo(page, "Mentor", "/listings/l-007/message");
  await page.locator("main").getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  await titled(page);
  expect(await seriousIssues(page)).toEqual([]);
  await page.getByLabel("Your message", { exact: true }).fill("Can I pay a deposit first?");
  await page.locator("main").getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Check this before you send" })).toBeVisible();
  await titled(page);
  expect(await seriousIssues(page)).toEqual([]);
});

test("the inbox, Selling", async ({ page }) => {
  await signInTo(page, "Seller, Tech corner", "/messages?tab=selling");
  await expect(page.locator("main").getByRole("link", { name: "Selling", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator("main .inbox-row").first()).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the inbox, Buying", async ({ page }) => {
  // A second sign-in on the same page would meet "You're signed in as…" and no sample buttons, so this is its own test.
  await signInTo(page, "Student, Midrand", "/messages");
  await expect(page.locator("main .inbox-row").first()).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a thread, as the seller, with Mark as completed", async ({ page }) => {
  // Sipho has read everything in the sample conversations, so opening one changes nothing.
  await signInTo(page, "Seller, Tech corner", "/messages/conv-s1");
  await expect(page.getByRole("button", { name: "Mark as completed" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a thread, as the buyer, with a sale to confirm", async ({ page, browser, baseURL }) => {
  // A conversation of the test's own: the sample one confirms itself a week after 13 October (spec 2.5).
  await signUp(page, newBuyer());
  const id = await sendFirstMessage(page, "l-001", "Hi! Is it still available?");
  const seller = await sellerPage(browser, baseURL!);
  await seller.goto(`/messages/${id}`);
  await reply(seller, "Yes, it is.");
  await seller.locator("main").getByRole("button", { name: "Mark as completed", exact: true }).click();
  await expect(seller.locator("main .status-pill").filter({ visible: true })).toHaveText("Done");
  await seller.context().close();
  await page.reload();
  await expect(page.getByRole("region", { name: "Did the sale happen?" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("report, with an error", async ({ page }) => {
  await signInTo(page, "Mentor", "/report?listing=l-002");
  await page.locator("main").getByRole("button", { name: "Send report", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the report's thank-you", async ({ page }) => {
  await page.goto("/report/sent?listing=l-001");
  await expect(page.getByRole("link", { name: "Back to the listing" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("notifications, with one that's new", async ({ page, browser, baseURL }) => {
  // A buyer of the test's own (plan decision 23), not the sample student: opening /notifications marks them read, and
  // the signed-in homepage's layout-shift row counts on the student's sample notifications still being new.
  await signUp(page, newBuyer());
  const id = await sendFirstMessage(page, "l-001", "Hi! Is it still available?");
  const seller = await sellerPage(browser, baseURL!);
  await seller.goto(`/messages/${id}`);
  await reply(seller, "Yes, it is.");
  await seller.context().close();
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(page.locator("main .notes-new").filter({ visible: true })).toHaveText("New");
  expect(await seriousIssues(page)).toEqual([]);
});

test("notifications, with none", async ({ page }) => {
  // A new account has none, and the empty state is its own page.
  await signUp(page, newBuyer());
  await page.goto("/notifications");
  await expect(page.getByText("Nothing new.")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the header with a new notification's badge, and the account page's counts", async ({ page, browser, baseURL }) => {
  // A buyer of the test's own, so the badge is certain to be there (plan decision 23).
  await signUp(page, newBuyer());
  const id = await sendFirstMessage(page, "l-001", "Hi!");
  const seller = await sellerPage(browser, baseURL!);
  await seller.goto(`/messages/${id}`);
  await reply(seller, "Yes, it is.");
  await seller.context().close();
  await page.goto("/");
  await expect(page.locator(".site-header .hdr-badge-alert")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await page.goto("/account");
  await expect(page.getByRole("link", { name: /^Notifications\s*,\s*1 new$/ })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

// --- Selling (selling plan, Task 17) ------------------------------------------------------------------------------
// Everything here only reads, or fails a form's check, which writes nothing a buyer sees (plan decision 25): the pages
// and states that need a listing made, paused, sold or deleted are in selling-writes.spec.ts. The sample seller is
// Tech corner's; the sample shop waiting for approval is Crochet corner's. A new student does the wizard, so no sample
// account gets a draft (accounts plan decision 22).

test("the selling pitch", async ({ page }) => {
  await page.goto("/sell");
  await expect(page.getByRole("heading", { level: 1, name: /Turn your hustle into a campus-wide business/ })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("waiting for approval", async ({ page }) => {
  await signInAsSample(page, "Seller waiting for approval");
  await page.goto("/sell");
  await expect(page.getByRole("heading", { level: 1, name: "The Hub is checking your shop" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the shop waiting for approval: its listings, its listing form and its shop form", async ({ page }) => {
  // A waiting shop's listing form offers drafts only (plan decision 4), and its shop has no photo yet.
  await signInAsSample(page, "Seller waiting for approval");
  await page.goto("/sell/listings");
  await expect(page.getByText("Your shop is waiting for the Hub, so your listings stay drafts")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await page.goto("/sell/listings/new");
  await expect(page.getByText("Your shop is waiting for the Hub. Save your listing as a draft now")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  // Its link follows its name until it's approved (plan decision 16), so the form has no link field.
  await page.goto("/sell/profile");
  await expect(page.getByLabel("Shop name", { exact: true })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the dashboard, my listings in each tab and delete's confirmation", async ({ page }) => {
  await signInAsSample(page, "Seller, Tech corner");
  await page.goto("/sell");
  await expect(page.getByRole("region", { name: "In the last 7 days" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  // Tech corner has two available listings and nothing paused, sold or in drafts: the tab with rows, then the three
  // empty ones.
  await page.goto("/sell/listings");
  await expect(page.getByRole("navigation", { name: "Listings by state" })).toBeVisible();
  await expect(page.locator("main .sell-item").filter({ visible: true })).toHaveCount(2);
  expect(await seriousIssues(page)).toEqual([]);
  for (const [tab, empty] of [
    ["paused", "Nothing paused."],
    ["sold", "Nothing sold yet."],
    ["drafts", "No drafts."],
  ]) {
    await page.goto(`/sell/listings?tab=${tab}`);
    await expect(page.getByText(empty, { exact: true })).toBeVisible();
    expect(await seriousIssues(page), `the ${tab} tab`).toEqual([]);
  }
  await page.goto("/sell/listings/l-001/delete");
  await expect(page.locator("main").getByRole("button", { name: "Delete listing" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the listing form, with its photos, and with errors", async ({ page }) => {
  await signInAsSample(page, "Seller, Tech corner");
  await page.goto("/sell/listings/l-001/edit");
  await expect(page.locator("main").getByText("Photo 3", { exact: true })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  // A new listing saved empty changes nothing in the store but this browser's form state.
  await page.goto("/sell/listings/new");
  await page.locator("main").getByRole("button", { name: "Save and publish", exact: true }).click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the shop form, and with errors", async ({ page }) => {
  await signInAsSample(page, "Seller, Tech corner");
  await page.goto("/sell/profile");
  await expect(page.getByLabel("Your shop's link", { exact: true })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  // A name and a link that fail their checks save nothing, so Tech corner stays as it is.
  await page.getByLabel("Shop name", { exact: true }).fill("");
  await page.getByLabel("Your shop's link", { exact: true }).fill("a");
  await page.locator("main").getByRole("button", { name: /^Save/ }).first().click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the owner's own listing page and storefront", async ({ page }) => {
  await signInAsSample(page, "Seller, Tech corner");
  await page.goto("/listings/l-001");
  await expect(page.getByRole("link", { name: "Edit listing" }).filter({ visible: true })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
  await page.goto("/sellers/tech-corner");
  await expect(page.getByRole("link", { name: "Edit shop" }).filter({ visible: true })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the wizard's steps, each with an error, and the pitch for a student part-way through", async ({ page }) => {
  // A new student, so no sample account gets a draft (accounts plan decision 22).
  await page.goto("/login?next=%2Fsell%2Fonboarding");
  await signUpHere(page, newSeller());
  await expect(page).toHaveURL(/\/sell\/onboarding$/);
  const main = page.locator("main");
  const problem = page.getByRole("alert", { name: "There's a problem" });
  await main.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(problem).toBeVisible();
  expect(await seriousIssues(page), "step 1").toEqual([]);
  // Step 2 and step 4 each with nothing answered. Step 3's photo is optional, so it has no error to show.
  await page.goto("/sell/onboarding?step=2");
  await main.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(problem).toBeVisible();
  expect(await seriousIssues(page), "step 2").toEqual([]);
  await page.goto("/sell/onboarding?step=3");
  await expect(page.getByText("Step 3 of 5", { exact: false })).toBeVisible();
  expect(await seriousIssues(page), "step 3").toEqual([]);
  await page.goto("/sell/onboarding?step=4");
  await main.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(problem).toBeVisible();
  expect(await seriousIssues(page), "step 4").toEqual([]);
  // The review with its answers missing, then Send for approval, which goes back to the first step that's wrong.
  await page.goto("/sell/onboarding?step=5");
  await expect(main.getByRole("region", { name: "Your answers" })).toBeVisible();
  expect(await seriousIssues(page), "step 5").toEqual([]);
  await main.getByRole("button", { name: "Send for approval", exact: true }).click();
  await expect(problem).toBeVisible();
  expect(await seriousIssues(page), "after Send for approval").toEqual([]);
  // Part-way through, /sell offers to carry on.
  await page.goto("/sell");
  await expect(page.getByRole("link", { name: "Continue setting up your shop" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("an error summary's link brings its field's label into view below the sticky header (amendment 13.9)", async ({ page }) => {
  // Edit shop's link field has the longest hint, three lines on a phone: the label sits furthest above its field.
  await signInAsSample(page, "Seller, Tech corner");
  await page.goto("/sell/profile");
  await page.getByLabel("Shop name", { exact: true }).fill("");
  await page.getByLabel("Your shop's link", { exact: true }).fill("a");
  await page.locator("main").getByRole("button", { name: /^Save/ }).first().click();
  await expect(page.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  const links = page.locator("main .form-summary-list a[href^='#']").filter({ visible: true });
  expect(await links.count()).toBe(2);
  for (const index of [0, 1]) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const href = await links.nth(index).getAttribute("href");
    await links.nth(index).click();
    const field = page.locator(href!);
    await expect(field).toBeFocused();
    // How far the field's label is below the bottom of the sticky header. The page may still be scrolling to it.
    await expect
      .poll(
        () =>
          field.evaluate((element) => {
            const label = document.querySelector(`label[for="${element.id}"]`)!;
            return Math.round(label.getBoundingClientRect().top - document.querySelector(".site-header")!.getBoundingClientRect().bottom);
          }),
        { message: `the label of ${href} below the header` },
      )
      .toBeGreaterThanOrEqual(0);
  }
});
