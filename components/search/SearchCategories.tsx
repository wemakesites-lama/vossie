import Link from "next/link";
import type { Category } from "@/lib/types";

/**
 * The search overlay's Categories (spec section 6.5). Static, so the root layout renders it on the server and hands it
 * to SearchOverlay as a node: its code isn't in the overlay's client code, which every page loads (AI stage D: the
 * listing forms sat 1 B under the 150 KB budget, and the photo search link needed room). One overlay per page, so a
 * fixed id names the section.
 */
export function SearchCategories({ categories }: { categories: readonly Category[] }) {
  return (
    <section aria-labelledby="search-categories-title" className="search-section">
      <h2 id="search-categories-title" className="search-heading">
        Categories
      </h2>
      <ul className="search-categories">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link href={`/browse?cat=${category.slug}`} className="search-category">
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
