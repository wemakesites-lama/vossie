import type { FormStateRow } from "./rows";
import { sampleStore } from "./store";

// A signed-in form's state after a post (accounts plan decision 3): its errors and typed values, or a notice. One row
// per session and form, so another browser, or another form, never sees it.

const keyFor = (sessionKey: string, form: string) => `${sessionKey}:${form}`;

/** The form's state, while it hasn't run out. A copy. */
export async function getFormState(sessionKey: string, form: string, now: Date): Promise<FormStateRow | null> {
  const row = sampleStore().formStates.get(keyFor(sessionKey, form));
  return row && Date.parse(row.expiresAt) > now.getTime() ? structuredClone(row) : null;
}

/** Saves a form's state, replacing the last one, and tidies away states that have run out. */
export async function saveFormState(state: Omit<FormStateRow, "key">, now: Date): Promise<void> {
  const { formStates } = sampleStore();
  for (const [key, row] of formStates) {
    if (Date.parse(row.expiresAt) <= now.getTime()) formStates.delete(key);
  }
  const key = keyFor(state.sessionKey, state.form);
  formStates.set(key, structuredClone({ ...state, key }));
}

export async function clearFormState(sessionKey: string, form: string): Promise<void> {
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
  const row = sampleStore().formStates.get(keyFor(sessionKey, form));
  if (!row || Date.parse(row.expiresAt) <= now.getTime()) return null;
  const first = !row.taken;
  row.taken = true;
  return { first, state: structuredClone(row) };
}
