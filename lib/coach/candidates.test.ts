import { describe, expect, it } from "vitest";
import { candidatesFor } from "./candidates";
import type { FactListing, ShopFacts } from "./types";

const NOW = new Date("2026-11-10T08:00:00Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
const listing = (id: string, changes: Partial<FactListing> = {}): FactListing => ({
  id,
  title: `Listing ${id}`,
  categorySlug: "tech",
  priceZar: 200,
  priceIsFrom: false,
  photos: 3,
  descriptionChars: 120,
  updatedAt: ago(2),
  lastEnquiryAt: ago(1),
  similarPrices: [],
  ...changes,
});
const facts = (changes: Partial<ShopFacts> = {}): ShopFacts => ({
  asOf: NOW.toISOString(),
  shop: { slug: "tech-corner", campusSlug: "midrand", categorySlug: "tech", about: "We fix laptops.", hasPhoto: true },
  queue: { replies: { count: 0, oldest: null }, sales: [], listings: { available: 3, paused: 0, sold: 0, drafts: 0 } },
  listings: [listing("l-1"), listing("l-2"), listing("l-3")],
  requests: [],
  posts: [],
  booked: [],
  tickedTips: [],
  ...changes,
});
const kinds = (f: ShopFacts) => candidatesFor(f, NOW).map((c) => c.id);

describe("candidatesFor (spec 2.1, planning decisions 1 to 9)", () => {
  it("finds nothing for a shop in good shape", () => {
    expect(kinds(facts())).toEqual([]);
  });
  it("asks for a reply only once the oldest buyer has waited over 24 hours", () => {
    const waiting = (hours: number) =>
      facts({ queue: { ...facts().queue, replies: { count: 3, oldest: { id: "c-1", title: "Lamp", at: new Date(NOW.getTime() - hours * 3_600_000).toISOString(), state: null } } } });
    expect(kinds(waiting(23))).toEqual([]);
    const [c] = candidatesFor(waiting(49), NOW);
    expect(c).toMatchObject({ id: "reply-waiting:shop", evidence: { waiting: 3, oldestDays: 2 }, href: "/sell/messages" });
  });
  it("asks to mark sales sold, linking to the oldest sale's thread", () => {
    const sales = [
      { conversationId: "c-9", listingId: "l-1", title: "Lamp", at: ago(3) },
      { conversationId: "c-8", listingId: "l-2", title: "Desk", at: ago(1) },
    ];
    expect(candidatesFor(facts({ queue: { ...facts().queue, sales } }), NOW)[0]).toMatchObject({
      id: "mark-sold:shop",
      evidence: { sales: 2 },
      href: "/messages/c-9",
    });
  });
  it("asks for photos on listings with fewer than two, fewest first, at most two (decisions 2 and 5)", () => {
    const f = facts({ listings: [listing("l-1", { photos: 1 }), listing("l-2", { photos: 0 }), listing("l-3", { photos: 1 })] });
    expect(kinds(f)).toEqual(["add-photos:l-2", "add-photos:l-1"]);
  });
  it("asks to say more under 80 characters, to refresh after 21 quiet days", () => {
    const f = facts({
      listings: [
        listing("l-1", { descriptionChars: 79 }),
        listing("l-2", { updatedAt: ago(22), lastEnquiryAt: ago(30) }),
        listing("l-3", { updatedAt: ago(22), lastEnquiryAt: ago(5) }),
      ],
    });
    expect(kinds(f)).toEqual(["say-more:l-1", "refresh-quiet:l-2"]);
  });
  it("checks a price at 1.5 times the middle of 3 or more similar listings (decision 6)", () => {
    const f = facts({ listings: [listing("l-1", { priceZar: 450, similarPrices: [300, 200, 250] }), listing("l-2", { priceZar: 370, similarPrices: [250, 250, 250] }), listing("l-3", { priceZar: 900, similarPrices: [100, 100] })] });
    expect(candidatesFor(f, NOW).filter((c) => c.kind === "check-price")).toEqual([
      expect.objectContaining({ id: "check-price:l-1", evidence: { price: 450, middle: 250, similar: 3 } }),
    ]);
  });
  it("never checks a free, swap-only or From price", () => {
    const f = facts({ listings: [listing("l-1", { priceZar: null, similarPrices: [1, 1, 1] }), listing("l-2", { priceZar: 0, similarPrices: [1, 1, 1] }), listing("l-3", { priceIsFrom: true, priceZar: 900, similarPrices: [1, 1, 1] })] });
    expect(kinds(f)).toEqual([]);
  });
  it("offers on matched requests, listing matches first (decision 7)", () => {
    const f = facts({ requests: [{ id: "r-1", title: "Calculator", via: "listing" }, { id: "r-2", title: "Laptop bag", via: "category" }, { id: "r-3", title: "Mouse", via: "category" }] });
    expect(candidatesFor(f, NOW).map((c) => [c.id, c.href])).toEqual([
      ["answer-request:r-1", "/looking-for/r-1/offer"],
      ["answer-request:r-2", "/looking-for/r-2/offer"],
    ]);
  });
  it("asks to list more under 3 available, and to finish the shop without about or photo", () => {
    const f = facts({ queue: { ...facts().queue, listings: { available: 1, paused: 0, sold: 0, drafts: 0 } }, listings: [listing("l-1")], shop: { ...facts().shop, about: "", hasPhoto: false } });
    expect(candidatesFor(f, NOW).filter((c) => c.kind === "list-more" || c.kind === "finish-shop")).toEqual([
      expect.objectContaining({ id: "list-more:shop", evidence: { available: 1, more: 2 }, href: "/sell/listings/new" }),
      expect.objectContaining({ id: "finish-shop:shop", evidence: { about: 0, photo: 0 }, href: "/sell/profile" }),
    ]);
  });
  it("sends the seller to the Launchpad's next 14 days at their campus, online or everywhere, unbooked (decision 8)", () => {
    const post = (id: string, campusSlug: string, days: number) => ({
      id, kind: "event" as const, title: `Event ${id}`, campusSlug, startsAt: new Date(NOW.getTime() + days * DAY).toISOString(), publishedAt: ago(5),
    });
    const f = facts({ posts: [post("hp-1", "pretoria", 2), post("hp-2", "online", 3), post("hp-3", "midrand", 1), post("hp-4", "all", 15), post("hp-5", "all", 4)], booked: ["hp-3"] });
    expect(candidatesFor(f, NOW).map((c) => [c.id, c.href])).toEqual([
      ["go-to-launchpad:hp-2", "/hub/hp-2"],
      ["go-to-launchpad:hp-5", "/hub/hp-5"],
    ]);
  });
  it("counts the Launchpad's days and date in South Africa, not UTC", () => {
    // 23:30 SAST on the 11th is 21:30 UTC the same day; 00:30 SAST on the 12th is 22:30 UTC on the 11th.
    const post = (id: string, startsAt: string) => ({ id, kind: "event" as const, title: id, campusSlug: "all", startsAt, publishedAt: ago(5) });
    const f = facts({ posts: [post("hp-1", "2026-11-11T21:30:00Z"), post("hp-2", "2026-11-11T22:30:00Z")] });
    expect(candidatesFor(f, NOW).map((c) => [c.id, c.evidence])).toEqual([
      ["go-to-launchpad:hp-1", { days: 1, date: 11 }],
      ["go-to-launchpad:hp-2", { days: 2, date: 12 }],
    ]);
  });
  it("offers the newest tip not ticked in 12 weeks (decision 9)", () => {
    const tip = (id: string, days: number) => ({ id, kind: "tip" as const, title: `Tip ${id}`, campusSlug: "all", startsAt: null, publishedAt: ago(days) });
    const f = facts({ posts: [tip("t-1", 9), tip("t-2", 2), tip("t-3", 5)], tickedTips: ["t-2"] });
    expect(kinds(f)).toEqual(["read-tip:t-3"]);
  });
  it("keeps the catalogue's order across kinds", () => {
    const f = facts({ listings: [listing("l-1", { photos: 1, descriptionChars: 10 })], queue: { ...facts().queue, listings: { available: 1, paused: 0, sold: 0, drafts: 0 } } });
    expect(candidatesFor(f, NOW).map((c) => c.kind)).toEqual(["add-photos", "say-more", "list-more"]);
  });
});
