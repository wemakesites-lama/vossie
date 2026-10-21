import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPickupPoints } from "@/lib/data";
import { forViewer } from "@/lib/data/supabase/clients";
import { deleteOwnListing, listOwnListings, saveOwnListing, type ListingSave } from "@/lib/data/own-listings";
import { photoIdOf, storePhotos, type Upload } from "@/lib/data/photos";
import { jpegBytes } from "@/tests/helpers/image-bytes";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { ownListingsContract } from "./own-listings.contract";

// A shop's own listings on the local stack (C2/C3 plan Task 9): the contract, and what only Supabase has: the files in
// Storage, the account and shop checked against the session (decision 2), a forged photo address refused rather than
// cast (amendment 10), and the new listing's one-time token as take_form_state takes it (the controller's answer to
// amendment 2; the action reaches it once C4's Task 2 points takeFormState at it).
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("a shop's own listings on the local stack (C2/C3 plan Task 9)", () => {
  ownListingsContract(supabaseWorld);
});

const jpeg = (): Upload => ({ type: "image/jpeg", bytes: jpegBytes() });

describe("the own-listing twins on the local stack (C2/C3 plan Task 9)", () => {
  let world: SupabaseWorld;
  let seller: string;
  let slug: string;
  let base: Omit<ListingSave, "photos">;
  beforeEach(async () => {
    world = supabaseWorld();
    for (const name of ["seller", "shopper"] as const) await world.tidySelling(name);
    seller = await world.signedIn("seller");
    slug = await world.openShop("seller");
    const point = (await getPickupPoints()).find((p) => p.campusSlug === "pretoria")!.id;
    base = {
      sellerSlug: slug,
      ownerId: seller,
      id: null,
      fields: {
        kind: "item",
        title: "Contract kettle",
        categorySlug: "res-living",
        condition: "good",
        priceZar: 90,
        priceIsFrom: false,
        payMode: "cash",
        swapFor: null,
        description: "A kettle the contract tests list.",
        handover: "pickup",
        pickupPointId: point,
      },
      intent: "publish",
      now: new Date(),
    };
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("keeps the photos' files until the listing is deleted", async () => {
    const [photo] = await world.asViewer("seller", () => storePhotos(seller, [jpeg()], new Date()));
    const path = `${seller}/${photoIdOf(photo)}`;
    const saved = (await world.asViewer("seller", () => saveOwnListing({ ...base, photos: [{ src: photo, alt: "" }] })))!;
    expect(await world.fileExists(path)).toBe(true);
    expect(await world.asViewer("seller", () => deleteOwnListing(slug, seller, saved.id))).toBe(true);
    expect(await world.fileExists(path)).toBe(false);
  });

  it("throws for an owner or a shop that isn't the signed-in account's", async () => {
    const shopper = await world.signedIn("shopper");
    const theirs = await world.openShop("shopper");
    await expect(world.asViewer("seller", () => saveOwnListing({ ...base, ownerId: shopper, photos: [] }))).rejects.toThrow(
      "isn't the signed-in one",
    );
    await expect(world.asViewer("seller", () => saveOwnListing({ ...base, sellerSlug: theirs, photos: [] }))).rejects.toThrow(
      "isn't the signed-in account's",
    );
    await expect(world.asViewer("seller", () => listOwnListings(theirs))).rejects.toThrow("isn't the signed-in account's");
    await expect(world.asViewer("seller", () => deleteOwnListing(slug, shopper, "l-001"))).rejects.toThrow("isn't the signed-in one");
  });

  it("refuses a forged sample photo address as a photo it may not use, with no error page (amendment 10)", async () => {
    const forged = `/photos/ph-${randomUUID()}`;
    expect(await world.asViewer("seller", () => saveOwnListing({ ...base, photos: [{ src: forged, alt: "" }] }))).toBeNull();
    expect(await world.asViewer("seller", () => listOwnListings(slug))).toEqual([]);
  });

  it("has a new listing's token taken once, in this session only (take_form_state)", async () => {
    const token = randomUUID();
    await world.onceRow("seller", `listing-once:${token}`);
    const take = () =>
      world.asViewer("seller", async () => {
        const { data, error } = await (await forViewer()).rpc("take_form_state", { p_key: `listing-once:${token}` });
        if (error) throw new Error(error.message);
        return data;
      });
    expect(await take()).toBe("first");
    expect(await take()).toBe("again");
    const other = randomUUID();
    await world.onceRow("shopper", `listing-once:${other}`);
    expect(
      await world.asViewer("seller", async () => (await (await forViewer()).rpc("take_form_state", { p_key: `listing-once:${other}` })).data),
    ).toBe("none");
    const old = randomUUID();
    await world.onceRow("seller", `listing-once:${old}`, { expiresInMinutes: -1 });
    expect(
      await world.asViewer("seller", async () => (await (await forViewer()).rpc("take_form_state", { p_key: `listing-once:${old}` })).data),
    ).toBe("none");
  });
});
