import { getLowData } from "@/lib/low-data";
import { useLowData } from "./useLowData";
import { prefersReducedMotion, useReducedMotion } from "./useReducedMotion";

/** True when animation and autoplay may run: no reduced-motion preference and data saver off. */
export function useMotionAllowed(): boolean {
  const reduced = useReducedMotion();
  const lowData = useLowData();
  return !reduced && !lowData;
}

/** The same check at one moment, for event handlers. */
export function isMotionAllowedNow(): boolean {
  return !prefersReducedMotion() && !getLowData();
}
