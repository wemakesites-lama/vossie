import { dayMonth } from "./format";

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

// en-GB writes "12 October 2026": day, month in words, year.
const SAST_LONG = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Johannesburg",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * A stored UTC time as a date in South Africa, in words: "12 October 2026" (browse and listing spec 5.1). It reads
 * no clock (the time comes from the data), so it's safe while prerendering.
 */
export function longSastDate(iso: string): string {
  return SAST_LONG.format(new Date(iso));
}

/** A stored UTC time as a short date in South Africa: "13 Oct" (community spec 4.1). It reads no clock. */
export function shortSastDate(iso: string): string {
  return dayMonth(sastDate(new Date(iso)));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// en-GB writes the 24-hour clock as "18:00"; h23 writes half past midnight as "00:30", never "24:30".
const SAST_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Johannesburg",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * A stored UTC time as a day and time in South Africa: "Wed 14 Oct · 18:00" (community spec 5.3), for events and
 * office hours. It reads no clock, so it's safe while prerendering.
 */
export function sastDateTime(iso: string): string {
  const moment = new Date(iso);
  const date = sastDate(moment);
  const [year, month, day] = date.split("-").map(Number);
  // The weekday of the South African date itself, worked out in UTC so the server's timezone can't move it.
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${dayMonth(date)} · ${SAST_CLOCK.format(moment)}`;
}

// en-GB writes "October 2026".
const SAST_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Johannesburg",
  month: "long",
  year: "numeric",
});

/** A stored UTC time as its month in South Africa: "October 2026" (accounts spec 3.2). It reads no clock. */
export function sastMonthYear(iso: string): string {
  return SAST_MONTH_YEAR.format(new Date(iso));
}

/** A stored UTC time as the time of day in South Africa, 24-hour: "10:42" (accounts spec 3.3). It reads no clock. */
export function sastClock(iso: string): string {
  return SAST_CLOCK.format(new Date(iso));
}
