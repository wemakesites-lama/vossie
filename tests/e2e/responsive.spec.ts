import { expect, test } from "@playwright/test";

// The projects cover 360, 390, 768, 1024 and 1440 (phones with mobile emulation).
// These are the spec's other test widths.
const EXTRA_WIDTHS = [430, 1280];

const sidewaysOverflow = () =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth;

test("no sideways scrolling at this project's size", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready); // measure after the web fonts swap in
  expect(await page.evaluate(sidewaysOverflow)).toBeLessThanOrEqual(0);
});

test("no sideways scrolling at the in-between widths", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop-1440", "This test walks the extra widths itself");
  for (const width of EXTRA_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(sidewaysOverflow), `sideways overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
});

test("the main controls are reachable with the keyboard", async ({ page }) => {
  await page.goto("/");
  const reached = new Set<string>();
  for (let i = 0; i < 250; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return "";
      return (active.getAttribute("aria-label") || active.textContent || "").trim().replace(/\s+/g, " ");
    });
    if (name) reached.add(name);
  }
  const expectedNames = [
    "Skip to content",
    "Menu",
    "Vossie home",
    "Account",
    "Shop your campus",
    "Start selling",
    "Get updates",
    // The homepage's own controls (spec section 15). Not the events' RSVP links: What's on shows only upcoming
    // events, so whether there are any depends on the date the tests run.
    "Save ",
    "Show slide 1 of 3",
    "Post a request",
    "Our story",
  ];
  for (const expected of expectedNames) {
    expect([...reached].some((name) => name.startsWith(expected)), `${expected} should be reachable`).toBe(true);
  }
});
