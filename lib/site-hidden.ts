/**
 * True when the whole site is hidden from search engines (decision 68): `VOSSIE_NOINDEX=1`, for a deployment that is
 * public but not for search, such as the preview before launch. Every response then says `X-Robots-Tag: noindex,
 * nofollow` (`next.config.ts`) and robots.txt disallows everything, with no sitemap (`app/robots.ts`). Both are read
 * when Next builds, so set it in the host's build environment. `next.config.ts` repeats this check rather than import
 * it, because that file's imports are limited.
 */
export function isSiteHidden(): boolean {
  return process.env.VOSSIE_NOINDEX === "1";
}
