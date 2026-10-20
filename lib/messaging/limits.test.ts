import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationRow } from "@/lib/data/rows";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { messageLimitErrors } from "./limits";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const AYANDA = { id: "acc-ayanda", email: "ayanda@eduvos.com", seller: null };

/** `count` conversations the account started as a buyer, `minutes` ago, each with its first message. */
function started(buyerId: string, count: number, minutes: number) {
  const { conversations, messages } = sampleStore();
  for (let n = 0; n < count; n += 1) {
    const id = `conv-limit-${buyerId}-${minutes}-${n}`;
    const at = minutesAgo(minutes);
    const row: ConversationRow = {
      id,
      listingId: null,
      listingTitle: null,
      sellerSlug: "tech-corner",
      buyerId,
      sellerGone: false,
      status: "asked",
      createdAt: at,
      lastMessageAt: at,
      firstReplyAt: null,
      completedAt: null,
      confirmedAt: null,
      confirmedBy: null,
    };
    conversations.set(id, row);
    messages.set(`msg-${id}`, { id: `msg-${id}`, conversationId: id, from: "buyer", body: "Hi", swapOffer: null, sentAt: at, readAt: null });
  }
}

/** `count` more messages from the buyer in one of its conversations, `minutes` ago. */
function sent(buyerId: string, count: number, minutes: number) {
  started(buyerId, 1, minutes + 5000);
  const conversationId = `conv-limit-${buyerId}-${minutes + 5000}-0`;
  for (let n = 0; n < count; n += 1) {
    sampleStore().messages.set(`msg-extra-${minutes}-${n}`, {
      id: `msg-extra-${minutes}-${n}`,
      conversationId,
      from: "buyer",
      body: "More",
      swapOffer: null,
      sentAt: minutesAgo(minutes),
      readAt: null,
    });
  }
}

describe("messageLimitErrors (stage K spec 4; Lama, 2026-10-20)", () => {
  it("lets the 40th new conversation in 24 hours through, and refuses the 41st", async () => {
    started(AYANDA.id, 39, 60 * 23);
    expect(await messageLimitErrors(AYANDA, { newConversation: true }, NOW)).toEqual([]);
    started(AYANDA.id, 1, 30);
    expect(await messageLimitErrors(AYANDA, { newConversation: true }, NOW)).toEqual(["conversation-rate"]);
  });

  it("counts conversations only for a new one: a message into one it has goes through at 40", async () => {
    started(AYANDA.id, 40, 60);
    expect(await messageLimitErrors(AYANDA, { newConversation: false }, NOW)).toEqual([]);
  });

  it("forgets conversations started more than 24 hours ago", async () => {
    started(AYANDA.id, 40, 60 * 24 + 1);
    expect(await messageLimitErrors(AYANDA, { newConversation: true }, NOW)).toEqual([]);
  });

  it("lets the 120th message in an hour through, and refuses the 121st", async () => {
    sent(AYANDA.id, 119, 10);
    expect(await messageLimitErrors(AYANDA, { newConversation: false }, NOW)).toEqual([]);
    sent(AYANDA.id, 1, 5);
    expect(await messageLimitErrors(AYANDA, { newConversation: false }, NOW)).toEqual(["message-rate"]);
  });

  it("forgets messages sent more than an hour ago", async () => {
    sent(AYANDA.id, 120, 61);
    expect(await messageLimitErrors(AYANDA, { newConversation: false }, NOW)).toEqual([]);
  });

  it("names the conversations limit first when both are reached", async () => {
    started(AYANDA.id, 40, 30);
    sent(AYANDA.id, 120, 10);
    expect(await messageLimitErrors(AYANDA, { newConversation: true }, NOW)).toEqual(["conversation-rate"]);
    expect(await messageLimitErrors(AYANDA, { newConversation: false }, NOW)).toEqual(["message-rate"]);
  });

  it("counts a seller's messages through their shop", async () => {
    const seller = { id: "acc-sipho-2", email: "sipho2@eduvos.com", seller: { sellerSlug: "tech-corner" } };
    const { conversations, messages } = sampleStore();
    conversations.set("conv-shop", { ...([...conversations.values()][0] as ConversationRow), id: "conv-shop", sellerSlug: "tech-corner", sellerGone: false });
    for (let n = 0; n < 120; n += 1) {
      messages.set(`msg-shop-${n}`, { id: `msg-shop-${n}`, conversationId: "conv-shop", from: "seller", body: "Yes", swapOffer: null, sentAt: minutesAgo(1), readAt: null });
    }
    expect(await messageLimitErrors(seller as never, { newConversation: false }, NOW)).toEqual(["message-rate"]);
  });

  it("holds for staff as for anyone: a role changes nothing (spec decision 10)", async () => {
    started("acc-staffer", 40, 30);
    const staffer = { id: "acc-staffer", email: "staffer@eduvos.com", seller: null, roles: ["admin"] };
    expect(await messageLimitErrors(staffer, { newConversation: true }, NOW)).toEqual(["conversation-rate"]);
  });

  it("exempts each sample account in sample mode, and none with sample mode off", async () => {
    started("acc-student", 40, 30);
    const student = { id: "acc-student", email: "student@eduvos.com", seller: null };
    expect(await messageLimitErrors(student, { newConversation: true }, NOW)).toEqual([]);
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    expect(await messageLimitErrors(student, { newConversation: true }, NOW)).toEqual(["conversation-rate"]);
  });
});
