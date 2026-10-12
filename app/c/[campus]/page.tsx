import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { getCampuses } from "@/lib/data";

export const metadata: Metadata = { title: "Campus" };

export async function generateStaticParams() {
  return (await getCampuses()).map((campus) => ({ campus: campus.slug }));
}

export default function CampusPage({ params }: PageProps<"/c/[campus]">) {
  return (
    <Suspense fallback={<ComingSoon title="Campus" />}>
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
