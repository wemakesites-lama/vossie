import { brotliCompressSync, constants } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { WORKER_REGISTRATION } from "../../lib/boot-script";

// Saved reads the saved cookie, so it's measured with two listings saved: its cards and their hearts load as they would.
const PAGES: ReadonlyArray<[name: string, path: string, saved?: string]> = [
  ["homepage", "/"],
  ["browse page", "/browse"],
  ["listing page", "/listings/l-001"],
  ["info page", "/how-it-works"],
  ["sign-in page", "/login"],
  ["storefront", "/sellers/tech-corner"],
  ["Saved page", "/saved", "l-001.l-026"],
  ["collection page", "/collections/start-of-semester"],
  ["Looking For board", "/looking-for"],
  ["request page", "/looking-for/r-001"],
  ["Hub page", "/hub"],
  ["Hub post", "/hub/h-013"],
  ["Hub event", "/hub/h-001"],
  ["Hub office hours", "/hub/h-002"],
  ["sell page", "/sell"],
  ["Saved page, Shops tab", "/saved?tab=shops"],
];

/**
 * The addresses of photos that load only because they are lazy and sit below the first screen: images with
 * `loading="lazy"` whose top is past the bottom of the window, the page being unscrolled. Chrome fetches those within a
 * margin of the window, so how many it fetches before the network goes quiet changes from run to run. An address that
 * an image above the fold or an eager one uses too is not in the set. Spec 11 measures "before below-the-fold photos".
 */
async function belowTheFoldPhotos(page: Page): Promise<Set<string>> {
  const urls = await page.evaluate(() => {
    const above = new Set<string>();
    const below = new Set<string>();
    for (const image of document.images) {
      if (!image.currentSrc) continue;
      const lazyBelow = image.loading === "lazy" && image.getBoundingClientRect().top >= window.innerHeight;
      (lazyBelow ? below : above).add(image.currentSrc);
    }
    return [...below].filter((url) => !above.has(url));
  });
  return new Set(urls);
}

for (const [name, path, saved] of PAGES) {
  test(`a first visit to the ${name} stays inside the size budgets`, async ({ page, context, baseURL }) => {
    test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
    if (saved) await context.addCookies([{ name: "vossie_saved", value: saved, url: baseURL! }]);
    const pending: Array<Promise<void>> = [];
    // script, font and total are the gzip transfer sizes `next start` serves. scriptBrotli is the same scripts
    // compressed the way a host serves them. `total` is the first visit as spec 11 defines it, before below-the-fold
    // photos: it leaves out the link prefetches (the `?_rsc=` requests the page's links make as they come into view)
    // and the lazy photos below the first screen, whose number changes from run to run. `everything` is the old
    // measure, every byte until the network went quiet, logged beside it.
    const bytes = { script: 0, scriptBrotli: 0, font: 0, total: 0, everything: 0 };
    const finished: Array<{ url: string; size: number }> = [];

    page.on("requestfinished", (request) => {
      pending.push(
        request.sizes().then((sizes) => {
          finished.push({ url: request.url(), size: sizes.responseBodySize + sizes.responseHeadersSize });
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
    const belowTheFold = await belowTheFoldPhotos(page);
    for (const { url, size } of finished) {
      bytes.everything += size;
      if (!url.includes("_rsc=") && !belowTheFold.has(url)) bytes.total += size;
    }
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

// Pages for a signed-in visitor, measured on a first visit with only the session cookie copied in, so nothing is
// cached yet (accounts plan, Task 14; messaging plan, Task 16). The seller reads the thread and notifications. The
// listing form's two pages are the only routes with selling's client code, the photo field (selling plan, Task 12).
const SIGNED_IN_PAGES: ReadonlyArray<[name: string, path: string, account: string]> = [
  ["account page", "/account", "Student, Midrand"],
  ["inbox page", "/messages", "Student, Midrand"],
  ["thread page", "/messages/conv-s1", "Seller, Tech corner"],
  ["composer page", "/listings/l-002/message", "Student, Midrand"],
  ["report page", "/report?listing=l-002", "Student, Midrand"],
  ["notifications page", "/notifications", "Seller, Tech corner"],
  ["new listing form", "/sell/listings/new", "Seller, Tech corner"],
  ["edit listing form", "/sell/listings/l-001/edit", "Seller, Tech corner"],
  // Every other selling page, and the owner's views of the listing page and storefront, have no client code of their own
  // (Task 17 checks it): they should come to the same figure as a page with none.
  ["dashboard", "/sell", "Seller, Tech corner"],
  ["waiting page", "/sell", "Seller waiting for approval"],
  ["my listings page", "/sell/listings", "Seller, Tech corner"],
  ["delete listing page", "/sell/listings/l-001/delete", "Seller, Tech corner"],
  ["edit shop page", "/sell/profile", "Seller, Tech corner"],
  ["onboarding page", "/sell/onboarding", "Student, Midrand"],
  ["storefront, its owner's view", "/sellers/tech-corner", "Seller, Tech corner"],
  ["listing page, its owner's view", "/listings/l-001", "Seller, Tech corner"],
  // Community actions' new pages carry only the shell (community actions spec 5), measured signed in as the sample
  // student, and the pages it changed for a signed-in visitor. The pages that need a request of the account's own (edit,
  // delete, the composer's form) are measured by community-checks.spec.ts, which posts one.
  ["request form", "/looking-for/new", "Student, Midrand"],
  ["Your requests", "/account/requests", "Student, Midrand"],
  ["offer composer (no shop)", "/looking-for/r-002/offer", "Student, Midrand"],
  ["Saved page, Shops tab", "/saved?tab=shops", "Student, Midrand"],
  ["Looking For board", "/looking-for", "Student, Midrand"],
  ["request page", "/looking-for/r-001", "Student, Midrand"],
  ["storefront, a student's view", "/sellers/tech-corner", "Student, Midrand"],
];

for (const [name, path, account] of SIGNED_IN_PAGES) {
  test(`a first visit to the ${name}, signed in, stays inside the JavaScript budget`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
    // Sign in in a separate browser context, and copy only the session cookie across, so nothing here is cached yet.
    const other = await browser.newContext({ serviceWorkers: "block" });
    const signingIn = await other.newPage();
    await signingIn.goto(`${baseURL}/login`);
    await signingIn.locator("main").getByRole("button", { name: account, exact: true }).click();
    await signingIn.waitForURL(/\/account$/);
    await context.addCookies((await other.cookies()).filter((cookie) => cookie.name === "vossie_session"));
    await other.close();

    let scriptBrotli = 0;
    const pending: Array<Promise<void>> = [];
    page.on("response", (response) => {
      if (response.request().resourceType() !== "script") return;
      pending.push(
        response.body().then((body) => {
          scriptBrotli += brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
        }),
      );
    });
    await page.goto(path, { waitUntil: "networkidle" });
    // A session that didn't carry over would be sent to sign-in, which has an h1 too: check we're on the page itself.
    await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, "\\$&")}$`));
    await expect(page.locator("main h1")).toBeVisible();
    await Promise.all(pending);
    console.log(`${name} (signed in): ${JSON.stringify({ scriptBrotli })}`);
    expect(scriptBrotli, "JavaScript, brotli as a host serves it").toBeLessThanOrEqual(150 * 1024);
  });
}

/** The registration wherever the HTML holds it: in <head> as it is, and with its quotes escaped in the RSC payload. */
const registrationAnywhere = new RegExp(
  WORKER_REGISTRATION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/"/g, '\\\\*"'),
  "g",
);

test("the worker's registration costs under 100 B in a page's HTML (community actions spec 2.22, the cut rule)", async ({
  request,
}) => {
  test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
  const brotli = (text: string) =>
    brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
  for (const path of ["/", "/listings/l-001", "/looking-for/r-001"]) {
    const html = await (await request.get(path)).text();
    expect(html.match(registrationAnywhere)?.length ?? 0, path).toBeGreaterThanOrEqual(1);
    // Nothing of it may be left once the matches are gone, or the cost below would be measured short.
    expect(html.replace(registrationAnywhere, ""), path).not.toContain("serviceWorker");
    const cost = brotli(html) - brotli(html.replace(registrationAnywhere, ""));
    console.log(`worker registration in ${path}'s HTML: ${cost} B brotli`);
    expect(cost, path).toBeLessThan(100);
  }
});
