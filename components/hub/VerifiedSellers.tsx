import Link from "next/link";
import { SectionError } from "@/components/home/SectionError";
import { Photo } from "@/components/listings/Photo";
import type { Seller } from "@/lib/types";

type VerifiedSellersProps = {
  /** Null when they didn't load. */
  sellers: readonly Seller[] | null;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * Verified by the Hub (community spec 5.1, decision 8): every verified seller as a small card (a round photo, the name
 * and the campus) linking to their storefront. One row that scrolls sideways on phones; it wraps from the tablet step
 * (plan decision 7). Hidden when there are none.
 */
export function VerifiedSellers({ sellers, campusNames }: VerifiedSellersProps) {
  if (sellers && sellers.length === 0) return null;
  return (
    <section id="hub-verified" aria-labelledby="hub-verified-title" className="hub-verified">
      <h2 id="hub-verified-title" className="listing-section-title">
        Verified by the Hub
      </h2>
      {sellers ? (
        <ul className="hub-sellers">
          {sellers.map((seller) => (
            <li key={seller.slug}>
              {/* No prefetch: a row of storefronts, most of which won't be opened (decision 28). */}
              <Link href={`/sellers/${seller.slug}`} prefetch={false} className="hub-seller">
                <Photo
                  image={{ src: seller.image.src, alt: "" }}
                  ratio="1 / 1"
                  sizes="56px"
                  className="hub-seller-photo"
                />
                <span className="hub-seller-name">{seller.name}</span>{" "}
                <span className="hub-seller-campus">{campusNames.get(seller.campusSlug)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <SectionError id="hub-verified" title="Verified sellers" path="/hub" />
      )}
    </section>
  );
}
