import type { PhotoType } from "@/lib/types";

const startsWith = (bytes: Uint8Array, at: number, expected: readonly number[]) =>
  bytes.length >= at + expected.length && expected.every((byte, index) => bytes[at + index] === byte);

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

/**
 * A photo's real type from its first bytes (selling spec 2.3), whatever its name or the browser says it is. Null for
 * anything else: GIF, SVG, HEIC, or a file pretending.
 */
export function photoTypeOf(bytes: Uint8Array): PhotoType | null {
  if (startsWith(bytes, 0, JPEG)) return "image/jpeg";
  if (startsWith(bytes, 0, PNG)) return "image/png";
  if (startsWith(bytes, 0, RIFF) && startsWith(bytes, 8, WEBP)) return "image/webp";
  return null;
}
