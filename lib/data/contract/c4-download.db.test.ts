import { afterEach, describe, expect, it, vi } from "vitest";
import { exportFollowing } from "@/lib/data/follows";
import { exportRequests } from "@/lib/data/requests";
import { exportSavedSearches } from "@/lib/data/saved-searches";
import { sampleWorld } from "@/tests/contract/sample-world";
import type { World } from "@/tests/contract/world";
import { supabaseWorld } from "@/tests/db/supabase-world";

// C4's part of Download your data on both backends (C4/C5 plan Task 9; decision 16): the asker's requests, the shops
// they follow and their saved searches come out of the Supabase twins with the same shapes, key order and values as the
// sample store's (accounts.test.ts's order check, run on the twins), and nothing in them names an id.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

const worlds: World[] = [];
afterEach(async () => {
  vi.stubEnv("VOSSIE_BACKEND", "supabase");
  for (const world of worlds.splice(0)) await world.cleanup();
});

/** The same story on one backend: a request, a follow and a saved search; the three exports and the ids they mustn't name. */
async function download(backend: "sample" | "supabase") {
  vi.stubEnv("VOSSIE_BACKEND", backend);
  const world = backend === "sample" ? sampleWorld() : supabaseWorld();
  worlds.push(world);
  await world.tidyCommunity();
  await world.tidySelling("shopper");
  const asker = await world.signedIn("asker");
  const request = await world.addRequest({ asker: "asker", title: "A contract desk lamp", neededBy: null });
  const slug = await world.openShop("shopper", { name: "Contract lamps" });
  await world.follow("asker", slug);
  const search = await world.saveSearch("asker", { q: "calculator", campus: "pretoria", price: "under-100" });
  const exports = await world.asViewer("asker", async (id) => ({
    requests: await exportRequests(id),
    following: await exportFollowing(id),
    savedSearches: await exportSavedSearches(id),
  }));
  return { exports, ids: [asker, request, search] };
}

/** Times differ between the runs; everything else must not. */
const withoutTimes = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (key, item) => (key === "postedAt" || key === "savedAt" ? "<time>" : item)));

describe("C4's part of the download on both backends (C4/C5 plan Task 9)", () => {
  it("gives the same shapes, key order and values, and names no id", async () => {
    const sample = await download("sample");
    const supabase = await download("supabase");
    for (const part of ["requests", "savedSearches"] as const) {
      expect(supabase.exports[part]).toHaveLength(1);
      expect(Object.keys(supabase.exports[part][0])).toEqual(Object.keys(sample.exports[part][0]));
    }
    expect(withoutTimes(supabase.exports)).toEqual(withoutTimes(sample.exports));
    expect(supabase.exports.following).toEqual(["Contract lamps"]);
    for (const { exports, ids } of [sample, supabase]) {
      const text = JSON.stringify(exports);
      for (const id of ids) expect(text).not.toContain(id);
    }
  });
});
