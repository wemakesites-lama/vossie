import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SellerView } from "@/components/seller/SellerView";
import { getCampuses, getSeller, getSellerSlugs, isShopPaused } from "@/lib/data";

/**
 * The tab title is the seller's name ("Tech corner · Vossie"; the layout adds the suffix) and the description their
 * tagline. Link previews say where: "Tech corner · Midrand on Vossie" (spec 4.3). An unknown slug gets the 404's title.
 */
export async function generateMetadata({ params }: PageProps<"/sellers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [seller, campuses] = await Promise.all([getSeller(slug), getCampuses()]);
  if (!seller) return { title: "Page not found" };
  const campus = campuses.find((item) => item.slug === seller.campusSlug)?.name ?? "Eduvos";
  return {
    title: seller.name,
    description: seller.tagline,
    openGraph: { title: `${seller.name} · ${campus} on Vossie`, description: seller.tagline },
  };
}

export async function generateStaticParams() {
  return (await getSellerSlugs()).map((slug) => ({ slug }));
}

export default function SellerPage({ params }: PageProps<"/sellers/[slug]">) {
  return (
    // Known sellers are prerendered, so this fallback only shows for an unknown slug, until the 404 takes over.
    <Suspense fallback={null}>
      <SellerDetails params={params} />
    </Suspense>
  );
}

async function SellerDetails({ params }: Pick<PageProps<"/sellers/[slug]">, "params">) {
  const { slug } = await params;
  const [seller, campuses, paused] = await Promise.all([getSeller(slug), getCampuses(), isShopPaused(slug)]);
  if (!seller) notFound();
  return (
    <SellerView
      seller={seller}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      paused={paused}
    />
  );
}
