import { expect, test, type Request } from "@playwright/test";

test.skip(!process.env.SCREENSHOTS, "Run with SCREENSHOTS=1 to refresh the review screenshots");

test("shell review screenshots", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const file = (name: string) => `docs/progress/part-1/${project}-${name}.png`;
  const shot = (name: string) => page.screenshot({ path: file(name) });
  const menu = page.getByRole("dialog", { name: "Menu" });
  const search = page.getByRole("dialog", { name: "Search Vossie" });
  const picker = page.getByRole("dialog", { name: "Choose your campus" });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await shot("01-top");

  await page.evaluate(() => window.scrollTo(0, 700));
  await page.getByRole("button", { name: "Show navigation" }).waitFor();
  await shot("02-crest-only");

  await page.getByRole("button", { name: "Show navigation" }).click();
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

  await page.goto("/hub?type=tips#hub-feed");
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

  await page.goto("/account");
  await expect(main.getByRole("heading", { level: 2, name: "Ayanda" })).toBeVisible();
  await page.screenshot({ path: file("06-account"), fullPage: true });

  await main.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(main.getByRole("status")).toHaveText("Your details are saved.");
  await page.screenshot({ path: file("07-account-saved") });

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
