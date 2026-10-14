import { describe, expect, it } from "vitest";
import { checkCampus, checkFirstName } from "./profile";

describe("first names (accounts spec 3.1)", () => {
  it("tidies the spaces in a first name", () => {
    expect(checkFirstName("  Thandi \n  Mary ")).toEqual({ value: "Thandi Mary", error: null });
  });

  it("asks for a name when there's none", () => {
    expect(checkFirstName("   ").error).toBe("first-name-missing");
  });

  it("takes 2 to 40 characters, counting each letter once", () => {
    expect(checkFirstName("T").error).toBe("first-name-length");
    expect(checkFirstName("Th").error).toBeNull();
    expect(checkFirstName("a".repeat(40)).error).toBeNull();
    expect(checkFirstName("a".repeat(41)).error).toBe("first-name-length");
    expect(checkFirstName("Zoë").error).toBeNull();
  });

  it("drops control characters", () => {
    expect(checkFirstName("Tha\u0000ndi")).toEqual({ value: "Thandi", error: null });
  });

  it("drops invisible format characters, so two zero-width spaces are no name", () => {
    expect(checkFirstName("​​")).toEqual({ value: "", error: "first-name-missing" });
    expect(checkFirstName("​​​﻿­")).toMatchObject({ value: "", error: "first-name-missing" });
    expect(checkFirstName("Tha​ndi")).toEqual({ value: "Thandi", error: null });
  });

  it("removes a right-to-left override, so a name can't flip the text around it", () => {
    expect(checkFirstName("‮Thandi")).toEqual({ value: "Thandi", error: null });
    expect(checkFirstName("Than‮di‬")).toEqual({ value: "Thandi", error: null });
    expect(checkFirstName("⁦Thandi⁩").value).toBe("Thandi");
  });

  it("collapses the spaces that invisible characters leave between words", () => {
    expect(checkFirstName("Thandi ​ Mary")).toEqual({ value: "Thandi Mary", error: null });
    expect(checkFirstName("Thandi\tMary\r\nZola")).toEqual({ value: "Thandi Mary Zola", error: null });
  });

  it("counts a letter and its accent once, whichever way it was typed", () => {
    const decomposed = "Zoë";
    expect(checkFirstName(decomposed)).toEqual({ value: "Zoë", error: null });
    expect([...checkFirstName(decomposed).value]).toHaveLength(3);
    // "é" typed as e + a combining accent is one character, so on its own it is too short.
    expect(checkFirstName("é")).toEqual({ value: "é", error: "first-name-length" });
    expect(checkFirstName("Zé")).toEqual({ value: "Zé", error: null });
    // 40 decomposed letters are 40 characters, not 80.
    expect(checkFirstName("é".repeat(40)).error).toBeNull();
    expect(checkFirstName("é".repeat(41)).error).toBe("first-name-length");
  });

  it("wants at least one letter", () => {
    for (const raw of ["12", "--", "...", "\u{1F600}\u{1F600}", "́́", "1 2"]) {
      expect(checkFirstName(raw).error, raw).toBe("first-name-missing");
    }
    expect(checkFirstName("A1").error).toBeNull();
    expect(checkFirstName("O'Neil").error).toBeNull();
    expect(checkFirstName("Mary-Ann").error).toBeNull();
    expect(checkFirstName("李明").error).toBeNull();
    expect(checkFirstName("محمد").error).toBeNull();
  });
});

describe("campuses (accounts spec 3.1)", () => {
  it("accepts only a campus on the list", () => {
    expect(checkCampus("midrand", ["midrand", "pretoria"])).toBe("midrand");
    expect(checkCampus("all", ["midrand", "pretoria"])).toBeNull();
    expect(checkCampus("", ["midrand", "pretoria"])).toBeNull();
  });
});
