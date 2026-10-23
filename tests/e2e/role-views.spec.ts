import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { main, onlyAt, project, signInAsSample } from "./helpers/messaging";
import { expectNoShorterThanSkeleton } from "./helpers/role-views";
import { expectStill, holdFonts, recordShifts } from "./helpers/shifts";

// Role views N1 (plan Task 16): the section bars, the sidebar, the slim footer, axe and motion. Only the checks that
// guard behaviour (Lama, 2026-10-22: no redundant tests).

const phone = () => project().startsWith("phone");
const mainBar = (page: Page) => page.getByRole("navigation", { name: "Main" });
const bar = (page: Page, name: string) => page.getByRole("navigation", { name });

test.describe("section bars (role views spec 4.1)", () => {
  test("the seller's bar replaces the main bar with the slim footer, and CampusCart brings both back", async ({
    page,
  }) => {
    await signInAsSample(page, "Seller, Tech corner", "/sell");
    const selling = bar(page, "Selling");
    await expect(selling).toBeVisible();
    await expect(selling.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    if (phone()) await expect(mainBar(page)).toBeHidden();
    await expect(page.locator(".footer-giants")).toBeHidden();
    await expect(page.locator(".footer-legal")).toBeVisible();

    await selling.getByRole("link", { name: "CampusCart" }).click();
    await expect(page).toHaveURL(/\/$/);
    // The kept /sell page is still in the DOM, hidden (Activity): what matters is that nothing of it shows.
    await expect(bar(page, "Selling")).toBeHidden();
    if (phone()) await expect(mainBar(page)).toBeVisible();
    await expect(page.locator(".footer-giants")).toBeVisible();
  });

  test("a student without a shop keeps the main bar on /sell, with the side panel from the tablet step", async ({
    page,
  }) => {
    await signInAsSample(page, "Student, Midrand", "/sell");
    await expect(main(page).getByRole("heading").first()).toBeVisible();
    await expect(page.locator(".section-bar")).toHaveCount(0);
    if (phone()) await expect(mainBar(page)).toBeVisible();
    await expect(bar(page, "Selling")).toBeVisible({ visible: !phone() });
  });

  test("the waiting seller's bar has no Messages", async ({ page }) => {
    await signInAsSample(page, "Seller waiting for approval", "/sell");
    await expect(bar(page, "Selling")).toBeVisible();
    await expect(bar(page, "Selling").getByRole("link", { name: "Messages" })).toHaveCount(0);
  });

  test("the admin's bar marks Today, and More opens the other tools", async ({ page }) => {
    await signInAsSample(page, "Admin", "/admin");
    const console_ = bar(page, "Hub console");
    await expect(console_.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    await console_.getByRole("link", { name: "More" }).click();
    await expect(page).toHaveURL(/\/admin\/more$/);
    await expect(
      main(page).getByRole("list", { name: "More tools" }).filter({ visible: true }).getByRole("link"),
    ).toHaveCount(7);
  });

  test("a mentor gets the mentoring bar, not the console's", async ({ page }) => {
    await signInAsSample(page, "Mentor", "/mentor");
    await expect(bar(page, "Mentoring")).toBeVisible();
    await page.goto("/admin");
    await expect(bar(page, "Hub console")).toHaveCount(0);
  });

  test("from the tablet step the bar is a sidebar beside the page", async ({ page }) => {
    test.skip(phone(), "Tablet and up");
    await signInAsSample(page, "Admin", "/admin");
    const box = await bar(page, "Hub console").boundingBox();
    const content = await main(page).locator(".section-main").boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(content!.x + 1);
    expect(box!.y).toBeLessThan(content!.y + content!.height);
  });

  test("no serious or critical accessibility issues on the section homes", async ({ page }) => {
    for (const [label, path] of [
      ["Seller, Tech corner", "/sell"],
      ["Admin", "/admin/more"],
      ["Mentor", "/mentor"],
    ] as const) {
      await page.context().clearCookies();
      await signInAsSample(page, label, path);
      expect(await seriousIssues(page), `${label} at ${path}`).toEqual([]);
    }
  });
});

test.describe("motion (role views spec 4.4 and 4.5)", () => {
  // Spec 9: the transition pseudo-elements compute animation-name none, for reduced motion and for data saver.
  // A probe element with the nav-tab class (what a section tab's navigation gives the page) shows which animation a
  // real tab switch would run. The root's own crossfade is always off, so measuring the root would prove nothing.
  async function tabAnimation(page: Page): Promise<string> {
    return page.evaluate(async () => {
      if (!("startViewTransition" in document)) return "unsupported";
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;inset:0 auto auto 0;width:10px;height:10px;";
      probe.style.setProperty("view-transition-name", "vt-probe");
      probe.style.setProperty("view-transition-class", "nav-tab");
      document.body.append(probe);
      const transition = document.startViewTransition(() => {});
      await transition.ready;
      const name = getComputedStyle(document.documentElement, "::view-transition-new(vt-probe)").animationName;
      await transition.finished;
      probe.remove();
      return name;
    });
  }

  test("a tab switch animates when motion is allowed (the control)", async ({ page }) => {
    onlyAt("phone-390");
    await signInAsSample(page, "Admin", "/admin");
    expect(await tabAnimation(page)).toBe("vt-fade");
  });

  test("view transitions and press feedback are off for reduced motion", async ({ page }) => {
    onlyAt("phone-390");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInAsSample(page, "Admin", "/admin");
    expect(await tabAnimation(page)).toBe("none");
    const tab = bar(page, "Hub console").getByRole("link", { name: "Reports" });
    expect(await tab.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  });

  test("view transitions are off with data saver", async ({ page }) => {
    onlyAt("phone-390");
    await signInAsSample(page, "Admin", "/admin");
    await page.evaluate(() => document.documentElement.setAttribute("data-low-data", ""));
    expect(await tabAnimation(page)).toBe("none");
  });
});

// N1's `/sell` main HTML for Tech corner's seller (outerHTML length at 426e8da, measured for the N2 plan's Task 14): the
// home may add at most about 8 KB (spec 9).
const N1_SELL_MAIN_HTML = 5861;

// Role views N2 (plan Task 14): the seller home's read-only checks. Its writes (Needs you's rows, the bar's badge, Mark
// as sold from a thread) are in role-views-writes.spec.ts; axe on the home is above, on Your listings in a11y.spec.ts.
test.describe("the seller home (role views N2, spec 7.1)", () => {
  test("Your listings' four segments stay on one line at 360px, and its targets are 44px or more", async ({ page }) => {
    onlyAt("phone-360");
    await signInAsSample(page, "Seller, Tech corner", "/sell/listings");
    const nav = main(page).getByRole("navigation", { name: "Listings by state" });
    const segments = nav.getByRole("link");
    await expect(segments).toHaveCount(4);
    const tops = await segments.evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
    expect(new Set(tops).size, "one line").toBe(1);
    expect(
      await nav.evaluate(
        (element) =>
          element.scrollWidth <= element.clientWidth &&
          [...element.querySelectorAll("a")].every((link) => link.scrollWidth <= link.clientWidth),
      ),
      "nothing cut off or scrolled",
    ).toBe(true);
    const heights = await main(page)
      .locator(".link-segment, .list-row, .sell-action, .mylist-delete")
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });

  test("the Delete page leads back to Your listings, and the owner's storefront back to the shop", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Seller, Tech corner", "/sell/listings/l-001/delete");
    await expect(main(page).getByRole("link", { name: "Your listings" })).toHaveAttribute("href", "/sell/listings");
    await expect(page).toHaveTitle("Delete your listing · CampusCart");
    await page.goto("/sellers/tech-corner");
    await expect(page.getByRole("link", { name: "Back to your shop" }).filter({ visible: true })).toHaveAttribute(
      "href",
      "/sell",
    );
    await page.goto("/sell/listings");
    await expect(page).toHaveTitle("Your listings · CampusCart");
  });

  test("the skeleton is shorter than the pitch and the waiting page", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    const skeletonAndPage = () =>
      page.evaluate(() => {
        const column = document.querySelector<HTMLElement>("main .sell-page > .sell-column")!;
        const box = document.createElement("div");
        box.className = "sell-column sell-home";
        box.innerHTML = '<span class="skeleton sell-skeleton-head"></span><span class="skeleton sell-skeleton-body"></span>';
        column.parentElement!.append(box);
        const sizes = [box.getBoundingClientRect().height, column.getBoundingClientRect().height];
        box.remove();
        return sizes;
      });
    await page.goto("/sell");
    await expect(page.locator(".sell-page").getByRole("link", { name: "Start selling" })).toBeVisible();
    const [skeleton, pitch] = await skeletonAndPage();
    expect(skeleton).toBeLessThan(pitch);
    await signInAsSample(page, "Seller waiting for approval", "/sell");
    // The waiting page, not its skeleton (which measured 272 against itself before it streamed in, N3 build).
    await expect(main(page).getByRole("heading", { level: 1, name: "The Hub is checking your shop" })).toBeVisible();
    const [again, waiting] = await skeletonAndPage();
    expect(again).toBeLessThan(waiting);
  });

  for (const [name, path] of [
    ["seller home", "/sell"],
    ["Your listings", "/sell/listings"],
  ] as const) {
    test(`the ${name} holds still on a short phone (375x667)`, async ({ page }) => {
      onlyAt("phone-390");
      await page.setViewportSize({ width: 375, height: 667 });
      await signInAsSample(page, "Seller, Tech corner", "/account");
      await holdFonts(page);
      await recordShifts(page);
      await expectStill(page, `${name} at 375x667`, path);
    });
  }

  test("the home adds under about 8 KB of HTML (spec 9)", async ({ page }) => {
    onlyAt("phone-390");
    await signInAsSample(page, "Seller, Tech corner", "/sell");
    await expect(main(page).getByRole("region", { name: "Your listings" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const size = await main(page).evaluate((element) => element.outerHTML.length);
    console.log(`seller home main HTML: ${size} (N1: ${N1_SELL_MAIN_HTML}, +${size - N1_SELL_MAIN_HTML})`);
    expect(size).toBeLessThanOrEqual(N1_SELL_MAIN_HTML + 8 * 1024);
  });
});

// Role views N4 (plan Task 11): the mentor's caseload and a shop's mentor page, read only. Its writes (a new mentor
// told once, a check-in pressed twice) are in role-views-writes.spec.ts; the layout shift rows in cls.spec.ts.
test.describe("the mentor caseload (role views N4, spec 7.3)", () => {
  const shopsCard = (page: Page) => main(page).getByRole("region", { name: "Your shops" });

  test("Needs you and All split the caseload, the counts match the rows, and every row opens its shop", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Mentor", "/mentor?view=all");
    const card = shopsCard(page);
    const segments = card.getByRole("navigation", { name: "Which shops" });
    const rows = card.getByRole("list", { name: "All shops" }).getByRole("link");
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();
    expect(total).toBeGreaterThan(0);
    await expect(segments.getByRole("link", { name: `All (${total})` })).toHaveAttribute("aria-current", "page");
    const summary = (await card.locator(".mentor-summary").textContent()) ?? "";
    const [, need, all] = /^(\d+) of (\d+) need you/.exec(summary) ?? [];
    expect(Number(all)).toBe(total);
    // Every row has a check-in chip.
    await expect(rows.filter({ hasText: /Check-in: (Due|Today|1 day ago|\d+ days ago)/ })).toHaveCount(total);

    const targets = await rows.evaluateAll((links) =>
      links.map((link) => [link.getAttribute("href")!, link.querySelector(".list-row-title")!.textContent!]),
    );
    for (const [href, name] of targets) {
      await page.goto(href);
      await expect(main(page).getByRole("heading", { level: 1, name })).toBeVisible();
    }

    await page.goto("/mentor");
    await expect(segments.getByRole("link", { name: `Needs you (${need})` })).toHaveAttribute("aria-current", "page");
    if (Number(need) === 0) await expect(card.getByText("All clear: no shop needs you today.")).toBeVisible();
    else {
      const needing = card.getByRole("list", { name: "Shops that need you" }).getByRole("link");
      await expect(needing).toHaveCount(Number(need));
      // A shop needs you for a flag, explained in words, or a check-in that's due.
      for (const text of await needing.allTextContents()) {
        expect(text.includes("Check-in: Due") || !text.includes("No flags."), text).toBe(true);
      }
    }
  });

  test("one small chart per shop in the view, on one scale, each with its takeaway or its numbers in words", async ({
    page,
  }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Mentor", "/mentor?view=all");
    const links = shopsCard(page).getByRole("list", { name: "All shops" }).getByRole("link");
    await expect(links.first()).toBeVisible();
    const rows = await links.count();
    const items = main(page).getByRole("region", { name: "Enquiries, 14 days" }).locator(".mentor-sparks > li");
    await expect(items).toHaveCount(rows);
    // A chart (a figure named by its takeaway) or, when too small to chart, the takeaway and the values in words.
    await expect(items.filter({ has: page.locator("figure.sparkline, p.chart-summary") })).toHaveCount(rows);
    await expect(items.filter({ hasText: /^Tech corner/ }).locator(".chart-summary")).toHaveText(
      /^Tech corner: (\d+ enquir(y|ies) in \d+ days?|no days to show yet)/,
    );
  });

  test("a shop's page puts both forms before the history, with the last 14 days against the 14 before", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Mentor", "/mentor/tech-corner");
    const facts = main(page).getByRole("region", { name: "This shop" });
    await expect(facts.getByRole("list", { name: "Last 14 days" }).getByRole("listitem")).toHaveCount(3);
    const top = async (name: string) => (await main(page).getByRole("region", { name }).boundingBox())!.y;
    const history = await top("Notes and check-ins");
    expect(await top("Add a note")).toBeLessThan(history);
    expect(await top("Add a check-in")).toBeLessThan(history);
  });

  test("no serious or critical accessibility issues on the caseload and a shop's page", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    for (const [label, path] of [
      ["Mentor", "/mentor?view=all"],
      ["Mentor", "/mentor/tech-corner"],
      ["Admin", "/mentor?view=all"],
    ] as const) {
      await page.context().clearCookies();
      await signInAsSample(page, label, path);
      expect(await seriousIssues(page), `${label} at ${path}`).toEqual([]);
    }
  });

  test("the caseload is never shorter than its skeleton, and its HTML stays small", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Mentor", "/mentor");
    await expectNoShorterThanSkeleton(page);
    await page.goto("/mentor?view=all");
    await expectNoShorterThanSkeleton(page);
    // Spec 9: the caseload adds under about 8 KB. Its body replaced the old table, so the whole body is held to that.
    const body = await main(page)
      .locator(".mentor-home")
      .filter({ visible: true })
      .evaluate((element) => new TextEncoder().encode(element.outerHTML).length);
    const whole = Buffer.byteLength(await (await page.request.get("/mentor?view=all")).text());
    console.log(`/mentor?view=all (${test.info().project.name}): caseload ${body} B, page HTML ${whole} B`);
    expect(body, "the caseload's HTML").toBeLessThanOrEqual(8 * 1024);
  });

  test("the caseload holds still on a short phone (375x667)", async ({ page }) => {
    onlyAt("phone-390");
    await page.setViewportSize({ width: 375, height: 667 });
    await signInAsSample(page, "Mentor", "/account");
    await holdFonts(page);
    await recordShifts(page);
    await expectStill(page, "mentor caseload at 375x667", "/mentor");
  });
});
