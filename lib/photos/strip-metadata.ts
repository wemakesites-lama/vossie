import type { PhotoType } from "@/lib/types";

/**
 * A photo with only what its image needs (selling spec 2.3 and 8.4, plan decision 11, amendment 8). Each format's
 * segments or chunks are checked against an allowlist: the image data, and what shows it right (tables, colour
 * profile, transparency, animation), are copied as they are; everything else is dropped whole, so location, camera
 * details, times, names, comments, provenance and anything unknown go. Nothing is decoded, and no image library is
 * needed (decision 59). The browser re-encodes photos when the app's JavaScript runs, and this still runs on every
 * upload.
 *
 * Kept bytes go into one buffer the size of the file (amendment 8.12), so no file can make this hold more than
 * itself, however many pieces it has. Every read is checked against the file's length first. A file whose structure
 * doesn't add up, or that holds no image, gives null, and the caller refuses it.
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

/** What's kept so far: one buffer the size of the file, filled from the start. */
class Kept {
  readonly out: Uint8Array<ArrayBuffer>;
  length = 0;

  constructor(size: number) {
    this.out = new Uint8Array(size);
  }

  /** Copies `bytes` from `start` up to `end`. */
  copy(bytes: Uint8Array, start = 0, end = bytes.length): void {
    this.out.set(bytes.subarray(start, end), this.length);
    this.length += end - start;
  }

  result(): Uint8Array<ArrayBuffer> {
    return this.out.subarray(0, this.length);
  }
}

const codes = (text: string) => Array.from(text, (character) => character.charCodeAt(0));
/** Whether `bytes` holds `expected` at `at`, all of it before `end`. */
const holds = (bytes: Uint8Array, at: number, end: number, expected: readonly number[]) =>
  at + expected.length <= end && expected.every((byte, index) => bytes[at + index] === byte);
// These read 2 or 4 bytes; each caller has checked they're inside the file.
const fourCC = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
const uint16be = (bytes: Uint8Array, at: number) => (bytes[at] << 8) | bytes[at + 1];
const uint32be = (bytes: Uint8Array, at: number) =>
  ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
const uint32le = (bytes: Uint8Array, at: number) =>
  (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;

function setUint32le(bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = value & 0xff;
  bytes[at + 1] = (value >>> 8) & 0xff;
  bytes[at + 2] = (value >>> 16) & 0xff;
  bytes[at + 3] = (value >>> 24) & 0xff;
}

// --- JPEG ---------------------------------------------------------------------------------------------------------
// SOI (FF D8), then segments: FF, any number of FF fill bytes (dropped), a marker, a 2-byte big-endian length that
// counts itself, then the data. After each SOS segment comes the scan's data, in which FF appears only as FF 00, a
// restart marker (FF D0 to D7) or TEM (FF 01), perhaps after fill bytes; the next other marker ends it. EOI (FF D9)
// ends the image, and anything after it (a phone's appended video, say) is dropped.
// Kept: the tables (DQT, DHT, DAC), DRI, the frame (SOF0 to SOF15), the scans (SOS and their data), DNL and EXP; APP0
// only for JFIF, APP2 only for a colour profile, APP14 only for Adobe's colour transform.
// Dropped: every other APPn (Exif, XMP, IPTC, C2PA, JFIF's extension, which can hold a whole JPEG, and the rest),
// comments, and the other markers that carry a length. The first Exif APP1 before the first scan gives way to an APP1
// holding only its Orientation, when that's 2 to 8 (amendment 8.2), so a portrait photo doesn't show sideways.
// Refused: a restart marker or TEM outside a scan's data, the reserved F0 to FD, a second SOI, a marker that isn't
// one (FF 00), and a file without a frame and a scan before EOI.

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP1 = 0xe1;
const TEM = 0x01;
/** DHT, DAC, SOS, DQT, DNL, DRI and EXP. */
const JPEG_KEPT = new Set([0xc4, 0xcc, 0xda, 0xdb, 0xdc, 0xdd, 0xdf]);
/** APPn kept only when its data starts this way: JFIF, a colour profile, Adobe's colour transform. */
const APP_KEPT: ReadonlyMap<number, readonly number[]> = new Map([
  [0xe0, codes("JFIF\0")],
  [0xe2, codes("ICC_PROFILE\0")],
  [0xee, codes("Adobe")],
]);
const EXIF = codes("Exif\0\0");

const isRestart = (marker: number) => marker >= 0xd0 && marker <= 0xd7;
/** SOF0 to SOF15, which share C0 to CF with DHT (C4), a reserved marker (C8) and DAC (CC). */
const isFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
const isRefused = (marker: number) =>
  marker === 0x00 || marker === TEM || marker === SOI || isRestart(marker) || (marker >= 0xf0 && marker <= 0xfd);

function stripJpeg(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const length = bytes.length;
  if (!holds(bytes, 0, length, [0xff, SOI])) return null;
  const kept = new Kept(length);
  kept.copy(bytes, 0, 2);
  let at = 2;
  let frame = false;
  let scan = false;
  let exifRead = false;
  for (;;) {
    // The last FF before the marker starts the segment; fill bytes before it are dropped.
    if (at >= length || bytes[at] !== 0xff) return null;
    while (at + 1 < length && bytes[at + 1] === 0xff) at++;
    if (at + 1 >= length) return null;
    const marker = bytes[at + 1];
    if (marker === EOI) {
      if (!frame || !scan) return null;
      kept.copy(bytes, at, at + 2);
      return kept.result();
    }
    if (isRefused(marker) || at + 4 > length) return null;
    const data = at + 4;
    const end = at + 2 + uint16be(bytes, at + 2);
    if (end < data || end > length) return null;

    const prefix = APP_KEPT.get(marker);
    if (isFrame(marker) || JPEG_KEPT.has(marker) || (prefix !== undefined && holds(bytes, data, end, prefix))) {
      kept.copy(bytes, at, end);
    } else if (marker === APP1 && !scan && !exifRead && holds(bytes, data, end, EXIF)) {
      exifRead = true;
      const orientation = exifOrientation(bytes, data + EXIF.length, end);
      // Never longer than the segment it replaces: exifOrientation needs a whole IFD0, so that's 36 bytes or more.
      if (orientation !== null) kept.copy(orientationApp1(orientation));
    }
    if (isFrame(marker)) frame = true;
    at = end;
    if (marker !== SOS) continue;

    scan = true;
    const start = at;
    at = scanEnd(bytes, start);
    if (at < 0) return null;
    kept.copy(bytes, start, at);
  }
}

/**
 * Where a scan's data ends: at the FF (the first of any fill bytes) of the next marker that isn't FF 00, a restart
 * marker or TEM. -1 when the file ends first.
 */
function scanEnd(bytes: Uint8Array, start: number): number {
  let at = start;
  for (;;) {
    at = bytes.indexOf(0xff, at);
    if (at < 0) return -1;
    let next = at + 1;
    while (next < bytes.length && bytes[next] === 0xff) next++;
    if (next >= bytes.length) return -1;
    const marker = bytes[next];
    if (marker !== 0x00 && marker !== TEM && !isRestart(marker)) return at;
    at = next + 1;
  }
}

/**
 * The Orientation (2 to 8) in an Exif block's TIFF data, from `tiff` up to `end`, or null for 1, none or anything
 * malformed. The TIFF header: II (little-endian) or MM (big-endian), 42, and IFD0's offset from the header. IFD0: a
 * 2-byte count, 12-byte entries (tag, type, count, value) and the next IFD's 4-byte offset, all inside the block.
 * Orientation is tag 0x0112, one SHORT (type 3), kept in the first two bytes of the value.
 */
function exifOrientation(bytes: Uint8Array, tiff: number, end: number): number | null {
  if (tiff + 8 > end) return null;
  const order = uint16be(bytes, tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const little = order === 0x4949;
  const u16 = (at: number) => (little ? bytes[at] | (bytes[at + 1] << 8) : uint16be(bytes, at));
  const u32 = (at: number) => (little ? uint32le(bytes, at) : uint32be(bytes, at));
  if (u16(tiff + 2) !== 42) return null;
  const ifd = tiff + u32(tiff + 4);
  if (ifd < tiff + 8 || ifd + 2 > end) return null;
  const count = u16(ifd);
  if (ifd + 2 + count * 12 + 4 > end) return null;
  for (let entry = ifd + 2; entry < ifd + 2 + count * 12; entry += 12) {
    if (u16(entry) !== 0x0112) continue;
    if (u16(entry + 2) !== 3 || u32(entry + 4) !== 1) return null;
    const value = u16(entry + 8);
    return value >= 2 && value <= 8 ? value : null;
  }
  return null;
}

/** An APP1 holding only an Orientation: Exif, a big-endian TIFF header, then IFD0 with that one entry. 36 bytes. */
function orientationApp1(value: number): Uint8Array {
  return Uint8Array.of(
    ...[0xff, APP1, 0x00, 0x22],
    ...EXIF,
    ...[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08],
    ...[0x00, 0x01],
    ...[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, value, 0x00, 0x00],
    ...[0x00, 0x00, 0x00, 0x00],
  );
}

// --- PNG ----------------------------------------------------------------------------------------------------------
// The 8-byte signature, then chunks: a 4-byte big-endian length, a 4-letter type, the data and a CRC. IHDR comes
// first; IEND ends the image, and anything after it is dropped.
// Kept: the image (IHDR, IDAT, IEND), its palette and colours (PLTE, tRNS, gAMA, cHRM, sRGB, iCCP, sBIT, cICP, mDCV,
// cLLI), its density and background (pHYs, bKGD), and an animation's chunks (acTL, fcTL, fdAT).
// Dropped: every other chunk (eXIf, zxIf, C2PA's caBX, the text chunks tEXt, zTXt and iTXt, tIME, private chunks).
// Refused: a file whose first chunk isn't IHDR, or with no IDAT before IEND.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_KEPT = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "gAMA",
  "cHRM",
  "sRGB",
  "iCCP",
  "sBIT",
  "cICP",
  "mDCV",
  "cLLI",
  "pHYs",
  "bKGD",
  "acTL",
  "fcTL",
  "fdAT",
]);

function stripPng(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const length = bytes.length;
  if (!holds(bytes, 0, length, PNG_SIGNATURE)) return null;
  const kept = new Kept(length);
  kept.copy(bytes, 0, PNG_SIGNATURE.length);
  let image = false;
  let at = PNG_SIGNATURE.length;
  while (at + 12 <= length) {
    const end = at + 12 + uint32be(bytes, at);
    if (end > length) return null;
    const type = fourCC(bytes, at + 4);
    if (at === PNG_SIGNATURE.length && type !== "IHDR") return null;
    if (PNG_KEPT.has(type)) kept.copy(bytes, at, end);
    if (type === "IDAT") image = true;
    if (type === "IEND") return image ? kept.result() : null;
    at = end;
  }
  return null;
}

// --- WebP ---------------------------------------------------------------------------------------------------------
// "RIFF", the size of what follows (4 bytes, little-endian), "WEBP", then chunks: a 4-letter code, a 4-byte
// little-endian size, the data, and a padding byte when the size is odd. Anything after the RIFF is dropped.
// Kept: VP8X, with its EXIF (0x08) and XMP (0x04) flags cleared; the image (VP8, VP8L, ALPH); its colour profile
// (ICCP); an animation (ANIM, and each ANMF frame with only its image chunks: VP8, VP8L, ALPH).
// Dropped: every other chunk (EXIF, "XMP ", C2PA, unknown ones), at the top or in a frame. The RIFF's size and each
// frame's are worked out again.
// Refused: a file with no VP8 or VP8L, at the top or in a frame.

const RIFF = codes("RIFF");
const WEBP = codes("WEBP");
const WEBP_KEPT = new Set(["VP8X", "VP8 ", "VP8L", "ALPH", "ICCP", "ANIM"]);
const FRAME_KEPT = new Set(["VP8 ", "VP8L", "ALPH"]);
const EXIF_FLAG = 0x08;
const XMP_FLAG = 0x04;
const isImage = (code: string) => code === "VP8 " || code === "VP8L";

function stripWebp(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const length = bytes.length;
  if (!holds(bytes, 0, length, RIFF) || !holds(bytes, 8, length, WEBP)) return null;
  const end = 8 + uint32le(bytes, 4);
  if (end < 12 || end > length) return null;
  const kept = new Kept(length);
  // RIFF, its size (written again at the end) and WEBP.
  kept.copy(bytes, 0, 12);
  let image = false;
  let at = 12;
  while (at + 8 <= end) {
    const size = uint32le(bytes, at + 4);
    const dataEnd = at + 8 + size;
    const chunkEnd = dataEnd + (size % 2);
    if (chunkEnd > end) return null;
    const code = fourCC(bytes, at);
    if (code === "ANMF") {
      const frame = keepFrame(bytes, at, dataEnd, kept);
      if (frame === null) return null;
      if (frame) image = true;
    } else if (WEBP_KEPT.has(code)) {
      const start = kept.length;
      kept.copy(bytes, at, chunkEnd);
      // VP8X's first byte holds its flags. The EXIF and XMP chunks are gone, so their flags go too.
      if (code === "VP8X" && size >= 1) kept.out[start + 8] &= ~(EXIF_FLAG | XMP_FLAG);
      if (isImage(code)) image = true;
    }
    at = chunkEnd;
  }
  if (at !== end || !image) return null;
  setUint32le(kept.out, 4, kept.length - 8);
  return kept.result();
}

/**
 * An animation frame, the ANMF chunk from `at` with its data up to `end`: a 16-byte header (position, size, duration
 * and flags), then chunks of its own, of which only the image is kept. Writes the frame with its size worked out
 * again, and says whether it holds an image; null when its chunks don't fill it exactly.
 */
function keepFrame(bytes: Uint8Array, at: number, end: number, kept: Kept): boolean | null {
  if (at + 8 + 16 > end) return null;
  const start = kept.length;
  kept.copy(bytes, at, at + 8 + 16);
  let image = false;
  let inner = at + 8 + 16;
  while (inner + 8 <= end) {
    const size = uint32le(bytes, inner + 4);
    const innerEnd = inner + 8 + size + (size % 2);
    if (innerEnd > end) return null;
    const code = fourCC(bytes, inner);
    if (FRAME_KEPT.has(code)) {
      kept.copy(bytes, inner, innerEnd);
      if (isImage(code)) image = true;
    }
    inner = innerEnd;
  }
  if (inner !== end) return null;
  // Every kept chunk is padded to an even size, so the frame needs no padding byte.
  setUint32le(kept.out, start + 4, kept.length - start - 8);
  return image;
}
