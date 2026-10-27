import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Inbox } from "@/components/messages/Inbox";
import { InboxSkeleton } from "@/components/messages/InboxSkeleton";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

/** A page for one person, so search engines leave it out (plan decision 24). */
export const metadata: Metadata = { title: "Messages", robots: { index: false } };

/**
 * The inbox's Selling tab (messaging spec 3.2), inside the selling section's frame so the Selling bar stays beside it
 * and in the same column as Overview, Listings and Shop. The heading is prerendered; the conversations need the session.
 */
export default function SellingMessagesPage() {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Trail crumbs={trailFor("/sell/messages")} />
            <h1 className="sell-title">Messages</h1>
          </header>
          <Reveal fallback={<InboxSkeleton />}>
            <Inbox tab="selling" />
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
}
