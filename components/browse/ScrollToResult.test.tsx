import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollToResult } from "./ScrollToResult";

const OFF_SCREEN = { top: 2000, bottom: 2300 } as DOMRect;
const ON_SCREEN = { top: 100, bottom: 400 } as DOMRect;

let target: HTMLElement | null = null;

/** Puts a real element with this id in the page, with a stubbed position and a scrollIntoView spy (jsdom has none). */
function addTarget(id: string, rect: DOMRect) {
  const element = document.createElement("li");
  element.id = id;
  element.getBoundingClientRect = () => rect;
  element.scrollIntoView = vi.fn();
  document.body.appendChild(element);
  target = element;
  return element;
}

afterEach(() => {
  target?.remove();
  target = null;
  window.history.replaceState(null, "", "/");
});

describe("ScrollToResult (plan decision 4)", () => {
  it("scrolls an off-screen result named by the hash into view", () => {
    window.history.replaceState(null, "", "#r-3");
    const element = addTarget("r-3", OFF_SCREEN);
    render(<ScrollToResult />);
    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("leaves a result that is already on screen alone", () => {
    window.history.replaceState(null, "", "#r-3");
    const element = addTarget("r-3", ON_SCREEN);
    render(<ScrollToResult />);
    expect(element.scrollIntoView).not.toHaveBeenCalled();
  });

  it("ignores a hash that isn't r- and a number", () => {
    window.history.replaceState(null, "", "#results-title");
    const element = addTarget("results-title", OFF_SCREEN);
    render(<ScrollToResult />);
    expect(element.scrollIntoView).not.toHaveBeenCalled();
  });
});
