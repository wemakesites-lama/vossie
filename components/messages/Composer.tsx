import { notFound } from "next/navigation";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { findConversation } from "@/lib/data/messages";
import { composerFormKey, composerPath, type MessageTarget } from "@/lib/messaging/paths";
import { composerSubject, shopSlugOf } from "@/lib/messaging/subjects";
import { composerForm, ComposerView, type ComposerStatus } from "./ComposerView";

/**
 * The composer for this request's visitor (messaging spec 3.1). Request-time: it reads the session, so each page puts
 * it inside <Suspense>. An unknown listing or shop is the 404; a signed-out visitor goes to sign-in and back (accounts
 * spec 2.10). Its own listing or shop, a listing that isn't available or a paused shop (selling plan amendment 10), and
 * a conversation already started each get a note instead of the form (plan decision 5); the note for a listing or
 * shop that isn't taking messages also opens a conversation already started (selling plan amendment 16).
 */
export async function Composer({ target }: { target: MessageTarget }) {
  const subject = await composerSubject(target);
  if (!subject) notFound();
  const account = await requireAccount(composerPath(target));
  const [existing, state] = await Promise.all([
    findConversation(account.id, target),
    readFormState(composerFormKey(target)),
  ]);
  let status: ComposerStatus = { kind: "open" };
  if (subject.seller.slug === shopSlugOf(account)) status = { kind: "own" };
  // A buyer who already has a conversation keeps the way into it, where replies still go (selling plan amendment 16).
  else if (!subject.open) status = { kind: "unavailable", conversationId: existing };
  else if (existing) status = { kind: "existing", conversationId: existing };
  return <ComposerView subject={subject} status={status} form={composerForm(state)} />;
}
