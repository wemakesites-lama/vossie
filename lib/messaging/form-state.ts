import { readFormState } from "@/lib/auth/form-state";
import { getSessionKey } from "@/lib/auth/session";
import { clearFormState } from "@/lib/data/form-states";
import { sentNoteKey } from "./paths";

// Messaging's use of D's form state (D decision 3): forms keep their errors and typed text under the keys in paths.ts.

/** Clears this browser's state for `form` after a post that went through. Signed out, it does nothing. */
export async function clearOwnFormState(form: string): Promise<void> {
  const sessionKey = await getSessionKey();
  if (sessionKey) await clearFormState(sessionKey, form);
}

/**
 * Whether the composer has just sent this conversation's first message, so the thread says "Sent." (plan decision
 * 7). The note is read and cleared in one go, so it shows once. Request-time: call it inside <Suspense>.
 */
export async function takeSentNote(conversationId: string): Promise<boolean> {
  const state = await readFormState(sentNoteKey(conversationId));
  if (state?.notice !== "sent") return false;
  await clearOwnFormState(sentNoteKey(conversationId));
  return true;
}
