import { describe, expect, it } from "vitest";
import { sampleAccounts } from "./accounts";
import { listings } from "./listings";
import { sampleConversations, sampleMessages, sampleNotifications } from "./messages";

const listingsById = new Map(listings.map((listing) => [listing.id, listing]));
const accountIds = new Set(sampleAccounts.map(({ account }) => account.id));
const owners = new Map(
  sampleAccounts.flatMap(({ seller }) => (seller?.sellerSlug ? [[seller.sellerSlug, seller.accountId] as const] : [])),
);
const unique = (ids: readonly string[]) => new Set(ids).size === ids.length;

describe("sample conversations (messaging plan decision 16)", () => {
  it("has unique ids in every table", () => {
    expect(unique(sampleConversations.map((row) => row.id))).toBe(true);
    expect(unique(sampleMessages.map((row) => row.id))).toBe(true);
    expect(unique(sampleNotifications.map((row) => row.id))).toBe(true);
  });

  it("puts a sample buyer and an owned shop on a real listing, keeping its title", () => {
    for (const conversation of sampleConversations) {
      const listing = listingsById.get(conversation.listingId ?? "");
      expect(listing, conversation.id).toBeDefined();
      expect(conversation.listingTitle, conversation.id).toBe(listing!.title);
      expect(conversation.sellerSlug, conversation.id).toBe(listing!.sellerSlug);
      expect(accountIds.has(conversation.buyerId ?? ""), conversation.id).toBe(true);
      expect(owners.has(conversation.sellerSlug), conversation.id).toBe(true);
      expect(owners.get(conversation.sellerSlug), conversation.id).not.toBe(conversation.buyerId);
    }
  });

  it("starts each conversation with the buyer's message and keeps its times in step with its messages", () => {
    for (const conversation of sampleConversations) {
      const messages = sampleMessages
        .filter((message) => message.conversationId === conversation.id)
        .sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
      expect(messages[0].from, conversation.id).toBe("buyer");
      expect(conversation.createdAt, conversation.id).toBe(messages[0].sentAt);
      expect(conversation.lastMessageAt, conversation.id).toBe(messages.at(-1)!.sentAt);
      expect(conversation.firstReplyAt, conversation.id).toBe(messages.find((message) => message.from === "seller")?.sentAt);
      expect(messages.slice(1).every((message) => message.swapOffer === null), conversation.id).toBe(true);
    }
    expect(sampleMessages.every((message) => sampleConversations.some((row) => row.id === message.conversationId))).toBe(
      true,
    );
  });

  it("only offers a swap on a listing that takes swaps (spec 2.4)", () => {
    for (const message of sampleMessages.filter((row) => row.swapOffer !== null)) {
      const conversation = sampleConversations.find((row) => row.id === message.conversationId)!;
      expect(listingsById.get(conversation.listingId!)?.payMode, message.id).not.toBe("cash");
    }
  });

  it("points each notification at a conversation its account is part of", () => {
    for (const note of sampleNotifications) {
      const conversation = sampleConversations.find((row) => row.id === note.subjectId);
      expect(conversation, note.id).toBeDefined();
      expect([conversation!.buyerId, owners.get(conversation!.sellerSlug)], note.id).toContain(note.accountId);
      expect(note.href, note.id).toBe(`/messages/${note.subjectId}`);
    }
  });

  it("gives Thandi a new reply, two new notifications and a sale to confirm", () => {
    const thandis = sampleConversations.filter((row) => row.buyerId === "acc-student").map((row) => row.id);
    const unreadReplies = sampleMessages.filter(
      (row) => thandis.includes(row.conversationId) && row.from === "seller" && row.readAt === null,
    );
    expect(unreadReplies).toHaveLength(1);
    expect(sampleNotifications.filter((row) => row.accountId === "acc-student" && row.readAt === null)).toHaveLength(2);
    expect(sampleConversations.filter((row) => row.buyerId === "acc-student" && row.status === "done")).toHaveLength(1);
    // Sipho has read everything, so tests that open these as the sample seller change nothing.
    expect(sampleMessages.filter((row) => row.from === "buyer" && row.readAt === null)).toEqual([]);
    expect(sampleNotifications.filter((row) => row.accountId === "acc-seller" && row.readAt === null)).toEqual([]);
  });
});
