import { expect, test, type Page } from "@playwright/test";
import { YOU_SKELETON_BLOCKS } from "../../components/account/you-skeleton";
import { seriousIssues } from "./helpers/axe";
import { main, newBuyer, onlyAt, settled, signInAsSample, signUp } from "./helpers/messaging";
import { expectStill, holdFonts, recordShifts } from "./helpers/shifts";

// You (role views N5, spec 7.4 and 9). Reads only, in the device projects: the tests that need an empty You sign up an
// account of their own, and the sample accounts are only read. The reply that lights the badge is a write, in
// role-views-writes.spec.ts; the new offer counted once is in community-writes.spec.ts.

const card = (page: Page, name: string) => main(page).getByRole("region", { name });
const greeting = (page: Page) => main(page).getByRole("heading", { level: 1, name: /^Hi, / });

test.describe("You (role views spec 7.4)", () => {
  test("a new account: the greeting, All clear, Your stuff and Settings, with no serious axe issues", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    const buyer = newBuyer();
    await signUp(page, buyer);
    await expect(main(page).getByRole("heading", { level: 1, name: `Hi, ${buyer.firstName}` })).toBeVisible();
    await expect(main(page).locator(".you-campus")).toHaveText("Midrand");
    await expect(card(page, "For you").getByText("All clear. Nothing needs you right now.")).toBeVisible();
    const rows = await card(page, "Your stuff")
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => [link.querySelector(".list-row-title")?.textContent, link.getAttribute("href")]));
    expect(rows).toEqual([
      ["Messages", "/messages"],
      ["Notifications", "/notifications"],
      ["Saved", "/saved"],
      ["Your requests", "/account/requests"],
      ["Saved searches", "/saved?tab=searches"],
      ["Hub bookings", "/hub"],
    ]);
    await expect(card(page, "Settings").getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(await seriousIssues(page)).toEqual([]);
  });

  test("Saved counts the listings saved on this device, from its cookie", async ({ page, context, baseURL }) => {
    onlyAt("phone-390");
    await signUp(page, newBuyer());
    await context.addCookies([{ name: "vossie_saved", value: "l-001.l-026", url: baseURL! }]);
    await page.goto("/account");
    await expect(card(page, "Your stuff").getByRole("link", { name: /^Saved 2 listings on this device/ })).toBeVisible();
  });

  test("a seller sees Your shop, and staff their tools; the admin's You adds under 8 KB of HTML", async ({
    page,
    context,
  }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Seller, Tech corner");
    await expect(card(page, "Your stuff").getByRole("link", { name: /^Your shop/ })).toHaveAttribute("href", "/sell");
    await expect(card(page, "Your stuff").getByRole("link", { name: "Hub console" })).toHaveCount(0);
    await context.clearCookies();
    await signInAsSample(page, "Admin");
    await expect(greeting(page)).toBeVisible();
    const stuff = card(page, "Your stuff");
    await expect(stuff.getByRole("link", { name: "Hub console" })).toHaveAttribute("href", "/admin");
    await expect(stuff.getByRole("link", { name: "Mentor dashboard" })).toHaveAttribute("href", "/mentor");
    expect(await seriousIssues(page)).toEqual([]);
    // Plan decision 17 (spec 9: a home's added HTML under about 8 KB): You, with every row an admin has, against the old
    // account page it replaced. That page held Your details' card and form too, so You less those is what was added.
    const htmlOf = (selector: string) =>
      main(page)
        .locator(selector)
        .filter({ visible: true })
        .evaluate((element) => new TextEncoder().encode(element.outerHTML).length);
    const you = await htmlOf(".you-body");
    await page.goto("/account/details");
    await expect(page.getByLabel("Your first name", { exact: true })).toBeVisible();
    const details = await htmlOf(".account-body");
    console.log(`You (Admin) [${test.info().project.name}]: ${you} B of HTML; Your details' card and form ${details} B`);
    expect(you - details, "the HTML You added").toBeLessThan(8 * 1024);
  });

  test("Your details opens the form, one level deeper, with no serious axe issues, and comes back", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Student, Midrand");
    await card(page, "Settings").getByRole("link", { name: /^Your details/ }).click();
    await expect(page).toHaveURL(/\/account\/details$/);
    await expect(main(page).getByRole("heading", { level: 1, name: "Your details" })).toBeVisible();
    await expect(page.getByLabel("Your first name", { exact: true })).toHaveValue("Thandi");
    expect(await seriousIssues(page)).toEqual([]);
    await main(page).getByRole("link", { name: "Back to You" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(main(page).getByRole("heading", { level: 1, name: "Hi, Thandi" })).toBeVisible();
  });

  test("Looking For is in the menu, signed in or out (plan decision 11)", async ({ page }) => {
    onlyAt("phone-390");
    await page.goto("/");
    await settled(page);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await menu.getByRole("link", { name: "Looking For" }).click();
    await expect(page).toHaveURL(/\/looking-for$/);
    await expect(menu).toBeHidden();
  });

  test("Looking For is in the header's quick links, which stay on one line inside the header (plan decision 10)", async ({
    page,
  }) => {
    onlyAt("laptop-1024", "desktop-1440");
    await page.goto("/");
    await settled(page);
    const quick = page.locator(".site-header").getByRole("link", { name: "Looking For", exact: true });
    await expect(quick).toBeVisible();
    await expect(quick).toHaveAttribute("href", "/looking-for");
    // The quick links' list: one row (every link on the same top), nothing wider than the header or the page.
    const fit = await quick.evaluate((link) => {
      const list = link.closest("ul")!;
      const header = link.closest(".site-header")!;
      const items = [...list.querySelectorAll("a, button")];
      const tops = new Set(items.map((item) => Math.round(item.getBoundingClientRect().top)));
      const box = list.getBoundingClientRect();
      return {
        rows: tops.size,
        listInside: box.right <= header.getBoundingClientRect().right + 0.5 && list.scrollWidth <= list.clientWidth + 0.5,
        pageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        linkWraps: link.getClientRects().length > 1 || link.getBoundingClientRect().height > 48,
      };
    });
    console.log(`header quick links [${test.info().project.name}]: ${JSON.stringify(fit)}`);
    expect(fit).toEqual({ rows: 1, listInside: true, pageScroll: false, linkWraps: false });
    await quick.click();
    await expect(page).toHaveURL(/\/looking-for$/);
  });
});

test.describe("You's gates (role views spec 9)", () => {
  test("the skeletons are no taller than the shortest states: a new account's You, and Your details", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signUp(page, newBuyer());
    // The content, not the skeleton: wait for the greeting before measuring.
    await expect(greeting(page)).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const you = await page.evaluate((blocks) => {
      const shown = [...document.querySelectorAll<HTMLElement>("main .you-page")].find(
        (element) => element.getClientRects().length > 0,
      )!;
      const shell = document.createElement("div");
      shell.className = "you-skeleton-body";
      shell.setAttribute("aria-hidden", "true");
      for (const block of blocks) {
        const span = document.createElement("span");
        span.className = `skeleton ${block}`;
        shell.append(span);
      }
      shown.append(shell);
      const skeleton = shell.getBoundingClientRect().height;
      shell.remove();
      return { skeleton, content: shown.querySelector(".you-body")!.getBoundingClientRect().height };
    }, [...YOU_SKELETON_BLOCKS]);
    console.log(`You [${test.info().project.name}]: skeleton ${you.skeleton}px, shortest content ${you.content}px`);
    expect(you.skeleton).toBeLessThanOrEqual(you.content);

    await page.goto("/account/details");
    await expect(page.getByLabel("Your first name", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const details = await page.evaluate(() => {
      const body = [...document.querySelectorAll<HTMLElement>("main .account-body")].find(
        (element) => element.getClientRects().length > 0,
      )!;
      const shell = document.createElement("div");
      shell.className = "account-body";
      shell.innerHTML = '<span class="skeleton account-skeleton-card"></span><span class="skeleton account-skeleton-form"></span>';
      body.after(shell);
      const skeleton = shell.getBoundingClientRect().height;
      shell.remove();
      return { skeleton, content: body.getBoundingClientRect().height };
    });
    console.log(`Your details [${test.info().project.name}]: skeleton ${details.skeleton}px, content ${details.content}px`);
    expect(details.skeleton).toBeLessThanOrEqual(details.content);
  });

  test("You holds still at 360 and 768 (CLS 0.05 or less; cls.spec.ts measures 390 and 1440)", async ({ page }) => {
    onlyAt("phone-360", "tablet-768");
    await signInAsSample(page, "Student, Midrand");
    await holdFonts(page);
    await recordShifts(page);
    await expectStill(page, `You [${test.info().project.name}]`, "/account");
  });

  test("a new account's You holds still on a short phone, 375 by 667 (CLS 0.05 or less)", async ({ page }) => {
    onlyAt("phone-390");
    await page.setViewportSize({ width: 375, height: 667 });
    await signUp(page, newBuyer());
    await holdFonts(page);
    await recordShifts(page);
    await expectStill(page, "You, a new account (375x667)", "/account");
  });
});
