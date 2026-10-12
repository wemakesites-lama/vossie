import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

const isHidden = () => document.visibilityState === "hidden";
const visibleOnServer = () => false;

/** Whether this tab is hidden. Autoplay holds while it is (spec 8). */
export function usePageHidden(): boolean {
  return useSyncExternalStore(subscribe, isHidden, visibleOnServer);
}
