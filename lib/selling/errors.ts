import type { FormError } from "@/lib/auth/messages";
import { formatRand } from "@/lib/format";
import { PHOTO_MAX_MB, PHOTOS_PER_LISTING } from "@/lib/photos/rules";
import { ALT_MAX, PRICE_MAX } from "./rules";

// Selling's error words (selling spec 2.6, 2.10 and 2.11; plan decisions 24 and 27: the spec gives none), each linked
// to its field, in the shape D's ErrorSummary and errorFor take.

// A Map, so a stray code such as "toString" finds nothing.
const MESSAGES: ReadonlyMap<string, { message: string; field: string }> = new Map([
  // A shop: the wizard and Edit shop.
  ["name-missing", { message: "Enter your shop's name.", field: "name" }],
  ["name-length", { message: "Your shop's name must be 2 to 60 characters.", field: "name" }],
  ["name-taken", { message: "Another shop on your campus has that name. Try another.", field: "name" }],
  ["tagline-length", { message: "Keep the tagline to 80 characters.", field: "tagline" }],
  ["about-missing", { message: "Tell buyers about your shop in two or three sentences.", field: "about" }],
  ["about-length", { message: "Keep it to 600 characters.", field: "about" }],
  ["campus-missing", { message: "Choose your campus.", field: "campus" }],
  ["points-missing", { message: "Choose at least one pickup point.", field: "points" }],
  ["points-campus", { message: "Your campus changed, so choose your pickup points there.", field: "points" }],
  ["guidelines-missing", { message: "Tick the box to say you've read the seller guidelines.", field: "guidelines" }],
  // Step 5 only, when the shop couldn't be made. It belongs to no field.
  ["send-failed", { message: "Something went wrong, so your application wasn't sent. Try again.", field: "none" }],
  ["slug-format", { message: "Use 3 to 40 lower-case letters, numbers and single hyphens.", field: "slug" }],
  ["slug-taken", { message: "Another shop has that link. Try another.", field: "slug" }],
  // A listing, in the form's order. "category-missing" serves a shop too.
  ["kind-missing", { message: "Choose an item or a service.", field: "kind" }],
  ["title-missing", { message: "Give your listing a title.", field: "title" }],
  ["title-length", { message: "Keep the title to 70 characters.", field: "title" }],
  ["category-missing", { message: "Choose a category.", field: "category" }],
  ["condition-missing", { message: "Choose the item's condition.", field: "condition" }],
  ["price-missing", { message: "Enter a price, or tick It's free.", field: "price" }],
  ["price-invalid", { message: "Enter the price in whole rand, like 250.", field: "price" }],
  ["price-high", { message: `Keep the price to ${formatRand(PRICE_MAX)} or less.`, field: "price" }],
  ["pay-missing", { message: "Choose how you want to be paid.", field: "payMode" }],
  ["free-swap", { message: "A free listing can't be a swap. Choose Cash, or untick It's free.", field: "payMode" }],
  ["swap-missing", { message: "Say what you'd swap it for.", field: "swapFor" }],
  ["swap-length", { message: "Keep it to 200 characters.", field: "swapFor" }],
  ["description-missing", { message: "Describe it in a sentence or two.", field: "description" }],
  ["description-length", { message: "Keep the description to 1,000 characters.", field: "description" }],
  ["handover-missing", { message: "Choose how it changes hands.", field: "handover" }],
  ["pickup-missing", { message: "Choose one of your pickup points.", field: "pickup" }],
  // Photos: a listing's or the shop's.
  ["photo-type", { message: "Use a JPG, PNG or WebP photo.", field: "photos" }],
  ["photo-size", { message: `Each photo must be ${PHOTO_MAX_MB} MB or less.`, field: "photos" }],
  ["photo-count", { message: `You can add up to ${PHOTOS_PER_LISTING} photos.`, field: "photos" }],
  ["photo-unreadable", { message: "We couldn't read one of the photos. Try another.", field: "photos" }],
  ["alt-length", { message: `Keep each photo's description to ${ALT_MAX} characters.`, field: "photos" }],
]);

/** The words for a form's error codes, in order, each linked to its field's id when the form has that field. */
export function sellingErrors(codes: readonly string[], fieldIds: Readonly<Record<string, string>>): FormError[] {
  return codes.flatMap((code) => {
    const known = MESSAGES.get(code);
    if (!known) return [];
    return [{ message: known.message, fieldId: Object.hasOwn(fieldIds, known.field) ? fieldIds[known.field] : null }];
  });
}

/**
 * The shop form's field ids: "onb-…" in the wizard, "profile-…" on Edit shop (plan decision 23). A radio group's or
 * a list of boxes' id is its first control's, where an error's link lands.
 */
export function shopFieldIds(prefix: "onb" | "profile") {
  return {
    name: `${prefix}-name`,
    tagline: `${prefix}-tagline`,
    category: `${prefix}-category`,
    about: `${prefix}-about`,
    photos: `${prefix}-photo`,
    campus: `${prefix}-campus`,
    points: `${prefix}-points`,
    guidelines: `${prefix}-guidelines`,
    slug: `${prefix}-slug`,
  } as const;
}

/** The listing form's id prefix: "new", or "edit-<id>" while editing that listing (plan decision 23). */
export function listingFieldPrefix(listingId: string | null): string {
  return listingId ? `edit-${listingId}` : "new";
}

/** The listing form's field ids. A radio group's id is its first radio's. */
export function listingFieldIds(prefix: string) {
  return {
    kind: `${prefix}-kind`,
    title: `${prefix}-title`,
    category: `${prefix}-category`,
    condition: `${prefix}-condition`,
    price: `${prefix}-price`,
    payMode: `${prefix}-pay`,
    swapFor: `${prefix}-swap`,
    description: `${prefix}-description`,
    handover: `${prefix}-handover`,
    pickup: `${prefix}-pickup`,
    photos: `${prefix}-photos`,
  } as const;
}
