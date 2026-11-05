import { describe, expect, it } from "vitest";
import { actionState, lastWeekLine, progressLine, progressOf, settledIds } from "./done";
import type { CoachAction, LiveFacts } from "./types";

const AS_OF = "2026-11-09T03:00:00.000Z";
const action = (id: string, evidence: CoachAction["evidence"] = {}): CoachAction => {
  const [kind, target] = id.split(":");
  return {
    id, kind: kind as CoachAction["kind"], evidence, href: "/x", title: "T", why: "W", asOf: AS_OF, name: "N",
    target: { type: target === "shop" ? "shop" : kind === "answer-request" ? "request" : kind.includes("launchpad") || kind === "read-tip" ? "post" : "listing", id: target === "shop" ? null : target },
  };
};
const listing = { state: "available" as const, hidden: false, photos: 1, descriptionChars: 30, priceZar: 450, updatedAt: "2026-10-01T00:00:00.000Z" };
const live = (changes: Partial<LiveFacts> = {}): LiveFacts => ({
  queue: { replies: { count: 0, oldest: null }, sales: [], listings: { available: 1, paused: 0, sold: 0, drafts: 0 } },
  shop: { about: "", hasPhoto: false },
  listings: new Map([["l-1", listing]]),
  offered: new Set(), openRequests: new Set(["r-1"]), booked: new Set(), publishedPosts: new Set(["hp-1", "t-1"]), passedPosts: new Set(),
  ...changes,
});
const none = new Set<string>();

describe("actionState (spec 2.1's Done when; planning decisions 3, 4 and 8)", () => {
  it("reply-waiting: done once nobody waiting since the facts were read is still waiting", () => {
    const a = action("reply-waiting:shop");
    const waiting = (at: string) => live({ queue: { ...live().queue, replies: { count: 1, oldest: { id: "c", title: null, at, state: null } } } });
    expect(actionState(a, waiting("2026-11-08T10:00:00.000Z"), none)).toBe("open");
    expect(actionState(a, waiting("2026-11-09T09:00:00.000Z"), none)).toBe("done");
    expect(actionState(a, live(), none)).toBe("done");
  });
  it("mark-sold: done once no sale from before is waiting", () => {
    const sale = (at: string) => live({ queue: { ...live().queue, sales: [{ conversationId: "c", listingId: "l-1", title: "Lamp", at }] } });
    expect(actionState(action("mark-sold:shop"), sale("2026-11-08T10:00:00.000Z"), none)).toBe("open");
    expect(actionState(action("mark-sold:shop"), sale("2026-11-10T10:00:00.000Z"), none)).toBe("done");
  });
  it("add-photos and say-more: done at two photos or 80 characters; gone when the listing is", () => {
    expect(actionState(action("add-photos:l-1"), live(), none)).toBe("open");
    expect(actionState(action("add-photos:l-1"), live({ listings: new Map([["l-1", { ...listing, photos: 2 }]]) }), none)).toBe("done");
    expect(actionState(action("say-more:l-1"), live({ listings: new Map([["l-1", { ...listing, descriptionChars: 80 }]]) }), none)).toBe("done");
    expect(actionState(action("add-photos:l-1"), live({ listings: new Map() }), none)).toBe("gone");
    expect(actionState(action("say-more:l-1"), live({ listings: new Map([["l-1", { ...listing, state: "sold" }]]) }), none)).toBe("gone");
  });
  it("refresh-quiet: done when edited, sold or removed", () => {
    expect(actionState(action("refresh-quiet:l-1"), live(), none)).toBe("open");
    expect(actionState(action("refresh-quiet:l-1"), live({ listings: new Map([["l-1", { ...listing, updatedAt: "2026-11-10T00:00:00.000Z" }]]) }), none)).toBe("done");
    expect(actionState(action("refresh-quiet:l-1"), live({ listings: new Map([["l-1", { ...listing, state: "sold" }]]) }), none)).toBe("done");
    expect(actionState(action("refresh-quiet:l-1"), live({ listings: new Map() }), none)).toBe("done");
  });
  it("check-price: done below 1.5 times the stored middle, or ticked", () => {
    const a = action("check-price:l-1", { price: 450, middle: 250, similar: 3 });
    expect(actionState(a, live(), none)).toBe("open");
    expect(actionState(a, live({ listings: new Map([["l-1", { ...listing, priceZar: 370 }]]) }), none)).toBe("done");
    expect(actionState(a, live(), new Set([a.id]))).toBe("done");
  });
  it("answer-request: done on an offer, gone when the request closes", () => {
    const a = action("answer-request:r-1");
    expect(actionState(a, live(), none)).toBe("open");
    expect(actionState(a, live({ offered: new Set(["r-1"]) }), none)).toBe("done");
    expect(actionState(a, live({ openRequests: new Set() }), none)).toBe("gone");
  });
  it("list-more and finish-shop: done at 3 available, and with about and photo both", () => {
    expect(actionState(action("list-more:shop"), live({ queue: { ...live().queue, listings: { available: 3, paused: 0, sold: 0, drafts: 0 } } }), none)).toBe("done");
    expect(actionState(action("finish-shop:shop"), live({ shop: { about: "Hi", hasPhoto: false } }), none)).toBe("open");
    expect(actionState(action("finish-shop:shop"), live({ shop: { about: "Hi", hasPhoto: true } }), none)).toBe("done");
  });
  it("go-to-launchpad: done once booked, even after it passed; gone unbooked once passed or unpublished", () => {
    const a = action("go-to-launchpad:hp-1");
    expect(actionState(a, live(), none)).toBe("open");
    expect(actionState(a, live({ booked: new Set(["hp-1"]), passedPosts: new Set(["hp-1"]) }), none)).toBe("done");
    expect(actionState(a, live({ passedPosts: new Set(["hp-1"]) }), none)).toBe("gone");
    expect(actionState(a, live({ publishedPosts: new Set() }), none)).toBe("gone");
  });
  it("read-tip: done only when ticked", () => {
    expect(actionState(action("read-tip:t-1"), live(), none)).toBe("open");
    expect(actionState(action("read-tip:t-1"), live(), new Set(["read-tip:t-1"]))).toBe("done");
  });
});

describe("the lines (spec 2: Last week: 2 of 3 done; planning decision 3)", () => {
  it("leaves gone actions out of the count", () => {
    expect(progressOf(["done", "gone", "open"])).toEqual({ done: 1, total: 2 });
    expect(progressLine({ done: 1, total: 2 })).toBe("1 of 2 done");
    expect(lastWeekLine({ done: 2, total: 3 })).toBe("Last week: 2 of 3 done");
    expect(lastWeekLine({ done: 0, total: 0 })).toBe("Last week: nothing to do");
    expect(lastWeekLine(null)).toBeNull();
  });
  it("settles a week into the ids done and the ids gone, so a settled week counts as a live one does", () => {
    expect(settledIds([action("list-more:shop"), action("read-tip:t-1"), action("say-more:l-1")], ["done", "open", "gone"])).toEqual({
      done: ["list-more:shop"],
      gone: ["say-more:l-1"],
    });
  });
});
