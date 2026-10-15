import { beforeEach, describe, expect, it } from "vitest";
import {
  addPickupPoint,
  isPointNameTaken,
  listPickupPoints,
  pickupPointById,
  pickupPointName,
  pointsInUse,
  renamePickupPoint,
  restorePickupPoint,
  retirePickupPoint,
} from "./pickup-points";
import { resetSampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("pickup points (staff tools spec 2.3, plan decision 10)", () => {
  it("lists every point, and offers only those in use", async () => {
    expect(await listPickupPoints()).toHaveLength(24);
    expect(pointsInUse()).toHaveLength(24);
    expect(pointsInUse()[0]).toEqual({ id: "pp-bedfordview-library", campusSlug: "bedfordview", name: "Library entrance" });
  });

  it("adds a point with a new id, refusing a name its campus has however it's written, and any on Eduvos Online", async () => {
    const added = await addPickupPoint("midrand", "Student centre", NOW);
    expect(added).toMatchObject({ id: expect.stringMatching(/^pp-[0-9a-f-]{36}$/), campusSlug: "midrand", retiredAt: null });
    expect(pointsInUse().filter((point) => point.campusSlug === "midrand").map((point) => point.name)).toEqual([
      "Library entrance",
      "Main reception",
      "Student centre",
    ]);
    expect(await isPointNameTaken("midrand", "LIBRARY entrance!", null)).toBe(true);
    expect(await isPointNameTaken("midrand", "Library entrance", "pp-midrand-library")).toBe(false);
    expect(await isPointNameTaken("pretoria", "Student centre", null)).toBe(false);
    expect(await addPickupPoint("midrand", "library Entrance", NOW)).toBeNull();
    expect(await addPickupPoint("online", "The hall", NOW)).toBeNull();
    expect(await addPickupPoint("atlantis", "The hall", NOW)).toBeNull();
  });

  it("renames a point, keeping its id", async () => {
    expect(await renamePickupPoint("pp-midrand-library", "Library steps")).toEqual({ before: "Library entrance" });
    expect(pickupPointById("pp-midrand-library")?.name).toBe("Library steps");
    expect(await renamePickupPoint("pp-midrand-library", "Library steps")).toBeNull();
    expect(await renamePickupPoint("pp-midrand-library", "main RECEPTION")).toBeNull();
    expect(await renamePickupPoint("pp-nope", "Hall")).toBeNull();
  });

  it("retires a point, which listings keep, and uses it again", async () => {
    expect(await retirePickupPoint("pp-midrand-library", NOW)).toMatchObject({ retiredAt: NOW.toISOString() });
    expect(pointsInUse().map((point) => point.id)).not.toContain("pp-midrand-library");
    expect(pickupPointById("pp-midrand-library")).toEqual({
      id: "pp-midrand-library",
      campusSlug: "midrand",
      name: "Library entrance",
      retired: true,
    });
    expect(await retirePickupPoint("pp-midrand-library", NOW)).toBeNull();
    expect(await restorePickupPoint("pp-midrand-library")).toMatchObject({ retiredAt: null });
    expect(await restorePickupPoint("pp-midrand-library")).toBeNull();
    expect(pickupPointById("pp-midrand-library")).not.toHaveProperty("retired");
  });

  it("names any point for a listing's page and selling's export, and nothing for none", () => {
    expect(pickupPointName("pp-midrand-reception")).toBe("Main reception");
    expect(pickupPointName(null)).toBeNull();
    expect(pickupPointName("pp-nope")).toBeNull();
    expect(pickupPointById(null)).toBeNull();
  });
});
