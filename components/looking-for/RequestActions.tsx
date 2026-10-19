import Link from "next/link";
import { closeMyRequest, reopenMyRequest } from "@/lib/looking-for/actions";
import { deleteRequestPath, editRequestPath } from "@/lib/looking-for/paths";
import type { OwnRequest } from "@/lib/types";

/**
 * What the asker can do with a request (community actions spec 2.6, plan decision 6): Edit while it's open, Close or
 * Reopen (a form button each, posting where it came from), and Delete, through its confirm page. A hidden request can
 * only be deleted. Each names its request in visually hidden text (spec section 4).
 */
export function RequestActions({ own, from }: { own: OwnRequest; from: "page" | "list" }) {
  const { request, state } = own;
  const fields = (
    <>
      <input type="hidden" name="request" value={request.id} />
      {from === "list" && <input type="hidden" name="from" value="list" />}
    </>
  );
  return (
    <div className="requests-actions">
      {state === "open" && (
        <Link href={editRequestPath(request.id)} prefetch={false} className="btn btn-outline text-navy">
          Edit <span className="sr-only">{request.title}</span>
        </Link>
      )}
      {state === "open" && (
        <form action={closeMyRequest}>
          {fields}
          <button type="submit" className="btn btn-outline text-navy">
            Close <span className="sr-only">{request.title}</span>
          </button>
        </form>
      )}
      {state === "closed" && (
        <form action={reopenMyRequest}>
          {fields}
          <button type="submit" className="btn btn-outline text-navy">
            Reopen <span className="sr-only">{request.title}</span>
          </button>
        </form>
      )}
      <Link href={deleteRequestPath(request.id)} prefetch={false} className="btn btn-outline text-danger">
        Delete <span className="sr-only">{request.title}</span>
      </Link>
    </div>
  );
}
