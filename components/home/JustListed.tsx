import { Suspense } from "react";
import { ALL_CAMPUSES, campusLabel } from "@/lib/campus";
import { getCampuses, getJustListed } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import type { CampusChoice, Listing } from "@/lib/types";
import { JustListedViews } from "./JustListedViews";
import { ListingCard, ListingCardSkeleton } from "@/components/listings/ListingCard";
import { SectionError } from "./SectionError";
import { SectionHeader } from "./SectionHeader";

const LIMIT = 10;
const SEE_ALL = { href: "/browse", label: "See all", context: " new listings" };
// Spec 7.8's quiet note. The "Saved on this device" toast says the same at the moment of saving (plan decision 13).
const SAVE_NOTE = "Hearts save to this device for now. They'll follow your account once CampusCart is live.";

/** Just listed (spec 7.8): the newest listings at the visitor's campus, with a switch to every campus. */
export function JustListed() {
  return (
    <section id="just-listed" aria-labelledby="just-listed-title" className="home-section">
      <Suspense fallback={<JustListedSkeleton />}>
        <JustListedContent />
      </Suspense>
    </section>
  );
}

async function loadListings(campus: CampusChoice) {
  const [campuses, own, everywhere] = await Promise.all([
    getCampuses(),
    campus === ALL_CAMPUSES ? [] : getJustListed({ campus, limit: LIMIT }),
    getJustListed({ campus: ALL_CAMPUSES, limit: LIMIT }),
  ]);
  return { campuses, own, everywhere };
}

export async function JustListedContent() {
  const { campus } = await getViewerContext();
  // A failure shows this section's error state, and the rest of the page carries on (plan decision 6).
  const data = await loadListings(campus).catch(() => null);
  if (!data) {
    return (
      <>
        <SectionHeader id="just-listed" eyebrow="Just listed" title="New listings" link={SEE_ALL} />
        <SectionError id="just-listed" title="Just listed" />
      </>
    );
  }

  const names = new Map(data.campuses.map((item) => [item.slug, item.name]));
  // An empty list says so, rather than leaving a bare grid. In practice this is the "All campuses" view when nothing
  // is new anywhere: the campus view's own empty state comes from the client, which shows it when campusCount is 0.
  const grid = (items: readonly Listing[]) =>
    items.length === 0 ? (
      <p className="just-listed-none">No new listings yet. Check back soon.</p>
    ) : (
      <ul className="listing-grid">
        {items.map((listing) => (
          <li key={listing.id}>
            <ListingCard listing={listing} campusName={names.get(listing.campusSlug) ?? ""} />
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <JustListedViews
        campusName={campus === ALL_CAMPUSES ? null : campusLabel(campus, data.campuses)}
        campusCount={data.own.length}
        campusView={grid(data.own)}
        allView={grid(data.everywhere)}
        link={SEE_ALL}
      />
      <p className="just-listed-note">{SAVE_NOTE}</p>
    </>
  );
}

/** The section's shape while it streams in (spec section 9). */
export function JustListedSkeleton() {
  return (
    <>
      <SectionHeader id="just-listed" eyebrow="Just listed" title="New listings" link={SEE_ALL} />
      <ul className="listing-grid" aria-hidden="true">
        {Array.from({ length: LIMIT }, (_, n) => (
          <li key={n}>
            <ListingCardSkeleton />
          </li>
        ))}
      </ul>
      <p className="just-listed-note">{SAVE_NOTE}</p>
    </>
  );
}
