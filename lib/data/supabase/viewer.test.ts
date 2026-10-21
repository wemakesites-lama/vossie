import { beforeEach, describe, expect, it, vi } from "vitest";
import { forViewerAs } from "./viewer";

// forViewerAs (C2/C3 plan decision 2; 2b plan decision 20): a twin never trusts an account id over the session. It lives
// in its own module so the database tests' vi.mock of clients.ts reaches the forViewer() and viewerId() it calls.

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ viewer: "u-1" as string | null, client: { a: "client" } }));

vi.mock("./clients", () => ({
  forViewer: async () => {
    if (state.viewer === null) throw new Error("forViewer() needs a signed-in session");
    return state.client;
  },
  viewerId: async () => {
    if (state.viewer === null) throw new Error("viewerId() needs a signed-in session");
    return state.viewer;
  },
}));

beforeEach(() => {
  state.viewer = "u-1";
});

describe("forViewerAs (C2/C3 plan decision 2)", () => {
  it("is the viewer's client when the account is the signed-in one", async () => {
    expect(await forViewerAs("u-1")).toBe(state.client);
  });

  it("throws for any other account", async () => {
    await expect(forViewerAs("u-2")).rejects.toThrow("isn't the signed-in one");
  });

  it("and when nobody is signed in", async () => {
    state.viewer = null;
    await expect(forViewerAs("u-1")).rejects.toThrow("signed-in session");
  });
});
