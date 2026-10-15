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

  it("draws resting sellers only after everyone else, and a pin ignores the break (staff tools plan amendment 3)", () => {
    const rested = drawFeatured(sellers, "all", "2026-10-12", 10, { resting: new Set(["a", "c"]) }).map((s) => s.slug);
    expect(rested).toHaveLength(5);
    expect(rested.slice(0, 3).sort()).toEqual(["b", "d", "f"]);
    expect(rested.slice(3).sort()).toEqual(["a", "c"]);
    const pinned = drawFeatured(sellers, "all", "2026-10-12", 10, { pinned: ["a"], resting: new Set(["a"]) });
    expect(pinned[0].slug).toBe("a");
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
});
