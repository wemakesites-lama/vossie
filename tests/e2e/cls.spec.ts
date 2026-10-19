import { expect, test, type Page } from "@playwright/test";

type Shift = { value: number; nodes: string[] };

/**
 * From the next page load on, keeps every layout shift in `window.__shifts`. Shifts marked as following input count
 * too: nothing is pressed during the load, and Chrome marks every shift that way under the phones' mobile emulation, so
 * leaving them out measured nothing at 390.
 */
async function recordShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type LayoutShift = PerformanceEntry & {
      value: number;
      sources?: Array<{ node?: Node | null }>;
    };
    const shifts: Array<{ value: number; nodes: string[] }> = [];
    (window as unknown as { __shifts: typeof shifts }).__shifts = shifts;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShift[]) {
        shifts.push({
          value: entry.value,
          nodes: (entry.sources ?? []).map(({ node }) =>
            node instanceof Element ? `${node.tagName.toLowerCase()}.${[...node.classList].join(".")}` : String(node?.nodeName),
          ),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

/** Loads `path` and checks the sum of its layout shifts once the fonts are in. */
async function expectStill(page: Page, name: string, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Two frames, so a last shift is recorded.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const shifts = await page.evaluate(() => (window as unknown as { __shifts: Shift[] }).__shifts);
  // The sum of every shift: never less than CLS, which only counts the worst burst, so this is the stricter check.
  const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
  console.log(`${name} layout shift: ${total.toFixed(4)} ${JSON.stringify(shifts)}`);
  expect(total, "cumulative layout shift").toBeLessThanOrEqual(0.05);
}

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

    // Hold the fonts back, so they swap in after first paint: the worst case for shifts.
    await page.route(/\.woff2$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

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
  ["homepage", "/"],
  ["browse page (campus mbombela: no results)", "/browse", undefined, { vossie_campus: "mbombela" }],
  ["browse page (campus midrand)", "/browse", undefined, { vossie_campus: "midrand" }],
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

    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 350,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (400 * 1024) / 8,
    });
    await recordShifts(page);
    await expectStill(page, `${name} (slow network)`, path);
  });
}
