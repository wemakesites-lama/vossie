import { describe, expect, it } from "vitest";
import { ascii, concatBytes, containsText, GPS, jpegBytes, pngBytes, webpBytes } from "@/tests/helpers/image-bytes";
import type { PhotoType } from "@/lib/types";
import { stripMetadata } from "./strip-metadata";

describe("stripping a JPEG (selling spec 2.3, plan decision 11)", () => {
  it("drops Exif, XMP, IPTC and comments, and keeps the image, its tables and its colour profile", () => {
    const original = jpegBytes({ exif: true, xmp: true, iptc: true, comment: true });
    expect(containsText(original, GPS)).toBe(true);
    const stripped = stripMetadata(original, "image/jpeg")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(jpegBytes());
    expect(containsText(stripped, "ICC_PROFILE")).toBe(true);
  });

  it("drops the other application segments too, and keeps Adobe's colour transform", () => {
    const stripped = stripMetadata(jpegBytes({ others: true, adobe: true }), "image/jpeg")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(jpegBytes({ adobe: true }));
  });

  it("gives back a photo with no metadata unchanged, and a second strip changes nothing", () => {
    expect(stripMetadata(jpegBytes(), "image/jpeg")).toEqual(jpegBytes());
    const once = stripMetadata(jpegBytes({ exif: true }), "image/jpeg")!;
    expect(stripMetadata(once, "image/jpeg")).toEqual(once);
  });

  it("reads past fill bytes, and drops whatever a phone appended after the image", () => {
    const stripped = stripMetadata(jpegBytes({ fill: true, trailer: true, exif: true }), "image/jpeg")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(jpegBytes());
  });

  it("refuses a JPEG whose structure doesn't add up", () => {
    const whole = jpegBytes({ exif: true });
    // No end marker.
    expect(stripMetadata(whole.subarray(0, whole.length - 2), "image/jpeg")).toBeNull();
    // Cut inside the Exif segment.
    expect(stripMetadata(whole.subarray(0, 30), "image/jpeg")).toBeNull();
    // No marker where one must be.
    expect(stripMetadata(Uint8Array.of(0xff, 0xd8, 0x12, 0x34), "image/jpeg")).toBeNull();
    expect(stripMetadata(ascii("not a photo"), "image/jpeg")).toBeNull();
  });

  it("refuses a segment whose length is too short to count itself, or runs past the end", () => {
    const start = Uint8Array.of(0xff, 0xd8);
    const end = Uint8Array.of(0xff, 0xd9);
    expect(stripMetadata(concatBytes(start, Uint8Array.of(0xff, 0xe1, 0, 0), end), "image/jpeg")).toBeNull();
    expect(stripMetadata(concatBytes(start, Uint8Array.of(0xff, 0xe1, 0, 1), end), "image/jpeg")).toBeNull();
    expect(stripMetadata(concatBytes(start, Uint8Array.of(0xff, 0xe1, 0xff, 0xff), end), "image/jpeg")).toBeNull();
    // A scan whose data runs to the end of the file with no marker after it.
    const scan = concatBytes(start, Uint8Array.of(0xff, 0xda, 0, 2), new Uint8Array(100).fill(0x55));
    expect(stripMetadata(scan, "image/jpeg")).toBeNull();
  });

  it("gets through a long run of fill bytes without looping, and refuses it when nothing follows", () => {
    const fill = new Uint8Array(1_000_000).fill(0xff);
    expect(stripMetadata(concatBytes(Uint8Array.of(0xff, 0xd8), fill), "image/jpeg")).toBeNull();
    expect(stripMetadata(concatBytes(Uint8Array.of(0xff, 0xd8), fill, Uint8Array.of(0xd9)), "image/jpeg")).toEqual(
      Uint8Array.of(0xff, 0xd8, 0xff, 0xd9),
    );
  });

  it("refuses every file cut short", () => {
    const whole = jpegBytes({ exif: true, xmp: true, iptc: true, comment: true, others: true, adobe: true });
    for (let length = 0; length < whole.length; length++) {
      expect(stripMetadata(whole.subarray(0, length), "image/jpeg"), `cut at ${length}`).toBeNull();
    }
  });
});

describe("stripping a PNG (selling spec 2.3, plan decision 11)", () => {
  it("drops eXIf and the text chunks, and keeps the image and its other chunks", () => {
    const original = pngBytes({ exif: true, text: true, ztxt: true, xmp: true });
    expect(containsText(original, GPS)).toBe(true);
    const stripped = stripMetadata(original, "image/png")!;
    expect(stripped).toEqual(pngBytes());
    for (const type of ["eXIf", "tEXt", "zTXt", "iTXt"]) expect(containsText(stripped, type), type).toBe(false);
  });

  it("drops the time and any chunk it doesn't know, such as content credentials", () => {
    const stripped = stripMetadata(pngBytes({ others: true }), "image/png")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(pngBytes());
  });

  it("stops at IEND, and gives back a photo with no metadata unchanged", () => {
    expect(stripMetadata(pngBytes({ trailer: true }), "image/png")).toEqual(pngBytes());
    expect(stripMetadata(pngBytes(), "image/png")).toEqual(pngBytes());
  });

  it("refuses a PNG that's cut short or has no end", () => {
    const whole = pngBytes();
    // IEND is the last 12 bytes.
    expect(stripMetadata(whole.subarray(0, whole.length - 12), "image/png")).toBeNull();
    expect(stripMetadata(whole.subarray(0, 40), "image/png")).toBeNull();
  });

  it("refuses every file cut short, a chunk that claims more than the file holds, and a wrong signature", () => {
    const whole = pngBytes({ exif: true, text: true, others: true });
    for (let length = 0; length < whole.length; length++) {
      expect(stripMetadata(whole.subarray(0, length), "image/png"), `cut at ${length}`).toBeNull();
    }
    // IHDR's length (bytes 8 to 11) says 4 GB.
    const lying = whole.slice();
    lying.set([0xff, 0xff, 0xff, 0xff], 8);
    expect(stripMetadata(lying, "image/png")).toBeNull();
    const renamed = whole.slice();
    renamed[1] = 0x51;
    expect(stripMetadata(renamed, "image/png")).toBeNull();
  });
});

describe("stripping a WebP (selling spec 2.3, plan decision 11)", () => {
  it("drops the EXIF and XMP chunks, clears their flags and works the RIFF size out again", () => {
    const original = webpBytes({ exif: true, xmp: true });
    expect(containsText(original, GPS)).toBe(true);
    const stripped = stripMetadata(original, "image/webp")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(webpBytes({ extended: true }));
  });

  it("drops any chunk it doesn't know, such as content credentials", () => {
    const stripped = stripMetadata(webpBytes({ exif: true, others: true }), "image/webp")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(webpBytes({ extended: true }));
  });

  it("gives back a simple WebP unchanged, and drops anything after the RIFF", () => {
    expect(stripMetadata(webpBytes(), "image/webp")).toEqual(webpBytes());
    expect(stripMetadata(webpBytes({ trailer: true }), "image/webp")).toEqual(webpBytes());
  });

  it("refuses a WebP whose sizes don't add up", () => {
    const whole = webpBytes({ exif: true });
    // The RIFF says more than there is.
    expect(stripMetadata(whole.subarray(0, whole.length - 3), "image/webp")).toBeNull();
    // VP8L (at byte 30, after the 12-byte header and the 18-byte VP8X) claims far more than the file holds.
    const lying = whole.slice();
    lying[37] = 0x7f;
    expect(stripMetadata(lying, "image/webp")).toBeNull();
  });

  it("refuses every file cut short, stray bytes inside the RIFF, and a wrong signature", () => {
    const whole = webpBytes({ exif: true, xmp: true, others: true });
    for (let length = 0; length < whole.length; length++) {
      expect(stripMetadata(whole.subarray(0, length), "image/webp"), `cut at ${length}`).toBeNull();
    }
    // Three bytes that aren't a chunk, counted in the RIFF size.
    const simple = webpBytes();
    const stray = concatBytes(simple, Uint8Array.of(1, 2, 3));
    stray[4] += 3;
    expect(stripMetadata(stray, "image/webp")).toBeNull();
    // A chunk size of 4 GB, and a RIFF size smaller than its own "WEBP".
    const huge = simple.slice();
    huge.set([0xff, 0xff, 0xff, 0xff], 16);
    expect(stripMetadata(huge, "image/webp")).toBeNull();
    const tiny = simple.slice();
    tiny.set([2, 0, 0, 0], 4);
    expect(stripMetadata(tiny, "image/webp")).toBeNull();
    const wave = simple.slice();
    wave.set(ascii("WAVE"), 8);
    expect(stripMetadata(wave, "image/webp")).toBeNull();
  });
});

describe("stripping a damaged or mislabelled file (selling spec 2.3)", () => {
  it("refuses a file whose bytes aren't the type it's stripped as", () => {
    expect(stripMetadata(pngBytes(), "image/jpeg")).toBeNull();
    expect(stripMetadata(jpegBytes(), "image/png")).toBeNull();
    expect(stripMetadata(pngBytes(), "image/webp")).toBeNull();
  });

  it("never throws, never grows a file and always finishes, whatever bytes it's given", () => {
    // A fixed pseudo-random sequence, so a failure can be run again.
    let seed = 59;
    const next = () => (seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0) / 2 ** 32;
    const cases: [PhotoType, Uint8Array][] = [
      ["image/jpeg", jpegBytes({ exif: true, xmp: true, iptc: true, comment: true, others: true, adobe: true })],
      ["image/png", pngBytes({ exif: true, text: true, ztxt: true, xmp: true, others: true })],
      ["image/webp", webpBytes({ exif: true, xmp: true, others: true })],
    ];
    for (const [type, whole] of cases) {
      for (let round = 0; round < 500; round++) {
        const damaged = whole.slice();
        for (let flips = 1 + Math.floor(next() * 4); flips > 0; flips--) {
          damaged[Math.floor(next() * damaged.length)] = Math.floor(next() * 256);
        }
        const stripped = stripMetadata(damaged, type);
        if (stripped) expect(stripped.length).toBeLessThanOrEqual(damaged.length);
      }
    }
  });
});
