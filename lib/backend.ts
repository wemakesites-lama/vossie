// Which store lib/data uses (backend spec decision 10; 2b plan decisions 15 and 16). The one place VOSSIE_BACKEND is
// read. A plain module that depends on nothing (its test checks), so lib/data's sample path, a unit test and phase B's
// lib/auth can all read it without pulling in lib/supabase, whose modules are server-only. lib/supabase/env.ts
// re-exports backend() for its own callers. Read on each call, never kept at module scope, so a test can switch it.

type Env = Readonly<Record<string, string | undefined>>;

/** The in-memory sample store (the default until launch) or Supabase. */
export type Backend = "sample" | "supabase";

/** VOSSIE_BACKEND: "sample" (also when unset or blank) or "supabase". Anything else throws, naming the variable only. */
export function backend(env: Env = process.env): Backend {
  const value = env.VOSSIE_BACKEND?.trim() || "sample";
  if (value !== "sample" && value !== "supabase") throw new Error('VOSSIE_BACKEND must be "sample" or "supabase"');
  return value;
}

/** Whether lib/data reads Supabase: the one switch each twin's caller checks (2b plan amendment 10). */
export function onSupabase(env: Env = process.env): boolean {
  return backend(env) === "supabase";
}
