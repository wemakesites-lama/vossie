import { conditionLabel } from "@/lib/format";
import { characterCount, cleanText, type TextCheck } from "@/lib/messaging/rules";
import type { Condition, Handover, ListingKind, ListingState, PayMode } from "@/lib/types";

// Selling's limits and text rules (selling spec 2.6, 2.10 and 2.11; FUNCTION-MAP section 6). Plain values and
// functions: safe anywhere on the server and in tests.

export const SHOP_NAME_MIN = 2;
export const SHOP_NAME_MAX = 60;
export const TAGLINE_MAX = 80;
export const ABOUT_MAX = 600;
export const TITLE_MAX = 70;
export const DESCRIPTION_MAX = 1000;
export const SWAP_FOR_MAX = 200;
/** A photo's description (plan decision 9). */
export const ALT_MAX = 125;
/** Whole rand, from R1 (plan decision 26). */
export const PRICE_MAX = 100_000;
/** A link the seller types (selling spec 2.11). */
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/** One line of user text: line breaks and runs of spaces become one space, control characters go, the ends are trimmed. */
export function cleanLine(raw: string): string {
  return cleanText(raw).replace(/\s+/g, " ");
}

/**
 * A shop name as names are compared (plan decision 16, amendment 8.6): no case, accents, apostrophes or punctuation,
 * in any alphabet. "Tech Corner!" is "tech corner", "Zoë's Café" is "zoes cafe", and "東京" stays "東京".
 */
export function nameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * A shop's link made from its name (plan decision 16, amendment 8.6): the name's a to z and digits, joined by
 * hyphens, so "Zoë's Café" becomes "zoes-cafe". One shorter than SLUG_MIN gets "-shop" ("ab-shop"), and a name with
 * none of them is "shop".
 */
export function slugify(name: string): string {
  const slug = nameKey(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
  if (slug.length >= SLUG_MIN) return slug;
  return slug ? `${slug}-shop` : "shop";
}

/**
 * A shop's name (selling spec 2.6): 2 to 60 characters, once tidied, with at least one letter or digit in any
 * alphabet (amendment 8.6). A name of nothing else, only emoji say, counts as no name, as a first name does (D's
 * checkFirstName). Unique on its campus: the caller checks that.
 */
export function checkShopName(raw: string): TextCheck<"name-missing" | "name-length"> {
  const value = cleanLine(raw);
  if (!/[\p{L}\p{N}]/u.test(value)) return { value, error: "name-missing" };
  const length = characterCount(value);
  return { value, error: length < SHOP_NAME_MIN || length > SHOP_NAME_MAX ? "name-length" : null };
}

/** An optional tagline (selling spec 2.6), up to 80 characters. */
export function checkTagline(raw: string): TextCheck<"tagline-length"> {
  const value = cleanLine(raw);
  return { value, error: characterCount(value) > TAGLINE_MAX ? "tagline-length" : null };
}

/** The shop's two or three sentences (selling spec 2.6), up to 600 characters, line breaks kept. */
export function checkAbout(raw: string): TextCheck<"about-missing" | "about-length"> {
  const value = cleanText(raw);
  if (value === "") return { value, error: "about-missing" };
  return { value, error: characterCount(value) > ABOUT_MAX ? "about-length" : null };
}

const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A new link the seller types (selling spec 2.11): 3 to 40 lower-case letters, digits and single hyphens. */
export function checkSlug(raw: string): TextCheck<"slug-format"> {
  const value = raw.trim().toLowerCase();
  const ok = SLUG_SHAPE.test(value) && value.length >= SLUG_MIN && value.length <= SLUG_MAX;
  return { value, error: ok ? null : "slug-format" };
}

// Plain digits, or digits in groups of three split by commas or by spaces ("1,200", "1 200"), then perhaps ",00" or
// ".00": South Africa writes cents after a decimal comma, so "R250,00" is R250.
const PRICE_SHAPE = /^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?:\s\d{3})+)(?:[.,]00)?$/;

/**
 * A price as typed, in whole rand (amendment 8.5): "250", "R1 200", "1,200" and "R250,00" all work; "99,99" and
 * "1,20" don't. Null when it isn't one.
 */
export function parsePrice(raw: string): number | null {
  const typed = raw.trim().replace(/^r\s*/i, "");
  if (!PRICE_SHAPE.test(typed)) return null;
  const digits = typed.replace(/[.,]00$/, "").replace(/[\s,]/g, "");
  return digits.length <= 9 ? Number(digits) : null;
}

export const KIND_CHOICES: ReadonlyArray<{ value: ListingKind; label: string }> = [
  { value: "item", label: "An item" },
  { value: "service", label: "A service" },
];

export const CONDITION_CHOICES: ReadonlyArray<{ value: Condition; label: string }> = (
  ["new", "like-new", "good", "fair"] as const
).map((value) => ({ value, label: conditionLabel(value) }));

export const PAY_CHOICES: ReadonlyArray<{ value: PayMode; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "swap", label: "Swap" },
  { value: "both", label: "Cash or swap" },
];

export const HANDOVER_CHOICES: ReadonlyArray<{ value: Handover; label: string }> = [
  { value: "pickup", label: "Pickup at one of your points" },
  { value: "on-campus", label: "On campus" },
  { value: "on-campus-or-online", label: "On campus or online" },
  { value: "online", label: "Online" },
];

function oneOf<T extends string>(choices: ReadonlyArray<{ value: T }>, raw: string): T | null {
  return choices.find((choice) => choice.value === raw)?.value ?? null;
}

/** What the listing form posts (selling spec 2.10): its text fields and ticks. */
export type ListingInput = {
  kind: string;
  title: string;
  categorySlug: string;
  condition: string;
  price: string;
  free: boolean;
  priceIsFrom: boolean;
  payMode: string;
  swapFor: string;
  description: string;
  handover: string;
  pickupPointId: string;
};

/** A checked listing's fields, as the store keeps them. */
export type ListingFields = {
  kind: ListingKind;
  title: string;
  categorySlug: string;
  condition: Condition | null;
  priceZar: number | null;
  priceIsFrom: boolean;
  payMode: PayMode;
  swapFor: string | null;
  description: string;
  handover: Handover;
  pickupPointId: string | null;
};

export type ListingError =
  | "kind-missing"
  | "title-missing"
  | "title-length"
  | "category-missing"
  | "condition-missing"
  | "price-missing"
  | "price-invalid"
  | "price-high"
  | "pay-missing"
  | "free-swap"
  | "swap-missing"
  | "swap-length"
  | "description-missing"
  | "description-length"
  | "handover-missing"
  | "pickup-missing";

/** What a listing has to fit: the categories, and its shop's pickup spots. */
export type ListingContext = { categorySlugs: readonly string[]; pickupPointIds: readonly string[] };

/**
 * The listing form's rules (selling spec 2.10, plan decision 26). The errors come in the form's order, so the error
 * summary reads top to bottom; the fields are null while any remain. Every field shows whatever the kind or pay mode
 * (nothing can hide them without JavaScript), so a field that doesn't apply is ignored rather than refused.
 */
export function checkListing(
  input: ListingInput,
  context: ListingContext,
): { value: ListingFields | null; errors: ListingError[] } {
  const errors: ListingError[] = [];

  const kind = oneOf(KIND_CHOICES, input.kind);
  if (!kind) errors.push("kind-missing");

  const title = cleanLine(input.title);
  if (title === "") errors.push("title-missing");
  else if (characterCount(title) > TITLE_MAX) errors.push("title-length");

  const categorySlug = context.categorySlugs.includes(input.categorySlug) ? input.categorySlug : null;
  if (!categorySlug) errors.push("category-missing");

  // An item needs a condition; a service never has one (the listing model).
  const condition = kind === "item" ? oneOf(CONDITION_CHOICES, input.condition) : null;
  if (kind === "item" && !condition) errors.push("condition-missing");

  // The price, unless the listing is free (R0) or swap-only (no price).
  const payMode = oneOf(PAY_CHOICES, input.payMode);
  let priceZar: number | null = input.free ? 0 : null;
  if (!input.free && payMode !== "swap") {
    const price = parsePrice(input.price);
    if (input.price.trim() === "") errors.push("price-missing");
    else if (price === null || price < 1) errors.push("price-invalid");
    else if (price > PRICE_MAX) errors.push("price-high");
    else priceZar = price;
  }
  if (!payMode) errors.push("pay-missing");
  else if (input.free && payMode !== "cash") errors.push("free-swap");

  const swaps = !input.free && (payMode === "swap" || payMode === "both");
  const swapFor = cleanLine(input.swapFor);
  if (swaps && swapFor === "") errors.push("swap-missing");
  else if (swaps && characterCount(swapFor) > SWAP_FOR_MAX) errors.push("swap-length");

  const description = cleanText(input.description);
  if (description === "") errors.push("description-missing");
  else if (characterCount(description) > DESCRIPTION_MAX) errors.push("description-length");

  // A pickup needs one of the shop's pickup points, and a shop with none (Eduvos Online) can't offer one.
  const offered = context.pickupPointIds.length > 0 ? HANDOVER_CHOICES : HANDOVER_CHOICES.slice(1);
  const handover = oneOf(offered, input.handover);
  if (!handover) errors.push("handover-missing");
  const pickupPointId =
    handover === "pickup" && context.pickupPointIds.includes(input.pickupPointId) ? input.pickupPointId : null;
  if (handover === "pickup" && !pickupPointId) errors.push("pickup-missing");

  if (errors.length > 0 || !kind || !categorySlug || !payMode || !handover) return { value: null, errors };
  return {
    value: {
      kind,
      title,
      categorySlug,
      condition,
      priceZar,
      // "This is a starting price" is for services (selling spec 2.10).
      priceIsFrom: kind === "service" && input.priceIsFrom && priceZar !== null && priceZar > 0,
      payMode,
      swapFor: swaps ? swapFor : null,
      description,
      handover,
      pickupPointId,
    },
    errors,
  };
}

/**
 * The state a save leaves a listing in (plan decision 3): Save as draft always drafts; Save and publish makes a new
 * listing or a draft available, and keeps a paused or sold one as it is (its button says Save changes).
 */
export function nextState(current: ListingState | null, intent: "publish" | "draft"): ListingState {
  if (intent === "draft") return "draft";
  return current === "paused" || current === "sold" ? current : "available";
}
