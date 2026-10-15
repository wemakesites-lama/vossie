import { readFormState } from "@/lib/auth/form-state";
import { getSessionKey } from "@/lib/auth/session";
import { clearFormState } from "@/lib/data/form-states";
import type { FormStateRow } from "@/lib/data/rows";
import type { OnboardingStep } from "./paths";

// The selling forms' names in D's form state (accounts plan decision 3): their errors, typed values and notices, kept
// per browser session for 10 minutes.

export const onboardingForm = (step: OnboardingStep) => `onboarding:${step}`;
export const listingForm = (listingId: string | null) => (listingId ? `listing:${listingId}` : "listing:new");
/** My listings' notice after a save or a row's button. */
export const MY_LISTINGS_FORM = "my-listings";
/** The dashboard's notice after Pause my shop or Resume. */
export const DASHBOARD_FORM = "sell-dashboard";
/** Edit shop's errors, typed values and notice. */
export const PROFILE_FORM = "shop-profile";

/** Forgets this browser's state for `form`. Server Actions only. */
export async function clearForm(form: string): Promise<void> {
  const sessionKey = await getSessionKey();
  if (sessionKey) await clearFormState(sessionKey, form);
}

/**
 * The notice an action left for `form` ("Paused. …", "Your shop is paused…"), taken as the page shows it: read and
 * cleared in one go, so it's said once and not left for its 10 minutes (amendment 10.6). This is how stage E's thread
 * takes its "Sent." note (`takeSentNote`). A state with no notice is left alone. Request-time: call it inside <Suspense>.
 */
export async function takeNotice(form: string): Promise<FormStateRow | null> {
  const state = await readFormState(form);
  if (!state?.notice) return null;
  await clearForm(form);
  return state;
}
