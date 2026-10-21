import { expect, test, type Page } from "@playwright/test";
import { button, signInAsSample } from "./helpers/messaging";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

const SAST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Johannesburg",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A UTC time's date in South Africa, YYYY-MM-DD, as the server works it out. */
const sastDateOf = (iso: string) => SAST_DATE.format(new Date(iso));

/** The request rows on the page that's showing. Next keeps the last few pages hidden in the DOM for Back. */
const rows = (page: Page) => page.locator(".board-row").filter({ visible: true });

/** The request titles in one of the board's sections. */
const sectionTitles = (page: Page, section: string) =>
  page.getByRole("region", { name: section }).getByRole("heading", { level: 3 });

/** The Hub's cards on the page that's showing. */
const hubCards = (page: Page) => page.locator(".hub-card").filter({ visible: true });

const TIPS = [
  "How to price your first listing",
  "Five phone tricks for better photos",
  "Meeting a buyer safely on campus",
  "Writing a listing people trust",
  "How to get the Verified badge",
  "From side hustle to small business",
];

test.describe("the Looking For board (spec 4.1)", () => {
  test("lists every open request, newest first, when no campus is chosen", async ({ page }) => {
    await page.goto("/looking-for");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Looking For");
    await expect(page.getByText("Post what you need, and students who can help will offer.")).toBeVisible();
    const titles = sectionTitles(page, "Open requests");
    await expect(titles).toHaveCount(14);
    await expect(titles.first()).toHaveText("Accounting 1 tutor this week");
    await expect(page.getByText("Kettle for res")).toHaveCount(0);
    await expect(page).toHaveTitle("Looking For · CampusCart");
  });

  test("puts the chosen campus first, then every other, naming no one", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "midrand", url: baseURL! }]);
    await page.goto("/looking-for");
    await expect(sectionTitles(page, "At Midrand")).toHaveText([
      "Accounting 1 tutor this week",
      "Birthday cake for Friday",
    ]);
    await expect(sectionTitles(page, "Other campuses")).toHaveCount(12);
    const first = page.getByRole("region", { name: "At Midrand" }).locator(".board-row").first();
    await expect(first).toContainText("Midrand · Tutoring · Budget R300");
    await expect(first).toContainText("Posted 13 Oct · 2 offers");
  });

  test("says when the chosen campus has none, and shows the rest", async ({ page, context, baseURL }) => {
    onlyAt("phone-390", "desktop-1440");
    await context.addCookies([{ name: "vossie_campus", value: "mbombela", url: baseURL! }]);
    await page.goto("/looking-for");
    await expect(page.getByRole("region", { name: "At Mbombela" })).toContainText("Nothing at Mbombela yet.");
    await expect(sectionTitles(page, "Other campuses")).toHaveCount(14);
  });

  test("a category chip narrows the board, keeping focus, and All widens it again", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for");
    const chips = page.getByRole("navigation", { name: "Categories" });
    await chips.getByRole("link", { name: "Tech", exact: true }).click();
    await expect(page).toHaveURL(/\/looking-for\?cat=tech$/);
    await expect(chips.getByRole("link", { name: "Tech", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(sectionTitles(page, "Open requests")).toHaveText([
      "Graphic calculator to borrow for exams",
      "Laptop charger, Lenovo 65W",
    ]);
    // The chip that was tapped keeps focus: it isn't left behind in a hidden page.
    await expect(chips.getByRole("link", { name: "Tech", exact: true })).toBeFocused();
    await chips.getByRole("link", { name: "All", exact: true }).click();
    await expect(page).toHaveURL(/\/looking-for$/);
    await expect(rows(page)).toHaveCount(14);
  });

  test("a category with nothing open invites the first request", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for?cat=tickets-events");
    await expect(page.getByText("No requests here yet. Be the first to ask.")).toBeVisible();
    await expect(page.locator(".board-empty").getByRole("link", { name: "Post a request" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fnew",
    );
  });

  test("Post a request goes through the sign-in page and back", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for");
    await page.locator(".board-head").getByRole("link", { name: "Post a request" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fnew$/);
    await page.getByRole("link", { name: "Go back" }).click();
    await expect(page).toHaveURL(/\/looking-for$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Looking For");
  });

  // Each Post a request link, signed out, through sign-in to the form. This is the click-through that caught a signed-out
  // visitor being linked straight at the form: the browser kept the form's redirect to sign-in and replayed it after
  // they signed in, leaving them on the sign-in page (community actions plan, Task 16).
  const POST_A_REQUEST_LINKS = [
    ["the board's head", "/looking-for", ".board-head"],
    ["the board's empty state", "/looking-for?cat=tickets-events", ".board-empty"],
    ["the homepage's band", "/", "#looking-for"],
  ] as const;
  for (const [where, path, container] of POST_A_REQUEST_LINKS) {
    test(`signed out, Post a request on ${where} goes through sign-in and the form opens`, async ({ page }) => {
      onlyAt("phone-390", "desktop-1440");
      await page.goto(path);
      const link = page.locator(container).filter({ visible: true }).getByRole("link", { name: "Post a request" });
      await expect(link).toHaveAttribute("href", "/login?next=%2Flooking-for%2Fnew");
      await link.click();
      await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fnew$/);
      await button(page, "Student, Midrand").click();
      await expect(page).toHaveURL(/\/looking-for\/new$/);
      await expect(page.getByRole("heading", { level: 1, name: "Ask for what you need" })).toBeVisible();
    });
  }

  test("signed in, Post a request opens the form itself, with no sign-in page between", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Student, Midrand", "/looking-for");
    // The session's link streams in after the shell's sign-in link: wait for it.
    const link = page.locator(".board-head").filter({ visible: true }).getByRole("link", { name: "Post a request" });
    await expect(link).toHaveAttribute("href", "/looking-for/new");
    await link.click();
    await expect(page).toHaveURL(/\/looking-for\/new$/);
    await expect(page.getByRole("heading", { level: 1, name: "Ask for what you need" })).toBeVisible();
  });

  test("the chips scroll sideways on phones, and the page doesn't", async ({ page }) => {
    onlyAt("phone-360", "phone-390");
    await page.goto("/looking-for");
    const chipRow = page.locator(".link-chips ul");
    await expect(chipRow).toBeVisible();
    expect(await chipRow.evaluate((list) => list.scrollWidth > list.clientWidth)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
  });
});

test.describe("a request's page (spec 4.2)", () => {
  test("shows the facts, the asker's words and the offers, naming no one", async ({ page }) => {
    await page.goto("/looking-for/r-001");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accounting 1 tutor this week");
    await expect(page.locator(".request-facts li")).toHaveText([
      "Midrand",
      "Tutoring",
      "Budget R300",
      "Needed by 16 Oct",
      "Posted 13 Oct",
      "Asked by a student at Midrand",
    ]);
    await expect(page.getByText("stuck on adjustments and the trial balance", { exact: false })).toBeVisible();
    await expect(page.getByText("2 offers so far")).toBeVisible();
    await expect(page.getByRole("link", { name: "Offer to help" })).toHaveAttribute(
      "href",
      "/login?next=%2Flooking-for%2Fr-001%2Foffer",
    );
    await expect(page).toHaveTitle("Accounting 1 tutor this week · CampusCart");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /^I'm stuck on adjustments/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("shows listings already on CampusCart, the request's campus first, and links to the rest", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for/r-001");
    const related = page.getByRole("region", { name: "Already on CampusCart" });
    const cards = related.locator("article");
    await expect(cards).toHaveCount(4);
    const hrefs = await cards
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual(["/listings/l-005", "/listings/l-013", "/listings/l-031", "/listings/l-025"]);
    await related.getByRole("link", { name: "See all in Tutoring" }).click();
    await expect(page).toHaveURL(/\/browse\?cat=tutoring$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tutoring");
  });

  test("Offer to help goes through the sign-in page to the composer, and back", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for/r-001");
    await page.getByRole("link", { name: "Offer to help" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Flooking-for%2Fr-001%2Foffer$/);
    await page.getByRole("link", { name: "Go back" }).click();
    await expect(page).toHaveURL(/\/looking-for\/r-001$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accounting 1 tutor this week");
  });

  test("a closed request says so, with no way to offer", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for/r-015");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kettle for res");
    await expect(page.getByText("This request is closed")).toBeVisible();
    await expect(page.getByRole("link", { name: "Offer to help" })).toHaveCount(0);
  });

  test("a row opens its request, and the breadcrumb leads back to its category", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/looking-for");
    await page.getByRole("link", { name: "Business Law 2 notes" }).click();
    await expect(page).toHaveURL(/\/looking-for\/r-007$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Business Law 2 notes");
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Textbooks & notes" }).click();
    await expect(page).toHaveURL(/\/looking-for\?cat=textbooks-notes$/);
    await expect(rows(page)).toHaveCount(1);
  });
});

test.describe("the Hub (spec 5.1)", () => {
  test("tells the Hub's story and shows its Verified sellers", async ({ page }) => {
    await page.goto("/hub");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Incubation Hub");
    await expect(page.getByText("The Hub also runs CampusCart.", { exact: false })).toBeVisible();
    const verified = page.getByRole("region", { name: "Verified by the Hub" });
    await expect(verified.getByRole("link")).toHaveCount(9);
    await expect(verified.getByRole("link").first()).toHaveAttribute("href", "/sellers/code-coach");
    await expect(page).toHaveTitle("The Incubation Hub · CampusCart");
  });

  test("the Verified sellers scroll sideways on phones and wrap from the tablet step", async ({ page }) => {
    onlyAt("phone-390", "tablet-768", "desktop-1440");
    await page.goto("/hub");
    const row = page.locator(".hub-sellers");
    await expect(row).toBeVisible();
    const scrolls = await row.evaluate((list) => list.scrollWidth > list.clientWidth);
    expect(scrolls).toBe(project() === "phone-390");
  });

  test("lists upcoming events and office hours soonest first, then the tips, newest first", async ({ page }) => {
    await page.goto("/hub");
    await expect(page.getByRole("list", { name: "Tips" }).getByRole("heading", { level: 3 })).toHaveText(TIPS);
    // The past sample posts never show.
    await expect(page.getByText("Hub open day")).toHaveCount(0);
    // What's upcoming depends on the date the tests run, so check the order and that nothing has passed.
    const dated = page.getByRole("list", { name: "Events and office hours" });
    if ((await dated.count()) === 0) {
      await expect(page.getByText("Nothing planned right now. Check back soon.")).toBeVisible();
      return;
    }
    const times = await dated
      .locator("time")
      .evaluateAll((items) => items.map((item) => item.getAttribute("datetime")!));
    expect(times).toEqual([...times].sort());
    const today = SAST_DATE.format(new Date());
    for (const time of times) expect(sastDateOf(time) >= today, time).toBe(true);
  });

  test("the type tabs narrow the feed and keep it in view", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/hub");
    const tabs = page.getByRole("navigation", { name: "Post types" });
    await tabs.getByRole("link", { name: "Tips" }).click();
    await expect(page).toHaveURL(/\/hub\?type=tips#hub-feed$/);
    await expect(tabs.getByRole("link", { name: "Tips" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("list", { name: "Tips" }).getByRole("heading", { level: 3 })).toHaveCount(6);
    await expect(page.getByRole("list", { name: "Events and office hours" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "What’s on and what’s new" })).toBeInViewport();

    await tabs.getByRole("link", { name: "Events" }).click();
    await expect(page).toHaveURL(/\/hub\?type=events#hub-feed$/);
    await expect(page.getByRole("list", { name: "Tips" })).toHaveCount(0);
    // Every card left is an event (or, once the sample events are past, there are none).
    for (const kind of await hubCards(page).locator(".hub-card-kind").allTextContents()) expect(kind).toBe("Event");
  });
});

test.describe("Hub posts (spec 5.2)", () => {
  test("an upcoming event shows its facts, and RSVP goes through the sign-in page and back", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/hub?type=events");
    await expect(page.getByRole("navigation", { name: "Post types" })).toBeVisible();
    test.skip((await hubCards(page).count()) === 0, "No upcoming sample events on the date the tests run");
    const first = hubCards(page).first();
    const title = (await first.getByRole("heading", { level: 3 }).textContent())!;
    await first.getByRole("link").click();
    await expect(page).toHaveURL(/\/hub\/h-\d{3}$/);
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.locator(".hub-post-kind").filter({ visible: true })).toHaveText("Event");
    await expect(page.locator(".hub-post-facts li").filter({ visible: true })).toHaveCount(4);
    await page.getByRole("link", { name: "RSVP" }).click();
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fhub%2F${id}$`));
    await page.getByRole("link", { name: "Go back" }).click();
    await expect(page).toHaveURL(new RegExp(`/hub/${id}$`));
  });

  test("upcoming office hours offer Request a slot through the sign-in page", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/hub?type=office-hours");
    await expect(page.getByRole("navigation", { name: "Post types" })).toBeVisible();
    test.skip((await hubCards(page).count()) === 0, "No upcoming sample office hours on the date the tests run");
    await hubCards(page).first().getByRole("link").click();
    await expect(page).toHaveURL(/\/hub\/h-\d{3}$/);
    const id = new URL(page.url()).pathname.split("/").pop()!;
    // Signing in comes back to the post's request page (staff tools spec 2.5).
    await expect(page.getByRole("link", { name: "Request a slot" })).toHaveAttribute(
      "href",
      `/login?next=%2Fhub%2F${id}%2Fbook`,
    );
    await expect(page.getByText("Tell the mentor what you'd like help with when you sign in.")).toBeVisible();
  });

  test("a past event and past office hours still open, and say they've passed", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/hub/h-011");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hub open day");
    await expect(page.getByText("This event has passed")).toBeVisible();
    await expect(page.getByRole("link", { name: "RSVP" })).toHaveCount(0);
    await page.goto("/hub/h-012");
    await expect(page.getByText("These office hours have passed")).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a slot" })).toHaveCount(0);
  });

  test("a tip shows its date and its markdown body", async ({ page }) => {
    await page.goto("/hub/h-013");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How to price your first listing");
    await expect(page.locator(".hub-post-kind")).toHaveText("Tip");
    await expect(page.getByText("Posted 12 October 2026")).toBeVisible();
    const body = page.locator(".hub-post-body");
    await expect(body.getByRole("heading", { level: 2 })).toHaveText([
      "Start from what's out there",
      "Check your costs",
      "Leave room for a fair offer",
    ]);
    await expect(body.locator("ol > li")).toHaveCount(3);
    await expect(body.locator("strong")).toHaveText("don't go lower");
    await expect(body.locator("em")).toHaveText("Firm prices are fine too");
    const link = body.getByRole("link", { name: "browse what's already listed" });
    await expect(link).toHaveAttribute("href", "/browse");
    await expect(link).toHaveCSS("text-decoration-line", "underline");
    await expect(link).toHaveCSS("color", "rgb(30, 123, 168)");
    await expect(page).toHaveTitle("How to price your first listing · CampusCart");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /^Pricing is the first thing buyers look at/,
    );
  });

  test("More from the Hub offers up to three other upcoming posts", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/hub/h-013");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const more = page.getByRole("region", { name: "More from the Hub" });
    // It hides once nothing else is planned, which depends on the date the tests run.
    test.skip((await more.count()) === 0, "No upcoming sample events on the date the tests run");
    const cards = more.locator(".hub-card");
    expect(await cards.count()).toBeGreaterThan(0);
    expect(await cards.count()).toBeLessThanOrEqual(3);
    for (const kind of await cards.locator(".hub-card-kind").allTextContents()) {
      expect(["Event", "Office hours"]).toContain(kind);
    }
  });
});

test.describe("the homepage's links (spec 4.3 and 5.3)", () => {
  test("a request row opens its request", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await page.locator(".request-list").getByRole("link", { name: /Accounting 1 tutor this week/ }).click();
    await expect(page).toHaveURL(/\/looking-for\/r-001$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accounting 1 tutor this week");
  });

  test("What's on's RSVP or Book opens the event's post", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await expect(page.locator("#whats-on").locator(".event-action, .whats-on-empty").first()).toBeAttached();
    // What's on shows only upcoming events, so whether there are any depends on the date the tests run.
    test.skip((await page.locator("#whats-on .event-action").count()) === 0, "No upcoming sample events");
    const row = page.locator("#whats-on .event").first();
    const title = (await row.locator(".event-title").textContent())!;
    const href = (await row.locator(".event-action").getAttribute("href"))!;
    expect(href).toMatch(/^\/hub\/h-\d{3}$/);
    await row.locator(".event-action").click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });
});
