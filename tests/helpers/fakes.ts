import type { SignInAttemptRow } from "@/lib/data/rows";
import type { BrowseQuery, ConversationSummary, Listing, Seller } from "@/lib/types";

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

/** A seller for tests: an unverified Midrand tech seller with no badge. Override what the test is about. */
export function makeSeller(overrides: Partial<Seller> = {}): Seller {
  return {
    slug: "test-seller",
    name: "Test seller",
    tagline: "A test tagline.",
    category: "Tech",
    categorySlug: "tech",
    campusSlug: "midrand",
    verified: false,
    badge: null,
    about: "A test seller.",
    since: "2026-03",
    image: { src: "/placeholders/seller/tech-corner.svg", alt: "The test seller at work" },
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

/** A sign-in attempt for tests: on step 1, with no errors, and running out in 2099. Override what the test is about. */
export function makeSignInAttempt(overrides: Partial<SignInAttemptRow> = {}): SignInAttemptRow {
  return {
    key: "attempt-key",
    step: "email",
    email: "",
    errors: [],
    resent: false,
    codeHash: null,
    codeExpiresAt: null,
    wrongTries: 0,
    consentedAt: null,
    firstName: "",
    campusSlug: "",
    postedAt: null,
    expiresAt: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** An inbox row for tests: an unread-free "Asked" question about a test listing. Override what the test is about. */
export function makeSummary(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: "conv-test",
    role: "buyer",
    otherName: "Tech corner",
    listingTitle: "Test listing",
    image: { src: "/placeholders/listing/tech.svg", alt: "Test listing" },
    preview: "Is it still available?",
    lastFromViewer: false,
    lastMessageAt: "2026-10-14T10:00:00Z",
    status: "asked",
    unread: false,
    ...overrides,
  };
}
