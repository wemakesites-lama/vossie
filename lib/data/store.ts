import { sampleAccounts, sampleConsents } from "@/data/fixtures/accounts";
import { sampleConversations, sampleMessages, sampleNotifications } from "@/data/fixtures/messages";
import { sampleListingRows, sampleSellerRows } from "@/data/fixtures/shops";
import { sampleHubBookings, sampleHubPostRows, sampleMentorNotes, samplePickupPointRows } from "@/data/fixtures/staff";
import type {
  AccountRow,
  AuditRow,
  ConsentRow,
  ConversationRow,
  FeaturedDrawRow,
  FeaturedPinRow,
  FormStateRow,
  HubBookingRow,
  HubPostRow,
  HubRsvpRow,
  ListingRow,
  MentorNoteRow,
  MessageRow,
  NotificationRow,
  OnboardingDraftRow,
  PhotoRow,
  PickupPointRow,
  ReportRow,
  SampleEmailRow,
  SellerProfileRow,
  SellerRow,
  SessionRow,
  SignInAttemptRow,
} from "./rows";

/**
 * The sample store (accounts spec 2.1 and section 4), standing in for Supabase until there's a backend: one per server
 * process, seeded from the fixtures, gone when the server restarts. It lives on globalThis because each route, Server
 * Action and route handler may load this module separately, and they must all see the same data. Only lib/data reads
 * or writes it.
 *
 * Each table is a Map keyed by its primary key. To add one (stages E to G), follow the accounts plan's "Store design":
 * a row type in rows.ts, a field here, its seed in seedStore(), and a bump of STORE_VERSION.
 */
export type SampleStore = {
  version: number;
  /** By id. */
  accounts: Map<string, AccountRow>;
  /** By account id. */
  sellerProfiles: Map<string, SellerProfileRow>;
  /** By id. */
  consents: Map<string, ConsentRow>;
  /** By the SHA-256 of the session cookie's token. */
  sessions: Map<string, SessionRow>;
  /** By the SHA-256 of the sign-in cookie's token. */
  signInAttempts: Map<string, SignInAttemptRow>;
  /** Email → when codes were sent to it, for the limit of 5 an hour (spec 5). */
  codeSends: Map<string, string[]>;
  /** By attempt key: sample mode's outbox (spec 2.3). */
  sampleEmails: Map<string, SampleEmailRow>;
  /** By `${sessionKey}:${form}`. */
  formStates: Map<string, FormStateRow>;
  /** By id: a buyer's conversation with a shop (messaging spec section 4). */
  conversations: Map<string, ConversationRow>;
  /** By id. */
  messages: Map<string, MessageRow>;
  /** By id: reports, for stage G's queue. */
  reports: Map<string, ReportRow>;
  /** By id. */
  notifications: Map<string, NotificationRow>;
  /** By slug: every shop's details (selling spec 2.1). Its status is on its owner's seller profile (plan decision 1). */
  sellers: Map<string, SellerRow>;
  /** By id: every listing, drafts included. */
  listings: Map<string, ListingRow>;
  /** By id: uploaded photos (selling spec 2.4). */
  photos: Map<string, PhotoRow>;
  /** By account id: the onboarding wizard's answers so far (selling spec 2.2). */
  onboardingDrafts: Map<string, OnboardingDraftRow>;
  /** By id: every staff action (staff tools spec 2.2). Only lib/data/audit.ts adds to it. */
  auditLog: Map<string, AuditRow>;
  /** By id: sellers pinned to a campus's Featured row for a day (staff tools spec 2.8). */
  featuredPins: Map<string, FeaturedPinRow>;
  /** By `${campusSlug}:${day}`: each campus's Featured row as first shown that day (staff tools plan decision 9). */
  featuredDraws: Map<string, FeaturedDrawRow>;
  /** By id: the approved pickup points, retired ones included (staff tools spec 2.3). */
  pickupPoints: Map<string, PickupPointRow>;
  /** By id: mentors' notes and check-ins (staff tools spec 2.6). */
  mentorNotes: Map<string, MentorNoteRow>;
  /** By id: the Hub's posts, drafts included (staff tools spec 2.4). */
  hubPosts: Map<string, HubPostRow>;
  /** By `${postId}:${accountId}`: who's going to an event (staff tools spec 2.5). */
  hubRsvps: Map<string, HubRsvpRow>;
  /** By id: office-hours slot requests (staff tools spec 2.5). */
  hubBookings: Map<string, HubBookingRow>;
};

/** Bump it when a table is added or a row changes shape, so `next dev` reseeds instead of keeping an old store. */
export const STORE_VERSION = 6;

type StoreHolder = { __vossieSampleStore?: SampleStore };

const holder = () => globalThis as unknown as StoreHolder;

/** The store, seeded on first use. */
export function sampleStore(): SampleStore {
  const current = holder().__vossieSampleStore;
  if (current?.version === STORE_VERSION) return current;
  const fresh = seedStore();
  holder().__vossieSampleStore = fresh;
  return fresh;
}

/** A fresh store from the fixtures. Unit tests call it before each test; the app never does. */
export function resetSampleStore(): void {
  holder().__vossieSampleStore = seedStore();
}

function seedStore(): SampleStore {
  // Copies, so a write to the store can never change the fixtures.
  const accounts = structuredClone(sampleAccounts);
  const consents = structuredClone(sampleConsents);
  return {
    version: STORE_VERSION,
    accounts: new Map(accounts.map(({ account }) => [account.id, account])),
    sellerProfiles: new Map(accounts.flatMap(({ seller }) => (seller ? [[seller.accountId, seller] as const] : []))),
    consents: new Map(consents.map((consent) => [consent.id, consent])),
    sessions: new Map(),
    signInAttempts: new Map(),
    codeSends: new Map(),
    sampleEmails: new Map(),
    formStates: new Map(),
    // Copies, like the accounts above (messaging plan decision 16).
    conversations: new Map(structuredClone(sampleConversations).map((row) => [row.id, row])),
    messages: new Map(structuredClone(sampleMessages).map((row) => [row.id, row])),
    reports: new Map(),
    notifications: new Map(structuredClone(sampleNotifications).map((row) => [row.id, row])),
    // The listing and seller fixtures as rows (selling plan decision 7). Copies, like the rest.
    sellers: new Map(structuredClone(sampleSellerRows).map((row) => [row.slug, row])),
    listings: new Map(structuredClone(sampleListingRows).map((row) => [row.id, row])),
    photos: new Map(),
    onboardingDrafts: new Map(),
    // The staff tools' seeds (staff tools plan, Task 1). Copies, like the rest.
    auditLog: new Map(),
    featuredPins: new Map(),
    featuredDraws: new Map(),
    pickupPoints: new Map(structuredClone(samplePickupPointRows).map((row) => [row.id, row])),
    mentorNotes: new Map(structuredClone(sampleMentorNotes).map((row) => [row.id, row])),
    hubPosts: new Map(structuredClone(sampleHubPostRows).map((row) => [row.id, row])),
    hubRsvps: new Map(),
    hubBookings: new Map(structuredClone(sampleHubBookings).map((row) => [row.id, row])),
  };
}
