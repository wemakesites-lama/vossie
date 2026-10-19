import { readFormState } from "@/lib/auth/form-state";
import type { FormStateRow } from "@/lib/data/rows";
import { clearOwnFormState } from "@/lib/messaging/form-state";

// Community actions' status lines (plan decision 7), kept in D's form state like E's "Sent." note.

/**
 * A status line an action left for this page: read and cleared in one go, so it shows once. Null when there's none,
 * or when signed out. Request-time: call it inside <Suspense>.
 */
export async function takeNote(form: string): Promise<FormStateRow | null> {
  const state = await readFormState(form);
  if (!state) return null;
  await clearOwnFormState(form);
  return state;
}
