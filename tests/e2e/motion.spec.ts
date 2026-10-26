import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";

// Calm navigation (spec docs/superpowers/specs/2026-10-26-calm-navigation-design.md): every page moves the same way,
// a tapped link that waits brings the header back with its crest breathing, outlines fade into content, and the crest
// loader waits a second before it shows. Checked at 390 and 1440.
test.beforeEach(() => {
  test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Checked at 390 and 1440");
});

/** Holds a listing page's RSC response for `ms`, so a tapped card waits for the server. */
async function slowListings(page: Page, ms: number) {
  await page.route(/\/listings\/[^/?]+(\?.*)?$/, async (route) => {
    if (route.request().headers()["rsc"]) await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

/** Starts recording the view-transition keyframes that run, read back with `recorded`. */
async function recordTransitions(page: Page) {
  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as unknown as { __vt: Set<string> }).__vt = seen;
    const tick = () => {
      for (const animation of document.getAnimations()) {
        const pseudo = (animation.effect as KeyframeEffect | null)?.pseudoElement ?? "";
        if (pseudo.startsWith("::view-transition") && animation instanceof CSSAnimation) seen.add(animation.animationName);
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}
const recorded = (page: Page) => page.evaluate(() => [...(window as unknown as { __vt: Set<string> }).__vt].sort());

/** The header crest's animation and opacity right now. */
const headerCrest = (page: Page) =>
  page.locator(".hdr-pennant-slot .pennant-crest").evaluate((crest) => {
    const style = getComputedStyle(crest);
    return { name: style.animationName, opacity: Number(style.opacity) };
  });

test.describe("the header crest while a tap waits (layer 4)", () => {
  for (const reduced of [false, true]) {
    test(`comes back and ${reduced ? "dims, still, under reduced motion" : "breathes"}, then stops on arrival`, async ({ page }) => {
      if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/browse", { waitUntil: "networkidle" });
      await page.mouse.wheel(0, 900);
      await expect(page.locator(".site-header")).toHaveAttribute("data-mode", "hidden");
      await slowListings(page, 2500);
      const card = page.locator("a.listing-link").nth(4);
      await card.scrollIntoViewIfNeeded();
      // The crest's opacity at the moment <html> is marked, read in the page: the 150 ms delay hasn't passed.
      await page.evaluate(() => {
        new MutationObserver((_, observer) => {
          if (!document.documentElement.hasAttribute("data-nav-pending")) return;
          const crest = document.querySelector(".hdr-pennant-slot .pennant-crest")!;
          (window as unknown as { __atMark: number }).__atMark = Number(getComputedStyle(crest).opacity);
          observer.disconnect();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-nav-pending"] });
      });
      await card.click();

      await expect(page.locator("html")).toHaveAttribute("data-nav-pending", "");
      expect(await page.evaluate(() => (window as unknown as { __atMark: number }).__atMark)).toBe(1);
      await page.waitForTimeout(600);
      await expect(page.locator(".site-header")).not.toHaveAttribute("data-mode", "hidden");
      const waiting = await headerCrest(page);
      if (reduced) expect(waiting).toEqual({ name: "crest-wait-dim", opacity: 0.65 });
      else expect(waiting.name).toBe("crest-breathe");

      await page.waitForURL(/\/listings\//);
      await expect(page.locator("html")).not.toHaveAttribute("data-nav-pending");
      expect((await headerCrest(page)).name).toBe("none");
    });
  }

  test("a fast tap never changes the crest", async ({ page }) => {
    await page.goto("/browse", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      const crest = document.querySelector(".hdr-pennant-slot .pennant-crest")!;
      (window as unknown as { __dimmed: boolean }).__dimmed = false;
      const tick = () => {
        if (Number(getComputedStyle(crest).opacity) < 0.99) (window as unknown as { __dimmed: boolean }).__dimmed = true;
        requestAnimationFrame(tick);
      };
      tick();
    });
    await page.locator("a.listing-link").first().click();
    await page.waitForURL(/\/listings\//);
    expect(await page.evaluate(() => (window as unknown as { __dimmed: boolean }).__dimmed)).toBe(false);
  });
});

test.describe("every page moves the same way (layer 3)", () => {
  // Next 16.4 sometimes commits a link's navigation without its transition types (Task 6 found it intermittent on listing
  // cards and request rows), and then the page crossfades instead of sliding. So these check that every page change
  // animates; which animation each type gets is checked through the probe below.
  for (const [name, from, link, to] of [
    ["a card", "/browse", "a.listing-link", /\/listings\//],
    ["a Launchpad post row", "/hub", "a.hub-row-link", /\/hub\/h-/],
    ["a tab", "/browse", ".tabbar a[href='/saved']", /\/saved/],
  ] as const) {
    test(`${name} moves to its page`, async ({ page }) => {
      test.skip(test.info().project.name !== "phone-390" && name === "a tab", "The tab bar is the phone's");
      await page.goto(from, { waitUntil: "networkidle" });
      await recordTransitions(page);
      await page.locator(link).first().click();
      await page.waitForURL(to);
      await expect.poll(() => recorded(page)).toContain("vt-fade");
    });
  }

  test("a Back to link moves back to its page", async ({ page }) => {
    await page.goto("/login?next=%2Flistings%2Fl-001", { waitUntil: "networkidle" });
    await recordTransitions(page);
    await page.getByRole("link", { name: "Back to the listing" }).click();
    await page.waitForURL(/\/listings\/l-001$/);
    await expect.poll(() => recorded(page)).toContain("vt-fade");
  });

  test("the menu's links close it and land on the page", async ({ page }) => {
    test.skip(test.info().project.name !== "phone-390", "The menu drawer is the phone's");
    await page.goto("/browse", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /menu/i }).first().click();
    await page.getByRole("dialog").getByRole("link", { name: "Launchpad", exact: true }).click();
    await page.waitForURL(/\/hub$/);
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("main h1").first()).toBeVisible();
  });

  test("browser Back swaps at once (React doesn't animate popstate)", async ({ page }) => {
    await page.goto("/browse", { waitUntil: "networkidle" });
    await page.locator("a.listing-link").first().click();
    await page.waitForURL(/\/listings\//);
    // Let the forward move finish first (and the listing's reveal, a second transition just after it), so only Back's own
    // animations are recorded.
    const settled = () =>
      page.waitForFunction(
        () => !document.getAnimations().some((a) => ((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith("::view-transition")),
      );
    await settled();
    await page.waitForTimeout(500);
    await settled();
    await recordTransitions(page);
    await page.goBack();
    await page.waitForURL(/\/browse/);
    await page.waitForTimeout(400);
    expect(await recorded(page)).toEqual([]);
  });
});

/** The animation a view-transition class gets, through a probe element (as role-views.spec.ts does). */
function classAnimation(page: Page, className: string, side: "old" | "new") {
  return page.evaluate(
    async ([name, which]) => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;inset:0 auto auto 0;width:10px;height:10px;";
      probe.style.setProperty("view-transition-name", "vt-probe");
      probe.style.setProperty("view-transition-class", name);
      document.body.append(probe);
      const transition = document.startViewTransition(() => {});
      await transition.ready;
      const animation = getComputedStyle(document.documentElement, `::view-transition-${which}(vt-probe)`).animationName;
      await transition.finished;
      probe.remove();
      return animation;
    },
    [className, side] as const,
  );
}

test.describe("motion is off for reduced motion and data saver", () => {
  const CLASSES: ReadonlyArray<[string, "old" | "new", string]> = [
    ["nav-forward", "new", "vt-fade, vt-slide-in"],
    ["nav-back", "new", "vt-fade, vt-slide-back-in"],
    ["reveal-in", "new", "vt-fade, vt-rise"],
    ["reveal-out", "old", "vt-fade"],
  ];

  for (const [className, side, expected] of CLASSES) {
    test(`${className} animates when motion is allowed, and not otherwise`, async ({ page }) => {
      await page.goto("/how-it-works");
      expect(await classAnimation(page, className, side)).toBe(expected);
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await classAnimation(page, className, side)).toBe("none");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.evaluate(() => document.documentElement.setAttribute("data-low-data", ""));
      expect(await classAnimation(page, className, side)).toBe("none");
    });
  }
});

test.describe("the crest loader (layer 1)", () => {
  // It shows only while a page's frame waits on streamed content, which is rare live (a slow server holds the whole
  // response, and the old page stays: layer 4 covers that). So its timings are read from a PageFallback put into a page.
  for (const mode of ["motion", "reduced", "data saver"] as const) {
    test(`waits a second, then fades in${mode === "motion" ? " and breathes" : ", still"} (${mode})`, async ({ page }) => {
      if (mode === "reduced") await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/how-it-works", { waitUntil: "networkidle" });
      if (mode === "data saver") await page.evaluate(() => document.documentElement.setAttribute("data-low-data", ""));
      await page.evaluate(() => {
        const main = document.querySelector("main")!;
        main.innerHTML =
          '<div class="page-fallback"><div class="crest-loader motion-own"><img class="crest-loader-mark" alt="" src="/favicon.ico" width="33" height="56"><p role="status" class="crest-loader-status"><span class="sr-only">Loading…</span></p></div></div>';
      });
      const read = () =>
        page.evaluate(() => {
          const loader = document.querySelector(".crest-loader")!;
          return {
            opacity: Number(getComputedStyle(loader).opacity),
            status: getComputedStyle(document.querySelector(".crest-loader-status")!).visibility,
            breath: getComputedStyle(document.querySelector(".crest-loader-mark")!).animationName,
          };
        });
      await page.waitForTimeout(500);
      expect(await read()).toMatchObject({ opacity: 0, status: "hidden" });
      await page.waitForTimeout(1100);
      const shown = await read();
      expect(shown.opacity).toBeGreaterThan(0.9);
      expect(shown.status).toBe("visible");
      expect(shown.breath).toBe(mode === "motion" ? "crest-breathe" : "none");
      await expect(page.getByRole("status").filter({ hasText: "Loading…" })).toBeAttached();
    });
  }

  test("has no serious accessibility issues once shown", async ({ page }) => {
    await page.goto("/how-it-works", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.querySelector("main")!.innerHTML =
        '<div class="page-fallback"><div class="crest-loader motion-own"><img class="crest-loader-mark" alt="" src="/favicon.ico" width="33" height="56"><p role="status" class="crest-loader-status"><span class="sr-only">Loading…</span></p></div></div>';
    });
    await page.waitForTimeout(1600);
    expect(await seriousIssues(page)).toEqual([]);
  });
});
