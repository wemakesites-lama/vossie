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
  /** At most one photo's tip (AI round two spec 7), or null: most photos need none. */
  photoTip: PhotoTip | null;
};

const CONDITIONS = CONDITION_CHOICES.map((choice) => choice.value);
const CONFIDENCE = ["high", "medium", "low"];
const MODULE_CODE = /^[A-Z]{2,5}\d{3,4}[A-Z]?$/;

/** What a photo tip is about (AI round two spec 7). */
export const PHOTO_TIP_KINDS = ["dark", "blurry", "cluttered", "cut-off", "better-cover"] as const;
export type PhotoTipKind = (typeof PHOTO_TIP_KINDS)[number];

/** A tip's words at most (spec 7). Longer ones are clipped at a word, never refused: models can't count characters. */
export const PHOTO_TIP_MAX = 100;

/** One photo's tip: its number among the photos sent (1 is the cover), what's wrong, and how to fix it. */
export type PhotoTip = { photo: number; kind: PhotoTipKind; text: string };

/** A category as the instruction names it. */
export type CategoryChoice = { slug: string; name: string };

/** What belongs in each category, for the model (AI features spec 2.3). A category without a line gets its name. */
export const CATEGORY_HINTS: Readonly<Record<string, string>> = {
  "textbooks-notes": "textbooks, study guides, lecture notes and summaries",
  tech: "laptops, phones, tablets, calculators, chargers, headphones and other electronics",
  "res-living": "furniture, bedding, kitchen things, small appliances and anything else for a room or res",
  "fashion-thrift": "clothes, shoes, bags, jewellery and other fashion, new or second-hand",
  food: "home-made, baked or packaged food, snacks and drinks",
  "hair-beauty": "hair products, wigs, make-up, skincare, and hair or beauty services",
  tutoring: "lessons and help with a module or subject",
  services: "other services, such as printing, repairs, photography, design or moving",
  "tickets-events": "tickets to events, shows and parties",
  stationery: "pens, files, notebooks, art and drawing supplies, lab coats and other things for class",
};

/** The system prompt every provider gets (spec decisions 5 to 10; AI features spec 2.3 and 2.4). */
export function suggestionInstruction(categories: readonly CategoryChoice[]): string {
  const choices = categories.map(({ slug, name }) =>
    CATEGORY_HINTS[slug] ? `- ${slug}: ${name}, such as ${CATEGORY_HINTS[slug]}` : `- ${slug}: ${name}`,
  );
  return [
    "You help a university student in South Africa list something for sale on CampusCart, the marketplace for Eduvos campuses.",
    "You get one to three photos of one item or service, the cover photo first. Describe it for its listing, in plain South African English.",
    "Write plain text only: no markdown, no asterisks, no bullet points. Describe only what you can see; don't guess.",
    "title: what it is, up to 70 characters, brand and model where you can read them. For a textbook, its title and edition.",
    "categorySlug: the one category that fits best, from these:",
    ...choices,
    "condition: how worn it looks (new, like-new, good or fair).",
    "description: two or three short sentences a buyer would want, from what you can see. Never guess or mention a price.",
    "alt: one short, complete sentence of at most 120 characters describing the cover photo for someone who can't see it.",
    "isTextbook and moduleCode: the module code printed on a textbook's cover or spine (such as FAC1501), else null.",
    "personIsSubject: true when a person, not an item, is the main subject. Never describe a person.",
    "photoTip: null unless one photo has a real problem a buyer would notice. Most photos need no tip.",
    "When one does, give one tip, for the photo that matters most. photo is its number: each photo follows its label, \"Photo 1\" (the cover), \"Photo 2\" and so on. kind is dark (too dark to see the item well), blurry (out of focus or shaken), cluttered (other things crowd the item), cut-off (part of the item is outside the photo) or better-cover (another photo shows the item clearly better than photo 1).",
    "better-cover only when you were sent more than one photo, with photo the better one's number. text: one short, friendly sentence about that photo saying how to fix it, at most 100 characters, without the photo's number, such as \"Take it again near a window, so the item isn't so dark.\"",
    "confidence: low when you can't tell what the item is.",
  ].join("\n");
}

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
      "photoTip",
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
      // anyOf, not `type: ["object", "null"]`: Anthropic refuses an enum beside a type array (AI stage E's real-key
      // run). No maxLength or minimum: models can't count, so the check clips the words and drops a bad number.
      photoTip: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["photo", "kind", "text"],
            properties: {
              photo: { type: "integer" },
              kind: { type: "string", enum: [...PHOTO_TIP_KINDS] },
              text: { type: "string" },
            },
          },
        ],
      },
    },
  } as const;
}

/** The fields every reply must have. photoTip may be missing (a Groq json_object reply can leave it out): no tip. */
const FIELDS = Object.keys(suggestionSchema([]).properties)
  .filter((key) => key !== "photoTip")
  .sort()
  .join(",");

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
 * A reply's tip, checked against the photos its provider saw (AI round two spec 7): `seen` is 1 for Groq, which reads
 * only the cover, so its tip must be about photo 1 and is never better-cover. better-cover never names the cover
 * itself. A tip that breaks a rule, or whose words come to nothing, is dropped and the suggestion stays. Long words are
 * clipped at a word, not refused.
 */
export function checkPhotoTip(raw: unknown, seen: number): PhotoTip | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const { photo, kind, text } = raw as Record<string, unknown>;
  if (typeof photo !== "number" || !Number.isInteger(photo) || photo < 1 || photo > seen) return null;
  if (typeof kind !== "string" || !(PHOTO_TIP_KINDS as readonly string[]).includes(kind)) return null;
  if (kind === "better-cover" && photo === 1) return null;
  if (typeof text !== "string") return null;
  const words = cutTo(cleanLine(text).trim(), PHOTO_TIP_MAX);
  return words ? { photo, kind: kind as PhotoTipKind, text: words } : null;
}

/**
 * Our own check of a provider's reply (spec decision 10), whatever the provider promised: the exact fields with the
 * right types, a category and condition the form offers, then a person or an unsure read. Returns the cleaned
 * suggestion, or why there's none. `seen` is how many photos the provider read, for the photo tip (AI round two spec 7).
 */
export function checkSuggestion(text: string, categorySlugs: readonly string[], seen: number): Suggestion | SuggestFailure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return "bad-output";
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "bad-output";
  const reply = parsed as Record<string, unknown>;
  if (Object.keys(reply).filter((key) => key !== "photoTip").sort().join(",") !== FIELDS) return "bad-output";
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
    photoTip: checkPhotoTip(reply.photoTip, seen),
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

/** A tip as the form shows it: the photo's place now (1 is the cover) and its address, for Make it the cover. */
export type ShownPhotoTip = { place: number; src: string; kind: PhotoTipKind; text: string };

/**
 * The form-state values that carry a tip to the form after a fill (stage F planning decisions 4 and 5): the photo by
 * the address of the one sent in its place, since a photo that didn't load was left out. Never saved with a listing.
 */
export function photoTipValues(tip: PhotoTip | null, sentSrcs: readonly string[]): Record<string, string> {
  const src = tip ? sentSrcs[tip.photo - 1] : undefined;
  return tip && src ? { tipPhoto: src, tipKind: tip.kind, tipText: tip.text } : {};
}

/**
 * The tip to show (AI round two spec 7), or null: only for a photo still on the form, numbered by its place now, and
 * never a better cover that's already the cover. Form state is checked again like anything read back.
 */
export function shownPhotoTip(values: Readonly<Record<string, string>>, srcs: readonly string[]): ShownPhotoTip | null {
  const { tipPhoto = "", tipKind = "", tipText = "" } = values;
  const at = tipPhoto ? srcs.indexOf(tipPhoto) : -1;
  if (at < 0 || !(PHOTO_TIP_KINDS as readonly string[]).includes(tipKind)) return null;
  if (!tipText || characterCount(tipText) > PHOTO_TIP_MAX) return null;
  if (tipKind === "better-cover" && at === 0) return null;
  return { place: at + 1, src: tipPhoto, kind: tipKind as PhotoTipKind, text: tipText };
}

const TAGGED_FIELDS: readonly string[] = ["title", "category", "condition", "description"];

/**
 * A fill's "Suggested" tags posted back with a photo move (stage F planning decision 8): only the form's own field
 * names and descriptions of photos still on the form, once each, so form state never holds a stranger's text.
 */
export function keepSuggestedTags(raw: string, order: readonly string[]): string {
  const known = (key: string) => TAGGED_FIELDS.includes(key) || (key.startsWith("alt:") && order.includes(key.slice(4)));
  return [...new Set(raw.split(" ").filter(known))].join(" ");
}
