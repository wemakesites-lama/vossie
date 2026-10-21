import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

/**
 * A new address for each test. Every test shares one server and one sample store and runs alongside the others, so a
 * test that signs up never reuses an address (plan decision 22). Sample accounts are only ever signed in to.
 */
function newEmail(): string {
  return `e2e-${project()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@eduvos.com`;
}

/** The page that's showing: Next keeps earlier pages hidden in the DOM, so look only at what's visible. */
const main = (page: Page) => page.locator("main");
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const button = (page: Page, name: string) => main(page).getByRole("button", { name, exact: true });

/** The header's account icon (accounts spec 3.4). */
const accountIcon = (page: Page) =>
  // The header's icon from the tablet step, the tab bar's Account tab on phones (spec section 6.2). Its address says
  // who's signed in at every width: /account signed in, /login signed out.
  page.locator(".site-header, .tabbar").getByRole("link", { name: /^(Sign in|Your account|Account)$/ });

/** The code sample mode shows on step 2 (spec 2.3). */
async function shownCode(page: Page): Promise<string> {
  const note = main(page).getByText(/Sample mode: your code is/).filter({ visible: true });
  await expect(note).toBeVisible();
  return /(\d{6})/.exec((await note.textContent()) ?? "")![1];
}

/** A code that isn't the one shown. */
const wrongCodeFor = (code: string) => (code === "111111" ? "222222" : "111111");

/** Step 1: an email and the privacy box, then Send code. Ends on step 2. */
async function sendCode(page: Page, email: string) {
  await field(page, "Your Eduvos email address").fill(email);
  await field(page, "I agree to the privacy policy").check();
  await button(page, "Send code").click();
  await expect(field(page, "6-digit code")).toBeVisible();
}

/** Step 2, with the code sample mode shows. */
async function enterShownCode(page: Page) {
  await field(page, "6-digit code").fill(await shownCode(page));
  await button(page, "Sign in").click();
}

/** Step 3, a first sign-in only. */
async function finishFirstSignIn(page: Page, firstName = "Ayanda", campus = "Pretoria") {
  await field(page, "Your first name").fill(firstName);
  await field(page, "Your campus").selectOption({ label: campus });
  await button(page, "Continue").click();
}

/** A whole first sign-in with a new email, starting from `path`. */
async function signUp(page: Page, email: string, path = "/login") {
  await page.goto(path);
  await sendCode(page, email);
  await enterShownCode(page);
  await finishFirstSignIn(page);
}

/** A sample account's button (spec 2.8). It lands on /account, or on `next` when the path has one. */
async function signInAsSample(page: Page, label: string, path = "/login") {
  await page.goto(path);
  await button(page, label).click();
  // Signing in now ends with a full page load (stage K): wait for the new document's app to be there, so a click on
  // its menu isn't lost to a page that hasn't hydrated yet.
  await expect(page).not.toHaveURL(/\/login(\?|$)/);
  await page.waitForFunction(() => {
    // React puts its props on an element when it hydrates it: wait for every button in the header.
    const buttons = [...document.querySelectorAll("header button, [role=banner] button")];
    return buttons.length > 0 && buttons.every((el) => Object.keys(el).some((key) => key.startsWith("__reactProps")));
  });
}

test.describe("signing in with an email code (accounts spec 2.2 and 3.1)", () => {
  test("a first sign-in from a listing's Message seller asks for a name and campus, then goes on to the composer", async ({
    page,
    context,
    baseURL,
  }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "pretoria", url: baseURL! }]);
    await page.goto("/listings/l-001");
    await page.getByRole("link", { name: "Message seller" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001%2Fmessage$/);
    const email = newEmail();
    await sendCode(page, email);
    await expect(main(page).getByText(/We sent a code to/).filter({ visible: true })).toContainText(
      `${email[0]}•••@eduvos.com`,
    );
    // Nothing personal goes in the address (spec 2.2).
    expect(page.url()).not.toContain(email.split("@")[0]);
    await enterShownCode(page);
    // Step 3 starts on the campus chosen on this device (spec 2.6).
    await expect(field(page, "Your campus")).toHaveValue("pretoria");
    await field(page, "Your first name").fill("Ayanda");
    await button(page, "Continue").click();
    await expect(page).toHaveURL(/\/listings\/l-001\/message$/);
    await expect(accountIcon(page)).toHaveAttribute("href", "/account");
  });

  test("an existing account signs straight in, without step 3", async ({ page, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    const email = newEmail();
    await signUp(page, email);
    await expect(page).toHaveURL(/\/account$/);
    await button(page, "Sign out").click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await page.goto("/login?next=%2Fsaved");
    await sendCode(page, email);
    await enterShownCode(page);
    await expect(page).toHaveURL(/\/saved$/);
  });

  test("a wrong code says how many tries are left, and the fifth starts again", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    const email = newEmail();
    await page.goto("/login");
    await sendCode(page, email);
    const wrong = wrongCodeFor(await shownCode(page));
    const summary = main(page).getByRole("alert", { name: "There's a problem" });
    for (const left of [4, 3, 2, 1]) {
      await field(page, "6-digit code").fill(wrong);
      await button(page, "Sign in").click();
      await expect(summary).toContainText(`That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`);
    }
    await field(page, "6-digit code").fill(wrong);
    await button(page, "Sign in").click();
    await expect(summary).toContainText("Too many tries. Start again.");
    await expect(field(page, "Your Eduvos email address")).toHaveValue(email);
  });

  test("step 1's errors are listed and linked to their fields, and keep what was typed", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/login");
    await button(page, "Send code").click();
    const summary = main(page).getByRole("alert", { name: "There's a problem" });
    await expect(summary.getByRole("link")).toHaveText([
      "Enter your email address.",
      "Tick the box to agree to the privacy policy.",
    ]);
    await field(page, "Your Eduvos email address").fill("someone@gmail.com");
    await field(page, "I agree to the privacy policy").check();
    await button(page, "Send code").click();
    await expect(summary.getByRole("link")).toHaveText(["Use your Eduvos email address."]);
    await expect(field(page, "Your Eduvos email address")).toHaveValue("someone@gmail.com");
    await expect(field(page, "I agree to the privacy policy")).toBeChecked();
  });

  test("Send a new code says so, and Use a different email starts again", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/login");
    await sendCode(page, newEmail());
    await button(page, "Send a new code").click();
    await expect(main(page).getByRole("status")).toHaveText("We sent a new code.");
    await button(page, "Use a different email").click();
    await expect(field(page, "Your Eduvos email address")).toHaveValue("");
  });
});

test.describe("sample accounts (accounts spec 2.8)", () => {
  test("each button signs straight in as its account", async ({ page, context }) => {
    onlyAt("phone-390", "desktop-1440");
    const accounts: Array<[label: string, firstName: string]> = [
      ["Student, Midrand", "Thandi"],
      ["Seller, Tech corner", "Sipho"],
      ["Seller waiting for approval", "Lerato"],
      ["Mentor", "Naledi"],
      ["Admin", "Pieter"],
    ];
    for (const [label, firstName] of accounts) {
      await context.clearCookies();
      await signInAsSample(page, label);
      await expect(page).toHaveURL(/\/account$/);
      await expect(main(page).getByRole("heading", { level: 2, name: firstName })).toBeVisible();
    }
    await expect(main(page).getByText("Hub role", { exact: true })).toBeVisible();
  });

  test("a sample account follows next too, and the seller's points at their shop's pages", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Seller, Tech corner", "/login?next=%2Fsaved");
    await expect(page).toHaveURL(/\/saved$/);
    await page.goto("/account");
    // The dashboard, not the storefront (selling plan decision 21).
    await expect(main(page).getByRole("link", { name: "Your shop" })).toHaveAttribute("href", "/sell");
  });
});

test.describe("the header and the menu (accounts spec 3.4)", () => {
  test("say Sign in when signed out, and Your account and Sign out when signed in", async ({ page, baseURL }) => {
    await page.goto("/");
    await expect(accountIcon(page)).toHaveAttribute("href", "/login");
    const menuButton = page.getByRole("button", { name: "Menu", exact: true });
    const menu = page.getByRole("dialog", { name: "Menu" });
    await menuButton.click();
    await expect(menu.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    await expect(menu.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await signInAsSample(page, "Student, Midrand");
    await expect(page).toHaveURL(/\/account$/);
    await expect(accountIcon(page)).toHaveAttribute("href", "/account");
    await menuButton.click();
    await expect(menu.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");

    // Sign out from the menu: it closes, the homepage says so, and the header follows (plan decisions 12 and 14).
    await menu.getByRole("button", { name: "Sign out" }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(page.locator(".toast")).toHaveText("You're signed out");
    await expect(accountIcon(page)).toHaveAttribute("href", "/login");
  });
});

test("the sign-out toast shows once: coming Back to the homepage doesn't show it again (plan decision 12)", async ({
  page,
  baseURL,
}) => {
  onlyAt("phone-390", "desktop-1440");
  await signInAsSample(page, "Student, Midrand");
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(page.locator(".toast")).toHaveText("You're signed out");
  await expect(page.locator(".toast")).toHaveCount(0, { timeout: 10_000 });
  // Count the toasts that appear from here on. The count lives in the page, so it survives only a client-side Back to
  // Next's kept copy of the homepage. A full page load would lose it (and show no toast either), so the check below
  // fails on that rather than pass without testing anything.
  await page.evaluate(() => {
    const watch = { added: 0 };
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && (node.matches(".toast") || node.querySelector(".toast"))) watch.added += 1;
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    (window as unknown as { toastWatch: typeof watch }).toastWatch = watch;
  });
  // Away by a link and Back: Next shows its kept copy of the homepage again, which runs the toast's effect again.
  await accountIcon(page).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(`${baseURL}/`);
  // The address changes first. Wait until the sign-in page, now kept hidden, is out of view: the homepage is showing.
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toHaveCount(0);
  // Two frames, so an effect that was going to show it has run.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // A snapshot, not a retrying assertion: a toast that did appear would go away by itself after 4 seconds, and a
  // retrying `toHaveCount(0)` would wait for that and pass.
  expect(await page.evaluate(() => (window as unknown as { toastWatch?: { added: number } }).toastWatch)).toEqual({
    added: 0,
  });
  expect(await page.locator(".toast").count()).toBe(0);
});

test.describe("no stale pages after signing in or out (plan decision 2)", () => {
  test("Back to the sign-in page after signing in shows you're signed in", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/listings/l-001");
    await page.getByRole("link", { name: "Message seller" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001%2Fmessage$/);
    await button(page, "Student, Midrand").click();
    await expect(page).toHaveURL(/\/listings\/l-001\/message$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001%2Fmessage$/);
    await expect(main(page).getByText(/You're signed in as/).filter({ visible: true })).toContainText(
      "student@eduvos.com",
    );
    await expect(field(page, "Your Eduvos email address")).toHaveCount(0);
    // Nor is the header a stale copy.
    await expect(accountIcon(page)).toHaveAttribute("href", "/account");
  });

  test("Back to the account page after signing out asks you to sign in", async ({ page, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Student, Midrand");
    await expect(page).toHaveURL(/\/account$/);
    await main(page).getByRole("link", { name: "Saved" }).click();
    await expect(page).toHaveURL(/\/saved$/);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await page.goBack();
    await expect(page).toHaveURL(/\/saved$/);
    // The kept copy of /saved must not bring back its signed-in header.
    await expect(accountIcon(page)).toHaveAttribute("href", "/login");
    await page.goBack();
    // The kept copy of /account must not come back: the server sends a signed-out visitor to sign in.
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
    await expect(main(page).getByRole("heading", { level: 2, name: "Thandi" })).toHaveCount(0);
    await expect(accountIcon(page)).toHaveAttribute("href", "/login");
  });
});

test.describe("your account (accounts spec 3.2 and 3.3)", () => {
  test("shows your details, and Edit details saves them or says what's wrong", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signUp(page, newEmail());
    await expect(page).toHaveURL(/\/account$/);
    await expect(main(page).getByRole("heading", { level: 2, name: "Ayanda" })).toBeVisible();
    await expect(main(page).getByText(/^Member since /)).toBeVisible();
    await field(page, "Your first name").fill("Lindiwe");
    await field(page, "Your campus").selectOption({ label: "Durban Umhlanga" });
    await button(page, "Save changes").click();
    await expect(main(page).getByRole("status")).toHaveText("Your details are saved.");
    await expect(main(page).getByRole("heading", { level: 2, name: "Lindiwe" })).toBeVisible();
    await expect(main(page).getByText("Campus", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText(
      "Durban Umhlanga",
    );
    await field(page, "Your first name").fill("L");
    await button(page, "Save changes").click();
    await expect(main(page).getByRole("alert", { name: "There's a problem" })).toContainText(
      "Your first name must be 2 to 40 characters.",
    );
    await expect(field(page, "Your first name")).toHaveValue("L");
  });

  test("Download your data saves campuscart-data.json with your account in it and no ids", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Mentor");
    await main(page).getByRole("link", { name: "Privacy settings" }).click();
    await expect(page).toHaveURL(/\/account\/privacy$/);
    await expect(main(page).getByText(/You agreed to the privacy policy/)).toContainText("(draft of October 2026)");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      main(page).getByRole("link", { name: "Download your data" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("campuscart-data.json");
    const data = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(data.account).toMatchObject({ email: "mentor@eduvos.com", roles: ["mentor"] });
    expect(data.sessions.length).toBeGreaterThanOrEqual(1);
    const session = (await page.context().cookies()).find((cookie) => cookie.name === "vossie_session")!;
    expect(JSON.stringify(data)).not.toContain(session.value);
  });

  test("Delete my account asks for the box, then deletes it and signs you out with a toast (spec 2.13)", async ({
    page,
    baseURL,
  }) => {
    onlyAt("phone-390", "desktop-1440");
    const email = newEmail();
    await signUp(page, email);
    await expect(page).toHaveURL(/\/account$/);
    await page.goto("/account/privacy");
    await button(page, "Delete my account").click();
    await expect(main(page).getByRole("alert", { name: "There's a problem" })).toContainText(
      "Tick the box to confirm you understand.",
    );
    await field(page, "I understand this can't be undone").check();
    await button(page, "Delete my account").click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(page.locator(".toast")).toHaveText("Your account has been deleted");
    await expect(accountIcon(page)).toHaveAttribute("href", "/login");
    // The account has gone: the same email starts a first sign-in again.
    await page.goto("/login");
    await sendCode(page, email);
    await enterShownCode(page);
    await expect(field(page, "Your first name")).toBeVisible();
  });
});

test("a signed-in visitor who follows a sign-in link is told so, with the way back (plan decision 10)", async ({
  page,
}) => {
  onlyAt("phone-390", "desktop-1440");
  await signInAsSample(page, "Student, Midrand");
  await expect(page).toHaveURL(/\/account$/);
  // A sign-in link from a page drawn before signing in. Signed in, Message seller now goes to the composer.
  await page.goto("/login?next=%2Fsellers%2Ftech-corner");
  await expect(main(page).getByText(/You're signed in as/).filter({ visible: true })).toContainText(
    "student@eduvos.com",
  );
  await main(page).getByRole("link", { name: "Go back" }).click();
  await expect(page).toHaveURL(/\/sellers\/tech-corner$/);
});

test("the account pages and the export send a signed-out visitor to sign in, and back (spec 2.10)", async ({
  page,
  request,
}) => {
  onlyAt("phone-390", "desktop-1440");
  const response = await request.get("/account/privacy/export", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login?next=%2Faccount%2Fprivacy");
  await page.goto("/account/privacy");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fprivacy$/);
  await button(page, "Admin").click();
  await expect(page).toHaveURL(/\/account\/privacy$/);
});

test("sign-in and account pages stay out of search engines", async ({ page }) => {
  onlyAt("desktop-1440");
  await page.goto("/login");
  await expect(page).toHaveTitle("Sign in · CampusCart");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await signInAsSample(page, "Student, Midrand");
  await expect(page).toHaveURL(/\/account$/);
  for (const [path, title] of [
    ["/account", "Your account · CampusCart"],
    ["/account/privacy", "Privacy settings · CampusCart"],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  }
});

test.describe("without the app's JavaScript (spec 2.2, plan decisions 2 and 11)", () => {
  test.beforeEach(async ({ page }) => {
    // The app's bundle never arrives. React's small inline script still puts streamed content in place.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
  });

  test("a whole first sign-in works, the error summary takes focus, and Sign out works", async ({ page, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/login?next=%2Flistings%2Fl-001");
    await sendCode(page, newEmail());
    const code = await shownCode(page);
    await field(page, "6-digit code").fill(wrongCodeFor(code));
    await button(page, "Sign in").click();
    // Without the app's JavaScript a post is a full page load, so the browser focuses the summary (autoFocus).
    const summary = main(page).locator(".form-summary");
    await expect(summary).toContainText("That code isn't right. 4 tries left.");
    await expect(summary).toBeFocused();
    await field(page, "6-digit code").fill(code);
    await button(page, "Sign in").click();
    await finishFirstSignIn(page);
    await expect(page).toHaveURL(/\/listings\/l-001$/);
    // On a phone a listing's dock stands in for the tab bar (spec section 6.2); /account below shows the sign-in.
    if (test.info().project.name !== "phone-390") await expect(accountIcon(page)).toHaveAttribute("href", "/account");
    await page.goto("/account");
    await expect(main(page).getByRole("heading", { level: 2, name: "Ayanda" })).toBeVisible();
    await button(page, "Sign out").click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(accountIcon(page)).toHaveAttribute("href", "/login");
  });

  test("Edit details and Delete my account work", async ({ page, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await signUp(page, newEmail());
    await expect(page).toHaveURL(/\/account$/);
    await field(page, "Your first name").fill("Zola");
    await button(page, "Save changes").click();
    await expect(main(page).getByRole("status")).toHaveText("Your details are saved.");
    await page.goto("/account/privacy");
    await field(page, "I understand this can't be undone").check();
    await button(page, "Delete my account").click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(accountIcon(page)).toHaveAttribute("href", "/login");
  });

  test("a sample account's button and the redirect to sign in work", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/account");
    // Next's streamed redirect is a meta refresh after a second when the app's JavaScript is missing.
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
    await button(page, "Student, Midrand").click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(main(page).getByRole("heading", { level: 2, name: "Thandi" })).toBeVisible();
  });
});
