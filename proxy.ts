import type { NextRequest } from "next/server";
import { renewFromProxy } from "@/lib/data/session-renewal";

/**
 * Renews the Supabase session before pages render, since Server Components can't write cookies (backend spec 5;
 * Supabase phase B, Task 6). The matcher must cover every page and Route Handler (a Server Function is a POST to its
 * page), and only for a request that carries the session cookie (vossie_auth, or its first chunk, vossie_auth.0), so a
 * signed-out visitor, and every visitor in sample mode, never reaches the proxy at all ("signed-out visitors pay
 * nothing", spec 5). renewFromProxy still returns at once on the sample backend and for an empty cookie.
 */
export function proxy(request: NextRequest) {
  return renewFromProxy(request);
}

// Next reads the matcher at build time, so each entry is written out in full (no shared constant).
export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|photos/|sw\\.js|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|icons/|.*\\.[a-z0-9]+$).*)",
      has: [{ type: "cookie", key: "vossie_auth" }],
    },
    {
      source:
        "/((?!_next/static|_next/image|photos/|sw\\.js|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|icons/|.*\\.[a-z0-9]+$).*)",
      has: [{ type: "cookie", key: "vossie_auth.0" }],
    },
  ],
};
