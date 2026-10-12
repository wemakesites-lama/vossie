// Store UTC, render in Africa/Johannesburg (SAST, UTC+2, no daylight saving). Never rely on the server's timezone.
const SAST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Johannesburg",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The date in South Africa at `now`, as YYYY-MM-DD. */
export function sastDate(now: Date): string {
  return SAST_DATE.format(now);
}

/**
 * Today's date in South Africa. It reads the clock, so call it only where the page renders per request: inside
 * <Suspense>, after `await connection()` from next/server, never while prerendering. A cookie read alone isn't
 * enough: Next still logs "unstable value new Date()".
 */
export function sastToday(): string {
  return sastDate(new Date());
}
