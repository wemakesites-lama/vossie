import { earnedBadge } from "@/lib/selling/badges";
import { shopStatus } from "./catalog";
import { shopStats } from "./shop-stats";
import { sampleStore } from "./store";

// Trust badges worked out from the store (staff tools spec 2.7, plan decision 8), by the trust page's rules, from
// E's conversations by F's counting. Only shops with an owner account and a storefront (open or paused) are worked
// out: the 28 sample shops no account owns have no conversations in the store, so they keep their sample badges.
// There's no scheduler: Overview runs it for every shop, and a reply or a confirmed sale for its shop. The nightly
// job is a go-live item. Writing the badge doesn't expire the cache: the caller does that, when it can.

async function recalculate(slug: string, now: Date): Promise<boolean> {
  const store = sampleStore();
  const row = store.sellers.get(slug);
  const owner = row?.ownerId ? store.accounts.get(row.ownerId) : undefined;
  if (!row || !owner || shopStatus(row) === "pending") return false;
  const badge = earnedBadge((await shopStats(slug, now)).record, owner.createdAt, now);
  // Counting awaited, so the shop is read again (amendment 19): the badge goes only on the same row, with the same
  // owner, still with a storefront. From this check to the write there's no await.
  const same = sampleStore().sellers.get(slug) === row && row.ownerId === owner.id;
  if (!same || shopStatus(row) === "pending" || row.badge === badge) return false;
  row.badge = badge;
  return true;
}

/** Every owned shop's badge (Overview). The slugs whose badge changed. */
export async function recalculateBadges(now: Date): Promise<string[]> {
  const changed: string[] = [];
  for (const slug of [...sampleStore().sellers.keys()]) {
    if (await recalculate(slug, now)) changed.push(slug);
  }
  return changed;
}

/** The badge of the shop a conversation is with (after a reply or a confirmed sale). True when it changed. */
export async function recalculateBadgeFor(conversationId: string, now: Date): Promise<boolean> {
  const conversation = sampleStore().conversations.get(conversationId);
  return conversation && !conversation.sellerGone ? recalculate(conversation.sellerSlug, now) : false;
}
