import type { ReactNode } from "react";
import { getCampuses, getCategories, searchListings } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { browseHref } from "@/lib/browse/href";
import { knownSlugs, parseBrowseParams, toSearchQuery, type BrowseParams } from "@/lib/browse/query";
import { ActiveFilters } from "./ActiveFilters";
import { BrowseEmpty } from "./BrowseEmpty";
import { BrowseError } from "./BrowseError";
import { BrowseHeader } from "./BrowseHeader";
import { BrowseToolbar } from "./BrowseToolbar";
import { CategoryTabs } from "./CategoryTabs";
import { ResultsGrid } from "./ResultsGrid";

/**
 * The browse page's body (browse and listing spec 4). It reads the link and the viewer's campus, so it renders per
 * request, inside the page's <Suspense>. A failed search shows an error in the results' place; everything above it
 * still works.
 */
export async function BrowseView({ searchParams }: { searchParams: Promise<BrowseParams> }) {
  const [params, viewer, campuses, categories] = await Promise.all([
    searchParams,
    getViewerContext(),
    getCampuses(),
    getCategories(),
  ]);
  const query = parseBrowseParams(params, viewer.campus, knownSlugs(campuses, categories));
  const result = await searchListings(toSearchQuery(query)).catch(() => null);

  const categoryName = categories.find((category) => category.slug === query.category)?.name ?? null;
  const campusNames = new Map(campuses.map((campus) => [campus.slug, campus.name]));

  let results: ReactNode;
  if (result === null) results = <BrowseError href={browseHref(query)} />;
  else if (result.items.length === 0) results = <BrowseEmpty query={query} elsewhere={result.elsewhere} />;
  else {
    results = (
      <ResultsGrid
        items={result.items.slice(0, query.shown)}
        total={result.items.length}
        query={query}
        campusNames={campusNames}
      />
    );
  }

  return (
    <>
      <BrowseHeader query={query} categoryName={categoryName} />
      <CategoryTabs query={query} categories={categories} />
      <BrowseToolbar query={query} campuses={campuses} total={result ? result.items.length : null} />
      <ActiveFilters query={query} campusNames={campusNames} />
      {results}
    </>
  );
}
