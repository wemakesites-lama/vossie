import { describe, expect, it } from "vitest";
import { badgeLabel, eventDate, formatRand, joinWords, offersLabel, priceLabel } from "./format";

describe("formatRand", () => {
  it("writes rand with commas between thousands, as the mockup does", () => {
    expect(formatRand(60)).toBe("R60");
    expect(formatRand(1200)).toBe("R1,200");
    expect(formatRand(1250000)).toBe("R1,250,000");
  });
});

describe("priceLabel", () => {
  it("shows the price, a 'From' price, or Swap", () => {
    expect(priceLabel({ priceZar: 250, priceIsFrom: false, payMode: "cash" })).toBe("R250");
    expect(priceLabel({ priceZar: 400, priceIsFrom: true, payMode: "cash" })).toBe("From R400");
    expect(priceLabel({ priceZar: 450, priceIsFrom: false, payMode: "both" })).toBe("R450");
    expect(priceLabel({ priceZar: null, priceIsFrom: false, payMode: "swap" })).toBe("Swap");
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
