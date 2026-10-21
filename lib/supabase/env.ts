import "server-only";

/**
 * Which store lib/data uses (spec decision 10). It lives in lib/backend.ts, a plain module, so lib/data's sample path
 * and lib/auth can read it without this server-only one (2b plan decision 16); re-exported here for its callers.
 */
export { backend, type Backend } from "@/lib/backend";

// The backend's settings (backend spec section 8), read when a client is made, never kept at module scope. A missing
// or malformed value throws with the variable's name and never its value, so a key can't end up in a log. Only the
// server reads these: none is NEXT_PUBLIC_, and the browser never talks to Supabase (spec decision 5).

type Env = Readonly<Record<string, string | undefined>>;

function required(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** SUPABASE_URL: the project's address, http or https, with no path. */
export function supabaseUrl(env: Env = process.env): string {
  const value = required(env, "SUPABASE_URL");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SUPABASE_URL is not a URL");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SUPABASE_URL must be an http or https address with no path");
  }
  return url.origin;
}

/** SUPABASE_PUBLISHABLE_KEY: the new publishable key (sb_publishable_…), never a legacy or secret one (spec decision 6). */
export function publishableKey(env: Env = process.env): string {
  const value = required(env, "SUPABASE_PUBLISHABLE_KEY");
  if (!value.startsWith("sb_publishable_")) throw new Error("SUPABASE_PUBLISHABLE_KEY must be a publishable key (sb_publishable_…)");
  return value;
}

/** SUPABASE_SECRET_KEY: the new secret key (sb_secret_…). It bypasses every access rule: server only. */
export function secretKey(env: Env = process.env): string {
  const value = required(env, "SUPABASE_SECRET_KEY");
  if (!value.startsWith("sb_secret_")) throw new Error("SUPABASE_SECRET_KEY must be a secret key (sb_secret_…)");
  return value;
}
