import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCollections, getListingIds, getSellerSlugs } from "@/lib/data";
import { createRequest, hideRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { siteUrl } from "@/lib/site-url";
import sitemap from "./sitemap";

// It reads today's date after connection() (stage L plan decision 25): a stand-in, and a fixed clock.
vi.mock("next/server", () => ({ connection: async () => undefined }));

// Tuesday 20 October 2026, 10:00 in South Africa.
const NOW = new Date("2026-10-20T08:00:00.000Z");

// Requests come from the sample store (community actions plan decision 1). A fresh one for each test.
beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

const paths = async () => (await sitemap()).map((entry) => new URL(entry.url).pathname);

const LAMP = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: null,
  swapWelcome: false,
  neededBy: null,
};

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

describe("only what's worth crawling today (stage L spec 2.19 and section 5)", () => {
  it("leaves out closed, hidden and due requests, and keeps open ones", async () => {
    const open = await createRequest({ askerId: "acc-student", fields: LAMP, now: NOW });
    // Needed by the 16th: its closing day is today, the 20th, and nothing has settled it.
    const due = await createRequest({
      askerId: "acc-student",
      fields: { ...LAMP, neededBy: "2026-10-16" },
      now: new Date("2026-10-14T08:00:00.000Z"),
    });
    await hideRequest("r-002", "Checking it.", NOW);
    const listed = await paths();
    expect(listed).toContain(`/looking-for/${open.id}`);
    expect(listed).toContain("/looking-for/r-001");
    for (const id of ["r-015", "r-016", "r-002", due.id]) expect(listed).not.toContain(`/looking-for/${id}`);
  });

  it("keeps tips and today's and later events, and leaves out the ones that have passed", async () => {
    const listed = await paths();
    for (const id of ["h-013", "h-003", "h-005"]) expect(listed).toContain(`/hub/${id}`);
    for (const id of ["h-002", "h-011"]) expect(listed).not.toContain(`/hub/${id}`);
  });
});
