import { FlagIcon } from "@/components/icons";
import { ReportLink } from "@/components/messages/SessionLinks";
import { monthYear } from "@/lib/format";
import type { Seller } from "@/lib/types";
import { SellerHero } from "./SellerHero";
import { SellerListings } from "./SellerListings";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

type SellerViewProps = {
  seller: Seller;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * A seller's storefront (shopping spec 4): the poster band, About, their listings and the report link. On desktop
 * About sits on the left, beside the listings (spec 4.2).
 */
export function SellerView({ seller, campusNames }: SellerViewProps) {
  return (
    <div className="page seller-page">
      <Trail crumbs={trailFor("/sellers/[slug]", { names: { "/sellers/[slug]": seller.name } })} />
      <SellerHero seller={seller} campusName={campusNames.get(seller.campusSlug) ?? ""} />

      <div className="seller-layout">
        <section aria-labelledby="seller-about-title" className="seller-about">
          <h2 id="seller-about-title" className="listing-section-title">
            About
          </h2>
          <p className="seller-about-text">{seller.about}</p>
          <p className="seller-since">Selling since {monthYear(seller.since)}</p>
        </section>
        <SellerListings seller={seller} campusNames={campusNames} />
      </div>

      {/* The listing page's report link style. */}
      <p className="listing-report">
        <ReportLink target={{ kind: "seller", id: seller.slug }}>
          <FlagIcon className="size-4" />
          Report this seller
        </ReportLink>
      </p>
    </div>
  );
}
