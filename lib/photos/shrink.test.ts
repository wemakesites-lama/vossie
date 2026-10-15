import { describe, expect, it } from "vitest";
import { SHRINK_MAX_SIDE, SHRINK_QUALITY } from "./rules";
import { fitWithin, shrink } from "./shrink";

const fit = (width: number, height: number) => fitWithin(width, height, SHRINK_MAX_SIDE);

describe("shrinking a photo in the browser (selling spec 2.3, plan decision 10)", () => {
  it("brings the longest side down to 1,600px, keeping the shape", () => {
    expect(fit(4000, 3000)).toEqual([1600, 1200]);
    expect(fit(3024, 4032)).toEqual([1200, 1600]);
    expect(fit(1601, 1601)).toEqual([1600, 1600]);
  });

  it("never makes a photo bigger, and never less than 1px a side", () => {
    expect(fit(800, 600)).toEqual([800, 600]);
    expect(fit(1600, 900)).toEqual([1600, 900]);
    expect(fit(1, 10_000)).toEqual([1, 1600]);
  });

  it("sends a photo the browser can't decode as it is, for the server to check and strip", async () => {
    // jsdom has no createImageBitmap, as a browser that can't decode the file would fail.
    const file = new File(["not really a photo"], "desk.jpg", { type: "image/jpeg" });
    expect(await shrink(file, { side: SHRINK_MAX_SIDE, quality: SHRINK_QUALITY })).toBe(file);
  });
});
