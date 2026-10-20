import {
  headerOnScroll,
  headerOnShow,
  initialHeaderState,
  type HeaderMode,
  type HeaderState,
} from "./header-state";

/**
 * The scroll position, kept inside the page. iOS reports positions past the bottom while the page bounces there, and
 * the bounce back would read as scrolling up and show the header. (The top needs no clamp: anything below
 * EXPAND_ABOVE is the top.) A page no taller than the screen can't scroll, so there is nothing to clamp.
 */
function pageScrollY(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(window.scrollY, max) : window.scrollY;
}

/**
 * Feeds window scroll positions into the header state machine, for useSyncExternalStore.
 * `setHold` can veto a hide, so a keyboard user's focus is never pulled out of the header.
 */
export function createHeaderStore() {
  let state: HeaderState = initialHeaderState;
  let hold: () => boolean = () => false;
  const listeners = new Set<() => void>();

  const commit = (next: HeaderState) => {
    const changed = next.mode !== state.mode;
    state = next;
    if (changed) listeners.forEach((listener) => listener());
  };

  const sync = () => {
    const next = headerOnScroll(state, pageScrollY());
    if (next.mode === "hidden" && state.mode !== "hidden" && hold()) return;
    commit(next);
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener("scroll", sync, { passive: true });
      sync();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("scroll", sync);
      };
    },
    getSnapshot: (): HeaderMode => state.mode,
    getServerSnapshot: (): HeaderMode => "expanded",
    show() {
      commit(headerOnShow(state, pageScrollY()));
    },
    setHold(check: () => boolean) {
      hold = check;
    },
  };
}
