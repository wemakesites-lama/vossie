// The contract tests' world (2b plan decision 18, Task 13): what a scenario needs from a backend, written once and
// implemented twice, by the sample store (tests/contract/sample-world.ts, in `pnpm test`) and by the local Supabase
// stack (tests/db/supabase-world.ts, in `pnpm test:db`). A contract (lib/data/contract/<area>.contract.ts) takes a
// function that makes a world, makes a fresh one before each test and cleans it up after.
//
// It grows per task: each C1 task adds the verbs its scenarios need, on both worlds (hideListing and pauseShop for the
// catalog, retirePickupPoint, addRequest and notificationsOf for requests, addRsvp for the Hub, recordDraw and addPin
// for Featured, keepBadges for the badges). Every verb on the Supabase side records an undo, so the seed is the same
// after each test.

import type { Account, CampusChoice, MatchQuery, StaffRole } from "@/lib/types";

/**
 * The test accounts every world has. On Supabase, `pnpm test:db`'s global setup makes them (contract-<name>@vossie.test),
 * one minted session each per run. "seller" (C2/C3 plan Task 4) is a student on Pretoria with no shop: the selling and
 * messaging scenarios give it one, so an admin never has to be the seller.
 */
export const WORLD_ACCOUNTS = ["asker", "shopper", "staff", "seller"] as const;

export type WorldAccountName = (typeof WORLD_ACCOUNTS)[number];

/** A request a scenario posts (Task 17): the rest is filled in, and it was last changed now. */
export type WorldRequest = { asker: WorldAccountName; title: string; neededBy: string | null };

/** A notification as a scenario checks it. */
export type WorldNotification = { kind: string; subjectId: string; text: string; href: string };

/**
 * A shop a scenario opens for an account (C2/C3 plan Task 8): its name ("Contract <Name>'s shop" when not given), its
 * campus (Pretoria), and its standing. An approved or paused shop has its campus's first pickup point in use, and the
 * Hub approved it now; a waiting one has none.
 */
export type WorldShop = {
  name?: string;
  campus?: string;
  status?: "pending" | "approved" | "paused";
  pausedBy?: "seller" | "staff";
};

/** A one-time form state for a session (C2/C3 plan Task 9): taken or not, running out in an hour unless said. */
export type WorldOnce = { taken?: boolean; expiresInMinutes?: number };

/** A message a scenario puts in a conversation (C2/C3 plan Task 14): unread unless `readAt` is given. */
export type WorldMessage = { side: "buyer" | "seller"; body: string; sentAt: Date; readAt?: Date | null };

/**
 * A conversation a scenario puts in place, as if its messages had been sent (C2/C3 plan Task 14). About a listing
 * (`listingId`), a listing that has gone (`listingTitle` alone), a request (`offerOn`, an offer thread), or else a
 * question to the shop. It started at its first message (or now), and its last activity is its last message. Its
 * status is "offered" for an offer, "replied" once the seller has written, else "asked", unless `status` says.
 */
export type WorldConversation = {
  buyer: WorldAccountName;
  slug: string;
  listingId?: string;
  listingTitle?: string;
  offerOn?: string;
  status?: "offered" | "asked" | "replied";
  messages: readonly WorldMessage[];
};

/**
 * A listing a scenario lists (C4/C5 plan Task 3): an item in the shop's category for R100, collected on campus, unless
 * said. `addListing` puts it in place published and available; `publishListing` publishes it through the real path.
 */
export type WorldListing = {
  title: string;
  categorySlug?: string;
  priceZar?: number;
  description?: string;
  /** Collected at this pickup point (handover "pickup") instead of on campus (C4/C5 plan Task 17). */
  pickupPointId?: string;
};

/** A WorldListing's fields, as saveOwnListing and save_listing take them, in a shop of `categorySlug`. */
export function listingFields(listing: WorldListing, categorySlug: string) {
  return {
    kind: "item" as const,
    title: listing.title,
    categorySlug: listing.categorySlug ?? categorySlug,
    condition: "good" as const,
    priceZar: listing.priceZar ?? 100,
    priceIsFrom: false,
    payMode: "cash" as const,
    swapFor: null,
    description: listing.description ?? "A listing the contract tests list and take away again.",
    handover: listing.pickupPointId ? ("pickup" as const) : ("on-campus" as const),
    pickupPointId: listing.pickupPointId ?? null,
  };
}

/** A search a scenario saves (C4/C5 plan Task 3): browse's query; anything not given is none, the campus every campus. */
export type WorldSearch = Partial<MatchQuery>;

/** What a scenario reports (C4/C5 plan Task 3): a listing, a shop by its link, or a request. */
export type WorldReportTarget = { kind: "listing" | "seller" | "request"; id: string };

export interface World {
  readonly name: "sample" | "supabase";
  /** The account's id, signed in (a profile on Pretoria; "staff" holds the Admin role; "seller" has no shop yet). */
  signedIn(name: WorldAccountName): Promise<string>;
  /**
   * Runs `read` with that account as the viewer, and gives it the account's id. On Supabase, the twins' forViewer()
   * is that account's session for the length of the call; in the sample store, the data layer takes the id itself.
   */
  asViewer<T>(name: WorldAccountName, read: (accountId: string) => Promise<T> | T): Promise<T>;
  /** Hides a listing, as the Hub's Hide does (Task 15). */
  hideListing(id: string, reason: string): Promise<void>;
  /** Pauses an owned shop, by its seller or by the Hub (Task 15). */
  pauseShop(slug: string, by: "seller" | "staff"): Promise<void>;
  /** Saves a listing back as a draft (Task 15). */
  draftListing(id: string): Promise<void>;
  /** That account says it's going to the event (Task 16). */
  addRsvp(postId: string, name: WorldAccountName): Promise<void>;
  /** Takes a post back to a draft (Task 16). */
  unpublishPost(id: string): Promise<void>;
  /** Posts a Looking For request as that account, changed now; its id (Task 17). */
  addRequest(request: WorldRequest): Promise<string>;
  /** That account's notifications, oldest first (Task 17). */
  notificationsOf(name: WorldAccountName): Promise<WorldNotification[]>;
  /** Retires a pickup point (its id in this backend), as the Hub's Retire does (Task 14). */
  retirePickupPoint(id: string): Promise<void>;
  /** Records a campus's Featured row for a day, as featuredFor would have, in this order (Task 18). */
  recordDraw(campus: CampusChoice, day: string, slugs: readonly string[]): Promise<void>;
  /** Pins a seller to a campus's row for a day, as the "staff" account (Task 18). */
  addPin(campus: CampusChoice, day: string, slug: string): Promise<void>;
  /** Takes a shop's Verified tick away, so it can't be featured (Task 18). */
  unverifyShop(slug: string): Promise<void>;
  /** Forgets every Featured row and pin on these days in cleanup, the ones featuredFor records itself too (Task 18). */
  forgetFeaturedDays(days: readonly string[]): Promise<void>;
  /** Puts every shop's badge back as it is now in cleanup, after a test recalculates them (Task 19). */
  keepBadges(): Promise<void>;
  /**
   * In cleanup, removes what this account's selling made during the test, through the data layer or the verbs: a shop
   * it didn't have before (its listings, pickup points and seller profile with it), its wizard draft, and the photos it
   * stored, rows and files. "hub": the Hub's photos the test stored, rows and files, and never another session's file
   * (C2/C3 plan Task 5; fix 4 of the review after C2 and C3).
   */
  tidySelling(owner: WorldAccountName | "hub"): Promise<void>;
  /** Makes a stored photo, by its address, `hours` old (C2/C3 plan Task 5). */
  ageWaitingPhoto(src: string, hours: number): Promise<void>;
  /** Opens a shop for the account, which has none; its link (C2/C3 plan Task 8). Undone in cleanup. */
  openShop(name: WorldAccountName, shop?: WorldShop): Promise<string>;
  /** That account follows the shop (C2/C3 plan Task 9; C4's verb of the same name). */
  follow(follower: WorldAccountName, slug: string): Promise<void>;
  /**
   * Gives the account a notification, as a database function or a TypeScript writer would have (C2/C3 plan Task 9),
   * made now or at `at` (Task 12).
   */
  addNotification(name: WorldAccountName, note: WorldNotification, at?: Date): Promise<void>;
  /**
   * In cleanup, removes the conversations (their messages with them), notifications and reports the test made for the
   * world's accounts, however they were made: through the data layer, the database's own functions or the verbs
   * (C2/C3 plan Tasks 12 to 16). Call it after tidySelling, so it runs before the shops go.
   */
  tidyMessaging(): Promise<void>;
  /** Puts a conversation in place, with its messages; its id (C2/C3 plan Task 14). */
  addConversation(conversation: WorldConversation): Promise<string>;
  /** Adds `count` messages from `side` to a conversation, each sent at `sentAt`, unread (C2/C3 plan Task 15). */
  addMessages(conversationId: string, side: "buyer" | "seller", count: number, sentAt: Date): Promise<void>;
  /**
   * Marks a sale done at `completedAt`, as the seller's Mark as completed would have, the buyer's "sale to confirm"
   * notification included (C2/C3 plan Task 14).
   */
  markDone(conversationId: string, completedAt: Date): Promise<void>;
  /** The conversation's seller has deleted their account (C2/C3 plan Task 14): nobody answers for the shop there. */
  sellerGone(conversationId: string): Promise<void>;
  /**
   * The shop's owner has deleted their account and the shop has gone with it: the conversation is the seller's no
   * more, and its shop row is gone (fix 7 of the review after C2 and C3).
   */
  shopGone(conversationId: string): Promise<void>;
  /** The conversation's buyer has deleted their account (C2/C3 plan Task 14). */
  buyerGone(conversationId: string): Promise<void>;
  /** Hides a request, as the Hub's Hide does (C2/C3 plan Task 14). */
  hideRequest(id: string, reason: string): Promise<void>;
  /**
   * A one-time form state, such as "listing-once:<uuid>" or "staff-once:<uuid>", in the account's session: on Supabase
   * the session the test files were given (C2/C3 plan Task 9; C4/C5 use it as their issueOnceToken). The session key.
   */
  onceRow(name: WorldAccountName, form: string, once?: WorldOnce): Promise<string>;
  /** Gives the account these staff roles, in this order (C4/C5 plan Task 3). Put back as they were in cleanup. */
  setRoles(name: WorldAccountName, roles: readonly StaffRole[]): Promise<void>;
  /** The account as getViewer() gives it: profile, roles and shop (C4/C5 plan Task 3). */
  viewerAccount(name: WorldAccountName): Promise<Account>;
  /** Lists a listing in the shop, published and available now, as buyers see it; its id (C4/C5 plan Task 3). */
  addListing(slug: string, listing: WorldListing): Promise<string>;
  /**
   * Publishes a new listing in the owner's shop for the first time through the real path (C4/C5 plan Task 3): on
   * Supabase save_listing with the owner's session, which tells the followers; in the sample store saveOwnListing, then
   * notifyFollowers, as saveListingForm does. Its id. The listing goes in cleanup (tidySelling, or the store's reset).
   */
  publishListing(owner: WorldAccountName, slug: string, listing: WorldListing): Promise<string>;
  /** An open report by the account about a listing, a shop or a request; its id (C4/C5 plan Task 3). */
  addReport(reporter: WorldAccountName, target: WorldReportTarget): Promise<string>;
  /**
   * Saves a search for the account, made at `at` (now, a millisecond after the last one, unless given), paused or not;
   * its id (C4/C5 plan Task 3).
   */
  saveSearch(name: WorldAccountName, search: WorldSearch, options?: { paused?: boolean; at?: Date }): Promise<string>;
  /** The account follows `count` more shops, each one with no owner made for it (the follow limit, C4/C5 plan Task 7). */
  fillFollows(follower: WorldAccountName, count: number): Promise<void>;
  /** Assigns the shop a mentor, or none (C4/C5 plan Task 3). Put back in cleanup. */
  setMentor(slug: string, mentor: WorldAccountName | null): Promise<void>;
  /** How many entries the audit log has (C4/C5 plan Task 3). */
  auditCount(): Promise<number>;
  /**
   * The shop's owner offers on the request, as Send offer does with no listing (C4/C5 plan Task 5): on Supabase
   * start_offer with the owner's session, in the sample store startOffer. The thread's id.
   */
  addOffer(slug: string, requestId: string, body: string): Promise<string>;
  /**
   * A shop that has gone made an offer on the request (C4/C5 plan Task 5, amendment 8): an account made for the test,
   * never a world one, opens a shop, offers, the asker answers (so the thread outlives the seller, as deletion keeps a
   * conversation only while the other side has written in it), and the account is deleted through the backend's own
   * deletion (forget_account, or the sample's deleteAccountData). The thread's id.
   */
  offerFromGoneShop(requestId: string, body: string): Promise<string>;
  /**
   * In cleanup, removes the requests, follows and saved searches the world's accounts made during the test, however
   * they were made (the data layer, a database function or a verb), with the notifications about them (C4/C5 plan
   * Tasks 4 to 8). Call it first in a test, so it runs after the other undos.
   */
  tidyCommunity(): Promise<void>;
  /**
   * In cleanup, removes the pickup points the test added, however they were made (the data layer, a staff function or a
   * verb), with any listing's use of them (C4/C5 plan Tasks 13 and 17). Call it first in a test, so it runs last.
   */
  tidyPickupPoints(): Promise<void>;
  /** Deletes a listing, as its seller's Delete does (C4/C5 plan Task 15). Reports about it keep their recorded owner. */
  deleteListing(id: string): Promise<void>;
  /**
   * The shop goes, with its listings, as its owner's account deletion takes it: reports about it or its listings point at
   * nothing from then on, and its Featured pins go (C4/C5 plan Task 15). The test's own shop only.
   */
  closeShop(slug: string): Promise<void>;
  /**
   * In cleanup, removes what the test made in the staff tools, however it was made (the data layer, a staff function or
   * a verb): new Hub posts (their RSVPs and slot requests with them), the world's accounts' RSVPs and slot requests on
   * other posts, and mentors' notes and check-ins (C4/C5 plan Tasks 18 and 19); and the world's accounts' roles go back
   * to what they were (Task 20). The audit log keeps its entries: it has no delete. Tests edit only posts they made.
   * Call it first in a test, so it runs last.
   */
  tidyStaffTools(): Promise<void>;
  /** Whether a stored photo is still kept: its row, and on Supabase its file too (C4/C5 plan Task 18). */
  photoStored(src: string): Promise<boolean>;
  /**
   * The admin role for these accounts only: every other account loses it, and these get it (C4/C5 plan Task 20, the
   * last admin). Put back in cleanup.
   */
  onlyAdmins(names: readonly WorldAccountName[]): Promise<void>;
  /**
   * What happened at `at`, for the admin's numbers (C4/C5 plan Task 21): a request by "asker" on Pretoria, "asker"
   * following the shop, and a report by "seller" on that request, closed at `closedAt`. Undone in cleanup.
   */
  addPastActivity(slug: string, at: Date, closedAt: Date): Promise<void>;
  /** Undoes what the test's verbs wrote, newest first. Runs after each test. */
  cleanup(): Promise<void>;
}
