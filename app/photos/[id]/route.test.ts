import { beforeEach, describe, expect, it, vi } from "vitest";
import { storePhotos } from "@/lib/data/photos";
import { resetSampleStore } from "@/lib/data/store";
import { pngBytes } from "@/tests/helpers/image-bytes";
import { GET } from "./route";

vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

const NOW = new Date("2026-10-14T08:00:00.000Z");
const get = (id: string) => GET(new Request(`http://localhost/photos/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  resetSampleStore();
});

describe("a stored photo (selling spec 2.4)", () => {
  it("serves the stripped bytes with their real type, for browsers to keep a year", async () => {
    const [src] = await storePhotos("acc-seller", [{ type: "image/png", bytes: pngBytes() }], NOW);
    const response = await get(src.split("/").at(-1)!);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes());
  });

  it("is a 404 that nothing keeps for an unknown or made-up id", async () => {
    for (const id of ["ph-00000000-0000-4000-8000-000000000000", "nope", "..%2Fetc"]) {
      const response = await get(id);
      expect(response.status, id).toBe(404);
      expect(response.headers.get("Cache-Control"), id).toBe("no-store");
    }
  });
});
