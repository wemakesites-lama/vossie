import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "../e2e/helpers/axe";
import {
  authRequests,
  authSessionCount,
  authUserId,
  expireStoredSession,
  latestCode,
  messagesTo,
  networkCounts,
  newAddress,
  otherThan,
  removeE2eAccounts,
  resetNetworkCounts,
  sql,
  storedSession,
} from "./helpers/local";

// Signing in on Supabase, end to end (phase B, Task 11): the 6-digit code Supabase Auth emails (read from Mailpit),
// the vossie_auth cookie, sign-out, the proxy's renewal and the idle sweep, against the local stack. Run with
// `pnpm e2e:supabase` (playwright.supabase.config.ts).

const project = () => test.info().project.name;

/** For a check of the server's behaviour, which the screen's size doesn't change: one project is enough (see the config). */
function desktopOnly() {
  test.skip(project() !== "desktop-1440", "The server's behaviour, checked once at desktop-1440");
}

/** The seed's accounts, which have profiles: a different one for each project, so no address gets two codes in a minute. */
const RETURNING = { "phone-390": "student@vossie.test", "desktop-1440": "mentor@vossie.test" } as Record<string, string>;
const SECOND = { "phone-390": "pending@vossie.test", "desktop-1440": "seller@vossie.test" } as Record<string, string>;

const main = (page: Page) => page.locator("main");
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const button = (page: Page, name: string) => main(page).getByRole("button", { name, exact: true });
const accountIcon = (page: Page) =>
  page.locator(".site-header, .tabbar").getByRole("link", { name: /^(Sign in|Your account|You)$/ });

/** Waits for the header's buttons to be hydrated after a full page load, so a click on the menu isn't lost. */
async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll("header button, [role=banner] button")];
    return buttons.length > 0 && buttons.every((el) => Object.keys(el).some((key) => key.startsWith("__reactProps")));
  });
}

/** Step 1 from `path`: the address and the privacy box, then Send code. Returns when the code was asked for. */
async function askForCode(page: Page, email: string, path = "/login"): Promise<Date> {
  await page.goto(path);
  await field(page, "Your Eduvos email address").fill(email);
  await field(page, "I agree to the privacy policy").check();
  const asked = new Date();
  await button(page, "Send code").click();
  await expect(field(page, "6-digit code")).toBeVisible();
  return asked;
}

async function enterCode(page: Page, code: string) {
  await field(page, "6-digit code").fill(code);
  await button(page, "Sign in").click();
}

async function finishFirstSignIn(page: Page, firstName = "Ayanda", campus = "Pretoria") {
  await field(page, "Your first name").fill(firstName);
  await field(page, "Your campus").selectOption({ label: campus });
  await button(page, "Continue").click();
}

/** A whole sign-in by code; a new address also finishes step 3. Lands on /account unless `path` has a next. */
async function signIn(page: Page, email: string, { path = "/login", isNew = true } = {}) {
  const asked = await askForCode(page, email, path);
  await enterCode(page, await latestCode(email, asked));
  if (isNew) await finishFirstSignIn(page);
}

async function signOutFromMenu(page: Page) {
  await hydrated(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Sign out" }).click();
}

// Every test posts from this machine: a fresh per-network count for each, as each has a fresh address (review fix 2).
test.beforeEach(() => resetNetworkCounts());
test.afterAll(() => removeE2eAccounts(test.info().project.name));

test.describe("signing in by code on Supabase (phase B, Task 11)", () => {
  test("1. a new address: code by email, step 3, then the account, with only the vossie_auth cookie", async ({ page }) => {
    const email = newAddress(project());
    const asked = await askForCode(page, email);
    await expect(field(page, "6-digit code")).toHaveAccessibleDescription(/We sent a code to e•••@vossie\.test\./);
    // The send was counted against this network too (review fix 2): one network, one code.
    expect(networkCounts()).toEqual([1]);
    if (project() === "phone-390") expect(await seriousIssues(page)).toEqual([]);
    await enterCode(page, await latestCode(email, asked));
    await expect(field(page, "Your first name")).toBeVisible();
    if (project() === "phone-390") expect(await seriousIssues(page)).toEqual([]);
    await finishFirstSignIn(page);
    await expect(page).toHaveURL(/\/account$/);
    await expect(main(page).getByText(email)).toBeVisible();

    const cookies = await page.context().cookies();
    const auth = cookies.filter((cookie) => /^vossie_auth(\.\d+)?$/.test(cookie.name));
    expect(auth.length).toBeGreaterThan(0);
    for (const cookie of auth) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("Lax");
      // 30 days from now, give or take a minute (decision 3), never @supabase/ssr's 400 days (amendment 1).
      expect(Math.abs(cookie.expires - (Date.now() / 1000 + 30 * 24 * 3600))).toBeLessThan(60);
    }
    expect(cookies.map((cookie) => cookie.name).filter((name) => /vossie_session|vossie_signin|code-verifier|^sb-/.test(name))).toEqual([]);
  });

  test("2. a returning address skips step 3 and lands on next", async ({ page }) => {
    await signIn(page, RETURNING[project()], { path: "/login?next=%2Fsaved", isNew: false });
    await expect(page).toHaveURL(/\/saved$/);
    await expect(accountIcon(page)).toHaveAttribute("href", "/account");
  });

  test("3. four wrong codes count down; the fifth starts again, and the emailed code then signs nobody in", async ({ page }) => {
    desktopOnly();
    const email = newAddress(project());
    const asked = await askForCode(page, email);
    const code = await latestCode(email, asked);
    for (const left of ["4 tries left", "3 tries left", "2 tries left", "1 try left"]) {
      await enterCode(page, otherThan(code));
      await expect(main(page).getByRole("alert", { name: "There's a problem" })).toContainText(`That code isn't right. ${left}.`);
    }
    await enterCode(page, otherThan(code));
    await expect(main(page).getByRole("alert", { name: "There's a problem" })).toContainText("Too many tries. Start again.");
    await expect(field(page, "Your Eduvos email address")).toHaveValue(email);
    // The right code, posted to step 2 now, finds no attempt there: back to step 1, signed out.
    const posted = await page.request.post("/login/code", { form: { code }, headers: { origin: test.info().project.use.baseURL! }, maxRedirects: 0 });
    expect([posted.status(), posted.headers().location]).toEqual([303, "/login"]);
    expect(await storedSession(page.context())).toBeNull();
  });

  test("3b. ten code posts sent at once reach Supabase at most five times, then the attempt is locked (amendment 2)", async ({ page }) => {
    desktopOnly();
    const email = newAddress(project());
    const asked = await askForCode(page, email);
    const code = await latestCode(email, asked);
    const since = new Date(Date.now() - 1_000);
    const origin = test.info().project.use.baseURL!;
    await Promise.all(
      Array.from({ length: 10 }, () => page.request.post("/login/code", { form: { code: otherThan(code) }, headers: { origin }, maxRedirects: 0 })),
    );
    // Every try is counted before Supabase sees it (decision 2): Auth's own log shows at most five code checks.
    expect(authRequests("/verify", since)).toBeLessThanOrEqual(5);
    expect(authRequests("/verify", since)).toBeGreaterThan(0);
    // Every post was counted, the ones past the fifth too, and those never reached Supabase.
    expect(sql(`select wrong_tries from private.sign_in_attempts where email = :'email'`, { email })).toEqual(["10"]);
    await page.goto("/login");
    await expect(field(page, "Your Eduvos email address")).toBeVisible();
    await expect(field(page, "6-digit code")).toHaveCount(0);
  });

  test("4. Send a new code at once says to wait a minute; Use a different email starts empty", async ({ page }) => {
    const email = newAddress(project());
    await askForCode(page, email);
    await button(page, "Send a new code").click();
    await expect(main(page).getByRole("alert", { name: "There's a problem" })).toContainText(
      "We sent you a code less than a minute ago. Wait a minute, then ask again.",
    );
    expect(await messagesTo(email)).toBe(1);
    await button(page, "Use a different email").click();
    await expect(field(page, "Your Eduvos email address")).toHaveValue("");
  });

  test("5. an address outside Eduvos is refused, and nothing is emailed", async ({ page }) => {
    const email = `e2e-${project()}-${Date.now().toString(36)}@gmail.com`;
    await page.goto("/login");
    await field(page, "Your Eduvos email address").fill(email);
    await field(page, "I agree to the privacy policy").check();
    await button(page, "Send code").click();
    await expect(main(page).getByRole("alert", { name: "There's a problem" })).toContainText("Use your Eduvos email address.");
    expect(await messagesTo(email)).toBe(0);
    expect(authUserId(email)).toBeNull();
  });

  test("6. no sample accounts: no buttons, and a post to /login/sample signs nobody in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("region", { name: "Sign in as a sample account" })).toHaveCount(0);
    await expect(main(page)).not.toContainText(/sample/i);
    const posted = await page.request.post("/login/sample", {
      form: { email: "student@vossie.test" },
      headers: { origin: test.info().project.use.baseURL! },
      maxRedirects: 0,
    });
    expect([posted.status(), posted.headers().location]).toEqual([303, "/login"]);
    expect((await page.context().cookies()).filter((cookie) => cookie.name.startsWith("vossie_"))).toEqual([]);
  });

  test("7. Sign out from the menu: the toast, no vossie_auth cookie, the session gone on the server, and the account asks to sign in again", async ({ page, baseURL }) => {
    const email = newAddress(project());
    await signIn(page, email);
    await expect(page).toHaveURL(/\/account$/);
    expect(authSessionCount(email)).toBe(1);
    await signOutFromMenu(page);
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(page.locator(".toast")).toHaveText("You're signed out");
    expect(await storedSession(page.context())).toBeNull();
    // Review fix 4: Supabase ended the session itself, not only the cookie.
    expect(authSessionCount(email)).toBe(0);
    await page.goBack();
    await expect(field(page, "Your Eduvos email address")).toBeVisible();
    // Stage K's check, repeated: another site can't sign anyone out.
    const crossSite = await page.request.post("/logout", { form: {}, headers: { origin: "https://evil.example" }, maxRedirects: 0 });
    expect(crossSite.status()).toBe(403);
  });

  test("7b. Sign out with an expired access token: the proxy renews and the handler ends the session, in one response (review fix 4)", async ({ page, baseURL }) => {
    desktopOnly();
    const email = newAddress(project());
    await signIn(page, email);
    await expect(page).toHaveURL(/\/account$/);
    // Off the site first, so no request from the open page (a prefetch) renews the session before the post does.
    await page.goto("about:blank");
    const before = await storedSession(page.context());
    await expireStoredSession(page);
    // The menu's form, posted straight away: no page load first, so the post itself carries the expired token.
    const response = await page.request.post("/logout", { form: {}, headers: { origin: baseURL! }, maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe("/");
    // One response: the proxy's renewal (30 days), then the handler's removal, last.
    const written = response
      .headersArray()
      .filter(({ name, value }) => name.toLowerCase() === "set-cookie" && /^vossie_auth(\.\d+)?=/.test(value))
      .map(({ value }) => value);
    expect(written.some((value) => /Max-Age=2592000/.test(value))).toBe(true);
    expect(written.at(-1)).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    expect(await storedSession(page.context())).toBeNull();
    // Signed out with the renewed token, so Supabase ended the session itself: none left on the server.
    expect(before?.refresh_token).toBeTruthy();
    expect(authSessionCount(email)).toBe(0);
    await page.goto("/account");
    await expect(field(page, "Your Eduvos email address")).toBeVisible();
  });

  test("8. the proxy renews an expired session before the page renders, and says no-store; the next page sets nothing", async ({ page }) => {
    desktopOnly();
    await signIn(page, newAddress(project()));
    await expect(page).toHaveURL(/\/account$/);
    const before = await storedSession(page.context());
    await expireStoredSession(page);
    const renewed = await page.goto("/account");
    const setCookie = (await renewed!.headerValue("set-cookie")) ?? "";
    expect(setCookie).toMatch(/vossie_auth(\.\d+)?=base64-/);
    expect(setCookie).toMatch(/Max-Age=2592000/);
    expect(await renewed!.headerValue("cache-control")).toMatch(/no-store/);
    await expect(main(page).getByRole("heading", { level: 2, name: "Ayanda" })).toBeVisible();
    const after = await storedSession(page.context());
    expect(after?.refresh_token).not.toBe(before?.refresh_token);
    const again = await page.goto("/account");
    expect(await again!.headerValue("set-cookie")).toBeNull();
  });

  test("9. a session idle for 30 days is swept, and the next page is signed out", async ({ page }) => {
    desktopOnly();
    const email = newAddress(project());
    await signIn(page, email);
    await expect(page).toHaveURL(/\/account$/);
    sql(
      `update auth.sessions set refreshed_at = (now() - interval '31 days') at time zone 'UTC',
              updated_at = now() - interval '31 days', created_at = now() - interval '31 days'
        where user_id = (select id from auth.users where email = :'email')`,
      { email },
    );
    expect(Number(sql(`select private.sweep_idle_sessions()`)[0])).toBeGreaterThanOrEqual(1);
    expect(sql(`select count(*) from auth.sessions where user_id = (select id from auth.users where email = :'email')`, { email })).toEqual(["0"]);
    await expireStoredSession(page);
    await page.goto("/account");
    await expect(field(page, "Your Eduvos email address")).toBeVisible();
    expect(await storedSession(page.context())).toBeNull();
  });

  test("10. signed in as one account, then as another in the same browser: one session, the second's (amendment 12)", async ({ page, browser, baseURL }) => {
    desktopOnly();
    // The browser is part-way through signing in as the second account (step 2) when the first account's session
    // arrives from another tab. /login shows "signed in" to a signed-in visitor, so the first session is made in its own
    // context and its cookie copied across.
    const first = newAddress(project());
    const other = await browser.newContext({ serviceWorkers: "block", baseURL });
    const otherPage = await other.newPage();
    await signIn(otherPage, first);
    await expect(otherPage).toHaveURL(/\/account$/);
    const firstSession = (await other.cookies()).filter((cookie) => /^vossie_auth(\.\d+)?$/.test(cookie.name));
    await other.close();

    const asked = await askForCode(page, SECOND[project()]);
    await page.context().addCookies(firstSession);
    await enterCode(page, await latestCode(SECOND[project()], asked));
    await expect(page).toHaveURL(/\/account$/);
    await expect(main(page).getByText(SECOND[project()])).toBeVisible();
    const session = await storedSession(page.context());
    expect((session?.user as { email?: string } | undefined)?.email).toBe(SECOND[project()]);
    // The first account's session was signed out before the code was checked: a session id is never reused (spec 2.5).
    expect(sql(`select count(*) from auth.sessions where user_id = (select id from auth.users where email = :'first')`, { first })).toEqual(["0"]);
  });

  test("11. the header and the menu say Your account and Sign out when signed in", async ({ page }) => {
    await signIn(page, newAddress(project()));
    await expect(accountIcon(page)).toHaveAttribute("href", "/account");
    await hydrated(page);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");
    await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
  });
});
