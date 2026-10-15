import type { FormError } from "@/lib/auth/messages";
import { HELP_MAX, PIN_DAYS_AHEAD, REASON_MAX, TIME_MAX } from "./rules";

// The staff forms' error words (plan decision 22: the spec gives none), each linked to its field, in the shape D's
// ErrorSummary and errorFor take. The post editor's codes start "post-" (lib/staff/post-rules.ts); its photo's codes
// are selling's (lib/selling/errors.ts).

// A Map, so a stray code such as "toString" finds nothing.
const MESSAGES: ReadonlyMap<string, { message: string; field: string }> = new Map([
  // Confirm pages and Dismiss (plan decision 18).
  ["reason-missing", { message: "Give a reason. The seller sees it.", field: "reason" }],
  ["reason-length", { message: `Keep the reason to ${REASON_MAX} characters.`, field: "reason" }],
  ["note-missing", { message: "Add a note to say what you found.", field: "note" }],
  ["note-length", { message: `Keep the note to ${REASON_MAX} characters.`, field: "note" }],
  // Mentors' notes and check-ins (plan decision 16).
  ["mentor-note-missing", { message: "Write the note first.", field: "text" }],
  ["mentor-note-length", { message: "Keep it to 1,000 characters.", field: "text" }],
  ["check-in-day-missing", { message: "Enter the check-in's date.", field: "day" }],
  ["check-in-day-future", { message: "A check-in can't be in the future.", field: "day" }],
  // Pickup points (plan decision 10).
  ["point-name-missing", { message: "Name the pickup point.", field: "name" }],
  ["point-name-length", { message: "Keep the name to 2 to 60 characters.", field: "name" }],
  ["point-name-taken", { message: "That campus already has a pickup point with that name.", field: "name" }],
  // Featured pins (plan decision 9).
  ["seller-missing", { message: "Choose a Verified seller.", field: "seller" }],
  [
    "seller-not-eligible",
    { message: "That seller can't be featured: they must be Verified, open and have something listed.", field: "seller" },
  ],
  ["campus-missing", { message: "Choose a campus, or Visitors who haven't chosen one.", field: "campus" }],
  ["day-missing", { message: "Enter a date.", field: "day" }],
  ["day-past", { message: "Choose today or a later date.", field: "day" }],
  ["day-far", { message: `Choose a date in the next ${PIN_DAYS_AHEAD} days.`, field: "day" }],
  ["pin-taken", { message: "That seller is already pinned there on that day.", field: "seller" }],
  ["pin-full", { message: "That campus already has 4 pins on that day.", field: "day" }],
  // A slot request (plan decision 13).
  ["help-missing", { message: "Say what you'd like help with.", field: "help" }],
  ["help-length", { message: `Keep it to ${HELP_MAX} characters.`, field: "help" }],
  ["time-length", { message: `Keep it to ${TIME_MAX} characters.`, field: "time" }],
  // The Hub's post editor (lib/staff/post-rules.ts), in the form's order.
  ["post-kind-missing", { message: "Choose a tip, an event or office hours.", field: "kind" }],
  // A post with RSVPs or open slot requests keeps its kind (amendment 26).
  ["post-kind-locked", { message: "People have RSVP'd or asked for a slot, so the post can't change kind.", field: "kind" }],
  ["post-title-missing", { message: "Give the post a title.", field: "title" }],
  ["post-title-length", { message: "Keep the title to 70 characters.", field: "title" }],
  ["post-campus-missing", { message: "Choose a campus, or All campuses.", field: "campus" }],
  ["post-date-missing", { message: "Enter the date.", field: "date" }],
  ["post-time-missing", { message: "Enter the start time, like 13:00.", field: "time" }],
  ["post-place-missing", { message: "Say where it happens.", field: "place" }],
  ["post-place-length", { message: "Keep the place to 80 characters.", field: "place" }],
  ["post-capacity-invalid", { message: "Enter how many places there are, from 1 to 1,000.", field: "capacity" }],
  // An event never has fewer places than the RSVPs it has taken (amendment 26).
  [
    "post-capacity-below",
    { message: "More people are going than that. Keep at least as many places as RSVPs.", field: "capacity" },
  ],
  ["post-summary-missing", { message: "Write a one-sentence summary.", field: "summary" }],
  ["post-summary-length", { message: "Keep the summary to 160 characters.", field: "summary" }],
  ["post-body-missing", { message: "Write the post.", field: "body" }],
  ["post-body-length", { message: "Keep the post to 4,000 characters.", field: "body" }],
]);

/** The words for a form's error codes, in order, each linked to its field's id when the form has that field. */
export function staffErrors(codes: readonly string[], fieldIds: Readonly<Record<string, string>>): FormError[] {
  return codes.flatMap((code) => {
    const known = MESSAGES.get(code);
    if (!known) return [];
    return [{ message: known.message, fieldId: Object.hasOwn(fieldIds, known.field) ? fieldIds[known.field] : null }];
  });
}

/**
 * A staff form's field ids, prefixed by the form and what it's about ("decline-crochet-corner", "book-h-002"), so the
 * pages Next keeps hidden for Back never repeat an id (conventions).
 */
export function staffFieldIds(prefix: string) {
  return {
    reason: `${prefix}-reason`,
    note: `${prefix}-note`,
    text: `${prefix}-text`,
    day: `${prefix}-day`,
    name: `${prefix}-name`,
    seller: `${prefix}-seller`,
    campus: `${prefix}-campus`,
    help: `${prefix}-help`,
    time: `${prefix}-time`,
  } as const;
}

/** The post editor's field ids ("new-post", or "edit-<id>"). The kind's error goes to its first radio. */
export function postFieldIds(prefix: string) {
  return {
    kind: `${prefix}-kind-tip`,
    title: `${prefix}-title`,
    campus: `${prefix}-campus`,
    date: `${prefix}-date`,
    time: `${prefix}-time`,
    place: `${prefix}-place`,
    capacity: `${prefix}-capacity`,
    summary: `${prefix}-summary`,
    body: `${prefix}-body`,
    photos: `${prefix}-cover`,
    published: `${prefix}-published`,
  } as const;
}
