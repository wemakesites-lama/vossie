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
  getListing,
  getListingIds,
  getRequests,
  getSeller,
  getSellerSlugs,
  getTrendingSearches,
} from "./index";

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

  it("finds listing pages for listings and free and swap items", async () => {
    expect(await getListing("l-001")).toMatchObject({ title: "Casio fx-991ZA Plus calculator", campusSlug: "midrand" });
    expect(await getListing("fs-002")).toMatchObject({ title: "Desk lamp, swap for a kettle" });
    expect(await getListing("nope")).toBeNull();
    const ids = await getListingIds();
    expect(ids).toContain("l-001");
    expect(ids).toContain("fs-001");
  });

  it("finds sellers by slug", async () => {
    expect(await getSeller("hair-studio")).toMatchObject({ name: "Hair studio" });
    expect(await getSeller("nope")).toBeNull();
    expect(await getSellerSlugs()).toContain("maths-tutor");
  });
});
