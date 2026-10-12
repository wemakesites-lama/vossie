import { expect, test } from "@playwright/test";

test("a first visit to the homepage stays inside the size budgets", async ({ page }) => {
  test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
  const pending: Array<Promise<void>> = [];
  const bytes = { script: 0, font: 0, total: 0 };

  page.on("requestfinished", (request) => {
    pending.push(
      request.sizes().then((sizes) => {
        bytes.total += sizes.responseBodySize + sizes.responseHeadersSize;
        if (request.resourceType() === "script") bytes.script += sizes.responseBodySize;
        if (request.resourceType() === "font") bytes.font += sizes.responseBodySize;
      }),
    );
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await Promise.all(pending);
  console.log(`Homepage shell: ${JSON.stringify(bytes)}`);

  expect(bytes.script, "JavaScript, compressed").toBeLessThanOrEqual(150 * 1024);
  expect(bytes.font, "fonts").toBeLessThanOrEqual(60 * 1024);
  expect(bytes.total, "whole first visit").toBeLessThanOrEqual(350 * 1024);
});
