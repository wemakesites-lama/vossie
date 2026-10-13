import Link from "next/link";
import type { ReactNode } from "react";
import { SectionError } from "@/components/home/SectionError";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { getSellerListings } from "@/lib/data";
import { listingsLabel } from "@/lib/format";
import type { Seller } from "@/lib/types";

type SellerListingsProps = {
  seller: Seller;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * The seller's available listings, newest first, 4 across on desktop (shopping spec 4.1). With none, a link to their
 * category; if they fail to load, the section's own error.
 */
export async function SellerListings({ seller, campusNames }: SellerListingsProps) {
  const listings = await getSellerListings(seller.slug).catch(() => null);

  let body: ReactNode;
  if (listings === null) {
    body = <SectionError id="seller-listings" title="Listings" path={`/sellers/${seller.slug}`} />;
  } else if (listings.length === 0) {
    body = (
      <div className="seller-empty">
        <p className="seller-empty-title">Nothing listed right now</p>
        <Link href={`/browse?cat=${seller.categorySlug}`} prefetch={false}>
          More in {seller.category}
        </Link>
      </div>
    );
  } else {
    body = <ListingGrid listings={listings} campusNames={campusNames} columns="four" />;
  }

  return (
    <section id="seller-listings" aria-labelledby="seller-listings-title" className="seller-listings">
      <h2 id="seller-listings-title" className="listing-section-title">
        {listings && listings.length > 0 ? listingsLabel(listings.length) : "Listings"}
      </h2>
      {body}
    </section>
  );
}
