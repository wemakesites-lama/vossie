import { addDays } from "@/lib/staff/rules";
import { mondayOf } from "@/lib/staff/numbers";
import { sastDate } from "@/lib/time";
import { WEEKS_KEPT } from "./kinds";

// Shop coach's weeks (AI round two spec 4): Monday to Sunday in South Africa, named by the Monday (YYYY-MM-DD). The
// clock comes from the caller, read after connection(). Pure.

/** On Supabase, a week's row is made at request time only from Monday 06:00 SAST (I1 planning decision 11). */
export const LAZY_FROM_HOUR = 6;
const HOUR_MS = 3_600_000;
const SAST_OFFSET_MS = 2 * HOUR_MS;

export function coachWeekOf(now: Date): string {
  return mondayOf(sastDate(now));
}

export function previousWeek(week: string): string {
  return addDays(week, -7);
}

export function weeksBack(week: string, weeks: number = WEEKS_KEPT): string {
  return addDays(week, -7 * weeks);
}

/** Whether a missing row may be made now (decision 11): always in sample mode; on Supabase after the cron's run. */
export function lazyAllowed(now: Date, supabase: boolean): boolean {
  if (!supabase) return true;
  const mondayStart = Date.parse(`${coachWeekOf(now)}T00:00:00Z`) - SAST_OFFSET_MS;
  return now.getTime() - mondayStart >= LAZY_FROM_HOUR * HOUR_MS;
}
