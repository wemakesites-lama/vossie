import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { getSeller, getSellerSlugs } from "@/lib/data";

/** The tab reads "Hair studio · Vossie" (the layout adds the suffix). An unknown slug gets the 404's title. */
export async function generateMetadata({ params }: PageProps<"/sellers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const seller = await getSeller(slug);
  return { title: seller ? seller.name : "Page not found" };
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
  const seller = await getSeller(slug);
  if (!seller) notFound();
  return <ComingSoon title={seller.name}>{seller.tagline} Seller storefronts arrive in the next stage.</ComingSoon>;
}
