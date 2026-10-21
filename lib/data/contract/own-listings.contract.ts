import { afterEach, beforeEach, expect, it } from "vitest";
import { getPickupPoints } from "@/lib/data";
import {
  deleteOwnListing,
  getOwnListing,
  listOwnListings,
  saveOwnListing,
  setOwnListingState,
  type ListingSave,
} from "@/lib/data/own-listings";
import { photoFor, photoIdOf, photoSrcsOf, storePhotos, type Upload } from "@/lib/data/photos";
import type { ListingFields } from "@/lib/selling/rules";
import { jpegBytes } from "@/tests/helpers/image-bytes";
import type { World, WorldAccountName } from "@/tests/contract/world";

// A shop's own listings in both backends (C2/C3 plan Task 9; selling spec 2.9 and 2.10, plan decision 3, amendments
// 9.2 and 10): saving new and changed listings, first publishes, a waiting shop's drafts, a hidden listing staying
// hidden, the photos becoming the listing's, the list, the row buttons and deleting. The seller is "seller", with a
// shop the world opens. own-listings.test.ts runs it on the sample store, own-listings.db.test.ts on the local stack.

const jpeg = (): Upload => ({ type: "image/jpeg", bytes: jpegBytes() });
const nobody = async () => null;

export function ownListingsContract(makeWorld: () => World): void {
  let world: World;
  let seller: string;
  let point: string;
  let ticks = 0;
  /** The sample's clock for each save, a second apart, so no two changes share a time (the plan's risk 5). */
  const tick = () => new Date(Date.now() + 1_000 * ++ticks);
  beforeEach(async () => {
    world = makeWorld();
    for (const name of ["seller", "shopper"] as const) await world.tidySelling(name);
    seller = await world.signedIn("seller");
    point = (await getPickupPoints()).find((p) => p.campusSlug === "pretoria")!.id;
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const as = <T>(name: WorldAccountName, read: (id: string) => Promise<T>) => world.asViewer(name, read);

  function fields(over: Partial<ListingFields> = {}): ListingFields {
    return {
      kind: "item",
      title: "Contract desk lamp",
      categorySlug: "res-living",
      condition: "good",
      priceZar: 150,
      priceIsFrom: false,
      payMode: "cash",
      swapFor: null,
      description: "A lamp the contract tests list.",
      handover: "pickup",
      pickupPointId: point,
      ...over,
    };
  }

  /** Saves as `seller` on `slug`: a new listing unless `id` is given. */
  function save(slug: string, over: Partial<Omit<ListingSave, "sellerSlug" | "ownerId">> = {}) {
    return as("seller", () =>
      saveOwnListing({
        sellerSlug: slug,
        ownerId: seller,
        id: null,
        fields: fields(),
        photos: [],
        intent: "publish",
        now: tick(),
        ...over,
      }),
    );
  }

  it("publishes a new listing, available at once, whose photos become its own", async () => {
    const slug = await world.openShop("seller");
    const [photo] = await as("seller", () => storePhotos(seller, [jpeg()], new Date()));
    const saved = (await save(slug, { photos: [{ src: photo, alt: "The lamp, lit" }] }))!;
    expect(saved).toMatchObject({
      sellerSlug: slug,
      state: "available",
      title: "Contract desk lamp",
      campusSlug: "pretoria",
      photos: [{ src: photo, alt: "The lamp, lit" }],
    });
    expect(saved.firstPublishedAt).not.toBeNull();
    expect(saved.createdAt).toBe(saved.firstPublishedAt);
    expect(saved).not.toHaveProperty("hiddenAt");
    expect(await as("seller", () => photoSrcsOf(seller, null, new Date()))).toEqual(new Set());
    expect(await photoFor(photoIdOf(photo)!, nobody, new Date())).toEqual({
      type: "image/jpeg",
      bytes: jpegBytes(),
      forEveryone: true,
    });
  });

  it("moves a draft's created time to its first publish, and keeps that time when it's published again", async () => {
    const slug = await world.openShop("seller");
    const draft = (await save(slug, { intent: "draft" }))!;
    expect(draft).toMatchObject({ state: "draft", firstPublishedAt: null });
    const published = (await save(slug, { id: draft.id }))!;
    expect(published.state).toBe("available");
    expect(published.firstPublishedAt).not.toBeNull();
    expect(published.createdAt).toBe(published.firstPublishedAt);
    expect(Date.parse(published.createdAt)).toBeGreaterThanOrEqual(Date.parse(draft.createdAt));

    const back = (await save(slug, { id: draft.id, intent: "draft" }))!;
    expect(back).toMatchObject({ state: "draft", firstPublishedAt: published.firstPublishedAt });
    const again = (await save(slug, { id: draft.id }))!;
    expect(again).toMatchObject({ state: "available", firstPublishedAt: published.firstPublishedAt, createdAt: published.createdAt });
  });

  it("saves only drafts for a shop waiting for approval", async () => {
    const slug = await world.openShop("seller", { status: "pending" });
    const saved = (await save(slug, { fields: fields({ handover: "online", pickupPointId: null }) }))!;
    expect(saved).toMatchObject({ state: "draft", firstPublishedAt: null });
  });

  it("keeps a listing the Hub hid hidden when its seller saves it", async () => {
    const slug = await world.openShop("seller");
    const saved = (await save(slug))!;
    await world.hideListing(saved.id, "Not allowed.");
    const again = (await save(slug, { id: saved.id, fields: fields({ title: "Contract desk lamp, again" }) }))!;
    expect(again).toMatchObject({ title: "Contract desk lamp, again", hiddenReason: "Not allowed." });
    expect(again.hiddenAt).not.toBeNull();
  });

  it("forgets a photo the listing no longer uses", async () => {
    const slug = await world.openShop("seller");
    const [first, second] = await as("seller", () => storePhotos(seller, [jpeg(), jpeg()], new Date()));
    const saved = (await save(slug, { photos: [{ src: first, alt: "" }] }))!;
    const swapped = (await save(slug, { id: saved.id, photos: [{ src: second, alt: "" }] }))!;
    expect(swapped.photos).toEqual([{ src: second, alt: "" }]);
    expect(await photoFor(photoIdOf(first)!, nobody, new Date())).toBeNull();
    expect(await photoFor(photoIdOf(second)!, nobody, new Date())).not.toBeNull();
  });

  it("lists the shop's listings, most recently changed first, drafts and hidden ones included, and no one else's", async () => {
    const slug = await world.openShop("seller");
    const theirSlug = await world.openShop("shopper");
    const shopper = await world.signedIn("shopper");
    const theirs = (await as("shopper", () =>
      saveOwnListing({ sellerSlug: theirSlug, ownerId: shopper, id: null, fields: fields(), photos: [], intent: "publish", now: new Date() }),
    ))!;
    const hidden = (await save(slug, { fields: fields({ title: "Contract hidden" }) }))!;
    await world.hideListing(hidden.id, "Not allowed.");
    const draft = (await save(slug, { intent: "draft", fields: fields({ title: "Contract draft" }) }))!;
    const latest = (await save(slug, { fields: fields({ title: "Contract latest" }) }))!;
    const ids = (await as("seller", () => listOwnListings(slug))).map((row) => row.id);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(latest.id);
    expect(new Set(ids)).toEqual(new Set([hidden.id, draft.id, latest.id]));
    expect(await as("seller", () => getOwnListing(slug, theirs.id))).toBeNull();
    expect(await as("seller", () => getOwnListing(slug, draft.id))).toMatchObject({ id: draft.id, state: "draft" });
  });

  it("moves a listing only as the row buttons may", async () => {
    const slug = await world.openShop("seller");
    const saved = (await save(slug))!;
    const move = (to: "available" | "paused" | "sold") => as("seller", () => setOwnListingState(slug, saved.id, to, new Date()));
    expect(await move("available")).toBeNull();
    expect((await move("paused"))?.state).toBe("paused");
    expect(await move("paused")).toBeNull();
    expect((await move("sold"))?.state).toBe("sold");
    expect(await move("sold")).toBeNull();
    expect((await move("available"))?.state).toBe("available");
    const draft = (await save(slug, { intent: "draft" }))!;
    expect(await as("seller", () => setOwnListingState(slug, draft.id, "available", new Date()))).toBeNull();
  });

  it("deletes a listing with its photos and the alerts that lead to it, and nothing else", async () => {
    const slug = await world.openShop("seller");
    const [photo] = await as("seller", () => storePhotos(seller, [jpeg()], new Date()));
    const saved = (await save(slug, { photos: [{ src: photo, alt: "" }] }))!;
    const href = `/listings/${saved.id}`;
    await world.addNotification("shopper", { kind: "new-listing", subjectId: slug, text: "Contract: new listing.", href });
    await world.addNotification("shopper", { kind: "search-match", subjectId: "contract-search", text: "Contract: a match.", href });
    const stays = { kind: "search-match", subjectId: "contract-search-2", text: "Contract: matches.", href: "/browse?q=lamp" };
    await world.addNotification("shopper", stays);

    expect(await as("seller", () => deleteOwnListing(slug, seller, saved.id))).toBe(true);
    expect(await as("seller", () => getOwnListing(slug, saved.id))).toBeNull();
    expect(await photoFor(photoIdOf(photo)!, nobody, new Date())).toBeNull();
    expect((await world.notificationsOf("shopper")).filter((note) => note.subjectId.startsWith("contract-") || note.subjectId === slug)).toEqual([
      stays,
    ]);
    expect(await as("seller", () => deleteOwnListing(slug, seller, saved.id))).toBe(false);
  });
}
