import type { PickupPoint } from "@/lib/types";
import { campuses } from "./campuses";

// Generic sample spots on every physical campus. The real ones come from each campus before launch
// (docs/reference/GO-LIVE.md). Eduvos Online has none: everything there happens online.
export const pickupPoints: readonly PickupPoint[] = campuses
  .filter((campus) => campus.slug !== "online")
  .flatMap((campus) => [
    { id: `pp-${campus.slug}-library`, campusSlug: campus.slug, name: "Library entrance" },
    { id: `pp-${campus.slug}-reception`, campusSlug: campus.slug, name: "Main reception" },
  ]);
