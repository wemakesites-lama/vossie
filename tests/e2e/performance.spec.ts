import { brotliCompressSync, constants } from "node:zlib";
import { expect, test } from "@playwright/test";

// Saved reads the saved cookie, so it's measured with two listings saved: its cards and their hearts load as they would.
const PAGES: ReadonlyArray<[name: string, path: string, saved?: string]> = [
  ["homepage", "/"],
  ["browse page", "/browse"],
  ["listing page", "/listings/l-001"],
  ["info page", "/how-it-works"],
  ["storefront", "/sellers/tech-corner"],
  ["Saved page", "/saved", "l-001.l-026"],
  ["collection page", "/collections/start-of-semester"],
];

for (const [name, path, saved] of PAGES) {
  test(`a first visit to the ${name} stays inside the size budgets`, async ({ page, context, baseURL }) => {
    test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
    if (saved) await context.addCookies([{ name: "vossie_saved", value: saved, url: baseURL! }]);
    const pending: Array<Promise<void>> = [];
    // script, font and total are the gzip transfer sizes `next start` serves. scriptBrotli is the same scripts
    // compressed the way a host serves them.
    const bytes = { script: 0, scriptBrotli: 0, font: 0, total: 0 };

    page.on("requestfinished", (request) => {
      pending.push(
        request.sizes().then((sizes) => {
          bytes.total += sizes.responseBodySize + sizes.responseHeadersSize;
          if (request.resourceType() === "script") bytes.script += sizes.responseBodySize;
          if (request.resourceType() === "font") bytes.font += sizes.responseBodySize;
        }),
      );
    });

    // response.body() is the decoded body, so compressing it ourselves gives the brotli size.
    page.on("response", (response) => {
      if (response.request().resourceType() !== "script") return;
      pending.push(
        response.body().then((body) => {
          bytes.scriptBrotli += brotliCompressSync(body, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
          }).length;
        }),
      );
    });

    await page.goto(path, { waitUntil: "networkidle" });
    // A Saved row must measure the cards, not the empty state a cookie mix-up would show.
    if (saved) await expect(page.locator("main article")).toHaveCount(saved.split(".").length);
    await Promise.all(pending);
    console.log(`${name}: ${JSON.stringify(bytes)}`);

    // The JavaScript budget is measured brotli-compressed, as a host serves it. `next start` only does gzip, which
    // is larger, so it would fail a budget the live site meets. Quality 5 is the level CDNs usually compress at on
    // the fly (their pre-compressed, higher-quality files are smaller still). The gzip figure is logged above for
    // comparison.
    expect(bytes.scriptBrotli, "JavaScript, brotli as a host serves it").toBeLessThanOrEqual(150 * 1024);
    expect(bytes.font, "fonts").toBeLessThanOrEqual(60 * 1024);
    expect(bytes.total, "whole first visit").toBeLessThanOrEqual(350 * 1024);
  });
}
