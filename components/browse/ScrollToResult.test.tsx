import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const OFF_SCREEN = { top: 2000, bottom: 2300 } as DOMRect;
const ON_SCREEN = { top: 100, bottom: 400 } as DOMRect;

let target: HTMLElement | null = null;

/**
 * The component keeps a run-once flag at module level (a page load resets it), so each test loads a fresh copy of the
 * module, the way a new page load would.
 */
async function loadFresh() {
  vi.resetModules();
  return (await import("./ScrollToResult")).ScrollToResult;
}

/**
 * Puts a real card in the page: an element with this id holding a link, with a stubbed position and a scrollIntoView
 * spy (jsdom has none).
 */
function addTarget(id: string, rect: DOMRect) {
  const element = document.createElement("li");
  element.id = id;
  const link = document.createElement("a");
  link.href = "/listings/l-003";
  element.appendChild(link);
  element.getBoundingClientRect = () => rect;
  element.scrollIntoView = vi.fn();
  document.body.appendChild(element);
  target = element;
  return { element, link, focus: vi.spyOn(link, "focus") };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  target?.remove();
  target = null;
  window.history.replaceState(null, "", "/");
});

describe("ScrollToResult (plan decision 4, spec 4.6)", () => {
  it("focuses the link of the result named by the hash, then scrolls it into view when it's off screen", async () => {
    const ScrollToResult = await loadFresh();
    window.history.replaceState(null, "", "#r-3");
    const { element, link, focus } = addTarget("r-3", OFF_SCREEN);
    render(<ScrollToResult />);
    // The focus doesn't scroll by itself: the scroll below is the one that moves the page.
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(link).toHaveFocus();
    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("focuses a result that is already on screen, and leaves its scroll alone", async () => {
    const ScrollToResult = await loadFresh();
    window.history.replaceState(null, "", "#r-3");
    const { element, link } = addTarget("r-3", ON_SCREEN);
    render(<ScrollToResult />);
    expect(link).toHaveFocus();
    expect(element.scrollIntoView).not.toHaveBeenCalled();
  });

  it("ignores a hash that isn't r- and a number", async () => {
    const ScrollToResult = await loadFresh();
    window.history.replaceState(null, "", "#results-title");
    const { element, link, focus } = addTarget("results-title", OFF_SCREEN);
    render(<ScrollToResult />);
    expect(element.scrollIntoView).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(link).not.toHaveFocus();
  });

  it("does nothing the second time it runs, as when Back brings the page back", async () => {
    const ScrollToResult = await loadFresh();
    window.history.replaceState(null, "", "#r-3");
    const { element, focus } = addTarget("r-3", OFF_SCREEN);
    const first = render(<ScrollToResult />);
    expect(element.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);

    // Back brings the hidden page back: its effects run again, on the same module.
    first.unmount();
    render(<ScrollToResult />);
    expect(element.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  describe("while the page is still loading", () => {
    // The browser's own fragment step comes right after DOMContentLoaded and clears focus to the body, because the
    // result is a list item. It is simulated here by blurring the link, then firing the event.
    async function renderWhileLoading() {
      vi.useFakeTimers();
      vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
      const ScrollToResult = await loadFresh();
      window.history.replaceState(null, "", "#r-3");
      const added = addTarget("r-3", OFF_SCREEN);
      render(<ScrollToResult />);
      return added;
    }

    it("takes focus again one task after DOMContentLoaded, once the browser has cleared it", async () => {
      const { link } = await renderWhileLoading();
      expect(link).toHaveFocus();

      link.blur();
      document.dispatchEvent(new Event("DOMContentLoaded"));
      // Still inside the event: the browser's step is yet to come, so going now would be undone.
      expect(link).not.toHaveFocus();
      vi.runAllTimers();
      expect(link).toHaveFocus();
    });

    it("leaves focus where someone put it in the meantime", async () => {
      const { link } = await renderWhileLoading();
      const other = document.createElement("button");
      document.body.appendChild(other);
      other.focus();

      document.dispatchEvent(new Event("DOMContentLoaded"));
      vi.runAllTimers();
      expect(other).toHaveFocus();
      expect(link).not.toHaveFocus();
      other.remove();
    });

    it("goes only once when the page was already loaded", async () => {
      vi.useFakeTimers();
      vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
      const ScrollToResult = await loadFresh();
      window.history.replaceState(null, "", "#r-3");
      const { link, focus } = addTarget("r-3", OFF_SCREEN);
      render(<ScrollToResult />);
      expect(link).toHaveFocus();

      document.dispatchEvent(new Event("DOMContentLoaded"));
      vi.runAllTimers();
      expect(focus).toHaveBeenCalledTimes(1);
    });
  });
});
