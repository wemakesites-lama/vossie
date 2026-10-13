import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

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
      "listings/l-001",
      "",
      undefined,
    ]) {
      expect(safeNextPath(bad), String(bad)).toBeNull();
    }
  });
});
