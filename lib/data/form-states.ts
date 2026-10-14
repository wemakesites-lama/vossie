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
