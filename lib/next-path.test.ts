import { describe, expect, it } from "vitest";
import { safeNextPath, signInHref } from "./next-path";

describe("safeNextPath (spec 5.9)", () => {
  it("accepts a path on this site", () => {
    expect(safeNextPath("/listings/l-001")).toBe("/listings/l-001");
    expect(safeNextPath("/browse?q=lamp")).toBe("/browse?q=lamp");
    expect(safeNextPath(["/saved", "/account"])).toBe("/saved");
  });

  it("refuses anything that could lead to another site", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/.//evil.example",
      "/a/..//evil.example",
      "/..//evil.example",
      "listings/l-001",
      "",
      undefined,
    ]) {
      expect(safeNextPath(bad), String(bad)).toBeNull();
    }
  });

  it("accepts an encoded slash, which stays a path on this site", () => {
    expect(safeNextPath("/%2Fevil.example")).toBe("/%2Fevil.example");
  });
});

describe("signInHref (spec 5.9)", () => {
  it("links to sign-in, coming back to the path afterwards", () => {
    expect(signInHref("/listings/l-001")).toBe("/login?next=%2Flistings%2Fl-001");
  });
});
