import type { ListingState } from "@/lib/types";
import { listedListings, shopStatus } from "./catalog";
import type { SellerProfileRow, SellerRow } from "./rows";
import { sampleStore } from "./store";

// The Hub's decisions about shops and listings (staff tools spec 2.3; plan decisions 2 to 4, 15 and 23): approving,
// declining, Verified, the Hub's pause, mentors, and hiding a listing. A shop's status stays on its owner's seller
// profile (selling plan decision 1). Each change checks the state it expects and gives back null when there was
// nothing to do, so the action writes no audit entry and sends nothing (plan decision 23). Times come from the caller.

/** Where a shop stands, as the Sellers list says it. A declined shop is a waiting one with the decline recorded. */
export type ShopStanding = "waiting" | "declined" | "open" | "paused";

/** A shop as the Sellers list and its review page show it (spec 2.3). */
export type ShopReview = {
  /** A copy. */
  shop: SellerRow;
  /** The owner's account and first name, or null for a sample shop no account owns (always open). */
  owner: { id: string; firstName: string } | null;
  standing: ShopStanding;
  appliedAt: string | null;
  declinedAt: string | null;
  pausedBy: "seller" | "staff" | null;
  /** The Hub's reason for a decline or its pause. */
  staffReason: string | null;
  mentor: { id: string; firstName: string } | null;
  /** How many of its listings buyers can find now. */
  listedCount: number;
};

/** What a decision changed, for the action's audit entry and notification. */
export type ShopDecision = { slug: string; name: string; ownerId: string | null };

/**
 * A seller's own standing with the Hub, for /sell (Task 18): a decline, or the Hub's pause, and its reason, and when
 * the application was sent (or sent again), for the waiting page (amendment 6).
 */
export type OwnStanding = {
  declinedAt: string | null;
  pausedByHub: boolean;
  reason: string | null;
  appliedAt: string;
};

function profileOf(row: SellerRow): SellerProfileRow | null {
  return row.ownerId ? (sampleStore().sellerProfiles.get(row.ownerId) ?? null) : null;
}

function personOf(accountId: string | null | undefined): { id: string; firstName: string } | null {
  const row = accountId ? sampleStore().accounts.get(accountId) : undefined;
  return row ? { id: row.id, firstName: row.firstName } : null;
}

function standingOf(row: SellerRow, profile: SellerProfileRow | null): ShopStanding {
  if (!row.ownerId) return "open";
  if (!profile || profile.status === "pending") return profile?.declinedAt ? "declined" : "waiting";
  return profile.status === "paused" ? "paused" : "open";
}

function listedCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const listing of listedListings()) counts.set(listing.sellerSlug, (counts.get(listing.sellerSlug) ?? 0) + 1);
  return counts;
}

function review(row: SellerRow, counts: ReadonlyMap<string, number>): ShopReview {
  const profile = profileOf(row);
  return {
    shop: structuredClone(row),
    owner: personOf(row.ownerId),
    standing: standingOf(row, profile),
    appliedAt: profile?.appliedAt ?? null,
    declinedAt: profile?.declinedAt ?? null,
    pausedBy: profile?.pausedBy ?? null,
    staffReason: profile?.staffReason ?? null,
    mentor: personOf(profile?.mentorId),
    listedCount: counts.get(row.slug) ?? 0,
  };
}

const RANK: Readonly<Record<ShopStanding, number>> = { waiting: 0, declined: 1, open: 2, paused: 2 };

/** Every shop (spec 2.3): waiting for approval first, oldest application first; then declined; then the rest by name. */
export async function listShopsForReview(): Promise<ShopReview[]> {
  const counts = listedCounts();
  return [...sampleStore().sellers.values()]
    .map((row) => review(row, counts))
    .sort(
      (a, b) =>
        RANK[a.standing] - RANK[b.standing] ||
        (a.standing === "waiting" ? (a.appliedAt ?? "").localeCompare(b.appliedAt ?? "") : 0) ||
        a.shop.name.localeCompare(b.shop.name),
    );
}

export async function getShopForReview(slug: string): Promise<ShopReview | null> {
  const row = sampleStore().sellers.get(slug);
  return row ? review(row, listedCounts()) : null;
}

/** How many shops are waiting for approval (not declined), for Overview. */
export async function countWaitingShops(): Promise<number> {
  return [...sampleStore().sellers.values()].filter((row) => standingOf(row, profileOf(row)) === "waiting").length;
}

function owned(slug: string): { row: SellerRow; profile: SellerProfileRow } | null {
  const row = sampleStore().sellers.get(slug);
  const profile = row ? profileOf(row) : null;
  return row && profile ? { row, profile } : null;
}

const decided = (row: SellerRow): ShopDecision => ({ slug: row.slug, name: row.name, ownerId: row.ownerId });

/**
 * The shop on this link is the one the Hub reviewed: it's still owned by `ownerId`, the account the review page named
 * (amendment 14.6). A shop deleted since, with a new one on the same link, is another shop and isn't decided on.
 */
const reviewed = (shop: { row: SellerRow }, ownerId: string) => ownerId !== "" && shop.row.ownerId === ownerId;

/**
 * Approve (spec 2.3): a waiting shop opens, with its storefront at its link (selling plan decision 1). `ownerId` is the
 * owner on the page the Hub reviewed. The first approval's time is kept for the admin's numbers (stage J spec
 * section 4).
 */
export async function approveShop(slug: string, ownerId: string, now: Date): Promise<ShopDecision | null> {
  const shop = owned(slug);
  if (!shop || !reviewed(shop, ownerId) || shop.profile.status !== "pending" || shop.profile.declinedAt) return null;
  Object.assign(shop.profile, {
    status: "approved",
    sellerSlug: shop.row.slug,
    declinedAt: null,
    pausedBy: null,
    staffReason: null,
    approvedAt: shop.profile.approvedAt ?? now.toISOString(),
  });
  return decided(shop.row);
}

/**
 * Decline (spec 2.3, plan decision 2): the shop stays waiting, with the decline and its reason recorded. `ownerId` is the
 * owner on the page the Hub reviewed (amendment 14.6).
 */
export async function declineShop(
  slug: string,
  ownerId: string,
  reason: string,
  now: Date,
): Promise<ShopDecision | null> {
  const shop = owned(slug);
  if (!shop || !reviewed(shop, ownerId) || shop.profile.status !== "pending" || shop.profile.declinedAt) return null;
  shop.profile.declinedAt = now.toISOString();
  shop.profile.staffReason = reason;
  return decided(shop.row);
}

/** The seller's Send for approval again (plan decision 2): the decline is forgotten and the shop waits again. */
export async function resendForApproval(accountId: string, now: Date): Promise<boolean> {
  const profile = sampleStore().sellerProfiles.get(accountId);
  if (!profile || profile.status !== "pending" || !profile.declinedAt) return false;
  profile.declinedAt = null;
  profile.staffReason = null;
  profile.appliedAt = now.toISOString();
  return true;
}

/** Verify, or take Verified away (spec 2.3), on any shop with a storefront, sample shops included. */
export async function setVerified(slug: string, verified: boolean): Promise<ShopDecision | null> {
  const row = sampleStore().sellers.get(slug);
  if (!row || shopStatus(row) === "pending" || row.verified === verified) return null;
  row.verified = verified;
  return decided(row);
}

/**
 * The Hub's Pause shop (spec 2.3, plan decision 3): an open shop, or one its seller paused, which then becomes the
 * Hub's to resume. A sample shop no account owns has no profile, so it can't be paused.
 */
export async function staffPauseShop(slug: string, reason: string): Promise<ShopDecision | null> {
  const shop = owned(slug);
  if (!shop) return null;
  const { status, pausedBy } = shop.profile;
  if (!(status === "approved" || (status === "paused" && pausedBy !== "staff"))) return null;
  // A seller's own pause is remembered under the Hub's, so Resume puts it back (amendment 13.3).
  Object.assign(shop.profile, {
    status: "paused",
    pausedBy: "staff",
    staffReason: reason,
    sellerPausedToo: status === "paused",
  });
  return decided(shop.row);
}

/** The Hub's Resume (spec 2.3): only a pause the Hub made (plan decision 3). */
export async function staffResumeShop(slug: string): Promise<(ShopDecision & { stillPausedBySeller: boolean }) | null> {
  const shop = owned(slug);
  if (!shop || shop.profile.status !== "paused" || shop.profile.pausedBy !== "staff") return null;
  const sellerPausedToo = shop.profile.sellerPausedToo === true;
  Object.assign(
    shop.profile,
    sellerPausedToo
      ? { status: "paused", pausedBy: "seller", staffReason: null, sellerPausedToo: false }
      : { status: "approved", pausedBy: null, staffReason: null, sellerPausedToo: false },
  );
  return { ...decided(shop.row), stillPausedBySeller: sellerPausedToo };
}

/** The accounts with the mentor role, by first name, for the seller page's choice (plan decision 15). */
export async function listMentors(): Promise<{ id: string; firstName: string }[]> {
  return [...sampleStore().accounts.values()]
    .filter((row) => row.roles.includes("mentor"))
    .map((row) => ({ id: row.id, firstName: row.firstName }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
}

/**
 * A shop's mentor (spec 2.6, plan decision 15): one of the accounts with the mentor role, or none, but never the shop's
 * own owner. Only an open or paused shop with an owner can have one.
 */
export async function setShopMentor(
  slug: string,
  mentorId: string | null,
): Promise<(ShopDecision & { mentorName: string | null }) | null> {
  const shop = owned(slug);
  if (!shop || shop.profile.status === "pending") return null;
  const mentor = mentorId ? sampleStore().accounts.get(mentorId) : undefined;
  if (mentorId && !mentor?.roles.includes("mentor")) return null;
  // Nobody reads notes about their own shop (amendment 15.3), so the owner can't be its mentor.
  if (mentorId && mentorId === shop.profile.accountId) return null;
  if ((shop.profile.mentorId ?? null) === mentorId) return null;
  shop.profile.mentorId = mentorId;
  return { ...decided(shop.row), mentorName: mentor?.firstName ?? null };
}

/** Hide the listing (spec 2.3, plan decision 4): its row stays, with the reason, and buyers stop seeing it. */
export async function hideListing(
  id: string,
  reason: string,
  now: Date,
): Promise<{ id: string; title: string; sellerSlug: string; state: ListingState; ownerId: string | null } | null> {
  const row = sampleStore().listings.get(id);
  if (!row || row.hiddenAt) return null;
  row.hiddenAt = now.toISOString();
  row.hiddenReason = reason;
  const ownerId = sampleStore().sellers.get(row.sellerSlug)?.ownerId ?? null;
  return { id: row.id, title: row.title, sellerSlug: row.sellerSlug, state: row.state, ownerId };
}

/** A seller's standing with the Hub (Task 18's /sell): a decline, or the Hub's pause, and its reason. */
export async function shopStanding(accountId: string): Promise<OwnStanding | null> {
  const profile = sampleStore().sellerProfiles.get(accountId);
  if (!profile) return null;
  return {
    declinedAt: profile.declinedAt ?? null,
    pausedByHub: profile.status === "paused" && profile.pausedBy === "staff",
    reason: profile.staffReason ?? null,
    appliedAt: profile.appliedAt,
  };
}
