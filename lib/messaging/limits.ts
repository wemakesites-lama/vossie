import { isSampleAccount } from "@/lib/auth/sample-accounts";
import { countConversationsStartedSince, countMessagesSentSince } from "@/lib/data/messages";
import type { Account } from "@/lib/types";
import { CONVERSATIONS_PER_DAY, DAY_MS, HOUR_MS, MESSAGES_PER_HOUR } from "./rules";

// The limits on messages per account (stage K spec decisions 8 to 10; Lama, 2026-10-20), checked by the composer's
// Send, a reply and the offer composer's Send, after the fields and before the scam words. Both windows slide ("in the
// last 24 hours", not "today"), so nothing resets at midnight for a script to wait for. On the real backend the count
// goes with the write, in one transaction (spec decision 11); here it's an await before the write.

export type MessageLimitError = "conversation-rate" | "message-rate";

/**
 * [] when the post may go, else the one limit it meets: the conversations limit first, and only when the post would
 * start a conversation. Every account meets them, staff included; the sample accounts don't, in sample mode.
 */
export async function messageLimitErrors(
  account: Pick<Account, "id" | "email" | "seller">,
  { newConversation }: { newConversation: boolean },
  now: Date,
): Promise<MessageLimitError[]> {
  if (isSampleAccount(account)) return [];
  const dayAgo = new Date(now.getTime() - DAY_MS);
  if (newConversation && (await countConversationsStartedSince(account.id, dayAgo)) >= CONVERSATIONS_PER_DAY) {
    return ["conversation-rate"];
  }
  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const shopSlug = account.seller?.sellerSlug ?? null;
  if ((await countMessagesSentSince(account.id, shopSlug, hourAgo)) >= MESSAGES_PER_HOUR) return ["message-rate"];
  return [];
}
