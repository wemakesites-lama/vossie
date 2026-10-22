import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { main, onlyAt, project, signInAsSample } from "./helpers/messaging";

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

  test("a student without a shop keeps the main bar on /sell", async ({ page }) => {
    await signInAsSample(page, "Student, Midrand", "/sell");
    await expect(main(page).getByRole("heading").first()).toBeVisible();
    await expect(bar(page, "Selling")).toHaveCount(0);
    if (phone()) await expect(mainBar(page)).toBeVisible();
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
