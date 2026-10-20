import type { HiddenItem } from "@/lib/data/staff-reports";
import { showListingAgain, showRequestAgain } from "@/lib/staff/admin-actions";
import { ADMIN_HIDDEN_PATH } from "@/lib/staff/paths";
import type { ListingState } from "@/lib/types";
import { ConfirmAction } from "./ConfirmAction";

/** A listing's own state, which showing it again keeps (spec decision 14). Samples for Lama to change. */
const STATE_LINES: Readonly<Partial<Record<ListingState, string>>> = {
  sold: "It's marked sold, so buyers will see it as sold.",
  paused: "It's marked paused, so buyers will see it as paused.",
  draft: "It's a draft, so only its seller sees it.",
};

/** What showing it again does, a line each (spec decision 14). */
export function showAgainLines(item: HiddenItem): string[] {
  if (item.kind === "request") {
    return [
      "Students will see it on Looking For and on its own page again.",
      "The asker is told. The reports about it stay closed, and the people who made them aren't told.",
      "To hide it again, someone has to report it.",
      ...(item.requestClosed ? ["Its asker had closed it, so it shows as closed."] : []),
    ];
  }
  const shop = item.shopName ?? "its shop";
  const stateLine = item.listingState ? STATE_LINES[item.listingState] : undefined;
  return [
    `Buyers will see it in browse, on ${shop}'s shop and on its own page again.`,
    "Its seller is told. The reports about it stay closed, and the people who made them aren't told.",
    "To hide it again, someone has to report it.",
    ...(item.shopPausedByHub ? [`${shop} is paused by the Hub, so buyers won't see it until the shop is resumed.`] : []),
    ...(stateLine ? [stateLine] : []),
  ];
}

/**
 * Show again's confirm page (spec decision 14): it can't be undone from the console, since hiding it again needs a
 * new report, so it's confirmed. No reason field: the student needs none, and the log records the action.
 */
export function ShowAgainConfirm({ item }: { item: HiddenItem }) {
  return (
    <ConfirmAction
      id={`show-${item.kind}-${item.id}`}
      lead={`Show "${item.title}" again?`}
      consequences={showAgainLines(item)}
      action={item.kind === "listing" ? showListingAgain : showRequestAgain}
      hidden={item.kind === "listing" ? { listing: item.id } : { request: item.id }}
      reason={false}
      errors={[]}
      confirmLabel={`Show ${item.title} again`}
      keepHref={ADMIN_HIDDEN_PATH}
    />
  );
}
