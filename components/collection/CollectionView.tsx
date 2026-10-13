import type { ReactNode } from "react";
import { SectionError } from "@/components/home/SectionError";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { collectionBrowseLinks } from "@/lib/collections";
import type { Category, Collection, Listing } from "@/lib/types";
import { CollectionBrowseLinks } from "./CollectionBrowseLinks";
import { CollectionHeader } from "./CollectionHeader";
import { MoreFromHub } from "./MoreFromHub";

type CollectionViewProps = {
  collection: Collection;
  /** Null when they didn't load. */
  listings: readonly Listing[] | null;
  /** The Hub's other collections. */
  others: readonly Collection[];
  categories: readonly Category[];
  campusNames: ReadonlyMap<string, string>;
};

/**
 * A collection page (shopping spec 7.2): the header, the matching listings from every campus, then more in browse and
 * more from the Hub. With nothing matching, "Nothing here right now", and the browse links still follow.
 */
export function CollectionView({ collection, listings, others, categories, campusNames }: CollectionViewProps) {
  let body: ReactNode;
  if (listings === null) {
    body = <SectionError id="collection-listings" title="Listings" path={`/collections/${collection.slug}`} />;
  } else if (listings.length === 0) {
    body = <p className="collection-empty">Nothing here right now</p>;
  } else {
    body = <ListingGrid listings={listings} campusNames={campusNames} columns="five" />;
  }

  return (
    <div className="page collection-page">
      <CollectionHeader collection={collection} count={listings?.length ?? null} />
      <section id="collection-listings" aria-labelledby="collection-listings-title" className="collection-listings">
        <h2 id="collection-listings-title" className="sr-only">
          Listings in {collection.title}
        </h2>
        {body}
      </section>
      <CollectionBrowseLinks links={collectionBrowseLinks(collection.rule, categories)} />
      <MoreFromHub collections={others} />
    </div>
  );
}
