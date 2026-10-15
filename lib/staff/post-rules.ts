import { ALL_CAMPUSES } from "@/lib/campus";
import { MAX_MARKDOWN_LENGTH } from "@/lib/markdown";
import { characterCount, cleanText } from "@/lib/messaging/rules";
import { cleanLine } from "@/lib/selling/rules";
import { sastClock, sastDate } from "@/lib/time";
import type { HubPostKind } from "@/lib/types";
import { parseDay } from "./rules";

// The Hub's post editor (staff tools spec 2.4; plan decisions 11 and 12): its fields, their limits, and SAST dates and
// times turned into UTC (SAST is UTC+2, with no daylight saving). Plain functions.

export const POST_TITLE_MAX = 70;
export const POST_SUMMARY_MAX = 160;
export const POST_PLACE_MAX = 80;
export const POST_BODY_MAX = 4000;
export const POST_CAPACITY_MAX = 1000;
/**
 * Typed text kept in form state for the editor after a failed save or a Preview (plan decision 12): part B's parser
 * cap, 8,000, so a long body isn't cut short before it's checked.
 */
export const POST_KEEP_MAX = MAX_MARKDOWN_LENGTH;

/** The three kinds, in the editor's order, with what each needs. */
export const POST_KINDS: ReadonlyArray<{ value: HubPostKind; label: string; hint: string }> = [
  { value: "tip", label: "Tip", hint: "Advice for sellers, for every campus. No date or place." },
  { value: "event", label: "Event", hint: "A date, a place and a number of places. Students RSVP." },
  { value: "office-hours", label: "Office hours", hint: "A date and a place. Students request a slot." },
];

/** What the editor posts, as text. */
export type PostInput = {
  kind: string;
  title: string;
  campus: string;
  /** YYYY-MM-DD, SAST. */
  date: string;
  /** HH:MM, 24-hour, SAST. */
  time: string;
  place: string;
  capacity: string;
  summary: string;
  body: string;
  published: boolean;
};

/** A post's fields once checked: part B's HubPost fields, and whether it's published. */
export type PostFields = {
  kind: HubPostKind;
  title: string;
  campusSlug: string;
  startsAt: string | null;
  place: string | null;
  capacity: number | null;
  summary: string;
  body: string;
  published: boolean;
};

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A South African date and time as an ISO time in UTC, or null when either isn't one. */
export function sastToUtc(day: string, clock: string): string | null {
  const date = parseDay(day);
  const time = CLOCK.exec(clock.trim());
  if (!date || !time) return null;
  const [year, month, dayOfMonth] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, dayOfMonth, Number(time[1]) - 2, Number(time[2]))).toISOString();
}

/** A UTC time as the editor's SAST date and time fields. */
export function utcToSastFields(iso: string): { date: string; time: string } {
  return { date: sastDate(new Date(iso)), time: sastClock(iso) };
}

function limited(raw: string, clean: (text: string) => string, max: number, missing: string, long: string) {
  const value = clean(raw);
  if (value === "") return { value, error: missing };
  return { value, error: characterCount(value) > max ? long : null };
}

/**
 * The editor's fields, checked (spec 2.4): the kind; a title of up to 70 characters; a campus or All campuses (a tip is
 * always every campus's); for events and office hours a date, a start time and a place; for events, 1 to 1,000
 * places; a one-sentence summary of up to 160; and the body, the markdown subset, up to 4,000. Every problem is listed
 * in the form's order; the fields come back only when there's none.
 */
export function checkPost(input: PostInput, campusSlugs: readonly string[]): { value: PostFields | null; errors: string[] } {
  const errors: string[] = [];
  const kind = POST_KINDS.find((item) => item.value === input.kind)?.value ?? null;
  if (!kind) errors.push("post-kind-missing");

  const title = limited(input.title, cleanLine, POST_TITLE_MAX, "post-title-missing", "post-title-length");
  if (title.error) errors.push(title.error);

  const campusSlug = kind === "tip" ? ALL_CAMPUSES : input.campus;
  if (campusSlug !== ALL_CAMPUSES && !campusSlugs.includes(campusSlug)) errors.push("post-campus-missing");

  let startsAt: string | null = null;
  let place: string | null = null;
  if (kind === "event" || kind === "office-hours") {
    const day = parseDay(input.date);
    if (!day) errors.push("post-date-missing");
    if (!CLOCK.test(input.time.trim())) errors.push("post-time-missing");
    if (day) startsAt = sastToUtc(day, input.time);
    const where = limited(input.place, cleanLine, POST_PLACE_MAX, "post-place-missing", "post-place-length");
    if (where.error) errors.push(where.error);
    place = where.value;
  }

  let capacity: number | null = null;
  if (kind === "event") {
    const typed = input.capacity.trim();
    const places = /^\d{1,4}$/.test(typed) ? Number(typed) : 0;
    if (places < 1 || places > POST_CAPACITY_MAX) errors.push("post-capacity-invalid");
    else capacity = places;
  }

  const summary = limited(input.summary, cleanLine, POST_SUMMARY_MAX, "post-summary-missing", "post-summary-length");
  if (summary.error) errors.push(summary.error);
  const body = limited(input.body, cleanText, POST_BODY_MAX, "post-body-missing", "post-body-length");
  if (body.error) errors.push(body.error);

  if (errors.length > 0 || !kind) return { value: null, errors };
  return {
    value: {
      kind,
      title: title.value,
      campusSlug,
      startsAt,
      place,
      capacity,
      summary: summary.value,
      body: body.value,
      published: input.published,
    },
    errors,
  };
}
