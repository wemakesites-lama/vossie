import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { getCollections } from "@/lib/data";

/** The tab reads "Back-to-campus essentials · Vossie" (the layout adds the suffix). An unknown slug gets the 404's title. */
export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const collection = (await getCollections()).find((item) => item.slug === slug);
  return { title: collection ? collection.title : "Page not found" };
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
  const collection = (await getCollections()).find((item) => item.slug === slug);
  if (!collection) notFound();
  return (
    <ComingSoon title={collection.title}>
      {collection.eyebrow}: the Incubation Hub&apos;s picks for the season arrive in the next stage.
    </ComingSoon>
  );
}
