"use client";

import { openOverlay } from "@/lib/overlays";
import { markTourSeen } from "@/lib/tour/seen";

/** The invitation's two buttons (guided tour spec 3.1): the only client code it has. */
export function TourNudgeButtons() {
  return (
    <div className="tour-nudge-actions">
      <button type="button" className="btn btn-primary" onClick={(event) => openOverlay("tour", event.currentTarget)}>
        Take the tour
      </button>
      <button
        type="button"
        className="btn btn-outline text-navy"
        onClick={() => {
          markTourSeen();
          // The invitation is gone, and focus with it: start again from the page.
          document.getElementById("main")?.focus();
        }}
      >
        Not now
      </button>
    </div>
  );
}
