import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses } from "@/lib/data";
import { getThread, markThreadRead } from "@/lib/data/messages";
import { takeSentNote } from "@/lib/messaging/form-state";
import { replyFormKey, threadPath } from "@/lib/messaging/paths";
import { replyForm, ThreadView } from "./ThreadView";

/**
 * A thread for this request's visitor (messaging spec 3.3). Request-time: the page puts it inside <Suspense>. A
 * signed-out visitor goes to sign-in and back; anyone but the buyer and the seller, and an id that doesn't exist, get
 * the same 404, so nothing says which conversations exist. Opening it marks it read, and takes "Sent." if the
 * composer left it (plan decision 7).
 */
export async function OpenThread({ id }: { id: string }) {
  const account = await requireAccount(threadPath(id));
  // The times, the 7-day auto-confirm and marking read all read the clock (decision 26).
  await connection();
  const now = new Date();
  const thread = await getThread(id, account.id, now);
  if (!thread) notFound();
  await markThreadRead(id, account.id, now);
  const [sent, state, campuses] = await Promise.all([takeSentNote(id), readFormState(replyFormKey(id)), getCampuses()]);
  const campusSlug = thread.listing?.campusSlug ?? thread.shop.campusSlug;
  const campusName = campuses.find((campus) => campus.slug === campusSlug)?.name ?? "";
  return <ThreadView thread={thread} now={now} reply={replyForm(state, id)} sent={sent} campusName={campusName} />;
}
