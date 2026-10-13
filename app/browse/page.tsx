import type { Metadata } from "next";
import { Suspense } from "react";
import { BrowseSkeleton } from "@/components/browse/BrowseSkeleton";
import { BrowseView } from "@/components/browse/BrowseView";
import { browseHeading } from "@/lib/browse/heading";
import { knownSlugs, parseBrowseParams } from "@/lib/browse/query";
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses, getCategories } from "@/lib/data";

/**
 * The tab title follows the page: "Tech · Vossie", "“calculator” · Vossie" (spec 4.10). It reads searchParams, so it
 * streams with the page's request-time body. Search pages stay out of search engines; category pages are indexed.
 */
export async function generateMetadata({ searchParams }: PageProps<"/browse">): Promise<Metadata> {
  const [params, campuses, categories] = await Promise.all([searchParams, getCampuses(), getCategories()]);
  const query = parseBrowseParams(params, ALL_CAMPUSES, knownSlugs(campuses, categories));
  const categoryName = categories.find((category) => category.slug === query.category)?.name ?? null;
  return {
    title: browseHeading(query.q, categoryName).title,
    robots: query.q ? { index: false } : undefined,
  };
}

export default function BrowsePage({ searchParams }: PageProps<"/browse">) {
  return (
    <div className="page browse">
      <Suspense fallback={<BrowseSkeleton />}>
        <BrowseView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
