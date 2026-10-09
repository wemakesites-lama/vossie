import { useSyncExternalStore } from "react";
import { getLowData, subscribeLowData } from "@/lib/low-data";

const offOnServer = () => false;

/**
 * Whether data saver is on, for behaviour after hydration (autoplay, animation).
 * It is always false during server rendering, so anything that decides what to download before
 * hydration (image quality, photos below the fold) must key off `html[data-low-data]` instead.
 */
export function useLowData(): boolean {
  return useSyncExternalStore(subscribeLowData, getLowData, offOnServer);
}
