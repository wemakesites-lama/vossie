import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPickupPoints } from "@/lib/data";
import { photoIdOf, storePhotos, type Upload } from "@/lib/data/photos";
import { isRefused } from "@/lib/data/refused";
import {
  changeShopSlug,
  createShop,
  exportShop,
  forgetShopOf,
  getOnboardingDraft,
  getShopOf,
  restoreSampleShop,
  saveOnboardingDraft,
  setShopPaused,
  updateShop,
  emptyDraft,
  type ShopDetails,
} from "@/lib/data/shops";
import { pngBytes } from "@/tests/helpers/image-bytes";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { shopsContract } from "./shops.contract";

// A seller's own shop on the local stack (C2/C3 plan Task 8): the contract, and what only Supabase has: the session
// checked against the account (decision 2), the paths deletion takes in the database (decision 21), a race refusal
// (decision 6), and the files in Storage.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("a seller's own shop on the local stack (C2/C3 plan Task 8)", () => {
  shopsContract(supabaseWorld);
});

const png = (): Upload => ({ type: "image/png", bytes: pngBytes() });

describe("the shop twins on the local stack (C2/C3 plan decisions 2, 6 and 21)", () => {
  let world: SupabaseWorld;
  let seller: string;
  let details: ShopDetails;
  beforeEach(async () => {
    world = supabaseWorld();
    seller = await world.signedIn("seller");
    for (const name of ["seller", "shopper"] as const) await world.tidySelling(name);
    const [point] = (await getPickupPoints()).filter((p) => p.campusSlug === "pretoria");
    details = {
      name: "Contract race shop",
      tagline: "",
      categorySlug: "tech",
      about: "A shop the contract tests make.",
      image: null,
      campusSlug: "pretoria",
      pickupPointIds: [point.id],
    };
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("throws for an account that isn't the signed-in one", async () => {
    const now = new Date();
    const calls: (() => Promise<unknown>)[] = [
      () => getShopOf(seller),
      () => createShop(seller, details, now),
      () => updateShop(seller, details, now),
      () => changeShopSlug(seller, "contract-x", now),
      () => setShopPaused(seller, true),
      () => getOnboardingDraft(seller),
      () => saveOnboardingDraft(emptyDraft(seller, "pretoria", now)),
      () => exportShop(seller),
    ];
    for (const call of calls) await expect(world.asViewer("shopper", call)).rejects.toThrow("isn't the signed-in one");
    expect(await world.asViewer("seller", () => getShopOf(seller))).toBeNull();
  });

  it("leaves deleting an account to the database, and has no sample shop to bring back", async () => {
    await expect(world.asViewer("seller", () => forgetShopOf(seller))).rejects.toThrow("forgetShopOf runs in the database on Supabase");
    expect(await world.asViewer("seller", () => restoreSampleShop(seller))).toBe(false);
  });

  it("throws Refused when another shop takes the name between the action's check and the save", async () => {
    await world.asViewer("seller", () => createShop(seller, details, new Date()));
    await world.openShop("shopper", { name: "Contract taken name" });
    const error = await world
      .asViewer("seller", () => updateShop(seller, { ...details, name: "Contract taken name" }, new Date()))
      .catch((caught: unknown) => caught);
    expect(isRefused(error, "name-taken")).toBe(true);
    expect((await world.asViewer("seller", () => getShopOf(seller)))?.shop.name).toBe("Contract race shop");
  });

  it("removes a replaced and a removed photo's files from Storage, and the draft's once the shop is made", async () => {
    const [draftPhoto, other] = await world.asViewer("seller", () => storePhotos(seller, [png(), png()], new Date()));
    await world.asViewer("seller", () => saveOnboardingDraft({ ...emptyDraft(seller, "pretoria", new Date()), photoSrc: draftPhoto }));
    await world.asViewer("seller", () => saveOnboardingDraft({ ...emptyDraft(seller, "pretoria", new Date()), photoSrc: other }));
    expect(await world.fileExists(`${seller}/${photoIdOf(draftPhoto)}`)).toBe(false);

    await world.asViewer("seller", () => createShop(seller, { ...details, image: { src: other, alt: "" } }, new Date()));
    expect(await world.fileExists(`${seller}/${photoIdOf(other)}`)).toBe(true);
    const [next] = await world.asViewer("seller", () => storePhotos(seller, [png()], new Date()));
    await world.asViewer("seller", () => updateShop(seller, { ...details, image: { src: next, alt: "" } }, new Date()));
    expect(await world.fileExists(`${seller}/${photoIdOf(other)}`)).toBe(false);
    expect(await world.fileExists(`${seller}/${photoIdOf(next)}`)).toBe(true);
    await world.asViewer("seller", () => updateShop(seller, { ...details, image: null }, new Date()));
    expect(await world.fileExists(`${seller}/${photoIdOf(next)}`)).toBe(false);
    expect((await world.asViewer("seller", () => getShopOf(seller)))?.shop.image).toBeNull();
  });

  it("saves a draft without a waiting photo that has run out, and a forged sample address as no photo (amendment 10)", async () => {
    const [photo] = await world.asViewer("seller", () => storePhotos(seller, [png()], new Date()));
    await world.ageWaitingPhoto(photo, 25);
    const draft = { ...emptyDraft(seller, "pretoria", new Date()), name: "Contract draft" };
    await world.asViewer("seller", () => saveOnboardingDraft({ ...draft, photoSrc: photo }));
    expect(await world.asViewer("seller", () => getOnboardingDraft(seller))).toMatchObject({ name: "Contract draft", photoSrc: null });

    const forged = "/photos/ph-00000000-0000-4000-8000-000000000000";
    await world.asViewer("seller", () => saveOnboardingDraft({ ...draft, photoSrc: forged }));
    expect((await world.asViewer("seller", () => getOnboardingDraft(seller)))?.photoSrc).toBeNull();
    const shop = await world.asViewer("seller", () => createShop(seller, { ...details, image: { src: forged, alt: "" } }, new Date()));
    expect(shop?.image).toBeNull();
  });
});
