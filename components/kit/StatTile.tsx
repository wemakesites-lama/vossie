import Link from "next/link";
import { Children, type ReactNode } from "react";
import { StatDelta, type CountValue } from "@/components/charts/StatDelta";

type StatTileProps = {
  label: string;
  value: Exclude<CountValue, null>;
  /** The period before, for the change line; omit for no change line. */
  delta?: { previous: CountValue; period?: string };
  /** The whole tile links here. */
  href?: string;
  /** A line under the tile (a tile without href may carry its own link). */
  footer?: ReactNode;
};

const shown = (value: StatTileProps["value"]) =>
  value === "hidden" ? "Hidden" : value === "under5" ? "Under 5" : value.toLocaleString("en-ZA");

/** A number with its label (role views spec 5.2), replacing .sell-numbers and .staff-counts. */
export function StatTile({ label, value, delta, href, footer }: StatTileProps) {
  const body = (
    <>
      <span className="stat-tile-label">{label}</span>{" "}
      <span className="stat-tile-value" data-masked={typeof value === "number" ? undefined : ""}>
        {shown(value)}
      </span>
      {delta && <StatDelta now={value} previous={delta.previous} period={delta.period} />}
    </>
  );
  return (
    <div className="stat-tile">
      {href ? (
        <Link href={href} prefetch={false} transitionTypes={["nav-forward"]} className="stat-tile-link">
          {body}
        </Link>
      ) : (
        body
      )}
      {footer}
    </div>
  );
}

/** Tiles side by side: three to a row on phones (spec 5.2). */
export function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="stat-row">
      {Children.map(children, (child) => (
        <li>{child}</li>
      ))}
    </ul>
  );
}
