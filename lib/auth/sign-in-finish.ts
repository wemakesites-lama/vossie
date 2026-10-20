import { getCampuses } from "@/lib/data";
import { createAccount, findAccountByEmail, recordConsent, restoreSampleAccount } from "@/lib/data/accounts";
import type { SignInAttemptRow, SignInError } from "@/lib/data/rows";
import { restoreSampleShop } from "@/lib/data/shops";
import {
  deleteSignInAttempt,
  getSignInAttempt,
  recordWrongTry,
  reserveCodeSend,
  saveSampleEmail,
  saveSignInAttempt,
} from "@/lib/data/sign-in";
import { sellersChangedNow } from "@/lib/data/tags";
import { safeNextPath, signInHref } from "@/lib/next-path";
import { ATTEMPT_TTL_MS, CODE_TTL_MS, CODES_PER_HOUR, isSampleMode, MAX_WRONG_TRIES, POLICY_VERSION } from "./config";
import { deleteCookie, readCookieValue, setPrivateCookie, SIGN_IN_COOKIE } from "./cookies";
import { normaliseEmail } from "./email";
import { checkCampus, checkFirstName } from "./profile";
import { codeMatches, hashCode, hashToken, newCode, newToken } from "./secrets";
import { startSession } from "./session";

// Signing in's steps (accounts spec 2 and 3), shared by the Server Actions in actions.ts (step 1, a new code, a
// different email) and the Route Handlers that finish a sign-in (app/login/code, profile and sample; stage K spec
// decision 2). A plain module, not "use server": every async function a "use server" file exports is an endpoint, and
// these helpers must never be (plan decision 8). Nothing here redirects: each step returns the path to go to.

// --- Shared helpers -------------------------------------------------------------------------------------------------

/** A form field as text. A missing field, or a file, is "". */
export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** The `next` path the form carried, when it's a safe path on this site (spec 2.10). */
export function nextFrom(formData: FormData): string | null {
  return safeNextPath(text(formData, "next") || undefined);
}

/** The sign-in page again, keeping `next`. */
export function signInPath(next: string | null): string {
  return next ? signInHref(next) : "/login";
}

/** Where a finished sign-in goes (accounts plan decision 9): `next`, unless it's the sign-in page itself; else the account. */
export function afterSignInPath(next: string | null): string {
  return next && !next.startsWith("/login") ? next : "/account";
}

/** This browser's sign-in attempt, while it hasn't run out. */
export async function currentAttempt(now: Date): Promise<SignInAttemptRow | null> {
  // With sample mode off nothing is hashed, so a missing key can't break a sign-in post (stage K plan amendment 3).
  if (!isSampleMode()) return null;
  const token = await readCookieValue(SIGN_IN_COOKIE);
  return token ? getSignInAttempt(hashToken(token), now) : null;
}

/** Ends this browser's attempt, if it has one, and clears its cookie. */
export async function endAttempt(now: Date): Promise<void> {
  const attempt = await currentAttempt(now);
  if (attempt) await deleteSignInAttempt(attempt.key);
  await deleteCookie(SIGN_IN_COOKIE);
}

/**
 * A new attempt under a new token, replacing this browser's old one, so a token is never reused. It has 30 minutes
 * for all three steps. The caller saves it.
 */
export async function beginAttempt(
  now: Date,
  fields: Pick<SignInAttemptRow, "email" | "errors" | "consentedAt">,
): Promise<SignInAttemptRow> {
  const old = await currentAttempt(now);
  if (old) await deleteSignInAttempt(old.key);
  const token = newToken();
  await setPrivateCookie(SIGN_IN_COOKIE, token, ATTEMPT_TTL_MS / 1000);
  return {
    key: hashToken(token),
    step: "email",
    resent: false,
    codeHash: null,
    codeExpiresAt: null,
    wrongTries: 0,
    firstName: "",
    campusSlug: "",
    postedAt: null,
    expiresAt: new Date(now.getTime() + ATTEMPT_TTL_MS).toISOString(),
    ...fields,
  };
}

/**
 * Saves an attempt as the post that's ending left it, stamped with that post's time. Every post sets the attempt's
 * `errors` (and `resent`) afresh, so the stamp tells the page how old they are: it shows them only straight after the
 * post, not on a visit 20 minutes later (spec 3.1, SIGN_IN_ERRORS_SHOW_MS).
 */
export async function saveAfterPost(attempt: SignInAttemptRow, now: Date): Promise<void> {
  attempt.postedAt = now.toISOString();
  await saveSignInAttempt(attempt, now);
}

/**
 * Makes a code, keeps only its hash on the attempt, and "sends" it (spec 2.2, 2.3 and 5). A new code gives 5 fresh
 * tries (plan decision 6). False, and nothing sent, when this email has had its 5 codes this hour.
 */
export async function sendCode(attempt: SignInAttemptRow, now: Date): Promise<boolean> {
  // The place is counted and taken in one step, so posts at once can't each find room and all send (spec 5).
  if (!(await reserveCodeSend(attempt.email, now, CODES_PER_HOUR))) return false;
  const code = newCode();
  attempt.codeHash = hashCode(attempt.key, code);
  attempt.codeExpiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  attempt.wrongTries = 0;
  // Sample mode has no email service: its outbox stands in for one, and the sign-in page shows the code from it
  // (plan decision 5). The real email service replaces this call.
  await saveSampleEmail({ attemptKey: attempt.key, to: attempt.email, code, sentAt: now.toISOString() });
  return true;
}

/** Finishes signing in: consent recorded, the attempt gone, a new session (spec 2.5 and 2.7). */
async function finishSignIn(accountId: string, attempt: SignInAttemptRow, now: Date): Promise<void> {
  await recordConsent(accountId, POLICY_VERSION, attempt.consentedAt ? new Date(attempt.consentedAt) : now);
  await deleteSignInAttempt(attempt.key);
  await deleteCookie(SIGN_IN_COOKIE);
  await startSession(accountId, now);
}

// --- The three posts that can start a session (stage K spec decision 2) ---------------------------------------------

/**
 * Step 2 (spec 3.1): the 6-digit code. Right, for an existing account: signed in, on to `next`. Right, for a new
 * email: on to step 3. Wrong: a try used, and the fifth ends the attempt, back on step 1 (spec 2.2). Expired: say so.
 * Not 6 digits: say so, without using a try. POST /login/code.
 */
export async function finishCode(formData: FormData, now: Date): Promise<string> {
  const next = nextFrom(formData);
  const attempt = isSampleMode() ? await currentAttempt(now) : null;
  if (!attempt || attempt.step !== "code" || !attempt.codeHash || !attempt.codeExpiresAt) return signInPath(next);
  const code = text(formData, "code").replace(/\s/g, "");
  attempt.resent = false;
  if (Date.parse(attempt.codeExpiresAt) <= now.getTime()) {
    attempt.errors = ["code-expired"];
  } else if (!/^\d{6}$/.test(code)) {
    attempt.errors = ["code-missing"];
  } else if (codeMatches(attempt.key, code, attempt.codeHash)) {
    const account = await findAccountByEmail(attempt.email);
    if (account) {
      await finishSignIn(account.id, attempt, now);
      return afterSignInPath(next);
    }
    attempt.step = "profile";
    attempt.codeHash = null;
    attempt.codeExpiresAt = null;
    attempt.errors = [];
  } else {
    // The try is counted in one step in the store, not read, added to and saved back with the row, so posts at once
    // each count their own and none is lost (spec 2.2).
    attempt.wrongTries = await recordWrongTry(attempt.key);
    if (attempt.wrongTries < MAX_WRONG_TRIES) {
      attempt.errors = ["code-wrong"];
    } else {
      // The fifth wrong try ends the attempt (spec 2.2): back to step 1, the email kept, the code gone.
      attempt.step = "email";
      attempt.codeHash = null;
      attempt.codeExpiresAt = null;
      attempt.errors = ["locked"];
    }
  }
  await saveAfterPost(attempt, now);
  return signInPath(next);
}

/**
 * Step 3, a first sign-in only (spec 2.6): a first name and a campus. Only now is the account made, consent recorded
 * and the session started (plan decision 8). POST /login/profile.
 */
export async function finishProfile(formData: FormData, now: Date): Promise<string> {
  const next = nextFrom(formData);
  const attempt = isSampleMode() ? await currentAttempt(now) : null;
  if (!attempt || attempt.step !== "profile") return signInPath(next);
  const name = checkFirstName(text(formData, "firstName"));
  const campuses = await getCampuses();
  const campusSlug = checkCampus(text(formData, "campus"), campuses.map((campus) => campus.slug));
  const errors: SignInError[] = [];
  if (name.error) errors.push(name.error);
  if (!campusSlug) errors.push("campus-missing");
  if (errors.length > 0 || !campusSlug) {
    attempt.errors = errors;
    attempt.firstName = name.value.slice(0, 80);
    attempt.campusSlug = campusSlug ?? "";
    await saveAfterPost(attempt, now);
    return signInPath(next);
  }
  // Another tab may have finished first: then this signs in to that account rather than making a second one.
  const account =
    (await findAccountByEmail(attempt.email)) ??
    (await createAccount({ email: attempt.email, firstName: name.value, campusSlug, now }));
  await finishSignIn(account.id, attempt, now);
  return afterSignInPath(next);
}

/** "Sign in as a sample account" (spec 2.8): straight in, in sample mode only, and only as one of the five. POST /login/sample. */
export async function finishSample(formData: FormData, now: Date): Promise<string> {
  const next = nextFrom(formData);
  if (!isSampleMode()) return signInPath(next);
  const account = await restoreSampleAccount(normaliseEmail(text(formData, "email")));
  if (!account) return signInPath(next);
  // A sample shop deleted with its account comes back with it, and its sample listings (selling plan, Task 7). A Route
  // Handler can't call updateTag (stage K spec decision 4).
  if (await restoreSampleShop(account.id)) sellersChangedNow();
  await endAttempt(now);
  await startSession(account.id, now);
  return afterSignInPath(next);
}
