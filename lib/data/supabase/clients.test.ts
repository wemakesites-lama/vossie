import { beforeEach, describe, expect, it, vi } from "vitest";
import { forViewer } from "./clients";

// forViewer() (phase B, Task 4; amendments 3 and 4): the signed-in person's client, from their verified access token,
// with nothing kept or refreshed, so a page read never refreshes the session (only the proxy does).

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  session: null as null | { userId: string; sessionId: string; email: string; accessToken: string },
  tokenClient: vi.fn((token: string) => ({ token })),
}));

vi.mock("./auth-session", () => ({ viewerSession: async () => state.session }));
vi.mock("@/lib/supabase/viewer", () => ({ tokenClient: state.tokenClient }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({}) }));
vi.mock("@/lib/supabase/public", () => ({ publicClient: () => ({}) }));

beforeEach(() => {
  state.session = null;
  state.tokenClient.mockClear();
});

describe("forViewer (phase B)", () => {
  it("rejects when nobody is signed in", async () => {
    await expect(forViewer()).rejects.toThrow("signed-in");
    expect(state.tokenClient).not.toHaveBeenCalled();
  });

  it("is a client carrying the session's verified access token", async () => {
    state.session = { userId: "u", sessionId: "s", email: "e@vossie.net", accessToken: "eyJ.access.token" };
    expect(await forViewer()).toEqual({ token: "eyJ.access.token" });
    expect(state.tokenClient).toHaveBeenCalledWith("eyJ.access.token");
  });
});
