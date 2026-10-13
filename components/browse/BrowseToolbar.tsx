import { ChevronDownIcon } from "@/components/icons";
import { SORT_LABELS, countActiveFilters, countLabel } from "@/lib/browse/filters";
import { browseHref } from "@/lib/browse/href";
import { cx } from "@/lib/cx";
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
  // Keyed on the link and the campus: a client-side navigation (a category tab), or a campus chosen in the picker (which
  // refreshes the page without changing its link), gives closed menus and a Filters form showing the new campus. An
  // uncontrolled <select> would otherwise keep the old one (plan decision 5).
  const key = `${query.campus} ${browseHref(query)}`;
  const counted = total !== null && total > 0;
  return (
    <div className="browse-tools">
      <details key={`filters ${key}`} name="browse-tools" className="tool tool-filters">
        {/* aria-label, not hidden spans: Chromium puts spaces between a summary's flex children (plan decision 2). */}
        <summary aria-label={active > 0 ? `Filters, ${active} active` : "Filters"} className="tool-button">
          {active > 0 ? `Filters (${active})` : "Filters"}
          <ChevronDownIcon className="tool-chevron size-4" />
        </summary>
        <FiltersPanel query={query} campuses={campuses} />
      </details>
      <details key={`sort ${key}`} name="browse-tools" className="tool tool-sort">
        <summary className="tool-button">
          Sort: {SORT_LABELS[query.sort]}
          <ChevronDownIcon className="tool-chevron size-4" />
        </summary>
        <SortMenu query={query} />
      </details>
      {/* Always there, as a status message, so a screen reader hears the new count after a campus is chosen in the
          picker, which refreshes the page in place and keeps the tab title (WCAG 4.1.3). With nothing to count it's
          hidden from view. */}
      <p role="status" className={cx("browse-count", !counted && "sr-only")}>
        {counted ? countLabel(total, Math.min(total, query.shown)) : total === 0 ? "No listings" : ""}
      </p>
    </div>
  );
}
