import Link from "next/link";
import { SectionError } from "@/components/home/SectionError";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { getRelatedListings } from "@/lib/data";
import type { LookingForRequest } from "@/lib/types";

type RelatedListingsProps = {
  request: Pick<LookingForRequest, "id" | "categorySlug" | "campusSlug">;
  categoryName: string;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * "Already on Vossie" (community spec 4.2, decision 4): up to 4 available listings in the request's category, its
 * campus first, then a link to the rest in browse, so a student can find the thing without waiting for offers. Hidden
 * when nothing in the category is listed.
 */
export async function RelatedListings({ request, categoryName, campusNames }: RelatedListingsProps) {
  const listings = await getRelatedListings({
    categorySlug: request.categorySlug,
    campusSlug: request.campusSlug,
    limit: 4,
  }).catch(() => null);
  if (listings && listings.length === 0) return null;

  return (
    <section id="already-on-vossie" aria-labelledby="already-on-vossie-title" className="request-related">
      <h2 id="already-on-vossie-title" className="listing-section-title">
        Already on Vossie
      </h2>
      {listings ? (
        <>
          <ListingGrid listings={listings} campusNames={campusNames} columns="four" />
          <Link href={`/browse?cat=${request.categorySlug}`} prefetch={false} className="section-link request-see-all">
            See all in {categoryName}
          </Link>
        </>
      ) : (
        <SectionError id="already-on-vossie" title="Listings" path={`/looking-for/${request.id}`} />
      )}
    </section>
  );
}
