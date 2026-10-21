import { onSupabase } from "@/lib/backend";
import { firstLine } from "@/lib/messaging/rules";
import type { OfferSummary } from "@/lib/types";
import type { ConversationRow } from "./rows";
import { sampleStore } from "./store";

// Offers on Looking For requests, read from E's conversations (community actions spec 2.7, 2.9 and 2.13; plan
// decisions 4, 10 and 12). Read-only: startOffer in lib/data/messages.ts makes them. Times come from the caller. On
// Supabase, findOffer, offersForRequest and countOffersSince are lib/data/supabase/offers.ts's (C4/C5 plan Task 5).

/** What a shop that no longer exists is called in an offer thread, wherever it shows (plan amendment 17.5). */
export const CLOSED_SHOP = "A closed shop";

function offersOn(requestId: string): ConversationRow[] {
  return [...sampleStore().conversations.values()].filter((row) => row.requestId === requestId);
}

/**
 * The shop's offer thread on this request, while the shop is there to answer it (spec 2.9: one per shop per request).
 * The store's own row, for lib/data's use. Synchronous on purpose: startOffer finds and inserts with no await between,
 * so two offers sent at once make one thread (plan amendments 7 and 17.7). Sample only: on Supabase start_offer finds
 * the thread under its own lock (C4/C5 plan Task 5).
 */
export function offerRow(requestId: string, sellerSlug: string): ConversationRow | null {
  return offersOn(requestId).find((row) => row.sellerSlug === sellerSlug && !row.sellerGone) ?? null;
}

/** The shop's offer on this request, for the composer: the thread's id (spec 2.9). */
export async function findOffer(requestId: string, sellerSlug: string): Promise<string | null> {
  if (onSupabase()) return (await import("./supabase/offers")).findOffer(requestId, sellerSlug);
  return offerRow(requestId, sellerSlug)?.id ?? null;
}

/**
 * A request's offers: its offer threads, whatever state they're in, a shop that has left included (spec 2.11). Sample
 * only: on Supabase the views count them (request_offer_count).
 */
export function offerThreadCount(requestId: string): number {
  return offersOn(requestId).length;
}

/**
 * The asker's view of a request's offers (spec 2.13): newest first, the shop, the offer's first line and when. An offer
 * from a shop that has gone stays in the list, as "A closed shop" (plan decision 10 and amendment 9).
 */
export async function offersForRequest(requestId: string): Promise<OfferSummary[]> {
  if (onSupabase()) return (await import("./supabase/offers")).offersForRequest(requestId);
  const { messages, sellers } = sampleStore();
  return offersOn(requestId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((row) => {
      const first = [...messages.values()]
        .filter((message) => message.conversationId === row.id && message.from === "seller")
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt))[0];
      const shop = row.sellerGone ? undefined : sellers.get(row.sellerSlug);
      return {
        conversationId: row.id,
        shopName: shop?.name ?? CLOSED_SHOP,
        preview: first ? firstLine(first.body) : "",
        offeredAt: row.createdAt,
      };
    });
}

/**
 * How many offers the shop has made since `since` that are still in the store, for its daily limit (plan decision 4).
 * A thread whose shop has gone belongs to no shop now, so it counts for none, as in shopStats (amendment 9).
 */
export async function countOffersSince(sellerSlug: string, since: Date): Promise<number> {
  if (onSupabase()) return (await import("./supabase/offers")).countOffersSince(sellerSlug, since);
  return [...sampleStore().conversations.values()].filter(
    (row) =>
      row.requestId && row.sellerSlug === sellerSlug && !row.sellerGone && Date.parse(row.createdAt) > since.getTime(),
  ).length;
}
