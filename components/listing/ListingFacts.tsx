import Link from "next/link";
import { conditionLabel } from "@/lib/format";
import { longSastDate } from "@/lib/time";
import type { Listing } from "@/lib/types";

type ListingFactsProps = {
  listing: Pick<Listing, "categorySlug" | "condition" | "createdAt">;
  categoryName: string;
  campusName: string;
};

/** The facts (spec 5.1). "Listed" is a date in SAST, not "2 hours ago", so the page needs no clock. */
export function ListingFacts({ listing, categoryName, campusName }: ListingFactsProps) {
  return (
    <dl className="listing-facts">
      <div>
        <dt>Category</dt>
        <dd>
          <Link href={`/browse?cat=${listing.categorySlug}`} prefetch={false}>
            {categoryName}
          </Link>
        </dd>
      </div>
      {listing.condition && (
        <div>
          <dt>Condition</dt>
          <dd>{conditionLabel(listing.condition)}</dd>
        </div>
      )}
      <div>
        <dt>Campus</dt>
        <dd>{campusName}</dd>
      </div>
      <div>
        <dt>Listed</dt>
        <dd>
          <time dateTime={listing.createdAt}>{longSastDate(listing.createdAt)}</time>
        </dd>
      </div>
    </dl>
  );
}
