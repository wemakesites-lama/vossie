import {
  headerOnReveal,
  headerOnScroll,
  initialHeaderState,
  type HeaderMode,
  type HeaderState,
} from "./header-state";

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
    const next = headerOnScroll(state, window.scrollY);
    if (next.mode === "crest" && state.mode !== "crest" && hold()) return;
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
    reveal() {
      commit(headerOnReveal(state, window.scrollY));
    },
    setHold(check: () => boolean) {
      hold = check;
    },
  };
}
