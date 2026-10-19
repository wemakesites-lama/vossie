import Link from "next/link";
import { Photo } from "@/components/listings/Photo";
import { listingsLabel } from "@/lib/format";
import { unfollowShop } from "@/lib/following/actions";
import { savedTabPath } from "@/lib/following/rules";
import { signInHref } from "@/lib/next-path";
import type { FollowedShop } from "@/lib/types";

type FollowedShopsViewProps = {
  /** Newest follow first; null when signed out. */
  shops: readonly FollowedShop[] | null;
  campusNames: ReadonlyMap<string, string>;
  /** The last unfollow's words, once (plan decision 7). */
  notice: string | null;
};

/** What a card says: the round photo, the name, the campus, "Paused", and what the shop has listed. */
function ShopCardFace({ shop, campusName }: { shop: FollowedShop; campusName: string | undefined }) {
  return (
    <>
      <Photo image={{ src: shop.image.src, alt: "" }} ratio="1 / 1" sizes="56px" className="hub-seller-photo" />
      <span className="hub-seller-name">{shop.name}</span> <span className="hub-seller-campus">{campusName}</span>{" "}
      {shop.paused && <span className="saved-shop-paused">Paused</span>}{" "}
      <span className="saved-shop-listed">
        {shop.listed === 0 ? "Nothing listed right now" : listingsLabel(shop.listed)}
      </span>
    </>
  );
}

/**
 * Saved's Shops tab (community actions spec 2.17, plan decision 17): the Hub's small seller cards (round photo, name,
 * campus, "Paused"), how many each has listed, and Unfollow, which comes back here. No prefetch on the storefronts:
 * their chunk carries Share and the hearts (decision 53). A shop the Hub paused has no storefront (its page is the
 * 404), so its card is not a link, but Unfollow stays (plan amendment 17.6).
 */
export function FollowedShopsView({ shops, campusNames, notice }: FollowedShopsViewProps) {
  if (shops === null) {
    return (
      <section aria-labelledby="saved-shops-title" className="saved-empty">
        <h2 id="saved-shops-title" className="saved-empty-title">
          Shops you follow
        </h2>
        <p>Sign in to follow shops. They&apos;ll show here.</p>
        <Link href={signInHref(savedTabPath("shops"))} prefetch={false} className="btn btn-primary">
          Sign in
        </Link>
      </section>
    );
  }
  return (
    <section aria-labelledby="saved-shops-title">
      <h2 id="saved-shops-title" className="sr-only">
        Shops you follow
      </h2>
      {notice && (
        <p role="status" className="form-notice saved-shops-notice">
          {notice}
        </p>
      )}
      {shops.length === 0 ? (
        <div className="saved-empty">
          <p className="saved-empty-title">No shops yet</p>
          <p>Follow a shop from its page and it shows here.</p>
          <Link href="/browse" prefetch={false} className="btn btn-primary">
            Browse
          </Link>
        </div>
      ) : (
        <>
          <p className="saved-count">{shops.length === 1 ? "1 shop" : `${shops.length} shops`}</p>
          <ul className="saved-shops">
            {shops.map((shop) => (
              <li key={shop.slug} className="saved-shop">
                {shop.storefront ? (
                  <Link href={`/sellers/${shop.slug}`} prefetch={false} className="hub-seller">
                    <ShopCardFace shop={shop} campusName={campusNames.get(shop.campusSlug)} />
                  </Link>
                ) : (
                  <div className="hub-seller">
                    <ShopCardFace shop={shop} campusName={campusNames.get(shop.campusSlug)} />
                  </div>
                )}
                <form action={unfollowShop}>
                  <input type="hidden" name="shop" value={shop.slug} />
                  <input type="hidden" name="from" value="saved" />
                  <button type="submit" className="btn btn-outline text-navy saved-shop-unfollow">
                    Unfollow <span className="sr-only">{shop.name}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
