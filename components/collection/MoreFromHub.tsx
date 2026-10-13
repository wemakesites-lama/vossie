import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { Photo } from "@/components/listings/Photo";
import type { Collection } from "@/lib/types";

/** The Hub's other collections (shopping spec 7.2): rows with a 64px thumbnail, the eyebrow and the title. */
export function MoreFromHub({ collections }: { collections: readonly Collection[] }) {
  if (collections.length === 0) return null;
  return (
    <section aria-labelledby="hub-more-title" className="hub-more">
      <h2 id="hub-more-title" className="listing-section-title">
        More from the Hub
      </h2>
      <ul className="hub-more-list">
        {collections.map((collection) => (
          <li key={collection.slug}>
            {/* No prefetch: a list of pages, most of which won't be opened (mobile data). */}
            <Link href={`/collections/${collection.slug}`} prefetch={false} className="hub-more-link">
              <Photo
                image={{ src: collection.image.src, alt: "" }}
                ratio="1 / 1"
                sizes="64px"
                className="hub-more-thumb"
              />
              <span className="hub-more-text">
                <span className="hub-more-eyebrow">{collection.eyebrow}</span>{" "}
                <span className="hub-more-title">{collection.title}</span>
              </span>
              <ArrowRightIcon className="hub-more-arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
