import { describe, expect, it } from "vitest";
import {
  EXPAND_ABOVE,
  headerOnReveal,
  headerOnScroll,
  initialHeaderState,
  REHIDE_AFTER,
  type HeaderState,
} from "./header-state";

function scrollThrough(start: HeaderState, ...positions: number[]): HeaderState {
  return positions.reduce(headerOnScroll, start);
}

describe("header state machine", () => {
  it("stays expanded near the top", () => {
    expect(scrollThrough(initialHeaderState, 0, 60, EXPAND_ABOVE - 1).mode).toBe("expanded");
  });

  it("goes to crest only past 120px", () => {
    expect(scrollThrough(initialHeaderState, 50, EXPAND_ABOVE).mode).toBe("crest");
  });

  it("does not reveal by itself when scrolling up mid-page", () => {
    expect(scrollThrough(initialHeaderState, 900, 600, 300).mode).toBe("crest");
  });

  it("reveals on a tap, and only from crest only", () => {
    const crest = scrollThrough(initialHeaderState, 900);
    expect(headerOnReveal(crest, 900)).toEqual({ mode: "revealed", anchorY: 900 });
    expect(headerOnReveal(initialHeaderState, 0)).toBe(initialHeaderState);
  });

  it("hides again 160px further down from the highest point since the reveal", () => {
    const revealed = headerOnReveal(scrollThrough(initialHeaderState, 900), 900);
    expect(scrollThrough(revealed, 900 + REHIDE_AFTER - 1).mode).toBe("revealed");
    expect(scrollThrough(revealed, 900 + REHIDE_AFTER).mode).toBe("crest");
    // Scrolling up first moves the anchor: 160px down from 700 is 860.
    expect(scrollThrough(revealed, 700, 859).mode).toBe("revealed");
    expect(scrollThrough(revealed, 700, 860).mode).toBe("crest");
  });

  it("always returns to expanded above 120px", () => {
    const revealed = headerOnReveal(scrollThrough(initialHeaderState, 900), 900);
    expect(headerOnScroll(revealed, EXPAND_ABOVE - 1).mode).toBe("expanded");
    expect(scrollThrough(initialHeaderState, 900, 20).mode).toBe("expanded");
  });
});
