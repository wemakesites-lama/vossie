import type { ListingRow, SellerRow } from "@/lib/data/rows";
import { listings } from "./listings";
import { pickupPoints } from "./pickup-points";
import { sellers } from "./sellers";

// The sample store's shops and listings (selling plan, Task 1; plan decision 7): the listing and seller fixtures as
// rows, plus Lerato's shop, which is waiting for the Hub (selling spec 2.7). Fixtures import nothing from lib at run
// time; these read the other fixtures. Lerato's shop is sample wording for Lama to change.

/** Which sample shops a sample account owns (data/fixtures/accounts.ts). No account owns the other sample shops. */
export const sampleShopOwners: ReadonlyMap<string, string> = new Map([
  ["tech-corner", "acc-seller"],
  ["crochet-corner", "acc-pending"],
]);

/** A campus's pickup spots. Eduvos Online has none. */
const spotsAt = (campusSlug: string) =>
  pickupPoints.filter((point) => point.campusSlug === campusSlug).map((point) => point.id);

/** Lerato's shop (acc-pending): sent for approval on 10 October and still waiting (selling spec 2.7). */
const crochetCorner: SellerRow = {
  slug: "crochet-corner",
  ownerId: "acc-pending",
  name: "Crochet corner",
  tagline: "Beanies, bags and bucket hats, made by hand.",
  categorySlug: "fashion-thrift",
  campusSlug: "pretoria",
  verified: false,
  badge: "new-seller",
  about:
    "I crochet between lectures and sell what I make.\n" +
    "Tell me your colours and I'll make you a beanie or a bag to order.",
  since: "2026-10",
  image: null,
  pickupPointIds: ["pp-pretoria-library"],
  slugChanged: false,
  previousSlugs: [],
  createdAt: "2026-10-10T12:20:00.000Z",
  updatedAt: "2026-10-10T12:20:00.000Z",
};

export const sampleSellerRows: readonly SellerRow[] = [
  ...sellers.map(
    (seller): SellerRow => ({
      slug: seller.slug,
      ownerId: sampleShopOwners.get(seller.slug) ?? null,
      name: seller.name,
      tagline: seller.tagline,
      categorySlug: seller.categorySlug,
      campusSlug: seller.campusSlug,
      verified: seller.verified,
      badge: seller.badge,
      about: seller.about,
      since: seller.since,
      image: { ...seller.image },
      pickupPointIds: spotsAt(seller.campusSlug),
      slugChanged: false,
      previousSlugs: [],
      createdAt: `${seller.since}-01T08:00:00.000Z`,
      updatedAt: `${seller.since}-01T08:00:00.000Z`,
    }),
  ),
  crochetCorner,
];

export const sampleListingRows: readonly ListingRow[] = listings.map(
  (listing): ListingRow => ({
    id: listing.id,
    sellerSlug: listing.sellerSlug,
    state: listing.availability,
    kind: listing.kind,
    title: listing.title,
    categorySlug: listing.categorySlug,
    condition: listing.condition,
    priceZar: listing.priceZar,
    priceIsFrom: listing.priceIsFrom,
    payMode: listing.payMode,
    swapFor: listing.swapFor,
    description: listing.description,
    handover: listing.handover,
    pickupPointId: listing.pickupPointId,
    campusSlug: listing.campusSlug,
    // A cover whose alt is the title keeps "" ("the title", selling spec 2.5), so it follows a new title.
    photos: [
      { src: listing.image.src, alt: listing.image.alt === listing.title ? "" : listing.image.alt },
      ...listing.morePhotos.map((photo) => ({ ...photo })),
    ],
    createdAt: listing.createdAt,
    // Every sample listing was published when it was listed (selling plan amendment 9.2).
    firstPublishedAt: listing.createdAt,
    updatedAt: listing.createdAt,
  }),
);
