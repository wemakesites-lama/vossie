// How long something has waited, for the role homes' age chips (role views spec 5.2 and 8; N3 plan decision 1). It is
// elapsed time from `now`, which the caller reads at request time (after connection()), so no day boundary, and no
// timezone, is involved.

export type WaitAge = { label: string; tone: "info" | "warning" };

const HOUR = 3_600_000;

/**
 * "Under 1h", "5h", "1 day", "3 days". Warning once it has waited more than `warnAfterHours` (the admin's 2 days by
 * default). Null when there's no time to count from.
 */
export function waitAge(since: string | null, now: Date, warnAfterHours = 48): WaitAge | null {
  if (since === null) return null;
  const start = Date.parse(since);
  if (Number.isNaN(start)) return null;
  const hours = Math.max(0, (now.getTime() - start) / HOUR);
  const tone = hours > warnAfterHours ? "warning" : "info";
  if (hours < 1) return { label: "Under 1h", tone };
  if (hours < 24) return { label: `${Math.floor(hours)}h`, tone };
  const days = Math.floor(hours / 24);
  return { label: `${days} ${days === 1 ? "day" : "days"}`, tone };
}
