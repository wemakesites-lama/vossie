import { afterEach, describe, expect, it, vi } from "vitest";
import type { ViewerActivity } from "@/lib/types";
import { getViewerContext } from "./viewer";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));
const campusLookup = vi.hoisted(() => ({ failing: false }));
const session = vi.hoisted(() => ({
  accountId: null as string | null,
  failing: false,
  activity: null as ViewerActivity | null,
}));

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

vi.mock("@/lib/auth/session", () => ({
  getViewer: async () => {
    if (session.failing) throw new Error("The session store didn't answer");
    return session.accountId ? { id: session.accountId } : null;
  },
}));

vi.mock("./accounts", () => ({
  getAccountActivity: async () => session.activity ?? { newMessages: 0, salesToConfirm: 0, savedItemsBack: 0 },
}));

afterEach(() => {
  cookieValue.current = undefined;
  campusLookup.failing = false;
  session.accountId = null;
  session.failing = false;
  session.activity = null;
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

  it("is signed in when the session says so, with no strip activity while every number is zero (accounts spec 3.4)", async () => {
    session.accountId = "acc-student";
    expect(await getViewerContext()).toEqual({ campus: "all", signedIn: true, activity: null });
  });

  it("passes the account's activity on when there is some", async () => {
    session.accountId = "acc-student";
    session.activity = { newMessages: 2, salesToConfirm: 0, savedItemsBack: 0 };
    expect((await getViewerContext()).activity).toEqual({ newMessages: 2, salesToConfirm: 0, savedItemsBack: 0 });
  });

  it("counts a failed session lookup as signed out, instead of failing every section", async () => {
    session.failing = true;
    cookieValue.current = "midrand";
    expect(await getViewerContext()).toEqual({ campus: "midrand", signedIn: false, activity: null });
  });

  it("has no development switch any more (accounts spec 2.9)", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_SIGNED_IN", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect((await getViewerContext()).signedIn).toBe(false);
  });
});
