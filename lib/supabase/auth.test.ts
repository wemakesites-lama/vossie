import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { authClient, clearHere, type AuthClient } from "./auth";

// The sign-in client (backend spec 5; M1 of the phase A review). The type tests are checked by `pnpm typecheck`; the
// behaviour tests run with Supabase's two client makers and Next's request APIs replaced, so nothing reaches a network.

vi.mock("server-only", () => ({}));

const calls = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServerClient: vi.fn(),
  signInWithOtp: vi.fn(),
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  realIp: "196.25.1.1" as string | null,
  /** The cookies the browser sent, and what the response set or deleted, in order. */
  jar: new Map<string, string>(),
  written: [] as { name: string; value: string; options: Record<string, unknown> }[],
  deleted: [] as string[],
  /** The cookie methods the cookie client was given, so a test can play @supabase/ssr's part. */
  cookieMethods: null as null | {
    setAll: (cookies: { name: string; value: string; options: Record<string, unknown> }[], headers: Record<string, string>) => void;
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    calls.createClient(...args);
    return { auth: { signInWithOtp: calls.signInWithOtp, admin: { generateLink: calls.generateLink } } };
  },
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => {
    calls.createServerClient(...args);
    calls.cookieMethods = (args[2] as { cookies: typeof calls.cookieMethods }).cookies;
    return { auth: { verifyOtp: calls.verifyOtp, signOut: calls.signOut } };
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(calls.realIp ? { "x-real-ip": calls.realIp } : {}),
  cookies: async () => ({
    getAll: () => [...calls.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string, options: Record<string, unknown>) => calls.written.push({ name, value, options }),
    delete: (name: string) => calls.deleted.push(name),
  }),
}));
vi.mock("@/lib/auth/cookies", () => ({ isHttps: async () => true }));

beforeEach(() => {
  vi.clearAllMocks();
  calls.realIp = "196.25.1.1";
  calls.jar.clear();
  calls.written = [];
  calls.deleted = [];
  calls.cookieMethods = null;
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:55321");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_TESTVALUEtestvalue");
});

describe("the sign-in client's type (backend spec 5)", () => {
  it("has the four sign-in calls and nothing else", () => {
    expectTypeOf<keyof AuthClient>().toEqualTypeOf<"sendSignInCode" | "verifySignInCode" | "signOutHere" | "signInDemo">();
    expectTypeOf<AuthClient>().not.toHaveProperty("auth");
    expectTypeOf<AuthClient>().not.toHaveProperty("admin");
    expectTypeOf<AuthClient>().not.toHaveProperty("from");
    expectTypeOf<AuthClient>().not.toHaveProperty("rpc");
    expectTypeOf<AuthClient>().not.toHaveProperty("storage");
    expectTypeOf<Awaited<ReturnType<typeof authClient>>>().toEqualTypeOf<AuthClient>();
  });

  it("refuses a query or an admin call through it", () => {
    const query = (client: AuthClient) => {
      // @ts-expect-error The sign-in client is for signing in only (spec decision 5).
      return client.from("profiles");
    };
    const admin = (client: AuthClient) => {
      // @ts-expect-error No .auth, so no .auth.admin with the secret key's powers.
      return client.auth.admin.deleteUser("someone");
    };
    expectTypeOf(query).toBeFunction();
    expectTypeOf(admin).toBeFunction();
  });
});

describe("the sign-in client (backend spec 5)", () => {
  it("sends the code from a cookieless client on the implicit flow, so no code-verifier cookie is set", async () => {
    calls.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    const result = await (await authClient()).sendSignInCode("thandi@eduvos.com");
    expect(result).toEqual({ ok: true });
    expect(calls.createServerClient).not.toHaveBeenCalled();
    expect(calls.createClient).toHaveBeenCalledWith("http://127.0.0.1:55321", "sb_secret_TESTVALUEtestvalue", {
      auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "Sb-Forwarded-For": "196.25.1.1" } },
    });
    expect(calls.signInWithOtp).toHaveBeenCalledWith({ email: "thandi@eduvos.com", options: { shouldCreateUser: true } });
  });

  it("checks the code through the cookie client, as an email code, and gives back only the account's id", async () => {
    calls.verifyOtp.mockResolvedValue({ data: { user: { id: "user-1" }, session: { access_token: "secret" } }, error: null });
    const result = await (await authClient()).verifySignInCode("thandi@eduvos.com", "123456");
    expect(result).toEqual({ ok: true, userId: "user-1" });
    expect(calls.verifyOtp).toHaveBeenCalledWith({ email: "thandi@eduvos.com", token: "123456", type: "email" });
    const [url, key, options] = calls.createServerClient.mock.calls[0];
    expect([url, key]).toEqual(["http://127.0.0.1:55321", "sb_secret_TESTVALUEtestvalue"]);
    expect(options).toMatchObject({
      cookieOptions: { name: "vossie_auth", httpOnly: true, sameSite: "lax", secure: true, path: "/" },
      global: { headers: { "Sb-Forwarded-For": "196.25.1.1" } },
    });
  });

  it("signs in a demo account with a magic link token it checks at once, sending no email", async () => {
    calls.generateLink.mockResolvedValue({ data: { properties: { hashed_token: "hashed-1" }, user: {} }, error: null });
    calls.verifyOtp.mockResolvedValue({ data: { user: { id: "user-5" }, session: {} }, error: null });
    expect(await (await authClient()).signInDemo("admin@vossie.test")).toEqual({ ok: true, userId: "user-5" });
    expect(calls.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "admin@vossie.test" });
    expect(calls.verifyOtp).toHaveBeenCalledWith({ token_hash: "hashed-1", type: "magiclink" });
    expect(calls.signInWithOtp).not.toHaveBeenCalled();
  });

  it("passes on a demo link's refusal without checking anything", async () => {
    calls.generateLink.mockResolvedValue({ data: { properties: null, user: null }, error: { code: "user_not_found", status: 404, message: "…" } });
    expect(await (await authClient()).signInDemo("gone@vossie.test")).toEqual({ ok: false, code: "user_not_found", status: 404 });
    expect(calls.verifyOtp).not.toHaveBeenCalled();
  });

  it("passes on Auth's refusal as its code and status, never its message", async () => {
    calls.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "otp_expired", status: 403, message: "Token has expired or is invalid" },
    });
    expect(await (await authClient()).verifySignInCode("thandi@eduvos.com", "000000")).toEqual({
      ok: false,
      code: "otp_expired",
      status: 403,
    });
    calls.signInWithOtp.mockResolvedValue({ data: {}, error: { code: "over_email_send_rate_limit", status: 429, message: "…" } });
    expect(await (await authClient()).sendSignInCode("thandi@eduvos.com")).toEqual({
      ok: false,
      code: "over_email_send_rate_limit",
      status: 429,
    });
  });

  it("marks the per-address minute, and only it, from the project's hourly email cap (amendment 5)", async () => {
    calls.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: { code: "over_email_send_rate_limit", status: 429, message: "For security purposes, you can only request this after 59 seconds." },
    });
    expect(await (await authClient()).sendSignInCode("thandi@vossie.net")).toEqual({
      ok: false,
      code: "over_email_send_rate_limit",
      status: 429,
      tooSoon: true,
    });
    calls.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: { code: "over_email_send_rate_limit", status: 429, message: "email rate limit exceeded" },
    });
    const capped = await (await authClient()).sendSignInCode("thandi@vossie.net");
    expect(capped).toEqual({ ok: false, code: "over_email_send_rate_limit", status: 429 });
    expect(JSON.stringify(capped)).not.toContain("exceeded");
  });

  it("signs out this browser only", async () => {
    calls.signOut.mockResolvedValue({ error: null });
    expect(await (await authClient()).signOutHere()).toEqual({ ok: true });
    expect(calls.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("sends no forwarded address when the request has none", async () => {
    calls.realIp = null;
    calls.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await (await authClient()).sendSignInCode("thandi@eduvos.com");
    expect(calls.createClient.mock.calls[0][2]).toMatchObject({ global: { headers: {} } });
  });

  it("writes every vossie_auth cookie after verifyOtp for 30 days, not 400, and keeps a removal at 0 (amendment 1)", async () => {
    calls.verifyOtp.mockImplementation(async () => {
      // As @supabase/ssr does: its own 400 days on a set, 0 on a removal.
      calls.cookieMethods!.setAll(
        [
          { name: "vossie_auth.0", value: "base64-part", options: { httpOnly: true, path: "/", maxAge: 34_560_000 } },
          { name: "vossie_auth.1", value: "base64-rest", options: { httpOnly: true, path: "/", maxAge: 34_560_000 } },
          { name: "vossie_auth", value: "", options: { httpOnly: true, path: "/", maxAge: 0 } },
        ],
        {},
      );
      return { data: { user: { id: "user-1" }, session: {} }, error: null };
    });
    await (await authClient()).verifySignInCode("thandi@vossie.net", "123456");
    expect(calls.written.map(({ name, options }) => [name, options.maxAge])).toEqual([
      ["vossie_auth.0", 2_592_000],
      ["vossie_auth.1", 2_592_000],
      ["vossie_auth", 0],
    ]);
  });
});

describe("clearing this browser's session cookie (phase B, Task 3)", () => {
  it("deletes every vossie_auth and vossie_auth.N cookie the request carries, and nothing else", async () => {
    for (const name of ["vossie_auth", "vossie_auth.0", "vossie_auth.1", "vossie_session", "vossie_signin", "vossie_authx", "vossie_campus"]) {
      calls.jar.set(name, "x");
    }
    await clearHere();
    expect(calls.deleted.sort()).toEqual(["vossie_auth", "vossie_auth.0", "vossie_auth.1"]);
    expect(calls.written).toEqual([]);
  });
});
