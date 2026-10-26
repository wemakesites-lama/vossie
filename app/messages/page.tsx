import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { Inbox } from "@/components/messages/Inbox";
import { InboxSkeleton } from "@/components/messages/InboxSkeleton";
import { parseInboxTab } from "@/lib/messaging/paths";

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
        <h1 className="inbox-title">Messages</h1>
        <Reveal fallback={<InboxSkeleton />}>
          <InboxForVisitor searchParams={searchParams} />
        </Reveal>
      </div>
    </PageTransition>
  );
}

async function InboxForVisitor({ searchParams }: Pick<PageProps<"/messages">, "searchParams">) {
  return <Inbox tab={parseInboxTab((await searchParams).tab)} />;
}
