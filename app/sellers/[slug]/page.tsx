import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { SellerView } from "@/components/seller/SellerView";
import { PageFallback } from "@/components/ui/PageFallback";
import { getCampuses, getSeller, getSellerSlugs } from "@/lib/data";
import { atLeastOne, PLACEHOLDER_PARAMS } from "@/lib/static-params";

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
    openGraph: { title: `${seller.name} · ${campus} on CampusCart`, description: seller.tagline },
  };
}

/** Every open shop's storefront; on an empty database, a placeholder whose page is the 404 (2b plan Task 17b). */
export async function generateStaticParams() {
  return atLeastOne(
    (await getSellerSlugs()).map((slug) => ({ slug })),
    PLACEHOLDER_PARAMS.seller,
  );
}

export default function SellerPage({ params }: PageProps<"/sellers/[slug]">) {
  return (
    // Known sellers are prerendered, but the fallback still shows while the page streams in (see PageFallback), and for
    // an unknown slug until the 404 takes over.
    <PageTransition>
      <Reveal fallback={<PageFallback />}>
        <SellerDetails params={params} />
      </Reveal>
    </PageTransition>
  );
}

async function SellerDetails({ params }: Pick<PageProps<"/sellers/[slug]">, "params">) {
  const { slug } = await params;
  const [seller, campuses] = await Promise.all([getSeller(slug), getCampuses()]);
  if (!seller) notFound();
  return <SellerView seller={seller} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />;
}
