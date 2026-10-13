import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingView } from "@/components/listing/ListingView";
import { RecordRecentlyViewed } from "@/components/listings/RecordRecentlyViewed";
import { getCampuses, getListingDetail, getListingIds } from "@/lib/data";
import { priceLabel, shortDescription } from "@/lib/format";

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

export async function generateStaticParams() {
  return (await getListingIds()).map((id) => ({ id }));
}

export default function ListingPage({ params }: PageProps<"/listings/[id]">) {
  return (
    // Known listings are prerendered, so this fallback only shows for an unknown id, until the 404 takes over.
    <Suspense fallback={null}>
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
