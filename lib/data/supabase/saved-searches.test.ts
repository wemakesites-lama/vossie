import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/tests/helpers/fake-supabase";
import { exportSavedSearches, getSaveSearchState, listSavedSearches } from "./saved-searches";

// An account's own saved searches on Supabase (the C5 batch's extra item, as C4 review fix 3 did for follows): the
// read names the account as well as relying on the saved_searches policy, so another account's search can never come
// back, even if a policy were ever widened.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
const seam = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("./clients", () => ({ forViewer: async () => seam.viewer, forPublic: () => seam.viewer, forServer: () => seam.viewer }));
vi.mock("./viewer", () => ({ forViewerAs: async () => seam.viewer }));

const ACCOUNT = "00000000-0000-4000-8000-0000000000a1";

let db: ReturnType<typeof fakeSupabase>;
beforeEach(() => {
  db = fakeSupabase();
  seam.viewer = db.client;
});

describe("an account's saved searches are read by its own id (defence in depth)", () => {
  const ownOnly = () => expect(db.calls).toContainEqual(["eq", "account_id", ACCOUNT]);

  it("lists them", async () => {
    db.answer("from:saved_searches", { data: [] });
    expect(await listSavedSearches(ACCOUNT)).toEqual([]);
    ownOnly();
  });

  it("says whether this one is saved", async () => {
    db.answer("from:saved_searches", { data: [] });
    await getSaveSearchState(ACCOUNT, { q: "kettle", category: null, campus: "all", price: null, pay: null, deals: null });
    ownOnly();
  });

  it("downloads them", async () => {
    db.answer("from:saved_searches", { data: [] });
    expect(await exportSavedSearches(ACCOUNT)).toEqual([]);
    ownOnly();
  });
});
