import { dayMonth, eventDate } from "@/lib/format";
import { sastDate } from "@/lib/time";
import { addDays } from "./rules";

// The admin's numbers' rules (stage J spec decisions 10 to 13): the measures, fixed SAST weeks, and what the page may
// show of each count. Plain functions: lib/data/numbers.ts counts the store, and these decide what reaches the page.
// The small-number rule lives here, not in the data layer, so it applies however the counts are made (spec section 8).

/** What the page counts (spec decision 10). Saved searches are never one of them. */
export type Measure =
  | "listings"
  | "shops"
  | "requests"
  | "enquiries"
  | "reports-made"
  | "reports-closed"
  | "follows";

/**
 * Each measure, in the tables' order, and whether it's private: things students do out of sight, which the
 * small-number rule protects. Public measures count what anyone can already see with its campus on it.
 */
export const MEASURES: ReadonlyArray<{ measure: Measure; label: string; isPrivate: boolean }> = [
  { measure: "listings", label: "Listings published", isPrivate: false },
  { measure: "shops", label: "Shops approved", isPrivate: false },
  { measure: "requests", label: "Looking For requests posted", isPrivate: false },
  { measure: "enquiries", label: "Enquiries started", isPrivate: true },
  { measure: "reports-made", label: "Reports made", isPrivate: true },
  { measure: "reports-closed", label: "Reports closed", isPrivate: true },
  { measure: "follows", label: "Shops followed", isPrivate: true },
];

/** Last week, the week before, and everything up to the end of last week. */
export type Period = "last" | "before" | "since";

/** A Monday-to-Sunday week in South Africa: its bounds in UTC (start included, end not) and "12 to 18 Oct". */
export type Week = { start: string; end: string; label: string };

export type SastWeeks = { last: Week; before: Week };

/** One column of raw counts: each campus's, and what's counted on a campus that has gone, which only totals use. */
export type RawColumn = { campuses: Readonly<Record<string, number>>; gone: number };

/** What lib/data/numbers.ts gives the page. */
export type RawCounts = {
  counts: Readonly<Record<Measure, Readonly<Record<Period, RawColumn>>>>;
  /** Open shops now (spec decision 10): a snapshot, never by week. */
  openShops: RawColumn;
};

/** One column as the page shows it: each campus's figure, and the total. */
export type ShownColumn = { campuses: Readonly<Record<string, string>>; total: string };

export type ShownCounts = {
  counts: Readonly<Record<Measure, Readonly<Record<Period | "change", ShownColumn>>>>;
  openShops: ShownColumn;
};

/** The smallest private count shown as itself (spec decision 13: the usual threshold for small cells). */
export const SMALL_COUNT = 5;
export const UNDER_FIVE = "Under 5";
export const HIDDEN = "Hidden";
/** Change, where a week's figure isn't shown. */
export const NO_CHANGE = "—";
/** Open shops now, in the week columns. */
export const NOT_BY_WEEK = "Not counted by week";

/** 00:00 in South Africa on a YYYY-MM-DD date, in UTC: 22:00 the day before (SAST is UTC+2, no daylight saving). */
function sastMidnight(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date, -2)).toISOString();
}

/** The Monday of the South African week a SAST date is in. */
function mondayOf(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  // 0 is Sunday. Worked out in UTC from the South African date, so the server's timezone can't move it.
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** "12 to 18 Oct", or "28 Sep to 4 Oct" across a month's end. */
function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  return eventDate(monday).month === eventDate(sunday).month
    ? `${eventDate(monday).day} to ${dayMonth(sunday)}`
    : `${dayMonth(monday)} to ${dayMonth(sunday)}`;
}

function weekFrom(monday: string): Week {
  return { start: sastMidnight(monday), end: sastMidnight(addDays(monday, 7)), label: weekLabel(monday) };
}

/**
 * The two complete SAST weeks before `now` (spec decision 11): last week, Monday 00:00 to Sunday 24:00 in South
 * Africa, and the week before it. They change once a week, at Monday 00:00 SAST. `now` comes from the caller, which
 * reads the clock only after `await connection()`.
 */
export function sastWeeks(now: Date): SastWeeks {
  const thisMonday = mondayOf(sastDate(now));
  return { last: weekFrom(addDays(thisMonday, -7)), before: weekFrom(addDays(thisMonday, -14)) };
}

/** "+3", "−2" (with a minus sign) or "0" (spec decision 11). */
export function changeText(difference: number): string {
  if (difference > 0) return `+${difference}`;
  if (difference < 0) return `−${-difference}`;
  return "0";
}

/** A private Since the start figure, rounded down to tens (spec decision 13.4): 0, "Under 10", "10+", "20+"… */
export function sinceText(count: number): string {
  if (count === 0) return "0";
  if (count < 10) return "Under 10";
  return `${Math.floor(count / 10) * 10}+`;
}

const countAt = (column: RawColumn, slug: string) => column.campuses[slug] ?? 0;

/** Every campus's count and the gone campus's: the column's total. */
function totalOf(column: RawColumn, slugs: readonly string[]): number {
  return slugs.reduce((sum, slug) => sum + countAt(column, slug), column.gone);
}

const isSmall = (count: number, below: number) => count >= 1 && count < below;
const isFigure = (text: string) => /^\d+$/.test(text);
const everyCampus = (slugs: readonly string[], text: (slug: string) => string) =>
  Object.fromEntries(slugs.map((slug) => [slug, text(slug)]));

/** Whether any campus in a column, or what's counted on a campus that has gone, is from 1 to `below - 1`. */
function hasSmall(column: RawColumn, slugs: readonly string[], below: number): boolean {
  return isSmall(column.gone, below) || slugs.some((slug) => isSmall(countAt(column, slug), below));
}

/** Exact, for public measures and open shops: each listing, shop and request is already visible with its campus. */
function exactColumn(column: RawColumn, slugs: readonly string[]): ShownColumn {
  return { campuses: everyCampus(slugs, (slug) => String(countAt(column, slug))), total: String(totalOf(column, slugs)) };
}

/**
 * A private week (spec decision 13, rule 1, amended on review): when any campus, or a campus that has gone, has 1 to 4,
 * every campus is "Hidden", zeros too, so neither the total nor the gaps can give a small number away. The decision
 * rests only on whether a small number exists, so the pattern of hidden cells reveals no figure. The total is exact,
 * or "Under 5" from 1 to 4.
 */
function weekColumn(column: RawColumn, slugs: readonly string[], isPrivate: boolean): ShownColumn {
  if (!isPrivate) return exactColumn(column, slugs);
  const total = totalOf(column, slugs);
  const small = hasSmall(column, slugs, SMALL_COUNT);
  return {
    campuses: everyCampus(slugs, (slug) => (small ? HIDDEN : String(countAt(column, slug)))),
    total: isSmall(total, SMALL_COUNT) ? UNDER_FIVE : String(total),
  };
}

/** Change (spec decision 13, rule 2): "—" unless both weeks show a figure. */
function changeOf(last: string, before: string): string {
  return isFigure(last) && isFigure(before) ? changeText(Number(last) - Number(before)) : NO_CHANGE;
}

function changeColumn(last: ShownColumn, before: ShownColumn, slugs: readonly string[]): ShownColumn {
  return {
    campuses: everyCampus(slugs, (slug) => changeOf(last.campuses[slug], before.campuses[slug])),
    total: changeOf(last.total, before.total),
  };
}

/**
 * Since the start (spec decision 13, rule 3, amended on review), private in tens. By campus only when both weeks are
 * shown by campus and nothing since the start is from 1 to 9; otherwise a campus's tens, less its weeks, could leave a
 * week's hidden figure one value. The total is "Hidden" when a week's total is "Under 5", for the same reason.
 */
function sinceColumn(
  column: RawColumn,
  slugs: readonly string[],
  isPrivate: boolean,
  last: ShownColumn,
  before: ShownColumn,
): ShownColumn {
  if (!isPrivate) return exactColumn(column, slugs);
  const byCampus =
    slugs.every((slug) => isFigure(last.campuses[slug]) && isFigure(before.campuses[slug])) && !hasSmall(column, slugs, 10);
  return {
    campuses: everyCampus(slugs, (slug) => (byCampus ? sinceText(countAt(column, slug)) : HIDDEN)),
    total: last.total === UNDER_FIVE || before.total === UNDER_FIVE ? HIDDEN : sinceText(totalOf(column, slugs)),
  };
}

/** The small-number rule (spec decision 13, amended on review). `slugs` are the campuses in the page's order. */
export function protectCounts(raw: RawCounts, slugs: readonly string[]): ShownCounts {
  const counts = Object.fromEntries(
    MEASURES.map(({ measure, isPrivate }) => {
      const columns = raw.counts[measure];
      const last = weekColumn(columns.last, slugs, isPrivate);
      const before = weekColumn(columns.before, slugs, isPrivate);
      return [
        measure,
        { last, before, since: sinceColumn(columns.since, slugs, isPrivate, last, before), change: changeColumn(last, before, slugs) },
      ];
    }),
  ) as ShownCounts["counts"];
  return { counts, openShops: exactColumn(raw.openShops, slugs) };
}

/** The campus view's campus from `?campus=` (spec decision 12): a known campus, or null for the main page. */
export function parseNumbersCampus(
  params: Readonly<Record<string, string | string[] | undefined>>,
  slugs: readonly string[],
): string | null {
  const raw = params.campus;
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return slugs.includes(value) ? value : null;
}
