import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

async function seriousIssues(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
}

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
