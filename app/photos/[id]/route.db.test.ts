import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getViewer } from "@/lib/auth/session";
import { saveOwnListing } from "@/lib/data/own-listings";
import { photoIdOf, storePhotos, type Upload } from "@/lib/data/photos";
import type { Account } from "@/lib/types";
import { jpegBytes, pngBytes } from "@/tests/helpers/image-bytes";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { GET } from "./route";

// /photos/[id] on the local stack (C2/C3 plan Task 6, decision 11): the file from Storage with its real type, length
// and an hour in any cache for a photo that's everyone's, or none in a shared cache for one that isn't (fix 2 of the
// review after C2 and C3), or a 404 nothing keeps for a photo that isn't there, has run out, or isn't the viewer's.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("@/lib/auth/session", () => ({ getViewer: vi.fn(async () => null) }));

const get = (id: string) => GET(new Request(`http://localhost/photos/${id}`), { params: Promise.resolve({ id }) });
const jpeg = (): Upload => ({ type: "image/jpeg", bytes: jpegBytes() });
const png = (): Upload => ({ type: "image/png", bytes: pngBytes() });

/** The account getViewer() answers, as far as the route reads it. */
const account = (id: string, roles: Account["roles"] = []) => ({ id, roles }) as unknown as Account;

async function expectGone(id: string): Promise<void> {
  const response = await get(id);
  expect(response.status, id).toBe(404);
  expect(response.headers.get("Cache-Control"), id).toBe("no-store");
}

describe("/photos/[id] on the local stack (C2/C3 plan Task 6)", () => {
  let world: SupabaseWorld;
  let seller: string;
  beforeEach(async () => {
    vi.mocked(getViewer).mockReset().mockResolvedValue(null);
    world = supabaseWorld();
    seller = await world.signedIn("seller");
    await world.tidySelling("seller");
    await world.tidySelling("hub");
  });
  afterEach(async () => {
    await world.cleanup();
  });

  /** A published listing of the seller's with this photo; its id. */
  async function listingWith(src: string): Promise<string> {
    const slug = await world.openShop("seller");
    const saved = await world.asViewer("seller", () =>
      saveOwnListing({
        sellerSlug: slug,
        ownerId: seller,
        id: null,
        fields: {
          kind: "service",
          title: "Contract tutoring",
          categorySlug: "tutoring",
          condition: null,
          priceZar: 100,
          priceIsFrom: true,
          payMode: "cash",
          swapFor: null,
          description: "Tutoring the contract tests list.",
          handover: "online",
          pickupPointId: null,
        },
        photos: [{ src, alt: "" }],
        intent: "publish",
        now: new Date(),
      }),
    );
    return saved!.id;
  }

  it("serves a stored listing photo's bytes with their type and length, for any cache to keep an hour (fix 2)", async () => {
    const [src] = await world.asViewer("seller", () => storePhotos(seller, [jpeg()], new Date()));
    await listingWith(src);
    const response = await get(photoIdOf(src)!);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Content-Length")).toBe(String(jpegBytes().byteLength));
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(jpegBytes());
    expect(getViewer).not.toHaveBeenCalled();
  });

  it("is a 404 nothing keeps for an unknown uuid, a sample id and a waiting photo a day old", async () => {
    await expectGone("00000000-0000-4000-8000-000000000000");
    await expectGone("ph-00000000-0000-4000-8000-000000000000");
    const [src] = await world.asViewer("seller", () => storePhotos(seller, [jpeg()], new Date()));
    await world.ageWaitingPhoto(src, 25);
    await expectGone(photoIdOf(src)!);
  });

  it("serves a hidden listing's photo to its owner only, for no shared cache to keep (fix 2)", async () => {
    const [src] = await world.asViewer("seller", () => storePhotos(seller, [jpeg()], new Date()));
    await world.hideListing(await listingWith(src), "Not allowed.");
    await expectGone(photoIdOf(src)!);
    vi.mocked(getViewer).mockResolvedValue(account(await world.signedIn("shopper")));
    await expectGone(photoIdOf(src)!);
    vi.mocked(getViewer).mockResolvedValue(account(seller));
    const owner = await get(photoIdOf(src)!);
    expect(owner.status).toBe(200);
    expect(owner.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("keeps the Hub's waiting cover for Hub staff, for no shared cache to keep (fix 2)", async () => {
    const [cover] = await world.asViewer("staff", () => storePhotos("hub", [png()], new Date()));
    await expectGone(photoIdOf(cover)!);
    vi.mocked(getViewer).mockResolvedValue(account(seller));
    await expectGone(photoIdOf(cover)!);
    vi.mocked(getViewer).mockResolvedValue(account(await world.signedIn("staff"), ["mentor"]));
    const staff = await get(photoIdOf(cover)!);
    expect(staff.status).toBe(200);
    expect(staff.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
