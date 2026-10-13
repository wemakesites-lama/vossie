import { describe, expect, it } from "vitest";
import {
  badgeLabel,
  conditionLabel,
  eventDate,
  formatRand,
  joinWords,
  offersLabel,
  priceLabel,
  shareCardAlt,
  shortDescription,
} from "./format";

describe("formatRand", () => {
  it("writes rand with commas between thousands, as the mockup does", () => {
    expect(formatRand(60)).toBe("R60");
    expect(formatRand(1200)).toBe("R1,200");
    expect(formatRand(1250000)).toBe("R1,250,000");
  });
});

describe("priceLabel", () => {
  it("shows the price, a 'From' price, Free, Swap, or a price with 'or swap' (spec 5.3)", () => {
    expect(priceLabel({ priceZar: 250, priceIsFrom: false, payMode: "cash" })).toBe("R250");
    expect(priceLabel({ priceZar: 400, priceIsFrom: true, payMode: "cash" })).toBe("From R400");
    expect(priceLabel({ priceZar: 0, priceIsFrom: false, payMode: "cash" })).toBe("Free");
    expect(priceLabel({ priceZar: null, priceIsFrom: false, payMode: "swap" })).toBe("Swap");
    expect(priceLabel({ priceZar: 450, priceIsFrom: false, payMode: "both" })).toBe("R450 or swap");
    expect(priceLabel({ priceZar: 400, priceIsFrom: true, payMode: "both" })).toBe("From R400 or swap");
    expect(priceLabel({ priceZar: 1200, priceIsFrom: false, payMode: "cash" })).toBe("R1,200");
  });
});

describe("conditionLabel", () => {
  it("names each condition", () => {
    expect(conditionLabel("new")).toBe("New");
    expect(conditionLabel("like-new")).toBe("Like new");
    expect(conditionLabel("good")).toBe("Good");
    expect(conditionLabel("fair")).toBe("Fair");
  });
});

describe("shortDescription", () => {
  it("keeps a short description whole, with its line breaks flattened", () => {
    expect(shortDescription("Works perfectly.\nComes with the cover.")).toBe("Works perfectly. Comes with the cover.");
  });

  it("cuts a long one at a word, within the limit, and ends it with an ellipsis", () => {
    const long = "word ".repeat(60).trim(); // 299 characters
    const short = shortDescription(long, 150);
    expect(short.length).toBeLessThanOrEqual(150);
    expect(short.endsWith("word…")).toBe(true);
  });
});

describe("shareCardAlt", () => {
  it("says what, how much and where (spec 5.8)", () => {
    expect(shareCardAlt("Casio fx-991ZA Plus calculator", "R250", "Midrand")).toBe(
      "Casio fx-991ZA Plus calculator, R250, at Midrand on Vossie",
    );
  });
});

describe("labels", () => {
  it("names the trust badges", () => {
    expect(badgeLabel("trusted")).toBe("Trusted");
    expect(badgeLabel("responsive")).toBe("Responsive");
    expect(badgeLabel("new-seller")).toBe("New seller");
  });

  it("counts offers in plain words", () => {
    expect(offersLabel(0)).toBe("No offers yet");
    expect(offersLabel(1)).toBe("1 offer");
    expect(offersLabel(3)).toBe("3 offers");
  });

  it("joins words into a sentence list", () => {
    expect(joinWords(["textbooks"])).toBe("textbooks");
    expect(joinWords(["textbooks", "tech"])).toBe("textbooks and tech");
    expect(joinWords(["textbooks", "tech", "services"])).toBe("textbooks, tech and services");
  });
});

describe("eventDate", () => {
  it("splits a YYYY-MM-DD date into the day and short month for the date block", () => {
    expect(eventDate("2026-10-05")).toEqual({ day: "5", month: "Oct" });
    expect(eventDate("2026-12-31")).toEqual({ day: "31", month: "Dec" });
  });
});
