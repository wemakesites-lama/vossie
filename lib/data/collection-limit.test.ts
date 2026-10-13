import { describe, expect, it, vi } from "vitest";
import { getCollectionListings } from "./index";

// No sample collection comes near 48 listings, so this swaps in 50 available Res & living listings at R100 to test the
// cut. The factory loads makeListing with import() because vi.mock is hoisted above this file's imports. l-01 is the
// oldest (10:00) and l-50 the newest (10:49).
vi.mock("@/data/fixtures/listings", async () => {
  const { makeListing } = await import("@/tests/helpers/fakes");
  const listings = Array.from({ length: 50 }, (_, index) =>
    makeListing({
      id: `l-${String(index + 1).padStart(2, "0")}`,
      categorySlug: "res-living",
      priceZar: 100,
      createdAt: `2026-10-10T10:${String(index).padStart(2, "0")}:00Z`,
    }),
  );
  return { listings };
});

describe("getCollectionListings limit (shopping spec 6.2)", () => {
  it("stops a collection at 48 listings, keeping the newest", async () => {
    const shown = await getCollectionListings("moving-in");
    expect(shown).toHaveLength(48);
    // Newest first: l-50 down to l-03, so the two oldest are the ones cut.
    const expected = Array.from({ length: 48 }, (_, index) => `l-${String(50 - index).padStart(2, "0")}`);
    expect(shown.map((listing) => listing.id)).toEqual(expected);
  });
});
