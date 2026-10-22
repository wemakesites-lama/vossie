import { onSupabase } from "@/lib/backend";

// Sign-in settings (accounts spec 2.1 to 2.7 and section 5). Plain values and functions: safe anywhere on the server.

/** The privacy policy version a student agrees to at sign-in (spec 2.7). Change it when the policy changes. */
export const POLICY_VERSION = "2026-10-draft";

const POLICY_LABELS: ReadonlyMap<string, string> = new Map([["2026-10-draft", "draft of October 2026"]]);

/** How the privacy settings page names a policy version: "draft of October 2026" (spec 3.3). */
export function policyLabel(version: string): string {
  return POLICY_LABELS.get(version) ?? version;
}

/** A code lasts 10 minutes, and 5 wrong tries end the attempt (spec 2.2). */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_WRONG_TRIES = 5;
/** At most 5 codes per email per hour, in sample mode (spec 5). */
export const CODES_PER_HOUR = 5;
/**
 * On Supabase, at most 15 codes an hour from one network (IP address) too, whatever the addresses (phase B review fix
 * 2), so one visitor can't use up the project's hourly emails. Sample mode sends no email and keeps its per-email limit
 * only.
 */
export const IP_SENDS_PER_HOUR = 15;
/** A sign-in attempt, all three steps, must finish within 30 minutes of starting. */
export const ATTEMPT_TTL_MS = 30 * 60 * 1000;
/**
 * A step's errors, and "We sent a new code.", show for a minute after the post that set them (spec 3.1). They belong to
 * that post; the attempt itself lasts 30 minutes, and a later visit starts clean.
 */
export const SIGN_IN_ERRORS_SHOW_MS = 60 * 1000;
/** A session lasts 30 days (spec 2.5). On Supabase, the cookie's lifetime and the idle job's window (phase B decision 3). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A signed-in form's errors or notice last 10 minutes (plan decision 3). */
export const FORM_STATE_TTL_MS = 10 * 60 * 1000;
/** A flash message's cookie lasts a minute (plan decision 12). */
export const FLASH_TTL_SECONDS = 60;

type Env = Readonly<Record<string, string | undefined>>;

/** How this server signs people in: the sample store, Supabase Auth, or not at all (Supabase phase B decision 1). */
export type SignInMode = "sample" | "supabase" | "off";

/** Supabase whenever VOSSIE_BACKEND says so (lib/backend.ts), whatever VOSSIE_SAMPLE_MODE says; else sample unless it's "0". */
export function signInMode(env: Env = process.env): SignInMode {
  if (onSupabase(env)) return "supabase";
  return env.VOSSIE_SAMPLE_MODE !== "0" ? "sample" : "off";
}

/** Sample mode (spec 2.1): the sample backend with VOSSIE_SAMPLE_MODE not "0". Never on Supabase (stage K amendment 7). */
export function isSampleMode(env: Env = process.env): boolean {
  return signInMode(env) === "sample";
}

/**
 * The demo sign-in (Lama, 2026-10-22): on Supabase with VOSSIE_DEMO_SIGN_IN "1", the sign-in page offers the five sample
 * accounts' buttons, each signing in to its seed account (name@vossie.test) with no code. Anyone can then act as the
 * Admin, so it's for demos before students are onboarded: unset it before the first real student signs in.
 */
export function isDemoSignIn(env: Env = process.env): boolean {
  return onSupabase(env) && env.VOSSIE_DEMO_SIGN_IN === "1";
}

/**
 * The domains that can sign in when VOSSIE_EMAIL_DOMAINS lists none: students sign in as eduv and 7 digits at
 * vossie.net, staff at eduvos.com (Lama, 2026-10-21). Exact domains only, no subdomains. Production's database gets the
 * same list from supabase/migrations/20261021120000_reference_data.sql, which scripts/reference-sql.ts writes from this.
 */
export const DEFAULT_EMAIL_DOMAINS = ["eduvos.com", "vossie.net"] as const;

/** The domains that can sign in (spec 2.4): VOSSIE_EMAIL_DOMAINS, comma-separated, or else DEFAULT_EMAIL_DOMAINS. */
export function emailDomains(env: Env = process.env): string[] {
  const listed = (env.VOSSIE_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  return listed.length > 0 ? listed : [...DEFAULT_EMAIL_DOMAINS];
}
