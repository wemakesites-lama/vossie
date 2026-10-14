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
 * spec 2.10). Its own listing or shop, a conversation already started and a listing that isn't available each get a
 * note instead of the form, in that order (plan decision 5, amendment 6).
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
  // The conversation comes before the listing's availability: a buyer who asked before it was paused or sold can still
  // open that conversation (messaging plan amendment 6).
  if (subject.seller.slug === shopSlugOf(account)) status = { kind: "own" };
  else if (existing) status = { kind: "existing", conversationId: existing };
  else if (!subject.open) status = { kind: "unavailable" };
  return <ComposerView subject={subject} status={status} form={composerForm(state, target)} />;
}
