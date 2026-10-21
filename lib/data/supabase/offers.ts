import "server-only";
import { firstLine } from "@/lib/messaging/rules";
import type * as Sample from "../offers";
import { CLOSED_SHOP } from "../offers";
import { forViewer, type DbClient } from "./clients";
import { iso } from "./rows";

// Offers on Looking For requests on Supabase, the request side (C4/C5 plan Task 5; amendments 3 and 11). Read-only, as
// the signed-in person: the asker reads their offer threads through my_conversations (start_offer makes them its
// buyer), each shop's name through the shops policy (which lets a thread's buyer read a shop the Hub has paused:
// amendment 3's probe, so no view of its own), and the shop's first message from messages. The shop's owner reads its
// own threads the same way. offerRow and offerThreadCount stay the sample's: the database counts offers itself
// (request_offer_count) and start_offer finds a shop's thread under its lock. startOffer is C3's.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

/** The signed-in owner's shop's id, by its link; null for a link that isn't one they can read. */
async function shopIdOf(client: DbClient, sellerSlug: string): Promise<string | null> {
  const { data, error } = await client.from("shops").select("id").eq("slug", sellerSlug).maybeSingle();
  if (error) failed("shops", error);
  return data?.id ?? null;
}

/** The shop's offer threads the reader sees: offers (is_offer; a deleted request clears request_id but not the flag). */
function shopOffers(client: DbClient, shopId: string) {
  return client.from("my_conversations").select("id, created_at").eq("is_offer", true).eq("shop_id", shopId).eq("seller_gone", false);
}

export const findOffer: typeof Sample.findOffer = async (requestId, sellerSlug) => {
  const client = await forViewer();
  const shopId = await shopIdOf(client, sellerSlug);
  if (!shopId) return null;
  const { data, error } = await shopOffers(client, shopId).eq("request_id", requestId).limit(1);
  if (error) failed("my_conversations", error);
  return data[0]?.id ?? null;
};

/**
 * The asker's view of a request's offers (spec 2.13): newest first, the shop (a Hub-paused one by name; "A closed shop"
 * once its seller has gone), the shop's first line (none once it has left) and when.
 */
export const offersForRequest: typeof Sample.offersForRequest = async (requestId) => {
  const client = await forViewer();
  const threads = await client
    .from("my_conversations")
    .select("id, shop_id, seller_gone, created_at")
    .eq("is_offer", true)
    .eq("request_id", requestId);
  if (threads.error) failed("my_conversations", threads.error);
  const rows = threads.data.flatMap((row) => (row.id && row.created_at ? [{ ...row, id: row.id, created_at: row.created_at }] : []));
  if (rows.length === 0) return [];
  const shopIds = [...new Set(rows.flatMap((row) => (row.shop_id && !row.seller_gone ? [row.shop_id] : [])))];
  const [shops, messages] = await Promise.all([
    shopIds.length > 0 ? client.from("shops").select("id, name").in("id", shopIds) : Promise.resolve({ data: [], error: null }),
    client
      .from("messages")
      .select("conversation_id, body, sent_at, id")
      .in("conversation_id", rows.map((row) => row.id))
      .eq("side", "seller")
      .order("sent_at")
      .order("id"),
  ]);
  if (shops.error) failed("shops", shops.error);
  if (messages.error) failed("messages", messages.error);
  const names = new Map(shops.data.map((shop) => [shop.id, shop.name]));
  const first = new Map<string, string>();
  for (const message of messages.data) {
    if (!first.has(message.conversation_id)) first.set(message.conversation_id, message.body);
  }
  return rows
    .map((row) => ({
      conversationId: row.id,
      shopName: (!row.seller_gone && row.shop_id ? names.get(row.shop_id) : undefined) ?? CLOSED_SHOP,
      preview: first.has(row.id) ? firstLine(first.get(row.id)!) : "",
      offeredAt: iso(row.created_at),
    }))
    .sort((a, b) => b.offeredAt.localeCompare(a.offeredAt) || b.conversationId.localeCompare(a.conversationId));
};

/** How many offers the signed-in owner's shop has made since `since` that are still there (its daily limit). */
export const countOffersSince: typeof Sample.countOffersSince = async (sellerSlug, since) => {
  const client = await forViewer();
  const shopId = await shopIdOf(client, sellerSlug);
  if (!shopId) return 0;
  const { data, error } = await shopOffers(client, shopId).gt("created_at", since.toISOString());
  if (error) failed("my_conversations", error);
  return data.length;
};
