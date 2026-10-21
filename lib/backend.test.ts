import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { backend, onSupabase } from "./backend";

/** The error a call throws, so a test can check it never repeats a value. */
function errorOf(call: () => unknown): string {
  try {
    call();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected it to throw");
}

describe("which backend lib/data uses (2b plan decisions 15 and 16)", () => {
  it("is the sample store when VOSSIE_BACKEND is unset, empty or blank", () => {
    expect(backend({})).toBe("sample");
    expect(backend({ VOSSIE_BACKEND: "" })).toBe("sample");
    expect(backend({ VOSSIE_BACKEND: " " })).toBe("sample");
    expect(backend({ VOSSIE_BACKEND: "sample" })).toBe("sample");
  });

  it("is Supabase only for exactly \"supabase\", and anything else throws naming the variable, never its value", () => {
    expect(backend({ VOSSIE_BACKEND: "supabase" })).toBe("supabase");
    expect(backend({ VOSSIE_BACKEND: " supabase " })).toBe("supabase");
    expect(() => backend({ VOSSIE_BACKEND: "Supabase" })).toThrow("VOSSIE_BACKEND");
    expect(() => backend({ VOSSIE_BACKEND: "postgres" })).toThrow("VOSSIE_BACKEND");
    expect(errorOf(() => backend({ VOSSIE_BACKEND: "postgres-LEAK" }))).not.toContain("LEAK");
  });

  it("onSupabase() follows backend()", () => {
    expect(onSupabase({})).toBe(false);
    expect(onSupabase({ VOSSIE_BACKEND: "sample" })).toBe(false);
    expect(onSupabase({ VOSSIE_BACKEND: "supabase" })).toBe(true);
    expect(() => onSupabase({ VOSSIE_BACKEND: "nope" })).toThrow("VOSSIE_BACKEND");
  });

  it("reads the environment on each call, never once at module scope", () => {
    const before = process.env.VOSSIE_BACKEND;
    try {
      process.env.VOSSIE_BACKEND = "supabase";
      expect(onSupabase()).toBe(true);
      process.env.VOSSIE_BACKEND = "sample";
      expect(onSupabase()).toBe(false);
      expect(backend()).toBe("sample");
    } finally {
      if (before === undefined) delete process.env.VOSSIE_BACKEND;
      else process.env.VOSSIE_BACKEND = before;
    }
  });

  it("imports nothing, so neither a unit test nor a client bundle can pull a server-only module through it", () => {
    const source = readFileSync(join(process.cwd(), "lib", "backend.ts"), "utf8");
    expect(source).not.toMatch(/\bimport\b/);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bexport\b[^;]*\bfrom\b/);
  });
});
