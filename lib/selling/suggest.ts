// lib/selling/suggest.ts
import { characterCount, cleanText } from "@/lib/messaging/rules";
import { ALT_MAX, cleanLine, CONDITION_CHOICES, DESCRIPTION_MAX, TITLE_MAX } from "./rules";

// Photo-to-listing's words and rules (spec decisions 5 to 10), the same for every provider. Pure, so the check and the
// merge are tested without a provider, and the action and the providers share one schema.

/** Why there's no suggestion. Every kind but "person" shows the "couldn't read" notice (spec 2.4). */
export type SuggestFailure =
  | "timeout"
  | "rate-limited"
  | "refusal"
  | "bad-output"
  | "low-confidence"
  | "person"
  | "model-gone"
  | "api-error";

/** A checked suggestion: text already cleaned and cut to the form's limits. */
export type Suggestion = {
  title: string;
  categorySlug: string;
  condition: string;
  description: string;
  alt: string;
  /** Upper case, no spaces ("FAC1501"), or null when the photo isn't a textbook or shows none. */
  moduleCode: string | null;
};

const CONDITIONS = CONDITION_CHOICES.map((choice) => choice.value);
const CONFIDENCE = ["high", "medium", "low"];
const MODULE_CODE = /^[A-Z]{2,5}\d{3,4}[A-Z]?$/;

export const SUGGESTION_INSTRUCTION = [
  "You help a university student in South Africa list something for sale on CampusCart, a campus marketplace.",
  "Look at the photo and describe the item for its listing, in plain South African English.",
  "Write plain text only: no markdown, no asterisks, no bullet points. Describe only what you can see; don't guess.",
  "title: what it is, up to 70 characters, brand and model where you can read them. For a textbook, its title and edition.",
  "categorySlug: the one category that fits best.",
  "condition: how worn it looks (new, like-new, good or fair).",
  "description: two or three short sentences a buyer would want, from what you can see. Never guess a price.",
  "alt: one short, complete sentence of at most 120 characters describing the photo for someone who can't see it.",
  "isTextbook and moduleCode: the module code printed on a textbook's cover or spine (such as FAC1501), else null.",
  "personIsSubject: true when a person, not an item, is the main subject. Never describe a person.",
  "confidence: low when you can't tell what the item is.",
].join("\n");

/** The JSON schema every provider is asked for (spec decision 9), with the form's own categories. */
export function suggestionSchema(categorySlugs: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "categorySlug",
      "condition",
      "description",
      "alt",
      "isTextbook",
      "moduleCode",
      "personIsSubject",
      "confidence",
    ],
    properties: {
      title: { type: "string" },
      categorySlug: { type: "string", enum: [...categorySlugs] },
      condition: { type: "string", enum: CONDITIONS },
      description: { type: "string" },
      alt: { type: "string" },
      isTextbook: { type: "boolean" },
      moduleCode: { type: ["string", "null"] },
      personIsSubject: { type: "boolean" },
      confidence: { type: "string", enum: CONFIDENCE },
    },
  } as const;
}

const FIELDS = Object.keys(suggestionSchema([]).properties).sort().join(",");

/** At most `max` characters, as the form counts them. */
function cutTo(text: string, max: number): string {
  if (characterCount(text) <= max) return text;
  const cut = [...text].slice(0, max).join("");
  // Ends at the last whole word (models don't keep to a length they're asked for), unless that loses over half.
  const space = cut.lastIndexOf(" ");
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, "");
}

function moduleCodeOf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.toUpperCase().replace(/\s+/g, "");
  return MODULE_CODE.test(code) ? code : null;
}

/**
 * Our own check of a provider's reply (spec decision 10), whatever the provider promised: the exact fields with the
 * right types, a category and condition the form offers, then a person or an unsure read. Returns the cleaned
 * suggestion, or why there's none.
 */
export function checkSuggestion(text: string, categorySlugs: readonly string[]): Suggestion | SuggestFailure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return "bad-output";
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "bad-output";
  const reply = parsed as Record<string, unknown>;
  if (Object.keys(reply).sort().join(",") !== FIELDS) return "bad-output";
  const strings = ["title", "categorySlug", "condition", "description", "alt", "confidence"];
  if (strings.some((key) => typeof reply[key] !== "string")) return "bad-output";
  if (typeof reply.isTextbook !== "boolean" || typeof reply.personIsSubject !== "boolean") return "bad-output";
  if (reply.moduleCode !== null && typeof reply.moduleCode !== "string") return "bad-output";
  if (reply.personIsSubject) return "person";
  if (reply.confidence === "low") return "low-confidence";
  const categorySlug = reply.categorySlug as string;
  const condition = reply.condition as string;
  if (!categorySlugs.includes(categorySlug) || !CONDITIONS.includes(condition as never)) return "bad-output";
  if (!CONFIDENCE.includes(reply.confidence as string)) return "bad-output";
  const title = cutTo(cleanLine(reply.title as string).trim(), TITLE_MAX);
  if (!title) return "bad-output";
  return {
    title,
    categorySlug,
    condition,
    description: cutTo(cleanText(reply.description as string).trim(), DESCRIPTION_MAX),
    alt: cutTo(cleanLine(reply.alt as string).trim(), ALT_MAX),
    moduleCode: reply.isTextbook ? moduleCodeOf(reply.moduleCode) : null,
  };
}

/**
 * Fills the form's empty fields from a suggestion (spec decisions 5 and 6), never a typed one, and lists the fields it
 * filled, for the "Suggested" tags. A service gets no condition; the cover's description is filled only with a cover.
 */
export function mergeSuggestion(
  values: Readonly<Record<string, string>>,
  suggestion: Suggestion,
  coverSrc: string | null,
): { values: Record<string, string>; suggested: string[] } {
  const next: Record<string, string> = { ...values };
  const suggested: string[] = [];
  const fill = (key: string, value: string) => {
    if (value && !(next[key] ?? "").trim()) {
      next[key] = value;
      suggested.push(key);
    }
  };
  fill("title", suggestion.title);
  fill("category", suggestion.categorySlug);
  if (next.kind !== "service") fill("condition", suggestion.condition);
  const description = suggestion.moduleCode
    ? cutTo(`Module ${suggestion.moduleCode}. ${suggestion.description}`, DESCRIPTION_MAX)
    : suggestion.description;
  fill("description", description);
  if (coverSrc) fill(`alt:${coverSrc}`, suggestion.alt);
  return { values: next, suggested };
}
