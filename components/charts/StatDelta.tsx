import "server-only";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";

export type CountValue = number | "hidden" | "under5" | null;

type StatDeltaProps = {
  now: CountValue;
  previous: CountValue;
  /** What it's compared with, as the sentence says it. */
  period?: string;
};

/**
 * The change against the period before (role views spec 5.3): an arrow, a signed number and words, so the colour is
 * never the only signal. A masked or missing side can't be compared (protectCounts).
 */
export function StatDelta({ now, previous, period = "last week" }: StatDeltaProps) {
  if (typeof now !== "number" || typeof previous !== "number") {
    return <span className="stat-delta" data-trend="none">Can&apos;t compare</span>;
  }
  const change = now - previous;
  if (change === 0) return <span className="stat-delta" data-trend="flat">Same as {period}</span>;
  const up = change > 0;
  return (
    <span className="stat-delta" data-trend={up ? "up" : "down"}>
      {up ? <ArrowUpIcon /> : <ArrowDownIcon />}
      <span className="sr-only">{up ? "↑" : "↓"}</span> {Math.abs(change)} on {period}
    </span>
  );
}
