import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { RecordRecentlyViewed } from "@/components/listings/RecordRecentlyViewed";
import { getCampuses, getListing, getListingIds } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  return { title: listing ? listing.title : "Page not found" };
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
  const listing = await getListing(id);
  if (!listing) notFound();
  const campus = (await getCampuses()).find((item) => item.slug === listing.campusSlug);
  return (
    <>
      <RecordRecentlyViewed item={{ id: listing.id, title: listing.title, image: listing.image }} />
      <ComingSoon title={listing.title}>
        Listed at {campus?.name ?? "an Eduvos campus"}. Listing pages, with photos, messages and safe pickup, arrive in
        the next stage.
      </ComingSoon>
    </>
  );
}
