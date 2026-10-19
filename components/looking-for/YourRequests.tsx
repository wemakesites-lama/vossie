import { requireAccount } from "@/lib/auth/session";
import { listOwnRequests } from "@/lib/data/requests";
import { takeNote } from "@/lib/looking-for/form-state";
import { YOUR_REQUESTS_FORM, YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { requestNoticeText } from "@/lib/looking-for/words";
import { YourRequestsView } from "./YourRequestsView";

/** Your requests for this request's visitor (community actions spec 2.13). Request-time: inside <Suspense>. */
export async function YourRequests() {
  const account = await requireAccount(YOUR_REQUESTS_PATH);
  const [items, note] = await Promise.all([listOwnRequests(account.id), takeNote(YOUR_REQUESTS_FORM)]);
  return <YourRequestsView items={items} notice={requestNoticeText(note?.notice)} />;
}

/** The list's room while it streams in. Wordless. */
export function YourRequestsSkeleton() {
  return (
    <div className="requests-column" aria-hidden="true">
      <span className="skeleton request-form-skeleton-crumb" />
      <span className="skeleton request-form-skeleton-title" />
      <span className="skeleton requests-skeleton-item" />
      <span className="skeleton requests-skeleton-item" />
    </div>
  );
}
