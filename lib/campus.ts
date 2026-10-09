import type { Campus, CampusChoice } from "./types";

export const CAMPUS_COOKIE = "vossie_campus";
export const ALL_CAMPUSES = "all";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Turn a raw cookie value into a valid choice. Unknown or missing values mean all campuses. */
export function parseCampusChoice(
  raw: string | null | undefined,
  campuses: readonly Pick<Campus, "slug">[],
): CampusChoice {
  if (!raw) return ALL_CAMPUSES;
  return campuses.some((campus) => campus.slug === raw) ? raw : ALL_CAMPUSES;
}

/** Read the campus cookie out of a `document.cookie`-style string. */
export function readCampusCookie(cookieString: string): string | null {
  for (const part of cookieString.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CAMPUS_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** A first-party preference cookie: one year, whole site, Lax, Secure on https. */
export function campusCookieString(choice: CampusChoice, secure: boolean): string {
  const parts = [
    `${CAMPUS_COOKIE}=${encodeURIComponent(choice)}`,
    "Path=/",
    `Max-Age=${ONE_YEAR_SECONDS}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Label for the header pill and the menu. `null` means "not known yet" (server render). */
export function campusLabel(
  choice: CampusChoice | null,
  campuses: readonly Pick<Campus, "slug" | "name">[],
): string {
  if (choice === null) return "Campus";
  if (choice === ALL_CAMPUSES) return "All campuses";
  return campuses.find((campus) => campus.slug === choice)?.name ?? "All campuses";
}

// --- Client store over the cookie ----------------------------------------

const listeners = new Set<() => void>();

export function subscribeCampus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCampusCookieValue(): string | null {
  return readCampusCookie(document.cookie);
}

export function setCampusChoice(choice: CampusChoice): void {
  document.cookie = campusCookieString(choice, window.location.protocol === "https:");
  listeners.forEach((listener) => listener());
}
