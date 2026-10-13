import type { Listing } from "@/lib/types";
import { ListingCard } from "./ListingCard";

type ListingGridProps = {
  listings: readonly Listing[];
  campusNames: ReadonlyMap<string, string>;
  /** "five": 2, 3 and 5 across (Saved, collections). "four": 2, 3 and 4 across (storefronts, More from). */
  columns: "five" | "four";
  /** The Saved page's cards: their hearts start pressed (shopping spec 5.3). */
  saved?: boolean;
};

/** A grid of listing cards (shopping spec 7.1). Browse keeps its own, for its numbered cards and Show more. */
export function ListingGrid({ listings, campusNames, columns, saved = false }: ListingGridProps) {
  return (
    <ul className="card-grid" data-columns={columns}>
      {listings.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} campusName={campusNames.get(listing.campusSlug) ?? ""} saved={saved} />
        </li>
      ))}
    </ul>
  );
}
