import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/next-path";
import { parseSavedIds } from "@/lib/saved";
import { sastDateTime } from "@/lib/time";
import { campuses } from "./campuses";
import { categories } from "./categories";
import { collections } from "./collections";
import { heroSlides } from "./hero";
import { hubBanner, hubPosts } from "./hub";
import { listings } from "./listings";
import { pickupPoints } from "./pickup-points";
import { requests } from "./requests";
import { sellers } from "./sellers";

const campusSlugs = new Set(campuses.map((campus) => campus.slug));
const categorySlugs = new Set(categories.map((category) => category.slug));
const sellersBySlug = new Map(sellers.map((seller) => [seller.slug, seller]));
const pointsById = new Map(pickupPoints.map((point) => [point.id, point]));
const isUnique = (values: readonly string[]) => new Set(values).size === values.length;

describe("homepage fixtures (spec section 13)", () => {
  it("has three hero slides, each opening one of the categories", () => {
    expect(heroSlides.map((slide) => slide.word)).toEqual(["textbooks", "tech", "services"]);
    const categoryPaths = new Set(categories.map((category) => `/browse?cat=${category.slug}`));
    for (const slide of heroSlides) expect(categoryPaths.has(slide.cta.href)).toBe(true);
  });

  it("has four collections with unique slugs", () => {
    expect(collections).toHaveLength(4);
    expect(isUnique(collections.map((collection) => collection.slug))).toBe(true);
  });

  it("lists items on every campus but Mbombela, so the empty state can be tested", () => {
    const withListings = new Set(listings.map((listing) => listing.campusSlug));
    expect(campuses.filter((campus) => !withListings.has(campus.slug)).map((campus) => campus.slug)).toEqual([
      "mbombela",
    ]);
  });

  it("has at least ten listings at Midrand, to fill the desktop grid", () => {
    expect(listings.filter((listing) => listing.campusSlug === "midrand").length).toBeGreaterThanOrEqual(10);
  });

  it("puts sellers and requests on known campuses", () => {
    for (const item of [...sellers, ...requests]) expect(campusSlugs.has(item.campusSlug)).toBe(true);
    expect(isUnique(sellers.map((seller) => seller.slug))).toBe(true);
  });
});

describe("listing fixtures (browse and listing spec 6.2)", () => {
  it("gives every listing a unique id, a known campus and category, and a real time", () => {
    expect(isUnique(listings.map((listing) => listing.id))).toBe(true);
    for (const listing of listings) {
      expect(campusSlugs.has(listing.campusSlug), listing.id).toBe(true);
      expect(categorySlugs.has(listing.categorySlug), listing.id).toBe(true);
      // UTC to the second, with a Z: the newest-first sorts compare these as text.
      expect(listing.createdAt, listing.id).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
      expect(Number.isNaN(Date.parse(listing.createdAt)), listing.id).toBe(false);
    }
  });

  it("gives every listing an id the saved cookie can hold, or its heart would fail with \"Couldn't update\"", () => {
    for (const listing of listings) expect(parseSavedIds(listing.id), listing.id).toEqual([listing.id]);
  });

  it("gives every listing a seller on the listing's own campus", () => {
    for (const listing of listings) {
      expect(sellersBySlug.get(listing.sellerSlug)?.campusSlug, listing.id).toBe(listing.campusSlug);
    }
  });

  it("has no price exactly when a listing is swap-only, and swap terms exactly when it takes swaps", () => {
    for (const listing of listings) {
      expect(listing.priceZar === null, listing.id).toBe(listing.payMode === "swap");
      if (listing.priceZar !== null) expect(listing.priceZar, listing.id).toBeGreaterThanOrEqual(0);
      expect(listing.swapFor !== null, listing.id).toBe(listing.payMode !== "cash");
    }
  });

  it("names a pickup point on the listing's own campus exactly when the handover is a pickup", () => {
    for (const listing of listings) {
      expect(listing.pickupPointId !== null, listing.id).toBe(listing.handover === "pickup");
      if (listing.pickupPointId) {
        expect(pointsById.get(listing.pickupPointId)?.campusSlug, listing.id).toBe(listing.campusSlug);
      }
    }
  });

  it("gives items a condition and services none, and hands over online at Eduvos Online", () => {
    for (const listing of listings) {
      expect(listing.condition === null, listing.id).toBe(listing.kind === "service");
      if (listing.campusSlug === "online") expect(listing.handover, listing.id).toBe("online");
    }
  });

  it("has at most five more photos per listing, and at least three listings with more than one", () => {
    for (const listing of listings) expect(listing.morePhotos.length, listing.id).toBeLessThanOrEqual(5);
    expect(listings.filter((listing) => listing.morePhotos.length > 0).length).toBeGreaterThanOrEqual(3);
  });

  it("uses every way of handing over, so each collect box wording can be tested", () => {
    expect(new Set(listings.map((listing) => listing.handover))).toEqual(
      new Set(["pickup", "on-campus", "on-campus-or-online", "online"]),
    );
  });

  it("has paused, sold, free and swap-only listings, to test those states", () => {
    expect(listings.some((listing) => listing.availability === "paused")).toBe(true);
    expect(listings.some((listing) => listing.availability === "sold")).toBe(true);
    expect(listings.some((listing) => listing.priceZar === 0)).toBe(true);
    expect(listings.some((listing) => listing.payMode === "swap")).toBe(true);
  });

  it("has pickup points with unique ids on the physical campuses only", () => {
    expect(isUnique(pickupPoints.map((point) => point.id))).toBe(true);
    expect(new Set(pickupPoints.map((point) => point.campusSlug))).toEqual(
      new Set(campuses.filter((campus) => campus.slug !== "online").map((campus) => campus.slug)),
    );
  });
});

describe("seller and collection fixtures (shopping spec 6.1)", () => {
  it("gives every seller an about, a start month and a known category with its own name", () => {
    for (const seller of sellers) {
      expect(seller.about.trim().length, seller.slug).toBeGreaterThan(0);
      expect(seller.since, seller.slug).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      expect(seller.since <= "2026-10", seller.slug).toBe(true);
      expect(categories.find((category) => category.slug === seller.categorySlug)?.name, seller.slug).toBe(
        seller.category,
      );
    }
  });

  it("gives every listing its seller's name", () => {
    for (const listing of listings) {
      expect(listing.sellerName, listing.id).toBe(sellersBySlug.get(listing.sellerSlug)?.name);
    }
  });

  it("gives every listing its seller's trust badge", () => {
    for (const listing of listings) {
      expect(listing.badge, listing.id).toBe(sellersBySlug.get(listing.sellerSlug)?.badge);
    }
  });

  it("has a seller with nothing available, so the storefront's empty state can be tested", () => {
    const selling = new Set(
      listings.filter((listing) => listing.availability === "available").map((listing) => listing.sellerSlug),
    );
    expect(sellers.filter((seller) => !selling.has(seller.slug)).map((seller) => seller.slug)).toContain("lash-lounge");
  });

  it("builds every collection from known categories, with an intro", () => {
    for (const collection of collections) {
      expect(collection.intro.length, collection.slug).toBeGreaterThan(0);
      expect(collection.rule.categories.length, collection.slug).toBeGreaterThan(0);
      for (const slug of collection.rule.categories) expect(categorySlugs.has(slug), collection.slug).toBe(true);
    }
  });
});

describe("Looking For fixtures (community spec 4.3)", () => {
  const ISO_UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

  it("keeps the homepage's seven requests as they were", () => {
    expect(requests.slice(0, 7).map(({ id, title, campusSlug, offers }) => ({ id, title, campusSlug, offers }))).toEqual([
      { id: "r-001", title: "Accounting 1 tutor this week", campusSlug: "midrand", offers: 2 },
      { id: "r-002", title: "Graphic calculator to borrow for exams", campusSlug: "pretoria", offers: 1 },
      { id: "r-003", title: "Birthday cake for Friday", campusSlug: "midrand", offers: 3 },
      { id: "r-004", title: "Second-hand bar fridge", campusSlug: "bedfordview", offers: 0 },
      { id: "r-005", title: "Someone to fix my laptop hinge", campusSlug: "cape-town-mowbray", offers: 1 },
      { id: "r-006", title: "Lift to campus on Monday mornings", campusSlug: "pretoria", offers: 2 },
      { id: "r-007", title: "Business Law 2 notes", campusSlug: "online", offers: 4 },
    ]);
  });

  it("gives every request a unique id, a known category, real times, a budget that makes sense and details", () => {
    expect(isUnique(requests.map((request) => request.id))).toBe(true);
    for (const request of requests) {
      expect(request.id).toMatch(/^r-\d{3}$/);
      expect(categorySlugs.has(request.categorySlug), request.id).toBe(true);
      expect(request.createdAt, request.id).toMatch(ISO_UTC);
      expect(Number.isNaN(Date.parse(request.createdAt)), request.id).toBe(false);
      if (request.neededBy !== null) expect(request.neededBy, request.id).toMatch(/^\d{4}-\d\d-\d\d$/);
      if (request.budgetZar !== null) expect(request.budgetZar, request.id).toBeGreaterThan(0);
      expect(request.details.trim().length, request.id).toBeGreaterThan(0);
      expect(request.offers, request.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("lists requests newest first", () => {
    const times = requests.map((request) => request.createdAt);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("has an open request at every campus but Mbombela, so its empty state can be tested", () => {
    const stillOpen = requests.filter((request) => request.status === "open");
    const withOpen = new Set(stillOpen.map((request) => request.campusSlug));
    expect(campuses.filter((campus) => !withOpen.has(campus.slug)).map((campus) => campus.slug)).toEqual(["mbombela"]);
  });

  it("has closed, open-to-offers and swap requests, and a category with nothing open, to test those states", () => {
    expect(requests.some((request) => request.status === "closed")).toBe(true);
    expect(requests.some((request) => request.budgetZar === null)).toBe(true);
    expect(requests.some((request) => request.swapWelcome)).toBe(true);
    const openCategories = new Set(
      requests.filter((request) => request.status === "open").map((request) => request.categorySlug),
    );
    expect(openCategories.has("tickets-events")).toBe(false);
  });
});

describe("Hub fixtures (community spec 5.3)", () => {
  const ISO_UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

  it("gives every post a unique id, a known campus, a real time, its own cover and a body of the allowed length", () => {
    expect(isUnique(hubPosts.map((post) => post.id))).toBe(true);
    for (const post of hubPosts) {
      expect(post.id).toMatch(/^h-\d{3}$/);
      expect(post.campusSlug === "all" || campusSlugs.has(post.campusSlug), post.id).toBe(true);
      expect(post.publishedAt, post.id).toMatch(ISO_UTC);
      expect(post.title.length, post.id).toBeLessThanOrEqual(70);
      expect(post.summary.length, post.id).toBeGreaterThan(0);
      expect(post.body.length, post.id).toBeLessThanOrEqual(4000);
      expect(post.image).toEqual({ src: `/stock/hub/${post.id}.jpg`, alt: "" });
    }
    expect(hubBanner.image.src).toBe("/stock/hub/banner.jpg");
  });

  it("times events at 18:00 and office hours at 13:00 in South Africa, after they were posted", () => {
    for (const post of hubPosts) {
      if (post.startsAt === null) continue;
      expect(post.startsAt, post.id).toMatch(ISO_UTC);
      expect(sastDateTime(post.startsAt).endsWith(post.kind === "event" ? "· 18:00" : "· 13:00"), post.id).toBe(true);
      expect(post.publishedAt < post.startsAt, post.id).toBe(true);
      expect(post.place?.length, post.id).toBeGreaterThan(0);
    }
  });

  it("gives tips no time or place, and only events their places and RSVPs", () => {
    for (const post of hubPosts) {
      const tip = post.kind === "tip";
      expect(post.startsAt === null, post.id).toBe(tip);
      expect(post.place === null, post.id).toBe(tip);
      if (tip) expect(post.campusSlug, post.id).toBe("all");
      expect(post.capacity !== null && post.going !== null, post.id).toBe(post.kind === "event");
      if (post.capacity !== null && post.going !== null) expect(post.going, post.id).toBeLessThanOrEqual(post.capacity);
    }
  });

  it("has at least five tips, and a past event and past office hours, so 'has passed' can be tested on any date", () => {
    expect(hubPosts.filter((post) => post.kind === "tip").length).toBeGreaterThanOrEqual(5);
    const past = hubPosts.filter((post) => post.startsAt !== null && post.startsAt < "2026-10-01");
    expect(new Set(past.map((post) => post.kind))).toEqual(new Set(["event", "office-hours"]));
  });

  it("links only inside the site from its bodies, so the renderer drops none of the sample links", () => {
    for (const post of hubPosts) {
      for (const [, href] of post.body.matchAll(/\]\(([^)]*)\)/g)) {
        expect(safeNextPath(href), `${post.id} ${href}`).toBe(href);
      }
    }
  });
});
