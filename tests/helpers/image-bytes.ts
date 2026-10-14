import { crc32, deflateSync } from "node:zlib";

/**
 * Tiny photos built byte by byte, for the signature check, the metadata stripper and the end-to-end uploads (selling
 * plan decision 14). Every piece of metadata they carry includes GPS, a stand-in location that a stripped file must
 * not contain. The PNG is a real image any decoder reads; the JPEG and WebP have the real structure around stand-in
 * image data, which is all the stripper reads. Node only (zlib): unit tests and Playwright, never the browser.
 */
export const GPS = "GPS 25.7479S 28.2293E";

const EMPTY = new Uint8Array(0);

/** Text as bytes, one per character. ASCII only. */
export function ascii(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

export function concatBytes(...parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Whether `text` appears anywhere in `bytes`. */
export function containsText(bytes: Uint8Array, text: string): boolean {
  return Buffer.from(bytes).includes(text, 0, "latin1");
}

const u16be = (n: number) => [(n >>> 8) & 0xff, n & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u32le = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

// --- JPEG ---------------------------------------------------------------------------------------------------------

/** FF, the marker, a length that counts itself, then the payload. */
export function jpegSegment(marker: number, payload: Uint8Array): Uint8Array<ArrayBuffer> {
  return concatBytes(Uint8Array.of(0xff, marker, ...u16be(payload.length + 2)), payload);
}

/**
 * A real Exif block, as APP1 holds it: "Exif\0\0", a TIFF header in either byte order, and IFD0 with two entries, an
 * ImageDescription holding GPS (its text kept after the IFD) and the Orientation, then the next IFD's offset, 0.
 */
export function exifBlock(orientation: number, { littleEndian = false } = {}): Uint8Array<ArrayBuffer> {
  const u16 = (n: number) => (littleEndian ? [n & 0xff, (n >>> 8) & 0xff] : u16be(n));
  const u32 = (n: number) => (littleEndian ? u32le(n) : u32be(n));
  const text = ascii(`${GPS}\0`);
  // IFD0 starts 8 bytes into the TIFF data: a count, two 12-byte entries and the next IFD's offset, so the text is at 38.
  return concatBytes(
    ascii(littleEndian ? "Exif\0\0II" : "Exif\0\0MM"),
    Uint8Array.of(...u16(42), ...u32(8), ...u16(2)),
    Uint8Array.of(...u16(0x010e), ...u16(2), ...u32(text.length), ...u32(38)),
    // A SHORT sits in the first two bytes of the entry's 4-byte value.
    Uint8Array.of(...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0),
    Uint8Array.of(...u32(0)),
    text,
  );
}

export type JpegOptions = {
  exif?: boolean;
  xmp?: boolean;
  /** Photoshop's APP13, where IPTC keeps a place. */
  iptc?: boolean;
  comment?: boolean;
  /** Extra FF bytes before a marker, which the format allows. */
  fill?: boolean;
  /** Data after the end of the image, as some phones append (a motion photo's video). */
  trailer?: boolean;
  /** Segments added after the colour profile, before the tables: a real Exif APP1, say. */
  extra?: Uint8Array;
  /** A progressive frame (SOF2) with two scans and a table between them, instead of one baseline scan. */
  progressive?: boolean;
  /** Segments added between a progressive JPEG's two scans. */
  betweenScans?: Uint8Array;
};

/**
 * A JPEG's structure: SOI, JFIF, the metadata asked for, a colour profile, the tables, a frame, a scan whose data has
 * a stuffed FF 00 and a restart marker (two of them for a progressive JPEG), and EOI.
 */
export function jpegBytes(options: JpegOptions = {}): Uint8Array<ArrayBuffer> {
  const scan = concatBytes(
    jpegSegment(0xda, Uint8Array.of(1, 1, 0, 0, 0x3f, 0)),
    Uint8Array.of(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56),
  );
  return concatBytes(
    Uint8Array.of(0xff, 0xd8),
    jpegSegment(0xe0, concatBytes(ascii("JFIF\0"), Uint8Array.of(1, 2, 0, 0, 1, 0, 1, 0, 0))),
    options.exif ? jpegSegment(0xe1, concatBytes(ascii("Exif\0\0MM\0*"), ascii(GPS))) : EMPTY,
    options.xmp
      ? jpegSegment(0xe1, concatBytes(ascii("http://ns.adobe.com/xap/1.0/\0"), ascii(`<x:xmpmeta>${GPS}</x:xmpmeta>`)))
      : EMPTY,
    options.iptc ? jpegSegment(0xed, concatBytes(ascii("Photoshop 3.0"), Uint8Array.of(0), ascii(`8BIM ${GPS}`))) : EMPTY,
    options.comment ? jpegSegment(0xfe, ascii(`Taken at ${GPS}`)) : EMPTY,
    jpegSegment(0xe2, concatBytes(ascii("ICC_PROFILE\0"), Uint8Array.of(1, 1, 0, 0))),
    options.extra ?? EMPTY,
    options.fill ? Uint8Array.of(0xff, 0xff) : EMPTY,
    jpegSegment(0xdb, new Uint8Array(65)),
    jpegSegment(options.progressive ? 0xc2 : 0xc0, Uint8Array.of(8, 0, 1, 0, 1, 1, 1, 0x11, 0)),
    jpegSegment(0xc4, new Uint8Array(20)),
    scan,
    options.progressive ? concatBytes(options.betweenScans ?? EMPTY, jpegSegment(0xc4, new Uint8Array(20)), scan) : EMPTY,
    Uint8Array.of(0xff, 0xd9),
    options.trailer ? ascii(`ftypmp42 ${GPS}`) : EMPTY,
  );
}

// --- PNG ----------------------------------------------------------------------------------------------------------

/** A chunk: its data's length, its type, the data and the CRC. */
export function pngChunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const body = concatBytes(ascii(type), data);
  return concatBytes(Uint8Array.of(...u32be(data.length)), body, Uint8Array.of(...u32be(crc32(body))));
}

/** The 8-byte signature, then the chunks given. */
export function pngFile(...chunks: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  return concatBytes(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), ...chunks);
}

export type PngOptions = {
  width?: number;
  height?: number;
  exif?: boolean;
  /** A tEXt comment. */
  text?: boolean;
  /** A compressed zTXt comment. */
  ztxt?: boolean;
  /** XMP, which PNG keeps in an iTXt chunk. */
  xmp?: boolean;
  /** Data after IEND. */
  trailer?: boolean;
  /** Chunks added after the metadata, before pHYs and the image data. */
  extra?: Uint8Array;
};

/** A real 8-bit RGB PNG, sky blue all over, with the metadata asked for before its image data, and a pHYs chunk. */
export function pngBytes({ width = 8, height = 8, ...options }: PngOptions = {}): Uint8Array<ArrayBuffer> {
  // Each row starts with filter type 0 (none), then three bytes a pixel.
  const row = [0, ...Array.from({ length: width }, () => [0x29, 0xab, 0xe2]).flat()];
  const pixels = deflateSync(Uint8Array.from(Array.from({ length: height }, () => row).flat()));
  return pngFile(
    pngChunk("IHDR", Uint8Array.of(...u32be(width), ...u32be(height), 8, 2, 0, 0, 0)),
    options.exif ? pngChunk("eXIf", concatBytes(ascii("MM\0*"), ascii(GPS))) : EMPTY,
    options.text ? pngChunk("tEXt", concatBytes(ascii("Comment\0"), ascii(GPS))) : EMPTY,
    options.ztxt ? pngChunk("zTXt", concatBytes(ascii("Comment\0\0"), deflateSync(ascii(GPS)))) : EMPTY,
    options.xmp
      ? pngChunk("iTXt", concatBytes(ascii("XML:com.adobe.xmp\0\0\0\0\0"), ascii(`<x:xmpmeta>${GPS}</x:xmpmeta>`)))
      : EMPTY,
    options.extra ?? EMPTY,
    pngChunk("pHYs", Uint8Array.of(0, 0, 0x0b, 0x13, 0, 0, 0x0b, 0x13, 1)),
    pngChunk("IDAT", pixels),
    pngChunk("IEND", EMPTY),
    options.trailer ? ascii(GPS) : EMPTY,
  );
}

// --- WebP ---------------------------------------------------------------------------------------------------------

/** A RIFF chunk: its code, its little-endian size, the data, and a padding byte when the size is odd. */
export function riffChunk(code: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  return concatBytes(ascii(code), Uint8Array.of(...u32le(data.length)), data, data.length % 2 ? Uint8Array.of(0) : EMPTY);
}

/** "RIFF", the size of what follows, "WEBP", then the chunks given. */
export function webpFile(...chunks: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const body = concatBytes(ascii("WEBP"), ...chunks);
  return concatBytes(ascii("RIFF"), Uint8Array.of(...u32le(body.length)), body);
}

/** A stand-in lossless image, 13 bytes long, so a padding byte follows it. */
export const VP8L_IMAGE = Uint8Array.of(0x2f, 7, 0xc0, 0x01, 0x10, 0x8d, 0x24, 0x49, 0x12, 0x20, 0x80, 0x88, 0x08);

export type WebpOptions = {
  exif?: boolean;
  xmp?: boolean;
  /** A VP8X header without metadata, as a WebP with transparency has. */
  extended?: boolean;
  /** Data after the RIFF. */
  trailer?: boolean;
  /** A stand-in lossy image (VP8) instead of the lossless one (VP8L). */
  lossy?: boolean;
  /** Chunks added after the metadata, inside the RIFF. */
  extra?: Uint8Array;
};

/**
 * A WebP's structure: RIFF, a VP8X header with its flags (alpha, and EXIF and XMP when they're there), a stand-in
 * image (VP8L, or VP8 for a lossy one; both an odd length, so a padding byte follows), then the metadata asked for.
 */
export function webpBytes(options: WebpOptions = {}): Uint8Array<ArrayBuffer> {
  const header = options.exif || options.xmp || options.extended;
  // VP8X's first byte holds the flags: alpha 0x10, EXIF 0x08, XMP 0x04. Then 3 reserved bytes, then the canvas size.
  const flags = 0x10 | (options.exif ? 0x08 : 0) | (options.xmp ? 0x04 : 0);
  const file = webpFile(
    header ? riffChunk("VP8X", Uint8Array.of(flags, 0, 0, 0, 7, 0, 0, 7, 0, 0)) : EMPTY,
    options.lossy
      ? // A frame tag, the start code 9D 01 2A, then the width and height.
        riffChunk("VP8 ", Uint8Array.of(0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 8, 0, 8, 0, 0x01))
      : riffChunk("VP8L", VP8L_IMAGE),
    options.exif ? riffChunk("EXIF", concatBytes(ascii("MM\0*"), ascii(GPS))) : EMPTY,
    options.xmp ? riffChunk("XMP ", ascii(`<x:xmpmeta>${GPS}</x:xmpmeta>`)) : EMPTY,
    options.extra ?? EMPTY,
  );
  return concatBytes(file, options.trailer ? ascii(GPS) : EMPTY);
}
