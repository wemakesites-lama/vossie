import { ListingCard } from "@/components/listings/ListingCard";
import { browseHref } from "@/lib/browse/href";
import { PAGE_SIZE } from "@/lib/browse/query";
import type { BrowseQuery, Listing } from "@/lib/types";

type ResultsGridProps = {
  /** The listings to show: the first `query.shown` of the results. */
  items: readonly Listing[];
  total: number;
  query: BrowseQuery;
  campusNames: ReadonlyMap<string, string>;
};

/** The results (spec 4.6): cards in a grid, then Show more while there are more. */
export function ResultsGrid({ items, total, query, campusNames }: ResultsGridProps) {
  const next = `${browseHref(query, { shown: query.shown + PAGE_SIZE })}#r-${query.shown + 1}`;
  return (
    <section aria-labelledby="results-title">
      <h2 id="results-title" className="sr-only">
        Results
      </h2>
      <ul className="results-grid">
        {items.map((listing, index) => (
          <li key={listing.id} id={`r-${index + 1}`}>
            <ListingCard listing={listing} campusName={campusNames.get(listing.campusSlug) ?? ""} />
          </li>
        ))}
      </ul>
      {total > query.shown && (
        <p className="show-more">
          {/* A full page load, not <Link>: landing on #r-25 puts the keyboard's starting point on the first new card
              (spec 4.6, plan decision 4). */}
          <a href={next} className="btn btn-outline text-navy">
            Show more
          </a>
        </p>
      )}
    </section>
  );
}
