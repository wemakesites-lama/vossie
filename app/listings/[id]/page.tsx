import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingView } from "@/components/listing/ListingView";
import { RecordRecentlyViewed } from "@/components/listings/RecordRecentlyViewed";
import { PageFallback } from "@/components/ui/PageFallback";
import { getCampuses, getListingDetail, getListingIds } from "@/lib/data";
import { priceLabel, shortDescription } from "@/lib/format";
import { atLeastOne, PLACEHOLDER_PARAMS } from "@/lib/static-params";

/** The tab title is the listing; link previews get "{title} · {price}" and the start of the description (spec 5.8). */
export async function generateMetadata({ params }: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getListingDetail(id);
  if (!detail) return { title: "Page not found" };
  const { listing } = detail;
  const description = shortDescription(listing.description);
  return {
    title: listing.title,
    description,
    openGraph: { title: `${listing.title} · ${priceLabel(listing)}`, description },
  };
}

/** Every listing's page; on an empty database, a placeholder whose page is the 404 (2b plan Task 17b). */
export async function generateStaticParams() {
  return atLeastOne(
    (await getListingIds()).map((id) => ({ id })),
    PLACEHOLDER_PARAMS.listing,
  );
}

export default function ListingPage({ params }: PageProps<"/listings/[id]">) {
  return (
    // Known listings are prerendered, but the fallback still shows while the page streams in (see PageFallback), and
    // for an unknown id until the 404 takes over.
    <Suspense fallback={<PageFallback />}>
      <ListingDetails params={params} />
    </Suspense>
  );
}

async function ListingDetails({ params }: Pick<PageProps<"/listings/[id]">, "params">) {
  const { id } = await params;
  const [detail, campuses] = await Promise.all([getListingDetail(id), getCampuses()]);
  if (!detail) notFound();
  const { listing } = detail;
  return (
    <>
      <RecordRecentlyViewed item={{ id: listing.id, title: listing.title, image: listing.image }} />
      <ListingView detail={detail} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />
    </>
  );
}
