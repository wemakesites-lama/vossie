export type HeaderMode = "expanded" | "hidden" | "shown";

export type HeaderState = {
  mode: HeaderMode;
  /**
   * The turning point the next change is measured from: while hidden, the lowest point (largest scrollY) since
   * hiding; while shown, the highest point (smallest scrollY) since showing.
   */
  anchorY: number;
};

/** While scrollY is below this, the full header always shows (spec section 6.2). */
export const EXPAND_ABOVE = 120;

/** Hidden mid-page: scrolling this far back up brings the whole header back. Less is a wobble, not a wish. */
export const SHOW_AFTER = 40;

/** Shown mid-page: scrolling this far down again hides it. */
export const HIDE_AFTER = 80;

export const initialHeaderState: HeaderState = { mode: "expanded", anchorY: 0 };

export function headerOnScroll(state: HeaderState, scrollY: number): HeaderState {
  if (scrollY < EXPAND_ABOVE) {
    return state.mode === "expanded" ? state : initialHeaderState;
  }
  if (state.mode === "expanded") return { mode: "hidden", anchorY: scrollY };
  if (state.mode === "hidden") {
    if (scrollY > state.anchorY) return { mode: "hidden", anchorY: scrollY };
    if (state.anchorY - scrollY >= SHOW_AFTER) return { mode: "shown", anchorY: scrollY };
    return state;
  }
  if (scrollY < state.anchorY) return { mode: "shown", anchorY: scrollY };
  if (scrollY - state.anchorY >= HIDE_AFTER) return { mode: "hidden", anchorY: scrollY };
  return state;
}

/** The keyboard's "Show navigation" button: shows the header where the page is. */
export function headerOnShow(state: HeaderState, scrollY: number): HeaderState {
  return state.mode === "hidden" ? { mode: "shown", anchorY: scrollY } : state;
}
