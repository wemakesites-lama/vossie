import { isDemoSignIn, isSampleMode } from "@/lib/auth/config";

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The mock call (Lama, 2026-11-05, for the HackJam presentation): a thread's Call opens a call screen that rings, says
 * "Connected" and calls nobody. Only where the site is a demo: sample mode, or Supabase with the demo sign-in on. Turning
 * the demo sign-in off before real students arrive (a GO-LIVE gate) brings back "Calls coming soon" by itself.
 */
export function mockCallOn(env: Env = process.env): boolean {
  return isSampleMode(env) || isDemoSignIn(env);
}
