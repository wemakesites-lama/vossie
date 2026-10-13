import Link from "next/link";
import { browseHref } from "@/lib/browse/href";
import type { BrowseQuery, Category } from "@/lib/types";

/**
 * All, then the categories, as a row of links (spec 4.3). Each keeps the search and filters. No prefetching: each
 * tab is a different page of results, and fetching them all would cost mobile data (plan decision 3).
 */
export function CategoryTabs({ query, categories }: { query: BrowseQuery; categories: readonly Category[] }) {
  const tabs = [{ slug: null, name: "All" }, ...categories.map(({ slug, name }) => ({ slug, name }))];
  return (
    <nav aria-label="Categories" className="category-tabs">
      <ul>
        {tabs.map((tab) => (
          <li key={tab.slug ?? "all"}>
            <Link
              href={browseHref(query, { category: tab.slug })}
              prefetch={false}
              aria-current={tab.slug === query.category ? "page" : undefined}
              className="category-tab"
            >
              {tab.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
