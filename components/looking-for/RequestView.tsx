import { FlagIcon } from "@/components/icons";
import { ReportLink } from "@/components/messages/SessionLinks";
import { budgetLabel, dayMonth } from "@/lib/format";
import { shortSastDate } from "@/lib/time";
import type { Category, LookingForRequest } from "@/lib/types";
import { OffersPanel } from "./OffersPanel";
import { RelatedListings } from "./RelatedListings";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

type RequestViewProps = {
  request: LookingForRequest;
  category: Pick<Category, "slug" | "name">;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * A request's page (community spec 4.2): what's asked for, in the asker's words, the offers so far and a way to help,
 * then listings already on Vossie that might do. The asker stays unnamed (community spec decision 2). On desktop the
 * offers sit beside the request (plan decision 18). The offers panel follows the session: the asker manages their
 * request there (community actions plan decision 19).
 */
export function RequestView({ request, category, campusNames }: RequestViewProps) {
  const campusName = campusNames.get(request.campusSlug) ?? "";

  return (
    <div className="page request-page">
      <Trail
        crumbs={trailFor("/looking-for/[id]", {
          names: { "/looking-for/[id]": request.title },
          between: [{ label: category.name, href: `/looking-for?cat=${category.slug}` }],
        })}
      />

      <div className="request-layout">
        <div>
          <h1 className="request-heading">{request.title}</h1>
          <ul className="fact-pills request-facts">
            <li>{campusName}</li>
            <li>{category.name}</li>
            <li>{budgetLabel(request)}</li>
            {request.neededBy && (
              <li>
                Needed by <time dateTime={request.neededBy}>{dayMonth(request.neededBy)}</time>
              </li>
            )}
            <li>
              Posted <time dateTime={request.createdAt}>{shortSastDate(request.createdAt)}</time>
            </li>
            <li>Asked by a student at {campusName}</li>
          </ul>
          <p className="request-details">{request.details}</p>
        </div>

        <section aria-labelledby="request-offers-title" className="request-offers">
          <h2 id="request-offers-title" className="sr-only">
            Offers
          </h2>
          <OffersPanel request={request} />
        </section>
      </div>

      <RelatedListings request={request} categoryName={category.name} campusNames={campusNames} />

      {/* The listing page's report link style. */}
      <p className="listing-report">
        <ReportLink target={{ kind: "request", id: request.id }}>
          <FlagIcon className="size-4" />
          Report this request
        </ReportLink>
      </p>
    </div>
  );
}
