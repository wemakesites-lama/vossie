import { connection } from "next/server";
import { getFormState, saveFormState } from "@/lib/data/form-states";
import type { FormStateRow } from "@/lib/data/rows";
import { FORM_STATE_TTL_MS } from "./config";
import { getSessionKey } from "./session";

// A signed-in form's state after a post (accounts plan decision 3): its errors and typed values, or a notice such as
// "saved". It belongs to this browser's session and lasts 10 minutes. Stages E to G use it for their forms too.

/** The account page's "Edit details" form, and its fields' ids. */
export const DETAILS_FORM = "details";
export const DETAILS_FIELDS = { firstName: "details-first-name", campus: "details-campus" } as const;

/** The privacy settings page's "Delete your account" form, and its field's id. */
export const DELETE_FORM = "delete-account";
export const DELETE_FIELDS = { confirm: "delete-confirm" } as const;

/** This session's state for `form`, or null. Request-time: call it inside <Suspense>. */
export async function readFormState(form: string): Promise<FormStateRow | null> {
  const sessionKey = await getSessionKey();
  if (!sessionKey) return null;
  // The expiry check reads the clock (decision 26).
  await connection();
  return getFormState(sessionKey, form, new Date());
}

/** Keeps `form`'s state for this session, replacing the last. Server Actions only; signed out, it does nothing. */
export async function writeFormState(
  form: string,
  state: Pick<FormStateRow, "errors" | "values" | "notice">,
  now: Date,
): Promise<void> {
  const sessionKey = await getSessionKey();
  if (!sessionKey) return;
  const expiresAt = new Date(now.getTime() + FORM_STATE_TTL_MS).toISOString();
  await saveFormState({ sessionKey, form, ...state, expiresAt }, now);
}
