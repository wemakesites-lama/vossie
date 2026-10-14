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
/** A sign-in attempt, all three steps, must finish within 30 minutes of starting. */
export const ATTEMPT_TTL_MS = 30 * 60 * 1000;
/** A session lasts 30 days (spec 2.5). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A signed-in form's errors or notice last 10 minutes (plan decision 3). */
export const FORM_STATE_TTL_MS = 10 * 60 * 1000;
/** A flash message's cookie lasts a minute (plan decision 12). */
export const FLASH_TTL_SECONDS = 60;

type Env = Readonly<Record<string, string | undefined>>;

/** Sample mode (spec 2.1): on unless VOSSIE_SAMPLE_MODE is "0". */
export function isSampleMode(env: Env = process.env): boolean {
  return env.VOSSIE_SAMPLE_MODE !== "0";
}

/** The domains that can sign in (spec 2.4): VOSSIE_EMAIL_DOMAINS, comma-separated, or else eduvos.com. */
export function emailDomains(env: Env = process.env): string[] {
  const listed = (env.VOSSIE_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  return listed.length > 0 ? listed : ["eduvos.com"];
}
