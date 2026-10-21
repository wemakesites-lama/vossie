import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthCookies,
  currentClaims,
  liveUserId,
  readClaims,
  sendSignInCode,
  signOutHere,
  verifySignInCode,
  viewerSession,
} from "./auth-session";

// The auth session on Supabase (phase B, Task 4; amendments 3, 4, 5 and 12). The sign-in client, the public client and
// Next's cookies are replaced, so nothing reaches a network except where a test says (an expired token, checked by a
// real supabase-js client whose fetch is a spy).

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  getClaims: vi.fn(),
  getUser: vi.fn(),
  publicClient: null as unknown,
  auth: {
    sendSignInCode: vi.fn(),
    verifySignInCode: vi.fn(),
    signOutHere: vi.fn(),
  },
  clearHere: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (state.cookies.has(name) ? { name, value: state.cookies.get(name)! } : undefined),
    getAll: () => [...state.cookies].map(([name, value]) => ({ name, value })),
  }),
}));
vi.mock("./clients", () => ({
  forPublic: () => state.publicClient ?? { auth: { getClaims: state.getClaims, getUser: state.getUser } },
}));
vi.mock("@/lib/supabase/auth", () => ({
  authClient: async () => state.auth,
  clearHere: state.clearHere,
}));

/** A cookie value as @supabase/ssr writes it. */
const stored = (session: unknown) => `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
const CLAIMS = { sub: "user-1", session_id: "session-1", email: "Thandi@Vossie.net", role: "authenticated" };

beforeEach(() => {
  vi.clearAllMocks();
  state.cookies.clear();
  state.publicClient = null;
  state.clearHere.mockResolvedValue(undefined);
});

function signedInCookie(token = "eyJ.access.token") {
  state.cookies.set("vossie_auth", stored({ access_token: token, refresh_token: "refresh-1" }));
}

describe("who the session says this is (phase B, Task 4; amendment 3)", () => {
  it("is null with no cookie, and asks nobody", async () => {
    expect(await currentClaims()).toBeNull();
    expect(await readClaims()).toBeNull();
    expect(state.getClaims).not.toHaveBeenCalled();
  });

  it("checks the stored access token's signature and expiry, and gives the account, the session and the address", async () => {
    signedInCookie();
    state.getClaims.mockResolvedValue({ data: { claims: CLAIMS }, error: null });
    expect(await currentClaims()).toEqual({ userId: "user-1", sessionId: "session-1", email: "thandi@vossie.net" });
    expect(await readClaims()).toEqual({ userId: "user-1", sessionId: "session-1", email: "thandi@vossie.net" });
    expect(state.getClaims).toHaveBeenCalledWith("eyJ.access.token");
    expect(await viewerSession()).toEqual({
      userId: "user-1",
      sessionId: "session-1",
      email: "thandi@vossie.net",
      accessToken: "eyJ.access.token",
    });
  });

  it("is null when Supabase refuses, throws, or the claims lack the account, the session or the address", async () => {
    signedInCookie();
    state.getClaims.mockResolvedValueOnce({ data: null, error: { code: "bad_jwt", status: 401 } });
    expect(await readClaims()).toBeNull();
    state.getClaims.mockRejectedValueOnce(new Error("network"));
    expect(await readClaims()).toBeNull();
    for (const missing of ["sub", "session_id", "email"]) {
      const claims: Record<string, unknown> = { ...CLAIMS };
      delete claims[missing];
      state.getClaims.mockResolvedValueOnce({ data: { claims }, error: null });
      expect(await readClaims(), missing).toBeNull();
    }
    state.getClaims.mockResolvedValueOnce({ data: { claims: { ...CLAIMS, sub: 42 } }, error: null });
    expect(await readClaims()).toBeNull();
  });

  it("never refreshes: an expired access token is signed out, with no request to Auth's /token (amendment 3)", async () => {
    const fetch = vi.fn(async (url: RequestInfo | URL) => (void url, new Response("{}", { status: 500 })));
    state.publicClient = createClient("http://127.0.0.1:55321", "sb_publishable_TESTVALUEtestvalue", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch },
    });
    const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const expired = `${part({ alg: "ES256", kid: "key-1", typ: "JWT" })}.${part({ ...CLAIMS, exp: 1_700_000_000 })}.c2ln`;
    signedInCookie(expired);
    expect(await currentClaims()).toBeNull();
    expect(fetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/token"))).toEqual([]);
  });
});

describe("the live re-check (spec 5)", () => {
  it("asks Auth whether the session's user still stands, without refreshing", async () => {
    signedInCookie();
    state.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    expect(await liveUserId()).toBe("user-1");
    expect(state.getUser).toHaveBeenCalledWith("eyJ.access.token");
    state.getUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "session_not_found", status: 403 } });
    expect(await liveUserId()).toBeNull();
    state.getUser.mockRejectedValueOnce(new Error("network"));
    expect(await liveUserId()).toBeNull();
  });

  it("is null with no session cookie", async () => {
    expect(await liveUserId()).toBeNull();
    expect(state.getUser).not.toHaveBeenCalled();
  });
});

describe("sending a code: Auth's refusals, by code and status only (Task 4's table; amendment 5)", () => {
  const cases: [string, unknown, string][] = [
    ["sent", { ok: true }, "sent"],
    ["the per-address minute", { ok: false, code: "over_email_send_rate_limit", status: 429, tooSoon: true }, "too-soon"],
    ["the project's hourly email cap", { ok: false, code: "over_email_send_rate_limit", status: 429 }, "failed"],
    ["the per-address request limit", { ok: false, code: "over_request_rate_limit", status: 429 }, "ip-rate"],
    ["the domain hook", { ok: false, code: "unknown", status: 403 }, "refused"],
    ["an address Auth won't send to", { ok: false, code: "email_address_not_authorized", status: 400 }, "refused"],
    ["anything else, an SMTP failure included", { ok: false, code: "unexpected_failure", status: 500 }, "failed"],
  ];
  for (const [what, answer, outcome] of cases) {
    it(`${what} → ${outcome}`, async () => {
      state.auth.sendSignInCode.mockResolvedValueOnce(answer);
      expect(await sendSignInCode("thandi@vossie.net")).toBe(outcome);
      expect(state.auth.sendSignInCode).toHaveBeenCalledWith("thandi@vossie.net");
    });
  }
});

describe("checking a code (Task 4's table)", () => {
  const cases: [string, unknown, unknown][] = [
    ["right", { ok: true, userId: "user-1" }, { ok: true, userId: "user-1" }],
    ["wrong or expired", { ok: false, code: "otp_expired", status: 403 }, "wrong"],
    ["the per-address limit", { ok: false, code: "over_request_rate_limit", status: 429 }, "ip-rate"],
    ["anything else", { ok: false, code: "unexpected_failure", status: 500 }, "failed"],
  ];
  for (const [what, answer, outcome] of cases) {
    it(`${what} → ${JSON.stringify(outcome)}`, async () => {
      state.auth.verifySignInCode.mockResolvedValueOnce(answer);
      expect(await verifySignInCode("thandi@vossie.net", "123456")).toEqual(outcome);
      expect(state.auth.verifySignInCode).toHaveBeenCalledWith("thandi@vossie.net", "123456");
    });
  }
});

describe("signing out here (spec 5)", () => {
  it("ends this browser's session with Supabase, then clears the cookie", async () => {
    state.auth.signOutHere.mockResolvedValueOnce({ ok: true });
    await signOutHere();
    expect(state.auth.signOutHere).toHaveBeenCalledTimes(1);
    expect(state.clearHere).toHaveBeenCalledTimes(1);
  });

  it("clears the cookie whatever Supabase answered, and never throws", async () => {
    state.auth.signOutHere.mockResolvedValueOnce({ ok: false, code: "session_not_found", status: 404 });
    await signOutHere();
    state.auth.signOutHere.mockRejectedValueOnce(new Error("network"));
    await expect(signOutHere()).resolves.toBeUndefined();
    expect(state.clearHere).toHaveBeenCalledTimes(2);
  });

  it("clears the cookie alone, without asking Supabase", async () => {
    await clearAuthCookies();
    expect(state.clearHere).toHaveBeenCalledTimes(1);
    expect(state.auth.signOutHere).not.toHaveBeenCalled();
  });
});
