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
