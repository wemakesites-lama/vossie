import { CheckIcon } from "@/components/icons";
import { ShareButton } from "@/components/listing/ShareButton";
import { Photo } from "@/components/listings/Photo";
import { MessageSellerLink } from "@/components/messages/SessionLinks";
import { badgeLabel } from "@/lib/format";
import type { Seller } from "@/lib/types";

type SellerHeroProps = { seller: Seller; campusName: string; paused?: boolean };

/**
 * The storefront's poster band (shopping spec 4.1, layout A): the seller's photo, name and tagline on navy stars, with
 * stamps for the campus, the category, Verified and the trust badge, then Message and Share. Small text on the stars is
 * white; sky only fills the Verified stamp and the Message pill, which carry navy text. A paused shop takes no new
 * messages: Message's place says so, as a paused listing's page does (selling plan decision 2, amendment 10).
 */
export function SellerHero({ seller, campusName, paused = false }: SellerHeroProps) {
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
        {paused ? (
          <p className="availability-banner seller-paused">Not taking orders right now</p>
        ) : (
          <MessageSellerLink target={{ kind: "shop", sellerSlug: seller.slug }} className="btn btn-sky seller-message">
            Message seller
          </MessageSellerLink>
        )}
        <ShareButton title={seller.name} className="seller-share" />
      </div>
    </div>
  );
}
