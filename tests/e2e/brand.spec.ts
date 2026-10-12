import { expect, test } from "@playwright/test";

test("brand colours, fonts and language are applied", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("on campus");

  const styles = await page.evaluate(() => {
    const hero = document.querySelector("#hero-title")!.closest("section")!;
    const word = document.querySelector("#hero-title span")!;
    return {
      heroBackground: getComputedStyle(hero).backgroundColor,
      wordColour: getComputedStyle(word).color,
      headingFont: getComputedStyle(document.querySelector("#hero-title")!).fontFamily,
      bodyFont: getComputedStyle(document.body).fontFamily,
      lang: document.documentElement.lang,
    };
  });

  expect(styles.heroBackground).toBe("rgb(21, 48, 93)"); // navy #15305D
  expect(styles.wordColour).toBe("rgb(41, 171, 226)"); // sky #29ABE2
  expect(styles.headingFont).toMatch(/Special Gothic Condensed One/);
  expect(styles.bodyFont).toMatch(/Geist/);
  expect(styles.lang).toBe("en-ZA");
});

test("the brand fonts actually load", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    await document.fonts.ready;
    const families = new Set([...document.fonts].map((face) => face.family.replace(/^["']|["']$/g, "")));
    return {
      declared: ["Special Gothic Condensed One", "Geist"].every((name) => families.has(name)),
      display: document.fonts.check('16px "Special Gothic Condensed One"'),
      text: document.fonts.check('16px "Geist"'),
    };
  });
  expect(result).toEqual({ declared: true, display: true, text: true });
});

test("data saver collapses transitions", async ({ page }) => {
  await page.goto("/");
  const bodyTransition = () => page.evaluate(() => getComputedStyle(document.body).transitionDuration);
  expect(await bodyTransition()).toBe("0s");
  await page.evaluate(() => document.documentElement.setAttribute("data-low-data", ""));
  expect(await bodyTransition()).toBe("0s");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("transitions collapse", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(() => getComputedStyle(document.body).transitionDuration)).toBe("0s");
  });
});
