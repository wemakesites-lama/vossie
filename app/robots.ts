import type { MetadataRoute } from "next";
import { isSiteHidden } from "@/lib/site-hidden";
import { siteUrl } from "@/lib/site-url";

// Pages that belong to one person or one device (info and system spec 2.8). A Disallow matches from the start of the
// address, so a bare "/sell" would also hide every storefront at /sellers/…; `$` ends a pattern, so "/sell$" is the
// pitch page and "/sell/" is everything under it (plan decision 8). Staff pages aren't listed: naming them would
// advertise them, and they answer 404 to everyone else (staff tools decision 1).
// Messaging's pages belong to one person too (messaging plan decision 24); "*" matches any listing or shop.
// A Hub post's slot request page (`/hub/*/book`) belongs to one student (staff tools plan, Task 15).
// Looking For's forms belong to one person, and the offline page is the worker's (community actions plan decision 23).
const DISALLOWED = [
  "/saved",
  "/login",
  "/account",
  "/sell$",
  "/sell/",
  "/messages",
  "/notifications",
  "/report",
  "/listings/*/message",
  "/sellers/*/message",
  "/hub/*/book",
  "/looking-for/new",
  "/looking-for/*/offer",
  "/looking-for/*/edit",
  "/looking-for/*/delete",
  "/offline",
];

export default function robots(): MetadataRoute.Robots {
  // The whole site hidden from search engines (decision 68): nothing to crawl, so no sitemap either.
  if (isSiteHidden()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOWED },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
