import Link from "next/link";
import {
  CheckIcon,
  ClockIcon,
  FlagIcon,
  MessageIcon,
  PlusSquareIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/icons";
import { inboxTime } from "@/lib/time";
import type { NotificationItem, NotificationKind } from "@/lib/types";

/**
 * Each kind's icon (plan decision 13; staff tools plan decision 7 adds "shop-update" and "booking"). Community actions
 * add "offer", "request-update" and "new-listing" (community actions plan decision 14).
 * Saved-search alerts add "search-match", drawn with the search icon (search alerts plan decision 14).
 * Staff accounts add "staff-role", drawn with the shield like the Hub's other word about you (stage J spec decision 7).
 */
function KindIcon({ kind }: { kind: NotificationKind }) {
  switch (kind) {
    case "message":
      return <MessageIcon className="notes-icon" />;
    case "sale-to-confirm":
      return <CheckIcon className="notes-icon" />;
    case "report-handled":
      return <FlagIcon className="notes-icon" />;
    case "shop-approved":
      return <ShieldIcon className="notes-icon" />;
    case "shop-update":
      return <ShieldIcon className="notes-icon" />;
    case "booking":
      return <ClockIcon className="notes-icon" />;
    case "offer":
      return <MessageIcon className="notes-icon" />;
    case "request-update":
      return <FlagIcon className="notes-icon" />;
    case "new-listing":
      return <PlusSquareIcon className="notes-icon" />;
    case "search-match":
      return <SearchIcon className="notes-icon" />;
    case "staff-role":
      return <ShieldIcon className="notes-icon" />;
  }
}

/**
 * Notifications (messaging spec 3.5): newest first, each a link to the thing with its sentence and the time, the ones
 * that were new on this visit marked New in words. "Nothing new." when there are none.
 */
export function NotificationsView({ items, now }: { items: readonly NotificationItem[]; now: Date }) {
  if (items.length === 0) return <p className="notes-empty">Nothing new.</p>;
  return (
    <ul className="notes-list">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} prefetch={false} className="notes-row" data-new={item.isNew || undefined}>
            <KindIcon kind={item.kind} />
            <span className="notes-text">
              {item.isNew && <span className="notes-new">New</span>} <span>{item.text}</span>
            </span>{" "}
            <time dateTime={item.createdAt} className="notes-time">
              {inboxTime(item.createdAt, now)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
