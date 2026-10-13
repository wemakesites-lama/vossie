import Link from "next/link";
import { CloseIcon } from "@/components/icons";
import { activeFilters, clearAllHref } from "@/lib/browse/filters";
import type { BrowseQuery } from "@/lib/types";

/** A chip for each active filter, and Clear all with two or more (spec 4.5). */
export function ActiveFilters({ query, campusNames }: { query: BrowseQuery; campusNames: ReadonlyMap<string, string> }) {
  const chips = activeFilters(query, campusNames);
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Active filters" className="filter-chips">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={chip.removeHref}
            prefetch={false}
            aria-label={`Remove filter: ${chip.label}`}
            className="filter-chip"
          >
            {chip.label}
            <CloseIcon className="size-4" />
          </Link>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <Link href={clearAllHref(query)} prefetch={false} className="chips-clear">
            Clear all
          </Link>
        </li>
      )}
    </ul>
  );
}
