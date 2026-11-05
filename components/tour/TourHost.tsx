"use client";

import { type ComponentType, lazy, Suspense, useEffect, useState } from "react";
import { onOverlayOpen } from "@/lib/overlays";

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
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <Tour key={open.run} trigger={open.trigger} onClose={() => setOpen(null)} />
    </Suspense>
  );
}
