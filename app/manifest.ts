import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vossie · The Eduvos student marketplace",
    short_name: "Vossie",
    description: "Buy and sell textbooks, tech and services with students on your Eduvos campus.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#15305D",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
