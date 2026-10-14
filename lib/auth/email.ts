import { emailDomains } from "./config";

const MAX_EMAIL_LENGTH = 254;

// ASCII only, so a look-alike letter (a Cyrillic "е", the Kelvin sign) can't pass as a letter of a listed domain, and
// no invisible character can hide in the address. Before the @: printable ASCII other than a space or another @
// (\x21-\x3f is "!" to "?", \x41-\x7e is "A" to "~"). After it: at least two dot-separated labels of lower-case
// letters, digits and inner hyphens, so ".eduvos.com", "eduvos.com." and "a..eduvos.com" are not domains. The length
// is capped before this runs.
const EMAIL_SHAPE = /^[\x21-\x3f\x41-\x7e]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** An email as the store keeps it: trimmed and lower case. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type EmailCheck = "ok" | "missing" | "domain";

/**
 * Whether a normalised email can sign in (spec 2.4): an ASCII address at one of the domains, or at a subdomain of one.
 * Anything that isn't an address gets the same answer as a wrong domain: "Use your Eduvos email address."
 */
export function checkEmail(email: string, domains: readonly string[] = emailDomains()): EmailCheck {
  if (email === "") return "missing";
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(email)) return "domain";
  const domain = email.slice(email.lastIndexOf("@") + 1);
  return domains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`)) ? "ok" : "domain";
}

/** "thandi@eduvos.com" → "t•••@eduvos.com", for "We sent a code to …" (spec 3.1). */
export function maskEmail(email: string): string {
  // The first whole character, not the first UTF-16 unit, so one outside the basic plane isn't split in two.
  return `${[...email][0] ?? ""}•••${email.slice(email.lastIndexOf("@"))}`;
}
