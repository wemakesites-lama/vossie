import Link from "next/link";
import { SectionError } from "@/components/home/SectionError";
import { CheckIcon } from "@/components/icons";
import { Photo } from "@/components/listings/Photo";
import { NavPending } from "@/components/ui/NavPending";
import { CARD } from "@/lib/motion";
import type { Seller } from "@/lib/types";

type VerifiedShopsProps = {
  /** Null when they didn't load. */
  sellers: readonly Seller[] | null;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * Verified shops (Launchpad spec 4.4): every verified shop, A to Z, as a row (a small round photo, the name linking to
 * the storefront and covering the row, what it sells and where, and the Verified mark). One column on phones, two from
 * the tablet step, three on desktop. Hidden when there are none.
 */
export function VerifiedShops({ sellers, campusNames }: VerifiedShopsProps) {
  if (sellers && sellers.length === 0) return null;
  return (
    <section id="hub-verified" aria-labelledby="hub-verified-title" className="hub-section">
      <h2 id="hub-verified-title" className="listing-section-title">
        Verified shops
      </h2>
      <p className="hub-section-lede">
        The Hub has met every one of these shops and checked who runs it.{" "}
        <Link href="/trust" prefetch={false} className="hub-section-link">
          How Verified works
        </Link>
      </p>
      {sellers ? (
        <ul className="hub-sellers">
          {sellers.map((seller) => (
            <li key={seller.slug} className="hub-shop">
              <Photo
                image={{ src: seller.image.src, alt: "" }}
                ratio="1 / 1"
                sizes="40px"
                className="hub-shop-photo"
              />
              <div className="hub-shop-body">
                {/* No prefetch: a list of storefronts, most of which won't be opened (decision 28). */}
                <Link href={`/sellers/${seller.slug}`} prefetch={false} className="hub-shop-link" transitionTypes={CARD}>
                  {seller.name}
                  <NavPending />
                </Link>
                <span className="hub-shop-meta">
                  {seller.category} · {campusNames.get(seller.campusSlug)}
                </span>
                <span className="hub-shop-verified">
                  <CheckIcon className="size-4" />
                  Verified
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <SectionError id="hub-verified" title="Verified shops" path="/hub" />
      )}
    </section>
  );
}
