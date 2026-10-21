// Supabase's session cookie's name (backend spec 5; Supabase phase B amendment 4). A plain module with no imports, so
// the proxy can tell whether a request carries a session without loading any Supabase code. lib/supabase/cookies.ts
// re-exports these.

/** Supabase's session cookie, renamed so every cookie is vossie_… (the privacy page's test). Chunked as .0, .1 when long. */
export const AUTH_COOKIE = "vossie_auth";

/** Supabase's session cookie, or one of its chunks: vossie_auth, vossie_auth.0, vossie_auth.1, … */
export function isAuthCookie(name: string): boolean {
  return name === AUTH_COOKIE || /^vossie_auth\.\d+$/.test(name);
}
