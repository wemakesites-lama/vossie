import "server-only";
import { offerAbout, UNNAMED_ASKER } from "@/lib/looking-for/words";
import { firstLine } from "@/lib/messaging/rules";
import type { ConversationShop, ConversationStatus, ImageRef } from "@/lib/types";
import { toSeller } from "../catalog";
import { getListingDetail, getListingsByIds, getRequest } from "../index";
import type * as Sample from "../messages";
import { CLOSED_SHOP } from "../offers";
import { Refused, type RefusalCode } from "../refused";
import { SHOP_COLUMNS, sellerRowFrom } from "./catalog";
import { forViewer, viewerId, type DbClient } from "./clients";
import { iso } from "./rows";
import { viewerShop } from "./shops";
import { forViewerAs } from "./viewer";

// Conversations and messages on Supabase (C2/C3 plan Tasks 14 to 16; decisions 18 to 20 and 24). Every read and write
// is the signed-in account's own, through its own client (forViewerAs: the account id is checked against the session,
// decision 2), never cached (decision 4). The access rules show a conversation only to its buyer and to its shop's
// owner while the seller hasn't gone, and my_conversations says which side the reader is on.
// - The 7-day auto-confirm on read (decision 19): getInbox, getThread and exportConversations call settle_sales first,
//   as the sample settles on read; the sale functions and send_message settle inside. unreadCounts, in every signed-in
//   header, writes nothing: my_unread_counts counts a sale past its 7 days as settled already.
// - The inbox in a fixed number of queries (decision 20): my_conversations, my_conversation_tails (each one's last
//   message and the other side's unread count), and the shops by id. The listings' images and the requests' titles
//   come from the cached public readers, as in the sample.
// - Message text comes back exactly as stored (decision 24): React renders it as text, and nothing makes links.
// - Ids that aren't uuids (a sample conversation's, a forged one) are answered without a query: a malformed uuid is a
//   Postgres error, not a miss.
// - Deleting an account is forget_account's (phase B): forgetAccountInMessaging throws a plain Error (decision 21,
//   amendment 4). `now` is unused: the database's clock settles and stamps.

type Side = "buyer" | "seller";

/** What a side that has deleted its account is called (the sample's DELETED). */
const DELETED = "Deleted account";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONVERSATION_COLUMNS =
  "id, listing_id, listing_title, shop_id, seller_gone, status, created_at, last_message_at, completed_at, confirmed_at, confirmed_by, viewer_side, is_offer, request_id, request_title, buyer_gone, buyer_name, request_state";

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

const unique = (values: readonly string[]) => [...new Set(values)];

/** A conversation as my_conversations gives it to the reader. */
type ConversationView = {
  id: string;
  listing_id: string | null;
  listing_title: string | null;
  shop_id: string | null;
  seller_gone: boolean;
  status: string;
  created_at: string;
  last_message_at: string;
  completed_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  viewer_side: string | null;
  is_offer: boolean;
  request_id: string | null;
  request_title: string | null;
  buyer_gone: boolean;
  buyer_name: string | null;
  request_state: string | null;
};

/** The view's columns are nullable to the generated types; the view never gives a null id or flag. */
const asView = (rows: unknown) => rows as ConversationView[];

/** Every sale of the reader's due its auto-confirm, settled (decision 19). */
async function settle(db: DbClient): Promise<void> {
  const { error } = await db.rpc("settle_sales");
  if (error) failed("settle_sales", error);
}

/**
 * The shops by id, as the reader sees them: the "shops the reader deals with" policy keeps a Hub-paused shop's name and
 * photo (amendment 6). A shop that has gone is "A closed shop", with no photo, as the sample's shopOf.
 */
async function shopsById(db: DbClient, ids: readonly (string | null)[]): Promise<(id: string | null) => ConversationShop> {
  const wanted = unique(ids.filter((id): id is string => id !== null));
  const found = new Map<string, ConversationShop>();
  if (wanted.length > 0) {
    const { data, error } = await db.from("shops").select(SHOP_COLUMNS).in("id", wanted);
    if (error) failed("shops", error);
    for (const row of data) {
      const seller = toSeller(sellerRowFrom(row, []));
      found.set(row.id, { slug: seller.slug, name: seller.name, image: seller.image, campusSlug: seller.campusSlug });
    }
  }
  return (id) => (id ? found.get(id) : undefined) ?? { slug: "", name: CLOSED_SHOP, image: null, campusSlug: null };
}

/** The other side's name, as the reader sees it (the sample's otherName; spec 2.11, community actions spec 2.10). */
function otherName(row: ConversationView, side: Side, shopName: string): string {
  if (side === "buyer") {
    if (!row.seller_gone) return shopName;
    return row.is_offer ? CLOSED_SHOP : DELETED;
  }
  if (row.buyer_name) return row.buyer_name;
  // conversation_buyer_name is null for a buyer who has gone, and for an asker who hasn't written in the offer's thread.
  return !row.buyer_gone && row.is_offer ? UNNAMED_ASKER : DELETED;
}

/** The request an offer thread is about, by its title now while its page is up, else as it was offered on. */
async function requestTitles(rows: readonly ConversationView[]): Promise<Map<string, string>> {
  const ids = unique(rows.flatMap((row) => (row.request_id ? [row.request_id] : [])));
  const requests = await Promise.all(ids.map((id) => getRequest(id)));
  return new Map(requests.flatMap((request) => (request ? [[request.id, request.title] as const] : [])));
}

export const getInbox: typeof Sample.getInbox = async (accountId, tab) => {
  const side: Side = tab === "buying" ? "buyer" : "seller";
  const db = await forViewerAs(accountId);
  await settle(db);
  const found = await db
    .from("my_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("viewer_side", side)
    .order("last_message_at", { ascending: false })
    .order("id");
  if (found.error) failed("my_conversations", found.error);
  const rows = asView(found.data);
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const tails = await db.from("my_conversation_tails").select("conversation_id, last_body, last_side, unread").in("conversation_id", ids);
  if (tails.error) failed("my_conversation_tails", tails.error);
  const tailOf = new Map(tails.data.map((row) => [row.conversation_id, row]));
  const listingIds = unique(rows.flatMap((row) => (row.listing_id ? [row.listing_id] : [])));
  const [shopOf, listings, titles] = await Promise.all([
    shopsById(db, rows.map((row) => row.shop_id)),
    getListingsByIds(listingIds),
    requestTitles(rows),
  ]);
  const images = new Map(listings.map((listing) => [listing.id, listing.image]));
  return rows.map((row) => {
    const shop = shopOf(row.shop_id);
    const tail = tailOf.get(row.id);
    const image: ImageRef | null = row.listing_id ? (images.get(row.listing_id) ?? null) : shop.image;
    return {
      id: row.id,
      role: side,
      otherName: otherName(row, side, shop.name),
      listingTitle: row.listing_title,
      requestTitle: (row.request_id ? titles.get(row.request_id) : undefined) ?? row.request_title ?? null,
      image: image ? { ...image } : null,
      preview: tail?.last_body ? firstLine(tail.last_body) : "",
      lastFromViewer: tail?.last_side === side,
      lastMessageAt: iso(row.last_message_at),
      status: row.status as ConversationStatus,
      unread: (tail?.unread ?? 0) > 0,
    };
  });
};

/** The reader's conversation by id, or null when it isn't theirs (or isn't a uuid). */
async function ownConversation(db: DbClient, id: string): Promise<(ConversationView & { viewer_side: Side }) | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db.from("my_conversations").select(CONVERSATION_COLUMNS).eq("id", id).maybeSingle();
  if (error) failed("my_conversations", error);
  const row = data ? asView([data])[0] : null;
  return row && (row.viewer_side === "buyer" || row.viewer_side === "seller") ? (row as ConversationView & { viewer_side: Side }) : null;
}

/** A conversation's messages, oldest first: one conversation's, or several's. */
async function messagesOf(db: DbClient, ids: readonly string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from("messages")
    .select("id, conversation_id, side, body, swap_offer, sent_at")
    .in("conversation_id", [...ids])
    .order("sent_at")
    .order("id");
  if (error) failed("messages", error);
  return data;
}

export const getThread: typeof Sample.getThread = async (id, accountId) => {
  const db = await forViewerAs(accountId);
  if (!UUID.test(id)) return null;
  await settle(db);
  const row = await ownConversation(db, id);
  if (!row) return null;
  const side = row.viewer_side;
  const [messages, shopOf, detail, request] = await Promise.all([
    messagesOf(db, [row.id]),
    shopsById(db, [row.shop_id]),
    row.listing_id ? getListingDetail(row.listing_id) : Promise.resolve(null),
    row.is_offer && row.request_id ? getRequest(row.request_id) : Promise.resolve(null),
  ]);
  const shop = shopOf(row.shop_id);
  const other = otherName(row, side, shop.name);
  return {
    id: row.id,
    role: side,
    otherName: other,
    otherPresent: side === "buyer" ? !row.seller_gone : !row.buyer_gone,
    shop,
    listingTitle: row.listing_title,
    listing: detail ? { ...detail.listing } : null,
    // request_state: 'live' while the request's page is up, 'hidden' when the Hub hid it (told to the asker only).
    request:
      row.is_offer && row.request_id
        ? {
            id: row.request_id,
            title: request?.title ?? row.request_title ?? "",
            live: row.request_state === "live",
            hidden: row.request_state === "hidden",
          }
        : null,
    status: row.status as ConversationStatus,
    completedAt: iso(row.completed_at),
    confirmedAt: iso(row.confirmed_at),
    confirmedBy: row.confirmed_by as "buyer" | "auto" | null,
    messages: messages.map((message) => ({
      id: message.id,
      fromViewer: message.side === side,
      author: message.side === side ? "You" : other,
      body: message.body,
      swapOffer: message.swap_offer,
      sentAt: iso(message.sent_at),
    })),
  };
};

export const markThreadRead: typeof Sample.markThreadRead = async (id, accountId) => {
  const db = await forViewerAs(accountId);
  if (!UUID.test(id)) return;
  const { error } = await db.rpc("mark_thread_read", { p_conversation_id: id });
  if (error) failed("mark_thread_read", error);
};

export const unreadCounts: typeof Sample.unreadCounts = async (accountId) => {
  const { data, error } = await (await forViewerAs(accountId)).rpc("my_unread_counts");
  if (error) failed("my_unread_counts", error);
  const counts = data as { notifications: number; conversations: number; messages: number; sales_to_confirm: number };
  return {
    notifications: counts.notifications,
    conversations: counts.conversations,
    messages: counts.messages,
    salesToConfirm: counts.sales_to_confirm,
  };
};

export const findConversation: typeof Sample.findConversation = async (buyerId, target) => {
  const db = await forViewerAs(buyerId);
  let query = db
    .from("my_conversations")
    .select("id")
    .eq("viewer_side", "buyer")
    .eq("seller_gone", false)
    .eq("is_offer", false);
  if (target.kind === "listing") {
    query = query.eq("listing_id", target.listingId);
  } else {
    const shop = await db.from("shops").select("id").eq("slug", target.sellerSlug).maybeSingle();
    if (shop.error) failed("shops", shop.error);
    if (!shop.data) return null;
    query = query.is("listing_title", null).eq("shop_id", shop.data.id);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) failed("my_conversations", error);
  return data?.id ?? null;
};

export const exportConversations: typeof Sample.exportConversations = async (accountId) => {
  const db = await forViewerAs(accountId);
  await settle(db);
  const found = await db
    .from("my_conversations")
    .select(CONVERSATION_COLUMNS)
    .not("viewer_side", "is", null)
    .order("created_at")
    .order("id");
  if (found.error) failed("my_conversations", found.error);
  const rows = asView(found.data);
  if (rows.length === 0) return [];
  const [messages, shopOf, titles] = await Promise.all([
    messagesOf(db, rows.map((row) => row.id)),
    shopsById(db, rows.map((row) => row.shop_id)),
    requestTitles(rows),
  ]);
  return rows.map((row) => {
    const side = row.viewer_side as Side;
    const requestTitle = row.request_id ? (titles.get(row.request_id) ?? row.request_title) : null;
    return {
      with: otherName(row, side, shopOf(row.shop_id).name),
      about: requestTitle ? offerAbout(side, requestTitle) : row.listing_title,
      status: row.status as ConversationStatus,
      startedAt: iso(row.created_at),
      messages: messages
        .filter((message) => message.conversation_id === row.id)
        .map((message) => ({
          from: message.side === side ? ("you" as const) : ("them" as const),
          text: message.body,
          swapOffer: message.swap_offer,
          sentAt: iso(message.sent_at),
        })),
    };
  });
};

// --- The writes (Task 15; decisions 3 and 18) ------------------------------------------------------------------------

/** start_conversation's refusals, which the composer's own checks normally catch first (decision 3). */
const START_REFUSALS: readonly RefusalCode[] = ["not-found", "own-shop", "closed", "conversation-rate", "message-rate"];

/** The generated types say string where SQL takes null too (a text argument with no default). */
const orNull = (value: string | null) => value as string;

export const startConversation: typeof Sample.startConversation = async (input) => {
  const { data, error } = await (await forViewerAs(input.buyerId)).rpc("start_conversation", {
    p_listing_id: orNull(input.listing?.id ?? null),
    p_shop_slug: orNull(input.listing ? null : input.sellerSlug),
    p_body: input.body,
    p_swap_offer: orNull(input.swapOffer),
  });
  if (error) failed("start_conversation", error);
  const answer = data as { result: string; conversation_id?: string };
  if ((answer.result === "started" || answer.result === "added") && answer.conversation_id) {
    return { conversationId: answer.conversation_id, created: answer.result === "started" };
  }
  if (START_REFUSALS.includes(answer.result as RefusalCode)) throw new Refused(answer.result as RefusalCode);
  throw new Error(`start_conversation answered ${answer.result}`);
};

/**
 * A message in a thread: send_message's answer, the hour's messages counted again under the sender's lock. Its
 * "message-rate" throws Refused (decision 18), which sendReply catches; an id that isn't a uuid is "not-found".
 */
export const sendMessage: typeof Sample.sendMessage = async ({ conversationId, accountId, body }) => {
  const db = await forViewerAs(accountId);
  if (!UUID.test(conversationId)) return "not-found";
  const { data, error } = await db.rpc("send_message", { p_conversation_id: conversationId, p_body: body });
  if (error) failed("send_message", error);
  if (data === "message-rate") throw new Refused("message-rate");
  if (data === "sent" || data === "not-found" || data === "closed" || data === "waiting") return data;
  throw new Error(`send_message answered ${String(data)}`);
};

/** One of the sale's buttons (decision 30): mark_completed, confirm_sale or reject_sale, which settle first. */
async function saleMove(
  fn: "mark_completed" | "confirm_sale" | "reject_sale",
  { conversationId, accountId }: { conversationId: string; accountId: string },
): Promise<Sample.SaleResult> {
  const db = await forViewerAs(accountId);
  if (!UUID.test(conversationId)) return "not-allowed";
  const { data, error } = await db.rpc(fn, { p_conversation_id: conversationId });
  if (error) failed(fn, error);
  return data === "done" ? "done" : "not-allowed";
}

export const markCompleted: typeof Sample.markCompleted = (change) => saleMove("mark_completed", change);
export const confirmSale: typeof Sample.confirmSale = (change) => saleMove("confirm_sale", change);
export const rejectSale: typeof Sample.rejectSale = (change) => saleMove("reject_sale", change);

// --- Offers (Task 16; decision 23, amendment 6) -------------------------------------------------------------------------

/** start_offer's refusals, which sendOffer's own checks normally catch first (decision 23). */
const OFFER_REFUSALS: readonly RefusalCode[] = [
  "not-found",
  "own",
  "no-shop",
  "pending",
  "paused",
  "closed",
  "sample",
  "listing-invalid",
  "offer-rate",
  "message-rate",
];

/**
 * A shop's offer on a request: start_offer, one thread per shop and request. `askerId` is ignored: the database reads
 * the request's asker, whom no API role can see. The shop is the signed-in account's own, checked against
 * `sellerSlug` (decision 2). A refusal throws Refused (C4's sendOffer catches offer-rate and message-rate).
 */
export const startOffer: typeof Sample.startOffer = async (input) => {
  const [db, accountId] = await Promise.all([forViewer(), viewerId()]);
  const shop = await viewerShop(db, accountId);
  if (!shop || shop.slug !== input.sellerSlug) {
    throw new Error("A Supabase twin was asked about a shop that isn't the signed-in account's");
  }
  const { data, error } = await db.rpc("start_offer", {
    p_request_id: input.request.id,
    p_listing_id: orNull(input.listing?.id ?? null),
    p_body: input.body,
  });
  if (error) failed("start_offer", error);
  const answer = data as { result: string; conversation_id?: string };
  if ((answer.result === "offered" || answer.result === "already") && answer.conversation_id) return answer.conversation_id;
  if (OFFER_REFUSALS.includes(answer.result as RefusalCode)) throw new Refused(answer.result as RefusalCode);
  throw new Error(`start_offer answered ${answer.result}`);
};

/**
 * The app's first look at the limits (decision 18): the same counters as the database's own check, with no lock. The
 * shop is the signed-in account's own, which the database knows, so `shopSlug` isn't sent.
 */
export const countConversationsStartedSince: typeof Sample.countConversationsStartedSince = async (buyerId, since) => {
  const { data, error } = await (await forViewerAs(buyerId)).rpc("my_conversations_started_since", {
    p_since: since.toISOString(),
  });
  if (error) failed("my_conversations_started_since", error);
  return data;
};

export const countMessagesSentSince: typeof Sample.countMessagesSentSince = async (accountId, _shopSlug, since) => {
  const { data, error } = await (await forViewerAs(accountId)).rpc("my_messages_sent_since", { p_since: since.toISOString() });
  if (error) failed("my_messages_sent_since", error);
  return data;
};

export const forgetAccountInMessaging: typeof Sample.forgetAccountInMessaging = async () => {
  throw new Error("forgetAccountInMessaging runs in the database on Supabase");
};
