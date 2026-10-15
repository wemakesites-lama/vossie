import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachPhotos, photoIdOf, storePhotos } from "@/lib/data/photos";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { pngBytes } from "@/tests/helpers/image-bytes";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs } from "@/tests/helpers/staff";
import { GET } from "./route";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

const NOW = new Date("2026-10-14T08:00:00.000Z");
const get = (id: string) => GET(new Request(`http://localhost/photos/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

const photo = { type: "image/png" as const, bytes: pngBytes() };

describe("a stored photo (selling spec 2.4)", () => {
  it("serves the stripped bytes with their real type, for the device that asked to keep a year", async () => {
    const [src] = await storePhotos("acc-seller", [photo], NOW);
    const response = await get(src.split("/").at(-1)!);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    // "private": a phone keeps the bytes, but no shared cache or CDN keeps a photo after its listing is deleted
    // (amendment 9.4).
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes());
  });

  it("is a 404 for a waiting photo more than a day old, though nobody has uploaded since to tidy it away (amendment 9.5)", async () => {
    const [waiting, used] = await storePhotos("acc-seller", [photo, photo], NOW);
    for (const src of [waiting, used]) sampleStore().photos.get(photoIdOf(src)!)!.createdAt = "2026-10-13T07:59:00.000Z";
    await attachPhotos("acc-seller", [used], "shop");
    const gone = await get(photoIdOf(waiting)!);
    expect(gone.status).toBe(404);
    expect(gone.headers.get("Cache-Control")).toBe("no-store");
    expect((await get(photoIdOf(used)!)).status).toBe(200);
  });

  it("serves a hidden listing's photos to its owner only, still private (amendment 13.5)", async () => {
    const [src] = await storePhotos("acc-seller", [photo], NOW);
    await attachPhotos("acc-seller", [src], "listing:l-001");
    const id = photoIdOf(src)!;
    sampleStore().listings.get("l-001")!.photos = [{ src, alt: "" }];
    expect((await get(id)).status).toBe(200);
    Object.assign(sampleStore().listings.get("l-001")!, { hiddenAt: NOW.toISOString(), hiddenReason: "Not allowed." });
    const stranger = await get(id);
    expect(stranger.status).toBe(404);
    expect(stranger.headers.get("Cache-Control")).toBe("no-store");
    await signedInAs(request, "acc-student");
    expect((await get(id)).status).toBe(404);
    resetRequest(request);
    await signedInAs(request, "acc-seller");
    const owner = await get(id);
    expect(owner.status).toBe(200);
    expect(owner.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
  });

  it("is a 404 that nothing keeps for an unknown or made-up id", async () => {
    for (const id of ["ph-00000000-0000-4000-8000-000000000000", "nope", "..%2Fetc"]) {
      const response = await get(id);
      expect(response.status, id).toBe(404);
      expect(response.headers.get("Cache-Control"), id).toBe("no-store");
    }
  });
});
