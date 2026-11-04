import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/types";
import { makeListing } from "@/tests/helpers/fakes";
import {
  checkStarter,
  nameWords,
  normaliseSentence,
  pickPack,
  shopSearchHref,
  starterQuery,
  starterSchema,
  totalLine,
  typedSentence,
  type ItemFinds,
  type StarterItem,
} from "./starter";

const slugs = { categories: ["tech", "res-living"], campuses: ["midrand", "pretoria"] };
const item = (name: string, words: string, category: string | null = null): StarterItem => ({ name, words, category });
const listing = (id: string, priceZar: number | null, changes: Partial<Listing> = {}) =>
  makeListing({ id, title: id, priceZar, priceIsFrom: false, payMode: priceZar === null ? "swap" : "cash", ...changes });
const reply = (fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    campus: "midrand",
    budget: 1000,
    items: [{ name: "Calculator", words: "casio calculator", categorySlug: "tech" }],
    ...fields,
  });

describe("the sentence (planning decision 1)", () => {
  it("shows it as typed, trimmed and cut at 200 characters", () => {
    expect(typedSentence("  Need a  Lamp ")).toBe("Need a Lamp");
    expect(typedSentence(["first", "second"])).toBe("first");
    expect(typedSentence("   ")).toBeNull();
    expect(typedSentence(undefined)).toBeNull();
    expect(Array.from(typedSentence("a ".repeat(150)) ?? "").length).toBeLessThanOrEqual(200);
  });
  it("sends it lowercased: the cache key", () => {
    expect(normaliseSentence("  Need a  Lamp ")).toBe("need a lamp");
  });
});

describe("checkStarter (planning decision 3)", () => {
  it("turns a reply into a read", () => {
    expect(checkStarter(reply(), slugs)).toEqual({
      campus: "midrand",
      budget: 1000,
      items: [item("Calculator", "casio calculator", "tech")],
    });
  });
  it.each([
    ["not json", "{"],
    ["an array", "[]"],
    ["a missing field", JSON.stringify({ campus: null, items: [] })],
    ["an extra field", reply({ owner: "me" })],
    ["a budget that isn't a whole number", reply({ budget: 12.5 })],
    ["a budget as words", reply({ budget: "R1000" })],
    ["items that aren't a list", reply({ items: "kettle" })],
    ["an item of the wrong shape", reply({ items: [{ name: "Kettle", words: "kettle" }] })],
    ["an item's words that aren't text", reply({ items: [{ name: "Kettle", words: 3, categorySlug: null }] })],
    ["no items", reply({ items: [] })],
  ])("refuses %s", (_name, text) => {
    expect(checkStarter(text, slugs)).toBeNull();
  });
  it("clips rather than refuses: names at a word, words cleaned to four, the first eight items", () => {
    const items = Array.from({ length: 10 }, (_, n) => ({ name: `Item ${n}`, words: `thing${n}`, categorySlug: null }));
    items[0] = {
      name: "A really very long name for a simple desk lamp with a usb port",
      words: "Desk, LAMP! usb port warm led",
      categorySlug: null,
    };
    const read = checkStarter(reply({ items }), slugs);
    expect(read?.items).toHaveLength(8);
    expect(read?.items[0].name.length).toBeLessThanOrEqual(40);
    expect(read?.items[0].name.endsWith("…")).toBe(true);
    expect(read?.items[0].words).toBe("desk lamp usb port");
  });
  it("drops duplicates and items with no words, and uses the name when the words are empty", () => {
    const read = checkStarter(
      reply({
        items: [
          { name: "Kettle", words: "kettle", categorySlug: "res-living" },
          { name: "Kettle again", words: "Kettle", categorySlug: "res-living" },
          { name: "!!", words: "??", categorySlug: null },
          { name: "Desk lamp", words: "", categorySlug: null },
        ],
      }),
      slugs,
    );
    expect(read?.items).toEqual([item("Kettle", "kettle", "res-living"), item("Desk lamp", "desk lamp")]);
  });
  it("makes an unknown category, an unknown campus and a budget of 0 into none", () => {
    const read = checkStarter(
      reply({ campus: "mars", budget: 0, items: [{ name: "Car", words: "car", categorySlug: "cars" }] }),
      slugs,
    );
    expect(read).toEqual({ campus: null, budget: null, items: [item("Car", "car")] });
  });
  it("has the schema's fields, with no type beside an enum and no maxItems", () => {
    const schema = starterSchema(["tech"], ["midrand"]);
    expect(Object.keys(schema.properties).sort()).toEqual(["budget", "campus", "items"]);
    expect(schema.properties.campus).toEqual({ enum: ["midrand", null] });
    expect(schema.properties.items.items.properties.categorySlug).toEqual({ enum: ["tech", null] });
    expect(JSON.stringify(schema)).not.toContain("maxItems");
  });
});

describe("review fixes (Task 2)", () => {
  it("falls back to the words for a name with no letters, and refuses an unsafe budget", () => {
    const read = checkStarter(reply({ budget: -5, items: [{ name: "!!", words: "kettle", categorySlug: null }] }), slugs);
    expect(read).toEqual({ campus: "midrand", budget: null, items: [item("Kettle", "kettle")] });
    expect(checkStarter(reply({ budget: 1e20 }), slugs)).toBeNull();
  });
  it("says taken, not swaps, when the priced match is already in the pack", () => {
    const shared = listing("calc", 250);
    const pack = pickPack(
      [
        { item: item("Calculator", "calculator"), words: "calculator", matches: [shared] },
        { item: item("Casio", "casio"), words: "casio", matches: [shared, listing("swap", null)] },
      ],
      null,
      "all",
    );
    expect(pack.lines.map((line) => (line.kind === "no-fit" ? line.reason : line.kind))).toEqual(["pick", "taken"]);
    expect(pack.lines[0]).toMatchObject({ seeMore: expect.stringContaining("campus=all") });
  });
});

describe("nameWords (planning decision 4)", () => {
  it("cleans a name as words are cleaned", () => {
    expect(nameWords("Desk Lamp!")).toBe("desk lamp");
  });
});

describe("starterQuery and shopSearchHref (planning decisions 6 and 9)", () => {
  it("is the item's Browse search: its campus, cheapest first, exact", () => {
    expect(starterQuery("desk lamp", "res-living", "midrand")).toEqual({
      q: "desk lamp",
      category: "res-living",
      campus: "midrand",
      campusFromLink: true,
      price: null,
      pay: null,
      deals: null,
      sort: "price-low",
      shown: 24,
      exact: true,
    });
  });
  it("offers Browse with the sentence as an ordinary search, cut to Browse's 100 characters", () => {
    expect(shopSearchHref("Need a lamp at Midrand")).toBe("/browse?q=Need+a+lamp+at+Midrand");
    const long = shopSearchHref("word ".repeat(40));
    expect(new URL(long, "http://x").searchParams.get("q")?.length).toBeLessThanOrEqual(100);
    expect(long).not.toContain("exact");
  });
});

describe("pickPack (planning decision 5)", () => {
  const finds = (entries: Array<[StarterItem, Listing[]]>): ItemFinds[] =>
    entries.map(([it, matches]) => ({ item: it, words: it.words, matches }));

  it("takes the cheapest priced match that fits what's left, in the model's order", () => {
    const pack = pickPack(
      finds([
        [item("Calculator", "calculator"), [listing("calc", 250)]],
        [item("Lamp", "lamp"), [listing("lamp-a", 180), listing("lamp-b", 300)]],
        [item("Fridge", "fridge"), [listing("fridge", 1200)]],
        [item("Kettle", "kettle"), []],
      ]),
      1000,
      "midrand",
    );
    expect(pack.lines.map((line) => (line.kind === "pick" ? line.listing.id : line.kind === "no-fit" ? line.reason : "none"))).toEqual(
      ["calc", "lamp-a", "budget", "none"],
    );
    expect(pack.total).toBe(430);
    expect(totalLine(pack)).toBe("Total R430 of your R1,000 budget, R570 left");
  });
  it("with no budget takes the cheapest of each", () => {
    const pack = pickPack(finds([[item("Fridge", "fridge"), [listing("fridge", 1200)]]]), null, "midrand");
    expect(totalLine(pack)).toBe("Total R1,200");
  });
  it("never picks a swap, or one listing twice", () => {
    const shared = listing("calc", 250);
    const pack = pickPack(
      finds([
        [item("Jacket", "jacket"), [listing("denim", null)]],
        [item("Calculator", "calculator"), [shared]],
        [item("Casio", "casio"), [shared]],
      ]),
      null,
      "all",
    );
    expect(pack.lines.map((line) => (line.kind === "no-fit" ? line.reason : line.kind))).toEqual(["swaps", "pick", "taken"]);
  });
  it("links each line: See more to its Browse search, or Looking For with the item's name", () => {
    const pack = pickPack(
      finds([
        [item("Desk lamp", "desk lamp", "res-living"), [listing("lamp", 180)]],
        [item("Kettle", "kettle"), []],
      ]),
      null,
      "midrand",
    );
    expect(pack.lines[0]).toMatchObject({
      seeMore: "/browse?q=desk+lamp&cat=res-living&campus=midrand&sort=price-low&exact=1",
    });
    expect(pack.lines[1]).toMatchObject({ kind: "none", ask: "/looking-for/new?title=Kettle" });
  });
  it("counts a From price at its amount and says so; no total without a pick", () => {
    const pack = pickPack(finds([[item("Braids", "braids"), [listing("braids", 400, { priceIsFrom: true })]]]), null, "all");
    expect(pack.fromPrices).toBe(true);
    expect(totalLine(pickPack(finds([[item("Kettle", "kettle"), []]]), 500, "all"))).toBeNull();
  });
});
