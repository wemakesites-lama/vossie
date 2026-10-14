"use server";

import { redirect, RedirectType } from "next/navigation";
import { getCampuses } from "@/lib/data";
import {
  createAccount,
  deleteAccountData,
  findAccountByEmail,
  recordConsent,
  restoreSampleAccount,
  updateAccountDetails,
} from "@/lib/data/accounts";
import type { SignInAttemptRow, SignInError } from "@/lib/data/rows";
import {
  countCodesSent,
  deleteSignInAttempt,
  getSignInAttempt,
  recordCodeSent,
  saveSampleEmail,
  saveSignInAttempt,
} from "@/lib/data/sign-in";
import { safeNextPath, signInHref } from "@/lib/next-path";
import { ATTEMPT_TTL_MS, CODE_TTL_MS, CODES_PER_HOUR, isSampleMode, MAX_WRONG_TRIES, POLICY_VERSION } from "./config";
import { deleteCookie, readCookieValue, SESSION_COOKIE, setFlash, SIGN_IN_COOKIE, setPrivateCookie } from "./cookies";
import { checkEmail, normaliseEmail } from "./email";
import { DELETE_FORM, DETAILS_FORM, writeFormState } from "./form-state";
import { checkCampus, checkFirstName } from "./profile";
import { codeMatches, hashCode, hashToken, newCode, newToken } from "./secrets";
import { endSession, requireAccount, startSession } from "./session";

// The Server Actions behind every account form (accounts spec 2 and 3). Each is a plain form's action, so it works
// before the app's JavaScript arrives (plan decision 2). It checks its own input, takes identity only from the
// session, keeps errors in the store rather than the URL (plan decision 3), and ends with a redirect: back to the same
// page with `replace` while a form is under way (plan decision 19), elsewhere once it's done.

// --- Shared helpers ---------------------------------------------------------

/** A form field as text. A missing field, or a file, is "". */
function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** The `next` path the form carried, when it's a safe path on this site (spec 2.10). */
function nextFrom(formData: FormData): string | null {
  return safeNextPath(text(formData, "next") || undefined);
}

/** The sign-in page again, keeping `next`. */
function backToSignIn(next: string | null): never {
  redirect(next ? signInHref(next) : "/login", RedirectType.replace);
}

/** Where a finished sign-in goes (plan decision 9): `next`, unless it's the sign-in page itself; else the account. */
function afterSignIn(next: string | null): never {
  redirect(next && !next.startsWith("/login") ? next : "/account");
}

// --- Signing in ---------------------------------------------------------------

/** This browser's sign-in attempt, while it hasn't run out. */
async function currentAttempt(now: Date): Promise<SignInAttemptRow | null> {
  const token = await readCookieValue(SIGN_IN_COOKIE);
  return token ? getSignInAttempt(hashToken(token), now) : null;
}

/** Ends this browser's attempt, if it has one, and clears its cookie. */
async function endAttempt(now: Date): Promise<void> {
  const attempt = await currentAttempt(now);
  if (attempt) await deleteSignInAttempt(attempt.key);
  await deleteCookie(SIGN_IN_COOKIE);
}

/**
 * A new attempt under a new token, replacing this browser's old one, so a token is never reused. It has 30 minutes
 * for all three steps. The caller saves it.
 */
async function beginAttempt(
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
    expiresAt: new Date(now.getTime() + ATTEMPT_TTL_MS).toISOString(),
    ...fields,
  };
}

/**
 * Makes a code, keeps only its hash on the attempt, and "sends" it (spec 2.2, 2.3 and 5). A new code gives 5 fresh
 * tries (plan decision 6). False, and nothing sent, when this email has had its 5 codes this hour.
 */
async function sendCode(attempt: SignInAttemptRow, now: Date): Promise<boolean> {
  if ((await countCodesSent(attempt.email, now)) >= CODES_PER_HOUR) return false;
  const code = newCode();
  attempt.codeHash = hashCode(attempt.key, code);
  attempt.codeExpiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  attempt.wrongTries = 0;
  await recordCodeSent(attempt.email, now);
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

/**
 * Step 1 (spec 3.1): an Eduvos email and the privacy policy box. A good email gets a code and moves on to step 2;
 * anything wrong stays on step 1, with the email as typed.
 */
export async function startSignIn(formData: FormData): Promise<void> {
  const next = nextFrom(formData);
  if (!isSampleMode()) backToSignIn(next);
  const now = new Date();
  const email = normaliseEmail(text(formData, "email"));
  const consented = text(formData, "consent") === "yes";
  const errors: SignInError[] = [];
  const check = checkEmail(email);
  if (check === "missing") errors.push("email-missing");
  if (check === "domain") errors.push("email-domain");
  if (!consented) errors.push("consent-missing");
  const attempt = await beginAttempt(now, {
    email: email.slice(0, 254),
    errors,
    consentedAt: consented ? now.toISOString() : null,
  });
  if (errors.length === 0) {
    if (await sendCode(attempt, now)) attempt.step = "code";
    else attempt.errors = ["email-rate"];
  }
  await saveSignInAttempt(attempt, now);
  backToSignIn(next);
}

/**
 * Step 2 (spec 3.1): the 6-digit code. Right, for an existing account: signed in. Right, for a new email: on to
 * step 3. Wrong: a try used, and the fifth ends the attempt, back on step 1 (spec 2.2). Expired: say so. Not 6 digits:
 * say so, without using a try.
 */
export async function verifyCode(formData: FormData): Promise<void> {
  const next = nextFrom(formData);
  const now = new Date();
  const attempt = isSampleMode() ? await currentAttempt(now) : null;
  if (!attempt || attempt.step !== "code" || !attempt.codeHash || !attempt.codeExpiresAt) backToSignIn(next);
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
      afterSignIn(next);
    }
    attempt.step = "profile";
    attempt.codeHash = null;
    attempt.codeExpiresAt = null;
    attempt.errors = [];
  } else {
    attempt.wrongTries += 1;
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
  await saveSignInAttempt(attempt, now);
  backToSignIn(next);
}

/** "Send a new code" on step 2 (plan decision 6): a new code and 5 fresh tries, within the 5 an hour. */
export async function resendCode(formData: FormData): Promise<void> {
  const next = nextFrom(formData);
  const now = new Date();
  const attempt = isSampleMode() ? await currentAttempt(now) : null;
  if (!attempt || attempt.step !== "code") backToSignIn(next);
  const sent = await sendCode(attempt, now);
  attempt.resent = sent;
  attempt.errors = sent ? [] : ["code-rate"];
  await saveSignInAttempt(attempt, now);
  backToSignIn(next);
}

/** "Use a different email" (spec 3.1): the attempt ends, and step 1 starts empty. */
export async function cancelSignIn(formData: FormData): Promise<void> {
  const next = nextFrom(formData);
  await endAttempt(new Date());
  backToSignIn(next);
}

/**
 * Step 3, a first sign-in only (spec 2.6): a first name and a campus. Only now is the account made, consent recorded
 * and the session started (plan decision 8).
 */
export async function completeProfile(formData: FormData): Promise<void> {
  const next = nextFrom(formData);
  const now = new Date();
  const attempt = isSampleMode() ? await currentAttempt(now) : null;
  if (!attempt || attempt.step !== "profile") backToSignIn(next);
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
    await saveSignInAttempt(attempt, now);
    backToSignIn(next);
  }
  // Another tab may have finished first: then this signs in to that account rather than making a second one.
  const account =
    (await findAccountByEmail(attempt.email)) ??
    (await createAccount({ email: attempt.email, firstName: name.value, campusSlug, now }));
  await finishSignIn(account.id, attempt, now);
  afterSignIn(next);
}

/** "Sign in as a sample account" (spec 2.8): straight in, in sample mode only, and only as one of the five. */
export async function signInAsSample(formData: FormData): Promise<void> {
  const next = nextFrom(formData);
  if (!isSampleMode()) backToSignIn(next);
  const account = await restoreSampleAccount(normaliseEmail(text(formData, "email")));
  if (!account) backToSignIn(next);
  const now = new Date();
  await endAttempt(now);
  await startSession(account.id, now);
  afterSignIn(next);
}

// --- Your account ---------------------------------------------------------------

/** Sign out (spec 2.5): the session goes, and the homepage says so in a toast (plan decision 12). */
export async function signOut(): Promise<void> {
  await endSession();
  await setFlash("signed-out");
  redirect("/");
}

/** "Edit details" on the account page (spec 3.2): the first name and the campus, checked as step 3 checks them. */
export async function updateDetails(formData: FormData): Promise<void> {
  const account = await requireAccount("/account");
  const now = new Date();
  const name = checkFirstName(text(formData, "firstName"));
  const campuses = await getCampuses();
  const campusSlug = checkCampus(text(formData, "campus"), campuses.map((campus) => campus.slug));
  const errors: string[] = [];
  if (name.error) errors.push(name.error);
  if (!campusSlug) errors.push("campus-missing");
  if (errors.length > 0 || !campusSlug) {
    const values = { firstName: name.value.slice(0, 80), campus: campusSlug ?? "" };
    await writeFormState(DETAILS_FORM, { errors, values, notice: null }, now);
  } else {
    await updateAccountDetails(account.id, { firstName: name.value, campusSlug });
    // "Your details are saved." is a line on the page, not a toast, so the page needs no client code (plan decision 13).
    await writeFormState(DETAILS_FORM, { errors: [], values: {}, notice: "saved" }, now);
  }
  redirect("/account", RedirectType.replace);
}

/**
 * "Delete my account" (spec 2.13 and 3.3), only with the box ticked. Then the account and everything that hangs off it
 * go at once, this browser is signed out, and the homepage says so in a toast.
 */
export async function deleteAccount(formData: FormData): Promise<void> {
  const account = await requireAccount("/account/privacy");
  const now = new Date();
  if (text(formData, "confirm") !== "yes") {
    await writeFormState(DELETE_FORM, { errors: ["confirm-missing"], values: {}, notice: null }, now);
    redirect("/account/privacy", RedirectType.replace);
  }
  await deleteAccountData(account.id);
  await deleteCookie(SESSION_COOKIE);
  await setFlash("deleted");
  redirect("/");
}
