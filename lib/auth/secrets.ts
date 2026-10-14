import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

// Tokens and codes (accounts spec section 4 and 5). Making one reads randomness, so only Server Actions call
// newToken() and newCode(), never a render. Hashing is deterministic and safe anywhere on the server.

/** A random token for a cookie: a session's or a sign-in attempt's. */
export function newToken(): string {
  return randomUUID();
}

/** What the store keeps instead of a token: its SHA-256, in hex (plan decision 4). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A 6-digit code, leading zeros kept. */
export function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** A code's SHA-256, salted with its attempt's key, so the same code hashes differently for every attempt (spec 5). */
export function hashCode(attemptKey: string, code: string): string {
  return createHash("sha256").update(`${attemptKey}:${code}`).digest("hex");
}

/** Whether `code` is the attempt's code. The hashes are compared in constant time (spec 5). */
export function codeMatches(attemptKey: string, code: string, storedHash: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashCode(attemptKey, code), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
