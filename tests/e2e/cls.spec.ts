import { expect, test } from "@playwright/test";

type Shift = { value: number; nodes: string[] };

// A campus (the `vossie_campus` cookie) changes what the page shows and where the campus note, the empty state and the
// results fall, so those pages are measured with one chosen too. Midrand has results; Mbombela has none. Saved reads
// the `vossie_saved` cookie, so it's measured with listings saved and with none.
const PAGES: ReadonlyArray<[name: string, path: string, cookies?: Readonly<Record<string, string>>]> = [
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
];

for (const [name, path, cookies] of PAGES) {
  test(`the ${name} holds still while fonts and content arrive (CLS 0.05 or less, spec 11)`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Measured at 390 and 1440");
    if (cookies) {
      await context.addCookies(Object.entries(cookies).map(([cookie, value]) => ({ name: cookie, value, url: baseURL! })));
    }

    // Hold the fonts back, so they swap in after first paint: the worst case for shifts.
    await page.route(/\.woff2$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    await page.addInitScript(() => {
      type LayoutShift = PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources?: Array<{ node?: Node | null }>;
      };
      const shifts: Array<{ value: number; nodes: string[] }> = [];
      (window as unknown as { __shifts: typeof shifts }).__shifts = shifts;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LayoutShift[]) {
          if (entry.hadRecentInput) continue;
          shifts.push({
            value: entry.value,
            nodes: (entry.sources ?? []).map(({ node }) =>
              node instanceof Element ? `${node.tagName.toLowerCase()}.${[...node.classList].join(".")}` : String(node?.nodeName),
            ),
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    // Two frames, so a last shift is recorded.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const shifts = await page.evaluate(() => (window as unknown as { __shifts: Shift[] }).__shifts);
    // The sum of every shift: never less than CLS, which only counts the worst burst, so this is the stricter check.
    const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
    console.log(`${name} layout shift: ${total.toFixed(4)} ${JSON.stringify(shifts)}`);
    expect(total, "cumulative layout shift").toBeLessThanOrEqual(0.05);
  });
}
