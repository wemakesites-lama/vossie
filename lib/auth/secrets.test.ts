import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeMatches, hashCode, hashToken, newCode, newToken } from "./secrets";

// The plan mocked node:crypto here. Vitest runs this repo in jsdom, where a mock of a Node builtin never reaches the
// source modules (the test file sees it, lib/auth/secrets.ts doesn't), so the two things the mock proved are checked
// another way below: leading zeros from the codes themselves, and timingSafeEqual from the source (as the privacy
// guard test reads source, in app/privacy/page.test.tsx).

describe("tokens and codes (accounts spec 4 and 5)", () => {
  it("makes random UUID tokens", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => newToken()));
    expect(tokens.size).toBe(20);
    for (const token of tokens) expect(token).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps a token as its SHA-256, in hex", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
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
