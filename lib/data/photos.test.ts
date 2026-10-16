import { beforeEach, describe, expect, it } from "vitest";
import { pngBytes } from "@/tests/helpers/image-bytes";
import {
  deletePhotosOf,
  deletePhotosUsedBy,
  getPhoto,
  handOverPhotoNow,
  photoIdOf,
  photoSrc,
  photoSrcsOf,
  storePhotos,
  claimPhotos,
  type Upload,
} from "./photos";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:00:00.000Z");
const upload = (): Upload => ({ type: "image/png", bytes: pngBytes() });

beforeEach(() => {
  resetSampleStore();
});

describe("stored photos (selling spec 2.4, plan decision 11)", () => {
  it("stores photos waiting on a form, gives back their addresses, and hands out their bytes", async () => {
    const [src] = await storePhotos("acc-seller", [upload()], NOW);
    expect(src).toMatch(/^\/photos\/ph-[0-9a-f-]{36}$/);
    expect(await getPhoto(photoIdOf(src)!)).toEqual({ type: "image/png", bytes: pngBytes() });
    expect(await photoSrcsOf("acc-seller", null)).toEqual(new Set([src]));
    expect(await getPhoto("ph-nope")).toBeNull();
  });

  it("reads a photo's id from its address, and none from a placeholder's or a made-up one", () => {
    expect(photoSrc("ph-1")).toBe("/photos/ph-1");
    expect(photoIdOf("/placeholders/listing/tech.svg")).toBeNull();
    expect(photoIdOf("/photos/../secrets")).toBeNull();
  });

  it("gives the owner's photos a use, and never anyone else's", async () => {
    const [mine] = await storePhotos("acc-seller", [upload()], NOW);
    const [theirs] = await storePhotos("acc-student", [upload()], NOW);
    await claimPhotos("acc-seller", [mine, theirs, "/placeholders/listing/tech.svg"], "listing:l-001");
    expect(await photoSrcsOf("acc-seller", "listing:l-001")).toEqual(new Set([mine]));
    expect(await photoSrcsOf("acc-student", null)).toEqual(new Set([theirs]));
  });

  it("takes only a waiting photo, one it has already, or the wizard's photo for the shop, and says which it took", async () => {
    const [waiting, listed, shop, draft] = await storePhotos("acc-seller", [upload(), upload(), upload(), upload()], NOW);
    await claimPhotos("acc-seller", [listed], "listing:l-001");
    await claimPhotos("acc-seller", [shop], "shop");
    await claimPhotos("acc-seller", [draft], "draft");
    expect(await claimPhotos("acc-seller", [waiting, listed, shop], "listing:l-007")).toEqual(new Set([waiting]));
    expect(await claimPhotos("acc-seller", [waiting], "listing:l-007")).toEqual(new Set([waiting]));
    expect(await claimPhotos("acc-seller", [listed], "shop")).toEqual(new Set());
    expect(await claimPhotos("acc-seller", [shop], "draft")).toEqual(new Set());
    expect(await claimPhotos("acc-seller", [draft], "listing:l-001")).toEqual(new Set());
    expect(await claimPhotos("acc-seller", [draft], "shop")).toEqual(new Set([draft]));
    expect(await photoSrcsOf("acc-seller", "listing:l-001")).toEqual(new Set([listed]));
    expect(await photoSrcsOf("acc-seller", "listing:l-007")).toEqual(new Set([waiting]));
    expect(await photoSrcsOf("acc-seller", "shop")).toEqual(new Set([shop, draft]));
  });

  it("hands a waiting photo to a new owner with a use, and never anyone else's, a used one or a placeholder", async () => {
    const [mine, used] = await storePhotos("acc-mentor", [upload(), upload()], NOW);
    const [theirs] = await storePhotos("acc-admin", [upload()], NOW);
    await claimPhotos("acc-mentor", [used], "post:h-001");
    expect(handOverPhotoNow("acc-mentor", theirs, "hub", "post:h-002")).toBe(false);
    expect(handOverPhotoNow("acc-mentor", used, "hub", "post:h-002")).toBe(false);
    expect(handOverPhotoNow("acc-mentor", "/placeholders/hub/h-002.svg", "hub", "post:h-002")).toBe(false);
    expect(handOverPhotoNow("acc-mentor", mine, "hub", "post:h-002")).toBe(true);
    expect(await photoSrcsOf("hub", "post:h-002")).toEqual(new Set([mine]));
    expect(await photoSrcsOf("acc-mentor", null)).toEqual(new Set());
    await deletePhotosOf("acc-mentor");
    expect(await photoSrcsOf("hub", "post:h-002")).toEqual(new Set([mine]));
  });

  it("deletes a use's photos except the ones it keeps, and every photo an account uploaded", async () => {
    const [a, b] = await storePhotos("acc-seller", [upload(), upload()], NOW);
    await claimPhotos("acc-seller", [a, b], "shop");
    await deletePhotosUsedBy("acc-seller", "shop", new Set([b]));
    expect(await photoSrcsOf("acc-seller", "shop")).toEqual(new Set([b]));
    await deletePhotosOf("acc-seller");
    expect(sampleStore().photos.size).toBe(0);
  });

  it("tidies away waiting photos after a day, and keeps each account's newest 12", async () => {
    const [old] = await storePhotos("acc-seller", [upload()], new Date("2026-10-13T07:59:00.000Z"));
    await storePhotos("acc-seller", [upload()], NOW);
    expect(await getPhoto(photoIdOf(old)!)).toBeNull();
    const many = await storePhotos("acc-student", Array.from({ length: 14 }, upload), NOW);
    expect(await photoSrcsOf("acc-student", null)).toEqual(new Set(many.slice(2)));
  });

  it("never trims a waiting photo the posting form names, only the oldest of the rest", async () => {
    const [named, older, ...rest] = await storePhotos("acc-seller", Array.from({ length: 12 }, upload), NOW);
    const [added] = await storePhotos("acc-seller", [upload()], NOW, new Set([named]));
    expect(await photoSrcsOf("acc-seller", null)).toEqual(new Set([named, ...rest, added]));
    expect(await getPhoto(photoIdOf(older)!)).toBeNull();
  });
});
