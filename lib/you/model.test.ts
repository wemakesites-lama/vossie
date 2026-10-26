import { describe, expect, it } from "vitest";
import type { OwnRequest } from "@/lib/types";
import { forYouItems, forYouTotal, messagesTotal, othersTotal, yourStuffFrom } from "./model";

const note = (count: number, href = "/to/newest", text = "The newest") => ({ count, newestHref: href, newestText: text });

describe("For you (role views spec 7.4)", () => {
  it("lists messages, sales to confirm, offers, matches and new listings, and sums to the badge with each offer counted once", () => {
    const items = forYouItems({
      conversations: 5,
      salesToConfirm: 1,
      byKind: { offer: note(3), "search-match": note(1), "new-listing": note(2), "sale-to-confirm": note(1) },
    });
    expect(items.map((item) => [item.key, item.count, item.href])).toEqual([
      ["messages", 2, "/messages"],
      ["sales", 1, "/messages"],
      ["offers", 3, "/account/requests"],
      ["matches", 1, "/notifications"],
      ["listings", 2, "/notifications"],
    ]);
    // A sale to confirm counts once: its sale-to-confirm notification isn't a For you kind.
    expect(forYouTotal(items)).toBe(9);
  });

  it("counts one new offer once, in the offers row, which opens its thread (plan decision 1)", () => {
    const items = forYouItems({ conversations: 1, byKind: { offer: note(1, "/messages/conv-9", "Tech corner offered") } });
    expect(items.map((item) => [item.key, item.count])).toEqual([
      ["messages", 0],
      ["sales", 0],
      ["offers", 1],
      ["matches", 0],
      ["listings", 0],
    ]);
    expect(items[2]).toMatchObject({ href: "/messages/conv-9", detail: "Tech corner offered" });
    expect(forYouTotal(items)).toBe(1);
    expect(forYouTotal(forYouItems({ conversations: 0, byKind: {} }))).toBe(0);
  });
});

const own = (title: string, state: OwnRequest["state"], closesOn: string | null) =>
  ({ state, request: { title, closesOn } }) as Pick<OwnRequest, "state"> & { request: Pick<OwnRequest["request"], "title" | "closesOn"> };

describe("Your stuff (role views spec 7.4)", () => {
  it("counts requests by state and searches with alerts on, and finds the open ones closing soon, soonest first", () => {
    const stuff = yourStuffFrom({
      savedIds: ["l-001", "l-026"],
      shops: [{ slug: "tech-corner" }],
      own: [
        own("Later lamp", "open", "2026-10-24"),
        own("Sooner kettle", "open", "2026-10-23"),
        own("Far fan", "open", "2026-11-30"),
        own("Hidden desk", "hidden", "2026-10-23"),
        own("Kettle", "closed", null),
      ],
      searches: [{ paused: false }, { paused: true }],
      bookings: [],
      today: "2026-10-22",
    });
    expect(stuff).toEqual({
      savedListings: 2,
      followedShops: 1,
      requests: { open: 3, closed: 1, hidden: 1 },
      closingSoon: { title: "Sooner kettle", closesOn: "2026-10-23", count: 2 },
      searches: { count: 2, alertsOn: 1 },
      bookings: [],
    });
  });
});

describe("the Messages tab and You's other things (role bars spec 7, plan decision 4)", () => {
  const items = [
    { key: "messages", count: 2 },
    { key: "sales", count: 1 },
    { key: "offers", count: 1 },
    { key: "matches", count: 3 },
    { key: "listings", count: 0 },
  ];

  it("counts messages, sales to confirm and offers under Messages", () => {
    expect(messagesTotal(items)).toBe(4);
  });

  it("leaves those rows out of You's badge, so nothing counts twice", () => {
    expect(othersTotal(items)).toBe(3);
    expect(messagesTotal(items) + othersTotal(items)).toBe(forYouTotal(items));
  });
});
