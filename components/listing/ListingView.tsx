import Link from "next/link";
import { Suspense } from "react";
import { FlagIcon } from "@/components/icons";
import { ReportLink } from "@/components/messages/SessionLinks";
import { priceLabel } from "@/lib/format";
import type { ListingDetail } from "@/lib/types";
import { AvailabilityBanner } from "./AvailabilityBanner";
import { CampusNote } from "./CampusNote";
import { CollectBox } from "./CollectBox";
import { Gallery } from "./Gallery";
import { ListingActions } from "./ListingActions";
import { ListingFacts } from "./ListingFacts";
import { MoreFrom } from "./MoreFrom";
import { SafetyNote } from "./SafetyNote";
import { SellerCard } from "./SellerCard";

/**
 * The listing page (spec 5). On phones everything runs in one column, in reading order, with the actions docked at
 * the bottom. On desktop the photos and details sit on the left, beside a column that stays in view (plan decision 9).
 */
export function ListingView({ detail, campusNames }: { detail: ListingDetail; campusNames: ReadonlyMap<string, string> }) {
  const { listing, seller, category, campus, pickupPoint } = detail;

  return (
    <div className="page listing-page">
      <nav aria-label="Breadcrumb" className="listing-crumbs">
        <ol>
          <li>
            <Link href="/browse">Browse</Link>
          </li>
          <li>
            <Link href={`/browse?cat=${category.slug}`} prefetch={false}>
              {category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="listing-layout">
        <Gallery listing={listing} />

        <div className="listing-panel">
          <AvailabilityBanner availability={listing.availability} />
          <h1 className="listing-heading">{listing.title}</h1>
          <p className="listing-page-price">{priceLabel(listing)}</p>
          {listing.swapFor && (
            <p className="swap-callout">
              <strong>Happy to swap for:</strong> {listing.swapFor}
            </p>
          )}
          <ListingActions listing={listing} />
          <CollectBox handover={listing.handover} campusName={campus.name} pickupPointName={pickupPoint?.name ?? null}>
            <Suspense fallback={null}>
              <CampusNote campusSlug={campus.slug} campusName={campus.name} handover={listing.handover} />
            </Suspense>
          </CollectBox>
          <SellerCard seller={seller} badge={listing.badge} campusName={campus.name} />
        </div>

        <div className="listing-details">
          <section aria-labelledby="about-title">
            <h2 id="about-title" className="listing-section-title">
              About this
            </h2>
            <p className="listing-description">{listing.description}</p>
            <ListingFacts listing={listing} categoryName={category.name} campusName={campus.name} />
          </section>
          <SafetyNote />
        </div>
      </div>

      <MoreFrom listing={listing} sellerName={seller.name} categoryName={category.name} campusNames={campusNames} />

      <p className="listing-report">
        <ReportLink target={{ kind: "listing", id: listing.id }}>
          <FlagIcon className="size-4" />
          Report this listing
        </ReportLink>
      </p>
    </div>
  );
}
