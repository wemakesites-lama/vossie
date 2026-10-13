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
  // Always build from scratch. Once, a cached build kept serving stale Tailwind CSS after
  // globals.css changed, and the end-to-end tests build before every run.
  // The dev cache is off for the same reason: a cached dev session served stale CSS after globals.css changed.
  experimental: {
    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
