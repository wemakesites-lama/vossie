import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CollectionView } from "@/components/collection/CollectionView";
import { PageFallback } from "@/components/ui/PageFallback";
import { getCampuses, getCategories, getCollection, getCollectionListings, getCollections } from "@/lib/data";
import { atLeastOne, PLACEHOLDER_PARAMS } from "@/lib/static-params";

/**
 * The tab title is the collection's ("Res setup under R500 · Vossie"; the layout adds the suffix) and the description
 * its intro (shopping spec 7.2). An unknown slug gets the 404's title.
 */
export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return { title: "Page not found" };
  return { title: collection.title, description: collection.intro };
}

/** Every collection's page; were there none, a placeholder whose page is the 404 (2b plan Task 17b). */
export async function generateStaticParams() {
  return atLeastOne(
    (await getCollections()).map((collection) => ({ slug: collection.slug })),
    PLACEHOLDER_PARAMS.collection,
  );
}

export default function CollectionPage({ params }: PageProps<"/collections/[slug]">) {
  return (
    // Known collections are prerendered, but the fallback still shows while the page streams in (see PageFallback), and
    // for an unknown slug until the 404 takes over.
    <Suspense fallback={<PageFallback />}>
      <CollectionDetails params={params} />
    </Suspense>
  );
}

async function CollectionDetails({ params }: Pick<PageProps<"/collections/[slug]">, "params">) {
  const { slug } = await params;
  const [collection, collections, categories, campuses] = await Promise.all([
    getCollection(slug),
    getCollections(),
    getCategories(),
    getCampuses(),
  ]);
  if (!collection) notFound();
  // Only a known collection's listings are looked up, so an unknown slug doesn't also cache an empty listings result
  // (its "not found" lookup is still cached).
  const listings = await getCollectionListings(slug).catch(() => null);
  return (
    <CollectionView
      collection={collection}
      listings={listings}
      others={collections.filter((item) => item.slug !== slug)}
      categories={categories}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />
  );
}
