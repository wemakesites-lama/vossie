import { NextRequest } from "next/server";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { renewalClient, type RenewalClient, type RenewalWrites } from "./renewal";

// The proxy's renewal client (Supabase phase B, Task 3; decision 4; amendment 1). Supabase's cookie client is replaced,
// so nothing reaches a network: a test plays the part of @supabase/ssr by calling the setAll it was given.

vi.mock("server-only", () => ({}));

const calls = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
  options: null as null | {
    cookies: {
      getAll: () => { name: string; value: string }[];
      setAll: (cookies: { name: string; value: string; options: Record<string, unknown> }[], headers: Record<string, string>) => void;
    };
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => {
    calls.createServerClient(...args);
    calls.options = args[2] as typeof calls.options;
    return { auth: { getClaims: calls.getClaims } };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  calls.options = null;
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:55321");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_TESTVALUEtestvalue");
});

function request(url = "https://vossie-pi.vercel.app/account", headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers: { cookie: "vossie_auth=base64-old; vossie_campus=pretoria", ...headers } });
}

describe("the renewal client (phase B decision 4)", () => {
  it("has one call, renew()", () => {
    expectTypeOf<keyof RenewalClient>().toEqualTypeOf<"renew">();
  });

  it("uses the secret key, the request's cookies, the 30-day cookie settings and the student's address", async () => {
    calls.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
    const client = renewalClient(request(undefined, { "x-real-ip": " 196.25.1.1 ", "x-forwarded-proto": "https" }), () => {});
    const [url, key, options] = calls.createServerClient.mock.calls[0];
    expect([url, key]).toEqual(["http://127.0.0.1:55321", "sb_secret_TESTVALUEtestvalue"]);
    expect(options).toMatchObject({
      cookieOptions: { name: "vossie_auth", httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 2_592_000 },
      global: { headers: { "Sb-Forwarded-For": "196.25.1.1" } },
    });
    expect(calls.options!.cookies.getAll()).toEqual([
      { name: "vossie_auth", value: "base64-old" },
      { name: "vossie_campus", value: "pretoria" },
    ]);
    expect(await client.renew()).toEqual({ signedIn: true });
    expect(calls.getClaims).toHaveBeenCalledWith();
  });

  it("sends no forwarded address when the request has none, and isn't Secure over http", () => {
    renewalClient(request("http://localhost:3300/", { "x-forwarded-proto": "http" }), () => {});
    expect(calls.createServerClient.mock.calls[0][2]).toMatchObject({ global: { headers: {} }, cookieOptions: { secure: false } });
  });

  it("decides Secure from x-forwarded-proto, as isHttps() does for every other cookie (review fix 5)", () => {
    renewalClient(request("http://localhost:3300/", { "x-forwarded-proto": "https, http" }), () => {});
    renewalClient(request("https://vossie-pi.vercel.app/account"), () => {});
    expect(calls.createServerClient.mock.calls.map((call) => (call[2] as { cookieOptions: { secure: boolean } }).cookieOptions.secure)).toEqual([
      true,
      false,
    ]);
  });

  it("is signed out when Supabase refuses or the claims have no subject", async () => {
    const client = renewalClient(request(), () => {});
    calls.getClaims.mockResolvedValueOnce({ data: null, error: { code: "session_not_found", status: 403 } });
    expect(await client.renew()).toEqual({ signedIn: false });
    calls.getClaims.mockResolvedValueOnce({ data: { claims: {} }, error: null });
    expect(await client.renew()).toEqual({ signedIn: false });
  });

  it("hands Supabase's writes and headers to onSet, every set cookie at 30 days and a removal at 0 (amendment 1)", () => {
    const seen: RenewalWrites[] = [];
    renewalClient(request(), (writes) => seen.push(writes));
    const headers = { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0", Pragma: "no-cache" };
    calls.options!.cookies.setAll(
      [
        { name: "vossie_auth", value: "base64-new", options: { httpOnly: true, sameSite: "lax", path: "/", maxAge: 34_560_000 } },
        { name: "vossie_auth.0", value: "", options: { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 } },
      ],
      headers,
    );
    expect(seen).toEqual([
      {
        cookies: [
          { name: "vossie_auth", value: "base64-new", options: { httpOnly: true, sameSite: "lax", path: "/", maxAge: 2_592_000 } },
          { name: "vossie_auth.0", value: "", options: { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 } },
        ],
        headers,
      },
    ]);
  });
});
