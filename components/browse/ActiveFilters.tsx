import { CloseIcon } from "@/components/icons";
import { activeFilters, clearAllHref } from "@/lib/browse/filters";
import type { BrowseQuery } from "@/lib/types";

/**
 * A chip for each active filter, and Clear all with two or more (spec 4.5). Plain <a>, a full page load like the
 * Filters form: a client-side navigation removes the focused link, and focus would be lost.
 */
export function ActiveFilters({ query, campusNames }: { query: BrowseQuery; campusNames: ReadonlyMap<string, string> }) {
  const chips = activeFilters(query, campusNames);
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Active filters" className="filter-chips">
      {chips.map((chip) => (
        <li key={chip.key}>
          <a href={chip.removeHref} aria-label={`Remove filter: ${chip.label}`} className="filter-chip">
            {chip.label}
            <CloseIcon className="size-4" />
          </a>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <a href={clearAllHref(query)} className="chips-clear">
            Clear all
          </a>
        </li>
      )}
    </ul>
  );
}
