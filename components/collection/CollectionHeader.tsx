import { Photo } from "@/components/listings/Photo";
import { listingsLabel } from "@/lib/format";
import type { Collection } from "@/lib/types";

/**
 * A collection's header (shopping spec 7.2): the photo, then the eyebrow, title, intro, who curated it and the count.
 * Phones show the photo edge to edge at 4:3; from the tablet step it sits on the left at 4:5 (plan decision 7). The
 * photo is decorative: the title says what the collection is.
 */
export function CollectionHeader({ collection, count }: { collection: Collection; count: number | null }) {
  return (
    <div className="collection-head">
      <Photo
        image={{ src: collection.image.src, alt: "" }}
        sizes="(min-width: 64rem) and (min-height: 30rem) 480px, (min-width: 48rem) and (min-height: 30rem) 40vw, 100vw"
        className="collection-photo"
        priority
      />
      <div className="collection-head-text">
        <p className="eyebrow">{collection.eyebrow}</p>
        <h1 className="collection-title">{collection.title}</h1>
        <p className="collection-intro">{collection.intro}</p>
        <p className="collection-curator">Curated by the Incubation Hub</p>
        {count !== null && <p className="collection-count">{listingsLabel(count)}</p>}
      </div>
    </div>
  );
}
