import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { codeMatches, hashCode, newCode, newToken } from "./secrets";

// The plan mocked node:crypto here. Vitest runs this repo in jsdom, where a mock of a Node builtin never reaches the
// source modules (the test file sees it, lib/auth/secrets.ts doesn't), so the two things the mock proved are checked
// another way below: leading zeros from the codes themselves, and timingSafeEqual from the source (as the privacy
// guard test reads source, in app/privacy/page.test.tsx).

const KEY = "a-test-key-that-is-long-enough-0123456789";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** A fresh copy of the module, so authKey() reads the environment as this test sets it (plan decision 18). */
async function fresh(env: { key?: string; sampleMode?: "0"; backend?: "supabase" }) {
  vi.resetModules();
  vi.stubEnv("VOSSIE_AUTH_HMAC_KEY", env.key);
  if (env.sampleMode) vi.stubEnv("VOSSIE_SAMPLE_MODE", env.sampleMode);
  if (env.backend) vi.stubEnv("VOSSIE_BACKEND", env.backend);
  return import("./secrets");
}

describe("keyed hashes (stage K spec 5)", () => {
  it("hashes a token with HMAC-SHA-256 under the key, in hex, the same every time", async () => {
    const { hashToken } = await fresh({ key: KEY });
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc")).toBe(hashToken("abc"));
    // Not the plain SHA-256 a leaked store could be checked against.
    expect(hashToken("abc")).not.toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("gives another hash under another key", async () => {
    const first = (await fresh({ key: KEY })).hashToken("abc");
    const second = (await fresh({ key: `${KEY}-rotated` })).hashToken("abc");
    expect(first).not.toBe(second);
  });

  it("never gives a token the hash of a code, whatever joins to the same text (the purpose prefixes)", async () => {
    const { hashCode, hashToken } = await fresh({ key: KEY });
    expect(hashToken("key-a:123456")).not.toBe(hashCode("key-a", "123456"));
  });

  it("uses the development key with one warning, however many hashes, when unset in sample mode", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { hashCode, hashToken } = await fresh({ key: undefined });
    hashToken("a");
    hashToken("b");
    hashCode("k", "123456");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe(
      "[vossie] VOSSIE_AUTH_HMAC_KEY is not set, so sign-in codes and sessions are hashed with the development key. Set it before any real account signs in.",
    );
  });

  it("refuses a short key in any mode, without saying what it was", async () => {
    const { hashToken } = await fresh({ key: "short-key-31-characters-long-xx" });
    expect(() => hashToken("abc")).toThrow("VOSSIE_AUTH_HMAC_KEY is too short: use at least 32 characters.");
    try {
      hashToken("abc");
    } catch (error) {
      expect(String(error)).not.toContain("short-key-31");
    }
  });

  it("refuses to hash with no key when sample mode is off", async () => {
    const { hashToken } = await fresh({ key: undefined, sampleMode: "0" });
    expect(() => hashToken("abc")).toThrow("VOSSIE_AUTH_HMAC_KEY must be set when sample mode is off.");
  });

  it("refuses the development key on Supabase, whatever VOSSIE_SAMPLE_MODE says, and logs nothing (stage K amendment 7)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { hashToken } = await fresh({ key: undefined, backend: "supabase" });
    expect(() => hashToken("abc")).toThrow("VOSSIE_AUTH_HMAC_KEY must be set when sample mode is off.");
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "1");
    expect(() => hashToken("abc")).toThrow("VOSSIE_AUTH_HMAC_KEY must be set when sample mode is off.");
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("hashes with a 44-character key on Supabase, the token: prefix unchanged", async () => {
    const key = "q".repeat(43) + "=";
    const { hashToken } = await fresh({ key, backend: "supabase" });
    expect(hashToken("t")).toBe(createHmac("sha256", key).update("token:t").digest("hex"));
  });

  it("reads nothing when imported, so a build without the key can't fail (spec decision 14)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fresh({ key: undefined, sampleMode: "0" })).resolves.toBeDefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("leaves no unkeyed hash in lib/auth (spec 5 \"Tests\")", () => {
    const folder = join(process.cwd(), "lib/auth");
    for (const file of readdirSync(folder).filter((name) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name))) {
      expect(readFileSync(join(folder, file), "utf8"), file).not.toMatch(/createHash\(/);
    }
  });
});

describe("tokens and codes (accounts spec 4 and 5)", () => {
  it("makes random UUID tokens", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => newToken()));
    expect(tokens.size).toBe(20);
    for (const token of tokens) expect(token).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("makes 6-digit codes, keeping leading zeros", () => {
    const codes = Array.from({ length: 2000 }, () => newCode());
    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
    // One code in ten starts with a zero, so 2,000 without one would be a 1-in-10^91 chance: the padding is working.
    expect(codes.some((code) => code.startsWith("0"))).toBe(true);
  });

  it("draws codes from the crypto module's randomInt, never Math.random", () => {
    // A guessable generator would make the code worthless, and no test of the output can tell the two apart.
    const source = readFileSync(join(process.cwd(), "lib/auth/secrets.ts"), "utf8");
    expect(source).toMatch(/randomInt\(/);
    expect(source).not.toMatch(/Math\.random/);
  });

  it("hashes a code with its attempt's key, so the same code hashes differently for each attempt", () => {
    expect(hashCode("key-a", "123456")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode("key-a", "123456")).not.toBe(hashCode("key-b", "123456"));
  });

  it("checks a code in constant time", () => {
    const stored = hashCode("key-a", "042137");
    expect(codeMatches("key-a", "042137", stored)).toBe(true);
    expect(codeMatches("key-a", "042138", stored)).toBe(false);
    expect(codeMatches("key-b", "042137", stored)).toBe(false);
    // The comparison itself can't be watched without mocking node:crypto, so check it is made with timingSafeEqual.
    const source = readFileSync(join(process.cwd(), "lib/auth/secrets.ts"), "utf8");
    expect(source).toMatch(/timingSafeEqual\(expected, actual\)/);
  });

  it("never matches a broken stored hash", () => {
    expect(codeMatches("key-a", "042137", "not-hex")).toBe(false);
  });
});
