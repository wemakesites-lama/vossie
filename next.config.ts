import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
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
  },
};

export default nextConfig;
