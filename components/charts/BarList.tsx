import "server-only";
import Link from "next/link";
import type { CSSProperties } from "react";
import { NavPending } from "@/components/ui/NavPending";
import { barShare } from "@/lib/charts/scale";
import { NumbersTable } from "./NumbersTable";
import { FORWARD } from "@/lib/motion";

export type BarRow = { label: string; value: number | "hidden" | "under5"; href?: string };

type BarListProps = {
  rows: readonly BarRow[];
  label: string;
  summary: string;
  /** The numbers table's first column, e.g. "Campus" or "Shop". */
  rowHeader?: string;
  /** A shared scale for small multiples; defaults to the largest value here. */
  max?: number;
};

const words = (value: BarRow["value"]) =>
  value === "hidden" ? "Hidden" : value === "under5" ? "Under 5" : value.toLocaleString("en-ZA");

/**
 * Horizontal bars with the value printed at the end (role views spec 5.3). Bars start at 0. A masked value is a
 * hatched outline with its word, never a bar of 0 (protectCounts). Rows with an href are links in the list below,
 * because a figure with role="img" hides what's inside it.
 */
export function BarList({ rows, label, summary, rowHeader = "Item", max: sharedMax }: BarListProps) {
  const max = sharedMax ?? Math.max(0, ...rows.map((row) => (typeof row.value === "number" ? row.value : 0)));
  return (
    <div className="chart">
      <figure role="img" aria-label={summary} className="bar-list">
        {rows.map((row) => (
          <div key={row.label} className="bar-row">
            <span className="bar-label">{row.label}</span>
            {typeof row.value === "number" ? (
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ "--v": String(Math.round(barShare(row.value, max) * 1000) / 1000) } as CSSProperties}
                />
              </span>
            ) : (
              <span className="bar-masked" />
            )}
            <span className="bar-value">{words(row.value)}</span>
          </div>
        ))}
        <figcaption className="chart-summary">{summary}</figcaption>
      </figure>
      {rows.some((row) => row.href) && (
        <ul className="bar-links">
          {rows
            .filter((row) => row.href)
            .map((row) => (
              <li key={row.label}>
                <Link href={row.href!} prefetch={false} transitionTypes={FORWARD}>
                  {row.label}: {words(row.value)}
                  <NavPending />
                </Link>
              </li>
            ))}
        </ul>
      )}
      <NumbersTable caption={label} headers={[rowHeader, label]} rows={rows.map((row) => [row.label, words(row.value)])} />
    </div>
  );
}
