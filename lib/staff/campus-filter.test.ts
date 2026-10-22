import { describe, expect, it } from "vitest";
import { campusFilterTabs, inCampus, readCampusFilter } from "./campus-filter";

const CAMPUSES = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

describe("the campus chips (role views spec 7.2; N3 plan decision 10)", () => {
  it("reads a known campus, and every campus for anything else", () => {
    expect(readCampusFilter({ campus: "pretoria" }, CAMPUSES)).toEqual({ slug: "pretoria", name: "Pretoria" });
    expect(readCampusFilter({ campus: ["midrand", "pretoria"] }, CAMPUSES)?.slug).toBe("midrand");
    expect(readCampusFilter({ campus: "nowhere" }, CAMPUSES)).toBeNull();
    expect(readCampusFilter({ campus: "" }, CAMPUSES)).toBeNull();
    expect(readCampusFilter({}, CAMPUSES)).toBeNull();
  });

  it("links each chip, All campuses first", () => {
    expect(campusFilterTabs("/admin/reports", CAMPUSES)).toEqual([
      { key: "all", label: "All campuses", href: "/admin/reports" },
      { key: "midrand", label: "Midrand", href: "/admin/reports?campus=midrand" },
      { key: "pretoria", label: "Pretoria", href: "/admin/reports?campus=pretoria" },
    ]);
  });

  it("keeps one campus's items, and everything (gone ones too) for every campus", () => {
    const items = [
      { id: "a", campus: "midrand" },
      { id: "b", campus: "pretoria" },
      { id: "c", campus: null },
    ];
    expect(inCampus(items, CAMPUSES[0], (item) => item.campus).map((item) => item.id)).toEqual(["a"]);
    expect(inCampus(items, null, (item) => item.campus).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
