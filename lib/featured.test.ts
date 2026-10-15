import { describe, expect, it } from "vitest";
import { makeSeller } from "@/tests/helpers/fakes";
import type { Seller } from "./types";
import { dayNumber, drawFeatured } from "./featured";

const seller = (slug: string, campusSlug: string, verified = true): Seller =>
  makeSeller({ slug, name: slug, campusSlug, verified });

const sellers = [
  seller("a", "midrand"),
  seller("b", "midrand"),
  seller("c", "pretoria"),
  seller("d", "pretoria"),
  seller("e", "midrand", false),
  seller("f", "online"),
];

describe("dayNumber", () => {
  it("counts whole days since 1 January 1970", () => {
    expect(dayNumber("1970-01-02")).toBe(1);
    expect(dayNumber("2026-10-13") - dayNumber("2026-10-12")).toBe(1);
  });
});

describe("drawFeatured (spec 7.10)", () => {
  it("only features verified sellers", () => {
    expect(drawFeatured(sellers, "all", "2026-10-12", 10).map((s) => s.slug)).not.toContain("e");
  });

  it("starts one place further on each day, so every seller takes a turn", () => {
    const firstOn = (day: string) => drawFeatured(sellers, "all", day, 1)[0].slug;
    const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"];
    expect(new Set(week.map(firstOn)).size).toBe(5);
  });

  it("is the same all day", () => {
    expect(drawFeatured(sellers, "all", "2026-10-12")).toEqual(drawFeatured(sellers, "all", "2026-10-12"));
  });

  it("puts the campus's own sellers first, then tops up from other campuses", () => {
    const drawn = drawFeatured(sellers, "pretoria", "2026-10-12", 4);
    expect(drawn).toHaveLength(4);
    expect(drawn.slice(0, 2).map((s) => s.campusSlug)).toEqual(["pretoria", "pretoria"]);
  });

  it("puts pinned sellers first, in the order they were pinned, then fills the rest from the draw (staff tools spec 2.8)", () => {
    const drawn = drawFeatured(sellers, "pretoria", "2026-10-12", 4, { pinned: ["f", "a"] });
    expect(drawn.map((s) => s.slug).slice(0, 2)).toEqual(["f", "a"]);
    expect(drawn).toHaveLength(4);
    expect(new Set(drawn.map((s) => s.slug)).size).toBe(4);
    expect(drawn.slice(2).map((s) => s.campusSlug)).toEqual(["pretoria", "pretoria"]);
  });

  it("draws sellers who aren't resting first, then fills from resting ones, shown longest ago first (amendment 14)", () => {
    const resting = new Map([
      ["a", "2026-10-11"],
      ["c", "2026-10-08"],
    ]);
    const rested = drawFeatured(sellers, "all", "2026-10-12", 10, { resting });
    expect(rested.slice(0, 3).map((s) => s.slug).sort()).toEqual(["b", "d", "f"]);
    expect(rested.slice(3).map((s) => s.slug)).toEqual(["c", "a"]);
    expect(drawFeatured(sellers, "all", "2026-10-12", 3, { resting }).map((s) => s.slug).sort()).toEqual([
      "b",
      "d",
      "f",
    ]);
  });

  it("fills from resting sellers shown on the same day in the draw's order, the campus's own first", () => {
    const sameDay = new Map(["a", "b", "c", "d", "f"].map((slug) => [slug, "2026-10-11"]));
    expect(drawFeatured(sellers, "pretoria", "2026-10-12", 4, { resting: sameDay })).toEqual(
      drawFeatured(sellers, "pretoria", "2026-10-12", 4),
    );
  });

  it("keeps a resting seller's pin (a pin ignores the break)", () => {
    const resting = new Map([["a", "2026-10-11"]]);
    const pinned = drawFeatured(sellers, "all", "2026-10-12", 10, { pinned: ["a"], resting });
    expect(pinned[0].slug).toBe("a");
    expect(pinned.filter((s) => s.slug === "a")).toHaveLength(1);
  });

  it("shows 4 sellers every day while 4 or more can be featured, and gives each a turn (amendment 14)", () => {
    const five = sellers.filter((s) => s.verified);
    const shown = new Map<string, string>();
    const days = Array.from({ length: 14 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    const everyone = new Set<string>();
    for (const day of days) {
      // The last day each seller was shown, within the six days before (the week's break).
      const resting = new Map([...shown].filter(([, last]) => last < day && dayGap(last, day) <= 6));
      const row = drawFeatured(five, "midrand", day, 4, { resting });
      expect(row).toHaveLength(4);
      expect(new Set(row.map((s) => s.slug)).size).toBe(4);
      for (const s of row) {
        shown.set(s.slug, day);
        everyone.add(s.slug);
      }
    }
    expect(everyone.size).toBe(5);
  });

  it("ignores a pin for a seller who can't be featured, and never shows more than the places", () => {
    expect(drawFeatured(sellers, "all", "2026-10-12", 4, { pinned: ["e", "nobody"] }).map((s) => s.slug)).not.toContain(
      "e",
    );
    expect(drawFeatured(sellers, "all", "2026-10-12", 2, { pinned: ["a", "b", "c"] }).map((s) => s.slug)).toEqual([
      "a",
      "b",
    ]);
  });

  it("counts a seller pinned twice once", () => {
    const drawn = drawFeatured(sellers, "all", "2026-10-12", 4, { pinned: ["c", "c"] });
    expect(drawn.map((s) => s.slug).filter((slug) => slug === "c")).toHaveLength(1);
    expect(drawn).toHaveLength(4);
  });
});

const dayGap = (earlier: string, later: string) => dayNumber(later) - dayNumber(earlier);
