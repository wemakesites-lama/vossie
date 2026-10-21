import { describe, expect, it } from "vitest";
import { collections } from "@/data/fixtures/collections";
import { sellers } from "@/data/fixtures/sellers";
import {
  getCollectionListings,
  getFreeAndSwaps,
  getJustListed,
  getListingDetail,
  getListingIds,
  getListingsByIds,
  getMoreFrom,
  getRelatedListings,
  getSeller,
  getSellerListings,
  getSellerSlugs,
  getVerifiedSellers,
  searchListings,
} from "@/lib/data";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { SearchQuery } from "@/lib/types";
import { normalise, parity } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { catalogContract } from "./catalog.contract";

// The catalog on the local stack (2b plan Task 15): the behaviour contract, and every public reader giving the sample
// store's answer on the seed. Readers that keep the store's order without sorting (the ids and slugs) compare as sets.

describe("the catalog on the local stack (2b plan Task 15)", () => {
  catalogContract(supabaseWorld);
});

/** The sample store's listing ids and shop slugs, every one, whatever its state. */
function sampleIds(): { listings: string[]; shops: string[] } {
  resetSampleStore();
  const store = sampleStore();
  return { listings: [...store.listings.keys()], shops: [...store.sellers.keys()] };
}

async function same<T>(read: () => Promise<T>): Promise<void> {
  const { sample, supabase } = await parity(read);
  expect(normalise(supabase)).toEqual(normalise(sample));
}

async function sameSet(read: () => Promise<readonly string[]>): Promise<void> {
  const { sample, supabase } = await parity(read);
  expect(new Set(normalise(supabase))).toEqual(new Set(normalise(sample)));
  expect(supabase).toHaveLength(sample.length);
}

const EVERYTHING: SearchQuery = { q: null, category: null, campus: "all", price: null, pay: null, deals: null, sort: "new" };

describe("the catalog's readers give the sample store's answers on the seed (2b plan Task 15)", () => {
  it("Just listed, everywhere and at one campus", async () => {
    await same(() => getJustListed({ campus: "all", limit: 12 }));
    await same(() => getJustListed({ campus: "pretoria", limit: 6 }));
    await same(() => getJustListed({ campus: "midrand", limit: 1_000 }));
  });

  it("every collection", async () => {
    for (const collection of collections) await same(() => getCollectionListings(collection.slug));
  });

  it("Free & swaps and Already on Vossie", async () => {
    await same(() => getFreeAndSwaps({ campus: "all", limit: 8 }));
    await same(() => getFreeAndSwaps({ campus: "midrand", limit: 8 }));
    await same(() => getRelatedListings({ categorySlug: "tech", campusSlug: "pretoria", limit: 4 }));
    await same(() => getRelatedListings({ categorySlug: "textbooks-notes", campusSlug: "midrand", limit: 4 }));
  });

  it("search: words, a category with a price, a campus", async () => {
    await same(() => searchListings({ ...EVERYTHING, q: "calculator", sort: "match" }));
    await same(() => searchListings({ ...EVERYTHING, category: "textbooks-notes", price: "under-250", sort: "price-low" }));
    await same(() => searchListings({ ...EVERYTHING, campus: "midrand" }));
  });

  it("every listing's page and its More from row", async () => {
    for (const id of sampleIds().listings) {
      await same(() => getListingDetail(id));
      const { sample } = await parity(() => getListingDetail(id));
      if (sample) await same(() => getMoreFrom(sample.listing, 4));
    }
  });

  it("every shop's storefront and its listings", async () => {
    for (const slug of sampleIds().shops) {
      await same(() => getSeller(slug));
      await same(() => getSellerListings(slug));
    }
  });

  it("the ids and slugs to prerender, and the Hub's Verified sellers", async () => {
    await sameSet(() => getListingIds());
    await sameSet(() => getSellerSlugs());
    await same(() => getVerifiedSellers());
    expect(sellers.length).toBeGreaterThan(0);
  });

  it("the Saved page's listings, in the order given, an unknown id dropped", async () => {
    await same(() => getListingsByIds(["l-003", "no-such-listing", "l-001", "fs-002"]));
  });
});
