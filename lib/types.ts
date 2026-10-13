// Shapes follow the future Supabase tables (spec section 13).

export type ImageRef = {
  src: string;
  alt: string;
};

export type Campus = {
  slug: string;
  name: string;
  /** Province, or "Online, anywhere in SA" for Eduvos Online. */
  region: string;
  liveListings: number;
  image: ImageRef;
};

export type Category = {
  slug: string;
  name: string;
  image: ImageRef;
};

export type Announcement = {
  id: string;
  tag: string;
  text: string;
  href: string;
};

/** Trending search terms keyed by campus slug, plus "all" for every campus. */
export type TrendingSearches = Readonly<Record<string, readonly string[]>>;

/** "all" or a campus slug. */
export type CampusChoice = string;

export type HeroSlide = {
  id: string;
  /** The word that changes in the headline: "Buy & sell {word} on campus". */
  word: string;
  body: string;
  cta: { label: string; href: string };
  image: ImageRef;
};

export type Collection = {
  slug: string;
  eyebrow: string;
  title: string;
  image: ImageRef;
};

export type PayMode = "cash" | "swap" | "both";

export type TrustBadge = "trusted" | "responsive" | "new-seller";

export type ListingKind = "item" | "service";

export type Condition = "new" | "like-new" | "good" | "fair";

/** How an item changes hands or a service happens (browse and listing spec 5.3). */
export type Handover = "pickup" | "on-campus" | "on-campus-or-online" | "online";

export type Availability = "available" | "paused" | "sold";

export type Listing = {
  id: string;
  title: string;
  /** Rand. 0 for a free item; null when the item is swap-only. */
  priceZar: number | null;
  /** True for prices shown as "From R400" (services). */
  priceIsFrom: boolean;
  payMode: PayMode;
  campusSlug: string;
  /** The cover photo. */
  image: ImageRef;
  badge: TrustBadge | null;
  /** ISO 8601 in UTC, e.g. "2026-10-12T07:40:00Z". */
  createdAt: string;
  kind: ListingKind;
  categorySlug: string;
  sellerSlug: string;
  /** Up to five more photos after the cover. */
  morePhotos: readonly ImageRef[];
  /** The seller's own words. Line breaks are kept on the page. */
  description: string;
  /** Null for services. */
  condition: Condition | null;
  handover: Handover;
  /** Set only when the handover is "pickup": one of the listing campus's pickup points. */
  pickupPointId: string | null;
  /** What the seller would swap for. Set only when the pay mode is "swap" or "both". */
  swapFor: string | null;
  availability: Availability;
};

export type Seller = {
  slug: string;
  name: string;
  tagline: string;
  /** The category as shown, e.g. "Hair & beauty". */
  category: string;
  campusSlug: string;
  verified: boolean;
  image: ImageRef;
};

/** An agreed place on campus where items change hands (browse and listing spec 6.1). */
export type PickupPoint = {
  id: string;
  campusSlug: string;
  name: string;
};

/** Everything the listing page needs, looked up once (spec 6.1). */
export type ListingDetail = {
  listing: Listing;
  seller: Seller;
  category: Category;
  campus: Campus;
  pickupPoint: PickupPoint | null;
};

export type LookingForRequest = {
  id: string;
  title: string;
  campusSlug: string;
  offers: number;
};

export type FreeSwapItem = {
  id: string;
  kind: "free" | "swap";
  title: string;
  campusSlug: string;
  image: ImageRef;
};

export type HubEvent = {
  id: string;
  /** YYYY-MM-DD in South African time. */
  date: string;
  title: string;
  /** A campus slug, or "all" for an every-campus event. */
  campusSlug: string;
  action: "rsvp" | "book";
};

export type HubBanner = { image: ImageRef };

export type ViewerActivity = {
  newMessages: number;
  salesToConfirm: number;
  savedItemsBack: number;
};

/** Who is looking (spec section 13). No accounts exist yet, so `signedIn` is a development switch. */
export type Viewer = {
  campus: CampusChoice;
  signedIn: boolean;
  activity: ViewerActivity | null;
};

/** What a listing page needs, for regular listings and free and swap items alike. */
export type ListingSummary = {
  id: string;
  title: string;
  campusSlug: string;
  image: ImageRef;
};
