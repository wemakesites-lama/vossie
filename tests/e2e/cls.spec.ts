import { test } from "@playwright/test";
import { expectStill, holdFonts, recordShifts, throttle } from "./helpers/shifts";

// A campus (the `vossie_campus` cookie) changes what the page shows and where the campus note, the empty state and the
// results fall, so those pages are measured with one chosen too. Midrand has results; Mbombela has none. Saved reads
// the `vossie_saved` cookie, so it's measured with listings saved and with none. The Looking For board reads the campus
// cookie too; Mbombela has no requests of its own. A Hub event's and office hours' action streams in, so both are
// measured. Account pages are measured signed in, with a sample account. Messaging's pages are measured signed in too:
// the seller for a thread and notifications, which the seller only reads. Selling pages are measured as the sample
// account they belong to: Tech corner's seller for the dashboard, the forms and the owner's own pages, and the shop
// waiting for approval for its pages. The sample seller and student are only read here (selling plan, Task 17).
const PAGES: ReadonlyArray<
  [name: string, path: string, cookies?: Readonly<Record<string, string>>, signIn?: string]
> = [
  ["homepage", "/"],
  ["browse page", "/browse"],
  ["listing page", "/listings/l-001"],
  ["how it works page", "/how-it-works"],
  ["privacy page", "/privacy"],
  ["listing page (campus pretoria)", "/listings/l-001", { vossie_campus: "pretoria" }],
  ["browse page (campus midrand)", "/browse", { vossie_campus: "midrand" }],
  ["browse page (campus mbombela)", "/browse", { vossie_campus: "mbombela" }],
  ["storefront", "/sellers/tech-corner"],
  ["storefront (nothing listed)", "/sellers/lash-lounge"],
  ["Saved page", "/saved", { vossie_saved: "l-001.l-026.l-016.l-007.l-004.l-009" }],
  ["Saved page (nothing saved)", "/saved"],
  ["collection page", "/collections/start-of-semester"],
  ["Looking For board", "/looking-for"],
  ["Looking For board (campus mbombela)", "/looking-for", { vossie_campus: "mbombela" }],
  ["request page", "/looking-for/r-001"],
  ["Hub page", "/hub"],
  ["Hub event", "/hub/h-001"],
  ["Hub office hours", "/hub/h-002"],
  ["Hub tip", "/hub/h-013"],
  ["sign-in page", "/login"],
  ["account page", "/account", undefined, "Student, Midrand"],
  ["privacy settings page", "/account/privacy", undefined, "Student, Midrand"],
  ["homepage (signed in: the badge and the strip)", "/", undefined, "Student, Midrand"],
  ["composer page", "/listings/l-002/message", undefined, "Student, Midrand"],
  ["inbox page", "/messages", undefined, "Student, Midrand"],
  ["thread page", "/messages/conv-s1", undefined, "Seller, Tech corner"],
  ["report page", "/report?listing=l-002", undefined, "Student, Midrand"],
  ["notifications page", "/notifications", undefined, "Seller, Tech corner"],
  ["sell page", "/sell"],
  ["sell page (dashboard)", "/sell", undefined, "Seller, Tech corner"],
  ["sell page (waiting for approval)", "/sell", undefined, "Seller waiting for approval"],
  ["my listings page", "/sell/listings", undefined, "Seller, Tech corner"],
  ["my listings page (nothing paused)", "/sell/listings?tab=paused", undefined, "Seller, Tech corner"],
  ["my listings page (shop waiting for approval)", "/sell/listings", undefined, "Seller waiting for approval"],
  ["delete listing page", "/sell/listings/l-001/delete", undefined, "Seller, Tech corner"],
  ["new listing form", "/sell/listings/new", undefined, "Seller, Tech corner"],
  ["edit listing form", "/sell/listings/l-001/edit", undefined, "Seller, Tech corner"],
  ["edit shop page", "/sell/profile", undefined, "Seller, Tech corner"],
  ["onboarding, step 1", "/sell/onboarding", undefined, "Student, Midrand"],
  ["onboarding, step 4", "/sell/onboarding?step=4", undefined, "Student, Midrand"],
  ["storefront (its owner's view)", "/sellers/tech-corner", undefined, "Seller, Tech corner"],
  ["listing page (its owner's view)", "/listings/l-001", undefined, "Seller, Tech corner"],
  // Community actions (community actions plan, Task 23). The pages that need a request of the account's own (edit,
  // delete, the asker's panel, the composer's form) are measured in community-checks.spec.ts, which posts one.
  ["Looking For board (signed in)", "/looking-for", undefined, "Student, Midrand"],
  ["request page (signed in)", "/looking-for/r-001", undefined, "Student, Midrand"],
  ["request form", "/looking-for/new", undefined, "Student, Midrand"],
  ["Your requests", "/account/requests", undefined, "Student, Midrand"],
  ["offer composer (no shop)", "/looking-for/r-002/offer", undefined, "Student, Midrand"],
  ["offer composer (a shop, on a sample request)", "/looking-for/r-002/offer", undefined, "Seller, Tech corner"],
  ["offer composer (shop waiting for approval)", "/looking-for/r-002/offer", undefined, "Seller waiting for approval"],
  ["Saved page, Shops tab", "/saved?tab=shops"],
  ["Saved page, Shops tab (signed in)", "/saved?tab=shops", undefined, "Student, Midrand"],
  ["storefront (a student's view: Follow)", "/sellers/tech-corner", undefined, "Student, Midrand"],
  // Search alerts (search alerts plan, Task 9). The row keeps its height whatever the session says (decision 6).
  ["browse page, a search", "/browse?q=calculator"],
  ["browse page, a search (signed in)", "/browse?q=calculator", undefined, "Student, Midrand"],
  ["Saved page, Searches tab", "/saved?tab=searches"],
  ["Saved page, Searches tab (signed in)", "/saved?tab=searches", undefined, "Student, Midrand"],
  // Role views N4: the mentor's caseload (Needs you is in staff-checks.spec.ts) and a shop's page.
  ["mentor caseload (all)", "/mentor?view=all", undefined, "Mentor"],
  ["mentor shop page", "/mentor/tech-corner", undefined, "Mentor"],
  ["offline page", "/offline"],
];

for (const [name, path, cookies, signIn] of PAGES) {
  test(`the ${name} holds still while fonts and content arrive (CLS 0.05 or less, spec 11)`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Measured at 390 and 1440");
    if (cookies) {
      await context.addCookies(Object.entries(cookies).map(([cookie, value]) => ({ name: cookie, value, url: baseURL! })));
    }
    if (signIn) {
      // Signed in with a sample account's button first. The measure below is a fresh page load, so only it counts.
      await page.goto("/login");
      await page.locator("main").getByRole("button", { name: signIn, exact: true }).click();
      await page.waitForURL(/\/account$/);
    }

    await holdFonts(page);
    await recordShifts(page);
    await expectStill(page, name, path);
  });
}

// The same pages on a slow network (350 ms latency, 400 kbps), with the CSS, fonts and scripts already cached, as on
// any page after the first. The browser then paints the page as it arrives, and React shows a <Suspense> boundary's
// content no sooner than 300 ms after that first paint, even when it arrived with the page: React streams a finished
// boundary after the rest of the page when the page before it is over 12.8 KB, and the layout alone is. So a fallback
// shorter than its content (null, around a whole page that waits on its params), or a skeleton taller than a short
// state, is on screen for a while, and the footer moved when it gave way. The first paint can also fall between two
// parts of the page's HTML: the homepage's photo sits above the hero's panel on phones but comes after it in the page,
// and the panel dropped when the photo arrived. Signed in or out, it's the same: signing in loads two pages first, so
// it warms the cache, and the signed-out rows load the sign-in page first for the same reason. At full speed the whole
// page arrives before the first paint, so the rows above can't see it. Browse is measured with no results (Mbombela),
// the shortest state under its skeleton, and with results (Midrand).
const SLOW_PAGES: ReadonlyArray<
  [name: string, path: string, signIn?: string, cookies?: Readonly<Record<string, string>>]
> = [
  ["storefront", "/sellers/tech-corner", "Student, Midrand"],
  ["storefront (signed out)", "/sellers/tech-corner"],
  ["listing page", "/listings/l-001", "Student, Midrand"],
  ["request page", "/looking-for/r-001", "Student, Midrand"],
  ["collection page", "/collections/start-of-semester", "Student, Midrand"],
  ["Hub event", "/hub/h-001", "Student, Midrand"],
  ["Saved page (nothing saved)", "/saved", "Student, Midrand"],
  ["Saved page's Shops tab (none followed)", "/saved?tab=shops", "Student, Midrand"],
  ["Saved page's Shops tab (signed out)", "/saved?tab=shops"],
  ["Looking For board", "/looking-for", "Student, Midrand"],
  // Messaging's pages hold a few rows, far fewer than their skeletons: the footer was in the first screen after they
  // streamed in (0.09 at 390 for the seller's inbox), until the pages were made a screen tall (community actions plan,
  // Task 23, amendment 20.2).
  ["inbox page (buying)", "/messages", "Student, Midrand"],
  ["inbox page (selling)", "/messages?tab=selling", "Seller, Tech corner"],
  ["thread page", "/messages/conv-s1", "Seller, Tech corner"],
  // Role views N2: the seller home's cards stream in under a short skeleton, on a screen-tall page (plan decision 15).
  ["seller home", "/sell", "Seller, Tech corner"],
  ["Your listings", "/sell/listings", "Seller, Tech corner"],
  // The sections reserve their sidebar column from the tablet step (data-bar), so the page doesn't move right when the
  // bar streams in after it: 0.18 on /sell and 0.39 on /admin at 1440 before. A visitor's /sell has the side panel.
  ["sell page (signed out)", "/sell"],
  ["Hub console's Today", "/admin", "Admin"],
  // Role views N3: the campus chips and the Next links stream in with Reports and Hidden.
  ["Hub console's Reports", "/admin/reports", "Admin"],
  ["Hub console's Hidden", "/admin/hidden", "Admin"],
  ["mentoring page", "/mentor", "Mentor"],
  // Role views N4: the caseload's All view and a shop's page, forms first, stream in under the staff skeleton.
  ["mentor caseload (all)", "/mentor?view=all", "Mentor"],
  ["mentor shop page", "/mentor/tech-corner", "Mentor"],
  ["notifications page", "/notifications", "Seller, Tech corner"],
  ["request form", "/looking-for/new", "Student, Midrand"],
  ["Your requests", "/account/requests", "Student, Midrand"],
  ["offer composer (no shop)", "/looking-for/r-002/offer", "Student, Midrand"],
  ["offer composer (a shop, on a sample request)", "/looking-for/r-002/offer", "Seller, Tech corner"],
  ["homepage", "/"],
  ["browse page (campus mbombela: no results)", "/browse", undefined, { vossie_campus: "mbombela" }],
  ["browse page (campus midrand)", "/browse", undefined, { vossie_campus: "midrand" }],
  // Search alerts (plan amendment 7): the Save row streams in under the chips, and the Searches tab under its tabs.
  ["browse page, a search (signed out)", "/browse?q=calculator"],
  ["browse page, a search", "/browse?q=calculator", "Student, Midrand"],
  ["Saved page's Searches tab (none saved)", "/saved?tab=searches", "Student, Midrand"],
  ["Saved page's Searches tab (signed out)", "/saved?tab=searches"],
];

for (const [name, path, signIn, cookies] of SLOW_PAGES) {
  test(`the ${name} holds still on a slow network, after another page (CLS 0.05 or less, spec 11)`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Measured at 390 and 1440");
    test.slow();
    if (cookies) {
      await context.addCookies(Object.entries(cookies).map(([cookie, value]) => ({ name: cookie, value, url: baseURL! })));
    }
    if (signIn) {
      await page.goto("/login");
      await page.locator("main").getByRole("button", { name: signIn, exact: true }).click();
      await page.waitForURL(/\/account$/);
    } else {
      await page.goto("/login");
    }
    await page.waitForLoadState("networkidle");

    await throttle(context, page);
    await recordShifts(page);
    await expectStill(page, `${name} (slow network)`, path);
  });
}

// Role views N1 (plan Task 16): the section bars stream in after the page. On phones the bar is fixed, so it moves
// nothing; from the tablet step it's a sidebar column, which appears when the bar arrives (plan Task 11 Step 6), so
// these are measured at 768 too.
const SECTION_PAGES: ReadonlyArray<[name: string, path: string, signIn?: string]> = [
  ["Hub console's Today", "/admin", "Admin"],
  ["mentoring page", "/mentor", "Mentor"],
  ["sell page (the seller's bar)", "/sell", "Seller, Tech corner"],
  ["sell page (signed out: the side panel)", "/sell"],
];

for (const [name, path, signIn] of SECTION_PAGES) {
  test(`the ${name} holds still while its section bar arrives (CLS 0.05 or less, spec 11)`, async ({ page }) => {
    test.skip(
      !["phone-390", "tablet-768", "desktop-1440"].includes(test.info().project.name),
      "Measured at 390, 768 and 1440",
    );
    // Phones have no side panel, and the pitch at 390 is the "sell page" row above.
    test.skip(!signIn && test.info().project.name === "phone-390", "No side panel on phones");
    if (signIn) {
      await page.goto("/login");
      await page.locator("main").getByRole("button", { name: signIn, exact: true }).click();
      await page.waitForURL(/\/account$/);
    }

    await holdFonts(page);
    await recordShifts(page);
    await expectStill(page, name, path);
  });
}
