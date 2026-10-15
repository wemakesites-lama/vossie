import { characterCount, cleanText, type TextCheck } from "@/lib/messaging/rules";
import { cleanLine } from "@/lib/selling/rules";

// The staff forms' limits and checks (staff tools spec 2.3 to 2.6; plan decisions 9, 10, 13, 16 and 18). Plain values
// and functions: safe anywhere on the server and in tests. Text is tidied as messaging's and selling's is.

/** A decline's, a hide's or a pause's reason, and a dismissal's note (plan decision 18). */
export const REASON_MAX = 500;
/** A mentor's note or check-in (plan decision 16). */
export const MENTOR_NOTE_MAX = 1000;
/** A pickup point's name (plan decision 10). */
export const POINT_NAME_MIN = 2;
export const POINT_NAME_MAX = 60;
/** A slot request (staff tools spec 2.5). */
export const HELP_MAX = 300;
export const TIME_MAX = 100;
/** How far ahead a Featured pin can be (plan decision 9). */
export const PIN_DAYS_AHEAD = 60;

function required<M extends string, L extends string>(value: string, max: number, missing: M, long: L) {
  if (value === "") return { value, error: missing };
  return { value, error: characterCount(value) > max ? long : null };
}

/** A required reason, which the seller sees (plan decision 18). Line breaks are kept. */
export function checkReason(raw: string): TextCheck<"reason-missing" | "reason-length"> {
  return required(cleanText(raw), REASON_MAX, "reason-missing", "reason-length");
}

/** Dismiss's note (spec 2.3: "Dismiss (with a note)"). Only staff see it. */
export function checkDismissNote(raw: string): TextCheck<"note-missing" | "note-length"> {
  return required(cleanText(raw), REASON_MAX, "note-missing", "note-length");
}

/** A mentor's note or check-in (spec 2.6). Line breaks are kept. */
export function checkMentorNote(raw: string): TextCheck<"mentor-note-missing" | "mentor-note-length"> {
  return required(cleanText(raw), MENTOR_NOTE_MAX, "mentor-note-missing", "mentor-note-length");
}

/** A pickup point's name: one line, 2 to 60 characters. Unique on its campus: the caller checks that. */
export function checkPointName(raw: string): TextCheck<"point-name-missing" | "point-name-length"> {
  const value = cleanLine(raw);
  if (value === "") return { value, error: "point-name-missing" };
  const length = characterCount(value);
  return { value, error: length < POINT_NAME_MIN || length > POINT_NAME_MAX ? "point-name-length" : null };
}

/** What the student would like help with (spec 2.5). */
export function checkHelp(raw: string): TextCheck<"help-missing" | "help-length"> {
  return required(cleanText(raw), HELP_MAX, "help-missing", "help-length");
}

/** A time that suits (spec 2.5): optional, one line. "" means any time. */
export function checkTime(raw: string): TextCheck<"time-length"> {
  const value = cleanLine(raw);
  return { value, error: characterCount(value) > TIME_MAX ? "time-length" : null };
}

/** A date from a form as YYYY-MM-DD, when it's a real day. A date field posts this shape in every browser. */
export function parseDay(raw: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? match[0]
    : null;
}

/** `days` days after a YYYY-MM-DD date (before it when negative). No timezone: the date is already South Africa's. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

/** A pin's day (plan decision 9): today (in SAST) to 60 days ahead. */
export function checkPinDay(raw: string, today: string): TextCheck<"day-missing" | "day-past" | "day-far"> {
  const value = parseDay(raw);
  if (!value) return { value: raw.trim(), error: "day-missing" };
  if (value < today) return { value, error: "day-past" };
  return { value, error: value > addDays(today, PIN_DAYS_AHEAD) ? "day-far" : null };
}

/** A check-in's day (spec 2.6): today (in SAST) or earlier. */
export function checkCheckInDay(
  raw: string,
  today: string,
): TextCheck<"check-in-day-missing" | "check-in-day-future"> {
  const value = parseDay(raw);
  if (!value) return { value: raw.trim(), error: "check-in-day-missing" };
  return { value, error: value > today ? "check-in-day-future" : null };
}
