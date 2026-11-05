"use client";

import { ChevronDownIcon, MapPinIcon } from "@/components/icons";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { ALL_CAMPUSES, campusLabel } from "@/lib/campus";
import { cx } from "@/lib/cx";
import { openOverlay } from "@/lib/overlays";
import type { TourTarget } from "@/lib/tour/targets";
import type { Campus } from "@/lib/types";

type CampusPillProps = {
  campuses: readonly Campus[];
  className?: string;
  tour?: TourTarget;
};

/** Shows the current campus and opens the campus picker. Named "Shopping at {campus}". */
export function CampusPill({ campuses, className, tour }: CampusPillProps) {
  const choice = useCampusChoice(campuses);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      data-tour={tour}
      data-chosen={choice && choice !== ALL_CAMPUSES ? "" : undefined}
      onClick={(event) => openOverlay("campus", event.currentTarget)}
      className={cx("campus-pill", className)}
    >
      <MapPinIcon className="size-[18px] shrink-0" />
      {/* The space sits outside the hidden span: accessible-name tools trim each element's own text. */}
      <span className="sr-only">Shopping at</span>{" "}
      <span className="truncate">{campusLabel(choice, campuses)}</span>
      <ChevronDownIcon className="size-4 shrink-0" />
    </button>
  );
}
