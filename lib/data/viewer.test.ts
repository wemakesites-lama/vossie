import { afterEach, describe, expect, it, vi } from "vitest";
import { getViewerContext } from "./viewer";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));
const campusLookup = vi.hoisted(() => ({ failing: false }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "vossie_campus" && cookieValue.current ? { value: cookieValue.current } : undefined),
  }),
}));

// Every test but one keeps the real getCampuses; the failing switch makes it reject.
vi.mock("./index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./index")>();
  return {
    ...actual,
    getCampuses: async () => {
      if (campusLookup.failing) throw new Error("The campuses didn't load");
      return actual.getCampuses();
    },
  };
});

afterEach(() => {
  cookieValue.current = undefined;
  campusLookup.failing = false;
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

  it("falls back to all campuses when the campus lookup fails, instead of failing every section", async () => {
    campusLookup.failing = true;
    cookieValue.current = "midrand";
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
