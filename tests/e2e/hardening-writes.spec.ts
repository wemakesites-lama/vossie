import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { bubble, button, field, main, newBuyer, reply, signUp } from "./helpers/messaging";
import { POST_LANDS } from "./helpers/selling";

// Stage K's message limit, end to end (spec 4 "Tests"; Lama, 2026-10-20: 40 new conversations a day). It runs last, in
// the hardening-writes project: a fresh account starts 40 conversations with the sample shops, whose inboxes then show
// them. The hour's 120 is unit-tested only: 121 posts would make a slow test of a rule the unit tests pin.

const CONVERSATIONS_PER_DAY = 40;

// Every composer a fresh buyer might open: the sample listings, then the sample shops' questions. Some won't take a
// message by the time this runs (sold, paused, or hidden by the staff tests), so the test skips any without a form.
const LISTINGS = Array.from({ length: 31 }, (_, n) => `/listings/l-${String(n + 1).padStart(3, "0")}/message`);
const SHOPS = [
  "hair-studio", "maths-tutor", "home-bakery", "design-studio", "thrift-rack", "code-coach", "phone-fix", "nail-bar",
  "study-notes", "res-kitchen", "tech-corner", "book-swap", "res-deals", "closet-clear-out", "ticket-desk",
  "res-essentials", "lash-lounge", "stationery-stop", "bookshelf", "moving-out-sale", "kitchen-kit", "weekend-market",
  "accounting-tutor", "study-desk", "room-refresh", "sports-kit", "drawing-office", "cv-clinic", "logo-lab",
].map((slug) => `/sellers/${slug}/message`);

/** Opens the next composer on the list that has a message field; null when the list runs out. */
async function nextComposer(page: Page, remaining: string[]): Promise<string | null> {
  for (let path = remaining.shift(); path; path = remaining.shift()) {
    await page.goto(path, { waitUntil: "networkidle" });
    if ((await field(page, "Your message").count()) > 0) return path;
  }
  return null;
}

test("a fresh account starts 40 conversations in a day; the 41st is refused with what was typed kept, and a reply still goes", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(480_000);
  const context = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const page = await context.newPage();
  await signUp(page, newBuyer());
  const remaining = [...LISTINGS, ...SHOPS];
  const threads: string[] = [];
  while (threads.length < CONVERSATIONS_PER_DAY) {
    const path = await nextComposer(page, remaining);
    expect(path, "enough open listings and shops to start 41 conversations").not.toBeNull();
    await field(page, "Your message").fill(`Hello, is this still on offer? (${threads.length + 1})`);
    await button(page, "Send").click();
    await expect(page).toHaveURL(/\/messages\/conv-[0-9a-f-]{36}$/, POST_LANDS);
    threads.push(new URL(page.url()).pathname);
  }

  // Without the app's JavaScript: a page load is what focuses the error summary (accounts plan decision 11).
  await context.route("**/_next/static/**/*.js", (route) => route.abort());
  const last = await nextComposer(page, remaining);
  expect(last, "a 41st composer").not.toBeNull();
  const typed = "Hello, is this still on offer? (41)";
  await field(page, "Your message").fill(typed);
  await button(page, "Send").click();
  const summary = main(page).locator(".form-summary").filter({ visible: true });
  await expect(summary).toContainText(
    "You've started 40 conversations in the last 24 hours. You can still reply in those. Try again later to start a new one.",
    POST_LANDS,
  );
  await expect(summary).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`${last!.replace(/[/]/g, "\\/")}$`));
  await expect(field(page, "Your message")).toHaveValue(typed);
  // The composer showing the limit (spec 4 "Checks", at 1440px).
  expect(await seriousIssues(page)).toEqual([]);
  await context.unroute("**/_next/static/**/*.js");

  // A reply in one of its 40 conversations isn't a new conversation, so it goes (spec 4 "Behaviour").
  await page.goto(threads[0]);
  await reply(page, "Can I collect it tomorrow?");
  await expect(bubble(page, "Can I collect it tomorrow?")).toBeVisible(POST_LANDS);
  await context.close();
});
