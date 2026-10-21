import { describe, expect, it } from "vitest";
import { categories } from "@/data/fixtures/categories";
import { getListedRequestIds, getOpenRequests, getRequest, getRequestIds, getRequests } from "@/lib/data";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { sastDate } from "@/lib/time";
import { normalise, parity } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { requestsContract } from "./requests.contract";

// Looking For requests on the local stack (2b plan Task 17): the behaviour contract, and every public reader giving
// the sample store's answer on the seed.

describe("Looking For requests on the local stack (2b plan Task 17)", () => {
  requestsContract(supabaseWorld);
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

const today = sastDate(new Date());

describe("the request readers give the sample store's answers on the seed (2b plan Task 17)", () => {
  it("the board, in every category and in each", async () => {
    await same(() => getOpenRequests({ category: null, today }));
    for (const category of categories) await same(() => getOpenRequests({ category: category.slug, today }));
  });

  it("the homepage's, everywhere and at a campus", async () => {
    await same(() => getRequests({ campus: "all", limit: 6, today }));
    await same(() => getRequests({ campus: "pretoria", limit: 6, today }));
    await same(() => getRequests({ campus: "midrand", limit: 1_000, today }));
  });

  it("every request's page", async () => {
    resetSampleStore();
    for (const id of [...sampleStore().requests.keys(), "no-such-request"]) await same(() => getRequest(id));
  });

  it("the ids to prerender and the sitemap's", async () => {
    await sameSet(() => getRequestIds());
    await sameSet(() => getListedRequestIds({ today }));
  });
});
