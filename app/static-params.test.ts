import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCollections, getHubPostIds, getListingIds, getRequestIds, getSellerSlugs } from "@/lib/data";

// Every data-driven generateStaticParams gives at least one value when its reader gives none (2b plan amendment 16,
// Task 17b): a new Supabase project starts empty, and a Cache Components build refuses an empty list. The placeholder's
// page is the 404, since each page calls notFound() for an unknown value.

vi.mock("@/lib/data", async (original) => ({
  ...(await original<typeof import("@/lib/data")>()),
  getListingIds: vi.fn(),
  getSellerSlugs: vi.fn(),
  getCollections: vi.fn(),
  getRequestIds: vi.fn(),
  getHubPostIds: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getListingIds).mockResolvedValue([]);
  vi.mocked(getSellerSlugs).mockResolvedValue([]);
  vi.mocked(getCollections).mockResolvedValue([]);
  vi.mocked(getRequestIds).mockResolvedValue([]);
  vi.mocked(getHubPostIds).mockResolvedValue([]);
});

describe("prerendering on an empty database (2b plan Task 17b)", () => {
  it("a listing's page", async () => {
    const page = await import("./listings/[id]/page");
    expect(await page.generateStaticParams()).toEqual([{ id: "l-sample" }]);
    vi.mocked(getListingIds).mockResolvedValue(["l-001", "l-002"]);
    expect(await page.generateStaticParams()).toEqual([{ id: "l-001" }, { id: "l-002" }]);
  });

  it("a listing's composer", async () => {
    const page = await import("./listings/[id]/message/page");
    expect(await page.generateStaticParams()).toEqual([{ id: "l-sample" }]);
    vi.mocked(getListingIds).mockResolvedValue(["l-001", "l-002"]);
    expect(await page.generateStaticParams()).toEqual([{ id: "l-001" }]);
  });

  it("a storefront", async () => {
    const page = await import("./sellers/[slug]/page");
    expect(await page.generateStaticParams()).toEqual([{ slug: "sample-shop" }]);
    vi.mocked(getSellerSlugs).mockResolvedValue(["tech-corner"]);
    expect(await page.generateStaticParams()).toEqual([{ slug: "tech-corner" }]);
  });

  it("a shop's composer", async () => {
    const page = await import("./sellers/[slug]/message/page");
    expect(await page.generateStaticParams()).toEqual([{ slug: "sample-shop" }]);
    vi.mocked(getSellerSlugs).mockResolvedValue(["tech-corner", "hair-studio"]);
    expect(await page.generateStaticParams()).toEqual([{ slug: "tech-corner" }]);
  });

  it("a collection's page", async () => {
    const page = await import("./collections/[slug]/page");
    expect(await page.generateStaticParams()).toEqual([{ slug: "sample-collection" }]);
  });

  it("a request's page", async () => {
    const page = await import("./looking-for/[id]/page");
    expect(await page.generateStaticParams()).toEqual([{ id: "r-sample" }]);
    vi.mocked(getRequestIds).mockResolvedValue(["r-001"]);
    expect(await page.generateStaticParams()).toEqual([{ id: "r-001" }]);
  });

  it("a Hub post's page", async () => {
    const page = await import("./hub/[id]/page");
    expect(await page.generateStaticParams()).toEqual([{ id: "h-sample" }]);
    vi.mocked(getHubPostIds).mockResolvedValue(["h-001"]);
    expect(await page.generateStaticParams()).toEqual([{ id: "h-001" }]);
  });
});
