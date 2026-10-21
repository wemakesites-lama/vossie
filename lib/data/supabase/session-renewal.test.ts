import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renewFromProxy } from "./session-renewal";

// The proxy's renewal on Supabase (phase B, Task 6; decision 4; amendments 1 and 3). The real renewal client runs with
// @supabase/ssr replaced: a test plays Supabase's part by calling the setAll it was given, with Supabase's own options
// (400 days), so the 30 days on the response is the client's doing. The façade's early returns (the sample backend, no
// vossie_auth cookie) are tested in lib/data/session-renewal.test.ts.

vi.mock("server-only", () => ({}));

const supabase = vi.hoisted(() => ({
  getClaims: vi.fn(),
  setAll: null as null | ((cookies: { name: string; value: string; options: Record<string, unknown> }[], headers: Record<string, string>) => void),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: typeof supabase.setAll } }) => {
    supabase.setAll = options.cookies.setAll;
    return { auth: { getClaims: supabase.getClaims } };
  },
}));

const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};
/** What @supabase/ssr 0.12.7 writes a session cookie with (DEFAULT_COOKIE_OPTIONS, then cookieOptions). */
const SUPABASE_OPTIONS = { path: "/", sameSite: "lax", httpOnly: true, secure: true, maxAge: 400 * 24 * 60 * 60 };

beforeEach(() => {
  vi.stubEnv("VOSSIE_BACKEND", "supabase");
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:55321");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_TESTVALUEtestvalue");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  supabase.setAll = null;
});

const request = (cookie = "vossie_auth=base64-old; vossie_campus=pretoria") =>
  new NextRequest("https://vossie-pi.vercel.app/account", { headers: { cookie } });

/** The cookies the render will see, from Next's x-middleware-request-cookie header. */
function cookiesPassedOn(response: Response): string | null {
  return response.headers.get("x-middleware-request-cookie");
}

describe("renewing the session in the proxy (phase B, Task 6)", () => {
  it("passes the request on untouched when the session needed no renewal", async () => {
    supabase.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
    const response = await renewFromProxy(request());
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(cookiesPassedOn(response)).toBeNull();
    for (const header of ["cache-control", "expires", "pragma"]) expect(response.headers.get(header)).toBeNull();
  });

  it("puts renewed cookies on the request passed on and the response, at 30 days, with Supabase's no-store headers", async () => {
    supabase.getClaims.mockImplementation(async () => {
      supabase.setAll!([{ name: "vossie_auth", value: "base64-new", options: SUPABASE_OPTIONS }], NO_STORE);
      return { data: { claims: { sub: "user-1" } }, error: null };
    });
    const response = await renewFromProxy(request());
    expect(response.headers.get("x-middleware-next")).toBe("1");
    // The render reads the new session, so it never refreshes again (only the proxy refreshes: amendment 3).
    expect(cookiesPassedOn(response)).toContain("vossie_auth=base64-new");
    expect(cookiesPassedOn(response)).toContain("vossie_campus=pretoria");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^vossie_auth=base64-new; /);
    expect(setCookie).toMatch(/Max-Age=2592000/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(/Secure/);
    expect(response.headers.get("cache-control")).toBe(NO_STORE["Cache-Control"]);
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("writes every chunk at 30 days, and a removal at 0, taking the removed one off the request passed on", async () => {
    supabase.getClaims.mockImplementation(async () => {
      supabase.setAll!(
        [
          // A removal first: the order @supabase/ssr uses is its own, so the proxy mustn't depend on it.
          { name: "vossie_auth", value: "", options: { ...SUPABASE_OPTIONS, maxAge: 0 } },
          { name: "vossie_auth.0", value: "base64-part0", options: SUPABASE_OPTIONS },
          { name: "vossie_auth.1", value: "base64-part1", options: SUPABASE_OPTIONS },
        ],
        NO_STORE,
      );
      return { data: { claims: { sub: "user-1" } }, error: null };
    });
    const response = await renewFromProxy(request());
    const written = response.headers.getSetCookie();
    expect(written).toHaveLength(3);
    expect(written.find((line) => line.startsWith("vossie_auth.0="))).toMatch(/Max-Age=2592000/);
    expect(written.find((line) => line.startsWith("vossie_auth.1="))).toMatch(/Max-Age=2592000/);
    expect(written.find((line) => line.startsWith("vossie_auth="))).toMatch(/Max-Age=0/);
    const passedOn = cookiesPassedOn(response) ?? "";
    expect(passedOn).toContain("vossie_auth.0=base64-part0");
    expect(passedOn).toContain("vossie_auth.1=base64-part1");
    expect(passedOn).not.toMatch(/(^|; )vossie_auth=/);
    expect(response.headers.get("x-middleware-set-cookie") ?? "").not.toMatch(/(^|,)\s*vossie_auth=/);
  });

  it("signs the render out when Supabase ends the session, by clearing the cookie on both sides", async () => {
    supabase.getClaims.mockImplementation(async () => {
      supabase.setAll!([{ name: "vossie_auth", value: "", options: { ...SUPABASE_OPTIONS, maxAge: 0 } }], NO_STORE);
      return { data: null, error: { name: "AuthApiError", status: 400, code: "refresh_token_not_found" } };
    });
    const response = await renewFromProxy(request());
    expect(response.headers.getSetCookie()).toEqual(["vossie_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure"]);
    expect(cookiesPassedOn(response)).toBe("vossie_campus=pretoria");
    // Not through Next's cookie list: Next copies that list into the render's cookies and writes it out again without
    // its Max-Age=0 (request-store.js mergeMiddlewareCookies), which would leave an empty vossie_auth in the browser.
    expect(response.headers.get("x-middleware-set-cookie") ?? "").not.toContain("vossie_auth");
    expect(response.headers.get("cache-control")).toBe(NO_STORE["Cache-Control"]);
  });

  it("passes the request on, deleting nothing, when Supabase can't be reached, and logs without the cookie's value", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    supabase.getClaims.mockRejectedValue(new Error("fetch failed: base64-old"));
    const response = await renewFromProxy(request());
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(cookiesPassedOn(response)).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("base64-old");
  });
});
