import { notFound } from "next/navigation";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses, getCategories, getPickupPoints } from "@/lib/data";
import { getOwnListing } from "@/lib/data/own-listings";
import type { ListingRow } from "@/lib/data/rows";
import { isId } from "@/lib/messaging/paths";
import { listingFieldIds, listingFieldPrefix, sellingErrors } from "@/lib/selling/errors";
import { listingForm } from "@/lib/selling/form-state";
import { requireShopOwner } from "@/lib/selling/owner";
import { editListingPath, NEW_LISTING_PATH } from "@/lib/selling/paths";
import { thumbSrc } from "@/lib/selling/thumbs";
import { ListingFormView } from "./ListingFormView";

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
 * The listing form for this seller (selling spec 2.10 and section 3): a new listing, or one of theirs to edit, with
 * what was typed before a failed save or a photo button (plan decision 9). Request-time; another shop's listing, or
 * none, is the 404.
 */
export async function ListingForm({ params }: { params?: Promise<{ id: string }> }) {
  const id = params ? (await params).id : null;
  const owner = await requireShopOwner(id ? editListingPath(id) : NEW_LISTING_PATH);
  const listing = id && isId(id) ? await getOwnListing(owner.shop.slug, id) : null;
  if (id && !listing) notFound();
  const [state, categories, campuses, pickupPoints] = await Promise.all([
    readFormState(listingForm(listing?.id ?? null)),
    getCategories(),
    getCampuses(),
    getPickupPoints(),
  ]);
  const spots = pickupPoints.filter((point) => owner.shop.pickupPointIds.includes(point.id));
  const values = state ? state.values : valuesOf(listing, spots[0]?.id ?? null);
  const photos = (values.photos ?? "")
    .split("\n")
    .filter(Boolean)
    .map((src) => ({ src, alt: values[`alt:${src}`] ?? "", thumb: thumbSrc(src) }));
  return (
    <ListingFormView
      listingId={listing?.id ?? null}
      state={listing?.state ?? null}
      waiting={owner.status === "pending"}
      values={values}
      photos={photos}
      errors={sellingErrors(state?.errors ?? [], listingFieldIds(listingFieldPrefix(listing?.id ?? null)))}
      categories={categories}
      spots={spots}
      campusName={campuses.find((campus) => campus.slug === owner.shop.campusSlug)?.name ?? ""}
      round={state?.expiresAt}
    />
  );
}
