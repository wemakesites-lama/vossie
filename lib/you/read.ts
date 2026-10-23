import { cache } from "react";
import { listFollowedShops } from "@/lib/data/follows";
import { listOwnBookings } from "@/lib/data/hub-posts";
import { unreadCounts } from "@/lib/data/messages";
import { newNotificationsByKind } from "@/lib/data/notifications";
import { listOwnRequests } from "@/lib/data/requests";
import { getSavedIds } from "@/lib/data/saved";
import { listSavedSearches } from "@/lib/data/saved-searches";
import { sastDate } from "@/lib/time";
import { FOR_YOU_KINDS, forYouItems, yourStuffFrom, type ForYou, type YourStuff } from "./model";

// You's reads (role views spec 7.4). Request-time only: call them inside <Suspense>, after getViewer() or
// requireAccount() found the account, which awaited connection(), so they may read the clock (decision 26).

/**
 * For you, and the You tab's badge from the same read (spec 4.2, plan decision 14). React's cache() makes it one read
 * per request, shared by the page and the tab, so it takes no `now`: it reads the clock itself. Reading marks nothing
 * read.
 */
export const readForYou = cache(async (accountId: string): Promise<ForYou> => {
  const [counts, byKind] = await Promise.all([
    unreadCounts(accountId, new Date()),
    newNotificationsByKind(accountId, FOR_YOU_KINDS),
  ]);
  return {
    items: forYouItems({ conversations: counts.conversations, byKind }),
    conversations: counts.conversations,
    newNotifications: counts.notifications,
  };
});

/**
 * Your stuff (spec 7.4): the saved listings on this device (the vossie_saved cookie), followed shops, the account's
 * requests (settled first, so the banner and the counts agree with Your requests), saved searches and upcoming Hub
 * bookings. Every reader is the account's own.
 */
export async function readYourStuff(accountId: string, now: Date): Promise<YourStuff> {
  const [savedIds, shops, own, searches, bookings] = await Promise.all([
    getSavedIds(),
    listFollowedShops(accountId),
    listOwnRequests(accountId, now),
    listSavedSearches(accountId),
    listOwnBookings(accountId, now),
  ]);
  return yourStuffFrom({ savedIds, shops, own, searches, bookings, today: sastDate(now) });
}
