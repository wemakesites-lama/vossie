import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { findConversation, getThread, sendMessage, startConversation } from "@/lib/data/messages";
import { Refused } from "@/lib/data/refused";
import { createReport } from "@/lib/data/reports";
import { createSession } from "@/lib/data/sessions";
import type { ConversationRow } from "@/lib/data/rows";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { confirmTheSale, markAsCompleted, saleDidntHappen, sendFirstMessage, sendReply, sendReport } from "./actions";
import { composerFormKey, replyFormKey, reportFormKey, sentNoteKey } from "./paths";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

// The data calls a Supabase twin can refuse after the action's own checks passed (C2/C3 plan decision 3), as spies
// that call through, so a test can make one reject.
vi.mock("@/lib/data/messages", async (original) => {
  const messages = await original<typeof import("@/lib/data/messages")>();
  return {
    ...messages,
    startConversation: vi.fn(messages.startConversation),
    sendMessage: vi.fn(messages.sendMessage),
  };
});
vi.mock("@/lib/data/reports", async (original) => {
  const reports = await original<typeof import("@/lib/data/reports")>();
  return { ...reports, createReport: vi.fn(reports.createReport) };
});

// The sample accounts are exempt from the message limits in sample mode (stage K spec decision 10), and these tests
// sign in as them, so the exemption is switched off here unless a test switches it on (plan decision 16).
const samples = vi.hoisted(() => ({ exempt: false }));
vi.mock("@/lib/auth/sample-accounts", () => ({ isSampleAccount: () => samples.exempt }));

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  samples.exempt = false;
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

/** A form's fields, as the browser posts them. */
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

/** A browser signed in as `accountId`: a stored session and its token in the cookie. */
async function signedInAs(accountId: string) {
  const token = `token-${accountId}`;
  await createSession({
    key: hashToken(token),
    accountId,
    createdAt: NOW,
    expiresAt: new Date("2026-11-13T08:42:00.000Z"),
  });
  request.cookies.set(SESSION_COOKIE, token);
}

/** The conversation id at the end of a thread's address. */
const idOf = (url: string) => url.split("/").at(-1)!;

describe("the composer's Send (messaging spec 3.1)", () => {
  it("starts the conversation, leaves \"Sent.\" for the thread, and replaces the form with the thread", async () => {
    await signedInAs("acc-mentor");
    const redirect = await redirectSignalOf(() =>
      sendFirstMessage(form({ listing: "l-001", body: "  Hi! Is it still available?  " })),
    );
    expect(redirect.url).toMatch(/^\/messages\/conv-[0-9a-f-]{36}$/);
    expect(redirect.type).toBe("replace");
    expect(request.refreshed).toBe(true);
    const id = idOf(redirect.url);
    expect((await getThread(id, "acc-mentor", NOW))?.messages).toMatchObject([
      { body: "Hi! Is it still available?", swapOffer: null },
    ]);
    expect(await readFormState(sentNoteKey(id))).toMatchObject({ notice: "sent" });
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-001" }))).toBeNull();
  });

  it("keeps what was typed and says what's wrong, storing nothing", async () => {
    await signedInAs("acc-mentor");
    const redirect = await redirectSignalOf(() =>
      sendFirstMessage(form({ listing: "l-007", body: " ", swapOffer: "x".repeat(201) })),
    );
    expect([redirect.url, redirect.type]).toEqual(["/listings/l-007/message", "replace"]);
    expect(request.refreshed).toBe(false);
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-007" }))).toMatchObject({
      errors: ["message-missing", "swap-length"],
      values: { body: "", swapOffer: "x".repeat(201) },
      notice: null,
    });
    expect(sampleStore().conversations.size).toBe(2);
  });

  it("stops to warn about scam words, then sends when Send anyway is pressed (spec 2.3)", async () => {
    await signedInAs("acc-mentor");
    const fields = { listing: "l-001", body: "Can I pay a deposit first?" };
    expect(await redirectOf(() => sendFirstMessage(form(fields)))).toBe("/listings/l-001/message");
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-001" }))).toMatchObject({
      errors: [],
      notice: "check",
      values: { body: "Can I pay a deposit first?", warnings: "advance,deposit" },
    });
    expect(await findConversation("acc-mentor", { kind: "listing", listingId: "l-001" })).toBeNull();
    expect(await redirectOf(() => sendFirstMessage(form({ ...fields, anyway: "yes" })))).toMatch(/^\/messages\/conv-/);
  });

  it("keeps a swap offer only when the listing takes swaps (spec 2.4)", async () => {
    await signedInAs("acc-mentor");
    const cash = await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Hi", swapOffer: "My old phone" })));
    const swap = await redirectOf(() => sendFirstMessage(form({ listing: "l-007", body: "Hi", swapOffer: "My old phone" })));
    const offerIn = async (url: string) => (await getThread(idOf(url), "acc-mentor", NOW))!.messages[0].swapOffer;
    expect(await offerIn(cash)).toBeNull();
    expect(await offerIn(swap)).toBe("My old phone");
  });

  it("sends nothing to the seller's own shop or to a sold or paused listing (spec 3.1)", async () => {
    await signedInAs("acc-seller");
    expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Hi" })))).toBe("/listings/l-001/message");
    expect(await redirectOf(() => sendFirstMessage(form({ shop: "tech-corner", body: "Hi" })))).toBe(
      "/sellers/tech-corner/message",
    );
    expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-026", body: "Hi" })))).toBe("/listings/l-026/message");
    expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-016", body: "Hi" })))).toBe("/listings/l-016/message");
    expect(sampleStore().conversations.size).toBe(2);
  });

  it("sends a signed-out visitor to sign in, coming back to the composer, and a bad target to browse", async () => {
    expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Hi" })))).toBe(
      "/login?next=%2Flistings%2Fl-001%2Fmessage",
    );
    await signedInAs("acc-mentor");
    const badTargets: Record<string, string>[] = [{ listing: "../admin" }, { listing: "l-nope" }, { shop: "nope" }, {}];
    for (const fields of badTargets) {
      expect(await redirectOf(() => sendFirstMessage(form({ ...fields, body: "Hi" }))), JSON.stringify(fields)).toBe(
        "/browse",
      );
    }
    expect(sampleStore().conversations.size).toBe(2);
  });

  it("asks a shop a question from the storefront, with no swap (plan decision 2)", async () => {
    await signedInAs("acc-mentor");
    const url = await redirectOf(() =>
      sendFirstMessage(form({ shop: "tech-corner", body: "Do you fix screens?", swapOffer: "x" })),
    );
    const thread = (await getThread(idOf(url), "acc-mentor", NOW))!;
    expect(thread).toMatchObject({ listing: null, listingTitle: null, shop: { slug: "tech-corner" } });
    expect(thread.messages[0].swapOffer).toBeNull();
  });
});

describe("a reply (messaging spec 3.3)", () => {
  it("adds the reply, clears the form and draws the thread again (plan decision 6)", async () => {
    await signedInAs("acc-seller");
    const redirect = await redirectSignalOf(() =>
      sendReply(form({ conversation: "conv-s1", body: "Still yours if you want it." })),
    );
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/messages/conv-s1", "replace", true]);
    expect((await getThread("conv-s1", "acc-seller", NOW))?.messages.at(-1)).toMatchObject({
      author: "You",
      body: "Still yours if you want it.",
    });
    expect(await readFormState(replyFormKey("conv-s1"))).toBeNull();
  });

  it("keeps a reply that's empty, too long or has scam words, saying what's wrong (plan decision 9)", async () => {
    await signedInAs("acc-student");
    const state = () => readFormState(replyFormKey("conv-s1"));
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "" })));
    expect(await state()).toMatchObject({ errors: ["message-missing"] });
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "y".repeat(1001) })));
    expect(await state()).toMatchObject({ errors: ["message-length"], values: { body: "y".repeat(1001) } });
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "What's your account number?" })));
    expect(await state()).toMatchObject({ errors: [], notice: "check", values: { warnings: "bank" } });
    expect((await getThread("conv-s1", "acc-student", NOW))?.messages).toHaveLength(2);
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "What's your account number?", anyway: "yes" })));
    expect((await getThread("conv-s1", "acc-student", NOW))?.messages).toHaveLength(3);
  });

  it("sends a reply to someone else's conversation, or a bad id, to the inbox, storing nothing", async () => {
    await signedInAs("acc-mentor");
    expect(await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "Hi" })))).toBe("/messages");
    expect(await redirectOf(() => sendReply(form({ conversation: "conv-s1/../x", body: "Hi" })))).toBe("/messages");
    expect(sampleStore().messages.size).toBe(5);
  });
});

describe("the sale (messaging spec 2.5)", () => {
  it("marks it completed for the seller and confirms it for the buyer, drawing the thread again each time", async () => {
    await signedInAs("acc-seller");
    const redirect = await redirectSignalOf(() => markAsCompleted(form({ conversation: "conv-s1" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/messages/conv-s1", "replace", true]);
    expect(sampleStore().conversations.get("conv-s1")?.status).toBe("done");
    resetRequest(request);
    await signedInAs("acc-student");
    expect(await redirectOf(() => confirmTheSale(form({ conversation: "conv-s1" })))).toBe("/messages/conv-s1");
    expect(sampleStore().conversations.get("conv-s1")).toMatchObject({ status: "confirmed", confirmedBy: "buyer" });
  });

  it("reopens a sale the buyer says didn't happen, and ignores a press from the wrong side or a bad id", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => confirmTheSale(form({ conversation: "conv-s2" })));
    expect(sampleStore().conversations.get("conv-s2")?.status).toBe("done");
    resetRequest(request);
    await signedInAs("acc-student");
    await redirectOf(() => saleDidntHappen(form({ conversation: "conv-s2" })));
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({ status: "replied", completedAt: null });
    expect(await redirectOf(() => markAsCompleted(form({ conversation: "nope!" })))).toBe("/messages");
  });
});

describe("Send report (messaging spec 2.8 and 3.4)", () => {
  it("stores the report with the target's title, and replaces the form with the thank-you", async () => {
    await signedInAs("acc-mentor");
    const redirect = await redirectSignalOf(() =>
      sendReport(form({ kind: "listing", id: "l-001", reason: "misleading", detail: " Not the model in the photo. " })),
    );
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/report/sent?listing=l-001", "replace", true]);
    expect([...sampleStore().reports.values()]).toMatchObject([
      {
        reporterId: "acc-mentor",
        targetKind: "listing",
        targetId: "l-001",
        targetTitle: "Casio fx-991ZA Plus calculator",
        reason: "misleading",
        detail: "Not the model in the photo.",
        status: "open",
      },
    ]);
    // Part B's request page ("Recheck" item 15).
    expect(await redirectOf(() => sendReport(form({ kind: "request", id: "r-001", reason: "spam" })))).toBe(
      "/report/sent?request=r-001",
    );
  });

  it("asks for a reason and keeps the detail under 500 characters, storing nothing", async () => {
    await signedInAs("acc-mentor");
    expect(await redirectOf(() => sendReport(form({ kind: "seller", id: "tech-corner", detail: "z".repeat(501) })))).toBe(
      "/report?seller=tech-corner",
    );
    expect(await readFormState(reportFormKey({ kind: "seller", id: "tech-corner" }))).toMatchObject({
      errors: ["reason-missing", "detail-length"],
      values: { reason: "", detail: "z".repeat(501) },
    });
    expect(sampleStore().reports.size).toBe(0);
  });

  it("goes straight to the thank-you for a target the account has already reported (plan decision 17)", async () => {
    await signedInAs("acc-mentor");
    const fields = { kind: "listing", id: "l-001", reason: "spam" };
    await redirectOf(() => sendReport(form(fields)));
    expect(await redirectOf(() => sendReport(form(fields)))).toBe("/report/sent?listing=l-001");
    expect(sampleStore().reports.size).toBe(1);
  });

  it("allows 10 reports a day (plan decision 17)", async () => {
    await signedInAs("acc-mentor");
    for (let n = 0; n < 10; n++) {
      await createReport({
        reporterId: "acc-mentor",
        target: { kind: "listing", id: `l-x${n}` },
        targetTitle: "Something",
        reason: "spam",
        detail: "",
        now: new Date(NOW.getTime() - n * 60_000),
      });
    }
    await redirectOf(() => sendReport(form({ kind: "listing", id: "l-001", reason: "spam" })));
    expect(await readFormState(reportFormKey({ kind: "listing", id: "l-001" }))).toMatchObject({ errors: ["report-rate"] });
    expect(sampleStore().reports.size).toBe(10);
  });

  it("says report-rate when the database counts an 11th report the action's own count missed (C2/C3 plan Task 13)", async () => {
    await signedInAs("acc-mentor");
    vi.mocked(createReport).mockRejectedValueOnce(new Refused("rate-limited"));
    const redirect = await redirectSignalOf(() =>
      sendReport(form({ kind: "listing", id: "l-001", reason: "misleading", detail: "Not the model." })),
    );
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/report?listing=l-001", "replace", false]);
    expect(await readFormState(reportFormKey({ kind: "listing", id: "l-001" }))).toMatchObject({
      errors: ["report-rate"],
      values: { reason: "misleading", detail: "Not the model." },
      notice: null,
    });
  });

  it("goes home when the database finds the target gone after the action's check (C2/C3 plan Task 13)", async () => {
    await signedInAs("acc-mentor");
    vi.mocked(createReport).mockRejectedValueOnce(new Refused("not-found"));
    expect(await redirectOf(() => sendReport(form({ kind: "listing", id: "l-001", reason: "spam" })))).toBe("/");
    expect(await readFormState(reportFormKey({ kind: "listing", id: "l-001" }))).toBeNull();
  });

  it("sends a signed-out visitor to sign in, coming back to the form, and an unknown target home", async () => {
    expect(await redirectOf(() => sendReport(form({ kind: "listing", id: "l-001", reason: "spam" })))).toBe(
      "/login?next=%2Freport%3Flisting%3Dl-001",
    );
    await signedInAs("acc-mentor");
    expect(await redirectOf(() => sendReport(form({ kind: "listing", id: "l-nope", reason: "spam" })))).toBe("/");
    expect(await redirectOf(() => sendReport(form({ kind: "account", id: "acc-admin", reason: "spam" })))).toBe("/");
    expect(sampleStore().reports.size).toBe(0);
  });
});

describe("badges after a reply or a confirmed sale (staff tools spec 2.7, plan decision 8)", () => {
  it("works the shop's badge out after the seller replies, and expires sellers only when it changed", async () => {
    await signedInAs("acc-seller");
    // Tech corner's sample badge is Responsive; two enquiries earn New seller.
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "It's still here." })));
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("new-seller");
    expect(request.updatedTags).toEqual(["sellers"]);
    await redirectOf(() => sendReply(form({ conversation: "conv-s1", body: "Any time after 12:00." })));
    expect(request.updatedTags).toEqual(["sellers"]);
  });

  it("works it out after the buyer confirms a sale", async () => {
    sampleStore().sellers.get("tech-corner")!.badge = "trusted";
    await signedInAs("acc-student");
    await redirectOf(() => confirmTheSale(form({ conversation: "conv-s2" })));
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("new-seller");
    expect(request.updatedTags).toEqual(["sellers"]);
  });
});

/** `count` conversations `buyerId` started as a buyer half an hour ago, each with its first message (plan decision 16). */
function seedConversations(buyerId: string, count: number) {
  const at = new Date(NOW.getTime() - 30 * 60_000).toISOString();
  for (let n = 0; n < count; n += 1) {
    const id = `conv-seed-${n}`;
    const row: ConversationRow = {
      id,
      listingId: null,
      listingTitle: null,
      sellerSlug: `seed-shop-${n}`,
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
    sampleStore().conversations.set(id, row);
    sampleStore().messages.set(`msg-${id}`, { id: `msg-${id}`, conversationId: id, from: "buyer", body: "Hi", swapOffer: null, sentAt: at, readAt: null });
  }
}

/** `count` more messages from `from` in `conversationId`, ten minutes ago. */
function seedMessages(conversationId: string, from: "buyer" | "seller", count: number) {
  const at = new Date(NOW.getTime() - 10 * 60_000).toISOString();
  for (let n = 0; n < count; n += 1) {
    sampleStore().messages.set(`msg-seed-${conversationId}-${n}`, { id: `msg-seed-${conversationId}-${n}`, conversationId, from, body: "More", swapOffer: null, sentAt: at, readAt: null });
  }
}

describe("the message limits (stage K spec 4; Lama, 2026-10-20)", () => {
  it("refuses a 41st new conversation in 24 hours, keeping what was typed and writing nothing", async () => {
    await signedInAs("acc-mentor");
    seedConversations("acc-mentor", 40);
    const conversations = sampleStore().conversations.size;
    const messages = sampleStore().messages.size;
    const redirect = await redirectSignalOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/listings/l-001/message", "replace", false]);
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-001" }))).toMatchObject({
      errors: ["conversation-rate"],
      values: { body: "Is it still available?" },
      notice: null,
    });
    expect([sampleStore().conversations.size, sampleStore().messages.size]).toEqual([conversations, messages]);
  });

  it("refuses before the scam check: no Check this before you send first", async () => {
    await signedInAs("acc-mentor");
    seedConversations("acc-mentor", 40);
    await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Pay a deposit first and I'll bring it." })));
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-001" }))).toMatchObject({
      errors: ["conversation-rate"],
      notice: null,
    });
  });

  it("lets a message into a conversation the buyer has go through at 40 conversations", async () => {
    await signedInAs("acc-mentor");
    const first = await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" })));
    seedConversations("acc-mentor", 39);
    const again = await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "And the case?" })));
    expect(again).toBe(first);
  });

  it("refuses the 121st message in an hour on a reply, keeping it", async () => {
    await signedInAs("acc-mentor");
    const thread = idOf(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" }))));
    seedMessages(thread, "buyer", 119);
    const messages = sampleStore().messages.size;
    await redirectOf(() => sendReply(form({ conversation: thread, body: "Hello again" })));
    expect(await readFormState(replyFormKey(thread))).toMatchObject({ errors: ["message-rate"], values: { body: "Hello again" } });
    expect(sampleStore().messages.size).toBe(messages);
  });

  it("refuses the 121st message in an hour on a first message too", async () => {
    await signedInAs("acc-mentor");
    const thread = idOf(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" }))));
    seedMessages(thread, "buyer", 119);
    await redirectOf(() => sendFirstMessage(form({ listing: "l-002", body: "And this one?" })));
    expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-002" }))).toMatchObject({ errors: ["message-rate"] });
  });

  it.each(["conversation-rate", "message-rate"] as const)(
    "shows the database's %s on a first message as its own check would, keeping what was typed (C2/C3 plan Task 15)",
    async (code) => {
      await signedInAs("acc-mentor");
      vi.mocked(startConversation).mockRejectedValueOnce(new Refused(code));
      const redirect = await redirectSignalOf(() =>
        sendFirstMessage(form({ listing: "l-007", body: "Is it still available?", swapOffer: "My old phone" })),
      );
      expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/listings/l-007/message", "replace", false]);
      expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-007" }))).toMatchObject({
        errors: [code],
        values: { body: "Is it still available?", swapOffer: "My old phone" },
        notice: null,
      });
    },
  );

  it.each(["own-shop", "closed", "not-found"] as const)(
    "goes back to the composer with nothing written when the database finds it %s (C2/C3 plan Task 15)",
    async (code) => {
      await signedInAs("acc-mentor");
      vi.mocked(startConversation).mockRejectedValueOnce(new Refused(code));
      expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" })))).toBe(
        "/listings/l-001/message",
      );
      expect(await readFormState(composerFormKey({ kind: "listing", listingId: "l-001" }))).toBeNull();
      expect(request.refreshed).toBe(false);
    },
  );

  it("shows the database's message-rate on a reply, keeping it (C2/C3 plan Task 15)", async () => {
    await signedInAs("acc-seller");
    vi.mocked(sendMessage).mockRejectedValueOnce(new Refused("message-rate"));
    const redirect = await redirectSignalOf(() => sendReply(form({ conversation: "conv-s1", body: "Still yours." })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/messages/conv-s1", "replace", false]);
    expect(await readFormState(replyFormKey("conv-s1"))).toMatchObject({
      errors: ["message-rate"],
      values: { body: "Still yours." },
      notice: null,
    });
  });

  it("lets a sample account through in sample mode (spec decision 10)", async () => {
    samples.exempt = true;
    await signedInAs("acc-mentor");
    seedConversations("acc-mentor", 40);
    expect(await redirectOf(() => sendFirstMessage(form({ listing: "l-001", body: "Is it still available?" })))).toMatch(
      /^\/messages\/conv-/,
    );
  });
});
