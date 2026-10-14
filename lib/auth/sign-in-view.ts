import { cookies } from "next/headers";
import { connection } from "next/server";
import { ALL_CAMPUSES, CAMPUS_COOKIE, parseCampusChoice } from "@/lib/campus";
import { getCampuses } from "@/lib/data";
import { getSampleEmail, getSignInAttempt } from "@/lib/data/sign-in";
import { isSampleMode } from "./config";
import { readCookieValue, SIGN_IN_COOKIE } from "./cookies";
import { maskEmail } from "./email";
import { formErrors, SIGN_IN_FIELDS, type FormError } from "./messages";
import { hashToken } from "./secrets";
import { getViewer } from "./session";

/** What the sign-in page shows this browser (spec 3.1). */
export type SignInView =
  | { step: "unavailable" }
  | { step: "signed-in"; email: string }
  | { step: "email"; email: string; consented: boolean; errors: FormError[] }
  | { step: "code"; maskedEmail: string; errors: FormError[]; resent: boolean; sampleCode: string | null }
  | { step: "profile"; firstName: string; campus: string; errors: FormError[] };

/**
 * Signed in already, or the step this browser's attempt is on, with its errors and what was typed (spec 3.1, plan
 * decision 3). Request-time: call it inside <Suspense>.
 */
export async function getSignInView(): Promise<SignInView> {
  if (!isSampleMode()) return { step: "unavailable" };
  const viewer = await getViewer();
  if (viewer) return { step: "signed-in", email: viewer.email };
  const token = await readCookieValue(SIGN_IN_COOKIE);
  // Whether the attempt has run out is checked against the clock (decision 26).
  await connection();
  const attempt = token ? await getSignInAttempt(hashToken(token), new Date()) : null;
  if (!attempt) return { step: "email", email: "", consented: false, errors: [] };
  const errors = formErrors(attempt.errors, SIGN_IN_FIELDS, attempt.wrongTries);
  if (attempt.step === "code") {
    const sent = await getSampleEmail(attempt.key);
    return {
      step: "code",
      maskedEmail: maskEmail(attempt.email),
      errors,
      resent: attempt.resent,
      sampleCode: sent?.code ?? null,
    };
  }
  if (attempt.step === "profile") {
    return { step: "profile", firstName: attempt.firstName, campus: attempt.campusSlug || (await chosenCampus()), errors };
  }
  return { step: "email", email: attempt.email, consented: attempt.consentedAt !== null, errors };
}

/** The campus chosen on this device, for step 3's select to start on (spec 2.6), or "" for none. */
async function chosenCampus(): Promise<string> {
  const [store, campuses] = await Promise.all([cookies(), getCampuses()]);
  const choice = parseCampusChoice(store.get(CAMPUS_COOKIE)?.value, campuses);
  return choice === ALL_CAMPUSES ? "" : choice;
}
