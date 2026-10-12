import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { getCollections } from "@/lib/data";
import { Photo } from "./Photo";

/**
 * The Hub's collections (spec 7.6). On desktop and tablet, hovering or focusing a title deals its photo onto the stack.
 * That is CSS only (:has() in globals.css), written for four collections.
 */
export async function Collections() {
  const collections = (await getCollections()).slice(0, 4);
  return (
    <section aria-labelledby="collections-title" className="home-panel collections">
      <h2 id="collections-title" className="sr-only">
        Collections from the Incubation Hub
      </h2>
      <div className="collections-stack" aria-hidden="true">
        <span className="collections-fan collections-fan-back" />
        <span className="collections-fan collections-fan-middle" />
        {collections.map((collection) => (
          <Photo
            key={collection.slug}
            image={{ src: collection.image.src, alt: "" }}
            sizes="330px"
            className="collections-photo"
          />
        ))}
      </div>
      <ul className="collections-list">
        {collections.map((collection) => (
          <li key={collection.slug} className="collections-item">
            <Link href={`/collections/${collection.slug}`} className="collections-link">
              <Photo
                image={{ src: collection.image.src, alt: "" }}
                ratio="1 / 1"
                sizes="64px"
                className="collections-thumb"
              />
              <span className="collections-text">
                <span className="collections-eyebrow">{collection.eyebrow}</span>{" "}
                <span className="collections-title">{collection.title}</span>
              </span>
              <ArrowRightIcon className="collections-arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
