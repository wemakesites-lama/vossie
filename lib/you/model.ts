import type { NeedsYouItem } from "@/components/kit/NeedsYouList";
import { dayMonth } from "@/lib/format";
import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { closesSoon } from "@/lib/looking-for/rules";
import { sastDateTime } from "@/lib/time";
import type {
  NewNotifications,
  NewNotificationsByKind,
  NotificationKind,
  OwnBooking,
  OwnRequest,
  SellerProfile,
} from "@/lib/types";

// You (role views spec 7.4): what For you lists, what the You tab's badge counts, and the words of Your stuff's rows.
// Plain values and functions over what lib/you/read.ts reads. The page and the tab share them, so the badge is always
// the list's sum (spec 4.2). The words are samples for Lama to change.

/** The notification kinds For you counts: new offers, saved-search matches, followed shops' new listings. */
export const FOR_YOU_KINDS: readonly NotificationKind[] = ["offer", "search-match", "new-listing"];

/** For you's line when nothing is waiting. */
export const ALL_CLEAR = "All clear. Nothing needs you right now.";

/** What readForYou gives: the list, and two counts the Messages and Notifications rows show. */
export type ForYou = {
  items: NeedsYouItem[];
  /** Conversations with a message the account hasn't opened (unreadCounts). */
  conversations: number;
  /** Every new notification, of any kind. */
  newNotifications: number;
};

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The newest one's words, when there's only one to describe. */
const onlyOne = (group: NewNotifications | undefined) => (group?.count === 1 ? group.newestText : undefined);

/**
 * For you's rows (spec 7.4, plan decisions 1 and 2): conversations with new messages, new offers on the account's
 * requests, new saved-search matches and new listings from followed shops. NeedsYouList hides the rows at 0.
 */
export function forYouItems({
  conversations,
  byKind,
}: {
  conversations: number;
  byKind: NewNotificationsByKind;
}): NeedsYouItem[] {
  const offers = byKind.offer?.count ?? 0;
  const matches = byKind["search-match"]?.count ?? 0;
  const listings = byKind["new-listing"]?.count ?? 0;
  // An unread offer notification always has its own unread thread (startOffer writes both; opening the thread reads
  // both), so a new offer counts once, in the offers row.
  const messages = Math.max(0, conversations - offers);
  return [
    {
      key: "messages",
      count: messages,
      title: plural(messages, "Conversation with new messages", "Conversations with new messages"),
      href: "/messages",
      urgent: true,
    },
    {
      key: "offers",
      count: offers,
      title: plural(offers, "New offer on your requests", "New offers on your requests"),
      detail: onlyOne(byKind.offer),
      // One offer opens its thread, which reads it; several open Your requests, where each shows its offers.
      href: offers === 1 && byKind.offer ? byKind.offer.newestHref : YOUR_REQUESTS_PATH,
      urgent: true,
    },
    {
      key: "matches",
      count: matches,
      title: plural(matches, "New match for your saved searches", "New matches for your saved searches"),
      detail: onlyOne(byKind["search-match"]),
      href: "/notifications",
    },
    {
      key: "listings",
      count: listings,
      title: plural(listings, "New listing from a shop you follow", "New listings from shops you follow"),
      detail: onlyOne(byKind["new-listing"]),
      href: "/notifications",
    },
  ];
}

/** The You tab's badge: the sum of For you's counts (spec 4.3). */
export function forYouTotal(items: readonly Pick<NeedsYouItem, "count">[]): number {
  return items.reduce((sum, item) => sum + item.count, 0);
}

/** The soonest of the account's open requests in its last days, and how many are. */
export type ClosingSoon = { title: string; closesOn: string; count: number };

/** Your stuff's numbers (spec 7.4). */
export type YourStuff = {
  /** From the vossie_saved cookie: this device only (plan decision 3). */
  savedListings: number;
  followedShops: number;
  requests: { open: number; closed: number; hidden: number };
  closingSoon: ClosingSoon | null;
  searches: { count: number; alertsOn: number };
  bookings: readonly OwnBooking[];
};

type OwnPart = Pick<OwnRequest, "state"> & { request: Pick<OwnRequest["request"], "title" | "closesOn"> };

export function yourStuffFrom({
  savedIds,
  shops,
  own,
  searches,
  bookings,
  today,
}: {
  savedIds: readonly string[];
  shops: readonly unknown[];
  own: readonly OwnPart[];
  searches: readonly { paused: boolean }[];
  bookings: readonly OwnBooking[];
  today: string;
}): YourStuff {
  const inState = (state: OwnRequest["state"]) => own.filter((item) => item.state === state).length;
  const soon = own
    .filter((item) => item.state === "open" && closesSoon(item.request.closesOn, today))
    .sort((a, b) => (a.request.closesOn ?? "").localeCompare(b.request.closesOn ?? ""));
  return {
    savedListings: savedIds.length,
    followedShops: shops.length,
    requests: { open: inState("open"), closed: inState("closed"), hidden: inState("hidden") },
    closingSoon:
      soon.length === 0 ? null : { title: soon[0].request.title, closesOn: soon[0].request.closesOn!, count: soon.length },
    searches: { count: searches.length, alertsOn: searches.filter((search) => !search.paused).length },
    bookings,
  };
}

export function savedDetail({ savedListings, followedShops }: Pick<YourStuff, "savedListings" | "followedShops">): string {
  return (
    `${savedListings} ${plural(savedListings, "listing", "listings")} on this device · ` +
    `${followedShops} ${plural(followedShops, "shop", "shops")} followed`
  );
}

export function requestsDetail({ open, closed, hidden }: YourStuff["requests"]): string {
  if (open + closed + hidden === 0) return "None yet";
  const parts = [`${open} open`];
  if (closed > 0) parts.push(`${closed} closed`);
  if (hidden > 0) parts.push(`${hidden} hidden by the Hub`);
  return parts.join(" · ");
}

export function searchesDetail({ count, alertsOn }: YourStuff["searches"]): string {
  if (count === 0) return "None yet";
  if (alertsOn === count) return `${count} saved · alerts on`;
  if (alertsOn === 0) return `${count} saved · alerts paused`;
  return `${count} saved · alerts on for ${alertsOn}`;
}

const BOOKING_WORDS: Readonly<Record<OwnBooking["status"], string>> = {
  going: "Going",
  open: "Waiting for an answer",
  accepted: "Accepted",
  declined: "Declined",
};

/** Hub bookings' row: the soonest one's page and words, or the Hub when nothing is booked. */
export function bookingsRow(bookings: readonly OwnBooking[]): { href: string; detail: string } {
  if (bookings.length === 0) return { href: "/hub", detail: "Nothing coming up" };
  const [next] = bookings;
  const more = bookings.length > 1 ? ` · ${bookings.length - 1} more` : "";
  return {
    href: `/hub/${next.postId}`,
    detail: `${next.title}, ${sastDateTime(next.startsAt)} · ${BOOKING_WORDS[next.status]}${more}`,
  };
}

/** Your shop's line (as the old account row said it, selling plan decision 21). */
export function shopDetail(seller: SellerProfile): string {
  if (seller.status === "pending" || !seller.sellerSlug) return "Waiting for the Hub's approval";
  if (seller.status === "paused") return "Paused";
  return "Open to buyers";
}

/** The banner's sentence (plan decision 8), in the reminder's words. */
export function closingSoonText({ title, closesOn, count }: ClosingSoon): string {
  if (count === 1) return `Your request ${title} closes automatically on ${dayMonth(closesOn)}.`;
  return `${count} of your requests close automatically soon, the first on ${dayMonth(closesOn)}.`;
}
