import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Resized photos are never kept on the server's disk (selling plan decision 12): a photo deleted with its listing
    // or its account must not be served again. Browsers still keep what they're sent. Only uploaded photos are
    // resized; the SVG placeholders never are.
    maximumDiskCacheSize: 0,
    // A resized photo is kept for the larger of this and the photo's own max-age, which /photos/[id] sets to an hour
    // for a photo that's everyone's, so a hidden or deleted listing's photo stops being served within about an hour
    // (fix 2 of the review after C2 and C3). The default is 4 hours.
    minimumCacheTTL: 3600,
  },
  // The old category and campus pages are now browse views (browse and listing spec 3.1). Temporary (307), so either
  // can get its own page later, such as a campus home. A redirect keeps the request's own query as well.
  async redirects() {
    return [
      { source: "/categories/:slug", destination: "/browse?cat=:slug", permanent: false },
      { source: "/c/:campus", destination: "/browse?campus=:campus", permanent: false },
    ];
  },
  // Security headers on every response (info and system spec 2.9). There is no Content Security Policy yet: it needs a
  // nonce per request for Next's inline scripts, which would make every prerendered page dynamic (go-live checklist).
  // Strict-Transport-Security is for production only, so a development server on http doesn't send it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
          // The whole site hidden from search engines (decision 68). The same check as `isSiteHidden()` in
          // `lib/site-hidden.ts`, written out because this file's imports are limited (Next's TypeScript config docs).
          ...(process.env.VOSSIE_NOINDEX === "1" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
        ],
      },
    ];
  },
  // Always build from scratch. Once, a cached build kept serving stale Tailwind CSS after
  // globals.css changed, and the end-to-end tests build before every run.
  // The dev cache is off for the same reason: a cached dev session served stale CSS after globals.css changed.
  experimental: {
    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false,
    // Experimental, production builds only (decision 63). A low request cost makes Turbopack merge the two small
    // layout chunks into one on every page: about 0.5 KB brotli less and one request fewer on a first visit. It's a
    // threshold effect (0 to 5000 merges; 7500 and above, including the default 200000, doesn't), so it can shrink
    // as the code changes: performance.spec.ts is the guard. Don't add firstPageLoadPriority here: it cancels it.
    turbopackChunking: { requestCost: 1000 },
    // Photos reach Server Actions as plain form posts. Vercel refuses a body over 4.5 MB before the action runs, so a
    // listing's new photos come to 4 MiB at most (lib/photos/rules.ts), and a shop photo or a Hub cover is one photo of
    // 4 MB at most; with the form's text and the multipart overhead, 5 MB holds every form (fix 3 of the review after
    // C2 and C3; next.config.test.ts).
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
