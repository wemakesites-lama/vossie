import { describe, expect, it } from "vitest";
import { getCollections, getListingIds, getSellerSlugs } from "@/lib/data";
import { siteUrl } from "@/lib/site-url";
import sitemap from "./sitemap";

describe("sitemap.xml (info and system spec 2.8)", () => {
  it("lists every listing, seller and collection at the site's own address", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const id of await getListingIds()) expect(urls).toContain(`${siteUrl()}/listings/${id}`);
    for (const slug of await getSellerSlugs()) expect(urls).toContain(`${siteUrl()}/sellers/${slug}`);
    for (const collection of await getCollections()) expect(urls).toContain(`${siteUrl()}/collections/${collection.slug}`);
  });

  it("lists the indexable info pages, each address once, and not the three noindex drafts (plan amendment 1)", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const path of ["/how-it-works", "/safety", "/trust"]) expect(urls).toContain(`${siteUrl()}${path}`);
    for (const path of ["/privacy", "/terms", "/seller-guidelines"]) expect(urls).not.toContain(`${siteUrl()}${path}`);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
