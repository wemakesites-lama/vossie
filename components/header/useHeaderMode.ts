import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { createHeaderStore } from "./header-store";

/** True when keyboard focus (a visible focus ring) is inside `root`. */
export function hasKeyboardFocusWithin(root: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (!root || !(active instanceof HTMLElement) || !root.contains(active)) return false;
  try {
    return active.matches(":focus-visible");
  } catch {
    return true;
  }
}

/** The header's mode, plus `reveal` for the crest-only pennant. */
export function useHeaderMode(headerRef: RefObject<HTMLElement | null>) {
  const [store] = useState(createHeaderStore);
  const mode = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  // Spec 6.2: hiding never moves focus out of a control someone is using.
  useEffect(() => {
    store.setHold(() => hasKeyboardFocusWithin(headerRef.current));
  }, [store, headerRef]);

  return { mode, reveal: store.reveal };
}
