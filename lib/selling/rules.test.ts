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
  it("compares names without case, accents or punctuation", () => {
    expect(nameKey("Tech Corner!")).toBe("tech corner");
    expect(nameKey("Zoë's  café")).toBe("zoe s cafe");
    expect(nameKey("tech-corner")).toBe(nameKey("TECH CORNER"));
  });

  it("keeps letters from any script, so names in another alphabet don't collide", () => {
    expect(nameKey("日本")).not.toBe(nameKey("中国"));
    expect(nameKey("日本")).not.toBe("");
    expect(nameKey("Øre")).not.toBe(nameKey("Re"));
    expect(nameKey("ÆBLE")).toBe(nameKey("æble"));
  });

  it("makes a link from a name", () => {
    expect(slugify("Crochet corner")).toBe("crochet-corner");
    expect(slugify("Zoë's Café & Bakes!")).toBe("zoes-cafe-bakes");
    expect(slugify(`${"a".repeat(50)} shop`)).toBe("a".repeat(40));
    expect(slugify("!!!")).toBe("shop");
    expect(slugify("日本")).toBe("shop");
    expect(slugify("Zoe\u2018s")).toBe(slugify("Zoe's"));
    expect(slugify("Zoe\u02bcs")).toBe("zoes");
  });

  it("takes a name of 2 to 60 characters once tidied", () => {
    expect(checkShopName("  Tech   corner ")).toEqual({ value: "Tech corner", error: null });
    expect(checkShopName(" ").error).toBe("name-missing");
    expect(checkShopName("T").error).toBe("name-length");
    expect(checkShopName("Te").error).toBeNull();
    expect(checkShopName("a".repeat(60)).error).toBeNull();
    expect(checkShopName("a".repeat(61)).error).toBe("name-length");
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

  it("takes separators only between groups of three, so cents after a comma aren't read as thousands", () => {
    expect(parsePrice("12,500")).toBe(12500);
    expect(parsePrice("R1\u00a0200")).toBe(1200);
    for (const bad of ["R250,00", "12,50", "1,5", "1 2 3", "1,2000", "1e5"]) expect(parsePrice(bad), bad).toBeNull();
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
