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
});

describe("campuses (accounts spec 3.1)", () => {
  it("accepts only a campus on the list", () => {
    expect(checkCampus("midrand", ["midrand", "pretoria"])).toBe("midrand");
    expect(checkCampus("all", ["midrand", "pretoria"])).toBeNull();
    expect(checkCampus("", ["midrand", "pretoria"])).toBeNull();
  });
});
