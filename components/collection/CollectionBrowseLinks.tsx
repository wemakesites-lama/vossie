import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import type { BrowseLink } from "@/lib/collections";

/** "More in browse" (shopping spec 7.2): one link per category in the collection's rule, keeping its price cap. */
export function CollectionBrowseLinks({ links }: { links: readonly BrowseLink[] }) {
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="collection-browse-title" className="collection-browse">
      <h2 id="collection-browse-title" className="listing-section-title">
        More in browse
      </h2>
      <ul className="collection-browse-list">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} prefetch={false} className="collection-browse-link">
              {link.label}
              <ArrowRightIcon className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
