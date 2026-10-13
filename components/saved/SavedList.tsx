import Link from "next/link";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { getCampuses, getListingsByIds } from "@/lib/data";
import { getSavedIds } from "@/lib/data/saved";

/**
 * The saved listings (shopping spec 5.2), read from the saved cookie on each request: a count, then the cards in saved
 * order, newest first. Paused and sold ones stay, tagged; ids that no longer exist are dropped. The hearts start
 * pressed, and unpressing one leaves the card in place, greyed, until the next visit (spec 5.3).
 */
export async function SavedList() {
  const ids = await getSavedIds();
  const [listings, campuses] = await Promise.all([
    getListingsByIds(ids).catch(() => null),
    getCampuses().catch(() => []),
  ]);

  if (listings === null) {
    return (
      <div className="section-error">
        <p>We couldn&apos;t load your saved listings just now.</p>
        <a href="/saved" className="btn btn-outline text-navy">
          Try again
        </a>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <section aria-labelledby="saved-empty-title" className="saved-empty">
        <h2 id="saved-empty-title" className="saved-empty-title">
          Nothing saved yet
        </h2>
        <p>Tap the heart on any listing to keep it here.</p>
        <Link href="/browse" className="btn btn-primary">
          Start browsing
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="saved-list-title">
      <h2 id="saved-list-title" className="sr-only">
        Your saved listings
      </h2>
      <p className="saved-count">{listings.length} saved</p>
      <ListingGrid
        listings={listings}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
        columns="five"
        saved
      />
    </section>
  );
}
