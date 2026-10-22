import { onSupabase } from "@/lib/backend";
import type { QueueOldest, QueueRow, SaleToMark, SellerQueue } from "@/lib/types";
import type { ConversationRow, ListingRow } from "./rows";
import { sampleStore } from "./store";

// What needs a shop's owner now (role views spec 6 and 7.1; N2 plan decisions 1 to 3): buyers waiting for a first
// reply, sales whose listing is still up, drafts, Hub-hidden and paused listings, each with its oldest, plus the
// listings by state and whether the shop has ever replied. One slim read, request-time, never cached across requests;
// lib/selling/queue.ts reads it once per request. On Supabase it is public.seller_queue, which answers the shop's
// owner only (lib/data/supabase/seller-queue.ts). The caller passes the signed-in account's own shop.

const iso = (at: string) => new Date(at).toISOString();

const older = (a: { at: string; id: string }, b: { at: string; id: string }) =>
  Date.parse(a.at) - Date.parse(b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function rowOf(items: readonly QueueOldest[]): QueueRow {
  const sorted = [...items].sort(older);
  return { count: sorted.length, oldest: sorted[0] ?? null };
}

const fromListing = (row: ListingRow, at: string): QueueOldest => ({ id: row.id, title: row.title, at: iso(at), state: row.state });

/** The queue over one shop's conversations and listings (either list may hold rows of other shops' only if passed). */
export function queueOver(conversations: readonly ConversationRow[], listings: readonly ListingRow[]): SellerQueue {
  const talks = conversations.filter((row) => !row.sellerGone);
  const byId = new Map(listings.map((row) => [row.id, row]));
  const sales: SaleToMark[] = talks
    .flatMap((row) => {
      const listing = row.listingId ? byId.get(row.listingId) : undefined;
      const at = row.completedAt ?? row.confirmedAt;
      if (!listing || !at || (row.status !== "done" && row.status !== "confirmed")) return [];
      if (listing.state !== "available" || listing.kind !== "item" || listing.hiddenAt) return [];
      if (Date.parse(at) < Date.parse(listing.updatedAt)) return [];
      return [{ conversationId: row.id, listingId: listing.id, title: listing.title, at: iso(at) }];
    })
    .sort((a, b) => older({ at: a.at, id: a.conversationId }, { at: b.at, id: b.conversationId }));
  const inState = (state: ListingRow["state"]) => listings.filter((row) => row.state === state);
  return {
    replies: rowOf(
      talks
        .filter((row) => row.status === "asked" && !row.requestId && row.buyerId !== null)
        .map((row) => ({ id: row.id, title: row.listingTitle, at: iso(row.createdAt), state: null })),
    ),
    sales,
    drafts: rowOf(inState("draft").map((row) => fromListing(row, row.updatedAt))),
    hidden: rowOf(listings.flatMap((row) => (row.hiddenAt ? [fromListing(row, row.hiddenAt)] : []))),
    paused: rowOf(inState("paused").map((row) => fromListing(row, row.updatedAt))),
    listings: {
      available: inState("available").length,
      paused: inState("paused").length,
      sold: inState("sold").length,
      drafts: inState("draft").length,
    },
    everReplied: talks.some((row) => !row.requestId && row.firstReplyAt !== null),
  };
}

/** What needs the owner of `sellerSlug` now. The caller passes the signed-in account's own shop. */
export async function sellerQueue(sellerSlug: string): Promise<SellerQueue> {
  if (onSupabase()) return (await import("./supabase/seller-queue")).sellerQueue(sellerSlug);
  const { conversations, listings } = sampleStore();
  return queueOver(
    [...conversations.values()].filter((row) => row.sellerSlug === sellerSlug),
    [...listings.values()].filter((row) => row.sellerSlug === sellerSlug),
  );
}
