import { beforeEach, describe, expect, it } from "vitest";
import { getCollections, getHubPostIds, getListingIds, getRequestIds, getSellerSlugs } from "@/lib/data";
import { resetSampleStore } from "@/lib/data/store";
import { siteUrl } from "@/lib/site-url";
import sitemap from "./sitemap";

// Requests come from the sample store (community actions plan decision 1). A fresh one for each test.
beforeEach(() => {
  resetSampleStore();
});

describe("sitemap.xml (info and system spec 2.8)", () => {
  it("lists every listing, seller and collection at the site's own address", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const id of await getListingIds()) expect(urls).toContain(`${siteUrl()}/listings/${id}`);
    for (const slug of await getSellerSlugs()) expect(urls).toContain(`${siteUrl()}/sellers/${slug}`);
    for (const collection of await getCollections()) expect(urls).toContain(`${siteUrl()}/collections/${collection.slug}`);
  });

  it("lists every Looking For request and Hub post, closed requests and past events included (community spec 3)", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    const requestIds = await getRequestIds();
    const hubPostIds = await getHubPostIds();
    expect(requestIds.length).toBeGreaterThan(0);
    expect(hubPostIds.length).toBeGreaterThan(0);
    for (const id of requestIds) expect(urls).toContain(`${siteUrl()}/looking-for/${id}`);
    for (const id of hubPostIds) expect(urls).toContain(`${siteUrl()}/hub/${id}`);
  });

  it("lists the indexable info pages, each address once, and not the three noindex drafts (plan amendment 1)", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const path of ["/how-it-works", "/safety", "/trust"]) expect(urls).toContain(`${siteUrl()}${path}`);
    for (const path of ["/privacy", "/terms", "/seller-guidelines"]) expect(urls).not.toContain(`${siteUrl()}${path}`);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
