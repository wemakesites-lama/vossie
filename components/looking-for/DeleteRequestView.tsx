import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { NavPending } from "@/components/ui/NavPending";
import { deleteMyRequest } from "@/lib/looking-for/actions";
import { requestPath, YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { BACK } from "@/lib/motion";
import type { OwnRequest } from "@/lib/types";

/**
 * Delete request's confirm page (community actions spec 2.6 and section 4): what will happen, Delete request, and Keep
 * it back to the request, or to Your requests for a hidden one, whose page is gone.
 */
export function DeleteRequestView({ own }: { own: OwnRequest }) {
  const { request } = own;
  const keep = own.state === "hidden" ? YOUR_REQUESTS_PATH : requestPath(request.id);
  return (
    <div className="request-form-column">
      <Link href={keep} transitionTypes={BACK} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        {own.state === "hidden" ? "Back to Your requests" : "Back to the request"}
        <NavPending />
      </Link>
      <h1 className="request-form-title">Delete your request</h1>
      <p className="requests-lead">{`Delete ${request.title}? This can't be undone.`}</p>
      <ul className="requests-consequences">
        <li>Its page goes, and shops can&apos;t offer on it.</li>
        <li>Conversations with shops that offered stay in your messages, marked &quot;This request was removed&quot;.</li>
      </ul>
      <div className="requests-confirm">
        <form action={deleteMyRequest}>
          <input type="hidden" name="request" value={request.id} />
          <button type="submit" className="btn btn-danger">
            Delete request
          </button>
        </form>
        <Link href={keep} prefetch={false} className="btn btn-outline text-navy">
          Keep it
        </Link>
      </div>
    </div>
  );
}
