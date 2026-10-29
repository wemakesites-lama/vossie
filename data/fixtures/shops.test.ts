import { describe, expect, it } from "vitest";
import { sampleAccounts } from "./accounts";
import { campuses } from "./campuses";
import { categories } from "./categories";
import { listings } from "./listings";
import { pickupPoints } from "./pickup-points";
import { sampleListingRows, sampleSellerRows, sampleShopOwners } from "./shops";

const pointsById = new Map(pickupPoints.map((point) => [point.id, point]));

describe("the sample shops (selling plan, Task 1)", () => {
  it("has every sample seller, then Lerato's waiting shop, with unique slugs", () => {
    const slugs = sampleSellerRows.map((row) => row.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toHaveLength(30);
    expect(slugs.at(-1)).toBe("crochet-corner");
  });

  it("gives each owned shop to the sample account whose seller profile says so (plan decision 1)", () => {
    const profiles = new Map(
      sampleAccounts.flatMap(({ seller }) => (seller ? [[seller.accountId, seller] as const] : [])),
    );
    for (const [slug, accountId] of sampleShopOwners) {
      const row = sampleSellerRows.find((item) => item.slug === slug);
      expect(row?.ownerId, slug).toBe(accountId);
      const profile = profiles.get(accountId);
      expect(profile, slug).toBeDefined();
      // A waiting shop has a slug, but no storefront yet.
      expect(profile!.sellerSlug, slug).toBe(profile!.status === "pending" ? null : slug);
      const owner = sampleAccounts.find(({ account }) => account.id === accountId)!;
      expect(row!.campusSlug, slug).toBe(owner.account.campusSlug);
    }
    const owned = sampleSellerRows.filter((row) => row.ownerId !== null).map((row) => row.slug);
    expect(owned.sort()).toEqual(["crochet-corner", "tech-corner"]);
  });

  it("puts every shop on a real campus and category, using only its own campus's pickup spots", () => {
    const campusSlugs = new Set(campuses.map((campus) => campus.slug));
    const categorySlugs = new Set(categories.map((category) => category.slug));
    for (const row of sampleSellerRows) {
      expect(campusSlugs.has(row.campusSlug), row.slug).toBe(true);
      expect(categorySlugs.has(row.categorySlug), row.slug).toBe(true);
      for (const id of row.pickupPointIds) expect(pointsById.get(id)?.campusSlug, row.slug).toBe(row.campusSlug);
    }
    expect(sampleSellerRows.find((row) => row.slug === "tech-corner")?.pickupPointIds).toEqual([
      "pp-midrand-library",
      "pp-midrand-reception",
    ]);
    // Eduvos Online has no pickup points.
    expect(sampleSellerRows.find((row) => row.slug === "cv-clinic")?.pickupPointIds).toEqual([]);
  });

  it("turns every sample listing into a row with its state and its photos in order", () => {
    expect(sampleListingRows.map((row) => row.id)).toEqual(listings.map((listing) => listing.id));
    const casio = sampleListingRows.find((row) => row.id === "l-001")!;
    expect(casio).toMatchObject({ sellerSlug: "tech-corner", state: "available", campusSlug: "midrand" });
    // The cover's alt was the title, so it's kept empty: "the title" (selling spec 2.5).
    expect(casio.photos).toEqual([
      { src: "/stock/listing/tech.jpg", alt: "" },
      { src: "/placeholders/photo/2.svg", alt: "The back of the calculator, with the battery cover" },
      { src: "/placeholders/photo/3.svg", alt: "The slide-on cover" },
    ]);
    // Every sample listing was published when it was listed (selling plan amendment 9.2).
    for (const row of sampleListingRows) expect(row.firstPublishedAt, row.id).toBe(row.createdAt);
    expect(sampleListingRows.find((row) => row.id === "l-016")?.state).toBe("paused");
    expect(sampleListingRows.find((row) => row.id === "l-026")?.state).toBe("sold");
  });
});
