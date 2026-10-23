import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { button, field, main, newBuyer, onlyAt, project, signInAsSample, signUpHere } from "./helpers/messaging";
import { POST_LANDS } from "./helpers/selling";
import { expectStill, holdFonts, recordShifts } from "./helpers/shifts";

// Stage K's sign-in and sign-out tests (spec section 3 "Tests", decision 6; plan decisions 6, 7 and 22). They run in
// the device projects at 390 and 1440px, sign in as sample accounts and fresh ones, sign out, and write nothing else.

/**
 * Whether the posts that start a session end with a full page load (plan Task 5). Until then the tests of the fix
 * skip, unless SIGN_IN_SPIKE=1, which runs them on today's code as the spike's reproduction (plan Task 1).
 */
const SIGN_IN_ENDS_IN_A_PAGE_LOAD = true;
/** Whether signing out ends with a full page load (plan Task 2; Lama, 2026-10-20). */
const SIGN_OUT_ENDS_IN_A_PAGE_LOAD = true;
const SPIKE = process.env.SIGN_IN_SPIKE === "1";

function needsTheFix(built: boolean) {
  test.skip(!built && !SPIKE, "Needs stage K's fix; SIGN_IN_SPIKE=1 runs it anyway");
}

type NextWindow = { next?: { router?: { push: (href: string) => void; prefetch: (href: string) => void } } };

/** Waits until the app's router is there, so a push is a client navigation. */
async function hydrated(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as NextWindow).next?.router));
}

/** A client navigation, as a <Link> makes, without needing a link on the page (messaging.spec.ts does the same). */
async function push(page: Page, href: string) {
  await page.evaluate((target) => (window as unknown as NextWindow).next!.router!.push(target), href);
}

async function prefetch(page: Page, href: string) {
  await page.evaluate((target) => (window as unknown as NextWindow).next!.router!.prefetch(target), href);
}

/**
 * For the spike's report: every address the page passes through, and each POST's answer (its status, Location,
 * Next's x-action-redirect, and whether its body carries the destination's h1 class (marker) or a redirect to sign-in).
 */
function watch(page: Page, label: string, marker: string): () => void {
  const urls: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) urls.push(frame.url());
  });
  page.on("response", async (response) => {
    const request = response.request();
    if (request.method() !== "POST") return;
    const url = new URL(request.url());
    const body = response.status() >= 300 && response.status() < 400 ? "" : await response.text().catch(() => "");
    const headers = response.headers();
    console.log(
      `${label} [${project()}] POST ${url.pathname}${url.search} -> ${response.status()}` +
        ` location=${headers["location"] ?? ""} x-action-redirect=${headers["x-action-redirect"] ?? ""}` +
        ` carries-destination=${body.includes(marker)}` +
        ` carries-redirect-to-sign-in=${body.includes("NEXT_REDIRECT") && body.includes("/login?next=")}`,
    );
  });
  return () => console.log(`${label} [${project()}] urls: ${JSON.stringify(urls)}`);
}

const visibleHeading = (page: Page, name: string | RegExp) =>
  main(page).getByRole("heading", { level: 1, name }).filter({ visible: true });

/** Still on the page 2 seconds later: the replay was a late `replace` (spec 2.1). */
async function staysOn(page: Page, url: RegExp, heading: string | RegExp) {
  await expect(page).toHaveURL(url, POST_LANDS);
  await expect(visibleHeading(page, heading)).toBeVisible(POST_LANDS);
  await page.waitForTimeout(2_000);
  await expect(page).toHaveURL(url);
  await expect(visibleHeading(page, heading)).toBeVisible();
}

test.describe("signing in comes back to the page that asked (stage K spec 3)", () => {
  test.beforeEach(() => onlyAt("phone-390", "desktop-1440"));

  test("1. a client navigation to Post a request, then a sample account, opens the form", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    const report = watch(page, "variant 1", "request-form-title");
    try {
      await page.goto("/");
      await hydrated(page);
      await push(page, "/looking-for/new");
      await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fnew$/, POST_LANDS);
      await button(page, "Student, Midrand").click();
      await staysOn(page, /\/looking-for\/new$/, "Ask for what you need");
    } finally {
      report();
    }
  });

  test("2. the same with a prefetch first, as the board's old plain link made", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    const report = watch(page, "variant 2", "request-form-title");
    try {
      await page.goto("/");
      await hydrated(page);
      await prefetch(page, "/looking-for/new");
      await page.waitForTimeout(1_000);
      await push(page, "/looking-for/new");
      await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fnew$/, POST_LANDS);
      await button(page, "Student, Midrand").click();
      await staysOn(page, /\/looking-for\/new$/, "Ask for what you need");
    } finally {
      report();
    }
  });

  test("3. a client navigation to /account, then a first sign-in by code, opens the account", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    const report = watch(page, "variant 3", "account-title");
    try {
      await page.goto("/");
      await hydrated(page);
      await push(page, "/account");
      await expect(page).toHaveURL(/\/login\?next=%2Faccount$/, POST_LANDS);
      await signUpHere(page, newBuyer());
      await staysOn(page, /\/account$/, /^Hi, /);
    } finally {
      report();
    }
  });

  test("4. a client navigation to a dynamic gated page, the composer, then a sample account", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    const report = watch(page, "variant 4", "composer-title");
    try {
      await page.goto("/");
      await hydrated(page);
      await push(page, "/listings/l-001/message");
      await expect(page).toHaveURL(/\/login\?next=%2Flistings%2Fl-001%2Fmessage$/, POST_LANDS);
      await button(page, "Student, Midrand").click();
      await staysOn(page, /\/listings\/l-001\/message$/, /^Message /);
    } finally {
      report();
    }
  });

  test("5. a full page load of /account first, then a sample account (a control)", async ({ page }) => {
    const report = watch(page, "variant 5", "account-title");
    try {
      await page.goto("/account");
      await expect(page).toHaveURL(/\/login\?next=%2Faccount$/, POST_LANDS);
      await button(page, "Student, Midrand").click();
      await staysOn(page, /\/account$/, /^Hi, /);
    } finally {
      report();
    }
  });

  test.describe("6. without the app's JavaScript (controls)", () => {
    test.beforeEach(async ({ page }) => {
      // The app's bundle never arrives. React's small inline script still puts streamed content in place.
      await page.route("**/_next/static/**/*.js", (route) => route.abort());
    });

    test("a first sign-in by code from /login?next=/account opens the account", async ({ page }) => {
      await page.goto("/login?next=%2Faccount");
      await signUpHere(page, newBuyer());
      await staysOn(page, /\/account$/, /^Hi, /);
    });

    test("a full page load of /account, then a first sign-in by code, opens the account", async ({ page }) => {
      await page.goto("/account");
      await expect(page).toHaveURL(/\/login\?next=%2Faccount$/, POST_LANDS);
      await signUpHere(page, newBuyer());
      await staysOn(page, /\/account$/, /^Hi, /);
    });
  });

  test("7. Back after variant 1 shows the signed-in note, whose Continue opens the form", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    await page.goto("/");
    await hydrated(page);
    await push(page, "/looking-for/new");
    await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fnew$/, POST_LANDS);
    await button(page, "Student, Midrand").click();
    await staysOn(page, /\/looking-for\/new$/, "Ask for what you need");
    await page.goBack();
    await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fnew$/);
    await expect(main(page).getByText(/You're signed in as/).filter({ visible: true })).toContainText(
      "student@eduvos.com",
    );
    const onward = main(page).getByRole("link", { name: "Continue", exact: true }).filter({ visible: true });
    await expect(onward).toHaveAttribute("href", "/looking-for/new");
    await onward.click();
    await staysOn(page, /\/looking-for\/new$/, "Ask for what you need");
  });

  test("8. a sample sign-in posted from another site is refused, and the visitor stays signed out", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    const response = await page.request.post("/login/sample", {
      headers: { Origin: "https://evil.example" },
      form: { email: "student@eduvos.com", next: "/account" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    expect(await response.text()).toBe("This form must be sent from CampusCart.");
    const away = await page.request.get("/login/sample", { maxRedirects: 0 });
    expect([away.status(), away.headers()["location"]]).toEqual([303, "/login"]);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/, POST_LANDS);
  });
});

test.describe("signing out leaves nothing signed in behind (Lama, 2026-10-20)", () => {
  test.beforeEach(() => onlyAt("phone-390", "desktop-1440"));

  test("the account's email isn't in the document after signing out, even in a hidden kept page", async ({
    page,
    baseURL,
  }) => {
    needsTheFix(SIGN_OUT_ENDS_IN_A_PAGE_LOAD);
    // The email is on Your details (role views N5).
    await signInAsSample(page, "Student, Midrand", "/account/details");
    await expect(main(page).getByText("student@eduvos.com").filter({ visible: true })).toBeVisible();
    // Client navigations away: Next keeps /account/details hidden in the document (spec 2.1).
    await main(page).getByRole("link", { name: "Back to You" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await main(page).locator('a[href="/saved"]').click();
    await expect(page).toHaveURL(/\/saved$/);
    expect(await page.content(), "the kept /account/details is still in the document before signing out").toContain(
      "student@eduvos.com",
    );
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(`${baseURL}/`, POST_LANDS);
    await expect(page.locator(".toast")).toHaveText("You're signed out");
    expect(await page.content()).not.toContain("student@eduvos.com");
  });

  test("a sign-out posted from another site is refused, and the visitor stays signed in", async ({ page }) => {
    needsTheFix(SIGN_OUT_ENDS_IN_A_PAGE_LOAD);
    await signInAsSample(page, "Student, Midrand", "/account");
    const response = await page.request.post("/logout", {
      headers: { Origin: "https://evil.example" },
      form: {},
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    const away = await page.request.get("/logout", { maxRedirects: 0 });
    expect([away.status(), away.headers()["location"]]).toEqual([303, "/"]);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account$/);
  });
});

test.describe("checks (stage K spec 3 \"Checks\")", () => {
  test.beforeEach(() => onlyAt("phone-390", "desktop-1440"));

  test("the signed-in note with Continue has no serious or critical axe issues", async ({ page }) => {
    needsTheFix(SIGN_IN_ENDS_IN_A_PAGE_LOAD);
    await signInAsSample(page, "Student, Midrand", "/account");
    await page.goto("/login?next=%2Flooking-for%2Fnew");
    await expect(main(page).getByRole("link", { name: "Continue", exact: true }).filter({ visible: true })).toBeVisible();
    expect(await seriousIssues(page)).toEqual([]);
  });

  test("step 2 after a wrong code holds still while fonts and content arrive (CLS 0.05 or less)", async ({ page }) => {
    await page.goto("/login?next=%2Faccount");
    await field(page, "Your Eduvos email address").fill(newBuyer().email);
    await field(page, "I agree to the privacy policy").check();
    await button(page, "Send code").click();
    const note = main(page).getByText(/Sample mode: your code is/).filter({ visible: true });
    await expect(note).toBeVisible(POST_LANDS);
    const code = /(\d{6})/.exec((await note.textContent()) ?? "")![1];
    await field(page, "6-digit code").fill(code === "111111" ? "222222" : "111111");
    await button(page, "Sign in").click();
    const summary = main(page).locator(".form-summary").filter({ visible: true });
    await expect(summary).toContainText("That code isn't right.", POST_LANDS);
    // A step's errors show for a minute after their post (accounts spec 3.1), so a fresh load still has them.
    await holdFonts(page);
    await recordShifts(page);
    await expectStill(page, `sign-in step 2 after a wrong code (${project()})`, "/login?next=%2Faccount");
    await expect(summary).toBeVisible();
  });
});
