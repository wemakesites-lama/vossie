import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_MB,
  PHOTOS_PER_LISTING,
  POST_PHOTOS_MAX_BYTES,
  SHRINK_MAX_SIDE,
  SHRINK_QUALITIES,
  SHRINK_QUALITY,
  SHRINK_PHOTO_BUDGET,
} from "./rules";
import { fitWithin, shrink, shrinkAll } from "./shrink";

// libheif's part, which needs a real browser and WebAssembly: what it makes of a HEIC is up to each test.
const heicToJpeg = vi.hoisted(() => vi.fn<(file: File) => Promise<File | null>>());
vi.mock("./heic", () => ({ heicToJpeg }));

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
  const createImageBitmap = vi.fn<(source?: Blob) => Promise<{ width: number; height: number; close: () => void }>>(
    async () => ({ width: 4000, height: 3000, close }),
  );
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

  it("opens an iPhone photo the browser can't with libheif, once however many qualities it tries, then re-encodes it", async () => {
    const { createImageBitmap } = browser((type) => type);
    // The browser opens the JPEG libheif made, never the HEIC itself (Chrome).
    createImageBitmap.mockImplementation(async (file?: Blob) => {
      if (file?.type === "image/heic") throw new DOMException("can't decode", "InvalidStateError");
      return { width: 4000, height: 3000, close: vi.fn() };
    });
    heicToJpeg.mockReset().mockResolvedValue(new File(["jpeg"], "IMG_0421.jpg", { type: "image/jpeg" }));
    const small = await shrink(new File(["heic"], "IMG_0421.HEIC", { type: "image/heic" }), {
      ...to,
      budget: 1,
      qualities: [0.8, 0.7, 0.6],
    });
    expect([small.name, small.type]).toEqual(["IMG_0421.webp", "image/webp"]);
    expect(heicToJpeg).toHaveBeenCalledTimes(1);
  });

  it("gives an iPhone photo back as it is when neither the browser nor libheif can open it", async () => {
    browser((type) => type).createImageBitmap.mockRejectedValue(new DOMException("can't decode", "InvalidStateError"));
    heicToJpeg.mockReset().mockResolvedValue(null);
    const file = new File(["heic"], "IMG_0422.heic", { type: "" });
    expect(await shrink(file, to)).toBe(file);
    expect(heicToJpeg).toHaveBeenCalledTimes(1);
  });

  it("never loads libheif for a HEIC the browser opens itself (Safari)", async () => {
    browser((type) => type);
    heicToJpeg.mockReset();
    const small = await shrink(new File(["heic"], "IMG_0423.HEIC", { type: "image/heic" }), to);
    expect(small.type).toBe("image/webp");
    expect(heicToJpeg).not.toHaveBeenCalled();
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

describe("photos under Vercel's 4.5 MB request body (C2/C3 plan decision 16, Task 10)", () => {
  it("takes photos up to 4 MB each, and a post's photos up to 4 MiB, with room for the text", () => {
    expect(PHOTO_MAX_MB).toBe(4);
    expect(PHOTO_MAX_BYTES).toBe(4 * 1024 * 1024);
    expect(POST_PHOTOS_MAX_BYTES).toBe(4_194_304);
    // A listing's text at the very worst (keepTyped's bounds) is about 300 KB; Vercel refuses a body over 4.5 MB.
    expect(POST_PHOTOS_MAX_BYTES + 300_000).toBeLessThan(4_500_000);
    expect(SHRINK_QUALITIES).toEqual([0.8, 0.7, 0.6]);
    expect(SHRINK_QUALITIES[0]).toBe(SHRINK_QUALITY);
    // The browser shrinks each photo to its share, so a post's six fit together.
    expect(SHRINK_PHOTO_BUDGET).toBe(Math.floor(POST_PHOTOS_MAX_BYTES / PHOTOS_PER_LISTING));
    expect(SHRINK_PHOTO_BUDGET * PHOTOS_PER_LISTING).toBeLessThanOrEqual(POST_PHOTOS_MAX_BYTES);
  });

  /** A fake encoder: a file's size at a quality is its "weight" (its name's number, in KB) times the quality. */
  const weighed = (name: string, kb: number) => new File([new Uint8Array(kb * 1000)], name, { type: "image/webp" });
  function encoder() {
    const calls: string[] = [];
    const encode = async (file: File, quality: number) => {
      calls.push(`${file.name} ${quality}`);
      const kb = Number(file.name.split("-")[1]);
      return weighed(file.name, Math.round(kb * quality));
    };
    return { calls, encode };
  }
  const total = (files: readonly File[]) => files.reduce((sum, file) => sum + file.size, 0);

  it("re-encodes at 0.8, then 0.7, then 0.6, one photo at a time, until the photos fit the budget", async () => {
    const { calls, encode } = encoder();
    const files = [weighed("a-1000", 1), weighed("b-1000", 1)];
    const out = await shrinkAll(files, 1_500_000, SHRINK_QUALITIES, encode);
    expect(calls).toEqual(["a-1000 0.8", "b-1000 0.8", "a-1000 0.7", "b-1000 0.7"]);
    expect(total(out)).toBe(1_400_000);
    expect(out.map((file) => file.name)).toEqual(["a-1000", "b-1000"]);
  });

  it("stops at the first quality that fits", async () => {
    const { calls, encode } = encoder();
    const out = await shrinkAll([weighed("a-1000", 1)], 900_000, SHRINK_QUALITIES, encode);
    expect(calls).toEqual(["a-1000 0.8"]);
    expect(total(out)).toBe(800_000);
  });

  it("gives back what it has at 0.6 when that's still over", async () => {
    const { calls, encode } = encoder();
    const out = await shrinkAll([weighed("a-1000", 1), weighed("b-1000", 1)], 1_000_000, SHRINK_QUALITIES, encode);
    expect(calls.at(-1)).toBe("b-1000 0.6");
    expect(calls).toHaveLength(6);
    expect(total(out)).toBe(1_200_000);
  });

  it("re-encodes every photo at the first quality, even a small one, as shrink always has", async () => {
    const { calls, encode } = encoder();
    await shrinkAll([weighed("a-10", 1)], Infinity, SHRINK_QUALITIES, encode);
    expect(calls).toEqual(["a-10 0.8"]);
  });

  it("shrinks a photo again at a lower quality while it's over its share of the post", async () => {
    // Each quality makes a blob of its own size: 0.8 is 900 KB, 0.7 is 800 KB, 0.6 is 600 KB.
    const sizes: Record<string, number> = { "0.8": 900_000, "0.7": 800_000, "0.6": 600_000 };
    const asked: number[] = [];
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 4000, height: 3000, close: () => {} })));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({ drawImage: () => {}, fillRect: () => {} }) as unknown as RenderingContext,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done, type = "image/png", quality = 1) => {
      asked.push(quality as number);
      done(new Blob([new Uint8Array(sizes[String(quality)])], { type }));
    });
    const file = new File(["big"], "desk.jpg", { type: "image/jpeg" });
    const small = await shrink(file, { side: SHRINK_MAX_SIDE, quality: SHRINK_QUALITY, budget: 700_000, qualities: SHRINK_QUALITIES });
    expect(asked).toEqual([0.8, 0.7, 0.6]);
    expect([small.name, small.type, small.size]).toEqual(["desk.webp", "image/webp", 600_000]);
    asked.length = 0;
    const once = await shrink(file, { side: SHRINK_MAX_SIDE, quality: SHRINK_QUALITY, budget: 950_000, qualities: SHRINK_QUALITIES });
    expect(asked).toEqual([0.8]);
    expect(once.size).toBe(900_000);
  });
});
