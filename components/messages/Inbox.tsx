import { connection } from "next/server";
import { requireAccount } from "@/lib/auth/session";
import { getInbox } from "@/lib/data/messages";
import { inboxPath } from "@/lib/messaging/paths";
import { shopSlugOf } from "@/lib/messaging/subjects";
import type { InboxTab } from "@/lib/types";
import { InboxView } from "./InboxView";

/**
 * The inbox for this request's visitor (messaging spec 3.2). Request-time: the page puts it inside <Suspense>. A
 * signed-out visitor goes to sign-in and back; Selling without a shop shows Buying (plan decision 22).
 */
export async function Inbox({ tab }: { tab: InboxTab }) {
  const account = await requireAccount(inboxPath(tab));
  const hasShop = shopSlugOf(account) !== null;
  const shown: InboxTab = hasShop ? tab : "buying";
  // The times and the 7-day auto-confirm read the clock (decision 26).
  await connection();
  const now = new Date();
  const conversations = await getInbox(account.id, shown, now);
  return <InboxView tab={shown} hasShop={hasShop} conversations={conversations} now={now} />;
}
