import { expect, type Page } from "@playwright/test";
import { STAFF_SKELETON_HTML } from "./staff-skeleton";

// Shared by the role views' end-to-end tests (N4 plan Tasks 11 and 12).

/**
 * The staff page showing is at least as tall as StaffSkeleton (CLAUDE.md: a skeleton is never taller than the page's
 * shortest state). The skeleton's markup is put beside the page, measured, and taken away; a notice is left out, as
 * the shortest state has none.
 */
export async function expectNoShorterThanSkeleton(page: Page): Promise<void> {
  await expect(page.locator("main .mentor-home").filter({ visible: true })).toBeVisible();
  const sizes = await page.evaluate((skeletonHtml) => {
    const shown = [...document.querySelectorAll<HTMLElement>("main .staff-page")].find(
      (element) => element.getClientRects().length > 0 && !element.closest("[hidden]"),
    );
    if (!shown) throw new Error("No staff page is showing");
    shown.querySelector(".staff-notice")?.remove();
    const holder = document.createElement("div");
    holder.innerHTML = skeletonHtml;
    shown.after(holder);
    const skeleton = (holder.firstElementChild as HTMLElement).getBoundingClientRect().height;
    holder.remove();
    return { page: shown.getBoundingClientRect().height, skeleton };
  }, STAFF_SKELETON_HTML);
  console.log(`${page.url()}: skeleton ${sizes.skeleton}px, page ${sizes.page}px`);
  expect(sizes.page, "the page's height against its skeleton's").toBeGreaterThanOrEqual(sizes.skeleton);
}
