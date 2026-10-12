import { describe, expect, it } from "vitest";
import { addRecentSearch, clearRecentSearches, getRecentSearches, RECENT_KEY } from "./recent-searches";

describe("recent searches on this device", () => {
  it("starts empty and survives corrupt storage", () => {
    expect(getRecentSearches()).toEqual([]);
    localStorage.setItem(RECENT_KEY, "{not json");
    expect(getRecentSearches()).toEqual([]);
  });

  it("tidies terms, ignores blanks and puts the newest first", () => {
    addRecentSearch("  laptop   charger ");
    addRecentSearch("   ");
    addRecentSearch("braids");
    expect(getRecentSearches()).toEqual(["braids", "laptop charger"]);
  });

  it("moves a repeated term to the top, ignoring case, and keeps five", () => {
    for (const term of ["a", "b", "c", "d", "e", "f"]) addRecentSearch(term);
    addRecentSearch("C");
    expect(getRecentSearches()).toEqual(["C", "f", "e", "d", "b"]);
  });

  it("clears", () => {
    addRecentSearch("notes");
    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });
});
