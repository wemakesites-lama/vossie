// The contract tests' world (2b plan decision 18, Task 13): what a scenario needs from a backend, written once and
// implemented twice, by the sample store (tests/contract/sample-world.ts, in `pnpm test`) and by the local Supabase
// stack (tests/db/supabase-world.ts, in `pnpm test:db`). A contract (lib/data/contract/<area>.contract.ts) takes a
// function that makes a world, makes a fresh one before each test and cleans it up after.
//
// It grows per task: each C1 task adds the verbs its scenarios need, on both worlds (hideListing and pauseShop for the
// catalog, retirePickupPoint, addRequest and notificationsOf for requests, addRsvp for the Hub, recordDraw and addPin
// for Featured, keepBadges for the badges). Every verb on the Supabase side records an undo, so the seed is the same
// after each test.

import type { CampusChoice } from "@/lib/types";

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
   * stored, rows and files. "hub": the Hub's photos (C2/C3 plan Task 5).
   */
  tidySelling(owner: WorldAccountName | "hub"): Promise<void>;
  /** Makes a stored photo, by its address, `hours` old (C2/C3 plan Task 5). */
  ageWaitingPhoto(src: string, hours: number): Promise<void>;
  /** Opens a shop for the account, which has none; its link (C2/C3 plan Task 8). Undone in cleanup. */
  openShop(name: WorldAccountName, shop?: WorldShop): Promise<string>;
  /** That account follows the shop (C2/C3 plan Task 9; C4's verb of the same name). */
  follow(follower: WorldAccountName, slug: string): Promise<void>;
  /** Gives the account a notification, as a database function or a TypeScript writer would have (C2/C3 plan Task 9). */
  addNotification(name: WorldAccountName, note: WorldNotification): Promise<void>;
  /**
   * A one-time form state, such as "listing-once:<uuid>" or "staff-once:<uuid>", in the account's session: on Supabase
   * the session the test files were given (C2/C3 plan Task 9; C4/C5 use it as their issueOnceToken). The session key.
   */
  onceRow(name: WorldAccountName, form: string, once?: WorldOnce): Promise<string>;
  /** Undoes what the test's verbs wrote, newest first. Runs after each test. */
  cleanup(): Promise<void>;
}
