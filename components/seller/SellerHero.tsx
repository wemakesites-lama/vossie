import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { ShareButton } from "@/components/listing/ShareButton";
import { Photo } from "@/components/listings/Photo";
import { badgeLabel } from "@/lib/format";
import { signInHref } from "@/lib/next-path";
import type { Seller } from "@/lib/types";

/**
 * The storefront's poster band (shopping spec 4.1, layout A): the seller's photo, name and tagline on navy stars, with
 * stamps for the campus, the category, Verified and the trust badge, then Message and Share. Small text on the stars is
 * white; sky only fills the Verified stamp and the Message pill, which carry navy text.
 */
export function SellerHero({ seller, campusName }: { seller: Seller; campusName: string }) {
  return (
    <div className="seller-hero surface-navy texture-stars">
      <Photo
        image={seller.image}
        ratio="1 / 1"
        sizes="(min-width: 64rem) and (min-height: 30rem) 96px, 64px"
        className="seller-hero-photo"
        priority
      />
      <div className="seller-hero-text">
        <h1 className="seller-hero-name">{seller.name}</h1>
        <p className="seller-hero-tagline">{seller.tagline}</p>
        <ul className="seller-stamps">
          <li className="seller-stamp">{campusName}</li>
          <li className="seller-stamp">{seller.category}</li>
          {seller.verified && (
            <li className="seller-stamp seller-verified">
              <CheckIcon className="size-4" />
              Verified
            </li>
          )}
          {seller.badge && <li className="seller-stamp seller-badge">{badgeLabel(seller.badge)}</li>}
        </ul>
      </div>
      <div className="seller-hero-actions">
        <Link href={signInHref(`/sellers/${seller.slug}`)} prefetch={false} className="btn btn-sky seller-message">
          Message seller
        </Link>
        <ShareButton title={seller.name} className="seller-share" />
      </div>
    </div>
  );
}
