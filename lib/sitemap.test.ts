import { describe, expect, it } from "vitest";
import { sitemapEntries, STATIC_PATHS } from "./sitemap";

const BASE = "https://vossie.example";
const SOURCES = {
  listingIds: ["l-001", "fs-002"],
  sellerSlugs: ["tech-corner", "res-deals"],
  collectionSlugs: ["exam-season"],
};

const paths = (entries: ReturnType<typeof sitemapEntries>) => entries.map((entry) => new URL(entry.url).pathname);

describe("sitemapEntries (info and system spec 2.8)", () => {
  it("starts with the pages that have no id in their address, as absolute addresses", () => {
    const entries = sitemapEntries(BASE, SOURCES);
    expect(entries.slice(0, STATIC_PATHS.length).map((entry) => entry.url)).toEqual([
      "https://vossie.example/",
      "https://vossie.example/browse",
      "https://vossie.example/looking-for",
      "https://vossie.example/hub",
      "https://vossie.example/how-it-works",
      "https://vossie.example/safety",
      "https://vossie.example/trust",
    ]);
  });

  it("lists every collection, seller and listing", () => {
    expect(paths(sitemapEntries(BASE, SOURCES)).slice(STATIC_PATHS.length)).toEqual([
      "/collections/exam-season",
      "/sellers/tech-corner",
      "/sellers/res-deals",
      "/listings/l-001",
      "/listings/fs-002",
    ]);
  });

  it("adds Looking For requests and Hub posts when it is given them, and not otherwise", () => {
    const without = paths(sitemapEntries(BASE, SOURCES));
    expect(without.some((path) => path.startsWith("/looking-for/") || path.startsWith("/hub/"))).toBe(false);
    const withThem = paths(sitemapEntries(BASE, { ...SOURCES, requestIds: ["r-001"], hubPostIds: ["h-001", "h-002"] }));
    expect(withThem.slice(-3)).toEqual(["/looking-for/r-001", "/hub/h-001", "/hub/h-002"]);
  });

  it("never lists a page that belongs to one person or one device", () => {
    const listed = paths(sitemapEntries(BASE, SOURCES));
    for (const path of ["/saved", "/login", "/account", "/sell"]) expect(listed).not.toContain(path);
  });

  it("leaves out the three draft legal pages, which are noindex until Eduvos signs them off (amendment 1)", () => {
    const listed = paths(sitemapEntries(BASE, SOURCES));
    for (const path of ["/privacy", "/terms", "/seller-guidelines"]) expect(listed).not.toContain(path);
  });

  it("lists each address once", () => {
    const listed = paths(sitemapEntries(BASE, { ...SOURCES, requestIds: ["r-001"], hubPostIds: ["h-001"] }));
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("carries no last-modified time, which would need the clock while prerendering", () => {
    for (const entry of sitemapEntries(BASE, SOURCES)) expect(entry).not.toHaveProperty("lastModified");
  });
});
