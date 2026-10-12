import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
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
