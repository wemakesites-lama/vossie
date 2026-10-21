import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { renewalClient, type RenewalWrites } from "@/lib/supabase/renewal";

// The proxy's renewal on Supabase (phase B decision 4, amendments 1, 3 and 4). Only the proxy refreshes a session: a
// page render reads the session it's given and never refreshes (lib/data/supabase/auth-session.ts). The façade
// (lib/data/session-renewal.ts) has already returned for the sample backend and for a request with no vossie_auth cookie.

/**
 * Renews the request's session when it ends within 90 seconds. Renewed cookies go on the request passed on, so the
 * render reads the new session, and on the response, at 30 days (the renewal client's setAll), with Supabase's no-store
 * headers, so no response that sets someone's session is cached (spec 5). A removal (an ended session) comes off both.
 * If Supabase can't be reached, the request goes on untouched and the render reads the old session, which shows signed
 * out once its access token has expired; the next request tries again.
 */
export async function renewFromProxy(request: NextRequest): Promise<NextResponse> {
  let writes: RenewalWrites | null = null;
  try {
    await renewalClient(request, (w) => {
      writes = w;
    }).renew();
  } catch {
    // Never the error itself: it could carry the request's cookie.
    console.error("[vossie] session renewal failed");
    return NextResponse.next();
  }
  const renewed = writes as RenewalWrites | null;
  if (!renewed || renewed.cookies.length === 0) return NextResponse.next();
  for (const { name, value, options } of renewed.cookies) {
    if (options.maxAge === 0) request.cookies.delete(name);
    else request.cookies.set(name, value);
  }
  const response = NextResponse.next({ request });
  for (const { name, value, options } of renewed.cookies) {
    if (options.maxAge !== 0) response.cookies.set(name, value, options);
  }
  // Removals go straight onto the response's headers, after the sets (response.cookies rewrites every Set-Cookie line
  // it doesn't hold). Next copies what's set through response.cookies into the render's cookies and writes it out again
  // without its Max-Age=0 (request-store.js, mergeMiddlewareCookies), which would leave an empty vossie_auth in the
  // browser for the rest of its session.
  for (const { name, options } of renewed.cookies) {
    if (options.maxAge === 0) response.headers.append("Set-Cookie", removal(name, options));
  }
  for (const [header, value] of Object.entries(renewed.headers)) response.headers.set(header, value);
  return response;
}

/** A Set-Cookie line that removes `name` where it was written (its path), with the attributes it was written with. */
function removal(name: string, options: CookieOptions): string {
  const sameSite = typeof options.sameSite === "string" ? options.sameSite : options.sameSite ? "strict" : null;
  return [
    `${name}=`,
    `Path=${options.path ?? "/"}`,
    "Max-Age=0",
    options.httpOnly ? "HttpOnly" : null,
    sameSite ? `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1).toLowerCase()}` : null,
    options.secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}
