import { describe, expect, it } from "vitest";
import { PHOTO_MAX_BYTES } from "@/lib/photos/rules";
import { ascii, containsText, GPS, jpegBytes, pngBytes } from "@/tests/helpers/image-bytes";
import { readUploads } from "./uploads";

describe("posted photos (selling spec 2.3, plan decision 11)", () => {
  it("checks each by its signature and size, strips it, and keeps a refused one's place", async () => {
    const files = [
      new File([pngBytes({ exif: true })], "a.png", { type: "image/png" }),
      new File([ascii("GIF89a")], "b.png", { type: "image/png" }),
      new File([jpegBytes({ exif: true }).subarray(0, 30)], "c.jpg", { type: "image/jpeg" }),
      new File([new Uint8Array(PHOTO_MAX_BYTES + 1)], "d.png", { type: "image/png" }),
    ];
    const { uploads, errors } = await readUploads(files, 6);
    expect(uploads.map((upload) => upload?.type ?? null)).toEqual(["image/png", null, null, null]);
    expect(containsText(uploads[0]!.bytes, GPS)).toBe(false);
    expect(errors).toEqual(["photo-type", "photo-unreadable", "photo-size"]);
  });

  it("takes only as many as there's room for", async () => {
    const files = [new File([pngBytes()], "a.png"), new File([pngBytes()], "b.png")];
    const { uploads, errors } = await readUploads(files, 1);
    expect(uploads.map(Boolean)).toEqual([true, false]);
    expect(errors).toEqual(["photo-count"]);
  });
});
