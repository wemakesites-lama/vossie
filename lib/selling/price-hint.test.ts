// lib/selling/price-hint.test.ts
import { describe, expect, it } from "vitest";
import { hintQuery, priceHintText } from "./price-hint";

const listing = (priceZar: number | null, priceIsFrom = false) => ({ priceZar, priceIsFrom });

describe("the price hint (spec decision 8, plan change 3)", () => {
  it("asks browse for the title's first two words in the suggested category", () => {
    expect(hintQuery("Casio scientific calculator", "tech", "midrand")).toMatchObject({
      q: "casio scientific",
      category: "tech",
      campus: "midrand",
    });
  });

  it("gives the middle half's range once 3 or more priced listings match", () => {
    const prices = [100, 180, 200, 220, 260, 900].map((price) => listing(price));
    expect(priceHintText(prices)).toBe("Similar on CampusCart: R180 to R260 (6 listings)");
  });

  it("leaves out free, swap-only and starting prices, and says nothing under 3", () => {
    expect(priceHintText([listing(0), listing(null), listing(150, true), listing(200), listing(250)])).toBeNull();
    expect(priceHintText([listing(200), listing(200), listing(200)])).toBe("Similar on CampusCart: R200 (3 listings)");
  });
});
