import { describe, expect, it } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { getHubEvents, getHubPost, getHubPostIds, getHubPosts, getListedHubPostIds } from "@/lib/data";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { HubPostKind } from "@/lib/types";
import { normalise, parity } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { hubContract } from "./hub.contract";

// The Hub's public posts on the local stack (2b plan Task 16): the behaviour contract, and every public reader giving
// the sample store's answer on the seed.

describe("the Hub's posts on the local stack (2b plan Task 16)", () => {
  hubContract(supabaseWorld);
});

async function same<T>(read: () => Promise<T>): Promise<void> {
  const { sample, supabase } = await parity(read);
  expect(normalise(supabase)).toEqual(normalise(sample));
}

async function sameSet(read: () => Promise<readonly string[]>): Promise<void> {
  const { sample, supabase } = await parity(read);
  expect(new Set(supabase)).toEqual(new Set(sample));
  expect(supabase).toHaveLength(sample.length);
}

const KIND_SETS: readonly (readonly HubPostKind[])[] = [
  ["event", "office-hours", "tip"],
  ["event"],
  ["office-hours"],
  ["tip"],
  ["event", "office-hours"],
];
/** Before every sample event, and after some have passed. */
const DAYS = ["2026-09-01", "2026-10-21"];

describe("the Hub's readers give the sample store's answers on the seed (2b plan Task 16)", () => {
  it("the feed, for each set of kinds, from two days", async () => {
    for (const kinds of KIND_SETS) for (const from of DAYS) await same(() => getHubPosts({ kinds, from }));
  });

  it("the homepage's events, everywhere and at each campus", async () => {
    for (const from of DAYS) {
      await same(() => getHubEvents({ campus: "all", limit: 10, from }));
      for (const campus of campuses) await same(() => getHubEvents({ campus: campus.slug, limit: 4, from }));
    }
  });

  it("every post's page", async () => {
    resetSampleStore();
    const ids = [...sampleStore().hubPosts.keys(), "no-such-post"];
    for (const id of ids) await same(() => getHubPost(id));
  });

  it("the ids to prerender, and the sitemap's from two days", async () => {
    await sameSet(() => getHubPostIds());
    for (const today of DAYS) await sameSet(() => getListedHubPostIds({ today }));
  });
});
