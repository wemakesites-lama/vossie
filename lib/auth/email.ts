import { emailDomains } from "./config";

const MAX_EMAIL_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An email as the store keeps it: trimmed and lower case. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type EmailCheck = "ok" | "missing" | "domain";

/**
 * Whether a normalised email can sign in (spec 2.4): an address at one of the domains, or at a subdomain of one.
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
  return `${email.slice(0, 1)}•••${email.slice(email.lastIndexOf("@"))}`;
}
