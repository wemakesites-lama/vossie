import { MAX_WRONG_TRIES } from "./config";

/** One line in an error summary, and the id of the field it belongs to (null when the form has no such field). */
export type FormError = { message: string; fieldId: string | null };

/** The sign-in page's field ids (components/auth/SignInSteps.tsx), so each error can link to its field. */
export const SIGN_IN_FIELDS = {
  email: "signin-email",
  consent: "signin-consent",
  code: "signin-code",
  firstName: "signin-first-name",
  campus: "signin-campus",
} as const;

const RATE = "You've asked for 5 codes in the last hour. Try again later.";

// The words for each error code (spec 3.1; plan decision 7 for the ones the spec doesn't give) and the field each
// belongs to. "code-wrong" is worded in wrongCode(), because it counts the tries left. A Map, so a stray code such as
// "toString" finds nothing.
const MESSAGES: ReadonlyMap<string, { message: string; field: string }> = new Map([
  ["email-missing", { message: "Enter your email address.", field: "email" }],
  ["email-domain", { message: "Use your Eduvos email address.", field: "email" }],
  ["email-rate", { message: RATE, field: "email" }],
  ["consent-missing", { message: "Tick the box to agree to the privacy policy.", field: "consent" }],
  ["code-missing", { message: "Enter the 6-digit code.", field: "code" }],
  ["code-expired", { message: "That code has expired. Send a new one.", field: "code" }],
  ["code-rate", { message: RATE, field: "code" }],
  ["locked", { message: "Too many tries. Start again.", field: "email" }],
  ["first-name-missing", { message: "Enter your first name.", field: "firstName" }],
  ["first-name-length", { message: "Your first name must be 2 to 40 characters.", field: "firstName" }],
  ["campus-missing", { message: "Choose your campus.", field: "campus" }],
  ["confirm-missing", { message: "Tick the box to confirm you understand.", field: "confirm" }],
  // Deleting an account on Supabase can fail with nothing changed (Supabase phase B, Task 7). No field: it's listed in
  // the summary without a link.
  ["delete-failed", { message: "We couldn't delete your account just now. Try again in a minute.", field: "account" }],
  // Supabase's refusals (Supabase phase B decision 6, amendment 18). Step 1's email field; step 2 has none, so there
  // they're listed in the summary without a link.
  ["code-soon", { message: "We sent you a code less than a minute ago. Wait a minute, then ask again.", field: "email" }],
  ["ip-rate", { message: "Too many sign-ins from your network just now. Try again in a few minutes.", field: "email" }],
  ["send-failed", { message: "We couldn't send the code just now. Try again in a few minutes.", field: "email" }],
  ["code-check-failed", { message: "We couldn't check the code just now. Try again in a minute.", field: "email" }],
]);

function wrongCode(wrongTries: number): string {
  const left = MAX_WRONG_TRIES - wrongTries;
  return `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`;
}

/**
 * The words for a form's error codes, in order, each linked to its field's id when the form has that field.
 * `wrongTries` is the tries used on the current code, for "That code isn't right. 4 tries left."
 */
export function formErrors(
  codes: readonly string[],
  fieldIds: Readonly<Record<string, string>>,
  wrongTries = 0,
): FormError[] {
  return codes.flatMap((code) => {
    const known = code === "code-wrong" ? { message: wrongCode(wrongTries), field: "code" } : MESSAGES.get(code);
    if (!known) return [];
    return [{ message: known.message, fieldId: Object.hasOwn(fieldIds, known.field) ? fieldIds[known.field] : null }];
  });
}

/** The message that sits under one field, if it has one. */
export function errorFor(errors: readonly FormError[], fieldId: string): string | undefined {
  return errors.find((error) => error.fieldId === fieldId)?.message;
}
