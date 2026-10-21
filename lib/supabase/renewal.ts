import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, SESSION_MAX_AGE, sessionLifetime } from "./cookies";
import type { Database } from "./database.types";
import { secretKey, supabaseUrl } from "./env";

export type RenewalWrites = {
  cookies: { name: string; value: string; options: CookieOptions }[];
  headers: Record<string, string>;
};
export type RenewalClient = { renew(): Promise<{ signedIn: boolean }> };

/**
 * The proxy's client (Supabase phase B decision 4): the request's cookies, the secret key and the student's address
 * (Vercel's x-real-ip, which a visitor can't set) in Sb-Forwarded-For, so a refresh counts against that student's
 * limit rather than all of Vercel's. One call: renew(), which checks the session and refreshes it when it ends within
 * 90 seconds. Every write goes to `onSet`, each set cookie at 30 days and a removal at 0 (amendment 1), with Supabase's
 * no-store headers, for the proxy to put on the request and the response. Only the proxy refreshes (amendment 3).
 */
export function renewalClient(request: NextRequest, onSet: (writes: RenewalWrites) => void): RenewalClient {
  const address = request.headers.get("x-real-ip")?.trim();
  const client = createServerClient<Database>(supabaseUrl(), secretKey(), {
    cookieOptions: {
      name: AUTH_COOKIE,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
    cookies: {
      getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookies, headers) =>
        onSet({ cookies: cookies.map(({ name, value, options }) => ({ name, value, options: sessionLifetime(options) })), headers }),
    },
    global: { headers: address ? { "Sb-Forwarded-For": address } : {} },
  });
  return {
    async renew() {
      const { data, error } = await client.auth.getClaims();
      return { signedIn: !error && Boolean(data?.claims?.sub) };
    },
  };
}
