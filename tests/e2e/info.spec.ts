import { expect, test, type Page } from "@playwright/test";

const project = () => test.info().project.name;

function onlyAt(...projects: string[]) {
  test.skip(!projects.includes(project()), `Checked at ${projects.join(" and ")}`);
}

const width = (page: Page) => page.viewportSize()?.width ?? 0;

type InfoCase = { path: string; title: string; draft: boolean; sections: string[] };

const PAGES: readonly InfoCase[] = [
  {
    path: "/how-it-works",
    title: "How Vossie works",
    draft: false,
    sections: ["Buying", "Selling", "Trust, in one paragraph", "Questions and answers"],
  },
  {
    path: "/safety",
    title: "Safety",
    draft: false,
    sections: ["Meeting safely", "Checking before you pay", "Paying safely", "Signs of a scam", "Reporting a problem"],
  },
  {
    path: "/trust",
    title: "How trust works",
    draft: false,
    sections: ["Verified by the Hub", "The three badges", "What counts", "When something is reported", "How Featured today is picked"],
  },
  {
    path: "/privacy",
    title: "Privacy policy",
    draft: true,
    sections: [
      "Who is responsible",
      "What this site stores today",
      "Your account",
      "How long we keep it",
      "Who it is shared with",
      "Where it is hosted",
      "Your rights",
      "Contact the Hub",
      "Changes to this policy",
    ],
  },
  {
    path: "/terms",
    title: "Terms of use",
    draft: true,
    sections: [
      "Who can use Vossie",
      "Vossie is not part of your deal",
      "What you can't do",
      "What you post",
      "Moderation and suspension",
      "Our responsibility",
      "Changes and the law",
    ],
  },
  {
    path: "/seller-guidelines",
    title: "Seller guidelines",
    draft: true,
    sections: [
      "Who can sell",
      "What can't be sold",
      "Honest listings and photos",
      "Prices and swaps",
      "Replying within 48 hours",
      "Meeting buyers",
      "After a report",
    ],
  },
];

test.describe("the info and legal pages (spec 3)", () => {
  for (const { path, title, draft, sections } of PAGES) {
    test(`${path} has its heading, tab title and sections, and ${draft ? "a draft banner" : "no banner"}`, async ({ page }) => {
      onlyAt("phone-390", "desktop-1440");
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page).toHaveTitle(`${title} · Vossie`);
      await expect(page.locator("main .info-body h2")).toHaveText(sections);
      await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link")).toHaveText(sections);
      await expect(page.getByText("Coming in the next stage")).toHaveCount(0);
      if (draft) {
        await expect(page.getByRole("note")).toHaveText("Draft for Eduvos to review. Not yet in force.");
      } else {
        await expect(page.getByRole("note")).toHaveCount(0);
      }
    });
  }

  test("the contents list sits under the lede on phones and tablets, and beside the text on desktop (spec 2.5)", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const toc = (await page.locator(".info-toc").boundingBox())!;
    const body = (await page.locator(".info-body").boundingBox())!;
    if (width(page) >= 1024) {
      expect(toc.x + toc.width).toBeLessThanOrEqual(body.x);
      expect(Math.abs(toc.y - body.y)).toBeLessThan(40);
    } else {
      expect(toc.y + toc.height).toBeLessThanOrEqual(body.y);
      // The row of pills scrolls inside itself.
      const row = await page.locator(".info-toc ol").evaluate((list) => list.scrollWidth - list.clientWidth);
      expect(row).toBeGreaterThan(0);
    }
    // About 65 characters a line, whatever the screen.
    expect(body.width).toBeLessThanOrEqual(700);
    // The page itself never scrolls sideways.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("a contents link jumps to its section", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/safety");
    await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Signs of a scam" }).click();
    await expect(page).toHaveURL(/\/safety#safety-scams$/);
    await expect(page.getByRole("heading", { level: 2, name: "Signs of a scam" })).toBeInViewport();
  });

  test("the pages link to each other", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/safety");
    await page.locator("main").getByRole("link", { name: "how trust works", exact: true }).click();
    await expect(page).toHaveURL(/\/trust$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How trust works");

    await page.goto("/how-it-works");
    await page.locator("main").getByRole("link", { name: "seller guidelines", exact: true }).click();
    await expect(page).toHaveURL(/\/seller-guidelines$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Seller guidelines");

    await page.goto("/terms");
    await page.locator("main").getByRole("link", { name: "safety guide", exact: true }).click();
    await expect(page).toHaveURL(/\/safety$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Safety");
  });
});

test.describe("the footer reaches the info and legal pages (spec 2.11)", () => {
  const LINKS: ReadonlyArray<[name: string, href: string, group: "Sell" | "Help"]> = [
    ["Seller guidelines", "/seller-guidelines", "Sell"],
    ["How trust works", "/trust", "Help"],
    ["Terms of use", "/terms", "Help"],
    ["Privacy (POPIA)", "/privacy", "Help"],
  ];

  for (const [name, href, group] of LINKS) {
    test(`${name} opens ${href}`, async ({ page }) => {
      onlyAt("phone-390", "desktop-1440");
      await page.goto("/");
      const footer = page.getByRole("contentinfo");
      // On phones the link groups are folded.
      if (width(page) < 768) {
        await footer.locator("summary.footer-summary", { hasText: new RegExp(`^${group}$`) }).click();
      }
      await footer.getByRole("link", { name, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
    });
  }

  test("no footer link wraps onto a second line at 1280 or 1440 (decision 32)", async ({ page }) => {
    onlyAt("desktop-1440");
    for (const wide of [1280, 1440]) {
      await page.setViewportSize({ width: wide, height: 900 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const heights = await page
        .locator(".footer-links:not(.footer-links-columns) a:visible")
        .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().height)));
      expect(heights.length).toBeGreaterThan(10);
      expect(Math.max(...heights), `tallest footer link at ${wide}px`).toBeLessThanOrEqual(46);
    }
  });
});

test.describe("the homepage's trust links (spec 2.3)", () => {
  test("How trust works, under the hero, opens the trust page", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    await page
      .getByRole("region", { name: "Why you can trust Vossie" })
      .getByRole("link", { name: "How trust works" })
      .click();
    await expect(page).toHaveURL(/\/trust$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How trust works");
  });

  test("How we pick, on Featured today, opens that part of the trust page", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await page.goto("/");
    const link = page.locator("#featured").getByRole("link", { name: "How we pick featured sellers" });
    await expect(link).toHaveAttribute("href", "/trust#trust-featured");
    await link.click();
    await expect(page).toHaveURL(/\/trust#trust-featured$/);
    await expect(page.getByRole("heading", { level: 2, name: "How Featured today is picked" })).toBeInViewport();
  });
});
