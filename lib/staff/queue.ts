import type { NeedsYouItem } from "@/components/kit/NeedsYouList";
import type { ReportView } from "@/lib/data/staff-reports";
import type { ShopReview } from "@/lib/data/staff-shops";
import { waitAge } from "@/lib/kit/age";
import type { HubBooking } from "@/lib/types";
import { ADMIN_HIDDEN_PATH, HUB_MANAGE_PATH, adminReportPath, adminSellerPath } from "./paths";

// The admin's Today queue and the item pages' Next links (role views spec 7.2), worked out from the lists the pages
// read (listShopsForReview, listReports, listBookings, countHidden). Each row's count is its list's length, so it
// equals the admin bar's badge. Pure: the page reads the clock and the lists; these decide.

/** The item that has waited longest: the earliest `at`. Items without a time come after every timed one; ties keep the list's order. */
export function oldestOf<T>(items: readonly T[], at: (item: T) => string | null): T | null {
  let oldest: T | null = null;
  let oldestTime = Infinity;
  for (const item of items) {
    const raw = at(item);
    const parsed = raw === null ? NaN : Date.parse(raw);
    const time = Number.isNaN(parsed) ? Infinity : parsed;
    if (oldest === null || time < oldestTime) {
      oldest = item;
      oldestTime = time;
    }
  }
  return oldest;
}

/** "2 listings and 1 request are hidden", "1 listing is hidden", or null when nothing is (stage J plan decision 17). */
export function hiddenLine({ listings, requests }: { listings: number; requests: number }): string | null {
  const parts = [
    listings > 0 ? `${listings} ${listings === 1 ? "listing" : "listings"}` : null,
    requests > 0 ? `${requests} ${requests === 1 ? "request" : "requests"}` : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return `${parts.join(" and ")} ${listings + requests === 1 ? "is" : "are"} hidden`;
}

export type TodayInput = {
  shops: readonly ShopReview[];
  reports: readonly ReportView[];
  bookings: readonly HubBooking[];
  hidden: { listings: number; requests: number };
  now: Date;
};

export type TodayQueue = {
  /** The rows: the waiting ones by their oldest wait, oldest first; Hidden last (plan decisions 2 and 3). */
  items: NeedsYouItem[];
  /** Shops, reports and slot requests waiting on the Hub. Hidden isn't counted: the Hub has already acted. */
  waiting: number;
  /** When the oldest of them started waiting, or null. */
  oldestAt: string | null;
};

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
const timeOf = (at: string | null) => {
  const parsed = at === null ? NaN : Date.parse(at);
  return Number.isNaN(parsed) ? Infinity : parsed;
};

export function todayQueue({ shops, reports, bookings, hidden, now }: TodayInput): TodayQueue {
  const waitingShops = shops.filter((review) => review.standing === "waiting");
  const openReports = reports.filter((view) => view.open);
  const openBookings = bookings.filter((row) => row.status === "open");

  const rows: { since: string | null; item: NeedsYouItem }[] = [];
  const shop = oldestOf(waitingShops, (review) => review.appliedAt);
  if (shop) {
    rows.push({
      since: shop.appliedAt,
      item: {
        key: "shops",
        count: waitingShops.length,
        title: plural(waitingShops.length, "Shop to approve", "Shops to approve"),
        detail: `Oldest: ${shop.shop.name}`,
        age: waitAge(shop.appliedAt, now) ?? undefined,
        href: adminSellerPath(shop.shop.slug),
        urgent: true,
      },
    });
  }
  const report = oldestOf(openReports, (view) => view.createdAt);
  if (report) {
    rows.push({
      since: report.createdAt,
      item: {
        key: "reports",
        count: openReports.length,
        title: plural(openReports.length, "Open report", "Open reports"),
        detail: `Oldest: ${report.targetTitle}`,
        age: waitAge(report.createdAt, now) ?? undefined,
        href: adminReportPath(report.id),
        urgent: true,
      },
    });
  }
  const booking = oldestOf(openBookings, (row) => row.createdAt);
  if (booking) {
    rows.push({
      since: booking.createdAt,
      item: {
        key: "slots",
        count: openBookings.length,
        title: plural(openBookings.length, "Slot request", "Slot requests"),
        detail: `Oldest: ${booking.postTitle}`,
        age: waitAge(booking.createdAt, now) ?? undefined,
        href: `${HUB_MANAGE_PATH}#hub-queue`,
        urgent: true,
      },
    });
  }
  // Oldest wait first; a row without a time last. The sort is stable, so ties keep shops, reports, slots.
  rows.sort((a, b) => {
    const left = timeOf(a.since);
    const right = timeOf(b.since);
    return left === right ? 0 : left < right ? -1 : 1;
  });

  const items = rows.map((row) => row.item);
  const hiddenCount = hidden.listings + hidden.requests;
  if (hiddenCount > 0) {
    items.push({
      key: "hidden",
      count: hiddenCount,
      title: "Hidden by the Hub",
      detail: hiddenLine(hidden) ?? undefined,
      href: ADMIN_HIDDEN_PATH,
    });
  }
  return {
    items,
    waiting: waitingShops.length + openReports.length + openBookings.length,
    oldestAt: oldestOf(rows, (row) => row.since)?.since ?? null,
  };
}

/** Today's header line: "7 waiting · oldest 3 days", or "Nothing waiting" (spec 7.2). */
export function todayLede({ waiting, oldestAt }: Pick<TodayQueue, "waiting" | "oldestAt">, now: Date): string {
  if (waiting === 0) return "Nothing waiting";
  const age = waitAge(oldestAt, now);
  return age ? `${waiting} waiting · oldest ${age.label.replace(/^Under/, "under")}` : `${waiting} waiting`;
}

/** A shop page's Next link (spec 7.2): the oldest waiting shop that isn't this one. Declined shops wait on their seller. */
export function nextWaitingShop(shops: readonly ShopReview[], slug: string): ShopReview | null {
  return oldestOf(
    shops.filter((review) => review.standing === "waiting" && review.shop.slug !== slug),
    (review) => review.appliedAt,
  );
}

/** A report page's Next link (spec 7.2): the oldest open report that isn't this one. */
export function nextOpenReport(reports: readonly ReportView[], id: string): ReportView | null {
  return oldestOf(
    reports.filter((view) => view.open && view.id !== id),
    (view) => view.createdAt,
  );
}
