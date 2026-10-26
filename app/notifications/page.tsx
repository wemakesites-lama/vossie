import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Notifications, NotificationsSkeleton } from "@/components/messages/Notifications";

/** A page for one person, so search engines leave it out (plan decision 24). */
export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

/** Notifications (messaging spec 3.5). The heading is prerendered; the list needs the session. */
export default function NotificationsPage() {
  return (
    <PageTransition>
      <div className="page notes-page">
        <h1 className="notes-title">Notifications</h1>
        <Reveal fallback={<NotificationsSkeleton />}>
          <Notifications />
        </Reveal>
      </div>
    </PageTransition>
  );
}
