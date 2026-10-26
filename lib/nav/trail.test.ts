import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LABELS, PARENTS, TOP_LEVEL, TRAIL_ROUTES, trailFor } from "./trail";

const APP = resolve(__dirname, "../../app");

/** Every page's route, from the app folder (route groups left out of the address). */
function routes(folder = ""): string[] {
  return readdirSync(join(APP, folder)).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(join(APP, path)).isDirectory()) return routes(path);
    if (name !== "page.tsx") return [];
    const route = `/${folder}`.replace(/\/\([^)]+\)/g, "").replace(/\/$/, "");
    return [route || "/"];
  });
}

describe("the trail map (wayfinding spec 3.2)", () => {
  it("knows every page: each is top-level or has a parent", () => {
    const pages = routes();
    expect(pages.length).toBeGreaterThan(60);
    expect(pages.filter((route) => !TRAIL_ROUTES.has(route))).toEqual([]);
  });

  it("names every route it doesn't leave to its page, and every parent is a known route", () => {
    for (const parent of Object.values(PARENTS)) expect(TRAIL_ROUTES.has(parent), parent).toBe(true);
    for (const route of TOP_LEVEL) expect(LABELS[route], route).toBeTruthy();
  });

  it("gives a top-level page no trail", () => {
    expect(trailFor("/browse")).toEqual([]);
    expect(trailFor("/admin")).toEqual([]);
  });

  it("walks up from a deep page, filling the segments and the names the page passes", () => {
    expect(
      trailFor("/admin/reports/[id]/hide", { params: { id: "rep-1" }, names: { "/admin/reports/[id]": "Report on Tech corner" } }),
    ).toEqual([
      { label: "Home", href: "/" },
      { label: "Hub console", href: "/admin" },
      { label: "Reports", href: "/admin/reports" },
      { label: "Report on Tech corner", href: "/admin/reports/rep-1" },
      { label: "Hide it", href: null },
    ]);
  });

  it("starts a public page at Home without repeating it", () => {
    expect(trailFor("/listings/[id]", { names: { "/listings/[id]": "Casio" } })).toEqual([
      { label: "Home", href: "/" },
      { label: "Shop", href: "/browse" },
      { label: "Casio", href: null },
    ]);
    expect(trailFor("/safety")).toEqual([
      { label: "Home", href: "/" },
      { label: "Safety", href: null },
    ]);
  });

  it("takes a crumb's address from hrefs (a selling thread's Messages)", () => {
    const trail = trailFor("/messages/[id]", { names: { "/messages/[id]": "Tech corner" }, hrefs: { "/messages": "/messages?tab=selling" } });
    expect(trail[1]).toEqual({ label: "Messages", href: "/messages?tab=selling" });
  });

  it("puts the Hub's tools and Mentoring under the console for an admin only", () => {
    expect(trailFor("/hub/manage", { roles: ["admin"] }).map((crumb) => crumb.label)).toEqual([
      "Home",
      "Hub console",
      "Posts and office hours",
    ]);
    expect(trailFor("/hub/manage", { roles: ["mentor"] })).toEqual([]);
    expect(trailFor("/hub/new", { roles: ["mentor"] }).map((crumb) => crumb.label)).toEqual([
      "Home",
      "Posts and office hours",
      "Write a post",
    ]);
    expect(trailFor("/mentor/[slug]", { params: { slug: "tech-corner" }, names: { "/mentor/[slug]": "Tech corner" }, roles: ["admin", "mentor"] }))
      .toEqual([
        { label: "Home", href: "/" },
        { label: "Hub console", href: "/admin" },
        { label: "Mentoring", href: "/mentor" },
        { label: "Tech corner", href: null },
      ]);
  });

  it("puts a page with no fixed parent under the one it passes (a report under what it reports)", () => {
    expect(trailFor("/report", { parent: { label: "Casio", href: "/listings/l-001" } })).toEqual([
      { label: "Home", href: "/" },
      { label: "Casio", href: "/listings/l-001" },
      { label: "Report", href: null },
    ]);
  });

  it("puts the crumbs a page passes between its parent and itself (a listing's category)", () => {
    const trail = trailFor("/listings/[id]", {
      names: { "/listings/[id]": "Casio" },
      between: [{ label: "Calculators", href: "/browse?cat=calculators" }],
    });
    expect(trail.map((crumb) => crumb.label)).toEqual(["Home", "Shop", "Calculators", "Casio"]);
  });

  it("throws for a route it doesn't know", () => {
    expect(() => trailFor("/nowhere")).toThrow(/lib\/nav\/trail.ts/);
  });
});
