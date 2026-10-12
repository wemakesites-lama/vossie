import { afterEach, describe, expect, it, vi } from "vitest";
import { getViewerContext } from "./viewer";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "vossie_campus" && cookieValue.current ? { value: cookieValue.current } : undefined),
  }),
}));

afterEach(() => {
  cookieValue.current = undefined;
  vi.unstubAllEnvs();
});

describe("getViewerContext", () => {
  it("reads the chosen campus from the cookie", async () => {
    cookieValue.current = "midrand";
    expect(await getViewerContext()).toEqual({ campus: "midrand", signedIn: false, activity: null });
  });

  it("treats a missing or unknown campus as all campuses", async () => {
    expect((await getViewerContext()).campus).toBe("all");
    cookieValue.current = "atlantis";
    expect((await getViewerContext()).campus).toBe("all");
  });

  it("shows sample activity only behind the development switch", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_SIGNED_IN", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(await getViewerContext()).toMatchObject({ signedIn: true, activity: { newMessages: 2 } });
    vi.stubEnv("NODE_ENV", "production");
    expect((await getViewerContext()).signedIn).toBe(false);
  });
});
