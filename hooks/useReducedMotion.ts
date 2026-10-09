import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** The visitor's reduced-motion preference right now. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// Until the browser answers, assume motion is unwanted, so nothing animates or autoplays early.
const reducedOnServer = () => true;

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, reducedOnServer);
}
