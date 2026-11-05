import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PhoneIcon } from "@/components/icons";
import { Trail } from "@/components/ui/Trail";
import { requireAccount } from "@/lib/auth/session";
import { getThread } from "@/lib/data/messages";
import { mockCallOn } from "@/lib/messaging/mock-call";
import { callPath, inboxPath, threadPath } from "@/lib/messaging/paths";
import { LABELS, trailFor } from "@/lib/nav/trail";
import type { Thread } from "@/lib/types";

/**
 * A thread's mock call for this request's visitor (`lib/messaging/mock-call.ts`). Request-time: the page puts it inside
 * <Suspense>. Off the demo, and for anyone but the thread's two sides, it's the 404, as the thread is.
 */
export async function OpenMockCall({ id }: { id: string }) {
  if (!mockCallOn()) notFound();
  const account = await requireAccount(callPath(id));
  await connection();
  const thread = await getThread(id, account.id, new Date());
  if (!thread || !thread.otherPresent) notFound();
  return <MockCallView thread={thread} />;
}

/** Up to two letters from the other side's name, for the call screen's circle. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The call screen: it rings for three seconds, then says "Connected", all in CSS (no client code). It says it's a demo
 * in words, and End call is a link back to the thread. With reduced motion or data saver it shows "Connected" at once.
 */
export function MockCallView({ thread }: { thread: Thread }) {
  const about = thread.request?.title ?? thread.listingTitle;
  return (
    <div className="thread-column">
      <Trail
        crumbs={trailFor("/messages/[id]/call", {
          params: { id: thread.id },
          names: { "/messages/[id]": thread.otherName },
          ...(thread.role === "seller" && {
            parent: { label: LABELS["/sell"], href: "/sell" },
            between: [
              { label: LABELS["/sell/messages"], href: inboxPath("selling") },
              { label: thread.otherName, href: threadPath(thread.id) },
            ],
          }),
        })}
      />
      <section className="call-screen texture-stars" aria-labelledby="call-name">
        <p className="call-demo">Demo call: nobody is being called</p>
        <div className="call-avatar" aria-hidden="true">
          <span className="call-ring" />
          <span className="call-ring call-ring-late" />
          <span className="call-initials">{initials(thread.otherName)}</span>
        </div>
        <h1 id="call-name" className="call-name">
          <span className="sr-only">Calling</span> {thread.otherName}
        </h1>
        {about && <p className="call-about">About {about}</p>}
        <p className="call-state" aria-hidden="true">
          <span className="call-ringing">Calling…</span>
          <span className="call-connected">Connected</span>
        </p>
        <Link href={threadPath(thread.id)} prefetch={false} className="call-end">
          <PhoneIcon className="call-end-icon size-6" />
          End call
        </Link>
      </section>
    </div>
  );
}
