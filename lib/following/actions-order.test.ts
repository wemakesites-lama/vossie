import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form } from "@/tests/helpers/staff";

// Unfollow names the shop before the follow goes (C4/C5 plan Task 7): on Supabase a follower reads a shop the Hub has
// paused only while they follow it (the shops policy's follower clause), so a name read afterwards would be "the
// shop". lib/data/follows is a stand-in that answers as Supabase's access rules do.

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

const store = vi.hoisted(() => ({ following: true, states: [] as { form: string; values: Record<string, string> }[] }));
vi.mock("@/lib/auth/session", () => ({ requireAccount: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/auth/form-state", () => ({
  writeFormState: async (form: string, state: { values: Record<string, string> }) => {
    store.states.push({ form, values: state.values });
  },
}));
vi.mock("@/lib/data/follows", () => ({
  addFollow: async () => "followed",
  // A Hub-paused shop: named only while it's followed.
  shopNameOf: async () => (store.following ? "Contract lamps" : null),
  removeFollow: async () => {
    const was = store.following;
    store.following = false;
    return was;
  },
}));

const { unfollowShop } = await import("./actions");

beforeEach(() => {
  resetRequest(request);
  store.following = true;
  store.states.length = 0;
});

describe("Unfollow a shop the Hub has paused (C4/C5 plan Task 7)", () => {
  it("names it in the status line, read before the follow goes", async () => {
    expect(await redirectOf(() => unfollowShop(form({ shop: "contract-lamps", from: "saved" })))).toBe("/saved?tab=shops");
    expect(store.states).toEqual([{ form: "saved-shops", values: { shop: "Contract lamps" } }]);
  });

  it("and says nothing when there was no follow to remove", async () => {
    store.following = false;
    await redirectOf(() => unfollowShop(form({ shop: "contract-lamps", from: "saved" })));
    expect(store.states).toEqual([]);
  });
});
