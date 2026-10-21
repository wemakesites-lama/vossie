import { onSupabase } from "@/lib/backend";
import type { FormStateRow } from "./rows";
import { sampleStore } from "./store";

// A signed-in form's state after a post (accounts plan decision 3): its errors and typed values, or a notice. One row
// per session and form, so another browser, or another form, never sees it.

const keyFor = (sessionKey: string, form: string) => `${sessionKey}:${form}`;

/** The form's state, while it hasn't run out. A copy. */
export async function getFormState(sessionKey: string, form: string, now: Date): Promise<FormStateRow | null> {
  if (onSupabase()) return (await import("./supabase/form-states")).getFormState(sessionKey, form, now);
  const row = sampleStore().formStates.get(keyFor(sessionKey, form));
  return row && Date.parse(row.expiresAt) > now.getTime() ? structuredClone(row) : null;
}

/** Saves a form's state, replacing the last one, and tidies away states that have run out. */
export async function saveFormState(state: Omit<FormStateRow, "key">, now: Date): Promise<void> {
  if (onSupabase()) return (await import("./supabase/form-states")).saveFormState(state, now);
  const { formStates } = sampleStore();
  for (const [key, row] of formStates) {
    if (Date.parse(row.expiresAt) <= now.getTime()) formStates.delete(key);
  }
  const key = keyFor(state.sessionKey, state.form);
  formStates.set(key, structuredClone({ ...state, key }));
}

export async function clearFormState(sessionKey: string, form: string): Promise<void> {
  if (onSupabase()) return (await import("./supabase/form-states")).clearFormState(sessionKey, form);
  sampleStore().formStates.delete(keyFor(sessionKey, form));
}

/**
 * Takes a one-time state, for the first post to ask (selling plan amendment 14.1). The check and the mark are one step,
 * with nothing awaited between them, so two posts sent together can't both be first. `first` is true for the post
 * that took it; `state` is a copy of the row, which a later post finds as the first left it (saved again with
 * `taken: true`). Null when there is none: it was never made, has run out, or belongs to another session.
 */
export async function takeFormState(
  sessionKey: string,
  form: string,
  now: Date,
): Promise<{ first: boolean; state: FormStateRow } | null> {
  if (onSupabase()) return (await import("./supabase/form-states")).takeFormState(sessionKey, form, now);
  const row = sampleStore().formStates.get(keyFor(sessionKey, form));
  if (!row || Date.parse(row.expiresAt) <= now.getTime()) return null;
  const first = !row.taken;
  row.taken = true;
  return { first, state: structuredClone(row) };
}

/**
 * Clears every form's state of one session (phase B): at sign-out, so another sign-in in this browser never sees it. On
 * Supabase a taken one-time token stays until it runs out (amendment 8).
 */
export async function clearSessionFormStates(sessionKey: string): Promise<void> {
  if (onSupabase()) return (await import("./supabase/form-states")).clearSessionFormStates(sessionKey);
  const { formStates } = sampleStore();
  for (const [key, row] of formStates) {
    if (row.sessionKey === sessionKey) formStates.delete(key);
  }
}
