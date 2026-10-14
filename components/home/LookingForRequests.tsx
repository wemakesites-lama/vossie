import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { getCampuses, getRequests } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { offersLabel } from "@/lib/format";
import { SectionError } from "./SectionError";

/** Three open requests, the visitor's campus first. Phones show two (spec 7.11). */
export async function LookingForRequests() {
  const { campus } = await getViewerContext();
  const data = await Promise.all([getRequests({ campus, limit: 3 }), getCampuses()]).catch(() => null);
  if (!data) return <SectionError id="looking-for" title="Open requests" />;

  const [requests, campuses] = data;
  if (requests.length === 0) return <p className="looking-for-empty">No open requests yet. Be the first to ask.</p>;
  const names = new Map(campuses.map((item) => [item.slug, item.name]));

  return (
    <ul aria-label="Open requests" className="request-list">
      {requests.map((request) => (
        <li key={request.id}>
          {/* Each request opens its own page (community spec 4.3). No prefetch: three different pages now (plan
              decision 12, decision 28). */}
          <Link href={`/looking-for/${request.id}`} prefetch={false} className="request-row">
            <span className="request-text">
              <span className="request-title">{request.title}</span>{" "}
              <span className="request-meta">
                {names.get(request.campusSlug)} · {offersLabel(request.offers)}
              </span>
            </span>
            <ArrowRightIcon className="request-arrow" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The request rows' shape while they stream in (spec section 9). */
export function RequestsSkeleton() {
  return (
    <ul className="request-list" aria-hidden="true">
      {[0, 1, 2].map((n) => (
        <li key={n}>
          <span className="skeleton request-skeleton" />
        </li>
      ))}
    </ul>
  );
}
