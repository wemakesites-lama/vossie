import { describe, expect, it } from "vitest";
import { matchScore, queryWords, searchWords, withinOneEdit, wordMatches } from "./search";

describe("searchWords", () => {
  it("lowercases, drops accents and splits on anything that isn't a letter or digit", () => {
    expect(searchWords("Café Crème, 2-in-1!")).toEqual(["cafe", "creme", "2", "in", "1"]);
    expect(searchWords("Casio fx-991ZA")).toEqual(["casio", "fx", "991za"]);
  });
});

describe("queryWords", () => {
  it("drops stop words and single letters, but keeps digits", () => {
    expect(queryWords("Notes for the Accounting 1 module, a must")).toEqual([
      "notes",
      "accounting",
      "1",
      "module",
      "must",
    ]);
  });

  it("is empty with no search, or a search of only small words", () => {
    expect(queryWords(null)).toEqual([]);
    expect(queryWords("the and a")).toEqual([]);
  });
});

describe("withinOneEdit", () => {
  it("allows one letter added, removed or changed, or two neighbours swapped", () => {
    expect(withinOneEdit("calculater", "calculator")).toBe(true);
    expect(withinOneEdit("brads", "braids")).toBe(true);
    expect(withinOneEdit("braids", "brads")).toBe(true);
    expect(withinOneEdit("kettel", "kettle")).toBe(true);
    expect(withinOneEdit("lamp", "lamp")).toBe(true);
  });

  it("refuses two edits", () => {
    expect(withinOneEdit("bakery", "baked")).toBe(false);
    expect(withinOneEdit("brads", "bread")).toBe(false);
    expect(withinOneEdit("lamp", "lampshade")).toBe(false);
  });
});

describe("wordMatches", () => {
  it("matches the start of a word at any length", () => {
    expect(wordMatches("calc", "calculator")).toBe(true);
    expect(wordMatches("991", "991za")).toBe(true);
    expect(wordMatches("lator", "calculator")).toBe(false);
  });

  it("forgives one typo only in words of five letters or more", () => {
    expect(wordMatches("brads", "braids")).toBe(true);
    expect(wordMatches("brad", "braid")).toBe(false);
  });
});

describe("matchScore", () => {
  const calculator = {
    title: "Casio fx-991ZA Plus calculator",
    category: "Tech",
    seller: "Tech corner",
    description: "Approved for exams.",
  };

  it("scores 3 in the title, 2 in the category or seller name, 1 in the description", () => {
    expect(matchScore(calculator, ["calculator"])).toBe(3);
    expect(matchScore(calculator, ["corner"])).toBe(2);
    expect(matchScore(calculator, ["exams"])).toBe(1);
    expect(matchScore(calculator, ["calculator", "tech"])).toBe(5);
  });

  it("needs every word to match", () => {
    expect(matchScore(calculator, ["calculator", "kettle"])).toBeNull();
  });

  it("matches everything with no words", () => {
    expect(matchScore(calculator, [])).toBe(0);
  });
});
