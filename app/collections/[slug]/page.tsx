import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CollectionView } from "@/components/collection/CollectionView";
import { getCampuses, getCategories, getCollection, getCollectionListings, getCollections } from "@/lib/data";

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

export async function generateStaticParams() {
  return (await getCollections()).map((collection) => ({ slug: collection.slug }));
}

export default function CollectionPage({ params }: PageProps<"/collections/[slug]">) {
  return (
    // Known collections are prerendered, so this fallback only shows for an unknown slug, until the 404 takes over.
    <Suspense fallback={null}>
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
  // Only a known collection's listings are looked up, so an unknown slug never makes its own cache entry.
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
