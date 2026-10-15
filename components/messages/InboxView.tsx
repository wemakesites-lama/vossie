import Link from "next/link";
import { Photo } from "@/components/listings/Photo";
import { inboxPath, threadPath } from "@/lib/messaging/paths";
import { inboxTime } from "@/lib/time";
import type { ConversationSummary, InboxTab } from "@/lib/types";
import { StatusPill } from "./StatusPill";

type InboxViewProps = {
  tab: InboxTab;
  /** Selling shows only for an account with a storefront (plan decision 22). */
  hasShop: boolean;
  conversations: readonly ConversationSummary[];
  /** Read after `await connection()`, for the times (plan decision 28). */
  now: Date;
};

/** The inbox (messaging spec 3.2): the tabs, Refresh, and the conversations or the empty state. */
export function InboxView({ tab, hasShop, conversations, now }: InboxViewProps) {
  const title = tab === "buying" ? "Buying" : "Selling";
  return (
    <div className="inbox-body">
      <div className="inbox-bar">
        {hasShop && (
          <nav aria-label="Buying and selling" className="inbox-tabs">
            <ul>
              <li>
                <Link
                  href={inboxPath("buying")}
                  prefetch={false}
                  aria-current={tab === "buying" ? "page" : undefined}
                  className="inbox-tab"
                >
                  Buying
                </Link>
              </li>
              <li>
                <Link
                  href={inboxPath("selling")}
                  prefetch={false}
                  aria-current={tab === "selling" ? "page" : undefined}
                  className="inbox-tab"
                >
                  Selling
                </Link>
              </li>
            </ul>
          </nav>
        )}
        {/* A full page load: the one way to be sure the server is asked again (plan decision 19). */}
        <a href={inboxPath(tab)} className="msg-refresh">
          Refresh
        </a>
      </div>
      <section aria-labelledby="inbox-list-title">
        <h2 id="inbox-list-title" className="sr-only">
          {title}
        </h2>
        {conversations.length > 0 ? (
          <ul className="inbox-list">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <InboxRow conversation={conversation} now={now} />
              </li>
            ))}
          </ul>
        ) : (
          <InboxEmpty tab={tab} />
        )}
      </section>
    </div>
  );
}

/** One conversation: a link to its thread, read as "Unread, Tech corner, 14:05, …" (spec 3.2 and section 5). */
function InboxRow({ conversation, now }: { conversation: ConversationSummary; now: Date }) {
  const { id, otherName, listingTitle, image, preview, lastFromViewer, lastMessageAt, status, unread } = conversation;
  return (
    <Link href={threadPath(id)} prefetch={false} className="inbox-row" data-unread={unread || undefined}>
      {image ? (
        <Photo image={{ src: image.src, alt: "" }} ratio="1 / 1" sizes="56px" className="inbox-photo" />
      ) : (
        <span className="inbox-photo inbox-photo-empty" aria-hidden="true" />
      )}
      <span className="inbox-text">
        <span className="inbox-top">
          {unread && <span className="sr-only">Unread,</span>} <span className="inbox-name">{otherName}</span>{" "}
          <time dateTime={lastMessageAt} className="inbox-time">
            {inboxTime(lastMessageAt, now)}
          </time>
        </span>{" "}
        <span className="inbox-about">{listingTitle ?? "A question for the shop"}</span>{" "}
        <span className="inbox-preview">{lastFromViewer ? `You: ${preview}` : preview}</span>
      </span>{" "}
      <span className="inbox-end">
        <StatusPill status={status} />
        {unread && <span className="inbox-dot" aria-hidden="true" />}
      </span>
    </Link>
  );
}

function InboxEmpty({ tab }: { tab: InboxTab }) {
  if (tab === "selling") {
    return (
      <div className="inbox-empty">
        <p>No enquiries yet. When a buyer messages your shop, it shows up here.</p>
      </div>
    );
  }
  return (
    <div className="inbox-empty">
      <p>No messages yet. Find something you like and message the seller.</p>
      <Link href="/browse" prefetch={false} className="btn btn-primary">
        Browse
      </Link>
    </div>
  );
}
