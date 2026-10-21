import { cookies, headers } from "next/headers";
import { FLASH_COOKIE, type FlashCode } from "@/lib/flash";
import { FLASH_TTL_SECONDS } from "./config";

// The cookies sign-in uses (accounts spec 2.2 and 2.5, plan decision 12). Reading works anywhere on the server inside
// <Suspense>; setting and deleting only in Server Actions and route handlers.

/** The session: a random token, httpOnly, 30 days (spec 2.5). */
export const SESSION_COOKIE = "vossie_session";
/** A sign-in in progress: a random token, httpOnly, 30 minutes (spec 2.2). */
export const SIGN_IN_COOKIE = "vossie_signin";

/**
 * Whether a request with these headers came over HTTPS: its x-forwarded-proto's first entry. For code that has the
 * request itself (proxy.ts's renewal client); everything else calls isHttps().
 */
export function isHttpsRequest(requestHeaders: Pick<Headers, "get">): boolean {
  const proto = requestHeaders.get("x-forwarded-proto") ?? "";
  return proto.split(",")[0].trim() === "https";
}

/** Whether the request came over HTTPS (plan decision 18). Next sets x-forwarded-proto, and so do hosts. */
export async function isHttps(): Promise<boolean> {
  return isHttpsRequest(await headers());
}

export async function readCookieValue(name: string): Promise<string | null> {
  return (await cookies()).get(name)?.value ?? null;
}

/** A cookie only the server can read: httpOnly, Lax, the whole site, and Secure on HTTPS (spec 2.5). */
export async function setPrivateCookie(name: string, value: string, maxAgeSeconds: number): Promise<void> {
  (await cookies()).set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function deleteCookie(name: string): Promise<void> {
  (await cookies()).delete(name);
}

/** Leaves a flash code for the next page (plan decision 12): readable, so the toast can delete it once shown. */
export async function setFlash(code: FlashCode): Promise<void> {
  (await cookies()).set(FLASH_COOKIE, code, {
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: FLASH_TTL_SECONDS,
  });
}
