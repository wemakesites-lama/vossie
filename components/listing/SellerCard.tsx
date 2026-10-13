import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { Photo } from "@/components/listings/Photo";
import { badgeLabel } from "@/lib/format";
import type { Seller, TrustBadge } from "@/lib/types";

type SellerCardProps = {
  seller: Seller;
  badge: TrustBadge | null;
  campusName: string;
};

/** Who's selling (spec 5.1): photo, name, Verified, trust badge, campus and their shop. */
export function SellerCard({ seller, badge, campusName }: SellerCardProps) {
  return (
    <section aria-labelledby="seller-title" className="listing-seller">
      <Photo image={{ src: seller.image.src, alt: "" }} ratio="1 / 1" sizes="56px" className="listing-seller-photo" />
      <div className="listing-seller-body">
        <p className="listing-seller-eyebrow">Listed by</p>
        <h2 id="seller-title" className="listing-seller-name">
          {seller.name}
        </h2>
        <p className="listing-seller-meta">{campusName}</p>
        {(seller.verified || badge) && (
          <p className="listing-seller-marks">
            {seller.verified && (
              <span className="listing-verified">
                <CheckIcon className="size-4" />
                Verified by the Hub
              </span>
            )}
            {badge && <span className="listing-badge">{badgeLabel(badge)}</span>}
          </p>
        )}
        <Link href={`/sellers/${seller.slug}`} className="listing-seller-link">
          See their shop
        </Link>
      </div>
    </section>
  );
}
