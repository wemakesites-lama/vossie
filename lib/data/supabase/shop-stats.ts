import "server-only";
import type * as Sample from "../shop-stats";
import { type CountedConversation, recentOver, statsOver } from "../shop-stats";
import { forServer } from "./clients";
import { selectAll } from "./rows";

// A shop's numbers on Supabase (2b plan Task 19, decision 21): the sample module's counting (statsOver, recentOver)
// over the shop's conversations, read with the admin client, since no API role may read every conversation of a shop
// (a buyer's reply included). Request-time code only (the selling dashboard, the mentor's page, the badges), never
// inside "use cache". Only the counts leave the server.
//
// As in the sample store, a conversation whose shop's owner has deleted their account (seller_gone) counts for no shop,
// and the shop is found by its link whatever its status.

/**
 * An offer thread isn't an enquiry, even once its request has gone: the store keeps the thread's requestId, while the
 * database clears request_id and keeps is_offer. The counting reads only whether requestId is set.
 */
const GONE_REQUEST = "request-gone";

/** The shop's id by its link, or null when there's no such shop. */
async function shopIdOf(slug: string): Promise<string | null> {
  const { data, error } = await forServer().from("shops").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

/** A shop's conversations as the counting reads them, leaving out the ones whose owner has gone. */
export async function conversationsOf(shopId: string): Promise<CountedConversation[]> {
  const rows = await selectAll(
    () =>
      forServer()
        .from("conversations")
        .select("id, listing_id, is_offer, request_id, created_at, first_reply_at, status, completed_at, confirmed_at")
        .eq("shop_id", shopId)
        .eq("seller_gone", false),
    ["id"],
  );
  return rows.map((row) => ({
    listingId: row.listing_id,
    requestId: row.is_offer ? (row.request_id ?? GONE_REQUEST) : null,
    createdAt: row.created_at,
    firstReplyAt: row.first_reply_at,
    status: row.status as CountedConversation["status"],
    completedAt: row.completed_at,
    confirmedAt: row.confirmed_at,
  }));
}

async function conversationsOfSlug(slug: string): Promise<CountedConversation[]> {
  const id = await shopIdOf(slug);
  return id === null ? [] : conversationsOf(id);
}

/** A shop's last 7 days, and its record for the badges: 90 days of enquiries, and every sale. */
export const shopStats: typeof Sample.shopStats = async (sellerSlug, now) =>
  statsOver(await conversationsOfSlug(sellerSlug), now);

/** A shop's enquiries and sales over the last `days` days: the mentor dashboard's 14. */
export const recentCounts: typeof Sample.recentCounts = async (sellerSlug, days, now) =>
  recentOver(await conversationsOfSlug(sellerSlug), days, now);
