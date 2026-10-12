import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { getCategories } from "@/lib/data";

export const metadata: Metadata = { title: "Category" };

export async function generateStaticParams() {
  return (await getCategories()).map((category) => ({ slug: category.slug }));
}

export default function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  return (
    <Suspense fallback={<ComingSoon title="Category" />}>
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
