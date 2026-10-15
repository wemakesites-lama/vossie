import { describe, expect, it } from "vitest";
import {
  ascii,
  concatBytes,
  containsText,
  GPS,
  jpegBytes,
  jpegSegment,
  pngBytes,
  pngChunk,
  pngFile,
  riffChunk,
  webpBytes,
  webpFile,
} from "@/tests/helpers/image-bytes";
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

  it("keeps JFIF's 14 bytes and not its thumbnail, and drops a JFXX thumbnail whole", () => {
    for (const thumbnail of ["jfif", "jfxx"] as const) {
      const original = jpegBytes({ thumbnail });
      expect(containsText(original, GPS), thumbnail).toBe(true);
      expect(stripMetadata(original, "image/jpeg"), thumbnail).toEqual(jpegBytes());
    }
  });

  it("keeps Adobe's 12 bytes and nothing after them", () => {
    const stripped = stripMetadata(jpegBytes({ adobe: true, adobeTail: true }), "image/jpeg")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(jpegBytes({ adobe: true }));
  });

  it("drops a JFIF or Adobe segment too short to be one", () => {
    // jpegBytes() is SOI (2 bytes), then its 18-byte JFIF segment.
    const rest = jpegBytes().subarray(20);
    const short = concatBytes(
      Uint8Array.of(0xff, 0xd8),
      jpegSegment(0xe0, ascii("JFIF\0")),
      jpegSegment(0xee, ascii("Adobe\0d")),
      rest,
    );
    expect(stripMetadata(short, "image/jpeg")).toEqual(concatBytes(Uint8Array.of(0xff, 0xd8), rest));
  });

  it("drops segments under markers no decoder reads", () => {
    const start = Uint8Array.of(0xff, 0xd8);
    // 0x02 to 0xBF are reserved, and 0xF0 to 0xFD are JPEG extensions (JPG0 to JPG13).
    const odd = [0x02, 0xbf, 0xf0, 0xf7, 0xfd].map((marker) => jpegSegment(marker, ascii(GPS)));
    expect(stripMetadata(concatBytes(start, ...odd, jpegBytes().subarray(2)), "image/jpeg")).toEqual(jpegBytes());
  });

  it("refuses a JPEG with no image: a frame (SOF) must come before the first scan (SOS), and a scan before EOI", () => {
    const start = Uint8Array.of(0xff, 0xd8);
    const end = Uint8Array.of(0xff, 0xd9);
    const tables = jpegSegment(0xdb, new Uint8Array(65));
    const frame = jpegSegment(0xc0, Uint8Array.of(8, 0, 1, 0, 1, 1, 1, 0x11, 0));
    const huffman = jpegSegment(0xc4, new Uint8Array(20));
    const scan = concatBytes(jpegSegment(0xda, Uint8Array.of(1, 1, 0, 0, 0x3f, 0)), Uint8Array.of(0x12, 0x34));
    expect(stripMetadata(concatBytes(start, end), "image/jpeg")).toBeNull();
    expect(stripMetadata(concatBytes(start, tables, huffman, scan, end), "image/jpeg")).toBeNull();
    expect(stripMetadata(concatBytes(start, tables, huffman, scan, frame, end), "image/jpeg")).toBeNull();
    expect(stripMetadata(concatBytes(start, tables, frame, huffman, end), "image/jpeg")).toBeNull();
    // DHT (C4), JPG (C8) and DAC (CC) sit among the frame markers but aren't frames.
    for (const marker of [0xc4, 0xc8, 0xcc]) {
      const notFrame = jpegSegment(marker, Uint8Array.of(8, 0, 1, 0, 1, 1, 1, 0x11, 0));
      expect(stripMetadata(concatBytes(start, notFrame, huffman, scan, end), "image/jpeg"), `${marker}`).toBeNull();
    }
    const whole = concatBytes(start, tables, frame, huffman, scan, end);
    expect(stripMetadata(whole, "image/jpeg")).toEqual(whole);
    // A progressive frame (C2) counts too.
    const progressive = concatBytes(start, tables, jpegSegment(0xc2, new Uint8Array(9)), huffman, scan, end);
    expect(stripMetadata(progressive, "image/jpeg")).toEqual(progressive);
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
    // The fill, then the rest of the photo from its first marker's code (after SOI and that marker's FF).
    const filled = concatBytes(Uint8Array.of(0xff, 0xd8), fill, jpegBytes().subarray(3));
    expect(stripMetadata(filled, "image/jpeg")).toEqual(jpegBytes());
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

  it("refuses a PNG with no image: IHDR first and 13 bytes long, and an IDAT before IEND", () => {
    const end = pngChunk("IEND", new Uint8Array(0));
    const header = pngChunk("IHDR", Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0));
    const pixels = pngChunk("IDAT", Uint8Array.of(0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01));
    const physical = pngChunk("pHYs", Uint8Array.of(0, 0, 0x0b, 0x13, 0, 0, 0x0b, 0x13, 1));
    expect(stripMetadata(pngFile(end), "image/png")).toBeNull();
    expect(stripMetadata(pngFile(header, end), "image/png")).toBeNull();
    expect(stripMetadata(pngFile(header, physical, end, pixels), "image/png")).toBeNull();
    expect(stripMetadata(pngFile(physical, header, pixels, end), "image/png")).toBeNull();
    const longHeader = pngChunk("IHDR", Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0, 0));
    expect(stripMetadata(pngFile(longHeader, pixels, end), "image/png")).toBeNull();
    expect(stripMetadata(pngFile(header, pixels, end), "image/png")).toEqual(pngFile(header, pixels, end));
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

  it("refuses a WebP with no image: VP8, VP8L or VP8X first, and an image or a frame in it", () => {
    const header = riffChunk("VP8X", Uint8Array.of(0x10, 0, 0, 0, 7, 0, 0, 7, 0, 0));
    const lossless = riffChunk("VP8L", Uint8Array.of(0x2f, 7, 0xc0, 0x01, 0x10));
    const alpha = riffChunk("ALPH", Uint8Array.of(0, 1, 2));
    const profile = riffChunk("ICCP", ascii("<html><script>alert(1)</script></html>"));
    expect(stripMetadata(webpFile(), "image/webp")).toBeNull();
    expect(stripMetadata(webpFile(profile), "image/webp")).toBeNull();
    expect(stripMetadata(webpFile(header, alpha, profile), "image/webp")).toBeNull();
    expect(stripMetadata(webpFile(alpha, lossless), "image/webp")).toBeNull();
    expect(stripMetadata(webpFile(profile, header, lossless), "image/webp")).toBeNull();
    for (const image of [lossless, riffChunk("VP8 ", new Uint8Array(10)), riffChunk("ANMF", new Uint8Array(16))]) {
      expect(stripMetadata(webpFile(header, image), "image/webp")).toEqual(webpFile(header, image));
    }
    expect(stripMetadata(webpFile(lossless), "image/webp")).toEqual(webpFile(lossless));
    expect(stripMetadata(webpFile(riffChunk("VP8 ", new Uint8Array(10))), "image/webp")).not.toBeNull();
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

/** `head`, then `count` copies of `unit`, then `tail`, built in one buffer. */
function repeated(head: Uint8Array, unit: Uint8Array, count: number, tail: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(head.length + unit.length * count + tail.length);
  out.set(head, 0);
  for (let index = 0; index < count; index++) out.set(unit, head.length + index * unit.length);
  out.set(tail, head.length + unit.length * count);
  return out;
}

describe("stripping a file of many tiny parts (selling spec 2.3)", () => {
  // About 5 MB (the upload limit) of parts as small as the format allows, all kept, after one that's dropped. The
  // bounds are generous for a slow machine: each strip takes tens of milliseconds and a few MB, where copying each
  // part on its own and joining them took up to a second and hundreds of MB.
  const MAX_MS = 750;
  const MAX_HEAP_MB = 32;
  const check = (original: Uint8Array, type: PhotoType, expected: Uint8Array) => {
    const heap = process.memoryUsage().heapUsed;
    const start = performance.now();
    const stripped = stripMetadata(original, type);
    const ms = performance.now() - start;
    const heapMb = (process.memoryUsage().heapUsed - heap) / 2 ** 20;
    // Buffer compares the bytes in one go; toEqual would walk them one by one for seconds.
    expect(stripped !== null && Buffer.from(stripped).equals(Buffer.from(expected))).toBe(true);
    expect(ms).toBeLessThan(MAX_MS);
    expect(heapMb).toBeLessThan(MAX_HEAP_MB);
  };

  it("strips a JPEG of a million tiny segments quickly and in little memory", () => {
    const photo = jpegBytes();
    const comment = Uint8Array.of(0xff, 0xfe, 0, 2);
    const head = photo.subarray(0, photo.length - 2);
    const end = Uint8Array.of(0xff, 0xd9);
    // An empty table, a restart marker between segments, and a scan with one byte of data.
    const unit = Uint8Array.of(0xff, 0xdb, 0, 2, 0xff, 0xd0, 0xff, 0xda, 0, 2, 0x11);
    const count = 450_000;
    check(
      repeated(concatBytes(head, comment), unit, count, end),
      "image/jpeg",
      repeated(head, unit, count, end),
    );
  });

  it("strips a PNG of 430,000 empty chunks quickly and in little memory", () => {
    const photo = pngBytes();
    // The signature and IHDR are the first 33 bytes.
    const head = photo.subarray(0, 33);
    const tail = photo.subarray(33);
    const text = pngChunk("tEXt", new Uint8Array(0));
    const bits = pngChunk("sBIT", new Uint8Array(0));
    const count = 430_000;
    check(repeated(concatBytes(head, text), bits, count, tail), "image/png", repeated(head, bits, count, tail));
  });

  it("strips a WebP of 650,000 empty chunks quickly and in little memory", () => {
    const header = riffChunk("VP8X", Uint8Array.of(0x10, 0, 0, 0, 7, 0, 0, 7, 0, 0));
    const xmp = riffChunk("XMP ", new Uint8Array(0));
    const profile = riffChunk("ICCP", new Uint8Array(0));
    const image = riffChunk("VP8L", Uint8Array.of(0x2f, 7, 0xc0, 0x01, 0x10));
    const count = 650_000;
    check(
      webpFile(repeated(concatBytes(header, xmp), profile, count, image)),
      "image/webp",
      webpFile(repeated(header, profile, count, image)),
    );
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
