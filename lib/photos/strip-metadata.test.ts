import { describe, expect, it } from "vitest";
import { ascii, containsText, GPS, jpegBytes, pngBytes, webpBytes } from "@/tests/helpers/image-bytes";
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
});

describe("stripping a PNG (selling spec 2.3, plan decision 11)", () => {
  it("drops eXIf and the text chunks, and keeps the image and its other chunks", () => {
    const original = pngBytes({ exif: true, text: true, ztxt: true, xmp: true });
    expect(containsText(original, GPS)).toBe(true);
    const stripped = stripMetadata(original, "image/png")!;
    expect(stripped).toEqual(pngBytes());
    for (const type of ["eXIf", "tEXt", "zTXt", "iTXt"]) expect(containsText(stripped, type), type).toBe(false);
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
});

describe("stripping a WebP (selling spec 2.3, plan decision 11)", () => {
  it("drops the EXIF and XMP chunks, clears their flags and works the RIFF size out again", () => {
    const original = webpBytes({ exif: true, xmp: true });
    expect(containsText(original, GPS)).toBe(true);
    const stripped = stripMetadata(original, "image/webp")!;
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
});
