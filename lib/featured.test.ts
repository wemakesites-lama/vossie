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
});
