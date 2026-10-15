import { clearOwnFormState } from "@/lib/messaging/form-state";
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

/** Forgets this browser's state for `form` (E's helper, selling plan amendment 7). Server Actions only. */
export async function clearForm(form: string): Promise<void> {
  await clearOwnFormState(form);
}
