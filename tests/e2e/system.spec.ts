import { expect, test } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

test.describe("robots.txt and the sitemap (info and system spec 2.8)", () => {
  test("robots.txt lets crawlers in, keeps them off private pages and names the sitemap", async ({ request }) => {
    onlyAt("desktop-1440");
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    const lines = (await response.text()).split("\n");
    expect(lines).toContain("User-Agent: *");
    expect(lines).toContain("Allow: /");
    for (const path of ["/saved", "/login", "/account", "/sell$", "/sell/"]) {
      expect(lines).toContain(`Disallow: ${path}`);
    }
    // A bare "/sell" would also hide every /sellers/… storefront (plan decision 8).
    expect(lines).not.toContain("Disallow: /sell");
    expect(lines.some((line) => /^Sitemap: https?:\/\/\S+\/sitemap\.xml$/.test(line))).toBe(true);
  });

  test("the sitemap lists the public pages, listings, sellers and collections, and nothing private", async ({
    request,
  }) => {
    onlyAt("desktop-1440");
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    const paths = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
    for (const path of [
      "/",
      "/browse",
      "/looking-for",
      "/hub",
      "/how-it-works",
      "/safety",
      "/trust",
      "/listings/l-001",
      "/sellers/tech-corner",
      "/collections/exam-season",
    ]) {
      expect(paths, path).toContain(path);
    }
    // Saved, sign-in, the account and the selling pages belong to one person. Privacy, Terms and Seller guidelines are
    // drafts marked noindex until Eduvos signs them off, so the sitemap doesn't ask search engines for them (plan
    // amendment 1). Add them to this list of listed pages when the noindex comes off.
    for (const path of ["/saved", "/login", "/account", "/sell", "/privacy", "/terms", "/seller-guidelines"]) {
      expect(paths, path).not.toContain(path);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("the share card, robots.txt and the sitemap all name the same site (spec 2.7)", async ({ page, request }) => {
    onlyAt("desktop-1440");
    await page.goto("/listings/l-001");
    await page.waitForLoadState("networkidle");
    const images = page.locator('meta[property="og:image"]');
    await expect(images).toHaveCount(1);
    const origin = new URL((await images.getAttribute("content"))!).origin;
    expect(await (await request.get("/robots.txt")).text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
    expect(await (await request.get("/sitemap.xml")).text()).toContain(`<loc>${origin}/listings/l-001</loc>`);
  });
});

test.describe("the default share card (info and system spec 2.12)", () => {
  test("/opengraph-image answers with a PNG", async ({ request }) => {
    onlyAt("desktop-1440");
    const response = await request.get("/opengraph-image");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });

  test("a page without a card of its own shows the default one, not a listing's", async ({ page, request, baseURL }) => {
    onlyAt("desktop-1440");
    await page.goto("/how-it-works");
    // There is one og:image, in the server's HTML and after hydration alike, and its address is absolute.
    await page.waitForLoadState("networkidle");
    const images = page.locator('meta[property="og:image"]');
    await expect(images).toHaveCount(1);
    const content = (await images.getAttribute("content"))!;
    expect(content).toMatch(/^https?:\/\//);
    const card = new URL(content);
    expect(card.pathname).toBe("/opengraph-image");
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      "content",
      "Vossie, the student marketplace for every Eduvos campus",
    );
    // The address names the site's own origin (NEXT_PUBLIC_SITE_URL, or localhost:3000 when it isn't set), which isn't
    // the test server's port: fetch its path from the test server.
    const response = await request.get(new URL(`${card.pathname}${card.search}`, baseURL).toString());
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });
});

test.describe("security headers (info and system spec 2.9)", () => {
  test("every kind of response carries them, and none sets a Content-Security-Policy yet", async ({ request }) => {
    onlyAt("desktop-1440");
    for (const path of ["/", "/browse", "/listings/l-001", "/how-it-works", "/robots.txt", "/definitely-not-a-page"]) {
      const headers = (await request.get(path)).headers();
      expect(headers["x-content-type-options"], path).toBe("nosniff");
      expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(headers["x-frame-options"], path).toBe("DENY");
      expect(headers["permissions-policy"], path).toBe("camera=(), microphone=(), geolocation=()");
      expect(headers["strict-transport-security"], path).toBe("max-age=31536000");
      expect(headers["content-security-policy"], path).toBeUndefined();
    }
  });

  // /photos/[id] hands out bytes people uploaded, so nosniff matters most there (selling plan amendment 8, item 10).
  // A stored photo can't be fetched here until a form can upload one: Task 16's selling tests check the same two
  // headers on a 200 as well.
  test("the photo route sends nosniff, and keeps nothing of a photo that isn't there", async ({ request }) => {
    onlyAt("desktop-1440");
    for (const id of ["ph-00000000-0000-4000-8000-000000000000", "nope"]) {
      const response = await request.get(`/photos/${id}`);
      expect(response.status(), id).toBe(404);
      expect(response.headers()["x-content-type-options"], id).toBe("nosniff");
      expect(response.headers()["cache-control"], id).toBe("no-store");
    }
  });
});
