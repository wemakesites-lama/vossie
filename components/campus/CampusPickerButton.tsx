"use client";

import type { ReactNode } from "react";
import { openOverlay } from "@/lib/overlays";

/** Opens the campus picker. Lets a Server Component render its own label (the hero chip reads the campus on the server). */
export function CampusPickerButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => openOverlay("campus", event.currentTarget)}
      className={className}
    >
      {children}
    </button>
  );
}
