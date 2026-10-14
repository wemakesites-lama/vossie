import type { SignInError } from "@/lib/data/rows";

export type FirstNameCheck = {
  /** The name composed as NFC, with its invisible and control characters dropped and its spaces tidied. */
  value: string;
  error: Extract<SignInError, "first-name-missing" | "first-name-length"> | null;
};

/**
 * A first name (spec 3.1): 2 to 40 characters, once it is tidied, and at least one of them a letter. Each letter counts
 * once: accents are composed first (NFC), so "e" plus a combining accent is the one character "é". A name with no
 * letter in it ("12", "--", only invisible characters) is treated as no name.
 */
export function checkFirstName(raw: string): FirstNameCheck {
  const value = raw
    .normalize("NFC")
    // Tab, new line and the like are spaces, not nothing: "Thandi\nMary" is two words.
    .replace(/[\t\n\v\f\r]/g, " ")
    // Invisible format characters (a zero-width space, a right-to-left override) and control characters go before the
    // spaces are tidied, so the gap they leave is tidied too.
    .replace(/[\p{Cf}\p{Cc}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!/\p{L}/u.test(value)) return { value, error: "first-name-missing" };
  const length = [...value].length;
  return { value, error: length < 2 || length > 40 ? "first-name-length" : null };
}

/** The campus slug, when it's one of the campuses (spec 3.1: a select of the 13). Otherwise null. */
export function checkCampus(raw: string, campusSlugs: readonly string[]): string | null {
  return campusSlugs.includes(raw) ? raw : null;
}
