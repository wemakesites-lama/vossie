import { describe, expect, it } from "vitest";
import {
  getAnnouncements,
  getCampuses,
  getCategories,
  getCollections,
  getFeatured,
  getFreeAndSwaps,
  getHeroSlides,
  getHubBanner,
  getHubEvents,
  getJustListed,
  getListingDetail,
  getListingIds,
  getMoreFrom,
  getPickupPoints,
  getRequests,
  getSeller,
  getSellerSlugs,
  getTrendingSearches,
  searchListings,
} from "./index";
import type { SearchQuery } from "@/lib/types";

describe("sample data layer", () => {
  it("returns the 12 Eduvos campuses with Eduvos Online last", async () => {
    const campuses = await getCampuses();
    expect(campuses.map((c) => c.name)).toEqual([
      "Bedfordview",
      "Bloemfontein",
      "Cape Town Mowbray",
      "Cape Town Tyger Valley",
      "Durban Umhlanga",
      "East London",
      "Mbombela",
      "Midrand",
      "Nelson Mandela Bay",
      "Potchefstroom",
      "Pretoria",
      "Vanderbijlpark",
      "Eduvos Online",
    ]);
    expect(new Set(campuses.map((c) => c.slug)).size).toBe(13);
    for (const campus of campuses) {
      expect(campus.slug).toMatch(/^[a-z0-9-]+$/);
      expect(campus.region.length).toBeGreaterThan(0);
      expect(campus.liveListings).toBeGreaterThan(0);
      expect(campus.image.src).toBe(`/placeholders/campus/${campus.slug}.svg`);
    }
  });

  it("returns the ten confirmed categories in order", async () => {
    const categories = await getCategories();
    expect(categories.map((c) => c.name)).toEqual([
      "Textbooks & notes",
      "Tech",
      "Res & living",
      "Fashion & thrift",
      "Food",
      "Hair & beauty",
      "Tutoring",
      "Services",
      "Tickets & events",
      "Stationery",
    ]);
    expect(new Set(categories.map((c) => c.slug)).size).toBe(10);
  });

  it("returns at most three announcements that link inside the site", async () => {
    const announcements = await getAnnouncements();
    expect(announcements.length).toBeGreaterThan(0);
    expect(announcements.length).toBeLessThanOrEqual(3);
    for (const announcement of announcements) {
      expect(announcement.href.startsWith("/")).toBe(true);
    }
  });

  it("has trending searches for all campuses, keyed only by known campuses", async () => {
    const trending = await getTrendingSearches();
    const slugs = new Set((await getCampuses()).map((c) => c.slug));
    expect(trending.all.length).toBeGreaterThanOrEqual(3);
    for (const key of Object.keys(trending)) {
      expect(key === "all" || slugs.has(key)).toBe(true);
    }
  });
});

describe("homepage data", () => {
  it("has the hero slides and four collections", async () => {
    expect((await getHeroSlides()).map((slide) => slide.word)).toEqual(["textbooks", "tech", "services"]);
    expect(await getCollections()).toHaveLength(4);
    expect((await getHubBanner()).image.alt).toBe("");
  });

  it("lists the newest listings first, at one campus or every campus", async () => {
    const all = await getJustListed({ campus: "all", limit: 10 });
    expect(all).toHaveLength(10);
    const times = all.map((listing) => listing.createdAt);
    expect(times).toEqual([...times].sort().reverse());

    const midrand = await getJustListed({ campus: "midrand", limit: 10 });
    expect(midrand).toHaveLength(10);
    expect(midrand.every((listing) => listing.campusSlug === "midrand")).toBe(true);

    expect(await getJustListed({ campus: "mbombela", limit: 10 })).toEqual([]);
  });

  it("keeps paused and sold listings out of Just listed", async () => {
    const pretoria = (await getJustListed({ campus: "pretoria", limit: 10 })).map((listing) => listing.id);
    expect(pretoria).not.toContain("l-016");
    expect(pretoria).toContain("fs-002");
    const everywhere = (await getJustListed({ campus: "all", limit: 100 })).map((listing) => listing.id);
    expect(everywhere).not.toContain("l-026");
    expect(everywhere).toHaveLength(36);
  });

  it("picks the free and swap-only listings for Free & swaps, newest first (plan decision 6)", async () => {
    const items = await getFreeAndSwaps({ campus: "all", limit: 10 });
    expect(items.map((item) => item.id)).toEqual([
      "l-010",
      "fs-001",
      "fs-002",
      "fs-003",
      "fs-004",
      "fs-005",
      "fs-006",
      "fs-007",
    ]);
    expect(items[0]).toMatchObject({ kind: "swap", title: "Denim jacket, size M", campusSlug: "midrand" });
    expect(items[1]).toMatchObject({ kind: "free", title: "Business Management 1 notes" });
  });

  it("puts a campus's own requests and free and swap items first, then tops up", async () => {
    expect((await getRequests({ campus: "pretoria", limit: 3 })).map((r) => r.campusSlug)).toEqual([
      "pretoria",
      "pretoria",
      "midrand",
    ]);
    expect((await getFreeAndSwaps({ campus: "pretoria", limit: 3 })).map((item) => item.campusSlug)).toEqual([
      "pretoria",
      "midrand",
      "midrand",
    ]);
    expect(await getRequests({ campus: "all", limit: 2 })).toHaveLength(2);
  });

  it("lists a campus's events with the every-campus ones, soonest first", async () => {
    expect((await getHubEvents({ campus: "midrand", limit: 3, from: "2026-10-12" })).map((event) => event.id)).toEqual([
      "e-001",
      "e-002",
      "e-005",
    ]);
    expect((await getHubEvents({ campus: "mbombela", limit: 3, from: "2026-10-12" })).map((event) => event.id)).toEqual([
      "e-001",
      "e-005",
      "e-006",
    ]);
    expect((await getHubEvents({ campus: "all", limit: 3, from: "2026-10-12" })).map((event) => event.id)).toEqual([
      "e-001",
      "e-002",
      "e-003",
    ]);
    // Events before `from` (today's SAST date) are left out.
    expect((await getHubEvents({ campus: "all", limit: 3, from: "2026-10-15" })).map((event) => event.id)).toEqual([
      "e-002",
      "e-003",
      "e-004",
    ]);
  });

  it("draws four verified sellers for the day, the campus's own first", async () => {
    const featured = await getFeatured({ campus: "midrand", day: "2026-10-12" });
    expect(featured).toHaveLength(4);
    expect(featured.every((seller) => seller.verified && seller.campusSlug === "midrand")).toBe(true);
  });

  it("finds listing pages for every listing, including paused and sold ones", async () => {
    expect((await getListingDetail("fs-002"))?.listing.title).toBe("Desk lamp, swap for a kettle");
    expect((await getListingDetail("l-026"))?.listing.availability).toBe("sold");
    expect(await getListingDetail("nope")).toBeNull();
    const ids = await getListingIds();
    expect(ids).toHaveLength(38);
    expect(ids).toContain("l-001");
    expect(ids).toContain("fs-001");
  });

  it("finds sellers by slug", async () => {
    expect(await getSeller("hair-studio")).toMatchObject({ name: "Hair studio" });
    expect(await getSeller("nope")).toBeNull();
    expect(await getSellerSlugs()).toContain("maths-tutor");
  });
});

describe("listing page data (browse and listing spec 6.3)", () => {
  it("looks a listing up with its seller, category, campus and pickup point", async () => {
    const detail = await getListingDetail("l-001");
    expect(detail?.listing.title).toBe("Casio fx-991ZA Plus calculator");
    expect(detail?.seller.name).toBe("Tech corner");
    expect(detail?.category.name).toBe("Tech");
    expect(detail?.campus.name).toBe("Midrand");
    expect(detail?.pickupPoint).toEqual({ id: "pp-midrand-library", campusSlug: "midrand", name: "Library entrance" });
    expect((await getListingDetail("l-013"))?.pickupPoint).toBeNull();
  });

  it("has two pickup points on each physical campus", async () => {
    expect(await getPickupPoints()).toHaveLength(24);
  });

  it("offers more from the seller first", async () => {
    const calculator = (await getListingDetail("l-001"))!.listing;
    const more = await getMoreFrom(calculator, 4);
    expect(more.from).toBe("seller");
    expect(more.items.map((listing) => listing.id)).toEqual(["l-007"]);
  });

  it("falls back to the same category, the listing's campus first, leaving out paused and sold ones", async () => {
    const braids = (await getListingDetail("l-004"))!.listing;
    const forBraids = await getMoreFrom(braids, 4);
    expect(forBraids.from).toBe("category");
    // The paused lash listing (l-016) is left out.
    expect(forBraids.items.map((listing) => listing.id)).toEqual(["l-023"]);

    const python = (await getListingDetail("l-013"))!.listing;
    expect((await getMoreFrom(python, 4)).items.map((listing) => listing.id)).toEqual(["l-031", "l-005", "l-025"]);
  });
});

describe("searchListings (browse and listing spec 6.3)", () => {
  const everything: SearchQuery = {
    q: null,
    category: null,
    campus: "all",
    price: null,
    pay: null,
    deals: null,
    sort: "new",
  };

  it("lists every available listing, newest first", async () => {
    const result = await searchListings(everything);
    expect(result.items).toHaveLength(36);
    expect(result.items[0].id).toBe("l-001");
    expect(result.elsewhere).toBe(0);
  });

  it("keeps to one campus and counts the rest", async () => {
    const midrand = await searchListings({ ...everything, campus: "midrand" });
    expect(midrand.items).toHaveLength(14);
    expect(midrand.elsewhere).toBe(22);
    expect(await searchListings({ ...everything, campus: "mbombela" })).toEqual({ items: [], elsewhere: 36 });
  });

  it("finds by title, typo, seller name and several words, leaving out the sold calculator", async () => {
    const ids = async (q: string, campus = "all") =>
      (await searchListings({ ...everything, q, campus, sort: "match" })).items.map((listing) => listing.id);
    expect(await ids("calculator")).toEqual(["l-001", "fs-006"]);
    expect(await ids("calculator", "midrand")).toEqual(["l-001"]);
    expect(await ids("brads")).toEqual(["l-004"]);
    expect(await ids("kettel")).toEqual(["l-014", "fs-002"]);
    expect(await ids("bakery")).toEqual(["l-009"]);
    expect(await ids("notes for accounting")).toEqual(["l-002"]);
  });

  it("filters by category, price, pay and deals", async () => {
    const count = async (changes: Partial<SearchQuery>) =>
      (await searchListings({ ...everything, ...changes })).items.length;
    expect(await count({ category: "tech" })).toBe(5);
    expect(await count({ price: "free" })).toBe(4);
    expect(await count({ price: "under-50" })).toBe(4);
    expect(await count({ price: "under-100" })).toBe(7);
    expect(await count({ pay: "swap" })).toBe(6);
    expect(await count({ deals: "free-and-swaps" })).toBe(10);
  });

  it("sorts tech by price, swap-only last", async () => {
    const tech = await searchListings({ ...everything, category: "tech", sort: "price-low" });
    expect(tech.items.map((listing) => listing.id)).toEqual(["l-018", "l-001", "l-007", "l-022", "fs-006"]);
  });
});
