import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { NAV_PENDING_EVENT } from "@/components/ui/NavPending";
import { createHeaderStore } from "./header-store";

/** True when keyboard focus (a visible focus ring) is inside `root`. */
export function hasKeyboardFocusWithin(root: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (!root || !(active instanceof HTMLElement) || !root.contains(active)) return false;
  try {
    return active.matches(":focus-visible");
  } catch {
    // An engine without :focus-visible: assume keyboard, so the header never hides under someone's focus.
    return true;
  }
}

/** The header's mode, plus `show` for the keyboard's "Show navigation" button. */
export function useHeaderMode(headerRef: RefObject<HTMLElement | null>) {
  const [store] = useState(createHeaderStore);

  // Declared before the subscription below, so the first sync already respects it.
  // Spec 6.2: hiding never moves focus out of a control someone is using.
  useEffect(() => {
    store.setHold(() => hasKeyboardFocusWithin(headerRef.current));
  }, [store, headerRef]);

  // A tapped link still waiting for the server brings the header back, so its breathing crest can be seen (calm
  // navigation spec 4, layer 4). The new page opens at the top with the header showing anyway.
  useEffect(() => {
    window.addEventListener(NAV_PENDING_EVENT, store.show);
    return () => window.removeEventListener(NAV_PENDING_EVENT, store.show);
  }, [store]);

  const mode = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  return { mode, show: store.show };
}
