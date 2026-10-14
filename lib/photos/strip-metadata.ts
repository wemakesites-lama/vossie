import type { PhotoType } from "@/lib/types";

/**
 * A photo without its hidden data (selling spec 2.3, plan decision 11). Location, camera details, times, names and
 * comments sit in their own segments or chunks, which are dropped whole; the image data is copied as it is, so
 * nothing is decoded and no image library is needed (decision 59). The browser re-encodes photos when the app's
 * JavaScript runs, and this still runs on every upload. A file whose structure doesn't add up gives null, and the
 * caller refuses it.
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

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const code = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
const uint32be = (bytes: Uint8Array, at: number) =>
  ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
const uint32le = (bytes: Uint8Array, at: number) =>
  (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;

// --- JPEG ---------------------------------------------------------------------------------------------------------
// SOI (FF D8), then segments: FF (after any number of FF fill bytes), a marker, and for most markers a 2-byte
// big-endian length that counts itself, then the data. After each SOS segment comes the scan's compressed data, in
// which FF appears only as FF 00 or a restart marker (FF D0 to D7); the next other marker ends it. EOI (FF D9) ends
// the image, and anything after it (a phone's appended video, say) is dropped.
// Dropped: APP1 (Exif, XMP and extended XMP), APP13 (Photoshop's, where IPTC keeps a place) and COM (comments).
// Kept: everything else, such as APP0 (JFIF), APP2 (the colour profile), APP14 (Adobe's colour transform), the
// tables, the frame and the scans.

const JPEG_DROPPED = new Set([0xe1, 0xed, 0xfe]);
const isRestart = (marker: number) => marker >= 0xd0 && marker <= 0xd7;

function stripJpeg(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let at = 2;
  for (;;) {
    if (at >= bytes.length || bytes[at] !== 0xff) return null;
    while (at + 1 < bytes.length && bytes[at + 1] === 0xff) at++;
    if (at + 1 >= bytes.length) return null;
    const marker = bytes[at + 1];
    if (marker === 0xd9) {
      parts.push(bytes.subarray(at, at + 2));
      return concat(parts);
    }
    if (marker === 0x00 || marker === 0xd8) return null;
    if (marker === 0x01 || isRestart(marker)) {
      parts.push(bytes.subarray(at, at + 2));
      at += 2;
      continue;
    }
    if (at + 3 >= bytes.length) return null;
    const end = at + 2 + ((bytes[at + 2] << 8) | bytes[at + 3]);
    if (end < at + 4 || end > bytes.length) return null;
    if (!JPEG_DROPPED.has(marker)) parts.push(bytes.subarray(at, end));
    at = end;
    if (marker !== 0xda) continue;
    // The scan's compressed data, up to the next marker that isn't a stuffed FF 00 or a restart.
    const start = at;
    while (at + 1 < bytes.length && !(bytes[at] === 0xff && bytes[at + 1] !== 0x00 && !isRestart(bytes[at + 1]))) {
      at++;
    }
    if (at + 1 >= bytes.length) return null;
    parts.push(bytes.subarray(start, at));
  }
}

// --- PNG ----------------------------------------------------------------------------------------------------------
// The 8-byte signature, then chunks: a 4-byte big-endian length, a 4-letter type, the data and a CRC. IEND ends the
// image, and anything after it is dropped. Dropped: eXIf (Exif) and the text chunks tEXt, zTXt and iTXt (where XMP
// and comments live). Kept: every other chunk, the image data among them.

const PNG_DROPPED = new Set(["eXIf", "tEXt", "zTXt", "iTXt"]);

function stripPng(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let at = 8;
  while (at + 12 <= bytes.length) {
    const end = at + 12 + uint32be(bytes, at);
    if (end > bytes.length) return null;
    const type = code(bytes, at + 4);
    if (!PNG_DROPPED.has(type)) parts.push(bytes.subarray(at, end));
    if (type === "IEND") return concat(parts);
    at = end;
  }
  return null;
}

// --- WebP ---------------------------------------------------------------------------------------------------------
// "RIFF", the size of what follows (4 bytes, little-endian), "WEBP", then chunks: a 4-letter code, a 4-byte
// little-endian size, the data, and a padding byte when the size is odd. Dropped: EXIF and "XMP ", with their flags
// cleared in VP8X's first byte (EXIF 0x08, XMP 0x04), and anything after the RIFF. The RIFF size is worked out again.

const WEBP_DROPPED = new Set(["EXIF", "XMP "]);

function stripWebp(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (bytes.length < 12) return null;
  const end = 8 + uint32le(bytes, 4);
  if (end < 12 || end > bytes.length) return null;
  const chunks: Uint8Array[] = [];
  let at = 12;
  while (at + 8 <= end) {
    const size = uint32le(bytes, at + 4);
    const chunkEnd = at + 8 + size + (size % 2);
    if (chunkEnd > end) return null;
    const chunk = code(bytes, at);
    if (chunk === "VP8X" && size >= 1) {
      const header = bytes.slice(at, chunkEnd);
      header[8] &= ~(0x08 | 0x04);
      chunks.push(header);
    } else if (!WEBP_DROPPED.has(chunk)) {
      chunks.push(bytes.subarray(at, chunkEnd));
    }
    at = chunkEnd;
  }
  if (at !== end) return null;
  const body = concat(chunks);
  const size = body.length + 4;
  const sizeBytes = Uint8Array.of(size & 0xff, (size >>> 8) & 0xff, (size >>> 16) & 0xff, (size >>> 24) & 0xff);
  return concat([bytes.subarray(0, 4), sizeBytes, bytes.subarray(8, 12), body]);
}
