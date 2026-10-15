import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { getSessionKey } from "@/lib/auth/session";
import { clearFormState, getFormState, saveFormState, takeFormState } from "@/lib/data/form-states";
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

// --- A new listing is made once (selling plan amendment 14.1) ---------------------------------------------------
//
// The new-listing form carries a hidden one-time token. It is made when the form is drawn, at request time, and kept in
// form state for the session; the first post to take it makes the listing, and any other goes where that one went.
// Edits need none: saving the same listing twice changes nothing.

/**
 * A token lasts an hour, not form state's usual 10 minutes: a seller slow with photos shouldn't be turned away at
 * Save. It holds nothing about the seller.
 */
export const LISTING_TOKEN_TTL_MS = 60 * 60 * 1000;

const TOKEN_SHAPE = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const tokenForm = (token: string) => `listing-once:${token}`;
const expiryFrom = (now: Date) => new Date(now.getTime() + LISTING_TOKEN_TTL_MS).toISOString();

/** Where a new listing's first save went, and the notice it left (My listings' tab, the listing, the notice's code). */
export type ListingSent = { path: string; listing: string; notice: string };

/**
 * A new token for the new-listing form, kept for this session; null when nobody is signed in. Request-time: call it
 * inside <Suspense>. The random value is made only after `connection()`, never while prerendering (decision 26).
 */
export async function issueListingToken(): Promise<string | null> {
  const sessionKey = await getSessionKey();
  if (!sessionKey) return null;
  await connection();
  const now = new Date();
  const token = randomUUID();
  await saveFormState(
    { sessionKey, form: tokenForm(token), errors: [], values: {}, notice: null, expiresAt: expiryFrom(now) },
    now,
  );
  return token;
}

function sentFrom(state: FormStateRow): ListingSent | null {
  const { path, listing } = state.values;
  return state.taken && path && listing && state.notice ? { path, listing, notice: state.notice } : null;
}

/** Where the token's save went, once it has made its listing. Null before then, and for a token this session lacks. */
export async function sentListing(token: string, now: Date): Promise<ListingSent | null> {
  const sessionKey = await getSessionKey();
  if (!sessionKey || !TOKEN_SHAPE.test(token)) return null;
  const state = await getFormState(sessionKey, tokenForm(token), now);
  return state ? sentFrom(state) : null;
}

export type ListingToken =
  /** Yours: make the listing, then say where it went with `leaveListingToken`. */
  | { kind: "first" }
  /** None like it in this session: left out, made up, run out, or another session's. */
  | { kind: "none" }
  /** Taken already. `sent` is where that save went, or null while it is still going. */
  | { kind: "again"; sent: ListingSent | null };

/** Takes the token for this post, if it is the first to. Server Actions only. */
export async function takeListingToken(token: string, now: Date): Promise<ListingToken> {
  const sessionKey = await getSessionKey();
  const taken = sessionKey && TOKEN_SHAPE.test(token) ? await takeFormState(sessionKey, tokenForm(token), now) : null;
  if (!taken) return { kind: "none" };
  return taken.first ? { kind: "first" } : { kind: "again", sent: sentFrom(taken.state) };
}

/** The first post says where it went, for any other that comes with the same token. Server Actions only. */
export async function leaveListingToken(token: string, sent: ListingSent, now: Date): Promise<void> {
  const sessionKey = await getSessionKey();
  if (!sessionKey) return;
  await saveFormState(
    {
      sessionKey,
      form: tokenForm(token),
      errors: [],
      values: { path: sent.path, listing: sent.listing },
      notice: sent.notice,
      taken: true,
      expiresAt: expiryFrom(now),
    },
    now,
  );
}
