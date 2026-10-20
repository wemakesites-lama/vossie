import { expect, test, type Browser, type Page } from "@playwright/test";

// Shared by the messaging tests (messaging plan, Task 15). Every test shares one server and one sample store and runs
// alongside the others, so each signs up a buyer of its own; the sample seller only replies to, and marks completed,
// the test's own conversation, and no test checks the seller's counts (plan decision 23).

export const project = () => test.info().project.name;

export function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

/** A new buyer: an address and a first name no other test uses (plan decision 23). */
export function newBuyer(): { email: string; firstName: string } {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { email: `msg-${project()}-${id}@eduvos.com`, firstName: `Buyer ${id.slice(-6)}` };
}

/** The page that's showing: Next keeps earlier pages hidden in the DOM, so look only at what's visible. */
export const main = (page: Page) => page.locator("main");
export const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
export const button = (page: Page, name: string) =>
  main(page).getByRole("button", { name, exact: true }).filter({ visible: true });

/** The header's account icon (accounts spec 3.4), which carries the new notifications' badge (plan decision 10). */
export const accountIcon = (page: Page) =>
  // The header's icon from the tablet step, the tab bar's Account tab on phones (spec section 6.2). Its address says
  // who's signed in at every width: /account signed in, /login signed out.
  page.locator(".site-header, .tabbar").getByRole("link", { name: /^(Sign in|Your account|Account)$/ });

/** A status pill on the page that's showing. */
export const statusPill = (page: Page, label: string) =>
  main(page).locator(".status-pill").filter({ visible: true }).filter({ hasText: label });

/** D's first sign-in, from the sign-in page the browser is on, ending wherever its `next` leads. */
export async function signUpHere(page: Page, buyer: { email: string; firstName: string }) {
  await field(page, "Your Eduvos email address").fill(buyer.email);
  await field(page, "I agree to the privacy policy").check();
  await button(page, "Send code").click();
  const note = main(page).getByText(/Sample mode: your code is/).filter({ visible: true });
  await expect(note).toBeVisible();
  await field(page, "6-digit code").fill(/(\d{6})/.exec((await note.textContent()) ?? "")![1]);
  await button(page, "Sign in").click();
  await field(page, "Your first name").fill(buyer.firstName);
  await field(page, "Your campus").selectOption({ label: "Midrand" });
  await button(page, "Continue").click();
}

// Sign-in and a first message are each a post to the one shared server, which a busy run slows (all five projects and
// the other specs run alongside), so the wait for them to land is longer than the 5 seconds an assertion gets.
const POST_LANDS = { timeout: 20_000 };

/**
 * Signing in ends with a full page load (stage K), so the page a test lands on is a new document: wait until React has
 * hydrated the header's buttons (it puts its props on each element), so a click on Menu isn't lost.
 */
export async function settled(page: Page) {
  // With the app's JavaScript blocked (the no-JavaScript tests), nothing hydrates: there is nothing to wait for.
  await page.waitForLoadState("load");
  if (!(await page.evaluate(() => "next" in window))) return;
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll("header button, [role=banner] button")];
      return buttons.length > 0 && buttons.every((el) => Object.keys(el).some((key) => key.startsWith("__reactProps")));
    },
    undefined,
    POST_LANDS,
  );
}

/** A whole first sign-in with a new buyer. It lands on /account. */
export async function signUp(page: Page, buyer: { email: string; firstName: string }) {
  await page.goto("/login");
  await signUpHere(page, buyer);
  await expect(page).toHaveURL(/\/account$/, POST_LANDS);
  await settled(page);
}

/** A sample account's button (accounts spec 2.8), landing on `next`. */
export async function signInAsSample(page: Page, label: string, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await button(page, label).click();
  await page.waitForURL((url) => `${url.pathname}${url.search}` === next, POST_LANDS);
  await settled(page);
}

/** A first message from a listing's composer. It ends on the new thread and gives back its id. */
export async function sendFirstMessage(page: Page, listingId: string, text: string, swapOffer?: string): Promise<string> {
  await page.goto(`/listings/${listingId}/message`);
  await field(page, "Your message").fill(text);
  if (swapOffer) await field(page, "Offer a swap (optional)").fill(swapOffer);
  await button(page, "Send").click();
  await expect(page).toHaveURL(/\/messages\/conv-[0-9a-f-]{36}$/, POST_LANDS);
  return page.url().split("/").at(-1)!;
}

/** A reply on the thread that's showing. */
export async function reply(page: Page, text: string) {
  await field(page, "Your reply").fill(text);
  await button(page, "Send").click();
}

/** The sample seller (Sipho, Tech corner) in a browser of their own. Close its context at the end of the test. */
export async function sellerPage(browser: Browser, baseURL: string): Promise<Page> {
  const context = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const page = await context.newPage();
  await signInAsSample(page, "Seller, Tech corner");
  return page;
}

/** A message on the page that's showing, by its words. */
export const bubble = (page: Page, text: string) => main(page).getByRole("listitem").filter({ hasText: text });
