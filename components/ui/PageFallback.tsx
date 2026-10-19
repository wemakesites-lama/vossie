/**
 * The fallback for a page whose whole content waits on its params inside <Suspense> (the listing, storefront, request,
 * collection and Hub post pages). The content is prerendered, but React still sends it after the rest of the page (the
 * layout alone is over its 12.8 KB first chunk) and shows it no sooner than 300 ms after the first paint. On a slow
 * network, with the CSS cached, that first paint has this fallback in the content's place. It's a screen tall, less the
 * header, so the footer stays below the first screen until the content takes over, rather than sitting under the
 * header and then jumping down.
 */
export function PageFallback() {
  return <div className="page-fallback" aria-hidden="true" />;
}
