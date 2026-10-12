import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { getCategories } from "@/lib/data";

/** The tab reads "Tech · Vossie" (the layout adds the suffix). An unknown slug gets the 404's title. */
export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((item) => item.slug === slug);
  return { title: category ? category.name : "Page not found" };
}

export async function generateStaticParams() {
  return (await getCategories()).map((category) => ({ slug: category.slug }));
}

export default function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  return (
    // Known categories are prerendered, so this fallback only shows for an unknown slug, until the 404 takes over.
    <Suspense fallback={null}>
      <CategoryDetails params={params} />
    </Suspense>
  );
}

async function CategoryDetails({ params }: Pick<PageProps<"/categories/[slug]">, "params">) {
  const { slug } = await params;
  const category = (await getCategories()).find((item) => item.slug === slug);
  if (!category) notFound();
  return <ComingSoon title={category.name}>Every {category.name.toLowerCase()} listing arrives in the next stage.</ComingSoon>;
}
