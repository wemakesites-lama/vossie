"use client";

import type { CSSProperties } from "react";
import { ChevronDownIcon, MapPinIcon } from "@/components/icons";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { campusLabel } from "@/lib/campus";
import { cx } from "@/lib/cx";
import { openOverlay } from "@/lib/overlays";
import type { Campus } from "@/lib/types";

type CampusPillProps = {
  campuses: readonly Campus[];
  className?: string;
  style?: CSSProperties;
};

/** Shows the current campus and opens the campus picker. Named "Shopping at {campus}". */
export function CampusPill({ campuses, className, style }: CampusPillProps) {
  const choice = useCampusChoice(campuses);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => openOverlay("campus", event.currentTarget)}
      className={cx("campus-pill", className)}
      style={style}
    >
      <MapPinIcon className="size-[18px] shrink-0" />
      {/* The space sits outside the hidden span: accessible-name tools trim each element's own text. */}
      <span className="sr-only">Shopping at</span>{" "}
      <span className="truncate">{campusLabel(choice, campuses)}</span>
      <ChevronDownIcon className="size-4 shrink-0" />
    </button>
  );
}
