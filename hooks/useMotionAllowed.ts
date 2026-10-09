import { LOW_DATA_ATTR } from "@/lib/low-data";
import { useLowData } from "./useLowData";
import { REDUCED_MOTION_QUERY, useReducedMotion } from "./useReducedMotion";

/** True when animation and autoplay may run: no reduced-motion preference and data saver off. */
export function useMotionAllowed(): boolean {
  const reduced = useReducedMotion();
  const lowData = useLowData();
  return !reduced && !lowData;
}

/** The same check at one moment, for event handlers. */
export function isMotionAllowedNow(): boolean {
  return (
    !window.matchMedia(REDUCED_MOTION_QUERY).matches &&
    !document.documentElement.hasAttribute(LOW_DATA_ATTR)
  );
}
