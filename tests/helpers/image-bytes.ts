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

export type JpegOptions = {
  exif?: boolean;
  xmp?: boolean;
  /** Photoshop's APP13, where IPTC keeps a place. */
  iptc?: boolean;
  comment?: boolean;
  /**
   * The other places phones and editors keep data: content credentials (C2PA) in APP11, Photoshop's "Ducky" APP12,
   * and a multi-picture index in APP2 beside the colour profile.
   */
  others?: boolean;
  /** Adobe's APP14 (its colour transform), which decoders need and the stripper keeps. */
  adobe?: boolean;
  /** Bytes after Adobe's 12 (GPS), which the stripper cuts off. Needs `adobe`. */
  adobeTail?: boolean;
  /**
   * A thumbnail: in JFIF's own segment (7 by 1 RGB pixels whose bytes are GPS), or in a JFXX segment after it (a
   * whole JPEG with its own Exif).
   */
  thumbnail?: "jfif" | "jfxx";
  /** Extra FF bytes before a marker, which the format allows. */
  fill?: boolean;
  /** Data after the end of the image, as some phones append (a motion photo's video). */
  trailer?: boolean;
};

/** JFIF's 14 bytes: its name, version 1.02, no units, a 1:1 pixel shape, and the thumbnail's width and height. */
const jfif = (thumbnailWidth = 0, thumbnailHeight = 0) =>
  concatBytes(ascii("JFIF\0"), Uint8Array.of(1, 2, 0, 0, 1, 0, 1, thumbnailWidth, thumbnailHeight));

/**
 * A baseline JPEG's structure: SOI, JFIF, the metadata asked for, a colour profile, the tables, a frame, one scan
 * whose data has a stuffed FF 00 and a restart marker, and EOI.
 */
export function jpegBytes(options: JpegOptions = {}): Uint8Array<ArrayBuffer> {
  return concatBytes(
    Uint8Array.of(0xff, 0xd8),
    options.thumbnail === "jfif" ? jpegSegment(0xe0, concatBytes(jfif(7, 1), ascii(GPS))) : jpegSegment(0xe0, jfif()),
    // Extension code 0x10: a thumbnail stored as a JPEG.
    options.thumbnail === "jfxx"
      ? jpegSegment(0xe0, concatBytes(ascii("JFXX\0"), Uint8Array.of(0x10), jpegBytes({ exif: true })))
      : EMPTY,
    options.exif ? jpegSegment(0xe1, concatBytes(ascii("Exif\0\0MM\0*"), ascii(GPS))) : EMPTY,
    options.xmp
      ? jpegSegment(0xe1, concatBytes(ascii("http://ns.adobe.com/xap/1.0/\0"), ascii(`<x:xmpmeta>${GPS}</x:xmpmeta>`)))
      : EMPTY,
    options.iptc
      ? jpegSegment(0xed, concatBytes(ascii("Photoshop 3.0"), Uint8Array.of(0), ascii(`8BIM ${GPS}`)))
      : EMPTY,
    options.comment ? jpegSegment(0xfe, ascii(`Taken at ${GPS}`)) : EMPTY,
    options.others
      ? concatBytes(
          jpegSegment(0xeb, concatBytes(ascii("JP"), Uint8Array.of(0, 0, 0, 0, 0, 1), ascii(`jumbc2pa ${GPS}`))),
          jpegSegment(0xec, concatBytes(ascii("Ducky"), Uint8Array.of(0, 1), ascii(GPS))),
          jpegSegment(0xe2, concatBytes(ascii("MPF\0"), ascii(GPS))),
        )
      : EMPTY,
    jpegSegment(0xe2, concatBytes(ascii("ICC_PROFILE\0"), Uint8Array.of(1, 1, 0, 0))),
    options.adobe
      ? jpegSegment(
          0xee,
          concatBytes(ascii("Adobe"), Uint8Array.of(0, 100, 0, 0, 0, 0, 1), options.adobeTail ? ascii(GPS) : EMPTY),
        )
      : EMPTY,
    options.fill ? Uint8Array.of(0xff, 0xff) : EMPTY,
    jpegSegment(0xdb, new Uint8Array(65)),
    jpegSegment(0xc0, Uint8Array.of(8, 0, 1, 0, 1, 1, 1, 0x11, 0)),
    jpegSegment(0xc4, new Uint8Array(20)),
    jpegSegment(0xda, Uint8Array.of(1, 1, 0, 0, 0x3f, 0)),
    Uint8Array.of(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56),
    Uint8Array.of(0xff, 0xd9),
    options.trailer ? ascii(`ftypmp42 ${GPS}`) : EMPTY,
  );
}

// --- PNG ----------------------------------------------------------------------------------------------------------

/** A PNG's signature, then the chunks given. */
export function pngFile(...chunks: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  return concatBytes(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), ...chunks);
}

export function pngChunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const body = concatBytes(ascii(type), data);
  return concatBytes(Uint8Array.of(...u32be(data.length)), body, Uint8Array.of(...u32be(crc32(body))));
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
  /** The other places data hides: a tIME chunk and content credentials (C2PA's caBX). */
  others?: boolean;
  /** Data after IEND. */
  trailer?: boolean;
};

/** A real 8-bit RGB PNG, sky blue all over, with the metadata asked for before its image data, and a pHYs chunk. */
export function pngBytes({ width = 8, height = 8, ...options }: PngOptions = {}): Uint8Array<ArrayBuffer> {
  // Each row starts with filter type 0 (none), then three bytes a pixel.
  const row = [0, ...Array.from({ length: width }, () => [0x29, 0xab, 0xe2]).flat()];
  const pixels = deflateSync(Uint8Array.from(Array.from({ length: height }, () => row).flat()));
  return concatBytes(
    pngFile(),
    pngChunk("IHDR", Uint8Array.of(...u32be(width), ...u32be(height), 8, 2, 0, 0, 0)),
    options.exif ? pngChunk("eXIf", concatBytes(ascii("MM\0*"), ascii(GPS))) : EMPTY,
    options.text ? pngChunk("tEXt", concatBytes(ascii("Comment\0"), ascii(GPS))) : EMPTY,
    options.ztxt ? pngChunk("zTXt", concatBytes(ascii("Comment\0\0"), deflateSync(ascii(GPS)))) : EMPTY,
    options.xmp
      ? pngChunk("iTXt", concatBytes(ascii("XML:com.adobe.xmp\0\0\0\0\0"), ascii(`<x:xmpmeta>${GPS}</x:xmpmeta>`)))
      : EMPTY,
    options.others
      ? concatBytes(
          pngChunk("tIME", Uint8Array.of(0x07, 0xea, 10, 14, 9, 30, 0)),
          pngChunk("caBX", concatBytes(ascii("jumbc2pa "), ascii(GPS))),
        )
      : EMPTY,
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

export type WebpOptions = {
  exif?: boolean;
  xmp?: boolean;
  /** A chunk the format doesn't define, as content credentials (C2PA) are kept. */
  others?: boolean;
  /** A VP8X header without metadata, as a WebP with transparency has. */
  extended?: boolean;
  /** Data after the RIFF. */
  trailer?: boolean;
};

/**
 * A WebP's structure: RIFF, a VP8X header with its flags (alpha, and EXIF and XMP when they're there), a stand-in
 * VP8L image 13 bytes long (so a padding byte follows it), then the metadata asked for.
 */
export function webpBytes(options: WebpOptions = {}): Uint8Array<ArrayBuffer> {
  const header = options.exif || options.xmp || options.others || options.extended;
  // VP8X's first byte holds the flags: alpha 0x10, EXIF 0x08, XMP 0x04. Then 3 reserved bytes, then the canvas size.
  const flags = 0x10 | (options.exif ? 0x08 : 0) | (options.xmp ? 0x04 : 0);
  const file = webpFile(
    header ? riffChunk("VP8X", Uint8Array.of(flags, 0, 0, 0, 7, 0, 0, 7, 0, 0)) : EMPTY,
    riffChunk("VP8L", Uint8Array.of(0x2f, 7, 0xc0, 0x01, 0x10, 0x8d, 0x24, 0x49, 0x12, 0x20, 0x80, 0x88, 0x08)),
    options.exif ? riffChunk("EXIF", concatBytes(ascii("MM\0*"), ascii(GPS))) : EMPTY,
    options.xmp ? riffChunk("XMP ", ascii(`<x:xmpmeta>${GPS}</x:xmpmeta>`)) : EMPTY,
    options.others ? riffChunk("C2PA", ascii(`jumbc2pa ${GPS}`)) : EMPTY,
  );
  return concatBytes(file, options.trailer ? ascii(GPS) : EMPTY);
}

/** A WebP made of the chunks given, with its RIFF size worked out. */
export function webpFile(...chunks: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const body = concatBytes(ascii("WEBP"), ...chunks);
  return concatBytes(ascii("RIFF"), Uint8Array.of(...u32le(body.length)), body);
}
