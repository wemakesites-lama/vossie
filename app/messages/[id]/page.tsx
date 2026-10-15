import type { Metadata } from "next";
import { Suspense } from "react";
import { OpenThread } from "@/components/messages/OpenThread";
import { ThreadSkeleton } from "@/components/messages/ThreadSkeleton";

/** A conversation belongs to two people, so search engines leave it out (plan decision 24). */
export const metadata: Metadata = { title: "Messages", robots: { index: false } };

/**
 * One sample id, so the build checks the page keeps its request-time parts inside <Suspense> (plan decision 25). It
 * matches no conversation: the build stops at the session read, and a visit to it is the 404.
 */
export function generateStaticParams() {
  return [{ id: "conv-sample" }];
}

/** A thread (messaging spec 3.3). Everything needs the session, so it renders per request inside <Suspense>. */
export default function ThreadPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <div className="page thread-page">
      <Suspense fallback={<ThreadSkeleton />}>
        <ThreadForVisitor params={params} />
      </Suspense>
    </div>
  );
}

async function ThreadForVisitor({ params }: Pick<PageProps<"/messages/[id]">, "params">) {
  const { id } = await params;
  return <OpenThread id={id} />;
}
