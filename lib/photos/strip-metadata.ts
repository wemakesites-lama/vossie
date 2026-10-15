import type { PhotoType } from "@/lib/types";

/**
 * A photo without its hidden data (selling spec 2.3, plan decision 11). Location, camera details, times, names and
 * comments sit in their own segments or chunks, which are dropped whole; the image data is copied as it is, so
 * nothing is decoded and no image library is needed (decision 59). The browser re-encodes photos when the app's
 * JavaScript runs, and this still runs on every upload. A file whose structure doesn't add up, or that has no image in
 * it, gives null, and the caller refuses it.
 *
 * Each format keeps only the parts a decoder needs, so metadata in a place this file doesn't name (content
 * credentials, a camera maker's own segment) is dropped too. Every read is checked against the file's length, every
 * step moves forward, and the work is one pass over the bytes into one buffer the file's size, so a damaged or
 * hostile file can't make it read out of range, loop, or take more memory than the file itself.
 */
export function stripMetadata(bytes: Uint8Array, type: PhotoType): Uint8Array<ArrayBuffer> | null {
  switch (type) {
    case "image/jpeg":
      return stripJpeg(bytes);
    case "image/png":
      return stripPng(bytes);
    case "image/webp":
      return stripWebp(bytes);
  }
}

/**
 * The stripped file, built in one buffer the size of the original: a stripped file is never longer, since each part
 * is copied as it is, cut short or left out. Parts that follow each other in the original are copied in one go. So a
 * file of a million tiny parts costs no more memory than itself, and no array of a million pieces to join.
 */
class Output {
  private readonly from: Uint8Array;
  private readonly bytes: Uint8Array<ArrayBuffer>;
  private written = 0;
  // The original's bytes waiting to be copied: from `start` up to `end`.
  private start = 0;
  private end = 0;

  constructor(from: Uint8Array) {
    this.from = from;
    this.bytes = new Uint8Array(from.length);
  }

  /** Copies the original's bytes from `start` up to `end`. */
  copy(start: number, end: number) {
    if (start !== this.end) {
      this.flush();
      this.start = start;
    }
    this.end = end;
  }

  /** Adds bytes of its own, in place of longer ones left out. */
  add(...values: number[]) {
    this.flush();
    for (const value of values) this.bytes[this.written++] = value;
  }

  done(): Uint8Array<ArrayBuffer> {
    this.flush();
    return this.bytes.slice(0, this.written);
  }

  private flush() {
    this.bytes.set(this.from.subarray(this.start, this.end), this.written);
    this.written += this.end - this.start;
    this.start = this.end;
  }
}

/** Whether the bytes from `at` (and before `end`) start with `text`. ASCII only. */
function hasText(bytes: Uint8Array, at: number, end: number, text: string): boolean {
  if (at + text.length > end) return false;
  for (let index = 0; index < text.length; index++) {
    if (bytes[at + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

const uint32be = (bytes: Uint8Array, at: number) =>
  ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
const uint32le = (bytes: Uint8Array, at: number) =>
  (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
/** A chunk's 4-letter code as the number its bytes make (read with uint32be), so no string is made for each chunk. */
const tag = (text: string) => uint32be(Uint8Array.from(text, (character) => character.charCodeAt(0)), 0);
const tags = (...texts: string[]) => new Set(texts.map(tag));

// --- JPEG ---------------------------------------------------------------------------------------------------------
// SOI (FF D8), then segments: FF (after any number of FF fill bytes), a marker, and for most markers a 2-byte
// big-endian length that counts itself, then the data. After each SOS segment comes the scan's compressed data, in
// which FF appears only as FF 00 or a restart marker (FF D0 to D7); the next other marker ends it. EOI (FF D9) ends
// the image, and anything after it (a phone's appended video, say) is dropped.
// Kept: the frame, the tables and the scans (C0 to CF, and DA to DF), and three application segments, each only as
// long as its own fixed fields: JFIF's 14 bytes in APP0 (its thumbnail cleared, so its pixels go), the colour
// profile in APP2, and Adobe's colour transform's 12 bytes in APP14.
// Dropped: every other segment. That covers COM (comments), the other application segments (APP1's Exif, XMP and
// extended XMP, APP13's Photoshop data where IPTC keeps a place, APP11's content credentials, the camera makers'
// own), JFXX (a thumbnail in APP0, which can be a whole JPEG with its own Exif), and markers no decoder reads.
// A file with no image is refused: a frame (SOF) must come before the first scan, and a scan before EOI.

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const TEM = 0x01;
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP14 = 0xee;
const JFIF_LENGTH = 14;
const ADOBE_LENGTH = 12;
const isRestart = (marker: number) => marker >= 0xd0 && marker <= 0xd7;
/** SOF0 to SOF15: C0 to CF, but for DHT (C4), JPG (C8) and DAC (CC). */
const isFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
/** The frames, DHT, JPG and DAC (C0 to CF), then SOS, DQT, DNL, DRI, DHP and EXP (DA to DF). */
const isImageSegment = (marker: number) => marker >= 0xc0 && marker <= 0xdf;

/** Copies what stays of the segment from `at` (its FF) up to `end`. Its data starts 4 bytes in. */
function copyJpegSegment(out: Output, bytes: Uint8Array, marker: number, at: number, end: number) {
  const data = at + 4;
  if (isImageSegment(marker)) {
    out.copy(at, end);
  } else if (marker === APP0) {
    // Version, units and pixel shape, then a thumbnail of 0 by 0.
    if (end - data < JFIF_LENGTH || !hasText(bytes, data, end, "JFIF\0")) return;
    out.add(0xff, APP0, 0, JFIF_LENGTH + 2);
    out.copy(data, data + JFIF_LENGTH - 2);
    out.add(0, 0);
  } else if (marker === APP2) {
    if (hasText(bytes, data, end, "ICC_PROFILE\0")) out.copy(at, end);
  } else if (marker === APP14) {
    if (end - data < ADOBE_LENGTH || !hasText(bytes, data, end, "Adobe")) return;
    out.add(0xff, APP14, 0, ADOBE_LENGTH + 2);
    out.copy(data, data + ADOBE_LENGTH);
  }
}

function stripJpeg(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;
  const out = new Output(bytes);
  out.copy(0, 2);
  let framed = false;
  let scanned = false;
  let at = 2;
  for (;;) {
    if (at >= bytes.length || bytes[at] !== 0xff) return null;
    while (at + 1 < bytes.length && bytes[at + 1] === 0xff) at++;
    if (at + 1 >= bytes.length) return null;
    const marker = bytes[at + 1];
    if (marker === EOI) {
      if (!scanned) return null;
      out.copy(at, at + 2);
      return out.done();
    }
    if (marker === 0x00 || marker === SOI) return null;
    if (marker === TEM || isRestart(marker)) {
      out.copy(at, at + 2);
      at += 2;
      continue;
    }
    if (at + 3 >= bytes.length) return null;
    const end = at + 2 + ((bytes[at + 2] << 8) | bytes[at + 3]);
    if (end < at + 4 || end > bytes.length) return null;
    if (isFrame(marker)) framed = true;
    if (marker === SOS && !framed) return null;
    copyJpegSegment(out, bytes, marker, at, end);
    at = end;
    if (marker !== SOS) continue;
    scanned = true;
    // The scan's compressed data, up to the next marker that isn't a stuffed FF 00 or a restart.
    const start = at;
    while (at + 1 < bytes.length && !(bytes[at] === 0xff && bytes[at + 1] !== 0x00 && !isRestart(bytes[at + 1]))) {
      at++;
    }
    if (at + 1 >= bytes.length) return null;
    out.copy(start, at);
  }
}

// --- PNG ----------------------------------------------------------------------------------------------------------
// The 8-byte signature, then chunks: a 4-byte big-endian length, a 4-letter type, the data and a CRC. IEND ends the
// image, and anything after it is dropped.
// Kept: the image's own chunks and the ones that change how it looks (below), animation included.
// Dropped: everything else. That covers eXIf (Exif), the text chunks tEXt, zTXt and iTXt (where XMP and comments
// live), tIME (when it was last changed), content credentials (caBX) and any app's own chunks.
// A file with no image is refused: IHDR must come first and be 13 bytes long, and an IDAT must come before IEND.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR_LENGTH = 13;
const IHDR = tag("IHDR");
const IDAT = tag("IDAT");
const IEND = tag("IEND");
const PNG_KEPT = tags(
  ...["IHDR", "PLTE", "IDAT", "IEND"],
  // Transparency, colour and size.
  ...["tRNS", "cHRM", "gAMA", "iCCP", "sBIT", "sRGB", "cICP", "mDCV", "cLLI", "bKGD", "pHYs"],
  // Animation.
  ...["acTL", "fcTL", "fdAT"],
);

function stripPng(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return null;
  if (bytes.length < 20 || uint32be(bytes, 8) !== IHDR_LENGTH || uint32be(bytes, 12) !== IHDR) return null;
  const out = new Output(bytes);
  out.copy(0, 8);
  let pictured = false;
  let at = 8;
  while (at + 12 <= bytes.length) {
    const end = at + 12 + uint32be(bytes, at);
    if (end > bytes.length) return null;
    const type = uint32be(bytes, at + 4);
    if (type === IDAT) pictured = true;
    if (PNG_KEPT.has(type)) out.copy(at, end);
    if (type === IEND) return pictured ? out.done() : null;
    at = end;
  }
  return null;
}

// --- WebP ---------------------------------------------------------------------------------------------------------
// "RIFF", the size of what follows (4 bytes, little-endian), "WEBP", then chunks: a 4-letter code, a 4-byte
// little-endian size, the data, and a padding byte when the size is odd. Anything after the RIFF is dropped, and the
// RIFF size is worked out again.
// Kept: the image's chunks (below). VP8X keeps its flags but EXIF's (0x08) and XMP's (0x04).
// Dropped: everything else. That covers EXIF, "XMP ", content credentials (C2PA) and any app's own chunks. An
// animation's frames (ANMF) are kept whole, unknown chunks inside them included: the format puts no metadata there.
// A file with no image is refused: the first chunk must be "VP8 ", VP8L or VP8X, and an image ("VP8 " or VP8L) or
// an animation frame (ANMF) must follow.

const VP8X = tag("VP8X");
const WEBP_KEPT = tags("VP8X", "VP8 ", "VP8L", "ALPH", "ANIM", "ANMF", "ICCP");
const WEBP_FIRST = tags("VP8 ", "VP8L", "VP8X");
const WEBP_IMAGES = tags("VP8 ", "VP8L", "ANMF");

function stripWebp(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (bytes.length < 12 || !hasText(bytes, 0, 4, "RIFF") || !hasText(bytes, 8, 12, "WEBP")) return null;
  const end = 8 + uint32le(bytes, 4);
  if (end < 20 || end > bytes.length || !WEBP_FIRST.has(uint32be(bytes, 12))) return null;
  const out = new Output(bytes);
  // "RIFF", room for the size, "WEBP".
  out.copy(0, 4);
  out.add(0, 0, 0, 0);
  out.copy(8, 12);
  let pictured = false;
  let at = 12;
  while (at + 8 <= end) {
    const size = uint32le(bytes, at + 4);
    const chunkEnd = at + 8 + size + (size % 2);
    if (chunkEnd > end) return null;
    const chunk = uint32be(bytes, at);
    if (WEBP_IMAGES.has(chunk)) pictured = true;
    if (chunk === VP8X && size >= 1) {
      out.copy(at, at + 8);
      out.add(bytes[at + 8] & ~(0x08 | 0x04));
      out.copy(at + 9, chunkEnd);
    } else if (WEBP_KEPT.has(chunk)) {
      out.copy(at, chunkEnd);
    }
    at = chunkEnd;
  }
  if (at !== end || !pictured) return null;
  const stripped = out.done();
  const size = stripped.length - 8;
  stripped.set([size & 0xff, (size >>> 8) & 0xff, (size >>> 16) & 0xff, (size >>> 24) & 0xff], 4);
  return stripped;
}
