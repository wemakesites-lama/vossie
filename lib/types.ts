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
  /** True once the Hub has retired it (staff tools spec 2.3): listings keep it, marked "no longer used". */
  retired?: boolean;
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
  /**
   * The SAST date it closes by itself from (stage L spec decision 10), or null for a sample request. A function of the
   * stored row, so a cached copy is never wrong about it; whether it's open today is `requestOpenOn`.
   */
  closesOn: string | null;
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

// --- Messaging (messaging plan, Task 1) -------------------------------------------------------------------------

/**
 * Where a conversation stands (messaging spec 2.5): asked, the seller replied, marked done, the sale confirmed. An
 * offer on a Looking For request starts "offered" and becomes "replied" when the asker writes back (community actions
 * spec 2.7 and 2.12).
 */
export type ConversationStatus = "offered" | "asked" | "replied" | "done" | "confirmed";

/** The inbox's two tabs (messaging spec 2.10). */
export type InboxTab = "buying" | "selling";

/** Why something was reported (messaging spec 2.8). */
export type ReportReason = "scam" | "prohibited" | "misleading" | "offensive" | "harassment" | "spam" | "other";

/** What can be reported: a listing (by id), a seller (by slug) or a request (by id) (messaging spec 2.8). */
export type ReportTarget = { kind: "listing" | "seller" | "request"; id: string };

/**
 * What a notification is about (messaging spec 2.9; staff tools plan decision 7). Messaging makes the first two; the
 * staff tools make the rest: a report's outcome, a shop's approval, the Hub's other decisions about a shop or a
 * listing ("shop-update"), and slot requests ("booking"). Community actions add an offer on your request, the Hub's
 * update about your request, and a followed shop's new listing (community actions plan decision 14).
 * Saved-search alerts add a saved search's new match (search alerts spec 2.12).
 * Staff accounts add a staff role given or taken away (stage J spec decision 7).
 */
export type NotificationKind =
  | "message"
  | "sale-to-confirm"
  | "report-handled"
  | "shop-approved"
  | "shop-update"
  | "booking"
  | "offer"
  | "request-update"
  | "new-listing"
  | "search-match"
  | "staff-role";

/** The shop a conversation is with, as a thread shows it. `image` and `campusSlug` are null once the shop has gone. */
export type ConversationShop = {
  slug: string;
  name: string;
  image: ImageRef | null;
  campusSlug: string | null;
};

/** A row in the inbox (messaging spec 3.2), from the viewer's side. */
export type ConversationSummary = {
  id: string;
  role: "buyer" | "seller";
  /** The shop's name to the buyer, the buyer's first name to the seller (spec 2.11), or "Deleted account". */
  otherName: string;
  /** The listing's title, or null for a question about the shop (messaging plan decision 2). */
  listingTitle: string | null;
  /** The request an offer answers (community actions spec 2.7), or null for any other conversation. */
  requestTitle: string | null;
  /** The listing's photo, or the shop's for a question about the shop. Null once the listing has gone. */
  image: ImageRef | null;
  /** The last message's first line. */
  preview: string;
  lastFromViewer: boolean;
  /** ISO 8601 in UTC. */
  lastMessageAt: string;
  status: ConversationStatus;
  /** The other side has written something the viewer hasn't opened. */
  unread: boolean;
};

/** One message in a thread (messaging spec 3.3). */
export type ThreadMessage = {
  id: string;
  fromViewer: boolean;
  /** "You", or the other side's name (messaging spec section 5). */
  author: string;
  body: string;
  swapOffer: string | null;
  sentAt: string;
};

/** A thread, from the viewer's side (messaging spec 3.3). */
export type Thread = {
  id: string;
  role: "buyer" | "seller";
  otherName: string;
  /** False once the other side has deleted their account (messaging plan decision 21). */
  otherPresent: boolean;
  shop: ConversationShop;
  /** The listing's title when the conversation started, or null for a question about the shop. */
  listingTitle: string | null;
  /** The listing as it is now: null for a question about the shop, or once the listing has gone (stage F). */
  listing: Listing | null;
  /**
   * The request an offer answers, or null for any other conversation (community actions spec 2.7). `live` is false
   * once its page has gone (deleted or hidden), and the thread then says so (plan decision 8). `hidden` is true when
   * it is the Hub that hid it, which the asker is told (plan amendment 19.4).
   */
  request: { id: string; title: string; live: boolean; hidden: boolean } | null;
  status: ConversationStatus;
  completedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: "buyer" | "auto" | null;
  /** Oldest first. */
  messages: ThreadMessage[];
};

/** A notification as `/notifications` shows it (messaging spec 3.5). */
export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  text: string;
  href: string;
  createdAt: string;
  /** Not read before this visit. */
  isNew: boolean;
};

/** One of the account's reports, for privacy settings (messaging plan decision 18). */
export type ReportSummary = {
  kind: ReportTarget["kind"];
  title: string;
  reason: ReportReason;
  createdAt: string;
  open: boolean;
};

/** What needs the account's attention (messaging spec 4, `unreadCounts`). */
export type UnreadCounts = {
  /** New notifications: the header's badge and the account page. */
  notifications: number;
  /** Conversations with a message the account hasn't opened: the account page's Messages row. */
  conversations: number;
  /** Messages the account hasn't opened: the homepage's strip. */
  messages: number;
  /** Sales a seller marked done that the account, as the buyer, hasn't confirmed: the strip. */
  salesToConfirm: number;
};

// --- Selling (selling plan, Task 1) -------------------------------------------------------------------------------

/** A listing as its seller sees it (selling spec 2.9, plan decision 3): a draft, or available, paused or sold. */
export type ListingState = "draft" | Availability;

/** My listings' tabs (selling spec 2.9). */
export type ListingsTab = "available" | "paused" | "sold" | "drafts";

/** The photo files the server takes (selling spec 2.3), by their real signature. */
export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

/** Enquiries and sales over a stretch of time, from a shop's conversations (selling spec 2.8, plan decision 18). */
export type EnquiryCounts = {
  /** Buyers' first messages about a listing. */
  enquiries: number;
  /** Enquiries answered within 48 hours, or older than 48 hours: the ones the reply rate counts. */
  due: number;
  /** Enquiries the shop first answered within 48 hours. */
  repliedInTime: number;
  /** Sales the buyer confirmed, or that confirmed themselves 7 days after the seller marked them done. */
  salesConfirmed: number;
};

/** The dashboard's numbers (selling spec 2.8). */
export type ShopStats = {
  /** The last 7 days. */
  week: EnquiryCounts;
  /** Enquiries over the last 90 days and sales over the shop's whole life: the trust page's badge rules. */
  record: EnquiryCounts;
};

// --- Staff tools (staff tools plan, Task 1) ------------------------------------------------------------------------

/** The three staff areas (staff tools spec 2.1): the admin console, the Hub's tools and the mentor dashboard. */
export type StaffArea = "admin" | "hub" | "mentor";

/** What a staff action did (staff tools spec 2.2): one per audit entry. */
export type AuditAction =
  | "shop-approved"
  | "shop-declined"
  | "shop-verified"
  | "shop-unverified"
  | "shop-paused"
  | "shop-resumed"
  | "mentor-assigned"
  | "mentor-removed"
  | "report-dismissed"
  | "listing-hidden"
  | "request-hidden"
  | "featured-pinned"
  | "featured-unpinned"
  | "point-added"
  | "point-renamed"
  | "point-retired"
  | "point-restored"
  | "post-created"
  | "post-updated"
  | "booking-accepted"
  | "booking-declined"
  | "note-added"
  | "check-in-added"
  | "role-given"
  | "role-removed"
  | "listing-shown"
  | "request-shown";

/** The audit log's filter by kind (staff tools spec 2.3). Each action belongs to one (lib/staff/audit-words.ts). */
export type AuditKind =
  | "shops"
  | "reports"
  | "featured"
  | "pickup-points"
  | "posts"
  | "office-hours"
  | "mentoring"
  | "staff";

/** What an audit entry is about. */
export type AuditTargetKind = "shop" | "listing" | "report" | "pickup-point" | "post" | "booking" | "request" | "account";

/** One line of the audit log (staff tools spec 2.2): who, what, the target, the reason or detail, and when. */
export type AuditEntry = {
  id: string;
  /** ISO 8601 in UTC; shown in SAST. */
  at: string;
  /** The staff member's account, or null once it's deleted. */
  staffId: string | null;
  /** Their first name when they acted, or "Deleted account". */
  staffName: string;
  action: AuditAction;
  targetKind: AuditTargetKind;
  /** The target's name when it happened ("Tech corner", a listing's title), or "Deleted account" (plan decision 6). */
  targetName: string;
  /** The reason or note, or "" when there was none. */
  detail: string;
};

/** What the Hub did about a report (staff tools spec 2.3). */
export type ReportOutcome = "dismissed" | "hidden" | "paused";

/** Where a slot request stands (staff tools spec 2.4 and 2.5). */
export type BookingStatus = "open" | "accepted" | "declined";

/** A slot request, as the office-hours queue and the student's booking page show it (plan decisions 13 and 14). */
export type HubBooking = {
  id: string;
  postId: string;
  /** The office hours' title. */
  postTitle: string;
  /** When the office hours start, ISO 8601 in UTC. */
  startsAt: string | null;
  /** The student's first name, or "Deleted account". */
  studentName: string;
  /** What they'd like help with, up to 300 characters. */
  help: string;
  /** A time that suits, up to 100 characters. */
  time: string;
  status: BookingStatus;
  createdAt: string;
};

/** A mentor's flags on a shop (staff tools spec 2.6, plan decision 15). */
export type MentorFlag = "no-enquiries" | "slow-replies" | "paused";

/** A row of the mentor dashboard (staff tools spec 2.6, plan decision 15). */
export type MentoredShop = {
  slug: string;
  name: string;
  campusSlug: string;
  /** The owner's first name. */
  ownerName: string;
  /** The owner's account, which notes and check-ins are about (plan decision 16). */
  ownerId: string;
  badge: TrustBadge | null;
  status: SellerStatus;
  /** Who paused the shop, when it is paused: its seller, or the Hub (whose pause hides its storefront, amendment 13.2). */
  pausedBy: "seller" | "staff" | null;
  mentorId: string;
  mentorName: string;
  /** The last 14 days (plan decision 15). */
  counts: EnquiryCounts;
  flags: MentorFlag[];
};

// --- Community actions (community actions plan, Task 1) -----------------------------------------------------------

/** Where one of the asker's own requests stands (community actions spec 2.6 and 2.14). */
export type RequestState = "open" | "closed" | "hidden";

/** One of the asker's own requests, for its page's panel and Your requests (community actions spec 2.13). */
export type OwnRequest = {
  /** As the board shows it, with the offers count worked out now. */
  request: LookingForRequest;
  state: RequestState;
  /** The Hub's reason, once it has hidden it. */
  hiddenReason: string | null;
};

/** One offer on a request, as its asker sees it (community actions spec 2.13). */
export type OfferSummary = {
  conversationId: string;
  /** The shop's name, or "A closed shop" once it has gone. */
  shopName: string;
  /** The offer's first line, or "" once the shop has left. */
  preview: string;
  /** When the shop offered, ISO 8601 in UTC. */
  offeredAt: string;
};

/** A shop the account follows, as Saved's Shops tab shows it (community actions spec 2.17). */
export type FollowedShop = {
  slug: string;
  name: string;
  campusSlug: string;
  image: ImageRef;
  /** Paused by its seller or by the Hub: the card says "Paused". */
  paused: boolean;
  /**
   * Whether its storefront page is up. False for a shop the Hub paused (its page is the 404), so the card doesn't
   * link there but still offers Unfollow (plan amendment 17.6).
   */
  storefront: boolean;
  /** How many of its listings buyers can see now. */
  listed: number;
};

// --- Saved-search alerts (search alerts plan, Task 1) -------------------------------------------------------------

/**
 * What a listing is matched against (search alerts spec 2.1 and 2.2, plan decision 2): browse's search without its
 * order. The browse page's query is one, and so is a saved search.
 */
export type MatchQuery = Omit<SearchQuery, "sort">;

/** Whether this account can save the browse page's search (search alerts spec 2.6). */
export type SaveSearchState = "new" | "saved" | "limit";

/** One of the account's saved searches, as Saved's Searches tab shows it (search alerts spec 2.7). */
export type SavedSearchItem = {
  id: string;
  /** "“calculator” in Tech at Midrand, under R100" (spec 2.3). */
  label: string;
  /** Its results, with the campus pinned. */
  href: string;
  /** When it was saved, ISO 8601 in UTC. */
  savedAt: string;
  paused: boolean;
};
