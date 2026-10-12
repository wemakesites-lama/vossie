import { expect, test } from "@playwright/test";

type Shift = { value: number; nodes: string[] };

test("the homepage holds still while fonts and sections arrive (CLS 0.05 or less, spec 11)", async ({ page }) => {
  test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Measured at 390 and 1440");

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

  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Two frames, so a last shift is recorded.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const shifts = await page.evaluate(() => (window as unknown as { __shifts: Shift[] }).__shifts);
  // The sum of every shift: never less than CLS, which only counts the worst burst, so this is the stricter check.
  const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
  console.log(`Homepage layout shift: ${total.toFixed(4)} ${JSON.stringify(shifts)}`);
  expect(total, "cumulative layout shift").toBeLessThanOrEqual(0.05);
});
