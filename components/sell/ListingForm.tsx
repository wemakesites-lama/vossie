import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses, getCategories, getOpenRequests, getPickupPoints, searchListings } from "@/lib/data";
import { getOwnListing } from "@/lib/data/own-listings";
import type { ListingRow } from "@/lib/data/rows";
import { isId } from "@/lib/messaging/paths";
import { characterCount } from "@/lib/messaging/rules";
import { listingAiOn } from "@/lib/selling/ai-config";
import { listingFieldIds, listingFieldPrefix, sellingErrors } from "@/lib/selling/errors";
import { issueListingToken, listingForm } from "@/lib/selling/form-state";
import { requestsNaming } from "@/lib/selling/looking-for-count";
import { requireShopOwner } from "@/lib/selling/owner";
import { editListingPath, NEW_LISTING_PATH } from "@/lib/selling/paths";
import { hintQuery, priceHintText } from "@/lib/selling/price-hint";
import { ALT_MAX } from "@/lib/selling/rules";
import { thumbSrc } from "@/lib/selling/thumbs";
import { sastToday } from "@/lib/time";
import { ListingFormView } from "./ListingFormView";
import type { SavedPhoto } from "./PhotoField";

/** The form's values for a listing, or a new one's: an item, for cash, picked up at the shop's first pickup point. */
function valuesOf(listing: ListingRow | null, firstSpot: string | null): Record<string, string> {
  if (!listing) return { kind: "item", payMode: "cash", handover: firstSpot ? "pickup" : "online", pickup: firstSpot ?? "" };
  return {
    kind: listing.kind,
    title: listing.title,
    category: listing.categorySlug,
    condition: listing.condition ?? "",
    price: listing.priceZar ? String(listing.priceZar) : "",
    free: listing.priceZar === 0 ? "yes" : "",
    from: listing.priceIsFrom ? "yes" : "",
    payMode: listing.payMode,
    swapFor: listing.swapFor ?? "",
    description: listing.description,
    handover: listing.handover,
    pickup: listing.pickupPointId ?? "",
    photos: listing.photos.map((photo) => photo.src).join("\n"),
    ...Object.fromEntries(listing.photos.map((photo) => [`alt:${photo.src}`, photo.alt])),
  };
}

/**
 * What a fill adds below its fields (spec 2.3): the price hint from browse's own search at the shop's campus, or at
 * every campus when that finds too few priced listings (decision 8), and, when the cover showed a module code, how many
 * open Looking For requests at the campus name it (decision 15). Request-time: `connection()` before today's date.
 */
async function afterFill(
  values: Readonly<Record<string, string>>,
  campusSlug: string,
  campusName: string,
): Promise<[string | null, { count: number; campusName: string; href: string } | null]> {
  await connection();
  const { title, category, suggestedModule } = values;
  return Promise.all([
    title && category
      ? searchListings(hintQuery(title, category, campusSlug)).then(
          async (here) =>
            priceHintText(here.items) ??
            priceHintText((await searchListings(hintQuery(title, category, ALL_CAMPUSES))).items),
        )
      : null,
    suggestedModule
      ? getOpenRequests({ category: null, today: sastToday() }).then((requests) => {
          const count = requestsNaming(requests, suggestedModule, campusSlug);
          return count > 0 ? { count, campusName, href: `/looking-for?cat=${category}` } : null;
        })
      : null,
  ]);
}

/**
 * The listing form for this seller (selling spec 2.10 and section 3): a new listing, or one of theirs to edit, with
 * what was typed before a failed save or a photo button (plan decision 9). Request-time; another shop's listing, or
 * none, is the 404.
 */
export async function ListingForm({ params }: { params?: Promise<{ id: string }> }) {
  const id = params ? (await params).id : null;
  const owner = await requireShopOwner(id ? editListingPath(id) : NEW_LISTING_PATH);
  const listing = id && isId(id) ? await getOwnListing(owner.shop.slug, id) : null;
  if (id && !listing) notFound();
  // A new listing's form gets a one-time token, made now, at request time (amendment 14.1).
  const [state, categories, campuses, pickupPoints, once] = await Promise.all([
    readFormState(listingForm(listing?.id ?? null)),
    getCategories(),
    getCampuses(),
    getPickupPoints(),
    listing ? null : issueListingToken(),
  ]);
  const spots = pickupPoints.filter((point) => owner.shop.pickupPointIds.includes(point.id));
  const values = state ? state.values : valuesOf(listing, spots[0]?.id ?? null);
  const codes = state?.errors ?? [];
  const photos: SavedPhoto[] = (values.photos ?? "")
    .split("\n")
    .filter(Boolean)
    .map((src) => ({ src, alt: values[`alt:${src}`] ?? "", thumb: thumbSrc(src) }));
  // A description that's too long is shown where it is: the error links to the first one, marked invalid (amendment
  // 11.5).
  const longAlt = codes.includes("alt-length")
    ? photos.findIndex((photo) => characterCount(photo.alt) > ALT_MAX)
    : -1;
  if (longAlt >= 0) photos[longAlt].invalid = true;
  // Photo-to-listing (spec 2.1 and 2.3): the card on a new listing while the feature is on; after a fill, the price
  // hint and the textbook Looking For line, worked out now from the filled values (never stored).
  const on = !listing && listingAiOn();
  const filled = on && state?.notice === "suggested";
  const campusSlug = owner.shop.campusSlug;
  const campusName = campuses.find((campus) => campus.slug === campusSlug)?.name ?? "";
  const [priceHint, lookingFor] = filled ? await afterFill(values, campusSlug, campusName) : [null, null];
  return (
    <ListingFormView
      listingId={listing?.id ?? null}
      once={once}
      state={listing?.state ?? null}
      waiting={owner.status === "pending"}
      values={values}
      photos={photos}
      errors={sellingErrors(codes, listingFieldIds(listingFieldPrefix(listing?.id ?? null), longAlt))}
      categories={categories}
      spots={spots}
      campusName={campusName}
      photoStart={on ? { on: true, limitReached: state?.notice === "suggest-limit" } : null}
      notice={state?.notice ?? null}
      priceHint={priceHint}
      lookingFor={lookingFor}
    />
  );
}
