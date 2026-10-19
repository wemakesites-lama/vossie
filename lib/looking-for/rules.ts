import { characterCount, cleanText } from "@/lib/messaging/rules";
import { parsePrice } from "@/lib/selling/rules";

// Looking For's limits and checks (community actions spec 2.3 to 2.5 and 2.9; plan decisions 3 to 5). Plain values
// and functions: safe anywhere on the server and in tests.

export const TITLE_MIN = 5;
export const TITLE_MAX = 70;
export const DETAILS_MIN = 20;
export const DETAILS_MAX = 600;
/** Whole rand, as F's prices (plan decision 5). */
export const BUDGET_MAX = 100_000;
/** Needed by is today or later in SAST, and within this many days (spec 2.3). */
export const NEEDED_BY_DAYS = 90;
/** Open requests an account can have at once, and new ones in 24 hours (spec 2.5, plan decision 4). */
export const OPEN_REQUESTS_MAX = 5;
export const REQUESTS_PER_DAY = 5;
/** Offers a shop can make in 24 hours (spec 2.9). */
export const OFFERS_PER_DAY = 20;

export type RequestError =
  | "title-missing"
  | "title-length"
  | "title-contact"
  | "category-missing"
  | "campus-missing"
  | "details-missing"
  | "details-length"
  | "details-contact"
  | "budget-invalid"
  | "needed-invalid"
  | "needed-past"
  | "needed-far"
  | "open-limit"
  | "daily-limit";

/** What the request form posts (spec 2.3). */
export type RequestInput = {
  title: string;
  categorySlug: string;
  campusSlug: string;
  details: string;
  budget: string;
  swap: boolean;
  neededBy: string;
};

/** A request's fields once they're right. */
export type RequestFields = {
  title: string;
  categorySlug: string;
  campusSlug: string;
  details: string;
  budgetZar: number | null;
  swapWelcome: boolean;
  neededBy: string | null;
};

// --- Contact details (spec 2.4, plan decision 3) -------------------------------------------------------------------

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/u;
/** A run of digits that may hold spaces, dots, dashes, slashes, pluses and brackets, perhaps after a "+". */
const DIGIT_RUN = /\+?\d[\d\s().\/+-]*\d/g;
/** A date, written 2026-10-01 or 01.10.2026 or 01/10/2026: its digits are never part of a phone number. */
const DATE = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{2,4})\b/g;
/** Where one number ends and the next begins inside a run. */
const RUN_BREAK = /[\s()./+-]+/;
/** 13 digits starting 978 or 979, each perhaps after one space or dash. */
const ISBN_13 = /\b97[89](?:[\s-]?\d){10}\b/g;
/** 10 characters, digits and a last X, each perhaps after one space or dash. */
const ISBN_10 = /\b\d(?:[\s-]?\d){8}[\s-]?[\dXx]\b/g;
/** The word before an ISBN-10: "ISBN", "ISBN-10", "ISBN 10" or "ISBN10", then perhaps a colon and spaces. */
const ISBN_LABEL = /ISBN(?:[\s-]?1[03])?[\s:]*$/i;
const FOUR_GROUPS = /^\d{1,5}-\d{1,7}-\d{1,7}-[\dXx]$/;

/** An ISBN-10's check digit: the digits weighted 10 down to 1 add up to a multiple of 11 (X is 10). */
function isbn10CheckIsRight(chars: string): boolean {
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const char = chars[index];
    sum += (char === "X" || char === "x" ? 10 : Number(char)) * (10 - index);
  }
  return sum % 11 === 0;
}

/**
 * The text with its ISBNs taken out, so they're never read as phone numbers: every 978 or 979 number, and a 10-digit
 * one whose check digit is right when it's labelled "ISBN" or dashed in four groups.
 */
function withoutIsbns(text: string): string {
  return text.replace(ISBN_13, " ").replace(ISBN_10, (match: string, offset: number, whole: string) => {
    const labelled = ISBN_LABEL.test(whole.slice(0, offset));
    const isbn = (labelled || FOUR_GROUPS.test(match)) && isbn10CheckIsRight(match.replace(/[\s-]/g, ""));
    return isbn ? " " : match;
  });
}

/** A South African number's digits: 10 starting 0, or 11 starting 27, or 13 starting 0027. */
function isPhoneDigits(digits: string): boolean {
  return (
    (digits.length === 10 && digits.startsWith("0")) ||
    (digits.length === 11 && digits.startsWith("27")) ||
    (digits.length === 13 && digits.startsWith("0027"))
  );
}

/**
 * Whether some numbers in a run of digits, one after another, make a phone number ("R300 082 123 4567",
 * "R300-0821234567", "082/123/4567"). Dates come out first, so the days of "2026-10-01 - 2026-10-05" never add up to
 * one (plan amendment 17.2).
 */
function holdsPhone(run: string): boolean {
  const parts = run.replace(DATE, " ").split(RUN_BREAK).filter(Boolean);
  for (let start = 0; start < parts.length; start += 1) {
    let digits = "";
    for (let end = start; end < parts.length && digits.length <= 13; end += 1) {
      digits += parts[end].replace(/\D/g, "");
      if (isPhoneDigits(digits)) return true;
    }
  }
  return false;
}

/** Whether `text` holds an email address or a phone number (spec 2.4). ISBNs pass. */
export function hasContactDetails(text: string): boolean {
  const plain = withoutIsbns(text);
  if (EMAIL.test(plain)) return true;
  return [...plain.matchAll(DIGIT_RUN)].some(([run]) => holdsPhone(run));
}

// --- The fields (spec 2.3, plan decision 5) ------------------------------------------------------------------------

/**
 * The budget in whole rand, read as a listing's price is (F's parsePrice, plan amendment 17.1): "300", "R1 200", "1,200"
 * and "R250,00" are fine; "99,99" and "1,2" are not, because a comma before cents is not a thousands separator. Empty is
 * null ("Open to offers"); anything else is "invalid".
 */
export function parseBudget(raw: string): number | null | "invalid" {
  if (raw.trim().replace(/^R\s*/i, "") === "") return null;
  const rand = parsePrice(raw);
  return rand !== null && rand >= 1 && rand <= BUDGET_MAX ? rand : "invalid";
}

/** Whether a YYYY-MM-DD date exists ("2026-02-30" doesn't). */
function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** A South African date `days` days on, YYYY-MM-DD. It reads no clock: the date comes from the caller. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export type NeededByCheck = { value: string | null; error: "needed-invalid" | "needed-past" | "needed-far" | null };

/** Needed by (spec 2.3): empty is none; otherwise a real date from `today` (in SAST) to 90 days on. */
export function checkNeededBy(raw: string, today: string): NeededByCheck {
  const value = raw.trim();
  if (value === "") return { value: null, error: null };
  if (!isRealDate(value)) return { value: null, error: "needed-invalid" };
  if (value < today) return { value: null, error: "needed-past" };
  if (value > addDays(today, NEEDED_BY_DAYS)) return { value: null, error: "needed-far" };
  return { value, error: null };
}

/** A title on one line: E's cleanText, then every run of white space as one space. */
function cleanTitle(raw: string): string {
  return cleanText(raw).replace(/\s+/g, " ");
}

/** What the form needs to know: the categories and campuses there are, and today's date in SAST. */
export type RequestContext = { categorySlugs: readonly string[]; campusSlugs: readonly string[]; today: string };

/**
 * The request form's checks (spec 2.3 and 2.4), in the form's order: the fields once they're right, or every problem.
 * The limits (spec 2.5) need the store, so the Server Action checks them.
 */
export function checkRequest(
  input: RequestInput,
  known: RequestContext,
): { value: RequestFields | null; errors: RequestError[] } {
  const errors: RequestError[] = [];
  const title = cleanTitle(input.title);
  const titleLength = characterCount(title);
  if (title === "") errors.push("title-missing");
  else if (titleLength < TITLE_MIN || titleLength > TITLE_MAX) errors.push("title-length");
  else if (hasContactDetails(title)) errors.push("title-contact");
  if (!known.categorySlugs.includes(input.categorySlug)) errors.push("category-missing");
  if (!known.campusSlugs.includes(input.campusSlug)) errors.push("campus-missing");
  const details = cleanText(input.details);
  const detailsLength = characterCount(details);
  if (details === "") errors.push("details-missing");
  else if (detailsLength < DETAILS_MIN || detailsLength > DETAILS_MAX) errors.push("details-length");
  else if (hasContactDetails(details)) errors.push("details-contact");
  const budget = parseBudget(input.budget);
  if (budget === "invalid") errors.push("budget-invalid");
  const neededBy = checkNeededBy(input.neededBy, known.today);
  if (neededBy.error) errors.push(neededBy.error);
  if (errors.length > 0 || budget === "invalid") return { value: null, errors };
  return {
    value: {
      title,
      categorySlug: input.categorySlug,
      campusSlug: input.campusSlug,
      details,
      budgetZar: budget,
      swapWelcome: input.swap,
      neededBy: neededBy.value,
    },
    errors,
  };
}
