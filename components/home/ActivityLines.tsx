import Link from "next/link";
import type { ViewerActivity } from "@/lib/types";

const counted = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The signed-in strip's lines (spec 7.4; role views N5, plan decision 12), drawn on the server and handed to
 * ContextStripView as a node, so a line costs the homepage no client code. New notifications is a link to
 * Notifications, white on the navy strip and 44px tall. Add strip lines here, never in the client view.
 */
export function ActivityLines({ activity }: { activity: ViewerActivity }) {
  const { newMessages, salesToConfirm, newNotifications } = activity;
  return (
    <ul className="context-activity">
      {newMessages > 0 && (
        <li>
          <span className="context-dot" aria-hidden="true" />
          {counted(newMessages, "new message", "new messages")}
        </li>
      )}
      {salesToConfirm > 0 && (
        <li>
          <span className="context-dot" aria-hidden="true" />
          {counted(salesToConfirm, "sale to confirm", "sales to confirm")}
        </li>
      )}
      {newNotifications > 0 && (
        <li>
          <span className="context-dot" aria-hidden="true" />
          {/* No prefetch (decision 53). Opening Notifications reads them (messaging spec 2.9). */}
          <Link href="/notifications" prefetch={false} className="context-activity-link">
            {counted(newNotifications, "new notification", "new notifications")}
          </Link>
        </li>
      )}
    </ul>
  );
}
