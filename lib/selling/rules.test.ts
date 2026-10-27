import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkAbout,
  checkListing,
  checkShopName,
  checkSlug,
  checkTagline,
  cleanLine,
  nameKey,
  nextState,
  parsePrice,
  RESERVED_SLUGS,
  slugify,
  type ListingInput,
} from "./rules";

const MIDRAND = { categorySlugs: ["tech", "tutoring"], pickupPointIds: ["pp-midrand-library", "pp-midrand-reception"] };
const ONLINE = { categorySlugs: ["tech", "tutoring"], pickupPointIds: [] };

const item: ListingInput = {
  kind: "item",
  title: "  Casio   calculator ",
  categorySlug: "tech",
  condition: "like-new",
  price: "R1 200",
  free: false,
  priceIsFrom: true,
  payMode: "cash",
  swapFor: "ignored",
  description: "Works perfectly.\r\nWith its cover.",
  handover: "pickup",
  pickupPointId: "pp-midrand-library",
};

describe("one line of text", () => {
  it("collapses spaces and line breaks, and drops control characters", () => {
    expect(cleanLine("  Tech \n\t corner\u0000 ")).toBe("Tech corner");
  });
});

describe("shops (selling spec 2.6 and 2.11, plan decision 16)", () => {
  it("compares names without case, accents, apostrophes or punctuation", () => {
    expect(nameKey("Tech Corner!")).toBe("tech corner");
    expect(nameKey("Zoë's  café")).toBe("zoes cafe");
    expect(nameKey("tech-corner")).toBe(nameKey("TECH CORNER"));
    // Amendment 8.6.
    expect(nameKey("Zoe's Cafe")).toBe(nameKey("Zoes Cafe"));
    expect(nameKey("Zoe’s Cafe")).toBe(nameKey("Zoes Cafe"));
  });

  it("compares names in any alphabet, so two names in another script don't collide (amendment 8.6)", () => {
    expect(nameKey("Ζήτα Café")).toBe("ζητα cafe");
    expect(nameKey("東京 2")).toBe("東京 2");
    expect(nameKey("東京")).not.toBe(nameKey("大阪"));
    expect(nameKey("Кафе")).toBe(nameKey("КАФЕ"));
  });

  it("makes a link from a name", () => {
    expect(slugify("Crochet corner")).toBe("crochet-corner");
    expect(slugify("Zoë's Café & Bakes!")).toBe("zoes-cafe-bakes");
    expect(slugify(`${"a".repeat(50)} shop`)).toBe("a".repeat(40));
    expect(slugify("!!!")).toBe("shop");
  });

  it("keeps a link at least 3 characters long, and only a to z, digits and hyphens (amendment 8.6)", () => {
    expect(slugify("AB")).toBe("ab-shop");
    expect(slugify("Ζήτα Café")).toBe("cafe");
    expect(slugify("東京")).toBe("shop");
    expect(slugify("東京 7")).toBe("7-shop");
  });

  it("never makes a link a fixed route already uses, but adds -shop as it does to a short one (staff tools amendment 15.4)", () => {
    // /mentor/export is the CSV, beside /mentor/[slug]: a shop on this link would be unreachable there.
    expect(slugify("Export")).toBe("export-shop");
    expect(slugify("  EXPORT! ")).toBe("export-shop");
    expect(slugify("Éxport")).toBe("export-shop");
    // A name that only contains the word is a different link.
    expect(slugify("Export hub")).toBe("export-hub");
    expect(slugify("Exports")).toBe("exports");
    for (const reserved of RESERVED_SLUGS) expect(slugify(reserved)).not.toBe(reserved);
  });

  it("reserves every fixed route that sits beside a shop's link, so a new one can't be forgotten (amendment 15.4)", () => {
    // Where a shop's link is a path segment: its storefront, the admin's page for it and its mentor page.
    const parents = ["app/sellers", "app/(staff)/admin/sellers", "app/(staff)/mentor"];
    const fixed = parents.flatMap((parent) =>
      readdirSync(join(process.cwd(), parent))
        .filter((name) => statSync(join(process.cwd(), parent, name)).isDirectory())
        // [slug] is the shop; (group), _private and @slot folders and other dynamic segments are not fixed words.
        .filter((name) => !/^[[(_@]/.test(name)),
    );
    expect(fixed).toContain("export");
    for (const name of fixed) expect(RESERVED_SLUGS.has(name), `/${name} sits beside a shop's link`).toBe(true);
  });

  it("takes a name of 2 to 60 characters once tidied", () => {
    expect(checkShopName("  Tech   corner ")).toEqual({ value: "Tech corner", error: null });
    expect(checkShopName(" ").error).toBe("name-missing");
    expect(checkShopName("T").error).toBe("name-length");
    expect(checkShopName("Te").error).toBeNull();
    expect(checkShopName("a".repeat(60)).error).toBeNull();
    expect(checkShopName("a".repeat(61)).error).toBe("name-length");
  });

  it("needs a letter or a digit in a name, in any alphabet (amendment 8.6)", () => {
    expect(checkShopName("☕☕☕").error).toBe("name-missing");
    expect(checkShopName("!?!").error).toBe("name-missing");
    expect(checkShopName("☕ Cafe").error).toBeNull();
    expect(checkShopName("東京").error).toBeNull();
    expect(checkShopName("24/7").error).toBeNull();
  });

  it("lets the tagline be empty, and up to 80 characters", () => {
    expect(checkTagline("")).toEqual({ value: "", error: null });
    expect(checkTagline("a".repeat(80)).error).toBeNull();
    expect(checkTagline("a".repeat(81)).error).toBe("tagline-length");
  });

  it("keeps the about text's line breaks, up to 600 characters", () => {
    expect(checkAbout("I test everything.\r\nAsk me anything.")).toEqual({
      value: "I test everything.\nAsk me anything.",
      error: null,
    });
    expect(checkAbout(" ").error).toBe("about-missing");
    expect(checkAbout("a".repeat(600)).error).toBeNull();
    expect(checkAbout("a".repeat(601)).error).toBe("about-length");
  });

  it("takes a typed link of 3 to 40 lower-case letters, digits and single hyphens", () => {
    expect(checkSlug(" Tech-Corner ")).toEqual({ value: "tech-corner", error: null });
    for (const bad of ["tc", "tech--corner", "-tech", "tech-", "tech corner", "tëch", "a".repeat(41)]) {
      expect(checkSlug(bad).error, bad).toBe("slug-format");
    }
  });
});

describe("prices (plan decision 26)", () => {
  it("reads whole rand however it's written", () => {
    expect(parsePrice("250")).toBe(250);
    expect(parsePrice("R1 200")).toBe(1200);
    expect(parsePrice(" r 1,200 ")).toBe(1200);
    for (const bad of ["", "12.50", "R", "two hundred", "-5"]) expect(parsePrice(bad), bad).toBeNull();
  });

  it("takes the decimal comma, with no cents, and thousands only in groups of three (amendment 8.5)", () => {
    expect(parsePrice("R250,00")).toBe(250);
    expect(parsePrice("250.00")).toBe(250);
    expect(parsePrice("1,200")).toBe(1200);
    expect(parsePrice("R1 200,00")).toBe(1200);
    expect(parsePrice("12,500")).toBe(12500);
    expect(parsePrice("1,200.00")).toBe(1200);
    expect(parsePrice("100,000")).toBe(100000);
    for (const bad of ["99,99", "1,20", "12,50", "1,2000", "12,5000", "1,200,0", "1 20", "1,,200", "1, 200", "250,", ",00"]) {
      expect(parsePrice(bad), bad).toBeNull();
    }
  });
});

describe("the listing form's rules (selling spec 2.10, plan decision 26)", () => {
  it("tidies a good item and keeps only what applies to it", () => {
    expect(checkListing(item, MIDRAND)).toEqual({
      value: {
        kind: "item",
        title: "Casio calculator",
        categorySlug: "tech",
        condition: "like-new",
        priceZar: 1200,
        priceIsFrom: false,
        payMode: "cash",
        swapFor: null,
        description: "Works perfectly.\nWith its cover.",
        handover: "pickup",
        pickupPointId: "pp-midrand-library",
      },
      errors: [],
    });
  });

  it("lets a service have a starting price and no condition", () => {
    const service = { ...item, kind: "service", handover: "on-campus-or-online", pickupPointId: "" };
    expect(checkListing(service, MIDRAND).value).toMatchObject({
      condition: null,
      priceIsFrom: true,
      handover: "on-campus-or-online",
      pickupPointId: null,
    });
  });

  it("makes a free listing R0 and cash, and refuses a free swap", () => {
    expect(checkListing({ ...item, free: true, price: "" }, MIDRAND).value).toMatchObject({
      priceZar: 0,
      payMode: "cash",
      priceIsFrom: false,
    });
    expect(checkListing({ ...item, free: true, payMode: "both", swapFor: "a kettle" }, MIDRAND).errors).toEqual([
      "free-swap",
    ]);
  });

  it("gives a swap-only listing no price, and asks what a swap would be for", () => {
    expect(checkListing({ ...item, payMode: "swap", price: "", swapFor: " a kettle " }, MIDRAND).value).toMatchObject({
      priceZar: null,
      payMode: "swap",
      swapFor: "a kettle",
    });
    expect(checkListing({ ...item, payMode: "both", swapFor: "" }, MIDRAND).errors).toEqual(["swap-missing"]);
    expect(checkListing({ ...item, payMode: "both", swapFor: "a".repeat(201) }, MIDRAND).errors).toEqual([
      "swap-length",
    ]);
  });

  it("lists every problem with an empty form, in the form's order", () => {
    const empty: ListingInput = {
      kind: "",
      title: "",
      categorySlug: "",
      condition: "",
      price: "",
      free: false,
      priceIsFrom: false,
      payMode: "",
      swapFor: "",
      description: "",
      handover: "",
      pickupPointId: "",
    };
    expect(checkListing(empty, MIDRAND)).toEqual({
      value: null,
      errors: [
        "kind-missing",
        "title-missing",
        "category-missing",
        "price-missing",
        "pay-missing",
        "description-missing",
        "handover-missing",
      ],
    });
  });

  it("takes each limit at the limit (amendment 8.15)", () => {
    expect(checkListing({ ...item, title: "a".repeat(70) }, MIDRAND).errors).toEqual([]);
    expect(checkListing({ ...item, price: "R1" }, MIDRAND).value?.priceZar).toBe(1);
    expect(checkListing({ ...item, price: "R100,000" }, MIDRAND).value?.priceZar).toBe(100000);
    expect(checkListing({ ...item, description: "a".repeat(1000) }, MIDRAND).errors).toEqual([]);
    expect(checkListing({ ...item, payMode: "both", swapFor: "a".repeat(200) }, MIDRAND).errors).toEqual([]);
  });

  it("checks the limits and the choices", () => {
    expect(checkListing({ ...item, title: "a".repeat(71) }, MIDRAND).errors).toEqual(["title-length"]);
    expect(checkListing({ ...item, categorySlug: "cars" }, MIDRAND).errors).toEqual(["category-missing"]);
    expect(checkListing({ ...item, condition: "broken" }, MIDRAND).errors).toEqual(["condition-missing"]);
    expect(checkListing({ ...item, price: "0" }, MIDRAND).errors).toEqual(["price-invalid"]);
    expect(checkListing({ ...item, price: "100001" }, MIDRAND).errors).toEqual(["price-high"]);
    expect(checkListing({ ...item, description: "a".repeat(1001) }, MIDRAND).errors).toEqual(["description-length"]);
  });

  it("needs one of the shop's own spots for a pickup, and offers a shop without spots no pickup", () => {
    expect(checkListing({ ...item, pickupPointId: "pp-pretoria-library" }, MIDRAND).errors).toEqual(["pickup-missing"]);
    expect(checkListing(item, ONLINE).errors).toEqual(["handover-missing"]);
    expect(checkListing({ ...item, handover: "online" }, ONLINE).value).toMatchObject({
      handover: "online",
      pickupPointId: null,
    });
  });
});

describe("what Save and publish does (plan decision 3)", () => {
  it("publishes a new listing or a draft, keeps a paused or sold one as it is, and Save as draft always drafts", () => {
    expect(nextState(null, "publish")).toBe("available");
    expect(nextState("draft", "publish")).toBe("available");
    expect(nextState("available", "publish")).toBe("available");
    expect(nextState("paused", "publish")).toBe("paused");
    expect(nextState("sold", "publish")).toBe("sold");
    expect(nextState("available", "draft")).toBe("draft");
  });
});
