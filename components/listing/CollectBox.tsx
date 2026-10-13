import type { ReactNode } from "react";
import { MapPinIcon } from "@/components/icons";
import type { Handover } from "@/lib/types";

/** Where and how the listing changes hands, in words (spec 5.3). */
export function collectCopy(
  handover: Handover,
  campusName: string,
  pickupPointName: string | null,
): { heading: string; line: string } {
  switch (handover) {
    case "pickup":
      return {
        heading: pickupPointName ? `Collect at ${campusName} · ${pickupPointName}` : `Collect at ${campusName}`,
        line: "See it before you pay, and pay when you collect.",
      };
    case "on-campus":
      return { heading: `On campus at ${campusName}`, line: "Agree a time and place when you message." };
    case "on-campus-or-online":
      return { heading: `On campus at ${campusName}, or online`, line: "Agree how when you message." };
    case "online":
      return { heading: "Online", line: "Done online, from anywhere." };
  }
}

type CollectBoxProps = {
  handover: Handover;
  campusName: string;
  pickupPointName: string | null;
  /** The campus note, when there is one. */
  children?: ReactNode;
};

/** The collect box (spec 5.3). */
export function CollectBox({ handover, campusName, pickupPointName, children }: CollectBoxProps) {
  const { heading, line } = collectCopy(handover, campusName, pickupPointName);
  return (
    <div className="collect-box">
      <MapPinIcon className="collect-icon size-5" />
      <div>
        <p className="collect-heading">{heading}</p>
        <p className="collect-line">{line}</p>
        {children}
      </div>
    </div>
  );
}
