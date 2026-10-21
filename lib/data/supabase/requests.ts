import "server-only";
import type { LookingForRequest, RequestStatus } from "@/lib/types";
import type * as Sample from "../requests";
import { forPublic, forServer } from "./clients";
import { type AsyncTwin, iso, selectAll } from "./rows";

// Looking For requests on Supabase (2b plan Task 17; decisions 1 to 3 and 21): the sample module's public reads, over
// the request_cards view (requests the Hub hasn't hidden, with their closing day and offer count, never the asker),
// through the cookieless client; lib/data/index.ts wraps them in "use cache", tagged `requests`. The settle is the
// database's settle_requests, through the admin client, from request-time code only. The asker's own reads and the
// writes stay in the sample module until C4.

const CARD_COLUMNS =
  "id, title, category_slug, campus_slug, details, budget_zar, swap_welcome, needed_by, status, created_at, offers, closes_on";

type Card = {
  id: string | null;
  title: string | null;
  category_slug: string | null;
  campus_slug: string | null;
  details: string | null;
  budget_zar: number | null;
  swap_welcome: boolean | null;
  needed_by: string | null;
  status: string | null;
  created_at: string | null;
  offers: number | null;
  closes_on: string | null;
};

/** A card as part B's LookingForRequest: the offers are the view's (offer threads plus the sample's number). */
function toRequest(card: Card): LookingForRequest[] {
  if (!card.id || !card.title || !card.category_slug || !card.campus_slug || card.details === null || !card.created_at) {
    return [];
  }
  return [
    {
      id: card.id,
      title: card.title,
      campusSlug: card.campus_slug,
      offers: card.offers ?? 0,
      details: card.details,
      categorySlug: card.category_slug,
      budgetZar: card.budget_zar,
      swapWelcome: card.swap_welcome ?? false,
      neededBy: card.needed_by,
      createdAt: iso(card.created_at),
      status: card.status as RequestStatus,
      closesOn: card.closes_on,
    },
  ];
}

/**
 * The board's, the homepage's and the sitemap's: open on `today` (a SAST date), settled or not (stage L decision 10),
 * oldest first, as the store adds them (the readers sort them newest first).
 */
export const listedRequests: AsyncTwin<typeof Sample.listedRequests> = async (today) => {
  const cards = await selectAll(
    () =>
      forPublic()
        .from("request_cards")
        .select(CARD_COLUMNS)
        .eq("status", "open")
        .or(`closes_on.is.null,closes_on.gt.${today}`),
    ["created_at", "id"],
  );
  return cards.flatMap(toRequest);
};

/** A request's page: anything not hidden, open or closed (community actions spec 2.14). */
export const publicRequest: AsyncTwin<typeof Sample.publicRequest> = async (id) => {
  const { data, error } = await forPublic().from("request_cards").select(CARD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (toRequest(data)[0] ?? null) : null;
};

/** Every request with a page, for prerendering, open or closed. */
export const publicRequestIds: AsyncTwin<typeof Sample.publicRequestIds> = async () => {
  const rows = await selectAll(() => forPublic().from("request_cards").select("id, created_at"), ["created_at", "id"]);
  return rows.flatMap((row) => (row.id ? [row.id] : []));
};

/**
 * Stores every due close and the one reminder, telling each asker (decision 2): the database's settle_requests, which
 * holds a lock and caps the time at its own now(). The admin client: request-time code only, never inside
 * "use cache" (decision 21). How many it closed.
 */
export const settleRequests: typeof Sample.settleRequests = async (now) => {
  const { data, error } = await forServer().rpc("settle_requests", { p_now: now.toISOString() });
  if (error) throw new Error(error.message);
  return data;
};
