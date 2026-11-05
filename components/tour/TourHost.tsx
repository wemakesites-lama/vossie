"use client";

import { type ComponentType, lazy, Suspense, useEffect, useState } from "react";
import { onOverlayOpen, openOverlay } from "@/lib/overlays";
import { markTourSeen } from "@/lib/tour/seen";

type TourProps = { trigger: HTMLElement | null; onClose: () => void };

/** If the tour's code can't load (offline, or a new deploy), close quietly rather than break the page. */
function TourUnavailable({ onClose }: TourProps) {
  useEffect(() => onClose(), [onClose]);
  return null;
}

/** The engine, loaded on the first "Show me around" (guided tour spec 5): no page pays for it up front. */
const Tour = lazy<ComponentType<TourProps>>(() => import("./Tour").catch(() => ({ default: TourUnavailable })));

type Open = { trigger: HTMLElement | null; run: number };

/** In the root layout, beside the other overlays. Renders nothing until a tour is asked for. */
export function TourHost() {
  const [open, setOpen] = useState<Open | null>(null);
  useEffect(() => onOverlayOpen("tour", (trigger) => setOpen((was) => ({ trigger, run: (was?.run ?? 0) + 1 }))), []);

  // The invitation's buttons are plain markup on every toured page (components/home/TourNudgeButtons.tsx); one listener
  // here answers them. Either one answers the invitation for good.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tour-nudge]") : null;
      if (!button) return;
      if (button.dataset.tourNudge === "start") openOverlay("tour", button);
      markTourSeen();
      // Closed, the invitation is gone and focus with it: start again from the page.
      if (button.dataset.tourNudge === "close") document.getElementById("main")?.focus();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <Tour key={open.run} trigger={open.trigger} onClose={() => setOpen(null)} />
    </Suspense>
  );
}
