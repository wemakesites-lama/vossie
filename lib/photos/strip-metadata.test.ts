import { describe, expect, it } from "vitest";
import {
  ascii,
  concatBytes,
  containsText,
  exifBlock,
  GPS,
  jpegBytes,
  jpegSegment,
  pngBytes,
  pngChunk,
  pngFile,
  riffChunk,
  VP8L_IMAGE,
  webpBytes,
  webpFile,
} from "@/tests/helpers/image-bytes";
import { stripMetadata } from "./strip-metadata";

const SOI = Uint8Array.of(0xff, 0xd8);

/** `count` copies of `unit`, end to end. */
function repeat(unit: Uint8Array, count: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(unit.length * count);
  for (let at = 0; at < out.length; at += unit.length) out.set(unit, at);
  return out;
}

describe("stripping a JPEG (selling spec 2.3, plan decision 11, amendment 8)", () => {
  it("drops Exif, XMP, IPTC and comments, and keeps the image, its tables and its colour profile", () => {
    const original = jpegBytes({ exif: true, xmp: true, iptc: true, comment: true });
    expect(containsText(original, GPS)).toBe(true);
    const stripped = stripMetadata(original, "image/jpeg")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(jpegBytes());
    expect(containsText(stripped, "ICC_PROFILE")).toBe(true);
  });

  it("keeps only what the image needs: JFIF, the colour profile, Adobe's, the tables, the frame and the scans", () => {
    const original = jpegBytes({
      extra: concatBytes(
        jpegSegment(0xee, concatBytes(ascii("Adobe"), Uint8Array.of(0, 100, 0, 0, 0, 0, 1))),
        // DRI, DAC and EXP.
        jpegSegment(0xdd, Uint8Array.of(0, 4)),
        jpegSegment(0xcc, Uint8Array.of(0x10, 0x10)),
        jpegSegment(0xdf, Uint8Array.of(0x11)),
      ),
    });
    expect(stripMetadata(original, "image/jpeg")).toEqual(original);
  });

  it("drops every other APPn, whatever it starts with, and JFIF's extension (JFXX), which can hold a whole JPEG", () => {
    const others = Array.from({ length: 16 }, (_, n) => jpegSegment(0xe0 + n, concatBytes(ascii("Other\0"), ascii(GPS))));
    const jfxx = jpegSegment(0xe0, concatBytes(ascii("JFXX\0"), Uint8Array.of(0x10), jpegBytes({ exif: true })));
    const stripped = stripMetadata(jpegBytes({ extra: concatBytes(...others, jfxx) }), "image/jpeg")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(jpegBytes());
  });

  it("drops an APP11 holding C2PA's provenance, location included (amendment 8.1)", () => {
    const c2pa = jpegSegment(0xeb, concatBytes(ascii("JP\0\0\0\0\0\x01jumb"), ascii(`c2pa ${GPS}`)));
    expect(stripMetadata(jpegBytes({ extra: c2pa }), "image/jpeg")).toEqual(jpegBytes());
  });

  it("refuses the reserved markers F0 to FD", () => {
    for (let marker = 0xf0; marker <= 0xfd; marker++) {
      const reserved = jpegSegment(marker, ascii(GPS));
      expect(stripMetadata(jpegBytes({ extra: reserved }), "image/jpeg"), marker.toString(16)).toBeNull();
    }
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

  it("drops an APP1 or a comment between a progressive JPEG's scans, and keeps the table there (amendment 8.4)", () => {
    const between = concatBytes(jpegSegment(0xe1, exifBlock(1)), jpegSegment(0xfe, ascii(`Taken at ${GPS}`)));
    const stripped = stripMetadata(jpegBytes({ progressive: true, betweenScans: between }), "image/jpeg")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(jpegBytes({ progressive: true }));
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

  it("refuses a JPEG with no image: it needs a frame and a scan before its end (amendment 8.3)", () => {
    expect(stripMetadata(Uint8Array.of(0xff, 0xd8, 0xff, 0xd9), "image/jpeg")).toBeNull();
    const tables = jpegSegment(0xdb, new Uint8Array(65));
    const frame = jpegSegment(0xc0, Uint8Array.of(8, 0, 1, 0, 1, 1, 1, 0x11, 0));
    const scan = concatBytes(jpegSegment(0xda, Uint8Array.of(1, 1, 0, 0, 0x3f, 0)), Uint8Array.of(0x12, 0x34));
    const end = Uint8Array.of(0xff, 0xd9);
    expect(stripMetadata(concatBytes(SOI, tables, frame, end), "image/jpeg")).toBeNull();
    expect(stripMetadata(concatBytes(SOI, tables, scan, end), "image/jpeg")).toBeNull();
    expect(stripMetadata(concatBytes(SOI, tables, frame, scan, end), "image/jpeg")).not.toBeNull();
  });

  it("refuses a restart marker or TEM outside a scan's data (amendment 8.12)", () => {
    const rest = jpegBytes().subarray(2);
    for (const marker of [0xd0, 0xd7, 0x01]) {
      expect(stripMetadata(concatBytes(SOI, Uint8Array.of(0xff, marker), rest), "image/jpeg"), String(marker)).toBeNull();
    }
  });

  it("can't be made to hold far more than the file: a 5 MB run of restart markers, and 100,000 empty tables", () => {
    const rest = jpegBytes().subarray(2);
    const restarts = repeat(Uint8Array.of(0xff, 0xd0), 2.5 * 1024 * 1024);
    expect(stripMetadata(concatBytes(SOI, restarts, rest), "image/jpeg")).toBeNull();

    const tables = concatBytes(SOI, repeat(Uint8Array.of(0xff, 0xdb, 0x00, 0x02), 100_000), rest);
    const stripped = stripMetadata(tables, "image/jpeg")!;
    expect(stripped.length).toBeLessThanOrEqual(tables.length);
    // One buffer the file's size holds everything kept.
    expect(stripped.buffer.byteLength).toBeLessThanOrEqual(tables.length);
  });
});

describe("keeping a JPEG's Orientation (amendment 8.2)", () => {
  /** The APP1 the stripper writes back: Exif, a big-endian TIFF header, and IFD0 holding only the Orientation. */
  const orientationApp1 = (value: number) =>
    Uint8Array.of(
      ...[0xff, 0xe1, 0x00, 0x22],
      ...ascii("Exif\0\0"),
      ...[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08],
      ...[0x00, 0x01],
      ...[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, value, 0x00, 0x00],
      ...[0x00, 0x00, 0x00, 0x00],
    );

  it.each([
    { order: "big-endian (MM)", littleEndian: false },
    { order: "little-endian (II)", littleEndian: true },
  ])("writes back only the Orientation from a $order Exif block, where the Exif was", ({ littleEndian }) => {
    const original = jpegBytes({ extra: jpegSegment(0xe1, exifBlock(6, { littleEndian })) });
    expect(containsText(original, GPS)).toBe(true);
    const stripped = stripMetadata(original, "image/jpeg")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(jpegBytes({ extra: orientationApp1(6) }));
    expect(orientationApp1(6)).toHaveLength(36);
  });

  it("keeps every Orientation from 2 to 8, and a second strip changes nothing", () => {
    for (let value = 2; value <= 8; value++) {
      const stripped = stripMetadata(jpegBytes({ extra: jpegSegment(0xe1, exifBlock(value)) }), "image/jpeg")!;
      expect(stripped, String(value)).toEqual(jpegBytes({ extra: orientationApp1(value) }));
      expect(stripMetadata(stripped, "image/jpeg"), String(value)).toEqual(stripped);
    }
  });

  it("writes no APP1 for Orientation 1, the way up a photo already is", () => {
    expect(stripMetadata(jpegBytes({ extra: jpegSegment(0xe1, exifBlock(1)) }), "image/jpeg")).toEqual(jpegBytes());
  });

  it("writes no APP1, and doesn't throw, when the Exif block is malformed", () => {
    /** exifBlock(6) with `bytes` written at `at`. */
    const broken = (at: number, ...bytes: number[]) => {
      const block = exifBlock(6);
      block.set(bytes, at);
      return block;
    };
    // Offsets into exifBlock: the byte order at 6, 42 at 8, IFD0's offset at 10, its count at 14, the Orientation
    // entry at 28 (its type at 30, its count at 32, its value at 36), the next IFD's offset at 40.
    const blocks = {
      "an unknown byte order": broken(6, 0x58, 0x58),
      "no 42": broken(9, 43),
      "IFD0 past the end": broken(10, 0xff, 0xff, 0xff, 0xff),
      "IFD0 inside the TIFF header": broken(13, 4),
      "more entries than fit": broken(14, 0xff, 0xff),
      "a LONG": broken(31, 4),
      "two values": broken(35, 2),
      "Orientation 9": broken(37, 9),
      "Orientation 0": broken(37, 0),
      "no next IFD offset": exifBlock(6).subarray(0, 40),
      "only a header": ascii("Exif\0\0MM\0*"),
    };
    for (const [name, block] of Object.entries(blocks)) {
      expect(stripMetadata(jpegBytes({ extra: jpegSegment(0xe1, block) }), "image/jpeg"), name).toEqual(jpegBytes());
    }
  });

  it("reads only the first Exif block, and only before the image data, as decoders do", () => {
    const twoBlocks = concatBytes(jpegSegment(0xe1, exifBlock(1)), jpegSegment(0xe1, exifBlock(6)));
    expect(stripMetadata(jpegBytes({ extra: twoBlocks }), "image/jpeg")).toEqual(jpegBytes());
    const late = jpegBytes({ progressive: true, betweenScans: jpegSegment(0xe1, exifBlock(6)) });
    expect(stripMetadata(late, "image/jpeg")).toEqual(jpegBytes({ progressive: true }));
  });
});

describe("stripping a PNG (selling spec 2.3, plan decision 11, amendment 8)", () => {
  it("drops eXIf and the text chunks, and keeps the image and its other chunks", () => {
    const original = pngBytes({ exif: true, text: true, ztxt: true, xmp: true });
    expect(containsText(original, GPS)).toBe(true);
    const stripped = stripMetadata(original, "image/png")!;
    expect(stripped).toEqual(pngBytes());
    for (const type of ["eXIf", "tEXt", "zTXt", "iTXt"]) expect(containsText(stripped, type), type).toBe(false);
  });

  it("keeps only what the image needs: its colours, transparency, density, background and animation", () => {
    const kept = ["PLTE", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "cICP", "mDCV", "cLLI", "bKGD"];
    const animation = ["acTL", "fcTL", "fdAT"];
    const original = pngBytes({
      extra: concatBytes(...[...kept, ...animation].map((type) => pngChunk(type, Uint8Array.of(1, 2, 3, 4)))),
    });
    expect(stripMetadata(original, "image/png")).toEqual(original);
  });

  it("drops every other chunk: C2PA's caBX, zxIf, tIME and private chunks among them (amendment 8.1)", () => {
    const dropped = ["caBX", "zxIf", "tIME", "prVt", "dSIG", "sPLT", "hIST", "vpAg"];
    const original = pngBytes({ extra: concatBytes(...dropped.map((type) => pngChunk(type, ascii(GPS)))) });
    const stripped = stripMetadata(original, "image/png")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(pngBytes());
  });

  it("stops at IEND, dropping even an eXIf after it, and gives back a photo with no metadata unchanged", () => {
    expect(stripMetadata(pngBytes({ trailer: true }), "image/png")).toEqual(pngBytes());
    const late = concatBytes(pngBytes(), pngChunk("eXIf", concatBytes(ascii("MM\0*"), ascii(GPS))));
    expect(stripMetadata(late, "image/png")).toEqual(pngBytes());
    expect(stripMetadata(pngBytes(), "image/png")).toEqual(pngBytes());
  });

  it("refuses a PNG that's cut short or has no end", () => {
    const whole = pngBytes();
    // IEND is the last 12 bytes.
    expect(stripMetadata(whole.subarray(0, whole.length - 12), "image/png")).toBeNull();
    expect(stripMetadata(whole.subarray(0, 40), "image/png")).toBeNull();
  });

  it("refuses a PNG with no image: IHDR must come first, with an IDAT before the end (amendment 8.3)", () => {
    const end = pngChunk("IEND", new Uint8Array(0));
    const header = pngChunk("IHDR", Uint8Array.of(0, 0, 0, 8, 0, 0, 0, 8, 8, 2, 0, 0, 0));
    const pixels = pngChunk("IDAT", Uint8Array.of(0x78, 0x9c));
    expect(stripMetadata(pngFile(end), "image/png")).toBeNull();
    expect(stripMetadata(pngFile(header, end), "image/png")).toBeNull();
    expect(stripMetadata(pngFile(pixels, header, end), "image/png")).toBeNull();
    expect(stripMetadata(pngFile(header, pixels, end), "image/png")).not.toBeNull();
  });

  it("checks its own signature", () => {
    expect(stripMetadata(jpegBytes(), "image/png")).toBeNull();
    const wrong = pngBytes();
    wrong[1] = 0x51;
    expect(stripMetadata(wrong, "image/png")).toBeNull();
  });

  it("drops 100,000 empty chunks at no extra cost (amendment 8.12)", () => {
    const whole = pngBytes();
    // After the signature and the 25-byte IHDR.
    const empties = repeat(pngChunk("prVt", new Uint8Array(0)), 100_000);
    const original = concatBytes(whole.subarray(0, 33), empties, whole.subarray(33));
    const stripped = stripMetadata(original, "image/png")!;
    expect(stripped).toEqual(whole);
    expect(stripped.buffer.byteLength).toBeLessThanOrEqual(original.length);
  });
});

describe("stripping a WebP (selling spec 2.3, plan decision 11, amendment 8)", () => {
  it("drops the EXIF and XMP chunks, clears their flags and works the RIFF size out again", () => {
    const original = webpBytes({ exif: true, xmp: true });
    expect(containsText(original, GPS)).toBe(true);
    const stripped = stripMetadata(original, "image/webp")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(webpBytes({ extended: true }));
  });

  it("drops every other chunk: C2PA's, XMP under other names and chunks it doesn't know (amendment 8.1)", () => {
    const dropped = ["C2PA", "XMP\0", "exif", "UNKN"].map((code) => riffChunk(code, ascii(GPS)));
    const stripped = stripMetadata(webpBytes({ extended: true, extra: concatBytes(...dropped) }), "image/webp")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(webpBytes({ extended: true }));
  });

  it("keeps a lossy image, with its alpha and colour profile (amendment 8.4)", () => {
    expect(stripMetadata(webpBytes({ lossy: true }), "image/webp")).toEqual(webpBytes({ lossy: true }));
    const withAlpha = webpBytes({
      lossy: true,
      extended: true,
      extra: concatBytes(riffChunk("ICCP", Uint8Array.of(1, 2, 3)), riffChunk("ALPH", Uint8Array.of(0, 1))),
    });
    expect(stripMetadata(withAlpha, "image/webp")).toEqual(withAlpha);
  });

  it("keeps an animation's frames, and only the image inside each frame", () => {
    // VP8X's flags: animation 0x02, and EXIF 0x08. ANMF: a 16-byte frame header, then the frame's own chunks.
    const vp8x = (flags: number) => riffChunk("VP8X", Uint8Array.of(flags, 0, 0, 0, 7, 0, 0, 7, 0, 0));
    const frame = (...chunks: Uint8Array[]) => riffChunk("ANMF", concatBytes(new Uint8Array(16), ...chunks));
    const image = concatBytes(riffChunk("ALPH", Uint8Array.of(0, 1)), riffChunk("VP8L", VP8L_IMAGE));
    const original = webpFile(
      vp8x(0x02 | 0x08),
      riffChunk("ANIM", new Uint8Array(6)),
      frame(image, riffChunk("UNKN", ascii(GPS))),
      frame(riffChunk("EXIF", ascii(GPS)), image),
      riffChunk("EXIF", ascii(GPS)),
    );
    const stripped = stripMetadata(original, "image/webp")!;
    expect(containsText(stripped, GPS)).toBe(false);
    expect(stripped).toEqual(webpFile(vp8x(0x02), riffChunk("ANIM", new Uint8Array(6)), frame(image), frame(image)));
  });

  it("gives back a simple WebP unchanged, and drops anything after the RIFF, an EXIF chunk included", () => {
    expect(stripMetadata(webpBytes(), "image/webp")).toEqual(webpBytes());
    expect(stripMetadata(webpBytes({ trailer: true }), "image/webp")).toEqual(webpBytes());
    // The RIFF's size is smaller than the file, and EXIF follows it (amendment 8.4).
    const after = concatBytes(webpBytes(), riffChunk("EXIF", concatBytes(ascii("MM\0*"), ascii(GPS))));
    expect(stripMetadata(after, "image/webp")).toEqual(webpBytes());
  });

  it("refuses a WebP whose sizes don't add up", () => {
    const whole = webpBytes({ exif: true });
    // The RIFF says more than there is.
    expect(stripMetadata(whole.subarray(0, whole.length - 3), "image/webp")).toBeNull();
    // VP8L (at byte 30, after the 12-byte header and the 18-byte VP8X) claims far more than the file holds.
    const lying = whole.slice();
    lying[37] = 0x7f;
    expect(stripMetadata(lying, "image/webp")).toBeNull();
    // A frame whose own chunks run past it.
    const frame = riffChunk("ANMF", concatBytes(new Uint8Array(16), riffChunk("VP8L", VP8L_IMAGE).subarray(0, 12)));
    expect(stripMetadata(webpFile(frame), "image/webp")).toBeNull();
  });

  it("refuses a WebP with no image: it needs VP8, VP8L or a frame holding one (amendment 8.3)", () => {
    expect(stripMetadata(concatBytes(ascii("RIFF"), Uint8Array.of(4, 0, 0, 0), ascii("WEBP")), "image/webp")).toBeNull();
    const vp8x = riffChunk("VP8X", Uint8Array.of(0x02, 0, 0, 0, 7, 0, 0, 7, 0, 0));
    expect(stripMetadata(webpFile(vp8x), "image/webp")).toBeNull();
    const emptyFrame = riffChunk("ANMF", concatBytes(new Uint8Array(16), riffChunk("ALPH", Uint8Array.of(0, 1))));
    expect(stripMetadata(webpFile(vp8x, emptyFrame), "image/webp")).toBeNull();
  });

  it("checks its own signature", () => {
    expect(stripMetadata(pngBytes(), "image/webp")).toBeNull();
    const wave = webpBytes();
    wave.set(ascii("WAVE"), 8);
    expect(stripMetadata(wave, "image/webp")).toBeNull();
  });

  it("drops 100,000 empty chunks at no extra cost (amendment 8.12)", () => {
    const original = webpBytes({ extra: repeat(riffChunk("UNKN", new Uint8Array(0)), 100_000) });
    const stripped = stripMetadata(original, "image/webp")!;
    expect(stripped).toEqual(webpBytes());
    expect(stripped.buffer.byteLength).toBeLessThanOrEqual(original.length);
  });
});
