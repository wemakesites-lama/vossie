import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { NavPending } from "@/components/ui/NavPending";
import { offersLabel } from "@/lib/format";
import { NEW_REQUEST_PATH, requestPath } from "@/lib/looking-for/paths";
import { requestStateLabel } from "@/lib/looking-for/words";
import { BACK } from "@/lib/motion";
import { shortSastDate } from "@/lib/time";
import type { OwnRequest } from "@/lib/types";
import { AutoCloseLine } from "./AutoCloseLine";
import { RequestActions } from "./RequestActions";

type YourRequestsViewProps = {
  /** Open, then closed, then hidden, each newest first (plan decision 18). */
  items: readonly OwnRequest[];
  /** The last action's words, once (plan decision 7). */
  notice: string | null;
};

/**
 * Your requests (community actions spec 2.13): every request the account has posted, with where it stands, its
 * offers and when, the Hub's reason for a hidden one, and what can be done with it. Post a request at the top.
 */
export function YourRequestsView({ items, notice }: YourRequestsViewProps) {
  return (
    <div className="requests-column">
      <Link href="/account" transitionTypes={BACK} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        Back to You
        <NavPending />
      </Link>
      <div className="requests-head">
        <h1 className="requests-title">Your requests</h1>
        <Link href={NEW_REQUEST_PATH} prefetch={false} className="btn btn-primary">
          Post a request
        </Link>
      </div>
      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}
      <section aria-labelledby="requests-list-title">
        <h2 id="requests-list-title" className="sr-only">
          Your requests, open first
        </h2>
        {items.length === 0 ? (
          <p className="requests-empty">You haven&apos;t asked for anything yet.</p>
        ) : (
          <ul className="requests-list">
            {items.map((own) => {
              const { request, state } = own;
              return (
                <li key={request.id} className="requests-item">
                  <h3 className="requests-item-title">
                    {state === "hidden" ? (
                      request.title
                    ) : (
                      <Link href={requestPath(request.id)} prefetch={false}>
                        {request.title}
                      </Link>
                    )}
                  </h3>
                  <p className="requests-item-meta">
                    <span className="requests-state" data-state={state}>
                      {requestStateLabel(state)}
                    </span>
                    {` · ${offersLabel(request.offers)} · Posted `}
                    <time dateTime={request.createdAt}>{shortSastDate(request.createdAt)}</time>
                  </p>
                  <AutoCloseLine own={own} className="requests-item-meta" />
                  {state === "hidden" && (
                    <p className="requests-reason">The Hub&apos;s reason: {own.hiddenReason ?? "none given"}</p>
                  )}
                  <RequestActions own={own} from="list" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
