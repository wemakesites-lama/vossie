import { describe, expect, it } from "vitest";
import { ascii, concatBytes, jpegBytes, pngBytes, webpBytes } from "@/tests/helpers/image-bytes";
import { photoTypeOf } from "./signature";

describe("photo signatures (selling spec 2.3)", () => {
  it("knows a JPEG, a PNG and a WebP by their first bytes", () => {
    expect(photoTypeOf(jpegBytes())).toBe("image/jpeg");
    expect(photoTypeOf(pngBytes())).toBe("image/png");
    expect(photoTypeOf(webpBytes())).toBe("image/webp");
  });

  it("refuses everything else, whatever the file was called", () => {
    expect(photoTypeOf(ascii("GIF89a"))).toBeNull();
    expect(photoTypeOf(ascii('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(photoTypeOf(concatBytes(Uint8Array.of(0, 0, 0, 0x18), ascii("ftypheic")))).toBeNull();
    expect(photoTypeOf(concatBytes(ascii("RIFF"), Uint8Array.of(4, 0, 0, 0), ascii("WAVE")))).toBeNull();
    expect(photoTypeOf(Uint8Array.of(0xff, 0xd8))).toBeNull();
    expect(photoTypeOf(new Uint8Array(0))).toBeNull();
  });
});
