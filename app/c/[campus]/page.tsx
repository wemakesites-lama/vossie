import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { getCampuses } from "@/lib/data";

/** The tab reads "Midrand · Vossie" (the layout adds the suffix). An unknown slug gets the 404's title. */
export async function generateMetadata({ params }: PageProps<"/c/[campus]">): Promise<Metadata> {
  const { campus: slug } = await params;
  const campus = (await getCampuses()).find((item) => item.slug === slug);
  return { title: campus ? campus.name : "Page not found" };
}

export async function generateStaticParams() {
  return (await getCampuses()).map((campus) => ({ campus: campus.slug }));
}

export default function CampusPage({ params }: PageProps<"/c/[campus]">) {
  return (
    // Known campuses are prerendered, so this fallback only shows for an unknown slug, until the 404 takes over.
    <Suspense fallback={null}>
      <CampusDetails params={params} />
    </Suspense>
  );
}

async function CampusDetails({ params }: Pick<PageProps<"/c/[campus]">, "params">) {
  const { campus: slug } = await params;
  const campus = (await getCampuses()).find((item) => item.slug === slug);
  if (!campus) notFound();
  return (
    <ComingSoon title={campus.name}>
      {campus.liveListings} live listings at {campus.name} ({campus.region}). The campus storefront arrives in the next
      stage.
    </ComingSoon>
  );
}
