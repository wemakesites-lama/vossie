import { describe, expect, it, vi } from "vitest";
import { backend, publishableKey, secretKey, supabaseUrl } from "./env";

// "server-only" throws outside a React Server Components bundle; these tests run the plain functions.
vi.mock("server-only", () => ({}));

const PUBLISHABLE = "sb_publishable_TESTVALUEtestvalue";
const SECRET = "sb_secret_TESTVALUEtestvalue";

/** The error a call throws, so a test can check it never repeats a value. */
function errorOf(call: () => unknown): string {
  try {
    call();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected it to throw");
}

describe("the backend's settings (backend spec section 8)", () => {
  it("reads each one", () => {
    expect(supabaseUrl({ SUPABASE_URL: "https://abc.supabase.co" })).toBe("https://abc.supabase.co");
    expect(supabaseUrl({ SUPABASE_URL: " http://127.0.0.1:55321/ " })).toBe("http://127.0.0.1:55321");
    expect(publishableKey({ SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE })).toBe(PUBLISHABLE);
    expect(secretKey({ SUPABASE_SECRET_KEY: SECRET })).toBe(SECRET);
  });

  it("names a missing one, empty or blank included", () => {
    expect(() => supabaseUrl({})).toThrow("SUPABASE_URL is not set");
    expect(() => publishableKey({ SUPABASE_PUBLISHABLE_KEY: "" })).toThrow("SUPABASE_PUBLISHABLE_KEY is not set");
    expect(() => secretKey({ SUPABASE_SECRET_KEY: "   " })).toThrow("SUPABASE_SECRET_KEY is not set");
  });

  it("refuses a malformed one without repeating its value", () => {
    const cases: [() => unknown, string, string][] = [
      [() => supabaseUrl({ SUPABASE_URL: "not a url sb_secret_LEAK" }), "SUPABASE_URL", "sb_secret_LEAK"],
      [() => supabaseUrl({ SUPABASE_URL: "https://abc.supabase.co/rest/v1" }), "SUPABASE_URL", "rest/v1"],
      [() => supabaseUrl({ SUPABASE_URL: "ftp://abc.supabase.co" }), "SUPABASE_URL", "ftp:"],
      // The keys the wrong way round: a secret key must never be used where a publishable one goes.
      [() => publishableKey({ SUPABASE_PUBLISHABLE_KEY: SECRET }), "SUPABASE_PUBLISHABLE_KEY", SECRET],
      [() => secretKey({ SUPABASE_SECRET_KEY: PUBLISHABLE }), "SUPABASE_SECRET_KEY", PUBLISHABLE],
      // A legacy JWT key (spec decision 6: only the new keys).
      [() => secretKey({ SUPABASE_SECRET_KEY: "eyJhbGciOiJIUzI1NiJ9.LEGACY" }), "SUPABASE_SECRET_KEY", "LEGACY"],
    ];
    for (const [call, name, value] of cases) {
      const message = errorOf(call);
      expect(message).toContain(name);
      expect(message).not.toContain(value);
    }
  });

  it("keeps the sample store unless VOSSIE_BACKEND says supabase (spec decision 10)", () => {
    expect(backend({})).toBe("sample");
    expect(backend({ VOSSIE_BACKEND: "" })).toBe("sample");
    expect(backend({ VOSSIE_BACKEND: "sample" })).toBe("sample");
    expect(backend({ VOSSIE_BACKEND: "supabase" })).toBe("supabase");
    expect(errorOf(() => backend({ VOSSIE_BACKEND: "postgres-LEAK" }))).not.toContain("LEAK");
    expect(() => backend({ VOSSIE_BACKEND: "Supabase" })).toThrow("VOSSIE_BACKEND");
  });
});
