import Link from "next/link";
import { FlagIcon } from "@/components/icons";
import { budgetLabel, dayMonth, offersSoFarLabel } from "@/lib/format";
import { signInHref } from "@/lib/next-path";
import { shortSastDate } from "@/lib/time";
import type { Category, LookingForRequest } from "@/lib/types";
import { RelatedListings } from "./RelatedListings";

type RequestViewProps = {
  request: LookingForRequest;
  category: Pick<Category, "slug" | "name">;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * A request's page (community spec 4.2): what's asked for, in the asker's words, the offers so far and a way to help,
 * then listings already on Vossie that might do. The asker stays unnamed (community spec decision 2). On desktop the
 * offers sit beside the request (plan decision 18).
 */
export function RequestView({ request, category, campusNames }: RequestViewProps) {
  const campusName = campusNames.get(request.campusSlug) ?? "";
  const signIn = signInHref(`/looking-for/${request.id}`);

  return (
    <div className="page request-page">
      <nav aria-label="Breadcrumb" className="listing-crumbs">
        <ol>
          <li>
            <Link href="/looking-for">Looking For</Link>
          </li>
          <li>
            <Link href={`/looking-for?cat=${category.slug}`} prefetch={false}>
              {category.name}
            </Link>
          </li>
        </ol>
      </nav>

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
          {request.status === "open" ? (
            <>
              <p className="request-offers-count">{offersSoFarLabel(request.offers)}</p>
              <Link href={signIn} prefetch={false} className="btn btn-primary request-offer">
                Offer to help
              </Link>
            </>
          ) : (
            <p className="request-offers-count">This request is closed</p>
          )}
        </section>
      </div>

      <RelatedListings request={request} categoryName={category.name} campusNames={campusNames} />

      {/* The listing page's report link style. */}
      <p className="listing-report">
        <Link href={signIn} prefetch={false}>
          <FlagIcon className="size-4" />
          Report this request
        </Link>
      </p>
    </div>
  );
}
