import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Pages that belong to one person or one device (info and system spec 2.8). A Disallow matches from the start of the
// address, so a bare "/sell" would also hide every storefront at /sellers/…; `$` ends a pattern, so "/sell$" is the
// pitch page and "/sell/" is everything under it (plan decision 8). Staff pages aren't listed: naming them would
// advertise them, and they answer 404 to everyone else (staff tools decision 1).
const DISALLOWED = ["/saved", "/login", "/account", "/sell$", "/sell/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOWED },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
