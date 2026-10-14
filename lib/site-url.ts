/** Where the site is served from when nothing says otherwise: the local server. */
export const DEFAULT_SITE_URL = "http://localhost:3000";

/**
 * The address the site is served from, as an origin with no trailing slash (info and system spec 2.7). It comes from
 * NEXT_PUBLIC_SITE_URL, which Next reads when it builds, so the host needs it in its build environment. `metadataBase`,
 * `robots.txt` and the sitemap all start from this, so none of them writes a domain.
 *
 * Unset or blank means the local server. Anything else must be an http or https address: a typo such as
 * "vossie.co.za" would otherwise quietly give every share card and sitemap entry a wrong address, so it stops the
 * build instead (plan decision 11).
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    // Not an address at all: handled below, with the same message as a wrong scheme.
  }
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
    throw new Error(`NEXT_PUBLIC_SITE_URL must be a web address such as https://vossie.example, but it is "${raw}"`);
  }
  return url.origin;
}
