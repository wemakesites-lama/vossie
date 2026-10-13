const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * A first-party preference cookie, as the campus choice and the saved list use (shopping spec 5.1): one year, the
 * whole site, Lax, and Secure on https. An empty value deletes the cookie.
 */
export function preferenceCookie(name: string, value: string, secure: boolean): string {
  const parts = [`${name}=${value}`, "Path=/", `Max-Age=${value ? ONE_YEAR_SECONDS : 0}`, "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** One cookie's raw value out of a `document.cookie`-style string, or null when it isn't there. */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}
