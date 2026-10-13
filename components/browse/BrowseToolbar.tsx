import { ChevronDownIcon } from "@/components/icons";
import { SORT_LABELS, countActiveFilters, countLabel } from "@/lib/browse/filters";
import { browseHref } from "@/lib/browse/href";
import type { BrowseQuery, Campus } from "@/lib/types";
import { FiltersPanel } from "./FiltersPanel";
import { SortMenu } from "./SortMenu";

type BrowseToolbarProps = {
  query: BrowseQuery;
  campuses: readonly Campus[];
  /** How many results there are, or null when the search failed. */
  total: number | null;
};

/**
 * Filters, Sort and the count (spec 4.4 and 4.6). Both menus are native <details>, which iPhones on iOS 16 can open
 * (decision 41). They share a name, so opening one closes the other where the browser supports it.
 */
export function BrowseToolbar({ query, campuses, total }: BrowseToolbarProps) {
  const active = countActiveFilters(query);
  // Keyed on the link: a client-side navigation (a sort link) gives closed menus, not ones left open (plan decision 5).
  const href = browseHref(query);
  return (
    <div className="browse-tools">
      <details key={`filters ${href}`} name="browse-tools" className="tool tool-filters">
        {/* aria-label, not hidden spans: Chromium puts spaces between a summary's flex children (plan decision 2). */}
        <summary aria-label={active > 0 ? `Filters, ${active} active` : "Filters"} className="tool-button">
          {active > 0 ? `Filters (${active})` : "Filters"}
          <ChevronDownIcon className="tool-chevron size-4" />
        </summary>
        <FiltersPanel query={query} campuses={campuses} />
      </details>
      <details key={`sort ${href}`} name="browse-tools" className="tool tool-sort">
        <summary className="tool-button">
          Sort: {SORT_LABELS[query.sort]}
          <ChevronDownIcon className="tool-chevron size-4" />
        </summary>
        <SortMenu query={query} />
      </details>
      {total !== null && total > 0 && <p className="browse-count">{countLabel(total, Math.min(total, query.shown))}</p>}
    </div>
  );
}
