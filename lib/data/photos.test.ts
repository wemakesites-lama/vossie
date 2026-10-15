import { beforeEach, describe, expect, it } from "vitest";
import { pngBytes } from "@/tests/helpers/image-bytes";
import {
  attachPhotos,
  deletePhotosOf,
  deletePhotosUsedBy,
  getPhoto,
  photoIdOf,
  photoSrc,
  photoSrcsOf,
  storePhotos,
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
    expect(await getPhoto(photoIdOf(src)!, NOW)).toEqual({ type: "image/png", bytes: pngBytes() });
    expect(await photoSrcsOf("acc-seller", null, NOW)).toEqual(new Set([src]));
    expect(await getPhoto("ph-nope", NOW)).toBeNull();
  });

  it("won't hand out a waiting photo more than a day old, even before anything tidies it away (amendment 9.5)", async () => {
    const [waiting, fresh, used] = await storePhotos("acc-seller", [upload(), upload(), upload()], NOW);
    sampleStore().photos.get(photoIdOf(waiting)!)!.createdAt = "2026-10-13T07:59:00.000Z";
    sampleStore().photos.get(photoIdOf(used)!)!.createdAt = "2026-10-13T07:59:00.000Z";
    await attachPhotos("acc-seller", [used], "shop");
    expect(await getPhoto(photoIdOf(waiting)!, NOW)).toBeNull();
    expect(await getPhoto(photoIdOf(fresh)!, NOW)).not.toBeNull();
    // A photo with a use stays as long as its listing or shop does.
    expect(await getPhoto(photoIdOf(used)!, NOW)).not.toBeNull();
    // Looking doesn't tidy: the row is still there until the next upload does it.
    expect(sampleStore().photos.has(photoIdOf(waiting)!)).toBe(true);
  });

  it("leaves a waiting photo a day old out of what an account may use, but not one that has a use (amendment 10.1)", async () => {
    const [old, fresh, used] = await storePhotos("acc-seller", [upload(), upload(), upload()], NOW);
    sampleStore().photos.get(photoIdOf(old)!)!.createdAt = "2026-10-13T07:59:00.000Z";
    sampleStore().photos.get(photoIdOf(used)!)!.createdAt = "2026-10-13T07:59:00.000Z";
    await attachPhotos("acc-seller", [used], "shop");
    expect(await photoSrcsOf("acc-seller", null, NOW)).toEqual(new Set([fresh]));
    expect(await photoSrcsOf("acc-seller", "shop", NOW)).toEqual(new Set([used]));
    // Looking doesn't tidy: the old photo is still there until the next upload does it.
    expect(sampleStore().photos.has(photoIdOf(old)!)).toBe(true);
  });

  it("reads a photo's id from its address, and none from a placeholder's or a made-up one", () => {
    expect(photoSrc("ph-1")).toBe("/photos/ph-1");
    expect(photoIdOf("/placeholders/listing/tech.svg")).toBeNull();
    expect(photoIdOf("/photos/../secrets")).toBeNull();
  });

  it("gives the owner's photos a use, and never anyone else's", async () => {
    const [mine] = await storePhotos("acc-seller", [upload()], NOW);
    const [theirs] = await storePhotos("acc-student", [upload()], NOW);
    await attachPhotos("acc-seller", [mine, theirs, "/placeholders/listing/tech.svg"], "listing:l-001");
    expect(await photoSrcsOf("acc-seller", "listing:l-001", NOW)).toEqual(new Set([mine]));
    expect(await photoSrcsOf("acc-student", null, NOW)).toEqual(new Set([theirs]));
  });

  it("deletes a use's photos except the ones it keeps, and every photo an account uploaded", async () => {
    const [a, b] = await storePhotos("acc-seller", [upload(), upload()], NOW);
    await attachPhotos("acc-seller", [a, b], "shop");
    await deletePhotosUsedBy("acc-seller", "shop", new Set([b]));
    expect(await photoSrcsOf("acc-seller", "shop", NOW)).toEqual(new Set([b]));
    await deletePhotosOf("acc-seller");
    expect(sampleStore().photos.size).toBe(0);
  });

  it("tidies away waiting photos after a day, and keeps each account's newest 12", async () => {
    const [old] = await storePhotos("acc-seller", [upload()], new Date("2026-10-13T07:59:00.000Z"));
    await storePhotos("acc-seller", [upload()], NOW);
    expect(await getPhoto(photoIdOf(old)!, NOW)).toBeNull();
    const many = await storePhotos("acc-student", Array.from({ length: 14 }, upload), NOW);
    expect(await photoSrcsOf("acc-student", null, NOW)).toEqual(new Set(many.slice(2)));
  });
});
