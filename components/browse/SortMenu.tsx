import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { SORT_LABELS } from "@/lib/browse/filters";
import { browseHref } from "@/lib/browse/href";
import type { BrowseQuery, BrowseSort } from "@/lib/types";

/** The Sort menu (spec 4.4): links, so one tap applies. Best match only appears with a search. */
export function SortMenu({ query }: { query: BrowseQuery }) {
  const sorts: readonly BrowseSort[] = query.q
    ? ["match", "new", "price-low", "price-high"]
    : ["new", "price-low", "price-high"];
  return (
    <ul className="sort-menu">
      {sorts.map((sort) => {
        const current = sort === query.sort;
        return (
          <li key={sort}>
            <Link
              href={browseHref(query, { sort })}
              prefetch={false}
              aria-current={current ? "true" : undefined}
              className="sort-option"
            >
              {SORT_LABELS[sort]}
              {current && <CheckIcon className="size-4" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
