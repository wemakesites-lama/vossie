import type { ListingState, SellerQueue } from "@/lib/types";
import type { CoachKind } from "./kinds";

// Shop coach's shapes (AI round two spec 2 and 4). Pure types: lib/coach's rules, lib/data/coach*.ts and the cards.

/** What an action is about. `id` is null for the shop itself. */
export type CoachTarget = { type: "shop" | "listing" | "request" | "post"; id: string | null };

/** The numbers behind a candidate (spec 2.1): the fixed wording fills from them, and I2's check allows only them. */
export type Evidence = Readonly<Record<string, number>>;

export type Candidate = {
  /** "{kind}:{target id or shop}" (planning decision 1). */
  id: string;
  kind: CoachKind;
  target: CoachTarget;
  /** What the target is called (a listing's, request's or post's title), or null for the shop. */
  name: string | null;
  evidence: Evidence;
  /** The one link that does it (spec 2). */
  href: string;
};

/** A stored action: a candidate with its words, and when its facts were read (planning decision 4). */
export type CoachAction = Candidate & { title: string; why: string; asOf: string };

export type ActionState = "done" | "open" | "gone";

/** A week as its reader gets it. `mentorQuestions` only ever reaches staff (I2). */
export type CoachWeek = {
  week: string;
  actions: CoachAction[];
  writtenBy: "model" | "fixed";
  /** The ids done, and gone, when the week was settled, or null until then (planning decision 10). */
  doneIds: string[] | null;
  goneIds: string[] | null;
  settledAt: string | null;
  createdAt: string;
  /** The seller's ticks that week. */
  ticks: string[];
};

/** One of the shop's available, shown listings, as the candidate rules read it. */
export type FactListing = {
  id: string;
  title: string;
  categorySlug: string;
  priceZar: number | null;
  priceIsFrom: boolean;
  photos: number;
  descriptionChars: number;
  updatedAt: string;
  /** The newest enquiry about it (a buyer's first message; offers aren't enquiries), or null. */
  lastEnquiryAt: string | null;
  /** The prices of similar available listings elsewhere (planning decision 6). */
  similarPrices: number[];
};

export type FactPost = {
  id: string;
  kind: "event" | "office-hours" | "tip";
  title: string;
  campusSlug: string;
  startsAt: string | null;
  publishedAt: string;
};

/** What a week is planned from (spec 2.1). Read at `asOf`. */
export type ShopFacts = {
  asOf: string;
  shop: { slug: string; campusSlug: string; categorySlug: string; about: string; hasPhoto: boolean };
  queue: Pick<SellerQueue, "replies" | "sales" | "listings">;
  listings: FactListing[];
  /** Open requests the matcher pairs with the shop, best first; the seller's own and offered ones left out. */
  requests: { id: string; title: string; via: "listing" | "category" }[];
  /** Published events and office hours from today on, soonest first, and tips, newest first. */
  posts: FactPost[];
  /** Posts the owner has an RSVP or a slot request for. */
  booked: readonly string[];
  /** Tips ticked in the last 12 weeks (planning decision 9). */
  tickedTips: readonly string[];
};

export type LiveListing = {
  state: ListingState;
  hidden: boolean;
  photos: number;
  descriptionChars: number;
  priceZar: number | null;
  updatedAt: string;
};

/** What done states are worked out from (spec 4: live, so always current). */
export type LiveFacts = {
  queue: Pick<SellerQueue, "replies" | "sales" | "listings">;
  shop: { about: string; hasPhoto: boolean };
  /** By id; a deleted listing is absent. */
  listings: ReadonlyMap<string, LiveListing>;
  offered: ReadonlySet<string>;
  openRequests: ReadonlySet<string>;
  booked: ReadonlySet<string>;
  /** Published posts asked about, and which of them have passed (SAST day before today). */
  publishedPosts: ReadonlySet<string>;
  passedPosts: ReadonlySet<string>;
};
