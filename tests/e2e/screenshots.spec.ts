import { expect, test, type Page, type Request } from "@playwright/test";
import { offersPanel, postRequest, statusLine } from "./helpers/community";
import { button, field, newBuyer, reply, sellerPage, signInAsSample, signUp, signUpHere } from "./helpers/messaging";
import { newSeller, photoWithLocation, POST_LANDS, uniqueWord } from "./helpers/selling";

test.skip(!process.env.SCREENSHOTS, "Run with SCREENSHOTS=1 to refresh the review screenshots");

test("shell review screenshots", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/part-1/${project}-${name}.png`;
  const shot = (name: string) => page.screenshot({ path: file(name) });
  const menu = page.getByRole("dialog", { name: "Menu" });
  const search = page.getByRole("dialog", { name: "Search CampusCart" });
  const picker = page.getByRole("dialog", { name: "Choose your campus" });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await shot("01-top");

  // The file names are the first header's; the states are now hidden and shown (spec section 6.2, 2026-10-20).
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(page.locator(".site-header")).toHaveAttribute("data-mode", "hidden");
  await shot("02-crest-only");

  await page.mouse.wheel(0, -60);
  await expect(page.locator(".site-header")).toHaveAttribute("data-mode", "shown");
  await shot("03-revealed");

  // Each overlay is waited for before its shot, and waited out after Escape before the next step.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(menu).toBeVisible();
  await shot("04-menu");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(search).toBeVisible();
  await shot("05-search");
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();

  if (project === "desktop-1440") {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: /^Shopping at/ }).click();
  } else {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: /^Shopping at/ }).click();
    await expect(menu).toBeHidden();
  }
  await expect(picker).toBeVisible();
  await shot("06-campus-picker");
  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();

  // The whole footer, with the sticky header hidden so it can't sit over the top of it. The fonts are in first, so
  // the wordmark is fitted.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.getByRole("contentinfo").screenshot({
    path: file("07-footer"),
    style: ".site-header { visibility: hidden !important; }",
  });
});

test("homepage review screenshots", async ({ page, context, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/part-2/${project}-${name}.png`;

  // The shots wait for photos, not for "networkidle": from the second visit in a browser context, Playwright counts
  // Next's cached link prefetches as never finished, so the page never goes quiet. Only photo requests are tracked.
  const photosInFlight = new Set<Request>();
  page.on("request", (request) => {
    if (request.resourceType() === "image") photosInFlight.add(request);
  });
  page.on("requestfinished", (request) => photosInFlight.delete(request));
  page.on("requestfailed", (request) => photosInFlight.delete(request));

  /** Scroll the whole page so every lazy photo loads, then come back to the top for a full-page shot. */
  async function wholePage(name: string) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.scrollTo(0, 0);
      await document.fonts.ready;
    });
    await expect.poll(() => photosInFlight.size).toBe(0);
    await expect(page.locator(".site-header")).toHaveAttribute("data-mode", "expanded");
    await page.screenshot({ path: file(name), fullPage: true });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.screenshot({ path: file("01-first-screen") });
  await wholePage("02-whole-page");

  await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
  await page.goto("/");
  await wholePage("03-whole-page-midrand");
});

test("browse and listing review screenshots", async ({ page, context, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/browse-listing/${project}-${name}.png`;

  /** Scroll the whole page so every lazy photo loads, then come back to the top. */
  async function settle() {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.scrollTo(0, 0);
      await document.fonts.ready;
    });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });

  // Both pages stream their body behind a skeleton, so each shot waits for the page's own heading first.
  const title = page.getByRole("heading", { level: 1 });

  await page.goto("/browse");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("01-browse"), fullPage: true });

  await page.locator("details.tool-filters > summary").click();
  await page.screenshot({ path: file("02-browse-filters") });

  await page.goto("/browse?q=calculator");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("03-browse-search") });

  await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
  await page.goto("/browse");
  await expect(page.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeVisible();
  await page.screenshot({ path: file("04-browse-empty") });
  await context.clearCookies();

  await page.goto("/listings/l-001");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("05-listing") });
  await page.screenshot({ path: file("06-listing-whole"), fullPage: true });

  await page.goto("/listings/l-026");
  await expect(title).toBeVisible();
  await page.screenshot({ path: file("07-listing-sold") });
});

test("shopping review screenshots", async ({ page, context, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/shopping/${project}-${name}.png`;

  /** Scroll the whole page so every lazy photo loads, then come back to the top. */
  async function settle() {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.scrollTo(0, 0);
      await document.fonts.ready;
    });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });

  // Saved streams its list behind a skeleton, so each shot waits for something the finished page shows.
  const title = page.getByRole("heading", { level: 1 });

  await page.goto("/sellers/tech-corner");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("01-storefront"), fullPage: true });

  await page.goto("/sellers/hair-studio");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("02-storefront-verified") });

  await page.goto("/sellers/lash-lounge");
  await expect(page.getByText("Nothing listed right now")).toBeVisible();
  await page.screenshot({ path: file("03-storefront-empty"), fullPage: true });

  await context.addCookies([{ name: "vossie_saved", value: "l-001.l-026.l-016.l-007.l-004", url: baseURL! }]);
  await page.goto("/saved");
  await expect(page.getByText("5 saved", { exact: true })).toBeVisible();
  await settle();
  await page.screenshot({ path: file("04-saved"), fullPage: true });

  const calculator = page.locator("main article").filter({ hasText: "Casio fx-991ZA Plus calculator" });
  await calculator.getByRole("button", { name: "Save Casio fx-991ZA Plus calculator" }).click();
  await expect(calculator.getByText("Removed", { exact: true })).toBeVisible();
  await page.screenshot({ path: file("05-saved-removed") });
  await context.clearCookies();

  await page.goto("/saved");
  await expect(page.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeVisible();
  await page.screenshot({ path: file("06-saved-empty") });

  await page.goto("/collections/moving-in");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("07-collection"), fullPage: true });

  await page.goto("/collections/start-of-semester");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("08-collection-first-screen") });
});

test("info and system review screenshots", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/info-system/${project}-${name}.png`;

  await page.emulateMedia({ reducedMotion: "reduce" });
  const title = page.getByRole("heading", { level: 1 });
  const fontsIn = () => page.evaluate(() => document.fonts.ready.then(() => undefined));

  const pages: Array<[name: string, path: string]> = [
    ["01-how-it-works", "/how-it-works"],
    ["02-safety", "/safety"],
    ["03-trust", "/trust"],
    ["04-privacy", "/privacy"],
    ["05-terms", "/terms"],
    ["06-seller-guidelines", "/seller-guidelines"],
  ];
  for (const [name, path] of pages) {
    await page.goto(path);
    await expect(title).toBeVisible();
    await fontsIn();
    await page.screenshot({ path: file(name), fullPage: true });
  }

  // The first screen of a draft page, where the banner and the contents list sit.
  await page.goto("/privacy");
  await expect(title).toBeVisible();
  await fontsIn();
  await page.screenshot({ path: file("07-privacy-first-screen") });

  // The branded error page was dropped (decision 62) and can't be reached on purpose anyway, so the 404 page
  // stands in as the system page.
  await page.goto("/there-is-no-such-page");
  await expect(title).toHaveText("We couldn't find that page");
  await page.screenshot({ path: file("08-not-found") });
});

test("community review screenshots", async ({ page, context, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/community/${project}-${name}.png`;

  /** Scroll the whole page so every lazy photo loads, then come back to the top. */
  async function settle() {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.scrollTo(0, 0);
      await document.fonts.ready;
    });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });

  // The board, the feed and a post's action stream in behind skeletons, so each shot waits for something the finished
  // page shows.
  const title = page.getByRole("heading", { level: 1 });

  await page.goto("/looking-for");
  await expect(page.getByRole("region", { name: "Open requests" })).toBeVisible();
  await settle();
  await page.screenshot({ path: file("01-board"), fullPage: true });

  await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
  await page.goto("/looking-for");
  await expect(page.getByRole("region", { name: "At Midrand" })).toBeVisible();
  await page.screenshot({ path: file("02-board-campus") });
  await context.clearCookies();

  await page.goto("/looking-for?cat=tickets-events");
  await expect(page.getByText("No requests here yet. Be the first to ask.")).toBeVisible();
  await page.screenshot({ path: file("03-board-empty") });

  await page.goto("/looking-for/r-001");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("04-request"), fullPage: true });

  await page.goto("/looking-for/r-015");
  await expect(page.getByText("This request is closed")).toBeVisible();
  await page.screenshot({ path: file("05-request-closed") });

  await page.goto("/hub");
  await expect(page.getByRole("list", { name: "Tips" })).toBeVisible();
  await settle();
  await page.screenshot({ path: file("06-hub"), fullPage: true });

  await page.goto("/hub#hub-tips");
  await expect(page.getByRole("list", { name: "Tips" })).toBeVisible();
  await page.screenshot({ path: file("07-hub-tips") });

  await page.goto("/hub/h-001");
  await expect(page.locator(".hub-post-action").getByText(/RSVP|This event has passed/)).toBeVisible();
  await settle();
  await page.screenshot({ path: file("08-hub-event"), fullPage: true });

  await page.goto("/hub/h-013");
  await expect(title).toBeVisible();
  await settle();
  await page.screenshot({ path: file("09-hub-tip"), fullPage: true });

  await page.goto("/hub/h-012");
  await expect(page.getByText("These office hours have passed")).toBeVisible();
  // Full page: at 1440px the "have passed" line sits below the first screen.
  await page.screenshot({ path: file("10-hub-past"), fullPage: true });
});

test("accounts review screenshots", async ({ page, context }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/accounts/${project}-${name}.png`;
  const main = page.locator("main");
  const alert = page.getByRole("alert", { name: "There's a problem" });
  // A new address each run: the screenshots share the sample store with nothing else, but a rerun mustn't reuse one.
  const email = `shots-${project}-${Date.now().toString(36)}@eduvos.com`;

  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/login?next=%2Flistings%2Fl-001");
  await expect(main.getByRole("heading", { level: 2, name: "Sign in as a sample account" })).toBeVisible();
  await page.screenshot({ path: file("01-sign-in"), fullPage: true });

  await main.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(alert).toBeVisible();
  await page.screenshot({ path: file("02-sign-in-errors"), fullPage: true });

  await page.getByLabel("Your Eduvos email address", { exact: true }).fill(email);
  await page.getByLabel("I agree to the privacy policy", { exact: true }).check();
  await main.getByRole("button", { name: "Send code", exact: true }).click();
  const code = (await main.locator(".signin-sample-code strong").textContent()) ?? "";
  await page.getByLabel("6-digit code", { exact: true }).fill(code === "111111" ? "222222" : "111111");
  await main.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(alert).toContainText("4 tries left");
  await page.screenshot({ path: file("03-code-wrong"), fullPage: true });

  await page.getByLabel("6-digit code", { exact: true }).fill(code);
  await main.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Your first name", { exact: true })).toBeVisible();
  await page.screenshot({ path: file("04-first-sign-in"), fullPage: true });

  await page.getByLabel("Your first name", { exact: true }).fill("Ayanda");
  await page.getByLabel("Your campus", { exact: true }).selectOption({ label: "Pretoria" });
  await main.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/listings\/l-001$/);

  await page.goto("/login");
  await expect(main.getByText(/You're signed in as/)).toBeVisible();
  await page.screenshot({ path: file("05-signed-in-already") });

  await page.goto("/account/details");
  await expect(main.getByRole("heading", { level: 2, name: "Ayanda" })).toBeVisible();
  await page.screenshot({ path: file("06-your-details"), fullPage: true });

  await main.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(main.getByRole("status")).toHaveText("Your details are saved.");
  await page.screenshot({ path: file("07-your-details-saved") });

  await page.goto("/account/privacy");
  await main.getByRole("button", { name: "Delete my account", exact: true }).click();
  await expect(alert).toBeVisible();
  await page.screenshot({ path: file("08-privacy-settings"), fullPage: true });

  // The Delete button is far down the page, so the header has folded to its crest. Back to the top for the Menu button.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.screenshot({ path: file("09-menu-signed-in") });

  await menu.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator(".toast")).toHaveText("You're signed out");
  await page.screenshot({ path: file("10-signed-out-toast") });
  await context.clearCookies();
});

test("messaging review screenshots", async ({ page, browser, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  // Twelve pages, two browsers and a sign-up, on a server a full run may be busy with.
  test.setTimeout(120_000);
  const file = (name: string) => `docs/progress/messaging/${project}-${name}.png`;
  const main = page.locator("main");
  const landed = { timeout: 20_000 };

  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUp(page, newBuyer());

  await page.goto("/listings/l-007/message");
  await expect(main.getByRole("region", { name: "Stay safe" })).toBeVisible();
  await expect(page).toHaveTitle("Message Tech corner · CampusCart");
  await page.screenshot({ path: file("01-composer"), fullPage: true });

  await page.getByLabel("Your message", { exact: true }).fill("Hi! Can I pay a deposit to hold it?");
  await page.getByLabel("Offer a swap (optional)", { exact: true }).fill("A Bluetooth speaker, barely used");
  await main.getByRole("button", { name: "Send", exact: true }).click();
  await expect(main.getByRole("alert", { name: "Check this before you send" })).toBeVisible();
  await page.screenshot({ path: file("02-scam-check"), fullPage: true });

  await main.getByRole("button", { name: "Send anyway", exact: true }).click();
  await expect(page).toHaveURL(/\/messages\/conv-[0-9a-f-]{36}$/, landed);
  await expect(main.getByRole("status")).toHaveText("Sent. Sellers usually reply within a day.");
  const id = page.url().split("/").at(-1)!;
  await page.screenshot({ path: file("03-thread-sent"), fullPage: true });

  // The seller's side, in a browser of their own at the same size.
  const seller = await sellerPage(browser, baseURL!);
  await seller.emulateMedia({ reducedMotion: "reduce" });
  await seller.setViewportSize(page.viewportSize()!);
  await seller.goto("/messages?tab=selling");
  await expect(seller.locator("main .inbox-row").first()).toBeVisible();
  await seller.screenshot({ path: file("04-inbox-selling"), fullPage: true });
  await seller.goto(`/messages/${id}`);
  // No "deposit" here: the scam check runs on the seller's replies too (plan decision 9), and would hold this one.
  await reply(seller, "Hi! Happy to swap. Can I see the speaker first?\nI'm at the library entrance after 12:00.");
  await expect(seller.locator("main").getByRole("button", { name: "Mark as completed" })).toBeVisible();
  await seller.screenshot({ path: file("05-thread-seller"), fullPage: true });
  await seller.locator("main").getByRole("button", { name: "Mark as completed" }).click();
  await expect(seller.locator("main .status-pill").filter({ visible: true })).toHaveText("Done");
  await seller.context().close();

  // Opening the thread marks its notifications read (plan decision 12), so the pages that show something new are shot
  // first, and the thread (06) after them. The buyer has two new notifications here: the reply and the sale to confirm.
  await page.goto("/");
  await expect(page.locator(".site-header .hdr-badge-alert")).toBeVisible();
  await page.screenshot({ path: file("07-header-badge") });

  await page.goto("/messages");
  await expect(main.locator(".inbox-row").first()).toBeVisible();
  await page.screenshot({ path: file("08-inbox"), fullPage: true });

  await page.goto("/account");
  await expect(main.getByRole("link", { name: /^Notifications/ })).toBeVisible();
  await page.screenshot({ path: file("09-account"), fullPage: true });

  await page.goto("/notifications");
  await expect(main.getByText("New", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: file("10-notifications"), fullPage: true });

  await page.goto(`/messages/${id}`);
  await expect(page.getByRole("region", { name: "Did the sale happen?" })).toBeVisible();
  await page.screenshot({ path: file("06-sale-to-confirm"), fullPage: true });

  await page.goto("/report?listing=l-001");
  await main.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(main.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  // Send report is low on the page on a phone, so the header has folded to its crest, which a full-page shot would
  // draw over the reasons. Back to the top first.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: file("11-report"), fullPage: true });

  await main.getByRole("radio", { name: "Misleading listing" }).check();
  await main.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(main.getByRole("heading", { level: 1, name: "Report sent" })).toBeVisible();
  await page.screenshot({ path: file("12-report-sent") });
});

test("selling review screenshots", async ({ page, browser, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  // A new student through the wizard, then the sample seller's pages in a second browser, on a server a full run may be
  // busy with.
  test.setTimeout(150_000);
  const file = (name: string) => `docs/progress/selling/${project}-${name}.png`;
  const main = page.locator("main");
  // Back to the top first: after a focus jump to an error summary the header has folded to its crest, which a full-page
  // shot would draw over the form.
  const shot = async (on: Page, name: string, fullPage = true) => {
    await on.evaluate(() => window.scrollTo(0, 0));
    await on.screenshot({ path: file(name), fullPage });
  };

  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/sell");
  await expect(main.getByRole("link", { name: "Start selling" }).filter({ visible: true }).first()).toBeVisible();
  await shot(page, "01-pitch");

  // A new student through the wizard: nothing of the sample accounts changes.
  await page.goto("/login?next=%2Fsell%2Fonboarding");
  await signUpHere(page, newSeller());
  await expect(page).toHaveURL(/\/sell\/onboarding$/, POST_LANDS);
  await button(page, "Continue").click();
  await expect(main.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  await shot(page, "02-wizard-step-1-error");
  await field(page, "Shop name").fill(`Bakes ${uniqueWord()}`.slice(0, 60));
  await field(page, "Main category").selectOption({ label: "Food" });
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=2$/, POST_LANDS);
  await field(page, "About your shop").fill("I bake between lectures.\nMuffins on Mondays.");
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=3$/, POST_LANDS);
  await field(page, "Shop photo (optional)").setInputFiles(photoWithLocation("shop.png"));
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=4$/, POST_LANDS);
  await expect(main.getByText(/^Step 4 of 5/).filter({ visible: true })).toBeVisible();
  await shot(page, "03-wizard-step-4");
  await main.getByRole("checkbox", { name: "Library entrance" }).check();
  await button(page, "Continue").click();
  await expect(page).toHaveURL(/step=5$/, POST_LANDS);
  await expect(main.getByRole("region", { name: "Your answers" })).toBeVisible();
  await shot(page, "04-wizard-review");
  await main.getByRole("checkbox", { name: "I've read the seller guidelines" }).check();
  await button(page, "Send for approval").click();
  await expect(page).toHaveURL(/\/sell$/, POST_LANDS);
  await expect(page.getByRole("heading", { level: 1, name: "The Hub is checking your shop" })).toBeVisible();
  await shot(page, "05-waiting");

  // The sample seller in a browser of their own: only read, so the sample stays as it is.
  const context = await browser.newContext({ baseURL, serviceWorkers: "block", viewport: page.viewportSize()!, reducedMotion: "reduce" });
  const seller = await context.newPage();
  const sellerMain = seller.locator("main");
  const sellerShot = (name: string, fullPage = true) => shot(seller, name, fullPage);
  await signInAsSample(seller, "Seller, Tech corner", "/sell");
  await expect(sellerMain.getByRole("region", { name: "In the last 7 days" })).toBeVisible();
  await sellerShot("06-dashboard");
  await seller.goto("/sell/listings");
  await expect(sellerMain.getByRole("navigation", { name: "Listings by state" })).toBeVisible();
  await sellerShot("07-my-listings");
  await seller.goto("/sell/listings/l-001/edit");
  await expect(sellerMain.getByText("Photo 3", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await sellerShot("08-listing-form");
  await seller.goto("/sell/listings/new");
  await button(seller, "Save and publish").click();
  await expect(sellerMain.getByRole("alert", { name: "There's a problem" })).toBeVisible();
  await sellerShot("09-listing-form-errors");
  await seller.goto("/sell/listings/l-001/delete");
  await expect(seller.getByRole("heading", { level: 1 })).toContainText("Delete");
  await sellerShot("10-delete");
  await seller.goto("/sell/profile");
  await expect(seller.getByRole("heading", { level: 1 })).toBeVisible();
  await sellerShot("11-edit-shop");
  await seller.goto("/listings/l-001");
  await expect(seller.getByRole("link", { name: "Edit listing" }).filter({ visible: true })).toBeVisible();
  await sellerShot("12-listing-owner", false);
  await context.close();
});

test("staff tools review screenshots", async ({ page, browser, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  // Three browsers and fourteen pages, on a server a full run may be busy with.
  test.setTimeout(180_000);
  const file = (name: string) => `docs/progress/staff/${project}-${name}.png`;
  // Back to the top first: after a focus jump to an error summary the header has folded to its crest, which a full-page
  // shot would draw over the page.
  const shot = async (on: Page, name: string) => {
    await on.evaluate(() => window.scrollTo(0, 0));
    await on.screenshot({ path: file(name), fullPage: true });
  };
  const heading = (on: Page, name: string) =>
    expect(on.locator("main").getByRole("heading", { level: 1, name })).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });

  // The admin only reads, so nothing the other tests count changes.
  await signInAsSample(page, "Admin", "/admin");
  await heading(page, "Overview");
  await shot(page, "01-overview");
  await page.goto("/admin/sellers");
  await heading(page, "Sellers");
  await shot(page, "02-sellers");
  await page.goto("/admin/sellers/crochet-corner");
  await heading(page, "Crochet corner");
  await shot(page, "03-review-waiting");
  await page.goto("/admin/sellers/crochet-corner/decline");
  await heading(page, "Decline Crochet corner");
  await button(page, "Decline Crochet corner").click();
  await expect(page.locator("main").getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
  await shot(page, "04-decline-errors");
  await page.goto("/admin/sellers/tech-corner");
  await heading(page, "Tech corner");
  await shot(page, "05-review-open");
  await page.goto("/admin/reports");
  await heading(page, "Reports");
  await shot(page, "06-reports");
  await page.goto("/admin/featured");
  await heading(page, "Featured");
  await shot(page, "07-featured");
  await page.goto("/admin/pickup-points");
  await heading(page, "Pickup points");
  await shot(page, "08-pickup-points");
  await page.goto("/admin/audit");
  await heading(page, "Audit log");
  await shot(page, "09-audit-log");

  // The mentor, in a browser of their own. Preview saves nothing.
  const mentorContext = await browser.newContext({ baseURL, serviceWorkers: "block", viewport: page.viewportSize()!, reducedMotion: "reduce" });
  const mentor = await mentorContext.newPage();
  const mentorMain = mentor.locator("main");
  await signInAsSample(mentor, "Mentor", "/hub/manage");
  await expect(mentorMain.getByRole("heading", { level: 2, name: "Office-hours requests" })).toBeVisible();
  await shot(mentor, "10-hub-posts");
  await mentor.goto("/hub/new");
  await heading(mentor, "Write a post");
  await field(mentor, "Title").fill("Market day at the Hub");
  await field(mentor, "The post").fill("## Bring\n- A table\n- A float\n\nStalls are **free**.");
  await button(mentor, "Preview").click();
  await expect(mentorMain.getByRole("region", { name: "Preview" })).toBeVisible(POST_LANDS);
  await shot(mentor, "11-post-preview");
  await mentor.goto("/mentor?view=all");
  await expect(mentorMain.getByRole("region", { name: "Your shops" })).toBeVisible();
  await shot(mentor, "12-mentor-dashboard");
  await mentor.goto("/mentor/tech-corner");
  await expect(mentorMain.getByRole("region", { name: "Notes and check-ins" })).toBeVisible();
  await shot(mentor, "13-mentor-shop");
  await mentorContext.close();

  // Thandi's sample slot request at h-007 (upcoming until 19 November 2026), as she sees it.
  const studentContext = await browser.newContext({ baseURL, serviceWorkers: "block", viewport: page.viewportSize()!, reducedMotion: "reduce" });
  const student = await studentContext.newPage();
  await signInAsSample(student, "Student, Midrand", "/hub/h-007/book");
  await expect(student.locator("main").getByRole("region", { name: "Your request" })).toBeVisible();
  await shot(student, "14-slot-request");
  await studentContext.close();
});

test("community actions review screenshots", async ({ page, browser, baseURL }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  // A new student, their request, the sample shop's offer in a second browser, a follow and eleven pages, on a server a
  // full run may be busy with.
  test.setTimeout(180_000);
  const file = (name: string) => `docs/progress/community-actions/${project}-${name}.png`;
  const main = page.locator("main");
  // Back to the top first: after a focus jump to an error summary the header has folded to its crest, which a full-page
  // shot would draw over the page.
  const shot = async (on: Page, name: string, fullPage = true) => {
    await on.evaluate(() => window.scrollTo(0, 0));
    await on.screenshot({ path: file(name), fullPage });
  };

  await page.emulateMedia({ reducedMotion: "reduce" });
  // A new student, so nothing of the sample accounts changes. The request is theirs alone.
  await signUp(page, newBuyer());

  await page.goto("/looking-for/new");
  await button(page, "Post request").click();
  await expect(main.getByRole("alert", { name: "There's a problem" })).toBeVisible(POST_LANDS);
  await shot(page, "01-request-form-errors");

  const id = await postRequest(page, `Desk lamp for res ${uniqueWord()}`.slice(0, 60));
  await expect(offersPanel(page)).toContainText("Your request");
  await shot(page, "02-request-asker");

  // The sample shop, in a browser of its own at the same size: it offers, and waits for the asker to reply.
  const shop = await sellerPage(browser, baseURL!);
  await shop.setViewportSize(page.viewportSize()!);
  await shop.emulateMedia({ reducedMotion: "reduce" });
  await shop.goto(`/looking-for/${id}/offer`);
  await expect(field(shop, "Your offer")).toBeVisible();
  await shot(shop, "03-offer-composer");
  await field(shop, "Your offer").fill("I have a clip-on lamp, R120. I can bring it to the library at lunch.");
  await button(shop, "Send offer").click();
  await expect(shop.locator("main").getByText("You can write again when they reply.").filter({ visible: true })).toBeVisible(
    POST_LANDS,
  );
  await shot(shop, "04-offer-thread-shop");
  await shop.context().close();

  await page.reload();
  await expect(offersPanel(page).getByRole("link", { name: /Tech corner/ })).toBeVisible();
  await shot(page, "05-request-with-offer");
  await page.goto("/account/requests");
  await expect(main.getByRole("heading", { level: 1, name: "Your requests" })).toBeVisible();
  await shot(page, "06-your-requests");
  await page.goto(`/looking-for/${id}/delete`);
  await expect(button(page, "Delete request")).toBeVisible();
  await shot(page, "07-delete-request");

  await page.goto("/sellers/tech-corner");
  // Exact names: "Follow Tech corner" is also a part of "Unfollow Tech corner" (plan amendment 20.1).
  await page.getByRole("button", { name: "Follow Tech corner", exact: true }).click();
  await expect(statusLine(page)).toHaveText("You follow Tech corner.", POST_LANDS);
  await shot(page, "08-storefront-following", false);
  await page.goto("/saved?tab=shops");
  await expect(main.getByRole("button", { name: /^Unfollow Tech corner/ })).toBeVisible();
  await shot(page, "09-saved-shops");
  await page.goto("/looking-for/r-002/offer");
  await expect(main.getByText("Offers come from shops on CampusCart", { exact: false })).toBeVisible();
  await shot(page, "10-offer-no-shop");
  await page.goto("/offline");
  await expect(page.getByRole("heading", { level: 1, name: "You're offline" })).toBeVisible();
  await shot(page, "11-offline", false);
});
