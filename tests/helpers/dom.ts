import { vi } from "vitest";

/** A static MediaQueryList for tests (jsdom has no matchMedia). */
export function createMediaQueryList(media: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as MediaQueryList;
}

/** Make window.matchMedia answer queries with `isMatch`. Restored after each test by the setup file. */
export function mockMatchMedia(isMatch: (query: string) => boolean) {
  return vi
    .spyOn(window, "matchMedia")
    .mockImplementation((query: string) => createMediaQueryList(query, isMatch(query)));
}

/** Pretend the page is scrolled to `y` and fire a scroll event. */
export function setScrollY(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  window.dispatchEvent(new Event("scroll"));
}

/**
 * Make cookie writes vanish without a word, as in a browser with cookies blocked. The setup file undoes it after
 * each test.
 */
export function blockCookies(): void {
  Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: () => {} });
}
