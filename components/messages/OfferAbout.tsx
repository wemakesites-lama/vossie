import Link from "next/link";
import type { ReactNode } from "react";
import { requestPath } from "@/lib/looking-for/paths";
import { REQUEST_HIDDEN_NOTE, REQUEST_REMOVED_NOTE } from "@/lib/looking-for/words";
import type { Thread } from "@/lib/types";
import { MessageSummary } from "./MessageSummary";

type OfferAboutProps = {
  thread: Thread;
  request: NonNullable<Thread["request"]>;
  campusName: string;
  /** The thread's status pill. */
  children?: ReactNode;
};

/**
 * What an offer thread is about (community actions plan decision 8), where E's thread shows the listing: the request,
 * linked while its page is up, "This request was removed." once it isn't, and under it the listing the shop pointed
 * to, if any, as E's summary. When the Hub hid the request, the asker is told so; the shop is only told it was removed
 * (plan amendment 19.4).
 */
export function OfferAbout({ thread, request, campusName, children }: OfferAboutProps) {
  return (
    <div className="offer-thread">
      <div className="offer-thread-head">
        <p className="offer-thread-about">
          {thread.role === "buyer" ? "Your request: " : "Request: "}
          {request.live ? (
            <Link href={requestPath(request.id)} prefetch={false}>
              {request.title}
            </Link>
          ) : (
            request.title
          )}
        </p>
        {children}
      </div>
      {!request.live && (
        <p className="offer-thread-gone">
          {request.hidden && thread.role === "buyer" ? REQUEST_HIDDEN_NOTE : REQUEST_REMOVED_NOTE}
        </p>
      )}
      {(thread.listing || thread.listingTitle) && (
        <MessageSummary
          listing={thread.listing}
          listingTitle={thread.listingTitle}
          shop={thread.shop}
          campusName={campusName}
        />
      )}
    </div>
  );
}
