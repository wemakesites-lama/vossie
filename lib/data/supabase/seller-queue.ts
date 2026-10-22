import "server-only";
import type * as Sample from "../seller-queue";
import type { ListingState, QueueRow, SellerQueue } from "@/lib/types";
import { forViewer } from "./clients";

// The seller's queue on Supabase (role views N2): one call to public.seller_queue(p_slug) with the signed-in owner's session.
// The function answers the shop's owner only and gives null to anyone else, which this twin turns into an error: the
// home then shows the card's error box, and the bar shows no badge (spec 8). Never cached across requests.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

type RawOldest = { id: string; title: string | null; at: string; state: string | null } | null;
type RawRow = { count: number; oldest: RawOldest };
type Raw = {
  replies: RawRow;
  sales: { conversation_id: string; listing_id: string; title: string; at: string }[];
  drafts: RawRow;
  hidden: RawRow;
  paused: RawRow;
  listings: SellerQueue["listings"];
  ever_replied: boolean;
};

const iso = (at: string) => new Date(at).toISOString();

function rowFrom(raw: RawRow): QueueRow {
  return {
    count: raw.count,
    oldest: raw.oldest
      ? { id: raw.oldest.id, title: raw.oldest.title, at: iso(raw.oldest.at), state: raw.oldest.state as ListingState | null }
      : null,
  };
}

export const sellerQueue: typeof Sample.sellerQueue = async (sellerSlug) => {
  const client = await forViewer();
  // One call: the function finds the shop by its link and checks it is the signed-in account's (plan review fix 6).
  const { data, error } = await client.rpc("seller_queue", { p_slug: sellerSlug });
  if (error) failed("seller_queue", error);
  if (data === null) throw new Error("seller_queue answered nothing: not the signed-in account's shop");
  const raw = data as unknown as Raw;
  return {
    replies: rowFrom(raw.replies),
    sales: raw.sales.map((sale) => ({
      conversationId: sale.conversation_id,
      listingId: sale.listing_id,
      title: sale.title,
      at: iso(sale.at),
    })),
    drafts: rowFrom(raw.drafts),
    hidden: rowFrom(raw.hidden),
    paused: rowFrom(raw.paused),
    listings: raw.listings,
    everReplied: raw.ever_replied,
  };
};
