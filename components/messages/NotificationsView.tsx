import Link from "next/link";
import { CheckIcon, ClockIcon, FlagIcon, MessageIcon, ShieldIcon } from "@/components/icons";
import { inboxTime } from "@/lib/time";
import type { NotificationItem, NotificationKind } from "@/lib/types";

/** Each kind's icon (plan decision 13; staff tools plan decision 7 adds "shop-update" and "booking"). */
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
