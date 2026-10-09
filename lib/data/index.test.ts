import { describe, expect, it } from "vitest";
import { getAnnouncements, getCampuses, getCategories, getTrendingSearches } from "./index";

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
