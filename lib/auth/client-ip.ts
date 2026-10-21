import { headers } from "next/headers";

// The visitor's IP address, for the per-network send budget (Supabase phase B, review fix 2). Request-time: Server
// Actions and Route Handlers only.

/**
 * The visitor's IP address from a request's headers: Vercel's x-real-ip (which a visitor can't set), else the first
 * x-forwarded-for entry; null when neither has one. Nothing is blocked without an address.
 */
export function ipFrom(requestHeaders: Pick<Headers, "get">): string | null {
  const real = requestHeaders.get("x-real-ip")?.trim();
  if (real) return real;
  const first = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || null;
}

/** This request's visitor's IP address, or null. */
export async function clientIp(): Promise<string | null> {
  return ipFrom(await headers());
}
