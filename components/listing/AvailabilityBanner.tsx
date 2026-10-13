import type { Availability } from "@/lib/types";

/** Paused or sold (spec 5.5). The page stays up, so shared links never dead-end. */
export function AvailabilityBanner({ availability }: { availability: Availability }) {
  if (availability === "available") return null;
  return <p className="availability-banner">{availability === "sold" ? "Sold" : "Not taking orders right now"}</p>;
}
