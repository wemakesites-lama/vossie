import { describe, expect, it } from "vitest";
import { barShare, isTooSmallToChart, sparkline } from "./scale";

describe("barShare", () => {
  it("is the value's share of the largest, from 0", () => {
    expect(barShare(14, 28)).toBe(0.5);
    expect(barShare(0, 28)).toBe(0);
  });
  it("is 0 when everything is 0, never NaN", () => {
    expect(barShare(0, 0)).toBe(0);
  });
  it("never goes past 1", () => {
    expect(barShare(30, 28)).toBe(1);
  });
});

describe("isTooSmallToChart", () => {
  it("writes numbers instead with fewer than 2 points", () => {
    expect(isTooSmallToChart([5])).toBe(true);
    expect(isTooSmallToChart([null, 7, null])).toBe(true);
  });
  it("writes numbers instead when the largest is 3 or under", () => {
    expect(isTooSmallToChart([1, 3, 2])).toBe(true);
  });
  it("charts 2 or more points with a largest over 3", () => {
    expect(isTooSmallToChart([1, 4])).toBe(false);
  });
});

describe("sparkline", () => {
  it("spreads the points across the width and puts the largest at the top", () => {
    const line = sparkline([0, 10], { width: 100, height: 20, pad: 2 });
    expect(line.segments).toEqual(["2,18 98,2"]);
    expect(line.last).toEqual({ x: 98, y: 2 });
  });

  it("breaks the line at a missing day and marks both edges of the gap", () => {
    const line = sparkline([4, 8, null, 6, 2], { width: 100, height: 20, pad: 2 });
    expect(line.segments).toHaveLength(2);
    expect(line.gapEdges).toEqual([
      { x: 26, y: 2 },
      { x: 74, y: 6 },
    ]);
  });

  it("draws a flat line along the bottom when everything is 0", () => {
    const line = sparkline([0, 0, 0], { width: 100, height: 20, pad: 2 });
    expect(line.segments).toEqual(["2,18 50,18 98,18"]);
  });

  it("has no last point when the last day is missing", () => {
    expect(sparkline([3, 5, null], { width: 100, height: 20, pad: 2 }).last).toBeNull();
  });
});

describe("sparkline, a known value between two gaps", () => {
  it("draws it as one filled dot, not a line or a gap circle", () => {
    const line = sparkline([5, null, 7, null, 9], { width: 100, height: 20, pad: 2 });
    expect(line.segments).toEqual([]);
    expect(line.gapEdges).toEqual([]);
    expect(line.isolated.map((point) => point.x)).toEqual([2, 50, 98]);
  });
});
