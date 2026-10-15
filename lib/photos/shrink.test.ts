import { afterEach, describe, expect, it, vi } from "vitest";
import { SHRINK_MAX_SIDE, SHRINK_QUALITY } from "./rules";
import { fitWithin, shrink } from "./shrink";

const fit = (width: number, height: number) => fitWithin(width, height, SHRINK_MAX_SIDE);
const to = { side: SHRINK_MAX_SIDE, quality: SHRINK_QUALITY };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * A browser for shrink(): a decoded photo 4,000 × 3,000, a 2D context that records what's drawn, and a canvas that
 * encodes with `encodes` (the type it really makes for each type asked for, or null for no blob).
 */
function browser(encodes: (type: string) => string | null, context: "2d" | null = "2d") {
  const calls: string[] = [];
  const close = vi.fn();
  const createImageBitmap = vi.fn(async () => ({ width: 4000, height: 3000, close }));
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  const drawing = {
    set fillStyle(value: string) {
      calls.push(`fillStyle ${value}`);
    },
    fillRect: (...args: number[]) => calls.push(`fillRect ${args.join(" ")}`),
    drawImage: (_: unknown, ...args: number[]) => calls.push(`drawImage ${args.join(" ")}`),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => (context ? drawing : null) as unknown as RenderingContext,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done, type = "image/png") => {
    calls.push(`toBlob ${type}`);
    const made = encodes(type);
    done(made === null ? null : new Blob(["small"], { type: made }));
  });
  return { calls, close, createImageBitmap };
}

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
    expect(await shrink(file, to)).toBe(file);
  });

  it("re-encodes as WebP, turned the way the photo's Exif says (amendment 11.3)", async () => {
    const { calls, close, createImageBitmap } = browser((type) => type);
    const small = await shrink(new File(["big"], "desk.png", { type: "image/png" }), to);
    expect([small.name, small.type]).toEqual(["desk.webp", "image/webp"]);
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: "from-image" });
    expect(calls).toEqual(["drawImage 0 0 1600 1200", "toBlob image/webp"]);
    expect(close).toHaveBeenCalled();
  });

  it("falls back to a JPEG on white where the browser won't make WebP, so a transparent PNG doesn't turn black (amendment 11.3)", async () => {
    // A browser that can't encode WebP hands back a PNG instead.
    const { calls } = browser((type) => (type === "image/webp" ? "image/png" : type));
    const small = await shrink(new File(["big"], "logo.png", { type: "image/png" }), to);
    expect([small.name, small.type]).toEqual(["logo.jpg", "image/jpeg"]);
    expect(calls).toEqual([
      "drawImage 0 0 1600 1200",
      "toBlob image/webp",
      "fillStyle #fff",
      "fillRect 0 0 1600 1200",
      "drawImage 0 0 1600 1200",
      "toBlob image/jpeg",
    ]);
  });

  it("sends the original when the canvas makes no blob, or has no 2D context (amendment 11.3)", async () => {
    const file = new File(["big"], "desk.jpg", { type: "image/jpeg" });
    browser(() => null);
    expect(await shrink(file, to)).toBe(file);
    vi.restoreAllMocks();
    const { calls } = browser((type) => type, null);
    expect(await shrink(file, to)).toBe(file);
    expect(calls).toEqual([]);
  });
});
