import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { main, onlyAt, signInAsSample } from "./helpers/messaging";
import { expectStill, holdFonts, recordShifts } from "./helpers/shifts";
import { copySession, DESKTOP, PHONE } from "./helpers/staff-accounts";
import { STAFF_SKELETON_HTML } from "./helpers/staff-skeleton";

// Role views N3: the admin's Today and the console's fixes (spec 7.2, 8 and 9). Reads only, in the device projects
// (plan decision 12): the seed has Crochet corner waiting since 10 October and Thandi's slot request since 13 October,
// both over 2 days old whatever day this runs, and other tests' writes only ever add newer items. Only behaviour is
// checked here (Lama, 2026-10-22: no redundant tests); the Next open report needs reports, so it's in staff-writes.
// Today's own layout shift is in staff-checks.spec.ts (fast) and cls.spec.ts (slow network and the sidebar).

test.use({ reducedMotion: "reduce" });

const BOTH = ["phone-390", "desktop-1440"];
const waitingList = (page: Page) => main(page).getByRole("list", { name: "Waiting" });
const consoleBar = (page: Page) => page.getByRole("navigation", { name: "Hub console" });
const MASKED = ["Hidden", "Under 5"];

test.describe("Today (role views spec 7.2)", () => {
  test("says what's waiting, and each row opens its oldest item", async ({ page }) => {
    await signInAsSample(page, "Admin", "/admin");
    await expect(main(page).getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expect(page).toHaveTitle("Today · CampusCart");
    await expect(main(page).locator(".staff-lede")).toHaveText(/^\d+ waiting · oldest \d+ days?$/);
    const shops = waitingList(page).getByRole("link", { name: /Shops? to approve/ });
    await expect(shops).toHaveAttribute("href", "/admin/sellers/crochet-corner");
    await expect(shops).toContainText("Oldest: Crochet corner");
    await expect(shops.locator(".needs-age")).toHaveAttribute("data-tone", "warning");
    await expect(waitingList(page).getByRole("link", { name: /Slot requests?/ })).toHaveAttribute(
      "href",
      "/hub/manage#hub-queue",
    );
    // Other tests may have made reports or hidden something by now; when they have, the rows open the right place
    // (staff-writes checks the Reports row against the list, staff-accounts-writes follows the Hidden row).
    const reports = waitingList(page).getByRole("link", { name: /Open reports?/ });
    if ((await reports.count()) > 0) await expect(reports).toHaveAttribute("href", /^\/admin\/reports\/[^/]+$/);
    const hidden = waitingList(page).getByRole("link", { name: /Hidden by the Hub/ });
    if ((await hidden.count()) > 0) await expect(hidden).toHaveAttribute("href", "/admin/hidden");
    await shops.click();
    await expect(page).toHaveURL(/\/admin\/sellers\/crochet-corner$/);
    await expect(main(page).getByRole("heading", { level: 1, name: "Crochet corner" })).toBeVisible();
  });

  test("adds under 8 KB of HTML, and its skeleton is no taller than All clear (spec 9)", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin");
    const body = main(page).locator(".today");
    await expect(body).toBeVisible();
    const bytes = await body.evaluate((element) => new TextEncoder().encode(element.outerHTML).length);
    console.log(`Today's body (${test.info().project.name}): ${bytes} B`);
    expect(bytes, "Today's HTML").toBeLessThanOrEqual(8 * 1024);

    const heights = await page.evaluate((skeletonHtml) => {
      const today = document.querySelector<HTMLElement>("main .staff-page:has(.today)")!;
      // Today's shortest state (plan decision 12): nothing waiting, nothing listed last week, no notice.
      const list = today.querySelector(".needs-list");
      if (list) {
        const clear = document.createElement("p");
        clear.className = "needs-clear";
        clear.textContent = "All clear: nothing is waiting for the Hub.";
        list.replaceWith(clear);
      }
      const chart = today.querySelector(".today .chart");
      if (chart) {
        const line = document.createElement("p");
        line.className = "chart-summary";
        line.textContent = "None at any campus last week.";
        chart.replaceWith(line);
      }
      const lede = today.querySelector(".staff-lede");
      if (lede) lede.textContent = "Nothing waiting";
      today.querySelector(".staff-notice")?.remove();
      const shortest = today.getBoundingClientRect().height;
      const holder = document.createElement("div");
      holder.innerHTML = skeletonHtml;
      // Today renders <StaffSkeleton trail={false} />: it has no breadcrumb trail.
      holder.querySelector(".staff-skeleton-trail")?.remove();
      today.after(holder);
      const skeleton = (holder.firstElementChild as HTMLElement).getBoundingClientRect().height;
      holder.remove();
      return { shortest, skeleton };
    }, STAFF_SKELETON_HTML);
    console.log(`Today (${test.info().project.name}): skeleton ${heights.skeleton}px, All clear ${heights.shortest}px`);
    expect(heights.skeleton, "the skeleton against All clear").toBeLessThanOrEqual(heights.shortest);
  });

  test("a masked number reads Hidden or Under 5, never 0, on Today and the numbers page (CLAUDE.md)", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin");
    const week = main(page).getByRole("region", { name: "Last week" });
    await expect(week.getByRole("list", { name: "Last week's numbers" }).getByRole("listitem")).toHaveCount(3);
    await expect(week.getByRole("link", { name: "All numbers" })).toHaveAttribute("href", "/admin/numbers");
    const reportsMade = (await week.getByRole("listitem").filter({ hasText: "Reports made" }).locator(".stat-tile-value").textContent())!;
    for (const value of await main(page).locator("[data-masked]").allTextContents()) expect(MASKED).toContain(value.trim());

    await page.goto("/admin/numbers");
    await expect(main(page).getByRole("heading", { level: 1, name: "Last week" })).toBeVisible();
    await expect(page).toHaveTitle("Last week · CampusCart");
    // Today's tile says what the numbers page's table says: the same protectCounts words.
    const all = main(page).getByRole("table", { name: "All campuses, by week" });
    const row = all.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Reports made", exact: true }) });
    // A phone's stacked table puts the column's name before the figure, so match the end.
    await expect(row.getByRole("cell").first()).toHaveText(new RegExp(`(^|\\))${reportsMade.trim()}$`));
    const bars = main(page).getByRole("region", { name: "Each measure by campus" });
    await expect(bars.getByRole("heading", { level: 3 })).toHaveCount(7);
    for (const value of await bars.locator(".bar-masked + .bar-value").allTextContents()) {
      expect(MASKED, "a masked bar").toContain(value.trim());
    }
  });
});

// Reports and Hidden filtered to Eduvos Online are those pages' shortest states (plan decision 15). Each page's
// skeleton is no taller (spec 9). SKELETONS says which skeleton each page renders.
const SKELETONS: Readonly<Record<string, "full" | "short">> = {
  // The full skeleton was 634px against 507px at 390 (N3 build), so both pages render the short one.
  "/admin/reports?campus=online": "short",
  "/admin/hidden?campus=online": "short",
  // Shops at a campus with no shops is the same shape (N3 review).
  "/admin/sellers?campus=online": "short",
};

test.describe("short pages' skeletons (spec 9)", () => {
  for (const [path, kind] of Object.entries(SKELETONS)) {
    test(`${path}'s ${kind} skeleton is no taller than the page`, async ({ page }) => {
      onlyAt(...BOTH);
      await signInAsSample(page, "Admin", path);
      await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
      const heights = await page.evaluate(
        ([skeletonHtml, short]) => {
          const shown = [...document.querySelectorAll<HTMLElement>("main .staff-page")].find(
            (element) => element.getClientRects().length > 0 && !element.closest("[hidden]"),
          )!;
          shown.querySelector(".staff-notice")?.remove();
          const holder = document.createElement("div");
          holder.innerHTML = skeletonHtml;
          if (short) holder.querySelector(".staff-skeleton-body")?.remove();
          shown.after(holder);
          const skeleton = (holder.firstElementChild as HTMLElement).getBoundingClientRect().height;
          holder.remove();
          return { page: shown.getBoundingClientRect().height, skeleton };
        },
        [STAFF_SKELETON_HTML, kind === "short"] as const,
      );
      console.log(`${path} (${test.info().project.name}): ${kind} skeleton ${heights.skeleton}px, page ${heights.page}px`);
      expect(heights.skeleton, "the skeleton against the shortest state").toBeLessThanOrEqual(heights.page);
    });
  }
});

test.describe("the console's fixes (spec 7.2)", () => {
  test("a shop's page leads on to the oldest waiting shop that isn't it", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin/sellers/tech-corner");
    const next = main(page).getByRole("link", { name: "Next waiting shop: Crochet corner" });
    await expect(next).toHaveAttribute("href", "/admin/sellers/crochet-corner");
    await next.click();
    await expect(main(page).getByRole("heading", { level: 1, name: "Crochet corner" })).toBeVisible();
    // On the oldest shop itself, Next skips it.
    await expect(main(page).getByRole("link", { name: "Next waiting shop: Crochet corner" })).toHaveCount(0);
  });

  test("the campus filter shows one campus, and every campus for one that doesn't exist (wayfinding spec 3.4)", async ({
    page,
  }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin/sellers");
    const filter = main(page).getByRole("form", { name: "Filter by campus" });
    await filter.getByRole("combobox", { name: "Campus" }).selectOption("pretoria");
    await filter.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/\/admin\/sellers\?campus=pretoria$/);
    await expect(filter.getByRole("combobox", { name: "Campus" })).toHaveValue("pretoria");
    await expect(main(page).getByRole("table", { name: "Shops waiting for approval, oldest first · Pretoria" })).toContainText(
      "Crochet corner",
    );
    await expect(main(page).getByRole("link", { name: "Review Tech corner" })).toHaveCount(0);
    await main(page).getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/admin\/sellers$/);
    await page.goto("/admin/sellers?campus=nowhere");
    await expect(filter.getByRole("combobox", { name: "Campus" })).toHaveValue("");
    await expect(main(page).getByRole("link", { name: "Review Tech corner" })).toBeVisible();
    for (const path of ["/admin/reports", "/admin/hidden"]) {
      await page.goto(`${path}?campus=midrand`);
      await expect(filter.getByRole("combobox", { name: "Campus" }), path).toHaveValue("midrand");
      await expect(main(page).getByRole("link", { name: "Clear filters" }), path).toHaveAttribute("href", path);
      // The page itself never gets wider than the screen.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
    }
  });

  test("More is the current tab on the pages it holds, Hidden's included, and not after leaving (plan decision 8)", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin");
    // More is the phone's tab; from the tablet step the sidebar names every section, and the section's own link is
    // current (wayfinding spec 3.3).
    const wide = test.info().project.name !== "phone-390";
    const more = consoleBar(page).getByRole("link", { name: "More" });
    const reports = consoleBar(page).getByRole("link", { name: "Reports" });
    for (const [path, own] of [
      ["/admin/hidden", "Hidden"],
      ["/admin/numbers", "Last week"],
      ["/admin/staff", "Staff"],
    ] as const) {
      await page.goto(path);
      await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
      if (wide) await expect(consoleBar(page).getByRole("link", { name: own, exact: true }), path).toHaveAttribute("aria-current", "page");
      else await expect(more, path).toHaveAttribute("aria-current", "true");
      await expect(reports, path).not.toHaveAttribute("aria-current");
    }
    // Leaving Hidden through the bar: Next keeps the Hidden page, hidden, and NavLink reads the new path.
    await page.goto("/admin/hidden");
    await expect(main(page).getByRole("heading", { level: 1, name: "Hidden listings and requests" })).toBeVisible();
    await reports.click();
    await expect(main(page).getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await expect(reports).toHaveAttribute("aria-current", "page");
    if (!wide) await expect(more, "after leaving Hidden").not.toHaveAttribute("aria-current");
  });

  test("no serious or critical accessibility issues on Today, Reports by campus and Last week", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin");
    for (const path of ["/admin", "/admin/reports?campus=midrand", "/admin/numbers"]) {
      await page.goto(path);
      await expect(main(page).getByRole("heading", { level: 1 }), path).toBeVisible();
      // The title streams in with the page's request-time parts; axe's title rule needs it.
      await expect(page, path).toHaveTitle(/· CampusCart$/);
      expect(await seriousIssues(page), path).toEqual([]);
    }
  });
});

const SHORT_PHONE = { ...PHONE, viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 } };

test.describe("layout shift (spec 9: under 0.05)", () => {
  for (const [name, path] of [
    ["Reports", "/admin/reports"],
    ["Hidden", "/admin/hidden"],
  ] as const) {
    for (const [size, device] of [
      ["390", PHONE],
      ["1440", DESKTOP],
    ] as const) {
      test(`${name} holds still at ${size}px`, async ({ browser, baseURL }) => {
        onlyAt("phone-390");
        const context = await browser.newContext({ ...device, baseURL, serviceWorkers: "block" });
        await copySession(browser, context, baseURL!, "Admin");
        const page = await context.newPage();
        await holdFonts(page);
        await recordShifts(page);
        await expectStill(page, `${name} (${size})`, path);
        await context.close();
      });
    }
  }

  // Short pages on a short phone (plan decision 15): Eduvos Online has no reports and nothing hidden.
  for (const [name, path] of [
    ["Reports, one campus", "/admin/reports?campus=online"],
    ["Hidden, one campus", "/admin/hidden?campus=online"],
  ] as const) {
    test(`${name} holds still on a short phone, 375 by 667`, async ({ browser, baseURL }) => {
      onlyAt("phone-390");
      const context = await browser.newContext({ ...SHORT_PHONE, baseURL, serviceWorkers: "block" });
      await copySession(browser, context, baseURL!, "Admin");
      const page = await context.newPage();
      await holdFonts(page);
      await recordShifts(page);
      await expectStill(page, `${name} (375x667)`, path);
      await context.close();
    });
  }
});
