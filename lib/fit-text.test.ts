import { describe, expect, it } from "vitest";
import { fitFontSize } from "./fit-text";

describe("fitFontSize", () => {
  it("scales the base size so the text fills the target width", () => {
    expect(fitFontSize(500, 100, 1000)).toBe(200);
  });

  it("rounds down to a tenth of a pixel so the text never overflows", () => {
    expect(fitFontSize(300, 100, 1000)).toBe(333.3);
  });

  it("keeps the base size when nothing can be measured", () => {
    expect(fitFontSize(0, 100, 1000)).toBe(100);
    expect(fitFontSize(500, 100, 0)).toBe(100);
  });
});
