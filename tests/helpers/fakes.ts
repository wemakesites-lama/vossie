import type { BrowseQuery, Listing } from "@/lib/types";

/** A listing for tests: an available R100 tech item at Midrand's library. Override what the test is about. */
export function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "l-test",
    title: "Test listing",
    priceZar: 100,
    priceIsFrom: false,
    payMode: "cash",
    campusSlug: "midrand",
    image: { src: "/placeholders/listing/tech.svg", alt: "Test listing" },
    badge: null,
    createdAt: "2026-10-10T10:00:00Z",
    kind: "item",
    categorySlug: "tech",
    sellerSlug: "tech-corner",
    morePhotos: [],
    description: "A test listing.",
    condition: "good",
    handover: "pickup",
    pickupPointId: "pp-midrand-library",
    swapFor: null,
    availability: "available",
    ...overrides,
  };
}

/** A browse query for tests: every campus, no filters, newest first, 24 shown. */
export function makeBrowseQuery(overrides: Partial<BrowseQuery> = {}): BrowseQuery {
  return {
    q: null,
    category: null,
    campus: "all",
    campusFromLink: false,
    price: null,
    pay: null,
    deals: null,
    sort: "new",
    shown: 24,
    ...overrides,
  };
}
