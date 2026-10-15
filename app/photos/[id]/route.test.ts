import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimPhotos, deletePhotosOf, photoIdOf, storePhotos } from "@/lib/data/photos";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { jpegBytes, pngBytes, webpBytes } from "@/tests/helpers/image-bytes";
import { GET } from "./route";

vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

const NOW = new Date("2026-10-14T08:00:00.000Z");
const get = (id: string) => GET(new Request(`http://localhost/photos/${id}`), { params: Promise.resolve({ id }) });
const idOf = (src: string) => photoIdOf(src)!;

beforeEach(() => {
  resetSampleStore();
});

describe("a stored photo (selling spec 2.4)", () => {
  it("serves the stripped bytes with their real type, for browsers to keep a year", async () => {
    const [src] = await storePhotos("acc-seller", [{ type: "image/png", bytes: pngBytes() }], NOW);
    const response = await get(src.split("/").at(-1)!);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes());
  });

  it("is a 404 that nothing keeps for an unknown or made-up id", async () => {
    for (const id of ["ph-00000000-0000-4000-8000-000000000000", "nope", "..%2Fetc"]) {
      const response = await get(id);
      expect(response.status, id).toBe(404);
      expect(response.headers.get("Cache-Control"), id).toBe("no-store");
    }
  });

  it("says each type as stored, with the length, and a file name made from the id", async () => {
    const uploads = [
      { type: "image/jpeg", bytes: jpegBytes() },
      { type: "image/png", bytes: pngBytes() },
      { type: "image/webp", bytes: webpBytes() },
    ] as const;
    const srcs = await storePhotos("acc-seller", uploads, NOW);
    for (const [index, extension] of ["jpg", "png", "webp"].entries()) {
      const id = idOf(srcs[index]);
      const response = await get(id);
      expect(response.headers.get("Content-Type"), extension).toBe(uploads[index].type);
      expect(response.headers.get("Content-Length"), extension).toBe(String(uploads[index].bytes.byteLength));
      expect(response.headers.get("Content-Disposition"), extension).toBe(`inline; filename="${id}.${extension}"`);
    }
  });

  it("tells browsers never to guess the type, and never to run anything in it", async () => {
    const [src] = await storePhotos("acc-seller", [{ type: "image/png", bytes: pngBytes() }], NOW);
    const response = await get(idOf(src));
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toBe("script-src 'none'; frame-src 'none'; sandbox;");
  });

  it("serves a photo waiting on a form (its thumbnail) and a used one, and a 404 once it's deleted", async () => {
    const [waiting, used] = await storePhotos(
      "acc-seller",
      [
        { type: "image/png", bytes: pngBytes() },
        { type: "image/png", bytes: pngBytes() },
      ],
      NOW,
    );
    await claimPhotos("acc-seller", [used], "listing:l-001");
    expect((await get(idOf(waiting))).status).toBe(200);
    expect((await get(idOf(used))).status).toBe(200);
    await deletePhotosOf("acc-seller");
    for (const src of [waiting, used]) {
      const response = await get(idOf(src));
      expect(response.status, src).toBe(404);
      expect(response.headers.get("Cache-Control"), src).toBe("no-store");
    }
  });

  it("is a 404 for a stored row whose type isn't JPEG, PNG or WebP, rather than serving it as that type", async () => {
    const [src] = await storePhotos("acc-seller", [{ type: "image/png", bytes: pngBytes() }], NOW);
    const row = sampleStore().photos.get(idOf(src))!;
    (row as { type: string }).type = "text/html";
    const response = await get(idOf(src));
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).not.toContain("html");
  });
});
