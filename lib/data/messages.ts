import { randomUUID } from "node:crypto";
import { messageNoteText, saleNoteText } from "@/lib/messaging/notification-text";
import { threadPath, type MessageTarget } from "@/lib/messaging/paths";
import { autoConfirmAt, firstLine } from "@/lib/messaging/rules";
import type {
  ConversationShop,
  ConversationStatus,
  ConversationSummary,
  ImageRef,
  InboxTab,
  Thread,
  UnreadCounts,
} from "@/lib/types";
import { getListingDetail, getListingsByIds, getSeller } from "./index";
import {
  countNewNotifications,
  deleteNotifications,
  markConversationNotificationsRead,
  markSaleNotificationsRead,
  notify,
  notifyAboutMessage,
} from "./notifications";
import type { ConversationRow, MessageRow } from "./rows";
import { sampleStore } from "./store";

// Conversations and messages (messaging spec section 4), shaped like the Supabase calls that will replace them. A
// conversation belongs to a shop: whoever owns the shop now answers (plan decision 1). Reads settle the 7-day
// auto-confirm (spec 2.5). Times come from the caller; only Server Actions call the functions that make ids.

type Side = "buyer" | "seller";

/** What a side that has deleted its account is called (plan decision 14). */
const DELETED = "Deleted account";
/** What a shop that no longer exists is called. */
const CLOSED_SHOP = "A closed shop";

/** The account that owns the shop now, or null (plan decision 1). */
function shopOwnerId(sellerSlug: string): string | null {
  for (const row of sampleStore().sellerProfiles.values()) {
    if (row.sellerSlug === sellerSlug) return row.accountId;
  }
  return null;
}

/** The account's side of a conversation, or null when it isn't theirs (spec 3.3: only the buyer and the seller). */
function sideOf(row: ConversationRow, accountId: string): Side | null {
  if (row.buyerId === accountId) return "buyer";
  if (!row.sellerGone && shopOwnerId(row.sellerSlug) === accountId) return "seller";
  return null;
}

/** Whether there's anyone on the other side to read a reply (plan decision 21). */
function otherSideThere(row: ConversationRow, side: Side): boolean {
  return side === "buyer" ? !row.sellerGone : row.buyerId !== null;
}

function messagesOf(conversationId: string): MessageRow[] {
  return [...sampleStore().messages.values()]
    .filter((row) => row.conversationId === conversationId)
    .sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
}

/**
 * A sale marked done confirms itself 7 days later (spec 2.5). There's no job runner, so every read checks. The buyer's
 * "sale to confirm" notification is read with it (messaging plan amendment 3).
 */
async function settle(row: ConversationRow, now: Date): Promise<void> {
  if (row.status !== "done" || !row.completedAt) return;
  const due = autoConfirmAt(row.completedAt);
  if (Date.parse(due) > now.getTime()) return;
  row.status = "confirmed";
  row.confirmedAt = due;
  row.confirmedBy = "auto";
  if (row.buyerId) await markSaleNotificationsRead(row.buyerId, row.id, now);
}

/** The buyer as the seller sees them: their first name (spec 2.11), never their email. */
function buyerName(row: ConversationRow): string {
  const buyer = row.buyerId ? sampleStore().accounts.get(row.buyerId) : undefined;
  return buyer?.firstName ?? DELETED;
}

async function shopOf(sellerSlug: string): Promise<ConversationShop> {
  const seller = await getSeller(sellerSlug);
  if (!seller) return { slug: sellerSlug, name: CLOSED_SHOP, image: null, campusSlug: null };
  return { slug: seller.slug, name: seller.name, image: seller.image, campusSlug: seller.campusSlug };
}

/** The other side's name, as `side` sees it (spec 2.11). */
function otherName(row: ConversationRow, side: Side, shopName: string): string {
  if (side === "buyer") return row.sellerGone ? DELETED : shopName;
  return buyerName(row);
}

function addMessage(row: ConversationRow, from: Side, body: string, swapOffer: string | null, now: Date): void {
  const id = `msg-${randomUUID()}`;
  sampleStore().messages.set(id, {
    id,
    conversationId: row.id,
    from,
    body,
    swapOffer,
    sentAt: now.toISOString(),
    readAt: null,
  });
  row.lastMessageAt = now.toISOString();
}

/**
 * Tells the other side about a message (plan decision 12: one unread message notification per conversation per
 * person). A buyer is still "asking" until someone has replied, so their second message before a reply says "asked"
 * too (messaging plan amendment 3). A shop with no owner yet has no one to tell.
 */
async function tellOtherSide(row: ConversationRow, from: Side, now: Date): Promise<void> {
  const to = from === "buyer" ? (row.sellerGone ? null : shopOwnerId(row.sellerSlug)) : row.buyerId;
  if (!to) return;
  const first = from === "buyer" && row.status === "asked";
  const sender = from === "buyer" ? buyerName(row) : (await shopOf(row.sellerSlug)).name;
  await notifyAboutMessage({
    accountId: to,
    conversationId: row.id,
    text: messageNoteText({ sender, listingTitle: row.listingTitle, first }),
    href: threadPath(row.id),
    now,
  });
}

function findRow(buyerId: string, target: MessageTarget): ConversationRow | null {
  for (const row of sampleStore().conversations.values()) {
    if (row.buyerId !== buyerId || row.sellerGone) continue;
    if (target.kind === "listing" && row.listingId === target.listingId) return row;
    if (target.kind === "shop" && row.listingId === null && row.sellerSlug === target.sellerSlug) return row;
  }
  return null;
}

/** The buyer's conversation about this listing, or with this shop's questions, if there is one (spec 2.2). */
export async function findConversation(buyerId: string, target: MessageTarget): Promise<string | null> {
  return findRow(buyerId, target)?.id ?? null;
}

export type NewConversation = {
  buyerId: string;
  /** The listing, or null for a question about the shop (plan decision 2). */
  listing: { id: string; title: string } | null;
  sellerSlug: string;
  body: string;
  swapOffer: string | null;
  now: Date;
};

/**
 * A buyer's first message (spec 2.1, 2.2 and 2.4): a new conversation, Asked, holding the message and its swap offer,
 * and a notification for the shop's owner. When the buyer already has one about the listing (or with the shop's
 * questions), the message joins it instead (plan decision 5). Server Actions only: it makes ids.
 */
export async function startConversation(input: NewConversation): Promise<{ conversationId: string; created: boolean }> {
  const target: MessageTarget = input.listing
    ? { kind: "listing", listingId: input.listing.id }
    : { kind: "shop", sellerSlug: input.sellerSlug };
  const existing = findRow(input.buyerId, target);
  if (existing) {
    addMessage(existing, "buyer", input.body, input.swapOffer, input.now);
    await tellOtherSide(existing, "buyer", input.now);
    return { conversationId: existing.id, created: false };
  }
  const at = input.now.toISOString();
  const row: ConversationRow = {
    id: `conv-${randomUUID()}`,
    listingId: input.listing?.id ?? null,
    listingTitle: input.listing?.title ?? null,
    sellerSlug: input.sellerSlug,
    buyerId: input.buyerId,
    sellerGone: false,
    status: "asked",
    createdAt: at,
    lastMessageAt: at,
    firstReplyAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
  };
  sampleStore().conversations.set(row.id, row);
  addMessage(row, "buyer", input.body, input.swapOffer, input.now);
  await tellOtherSide(row, "buyer", input.now);
  return { conversationId: row.id, created: true };
}

export type SendResult = "sent" | "not-found" | "closed";

/**
 * A message in a thread (spec 3.3). The seller's first reply moves Asked to Replied and its time is kept for the trust
 * badges (plan decision 30); the other side is told. "not-found" when the conversation isn't the account's, "closed"
 * when the other side has left (plan decision 21). Server Actions only: it makes ids.
 */
export async function sendMessage({
  conversationId,
  accountId,
  body,
  now,
}: {
  conversationId: string;
  accountId: string;
  body: string;
  now: Date;
}): Promise<SendResult> {
  const row = sampleStore().conversations.get(conversationId);
  const side = row ? sideOf(row, accountId) : null;
  if (!row || !side) return "not-found";
  if (!otherSideThere(row, side)) return "closed";
  await settle(row, now);
  addMessage(row, side, body, null, now);
  if (side === "seller") {
    if (row.status === "asked") row.status = "replied";
    row.firstReplyAt ??= now.toISOString();
  }
  await tellOtherSide(row, side, now);
  return "sent";
}

export type SaleResult = "done" | "not-allowed";

type SaleChange = { conversationId: string; accountId: string; now: Date };

/** The conversation, settled, when `accountId` is on `side` of it and it's `status`; otherwise null (plan decision 30). */
async function saleRow({ conversationId, accountId, now }: SaleChange, side: Side, status: ConversationStatus) {
  const row = sampleStore().conversations.get(conversationId);
  if (!row || sideOf(row, accountId) !== side) return null;
  await settle(row, now);
  return row.status === status ? row : null;
}

/**
 * The seller's Mark as completed (spec 2.5): Replied becomes Done, and the buyer is asked to confirm. Not when the
 * buyer has left: nobody could dispute it, so it wouldn't count (messaging plan amendment 3).
 */
export async function markCompleted(change: SaleChange): Promise<SaleResult> {
  const row = await saleRow(change, "seller", "replied");
  if (!row || !row.buyerId) return "not-allowed";
  row.status = "done";
  row.completedAt = change.now.toISOString();
  await notify({
    accountId: row.buyerId,
    kind: "sale-to-confirm",
    subjectId: row.id,
    text: saleNoteText({ shop: (await shopOf(row.sellerSlug)).name, listingTitle: row.listingTitle }),
    href: threadPath(row.id),
    now: change.now,
  });
  return "done";
}

/**
 * The buyer's Confirm the sale (spec 2.5): Done becomes Confirmed, and the sale to confirm is read. Not when the seller
 * has left: nobody stands behind the claim, so it wouldn't count (messaging plan amendment 6).
 */
export async function confirmSale(change: SaleChange): Promise<SaleResult> {
  const row = await saleRow(change, "buyer", "done");
  if (!row || row.sellerGone) return "not-allowed";
  row.status = "confirmed";
  row.confirmedAt = change.now.toISOString();
  row.confirmedBy = "buyer";
  await markSaleNotificationsRead(change.accountId, row.id, change.now);
  return "done";
}

/**
 * The buyer's It didn't happen (spec 2.5): back to Replied, no completion counted, and the sale to confirm is read. Not
 * when the seller has left, as for Confirm the sale.
 */
export async function rejectSale(change: SaleChange): Promise<SaleResult> {
  const row = await saleRow(change, "buyer", "done");
  if (!row || row.sellerGone) return "not-allowed";
  row.status = "replied";
  row.completedAt = null;
  await markSaleNotificationsRead(change.accountId, row.id, change.now);
  return "done";
}

const unique = (values: readonly string[]) => [...new Set(values)];

/**
 * The inbox (spec 3.2 and 2.10): the account's conversations on one side, newest activity first, each with the other
 * side's name, what it's about, the last message's first line, the status and whether something is unread.
 */
export async function getInbox(accountId: string, tab: InboxTab, now: Date): Promise<ConversationSummary[]> {
  const side: Side = tab === "buying" ? "buyer" : "seller";
  const rows = [...sampleStore().conversations.values()]
    .filter((row) => sideOf(row, accountId) === side)
    .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  for (const row of rows) await settle(row, now);
  const listingIds = unique(rows.flatMap((row) => (row.listingId ? [row.listingId] : [])));
  const [listings, shops] = await Promise.all([
    getListingsByIds(listingIds),
    Promise.all(unique(rows.map((row) => row.sellerSlug)).map(shopOf)),
  ]);
  const images = new Map(listings.map((listing) => [listing.id, listing.image]));
  const shopsBySlug = new Map(shops.map((shop) => [shop.slug, shop]));
  return rows.map((row) => {
    const shop = shopsBySlug.get(row.sellerSlug)!;
    const messages = messagesOf(row.id);
    const last = messages.at(-1);
    const image: ImageRef | null = row.listingId ? (images.get(row.listingId) ?? null) : shop.image;
    return {
      id: row.id,
      role: side,
      otherName: otherName(row, side, shop.name),
      listingTitle: row.listingTitle,
      image: image ? { ...image } : null,
      preview: last ? firstLine(last.body) : "",
      lastFromViewer: last?.from === side,
      lastMessageAt: row.lastMessageAt,
      status: row.status,
      unread: messages.some((message) => message.from !== side && message.readAt === null),
    };
  });
}

/** A thread (spec 3.3), or null when it isn't the account's or doesn't exist: the page then answers 404. */
export async function getThread(id: string, accountId: string, now: Date): Promise<Thread | null> {
  const row = sampleStore().conversations.get(id);
  const side = row ? sideOf(row, accountId) : null;
  if (!row || !side) return null;
  await settle(row, now);
  const [detail, shop] = await Promise.all([
    row.listingId ? getListingDetail(row.listingId) : Promise.resolve(null),
    shopOf(row.sellerSlug),
  ]);
  const other = otherName(row, side, shop.name);
  return {
    id: row.id,
    role: side,
    otherName: other,
    otherPresent: otherSideThere(row, side),
    shop,
    listingTitle: row.listingTitle,
    listing: detail ? { ...detail.listing } : null,
    status: row.status,
    completedAt: row.completedAt,
    confirmedAt: row.confirmedAt,
    confirmedBy: row.confirmedBy,
    messages: messagesOf(row.id).map((message) => ({
      id: message.id,
      fromViewer: message.from === side,
      author: message.from === side ? "You" : other,
      body: message.body,
      swapOffer: message.swapOffer,
      sentAt: message.sentAt,
    })),
  };
}

/** Opening a thread marks the other side's messages and its notifications read (spec 3.3). */
export async function markThreadRead(id: string, accountId: string, now: Date): Promise<void> {
  const row = sampleStore().conversations.get(id);
  const side = row ? sideOf(row, accountId) : null;
  if (!row || !side) return;
  for (const message of sampleStore().messages.values()) {
    if (message.conversationId === id && message.from !== side && message.readAt === null) {
      message.readAt = now.toISOString();
    }
  }
  await markConversationNotificationsRead(accountId, id, now);
}

/** What needs the account's attention (spec section 4): the header, the account page and the strip use it. */
export async function unreadCounts(accountId: string, now: Date): Promise<UnreadCounts> {
  let conversations = 0;
  let messages = 0;
  let salesToConfirm = 0;
  for (const row of sampleStore().conversations.values()) {
    const side = sideOf(row, accountId);
    if (!side) continue;
    await settle(row, now);
    const unread = messagesOf(row.id).filter((message) => message.from !== side && message.readAt === null).length;
    messages += unread;
    if (unread > 0) conversations += 1;
    if (side === "buyer" && row.status === "done") salesToConfirm += 1;
  }
  return { notifications: await countNewNotifications(accountId), conversations, messages, salesToConfirm };
}

/**
 * Deleting an account (plan decision 14). Its messages go. Each conversation it was in stays for the other side, with
 * that side's own messages, unless the other side has gone too or nothing is left in it, when it goes. The
 * conversation's times stay, for the trust badges. Notifications about those conversations go, since they name the
 * account. `shopSlug` is the account's storefront, if it has one.
 *
 * Two more things follow from the person having left (messaging plan amendments 3 and 6). The other side's remaining
 * messages are no longer read: their `readAt` was when the deleted person read them. And a sale waiting to be
 * confirmed (Done) goes back to Replied, with its completion forgotten, whichever side left: with the buyer gone nobody
 * can dispute it, and with the seller gone nobody stands behind it. So nobody has to confirm it and it never confirms
 * itself. A sale that is already Confirmed stays.
 */
export async function forgetAccountInMessaging(accountId: string, shopSlug: string | null): Promise<void> {
  const { conversations, messages } = sampleStore();
  const touched = new Set<string>();
  for (const row of conversations.values()) {
    const side: Side | null =
      row.buyerId === accountId ? "buyer" : shopSlug && !row.sellerGone && row.sellerSlug === shopSlug ? "seller" : null;
    if (!side) continue;
    touched.add(row.id);
    for (const [id, message] of messages) {
      if (message.conversationId !== row.id) continue;
      if (message.from === side) messages.delete(id);
      else message.readAt = null;
    }
    if (side === "buyer") row.buyerId = null;
    else row.sellerGone = true;
    // A sale waiting to be confirmed has lost either the buyer who could dispute it or the seller who made the claim
    // (messaging plan amendment 6).
    if (row.status === "done") {
      row.status = "replied";
      row.completedAt = null;
    }
  }
  for (const id of touched) {
    const row = conversations.get(id)!;
    const empty = !messagesOf(id).length;
    if (!(row.buyerId === null && row.sellerGone) && !empty) continue;
    conversations.delete(id);
    for (const [messageId, message] of messages) {
      if (message.conversationId === id) messages.delete(messageId);
    }
  }
  await deleteNotifications({ accountId, subjectIds: touched });
}

/** A conversation in the account's data export (plan decision 15). No ids. */
export type ConversationExport = {
  with: string;
  /** The listing's title, or null for a question about the shop. */
  about: string | null;
  status: ConversationStatus;
  startedAt: string;
  messages: { from: "you" | "them"; text: string; swapOffer: string | null; sentAt: string }[];
};

/**
 * The account's conversations for its data export, oldest first. A sale that has confirmed itself is settled first, so
 * the export never says "done" for it (messaging plan amendment 3); that also reads its "sale to confirm" notification,
 * so export the notifications after this.
 */
export async function exportConversations(accountId: string, now: Date): Promise<ConversationExport[]> {
  const rows = [...sampleStore().conversations.values()]
    .filter((row) => sideOf(row, accountId) !== null)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  for (const row of rows) await settle(row, now);
  return Promise.all(
    rows.map(async (row) => {
      const side = sideOf(row, accountId)!;
      return {
        with: otherName(row, side, (await shopOf(row.sellerSlug)).name),
        about: row.listingTitle,
        status: row.status,
        startedAt: row.createdAt,
        messages: messagesOf(row.id).map((message) => ({
          from: message.from === side ? ("you" as const) : ("them" as const),
          text: message.body,
          swapOffer: message.swapOffer,
          sentAt: message.sentAt,
        })),
      };
    }),
  );
}
