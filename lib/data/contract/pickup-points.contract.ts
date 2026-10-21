import { afterEach, beforeEach, expect, it } from "vitest";
import { getListingDetail, getListingIds, getPickupPoints } from "@/lib/data";
import type { ListingDetail } from "@/lib/types";
import type { World } from "@/tests/contract/world";

// Pickup points in both backends (2b plan Task 14, decision 14): the forms offer the points in use, and a listing on a
// retired point keeps it, marked retired (staff tools plan decision 10). pickup-points.test.ts runs it on the sample
// store, pickup-points.db.test.ts on the local stack.

/** The first listing with a page whose handover is at a pickup point. */
async function listingOnAPoint(): Promise<ListingDetail & { pickupPoint: NonNullable<ListingDetail["pickupPoint"]> }> {
  for (const id of await getListingIds()) {
    const detail = await getListingDetail(id);
    if (detail?.pickupPoint) return { ...detail, pickupPoint: detail.pickupPoint };
  }
  throw new Error("No listing has a pickup point");
}

export function pickupPointsContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("offers the 24 points in use, each campus's together", async () => {
    const points = await getPickupPoints();
    expect(points).toHaveLength(24);
    expect(points.every((point) => !("retired" in point))).toBe(true);
    expect(points.slice(0, 2).map((point) => [point.campusSlug, point.name])).toEqual([
      ["bedfordview", "Library entrance"],
      ["bedfordview", "Main reception"],
    ]);
  });

  it("stops offering a retired point, and a listing on it keeps it, marked retired", async () => {
    const { listing, pickupPoint } = await listingOnAPoint();
    expect(pickupPoint.retired).toBeUndefined();
    await world.retirePickupPoint(pickupPoint.id);
    const points = await getPickupPoints();
    expect(points).toHaveLength(23);
    expect(points.some((point) => point.id === pickupPoint.id)).toBe(false);
    expect((await getListingDetail(listing.id))?.pickupPoint).toEqual({ ...pickupPoint, retired: true });
  });
}
