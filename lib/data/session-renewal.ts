import { NextResponse, type NextRequest } from "next/server";
import { onSupabase } from "@/lib/backend";
import { isAuthCookie } from "@/lib/auth/cookie-names";

// The proxy's session renewal (Supabase phase B decision 5, amendment 4): proxy.ts reaches Supabase only through here.
// It returns at once, loading no Supabase code, on the sample backend and for a visitor with no vossie_auth cookie
// ("signed-out visitors pay nothing", spec 5). The renewal itself is lib/data/supabase/session-renewal.ts (Task 6).

/** Renews the request's Supabase session before the page renders, or passes the request on untouched. */
export async function renewFromProxy(request: NextRequest): Promise<NextResponse> {
  // An empty vossie_auth is no session: nothing to renew.
  if (!onSupabase() || !request.cookies.getAll().some(({ name, value }) => isAuthCookie(name) && value !== "")) {
    return NextResponse.next();
  }
  return (await import("./supabase/session-renewal")).renewFromProxy(request);
}
