import { getCampuses } from "@/lib/data";
import {
  completeProfile,
  createAccount,
  findAccountByEmail,
  getSampleSignIns,
  hasProfile,
  recordConsent,
  restoreSampleAccount,
} from "@/lib/data/accounts";
import {
  readClaims,
  sendSignInCode,
  signInDemo,
  signOutHere,
  type SendOutcome,
  verifySignInCode,
} from "@/lib/data/auth-session";
import type { SignInAttemptRow, SignInError } from "@/lib/data/rows";
import { restoreSampleShop } from "@/lib/data/shops";
import {
  deleteSignInAttempt,
  getSignInAttempt,
  recordWrongTry,
  reserveCodeSend,
  reserveIpSend,
  saveSampleEmail,
  saveSignInAttempt,
} from "@/lib/data/sign-in";
import { sellersChangedNow } from "@/lib/data/tags";
import { safeNextPath, signInHref } from "@/lib/next-path";
import { clientIp } from "./client-ip";
import {
  ATTEMPT_TTL_MS,
  CODE_TTL_MS,
  CODES_PER_HOUR,
  IP_SENDS_PER_HOUR,
  isDemoSignIn,
  isSampleMode,
  MAX_WRONG_TRIES,
  POLICY_VERSION,
  signInMode,
} from "./config";
import { deleteCookie, readCookieValue, setPrivateCookie, SIGN_IN_COOKIE } from "./cookies";
import { normaliseEmail } from "./email";
import { checkCampus, checkFirstName } from "./profile";
import { seedEmail } from "./seed-email";
import { codeMatches, hashCode, hashIp, hashToken, newCode, newToken } from "./secrets";
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
  // With sign-in off nothing is hashed, so a missing key can't break a sign-in post (stage K plan amendment 3).
  if (signInMode() === "off") return null;
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

/** Supabase's refusals to send, as the sign-in page words them (Supabase phase B decision 6). */
const SEND_ERRORS: Readonly<Record<Exclude<SendOutcome, "sent">, SignInError>> = {
  "too-soon": "code-soon",
  "ip-rate": "ip-rate",
  refused: "email-domain",
  failed: "send-failed",
};

/** Supabase sends a code to an address at most once a minute (its own limit). */
const CODE_EVERY_MS = 60 * 1000;

/** Whether the attempt's code went less than a minute before `now` (its expiry less the code's 10 minutes). */
function sentWithinMinute(attempt: SignInAttemptRow, now: Date): boolean {
  if (!attempt.codeExpiresAt) return false;
  return now.getTime() - (Date.parse(attempt.codeExpiresAt) - CODE_TTL_MS) < CODE_EVERY_MS;
}

/**
 * Whether this visitor's network may have another code this hour (review fix 2): one of its 15 is counted, under the IP
 * address's keyed hash. A request with no IP address isn't blocked.
 */
async function networkHasRoom(now: Date): Promise<boolean> {
  const ip = await clientIp();
  return ip === null || reserveIpSend(hashIp(ip), now, IP_SENDS_PER_HOUR);
}

/**
 * Sends a code (spec 2.2, 2.3 and 5): one of the email's 5 an hour first, then the code. A new code gives 5 fresh tries
 * (plan decision 6). The error to show, or null when it went: "email-rate" when this email has had its 5 codes this
 * hour, and nothing sent.
 *
 * Sample mode makes the code, keeps only its hash on the attempt and "sends" it to its outbox. On Supabase, Supabase
 * Auth makes and emails it (Supabase phase B decision 6): a code asked for within a minute of the last is refused before
 * one of the hour's is used (amendment 6), and a refusal from Supabase keeps the hour's code it reserved. The network's
 * 15 an hour come before the email's 5 (review fix 2), so a visitor sending to many addresses uses up nobody's codes
 * once refused: "ip-rate", and Supabase isn't asked.
 */
export async function sendCode(attempt: SignInAttemptRow, now: Date): Promise<SignInError | null> {
  const mode = signInMode();
  if (mode === "supabase" && sentWithinMinute(attempt, now)) return "code-soon";
  if (mode === "supabase" && !(await networkHasRoom(now))) return "ip-rate";
  // The place is counted and taken in one step, so posts at once can't each find room and all send (spec 5).
  if (!(await reserveCodeSend(attempt.email, now, CODES_PER_HOUR))) return "email-rate";
  if (mode === "supabase") {
    const sent = await sendSignInCode(attempt.email);
    if (sent !== "sent") return SEND_ERRORS[sent];
    attempt.codeHash = null;
    attempt.codeExpiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
    attempt.wrongTries = 0;
    return null;
  }
  const code = newCode();
  attempt.codeHash = hashCode(attempt.key, code);
  attempt.codeExpiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  attempt.wrongTries = 0;
  // Sample mode has no email service: its outbox stands in for one, and the sign-in page shows the code from it
  // (plan decision 5). The real email service replaces this call.
  await saveSampleEmail({ attemptKey: attempt.key, to: attempt.email, code, sentAt: now.toISOString() });
  return null;
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
  const mode = signInMode();
  const attempt = await currentAttempt(now);
  // On Supabase the attempt holds no code hash: Supabase Auth keeps the code.
  if (!attempt || attempt.step !== "code" || !attempt.codeExpiresAt || (mode === "sample" && !attempt.codeHash)) {
    return signInPath(next);
  }
  const code = text(formData, "code").replace(/\s/g, "");
  attempt.resent = false;
  if (Date.parse(attempt.codeExpiresAt) <= now.getTime()) {
    attempt.errors = ["code-expired"];
  } else if (!/^\d{6}$/.test(code)) {
    attempt.errors = ["code-missing"];
  } else if (mode === "supabase") {
    return finishCodeOnSupabase(attempt, code, next, now);
  } else if (attempt.codeHash && codeMatches(attempt.key, code, attempt.codeHash)) {
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
      lockOut(attempt);
    }
  }
  await saveAfterPost(attempt, now);
  return signInPath(next);
}

/** The fifth wrong try ends the attempt (spec 2.2): back to step 1, the email kept, the code gone. The caller saves it. */
function lockOut(attempt: SignInAttemptRow): void {
  attempt.step = "email";
  attempt.codeHash = null;
  attempt.codeExpiresAt = null;
  attempt.errors = ["locked"];
}

/**
 * Step 2 on Supabase (Supabase phase B decision 2). Supabase can't compare a code without using it, so every try is
 * counted, in one statement, before Supabase sees the code: the 5th wrong one ends the attempt, and a 6th post is
 * refused without reaching Supabase. A count of 0 means the attempt went (swept, or ended in another tab) between the
 * read and the count: back to sign-in, nothing sent (amendment 2).
 */
async function finishCodeOnSupabase(attempt: SignInAttemptRow, code: string, next: string | null, now: Date): Promise<string> {
  const tries = await recordWrongTry(attempt.key);
  if (tries < 1) return signInPath(next);
  attempt.wrongTries = tries;
  if (tries > MAX_WRONG_TRIES) {
    lockOut(attempt);
    await saveAfterPost(attempt, now);
    return signInPath(next);
  }
  // A session id is never reused (spec 2.5): a browser already signed in is signed out here first. Read afresh, not
  // from React's cache (amendment 12).
  if ((await readClaims()) !== null) await signOutHere();
  const verified = await verifySignInCode(attempt.email, code);
  if (verified === "ip-rate" || verified === "failed") {
    // The try still counts. Words for a check that failed, not a send (amendment 18).
    attempt.errors = [verified === "ip-rate" ? "ip-rate" : "code-check-failed"];
  } else if (verified === "wrong") {
    if (tries < MAX_WRONG_TRIES) attempt.errors = ["code-wrong"];
    else lockOut(attempt);
  } else if (await hasProfile(verified.userId)) {
    // verifyOtp has set vossie_auth, and cookies() reads it back in this same request, so these run as the new session.
    await recordConsent(verified.userId, POLICY_VERSION, now);
    await endAttempt(now);
    return afterSignInPath(next);
  } else {
    // A first sign-in: on to step 3. The session exists, but without a profile it's no account yet (decision 7).
    attempt.step = "profile";
    attempt.codeExpiresAt = null;
    attempt.errors = [];
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
  const attempt = await currentAttempt(now);
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
  if (signInMode() === "supabase") {
    // The session verifyOtp made at step 2, read afresh (amendment 12). Gone, or another address's (amendment 11): the
    // attempt ends, back to step 1. complete_profile takes the account from the session and stamps consent itself
    // (phase B decision 9); another tab that finished first leaves its account as it is.
    const claims = await readClaims();
    if (!claims || claims.email !== attempt.email) {
      await endAttempt(now);
      return signInPath(next);
    }
    await completeProfile({ email: attempt.email, firstName: name.value, campusSlug, policyVersion: POLICY_VERSION, now });
    await endAttempt(now);
    return afterSignInPath(next);
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
  if (isDemoSignIn()) return finishDemo(formData, next, now);
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

/**
 * The same buttons on Supabase, with the demo sign-in on (isDemoSignIn): only one of the five fixtures' addresses, as
 * its seed account. A browser already signed in is signed out first, as a code sign-in does. An account without a
 * profile (deleted, or never seeded) isn't signed in: back to sign-in.
 */
async function finishDemo(formData: FormData, next: string | null, now: Date): Promise<string> {
  const email = normaliseEmail(text(formData, "email"));
  if (!(await getSampleSignIns()).some((sample) => sample.email === email)) return signInPath(next);
  if ((await readClaims()) !== null) await signOutHere();
  const signedIn = await signInDemo(seedEmail(email));
  if (signedIn === "wrong" || signedIn === "failed" || signedIn === "ip-rate") return signInPath(next);
  if (!(await hasProfile(signedIn.userId))) {
    console.error("[vossie] demo sign-in: the seed account has no profile");
    await signOutHere();
    return signInPath(next);
  }
  await endAttempt(now);
  return afterSignInPath(next);
}
