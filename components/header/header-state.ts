export type HeaderMode = "expanded" | "crest" | "revealed";

export type HeaderState = {
  mode: HeaderMode;
  /** While revealed: the highest point (smallest scrollY) reached since the reveal. */
  anchorY: number;
};

/** While scrollY is below this, the full header always shows (spec section 6.2). */
export const EXPAND_ABOVE = 120;

/** Once revealed, scrolling this far down again goes back to crest only. */
export const REHIDE_AFTER = 160;

export const initialHeaderState: HeaderState = { mode: "expanded", anchorY: 0 };

export function headerOnScroll(state: HeaderState, scrollY: number): HeaderState {
  if (scrollY < EXPAND_ABOVE) {
    return state.mode === "expanded" ? state : initialHeaderState;
  }
  if (state.mode === "expanded") return { mode: "crest", anchorY: 0 };
  if (state.mode === "revealed") {
    if (scrollY < state.anchorY) return { mode: "revealed", anchorY: scrollY };
    if (scrollY - state.anchorY >= REHIDE_AFTER) return { mode: "crest", anchorY: 0 };
  }
  return state;
}

export function headerOnReveal(state: HeaderState, scrollY: number): HeaderState {
  return state.mode === "crest" ? { mode: "revealed", anchorY: scrollY } : state;
}
