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

/**
 * The last `days` South African dates up to `now`'s, oldest first, as YYYY-MM-DD (role views spec 6: a seller's
 * enquiries by day). Worked out in UTC from the SAST date, so the server's timezone can't move a day. It reads no
 * clock: `now` comes from the caller.
 */
export function lastSastDays(days: number, now: Date): string[] {
  const [year, month, day] = sastDate(now).split("-").map(Number);
  return Array.from({ length: days }, (_, index) =>
    new Date(Date.UTC(year, month - 1, day - (days - 1 - index))).toISOString().slice(0, 10),
  );
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

// --- Messaging (messaging plan, Task 2, plan decision 28) ---------------------------------------------------------

// en-GB writes the short weekday as "Mon".
const SAST_WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short" });

/** Whole days from one South African date (YYYY-MM-DD) to a later one. */
function daysBetween(earlier: string, later: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

/** "12 Oct", or "12 Oct 2025" when it isn't `now`'s year, in South Africa. */
function dateForMessages(iso: string, now: Date): string {
  const year = sastDate(new Date(iso)).slice(0, 4);
  return year === sastDate(now).slice(0, 4) ? shortSastDate(iso) : `${shortSastDate(iso)} ${year}`;
}

/**
 * When a conversation last moved, for the inbox (messaging spec 3.2): "14:05" today, "Mon" in the six days before,
 * "12 Oct" earlier this year and "12 Oct 2025" before that, in South Africa. `now` comes from the caller, which reads
 * the clock only after `await connection()`.
 */
export function inboxTime(iso: string, now: Date): string {
  const days = daysBetween(sastDate(new Date(iso)), sastDate(now));
  if (days <= 0) return sastClock(iso);
  if (days < 7) return SAST_WEEKDAY.format(new Date(iso));
  return dateForMessages(iso, now);
}

/** When a message was sent, in a thread (messaging spec 3.3): "14:05" today, otherwise "12 Oct, 14:05". */
export function messageTime(iso: string, now: Date): string {
  if (sastDate(new Date(iso)) === sastDate(now)) return sastClock(iso);
  return `${dateForMessages(iso, now)}, ${sastClock(iso)}`;
}
