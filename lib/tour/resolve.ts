import { isTourId, type StepTarget, type TourId, type TourTarget } from "./targets";

/** Whether an element is on screen. Injectable, because jsdom has no layout. */
export type Shown = (element: Element) => boolean;
export type Find = (target: TourTarget) => HTMLElement | null;

/**
 * On screen: rendered (not inside a page Next keeps hidden, not display: none at this size) and with a box (guided
 * tour spec 6.1).
 */
export function isShown(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return element.checkVisibility() && box.width > 0 && box.height > 0;
}

/** The shared chrome a step may point into, beside the page itself: the header, the tab bar and a section's bar. */
const CHROME = ".site-header, .tabbar, .section-shell";

/** The toured page that's showing. Next keeps pages you've left in the DOM, hidden, so only a visible one counts. */
export function findTourPage(doc: Document, shown: Shown = isShown): { id: TourId; page: HTMLElement } | null {
  for (const page of doc.querySelectorAll<HTMLElement>("[data-tour-page]")) {
    const id = page.dataset.tourPage;
    if (isTourId(id) && shown(page)) return { id, page };
  }
  return null;
}

/** Finds a part on screen: in the page first, then in the chrome. */
export function finderFor(doc: Document, page: HTMLElement, shown: Shown = isShown): Find {
  const roots: ParentNode[] = [page, ...doc.querySelectorAll(CHROME)];
  return (target) => {
    for (const root of roots) {
      for (const element of root.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
        if (shown(element)) return element;
      }
    }
    return null;
  };
}

/** The first of a step's targets that's on screen. */
export function pickTarget(target: StepTarget, find: Find): HTMLElement | null {
  const names: readonly TourTarget[] = typeof target === "string" ? [target] : target;
  for (const name of names) {
    const element = find(name);
    if (element) return element;
  }
  return null;
}

/** The steps that can show, each with its part (spec 3.3 and 6.2). "Step N of M" counts these. */
export function resolveSteps<S extends { target: StepTarget }>(
  steps: readonly S[],
  find: Find,
): { step: S; element: HTMLElement }[] {
  return steps.flatMap((step) => {
    const element = pickTarget(step.target, find);
    return element ? [{ step, element }] : [];
  });
}
