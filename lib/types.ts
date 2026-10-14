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
  /** One sentence under the title (shopping spec 7.2). */
  intro: string;
  rule: CollectionRule;
};

/** Browse's price caps, in rand (browse and listing spec 4.9). Browse reads them from links as ?max=50 and so on. */
export type PriceCap = 50 | 100 | 250 | 500;

/** Which listings a collection shows (shopping spec 6.1), like a saved browse: these categories, under an optional cap. */
export type CollectionRule = {
  categories: readonly string[];
  maxPrice?: PriceCap;
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
  /** The same category's slug, for links (shopping spec 6.1). */
  categorySlug: string;
  campusSlug: string;
  verified: boolean;
  /** The seller's trust badge. Each of their listings shows the same one (shopping spec 6.1). */
  badge: TrustBadge | null;
  /** Two or three sentences in the seller's own words. Line breaks are kept on the page. */
  about: string;
  /** YYYY-MM: the month they started selling. */
  since: string;
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

/** Whether a request still takes offers (community spec 4.3). */
export type RequestStatus = "open" | "closed";

/** A Looking For request (community spec 4.3). It never names the asker (community spec decision 2). */
export type LookingForRequest = {
  id: string;
  title: string;
  campusSlug: string;
  offers: number;
  /** Two or three sentences in the asker's words. Line breaks are kept on the page. */
  details: string;
  categorySlug: string;
  /** Rand, or null for "open to offers". */
  budgetZar: number | null;
  swapWelcome: boolean;
  /** YYYY-MM-DD in South African time, or null. */
  neededBy: string | null;
  /** ISO 8601 in UTC, e.g. "2026-10-13T07:30:00Z". */
  createdAt: string;
  status: RequestStatus;
};

export type FreeSwapItem = {
  id: string;
  kind: "free" | "swap";
  title: string;
  campusSlug: string;
  image: ImageRef;
};

/** What's on's row on the homepage (spec 7.13), derived from a Hub post (community spec 5.3). */
export type HubEvent = {
  /** The post's id, so the row links to its page. */
  id: string;
  /** YYYY-MM-DD in South African time. */
  date: string;
  title: string;
  /** A campus slug, or "all" for an every-campus event. */
  campusSlug: string;
  action: "rsvp" | "book";
};

export type HubBanner = { image: ImageRef };

export type HubPostKind = "event" | "office-hours" | "tip";

/** A post in the Incubation Hub's feed (community spec 5.3): an event, office hours or a tip. */
export type HubPost = {
  id: string;
  kind: HubPostKind;
  /** Up to 70 characters. */
  title: string;
  /** A campus slug, or "all" for every campus. Tips are "all". */
  campusSlug: string;
  /** ISO 8601 in UTC: when the Hub posted it. */
  publishedAt: string;
  /** ISO 8601 in UTC, for events and office hours; null for tips. */
  startsAt: string | null;
  /** Where it happens, e.g. "The Hub, Block C"; null for tips. */
  place: string | null;
  /** How many places an event has; null for office hours and tips. */
  capacity: number | null;
  /** How many have said they're going to an event; null for office hours and tips. */
  going: number | null;
  /** One sentence, for cards and link previews. */
  summary: string;
  /** The markdown subset (community spec decision 9), up to 4,000 characters. */
  body: string;
  /** The cover photo. Decorative: the title says what the post is. */
  image: ImageRef;
};

export type ViewerActivity = {
  newMessages: number;
  salesToConfirm: number;
  savedItemsBack: number;
};

/**
 * Who is looking (spec section 13): the chosen campus, whether they're signed in, and the activity worth a "Welcome
 * back" strip, or null when there's none (accounts spec 2.9 and 3.4).
 */
export type Viewer = {
  campus: CampusChoice;
  signedIn: boolean;
  activity: ViewerActivity | null;
};

/** What a Hub staff member can do on top of being a student (accounts spec 2.9). */
export type StaffRole = "mentor" | "admin";

/** Where a student's shop stands (accounts spec 2.9, selling spec 7). */
export type SellerStatus = "pending" | "approved" | "paused";

export type SellerProfile = {
  status: SellerStatus;
  /** The storefront's slug, once the shop has one. A shop waiting for approval has none yet. */
  sellerSlug: string | null;
};

/** A signed-in student (accounts spec 2.9). Every account is a student; some also sell, mentor or run Vossie. */
export type Account = {
  id: string;
  /** Lower case. Never shown to other students (messaging spec 2.11). */
  email: string;
  firstName: string;
  campusSlug: string;
  roles: readonly StaffRole[];
  seller: SellerProfile | null;
  /** ISO 8601 in UTC. */
  createdAt: string;
};

/** A record that the student agreed to the privacy policy (accounts spec 2.7). */
export type Consent = {
  /** The policy's version, e.g. "2026-10-draft". */
  version: string;
  /** ISO 8601 in UTC. */
  agreedAt: string;
};

/** A listing page's "More from" row (spec 5.7): the seller's other listings, or the same category's. */
export type MoreFrom = {
  from: "seller" | "category";
  items: readonly Listing[];
};

export type PriceFilter = "free" | "under-50" | "under-100" | "under-250" | "under-500";

export type PayFilter = "cash" | "swap";

export type BrowseSort = "match" | "new" | "price-low" | "price-high";

/** A browse page's whole state, read from its link (browse and listing spec 3.2). */
export type BrowseQuery = {
  q: string | null;
  category: string | null;
  /** A campus slug, or "all". */
  campus: CampusChoice;
  /** Whether the campus came from the link, rather than from the viewer's chosen campus. */
  campusFromLink: boolean;
  price: PriceFilter | null;
  pay: PayFilter | null;
  deals: "free-and-swaps" | null;
  sort: BrowseSort;
  /** How many results to show: 24, 48 … 240. */
  shown: number;
};

/** What a search needs: the query without the paging or where the campus came from (spec 6.3). */
export type SearchQuery = Omit<BrowseQuery, "shown" | "campusFromLink">;

export type SearchResult = {
  /** Every match, filtered and sorted. */
  items: readonly Listing[];
  /** How many match at other campuses, when the query is for one campus. Otherwise 0. */
  elsewhere: number;
};
