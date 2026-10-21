import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { resetSupabaseFakes, supabaseAccount, type SupabaseFakes } from "@/tests/helpers/supabase-auth-fakes";
import { SESSION_COOKIE } from "./cookies";
import { hashToken } from "./secrets";
import { endSession, getSessionKey, getViewer, requireAccount, requireLiveAccount } from "./session";

// Who is signed in on Supabase (Supabase phase B, Task 5; decision 7, amendments 3 and 11). Supabase is replaced by
// tests/helpers/supabase-auth-fakes.ts; the sample paths' own tests are in session.test.ts.

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
const supabase = vi.hoisted(() => ({}) as SupabaseFakes);

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("@/lib/data/auth-session", async () => (await import("@/tests/helpers/supabase-auth-fakes")).authSessionModule(supabase));
vi.mock("@/lib/data/supabase/accounts", async () => (await import("@/tests/helpers/supabase-auth-fakes")).accountsTwin(supabase));
vi.mock("@/lib/data/supabase/form-states", async () => (await import("@/tests/helpers/supabase-auth-fakes")).formStatesTwin(supabase));

const NOW = new Date("2026-10-21T08:42:00.000Z");
const CLAIMS = { userId: "user-1", sessionId: "session-1", email: "thandi@vossie.net" };

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  resetSupabaseFakes(supabase);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("VOSSIE_BACKEND", "supabase");
  vi.stubEnv("VOSSIE_AUTH_HMAC_KEY", "k".repeat(43) + "=");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the session key on Supabase", () => {
  it("is the verified session's id, or null with no session", async () => {
    expect(await getSessionKey()).toBeNull();
    supabase.claims = CLAIMS;
    expect(await getSessionKey()).toBe("session-1");
  });
});

describe("getViewer on Supabase (decision 7)", () => {
  it("is the account the verified claims name, its roles from the profile", async () => {
    supabase.claims = CLAIMS;
    supabase.profiles.set("user-1", supabaseAccount("user-1", "thandi@vossie.net", { roles: ["mentor"] }));
    expect(await getViewer()).toMatchObject({ id: "user-1", email: "thandi@vossie.net", roles: ["mentor"] });
  });

  it("is null with no claims, and never reads vossie_session", async () => {
    // A sample session in the store and its cookie in the browser, as a preview left them.
    vi.stubEnv("VOSSIE_BACKEND", "sample");
    await createSession({ key: hashToken("token-1"), accountId: "acc-student", createdAt: NOW, expiresAt: new Date("2026-11-20T00:00:00Z") });
    request.cookies.set(SESSION_COOKIE, "token-1");
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    expect(await getViewer()).toBeNull();
  });

  it("is null with claims but no profile: a student between steps 2 and 3 is signed out (amendment 11)", async () => {
    supabase.claims = CLAIMS;
    expect(await getViewer()).toBeNull();
    expect(await redirectOf(() => requireAccount("/account"))).toBe("/login?next=%2Faccount");
  });

  it("reads the profile on every request, so a role taken away is gone at once (spec 4.3)", async () => {
    supabase.claims = CLAIMS;
    supabase.profiles.set("user-1", supabaseAccount("user-1", "thandi@vossie.net", { roles: ["admin"] }));
    expect((await getViewer())?.roles).toEqual(["admin"]);
    supabase.profiles.set("user-1", supabaseAccount("user-1", "thandi@vossie.net", { roles: [] }));
    expect((await getViewer())?.roles).toEqual([]);
  });
});

describe("requireLiveAccount (spec 5)", () => {
  beforeEach(() => {
    supabase.claims = CLAIMS;
    supabase.profiles.set("user-1", supabaseAccount("user-1", "thandi@vossie.net"));
  });

  it("gives the account when Supabase Auth still knows the session", async () => {
    supabase.liveUserId = "user-1";
    expect((await requireLiveAccount("/account/privacy")).id).toBe("user-1");
  });

  it("sends to sign-in when the session was ended elsewhere, even though the token still reads", async () => {
    expect(await redirectOf(() => requireLiveAccount("/account/privacy"))).toBe("/login?next=%2Faccount%2Fprivacy");
    supabase.liveUserId = "someone-else";
    expect(await redirectOf(() => requireLiveAccount("/account/privacy"))).toBe("/login?next=%2Faccount%2Fprivacy");
  });

  it("asks nothing of Supabase in sample mode", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "sample");
    await createSession({ key: hashToken("token-1"), accountId: "acc-student", createdAt: NOW, expiresAt: new Date("2026-11-20T00:00:00Z") });
    request.cookies.set(SESSION_COOKIE, "token-1");
    expect((await requireLiveAccount("/account")).id).toBe("acc-student");
    expect(supabase.calls).not.toContain("liveUserId");
  });
});

describe("signing out on Supabase (spec 5)", () => {
  it("clears this session's form states, then signs out here", async () => {
    supabase.claims = CLAIMS;
    await endSession();
    expect(supabase.calls.filter((call) => call !== "currentClaims")).toEqual(["clearSessionFormStates:session-1", "signOutHere"]);
  });

  it("still clears the cookie, and throws nothing, when Supabase can't be reached", async () => {
    supabase.claims = CLAIMS;
    supabase.signOutRejects = true;
    await expect(endSession()).resolves.toBeUndefined();
    expect(supabase.calls).toContain("clearAuthCookies");
  });

  it("signs out a browser with no session too, touching no sample cookie", async () => {
    await endSession();
    expect(supabase.calls).toContain("signOutHere");
    expect(request.sent.has(SESSION_COOKIE)).toBe(false);
  });
});
