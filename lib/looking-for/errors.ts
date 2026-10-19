import type { FormError } from "@/lib/auth/messages";
import { messagingErrors } from "@/lib/messaging/errors";
import {
  DETAILS_MAX,
  DETAILS_MIN,
  NEEDED_BY_DAYS,
  OFFERS_PER_DAY,
  OPEN_REQUESTS_MAX,
  REQUESTS_PER_DAY,
  TITLE_MAX,
  TITLE_MIN,
} from "./rules";

// Looking For's error words (community actions spec 2.3, 2.4, 2.5 and 2.9; plan decision 26 for the ones the spec
// doesn't give), each linked to its field, in the shape D's ErrorSummary and errorFor take.

const CONTACT = "Take out the phone number or email. Shops will message you on Vossie.";

// A Map, so a stray code such as "toString" finds nothing. The limits belong to no field.
const MESSAGES: ReadonlyMap<string, { message: string; field: string }> = new Map([
  ["title-missing", { message: "Say what you need.", field: "title" }],
  ["title-length", { message: `Keep it between ${TITLE_MIN} and ${TITLE_MAX} characters.`, field: "title" }],
  ["title-contact", { message: CONTACT, field: "title" }],
  ["category-missing", { message: "Choose a category.", field: "category" }],
  ["campus-missing", { message: "Choose a campus.", field: "campus" }],
  ["details-missing", { message: "Add the details: what you need and when.", field: "details" }],
  ["details-length", { message: `Write between ${DETAILS_MIN} and ${DETAILS_MAX} characters.`, field: "details" }],
  ["details-contact", { message: CONTACT, field: "details" }],
  ["budget-invalid", { message: "Enter a budget in whole rand, like 300, or leave it empty.", field: "budget" }],
  [
    "needed-invalid",
    { message: "Enter the date as year, month and day, like 2026-10-24, or leave it empty.", field: "neededBy" },
  ],
  ["needed-past", { message: "Choose today or a later date.", field: "neededBy" }],
  ["needed-far", { message: `Choose a date within ${NEEDED_BY_DAYS} days.`, field: "neededBy" }],
  [
    "open-limit",
    { message: `You have ${OPEN_REQUESTS_MAX} open requests. Close one before you post another.`, field: "none" },
  ],
  ["daily-limit", { message: `You've posted ${REQUESTS_PER_DAY} requests today. Try again tomorrow.`, field: "none" }],
]);

export type RequestFieldIds = {
  title: string;
  category: string;
  campus: string;
  details: string;
  budget: string;
  swap: string;
  neededBy: string;
};

/** The request form's fields' ids, from the form's prefix (plan decision 2): "request-new" or "request-<id>". */
export function requestFieldIds(prefix: string): RequestFieldIds {
  return {
    title: `${prefix}-title`,
    category: `${prefix}-category`,
    campus: `${prefix}-campus`,
    details: `${prefix}-details`,
    budget: `${prefix}-budget`,
    swap: `${prefix}-swap`,
    neededBy: `${prefix}-needed-by`,
  };
}

/** The words for the request form's error codes, in order, each linked to its field's id. */
export function requestErrors(codes: readonly string[], fieldIds: Readonly<Record<string, string>>): FormError[] {
  return codes.flatMap((code) => {
    const known = MESSAGES.get(code);
    if (!known) return [];
    return [{ message: known.message, fieldId: Object.hasOwn(fieldIds, known.field) ? fieldIds[known.field] : null }];
  });
}

export type OfferFieldIds = { body: string; listing: string };

/** The offer composer's fields' ids (plan decision 2): "offer-<id>-body" and "offer-<id>-listing". */
export function offerFieldIds(prefix: string): OfferFieldIds {
  return { body: `${prefix}-body`, listing: `${prefix}-listing` };
}

/** The offer composer's errors, in order: E's words for the message, and the shop's daily limit (spec 2.9). */
export function offerErrors(codes: readonly string[], fieldIds: Readonly<Record<string, string>>): FormError[] {
  return codes.flatMap((code) =>
    code === "offer-rate"
      ? [{ message: `Your shop has made ${OFFERS_PER_DAY} offers today. Try again tomorrow.`, fieldId: null }]
      : messagingErrors([code], fieldIds),
  );
}
