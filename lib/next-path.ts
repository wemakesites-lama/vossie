const BASE = "https://vossie.invalid";

/**
 * A `next` link parameter that's safe to link back to (browse and listing spec 5.9): a path on this site. It parses the
 * path rather than checking its characters, because browsers read dot segments, backslashes, tabs and newlines in ways
 * a character check misses ("/.//evil.example" resolves to "//evil.example"). Anything that leads off the site is
 * refused; what's returned is the path as the parser reads it.
 */
export function safeNextPath(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  // The URL parser resolves dot segments, turns backslashes into slashes and drops tabs and newlines, so whatever
  // would lead off the site shows up here as another origin or a path starting "//".
  if (url.origin !== BASE || url.pathname.startsWith("//")) return null;
  return url.pathname + url.search + url.hash;
}

/** The sign-in page's link, coming back to `path` afterwards (spec 5.9). */
export function signInHref(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`;
}
