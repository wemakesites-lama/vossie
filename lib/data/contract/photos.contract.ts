import { afterEach, beforeEach, expect, it } from "vitest";
import { saveOwnListing } from "@/lib/data/own-listings";
import { photoFor, photoIdOf, photoSrcsOf, storePhotos, type PhotoViewer, type Upload } from "@/lib/data/photos";
import { jpegBytes, pngBytes } from "@/tests/helpers/image-bytes";
import type { World } from "@/tests/contract/world";

// Stored photos in both backends (C2/C3 plan Task 5; selling spec 2.4, decisions 11 to 14): storing, the newest 12, a
// waiting photo's one day, the Hub's covers, and a hidden listing's photos for its owner only. photos.test.ts runs it
// on the sample store, photos.db.test.ts on the local stack, where the files are in Storage.

const jpeg = (): Upload => ({ type: "image/jpeg", bytes: jpegBytes() });
const png = (): Upload => ({ type: "image/png", bytes: pngBytes() });
const nobody = async (): Promise<PhotoViewer | null> => null;
const idOf = (src: string) => photoIdOf(src)!;

export function photosContract(makeWorld: () => World): void {
  let world: World;
  let now: Date;
  beforeEach(async () => {
    world = makeWorld();
    now = new Date();
    await world.tidySelling("seller");
    await world.tidySelling("hub");
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("stores a photo waiting on a form, lists it for its owner, and hands out its type and bytes", async () => {
    const srcs = await world.asViewer("seller", (seller) => storePhotos(seller, [jpeg()], now));
    expect(srcs).toHaveLength(1);
    expect(srcs[0]).toMatch(/^\/photos\//);
    expect(await world.asViewer("seller", (seller) => photoSrcsOf(seller, null, now))).toEqual(new Set(srcs));
    expect(await photoFor(idOf(srcs[0]), nobody, now)).toEqual({ type: "image/jpeg", bytes: jpegBytes() });
  });

  it("keeps an account's newest 12 waiting photos", async () => {
    const srcs: string[] = [];
    for (let i = 0; i < 13; i += 1) {
      srcs.push(...(await world.asViewer("seller", (seller) => storePhotos(seller, [png()], new Date()))));
    }
    expect(await world.asViewer("seller", (seller) => photoSrcsOf(seller, null, new Date()))).toEqual(new Set(srcs.slice(1)));
    expect(await photoFor(idOf(srcs[0]), nobody, new Date())).toBeNull();
    expect(await photoFor(idOf(srcs[12]), nobody, new Date())).not.toBeNull();
  });

  it("forgets a waiting photo a day old, before anything tidies it away (amendment 9.5)", async () => {
    const [src] = await world.asViewer("seller", (seller) => storePhotos(seller, [jpeg()], now));
    await world.ageWaitingPhoto(src, 25);
    expect(await world.asViewer("seller", (seller) => photoSrcsOf(seller, null, new Date()))).toEqual(new Set());
    expect(await photoFor(idOf(src), nobody, new Date())).toBeNull();
  });

  it("stores the Hub's covers for Hub staff, and hands one to them (decision 14)", async () => {
    const [src] = await world.asViewer("staff", () => storePhotos("hub", [png()], now));
    expect(await world.asViewer("staff", () => photoSrcsOf("hub", null, now))).toEqual(new Set([src]));
    const staff = await world.signedIn("staff");
    expect(await photoFor(idOf(src), async () => ({ id: staff, hubStaff: true }), now)).toEqual({
      type: "image/png",
      bytes: pngBytes(),
    });
  });

  it("hands a hidden listing's photo to its owner only (staff tools amendment 13.5)", async () => {
    const slug = await world.openShop("seller");
    const seller = await world.signedIn("seller");
    const [src] = await world.asViewer("seller", () => storePhotos(seller, [jpeg()], now));
    const listing = (await world.asViewer("seller", () =>
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
        now,
      }),
    ))!;
    const id = idOf(src);
    const asked = async () => ({ id: await world.signedIn("shopper"), hubStaff: false });
    expect(await photoFor(id, asked, now)).not.toBeNull();
    await world.hideListing(listing.id, "Not allowed.");
    expect(await photoFor(id, nobody, now)).toBeNull();
    expect(await photoFor(id, asked, now)).toBeNull();
    expect(await photoFor(id, async () => ({ id: seller, hubStaff: false }), now)).toEqual({
      type: "image/jpeg",
      bytes: jpegBytes(),
    });
  });
}
