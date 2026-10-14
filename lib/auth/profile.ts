import type { SignInError } from "@/lib/data/rows";

export type FirstNameCheck = {
  /** The name with its spaces tidied and control characters dropped. */
  value: string;
  error: Extract<SignInError, "first-name-missing" | "first-name-length"> | null;
};

/** A first name (spec 3.1): 2 to 40 characters, once the spaces are tidied. Each letter counts once, accents too. */
export function checkFirstName(raw: string): FirstNameCheck {
  const value = raw.replace(/\s+/g, " ").replace(/\p{Cc}/gu, "").trim();
  if (value === "") return { value, error: "first-name-missing" };
  const length = [...value].length;
  return { value, error: length < 2 || length > 40 ? "first-name-length" : null };
}

/** The campus slug, when it's one of the campuses (spec 3.1: a select of the 13). Otherwise null. */
export function checkCampus(raw: string, campusSlugs: readonly string[]): string | null {
  return campusSlugs.includes(raw) ? raw : null;
}
