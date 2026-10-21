import { describe, expect, it } from "vitest";
import {
  badgeLabel,
  budgetLabel,
  conditionLabel,
  dayMonth,
  eventDate,
  formatRand,
  hubKindLabel,
  joinWords,
  listingsLabel,
  monthYear,
  offersLabel,
  offersSoFarLabel,
  placesLabel,
  priceLabel,
  sellerCardAlt,
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
      "Casio fx-991ZA Plus calculator, R250, at Midrand on CampusCart",
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

describe("shopping wording (shopping spec 4 and 7)", () => {
  it("writes a YYYY-MM month in words, for Selling since", () => {
    expect(monthYear("2026-03")).toBe("March 2026");
    expect(monthYear("2025-12")).toBe("December 2025");
  });

  it("counts listings in plain words", () => {
    expect(listingsLabel(1)).toBe("1 listing");
    expect(listingsLabel(0)).toBe("0 listings");
    expect(listingsLabel(12)).toBe("12 listings");
  });

  it("says who, what and where on a seller's share card", () => {
    expect(sellerCardAlt("Tech corner", "Tech", "Midrand")).toBe("Tech corner, Tech at Midrand on CampusCart");
  });
});

describe("Looking For wording (community spec 4.1 and 4.2)", () => {
  it("writes a request's budget", () => {
    expect(budgetLabel({ budgetZar: 300, swapWelcome: false })).toBe("Budget R300");
    expect(budgetLabel({ budgetZar: 1200, swapWelcome: false })).toBe("Budget R1,200");
    expect(budgetLabel({ budgetZar: 300, swapWelcome: true })).toBe("Budget R300 or a swap");
    expect(budgetLabel({ budgetZar: null, swapWelcome: false })).toBe("Open to offers");
    expect(budgetLabel({ budgetZar: null, swapWelcome: true })).toBe("Open to offers or a swap");
  });

  it("counts the offers so far, inviting the first", () => {
    expect(offersSoFarLabel(0)).toBe("No offers yet. Be the first.");
    expect(offersSoFarLabel(1)).toBe("1 offer so far");
    expect(offersSoFarLabel(2)).toBe("2 offers so far");
  });

  it("writes a YYYY-MM-DD date as a day and a short month", () => {
    expect(dayMonth("2026-10-24")).toBe("24 Oct");
    expect(dayMonth("2026-11-05")).toBe("5 Nov");
  });
});

describe("Hub wording (community spec 5.1)", () => {
  it("names each kind of post", () => {
    expect(hubKindLabel("event")).toBe("Event");
    expect(hubKindLabel("office-hours")).toBe("Office hours");
    expect(hubKindLabel("tip")).toBe("Tip");
  });

  it("counts an event's RSVPs and places", () => {
    expect(placesLabel(12, 80)).toBe("12 going · 80 places");
    expect(placesLabel(0, 1)).toBe("0 going · 1 place");
  });
});
