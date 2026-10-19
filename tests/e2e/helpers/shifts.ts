import { expect, type BrowserContext, type Page } from "@playwright/test";

// Layout shift measuring, shared by cls.spec.ts and community-checks.spec.ts (community actions plan, Task 23).

export type Shift = { value: number; nodes: string[] };

/**
 * From the next page load on, keeps every layout shift in `window.__shifts`. Shifts marked as following input count
 * too: nothing is pressed during the load, and Chrome marks every shift that way under the phones' mobile emulation, so
 * leaving them out measured nothing at 390.
 */
export async function recordShifts(page: Page): Promise<void> {
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
export async function expectStill(page: Page, name: string, path: string): Promise<void> {
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

/** Holds the fonts back, so they swap in after first paint: the worst case for shifts. */
export async function holdFonts(page: Page): Promise<void> {
  await page.route(/\.woff2$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
}

/** 350 ms latency and 400 kbps, the slow network of cls.spec.ts's throttled rows. */
export async function throttle(context: BrowserContext, page: Page): Promise<void> {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 350,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  });
}
