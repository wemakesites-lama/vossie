import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { isSampleMode } from "./config";

// Tokens and codes (accounts spec sections 4 and 5; stage K spec decisions 12 to 15). Making one reads randomness, so
// only Server Actions and Route Handlers call newToken() and newCode(), never a render. Hashes are HMAC-SHA-256 under a
// server secret, VOSSIE_AUTH_HMAC_KEY, so a leaked copy of the store gives back no codes and no live sessions. The key
// is read the first time something is hashed, never at module scope: `next build` prerenders without cookies, so it
// never hashes, and a missing runtime secret can't fail a build.

/** The shortest key accepted (stage K spec decision 14). `openssl rand -base64 32` makes a 44-character one. */
export const AUTH_KEY_MIN_LENGTH = 32;

/** Sample mode's stand-in when the key is unset. Public on purpose: it protects nothing, and the log says so. */
const DEVELOPMENT_KEY = "vossie-development-key-not-a-secret";

let cachedKey: string | null = null;

/**
 * The key, read once per server process (plan decision 18). Set, with at least 32 characters: used as given. Set but
 * shorter: refused in any mode. Unset in sample mode: the development key, with one warning per process. Unset with
 * sample mode off: refused. A refusal is never cached, and no message includes the value.
 */
export function authKey(): string {
  if (cachedKey !== null) return cachedKey;
  const key = process.env.VOSSIE_AUTH_HMAC_KEY;
  if (key) {
    if (key.length < AUTH_KEY_MIN_LENGTH) {
      throw new Error("VOSSIE_AUTH_HMAC_KEY is too short: use at least 32 characters.");
    }
    cachedKey = key;
  } else if (isSampleMode()) {
    console.warn(
      "[vossie] VOSSIE_AUTH_HMAC_KEY is not set, so sign-in codes and sessions are hashed with the development key. Set it before any real account signs in.",
    );
    cachedKey = DEVELOPMENT_KEY;
  } else {
    throw new Error("VOSSIE_AUTH_HMAC_KEY must be set when sample mode is off.");
  }
  return cachedKey;
}

/** HMAC-SHA-256 of `purpose:value` under the key, in hex. The purpose keeps a token's hash and a code's apart. */
function keyedHash(purpose: "token" | "code", value: string): string {
  return createHmac("sha256", authKey()).update(`${purpose}:${value}`).digest("hex");
}

/** A random token for a cookie: a session's or a sign-in attempt's. */
export function newToken(): string {
  return randomUUID();
}

/** What the store keeps instead of a token (spec decision 12): its keyed hash. */
export function hashToken(token: string): string {
  return keyedHash("token", token);
}

/** A 6-digit code, leading zeros kept. */
export function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** A code's keyed hash, salted with its attempt's key, so the same code hashes differently for every attempt (spec 5). */
export function hashCode(attemptKey: string, code: string): string {
  return keyedHash("code", `${attemptKey}:${code}`);
}

/** Whether `code` is the attempt's code. The hashes are compared in constant time (spec 5). */
export function codeMatches(attemptKey: string, code: string, storedHash: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashCode(attemptKey, code), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
