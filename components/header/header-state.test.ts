import { describe, expect, it } from "vitest";
import {
  EXPAND_ABOVE,
  HIDE_AFTER,
  headerOnScroll,
  headerOnShow,
  initialHeaderState,
  SHOW_AFTER,
  type HeaderState,
} from "./header-state";

function scrollThrough(start: HeaderState, ...positions: number[]): HeaderState {
  return positions.reduce(headerOnScroll, start);
}

describe("header state machine", () => {
  it("stays expanded near the top", () => {
    expect(scrollThrough(initialHeaderState, 0, 60, EXPAND_ABOVE - 1).mode).toBe("expanded");
  });

  it("hides completely past 120px", () => {
    expect(scrollThrough(initialHeaderState, 50, EXPAND_ABOVE).mode).toBe("hidden");
  });

  it("shows again after 40px of scrolling up, measured from the lowest point", () => {
    expect(scrollThrough(initialHeaderState, 900, 900 - SHOW_AFTER + 1).mode).toBe("hidden");
    expect(scrollThrough(initialHeaderState, 900, 900 - SHOW_AFTER).mode).toBe("shown");
    // Scrolling further down first moves the turning point: 40px up from 1200 is 1160.
    expect(scrollThrough(initialHeaderState, 900, 1200, 1161).mode).toBe("hidden");
    expect(scrollThrough(initialHeaderState, 900, 1200, 1160).mode).toBe("shown");
  });

  it("ignores a small wobble", () => {
    expect(scrollThrough(initialHeaderState, 900, 890, 905, 880).mode).toBe("hidden");
  });

  it("hides again 80px further down from the highest point since showing", () => {
    const shown = scrollThrough(initialHeaderState, 900, 800);
    expect(shown.mode).toBe("shown");
    expect(scrollThrough(shown, 800 + HIDE_AFTER - 1).mode).toBe("shown");
    expect(scrollThrough(shown, 800 + HIDE_AFTER).mode).toBe("hidden");
    // Scrolling up first moves the turning point: 80px down from 600 is 680.
    expect(scrollThrough(shown, 600, 679).mode).toBe("shown");
    expect(scrollThrough(shown, 600, 680).mode).toBe("hidden");
  });

  it("always returns to expanded above 120px", () => {
    expect(scrollThrough(initialHeaderState, 900, EXPAND_ABOVE - 1).mode).toBe("expanded");
    expect(scrollThrough(initialHeaderState, 900, 800, 20).mode).toBe("expanded");
  });

  it("treats iOS overscroll above the top as the top", () => {
    expect(headerOnScroll({ mode: "hidden", anchorY: 400 }, -40).mode).toBe("expanded");
  });

  it("shows on the keyboard's button, and only while hidden", () => {
    const hidden = scrollThrough(initialHeaderState, 900);
    expect(headerOnShow(hidden, 900)).toEqual({ mode: "shown", anchorY: 900 });
    expect(headerOnShow(initialHeaderState, 0)).toBe(initialHeaderState);
    const shown = headerOnShow(hidden, 900);
    expect(headerOnShow(shown, 500)).toBe(shown);
  });
});
