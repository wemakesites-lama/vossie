import { beforeEach, describe, expect, it } from "vitest";
import type { ListingFields } from "@/lib/selling/rules";
import { pngBytes } from "@/tests/helpers/image-bytes";
import {
  deleteOwnListing,
  getOwnListing,
  listOwnListings,
  saveOwnListing,
  setOwnListingState,
  type ListingSave,
} from "./own-listings";
import { getPhoto, photoIdOf, photoSrcsOf, storePhotos } from "./photos";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:00:00.000Z");
const LATER = new Date("2026-10-15T08:00:00.000Z");

const fields: ListingFields = {
  kind: "item",
  title: "Desk fan",
  categorySlug: "res-living",
  condition: "good",
  priceZar: 150,
  priceIsFrom: false,
  payMode: "cash",
  swapFor: null,
  description: "Quiet and strong.",
  handover: "pickup",
  pickupPointId: "pp-midrand-library",
};

const save = (overrides: Partial<ListingSave> = {}) =>
  saveOwnListing({
    sellerSlug: "tech-corner",
    ownerId: "acc-seller",
    id: null,
    fields,
    photos: [],
    intent: "publish",
    now: NOW,
    ...overrides,
  });

const upload = () => ({ type: "image/png" as const, bytes: pngBytes() });

beforeEach(() => {
  resetSampleStore();
});

describe("a shop's own listings (selling spec 2.9 and 2.10, plan decision 3)", () => {
  it("lists the shop's listings, drafts included, most recently changed first", async () => {
    await save({ intent: "draft" });
    expect((await listOwnListings("tech-corner")).map((row) => [row.title, row.state])).toEqual([
      ["Desk fan", "draft"],
      ["Casio fx-991ZA Plus calculator", "available"],
      ["Gaming headset, barely used", "available"],
    ]);
    expect(await listOwnListings("crochet-corner")).toEqual([]);
  });

  it("publishes a new listing on the shop's campus, with a new id and the time it was first published", async () => {
    const row = (await save())!;
    expect(row).toMatchObject({
      id: expect.stringMatching(/^l-[0-9a-f-]{36}$/),
      state: "available",
      campusSlug: "midrand",
      title: "Desk fan",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(await getOwnListing("tech-corner", row.id)).toEqual(row);
  });

  it("dates a draft from when it's first published, then keeps that date", async () => {
    const draft = (await save({ intent: "draft" }))!;
    expect((await save({ id: draft.id, now: LATER }))).toMatchObject({ state: "available", createdAt: LATER.toISOString() });
    const edited = await save({
      id: draft.id,
      now: new Date("2026-10-16T08:00:00.000Z"),
      fields: { ...fields, title: "Desk fan, white" },
    });
    expect(edited).toMatchObject({ title: "Desk fan, white", createdAt: LATER.toISOString() });
  });

  it("keeps a sold listing sold on Save changes", async () => {
    await setOwnListingState("tech-corner", "l-001", "sold", NOW);
    expect((await save({ id: "l-001" }))?.state).toBe("sold");
  });

  it("never finds or changes another shop's listing", async () => {
    expect(await getOwnListing("tech-corner", "l-004")).toBeNull();
    expect(await save({ id: "l-004" })).toBeNull();
    expect(await setOwnListingState("tech-corner", "l-004", "paused", NOW)).toBeNull();
    expect(await deleteOwnListing("tech-corner", "acc-seller", "l-004")).toBe(false);
    expect(sampleStore().listings.get("l-004")).toMatchObject({ title: "Box braids, shoulder length", state: "available" });
  });

  it("pauses, resumes, marks sold and relists, and makes no other move", async () => {
    expect((await setOwnListingState("tech-corner", "l-001", "paused", NOW))?.state).toBe("paused");
    expect(await setOwnListingState("tech-corner", "l-001", "paused", NOW)).toBeNull();
    expect((await setOwnListingState("tech-corner", "l-001", "available", NOW))?.state).toBe("available");
    expect((await setOwnListingState("tech-corner", "l-001", "sold", NOW))?.state).toBe("sold");
    expect((await setOwnListingState("tech-corner", "l-001", "available", LATER))?.updatedAt).toBe(LATER.toISOString());
    const draft = (await save({ intent: "draft" }))!;
    expect(await setOwnListingState("tech-corner", draft.id, "available", NOW)).toBeNull();
  });

  it("makes its photos its own, and deletes the ones it stops using, and the rest with it", async () => {
    const [a, b] = await storePhotos("acc-seller", [upload(), upload()], NOW);
    const row = (await save({ photos: [{ src: a, alt: "" }, { src: b, alt: "The plug" }] }))!;
    expect(await photoSrcsOf("acc-seller", `listing:${row.id}`)).toEqual(new Set([a, b]));
    await save({ id: row.id, photos: [{ src: b, alt: "" }] });
    expect(await getPhoto(photoIdOf(a)!)).toBeNull();
    expect(await deleteOwnListing("tech-corner", "acc-seller", row.id)).toBe(true);
    expect(await getPhoto(photoIdOf(b)!)).toBeNull();
    expect(await getOwnListing("tech-corner", row.id)).toBeNull();
  });

  it("keeps only photos it could take or already had, never another listing's, the shop's or a made-up one", async () => {
    const [waiting, other, shop] = await storePhotos("acc-seller", [upload(), upload(), upload()], NOW);
    const [theirs] = await storePhotos("acc-student", [upload()], NOW);
    const first = (await save({ photos: [{ src: other, alt: "" }] }))!;
    sampleStore().photos.get(photoIdOf(shop)!)!.use = "shop";
    const photos = [waiting, other, shop, theirs, "/placeholders/listing/tech.svg", "/photos/ph-made-up"];
    const row = (await save({ photos: photos.map((src) => ({ src, alt: "" })) }))!;
    expect(row.photos.map((photo) => photo.src)).toEqual([waiting]);
    expect(sampleStore().listings.get(row.id)?.photos).toEqual([{ src: waiting, alt: "" }]);
    expect(await photoSrcsOf("acc-seller", `listing:${first.id}`)).toEqual(new Set([other]));
    expect(await photoSrcsOf("acc-seller", "shop")).toEqual(new Set([shop]));
    const cover = { src: "/placeholders/photo/3.svg", alt: "The cover" };
    const sample = (await save({ id: "l-001", photos: [cover, { src: other, alt: "" }] }))!;
    expect(sample.photos).toEqual([cover]);
  });
});
