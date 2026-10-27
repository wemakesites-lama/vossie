import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Inbox } from "@/components/messages/Inbox";
import { InboxSkeleton } from "@/components/messages/InboxSkeleton";
import { inboxPath, parseInboxTab } from "@/lib/messaging/paths";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

/** A page for one person, so search engines leave it out (plan decision 24). */
export const metadata: Metadata = { title: "Messages", robots: { index: false } };

/**
 * The inbox (messaging spec 3.2). The heading is prerendered; the tabs and conversations need the session, so they
 * render per request inside <Suspense>.
 */
export default function MessagesPage({ searchParams }: PageProps<"/messages">) {
  return (
    <PageTransition>
      <div className="page inbox-page">
        <Trail crumbs={trailFor("/messages")} />
        <h1 className="inbox-title">Messages</h1>
        <Reveal fallback={<InboxSkeleton />}>
          <InboxForVisitor searchParams={searchParams} />
        </Reveal>
      </div>
    </PageTransition>
  );
}

/** Buying. Selling lives in the selling section (`/sell/messages`); "?tab=selling" from before goes there. */
async function InboxForVisitor({ searchParams }: Pick<PageProps<"/messages">, "searchParams">) {
  if (parseInboxTab((await searchParams).tab) === "selling") redirect(inboxPath("selling"));
  return <Inbox tab="buying" />;
}
