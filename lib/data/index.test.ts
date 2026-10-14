import { cacheTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeListingRow } from "@/tests/helpers/fakes";
import {
  getAnnouncements,
  getCampuses,
  getCategories,
  getCollection,
  getCollectionListings,
  getCollections,
  getFeatured,
  getFreeAndSwaps,
  getHeroSlides,
  getHubBanner,
  getHubEvents,
  getHubPost,
  getHubPostIds,
  getHubPosts,
  getJustListed,
  getListingDetail,
  getListingIds,
  getListingsByIds,
  getMoreFrom,
  getOpenRequests,
  getPickupPoints,
  getRelatedListings,
  getRequest,
  getRequestIds,
  getRequests,
  getSeller,
  getSellerListings,
  getSellerSlugs,
  getTrendingSearches,
  getVerifiedSellers,
  searchListings,
} from "./index";
import { resetSampleStore, sampleStore } from "./store";
import type { SearchQuery } from "@/lib/types";

// The data layer reads the sample store, seeded from the fixtures (selling plan decision 7). A fresh one for each test.
beforeEach(() => {
  resetSampleStore();
});

describe("sample data layer", () => {
  it("returns the 12 Eduvos campuses with Eduvos Online last", async () => {
    const campuses = await getCampuses();
    expect(campuses.map((c) => c.name)).toEqual([
      "Bedfordview",
      "Bloemfontein",
      "Cape Town Mowbray",
      "Cape Town Tyger Valley",
      "Durban Umhlanga",
      "East London",
      "Mbombela",
      "Midrand",
      "Nelson Mandela Bay",
      "Potchefstroom",
      "Pretoria",
      "Vanderbijlpark",
      "Eduvos Online",
    ]);
    expect(new Set(campuses.map((c) => c.slug)).size).toBe(13);
    for (const campus of campuses) {
      expect(campus.slug).toMatch(/^[a-z0-9-]+$/);
      expect(campus.region.length).toBeGreaterThan(0);
      expect(campus.liveListings).toBeGreaterThan(0);
      expect(campus.image.src).toBe(`/placeholders/campus/${campus.slug}.svg`);
    }
  });

  it("returns the ten confirmed categories in order", async () => {
    const categories = await getCategories();
    expect(categories.map((c) => c.name)).toEqual([
      "Textbooks & notes",
      "Tech",
      "Res & living",
      "Fashion & thrift",
      "Food",
      "Hair & beauty",
      "Tutoring",
      "Services",
      "Tickets & events",
      "Stationery",
    ]);
    expect(new Set(categories.map((c) => c.slug)).size).toBe(10);
  });

  it("returns at most three announcements that link inside the site", async () => {
    const announcements = await getAnnouncements();
    expect(announcements.length).toBeGreaterThan(0);
    expect(announcements.length).toBeLessThanOrEqual(3);
    for (const announcement of announcements) {
      expect(announcement.href.startsWith("/")).toBe(true);
    }
  });

  it("has trending searches for all campuses, keyed only by known campuses", async () => {
    const trending = await getTrendingSearches();
    const slugs = new Set((await getCampuses()).map((c) => c.slug));
    expect(trending.all.length).toBeGreaterThanOrEqual(3);
    for (const key of Object.keys(trending)) {
      expect(key === "all" || slugs.has(key)).toBe(true);
    }
  });
});

describe("homepage data", () => {
  it("has the hero slides and four collections", async () => {
    expect((await getHeroSlides()).map((slide) => slide.word)).toEqual(["textbooks", "tech", "services"]);
    expect(await getCollections()).toHaveLength(4);
    expect((await getHubBanner()).image.alt).toBe("");
  });

  it("lists the newest listings first, at one campus or every campus", async () => {
    const all = await getJustListed({ campus: "all", limit: 10 });
    expect(all).toHaveLength(10);
    const times = all.map((listing) => listing.createdAt);
    expect(times).toEqual([...times].sort().reverse());

    const midrand = await getJustListed({ campus: "midrand", limit: 10 });
    expect(midrand).toHaveLength(10);
    expect(midrand.every((listing) => listing.campusSlug === "midrand")).toBe(true);

    expect(await getJustListed({ campus: "mbombela", limit: 10 })).toEqual([]);
  });

  it("keeps paused and sold listings out of Just listed", async () => {
    const pretoria = (await getJustListed({ campus: "pretoria", limit: 10 })).map((listing) => listing.id);
    expect(pretoria).not.toContain("l-016");
    expect(pretoria).toContain("fs-002");
    const everywhere = (await getJustListed({ campus: "all", limit: 100 })).map((listing) => listing.id);
    expect(everywhere).not.toContain("l-026");
    expect(everywhere).toHaveLength(36);
  });

  it("picks the free and swap-only listings for Free & swaps, newest first (plan decision 6)", async () => {
    const items = await getFreeAndSwaps({ campus: "all", limit: 10 });
    expect(items.map((item) => item.id)).toEqual([
      "l-010",
      "fs-001",
      "fs-002",
      "fs-003",
      "fs-004",
      "fs-005",
      "fs-006",
      "fs-007",
    ]);
    expect(items[0]).toMatchObject({ kind: "swap", title: "Denim jacket, size M", campusSlug: "midrand" });
    expect(items[1]).toMatchObject({ kind: "free", title: "Business Management 1 notes" });
  });

  it("puts a campus's own requests and free and swap items first, then tops up", async () => {
    expect((await getRequests({ campus: "pretoria", limit: 3 })).map((r) => r.campusSlug)).toEqual([
      "pretoria",
      "pretoria",
      "midrand",
    ]);
    expect((await getFreeAndSwaps({ campus: "pretoria", limit: 3 })).map((item) => item.campusSlug)).toEqual([
      "pretoria",
      "midrand",
      "midrand",
    ]);
    expect(await getRequests({ campus: "all", limit: 2 })).toHaveLength(2);
  });

  it("lists a campus's events with the every-campus ones, soonest first", async () => {
    expect((await getHubEvents({ campus: "midrand", limit: 3, from: "2026-10-12" })).map((event) => event.id)).toEqual([
      "h-001",
      "h-002",
      "h-005",
    ]);
    expect((await getHubEvents({ campus: "mbombela", limit: 3, from: "2026-10-12" })).map((event) => event.id)).toEqual([
      "h-001",
      "h-005",
      "h-006",
    ]);
    expect((await getHubEvents({ campus: "all", limit: 3, from: "2026-10-12" })).map((event) => event.id)).toEqual([
      "h-001",
      "h-002",
      "h-003",
    ]);
    // Events before `from` (today's SAST date) are left out.
    expect((await getHubEvents({ campus: "all", limit: 3, from: "2026-10-15" })).map((event) => event.id)).toEqual([
      "h-002",
      "h-003",
      "h-004",
    ]);
  });

  it("draws four verified sellers for the day, the campus's own first", async () => {
    const featured = await getFeatured({ campus: "midrand", day: "2026-10-12" });
    expect(featured).toHaveLength(4);
    expect(featured.every((seller) => seller.verified && seller.campusSlug === "midrand")).toBe(true);
  });

  it("finds listing pages for every listing, including paused and sold ones", async () => {
    expect((await getListingDetail("fs-002"))?.listing.title).toBe("Desk lamp, swap for a kettle");
    expect((await getListingDetail("l-026"))?.listing.availability).toBe("sold");
    expect(await getListingDetail("nope")).toBeNull();
    const ids = await getListingIds();
    expect(ids).toHaveLength(38);
    expect(ids).toContain("l-001");
    expect(ids).toContain("fs-001");
  });

  it("finds sellers by slug", async () => {
    expect(await getSeller("hair-studio")).toMatchObject({ name: "Hair studio" });
    expect(await getSeller("nope")).toBeNull();
    expect(await getSellerSlugs()).toContain("maths-tutor");
  });
});

describe("listing page data (browse and listing spec 6.3)", () => {
  it("looks a listing up with its seller, category, campus and pickup point", async () => {
    const detail = await getListingDetail("l-001");
    expect(detail?.listing.title).toBe("Casio fx-991ZA Plus calculator");
    expect(detail?.seller.name).toBe("Tech corner");
    expect(detail?.category.name).toBe("Tech");
    expect(detail?.campus.name).toBe("Midrand");
    expect(detail?.pickupPoint).toEqual({ id: "pp-midrand-library", campusSlug: "midrand", name: "Library entrance" });
    expect((await getListingDetail("l-013"))?.pickupPoint).toBeNull();
  });

  it("has two pickup points on each physical campus", async () => {
    expect(await getPickupPoints()).toHaveLength(24);
  });

  it("offers more from the seller first", async () => {
    const calculator = (await getListingDetail("l-001"))!.listing;
    const more = await getMoreFrom(calculator, 4);
    expect(more.from).toBe("seller");
    expect(more.items.map((listing) => listing.id)).toEqual(["l-007"]);
  });

  it("falls back to the same category, the listing's campus first, leaving out paused and sold ones", async () => {
    const braids = (await getListingDetail("l-004"))!.listing;
    const forBraids = await getMoreFrom(braids, 4);
    expect(forBraids.from).toBe("category");
    // The paused lash listing (l-016) is left out.
    expect(forBraids.items.map((listing) => listing.id)).toEqual(["l-023"]);

    const python = (await getListingDetail("l-013"))!.listing;
    expect((await getMoreFrom(python, 4)).items.map((listing) => listing.id)).toEqual(["l-031", "l-005", "l-025"]);
  });
});

describe("searchListings (browse and listing spec 6.3)", () => {
  const everything: SearchQuery = {
    q: null,
    category: null,
    campus: "all",
    price: null,
    pay: null,
    deals: null,
    sort: "new",
  };

  it("lists every available listing, newest first", async () => {
    const result = await searchListings(everything);
    expect(result.items).toHaveLength(36);
    expect(result.items[0].id).toBe("l-001");
    expect(result.elsewhere).toBe(0);
  });

  it("keeps to one campus and counts the rest", async () => {
    const midrand = await searchListings({ ...everything, campus: "midrand" });
    expect(midrand.items).toHaveLength(14);
    expect(midrand.elsewhere).toBe(22);
    expect(await searchListings({ ...everything, campus: "mbombela" })).toEqual({ items: [], elsewhere: 36 });
  });

  it("finds by title, typo, seller name and several words, leaving out the sold calculator", async () => {
    const ids = async (q: string, campus = "all") =>
      (await searchListings({ ...everything, q, campus, sort: "match" })).items.map((listing) => listing.id);
    expect(await ids("calculator")).toEqual(["l-001", "fs-006"]);
    expect(await ids("calculator", "midrand")).toEqual(["l-001"]);
    expect(await ids("brads")).toEqual(["l-004"]);
    expect(await ids("kettel")).toEqual(["l-014", "fs-002"]);
    expect(await ids("bakery")).toEqual(["l-009"]);
    expect(await ids("notes for accounting")).toEqual(["l-002"]);
  });

  it("filters by category, price, pay and deals", async () => {
    const count = async (changes: Partial<SearchQuery>) =>
      (await searchListings({ ...everything, ...changes })).items.length;
    expect(await count({ category: "tech" })).toBe(5);
    expect(await count({ price: "free" })).toBe(4);
    expect(await count({ price: "under-50" })).toBe(4);
    expect(await count({ price: "under-100" })).toBe(7);
    expect(await count({ pay: "swap" })).toBe(6);
    expect(await count({ deals: "free-and-swaps" })).toBe(10);
  });

  it("sorts tech by price, swap-only last", async () => {
    const tech = await searchListings({ ...everything, category: "tech", sort: "price-low" });
    expect(tech.items.map((listing) => listing.id)).toEqual(["l-018", "l-001", "l-007", "l-022", "fs-006"]);
  });
});

describe("shopping page data (shopping spec 6.2)", () => {
  const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

  it("lists a seller's available listings, newest first", async () => {
    expect(ids(await getSellerListings("tech-corner"))).toEqual(["l-001", "l-007"]);
    expect(ids(await getSellerListings("weekend-market"))).toEqual(["l-021", "l-022", "fs-006"]);
  });

  it("leaves paused and sold listings off a storefront", async () => {
    expect(await getSellerListings("lash-lounge")).toEqual([]);
    expect(ids(await getSellerListings("study-desk"))).toEqual(["fs-007"]);
    expect(await getSellerListings("nope")).toEqual([]);
  });

  it("finds a collection by slug", async () => {
    expect((await getCollection("moving-in"))?.title).toBe("Res setup under R500");
    expect(await getCollection("nope")).toBeNull();
  });

  it("fills Res setup under R500 from every campus: free ones in, swap-only and dearer ones out", async () => {
    expect(ids(await getCollectionListings("moving-in"))).toEqual(["l-014", "l-006", "l-027", "fs-003", "fs-005"]);
  });

  it("fills the uncapped collections, swap-only listings in, paused and sold ones out", async () => {
    const semester = ids(await getCollectionListings("start-of-semester"));
    expect(semester).toHaveLength(12);
    expect(semester).toContain("fs-006");
    expect(semester).not.toContain("l-026");
    expect(await getCollectionListings("exam-season")).toHaveLength(10);
    const skills = ids(await getCollectionListings("skills-for-hire"));
    expect(skills).toHaveLength(9);
    expect(skills).toContain("fs-004");
    expect(skills).not.toContain("l-016");
  });

  it("has no listings for an unknown collection", async () => {
    expect(await getCollectionListings("nope")).toEqual([]);
  });

  it("looks listings up by id in the order given, paused and sold ones in, unknown ids out", async () => {
    expect(ids(await getListingsByIds(["l-026", "nope", "l-001", "l-016"]))).toEqual(["l-026", "l-001", "l-016"]);
    expect(await getListingsByIds([])).toEqual([]);
  });
});

describe("Looking For data (community spec 4.3)", () => {
  const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

  it("keeps the homepage's requests as they were, and never shows a closed one there", async () => {
    expect(ids(await getRequests({ campus: "all", limit: 3 }))).toEqual(["r-001", "r-002", "r-003"]);
    expect(ids(await getRequests({ campus: "midrand", limit: 3 }))).toEqual(["r-001", "r-003", "r-002"]);
    expect(ids(await getRequests({ campus: "mbombela", limit: 3 }))).toEqual(["r-001", "r-002", "r-003"]);
    const everything = ids(await getRequests({ campus: "all", limit: 100 }));
    expect(everything).toHaveLength(14);
    expect(everything).not.toContain("r-015");
  });

  it("leads with a campus's own new request where it has one (plan decision 1)", async () => {
    expect(ids(await getRequests({ campus: "bloemfontein", limit: 3 }))).toEqual(["r-008", "r-001", "r-002"]);
  });

  it("lists every open request for the board, newest first", async () => {
    expect(ids(await getOpenRequests({ category: null }))).toEqual([
      "r-001",
      "r-002",
      "r-003",
      "r-004",
      "r-005",
      "r-006",
      "r-007",
      "r-008",
      "r-009",
      "r-010",
      "r-011",
      "r-012",
      "r-013",
      "r-014",
    ]);
  });

  it("narrows the board to one category", async () => {
    expect(ids(await getOpenRequests({ category: "tech" }))).toEqual(["r-002", "r-013"]);
    expect(ids(await getOpenRequests({ category: "tutoring" }))).toEqual(["r-001", "r-014"]);
    expect(await getOpenRequests({ category: "tickets-events" })).toEqual([]);
  });

  it("finds any request by id, closed ones too, and lists every id for the pages", async () => {
    expect((await getRequest("r-001"))?.title).toBe("Accounting 1 tutor this week");
    expect((await getRequest("r-015"))?.status).toBe("closed");
    expect(await getRequest("nope")).toBeNull();
    const every = await getRequestIds();
    expect(every).toHaveLength(16);
    expect(every).toContain("r-016");
  });

  it("finds listings already on Vossie in the request's category, its campus first, then the newest", async () => {
    expect(ids(await getRelatedListings({ categorySlug: "tutoring", campusSlug: "midrand", limit: 4 }))).toEqual([
      "l-005",
      "l-013",
      "l-031",
      "l-025",
    ]);
    expect(ids(await getRelatedListings({ categorySlug: "res-living", campusSlug: "bedfordview", limit: 4 }))).toEqual([
      "fs-005",
      "l-003",
      "l-021",
      "l-014",
    ]);
    expect(ids(await getRelatedListings({ categorySlug: "tech", campusSlug: "pretoria", limit: 4 }))).toEqual([
      "l-001",
      "l-018",
      "l-007",
      "l-022",
    ]);
  });

  it("leaves paused and sold listings out of Already on Vossie", async () => {
    // The paused lash listing (l-016) is Pretoria's only hair and beauty listing; the sold calculator is East London's.
    expect(ids(await getRelatedListings({ categorySlug: "hair-beauty", campusSlug: "pretoria", limit: 4 }))).toEqual([
      "l-004",
      "l-023",
    ]);
    expect(ids(await getRelatedListings({ categorySlug: "tech", campusSlug: "east-london", limit: 10 }))).not.toContain(
      "l-026",
    );
  });
});

describe("Hub data (community spec 5.3)", () => {
  const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
  const every = ["event", "office-hours", "tip"] as const;

  it("derives What's on from the posts, with the old events' dates, titles, campuses and actions", async () => {
    const events = await getHubEvents({ campus: "all", limit: 20, from: "2026-10-12" });
    expect(events.map(({ date, title, campusSlug, action }) => ({ date, title, campusSlug, action }))).toEqual([
      { date: "2026-10-14", title: "Pitch night", campusSlug: "all", action: "rsvp" },
      { date: "2026-10-15", title: "Office hours: pricing your hustle", campusSlug: "midrand", action: "book" },
      { date: "2026-10-20", title: "Market day on the lawn", campusSlug: "pretoria", action: "rsvp" },
      { date: "2026-10-22", title: "Photo day for your shop", campusSlug: "bedfordview", action: "book" },
      { date: "2026-10-28", title: "Hub mixer", campusSlug: "all", action: "rsvp" },
      { date: "2026-11-05", title: "Selling online: photos that sell", campusSlug: "all", action: "rsvp" },
      { date: "2026-11-19", title: "Office hours: your first listing", campusSlug: "midrand", action: "book" },
      { date: "2026-12-03", title: "End-of-year market", campusSlug: "all", action: "rsvp" },
      { date: "2027-01-28", title: "Back-to-campus pop-up", campusSlug: "pretoria", action: "rsvp" },
      { date: "2027-02-11", title: "Pitch night", campusSlug: "all", action: "rsvp" },
    ]);
  });

  it("lists the feed: upcoming events and office hours soonest first, then tips newest first", async () => {
    expect(ids(await getHubPosts({ kinds: every, from: "2026-10-12" }))).toEqual([
      "h-001",
      "h-002",
      "h-003",
      "h-004",
      "h-005",
      "h-006",
      "h-007",
      "h-008",
      "h-009",
      "h-010",
      "h-013",
      "h-014",
      "h-015",
      "h-016",
      "h-017",
      "h-018",
    ]);
  });

  it("drops past events and office hours, and has none once the sample ones are over", async () => {
    const upcoming = ids(await getHubPosts({ kinds: ["event", "office-hours"], from: "2026-10-15" }));
    expect(upcoming[0]).toBe("h-002");
    expect(upcoming).toHaveLength(9);
    expect(await getHubPosts({ kinds: ["event", "office-hours"], from: "2027-03-01" })).toEqual([]);
  });

  it("keeps to the kinds asked for", async () => {
    expect(ids(await getHubPosts({ kinds: ["event"], from: "2026-10-12" }))).toEqual([
      "h-001",
      "h-003",
      "h-005",
      "h-006",
      "h-008",
      "h-009",
      "h-010",
    ]);
    expect(ids(await getHubPosts({ kinds: ["office-hours"], from: "2026-10-12" }))).toEqual(["h-002", "h-004", "h-007"]);
    expect(ids(await getHubPosts({ kinds: ["tip"], from: "2026-10-12" }))).toHaveLength(6);
  });

  it("finds any post by id, past ones too, and lists every id for the pages", async () => {
    expect((await getHubPost("h-011"))?.title).toBe("Hub open day");
    expect((await getHubPost("h-013"))?.kind).toBe("tip");
    expect(await getHubPost("nope")).toBeNull();
    expect(await getHubPostIds()).toHaveLength(18);
  });

  it("lists the Hub's Verified sellers A to Z (plan decision 11)", async () => {
    expect((await getVerifiedSellers()).map((seller) => seller.name)).toEqual([
      "Code coach",
      "Design studio",
      "Hair studio",
      "Home bakery",
      "Maths tutor",
      "Nail bar",
      "Phone fix",
      "Study notes",
      "Thrift rack",
    ]);
  });
});

describe("the store behind the data layer (selling spec 2.1, plan decisions 2 and 7)", () => {
  it("shows a new listing straight away: just listed, its shop, its page, its id and search", async () => {
    sampleStore().listings.set(
      "l-new",
      makeListingRow({ id: "l-new", title: "Quokka kettle", createdAt: "2026-10-14T09:00:00.000Z" }),
    );
    expect((await getJustListed({ campus: "midrand", limit: 1 })).map((listing) => listing.id)).toEqual(["l-new"]);
    expect((await getSellerListings("tech-corner")).map((listing) => listing.id)).toEqual(["l-new", "l-001", "l-007"]);
    expect((await getListingDetail("l-new"))?.seller.name).toBe("Tech corner");
    expect(await getListingIds()).toContain("l-new");
    const query: SearchQuery = {
      q: "quokka",
      category: null,
      campus: "all",
      price: null,
      pay: null,
      deals: null,
      sort: "match",
    };
    expect((await searchListings(query)).items[0].id).toBe("l-new");
  });

  it("drops a paused shop's listings from every list, and keeps their pages and the storefront", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect(await getSellerListings("tech-corner")).toEqual([]);
    const midrand = await getJustListed({ campus: "midrand", limit: 20 });
    expect(midrand.some((listing) => listing.sellerSlug === "tech-corner")).toBe(false);
    expect((await getListingDetail("l-001"))?.listing.availability).toBe("paused");
    expect(await getSeller("tech-corner")).toMatchObject({ name: "Tech corner" });
    expect(await getSellerSlugs()).not.toContain("tech-corner");
  });

  it("never shows a shop that's waiting for approval", async () => {
    expect(await getSeller("crochet-corner")).toBeNull();
    expect(await getSellerSlugs()).not.toContain("crochet-corner");
  });
});

describe("a shop that isn't open is kept out of every list (selling spec 8.8, amendment 8.14)", () => {
  const TECH_CORNER = new Set(["l-001", "l-007", "l-tc-free"]);
  const ours = (items: readonly { id: string }[]) => items.some((item) => TECH_CORNER.has(item.id));
  const days = Array.from({ length: 28 }, (_, n) => `2026-10-${String(n + 1).padStart(2, "0")}`);

  /** The lists Tech corner shows in, of those a paused or waiting shop must be kept out of. */
  async function listsShowingTechCorner(): Promise<string[]> {
    const shows: string[] = [];
    // Featured draws 4 of Midrand's verified shops a day; over four weeks each one has its turn.
    const featured = await Promise.all(days.map((day) => getFeatured({ campus: "midrand", day })));
    if (featured.flat().some((seller) => seller.slug === "tech-corner")) shows.push("Featured");
    if ((await getVerifiedSellers()).some((seller) => seller.slug === "tech-corner")) shows.push("Verified");
    const query: SearchQuery = {
      q: "tech corner",
      category: null,
      campus: "all",
      price: null,
      pay: null,
      deals: null,
      sort: "match",
    };
    if (ours((await searchListings(query)).items)) shows.push("search");
    const collected = await Promise.all((await getCollections()).map((item) => getCollectionListings(item.slug)));
    if (collected.some(ours)) shows.push("collections");
    if (ours(await getFreeAndSwaps({ campus: "all", limit: 100 }))) shows.push("Free & swaps");
    // Another shop's tech listing with nothing else from its shop, so More from falls back to the category.
    const elsewhere = { id: "l-018", sellerSlug: "no-such-shop", categorySlug: "tech", campusSlug: "midrand" };
    if (ours((await getMoreFrom(elsewhere, 100)).items)) shows.push("More from");
    if (ours(await getRelatedListings({ categorySlug: "tech", campusSlug: "midrand", limit: 100 }))) {
      shows.push("Related");
    }
    return shows;
  }

  it.each([
    { state: "paused", status: "paused" as const },
    { state: "waiting for approval", status: "pending" as const },
  ])("keeps a verified shop that's $state out of every list", async ({ status }) => {
    const store = sampleStore();
    store.sellers.get("tech-corner")!.verified = true;
    // A free listing, so the shop has one for Free & swaps too.
    store.listings.set(
      "l-tc-free",
      makeListingRow({ id: "l-tc-free", title: "Free phone case", priceZar: 0, createdAt: "2026-10-14T09:00:00.000Z" }),
    );
    const everyList = ["Featured", "Verified", "search", "collections", "Free & swaps", "More from", "Related"];
    expect(await listsShowingTechCorner()).toEqual(everyList);

    store.sellerProfiles.get("acc-seller")!.status = status;
    expect(await listsShowingTechCorner()).toEqual([]);
  });
});

describe("the cache tags (selling spec 2.1, plan decision 6, amendment 8.13)", () => {
  /** What `read` passed to cacheTag, call by call. */
  async function tagsOf(read: () => Promise<unknown>): Promise<string[][]> {
    vi.mocked(cacheTag).mockClear();
    await read();
    return vi.mocked(cacheTag).mock.calls;
  }

  const query: SearchQuery = {
    q: null,
    category: null,
    campus: "all",
    price: null,
    pay: null,
    deals: null,
    sort: "new",
  };
  const listingReaders: Record<string, () => Promise<unknown>> = {
    getCollectionListings: () => getCollectionListings("moving-in"),
    getJustListed: () => getJustListed({ campus: "all", limit: 4 }),
    getRelatedListings: () => getRelatedListings({ categorySlug: "tech", campusSlug: "midrand", limit: 4 }),
    getFreeAndSwaps: () => getFreeAndSwaps({ campus: "all", limit: 4 }),
    getListingDetail: () => getListingDetail("l-001"),
    getMoreFrom: () =>
      getMoreFrom({ id: "l-001", sellerSlug: "tech-corner", categorySlug: "tech", campusSlug: "midrand" }, 4),
    searchListings: () => searchListings(query),
    getListingIds: () => getListingIds(),
    getSellerListings: () => getSellerListings("tech-corner"),
    getListingsByIds: () => getListingsByIds(["l-001"]),
  };
  const sellerReaders: Record<string, () => Promise<unknown>> = {
    getSeller: () => getSeller("tech-corner"),
    getSellerSlugs: () => getSellerSlugs(),
    getFeatured: () => getFeatured({ campus: "midrand", day: "2026-10-12" }),
    getVerifiedSellers: () => getVerifiedSellers(),
  };

  it.each(Object.entries(listingReaders))("tags %s with listings and sellers", async (_, read) => {
    expect(await tagsOf(read)).toEqual([["listings", "sellers"]]);
  });

  it.each(Object.entries(sellerReaders))("tags %s with sellers", async (_, read) => {
    expect(await tagsOf(read)).toEqual([["sellers"]]);
  });
});
