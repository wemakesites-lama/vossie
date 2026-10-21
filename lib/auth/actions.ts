"use server";

import { redirect, RedirectType } from "next/navigation";
import { getCampuses } from "@/lib/data";
import { updateAccountDetails } from "@/lib/data/accounts";
import type { SignInError } from "@/lib/data/rows";
import { signInMode } from "./config";
import { checkEmail, normaliseEmail } from "./email";
import { DETAILS_FORM, writeFormState } from "./form-state";
import { checkCampus, checkFirstName } from "./profile";
import { requireAccount } from "./session";
import { beginAttempt, currentAttempt, endAttempt, nextFrom, saveAfterPost, sendCode, signInPath, text } from "./sign-in-finish";

// The Server Actions behind the account forms that don't start a session (accounts spec 2 and 3). Each is a plain
// form's action, so it works before the app's JavaScript arrives (plan decision 2). It checks its own input, takes
// identity only from the session, keeps errors in the store rather than the URL (plan decision 3), and ends with a
// redirect. The three posts that start a session, signing out and deleting the account are Route Handlers that
// answer 303 instead, so they end with a full page load (stage K spec decision 2; app/login/*/route.ts,
// app/logout/route.ts and app/account/privacy/delete/route.ts).

/** The sign-in page again, keeping `next`, replacing the form in history (plan decision 19). */
function backToSignIn(next: string | null): never {
  redirect(signInPath(next), RedirectType.replace);
}

// --- Signing in ---------------------------------------------------------------

/**
 * Step 1 (spec 3.1): an Eduvos email and the privacy policy box. A good email gets a code and moves on to step 2;
 * anything wrong stays on step 1, with the email as typed.
 */
export async function startSignIn(formData: FormData): Promise<void> {
  const next = nextFrom(formData);
  if (signInMode() === "off") backToSignIn(next);
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
    // On Supabase a refusal (a code less than a minute ago, the network's limit, the domain hook, a failed send) stays
    // on step 1 with its words, so the visitor can try again (Supabase phase B decision 6).
    const error = await sendCode(attempt, now);
    if (error === null) attempt.step = "code";
    else attempt.errors = [error];
  }
  await saveAfterPost(attempt, now);
  backToSignIn(next);
}

/** "Send a new code" on step 2 (plan decision 6): a new code and 5 fresh tries, within the 5 an hour. */
export async function resendCode(formData: FormData): Promise<void> {
  const next = nextFrom(formData);
  const now = new Date();
  const attempt = await currentAttempt(now);
  if (!attempt || attempt.step !== "code") backToSignIn(next);
  const error = await sendCode(attempt, now);
  attempt.resent = error === null;
  // The hour's codes used up is code-rate on step 2, as before; Supabase's refusals keep their own words.
  attempt.errors = error === null ? [] : [error === "email-rate" ? "code-rate" : error];
  await saveAfterPost(attempt, now);
  backToSignIn(next);
}

/** "Use a different email" (spec 3.1): the attempt ends, and step 1 starts empty. */
export async function cancelSignIn(formData: FormData): Promise<void> {
  const next = nextFrom(formData);
  await endAttempt(new Date());
  backToSignIn(next);
}

// --- Your account ---------------------------------------------------------------

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
