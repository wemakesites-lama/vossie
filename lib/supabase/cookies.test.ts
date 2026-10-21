import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessTokenFrom, AUTH_COOKIE, authCookieOptions, isAuthCookie, requestCookies, sessionLifetime } from "./cookies";

// The vossie_auth cookie (backend spec 5; Supabase phase B, Task 3 and amendment 1). Next's request APIs are replaced.

vi.mock("server-only", () => ({}));

const jar = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  sets: [] as { name: string; value: string; options: Record<string, unknown> }[],
  serverComponent: false,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar.cookies].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      if (jar.serverComponent) throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
      jar.sets.push({ name, value, options });
    },
  }),
  headers: async () => new Headers({ "x-forwarded-proto": "https" }),
}));

beforeEach(() => {
  jar.cookies.clear();
  jar.sets = [];
  jar.serverComponent = false;
});

describe("the session cookie's name and settings (backend spec 5)", () => {
  it("is vossie_auth, httpOnly, Lax, the whole site, Secure on HTTPS, for 30 days", async () => {
    expect(AUTH_COOKIE).toBe("vossie_auth");
    expect(await authCookieOptions()).toEqual({
      name: "vossie_auth",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 2_592_000,
    });
  });

  it("knows the cookie and its chunks, and nothing else", () => {
    for (const name of ["vossie_auth", "vossie_auth.0", "vossie_auth.12"]) expect(isAuthCookie(name), name).toBe(true);
    for (const name of ["vossie_authx", "vossie_session", "vossie_auth-code-verifier", "vossie_auth.", "vossie_auth.1a", "x.vossie_auth.0"]) {
      expect(isAuthCookie(name), name).toBe(false);
    }
  });
});

describe("the 30-day lifetime (phase B decision 3, amendment 1)", () => {
  it("replaces @supabase/ssr's 400 days on every write, and keeps a removal at 0", () => {
    expect(sessionLifetime({ path: "/", maxAge: 34_560_000 })).toEqual({ path: "/", maxAge: 2_592_000 });
    expect(sessionLifetime({ path: "/" })).toEqual({ path: "/", maxAge: 2_592_000 });
    expect(sessionLifetime({ path: "/", maxAge: 0 })).toEqual({ path: "/", maxAge: 0 });
  });

  it("is what requestCookies() writes, whatever Supabase asks for", async () => {
    jar.cookies.set("vossie_auth.0", "base64-abc");
    const methods = await requestCookies();
    expect(methods.getAll()).toEqual([{ name: "vossie_auth.0", value: "base64-abc" }]);
    await methods.setAll!(
      [
        { name: "vossie_auth", value: "base64-new", options: { httpOnly: true, path: "/", maxAge: 34_560_000 } },
        { name: "vossie_auth.0", value: "", options: { httpOnly: true, path: "/", maxAge: 0 } },
      ],
      { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0" },
    );
    expect(jar.sets).toEqual([
      { name: "vossie_auth", value: "base64-new", options: { httpOnly: true, path: "/", maxAge: 2_592_000 } },
      { name: "vossie_auth.0", value: "", options: { httpOnly: true, path: "/", maxAge: 0 } },
    ]);
  });

  it("skips the write where cookies can't be set (a Server Component)", async () => {
    jar.serverComponent = true;
    const methods = await requestCookies();
    await expect(
      Promise.resolve(methods.setAll!([{ name: "vossie_auth", value: "x", options: {} }], {})),
    ).resolves.toBeUndefined();
  });
});

describe("the stored session's access token (amendment 3: read, never refreshed)", () => {
  /** A cookie value as @supabase/ssr writes it: "base64-" and the session's JSON in base64url. */
  const stored = (session: unknown) => `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const reader = (cookies: Record<string, string>) => (name: string) => cookies[name];

  it("reads it from the one cookie", async () => {
    expect(await accessTokenFrom(reader({ vossie_auth: stored({ access_token: "eyJ.a.b", refresh_token: "r" }) }))).toBe("eyJ.a.b");
  });

  it("joins the chunks first", async () => {
    const whole = stored({ access_token: "eyJ.chunked.token", refresh_token: "r", user: { id: "u" } });
    const cut = Math.floor(whole.length / 2);
    expect(await accessTokenFrom(reader({ "vossie_auth.0": whole.slice(0, cut), "vossie_auth.1": whole.slice(cut) }))).toBe(
      "eyJ.chunked.token",
    );
  });

  it("is null with no cookie, a broken one, or no token in it", async () => {
    expect(await accessTokenFrom(reader({}))).toBeNull();
    expect(await accessTokenFrom(reader({ vossie_auth: "base64-not json" }))).toBeNull();
    expect(await accessTokenFrom(reader({ vossie_auth: stored({ refresh_token: "r" }) }))).toBeNull();
    expect(await accessTokenFrom(reader({ vossie_auth: stored({ access_token: 42 }) }))).toBeNull();
    expect(await accessTokenFrom(reader({ vossie_auth: stored(null) }))).toBeNull();
    expect(await accessTokenFrom(reader({ vossie_session: stored({ access_token: "eyJ.a.b" }) }))).toBeNull();
  });
});
