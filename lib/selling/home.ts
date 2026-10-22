import type { SellerRow } from "@/lib/data/rows";
import { dayMonth } from "@/lib/format";
import { inboxPath, threadPath } from "@/lib/messaging/paths";
import { lastSastDays } from "@/lib/time";
import type { SellerQueue } from "@/lib/types";
import { myListingsPath, NEW_LISTING_PATH, PROFILE_PATH, tabFor } from "./paths";

// The seller home's rows and words (role views spec 7.1; N2 plan decisions 2, 3 and 5 to 7), from the readers'
// answers. Pure: `now` comes from the caller, read after connection(). The words are samples for Lama to change.

const HOUR_MS = 60 * 60 * 1000;

/** A Needs-you row, as NeedsYouList (components/kit/NeedsYouList.tsx, N1) takes it. */
export type SellerNeed = {
  key: string;
  count: number;
  title: string;
  detail?: string;
  age?: { label: string; tone: "info" | "warning" | "danger" };
  href: string;
  urgent?: boolean;
};

/** How long the oldest buyer has waited (plan decision 7): warning from 24 hours, danger once 48 have passed. */
export function waitChip(at: string, now: Date): NonNullable<SellerNeed["age"]> {
  const hours = Math.max(0, Math.floor((now.getTime() - Date.parse(at)) / HOUR_MS));
  const label = hours < 1 ? "<1h" : hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
  return { label, tone: hours >= 48 ? "danger" : hours >= 24 ? "warning" : "info" };
}

/** How many listings wait to be marked sold (plan decision 3): one per listing, however many threads sold it. */
export function salesToMarkCount(queue: SellerQueue): number {
  return new Set(queue.sales.map((sale) => sale.listingId)).size;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The home's Needs-you rows in the spec's order (7.1, item 2). NeedsYouList hides the ones at 0. */
export function sellerNeeds(queue: SellerQueue, now: Date): SellerNeed[] {
  const { replies, drafts, hidden, paused } = queue;
  const sales = salesToMarkCount(queue);
  const firstSale = queue.sales[0] ?? null;
  return [
    {
      key: "replies",
      count: replies.count,
      title: plural(replies.count, "Buyer waiting for a reply", "Buyers waiting for a reply"),
      detail: replies.oldest ? `Oldest: ${replies.oldest.title ?? "a question for the shop"}` : undefined,
      age: replies.oldest ? waitChip(replies.oldest.at, now) : undefined,
      href: inboxPath("selling"),
      urgent: true,
    },
    {
      key: "sales",
      count: sales,
      title: plural(sales, "Sale to mark as sold", "Sales to mark as sold"),
      detail: firstSale?.title,
      href: firstSale ? threadPath(firstSale.conversationId) : inboxPath("selling"),
    },
    {
      key: "drafts",
      count: drafts.count,
      title: plural(drafts.count, "Draft ready to publish", "Drafts ready to publish"),
      detail: drafts.oldest?.title ?? undefined,
      href: myListingsPath("drafts"),
    },
    {
      key: "hidden",
      count: hidden.count,
      title: "Hidden by the Hub",
      detail: hidden.oldest?.title ?? undefined,
      // My listings has no Hidden tab: the oldest hidden listing's own state's tab (plan decision 5).
      href: myListingsPath(hidden.oldest?.state ? tabFor(hidden.oldest.state) : "available"),
    },
    {
      key: "paused",
      count: paused.count,
      title: plural(paused.count, "Paused listing", "Paused listings"),
      detail: "Buyers can't see them",
      href: myListingsPath("paused"),
    },
  ];
}

/** The setup checklist shows while the shop has no published listing or has never replied (spec 7.1, New shop). */
export function isNewShop(queue: SellerQueue): boolean {
  const published = queue.listings.available + queue.listings.paused + queue.listings.sold;
  return published === 0 || !queue.everReplied;
}

/** The checklist's steps (plan decision 6), each done from data; nothing is stored. */
export function setupSteps(
  shop: Pick<SellerRow, "image" | "about" | "pickupPointIds">,
  queue: SellerQueue,
  campusHasPoints: boolean,
): { label: string; done: boolean; href: string }[] {
  const published = queue.listings.available + queue.listings.paused + queue.listings.sold;
  return [
    { label: "Add a photo of your shop", done: shop.image !== null, href: PROFILE_PATH },
    { label: "Say what you sell", done: shop.about.trim() !== "", href: PROFILE_PATH },
    ...(campusHasPoints
      ? [{ label: "Choose a pickup point", done: shop.pickupPointIds.length > 0, href: PROFILE_PATH }]
      : []),
    { label: "Publish your first listing", done: published > 0, href: NEW_LISTING_PATH },
    { label: "Reply to your first buyer", done: queue.everReplied, href: inboxPath("selling") },
  ];
}

/** The header's followers: a number only (spec 7.1, item 1). Never who. */
export function followerCountLabel(total: number): string {
  if (total === 0) return "No followers yet";
  return `${total} ${plural(total, "follower", "followers")}`;
}

/** Under the Followers tile: follows made in the last 7 days that still stand (spec 7.1, item 4). */
export function newFollowersLine(recent: number): string {
  return recent === 0 ? "None new this week" : `+${recent} new this week`;
}

/** "12 Oct" for each of the last `days` SAST days, oldest first: the chart's numbers table. */
export function dayLabels(days: number, now: Date): string[] {
  return lastSastDays(days, now).map(dayMonth);
}

/** The chart's takeaway (spec 5.3): the window's total and today's, in words. */
export function enquirySummary(points: readonly (number | null)[]): string {
  const total = points.reduce<number>((sum, point) => sum + (point ?? 0), 0);
  if (total === 0) return `No enquiries in the last ${points.length} days yet.`;
  const today = points.at(-1) ?? 0;
  return `${total} ${plural(total, "enquiry", "enquiries")} in the last ${points.length} days, ${today === 0 ? "none" : today} today.`;
}
