import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { RecordRecentlyViewed } from "@/components/listings/RecordRecentlyViewed";
import { getListingDetail, getListingIds } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getListingDetail(id);
  return { title: detail ? detail.listing.title : "Page not found" };
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
  const detail = await getListingDetail(id);
  if (!detail) notFound();
  const { listing, campus } = detail;
  return (
    <>
      <RecordRecentlyViewed item={{ id: listing.id, title: listing.title, image: listing.image }} />
      <ComingSoon title={listing.title}>
        Listed at {campus.name}. The full listing page arrives later in this build.
      </ComingSoon>
    </>
  );
}
