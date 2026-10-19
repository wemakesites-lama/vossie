import { firstLine } from "@/lib/messaging/rules";
import type { OfferSummary } from "@/lib/types";
import type { ConversationRow } from "./rows";
import { sampleStore } from "./store";

// Offers on Looking For requests, read from E's conversations (community actions spec 2.7, 2.9 and 2.13; plan
// decisions 4, 10 and 12). Read-only: startOffer in lib/data/messages.ts makes them. Times come from the caller.

const CLOSED_SHOP = "A closed shop";

function offersOn(requestId: string): ConversationRow[] {
  return [...sampleStore().conversations.values()].filter((row) => row.requestId === requestId);
}

/** The shop's offer on this request, while the shop is there to answer it (spec 2.9: one per shop per request). */
export async function findOffer(requestId: string, sellerSlug: string): Promise<string | null> {
  return offersOn(requestId).find((row) => row.sellerSlug === sellerSlug && !row.sellerGone)?.id ?? null;
}

/**
 * The asker's view of a request's offers (spec 2.13): newest first, the shop, the offer's first line and when. An offer
 * from a shop that has gone stays in the list, as "A closed shop" (plan decision 10 and amendment 9).
 */
export async function offersForRequest(requestId: string): Promise<OfferSummary[]> {
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
  return [...sampleStore().conversations.values()].filter(
    (row) =>
      row.requestId && row.sellerSlug === sellerSlug && !row.sellerGone && Date.parse(row.createdAt) > since.getTime(),
  ).length;
}
