import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireAccount } from "@/lib/auth/session";
import { getOwnRequest } from "@/lib/data/requests";
import { deleteRequestPath } from "@/lib/looking-for/paths";
import { DeleteRequestView } from "./DeleteRequestView";

/** The confirm page for this visitor (community actions spec 2.6): the asker's own request, or the 404. Inside <Suspense>. */
export async function DeleteRequest({ requestId }: { requestId: string }) {
  const account = await requireAccount(deleteRequestPath(requestId));
  // Reading the asker's own request settles first, which reads the clock (stage L spec decision 11).
  await connection();
  const own = await getOwnRequest(account.id, requestId, new Date());
  if (!own) notFound();
  return <DeleteRequestView own={own} />;
}

/**
 * The confirm page's room while it streams in (plan amendment 13, not the form's skeleton): the back link, the heading
 * at its own height, and one block as tall as the sentence, the two consequences and the buttons, so the footer
 * doesn't jump when the page arrives. Wordless.
 */
export function DeleteRequestSkeleton() {
  return (
    <div className="request-form-column" aria-hidden="true">
      <span className="skeleton request-form-skeleton-crumb" />
      <span className="skeleton requests-skeleton-delete-title" />
      <span className="skeleton requests-skeleton-delete" />
    </div>
  );
}
