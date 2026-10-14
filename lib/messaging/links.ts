import { getViewer } from "@/lib/auth/session";
import { findConversation } from "@/lib/data/messages";
import { signInHref } from "@/lib/next-path";
import type { ReportTarget } from "@/lib/types";
import { composerPath, reportPath, threadPath, type MessageTarget } from "./paths";

// Where the session's links go (messaging spec 2.1, 2.2, 2.8 and 3.6; plan decisions 3 and 5). Request-time: they read
// the session, so the components that call them sit inside <Suspense>.

/** Message seller: through sign-in to the composer; signed in, the visitor's thread about it, or else the composer. */
export async function messageHrefFor(target: MessageTarget): Promise<string> {
  const composer = composerPath(target);
  const account = await getViewer();
  if (!account) return signInHref(composer);
  const existing = await findConversation(account.id, target);
  return existing ? threadPath(existing) : composer;
}

/** Report: through sign-in to the form; signed in, straight to it. */
export async function reportHrefFor(target: ReportTarget): Promise<string> {
  const path = reportPath(target);
  return (await getViewer()) ? path : signInHref(path);
}
