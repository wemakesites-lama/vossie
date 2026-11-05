import { describe, expect, it } from "vitest";
import { MARK, MARK_VIEWBOX, markShapes, markSvg, starPath } from "./cart-mark";

describe("starPath", () => {
  it("draws a concave four-point star through its four tips", () => {
    expect(starPath([10, 20, 5])).toBe("M10 15Q10 20 15 20Q10 20 10 25Q10 20 5 20Q10 20 10 15Z");
  });
});

describe("MARK", () => {
  it("has three stars in the full mark and one in the small cut, with heavier lines in the small cut", () => {
    expect(MARK.full.smallStars).toHaveLength(2);
    expect(MARK.small.smallStars).toHaveLength(0);
    expect(MARK.small.line).toBeGreaterThan(MARK.full.line);
  });
});

describe("markShapes", () => {
  it("draws the lines and small stars in one colour and the big star in another", () => {
    const shapes = markShapes("full", "#ffffff", "#29abe2");
    // The handle, the rim and two wheels.
    expect(shapes.match(/stroke="#ffffff"/g)).toHaveLength(4);
    expect(shapes).toContain(`<path d="${MARK.full.smallStars.map(starPath).join("")}" fill="#ffffff"/>`);
    expect(shapes).toContain(`<path d="${starPath(MARK.full.bigStar)}" fill="#29abe2" class="cart-mark-star"/>`);
  });

  it("leaves the small stars out of the small cut", () => {
    expect(markShapes("small", "#ffffff", "#ffffff").match(/<path/g)).toHaveLength(3);
  });
});

describe("markSvg", () => {
  it("is a standalone SVG file in the mark's grid", () => {
    const svg = markSvg("full", "#15305d", "#15305d");
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain(`viewBox="${MARK_VIEWBOX}"`);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });
});
