import { connection } from "next/server";
import { requireAccount } from "@/lib/auth/session";
import { getNotifications, markNotificationsRead } from "@/lib/data/notifications";
import { NOTIFICATIONS_SHOWN } from "@/lib/messaging/rules";
import { NotificationsView } from "./NotificationsView";

/**
 * Notifications for this request's visitor (messaging spec 2.9 and 3.5). Request-time: the page puts it inside
 * <Suspense>. Opening the page marks them all read, after reading them, so this visit still shows which were new. The
 * header's badge on this same page load may still count them (plan decision 11).
 */
export async function Notifications() {
  const account = await requireAccount("/notifications");
  // The times and marking read read the clock (decision 26).
  await connection();
  const now = new Date();
  const items = await getNotifications(account.id, NOTIFICATIONS_SHOWN);
  await markNotificationsRead(account.id, now);
  return <NotificationsView items={items} now={now} />;
}

/** The list's room while it streams in. */
export function NotificationsSkeleton() {
  return (
    <div className="notes-skeleton" aria-hidden="true">
      <span className="skeleton notes-skeleton-row" />
      <span className="skeleton notes-skeleton-row" />
      <span className="skeleton notes-skeleton-row" />
    </div>
  );
}
