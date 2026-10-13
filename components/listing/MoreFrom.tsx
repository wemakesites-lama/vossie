import { SectionError } from "@/components/home/SectionError";
import { ListingCard } from "@/components/listings/ListingCard";
import { getMoreFrom } from "@/lib/data";
import type { Listing } from "@/lib/types";

type MoreFromProps = {
  listing: Listing;
  sellerName: string;
  categoryName: string;
  campusNames: ReadonlyMap<string, string>;
};

/** More from the seller, or more in the category (spec 5.7). Hidden when there's nothing to show. */
export async function MoreFrom({ listing, sellerName, categoryName, campusNames }: MoreFromProps) {
  const more = await getMoreFrom(listing, 4).catch(() => null);
  if (more && more.items.length === 0) return null;

  let title = "More listings";
  if (more?.from === "seller") title = `More from ${sellerName}`;
  if (more?.from === "category") title = `More in ${categoryName}`;

  return (
    <section id="more-from" aria-labelledby="more-from-title" className="listing-more">
      <h2 id="more-from-title" className="listing-section-title">
        {title}
      </h2>
      {more ? (
        <ul className="listing-more-grid">
          {more.items.map((item) => (
            <li key={item.id}>
              <ListingCard listing={item} campusName={campusNames.get(item.campusSlug) ?? ""} />
            </li>
          ))}
        </ul>
      ) : (
        <SectionError id="more-from" title="More listings" path={`/listings/${listing.id}`} />
      )}
    </section>
  );
}
