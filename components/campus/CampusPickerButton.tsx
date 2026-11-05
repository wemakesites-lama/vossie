"use client";

import type { ReactNode } from "react";
import { openOverlay } from "@/lib/overlays";
import type { TourTarget } from "@/lib/tour/targets";

/** Opens the campus picker. Lets a Server Component render its own label (the hero chip reads the campus on the server). */
export function CampusPickerButton({
  className,
  tour,
  children,
}: {
  className?: string;
  tour?: TourTarget;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => openOverlay("campus", event.currentTarget)}
      className={className}
      data-tour={tour}
    >
      {children}
    </button>
  );
}
