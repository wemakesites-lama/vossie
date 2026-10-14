import type { Metadata } from "next";
import { Suspense } from "react";
import { Notifications, NotificationsSkeleton } from "@/components/messages/Notifications";

/** A page for one person, so search engines leave it out (plan decision 24). */
export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

/** Notifications (messaging spec 3.5). The heading is prerendered; the list needs the session. */
export default function NotificationsPage() {
  return (
    <div className="page notes-page">
      <h1 className="notes-title">Notifications</h1>
      <Suspense fallback={<NotificationsSkeleton />}>
        <Notifications />
      </Suspense>
    </div>
  );
}
